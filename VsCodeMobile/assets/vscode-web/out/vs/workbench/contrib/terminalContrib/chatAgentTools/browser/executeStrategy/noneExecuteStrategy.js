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
import { Emitter } from '../../../../../../base/common/event.js';
import { DisposableStore, MutableDisposable } from '../../../../../../base/common/lifecycle.js';
import { ITerminalLogService } from '../../../../../../platform/terminal/common/terminal.js';
import { waitForIdle, waitForIdleWithPromptHeuristics } from './executeStrategy.js';
import { setupRecreatingStartMarker } from './strategyHelpers.js';
/**
 * This strategy is used when no shell integration is available. There are very few extension APIs
 * available in this case. This uses similar strategies to the basic integration strategy, but
 * with `sendText` instead of `shellIntegration.executeCommand` and relying on idle events instead
 * of execution events.
 */
let NoneExecuteStrategy = class NoneExecuteStrategy {
    constructor(_instance, _hasReceivedUserInput, _logService) {
        this._instance = _instance;
        this._hasReceivedUserInput = _hasReceivedUserInput;
        this._logService = _logService;
        this.type = 'none';
        this._startMarker = new MutableDisposable();
        this._onDidCreateStartMarker = new Emitter;
        this.onDidCreateStartMarker = this._onDidCreateStartMarker.event;
    }
    async execute(commandLine, token, commandId) {
        const store = new DisposableStore();
        try {
            if (token.isCancellationRequested) {
                throw new CancellationError();
            }
            // Ensure xterm is available
            this._log('Waiting for xterm');
            const xterm = await this._instance.xtermReadyPromise;
            if (!xterm) {
                throw new Error('Xterm is not available');
            }
            // Wait for the terminal to idle before executing the command
            this._log('Waiting for idle');
            await waitForIdle(this._instance.onData, 1000);
            if (token.isCancellationRequested) {
                throw new CancellationError();
            }
            setupRecreatingStartMarker(xterm, this._startMarker, m => this._onDidCreateStartMarker.fire(m), store, this._log.bind(this));
            if (this._hasReceivedUserInput()) {
                this._log('Command timed out, sending SIGINT and retrying');
                // Send SIGINT (Ctrl+C)
                await this._instance.sendText('\x03', false);
                await waitForIdle(this._instance.onData, 100);
            }
            // Execute the command
            // IMPORTANT: This uses `sendText` not `runCommand` since when no shell integration
            // is used as sending ctrl+c before a shell is initialized (eg. PSReadLine) can result
            // in failure (https://github.com/microsoft/vscode/issues/258989)
            this._log(`Executing command line \`${commandLine}\``);
            this._instance.sendText(commandLine, true);
            // Assume the command is done when it's idle
            this._log('Waiting for idle with prompt heuristics');
            const promptResult = await waitForIdleWithPromptHeuristics(this._instance.onData, this._instance, 1000, 10000);
            this._log(`Prompt detection result: ${promptResult.detected ? 'detected' : 'not detected'} - ${promptResult.reason}`);
            if (token.isCancellationRequested) {
                throw new CancellationError();
            }
            const endMarker = store.add(xterm.raw.registerMarker());
            // Assemble final result - exit code is not available without shell integration
            let output;
            const additionalInformationLines = [];
            try {
                output = xterm.getContentsAsText(this._startMarker.value, endMarker);
                this._log('Fetched output via markers');
            }
            catch {
                this._log('Failed to fetch output via markers');
                additionalInformationLines.push('Failed to retrieve command output');
            }
            return {
                output,
                additionalInformation: additionalInformationLines.length > 0 ? additionalInformationLines.join('\n') : undefined,
                exitCode: undefined,
            };
        }
        finally {
            store.dispose();
        }
    }
    _log(message) {
        this._logService.debug(`RunInTerminalTool#None: ${message}`);
    }
};
NoneExecuteStrategy = __decorate([
    __param(2, ITerminalLogService)
], NoneExecuteStrategy);
export { NoneExecuteStrategy };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9uZUV4ZWN1dGVTdHJhdGVneS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvY2hhdEFnZW50VG9vbHMvYnJvd3Nlci9leGVjdXRlU3RyYXRlZ3kvbm9uZUV4ZWN1dGVTdHJhdGVneS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sd0NBQXdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxXQUFXLEVBQUUsK0JBQStCLEVBQXNFLE1BQU0sc0JBQXNCLENBQUM7QUFHeEosT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFFbEU7Ozs7O0dBS0c7QUFDSSxJQUFNLG1CQUFtQixHQUF6QixNQUFNLG1CQUFtQjtJQVEvQixZQUNrQixTQUE0QixFQUM1QixxQkFBb0MsRUFDaEMsV0FBaUQ7UUFGckQsY0FBUyxHQUFULFNBQVMsQ0FBbUI7UUFDNUIsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUFlO1FBQ2YsZ0JBQVcsR0FBWCxXQUFXLENBQXFCO1FBVjlELFNBQUksR0FBRyxNQUFNLENBQUM7UUFDTixpQkFBWSxHQUFHLElBQUksaUJBQWlCLEVBQWdCLENBQUM7UUFHckQsNEJBQXVCLEdBQUcsSUFBSSxPQUFpQyxDQUFDO1FBQzFFLDJCQUFzQixHQUFvQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDO0lBT3BHLENBQUM7SUFFRCxLQUFLLENBQUMsT0FBTyxD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