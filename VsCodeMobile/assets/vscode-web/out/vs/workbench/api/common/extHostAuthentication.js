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
import * as nls from '../../../nls.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { MainContext } from './extHost.protocol.js';
import { Disposable, ProgressLocation } from './extHostTypes.js';
import { ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
import { INTERNAL_AUTH_PROVIDER_PREFIX, isAuthenticationWwwAuthenticateRequest } from '../../services/authentication/common/authentication.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import { URI } from '../../../base/common/uri.js';
import { fetchDynamicRegistration, getClaimsFromJWT, isAuthorizationErrorResponse, isAuthorizationTokenResponse } from '../../../base/common/oauth.js';
import { IExtHostWindow } from './extHostWindow.js';
import { IExtHostInitDataService } from './extHostInitDataService.js';
import { ILoggerService, ILogService } from '../../../platform/log/common/log.js';
import { autorun, derivedOpts, observableValue } from '../../../base/common/observable.js';
import { stringHash } from '../../../base/common/hash.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { IExtHostUrlsService } from './extHostUrls.js';
import { encodeBase64, VSBuffer } from '../../../base/common/buffer.js';
import { equals as arraysEqual } from '../../../base/common/arrays.js';
import { IExtHostProgress } from './extHostProgress.js';
import { CancellationError, isCancellationError } from '../../../base/common/errors.js';
import { raceCancellationError, SequencerByKey } from '../../../base/common/async.js';
export const IExtHostAuthentication = createDecorator('IExtHostAuthentication');
let ExtHostAuthentication = class ExtHostAuthentication {
    constructor(extHostRpc, _initData, _extHostWindow, _extHostUrls, _extHostProgress, _extHostLoggerService, _logService) {
        this._initData = _initData;
        this._extHostWindow = _extHostWindow;
        this._extHostUrls = _extHostUrls;
        this._extHostProgress = _extHostProgress;
        this._extHostLoggerService = _extHostLoggerService;
        this._logService = _logService;
        this._dynamicAuthProviderCtor = DynamicAuthProvider;
        this._authenticationProviders = new Map();
        this._providerOperations = new SequencerByKey();
        this._onDidChangeSessions = new Emitter();
        this._getSessionTaskSingler = new TaskSingler();
        this._onDidDynamicAuthProviderTokensChange = new Emitter();
        this._proxy = extHostRpc.getProxy(MainContext.MainThreadAuthentication);
    }
    /**
     * This sets up an event that will fire when the auth sessions change with a built-in filter for the extensionId
     * if a session change only affects a specific extension.
     * @param extensionId The extension that is interested in the event.
     * @returns An event with a built-in filter for the extensionId
     */
    getExtensionScopedSessionsEvent(extensionId) {
        const normalizedExtensionId = extensionId.toLowerCase();
        return Event.chain(this._onDidChangeSessions.event, ($) => $
            .filter(e => !e.extensionIdFilter || e.extensionIdFilter.includes(normalizedExtensionId))
            .map(e => ({ provider: e.provider })));
    }
    async getSession(requestingExtension, providerId, scopesOrRequest, options = {}) {
        const extensionId = ExtensionIdentifier.toKey(requestingExtension.identifier);
        const keys = Object.keys(options);
        // TODO: pull this out into a utility function somewhere
        const optionsStr = keys
            .map(key => {
            switch (key) {
                case 'account':
                    return `${key}:${options.account?.id}`;
                case 'createIfNone':
                case 'forceNewSession': {
                    const value = typeof options[key] === 'boolean'
                        ? `${options[key]}`
                        : `'${options[key]?.detail}/${options[key]?.learnMore?.toString()}'`;
                    return `${key}:${value}`;
                }
                case 'authorizationServer':
                    return `${key}:${options.authorizationServer?.toString(true)}`;
                default:
                    return `${key}:${!!options[key]}`;
            }
        })
            .sort()
            .join(', ');
        let singlerKey;
        if (isAuthenticationWwwAuthenticateRequest(scopesOrRequest)) {
            const challenge = scopesOrRequest;
            const challengeStr = challenge.wwwAuthenticate;
            const scopesStr = challenge.fallbackScopes ? [...challenge.fallbackScopes].sort().join(' ') : '';
            singlerKey = `${extensionId} ${providerId} challenge:${challengeStr} ${scopesStr} ${optionsStr}`;
        }
        else {
            const sortedScopes = [...scopesOrRequest].sort().join(' ');
            singlerKey = `${extensionId} ${providerId} ${sortedScopes} ${optionsStr}`;
        }
        return await this._getSessionTaskSingler.getOrCreate(singlerKey, async () => {
            await this._proxy.$ensureProvider(providerId);
            const extensionName = requestingExtension.displayName || requestingExtension.name;
            return this._proxy.$getSession(providerId, scopesOrRequest, extensionId, extensionName, options);
        });
    }
    async getAccounts(providerId) {
        await this._proxy.$ensureProvider(providerId);
        return await this._proxy.$getAccounts(providerId);
    }
    registerAuthenticationProvider(id, label, provider, options) {
        // register
        void this._providerOperations.queue(id, async () => {
            // This use to be synchronous, but that wasn't an accurate representation because the main thread
            // may have unregistered the provider in the meantime. I don't see how this could really be done
            // synchronously, so we just say first one wins.
            if (this._authenticationProviders.get(id)) {
                this._logService.error(`An authentication provider with id '${id}' is already registered. The existing provider will not be replaced.`);
                return;
            }
            const listener = provider.onDidChangeSessions(e => this._proxy.$sendDidChangeSessions(id, e));
            this._authenticationProviders.set(id, { label, provider, disposable: listener, options: options ?? { supportsMultipleAccounts: false } });
            await this._proxy.$registerAuthenticationProvider({
                id,
                label,
                supportsMultipleAccounts: options?.supportsMultipleAccounts ?? false,
                supportedAuthorizationServers: options?.supportedAuthorizationServers,
                supportsChallenges: options?.supportsChallenges
            });
        });
        // unregister
        return new Disposable(() => {
            void this._providerOperations.queue(id, async () => {
                const providerData = this._authenticationProviders.get(id);
                if (providerData) {
                    providerData.disposable?.dispose();
                    this._authenticationProviders.delete(id);
                    await this._proxy.$unregisterAuthenticationProvider(id);
                }
            });
        });
    }
    $createSession(providerId, scopes, options) {
        return this._providerOperations.queue(providerId, async () => {
            const providerData = this._authenticationProviders.get(providerId);
            if (providerData) {
                options.authorizationServer = URI.revive(options.authorizationServer);
                return await providerData.provider.createSession(scopes, options);
            }
            throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
        });
    }
    $removeSession(providerId, sessionId) {
        return this._providerOperations.queue(providerId, async () => {
            const providerData = this._authenticationProviders.get(providerId);
            if (providerData) {
                return await providerData.provider.removeSession(sessionId);
            }
            throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
        });
    }
    $getSessions(providerId, scopes, options) {
        return this._providerOperations.queue(providerId, async () => {
            const providerData = this._authenticationProviders.get(providerId);
            if (providerData) {
                options.authorizationServer = URI.revive(options.authorizationServer);
                return await providerData.provider.getSessions(scopes, options);
            }
            throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
        });
    }
    $getSessionsFromChallenges(providerId, constraint, options) {
        return this._providerOperations.queue(providerId, async () => {
            const providerData = this._authenticationProviders.get(providerId);
            if (providerData) {
                const provider = providerData.provider;
                // Check if provider supports challenges
                if (typeof provider.getSessionsFromChallenges === 'function') {
                    options.authorizationServer = URI.revive(options.authorizationServer);
                    return await provider.getSessionsFromChallenges(constraint, options);
                }
                throw new Error(`Authentication provider with handle: ${providerId} does not support getSessionsFromChallenges`);
            }
            throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
        });
    }
    $createSessionFromChallenges(providerId, constraint, options) {
        return this._providerOperations.queue(providerId, async () => {
            const providerData = this._authenticationProviders.get(providerId);
            if (providerData) {
                const provider = providerData.provider;
                // Check if provider supports challenges
                if (typeof provider.createSessionFromChallenges === 'function') {
                    options.authorizationServer = URI.revive(options.authorizationServer);
                    return await provider.createSessionFromChallenges(constraint, options);
                }
                throw new Error(`Authentication provider with handle: ${providerId} does not support createSessionFromChallenges`);
            }
            throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
        });
    }
    $onDidChangeAuthenticationSessions(id, label, extensionIdFilter) {
        // Don't fire events for the internal auth providers
        if (!id.startsWith(INTERNAL_AUTH_PROVIDER_PREFIX)) {
            this._onDidChangeSessions.fire({ provider: { id, label }, extensionIdFilter });
        }
        return Promise.resolve();
    }
    $onDidUnregisterAuthenticationProvider(id) {
        return this._providerOperations.queue(id, async () => {
            const providerData = this._authenticationProviders.get(id);
            if (providerData) {
                providerData.disposable?.dispose();
                this._authenticationProviders.delete(id);
            }
        });
    }
    async $registerDynamicAuthProvider(authorizationServerComponents, serverMetadata, resourceMetadata, clientId, clientSecret, initialTokens) {
        if (!clientId) {
            const authorizationServer = URI.revive(authorizationServerComponents);
            if (serverMetadata.registration_endpoint) {
                try {
                    const registration = await fetchDynamicRegistration(serverMetadata, this._initData.environment.appName, resourceMetadata?.scopes_supported);
                    clientId = registration.client_id;
                    clientSecret = registration.client_secret;
                }
                catch (err) {
                    this._logService.warn(`Dynamic registration failed for ${authorizationServer.toString()}: ${err.message}. Prompting user for client ID and client secret...`);
                }
            }
            // Still no client id so dynamic client registration was either not supported or failed
            if (!clientId) {
                this._logService.info(`Prompting user for client registration details for ${authorizationServer.toString()}`);
                const clientDetails = await this._proxy.$promptForClientRegistration(authorizationServer.toString());
                if (!clientDetails) {
                    throw new Error('User did not provide client details');
                }
                clientId = clientDetails.clientId;
                clientSecret = clientDetails.clientSecret;
                this._logService.info(`User provided client registration for ${authorizationServer.toString()}`);
                if (clientSecret) {
                    this._logService.trace(`User provided client secret for ${authorizationServer.toString()}`);
                }
                else {
                    this._logService.trace(`User did not provide client secret for ${authorizationServer.toString()}`);
                }
            }
        }
        const provider = new this._dynamicAuthProviderCtor(this._extHostWindow, this._extHostUrls, this._initData, this._extHostProgress, this._extHostLoggerService, this._proxy, URI.revive(authorizationServerComponents), serverMetadata, resourceMetadata, clientId, clientSecret, this._onDidDynamicAuthProviderTokensChange, initialTokens || []);
        // Use the sequencer to ensure dynamic provider registration is serialized
        await this._providerOperations.queue(provider.id, async () => {
            this._authenticationProviders.set(provider.id, {
                label: provider.label,
                provider,
                disposable: Disposable.from(provider, provider.onDidChangeSessions(e => this._proxy.$sendDidChangeSessions(provider.id, e)), provider.onDidChangeClientId(() => this._proxy.$sendDidChangeDynamicProviderInfo({
                    providerId: provider.id,
                    clientId: provider.clientId,
                    clientSecret: provider.clientSecret
                }))),
                options: { supportsMultipleAccounts: true }
            });
            await this._proxy.$registerDynamicAuthenticationProvider({
                id: provider.id,
                label: provider.label,
                supportsMultipleAccounts: true,
                authorizationServer: authorizationServerComponents,
                resourceServer: resourceMetadata ? URI.parse(resourceMetadata.resource) : undefined,
                clientId: provider.clientId,
                clientSecret: provider.clientSecret
            });
        });
        return provider.id;
    }
    async $onDidChangeDynamicAuthProviderTokens(authProviderId, clientId, tokens) {
        this._onDidDynamicAuthProviderTokensChange.fire({ authProviderId, clientId, tokens });
    }
};
ExtHostAuthentication = __decorate([
    __param(0, IExtHostRpcService),
    __param(1, IExtHostInitDataService),
    __param(2, IExtHostWindow),
    __param(3, IExtHostUrlsService),
    __param(4, IExtHostProgress),
    __param(5, ILoggerService),
    __param(6, ILogService)
], ExtHostAuthentication);
export { ExtHostAuthentication };
class TaskSingler {
    constructor() {
        this._inFlightPromises = new Map();
    }
    getOrCreate(key, promiseFactory) {
        const inFlight = this._inFlightPromises.get(key);
        if (inFlight) {
            return inFlight;
        }
        const promise = promiseFactory().finally(() => this._inFlightPromises.delete(key));
        this._inFlightPromises.set(key, promise);
        return promise;
    }
}
let DynamicAuthProvider = class DynamicAuthProvider {
    constructor(_extHostWindow, _extHostUrls, _initData, _extHostProgress, loggerService, _proxy, authorizationServer, _serverMetadata, _resourceMetadata, _clientId, _clientSecret, onDidDynamicAuthProviderTokensChange, initialTokens) {
        this._extHostWindow = _extHostWindow;
        this._extHostUrls = _extHostUrls;
        this._initData = _initData;
        this._extHostProgress = _extHostProgress;
        this._proxy = _proxy;
        this.authorizationServer = authorizationServer;
        this._serverMetadata = _serverMetadata;
        this._resourceMetadata = _resourceMetadata;
        this._clientId = _clientId;
        this._clientSecret = _clientSecret;
        this._onDidChangeSessions = new Emitter();
        this.onDidChangeSessions = this._onDidChangeSessions.event;
        this._onDidChangeClientId = new Emitter();
        this.onDidChangeClientId = this._onDidChangeClientId.event;
        const stringifiedServer = authorizationServer.toString(true);
        // Auth Provider Id is a combination of the authorization server and the resource, if provided.
        this.id = _resourceMetadata?.resource
            ? stringifiedServer + ' ' + _resourceMetadata?.resource
            : stringifiedServer;
        // Auth Provider label is just the resource name if provided, otherwise the authority of the authorization server.
        this.label = _resourceMetadata?.resource_name ?? this.authorizationServer.authority;
        this._logger = loggerService.createLogger(this.id, { name: `Auth: ${this.label}` });
        this._disposable = new DisposableStore();
        this._disposable.add(this._onDidChangeSessions);
        const scopedEvent = Event.chain(onDidDynamicAuthProviderTokensChange.event, $ => $
            .filter(e => e.authProviderId === this.id && e.clientId === _clientId)
            .map(e => e.tokens));
        this._tokenStore = this._disposable.add(new TokenStore({
            onDidChange: scopedEvent,
            set: (tokens) => _proxy.$setSessionsForDynamicAuthProvider(this.id, this.clientId, tokens),
        }, initialTokens, this._logger));
        this._disposable.add(this._tokenStore.onDidChangeSessions(e => this._onDidChangeSessions.fire(e)));
        // Will be extended later to support other flows
        this._createFlows = [];
        if (_serverMetadata.authorization_endpoint) {
            this._createFlows.push({
                label: nls.localize('url handler', "URL Handler"),
                handler: (scopes, progress, token) => this._createWithUrlHandler(scopes, progress, token)
            });
        }
    }
    get clientId() {
        return this._clientId;
    }
    get clientSecret() {
        return this._clientSecret;
    }
    async getSessions(scopes, _options) {
        this._logger.info(`Getting sessions for scopes: ${scopes?.join(' ') ?? 'all'}`);
        if (!scopes) {
            return this._tokenStore.sessions;
        }
        // The oauth spec says tthat order doesn't matter so we sort the scopes for easy comparison
        // https://datatracker.ietf.org/doc/html/rfc6749#section-3.3
        // TODO@TylerLeonhardt: Do this for all scope handling in the auth APIs
        const sortedScopes = [...scopes].sort();
        const scopeStr = scopes.join(' ');
        let sessions = this._tokenStore.sessions.filter(session => arraysEqual([...session.scopes].sort(), sortedScopes));
        this._logger.info(`Found ${sessions.length} sessions for scopes: ${scopeStr}`);
        if (sessions.length) {
            const newTokens = [];
            const removedTokens = [];
            const tokenMap = new Map(this._tokenStore.tokens.map(token => [token.access_token, token]));
            for (const session of sessions) {
                const token = tokenMap.get(session.accessToken);
                if (token && token.expires_in) {
                    const now = Date.now();
                    const expiresInMS = token.expires_in * 1000;
                    // Check if the token is about to expire in 5 minutes or if it is expired
                    if (now > token.created_at + expiresInMS - (5 * 60 * 1000)) {
                        this._logger.info(`Token for session ${session.id} is about to expire, refreshing...`);
                        removedTokens.push(token);
                        if (!token.refresh_token) {
                            // No refresh token available, cannot refresh
                            this._logger.warn(`No refresh token available for scopes ${session.scopes.join(' ')}. Throwing away token.`);
                            continue;
                        }
                        try {
                            const newToken = await this.exchangeRefreshTokenForToken(token.refresh_token);
                            // TODO@TylerLeonhardt: When the core scope handling doesn't care about order, this check should be
                            // updated to not care about order
                            if (newToken.scope !== scopeStr) {
                                this._logger.warn(`Token scopes '${newToken.scope}' do not match requested scopes '${scopeStr}'. Overwriting token with what was requested...`);
                                newToken.scope = scopeStr;
                            }
                            this._logger.info(`Successfully created a new token for scopes ${session.scopes.join(' ')}.`);
                            newTokens.push(newToken);
                        }
                        catch (err) {
                            this._logger.error(`Failed to refresh token: ${err}`);
                        }
                    }
                }
            }
            if (newTokens.length || removedTokens.length) {
                this._tokenStore.update({ added: newTokens, removed: removedTokens });
                // Since we updated the tokens, we need to re-filter the sessions
                // to get the latest state
                sessions = this._tokenStore.sessions.filter(session => arraysEqual([...session.scopes].sort(), sortedScopes));
            }
            this._logger.info(`Found ${sessions.length} sessions for scopes: ${scopeStr}`);
            return sessions;
        }
        return [];
    }
    async createSession(scopes, _options) {
        this._logger.info(`Creating session for scopes: ${scopes.join(' ')}`);
        let token;
        for (let i = 0; i < this._createFlows.length; i++) {
            const { handler } = this._createFlows[i];
            try {
                token = await this._extHostProgress.withProgressFromSource({ label: this.label, id: this.id }, {
                    location: ProgressLocation.Notification,
                    title: nls.localize('authenticatingTo', "Authenticating to '{0}'", this.label),
                    cancellable: true
                }, (progress, token) => handler(scopes, progress, token));
                if (token) {
                    break;
                }
            }
            catch (err) {
                const nextMode = this._createFlows[i + 1]?.label;
                if (!nextMode) {
                    break; // No more flows to try
                }
                const message = isCancellationError(err)
                    ? nls.localize('userCanceledContinue', "Having trouble authenticating to '{0}'? Would you like to try a different way? ({1})", this.label, nextMode)
                    : nls.localize('continueWith', "You have not yet finished authenticating to '{0}'. Would you like to try a different way? ({1})", this.label, nextMode);
                const result = await this._proxy.$showContinueNotification(message);
                if (!result) {
                    throw new CancellationError();
                }
                this._logger.error(`Failed to create token via flow '${nextMode}': ${err}`);
            }
        }
        if (!token) {
            throw new Error('Failed to create authentication token');
        }
        if (token.scope !== scopes.join(' ')) {
            this._logger.warn(`Token scopes '${token.scope}' do not match requested scopes '${scopes.join(' ')}'. Overwriting token with what was requested...`);
            token.scope = scopes.join(' ');
        }
        // Store session for later retrieval
        this._tokenStore.update({ added: [{ ...token, created_at: Date.now() }], removed: [] });
        const session = this._tokenStore.sessions.find(t => t.accessToken === token.access_token);
        this._logger.info(`Created ${token.refresh_token ? 'refreshable' : 'non-refreshable'} session for scopes: ${token.scope}${token.expires_in ? ` that expires in ${token.expires_in} seconds` : ''}`);
        return session;
    }
    async removeSession(sessionId) {
        this._logger.info(`Removing session with id: ${sessionId}`);
        const session = this._tokenStore.sessions.find(session => session.id === sessionId);
        if (!session) {
            this._logger.error(`Session with id ${sessionId} not found`);
            return;
        }
        const token = this._tokenStore.tokens.find(token => token.access_token === session.accessToken);
        if (!token) {
            this._logger.error(`Failed to retrieve token for removed session: ${session.id}`);
            return;
        }
        this._tokenStore.update({ added: [], removed: [token] });
        this._logger.info(`Removed token for session: ${session.id} with scopes: ${session.scopes.join(' ')}`);
    }
    dispose() {
        this._disposable.dispose();
    }
    async _createWithUrlHandler(scopes, progress, token) {
        if (!this._serverMetadata.authorization_endpoint) {
            throw new Error('Authorization Endpoint required');
        }
        if (!this._serverMetadata.token_endpoint) {
            throw new Error('Token endpoint not available in server metadata');
        }
        // Generate PKCE code verifier (random string) and code challenge (SHA-256 hash of verifier)
        const codeVerifier = this.generateRandomString(64);
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);
        // Generate a random state value to prevent CSRF
        const nonce = this.generateRandomString(32);
        const callbackUri = URI.parse(`${this._initData.environment.appUriScheme}://dynamicauthprovider/${this.authorizationServer.authority}/authorize?nonce=${nonce}`);
        let state;
        try {
            state = await this._extHostUrls.createAppUri(callbackUri);
        }
        catch (error) {
            throw new Error(`Failed to create external URI: ${error}`);
        }
        // Prepare the authorization request URL
        const authorizationUrl = new URL(this._serverMetadata.authorization_endpoint);
        authorizationUrl.searchParams.append('client_id', this._clientId);
        authorizationUrl.searchParams.append('response_type', 'code');
        authorizationUrl.searchParams.append('state', state.toString());
        authorizationUrl.searchParams.append('code_challenge', codeChallenge);
        authorizationUrl.searchParams.append('code_challenge_method', 'S256');
        const scopeString = scopes.join(' ');
        if (scopeString) {
            // If non-empty scopes are provided, include scope parameter in the request
            authorizationUrl.searchParams.append('scope', scopeString);
        }
        if (this._resourceMetadata?.resource) {
            // If a resource is specified, include it in the request
            authorizationUrl.searchParams.append('resource', this._resourceMetadata.resource);
        }
        // Use a redirect URI that matches what was registered during dynamic registration
        const redirectUri = 'https://vscode.dev/redirect';
        authorizationUrl.searchParams.append('redirect_uri', redirectUri);
        const promise = this.waitForAuthorizationCode(callbackUri);
        // Open the browser for user authorization
        this._logger.info(`Opening authorization URL for scopes: ${scopeString}`);
        this._logger.trace(`Authorization URL: ${authorizationUrl.toString()}`);
        const opened = await this._extHostWindow.openUri(authorizationUrl.toString(), {});
        if (!opened) {
            throw new CancellationError();
        }
        progress.report({
            message: nls.localize('completeAuth', "Complete the authentication in the browser window that has opened."),
        });
        // Wait for the authorization code via a redirect
        let code;
        try {
            const response = await raceCancellationError(promise, token);
            code = response.code;
        }
        catch (err) {
            if (isCancellationError(err)) {
                this._logger.info('Authorization code request was cancelled by the user.');
                throw err;
            }
            this._logger.error(`Failed to receive authorization code: ${err}`);
            throw new Error(`Failed to receive authorization code: ${err}`);
        }
        this._logger.info(`Authorization code received for scopes: ${scopeString}`);
        // Exchange the authorization code for tokens
        const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier, redirectUri);
        return tokenResponse;
    }
    generateRandomString(length) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .substring(0, length);
    }
    async generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        // Base64url encode the digest
        return encodeBase64(VSBuffer.wrap(new Uint8Array(digest)), false, false)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }
    async waitForAuthorizationCode(expectedState) {
        const result = await this._proxy.$waitForUriHandler(expectedState);
        // Extract the code parameter directly from the query string. NOTE, URLSearchParams does not work here because
        // it will decode the query string and we need to keep it encoded.
        const codeMatch = /[?&]code=([^&]+)/.exec(result.query || '');
        if (!codeMatch || codeMatch.length < 2) {
            // No code parameter found in the query string
            throw new Error('Authentication failed: No authorization code received');
        }
        return { code: codeMatch[1] };
    }
    async exchangeCodeForToken(code, codeVerifier, redirectUri) {
        if (!this._serverMetadata.token_endpoint) {
            throw new Error('Token endpoint not available in server metadata');
        }
        const tokenRequest = new URLSearchParams();
        tokenRequest.append('client_id', this._clientId);
        tokenRequest.append('grant_type', 'authorization_code');
        tokenRequest.append('code', code);
        tokenRequest.append('redirect_uri', redirectUri);
        tokenRequest.append('code_verifier', codeVerifier);
        // Add resource indicator if available (RFC 8707)
        if (this._resourceMetadata?.resource) {
            tokenRequest.append('resource', this._resourceMetadata.resource);
        }
        // Add client secret if available
        if (this._clientSecret) {
            tokenRequest.append('client_secret', this._clientSecret);
        }
        this._logger.info('Exchanging authorization code for token...');
        this._logger.trace(`Url: ${this._serverMetadata.token_endpoint}`);
        this._logger.trace(`Token request body: ${tokenRequest.toString()}`);
        let response;
        try {
            response = await fetch(this._serverMetadata.token_endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: tokenRequest.toString()
            });
        }
        catch (err) {
            this._logger.error(`Failed to exchange authorization code for token: ${err}`);
            throw new Error(`Failed to exchange authorization code for token: ${err}`);
        }
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${text}`);
        }
        const result = await response.json();
        if (isAuthorizationTokenResponse(result)) {
            this._logger.info(`Successfully exchanged authorization code for token.`);
            return result;
        }
        else if (isAuthorizationErrorResponse(result) && result.error === "invalid_client" /* AuthorizationErrorType.InvalidClient */) {
            this._logger.warn(`Client ID (${this._clientId}) was invalid, generated a new one.`);
            await this._generateNewClientId();
            throw new Error(`Client ID was invalid, generated a new one. Please try again.`);
        }
        throw new Error(`Invalid authorization token response: ${JSON.stringify(result)}`);
    }
    async exchangeRefreshTokenForToken(refreshToken) {
        if (!this._serverMetadata.token_endpoint) {
            throw new Error('Token endpoint not available in server metadata');
        }
        const tokenRequest = new URLSearchParams();
        tokenRequest.append('client_id', this._clientId);
        tokenRequest.append('grant_type', 'refresh_token');
        tokenRequest.append('refresh_token', refreshToken);
        // Add resource indicator if available (RFC 8707)
        if (this._resourceMetadata?.resource) {
            tokenRequest.append('resource', this._resourceMetadata.resource);
        }
        // Add client secret if available
        if (this._clientSecret) {
            tokenRequest.append('client_secret', this._clientSecret);
        }
        const response = await fetch(this._serverMetadata.token_endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: tokenRequest.toString()
        });
        const result = await response.json();
        if (isAuthorizationTokenResponse(result)) {
            return {
                ...result,
                created_at: Date.now(),
            };
        }
        else if (isAuthorizationErrorResponse(result) && result.error === "invalid_client" /* AuthorizationErrorType.InvalidClient */) {
            this._logger.warn(`Client ID (${this._clientId}) was invalid, generated a new one.`);
            await this._generateNewClientId();
            throw new Error(`Client ID was invalid, generated a new one. Please try again.`);
        }
        throw new Error(`Invalid authorization token response: ${JSON.stringify(result)}`);
    }
    async _generateNewClientId() {
        try {
            const registration = await fetchDynamicRegistration(this._serverMetadata, this._initData.environment.appName, this._resourceMetadata?.scopes_supported);
            this._clientId = registration.client_id;
            this._clientSecret = registration.client_secret;
            this._onDidChangeClientId.fire();
        }
        catch (err) {
            // When DCR fails, try to prompt the user for a client ID and client secret
            this._logger.info(`Dynamic registration failed for ${this.authorizationServer.toString()}: ${err}. Prompting user for client ID and client secret.`);
            try {
                const clientDetails = await this._proxy.$promptForClientRegistration(this.authorizationServer.toString());
                if (!clientDetails) {
                    throw new Error('User did not provide client details');
                }
                this._clientId = clientDetails.clientId;
                this._clientSecret = clientDetails.clientSecret;
                this._logger.info(`User provided client ID for ${this.authorizationServer.toString()}`);
                if (clientDetails.clientSecret) {
                    this._logger.info(`User provided client secret for ${this.authorizationServer.toString()}`);
                }
                else {
                    this._logger.info(`User did not provide client secret for ${this.authorizationServer.toString()} (optional)`);
                }
                this._onDidChangeClientId.fire();
            }
            catch (promptErr) {
                this._logger.error(`Failed to fetch new client ID and user did not provide one: ${err}`);
                throw new Error(`Failed to fetch new client ID and user did not provide one: ${err}`);
            }
        }
    }
};
DynamicAuthProvider = __decorate([
    __param(0, IExtHostWindow),
    __param(1, IExtHostUrlsService),
    __param(2, IExtHostInitDataService),
    __param(3, IExtHostProgress),
    __param(4, ILoggerService)
], DynamicAuthProvider);
export { DynamicAuthProvider };
class TokenStore {
    constructor(_persistence, initialTokens, _logger) {
        this._persistence = _persistence;
        this._logger = _logger;
        this._onDidChangeSessions = new Emitter();
        this.onDidChangeSessions = this._onDidChangeSessions.event;
        this._disposable = new DisposableStore();
        this._tokensObservable = observableValue('tokens', initialTokens);
        this._sessionsObservable = derivedOpts({ equalsFn: (a, b) => arraysEqual(a, b, (a, b) => a.accessToken === b.accessToken) }, (reader) => this._tokensObservable.read(reader).map(t => this._getSessionFromToken(t)));
        this._disposable.add(this._registerChangeEventAutorun());
        this._disposable.add(this._persistence.onDidChange((tokens) => this._tokensObservable.set(tokens, undefined)));
    }
    get tokens() {
        return this._tokensObservable.get();
    }
    get sessions() {
        return this._sessionsObservable.get();
    }
    dispose() {
        this._disposable.dispose();
    }
    update({ added, removed }) {
        this._logger.trace(`Updating tokens: added ${added.length}, removed ${removed.length}`);
        const currentTokens = [...this._tokensObservable.get()];
        for (const token of removed) {
            const index = currentTokens.findIndex(t => t.access_token === token.access_token);
            if (index !== -1) {
                currentTokens.splice(index, 1);
            }
        }
        for (const token of added) {
            const index = currentTokens.findIndex(t => t.access_token === token.access_token);
            if (index === -1) {
                currentTokens.push(token);
            }
            else {
                currentTokens[index] = token;
            }
        }
        if (added.length || removed.length) {
            this._tokensObservable.set(currentTokens, undefined);
            void this._persistence.set(currentTokens);
        }
        this._logger.trace(`Tokens updated: ${currentTokens.length} tokens stored.`);
    }
    _registerChangeEventAutorun() {
        let previousSessions = [];
        return autorun((reader) => {
            this._logger.trace('Checking for session changes...');
            const currentSessions = this._sessionsObservable.read(reader);
            if (previousSessions === currentSessions) {
                this._logger.trace('No session changes detected.');
                return;
            }
            if (!currentSessions || currentSessions.length === 0) {
                // If currentSessions is undefined, all previous sessions are considered removed
                this._logger.trace('All sessions removed.');
                if (previousSessions.length > 0) {
                    this._onDidChangeSessions.fire({
                        added: [],
                        removed: previousSessions,
                        changed: []
                    });
                    previousSessions = [];
                }
                return;
            }
            const added = [];
            const removed = [];
            // Find added sessions
            for (const current of currentSessions) {
                const exists = previousSessions.some(prev => prev.accessToken === current.accessToken);
                if (!exists) {
                    added.push(current);
                }
            }
            // Find removed sessions
            for (const prev of previousSessions) {
                const exists = currentSessions.some(current => current.accessToken === prev.accessToken);
                if (!exists) {
                    removed.push(prev);
                }
            }
            // Fire the event if there are any changes
            if (added.length > 0 || removed.length > 0) {
                this._logger.trace(`Sessions changed: added ${added.length}, removed ${removed.length}`);
                this._onDidChangeSessions.fire({ added, removed, changed: [] });
            }
            // Update previous sessions reference
            previousSessions = currentSessions;
        });
    }
    _getSessionFromToken(token) {
        let claims;
        if (token.id_token) {
            try {
                claims = getClaimsFromJWT(token.id_token);
            }
            catch (e) {
                // log
            }
        }
        if (!claims) {
            try {
                claims = getClaimsFromJWT(token.access_token);
            }
            catch (e) {
                // log
            }
        }
        const scopes = token.scope
            ? token.scope.split(' ')
            : claims?.scope
                ? claims.scope.split(' ')
                : [];
        return {
            id: stringHash(token.access_token, 0).toString(),
            accessToken: token.access_token,
            account: {
                id: claims?.sub || 'unknown',
                // TODO: Don't say MCP...
                label: claims?.preferred_username || claims?.name || claims?.email || 'MCP',
            },
            scopes: scopes,
            idToken: token.id_token
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdEF1dGhlbnRpY2F0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvY29tbW9uL2V4dEhvc3RBdXRoZW50aWNhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEtBQUssR0FBRyxNQUFNLGlCQUFpQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFdBQVcsRUFBNkQsTUFBTSx1QkFBdUIsQ0FBQztBQUMvRyxPQUFPLEVBQUUsVUFBVSxFQUFFLGdCQUFnQixFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDakUsT0FBTyxFQUF5QixtQkFBbUIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQy9HLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxzQ0FBc0MsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQy9JLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUM1RCxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLDZCQUE2QixDQUFDO0FBQ2pFLE9BQU8sRUFBMEIsd0JBQXdCLEVBQUUsZ0JBQWdCLEVBQStILDRCQUE0QixFQUFFLDRCQUE0QixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDNVMsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3BELE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3RFLE9BQU8sRUFBVyxjQUFjLEVBQUUsV0FBVyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDM0YsT0FBTyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQW9DLGVBQWUsRUFBRSxN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