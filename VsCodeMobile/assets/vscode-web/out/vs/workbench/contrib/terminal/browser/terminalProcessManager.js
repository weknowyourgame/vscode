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
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, dispose, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { isMacintosh, isWindows, OS } from '../../../../base/common/platform.js';
import { localize } from '../../../../nls.js';
import { formatMessageForTerminal } from '../../../../platform/terminal/common/terminalStrings.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { getRemoteAuthority } from '../../../../platform/remote/common/remoteHosts.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { NaiveCwdDetectionCapability } from '../../../../platform/terminal/common/capabilities/naiveCwdDetectionCapability.js';
import { TerminalCapabilityStore } from '../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js';
import { ITerminalLogService } from '../../../../platform/terminal/common/terminal.js';
import { TerminalRecorder } from '../../../../platform/terminal/common/terminalRecorder.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { EnvironmentVariableInfoChangesActive, EnvironmentVariableInfoStale } from './environmentVariableInfo.js';
import { ITerminalConfigurationService, ITerminalInstanceService, ITerminalService } from './terminal.js';
import { IEnvironmentVariableService } from '../common/environmentVariable.js';
import { MergedEnvironmentVariableCollection } from '../../../../platform/terminal/common/environmentVariableCollection.js';
import { serializeEnvironmentVariableCollections } from '../../../../platform/terminal/common/environmentVariableShared.js';
import { ITerminalProfileResolverService } from '../common/terminal.js';
import * as terminalEnvironment from '../common/terminalEnvironment.js';
import { IConfigurationResolverService } from '../../../services/configurationResolver/common/configurationResolver.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IHistoryService } from '../../../services/history/common/history.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import Severity from '../../../../base/common/severity.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { getActiveWindow, runWhenWindowIdle } from '../../../../base/browser/dom.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { shouldUseEnvironmentVariableCollection } from '../../../../platform/terminal/common/terminalEnvironment.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { BugIndicatingError } from '../../../../base/common/errors.js';
import { isString } from '../../../../base/common/types.js';
var ProcessConstants;
(function (ProcessConstants) {
    /**
     * The amount of time to consider terminal errors to be related to the launch.
     */
    ProcessConstants[ProcessConstants["ErrorLaunchThresholdDuration"] = 500] = "ErrorLaunchThresholdDuration";
    /**
     * The minimum amount of time between latency requests.
     */
    ProcessConstants[ProcessConstants["LatencyMeasuringInterval"] = 1000] = "LatencyMeasuringInterval";
})(ProcessConstants || (ProcessConstants = {}));
var ProcessType;
(function (ProcessType) {
    ProcessType[ProcessType["Process"] = 0] = "Process";
    ProcessType[ProcessType["PsuedoTerminal"] = 1] = "PsuedoTerminal";
})(ProcessType || (ProcessType = {}));
/**
 * Holds all state related to the creation and management of terminal processes.
 *
 * Internal definitions:
 * - Process: The process launched with the terminalProcess.ts file, or the pty as a whole
 * - Pty Process: The pseudoterminal parent process (or the conpty/winpty agent process)
 * - Shell Process: The pseudoterminal child process (ie. the shell)
 */
let TerminalProcessManager = class TerminalProcessManager extends Disposable {
    get persistentProcessId() { return this._process?.id; }
    get shouldPersist() { return !!this.reconnectionProperties || (this._process ? this._process.shouldPersist : false); }
    get hasWrittenData() { return this._hasWrittenData; }
    get hasChildProcesses() { return this._hasChildProcesses; }
    get reconnectionProperties() { return this._shellLaunchConfig?.attachPersistentProcess?.reconnectionProperties || this._shellLaunchConfig?.reconnectionProperties || undefined; }
    get extEnvironmentVariableCollection() { return this._extEnvironmentVariableCollection; }
    get processTraits() { return this._processTraits; }
    constructor(_instanceId, cwd, environmentVariableCollections, shellIntegrationNonce, _historyService, _instantiationService, _logService, _workspaceContextService, _configurationResolverService, _workbenchEnvironmentService, _productService, _remoteAgentService, _pathService, _environmentVariableService, _terminalConfigurationService, _terminalProfileResolverService, _configurationService, _terminalInstanceService, _telemetryService, _notificationService, _accessibilityService, _terminalService) {
        super();
        this._instanceId = _instanceId;
        this._historyService = _historyService;
        this._instantiationService = _instantiationService;
        this._logService = _logService;
        this._workspaceContextService = _workspaceContextService;
        this._configurationResolverService = _configurationResolverService;
        this._workbenchEnvironmentService = _workbenchEnvironmentService;
        this._productService = _productService;
        this._remoteAgentService = _remoteAgentService;
        this._pathService = _pathService;
        this._environmentVariableService = _environmentVariableService;
        this._terminalConfigurationService = _terminalConfigurationService;
        this._terminalProfileResolverService = _terminalProfileResolverService;
        this._configurationService = _configurationService;
        this._terminalInstanceService = _terminalInstanceService;
        this._telemetryService = _telemetryService;
        this._notificationService = _notificationService;
        this._accessibilityService = _accessibilityService;
        this._terminalService = _terminalService;
        this.processState = 1 /* ProcessState.Uninitialized */;
        this.capabilities = this._register(new TerminalCapabilityStore());
        this.processReadyTimestamp = 0;
        this._isDisposed = false;
        this._process = null;
        this._processType = 0 /* ProcessType.Process */;
        this._preLaunchInputQueue = [];
        this._hasWrittenData = false;
        this._hasChildProcesses = false;
        this._ptyListenersAttached = false;
        this._isDisconnected = false;
        this._dimensions = { cols: 0, rows: 0 };
        this._onPtyDisconnect = this._register(new Emitter());
        this.onPtyDisconnect = this._onPtyDisconnect.event;
        this._onPtyReconnect = this._register(new Emitter());
        this.onPtyReconnect = this._onPtyReconnect.event;
        this._onProcessReady = this._register(new Emitter());
        this.onProcessReady = this._onProcessReady.event;
        this._onProcessStateChange = this._register(new Emitter());
        this.onProcessStateChange = this._onProcessStateChange.event;
        this._onBeforeProcessData = this._register(new Emitter());
        this.onBeforeProcessData = this._onBeforeProcessData.event;
        this._onProcessData = this._register(new Emitter());
        this.onProcessData = this._onProcessData.event;
        this._onProcessReplayComplete = this._register(new Emitter());
        this.onProcessReplayComplete = this._onProcessReplayComplete.event;
        this._onDidChangeProperty = this._register(new Emitter());
        this.onDidChangeProperty = this._onDidChangeProperty.event;
        this._onEnvironmentVariableInfoChange = this._register(new Emitter());
        this.onEnvironmentVariableInfoChanged = this._onEnvironmentVariableInfoChange.event;
        this._onProcessExit = this._register(new Emitter());
        this.onProcessExit = this._onProcessExit.event;
        this._onRestoreCommands = this._register(new Emitter());
        this.onRestoreCommands = this._onRestoreCommands.event;
        this._cwdWorkspaceFolder = terminalEnvironment.getWorkspaceForTerminal(cwd, this._workspaceContextService, this._historyService);
        this.ptyProcessReady = this._createPtyProcessReadyPromise();
        this._ackDataBufferer = new AckDataBufferer(e => this._process?.acknowledgeDataEvent(e));
        this._dataFilter = this._register(this._instantiationService.createInstance(SeamlessRelaunchDataFilter));
        this._register(this._dataFilter.onProcessData(ev => {
            const data = (isString(ev) ? ev : ev.data);
            const beforeProcessDataEvent = { data };
            this._onBeforeProcessData.fire(beforeProcessDataEvent);
            if (beforeProcessDataEvent.data && beforeProcessDataEvent.data.length > 0) {
                // This event is used by the caller so the object must be reused
                if (!isString(ev)) {
                    ev.data = beforeProcessDataEvent.data;
                }
                this._onProcessData.fire(!isString(ev) ? ev : { data: beforeProcessDataEvent.data, trackCommit: false });
            }
        }));
        if (cwd && typeof cwd === 'object') {
            this.remoteAuthority = getRemoteAuthority(cwd);
        }
        else {
            this.remoteAuthority = this._workbenchEnvironmentService.remoteAuthority;
        }
        if (environmentVariableCollections) {
            this._extEnvironmentVariableCollection = new MergedEnvironmentVariableCollection(environmentVariableCollections);
            this._register(this._environmentVariableService.onDidChangeCollections(newCollection => this._onEnvironmentVariableCollectionChange(newCollection)));
            this.environmentVariableInfo = this._instantiationService.createInstance(EnvironmentVariableInfoChangesActive, this._extEnvironmentVariableCollection);
            this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
        }
        this.shellIntegrationNonce = shellIntegrationNonce ?? generateUuid();
    }
    async freePortKillProcess(port) {
        try {
            if (this._process?.freePortKillProcess) {
                await this._process?.freePortKillProcess(port);
            }
        }
        catch (e) {
            this._notificationService.notify({ message: localize('killportfailure', 'Could not kill process listening on port {0}, command exited with error {1}', port, e), severity: Severity.Warning });
        }
    }
    dispose(immediate = false) {
        this._isDisposed = true;
        if (this._process) {
            // If the process was still connected this dispose came from
            // within VS Code, not the process, so mark the process as
            // killed by the user.
            this._setProcessState(5 /* ProcessState.KilledByUser */);
            this._process.shutdown(immediate);
            this._process = null;
        }
        if (this._processListeners) {
            dispose(this._processListeners);
            this._processListeners = undefined;
        }
        super.dispose();
    }
    _createPtyProcessReadyPromise() {
        return new Promise(c => {
            const listener = Event.once(this.onProcessReady)(() => {
                this._logService.debug(`Terminal process ready (shellProcessId: ${this.shellProcessId})`);
                this._store.delete(listener);
                c(undefined);
            });
            this._store.add(listener);
        });
    }
    async detachFromProcess(forcePersist) {
        await this._process?.detach?.(forcePersist);
        this._process = null;
    }
    async createProcess(shellLaunchConfig, cols, rows, reset = true) {
        this._shellLaunchConfig = shellLaunchConfig;
        this._dimensions.cols = cols;
        this._dimensions.rows = rows;
        let newProcess;
        if (shellLaunchConfig.customPtyImplementation) {
            this._processType = 1 /* ProcessType.PsuedoTerminal */;
            newProcess = shellLaunchConfig.customPtyImplementation(this._instanceId, cols, rows);
        }
        else {
            const backend = await this._terminalInstanceService.getBackend(this.remoteAuthority);
            if (!backend) {
                throw new Error(`No terminal backend registered for remote authority '${this.remoteAuthority}'`);
            }
            this.backend = backend;
            // Create variable resolver
            const variableResolver = terminalEnvironment.createVariableResolver(this._cwdWorkspaceFolder, await this._terminalProfileResolverService.getEnvironment(this.remoteAuthority), this._configurationResolverService);
            // resolvedUserHome is needed here as remote resolvers can launch local terminals before
            // they're connected to the remote.
            this.userHome = this._pathService.resolvedUserHome?.fsPath;
            this.os = OS;
            if (!!this.remoteAuthority) {
                const userHomeUri = await this._pathService.userHome();
                this.userHome = userHomeUri.path;
                const remoteEnv = await this._remoteAgentService.getEnvironment();
                if (!remoteEnv) {
                    throw new Error(`Failed to get remote environment for remote authority "${this.remoteAuthority}"`);
                }
                this.userHome = remoteEnv.userHome.path;
                this.os = remoteEnv.os;
                // this is a copy of what the merged environment collection is on the remote side
                const env = await this._resolveEnvironment(backend, variableResolver, shellLaunchConfig);
                const shouldPersist = ((this._configurationService.getValue("task.reconnection" /* TaskSettingId.Reconnection */) && shellLaunchConfig.reconnectionProperties) || !shellLaunchConfig.isFeatureTerminal) && this._terminalConfigurationService.config.enablePersistentSessions && !shellLaunchConfig.isTransient;
                if (shellLaunchConfig.attachPersistentProcess) {
                    const result = await backend.attachToProcess(shellLaunchConfig.attachPersistentProcess.id);
                    if (result) {
                        newProcess = result;
                    }
                    else {
                        // Warn and just create a new terminal if attach failed for some reason
                        this._logService.warn(`Attach to process failed for terminal`, shellLaunchConfig.attachPersistentProcess);
                        shellLaunchConfig.attachPersistentProcess = undefined;
                    }
                }
                if (!newProcess) {
                    await this._terminalProfileResolverService.resolveShellLaunchConfig(shellLaunchConfig, {
                        remoteAuthority: this.remoteAuthority,
                        os: this.os
                    });
                    const options = {
                        shellIntegration: {
                            enabled: this._configurationService.getValue("terminal.integrated.shellIntegration.enabled" /* TerminalSettingId.ShellIntegrationEnabled */),
                            suggestEnabled: this._configurationService.getValue("terminal.integrated.suggest.enabled" /* TerminalContribSettingId.SuggestEnabled */),
                            nonce: this.shellIntegrationNonce
                        },
                        windowsEnableConpty: this._terminalConfigurationService.config.windowsEnableConpty,
                        windowsUseConptyDll: this._terminalConfigurationService.config.windowsUseConptyDll ?? false,
                        environmentVariableCollections: this._extEnvironmentVariableCollection?.collections ? serializeEnvironmentVariableCollections(this._extEnvironmentVariableCollection.collections) : undefined,
                        workspaceFolder: this._cwdWorkspaceFolder,
                        isScreenReaderOptimized: this._accessibilityService.isScreenReaderOptimized()
                    };
                    try {
                        newProcess = await backend.createProcess(shellLaunchConfig, '', // TODO: Fix cwd
                        cols, rows, this._terminalConfigurationService.config.unicodeVersion, env, // TODO:
                        options, shouldPersist);
                    }
                    catch (e) {
                        if (e?.message === 'Could not fetch remote environment') {
                            this._logService.trace(`Could not fetch remote environment, silently failing`);
                            return undefined;
                        }
                        throw e;
                    }
                }
                if (!this._isDisposed) {
                    this._setupPtyHostListeners(backend);
                }
            }
            else {
                if (shellLaunchConfig.attachPersistentProcess) {
                    const result = shellLaunchConfig.attachPersistentProcess.findRevivedId ? await backend.attachToRevivedProcess(shellLaunchConfig.attachPersistentProcess.id) : await backend.attachToProcess(shellLaunchConfig.attachPersistentProcess.id);
                    if (result) {
                        newProcess = result;
                    }
                    else {
                        // Warn and just create a new terminal if attach failed for some reason
                        this._logService.warn(`Attach to process failed for terminal`, shellLaunchConfig.attachPersistentProcess);
                        shellLaunchConfig.attachPersistentProcess = undefined;
                    }
                }
                if (!newProcess) {
                    newProcess = await this._launchLocalProcess(backend, shellLaunchConfig, cols, rows, this.userHome, variableResolver);
                }
                if (!this._isDisposed) {
                    this._setupPtyHostListeners(backend);
                }
            }
        }
        // If the process was disposed during its creation, shut it down and return failure
        if (this._isDisposed) {
            newProcess.shutdown(false);
            return undefined;
        }
        this._process = newProcess;
        this._setProcessState(2 /* ProcessState.Launching */);
        // Add any capabilities inherent to the backend
        if (this.os === 3 /* OperatingSystem.Linux */ || this.os === 2 /* OperatingSystem.Macintosh */) {
            this.capabilities.add(1 /* TerminalCapability.NaiveCwdDetection */, new NaiveCwdDetectionCapability(this._process));
        }
        this._dataFilter.newProcess(this._process, reset);
        if (this._processListeners) {
            dispose(this._processListeners);
        }
        this._processListeners = [
            newProcess.onProcessReady((e) => {
                this._processTraits = e;
                this.shellProcessId = e.pid;
                this._initialCwd = e.cwd;
                this.processReadyTimestamp = Date.now();
                this._onDidChangeProperty.fire({ type: "initialCwd" /* ProcessPropertyType.InitialCwd */, value: this._initialCwd });
                this._onProcessReady.fire(e);
                if (this._preLaunchInputQueue.length > 0 && this._process) {
                    // Send any queued data that's waiting
                    newProcess.input(this._preLaunchInputQueue.join(''));
                    this._preLaunchInputQueue.length = 0;
                }
            }),
            newProcess.onProcessExit(exitCode => this._onExit(exitCode)),
            newProcess.onDidChangeProperty(({ type, value }) => {
                switch (type) {
                    case "hasChildProcesses" /* ProcessPropertyType.HasChildProcesses */:
                        this._hasChildProcesses = value;
                        break;
                    case "failedShellIntegrationActivation" /* ProcessPropertyType.FailedShellIntegrationActivation */:
                        this._telemetryService?.publicLog2('terminal/shellIntegrationActivationFailureCustomArgs');
                        break;
                }
                this._onDidChangeProperty.fire({ type, value });
            })
        ];
        if (newProcess.onProcessReplayComplete) {
            this._processListeners.push(newProcess.onProcessReplayComplete(() => this._onProcessReplayComplete.fire()));
        }
        if (newProcess.onRestoreCommands) {
            this._processListeners.push(newProcess.onRestoreCommands(e => this._onRestoreCommands.fire(e)));
        }
        setTimeout(() => {
            if (this.processState === 2 /* ProcessState.Launching */) {
                this._setProcessState(3 /* ProcessState.Running */);
            }
        }, 500 /* ProcessConstants.ErrorLaunchThresholdDuration */);
        const result = await newProcess.start();
        if (result) {
            // Error
            return result;
        }
        // Report the latency to the pty host when idle
        runWhenWindowIdle(getActiveWindow(), () => {
            this.backend?.getLatency().then(measurements => {
                this._logService.info(`Latency measurements for ${this.remoteAuthority ?? 'local'} backend\n${measurements.map(e => `${e.label}: ${e.latency.toFixed(2)}ms`).join('\n')}`);
            });
        });
        return undefined;
    }
    async relaunch(shellLaunchConfig, cols, rows, reset) {
        this.ptyProcessReady = this._createPtyProcessReadyPromise();
        this._logService.trace(`Relaunching terminal instance ${this._instanceId}`);
        // Fire reconnect if needed to ensure the terminal is usable again
        if (this._isDisconnected) {
            this._isDisconnected = false;
            this._onPtyReconnect.fire();
        }
        // Clear data written flag to re-enable seamless relaunch if this relaunch was manually
        // triggered
        this._hasWrittenData = false;
        return this.createProcess(shellLaunchConfig, cols, rows, reset);
    }
    // Fetch any extension environment additions and apply them
    async _resolveEnvironment(backend, variableResolver, shellLaunchConfig) {
        const workspaceFolder = terminalEnvironment.getWorkspaceForTerminal(shellLaunchConfig.cwd, this._workspaceContextService, this._historyService);
        const platformKey = isWindows ? 'windows' : (isMacintosh ? 'osx' : 'linux');
        const envFromConfigValue = this._configurationService.getValue(`terminal.integrated.env.${platformKey}`);
        let baseEnv;
        if (shellLaunchConfig.useShellEnvironment) {
            const shellEnv = await backend.getShellEnvironment();
            if (!shellEnv) {
                throw new BugIndicatingError('Cannot fetch shell environment to use');
            }
            baseEnv = shellEnv;
        }
        else {
            baseEnv = await this._terminalProfileResolverService.getEnvironment(this.remoteAuthority);
        }
        const env = await terminalEnvironment.createTerminalEnvironment(shellLaunchConfig, envFromConfigValue, variableResolver, this._productService.version, this._terminalConfigurationService.config.detectLocale, baseEnv);
        if (!this._isDisposed && shouldUseEnvironmentVariableCollection(shellLaunchConfig)) {
            this._extEnvironmentVariableCollection = this._environmentVariableService.mergedCollection;
            this._register(this._environmentVariableService.onDidChangeCollections(newCollection => this._onEnvironmentVariableCollectionChange(newCollection)));
            // For remote terminals, this is a copy of the mergedEnvironmentCollection created on
            // the remote side. Since the environment collection is synced between the remote and
            // local sides immediately this is a fairly safe way of enabling the env var diffing and
            // info widget. While technically these could differ due to the slight change of a race
            // condition, the chance is minimal plus the impact on the user is also not that great
            // if it happens - it's not worth adding plumbing to sync back the resolved collection.
            await this._extEnvironmentVariableCollection.applyToProcessEnvironment(env, { workspaceFolder }, variableResolver);
            if (this._extEnvironmentVariableCollection.getVariableMap({ workspaceFolder }).size) {
                this.environmentVariableInfo = this._instantiationService.createInstance(EnvironmentVariableInfoChangesActive, this._extEnvironmentVariableCollection);
                this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
            }
        }
        return env;
    }
    async _launchLocalProcess(backend, shellLaunchConfig, cols, rows, userHome, variableResolver) {
        await this._terminalProfileResolverService.resolveShellLaunchConfig(shellLaunchConfig, {
            remoteAuthority: undefined,
            os: OS
        });
        const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot(Schemas.file);
        const initialCwd = await terminalEnvironment.getCwd(shellLaunchConfig, userHome, variableResolver, activeWorkspaceRootUri, this._terminalConfigurationService.config.cwd, this._logService);
        const env = await this._resolveEnvironment(backend, variableResolver, shellLaunchConfig);
        const options = {
            shellIntegration: {
                enabled: this._configurationService.getValue("terminal.integrated.shellIntegration.enabled" /* TerminalSettingId.ShellIntegrationEnabled */),
                suggestEnabled: this._configurationService.getValue("terminal.integrated.suggest.enabled" /* TerminalContribSettingId.SuggestEnabled */),
                nonce: this.shellIntegrationNonce
            },
            windowsEnableConpty: this._terminalConfigurationService.config.windowsEnableConpty,
            windowsUseConptyDll: this._terminalConfigurationService.config.windowsUseConptyDll ?? false,
            environmentVariableCollections: this._extEnvironmentVariableCollection ? serializeEnvironmentVariableCollections(this._extEnvironmentVariableCollection.collections) : undefined,
            workspaceFolder: this._cwdWorkspaceFolder,
            isScreenReaderOptimized: this._accessibilityService.isScreenReaderOptimized()
        };
        const shouldPersist = ((this._configurationService.getValue("task.reconnection" /* TaskSettingId.Reconnection */) && shellLaunchConfig.reconnectionProperties) || !shellLaunchConfig.isFeatureTerminal) && this._terminalConfigurationService.config.enablePersistentSessions && !shellLaunchConfig.isTransient;
        return await backend.createProcess(shellLaunchConfig, initialCwd, cols, rows, this._terminalConfigurationService.config.unicodeVersion, env, options, shouldPersist);
    }
    _setupPtyHostListeners(backend) {
        if (this._ptyListenersAttached) {
            return;
        }
        this._ptyListenersAttached = true;
        // Mark the process as disconnected is the pty host is unresponsive, the responsive event
        // will fire only when the pty host was already unresponsive
        this._register(backend.onPtyHostUnresponsive(() => {
            this._isDisconnected = true;
            this._onPtyDisconnect.fire();
        }));
        this._ptyResponsiveListener = backend.onPtyHostResponsive(() => {
            this._isDisconnected = false;
            this._onPtyReconnect.fire();
        });
        this._register(toDisposable(() => this._ptyResponsiveListener?.dispose()));
        // When the pty host restarts, reconnect is no longer possible so dispose the responsive
        // listener
        this._register(backend.onPtyHostRestart(async () => {
            // When the pty host restarts, reconnect is no longer possible
            if (!this._isDisconnected) {
                this._isDisconnected = true;
                this._onPtyDisconnect.fire();
            }
            this._ptyResponsiveListener?.dispose();
            this._ptyResponsiveListener = undefined;
            if (this._shellLaunchConfig) {
                if (this._shellLaunchConfig.isFeatureTerminal && !this.reconnectionProperties) {
                    // Indicate the process is exited (and gone forever) only for feature terminals
                    // so they can react to the exit, this is particularly important for tasks so
                    // that it knows that the process is not still active. Note that this is not
                    // done for regular terminals because otherwise the terminal instance would be
                    // disposed.
                    this._onExit(-1);
                }
                else {
                    // For normal terminals write a message indicating what happened and relaunch
                    // using the previous shellLaunchConfig
                    const message = localize('ptyHostRelaunch', "Restarting the terminal because the connection to the shell process was lost...");
                    this._onProcessData.fire({ data: formatMessageForTerminal(message, { loudFormatting: true }), trackCommit: false });
                    await this.relaunch(this._shellLaunchConfig, this._dimensions.cols, this._dimensions.rows, false);
                }
            }
        }));
    }
    async getBackendOS() {
        let os = OS;
        if (!!this.remoteAuthority) {
            const remoteEnv = await this._remoteAgentService.getEnvironment();
            if (!remoteEnv) {
                throw new Error(`Failed to get remote environment for remote authority "${this.remoteAuthority}"`);
            }
            os = remoteEnv.os;
        }
        return os;
    }
    setDimensions(cols, rows, sync) {
        if (sync) {
            this._resize(cols, rows);
            return;
        }
        return this.ptyProcessReady.then(() => this._resize(cols, rows));
    }
    async setUnicodeVersion(version) {
        return this._process?.setUnicodeVersion(version);
    }
    async setNextCommandId(commandLine, commandId) {
        await this.ptyProcessReady;
        const process = this._process;
        if (!process?.id) {
            return;
        }
        await this._terminalService.setNextCommandId(process.id, commandLine, commandId);
    }
    _resize(cols, rows) {
        if (!this._process) {
            return;
        }
        // The child process could already be terminated
        try {
            this._process.resize(cols, rows);
        }
        catch (error) {
            // We tried to write to a closed pipe / channel.
            if (error.code !== 'EPIPE' && error.code !== 'ERR_IPC_CHANNEL_CLOSED') {
                throw (error);
            }
        }
        this._dimensions.cols = cols;
        this._dimensions.rows = rows;
    }
    async write(data) {
        await this.ptyProcessReady;
        this._dataFilter.disableSeamlessRelaunch();
        this._hasWrittenData = true;
        if (this.shellProcessId || this._processType === 1 /* ProcessType.PsuedoTerminal */) {
            if (this._process) {
                // Send data if the pty is ready
                this._process.input(data);
            }
        }
        else {
            // If the pty is not ready, queue the data received to send later
            this._preLaunchInputQueue.push(data);
        }
    }
    async sendSignal(signal) {
        await this.ptyProcessReady;
        if (this._process) {
            this._process.sendSignal(signal);
        }
    }
    async processBinary(data) {
        await this.ptyProcessReady;
        this._dataFilter.disableSeamlessRelaunch();
        this._hasWrittenData = true;
        this._process?.processBinary(data);
    }
    get initialCwd() {
        return this._initialCwd ?? '';
    }
    async refreshProperty(type) {
        if (!this._process) {
            throw new Error('Cannot refresh property when process is not set');
        }
        return this._process.refreshProperty(type);
    }
    async updateProperty(type, value) {
        return this._process?.updateProperty(type, value);
    }
    acknowledgeDataEvent(charCount) {
        this._ackDataBufferer.ack(charCount);
    }
    _onExit(exitCode) {
        this._process = null;
        // If the process is marked as launching then mark the process as killed
        // during launch. This typically means that there is a problem with the
        // shell and args.
        if (this.processState === 2 /* ProcessState.Launching */) {
            this._setProcessState(4 /* ProcessState.KilledDuringLaunch */);
        }
        // If TerminalInstance did not know about the process exit then it was
        // triggered by the process, not on VS Code's side.
        if (this.processState === 3 /* ProcessState.Running */) {
            this._setProcessState(6 /* ProcessState.KilledByProcess */);
        }
        this._onProcessExit.fire(exitCode);
    }
    _setProcessState(state) {
        this.processState = state;
        this._onProcessStateChange.fire();
    }
    _onEnvironmentVariableCollectionChange(newCollection) {
        const diff = this._extEnvironmentVariableCollection.diff(newCollection, { workspaceFolder: this._cwdWorkspaceFolder });
        if (diff === undefined) {
            // If there are no longer differences, remove the stale info indicator
            if (this.environmentVariableInfo instanceof EnvironmentVariableInfoStale) {
                this.environmentVariableInfo = this._instantiationService.createInstance(EnvironmentVariableInfoChangesActive, this._extEnvironmentVariableCollection);
                this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
            }
            return;
        }
        this.environmentVariableInfo = this._instantiationService.createInstance(EnvironmentVariableInfoStale, diff, this._instanceId, newCollection);
        this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
    }
    async clearBuffer() {
        this._process?.clearBuffer?.();
    }
};
TerminalProcessManager = __decorate([
    __param(4, IHistoryService),
    __param(5, IInstantiationService),
    __param(6, ITerminalLogService),
    __param(7, IWorkspaceContextService),
    __param(8, IConfigurationResolverService),
    __param(9, IWorkbenchEnvironmentService),
    __param(10, IProductService),
    __param(11, IRemoteAgentService),
    __param(12, IPathService),
    __param(13, IEnvironmentVariableService),
    __param(14, ITerminalConfigurationService),
    __param(15, ITerminalProfileResolverService),
    __param(16, IConfigurationService),
    __param(17, ITerminalInstanceService),
    __param(18, ITelemetryService),
    __param(19, INotificationService),
    __param(20, IAccessibilityService),
    __param(21, ITerminalService)
], TerminalProcessManager);
export { TerminalProcessManager };
class AckDataBufferer {
    constructor(_callback) {
        this._callback = _callback;
        this._unsentCharCount = 0;
    }
    ack(charCount) {
        this._unsentCharCount += charCount;
        while (this._unsentCharCount > 5000 /* FlowControlConstants.CharCountAckSize */) {
            this._unsentCharCount -= 5000 /* FlowControlConstants.CharCountAckSize */;
            this._callback(5000 /* FlowControlConstants.CharCountAckSize */);
        }
    }
}
var SeamlessRelaunchConstants;
(function (SeamlessRelaunchConstants) {
    /**
     * How long to record data events for new terminals.
     */
    SeamlessRelaunchConstants[SeamlessRelaunchConstants["RecordTerminalDuration"] = 10000] = "RecordTerminalDuration";
    /**
     * The maximum duration after a relaunch occurs to trigger a swap.
     */
    SeamlessRelaunchConstants[SeamlessRelaunchConstants["SwapWaitMaximumDuration"] = 3000] = "SwapWaitMaximumDuration";
})(SeamlessRelaunchConstants || (SeamlessRelaunchConstants = {}));
/**
 * Filters data events from the process and supports seamlessly restarting swapping out the process
 * with another, delaying the swap in output in order to minimize flickering/clearing of the
 * terminal.
 */
let SeamlessRelaunchDataFilter = class SeamlessRelaunchDataFilter extends Disposable {
    get onProcessData() { return this._onProcessData.event; }
    constructor(_logService) {
        super();
        this._logService = _logService;
        this._firstDisposable = this._register(new MutableDisposable());
        this._secondDisposable = this._register(new MutableDisposable());
        this._dataListener = this._register(new MutableDisposable());
        this._disableSeamlessRelaunch = false;
        this._onProcessData = this._register(new Emitter());
    }
    newProcess(process, reset) {
        // Stop listening to the old process and trigger delayed shutdown (for hang issue #71966)
        this._dataListener.clear();
        this._activeProcess?.shutdown(false);
        this._activeProcess = process;
        // Start firing events immediately if:
        // - there's no recorder, which means it's a new terminal
        // - this is not a reset, so seamless relaunch isn't necessary
        // - seamless relaunch is disabled because the terminal has accepted input
        if (!this._firstRecorder || !reset || this._disableSeamlessRelaunch) {
            [this._firstRecorder, this._firstDisposable.value] = this._createRecorder(process);
            if (this._disableSeamlessRelaunch && reset) {
                this._onProcessData.fire('\x1bc');
            }
            this._dataListener.value = process.onProcessData(e => this._onProcessData.fire(e));
            this._disableSeamlessRelaunch = false;
            return;
        }
        // Trigger a swap if there was a recent relaunch
        if (this._secondRecorder) {
            this.triggerSwap();
        }
        this._swapTimeout = mainWindow.setTimeout(() => this.triggerSwap(), 3000 /* SeamlessRelaunchConstants.SwapWaitMaximumDuration */);
        // Pause all outgoing data events
        this._dataListener.clear();
        this._firstDisposable.clear();
        const recorder = this._createRecorder(process);
        [this._secondRecorder, this._secondDisposable.value] = recorder;
    }
    /**
     * Disables seamless relaunch for the active process
     */
    disableSeamlessRelaunch() {
        this._disableSeamlessRelaunch = true;
        this._stopRecording();
        this.triggerSwap();
    }
    /**
     * Trigger the swap of the processes if needed (eg. timeout, input)
     */
    triggerSwap() {
        // Clear the swap timeout if it exists
        if (this._swapTimeout) {
            mainWindow.clearTimeout(this._swapTimeout);
            this._swapTimeout = undefined;
        }
        // Do nothing if there's nothing being recorder
        if (!this._firstRecorder) {
            return;
        }
        // Clear the first recorder if no second process was attached before the swap trigger
        if (!this._secondRecorder) {
            this._firstRecorder = undefined;
            this._firstDisposable.clear();
            return;
        }
        // Generate data for each recorder
        const firstData = this._getDataFromRecorder(this._firstRecorder);
        const secondData = this._getDataFromRecorder(this._secondRecorder);
        // Re-write the terminal if the data differs
        if (firstData === secondData) {
            this._logService.trace(`Seamless terminal relaunch - identical content`);
        }
        else {
            this._logService.trace(`Seamless terminal relaunch - resetting content`);
            // Fire full reset (RIS) followed by the new data so the update happens in the same frame
            this._onProcessData.fire({ data: `\x1bc${secondData}`, trackCommit: false });
        }
        // Set up the new data listener
        this._dataListener.value = this._activeProcess.onProcessData(e => this._onProcessData.fire(e));
        // Replace first recorder with second
        this._firstRecorder = this._secondRecorder;
        this._firstDisposable.value = this._secondDisposable.value;
        this._secondRecorder = undefined;
    }
    _stopRecording() {
        // Continue recording if a swap is coming
        if (this._swapTimeout) {
            return;
        }
        // Stop recording
        this._firstRecorder = undefined;
        this._firstDisposable.clear();
        this._secondRecorder = undefined;
        this._secondDisposable.clear();
    }
    _createRecorder(process) {
        const recorder = new TerminalRecorder(0, 0);
        const disposable = process.onProcessData(e => recorder.handleData(isString(e) ? e : e.data));
        return [recorder, disposable];
    }
    _getDataFromRecorder(recorder) {
        return recorder.generateReplayEventSync().events.filter(e => !!e.data).map(e => e.data).join('');
    }
};
SeamlessRelaunchDataFilter = __decorate([
    __param(0, ITerminalLogService)
], SeamlessRelaunchDataFilter);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxQcm9jZXNzTWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsUHJvY2Vzc01hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBZSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN6SCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUF1QixXQUFXLEVBQUUsU0FBUyxFQUFtQixFQUFFLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUV2SCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDbkcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBRXZGLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLGtGQUFrRixDQUFDO0FBQy9ILE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDhFQUE4RSxDQUFDO0FBQ3ZILE9BQU8sRUFBb1IsbUJBQW1CLEVBQW1FLE1BQU0sa0RBQWtELENB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