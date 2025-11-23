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
import { equals } from '../../../base/common/arrays.js';
import { createCancelablePromise, RunOnceScheduler } from '../../../base/common/async.js';
import { CancellationTokenSource } from '../../../base/common/cancellation.js';
import { toErrorMessage } from '../../../base/common/errorMessage.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { isEqual } from '../../../base/common/resources.js';
import { isBoolean, isUndefined } from '../../../base/common/types.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IExtensionGalleryService } from '../../extensionManagement/common/extensionManagement.js';
import { IFileService } from '../../files/common/files.js';
import { IInstantiationService } from '../../instantiation/common/instantiation.js';
import { IStorageService } from '../../storage/common/storage.js';
import { ITelemetryService } from '../../telemetry/common/telemetry.js';
import { IUserDataProfilesService } from '../../userDataProfile/common/userDataProfile.js';
import { ExtensionsSynchroniser } from './extensionsSync.js';
import { GlobalStateSynchroniser } from './globalStateSync.js';
import { KeybindingsSynchroniser } from './keybindingsSync.js';
import { PromptsSynchronizer } from './promptsSync/promptsSync.js';
import { SettingsSynchroniser } from './settingsSync.js';
import { SnippetsSynchroniser } from './snippetsSync.js';
import { TasksSynchroniser } from './tasksSync.js';
import { McpSynchroniser } from './mcpSync.js';
import { UserDataProfilesManifestSynchroniser } from './userDataProfilesManifestSync.js';
import { ALL_SYNC_RESOURCES, createSyncHeaders, IUserDataSyncEnablementService, IUserDataSyncLogService, IUserDataSyncStoreManagementService, IUserDataSyncStoreService, UserDataSyncError, UserDataSyncStoreError, USER_DATA_SYNC_CONFIGURATION_SCOPE, IUserDataSyncResourceProviderService, IUserDataSyncLocalStoreService, isUserDataManifest, } from './userDataSync.js';
const LAST_SYNC_TIME_KEY = 'sync.lastSyncTime';
let UserDataSyncService = class UserDataSyncService extends Disposable {
    get status() { return this._status; }
    get conflicts() { return this._conflicts; }
    get lastSyncTime() { return this._lastSyncTime; }
    constructor(fileService, userDataSyncStoreService, userDataSyncStoreManagementService, instantiationService, logService, telemetryService, storageService, userDataSyncEnablementService, userDataProfilesService, userDataSyncResourceProviderService, userDataSyncLocalStoreService) {
        super();
        this.fileService = fileService;
        this.userDataSyncStoreService = userDataSyncStoreService;
        this.userDataSyncStoreManagementService = userDataSyncStoreManagementService;
        this.instantiationService = instantiationService;
        this.logService = logService;
        this.telemetryService = telemetryService;
        this.storageService = storageService;
        this.userDataSyncEnablementService = userDataSyncEnablementService;
        this.userDataProfilesService = userDataProfilesService;
        this.userDataSyncResourceProviderService = userDataSyncResourceProviderService;
        this.userDataSyncLocalStoreService = userDataSyncLocalStoreService;
        this._status = "uninitialized" /* SyncStatus.Uninitialized */;
        this._onDidChangeStatus = this._register(new Emitter());
        this.onDidChangeStatus = this._onDidChangeStatus.event;
        this._onDidChangeLocal = this._register(new Emitter());
        this.onDidChangeLocal = this._onDidChangeLocal.event;
        this._conflicts = [];
        this._onDidChangeConflicts = this._register(new Emitter());
        this.onDidChangeConflicts = this._onDidChangeConflicts.event;
        this._syncErrors = [];
        this._onSyncErrors = this._register(new Emitter());
        this.onSyncErrors = this._onSyncErrors.event;
        this._lastSyncTime = undefined;
        this._onDidChangeLastSyncTime = this._register(new Emitter());
        this.onDidChangeLastSyncTime = this._onDidChangeLastSyncTime.event;
        this._onDidResetLocal = this._register(new Emitter());
        this.onDidResetLocal = this._onDidResetLocal.event;
        this._onDidResetRemote = this._register(new Emitter());
        this.onDidResetRemote = this._onDidResetRemote.event;
        this.activeProfileSynchronizers = new Map();
        this._status = userDataSyncStoreManagementService.userDataSyncStore ? "idle" /* SyncStatus.Idle */ : "uninitialized" /* SyncStatus.Uninitialized */;
        this._lastSyncTime = this.storageService.getNumber(LAST_SYNC_TIME_KEY, -1 /* StorageScope.APPLICATION */, undefined);
        this._register(toDisposable(() => this.clearActiveProfileSynchronizers()));
        this._register(new RunOnceScheduler(() => this.cleanUpStaleStorageData(), 5 * 1000 /* after 5s */)).schedule();
    }
    async createSyncTask(manifest, disableCache) {
        this.checkEnablement();
        this.logService.info('Sync started.');
        const startTime = new Date().getTime();
        const executionId = generateUuid();
        try {
            const syncHeaders = createSyncHeaders(executionId);
            if (disableCache) {
                syncHeaders['Cache-Control'] = 'no-cache';
            }
            manifest = await this.userDataSyncStoreService.manifest(manifest, syncHeaders);
        }
        catch (error) {
            const userDataSyncError = UserDataSyncError.toUserDataSyncError(error);
            reportUserDataSyncError(userDataSyncError, executionId, this.userDataSyncStoreManagementService, this.telemetryService);
            throw userDataSyncError;
        }
        const executed = false;
        const that = this;
        let cancellablePromise;
        return {
            manifest,
            async run() {
                if (executed) {
                    throw new Error('Can run a task only once');
                }
                cancellablePromise = createCancelablePromise(token => that.sync(manifest, false, executionId, token));
                await cancellablePromise.finally(() => cancellablePromise = undefined);
                that.logService.info(`Sync done. Took ${new Date().getTime() - startTime}ms`);
                that.updateLastSyncTime();
            },
            stop() {
                cancellablePromise?.cancel();
                return that.stop();
            }
        };
    }
    async createManualSyncTask() {
        this.checkEnablement();
        if (this.userDataSyncEnablementService.isEnabled()) {
            throw new UserDataSyncError('Cannot start manual sync when sync is enabled', "LocalError" /* UserDataSyncErrorCode.LocalError */);
        }
        this.logService.info('Sync started.');
        const startTime = new Date().getTime();
        const executionId = generateUuid();
        const syncHeaders = createSyncHeaders(executionId);
        let latestUserDataOrManifest;
        try {
            latestUserDataOrManifest = await this.userDataSyncStoreService.getLatestData(syncHeaders);
        }
        catch (error) {
            const userDataSyncError = UserDataSyncError.toUserDataSyncError(error);
            this.telemetryService.publicLog2('sync.download.latest', {
                code: userDataSyncError.code,
                serverCode: userDataSyncError instanceof UserDataSyncStoreError ? String(userDataSyncError.serverCode) : undefined,
                url: userDataSyncError instanceof UserDataSyncStoreError ? userDataSyncError.url : undefined,
                resource: userDataSyncError.resource,
                executionId,
                service: this.userDataSyncStoreManagementService.userDataSyncStore.url.toString()
            });
            // Fallback to manifest in stable
            try {
                latestUserDataOrManifest = await this.userDataSyncStoreService.manifest(null, syncHeaders);
            }
            catch (error) {
                const userDataSyncError = UserDataSyncError.toUserDataSyncError(error);
                reportUserDataSyncError(userDataSyncError, executionId, this.userDataSyncStoreManagementService, this.telemetryService);
                throw userDataSyncError;
            }
        }
        /* Manual sync shall start on clean local state */
        await this.resetLocal();
        const that = this;
        const cancellableToken = new CancellationTokenSource();
        return {
            id: executionId,
            async merge() {
                return that.sync(latestUserDataOrManifest, true, executionId, cancellableToken.token);
            },
            async apply() {
                try {
                    try {
                        await that.applyManualSync(latestUserDataOrManifest, executionId, cancellableToken.token);
                    }
                    catch (error) {
                        if (UserDataSyncError.toUserDataSyncError(error).code === "MethodNotFound" /* UserDataSyncErrorCode.MethodNotFound */) {
                            that.logService.info('Client is making invalid requests. Cleaning up data...');
                            await that.cleanUpRemoteData();
                            that.logService.info('Applying manual sync again...');
                            await that.applyManualSync(latestUserDataOrManifest, executionId, cancellableToken.token);
                        }
                        else {
                            throw error;
                        }
                    }
                }
                catch (error) {
                    that.logService.error(error);
                    throw error;
                }
                that.logService.info(`Sync done. Took ${new Date().getTime() - startTime}ms`);
                that.updateLastSyncTime();
            },
            async stop() {
                cancellableToken.cancel();
                await that.stop();
                await that.resetLocal();
            }
        };
    }
    async sync(manifestOrLatestData, preview, executionId, token) {
        this._syncErrors = [];
        try {
            if (this.status !== "hasConflicts" /* SyncStatus.HasConflicts */) {
                this.setStatus("syncing" /* SyncStatus.Syncing */);
            }
            // Sync Default Profile First
            const defaultProfileSynchronizer = this.getOrCreateActiveProfileSynchronizer(this.userDataProfilesService.defaultProfile, undefined);
            this._syncErrors.push(...await this.syncProfile(defaultProfileSynchronizer, manifestOrLatestData, preview, executionId, token));
            // Sync other profiles
            const userDataProfileManifestSynchronizer = defaultProfileSynchronizer.enabled.find(s => s.resource === "profiles" /* SyncResource.Profiles */);
            if (userDataProfileManifestSynchronizer) {
                const syncProfiles = (await userDataProfileManifestSynchronizer.getLastSyncedProfiles()) || [];
                if (token.isCancellationRequested) {
                    return;
                }
                await this.syncRemoteProfiles(syncProfiles, manifestOrLatestData, preview, executionId, token);
            }
        }
        finally {
            if (this.status !== "hasConflicts" /* SyncStatus.HasConflicts */) {
                this.setStatus("idle" /* SyncStatus.Idle */);
            }
            this._onSyncErrors.fire(this._syncErrors);
        }
    }
    async syncRemoteProfiles(remoteProfiles, manifest, preview, executionId, token) {
        for (const syncProfile of remoteProfiles) {
            if (token.isCancellationRequested) {
                return;
            }
            const profile = this.userDataProfilesService.profiles.find(p => p.id === syncProfile.id);
            if (!profile) {
                this.logService.error(`Profile with id:${syncProfile.id} and name: ${syncProfile.name} does not exist locally to sync.`);
                continue;
            }
            this.logService.info('Syncing profile.', syncProfile.name);
            const profileSynchronizer = this.getOrCreateActiveProfileSynchronizer(profile, syncProfile);
            this._syncErrors.push(...await this.syncProfile(profileSynchronizer, manifest, preview, executionId, token));
        }
        // Dispose & Delete profile synchronizers which do not exist anymore
        for (const [key, profileSynchronizerItem] of this.activeProfileSynchronizers.entries()) {
            if (this.userDataProfilesService.profiles.some(p => p.id === profileSynchronizerItem[0].profile.id)) {
                continue;
            }
            await profileSynchronizerItem[0].resetLocal();
            profileSynchronizerItem[1].dispose();
            this.activeProfileSynchronizers.delete(key);
        }
    }
    async applyManualSync(manifestOrLatestData, executionId, token) {
        try {
            this.setStatus("syncing" /* SyncStatus.Syncing */);
            const profileSynchronizers = this.getActiveProfileSynchronizers();
            for (const profileSynchronizer of profileSynchronizers) {
                if (token.isCancellationRequested) {
                    return;
                }
                await profileSynchronizer.apply(executionId, token);
            }
            const defaultProfileSynchronizer = profileSynchronizers.find(s => s.profile.isDefault);
            if (!defaultProfileSynchronizer) {
                return;
            }
            const userDataProfileManifestSynchronizer = defaultProfileSynchronizer.enabled.find(s => s.resource === "profiles" /* SyncResource.Profiles */);
            if (!userDataProfileManifestSynchronizer) {
                return;
            }
            // Sync remote profiles which are not synced locally
            const remoteProfiles = (await userDataProfileManifestSynchronizer.getRemoteSyncedProfiles(getRefOrUserData(manifestOrLatestData, undefined, "profiles" /* SyncResource.Profiles */) ?? null)) || [];
            const remoteProfilesToSync = remoteProfiles.filter(remoteProfile => profileSynchronizers.every(s => s.profile.id !== remoteProfile.id));
            if (remoteProfilesToSync.length) {
                await this.syncRemoteProfiles(remoteProfilesToSync, manifestOrLatestData, false, executionId, token);
            }
        }
        finally {
            this.setStatus("idle" /* SyncStatus.Idle */);
        }
    }
    async syncProfile(profileSynchronizer, manifestOrLatestData, preview, executionId, token) {
        const errors = await profileSynchronizer.sync(manifestOrLatestData, preview, executionId, token);
        return errors.map(([syncResource, error]) => ({ profile: profileSynchronizer.profile, syncResource, error }));
    }
    async stop() {
        if (this.status !== "idle" /* SyncStatus.Idle */) {
            await Promise.allSettled(this.getActiveProfileSynchronizers().map(profileSynchronizer => profileSynchronizer.stop()));
        }
    }
    async resolveContent(resource) {
        const content = await this.userDataSyncResourceProviderService.resolveContent(resource);
        if (content) {
            return content;
        }
        for (const profileSynchronizer of this.getActiveProfileSynchronizers()) {
            for (const synchronizer of profileSynchronizer.enabled) {
                const content = await synchronizer.resolveContent(resource);
                if (content) {
                    return content;
                }
            }
        }
        return null;
    }
    async replace(syncResourceHandle) {
        this.checkEnablement();
        const profileSyncResource = this.userDataSyncResourceProviderService.resolveUserDataSyncResource(syncResourceHandle);
        if (!profileSyncResource) {
            return;
        }
        const content = await this.resolveContent(syncResourceHandle.uri);
        if (!content) {
            return;
        }
        await this.performAction(profileSyncResource.profile, async (synchronizer) => {
            if (profileSyncResource.syncResource === synchronizer.resource) {
                await synchronizer.replace(content);
                return true;
            }
            return undefined;
        });
        return;
    }
    async accept(syncResource, resource, content, apply) {
        this.checkEnablement();
        await this.performAction(syncResource.profile, async (synchronizer) => {
            if (syncResource.syncResource === synchronizer.resource) {
                await synchronizer.accept(resource, content);
                if (apply) {
                    await synchronizer.apply(isBoolean(apply) ? false : apply.force, createSyncHeaders(generateUuid()));
                }
                return true;
            }
            return undefined;
        });
    }
    async hasLocalData() {
        const result = await this.performAction(this.userDataProfilesService.defaultProfile, async (synchronizer) => {
            // skip global state synchronizer
            if (synchronizer.resource !== "globalState" /* SyncResource.GlobalState */ && await synchronizer.hasLocalData()) {
                return true;
            }
            return undefined;
        });
        return !!result;
    }
    async hasPreviouslySynced() {
        const result = await this.performAction(this.userDataProfilesService.defaultProfile, async (synchronizer) => {
            if (await synchronizer.hasPreviouslySynced()) {
                return true;
            }
            return undefined;
        });
        return !!result;
    }
    async reset() {
        this.checkEnablement();
        await this.resetRemote();
        await this.resetLocal();
    }
    async resetRemote() {
        this.checkEnablement();
        try {
            await this.userDataSyncStoreService.clear();
            this.logService.info('Cleared data on server');
        }
        catch (e) {
            this.logService.error(e);
        }
        this._onDidResetRemote.fire();
    }
    async resetLocal() {
        this.checkEnablement();
        this._lastSyncTime = undefined;
        this.storageService.remove(LAST_SYNC_TIME_KEY, -1 /* StorageScope.APPLICATION */);
        for (const [synchronizer] of this.activeProfileSynchronizers.values()) {
            try {
                await synchronizer.resetLocal();
            }
            catch (e) {
                this.logService.error(e);
            }
        }
        this.clearActiveProfileSynchronizers();
        this._onDidResetLocal.fire();
        this.logService.info('Did reset the local sync state.');
    }
    async cleanUpStaleStorageData() {
        const allKeys = this.storageService.keys(-1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
        const lastSyncProfileKeys = [];
        for (const key of allKeys) {
            if (!key.endsWith('.lastSyncUserData')) {
                continue;
            }
            const segments = key.split('.');
            if (segments.length === 3) {
                lastSyncProfileKeys.push([key, segments[0]]);
            }
        }
        if (!lastSyncProfileKeys.length) {
            return;
        }
        const disposables = new DisposableStore();
        try {
            let defaultProfileSynchronizer = this.activeProfileSynchronizers.get(this.userDataProfilesService.defaultProfile.id)?.[0];
            if (!defaultProfileSynchronizer) {
                defaultProfileSynchronizer = disposables.add(this.instantiationService.createInstance(ProfileSynchronizer, this.userDataProfilesService.defaultProfile, undefined));
            }
            const userDataProfileManifestSynchronizer = defaultProfileSynchronizer.enabled.find(s => s.resource === "profiles" /* SyncResource.Profiles */);
            if (!userDataProfileManifestSynchronizer) {
                return;
            }
            const lastSyncedProfiles = await userDataProfileManifestSynchronizer.getLastSyncedProfiles();
            const lastSyncedCollections = lastSyncedProfiles?.map(p => p.collection) ?? [];
            for (const [key, collection] of lastSyncProfileKeys) {
                if (!lastSyncedCollections.includes(collection)) {
                    this.logService.info(`Removing last sync state for stale profile: ${collection}`);
                    this.storageService.remove(key, -1 /* StorageScope.APPLICATION */);
                }
            }
        }
        finally {
            disposables.dispose();
        }
    }
    async cleanUpRemoteData() {
        const remoteProfiles = await this.userDataSyncResourceProviderService.getRemoteSyncedProfiles();
        const remoteProfileCollections = remoteProfiles.map(profile => profile.collection);
        const allCollections = await this.userDataSyncStoreService.getAllCollections();
        const redundantCollections = allCollections.filter(c => !remoteProfileCollections.includes(c));
        if (redundantCollections.length) {
            this.logService.info(`Deleting ${redundantCollections.length} redundant collections on server`);
            await Promise.allSettled(redundantCollections.map(collectionId => this.userDataSyncStoreService.deleteCollection(collectionId)));
            this.logService.info(`Deleted redundant collections on server`);
        }
        const updatedRemoteProfiles = remoteProfiles.filter(profile => allCollections.includes(profile.collection));
        if (updatedRemoteProfiles.length !== remoteProfiles.length) {
            const profileManifestSynchronizer = this.instantiationService.createInstance(UserDataProfilesManifestSynchroniser, this.userDataProfilesService.defaultProfile, undefined);
            try {
                this.logService.info('Resetting the last synced state of profiles');
                await profileManifestSynchronizer.resetLocal();
                this.logService.info('Did reset the last synced state of profiles');
                this.logService.info(`Updating remote profiles with invalid collections on server`);
                await profileManifestSynchronizer.updateRemoteProfiles(updatedRemoteProfiles, null);
                this.logService.info(`Updated remote profiles on server`);
            }
            finally {
                profileManifestSynchronizer.dispose();
            }
        }
    }
    async saveRemoteActivityData(location) {
        this.checkEnablement();
        const data = await this.userDataSyncStoreService.getActivityData();
        await this.fileService.writeFile(location, data);
    }
    async extractActivityData(activityDataResource, location) {
        const content = (await this.fileService.readFile(activityDataResource)).value.toString();
        const activityData = JSON.parse(content);
        if (activityData.resources) {
            for (const resource in activityData.resources) {
                for (const version of activityData.resources[resource]) {
                    await this.userDataSyncLocalStoreService.writeResource(resource, version.content, new Date(version.created * 1000), undefined, location);
                }
            }
        }
        if (activityData.collections) {
            for (const collection in activityData.collections) {
                for (const resource in activityData.collections[collection].resources) {
                    for (const version of activityData.collections[collection].resources?.[resource] ?? []) {
                        await this.userDataSyncLocalStoreService.writeResource(resource, version.content, new Date(version.created * 1000), collection, location);
                    }
                }
            }
        }
    }
    async performAction(profile, action) {
        const disposables = new DisposableStore();
        try {
            const activeProfileSyncronizer = this.activeProfileSynchronizers.get(profile.id);
            if (activeProfileSyncronizer) {
                const result = await this.performActionWithProfileSynchronizer(activeProfileSyncronizer[0], action, disposables);
                return isUndefined(result) ? null : result;
            }
            if (profile.isDefault) {
                const defaultProfileSynchronizer = disposables.add(this.instantiationService.createInstance(ProfileSynchronizer, profile, undefined));
                const result = await this.performActionWithProfileSynchronizer(defaultProfileSynchronizer, action, disposables);
                return isUndefined(result) ? null : result;
            }
            const userDataProfileManifestSynchronizer = disposables.add(this.instantiationService.createInstance(UserDataProfilesManifestSynchroniser, profile, undefined));
            const manifest = await this.userDataSyncStoreService.manifest(null);
            const syncProfiles = (await userDataProfileManifestSynchronizer.getRemoteSyncedProfiles(manifest?.latest?.profiles ?? null)) || [];
            const syncProfile = syncProfiles.find(syncProfile => syncProfile.id === profile.id);
            if (syncProfile) {
                const profileSynchronizer = disposables.add(this.instantiationService.createInstance(ProfileSynchronizer, profile, syncProfile.collection));
                const result = await this.performActionWithProfileSynchronizer(profileSynchronizer, action, disposables);
                return isUndefined(result) ? null : result;
            }
            return null;
        }
        finally {
            disposables.dispose();
        }
    }
    async performActionWithProfileSynchronizer(profileSynchronizer, action, disposables) {
        const allSynchronizers = [...profileSynchronizer.enabled, ...profileSynchronizer.disabled.reduce((synchronizers, syncResource) => {
                if (syncResource !== "workspaceState" /* SyncResource.WorkspaceState */) {
                    synchronizers.push(disposables.add(profileSynchronizer.createSynchronizer(syncResource)));
                }
                return synchronizers;
            }, [])];
        for (const synchronizer of allSynchronizers) {
            const result = await action(synchronizer);
            if (!isUndefined(result)) {
                return result;
            }
        }
        return undefined;
    }
    setStatus(status) {
        const oldStatus = this._status;
        if (this._status !== status) {
            this._status = status;
            this._onDidChangeStatus.fire(status);
            if (oldStatus === "hasConflicts" /* SyncStatus.HasConflicts */) {
                this.updateLastSyncTime();
            }
        }
    }
    updateConflicts() {
        const conflicts = this.getActiveProfileSynchronizers().map(synchronizer => synchronizer.conflicts).flat();
        if (!equals(this._conflicts, conflicts, (a, b) => a.profile.id === b.profile.id && a.syncResource === b.syncResource && equals(a.conflicts, b.conflicts, (a, b) => isEqual(a.previewResource, b.previewResource)))) {
            this._conflicts = conflicts;
            this._onDidChangeConflicts.fire(conflicts);
        }
    }
    updateLastSyncTime() {
        if (this.status === "idle" /* SyncStatus.Idle */) {
            this._lastSyncTime = new Date().getTime();
            this.storageService.store(LAST_SYNC_TIME_KEY, this._lastSyncTime, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
            this._onDidChangeLastSyncTime.fire(this._lastSyncTime);
        }
    }
    getOrCreateActiveProfileSynchronizer(profile, syncProfile) {
        let activeProfileSynchronizer = this.activeProfileSynchronizers.get(profile.id);
        if (activeProfileSynchronizer && activeProfileSynchronizer[0].collection !== syncProfile?.collection) {
            this.logService.error('Profile synchronizer collection does not match with the remote sync profile collection');
            activeProfileSynchronizer[1].dispose();
            activeProfileSynchronizer = undefined;
            this.activeProfileSynchronizers.delete(profile.id);
        }
        if (!activeProfileSynchronizer) {
            const disposables = new DisposableStore();
            const profileSynchronizer = disposables.add(this.instantiationService.createInstance(ProfileSynchronizer, profile, syncProfile?.collection));
            disposables.add(profileSynchronizer.onDidChangeStatus(e => this.setStatus(e)));
            disposables.add(profileSynchronizer.onDidChangeConflicts(conflicts => this.updateConflicts()));
            disposables.add(profileSynchronizer.onDidChangeLocal(e => this._onDidChangeLocal.fire(e)));
            this.activeProfileSynchronizers.set(profile.id, activeProfileSynchronizer = [profileSynchronizer, disposables]);
        }
        return activeProfileSynchronizer[0];
    }
    getActiveProfileSynchronizers() {
        const profileSynchronizers = [];
        for (const [profileSynchronizer] of this.activeProfileSynchronizers.values()) {
            profileSynchronizers.push(profileSynchronizer);
        }
        return profileSynchronizers;
    }
    clearActiveProfileSynchronizers() {
        this.activeProfileSynchronizers.forEach(([, disposable]) => disposable.dispose());
        this.activeProfileSynchronizers.clear();
    }
    checkEnablement() {
        if (!this.userDataSyncStoreManagementService.userDataSyncStore) {
            throw new Error('Not enabled');
        }
    }
};
UserDataSyncService = __decorate([
    __param(0, IFileService),
    __param(1, IUserDataSyncStoreService),
    __param(2, IUserDataSyncStoreManagementService),
    __param(3, IInstantiationService),
    __param(4, IUserDataSyncLogService),
    __param(5, ITelemetryService),
    __param(6, IStorageService),
    __param(7, IUserDataSyncEnablementService),
    __param(8, IUserDataProfilesService),
    __param(9, IUserDataSyncResourceProviderService),
    __param(10, IUserDataSyncLocalStoreService)
], UserDataSyncService);
export { UserDataSyncService };
let ProfileSynchronizer = class ProfileSynchronizer extends Disposable {
    get enabled() { return this._enabled.sort((a, b) => a[1] - b[1]).map(([synchronizer]) => synchronizer); }
    get disabled() { return ALL_SYNC_RESOURCES.filter(syncResource => !this.userDataSyncEnablementService.isResourceEnabled(syncResource)); }
    get status() { return this._status; }
    get conflicts() { return this._conflicts; }
    constructor(profile, collection, userDataSyncEnablementService, instantiationService, extensionGalleryService, userDataSyncStoreManagementService, telemetryService, logService, configurationService) {
        super();
        this.profile = profile;
        this.collection = collection;
        this.userDataSyncEnablementService = userDataSyncEnablementService;
        this.instantiationService = instantiationService;
        this.extensionGalleryService = extensionGalleryService;
        this.userDataSyncStoreManagementService = userDataSyncStoreManagementService;
        this.telemetryService = telemetryService;
        this.logService = logService;
        this.configurationService = configurationService;
        this._enabled = [];
        this._status = "idle" /* SyncStatus.Idle */;
        this._onDidChangeStatus = this._register(new Emitter());
        this.onDidChangeStatus = this._onDidChangeStatus.event;
        this._onDidChangeLocal = this._register(new Emitter());
        this.onDidChangeLocal = this._onDidChangeLocal.event;
        this._conflicts = [];
        this._onDidChangeConflicts = this._register(new Emitter());
        this.onDidChangeConflicts = this._onDidChangeConflicts.event;
        this._register(userDataSyncEnablementService.onDidChangeResourceEnablement(([syncResource, enablement]) => this.onDidChangeResourceEnablement(syncResource, enablement)));
        this._register(toDisposable(() => this._enabled.splice(0, this._enabled.length).forEach(([, , disposable]) => disposable.dispose())));
        for (const syncResource of ALL_SYNC_RESOURCES) {
            if (userDataSyncEnablementService.isResourceEnabled(syncResource)) {
                this.registerSynchronizer(syncResource);
            }
        }
    }
    onDidChangeResourceEnablement(syncResource, enabled) {
        if (enabled) {
            this.registerSynchronizer(syncResource);
        }
        else {
            this.deRegisterSynchronizer(syncResource);
        }
    }
    registerSynchronizer(syncResource) {
        if (this._enabled.some(([synchronizer]) => synchronizer.resource === syncResource)) {
            return;
        }
        if (syncResource === "extensions" /* SyncResource.Extensions */ && !this.extensionGalleryService.isEnabled()) {
            this.logService.info('Skipping extensions sync because gallery is not configured');
            return;
        }
        if (syncResource === "profiles" /* SyncResource.Profiles */) {
            if (!this.profile.isDefault) {
                return;
            }
        }
        if (syncResource === "workspaceState" /* SyncResource.WorkspaceState */) {
            return;
        }
        if (syncResource !== "profiles" /* SyncResource.Profiles */ && this.profile.useDefaultFlags?.[syncResource]) {
            this.logService.debug(`Skipping syncing ${syncResource} in ${this.profile.name} because it is already synced by default profile`);
            return;
        }
        const disposables = new DisposableStore();
        const synchronizer = disposables.add(this.createSynchronizer(syncResource));
        disposables.add(synchronizer.onDidChangeStatus(() => this.updateStatus()));
        disposables.add(synchronizer.onDidChangeConflicts(() => this.updateConflicts()));
        disposables.add(synchronizer.onDidChangeLocal(() => this._onDidChangeLocal.fire(syncResource)));
        const order = this.getOrder(syncResource);
        this._enabled.push([synchronizer, order, disposables]);
    }
    deRegisterSynchronizer(syncResource) {
        const index = this._enabled.findIndex(([synchronizer]) => synchronizer.resource === syncResource);
        if (index !== -1) {
            const [[synchronizer, , disposable]] = this._enabled.splice(index, 1);
            disposable.dispose();
            this.updateStatus();
            synchronizer.stop().then(null, error => this.logService.error(error));
        }
    }
    createSynchronizer(syncResource) {
        switch (syncResource) {
            case "settings" /* SyncResource.Settings */: return this.instantiationService.createInstance(SettingsSynchroniser, this.profile, this.collection);
            case "keybindings" /* SyncResource.Keybindings */: return this.instantiationService.createInstance(KeybindingsSynchroniser, this.profile, this.collection);
            case "snippets" /* SyncResource.Snippets */: return this.instantiationService.createInstance(SnippetsSynchroniser, this.profile, this.collection);
            case "prompts" /* SyncResource.Prompts */: return this.instantiationService.createInstance(PromptsSynchronizer, this.profile, this.collection);
            case "tasks" /* SyncResource.Tasks */: return this.instantiationService.createInstance(TasksSynchroniser, this.profile, this.collection);
            case "mcp" /* SyncResource.Mcp */: return this.instantiationService.createInstance(McpSynchroniser, this.profile, this.collection);
            case "globalState" /* SyncResource.GlobalState */: return this.instantiationService.createInstance(GlobalStateSynchroniser, this.profile, this.collection);
            case "extensions" /* SyncResource.Extensions */: return this.instantiationService.createInstance(ExtensionsSynchroniser, this.profile, this.collection);
            case "profiles" /* SyncResource.Profiles */: return this.instantiationService.createInstance(UserDataProfilesManifestSynchroniser, this.profile, this.collection);
        }
    }
    async sync(manifestOrLatestData, preview, executionId, token) {
        // Return if cancellation is requested
        if (token.isCancellationRequested) {
            return [];
        }
        const synchronizers = this.enabled;
        if (!synchronizers.length) {
            return [];
        }
        try {
            const syncErrors = [];
            const syncHeaders = createSyncHeaders(executionId);
            const userDataSyncConfiguration = preview ? await this.getUserDataSyncConfiguration(manifestOrLatestData) : this.getLocalUserDataSyncConfiguration();
            for (const synchroniser of synchronizers) {
                // Return if cancellation is requested
                if (token.isCancellationRequested) {
                    return [];
                }
                // Return if resource is not enabled
                if (!this.userDataSyncEnablementService.isResourceEnabled(synchroniser.resource)) {
                    return [];
                }
                try {
                    const refOrUserData = getRefOrUserData(manifestOrLatestData, this.collection, synchroniser.resource) ?? null;
                    await synchroniser.sync(refOrUserData, preview, userDataSyncConfiguration, syncHeaders);
                }
                catch (e) {
                    const userDataSyncError = UserDataSyncError.toUserDataSyncError(e);
                    reportUserDataSyncError(userDataSyncError, executionId, this.userDataSyncStoreManagementService, this.telemetryService);
                    if (canBailout(e)) {
                        throw userDataSyncError;
                    }
                    // Log and and continue
                    this.logService.error(e);
                    this.logService.error(`${synchroniser.resource}: ${toErrorMessage(e)}`);
                    syncErrors.push([synchroniser.resource, userDataSyncError]);
                }
            }
            return syncErrors;
        }
        finally {
            this.updateStatus();
        }
    }
    async apply(executionId, token) {
        const syncHeaders = createSyncHeaders(executionId);
        for (const synchroniser of this.enabled) {
            if (token.isCancellationRequested) {
                return;
            }
            try {
                await synchroniser.apply(false, syncHeaders);
            }
            catch (e) {
                const userDataSyncError = UserDataSyncError.toUserDataSyncError(e);
                reportUserDataSyncError(userDataSyncError, executionId, this.userDataSyncStoreManagementService, this.telemetryService);
                if (canBailout(e)) {
                    throw userDataSyncError;
                }
                // Log and and continue
                this.logService.error(e);
                this.logService.error(`${synchroniser.resource}: ${toErrorMessage(e)}`);
            }
        }
    }
    async stop() {
        for (const synchroniser of this.enabled) {
            try {
                if (synchroniser.status !== "idle" /* SyncStatus.Idle */) {
                    await synchroniser.stop();
                }
            }
            catch (e) {
                this.logService.error(e);
            }
        }
    }
    async resetLocal() {
        for (const synchroniser of this.enabled) {
            try {
                await synchroniser.resetLocal();
            }
            catch (e) {
                this.logService.error(`${synchroniser.resource}: ${toErrorMessage(e)}`);
                this.logService.error(e);
            }
        }
    }
    async getUserDataSyncConfiguration(manifestOrLatestData) {
        if (!this.profile.isDefault) {
            return {};
        }
        const local = this.getLocalUserDataSyncConfiguration();
        const settingsSynchronizer = this.enabled.find(synchronizer => synchronizer instanceof SettingsSynchroniser);
        if (settingsSynchronizer) {
            const remote = await settingsSynchronizer.getRemoteUserDataSyncConfiguration(getRefOrUserData(manifestOrLatestData, this.collection, "settings" /* SyncResource.Settings */) ?? null);
            return { ...local, ...remote };
        }
        return local;
    }
    getLocalUserDataSyncConfiguration() {
        return this.configurationService.getValue(USER_DATA_SYNC_CONFIGURATION_SCOPE);
    }
    setStatus(status) {
        if (this._status !== status) {
            this._status = status;
            this._onDidChangeStatus.fire(status);
        }
    }
    updateStatus() {
        this.updateConflicts();
        if (this.enabled.some(s => s.status === "hasConflicts" /* SyncStatus.HasConflicts */)) {
            return this.setStatus("hasConflicts" /* SyncStatus.HasConflicts */);
        }
        if (this.enabled.some(s => s.status === "syncing" /* SyncStatus.Syncing */)) {
            return this.setStatus("syncing" /* SyncStatus.Syncing */);
        }
        return this.setStatus("idle" /* SyncStatus.Idle */);
    }
    updateConflicts() {
        const conflicts = this.enabled.filter(s => s.status === "hasConflicts" /* SyncStatus.HasConflicts */)
            .filter(s => s.conflicts.conflicts.length > 0)
            .map(s => s.conflicts);
        if (!equals(this._conflicts, conflicts, (a, b) => a.syncResource === b.syncResource && equals(a.conflicts, b.conflicts, (a, b) => isEqual(a.previewResource, b.previewResource)))) {
            this._conflicts = conflicts;
            this._onDidChangeConflicts.fire(conflicts);
        }
    }
    getOrder(syncResource) {
        switch (syncResource) {
            case "settings" /* SyncResource.Settings */: return 0;
            case "keybindings" /* SyncResource.Keybindings */: return 1;
            case "snippets" /* SyncResource.Snippets */: return 2;
            case "tasks" /* SyncResource.Tasks */: return 3;
            case "mcp" /* SyncResource.Mcp */: return 4;
            case "globalState" /* SyncResource.GlobalState */: return 5;
            case "extensions" /* SyncResource.Extensions */: return 6;
            case "prompts" /* SyncResource.Prompts */: return 7;
            case "profiles" /* SyncResource.Profiles */: return 8;
            case "workspaceState" /* SyncResource.WorkspaceState */: return 9;
        }
    }
};
ProfileSynchronizer = __decorate([
    __param(2, IUserDataSyncEnablementService),
    __param(3, IInstantiationService),
    __param(4, IExtensionGalleryService),
    __param(5, IUserDataSyncStoreManagementService),
    __param(6, ITelemetryService),
    __param(7, IUserDataSyncLogService),
    __param(8, IConfigurationService)
], ProfileSynchronizer);
function canBailout(e) {
    if (e instanceof UserDataSyncError) {
        switch (e.code) {
            case "MethodNotFound" /* UserDataSyncErrorCode.MethodNotFound */:
            case "TooLarge" /* UserDataSyncErrorCode.TooLarge */:
            case "RemoteTooManyRequests" /* UserDataSyncErrorCode.TooManyRequests */:
            case "TooManyRequestsAndRetryAfter" /* UserDataSyncErrorCode.TooManyRequestsAndRetryAfter */:
            case "LocalTooManyRequests" /* UserDataSyncErrorCode.LocalTooManyRequests */:
            case "LocalTooManyProfiles" /* UserDataSyncErrorCode.LocalTooManyProfiles */:
            case "Gone" /* UserDataSyncErrorCode.Gone */:
            case "UpgradeRequired" /* UserDataSyncErrorCode.UpgradeRequired */:
            case "IncompatibleRemoteContent" /* UserDataSyncErrorCode.IncompatibleRemoteContent */:
            case "IncompatibleLocalContent" /* UserDataSyncErrorCode.IncompatibleLocalContent */:
                return true;
        }
    }
    return false;
}
function reportUserDataSyncError(userDataSyncError, executionId, userDataSyncStoreManagementService, telemetryService) {
    telemetryService.publicLog2('sync/error', {
        code: userDataSyncError.code,
        serverCode: userDataSyncError instanceof UserDataSyncStoreError ? String(userDataSyncError.serverCode) : undefined,
        url: userDataSyncError instanceof UserDataSyncStoreError ? userDataSyncError.url : undefined,
        resource: userDataSyncError.resource,
        executionId,
        service: userDataSyncStoreManagementService.userDataSyncStore.url.toString()
    });
}
function getRefOrUserData(manifestOrLatestData, collection, resource) {
    if (isUserDataManifest(manifestOrLatestData)) {
        if (collection) {
            return manifestOrLatestData?.collections?.[collection]?.latest?.[resource];
        }
        return manifestOrLatestData?.latest?.[resource];
    }
    if (collection) {
        return manifestOrLatestData?.collections?.[collection]?.resources?.[resource];
    }
    return manifestOrLatestData?.resources?.[resource];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlckRhdGFTeW5jU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luY1NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3hELE9BQU8sRUFBcUIsdUJBQXVCLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUM3RyxPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxZQUFZLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMzRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDNUQsT0FBTyxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUV2RSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDNUQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDcEYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDbkcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQzNELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0saUNBQWlDLENBQUM7QUFDL0YsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0scUNB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