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
import { DeferredPromise, raceCancellationError, Sequencer, timeout } from '../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../base/common/cancellation.js';
import { CancellationError } from '../../../base/common/errors.js';
import { Disposable, DisposableMap, DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { AUTH_SCOPE_SEPARATOR, fetchAuthorizationServerMetadata, fetchResourceMetadata, getDefaultMetadataForUrl, parseWWWAuthenticateHeader, scopesMatch } from '../../../base/common/oauth.js';
import { SSEParser } from '../../../base/common/sseParser.js';
import { URI } from '../../../base/common/uri.js';
import { vArray, vNumber, vObj, vObjAny, vOptionalProp, vString } from '../../../base/common/validation.js';
import { ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { canLog, ILogService, LogLevel } from '../../../platform/log/common/log.js';
import product from '../../../platform/product/common/product.js';
import { extensionPrefixedIdentifier, McpServerLaunch, UserInteractionRequiredError } from '../../contrib/mcp/common/mcpTypes.js';
import { MCP } from '../../contrib/mcp/common/modelContextProtocol.js';
import { checkProposedApiEnabled, isProposedApiEnabled } from '../../services/extensions/common/extensions.js';
import { MainContext } from './extHost.protocol.js';
import { IExtHostInitDataService } from './extHostInitDataService.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import * as Convert from './extHostTypeConverters.js';
import { McpToolAvailability } from './extHostTypes.js';
import { IExtHostVariableResolverProvider } from './extHostVariableResolverService.js';
import { IExtHostWorkspace } from './extHostWorkspace.js';
export const IExtHostMpcService = createDecorator('IExtHostMpcService');
const serverDataValidation = vObj({
    label: vString(),
    version: vOptionalProp(vString()),
    metadata: vOptionalProp(vObj({
        capabilities: vOptionalProp(vObjAny()),
        serverInfo: vOptionalProp(vObjAny()),
        tools: vOptionalProp(vArray(vObj({
            availability: vNumber(),
            definition: vObjAny(),
        }))),
    })),
    authentication: vOptionalProp(vObj({
        providerId: vString(),
        scopes: vArray(vString()),
    }))
});
// Can be validated with:
// declare const _serverDataValidationTest: vscode.McpStdioServerDefinition | vscode.McpHttpServerDefinition;
// const _serverDataValidationProd: ValidatorType<typeof serverDataValidation> = _serverDataValidationTest;
let ExtHostMcpService = class ExtHostMcpService extends Disposable {
    constructor(extHostRpc, _logService, _extHostInitData, _workspaceService, _variableResolver) {
        super();
        this._logService = _logService;
        this._extHostInitData = _extHostInitData;
        this._workspaceService = _workspaceService;
        this._variableResolver = _variableResolver;
        this._initialProviderPromises = new Set();
        this._sseEventSources = this._register(new DisposableMap());
        this._unresolvedMcpServers = new Map();
        this._proxy = extHostRpc.getProxy(MainContext.MainThreadMcp);
    }
    $startMcp(id, opts) {
        this._startMcp(id, McpServerLaunch.fromSerialized(opts.launch), opts.defaultCwd && URI.revive(opts.defaultCwd), opts.errorOnUserInteraction);
    }
    _startMcp(id, launch, _defaultCwd, errorOnUserInteraction) {
        if (launch.type === 2 /* McpServerTransportType.HTTP */) {
            this._sseEventSources.set(id, new McpHTTPHandle(id, launch, this._proxy, this._logService, errorOnUserInteraction));
            return;
        }
        throw new Error('not implemented');
    }
    async $substituteVariables(_workspaceFolder, value) {
        const folderURI = URI.revive(_workspaceFolder);
        const folder = folderURI && await this._workspaceService.resolveWorkspaceFolder(folderURI);
        const variableResolver = await this._variableResolver.getResolver();
        return variableResolver.resolveAsync(folder && {
            uri: folder.uri,
            name: folder.name,
            index: folder.index,
        }, value);
    }
    $stopMcp(id) {
        this._sseEventSources.get(id)
            ?.close()
            .then(() => this._didClose(id));
    }
    _didClose(id) {
        this._sseEventSources.deleteAndDispose(id);
    }
    $sendMessage(id, message) {
        this._sseEventSources.get(id)?.send(message);
    }
    async $waitForInitialCollectionProviders() {
        await Promise.all(this._initialProviderPromises);
    }
    async $resolveMcpLaunch(collectionId, label) {
        const rec = this._unresolvedMcpServers.get(collectionId);
        if (!rec) {
            return;
        }
        const server = rec.servers.find(s => s.label === label);
        if (!server) {
            return;
        }
        if (!rec.provider.resolveMcpServerDefinition) {
            return Convert.McpServerDefinition.from(server);
        }
        const resolved = await rec.provider.resolveMcpServerDefinition(server, CancellationToken.None);
        return resolved ? Convert.McpServerDefinition.from(resolved) : undefined;
    }
    /** {@link vscode.lm.registerMcpServerDefinitionProvider} */
    registerMcpConfigurationProvider(extension, id, provider) {
        const store = new DisposableStore();
        const metadata = extension.contributes?.mcpServerDefinitionProviders?.find(m => m.id === id);
        if (!metadata) {
            throw new Error(`MCP configuration providers must be registered in the contributes.mcpServerDefinitionProviders array within your package.json, but "${id}" was not`);
        }
        const mcp = {
            id: extensionPrefixedIdentifier(extension.identifier, id),
            isTrustedByDefault: true,
            label: metadata?.label ?? extension.displayName ?? extension.name,
            scope: 1 /* StorageScope.WORKSPACE */,
            canResolveLaunch: typeof provider.resolveMcpServerDefinition === 'function',
            extensionId: extension.identifier.value,
            configTarget: this._extHostInitData.remote.isRemote ? 4 /* ConfigurationTarget.USER_REMOTE */ : 2 /* ConfigurationTarget.USER */,
        };
        const update = async () => {
            const list = await provider.provideMcpServerDefinitions(CancellationToken.None);
            this._unresolvedMcpServers.set(mcp.id, { servers: list ?? [], provider });
            const servers = [];
            for (const item of list ?? []) {
                let id = ExtensionIdentifier.toKey(extension.identifier) + '/' + item.label;
                if (servers.some(s => s.id === id)) {
                    let i = 2;
                    while (servers.some(s => s.id === id + i)) {
                        i++;
                    }
                    id = id + i;
                }
                serverDataValidation.validateOrThrow(item);
                if (item.authentication) {
                    checkProposedApiEnabled(extension, 'mcpToolDefinitions');
                }
                let staticMetadata;
                const castAs2 = item;
                if (isProposedApiEnabled(extension, 'mcpToolDefinitions') && castAs2.metadata) {
                    staticMetadata = {
                        capabilities: castAs2.metadata.capabilities,
                        instructions: castAs2.metadata.instructions,
                        serverInfo: castAs2.metadata.serverInfo,
                        tools: castAs2.metadata.tools?.map(t => ({
                            availability: t.availability === McpToolAvailability.Dynamic ? 1 /* McpServerStaticToolAvailability.Dynamic */ : 0 /* McpServerStaticToolAvailability.Initial */,
                            definition: t.definition,
                        })),
                    };
                }
                servers.push({
                    id,
                    label: item.label,
                    cacheNonce: item.version || '$$NONE',
                    staticMetadata,
                    launch: Convert.McpServerDefinition.from(item),
                });
            }
            this._proxy.$upsertMcpCollection(mcp, servers);
        };
        store.add(toDisposable(() => {
            this._unresolvedMcpServers.delete(mcp.id);
            this._proxy.$deleteMcpCollection(mcp.id);
        }));
        if (provider.onDidChangeMcpServerDefinitions) {
            store.add(provider.onDidChangeMcpServerDefinitions(update));
        }
        // todo@connor4312: proposed API back-compat
        // eslint-disable-next-line local/code-no-any-casts
        if (provider.onDidChangeServerDefinitions) {
            // eslint-disable-next-line local/code-no-any-casts
            store.add(provider.onDidChangeServerDefinitions(update));
        }
        // eslint-disable-next-line local/code-no-any-casts
        if (provider.onDidChange) {
            // eslint-disable-next-line local/code-no-any-casts
            store.add(provider.onDidChange(update));
        }
        const promise = new Promise(resolve => {
            setTimeout(() => update().finally(() => {
                this._initialProviderPromises.delete(promise);
                resolve();
            }), 0);
        });
        this._initialProviderPromises.add(promise);
        return store;
    }
};
ExtHostMcpService = __decorate([
    __param(0, IExtHostRpcService),
    __param(1, ILogService),
    __param(2, IExtHostInitDataService),
    __param(3, IExtHostWorkspace),
    __param(4, IExtHostVariableResolverProvider)
], ExtHostMcpService);
export { ExtHostMcpService };
var HttpMode;
(function (HttpMode) {
    HttpMode[HttpMode["Unknown"] = 0] = "Unknown";
    HttpMode[HttpMode["Http"] = 1] = "Http";
    HttpMode[HttpMode["SSE"] = 2] = "SSE";
})(HttpMode || (HttpMode = {}));
const MAX_FOLLOW_REDIRECTS = 5;
const REDIRECT_STATUS_CODES = [301, 302, 303, 307, 308];
/**
 * Implementation of both MCP HTTP Streaming as well as legacy SSE.
 *
 * The first request will POST to the endpoint, assuming HTTP streaming. If the
 * server is legacy SSE, it should return some 4xx status in that case,
 * and we'll automatically fall back to SSE and res
 */
export class McpHTTPHandle extends Disposable {
    constructor(_id, _launch, _proxy, _logService, _errorOnUserInteraction) {
        super();
        this._id = _id;
        this._launch = _launch;
        this._proxy = _proxy;
        this._logService = _logService;
        this._errorOnUserInteraction = _errorOnUserInteraction;
        this._requestSequencer = new Sequencer();
        this._postEndpoint = new DeferredPromise();
        this._mode = { value: 0 /* HttpMode.Unknown */ };
        this._cts = new CancellationTokenSource();
        this._abortCtrl = new AbortController();
        this._didSendClose = false;
        this._register(toDisposable(() => {
            this._abortCtrl.abort();
            this._cts.dispose(true);
        }));
        this._proxy.$onDidChangeState(this._id, { state: 2 /* McpConnectionState.Kind.Running */ });
    }
    async send(message) {
        try {
            if (this._mode.value === 0 /* HttpMode.Unknown */) {
                await this._requestSequencer.queue(() => this._send(message));
            }
            else {
                await this._send(message);
            }
        }
        catch (err) {
            const msg = `Error sending message to ${this._launch.uri}: ${String(err)}`;
            this._proxy.$onDidChangeState(this._id, { state: 3 /* McpConnectionState.Kind.Error */, message: msg });
        }
    }
    async close() {
        if (this._mode.value === 1 /* HttpMode.Http */ && this._mode.sessionId && !this._didSendClose) {
            this._didSendClose = true;
            try {
                await this._closeSession(this._mode.sessionId);
            }
            catch {
                // ignored -- already logged
            }
        }
        this._proxy.$onDidChangeState(this._id, { state: 0 /* McpConnectionState.Kind.Stopped */ });
    }
    async _closeSession(sessionId) {
        const headers = {
            ...Object.fromEntries(this._launch.headers),
            'Mcp-Session-Id': sessionId,
        };
        await this._addAuthHeader(headers);
        // no fetch with retry here -- don't try to auth if we get an auth failure
        await this._fetch(this._launch.uri.toString(true), {
            method: 'DELETE',
            headers,
        });
    }
    _send(message) {
        if (this._mode.value === 2 /* HttpMode.SSE */) {
            return this._sendLegacySSE(this._mode.endpoint, message);
        }
        else {
            return this._sendStreamableHttp(message, this._mode.value === 1 /* HttpMode.Http */ ? this._mode.sessionId : undefined);
        }
    }
    /**
     * Sends a streamable-HTTP request.
     * 1. Posts to the endpoint
     * 2. Updates internal state as needed. Falls back to SSE if appropriate.
     * 3. If the response body is empty, JSON, or a JSON stream, handle it appropriately.
     */
    async _sendStreamableHttp(message, sessionId) {
        const asBytes = new TextEncoder().encode(message);
        const headers = {
            ...Object.fromEntries(this._launch.headers),
            'Content-Type': 'application/json',
            'Content-Length': String(asBytes.length),
            Accept: 'text/event-stream, application/json',
        };
        if (sessionId) {
            headers['Mcp-Session-Id'] = sessionId;
        }
        await this._addAuthHeader(headers);
        const res = await this._fetchWithAuthRetry(this._launch.uri.toString(true), {
            method: 'POST',
            headers,
            body: asBytes,
        }, headers);
        const wasUnknown = this._mode.value === 0 /* HttpMode.Unknown */;
        // Mcp-Session-Id is the strongest signal that we're in streamable HTTP mode
        const nextSessionId = res.headers.get('Mcp-Session-Id');
        if (nextSessionId) {
            this._mode = { value: 1 /* HttpMode.Http */, sessionId: nextSessionId };
        }
        if (this._mode.value === 0 /* HttpMode.Unknown */ &&
            // We care about 4xx errors...
            res.status >= 400 && res.status < 500
            // ...except for auth errors
            && !isAuthStatusCode(res.status)) {
            this._log(LogLevel.Info, `${res.status} status sending message to ${this._launch.uri}, will attempt to fall back to legacy SSE`);
            this._sseFallbackWithMessage(message);
            return;
        }
        if (res.status >= 300) {
            // "When a client receives HTTP 404 in response to a request containing an Mcp-Session-Id, it MUST start a new session by sending a new InitializeRequest without a session ID attached"
            // Though this says only 404, some servers send 400s as well, including their example
            // https://github.com/modelcontextprotocol/typescript-sdk/issues/389
            const retryWithSessionId = this._mode.value === 1 /* HttpMode.Http */ && !!this._mode.sessionId && (res.status === 400 || res.status === 404);
            this._proxy.$onDidChangeState(this._id, {
                state: 3 /* McpConnectionState.Kind.Error */,
                message: `${res.status} status sending message to ${this._launch.uri}: ${await this._getErrText(res)}` + (retryWithSessionId ? `; will retry with new session ID` : ''),
                shouldRetry: retryWithSessionId,
            });
            return;
        }
        if (this._mode.value === 0 /* HttpMode.Unknown */) {
            this._mode = { value: 1 /* HttpMode.Http */, sessionId: undefined };
        }
        if (wasUnknown) {
            this._attachStreamableBackchannel();
        }
        await this._handleSuccessfulStreamableHttp(res, message);
    }
    async _sseFallbackWithMessage(message) {
        const endpoint = await this._attachSSE();
        if (endpoint) {
            this._mode = { value: 2 /* HttpMode.SSE */, endpoint };
            await this._sendLegacySSE(endpoint, message);
        }
    }
    async _populateAuthMetadata(mcpUrl, originalResponse) {
        // If there is a resource_metadata challenge, use that to get the oauth server. This is done in 2 steps.
        // First, extract the resource_metada challenge from the WWW-Authenticate header (if available)
        const { resourceMetadataChallenge, scopesChallenge: scopesChallengeFromHeader } = this._parseWWWAuthenticateHeader(originalResponse);
        // Second, fetch the resource metadata either from the challenge URL or from well-known URIs
        let serverMetadataUrl;
        let resource;
        let scopesChallenge = scopesChallengeFromHeader;
        try {
            const resourceMetadata = await fetchResourceMetadata(mcpUrl, resourceMetadataChallenge, {
                sameOriginHeaders: {
                    ...Object.fromEntries(this._launch.headers),
                    'MCP-Protocol-Version': MCP.LATEST_PROTOCOL_VERSION
                },
                fetch: (url, init) => this._fetch(url, init)
            });
            // TODO:@TylerLeonhardt support multiple authorization servers
            // Consider using one that has an auth provider first, over the dynamic flow
            serverMetadataUrl = resourceMetadata.authorization_servers?.[0];
            this._log(LogLevel.Debug, `Using auth server metadata url: ${serverMetadataUrl}`);
            scopesChallenge ??= resourceMetadata.scopes_supported;
            resource = resourceMetadata;
        }
        catch (e) {
            this._log(LogLevel.Debug, `Could not fetch resource metadata: ${String(e)}`);
        }
        const baseUrl = new URL(originalResponse.url).origin;
        // If we are not given a resource_metadata, see if the well-known server metadata is available
        // on the base url.
        let additionalHeaders = {};
        if (!serverMetadataUrl) {
            serverMetadataUrl = baseUrl;
            // Maintain the launch headers when talking to the MCP origin.
            additionalHeaders = {
                ...Object.fromEntries(this._launch.headers),
                'MCP-Protocol-Version': MCP.LATEST_PROTOCOL_VERSION
            };
        }
        try {
            this._log(LogLevel.Debug, `Fetching auth server metadata for: ${serverMetadataUrl} ...`);
            const serverMetadataResponse = await fetchAuthorizationServerMetadata(serverMetadataUrl, {
                additionalHeaders,
                fetch: (url, init) => this._fetch(url, init)
            });
            this._log(LogLevel.Info, 'Populated auth metadata');
            this._authMetadata = {
                authorizationServer: URI.parse(serverMetadataUrl),
                serverMetadata: serverMetadataResponse,
                resourceMetadata: resource,
                scopes: scopesChallenge
            };
            return;
        }
        catch (e) {
            this._log(LogLevel.Warning, `Error populating auth server metadata for ${serverMetadataUrl}: ${String(e)}`);
        }
        // If there's no well-known server metadata, then use the default values based off of the url.
        const defaultMetadata = getDefaultMetadataForUrl(new URL(baseUrl));
        this._authMetadata = {
            authorizationServer: URI.parse(baseUrl),
            serverMetadata: defaultMetadata,
            resourceMetadata: resource,
            scopes: scopesChallenge
        };
        this._log(LogLevel.Info, 'Using default auth metadata');
    }
    async _handleSuccessfulStreamableHttp(res, message) {
        if (res.status === 202) {
            return; // no body
        }
        const contentType = res.headers.get('Content-Type')?.toLowerCase() || '';
        if (contentType.startsWith('text/event-stream')) {
            const parser = new SSEParser(event => {
                if (event.type === 'message') {
                    this._proxy.$onDidReceiveMessage(this._id, event.data);
                }
                else if (event.type === 'endpoint') {
                    // An SSE server that didn't correctly return a 4xx status when we POSTed
                    this._log(LogLevel.Warning, `Received SSE endpoint from a POST to ${this._launch.uri}, will fall back to legacy SSE`);
                    this._sseFallbackWithMessage(message);
                    throw new CancellationError(); // just to end the SSE stream
                }
            });
            try {
                await this._doSSE(parser, res);
            }
            catch (err) {
                this._log(LogLevel.Warning, `Error reading SSE stream: ${String(err)}`);
            }
        }
        else if (contentType.startsWith('application/json')) {
            this._proxy.$onDidReceiveMessage(this._id, await res.text());
        }
        else {
            const responseBody = await res.text();
            if (isJSON(responseBody)) { // try to read as JSON even if the server didn't set the content type
                this._proxy.$onDidReceiveMessage(this._id, responseBody);
            }
            else {
                this._log(LogLevel.Warning, `Unexpected ${res.status} response for request: ${responseBody}`);
            }
        }
    }
    /**
     * Attaches the SSE backchannel that streamable HTTP servers can use
     * for async notifications. This is a "MAY" support, so if the server gives
     * us a 4xx code, we'll stop trying to connect..
     */
    async _attachStreamableBackchannel() {
        let lastEventId;
        let canReconnectAt;
        for (let retry = 0; !this._store.isDisposed; retry++) {
            if (canReconnectAt !== undefined) {
                await timeout(Math.max(0, canReconnectAt - Date.now()), this._cts.token);
                canReconnectAt = undefined;
            }
            else {
                await timeout(Math.min(retry * 1000, 30_000), this._cts.token);
            }
            let res;
            try {
                const headers = {
                    ...Object.fromEntries(this._launch.headers),
                    'Accept': 'text/event-stream',
                };
                await this._addAuthHeader(headers);
                if (this._mode.value === 1 /* HttpMode.Http */ && this._mode.sessionId !== undefined) {
                    headers['Mcp-Session-Id'] = this._mode.sessionId;
                }
                if (lastEventId) {
                    headers['Last-Event-ID'] = lastEventId;
                }
                res = await this._fetchWithAuthRetry(this._launch.uri.toString(true), {
                    method: 'GET',
                    headers,
                }, headers);
            }
            catch (e) {
                this._log(LogLevel.Info, `Error connecting to ${this._launch.uri} for async notifications, will retry`);
                continue;
            }
            if (res.status >= 400) {
                this._log(LogLevel.Debug, `${res.status} status connecting to ${this._launch.uri} for async notifications; they will be disabled: ${await this._getErrText(res)}`);
                return;
            }
            // Only reset the retry counter if we definitely get an event stream to avoid
            // spamming servers that (incorrectly) don't return one from this endpoint.
            if (res.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
                retry = 0;
            }
            const parser = new SSEParser(event => {
                if (event.retry) {
                    canReconnectAt = Date.now() + event.retry;
                }
                if (event.type === 'message' && event.data) {
                    this._proxy.$onDidReceiveMessage(this._id, event.data);
                }
                if (event.id) {
                    lastEventId = event.id;
                }
            });
            try {
                await this._doSSE(parser, res);
            }
            catch (e) {
                this._log(LogLevel.Info, `Error reading from async stream, we will reconnect: ${e}`);
            }
        }
    }
    /**
     * Starts a legacy SSE attachment, where the SSE response is the session lifetime.
     * Unlike `_attachStreamableBackchannel`, this fails the server if it disconnects.
     */
    async _attachSSE() {
        const postEndpoint = new DeferredPromise();
        const headers = {
            ...Object.fromEntries(this._launch.headers),
            'Accept': 'text/event-stream',
        };
        await this._addAuthHeader(headers);
        let res;
        try {
            res = await this._fetchWithAuthRetry(this._launch.uri.toString(true), {
                method: 'GET',
                headers,
            }, headers);
            if (res.status >= 300) {
                this._proxy.$onDidChangeState(this._id, { state: 3 /* McpConnectionState.Kind.Error */, message: `${res.status} status connecting to ${this._launch.uri} as SSE: ${await this._getErrText(res)}` });
                return;
            }
        }
        catch (e) {
            this._proxy.$onDidChangeState(this._id, { state: 3 /* McpConnectionState.Kind.Error */, message: `Error connecting to ${this._launch.uri} as SSE: ${e}` });
            return;
        }
        const parser = new SSEParser(event => {
            if (event.type === 'message') {
                this._proxy.$onDidReceiveMessage(this._id, event.data);
            }
            else if (event.type === 'endpoint') {
                postEndpoint.complete(new URL(event.data, this._launch.uri.toString(true)).toString());
            }
        });
        this._register(toDisposable(() => postEndpoint.cancel()));
        this._doSSE(parser, res).catch(err => {
            this._proxy.$onDidChangeState(this._id, { state: 3 /* McpConnectionState.Kind.Error */, message: `Error reading SSE stream: ${String(err)}` });
        });
        return postEndpoint.p;
    }
    /**
     * Sends a legacy SSE message to the server. The response is always empty and
     * is otherwise received in {@link _attachSSE}'s loop.
     */
    async _sendLegacySSE(url, message) {
        const asBytes = new TextEncoder().encode(message);
        const headers = {
            ...Object.fromEntries(this._launch.headers),
            'Content-Type': 'application/json',
            'Content-Length': String(asBytes.length),
        };
        await this._addAuthHeader(headers);
        const res = await this._fetch(url, {
            method: 'POST',
            headers,
            body: asBytes,
        });
        if (res.status >= 300) {
            this._log(LogLevel.Warning, `${res.status} status sending message to ${this._postEndpoint}: ${await this._getErrText(res)}`);
        }
    }
    /** Generic handle to pipe a response into an SSE parser. */
    async _doSSE(parser, res) {
        if (!res.body) {
            return;
        }
        const reader = res.body.getReader();
        let chunk;
        do {
            try {
                chunk = await raceCancellationError(reader.read(), this._cts.token);
            }
            catch (err) {
                reader.cancel();
                if (this._store.isDisposed) {
                    return;
                }
                else {
                    throw err;
                }
            }
            if (chunk.value) {
                parser.feed(chunk.value);
            }
        } while (!chunk.done);
    }
    async _addAuthHeader(headers, forceNewRegistration) {
        if (this._authMetadata) {
            try {
                const authDetails = {
                    authorizationServer: this._authMetadata.authorizationServer.toJSON(),
                    authorizationServerMetadata: this._authMetadata.serverMetadata,
                    resourceMetadata: this._authMetadata.resourceMetadata,
                    scopes: this._authMetadata.scopes
                };
                const token = await this._proxy.$getTokenFromServerMetadata(this._id, authDetails, {
                    errorOnUserInteraction: this._errorOnUserInteraction,
                    forceNewRegistration
                });
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
            }
            catch (e) {
                if (UserInteractionRequiredError.is(e)) {
                    this._proxy.$onDidChangeState(this._id, { state: 0 /* McpConnectionState.Kind.Stopped */, reason: 'needs-user-interaction' });
                    throw new CancellationError();
                }
                this._log(LogLevel.Warning, `Error getting token from server metadata: ${String(e)}`);
            }
        }
        if (this._launch.authentication) {
            try {
                this._log(LogLevel.Debug, `Using provided authentication config: providerId=${this._launch.authentication.providerId}, scopes=${this._launch.authentication.scopes.join(', ')}`);
                const token = await this._proxy.$getTokenForProviderId(this._id, this._launch.authentication.providerId, this._launch.authentication.scopes, {
                    errorOnUserInteraction: this._errorOnUserInteraction,
                    forceNewRegistration
                });
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                    this._log(LogLevel.Info, 'Successfully obtained token from provided authentication config');
                }
            }
            catch (e) {
                if (UserInteractionRequiredError.is(e)) {
                    this._proxy.$onDidChangeState(this._id, { state: 0 /* McpConnectionState.Kind.Stopped */, reason: 'needs-user-interaction' });
                    throw new CancellationError();
                }
                this._log(LogLevel.Warning, `Error getting token from provided authentication config: ${String(e)}`);
            }
        }
        return headers;
    }
    _log(level, message) {
        if (!this._store.isDisposed) {
            this._proxy.$onDidPublishLog(this._id, level, message);
        }
    }
    _parseWWWAuthenticateHeader(response) {
        let resourceMetadataChallenge;
        let scopesChallenge;
        if (response.headers.has('WWW-Authenticate')) {
            const authHeader = response.headers.get('WWW-Authenticate');
            const challenges = parseWWWAuthenticateHeader(authHeader);
            for (const challenge of challenges) {
                if (challenge.scheme === 'Bearer') {
                    if (!resourceMetadataChallenge && challenge.params['resource_metadata']) {
                        resourceMetadataChallenge = challenge.params['resource_metadata'];
                        this._log(LogLevel.Debug, `Found resource_metadata challenge in WWW-Authenticate header: ${resourceMetadataChallenge}`);
                    }
                    if (!scopesChallenge && challenge.params['scope']) {
                        const scopes = challenge.params['scope'].split(AUTH_SCOPE_SEPARATOR).filter(s => s.trim().length);
                        if (scopes.length) {
                            this._log(LogLevel.Debug, `Found scope challenge in WWW-Authenticate header: ${challenge.params['scope']}`);
                            scopesChallenge = scopes;
                        }
                    }
                    if (resourceMetadataChallenge && scopesChallenge) {
                        break;
                    }
                }
            }
        }
        return { resourceMetadataChallenge, scopesChallenge };
    }
    async _getErrText(res) {
        try {
            return await res.text();
        }
        catch {
            return res.statusText;
        }
    }
    /**
     * Helper method to perform fetch with authentication retry logic.
     * If the initial request returns an auth error and we don't have auth metadata,
     * it will populate the auth metadata and retry once.
     * If we already have auth metadata, check if the scopes changed and update them.
     */
    async _fetchWithAuthRetry(mcpUrl, init, headers) {
        const doFetch = () => this._fetch(mcpUrl, init);
        let res = await doFetch();
        if (isAuthStatusCode(res.status)) {
            if (!this._authMetadata) {
                await this._populateAuthMetadata(mcpUrl, res);
                await this._addAuthHeader(headers);
                if (headers['Authorization']) {
                    // Update the headers in the init object
                    init.headers = headers;
                    res = await doFetch();
                }
            }
            else {
                // We have auth metadata, but got an auth error. Check if the scopes changed.
                const { scopesChallenge } = this._parseWWWAuthenticateHeader(res);
                if (!scopesMatch(scopesChallenge, this._authMetadata.scopes)) {
                    this._log(LogLevel.Debug, `Scopes changed from ${JSON.stringify(this._authMetadata.scopes)} to ${JSON.stringify(scopesChallenge)}, updating and retrying`);
                    this._authMetadata.scopes = scopesChallenge;
                    await this._addAuthHeader(headers);
                    if (headers['Authorization']) {
                        // Update the headers in the init object
                        init.headers = headers;
                        res = await doFetch();
                    }
                }
            }
        }
        // If we have an Authorization header and still get an auth error, we should retry with a new auth registration
        if (headers['Authorization'] && isAuthStatusCode(res.status)) {
            const errorText = await this._getErrText(res);
            this._log(LogLevel.Debug, `Received ${res.status} status with Authorization header, retrying with new auth registration. Error details: ${errorText || 'no additional details'}`);
            await this._addAuthHeader(headers, true);
            res = await doFetch();
        }
        return res;
    }
    async _fetch(url, init) {
        init.headers['user-agent'] = `${product.nameLong}/${product.version}`;
        if (canLog(this._logService.getLevel(), LogLevel.Trace)) {
            const traceObj = { ...init, headers: { ...init.headers } };
            if (traceObj.body) {
                traceObj.body = new TextDecoder().decode(traceObj.body);
            }
            if (traceObj.headers?.Authorization) {
                traceObj.headers.Authorization = '***'; // don't log the auth header
            }
            this._log(LogLevel.Trace, `Fetching ${url} with options: ${JSON.stringify(traceObj)}`);
        }
        let currentUrl = url;
        let response;
        for (let redirectCount = 0; redirectCount < MAX_FOLLOW_REDIRECTS; redirectCount++) {
            response = await this._fetchInternal(currentUrl, {
                ...init,
                signal: this._abortCtrl.signal,
                redirect: 'manual'
            });
            // Check for redirect status codes (301, 302, 303, 307, 308)
            if (!REDIRECT_STATUS_CODES.includes(response.status)) {
                break;
            }
            const location = response.headers.get('location');
            if (!location) {
                break;
            }
            const nextUrl = new URL(location, currentUrl).toString();
            this._log(LogLevel.Trace, `Redirect (${response.status}) from ${currentUrl} to ${nextUrl}`);
            currentUrl = nextUrl;
            // Per fetch spec, for 303 always use GET, keep method unless original was POST and 301/302, then GET.
            if (response.status === 303 || ((response.status === 301 || response.status === 302) && init.method === 'POST')) {
                init.method = 'GET';
                delete init.body;
            }
        }
        if (canLog(this._logService.getLevel(), LogLevel.Trace)) {
            const headers = {};
            response.headers.forEach((value, key) => { headers[key] = value; });
            this._log(LogLevel.Trace, `Fetched ${currentUrl}: ${JSON.stringify({
                status: response.status,
                headers: headers,
            })}`);
        }
        return response;
    }
    _fetchInternal(url, init) {
        return fetch(url, init);
    }
}
function isJSON(str) {
    try {
        JSON.parse(str);
        return true;
    }
    catch (e) {
        return false;
    }
}
function isAuthStatusCode(status) {
    return status === 401 || status === 403;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdE1jcC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0TWNwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxlQUFlLEVBQUUscUJBQXFCLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQzNHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBZSxZQUFZLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMxSCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsZ0NBQWdDLEVBQUUscUJBQXFCLEVBQUUsd0JBQXdCLEVBQXlFLDBCQUEwQixFQUFFLFdBQVcsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hRLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLDZCQUE2QixDQUFDO0FBQ2pFLE9BQU8sRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBRTVHLE9BQU8sRUFBRSxtQkFBbUIsRUFBeUIsTUFBTSxtREFBbUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDMUYsT0FBTyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDcEYsT0FBTyxPQUFPLE1BQU0sNkNBQTZDLENBQUM7QUFFbEUsT0FBTyxFQUFFLDJCQUEyQixFQUFvRSxlQUFlLEVBQTRHLDRCQUE0QixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDOVMsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQy9HLE9BQU8sRUFBZ0UsV0FBVyxFQUFzQixNQUFNLHVCQUF1QixDQUFDO0FBQ3RJLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3RFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQzVELE9BQU8sS0FBSyxPQUFPLE1BQU0sNEJBQTRCLENBQUM7QUFDdEQsT0FBTyxFQUFxRCxtQkFBbUIsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQzNHLE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBRTFELE1BQU0sQ0FBQyxNQUFNLGtCQUFrQixHQUFHLGVBQWUsQ0FBcUIsb0JBQW9CLENBQUMsQ0FBQztBQU01RixNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQztJQUNqQyxLQUFLLEVBQUUsT0FBTyxFQUFFO0lBQ2hCLE9BQU8sRUFBRSxhQUFhLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDakMsUUFBUSxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUM7UUFDNUIsWUFBWSxFQUFFLGFBQWEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN0QyxVQUFVLEVBQUUsYUFBYSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3BDLEtBQUssRUFBRSxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztZQUNoQyxZQUFZLEVBQUUsT0FBTyxFQUFFO1lBQ3ZCLFVBQVUsRUFBRSxPQUFPLEVBQUU7U0FDckIsQ0FBQyxDQUFDLENBQUM7S0FDSixDQUFDLENBQUM7SUFDSCxjQUFjLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQztRQUNsQyxVQUFVLEVBQUUsT0FBTyxFQUFFO1FBQ3JCLE1BQU0sRUFBRSxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7S0FDekIsQ0FBQyxDQUFDO0NBQ0gsQ0FBQyxDQUFDO0FBRUgseUJBQXlCO0FBQ3pCLDZHQUE2RztBQUM3RywyR0FBMkc7QUFFcEcsSUFBTSxpQkFBaUIsR0FBdkIsTUFBTSxpQkFBa0IsU0FBUSxVQUFVO0lBU2hELFlBQ3FCLFVBQThCLEVBQ3JDLFdBQTJDLEVBQy9CLGdCQUEwRCxFQUNoRSxpQkFBdUQsRUFDeEMsaUJBQW9FO1FBRXRHLEtBQUssRUFBRSxDQUFDO1FBTHdCLGdCQUFXLEdBQVgsV0FBVyxDQUFhO1FBQ2QscUJBQWdCLEdBQWhCLGdCQUFnQixDQUF5QjtRQUM3QyxzQkFBaUIsR0FBakIsaUJBQWlCLENBQW1CO1FBQ3ZCLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBa0M7UUFadEYsNkJBQXdCLEdBQUcsSUFBSSxHQUFHLEVBQWlCLENBQUM7UUFDbEQscUJBQWdCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGFBQWEsRUFBeUIsQ0FBQyxDQUFDO1FBQ2hGLDBCQUFxQixHQUFHLElBQUksR0FBRyxFQUc1QyxDQUFDO1FBVUosSUFBSSxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUM5RCxDQUFDO0lBRUQsU0FBUyxDQUFDLEVBQVUsRUFBRSxJQUFzQjtRQUMzQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBRSxlQUFlLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0lBQzlJLENBQUM7SUFFUyxTQUFTLENBQUMsRUFBVSxFQUFFLE1BQXVCLEVBQUUsV0FBaUIsRUFBRSxzQkFBZ0M7UUFDM0csSUFBSSxNQUFNLENBQUMsSUFBSSx3Q0FBZ0MsRUFBRSxDQUFDO1lBQ2pELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLElBQUksYUFBYSxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsV0FBVyxFQUFFLHNCQUFzQixDQUFDLENBQUMsQ0FBQztZQUNwSCxPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsS0FBSyxDQUFDLG9CQUFvQixDQUFJLGdCQUEyQyxFQUFFLEtBQVE7UUFDbEYsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQy9DLE1BQU0sTUFBTSxHQUFHLFNBQVMsSUFBSSxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxzQkFBc0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMzRixNQUFNLGdCQUFnQixHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3BFLE9BQU8sZ0JBQWdCLENBQUMsWUFBWSxDQUFDLE1BQU0sSUFBSTtZQUM5QyxHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQUc7WUFDZixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7WUFDakIsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLO1NBQ25CLEVBQUUsS0FBSyxDQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVELFFBQVEsQ0FBQyxFQUFVO1FBQ2xCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQzVCLEVBQUUsS0FBSyxFQUFFO2FBQ1IsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRU8sU0FBUyxDQUFDLEVBQVU7UUFDM0IsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxZQUFZLENBQUMsRUFBVSxFQUFFLE9BQWU7UUFDdkMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQUVELEtBQUssQ0FBQyxrQ0FBa0M7UUFDdkMsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFFRCxLQUFLLENBQUMsaUJBQWlCLENBQUMsWUFBb0IsRUFBRSxLQUFhO1FBQzFELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDekQsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ1YsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEtBQUssS0FBSyxDQUFDLENBQUM7UUFDeEQsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2IsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQywwQkFBMEIsRUFBRSxDQUFDO1lBQzlDLE9BQU8sT0FBTyxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNqRCxDQUFDO1FBRUQsTUFBTSxRQUFRLEdBQUcsTUFBTSxHQUFHLENBQUMsUUFBUSxDQUFDLDBCQUEwQixDQUFDLE1BQU0sRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMvRixPQUFPLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQzFFLENBQUM7SUFFRCw0REFBNEQ7SUFDckQsZ0NBQWdDLENBQUMsU0FBZ0MsRUFBRSxFQUFVLEVBQUUsUUFBNEM7UUFDakksTUFBTSxLQUFLLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztRQUVwQyxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsV0FBVyxFQUFFLDRCQUE0QixFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDN0YsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2YsTUFBTSxJQUFJLEtBQUssQ0FBQyx1SUFBdUksRUFBRSxXQUFXLENBQUMsQ0FBQztRQUN2SyxDQUFDO1FBRUQsTUFBTSxHQUFHLEdBQXdDO1lBQ2hELEVBQUUsRUFBRSwyQkFBMkIsQ0FBQyxTQUFTLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQztZQUN6RCxrQkFBa0IsRUFBRSxJQUFJO1lBQ3hCLEtBQUssRUFBRSxRQUFRLEVBQUUsS0FBSyxJQUFJLFNBQVMsQ0FBQyxXQUFXLElBQUksU0FBUyxDQUFDLElBQUk7WUFDakUsS0FBSyxnQ0FBd0I7WUFDN0IsZ0JBQWdCLEVBQUUsT0FBTyxRQUFRLENBQUMsMEJBQTBCLEtBQUssVUFBVTtZQUMzRSxXQUFXLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxLQUFLO1lBQ3ZDLFlBQVksRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLHlDQUFpQyxDQUFDLGlDQUF5QjtTQUNoSCxDQUFDO1FBRUYsTUFBTSxNQUFNLEdBQUcsS0FBSyxJQUFJLEVBQUU7WUFDekIsTUFBTSxJQUFJLEdBQUcsTUFBTSxRQUFRLENBQUMsMkJBQTJCLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDaEYsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksSUFBSSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUUxRSxNQUFNLE9BQU8sR0FBcUMsRUFBRSxDQUFDO1lBQ3JELEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxJQUFJLEVBQUUsRUFBRSxDQUFDO2dCQUMvQixJQUFJLEVBQUUsR0FBRyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO2dCQUM1RSxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUM7b0JBQ3BDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDVixPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDO3dCQUFDLENBQUMsRUFBRSxDQUFDO29CQUFDLENBQUM7b0JBQ25ELEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUNiLENBQUM7Z0JBRUQsb0JBQW9CLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUMzQyxJQUFLLElBQXdDLENBQUMsY0FBYyxFQUFFLENBQUM7b0JBQzlELHVCQUF1QixDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO2dCQUMxRCxDQUFDO2dCQUVELElBQUksY0FBbUQsQ0FBQztnQkFDeEQsTUFBTSxPQUFPLEdBQUcsSUFBMEQsQ0FBQztnQkFDM0UsSUFBSSxvQkFBb0IsQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsSUFBSSxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBQy9FLGNBQWMsR0FBRzt3QkFDaEIsWUFBWSxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsWUFBc0M7d0JBQ3JFLFlBQVksRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLFlBQVk7d0JBQzNDLFVBQVUsRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLFVBQWdDO3dCQUM3RCxLQUFLLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQzs0QkFDeEMsWUFBWSxFQUFFLENBQUMsQ0FBQyxZQUFZLEtBQUssbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUMsaURBQXlDLENBQUMsZ0RBQXdDOzRCQUNoSixVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQXNCO3lCQUNwQyxDQUFDLENBQUM7cUJBQ0gsQ0FBQztnQkFDSCxDQUFDO2dCQUVELE9BQU8sQ0FBQyxJQUFJLENBQUM7b0JBQ1osRUFBRTtvQkFDRixLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7b0JBQ2pCLFVBQVUsRUFBRSxJQUFJLENBQUMsT0FBTyxJQUFJLFFBQVE7b0JBQ3BDLGNBQWM7b0JBQ2QsTUFBTSxFQUFFLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO2lCQUM5QyxDQUFDLENBQUM7WUFDSixDQUFDO1lBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDaEQsQ0FBQyxDQUFDO1FBRUYsS0FBSyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFO1lBQzNCLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzFDLElBQUksQ0FBQyxNQUFNLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLFFBQVEsQ0FBQywrQkFBK0IsRUFBRSxDQUFDO1lBQzlDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLCtCQUErQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDN0QsQ0FBQztRQUNELDRDQUE0QztRQUM1QyxtREFBbUQ7UUFDbkQsSUFBSyxRQUFnQixDQUFDLDRCQUE0QixFQUFFLENBQUM7WUFDcEQsbURBQW1EO1lBQ25ELEtBQUssQ0FBQyxHQUFHLENBQUUsUUFBZ0IsQ0FBQyw0QkFBNEIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ25FLENBQUM7UUFDRCxtREFBbUQ7UUFDbkQsSUFBSyxRQUFnQixDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ25DLG1EQUFtRDtZQUNuRCxLQUFLLENBQUMsR0FBRyxDQUFFLFFBQWdCLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDbEQsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLElBQUksT0FBTyxDQUFPLE9BQU8sQ0FBQyxFQUFFO1lBQzNDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFO2dCQUN0QyxJQUFJLENBQUMsd0JBQXdCLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUM5QyxPQUFPLEVBQUUsQ0FBQztZQUNYLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ1IsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsd0JBQXdCLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTNDLE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztDQUNELENBQUE7QUE5S1ksaUJBQWlCO0lBVTNCLFdBQUEsa0JBQWtCLENBQUE7SUFDbEIsV0FBQSxXQUFXLENBQUE7SUFDWCxXQUFBLHVCQUF1QixDQUFBO0lBQ3ZCLFdBQUEsaUJBQWlCLENBQUE7SUFDakIsV0FBQSxnQ0FBZ0MsQ0FBQTtHQWR0QixpQkFBaUIsQ0E4SzdCOztBQUVELElBQVcsUUFJVjtBQUpELFdBQVcsUUFBUTtJQUNsQiw2Q0FBTyxDQUFBO0lBQ1AsdUNBQUksQ0FBQTtJQUNKLHFDQUFHLENBQUE7QUFDSixDQUFDLEVBSlUsUUFBUSxLQUFSLFFBQVEsUUFJbEI7QUFPRCxNQUFNLG9CQUFvQixHQUFHLENBQUMsQ0FBQztBQUMvQixNQUFNLHFCQUFxQixHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBRXhEOzs7Ozs7R0FNRztBQUNILE1BQU0sT0FBTyxhQUFjLFNBQVEsVUFBVTtJQWM1QyxZQUNrQixHQUFXLEVBQ1gsT0FBK0IsRUFDL0IsTUFBMEIsRUFDMUIsV0FBd0IsRUFDeEIsdUJBQWlDO1FBRWxELEtBQUssRUFBRSxDQUFDO1FBTlMsUUFBRyxHQUFILEdBQUcsQ0FBUTtRQUNYLFlBQU8sR0FBUCxPQUFPLENBQXdCO1FBQy9CLFdBQU0sR0FBTixNQUFNLENBQW9CO1FBQzFCLGdCQUFXLEdBQVgsV0FBVyxDQUFhO1FBQ3hCLDRCQUF1QixHQUF2Qix1QkFBdUIsQ0FBVTtRQWxCbEMsc0JBQWlCLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQztRQUNwQyxrQkFBYSxHQUFHLElBQUksZUFBZSxFQUFzRCxDQUFDO1FBQ25HLFVBQUssR0FBYyxFQUFFLEtBQUssMEJBQWtCLEVBQUUsQ0FBQztRQUN0QyxTQUFJLEdBQUcsSUFBSSx1QkFBdUIsRUFBRSxDQUFDO1FBQ3JDLGVBQVUsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBTzVDLGtCQUFhLEdBQUcsS0FBSyxDQUFDO1FBVzdCLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRTtZQUNoQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3hCLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3pCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDSixJQUFJLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRSxLQUFLLHlDQUFpQyxFQUFFLENBQUMsQ0FBQztJQUNyRixDQUFDO0lBRUQsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFlO1FBQ3pCLElBQUksQ0FBQztZQUNKLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLDZCQUFxQixFQUFFLENBQUM7Z0JBQzNDLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDL0QsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUMzQixDQUFDO1FBQ0YsQ0FBQztRQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7WUFDZCxNQUFNLEdBQUcsR0FBRyw0QkFBNEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEtBQUssTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDM0UsSUFBSSxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsS0FBSyx1Q0FBK0IsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztRQUNqRyxDQUFDO0lBQ0YsQ0FBQztJQUVELEtBQUssQ0FBQyxLQUFLO1FBQ1YsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssMEJBQWtCLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDdkYsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUM7WUFDMUIsSUFBSSxDQUFDO2dCQUNKLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ2hELENBQUM7WUFBQyxNQUFNLENBQUM7Z0JBQ1IsNEJBQTRCO1lBQzdCLENBQUM7UUFDRixDQUFDO1FBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsS0FBSyx5Q0FBaUMsRUFBRSxDQUFDLENBQUM7SUFDckYsQ0FBQztJQUVPLEtBQUssQ0FBQyxhQUFhLENBQUMsU0FBaUI7UUFDNUMsTUFBTSxPQUFPLEdBQTJCO1lBQ3ZDLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztZQUMzQyxnQkFBZ0IsRUFBRSxTQUFTO1NBQzNCLENBQUM7UUFFRixNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFbkMsMEVBQTBFO1FBQzFFLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FDaEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUMvQjtZQUNDLE1BQU0sRUFBRSxRQUFRO1lBQ2hCLE9BQU87U0FDUCxDQUNELENBQUM7SUFDSCxDQUFDO0lBRU8sS0FBSyxDQUFDLE9BQWU7UUFDNUIsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUsseUJBQWlCLEVBQUUsQ0FBQztZQUN2QyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDMUQsQ0FBQzthQUFNLENBQUM7WUFDUCxPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLDBCQUFrQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDakgsQ0FBQztJQUNGLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNLLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxPQUFlLEVBQUUsU0FBNkI7UUFDL0UsTUFBTSxPQUFPLEdBQUcsSUFBSSxXQUFXLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUE0QixDQUFDO1FBQzdFLE1BQU0sT0FBTyxHQUEyQjtZQUN2QyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7WUFDM0MsY0FBYyxFQUFFLGtCQUFrQjtZQUNsQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztZQUN4QyxNQUFNLEVBQUUscUNBQXFDO1NBQzdDLENBQUM7UUFDRixJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsU0FBUyxDQUFDO1FBQ3ZDLENBQUM7UUFDRCxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFbkMsTUFBTSxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQ3pDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFDL0I7WUFDQyxNQUFNLEVBQUUsTUFBTTtZQUNkLE9BQU87WUFDUCxJQUFJLEVBQUUsT0FBTztTQUNiLEVBQ0QsT0FBTyxDQUNQLENBQUM7UUFFRixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssNkJBQXFCLENBQUM7UUFFekQsNEVBQTRFO1FBQzVFLE1BQU0sYUFBYSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDeEQsSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUNuQixJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUUsS0FBSyx1QkFBZSxFQUFFLFNBQVMsRUFBRSxhQUFhLEVBQUUsQ0FBQztRQUNqRSxDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssNkJBQXFCO1lBQ3hDLDhCQUE4QjtZQUM5QixHQUFHLENBQUMsTUFBTSxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTSxHQUFHLEdBQUc7WUFDckMsNEJBQTRCO2VBQ3pCLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUMvQixDQUFDO1lBQ0YsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sOEJBQThCLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRywyQ0FBMkMsQ0FBQyxDQUFDO1lBQ2pJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN0QyxPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQztZQUN2Qix3TEFBd0w7WUFDeEwscUZBQXFGO1lBQ3JGLG9FQUFvRTtZQUNwRSxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSywwQkFBa0IsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDO1lBRXRJLElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtnQkFDdkMsS0FBSyx1Q0FBK0I7Z0JBQ3BDLE9BQU8sRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLDhCQUE4QixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsS0FBSyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUN2SyxXQUFXLEVBQUUsa0JBQWtCO2FBQy9CLENBQUMsQ0FBQztZQUNILE9BQU87UUFDUixDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssNkJBQXFCLEVBQUUsQ0FBQztZQUMzQyxJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUUsS0FBSyx1QkFBZSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsQ0FBQztRQUM3RCxDQUFDO1FBQ0QsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUNoQixJQUFJLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztRQUNyQyxDQUFDO1FBRUQsTUFBTSxJQUFJLENBQUMsK0JBQStCLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFTyxLQUFLLENBQUMsdUJBQXVCLENBQUMsT0FBZTtRQUNwRCxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUN6QyxJQUFJLFFBQVEsRUFBRSxDQUFDO1lBQ2QsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFLEtBQUssc0JBQWMsRUFBRSxRQUFRLEVBQUUsQ0FBQztZQUMvQyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzlDLENBQUM7SUFDRixDQUFDO0lBRU8sS0FBSyxDQUFDLHFCQUFxQixDQUFDLE1BQWMsRUFBRSxnQkFBZ0M7UUFDbkYsd0dBQXdHO1FBQ3hHLCtGQUErRjtRQUMvRixNQUFNLEVBQUUseUJBQXlCLEVBQUUsZUFBZSxFQUFFLHlCQUF5QixFQUFFLEdBQUcsSUFBSSxDQUFDLDJCQUEyQixDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDckksNEZBQTRGO1FBQzVGLElBQUksaUJBQXFDLENBQUM7UUFDMUMsSUFBSSxRQUE2RCxDQUFDO1FBQ2xFLElBQUksZUFBZSxHQUFHLHlCQUF5QixDQUFDO1FBQ2hELElBQUksQ0FBQztZQUNKLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxxQkFBcUIsQ0FBQyxNQUFNLEVBQUUseUJBQXlCLEVBQUU7Z0JBQ3ZGLGlCQUFpQixFQUFFO29CQUNsQixHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7b0JBQzNDLHNCQUFzQixFQUFFLEdBQUcsQ0FBQyx1QkFBdUI7aUJBQ25EO2dCQUNELEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQzthQUM1QyxDQUFDLENBQUM7WUFDSCw4REFBOEQ7WUFDOUQsNEVBQTRFO1lBQzVFLGlCQUFpQixHQUFHLGdCQUFnQixDQUFDLHFCQUFxQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDaEUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLG1DQUFtQyxpQkFBaUIsRUFBRSxDQUFDLENBQUM7WUFDbEYsZUFBZSxLQUFLLGdCQUFnQixDQUFDLGdCQUFnQixDQUFDO1lBQ3RELFFBQVEsR0FBRyxnQkFBZ0IsQ0FBQztRQUM3QixDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNaLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxzQ0FBc0MsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM5RSxDQUFDO1FBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDO1FBRXJELDhGQUE4RjtRQUM5RixtQkFBbUI7UUFDbkIsSUFBSSxpQkFBaUIsR0FBMkIsRUFBRSxDQUFDO1FBQ25ELElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQ3hCLGlCQUFpQixHQUFHLE9BQU8sQ0FBQztZQUM1Qiw4REFBOEQ7WUFDOUQsaUJBQWlCLEdBQUc7Z0JBQ25CLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztnQkFDM0Msc0JBQXNCLEVBQUUsR0FBRyxDQUFDLHVCQUF1QjthQUNuRCxDQUFDO1FBQ0gsQ0FBQztRQUNELElBQUksQ0FBQztZQUNKLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxzQ0FBc0MsaUJBQWlCLE1BQU0sQ0FBQyxDQUFDO1lBQ3pGLE1BQU0sc0JBQXNCLEdBQUcsTUFBTSxnQ0FBZ0MsQ0FBQyxpQkFBaUIsRUFBRTtnQkFDeEYsaUJBQWlCO2dCQUNqQixLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7YUFDNUMsQ0FBQyxDQUFDO1lBQ0gsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHlCQUF5QixDQUFDLENBQUM7WUFDcEQsSUFBSSxDQUFDLGFBQWEsR0FBRztnQkFDcEIsbUJBQW1CLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQztnQkFDakQsY0FBYyxFQUFFLHNCQUFzQjtnQkFDdEMsZ0JBQWdCLEVBQUUsUUFBUTtnQkFDMUIsTUFBTSxFQUFFLGVBQWU7YUFDdkIsQ0FBQztZQUNGLE9BQU87UUFDUixDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNaLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSw2Q0FBNkMsaUJBQWlCLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM3RyxDQUFDO1FBRUQsOEZBQThGO1FBQzlGLE1BQU0sZUFBZSxHQUFHLHdCQUF3QixDQUFDLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDbkUsSUFBSSxDQUFDLGFBQWEsR0FBRztZQUNwQixtQkFBbUIsRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQztZQUN2QyxjQUFjLEVBQUUsZUFBZTtZQUMvQixnQkFBZ0IsRUFBRSxRQUFRO1lBQzFCLE1BQU0sRUFBRSxlQUFlO1NBQ3ZCLENBQUM7UUFDRixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsNkJBQTZCLENBQUMsQ0FBQztJQUN6RCxDQUFDO0lBR08sS0FBSyxDQUFDLCtCQUErQixDQUFDLEdBQW1CLEVBQUUsT0FBZTtRQUNqRixJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUM7WUFDeEIsT0FBTyxDQUFDLFVBQVU7UUFDbkIsQ0FBQztRQUVELE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUN6RSxJQUFJLFdBQVcsQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDO1lBQ2pELE1BQU0sTUFBTSxHQUFHLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUNwQyxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFLENBQUM7b0JBQzlCLElBQUksQ0FBQyxNQUFNLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3hELENBQUM7cUJBQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLFVBQVUsRUFBRSxDQUFDO29CQUN0Qyx5RUFBeUU7b0JBQ3pFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSx3Q0FBd0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLGdDQUFnQyxDQUFDLENBQUM7b0JBQ3RILElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztvQkFDdEMsTUFBTSxJQUFJLGlCQUFpQixFQUFFLENBQUMsQ0FBQyw2QkFBNkI7Z0JBQzdELENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQztnQkFDSixNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ2hDLENBQUM7WUFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO2dCQUNkLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSw2QkFBNkIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUN6RSxDQUFDO1FBQ0YsQ0FBQzthQUFNLElBQUksV0FBVyxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLENBQUM7WUFDdkQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7UUFDOUQsQ0FBQzthQUFNLENBQUM7WUFDUCxNQUFNLFlBQVksR0FBRyxNQUFNLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUN0QyxJQUFJLE1BQU0sQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUMscUVBQXFFO2dCQUNoRyxJQUFJLENBQUMsTUFBTSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFDMUQsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxjQUFjLEdBQUcsQ0FBQyxNQUFNLDBCQUEwQixZQUFZLEVBQUUsQ0FBQyxDQUFDO1lBQy9GLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVEOzs7O09BSUc7SUFDSyxLQUFLLENBQUMsNEJBQTRCO1FBQ3pDLElBQUksV0FBK0IsQ0FBQztRQUNwQyxJQUFJLGNBQWtDLENBQUM7UUFDdkMsS0FBSyxJQUFJLEtBQUssR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDO1lBQ3RELElBQUksY0FBYyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUNsQyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDekUsY0FBYyxHQUFHLFNBQVMsQ0FBQztZQUM1QixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDaEUsQ0FBQztZQUVELElBQUksR0FBbUIsQ0FBQztZQUN4QixJQUFJLENBQUM7Z0JBQ0osTUFBTSxPQUFPLEdBQTJCO29CQUN2QyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7b0JBQzNDLFFBQVEsRUFBRSxtQkFBbUI7aUJBQzdCLENBQUM7Z0JBQ0YsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUVuQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSywwQkFBa0IsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsS0FBSyxTQUFTLEVBQUUsQ0FBQztvQkFDOUUsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUM7Z0JBQ2xELENBQUM7Z0JBQ0QsSUFBSSxXQUFXLEVBQUUsQ0FBQztvQkFDakIsT0FBTyxDQUFDLGVBQWUsQ0FBQyxHQUFHLFdBQVcsQ0FBQztnQkFDeEMsQ0FBQztnQkFFRCxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQ25DLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFDL0I7b0JBQ0MsTUFBTSxFQUFFLEtBQUs7b0JBQ2IsT0FBTztpQkFDUCxFQUNELE9BQU8sQ0FDUCxDQUFDO1lBQ0gsQ0FBQztZQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQ1osSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHVCQUF1QixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsc0NBQXNDLENBQUMsQ0FBQztnQkFDeEcsU0FBUztZQUNWLENBQUM7WUFFRCxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksR0FBRyxFQUFFLENBQUM7Z0JBQ3ZCLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLHlCQUF5QixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsb0RBQW9ELE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ25LLE9BQU87WUFDUixDQUFDO1lBRUQsNkVBQTZFO1lBQzdFLDJFQUEyRTtZQUMzRSxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xGLEtBQUssR0FBRyxDQUFDLENBQUM7WUFDWCxDQUFDO1lBRUQsTUFBTSxNQUFNLEdBQUcsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQ3BDLElBQUksS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUNqQixjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUM7Z0JBQzNDLENBQUM7Z0JBQ0QsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLFNBQVMsSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBQzVDLElBQUksQ0FBQyxNQUFNLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3hELENBQUM7Z0JBQ0QsSUFBSSxLQUFLLENBQUMsRUFBRSxFQUFFLENBQUM7b0JBQ2QsV0FBVyxHQUFHLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ3hCLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQztnQkFDSixNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ2hDLENBQUM7WUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUNaLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx1REFBdUQsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUN0RixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFRDs7O09BR0c7SUFDSyxLQUFLLENBQUMsVUFBVTtRQUN2QixNQUFNLFlBQVksR0FBRyxJQUFJLGVBQWUsRUFBVSxDQUFDO1FBQ25ELE1BQU0sT0FBTyxHQUEyQjtZQUN2QyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7WUFDM0MsUUFBUSxFQUFFLG1CQUFtQjtTQUM3QixDQUFDO1FBQ0YsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRW5DLElBQUksR0FBbUIsQ0FBQztRQUN4QixJQUFJLENBQUM7WUFDSixHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQ25DLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFDL0I7Z0JBQ0MsTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsT0FBTzthQUNQLEVBQ0QsT0FBTyxDQUNQLENBQUM7WUFDRixJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksR0FBRyxFQUFFLENBQUM7Z0JBQ3ZCLElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLEtBQUssdUNBQStCLEVBQUUsT0FBTyxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0seUJBQXlCLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxZQUFZLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDNUwsT0FBTztZQUNSLENBQUM7UUFDRixDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNaLElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLEtBQUssdUNBQStCLEVBQUUsT0FBTyxFQUFFLHVCQUF1QixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsWUFBWSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDbkosT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxJQUFJLFNBQVMsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUNwQyxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQzlCLElBQUksQ0FBQyxNQUFNLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDeEQsQ0FBQztpQkFBTSxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssVUFBVSxFQUFFLENBQUM7Z0JBQ3RDLFlBQVksQ0FBQyxRQUFRLENBQUMsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ3hGLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQ3BDLElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLEtBQUssdUNBQStCLEVBQUUsT0FBTyxFQUFFLDZCQUE2QixNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDeEksQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFDdkIsQ0FBQztJQUVEOzs7T0FHRztJQUNLLEtBQUssQ0FBQyxjQUFjLENBQUMsR0FBVyxFQUFFLE9BQWU7UUFDeEQsTUFBTSxPQUFPLEdBQUcsSUFBSSxXQUFXLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUE0QixDQUFDO1FBQzdFLE1BQU0sT0FBTyxHQUEyQjtZQUN2QyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7WUFDM0MsY0FBYyxFQUFFLGtCQUFrQjtZQUNsQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztTQUN4QyxDQUFDO1FBQ0YsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ25DLE1BQU0sR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUU7WUFDbEMsTUFBTSxFQUFFLE1BQU07WUFDZCxPQUFPO1lBQ1AsSUFBSSxFQUFFLE9BQU87U0FDYixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksR0FBRyxFQUFFLENBQUM7WUFDdkIsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sOEJBQThCLElBQUksQ0FBQyxhQUFhLEtBQUssTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM5SCxDQUFDO0lBQ0YsQ0FBQztJQUVELDREQUE0RDtJQUNwRCxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQWlCLEVBQUUsR0FBbUI7UUFDMUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNmLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUNwQyxJQUFJLEtBQTJDLENBQUM7UUFDaEQsR0FBRyxDQUFDO1lBQ0gsSUFBSSxDQUFDO2dCQUNKLEtBQUssR0FBRyxNQUFNLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3JFLENBQUM7WUFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO2dCQUNkLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDaEIsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDO29CQUM1QixPQUFPO2dCQUNSLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxNQUFNLEdBQUcsQ0FBQztnQkFDWCxDQUFDO1lBQ0YsQ0FBQztZQUVELElBQUksS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUNqQixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUMxQixDQUFDO1FBQ0YsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRTtJQUN2QixDQUFDO0lBRU8sS0FBSyxDQUFDLGNBQWMsQ0FBQyxPQUErQixFQUFFLG9CQUE4QjtRQUMzRixJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN4QixJQUFJLENBQUM7Z0JBQ0osTUFBTSxXQUFXLEdBQThCO29CQUM5QyxtQkFBbUIsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sRUFBRTtvQkFDcEUsMkJBQTJCLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjO29CQUM5RCxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQjtvQkFDckQsTUFBTSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTTtpQkFDakMsQ0FBQztnQkFDRixNQUFNLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsMkJBQTJCLENBQzFELElBQUksQ0FBQyxHQUFHLEVBQ1IsV0FBVyxFQUNYO29CQUNDLHNCQUFzQixFQUFFLElBQUksQ0FBQyx1QkFBdUI7b0JBQ3BELG9CQUFvQjtpQkFDcEIsQ0FBQyxDQUFDO2dCQUNKLElBQUksS0FBSyxFQUFFLENBQUM7b0JBQ1gsT0FBTyxDQUFDLGVBQWUsQ0FBQyxHQUFHLFVBQVUsS0FBSyxFQUFFLENBQUM7Z0JBQzlDLENBQUM7WUFDRixDQUFDO1lBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztnQkFDWixJQUFJLDRCQUE0QixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO29CQUN4QyxJQUFJLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRSxLQUFLLHlDQUFpQyxFQUFFLE1BQU0sRUFBRSx3QkFBd0IsRUFBRSxDQUFDLENBQUM7b0JBQ3RILE1BQU0sSUFBSSxpQkFBaUIsRUFBRSxDQUFDO2dCQUMvQixDQUFDO2dCQUNELElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSw2Q0FBNkMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUN2RixDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUNqQyxJQUFJLENBQUM7Z0JBQ0osSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLG9EQUFvRCxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxVQUFVLFlBQVksSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ2pMLE1BQU0sS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxzQkFBc0IsQ0FDckQsSUFBSSxDQUFDLEdBQUcsRUFDUixJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQ3RDLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFDbEM7b0JBQ0Msc0JBQXNCLEVBQUUsSUFBSSxDQUFDLHVCQUF1QjtvQkFDcEQsb0JBQW9CO2lCQUNwQixDQUNELENBQUM7Z0JBQ0YsSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDWCxPQUFPLENBQUMsZUFBZSxDQUFDLEdBQUcsVUFBVSxLQUFLLEVBQUUsQ0FBQztvQkFDN0MsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGlFQUFpRSxDQUFDLENBQUM7Z0JBQzdGLENBQUM7WUFDRixDQUFDO1lBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztnQkFDWixJQUFJLDRCQUE0QixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO29CQUN4QyxJQUFJLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRSxLQUFLLHlDQUFpQyxFQUFFLE1BQU0sRUFBRSx3QkFBd0IsRUFBRSxDQUFDLENBQUM7b0JBQ3RILE1BQU0sSUFBSSxpQkFBaUIsRUFBRSxDQUFDO2dCQUMvQixDQUFDO2dCQUNELElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSw0REFBNEQsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUN0RyxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sT0FBTyxDQUFDO0lBQ2hCLENBQUM7SUFFTyxJQUFJLENBQUMsS0FBZSxFQUFFLE9BQWU7UUFDNUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDN0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN4RCxDQUFDO0lBQ0YsQ0FBQztJQUVPLDJCQUEyQixDQUFDLFFBQXdCO1FBQzNELElBQUkseUJBQTZDLENBQUM7UUFDbEQsSUFBSSxlQUFxQyxDQUFDO1FBQzFDLElBQUksUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUFDO1lBQzlDLE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFFLENBQUM7WUFDN0QsTUFBTSxVQUFVLEdBQUcsMEJBQTBCLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDMUQsS0FBSyxNQUFNLFNBQVMsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDcEMsSUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLFFBQVEsRUFBRSxDQUFDO29CQUNuQyxJQUFJLENBQUMseUJBQXlCLElBQUksU0FBUyxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLENBQUM7d0JBQ3pFLHlCQUF5QixHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsQ0FBQzt3QkFDbEUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLGlFQUFpRSx5QkFBeUIsRUFBRSxDQUFDLENBQUM7b0JBQ3pILENBQUM7b0JBQ0QsSUFBSSxDQUFDLGVBQWUsSUFBSSxTQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7d0JBQ25ELE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLG9CQUFvQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDO3dCQUNsRyxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQzs0QkFDbkIsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLHFEQUFxRCxTQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQzs0QkFDNUcsZUFBZSxHQUFHLE1BQU0sQ0FBQzt3QkFDMUIsQ0FBQztvQkFDRixDQUFDO29CQUNELElBQUkseUJBQXlCLElBQUksZUFBZSxFQUFFLENBQUM7d0JBQ2xELE1BQU07b0JBQ1AsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLEVBQUUseUJBQXlCLEVBQUUsZUFBZSxFQUFFLENBQUM7SUFDdkQsQ0FBQztJQUVPLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBbUI7UUFDNUMsSUFBSSxDQUFDO1lBQ0osT0FBTyxNQUFNLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUN6QixDQUFDO1FBQUMsTUFBTSxDQUFDO1lBQ1IsT0FBTyxHQUFHLENBQUMsVUFBVSxDQUFDO1FBQ3ZCLENBQUM7SUFDRixDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSyxLQUFLLENBQUMsbUJBQW1CLENBQUMsTUFBYyxFQUFFLElBQXdCLEVBQUUsT0FBK0I7UUFDMUcsTUFBTSxPQUFPLEdBQUcsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFaEQsSUFBSSxHQUFHLEdBQUcsTUFBTSxPQUFPLEVBQUUsQ0FBQztRQUMxQixJQUFJLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7Z0JBQ3pCLE1BQU0sSUFBSSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDOUMsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNuQyxJQUFJLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDO29CQUM5Qix3Q0FBd0M7b0JBQ3hDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO29CQUN2QixHQUFHLEdBQUcsTUFBTSxPQUFPLEVBQUUsQ0FBQztnQkFDdkIsQ0FBQztZQUNGLENBQUM7aUJBQU0sQ0FBQztnQkFDUCw2RUFBNkU7Z0JBQzdFLE1BQU0sRUFBRSxlQUFlLEVBQUUsR0FBRyxJQUFJLENBQUMsMkJBQTJCLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ2xFLElBQUksQ0FBQyxXQUFXLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztvQkFDOUQsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLHVCQUF1QixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMseUJBQXlCLENBQUMsQ0FBQztvQkFDM0osSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEdBQUcsZUFBZSxDQUFDO29CQUM1QyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQ25DLElBQUksT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUM7d0JBQzlCLHdDQUF3Qzt3QkFDeEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7d0JBQ3ZCLEdBQUcsR0FBRyxNQUFNLE9BQU8sRUFBRSxDQUFDO29CQUN2QixDQUFDO2dCQUNGLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUNELCtHQUErRztRQUMvRyxJQUFJLE9BQU8sQ0FBQyxlQUFlLENBQUMsSUFBSSxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUM5RCxNQUFNLFNBQVMsR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDOUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLFlBQVksR0FBRyxDQUFDLE1BQU0sMEZBQTBGLFNBQVMsSUFBSSx1QkFBdUIsRUFBRSxDQUFDLENBQUM7WUFDbEwsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztZQUN6QyxHQUFHLEdBQUcsTUFBTSxPQUFPLEVBQUUsQ0FBQztRQUN2QixDQUFDO1FBQ0QsT0FBTyxHQUFHLENBQUM7SUFDWixDQUFDO0lBRU8sS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFXLEVBQUUsSUFBd0I7UUFDekQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsR0FBRyxHQUFHLE9BQU8sQ0FBQyxRQUFRLElBQUksT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBRXRFLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLEVBQUUsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDekQsTUFBTSxRQUFRLEdBQVEsRUFBRSxHQUFHLElBQUksRUFBRSxPQUFPLEVBQUUsRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDO1lBQ2hFLElBQUksUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNuQixRQUFRLENBQUMsSUFBSSxHQUFHLElBQUksV0FBVyxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN6RCxDQUFDO1lBQ0QsSUFBSSxRQUFRLENBQUMsT0FBTyxFQUFFLGFBQWEsRUFBRSxDQUFDO2dCQUNyQyxRQUFRLENBQUMsT0FBTyxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUMsQ0FBQyw0QkFBNEI7WUFDckUsQ0FBQztZQUNELElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxZQUFZLEdBQUcsa0JBQWtCLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3hGLENBQUM7UUFFRCxJQUFJLFVBQVUsR0FBRyxHQUFHLENBQUM7UUFDckIsSUFBSSxRQUF5QixDQUFDO1FBQzlCLEtBQUssSUFBSSxhQUFhLEdBQUcsQ0FBQyxFQUFFLGFBQWEsR0FBRyxvQkFBb0IsRUFBRSxhQUFhLEVBQUUsRUFBRSxDQUFDO1lBQ25GLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVSxFQUFFO2dCQUNoRCxHQUFHLElBQUk7Z0JBQ1AsTUFBTSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTTtnQkFDOUIsUUFBUSxFQUFFLFFBQVE7YUFDbEIsQ0FBQyxDQUFDO1lBRUgsNERBQTREO1lBQzVELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7Z0JBQ3RELE1BQU07WUFDUCxDQUFDO1lBRUQsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDbEQsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNmLE1BQU07WUFDUCxDQUFDO1lBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxhQUFhLFFBQVEsQ0FBQyxNQUFNLFVBQVUsVUFBVSxPQUFPLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDNUYsVUFBVSxHQUFHLE9BQU8sQ0FBQztZQUNyQixzR0FBc0c7WUFDdEcsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sS0FBSyxHQUFHLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLE1BQU0sQ0FBQyxFQUFFLENBQUM7Z0JBQ2pILElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO2dCQUNwQixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUM7WUFDbEIsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3pELE1BQU0sT0FBTyxHQUEyQixFQUFFLENBQUM7WUFDM0MsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLEVBQUUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDcEUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLFdBQVcsVUFBVSxLQUFLLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ2xFLE1BQU0sRUFBRSxRQUFRLENBQUMsTUFBTTtnQkFDdkIsT0FBTyxFQUFFLE9BQU87YUFDaEIsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNQLENBQUM7UUFFRCxPQUFPLFFBQVEsQ0FBQztJQUNqQixDQUFDO0lBRVMsY0FBYyxDQUFDLEdBQVcsRUFBRSxJQUF3QjtRQUM3RCxPQUFPLEtBQUssQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDekIsQ0FBQztDQUNEO0FBdUJELFNBQVMsTUFBTSxDQUFDLEdBQVc7SUFDMUIsSUFBSSxDQUFDO1FBQ0osSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNoQixPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQ1osT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0FBQ0YsQ0FBQztBQUVELFNBQVMsZ0JBQWdCLENBQUMsTUFBYztJQUN2QyxPQUFPLE1BQU0sS0FBSyxHQUFHLElBQUksTUFBTSxLQUFLLEdBQUcsQ0FBQztBQUN6QyxDQUFDIn0=