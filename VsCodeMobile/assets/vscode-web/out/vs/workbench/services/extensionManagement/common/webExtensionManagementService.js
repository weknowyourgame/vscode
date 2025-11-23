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
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { IExtensionGalleryService, IAllowedExtensionsService } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { URI } from '../../../../base/common/uri.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { areSameExtensions, getGalleryExtensionId } from '../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { IWebExtensionsScannerService } from './extensionManagement.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { AbstractExtensionManagementService, AbstractExtensionTask, toExtensionManagementError } from '../../../../platform/extensionManagement/common/abstractExtensionManagementService.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IExtensionManifestPropertiesService } from '../../extensions/common/extensionManifestPropertiesService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { isBoolean, isUndefined } from '../../../../base/common/types.js';
import { IUserDataProfileService } from '../../userDataProfile/common/userDataProfile.js';
import { delta } from '../../../../base/common/arrays.js';
import { compare } from '../../../../base/common/strings.js';
import { IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
let WebExtensionManagementService = class WebExtensionManagementService extends AbstractExtensionManagementService {
    get onProfileAwareInstallExtension() { return super.onInstallExtension; }
    get onInstallExtension() { return Event.filter(this.onProfileAwareInstallExtension, e => this.filterEvent(e), this.disposables); }
    get onProfileAwareDidInstallExtensions() { return super.onDidInstallExtensions; }
    get onDidInstallExtensions() {
        return Event.filter(Event.map(this.onProfileAwareDidInstallExtensions, results => results.filter(e => this.filterEvent(e)), this.disposables), results => results.length > 0, this.disposables);
    }
    get onProfileAwareUninstallExtension() { return super.onUninstallExtension; }
    get onUninstallExtension() { return Event.filter(this.onProfileAwareUninstallExtension, e => this.filterEvent(e), this.disposables); }
    get onProfileAwareDidUninstallExtension() { return super.onDidUninstallExtension; }
    get onDidUninstallExtension() { return Event.filter(this.onProfileAwareDidUninstallExtension, e => this.filterEvent(e), this.disposables); }
    get onProfileAwareDidUpdateExtensionMetadata() { return super.onDidUpdateExtensionMetadata; }
    constructor(extensionGalleryService, telemetryService, logService, webExtensionsScannerService, extensionManifestPropertiesService, userDataProfileService, productService, allowedExtensionsService, userDataProfilesService, uriIdentityService) {
        super(extensionGalleryService, telemetryService, uriIdentityService, logService, productService, allowedExtensionsService, userDataProfilesService);
        this.webExtensionsScannerService = webExtensionsScannerService;
        this.extensionManifestPropertiesService = extensionManifestPropertiesService;
        this.userDataProfileService = userDataProfileService;
        this.disposables = this._register(new DisposableStore());
        this._onDidChangeProfile = this._register(new Emitter());
        this.onDidChangeProfile = this._onDidChangeProfile.event;
        this._register(userDataProfileService.onDidChangeCurrentProfile(e => {
            if (!this.uriIdentityService.extUri.isEqual(e.previous.extensionsResource, e.profile.extensionsResource)) {
                e.join(this.whenProfileChanged(e));
            }
        }));
    }
    filterEvent({ profileLocation, applicationScoped }) {
        profileLocation = profileLocation ?? this.userDataProfileService.currentProfile.extensionsResource;
        return applicationScoped || this.uriIdentityService.extUri.isEqual(this.userDataProfileService.currentProfile.extensionsResource, profileLocation);
    }
    async getTargetPlatform() {
        return "web" /* TargetPlatform.WEB */;
    }
    async isExtensionPlatformCompatible(extension) {
        if (this.isConfiguredToExecuteOnWeb(extension)) {
            return true;
        }
        return super.isExtensionPlatformCompatible(extension);
    }
    async getInstalled(type, profileLocation) {
        const extensions = [];
        if (type === undefined || type === 0 /* ExtensionType.System */) {
            const systemExtensions = await this.webExtensionsScannerService.scanSystemExtensions();
            extensions.push(...systemExtensions);
        }
        if (type === undefined || type === 1 /* ExtensionType.User */) {
            const userExtensions = await this.webExtensionsScannerService.scanUserExtensions(profileLocation ?? this.userDataProfileService.currentProfile.extensionsResource);
            extensions.push(...userExtensions);
        }
        return extensions.map(e => toLocalExtension(e));
    }
    async install(location, options = {}) {
        this.logService.trace('ExtensionManagementService#install', location.toString());
        const manifest = await this.webExtensionsScannerService.scanExtensionManifest(location);
        if (!manifest || !manifest.name || !manifest.version) {
            throw new Error(`Cannot find a valid extension from the location ${location.toString()}`);
        }
        const result = await this.installExtensions([{ manifest, extension: location, options }]);
        if (result[0]?.local) {
            return result[0]?.local;
        }
        if (result[0]?.error) {
            throw result[0].error;
        }
        throw toExtensionManagementError(new Error(`Unknown error while installing extension ${getGalleryExtensionId(manifest.publisher, manifest.name)}`));
    }
    installFromLocation(location, profileLocation) {
        return this.install(location, { profileLocation });
    }
    async deleteExtension(extension) {
        // do nothing
    }
    async copyExtension(extension, fromProfileLocation, toProfileLocation, metadata) {
        const target = await this.webExtensionsScannerService.scanExistingExtension(extension.location, extension.type, toProfileLocation);
        const source = await this.webExtensionsScannerService.scanExistingExtension(extension.location, extension.type, fromProfileLocation);
        metadata = { ...source?.metadata, ...metadata };
        let scanned;
        if (target) {
            scanned = await this.webExtensionsScannerService.updateMetadata(extension, { ...target.metadata, ...metadata }, toProfileLocation);
        }
        else {
            scanned = await this.webExtensionsScannerService.addExtension(extension.location, metadata, toProfileLocation);
        }
        return toLocalExtension(scanned);
    }
    async moveExtension(extension, fromProfileLocation, toProfileLocation, metadata) {
        const target = await this.webExtensionsScannerService.scanExistingExtension(extension.location, extension.type, toProfileLocation);
        const source = await this.webExtensionsScannerService.scanExistingExtension(extension.location, extension.type, fromProfileLocation);
        metadata = { ...source?.metadata, ...metadata };
        let scanned;
        if (target) {
            scanned = await this.webExtensionsScannerService.updateMetadata(extension, { ...target.metadata, ...metadata }, toProfileLocation);
        }
        else {
            scanned = await this.webExtensionsScannerService.addExtension(extension.location, metadata, toProfileLocation);
            if (source) {
                await this.webExtensionsScannerService.removeExtension(source, fromProfileLocation);
            }
        }
        return toLocalExtension(scanned);
    }
    async removeExtension(extension, fromProfileLocation) {
        const source = await this.webExtensionsScannerService.scanExistingExtension(extension.location, extension.type, fromProfileLocation);
        if (source) {
            await this.webExtensionsScannerService.removeExtension(source, fromProfileLocation);
        }
    }
    async installExtensionsFromProfile(extensions, fromProfileLocation, toProfileLocation) {
        const result = [];
        const extensionsToInstall = (await this.webExtensionsScannerService.scanUserExtensions(fromProfileLocation))
            .filter(e => extensions.some(id => areSameExtensions(id, e.identifier)));
        if (extensionsToInstall.length) {
            await Promise.allSettled(extensionsToInstall.map(async (e) => {
                let local = await this.installFromLocation(e.location, toProfileLocation);
                if (e.metadata) {
                    local = await this.updateMetadata(local, e.metadata, fromProfileLocation);
                }
                result.push(local);
            }));
        }
        return result;
    }
    async updateMetadata(local, metadata, profileLocation) {
        // unset if false
        if (metadata.isMachineScoped === false) {
            metadata.isMachineScoped = undefined;
        }
        if (metadata.isBuiltin === false) {
            metadata.isBuiltin = undefined;
        }
        if (metadata.pinned === false) {
            metadata.pinned = undefined;
        }
        const updatedExtension = await this.webExtensionsScannerService.updateMetadata(local, metadata, profileLocation);
        const updatedLocalExtension = toLocalExtension(updatedExtension);
        this._onDidUpdateExtensionMetadata.fire({ local: updatedLocalExtension, profileLocation });
        return updatedLocalExtension;
    }
    async copyExtensions(fromProfileLocation, toProfileLocation) {
        await this.webExtensionsScannerService.copyExtensions(fromProfileLocation, toProfileLocation, e => !e.metadata?.isApplicationScoped);
    }
    async getCompatibleVersion(extension, sameVersion, includePreRelease, productVersion) {
        const compatibleExtension = await super.getCompatibleVersion(extension, sameVersion, includePreRelease, productVersion);
        if (compatibleExtension) {
            return compatibleExtension;
        }
        if (this.isConfiguredToExecuteOnWeb(extension)) {
            return extension;
        }
        return null;
    }
    isConfiguredToExecuteOnWeb(gallery) {
        const configuredExtensionKind = this.extensionManifestPropertiesService.getUserConfiguredExtensionKind(gallery.identifier);
        return !!configuredExtensionKind && configuredExtensionKind.includes('web');
    }
    getCurrentExtensionsManifestLocation() {
        return this.userDataProfileService.currentProfile.extensionsResource;
    }
    createInstallExtensionTask(manifest, extension, options) {
        return new InstallExtensionTask(manifest, extension, options, this.webExtensionsScannerService, this.userDataProfilesService);
    }
    createUninstallExtensionTask(extension, options) {
        return new UninstallExtensionTask(extension, options, this.webExtensionsScannerService);
    }
    zip(extension) { throw new Error('unsupported'); }
    getManifest(vsix) { throw new Error('unsupported'); }
    download() { throw new Error('unsupported'); }
    async cleanUp() { }
    async whenProfileChanged(e) {
        const previousProfileLocation = e.previous.extensionsResource;
        const currentProfileLocation = e.profile.extensionsResource;
        if (!previousProfileLocation || !currentProfileLocation) {
            throw new Error('This should not happen');
        }
        const oldExtensions = await this.webExtensionsScannerService.scanUserExtensions(previousProfileLocation);
        const newExtensions = await this.webExtensionsScannerService.scanUserExtensions(currentProfileLocation);
        const { added, removed } = delta(oldExtensions, newExtensions, (a, b) => compare(`${ExtensionIdentifier.toKey(a.identifier.id)}@${a.manifest.version}`, `${ExtensionIdentifier.toKey(b.identifier.id)}@${b.manifest.version}`));
        this._onDidChangeProfile.fire({ added: added.map(e => toLocalExtension(e)), removed: removed.map(e => toLocalExtension(e)) });
    }
};
WebExtensionManagementService = __decorate([
    __param(0, IExtensionGalleryService),
    __param(1, ITelemetryService),
    __param(2, ILogService),
    __param(3, IWebExtensionsScannerService),
    __param(4, IExtensionManifestPropertiesService),
    __param(5, IUserDataProfileService),
    __param(6, IProductService),
    __param(7, IAllowedExtensionsService),
    __param(8, IUserDataProfilesService),
    __param(9, IUriIdentityService)
], WebExtensionManagementService);
export { WebExtensionManagementService };
function toLocalExtension(extension) {
    const metadata = getMetadata(undefined, extension);
    return {
        ...extension,
        identifier: { id: extension.identifier.id, uuid: metadata.id ?? extension.identifier.uuid },
        isMachineScoped: !!metadata.isMachineScoped,
        isApplicationScoped: !!metadata.isApplicationScoped,
        publisherId: metadata.publisherId || null,
        publisherDisplayName: metadata.publisherDisplayName,
        installedTimestamp: metadata.installedTimestamp,
        isPreReleaseVersion: !!metadata.isPreReleaseVersion,
        hasPreReleaseVersion: !!metadata.hasPreReleaseVersion,
        preRelease: extension.preRelease,
        targetPlatform: "web" /* TargetPlatform.WEB */,
        updated: !!metadata.updated,
        pinned: !!metadata?.pinned,
        private: !!metadata.private,
        isWorkspaceScoped: false,
        source: metadata?.source ?? (extension.identifier.uuid ? 'gallery' : 'resource'),
        size: metadata.size ?? 0,
    };
}
function getMetadata(options, existingExtension) {
    const metadata = { ...(existingExtension?.metadata || {}) };
    metadata.isMachineScoped = options?.isMachineScoped || metadata.isMachineScoped;
    return metadata;
}
class InstallExtensionTask extends AbstractExtensionTask {
    get profileLocation() { return this._profileLocation; }
    get operation() { return isUndefined(this.options.operation) ? this._operation : this.options.operation; }
    constructor(manifest, extension, options, webExtensionsScannerService, userDataProfilesService) {
        super();
        this.manifest = manifest;
        this.extension = extension;
        this.options = options;
        this.webExtensionsScannerService = webExtensionsScannerService;
        this.userDataProfilesService = userDataProfilesService;
        this._operation = 2 /* InstallOperation.Install */;
        this._profileLocation = options.profileLocation;
        this.identifier = URI.isUri(extension) ? { id: getGalleryExtensionId(manifest.publisher, manifest.name) } : extension.identifier;
        this.source = extension;
    }
    async doRun(token) {
        const userExtensions = await this.webExtensionsScannerService.scanUserExtensions(this.options.profileLocation);
        const existingExtension = userExtensions.find(e => areSameExtensions(e.identifier, this.identifier));
        if (existingExtension) {
            this._operation = 3 /* InstallOperation.Update */;
        }
        const metadata = getMetadata(this.options, existingExtension);
        if (!URI.isUri(this.extension)) {
            metadata.id = this.extension.identifier.uuid;
            metadata.publisherDisplayName = this.extension.publisherDisplayName;
            metadata.publisherId = this.extension.publisherId;
            metadata.installedTimestamp = Date.now();
            metadata.isPreReleaseVersion = this.extension.properties.isPreReleaseVersion;
            metadata.hasPreReleaseVersion = metadata.hasPreReleaseVersion || this.extension.properties.isPreReleaseVersion;
            metadata.isBuiltin = this.options.isBuiltin || existingExtension?.isBuiltin;
            metadata.isSystem = existingExtension?.type === 0 /* ExtensionType.System */ ? true : undefined;
            metadata.updated = !!existingExtension;
            metadata.isApplicationScoped = this.options.isApplicationScoped || metadata.isApplicationScoped;
            metadata.private = this.extension.private;
            metadata.preRelease = isBoolean(this.options.preRelease)
                ? this.options.preRelease
                : this.options.installPreReleaseVersion || this.extension.properties.isPreReleaseVersion || metadata.preRelease;
            metadata.source = URI.isUri(this.extension) ? 'resource' : 'gallery';
        }
        metadata.pinned = this.options.installGivenVersion ? true : (this.options.pinned ?? metadata.pinned);
        this._profileLocation = metadata.isApplicationScoped ? this.userDataProfilesService.defaultProfile.extensionsResource : this.options.profileLocation;
        const scannedExtension = URI.isUri(this.extension) ? await this.webExtensionsScannerService.addExtension(this.extension, metadata, this.profileLocation)
            : await this.webExtensionsScannerService.addExtensionFromGallery(this.extension, metadata, this.profileLocation);
        return toLocalExtension(scannedExtension);
    }
}
class UninstallExtensionTask extends AbstractExtensionTask {
    constructor(extension, options, webExtensionsScannerService) {
        super();
        this.extension = extension;
        this.options = options;
        this.webExtensionsScannerService = webExtensionsScannerService;
    }
    doRun(token) {
        return this.webExtensionsScannerService.removeExtension(this.extension, this.options.profileLocation);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL3dlYkV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxtQkFBbUIsRUFBdUYsTUFBTSxzREFBc0QsQ0FBQztBQUNoTCxPQUFPLEVBQXdELHdCQUF3QixFQUE2Qyx5QkFBeUIsRUFBRSxNQUFNLHdFQUF3RSxDQUFDO0FBQzlPLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDRFQUE0RSxDQUFDO0FBQ3RJLE9BQU8sRUFBOEQsNEJBQTRCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNwSSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFckUsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLHFCQUFxQixFQUErRSwwQkFBMEIsRUFBaUMsTUFBTSx1RkFBdUYsQ0FBQztBQUMxUyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN2RixPQUFPLEVBQUUsbUNBQW1DLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUNwSCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDeEYsT0FBTyxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMxRSxPQUFPLEVBQWlDLHVCQUF1QixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDekgs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