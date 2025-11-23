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
var McpServer_1;
import { AsyncIterableProducer, raceCancellationError, Sequencer } from '../../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Iterable } from '../../../../base/common/iterator.js';
import * as json from '../../../../base/common/json.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { LRUCache } from '../../../../base/common/map.js';
import { mapValues } from '../../../../base/common/objects.js';
import { autorun, autorunSelfDisposable, derived, disposableObservableValue, observableFromEvent, ObservablePromise, observableValue, transaction } from '../../../../base/common/observable.js';
import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { createURITransformer } from '../../../../base/common/uriTransformer.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILoggerService } from '../../../../platform/log/common/log.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IOutputService } from '../../../services/output/common/output.js';
import { mcpActivationEvent } from './mcpConfiguration.js';
import { McpDevModeServerAttache } from './mcpDevMode.js';
import { McpIcons, parseAndValidateMcpIcon } from './mcpIcons.js';
import { IMcpRegistry } from './mcpRegistryTypes.js';
import { extensionMcpCollectionPrefix, IMcpElicitationService, IMcpSamplingService, McpConnectionFailedError, McpConnectionState, mcpPromptReplaceSpecialChars, McpResourceURI, MpcResponseError, UserInteractionRequiredError } from './mcpTypes.js';
import { MCP } from './modelContextProtocol.js';
import { UriTemplate } from './uriTemplate.js';
const emptyToolEntry = {
    serverName: undefined,
    serverIcons: [],
    serverInstructions: undefined,
    trustedAtNonce: undefined,
    nonce: undefined,
    tools: [],
    prompts: undefined,
    capabilities: undefined,
};
const toolInvalidCharRe = /[^a-z0-9_-]/gi;
let McpServerMetadataCache = class McpServerMetadataCache extends Disposable {
    constructor(scope, storageService) {
        super();
        this.didChange = false;
        this.cache = new LRUCache(128);
        this.extensionServers = new Map();
        const storageKey = 'mcpToolCache';
        this._register(storageService.onWillSaveState(() => {
            if (this.didChange) {
                storageService.store(storageKey, {
                    extensionServers: [...this.extensionServers],
                    serverTools: this.cache.toJSON(),
                }, scope, 1 /* StorageTarget.MACHINE */);
                this.didChange = false;
            }
        }));
        try {
            const cached = storageService.getObject(storageKey, scope);
            this.extensionServers = new Map(cached?.extensionServers ?? []);
            cached?.serverTools?.forEach(([k, v]) => this.cache.set(k, v));
        }
        catch {
            // ignored
        }
    }
    /** Resets the cache for primitives and extension servers */
    reset() {
        this.cache.clear();
        this.extensionServers.clear();
        this.didChange = true;
    }
    /** Gets cached primitives for a server (used before a server is running) */
    get(definitionId) {
        return this.cache.get(definitionId);
    }
    /** Sets cached primitives for a server */
    store(definitionId, entry) {
        const prev = this.get(definitionId) || emptyToolEntry;
        this.cache.set(definitionId, { ...prev, ...entry });
        this.didChange = true;
    }
    /** Gets cached servers for a collection (used for extensions, before the extension activates) */
    getServers(collectionId) {
        return this.extensionServers.get(collectionId);
    }
    /** Sets cached servers for a collection */
    storeServers(collectionId, entry) {
        if (entry) {
            this.extensionServers.set(collectionId, entry);
        }
        else {
            this.extensionServers.delete(collectionId);
        }
        this.didChange = true;
    }
};
McpServerMetadataCache = __decorate([
    __param(1, IStorageService)
], McpServerMetadataCache);
export { McpServerMetadataCache };
class CachedPrimitive {
    /**
     * @param _definitionId Server definition ID
     * @param _cache Metadata cache instance
     * @param _fromStaticDefinition Static definition that came with the server.
     * This should ONLY have a value if it should be used instead of whatever
     * is currently in the cache.
     * @param _fromCache Pull the value from the cache entry.
     * @param _toT Transform the value to the observable type.
     * @param defaultValue Default value if no cache entry.
     */
    constructor(_definitionId, _cache, _fromStaticDefinition, _fromCache, _toT, defaultValue) {
        this._definitionId = _definitionId;
        this._cache = _cache;
        this._fromStaticDefinition = _fromStaticDefinition;
        this._fromCache = _fromCache;
        this._toT = _toT;
        this.defaultValue = defaultValue;
        this.fromServerPromise = observableValue(this, undefined);
        this.fromServer = derived(reader => this.fromServerPromise.read(reader)?.promiseResult.read(reader)?.data);
        this.value = derived(reader => {
            const serverTools = this.fromServer.read(reader);
            const definitions = serverTools?.data ?? this._fromStaticDefinition?.read(reader) ?? this.fromCache?.data ?? this.defaultValue;
            return this._toT(definitions, reader);
        });
    }
    get fromCache() {
        const c = this._cache.get(this._definitionId);
        return c ? { data: this._fromCache(c), nonce: c.nonce } : undefined;
    }
    hasStaticDefinition(reader) {
        return !!this._fromStaticDefinition?.read(reader);
    }
}
let McpServer = McpServer_1 = class McpServer extends Disposable {
    /**
     * Helper function to call the function on the handler once it's online. The
     * connection started if it is not already.
     */
    static async callOn(server, fn, token = CancellationToken.None) {
        await server.start({ promptType: 'all-untrusted' }); // idempotent
        let ranOnce = false;
        let d;
        const callPromise = new Promise((resolve, reject) => {
            d = autorun(reader => {
                const connection = server.connection.read(reader);
                if (!connection || ranOnce) {
                    return;
                }
                const handler = connection.handler.read(reader);
                if (!handler) {
                    const state = connection.state.read(reader);
                    if (state.state === 3 /* McpConnectionState.Kind.Error */) {
                        reject(new McpConnectionFailedError(`MCP server could not be started: ${state.message}`));
                        return;
                    }
                    else if (state.state === 0 /* McpConnectionState.Kind.Stopped */) {
                        reject(new McpConnectionFailedError('MCP server has stopped'));
                        return;
                    }
                    else {
                        // keep waiting for handler
                        return;
                    }
                }
                resolve(fn(handler));
                ranOnce = true; // aggressive prevent multiple racey calls, don't dispose because autorun is sync
            });
        });
        return raceCancellationError(callPromise, token).finally(() => d.dispose());
    }
    get capabilities() {
        return this._capabilities.value;
    }
    get tools() {
        return this._tools.value;
    }
    get prompts() {
        return this._prompts.value;
    }
    get serverMetadata() {
        return this._serverMetadata.value;
    }
    get trustedAtNonce() {
        return this._primitiveCache.get(this.definition.id)?.trustedAtNonce;
    }
    set trustedAtNonce(nonce) {
        this._primitiveCache.store(this.definition.id, { trustedAtNonce: nonce });
    }
    constructor(initialCollection, definition, explicitRoots, _requiresExtensionActivation, _primitiveCache, toolPrefix, _mcpRegistry, workspacesService, _extensionService, _loggerService, _outputService, _telemetryService, _commandService, _instantiationService, _notificationService, _openerService, _samplingService, _elicitationService, environmentService) {
        super();
        this.definition = definition;
        this._requiresExtensionActivation = _requiresExtensionActivation;
        this._primitiveCache = _primitiveCache;
        this._mcpRegistry = _mcpRegistry;
        this._extensionService = _extensionService;
        this._loggerService = _loggerService;
        this._outputService = _outputService;
        this._telemetryService = _telemetryService;
        this._commandService = _commandService;
        this._instantiationService = _instantiationService;
        this._notificationService = _notificationService;
        this._openerService = _openerService;
        this._samplingService = _samplingService;
        this._elicitationService = _elicitationService;
        this._connectionSequencer = new Sequencer();
        this._connection = this._register(disposableObservableValue(this, undefined));
        this.connection = this._connection;
        this.connectionState = derived(reader => this._connection.read(reader)?.state.read(reader) ?? { state: 0 /* McpConnectionState.Kind.Stopped */ });
        this.cacheState = derived(reader => {
            const currentNonce = () => this._fullDefinitions.read(reader)?.server?.cacheNonce;
            const stateWhenServingFromCache = () => {
                if (this._tools.hasStaticDefinition(reader)) {
                    return 1 /* McpServerCacheState.Cached */;
                }
                if (!this._tools.fromCache) {
                    return 0 /* McpServerCacheState.Unknown */;
                }
                return currentNonce() === this._tools.fromCache.nonce ? 1 /* McpServerCacheState.Cached */ : 2 /* McpServerCacheState.Outdated */;
            };
            const fromServer = this._tools.fromServerPromise.read(reader);
            const connectionState = this.connectionState.read(reader);
            const isIdle = McpConnectionState.canBeStarted(connectionState.state) || !fromServer;
            if (isIdle) {
                return stateWhenServingFromCache();
            }
            const fromServerResult = fromServer?.promiseResult.read(reader);
            if (!fromServerResult) {
                return this._tools.fromCache ? 4 /* McpServerCacheState.RefreshingFromCached */ : 3 /* McpServerCacheState.RefreshingFromUnknown */;
            }
            if (fromServerResult.error) {
                return stateWhenServingFromCache();
            }
            return fromServerResult.data?.nonce === currentNonce() ? 5 /* McpServerCacheState.Live */ : 2 /* McpServerCacheState.Outdated */;
        });
        this._lastModeDebugged = false;
        /** Count of running tool calls, used to detect if sampling is during an LM call */
        this.runningToolCalls = new Set();
        this.collection = initialCollection;
        this._fullDefinitions = this._mcpRegistry.getServerDefinition(this.collection, this.definition);
        this._loggerId = `mcpServer.${definition.id}`;
        this._logger = this._register(_loggerService.createLogger(this._loggerId, { hidden: true, name: `MCP: ${definition.label}` }));
        const that = this;
        this._register(this._instantiationService.createInstance(McpDevModeServerAttache, this, { get lastModeDebugged() { return that._lastModeDebugged; } }));
        // If the logger is disposed but not deregistered, then the disposed instance
        // is reused and no-ops. todo@sandy081 this seems like a bug.
        this._register(toDisposable(() => _loggerService.deregisterLogger(this._loggerId)));
        // 1. Reflect workspaces into the MCP roots
        const workspaces = explicitRoots
            ? observableValue(this, explicitRoots.map(uri => ({ uri, name: basename(uri) })))
            : observableFromEvent(this, workspacesService.onDidChangeWorkspaceFolders, () => workspacesService.getWorkspace().folders);
        const uriTransformer = environmentService.remoteAuthority ? createURITransformer(environmentService.remoteAuthority) : undefined;
        this._register(autorun(reader => {
            const cnx = this._connection.read(reader)?.handler.read(reader);
            if (!cnx) {
                return;
            }
            cnx.roots = workspaces.read(reader)
                .filter(w => w.uri.authority === (initialCollection.remoteAuthority || ''))
                .map(w => ({
                name: w.name,
                uri: URI.from(uriTransformer?.transformIncoming(w.uri) ?? w.uri).toString()
            }));
        }));
        // 2. Populate this.tools when we connect to a server.
        this._register(autorun(reader => {
            const cnx = this._connection.read(reader);
            const handler = cnx?.handler.read(reader);
            if (handler) {
                this._populateLiveData(handler, cnx?.definition.cacheNonce, reader.store);
            }
            else if (this._tools) {
                this.resetLiveData();
            }
        }));
        const staticMetadata = derived(reader => {
            const def = this._fullDefinitions.read(reader).server;
            return def && def.cacheNonce !== this._tools.fromCache?.nonce ? def.staticMetadata : undefined;
        });
        // 3. Publish tools
        this._tools = new CachedPrimitive(this.definition.id, this._primitiveCache, staticMetadata
            .map(m => {
            const tools = m?.tools?.filter(t => t.availability === 0 /* McpServerStaticToolAvailability.Initial */).map(t => t.definition);
            return tools?.length ? new ObservablePromise(this._getValidatedTools(tools)) : undefined;
        })
            .map((o, reader) => o?.promiseResult.read(reader)?.data), (entry) => entry.tools, (entry) => entry.map(def => this._instantiationService.createInstance(McpTool, this, toolPrefix, def)).sort((a, b) => a.compare(b)), []);
        // 4. Publish prompts
        this._prompts = new CachedPrimitive(this.definition.id, this._primitiveCache, undefined, (entry) => entry.prompts || [], (entry) => entry.map(e => new McpPrompt(this, e)), []);
        this._serverMetadata = new CachedPrimitive(this.definition.id, this._primitiveCache, staticMetadata.map(m => m ? this._toStoredMetadata(m?.serverInfo, m?.instructions) : undefined), (entry) => ({ serverName: entry.serverName, serverInstructions: entry.serverInstructions, serverIcons: entry.serverIcons }), (entry) => ({ serverName: entry?.serverName, serverInstructions: entry?.serverInstructions, icons: McpIcons.fromStored(entry?.serverIcons) }), undefined);
        this._capabilities = new CachedPrimitive(this.definition.id, this._primitiveCache, staticMetadata.map(m => m?.capabilities !== undefined ? encodeCapabilities(m.capabilities) : undefined), (entry) => entry.capabilities, (entry) => entry, undefined);
    }
    readDefinitions() {
        return this._fullDefinitions;
    }
    showOutput(preserveFocus) {
        this._loggerService.setVisibility(this._loggerId, true);
        return this._outputService.showChannel(this._loggerId, preserveFocus);
    }
    resources(token) {
        const cts = new CancellationTokenSource(token);
        return new AsyncIterableProducer(async (emitter) => {
            await McpServer_1.callOn(this, async (handler) => {
                for await (const resource of handler.listResourcesIterable({}, cts.token)) {
                    emitter.emitOne(resource.map(r => new McpResource(this, r, McpIcons.fromParsed(this._parseIcons(r)))));
                    if (cts.token.isCancellationRequested) {
                        return;
                    }
                }
            });
        }, () => cts.dispose(true));
    }
    resourceTemplates(token) {
        return McpServer_1.callOn(this, async (handler) => {
            const templates = await handler.listResourceTemplates({}, token);
            return templates.map(t => new McpResourceTemplate(this, t, McpIcons.fromParsed(this._parseIcons(t))));
        }, token);
    }
    start({ interaction, autoTrustChanges, promptType, debug, errorOnUserInteraction } = {}) {
        interaction?.participants.set(this.definition.id, { s: 'unknown' });
        return this._connectionSequencer.queue(async () => {
            const activationEvent = mcpActivationEvent(this.collection.id.slice(extensionMcpCollectionPrefix.length));
            if (this._requiresExtensionActivation && !this._extensionService.activationEventIsDone(activationEvent)) {
                await this._extensionService.activateByEvent(activationEvent);
                await Promise.all(this._mcpRegistry.delegates.get()
                    .map(r => r.waitForInitialProviderPromises()));
                // This can happen if the server was created from a cached MCP server seen
                // from an extension, but then it wasn't registered when the extension activated.
                if (this._store.isDisposed) {
                    return { state: 0 /* McpConnectionState.Kind.Stopped */ };
                }
            }
            let connection = this._connection.get();
            if (connection && McpConnectionState.canBeStarted(connection.state.get().state)) {
                connection.dispose();
                connection = undefined;
                this._connection.set(connection, undefined);
            }
            if (!connection) {
                this._lastModeDebugged = !!debug;
                const that = this;
                connection = await this._mcpRegistry.resolveConnection({
                    interaction,
                    autoTrustChanges,
                    promptType,
                    trustNonceBearer: {
                        get trustedAtNonce() { return that.trustedAtNonce; },
                        set trustedAtNonce(nonce) { that.trustedAtNonce = nonce; }
                    },
                    logger: this._logger,
                    collectionRef: this.collection,
                    definitionRef: this.definition,
                    debug,
                    errorOnUserInteraction,
                });
                if (!connection) {
                    return { state: 0 /* McpConnectionState.Kind.Stopped */ };
                }
                if (this._store.isDisposed) {
                    connection.dispose();
                    return { state: 0 /* McpConnectionState.Kind.Stopped */ };
                }
                this._connection.set(connection, undefined);
                if (connection.definition.devMode) {
                    this.showOutput();
                }
            }
            const start = Date.now();
            let state = await connection.start({
                createMessageRequestHandler: params => this._samplingService.sample({
                    isDuringToolCall: this.runningToolCalls.size > 0,
                    server: this,
                    params,
                }).then(r => r.sample),
                elicitationRequestHandler: async (req) => {
                    const serverInfo = connection.handler.get()?.serverInfo;
                    if (serverInfo) {
                        this._telemetryService.publicLog2('mcp.elicitationRequested', {
                            serverName: serverInfo.name,
                            serverVersion: serverInfo.version,
                        });
                    }
                    const r = await this._elicitationService.elicit(this, Iterable.first(this.runningToolCalls), req, CancellationToken.None);
                    r.dispose();
                    return r.value;
                }
            });
            this._telemetryService.publicLog2('mcp/serverBootState', {
                state: McpConnectionState.toKindString(state.state),
                time: Date.now() - start,
            });
            if (state.state === 3 /* McpConnectionState.Kind.Error */) {
                this.showInteractiveError(connection, state, debug);
            }
            // MCP servers that need auth can 'start' but will stop with an interaction-needed
            // error they first make a request. In this case, wait until the handler fully
            // initializes before resolving (throwing if it ends up needing auth)
            if (errorOnUserInteraction && state.state === 2 /* McpConnectionState.Kind.Running */) {
                let disposable;
                state = await new Promise((resolve, reject) => {
                    disposable = autorun(reader => {
                        const handler = connection.handler.read(reader);
                        if (handler) {
                            resolve(state);
                        }
                        const s = connection.state.read(reader);
                        if (s.state === 0 /* McpConnectionState.Kind.Stopped */ && s.reason === 'needs-user-interaction') {
                            reject(new UserInteractionRequiredError('auth'));
                        }
                        if (!McpConnectionState.isRunning(s)) {
                            resolve(s);
                        }
                    });
                }).finally(() => disposable.dispose());
            }
            return state;
        }).finally(() => {
            interaction?.participants.set(this.definition.id, { s: 'resolved' });
        });
    }
    showInteractiveError(cnx, error, debug) {
        if (error.code === 'ENOENT' && cnx.launchDefinition.type === 1 /* McpServerTransportType.Stdio */) {
            let docsLink;
            switch (cnx.launchDefinition.command) {
                case 'uvx':
                    docsLink = `https://aka.ms/vscode-mcp-install/uvx`;
                    break;
                case 'npx':
                    docsLink = `https://aka.ms/vscode-mcp-install/npx`;
                    break;
                case 'dnx':
                    docsLink = `https://aka.ms/vscode-mcp-install/dnx`;
                    break;
                case 'dotnet':
                    docsLink = `https://aka.ms/vscode-mcp-install/dotnet`;
                    break;
            }
            const options = [{
                    label: localize('mcp.command.showOutput', "Show Output"),
                    run: () => this.showOutput(),
                }];
            if (cnx.definition.devMode?.debug?.type === 'debugpy' && debug) {
                this._notificationService.prompt(Severity.Error, localize('mcpDebugPyHelp', 'The command "{0}" was not found. You can specify the path to debugpy in the `dev.debug.debugpyPath` option.', cnx.launchDefinition.command, cnx.definition.label), [...options, {
                        label: localize('mcpViewDocs', 'View Docs'),
                        run: () => this._openerService.open(URI.parse('https://aka.ms/vscode-mcp-install/debugpy')),
                    }]);
                return;
            }
            if (docsLink) {
                options.push({
                    label: localize('mcpServerInstall', 'Install {0}', cnx.launchDefinition.command),
                    run: () => this._openerService.open(URI.parse(docsLink)),
                });
            }
            this._notificationService.prompt(Severity.Error, localize('mcpServerNotFound', 'The command "{0}" needed to run {1} was not found.', cnx.launchDefinition.command, cnx.definition.label), options);
        }
        else {
            this._notificationService.warn(localize('mcpServerError', 'The MCP server {0} could not be started: {1}', cnx.definition.label, error.message));
        }
    }
    stop() {
        return this._connection.get()?.stop() || Promise.resolve();
    }
    /** Waits for any ongoing tools to be refreshed before resolving. */
    awaitToolRefresh() {
        return new Promise(resolve => {
            autorunSelfDisposable(reader => {
                const promise = this._tools.fromServerPromise.read(reader);
                const result = promise?.promiseResult.read(reader);
                if (result) {
                    resolve();
                }
            });
        });
    }
    resetLiveData() {
        transaction(tx => {
            this._tools.fromServerPromise.set(undefined, tx);
            this._prompts.fromServerPromise.set(undefined, tx);
        });
    }
    async _normalizeTool(originalTool) {
        const tool = {
            ...originalTool,
            serverToolName: originalTool.name,
            _icons: this._parseIcons(originalTool),
        };
        if (!tool.description) {
            // Ensure a description is provided for each tool, #243919
            this._logger.warn(`Tool ${tool.name} does not have a description. Tools must be accurately described to be called`);
            tool.description = '<empty>';
        }
        if (toolInvalidCharRe.test(tool.name)) {
            this._logger.warn(`Tool ${JSON.stringify(tool.name)} is invalid. Tools names may only contain [a-z0-9_-]`);
            tool.name = tool.name.replace(toolInvalidCharRe, '_');
        }
        let diagnostics = [];
        const toolJson = JSON.stringify(tool.inputSchema);
        try {
            const schemaUri = URI.parse('https://json-schema.org/draft-07/schema');
            diagnostics = await this._commandService.executeCommand('json.validate', schemaUri, toolJson) || [];
        }
        catch (e) {
            // ignored (error in json extension?);
        }
        if (!diagnostics.length) {
            return tool;
        }
        // because it's all one line from JSON.stringify, we can treat characters as offsets.
        const tree = json.parseTree(toolJson);
        const messages = diagnostics.map(d => {
            const node = json.findNodeAtOffset(tree, d.range[0].character);
            const path = node && `/${json.getNodePath(node).join('/')}`;
            return d.message + (path ? ` (at ${path})` : '');
        });
        return { error: messages };
    }
    async _getValidatedTools(tools) {
        let error = '';
        const validations = await Promise.all(tools.map(t => this._normalizeTool(t)));
        const validated = [];
        for (const [i, result] of validations.entries()) {
            if ('error' in result) {
                error += localize('mcpBadSchema.tool', 'Tool `{0}` has invalid JSON parameters:', tools[i].name) + '\n';
                for (const message of result.error) {
                    error += `\t- ${message}\n`;
                }
                error += `\t- Schema: ${JSON.stringify(tools[i].inputSchema)}\n\n`;
            }
            else {
                validated.push(result);
            }
        }
        if (error) {
            this._logger.warn(`${tools.length - validated.length} tools have invalid JSON schemas and will be omitted`);
            warnInvalidTools(this._instantiationService, this.definition.label, error);
        }
        return validated;
    }
    /**
     * Parses incoming MCP icons and returns the resulting 'stored' record. Note
     * that this requires an active MCP server connection since we validate
     * against some of that connection's data. The icons may however be stored
     * and rehydrated later.
     */
    _parseIcons(icons) {
        const cnx = this._connection.get();
        if (!cnx) {
            return [];
        }
        return parseAndValidateMcpIcon(icons, cnx.launchDefinition, this._logger);
    }
    _setServerTools(nonce, toolsPromise, tx) {
        const toolPromiseSafe = toolsPromise.then(async (tools) => {
            this._logger.info(`Discovered ${tools.length} tools`);
            const data = await this._getValidatedTools(tools);
            this._primitiveCache.store(this.definition.id, { tools: data, nonce });
            return { data, nonce };
        });
        this._tools.fromServerPromise.set(new ObservablePromise(toolPromiseSafe), tx);
        return toolPromiseSafe;
    }
    _setServerPrompts(nonce, promptsPromise, tx) {
        const promptsPromiseSafe = promptsPromise.then((result) => {
            const data = result.map(prompt => ({
                ...prompt,
                _icons: this._parseIcons(prompt)
            }));
            this._primitiveCache.store(this.definition.id, { prompts: data, nonce });
            return { data, nonce };
        });
        this._prompts.fromServerPromise.set(new ObservablePromise(promptsPromiseSafe), tx);
        return promptsPromiseSafe;
    }
    _toStoredMetadata(serverInfo, instructions) {
        return {
            serverName: serverInfo ? serverInfo.title || serverInfo.name : undefined,
            serverInstructions: instructions,
            serverIcons: serverInfo ? this._parseIcons(serverInfo) : undefined,
        };
    }
    _setServerMetadata(nonce, { serverInfo, instructions, capabilities }, tx) {
        const serverMetadata = this._toStoredMetadata(serverInfo, instructions);
        this._serverMetadata.fromServerPromise.set(ObservablePromise.resolved({ nonce, data: serverMetadata }), tx);
        const capabilitiesEncoded = encodeCapabilities(capabilities);
        this._capabilities.fromServerPromise.set(ObservablePromise.resolved({ data: capabilitiesEncoded, nonce }), tx);
        this._primitiveCache.store(this.definition.id, { ...serverMetadata, nonce, capabilities: capabilitiesEncoded });
    }
    _populateLiveData(handler, cacheNonce, store) {
        const cts = new CancellationTokenSource();
        store.add(toDisposable(() => cts.dispose(true)));
        const updateTools = (tx) => {
            const toolPromise = handler.capabilities.tools ? handler.listTools({}, cts.token) : Promise.resolve([]);
            return this._setServerTools(cacheNonce, toolPromise, tx);
        };
        const updatePrompts = (tx) => {
            const promptsPromise = handler.capabilities.prompts ? handler.listPrompts({}, cts.token) : Promise.resolve([]);
            return this._setServerPrompts(cacheNonce, promptsPromise, tx);
        };
        store.add(handler.onDidChangeToolList(() => {
            this._logger.info('Tool list changed, refreshing tools...');
            updateTools(undefined);
        }));
        store.add(handler.onDidChangePromptList(() => {
            this._logger.info('Prompts list changed, refreshing prompts...');
            updatePrompts(undefined);
        }));
        transaction(tx => {
            this._setServerMetadata(cacheNonce, { serverInfo: handler.serverInfo, instructions: handler.serverInstructions, capabilities: handler.capabilities }, tx);
            updatePrompts(tx);
            const toolUpdate = updateTools(tx);
            toolUpdate.then(tools => {
                this._telemetryService.publicLog2('mcp/serverBoot', {
                    supportsLogging: !!handler.capabilities.logging,
                    supportsPrompts: !!handler.capabilities.prompts,
                    supportsResources: !!handler.capabilities.resources,
                    toolCount: tools.data.length,
                    serverName: handler.serverInfo.name,
                    serverVersion: handler.serverInfo.version,
                });
            });
        });
    }
};
McpServer = McpServer_1 = __decorate([
    __param(6, IMcpRegistry),
    __param(7, IWorkspaceContextService),
    __param(8, IExtensionService),
    __param(9, ILoggerService),
    __param(10, IOutputService),
    __param(11, ITelemetryService),
    __param(12, ICommandService),
    __param(13, IInstantiationService),
    __param(14, INotificationService),
    __param(15, IOpenerService),
    __param(16, IMcpSamplingService),
    __param(17, IMcpElicitationService),
    __param(18, IWorkbenchEnvironmentService)
], McpServer);
export { McpServer };
class McpPrompt {
    constructor(_server, _definition) {
        this._server = _server;
        this._definition = _definition;
        this.id = mcpPromptReplaceSpecialChars(this._server.definition.label + '.' + _definition.name);
        this.name = _definition.name;
        this.title = _definition.title;
        this.description = _definition.description;
        this.arguments = _definition.arguments || [];
        this.icons = McpIcons.fromStored(this._definition._icons);
    }
    async resolve(args, token) {
        const result = await McpServer.callOn(this._server, h => h.getPrompt({ name: this._definition.name, arguments: args }, token), token);
        return result.messages;
    }
    async complete(argument, prefix, alreadyResolved, token) {
        const result = await McpServer.callOn(this._server, h => h.complete({
            ref: { type: 'ref/prompt', name: this._definition.name },
            argument: { name: argument, value: prefix },
            context: { arguments: alreadyResolved },
        }, token), token);
        return result.completion.values;
    }
}
function encodeCapabilities(cap) {
    let out = 0;
    if (cap.logging) {
        out |= 1 /* McpCapability.Logging */;
    }
    if (cap.completions) {
        out |= 2 /* McpCapability.Completions */;
    }
    if (cap.prompts) {
        out |= 4 /* McpCapability.Prompts */;
        if (cap.prompts.listChanged) {
            out |= 8 /* McpCapability.PromptsListChanged */;
        }
    }
    if (cap.resources) {
        out |= 16 /* McpCapability.Resources */;
        if (cap.resources.subscribe) {
            out |= 32 /* McpCapability.ResourcesSubscribe */;
        }
        if (cap.resources.listChanged) {
            out |= 64 /* McpCapability.ResourcesListChanged */;
        }
    }
    if (cap.tools) {
        out |= 128 /* McpCapability.Tools */;
        if (cap.tools.listChanged) {
            out |= 256 /* McpCapability.ToolsListChanged */;
        }
    }
    return out;
}
let McpTool = class McpTool {
    get definition() { return this._definition; }
    constructor(_server, idPrefix, _definition, _elicitationService) {
        this._server = _server;
        this._definition = _definition;
        this._elicitationService = _elicitationService;
        this.referenceName = _definition.name.replaceAll('.', '_');
        this.id = (idPrefix + _definition.name).replaceAll('.', '_').slice(0, 64 /* McpToolName.MaxLength */);
        this.icons = McpIcons.fromStored(this._definition._icons);
    }
    async call(params, context, token) {
        if (context) {
            this._server.runningToolCalls.add(context);
        }
        try {
            return await this._callWithProgress(params, undefined, context, token);
        }
        finally {
            if (context) {
                this._server.runningToolCalls.delete(context);
            }
        }
    }
    async callWithProgress(params, progress, context, token) {
        if (context) {
            this._server.runningToolCalls.add(context);
        }
        try {
            return await this._callWithProgress(params, progress, context, token);
        }
        finally {
            if (context) {
                this._server.runningToolCalls.delete(context);
            }
        }
    }
    _callWithProgress(params, progress, context, token = CancellationToken.None, allowRetry = true) {
        // serverToolName is always set now, but older cache entries (from 1.99-Insiders) may not have it.
        const name = this._definition.serverToolName ?? this._definition.name;
        const progressToken = progress ? generateUuid() : undefined;
        const store = new DisposableStore();
        return McpServer.callOn(this._server, async (h) => {
            if (progress) {
                store.add(h.onDidReceiveProgressNotification((e) => {
                    if (e.params.progressToken === progressToken) {
                        progress.report({
                            message: e.params.message,
                            progress: e.params.total !== undefined && e.params.progress !== undefined ? e.params.progress / e.params.total : undefined,
                        });
                    }
                }));
            }
            const meta = { progressToken };
            if (context?.chatSessionId) {
                meta['vscode.conversationId'] = context.chatSessionId;
            }
            if (context?.chatRequestId) {
                meta['vscode.requestId'] = context.chatRequestId;
            }
            try {
                const result = await h.callTool({ name, arguments: params, _meta: meta }, token);
                // Wait for tools to refresh for dynamic servers (#261611)
                await this._server.awaitToolRefresh();
                return result;
            }
            catch (err) {
                // Handle URL elicitation required error
                if (err instanceof MpcResponseError && err.code === MCP.URL_ELICITATION_REQUIRED && allowRetry) {
                    await this._handleElicitationErr(err, context, token);
                    return this._callWithProgress(params, progress, context, token, false);
                }
                const state = this._server.connectionState.get();
                if (allowRetry && state.state === 3 /* McpConnectionState.Kind.Error */ && state.shouldRetry) {
                    return this._callWithProgress(params, progress, context, token, false);
                }
                else {
                    throw err;
                }
            }
            finally {
                store.dispose();
            }
        }, token);
    }
    async _handleElicitationErr(err, context, token) {
        const elicitations = err.data?.elicitations;
        if (Array.isArray(elicitations) && elicitations.length > 0) {
            for (const elicitation of elicitations) {
                const elicitResult = await this._elicitationService.elicit(this._server, context, elicitation, token);
                try {
                    if (elicitResult.value.action !== 'accept') {
                        throw err;
                    }
                    if (elicitResult.kind === 1 /* ElicitationKind.URL */) {
                        await elicitResult.wait;
                    }
                }
                finally {
                    elicitResult.dispose();
                }
            }
        }
    }
    compare(other) {
        return this._definition.name.localeCompare(other.definition.name);
    }
};
McpTool = __decorate([
    __param(3, IMcpElicitationService)
], McpTool);
export { McpTool };
function warnInvalidTools(instaService, serverName, errorText) {
    instaService.invokeFunction((accessor) => {
        const notificationService = accessor.get(INotificationService);
        const editorService = accessor.get(IEditorService);
        notificationService.notify({
            severity: Severity.Warning,
            message: localize('mcpBadSchema', 'MCP server `{0}` has tools with invalid parameters which will be omitted.', serverName),
            actions: {
                primary: [{
                        class: undefined,
                        enabled: true,
                        id: 'mcpBadSchema.show',
                        tooltip: '',
                        label: localize('mcpBadSchema.show', 'Show'),
                        run: () => {
                            editorService.openEditor({
                                resource: undefined,
                                contents: errorText,
                            });
                        }
                    }]
            }
        });
    });
}
class McpResource {
    constructor(server, original, icons) {
        this.icons = icons;
        this.mcpUri = original.uri;
        this.title = original.title;
        this.uri = McpResourceURI.fromServer(server.definition, original.uri);
        this.name = original.name;
        this.description = original.description;
        this.mimeType = original.mimeType;
        this.sizeInBytes = original.size;
    }
}
class McpResourceTemplate {
    constructor(_server, _definition, icons) {
        this._server = _server;
        this._definition = _definition;
        this.icons = icons;
        this.name = _definition.name;
        this.description = _definition.description;
        this.mimeType = _definition.mimeType;
        this.title = _definition.title;
        this.template = UriTemplate.parse(_definition.uriTemplate);
    }
    resolveURI(vars) {
        const serverUri = this.template.resolve(vars);
        return McpResourceURI.fromServer(this._server.definition, serverUri);
    }
    async complete(templatePart, prefix, alreadyResolved, token) {
        const result = await McpServer.callOn(this._server, h => h.complete({
            ref: { type: 'ref/resource', uri: this._definition.uriTemplate },
            argument: { name: templatePart, value: prefix },
            context: {
                arguments: mapValues(alreadyResolved, v => Array.isArray(v) ? v.join('/') : v),
            },
        }, token), token);
        return result.completion.values;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwU2VydmVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL21jcC9jb21tb24vbWNwU2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUscUJBQXFCLEVBQUUsU0FBUyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDM0csT0FBTyxFQUFFLGlCQUFpQixFQUFFLHVCQUF1QixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9ELE9BQU8sS0FBSyxJQUFJLE1BQU0saUNBQWlDLENBQUM7QUFDeEQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDOUcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE9BQU8sRUFBRSx5QkFBeUIsRUFBc0QsbUJBQW1CLEVBQUUsaUJBQWlCLEVBQUUsZUFBZSxFQUFFLFdBQVcsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3JQLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDakYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsZUFB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