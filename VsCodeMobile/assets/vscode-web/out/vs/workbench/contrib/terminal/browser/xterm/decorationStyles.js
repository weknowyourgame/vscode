/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { fromNow, getDurationString } from '../../../../../base/common/date.js';
import { isNumber } from '../../../../../base/common/types.js';
import { localize } from '../../../../../nls.js';
import { terminalDecorationError, terminalDecorationIncomplete, terminalDecorationSuccess } from '../terminalIcons.js';
var DecorationStyles;
(function (DecorationStyles) {
    DecorationStyles[DecorationStyles["DefaultDimension"] = 16] = "DefaultDimension";
    DecorationStyles[DecorationStyles["MarginLeft"] = -17] = "MarginLeft";
})(DecorationStyles || (DecorationStyles = {}));
export var DecorationSelector;
(function (DecorationSelector) {
    DecorationSelector["CommandDecoration"] = "terminal-command-decoration";
    DecorationSelector["Hide"] = "hide";
    DecorationSelector["ErrorColor"] = "error";
    DecorationSelector["DefaultColor"] = "default-color";
    DecorationSelector["Default"] = "default";
    DecorationSelector["Codicon"] = "codicon";
    DecorationSelector["XtermDecoration"] = "xterm-decoration";
    DecorationSelector["OverviewRuler"] = ".xterm-decoration-overview-ruler";
})(DecorationSelector || (DecorationSelector = {}));
export function getTerminalDecorationHoverContent(command, hoverMessage, showCommandActions) {
    let hoverContent = showCommandActions ? `${localize('terminalPromptContextMenu', "Show Command Actions")}\n\n---\n\n` : '';
    if (!command) {
        if (hoverMessage) {
            hoverContent = hoverMessage;
        }
        else {
            return '';
        }
    }
    else if (command.markProperties || hoverMessage) {
        if (command.markProperties?.hoverMessage || hoverMessage) {
            hoverContent = command.markProperties?.hoverMessage || hoverMessage || '';
        }
        else {
            return '';
        }
    }
    else {
        if (isNumber(command.duration)) {
            const durationText = getDurationString(command.duration);
            if (command.exitCode) {
                if (command.exitCode === -1) {
                    hoverContent += localize('terminalPromptCommandFailed.duration', 'Command executed {0}, took {1} and failed', fromNow(command.timestamp, true), durationText);
                }
                else {
                    hoverContent += localize('terminalPromptCommandFailedWithExitCode.duration', 'Command executed {0}, took {1} and failed (Exit Code {2})', fromNow(command.timestamp, true), durationText, command.exitCode);
                }
            }
            else {
                hoverContent += localize('terminalPromptCommandSuccess.duration', 'Command executed {0} and took {1}', fromNow(command.timestamp, true), durationText);
            }
        }
        else {
            if (command.exitCode) {
                if (command.exitCode === -1) {
                    hoverContent += localize('terminalPromptCommandFailed', 'Command executed {0} and failed', fromNow(command.timestamp, true));
                }
                else {
                    hoverContent += localize('terminalPromptCommandFailedWithExitCode', 'Command executed {0} and failed (Exit Code {1})', fromNow(command.timestamp, true), command.exitCode);
                }
            }
            else {
                hoverContent += localize('terminalPromptCommandSuccess', 'Command executed {0} now');
            }
        }
    }
    return hoverContent;
}
export var TerminalCommandDecorationStatus;
(function (TerminalCommandDecorationStatus) {
    TerminalCommandDecorationStatus["Unknown"] = "unknown";
    TerminalCommandDecorationStatus["Running"] = "running";
    TerminalCommandDecorationStatus["Success"] = "success";
    TerminalCommandDecorationStatus["Error"] = "error";
})(TerminalCommandDecorationStatus || (TerminalCommandDecorationStatus = {}));
const unknownText = localize('terminalCommandDecoration.unknown', 'Unknown');
const runningText = localize('terminalCommandDecoration.running', 'Running');
export function getTerminalCommandDecorationTooltip(command, storedState) {
    if (command) {
        return getTerminalDecorationHoverContent(command);
    }
    if (!storedState) {
        return '';
    }
    const timestamp = storedState.timestamp;
    const exitCode = storedState.exitCode;
    const duration = storedState.duration;
    if (typeof timestamp !== 'number' || timestamp === undefined) {
        return '';
    }
    let hoverContent = '';
    const fromNowText = fromNow(timestamp, true);
    if (typeof duration === 'number') {
        const durationText = getDurationString(Math.max(duration, 0));
        if (exitCode) {
            if (exitCode === -1) {
                hoverContent += localize('terminalPromptCommandFailed.duration', 'Command executed {0}, took {1} and failed', fromNowText, durationText);
            }
            else {
                hoverContent += localize('terminalPromptCommandFailedWithExitCode.duration', 'Command executed {0}, took {1} and failed (Exit Code {2})', fromNowText, durationText, exitCode);
            }
        }
        else {
            hoverContent += localize('terminalPromptCommandSuccess.duration', 'Command executed {0} and took {1}', fromNowText, durationText);
        }
    }
    else {
        if (exitCode) {
            if (exitCode === -1) {
                hoverContent += localize('terminalPromptCommandFailed', 'Command executed {0} and failed', fromNowText);
            }
            else {
                hoverContent += localize('terminalPromptCommandFailedWithExitCode', 'Command executed {0} and failed (Exit Code {1})', fromNowText, exitCode);
            }
        }
        else {
            hoverContent += localize('terminalPromptCommandSuccess.', 'Command executed {0} ', fromNowText);
        }
    }
    return hoverContent;
}
export function getTerminalCommandDecorationState(command, storedState, now = Date.now()) {
    let status = "unknown" /* TerminalCommandDecorationStatus.Unknown */;
    const exitCode = command?.exitCode ?? storedState?.exitCode;
    let exitCodeText = unknownText;
    const startTimestamp = command?.timestamp ?? storedState?.timestamp;
    let startText = unknownText;
    let durationMs;
    let durationText = unknownText;
    if (typeof startTimestamp === 'number') {
        startText = new Date(startTimestamp).toLocaleString();
    }
    if (command) {
        if (command.exitCode === undefined) {
            status = "running" /* TerminalCommandDecorationStatus.Running */;
            exitCodeText = runningText;
            durationMs = startTimestamp !== undefined ? Math.max(0, now - startTimestamp) : undefined;
        }
        else if (command.exitCode !== 0) {
            status = "error" /* TerminalCommandDecorationStatus.Error */;
            exitCodeText = String(command.exitCode);
            durationMs = command.duration ?? (startTimestamp !== undefined ? Math.max(0, now - startTimestamp) : undefined);
        }
        else {
            status = "success" /* TerminalCommandDecorationStatus.Success */;
            exitCodeText = String(command.exitCode);
            durationMs = command.duration ?? (startTimestamp !== undefined ? Math.max(0, now - startTimestamp) : undefined);
        }
    }
    else if (storedState) {
        if (storedState.exitCode === undefined) {
            status = "running" /* TerminalCommandDecorationStatus.Running */;
            exitCodeText = runningText;
            durationMs = startTimestamp !== undefined ? Math.max(0, now - startTimestamp) : undefined;
        }
        else if (storedState.exitCode !== 0) {
            status = "error" /* TerminalCommandDecorationStatus.Error */;
            exitCodeText = String(storedState.exitCode);
            durationMs = storedState.duration;
        }
        else {
            status = "success" /* TerminalCommandDecorationStatus.Success */;
            exitCodeText = String(storedState.exitCode);
            durationMs = storedState.duration;
        }
    }
    if (typeof durationMs === 'number') {
        durationText = getDurationString(Math.max(durationMs, 0));
    }
    const classNames = [];
    let icon = terminalDecorationIncomplete;
    switch (status) {
        case "running" /* TerminalCommandDecorationStatus.Running */:
        case "unknown" /* TerminalCommandDecorationStatus.Unknown */:
            classNames.push("default-color" /* DecorationSelector.DefaultColor */, "default" /* DecorationSelector.Default */);
            icon = terminalDecorationIncomplete;
            break;
        case "error" /* TerminalCommandDecorationStatus.Error */:
            classNames.push("error" /* DecorationSelector.ErrorColor */);
            icon = terminalDecorationError;
            break;
        case "success" /* TerminalCommandDecorationStatus.Success */:
            classNames.push('success');
            icon = terminalDecorationSuccess;
            break;
    }
    const hoverMessage = getTerminalCommandDecorationTooltip(command, storedState);
    return {
        status,
        icon,
        classNames,
        exitCode,
        exitCodeText,
        startTimestamp,
        startText,
        duration: durationMs,
        durationText,
        hoverMessage
    };
}
export function updateLayout(configurationService, element) {
    if (!element) {
        return;
    }
    const fontSize = configurationService.inspect("terminal.integrated.fontSize" /* TerminalSettingId.FontSize */).value;
    const defaultFontSize = configurationService.inspect("terminal.integrated.fontSize" /* TerminalSettingId.FontSize */).defaultValue;
    const lineHeight = configurationService.inspect("terminal.integrated.lineHeight" /* TerminalSettingId.LineHeight */).value;
    if (isNumber(fontSize) && isNumber(defaultFontSize) && isNumber(lineHeight)) {
        const scalar = (fontSize / defaultFontSize) <= 1 ? (fontSize / defaultFontSize) : 1;
        // must be inlined to override the inlined styles from xterm
        element.style.width = `${scalar * 16 /* DecorationStyles.DefaultDimension */}px`;
        element.style.height = `${scalar * 16 /* DecorationStyles.DefaultDimension */ * lineHeight}px`;
        element.style.fontSize = `${scalar * 16 /* DecorationStyles.DefaultDimension */}px`;
        element.style.marginLeft = `${scalar * -17 /* DecorationStyles.MarginLeft */}px`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjb3JhdGlvblN0eWxlcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3h0ZXJtL2RlY29yYXRpb25TdHlsZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUUvRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFJakQsT0FBTyxFQUFFLHVCQUF1QixFQUFFLDRCQUE0QixFQUFFLHlCQUF5QixFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFFdkgsSUFBVyxnQkFHVjtBQUhELFdBQVcsZ0JBQWdCO0lBQzFCLGdGQUFxQixDQUFBO0lBQ3JCLHFFQUFnQixDQUFBO0FBQ2pCLENBQUMsRUFIVSxnQkFBZ0IsS0FBaEIsZ0JBQWdCLFFBRzFCO0FBRUQsTUFBTSxDQUFOLElBQWtCLGtCQVNqQjtBQVRELFdBQWtCLGtCQUFrQjtJQUNuQyx1RUFBaUQsQ0FBQTtJQUNqRCxtQ0FBYSxDQUFBO0lBQ2IsMENBQW9CLENBQUE7SUFDcEIsb0RBQThCLENBQUE7SUFDOUIseUNBQW1CLENBQUE7SUFDbkIseUNBQW1CLENBQUE7SUFDbkIsMERBQW9DLENBQUE7SUFDcEMsd0VBQWtELENBQUE7QUFDbkQsQ0FBQyxFQVRpQixrQkFBa0IsS0FBbEIsa0JBQWtCLFFBU25DO0FBRUQsTUFBTSxVQUFVLGlDQUFpQyxDQUFDLE9BQXFDLEVBQUUsWUFBcUIsRUFBRSxrQkFBNEI7SUFDM0ksSUFBSSxZQUFZLEdBQUcsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLDJCQUEyQixFQUFFLHNCQUFzQixDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0lBQzNILElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNkLElBQUksWUFBWSxFQUFFLENBQUM7WUFDbEIsWUFBWSxHQUFHLFlBQVksQ0FBQztRQUM3QixDQUFDO2FBQU0sQ0FBQztZQUNQLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztJQUNGLENBQUM7U0FBTSxJQUFJLE9BQU8sQ0FBQyxjQUFjLElBQUksWUFBWSxFQUFFLENBQUM7UUFDbkQsSUFBSSxPQUFPLENBQUMsY0FBYyxFQUFFLFlBQVksSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUMxRCxZQUFZLEdBQUcsT0FBTyxDQUFDLGNBQWMsRUFBRSxZQUFZLElBQUksWUFBWSxJQUFJLEVBQUUsQ0FBQztRQUMzRSxDQUFDO2FBQU0sQ0FBQztZQUNQLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztJQUNGLENBQUM7U0FBTSxDQUFDO1FBQ1AsSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDaEMsTUFBTSxZQUFZLEdBQUcsaUJBQWlCLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3pELElBQUksT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUN0QixJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDN0IsWUFBWSxJQUFJLFFBQVEsQ0FBQyxzQ0FBc0MsRUFBRSwyQ0FBMkMsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQztnQkFDL0osQ0FBQztxQkFBTSxDQUFDO29CQUNQLFlBQVksSUFBSSxRQUFRLENBQUMsa0RBQWtELEVBQUUsMkRBQTJELEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLEVBQUUsWUFBWSxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDN00sQ0FBQztZQUNGLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxZQUFZLElBQUksUUFBUSxDQUFDLHVDQUF1QyxFQUFFLG1DQUFtQyxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQ3hKLENBQUM7UUFDRixDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUN0QixJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDN0IsWUFBWSxJQUFJLFFBQVEsQ0FBQyw2QkFBNkIsRUFBRSxpQ0FBaUMsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUM5SCxDQUFDO3FCQUFNLENBQUM7b0JBQ1AsWUFBWSxJQUFJLFFBQVEsQ0FBQyx5Q0FBeUMsRUFBRSxpREFBaUQsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQzVLLENBQUM7WUFDRixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsWUFBWSxJQUFJLFFBQVEsQ0FBQyw4QkFBOEIsRUFBRSwwQkFBMEIsQ0FBQyxDQUFDO1lBQ3RGLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUNELE9BQU8sWUFBWSxDQUFDO0FBQ3JCLENBQUM7QUFRRCxNQUFNLENBQU4sSUFBa0IsK0JBS2pCO0FBTEQsV0FBa0IsK0JBQStCO0lBQ2hELHNEQUFtQixDQUFBO0lBQ25CLHNEQUFtQixDQUFBO0lBQ25CLHNEQUFtQixDQUFBO0lBQ25CLGtEQUFlLENBQUE7QUFDaEIsQ0FBQyxFQUxpQiwrQkFBK0IsS0FBL0IsK0JBQStCLFFBS2hEO0FBZUQsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLG1DQUFtQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQzdFLE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxtQ0FBbUMsRUFBRSxTQUFTLENBQUMsQ0FBQztBQUU3RSxNQUFNLFVBQVUsbUNBQW1DLENBQUMsT0FBMEIsRUFBRSxXQUFzRDtJQUNySSxJQUFJLE9BQU8sRUFBRSxDQUFDO1FBQ2IsT0FBTyxpQ0FBaUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBQ0QsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ2xCLE9BQU8sRUFBRSxDQUFDO0lBQ1gsQ0FBQztJQUNELE1BQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUM7SUFDeEMsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQztJQUN0QyxNQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDO0lBQ3RDLElBQUksT0FBTyxTQUFTLEtBQUssUUFBUSxJQUFJLFNBQVMsS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUM5RCxPQUFPLEVBQUUsQ0FBQztJQUNYLENBQUM7SUFDRCxJQUFJLFlBQVksR0FBRyxFQUFFLENBQUM7SUFDdEIsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM3QyxJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQ2xDLE1BQU0sWUFBWSxHQUFHLGlCQUFpQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDOUQsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNkLElBQUksUUFBUSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3JCLFlBQVksSUFBSSxRQUFRLENBQUMsc0NBQXNDLEVBQUUsMkNBQTJDLEVBQUUsV0FBVyxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQzFJLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxZQUFZLElBQUksUUFBUSxDQUFDLGtEQUFrRCxFQUFFLDJEQUEyRCxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDaEwsQ0FBQztRQUNGLENBQUM7YUFBTSxDQUFDO1lBQ1AsWUFBWSxJQUFJLFFBQVEsQ0FBQyx1Q0FBdUMsRUFBRSxtQ0FBbUMsRUFBRSxXQUFXLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDbkksQ0FBQztJQUNGLENBQUM7U0FBTSxDQUFDO1FBQ1AsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNkLElBQUksUUFBUSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3JCLFlBQVksSUFBSSxRQUFRLENBQUMsNkJBQTZCLEVBQUUsaUNBQWlDLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFDekcsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLFlBQVksSUFBSSxRQUFRLENBQUMseUNBQXlDLEVBQUUsaURBQWlELEVBQUUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQy9JLENBQUM7UUFDRixDQUFDO2FBQU0sQ0FBQztZQUNQLFlBQVksSUFBSSxRQUFRLENBQUMsK0JBQStCLEVBQUUsdUJBQXVCLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDakcsQ0FBQztJQUNGLENBQUM7SUFDRCxPQUFPLFlBQVksQ0FBQztBQUNyQixDQUFDO0FBRUQsTUFBTSxVQUFVLGlDQUFpQyxDQUNoRCxPQUFxQyxFQUNyQyxXQUFzRCxFQUN0RCxNQUFjLElBQUksQ0FBQyxHQUFHLEVBQUU7SUFFeEIsSUFBSSxNQUFNLDBEQUEwQyxDQUFDO0lBQ3JELE1BQU0sUUFBUSxHQUF1QixPQUFPLEVBQUUsUUFBUSxJQUFJLFdBQVcsRUFBRSxRQUFRLENBQUM7SUFDaEYsSUFBSSxZQUFZLEdBQUcsV0FBVyxDQUFDO0lBQy9CLE1BQU0sY0FBYyxHQUF1QixPQUFPLEVBQUUsU0FBUyxJQUFJLFdBQVcsRUFBRSxTQUFTLENBQUM7SUFDeEYsSUFBSSxTQUFTLEdBQUcsV0FBVyxDQUFDO0lBQzVCLElBQUksVUFBOEIsQ0FBQztJQUNuQyxJQUFJLFlBQVksR0FBRyxXQUFXLENBQUM7SUFFL0IsSUFBSSxPQUFPLGNBQWMsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUN4QyxTQUFTLEdBQUcsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUM7SUFDdkQsQ0FBQztJQUVELElBQUksT0FBTyxFQUFFLENBQUM7UUFDYixJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDcEMsTUFBTSwwREFBMEMsQ0FBQztZQUNqRCxZQUFZLEdBQUcsV0FBVyxDQUFDO1lBQzNCLFVBQVUsR0FBRyxjQUFjLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxHQUFHLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUMzRixDQUFDO2FBQU0sSUFBSSxPQUFPLENBQUMsUUFBUSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ25DLE1BQU0sc0RBQXdDLENBQUM7WUFDL0MsWUFBWSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDeEMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxRQUFRLElBQUksQ0FBQyxjQUFjLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxHQUFHLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2pILENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSwwREFBMEMsQ0FBQztZQUNqRCxZQUFZLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN4QyxVQUFVLEdBQUcsT0FBTyxDQUFDLFFBQVEsSUFBSSxDQUFDLGNBQWMsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEdBQUcsR0FBRyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDakgsQ0FBQztJQUNGLENBQUM7U0FBTSxJQUFJLFdBQVcsRUFBRSxDQUFDO1FBQ3hCLElBQUksV0FBVyxDQUFDLFFBQVEsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUN4QyxNQUFNLDBEQUEwQyxDQUFDO1lBQ2pELFlBQVksR0FBRyxXQUFXLENBQUM7WUFDM0IsVUFBVSxHQUFHLGNBQWMsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEdBQUcsR0FBRyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQzNGLENBQUM7YUFBTSxJQUFJLFdBQVcsQ0FBQyxRQUFRLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDdkMsTUFBTSxzREFBd0MsQ0FBQztZQUMvQyxZQUFZLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM1QyxVQUFVLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQztRQUNuQyxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sMERBQTBDLENBQUM7WUFDakQsWUFBWSxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDNUMsVUFBVSxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUM7UUFDbkMsQ0FBQztJQUNGLENBQUM7SUFFRCxJQUFJLE9BQU8sVUFBVSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQ3BDLFlBQVksR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzNELENBQUM7SUFFRCxNQUFNLFVBQVUsR0FBYSxFQUFFLENBQUM7SUFDaEMsSUFBSSxJQUFJLEdBQUcsNEJBQTRCLENBQUM7SUFDeEMsUUFBUSxNQUFNLEVBQUUsQ0FBQztRQUNoQiw2REFBNkM7UUFDN0M7WUFDQyxVQUFVLENBQUMsSUFBSSxtR0FBNkQsQ0FBQztZQUM3RSxJQUFJLEdBQUcsNEJBQTRCLENBQUM7WUFDcEMsTUFBTTtRQUNQO1lBQ0MsVUFBVSxDQUFDLElBQUksNkNBQStCLENBQUM7WUFDL0MsSUFBSSxHQUFHLHVCQUF1QixDQUFDO1lBQy9CLE1BQU07UUFDUDtZQUNDLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDM0IsSUFBSSxHQUFHLHlCQUF5QixDQUFDO1lBQ2pDLE1BQU07SUFDUixDQUFDO0lBRUQsTUFBTSxZQUFZLEdBQUcsbUNBQW1DLENBQUMsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBRS9FLE9BQU87UUFDTixNQUFNO1FBQ04sSUFBSTtRQUNKLFVBQVU7UUFDVixRQUFRO1FBQ1IsWUFBWTtRQUNaLGNBQWM7UUFDZCxTQUFTO1FBQ1QsUUFBUSxFQUFFLFVBQVU7UUFDcEIsWUFBWTtRQUNaLFlBQVk7S0FDWixDQUFDO0FBQ0gsQ0FBQztBQUVELE1BQU0sVUFBVSxZQUFZLENBQUMsb0JBQTJDLEVBQUUsT0FBcUI7SUFDOUYsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2QsT0FBTztJQUNSLENBQUM7SUFDRCxNQUFNLFFBQVEsR0FBRyxvQkFBb0IsQ0FBQyxPQUFPLGlFQUE0QixDQUFDLEtBQUssQ0FBQztJQUNoRixNQUFNLGVBQWUsR0FBRyxvQkFBb0IsQ0FBQyxPQUFPLGlFQUE0QixDQUFDLFlBQVksQ0FBQztJQUM5RixNQUFNLFVBQVUsR0FBRyxvQkFBb0IsQ0FBQyxPQUFPLHFFQUE4QixDQUFDLEtBQUssQ0FBQztJQUNwRixJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksUUFBUSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7UUFDN0UsTUFBTSxNQUFNLEdBQUcsQ0FBQyxRQUFRLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BGLDREQUE0RDtRQUM1RCxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLE1BQU0sNkNBQW9DLElBQUksQ0FBQztRQUN4RSxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFHLE1BQU0sNkNBQW9DLEdBQUcsVUFBVSxJQUFJLENBQUM7UUFDdEYsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsR0FBRyxNQUFNLDZDQUFvQyxJQUFJLENBQUM7UUFDM0UsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsR0FBRyxNQUFNLHdDQUE4QixJQUFJLENBQUM7SUFDeEUsQ0FBQztBQUNGLENBQUMifQ==