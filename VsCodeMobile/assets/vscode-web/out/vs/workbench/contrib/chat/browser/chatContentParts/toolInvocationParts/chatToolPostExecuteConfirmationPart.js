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
import * as dom from '../../../../../../base/browser/dom.js';
import { Separator } from '../../../../../../base/common/actions.js';
import { getExtensionForMimeType } from '../../../../../../base/common/mime.js';
import { ILanguageService } from '../../../../../../editor/common/languages/language.js';
import { IModelService } from '../../../../../../editor/common/services/model.js';
import { localize } from '../../../../../../nls.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../../platform/keybinding/common/keybinding.js';
import { ChatResponseResource } from '../../../common/chatModel.js';
import { ILanguageModelToolsConfirmationService } from '../../../common/languageModelToolsConfirmationService.js';
import { ILanguageModelToolsService, stringifyPromptTsxPart } from '../../../common/languageModelToolsService.js';
import { AcceptToolPostConfirmationActionId, SkipToolPostConfirmationActionId } from '../../actions/chatToolActions.js';
import { IChatWidgetService } from '../../chat.js';
import { ChatToolOutputContentSubPart } from '../chatToolOutputContentSubPart.js';
import { AbstractToolConfirmationSubPart } from './abstractToolConfirmationSubPart.js';
let ChatToolPostExecuteConfirmationPart = class ChatToolPostExecuteConfirmationPart extends AbstractToolConfirmationSubPart {
    get codeblocks() {
        return this._codeblocks;
    }
    constructor(toolInvocation, context, instantiationService, keybindingService, modelService, languageService, contextKeyService, chatWidgetService, languageModelToolsService, confirmationService) {
        super(toolInvocation, context, instantiationService, keybindingService, contextKeyService, chatWidgetService, languageModelToolsService);
        this.modelService = modelService;
        this.languageService = languageService;
        this.confirmationService = confirmationService;
        this._codeblocks = [];
        const subtitle = toolInvocation.pastTenseMessage || toolInvocation.invocationMessage;
        this.render({
            allowActionId: AcceptToolPostConfirmationActionId,
            skipActionId: SkipToolPostConfirmationActionId,
            allowLabel: localize('allow', "Allow"),
            skipLabel: localize('skip.post', 'Skip Results'),
            partType: 'chatToolPostConfirmation',
            subtitle: typeof subtitle === 'string' ? subtitle : subtitle?.value,
        });
    }
    createContentElement() {
        if (this.toolInvocation.kind !== 'toolInvocation') {
            throw new Error('post-approval not supported for serialized data');
        }
        const state = this.toolInvocation.state.get();
        if (state.type !== 2 /* IChatToolInvocation.StateKind.WaitingForPostApproval */) {
            throw new Error('Tool invocation is not waiting for post-approval');
        }
        return this.createResultsDisplay(this.toolInvocation, state.contentForModel);
    }
    getTitle() {
        return localize('approveToolResult', "Approve Tool Result");
    }
    additionalPrimaryActions() {
        const actions = super.additionalPrimaryActions();
        // Get actions from confirmation service
        const confirmActions = this.confirmationService.getPostConfirmActions({
            toolId: this.toolInvocation.toolId,
            source: this.toolInvocation.source,
            parameters: this.toolInvocation.parameters
        });
        for (const action of confirmActions) {
            if (action.divider) {
                actions.push(new Separator());
            }
            actions.push({
                label: action.label,
                tooltip: action.detail,
                data: async () => {
                    const shouldConfirm = await action.select();
                    if (shouldConfirm) {
                        this.confirmWith(this.toolInvocation, { type: 4 /* ToolConfirmKind.UserAction */ });
                    }
                }
            });
        }
        return actions;
    }
    createResultsDisplay(toolInvocation, contentForModel) {
        const container = dom.$('.tool-postconfirm-display');
        if (!contentForModel || contentForModel.length === 0) {
            container.textContent = localize('noResults', 'No results to display');
            return container;
        }
        const parts = [];
        for (const [i, part] of contentForModel.entries()) {
            if (part.kind === 'text') {
                // Display text parts
                const model = this._register(this.modelService.createModel(part.value, this.languageService.createById('plaintext'), undefined, true));
                parts.push({
                    kind: 'code',
                    textModel: model,
                    languageId: model.getLanguageId(),
                    options: {
                        hideToolbar: true,
                        reserveWidth: 19,
                        maxHeightInLines: 13,
                        verticalPadding: 5,
                        editorOptions: { wordWrap: 'on', readOnly: true }
                    },
                    codeBlockInfo: {
                        codeBlockIndex: i,
                        codemapperUri: undefined,
                        elementId: this.context.element.id,
                        focus: () => { },
                        ownerMarkdownPartId: this.codeblocksPartId,
                        uri: model.uri,
                        chatSessionResource: this.context.element.sessionResource,
                        uriPromise: Promise.resolve(model.uri)
                    }
                });
            }
            else if (part.kind === 'promptTsx') {
                // Display TSX parts as JSON-stringified
                const stringified = stringifyPromptTsxPart(part);
                const model = this._register(this.modelService.createModel(stringified, this.languageService.createById('json'), undefined, true));
                parts.push({
                    kind: 'code',
                    textModel: model,
                    languageId: model.getLanguageId(),
                    options: {
                        hideToolbar: true,
                        reserveWidth: 19,
                        maxHeightInLines: 13,
                        verticalPadding: 5,
                        editorOptions: { wordWrap: 'on', readOnly: true }
                    },
                    codeBlockInfo: {
                        codeBlockIndex: i,
                        codemapperUri: undefined,
                        elementId: this.context.element.id,
                        focus: () => { },
                        ownerMarkdownPartId: this.codeblocksPartId,
                        uri: model.uri,
                        chatSessionResource: this.context.element.sessionResource,
                        uriPromise: Promise.resolve(model.uri)
                    }
                });
            }
            else if (part.kind === 'data') {
                // Display data parts
                const mimeType = part.value.mimeType;
                const data = part.value.data;
                // Check if it's an image
                if (mimeType?.startsWith('image/')) {
                    const permalinkBasename = getExtensionForMimeType(mimeType) ? `image${getExtensionForMimeType(mimeType)}` : 'image.bin';
                    const permalinkUri = ChatResponseResource.createUri(this.context.element.sessionId, toolInvocation.toolCallId, i, permalinkBasename);
                    parts.push({ kind: 'data', value: data.buffer, mimeType, uri: permalinkUri, audience: part.audience });
                }
                else {
                    // Try to display as UTF-8 text, otherwise base64
                    const decoder = new TextDecoder('utf-8', { fatal: true });
                    try {
                        const text = decoder.decode(data.buffer);
                        const model = this._register(this.modelService.createModel(text, this.languageService.createById('plaintext'), undefined, true));
                        parts.push({
                            kind: 'code',
                            textModel: model,
                            languageId: model.getLanguageId(),
                            options: {
                                hideToolbar: true,
                                reserveWidth: 19,
                                maxHeightInLines: 13,
                                verticalPadding: 5,
                                editorOptions: { wordWrap: 'on', readOnly: true }
                            },
                            codeBlockInfo: {
                                codeBlockIndex: i,
                                codemapperUri: undefined,
                                elementId: this.context.element.id,
                                focus: () => { },
                                ownerMarkdownPartId: this.codeblocksPartId,
                                uri: model.uri,
                                chatSessionResource: this.context.element.sessionResource,
                                uriPromise: Promise.resolve(model.uri)
                            }
                        });
                    }
                    catch {
                        // Not valid UTF-8, show base64
                        const base64 = data.toString();
                        const model = this._register(this.modelService.createModel(base64, this.languageService.createById('plaintext'), undefined, true));
                        parts.push({
                            kind: 'code',
                            textModel: model,
                            languageId: model.getLanguageId(),
                            options: {
                                hideToolbar: true,
                                reserveWidth: 19,
                                maxHeightInLines: 13,
                                verticalPadding: 5,
                                editorOptions: { wordWrap: 'on', readOnly: true }
                            },
                            codeBlockInfo: {
                                codeBlockIndex: i,
                                codemapperUri: undefined,
                                elementId: this.context.element.id,
                                focus: () => { },
                                ownerMarkdownPartId: this.codeblocksPartId,
                                uri: model.uri,
                                chatSessionResource: this.context.element.sessionResource,
                                uriPromise: Promise.resolve(model.uri)
                            }
                        });
                    }
                }
            }
        }
        if (parts.length > 0) {
            const outputSubPart = this._register(this.instantiationService.createInstance(ChatToolOutputContentSubPart, this.context, parts));
            this._codeblocks.push(...outputSubPart.codeblocks);
            this._register(outputSubPart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
            outputSubPart.domNode.classList.add('tool-postconfirm-display');
            return outputSubPart.domNode;
        }
        container.textContent = localize('noDisplayableResults', 'No displayable results');
        return container;
    }
};
ChatToolPostExecuteConfirmationPart = __decorate([
    __param(2, IInstantiationService),
    __param(3, IKeybindingService),
    __param(4, IModelService),
    __param(5, ILanguageService),
    __param(6, IContextKeyService),
    __param(7, IChatWidgetService),
    __param(8, ILanguageModelToolsService),
    __param(9, ILanguageModelToolsConfirmationService)
], ChatToolPostExecuteConfirmationPart);
export { ChatToolPostExecuteConfirmationPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvb2xQb3N0RXhlY3V0ZUNvbmZpcm1hdGlvblBhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRDb250ZW50UGFydHMvdG9vbEludm9jYXRpb25QYXJ0cy9jaGF0VG9vbFBvc3RFeGVjdXRlQ29uZmlybWF0aW9uUGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLHVDQUF1QyxDQUFDO0FBQzdELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3BELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRXBFLE9BQU8sRUFBRSxzQ0FBc0MsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQ2xILE9BQU8sRUFBRSwwQkFBMEIsRUFBc0Usc0JBQXNCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUN0TCxPQUFPLEVBQUUsa0NBQWtDLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN4SCxPQUFPLEVBQXNCLGtCQUFrQixF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