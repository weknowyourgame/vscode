/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { AuthenticationAccessService } from '../../browser/authenticationAccessService.js';
import { AuthenticationService } from '../../browser/authenticationService.js';
import { TestEnvironmentService } from '../../../../test/browser/workbenchTestServices.js';
import { TestExtensionService, TestProductService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
function createSession() {
    return { id: 'session1', accessToken: 'token1', account: { id: 'account', label: 'Account' }, scopes: ['test'] };
}
function createProvider(overrides = {}) {
    return {
        supportsMultipleAccounts: false,
        onDidChangeSessions: new Emitter().event,
        id: 'test',
        label: 'Test',
        getSessions: async () => [],
        createSession: async () => createSession(),
        removeSession: async () => { },
        ...overrides
    };
}
suite('AuthenticationService', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let authenticationService;
    setup(() => {
        const storageService = disposables.add(new TestStorageService());
        const authenticationAccessService = disposables.add(new AuthenticationAccessService(storageService, TestProductService));
        authenticationService = disposables.add(new AuthenticationService(new TestExtensionService(), authenticationAccessService, TestEnvironmentService, new NullLogService()));
    });
    teardown(() => {
        // Dispose the authentication service after each test
        authenticationService.dispose();
    });
    suite('declaredAuthenticationProviders', () => {
        test('registerDeclaredAuthenticationProvider', async () => {
            const changed = Event.toPromise(authenticationService.onDidChangeDeclaredProviders);
            const provider = {
                id: 'github',
                label: 'GitHub'
            };
            authenticationService.registerDeclaredAuthenticationProvider(provider);
            // Assert that the provider is added to the declaredProviders array and the event fires
            assert.equal(authenticationService.declaredProviders.length, 1);
            assert.deepEqual(authenticationService.declaredProviders[0], provider);
            await changed;
        });
        test('unregisterDeclaredAuthenticationProvider', async () => {
            const provider = {
                id: 'github',
                label: 'GitHub'
            };
            authenticationService.registerDeclaredAuthenticationProvider(provider);
            const changed = Event.toPromise(authenticationService.onDidChangeDeclaredProviders);
            authenticationService.unregisterDeclaredAuthenticationProvider(provider.id);
            // Assert that the provider is removed from the declaredProviders array and the event fires
            assert.equal(authenticationService.declaredProviders.length, 0);
            await changed;
        });
    });
    suite('authenticationProviders', () => {
        test('isAuthenticationProviderRegistered', async () => {
            const registered = Event.toPromise(authenticationService.onDidRegisterAuthenticationProvider);
            const provider = createProvider();
            assert.equal(authenticationService.isAuthenticationProviderRegistered(provider.id), false);
            authenticationService.registerAuthenticationProvider(provider.id, provider);
            assert.equal(authenticationService.isAuthenticationProviderRegistered(provider.id), true);
            const result = await registered;
            assert.deepEqual(result, { id: provider.id, label: provider.label });
        });
        test('unregisterAuthenticationProvider', async () => {
            const unregistered = Event.toPromise(authenticationService.onDidUnregisterAuthenticationProvider);
            const provider = createProvider();
            authenticationService.registerAuthenticationProvider(provider.id, provider);
            assert.equal(authenticationService.isAuthenticationProviderRegistered(provider.id), true);
            authenticationService.unregisterAuthenticationProvider(provider.id);
            assert.equal(authenticationService.isAuthenticationProviderRegistered(provider.id), false);
            const result = await unregistered;
            assert.deepEqual(result, { id: provider.id, label: provider.label });
        });
        test('getProviderIds', () => {
            const provider1 = createProvider({
                id: 'provider1',
                label: 'Provider 1'
            });
            const provider2 = createProvider({
                id: 'provider2',
                label: 'Provider 2'
            });
            authenticationService.registerAuthenticationProvider(provider1.id, provider1);
            authenticationService.registerAuthenticationProvider(provider2.id, provider2);
            const providerIds = authenticationService.getProviderIds();
            // Assert that the providerIds array contains the registered provider ids
            assert.deepEqual(providerIds, [provider1.id, provider2.id]);
        });
        test('getProvider', () => {
            const provider = createProvider();
            authenticationService.registerAuthenticationProvider(provider.id, provider);
            const retrievedProvider = authenticationService.getProvider(provider.id);
            // Assert that the retrieved provider is the same as the registered provider
            assert.deepEqual(retrievedProvider, provider);
        });
        test('getOrActivateProviderIdForServer - should return undefined when no provider matches the authorization server', async () => {
            const authorizationServer = URI.parse('https://example.com');
            const result = await authenticationService.getOrActivateProviderIdForServer(authorizationServer);
            assert.strictEqual(result, undefined);
        });
        test('getOrActivateProviderIdForServer - should return provider id if authorizationServerGlobs matches and authorizationServers match', async () => {
            // Register a declared provider with an authorization server glob
            const provider = {
                id: 'github',
                label: 'GitHub',
                authorizationServerGlobs: ['https://github.com/*']
            };
            authenticationService.registerDeclaredAuthenticationProvider(provider);
            // Register an authentication provider with matching authorization servers
            const authProvider = createProvider({
                id: 'github',
                label: 'GitHub',
                authorizationServers: [URI.parse('https://github.com/login')]
            });
            authenticationService.registerAuthenticationProvider('github', authProvider);
            // Test with a matching URI
            const authorizationServer = URI.parse('https://github.com/login');
            const result = await authenticationService.getOrActivateProviderIdForServer(authorizationServer);
            // Verify the result
            assert.strictEqual(result, 'github');
        });
        test('getOrActivateProviderIdForServer - should return undefined if authorizationServerGlobs match but authorizationServers do not match', async () => {
            // Register a declared provider with an authorization server glob
            const provider = {
                id: 'github',
                label: 'GitHub',
                authorizationServerGlobs: ['https://github.com/*']
            };
            authenticationService.registerDeclaredAuthenticationProvider(provider);
            // Register an authentication provider with non-matching authorization servers
            const authProvider = createProvider({
                id: 'github',
                label: 'GitHub',
                authorizationServers: [URI.parse('https://github.com/different')]
            });
            authenticationService.registerAuthenticationProvider('github', authProvider);
            // Test with a non-matching URI
            const authorizationServer = URI.parse('https://github.com/login');
            const result = await authenticationService.getOrActivateProviderIdForServer(authorizationServer);
            // Verify the result
            assert.strictEqual(result, undefined);
        });
        test('getOrActivateProviderIdForAuthorizationServer - should check multiple providers and return the first match', async () => {
            // Register two declared providers with authorization server globs
            const provider1 = {
                id: 'github',
                label: 'GitHub',
                authorizationServerGlobs: ['https://github.com/*']
            };
            const provider2 = {
                id: 'microsoft',
                label: 'Microsoft',
                authorizationServerGlobs: ['https://login.microsoftonline.com/*']
            };
            authenticationService.registerDeclaredAuthenticationProvider(provider1);
            authenticationService.registerDeclaredAuthenticationProvider(provider2);
            // Register authentication providers
            const githubProvider = createProvider({
                id: 'github',
                label: 'GitHub',
                authorizationServers: [URI.parse('https://github.com/different')]
            });
            authenticationService.registerAuthenticationProvider('github', githubProvider);
            const microsoftProvider = createProvider({
                id: 'microsoft',
                label: 'Microsoft',
                authorizationServers: [URI.parse('https://login.microsoftonline.com/common')]
            });
            authenticationService.registerAuthenticationProvider('microsoft', microsoftProvider);
            // Test with a URI that should match the second provider
            const authorizationServer = URI.parse('https://login.microsoftonline.com/common');
            const result = await authenticationService.getOrActivateProviderIdForServer(authorizationServer);
            // Verify the result
            assert.strictEqual(result, 'microsoft');
        });
        test('getOrActivateProviderIdForServer - should match when resourceServer matches provider resourceServer', async () => {
            const authorizationServer = URI.parse('https://login.microsoftonline.com/common');
            const resourceServer = URI.parse('https://graph.microsoft.com');
            // Register an authentication provider with a resourceServer
            const authProvider = createProvider({
                id: 'microsoft',
                label: 'Microsoft',
                authorizationServers: [authorizationServer],
                resourceServer: resourceServer
            });
            authenticationService.registerAuthenticationProvider('microsoft', authProvider);
            // Test with matching authorization server and resource server
            const result = await authenticationService.getOrActivateProviderIdForServer(authorizationServer, resourceServer);
            // Verify the result
            assert.strictEqual(result, 'microsoft');
        });
        test('getOrActivateProviderIdForServer - should not match when resourceServer does not match provider resourceServer', async () => {
            const authorizationServer = URI.parse('https://login.microsoftonline.com/common');
            const resourceServer = URI.parse('https://graph.microsoft.com');
            const differentResourceServer = URI.parse('https://vault.azure.net');
            // Register an authentication provider with a resourceServer
            const authProvider = createProvider({
                id: 'microsoft',
                label: 'Microsoft',
                authorizationServers: [authorizationServer],
                resourceServer: resourceServer
            });
            authenticationService.registerAuthenticationProvider('microsoft', authProvider);
            // Test with matching authorization server but different resource server
            const result = await authenticationService.getOrActivateProviderIdForServer(authorizationServer, differentResourceServer);
            // Verify the result - should not match because resource servers don't match
            assert.strictEqual(result, undefined);
        });
        test('getOrActivateProviderIdForServer - should match when provider has no resourceServer and resourceServer is provided', async () => {
            const authorizationServer = URI.parse('https://login.microsoftonline.com/common');
            const resourceServer = URI.parse('https://graph.microsoft.com');
            // Register an authentication provider without a resourceServer
            const authProvider = createProvider({
                id: 'microsoft',
                label: 'Microsoft',
                authorizationServers: [authorizationServer]
            });
            authenticationService.registerAuthenticationProvider('microsoft', authProvider);
            // Test with matching authorization server and a resource server
            // Should match because provider has no resourceServer defined
            const result = await authenticationService.getOrActivateProviderIdForServer(authorizationServer, resourceServer);
            // Verify the result
            assert.strictEqual(result, 'microsoft');
        });
        test('getOrActivateProviderIdForServer - should match when provider has resourceServer but no resourceServer is provided', async () => {
            const authorizationServer = URI.parse('https://login.microsoftonline.com/common');
            const resourceServer = URI.parse('https://graph.microsoft.com');
            // Register an authentication provider with a resourceServer
            const authProvider = createProvider({
                id: 'microsoft',
                label: 'Microsoft',
                authorizationServers: [authorizationServer],
                resourceServer: resourceServer
            });
            authenticationService.registerAuthenticationProvider('microsoft', authProvider);
            // Test with matching authorization server but no resource server provided
            // Should match because no resourceServer is provided to check against
            const result = await authenticationService.getOrActivateProviderIdForServer(authorizationServer);
            // Verify the result
            assert.strictEqual(result, 'microsoft');
        });
        test('getOrActivateProviderIdForServer - should distinguish between providers with same authorization server but different resource servers', async () => {
            const authorizationServer = URI.parse('https://login.microsoftonline.com/common');
            const graphResourceServer = URI.parse('https://graph.microsoft.com');
            const vaultResourceServer = URI.parse('https://vault.azure.net');
            // Register first provider with Graph resource server
            const graphProvider = createProvider({
                id: 'microsoft-graph',
                label: 'Microsoft Graph',
                authorizationServers: [authorizationServer],
                resourceServer: graphResourceServer
            });
            authenticationService.registerAuthenticationProvider('microsoft-graph', graphProvider);
            // Register second provider with Vault resource server
            const vaultProvider = createProvider({
                id: 'microsoft-vault',
                label: 'Microsoft Vault',
                authorizationServers: [authorizationServer],
                resourceServer: vaultResourceServer
            });
            authenticationService.registerAuthenticationProvider('microsoft-vault', vaultProvider);
            // Test with Graph resource server - should match the first provider
            const graphResult = await authenticationService.getOrActivateProviderIdForServer(authorizationServer, graphResourceServer);
            assert.strictEqual(graphResult, 'microsoft-graph');
            // Test with Vault resource server - should match the second provider
            const vaultResult = await authenticationService.getOrActivateProviderIdForServer(authorizationServer, vaultResourceServer);
            assert.strictEqual(vaultResult, 'microsoft-vault');
            // Test with different resource server - should not match either
            const otherResourceServer = URI.parse('https://storage.azure.com');
            const noMatchResult = await authenticationService.getOrActivateProviderIdForServer(authorizationServer, otherResourceServer);
            assert.strictEqual(noMatchResult, undefined);
        });
    });
    suite('authenticationSessions', () => {
        test('getSessions - base case', async () => {
            let isCalled = false;
            const provider = createProvider({
                getSessions: async () => {
                    isCalled = true;
                    return [createSession()];
                },
            });
            authenticationService.registerAuthenticationProvider(provider.id, provider);
            const sessions = await authenticationService.getSessions(provider.id);
            assert.equal(sessions.length, 1);
            assert.ok(isCalled);
        });
        test('getSessions - authorization server is not registered', async () => {
            let isCalled = false;
            const provider = createProvider({
                getSessions: async () => {
                    isCalled = true;
                    return [createSession()];
                },
            });
            authenticationService.registerAuthenticationProvider(provider.id, provider);
            assert.rejects(() => authenticationService.getSessions(provider.id, [], { authorizationServer: URI.parse('https://example.com') }));
            assert.ok(!isCalled);
        });
        test('createSession', async () => {
            const emitter = new Emitter();
            const provider = createProvider({
                onDidChangeSessions: emitter.event,
                createSession: async () => {
                    const session = createSession();
                    emitter.fire({ added: [session], removed: [], changed: [] });
                    return session;
                },
            });
            const changed = Event.toPromise(authenticationService.onDidChangeSessions);
            authenticationService.registerAuthenticationProvider(provider.id, provider);
            const session = await authenticationService.createSession(provider.id, ['repo']);
            // Assert that the created session matches the expected session and the event fires
            assert.ok(session);
            const result = await changed;
            assert.deepEqual(result, {
                providerId: provider.id,
                label: provider.label,
                event: { added: [session], removed: [], changed: [] }
            });
        });
        test('removeSession', async () => {
            const emitter = new Emitter();
            const session = createSession();
            const provider = createProvider({
                onDidChangeSessions: emitter.event,
                removeSession: async () => emitter.fire({ added: [], removed: [session], changed: [] })
            });
            const changed = Event.toPromise(authenticationService.onDidChangeSessions);
            authenticationService.registerAuthenticationProvider(provider.id, provider);
            await authenticationService.removeSession(provider.id, session.id);
            const result = await changed;
            assert.deepEqual(result, {
                providerId: provider.id,
                label: provider.label,
                event: { added: [], removed: [session], changed: [] }
            });
        });
        test('onDidChangeSessions', async () => {
            const emitter = new Emitter();
            const provider = createProvider({
                onDidChangeSessions: emitter.event,
                getSessions: async () => []
            });
            authenticationService.registerAuthenticationProvider(provider.id, provider);
            const changed = Event.toPromise(authenticationService.onDidChangeSessions);
            const session = createSession();
            emitter.fire({ added: [], removed: [], changed: [session] });
            const result = await changed;
            assert.deepEqual(result, {
                providerId: provider.id,
                label: provider.label,
                event: { added: [], removed: [], changed: [session] }
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb25TZXJ2aWNlLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL2F1dGhlbnRpY2F0aW9uL3Rlc3QvYnJvd3Nlci9hdXRoZW50aWNhdGlvblNlcnZpY2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRyxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEQsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDM0YsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFL0UsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDM0YsT0FBTyxFQUFFLG9CQUFvQixFQUFFLGtCQUFrQixFQUFFLGtCQUFrQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDaEksT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBRTNFLFNBQVMsYUFBYTtJQUNyQixPQUFPLEVBQUUsRUFBRSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7QUFDbEgsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFDLFlBQThDLEVBQUU7SUFDdkUsT0FBTztRQUNOLHdCQUF3QixFQUFFLEtBQUs7UUFDL0IsbUJB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