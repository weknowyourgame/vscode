/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { defaultTerminalAccessibilityCommandsToSkipShell } from '../terminalContrib/accessibility/common/terminal.accessibility.js';
import { terminalAccessibilityConfiguration } from '../terminalContrib/accessibility/common/terminalAccessibilityConfiguration.js';
import { terminalAutoRepliesConfiguration } from '../terminalContrib/autoReplies/common/terminalAutoRepliesConfiguration.js';
import { terminalInitialHintConfiguration } from '../terminalContrib/chat/common/terminalInitialHintConfiguration.js';
import { terminalChatAgentToolsConfiguration } from '../terminalContrib/chatAgentTools/common/terminalChatAgentToolsConfiguration.js';
import { terminalCommandGuideConfiguration } from '../terminalContrib/commandGuide/common/terminalCommandGuideConfiguration.js';
import { defaultTerminalFindCommandToSkipShell } from '../terminalContrib/find/common/terminal.find.js';
import { defaultTerminalHistoryCommandsToSkipShell, terminalHistoryConfiguration } from '../terminalContrib/history/common/terminal.history.js';
import { terminalStickyScrollConfiguration } from '../terminalContrib/stickyScroll/common/terminalStickyScrollConfiguration.js';
import { defaultTerminalSuggestCommandsToSkipShell } from '../terminalContrib/suggest/common/terminal.suggest.js';
import { terminalSuggestConfiguration } from '../terminalContrib/suggest/common/terminalSuggestConfiguration.js';
import { terminalTypeAheadConfiguration } from '../terminalContrib/typeAhead/common/terminalTypeAheadConfiguration.js';
import { terminalZoomConfiguration } from '../terminalContrib/zoom/common/terminal.zoom.js';
// HACK: Export some commands from `terminalContrib/` that are depended upon elsewhere. These are
// soft layer breakers between `terminal/` and `terminalContrib/` but there are difficulties in
// removing the dependency. These are explicitly defined here to avoid an eslint line override.
export var TerminalContribCommandId;
(function (TerminalContribCommandId) {
    TerminalContribCommandId["A11yFocusAccessibleBuffer"] = "workbench.action.terminal.focusAccessibleBuffer";
    TerminalContribCommandId["DeveloperRestartPtyHost"] = "workbench.action.terminal.restartPtyHost";
    TerminalContribCommandId["OpenTerminalSettingsLink"] = "workbench.action.terminal.chat.openTerminalSettingsLink";
    TerminalContribCommandId["DisableSessionAutoApproval"] = "workbench.action.terminal.chat.disableSessionAutoApproval";
    TerminalContribCommandId["FocusMostRecentChatTerminalOutput"] = "workbench.action.terminal.chat.focusMostRecentChatTerminalOutput";
    TerminalContribCommandId["FocusMostRecentChatTerminal"] = "workbench.action.terminal.chat.focusMostRecentChatTerminal";
    TerminalContribCommandId["ToggleChatTerminalOutput"] = "workbench.action.terminal.chat.toggleChatTerminalOutput";
    TerminalContribCommandId["FocusChatInstanceAction"] = "workbench.action.terminal.chat.focusChatInstance";
})(TerminalContribCommandId || (TerminalContribCommandId = {}));
// HACK: Export some settings from `terminalContrib/` that are depended upon elsewhere. These are
// soft layer breakers between `terminal/` and `terminalContrib/` but there are difficulties in
// removing the dependency. These are explicitly defined here to avoid an eslint line override.
export var TerminalContribSettingId;
(function (TerminalContribSettingId) {
    TerminalContribSettingId["StickyScrollEnabled"] = "terminal.integrated.stickyScroll.enabled";
    TerminalContribSettingId["SuggestEnabled"] = "terminal.integrated.suggest.enabled";
    TerminalContribSettingId["AutoApprove"] = "chat.tools.terminal.autoApprove";
    TerminalContribSettingId["EnableAutoApprove"] = "chat.tools.terminal.enableAutoApprove";
    TerminalContribSettingId["ShellIntegrationTimeout"] = "chat.tools.terminal.shellIntegrationTimeout";
    TerminalContribSettingId["OutputLocation"] = "chat.tools.terminal.outputLocation";
})(TerminalContribSettingId || (TerminalContribSettingId = {}));
// Export configuration schemes from terminalContrib - this is an exception to the eslint rule since
// they need to be declared at part of the rest of the terminal configuration
export const terminalContribConfiguration = {
    ...terminalAccessibilityConfiguration,
    ...terminalAutoRepliesConfiguration,
    ...terminalChatAgentToolsConfiguration,
    ...terminalInitialHintConfiguration,
    ...terminalCommandGuideConfiguration,
    ...terminalHistoryConfiguration,
    ...terminalStickyScrollConfiguration,
    ...terminalSuggestConfiguration,
    ...terminalTypeAheadConfiguration,
    ...terminalZoomConfiguration,
};
// Export commands to skip shell from terminalContrib - this is an exception to the eslint rule
// since they need to be included in the terminal module
export const defaultTerminalContribCommandsToSkipShell = [
    ...defaultTerminalAccessibilityCommandsToSkipShell,
    ...defaultTerminalFindCommandToSkipShell,
    ...defaultTerminalHistoryCommandsToSkipShell,
    ...defaultTerminalSuggestCommandsToSkipShell,
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDb250cmliRXhwb3J0cy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXJtaW5hbENvbnRyaWJFeHBvcnRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBa0MsK0NBQStDLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUNwSyxPQUFPLEVBQUUsa0NBQWtDLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUNuSSxPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSwyRUFBMkUsQ0FBQztBQUU3SCxPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSxvRUFBb0UsQ0FBQztBQUN0SCxPQUFPLEVBQUUsbUNBQW1DLEVBQW1DLE1BQU0saUZBQWlGLENBQUM7QUFDdkssT0FBTyxFQUFFLGlDQUFpQyxFQUFFLE1BQU0sNkVBQTZFLENBQUM7QUFFaEksT0FBTyxFQUFFLHFDQUFxQyxFQUFFLE1BQU0saURBQWlELENBQUM7QUFDeEcsT0FBTyxFQUFFLHlDQUF5QyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDaEosT0FBTyxFQUFpQyxpQ0FBaUMsRUFBRSxNQUFNLDZFQUE2RSxDQUFDO0FBQy9KLE9BQU8sRUFBRSx5Q0FBeUMsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ2xILE9BQU8sRUFBNEIsNEJBQTRCLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUMzSSxPQUFPLEVBQUUsOEJBQThCLEVBQUUsTUFBTSx1RUFBdUUsQ0FBQztBQUN2SCxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUU1RixpR0FBaUc7QUFDakcsK0ZBQStGO0FBQy9GLCtGQUErRjtBQUMvRixNQUFNLENBQU4sSUFBa0Isd0JBU2pCO0FBVEQsV0FBa0Isd0JBQXdCO0lBQ3pDLHlHQUFnRixDQUFBO0lBQ2hGLGdHQUFtRSxDQUFBO0lBQ25FLGdIQUF5RSxDQUFBO0lBQ3pFLG9IQUE2RSxDQUFBO0lBQzdFLGtJQUEyRixDQUFBO0lBQzNGLHNIQUErRSxDQUFBO0lBQy9FLGdIQUF5RSxDQUFBO0lBQ3pFLHdHQUF1RSxDQUFBO0FBQ3hFLENBQUMsRUFUaUIsd0JBQXdCLEtBQXhCLHdCQUF3QixRQVN6QztBQUVELGlHQUFpRztBQUNqRywrRkFBK0Y7QUFDL0YsK0ZBQStGO0FBQy9GLE1BQU0sQ0FBTixJQUFrQix3QkFPakI7QUFQRCxXQUFrQix3QkFBd0I7SUFDekMsNEZBQTJELENBQUE7SUFDM0Qsa0ZBQWlELENBQUE7SUFDakQsMkVBQXlELENBQUE7SUFDekQsdUZBQXFFLENBQUE7SUFDckUsbUdBQWlGLENBQUE7SUFDakYsaUZBQStELENBQUE7QUFDaEUsQ0FBQyxFQVBpQix3QkFBd0IsS0FBeEIsd0JBQXdCLFFBT3pDO0FBRUQsb0dBQW9HO0FBQ3BHLDZFQUE2RTtBQUM3RSxNQUFNLENBQUMsTUFBTSw0QkFBNEIsR0FBcUM7SUFDN0UsR0FBRyxrQ0FBa0M7SUFDckMsR0FBRyxnQ0FBZ0M7SUFDbkMsR0FBRyxtQ0FBbUM7SUFDdEMsR0FBRyxnQ0FBZ0M7SUFDbkMsR0FBRyxpQ0FBaUM7SUFDcEMsR0FBRyw0QkFBNEI7SUFDL0IsR0FBRyxpQ0FBaUM7SUFDcEMsR0FBRyw0QkFBNEI7SUFDL0IsR0FBRyw4QkFBOEI7SUFDakMsR0FBRyx5QkFBeUI7Q0FDNUIsQ0FBQztBQUVGLCtGQUErRjtBQUMvRix3REFBd0Q7QUFDeEQsTUFBTSxDQUFDLE1BQU0seUNBQXlDLEdBQUc7SUFDeEQsR0FBRywrQ0FBK0M7SUFDbEQsR0FBRyxxQ0FBcUM7SUFDeEMsR0FBRyx5Q0FBeUM7SUFDNUMsR0FBRyx5Q0FBeUM7Q0FDNUMsQ0FBQyJ9