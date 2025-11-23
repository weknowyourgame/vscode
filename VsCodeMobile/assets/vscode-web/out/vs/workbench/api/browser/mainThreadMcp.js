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
import { mapFindFirst } from '../../../base/common/arraysFind.js';
import { disposableTimeout } from '../../../base/common/async.js';
import { CancellationError } from '../../../base/common/errors.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable, DisposableMap, DisposableStore, MutableDisposable } from '../../../base/common/lifecycle.js';
import { observableValue } from '../../../base/common/observable.js';
import Severity from '../../../base/common/severity.js';
import { URI } from '../../../base/common/uri.js';
import * as nls from '../../../nls.js';
import { ContextKeyExpr, IContextKeyService } from '../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../platform/dialogs/common/dialogs.js';
import { ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
import { LogLevel } from '../../../platform/log/common/log.js';
import { IMcpRegistry } from '../../contrib/mcp/common/mcpRegistryTypes.js';
import { extensionPrefixedIdentifier, McpConnectionState, McpServerDefinition, McpServerLaunch, UserInteractionRequiredError } from '../../contrib/mcp/common/mcpTypes.js';
import { IAuthenticationMcpAccessService } from '../../services/authentication/browser/authenticationMcpAccessService.js';
import { IAuthenticationMcpService } from '../../services/authentication/browser/authenticationMcpService.js';
import { IAuthenticationMcpUsageService } from '../../services/authentication/browser/authenticationMcpUsageService.js';
import { IAuthenticationService } from '../../services/authentication/common/authentication.js';
import { IDynamicAuthenticationProviderStorageService } from '../../services/authentication/common/dynamicAuthenticationProviderStorage.js';
import { extensionHostKindToString } from '../../services/extensions/common/extensionHostKind.js';
import { IExtensionService } from '../../services/extensions/common/extensions.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
let MainThreadMcp = class MainThreadMcp extends Disposable {
    constructor(_extHostContext, _mcpRegistry, dialogService, _authenticationService, authenticationMcpServersService, authenticationMCPServerAccessService, authenticationMCPServerUsageService, _dynamicAuthenticationProviderStorageService, _extensionService, _contextKeyService) {
        super();
        this._extHostContext = _extHostContext;
        this._mcpRegistry = _mcpRegistry;
        this.dialogService = dialogService;
        this._authenticationService = _authenticationService;
        this.authenticationMcpServersService = authenticationMcpServersService;
        this.authenticationMCPServerAccessService = authenticationMCPServerAccessService;
        this.authenticationMCPServerUsageService = authenticationMCPServerUsageService;
        this._dynamicAuthenticationProviderStorageService = _dynamicAuthenticationProviderStorageService;
        this._extensionService = _extensionService;
        this._contextKeyService = _contextKeyService;
        this._serverIdCounter = 0;
        this._servers = new Map();
        this._serverDefinitions = new Map();
        this._serverAuthTracking = new McpServerAuthTracker();
        this._collectionDefinitions = this._register(new DisposableMap());
        this._register(_authenticationService.onDidChangeSessions(e => this._onDidChangeAuthSessions(e.providerId, e.label)));
        const proxy = this._proxy = _extHostContext.getProxy(ExtHostContext.ExtHostMcp);
        this._register(this._mcpRegistry.registerDelegate({
            // Prefer Node.js extension hosts when they're available. No CORS issues etc.
            priority: _extHostContext.extensionHostKind === 2 /* ExtensionHostKind.LocalWebWorker */ ? 0 : 1,
            waitForInitialProviderPromises() {
                return proxy.$waitForInitialCollectionProviders();
            },
            canStart(collection, serverDefinition) {
                if (collection.remoteAuthority !== _extHostContext.remoteAuthority) {
                    return false;
                }
                if (serverDefinition.launch.type === 1 /* McpServerTransportType.Stdio */ && _extHostContext.extensionHostKind === 2 /* ExtensionHostKind.LocalWebWorker */) {
                    return false;
                }
                return true;
            },
            async substituteVariables(serverDefinition, launch) {
                const ser = await proxy.$substituteVariables(serverDefinition.variableReplacement?.folder?.uri, McpServerLaunch.toSerialized(launch));
                return McpServerLaunch.fromSerialized(ser);
            },
            start: (_collection, serverDefiniton, resolveLaunch, options) => {
                const id = ++this._serverIdCounter;
                const launch = new ExtHostMcpServerLaunch(_extHostContext.extensionHostKind, () => proxy.$stopMcp(id), msg => proxy.$sendMessage(id, JSON.stringify(msg)));
                this._servers.set(id, launch);
                this._serverDefinitions.set(id, serverDefiniton);
                proxy.$startMcp(id, {
                    launch: resolveLaunch,
                    defaultCwd: serverDefiniton.variableReplacement?.folder?.uri,
                    errorOnUserInteraction: options?.errorOnUserInteraction,
                });
                return launch;
            },
        }));
    }
    $upsertMcpCollection(collection, serversDto) {
        const servers = serversDto.map(McpServerDefinition.fromSerialized);
        const existing = this._collectionDefinitions.get(collection.id);
        if (existing) {
            existing.servers.set(servers, undefined);
        }
        else {
            const serverDefinitions = observableValue('mcpServers', servers);
            const extensionId = new ExtensionIdentifier(collection.extensionId);
            const store = new DisposableStore();
            const handle = store.add(new MutableDisposable());
            const register = () => {
                handle.value ??= this._mcpRegistry.registerCollection({
                    ...collection,
                    source: extensionId,
                    resolveServerLanch: collection.canResolveLaunch ? (async (def) => {
                        const r = await this._proxy.$resolveMcpLaunch(collection.id, def.label);
                        return r ? McpServerLaunch.fromSerialized(r) : undefined;
                    }) : undefined,
                    trustBehavior: collection.isTrustedByDefault ? 0 /* McpServerTrust.Kind.Trusted */ : 1 /* McpServerTrust.Kind.TrustedOnNonce */,
                    remoteAuthority: this._extHostContext.remoteAuthority,
                    serverDefinitions,
                });
            };
            const whenClauseStr = mapFindFirst(this._extensionService.extensions, e => ExtensionIdentifier.equals(extensionId, e.identifier)
                ? e.contributes?.mcpServerDefinitionProviders?.find(p => extensionPrefixedIdentifier(extensionId, p.id) === collection.id)?.when
                : undefined);
            const whenClause = whenClauseStr && ContextKeyExpr.deserialize(whenClauseStr);
            if (!whenClause) {
                register();
            }
            else {
                const evaluate = () => {
                    if (this._contextKeyService.contextMatchesRules(whenClause)) {
                        register();
                    }
                    else {
                        handle.clear();
                    }
                };
                store.add(this._contextKeyService.onDidChangeContext(evaluate));
                evaluate();
            }
            this._collectionDefinitions.set(collection.id, {
                servers: serverDefinitions,
                dispose: () => store.dispose(),
            });
        }
    }
    $deleteMcpCollection(collectionId) {
        this._collectionDefinitions.deleteAndDispose(collectionId);
    }
    $onDidChangeState(id, update) {
        const server = this._servers.get(id);
        if (!server) {
            return;
        }
        server.state.set(update, undefined);
        if (!McpConnectionState.isRunning(update)) {
            server.dispose();
            this._servers.delete(id);
            this._serverDefinitions.delete(id);
            this._serverAuthTracking.untrack(id);
        }
    }
    $onDidPublishLog(id, level, log) {
        if (typeof level === 'string') {
            level = LogLevel.Info;
            log = level;
        }
        this._servers.get(id)?.pushLog(level, log);
    }
    $onDidReceiveMessage(id, message) {
        this._servers.get(id)?.pushMessage(message);
    }
    async $getTokenForProviderId(id, providerId, scopes, options = {}) {
        const server = this._serverDefinitions.get(id);
        if (!server) {
            return undefined;
        }
        return this._getSessionForProvider(id, server, providerId, scopes, undefined, options.errorOnUserInteraction);
    }
    async $getTokenFromServerMetadata(id, authDetails, { errorOnUserInteraction, forceNewRegistration } = {}) {
        const server = this._serverDefinitions.get(id);
        if (!server) {
            return undefined;
        }
        const authorizationServer = URI.revive(authDetails.authorizationServer);
        const resourceServer = authDetails.resourceMetadata?.resource ? URI.parse(authDetails.resourceMetadata.resource) : undefined;
        const resolvedScopes = authDetails.scopes ?? authDetails.resourceMetadata?.scopes_supported ?? authDetails.authorizationServerMetadata.scopes_supported ?? [];
        let providerId = await this._authenticationService.getOrActivateProviderIdForServer(authorizationServer, resourceServer);
        if (forceNewRegistration && providerId) {
            if (!this._authenticationService.isDynamicAuthenticationProvider(providerId)) {
                throw new Error('Cannot force new registration for a non-dynamic authentication provider.');
            }
            this._authenticationService.unregisterAuthenticationProvider(providerId);
            // TODO: Encapsulate this and the unregister in one call in the auth service
            await this._dynamicAuthenticationProviderStorageService.removeDynamicProvider(providerId);
            providerId = undefined;
        }
        if (!providerId) {
            const provider = await this._authenticationService.createDynamicAuthenticationProvider(authorizationServer, authDetails.authorizationServerMetadata, authDetails.resourceMetadata);
            if (!provider) {
                return undefined;
            }
            providerId = provider.id;
        }
        return this._getSessionForProvider(id, server, providerId, resolvedScopes, authorizationServer, errorOnUserInteraction);
    }
    async _getSessionForProvider(serverId, server, providerId, scopes, authorizationServer, errorOnUserInteraction = false) {
        const sessions = await this._authenticationService.getSessions(providerId, scopes, { authorizationServer }, true);
        const accountNamePreference = this.authenticationMcpServersService.getAccountPreference(server.id, providerId);
        let matchingAccountPreferenceSession;
        if (accountNamePreference) {
            matchingAccountPreferenceSession = sessions.find(session => session.account.label === accountNamePreference);
        }
        const provider = this._authenticationService.getProvider(providerId);
        let session;
        if (sessions.length) {
            // If we have an existing session preference, use that. If not, we'll return any valid session at the end of this function.
            if (matchingAccountPreferenceSession && this.authenticationMCPServerAccessService.isAccessAllowed(providerId, matchingAccountPreferenceSession.account.label, server.id)) {
                this.authenticationMCPServerUsageService.addAccountUsage(providerId, matchingAccountPreferenceSession.account.label, scopes, server.id, server.label);
                this._serverAuthTracking.track(providerId, serverId, scopes);
                return matchingAccountPreferenceSession.accessToken;
            }
            // If we only have one account for a single auth provider, lets just check if it's allowed and return it if it is.
            if (!provider.supportsMultipleAccounts && this.authenticationMCPServerAccessService.isAccessAllowed(providerId, sessions[0].account.label, server.id)) {
                this.authenticationMCPServerUsageService.addAccountUsage(providerId, sessions[0].account.label, scopes, server.id, server.label);
                this._serverAuthTracking.track(providerId, serverId, scopes);
                return sessions[0].accessToken;
            }
        }
        if (errorOnUserInteraction) {
            throw new UserInteractionRequiredError('authentication');
        }
        const isAllowed = await this.loginPrompt(server.label, provider.label, false);
        if (!isAllowed) {
            throw new Error('User did not consent to login.');
        }
        if (sessions.length) {
            if (provider.supportsMultipleAccounts && errorOnUserInteraction) {
                throw new UserInteractionRequiredError('authentication');
            }
            session = provider.supportsMultipleAccounts
                ? await this.authenticationMcpServersService.selectSession(providerId, server.id, server.label, scopes, sessions)
                : sessions[0];
        }
        else {
            if (errorOnUserInteraction) {
                throw new UserInteractionRequiredError('authentication');
            }
            const accountToCreate = matchingAccountPreferenceSession?.account;
            do {
                session = await this._authenticationService.createSession(providerId, scopes, {
                    activateImmediate: true,
                    account: accountToCreate,
                    authorizationServer
                });
            } while (accountToCreate
                && accountToCreate.label !== session.account.label
                && !await this.continueWithIncorrectAccountPrompt(session.account.label, accountToCreate.label));
        }
        this.authenticationMCPServerAccessService.updateAllowedMcpServers(providerId, session.account.label, [{ id: server.id, name: server.label, allowed: true }]);
        this.authenticationMcpServersService.updateAccountPreference(server.id, providerId, session.account);
        this.authenticationMCPServerUsageService.addAccountUsage(providerId, session.account.label, scopes, server.id, server.label);
        this._serverAuthTracking.track(providerId, serverId, scopes);
        return session.accessToken;
    }
    async continueWithIncorrectAccountPrompt(chosenAccountLabel, requestedAccountLabel) {
        const result = await this.dialogService.prompt({
            message: nls.localize('incorrectAccount', "Incorrect account detected"),
            detail: nls.localize('incorrectAccountDetail', "The chosen account, {0}, does not match the requested account, {1}.", chosenAccountLabel, requestedAccountLabel),
            type: Severity.Warning,
            cancelButton: true,
            buttons: [
                {
                    label: nls.localize('keep', 'Keep {0}', chosenAccountLabel),
                    run: () => chosenAccountLabel
                },
                {
                    label: nls.localize('loginWith', 'Login with {0}', requestedAccountLabel),
                    run: () => requestedAccountLabel
                }
            ],
        });
        if (!result.result) {
            throw new CancellationError();
        }
        return result.result === chosenAccountLabel;
    }
    async _onDidChangeAuthSessions(providerId, providerLabel) {
        const serversUsingProvider = this._serverAuthTracking.get(providerId);
        if (!serversUsingProvider) {
            return;
        }
        for (const { serverId, scopes } of serversUsingProvider) {
            const server = this._servers.get(serverId);
            const serverDefinition = this._serverDefinitions.get(serverId);
            if (!server || !serverDefinition) {
                continue;
            }
            // Only validate servers that are running
            const state = server.state.get();
            if (state.state !== 2 /* McpConnectionState.Kind.Running */) {
                continue;
            }
            // Validate if the session is still available
            try {
                await this._getSessionForProvider(serverId, serverDefinition, providerId, scopes, undefined, true);
            }
            catch (e) {
                if (UserInteractionRequiredError.is(e)) {
                    // Session is no longer valid, stop the server
                    server.pushLog(LogLevel.Warning, nls.localize('mcpAuthSessionRemoved', "Authentication session for {0} removed, stopping server", providerLabel));
                    server.stop();
                }
                // Ignore other errors to avoid disrupting other servers
            }
        }
    }
    async loginPrompt(mcpLabel, providerLabel, recreatingSession) {
        const message = recreatingSession
            ? nls.localize('confirmRelogin', "The MCP Server Definition '{0}' wants you to authenticate to {1}.", mcpLabel, providerLabel)
            : nls.localize('confirmLogin', "The MCP Server Definition '{0}' wants to authenticate to {1}.", mcpLabel, providerLabel);
        const buttons = [
            {
                label: nls.localize({ key: 'allow', comment: ['&& denotes a mnemonic'] }, "&&Allow"),
                run() {
                    return true;
                },
            }
        ];
        const { result } = await this.dialogService.prompt({
            type: Severity.Info,
            message,
            buttons,
            cancelButton: true,
        });
        return result ?? false;
    }
    dispose() {
        for (const server of this._servers.values()) {
            server.extHostDispose();
        }
        this._servers.clear();
        this._serverDefinitions.clear();
        this._serverAuthTracking.clear();
        super.dispose();
    }
};
MainThreadMcp = __decorate([
    extHostNamedCustomer(MainContext.MainThreadMcp),
    __param(1, IMcpRegistry),
    __param(2, IDialogService),
    __param(3, IAuthenticationService),
    __param(4, IAuthenticationMcpService),
    __param(5, IAuthenticationMcpAccessService),
    __param(6, IAuthenticationMcpUsageService),
    __param(7, IDynamicAuthenticationProviderStorageService),
    __param(8, IExtensionService),
    __param(9, IContextKeyService)
], MainThreadMcp);
export { MainThreadMcp };
class ExtHostMcpServerLaunch extends Disposable {
    pushLog(level, message) {
        this._onDidLog.fire({ message, level });
    }
    pushMessage(message) {
        let parsed;
        try {
            parsed = JSON.parse(message);
        }
        catch (e) {
            this.pushLog(LogLevel.Warning, `Failed to parse message: ${JSON.stringify(message)}`);
        }
        if (parsed) {
            if (Array.isArray(parsed)) { // streamable HTTP supports batching
                parsed.forEach(p => this._onDidReceiveMessage.fire(p));
            }
            else {
                this._onDidReceiveMessage.fire(parsed);
            }
        }
    }
    constructor(extHostKind, stop, send) {
        super();
        this.stop = stop;
        this.send = send;
        this.state = observableValue('mcpServerState', { state: 1 /* McpConnectionState.Kind.Starting */ });
        this._onDidLog = this._register(new Emitter());
        this.onDidLog = this._onDidLog.event;
        this._onDidReceiveMessage = this._register(new Emitter());
        this.onDidReceiveMessage = this._onDidReceiveMessage.event;
        this._register(disposableTimeout(() => {
            this.pushLog(LogLevel.Info, `Starting server from ${extensionHostKindToString(extHostKind)} extension host`);
        }));
    }
    extHostDispose() {
        if (McpConnectionState.isRunning(this.state.get())) {
            this.pushLog(LogLevel.Warning, 'Extension host shut down, server will stop.');
            this.state.set({ state: 0 /* McpConnectionState.Kind.Stopped */ }, undefined);
        }
        this.dispose();
    }
    dispose() {
        if (McpConnectionState.isRunning(this.state.get())) {
            this.stop();
        }
        super.dispose();
    }
}
/**
 * Tracks which MCP servers are using which authentication providers.
 * Organized by provider ID for efficient lookup when auth sessions change.
 */
class McpServerAuthTracker {
    constructor() {
        // Provider ID -> Array of serverId and scopes used
        this._tracking = new Map();
    }
    /**
     * Track authentication for a server with a specific provider.
     * Replaces any existing tracking for this server/provider combination.
     */
    track(providerId, serverId, scopes) {
        const servers = this._tracking.get(providerId) || [];
        const filtered = servers.filter(s => s.serverId !== serverId);
        filtered.push({ serverId, scopes });
        this._tracking.set(providerId, filtered);
    }
    /**
     * Remove all authentication tracking for a server across all providers.
     */
    untrack(serverId) {
        for (const [providerId, servers] of this._tracking.entries()) {
            const filtered = servers.filter(s => s.serverId !== serverId);
            if (filtered.length === 0) {
                this._tracking.delete(providerId);
            }
            else {
                this._tracking.set(providerId, filtered);
            }
        }
    }
    /**
     * Get all servers using a specific authentication provider.
     */
    get(providerId) {
        return this._tracking.get(providerId);
    }
    /**
     * Clear all tracking data.
     */
    clear() {
        this._tracking.clear();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZE1jcC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZE1jcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDbEUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDbEUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDbkUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2xILE9BQU8sRUFBdUIsZUFBZSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDMUYsT0FBTyxRQUFRLE1BQU0sa0NBQWtDLENBQUM7QUFDeEQsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ2xELE9BQU8sS0FBSyxHQUFHLE1BQU0saUJBQWlCLENBQUM7QUFDdkMsT0FBTyxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxjQUFjLEVBQWlCLE1BQU0sNkNBQTZDLENBQUM7QUFDNUYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDeEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9ELE9BQU8sRUFBd0IsWUFBWSxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDbEcsT0FBTyxFQUFFLDJCQUEyQixFQUEyQixrQkFBa0IsRUFBRSxtQkFBbUIsRUFBRSxlQUFlLEVBQTBDLDRCQUE0QixF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