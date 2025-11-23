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
import { AsyncIterableObject } from '../../../../../base/common/async.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable, markAsSingleton } from '../../../../../base/common/lifecycle.js';
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { EditorContextKeys } from '../../../../../editor/common/editorContextKeys.js';
import { CopyAction } from '../../../../../editor/contrib/clipboard/browser/clipboard.js';
import { localize, localize2 } from '../../../../../nls.js';
import { IActionViewItemService } from '../../../../../platform/actions/browser/actionViewItemService.js';
import { MenuEntryActionViewItem } from '../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { Action2, MenuId, MenuItemAction, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { TerminalLocation } from '../../../../../platform/terminal/common/terminal.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { accessibleViewInCodeBlock } from '../../../accessibility/browser/accessibilityConfiguration.js';
import { IAiEditTelemetryService } from '../../../editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js';
import { EditDeltaInfo } from '../../../../../editor/common/textModelEditSource.js';
import { reviewEdits } from '../../../inlineChat/browser/inlineChatController.js';
import { ITerminalEditorService, ITerminalGroupService, ITerminalService } from '../../../terminal/browser/terminal.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { ChatCopyKind, IChatService } from '../../common/chatService.js';
import { isRequestVM, isResponseVM } from '../../common/chatViewModel.js';
import { ChatAgentLocation } from '../../common/constants.js';
import { IChatCodeBlockContextProviderService, IChatWidgetService } from '../chat.js';
import { DefaultChatTextEditor } from '../codeBlockPart.js';
import { CHAT_CATEGORY } from './chatActions.js';
import { ApplyCodeBlockOperation, InsertCodeBlockOperation } from './codeBlockOperations.js';
const shellLangIds = [
    'fish',
    'ps1',
    'pwsh',
    'powershell',
    'sh',
    'shellscript',
    'zsh'
];
export function isCodeBlockActionContext(thing) {
    return typeof thing === 'object' && thing !== null && 'code' in thing && 'element' in thing;
}
export function isCodeCompareBlockActionContext(thing) {
    return typeof thing === 'object' && thing !== null && 'element' in thing;
}
function isResponseFiltered(context) {
    return isResponseVM(context.element) && context.element.errorDetails?.responseIsFiltered;
}
class ChatCodeBlockAction extends Action2 {
    run(accessor, ...args) {
        let context = args[0];
        if (!isCodeBlockActionContext(context)) {
            const codeEditorService = accessor.get(ICodeEditorService);
            const editor = codeEditorService.getFocusedCodeEditor() || codeEditorService.getActiveCodeEditor();
            if (!editor) {
                return;
            }
            context = getContextFromEditor(editor, accessor);
            if (!isCodeBlockActionContext(context)) {
                return;
            }
        }
        return this.runWithContext(accessor, context);
    }
}
const APPLY_IN_EDITOR_ID = 'workbench.action.chat.applyInEditor';
let CodeBlockActionRendering = class CodeBlockActionRendering extends Disposable {
    static { this.ID = 'chat.codeBlockActionRendering'; }
    constructor(actionViewItemService, instantiationService, labelService) {
        super();
        const disposable = actionViewItemService.register(MenuId.ChatCodeBlock, APPLY_IN_EDITOR_ID, (action, options) => {
            if (!(action instanceof MenuItemAction)) {
                return undefined;
            }
            return instantiationService.createInstance(class extends MenuEntryActionViewItem {
                getTooltip() {
                    const context = this._context;
                    if (isCodeBlockActionContext(context) && context.codemapperUri) {
                        const label = labelService.getUriLabel(context.codemapperUri, { relative: true });
                        return localize('interactive.applyInEditorWithURL.label', "Apply to {0}", label);
                    }
                    return super.getTooltip();
                }
                setActionContext(newContext) {
                    super.setActionContext(newContext);
                    this.updateTooltip();
                }
            }, action, undefined);
        });
        // Reduces flicker a bit on reload/restart
        markAsSingleton(disposable);
    }
};
CodeBlockActionRendering = __decorate([
    __param(0, IActionViewItemService),
    __param(1, IInstantiationService),
    __param(2, ILabelService)
], CodeBlockActionRendering);
export { CodeBlockActionRendering };
export function registerChatCodeBlockActions() {
    registerAction2(class CopyCodeBlockAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.copyCodeBlock',
                title: localize2('interactive.copyCodeBlock.label', "Copy"),
                f1: false,
                category: CHAT_CATEGORY,
                icon: Codicon.copy,
                menu: {
                    id: MenuId.ChatCodeBlock,
                    group: 'navigation',
                    order: 30
                }
            });
        }
        run(accessor, ...args) {
            const context = args[0];
            if (!isCodeBlockActionContext(context) || isResponseFiltered(context)) {
                return;
            }
            const clipboardService = accessor.get(IClipboardService);
            const aiEditTelemetryService = accessor.get(IAiEditTelemetryService);
            clipboardService.writeText(context.code);
            if (isResponseVM(context.element)) {
                const chatService = accessor.get(IChatService);
                const requestId = context.element.requestId;
                const request = context.element.session.getItems().find(item => item.id === requestId && isRequestVM(item));
                chatService.notifyUserAction({
                    agentId: context.element.agent?.id,
                    command: context.element.slashCommand?.name,
                    sessionResource: context.element.sessionResource,
                    requestId: context.element.requestId,
                    result: context.element.result,
                    action: {
                        kind: 'copy',
                        codeBlockIndex: context.codeBlockIndex,
                        copyKind: ChatCopyKind.Toolbar,
                        copiedCharacters: context.code.length,
                        totalCharacters: context.code.length,
                        copiedText: context.code,
                        copiedLines: context.code.split('\n').length,
                        languageId: context.languageId,
                        totalLines: context.code.split('\n').length,
                        modelId: request?.modelId ?? ''
                    }
                });
                const codeBlockInfo = context.element.model.codeBlockInfos?.at(context.codeBlockIndex);
                aiEditTelemetryService.handleCodeAccepted({
                    acceptanceMethod: 'copyButton',
                    suggestionId: codeBlockInfo?.suggestionId,
                    editDeltaInfo: EditDeltaInfo.fromText(context.code),
                    feature: 'sideBarChat',
                    languageId: context.languageId,
                    modeId: context.element.model.request?.modeInfo?.modeId,
                    modelId: request?.modelId,
                    presentation: 'codeBlock',
                    applyCodeBlockSuggestionId: undefined,
                    source: undefined,
                });
            }
        }
    });
    CopyAction?.addImplementation(50000, 'chat-codeblock', (accessor) => {
        // get active code editor
        const editor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
        if (!editor) {
            return false;
        }
        const editorModel = editor.getModel();
        if (!editorModel) {
            return false;
        }
        const context = getContextFromEditor(editor, accessor);
        if (!context) {
            return false;
        }
        const noSelection = editor.getSelections()?.length === 1 && editor.getSelection()?.isEmpty();
        const copiedText = noSelection ?
            editorModel.getValue() :
            editor.getSelections()?.reduce((acc, selection) => acc + editorModel.getValueInRange(selection), '') ?? '';
        const totalCharacters = editorModel.getValueLength();
        // Report copy to extensions
        const chatService = accessor.get(IChatService);
        const aiEditTelemetryService = accessor.get(IAiEditTelemetryService);
        const element = context.element;
        if (isResponseVM(element)) {
            const requestId = element.requestId;
            const request = element.session.getItems().find(item => item.id === requestId && isRequestVM(item));
            chatService.notifyUserAction({
                agentId: element.agent?.id,
                command: element.slashCommand?.name,
                sessionResource: element.sessionResource,
                requestId: element.requestId,
                result: element.result,
                action: {
                    kind: 'copy',
                    codeBlockIndex: context.codeBlockIndex,
                    copyKind: ChatCopyKind.Action,
                    copiedText,
                    copiedCharacters: copiedText.length,
                    totalCharacters,
                    languageId: context.languageId,
                    totalLines: context.code.split('\n').length,
                    copiedLines: copiedText.split('\n').length,
                    modelId: request?.modelId ?? ''
                }
            });
            const codeBlockInfo = element.model.codeBlockInfos?.at(context.codeBlockIndex);
            aiEditTelemetryService.handleCodeAccepted({
                acceptanceMethod: 'copyManual',
                suggestionId: codeBlockInfo?.suggestionId,
                editDeltaInfo: EditDeltaInfo.fromText(copiedText),
                feature: 'sideBarChat',
                languageId: context.languageId,
                modeId: element.model.request?.modeInfo?.modeId,
                modelId: request?.modelId,
                presentation: 'codeBlock',
                applyCodeBlockSuggestionId: undefined,
                source: undefined,
            });
        }
        // Copy full cell if no selection, otherwise fall back on normal editor implementation
        if (noSelection) {
            accessor.get(IClipboardService).writeText(context.code);
            return true;
        }
        return false;
    });
    registerAction2(class SmartApplyInEditorAction extends ChatCodeBlockAction {
        constructor() {
            super({
                id: APPLY_IN_EDITOR_ID,
                title: localize2('interactive.applyInEditor.label', "Apply in Editor"),
                precondition: ChatContextKeys.enabled,
                f1: true,
                category: CHAT_CATEGORY,
                icon: Codicon.gitPullRequestGoToChanges,
                menu: [
                    {
                        id: MenuId.ChatCodeBlock,
                        group: 'navigation',
                        when: ContextKeyExpr.and(...shellLangIds.map(e => ContextKeyExpr.notEquals(EditorContextKeys.languageId.key, e))),
                        order: 10
                    },
                    {
                        id: MenuId.ChatCodeBlock,
                        when: ContextKeyExpr.or(...shellLangIds.map(e => ContextKeyExpr.equals(EditorContextKeys.languageId.key, e)))
                    },
                ],
                keybinding: {
                    when: ContextKeyExpr.or(ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.inChatInput.negate()), accessibleViewInCodeBlock),
                    primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */,
                    mac: { primary: 256 /* KeyMod.WinCtrl */ | 3 /* KeyCode.Enter */ },
                    weight: 400 /* KeybindingWeight.ExternalExtension */ + 1
                },
            });
        }
        runWithContext(accessor, context) {
            if (!this.operation) {
                this.operation = accessor.get(IInstantiationService).createInstance(ApplyCodeBlockOperation);
            }
            return this.operation.run(context);
        }
    });
    registerAction2(class InsertAtCursorAction extends ChatCodeBlockAction {
        constructor() {
            super({
                id: 'workbench.action.chat.insertCodeBlock',
                title: localize2('interactive.insertCodeBlock.label', "Insert At Cursor"),
                precondition: ChatContextKeys.enabled,
                f1: true,
                category: CHAT_CATEGORY,
                icon: Codicon.insert,
                menu: [{
                        id: MenuId.ChatCodeBlock,
                        group: 'navigation',
                        when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.location.notEqualsTo(ChatAgentLocation.Terminal)),
                        order: 20
                    }, {
                        id: MenuId.ChatCodeBlock,
                        group: 'navigation',
                        when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.location.isEqualTo(ChatAgentLocation.Terminal)),
                        isHiddenByDefault: true,
                        order: 20
                    }],
                keybinding: {
                    when: ContextKeyExpr.or(ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.inChatInput.negate()), accessibleViewInCodeBlock),
                    primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */,
                    mac: { primary: 256 /* KeyMod.WinCtrl */ | 3 /* KeyCode.Enter */ },
                    weight: 400 /* KeybindingWeight.ExternalExtension */ + 1
                },
            });
        }
        runWithContext(accessor, context) {
            const operation = accessor.get(IInstantiationService).createInstance(InsertCodeBlockOperation);
            return operation.run(context);
        }
    });
    registerAction2(class InsertIntoNewFileAction extends ChatCodeBlockAction {
        constructor() {
            super({
                id: 'workbench.action.chat.insertIntoNewFile',
                title: localize2('interactive.insertIntoNewFile.label', "Insert into New File"),
                precondition: ChatContextKeys.enabled,
                f1: true,
                category: CHAT_CATEGORY,
                icon: Codicon.newFile,
                menu: {
                    id: MenuId.ChatCodeBlock,
                    group: 'navigation',
                    isHiddenByDefault: true,
                    order: 40,
                }
            });
        }
        async runWithContext(accessor, context) {
            if (isResponseFiltered(context)) {
                // When run from command palette
                return;
            }
            const editorService = accessor.get(IEditorService);
            const chatService = accessor.get(IChatService);
            const aiEditTelemetryService = accessor.get(IAiEditTelemetryService);
            editorService.openEditor({ contents: context.code, languageId: context.languageId, resource: undefined });
            if (isResponseVM(context.element)) {
                const requestId = context.element.requestId;
                const request = context.element.session.getItems().find(item => item.id === requestId && isRequestVM(item));
                chatService.notifyUserAction({
                    agentId: context.element.agent?.id,
                    command: context.element.slashCommand?.name,
                    sessionResource: context.element.sessionResource,
                    requestId: context.element.requestId,
                    result: context.element.result,
                    action: {
                        kind: 'insert',
                        codeBlockIndex: context.codeBlockIndex,
                        totalCharacters: context.code.length,
                        newFile: true,
                        totalLines: context.code.split('\n').length,
                        languageId: context.languageId,
                        modelId: request?.modelId ?? ''
                    }
                });
                const codeBlockInfo = context.element.model.codeBlockInfos?.at(context.codeBlockIndex);
                aiEditTelemetryService.handleCodeAccepted({
                    acceptanceMethod: 'insertInNewFile',
                    suggestionId: codeBlockInfo?.suggestionId,
                    editDeltaInfo: EditDeltaInfo.fromText(context.code),
                    feature: 'sideBarChat',
                    languageId: context.languageId,
                    modeId: context.element.model.request?.modeInfo?.modeId,
                    modelId: request?.modelId,
                    presentation: 'codeBlock',
                    applyCodeBlockSuggestionId: undefined,
                    source: undefined,
                });
            }
        }
    });
    registerAction2(class RunInTerminalAction extends ChatCodeBlockAction {
        constructor() {
            super({
                id: 'workbench.action.chat.runInTerminal',
                title: localize2('interactive.runInTerminal.label', "Insert into Terminal"),
                precondition: ChatContextKeys.enabled,
                f1: true,
                category: CHAT_CATEGORY,
                icon: Codicon.terminal,
                menu: [{
                        id: MenuId.ChatCodeBlock,
                        group: 'navigation',
                        when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ContextKeyExpr.or(...shellLangIds.map(e => ContextKeyExpr.equals(EditorContextKeys.languageId.key, e)))),
                    },
                    {
                        id: MenuId.ChatCodeBlock,
                        group: 'navigation',
                        isHiddenByDefault: true,
                        when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ...shellLangIds.map(e => ContextKeyExpr.notEquals(EditorContextKeys.languageId.key, e)))
                    }],
                keybinding: [{
                        primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 3 /* KeyCode.Enter */,
                        mac: {
                            primary: 256 /* KeyMod.WinCtrl */ | 512 /* KeyMod.Alt */ | 3 /* KeyCode.Enter */
                        },
                        weight: 100 /* KeybindingWeight.EditorContrib */,
                        when: ContextKeyExpr.or(ChatContextKeys.inChatSession, accessibleViewInCodeBlock),
                    }]
            });
        }
        async runWithContext(accessor, context) {
            if (isResponseFiltered(context)) {
                // When run from command palette
                return;
            }
            const chatService = accessor.get(IChatService);
            const terminalService = accessor.get(ITerminalService);
            const editorService = accessor.get(IEditorService);
            const terminalEditorService = accessor.get(ITerminalEditorService);
            const terminalGroupService = accessor.get(ITerminalGroupService);
            let terminal = await terminalService.getActiveOrCreateInstance();
            // isFeatureTerminal = debug terminal or task terminal
            const unusableTerminal = terminal.xterm?.isStdinDisabled || terminal.shellLaunchConfig.isFeatureTerminal;
            terminal = unusableTerminal ? await terminalService.createTerminal() : terminal;
            terminalService.setActiveInstance(terminal);
            await terminal.focusWhenReady(true);
            if (terminal.target === TerminalLocation.Editor) {
                const existingEditors = editorService.findEditors(terminal.resource);
                terminalEditorService.openEditor(terminal, { viewColumn: existingEditors?.[0].groupId });
            }
            else {
                terminalGroupService.showPanel(true);
            }
            terminal.runCommand(context.code, false);
            if (isResponseVM(context.element)) {
                chatService.notifyUserAction({
                    agentId: context.element.agent?.id,
                    command: context.element.slashCommand?.name,
                    sessionResource: context.element.sessionResource,
                    requestId: context.element.requestId,
                    result: context.element.result,
                    action: {
                        kind: 'runInTerminal',
                        codeBlockIndex: context.codeBlockIndex,
                        languageId: context.languageId,
                    }
                });
            }
        }
    });
    function navigateCodeBlocks(accessor, reverse) {
        const codeEditorService = accessor.get(ICodeEditorService);
        const chatWidgetService = accessor.get(IChatWidgetService);
        const widget = chatWidgetService.lastFocusedWidget;
        if (!widget) {
            return;
        }
        const editor = codeEditorService.getFocusedCodeEditor();
        const editorUri = editor?.getModel()?.uri;
        const curCodeBlockInfo = editorUri ? widget.getCodeBlockInfoForEditor(editorUri) : undefined;
        const focused = !widget.inputEditor.hasWidgetFocus() && widget.getFocus();
        const focusedResponse = isResponseVM(focused) ? focused : undefined;
        const elementId = curCodeBlockInfo?.elementId;
        const element = elementId ? widget.viewModel?.getItems().find(item => item.id === elementId) : undefined;
        const currentResponse = element ??
            (focusedResponse ?? widget.viewModel?.getItems().reverse().find((item) => isResponseVM(item)));
        if (!currentResponse || !isResponseVM(currentResponse)) {
            return;
        }
        widget.reveal(currentResponse);
        const responseCodeblocks = widget.getCodeBlockInfosForResponse(currentResponse);
        const focusIdx = curCodeBlockInfo ?
            (curCodeBlockInfo.codeBlockIndex + (reverse ? -1 : 1) + responseCodeblocks.length) % responseCodeblocks.length :
            reverse ? responseCodeblocks.length - 1 : 0;
        responseCodeblocks[focusIdx]?.focus();
    }
    registerAction2(class NextCodeBlockAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.nextCodeBlock',
                title: localize2('interactive.nextCodeBlock.label', "Next Code Block"),
                keybinding: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 12 /* KeyCode.PageDown */,
                    mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 12 /* KeyCode.PageDown */, },
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                    when: ChatContextKeys.inChatSession,
                },
                precondition: ChatContextKeys.enabled,
                f1: true,
                category: CHAT_CATEGORY,
            });
        }
        run(accessor, ...args) {
            navigateCodeBlocks(accessor);
        }
    });
    registerAction2(class PreviousCodeBlockAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.previousCodeBlock',
                title: localize2('interactive.previousCodeBlock.label', "Previous Code Block"),
                keybinding: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 11 /* KeyCode.PageUp */,
                    mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 11 /* KeyCode.PageUp */, },
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                    when: ChatContextKeys.inChatSession,
                },
                precondition: ChatContextKeys.enabled,
                f1: true,
                category: CHAT_CATEGORY,
            });
        }
        run(accessor, ...args) {
            navigateCodeBlocks(accessor, true);
        }
    });
}
function getContextFromEditor(editor, accessor) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const chatCodeBlockContextProviderService = accessor.get(IChatCodeBlockContextProviderService);
    const model = editor.getModel();
    if (!model) {
        return;
    }
    const widget = chatWidgetService.lastFocusedWidget;
    const codeBlockInfo = widget?.getCodeBlockInfoForEditor(model.uri);
    if (!codeBlockInfo) {
        for (const provider of chatCodeBlockContextProviderService.providers) {
            const context = provider.getCodeBlockContext(editor);
            if (context) {
                return context;
            }
        }
        return;
    }
    const element = widget?.viewModel?.getItems().find(item => item.id === codeBlockInfo.elementId);
    return {
        element,
        codeBlockIndex: codeBlockInfo.codeBlockIndex,
        code: editor.getValue(),
        languageId: editor.getModel().getLanguageId(),
        codemapperUri: codeBlockInfo.codemapperUri,
        chatSessionResource: codeBlockInfo.chatSessionResource,
    };
}
export function registerChatCodeCompareBlockActions() {
    class ChatCompareCodeBlockAction extends Action2 {
        run(accessor, ...args) {
            const context = args[0];
            if (!isCodeCompareBlockActionContext(context)) {
                return;
                // TODO@jrieken derive context
            }
            return this.runWithContext(accessor, context);
        }
    }
    registerAction2(class ApplyEditsCompareBlockAction extends ChatCompareCodeBlockAction {
        constructor() {
            super({
                id: 'workbench.action.chat.applyCompareEdits',
                title: localize2('interactive.compare.apply', "Apply Edits"),
                f1: false,
                category: CHAT_CATEGORY,
                icon: Codicon.gitPullRequestGoToChanges,
                precondition: ContextKeyExpr.and(EditorContextKeys.hasChanges, ChatContextKeys.editApplied.negate()),
                menu: {
                    id: MenuId.ChatCompareBlock,
                    group: 'navigation',
                    order: 1,
                }
            });
        }
        async runWithContext(accessor, context) {
            const instaService = accessor.get(IInstantiationService);
            const editorService = accessor.get(ICodeEditorService);
            const item = context.edit;
            const response = context.element;
            if (item.state?.applied) {
                // already applied
                return false;
            }
            if (!response.response.value.includes(item)) {
                // bogous item
                return false;
            }
            const firstEdit = item.edits[0]?.[0];
            if (!firstEdit) {
                return false;
            }
            const textEdits = AsyncIterableObject.fromArray(item.edits);
            const editorToApply = await editorService.openCodeEditor({ resource: item.uri }, null);
            if (editorToApply) {
                editorToApply.revealLineInCenterIfOutsideViewport(firstEdit.range.startLineNumber);
                instaService.invokeFunction(reviewEdits, editorToApply, textEdits, CancellationToken.None, undefined);
                response.setEditApplied(item, 1);
                return true;
            }
            return false;
        }
    });
    registerAction2(class DiscardEditsCompareBlockAction extends ChatCompareCodeBlockAction {
        constructor() {
            super({
                id: 'workbench.action.chat.discardCompareEdits',
                title: localize2('interactive.compare.discard', "Discard Edits"),
                f1: false,
                category: CHAT_CATEGORY,
                icon: Codicon.trash,
                precondition: ContextKeyExpr.and(EditorContextKeys.hasChanges, ChatContextKeys.editApplied.negate()),
                menu: {
                    id: MenuId.ChatCompareBlock,
                    group: 'navigation',
                    order: 2,
                }
            });
        }
        async runWithContext(accessor, context) {
            const instaService = accessor.get(IInstantiationService);
            const editor = instaService.createInstance(DefaultChatTextEditor);
            editor.discard(context.element, context.edit);
        }
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdENvZGVibG9ja0FjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2FjdGlvbnMvY2hhdENvZGVibG9ja0FjdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDMUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDL0UsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRWpFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFHdEYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDakcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDdEYsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUQsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDMUcsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sb0VBQW9FLENBQUM7QUFDN0csT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsY0FBYyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3JILE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN6RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUV0RyxPQUFPLEVB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