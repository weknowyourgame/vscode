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
import { trackIdleOnPrompt } from './executeStrategy.js';
import { setupRecreatingStartMarker } from './strategyHelpers.js';
/**
 * This strategy is used when the terminal has rich shell integration/command detection is
 * available, meaning every sequence we rely upon should be exactly where we expect it to be. In
 * particular (`633;`) `A, B, E, C, D` all happen in exactly that order. While things still could go
 * wrong in this state, minimal verification is done in this mode since rich command detection is a
 * strong signal that it's behaving correctly.
 */
let RichExecuteStrategy = class RichExecuteStrategy {
    constructor(_instance, _commandDetection, _logService) {
        this._instance = _instance;
        this._commandDetection = _commandDetection;
        this._logService = _logService;
        this.type = 'rich';
        this._startMarker = new MutableDisposable();
        this._onDidCreateStartMarker = new Emitter;
        this.onDidCreateStartMarker = this._onDidCreateStartMarker.event;
    }
    async execute(commandLine, token, commandId) {
        const store = new DisposableStore();
        try {
            // Ensure xterm is available
            this._log('Waiting for xterm');
            const xterm = await this._instance.xtermReadyPromise;
            if (!xterm) {
                throw new Error('Xterm is not available');
            }
            const onDone = Promise.race([
                Event.toPromise(this._commandDetection.onCommandFinished, store).then(e => {
                    this._log('onDone via end event');
                    return {
                        'type': 'success',
                        command: e
                    };
                }),
                Event.toPromise(token.onCancellationRequested, store).then(() => {
                    this._log('onDone via cancellation');
                }),
                Event.toPromise(this._instance.onDisposed, store).then(() => {
                    this._log('onDone via terminal disposal');
                    return { type: 'disposal' };
                }),
                trackIdleOnPrompt(this._instance, 1000, store).then(() => {
                    this._log('onDone via idle prompt');
                }),
            ]);
            setupRecreatingStartMarker(xterm, this._startMarker, m => this._onDidCreateStartMarker.fire(m), store, this._log.bind(this));
            // Execute the command
            this._log(`Executing command line \`${commandLine}\``);
            this._instance.runCommand(commandLine, true, commandId);
            // Wait for the terminal to idle
            this._log('Waiting for done event');
            const onDoneResult = await onDone;
            if (onDoneResult && onDoneResult.type === 'disposal') {
                throw new Error('The terminal was closed');
            }
            const finishedCommand = onDoneResult && onDoneResult.type === 'success' ? onDoneResult.command : undefined;
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
        this._logService.debug(`RunInTerminalTool#Rich: ${message}`);
    }
};
RichExecuteStrategy = __decorate([
    __param(2, ITerminalLogService)
], RichExecuteStrategy);
export { RichExecuteStrategy };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmljaEV4ZWN1dGVTdHJhdGVneS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvY2hhdEFnZW50VG9vbHMvYnJvd3Nlci9leGVjdXRlU3RyYXRlZ3kvcmljaEV4ZWN1dGVTdHJhdGVneS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFbEUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFFN0YsT0FBTyxFQUFFLGlCQUFpQixFQUFzRSxNQUFNLHNCQUFzQixDQUFDO0FBRTdILE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBRWxFOzs7Ozs7R0FNRztBQUNJLElBQU0sbUJBQW1CLEdBQXpCLE1BQU0sbUJBQW1CO0lBTy9CLFlBQ2tCLFNBQTRCLEVBQzVCLGlCQUE4QyxFQUMxQyxXQUFpRDtRQUZyRCxjQUFTLEdBQVQsU0FBUyxDQUFtQjtRQUM1QixzQkFBaUIsR0FBakIsaUJBQWlCLENBQTZCO1FBQ3pCLGdCQUFXLEdBQVgsV0FBVyxDQUFxQjtRQVQ5RCxTQUFJLEdBQUcsTUFBTSxDQUFDO1FBQ04saUJBQVksR0FBRyxJQUFJLGlCQUFpQixFQUFnQixDQUFDO1FBRXJELDRCQUF1QixHQUFHLElBQUksT0FBaUMsQ0FBQztRQUMxRSwyQkFBc0IsR0FBb0MsSUFBSSxDQUFDLHVCQUF1QixD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