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
import { RunOnceScheduler } from '../../../../../../base/common/async.js';
import { MarkdownString } from '../../../../../../base/common/htmlContent.js';
import { toDisposable } from '../../../../../../base/common/lifecycle.js';
import { count } from '../../../../../../base/common/strings.js';
import { isEmptyObject } from '../../../../../../base/common/types.js';
import { generateUuid } from '../../../../../../base/common/uuid.js';
import { ElementSizeObserver } from '../../../../../../editor/browser/config/elementSizeObserver.js';
import { ILanguageService } from '../../../../../../editor/common/languages/language.js';
import { IModelService } from '../../../../../../editor/common/services/model.js';
import { localize } from '../../../../../../nls.js';
import { ICommandService } from '../../../../../../platform/commands/common/commands.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../../platform/keybinding/common/keybinding.js';
import { IMarkerService, MarkerSeverity } from '../../../../../../platform/markers/common/markers.js';
import { createToolInputUri, createToolSchemaUri, ILanguageModelToolsService } from '../../../common/languageModelToolsService.js';
import { ILanguageModelToolsConfirmationService } from '../../../common/languageModelToolsConfirmationService.js';
import { AcceptToolConfirmationActionId, SkipToolConfirmationActionId } from '../../actions/chatToolActions.js';
import { IChatWidgetService } from '../../chat.js';
import { renderFileWidgets } from '../../chatInlineAnchorWidget.js';
import { IChatMarkdownAnchorService } from '../chatMarkdownAnchorService.js';
import { ChatMarkdownContentPart } from '../chatMarkdownContentPart.js';
import { AbstractToolConfirmationSubPart } from './abstractToolConfirmationSubPart.js';
const SHOW_MORE_MESSAGE_HEIGHT_TRIGGER = 45;
let ToolConfirmationSubPart = class ToolConfirmationSubPart extends AbstractToolConfirmationSubPart {
    get codeblocks() {
        return this.markdownParts.flatMap(part => part.codeblocks);
    }
    constructor(toolInvocation, context, renderer, editorPool, currentWidthDelegate, codeBlockModelCollection, codeBlockStartIndex, instantiationService, keybindingService, modelService, languageService, contextKeyService, chatWidgetService, commandService, markerService, languageModelToolsService, chatMarkdownAnchorService, confirmationService) {
        if (!toolInvocation.confirmationMessages?.title) {
            throw new Error('Confirmation messages are missing');
        }
        super(toolInvocation, context, instantiationService, keybindingService, contextKeyService, chatWidgetService, languageModelToolsService);
        this.renderer = renderer;
        this.editorPool = editorPool;
        this.currentWidthDelegate = currentWidthDelegate;
        this.codeBlockModelCollection = codeBlockModelCollection;
        this.codeBlockStartIndex = codeBlockStartIndex;
        this.modelService = modelService;
        this.languageService = languageService;
        this.commandService = commandService;
        this.markerService = markerService;
        this.chatMarkdownAnchorService = chatMarkdownAnchorService;
        this.confirmationService = confirmationService;
        this.markdownParts = [];
        this.render({
            allowActionId: AcceptToolConfirmationActionId,
            skipActionId: SkipToolConfirmationActionId,
            allowLabel: toolInvocation.confirmationMessages.confirmResults ? localize('allowReview', "Allow and Review") : localize('allow', "Allow"),
            skipLabel: localize('skip.detail', 'Proceed without running this tool'),
            partType: 'chatToolConfirmation',
            subtitle: typeof toolInvocation.originMessage === 'string' ? toolInvocation.originMessage : toolInvocation.originMessage?.value,
        });
        // Tag for sub-agent styling
        if (toolInvocation.fromSubAgent) {
            context.container.classList.add('from-sub-agent');
        }
    }
    additionalPrimaryActions() {
        const actions = super.additionalPrimaryActions();
        if (this.toolInvocation.confirmationMessages?.allowAutoConfirm !== false) {
            // Get actions from confirmation service
            const confirmActions = this.confirmationService.getPreConfirmActions({
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
        }
        if (this.toolInvocation.confirmationMessages?.confirmResults) {
            actions.unshift({
                label: localize('allowSkip', 'Allow and Skip Reviewing Result'),
                data: () => {
                    this.toolInvocation.confirmationMessages.confirmResults = undefined;
                    this.confirmWith(this.toolInvocation, { type: 4 /* ToolConfirmKind.UserAction */ });
                }
            }, new Separator());
        }
        return actions;
    }
    createContentElement() {
        const { message, disclaimer } = this.toolInvocation.confirmationMessages;
        const toolInvocation = this.toolInvocation;
        if (typeof message === 'string' && !disclaimer) {
            return message;
        }
        else {
            const codeBlockRenderOptions = {
                hideToolbar: true,
                reserveWidth: 19,
                verticalPadding: 5,
                editorOptions: {
                    tabFocusMode: true,
                    ariaLabel: this.getTitle(),
                },
            };
            const elements = dom.h('div', [
                dom.h('.message@messageContainer', [
                    dom.h('.message-wrapper@message'),
                    dom.h('.see-more@showMore', [
                        dom.h('a', [localize('showMore', "Show More")])
                    ]),
                ]),
                dom.h('.editor@editor'),
                dom.h('.disclaimer@disclaimer'),
            ]);
            if (toolInvocation.toolSpecificData?.kind === 'input' && toolInvocation.toolSpecificData.rawInput && !isEmptyObject(toolInvocation.toolSpecificData.rawInput)) {
                const titleEl = document.createElement('h3');
                titleEl.textContent = localize('chat.input', "Input");
                elements.editor.appendChild(titleEl);
                const inputData = toolInvocation.toolSpecificData;
                const codeBlockRenderOptions = {
                    hideToolbar: true,
                    reserveWidth: 19,
                    maxHeightInLines: 13,
                    verticalPadding: 5,
                    editorOptions: {
                        wordWrap: 'off',
                        readOnly: false,
                        ariaLabel: this.getTitle(),
                    }
                };
                const langId = this.languageService.getLanguageIdByLanguageName('json');
                const rawJsonInput = JSON.stringify(inputData.rawInput ?? {}, null, 1);
                const canSeeMore = count(rawJsonInput, '\n') > 2; // if more than one key:value
                const model = this._register(this.modelService.createModel(
                // View a single JSON line by default until they 'see more'
                rawJsonInput.replace(/\n */g, ' '), this.languageService.createById(langId), createToolInputUri(toolInvocation.toolCallId), true));
                const markerOwner = generateUuid();
                const schemaUri = createToolSchemaUri(toolInvocation.toolId);
                const validator = new RunOnceScheduler(async () => {
                    const newMarker = [];
                    const result = await this.commandService.executeCommand('json.validate', schemaUri, model.getValue());
                    for (const item of result ?? []) {
                        if (item.range && item.message) {
                            newMarker.push({
                                severity: item.severity === 'Error' ? MarkerSeverity.Error : MarkerSeverity.Warning,
                                message: item.message,
                                startLineNumber: item.range[0].line + 1,
                                startColumn: item.range[0].character + 1,
                                endLineNumber: item.range[1].line + 1,
                                endColumn: item.range[1].character + 1,
                                code: item.code ? String(item.code) : undefined
                            });
                        }
                    }
                    this.markerService.changeOne(markerOwner, model.uri, newMarker);
                }, 500);
                validator.schedule();
                this._register(model.onDidChangeContent(() => validator.schedule()));
                this._register(toDisposable(() => this.markerService.remove(markerOwner, [model.uri])));
                this._register(validator);
                const editor = this._register(this.editorPool.get());
                editor.object.render({
                    codeBlockIndex: this.codeBlockStartIndex,
                    codeBlockPartIndex: 0,
                    element: this.context.element,
                    languageId: langId ?? 'json',
                    renderOptions: codeBlockRenderOptions,
                    textModel: Promise.resolve(model),
                    chatSessionResource: this.context.element.sessionResource
                }, this.currentWidthDelegate());
                this.codeblocks.push({
                    codeBlockIndex: this.codeBlockStartIndex,
                    codemapperUri: undefined,
                    elementId: this.context.element.id,
                    focus: () => editor.object.focus(),
                    ownerMarkdownPartId: this.codeblocksPartId,
                    uri: model.uri,
                    uriPromise: Promise.resolve(model.uri),
                    chatSessionResource: this.context.element.sessionResource
                });
                this._register(editor.object.onDidChangeContentHeight(() => {
                    editor.object.layout(this.currentWidthDelegate());
                    this._onDidChangeHeight.fire();
                }));
                this._register(model.onDidChangeContent(e => {
                    try {
                        inputData.rawInput = JSON.parse(model.getValue());
                    }
                    catch {
                        // ignore
                    }
                }));
                elements.editor.append(editor.object.element);
                if (canSeeMore) {
                    const seeMore = dom.h('div.see-more', [dom.h('a@link')]);
                    seeMore.link.textContent = localize('seeMore', "See more");
                    this._register(dom.addDisposableGenericMouseDownListener(seeMore.link, () => {
                        try {
                            const parsed = JSON.parse(model.getValue());
                            model.setValue(JSON.stringify(parsed, null, 2));
                            editor.object.editor.updateOptions({ tabFocusMode: false });
                            editor.object.editor.updateOptions({ wordWrap: 'on' });
                        }
                        catch {
                            // ignored
                        }
                        seeMore.root.remove();
                    }));
                    elements.editor.append(seeMore.root);
                }
            }
            const mdPart = this._makeMarkdownPart(elements.message, message, codeBlockRenderOptions);
            const messageSeeMoreObserver = this._register(new ElementSizeObserver(mdPart.domNode, undefined));
            const updateSeeMoreDisplayed = () => {
                const show = messageSeeMoreObserver.getHeight() > SHOW_MORE_MESSAGE_HEIGHT_TRIGGER;
                if (elements.messageContainer.classList.contains('can-see-more') !== show) {
                    elements.messageContainer.classList.toggle('can-see-more', show);
                    this._onDidChangeHeight.fire();
                }
            };
            this._register(dom.addDisposableListener(elements.showMore, 'click', () => {
                elements.messageContainer.classList.toggle('can-see-more', false);
                this._onDidChangeHeight.fire();
                messageSeeMoreObserver.dispose();
            }));
            this._register(messageSeeMoreObserver.onDidChange(updateSeeMoreDisplayed));
            messageSeeMoreObserver.startObserving();
            if (disclaimer) {
                this._makeMarkdownPart(elements.disclaimer, disclaimer, codeBlockRenderOptions);
            }
            else {
                elements.disclaimer.remove();
            }
            return elements.root;
        }
    }
    getTitle() {
        const { title } = this.toolInvocation.confirmationMessages;
        return typeof title === 'string' ? title : title.value;
    }
    _makeMarkdownPart(container, message, codeBlockRenderOptions) {
        const part = this._register(this.instantiationService.createInstance(ChatMarkdownContentPart, {
            kind: 'markdownContent',
            content: typeof message === 'string' ? new MarkdownString().appendMarkdown(message) : message
        }, this.context, this.editorPool, false, this.codeBlockStartIndex, this.renderer, undefined, this.currentWidthDelegate(), this.codeBlockModelCollection, { codeBlockRenderOptions }));
        renderFileWidgets(part.domNode, this.instantiationService, this.chatMarkdownAnchorService, this._store);
        container.append(part.domNode);
        this._register(part.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
        return part;
    }
};
ToolConfirmationSubPart = __decorate([
    __param(7, IInstantiationService),
    __param(8, IKeybindingService),
    __param(9, IModelService),
    __param(10, ILanguageService),
    __param(11, IContextKeyService),
    __param(12, IChatWidgetService),
    __param(13, ICommandService),
    __param(14, IMarkerService),
    __param(15, ILanguageModelToolsService),
    __param(16, IChatMarkdownAnchorService),
    __param(17, ILanguageModelToolsConfirmationService)
], ToolConfirmationSubPart);
export { ToolConfirmationSubPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvb2xDb25maXJtYXRpb25TdWJQYXJ0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGVudFBhcnRzL3Rvb2xJbnZvY2F0aW9uUGFydHMvY2hhdFRvb2xDb25maXJtYXRpb25TdWJQYXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sdUNBQXVDLENBQUM7QUFDN0QsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQzFFLE9BQU8sRUFBbUIsY0FBYyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDL0YsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNqRSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDdkUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNsRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDcEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFN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