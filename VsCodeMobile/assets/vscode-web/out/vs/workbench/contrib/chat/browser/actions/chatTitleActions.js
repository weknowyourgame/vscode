/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../base/common/codicons.js';
import { marked } from '../../../../../base/common/marked/marked.js';
import { basename } from '../../../../../base/common/resources.js';
import { IBulkEditService } from '../../../../../editor/browser/services/bulkEditService.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { ResourceNotebookCellEdit } from '../../../bulkEdit/browser/bulkCellEdits.js';
import { MENU_INLINE_CHAT_WIDGET_SECONDARY } from '../../../inlineChat/common/inlineChat.js';
import { CellKind, NOTEBOOK_EDITOR_ID } from '../../../notebook/common/notebookCommon.js';
import { NOTEBOOK_IS_ACTIVE_EDITOR } from '../../../notebook/common/notebookContextKeys.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { applyingChatEditsFailedContextKey, isChatEditingActionContext } from '../../common/chatEditingService.js';
import { ChatAgentVoteDirection, IChatService } from '../../common/chatService.js';
import { isResponseVM } from '../../common/chatViewModel.js';
import { ChatModeKind } from '../../common/constants.js';
import { IChatWidgetService } from '../chat.js';
import { CHAT_CATEGORY } from './chatActions.js';
export const MarkUnhelpfulActionId = 'workbench.action.chat.markUnhelpful';
const enableFeedbackConfig = 'config.telemetry.feedback.enabled';
export function registerChatTitleActions() {
    registerAction2(class MarkHelpfulAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.markHelpful',
                title: localize2('interactive.helpful.label', "Helpful"),
                f1: false,
                category: CHAT_CATEGORY,
                icon: Codicon.thumbsup,
                toggled: ChatContextKeys.responseVote.isEqualTo('up'),
                menu: [{
                        id: MenuId.ChatMessageFooter,
                        group: 'navigation',
                        order: 2,
                        when: ContextKeyExpr.and(ChatContextKeys.extensionParticipantRegistered, ChatContextKeys.isResponse, ChatContextKeys.responseHasError.negate(), ContextKeyExpr.has(enableFeedbackConfig))
                    }, {
                        id: MENU_INLINE_CHAT_WIDGET_SECONDARY,
                        group: 'navigation',
                        order: 1,
                        when: ContextKeyExpr.and(ChatContextKeys.extensionParticipantRegistered, ChatContextKeys.isResponse, ChatContextKeys.responseHasError.negate(), ContextKeyExpr.has(enableFeedbackConfig))
                    }]
            });
        }
        run(accessor, ...args) {
            const item = args[0];
            if (!isResponseVM(item)) {
                return;
            }
            const chatService = accessor.get(IChatService);
            chatService.notifyUserAction({
                agentId: item.agent?.id,
                command: item.slashCommand?.name,
                sessionResource: item.session.sessionResource,
                requestId: item.requestId,
                result: item.result,
                action: {
                    kind: 'vote',
                    direction: ChatAgentVoteDirection.Up,
                    reason: undefined
                }
            });
            item.setVote(ChatAgentVoteDirection.Up);
            item.setVoteDownReason(undefined);
        }
    });
    registerAction2(class MarkUnhelpfulAction extends Action2 {
        constructor() {
            super({
                id: MarkUnhelpfulActionId,
                title: localize2('interactive.unhelpful.label', "Unhelpful"),
                f1: false,
                category: CHAT_CATEGORY,
                icon: Codicon.thumbsdown,
                toggled: ChatContextKeys.responseVote.isEqualTo('down'),
                menu: [{
                        id: MenuId.ChatMessageFooter,
                        group: 'navigation',
                        order: 3,
                        when: ContextKeyExpr.and(ChatContextKeys.extensionParticipantRegistered, ChatContextKeys.isResponse, ContextKeyExpr.has(enableFeedbackConfig))
                    }, {
                        id: MENU_INLINE_CHAT_WIDGET_SECONDARY,
                        group: 'navigation',
                        order: 2,
                        when: ContextKeyExpr.and(ChatContextKeys.extensionParticipantRegistered, ChatContextKeys.isResponse, ChatContextKeys.responseHasError.negate(), ContextKeyExpr.has(enableFeedbackConfig))
                    }]
            });
        }
        run(accessor, ...args) {
            const item = args[0];
            if (!isResponseVM(item)) {
                return;
            }
            const reason = args[1];
            if (typeof reason !== 'string') {
                return;
            }
            item.setVote(ChatAgentVoteDirection.Down);
            item.setVoteDownReason(reason);
            const chatService = accessor.get(IChatService);
            chatService.notifyUserAction({
                agentId: item.agent?.id,
                command: item.slashCommand?.name,
                sessionResource: item.session.sessionResource,
                requestId: item.requestId,
                result: item.result,
                action: {
                    kind: 'vote',
                    direction: ChatAgentVoteDirection.Down,
                    reason: item.voteDownReason
                }
            });
        }
    });
    registerAction2(class ReportIssueForBugAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.reportIssueForBug',
                title: localize2('interactive.reportIssueForBug.label', "Report Issue"),
                f1: false,
                category: CHAT_CATEGORY,
                icon: Codicon.report,
                menu: [{
                        id: MenuId.ChatMessageFooter,
                        group: 'navigation',
                        order: 4,
                        when: ContextKeyExpr.and(ChatContextKeys.responseSupportsIssueReporting, ChatContextKeys.isResponse, ContextKeyExpr.has(enableFeedbackConfig))
                    }, {
                        id: MENU_INLINE_CHAT_WIDGET_SECONDARY,
                        group: 'navigation',
                        order: 3,
                        when: ContextKeyExpr.and(ChatContextKeys.responseSupportsIssueReporting, ChatContextKeys.isResponse, ContextKeyExpr.has(enableFeedbackConfig))
                    }]
            });
        }
        run(accessor, ...args) {
            const item = args[0];
            if (!isResponseVM(item)) {
                return;
            }
            const chatService = accessor.get(IChatService);
            chatService.notifyUserAction({
                agentId: item.agent?.id,
                command: item.slashCommand?.name,
                sessionResource: item.session.sessionResource,
                requestId: item.requestId,
                result: item.result,
                action: {
                    kind: 'bug'
                }
            });
        }
    });
    registerAction2(class RetryChatAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.retry',
                title: localize2('chat.retry.label', "Retry"),
                f1: false,
                category: CHAT_CATEGORY,
                icon: Codicon.refresh,
                menu: [
                    {
                        id: MenuId.ChatMessageFooter,
                        group: 'navigation',
                        when: ContextKeyExpr.and(ChatContextKeys.isResponse, ContextKeyExpr.in(ChatContextKeys.itemId.key, ChatContextKeys.lastItemId.key))
                    },
                    {
                        id: MenuId.ChatEditingWidgetToolbar,
                        group: 'navigation',
                        when: applyingChatEditsFailedContextKey,
                        order: 0
                    }
                ]
            });
        }
        async run(accessor, ...args) {
            const chatWidgetService = accessor.get(IChatWidgetService);
            let item = args[0];
            if (isChatEditingActionContext(item)) {
                // Resolve chat editing action context to the last response VM
                item = chatWidgetService.getWidgetBySessionResource(item.sessionResource)?.viewModel?.getItems().at(-1);
            }
            if (!isResponseVM(item)) {
                return;
            }
            const chatService = accessor.get(IChatService);
            const chatModel = chatService.getSession(item.sessionResource);
            const chatRequests = chatModel?.getRequests();
            if (!chatRequests) {
                return;
            }
            const itemIndex = chatRequests?.findIndex(request => request.id === item.requestId);
            const widget = chatWidgetService.getWidgetBySessionResource(item.sessionResource);
            const mode = widget?.input.currentModeKind;
            if (chatModel && (mode === ChatModeKind.Edit || mode === ChatModeKind.Agent)) {
                const configurationService = accessor.get(IConfigurationService);
                const dialogService = accessor.get(IDialogService);
                const currentEditingSession = widget?.viewModel?.model.editingSession;
                if (!currentEditingSession) {
                    return;
                }
                // Prompt if the last request modified the working set and the user hasn't already disabled the dialog
                const entriesModifiedInLastRequest = currentEditingSession.entries.get().filter((entry) => entry.lastModifyingRequestId === item.requestId);
                const shouldPrompt = entriesModifiedInLastRequest.length > 0 && configurationService.getValue('chat.editing.confirmEditRequestRetry') === true;
                const confirmation = shouldPrompt
                    ? await dialogService.confirm({
                        title: localize('chat.retryLast.confirmation.title2', "Do you want to retry your last request?"),
                        message: entriesModifiedInLastRequest.length === 1
                            ? localize('chat.retry.confirmation.message2', "This will undo edits made to {0} since this request.", basename(entriesModifiedInLastRequest[0].modifiedURI))
                            : localize('chat.retryLast.confirmation.message2', "This will undo edits made to {0} files in your working set since this request. Do you want to proceed?", entriesModifiedInLastRequest.length),
                        primaryButton: localize('chat.retry.confirmation.primaryButton', "Yes"),
                        checkbox: { label: localize('chat.retry.confirmation.checkbox', "Don't ask again"), checked: false },
                        type: 'info'
                    })
                    : { confirmed: true };
                if (!confirmation.confirmed) {
                    return;
                }
                if (confirmation.checkboxChecked) {
                    await configurationService.updateValue('chat.editing.confirmEditRequestRetry', false);
                }
                // Reset the snapshot to the first stop (undefined undo index)
                const snapshotRequest = chatRequests[itemIndex];
                if (snapshotRequest) {
                    await currentEditingSession.restoreSnapshot(snapshotRequest.id, undefined);
                }
            }
            const request = chatModel?.getRequests().find(candidate => candidate.id === item.requestId);
            const languageModelId = widget?.input.currentLanguageModel;
            chatService.resendRequest(request, {
                userSelectedModelId: languageModelId,
                attempt: (request?.attempt ?? -1) + 1,
                ...widget?.getModeRequestOptions(),
            });
        }
    });
    registerAction2(class InsertToNotebookAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.insertIntoNotebook',
                title: localize2('interactive.insertIntoNotebook.label', "Insert into Notebook"),
                f1: false,
                category: CHAT_CATEGORY,
                icon: Codicon.insert,
                menu: {
                    id: MenuId.ChatMessageFooter,
                    group: 'navigation',
                    isHiddenByDefault: true,
                    when: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, ChatContextKeys.isResponse, ChatContextKeys.responseIsFiltered.negate())
                }
            });
        }
        async run(accessor, ...args) {
            const item = args[0];
            if (!isResponseVM(item)) {
                return;
            }
            const editorService = accessor.get(IEditorService);
            if (editorService.activeEditorPane?.getId() === NOTEBOOK_EDITOR_ID) {
                const notebookEditor = editorService.activeEditorPane.getControl();
                if (!notebookEditor.hasModel()) {
                    return;
                }
                if (notebookEditor.isReadOnly) {
                    return;
                }
                const value = item.response.toString();
                const splitContents = splitMarkdownAndCodeBlocks(value);
                const focusRange = notebookEditor.getFocus();
                const index = Math.max(focusRange.end, 0);
                const bulkEditService = accessor.get(IBulkEditService);
                await bulkEditService.apply([
                    new ResourceNotebookCellEdit(notebookEditor.textModel.uri, {
                        editType: 1 /* CellEditType.Replace */,
                        index: index,
                        count: 0,
                        cells: splitContents.map(content => {
                            const kind = content.type === 'markdown' ? CellKind.Markup : CellKind.Code;
                            const language = content.type === 'markdown' ? 'markdown' : content.language;
                            const mime = content.type === 'markdown' ? 'text/markdown' : `text/x-${content.language}`;
                            return {
                                cellKind: kind,
                                language,
                                mime,
                                source: content.content,
                                outputs: [],
                                metadata: {}
                            };
                        })
                    })
                ], { quotableLabel: 'Insert into Notebook' });
            }
        }
    });
}
function splitMarkdownAndCodeBlocks(markdown) {
    const lexer = new marked.Lexer();
    const tokens = lexer.lex(markdown);
    const splitContent = [];
    let markdownPart = '';
    tokens.forEach((token) => {
        if (token.type === 'code') {
            if (markdownPart.trim()) {
                splitContent.push({ type: 'markdown', content: markdownPart });
                markdownPart = '';
            }
            splitContent.push({
                type: 'code',
                language: token.lang || '',
                content: token.text,
            });
        }
        else {
            markdownPart += token.raw;
        }
    });
    if (markdownPart.trim()) {
        splitContent.push({ type: 'markdown', content: markdownPart });
    }
    return splitContent;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRpdGxlQWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0VGl0bGVBY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDckUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRW5FLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDckcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNuRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDckYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDdEYsT0FBTyxFQUFFLGlDQUFpQyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFN0YsT0FBTyxFQUFnQixRQUFRLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN4RyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUM1RixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0saUNBQWlDLENBQUM7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