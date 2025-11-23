/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { equals } from '../../../../base/common/arrays.js';
import { assertNever, softAssertNever } from '../../../../base/common/assert.js';
import { DeferredPromise, IntervalTimer } from '../../../../base/common/async.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { CancellationError } from '../../../../base/common/errors.js';
import { Emitter } from '../../../../base/common/event.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { autorun } from '../../../../base/common/observable.js';
import { canLog, log, LogLevel } from '../../../../platform/log/common/log.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { McpError, MpcResponseError } from './mcpTypes.js';
import { MCP } from './modelContextProtocol.js';
/**
 * Request handler for communicating with an MCP server.
 *
 * Handles sending requests and receiving responses, with automatic
 * handling of ping requests and typed client request methods.
 */
export class McpServerRequestHandler extends Disposable {
    set roots(roots) {
        if (!equals(this._roots, roots)) {
            this._roots = roots;
            if (this._hasAnnouncedRoots) {
                this.sendNotification({ method: 'notifications/roots/list_changed' });
                this._hasAnnouncedRoots = false;
            }
        }
    }
    get capabilities() {
        return this._serverInit.capabilities;
    }
    get serverInfo() {
        return this._serverInit.serverInfo;
    }
    get serverInstructions() {
        return this._serverInit.instructions;
    }
    /**
     * Connects to the MCP server and does the initialization handshake.
     * @throws MpcResponseError if the server fails to initialize.
     */
    static async create(instaService, opts, token) {
        const mcp = new McpServerRequestHandler(opts);
        const store = new DisposableStore();
        try {
            const timer = store.add(new IntervalTimer());
            timer.cancelAndSet(() => {
                opts.logger.info('Waiting for server to respond to `initialize` request...');
            }, 5000);
            await instaService.invokeFunction(async (accessor) => {
                const productService = accessor.get(IProductService);
                const initialized = await mcp.sendRequest({
                    method: 'initialize',
                    params: {
                        protocolVersion: MCP.LATEST_PROTOCOL_VERSION,
                        capabilities: {
                            roots: { listChanged: true },
                            sampling: opts.createMessageRequestHandler ? {} : undefined,
                            elicitation: opts.elicitationRequestHandler ? { form: {}, url: {} } : undefined,
                        },
                        clientInfo: {
                            name: productService.nameLong,
                            version: productService.version,
                        }
                    }
                }, token);
                mcp._serverInit = initialized;
                mcp._sendLogLevelToServer(opts.logger.getLevel());
                mcp.sendNotification({
                    method: 'notifications/initialized'
                });
            });
            return mcp;
        }
        catch (e) {
            mcp.dispose();
            throw e;
        }
        finally {
            store.dispose();
        }
    }
    constructor({ launch, logger, createMessageRequestHandler, elicitationRequestHandler, requestLogLevel = LogLevel.Debug, }) {
        super();
        this._nextRequestId = 1;
        this._pendingRequests = new Map();
        this._hasAnnouncedRoots = false;
        this._roots = [];
        // Event emitters for server notifications
        this._onDidReceiveCancelledNotification = this._register(new Emitter());
        this.onDidReceiveCancelledNotification = this._onDidReceiveCancelledNotification.event;
        this._onDidReceiveProgressNotification = this._register(new Emitter());
        this.onDidReceiveProgressNotification = this._onDidReceiveProgressNotification.event;
        this._onDidReceiveElicitationCompleteNotification = this._register(new Emitter());
        this.onDidReceiveElicitationCompleteNotification = this._onDidReceiveElicitationCompleteNotification.event;
        this._onDidChangeResourceList = this._register(new Emitter());
        this.onDidChangeResourceList = this._onDidChangeResourceList.event;
        this._onDidUpdateResource = this._register(new Emitter());
        this.onDidUpdateResource = this._onDidUpdateResource.event;
        this._onDidChangeToolList = this._register(new Emitter());
        this.onDidChangeToolList = this._onDidChangeToolList.event;
        this._onDidChangePromptList = this._register(new Emitter());
        this.onDidChangePromptList = this._onDidChangePromptList.event;
        this._launch = launch;
        this.logger = logger;
        this._requestLogLevel = requestLogLevel;
        this._createMessageRequestHandler = createMessageRequestHandler;
        this._elicitationRequestHandler = elicitationRequestHandler;
        this._register(launch.onDidReceiveMessage(message => this.handleMessage(message)));
        this._register(autorun(reader => {
            const state = launch.state.read(reader).state;
            // the handler will get disposed when the launch stops, but if we're still
            // create()'ing we need to make sure to cancel the initialize request.
            if (state === 3 /* McpConnectionState.Kind.Error */ || state === 0 /* McpConnectionState.Kind.Stopped */) {
                this.cancelAllRequests();
            }
        }));
        // Listen for log level changes and forward them to the MCP server
        this._register(logger.onDidChangeLogLevel((logLevel) => {
            this._sendLogLevelToServer(logLevel);
        }));
    }
    /**
     * Send a client request to the server and return the response.
     *
     * @param request The request to send
     * @param token Cancellation token
     * @param timeoutMs Optional timeout in milliseconds
     * @returns A promise that resolves with the response
     */
    async sendRequest(request, token = CancellationToken.None) {
        if (this._store.isDisposed) {
            return Promise.reject(new CancellationError());
        }
        const id = this._nextRequestId++;
        // Create the full JSON-RPC request
        const jsonRpcRequest = {
            jsonrpc: MCP.JSONRPC_VERSION,
            id,
            ...request
        };
        const promise = new DeferredPromise();
        // Store the pending request
        this._pendingRequests.set(id, { promise });
        // Set up cancellation
        const cancelListener = token.onCancellationRequested(() => {
            if (!promise.isSettled) {
                this._pendingRequests.delete(id);
                this.sendNotification({ method: 'notifications/cancelled', params: { requestId: id } });
                promise.cancel();
            }
            cancelListener.dispose();
        });
        // Send the request
        this.send(jsonRpcRequest);
        const ret = promise.p.finally(() => {
            cancelListener.dispose();
            this._pendingRequests.delete(id);
        });
        return ret;
    }
    send(mcp) {
        if (canLog(this.logger.getLevel(), this._requestLogLevel)) { // avoid building the string if we don't need to
            log(this.logger, this._requestLogLevel, `[editor -> server] ${JSON.stringify(mcp)}`);
        }
        this._launch.send(mcp);
    }
    /**
     * Handles paginated requests by making multiple requests until all items are retrieved.
     *
     * @param method The method name to call
     * @param getItems Function to extract the array of items from a result
     * @param initialParams Initial parameters
     * @param token Cancellation token
     * @returns Promise with all items combined
     */
    async *sendRequestPaginated(method, getItems, initialParams, token = CancellationToken.None) {
        let nextCursor = undefined;
        do {
            const params = {
                ...initialParams,
                cursor: nextCursor
            };
            const result = await this.sendRequest({ method, params }, token);
            yield getItems(result);
            nextCursor = result.nextCursor;
        } while (nextCursor !== undefined && !token.isCancellationRequested);
    }
    sendNotification(notification) {
        this.send({ ...notification, jsonrpc: MCP.JSONRPC_VERSION });
    }
    /**
     * Handle incoming messages from the server
     */
    handleMessage(message) {
        if (canLog(this.logger.getLevel(), this._requestLogLevel)) { // avoid building the string if we don't need to
            log(this.logger, this._requestLogLevel, `[server -> editor] ${JSON.stringify(message)}`);
        }
        // Handle responses to our requests
        if ('id' in message) {
            if ('result' in message) {
                this.handleResult(message);
            }
            else if ('error' in message) {
                this.handleError(message);
            }
        }
        // Handle requests from the server
        if ('method' in message) {
            if ('id' in message) {
                this.handleServerRequest(message);
            }
            else {
                this.handleServerNotification(message);
            }
        }
    }
    /**
     * Handle successful responses
     */
    handleResult(response) {
        const request = this._pendingRequests.get(response.id);
        if (request) {
            this._pendingRequests.delete(response.id);
            request.promise.complete(response.result);
        }
    }
    /**
     * Handle error responses
     */
    handleError(response) {
        const request = this._pendingRequests.get(response.id);
        if (request) {
            this._pendingRequests.delete(response.id);
            request.promise.error(new MpcResponseError(response.error.message, response.error.code, response.error.data));
        }
    }
    /**
     * Handle incoming server requests
     */
    async handleServerRequest(request) {
        try {
            let response;
            if (request.method === 'ping') {
                response = this.handlePing(request);
            }
            else if (request.method === 'roots/list') {
                response = this.handleRootsList(request);
            }
            else if (request.method === 'sampling/createMessage' && this._createMessageRequestHandler) {
                response = await this._createMessageRequestHandler(request.params);
            }
            else if (request.method === 'elicitation/create' && this._elicitationRequestHandler) {
                response = await this._elicitationRequestHandler(request.params);
            }
            else {
                throw McpError.methodNotFound(request.method);
            }
            this.respondToRequest(request, response);
        }
        catch (e) {
            if (!(e instanceof McpError)) {
                this.logger.error(`Error handling request ${request.method}:`, e);
                e = McpError.unknown(e);
            }
            const errorResponse = {
                jsonrpc: MCP.JSONRPC_VERSION,
                id: request.id,
                error: {
                    code: e.code,
                    message: e.message,
                    data: e.data,
                }
            };
            this.send(errorResponse);
        }
    }
    /**
     * Handle incoming server notifications
     */
    handleServerNotification(request) {
        switch (request.method) {
            case 'notifications/message':
                return this.handleLoggingNotification(request);
            case 'notifications/cancelled':
                this._onDidReceiveCancelledNotification.fire(request);
                return this.handleCancelledNotification(request);
            case 'notifications/progress':
                this._onDidReceiveProgressNotification.fire(request);
                return;
            case 'notifications/resources/list_changed':
                this._onDidChangeResourceList.fire();
                return;
            case 'notifications/resources/updated':
                this._onDidUpdateResource.fire(request);
                return;
            case 'notifications/tools/list_changed':
                this._onDidChangeToolList.fire();
                return;
            case 'notifications/prompts/list_changed':
                this._onDidChangePromptList.fire();
                return;
            case 'notifications/elicitation/complete':
                this._onDidReceiveElicitationCompleteNotification.fire(request);
                return;
            default:
                softAssertNever(request);
        }
    }
    handleCancelledNotification(request) {
        const pendingRequest = this._pendingRequests.get(request.params.requestId);
        if (pendingRequest) {
            this._pendingRequests.delete(request.params.requestId);
            pendingRequest.promise.cancel();
        }
    }
    handleLoggingNotification(request) {
        let contents = typeof request.params.data === 'string' ? request.params.data : JSON.stringify(request.params.data);
        if (request.params.logger) {
            contents = `${request.params.logger}: ${contents}`;
        }
        switch (request.params?.level) {
            case 'debug':
                this.logger.debug(contents);
                break;
            case 'info':
            case 'notice':
                this.logger.info(contents);
                break;
            case 'warning':
                this.logger.warn(contents);
                break;
            case 'error':
            case 'critical':
            case 'alert':
            case 'emergency':
                this.logger.error(contents);
                break;
            default:
                this.logger.info(contents);
                break;
        }
    }
    /**
     * Send a generic response to a request
     */
    respondToRequest(request, result) {
        const response = {
            jsonrpc: MCP.JSONRPC_VERSION,
            id: request.id,
            result
        };
        this.send(response);
    }
    /**
     * Send a response to a ping request
     */
    handlePing(_request) {
        return {};
    }
    /**
     * Send a response to a roots/list request
     */
    handleRootsList(_request) {
        this._hasAnnouncedRoots = true;
        return { roots: this._roots };
    }
    cancelAllRequests() {
        this._pendingRequests.forEach(pending => pending.promise.cancel());
        this._pendingRequests.clear();
    }
    dispose() {
        this.cancelAllRequests();
        super.dispose();
    }
    /**
     * Forwards log level changes to the MCP server if it supports logging
     */
    async _sendLogLevelToServer(logLevel) {
        try {
            // Only send if the server supports logging capabilities
            if (!this.capabilities.logging) {
                return;
            }
            await this.setLevel({ level: mapLogLevelToMcp(logLevel) });
        }
        catch (error) {
            this.logger.error(`Failed to set MCP server log level: ${error}`);
        }
    }
    /**
     * Send an initialize request
     */
    initialize(params, token) {
        return this.sendRequest({ method: 'initialize', params }, token);
    }
    /**
     * List available resources
     */
    listResources(params, token) {
        return Iterable.asyncToArrayFlat(this.listResourcesIterable(params, token));
    }
    /**
     * List available resources (iterable)
     */
    listResourcesIterable(params, token) {
        return this.sendRequestPaginated('resources/list', result => result.resources, params, token);
    }
    /**
     * Read a specific resource
     */
    readResource(params, token) {
        return this.sendRequest({ method: 'resources/read', params }, token);
    }
    /**
     * List available resource templates
     */
    listResourceTemplates(params, token) {
        return Iterable.asyncToArrayFlat(this.sendRequestPaginated('resources/templates/list', result => result.resourceTemplates, params, token));
    }
    /**
     * Subscribe to resource updates
     */
    subscribe(params, token) {
        return this.sendRequest({ method: 'resources/subscribe', params }, token);
    }
    /**
     * Unsubscribe from resource updates
     */
    unsubscribe(params, token) {
        return this.sendRequest({ method: 'resources/unsubscribe', params }, token);
    }
    /**
     * List available prompts
     */
    listPrompts(params, token) {
        return Iterable.asyncToArrayFlat(this.sendRequestPaginated('prompts/list', result => result.prompts, params, token));
    }
    /**
     * Get a specific prompt
     */
    getPrompt(params, token) {
        return this.sendRequest({ method: 'prompts/get', params }, token);
    }
    /**
     * List available tools
     */
    listTools(params, token) {
        return Iterable.asyncToArrayFlat(this.sendRequestPaginated('tools/list', result => result.tools, params, token));
    }
    /**
     * Call a specific tool
     */
    callTool(params, token) {
        return this.sendRequest({ method: 'tools/call', params }, token);
    }
    /**
     * Set the logging level
     */
    setLevel(params, token) {
        return this.sendRequest({ method: 'logging/setLevel', params }, token);
    }
    /**
     * Find completions for an argument
     */
    complete(params, token) {
        return this.sendRequest({ method: 'completion/complete', params }, token);
    }
}
/**
 * Maps VSCode LogLevel to MCP LoggingLevel
 */
function mapLogLevelToMcp(logLevel) {
    switch (logLevel) {
        case LogLevel.Trace:
            return 'debug'; // MCP doesn't have trace, use debug
        case LogLevel.Debug:
            return 'debug';
        case LogLevel.Info:
            return 'info';
        case LogLevel.Warning:
            return 'warning';
        case LogLevel.Error:
            return 'error';
        case LogLevel.Off:
            return 'emergency'; // MCP doesn't have off, use emergency
        default:
            return assertNever(logLevel); // Off and other levels are not supported
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwU2VydmVyUmVxdWVzdEhhbmRsZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2NvbW1vbi9tY3BTZXJ2ZXJSZXF1ZXN0SGFuZGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDM0QsT0FBTyxFQUFFLFdBQVcsRUFBRSxlQUFlLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNqRixPQUFPLEVBQUUsZUFBZSxFQUFFLGFBQWEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFaEUsT0FBTyxFQUFFLE1BQU0sRUFBVyxHQUFHLEVBQUUsUUFBUSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDeEYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBRXhGLE9BQU8sRUFBeUMsUUFBUSxFQUFFLGdCQUFnQixFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQXVCaEQ7Ozs7O0dBS0c7QUFDSCxNQUFNLE9BQU8sdUJBQXdCLFNBQVEsVUFBVTtJQU90RCxJQUFXLEtBQUssQ0FBQyxL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