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
import { coalesce } from '../../../base/common/arrays.js';
import { asPromise } from '../../../base/common/async.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable as DisposableCls, toDisposable } from '../../../base/common/lifecycle.js';
import { ThemeIcon as ThemeIconUtils } from '../../../base/common/themables.js';
import { URI } from '../../../base/common/uri.js';
import { ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { AbstractDebugAdapter } from '../../contrib/debug/common/abstractDebugAdapter.js';
import { convertToDAPaths, convertToVSCPaths, isDebuggerMainContribution } from '../../contrib/debug/common/debugUtils.js';
import { MainContext } from './extHost.protocol.js';
import { IExtHostCommands } from './extHostCommands.js';
import { IExtHostConfiguration } from './extHostConfiguration.js';
import { IExtHostEditorTabs } from './extHostEditorTabs.js';
import { IExtHostExtensionService } from './extHostExtensionService.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import { IExtHostTesting } from './extHostTesting.js';
import * as Convert from './extHostTypeConverters.js';
import { DataBreakpoint, DebugAdapterExecutable, DebugAdapterInlineImplementation, DebugAdapterNamedPipeServer, DebugAdapterServer, DebugConsoleMode, DebugStackFrame, DebugThread, Disposable, FunctionBreakpoint, Location, Position, setBreakpointId, SourceBreakpoint, ThemeIcon } from './extHostTypes.js';
import { IExtHostVariableResolverProvider } from './extHostVariableResolverService.js';
import { IExtHostWorkspace } from './extHostWorkspace.js';
export const IExtHostDebugService = createDecorator('IExtHostDebugService');
let ExtHostDebugServiceBase = class ExtHostDebugServiceBase extends DisposableCls {
    get onDidStartDebugSession() { return this._onDidStartDebugSession.event; }
    get onDidTerminateDebugSession() { return this._onDidTerminateDebugSession.event; }
    get onDidChangeActiveDebugSession() { return this._onDidChangeActiveDebugSession.event; }
    get activeDebugSession() { return this._activeDebugSession?.api; }
    get onDidReceiveDebugSessionCustomEvent() { return this._onDidReceiveDebugSessionCustomEvent.event; }
    get activeDebugConsole() { return this._activeDebugConsole.value; }
    constructor(extHostRpcService, _workspaceService, _extensionService, _configurationService, _editorTabs, _variableResolver, _commands, _testing) {
        super();
        this._workspaceService = _workspaceService;
        this._extensionService = _extensionService;
        this._configurationService = _configurationService;
        this._editorTabs = _editorTabs;
        this._variableResolver = _variableResolver;
        this._commands = _commands;
        this._testing = _testing;
        this._debugSessions = new Map();
        this._debugVisualizationTreeItemIdsCounter = 0;
        this._debugVisualizationProviders = new Map();
        this._debugVisualizationTrees = new Map();
        this._debugVisualizationTreeItemIds = new WeakMap();
        this._debugVisualizationElements = new Map();
        this._visualizers = new Map();
        this._visualizerIdCounter = 0;
        this._configProviderHandleCounter = 0;
        this._configProviders = [];
        this._adapterFactoryHandleCounter = 0;
        this._adapterFactories = [];
        this._trackerFactoryHandleCounter = 0;
        this._trackerFactories = [];
        this._debugAdapters = new Map();
        this._debugAdaptersTrackers = new Map();
        this._onDidStartDebugSession = this._register(new Emitter());
        this._onDidTerminateDebugSession = this._register(new Emitter());
        this._onDidChangeActiveDebugSession = this._register(new Emitter());
        this._onDidReceiveDebugSessionCustomEvent = this._register(new Emitter());
        this._debugServiceProxy = extHostRpcService.getProxy(MainContext.MainThreadDebugService);
        this._onDidChangeBreakpoints = this._register(new Emitter());
        this._onDidChangeActiveStackItem = this._register(new Emitter());
        this._activeDebugConsole = new ExtHostDebugConsole(this._debugServiceProxy);
        this._breakpoints = new Map();
        this._extensionService.getExtensionRegistry().then((extensionRegistry) => {
            this._register(extensionRegistry.onDidChange(_ => {
                this.registerAllDebugTypes(extensionRegistry);
            }));
            this.registerAllDebugTypes(extensionRegistry);
        });
        this._telemetryProxy = extHostRpcService.getProxy(MainContext.MainThreadTelemetry);
    }
    async $getVisualizerTreeItem(treeId, element) {
        const context = this.hydrateVisualizationContext(element);
        if (!context) {
            return undefined;
        }
        const item = await this._debugVisualizationTrees.get(treeId)?.getTreeItem?.(context);
        return item ? this.convertVisualizerTreeItem(treeId, item) : undefined;
    }
    registerDebugVisualizationTree(manifest, id, provider) {
        const extensionId = ExtensionIdentifier.toKey(manifest.identifier);
        const key = this.extensionVisKey(extensionId, id);
        if (this._debugVisualizationProviders.has(key)) {
            throw new Error(`A debug visualization provider with id '${id}' is already registered`);
        }
        this._debugVisualizationTrees.set(key, provider);
        this._debugServiceProxy.$registerDebugVisualizerTree(key, !!provider.editItem);
        return toDisposable(() => {
            this._debugServiceProxy.$unregisterDebugVisualizerTree(key);
            this._debugVisualizationTrees.delete(id);
        });
    }
    async $getVisualizerTreeItemChildren(treeId, element) {
        const item = this._debugVisualizationElements.get(element)?.item;
        if (!item) {
            return [];
        }
        const children = await this._debugVisualizationTrees.get(treeId)?.getChildren?.(item);
        return children?.map(i => this.convertVisualizerTreeItem(treeId, i)) || [];
    }
    async $editVisualizerTreeItem(element, value) {
        const e = this._debugVisualizationElements.get(element);
        if (!e) {
            return undefined;
        }
        const r = await this._debugVisualizationTrees.get(e.provider)?.editItem?.(e.item, value);
        return this.convertVisualizerTreeItem(e.provider, r || e.item);
    }
    $disposeVisualizedTree(element) {
        const root = this._debugVisualizationElements.get(element);
        if (!root) {
            return;
        }
        const queue = [root.children];
        for (const children of queue) {
            if (children) {
                for (const child of children) {
                    queue.push(this._debugVisualizationElements.get(child)?.children);
                    this._debugVisualizationElements.delete(child);
                }
            }
        }
    }
    convertVisualizerTreeItem(treeId, item) {
        let id = this._debugVisualizationTreeItemIds.get(item);
        if (!id) {
            id = this._debugVisualizationTreeItemIdsCounter++;
            this._debugVisualizationTreeItemIds.set(item, id);
            this._debugVisualizationElements.set(id, { provider: treeId, item });
        }
        return Convert.DebugTreeItem.from(item, id);
    }
    asDebugSourceUri(src, session) {
        // eslint-disable-next-line local/code-no-any-casts
        const source = src;
        if (typeof source.sourceReference === 'number' && source.sourceReference > 0) {
            // src can be retrieved via DAP's "source" request
            let debug = `debug:${encodeURIComponent(source.path || '')}`;
            let sep = '?';
            if (session) {
                debug += `${sep}session=${encodeURIComponent(session.id)}`;
                sep = '&';
            }
            debug += `${sep}ref=${source.sourceReference}`;
            return URI.parse(debug);
        }
        else if (source.path) {
            // src is just a local file path
            return URI.file(source.path);
        }
        else {
            throw new Error(`cannot create uri from DAP 'source' object; properties 'path' and 'sourceReference' are both missing.`);
        }
    }
    registerAllDebugTypes(extensionRegistry) {
        const debugTypes = [];
        for (const ed of extensionRegistry.getAllExtensionDescriptions()) {
            if (ed.contributes) {
                const debuggers = ed.contributes['debuggers'];
                if (debuggers && debuggers.length > 0) {
                    for (const dbg of debuggers) {
                        if (isDebuggerMainContribution(dbg)) {
                            debugTypes.push(dbg.type);
                        }
                    }
                }
            }
        }
        this._debugServiceProxy.$registerDebugTypes(debugTypes);
    }
    // extension debug API
    get activeStackItem() {
        return this._activeStackItem;
    }
    get onDidChangeActiveStackItem() {
        return this._onDidChangeActiveStackItem.event;
    }
    get onDidChangeBreakpoints() {
        return this._onDidChangeBreakpoints.event;
    }
    get breakpoints() {
        const result = [];
        this._breakpoints.forEach(bp => result.push(bp));
        return result;
    }
    async $resolveDebugVisualizer(id, token) {
        const visualizer = this._visualizers.get(id);
        if (!visualizer) {
            throw new Error(`No debug visualizer found with id '${id}'`);
        }
        let { v, provider, extensionId } = visualizer;
        if (!v.visualization) {
            v = await provider.resolveDebugVisualization?.(v, token) || v;
            visualizer.v = v;
        }
        if (!v.visualization) {
            throw new Error(`No visualization returned from resolveDebugVisualization in '${provider}'`);
        }
        return this.serializeVisualization(extensionId, v.visualization);
    }
    async $executeDebugVisualizerCommand(id) {
        const visualizer = this._visualizers.get(id);
        if (!visualizer) {
            throw new Error(`No debug visualizer found with id '${id}'`);
        }
        const command = visualizer.v.visualization;
        if (command && 'command' in command) {
            this._commands.executeCommand(command.command, ...(command.arguments || []));
        }
    }
    hydrateVisualizationContext(context) {
        const session = this._debugSessions.get(context.sessionId);
        return session && {
            session: session.api,
            variable: context.variable,
            containerId: context.containerId,
            frameId: context.frameId,
            threadId: context.threadId,
        };
    }
    async $provideDebugVisualizers(extensionId, id, context, token) {
        const contextHydrated = this.hydrateVisualizationContext(context);
        const key = this.extensionVisKey(extensionId, id);
        const provider = this._debugVisualizationProviders.get(key);
        if (!contextHydrated || !provider) {
            return []; // probably ended in the meantime
        }
        const visualizations = await provider.provideDebugVisualization(contextHydrated, token);
        if (!visualizations) {
            return [];
        }
        return visualizations.map(v => {
            const id = ++this._visualizerIdCounter;
            this._visualizers.set(id, { v, provider, extensionId });
            const icon = v.iconPath ? this.getIconPathOrClass(v.iconPath) : undefined;
            return {
                id,
                name: v.name,
                iconClass: icon?.iconClass,
                iconPath: icon?.iconPath,
                visualization: this.serializeVisualization(extensionId, v.visualization),
            };
        });
    }
    $disposeDebugVisualizers(ids) {
        for (const id of ids) {
            this._visualizers.delete(id);
        }
    }
    registerDebugVisualizationProvider(manifest, id, provider) {
        if (!manifest.contributes?.debugVisualizers?.some(r => r.id === id)) {
            throw new Error(`Extensions may only call registerDebugVisualizationProvider() for renderers they contribute (got ${id})`);
        }
        const extensionId = ExtensionIdentifier.toKey(manifest.identifier);
        const key = this.extensionVisKey(extensionId, id);
        if (this._debugVisualizationProviders.has(key)) {
            throw new Error(`A debug visualization provider with id '${id}' is already registered`);
        }
        this._debugVisualizationProviders.set(key, provider);
        this._debugServiceProxy.$registerDebugVisualizer(extensionId, id);
        return toDisposable(() => {
            this._debugServiceProxy.$unregisterDebugVisualizer(extensionId, id);
            this._debugVisualizationProviders.delete(id);
        });
    }
    addBreakpoints(breakpoints0) {
        // filter only new breakpoints
        const breakpoints = breakpoints0.filter(bp => {
            const id = bp.id;
            if (!this._breakpoints.has(id)) {
                this._breakpoints.set(id, bp);
                return true;
            }
            return false;
        });
        // send notification for added breakpoints
        this.fireBreakpointChanges(breakpoints, [], []);
        // convert added breakpoints to DTOs
        const dtos = [];
        const map = new Map();
        for (const bp of breakpoints) {
            if (bp instanceof SourceBreakpoint) {
                let dto = map.get(bp.location.uri.toString());
                if (!dto) {
                    dto = {
                        type: 'sourceMulti',
                        uri: bp.location.uri,
                        lines: []
                    };
                    map.set(bp.location.uri.toString(), dto);
                    dtos.push(dto);
                }
                dto.lines.push({
                    id: bp.id,
                    enabled: bp.enabled,
                    condition: bp.condition,
                    hitCondition: bp.hitCondition,
                    logMessage: bp.logMessage,
                    line: bp.location.range.start.line,
                    character: bp.location.range.start.character,
                    mode: bp.mode,
                });
            }
            else if (bp instanceof FunctionBreakpoint) {
                dtos.push({
                    type: 'function',
                    id: bp.id,
                    enabled: bp.enabled,
                    hitCondition: bp.hitCondition,
                    logMessage: bp.logMessage,
                    condition: bp.condition,
                    functionName: bp.functionName,
                    mode: bp.mode,
                });
            }
        }
        // send DTOs to VS Code
        return this._debugServiceProxy.$registerBreakpoints(dtos);
    }
    removeBreakpoints(breakpoints0) {
        // remove from array
        const breakpoints = breakpoints0.filter(b => this._breakpoints.delete(b.id));
        // send notification
        this.fireBreakpointChanges([], breakpoints, []);
        // unregister with VS Code
        const ids = breakpoints.filter(bp => bp instanceof SourceBreakpoint).map(bp => bp.id);
        const fids = breakpoints.filter(bp => bp instanceof FunctionBreakpoint).map(bp => bp.id);
        const dids = breakpoints.filter(bp => bp instanceof DataBreakpoint).map(bp => bp.id);
        return this._debugServiceProxy.$unregisterBreakpoints(ids, fids, dids);
    }
    startDebugging(folder, nameOrConfig, options) {
        const testRunMeta = options.testRun && this._testing.getMetadataForRun(options.testRun);
        return this._debugServiceProxy.$startDebugging(folder ? folder.uri : undefined, nameOrConfig, {
            parentSessionID: options.parentSession ? options.parentSession.id : undefined,
            lifecycleManagedByParent: options.lifecycleManagedByParent,
            repl: options.consoleMode === DebugConsoleMode.MergeWithParent ? 'mergeWithParent' : 'separate',
            noDebug: options.noDebug,
            compact: options.compact,
            suppressSaveBeforeStart: options.suppressSaveBeforeStart,
            testRun: testRunMeta && {
                runId: testRunMeta.runId,
                taskId: testRunMeta.taskId,
            },
            // Check debugUI for back-compat, #147264
            // eslint-disable-next-line local/code-no-any-casts
            suppressDebugStatusbar: options.suppressDebugStatusbar ?? options.debugUI?.simple,
            // eslint-disable-next-line local/code-no-any-casts
            suppressDebugToolbar: options.suppressDebugToolbar ?? options.debugUI?.simple,
            // eslint-disable-next-line local/code-no-any-casts
            suppressDebugView: options.suppressDebugView ?? options.debugUI?.simple,
        });
    }
    stopDebugging(session) {
        return this._debugServiceProxy.$stopDebugging(session ? session.id : undefined);
    }
    registerDebugConfigurationProvider(type, provider, trigger) {
        if (!provider) {
            return new Disposable(() => { });
        }
        const handle = this._configProviderHandleCounter++;
        this._configProviders.push({ type, handle, provider });
        this._debugServiceProxy.$registerDebugConfigurationProvider(type, trigger, !!provider.provideDebugConfigurations, !!provider.resolveDebugConfiguration, !!provider.resolveDebugConfigurationWithSubstitutedVariables, handle);
        return new Disposable(() => {
            this._configProviders = this._configProviders.filter(p => p.provider !== provider); // remove
            this._debugServiceProxy.$unregisterDebugConfigurationProvider(handle);
        });
    }
    registerDebugAdapterDescriptorFactory(extension, type, factory) {
        if (!factory) {
            return new Disposable(() => { });
        }
        // a DebugAdapterDescriptorFactory can only be registered in the extension that contributes the debugger
        if (!this.definesDebugType(extension, type)) {
            throw new Error(`a DebugAdapterDescriptorFactory can only be registered from the extension that defines the '${type}' debugger.`);
        }
        // make sure that only one factory for this type is registered
        if (this.getAdapterDescriptorFactoryByType(type)) {
            throw new Error(`a DebugAdapterDescriptorFactory can only be registered once per a type.`);
        }
        const handle = this._adapterFactoryHandleCounter++;
        this._adapterFactories.push({ type, handle, factory });
        this._debugServiceProxy.$registerDebugAdapterDescriptorFactory(type, handle);
        return new Disposable(() => {
            this._adapterFactories = this._adapterFactories.filter(p => p.factory !== factory); // remove
            this._debugServiceProxy.$unregisterDebugAdapterDescriptorFactory(handle);
        });
    }
    registerDebugAdapterTrackerFactory(type, factory) {
        if (!factory) {
            return new Disposable(() => { });
        }
        const handle = this._trackerFactoryHandleCounter++;
        this._trackerFactories.push({ type, handle, factory });
        return new Disposable(() => {
            this._trackerFactories = this._trackerFactories.filter(p => p.factory !== factory); // remove
        });
    }
    // RPC methods (ExtHostDebugServiceShape)
    async $runInTerminal(args, sessionId) {
        return Promise.resolve(undefined);
    }
    async $substituteVariables(folderUri, config) {
        let ws;
        const folder = await this.getFolder(folderUri);
        if (folder) {
            ws = {
                uri: folder.uri,
                name: folder.name,
                index: folder.index,
            };
        }
        const variableResolver = await this._variableResolver.getResolver();
        return variableResolver.resolveAsync(ws, config);
    }
    createDebugAdapter(adapter, session) {
        if (adapter instanceof DebugAdapterInlineImplementation) {
            return new DirectDebugAdapter(adapter.implementation);
        }
        return undefined;
    }
    createSignService() {
        return undefined;
    }
    async $startDASession(debugAdapterHandle, sessionDto) {
        const mythis = this;
        const session = await this.getSession(sessionDto);
        return this.getAdapterDescriptor(this.getAdapterDescriptorFactoryByType(session.type), session).then(daDescriptor => {
            if (!daDescriptor) {
                throw new Error(`Couldn't find a debug adapter descriptor for debug type '${session.type}' (extension might have failed to activate)`);
            }
            const da = this.createDebugAdapter(daDescriptor, session);
            if (!da) {
                throw new Error(`Couldn't create a debug adapter for type '${session.type}'.`);
            }
            const debugAdapter = da;
            this._debugAdapters.set(debugAdapterHandle, debugAdapter);
            return this.getDebugAdapterTrackers(session).then(tracker => {
                if (tracker) {
                    this._debugAdaptersTrackers.set(debugAdapterHandle, tracker);
                }
                debugAdapter.onMessage(async (message) => {
                    if (message.type === 'request' && message.command === 'handshake') {
                        const request = message;
                        const response = {
                            type: 'response',
                            seq: 0,
                            command: request.command,
                            request_seq: request.seq,
                            success: true
                        };
                        if (!this._signService) {
                            this._signService = this.createSignService();
                        }
                        try {
                            if (this._signService) {
                                const signature = await this._signService.sign(request.arguments.value);
                                response.body = {
                                    signature: signature
                                };
                                debugAdapter.sendResponse(response);
                            }
                            else {
                                throw new Error('no signer');
                            }
                        }
                        catch (e) {
                            response.success = false;
                            response.message = e.message;
                            debugAdapter.sendResponse(response);
                        }
                    }
                    else {
                        if (tracker && tracker.onDidSendMessage) {
                            tracker.onDidSendMessage(message);
                        }
                        // DA -> VS Code
                        try {
                            // Try to catch details for #233167
                            message = convertToVSCPaths(message, true);
                        }
                        catch (e) {
                            // eslint-disable-next-line local/code-no-any-casts
                            const type = message.type + '_' + (message.command ?? message.event ?? '');
                            this._telemetryProxy.$publicLog2('debugProtocolMessageError', { type, from: session.type });
                            throw e;
                        }
                        mythis._debugServiceProxy.$acceptDAMessage(debugAdapterHandle, message);
                    }
                });
                debugAdapter.onError(err => {
                    if (tracker && tracker.onError) {
                        tracker.onError(err);
                    }
                    this._debugServiceProxy.$acceptDAError(debugAdapterHandle, err.name, err.message, err.stack);
                });
                debugAdapter.onExit((code) => {
                    if (tracker && tracker.onExit) {
                        tracker.onExit(code ?? undefined, undefined);
                    }
                    this._debugServiceProxy.$acceptDAExit(debugAdapterHandle, code ?? undefined, undefined);
                });
                if (tracker && tracker.onWillStartSession) {
                    tracker.onWillStartSession();
                }
                return debugAdapter.startSession();
            });
        });
    }
    $sendDAMessage(debugAdapterHandle, message) {
        // VS Code -> DA
        message = convertToDAPaths(message, false);
        const tracker = this._debugAdaptersTrackers.get(debugAdapterHandle); // TODO@AW: same handle?
        if (tracker && tracker.onWillReceiveMessage) {
            tracker.onWillReceiveMessage(message);
        }
        const da = this._debugAdapters.get(debugAdapterHandle);
        da?.sendMessage(message);
    }
    $stopDASession(debugAdapterHandle) {
        const tracker = this._debugAdaptersTrackers.get(debugAdapterHandle);
        this._debugAdaptersTrackers.delete(debugAdapterHandle);
        if (tracker && tracker.onWillStopSession) {
            tracker.onWillStopSession();
        }
        const da = this._debugAdapters.get(debugAdapterHandle);
        this._debugAdapters.delete(debugAdapterHandle);
        if (da) {
            return da.stopSession();
        }
        else {
            return Promise.resolve(void 0);
        }
    }
    $acceptBreakpointsDelta(delta) {
        const a = [];
        const r = [];
        const c = [];
        if (delta.added) {
            for (const bpd of delta.added) {
                const id = bpd.id;
                if (id && !this._breakpoints.has(id)) {
                    let bp;
                    if (bpd.type === 'function') {
                        bp = new FunctionBreakpoint(bpd.functionName, bpd.enabled, bpd.condition, bpd.hitCondition, bpd.logMessage, bpd.mode);
                    }
                    else if (bpd.type === 'data') {
                        bp = new DataBreakpoint(bpd.label, bpd.dataId, bpd.canPersist, bpd.enabled, bpd.hitCondition, bpd.condition, bpd.logMessage, bpd.mode);
                    }
                    else {
                        const uri = URI.revive(bpd.uri);
                        bp = new SourceBreakpoint(new Location(uri, new Position(bpd.line, bpd.character)), bpd.enabled, bpd.condition, bpd.hitCondition, bpd.logMessage, bpd.mode);
                    }
                    setBreakpointId(bp, id);
                    this._breakpoints.set(id, bp);
                    a.push(bp);
                }
            }
        }
        if (delta.removed) {
            for (const id of delta.removed) {
                const bp = this._breakpoints.get(id);
                if (bp) {
                    this._breakpoints.delete(id);
                    r.push(bp);
                }
            }
        }
        if (delta.changed) {
            for (const bpd of delta.changed) {
                if (bpd.id) {
                    const bp = this._breakpoints.get(bpd.id);
                    if (bp) {
                        if (bp instanceof FunctionBreakpoint && bpd.type === 'function') {
                            // eslint-disable-next-line local/code-no-any-casts
                            const fbp = bp;
                            fbp.enabled = bpd.enabled;
                            fbp.condition = bpd.condition;
                            fbp.hitCondition = bpd.hitCondition;
                            fbp.logMessage = bpd.logMessage;
                            fbp.functionName = bpd.functionName;
                        }
                        else if (bp instanceof SourceBreakpoint && bpd.type === 'source') {
                            // eslint-disable-next-line local/code-no-any-casts
                            const sbp = bp;
                            sbp.enabled = bpd.enabled;
                            sbp.condition = bpd.condition;
                            sbp.hitCondition = bpd.hitCondition;
                            sbp.logMessage = bpd.logMessage;
                            sbp.location = new Location(URI.revive(bpd.uri), new Position(bpd.line, bpd.character));
                        }
                        c.push(bp);
                    }
                }
            }
        }
        this.fireBreakpointChanges(a, r, c);
    }
    async $acceptStackFrameFocus(focusDto) {
        let focus;
        if (focusDto) {
            const session = await this.getSession(focusDto.sessionId);
            if (focusDto.kind === 'thread') {
                focus = new DebugThread(session.api, focusDto.threadId);
            }
            else {
                focus = new DebugStackFrame(session.api, focusDto.threadId, focusDto.frameId);
            }
        }
        this._activeStackItem = focus;
        this._onDidChangeActiveStackItem.fire(this._activeStackItem);
    }
    $provideDebugConfigurations(configProviderHandle, folderUri, token) {
        return asPromise(async () => {
            const provider = this.getConfigProviderByHandle(configProviderHandle);
            if (!provider) {
                throw new Error('no DebugConfigurationProvider found');
            }
            if (!provider.provideDebugConfigurations) {
                throw new Error('DebugConfigurationProvider has no method provideDebugConfigurations');
            }
            const folder = await this.getFolder(folderUri);
            return provider.provideDebugConfigurations(folder, token);
        }).then(debugConfigurations => {
            if (!debugConfigurations) {
                throw new Error('nothing returned from DebugConfigurationProvider.provideDebugConfigurations');
            }
            return debugConfigurations;
        });
    }
    $resolveDebugConfiguration(configProviderHandle, folderUri, debugConfiguration, token) {
        return asPromise(async () => {
            const provider = this.getConfigProviderByHandle(configProviderHandle);
            if (!provider) {
                throw new Error('no DebugConfigurationProvider found');
            }
            if (!provider.resolveDebugConfiguration) {
                throw new Error('DebugConfigurationProvider has no method resolveDebugConfiguration');
            }
            const folder = await this.getFolder(folderUri);
            return provider.resolveDebugConfiguration(folder, debugConfiguration, token);
        });
    }
    $resolveDebugConfigurationWithSubstitutedVariables(configProviderHandle, folderUri, debugConfiguration, token) {
        return asPromise(async () => {
            const provider = this.getConfigProviderByHandle(configProviderHandle);
            if (!provider) {
                throw new Error('no DebugConfigurationProvider found');
            }
            if (!provider.resolveDebugConfigurationWithSubstitutedVariables) {
                throw new Error('DebugConfigurationProvider has no method resolveDebugConfigurationWithSubstitutedVariables');
            }
            const folder = await this.getFolder(folderUri);
            return provider.resolveDebugConfigurationWithSubstitutedVariables(folder, debugConfiguration, token);
        });
    }
    async $provideDebugAdapter(adapterFactoryHandle, sessionDto) {
        const adapterDescriptorFactory = this.getAdapterDescriptorFactoryByHandle(adapterFactoryHandle);
        if (!adapterDescriptorFactory) {
            return Promise.reject(new Error('no adapter descriptor factory found for handle'));
        }
        const session = await this.getSession(sessionDto);
        return this.getAdapterDescriptor(adapterDescriptorFactory, session).then(adapterDescriptor => {
            if (!adapterDescriptor) {
                throw new Error(`Couldn't find a debug adapter descriptor for debug type '${session.type}'`);
            }
            return this.convertToDto(adapterDescriptor);
        });
    }
    async $acceptDebugSessionStarted(sessionDto) {
        const session = await this.getSession(sessionDto);
        this._onDidStartDebugSession.fire(session.api);
    }
    async $acceptDebugSessionTerminated(sessionDto) {
        const session = await this.getSession(sessionDto);
        if (session) {
            this._onDidTerminateDebugSession.fire(session.api);
            this._debugSessions.delete(session.id);
        }
    }
    async $acceptDebugSessionActiveChanged(sessionDto) {
        this._activeDebugSession = sessionDto ? await this.getSession(sessionDto) : undefined;
        this._onDidChangeActiveDebugSession.fire(this._activeDebugSession?.api);
    }
    async $acceptDebugSessionNameChanged(sessionDto, name) {
        const session = await this.getSession(sessionDto);
        session?._acceptNameChanged(name);
    }
    async $acceptDebugSessionCustomEvent(sessionDto, event) {
        const session = await this.getSession(sessionDto);
        const ee = {
            session: session.api,
            event: event.event,
            body: event.body
        };
        this._onDidReceiveDebugSessionCustomEvent.fire(ee);
    }
    // private & dto helpers
    convertToDto(x) {
        if (x instanceof DebugAdapterExecutable) {
            return this.convertExecutableToDto(x);
        }
        else if (x instanceof DebugAdapterServer) {
            return this.convertServerToDto(x);
        }
        else if (x instanceof DebugAdapterNamedPipeServer) {
            return this.convertPipeServerToDto(x);
        }
        else if (x instanceof DebugAdapterInlineImplementation) {
            return this.convertImplementationToDto(x);
        }
        else {
            throw new Error('convertToDto unexpected type');
        }
    }
    convertExecutableToDto(x) {
        return {
            type: 'executable',
            command: x.command,
            args: x.args,
            options: x.options
        };
    }
    convertServerToDto(x) {
        return {
            type: 'server',
            port: x.port,
            host: x.host
        };
    }
    convertPipeServerToDto(x) {
        return {
            type: 'pipeServer',
            path: x.path
        };
    }
    convertImplementationToDto(x) {
        return {
            type: 'implementation',
        };
    }
    getAdapterDescriptorFactoryByType(type) {
        const results = this._adapterFactories.filter(p => p.type === type);
        if (results.length > 0) {
            return results[0].factory;
        }
        return undefined;
    }
    getAdapterDescriptorFactoryByHandle(handle) {
        const results = this._adapterFactories.filter(p => p.handle === handle);
        if (results.length > 0) {
            return results[0].factory;
        }
        return undefined;
    }
    getConfigProviderByHandle(handle) {
        const results = this._configProviders.filter(p => p.handle === handle);
        if (results.length > 0) {
            return results[0].provider;
        }
        return undefined;
    }
    definesDebugType(ed, type) {
        if (ed.contributes) {
            const debuggers = ed.contributes['debuggers'];
            if (debuggers && debuggers.length > 0) {
                for (const dbg of debuggers) {
                    // only debugger contributions with a "label" are considered a "defining" debugger contribution
                    if (dbg.label && dbg.type) {
                        if (dbg.type === type) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
    getDebugAdapterTrackers(session) {
        const config = session.configuration;
        const type = config.type;
        const promises = this._trackerFactories
            .filter(tuple => tuple.type === type || tuple.type === '*')
            .map(tuple => asPromise(() => tuple.factory.createDebugAdapterTracker(session.api)).then(p => p, err => null));
        return Promise.race([
            Promise.all(promises).then(result => {
                const trackers = coalesce(result); // filter null
                if (trackers.length > 0) {
                    return new MultiTracker(trackers);
                }
                return undefined;
            }),
            new Promise(resolve => setTimeout(() => resolve(undefined), 1000)),
        ]).catch(err => {
            // ignore errors
            return undefined;
        });
    }
    async getAdapterDescriptor(adapterDescriptorFactory, session) {
        // a "debugServer" attribute in the launch config takes precedence
        const serverPort = session.configuration.debugServer;
        if (typeof serverPort === 'number') {
            return Promise.resolve(new DebugAdapterServer(serverPort));
        }
        if (adapterDescriptorFactory) {
            const extensionRegistry = await this._extensionService.getExtensionRegistry();
            return asPromise(() => adapterDescriptorFactory.createDebugAdapterDescriptor(session.api, this.daExecutableFromPackage(session, extensionRegistry))).then(daDescriptor => {
                if (daDescriptor) {
                    return daDescriptor;
                }
                return undefined;
            });
        }
        // fallback: use executable information from package.json
        const extensionRegistry = await this._extensionService.getExtensionRegistry();
        return Promise.resolve(this.daExecutableFromPackage(session, extensionRegistry));
    }
    daExecutableFromPackage(session, extensionRegistry) {
        return undefined;
    }
    fireBreakpointChanges(added, removed, changed) {
        if (added.length > 0 || removed.length > 0 || changed.length > 0) {
            this._onDidChangeBreakpoints.fire(Object.freeze({
                added,
                removed,
                changed,
            }));
        }
    }
    async getSession(dto) {
        if (dto) {
            if (typeof dto === 'string') {
                const ds = this._debugSessions.get(dto);
                if (ds) {
                    return ds;
                }
            }
            else {
                let ds = this._debugSessions.get(dto.id);
                if (!ds) {
                    const folder = await this.getFolder(dto.folderUri);
                    const parent = dto.parent ? this._debugSessions.get(dto.parent) : undefined;
                    ds = new ExtHostDebugSession(this._debugServiceProxy, dto.id, dto.type, dto.name, folder, dto.configuration, parent?.api);
                    this._debugSessions.set(ds.id, ds);
                    this._debugServiceProxy.$sessionCached(ds.id);
                }
                return ds;
            }
        }
        throw new Error('cannot find session');
    }
    getFolder(_folderUri) {
        if (_folderUri) {
            const folderURI = URI.revive(_folderUri);
            return this._workspaceService.resolveWorkspaceFolder(folderURI);
        }
        return Promise.resolve(undefined);
    }
    extensionVisKey(extensionId, id) {
        return `${extensionId}\0${id}`;
    }
    serializeVisualization(extensionId, viz) {
        if (!viz) {
            return undefined;
        }
        if ('title' in viz && 'command' in viz) {
            return { type: 0 /* DebugVisualizationType.Command */ };
        }
        if ('treeId' in viz) {
            return { type: 1 /* DebugVisualizationType.Tree */, id: `${extensionId}\0${viz.treeId}` };
        }
        throw new Error('Unsupported debug visualization type');
    }
    getIconPathOrClass(icon) {
        const iconPathOrIconClass = this.getIconUris(icon);
        let iconPath;
        let iconClass;
        if ('id' in iconPathOrIconClass) {
            iconClass = ThemeIconUtils.asClassName(iconPathOrIconClass);
        }
        else {
            iconPath = iconPathOrIconClass;
        }
        return {
            iconPath,
            iconClass
        };
    }
    getIconUris(iconPath) {
        if (iconPath instanceof ThemeIcon) {
            return { id: iconPath.id };
        }
        const dark = typeof iconPath === 'object' && 'dark' in iconPath ? iconPath.dark : iconPath;
        const light = typeof iconPath === 'object' && 'light' in iconPath ? iconPath.light : iconPath;
        return {
            dark: (typeof dark === 'string' ? URI.file(dark) : dark),
            light: (typeof light === 'string' ? URI.file(light) : light),
        };
    }
};
ExtHostDebugServiceBase = __decorate([
    __param(0, IExtHostRpcService),
    __param(1, IExtHostWorkspace),
    __param(2, IExtHostExtensionService),
    __param(3, IExtHostConfiguration),
    __param(4, IExtHostEditorTabs),
    __param(5, IExtHostVariableResolverProvider),
    __param(6, IExtHostCommands),
    __param(7, IExtHostTesting)
], ExtHostDebugServiceBase);
export { ExtHostDebugServiceBase };
export class ExtHostDebugSession {
    constructor(_debugServiceProxy, _id, _type, _name, _workspaceFolder, _configuration, _parentSession) {
        this._debugServiceProxy = _debugServiceProxy;
        this._id = _id;
        this._type = _type;
        this._name = _name;
        this._workspaceFolder = _workspaceFolder;
        this._configuration = _configuration;
        this._parentSession = _parentSession;
    }
    get api() {
        const that = this;
        return this.apiSession ??= Object.freeze({
            id: that._id,
            type: that._type,
            get name() {
                return that._name;
            },
            set name(name) {
                that._name = name;
                that._debugServiceProxy.$setDebugSessionName(that._id, name);
            },
            parentSession: that._parentSession,
            workspaceFolder: that._workspaceFolder,
            configuration: that._configuration,
            customRequest(command, args) {
                return that._debugServiceProxy.$customDebugAdapterRequest(that._id, command, args);
            },
            getDebugProtocolBreakpoint(breakpoint) {
                return that._debugServiceProxy.$getDebugProtocolBreakpoint(that._id, breakpoint.id);
            }
        });
    }
    get id() {
        return this._id;
    }
    get type() {
        return this._type;
    }
    _acceptNameChanged(name) {
        this._name = name;
    }
    get configuration() {
        return this._configuration;
    }
}
export class ExtHostDebugConsole {
    constructor(proxy) {
        this.value = Object.freeze({
            append(value) {
                proxy.$appendDebugConsole(value);
            },
            appendLine(value) {
                this.append(value + '\n');
            }
        });
    }
}
class MultiTracker {
    constructor(trackers) {
        this.trackers = trackers;
    }
    onWillStartSession() {
        this.trackers.forEach(t => t.onWillStartSession ? t.onWillStartSession() : undefined);
    }
    onWillReceiveMessage(message) {
        this.trackers.forEach(t => t.onWillReceiveMessage ? t.onWillReceiveMessage(message) : undefined);
    }
    onDidSendMessage(message) {
        this.trackers.forEach(t => t.onDidSendMessage ? t.onDidSendMessage(message) : undefined);
    }
    onWillStopSession() {
        this.trackers.forEach(t => t.onWillStopSession ? t.onWillStopSession() : undefined);
    }
    onError(error) {
        this.trackers.forEach(t => t.onError ? t.onError(error) : undefined);
    }
    onExit(code, signal) {
        this.trackers.forEach(t => t.onExit ? t.onExit(code, signal) : undefined);
    }
}
/*
 * Call directly into a debug adapter implementation
 */
class DirectDebugAdapter extends AbstractDebugAdapter {
    constructor(implementation) {
        super();
        this.implementation = implementation;
        implementation.onDidSendMessage((message) => {
            this.acceptMessage(message);
        });
    }
    startSession() {
        return Promise.resolve(undefined);
    }
    sendMessage(message) {
        this.implementation.handleMessage(message);
    }
    stopSession() {
        this.implementation.dispose();
        return Promise.resolve(undefined);
    }
}
let WorkerExtHostDebugService = class WorkerExtHostDebugService extends ExtHostDebugServiceBase {
    constructor(extHostRpcService, workspaceService, extensionService, configurationService, editorTabs, variableResolver, commands, testing) {
        super(extHostRpcService, workspaceService, extensionService, configurationService, editorTabs, variableResolver, commands, testing);
    }
};
WorkerExtHostDebugService = __decorate([
    __param(0, IExtHostRpcService),
    __param(1, IExtHostWorkspace),
    __param(2, IExtHostExtensionService),
    __param(3, IExtHostConfiguration),
    __param(4, IExtHostEditorTabs),
    __param(5, IExtHostVariableResolverProvider),
    __param(6, IExtHostCommands),
    __param(7, IExtHostTesting)
], WorkerExtHostDebugService);
export { WorkerExtHostDebugService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdERlYnVnU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0RGVidWdTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFMUQsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxVQUFVLElBQUksYUFBYSxFQUFFLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzlGLE9BQU8sRUFBRSxTQUFTLElBQUksY0FBYyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEYsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSw2QkFBNkIsQ0FBQztBQUNqRSxPQUFPLEVBQUUsbUJBQW1CLEVBQXlCLE1BQU0sbURBQW1ELENBQUM7QUFDL0csT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBRzFGLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBRTFGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxpQkFBaUIsRUFBRSwwQkFBMEIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRzNILE9BQU8sRUFBK0ssV0FBVyxFQUF5RCxNQUFNLHVCQUF1QixDQUFDO0FBQ3hSLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ2xFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQzVELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxN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