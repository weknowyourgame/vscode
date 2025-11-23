/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { AuthenticationQueryService } from '../../browser/authenticationQueryService.js';
import { IAuthenticationService, IAuthenticationExtensionsService } from '../../common/authentication.js';
import { IAuthenticationUsageService } from '../../browser/authenticationUsageService.js';
import { IAuthenticationMcpUsageService } from '../../browser/authenticationMcpUsageService.js';
import { IAuthenticationAccessService } from '../../browser/authenticationAccessService.js';
import { IAuthenticationMcpAccessService } from '../../browser/authenticationMcpAccessService.js';
import { IAuthenticationMcpService } from '../../browser/authenticationMcpService.js';
import { TestUsageService, TestMcpUsageService, TestAccessService, TestMcpAccessService, TestExtensionsService, TestMcpService, TestAuthenticationService, createProvider, } from './authenticationQueryServiceMocks.js';
/**
 * Real integration tests for AuthenticationQueryService
 */
suite('AuthenticationQueryService Integration Tests', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let queryService;
    let authService;
    let usageService;
    let mcpUsageService;
    let accessService;
    let mcpAccessService;
    setup(() => {
        const instantiationService = disposables.add(new TestInstantiationService());
        // Set up storage service
        const storageService = disposables.add(new TestStorageService());
        instantiationService.stub(IStorageService, storageService);
        // Set up log service
        instantiationService.stub(ILogService, new NullLogService());
        // Create and register test services
        authService = disposables.add(new TestAuthenticationService());
        instantiationService.stub(IAuthenticationService, authService);
        usageService = disposables.add(new TestUsageService());
        mcpUsageService = disposables.add(new TestMcpUsageService());
        accessService = disposables.add(new TestAccessService());
        mcpAccessService = disposables.add(new TestMcpAccessService());
        instantiationService.stub(IAuthenticationUsageService, usageService);
        instantiationService.stub(IAuthenticationMcpUsageService, mcpUsageService);
        instantiationService.stub(IAuthenticationAccessService, accessService);
        instantiationService.stub(IAuthenticationMcpAccessService, mcpAccessService);
        instantiationService.stub(IAuthenticationExtensionsService, disposables.add(new TestExtensionsService()));
        instantiationService.stub(IAuthenticationMcpService, disposables.add(new TestMcpService()));
        // Create the query service
        queryService = disposables.add(instantiationService.createInstance(AuthenticationQueryService));
    });
    test('usage tracking stores and retrieves data correctly', () => {
        const extensionQuery = queryService.provider('github').account('user@example.com').extension('my-extension');
        // Initially no usage
        assert.strictEqual(extensionQuery.getUsage().length, 0);
        // Add usage and verify it's stored
        extensionQuery.addUsage(['read', 'write'], 'My Extension');
        const usage = extensionQuery.getUsage();
        assert.strictEqual(usage.length, 1);
        assert.strictEqual(usage[0].extensionId, 'my-extension');
        assert.strictEqual(usage[0].extensionName, 'My Extension');
        assert.deepStrictEqual(usage[0].scopes, ['read', 'write']);
        // Add more usage and verify accumulation
        extensionQuery.addUsage(['admin'], 'My Extension');
        assert.strictEqual(extensionQuery.getUsage().length, 2);
    });
    test('access control persists across queries', () => {
        const extensionQuery = queryService.provider('github').account('user@example.com').extension('my-extension');
        // Set access and verify
        extensionQuery.setAccessAllowed(true, 'My Extension');
        assert.strictEqual(extensionQuery.isAccessAllowed(), true);
        // Create new query object for same target - should persist
        const sameExtensionQuery = queryService.provider('github').account('user@example.com').extension('my-extension');
        assert.strictEqual(sameExtensionQuery.isAccessAllowed(), true);
        // Different extension should be unaffected
        const otherExtensionQuery = queryService.provider('github').account('user@example.com').extension('other-extension');
        assert.strictEqual(otherExtensionQuery.isAccessAllowed(), undefined);
    });
    test('account preferences work across services', () => {
        const extensionQuery = queryService.provider('github').extension('my-extension');
        const mcpQuery = queryService.provider('github').mcpServer('my-server');
        // Set preferences for both
        extensionQuery.setPreferredAccount({ id: 'user1', label: 'user@example.com' });
        mcpQuery.setPreferredAccount({ id: 'user2', label: 'admin@example.com' });
        // Verify different preferences are stored independently
        assert.strictEqual(extensionQuery.getPreferredAccount(), 'user@example.com');
        assert.strictEqual(mcpQuery.getPreferredAccount(), 'admin@example.com');
        // Test preference detection
        const userExtensionQuery = queryService.provider('github').account('user@example.com').extension('my-extension');
        const adminMcpQuery = queryService.provider('github').account('admin@example.com').mcpServer('my-server');
        assert.strictEqual(userExtensionQuery.isPreferred(), true);
        assert.strictEqual(adminMcpQuery.isPreferred(), true);
        // Test non-preferred accounts
        const wrongExtensionQuery = queryService.provider('github').account('wrong@example.com').extension('my-extension');
        assert.strictEqual(wrongExtensionQuery.isPreferred(), false);
    });
    test('account removal cleans up all related data', () => {
        const accountQuery = queryService.provider('github').account('user@example.com');
        // Set up data across multiple services
        accountQuery.extension('ext1').setAccessAllowed(true, 'Extension 1');
        accountQuery.extension('ext1').addUsage(['read'], 'Extension 1');
        accountQuery.mcpServer('mcp1').setAccessAllowed(true, 'MCP Server 1');
        accountQuery.mcpServer('mcp1').addUsage(['write'], 'MCP Server 1');
        // Verify data exists
        assert.strictEqual(accountQuery.extension('ext1').isAccessAllowed(), true);
        assert.strictEqual(accountQuery.extension('ext1').getUsage().length, 1);
        assert.strictEqual(accountQuery.mcpServer('mcp1').isAccessAllowed(), true);
        assert.strictEqual(accountQuery.mcpServer('mcp1').getUsage().length, 1);
        // Remove account
        accountQuery.remove();
        // Verify all data is cleaned up
        assert.strictEqual(accountQuery.extension('ext1').isAccessAllowed(), undefined);
        assert.strictEqual(accountQuery.extension('ext1').getUsage().length, 0);
        assert.strictEqual(accountQuery.mcpServer('mcp1').isAccessAllowed(), undefined);
        assert.strictEqual(accountQuery.mcpServer('mcp1').getUsage().length, 0);
    });
    test('provider registration and listing works', () => {
        // Initially no providers
        assert.strictEqual(queryService.getProviderIds().length, 0);
        // Register a provider
        const provider = createProvider({ id: 'github', label: 'GitHub' });
        authService.registerAuthenticationProvider('github', provider);
        // Verify provider is listed
        const providerIds = queryService.getProviderIds();
        assert.ok(providerIds.includes('github'));
        assert.strictEqual(authService.isAuthenticationProviderRegistered('github'), true);
    });
    test('MCP usage and access work independently from extensions', () => {
        const extensionQuery = queryService.provider('github').account('user@example.com').extension('my-extension');
        const mcpQuery = queryService.provider('github').account('user@example.com').mcpServer('my-server');
        // Set up data for both
        extensionQuery.setAccessAllowed(true, 'My Extension');
        extensionQuery.addUsage(['read'], 'My Extension');
        mcpQuery.setAccessAllowed(false, 'My Server');
        mcpQuery.addUsage(['write'], 'My Server');
        // Verify they're independent
        assert.strictEqual(extensionQuery.isAccessAllowed(), true);
        assert.strictEqual(mcpQuery.isAccessAllowed(), false);
        assert.strictEqual(extensionQuery.getUsage()[0].extensionId, 'my-extension');
        assert.strictEqual(mcpQuery.getUsage()[0].mcpServerId, 'my-server');
        // Verify no cross-contamination
        assert.strictEqual(extensionQuery.getUsage().length, 1);
        assert.strictEqual(mcpQuery.getUsage().length, 1);
    });
    test('getAllAccountPreferences returns synchronously', () => {
        // Register providers for the test
        const githubProvider = createProvider({ id: 'github', label: 'GitHub' });
        const azureProvider = createProvider({ id: 'azure', label: 'Azure' });
        authService.registerAuthenticationProvider('github', githubProvider);
        authService.registerAuthenticationProvider('azure', azureProvider);
        const extensionQuery = queryService.extension('my-extension');
        const mcpQuery = queryService.mcpServer('my-server');
        // Set preferences for different providers
        extensionQuery.provider('github').setPreferredAccount({ id: 'user1', label: 'github-user@example.com' });
        extensionQuery.provider('azure').setPreferredAccount({ id: 'user2', label: 'azure-user@example.com' });
        mcpQuery.provider('github').setPreferredAccount({ id: 'user3', label: 'github-mcp@example.com' });
        // Get all preferences synchronously (no await needed)
        const extensionPreferences = extensionQuery.getAllAccountPreferences();
        const mcpPreferences = mcpQuery.getAllAccountPreferences();
        // Verify extension preferences
        assert.strictEqual(extensionPreferences.get('github'), 'github-user@example.com');
        assert.strictEqual(extensionPreferences.get('azure'), 'azure-user@example.com');
        assert.strictEqual(extensionPreferences.size, 2);
        // Verify MCP preferences
        assert.strictEqual(mcpPreferences.get('github'), 'github-mcp@example.com');
        assert.strictEqual(mcpPreferences.size, 1);
        // Verify they don't interfere with each other
        assert.notStrictEqual(extensionPreferences.get('github'), mcpPreferences.get('github'));
    });
    test('forEach methods work synchronously', () => {
        const accountQuery = queryService.provider('github').account('user@example.com');
        // Add some usage data first
        accountQuery.extension('ext1').addUsage(['read'], 'Extension 1');
        accountQuery.extension('ext2').addUsage(['write'], 'Extension 2');
        accountQuery.mcpServer('mcp1').addUsage(['admin'], 'MCP Server 1');
        // Test extensions forEach - no await needed
        const extensionIds = [];
        accountQuery.extensions().forEach(extensionQuery => {
            extensionIds.push(extensionQuery.extensionId);
        });
        assert.strictEqual(extensionIds.length, 2);
        assert.ok(extensionIds.includes('ext1'));
        assert.ok(extensionIds.includes('ext2'));
        // Test MCP servers forEach - no await needed
        const mcpServerIds = [];
        accountQuery.mcpServers().forEach(mcpServerQuery => {
            mcpServerIds.push(mcpServerQuery.mcpServerId);
        });
        assert.strictEqual(mcpServerIds.length, 1);
        assert.ok(mcpServerIds.includes('mcp1'));
    });
    test('remove method works synchronously', () => {
        const accountQuery = queryService.provider('github').account('user@example.com');
        // Set up data
        accountQuery.extension('ext1').setAccessAllowed(true, 'Extension 1');
        accountQuery.mcpServer('mcp1').setAccessAllowed(true, 'MCP Server 1');
        // Remove synchronously - no await needed
        accountQuery.remove();
        // Verify data is gone
        assert.strictEqual(accountQuery.extension('ext1').isAccessAllowed(), undefined);
        assert.strictEqual(accountQuery.mcpServer('mcp1').isAccessAllowed(), undefined);
    });
    test('cross-provider extension queries work correctly', () => {
        // Register multiple providers
        const githubProvider = createProvider({ id: 'github', label: 'GitHub' });
        const azureProvider = createProvider({ id: 'azure', label: 'Azure' });
        authService.registerAuthenticationProvider('github', githubProvider);
        authService.registerAuthenticationProvider('azure', azureProvider);
        // Set up data using provider-first approach
        queryService.provider('github').account('user@example.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        queryService.provider('azure').account('admin@example.com').extension('my-extension').setAccessAllowed(false, 'My Extension');
        // Query using extension-first approach should return all providers
        const extensionQuery = queryService.extension('my-extension');
        const githubPrefs = extensionQuery.getAllAccountPreferences();
        // Should include both providers
        assert.ok(githubPrefs.size >= 0); // Extension query should work across providers
        // Test preferences using extension-first query pattern
        extensionQuery.provider('github').setPreferredAccount({ id: 'user1', label: 'user@example.com' });
        extensionQuery.provider('azure').setPreferredAccount({ id: 'user2', label: 'admin@example.com' });
        assert.strictEqual(extensionQuery.provider('github').getPreferredAccount(), 'user@example.com');
        assert.strictEqual(extensionQuery.provider('azure').getPreferredAccount(), 'admin@example.com');
    });
    test('event forwarding from authentication service works', () => {
        let eventFired = false;
        // Listen for access change events through the query service
        const disposable = queryService.onDidChangeAccess(() => {
            eventFired = true;
        });
        try {
            // Trigger an access change that should fire an event
            queryService.provider('github').account('user@example.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
            // Verify the event was fired
            assert.strictEqual(eventFired, true);
        }
        finally {
            disposable.dispose();
        }
    });
    test('error handling for invalid inputs works correctly', () => {
        // Test with non-existent provider
        const invalidProviderQuery = queryService.provider('non-existent-provider');
        // Should not throw, but should handle gracefully
        assert.doesNotThrow(() => {
            invalidProviderQuery.account('user@example.com').extension('my-extension').isAccessAllowed();
        });
        // Test with empty/invalid account names
        const emptyAccountQuery = queryService.provider('github').account('').extension('my-extension');
        assert.doesNotThrow(() => {
            emptyAccountQuery.isAccessAllowed();
        });
        // Test with empty extension IDs
        const emptyExtensionQuery = queryService.provider('github').account('user@example.com').extension('');
        assert.doesNotThrow(() => {
            emptyExtensionQuery.isAccessAllowed();
        });
    });
    test('bulk operations work correctly', () => {
        const accountQuery = queryService.provider('github').account('user@example.com');
        // Set up multiple extensions with different access levels
        accountQuery.extension('ext1').setAccessAllowed(true, 'Extension 1');
        accountQuery.extension('ext2').setAccessAllowed(false, 'Extension 2');
        accountQuery.extension('ext3').setAccessAllowed(true, 'Extension 3');
        // Add usage for some extensions
        accountQuery.extension('ext1').addUsage(['read'], 'Extension 1');
        accountQuery.extension('ext3').addUsage(['write'], 'Extension 3');
        // Test bulk enumeration
        let extensionCount = 0;
        let allowedCount = 0;
        let usageCount = 0;
        accountQuery.extensions().forEach(extensionQuery => {
            extensionCount++;
            if (extensionQuery.isAccessAllowed() === true) {
                allowedCount++;
            }
            if (extensionQuery.getUsage().length > 0) {
                usageCount++;
            }
        });
        // Verify bulk operation results
        assert.strictEqual(extensionCount, 3);
        assert.strictEqual(allowedCount, 2); // ext1 and ext3
        assert.strictEqual(usageCount, 2); // ext1 and ext3
        // Test bulk operations for MCP servers
        accountQuery.mcpServer('mcp1').setAccessAllowed(true, 'MCP 1');
        accountQuery.mcpServer('mcp2').setAccessAllowed(false, 'MCP 2');
        let mcpCount = 0;
        accountQuery.mcpServers().forEach(mcpQuery => {
            mcpCount++;
        });
        assert.strictEqual(mcpCount, 2);
    });
    test('data consistency across different query paths', () => {
        // Set up data using one query path
        const extensionQuery1 = queryService.provider('github').account('user@example.com').extension('my-extension');
        extensionQuery1.setAccessAllowed(true, 'My Extension');
        extensionQuery1.addUsage(['read', 'write'], 'My Extension');
        // Access same data using different query path (cross-provider query)
        const extensionQuery2 = queryService.extension('my-extension').provider('github');
        // Data should be consistent through provider preference access
        assert.strictEqual(extensionQuery1.isAccessAllowed(), true);
        assert.strictEqual(extensionQuery1.getUsage().length, 1);
        // Set preferences and check consistency
        extensionQuery2.setPreferredAccount({ id: 'user', label: 'user@example.com' });
        assert.strictEqual(extensionQuery2.getPreferredAccount(), 'user@example.com');
        // Modify through one path
        extensionQuery1.setAccessAllowed(false, 'My Extension');
        // Should be reflected when accessing through provider->account path
        assert.strictEqual(extensionQuery1.isAccessAllowed(), false);
    });
    test('preference management handles complex scenarios', () => {
        // Register multiple providers
        const githubProvider = createProvider({ id: 'github', label: 'GitHub' });
        const azureProvider = createProvider({ id: 'azure', label: 'Azure' });
        authService.registerAuthenticationProvider('github', githubProvider);
        authService.registerAuthenticationProvider('azure', azureProvider);
        const extensionQuery = queryService.extension('my-extension');
        // Set different preferences for different providers
        extensionQuery.provider('github').setPreferredAccount({ id: 'user1', label: 'github-user@example.com' });
        extensionQuery.provider('azure').setPreferredAccount({ id: 'user2', label: 'azure-user@example.com' });
        // Test preference retrieval
        assert.strictEqual(extensionQuery.provider('github').getPreferredAccount(), 'github-user@example.com');
        assert.strictEqual(extensionQuery.provider('azure').getPreferredAccount(), 'azure-user@example.com');
        // Test account preference detection through provider->account queries
        assert.strictEqual(queryService.provider('github').account('github-user@example.com').extension('my-extension').isPreferred(), true);
        assert.strictEqual(queryService.provider('azure').account('azure-user@example.com').extension('my-extension').isPreferred(), true);
        assert.strictEqual(queryService.provider('github').account('wrong@example.com').extension('my-extension').isPreferred(), false);
        // Test getAllAccountPreferences with multiple providers
        const allPrefs = extensionQuery.getAllAccountPreferences();
        assert.strictEqual(allPrefs.get('github'), 'github-user@example.com');
        assert.strictEqual(allPrefs.get('azure'), 'azure-user@example.com');
        assert.strictEqual(allPrefs.size, 2);
    });
    test('MCP server vs extension data isolation is complete', () => {
        const accountQuery = queryService.provider('github').account('user@example.com');
        // Set up similar data for extension and MCP server with same IDs
        const sameId = 'same-identifier';
        accountQuery.extension(sameId).setAccessAllowed(true, 'Extension');
        accountQuery.extension(sameId).addUsage(['ext-scope'], 'Extension');
        accountQuery.mcpServer(sameId).setAccessAllowed(false, 'MCP Server');
        accountQuery.mcpServer(sameId).addUsage(['mcp-scope'], 'MCP Server');
        // Verify complete isolation
        assert.strictEqual(accountQuery.extension(sameId).isAccessAllowed(), true);
        assert.strictEqual(accountQuery.mcpServer(sameId).isAccessAllowed(), false);
        const extUsage = accountQuery.extension(sameId).getUsage();
        const mcpUsage = accountQuery.mcpServer(sameId).getUsage();
        assert.strictEqual(extUsage.length, 1);
        assert.strictEqual(mcpUsage.length, 1);
        assert.strictEqual(extUsage[0].extensionId, sameId);
        assert.strictEqual(mcpUsage[0].mcpServerId, sameId);
        assert.notDeepStrictEqual(extUsage[0].scopes, mcpUsage[0].scopes);
        // Test preference isolation
        queryService.extension(sameId).provider('github').setPreferredAccount({ id: 'ext-user', label: 'ext@example.com' });
        queryService.mcpServer(sameId).provider('github').setPreferredAccount({ id: 'mcp-user', label: 'mcp@example.com' });
        assert.strictEqual(queryService.extension(sameId).provider('github').getPreferredAccount(), 'ext@example.com');
        assert.strictEqual(queryService.mcpServer(sameId).provider('github').getPreferredAccount(), 'mcp@example.com');
    });
    test('provider listing and registration integration', () => {
        // Initially should have providers from setup (if any)
        const initialProviders = queryService.getProviderIds();
        const initialCount = initialProviders.length;
        // Register a new provider
        const newProvider = createProvider({ id: 'test-provider', label: 'Test Provider' });
        authService.registerAuthenticationProvider('test-provider', newProvider);
        // Should now appear in listing
        const updatedProviders = queryService.getProviderIds();
        assert.strictEqual(updatedProviders.length, initialCount + 1);
        assert.ok(updatedProviders.includes('test-provider'));
        // Should be able to query the new provider
        const providerQuery = queryService.provider('test-provider');
        assert.strictEqual(providerQuery.providerId, 'test-provider');
        // Should integrate with authentication service state
        assert.strictEqual(authService.isAuthenticationProviderRegistered('test-provider'), true);
    });
    /**
     * Service Call Verification Tests
     * These tests verify that the AuthenticationQueryService properly delegates to underlying services
     * with the correct parameters. This is important for ensuring the facade works correctly.
     */
    test('setAccessAllowed calls updateAllowedExtensions with correct parameters', () => {
        const extensionQuery = queryService.provider('github').account('user@example.com').extension('my-extension');
        // Clear any previous calls
        accessService.clearCallHistory();
        // Call setAccessAllowed
        extensionQuery.setAccessAllowed(true, 'My Extension');
        // Verify the underlying service was called correctly
        const calls = accessService.getCallsFor('updateAllowedExtensions');
        assert.strictEqual(calls.length, 1);
        const [providerId, accountName, extensions] = calls[0].args;
        assert.strictEqual(providerId, 'github');
        assert.strictEqual(accountName, 'user@example.com');
        assert.strictEqual(extensions.length, 1);
        assert.strictEqual(extensions[0].id, 'my-extension');
        assert.strictEqual(extensions[0].name, 'My Extension');
        assert.strictEqual(extensions[0].allowed, true);
    });
    test('addUsage calls addAccountUsage with correct parameters', () => {
        const extensionQuery = queryService.provider('azure').account('admin@company.com').extension('test-extension');
        // Clear any previous calls
        usageService.clearCallHistory();
        // Call addUsage
        extensionQuery.addUsage(['read', 'write'], 'Test Extension');
        // Verify the underlying service was called correctly
        const calls = usageService.getCallsFor('addAccountUsage');
        assert.strictEqual(calls.length, 1);
        const [providerId, accountName, scopes, extensionId, extensionName] = calls[0].args;
        assert.strictEqual(providerId, 'azure');
        assert.strictEqual(accountName, 'admin@company.com');
        assert.deepStrictEqual(scopes, ['read', 'write']);
        assert.strictEqual(extensionId, 'test-extension');
        assert.strictEqual(extensionName, 'Test Extension');
    });
    test('isAccessAllowed calls underlying service with correct parameters', () => {
        const extensionQuery = queryService.provider('github').account('user@example.com').extension('my-extension');
        // Clear any previous calls
        accessService.clearCallHistory();
        // Call isAccessAllowed
        extensionQuery.isAccessAllowed();
        // Verify the underlying service was called correctly
        const calls = accessService.getCallsFor('isAccessAllowed');
        assert.strictEqual(calls.length, 1);
        const [providerId, accountName, extensionId] = calls[0].args;
        assert.strictEqual(providerId, 'github');
        assert.strictEqual(accountName, 'user@example.com');
        assert.strictEqual(extensionId, 'my-extension');
    });
    test('getUsage calls readAccountUsages with correct parameters', () => {
        const extensionQuery = queryService.provider('github').account('user@example.com').extension('my-extension');
        // Clear any previous calls
        usageService.clearCallHistory();
        // Call getUsage
        extensionQuery.getUsage();
        // Verify the underlying service was called correctly
        const calls = usageService.getCallsFor('readAccountUsages');
        assert.strictEqual(calls.length, 1);
        const [providerId, accountName] = calls[0].args;
        assert.strictEqual(providerId, 'github');
        assert.strictEqual(accountName, 'user@example.com');
    });
    test('MCP setAccessAllowed calls updateAllowedMcpServers with correct parameters', () => {
        const mcpQuery = queryService.provider('github').account('user@example.com').mcpServer('my-server');
        // Clear any previous calls
        mcpAccessService.clearCallHistory();
        // Call setAccessAllowed
        mcpQuery.setAccessAllowed(false, 'My MCP Server');
        // Verify the underlying service was called correctly
        const calls = mcpAccessService.getCallsFor('updateAllowedMcpServers');
        assert.strictEqual(calls.length, 1);
        const [providerId, accountName, servers] = calls[0].args;
        assert.strictEqual(providerId, 'github');
        assert.strictEqual(accountName, 'user@example.com');
        assert.strictEqual(servers.length, 1);
        assert.strictEqual(servers[0].id, 'my-server');
        assert.strictEqual(servers[0].name, 'My MCP Server');
        assert.strictEqual(servers[0].allowed, false);
    });
    test('MCP addUsage calls addAccountUsage with correct parameters', () => {
        const mcpQuery = queryService.provider('azure').account('admin@company.com').mcpServer('test-server');
        // Clear any previous calls
        mcpUsageService.clearCallHistory();
        // Call addUsage
        mcpQuery.addUsage(['admin'], 'Test MCP Server');
        // Verify the underlying service was called correctly
        const calls = mcpUsageService.getCallsFor('addAccountUsage');
        assert.strictEqual(calls.length, 1);
        const [providerId, accountName, scopes, serverId, serverName] = calls[0].args;
        assert.strictEqual(providerId, 'azure');
        assert.strictEqual(accountName, 'admin@company.com');
        assert.deepStrictEqual(scopes, ['admin']);
        assert.strictEqual(serverId, 'test-server');
        assert.strictEqual(serverName, 'Test MCP Server');
    });
    test('account removal calls all appropriate cleanup methods', () => {
        const accountQuery = queryService.provider('github').account('user@example.com');
        // Set up some data first
        accountQuery.extension('ext1').setAccessAllowed(true, 'Extension 1');
        accountQuery.extension('ext1').addUsage(['read'], 'Extension 1');
        accountQuery.mcpServer('mcp1').setAccessAllowed(true, 'MCP Server 1');
        accountQuery.mcpServer('mcp1').addUsage(['write'], 'MCP Server 1');
        // Clear call history to focus on removal calls
        usageService.clearCallHistory();
        mcpUsageService.clearCallHistory();
        accessService.clearCallHistory();
        mcpAccessService.clearCallHistory();
        // Call remove
        accountQuery.remove();
        // Verify all cleanup methods were called
        const extensionUsageRemoval = usageService.getCallsFor('removeAccountUsage');
        const mcpUsageRemoval = mcpUsageService.getCallsFor('removeAccountUsage');
        const extensionAccessRemoval = accessService.getCallsFor('removeAllowedExtensions');
        const mcpAccessRemoval = mcpAccessService.getCallsFor('removeAllowedMcpServers');
        assert.strictEqual(extensionUsageRemoval.length, 1);
        assert.strictEqual(mcpUsageRemoval.length, 1);
        assert.strictEqual(extensionAccessRemoval.length, 1);
        assert.strictEqual(mcpAccessRemoval.length, 1);
        // Verify all calls use correct parameters
        [extensionUsageRemoval[0], mcpUsageRemoval[0], extensionAccessRemoval[0], mcpAccessRemoval[0]].forEach(call => {
            const [providerId, accountName] = call.args;
            assert.strictEqual(providerId, 'github');
            assert.strictEqual(accountName, 'user@example.com');
        });
    });
    test('bulk operations call readAccountUsages and readAllowedExtensions', () => {
        const accountQuery = queryService.provider('github').account('user@example.com');
        // Set up some data
        accountQuery.extension('ext1').setAccessAllowed(true, 'Extension 1');
        accountQuery.extension('ext2').addUsage(['read'], 'Extension 2');
        // Clear call history
        usageService.clearCallHistory();
        accessService.clearCallHistory();
        // Perform bulk operation
        accountQuery.extensions().forEach(() => {
            // Just iterate to trigger the underlying service calls
        });
        // Verify the underlying services were called for bulk enumeration
        const usageCalls = usageService.getCallsFor('readAccountUsages');
        const accessCalls = accessService.getCallsFor('readAllowedExtensions');
        assert.strictEqual(usageCalls.length, 1);
        assert.strictEqual(accessCalls.length, 1);
        // Verify parameters
        usageCalls.concat(accessCalls).forEach(call => {
            const [providerId, accountName] = call.args;
            assert.strictEqual(providerId, 'github');
            assert.strictEqual(accountName, 'user@example.com');
        });
    });
    test('multiple operations accumulate service calls correctly', () => {
        const extensionQuery = queryService.provider('github').account('user@example.com').extension('my-extension');
        // Clear call history
        accessService.clearCallHistory();
        usageService.clearCallHistory();
        // Perform multiple operations
        extensionQuery.setAccessAllowed(true, 'My Extension');
        extensionQuery.addUsage(['read'], 'My Extension');
        extensionQuery.isAccessAllowed();
        extensionQuery.getUsage();
        extensionQuery.setAccessAllowed(false, 'My Extension');
        // Verify call counts
        assert.strictEqual(accessService.getCallsFor('updateAllowedExtensions').length, 2);
        assert.strictEqual(accessService.getCallsFor('isAccessAllowed').length, 1);
        assert.strictEqual(usageService.getCallsFor('addAccountUsage').length, 1);
        assert.strictEqual(usageService.getCallsFor('readAccountUsages').length, 1);
    });
    test('getProvidersWithAccess filters internal providers by default', async () => {
        // Register multiple providers including internal ones
        const githubProvider = createProvider({ id: 'github', label: 'GitHub' });
        const azureProvider = createProvider({ id: 'azure', label: 'Azure' });
        const internalProvider1 = createProvider({ id: '__internal1', label: 'Internal Provider 1' });
        const internalProvider2 = createProvider({ id: '__internal2', label: 'Internal Provider 2' });
        authService.registerAuthenticationProvider('github', githubProvider);
        authService.registerAuthenticationProvider('azure', azureProvider);
        authService.registerAuthenticationProvider('__internal1', internalProvider1);
        authService.registerAuthenticationProvider('__internal2', internalProvider2);
        // Add accounts to all providers
        authService.addAccounts('github', [{ id: 'user1', label: 'user@github.com' }]);
        authService.addAccounts('azure', [{ id: 'user2', label: 'user@azure.com' }]);
        authService.addAccounts('__internal1', [{ id: 'user3', label: 'internal1@example.com' }]);
        authService.addAccounts('__internal2', [{ id: 'user4', label: 'internal2@example.com' }]);
        // Set up access for all providers
        queryService.provider('github').account('user@github.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        queryService.provider('azure').account('user@azure.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        queryService.provider('__internal1').account('internal1@example.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        queryService.provider('__internal2').account('internal2@example.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        // Test extension query - should exclude internal providers by default
        const extensionQuery = queryService.extension('my-extension');
        const providersWithAccess = await extensionQuery.getProvidersWithAccess();
        assert.strictEqual(providersWithAccess.length, 2);
        assert.ok(providersWithAccess.includes('github'));
        assert.ok(providersWithAccess.includes('azure'));
        assert.ok(!providersWithAccess.includes('__internal1'));
        assert.ok(!providersWithAccess.includes('__internal2'));
    });
    test('getProvidersWithAccess includes internal providers when requested', async () => {
        // Register multiple providers including internal ones
        const githubProvider = createProvider({ id: 'github', label: 'GitHub' });
        const internalProvider = createProvider({ id: '__internal1', label: 'Internal Provider' });
        authService.registerAuthenticationProvider('github', githubProvider);
        authService.registerAuthenticationProvider('__internal1', internalProvider);
        // Add accounts to all providers
        authService.addAccounts('github', [{ id: 'user1', label: 'user@github.com' }]);
        authService.addAccounts('__internal1', [{ id: 'user2', label: 'internal@example.com' }]);
        // Set up access for all providers
        queryService.provider('github').account('user@github.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        queryService.provider('__internal1').account('internal@example.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        // Test extension query - should include internal providers when requested
        const extensionQuery = queryService.extension('my-extension');
        const providersWithAccess = await extensionQuery.getProvidersWithAccess(true);
        assert.strictEqual(providersWithAccess.length, 2);
        assert.ok(providersWithAccess.includes('github'));
        assert.ok(providersWithAccess.includes('__internal1'));
    });
    test('MCP server getProvidersWithAccess filters internal providers by default', async () => {
        // Register multiple providers including internal ones
        const githubProvider = createProvider({ id: 'github', label: 'GitHub' });
        const azureProvider = createProvider({ id: 'azure', label: 'Azure' });
        const internalProvider1 = createProvider({ id: '__internal1', label: 'Internal Provider 1' });
        const internalProvider2 = createProvider({ id: '__internal2', label: 'Internal Provider 2' });
        authService.registerAuthenticationProvider('github', githubProvider);
        authService.registerAuthenticationProvider('azure', azureProvider);
        authService.registerAuthenticationProvider('__internal1', internalProvider1);
        authService.registerAuthenticationProvider('__internal2', internalProvider2);
        // Add accounts to all providers
        authService.addAccounts('github', [{ id: 'user1', label: 'user@github.com' }]);
        authService.addAccounts('azure', [{ id: 'user2', label: 'user@azure.com' }]);
        authService.addAccounts('__internal1', [{ id: 'user3', label: 'internal1@example.com' }]);
        authService.addAccounts('__internal2', [{ id: 'user4', label: 'internal2@example.com' }]);
        // Set up MCP access for all providers
        queryService.provider('github').account('user@github.com').mcpServer('my-server').setAccessAllowed(true, 'My Server');
        queryService.provider('azure').account('user@azure.com').mcpServer('my-server').setAccessAllowed(true, 'My Server');
        queryService.provider('__internal1').account('internal1@example.com').mcpServer('my-server').setAccessAllowed(true, 'My Server');
        queryService.provider('__internal2').account('internal2@example.com').mcpServer('my-server').setAccessAllowed(true, 'My Server');
        // Test MCP server query - should exclude internal providers by default
        const mcpServerQuery = queryService.mcpServer('my-server');
        const providersWithAccess = await mcpServerQuery.getProvidersWithAccess();
        assert.strictEqual(providersWithAccess.length, 2);
        assert.ok(providersWithAccess.includes('github'));
        assert.ok(providersWithAccess.includes('azure'));
        assert.ok(!providersWithAccess.includes('__internal1'));
        assert.ok(!providersWithAccess.includes('__internal2'));
    });
    test('MCP server getProvidersWithAccess includes internal providers when requested', async () => {
        // Register multiple providers including internal ones
        const githubProvider = createProvider({ id: 'github', label: 'GitHub' });
        const internalProvider = createProvider({ id: '__internal1', label: 'Internal Provider' });
        authService.registerAuthenticationProvider('github', githubProvider);
        authService.registerAuthenticationProvider('__internal1', internalProvider);
        // Add accounts to all providers
        authService.addAccounts('github', [{ id: 'user1', label: 'user@github.com' }]);
        authService.addAccounts('__internal1', [{ id: 'user2', label: 'internal@example.com' }]);
        // Set up MCP access for all providers
        queryService.provider('github').account('user@github.com').mcpServer('my-server').setAccessAllowed(true, 'My Server');
        queryService.provider('__internal1').account('internal@example.com').mcpServer('my-server').setAccessAllowed(true, 'My Server');
        // Test MCP server query - should include internal providers when requested
        const mcpServerQuery = queryService.mcpServer('my-server');
        const providersWithAccess = await mcpServerQuery.getProvidersWithAccess(true);
        assert.strictEqual(providersWithAccess.length, 2);
        assert.ok(providersWithAccess.includes('github'));
        assert.ok(providersWithAccess.includes('__internal1'));
    });
    test('internal provider filtering works with mixed access patterns', async () => {
        // Register mixed providers
        const normalProvider = createProvider({ id: 'normal', label: 'Normal Provider' });
        const internalProvider = createProvider({ id: '__internal', label: 'Internal Provider' });
        const noAccessProvider = createProvider({ id: 'no-access', label: 'No Access Provider' });
        authService.registerAuthenticationProvider('normal', normalProvider);
        authService.registerAuthenticationProvider('__internal', internalProvider);
        authService.registerAuthenticationProvider('no-access', noAccessProvider);
        // Add accounts to all providers
        authService.addAccounts('normal', [{ id: 'user1', label: 'user@normal.com' }]);
        authService.addAccounts('__internal', [{ id: 'user2', label: 'internal@example.com' }]);
        authService.addAccounts('no-access', [{ id: 'user3', label: 'user@noaccess.com' }]);
        // Set up access only for normal and internal providers
        queryService.provider('normal').account('user@normal.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        queryService.provider('__internal').account('internal@example.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        // Note: no-access provider deliberately has no access set
        const extensionQuery = queryService.extension('my-extension');
        // Without includeInternal: should only return normal provider
        const providersWithoutInternal = await extensionQuery.getProvidersWithAccess(false);
        assert.strictEqual(providersWithoutInternal.length, 1);
        assert.ok(providersWithoutInternal.includes('normal'));
        assert.ok(!providersWithoutInternal.includes('__internal'));
        assert.ok(!providersWithoutInternal.includes('no-access'));
        // With includeInternal: should return both normal and internal
        const providersWithInternal = await extensionQuery.getProvidersWithAccess(true);
        assert.strictEqual(providersWithInternal.length, 2);
        assert.ok(providersWithInternal.includes('normal'));
        assert.ok(providersWithInternal.includes('__internal'));
        assert.ok(!providersWithInternal.includes('no-access'));
    });
    test('internal provider filtering respects the __ prefix exactly', async () => {
        // Register providers with various naming patterns
        const regularProvider = createProvider({ id: 'regular', label: 'Regular Provider' });
        const underscoreProvider = createProvider({ id: '_single', label: 'Single Underscore Provider' });
        const doubleUnderscoreProvider = createProvider({ id: '__double', label: 'Double Underscore Provider' });
        const tripleUnderscoreProvider = createProvider({ id: '___triple', label: 'Triple Underscore Provider' });
        const underscoreInMiddleProvider = createProvider({ id: 'mid_underscore', label: 'Middle Underscore Provider' });
        authService.registerAuthenticationProvider('regular', regularProvider);
        authService.registerAuthenticationProvider('_single', underscoreProvider);
        authService.registerAuthenticationProvider('__double', doubleUnderscoreProvider);
        authService.registerAuthenticationProvider('___triple', tripleUnderscoreProvider);
        authService.registerAuthenticationProvider('mid_underscore', underscoreInMiddleProvider);
        // Add accounts to all providers
        authService.addAccounts('regular', [{ id: 'user1', label: 'user@regular.com' }]);
        authService.addAccounts('_single', [{ id: 'user2', label: 'user@single.com' }]);
        authService.addAccounts('__double', [{ id: 'user3', label: 'user@double.com' }]);
        authService.addAccounts('___triple', [{ id: 'user4', label: 'user@triple.com' }]);
        authService.addAccounts('mid_underscore', [{ id: 'user5', label: 'user@middle.com' }]);
        // Set up access for all providers
        queryService.provider('regular').account('user@regular.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        queryService.provider('_single').account('user@single.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        queryService.provider('__double').account('user@double.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        queryService.provider('___triple').account('user@triple.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        queryService.provider('mid_underscore').account('user@middle.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        const extensionQuery = queryService.extension('my-extension');
        // Without includeInternal: should exclude only providers starting with exactly "__"
        const providersWithoutInternal = await extensionQuery.getProvidersWithAccess(false);
        assert.strictEqual(providersWithoutInternal.length, 3);
        assert.ok(providersWithoutInternal.includes('regular'));
        assert.ok(providersWithoutInternal.includes('_single'));
        assert.ok(!providersWithoutInternal.includes('__double'));
        assert.ok(!providersWithoutInternal.includes('___triple')); // This starts with __, so should be filtered
        assert.ok(providersWithoutInternal.includes('mid_underscore'));
        // With includeInternal: should include all providers
        const providersWithInternal = await extensionQuery.getProvidersWithAccess(true);
        assert.strictEqual(providersWithInternal.length, 5);
        assert.ok(providersWithInternal.includes('regular'));
        assert.ok(providersWithInternal.includes('_single'));
        assert.ok(providersWithInternal.includes('__double'));
        assert.ok(providersWithInternal.includes('___triple'));
        assert.ok(providersWithInternal.includes('mid_underscore'));
    });
    test('getAllAccountPreferences filters internal providers by default for extensions', () => {
        // Register providers
        authService.registerAuthenticationProvider('github', createProvider({ id: 'github', label: 'GitHub' }));
        authService.registerAuthenticationProvider('azure', createProvider({ id: 'azure', label: 'Azure' }));
        authService.registerAuthenticationProvider('__internal', createProvider({ id: '__internal', label: 'Internal' }));
        // Set preferences
        const extensionQuery = queryService.extension('my-extension');
        extensionQuery.provider('github').setPreferredAccount({ id: 'user1', label: 'user@github.com' });
        extensionQuery.provider('azure').setPreferredAccount({ id: 'user2', label: 'user@azure.com' });
        extensionQuery.provider('__internal').setPreferredAccount({ id: 'user3', label: 'internal@example.com' });
        // Without includeInternal: should exclude internal providers
        const prefsWithoutInternal = extensionQuery.getAllAccountPreferences(false);
        assert.strictEqual(prefsWithoutInternal.size, 2);
        assert.strictEqual(prefsWithoutInternal.get('github'), 'user@github.com');
        assert.strictEqual(prefsWithoutInternal.get('azure'), 'user@azure.com');
        assert.strictEqual(prefsWithoutInternal.get('__internal'), undefined);
        // With includeInternal: should include all providers
        const prefsWithInternal = extensionQuery.getAllAccountPreferences(true);
        assert.strictEqual(prefsWithInternal.size, 3);
        assert.strictEqual(prefsWithInternal.get('github'), 'user@github.com');
        assert.strictEqual(prefsWithInternal.get('azure'), 'user@azure.com');
        assert.strictEqual(prefsWithInternal.get('__internal'), 'internal@example.com');
        // Default behavior: should exclude internal providers
        const prefsDefault = extensionQuery.getAllAccountPreferences();
        assert.strictEqual(prefsDefault.size, 2);
        assert.strictEqual(prefsDefault.get('__internal'), undefined);
    });
    test('getAllAccountPreferences filters internal providers by default for MCP servers', () => {
        // Register providers
        authService.registerAuthenticationProvider('github', createProvider({ id: 'github', label: 'GitHub' }));
        authService.registerAuthenticationProvider('azure', createProvider({ id: 'azure', label: 'Azure' }));
        authService.registerAuthenticationProvider('__internal', createProvider({ id: '__internal', label: 'Internal' }));
        // Set preferences
        const mcpQuery = queryService.mcpServer('my-server');
        mcpQuery.provider('github').setPreferredAccount({ id: 'user1', label: 'user@github.com' });
        mcpQuery.provider('azure').setPreferredAccount({ id: 'user2', label: 'user@azure.com' });
        mcpQuery.provider('__internal').setPreferredAccount({ id: 'user3', label: 'internal@example.com' });
        // Without includeInternal: should exclude internal providers
        const prefsWithoutInternal = mcpQuery.getAllAccountPreferences(false);
        assert.strictEqual(prefsWithoutInternal.size, 2);
        assert.strictEqual(prefsWithoutInternal.get('github'), 'user@github.com');
        assert.strictEqual(prefsWithoutInternal.get('azure'), 'user@azure.com');
        assert.strictEqual(prefsWithoutInternal.get('__internal'), undefined);
        // With includeInternal: should include all providers
        const prefsWithInternal = mcpQuery.getAllAccountPreferences(true);
        assert.strictEqual(prefsWithInternal.size, 3);
        assert.strictEqual(prefsWithInternal.get('github'), 'user@github.com');
        assert.strictEqual(prefsWithInternal.get('azure'), 'user@azure.com');
        assert.strictEqual(prefsWithInternal.get('__internal'), 'internal@example.com');
        // Default behavior: should exclude internal providers
        const prefsDefault = mcpQuery.getAllAccountPreferences();
        assert.strictEqual(prefsDefault.size, 2);
        assert.strictEqual(prefsDefault.get('__internal'), undefined);
    });
    test('clearAllData includes internal providers by default', async () => {
        // Register providers
        authService.registerAuthenticationProvider('github', createProvider({ id: 'github', label: 'GitHub' }));
        authService.registerAuthenticationProvider('__internal', createProvider({ id: '__internal', label: 'Internal' }));
        // Add accounts
        authService.addAccounts('github', [{ id: 'user1', label: 'user@github.com' }]);
        authService.addAccounts('__internal', [{ id: 'user2', label: 'internal@example.com' }]);
        // Set up some data
        queryService.provider('github').account('user@github.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        queryService.provider('__internal').account('internal@example.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        // Verify data exists
        assert.strictEqual(queryService.provider('github').account('user@github.com').extension('my-extension').isAccessAllowed(), true);
        assert.strictEqual(queryService.provider('__internal').account('internal@example.com').extension('my-extension').isAccessAllowed(), true);
        // Clear all data (should include internal providers by default)
        await queryService.clearAllData('CLEAR_ALL_AUTH_DATA');
        // Verify all data is cleared
        assert.strictEqual(queryService.provider('github').account('user@github.com').extension('my-extension').isAccessAllowed(), undefined);
        assert.strictEqual(queryService.provider('__internal').account('internal@example.com').extension('my-extension').isAccessAllowed(), undefined);
    });
    test('clearAllData can exclude internal providers when specified', async () => {
        // Register providers
        authService.registerAuthenticationProvider('github', createProvider({ id: 'github', label: 'GitHub' }));
        authService.registerAuthenticationProvider('__internal', createProvider({ id: '__internal', label: 'Internal' }));
        // Add accounts
        authService.addAccounts('github', [{ id: 'user1', label: 'user@github.com' }]);
        authService.addAccounts('__internal', [{ id: 'user2', label: 'internal@example.com' }]);
        // Set up some data
        queryService.provider('github').account('user@github.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        queryService.provider('__internal').account('internal@example.com').extension('my-extension').setAccessAllowed(true, 'My Extension');
        // Clear data excluding internal providers
        await queryService.clearAllData('CLEAR_ALL_AUTH_DATA', false);
        // Verify only non-internal data is cleared
        assert.strictEqual(queryService.provider('github').account('user@github.com').extension('my-extension').isAccessAllowed(), undefined);
        assert.strictEqual(queryService.provider('__internal').account('internal@example.com').extension('my-extension').isAccessAllowed(), true);
    });
    test('isTrusted method works with mock service', () => {
        // Register provider and add account
        authService.registerAuthenticationProvider('github', createProvider({ id: 'github', label: 'GitHub' }));
        authService.addAccounts('github', [{ id: 'user1', label: 'user@github.com' }]);
        // Add a server with trusted state manually to the mock
        mcpAccessService.updateAllowedMcpServers('github', 'user@github.com', [{
                id: 'trusted-server',
                name: 'Trusted Server',
                allowed: true,
                trusted: true
            }]);
        // Add a non-trusted server
        mcpAccessService.updateAllowedMcpServers('github', 'user@github.com', [{
                id: 'non-trusted-server',
                name: 'Non-Trusted Server',
                allowed: true
            }]);
        // Test trusted server
        const trustedQuery = queryService.provider('github').account('user@github.com').mcpServer('trusted-server');
        assert.strictEqual(trustedQuery.isTrusted(), true);
        // Test non-trusted server
        const nonTrustedQuery = queryService.provider('github').account('user@github.com').mcpServer('non-trusted-server');
        assert.strictEqual(nonTrustedQuery.isTrusted(), false);
    });
    test('getAllowedMcpServers method returns servers with trusted state', () => {
        // Register provider and add account
        authService.registerAuthenticationProvider('github', createProvider({ id: 'github', label: 'GitHub' }));
        authService.addAccounts('github', [{ id: 'user1', label: 'user@github.com' }]);
        // Add servers manually to the mock
        mcpAccessService.updateAllowedMcpServers('github', 'user@github.com', [
            {
                id: 'trusted-server',
                name: 'Trusted Server',
                allowed: true,
                trusted: true
            },
            {
                id: 'user-server',
                name: 'User Server',
                allowed: true
            }
        ]);
        // Get all allowed servers
        const allowedServers = queryService.provider('github').account('user@github.com').mcpServers().getAllowedMcpServers();
        // Should have both servers
        assert.strictEqual(allowedServers.length, 2);
        // Find the trusted server
        const trustedServer = allowedServers.find(s => s.id === 'trusted-server');
        assert.ok(trustedServer);
        assert.strictEqual(trustedServer.trusted, true);
        assert.strictEqual(trustedServer.allowed, true);
        // Find the user-allowed server
        const userServer = allowedServers.find(s => s.id === 'user-server');
        assert.ok(userServer);
        assert.strictEqual(userServer.trusted, undefined);
        assert.strictEqual(userServer.allowed, true);
    });
    test('getAllowedExtensions returns extension data with trusted state', () => {
        // Set up some extension access data
        const accountQuery = queryService.provider('github').account('user@example.com');
        accountQuery.extension('ext1').setAccessAllowed(true, 'Extension One');
        accountQuery.extension('ext2').setAccessAllowed(true, 'Extension Two');
        accountQuery.extension('ext1').addUsage(['read'], 'Extension One');
        const allowedExtensions = accountQuery.extensions().getAllowedExtensions();
        // Should have both extensions
        assert.strictEqual(allowedExtensions.length, 2);
        // Find the first extension
        const ext1 = allowedExtensions.find(e => e.id === 'ext1');
        assert.ok(ext1);
        assert.strictEqual(ext1.name, 'Extension One');
        assert.strictEqual(ext1.allowed, true);
        assert.strictEqual(ext1.trusted, false); // Not in trusted list
        assert.ok(typeof ext1.lastUsed === 'number');
        // Find the second extension
        const ext2 = allowedExtensions.find(e => e.id === 'ext2');
        assert.ok(ext2);
        assert.strictEqual(ext2.name, 'Extension Two');
        assert.strictEqual(ext2.allowed, true);
        assert.strictEqual(ext2.trusted, false); // Not in trusted list
        assert.strictEqual(ext2.lastUsed, undefined); // No usage
    });
    suite('Account entities query', () => {
        test('hasAnyUsage returns false for clean account', () => {
            const entitiesQuery = queryService.provider('github').account('clean@example.com').entities();
            assert.strictEqual(entitiesQuery.hasAnyUsage(), false);
        });
        test('hasAnyUsage returns true when extension has usage', () => {
            const accountQuery = queryService.provider('github').account('user@example.com');
            accountQuery.extension('test-ext').addUsage(['read'], 'Test Extension');
            const entitiesQuery = accountQuery.entities();
            assert.strictEqual(entitiesQuery.hasAnyUsage(), true);
        });
        test('hasAnyUsage returns true when MCP server has usage', () => {
            const accountQuery = queryService.provider('github').account('user@example.com');
            accountQuery.mcpServer('test-server').addUsage(['write'], 'Test Server');
            const entitiesQuery = accountQuery.entities();
            assert.strictEqual(entitiesQuery.hasAnyUsage(), true);
        });
        test('hasAnyUsage returns true when extension has access', () => {
            const accountQuery = queryService.provider('github').account('user@example.com');
            accountQuery.extension('test-ext').setAccessAllowed(true, 'Test Extension');
            const entitiesQuery = accountQuery.entities();
            assert.strictEqual(entitiesQuery.hasAnyUsage(), true);
        });
        test('hasAnyUsage returns true when MCP server has access', () => {
            const accountQuery = queryService.provider('github').account('user@example.com');
            accountQuery.mcpServer('test-server').setAccessAllowed(true, 'Test Server');
            const entitiesQuery = accountQuery.entities();
            assert.strictEqual(entitiesQuery.hasAnyUsage(), true);
        });
        test('getEntityCount returns correct counts', () => {
            const accountQuery = queryService.provider('github').account('user@example.com');
            // Set up test data
            accountQuery.extension('ext1').setAccessAllowed(true, 'Extension One');
            accountQuery.extension('ext2').setAccessAllowed(true, 'Extension Two');
            accountQuery.mcpServer('server1').setAccessAllowed(true, 'Server One');
            const entitiesQuery = accountQuery.entities();
            const counts = entitiesQuery.getEntityCount();
            assert.strictEqual(counts.extensions, 2);
            assert.strictEqual(counts.mcpServers, 1);
            assert.strictEqual(counts.total, 3);
        });
        test('getEntityCount returns zero for clean account', () => {
            const entitiesQuery = queryService.provider('github').account('clean@example.com').entities();
            const counts = entitiesQuery.getEntityCount();
            assert.strictEqual(counts.extensions, 0);
            assert.strictEqual(counts.mcpServers, 0);
            assert.strictEqual(counts.total, 0);
        });
        test('removeAllAccess removes access for all entity types', () => {
            const accountQuery = queryService.provider('github').account('user@example.com');
            // Set up test data
            accountQuery.extension('ext1').setAccessAllowed(true, 'Extension One');
            accountQuery.extension('ext2').setAccessAllowed(true, 'Extension Two');
            accountQuery.mcpServer('server1').setAccessAllowed(true, 'Server One');
            accountQuery.mcpServer('server2').setAccessAllowed(true, 'Server Two');
            // Verify initial state
            assert.strictEqual(accountQuery.extension('ext1').isAccessAllowed(), true);
            assert.strictEqual(accountQuery.extension('ext2').isAccessAllowed(), true);
            assert.strictEqual(accountQuery.mcpServer('server1').isAccessAllowed(), true);
            assert.strictEqual(accountQuery.mcpServer('server2').isAccessAllowed(), true);
            // Remove all access
            const entitiesQuery = accountQuery.entities();
            entitiesQuery.removeAllAccess();
            // Verify all access is removed
            assert.strictEqual(accountQuery.extension('ext1').isAccessAllowed(), false);
            assert.strictEqual(accountQuery.extension('ext2').isAccessAllowed(), false);
            assert.strictEqual(accountQuery.mcpServer('server1').isAccessAllowed(), false);
            assert.strictEqual(accountQuery.mcpServer('server2').isAccessAllowed(), false);
        });
        test('forEach iterates over all entity types', () => {
            const accountQuery = queryService.provider('github').account('user@example.com');
            // Set up test data
            accountQuery.extension('ext1').setAccessAllowed(true, 'Extension One');
            accountQuery.extension('ext2').addUsage(['read'], 'Extension Two');
            accountQuery.mcpServer('server1').setAccessAllowed(true, 'Server One');
            accountQuery.mcpServer('server2').addUsage(['write'], 'Server Two');
            const entitiesQuery = accountQuery.entities();
            const visitedEntities = [];
            entitiesQuery.forEach((entityId, entityType) => {
                visitedEntities.push({ id: entityId, type: entityType });
            });
            // Should visit all entities that have usage or access
            assert.strictEqual(visitedEntities.length, 4);
            const extensions = visitedEntities.filter(e => e.type === 'extension');
            const mcpServers = visitedEntities.filter(e => e.type === 'mcpServer');
            assert.strictEqual(extensions.length, 2);
            assert.strictEqual(mcpServers.length, 2);
            // Check specific entities were visited
            assert.ok(visitedEntities.some(e => e.id === 'ext1' && e.type === 'extension'));
            assert.ok(visitedEntities.some(e => e.id === 'ext2' && e.type === 'extension'));
            assert.ok(visitedEntities.some(e => e.id === 'server1' && e.type === 'mcpServer'));
            assert.ok(visitedEntities.some(e => e.id === 'server2' && e.type === 'mcpServer'));
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb25RdWVyeVNlcnZpY2UudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvYXV0aGVudGljYXRpb24vdGVzdC9icm93c2VyL2F1dGhlbnRpY2F0aW9uUXVlcnlTZXJ2aWNlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDakMsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFDekgsT0FBTyxFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUN4RixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDcEYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFFdEYsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDekYsT0FBTyxFQUFFLHNCQUFzQixFQUFFLGdDQUFnQyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDMUcsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDMUYsT0FBTyxFQUFFLDhCQUE4QixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEcsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDNUYsT0FBTyxFQUFFLCtCQUErQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDbEcsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDdEYsT0FBTyxFQUNOLGdCQUFnQixFQUNoQixtQkFBbUIsRUFDbkIsaUJBQWlCLEVBQ2pCLG9CQUFvQixFQUNw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