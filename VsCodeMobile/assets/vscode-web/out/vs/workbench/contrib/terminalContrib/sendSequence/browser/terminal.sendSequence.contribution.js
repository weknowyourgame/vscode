/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Schemas } from '../../../../../base/common/network.js';
import { isIOS, isMacintosh, isWindows } from '../../../../../base/common/platform.js';
import { isObject, isString } from '../../../../../base/common/types.js';
import { localize, localize2 } from '../../../../../nls.js';
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from '../../../../../platform/accessibility/common/accessibility.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { KeybindingsRegistry } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IConfigurationResolverService } from '../../../../services/configurationResolver/common/configurationResolver.js';
import { IHistoryService } from '../../../../services/history/common/history.js';
import { ITerminalService } from '../../../terminal/browser/terminal.js';
import { registerTerminalAction } from '../../../terminal/browser/terminalActions.js';
import { TerminalContextKeys } from '../../../terminal/common/terminalContextKey.js';
export var TerminalSendSequenceCommandId;
(function (TerminalSendSequenceCommandId) {
    TerminalSendSequenceCommandId["SendSequence"] = "workbench.action.terminal.sendSequence";
})(TerminalSendSequenceCommandId || (TerminalSendSequenceCommandId = {}));
function toOptionalString(obj) {
    return isString(obj) ? obj : undefined;
}
export const terminalSendSequenceCommand = async (accessor, args) => {
    const quickInputService = accessor.get(IQuickInputService);
    const configurationResolverService = accessor.get(IConfigurationResolverService);
    const workspaceContextService = accessor.get(IWorkspaceContextService);
    const historyService = accessor.get(IHistoryService);
    const terminalService = accessor.get(ITerminalService);
    const instance = terminalService.activeInstance;
    if (instance) {
        function isTextArg(obj) {
            return isObject(obj) && 'text' in obj;
        }
        let text = isTextArg(args) ? toOptionalString(args.text) : undefined;
        // If no text provided, prompt user for input and process special characters
        if (!text) {
            text = await quickInputService.input({
                value: '',
                placeHolder: 'Enter sequence to send (supports \\n, \\r, \\xAB)',
                prompt: localize('workbench.action.terminal.sendSequence.prompt', "Enter sequence to send to the terminal"),
            });
            if (!text) {
                return;
            }
            // Process escape sequences
            let processedText = text
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r');
            // Process hex escape sequences (\xNN)
            while (true) {
                const match = processedText.match(/\\x([0-9a-fA-F]{2})/);
                if (match === null || match.index === undefined || match.length < 2) {
                    break;
                }
                processedText = processedText.slice(0, match.index) + String.fromCharCode(parseInt(match[1], 16)) + processedText.slice(match.index + 4);
            }
            text = processedText;
        }
        const activeWorkspaceRootUri = historyService.getLastActiveWorkspaceRoot(instance.hasRemoteAuthority ? Schemas.vscodeRemote : Schemas.file);
        const lastActiveWorkspaceRoot = activeWorkspaceRootUri ? workspaceContextService.getWorkspaceFolder(activeWorkspaceRootUri) ?? undefined : undefined;
        const resolvedText = await configurationResolverService.resolveAsync(lastActiveWorkspaceRoot, text);
        instance.sendText(resolvedText, false);
    }
};
const sendSequenceString = localize2('sendSequence', "Send Sequence");
registerTerminalAction({
    id: "workbench.action.terminal.sendSequence" /* TerminalSendSequenceCommandId.SendSequence */,
    title: sendSequenceString,
    f1: true,
    metadata: {
        description: sendSequenceString.value,
        args: [{
                name: 'args',
                schema: {
                    type: 'object',
                    required: ['text'],
                    properties: {
                        text: {
                            description: localize('sendSequence.text.desc', "The sequence of text to send to the terminal"),
                            type: 'string'
                        }
                    },
                }
            }]
    },
    run: (c, accessor, args) => terminalSendSequenceCommand(accessor, args)
});
export function registerSendSequenceKeybinding(text, rule) {
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: "workbench.action.terminal.sendSequence" /* TerminalSendSequenceCommandId.SendSequence */,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: rule.when || TerminalContextKeys.focus,
        primary: rule.primary,
        mac: rule.mac,
        linux: rule.linux,
        win: rule.win,
        handler: terminalSendSequenceCommand,
        args: { text }
    });
}
var Constants;
(function (Constants) {
    /** The text representation of `^<letter>` is `'A'.charCodeAt(0) + 1`. */
    Constants[Constants["CtrlLetterOffset"] = 64] = "CtrlLetterOffset";
})(Constants || (Constants = {}));
// An extra Windows-only ctrl+v keybinding is used for pwsh that sends ctrl+v directly to the
// shell, this gets handled by PSReadLine which properly handles multi-line pastes. This is
// disabled in accessibility mode as PowerShell does not run PSReadLine when it detects a screen
// reader. This works even when clipboard.readText is not supported.
if (isWindows) {
    registerSendSequenceKeybinding(String.fromCharCode('V'.charCodeAt(0) - 64 /* Constants.CtrlLetterOffset */), {
        when: ContextKeyExpr.and(TerminalContextKeys.focus, ContextKeyExpr.equals("terminalShellType" /* TerminalContextKeyStrings.ShellType */, "pwsh" /* GeneralShellType.PowerShell */), CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
        primary: 2048 /* KeyMod.CtrlCmd */ | 52 /* KeyCode.KeyV */
    });
}
// Map certain keybindings in pwsh to unused keys which get handled by PSReadLine handlers in the
// shell integration script. This allows keystrokes that cannot be sent via VT sequences to work.
// See https://github.com/microsoft/terminal/issues/879#issuecomment-497775007
registerSendSequenceKeybinding('\x1b[24~a', {
    when: ContextKeyExpr.and(TerminalContextKeys.focus, ContextKeyExpr.equals("terminalShellType" /* TerminalContextKeyStrings.ShellType */, "pwsh" /* GeneralShellType.PowerShell */), TerminalContextKeys.terminalShellIntegrationEnabled, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
    primary: 2048 /* KeyMod.CtrlCmd */ | 10 /* KeyCode.Space */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 10 /* KeyCode.Space */ }
});
registerSendSequenceKeybinding('\x1b[24~b', {
    when: ContextKeyExpr.and(TerminalContextKeys.focus, ContextKeyExpr.equals("terminalShellType" /* TerminalContextKeyStrings.ShellType */, "pwsh" /* GeneralShellType.PowerShell */), TerminalContextKeys.terminalShellIntegrationEnabled, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
    primary: 512 /* KeyMod.Alt */ | 10 /* KeyCode.Space */
});
registerSendSequenceKeybinding('\x1b[24~c', {
    when: ContextKeyExpr.and(TerminalContextKeys.focus, ContextKeyExpr.equals("terminalShellType" /* TerminalContextKeyStrings.ShellType */, "pwsh" /* GeneralShellType.PowerShell */), TerminalContextKeys.terminalShellIntegrationEnabled, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
    primary: 1024 /* KeyMod.Shift */ | 3 /* KeyCode.Enter */
});
registerSendSequenceKeybinding('\x1b[24~d', {
    when: ContextKeyExpr.and(TerminalContextKeys.focus, ContextKeyExpr.equals("terminalShellType" /* TerminalContextKeyStrings.ShellType */, "pwsh" /* GeneralShellType.PowerShell */), TerminalContextKeys.terminalShellIntegrationEnabled, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
    mac: { primary: 1024 /* KeyMod.Shift */ | 2048 /* KeyMod.CtrlCmd */ | 17 /* KeyCode.RightArrow */ }
});
// Always on pwsh keybindings
registerSendSequenceKeybinding('\x1b[1;2H', {
    when: ContextKeyExpr.and(TerminalContextKeys.focus, ContextKeyExpr.equals("terminalShellType" /* TerminalContextKeyStrings.ShellType */, "pwsh" /* GeneralShellType.PowerShell */)),
    mac: { primary: 1024 /* KeyMod.Shift */ | 2048 /* KeyMod.CtrlCmd */ | 15 /* KeyCode.LeftArrow */ }
});
// Map alt+arrow to ctrl+arrow to allow word navigation in most shells to just work with alt. This
// is non-standard behavior, but a lot of terminals act like this (see
// https://github.com/microsoft/vscode/issues/190629). Note that macOS uses different sequences here
// to get the desired behavior.
registerSendSequenceKeybinding('\x1b[1;5A', {
    when: ContextKeyExpr.and(TerminalContextKeys.focus),
    primary: 512 /* KeyMod.Alt */ | 16 /* KeyCode.UpArrow */
});
registerSendSequenceKeybinding('\x1b[1;5B', {
    when: ContextKeyExpr.and(TerminalContextKeys.focus),
    primary: 512 /* KeyMod.Alt */ | 18 /* KeyCode.DownArrow */
});
registerSendSequenceKeybinding('\x1b' + (isMacintosh ? 'f' : '[1;5C'), {
    when: ContextKeyExpr.and(TerminalContextKeys.focus),
    primary: 512 /* KeyMod.Alt */ | 17 /* KeyCode.RightArrow */
});
registerSendSequenceKeybinding('\x1b' + (isMacintosh ? 'b' : '[1;5D'), {
    when: ContextKeyExpr.and(TerminalContextKeys.focus),
    primary: 512 /* KeyMod.Alt */ | 15 /* KeyCode.LeftArrow */
});
// Map ctrl+alt+r -> ctrl+r when in accessibility mode due to default run recent command keybinding
registerSendSequenceKeybinding('\x12', {
    when: ContextKeyExpr.and(TerminalContextKeys.focus, CONTEXT_ACCESSIBILITY_MODE_ENABLED),
    primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 48 /* KeyCode.KeyR */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 512 /* KeyMod.Alt */ | 48 /* KeyCode.KeyR */ }
});
// Map ctrl+alt+g -> ctrl+g due to default go to recent directory keybinding
registerSendSequenceKeybinding('\x07', {
    when: TerminalContextKeys.focus,
    primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 37 /* KeyCode.KeyG */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 512 /* KeyMod.Alt */ | 37 /* KeyCode.KeyG */ }
});
// send ctrl+c to the iPad when the terminal is focused and ctrl+c is pressed to kill the process (work around for #114009)
if (isIOS) {
    registerSendSequenceKeybinding(String.fromCharCode('C'.charCodeAt(0) - 64 /* Constants.CtrlLetterOffset */), {
        when: ContextKeyExpr.and(TerminalContextKeys.focus),
        primary: 256 /* KeyMod.WinCtrl */ | 33 /* KeyCode.KeyC */
    });
}
// Delete word left: ctrl+w
registerSendSequenceKeybinding(String.fromCharCode('W'.charCodeAt(0) - 64 /* Constants.CtrlLetterOffset */), {
    primary: 2048 /* KeyMod.CtrlCmd */ | 1 /* KeyCode.Backspace */,
    mac: { primary: 512 /* KeyMod.Alt */ | 1 /* KeyCode.Backspace */ }
});
if (isWindows) {
    // Delete word left: ctrl+h
    // Windows cmd.exe requires ^H to delete full word left
    registerSendSequenceKeybinding(String.fromCharCode('H'.charCodeAt(0) - 64 /* Constants.CtrlLetterOffset */), {
        when: ContextKeyExpr.and(TerminalContextKeys.focus, ContextKeyExpr.equals("terminalShellType" /* TerminalContextKeyStrings.ShellType */, "cmd" /* WindowsShellType.CommandPrompt */)),
        primary: 2048 /* KeyMod.CtrlCmd */ | 1 /* KeyCode.Backspace */,
    });
}
// Delete word right: alt+d [27, 100]
registerSendSequenceKeybinding('\u001bd', {
    primary: 2048 /* KeyMod.CtrlCmd */ | 20 /* KeyCode.Delete */,
    mac: { primary: 512 /* KeyMod.Alt */ | 20 /* KeyCode.Delete */ }
});
// Delete to line start: ctrl+u
registerSendSequenceKeybinding('\u0015', {
    mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 1 /* KeyCode.Backspace */ }
});
// Move to line start: ctrl+A
registerSendSequenceKeybinding(String.fromCharCode('A'.charCodeAt(0) - 64), {
    mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 15 /* KeyCode.LeftArrow */ }
});
// Move to line end: ctrl+E
registerSendSequenceKeybinding(String.fromCharCode('E'.charCodeAt(0) - 64), {
    mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 17 /* KeyCode.RightArrow */ }
});
// NUL: ctrl+shift+2
registerSendSequenceKeybinding('\u0000', {
    primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 23 /* KeyCode.Digit2 */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 1024 /* KeyMod.Shift */ | 23 /* KeyCode.Digit2 */ }
});
// RS: ctrl+shift+6
registerSendSequenceKeybinding('\u001e', {
    primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 27 /* KeyCode.Digit6 */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 1024 /* KeyMod.Shift */ | 27 /* KeyCode.Digit6 */ }
});
// US (Undo): ctrl+/
registerSendSequenceKeybinding('\u001f', {
    primary: 2048 /* KeyMod.CtrlCmd */ | 90 /* KeyCode.Slash */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 90 /* KeyCode.Slash */ }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWwuc2VuZFNlcXVlbmNlLmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvc2VuZFNlcXVlbmNlL2Jyb3dzZXIvdGVybWluYWwuc2VuZFNlcXVlbmNlLmNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEUsT0FBTyxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDdkYsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzVELE9BQU8sRUFBRSxrQ0FBa0MsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ25ILE9BQU8sRUFBRSxjQUFjLEVBQTZCLE1BQU0seURBQXlELENBQUM7QUFFcEgsT0FBTyxFQUFFLG1CQUFtQixFQUF1QyxNQUFNLGtFQUFrRSxDQUFDO0FBQzVJLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBRTdGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLDRFQUE0RSxDQUFDO0FBQzNILE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNqRixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUN0RixPQUFPLEVBQUUsbUJBQW1CLEVBQTZCLE1B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