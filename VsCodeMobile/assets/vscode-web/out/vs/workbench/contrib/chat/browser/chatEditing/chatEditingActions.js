/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { basename } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { isCodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { Position } from '../../../../../editor/common/core/position.js';
import { EditorContextKeys } from '../../../../../editor/common/editorContextKeys.js';
import { isLocation } from '../../../../../editor/common/languages.js';
import { ILanguageFeaturesService } from '../../../../../editor/common/services/languageFeatures.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { EditorActivation } from '../../../../../platform/editor/common/editor.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { isChatViewTitleActionContext } from '../../common/chatActions.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { applyingChatEditsFailedContextKey, CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME, chatEditingResourceContextKey, chatEditingWidgetFileStateContextKey, decidedChatEditingResourceContextKey, hasAppliedChatEditsContextKey, hasUndecidedChatEditingResourceContextKey, IChatEditingService } from '../../common/chatEditingService.js';
import { IChatService } from '../../common/chatService.js';
import { isChatTreeItem, isRequestVM, isResponseVM } from '../../common/chatViewModel.js';
import { ChatAgentLocation, ChatConfiguration, ChatModeKind } from '../../common/constants.js';
import { CHAT_CATEGORY } from '../actions/chatActions.js';
import { IChatWidgetService } from '../chat.js';
export class EditingSessionAction extends Action2 {
    constructor(opts) {
        super({
            category: CHAT_CATEGORY,
            ...opts
        });
    }
    run(accessor, ...args) {
        const context = getEditingSessionContext(accessor, args);
        if (!context || !context.editingSession) {
            return;
        }
        return this.runEditingSessionAction(accessor, context.editingSession, context.chatWidget, ...args);
    }
}
/**
 * Resolve view title toolbar context. If none, return context from the lastFocusedWidget.
 */
export function getEditingSessionContext(accessor, args) {
    const arg0 = args.at(0);
    const context = isChatViewTitleActionContext(arg0) ? arg0 : undefined;
    const chatWidgetService = accessor.get(IChatWidgetService);
    const chatEditingService = accessor.get(IChatEditingService);
    let chatWidget = context ? chatWidgetService.getWidgetBySessionResource(context.sessionResource) : undefined;
    if (!chatWidget) {
        chatWidget = chatWidgetService.lastFocusedWidget ?? chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Chat).find(w => w.supportsChangingModes);
    }
    if (!chatWidget?.viewModel) {
        return;
    }
    const editingSession = chatEditingService.getEditingSession(chatWidget.viewModel.model.sessionResource);
    return { editingSession, chatWidget };
}
class WorkingSetAction extends EditingSessionAction {
    runEditingSessionAction(accessor, editingSession, chatWidget, ...args) {
        const uris = [];
        if (URI.isUri(args[0])) {
            uris.push(args[0]);
        }
        else if (chatWidget) {
            uris.push(...chatWidget.input.selectedElements);
        }
        if (!uris.length) {
            return;
        }
        return this.runWorkingSetAction(accessor, editingSession, chatWidget, ...uris);
    }
}
registerAction2(class OpenFileInDiffAction extends WorkingSetAction {
    constructor() {
        super({
            id: 'chatEditing.openFileInDiff',
            title: localize2('open.fileInDiff', 'Open Changes in Diff Editor'),
            icon: Codicon.diffSingle,
            menu: [{
                    id: MenuId.ChatEditingWidgetModifiedFilesToolbar,
                    when: ContextKeyExpr.equals(chatEditingWidgetFileStateContextKey.key, 0 /* ModifiedFileEntryState.Modified */),
                    order: 2,
                    group: 'navigation'
                }],
        });
    }
    async runWorkingSetAction(accessor, currentEditingSession, _chatWidget, ...uris) {
        const editorService = accessor.get(IEditorService);
        for (const uri of uris) {
            let pane = editorService.activeEditorPane;
            if (!pane) {
                pane = await editorService.openEditor({ resource: uri });
            }
            if (!pane) {
                return;
            }
            const editedFile = currentEditingSession.getEntry(uri);
            editedFile?.getEditorIntegration(pane).toggleDiff(undefined, true);
        }
    }
});
registerAction2(class AcceptAction extends WorkingSetAction {
    constructor() {
        super({
            id: 'chatEditing.acceptFile',
            title: localize2('accept.file', 'Keep'),
            icon: Codicon.check,
            menu: [{
                    when: ContextKeyExpr.and(ContextKeyExpr.equals('resourceScheme', CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME), ContextKeyExpr.notIn(chatEditingResourceContextKey.key, decidedChatEditingResourceContextKey.key)),
                    id: MenuId.MultiDiffEditorFileToolbar,
                    order: 0,
                    group: 'navigation',
                }, {
                    id: MenuId.ChatEditingWidgetModifiedFilesToolbar,
                    when: ContextKeyExpr.equals(chatEditingWidgetFileStateContextKey.key, 0 /* ModifiedFileEntryState.Modified */),
                    order: 0,
                    group: 'navigation'
                }],
        });
    }
    async runWorkingSetAction(accessor, currentEditingSession, chatWidget, ...uris) {
        await currentEditingSession.accept(...uris);
    }
});
registerAction2(class DiscardAction extends WorkingSetAction {
    constructor() {
        super({
            id: 'chatEditing.discardFile',
            title: localize2('discard.file', 'Undo'),
            icon: Codicon.discard,
            menu: [{
                    when: ContextKeyExpr.and(ContextKeyExpr.equals('resourceScheme', CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME), ContextKeyExpr.notIn(chatEditingResourceContextKey.key, decidedChatEditingResourceContextKey.key)),
                    id: MenuId.MultiDiffEditorFileToolbar,
                    order: 2,
                    group: 'navigation',
                }, {
                    id: MenuId.ChatEditingWidgetModifiedFilesToolbar,
                    when: ContextKeyExpr.equals(chatEditingWidgetFileStateContextKey.key, 0 /* ModifiedFileEntryState.Modified */),
                    order: 1,
                    group: 'navigation'
                }],
        });
    }
    async runWorkingSetAction(accessor, currentEditingSession, chatWidget, ...uris) {
        await currentEditingSession.reject(...uris);
    }
});
export class ChatEditingAcceptAllAction extends EditingSessionAction {
    constructor() {
        super({
            id: 'chatEditing.acceptAllFiles',
            title: localize('accept', 'Keep'),
            icon: Codicon.check,
            tooltip: localize('acceptAllEdits', 'Keep All Edits'),
            precondition: hasUndecidedChatEditingResourceContextKey,
            keybinding: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */,
                when: ContextKeyExpr.and(hasUndecidedChatEditingResourceContextKey, ChatContextKeys.inChatInput),
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            },
            menu: [
                {
                    id: MenuId.ChatEditingWidgetToolbar,
                    group: 'navigation',
                    order: 0,
                    when: ContextKeyExpr.and(applyingChatEditsFailedContextKey.negate(), ContextKeyExpr.and(hasUndecidedChatEditingResourceContextKey))
                }
            ]
        });
    }
    async runEditingSessionAction(accessor, editingSession, chatWidget, ...args) {
        await editingSession.accept();
    }
}
registerAction2(ChatEditingAcceptAllAction);
export class ChatEditingDiscardAllAction extends EditingSessionAction {
    constructor() {
        super({
            id: 'chatEditing.discardAllFiles',
            title: localize('discard', 'Undo'),
            icon: Codicon.discard,
            tooltip: localize('discardAllEdits', 'Undo All Edits'),
            precondition: hasUndecidedChatEditingResourceContextKey,
            menu: [
                {
                    id: MenuId.ChatEditingWidgetToolbar,
                    group: 'navigation',
                    order: 1,
                    when: ContextKeyExpr.and(applyingChatEditsFailedContextKey.negate(), hasUndecidedChatEditingResourceContextKey)
                }
            ],
            keybinding: {
                when: ContextKeyExpr.and(hasUndecidedChatEditingResourceContextKey, ChatContextKeys.inChatInput, ChatContextKeys.inputHasText.negate()),
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 1 /* KeyCode.Backspace */,
            },
        });
    }
    async runEditingSessionAction(accessor, editingSession, chatWidget, ...args) {
        await discardAllEditsWithConfirmation(accessor, editingSession);
    }
}
registerAction2(ChatEditingDiscardAllAction);
export async function discardAllEditsWithConfirmation(accessor, currentEditingSession) {
    const dialogService = accessor.get(IDialogService);
    // Ask for confirmation if there are any edits
    const entries = currentEditingSession.entries.get();
    if (entries.length > 0) {
        const confirmation = await dialogService.confirm({
            title: localize('chat.editing.discardAll.confirmation.title', "Undo all edits?"),
            message: entries.length === 1
                ? localize('chat.editing.discardAll.confirmation.oneFile', "This will undo changes made in {0}. Do you want to proceed?", basename(entries[0].modifiedURI))
                : localize('chat.editing.discardAll.confirmation.manyFiles', "This will undo changes made in {0} files. Do you want to proceed?", entries.length),
            primaryButton: localize('chat.editing.discardAll.confirmation.primaryButton', "Yes"),
            type: 'info'
        });
        if (!confirmation.confirmed) {
            return false;
        }
    }
    await currentEditingSession.reject();
    return true;
}
export class ChatEditingShowChangesAction extends EditingSessionAction {
    static { this.ID = 'chatEditing.viewChanges'; }
    static { this.LABEL = localize('chatEditing.viewChanges', 'View All Edits'); }
    constructor() {
        super({
            id: ChatEditingShowChangesAction.ID,
            title: { value: ChatEditingShowChangesAction.LABEL, original: ChatEditingShowChangesAction.LABEL },
            tooltip: ChatEditingShowChangesAction.LABEL,
            f1: true,
            icon: Codicon.diffMultiple,
            precondition: hasUndecidedChatEditingResourceContextKey,
            menu: [
                {
                    id: MenuId.ChatEditingWidgetToolbar,
                    group: 'navigation',
                    order: 4,
                    when: ContextKeyExpr.and(applyingChatEditsFailedContextKey.negate(), ContextKeyExpr.and(hasAppliedChatEditsContextKey, hasUndecidedChatEditingResourceContextKey))
                }
            ],
        });
    }
    async runEditingSessionAction(accessor, editingSession, chatWidget, ...args) {
        await editingSession.show();
    }
}
registerAction2(ChatEditingShowChangesAction);
async function restoreSnapshotWithConfirmation(accessor, item) {
    const configurationService = accessor.get(IConfigurationService);
    const dialogService = accessor.get(IDialogService);
    const chatWidgetService = accessor.get(IChatWidgetService);
    const widget = chatWidgetService.getWidgetBySessionResource(item.sessionResource);
    const chatService = accessor.get(IChatService);
    const chatModel = chatService.getSession(item.sessionResource);
    if (!chatModel) {
        return;
    }
    const session = chatModel.editingSession;
    if (!session) {
        return;
    }
    const requestId = isRequestVM(item) ? item.id :
        isResponseVM(item) ? item.requestId : undefined;
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
            widget?.viewModel?.model.setCheckpoint(undefined);
            return;
        }
        if (confirmation.checkboxChecked) {
            await configurationService.updateValue('chat.editing.confirmEditRequestRemoval', false);
        }
        // Restore the snapshot to what it was before the request(s) that we deleted
        const snapshotRequestId = chatRequests[itemIndex].id;
        await session.restoreSnapshot(snapshotRequestId, undefined);
    }
}
registerAction2(class RemoveAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.chat.undoEdits',
            title: localize2('chat.undoEdits.label', "Undo Requests"),
            f1: false,
            category: CHAT_CATEGORY,
            icon: Codicon.discard,
            keybinding: {
                primary: 20 /* KeyCode.Delete */,
                mac: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 1 /* KeyCode.Backspace */,
                },
                when: ContextKeyExpr.and(ChatContextKeys.inChatSession, EditorContextKeys.textInputFocus.negate()),
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            },
            menu: [
                {
                    id: MenuId.ChatMessageTitle,
                    group: 'navigation',
                    order: 2,
                    when: ContextKeyExpr.and(ContextKeyExpr.equals(`config.${ChatConfiguration.EditRequests}`, 'input').negate(), ContextKeyExpr.equals(`config.${ChatConfiguration.CheckpointsEnabled}`, false), ChatContextKeys.lockedToCodingAgent.negate()),
                }
            ]
        });
    }
    async run(accessor, ...args) {
        let item = args[0];
        const chatWidgetService = accessor.get(IChatWidgetService);
        const configurationService = accessor.get(IConfigurationService);
        const widget = (isChatTreeItem(item) && chatWidgetService.getWidgetBySessionResource(item.sessionResource)) || chatWidgetService.lastFocusedWidget;
        if (!isResponseVM(item) && !isRequestVM(item)) {
            item = widget?.getFocus();
        }
        if (!item) {
            return;
        }
        await restoreSnapshotWithConfirmation(accessor, item);
        if (isRequestVM(item) && configurationService.getValue('chat.undoRequests.restoreInput')) {
            widget?.focusInput();
            widget?.input.setValue(item.messageText, false);
        }
    }
});
registerAction2(class RestoreCheckpointAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.chat.restoreCheckpoint',
            title: localize2('chat.restoreCheckpoint.label', "Restore Checkpoint"),
            tooltip: localize2('chat.restoreCheckpoint.tooltip', "Restores workspace and chat to this point"),
            f1: false,
            category: CHAT_CATEGORY,
            keybinding: {
                primary: 20 /* KeyCode.Delete */,
                mac: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 1 /* KeyCode.Backspace */,
                },
                when: ContextKeyExpr.and(ChatContextKeys.inChatSession, EditorContextKeys.textInputFocus.negate()),
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            },
            menu: [
                {
                    id: MenuId.ChatMessageCheckpoint,
                    group: 'navigation',
                    order: 2,
                    when: ContextKeyExpr.and(ChatContextKeys.isRequest, ChatContextKeys.lockedToCodingAgent.negate())
                }
            ]
        });
    }
    async run(accessor, ...args) {
        let item = args[0];
        const chatWidgetService = accessor.get(IChatWidgetService);
        const widget = (isChatTreeItem(item) && chatWidgetService.getWidgetBySessionResource(item.sessionResource)) || chatWidgetService.lastFocusedWidget;
        if (!isResponseVM(item) && !isRequestVM(item)) {
            item = widget?.getFocus();
        }
        if (!item) {
            return;
        }
        if (isRequestVM(item)) {
            widget?.focusInput();
            widget?.input.setValue(item.messageText, false);
        }
        widget?.viewModel?.model.setCheckpoint(item.id);
        await restoreSnapshotWithConfirmation(accessor, item);
    }
});
registerAction2(class RestoreLastCheckpoint extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.chat.restoreLastCheckpoint',
            title: localize2('chat.restoreLastCheckpoint.label', "Restore to Last Checkpoint"),
            f1: false,
            category: CHAT_CATEGORY,
            icon: Codicon.discard,
            menu: [
                {
                    id: MenuId.ChatMessageFooter,
                    group: 'navigation',
                    order: 1,
                    when: ContextKeyExpr.and(ContextKeyExpr.in(ChatContextKeys.itemId.key, ChatContextKeys.lastItemId.key), ContextKeyExpr.equals(`config.${ChatConfiguration.CheckpointsEnabled}`, true), ChatContextKeys.lockedToCodingAgent.negate()),
                }
            ]
        });
    }
    async run(accessor, ...args) {
        let item = args[0];
        const chatWidgetService = accessor.get(IChatWidgetService);
        const chatService = accessor.get(IChatService);
        const widget = (isChatTreeItem(item) && chatWidgetService.getWidgetBySessionResource(item.sessionResource)) || chatWidgetService.lastFocusedWidget;
        if (!isResponseVM(item) && !isRequestVM(item)) {
            item = widget?.getFocus();
        }
        if (!item) {
            return;
        }
        const chatModel = chatService.getSession(item.sessionResource);
        if (!chatModel) {
            return;
        }
        const session = chatModel.editingSession;
        if (!session) {
            return;
        }
        await restoreSnapshotWithConfirmation(accessor, item);
        if (isResponseVM(item)) {
            widget?.viewModel?.model.setCheckpoint(item.requestId);
            const request = chatModel.getRequests().find(request => request.id === item.requestId);
            if (request) {
                widget?.focusInput();
                widget?.input.setValue(request.message.text, false);
            }
        }
    }
});
registerAction2(class EditAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.chat.editRequests',
            title: localize2('chat.editRequests.label', "Edit Request"),
            f1: false,
            category: CHAT_CATEGORY,
            icon: Codicon.edit,
            keybinding: {
                primary: 3 /* KeyCode.Enter */,
                when: ContextKeyExpr.and(ChatContextKeys.inChatSession, EditorContextKeys.textInputFocus.negate()),
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            },
            menu: [
                {
                    id: MenuId.ChatMessageTitle,
                    group: 'navigation',
                    order: 2,
                    when: ContextKeyExpr.and(ContextKeyExpr.or(ContextKeyExpr.equals(`config.${ChatConfiguration.EditRequests}`, 'hover'), ContextKeyExpr.equals(`config.${ChatConfiguration.EditRequests}`, 'input')))
                }
            ]
        });
    }
    async run(accessor, ...args) {
        let item = args[0];
        const chatWidgetService = accessor.get(IChatWidgetService);
        const widget = (isChatTreeItem(item) && chatWidgetService.getWidgetBySessionResource(item.sessionResource)) || chatWidgetService.lastFocusedWidget;
        if (!isResponseVM(item) && !isRequestVM(item)) {
            item = widget?.getFocus();
        }
        if (!item) {
            return;
        }
        if (isRequestVM(item)) {
            widget?.startEditing(item.id);
        }
    }
});
registerAction2(class OpenWorkingSetHistoryAction extends Action2 {
    static { this.id = 'chat.openFileUpdatedBySnapshot'; }
    constructor() {
        super({
            id: OpenWorkingSetHistoryAction.id,
            title: localize('chat.openFileUpdatedBySnapshot.label', "Open File"),
            menu: [{
                    id: MenuId.ChatEditingCodeBlockContext,
                    group: 'navigation',
                    order: 0,
                },]
        });
    }
    async run(accessor, ...args) {
        const context = args[0];
        if (!context?.sessionResource) {
            return;
        }
        const editorService = accessor.get(IEditorService);
        await editorService.openEditor({ resource: context.uri });
    }
});
registerAction2(class OpenWorkingSetHistoryAction extends Action2 {
    static { this.id = 'chat.openFileSnapshot'; }
    constructor() {
        super({
            id: OpenWorkingSetHistoryAction.id,
            title: localize('chat.openSnapshot.label', "Open File Snapshot"),
            menu: [{
                    id: MenuId.ChatEditingCodeBlockContext,
                    group: 'navigation',
                    order: 1,
                },]
        });
    }
    async run(accessor, ...args) {
        const context = args[0];
        if (!context?.sessionResource) {
            return;
        }
        const chatService = accessor.get(IChatService);
        const chatEditingService = accessor.get(IChatEditingService);
        const editorService = accessor.get(IEditorService);
        const chatModel = chatService.getSession(context.sessionResource);
        if (!chatModel) {
            return;
        }
        const snapshot = chatEditingService.getEditingSession(chatModel.sessionResource)?.getSnapshotUri(context.requestId, context.uri, context.stopId);
        if (snapshot) {
            const editor = await editorService.openEditor({ resource: snapshot, label: localize('chatEditing.snapshot', '{0} (Snapshot)', basename(context.uri)), options: { activation: EditorActivation.ACTIVATE } });
            if (isCodeEditor(editor)) {
                editor.updateOptions({ readOnly: true });
            }
        }
    }
});
registerAction2(class ResolveSymbolsContextAction extends EditingSessionAction {
    constructor() {
        super({
            id: 'workbench.action.edits.addFilesFromReferences',
            title: localize2('addFilesFromReferences', "Add Files From References"),
            f1: false,
            category: CHAT_CATEGORY,
            menu: {
                id: MenuId.ChatInputSymbolAttachmentContext,
                group: 'navigation',
                order: 1,
                when: ContextKeyExpr.and(ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Ask), EditorContextKeys.hasReferenceProvider)
            }
        });
    }
    async runEditingSessionAction(accessor, editingSession, chatWidget, ...args) {
        if (args.length === 0 || !isLocation(args[0])) {
            return;
        }
        const textModelService = accessor.get(ITextModelService);
        const languageFeaturesService = accessor.get(ILanguageFeaturesService);
        const symbol = args[0];
        const modelReference = await textModelService.createModelReference(symbol.uri);
        const textModel = modelReference.object.textEditorModel;
        if (!textModel) {
            return;
        }
        const position = new Position(symbol.range.startLineNumber, symbol.range.startColumn);
        const [references, definitions, implementations] = await Promise.all([
            this.getReferences(position, textModel, languageFeaturesService),
            this.getDefinitions(position, textModel, languageFeaturesService),
            this.getImplementations(position, textModel, languageFeaturesService)
        ]);
        // Sort the references, definitions and implementations by
        // how important it is that they make it into the working set as it has limited size
        const attachments = [];
        for (const reference of [...definitions, ...implementations, ...references]) {
            attachments.push(chatWidget.attachmentModel.asFileVariableEntry(reference.uri));
        }
        chatWidget.attachmentModel.addContext(...attachments);
    }
    async getReferences(position, textModel, languageFeaturesService) {
        const referenceProviders = languageFeaturesService.referenceProvider.all(textModel);
        const references = await Promise.all(referenceProviders.map(async (referenceProvider) => {
            return await referenceProvider.provideReferences(textModel, position, { includeDeclaration: true }, CancellationToken.None) ?? [];
        }));
        return references.flat();
    }
    async getDefinitions(position, textModel, languageFeaturesService) {
        const definitionProviders = languageFeaturesService.definitionProvider.all(textModel);
        const definitions = await Promise.all(definitionProviders.map(async (definitionProvider) => {
            return await definitionProvider.provideDefinition(textModel, position, CancellationToken.None) ?? [];
        }));
        return definitions.flat();
    }
    async getImplementations(position, textModel, languageFeaturesService) {
        const implementationProviders = languageFeaturesService.implementationProvider.all(textModel);
        const implementations = await Promise.all(implementationProviders.map(async (implementationProvider) => {
            return await implementationProvider.provideImplementation(textModel, position, CancellationToken.None) ?? [];
        }));
        return implementations.flat();
    }
});
export class ViewPreviousEditsAction extends EditingSessionAction {
    static { this.Id = 'chatEditing.viewPreviousEdits'; }
    static { this.Label = localize('chatEditing.viewPreviousEdits', 'View Previous Edits'); }
    constructor() {
        super({
            id: ViewPreviousEditsAction.Id,
            title: { value: ViewPreviousEditsAction.Label, original: ViewPreviousEditsAction.Label },
            tooltip: ViewPreviousEditsAction.Label,
            f1: true,
            icon: Codicon.diffMultiple,
            precondition: ContextKeyExpr.and(ChatContextKeys.enabled, hasUndecidedChatEditingResourceContextKey.negate()),
            menu: [
                {
                    id: MenuId.ChatEditingWidgetToolbar,
                    group: 'navigation',
                    order: 4,
                    when: ContextKeyExpr.and(applyingChatEditsFailedContextKey.negate(), ContextKeyExpr.and(hasAppliedChatEditsContextKey, hasUndecidedChatEditingResourceContextKey.negate()))
                }
            ],
        });
    }
    async runEditingSessionAction(accessor, editingSession, chatWidget, ...args) {
        await editingSession.show(true);
    }
}
registerAction2(ViewPreviousEditsAction);
/**
 * Workbench command to explore accepting working set changes from an extension. Executing
 * the command will accept the changes for the provided resources across all edit sessions.
 */
CommandsRegistry.registerCommand('_chat.editSessions.accept', async (accessor, resources) => {
    if (resources.length === 0) {
        return;
    }
    const uris = resources.map(resource => URI.revive(resource));
    const chatEditingService = accessor.get(IChatEditingService);
    for (const editingSession of chatEditingService.editingSessionsObs.get()) {
        await editingSession.accept(...uris);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0RWRpdGluZy9jaGF0RWRpdGluZ0FjdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDL0UsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRWpFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLG1DQUFtQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUU5RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDekUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDdEYsT0FBTyxFQUFFLFVBQVUsRUFBWSxNQUFNLDJDQUEyQyxDQUFDO0FBRWpGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUQsT0FBTyxFQUFFLE9BQU8sRUFBbUIsTUFBTSxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3RILE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztB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