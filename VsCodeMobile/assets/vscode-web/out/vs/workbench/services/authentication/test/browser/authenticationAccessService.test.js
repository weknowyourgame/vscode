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
import { AuthenticationAccessService } from '../../browser/authenticationAccessService.js';
suite('AuthenticationAccessService', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let storageService;
    let productService;
    let authenticationAccessService;
    setup(() => {
        instantiationService = disposables.add(new TestInstantiationService());
        // Set up storage service
        storageService = disposables.add(new TestStorageService());
        instantiationService.stub(IStorageService, storageService);
        // Set up product service with no trusted extensions by default
        productService = { ...TestProductService, trustedExtensionAuthAccess: undefined };
        instantiationService.stub(IProductService, productService);
        // Create the service instance
        authenticationAccessService = disposables.add(instantiationService.createInstance(AuthenticationAccessService));
    });
    teardown(() => {
        // Reset product service configuration to prevent test interference
        if (productService) {
            productService.trustedExtensionAuthAccess = undefined;
        }
    });
    suite('isAccessAllowed', () => {
        test('returns undefined for unknown extension with no product configuration', () => {
            const result = authenticationAccessService.isAccessAllowed('github', 'user@example.com', 'unknown-extension');
            assert.strictEqual(result, undefined);
        });
        test('returns true for trusted extension from product.json (array format)', () => {
            productService.trustedExtensionAuthAccess = ['trusted-extension-1', 'trusted-extension-2'];
            const result = authenticationAccessService.isAccessAllowed('github', 'user@example.com', 'trusted-extension-1');
            assert.strictEqual(result, true);
        });
        test('returns true for trusted extension from product.json (object format)', () => {
            productService.trustedExtensionAuthAccess = {
                'github': ['github-extension'],
                'microsoft': ['microsoft-extension']
            };
            const result1 = authenticationAccessService.isAccessAllowed('github', 'user@example.com', 'github-extension');
            assert.strictEqual(result1, true);
            const result2 = authenticationAccessService.isAccessAllowed('microsoft', 'user@microsoft.com', 'microsoft-extension');
            assert.strictEqual(result2, true);
        });
        test('returns undefined for extension not in trusted list', () => {
            productService.trustedExtensionAuthAccess = ['trusted-extension'];
            const result = authenticationAccessService.isAccessAllowed('github', 'user@example.com', 'untrusted-extension');
            assert.strictEqual(result, undefined);
        });
        test('returns stored allowed state when extension is in storage', () => {
            // Add extension to storage
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [{
                    id: 'stored-extension',
                    name: 'Stored Extension',
                    allowed: false
                }]);
            const result = authenticationAccessService.isAccessAllowed('github', 'user@example.com', 'stored-extension');
            assert.strictEqual(result, false);
        });
        test('returns true for extension in storage with allowed=true', () => {
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [{
                    id: 'allowed-extension',
                    name: 'Allowed Extension',
                    allowed: true
                }]);
            const result = authenticationAccessService.isAccessAllowed('github', 'user@example.com', 'allowed-extension');
            assert.strictEqual(result, true);
        });
        test('returns true for extension in storage with undefined allowed property (legacy behavior)', () => {
            // Simulate legacy data where allowed property didn't exist
            const legacyExtension = {
                id: 'legacy-extension',
                name: 'Legacy Extension'
                // allowed property is undefined
            };
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [legacyExtension]);
            const result = authenticationAccessService.isAccessAllowed('github', 'user@example.com', 'legacy-extension');
            assert.strictEqual(result, true);
        });
        test('product.json trusted extensions take precedence over storage', () => {
            productService.trustedExtensionAuthAccess = ['product-trusted-extension'];
            // Try to store the same extension as not allowed
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [{
                    id: 'product-trusted-extension',
                    name: 'Product Trusted Extension',
                    allowed: false
                }]);
            // Product.json should take precedence
            const result = authenticationAccessService.isAccessAllowed('github', 'user@example.com', 'product-trusted-extension');
            assert.strictEqual(result, true);
        });
    });
    suite('readAllowedExtensions', () => {
        test('returns empty array when no data exists', () => {
            const result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 0);
        });
        test('returns stored extensions', () => {
            const extensions = [
                { id: 'extension1', name: 'Extension 1', allowed: true },
                { id: 'extension2', name: 'Extension 2', allowed: false }
            ];
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', extensions);
            const result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].id, 'extension1');
            assert.strictEqual(result[0].allowed, true);
            assert.strictEqual(result[1].id, 'extension2');
            assert.strictEqual(result[1].allowed, false);
        });
        test('includes trusted extensions from product.json (array format)', () => {
            productService.trustedExtensionAuthAccess = ['trusted-extension-1', 'trusted-extension-2'];
            const result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 2);
            const trustedExtension1 = result.find(e => e.id === 'trusted-extension-1');
            assert.ok(trustedExtension1);
            assert.strictEqual(trustedExtension1.allowed, true);
            assert.strictEqual(trustedExtension1.trusted, true);
            assert.strictEqual(trustedExtension1.name, 'trusted-extension-1'); // Should default to ID
            const trustedExtension2 = result.find(e => e.id === 'trusted-extension-2');
            assert.ok(trustedExtension2);
            assert.strictEqual(trustedExtension2.allowed, true);
            assert.strictEqual(trustedExtension2.trusted, true);
        });
        test('includes trusted extensions from product.json (object format)', () => {
            productService.trustedExtensionAuthAccess = {
                'github': ['github-extension'],
                'microsoft': ['microsoft-extension']
            };
            const githubResult = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(githubResult.length, 1);
            assert.strictEqual(githubResult[0].id, 'github-extension');
            assert.strictEqual(githubResult[0].trusted, true);
            const microsoftResult = authenticationAccessService.readAllowedExtensions('microsoft', 'user@microsoft.com');
            assert.strictEqual(microsoftResult.length, 1);
            assert.strictEqual(microsoftResult[0].id, 'microsoft-extension');
            assert.strictEqual(microsoftResult[0].trusted, true);
            // Provider not in trusted list should return empty (no stored extensions)
            const unknownResult = authenticationAccessService.readAllowedExtensions('unknown', 'user@unknown.com');
            assert.strictEqual(unknownResult.length, 0);
        });
        test('merges stored extensions with trusted extensions from product.json', () => {
            productService.trustedExtensionAuthAccess = ['trusted-extension'];
            // Add some stored extensions
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [
                { id: 'stored-extension', name: 'Stored Extension', allowed: false }
            ]);
            const result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 2);
            const trustedExtension = result.find(e => e.id === 'trusted-extension');
            assert.ok(trustedExtension);
            assert.strictEqual(trustedExtension.trusted, true);
            assert.strictEqual(trustedExtension.allowed, true);
            const storedExtension = result.find(e => e.id === 'stored-extension');
            assert.ok(storedExtension);
            assert.strictEqual(storedExtension.trusted, undefined);
            assert.strictEqual(storedExtension.allowed, false);
        });
        test('updates existing stored extension to trusted when found in product.json', () => {
            // First add an extension to storage
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [
                { id: 'extension1', name: 'Extension 1', allowed: false }
            ]);
            // Then add it to trusted list
            productService.trustedExtensionAuthAccess = ['extension1'];
            const result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, 'extension1');
            assert.strictEqual(result[0].trusted, true);
            assert.strictEqual(result[0].allowed, true); // Should be marked as allowed due to being trusted
        });
        test('handles malformed storage data gracefully', () => {
            // Directly store malformed data in storage
            storageService.store('github-user@example.com', 'invalid-json', -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
            const result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 0); // Should return empty array instead of throwing
        });
    });
    suite('updateAllowedExtensions', () => {
        test('adds new extensions to storage', () => {
            const extensions = [
                { id: 'extension1', name: 'Extension 1', allowed: true },
                { id: 'extension2', name: 'Extension 2', allowed: false }
            ];
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', extensions);
            const result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].id, 'extension1');
            assert.strictEqual(result[1].id, 'extension2');
        });
        test('updates existing extension allowed status', () => {
            // First add an extension
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [
                { id: 'extension1', name: 'Extension 1', allowed: true }
            ]);
            // Then update its allowed status
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [
                { id: 'extension1', name: 'Extension 1', allowed: false }
            ]);
            const result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].allowed, false);
        });
        test('updates existing extension name when new name is provided', () => {
            // First add an extension with default name
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [
                { id: 'extension1', name: 'extension1', allowed: true }
            ]);
            // Then update with a proper name
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [
                { id: 'extension1', name: 'My Extension', allowed: true }
            ]);
            const result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'My Extension');
        });
        test('does not update name when new name is same as ID', () => {
            // First add an extension with a proper name
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [
                { id: 'extension1', name: 'My Extension', allowed: true }
            ]);
            // Then try to update with ID as name (should keep existing name)
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [
                { id: 'extension1', name: 'extension1', allowed: false }
            ]);
            const result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'My Extension'); // Should keep the original name
            assert.strictEqual(result[0].allowed, false); // But update the allowed status
        });
        test('does not store trusted extensions - they should only come from product.json', () => {
            productService.trustedExtensionAuthAccess = ['trusted-extension'];
            // Try to store a trusted extension along with regular extensions
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [
                { id: 'regular-extension', name: 'Regular Extension', allowed: true },
                { id: 'trusted-extension', name: 'Trusted Extension', allowed: false }
            ]);
            // Check what's actually stored in storage (should only be the regular extension)
            const storedData = storageService.get('github-user@example.com', -1 /* StorageScope.APPLICATION */);
            assert.ok(storedData);
            const parsedData = JSON.parse(storedData);
            assert.strictEqual(parsedData.length, 1);
            assert.strictEqual(parsedData[0].id, 'regular-extension');
            // But when we read, we should get both (trusted from product.json + stored)
            const result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 2);
            const trustedExt = result.find(e => e.id === 'trusted-extension');
            assert.ok(trustedExt);
            assert.strictEqual(trustedExt.trusted, true);
            assert.strictEqual(trustedExt.allowed, true); // Should be true from product.json, not false from storage
            const regularExt = result.find(e => e.id === 'regular-extension');
            assert.ok(regularExt);
            assert.strictEqual(regularExt.trusted, undefined);
            assert.strictEqual(regularExt.allowed, true);
        });
        test('filters out trusted extensions before storing', () => {
            productService.trustedExtensionAuthAccess = ['trusted-ext-1', 'trusted-ext-2'];
            // Add both trusted and regular extensions
            const extensions = [
                { id: 'regular-ext', name: 'Regular Extension', allowed: true },
                { id: 'trusted-ext-1', name: 'Trusted Extension 1', allowed: false },
                { id: 'another-regular-ext', name: 'Another Regular Extension', allowed: false },
                { id: 'trusted-ext-2', name: 'Trusted Extension 2', allowed: true }
            ];
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', extensions);
            // Check storage - should only contain regular extensions
            const storedData = storageService.get('github-user@example.com', -1 /* StorageScope.APPLICATION */);
            assert.ok(storedData);
            const parsedData = JSON.parse(storedData);
            assert.strictEqual(parsedData.length, 2);
            assert.ok(parsedData.find((e) => e.id === 'regular-ext'));
            assert.ok(parsedData.find((e) => e.id === 'another-regular-ext'));
            assert.ok(!parsedData.find((e) => e.id === 'trusted-ext-1'));
            assert.ok(!parsedData.find((e) => e.id === 'trusted-ext-2'));
        });
        test('fires onDidChangeExtensionSessionAccess event', () => {
            let eventFired = false;
            let eventData;
            const subscription = authenticationAccessService.onDidChangeExtensionSessionAccess(e => {
                eventFired = true;
                eventData = e;
            });
            disposables.add(subscription);
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [
                { id: 'extension1', name: 'Extension 1', allowed: true }
            ]);
            assert.strictEqual(eventFired, true);
            assert.ok(eventData);
            assert.strictEqual(eventData.providerId, 'github');
            assert.strictEqual(eventData.accountName, 'user@example.com');
        });
    });
    suite('removeAllowedExtensions', () => {
        test('removes all extensions from storage', () => {
            // First add some extensions
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [
                { id: 'extension1', name: 'Extension 1', allowed: true },
                { id: 'extension2', name: 'Extension 2', allowed: false }
            ]);
            // Verify they exist
            const result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.ok(result.length > 0);
            // Remove them
            authenticationAccessService.removeAllowedExtensions('github', 'user@example.com');
            // Verify storage is empty (but trusted extensions from product.json might still be there)
            const storedData = storageService.get('github-user@example.com', -1 /* StorageScope.APPLICATION */);
            assert.strictEqual(storedData, undefined);
        });
        test('fires onDidChangeExtensionSessionAccess event', () => {
            let eventFired = false;
            let eventData;
            // First add an extension
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [
                { id: 'extension1', name: 'Extension 1', allowed: true }
            ]);
            // Then listen for the remove event
            const subscription = authenticationAccessService.onDidChangeExtensionSessionAccess(e => {
                eventFired = true;
                eventData = e;
            });
            disposables.add(subscription);
            authenticationAccessService.removeAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(eventFired, true);
            assert.ok(eventData);
            assert.strictEqual(eventData.providerId, 'github');
            assert.strictEqual(eventData.accountName, 'user@example.com');
        });
        test('does not affect trusted extensions from product.json', () => {
            productService.trustedExtensionAuthAccess = ['trusted-extension'];
            // Add some regular extensions and verify both trusted and regular exist
            authenticationAccessService.updateAllowedExtensions('github', 'user@example.com', [
                { id: 'regular-extension', name: 'Regular Extension', allowed: true }
            ]);
            let result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 2); // 1 trusted + 1 regular
            // Remove stored extensions
            authenticationAccessService.removeAllowedExtensions('github', 'user@example.com');
            // Trusted extension should still be there
            result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, 'trusted-extension');
            assert.strictEqual(result[0].trusted, true);
        });
    });
    suite('integration with product.json configurations', () => {
        test('handles switching between array and object format', () => {
            // Start with array format
            productService.trustedExtensionAuthAccess = ['ext1', 'ext2'];
            let result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 2);
            // Switch to object format
            productService.trustedExtensionAuthAccess = {
                'github': ['ext1', 'ext3'],
                'microsoft': ['ext4']
            };
            result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 2); // ext1 and ext3 for github
            assert.ok(result.find(e => e.id === 'ext1'));
            assert.ok(result.find(e => e.id === 'ext3'));
            assert.ok(!result.find(e => e.id === 'ext2')); // Should not be there anymore
        });
        test('handles empty trusted extension configurations', () => {
            // Test undefined
            productService.trustedExtensionAuthAccess = undefined;
            let result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 0);
            // Test empty array
            productService.trustedExtensionAuthAccess = [];
            result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 0);
            // Test empty object
            productService.trustedExtensionAuthAccess = {};
            result = authenticationAccessService.readAllowedExtensions('github', 'user@example.com');
            assert.strictEqual(result.length, 0);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb25BY2Nlc3NTZXJ2aWNlLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL2F1dGhlbnRpY2F0aW9uL3Rlc3QvYnJvd3Nlci9hdXRoZW50aWNhdGlvbkFjY2Vzc1NlcnZpY2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFDekgsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxtREFBbUQsQ0FBQztBQUNqSCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDM0YsT0FBTyxFQUFFLGtCQUFrQixFQUFFLGtCQUFrQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDMUcsT0FBTyxFQUFFLDJCQUEyQixFQUFnQyxNQUFNLDhDQUE4QyxDQUFDO0FBR3pILEtBQUssQ0FBQyw2QkFBNkIsRUFBRSxHQUFHLEVBQUU7SUFDekMsTUFBTSxXQUFXLEdBQUcsdUNBQXVDLEVBQUUsQ0FBQztJQUU5RCxJQUFJLG9CQUE4QyxDQUFDO0lBQ25ELElBQUksY0FBa0MsQ0FBQztJQUN2QyxJQUFJLGNBQXNHLENBQUM7SUFDM0csSUFBSSwyQkFBeUQsQ0FBQztJQUU5RCxLQUFLLENBQUMsR0FBRyxFQUFFO1FBQ1Ysb0JBQW9CLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLHdCQUF3QixFQUFFLENBQUMsQ0FBQztRQUV2RSx5QkFBeUI7UUFDekIsY0FBYyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxrQkFBa0IsRUFBRSxDQUFDLENBQUM7UUFDM0Qsb0JBQW9CLENB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