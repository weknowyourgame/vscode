/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
/**
 * Helper function to create a mock authentication provider
 */
export function createProvider(overrides = {}) {
    return {
        id: 'test-provider',
        label: 'Test Provider',
        supportsMultipleAccounts: true,
        createSession: () => Promise.resolve(createSession()),
        removeSession: () => Promise.resolve(),
        getSessions: () => Promise.resolve([]),
        onDidChangeSessions: new Emitter().event,
        ...overrides
    };
}
/**
 * Helper function to create a mock authentication session
 */
export function createSession() {
    return {
        id: 'test-session',
        accessToken: 'test-token',
        account: { id: 'test-account', label: 'Test Account' },
        scopes: ['read', 'write'],
        idToken: undefined
    };
}
/**
 * Base class for test services with common functionality and call tracking
 */
export class BaseTestService extends Disposable {
    constructor() {
        super(...arguments);
        this.data = new Map();
        this._methodCalls = [];
    }
    getKey(...parts) {
        return parts.join('::');
    }
    /**
     * Track a method call for verification in tests
     */
    trackCall(method, ...args) {
        this._methodCalls.push({
            method,
            args: [...args],
            timestamp: Date.now()
        });
    }
    /**
     * Get all method calls for verification
     */
    getMethodCalls() {
        return [...this._methodCalls];
    }
    /**
     * Get calls for a specific method
     */
    getCallsFor(method) {
        return this._methodCalls.filter(call => call.method === method);
    }
    /**
     * Clear method call history
     */
    clearCallHistory() {
        this._methodCalls.length = 0;
    }
    /**
     * Get the last call for a specific method
     */
    getLastCallFor(method) {
        const calls = this.getCallsFor(method);
        return calls[calls.length - 1];
    }
}
/**
 * Test implementation that actually stores and retrieves data
 */
export class TestUsageService extends BaseTestService {
    readAccountUsages(providerId, accountName) {
        this.trackCall('readAccountUsages', providerId, accountName);
        return this.data.get(this.getKey(providerId, accountName)) || [];
    }
    addAccountUsage(providerId, accountName, scopes, extensionId, extensionName) {
        this.trackCall('addAccountUsage', providerId, accountName, scopes, extensionId, extensionName);
        const key = this.getKey(providerId, accountName);
        const usages = this.data.get(key) || [];
        usages.push({ extensionId, extensionName, scopes: [...scopes], lastUsed: Date.now() });
        this.data.set(key, usages);
    }
    removeAccountUsage(providerId, accountName) {
        this.trackCall('removeAccountUsage', providerId, accountName);
        this.data.delete(this.getKey(providerId, accountName));
    }
    // Stub implementations for missing methods
    async initializeExtensionUsageCache() { }
    async extensionUsesAuth(extensionId) { return false; }
}
export class TestMcpUsageService extends BaseTestService {
    readAccountUsages(providerId, accountName) {
        this.trackCall('readAccountUsages', providerId, accountName);
        return this.data.get(this.getKey(providerId, accountName)) || [];
    }
    addAccountUsage(providerId, accountName, scopes, mcpServerId, mcpServerName) {
        this.trackCall('addAccountUsage', providerId, accountName, scopes, mcpServerId, mcpServerName);
        const key = this.getKey(providerId, accountName);
        const usages = this.data.get(key) || [];
        usages.push({ mcpServerId, mcpServerName, scopes: [...scopes], lastUsed: Date.now() });
        this.data.set(key, usages);
    }
    removeAccountUsage(providerId, accountName) {
        this.trackCall('removeAccountUsage', providerId, accountName);
        this.data.delete(this.getKey(providerId, accountName));
    }
    // Stub implementations for missing methods
    async initializeUsageCache() { }
    async hasUsedAuth(mcpServerId) { return false; }
}
export class TestAccessService extends BaseTestService {
    constructor() {
        super(...arguments);
        this._onDidChangeExtensionSessionAccess = this._register(new Emitter());
        this.onDidChangeExtensionSessionAccess = this._onDidChangeExtensionSessionAccess.event;
    }
    isAccessAllowed(providerId, accountName, extensionId) {
        this.trackCall('isAccessAllowed', providerId, accountName, extensionId);
        const extensions = this.data.get(this.getKey(providerId, accountName)) || [];
        const extension = extensions.find((e) => e.id === extensionId);
        return extension?.allowed;
    }
    readAllowedExtensions(providerId, accountName) {
        this.trackCall('readAllowedExtensions', providerId, accountName);
        return this.data.get(this.getKey(providerId, accountName)) || [];
    }
    updateAllowedExtensions(providerId, accountName, extensions) {
        this.trackCall('updateAllowedExtensions', providerId, accountName, extensions);
        const key = this.getKey(providerId, accountName);
        const existing = this.data.get(key) || [];
        // Merge with existing data, updating or adding extensions
        const merged = [...existing];
        for (const ext of extensions) {
            const existingIndex = merged.findIndex(e => e.id === ext.id);
            if (existingIndex >= 0) {
                merged[existingIndex] = ext;
            }
            else {
                merged.push(ext);
            }
        }
        this.data.set(key, merged);
        this._onDidChangeExtensionSessionAccess.fire({ providerId, accountName });
    }
    removeAllowedExtensions(providerId, accountName) {
        this.trackCall('removeAllowedExtensions', providerId, accountName);
        this.data.delete(this.getKey(providerId, accountName));
    }
}
export class TestMcpAccessService extends BaseTestService {
    constructor() {
        super(...arguments);
        this._onDidChangeMcpSessionAccess = this._register(new Emitter());
        this.onDidChangeMcpSessionAccess = this._onDidChangeMcpSessionAccess.event;
    }
    isAccessAllowed(providerId, accountName, mcpServerId) {
        this.trackCall('isAccessAllowed', providerId, accountName, mcpServerId);
        const servers = this.data.get(this.getKey(providerId, accountName)) || [];
        const server = servers.find((s) => s.id === mcpServerId);
        return server?.allowed;
    }
    readAllowedMcpServers(providerId, accountName) {
        this.trackCall('readAllowedMcpServers', providerId, accountName);
        return this.data.get(this.getKey(providerId, accountName)) || [];
    }
    updateAllowedMcpServers(providerId, accountName, mcpServers) {
        this.trackCall('updateAllowedMcpServers', providerId, accountName, mcpServers);
        const key = this.getKey(providerId, accountName);
        const existing = this.data.get(key) || [];
        // Merge with existing data, updating or adding MCP servers
        const merged = [...existing];
        for (const server of mcpServers) {
            const existingIndex = merged.findIndex(s => s.id === server.id);
            if (existingIndex >= 0) {
                merged[existingIndex] = server;
            }
            else {
                merged.push(server);
            }
        }
        this.data.set(key, merged);
        this._onDidChangeMcpSessionAccess.fire({ providerId, accountName });
    }
    removeAllowedMcpServers(providerId, accountName) {
        this.trackCall('removeAllowedMcpServers', providerId, accountName);
        this.data.delete(this.getKey(providerId, accountName));
        this._onDidChangeMcpSessionAccess.fire({ providerId, accountName });
    }
}
export class TestPreferencesService extends BaseTestService {
    constructor() {
        super(...arguments);
        this._onDidChangeAccountPreference = this._register(new Emitter());
        this.onDidChangeAccountPreference = this._onDidChangeAccountPreference.event;
    }
    getAccountPreference(clientId, providerId) {
        return this.data.get(this.getKey(clientId, providerId));
    }
    updateAccountPreference(clientId, providerId, account) {
        this.data.set(this.getKey(clientId, providerId), account.label);
    }
    removeAccountPreference(clientId, providerId) {
        this.data.delete(this.getKey(clientId, providerId));
    }
}
export class TestExtensionsService extends TestPreferencesService {
    // Stub implementations for methods we don't test
    updateSessionPreference() { }
    getSessionPreference() { return undefined; }
    removeSessionPreference() { }
    selectSession() { return Promise.resolve(createSession()); }
    requestSessionAccess() { }
    requestNewSession() { return Promise.resolve(); }
    updateNewSessionRequests() { }
}
export class TestMcpService extends TestPreferencesService {
    // Stub implementations for methods we don't test
    updateSessionPreference() { }
    getSessionPreference() { return undefined; }
    removeSessionPreference() { }
    selectSession() { return Promise.resolve(createSession()); }
    requestSessionAccess() { }
    requestNewSession() { return Promise.resolve(); }
}
/**
 * Minimal authentication service mock that only implements what we need
 */
export class TestAuthenticationService extends BaseTestService {
    constructor() {
        super(...arguments);
        this._onDidChangeSessions = this._register(new Emitter());
        this._onDidRegisterAuthenticationProvider = this._register(new Emitter());
        this._onDidUnregisterAuthenticationProvider = this._register(new Emitter());
        this._onDidChangeDeclaredProviders = this._register(new Emitter());
        this.onDidChangeSessions = this._onDidChangeSessions.event;
        this.onDidRegisterAuthenticationProvider = this._onDidRegisterAuthenticationProvider.event;
        this.onDidUnregisterAuthenticationProvider = this._onDidUnregisterAuthenticationProvider.event;
        this.onDidChangeDeclaredProviders = this._onDidChangeDeclaredProviders.event;
        this.accountsMap = new Map();
    }
    registerAuthenticationProvider(id, provider) {
        this.data.set(id, provider);
        this._onDidRegisterAuthenticationProvider.fire({ id, label: provider.label });
    }
    getProviderIds() {
        return Array.from(this.data.keys());
    }
    isAuthenticationProviderRegistered(id) {
        return this.data.has(id);
    }
    getProvider(id) {
        return this.data.get(id);
    }
    addAccounts(providerId, accounts) {
        this.accountsMap.set(providerId, accounts);
    }
    async getAccounts(providerId) {
        return this.accountsMap.get(providerId) || [];
    }
    // All other methods are stubs since we don't test them
    get declaredProviders() { return []; }
    isDynamicAuthenticationProvider() { return false; }
    async getSessions() { return []; }
    async createSession() { return createSession(); }
    async removeSession() { }
    manageTrustedExtensionsForAccount() { }
    async removeAccountSessions() { }
    registerDeclaredAuthenticationProvider() { }
    unregisterDeclaredAuthenticationProvider() { }
    unregisterAuthenticationProvider() { }
    registerAuthenticationProviderHostDelegate() { return { dispose: () => { } }; }
    createDynamicAuthenticationProvider() { return Promise.resolve(undefined); }
    async requestNewSession() { return createSession(); }
    async getSession() { return createSession(); }
    getOrActivateProviderIdForServer() { return Promise.resolve(undefined); }
    supportsHeimdallConnection() { return false; }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb25RdWVyeVNlcnZpY2VNb2Nrcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvYXV0aGVudGljYXRpb24vdGVzdC9icm93c2VyL2F1dGhlbnRpY2F0aW9uUXVlcnlTZXJ2aWNlTW9ja3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSx5Q0FBeUMsQ0FBQztBQVFsRjs7R0FFRztBQUNILE1BQU0sVUFBVSxjQUFjLENBQUMsWUFBOEMsRUFBRTtJQUM5RSxPQUFPO1FBQ04sRUFBRSxFQUFFLGVBQWU7UUFDbkIsS0FBSyxFQUFFLGVBQWU7UUFDdEIsd0JBQXdCLEVBQUUsSUFBSTtRQUM5QixhQUFhLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUNyRCxhQUFhLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRTtRQUN0QyxXQUFXLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDdEMsbUJBQW1CLEVBQUUsSUFBSSxPQUFPLEVBQU8sQ0FBQyxLQUFLO1FBQzdDLEdBQUcsU0FBUztLQUNaLENBQUM7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsYUFBYTtJQUM1QixPQUFPO1FBQ04sRUFBRSxFQUFFLGNBQWM7UUFDbEIsV0FBVyxFQUFFLFlBQVk7UUFDekIsT0FBTyxFQUFFLEVBQUUsRUFBRSxFQUFFLGNBQWMsRUFBRSxLQUFLLEVBQUUsY0FBYyxFQUFFO1FBQ3RELE1BQU0sRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUM7UUFDekIsT0FB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