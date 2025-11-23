/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isWindows } from '../../../../../base/common/platform.js';
import { isObject, isString } from '../../../../../base/common/types.js';
import { localize, localize2 } from '../../../../../nls.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { registerTerminalAction } from '../../../terminal/browser/terminalActions.js';
export var TerminalSendSignalCommandId;
(function (TerminalSendSignalCommandId) {
    TerminalSendSignalCommandId["SendSignal"] = "workbench.action.terminal.sendSignal";
})(TerminalSendSignalCommandId || (TerminalSendSignalCommandId = {}));
function toOptionalString(obj) {
    return isString(obj) ? obj : undefined;
}
const sendSignalString = localize2('sendSignal', "Send Signal");
registerTerminalAction({
    id: "workbench.action.terminal.sendSignal" /* TerminalSendSignalCommandId.SendSignal */,
    title: sendSignalString,
    f1: !isWindows,
    metadata: {
        description: sendSignalString.value,
        args: [{
                name: 'args',
                schema: {
                    type: 'object',
                    required: ['signal'],
                    properties: {
                        signal: {
                            description: localize('sendSignal.signal.desc', "The signal to send to the terminal process (e.g., 'SIGTERM', 'SIGINT', 'SIGKILL')"),
                            type: 'string'
                        }
                    },
                }
            }]
    },
    run: async (c, accessor, args) => {
        const quickInputService = accessor.get(IQuickInputService);
        const instance = c.service.activeInstance;
        if (!instance) {
            return;
        }
        function isSignalArg(obj) {
            return isObject(obj) && 'signal' in obj;
        }
        let signal = isSignalArg(args) ? toOptionalString(args.signal) : undefined;
        if (!signal) {
            const signalOptions = [
                { label: 'SIGINT', description: localize('SIGINT', 'Interrupt process (Ctrl+C)') },
                { label: 'SIGTERM', description: localize('SIGTERM', 'Terminate process gracefully') },
                { label: 'SIGKILL', description: localize('SIGKILL', 'Force kill process') },
                { label: 'SIGSTOP', description: localize('SIGSTOP', 'Stop process') },
                { label: 'SIGCONT', description: localize('SIGCONT', 'Continue process') },
                { label: 'SIGHUP', description: localize('SIGHUP', 'Hangup') },
                { label: 'SIGQUIT', description: localize('SIGQUIT', 'Quit process') },
                { label: 'SIGUSR1', description: localize('SIGUSR1', 'User-defined signal 1') },
                { label: 'SIGUSR2', description: localize('SIGUSR2', 'User-defined signal 2') },
                { type: 'separator' },
                { label: localize('manualSignal', 'Manually enter signal') }
            ];
            const selected = await quickInputService.pick(signalOptions, {
                placeHolder: localize('selectSignal', 'Select signal to send to terminal process')
            });
            if (!selected) {
                return;
            }
            if (selected.label === localize('manualSignal', 'Manually enter signal')) {
                const inputSignal = await quickInputService.input({
                    prompt: localize('enterSignal', 'Enter signal name (e.g., SIGTERM, SIGKILL)'),
                });
                if (!inputSignal) {
                    return;
                }
                signal = inputSignal;
            }
            else {
                signal = selected.label;
            }
        }
        await instance.sendSignal(signal);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWwuc2VuZFNpZ25hbC5jb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL3NlbmRTaWduYWwvYnJvd3Nlci90ZXJtaW5hbC5zZW5kU2lnbmFsLmNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbkUsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzVELE9BQU8sRUFBRSxrQkFBa0IsRUFBc0IsTUFBTSx5REFBeUQsQ0FBQztBQUNqSCxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUV0RixNQUFNLENBQU4sSUFBa0IsMkJBRWpCO0FBRkQsV0FBa0IsMkJBQTJCO0lBQzVDLGtGQUFtRCxDQUFBO0FBQ3BELENBQUMsRUFGaUIsMkJBQTJCLEtBQTNCLDJCQUEyQixRQUU1QztBQUVELFNBQVMsZ0JBQWdCLENBQUMsR0FBWTtJQUNyQyxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDeEMsQ0FBQztBQUVELE1BQU0sZ0JBQWdCLEdBQUcsU0FBUyxDQUFDLFlBQVksRUFBRSxhQUFhLENBQUMsQ0FBQztBQUNoRSxzQkFBc0IsQ0FBQztJQUN0QixFQUFFLHFGQUF3QztJQUMxQyxLQUFLLEVBQUUsZ0JBQWdCO0lBQ3ZCLEVBQUUsRUFBRSxDQUFDLFNBQVM7SUFDZCxRQUFRLEVBQUU7UUFDVCxXQUFXLEVBQUUsZ0JBQWdCLENBQUMsS0FBSztR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