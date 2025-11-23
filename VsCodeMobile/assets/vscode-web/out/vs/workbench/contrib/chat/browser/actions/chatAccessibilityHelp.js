/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { AccessibleDiffViewerNext } from '../../../../../editor/browser/widget/diffEditor/commands.js';
import { localize } from '../../../../../nls.js';
import { AccessibleContentProvider } from '../../../../../platform/accessibility/browser/accessibleView.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { INLINE_CHAT_ID } from '../../../inlineChat/common/inlineChat.js';
import { ChatContextKeyExprs, ChatContextKeys } from '../../common/chatContextKeys.js';
import { ChatAgentLocation, ChatConfiguration, ChatModeKind } from '../../common/constants.js';
import { IChatWidgetService } from '../chat.js';
import { ChatEditingShowChangesAction, ViewPreviousEditsAction } from '../chatEditing/chatEditingActions.js';
export class PanelChatAccessibilityHelp {
    constructor() {
        this.priority = 107;
        this.name = 'panelChat';
        this.type = "help" /* AccessibleViewType.Help */;
        this.when = ContextKeyExpr.and(ChatContextKeys.location.isEqualTo(ChatAgentLocation.Chat), ChatContextKeys.inQuickChat.negate(), ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Ask), ContextKeyExpr.or(ChatContextKeys.inChatSession, ChatContextKeys.isResponse, ChatContextKeys.isRequest));
    }
    getProvider(accessor) {
        return getChatAccessibilityHelpProvider(accessor, undefined, 'panelChat');
    }
}
export class QuickChatAccessibilityHelp {
    constructor() {
        this.priority = 107;
        this.name = 'quickChat';
        this.type = "help" /* AccessibleViewType.Help */;
        this.when = ContextKeyExpr.and(ChatContextKeys.inQuickChat, ContextKeyExpr.or(ChatContextKeys.inChatSession, ChatContextKeys.isResponse, ChatContextKeys.isRequest));
    }
    getProvider(accessor) {
        return getChatAccessibilityHelpProvider(accessor, undefined, 'quickChat');
    }
}
export class EditsChatAccessibilityHelp {
    constructor() {
        this.priority = 119;
        this.name = 'editsView';
        this.type = "help" /* AccessibleViewType.Help */;
        this.when = ContextKeyExpr.and(ChatContextKeyExprs.inEditingMode, ChatContextKeys.inChatInput);
    }
    getProvider(accessor) {
        return getChatAccessibilityHelpProvider(accessor, undefined, 'editsView');
    }
}
export class AgentChatAccessibilityHelp {
    constructor() {
        this.priority = 120;
        this.name = 'agentView';
        this.type = "help" /* AccessibleViewType.Help */;
        this.when = ContextKeyExpr.and(ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Agent), ChatContextKeys.inChatInput);
    }
    getProvider(accessor) {
        return getChatAccessibilityHelpProvider(accessor, undefined, 'agentView');
    }
}
export function getAccessibilityHelpText(type, keybindingService) {
    const content = [];
    if (type === 'panelChat' || type === 'quickChat' || type === 'agentView') {
        if (type === 'quickChat') {
            content.push(localize('chat.overview', 'The quick chat view is comprised of an input box and a request/response list. The input box is used to make requests and the list is used to display responses.'));
            content.push(localize('chat.differenceQuick', 'The quick chat view is a transient interface for making and viewing requests, while the panel chat view is a persistent interface that also supports navigating suggested follow-up questions.'));
        }
        if (type === 'panelChat') {
            content.push(localize('chat.differencePanel', 'The panel chat view is a persistent interface that also supports navigating suggested follow-up questions, while the quick chat view is a transient interface for making and viewing requests.'));
        }
        content.push(localize('chat.requestHistory', 'In the input box, use up and down arrows to navigate your request history. Edit input and use enter or the submit button to run a new request.'));
        content.push(localize('chat.attachments.removal', 'To remove attached contexts, focus an attachment and press Delete or Backspace.'));
        content.push(localize('chat.inspectResponse', 'In the input box, inspect the last response in the accessible view{0}.', '<keybinding:editor.action.accessibleView>'));
        content.push(localize('workbench.action.chat.focus', 'To focus the chat request and response list, invoke the Focus Chat command{0}. This will move focus to the most recent response, which you can then navigate using the up and down arrow keys.', getChatFocusKeybindingLabel(keybindingService, type, 'last')));
        content.push(localize('workbench.action.chat.focusLastFocusedItem', 'To return to the last chat response you focused, invoke the Focus Last Focused Chat Response command{0}.', getChatFocusKeybindingLabel(keybindingService, type, 'lastFocused')));
        content.push(localize('workbench.action.chat.focusInput', 'To focus the input box for chat requests, invoke the Focus Chat Input command{0}.', getChatFocusKeybindingLabel(keybindingService, type, 'input')));
        content.push(localize('chat.progressVerbosity', 'As the chat request is being processed, you will hear verbose progress updates if the request takes more than 4 seconds. This includes information like searched text for <search term> with X results, created file <file_name>, or read file <file path>. This can be disabled with accessibility.verboseChatProgressUpdates.'));
        content.push(localize('chat.announcement', 'Chat responses will be announced as they come in. A response will indicate the number of code blocks, if any, and then the rest of the response.'));
        content.push(localize('workbench.action.chat.nextCodeBlock', 'To focus the next code block within a response, invoke the Chat: Next Code Block command{0}.', '<keybinding:workbench.action.chat.nextCodeBlock>'));
        content.push(localize('workbench.action.chat.nextUserPrompt', 'To navigate to the next user prompt in the conversation, invoke the Next User Prompt command{0}.', '<keybinding:workbench.action.chat.nextUserPrompt>'));
        content.push(localize('workbench.action.chat.previousUserPrompt', 'To navigate to the previous user prompt in the conversation, invoke the Previous User Prompt command{0}.', '<keybinding:workbench.action.chat.previousUserPrompt>'));
        content.push(localize('workbench.action.chat.announceConfirmation', 'To focus pending chat confirmation dialogs, invoke the Focus Chat Confirmation Status command{0}.', '<keybinding:workbench.action.chat.focusConfirmation>'));
        content.push(localize('chat.showHiddenTerminals', 'If there are any hidden chat terminals, you can view them by invoking the View Hidden Chat Terminals command{0}.', '<keybinding:workbench.action.terminal.chat.viewHiddenChatTerminals>'));
        content.push(localize('chat.focusMostRecentTerminal', 'To focus the last chat terminal that ran a tool, invoke the Focus Most Recent Chat Terminal command{0}.', `<keybinding:${"workbench.action.terminal.chat.focusMostRecentChatTerminal" /* TerminalContribCommandId.FocusMostRecentChatTerminal */}>`));
        content.push(localize('chat.focusMostRecentTerminalOutput', 'To focus the output from the last chat terminal tool, invoke the Focus Most Recent Chat Terminal Output command{0}.', `<keybinding:${"workbench.action.terminal.chat.focusMostRecentChatTerminalOutput" /* TerminalContribCommandId.FocusMostRecentChatTerminalOutput */}>`));
        if (type === 'panelChat') {
            content.push(localize('workbench.action.chat.newChat', 'To create a new chat session, invoke the New Chat command{0}.', '<keybinding:workbench.action.chat.new>'));
        }
    }
    if (type === 'editsView' || type === 'agentView') {
        if (type === 'agentView') {
            content.push(localize('chatAgent.overview', 'The chat agent view is used to apply edits across files in your workspace, enable running commands in the terminal, and more.'));
        }
        else {
            content.push(localize('chatEditing.overview', 'The chat editing view is used to apply edits across files.'));
        }
        content.push(localize('chatEditing.format', 'It is comprised of an input box and a file working set (Shift+Tab).'));
        content.push(localize('chatEditing.expectation', 'When a request is made, a progress indicator will play while the edits are being applied.'));
        content.push(localize('chatEditing.review', 'Once the edits are applied, a sound will play to indicate the document has been opened and is ready for review. The sound can be disabled with accessibility.signals.chatEditModifiedFile.'));
        content.push(localize('chatEditing.sections', 'Navigate between edits in the editor with navigate previous{0} and next{1}', '<keybinding:chatEditor.action.navigatePrevious>', '<keybinding:chatEditor.action.navigateNext>'));
        content.push(localize('chatEditing.acceptHunk', 'In the editor, Keep{0}, Undo{1}, or Toggle the Diff{2} for the current Change.', '<keybinding:chatEditor.action.acceptHunk>', '<keybinding:chatEditor.action.undoHunk>', '<keybinding:chatEditor.action.toggleDiff>'));
        content.push(localize('chatEditing.undoKeepSounds', 'Sounds will play when a change is accepted or undone. The sounds can be disabled with accessibility.signals.editsKept and accessibility.signals.editsUndone.'));
        if (type === 'agentView') {
            content.push(localize('chatAgent.userActionRequired', 'An alert will indicate when user action is required. For example, if the agent wants to run something in the terminal, you will hear Action Required: Run Command in Terminal.'));
            content.push(localize('chatAgent.runCommand', 'To take the action, use the accept tool command{0}.', '<keybinding:workbench.action.chat.acceptTool>'));
            content.push(localize('chatAgent.autoApprove', 'To automatically approve tool actions without manual confirmation, set {0} to {1} in your settings.', ChatConfiguration.GlobalAutoApprove, 'true'));
            content.push(localize('chatAgent.acceptTool', 'To accept a tool action, use the Accept Tool Confirmation command{0}.', '<keybinding:workbench.action.chat.acceptTool>'));
            content.push(localize('chatAgent.openEditedFilesSetting', 'By default, when edits are made to files, they will be opened. To change this behavior, set accessibility.openChatEditedFiles to false in your settings.'));
        }
        content.push(localize('chatEditing.helpfulCommands', 'Some helpful commands include:'));
        content.push(localize('workbench.action.chat.undoEdits', '- Undo Edits{0}.', '<keybinding:workbench.action.chat.undoEdits>'));
        content.push(localize('workbench.action.chat.editing.attachFiles', '- Attach Files{0}.', '<keybinding:workbench.action.chat.editing.attachFiles>'));
        content.push(localize('chatEditing.removeFileFromWorkingSet', '- Remove File from Working Set{0}.', '<keybinding:chatEditing.removeFileFromWorkingSet>'));
        content.push(localize('chatEditing.acceptFile', '- Keep{0} and Undo File{1}.', '<keybinding:chatEditing.acceptFile>', '<keybinding:chatEditing.discardFile>'));
        content.push(localize('chatEditing.saveAllFiles', '- Save All Files{0}.', '<keybinding:chatEditing.saveAllFiles>'));
        content.push(localize('chatEditing.acceptAllFiles', '- Keep All Edits{0}.', '<keybinding:chatEditing.acceptAllFiles>'));
        content.push(localize('chatEditing.discardAllFiles', '- Undo All Edits{0}.', '<keybinding:chatEditing.discardAllFiles>'));
        content.push(localize('chatEditing.openFileInDiff', '- Open File in Diff{0}.', '<keybinding:chatEditing.openFileInDiff>'));
        content.push(`- ${ChatEditingShowChangesAction.LABEL}<keybinding:chatEditing.viewChanges>`);
        content.push(`- ${ViewPreviousEditsAction.Label}<keybinding:chatEditing.viewPreviousEdits>`);
    }
    else {
        content.push(localize('inlineChat.overview', "Inline chat occurs within a code editor and takes into account the current selection. It is useful for making changes to the current editor. For example, fixing diagnostics, documenting or refactoring code. Keep in mind that AI generated code may be incorrect."));
        content.push(localize('inlineChat.access', "It can be activated via code actions or directly using the command: Inline Chat: Start Inline Chat{0}.", '<keybinding:inlineChat.start>'));
        content.push(localize('inlineChat.requestHistory', 'In the input box, use Show Previous{0} and Show Next{1} to navigate your request history. Edit input and use enter or the submit button to run a new request.', '<keybinding:history.showPrevious>', '<keybinding:history.showNext>'));
        content.push(localize('inlineChat.inspectResponse', 'In the input box, inspect the response in the accessible view{0}.', '<keybinding:editor.action.accessibleView>'));
        content.push(localize('inlineChat.contextActions', "Context menu actions may run a request prefixed with a /. Type / to discover such ready-made commands."));
        content.push(localize('inlineChat.fix', "If a fix action is invoked, a response will indicate the problem with the current code. A diff editor will be rendered and can be reached by tabbing."));
        content.push(localize('inlineChat.diff', "Once in the diff editor, enter review mode with{0}. Use up and down arrows to navigate lines with the proposed changes.", AccessibleDiffViewerNext.id));
        content.push(localize('inlineChat.toolbar', "Use tab to reach conditional parts like commands, status, message responses and more."));
    }
    content.push(localize('chat.signals', "Accessibility Signals can be changed via settings with a prefix of signals.chat. By default, if a request takes more than 4 seconds, you will hear a sound indicating that progress is still occurring."));
    return content.join('\n');
}
export function getChatAccessibilityHelpProvider(accessor, editor, type) {
    const widgetService = accessor.get(IChatWidgetService);
    const keybindingService = accessor.get(IKeybindingService);
    const inputEditor = widgetService.lastFocusedWidget?.inputEditor;
    if (!inputEditor) {
        return;
    }
    const domNode = inputEditor.getDomNode() ?? undefined;
    if (!domNode) {
        return;
    }
    const cachedPosition = inputEditor.getPosition();
    inputEditor.getSupportedActions();
    const helpText = getAccessibilityHelpText(type, keybindingService);
    return new AccessibleContentProvider(type === 'panelChat' ? "panelChat" /* AccessibleViewProviderId.PanelChat */ : type === 'inlineChat' ? "inlineChat" /* AccessibleViewProviderId.InlineChat */ : type === 'agentView' ? "agentChat" /* AccessibleViewProviderId.AgentChat */ : "quickChat" /* AccessibleViewProviderId.QuickChat */, { type: "help" /* AccessibleViewType.Help */ }, () => helpText, () => {
        if (type === 'quickChat' || type === 'editsView' || type === 'agentView' || type === 'panelChat') {
            if (cachedPosition) {
                inputEditor.setPosition(cachedPosition);
            }
            inputEditor.focus();
        }
        else if (type === 'inlineChat') {
            // TODO@jrieken find a better way for this
            const ctrl = editor?.getContribution(INLINE_CHAT_ID);
            ctrl?.focus();
        }
    }, type === 'panelChat' ? "accessibility.verbosity.panelChat" /* AccessibilityVerbositySettingId.Chat */ : "accessibility.verbosity.inlineChat" /* AccessibilityVerbositySettingId.InlineChat */);
}
// The when clauses for actions may not be true when we invoke the accessible view, so we need to provide the keybinding label manually
// to ensure it's correct
function getChatFocusKeybindingLabel(keybindingService, type, focus) {
    let kbs;
    const fallback = ' (unassigned keybinding)';
    if (focus === 'input') {
        kbs = keybindingService.lookupKeybindings('workbench.action.chat.focusInput');
    }
    else if (focus === 'lastFocused') {
        kbs = keybindingService.lookupKeybindings('workbench.chat.action.focusLastFocused');
    }
    else {
        kbs = keybindingService.lookupKeybindings('chat.action.focus');
    }
    if (!kbs?.length) {
        return fallback;
    }
    let kb;
    if (type === 'agentView' || type === 'panelChat') {
        if (focus !== 'input') {
            kb = kbs.find(kb => kb.getAriaLabel()?.includes('UpArrow'))?.getAriaLabel();
        }
        else {
            kb = kbs.find(kb => kb.getAriaLabel()?.includes('DownArrow'))?.getAriaLabel();
        }
    }
    else {
        // Quick chat
        if (focus !== 'input') {
            kb = kbs.find(kb => kb.getAriaLabel()?.includes('DownArrow'))?.getAriaLabel();
        }
        else {
            kb = kbs.find(kb => kb.getAriaLabel()?.includes('UpArrow'))?.getAriaLabel();
        }
    }
    return !!kb ? ` (${kb})` : fallback;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEFjY2Vzc2liaWxpdHlIZWxwLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9hY3Rpb25zL2NoYXRBY2Nlc3NpYmlsaXR5SGVscC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUloRyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUN2RyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLHlCQUF5QixFQUFnRCxNQUFNLGlFQUFpRSxDQUFDO0FBRTFKLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUU3RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFMUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLGVBQWUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUMvRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDaEQsT0FBTyxFQUFFLDRCQUE0QixFQUFFLHVCQUF1QixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFN0csTUFBTSxPQUFPLDBCQUEwQjtJQUF2QztRQUNVLGFBQVEsR0FBRyxHQUFHLENBQUM7UUFDZixTQUFJLEdBQUcsV0FBVyxDQUFDO1FBQ25CLFNBQUksd0NBQTJCO1FBQy9CLFNBQUksR0FBRyxjQUFjLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxFQUFFLGVBQWUsQ0FBQyxX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