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
import { TerminalShellExecutionCommandLineConfidence } from './extHostTypes.js';
import { Disposable, DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { MainContext } from './extHost.protocol.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import { IExtHostTerminalService } from './extHostTerminalService.js';
import { Emitter } from '../../../base/common/event.js';
import { URI } from '../../../base/common/uri.js';
import { AsyncIterableObject, Barrier } from '../../../base/common/async.js';
export const IExtHostTerminalShellIntegration = createDecorator('IExtHostTerminalShellIntegration');
let ExtHostTerminalShellIntegration = class ExtHostTerminalShellIntegration extends Disposable {
    constructor(extHostRpc, _extHostTerminalService) {
        super();
        this._extHostTerminalService = _extHostTerminalService;
        this._activeShellIntegrations = new Map();
        this._onDidChangeTerminalShellIntegration = new Emitter();
        this.onDidChangeTerminalShellIntegration = this._onDidChangeTerminalShellIntegration.event;
        this._onDidStartTerminalShellExecution = new Emitter();
        this.onDidStartTerminalShellExecution = this._onDidStartTerminalShellExecution.event;
        this._onDidEndTerminalShellExecution = new Emitter();
        this.onDidEndTerminalShellExecution = this._onDidEndTerminalShellExecution.event;
        this._proxy = extHostRpc.getProxy(MainContext.MainThreadTerminalShellIntegration);
        // Clean up listeners
        this._register(toDisposable(() => {
            for (const [_, integration] of this._activeShellIntegrations) {
                integration.dispose();
            }
            this._activeShellIntegrations.clear();
        }));
        // Convenient test code:
        // this.onDidChangeTerminalShellIntegration(e => {
        // 	console.log('*** onDidChangeTerminalShellIntegration', e);
        // });
        // this.onDidStartTerminalShellExecution(async e => {
        // 	console.log('*** onDidStartTerminalShellExecution', e);
        // 	// new Promise<void>(r => {
        // 	// 	(async () => {
        // 	// 		for await (const d of e.execution.read()) {
        // 	// 			console.log('data2', d);
        // 	// 		}
        // 	// 	})();
        // 	// });
        // 	for await (const d of e.execution.read()) {
        // 		console.log('data', d);
        // 	}
        // });
        // this.onDidEndTerminalShellExecution(e => {
        // 	console.log('*** onDidEndTerminalShellExecution', e);
        // });
        // setTimeout(() => {
        // 	console.log('before executeCommand(\"echo hello\")');
        // 	Array.from(this._activeShellIntegrations.values())[0].value.executeCommand('echo hello');
        // 	console.log('after executeCommand(\"echo hello\")');
        // }, 4000);
    }
    $shellIntegrationChange(instanceId, supportsExecuteCommandApi) {
        const terminal = this._extHostTerminalService.getTerminalById(instanceId);
        if (!terminal) {
            return;
        }
        const apiTerminal = terminal.value;
        let shellIntegration = this._activeShellIntegrations.get(instanceId);
        if (!shellIntegration) {
            shellIntegration = new InternalTerminalShellIntegration(terminal.value, supportsExecuteCommandApi, this._onDidStartTerminalShellExecution);
            this._activeShellIntegrations.set(instanceId, shellIntegration);
            shellIntegration.store.add(terminal.onWillDispose(() => this._activeShellIntegrations.get(instanceId)?.dispose()));
            shellIntegration.store.add(shellIntegration.onDidRequestShellExecution(commandLine => this._proxy.$executeCommand(instanceId, commandLine)));
            shellIntegration.store.add(shellIntegration.onDidRequestEndExecution(e => this._onDidEndTerminalShellExecution.fire(e)));
            shellIntegration.store.add(shellIntegration.onDidRequestChangeShellIntegration(e => this._onDidChangeTerminalShellIntegration.fire(e)));
            terminal.shellIntegration = shellIntegration.value;
        }
        this._onDidChangeTerminalShellIntegration.fire({
            terminal: apiTerminal,
            shellIntegration: shellIntegration.value
        });
    }
    $shellExecutionStart(instanceId, supportsExecuteCommandApi, commandLineValue, commandLineConfidence, isTrusted, cwd) {
        // Force shellIntegration creation if it hasn't been created yet, this could when events
        // don't come through on startup
        if (!this._activeShellIntegrations.has(instanceId)) {
            this.$shellIntegrationChange(instanceId, supportsExecuteCommandApi);
        }
        const commandLine = {
            value: commandLineValue,
            confidence: commandLineConfidence,
            isTrusted
        };
        this._activeShellIntegrations.get(instanceId)?.startShellExecution(commandLine, this._convertCwdToUri(cwd));
    }
    $shellExecutionEnd(instanceId, commandLineValue, commandLineConfidence, isTrusted, exitCode) {
        const commandLine = {
            value: commandLineValue,
            confidence: commandLineConfidence,
            isTrusted
        };
        this._activeShellIntegrations.get(instanceId)?.endShellExecution(commandLine, exitCode);
    }
    $shellExecutionData(instanceId, data) {
        this._activeShellIntegrations.get(instanceId)?.emitData(data);
    }
    $shellEnvChange(instanceId, shellEnvKeys, shellEnvValues, isTrusted) {
        this._activeShellIntegrations.get(instanceId)?.setEnv(shellEnvKeys, shellEnvValues, isTrusted);
    }
    $cwdChange(instanceId, cwd) {
        this._activeShellIntegrations.get(instanceId)?.setCwd(this._convertCwdToUri(cwd));
    }
    $closeTerminal(instanceId) {
        this._activeShellIntegrations.get(instanceId)?.dispose();
        this._activeShellIntegrations.delete(instanceId);
    }
    _convertCwdToUri(cwd) {
        // IMPORTANT: cwd is provided to the exthost as a string from the renderer and only
        // converted to a URI on the machine in which the pty is hosted on. The string version of
        // the cwd is used from the renderer such that it's access is synchronous and its event
        // comes through in order relative to other shell integration events.
        return cwd ? URI.file(cwd) : undefined;
    }
};
ExtHostTerminalShellIntegration = __decorate([
    __param(0, IExtHostRpcService),
    __param(1, IExtHostTerminalService)
], ExtHostTerminalShellIntegration);
export { ExtHostTerminalShellIntegration };
export class InternalTerminalShellIntegration extends Disposable {
    get currentExecution() { return this._currentExecution; }
    constructor(_terminal, supportsExecuteCommandApi, _onDidStartTerminalShellExecution) {
        super();
        this._terminal = _terminal;
        this._onDidStartTerminalShellExecution = _onDidStartTerminalShellExecution;
        this._pendingExecutions = [];
        this.store = this._register(new DisposableStore());
        this._onDidRequestChangeShellIntegration = this._register(new Emitter());
        this.onDidRequestChangeShellIntegration = this._onDidRequestChangeShellIntegration.event;
        this._onDidRequestShellExecution = this._register(new Emitter());
        this.onDidRequestShellExecution = this._onDidRequestShellExecution.event;
        this._onDidRequestEndExecution = this._register(new Emitter());
        this.onDidRequestEndExecution = this._onDidRequestEndExecution.event;
        this._onDidRequestNewExecution = this._register(new Emitter());
        this.onDidRequestNewExecution = this._onDidRequestNewExecution.event;
        const that = this;
        this.value = {
            get cwd() {
                return that._cwd;
            },
            get env() {
                if (!that._env) {
                    return undefined;
                }
                return Object.freeze({
                    isTrusted: that._env.isTrusted,
                    value: Object.freeze({ ...that._env.value })
                });
            },
            // executeCommand(commandLine: string): vscode.TerminalShellExecution;
            // executeCommand(executable: string, args: string[]): vscode.TerminalShellExecution;
            executeCommand(commandLineOrExecutable, args) {
                if (!supportsExecuteCommandApi) {
                    throw new Error('This terminal does not support the executeCommand API.');
                }
                let commandLineValue = commandLineOrExecutable;
                if (args) {
                    for (const arg of args) {
                        const wrapInQuotes = !arg.match(/["'`]/) && arg.match(/\s/);
                        if (wrapInQuotes) {
                            commandLineValue += ` "${arg}"`;
                        }
                        else {
                            commandLineValue += ` ${arg}`;
                        }
                    }
                }
                that._onDidRequestShellExecution.fire(commandLineValue);
                // Fire the event in a microtask to allow the extension to use the execution before
                // the start event fires
                const commandLine = {
                    value: commandLineValue,
                    confidence: TerminalShellExecutionCommandLineConfidence.High,
                    isTrusted: true
                };
                const execution = that.requestNewShellExecution(commandLine, that._cwd).value;
                return execution;
            }
        };
    }
    requestNewShellExecution(commandLine, cwd) {
        const execution = new InternalTerminalShellExecution(commandLine, cwd ?? this._cwd);
        const unresolvedCommandLines = splitAndSanitizeCommandLine(commandLine.value);
        if (unresolvedCommandLines.length > 1) {
            this._currentExecutionProperties = {
                isMultiLine: true,
                unresolvedCommandLines: splitAndSanitizeCommandLine(commandLine.value),
            };
        }
        this._pendingExecutions.push(execution);
        this._onDidRequestNewExecution.fire(commandLine.value);
        return execution;
    }
    startShellExecution(commandLine, cwd) {
        // Since an execution is starting, fire the end event for any execution that is awaiting to
        // end. When this happens it means that the data stream may not be flushed and therefore may
        // fire events after the end event.
        if (this._pendingEndingExecution) {
            this._onDidRequestEndExecution.fire({ terminal: this._terminal, shellIntegration: this.value, execution: this._pendingEndingExecution.value, exitCode: undefined });
            this._pendingEndingExecution = undefined;
        }
        if (this._currentExecution) {
            // If the current execution is multi-line, check if this command line is part of it.
            if (this._currentExecutionProperties?.isMultiLine && this._currentExecutionProperties.unresolvedCommandLines) {
                const subExecutionResult = isSubExecution(this._currentExecutionProperties.unresolvedCommandLines, commandLine);
                if (subExecutionResult) {
                    this._currentExecutionProperties.unresolvedCommandLines = subExecutionResult.unresolvedCommandLines;
                    return;
                }
            }
            this._currentExecution.endExecution(undefined);
            this._currentExecution.flush();
            this._onDidRequestEndExecution.fire({ terminal: this._terminal, shellIntegration: this.value, execution: this._currentExecution.value, exitCode: undefined });
        }
        // Get the matching pending execution, how strict this is depends on the confidence of the
        // command line
        let currentExecution;
        if (commandLine.confidence === TerminalShellExecutionCommandLineConfidence.High) {
            for (const [i, execution] of this._pendingExecutions.entries()) {
                if (execution.value.commandLine.value === commandLine.value) {
                    currentExecution = execution;
                    this._currentExecutionProperties = {
                        isMultiLine: false,
                        unresolvedCommandLines: undefined,
                    };
                    currentExecution = execution;
                    this._pendingExecutions.splice(i, 1);
                    break;
                }
                else {
                    const subExecutionResult = isSubExecution(splitAndSanitizeCommandLine(execution.value.commandLine.value), commandLine);
                    if (subExecutionResult) {
                        this._currentExecutionProperties = {
                            isMultiLine: true,
                            unresolvedCommandLines: subExecutionResult.unresolvedCommandLines,
                        };
                        currentExecution = execution;
                        this._pendingExecutions.splice(i, 1);
                        break;
                    }
                }
            }
        }
        else {
            currentExecution = this._pendingExecutions.shift();
        }
        // If there is no execution, create a new one
        if (!currentExecution) {
            // Fallback to the shell integration's cwd as the cwd may not have been restored after a reload
            currentExecution = new InternalTerminalShellExecution(commandLine, cwd ?? this._cwd);
        }
        this._currentExecution = currentExecution;
        this._onDidStartTerminalShellExecution.fire({ terminal: this._terminal, shellIntegration: this.value, execution: this._currentExecution.value });
    }
    emitData(data) {
        this.currentExecution?.emitData(data);
    }
    endShellExecution(commandLine, exitCode) {
        // If the current execution is multi-line, don't end it until the next command line is
        // confirmed to not be a part of it.
        if (this._currentExecutionProperties?.isMultiLine) {
            if (this._currentExecutionProperties.unresolvedCommandLines && this._currentExecutionProperties.unresolvedCommandLines.length > 0) {
                return;
            }
        }
        if (this._currentExecution) {
            const commandLineForEvent = this._currentExecutionProperties?.isMultiLine ? this._currentExecution.value.commandLine : commandLine;
            this._currentExecution.endExecution(commandLineForEvent);
            const currentExecution = this._currentExecution;
            this._pendingEndingExecution = currentExecution;
            this._currentExecution = undefined;
            // IMPORTANT: Ensure the current execution's data events are flushed in order to
            // prevent data events firing after the end event fires.
            currentExecution.flush().then(() => {
                // Only fire if it's still the same execution, if it's changed it would have already
                // been fired.
                if (this._pendingEndingExecution === currentExecution) {
                    this._onDidRequestEndExecution.fire({ terminal: this._terminal, shellIntegration: this.value, execution: currentExecution.value, exitCode });
                    this._pendingEndingExecution = undefined;
                }
            });
        }
    }
    setEnv(keys, values, isTrusted) {
        const env = {};
        for (let i = 0; i < keys.length; i++) {
            env[keys[i]] = values[i];
        }
        this._env = { value: env, isTrusted };
        this._fireChangeEvent();
    }
    setCwd(cwd) {
        let wasChanged = false;
        if (URI.isUri(this._cwd)) {
            wasChanged = !URI.isUri(cwd) || this._cwd.toString() !== cwd.toString();
        }
        else if (this._cwd !== cwd) {
            wasChanged = true;
        }
        if (wasChanged) {
            this._cwd = cwd;
            this._fireChangeEvent();
        }
    }
    _fireChangeEvent() {
        this._onDidRequestChangeShellIntegration.fire({ terminal: this._terminal, shellIntegration: this.value });
    }
}
class InternalTerminalShellExecution {
    constructor(_commandLine, cwd) {
        this._commandLine = _commandLine;
        this.cwd = cwd;
        this._isEnded = false;
        const that = this;
        this.value = {
            get commandLine() {
                return that._commandLine;
            },
            get cwd() {
                return that.cwd;
            },
            read() {
                return that._createDataStream();
            }
        };
    }
    _createDataStream() {
        if (!this._dataStream) {
            if (this._isEnded) {
                return AsyncIterableObject.EMPTY;
            }
            this._dataStream = new ShellExecutionDataStream();
        }
        return this._dataStream.createIterable();
    }
    emitData(data) {
        if (!this._isEnded) {
            this._dataStream?.emitData(data);
        }
    }
    endExecution(commandLine) {
        if (commandLine) {
            this._commandLine = commandLine;
        }
        this._dataStream?.endExecution();
        this._isEnded = true;
    }
    async flush() {
        if (this._dataStream) {
            await this._dataStream.flush();
            this._dataStream.dispose();
            this._dataStream = undefined;
        }
    }
}
class ShellExecutionDataStream extends Disposable {
    constructor() {
        super(...arguments);
        this._iterables = [];
        this._emitters = [];
    }
    createIterable() {
        if (!this._barrier) {
            this._barrier = new Barrier();
        }
        const barrier = this._barrier;
        const iterable = new AsyncIterableObject(async (emitter) => {
            this._emitters.push(emitter);
            await barrier.wait();
        });
        this._iterables.push(iterable);
        return iterable;
    }
    emitData(data) {
        for (const emitter of this._emitters) {
            emitter.emitOne(data);
        }
    }
    endExecution() {
        this._barrier?.open();
    }
    async flush() {
        await Promise.all(this._iterables.map(e => e.toPromise()));
    }
}
function splitAndSanitizeCommandLine(commandLine) {
    return commandLine
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
}
/**
 * When executing something that the shell considers multiple commands, such as
 * a comment followed by a command, this needs to all be tracked under a single
 * execution.
 */
function isSubExecution(unresolvedCommandLines, commandLine) {
    if (unresolvedCommandLines.length === 0) {
        return false;
    }
    const newUnresolvedCommandLines = [...unresolvedCommandLines];
    const subExecutionLines = splitAndSanitizeCommandLine(commandLine.value);
    if (newUnresolvedCommandLines && newUnresolvedCommandLines.length > 0) {
        // If all sub-execution lines are in the command line, this is part of the
        // multi-line execution.
        while (newUnresolvedCommandLines.length > 0) {
            if (newUnresolvedCommandLines[0] !== subExecutionLines[0]) {
                break;
            }
            newUnresolvedCommandLines.shift();
            subExecutionLines.shift();
        }
        if (subExecutionLines.length === 0) {
            return { unresolvedCommandLines: newUnresolvedCommandLines };
        }
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdFRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0VGVybWluYWxTaGVsbEludGVncmF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSwyQ0FBMkMsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ2hGLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzlGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsV0FBVyxFQUEyRixNQUFNLHVCQUF1QixDQUFDO0FBQzdJLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQzVELE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3RFLE9BQU8sRUFBRSxPQUFPLEVBQWMsTUFBTSwrQkFBK0IsQ0FBQztBQUNwRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDbEQsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE9BQU8sRUFBNkIsTUFBTSwrQkFBK0IsQ0FBQztBQVN4RyxNQUFNLENBQUMsTUFBTSxnQ0FBZ0MsR0FBRyxlQUFlLENBQW1DLGtDQUFrQyxDQUFDLENBQUM7QUFFL0gsSUFBTSwrQkFBK0IsR0FBckMsTUFBTSwrQkFBZ0MsU0FBUSxVQUFVO0lBZTlELFlBQ3FCLFVBQThCLEVBQ3pCLHVCQUFpRTtRQUUxRixLQUFLLEVBQUUsQ0FBQztRQUZrQyw0QkFBdUIsR0FBdkIsdUJBQXVCLENBQXlCO1FBWG5GLDZCQUF3QixHQUFnRSxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBRXZGLHlDQUFvQyxHQUFHLElB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