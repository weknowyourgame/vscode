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
import { Disposable, DisposableMap, DisposableStore, isDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { equalsIgnoreCase, isFalsyOrWhitespace } from '../../../../base/common/strings.js';
import { isString } from '../../../../base/common/types.js';
import { localize } from '../../../../nls.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IAuthenticationAccessService } from './authenticationAccessService.js';
import { IAuthenticationService, isAuthenticationWwwAuthenticateRequest } from '../common/authentication.js';
import { IBrowserWorkbenchEnvironmentService } from '../../environment/browser/environmentService.js';
import { IExtensionService } from '../../extensions/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ExtensionsRegistry } from '../../extensions/common/extensionsRegistry.js';
import { match } from '../../../../base/common/glob.js';
import { parseWWWAuthenticateHeader } from '../../../../base/common/oauth.js';
import { raceCancellation, raceTimeout } from '../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
export function getAuthenticationProviderActivationEvent(id) { return `onAuthenticationRequest:${id}`; }
export async function getCurrentAuthenticationSessionInfo(secretStorageService, productService) {
    const authenticationSessionValue = await secretStorageService.get(`${productService.urlProtocol}.loginAccount`);
    if (authenticationSessionValue) {
        try {
            const authenticationSessionInfo = JSON.parse(authenticationSessionValue);
            if (authenticationSessionInfo
                && isString(authenticationSessionInfo.id)
                && isString(authenticationSessionInfo.accessToken)
                && isString(authenticationSessionInfo.providerId)) {
                return authenticationSessionInfo;
            }
        }
        catch (e) {
            // This is a best effort operation.
            console.error(`Failed parsing current auth session value: ${e}`);
        }
    }
    return undefined;
}
const authenticationDefinitionSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        id: {
            type: 'string',
            description: localize('authentication.id', 'The id of the authentication provider.')
        },
        label: {
            type: 'string',
            description: localize('authentication.label', 'The human readable name of the authentication provider.'),
        },
        authorizationServerGlobs: {
            type: 'array',
            items: {
                type: 'string',
                description: localize('authentication.authorizationServerGlobs', 'A list of globs that match the authorization servers that this provider supports.'),
            },
            description: localize('authentication.authorizationServerGlobsDescription', 'A list of globs that match the authorization servers that this provider supports.')
        }
    }
};
const authenticationExtPoint = ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: 'authentication',
    jsonSchema: {
        description: localize({ key: 'authenticationExtensionPoint', comment: [`'Contributes' means adds here`] }, 'Contributes authentication'),
        type: 'array',
        items: authenticationDefinitionSchema
    },
    activationEventsGenerator: function* (authenticationProviders) {
        for (const authenticationProvider of authenticationProviders) {
            if (authenticationProvider.id) {
                yield `onAuthenticationRequest:${authenticationProvider.id}`;
            }
        }
    }
});
let AuthenticationService = class AuthenticationService extends Disposable {
    constructor(_extensionService, authenticationAccessService, _environmentService, _logService) {
        super();
        this._extensionService = _extensionService;
        this._environmentService = _environmentService;
        this._logService = _logService;
        this._onDidRegisterAuthenticationProvider = this._register(new Emitter());
        this.onDidRegisterAuthenticationProvider = this._onDidRegisterAuthenticationProvider.event;
        this._onDidUnregisterAuthenticationProvider = this._register(new Emitter());
        this.onDidUnregisterAuthenticationProvider = this._onDidUnregisterAuthenticationProvider.event;
        this._onDidChangeSessions = this._register(new Emitter());
        this.onDidChangeSessions = this._onDidChangeSessions.event;
        this._onDidChangeDeclaredProviders = this._register(new Emitter());
        this.onDidChangeDeclaredProviders = this._onDidChangeDeclaredProviders.event;
        this._authenticationProviders = new Map();
        this._authenticationProviderDisposables = this._register(new DisposableMap());
        this._dynamicAuthenticationProviderIds = new Set();
        this._delegates = [];
        this._disposedSource = new CancellationTokenSource();
        this._declaredProviders = [];
        this._register(toDisposable(() => this._disposedSource.dispose(true)));
        this._register(authenticationAccessService.onDidChangeExtensionSessionAccess(e => {
            // The access has changed, not the actual session itself but extensions depend on this event firing
            // when they have gained access to an account so this fires that event.
            this._onDidChangeSessions.fire({
                providerId: e.providerId,
                label: e.accountName,
                event: {
                    added: [],
                    changed: [],
                    removed: []
                }
            });
        }));
        this._registerEnvContributedAuthenticationProviders();
        this._registerAuthenticationExtensionPointHandler();
    }
    get declaredProviders() {
        return this._declaredProviders;
    }
    _registerEnvContributedAuthenticationProviders() {
        if (!this._environmentService.options?.authenticationProviders?.length) {
            return;
        }
        for (const provider of this._environmentService.options.authenticationProviders) {
            this.registerDeclaredAuthenticationProvider(provider);
            this.registerAuthenticationProvider(provider.id, provider);
        }
    }
    _registerAuthenticationExtensionPointHandler() {
        this._register(authenticationExtPoint.setHandler((_extensions, { added, removed }) => {
            this._logService.debug(`Found authentication providers. added: ${added.length}, removed: ${removed.length}`);
            added.forEach(point => {
                for (const provider of point.value) {
                    if (isFalsyOrWhitespace(provider.id)) {
                        point.collector.error(localize('authentication.missingId', 'An authentication contribution must specify an id.'));
                        continue;
                    }
                    if (isFalsyOrWhitespace(provider.label)) {
                        point.collector.error(localize('authentication.missingLabel', 'An authentication contribution must specify a label.'));
                        continue;
                    }
                    if (!this.declaredProviders.some(p => p.id === provider.id)) {
                        this.registerDeclaredAuthenticationProvider(provider);
                        this._logService.debug(`Declared authentication provider: ${provider.id}`);
                    }
                    else {
                        point.collector.error(localize('authentication.idConflict', "This authentication id '{0}' has already been registered", provider.id));
                    }
                }
            });
            const removedExtPoints = removed.flatMap(r => r.value);
            removedExtPoints.forEach(point => {
                const provider = this.declaredProviders.find(provider => provider.id === point.id);
                if (provider) {
                    this.unregisterDeclaredAuthenticationProvider(provider.id);
                    this._logService.debug(`Undeclared authentication provider: ${provider.id}`);
                }
            });
        }));
    }
    registerDeclaredAuthenticationProvider(provider) {
        if (isFalsyOrWhitespace(provider.id)) {
            throw new Error(localize('authentication.missingId', 'An authentication contribution must specify an id.'));
        }
        if (isFalsyOrWhitespace(provider.label)) {
            throw new Error(localize('authentication.missingLabel', 'An authentication contribution must specify a label.'));
        }
        if (this.declaredProviders.some(p => p.id === provider.id)) {
            throw new Error(localize('authentication.idConflict', "This authentication id '{0}' has already been registered", provider.id));
        }
        this._declaredProviders.push(provider);
        this._onDidChangeDeclaredProviders.fire();
    }
    unregisterDeclaredAuthenticationProvider(id) {
        const index = this.declaredProviders.findIndex(provider => provider.id === id);
        if (index > -1) {
            this.declaredProviders.splice(index, 1);
        }
        this._onDidChangeDeclaredProviders.fire();
    }
    isAuthenticationProviderRegistered(id) {
        return this._authenticationProviders.has(id);
    }
    isDynamicAuthenticationProvider(id) {
        return this._dynamicAuthenticationProviderIds.has(id);
    }
    registerAuthenticationProvider(id, authenticationProvider) {
        this._authenticationProviders.set(id, authenticationProvider);
        const disposableStore = new DisposableStore();
        disposableStore.add(authenticationProvider.onDidChangeSessions(e => this._onDidChangeSessions.fire({
            providerId: id,
            label: authenticationProvider.label,
            event: e
        })));
        if (isDisposable(authenticationProvider)) {
            disposableStore.add(authenticationProvider);
        }
        this._authenticationProviderDisposables.set(id, disposableStore);
        this._onDidRegisterAuthenticationProvider.fire({ id, label: authenticationProvider.label });
    }
    unregisterAuthenticationProvider(id) {
        const provider = this._authenticationProviders.get(id);
        if (provider) {
            this._authenticationProviders.delete(id);
            // If this is a dynamic provider, remove it from the set of dynamic providers
            this._dynamicAuthenticationProviderIds.delete(id);
            this._onDidUnregisterAuthenticationProvider.fire({ id, label: provider.label });
        }
        this._authenticationProviderDisposables.deleteAndDispose(id);
    }
    getProviderIds() {
        const providerIds = [];
        this._authenticationProviders.forEach(provider => {
            providerIds.push(provider.id);
        });
        return providerIds;
    }
    getProvider(id) {
        if (this._authenticationProviders.has(id)) {
            return this._authenticationProviders.get(id);
        }
        throw new Error(`No authentication provider '${id}' is currently registered.`);
    }
    async getAccounts(id) {
        // TODO: Cache this
        const sessions = await this.getSessions(id);
        const accounts = new Array();
        const seenAccounts = new Set();
        for (const session of sessions) {
            if (!seenAccounts.has(session.account.label)) {
                seenAccounts.add(session.account.label);
                accounts.push(session.account);
            }
        }
        return accounts;
    }
    async getSessions(id, scopeListOrRequest, options, activateImmediate = false) {
        if (this._disposedSource.token.isCancellationRequested) {
            return [];
        }
        const authProvider = this._authenticationProviders.get(id) || await this.tryActivateProvider(id, activateImmediate);
        if (authProvider) {
            // Check if the authorization server is in the list of supported authorization servers
            const server = options?.authorizationServer;
            if (server) {
                // Skip the resource server check since the auth provider id contains a specific resource server
                // TODO@TylerLeonhardt: this can change when we have providers that support multiple resource servers
                if (!this.matchesProvider(authProvider, server)) {
                    throw new Error(`The authentication provider '${id}' does not support the authorization server '${server.toString(true)}'.`);
                }
            }
            if (isAuthenticationWwwAuthenticateRequest(scopeListOrRequest)) {
                if (!authProvider.getSessionsFromChallenges) {
                    throw new Error(`The authentication provider '${id}' does not support getting sessions from challenges.`);
                }
                return await authProvider.getSessionsFromChallenges({ challenges: parseWWWAuthenticateHeader(scopeListOrRequest.wwwAuthenticate), fallbackScopes: scopeListOrRequest.fallbackScopes }, { ...options });
            }
            return await authProvider.getSessions(scopeListOrRequest ? [...scopeListOrRequest] : undefined, { ...options });
        }
        else {
            throw new Error(`No authentication provider '${id}' is currently registered.`);
        }
    }
    async createSession(id, scopeListOrRequest, options) {
        if (this._disposedSource.token.isCancellationRequested) {
            throw new Error('Authentication service is disposed.');
        }
        const authProvider = this._authenticationProviders.get(id) || await this.tryActivateProvider(id, !!options?.activateImmediate);
        if (authProvider) {
            if (isAuthenticationWwwAuthenticateRequest(scopeListOrRequest)) {
                if (!authProvider.createSessionFromChallenges) {
                    throw new Error(`The authentication provider '${id}' does not support creating sessions from challenges.`);
                }
                return await authProvider.createSessionFromChallenges({ challenges: parseWWWAuthenticateHeader(scopeListOrRequest.wwwAuthenticate), fallbackScopes: scopeListOrRequest.fallbackScopes }, { ...options });
            }
            return await authProvider.createSession([...scopeListOrRequest], { ...options });
        }
        else {
            throw new Error(`No authentication provider '${id}' is currently registered.`);
        }
    }
    async removeSession(id, sessionId) {
        if (this._disposedSource.token.isCancellationRequested) {
            throw new Error('Authentication service is disposed.');
        }
        const authProvider = this._authenticationProviders.get(id);
        if (authProvider) {
            return authProvider.removeSession(sessionId);
        }
        else {
            throw new Error(`No authentication provider '${id}' is currently registered.`);
        }
    }
    async getOrActivateProviderIdForServer(authorizationServer, resourceServer) {
        for (const provider of this._authenticationProviders.values()) {
            if (this.matchesProvider(provider, authorizationServer, resourceServer)) {
                return provider.id;
            }
        }
        const authServerStr = authorizationServer.toString(true);
        const providers = this._declaredProviders
            // Only consider providers that are not already registered since we already checked them
            .filter(p => !this._authenticationProviders.has(p.id))
            .filter(p => !!p.authorizationServerGlobs?.some(i => match(i, authServerStr, { ignoreCase: true })));
        // TODO:@TylerLeonhardt fan out?
        for (const provider of providers) {
            const activeProvider = await this.tryActivateProvider(provider.id, true);
            // Check the resolved authorization servers
            if (this.matchesProvider(activeProvider, authorizationServer, resourceServer)) {
                return activeProvider.id;
            }
        }
        return undefined;
    }
    async createDynamicAuthenticationProvider(authorizationServer, serverMetadata, resource) {
        const delegate = this._delegates[0];
        if (!delegate) {
            this._logService.error('No authentication provider host delegate found');
            return undefined;
        }
        const providerId = await delegate.create(authorizationServer, serverMetadata, resource);
        const provider = this._authenticationProviders.get(providerId);
        if (provider) {
            this._logService.debug(`Created dynamic authentication provider: ${providerId}`);
            this._dynamicAuthenticationProviderIds.add(providerId);
            return provider;
        }
        this._logService.error(`Failed to create dynamic authentication provider: ${providerId}`);
        return undefined;
    }
    registerAuthenticationProviderHostDelegate(delegate) {
        this._delegates.push(delegate);
        this._delegates.sort((a, b) => b.priority - a.priority);
        return {
            dispose: () => {
                const index = this._delegates.indexOf(delegate);
                if (index !== -1) {
                    this._delegates.splice(index, 1);
                }
            }
        };
    }
    matchesProvider(provider, authorizationServer, resourceServer) {
        // If a resourceServer is provided and the provider has a resourceServer defined, they must match
        if (resourceServer && provider.resourceServer) {
            const resourceServerStr = resourceServer.toString(true);
            const providerResourceServerStr = provider.resourceServer.toString(true);
            if (!equalsIgnoreCase(providerResourceServerStr, resourceServerStr)) {
                return false;
            }
        }
        if (provider.authorizationServers) {
            const authServerStr = authorizationServer.toString(true);
            for (const server of provider.authorizationServers) {
                const str = server.toString(true);
                if (equalsIgnoreCase(str, authServerStr) || match(str, authServerStr, { ignoreCase: true })) {
                    return true;
                }
            }
        }
        return false;
    }
    async tryActivateProvider(providerId, activateImmediate) {
        await this._extensionService.activateByEvent(getAuthenticationProviderActivationEvent(providerId), activateImmediate ? 1 /* ActivationKind.Immediate */ : 0 /* ActivationKind.Normal */);
        let provider = this._authenticationProviders.get(providerId);
        if (provider) {
            return provider;
        }
        if (this._disposedSource.token.isCancellationRequested) {
            throw new Error('Authentication service is disposed.');
        }
        const store = new DisposableStore();
        try {
            const result = await raceTimeout(raceCancellation(Event.toPromise(Event.filter(this.onDidRegisterAuthenticationProvider, e => e.id === providerId, store), store), this._disposedSource.token), 5000);
            if (!result) {
                throw new Error(`Timed out waiting for authentication provider '${providerId}' to register.`);
            }
            provider = this._authenticationProviders.get(result.id);
            if (provider) {
                return provider;
            }
            throw new Error(`No authentication provider '${providerId}' is currently registered.`);
        }
        finally {
            store.dispose();
        }
    }
};
AuthenticationService = __decorate([
    __param(0, IExtensionService),
    __param(1, IAuthenticationAccessService),
    __param(2, IBrowserWorkbenchEnvironmentService),
    __param(3, ILogService)
], AuthenticationService);
export { AuthenticationService };
registerSingleton(IAuthenticationService, AuthenticationService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb25TZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9hdXRoZW50aWNhdGlvbi9icm93c2VyL2F1dGhlbnRpY2F0aW9uU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBZSxZQUFZLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDM0ksT0FBTyxFQUFFLGdCQUFnQixFQUFFLG1CQUFtQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDM0YsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFHL0csT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDaEYsT0FBTyxFQUFtUSxzQkFBc0IsRUFBeUMsc0NBQXNDLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNyWixPQUFPLEVBQUUsbUNBQW1DLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUN0RyxPQUFPLEVBQWtCLGlCQUFpQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDMUYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRXJFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUV4RCxPQUFPLEVBQXlFLDBCQUEwQixF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