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
import { append, h } from '../../../../../../base/browser/dom.js';
import { Separator } from '../../../../../../base/common/actions.js';
import { asArray } from '../../../../../../base/common/arrays.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { ErrorNoTelemetry } from '../../../../../../base/common/errors.js';
import { createCommandUri, MarkdownString } from '../../../../../../base/common/htmlContent.js';
import { thenIfNotDisposed, thenRegisterOrDispose, toDisposable } from '../../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../../base/common/network.js';
import Severity from '../../../../../../base/common/severity.js';
import { isObject } from '../../../../../../base/common/types.js';
import { URI } from '../../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../../base/common/uuid.js';
import { ILanguageService } from '../../../../../../editor/common/languages/language.js';
import { IModelService } from '../../../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../../../nls.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../../../platform/dialogs/common/dialogs.js';
import { IHoverService } from '../../../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../../platform/keybinding/common/keybinding.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { IPreferencesService } from '../../../../../services/preferences/common/preferences.js';
import { ITerminalChatService } from '../../../../terminal/browser/terminal.js';
import { migrateLegacyTerminalToolSpecificData } from '../../../common/chat.js';
import { ChatContextKeys } from '../../../common/chatContextKeys.js';
import { IChatToolInvocation } from '../../../common/chatService.js';
import { AcceptToolConfirmationActionId, SkipToolConfirmationActionId } from '../../actions/chatToolActions.js';
import { IChatWidgetService } from '../../chat.js';
import { ChatCustomConfirmationWidget } from '../chatConfirmationWidget.js';
import { ChatMarkdownContentPart } from '../chatMarkdownContentPart.js';
import { BaseChatToolInvocationSubPart } from './chatToolInvocationSubPart.js';
export var TerminalToolConfirmationStorageKeys;
(function (TerminalToolConfirmationStorageKeys) {
    TerminalToolConfirmationStorageKeys["TerminalAutoApproveWarningAccepted"] = "chat.tools.terminal.autoApprove.warningAccepted";
})(TerminalToolConfirmationStorageKeys || (TerminalToolConfirmationStorageKeys = {}));
let ChatTerminalToolConfirmationSubPart = class ChatTerminalToolConfirmationSubPart extends BaseChatToolInvocationSubPart {
    constructor(toolInvocation, terminalData, context, renderer, editorPool, currentWidthDelegate, codeBlockModelCollection, codeBlockStartIndex, instantiationService, dialogService, keybindingService, modelService, languageService, configurationService, contextKeyService, chatWidgetService, preferencesService, storageService, terminalChatService, textModelService, hoverService) {
        super(toolInvocation);
        this.context = context;
        this.renderer = renderer;
        this.editorPool = editorPool;
        this.currentWidthDelegate = currentWidthDelegate;
        this.codeBlockModelCollection = codeBlockModelCollection;
        this.codeBlockStartIndex = codeBlockStartIndex;
        this.instantiationService = instantiationService;
        this.dialogService = dialogService;
        this.keybindingService = keybindingService;
        this.modelService = modelService;
        this.languageService = languageService;
        this.configurationService = configurationService;
        this.contextKeyService = contextKeyService;
        this.chatWidgetService = chatWidgetService;
        this.preferencesService = preferencesService;
        this.storageService = storageService;
        this.terminalChatService = terminalChatService;
        this.codeblocks = [];
        // Tag for sub-agent styling
        if (toolInvocation.fromSubAgent) {
            context.container.classList.add('from-sub-agent');
        }
        if (!toolInvocation.confirmationMessages?.title) {
            throw new Error('Confirmation messages are missing');
        }
        terminalData = migrateLegacyTerminalToolSpecificData(terminalData);
        const { title, message, disclaimer, terminalCustomActions } = toolInvocation.confirmationMessages;
        const autoApproveEnabled = this.configurationService.getValue("chat.tools.terminal.enableAutoApprove" /* TerminalContribSettingId.EnableAutoApprove */) === true;
        const autoApproveWarningAccepted = this.storageService.getBoolean("chat.tools.terminal.autoApprove.warningAccepted" /* TerminalToolConfirmationStorageKeys.TerminalAutoApproveWarningAccepted */, -1 /* StorageScope.APPLICATION */, false);
        let moreActions = undefined;
        if (autoApproveEnabled) {
            moreActions = [];
            if (!autoApproveWarningAccepted) {
                moreActions.push({
                    label: localize('autoApprove.enable', 'Enable Auto Approve...'),
                    data: {
                        type: 'enable'
                    }
                });
                moreActions.push(new Separator());
                if (terminalCustomActions) {
                    for (const action of terminalCustomActions) {
                        if (!(action instanceof Separator)) {
                            action.disabled = true;
                        }
                    }
                }
            }
            if (terminalCustomActions) {
                moreActions.push(...terminalCustomActions);
            }
            if (moreActions.length === 0) {
                moreActions = undefined;
            }
        }
        const codeBlockRenderOptions = {
            hideToolbar: true,
            reserveWidth: 19,
            verticalPadding: 5,
            editorOptions: {
                wordWrap: 'on',
                readOnly: false,
                tabFocusMode: true,
                ariaLabel: typeof title === 'string' ? title : title.value
            }
        };
        const languageId = this.languageService.getLanguageIdByLanguageName(terminalData.language ?? 'sh') ?? 'shellscript';
        const model = this._register(this.modelService.createModel(terminalData.commandLine.toolEdited ?? terminalData.commandLine.original, this.languageService.createById(languageId), this._getUniqueCodeBlockUri(), true));
        thenRegisterOrDispose(textModelService.createModelReference(model.uri), this._store);
        const editor = this._register(this.editorPool.get());
        const renderPromise = editor.object.render({
            codeBlockIndex: this.codeBlockStartIndex,
            codeBlockPartIndex: 0,
            element: this.context.element,
            languageId,
            renderOptions: codeBlockRenderOptions,
            textModel: Promise.resolve(model),
            chatSessionResource: this.context.element.sessionResource
        }, this.currentWidthDelegate());
        this._register(thenIfNotDisposed(renderPromise, () => this._onDidChangeHeight.fire()));
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
            terminalData.commandLine.userEdited = model.getValue();
        }));
        const elements = h('.chat-confirmation-message-terminal', [
            h('.chat-confirmation-message-terminal-editor@editor'),
            h('.chat-confirmation-message-terminal-disclaimer@disclaimer'),
        ]);
        append(elements.editor, editor.object.element);
        this._register(hoverService.setupDelayedHover(elements.editor, {
            content: message || '',
            style: 1 /* HoverStyle.Pointer */,
            position: { hoverPosition: 0 /* HoverPosition.LEFT */ },
        }));
        const confirmWidget = this._register(this.instantiationService.createInstance((ChatCustomConfirmationWidget), this.context, {
            title,
            icon: Codicon.terminal,
            message: elements.root,
            buttons: this._createButtons(moreActions)
        }));
        if (disclaimer) {
            this._appendMarkdownPart(elements.disclaimer, disclaimer, codeBlockRenderOptions);
        }
        const hasToolConfirmationKey = ChatContextKeys.Editing.hasToolConfirmation.bindTo(this.contextKeyService);
        hasToolConfirmationKey.set(true);
        this._register(toDisposable(() => hasToolConfirmationKey.reset()));
        this._register(confirmWidget.onDidClick(async (button) => {
            let doComplete = true;
            const data = button.data;
            let toolConfirmKind = 0 /* ToolConfirmKind.Denied */;
            if (typeof data === 'boolean') {
                if (data) {
                    toolConfirmKind = 4 /* ToolConfirmKind.UserAction */;
                    // Clear out any auto approve info since this was an explicit user action. This
                    // can happen when the auto approve feature is off.
                    if (terminalData.autoApproveInfo) {
                        terminalData.autoApproveInfo = undefined;
                    }
                }
            }
            else if (typeof data !== 'boolean') {
                switch (data.type) {
                    case 'enable': {
                        const optedIn = await this._showAutoApproveWarning();
                        if (optedIn) {
                            this.storageService.store("chat.tools.terminal.autoApprove.warningAccepted" /* TerminalToolConfirmationStorageKeys.TerminalAutoApproveWarningAccepted */, true, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
                            // This is good to auto approve immediately
                            if (!terminalCustomActions) {
                                toolConfirmKind = 4 /* ToolConfirmKind.UserAction */;
                            }
                            // If this would not have been auto approved, enable the options and
                            // do not complete
                            else {
                                for (const action of terminalCustomActions) {
                                    if (!(action instanceof Separator)) {
                                        action.disabled = false;
                                    }
                                }
                                confirmWidget.updateButtons(this._createButtons(terminalCustomActions));
                                doComplete = false;
                            }
                        }
                        else {
                            doComplete = false;
                        }
                        break;
                    }
                    case 'skip': {
                        toolConfirmKind = 5 /* ToolConfirmKind.Skipped */;
                        break;
                    }
                    case 'newRule': {
                        const newRules = asArray(data.rule);
                        const inspect = this.configurationService.inspect("chat.tools.terminal.autoApprove" /* TerminalContribSettingId.AutoApprove */);
                        const oldValue = inspect.user?.value ?? {};
                        let newValue;
                        if (isObject(oldValue)) {
                            newValue = { ...oldValue };
                            for (const newRule of newRules) {
                                newValue[newRule.key] = newRule.value;
                            }
                        }
                        else {
                            this.preferencesService.openSettings({
                                jsonEditor: true,
                                target: 2 /* ConfigurationTarget.USER */,
                                revealSetting: {
                                    key: "chat.tools.terminal.autoApprove" /* TerminalContribSettingId.AutoApprove */
                                },
                            });
                            throw new ErrorNoTelemetry(`Cannot add new rule, existing setting is unexpected format`);
                        }
                        await this.configurationService.updateValue("chat.tools.terminal.autoApprove" /* TerminalContribSettingId.AutoApprove */, newValue, 2 /* ConfigurationTarget.USER */);
                        function formatRuleLinks(newRules) {
                            return newRules.map(e => {
                                const settingsUri = createCommandUri("workbench.action.terminal.chat.openTerminalSettingsLink" /* TerminalContribCommandId.OpenTerminalSettingsLink */, 2 /* ConfigurationTarget.USER */);
                                return `[\`${e.key}\`](${settingsUri.toString()} "${localize('ruleTooltip', 'View rule in settings')}")`;
                            }).join(', ');
                        }
                        const mdTrustSettings = {
                            isTrusted: {
                                enabledCommands: ["workbench.action.terminal.chat.openTerminalSettingsLink" /* TerminalContribCommandId.OpenTerminalSettingsLink */]
                            }
                        };
                        if (newRules.length === 1) {
                            terminalData.autoApproveInfo = new MarkdownString(localize('newRule', 'Auto approve rule {0} added', formatRuleLinks(newRules)), mdTrustSettings);
                        }
                        else if (newRules.length > 1) {
                            terminalData.autoApproveInfo = new MarkdownString(localize('newRule.plural', 'Auto approve rules {0} added', formatRuleLinks(newRules)), mdTrustSettings);
                        }
                        toolConfirmKind = 4 /* ToolConfirmKind.UserAction */;
                        break;
                    }
                    case 'configure': {
                        this.preferencesService.openSettings({
                            target: 2 /* ConfigurationTarget.USER */,
                            query: `@id:${"chat.tools.terminal.autoApprove" /* TerminalContribSettingId.AutoApprove */}`,
                        });
                        doComplete = false;
                        break;
                    }
                    case 'sessionApproval': {
                        const sessionId = this.context.element.sessionId;
                        this.terminalChatService.setChatSessionAutoApproval(sessionId, true);
                        const disableUri = createCommandUri("workbench.action.terminal.chat.disableSessionAutoApproval" /* TerminalContribCommandId.DisableSessionAutoApproval */, sessionId);
                        const mdTrustSettings = {
                            isTrusted: {
                                enabledCommands: ["workbench.action.terminal.chat.disableSessionAutoApproval" /* TerminalContribCommandId.DisableSessionAutoApproval */]
                            }
                        };
                        terminalData.autoApproveInfo = new MarkdownString(`${localize('sessionApproval', 'All commands will be auto approved for this session')} ([${localize('sessionApproval.disable', 'Disable')}](${disableUri.toString()}))`, mdTrustSettings);
                        toolConfirmKind = 4 /* ToolConfirmKind.UserAction */;
                        break;
                    }
                }
            }
            if (doComplete) {
                IChatToolInvocation.confirmWith(toolInvocation, { type: toolConfirmKind });
                this.chatWidgetService.getWidgetBySessionResource(this.context.element.sessionResource)?.focusInput();
            }
        }));
        this._register(confirmWidget.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
        this.domNode = confirmWidget.domNode;
    }
    _createButtons(moreActions) {
        const getLabelAndTooltip = (label, actionId, tooltipDetail = label) => {
            const keybinding = this.keybindingService.lookupKeybinding(actionId)?.getLabel();
            const tooltip = keybinding ? `${tooltipDetail} (${keybinding})` : (tooltipDetail);
            return { label, tooltip };
        };
        return [
            {
                ...getLabelAndTooltip(localize('tool.allow', "Allow"), AcceptToolConfirmationActionId),
                data: true,
                moreActions,
            },
            {
                ...getLabelAndTooltip(localize('tool.skip', "Skip"), SkipToolConfirmationActionId, localize('skip.detail', 'Proceed without executing this command')),
                data: { type: 'skip' },
                isSecondary: true,
            },
        ];
    }
    async _showAutoApproveWarning() {
        const promptResult = await this.dialogService.prompt({
            type: Severity.Info,
            message: localize('autoApprove.title', 'Enable terminal auto approve?'),
            buttons: [{
                    label: localize('autoApprove.button.enable', 'Enable'),
                    run: () => true
                }],
            cancelButton: true,
            custom: {
                icon: Codicon.shield,
                markdownDetails: [{
                        markdown: new MarkdownString(localize('autoApprove.markdown', 'This will enable a configurable subset of commands to run in the terminal autonomously. It provides *best effort protections* and assumes the agent is not acting maliciously.')),
                    }, {
                        markdown: new MarkdownString(`[${localize('autoApprove.markdown2', 'Learn more about the potential risks and how to avoid them.')}](https://code.visualstudio.com/docs/copilot/security#_security-considerations)`)
                    }],
            }
        });
        return promptResult.result === true;
    }
    _getUniqueCodeBlockUri() {
        return URI.from({
            scheme: Schemas.vscodeChatCodeBlock,
            path: generateUuid(),
        });
    }
    _appendMarkdownPart(container, message, codeBlockRenderOptions) {
        const part = this._register(this.instantiationService.createInstance(ChatMarkdownContentPart, {
            kind: 'markdownContent',
            content: typeof message === 'string' ? new MarkdownString().appendMarkdown(message) : message
        }, this.context, this.editorPool, false, this.codeBlockStartIndex, this.renderer, undefined, this.currentWidthDelegate(), this.codeBlockModelCollection, { codeBlockRenderOptions }));
        append(container, part.domNode);
        this._register(part.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
    }
};
ChatTerminalToolConfirmationSubPart = __decorate([
    __param(8, IInstantiationService),
    __param(9, IDialogService),
    __param(10, IKeybindingService),
    __param(11, IModelService),
    __param(12, ILanguageService),
    __param(13, IConfigurationService),
    __param(14, IContextKeyService),
    __param(15, IChatWidgetService),
    __param(16, IPreferencesService),
    __param(17, IStorageService),
    __param(18, ITerminalChatService),
    __param(19, ITextModelService),
    __param(20, IHoverService)
], ChatTerminalToolConfirmationSubPart);
export { ChatTerminalToolConfirmationSubPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRlcm1pbmFsVG9vbENvbmZpcm1hdGlvblN1YlBhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRDb250ZW50UGFydHMvdG9vbEludm9jYXRpb25QYXJ0cy9jaGF0VGVybWluYWxUb29sQ29uZmlybWF0aW9uU3ViUGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBR2xFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDbEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxjQUFjLEVBQXdCLE1BQU0sOENBQThDLENBQUM7QUFDdEgsT0FBTyxFQUFFLGlCQUFpQixFQUFFLHFCQUFxQixFQUFFLFlBQVksRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3BILE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRSxPQUFPLFFBQVEsTUFBTSwyQ0FBMkMsQ0FBQztBQUNqRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsYUFBYSxF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