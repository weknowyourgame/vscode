/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CancellationToken } from '../../../base/common/cancellation.js';
import { EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT } from './extensionManagement.js';
import { areSameExtensions, getExtensionId } from './extensionManagementUtil.js';
import * as semver from '../../../base/common/semver/semver.js';
/**
 * Migrates the installed unsupported nightly extension to a supported pre-release extension. It includes following:
 * 	- Uninstall the Unsupported extension
 * 	- Install (with optional storage migration) the Pre-release extension only if
 * 		- the extension is not installed
 * 		- or it is a release version and the unsupported extension is enabled.
 */
export async function migrateUnsupportedExtensions(extensionManagementService, galleryService, extensionStorageService, extensionEnablementService, logService) {
    try {
        const extensionsControlManifest = await extensionManagementService.getExtensionsControlManifest();
        if (!extensionsControlManifest.deprecated) {
            return;
        }
        const installed = await extensionManagementService.getInstalled(1 /* ExtensionType.User */);
        for (const [unsupportedExtensionId, deprecated] of Object.entries(extensionsControlManifest.deprecated)) {
            if (!deprecated?.extension) {
                continue;
            }
            const { id: preReleaseExtensionId, autoMigrate, preRelease } = deprecated.extension;
            if (!autoMigrate) {
                continue;
            }
            const unsupportedExtension = installed.find(i => areSameExtensions(i.identifier, { id: unsupportedExtensionId }));
            // Unsupported Extension is not installed
            if (!unsupportedExtension) {
                continue;
            }
            const gallery = (await galleryService.getExtensions([{ id: preReleaseExtensionId, preRelease }], { targetPlatform: await extensionManagementService.getTargetPlatform(), compatible: true }, CancellationToken.None))[0];
            if (!gallery) {
                logService.info(`Skipping migrating '${unsupportedExtension.identifier.id}' extension because, the comaptible target '${preReleaseExtensionId}' extension is not found`);
                continue;
            }
            try {
                logService.info(`Migrating '${unsupportedExtension.identifier.id}' extension to '${preReleaseExtensionId}' extension...`);
                const isUnsupportedExtensionEnabled = !extensionEnablementService.getDisabledExtensions().some(e => areSameExtensions(e, unsupportedExtension.identifier));
                await extensionManagementService.uninstall(unsupportedExtension);
                logService.info(`Uninstalled the unsupported extension '${unsupportedExtension.identifier.id}'`);
                let preReleaseExtension = installed.find(i => areSameExtensions(i.identifier, { id: preReleaseExtensionId }));
                if (!preReleaseExtension || (!preReleaseExtension.isPreReleaseVersion && isUnsupportedExtensionEnabled)) {
                    preReleaseExtension = await extensionManagementService.installFromGallery(gallery, { installPreReleaseVersion: true, isMachineScoped: unsupportedExtension.isMachineScoped, operation: 4 /* InstallOperation.Migrate */, context: { [EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT]: true } });
                    logService.info(`Installed the pre-release extension '${preReleaseExtension.identifier.id}'`);
                    if (!isUnsupportedExtensionEnabled) {
                        await extensionEnablementService.disableExtension(preReleaseExtension.identifier);
                        logService.info(`Disabled the pre-release extension '${preReleaseExtension.identifier.id}' because the unsupported extension '${unsupportedExtension.identifier.id}' is disabled`);
                    }
                    if (autoMigrate.storage) {
                        extensionStorageService.addToMigrationList(getExtensionId(unsupportedExtension.manifest.publisher, unsupportedExtension.manifest.name), getExtensionId(preReleaseExtension.manifest.publisher, preReleaseExtension.manifest.name));
                        logService.info(`Added pre-release extension to the storage migration list`);
                    }
                }
                logService.info(`Migrated '${unsupportedExtension.identifier.id}' extension to '${preReleaseExtensionId}' extension.`);
            }
            catch (error) {
                logService.error(error);
            }
        }
        if (extensionsControlManifest.autoUpdate) {
            for (const [extensionId, version] of Object.entries(extensionsControlManifest.autoUpdate)) {
                try {
                    const extensionToAutoUpdate = installed.find(i => areSameExtensions(i.identifier, { id: extensionId }) && semver.lte(i.manifest.version, version));
                    if (!extensionToAutoUpdate) {
                        continue;
                    }
                    const gallery = (await galleryService.getExtensions([{ id: extensionId, preRelease: extensionToAutoUpdate.preRelease }], { targetPlatform: await extensionManagementService.getTargetPlatform(), compatible: true }, CancellationToken.None))[0];
                    if (!gallery) {
                        logService.info(`Skipping updating '${extensionToAutoUpdate.identifier.id}' extension because, the compatible target '${extensionId}' extension is not found`);
                        continue;
                    }
                    await extensionManagementService.installFromGallery(gallery, { installPreReleaseVersion: extensionToAutoUpdate.preRelease, isMachineScoped: extensionToAutoUpdate.isMachineScoped, operation: 3 /* InstallOperation.Update */, context: { [EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT]: true } });
                    logService.info(`Autoupdated '${extensionToAutoUpdate.identifier.id}' extension to '${gallery.version}' extension.`);
                }
                catch (error) {
                    logService.error(error);
                }
            }
        }
    }
    catch (error) {
        logService.error(error);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5zdXBwb3J0ZWRFeHRlbnNpb25zTWlncmF0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL3Vuc3VwcG9ydGVkRXh0ZW5zaW9uc01pZ3JhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsOENBQThDLEVBQThHLE1BQU0sMEJBQTBCLENBQUM7QUFDdE0sT0FBTyxFQUFFLGlCQUFpQixFQUFFLGNBQWMsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBSWpGLE9BQU8sS0FBSyxNQUFNLE1BQU0sdUNBQXVDLENBQUM7QUFFaEU7Ozs7OztHQU1HO0FBQ0gsTUFBTSxDQUFDLEtBQUssVUFBVSw0QkFBNEIsQ0FBQywwQkFBdUQsRUFBRSxjQUF3QyxFQUFFLHVCQUFpRCxFQUFFLDBCQUE2RCxFQUFFLFVBQXVCO0lBQzlSLElBQUksQ0FBQztRQUNKLE1BQU0seUJBQXlCLEdBQUcsTUFBTSwwQkFBMEIsQ0FBQyw0QkFBNEIsRUFBRSxDQUFDO1FBQ2xHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUMzQyxPQUFPO1FBQ1IsQ0FBQztRQUNELE1BQU0sU0FBUyxHQUFHLE1BQU0sMEJBQTBCLENBQUMsWUFBWSw0QkFBb0IsQ0FBQztRQUNwRixLQUFLLE1BQU0sQ0FBQyxzQkFBc0IsRUFBRSxVQUFVLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLHlCQUF5QixDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7WUFDekcsSUFBSSxDQUFDLFVBQVUsRUFBRSxTQUFTLEVBQUUsQ0FBQztnQkFDNUIsU0FBUztZQUNWLENBQUM7WUFDRCxNQUFNLEVBQUUsRUFBRSxFQUFFLHFCQUFx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