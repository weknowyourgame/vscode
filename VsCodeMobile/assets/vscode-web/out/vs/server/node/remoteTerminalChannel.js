/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as os from 'os';
import { Emitter, Event } from '../../base/common/event.js';
import { cloneAndChange } from '../../base/common/objects.js';
import { Disposable } from '../../base/common/lifecycle.js';
import * as path from '../../base/common/path.js';
import * as platform from '../../base/common/platform.js';
import { URI } from '../../base/common/uri.js';
import { createRandomIPCHandle } from '../../base/parts/ipc/node/ipc.net.js';
import { createURITransformer } from '../../base/common/uriTransformer.js';
import { CLIServerBase } from '../../workbench/api/node/extHostCLIServer.js';
import { MergedEnvironmentVariableCollection } from '../../platform/terminal/common/environmentVariableCollection.js';
import { deserializeEnvironmentDescriptionMap, deserializeEnvironmentVariableCollection } from '../../platform/terminal/common/environmentVariableShared.js';
import * as terminalEnvironment from '../../workbench/contrib/terminal/common/terminalEnvironment.js';
import { AbstractVariableResolverService } from '../../workbench/services/configurationResolver/common/variableResolver.js';
import { buildUserEnvironment } from './extensionHostConnection.js';
import { promiseWithResolvers } from '../../base/common/async.js';
import { shouldUseEnvironmentVariableCollection } from '../../platform/terminal/common/terminalEnvironment.js';
class CustomVariableResolver extends AbstractVariableResolverService {
    constructor(env, workspaceFolders, activeFileResource, resolvedVariables, extensionService) {
        super({
            getFolderUri: (folderName) => {
                const found = workspaceFolders.filter(f => f.name === folderName);
                if (found && found.length > 0) {
                    return found[0].uri;
                }
                return undefined;
            },
            getWorkspaceFolderCount: () => {
                return workspaceFolders.length;
            },
            getConfigurationValue: (folderUri, section) => {
                return resolvedVariables[`config:${section}`];
            },
            getExecPath: () => {
                return env['VSCODE_EXEC_PATH'];
            },
            getAppRoot: () => {
                return env['VSCODE_CWD'];
            },
            getFilePath: () => {
                if (activeFileResource) {
                    return path.normalize(activeFileResource.fsPath);
                }
                return undefined;
            },
            getSelectedText: () => {
                return resolvedVariables['selectedText'];
            },
            getLineNumber: () => {
                return resolvedVariables['lineNumber'];
            },
            getColumnNumber: () => {
                return resolvedVariables['columnNumber'];
            },
            getExtension: async (id) => {
                const installed = await extensionService.getInstalled();
                const found = installed.find(e => e.identifier.id === id);
                return found && { extensionLocation: found.location };
            },
        }, undefined, Promise.resolve(os.homedir()), Promise.resolve(env));
    }
}
export class RemoteTerminalChannel extends Disposable {
    constructor(_environmentService, _logService, _ptyHostService, _productService, _extensionManagementService, _configurationService) {
        super();
        this._environmentService = _environmentService;
        this._logService = _logService;
        this._ptyHostService = _ptyHostService;
        this._productService = _productService;
        this._extensionManagementService = _extensionManagementService;
        this._configurationService = _configurationService;
        this._lastReqId = 0;
        this._pendingCommands = new Map();
        this._onExecuteCommand = this._register(new Emitter());
        this.onExecuteCommand = this._onExecuteCommand.event;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async call(ctx, command, args) {
        switch (command) {
            case "$restartPtyHost" /* RemoteTerminalChannelRequest.RestartPtyHost */: return this._ptyHostService.restartPtyHost.apply(this._ptyHostService, args);
            case "$createProcess" /* RemoteTerminalChannelRequest.CreateProcess */: {
                const uriTransformer = createURITransformer(ctx.remoteAuthority);
                return this._createProcess(uriTransformer, args);
            }
            case "$attachToProcess" /* RemoteTerminalChannelRequest.AttachToProcess */: return this._ptyHostService.attachToProcess.apply(this._ptyHostService, args);
            case "$detachFromProcess" /* RemoteTerminalChannelRequest.DetachFromProcess */: return this._ptyHostService.detachFromProcess.apply(this._ptyHostService, args);
            case "$listProcesses" /* RemoteTerminalChannelRequest.ListProcesses */: return this._ptyHostService.listProcesses.apply(this._ptyHostService, args);
            case "$getLatency" /* RemoteTerminalChannelRequest.GetLatency */: return this._ptyHostService.getLatency.apply(this._ptyHostService, args);
            case "$getPerformanceMarks" /* RemoteTerminalChannelRequest.GetPerformanceMarks */: return this._ptyHostService.getPerformanceMarks.apply(this._ptyHostService, args);
            case "$orphanQuestionReply" /* RemoteTerminalChannelRequest.OrphanQuestionReply */: return this._ptyHostService.orphanQuestionReply.apply(this._ptyHostService, args);
            case "$acceptPtyHostResolvedVariables" /* RemoteTerminalChannelRequest.AcceptPtyHostResolvedVariables */: return this._ptyHostService.acceptPtyHostResolvedVariables.apply(this._ptyHostService, args);
            case "$start" /* RemoteTerminalChannelRequest.Start */: return this._ptyHostService.start.apply(this._ptyHostService, args);
            case "$input" /* RemoteTerminalChannelRequest.Input */: return this._ptyHostService.input.apply(this._ptyHostService, args);
            case "$sendSignal" /* RemoteTerminalChannelRequest.SendSignal */: return this._ptyHostService.sendSignal.apply(this._ptyHostService, args);
            case "$acknowledgeDataEvent" /* RemoteTerminalChannelRequest.AcknowledgeDataEvent */: return this._ptyHostService.acknowledgeDataEvent.apply(this._ptyHostService, args);
            case "$shutdown" /* RemoteTerminalChannelRequest.Shutdown */: return this._ptyHostService.shutdown.apply(this._ptyHostService, args);
            case "$resize" /* RemoteTerminalChannelRequest.Resize */: return this._ptyHostService.resize.apply(this._ptyHostService, args);
            case "$clearBuffer" /* RemoteTerminalChannelRequest.ClearBuffer */: return this._ptyHostService.clearBuffer.apply(this._ptyHostService, args);
            case "$getInitialCwd" /* RemoteTerminalChannelRequest.GetInitialCwd */: return this._ptyHostService.getInitialCwd.apply(this._ptyHostService, args);
            case "$getCwd" /* RemoteTerminalChannelRequest.GetCwd */: return this._ptyHostService.getCwd.apply(this._ptyHostService, args);
            case "$processBinary" /* RemoteTerminalChannelRequest.ProcessBinary */: return this._ptyHostService.processBinary.apply(this._ptyHostService, args);
            case "$sendCommandResult" /* RemoteTerminalChannelRequest.SendCommandResult */: return this._sendCommandResult(args[0], args[1], args[2]);
            case "$installAutoReply" /* RemoteTerminalChannelRequest.InstallAutoReply */: return this._ptyHostService.installAutoReply.apply(this._ptyHostService, args);
            case "$uninstallAllAutoReplies" /* RemoteTerminalChannelRequest.UninstallAllAutoReplies */: return this._ptyHostService.uninstallAllAutoReplies.apply(this._ptyHostService, args);
            case "$getDefaultSystemShell" /* RemoteTerminalChannelRequest.GetDefaultSystemShell */: return this._getDefaultSystemShell.apply(this, args);
            case "$getProfiles" /* RemoteTerminalChannelRequest.GetProfiles */: return this._getProfiles.apply(this, args);
            case "$getEnvironment" /* RemoteTerminalChannelRequest.GetEnvironment */: return this._getEnvironment();
            case "$getWslPath" /* RemoteTerminalChannelRequest.GetWslPath */: return this._getWslPath(args[0], args[1]);
            case "$getTerminalLayoutInfo" /* RemoteTerminalChannelRequest.GetTerminalLayoutInfo */: return this._ptyHostService.getTerminalLayoutInfo(args);
            case "$setTerminalLayoutInfo" /* RemoteTerminalChannelRequest.SetTerminalLayoutInfo */: return this._ptyHostService.setTerminalLayoutInfo(args);
            case "$serializeTerminalState" /* RemoteTerminalChannelRequest.SerializeTerminalState */: return this._ptyHostService.serializeTerminalState.apply(this._ptyHostService, args);
            case "$reviveTerminalProcesses" /* RemoteTerminalChannelRequest.ReviveTerminalProcesses */: return this._ptyHostService.reviveTerminalProcesses.apply(this._ptyHostService, args);
            case "$getRevivedPtyNewId" /* RemoteTerminalChannelRequest.GetRevivedPtyNewId */: return this._ptyHostService.getRevivedPtyNewId.apply(this._ptyHostService, args);
            case "$setUnicodeVersion" /* RemoteTerminalChannelRequest.SetUnicodeVersion */: return this._ptyHostService.setUnicodeVersion.apply(this._ptyHostService, args);
            case "$setNextCommandId" /* RemoteTerminalChannelRequest.SetNextCommandId */: return this._ptyHostService.setNextCommandId.apply(this._ptyHostService, args);
            case "$reduceConnectionGraceTime" /* RemoteTerminalChannelRequest.ReduceConnectionGraceTime */: return this._reduceConnectionGraceTime();
            case "$updateIcon" /* RemoteTerminalChannelRequest.UpdateIcon */: return this._ptyHostService.updateIcon.apply(this._ptyHostService, args);
            case "$updateTitle" /* RemoteTerminalChannelRequest.UpdateTitle */: return this._ptyHostService.updateTitle.apply(this._ptyHostService, args);
            case "$updateProperty" /* RemoteTerminalChannelRequest.UpdateProperty */: return this._ptyHostService.updateProperty.apply(this._ptyHostService, args);
            case "$refreshProperty" /* RemoteTerminalChannelRequest.RefreshProperty */: return this._ptyHostService.refreshProperty.apply(this._ptyHostService, args);
            case "$requestDetachInstance" /* RemoteTerminalChannelRequest.RequestDetachInstance */: return this._ptyHostService.requestDetachInstance(args[0], args[1]);
            case "$acceptDetachedInstance" /* RemoteTerminalChannelRequest.AcceptDetachedInstance */: return this._ptyHostService.acceptDetachInstanceReply(args[0], args[1]);
            case "$freePortKillProcess" /* RemoteTerminalChannelRequest.FreePortKillProcess */: return this._ptyHostService.freePortKillProcess.apply(this._ptyHostService, args);
            case "$acceptDetachInstanceReply" /* RemoteTerminalChannelRequest.AcceptDetachInstanceReply */: return this._ptyHostService.acceptDetachInstanceReply.apply(this._ptyHostService, args);
        }
        // @ts-expect-error Assert command is the `never` type to ensure all messages are handled
        throw new Error(`IPC Command ${command} not found`);
    }
    listen(_, event, _arg) {
        switch (event) {
            case "$onPtyHostExitEvent" /* RemoteTerminalChannelEvent.OnPtyHostExitEvent */: return (this._ptyHostService.onPtyHostExit || Event.None);
            case "$onPtyHostStartEvent" /* RemoteTerminalChannelEvent.OnPtyHostStartEvent */: return (this._ptyHostService.onPtyHostStart || Event.None);
            case "$onPtyHostUnresponsiveEvent" /* RemoteTerminalChannelEvent.OnPtyHostUnresponsiveEvent */: return (this._ptyHostService.onPtyHostUnresponsive || Event.None);
            case "$onPtyHostResponsiveEvent" /* RemoteTerminalChannelEvent.OnPtyHostResponsiveEvent */: return (this._ptyHostService.onPtyHostResponsive || Event.None);
            case "$onPtyHostRequestResolveVariablesEvent" /* RemoteTerminalChannelEvent.OnPtyHostRequestResolveVariablesEvent */: return (this._ptyHostService.onPtyHostRequestResolveVariables || Event.None);
            case "$onProcessDataEvent" /* RemoteTerminalChannelEvent.OnProcessDataEvent */: return (this._ptyHostService.onProcessData);
            case "$onProcessReadyEvent" /* RemoteTerminalChannelEvent.OnProcessReadyEvent */: return (this._ptyHostService.onProcessReady);
            case "$onProcessExitEvent" /* RemoteTerminalChannelEvent.OnProcessExitEvent */: return (this._ptyHostService.onProcessExit);
            case "$onProcessReplayEvent" /* RemoteTerminalChannelEvent.OnProcessReplayEvent */: return (this._ptyHostService.onProcessReplay);
            case "$onProcessOrphanQuestion" /* RemoteTerminalChannelEvent.OnProcessOrphanQuestion */: return (this._ptyHostService.onProcessOrphanQuestion);
            case "$onExecuteCommand" /* RemoteTerminalChannelEvent.OnExecuteCommand */: return (this.onExecuteCommand);
            case "$onDidRequestDetach" /* RemoteTerminalChannelEvent.OnDidRequestDetach */: return (this._ptyHostService.onDidRequestDetach || Event.None);
            case "$onDidChangeProperty" /* RemoteTerminalChannelEvent.OnDidChangeProperty */: return (this._ptyHostService.onDidChangeProperty);
        }
        // @ts-expect-error Assert event is the `never` type to ensure all messages are handled
        throw new Error(`IPC Command ${event} not found`);
    }
    async _createProcess(uriTransformer, args) {
        const shellLaunchConfig = {
            name: args.shellLaunchConfig.name,
            executable: args.shellLaunchConfig.executable,
            args: args.shellLaunchConfig.args,
            cwd: (typeof args.shellLaunchConfig.cwd === 'string' || typeof args.shellLaunchConfig.cwd === 'undefined'
                ? args.shellLaunchConfig.cwd
                : URI.revive(uriTransformer.transformIncoming(args.shellLaunchConfig.cwd))),
            env: args.shellLaunchConfig.env,
            useShellEnvironment: args.shellLaunchConfig.useShellEnvironment,
            reconnectionProperties: args.shellLaunchConfig.reconnectionProperties,
            type: args.shellLaunchConfig.type,
            isFeatureTerminal: args.shellLaunchConfig.isFeatureTerminal,
            tabActions: args.shellLaunchConfig.tabActions,
            shellIntegrationEnvironmentReporting: args.shellLaunchConfig.shellIntegrationEnvironmentReporting,
        };
        const baseEnv = await buildUserEnvironment(args.resolverEnv, !!args.shellLaunchConfig.useShellEnvironment, platform.language, this._environmentService, this._logService, this._configurationService);
        this._logService.trace('baseEnv', baseEnv);
        const reviveWorkspaceFolder = (workspaceData) => {
            return {
                uri: URI.revive(uriTransformer.transformIncoming(workspaceData.uri)),
                name: workspaceData.name,
                index: workspaceData.index,
                toResource: () => {
                    throw new Error('Not implemented');
                }
            };
        };
        const workspaceFolders = args.workspaceFolders.map(reviveWorkspaceFolder);
        const activeWorkspaceFolder = args.activeWorkspaceFolder ? reviveWorkspaceFolder(args.activeWorkspaceFolder) : undefined;
        const activeFileResource = args.activeFileResource ? URI.revive(uriTransformer.transformIncoming(args.activeFileResource)) : undefined;
        const customVariableResolver = new CustomVariableResolver(baseEnv, workspaceFolders, activeFileResource, args.resolvedVariables, this._extensionManagementService);
        const variableResolver = terminalEnvironment.createVariableResolver(activeWorkspaceFolder, process.env, customVariableResolver);
        // Get the initial cwd
        const initialCwd = await terminalEnvironment.getCwd(shellLaunchConfig, os.homedir(), variableResolver, activeWorkspaceFolder?.uri, args.configuration['terminal.integrated.cwd'], this._logService);
        shellLaunchConfig.cwd = initialCwd;
        const envPlatformKey = platform.isWindows ? 'terminal.integrated.env.windows' : (platform.isMacintosh ? 'terminal.integrated.env.osx' : 'terminal.integrated.env.linux');
        const envFromConfig = args.configuration[envPlatformKey];
        const env = await terminalEnvironment.createTerminalEnvironment(shellLaunchConfig, envFromConfig, variableResolver, this._productService.version, args.configuration['terminal.integrated.detectLocale'], baseEnv);
        // Apply extension environment variable collections to the environment
        if (shouldUseEnvironmentVariableCollection(shellLaunchConfig)) {
            const entries = [];
            for (const [k, v, d] of args.envVariableCollections) {
                entries.push([k, { map: deserializeEnvironmentVariableCollection(v), descriptionMap: deserializeEnvironmentDescriptionMap(d) }]);
            }
            const envVariableCollections = new Map(entries);
            const mergedCollection = new MergedEnvironmentVariableCollection(envVariableCollections);
            const workspaceFolder = activeWorkspaceFolder ? activeWorkspaceFolder ?? undefined : undefined;
            await mergedCollection.applyToProcessEnvironment(env, { workspaceFolder }, variableResolver);
        }
        // Fork the process and listen for messages
        this._logService.debug(`Terminal process launching on remote agent`, { shellLaunchConfig, initialCwd, cols: args.cols, rows: args.rows, env });
        // Setup the CLI server to support forwarding commands run from the CLI
        const ipcHandlePath = createRandomIPCHandle();
        env.VSCODE_IPC_HOOK_CLI = ipcHandlePath;
        const persistentProcessId = await this._ptyHostService.createProcess(shellLaunchConfig, initialCwd, args.cols, args.rows, args.unicodeVersion, env, baseEnv, args.options, args.shouldPersistTerminal, args.workspaceId, args.workspaceName);
        const commandsExecuter = {
            executeCommand: (id, ...args) => this._executeCommand(persistentProcessId, id, args, uriTransformer)
        };
        const cliServer = new CLIServerBase(commandsExecuter, this._logService, ipcHandlePath);
        this._ptyHostService.onProcessExit(e => e.id === persistentProcessId && cliServer.dispose());
        return {
            persistentTerminalId: persistentProcessId,
            resolvedShellLaunchConfig: shellLaunchConfig
        };
    }
    _executeCommand(persistentProcessId, commandId, commandArgs, uriTransformer) {
        const { resolve, reject, promise } = promiseWithResolvers();
        const reqId = ++this._lastReqId;
        this._pendingCommands.set(reqId, { resolve: resolve, reject, uriTransformer });
        const serializedCommandArgs = cloneAndChange(commandArgs, (obj) => {
            if (obj && obj.$mid === 1) {
                // this is UriComponents
                return uriTransformer.transformOutgoing(obj);
            }
            if (obj && obj instanceof URI) {
                return uriTransformer.transformOutgoingURI(obj);
            }
            return undefined;
        });
        this._onExecuteCommand.fire({
            reqId,
            persistentProcessId,
            commandId,
            commandArgs: serializedCommandArgs
        });
        return promise;
    }
    _sendCommandResult(reqId, isError, serializedPayload) {
        const data = this._pendingCommands.get(reqId);
        if (!data) {
            return;
        }
        this._pendingCommands.delete(reqId);
        const payload = cloneAndChange(serializedPayload, (obj) => {
            if (obj && obj.$mid === 1) {
                // this is UriComponents
                return data.uriTransformer.transformIncoming(obj);
            }
            return undefined;
        });
        if (isError) {
            data.reject(payload);
        }
        else {
            data.resolve(payload);
        }
    }
    _getDefaultSystemShell(osOverride) {
        return this._ptyHostService.getDefaultSystemShell(osOverride);
    }
    async _getProfiles(workspaceId, profiles, defaultProfile, includeDetectedProfiles) {
        return this._ptyHostService.getProfiles(workspaceId, profiles, defaultProfile, includeDetectedProfiles) || [];
    }
    _getEnvironment() {
        return { ...process.env };
    }
    _getWslPath(original, direction) {
        return this._ptyHostService.getWslPath(original, direction);
    }
    _reduceConnectionGraceTime() {
        return this._ptyHostService.reduceConnectionGraceTime();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVtb3RlVGVybWluYWxDaGFubmVsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3NlcnZlci9ub2RlL3JlbW90ZVRlcm1pbmFsQ2hhbm5lbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssRUFBRSxNQUFNLElBQUksQ0FBQztBQUN6QixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQzVELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDNUQsT0FBTyxLQUFLLElBQUksTUFBTSwyQkFBMkIsQ0FBQztBQUNsRCxPQUFPLEtBQUssUUFBUSxNQUFNLCtCQUErQixDQUFDO0FBQzFELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUcvQyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUs3RSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsYUFBYSxFQUFxQixNQUFNLDhDQUE4QyxDQUFDO0FBRWhHLE9BQU8sRUFBRSxtQ0FBbUMsRUFBRSxNQUFNLGlFQUFpRSxDQUFDO0FBQ3RILE9BQU8sRUFBRSxvQ0FBb0MsRUFBRSx3Q0FBd0MsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBRTdKLE9BQU8sS0FBSyxtQkFBbUIsTUFBTSxnRUFBZ0UsQ0FBQztBQUN0RyxPQUFPLEVBQUUsK0JBQStCLEVBQUUsTUFBTSwyRUFBMkUsQ0FBQztBQUM1SCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQU1wRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNsRSxPQUFP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