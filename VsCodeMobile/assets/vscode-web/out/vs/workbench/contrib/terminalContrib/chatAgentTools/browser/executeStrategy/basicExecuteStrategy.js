/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { CancellationError } from '../../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../../base/common/event.js';
import { DisposableStore, MutableDisposable } from '../../../../../../base/common/lifecycle.js';
import { isNumber } from '../../../../../../base/common/types.js';
import { ITerminalLogService } from '../../../../../../platform/terminal/common/terminal.js';
import { trackIdleOnPrompt, waitForIdle } from './executeStrategy.js';
import { setupRecreatingStartMarker } from './strategyHelpers.js';
/**
 * This strategy is used when shell integration is enabled, but rich command detection was not
 * declared by the shell script. This is the large spectrum between rich command detection and no
 * shell integration, here are some problems that are expected:
 *
 * - `133;C` command executed may not happen.
 * - `633;E` comamnd line reporting will likely not happen, so the command line contained in the
 *   execution start and end events will be of low confidence and chances are it will be wrong.
 * - Execution tracking may be incorrect, particularly when `executeCommand` calls are overlapped,
 *   such as Python activating the environment at the same time as Copilot executing a command. So
 *   the end event for the execution may actually correspond to a different command.
 *
 * This strategy focuses on trying to get the most accurate output given these limitations and
 * unknowns. Basically we cannot fully trust the extension APIs in this case, so polling of the data
 * stream is used to detect idling, and we listen to the terminal's data stream instead of the
 * execution's data stream.
 *
 * This is best effort with the goal being the output is accurate, though it may contain some
 * content above and below the command output, such as prompts or even possibly other command
 * output. We lean on the LLM to be able to differentiate the actual output from prompts and bad
 * output when it's not ideal.
 */
let BasicExecuteStrategy = class BasicExecuteStrategy {
    constructor(_instance, _hasReceivedUserInput, _commandDetection, _logService) {
        this._instance = _instance;
        this._hasReceivedUserInput = _hasReceivedUserInput;
        this._commandDetection = _commandDetection;
        this._logService = _logService;
        this.type = 'basic';
        this._startMarker = new MutableDisposable();
        this._onDidCreateStartMarker = new Emitter;
        this.onDidCreateStartMarker = this._onDidCreateStartMarker.event;
    }
    async execute(commandLine, token, commandId) {
        const store = new DisposableStore();
        try {
            const idlePromptPromise = trackIdleOnPrompt(this._instance, 1000, store);
            const onDone = Promise.race([
                Event.toPromise(this._commandDetection.onCommandFinished, store).then(e => {
                    // When shell integration is basic, it means that the end execution event is
                    // often misfired since we don't have command line verification. Because of this
                    // we make sure the prompt is idle after the end execution event happens.
                    this._log('onDone 1 of 2 via end event, waiting for short idle prompt');
                    return idlePromptPromise.then(() => {
                        this._log('onDone 2 of 2 via short idle prompt');
                        return {
                            'type': 'success',
                            command: e
                        };
                    });
                }),
                Event.toPromise(token.onCancellationRequested, store).then(() => {
                    this._log('onDone via cancellation');
                }),
                Event.toPromise(this._instance.onDisposed, store).then(() => {
                    this._log('onDone via terminal disposal');
                    return { type: 'disposal' };
                }),
                // A longer idle prompt event is used here as a catch all for unexpected cases where
                // the end event doesn't fire for some reason.
                trackIdleOnPrompt(this._instance, 3000, store).then(() => {
                    this._log('onDone long idle prompt');
                }),
            ]);
            // Ensure xterm is available
            this._log('Waiting for xterm');
            const xterm = await this._instance.xtermReadyPromise;
            if (!xterm) {
                throw new Error('Xterm is not available');
            }
            // Wait for the terminal to idle before executing the command
            this._log('Waiting for idle');
            await waitForIdle(this._instance.onData, 1000);
            setupRecreatingStartMarker(xterm, this._startMarker, m => this._onDidCreateStartMarker.fire(m), store, this._log.bind(this));
            if (this._hasReceivedUserInput()) {
                this._log('Command timed out, sending SIGINT and retrying');
                // Send SIGINT (Ctrl+C)
                await this._instance.sendText('\x03', false);
                await waitForIdle(this._instance.onData, 100);
            }
            // Execute the command
            // IMPORTANT: This uses `sendText` not `runCommand` since when basic shell integration
            // is used as it's more common to not recognize the prompt input which would result in
            // ^C being sent and also to return the exit code of 130 when from the shell when that
            // occurs.
            this._log(`Executing command line \`${commandLine}\``);
            this._instance.sendText(commandLine, true);
            // Wait for the next end execution event - note that this may not correspond to the actual
            // execution requested
            this._log('Waiting for done event');
            const onDoneResult = await onDone;
            if (onDoneResult && onDoneResult.type === 'disposal') {
                throw new Error('The terminal was closed');
            }
            const finishedCommand = onDoneResult && onDoneResult.type === 'success' ? onDoneResult.command : undefined;
            // Wait for the terminal to idle
            this._log('Waiting for idle');
            await waitForIdle(this._instance.onData, 1000);
            if (token.isCancellationRequested) {
                throw new CancellationError();
            }
            const endMarker = store.add(xterm.raw.registerMarker());
            // Assemble final result
            let output;
            const additionalInformationLines = [];
            if (finishedCommand) {
                const commandOutput = finishedCommand?.getOutput();
                if (commandOutput !== undefined) {
                    this._log('Fetched output via finished command');
                    output = commandOutput;
                }
            }
            if (output === undefined) {
                try {
                    output = xterm.getContentsAsText(this._startMarker.value, endMarker);
                    this._log('Fetched output via markers');
                }
                catch {
                    this._log('Failed to fetch output via markers');
                    additionalInformationLines.push('Failed to retrieve command output');
                }
            }
            if (output !== undefined && output.trim().length === 0) {
                additionalInformationLines.push('Command produced no output');
            }
            const exitCode = finishedCommand?.exitCode;
            if (isNumber(exitCode) && exitCode > 0) {
                additionalInformationLines.push(`Command exited with code ${exitCode}`);
            }
            return {
                output,
                additionalInformation: additionalInformationLines.length > 0 ? additionalInformationLines.join('\n') : undefined,
                exitCode,
            };
        }
        finally {
            store.dispose();
        }
    }
    _log(message) {
        this._logService.debug(`RunInTerminalTool#Basic: ${message}`);
    }
};
BasicExecuteStrategy = __decorate([
    __param(3, ITerminalLogService)
], BasicExecuteStrategy);
export { BasicExecuteStrategy };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzaWNFeGVjdXRlU3RyYXRlZ3kuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL2Jyb3dzZXIvZXhlY3V0ZVN0cmF0ZWd5L2Jhc2ljRXhlY3V0ZVN0cmF0ZWd5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUVsRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUM3RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsV0FBVyxFQUFzRSxNQUFNLHNCQUFzQixDQUFDO0FBRzFJLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBRWxFOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FxQkc7QUFDSSxJQUFNLG9CQUFvQixHQUExQixNQUFNLG9CQUFvQjtJQVFoQyxZQUNrQixTQUE0QixFQUM1QixxQkFBb0MsRUFDcEMsaUJBQThDLEVBQzFDLFdBQWlEO1FBSHJELGNBQVMsR0FBVCxTQUFTLENBQW1CO1FBQzVCLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBZTtRQUNwQyxzQkFBaUIsR0FBakIsaUJBQWlCLENBQTZCO1FBQ3pCLGdCQUFXLEdBQVgsV0FBVyxDQUFxQjtRQVg5RCxTQUFJLEdBQUcsT0FBTyxDQUFDO1FBQ1AsaUJBQVksR0FBRyxJQUFJLGlCQUFpQixFQUFnQixDQUFD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