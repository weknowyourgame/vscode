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
import * as fs from 'fs';
import { Promises, Queue } from '../../../base/common/async.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { CancellationError, getErrorMessage } from '../../../base/common/errors.js';
import { Emitter } from '../../../base/common/event.js';
import { hash } from '../../../base/common/hash.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { ResourceMap, ResourceSet } from '../../../base/common/map.js';
import { Schemas } from '../../../base/common/network.js';
import * as path from '../../../base/common/path.js';
import { joinPath } from '../../../base/common/resources.js';
import * as semver from '../../../base/common/semver/semver.js';
import { isBoolean, isDefined, isUndefined } from '../../../base/common/types.js';
import { URI } from '../../../base/common/uri.js';
import { generateUuid } from '../../../base/common/uuid.js';
import * as pfs from '../../../base/node/pfs.js';
import { extract, zip } from '../../../base/node/zip.js';
import * as nls from '../../../nls.js';
import { IDownloadService } from '../../download/common/download.js';
import { INativeEnvironmentService } from '../../environment/common/environment.js';
import { AbstractExtensionManagementService, AbstractExtensionTask, toExtensionManagementError } from '../common/abstractExtensionManagementService.js';
import { ExtensionManagementError, IExtensionGalleryService, IExtensionManagementService, EXTENSION_INSTALL_CLIENT_TARGET_PLATFORM_CONTEXT, ExtensionSignatureVerificationCode, computeSize, IAllowedExtensionsService, VerifyExtensionSignatureConfigKey, shouldRequireRepositorySignatureFor, } from '../common/extensionManagement.js';
import { areSameExtensions, computeTargetPlatform, ExtensionKey, getGalleryExtensionId, groupByExtension } from '../common/extensionManagementUtil.js';
import { IExtensionsProfileScannerService } from '../common/extensionsProfileScannerService.js';
import { IExtensionsScannerService } from '../common/extensionsScannerService.js';
import { ExtensionsDownloader } from './extensionDownloader.js';
import { ExtensionsLifecycle } from './extensionLifecycle.js';
import { fromExtractError, getManifest } from './extensionManagementUtil.js';
import { ExtensionsManifestCache } from './extensionsManifestCache.js';
import { ExtensionsWatcher } from './extensionsWatcher.js';
import { isEngineValid } from '../../extensions/common/extensionValidator.js';
import { IFileService, toFileOperationResult } from '../../files/common/files.js';
import { IInstantiationService, refineServiceDecorator } from '../../instantiation/common/instantiation.js';
import { ILogService } from '../../log/common/log.js';
import { IProductService } from '../../product/common/productService.js';
import { ITelemetryService } from '../../telemetry/common/telemetry.js';
import { IUriIdentityService } from '../../uriIdentity/common/uriIdentity.js';
import { IUserDataProfilesService } from '../../userDataProfile/common/userDataProfile.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IExtensionGalleryManifestService } from '../common/extensionGalleryManifest.js';
export const INativeServerExtensionManagementService = refineServiceDecorator(IExtensionManagementService);
const DELETED_FOLDER_POSTFIX = '.vsctmp';
let ExtensionManagementService = class ExtensionManagementService extends AbstractExtensionManagementService {
    constructor(galleryService, telemetryService, logService, environmentService, extensionsScannerService, extensionsProfileScannerService, downloadService, instantiationService, fileService, configurationService, extensionGalleryManifestService, productService, allowedExtensionsService, uriIdentityService, userDataProfilesService) {
        super(galleryService, telemetryService, uriIdentityService, logService, productService, allowedExtensionsService, userDataProfilesService);
        this.environmentService = environmentService;
        this.extensionsScannerService = extensionsScannerService;
        this.extensionsProfileScannerService = extensionsProfileScannerService;
        this.downloadService = downloadService;
        this.instantiationService = instantiationService;
        this.fileService = fileService;
        this.configurationService = configurationService;
        this.extensionGalleryManifestService = extensionGalleryManifestService;
        this.extractingGalleryExtensions = new Map();
        this.knownDirectories = new ResourceSet();
        const extensionLifecycle = this._register(instantiationService.createInstance(ExtensionsLifecycle));
        this.extensionsScanner = this._register(instantiationService.createInstance(ExtensionsScanner, extension => extensionLifecycle.postUninstall(extension)));
        this.manifestCache = this._register(new ExtensionsManifestCache(userDataProfilesService, fileService, uriIdentityService, this, this.logService));
        this.extensionsDownloader = this._register(instantiationService.createInstance(ExtensionsDownloader));
        const extensionsWatcher = this._register(new ExtensionsWatcher(this, this.extensionsScannerService, userDataProfilesService, extensionsProfileScannerService, uriIdentityService, fileService, logService));
        this._register(extensionsWatcher.onDidChangeExtensionsByAnotherSource(e => this.onDidChangeExtensionsFromAnotherSource(e)));
        this.watchForExtensionsNotInstalledBySystem();
    }
    getTargetPlatform() {
        if (!this._targetPlatformPromise) {
            this._targetPlatformPromise = computeTargetPlatform(this.fileService, this.logService);
        }
        return this._targetPlatformPromise;
    }
    async zip(extension) {
        this.logService.trace('ExtensionManagementService#zip', extension.identifier.id);
        const files = await this.collectFiles(extension);
        const location = await zip(joinPath(this.extensionsDownloader.extensionsDownloadDir, generateUuid()).fsPath, files);
        return URI.file(location);
    }
    async getManifest(vsix) {
        const { location, cleanup } = await this.downloadVsix(vsix);
        const zipPath = path.resolve(location.fsPath);
        try {
            return await getManifest(zipPath);
        }
        finally {
            await cleanup();
        }
    }
    getInstalled(type, profileLocation = this.userDataProfilesService.defaultProfile.extensionsResource, productVersion = { version: this.productService.version, date: this.productService.date }, language) {
        return this.extensionsScanner.scanExtensions(type ?? null, profileLocation, productVersion, language);
    }
    scanAllUserInstalledExtensions() {
        return this.extensionsScanner.scanAllUserExtensions();
    }
    scanInstalledExtensionAtLocation(location) {
        return this.extensionsScanner.scanUserExtensionAtLocation(location);
    }
    async install(vsix, options = {}) {
        this.logService.trace('ExtensionManagementService#install', vsix.toString());
        const { location, cleanup } = await this.downloadVsix(vsix);
        try {
            const manifest = await getManifest(path.resolve(location.fsPath));
            const extensionId = getGalleryExtensionId(manifest.publisher, manifest.name);
            if (manifest.engines && manifest.engines.vscode && !isEngineValid(manifest.engines.vscode, this.productService.version, this.productService.date)) {
                throw new Error(nls.localize('incompatible', "Unable to install extension '{0}' as it is not compatible with VS Code '{1}'.", extensionId, this.productService.version));
            }
            const allowedToInstall = this.allowedExtensionsService.isAllowed({ id: extensionId, version: manifest.version, publisherDisplayName: undefined });
            if (allowedToInstall !== true) {
                throw new Error(nls.localize('notAllowed', "This extension cannot be installed because {0}", allowedToInstall.value));
            }
            const results = await this.installExtensions([{ manifest, extension: location, options }]);
            const result = results.find(({ identifier }) => areSameExtensions(identifier, { id: extensionId }));
            if (result?.local) {
                return result.local;
            }
            if (result?.error) {
                throw result.error;
            }
            throw toExtensionManagementError(new Error(`Unknown error while installing extension ${extensionId}`));
        }
        finally {
            await cleanup();
        }
    }
    async installFromLocation(location, profileLocation) {
        this.logService.trace('ExtensionManagementService#installFromLocation', location.toString());
        const local = await this.extensionsScanner.scanUserExtensionAtLocation(location);
        if (!local || !local.manifest.name || !local.manifest.version) {
            throw new Error(`Cannot find a valid extension from the location ${location.toString()}`);
        }
        await this.addExtensionsToProfile([[local, { source: 'resource' }]], profileLocation);
        this.logService.info('Successfully installed extension', local.identifier.id, profileLocation.toString());
        return local;
    }
    async installExtensionsFromProfile(extensions, fromProfileLocation, toProfileLocation) {
        this.logService.trace('ExtensionManagementService#installExtensionsFromProfile', extensions, fromProfileLocation.toString(), toProfileLocation.toString());
        const extensionsToInstall = (await this.getInstalled(1 /* ExtensionType.User */, fromProfileLocation)).filter(e => extensions.some(id => areSameExtensions(id, e.identifier)));
        if (extensionsToInstall.length) {
            const metadata = await Promise.all(extensionsToInstall.map(e => this.extensionsScanner.scanMetadata(e, fromProfileLocation)));
            await this.addExtensionsToProfile(extensionsToInstall.map((e, index) => [e, metadata[index]]), toProfileLocation);
            this.logService.info('Successfully installed extensions', extensionsToInstall.map(e => e.identifier.id), toProfileLocation.toString());
        }
        return extensionsToInstall;
    }
    async updateMetadata(local, metadata, profileLocation) {
        this.logService.trace('ExtensionManagementService#updateMetadata', local.identifier.id);
        if (metadata.isPreReleaseVersion) {
            metadata.preRelease = true;
            metadata.hasPreReleaseVersion = true;
        }
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
        local = await this.extensionsScanner.updateMetadata(local, metadata, profileLocation);
        this.manifestCache.invalidate(profileLocation);
        this._onDidUpdateExtensionMetadata.fire({ local, profileLocation });
        return local;
    }
    deleteExtension(extension) {
        return this.extensionsScanner.deleteExtension(extension, 'remove');
    }
    copyExtension(extension, fromProfileLocation, toProfileLocation, metadata) {
        return this.extensionsScanner.copyExtension(extension, fromProfileLocation, toProfileLocation, metadata);
    }
    moveExtension(extension, fromProfileLocation, toProfileLocation, metadata) {
        return this.extensionsScanner.moveExtension(extension, fromProfileLocation, toProfileLocation, metadata);
    }
    removeExtension(extension, fromProfileLocation) {
        return this.extensionsScanner.removeExtension(extension.identifier, fromProfileLocation);
    }
    copyExtensions(fromProfileLocation, toProfileLocation) {
        return this.extensionsScanner.copyExtensions(fromProfileLocation, toProfileLocation, { version: this.productService.version, date: this.productService.date });
    }
    deleteExtensions(...extensions) {
        return this.extensionsScanner.setExtensionsForRemoval(...extensions);
    }
    async cleanUp() {
        this.logService.trace('ExtensionManagementService#cleanUp');
        try {
            await this.extensionsScanner.cleanUp();
        }
        catch (error) {
            this.logService.error(error);
        }
    }
    async download(extension, operation, donotVerifySignature) {
        const { location } = await this.downloadExtension(extension, operation, !donotVerifySignature);
        return location;
    }
    async downloadVsix(vsix) {
        if (vsix.scheme === Schemas.file) {
            return { location: vsix, async cleanup() { } };
        }
        this.logService.trace('Downloading extension from', vsix.toString());
        const location = joinPath(this.extensionsDownloader.extensionsDownloadDir, generateUuid());
        await this.downloadService.download(vsix, location);
        this.logService.info('Downloaded extension to', location.toString());
        const cleanup = async () => {
            try {
                await this.fileService.del(location);
            }
            catch (error) {
                this.logService.error(error);
            }
        };
        return { location, cleanup };
    }
    getCurrentExtensionsManifestLocation() {
        return this.userDataProfilesService.defaultProfile.extensionsResource;
    }
    createInstallExtensionTask(manifest, extension, options) {
        const extensionKey = extension instanceof URI ? new ExtensionKey({ id: getGalleryExtensionId(manifest.publisher, manifest.name) }, manifest.version) : ExtensionKey.create(extension);
        return this.instantiationService.createInstance(InstallExtensionInProfileTask, extensionKey, manifest, extension, options, (operation, token) => {
            if (extension instanceof URI) {
                return this.extractVSIX(extensionKey, extension, options, token);
            }
            let promise = this.extractingGalleryExtensions.get(extensionKey.toString());
            if (!promise) {
                this.extractingGalleryExtensions.set(extensionKey.toString(), promise = this.downloadAndExtractGalleryExtension(extensionKey, extension, operation, options, token));
                promise.finally(() => this.extractingGalleryExtensions.delete(extensionKey.toString()));
            }
            return promise;
        }, this.extensionsScanner);
    }
    createUninstallExtensionTask(extension, options) {
        return new UninstallExtensionInProfileTask(extension, options, this.extensionsProfileScannerService);
    }
    async downloadAndExtractGalleryExtension(extensionKey, gallery, operation, options, token) {
        const { verificationStatus, location } = await this.downloadExtension(gallery, operation, !options.donotVerifySignature, options.context?.[EXTENSION_INSTALL_CLIENT_TARGET_PLATFORM_CONTEXT]);
        try {
            if (token.isCancellationRequested) {
                throw new CancellationError();
            }
            // validate manifest
            const manifest = await getManifest(location.fsPath);
            if (!new ExtensionKey(gallery.identifier, gallery.version).equals(new ExtensionKey({ id: getGalleryExtensionId(manifest.publisher, manifest.name) }, manifest.version))) {
                throw new ExtensionManagementError(nls.localize('invalidManifest', "Cannot install '{0}' extension because of manifest mismatch with Marketplace", gallery.identifier.id), "Invalid" /* ExtensionManagementErrorCode.Invalid */);
            }
            const local = await this.extensionsScanner.extractUserExtension(extensionKey, location.fsPath, false, token);
            if (verificationStatus !== ExtensionSignatureVerificationCode.Success && this.environmentService.isBuilt) {
                try {
                    await this.extensionsDownloader.delete(location);
                }
                catch (e) {
                    /* Ignore */
                    this.logService.warn(`Error while deleting the downloaded file`, location.toString(), getErrorMessage(e));
                }
            }
            return { local, verificationStatus };
        }
        catch (error) {
            try {
                await this.extensionsDownloader.delete(location);
            }
            catch (e) {
                /* Ignore */
                this.logService.warn(`Error while deleting the downloaded file`, location.toString(), getErrorMessage(e));
            }
            throw toExtensionManagementError(error);
        }
    }
    async downloadExtension(extension, operation, verifySignature, clientTargetPlatform) {
        if (verifySignature) {
            const value = this.configurationService.getValue(VerifyExtensionSignatureConfigKey);
            verifySignature = isBoolean(value) ? value : true;
        }
        const { location, verificationStatus } = await this.extensionsDownloader.download(extension, operation, verifySignature, clientTargetPlatform);
        const shouldRequireSignature = shouldRequireRepositorySignatureFor(extension.private, await this.extensionGalleryManifestService.getExtensionGalleryManifest());
        if (verificationStatus !== ExtensionSignatureVerificationCode.Success
            && !(verificationStatus === ExtensionSignatureVerificationCode.NotSigned && !shouldRequireSignature)
            && verifySignature
            && this.environmentService.isBuilt
            && (await this.getTargetPlatform()) !== "linux-armhf" /* TargetPlatform.LINUX_ARMHF */) {
            try {
                await this.extensionsDownloader.delete(location);
            }
            catch (e) {
                /* Ignore */
                this.logService.warn(`Error while deleting the downloaded file`, location.toString(), getErrorMessage(e));
            }
            if (!verificationStatus) {
                throw new ExtensionManagementError(nls.localize('signature verification not executed', "Signature verification was not executed."), "SignatureVerificationInternal" /* ExtensionManagementErrorCode.SignatureVerificationInternal */);
            }
            switch (verificationStatus) {
                case ExtensionSignatureVerificationCode.PackageIntegrityCheckFailed:
                case ExtensionSignatureVerificationCode.SignatureIsInvalid:
                case ExtensionSignatureVerificationCode.SignatureManifestIsInvalid:
                case ExtensionSignatureVerificationCode.SignatureIntegrityCheckFailed:
                case ExtensionSignatureVerificationCode.EntryIsMissing:
                case ExtensionSignatureVerificationCode.EntryIsTampered:
                case ExtensionSignatureVerificationCode.Untrusted:
                case ExtensionSignatureVerificationCode.CertificateRevoked:
                case ExtensionSignatureVerificationCode.SignatureIsNotValid:
                case ExtensionSignatureVerificationCode.SignatureArchiveHasTooManyEntries:
                case ExtensionSignatureVerificationCode.NotSigned:
                    throw new ExtensionManagementError(nls.localize('signature verification failed', "Signature verification failed with '{0}' error.", verificationStatus), "SignatureVerificationFailed" /* ExtensionManagementErrorCode.SignatureVerificationFailed */);
            }
            throw new ExtensionManagementError(nls.localize('signature verification failed', "Signature verification failed with '{0}' error.", verificationStatus), "SignatureVerificationInternal" /* ExtensionManagementErrorCode.SignatureVerificationInternal */);
        }
        return { location, verificationStatus };
    }
    async extractVSIX(extensionKey, location, options, token) {
        const local = await this.extensionsScanner.extractUserExtension(extensionKey, path.resolve(location.fsPath), isBoolean(options.keepExisting) ? !options.keepExisting : true, token);
        return { local };
    }
    async collectFiles(extension) {
        const collectFilesFromDirectory = async (dir) => {
            let entries = await pfs.Promises.readdir(dir);
            entries = entries.map(e => path.join(dir, e));
            const stats = await Promise.all(entries.map(e => fs.promises.stat(e)));
            let promise = Promise.resolve([]);
            stats.forEach((stat, index) => {
                const entry = entries[index];
                if (stat.isFile()) {
                    promise = promise.then(result => ([...result, entry]));
                }
                if (stat.isDirectory()) {
                    promise = promise
                        .then(result => collectFilesFromDirectory(entry)
                        .then(files => ([...result, ...files])));
                }
            });
            return promise;
        };
        const files = await collectFilesFromDirectory(extension.location.fsPath);
        return files.map(f => ({ path: `extension/${path.relative(extension.location.fsPath, f)}`, localPath: f }));
    }
    async onDidChangeExtensionsFromAnotherSource({ added, removed }) {
        if (removed) {
            const removedExtensions = added && this.uriIdentityService.extUri.isEqual(removed.profileLocation, added.profileLocation)
                ? removed.extensions.filter(e => added.extensions.every(identifier => !areSameExtensions(identifier, e)))
                : removed.extensions;
            for (const identifier of removedExtensions) {
                this.logService.info('Extensions removed from another source', identifier.id, removed.profileLocation.toString());
                this._onDidUninstallExtension.fire({ identifier, profileLocation: removed.profileLocation });
            }
        }
        if (added) {
            const extensions = await this.getInstalled(1 /* ExtensionType.User */, added.profileLocation);
            const addedExtensions = extensions.filter(e => added.extensions.some(identifier => areSameExtensions(identifier, e.identifier)));
            this._onDidInstallExtensions.fire(addedExtensions.map(local => {
                this.logService.info('Extensions added from another source', local.identifier.id, added.profileLocation.toString());
                return { identifier: local.identifier, local, profileLocation: added.profileLocation, operation: 1 /* InstallOperation.None */ };
            }));
        }
    }
    async watchForExtensionsNotInstalledBySystem() {
        this._register(this.extensionsScanner.onExtract(resource => this.knownDirectories.add(resource)));
        const stat = await this.fileService.resolve(this.extensionsScannerService.userExtensionsLocation);
        for (const childStat of stat.children ?? []) {
            if (childStat.isDirectory) {
                this.knownDirectories.add(childStat.resource);
            }
        }
        this._register(this.fileService.watch(this.extensionsScannerService.userExtensionsLocation));
        this._register(this.fileService.onDidFilesChange(e => this.onDidFilesChange(e)));
    }
    async onDidFilesChange(e) {
        if (!e.affects(this.extensionsScannerService.userExtensionsLocation, 1 /* FileChangeType.ADDED */)) {
            return;
        }
        const added = [];
        for (const resource of e.rawAdded) {
            // Check if this is a known directory
            if (this.knownDirectories.has(resource)) {
                continue;
            }
            // Is not immediate child of extensions resource
            if (!this.uriIdentityService.extUri.isEqual(this.uriIdentityService.extUri.dirname(resource), this.extensionsScannerService.userExtensionsLocation)) {
                continue;
            }
            // .obsolete file changed
            if (this.uriIdentityService.extUri.isEqual(resource, this.uriIdentityService.extUri.joinPath(this.extensionsScannerService.userExtensionsLocation, '.obsolete'))) {
                continue;
            }
            // Ignore changes to files starting with `.`
            if (this.uriIdentityService.extUri.basename(resource).startsWith('.')) {
                continue;
            }
            // Ignore changes to the deleted folder
            if (this.uriIdentityService.extUri.basename(resource).endsWith(DELETED_FOLDER_POSTFIX)) {
                continue;
            }
            try {
                // Check if this is a directory
                if (!(await this.fileService.stat(resource)).isDirectory) {
                    continue;
                }
            }
            catch (error) {
                if (toFileOperationResult(error) !== 1 /* FileOperationResult.FILE_NOT_FOUND */) {
                    this.logService.error(error);
                }
                continue;
            }
            // Check if this is an extension added by another source
            // Extension added by another source will not have installed timestamp
            const extension = await this.extensionsScanner.scanUserExtensionAtLocation(resource);
            if (extension && extension.installedTimestamp === undefined) {
                this.knownDirectories.add(resource);
                added.push(extension);
            }
        }
        if (added.length) {
            await this.addExtensionsToProfile(added.map(e => [e, undefined]), this.userDataProfilesService.defaultProfile.extensionsResource);
            this.logService.info('Added extensions to default profile from external source', added.map(e => e.identifier.id));
        }
    }
    async addExtensionsToProfile(extensions, profileLocation) {
        const localExtensions = extensions.map(e => e[0]);
        await this.extensionsScanner.unsetExtensionsForRemoval(...localExtensions.map(extension => ExtensionKey.create(extension)));
        await this.extensionsProfileScannerService.addExtensionsToProfile(extensions, profileLocation);
        this._onDidInstallExtensions.fire(localExtensions.map(local => ({ local, identifier: local.identifier, operation: 1 /* InstallOperation.None */, profileLocation })));
    }
};
ExtensionManagementService = __decorate([
    __param(0, IExtensionGalleryService),
    __param(1, ITelemetryService),
    __param(2, ILogService),
    __param(3, INativeEnvironmentService),
    __param(4, IExtensionsScannerService),
    __param(5, IExtensionsProfileScannerService),
    __param(6, IDownloadService),
    __param(7, IInstantiationService),
    __param(8, IFileService),
    __param(9, IConfigurationService),
    __param(10, IExtensionGalleryManifestService),
    __param(11, IProductService),
    __param(12, IAllowedExtensionsService),
    __param(13, IUriIdentityService),
    __param(14, IUserDataProfilesService)
], ExtensionManagementService);
export { ExtensionManagementService };
let ExtensionsScanner = class ExtensionsScanner extends Disposable {
    constructor(beforeRemovingExtension, fileService, extensionsScannerService, extensionsProfileScannerService, uriIdentityService, telemetryService, logService) {
        super();
        this.beforeRemovingExtension = beforeRemovingExtension;
        this.fileService = fileService;
        this.extensionsScannerService = extensionsScannerService;
        this.extensionsProfileScannerService = extensionsProfileScannerService;
        this.uriIdentityService = uriIdentityService;
        this.telemetryService = telemetryService;
        this.logService = logService;
        this._onExtract = this._register(new Emitter());
        this.onExtract = this._onExtract.event;
        this.scanAllExtensionPromise = new ResourceMap();
        this.scanUserExtensionsPromise = new ResourceMap();
        this.obsoletedResource = joinPath(this.extensionsScannerService.userExtensionsLocation, '.obsolete');
        this.obsoleteFileLimiter = new Queue();
    }
    async cleanUp() {
        await this.removeTemporarilyDeletedFolders();
        await this.deleteExtensionsMarkedForRemoval();
        //TODO: Remove this initiialization after coupe of releases
        await this.initializeExtensionSize();
    }
    async scanExtensions(type, profileLocation, productVersion, language) {
        try {
            const cacheKey = profileLocation.with({ query: language });
            const userScanOptions = { includeInvalid: true, profileLocation, productVersion, language };
            let scannedExtensions = [];
            if (type === null || type === 0 /* ExtensionType.System */) {
                let scanAllExtensionsPromise = this.scanAllExtensionPromise.get(cacheKey);
                if (!scanAllExtensionsPromise) {
                    scanAllExtensionsPromise = this.extensionsScannerService.scanAllExtensions({ language }, userScanOptions)
                        .finally(() => this.scanAllExtensionPromise.delete(cacheKey));
                    this.scanAllExtensionPromise.set(cacheKey, scanAllExtensionsPromise);
                }
                scannedExtensions.push(...await scanAllExtensionsPromise);
            }
            else if (type === 1 /* ExtensionType.User */) {
                let scanUserExtensionsPromise = this.scanUserExtensionsPromise.get(cacheKey);
                if (!scanUserExtensionsPromise) {
                    scanUserExtensionsPromise = this.extensionsScannerService.scanUserExtensions(userScanOptions)
                        .finally(() => this.scanUserExtensionsPromise.delete(cacheKey));
                    this.scanUserExtensionsPromise.set(cacheKey, scanUserExtensionsPromise);
                }
                scannedExtensions.push(...await scanUserExtensionsPromise);
            }
            scannedExtensions = type !== null ? scannedExtensions.filter(r => r.type === type) : scannedExtensions;
            return await Promise.all(scannedExtensions.map(extension => this.toLocalExtension(extension)));
        }
        catch (error) {
            throw toExtensionManagementError(error, "Scanning" /* ExtensionManagementErrorCode.Scanning */);
        }
    }
    async scanAllUserExtensions() {
        try {
            const scannedExtensions = await this.extensionsScannerService.scanAllUserExtensions();
            return await Promise.all(scannedExtensions.map(extension => this.toLocalExtension(extension)));
        }
        catch (error) {
            throw toExtensionManagementError(error, "Scanning" /* ExtensionManagementErrorCode.Scanning */);
        }
    }
    async scanUserExtensionAtLocation(location) {
        try {
            const scannedExtension = await this.extensionsScannerService.scanExistingExtension(location, 1 /* ExtensionType.User */, { includeInvalid: true });
            if (scannedExtension) {
                return await this.toLocalExtension(scannedExtension);
            }
        }
        catch (error) {
            this.logService.error(error);
        }
        return null;
    }
    async extractUserExtension(extensionKey, zipPath, removeIfExists, token) {
        const folderName = extensionKey.toString();
        const tempLocation = URI.file(path.join(this.extensionsScannerService.userExtensionsLocation.fsPath, `.${generateUuid()}`));
        const extensionLocation = URI.file(path.join(this.extensionsScannerService.userExtensionsLocation.fsPath, folderName));
        if (await this.fileService.exists(extensionLocation)) {
            if (!removeIfExists) {
                try {
                    return await this.scanLocalExtension(extensionLocation, 1 /* ExtensionType.User */);
                }
                catch (error) {
                    this.logService.warn(`Error while scanning the existing extension at ${extensionLocation.path}. Deleting the existing extension and extracting it.`, getErrorMessage(error));
                }
            }
            try {
                await this.deleteExtensionFromLocation(extensionKey.id, extensionLocation, 'removeExisting');
            }
            catch (error) {
                throw new ExtensionManagementError(nls.localize('errorDeleting', "Unable to delete the existing folder '{0}' while installing the extension '{1}'. Please delete the folder manually and try again", extensionLocation.fsPath, extensionKey.id), "Delete" /* ExtensionManagementErrorCode.Delete */);
            }
        }
        try {
            if (token.isCancellationRequested) {
                throw new CancellationError();
            }
            // Extract
            try {
                this.logService.trace(`Started extracting the extension from ${zipPath} to ${extensionLocation.fsPath}`);
                await extract(zipPath, tempLocation.fsPath, { sourcePath: 'extension', overwrite: true }, token);
                this.logService.info(`Extracted extension to ${extensionLocation}:`, extensionKey.id);
            }
            catch (e) {
                throw fromExtractError(e);
            }
            const metadata = { installedTimestamp: Date.now(), targetPlatform: extensionKey.targetPlatform };
            try {
                metadata.size = await computeSize(tempLocation, this.fileService);
            }
            catch (error) {
                // Log & ignore
                this.logService.warn(`Error while getting the size of the extracted extension : ${tempLocation.fsPath}`, getErrorMessage(error));
            }
            try {
                await this.extensionsScannerService.updateManifestMetadata(tempLocation, metadata);
            }
            catch (error) {
                this.telemetryService.publicLog2('extension:extract', { extensionId: extensionKey.id, code: `${toFileOperationResult(error)}` });
                throw toExtensionManagementError(error, "UpdateMetadata" /* ExtensionManagementErrorCode.UpdateMetadata */);
            }
            if (token.isCancellationRequested) {
                throw new CancellationError();
            }
            // Rename
            try {
                this.logService.trace(`Started renaming the extension from ${tempLocation.fsPath} to ${extensionLocation.fsPath}`);
                await this.rename(tempLocation.fsPath, extensionLocation.fsPath);
                this.logService.info('Renamed to', extensionLocation.fsPath);
            }
            catch (error) {
                if (error.code === 'ENOTEMPTY') {
                    this.logService.info(`Rename failed because extension was installed by another source. So ignoring renaming.`, extensionKey.id);
                    try {
                        await this.fileService.del(tempLocation, { recursive: true });
                    }
                    catch (e) { /* ignore */ }
                }
                else {
                    this.logService.info(`Rename failed because of ${getErrorMessage(error)}. Deleted from extracted location`, tempLocation);
                    throw error;
                }
            }
            this._onExtract.fire(extensionLocation);
        }
        catch (error) {
            try {
                await this.fileService.del(tempLocation, { recursive: true });
            }
            catch (e) { /* ignore */ }
            throw error;
        }
        return this.scanLocalExtension(extensionLocation, 1 /* ExtensionType.User */);
    }
    async scanMetadata(local, profileLocation) {
        const extension = await this.getScannedExtension(local, profileLocation);
        return extension?.metadata;
    }
    async getScannedExtension(local, profileLocation) {
        const extensions = await this.extensionsProfileScannerService.scanProfileExtensions(profileLocation);
        return extensions.find(e => areSameExtensions(e.identifier, local.identifier));
    }
    async updateMetadata(local, metadata, profileLocation) {
        try {
            await this.extensionsProfileScannerService.updateMetadata([[local, metadata]], profileLocation);
        }
        catch (error) {
            this.telemetryService.publicLog2('extension:extract', { extensionId: local.identifier.id, code: `${toFileOperationResult(error)}`, isProfile: !!profileLocation });
            throw toExtensionManagementError(error, "UpdateMetadata" /* ExtensionManagementErrorCode.UpdateMetadata */);
        }
        return this.scanLocalExtension(local.location, local.type, profileLocation);
    }
    async setExtensionsForRemoval(...extensions) {
        const extensionsToRemove = [];
        for (const extension of extensions) {
            if (await this.fileService.exists(extension.location)) {
                extensionsToRemove.push(extension);
            }
        }
        const extensionKeys = extensionsToRemove.map(e => ExtensionKey.create(e));
        await this.withRemovedExtensions(removedExtensions => extensionKeys.forEach(extensionKey => {
            removedExtensions[extensionKey.toString()] = true;
            this.logService.info('Marked extension as removed', extensionKey.toString());
        }));
    }
    async unsetExtensionsForRemoval(...extensionKeys) {
        try {
            const results = [];
            await this.withRemovedExtensions(removedExtensions => extensionKeys.forEach(extensionKey => {
                if (removedExtensions[extensionKey.toString()]) {
                    results.push(true);
                    delete removedExtensions[extensionKey.toString()];
                }
                else {
                    results.push(false);
                }
            }));
            return results;
        }
        catch (error) {
            throw toExtensionManagementError(error, "UnsetRemoved" /* ExtensionManagementErrorCode.UnsetRemoved */);
        }
    }
    async deleteExtension(extension, type) {
        if (this.uriIdentityService.extUri.isEqualOrParent(extension.location, this.extensionsScannerService.userExtensionsLocation)) {
            await this.deleteExtensionFromLocation(extension.identifier.id, extension.location, type);
            await this.unsetExtensionsForRemoval(ExtensionKey.create(extension));
        }
    }
    async copyExtension(extension, fromProfileLocation, toProfileLocation, metadata) {
        const source = await this.getScannedExtension(extension, fromProfileLocation);
        const target = await this.getScannedExtension(extension, toProfileLocation);
        metadata = { ...source?.metadata, ...metadata };
        if (target) {
            if (this.uriIdentityService.extUri.isEqual(target.location, extension.location)) {
                await this.extensionsProfileScannerService.updateMetadata([[extension, { ...target.metadata, ...metadata }]], toProfileLocation);
            }
            else {
                const targetExtension = await this.scanLocalExtension(target.location, extension.type, toProfileLocation);
                await this.extensionsProfileScannerService.removeExtensionsFromProfile([targetExtension.identifier], toProfileLocation);
                await this.extensionsProfileScannerService.addExtensionsToProfile([[extension, { ...target.metadata, ...metadata }]], toProfileLocation);
            }
        }
        else {
            await this.extensionsProfileScannerService.addExtensionsToProfile([[extension, metadata]], toProfileLocation);
        }
        return this.scanLocalExtension(extension.location, extension.type, toProfileLocation);
    }
    async moveExtension(extension, fromProfileLocation, toProfileLocation, metadata) {
        const source = await this.getScannedExtension(extension, fromProfileLocation);
        const target = await this.getScannedExtension(extension, toProfileLocation);
        metadata = { ...source?.metadata, ...metadata };
        if (target) {
            if (this.uriIdentityService.extUri.isEqual(target.location, extension.location)) {
                await this.extensionsProfileScannerService.updateMetadata([[extension, { ...target.metadata, ...metadata }]], toProfileLocation);
            }
            else {
                const targetExtension = await this.scanLocalExtension(target.location, extension.type, toProfileLocation);
                await this.removeExtension(targetExtension.identifier, toProfileLocation);
                await this.extensionsProfileScannerService.addExtensionsToProfile([[extension, { ...target.metadata, ...metadata }]], toProfileLocation);
            }
        }
        else {
            await this.extensionsProfileScannerService.addExtensionsToProfile([[extension, metadata]], toProfileLocation);
            if (source) {
                await this.removeExtension(source.identifier, fromProfileLocation);
            }
        }
        return this.scanLocalExtension(extension.location, extension.type, toProfileLocation);
    }
    async removeExtension(identifier, fromProfileLocation) {
        await this.extensionsProfileScannerService.removeExtensionsFromProfile([identifier], fromProfileLocation);
    }
    async copyExtensions(fromProfileLocation, toProfileLocation, productVersion) {
        const fromExtensions = await this.scanExtensions(1 /* ExtensionType.User */, fromProfileLocation, productVersion);
        const extensions = await Promise.all(fromExtensions
            .filter(e => !e.isApplicationScoped) /* remove application scoped extensions */
            .map(async (e) => ([e, await this.scanMetadata(e, fromProfileLocation)])));
        await this.extensionsProfileScannerService.addExtensionsToProfile(extensions, toProfileLocation);
    }
    async deleteExtensionFromLocation(id, location, type) {
        this.logService.trace(`Deleting ${type} extension from disk`, id, location.fsPath);
        const renamedLocation = this.uriIdentityService.extUri.joinPath(this.uriIdentityService.extUri.dirname(location), `${this.uriIdentityService.extUri.basename(location)}.${hash(generateUuid()).toString(16)}${DELETED_FOLDER_POSTFIX}`);
        await this.rename(location.fsPath, renamedLocation.fsPath);
        await this.fileService.del(renamedLocation, { recursive: true });
        this.logService.info(`Deleted ${type} extension from disk`, id, location.fsPath);
    }
    withRemovedExtensions(updateFn) {
        return this.obsoleteFileLimiter.queue(async () => {
            let raw;
            try {
                const content = await this.fileService.readFile(this.obsoletedResource, 'utf8');
                raw = content.value.toString();
            }
            catch (error) {
                if (toFileOperationResult(error) !== 1 /* FileOperationResult.FILE_NOT_FOUND */) {
                    throw error;
                }
            }
            let removed = {};
            if (raw) {
                try {
                    removed = JSON.parse(raw);
                }
                catch (e) { /* ignore */ }
            }
            if (updateFn) {
                updateFn(removed);
                if (Object.keys(removed).length) {
                    await this.fileService.writeFile(this.obsoletedResource, VSBuffer.fromString(JSON.stringify(removed)));
                }
                else {
                    try {
                        await this.fileService.del(this.obsoletedResource);
                    }
                    catch (error) {
                        if (toFileOperationResult(error) !== 1 /* FileOperationResult.FILE_NOT_FOUND */) {
                            throw error;
                        }
                    }
                }
            }
            return removed;
        });
    }
    async rename(extractPath, renamePath) {
        try {
            await pfs.Promises.rename(extractPath, renamePath, 2 * 60 * 1000 /* Retry for 2 minutes */);
        }
        catch (error) {
            throw toExtensionManagementError(error, "Rename" /* ExtensionManagementErrorCode.Rename */);
        }
    }
    async scanLocalExtension(location, type, profileLocation) {
        try {
            if (profileLocation) {
                const scannedExtensions = await this.extensionsScannerService.scanUserExtensions({ profileLocation });
                const scannedExtension = scannedExtensions.find(e => this.uriIdentityService.extUri.isEqual(e.location, location));
                if (scannedExtension) {
                    return await this.toLocalExtension(scannedExtension);
                }
            }
            else {
                const scannedExtension = await this.extensionsScannerService.scanExistingExtension(location, type, { includeInvalid: true });
                if (scannedExtension) {
                    return await this.toLocalExtension(scannedExtension);
                }
            }
            throw new ExtensionManagementError(nls.localize('cannot read', "Cannot read the extension from {0}", location.path), "ScanningExtension" /* ExtensionManagementErrorCode.ScanningExtension */);
        }
        catch (error) {
            throw toExtensionManagementError(error, "ScanningExtension" /* ExtensionManagementErrorCode.ScanningExtension */);
        }
    }
    async toLocalExtension(extension) {
        let stat;
        try {
            stat = await this.fileService.resolve(extension.location);
        }
        catch (error) { /* ignore */ }
        let readmeUrl;
        let changelogUrl;
        if (stat?.children) {
            readmeUrl = stat.children.find(({ name }) => /^readme(\.txt|\.md|)$/i.test(name))?.resource;
            changelogUrl = stat.children.find(({ name }) => /^changelog(\.txt|\.md|)$/i.test(name))?.resource;
        }
        return {
            identifier: extension.identifier,
            type: extension.type,
            isBuiltin: extension.isBuiltin || !!extension.metadata?.isBuiltin,
            location: extension.location,
            manifest: extension.manifest,
            targetPlatform: extension.targetPlatform,
            validations: extension.validations,
            isValid: extension.isValid,
            readmeUrl,
            changelogUrl,
            publisherDisplayName: extension.metadata?.publisherDisplayName,
            publisherId: extension.metadata?.publisherId || null,
            isApplicationScoped: !!extension.metadata?.isApplicationScoped,
            isMachineScoped: !!extension.metadata?.isMachineScoped,
            isPreReleaseVersion: !!extension.metadata?.isPreReleaseVersion,
            hasPreReleaseVersion: !!extension.metadata?.hasPreReleaseVersion,
            preRelease: extension.preRelease,
            installedTimestamp: extension.metadata?.installedTimestamp,
            updated: !!extension.metadata?.updated,
            pinned: !!extension.metadata?.pinned,
            private: !!extension.metadata?.private,
            isWorkspaceScoped: false,
            source: extension.metadata?.source ?? (extension.identifier.uuid ? 'gallery' : 'vsix'),
            size: extension.metadata?.size ?? 0,
        };
    }
    async initializeExtensionSize() {
        const extensions = await this.extensionsScannerService.scanAllUserExtensions();
        await Promise.all(extensions.map(async (extension) => {
            // set size if not set before
            if (isDefined(extension.metadata?.installedTimestamp) && isUndefined(extension.metadata?.size)) {
                const size = await computeSize(extension.location, this.fileService);
                await this.extensionsScannerService.updateManifestMetadata(extension.location, { size });
            }
        }));
    }
    async deleteExtensionsMarkedForRemoval() {
        let removed;
        try {
            removed = await this.withRemovedExtensions();
        }
        catch (error) {
            throw toExtensionManagementError(error, "ReadRemoved" /* ExtensionManagementErrorCode.ReadRemoved */);
        }
        if (Object.keys(removed).length === 0) {
            this.logService.debug(`No extensions are marked as removed.`);
            return;
        }
        this.logService.debug(`Deleting extensions marked as removed:`, Object.keys(removed));
        const extensions = await this.scanAllUserExtensions();
        const installed = new Set();
        for (const e of extensions) {
            if (!removed[ExtensionKey.create(e).toString()]) {
                installed.add(e.identifier.id.toLowerCase());
            }
        }
        try {
            // running post uninstall tasks for extensions that are not installed anymore
            const byExtension = groupByExtension(extensions, e => e.identifier);
            await Promises.settled(byExtension.map(async (e) => {
                const latest = e.sort((a, b) => semver.rcompare(a.manifest.version, b.manifest.version))[0];
                if (!installed.has(latest.identifier.id.toLowerCase())) {
                    await this.beforeRemovingExtension(latest);
                }
            }));
        }
        catch (error) {
            this.logService.error(error);
        }
        const toRemove = extensions.filter(e => e.installedTimestamp /* Installed by System */ && removed[ExtensionKey.create(e).toString()]);
        await Promise.allSettled(toRemove.map(e => this.deleteExtension(e, 'marked for removal')));
    }
    async removeTemporarilyDeletedFolders() {
        this.logService.trace('ExtensionManagementService#removeTempDeleteFolders');
        let stat;
        try {
            stat = await this.fileService.resolve(this.extensionsScannerService.userExtensionsLocation);
        }
        catch (error) {
            if (toFileOperationResult(error) !== 1 /* FileOperationResult.FILE_NOT_FOUND */) {
                this.logService.error(error);
            }
            return;
        }
        if (!stat?.children) {
            return;
        }
        try {
            await Promise.allSettled(stat.children.map(async (child) => {
                if (!child.isDirectory || !child.name.endsWith(DELETED_FOLDER_POSTFIX)) {
                    return;
                }
                this.logService.trace('Deleting the temporarily deleted folder', child.resource.toString());
                try {
                    await this.fileService.del(child.resource, { recursive: true });
                    this.logService.trace('Deleted the temporarily deleted folder', child.resource.toString());
                }
                catch (error) {
                    if (toFileOperationResult(error) !== 1 /* FileOperationResult.FILE_NOT_FOUND */) {
                        this.logService.error(error);
                    }
                }
            }));
        }
        catch (error) { /* ignore */ }
    }
};
ExtensionsScanner = __decorate([
    __param(1, IFileService),
    __param(2, IExtensionsScannerService),
    __param(3, IExtensionsProfileScannerService),
    __param(4, IUriIdentityService),
    __param(5, ITelemetryService),
    __param(6, ILogService)
], ExtensionsScanner);
export { ExtensionsScanner };
let InstallExtensionInProfileTask = class InstallExtensionInProfileTask extends AbstractExtensionTask {
    get operation() { return this.options.operation ?? this._operation; }
    get verificationStatus() { return this._verificationStatus; }
    constructor(extensionKey, manifest, source, options, extractExtensionFn, extensionsScanner, uriIdentityService, galleryService, userDataProfilesService, extensionsScannerService, extensionsProfileScannerService, logService) {
        super();
        this.extensionKey = extensionKey;
        this.manifest = manifest;
        this.source = source;
        this.options = options;
        this.extractExtensionFn = extractExtensionFn;
        this.extensionsScanner = extensionsScanner;
        this.uriIdentityService = uriIdentityService;
        this.galleryService = galleryService;
        this.userDataProfilesService = userDataProfilesService;
        this.extensionsScannerService = extensionsScannerService;
        this.extensionsProfileScannerService = extensionsProfileScannerService;
        this.logService = logService;
        this._operation = 2 /* InstallOperation.Install */;
        this.identifier = this.extensionKey.identifier;
    }
    async doRun(token) {
        const installed = await this.extensionsScanner.scanExtensions(1 /* ExtensionType.User */, this.options.profileLocation, this.options.productVersion);
        const existingExtension = installed.find(i => areSameExtensions(i.identifier, this.identifier));
        if (existingExtension) {
            this._operation = 3 /* InstallOperation.Update */;
        }
        const metadata = {
            isApplicationScoped: this.options.isApplicationScoped || existingExtension?.isApplicationScoped,
            isMachineScoped: this.options.isMachineScoped || existingExtension?.isMachineScoped,
            isBuiltin: this.options.isBuiltin || existingExtension?.isBuiltin,
            isSystem: existingExtension?.type === 0 /* ExtensionType.System */ ? true : undefined,
            installedTimestamp: Date.now(),
            pinned: this.options.installGivenVersion ? true : (this.options.pinned ?? existingExtension?.pinned),
            source: this.source instanceof URI ? 'vsix' : 'gallery',
        };
        let local;
        // VSIX
        if (this.source instanceof URI) {
            if (existingExtension) {
                if (this.extensionKey.equals(new ExtensionKey(existingExtension.identifier, existingExtension.manifest.version))) {
                    try {
                        await this.extensionsScanner.deleteExtension(existingExtension, 'existing');
                    }
                    catch (e) {
                        throw new Error(nls.localize('restartCode', "Please restart VS Code before reinstalling {0}.", this.manifest.displayName || this.manifest.name));
                    }
                }
            }
            // Remove the extension with same version if it is already uninstalled.
            // Installing a VSIX extension shall replace the existing extension always.
            const existingWithSameVersion = await this.unsetIfRemoved(this.extensionKey);
            if (existingWithSameVersion) {
                try {
                    await this.extensionsScanner.deleteExtension(existingWithSameVersion, 'existing');
                }
                catch (e) {
                    throw new Error(nls.localize('restartCode', "Please restart VS Code before reinstalling {0}.", this.manifest.displayName || this.manifest.name));
                }
            }
        }
        // Gallery
        else {
            metadata.id = this.source.identifier.uuid;
            metadata.publisherId = this.source.publisherId;
            metadata.publisherDisplayName = this.source.publisherDisplayName;
            metadata.targetPlatform = this.source.properties.targetPlatform;
            metadata.updated = !!existingExtension;
            metadata.private = this.source.private;
            metadata.isPreReleaseVersion = this.source.properties.isPreReleaseVersion;
            metadata.hasPreReleaseVersion = existingExtension?.hasPreReleaseVersion || this.source.properties.isPreReleaseVersion;
            metadata.preRelease = isBoolean(this.options.preRelease)
                ? this.options.preRelease
                : this.options.installPreReleaseVersion || this.source.properties.isPreReleaseVersion || existingExtension?.preRelease;
            if (existingExtension && existingExtension.type !== 0 /* ExtensionType.System */ && existingExtension.manifest.version === this.source.version) {
                return this.extensionsScanner.updateMetadata(existingExtension, metadata, this.options.profileLocation);
            }
            // Unset if the extension is uninstalled and return the unset extension.
            local = await this.unsetIfRemoved(this.extensionKey);
        }
        if (token.isCancellationRequested) {
            throw toExtensionManagementError(new CancellationError());
        }
        if (!local) {
            const result = await this.extractExtensionFn(this.operation, token);
            local = result.local;
            this._verificationStatus = result.verificationStatus;
        }
        if (this.uriIdentityService.extUri.isEqual(this.userDataProfilesService.defaultProfile.extensionsResource, this.options.profileLocation)) {
            try {
                await this.extensionsScannerService.initializeDefaultProfileExtensions();
            }
            catch (error) {
                throw toExtensionManagementError(error, "IntializeDefaultProfile" /* ExtensionManagementErrorCode.IntializeDefaultProfile */);
            }
        }
        if (token.isCancellationRequested) {
            throw toExtensionManagementError(new CancellationError());
        }
        try {
            await this.extensionsProfileScannerService.addExtensionsToProfile([[local, metadata]], this.options.profileLocation, !local.isValid);
        }
        catch (error) {
            throw toExtensionManagementError(error, "AddToProfile" /* ExtensionManagementErrorCode.AddToProfile */);
        }
        const result = await this.extensionsScanner.scanLocalExtension(local.location, 1 /* ExtensionType.User */, this.options.profileLocation);
        if (!result) {
            throw new ExtensionManagementError('Cannot find the installed extension', "InstalledExtensionNotFound" /* ExtensionManagementErrorCode.InstalledExtensionNotFound */);
        }
        if (this.source instanceof URI) {
            this.updateMetadata(local, token);
        }
        return result;
    }
    async unsetIfRemoved(extensionKey) {
        // If the same version of extension is marked as removed, remove it from there and return the local.
        const [removed] = await this.extensionsScanner.unsetExtensionsForRemoval(extensionKey);
        if (removed) {
            this.logService.info('Removed the extension from removed list:', extensionKey.id);
            const userExtensions = await this.extensionsScanner.scanAllUserExtensions();
            return userExtensions.find(i => ExtensionKey.create(i).equals(extensionKey));
        }
        return undefined;
    }
    async updateMetadata(extension, token) {
        try {
            let [galleryExtension] = await this.galleryService.getExtensions([{ id: extension.identifier.id, version: extension.manifest.version }], token);
            if (!galleryExtension) {
                [galleryExtension] = await this.galleryService.getExtensions([{ id: extension.identifier.id }], token);
            }
            if (galleryExtension) {
                const metadata = {
                    id: galleryExtension.identifier.uuid,
                    publisherDisplayName: galleryExtension.publisherDisplayName,
                    publisherId: galleryExtension.publisherId,
                    isPreReleaseVersion: galleryExtension.properties.isPreReleaseVersion,
                    hasPreReleaseVersion: extension.hasPreReleaseVersion || galleryExtension.properties.isPreReleaseVersion,
                    preRelease: galleryExtension.properties.isPreReleaseVersion || this.options.installPreReleaseVersion
                };
                await this.extensionsScanner.updateMetadata(extension, metadata, this.options.profileLocation);
            }
        }
        catch (error) {
            /* Ignore Error */
        }
    }
};
InstallExtensionInProfileTask = __decorate([
    __param(6, IUriIdentityService),
    __param(7, IExtensionGalleryService),
    __param(8, IUserDataProfilesService),
    __param(9, IExtensionsScannerService),
    __param(10, IExtensionsProfileScannerService),
    __param(11, ILogService)
], InstallExtensionInProfileTask);
class UninstallExtensionInProfileTask extends AbstractExtensionTask {
    constructor(extension, options, extensionsProfileScannerService) {
        super();
        this.extension = extension;
        this.options = options;
        this.extensionsProfileScannerService = extensionsProfileScannerService;
    }
    doRun(token) {
        return this.extensionsProfileScannerService.removeExtensionsFromProfile([this.extension.identifier], this.options.profileLocation);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9ub2RlL2V4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3pCLE9BQU8sRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDaEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRzFELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxlQUFlLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNwRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDeEQsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3BELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMxRCxPQUFPLEtBQUssSUFBSSxNQUFNLDhCQUE4QixDQUFDO0FBQ3JELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM3RCxPQUFPLEtBQUssTUFBTSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ2xGLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNsRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sOEJBQThC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