/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ExtHostChatSessions_1;
import { coalesce } from '../../../base/common/arrays.js';
import { CancellationTokenSource } from '../../../base/common/cancellation.js';
import { CancellationError } from '../../../base/common/errors.js';
import { Disposable, DisposableStore } from '../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../base/common/map.js';
import { revive } from '../../../base/common/marshalling.js';
import { URI } from '../../../base/common/uri.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { ChatAgentLocation } from '../../contrib/chat/common/constants.js';
import { MainContext } from './extHost.protocol.js';
import { ChatAgentResponseStream } from './extHostChatAgents2.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import * as typeConvert from './extHostTypeConverters.js';
import * as extHostTypes from './extHostTypes.js';
class ExtHostChatSession {
    constructor(session, extension, request, proxy, commandsConverter, sessionDisposables) {
        this.session = session;
        this.extension = extension;
        this.proxy = proxy;
        this.commandsConverter = commandsConverter;
        this.sessionDisposables = sessionDisposables;
        this._stream = new ChatAgentResponseStream(extension, request, proxy, commandsConverter, sessionDisposables);
    }
    get activeResponseStream() {
        return this._stream;
    }
    getActiveRequestStream(request) {
        return new ChatAgentResponseStream(this.extension, request, this.proxy, this.commandsConverter, this.sessionDisposables);
    }
}
let ExtHostChatSessions = class ExtHostChatSessions extends Disposable {
    static { ExtHostChatSessions_1 = this; }
    static { this._sessionHandlePool = 0; }
    constructor(commands, _languageModels, _extHostRpc, _logService) {
        super();
        this.commands = commands;
        this._languageModels = _languageModels;
        this._extHostRpc = _extHostRpc;
        this._logService = _logService;
        this._chatSessionItemProviders = new Map();
        this._chatSessionContentProviders = new Map();
        this._nextChatSessionItemProviderHandle = 0;
        this._nextChatSessionContentProviderHandle = 0;
        /**
         * Map of uri -> chat session items
         *
         * TODO: this isn't cleared/updated properly
         */
        this._sessionItems = new ResourceMap();
        /**
         * Map of uri -> chat sessions infos
         */
        this._extHostChatSessions = new ResourceMap();
        this._proxy = this._extHostRpc.getProxy(MainContext.MainThreadChatSessions);
        commands.registerArgumentProcessor({
            processArgument: (arg) => {
                if (arg && arg.$mid === 25 /* MarshalledId.ChatSessionContext */) {
                    const id = arg.session.resource || arg.sessionId;
                    const sessionContent = this._sessionItems.get(id);
                    if (sessionContent) {
                        return sessionContent;
                    }
                    else {
                        this._logService.warn(`No chat session found for ID: ${id}`);
                        return arg;
                    }
                }
                return arg;
            }
        });
    }
    registerChatSessionItemProvider(extension, chatSessionType, provider) {
        const handle = this._nextChatSessionItemProviderHandle++;
        const disposables = new DisposableStore();
        this._chatSessionItemProviders.set(handle, { provider, extension, disposable: disposables, sessionType: chatSessionType });
        this._proxy.$registerChatSessionItemProvider(handle, chatSessionType);
        if (provider.onDidChangeChatSessionItems) {
            disposables.add(provider.onDidChangeChatSessionItems(() => {
                this._proxy.$onDidChangeChatSessionItems(handle);
            }));
        }
        if (provider.onDidCommitChatSessionItem) {
            disposables.add(provider.onDidCommitChatSessionItem((e) => {
                const { original, modified } = e;
                this._proxy.$onDidCommitChatSessionItem(handle, original.resource, modified.resource);
            }));
        }
        return {
            dispose: () => {
                this._chatSessionItemProviders.delete(handle);
                disposables.dispose();
                this._proxy.$unregisterChatSessionItemProvider(handle);
            }
        };
    }
    registerChatSessionContentProvider(extension, chatSessionScheme, chatParticipant, provider, capabilities) {
        const handle = this._nextChatSessionContentProviderHandle++;
        const disposables = new DisposableStore();
        this._chatSessionContentProviders.set(handle, { provider, extension, capabilities, disposable: disposables });
        this._proxy.$registerChatSessionContentProvider(handle, chatSessionScheme);
        return new extHostTypes.Disposable(() => {
            this._chatSessionContentProviders.delete(handle);
            disposables.dispose();
            this._proxy.$unregisterChatSessionContentProvider(handle);
        });
    }
    convertChatSessionStatus(status) {
        if (status === undefined) {
            return undefined;
        }
        switch (status) {
            case 0: // vscode.ChatSessionStatus.Failed
                return 0 /* ChatSessionStatus.Failed */;
            case 1: // vscode.ChatSessionStatus.Completed
                return 1 /* ChatSessionStatus.Completed */;
            case 2: // vscode.ChatSessionStatus.InProgress
                return 2 /* ChatSessionStatus.InProgress */;
            default:
                return undefined;
        }
    }
    convertChatSessionItem(sessionType, sessionContent) {
        return {
            resource: sessionContent.resource,
            label: sessionContent.label,
            description: sessionContent.description ? typeConvert.MarkdownString.from(sessionContent.description) : undefined,
            status: this.convertChatSessionStatus(sessionContent.status),
            tooltip: typeConvert.MarkdownString.fromStrict(sessionContent.tooltip),
            timing: {
                startTime: sessionContent.timing?.startTime ?? 0,
                endTime: sessionContent.timing?.endTime
            },
            statistics: sessionContent.statistics ? {
                files: sessionContent.statistics?.files ?? 0,
                insertions: sessionContent.statistics?.insertions ?? 0,
                deletions: sessionContent.statistics?.deletions ?? 0
            } : undefined
        };
    }
    async $provideNewChatSessionItem(handle, options, token) {
        const entry = this._chatSessionItemProviders.get(handle);
        if (!entry || !entry.provider.provideNewChatSessionItem) {
            throw new Error(`No provider registered for handle ${handle} or provider does not support creating sessions`);
        }
        try {
            const model = await this.getModelForRequest(options.request, entry.extension);
            const vscodeRequest = typeConvert.ChatAgentRequest.to(revive(options.request), undefined, model, [], new Map(), entry.extension, this._logService);
            const vscodeOptions = {
                request: vscodeRequest,
                metadata: options.metadata
            };
            const chatSessionItem = await entry.provider.provideNewChatSessionItem(vscodeOptions, token);
            if (!chatSessionItem) {
                throw new Error('Provider did not create session');
            }
            this._sessionItems.set(chatSessionItem.resource, chatSessionItem);
            return this.convertChatSessionItem(entry.sessionType, chatSessionItem);
        }
        catch (error) {
            this._logService.error(`Error creating chat session: ${error}`);
            throw error;
        }
    }
    async $provideChatSessionItems(handle, token) {
        const entry = this._chatSessionItemProviders.get(handle);
        if (!entry) {
            this._logService.error(`No provider registered for handle ${handle}`);
            return [];
        }
        const sessions = await entry.provider.provideChatSessionItems(token);
        if (!sessions) {
            return [];
        }
        const response = [];
        for (const sessionContent of sessions) {
            this._sessionItems.set(sessionContent.resource, sessionContent);
            response.push(this.convertChatSessionItem(entry.sessionType, sessionContent));
        }
        return response;
    }
    async $provideChatSessionContent(handle, sessionResourceComponents, token) {
        const provider = this._chatSessionContentProviders.get(handle);
        if (!provider) {
            throw new Error(`No provider for handle ${handle}`);
        }
        const sessionResource = URI.revive(sessionResourceComponents);
        const session = await provider.provider.provideChatSessionContent(sessionResource, token);
        if (token.isCancellationRequested) {
            throw new CancellationError();
        }
        const sessionDisposables = new DisposableStore();
        const sessionId = ExtHostChatSessions_1._sessionHandlePool++;
        const id = sessionResource.toString();
        const chatSession = new ExtHostChatSession(session, provider.extension, {
            sessionId: `${id}.${sessionId}`,
            sessionResource,
            requestId: 'ongoing',
            agentId: id,
            message: '',
            variables: { variables: [] },
            location: ChatAgentLocation.Chat,
        }, {
            $handleProgressChunk: (requestId, chunks) => {
                return this._proxy.$handleProgressChunk(handle, sessionResource, requestId, chunks);
            },
            $handleAnchorResolve: (requestId, requestHandle, anchor) => {
                this._proxy.$handleAnchorResolve(handle, sessionResource, requestId, requestHandle, anchor);
            },
        }, this.commands.converter, sessionDisposables);
        const disposeCts = sessionDisposables.add(new CancellationTokenSource());
        this._extHostChatSessions.set(sessionResource, { sessionObj: chatSession, disposeCts });
        // Call activeResponseCallback immediately for best user experience
        if (session.activeResponseCallback) {
            Promise.resolve(session.activeResponseCallback(chatSession.activeResponseStream.apiObject, disposeCts.token)).finally(() => {
                // complete
                this._proxy.$handleProgressComplete(handle, sessionResource, 'ongoing');
            });
        }
        const { capabilities } = provider;
        return {
            id: sessionId + '',
            resource: URI.revive(sessionResource),
            hasActiveResponseCallback: !!session.activeResponseCallback,
            hasRequestHandler: !!session.requestHandler,
            supportsInterruption: !!capabilities?.supportsInterruptions,
            options: session.options,
            history: session.history.map(turn => {
                if (turn instanceof extHostTypes.ChatRequestTurn) {
                    return this.convertRequestTurn(turn);
                }
                else {
                    return this.convertResponseTurn(turn, sessionDisposables);
                }
            })
        };
    }
    async $provideHandleOptionsChange(handle, sessionResourceComponents, updates, token) {
        const sessionResource = URI.revive(sessionResourceComponents);
        const provider = this._chatSessionContentProviders.get(handle);
        if (!provider) {
            this._logService.warn(`No provider for handle ${handle}`);
            return;
        }
        if (!provider.provider.provideHandleOptionsChange) {
            this._logService.debug(`Provider for handle ${handle} does not implement provideHandleOptionsChange`);
            return;
        }
        try {
            await provider.provider.provideHandleOptionsChange(sessionResource, updates, token);
        }
        catch (error) {
            this._logService.error(`Error calling provideHandleOptionsChange for handle ${handle}, sessionResource ${sessionResource}:`, error);
        }
    }
    async $provideChatSessionProviderOptions(handle, token) {
        const entry = this._chatSessionContentProviders.get(handle);
        if (!entry) {
            this._logService.warn(`No provider for handle ${handle} when requesting chat session options`);
            return;
        }
        const provider = entry.provider;
        if (!provider.provideChatSessionProviderOptions) {
            return;
        }
        try {
            const { optionGroups } = await provider.provideChatSessionProviderOptions(token);
            if (!optionGroups) {
                return;
            }
            return {
                optionGroups,
            };
        }
        catch (error) {
            this._logService.error(`Error calling provideChatSessionProviderOptions for handle ${handle}:`, error);
            return;
        }
    }
    async $interruptChatSessionActiveResponse(providerHandle, sessionResource, requestId) {
        const entry = this._extHostChatSessions.get(URI.revive(sessionResource));
        entry?.disposeCts.cancel();
    }
    async $disposeChatSessionContent(providerHandle, sessionResource) {
        const entry = this._extHostChatSessions.get(URI.revive(sessionResource));
        if (!entry) {
            this._logService.warn(`No chat session found for resource: ${sessionResource}`);
            return;
        }
        entry.disposeCts.cancel();
        entry.sessionObj.sessionDisposables.dispose();
        this._extHostChatSessions.delete(URI.revive(sessionResource));
    }
    async $invokeChatSessionRequestHandler(handle, sessionResource, request, history, token) {
        const entry = this._extHostChatSessions.get(URI.revive(sessionResource));
        if (!entry || !entry.sessionObj.session.requestHandler) {
            return {};
        }
        const chatRequest = typeConvert.ChatAgentRequest.to(request, undefined, await this.getModelForRequest(request, entry.sessionObj.extension), [], new Map(), entry.sessionObj.extension, this._logService);
        const stream = entry.sessionObj.getActiveRequestStream(request);
        await entry.sessionObj.session.requestHandler(chatRequest, { history: history }, stream.apiObject, token);
        // TODO: do we need to dispose the stream object?
        return {};
    }
    async getModelForRequest(request, extension) {
        let model;
        if (request.userSelectedModelId) {
            model = await this._languageModels.getLanguageModelByIdentifier(extension, request.userSelectedModelId);
        }
        if (!model) {
            model = await this._languageModels.getDefaultLanguageModel(extension);
            if (!model) {
                throw new Error('Language model unavailable');
            }
        }
        return model;
    }
    convertRequestTurn(turn) {
        const variables = turn.references.map(ref => this.convertReferenceToVariable(ref));
        return {
            type: 'request',
            prompt: turn.prompt,
            participant: turn.participant,
            command: turn.command,
            variableData: variables.length > 0 ? { variables } : undefined
        };
    }
    convertReferenceToVariable(ref) {
        const value = ref.value && typeof ref.value === 'object' && 'uri' in ref.value && 'range' in ref.value
            ? typeConvert.Location.from(ref.value)
            : ref.value;
        const range = ref.range ? { start: ref.range[0], endExclusive: ref.range[1] } : undefined;
        const isFile = URI.isUri(value) || (value && typeof value === 'object' && 'uri' in value);
        return {
            id: ref.id,
            name: ref.id,
            value,
            modelDescription: ref.modelDescription,
            range,
            kind: isFile ? 'file' : 'generic'
        };
    }
    convertResponseTurn(turn, sessionDisposables) {
        const parts = coalesce(turn.response.map(r => typeConvert.ChatResponsePart.from(r, this.commands.converter, sessionDisposables)));
        return {
            type: 'response',
            parts,
            participant: turn.participant
        };
    }
};
ExtHostChatSessions = ExtHostChatSessions_1 = __decorate([
    __param(2, IExtHostRpcService),
    __param(3, ILogService)
], ExtHostChatSessions);
export { ExtHostChatSessions };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdENoYXRTZXNzaW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0Q2hhdFNlc3Npb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDMUQsT0FBTyxFQUFxQix1QkFBdUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQzFELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUU3RCxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLDZCQUE2QixDQUFDO0FBRWpFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUdsRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUUzRSxPQUFPLEVBQWtHLFdBQVcsRUFBK0IsTUFBTSx1QkFBdUIsQ0FBQztBQUNqTCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUdsRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUM1RCxPQUFPLEtBQUssV0FBVyxNQUFNLDRCQUE0QixDQUFDO0FBQzFELE9BQU8sS0FBSyxZQUFZLE1BQU0sbUJBQW1CLENBQUM7QUFFbEQsTUFBTSxrQkFBa0I7SUFHdkIsWUFDaUIsT0FBMkIsRUFDM0IsU0FBZ0MsRUFDaEQsT0FBMEIsRUFDVixLQUE4QixFQUM5QixpQkFBb0Ms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