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
import { DisposableMap, DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { URI as uri } from '../../../base/common/uri.js';
import { IDebugService, IDebugVisualization } from '../../contrib/debug/common/debug.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import severity from '../../../base/common/severity.js';
import { AbstractDebugAdapter } from '../../contrib/debug/common/abstractDebugAdapter.js';
import { convertToVSCPaths, convertToDAPaths, isSessionAttach } from '../../contrib/debug/common/debugUtils.js';
import { ErrorNoTelemetry } from '../../../base/common/errors.js';
import { IDebugVisualizerService } from '../../contrib/debug/common/debugVisualizers.js';
import { ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
import { Event } from '../../../base/common/event.js';
import { isDefined } from '../../../base/common/types.js';
let MainThreadDebugService = class MainThreadDebugService {
    constructor(extHostContext, debugService, visualizerService) {
        this.debugService = debugService;
        this.visualizerService = visualizerService;
        this._toDispose = new DisposableStore();
        this._debugAdaptersHandleCounter = 1;
        this._visualizerHandles = new Map();
        this._visualizerTreeHandles = new Map();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostDebugService);
        const sessionListeners = new DisposableMap();
        this._toDispose.add(sessionListeners);
        this._toDispose.add(debugService.onDidNewSession(session => {
            this._proxy.$acceptDebugSessionStarted(this.getSessionDto(session));
            const store = sessionListeners.get(session);
            store?.add(session.onDidChangeName(name => {
                this._proxy.$acceptDebugSessionNameChanged(this.getSessionDto(session), name);
            }));
        }));
        // Need to start listening early to new session events because a custom event can come while a session is initialising
        this._toDispose.add(debugService.onWillNewSession(session => {
            let store = sessionListeners.get(session);
            if (!store) {
                store = new DisposableStore();
                sessionListeners.set(session, store);
            }
            store.add(session.onDidCustomEvent(event => this._proxy.$acceptDebugSessionCustomEvent(this.getSessionDto(session), event)));
        }));
        this._toDispose.add(debugService.onDidEndSession(({ session, restart }) => {
            this._proxy.$acceptDebugSessionTerminated(this.getSessionDto(session));
            this._extHostKnownSessions.delete(session.getId());
            // keep the session listeners around since we still will get events after they restart
            if (!restart) {
                sessionListeners.deleteAndDispose(session);
            }
            // any restarted session will create a new DA, so always throw the old one away.
            for (const [handle, value] of this._debugAdapters) {
                if (value.session === session) {
                    this._debugAdapters.delete(handle);
                    // break;
                }
            }
        }));
        this._toDispose.add(debugService.getViewModel().onDidFocusSession(session => {
            this._proxy.$acceptDebugSessionActiveChanged(this.getSessionDto(session));
        }));
        this._toDispose.add(toDisposable(() => {
            for (const [handle, da] of this._debugAdapters) {
                da.fireError(handle, new Error('Extension host shut down'));
            }
        }));
        this._debugAdapters = new Map();
        this._debugConfigurationProviders = new Map();
        this._debugAdapterDescriptorFactories = new Map();
        this._extHostKnownSessions = new Set();
        const viewModel = this.debugService.getViewModel();
        this._toDispose.add(Event.any(viewModel.onDidFocusStackFrame, viewModel.onDidFocusThread)(() => {
            const stackFrame = viewModel.focusedStackFrame;
            const thread = viewModel.focusedThread;
            if (stackFrame) {
                this._proxy.$acceptStackFrameFocus({
                    kind: 'stackFrame',
                    threadId: stackFrame.thread.threadId,
                    frameId: stackFrame.frameId,
                    sessionId: stackFrame.thread.session.getId(),
                });
            }
            else if (thread) {
                this._proxy.$acceptStackFrameFocus({
                    kind: 'thread',
                    threadId: thread.threadId,
                    sessionId: thread.session.getId(),
                });
            }
            else {
                this._proxy.$acceptStackFrameFocus(undefined);
            }
        }));
        this.sendBreakpointsAndListen();
    }
    $registerDebugVisualizerTree(treeId, canEdit) {
        this._visualizerTreeHandles.set(treeId, this.visualizerService.registerTree(treeId, {
            disposeItem: id => this._proxy.$disposeVisualizedTree(id),
            getChildren: e => this._proxy.$getVisualizerTreeItemChildren(treeId, e),
            getTreeItem: e => this._proxy.$getVisualizerTreeItem(treeId, e),
            editItem: canEdit ? ((e, v) => this._proxy.$editVisualizerTreeItem(e, v)) : undefined
        }));
    }
    $unregisterDebugVisualizerTree(treeId) {
        this._visualizerTreeHandles.get(treeId)?.dispose();
        this._visualizerTreeHandles.delete(treeId);
    }
    $registerDebugVisualizer(extensionId, id) {
        const handle = this.visualizerService.register({
            extensionId: new ExtensionIdentifier(extensionId),
            id,
            disposeDebugVisualizers: ids => this._proxy.$disposeDebugVisualizers(ids),
            executeDebugVisualizerCommand: id => this._proxy.$executeDebugVisualizerCommand(id),
            provideDebugVisualizers: (context, token) => this._proxy.$provideDebugVisualizers(extensionId, id, context, token).then(r => r.map(IDebugVisualization.deserialize)),
            resolveDebugVisualizer: (viz, token) => this._proxy.$resolveDebugVisualizer(viz.id, token),
        });
        this._visualizerHandles.set(`${extensionId}/${id}`, handle);
    }
    $unregisterDebugVisualizer(extensionId, id) {
        const key = `${extensionId}/${id}`;
        this._visualizerHandles.get(key)?.dispose();
        this._visualizerHandles.delete(key);
    }
    sendBreakpointsAndListen() {
        // set up a handler to send more
        this._toDispose.add(this.debugService.getModel().onDidChangeBreakpoints(e => {
            // Ignore session only breakpoint events since they should only reflect in the UI
            if (e && !e.sessionOnly) {
                const delta = {};
                if (e.added) {
                    delta.added = this.convertToDto(e.added);
                }
                if (e.removed) {
                    delta.removed = e.removed.map(x => x.getId());
                }
                if (e.changed) {
                    delta.changed = this.convertToDto(e.changed);
                }
                if (delta.added || delta.removed || delta.changed) {
                    this._proxy.$acceptBreakpointsDelta(delta);
                }
            }
        }));
        // send all breakpoints
        const bps = this.debugService.getModel().getBreakpoints();
        const fbps = this.debugService.getModel().getFunctionBreakpoints();
        const dbps = this.debugService.getModel().getDataBreakpoints();
        if (bps.length > 0 || fbps.length > 0) {
            this._proxy.$acceptBreakpointsDelta({
                added: this.convertToDto(bps).concat(this.convertToDto(fbps)).concat(this.convertToDto(dbps))
            });
        }
    }
    dispose() {
        this._toDispose.dispose();
    }
    // interface IDebugAdapterProvider
    createDebugAdapter(session) {
        const handle = this._debugAdaptersHandleCounter++;
        const da = new ExtensionHostDebugAdapter(this, handle, this._proxy, session);
        this._debugAdapters.set(handle, da);
        return da;
    }
    substituteVariables(folder, config) {
        return Promise.resolve(this._proxy.$substituteVariables(folder ? folder.uri : undefined, config));
    }
    runInTerminal(args, sessionId) {
        return this._proxy.$runInTerminal(args, sessionId);
    }
    // RPC methods (MainThreadDebugServiceShape)
    $registerDebugTypes(debugTypes) {
        this._toDispose.add(this.debugService.getAdapterManager().registerDebugAdapterFactory(debugTypes, this));
    }
    $registerBreakpoints(DTOs) {
        for (const dto of DTOs) {
            if (dto.type === 'sourceMulti') {
                const rawbps = dto.lines.map((l) => ({
                    id: l.id,
                    enabled: l.enabled,
                    lineNumber: l.line + 1,
                    column: l.character > 0 ? l.character + 1 : undefined, // a column value of 0 results in an omitted column attribute; see #46784
                    condition: l.condition,
                    hitCondition: l.hitCondition,
                    logMessage: l.logMessage,
                    mode: l.mode,
                }));
                this.debugService.addBreakpoints(uri.revive(dto.uri), rawbps);
            }
            else if (dto.type === 'function') {
                this.debugService.addFunctionBreakpoint({
                    name: dto.functionName,
                    mode: dto.mode,
                    condition: dto.condition,
                    hitCondition: dto.hitCondition,
                    enabled: dto.enabled,
                    logMessage: dto.logMessage
                }, dto.id);
            }
            else if (dto.type === 'data') {
                this.debugService.addDataBreakpoint({
                    description: dto.label,
                    src: { type: 0 /* DataBreakpointSetType.Variable */, dataId: dto.dataId },
                    canPersist: dto.canPersist,
                    accessTypes: dto.accessTypes,
                    accessType: dto.accessType,
                    mode: dto.mode
                });
            }
        }
        return Promise.resolve();
    }
    $unregisterBreakpoints(breakpointIds, functionBreakpointIds, dataBreakpointIds) {
        breakpointIds.forEach(id => this.debugService.removeBreakpoints(id));
        functionBreakpointIds.forEach(id => this.debugService.removeFunctionBreakpoints(id));
        dataBreakpointIds.forEach(id => this.debugService.removeDataBreakpoints(id));
        return Promise.resolve();
    }
    $registerDebugConfigurationProvider(debugType, providerTriggerKind, hasProvide, hasResolve, hasResolve2, handle) {
        const provider = {
            type: debugType,
            triggerKind: providerTriggerKind
        };
        if (hasProvide) {
            provider.provideDebugConfigurations = (folder, token) => {
                return this._proxy.$provideDebugConfigurations(handle, folder, token);
            };
        }
        if (hasResolve) {
            provider.resolveDebugConfiguration = (folder, config, token) => {
                return this._proxy.$resolveDebugConfiguration(handle, folder, config, token);
            };
        }
        if (hasResolve2) {
            provider.resolveDebugConfigurationWithSubstitutedVariables = (folder, config, token) => {
                return this._proxy.$resolveDebugConfigurationWithSubstitutedVariables(handle, folder, config, token);
            };
        }
        this._debugConfigurationProviders.set(handle, provider);
        this._toDispose.add(this.debugService.getConfigurationManager().registerDebugConfigurationProvider(provider));
        return Promise.resolve(undefined);
    }
    $unregisterDebugConfigurationProvider(handle) {
        const provider = this._debugConfigurationProviders.get(handle);
        if (provider) {
            this._debugConfigurationProviders.delete(handle);
            this.debugService.getConfigurationManager().unregisterDebugConfigurationProvider(provider);
        }
    }
    $registerDebugAdapterDescriptorFactory(debugType, handle) {
        const provider = {
            type: debugType,
            createDebugAdapterDescriptor: session => {
                return Promise.resolve(this._proxy.$provideDebugAdapter(handle, this.getSessionDto(session)));
            }
        };
        this._debugAdapterDescriptorFactories.set(handle, provider);
        this._toDispose.add(this.debugService.getAdapterManager().registerDebugAdapterDescriptorFactory(provider));
        return Promise.resolve(undefined);
    }
    $unregisterDebugAdapterDescriptorFactory(handle) {
        const provider = this._debugAdapterDescriptorFactories.get(handle);
        if (provider) {
            this._debugAdapterDescriptorFactories.delete(handle);
            this.debugService.getAdapterManager().unregisterDebugAdapterDescriptorFactory(provider);
        }
    }
    getSession(sessionId) {
        if (sessionId) {
            return this.debugService.getModel().getSession(sessionId, true);
        }
        return undefined;
    }
    async $startDebugging(folder, nameOrConfig, options) {
        const folderUri = folder ? uri.revive(folder) : undefined;
        const launch = this.debugService.getConfigurationManager().getLaunch(folderUri);
        const parentSession = this.getSession(options.parentSessionID);
        const saveBeforeStart = typeof options.suppressSaveBeforeStart === 'boolean' ? !options.suppressSaveBeforeStart : undefined;
        const debugOptions = {
            noDebug: options.noDebug,
            parentSession,
            lifecycleManagedByParent: options.lifecycleManagedByParent,
            repl: options.repl,
            compact: options.compact,
            compoundRoot: parentSession?.compoundRoot,
            saveBeforeRestart: saveBeforeStart,
            testRun: options.testRun,
            suppressDebugStatusbar: options.suppressDebugStatusbar,
            suppressDebugToolbar: options.suppressDebugToolbar,
            suppressDebugView: options.suppressDebugView,
        };
        try {
            return this.debugService.startDebugging(launch, nameOrConfig, debugOptions, saveBeforeStart);
        }
        catch (err) {
            throw new ErrorNoTelemetry(err && err.message ? err.message : 'cannot start debugging');
        }
    }
    $setDebugSessionName(sessionId, name) {
        const session = this.debugService.getModel().getSession(sessionId);
        session?.setName(name);
    }
    $customDebugAdapterRequest(sessionId, request, args) {
        const session = this.debugService.getModel().getSession(sessionId, true);
        if (session) {
            return session.customRequest(request, args).then(response => {
                if (response && response.success) {
                    return response.body;
                }
                else {
                    return Promise.reject(new ErrorNoTelemetry(response ? response.message : 'custom request failed'));
                }
            });
        }
        return Promise.reject(new ErrorNoTelemetry('debug session not found'));
    }
    $getDebugProtocolBreakpoint(sessionId, breakpoinId) {
        const session = this.debugService.getModel().getSession(sessionId, true);
        if (session) {
            return Promise.resolve(session.getDebugProtocolBreakpoint(breakpoinId));
        }
        return Promise.reject(new ErrorNoTelemetry('debug session not found'));
    }
    $stopDebugging(sessionId) {
        if (sessionId) {
            const session = this.debugService.getModel().getSession(sessionId, true);
            if (session) {
                return this.debugService.stopSession(session, isSessionAttach(session));
            }
        }
        else { // stop all
            return this.debugService.stopSession(undefined);
        }
        return Promise.reject(new ErrorNoTelemetry('debug session not found'));
    }
    $appendDebugConsole(value) {
        // Use warning as severity to get the orange color for messages coming from the debug extension
        const session = this.debugService.getViewModel().focusedSession;
        session?.appendToRepl({ output: value, sev: severity.Warning });
    }
    $acceptDAMessage(handle, message) {
        this.getDebugAdapter(handle).acceptMessage(convertToVSCPaths(message, false));
    }
    $acceptDAError(handle, name, message, stack) {
        // don't use getDebugAdapter since an error can be expected on a post-close
        this._debugAdapters.get(handle)?.fireError(handle, new Error(`${name}: ${message}\n${stack}`));
    }
    $acceptDAExit(handle, code, signal) {
        // don't use getDebugAdapter since an error can be expected on a post-close
        this._debugAdapters.get(handle)?.fireExit(handle, code, signal);
    }
    getDebugAdapter(handle) {
        const adapter = this._debugAdapters.get(handle);
        if (!adapter) {
            throw new Error('Invalid debug adapter');
        }
        return adapter;
    }
    // dto helpers
    $sessionCached(sessionID) {
        // remember that the EH has cached the session and we do not have to send it again
        this._extHostKnownSessions.add(sessionID);
    }
    getSessionDto(session) {
        if (session) {
            const sessionID = session.getId();
            if (this._extHostKnownSessions.has(sessionID)) {
                return sessionID;
            }
            else {
                // this._sessions.add(sessionID); 	// #69534: see $sessionCached above
                return {
                    id: sessionID,
                    type: session.configuration.type,
                    name: session.name,
                    folderUri: session.root ? session.root.uri : undefined,
                    configuration: session.configuration,
                    parent: session.parentSession?.getId(),
                };
            }
        }
        return undefined;
    }
    convertToDto(bps) {
        return bps.map(bp => {
            if ('name' in bp) {
                const fbp = bp;
                return {
                    type: 'function',
                    id: fbp.getId(),
                    enabled: fbp.enabled,
                    condition: fbp.condition,
                    hitCondition: fbp.hitCondition,
                    logMessage: fbp.logMessage,
                    functionName: fbp.name
                };
            }
            else if ('src' in bp) {
                const dbp = bp;
                return {
                    type: 'data',
                    id: dbp.getId(),
                    dataId: dbp.src.type === 0 /* DataBreakpointSetType.Variable */ ? dbp.src.dataId : dbp.src.address,
                    enabled: dbp.enabled,
                    condition: dbp.condition,
                    hitCondition: dbp.hitCondition,
                    logMessage: dbp.logMessage,
                    accessType: dbp.accessType,
                    label: dbp.description,
                    canPersist: dbp.canPersist
                };
            }
            else if ('uri' in bp) {
                const sbp = bp;
                return {
                    type: 'source',
                    id: sbp.getId(),
                    enabled: sbp.enabled,
                    condition: sbp.condition,
                    hitCondition: sbp.hitCondition,
                    logMessage: sbp.logMessage,
                    uri: sbp.uri,
                    line: sbp.lineNumber > 0 ? sbp.lineNumber - 1 : 0,
                    character: (typeof sbp.column === 'number' && sbp.column > 0) ? sbp.column - 1 : 0,
                };
            }
            else {
                return undefined;
            }
        }).filter(isDefined);
    }
};
MainThreadDebugService = __decorate([
    extHostNamedCustomer(MainContext.MainThreadDebugService),
    __param(1, IDebugService),
    __param(2, IDebugVisualizerService)
], MainThreadDebugService);
export { MainThreadDebugService };
/**
 * DebugAdapter that communicates via extension protocol with another debug adapter.
 */
class ExtensionHostDebugAdapter extends AbstractDebugAdapter {
    constructor(_ds, _handle, _proxy, session) {
        super();
        this._ds = _ds;
        this._handle = _handle;
        this._proxy = _proxy;
        this.session = session;
    }
    fireError(handle, err) {
        this._onError.fire(err);
    }
    fireExit(handle, code, signal) {
        this._onExit.fire(code);
    }
    startSession() {
        return Promise.resolve(this._proxy.$startDASession(this._handle, this._ds.getSessionDto(this.session)));
    }
    sendMessage(message) {
        this._proxy.$sendDAMessage(this._handle, convertToDAPaths(message, true));
    }
    async stopSession() {
        await this.cancelPendingRequests();
        return Promise.resolve(this._proxy.$stopDASession(this._handle));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZERlYnVnU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZERlYnVnU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBZSxZQUFZLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM5RyxPQUFPLEVBQUUsR0FBRyxJQUFJLEdBQUcsRUFBaUIsTUFBTSw2QkFBNkIsQ0FBQztBQUN4RSxPQUFPLEVBQUUsYUFBYSxFQUFxUixtQkFBbUIsRUFBeUIsTUFBTSxxQ0FBcUMsQ0FBQztBQUNuWSxPQUFPLEVBQ04sY0FBYyxFQUEyRSxXQUFXLEVBRXBHLE1BQU0sK0JBQStCLENBQUM7QUFDdkMsT0FBTyxFQUFFLG9CQUFvQixFQUFtQixNQUFNLHNEQUFzRCxDQUFDO0FBQzdHLE9BQU8sUUFBUSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBRTFGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRSxlQUFlLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNoSCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUN6RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUN4RixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDdEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBR25ELElBQU0sc0JBQXNCLEdBQTVCLE1BQU0sc0JBQXNCO0lBWWxDLFlBQ0MsY0FBK0Is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