/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Schemas } from '../../../../base/common/network.js';
import { IChatSessionsService } from './chatSessionsService.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
export var ChatConfiguration;
(function (ChatConfiguration) {
    ChatConfiguration["AgentEnabled"] = "chat.agent.enabled";
    ChatConfiguration["Edits2Enabled"] = "chat.edits2.enabled";
    ChatConfiguration["ExtensionToolsEnabled"] = "chat.extensionTools.enabled";
    ChatConfiguration["EditRequests"] = "chat.editRequests";
    ChatConfiguration["GlobalAutoApprove"] = "chat.tools.global.autoApprove";
    ChatConfiguration["AutoApproveEdits"] = "chat.tools.edits.autoApprove";
    ChatConfiguration["AutoApprovedUrls"] = "chat.tools.urls.autoApprove";
    ChatConfiguration["EligibleForAutoApproval"] = "chat.tools.eligibleForAutoApproval";
    ChatConfiguration["EnableMath"] = "chat.math.enabled";
    ChatConfiguration["CheckpointsEnabled"] = "chat.checkpoints.enabled";
    ChatConfiguration["AgentSessionsViewLocation"] = "chat.agentSessionsViewLocation";
    ChatConfiguration["ThinkingStyle"] = "chat.agent.thinkingStyle";
    ChatConfiguration["TodosShowWidget"] = "chat.tools.todos.showWidget";
    ChatConfiguration["ShowAgentSessionsViewDescription"] = "chat.showAgentSessionsViewDescription";
    ChatConfiguration["EmptyStateHistoryEnabled"] = "chat.emptyState.history.enabled";
    ChatConfiguration["NotifyWindowOnResponseReceived"] = "chat.notifyWindowOnResponseReceived";
    ChatConfiguration["SubagentToolCustomAgents"] = "chat.customAgentInSubagent.enabled";
    ChatConfiguration["ShowCodeBlockProgressAnimation"] = "chat.agent.codeBlockProgress";
})(ChatConfiguration || (ChatConfiguration = {}));
/**
 * The "kind" of agents for custom agents.
 */
export var ChatModeKind;
(function (ChatModeKind) {
    ChatModeKind["Ask"] = "ask";
    ChatModeKind["Edit"] = "edit";
    ChatModeKind["Agent"] = "agent";
})(ChatModeKind || (ChatModeKind = {}));
export function validateChatMode(mode) {
    switch (mode) {
        case ChatModeKind.Ask:
        case ChatModeKind.Edit:
        case ChatModeKind.Agent:
            return mode;
        default:
            return undefined;
    }
}
export function isChatMode(mode) {
    return !!validateChatMode(mode);
}
// Thinking display modes for pinned content
export var ThinkingDisplayMode;
(function (ThinkingDisplayMode) {
    ThinkingDisplayMode["Collapsed"] = "collapsed";
    ThinkingDisplayMode["CollapsedPreview"] = "collapsedPreview";
    ThinkingDisplayMode["FixedScrolling"] = "fixedScrolling";
})(ThinkingDisplayMode || (ThinkingDisplayMode = {}));
export var ChatAgentLocation;
(function (ChatAgentLocation) {
    /**
     * This is chat, whether it's in the sidebar, a chat editor, or quick chat.
     * Leaving the values alone as they are in stored data so we don't have to normalize them.
     */
    ChatAgentLocation["Chat"] = "panel";
    ChatAgentLocation["Terminal"] = "terminal";
    ChatAgentLocation["Notebook"] = "notebook";
    /**
     * EditorInline means inline chat in a text editor.
     */
    ChatAgentLocation["EditorInline"] = "editor";
})(ChatAgentLocation || (ChatAgentLocation = {}));
(function (ChatAgentLocation) {
    function fromRaw(value) {
        switch (value) {
            case 'panel': return ChatAgentLocation.Chat;
            case 'terminal': return ChatAgentLocation.Terminal;
            case 'notebook': return ChatAgentLocation.Notebook;
            case 'editor': return ChatAgentLocation.EditorInline;
        }
        return ChatAgentLocation.Chat;
    }
    ChatAgentLocation.fromRaw = fromRaw;
})(ChatAgentLocation || (ChatAgentLocation = {}));
/**
 * List of file schemes that are always unsupported for use in chat
 */
const chatAlwaysUnsupportedFileSchemes = new Set([
    Schemas.vscodeChatEditor,
    Schemas.walkThrough,
    Schemas.vscodeLocalChatSession,
    Schemas.vscodeSettings,
    Schemas.webviewPanel,
    Schemas.vscodeUserData,
    Schemas.extension,
    'ccreq',
    'openai-codex', // Codex session custom editor scheme
]);
export function isSupportedChatFileScheme(accessor, scheme) {
    const chatService = accessor.get(IChatSessionsService);
    // Exclude schemes we always know are bad
    if (chatAlwaysUnsupportedFileSchemes.has(scheme)) {
        return false;
    }
    // Plus any schemes used by content providers
    if (chatService.getContentProviderSchemes().includes(scheme)) {
        return false;
    }
    // Everything else is supported
    return true;
}
/** @deprecated */
export const LEGACY_AGENT_SESSIONS_VIEW_ID = 'workbench.view.chat.sessions'; // TODO@bpasero clear once settled
export const MANAGE_CHAT_COMMAND_ID = 'workbench.action.chat.manage';
export const ChatEditorTitleMaxLength = 30;
export const CHAT_TERMINAL_OUTPUT_MAX_PREVIEW_LINES = 1000;
export const CONTEXT_MODELS_EDITOR = new RawContextKey('inModelsEditor', false);
export const CONTEXT_MODELS_SEARCH_FOCUS = new RawContextKey('inModelsSearch', false);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL2NvbnN0YW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFFaEUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBRXJGLE1BQU0sQ0FBTixJQUFZLGlCQW1CWDtBQW5CRCxXQUFZLGlCQUFpQjtJQUM1Qix3REFBbUMsQ0FBQTtJQUNuQywwREFBcUMsQ0FBQTtJQUNyQywwRUFBcUQsQ0FBQTtJQUNyRCx1REFBa0MsQ0FBQTtJQUNsQyx3RUFBbUQsQ0FBQTtJQUNuRCxzRUFBaUQsQ0FBQTtJQUNqRCxxRUFBZ0QsQ0FBQTtJQUNoRCxtRkFBOEQsQ0FBQTtJQUM5RCxxREFBZ0MsQ0FBQTtJQUNoQyxvRUFBK0MsQ0FBQTtJQUMvQyxpRkFBNEQsQ0FBQTtJQUM1RCwrREFBMEMsQ0FBQTtJQUMxQyxvRUFBK0MsQ0FBQTtJQUMvQywrRkFBMEUsQ0FBQTtJQUMxRSxpRkFBNEQsQ0FBQTtJQUM1RCwyRkFBc0UsQ0FBQTtJQUN0RSxvRkFBK0QsQ0FBQTtJQUMvRCxvRkFBK0QsQ0FBQTtBQUNoRSxDQUFDLEVBbkJXLGlCQUFpQixLQUFqQixpQkFBaUIsUUFtQjVCO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSxZQUlYO0FBSkQsV0FBWSxZQUFZO0lBQ3ZCLDJCQUFXLENBQUE7SUFDWCw2QkFBYSxDQUFBO0lBQ2IsK0JBQWUsQ0FBQTtBQUNoQixDQUFDLEVBSlcsWUFBWSxLQUFaLFlBQVksUUFJdkI7QUFFRCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsSUFBYTtJQUM3QyxR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