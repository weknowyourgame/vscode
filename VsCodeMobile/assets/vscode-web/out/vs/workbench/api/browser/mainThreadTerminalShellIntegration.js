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
import { Event } from '../../../base/common/event.js';
import { Disposable, toDisposable } from '../../../base/common/lifecycle.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { ITerminalService } from '../../contrib/terminal/browser/terminal.js';
import { IWorkbenchEnvironmentService } from '../../services/environment/common/environmentService.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { TerminalShellExecutionCommandLineConfidence } from '../common/extHostTypes.js';
import { IExtensionService } from '../../services/extensions/common/extensions.js';
let MainThreadTerminalShellIntegration = class MainThreadTerminalShellIntegration extends Disposable {
    constructor(extHostContext, _terminalService, workbenchEnvironmentService, _extensionService) {
        super();
        this._terminalService = _terminalService;
        this._extensionService = _extensionService;
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostTerminalShellIntegration);
        const instanceDataListeners = new Map();
        this._register(toDisposable(() => {
            for (const listener of instanceDataListeners.values()) {
                listener.dispose();
            }
        }));
        // onDidChangeTerminalShellIntegration initial state
        for (const terminal of this._terminalService.instances) {
            const cmdDetection = terminal.capabilities.get(2 /* TerminalCapability.CommandDetection */);
            if (cmdDetection) {
                this._enableShellIntegration(terminal);
            }
        }
        // onDidChangeTerminalShellIntegration via command detection
        const onDidAddCommandDetection = this._store.add(this._terminalService.createOnInstanceEvent(instance => {
            return Event.map(instance.capabilities.onDidAddCommandDetectionCapability, () => instance);
        })).event;
        this._store.add(onDidAddCommandDetection(e => this._enableShellIntegration(e)));
        // onDidChangeTerminalShellIntegration via cwd
        const cwdChangeEvent = this._store.add(this._terminalService.createOnInstanceCapabilityEvent(0 /* TerminalCapability.CwdDetection */, e => e.onDidChangeCwd));
        this._store.add(cwdChangeEvent.event(e => {
            this._proxy.$cwdChange(e.instance.instanceId, e.data);
        }));
        // onDidChangeTerminalShellIntegration via env
        const envChangeEvent = this._store.add(this._terminalService.createOnInstanceCapabilityEvent(5 /* TerminalCapability.ShellEnvDetection */, e => e.onDidChangeEnv));
        this._store.add(envChangeEvent.event(e => {
            if (e.data.value && typeof e.data.value === 'object') {
                const envValue = e.data.value;
                // Extract keys and values
                const keysArr = Object.keys(envValue);
                const valuesArr = Object.values(envValue);
                this._proxy.$shellEnvChange(e.instance.instanceId, keysArr, valuesArr, e.data.isTrusted);
            }
        }));
        // onDidStartTerminalShellExecution
        const commandDetectionStartEvent = this._store.add(this._terminalService.createOnInstanceCapabilityEvent(2 /* TerminalCapability.CommandDetection */, e => e.onCommandExecuted));
        let currentCommand;
        this._store.add(commandDetectionStartEvent.event(e => {
            // Prevent duplicate events from being sent in case command detection double fires the
            // event
            if (e.data === currentCommand) {
                return;
            }
            // String paths are not exposed in the extension API
            currentCommand = e.data;
            const instanceId = e.instance.instanceId;
            this._proxy.$shellExecutionStart(instanceId, instanceSupportsExecuteCommandApi(e.instance), e.data.command, convertToExtHostCommandLineConfidence(e.data), e.data.isTrusted, e.data.cwd);
            // TerminalShellExecution.createDataStream
            // Debounce events to reduce the message count - when this listener is disposed the events will be flushed
            instanceDataListeners.get(instanceId)?.dispose();
            instanceDataListeners.set(instanceId, Event.accumulate(e.instance.onData, 50, this._store)(events => {
                this._proxy.$shellExecutionData(instanceId, events.join(''));
            }));
        }));
        // onDidEndTerminalShellExecution
        const commandDetectionEndEvent = this._store.add(this._terminalService.createOnInstanceCapabilityEvent(2 /* TerminalCapability.CommandDetection */, e => e.onCommandFinished));
        this._store.add(commandDetectionEndEvent.event(e => {
            currentCommand = undefined;
            const instanceId = e.instance.instanceId;
            instanceDataListeners.get(instanceId)?.dispose();
            // Shell integration C (executed) and D (command finished) sequences should always be in
            // their own events, so send this immediately. This means that the D sequence will not
            // be included as it's currently being parsed when the command finished event fires.
            this._proxy.$shellExecutionEnd(instanceId, e.data.command, convertToExtHostCommandLineConfidence(e.data), e.data.isTrusted, e.data.exitCode);
        }));
        // Clean up after dispose
        this._store.add(this._terminalService.onDidDisposeInstance(e => this._proxy.$closeTerminal(e.instanceId)));
    }
    $executeCommand(terminalId, commandLine) {
        this._terminalService.getInstanceFromId(terminalId)?.runCommand(commandLine, true);
    }
    _enableShellIntegration(instance) {
        this._extensionService.activateByEvent('onTerminalShellIntegration:*');
        if (instance.shellType) {
            this._extensionService.activateByEvent(`onTerminalShellIntegration:${instance.shellType}`);
        }
        this._proxy.$shellIntegrationChange(instance.instanceId, instanceSupportsExecuteCommandApi(instance));
        const cwdDetection = instance.capabilities.get(0 /* TerminalCapability.CwdDetection */);
        if (cwdDetection) {
            this._proxy.$cwdChange(instance.instanceId, cwdDetection.getCwd());
        }
    }
};
MainThreadTerminalShellIntegration = __decorate([
    extHostNamedCustomer(MainContext.MainThreadTerminalShellIntegration),
    __param(1, ITerminalService),
    __param(2, IWorkbenchEnvironmentService),
    __param(3, IExtensionService)
], MainThreadTerminalShellIntegration);
export { MainThreadTerminalShellIntegration };
function convertToExtHostCommandLineConfidence(command) {
    switch (command.commandLineConfidence) {
        case 'high':
            return TerminalShellExecutionCommandLineConfidence.High;
        case 'medium':
            return TerminalShellExecutionCommandLineConfidence.Medium;
        case 'low':
        default:
            return TerminalShellExecutionCommandLineConfidence.Low;
    }
}
function instanceSupportsExecuteCommandApi(instance) {
    return instance.shellLaunchConfig.type !== 'Task';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZFRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZFRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDdEQsT0FBTyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQW9CLE1BQU0sbUNBQW1DLENBQUM7QUFFL0YsT0FBTyxFQUFFLGNBQWMsRUFBRSxXQUFXLEVBQTJGLE1BQU0sK0JBQStCLENBQUM7QUFDckssT0FBTyxFQUFFLGdCQUFnQixFQUEwQixNQUFNLDRDQUE0QyxDQUFDO0FBQ3RHLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxvQkFBb0IsRUFBd0IsTUFBTSxzREFBc0QsQ0FBQztBQUNsSCxPQUFPLEVBQUUsMkNBQTJDLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUN4RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUc1RSxJQUFNLGtDQUFrQyxHQUF4QyxNQUFNLGtDQUFtQyxTQUFRLFVBQVU7SUFHakUsWUFDQyxjQUErQixFQUNJLGdCQUFrQyxFQUN2QywyQkFBeUQsRUFDbkQsaUJBQW9DO1FBRXhFLEtBQUssRUFBRSxDQUFDO1FBSjJCLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBa0I7UUFFakMsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFtQjtRQUl4RSxJQUFJLENBQUMsTUFBTSxHQUFHLGNBQWMsQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLCtCQUErQixDQUFDLENBQUM7UUFFdEYsTUFBTSxxQkFBcUIsR0FBNkIsSUFBSSxHQUFH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