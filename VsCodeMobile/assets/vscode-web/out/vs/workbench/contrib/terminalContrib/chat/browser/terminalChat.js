/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../../nls.js';
import { MenuId } from '../../../../../platform/actions/common/actions.js';
import { RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';
export var TerminalChatCommandId;
(function (TerminalChatCommandId) {
    TerminalChatCommandId["Start"] = "workbench.action.terminal.chat.start";
    TerminalChatCommandId["Close"] = "workbench.action.terminal.chat.close";
    TerminalChatCommandId["MakeRequest"] = "workbench.action.terminal.chat.makeRequest";
    TerminalChatCommandId["Cancel"] = "workbench.action.terminal.chat.cancel";
    TerminalChatCommandId["RunCommand"] = "workbench.action.terminal.chat.runCommand";
    TerminalChatCommandId["RunFirstCommand"] = "workbench.action.terminal.chat.runFirstCommand";
    TerminalChatCommandId["InsertCommand"] = "workbench.action.terminal.chat.insertCommand";
    TerminalChatCommandId["InsertFirstCommand"] = "workbench.action.terminal.chat.insertFirstCommand";
    TerminalChatCommandId["ViewInChat"] = "workbench.action.terminal.chat.viewInChat";
    TerminalChatCommandId["RerunRequest"] = "workbench.action.terminal.chat.rerunRequest";
    TerminalChatCommandId["ViewHiddenChatTerminals"] = "workbench.action.terminal.chat.viewHiddenChatTerminals";
    TerminalChatCommandId["OpenTerminalSettingsLink"] = "workbench.action.terminal.chat.openTerminalSettingsLink";
    TerminalChatCommandId["DisableSessionAutoApproval"] = "workbench.action.terminal.chat.disableSessionAutoApproval";
    TerminalChatCommandId["FocusMostRecentChatTerminalOutput"] = "workbench.action.terminal.chat.focusMostRecentChatTerminalOutput";
    TerminalChatCommandId["FocusMostRecentChatTerminal"] = "workbench.action.terminal.chat.focusMostRecentChatTerminal";
    TerminalChatCommandId["ToggleChatTerminalOutput"] = "workbench.action.terminal.chat.toggleChatTerminalOutput";
    TerminalChatCommandId["FocusChatInstanceAction"] = "workbench.action.terminal.chat.focusChatInstance";
})(TerminalChatCommandId || (TerminalChatCommandId = {}));
export const MENU_TERMINAL_CHAT_WIDGET_INPUT_SIDE_TOOLBAR = MenuId.for('terminalChatWidget');
export const MENU_TERMINAL_CHAT_WIDGET_STATUS = MenuId.for('terminalChatWidget.status');
export const MENU_TERMINAL_CHAT_WIDGET_TOOLBAR = MenuId.for('terminalChatWidget.toolbar');
export var TerminalChatContextKeyStrings;
(function (TerminalChatContextKeyStrings) {
    TerminalChatContextKeyStrings["ChatFocus"] = "terminalChatFocus";
    TerminalChatContextKeyStrings["ChatVisible"] = "terminalChatVisible";
    TerminalChatContextKeyStrings["ChatActiveRequest"] = "terminalChatActiveRequest";
    TerminalChatContextKeyStrings["ChatInputHasText"] = "terminalChatInputHasText";
    TerminalChatContextKeyStrings["ChatAgentRegistered"] = "terminalChatAgentRegistered";
    TerminalChatContextKeyStrings["ChatResponseEditorFocused"] = "terminalChatResponseEditorFocused";
    TerminalChatContextKeyStrings["ChatResponseContainsCodeBlock"] = "terminalChatResponseContainsCodeBlock";
    TerminalChatContextKeyStrings["ChatResponseContainsMultipleCodeBlocks"] = "terminalChatResponseContainsMultipleCodeBlocks";
    TerminalChatContextKeyStrings["ChatResponseSupportsIssueReporting"] = "terminalChatResponseSupportsIssueReporting";
    TerminalChatContextKeyStrings["ChatSessionResponseVote"] = "terminalChatSessionResponseVote";
    TerminalChatContextKeyStrings["ChatHasTerminals"] = "hasChatTerminals";
    TerminalChatContextKeyStrings["ChatHasHiddenTerminals"] = "hasHiddenChatTerminals";
})(TerminalChatContextKeyStrings || (TerminalChatContextKeyStrings = {}));
export var TerminalChatContextKeys;
(function (TerminalChatContextKeys) {
    /** Whether the chat widget is focused */
    TerminalChatContextKeys.focused = new RawContextKey("terminalChatFocus" /* TerminalChatContextKeyStrings.ChatFocus */, false, localize('chatFocusedContextKey', "Whether the chat view is focused."));
    /** Whether the chat widget is visible */
    TerminalChatContextKeys.visible = new RawContextKey("terminalChatVisible" /* TerminalChatContextKeyStrings.ChatVisible */, false, localize('chatVisibleContextKey', "Whether the chat view is visible."));
    /** Whether there is an active chat request */
    TerminalChatContextKeys.requestActive = new RawContextKey("terminalChatActiveRequest" /* TerminalChatContextKeyStrings.ChatActiveRequest */, false, localize('chatRequestActiveContextKey', "Whether there is an active chat request."));
    /** Whether the chat input has text */
    TerminalChatContextKeys.inputHasText = new RawContextKey("terminalChatInputHasText" /* TerminalChatContextKeyStrings.ChatInputHasText */, false, localize('chatInputHasTextContextKey', "Whether the chat input has text."));
    /** The chat response contains at least one code block */
    TerminalChatContextKeys.responseContainsCodeBlock = new RawContextKey("terminalChatResponseContainsCodeBlock" /* TerminalChatContextKeyStrings.ChatResponseContainsCodeBlock */, false, localize('chatResponseContainsCodeBlockContextKey', "Whether the chat response contains a code block."));
    /** The chat response contains multiple code blocks */
    TerminalChatContextKeys.responseContainsMultipleCodeBlocks = new RawContextKey("terminalChatResponseContainsMultipleCodeBlocks" /* TerminalChatContextKeyStrings.ChatResponseContainsMultipleCodeBlocks */, false, localize('chatResponseContainsMultipleCodeBlocksContextKey', "Whether the chat response contains multiple code blocks."));
    /** A chat agent exists for the terminal location */
    TerminalChatContextKeys.hasChatAgent = new RawContextKey("terminalChatAgentRegistered" /* TerminalChatContextKeyStrings.ChatAgentRegistered */, false, localize('chatAgentRegisteredContextKey', "Whether a chat agent is registered for the terminal location."));
    /** Has terminals created via chat */
    TerminalChatContextKeys.hasChatTerminals = new RawContextKey("hasChatTerminals" /* TerminalChatContextKeyStrings.ChatHasTerminals */, false, localize('terminalHasChatTerminals', "Whether there are any chat terminals."));
    /** Has hidden chat terminals */
    TerminalChatContextKeys.hasHiddenChatTerminals = new RawContextKey("hasHiddenChatTerminals" /* TerminalChatContextKeyStrings.ChatHasHiddenTerminals */, false, localize('terminalHasHiddenChatTerminals', "Whether there are any hidden chat terminals."));
})(TerminalChatContextKeys || (TerminalChatContextKeys = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDaGF0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9jaGF0L2Jyb3dzZXIvdGVybWluYWxDaGF0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDM0UsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBRXhGLE1BQU0sQ0FBTixJQUFrQixxQkFrQmpCO0FBbEJELFdBQWtCLHFCQUFxQjtJQUN0Qyx1RUFBOEMsQ0FBQTtJQUM5Qyx1RUFBOEMsQ0FBQTtJQUM5QyxtRkFBMEQsQ0FBQTtJQUMxRCx5RUFBZ0QsQ0FBQTtJQUNoRCxpRkFBd0QsQ0FBQTtJQUN4RCwyRkFBa0UsQ0FBQTtJQUNsRSx1RkFBOEQsQ0FBQTtJQUM5RCxpR0FBd0UsQ0FBQTtJQUN4RSxpRkFBd0QsQ0FBQTtJQUN4RCxxRkFBNEQsQ0FBQTtJQUM1RCwyR0FBa0YsQ0FBQTtJQUNsRiw2R0FBb0YsQ0FBQTtJQUNwRixpSEFBd0YsQ0FBQTtJQUN4RiwrSEFBc0csQ0FBQTtJQUN0RyxtSEFBMEYsQ0FBQTtJQUMxRiw2R0FBb0YsQ0FBQTtJQUNwRixxR0FBNEUsQ0FBQTtBQUM3RSxDQUFDLEVBbEJpQixxQkFBcUIsS0FBckIscUJBQXFCLFFBa0J0QztBQUVELE1BQU0sQ0FBQyxNQUFNLDRDQUE0QyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQztBQUM3RixNQUFNLENBQUMsTUFBTSxnQ0FBZ0MsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLDJCQUEyQixDQUFDLENBQUM7QUFDeEYsTUFBTSxDQUFDLE1BQU0saUNBQWlDLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBRTFGLE1BQU0sQ0FBTixJQUFrQiw2QkFhakI7QUFiRCxXQUFrQiw2QkFBNkI7SUFDOUMsZ0VBQStCLENBQUE7SUFDL0Isb0VBQW1DLENBQUE7SUFDbkMsZ0ZBQStDLENBQUE7SUFDL0MsOEVBQTZDLENBQUE7SUFDN0Msb0ZBQW1ELENBQUE7SUFDbkQsZ0dBQStELENBQUE7SUFDL0Qsd0dBQXVFLENBQUE7SUFDdkUsMEhBQXlGLENBQUE7SUFDekYsa0hBQWlGLENBQUE7SUFDakYsNEZBQTJELENBQUE7SUFDM0Qsc0VBQXFDLENBQUE7SUFDckMsa0ZBQWlELENBQUE7QUFDbEQsQ0FBQyxFQWJpQiw2QkFBNkIsS0FBN0IsNkJBQTZCLFFBYTlDO0FBR0QsTUFBTSxLQUFXLHVCQUF1QixDQTRCdkM7QUE1QkQsV0FBaUIsdUJBQXVCO0lBRXZDLHlDQUF5QztJQUM1QiwrQkFBTyxHQUFHLElBQUksYUFBYSxvRUFBbUQsS0FBSyxFQUFFLFFBQVEsQ0FBQyx1QkFBdUIsRUFBRSxtQ0FBbUMsQ0FBQyxDQUFDLENBQUM7SUFFMUsseUNBQXlDO0lBQzVCLCtCQUFPLEdBQUcsSUFBSSxhQUFhLHdFQUFxRCxLQUFLLEVBQUUsUUFBUSxDQUFDLHVCQUF1QixFQUFFLG1DQUFtQyxDQUFDLENBQUMsQ0FBQztJQUU1Syw4Q0FBOEM7SUFDakMscUNBQWEsR0FBRyxJQUFJLGFBQWEsb0ZBQTJELEtBQUssRUFBRSxRQUFRLENBQUMsNkJBQTZCLEVBQUUsMENBQTBDLENBQUMsQ0FBQyxDQUFDO0lBRXJNLHNDQUFzQztJQUN6QixvQ0FBWSxHQUFHLElBQUksYUFBYSxrRkFBMEQsS0FBSyxFQUFFLFFBQVEsQ0FBQyw0QkFBNEIsRUFBRSxrQ0FBa0MsQ0FBQyxDQUFDLENBQUM7SUFFMUwseURBQXlEO0lBQzVDLGlEQUF5QixHQUFHLElBQUksYUFBYSw0R0FBdUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyx5Q0FBeUMsRUFBRSxrREFBa0QsQ0FBQyxDQUFDLENBQUM7SUFFalAsc0RBQXNEO0lBQ3pDLDBEQUFrQyxHQUFHLElBQUksYUFBYSw4SEFBZ0YsS0FBSyxFQUFFLFFBQVEsQ0FBQyxrREFBa0QsRUFBRSwwREFBMEQsQ0FBQyxDQUFDLENBQUM7SUFFcFIsb0RBQW9EO0lBQ3ZDLG9DQUFZLEdBQUcsSUFBSSxhQUFhLHdGQUE2RCxLQUFLLEVBQUUsUUFBUSxDQUFDLCtCQUErQixFQUFFLCtEQUErRCxDQUFDLENBQUMsQ0FBQztJQUU3TixxQ0FBcUM7SUFDeEIsd0NBQWdCLEdBQUcsSUFBSSxhQUFhLDBFQUEwRCxLQUFLLEVBQUUsUUFBUSxDQUFDLDBCQUEwQixFQUFFLHVDQUF1QyxDQUFDLENBQUMsQ0FBQztJQUVqTSxnQ0FBZ0M7SUFDbkIsOENBQXNCLEdBQUcsSUFBSSxhQUFhLHNGQUFnRSxLQUFLLEVBQUUsUUFBUSxDQUFDLGdDQUFnQyxFQUFFLDhDQUE4QyxDQUFDLENBQUMsQ0FBQztBQUMzTixDQUFDLEVBNUJnQix1QkFBdUIsS0FBdkIsdUJBQXVCLFFBNEJ2QyJ9