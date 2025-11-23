/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { TestStorageService, TestProductService } from '../../../../test/common/workbenchTestServices.js';
import { AuthenticationMcpAccessService } from '../../browser/authenticationMcpAccessService.js';
suite('AuthenticationMcpAccessService', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let storageService;
    let productService;
    let authenticationMcpAccessService;
    setup(() => {
        instantiationService = disposables.add(new TestInstantiationService());
        // Set up storage service
        storageService = disposables.add(new TestStorageService());
        instantiationService.stub(IStorageService, storageService);
        // Set up product service with no trusted servers by default
        productService = { ...TestProductService };
        instantiationService.stub(IProductService, productService);
        // Create the service instance
        authenticationMcpAccessService = disposables.add(instantiationService.createInstance(AuthenticationMcpAccessService));
    });
    suite('isAccessAllowed', () => {
        test('returns undefined for unknown MCP server with no product configuration', () => {
            const result = authenticationMcpAccessService.isAccessAllowed('github', 'user@example.com', 'unknown-server');
            assert.strictEqual(result, undefined);
        });
        test('returns true for trusted MCP server from product.json (array format)', () => {
            productService.trustedMcpAuthAccess = ['trusted-server-1', 'trusted-server-2'];
            const result = authenticationMcpAccessService.isAccessAllowed('github', 'user@example.com', 'trusted-server-1');
            assert.strictEqual(result, true);
        });
        test('returns true for trusted MCP server from product.json (object format)', () => {
            productService.trustedMcpAuthAccess = {
                'github': ['github-server'],
                'microsoft': ['microsoft-server']
            };
            const result1 = authenticationMcpAccessService.isAccessAllowed('github', 'user@example.com', 'github-server');
            assert.strictEqual(result1, true);
            const result2 = authenticationMcpAccessService.isAccessAllowed('microsoft', 'user@microsoft.com', 'microsoft-server');
            assert.strictEqual(result2, true);
        });
        test('returns undefined for MCP server not in trusted list', () => {
            productService.trustedMcpAuthAccess = ['trusted-server'];
            const result = authenticationMcpAccessService.isAccessAllowed('github', 'user@example.com', 'untrusted-server');
            assert.strictEqual(result, undefined);
        });
        test('returns stored allowed state when server is in storage', () => {
            // Add server to storage
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [{
                    id: 'stored-server',
                    name: 'Stored Server',
                    allowed: false
                }]);
            const result = authenticationMcpAccessService.isAccessAllowed('github', 'user@example.com', 'stored-server');
            assert.strictEqual(result, false);
        });
        test('returns true for server in storage with allowed=true', () => {
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [{
                    id: 'allowed-server',
                    name: 'Allowed Server',
                    allowed: true
                }]);
            const result = authenticationMcpAccessService.isAccessAllowed('github', 'user@example.com', 'allowed-server');
            assert.strictEqual(result, true);
        });
        test('returns true for server in storage with undefined allowed property (legacy behavior)', () => {
            // Simulate legacy data where allowed property didn't exist
            const legacyServer = {
                id: 'legacy-server',
                name: 'Legacy Server'
                // allowed property is undefined
            };
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [legacyServer]);
            const result = authenticationMcpAccessService.isAccessAllowed('github', 'user@example.com', 'legacy-server');
            assert.strictEqual(result, true);
        });
        test('product.json trusted servers take precedence over storage', () => {
            productService.trustedMcpAuthAccess = ['product-trusted-server'];
            // Try to store the same server as not allowed
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [{
                    id: 'product-trusted-server',
                    name: 'Product Trusted Server',
                    allowed: false
                }]);
            // Product.json should take precedence
            const result = authenticationMcpAccessService.isAccessAllowed('github', 'user@example.com', 'product-trusted-server');
            assert.strictEqual(result, true);
        });
    });
    suite('readAllowedMcpServers', () => {
        test('returns empty array when no data exists', () => {
            const result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 0);
        });
        test('returns stored MCP servers', () => {
            const servers = [
                { id: 'server1', name: 'Server 1', allowed: true },
                { id: 'server2', name: 'Server 2', allowed: false }
            ];
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', servers);
            const result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].id, 'server1');
            assert.strictEqual(result[0].allowed, true);
            assert.strictEqual(result[1].id, 'server2');
            assert.strictEqual(result[1].allowed, false);
        });
        test('includes trusted servers from product.json (array format)', () => {
            productService.trustedMcpAuthAccess = ['trusted-server-1', 'trusted-server-2'];
            const result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 2);
            const trustedServer1 = result.find(s => s.id === 'trusted-server-1');
            assert.ok(trustedServer1);
            assert.strictEqual(trustedServer1.allowed, true);
            assert.strictEqual(trustedServer1.trusted, true);
            assert.strictEqual(trustedServer1.name, 'trusted-server-1'); // Should default to ID
            const trustedServer2 = result.find(s => s.id === 'trusted-server-2');
            assert.ok(trustedServer2);
            assert.strictEqual(trustedServer2.allowed, true);
            assert.strictEqual(trustedServer2.trusted, true);
        });
        test('includes trusted servers from product.json (object format)', () => {
            productService.trustedMcpAuthAccess = {
                'github': ['github-server'],
                'microsoft': ['microsoft-server']
            };
            const githubResult = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(githubResult.length, 1);
            assert.strictEqual(githubResult[0].id, 'github-server');
            assert.strictEqual(githubResult[0].trusted, true);
            const microsoftResult = authenticationMcpAccessService.readAllowedMcpServers('microsoft', 'user@microsoft.com');
            assert.strictEqual(microsoftResult.length, 1);
            assert.strictEqual(microsoftResult[0].id, 'microsoft-server');
            assert.strictEqual(microsoftResult[0].trusted, true);
            // Provider not in trusted list should return empty (no stored servers)
            const unknownResult = authenticationMcpAccessService.readAllowedMcpServers('unknown', 'user@unknown.com');
            assert.strictEqual(unknownResult.length, 0);
        });
        test('merges stored servers with trusted servers from product.json', () => {
            productService.trustedMcpAuthAccess = ['trusted-server'];
            // Add some stored servers
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                { id: 'stored-server', name: 'Stored Server', allowed: false }
            ]);
            const result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 2);
            const trustedServer = result.find(s => s.id === 'trusted-server');
            assert.ok(trustedServer);
            assert.strictEqual(trustedServer.trusted, true);
            assert.strictEqual(trustedServer.allowed, true);
            const storedServer = result.find(s => s.id === 'stored-server');
            assert.ok(storedServer);
            assert.strictEqual(storedServer.trusted, undefined);
            assert.strictEqual(storedServer.allowed, false);
        });
        test('updates existing stored server to be trusted when it appears in product.json', () => {
            // First add a server as stored (not trusted)
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                { id: 'server-1', name: 'Server 1', allowed: false }
            ]);
            // Then make it trusted via product.json
            productService.trustedMcpAuthAccess = ['server-1'];
            const result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 1);
            const server = result[0];
            assert.strictEqual(server.id, 'server-1');
            assert.strictEqual(server.allowed, true); // Should be overridden to true
            assert.strictEqual(server.trusted, true); // Should be marked as trusted
            assert.strictEqual(server.name, 'Server 1'); // Should keep existing name
        });
        test('handles malformed JSON in storage gracefully', () => {
            // Manually corrupt the storage
            storageService.store('mcpserver-github-user@example.com', 'invalid json', -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
            // Should return empty array instead of throwing
            const result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 0);
        });
        test('handles non-array product.json configuration gracefully', () => {
            // Set up invalid configuration
            // eslint-disable-next-line local/code-no-any-casts
            productService.trustedMcpAuthAccess = 'invalid-string';
            const result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 0);
        });
    });
    suite('updateAllowedMcpServers', () => {
        test('stores new MCP servers', () => {
            const servers = [
                { id: 'server1', name: 'Server 1', allowed: true },
                { id: 'server2', name: 'Server 2', allowed: false }
            ];
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', servers);
            const result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].id, 'server1');
            assert.strictEqual(result[1].id, 'server2');
        });
        test('updates existing MCP server allowed status', () => {
            // First add a server
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                { id: 'server1', name: 'Server 1', allowed: true }
            ]);
            // Then update its allowed status
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                { id: 'server1', name: 'Server 1', allowed: false }
            ]);
            const result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].allowed, false);
        });
        test('updates existing MCP server name when new name is provided', () => {
            // First add a server with default name
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                { id: 'server1', name: 'server1', allowed: true }
            ]);
            // Then update with a proper name
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                { id: 'server1', name: 'My Server', allowed: true }
            ]);
            const result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'My Server');
        });
        test('does not update name when new name is same as ID', () => {
            // First add a server with a proper name
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                { id: 'server1', name: 'My Server', allowed: true }
            ]);
            // Then try to update with ID as name (should keep existing name)
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                { id: 'server1', name: 'server1', allowed: false }
            ]);
            const result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'My Server'); // Should keep original name
            assert.strictEqual(result[0].allowed, false); // But allowed status should update
        });
        test('adds new servers while preserving existing ones', () => {
            // First add one server
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                { id: 'server1', name: 'Server 1', allowed: true }
            ]);
            // Then add another server
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                { id: 'server2', name: 'Server 2', allowed: false }
            ]);
            const result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 2);
            const server1 = result.find(s => s.id === 'server1');
            const server2 = result.find(s => s.id === 'server2');
            assert.ok(server1);
            assert.ok(server2);
            assert.strictEqual(server1.allowed, true);
            assert.strictEqual(server2.allowed, false);
        });
        test('does not store trusted servers from product.json', () => {
            productService.trustedMcpAuthAccess = ['trusted-server'];
            // Try to update a trusted server
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                { id: 'trusted-server', name: 'Trusted Server', allowed: false, trusted: true },
                { id: 'user-server', name: 'User Server', allowed: true }
            ]);
            // Check what's actually stored in storage (not including product.json servers)
            const storageKey = 'mcpserver-github-user@example.com';
            const storedData = JSON.parse(storageService.get(storageKey, -1 /* StorageScope.APPLICATION */) || '[]');
            // Should only contain the user-managed server, not the trusted one
            assert.strictEqual(storedData.length, 1);
            assert.strictEqual(storedData[0].id, 'user-server');
            // But readAllowedMcpServers should return both (including trusted from product.json)
            const allServers = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(allServers.length, 2);
        });
        test('fires onDidChangeMcpSessionAccess event', () => {
            let eventFired = false;
            let eventData;
            const disposable = authenticationMcpAccessService.onDidChangeMcpSessionAccess(event => {
                eventFired = true;
                eventData = event;
            });
            try {
                authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                    { id: 'server1', name: 'Server 1', allowed: true }
                ]);
                assert.strictEqual(eventFired, true);
                assert.ok(eventData);
                assert.strictEqual(eventData.providerId, 'github');
                assert.strictEqual(eventData.accountName, 'user@example.com');
            }
            finally {
                disposable.dispose();
            }
        });
    });
    suite('removeAllowedMcpServers', () => {
        test('removes all stored MCP servers for account', () => {
            // First add some servers
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                { id: 'server1', name: 'Server 1', allowed: true },
                { id: 'server2', name: 'Server 2', allowed: false }
            ]);
            // Verify they exist
            let result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 2);
            // Remove them
            authenticationMcpAccessService.removeAllowedMcpServers('github', 'user@example.com');
            // Verify they're gone
            result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 0);
        });
        test('does not affect trusted servers from product.json', () => {
            productService.trustedMcpAuthAccess = ['trusted-server'];
            // Add some user-managed servers
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                { id: 'user-server', name: 'User Server', allowed: true }
            ]);
            // Verify both trusted and user servers exist
            let result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 2);
            // Remove user servers
            authenticationMcpAccessService.removeAllowedMcpServers('github', 'user@example.com');
            // Should still have trusted server
            result = authenticationMcpAccessService.readAllowedMcpServers('github', 'user@example.com');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, 'trusted-server');
            assert.strictEqual(result[0].trusted, true);
        });
        test('fires onDidChangeMcpSessionAccess event', () => {
            let eventFired = false;
            let eventData;
            const disposable = authenticationMcpAccessService.onDidChangeMcpSessionAccess(event => {
                eventFired = true;
                eventData = event;
            });
            try {
                authenticationMcpAccessService.removeAllowedMcpServers('github', 'user@example.com');
                assert.strictEqual(eventFired, true);
                assert.ok(eventData);
                assert.strictEqual(eventData.providerId, 'github');
                assert.strictEqual(eventData.accountName, 'user@example.com');
            }
            finally {
                disposable.dispose();
            }
        });
        test('handles removal of non-existent data gracefully', () => {
            // Should not throw when trying to remove data that doesn't exist
            assert.doesNotThrow(() => {
                authenticationMcpAccessService.removeAllowedMcpServers('nonexistent', 'user@example.com');
            });
        });
    });
    suite('onDidChangeMcpSessionAccess event', () => {
        test('event is fired for each update operation', () => {
            const events = [];
            const disposable = authenticationMcpAccessService.onDidChangeMcpSessionAccess(event => {
                events.push(event);
            });
            try {
                // Should fire for update
                authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                    { id: 'server1', name: 'Server 1', allowed: true }
                ]);
                // Should fire for remove
                authenticationMcpAccessService.removeAllowedMcpServers('github', 'user@example.com');
                // Should fire for different account
                authenticationMcpAccessService.updateAllowedMcpServers('microsoft', 'admin@company.com', [
                    { id: 'server2', name: 'Server 2', allowed: false }
                ]);
                assert.strictEqual(events.length, 3);
                assert.strictEqual(events[0].providerId, 'github');
                assert.strictEqual(events[0].accountName, 'user@example.com');
                assert.strictEqual(events[1].providerId, 'github');
                assert.strictEqual(events[1].accountName, 'user@example.com');
                assert.strictEqual(events[2].providerId, 'microsoft');
                assert.strictEqual(events[2].accountName, 'admin@company.com');
            }
            finally {
                disposable.dispose();
            }
        });
        test('multiple listeners receive events', () => {
            let listener1Fired = false;
            let listener2Fired = false;
            const disposable1 = authenticationMcpAccessService.onDidChangeMcpSessionAccess(() => {
                listener1Fired = true;
            });
            const disposable2 = authenticationMcpAccessService.onDidChangeMcpSessionAccess(() => {
                listener2Fired = true;
            });
            try {
                authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                    { id: 'server1', name: 'Server 1', allowed: true }
                ]);
                assert.strictEqual(listener1Fired, true);
                assert.strictEqual(listener2Fired, true);
            }
            finally {
                disposable1.dispose();
                disposable2.dispose();
            }
        });
    });
    suite('integration scenarios', () => {
        test('complete workflow: add, update, query, remove', () => {
            const providerId = 'github';
            const accountName = 'user@example.com';
            const serverId = 'test-server';
            // Initially unknown
            assert.strictEqual(authenticationMcpAccessService.isAccessAllowed(providerId, accountName, serverId), undefined);
            // Add server as allowed
            authenticationMcpAccessService.updateAllowedMcpServers(providerId, accountName, [
                { id: serverId, name: 'Test Server', allowed: true }
            ]);
            assert.strictEqual(authenticationMcpAccessService.isAccessAllowed(providerId, accountName, serverId), true);
            // Update to disallowed
            authenticationMcpAccessService.updateAllowedMcpServers(providerId, accountName, [
                { id: serverId, name: 'Test Server', allowed: false }
            ]);
            assert.strictEqual(authenticationMcpAccessService.isAccessAllowed(providerId, accountName, serverId), false);
            // Remove all
            authenticationMcpAccessService.removeAllowedMcpServers(providerId, accountName);
            assert.strictEqual(authenticationMcpAccessService.isAccessAllowed(providerId, accountName, serverId), undefined);
        });
        test('multiple providers and accounts are isolated', () => {
            // Add data for different combinations
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user1@example.com', [
                { id: 'server1', name: 'Server 1', allowed: true }
            ]);
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user2@example.com', [
                { id: 'server1', name: 'Server 1', allowed: false }
            ]);
            authenticationMcpAccessService.updateAllowedMcpServers('microsoft', 'user1@example.com', [
                { id: 'server1', name: 'Server 1', allowed: true }
            ]);
            // Verify isolation
            assert.strictEqual(authenticationMcpAccessService.isAccessAllowed('github', 'user1@example.com', 'server1'), true);
            assert.strictEqual(authenticationMcpAccessService.isAccessAllowed('github', 'user2@example.com', 'server1'), false);
            assert.strictEqual(authenticationMcpAccessService.isAccessAllowed('microsoft', 'user1@example.com', 'server1'), true);
            // Non-existent combinations should return undefined
            assert.strictEqual(authenticationMcpAccessService.isAccessAllowed('microsoft', 'user2@example.com', 'server1'), undefined);
        });
        test('product.json configuration takes precedence in all scenarios', () => {
            productService.trustedMcpAuthAccess = {
                'github': ['trusted-server'],
                'microsoft': ['microsoft-trusted']
            };
            // Trusted servers should always return true regardless of storage
            assert.strictEqual(authenticationMcpAccessService.isAccessAllowed('github', 'user@example.com', 'trusted-server'), true);
            // Try to override via storage
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                { id: 'trusted-server', name: 'Trusted Server', allowed: false }
            ]);
            // Should still return true
            assert.strictEqual(authenticationMcpAccessService.isAccessAllowed('github', 'user@example.com', 'trusted-server'), true);
            // But non-trusted servers should still respect storage
            authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                { id: 'user-server', name: 'User Server', allowed: false }
            ]);
            assert.strictEqual(authenticationMcpAccessService.isAccessAllowed('github', 'user@example.com', 'user-server'), false);
        });
        test('handles edge cases with empty or null values', () => {
            // Empty provider/account names
            assert.doesNotThrow(() => {
                authenticationMcpAccessService.isAccessAllowed('', '', 'server1');
            });
            // Empty server arrays
            assert.doesNotThrow(() => {
                authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', []);
            });
            // Empty server ID/name
            assert.doesNotThrow(() => {
                authenticationMcpAccessService.updateAllowedMcpServers('github', 'user@example.com', [
                    { id: '', name: '', allowed: true }
                ]);
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb25NY3BBY2Nlc3NTZXJ2aWNlLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL2F1dGhlbnRpY2F0aW9uL3Rlc3QvYnJvd3Nlci9hdXRoZW50aWNhdGlvbk1jcEFjY2Vzc1NlcnZpY2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFDekgsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxtREFBbUQsQ0FBQztBQUNqSCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDM0YsT0FBTyxFQUFFLGtCQUFrQixFQUFFLGtCQUFrQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDMUcsT0FBTyxFQUFFLDhCQUE4QixFQUFxRCxNQUFNLGlEQUFpRCxDQUFDO0FBRXBKLEtBQUssQ0FBQyxnQ0FBZ0MsRUFBRSxHQUFHLEVBQUU7SUFDNUMsTUFBTSxXQUFXLEdBQUcsdUNBQXVDLEVBQUUsQ0FBQztJQUU5RCxJQUFJLG9CQUE4QyxDQUFDO0lBQ25ELElBQUksY0FBa0MsQ0FBQztJQUN2QyxJQUFJLGNBQWdHLENBQUM7SUFDckcsSUFBSSw4QkFBK0QsQ0FBQztJQUVwRSxLQUFLLENBQUMsR0FBRyxFQUFFO1FBQ1Ysb0JBQW9CLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLHdCQUF3QixFQUFFLENBQUMsQ0FBQztRQUV2RSx5QkFBeUI7UUFDekIsY0FBYyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxrQkFBa0IsRUFBRSxDQUFDLENBQUM7UUFDM0Qsb0JBQW9CLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUUzRCw0REFBNEQ7UUFDNUQsY0FBYyxHQUFHLEVBQUUsR0FBRyxrQkFBa0IsRUFBRSxDQUFDO1FBQzNDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFFM0QsOEJBQThCO1FBQzlCLDhCQUE4QixHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLDhCQUE4QixDQUFDLENBQUMsQ0FBQztJQUN2SCxDQUFDLENBQUMsQ0FBQztJQUVILEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxHQUFHLEVBQUU7UUFDN0IsSUFBSSxDQUFDLHdFQUF3RSxFQUFFLEdBQUcsRUFBRTtZQUNuRixNQUFNLE1BQU0sR0FBRyw4QkFBOEIsQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLGtCQUFrQixFQUFFLGdCQUFnQixDQUFDLENBQUM7WUFDOUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDdkMsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsc0VBQXNFLEVBQUUsR0FBRyxFQUFFO1lBQ2pGLGNBQWMsQ0FBQyxvQkFBb0IsR0FBRyxDQUFDLGtCQUFrQixFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFFL0UsTUFBTSxNQUFNLEdBQUcsOEJBQThCLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBQ2hILE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2xDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHVFQUF1RSxFQUFFLEdBQUcsRUFBRTtZQUNsRixjQUFjLENBQUMsb0JBQW9CLEdBQUc7Z0JBQ3JDLFFBQVEsRUFBRSxDQUFDLGVBQWUsQ0FBQztnQkFDM0IsV0FBVyxFQUFFLENBQUMsa0JBQWtCLENBQUM7YUFDakMsQ0FBQztZQUVGLE1BQU0sT0FBTyxHQUFHLDhCQUE4QixDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDOUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFFbEMsTUFBTSxPQUFPLEdBQUcsOEJBQThCLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxvQkFBb0IsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBQ3RILE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ25DLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHNEQUFzRCxFQUFFLEdBQUcsRUFBRTtZQUNqRSxjQUFjLENBQUMsb0JBQW9CLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1lBRXpELE1BQU0sTUFBTSxHQUFHLDhCQUE4QixDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUNoSCxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztRQUN2QyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyx3REFBd0QsRUFBRSxHQUFHLEVBQUU7WUFDbkUsd0JBQXdCO1lBQ3hCLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxDQUFDO29CQUNyRixFQUFFLEVBQUUsZUFBZTtvQkFDbkIsSUFBSSxFQUFFLGVBQWU7b0JBQ3JCLE9BQU8sRUFBRSxLQUFLO2lCQUNkLENBQUMsQ0FBQyxDQUFDO1lBRUosTUFBTSxNQUFNLEdBQUcsOEJBQThCLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxlQUFlLENBQUMsQ0FBQztZQUM3RyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNuQyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxzREFBc0QsRUFBRSxHQUFHLEVBQUU7WUFDakUsOEJBQThCLENBQUMsdUJBQXVCLENBQUMsUUFBUSxFQUFFLGtCQUFrQixFQUFFLENBQUM7b0JBQ3JGLEVBQUUsRUFBRSxnQkFBZ0I7b0JBQ3BCLElBQUksRUFBRSxnQkFBZ0I7b0JBQ3RCLE9BQU8sRUFBRSxJQUFJO2lCQUNiLENBQUMsQ0FBQyxDQUFDO1lBRUosTUFBTSxNQUFNLEdBQUcsOEJBQThCLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQzlHLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2xDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHNGQUFzRixFQUFFLEdBQUcsRUFBRTtZQUNqRywyREFBMkQ7WUFDM0QsTUFBTSxZQUFZLEdBQXFCO2dCQUN0QyxFQUFFLEVBQUUsZUFBZTtnQkFDbkIsSUFBSSxFQUFFLGVBQWU7Z0JBQ3JCLGdDQUFnQzthQUNoQyxDQUFDO1lBRUYsOEJBQThCLENBQUMsdUJBQXVCLENBQUMsUUFBUSxFQUFFLGtCQUFrQixFQUFFLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztZQUVyRyxNQUFNLE1BQU0sR0FBRyw4QkFBOEIsQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLGtCQUFrQixFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBQzdHLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2xDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDJEQUEyRCxFQUFFLEdBQUcsRUFBRTtZQUN0RSxjQUFjLENBQUMsb0JBQW9CLEdBQUcsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1lBRWpFLDhDQUE4QztZQUM5Qyw4QkFBOEIsQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLEVBQUUsQ0FBQztvQkFDckYsRUFBRSxFQUFFLHdCQUF3QjtvQkFDNUIsSUFBSSxFQUFFLHdCQUF3QjtvQkFDOUIsT0FBTyxFQUFFLEtBQUs7aUJBQ2QsQ0FBQyxDQUFDLENBQUM7WUFFSixzQ0FBc0M7WUFDdEMsTUFBTSxNQUFNLEdBQUcsOEJBQThCLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO1lBQ3RILE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2xDLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxLQUFLLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxFQUFFO1FBQ25DLElBQUksQ0FBQyx5Q0FBeUMsRUFBRSxHQUFHLEVBQUU7WUFDcEQsTUFBTSxNQUFNLEdBQUcsOEJBQThCLENBQUMscUJBQXFCLENBQUMsUUFBUSxFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDbEcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3RDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDRCQUE0QixFQUFFLEdBQUcsRUFBRTtZQUN2QyxNQUFNLE9BQU8sR0FBdUI7Z0JBQ25DLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7Z0JBQ2xELEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUU7YUFDbkQsQ0FBQztZQUVGLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUU5RixNQUFNLE1BQU0sR0FBRyw4QkFBOEIsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUNsRyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDckMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVDLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM1QyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDNUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzlDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDJEQUEyRCxFQUFFLEdBQUcsRUFBRTtZQUN0RSxjQUFjLENBQUMsb0JBQW9CLEdBQUcsQ0FBQyxrQkFBa0IsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBRS9FLE1BQU0sTUFBTSxHQUFHLDhCQUE4QixDQUFDLHFCQUFxQixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBQ2xHLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUVyQyxNQUFNLGNBQWMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxrQkFBa0IsQ0FBQyxDQUFDO1lBQ3JFLE1BQU0sQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDMUIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2pELE1BQU0sQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNqRCxNQUFNLENBQUMsV0FBVyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLHVCQUF1QjtZQUVwRixNQUFNLGNBQWMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxrQkFBa0IsQ0FBQyxDQUFDO1lBQ3JFLE1BQU0sQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDMUIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2pELE1BQU0sQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNsRCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyw0REFBNEQsRUFBRSxHQUFHLEVBQUU7WUFDdkUsY0FBYyxDQUFDLG9CQUFvQixHQUFHO2dCQUNyQyxRQUFRLEVBQUUsQ0FBQyxlQUFlLENBQUM7Z0JBQzNCLFdBQVcsRUFBRSxDQUFDLGtCQUFrQixDQUFDO2FBQ2pDLENBQUM7WUFFRixNQUFNLFlBQVksR0FBRyw4QkFBOEIsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUN4RyxNQUFNLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDM0MsTUFBTSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBQ3hELE1BQU0sQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztZQUVsRCxNQUFNLGVBQWUsR0FBRyw4QkFBOEIsQ0FBQyxxQkFBcUIsQ0FBQyxXQUFXLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUNoSCxNQUFNLENBQUMsV0FBVyxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDOUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDOUQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBRXJELHVFQUF1RTtZQUN2RSxNQUFNLGFBQWEsR0FBRyw4QkFBOEIsQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUMxRyxNQUFNLENBQUMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDN0MsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsOERBQThELEVBQUUsR0FBRyxFQUFFO1lBQ3pFLGNBQWMsQ0FBQyxvQkFBb0IsR0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFFekQsMEJBQTBCO1lBQzFCLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRTtnQkFDcEYsRUFBRSxFQUFFLEVBQUUsZUFBZSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRTthQUM5RCxDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sR0FBRyw4QkFBOEIsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUNsRyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFFckMsTUFBTSxhQUFhLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssZ0JBQWdCLENBQUMsQ0FBQztZQUNsRSxNQUFNLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQ3pCLE1BQU0sQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNoRCxNQUFNLENBQUMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFFaEQsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssZUFBZSxDQUFDLENBQUM7WUFDaEUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUN4QixNQUFNLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDcEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2pELENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDhFQUE4RSxFQUFFLEdBQUcsRUFBRTtZQUN6Riw2Q0FBNkM7WUFDN0MsOEJBQThCLENBQUMsdUJBQXVCLENBQUMsUUFBUSxFQUFFLGtCQUFrQixFQUFFO2dCQUNwRixFQUFFLEVBQUUsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFO2FBQ3BELENBQUMsQ0FBQztZQUVILHdDQUF3QztZQUN4QyxjQUFjLENBQUMsb0JBQW9CLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUVuRCxNQUFNLE1BQU0sR0FBRyw4QkFBOEIsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUNsRyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFFckMsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3pCLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxVQUFVLENBQUMsQ0FBQztZQUMxQyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQywrQkFBK0I7WUFDekUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsOEJBQThCO1lBQ3hFLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLDRCQUE0QjtRQUMxRSxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyw4Q0FBOEMsRUFBRSxHQUFHLEVBQUU7WUFDekQsK0JBQStCO1lBQy9CLGNBQWMsQ0FBQyxLQUFLLENBQUMsbUNBQW1DLEVBQUUsY0FBYyxnRUFBK0MsQ0FBQztZQUV4SCxnREFBZ0Q7WUFDaEQsTUFBTSxNQUFNLEdBQUcsOEJBQThCLENBQUMscUJBQXFCLENBQUMsUUFBUSxFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDbEcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3RDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHlEQUF5RCxFQUFFLEdBQUcsRUFBRTtZQUNwRSwrQkFBK0I7WUFDL0IsbURBQW1EO1lBQ25ELGNBQWMsQ0FBQyxvQkFBb0IsR0FBRyxnQkFBdUIsQ0FBQztZQUU5RCxNQUFNLE1BQU0sR0FBRyw4QkFBOEIsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUNsRyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDdEMsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILEtBQUssQ0FBQyx5QkFBeUIsRUFBRSxHQUFHLEVBQUU7UUFDckMsSUFBSSxDQUFDLHdCQUF3QixFQUFFLEdBQUcsRUFBRTtZQUNuQyxNQUFNLE9BQU8sR0FBdUI7Z0JBQ25DLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7Z0JBQ2xELEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUU7YUFDbkQsQ0FBQztZQUVGLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUU5RixNQUFNLE1BQU0sR0FBRyw4QkFBOEIsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUNsRyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDckMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVDLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM3QyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyw0Q0FBNEMsRUFBRSxHQUFHLEVBQUU7WUFDdkQscUJBQXFCO1lBQ3JCLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRTtnQkFDcEYsRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTthQUNsRCxDQUFDLENBQUM7WUFFSCxpQ0FBaUM7WUFDakMsOEJBQThCLENBQUMsdUJBQXVCLENBQUMsUUFBUSxFQUFFLGtCQUFrQixFQUFFO2dCQUNwRixFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFO2FBQ25ELENBQUMsQ0FBQztZQUVILE1BQU0sTUFBTSxHQUFHLDhCQUE4QixDQUFDLHFCQUFxQixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBQ2xHLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNyQyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDOUMsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsNERBQTRELEVBQUUsR0FBRyxFQUFFO1lBQ3ZFLHVDQUF1QztZQUN2Qyw4QkFBOEIsQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLEVBQUU7Z0JBQ3BGLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7YUFDakQsQ0FBQyxDQUFDO1lBRUgsaUNBQWlDO1lBQ2pDLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRTtnQkFDcEYsRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTthQUNuRCxDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sR0FBRyw4QkFBOEIsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUNsRyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDckMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ2pELENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGtEQUFrRCxFQUFFLEdBQUcsRUFBRTtZQUM3RCx3Q0FBd0M7WUFDeEMsOEJBQThCLENBQUMsdUJBQXVCLENBQUMsUUFBUSxFQUFFLGtCQUFrQixFQUFFO2dCQUNwRixFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFO2FBQ25ELENBQUMsQ0FBQztZQUVILGlFQUFpRTtZQUNqRSw4QkFBOEIsQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLEVBQUU7Z0JBQ3BGLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUU7YUFDbEQsQ0FBQyxDQUFDO1lBRUgsTUFBTSxNQUFNLEdBQUcsOEJBQThCLENBQUMscUJBQXFCLENBQUMsUUFBUSxFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDbEcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3JDLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLDRCQUE0QjtZQUM3RSxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxtQ0FBbUM7UUFDbEYsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsaURBQWlELEVBQUUsR0FBRyxFQUFFO1lBQzVELHVCQUF1QjtZQUN2Qiw4QkFBOEIsQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLEVBQUU7Z0JBQ3BGLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7YUFDbEQsQ0FBQyxDQUFDO1lBRUgsMEJBQTBCO1lBQzFCLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRTtnQkFDcEYsRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRTthQUNuRCxDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sR0FBRyw4QkFBOEIsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUNsRyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFFckMsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssU0FBUyxDQUFDLENBQUM7WUFDckQsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssU0FBUyxDQUFDLENBQUM7WUFDckQsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNuQixNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ25CLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztZQUMxQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDNUMsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsa0RBQWtELEVBQUUsR0FBRyxFQUFFO1lBQzdELGNBQWMsQ0FBQyxvQkFBb0IsR0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFFekQsaUNBQWlDO1lBQ2pDLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRTtnQkFDcEYsRUFBRSxFQUFFLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTtnQkFDL0UsRUFBRSxFQUFFLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTthQUN6RCxDQUFDLENBQUM7WUFFSCwrRUFBK0U7WUFDL0UsTUFBTSxVQUFVLEdBQUcsbUNBQW1DLENBQUM7WUFDdkQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLFVBQVUsb0NBQTJCLElBQUksSUFBSSxDQUFDLENBQUM7WUFFaEcsbUVBQW1FO1lBQ25FLE1BQU0sQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN6QyxNQUFNLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFFcEQscUZBQXFGO1lBQ3JGLE1BQU0sVUFBVSxHQUFHLDhCQUE4QixDQUFDLHFCQUFxQixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBQ3RHLE1BQU0sQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyx5Q0FBeUMsRUFBRSxHQUFHLEVBQUU7WUFDcEQsSUFBSSxVQUFVLEdBQUcsS0FBSyxDQUFDO1lBQ3ZCLElBQUksU0FBa0UsQ0FBQztZQUV2RSxNQUFNLFVBQVUsR0FBRyw4QkFBOEIsQ0FBQywyQkFBMkIsQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDckYsVUFBVSxHQUFHLElBQUksQ0FBQztnQkFDbEIsU0FBUyxHQUFHLEtBQUssQ0FBQztZQUNuQixDQUFDLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQztnQkFDSiw4QkFBOEIsQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLEVBQUU7b0JBQ3BGLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7aUJBQ2xELENBQUMsQ0FBQztnQkFFSCxNQUFNLENBQUMsV0FBVyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDckMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDckIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUNuRCxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUMvRCxDQUFDO29CQUFTLENBQUM7Z0JBQ1YsVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3RCLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsS0FBSyxDQUFDLHlCQUF5QixFQUFFLEdBQUcsRUFBRTtRQUNyQyxJQUFJLENBQUMsNENBQTRDLEVBQUUsR0FBRyxFQUFFO1lBQ3ZELHlCQUF5QjtZQUN6Qiw4QkFBOEIsQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLEVBQUU7Z0JBQ3BGLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7Z0JBQ2xELEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUU7YUFDbkQsQ0FBQyxDQUFDO1lBRUgsb0JBQW9CO1lBQ3BCLElBQUksTUFBTSxHQUFHLDhCQUE4QixDQUFDLHFCQUFxQixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBQ2hHLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUVyQyxjQUFjO1lBQ2QsOEJBQThCLENBQUMsdUJBQXVCLENBQUMsUUFBUSxFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFFckYsc0JBQXNCO1lBQ3RCLE1BQU0sR0FBRyw4QkFBOEIsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUM1RixNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDdEMsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsbURBQW1ELEVBQUUsR0FBRyxFQUFFO1lBQzlELGNBQWMsQ0FBQyxvQkFBb0IsR0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFFekQsZ0NBQWdDO1lBQ2hDLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRTtnQkFDcEYsRUFBRSxFQUFFLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTthQUN6RCxDQUFDLENBQUM7WUFFSCw2Q0FBNkM7WUFDN0MsSUFBSSxNQUFNLEdBQUcsOEJBQThCLENBQUMscUJBQXFCLENBQUMsUUFBUSxFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDaEcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBRXJDLHNCQUFzQjtZQUN0Qiw4QkFBOEIsQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUVyRixtQ0FBbUM7WUFDbkMsTUFBTSxHQUFHLDhCQUE4QixDQUFDLHFCQUFxQixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBQzVGLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNyQyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUNuRCxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDN0MsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMseUNBQXlDLEVBQUUsR0FBRyxFQUFFO1lBQ3BELElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQztZQUN2QixJQUFJLFNBQWtFLENBQUM7WUFFdkUsTUFBTSxVQUFVLEdBQUcsOEJBQThCLENBQUMsMkJBQTJCLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQ3JGLFVBQVUsR0FBRyxJQUFJLENBQUM7Z0JBQ2xCLFNBQVMsR0FBRyxLQUFLLENBQUM7WUFDbkIsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUM7Z0JBQ0osOEJBQThCLENBQUMsdUJBQXVCLENBQUMsUUFBUSxFQUFFLGtCQUFrQixDQUFDLENBQUM7Z0JBRXJGLE1BQU0sQ0FBQyxXQUFXLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNyQyxNQUFNLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNyQixNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQ25ELE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBQy9ELENBQUM7b0JBQVMsQ0FBQztnQkFDVixVQUFVLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdEIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGlEQUFpRCxFQUFFLEdBQUcsRUFBRTtZQUM1RCxpRUFBaUU7WUFDakUsTUFBTSxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUU7Z0JBQ3hCLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLGFBQWEsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBQzNGLENBQUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILEtBQUssQ0FBQyxtQ0FBbUMsRUFBRSxHQUFHLEVBQUU7UUFDL0MsSUFBSSxDQUFDLDBDQUEwQyxFQUFFLEdBQUcsRUFBRTtZQUNyRCxNQUFNLE1BQU0sR0FBdUQsRUFBRSxDQUFDO1lBRXRFLE1BQU0sVUFBVSxHQUFHLDhCQUE4QixDQUFDLDJCQUEyQixDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUNyRixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3BCLENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDO2dCQUNKLHlCQUF5QjtnQkFDekIsOEJBQThCLENBQUMsdUJBQXVCLENBQUMsUUFBUSxFQUFFLGtCQUFrQixFQUFFO29CQUNwRixFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFO2lCQUNsRCxDQUFDLENBQUM7Z0JBRUgseUJBQXlCO2dCQUN6Qiw4QkFBOEIsQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztnQkFFckYsb0NBQW9DO2dCQUNwQyw4QkFBOEIsQ0FBQyx1QkFBdUIsQ0FBQyxXQUFXLEVBQUUsbUJBQW1CLEVBQUU7b0JBQ3hGLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUU7aUJBQ25ELENBQUMsQ0FBQztnQkFFSCxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JDLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztnQkFDbkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLGtCQUFrQixDQUFDLENBQUM7Z0JBQzlELE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztnQkFDbkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLGtCQUFrQixDQUFDLENBQUM7Z0JBQzlELE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxXQUFXLENBQUMsQ0FBQztnQkFDdEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLG1CQUFtQixDQUFDLENBQUM7WUFDaEUsQ0FBQztvQkFBUyxDQUFDO2dCQUNWLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN0QixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsbUNBQW1DLEVBQUUsR0FBRyxFQUFFO1lBQzlDLElBQUksY0FBYyxHQUFHLEtBQUssQ0FBQztZQUMzQixJQUFJLGNBQWMsR0FBRyxLQUFLLENBQUM7WUFFM0IsTUFBTSxXQUFXLEdBQUcsOEJBQThCLENBQUMsMkJBQTJCLENBQUMsR0FBRyxFQUFFO2dCQUNuRixjQUFjLEdBQUcsSUFBSSxDQUFDO1lBQ3ZCLENBQUMsQ0FBQyxDQUFDO1lBRUgsTUFBTSxXQUFXLEdBQUcsOEJBQThCLENBQUMsMkJBQTJCLENBQUMsR0FBRyxFQUFFO2dCQUNuRixjQUFjLEdBQUcsSUFBSSxDQUFDO1lBQ3ZCLENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDO2dCQUNKLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRTtvQkFDcEYsRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTtpQkFDbEQsQ0FBQyxDQUFDO2dCQUVILE1BQU0sQ0FBQyxXQUFXLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUN6QyxNQUFNLENBQUMsV0FBVyxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUMxQyxDQUFDO29CQUFTLENBQUM7Z0JBQ1YsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUN0QixXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdkIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxLQUFLLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxFQUFFO1FBQ25DLElBQUksQ0FBQywrQ0FBK0MsRUFBRSxHQUFHLEVBQUU7WUFDMUQsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDO1lBQzVCLE1BQU0sV0FBVyxHQUFHLGtCQUFrQixDQUFDO1lBQ3ZDLE1BQU0sUUFBUSxHQUFHLGFBQWEsQ0FBQztZQUUvQixvQkFBb0I7WUFDcEIsTUFBTSxDQUFDLFdBQVcsQ0FDakIsOEJBQThCLENBQUMsZUFBZSxDQUFDLFVBQVUsRUFBRSxXQUFXLEVBQUUsUUFBUSxDQUFDLEVBQ2pGLFNBQVMsQ0FDVCxDQUFDO1lBRUYsd0JBQXdCO1lBQ3hCLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFVBQVUsRUFBRSxXQUFXLEVBQUU7Z0JBQy9FLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsYUFBYSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7YUFDcEQsQ0FBQyxDQUFDO1lBRUgsTUFBTSxDQUFDLFdBQVcsQ0FDakIsOEJBQThCLENBQUMsZUFBZSxDQUFDLFVBQVUsRUFBRSxXQUFXLEVBQUUsUUFBUSxDQUFDLEVBQ2pGLElBQUksQ0FDSixDQUFDO1lBRUYsdUJBQXVCO1lBQ3ZCLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFVBQVUsRUFBRSxXQUFXLEVBQUU7Z0JBQy9FLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsYUFBYSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUU7YUFDckQsQ0FBQyxDQUFDO1lBRUgsTUFBTSxDQUFDLFdBQVcsQ0FDakIsOEJBQThCLENBQUMsZUFBZSxDQUFDLFVBQVUsRUFBRSxXQUFXLEVBQUUsUUFBUSxDQUFDLEVBQ2pGLEtBQUssQ0FDTCxDQUFDO1lBRUYsYUFBYTtZQUNiLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFVBQVUsRUFBRSxXQUFXLENBQUMsQ0FBQztZQUVoRixNQUFNLENBQUMsV0FBVyxDQUNqQiw4QkFBOEIsQ0FBQyxlQUFlLENBQUMsVUFBVSxFQUFFLFdBQVcsRUFBRSxRQUFRLENBQUMsRUFDakYsU0FBUyxDQUNULENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyw4Q0FBOEMsRUFBRSxHQUFHLEVBQUU7WUFDekQsc0NBQXNDO1lBQ3RDLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxtQkFBbUIsRUFBRTtnQkFDckYsRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTthQUNsRCxDQUFDLENBQUM7WUFFSCw4QkFBOEIsQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsbUJBQW1CLEVBQUU7Z0JBQ3JGLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUU7YUFDbkQsQ0FBQyxDQUFDO1lBRUgsOEJBQThCLENBQUMsdUJBQXVCLENBQUMsV0FBVyxFQUFFLG1CQUFtQixFQUFFO2dCQUN4RixFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFO2FBQ2xELENBQUMsQ0FBQztZQUVILG1CQUFtQjtZQUNuQixNQUFNLENBQUMsV0FBVyxDQUNqQiw4QkFBOEIsQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLG1CQUFtQixFQUFFLFNBQVMsQ0FBQyxFQUN4RixJQUFJLENBQ0osQ0FBQztZQUNGLE1BQU0sQ0FBQyxXQUFXLENBQ2pCLDhCQUE4QixDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsbUJBQW1CLEVBQUUsU0FBUyxDQUFDLEVBQ3hGLEtBQUssQ0FDTCxDQUFDO1lBQ0YsTUFBTSxDQUFDLFdBQVcsQ0FDakIsOEJBQThCLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxtQkFBbUIsRUFBRSxTQUFTLENBQUMsRUFDM0YsSUFBSSxDQUNKLENBQUM7WUFFRixvREFBb0Q7WUFDcEQsTUFBTSxDQUFDLFdBQVcsQ0FDakIsOEJBQThCLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxtQkFBbUIsRUFBRSxTQUFTLENBQUMsRUFDM0YsU0FBUyxDQUNULENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyw4REFBOEQsRUFBRSxHQUFHLEVBQUU7WUFDekUsY0FBYyxDQUFDLG9CQUFvQixHQUFHO2dCQUNyQyxRQUFRLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDNUIsV0FBVyxFQUFFLENBQUMsbUJBQW1CLENBQUM7YUFDbEMsQ0FBQztZQUVGLGtFQUFrRTtZQUNsRSxNQUFNLENBQUMsV0FBVyxDQUNqQiw4QkFBOEIsQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLGtCQUFrQixFQUFFLGdCQUFnQixDQUFDLEVBQzlGLElBQUksQ0FDSixDQUFDO1lBRUYsOEJBQThCO1lBQzlCLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRTtnQkFDcEYsRUFBRSxFQUFFLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUU7YUFDaEUsQ0FBQyxDQUFDO1lBRUgsMkJBQTJCO1lBQzNCLE1BQU0sQ0FBQyxXQUFXLENBQ2pCLDhCQUE4QixDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLEVBQUUsZ0JBQWdCLENBQUMsRUFDOUYsSUFBSSxDQUNKLENBQUM7WUFFRix1REFBdUQ7WUFDdkQsOEJBQThCLENBQUMsdUJBQXVCLENBQUMsUUFBUSxFQUFFLGtCQUFrQixFQUFFO2dCQUNwRixFQUFFLEVBQUUsRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFO2FBQzFELENBQUMsQ0FBQztZQUVILE1BQU0sQ0FBQyxXQUFXLENBQ2pCLDhCQUE4QixDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLEVBQUUsYUFBYSxDQUFDLEVBQzNGLEtBQUssQ0FDTCxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsOENBQThDLEVBQUUsR0FBRyxFQUFFO1lBQ3pELCtCQUErQjtZQUMvQixNQUFNLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRTtnQkFDeEIsOEJBQThCLENBQUMsZUFBZSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDbkUsQ0FBQyxDQUFDLENBQUM7WUFFSCxzQkFBc0I7WUFDdEIsTUFBTSxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUU7Z0JBQ3hCLDhCQUE4QixDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMxRixDQUFDLENBQUMsQ0FBQztZQUVILHVCQUF1QjtZQUN2QixNQUFNLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRTtnQkFDeEIsOEJBQThCLENBQUMsdUJBQXVCLENBQUMsUUFBUSxFQUFFLGtCQUFrQixFQUFFO29CQUNwRixFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFO2lCQUNuQyxDQUFDLENBQUM7WUFDSixDQUFDLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9