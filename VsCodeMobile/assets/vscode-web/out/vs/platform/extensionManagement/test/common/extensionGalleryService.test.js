/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { isUUID } from '../../../../base/common/uuid.js';
import { mock } from '../../../../base/test/common/mock.js';
import { TestConfigurationService } from '../../../configuration/test/common/testConfigurationService.js';
import { sortExtensionVersions, filterLatestExtensionVersionsForTargetPlatform } from '../../common/extensionGalleryService.js';
import { FileService } from '../../../files/common/fileService.js';
import { InMemoryFileSystemProvider } from '../../../files/common/inMemoryFilesystemProvider.js';
import { NullLogService } from '../../../log/common/log.js';
import product from '../../../product/common/product.js';
import { resolveMarketplaceHeaders } from '../../../externalServices/common/marketplace.js';
import { InMemoryStorageService } from '../../../storage/common/storage.js';
import { TELEMETRY_SETTING_ID } from '../../../telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../../telemetry/common/telemetryUtils.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
class EnvironmentServiceMock extends mock() {
    constructor(serviceMachineIdResource) {
        super();
        this.serviceMachineIdResource = serviceMachineIdResource;
        this.isBuilt = true;
    }
}
suite('Extension Gallery Service', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let fileService, environmentService, storageService, productService, configurationService;
    setup(() => {
        const serviceMachineIdResource = joinPath(URI.file('tests').with({ scheme: 'vscode-tests' }), 'machineid');
        environmentService = new EnvironmentServiceMock(serviceMachineIdResource);
        fileService = disposables.add(new FileService(new NullLogService()));
        const fileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
        disposables.add(fileService.registerProvider(serviceMachineIdResource.scheme, fileSystemProvider));
        storageService = disposables.add(new InMemoryStorageService());
        configurationService = new TestConfigurationService({ [TELEMETRY_SETTING_ID]: "all" /* TelemetryConfiguration.ON */ });
        configurationService.updateValue(TELEMETRY_SETTING_ID, "all" /* TelemetryConfiguration.ON */);
        productService = { _serviceBrand: undefined, ...product, enableTelemetry: true };
    });
    test('marketplace machine id', async () => {
        const headers = await resolveMarketplaceHeaders(product.version, productService, environmentService, configurationService, fileService, storageService, NullTelemetryService);
        assert.ok(headers['X-Market-User-Id']);
        assert.ok(isUUID(headers['X-Market-User-Id']));
        const headers2 = await resolveMarketplaceHeaders(product.version, productService, environmentService, configurationService, fileService, storageService, NullTelemetryService);
        assert.strictEqual(headers['X-Market-User-Id'], headers2['X-Market-User-Id']);
    });
    test('sorting single extension version without target platform', async () => {
        const actual = [aExtensionVersion('1.1.2')];
        const expected = [...actual];
        sortExtensionVersions(actual, "darwin-x64" /* TargetPlatform.DARWIN_X64 */);
        assert.deepStrictEqual(actual, expected);
    });
    test('sorting single extension version with preferred target platform', async () => {
        const actual = [aExtensionVersion('1.1.2', "darwin-x64" /* TargetPlatform.DARWIN_X64 */)];
        const expected = [...actual];
        sortExtensionVersions(actual, "darwin-x64" /* TargetPlatform.DARWIN_X64 */);
        assert.deepStrictEqual(actual, expected);
    });
    test('sorting single extension version with not compatible target platform', async () => {
        const actual = [aExtensionVersion('1.1.2', "darwin-arm64" /* TargetPlatform.DARWIN_ARM64 */)];
        const expected = [...actual];
        sortExtensionVersions(actual, "win32-x64" /* TargetPlatform.WIN32_X64 */);
        assert.deepStrictEqual(actual, expected);
    });
    test('sorting multiple extension versions without target platforms', async () => {
        const actual = [aExtensionVersion('1.2.4'), aExtensionVersion('1.1.3'), aExtensionVersion('1.1.2'), aExtensionVersion('1.1.1')];
        const expected = [...actual];
        sortExtensionVersions(actual, "win32-arm64" /* TargetPlatform.WIN32_ARM64 */);
        assert.deepStrictEqual(actual, expected);
    });
    test('sorting multiple extension versions with target platforms - 1', async () => {
        const actual = [aExtensionVersion('1.2.4', "darwin-arm64" /* TargetPlatform.DARWIN_ARM64 */), aExtensionVersion('1.2.4', "win32-arm64" /* TargetPlatform.WIN32_ARM64 */), aExtensionVersion('1.2.4', "linux-arm64" /* TargetPlatform.LINUX_ARM64 */), aExtensionVersion('1.1.3'), aExtensionVersion('1.1.2'), aExtensionVersion('1.1.1')];
        const expected = [actual[1], actual[0], actual[2], actual[3], actual[4], actual[5]];
        sortExtensionVersions(actual, "win32-arm64" /* TargetPlatform.WIN32_ARM64 */);
        assert.deepStrictEqual(actual, expected);
    });
    test('sorting multiple extension versions with target platforms - 2', async () => {
        const actual = [aExtensionVersion('1.2.4'), aExtensionVersion('1.2.3', "darwin-arm64" /* TargetPlatform.DARWIN_ARM64 */), aExtensionVersion('1.2.3', "win32-arm64" /* TargetPlatform.WIN32_ARM64 */), aExtensionVersion('1.2.3', "linux-arm64" /* TargetPlatform.LINUX_ARM64 */), aExtensionVersion('1.1.2'), aExtensionVersion('1.1.1')];
        const expected = [actual[0], actual[3], actual[1], actual[2], actual[4], actual[5]];
        sortExtensionVersions(actual, "linux-arm64" /* TargetPlatform.LINUX_ARM64 */);
        assert.deepStrictEqual(actual, expected);
    });
    test('sorting multiple extension versions with target platforms - 3', async () => {
        const actual = [aExtensionVersion('1.2.4'), aExtensionVersion('1.1.2'), aExtensionVersion('1.1.1'), aExtensionVersion('1.0.0', "darwin-arm64" /* TargetPlatform.DARWIN_ARM64 */), aExtensionVersion('1.0.0', "win32-arm64" /* TargetPlatform.WIN32_ARM64 */)];
        const expected = [actual[0], actual[1], actual[2], actual[4], actual[3]];
        sortExtensionVersions(actual, "win32-arm64" /* TargetPlatform.WIN32_ARM64 */);
        assert.deepStrictEqual(actual, expected);
    });
    function aExtensionVersion(version, targetPlatform) {
        return { version, targetPlatform };
    }
    function aPreReleaseExtensionVersion(version, targetPlatform) {
        return {
            version,
            targetPlatform,
            properties: [{ key: 'Microsoft.VisualStudio.Code.PreRelease', value: 'true' }]
        };
    }
    suite('filterLatestExtensionVersionsForTargetPlatform', () => {
        test('should return empty array for empty input', () => {
            const result = filterLatestExtensionVersionsForTargetPlatform([], "win32-x64" /* TargetPlatform.WIN32_X64 */, ["win32-x64" /* TargetPlatform.WIN32_X64 */]);
            assert.deepStrictEqual(result, []);
        });
        test('should return single version when only one version provided', () => {
            const versions = [aExtensionVersion('1.0.0', "win32-x64" /* TargetPlatform.WIN32_X64 */)];
            const allTargetPlatforms = ["win32-x64" /* TargetPlatform.WIN32_X64 */];
            const result = filterLatestExtensionVersionsForTargetPlatform(versions, "win32-x64" /* TargetPlatform.WIN32_X64 */, allTargetPlatforms);
            assert.deepStrictEqual(result, versions);
        });
        test('should filter out duplicate target platforms for release versions', () => {
            const version1 = aExtensionVersion('1.0.0', "win32-x64" /* TargetPlatform.WIN32_X64 */);
            const version2 = aExtensionVersion('0.9.0', "win32-x64" /* TargetPlatform.WIN32_X64 */); // Same platform, older version
            const versions = [version1, version2];
            const allTargetPlatforms = ["win32-x64" /* TargetPlatform.WIN32_X64 */];
            const result = filterLatestExtensionVersionsForTargetPlatform(versions, "win32-x64" /* TargetPlatform.WIN32_X64 */, allTargetPlatforms);
            // Should only include the first version (latest) for this platform
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0], version1);
        });
        test('should include one version per target platform for release versions', () => {
            const version1 = aExtensionVersion('1.0.0', "win32-x64" /* TargetPlatform.WIN32_X64 */);
            const version2 = aExtensionVersion('1.0.0', "darwin-x64" /* TargetPlatform.DARWIN_X64 */);
            const version3 = aExtensionVersion('1.0.0', "linux-x64" /* TargetPlatform.LINUX_X64 */);
            const versions = [version1, version2, version3];
            const allTargetPlatforms = ["win32-x64" /* TargetPlatform.WIN32_X64 */, "darwin-x64" /* TargetPlatform.DARWIN_X64 */, "linux-x64" /* TargetPlatform.LINUX_X64 */];
            const result = filterLatestExtensionVersionsForTargetPlatform(versions, "win32-x64" /* TargetPlatform.WIN32_X64 */, allTargetPlatforms);
            // Should include all three versions: WIN32_X64 (compatible, first of type) + DARWIN_X64 & LINUX_X64 (non-compatible)
            assert.strictEqual(result.length, 3);
            assert.ok(result.includes(version1)); // Compatible with target platform
            assert.ok(result.includes(version2)); // Non-compatible, included
            assert.ok(result.includes(version3)); // Non-compatible, included
        });
        test('should separate release and pre-release versions', () => {
            const releaseVersion = aExtensionVersion('1.0.0', "win32-x64" /* TargetPlatform.WIN32_X64 */);
            const preReleaseVersion = aPreReleaseExtensionVersion('1.1.0', "win32-x64" /* TargetPlatform.WIN32_X64 */);
            const versions = [releaseVersion, preReleaseVersion];
            const allTargetPlatforms = ["win32-x64" /* TargetPlatform.WIN32_X64 */];
            const result = filterLatestExtensionVersionsForTargetPlatform(versions, "win32-x64" /* TargetPlatform.WIN32_X64 */, allTargetPlatforms);
            // Should include both since they are different types (release vs pre-release)
            assert.strictEqual(result.length, 2);
            assert.ok(result.includes(releaseVersion));
            assert.ok(result.includes(preReleaseVersion));
        });
        test('should filter duplicate pre-release versions by target platform', () => {
            const preRelease1 = aPreReleaseExtensionVersion('1.1.0', "win32-x64" /* TargetPlatform.WIN32_X64 */);
            const preRelease2 = aPreReleaseExtensionVersion('1.0.0', "win32-x64" /* TargetPlatform.WIN32_X64 */); // Same platform, older
            const versions = [preRelease1, preRelease2];
            const allTargetPlatforms = ["win32-x64" /* TargetPlatform.WIN32_X64 */];
            const result = filterLatestExtensionVersionsForTargetPlatform(versions, "win32-x64" /* TargetPlatform.WIN32_X64 */, allTargetPlatforms);
            // Should only include the first pre-release version for this platform
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0], preRelease1);
        });
        test('should handle versions without target platform (UNDEFINED)', () => {
            const version1 = aExtensionVersion('1.0.0'); // No target platform specified
            const version2 = aExtensionVersion('0.9.0'); // No target platform specified
            const versions = [version1, version2];
            const allTargetPlatforms = ["win32-x64" /* TargetPlatform.WIN32_X64 */];
            const result = filterLatestExtensionVersionsForTargetPlatform(versions, "win32-x64" /* TargetPlatform.WIN32_X64 */, allTargetPlatforms);
            // Should only include the first version since they both have UNDEFINED platform
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0], version1);
        });
        test('should handle mixed release and pre-release versions across multiple platforms', () => {
            const releaseWin = aExtensionVersion('1.0.0', "win32-x64" /* TargetPlatform.WIN32_X64 */);
            const releaseMac = aExtensionVersion('1.0.0', "darwin-x64" /* TargetPlatform.DARWIN_X64 */);
            const preReleaseWin = aPreReleaseExtensionVersion('1.1.0', "win32-x64" /* TargetPlatform.WIN32_X64 */);
            const preReleaseMac = aPreReleaseExtensionVersion('1.1.0', "darwin-x64" /* TargetPlatform.DARWIN_X64 */);
            const oldReleaseWin = aExtensionVersion('0.9.0', "win32-x64" /* TargetPlatform.WIN32_X64 */); // Should be filtered out
            const versions = [releaseWin, releaseMac, preReleaseWin, preReleaseMac, oldReleaseWin];
            const allTargetPlatforms = ["win32-x64" /* TargetPlatform.WIN32_X64 */, "darwin-x64" /* TargetPlatform.DARWIN_X64 */];
            const result = filterLatestExtensionVersionsForTargetPlatform(versions, "win32-x64" /* TargetPlatform.WIN32_X64 */, allTargetPlatforms);
            // Should include: WIN32_X64 compatible (release + prerelease) + DARWIN_X64 non-compatible (all versions)
            assert.strictEqual(result.length, 4);
            assert.ok(result.includes(releaseWin)); // Compatible release
            assert.ok(result.includes(releaseMac)); // Non-compatible, included
            assert.ok(result.includes(preReleaseWin)); // Compatible pre-release
            assert.ok(result.includes(preReleaseMac)); // Non-compatible, included
            assert.ok(!result.includes(oldReleaseWin)); // Filtered (older compatible release)
        });
        test('should handle complex scenario with multiple versions and platforms', () => {
            const versions = [
                aExtensionVersion('2.0.0', "win32-x64" /* TargetPlatform.WIN32_X64 */),
                aExtensionVersion('2.0.0', "darwin-x64" /* TargetPlatform.DARWIN_X64 */),
                aExtensionVersion('1.9.0', "win32-x64" /* TargetPlatform.WIN32_X64 */), // Older release, same platform
                aPreReleaseExtensionVersion('2.1.0', "win32-x64" /* TargetPlatform.WIN32_X64 */),
                aPreReleaseExtensionVersion('2.0.5', "win32-x64" /* TargetPlatform.WIN32_X64 */), // Older pre-release, same platform
                aPreReleaseExtensionVersion('2.1.0', "linux-x64" /* TargetPlatform.LINUX_X64 */),
                aExtensionVersion('2.0.0'), // No platform specified
                aPreReleaseExtensionVersion('2.1.0'), // Pre-release, no platform specified
            ];
            const allTargetPlatforms = ["win32-x64" /* TargetPlatform.WIN32_X64 */, "darwin-x64" /* TargetPlatform.DARWIN_X64 */, "linux-x64" /* TargetPlatform.LINUX_X64 */];
            const result = filterLatestExtensionVersionsForTargetPlatform(versions, "win32-x64" /* TargetPlatform.WIN32_X64 */, allTargetPlatforms);
            // Expected for WIN32_X64 target platform:
            // - Compatible (WIN32_X64 + UNDEFINED): Only first release and first pre-release
            // - Non-compatible: DARWIN_X64 release, LINUX_X64 pre-release
            // Total: 4 versions (1 compatible release + 1 compatible pre-release + 2 non-compatible)
            assert.strictEqual(result.length, 4);
            // Check specific versions are included
            assert.ok(result.includes(versions[0])); // 2.0.0 WIN32_X64 (first compatible release)
            assert.ok(result.includes(versions[1])); // 2.0.0 DARWIN_X64 (non-compatible)
            assert.ok(result.includes(versions[3])); // 2.1.0 WIN32_X64 (first compatible pre-release)
            assert.ok(result.includes(versions[5])); // 2.1.0 LINUX_X64 (non-compatible)
        });
        test('should handle UNDEFINED platform interaction with specific platforms', () => {
            // Test how UNDEFINED platform interacts with specific platforms
            const versions = [
                aExtensionVersion('1.0.0', "win32-x64" /* TargetPlatform.WIN32_X64 */),
                aExtensionVersion('1.0.0'), // UNDEFINED platform - compatible with all
            ];
            const allTargetPlatforms = ["win32-x64" /* TargetPlatform.WIN32_X64 */, "darwin-x64" /* TargetPlatform.DARWIN_X64 */];
            const result = filterLatestExtensionVersionsForTargetPlatform(versions, "win32-x64" /* TargetPlatform.WIN32_X64 */, allTargetPlatforms);
            // Both are compatible with WIN32_X64, but only the first of each type should be included
            // Since both are release versions, only the first one should be included
            assert.strictEqual(result.length, 1);
            assert.ok(result.includes(versions[0])); // WIN32_X64 should be included (first release)
        });
        test('should handle higher version with specific platform vs lower version with universal platform', () => {
            // Scenario: newer version for specific platform vs older version with universal compatibility
            const higherVersionSpecificPlatform = aExtensionVersion('2.0.0', "win32-x64" /* TargetPlatform.WIN32_X64 */);
            const lowerVersionUniversal = aExtensionVersion('1.5.0'); // UNDEFINED/universal platform
            const versions = [higherVersionSpecificPlatform, lowerVersionUniversal];
            const allTargetPlatforms = ["win32-x64" /* TargetPlatform.WIN32_X64 */, "darwin-x64" /* TargetPlatform.DARWIN_X64 */];
            const result = filterLatestExtensionVersionsForTargetPlatform(versions, "win32-x64" /* TargetPlatform.WIN32_X64 */, allTargetPlatforms);
            // Both are compatible with WIN32_X64, but only the first release version should be included
            assert.strictEqual(result.length, 1);
            assert.ok(result.includes(higherVersionSpecificPlatform)); // First compatible release
            assert.ok(!result.includes(lowerVersionUniversal)); // Filtered (second compatible release)
        });
        test('should handle lower version with specific platform vs higher version with universal platform', () => {
            // Reverse scenario: older version for specific platform vs newer version with universal compatibility
            const lowerVersionSpecificPlatform = aExtensionVersion('1.0.0', "win32-x64" /* TargetPlatform.WIN32_X64 */);
            const higherVersionUniversal = aExtensionVersion('2.0.0'); // UNDEFINED/universal platform
            const versions = [lowerVersionSpecificPlatform, higherVersionUniversal];
            const allTargetPlatforms = ["win32-x64" /* TargetPlatform.WIN32_X64 */, "darwin-x64" /* TargetPlatform.DARWIN_X64 */];
            const result = filterLatestExtensionVersionsForTargetPlatform(versions, "win32-x64" /* TargetPlatform.WIN32_X64 */, allTargetPlatforms);
            // Both are compatible with WIN32_X64, but only the first release version should be included
            assert.strictEqual(result.length, 1);
            assert.ok(result.includes(lowerVersionSpecificPlatform)); // First compatible release
            assert.ok(!result.includes(higherVersionUniversal)); // Filtered (second compatible release)
        });
        test('should handle multiple specific platforms vs universal platform with version differences', () => {
            // Complex scenario with multiple platforms and universal compatibility
            const versions = [
                aExtensionVersion('2.0.0', "win32-x64" /* TargetPlatform.WIN32_X64 */), // Highest version, specific platform
                aExtensionVersion('1.9.0', "darwin-x64" /* TargetPlatform.DARWIN_X64 */), // Lower version, different specific platform
                aExtensionVersion('1.8.0'), // Lowest version, universal platform
                aExtensionVersion('1.7.0', "win32-x64" /* TargetPlatform.WIN32_X64 */), // Even older, same platform as first - should be filtered
            ];
            const allTargetPlatforms = ["win32-x64" /* TargetPlatform.WIN32_X64 */, "darwin-x64" /* TargetPlatform.DARWIN_X64 */, "linux-x64" /* TargetPlatform.LINUX_X64 */];
            const result = filterLatestExtensionVersionsForTargetPlatform(versions, "win32-x64" /* TargetPlatform.WIN32_X64 */, allTargetPlatforms);
            // Should include:
            // - 2.0.0 WIN32_X64 (first compatible release for WIN32_X64)
            // - 1.9.0 DARWIN_X64 (non-compatible, included)
            // - 1.8.0 UNDEFINED (second compatible release, filtered)
            // Should NOT include:
            // - 1.7.0 WIN32_X64 (third compatible release, filtered)
            assert.strictEqual(result.length, 2);
            assert.ok(result.includes(versions[0])); // 2.0.0 WIN32_X64
            assert.ok(result.includes(versions[1])); // 1.9.0 DARWIN_X64
            assert.ok(!result.includes(versions[2])); // 1.8.0 UNDEFINED should be filtered
            assert.ok(!result.includes(versions[3])); // 1.7.0 WIN32_X64 should be filtered
        });
        test('should include universal platform when no specific platforms conflict', () => {
            // Test where universal platform is included because no specific platforms conflict
            const universalVersion = aExtensionVersion('1.0.0'); // UNDEFINED/universal platform
            const specificVersion = aExtensionVersion('1.0.0', "linux-arm64" /* TargetPlatform.LINUX_ARM64 */);
            const versions = [universalVersion, specificVersion];
            const allTargetPlatforms = ["win32-x64" /* TargetPlatform.WIN32_X64 */, "darwin-x64" /* TargetPlatform.DARWIN_X64 */]; // Note: LINUX_ARM64 not in target platforms
            const result = filterLatestExtensionVersionsForTargetPlatform(versions, "win32-x64" /* TargetPlatform.WIN32_X64 */, allTargetPlatforms);
            // Universal is compatible with WIN32_X64, specific version is not compatible
            // So we should get: universal (first compatible release) + specific (non-compatible)
            assert.strictEqual(result.length, 2);
            assert.ok(result.includes(universalVersion)); // Compatible with WIN32_X64
            assert.ok(result.includes(specificVersion)); // Non-compatible, included
        });
        test('should preserve order of input when no filtering occurs', () => {
            const version1 = aExtensionVersion('1.0.0', "win32-x64" /* TargetPlatform.WIN32_X64 */);
            const version2 = aExtensionVersion('1.0.0', "darwin-x64" /* TargetPlatform.DARWIN_X64 */);
            const version3 = aPreReleaseExtensionVersion('1.1.0', "linux-x64" /* TargetPlatform.LINUX_X64 */);
            const versions = [version1, version2, version3];
            const allTargetPlatforms = ["win32-x64" /* TargetPlatform.WIN32_X64 */, "darwin-x64" /* TargetPlatform.DARWIN_X64 */, "linux-x64" /* TargetPlatform.LINUX_X64 */];
            const result = filterLatestExtensionVersionsForTargetPlatform(versions, "win32-x64" /* TargetPlatform.WIN32_X64 */, allTargetPlatforms);
            // For WIN32_X64 target: version1 (compatible release) + version2, version3 (non-compatible)
            assert.strictEqual(result.length, 3);
            assert.ok(result.includes(version1)); // Compatible release
            assert.ok(result.includes(version2)); // Non-compatible, included
            assert.ok(result.includes(version3)); // Non-compatible, included
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L3Rlc3QvY29tbW9uL2V4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUU1RCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUUxRyxPQUFPLEVBQStCLHFCQUFxQixFQUFFLDhDQUE4QyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFFN0osT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUM1RCxPQUFPLE9BQU8sTUFBTSxvQ0FBb0MsQ0FBQztBQUV6RCxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUM1RixPQUFPLEVBQUUsc0JBQXNCLEVBQW1CLE1BQU0sb0NBQW9DLENBQUM7QUFDN0YsT0FBTyxFQUEwQixvQkFBb0IsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRXRHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ25GLE9BQU8sRUFBRSx1Q0FB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