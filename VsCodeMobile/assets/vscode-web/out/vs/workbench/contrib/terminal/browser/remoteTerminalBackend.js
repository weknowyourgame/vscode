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
import { DeferredPromise } from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { revive } from '../../../../base/common/marshalling.js';
import { mark } from '../../../../base/common/performance.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IRemoteAuthorityResolverService } from '../../../../platform/remote/common/remoteAuthorityResolver.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITerminalLogService, TerminalExtensions } from '../../../../platform/terminal/common/terminal.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { BaseTerminalBackend } from './baseTerminalBackend.js';
import { RemotePty } from './remotePty.js';
import { ITerminalInstanceService } from './terminal.js';
import { RemoteTerminalChannelClient, REMOTE_TERMINAL_CHANNEL_NAME } from '../common/remote/remoteTerminalChannel.js';
import { TERMINAL_CONFIG_SECTION } from '../common/terminal.js';
import { IConfigurationResolverService } from '../../../services/configurationResolver/common/configurationResolver.js';
import { IHistoryService } from '../../../services/history/common/history.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { IStatusbarService } from '../../../services/statusbar/browser/statusbar.js';
let RemoteTerminalBackendContribution = class RemoteTerminalBackendContribution {
    static { this.ID = 'remoteTerminalBackend'; }
    constructor(instantiationService, remoteAgentService, terminalInstanceService) {
        const connection = remoteAgentService.getConnection();
        if (connection?.remoteAuthority) {
            const channel = instantiationService.createInstance(RemoteTerminalChannelClient, connection.remoteAuthority, connection.getChannel(REMOTE_TERMINAL_CHANNEL_NAME));
            const backend = instantiationService.createInstance(RemoteTerminalBackend, connection.remoteAuthority, channel);
            Registry.as(TerminalExtensions.Backend).registerTerminalBackend(backend);
            terminalInstanceService.didRegisterBackend(backend);
        }
    }
};
RemoteTerminalBackendContribution = __decorate([
    __param(0, IInstantiationService),
    __param(1, IRemoteAgentService),
    __param(2, ITerminalInstanceService)
], RemoteTerminalBackendContribution);
export { RemoteTerminalBackendContribution };
let RemoteTerminalBackend = class RemoteTerminalBackend extends BaseTerminalBackend {
    get whenReady() { return this._whenConnected.p; }
    setReady() { this._whenConnected.complete(); }
    constructor(remoteAuthority, _remoteTerminalChannel, _remoteAgentService, _instantiationService, logService, _commandService, _storageService, _remoteAuthorityResolverService, workspaceContextService, configurationResolverService, _historyService, _configurationService, statusBarService) {
        super(_remoteTerminalChannel, logService, _historyService, configurationResolverService, statusBarService, workspaceContextService);
        this.remoteAuthority = remoteAuthority;
        this._remoteTerminalChannel = _remoteTerminalChannel;
        this._remoteAgentService = _remoteAgentService;
        this._instantiationService = _instantiationService;
        this._commandService = _commandService;
        this._storageService = _storageService;
        this._remoteAuthorityResolverService = _remoteAuthorityResolverService;
        this._historyService = _historyService;
        this._configurationService = _configurationService;
        this._ptys = new Map();
        this._whenConnected = new DeferredPromise();
        this._onDidRequestDetach = this._register(new Emitter());
        this.onDidRequestDetach = this._onDidRequestDetach.event;
        this._onRestoreCommands = this._register(new Emitter());
        this.onRestoreCommands = this._onRestoreCommands.event;
        this._remoteTerminalChannel.onProcessData(e => this._ptys.get(e.id)?.handleData(e.event));
        this._remoteTerminalChannel.onProcessReplay(e => {
            this._ptys.get(e.id)?.handleReplay(e.event);
            if (e.event.commands.commands.length > 0) {
                this._onRestoreCommands.fire({ id: e.id, commands: e.event.commands.commands });
            }
        });
        this._remoteTerminalChannel.onProcessOrphanQuestion(e => this._ptys.get(e.id)?.handleOrphanQuestion());
        this._remoteTerminalChannel.onDidRequestDetach(e => this._onDidRequestDetach.fire(e));
        this._remoteTerminalChannel.onProcessReady(e => this._ptys.get(e.id)?.handleReady(e.event));
        this._remoteTerminalChannel.onDidChangeProperty(e => this._ptys.get(e.id)?.handleDidChangeProperty(e.property));
        this._remoteTerminalChannel.onProcessExit(e => {
            const pty = this._ptys.get(e.id);
            if (pty) {
                pty.handleExit(e.event);
                pty.dispose();
                this._ptys.delete(e.id);
            }
        });
        const allowedCommands = ['_remoteCLI.openExternal', '_remoteCLI.windowOpen', '_remoteCLI.getSystemStatus', '_remoteCLI.manageExtensions'];
        this._remoteTerminalChannel.onExecuteCommand(async (e) => {
            // Ensure this request for for this window
            const pty = this._ptys.get(e.persistentProcessId);
            if (!pty) {
                return;
            }
            const reqId = e.reqId;
            const commandId = e.commandId;
            if (!allowedCommands.includes(commandId)) {
                this._remoteTerminalChannel.sendCommandResult(reqId, true, 'Invalid remote cli command: ' + commandId);
                return;
            }
            const commandArgs = e.commandArgs.map(arg => revive(arg));
            try {
                const result = await this._commandService.executeCommand(e.commandId, ...commandArgs);
                this._remoteTerminalChannel.sendCommandResult(reqId, false, result);
            }
            catch (err) {
                this._remoteTerminalChannel.sendCommandResult(reqId, true, err);
            }
        });
        this._onPtyHostConnected.fire();
    }
    async requestDetachInstance(workspaceId, instanceId) {
        if (!this._remoteTerminalChannel) {
            throw new Error(`Cannot request detach instance when there is no remote!`);
        }
        return this._remoteTerminalChannel.requestDetachInstance(workspaceId, instanceId);
    }
    async acceptDetachInstanceReply(requestId, persistentProcessId) {
        if (!this._remoteTerminalChannel) {
            throw new Error(`Cannot accept detached instance when there is no remote!`);
        }
        else if (!persistentProcessId) {
            this._logService.warn('Cannot attach to feature terminals, custom pty terminals, or those without a persistentProcessId');
            return;
        }
        return this._remoteTerminalChannel.acceptDetachInstanceReply(requestId, persistentProcessId);
    }
    async persistTerminalState() {
        if (!this._remoteTerminalChannel) {
            throw new Error(`Cannot persist terminal state when there is no remote!`);
        }
        const ids = Array.from(this._ptys.keys());
        const serialized = await this._remoteTerminalChannel.serializeTerminalState(ids);
        this._storageService.store("terminal.integrated.bufferState" /* TerminalStorageKeys.TerminalBufferState */, serialized, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
    }
    async createProcess(shellLaunchConfig, cwd, // TODO: This is ignored
    cols, rows, unicodeVersion, env, // TODO: This is ignored
    options, shouldPersist) {
        if (!this._remoteTerminalChannel) {
            throw new Error(`Cannot create remote terminal when there is no remote!`);
        }
        // Fetch the environment to check shell permissions
        const remoteEnv = await this._remoteAgentService.getEnvironment();
        if (!remoteEnv) {
            // Extension host processes are only allowed in remote extension hosts currently
            throw new Error('Could not fetch remote environment');
        }
        const terminalConfig = this._configurationService.getValue(TERMINAL_CONFIG_SECTION);
        const configuration = {
            'terminal.integrated.env.windows': this._configurationService.getValue("terminal.integrated.env.windows" /* TerminalSettingId.EnvWindows */),
            'terminal.integrated.env.osx': this._configurationService.getValue("terminal.integrated.env.osx" /* TerminalSettingId.EnvMacOs */),
            'terminal.integrated.env.linux': this._configurationService.getValue("terminal.integrated.env.linux" /* TerminalSettingId.EnvLinux */),
            'terminal.integrated.cwd': this._configurationService.getValue("terminal.integrated.cwd" /* TerminalSettingId.Cwd */),
            'terminal.integrated.detectLocale': terminalConfig.detectLocale
        };
        const shellLaunchConfigDto = {
            name: shellLaunchConfig.name,
            executable: shellLaunchConfig.executable,
            args: shellLaunchConfig.args,
            cwd: shellLaunchConfig.cwd,
            env: shellLaunchConfig.env,
            useShellEnvironment: shellLaunchConfig.useShellEnvironment,
            reconnectionProperties: shellLaunchConfig.reconnectionProperties,
            type: shellLaunchConfig.type,
            isFeatureTerminal: shellLaunchConfig.isFeatureTerminal,
            tabActions: shellLaunchConfig.tabActions,
            shellIntegrationEnvironmentReporting: shellLaunchConfig.shellIntegrationEnvironmentReporting,
        };
        const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot();
        const result = await this._remoteTerminalChannel.createProcess(shellLaunchConfigDto, configuration, activeWorkspaceRootUri, options, shouldPersist, cols, rows, unicodeVersion);
        const pty = this._instantiationService.createInstance(RemotePty, result.persistentTerminalId, shouldPersist, this._remoteTerminalChannel);
        this._ptys.set(result.persistentTerminalId, pty);
        return pty;
    }
    async attachToProcess(id) {
        if (!this._remoteTerminalChannel) {
            throw new Error(`Cannot create remote terminal when there is no remote!`);
        }
        try {
            await this._remoteTerminalChannel.attachToProcess(id);
            const pty = this._instantiationService.createInstance(RemotePty, id, true, this._remoteTerminalChannel);
            this._ptys.set(id, pty);
            return pty;
        }
        catch (e) {
            this._logService.trace(`Couldn't attach to process ${e.message}`);
        }
        return undefined;
    }
    async attachToRevivedProcess(id) {
        if (!this._remoteTerminalChannel) {
            throw new Error(`Cannot create remote terminal when there is no remote!`);
        }
        try {
            const newId = await this._remoteTerminalChannel.getRevivedPtyNewId(id) ?? id;
            return await this.attachToProcess(newId);
        }
        catch (e) {
            this._logService.trace(`Couldn't attach to process ${e.message}`);
        }
        return undefined;
    }
    async listProcesses() {
        return this._remoteTerminalChannel.listProcesses();
    }
    async getLatency() {
        const sw = new StopWatch();
        const results = await this._remoteTerminalChannel.getLatency();
        sw.stop();
        return [
            {
                label: 'window<->ptyhostservice<->ptyhost',
                latency: sw.elapsed()
            },
            ...results
        ];
    }
    async updateProperty(id, property, value) {
        await this._remoteTerminalChannel.updateProperty(id, property, value);
    }
    async updateTitle(id, title, titleSource) {
        await this._remoteTerminalChannel.updateTitle(id, title, titleSource);
    }
    async updateIcon(id, userInitiated, icon, color) {
        await this._remoteTerminalChannel.updateIcon(id, userInitiated, icon, color);
    }
    async setNextCommandId(id, commandLine, commandId) {
        await this._remoteTerminalChannel.setNextCommandId(id, commandLine, commandId);
    }
    async getDefaultSystemShell(osOverride) {
        return this._remoteTerminalChannel.getDefaultSystemShell(osOverride) || '';
    }
    async getProfiles(profiles, defaultProfile, includeDetectedProfiles) {
        return this._remoteTerminalChannel.getProfiles(profiles, defaultProfile, includeDetectedProfiles) || [];
    }
    async getEnvironment() {
        return this._remoteTerminalChannel.getEnvironment() || {};
    }
    async getShellEnvironment() {
        const connection = this._remoteAgentService.getConnection();
        if (!connection) {
            return undefined;
        }
        const resolverResult = await this._remoteAuthorityResolverService.resolveAuthority(connection.remoteAuthority);
        const envResult = {};
        if (resolverResult.options?.extensionHostEnv) {
            for (const [key, value] of Object.entries(resolverResult.options.extensionHostEnv)) {
                if (value !== null) {
                    envResult[key] = value;
                }
            }
        }
        return envResult;
    }
    async getWslPath(original, direction) {
        const env = await this._remoteAgentService.getEnvironment();
        if (env?.os !== 1 /* OperatingSystem.Windows */) {
            return original;
        }
        return this._remoteTerminalChannel.getWslPath(original, direction) || original;
    }
    async setTerminalLayoutInfo(layout) {
        if (!this._remoteTerminalChannel) {
            throw new Error(`Cannot call setActiveInstanceId when there is no remote`);
        }
        return this._remoteTerminalChannel.setTerminalLayoutInfo(layout);
    }
    async reduceConnectionGraceTime() {
        if (!this._remoteTerminalChannel) {
            throw new Error('Cannot reduce grace time when there is no remote');
        }
        return this._remoteTerminalChannel.reduceConnectionGraceTime();
    }
    async getTerminalLayoutInfo() {
        if (!this._remoteTerminalChannel) {
            throw new Error(`Cannot call getActiveInstanceId when there is no remote`);
        }
        const workspaceId = this._getWorkspaceId();
        // Revive processes if needed
        const serializedState = this._storageService.get("terminal.integrated.bufferState" /* TerminalStorageKeys.TerminalBufferState */, 1 /* StorageScope.WORKSPACE */);
        const reviveBufferState = this._deserializeTerminalState(serializedState);
        if (reviveBufferState && reviveBufferState.length > 0) {
            try {
                // Note that remote terminals do not get their environment re-resolved unlike in local terminals
                mark('code/terminal/willReviveTerminalProcessesRemote');
                await this._remoteTerminalChannel.reviveTerminalProcesses(workspaceId, reviveBufferState, Intl.DateTimeFormat().resolvedOptions().locale);
                mark('code/terminal/didReviveTerminalProcessesRemote');
                this._storageService.remove("terminal.integrated.bufferState" /* TerminalStorageKeys.TerminalBufferState */, 1 /* StorageScope.WORKSPACE */);
                // If reviving processes, send the terminal layout info back to the pty host as it
                // will not have been persisted on application exit
                const layoutInfo = this._storageService.get("terminal.integrated.layoutInfo" /* TerminalStorageKeys.TerminalLayoutInfo */, 1 /* StorageScope.WORKSPACE */);
                if (layoutInfo) {
                    mark('code/terminal/willSetTerminalLayoutInfoRemote');
                    await this._remoteTerminalChannel.setTerminalLayoutInfo(JSON.parse(layoutInfo));
                    mark('code/terminal/didSetTerminalLayoutInfoRemote');
                    this._storageService.remove("terminal.integrated.layoutInfo" /* TerminalStorageKeys.TerminalLayoutInfo */, 1 /* StorageScope.WORKSPACE */);
                }
            }
            catch (e) {
                this._logService.warn('RemoteTerminalBackend#getTerminalLayoutInfo Error', e.message ?? e);
            }
        }
        return this._remoteTerminalChannel.getTerminalLayoutInfo();
    }
    async getPerformanceMarks() {
        return this._remoteTerminalChannel.getPerformanceMarks();
    }
    installAutoReply(match, reply) {
        return this._remoteTerminalChannel.installAutoReply(match, reply);
    }
    uninstallAllAutoReplies() {
        return this._remoteTerminalChannel.uninstallAllAutoReplies();
    }
};
RemoteTerminalBackend = __decorate([
    __param(2, IRemoteAgentService),
    __param(3, IInstantiationService),
    __param(4, ITerminalLogService),
    __param(5, ICommandService),
    __param(6, IStorageService),
    __param(7, IRemoteAuthorityResolverService),
    __param(8, IWorkspaceContextService),
    __param(9, IConfigurationResolverService),
    __param(10, IHistoryService),
    __param(11, IConfigurationService),
    __param(12, IStatusbarService)
], RemoteTerminalBackend);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVtb3RlVGVybWluYWxCYWNrZW5kLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL2Jyb3dzZXIvcmVtb3RlVGVybWluYWxCYWNrZW5kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDM0QsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2hFLE9BQU8sRUFBbUIsSUFBSSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFL0UsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNuRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDNUUsT0FBTyxFQUFFLCtCQUErQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDaEgsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxnREFBZ0QsQ0FBQztBQUU5RyxPQUFPLEVBQWtLLG1CQUFtQixFQUFrSCxrQkFBa0IsRUFBK0UsTUFBTSxrREFBa0QsQ0FBQztBQUV4YyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUU5RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMvRCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDM0MsT0FB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