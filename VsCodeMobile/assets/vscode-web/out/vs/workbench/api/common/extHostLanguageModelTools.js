/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { raceCancellation } from '../../../base/common/async.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { CancellationError } from '../../../base/common/errors.js';
import { Lazy } from '../../../base/common/lazy.js';
import { toDisposable } from '../../../base/common/lifecycle.js';
import { revive } from '../../../base/common/marshalling.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { isToolInvocationContext } from '../../contrib/chat/common/languageModelToolsService.js';
import { ExtensionEditToolId, InternalEditToolId } from '../../contrib/chat/common/tools/editFileTool.js';
import { InternalFetchWebPageToolId } from '../../contrib/chat/common/tools/tools.js';
import { SearchExtensionsToolId } from '../../contrib/extensions/common/searchExtensionsTool.js';
import { checkProposedApiEnabled, isProposedApiEnabled } from '../../services/extensions/common/extensions.js';
import { SerializableObjectWithBuffers } from '../../services/extensions/common/proxyIdentifier.js';
import { MainContext } from './extHost.protocol.js';
import * as typeConvert from './extHostTypeConverters.js';
class Tool {
    constructor(data) {
        this._apiObject = new Lazy(() => {
            const that = this;
            return Object.freeze({
                get name() { return that._data.id; },
                get description() { return that._data.modelDescription; },
                get inputSchema() { return that._data.inputSchema; },
                get tags() { return that._data.tags ?? []; },
                get source() { return undefined; }
            });
        });
        this._apiObjectWithChatParticipantAdditions = new Lazy(() => {
            const that = this;
            const source = typeConvert.LanguageModelToolSource.to(that._data.source);
            return Object.freeze({
                get name() { return that._data.id; },
                get description() { return that._data.modelDescription; },
                get inputSchema() { return that._data.inputSchema; },
                get tags() { return that._data.tags ?? []; },
                get source() { return source; }
            });
        });
        this._data = data;
    }
    update(newData) {
        this._data = newData;
    }
    get data() {
        return this._data;
    }
    get apiObject() {
        return this._apiObject.value;
    }
    get apiObjectWithChatParticipantAdditions() {
        return this._apiObjectWithChatParticipantAdditions.value;
    }
}
export class ExtHostLanguageModelTools {
    constructor(mainContext, _languageModels) {
        this._languageModels = _languageModels;
        /** A map of tools that were registered in this EH */
        this._registeredTools = new Map();
        this._tokenCountFuncs = new Map();
        /** A map of all known tools, from other EHs or registered in vscode core */
        this._allTools = new Map();
        this._proxy = mainContext.getProxy(MainContext.MainThreadLanguageModelTools);
        this._proxy.$getTools().then(tools => {
            for (const tool of tools) {
                this._allTools.set(tool.id, new Tool(revive(tool)));
            }
        });
    }
    async $countTokensForInvocation(callId, input, token) {
        const fn = this._tokenCountFuncs.get(callId);
        if (!fn) {
            throw new Error(`Tool invocation call ${callId} not found`);
        }
        return await fn(input, token);
    }
    async invokeTool(extension, toolId, options, token) {
        const callId = generateUuid();
        if (options.tokenizationOptions) {
            this._tokenCountFuncs.set(callId, options.tokenizationOptions.countTokens);
        }
        try {
            if (options.toolInvocationToken && !isToolInvocationContext(options.toolInvocationToken)) {
                throw new Error(`Invalid tool invocation token`);
            }
            if ((toolId === InternalEditToolId || toolId === ExtensionEditToolId) && !isProposedApiEnabled(extension, 'chatParticipantPrivate')) {
                throw new Error(`Invalid tool: ${toolId}`);
            }
            // Making the round trip here because not all tools were necessarily registered in this EH
            const result = await this._proxy.$invokeTool({
                toolId,
                callId,
                parameters: options.input,
                tokenBudget: options.tokenizationOptions?.tokenBudget,
                context: options.toolInvocationToken,
                chatRequestId: isProposedApiEnabled(extension, 'chatParticipantPrivate') ? options.chatRequestId : undefined,
                chatInteractionId: isProposedApiEnabled(extension, 'chatParticipantPrivate') ? options.chatInteractionId : undefined,
                fromSubAgent: isProposedApiEnabled(extension, 'chatParticipantPrivate') ? options.fromSubAgent : undefined,
            }, token);
            const dto = result instanceof SerializableObjectWithBuffers ? result.value : result;
            return typeConvert.LanguageModelToolResult.to(revive(dto));
        }
        finally {
            this._tokenCountFuncs.delete(callId);
        }
    }
    $onDidChangeTools(tools) {
        const oldTools = new Set(this._registeredTools.keys());
        for (const tool of tools) {
            oldTools.delete(tool.id);
            const existing = this._allTools.get(tool.id);
            if (existing) {
                existing.update(tool);
            }
            else {
                this._allTools.set(tool.id, new Tool(revive(tool)));
            }
        }
        for (const id of oldTools) {
            this._allTools.delete(id);
        }
    }
    getTools(extension) {
        const hasParticipantAdditions = isProposedApiEnabled(extension, 'chatParticipantPrivate');
        return Array.from(this._allTools.values())
            .map(tool => hasParticipantAdditions ? tool.apiObjectWithChatParticipantAdditions : tool.apiObject)
            .filter(tool => {
            switch (tool.name) {
                case InternalEditToolId:
                case ExtensionEditToolId:
                case InternalFetchWebPageToolId:
                case SearchExtensionsToolId:
                    return isProposedApiEnabled(extension, 'chatParticipantPrivate');
                default:
                    return true;
            }
        });
    }
    async $invokeTool(dto, token) {
        const item = this._registeredTools.get(dto.toolId);
        if (!item) {
            throw new Error(`Unknown tool ${dto.toolId}`);
        }
        const options = {
            input: dto.parameters,
            toolInvocationToken: revive(dto.context),
        };
        if (isProposedApiEnabled(item.extension, 'chatParticipantPrivate')) {
            options.chatRequestId = dto.chatRequestId;
            options.chatInteractionId = dto.chatInteractionId;
            options.chatSessionId = dto.context?.sessionId;
            options.fromSubAgent = dto.fromSubAgent;
        }
        if (isProposedApiEnabled(item.extension, 'chatParticipantAdditions') && dto.modelId) {
            options.model = await this.getModel(dto.modelId, item.extension);
        }
        if (dto.tokenBudget !== undefined) {
            options.tokenizationOptions = {
                tokenBudget: dto.tokenBudget,
                countTokens: this._tokenCountFuncs.get(dto.callId) || ((value, token = CancellationToken.None) => this._proxy.$countTokensForInvocation(dto.callId, value, token))
            };
        }
        let progress;
        if (isProposedApiEnabled(item.extension, 'toolProgress')) {
            let lastProgress;
            progress = {
                report: value => {
                    if (value.increment !== undefined) {
                        lastProgress = (lastProgress ?? 0) + value.increment;
                    }
                    this._proxy.$acceptToolProgress(dto.callId, {
                        message: typeConvert.MarkdownString.fromStrict(value.message),
                        progress: lastProgress === undefined ? undefined : lastProgress / 100,
                    });
                }
            };
        }
        // todo: 'any' cast because TS can't handle the overloads
        // eslint-disable-next-line local/code-no-any-casts
        const extensionResult = await raceCancellation(Promise.resolve(item.tool.invoke(options, token, progress)), token);
        if (!extensionResult) {
            throw new CancellationError();
        }
        return typeConvert.LanguageModelToolResult.from(extensionResult, item.extension);
    }
    async getModel(modelId, extension) {
        let model;
        if (modelId) {
            model = await this._languageModels.getLanguageModelByIdentifier(extension, modelId);
        }
        if (!model) {
            model = await this._languageModels.getDefaultLanguageModel(extension);
            if (!model) {
                throw new Error('Language model unavailable');
            }
        }
        return model;
    }
    async $prepareToolInvocation(toolId, context, token) {
        const item = this._registeredTools.get(toolId);
        if (!item) {
            throw new Error(`Unknown tool ${toolId}`);
        }
        const options = {
            input: context.parameters,
            chatRequestId: context.chatRequestId,
            chatSessionId: context.chatSessionId,
            chatInteractionId: context.chatInteractionId
        };
        if (item.tool.prepareInvocation) {
            const result = await item.tool.prepareInvocation(options, token);
            if (!result) {
                return undefined;
            }
            if (result.pastTenseMessage || result.presentation) {
                checkProposedApiEnabled(item.extension, 'chatParticipantPrivate');
            }
            return {
                confirmationMessages: result.confirmationMessages ? {
                    title: typeof result.confirmationMessages.title === 'string' ? result.confirmationMessages.title : typeConvert.MarkdownString.from(result.confirmationMessages.title),
                    message: typeof result.confirmationMessages.message === 'string' ? result.confirmationMessages.message : typeConvert.MarkdownString.from(result.confirmationMessages.message),
                } : undefined,
                invocationMessage: typeConvert.MarkdownString.fromStrict(result.invocationMessage),
                pastTenseMessage: typeConvert.MarkdownString.fromStrict(result.pastTenseMessage),
                presentation: result.presentation
            };
        }
        return undefined;
    }
    registerTool(extension, id, tool) {
        this._registeredTools.set(id, { extension, tool });
        this._proxy.$registerTool(id);
        return toDisposable(() => {
            this._registeredTools.delete(id);
            this._proxy.$unregisterTool(id);
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdExhbmd1YWdlTW9kZWxUb29scy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0TGFuZ3VhZ2VNb2RlbFRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ2pFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUNwRCxPQUFPLEVBQWUsWUFBWSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUU1RCxPQUFPLEVBQTJCLHVCQUF1QixFQUF1SCxNQUFNLHdEQUF3RCxDQUFDO0FBQy9PLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQzFHLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQy9HLE9BQU8sRUFBTyw2QkFBNkIsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3pHLE9BQU8sRUFBOEQsV0FBVyxFQUFxQyxNQUFNLHVCQUF1QixDQUFDO0FBRW5KLE9BQU8sS0FBSyxXQUFXLE1BQU0sNEJBQTRCLENBQUM7QUFFMUQsTUFBTSxJ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