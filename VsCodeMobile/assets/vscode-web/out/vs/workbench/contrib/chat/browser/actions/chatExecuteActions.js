/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../base/common/codicons.js';
import { basename } from '../../../../../base/common/resources.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { assertType } from '../../../../../base/common/types.js';
import { EditorContextKeys } from '../../../../../editor/common/editorContextKeys.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { IChatModeService } from '../../common/chatModes.js';
import { chatVariableLeader } from '../../common/chatParserTypes.js';
import { IChatService } from '../../common/chatService.js';
import { ChatAgentLocation, ChatConfiguration, ChatModeKind, } from '../../common/constants.js';
import { ILanguageModelToolsService } from '../../common/languageModelToolsService.js';
import { IChatWidgetService } from '../chat.js';
import { getEditingSessionContext } from '../chatEditing/chatEditingActions.js';
import { ctxHasEditorModification } from '../chatEditing/chatEditingEditorContextKeys.js';
import { ACTION_ID_NEW_CHAT, CHAT_CATEGORY, handleCurrentEditingSession, handleModeSwitch } from './chatActions.js';
import { ContinueChatInSessionAction } from './chatContinueInAction.js';
class SubmitAction extends Action2 {
    async run(accessor, ...args) {
        const context = args[0];
        const telemetryService = accessor.get(ITelemetryService);
        const widgetService = accessor.get(IChatWidgetService);
        const widget = context?.widget ?? widgetService.lastFocusedWidget;
        if (widget?.viewModel?.editing) {
            const configurationService = accessor.get(IConfigurationService);
            const dialogService = accessor.get(IDialogService);
            const chatService = accessor.get(IChatService);
            const chatModel = chatService.getSession(widget.viewModel.sessionResource);
            if (!chatModel) {
                return;
            }
            const session = chatModel.editingSession;
            if (!session) {
                return;
            }
            const requestId = widget.viewModel?.editing.id;
            if (requestId) {
                const chatRequests = chatModel.getRequests();
                const itemIndex = chatRequests.findIndex(request => request.id === requestId);
                const editsToUndo = chatRequests.length - itemIndex;
                const requestsToRemove = chatRequests.slice(itemIndex);
                const requestIdsToRemove = new Set(requestsToRemove.map(request => request.id));
                const entriesModifiedInRequestsToRemove = session.entries.get().filter((entry) => requestIdsToRemove.has(entry.lastModifyingRequestId)) ?? [];
                const shouldPrompt = entriesModifiedInRequestsToRemove.length > 0 && configurationService.getValue('chat.editing.confirmEditRequestRemoval') === true;
                let message;
                if (editsToUndo === 1) {
                    if (entriesModifiedInRequestsToRemove.length === 1) {
                        message = localize('chat.removeLast.confirmation.message2', "This will remove your last request and undo the edits made to {0}. Do you want to proceed?", basename(entriesModifiedInRequestsToRemove[0].modifiedURI));
                    }
                    else {
                        message = localize('chat.removeLast.confirmation.multipleEdits.message', "This will remove your last request and undo edits made to {0} files in your working set. Do you want to proceed?", entriesModifiedInRequestsToRemove.length);
                    }
                }
                else {
                    if (entriesModifiedInRequestsToRemove.length === 1) {
                        message = localize('chat.remove.confirmation.message2', "This will remove all subsequent requests and undo edits made to {0}. Do you want to proceed?", basename(entriesModifiedInRequestsToRemove[0].modifiedURI));
                    }
                    else {
                        message = localize('chat.remove.confirmation.multipleEdits.message', "This will remove all subsequent requests and undo edits made to {0} files in your working set. Do you want to proceed?", entriesModifiedInRequestsToRemove.length);
                    }
                }
                const confirmation = shouldPrompt
                    ? await dialogService.confirm({
                        title: editsToUndo === 1
                            ? localize('chat.removeLast.confirmation.title', "Do you want to undo your last edit?")
                            : localize('chat.remove.confirmation.title', "Do you want to undo {0} edits?", editsToUndo),
                        message: message,
                        primaryButton: localize('chat.remove.confirmation.primaryButton', "Yes"),
                        checkbox: { label: localize('chat.remove.confirmation.checkbox', "Don't ask again"), checked: false },
                        type: 'info'
                    })
                    : { confirmed: true };
                if (!confirmation.confirmed) {
                    telemetryService.publicLog2('chat.undoEditsConfirmation', {
                        editRequestType: configurationService.getValue('chat.editRequests'),
                        outcome: 'cancelled',
                        editsUndoCount: editsToUndo
                    });
                    return;
                }
                else if (editsToUndo > 0) {
                    telemetryService.publicLog2('chat.undoEditsConfirmation', {
                        editRequestType: configurationService.getValue('chat.editRequests'),
                        outcome: 'applied',
                        editsUndoCount: editsToUndo
                    });
                }
                if (confirmation.checkboxChecked) {
                    await configurationService.updateValue('chat.editing.confirmEditRequestRemoval', false);
                }
                // Restore the snapshot to what it was before the request(s) that we deleted
                const snapshotRequestId = chatRequests[itemIndex].id;
                await session.restoreSnapshot(snapshotRequestId, undefined);
            }
        }
        else if (widget?.viewModel?.model.checkpoint) {
            widget.viewModel.model.setCheckpoint(undefined);
        }
        widget?.acceptInput(context?.inputValue);
    }
}
const whenNotInProgress = ChatContextKeys.requestInProgress.negate();
export class ChatSubmitAction extends SubmitAction {
    static { this.ID = 'workbench.action.chat.submit'; }
    constructor() {
        const menuCondition = ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Ask);
        const precondition = ContextKeyExpr.and(ChatContextKeys.inputHasText, whenNotInProgress);
        super({
            id: ChatSubmitAction.ID,
            title: localize2('interactive.submit.label', "Send"),
            f1: false,
            category: CHAT_CATEGORY,
            icon: Codicon.send,
            precondition,
            toggled: {
                condition: ChatContextKeys.lockedToCodingAgent,
                icon: Codicon.send,
                tooltip: localize('sendToAgent', "Send to Agent"),
            },
            keybinding: {
                when: ContextKeyExpr.and(ChatContextKeys.inChatInput, ChatContextKeys.withinEditSessionDiff.negate()),
                primary: 3 /* KeyCode.Enter */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            },
            menu: [
                {
                    id: MenuId.ChatExecute,
                    order: 4,
                    when: ContextKeyExpr.and(whenNotInProgress, menuCondition, ChatContextKeys.withinEditSessionDiff.negate()),
                    group: 'navigation',
                    alt: {
                        id: 'workbench.action.chat.sendToNewChat',
                        title: localize2('chat.newChat.label', "Send to New Chat"),
                        icon: Codicon.plus
                    }
                }, {
                    id: MenuId.ChatEditorInlineExecute,
                    group: 'navigation',
                    order: 4,
                    when: ContextKeyExpr.and(ContextKeyExpr.or(ctxHasEditorModification.negate(), ChatContextKeys.inputHasText), whenNotInProgress, ChatContextKeys.requestInProgress.negate(), menuCondition),
                }
            ]
        });
    }
}
export class ChatDelegateToEditSessionAction extends Action2 {
    static { this.ID = 'workbench.action.chat.delegateToEditSession'; }
    constructor() {
        super({
            id: ChatDelegateToEditSessionAction.ID,
            title: localize2('interactive.submit.panel.label', "Send to Edit Session"),
            f1: false,
            category: CHAT_CATEGORY,
            icon: Codicon.commentDiscussion,
            keybinding: {
                when: ContextKeyExpr.and(ChatContextKeys.inChatInput, ChatContextKeys.withinEditSessionDiff),
                primary: 3 /* KeyCode.Enter */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            },
            menu: [
                {
                    id: MenuId.ChatExecute,
                    order: 4,
                    when: ContextKeyExpr.and(whenNotInProgress, ChatContextKeys.withinEditSessionDiff),
                    group: 'navigation',
                }
            ]
        });
    }
    async run(accessor, ...args) {
        const context = args[0];
        const widgetService = accessor.get(IChatWidgetService);
        const inlineWidget = context?.widget ?? widgetService.lastFocusedWidget;
        const locationData = inlineWidget?.locationData;
        if (inlineWidget && locationData?.type === ChatAgentLocation.EditorInline && locationData.delegateSessionResource) {
            const sessionWidget = widgetService.getWidgetBySessionResource(locationData.delegateSessionResource);
            if (sessionWidget) {
                await widgetService.reveal(sessionWidget);
                sessionWidget.attachmentModel.addContext({
                    id: 'vscode.delegate.inline',
                    kind: 'file',
                    modelDescription: `User's chat context`,
                    name: 'delegate-inline',
                    value: { range: locationData.wholeRange, uri: locationData.document },
                });
                sessionWidget.acceptInput(inlineWidget.getInput(), {
                    noCommandDetection: true,
                    enableImplicitContext: false,
                });
                inlineWidget.setInput('');
                locationData.close();
            }
        }
    }
}
export const ToggleAgentModeActionId = 'workbench.action.chat.toggleAgentMode';
class ToggleChatModeAction extends Action2 {
    static { this.ID = ToggleAgentModeActionId; }
    constructor() {
        super({
            id: ToggleChatModeAction.ID,
            title: localize2('interactive.toggleAgent.label', "Switch to Next Agent"),
            f1: true,
            category: CHAT_CATEGORY,
            precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.requestInProgress.negate())
        });
    }
    async run(accessor, ...args) {
        const commandService = accessor.get(ICommandService);
        const configurationService = accessor.get(IConfigurationService);
        const instaService = accessor.get(IInstantiationService);
        const modeService = accessor.get(IChatModeService);
        const telemetryService = accessor.get(ITelemetryService);
        const chatWidgetService = accessor.get(IChatWidgetService);
        const arg = args.at(0);
        let widget;
        if (arg?.sessionResource) {
            widget = chatWidgetService.getWidgetBySessionResource(arg.sessionResource);
        }
        else {
            widget = getEditingSessionContext(accessor, args)?.chatWidget;
        }
        if (!widget) {
            return;
        }
        const chatSession = widget.viewModel?.model;
        const requestCount = chatSession?.getRequests().length ?? 0;
        const switchToMode = (arg && modeService.findModeById(arg.modeId)) ?? this.getNextMode(widget, requestCount, configurationService, modeService);
        const currentMode = widget.input.currentModeObs.get();
        if (switchToMode.id === currentMode.id) {
            return;
        }
        const chatModeCheck = await instaService.invokeFunction(handleModeSwitch, widget.input.currentModeKind, switchToMode.kind, requestCount, widget.viewModel?.model.editingSession);
        if (!chatModeCheck) {
            return;
        }
        // Send telemetry for mode change
        const storage = switchToMode.source?.storage ?? 'builtin';
        const extensionId = switchToMode.source?.storage === 'extension' ? switchToMode.source.extensionId.value : undefined;
        const toolsCount = switchToMode.customTools?.get()?.length ?? 0;
        const handoffsCount = switchToMode.handOffs?.get()?.length ?? 0;
        telemetryService.publicLog2('chat.modeChange', {
            fromMode: currentMode.name.get(),
            mode: switchToMode.name.get(),
            requestCount: requestCount,
            storage,
            extensionId,
            toolsCount,
            handoffsCount
        });
        widget.input.setChatMode(switchToMode.id);
        if (chatModeCheck.needToClearSession) {
            await commandService.executeCommand(ACTION_ID_NEW_CHAT);
        }
    }
    getNextMode(chatWidget, requestCount, configurationService, modeService) {
        const modes = modeService.getModes();
        const flat = [
            ...modes.builtin.filter(mode => {
                return mode.kind !== ChatModeKind.Edit || configurationService.getValue(ChatConfiguration.Edits2Enabled) || requestCount === 0;
            }),
            ...(modes.custom ?? []),
        ];
        const curModeIndex = flat.findIndex(mode => mode.id === chatWidget.input.currentModeObs.get().id);
        const newMode = flat[(curModeIndex + 1) % flat.length];
        return newMode;
    }
}
class SwitchToNextModelAction extends Action2 {
    static { this.ID = 'workbench.action.chat.switchToNextModel'; }
    constructor() {
        super({
            id: SwitchToNextModelAction.ID,
            title: localize2('interactive.switchToNextModel.label', "Switch to Next Model"),
            category: CHAT_CATEGORY,
            f1: true,
            precondition: ChatContextKeys.enabled,
        });
    }
    run(accessor, ...args) {
        const widgetService = accessor.get(IChatWidgetService);
        const widget = widgetService.lastFocusedWidget;
        widget?.input.switchToNextModel();
    }
}
export const ChatOpenModelPickerActionId = 'workbench.action.chat.openModelPicker';
class OpenModelPickerAction extends Action2 {
    static { this.ID = ChatOpenModelPickerActionId; }
    constructor() {
        super({
            id: OpenModelPickerAction.ID,
            title: localize2('interactive.openModelPicker.label', "Open Model Picker"),
            category: CHAT_CATEGORY,
            f1: false,
            keybinding: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 89 /* KeyCode.Period */,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                when: ChatContextKeys.inChatInput
            },
            precondition: ChatContextKeys.enabled,
            menu: {
                id: MenuId.ChatInput,
                order: 3,
                group: 'navigation',
                when: ContextKeyExpr.and(ChatContextKeys.lockedToCodingAgent.negate(), ContextKeyExpr.or(ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Chat), ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.EditorInline), ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Notebook), ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Terminal)))
            }
        });
    }
    async run(accessor, ...args) {
        const widgetService = accessor.get(IChatWidgetService);
        const widget = widgetService.lastFocusedWidget;
        if (widget) {
            await widgetService.reveal(widget);
            widget.input.openModelPicker();
        }
    }
}
export class OpenModePickerAction extends Action2 {
    static { this.ID = 'workbench.action.chat.openModePicker'; }
    constructor() {
        super({
            id: OpenModePickerAction.ID,
            title: localize2('interactive.openModePicker.label', "Open Agent Picker"),
            tooltip: localize('setChatMode', "Set Agent"),
            category: CHAT_CATEGORY,
            f1: false,
            precondition: ChatContextKeys.enabled,
            keybinding: {
                when: ContextKeyExpr.and(ChatContextKeys.inChatInput, ChatContextKeys.location.isEqualTo(ChatAgentLocation.Chat)),
                primary: 2048 /* KeyMod.CtrlCmd */ | 89 /* KeyCode.Period */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            },
            menu: [
                {
                    id: MenuId.ChatInput,
                    order: 1,
                    when: ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.location.isEqualTo(ChatAgentLocation.Chat), ChatContextKeys.inQuickChat.negate(), ChatContextKeys.lockedToCodingAgent.negate()),
                    group: 'navigation',
                },
            ]
        });
    }
    async run(accessor, ...args) {
        const widgetService = accessor.get(IChatWidgetService);
        const widget = widgetService.lastFocusedWidget;
        if (widget) {
            widget.input.openModePicker();
        }
    }
}
export class ChatSessionPrimaryPickerAction extends Action2 {
    static { this.ID = 'workbench.action.chat.chatSessionPrimaryPicker'; }
    constructor() {
        super({
            id: ChatSessionPrimaryPickerAction.ID,
            title: localize2('interactive.openChatSessionPrimaryPicker.label', "Open Picker"),
            category: CHAT_CATEGORY,
            f1: false,
            precondition: ChatContextKeys.enabled,
            menu: {
                id: MenuId.ChatInput,
                order: 4,
                group: 'navigation',
                when: ContextKeyExpr.and(ChatContextKeys.lockedToCodingAgent, ChatContextKeys.chatSessionHasModels)
            }
        });
    }
    async run(accessor, ...args) {
        const widgetService = accessor.get(IChatWidgetService);
        const widget = widgetService.lastFocusedWidget;
        if (widget) {
            widget.input.openChatSessionPicker();
        }
    }
}
export const ChangeChatModelActionId = 'workbench.action.chat.changeModel';
class ChangeChatModelAction extends Action2 {
    static { this.ID = ChangeChatModelActionId; }
    constructor() {
        super({
            id: ChangeChatModelAction.ID,
            title: localize2('interactive.changeModel.label', "Change Model"),
            category: CHAT_CATEGORY,
            f1: false,
            precondition: ChatContextKeys.enabled,
        });
    }
    run(accessor, ...args) {
        const modelInfo = args[0];
        // Type check the arg
        assertType(typeof modelInfo.vendor === 'string' && typeof modelInfo.id === 'string' && typeof modelInfo.family === 'string');
        const widgetService = accessor.get(IChatWidgetService);
        const widgets = widgetService.getAllWidgets();
        for (const widget of widgets) {
            widget.input.switchModel(modelInfo);
        }
    }
}
export class ChatEditingSessionSubmitAction extends SubmitAction {
    static { this.ID = 'workbench.action.edits.submit'; }
    constructor() {
        const menuCondition = ChatContextKeys.chatModeKind.notEqualsTo(ChatModeKind.Ask);
        const precondition = ContextKeyExpr.and(ChatContextKeys.inputHasText, whenNotInProgress);
        super({
            id: ChatEditingSessionSubmitAction.ID,
            title: localize2('edits.submit.label', "Send"),
            f1: false,
            category: CHAT_CATEGORY,
            icon: Codicon.send,
            precondition,
            menu: [
                {
                    id: MenuId.ChatExecute,
                    order: 4,
                    when: ContextKeyExpr.and(ChatContextKeys.requestInProgress.negate(), menuCondition),
                    group: 'navigation',
                    alt: {
                        id: 'workbench.action.chat.sendToNewChat',
                        title: localize2('chat.newChat.label', "Send to New Chat"),
                        icon: Codicon.plus
                    }
                }
            ]
        });
    }
}
class SubmitWithoutDispatchingAction extends Action2 {
    static { this.ID = 'workbench.action.chat.submitWithoutDispatching'; }
    constructor() {
        const precondition = ContextKeyExpr.and(ChatContextKeys.inputHasText, whenNotInProgress, ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Ask));
        super({
            id: SubmitWithoutDispatchingAction.ID,
            title: localize2('interactive.submitWithoutDispatch.label', "Send"),
            f1: false,
            category: CHAT_CATEGORY,
            precondition,
            keybinding: {
                when: ChatContextKeys.inChatInput,
                primary: 512 /* KeyMod.Alt */ | 1024 /* KeyMod.Shift */ | 3 /* KeyCode.Enter */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
    run(accessor, ...args) {
        const context = args[0];
        const widgetService = accessor.get(IChatWidgetService);
        const widget = context?.widget ?? widgetService.lastFocusedWidget;
        widget?.acceptInput(context?.inputValue, { noCommandDetection: true });
    }
}
export class ChatSubmitWithCodebaseAction extends Action2 {
    static { this.ID = 'workbench.action.chat.submitWithCodebase'; }
    constructor() {
        const precondition = ContextKeyExpr.and(ChatContextKeys.inputHasText, whenNotInProgress);
        super({
            id: ChatSubmitWithCodebaseAction.ID,
            title: localize2('actions.chat.submitWithCodebase', "Send with {0}", `${chatVariableLeader}codebase`),
            precondition,
            keybinding: {
                when: ChatContextKeys.inChatInput,
                primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            },
        });
    }
    run(accessor, ...args) {
        const context = args[0];
        const widgetService = accessor.get(IChatWidgetService);
        const widget = context?.widget ?? widgetService.lastFocusedWidget;
        if (!widget) {
            return;
        }
        const languageModelToolsService = accessor.get(ILanguageModelToolsService);
        const codebaseTool = languageModelToolsService.getToolByName('codebase');
        if (!codebaseTool) {
            return;
        }
        widget.input.attachmentModel.addContext({
            id: codebaseTool.id,
            name: codebaseTool.displayName ?? '',
            fullName: codebaseTool.displayName ?? '',
            value: undefined,
            icon: ThemeIcon.isThemeIcon(codebaseTool.icon) ? codebaseTool.icon : undefined,
            kind: 'tool'
        });
        widget.acceptInput();
    }
}
class SendToNewChatAction extends Action2 {
    constructor() {
        const precondition = ChatContextKeys.inputHasText;
        super({
            id: 'workbench.action.chat.sendToNewChat',
            title: localize2('chat.newChat.label', "Send to New Chat"),
            precondition,
            category: CHAT_CATEGORY,
            f1: false,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 3 /* KeyCode.Enter */,
                when: ChatContextKeys.inChatInput,
            }
        });
    }
    async run(accessor, ...args) {
        const context = args[0];
        const widgetService = accessor.get(IChatWidgetService);
        const dialogService = accessor.get(IDialogService);
        const chatService = accessor.get(IChatService);
        const widget = context?.widget ?? widgetService.lastFocusedWidget;
        if (!widget) {
            return;
        }
        // Cancel any in-progress request before clearing
        if (widget.viewModel) {
            chatService.cancelCurrentRequestForSession(widget.viewModel.sessionResource);
        }
        const editingSession = widget.viewModel?.model.editingSession;
        if (editingSession) {
            if (!(await handleCurrentEditingSession(editingSession, undefined, dialogService))) {
                return;
            }
        }
        await widget.clear();
        widget.acceptInput(context?.inputValue);
    }
}
export const CancelChatActionId = 'workbench.action.chat.cancel';
export class CancelAction extends Action2 {
    static { this.ID = CancelChatActionId; }
    constructor() {
        super({
            id: CancelAction.ID,
            title: localize2('interactive.cancel.label', "Cancel"),
            f1: false,
            category: CHAT_CATEGORY,
            icon: Codicon.stopCircle,
            menu: [{
                    id: MenuId.ChatExecute,
                    when: ContextKeyExpr.and(ChatContextKeys.requestInProgress, ChatContextKeys.remoteJobCreating.negate()),
                    order: 4,
                    group: 'navigation',
                }, {
                    id: MenuId.ChatEditorInlineExecute,
                    when: ContextKeyExpr.and(ChatContextKeys.requestInProgress, ChatContextKeys.remoteJobCreating.negate()),
                    order: 4,
                    group: 'navigation',
                },
            ],
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 9 /* KeyCode.Escape */,
                win: { primary: 512 /* KeyMod.Alt */ | 1 /* KeyCode.Backspace */ },
            }
        });
    }
    run(accessor, ...args) {
        const context = args[0];
        const widgetService = accessor.get(IChatWidgetService);
        const widget = context?.widget ?? widgetService.lastFocusedWidget;
        if (!widget) {
            return;
        }
        const chatService = accessor.get(IChatService);
        if (widget.viewModel) {
            chatService.cancelCurrentRequestForSession(widget.viewModel.sessionResource);
        }
    }
}
export const CancelChatEditId = 'workbench.edit.chat.cancel';
export class CancelEdit extends Action2 {
    static { this.ID = CancelChatEditId; }
    constructor() {
        super({
            id: CancelEdit.ID,
            title: localize2('interactive.cancelEdit.label', "Cancel Edit"),
            f1: false,
            category: CHAT_CATEGORY,
            icon: Codicon.x,
            menu: [
                {
                    id: MenuId.ChatMessageTitle,
                    group: 'navigation',
                    order: 1,
                    when: ContextKeyExpr.and(ChatContextKeys.isRequest, ChatContextKeys.currentlyEditing, ContextKeyExpr.equals(`config.${ChatConfiguration.EditRequests}`, 'input'))
                }
            ],
            keybinding: {
                primary: 9 /* KeyCode.Escape */,
                when: ContextKeyExpr.and(ChatContextKeys.inChatInput, EditorContextKeys.hoverVisible.toNegated(), EditorContextKeys.hasNonEmptySelection.toNegated(), EditorContextKeys.hasMultipleSelections.toNegated(), ContextKeyExpr.or(ChatContextKeys.currentlyEditing, ChatContextKeys.currentlyEditingInput)),
                weight: 100 /* KeybindingWeight.EditorContrib */ - 5
            }
        });
    }
    run(accessor, ...args) {
        const context = args[0];
        const widgetService = accessor.get(IChatWidgetService);
        const widget = context?.widget ?? widgetService.lastFocusedWidget;
        if (!widget) {
            return;
        }
        widget.finishedEditing();
    }
}
export function registerChatExecuteActions() {
    registerAction2(ChatSubmitAction);
    registerAction2(ChatDelegateToEditSessionAction);
    registerAction2(ChatEditingSessionSubmitAction);
    registerAction2(SubmitWithoutDispatchingAction);
    registerAction2(CancelAction);
    registerAction2(SendToNewChatAction);
    registerAction2(ChatSubmitWithCodebaseAction);
    registerAction2(ContinueChatInSessionAction);
    registerAction2(ToggleChatModeAction);
    registerAction2(SwitchToNextModelAction);
    registerAction2(OpenModelPickerAction);
    registerAction2(OpenModePickerAction);
    registerAction2(ChatSessionPrimaryPickerAction);
    registerAction2(ChangeChatModelAction);
    registerAction2(CancelEdit);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEV4ZWN1dGVBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9hY3Rpb25zL2NoYXRFeGVjdXRlQWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFakUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFHakUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDdEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNyRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDdEYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNuRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUV0RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDbEUsT0FBTyxFQUFhLGdCQUFnQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDeEUsT0FB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