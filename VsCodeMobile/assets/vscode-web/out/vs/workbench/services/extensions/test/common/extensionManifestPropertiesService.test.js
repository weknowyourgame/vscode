/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { isWeb } from '../../../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IWorkspaceTrustEnablementService } from '../../../../../platform/workspace/common/workspaceTrust.js';
import { ExtensionManifestPropertiesService } from '../../common/extensionManifestPropertiesService.js';
import { TestProductService, TestWorkspaceTrustEnablementService } from '../../../../test/common/workbenchTestServices.js';
suite('ExtensionManifestPropertiesService - ExtensionKind', () => {
    let disposables;
    let testObject;
    setup(() => {
        disposables = new DisposableStore();
        testObject = disposables.add(new ExtensionManifestPropertiesService(TestProductService, new TestConfigurationService(), new TestWorkspaceTrustEnablementService(), new NullLogService()));
    });
    teardown(() => {
        disposables.dispose();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('declarative with extension dependencies', () => {
        assert.deepStrictEqual(testObject.getExtensionKind({ extensionDependencies: ['ext1'] }), isWeb ? ['workspace', 'web'] : ['workspace']);
    });
    test('declarative extension pack', () => {
        assert.deepStrictEqual(testObject.getExtensionKind({ extensionPack: ['ext1', 'ext2'] }), isWeb ? ['workspace', 'web'] : ['workspace']);
    });
    test('declarative extension pack and extension dependencies', () => {
        assert.deepStrictEqual(testObject.getExtensionKind({ extensionPack: ['ext1', 'ext2'], extensionDependencies: ['ext1', 'ext2'] }), isWeb ? ['workspace', 'web'] : ['workspace']);
    });
    test('declarative with unknown contribution point => workspace, web in web and => workspace in desktop', () => {
        // eslint-disable-next-line local/code-no-any-casts
        assert.deepStrictEqual(testObject.getExtensionKind({ contributes: { 'unknownPoint': { something: true } } }), isWeb ? ['workspace', 'web'] : ['workspace']);
    });
    test('declarative extension pack with unknown contribution point', () => {
        // eslint-disable-next-line local/code-no-any-casts
        assert.deepStrictEqual(testObject.getExtensionKind({ extensionPack: ['ext1', 'ext2'], contributes: { 'unknownPoint': { something: true } } }), isWeb ? ['workspace', 'web'] : ['workspace']);
    });
    test('simple declarative => ui, workspace, web', () => {
        assert.deepStrictEqual(testObject.getExtensionKind({}), ['ui', 'workspace', 'web']);
    });
    test('only browser => web', () => {
        assert.deepStrictEqual(testObject.getExtensionKind({ browser: 'main.browser.js' }), ['web']);
    });
    test('only main => workspace', () => {
        assert.deepStrictEqual(testObject.getExtensionKind({ main: 'main.js' }), ['workspace']);
    });
    test('main and browser => workspace, web in web and workspace in desktop', () => {
        assert.deepStrictEqual(testObject.getExtensionKind({ main: 'main.js', browser: 'main.browser.js' }), isWeb ? ['workspace', 'web'] : ['workspace']);
    });
    test('browser entry point with workspace extensionKind => workspace, web in web and workspace in desktop', () => {
        assert.deepStrictEqual(testObject.getExtensionKind({ main: 'main.js', browser: 'main.browser.js', extensionKind: ['workspace'] }), isWeb ? ['workspace', 'web'] : ['workspace']);
    });
    test('only browser entry point with out extensionKind => web', () => {
        assert.deepStrictEqual(testObject.getExtensionKind({ browser: 'main.browser.js' }), ['web']);
    });
    test('simple descriptive with workspace, ui extensionKind => workspace, ui, web in web and workspace, ui in desktop', () => {
        assert.deepStrictEqual(testObject.getExtensionKind({ extensionKind: ['workspace', 'ui'] }), isWeb ? ['workspace', 'ui', 'web'] : ['workspace', 'ui']);
    });
    test('opt out from web through settings even if it can run in web', () => {
        testObject = disposables.add(new ExtensionManifestPropertiesService(TestProductService, new TestConfigurationService({ remote: { extensionKind: { 'pub.a': ['-web'] } } }), new TestWorkspaceTrustEnablementService(), new NullLogService()));
        assert.deepStrictEqual(testObject.getExtensionKind({ browser: 'main.browser.js', publisher: 'pub', name: 'a' }), ['ui', 'workspace']);
    });
    test('opt out from web and include only workspace through settings even if it can run in web', () => {
        testObject = disposables.add(new ExtensionManifestPropertiesService(TestProductService, new TestConfigurationService({ remote: { extensionKind: { 'pub.a': ['-web', 'workspace'] } } }), new TestWorkspaceTrustEnablementService(), new NullLogService()));
        assert.deepStrictEqual(testObject.getExtensionKind({ browser: 'main.browser.js', publisher: 'pub', name: 'a' }), ['workspace']);
    });
    test('extension cannot opt out from web', () => {
        // eslint-disable-next-line local/code-no-any-casts
        assert.deepStrictEqual(testObject.getExtensionKind({ browser: 'main.browser.js', extensionKind: ['-web'] }), ['web']);
    });
    test('extension cannot opt into web', () => {
        // eslint-disable-next-line local/code-no-any-casts
        assert.deepStrictEqual(testObject.getExtensionKind({ main: 'main.js', extensionKind: ['web', 'workspace', 'ui'] }), ['workspace', 'ui']);
    });
    test('extension cannot opt into web only', () => {
        // eslint-disable-next-line local/code-no-any-casts
        assert.deepStrictEqual(testObject.getExtensionKind({ main: 'main.js', extensionKind: ['web'] }), ['workspace']);
    });
});
// Workspace Trust is disabled in web at the moment
if (!isWeb) {
    suite('ExtensionManifestPropertiesService - ExtensionUntrustedWorkspaceSupportType', () => {
        let testObject;
        let instantiationService;
        let testConfigurationService;
        setup(async () => {
            instantiationService = new TestInstantiationService();
            testConfigurationService = new TestConfigurationService();
            instantiationService.stub(IConfigurationService, testConfigurationService);
        });
        teardown(() => {
            testObject.dispose();
            instantiationService.dispose();
        });
        function assertUntrustedWorkspaceSupport(extensionManifest, expected) {
            testObject = instantiationService.createInstance(ExtensionManifestPropertiesService);
            const untrustedWorkspaceSupport = testObject.getExtensionUntrustedWorkspaceSupportType(extensionManifest);
            assert.strictEqual(untrustedWorkspaceSupport, expected);
        }
        function getExtensionManifest(properties = {}) {
            return Object.create({ name: 'a', publisher: 'pub', version: '1.0.0', ...properties });
        }
        test('test extension workspace trust request when main entry point is missing', () => {
            instantiationService.stub(IProductService, {});
            instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());
            const extensionManifest = getExtensionManifest();
            assertUntrustedWorkspaceSupport(extensionManifest, true);
        });
        test('test extension workspace trust request when workspace trust is disabled', async () => {
            instantiationService.stub(IProductService, {});
            instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService(false));
            const extensionManifest = getExtensionManifest({ main: './out/extension.js' });
            assertUntrustedWorkspaceSupport(extensionManifest, true);
        });
        test('test extension workspace trust request when "true" override exists in settings.json', async () => {
            instantiationService.stub(IProductService, {});
            instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());
            await testConfigurationService.setUserConfiguration('extensions', { supportUntrustedWorkspaces: { 'pub.a': { supported: true } } });
            const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
            assertUntrustedWorkspaceSupport(extensionManifest, true);
        });
        test('test extension workspace trust request when override (false) exists in settings.json', async () => {
            instantiationService.stub(IProductService, {});
            instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());
            await testConfigurationService.setUserConfiguration('extensions', { supportUntrustedWorkspaces: { 'pub.a': { supported: false } } });
            const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
            assertUntrustedWorkspaceSupport(extensionManifest, false);
        });
        test('test extension workspace trust request when override (true) for the version exists in settings.json', async () => {
            instantiationService.stub(IProductService, {});
            instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());
            await testConfigurationService.setUserConfiguration('extensions', { supportUntrustedWorkspaces: { 'pub.a': { supported: true, version: '1.0.0' } } });
            const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
            assertUntrustedWorkspaceSupport(extensionManifest, true);
        });
        test('test extension workspace trust request when override (false) for the version exists in settings.json', async () => {
            instantiationService.stub(IProductService, {});
            instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());
            await testConfigurationService.setUserConfiguration('extensions', { supportUntrustedWorkspaces: { 'pub.a': { supported: false, version: '1.0.0' } } });
            const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
            assertUntrustedWorkspaceSupport(extensionManifest, false);
        });
        test('test extension workspace trust request when override for a different version exists in settings.json', async () => {
            instantiationService.stub(IProductService, {});
            instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());
            await testConfigurationService.setUserConfiguration('extensions', { supportUntrustedWorkspaces: { 'pub.a': { supported: true, version: '2.0.0' } } });
            const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
            assertUntrustedWorkspaceSupport(extensionManifest, 'limited');
        });
        test('test extension workspace trust request when default (true) exists in product.json', () => {
            instantiationService.stub(IProductService, { extensionUntrustedWorkspaceSupport: { 'pub.a': { default: true } } });
            instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());
            const extensionManifest = getExtensionManifest({ main: './out/extension.js' });
            assertUntrustedWorkspaceSupport(extensionManifest, true);
        });
        test('test extension workspace trust request when default (false) exists in product.json', () => {
            instantiationService.stub(IProductService, { extensionUntrustedWorkspaceSupport: { 'pub.a': { default: false } } });
            instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());
            const extensionManifest = getExtensionManifest({ main: './out/extension.js' });
            assertUntrustedWorkspaceSupport(extensionManifest, false);
        });
        test('test extension workspace trust request when override (limited) exists in product.json', () => {
            instantiationService.stub(IProductService, { extensionUntrustedWorkspaceSupport: { 'pub.a': { override: 'limited' } } });
            instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());
            const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: true } } });
            assertUntrustedWorkspaceSupport(extensionManifest, 'limited');
        });
        test('test extension workspace trust request when override (false) exists in product.json', () => {
            instantiationService.stub(IProductService, { extensionUntrustedWorkspaceSupport: { 'pub.a': { override: false } } });
            instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());
            const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: true } } });
            assertUntrustedWorkspaceSupport(extensionManifest, false);
        });
        test('test extension workspace trust request when value exists in package.json', () => {
            instantiationService.stub(IProductService, {});
            instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());
            const extensionManifest = getExtensionManifest({ main: './out/extension.js', capabilities: { untrustedWorkspaces: { supported: 'limited' } } });
            assertUntrustedWorkspaceSupport(extensionManifest, 'limited');
        });
        test('test extension workspace trust request when no value exists in package.json', () => {
            instantiationService.stub(IProductService, {});
            instantiationService.stub(IWorkspaceTrustEnablementService, new TestWorkspaceTrustEnablementService());
            const extensionManifest = getExtensionManifest({ main: './out/extension.js' });
            assertUntrustedWorkspaceSupport(extensionManifest, false);
        });
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZS50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9leHRlbnNpb25zL3Rlc3QvY29tbW9uL2V4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUV6SCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUN6SCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzNGLE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzlHLE9BQU8sRUFBRSxrQ0FBa0MsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3hHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxtQ0FBbUMsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBRTNILEtBQUssQ0FBQyxvREFBb0QsRUFBRSxHQUFHLEVBQUU7SUFFaEUsSUFBSSxXQUE0QixDQUFDO0lBQ2pDLElBQUksVUFBOEMsQ0FBQztJQUVuRCxLQUFLLENBQUMsR0FBRyxFQUFFO1FBQ1YsV0FBVyxH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