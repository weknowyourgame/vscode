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
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { LinkedList } from '../../../../base/common/linkedList.js';
import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IRemoteAuthorityResolverService } from '../../../../platform/remote/common/remoteAuthorityResolver.js';
import { getRemoteAuthority } from '../../../../platform/remote/common/remoteHosts.js';
import { isVirtualResource } from '../../../../platform/workspace/common/virtualWorkspace.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { isSavedWorkspace, isSingleFolderWorkspaceIdentifier, isTemporaryWorkspace, IWorkspaceContextService, toWorkspaceIdentifier } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspaceTrustManagementService, IWorkspaceTrustRequestService, IWorkspaceTrustEnablementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { Memento } from '../../../common/memento.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { isEqualAuthority } from '../../../../base/common/resources.js';
import { isWeb } from '../../../../base/common/platform.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { promiseWithResolvers } from '../../../../base/common/async.js';
export const WORKSPACE_TRUST_ENABLED = 'security.workspace.trust.enabled';
export const WORKSPACE_TRUST_STARTUP_PROMPT = 'security.workspace.trust.startupPrompt';
export const WORKSPACE_TRUST_BANNER = 'security.workspace.trust.banner';
export const WORKSPACE_TRUST_UNTRUSTED_FILES = 'security.workspace.trust.untrustedFiles';
export const WORKSPACE_TRUST_EMPTY_WINDOW = 'security.workspace.trust.emptyWindow';
export const WORKSPACE_TRUST_EXTENSION_SUPPORT = 'extensions.supportUntrustedWorkspaces';
export const WORKSPACE_TRUST_STORAGE_KEY = 'content.trust.model.key';
export class CanonicalWorkspace {
    constructor(originalWorkspace, canonicalFolderUris, canonicalConfiguration) {
        this.originalWorkspace = originalWorkspace;
        this.canonicalFolderUris = canonicalFolderUris;
        this.canonicalConfiguration = canonicalConfiguration;
    }
    get folders() {
        return this.originalWorkspace.folders.map((folder, index) => {
            return {
                index: folder.index,
                name: folder.name,
                toResource: folder.toResource,
                uri: this.canonicalFolderUris[index]
            };
        });
    }
    get transient() {
        return this.originalWorkspace.transient;
    }
    get configuration() {
        return this.canonicalConfiguration ?? this.originalWorkspace.configuration;
    }
    get id() {
        return this.originalWorkspace.id;
    }
}
let WorkspaceTrustEnablementService = class WorkspaceTrustEnablementService extends Disposable {
    constructor(configurationService, environmentService) {
        super();
        this.configurationService = configurationService;
        this.environmentService = environmentService;
    }
    isWorkspaceTrustEnabled() {
        if (this.environmentService.disableWorkspaceTrust) {
            return false;
        }
        return !!this.configurationService.getValue(WORKSPACE_TRUST_ENABLED);
    }
};
WorkspaceTrustEnablementService = __decorate([
    __param(0, IConfigurationService),
    __param(1, IWorkbenchEnvironmentService)
], WorkspaceTrustEnablementService);
export { WorkspaceTrustEnablementService };
let WorkspaceTrustManagementService = class WorkspaceTrustManagementService extends Disposable {
    constructor(configurationService, remoteAuthorityResolverService, storageService, uriIdentityService, environmentService, workspaceService, workspaceTrustEnablementService, fileService) {
        super();
        this.configurationService = configurationService;
        this.remoteAuthorityResolverService = remoteAuthorityResolverService;
        this.storageService = storageService;
        this.uriIdentityService = uriIdentityService;
        this.environmentService = environmentService;
        this.workspaceService = workspaceService;
        this.workspaceTrustEnablementService = workspaceTrustEnablementService;
        this.fileService = fileService;
        this.storageKey = WORKSPACE_TRUST_STORAGE_KEY;
        this._onDidChangeTrust = this._register(new Emitter());
        this.onDidChangeTrust = this._onDidChangeTrust.event;
        this._onDidChangeTrustedFolders = this._register(new Emitter());
        this.onDidChangeTrustedFolders = this._onDidChangeTrustedFolders.event;
        this._canonicalStartupFiles = [];
        this._canonicalUrisResolved = false;
        this._canonicalWorkspace = this.workspaceService.getWorkspace();
        ({ promise: this._workspaceResolvedPromise, resolve: this._workspaceResolvedPromiseResolve } = promiseWithResolvers());
        ({ promise: this._workspaceTrustInitializedPromise, resolve: this._workspaceTrustInitializedPromiseResolve } = promiseWithResolvers());
        this._storedTrustState = new WorkspaceTrustMemento(isWeb && this.isEmptyWorkspace() ? undefined : this.storageService);
        this._trustTransitionManager = this._register(new WorkspaceTrustTransitionManager());
        this._trustStateInfo = this.loadTrustInfo();
        this._isTrusted = this.calculateWorkspaceTrust();
        this.initializeWorkspaceTrust();
        this.registerListeners();
    }
    //#region initialize
    initializeWorkspaceTrust() {
        // Resolve canonical Uris
        this.resolveCanonicalUris()
            .then(async () => {
            this._canonicalUrisResolved = true;
            await this.updateWorkspaceTrust();
        })
            .finally(() => {
            this._workspaceResolvedPromiseResolve();
            if (!this.environmentService.remoteAuthority) {
                this._workspaceTrustInitializedPromiseResolve();
            }
        });
        // Remote - resolve remote authority
        if (this.environmentService.remoteAuthority) {
            this.remoteAuthorityResolverService.resolveAuthority(this.environmentService.remoteAuthority)
                .then(async (result) => {
                this._remoteAuthority = result;
                await this.fileService.activateProvider(Schemas.vscodeRemote);
                await this.updateWorkspaceTrust();
            })
                .finally(() => {
                this._workspaceTrustInitializedPromiseResolve();
            });
        }
        // Empty workspace - save initial state to memento
        if (this.isEmptyWorkspace()) {
            this._workspaceTrustInitializedPromise.then(() => {
                if (this._storedTrustState.isEmptyWorkspaceTrusted === undefined) {
                    this._storedTrustState.isEmptyWorkspaceTrusted = this.isWorkspaceTrusted();
                }
            });
        }
    }
    //#endregion
    //#region private interface
    registerListeners() {
        this._register(this.workspaceService.onDidChangeWorkspaceFolders(async () => await this.updateWorkspaceTrust()));
        this._register(this.storageService.onDidChangeValue(-1 /* StorageScope.APPLICATION */, this.storageKey, this._store)(async () => {
            /* This will only execute if storage was changed by a user action in a separate window */
            if (JSON.stringify(this._trustStateInfo) !== JSON.stringify(this.loadTrustInfo())) {
                this._trustStateInfo = this.loadTrustInfo();
                this._onDidChangeTrustedFolders.fire();
                await this.updateWorkspaceTrust();
            }
        }));
    }
    async getCanonicalUri(uri) {
        let canonicalUri = uri;
        if (this.environmentService.remoteAuthority && uri.scheme === Schemas.vscodeRemote) {
            canonicalUri = await this.remoteAuthorityResolverService.getCanonicalURI(uri);
        }
        else if (uri.scheme === 'vscode-vfs') {
            const index = uri.authority.indexOf('+');
            if (index !== -1) {
                canonicalUri = uri.with({ authority: uri.authority.substr(0, index) });
            }
        }
        // ignore query and fragent section of uris always
        return canonicalUri.with({ query: null, fragment: null });
    }
    async resolveCanonicalUris() {
        // Open editors
        const filesToOpen = [];
        if (this.environmentService.filesToOpenOrCreate) {
            filesToOpen.push(...this.environmentService.filesToOpenOrCreate);
        }
        if (this.environmentService.filesToDiff) {
            filesToOpen.push(...this.environmentService.filesToDiff);
        }
        if (this.environmentService.filesToMerge) {
            filesToOpen.push(...this.environmentService.filesToMerge);
        }
        if (filesToOpen.length) {
            const filesToOpenOrCreateUris = filesToOpen.filter(f => !!f.fileUri).map(f => f.fileUri);
            const canonicalFilesToOpen = await Promise.all(filesToOpenOrCreateUris.map(uri => this.getCanonicalUri(uri)));
            this._canonicalStartupFiles.push(...canonicalFilesToOpen.filter(uri => this._canonicalStartupFiles.every(u => !this.uriIdentityService.extUri.isEqual(uri, u))));
        }
        // Workspace
        const workspaceUris = this.workspaceService.getWorkspace().folders.map(f => f.uri);
        const canonicalWorkspaceFolders = await Promise.all(workspaceUris.map(uri => this.getCanonicalUri(uri)));
        let canonicalWorkspaceConfiguration = this.workspaceService.getWorkspace().configuration;
        if (canonicalWorkspaceConfiguration && isSavedWorkspace(canonicalWorkspaceConfiguration, this.environmentService)) {
            canonicalWorkspaceConfiguration = await this.getCanonicalUri(canonicalWorkspaceConfiguration);
        }
        this._canonicalWorkspace = new CanonicalWorkspace(this.workspaceService.getWorkspace(), canonicalWorkspaceFolders, canonicalWorkspaceConfiguration);
    }
    loadTrustInfo() {
        const infoAsString = this.storageService.get(this.storageKey, -1 /* StorageScope.APPLICATION */);
        let result;
        try {
            if (infoAsString) {
                result = JSON.parse(infoAsString);
            }
        }
        catch { }
        if (!result) {
            result = {
                uriTrustInfo: []
            };
        }
        if (!result.uriTrustInfo) {
            result.uriTrustInfo = [];
        }
        result.uriTrustInfo = result.uriTrustInfo.map(info => { return { uri: URI.revive(info.uri), trusted: info.trusted }; });
        result.uriTrustInfo = result.uriTrustInfo.filter(info => info.trusted);
        return result;
    }
    async saveTrustInfo() {
        this.storageService.store(this.storageKey, JSON.stringify(this._trustStateInfo), -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
        this._onDidChangeTrustedFolders.fire();
        await this.updateWorkspaceTrust();
    }
    getWorkspaceUris() {
        const workspaceUris = this._canonicalWorkspace.folders.map(f => f.uri);
        const workspaceConfiguration = this._canonicalWorkspace.configuration;
        if (workspaceConfiguration && isSavedWorkspace(workspaceConfiguration, this.environmentService)) {
            workspaceUris.push(workspaceConfiguration);
        }
        return workspaceUris;
    }
    calculateWorkspaceTrust() {
        // Feature is disabled
        if (!this.workspaceTrustEnablementService.isWorkspaceTrustEnabled()) {
            return true;
        }
        // Canonical Uris not yet resolved
        if (!this._canonicalUrisResolved) {
            return false;
        }
        // Remote - resolver explicitly sets workspace trust to TRUE
        if (this.environmentService.remoteAuthority && this._remoteAuthority?.options?.isTrusted) {
            return this._remoteAuthority.options.isTrusted;
        }
        // Empty workspace - use memento, open ediors, or user setting
        if (this.isEmptyWorkspace()) {
            // Use memento if present
            if (this._storedTrustState.isEmptyWorkspaceTrusted !== undefined) {
                return this._storedTrustState.isEmptyWorkspaceTrusted;
            }
            // Startup files
            if (this._canonicalStartupFiles.length) {
                return this.getUrisTrust(this._canonicalStartupFiles);
            }
            // User setting
            return !!this.configurationService.getValue(WORKSPACE_TRUST_EMPTY_WINDOW);
        }
        return this.getUrisTrust(this.getWorkspaceUris());
    }
    async updateWorkspaceTrust(trusted) {
        if (!this.workspaceTrustEnablementService.isWorkspaceTrustEnabled()) {
            return;
        }
        if (trusted === undefined) {
            await this.resolveCanonicalUris();
            trusted = this.calculateWorkspaceTrust();
        }
        if (this.isWorkspaceTrusted() === trusted) {
            return;
        }
        // Update workspace trust
        this.isTrusted = trusted;
        // Run workspace trust transition participants
        await this._trustTransitionManager.participate(trusted);
        // Fire workspace trust change event
        this._onDidChangeTrust.fire(trusted);
    }
    getUrisTrust(uris) {
        let state = true;
        for (const uri of uris) {
            const { trusted } = this.doGetUriTrustInfo(uri);
            if (!trusted) {
                state = trusted;
                return state;
            }
        }
        return state;
    }
    doGetUriTrustInfo(uri) {
        // Return trusted when workspace trust is disabled
        if (!this.workspaceTrustEnablementService.isWorkspaceTrustEnabled()) {
            return { trusted: true, uri };
        }
        if (this.isTrustedVirtualResource(uri)) {
            return { trusted: true, uri };
        }
        if (this.isTrustedByRemote(uri)) {
            return { trusted: true, uri };
        }
        let resultState = false;
        let maxLength = -1;
        let resultUri = uri;
        for (const trustInfo of this._trustStateInfo.uriTrustInfo) {
            if (this.uriIdentityService.extUri.isEqualOrParent(uri, trustInfo.uri)) {
                const fsPath = trustInfo.uri.fsPath;
                if (fsPath.length > maxLength) {
                    maxLength = fsPath.length;
                    resultState = trustInfo.trusted;
                    resultUri = trustInfo.uri;
                }
            }
        }
        return { trusted: resultState, uri: resultUri };
    }
    async doSetUrisTrust(uris, trusted) {
        let changed = false;
        for (const uri of uris) {
            if (trusted) {
                if (this.isTrustedVirtualResource(uri)) {
                    continue;
                }
                if (this.isTrustedByRemote(uri)) {
                    continue;
                }
                const foundItem = this._trustStateInfo.uriTrustInfo.find(trustInfo => this.uriIdentityService.extUri.isEqual(trustInfo.uri, uri));
                if (!foundItem) {
                    this._trustStateInfo.uriTrustInfo.push({ uri, trusted: true });
                    changed = true;
                }
            }
            else {
                const previousLength = this._trustStateInfo.uriTrustInfo.length;
                this._trustStateInfo.uriTrustInfo = this._trustStateInfo.uriTrustInfo.filter(trustInfo => !this.uriIdentityService.extUri.isEqual(trustInfo.uri, uri));
                if (previousLength !== this._trustStateInfo.uriTrustInfo.length) {
                    changed = true;
                }
            }
        }
        if (changed) {
            await this.saveTrustInfo();
        }
    }
    isEmptyWorkspace() {
        if (this.workspaceService.getWorkbenchState() === 1 /* WorkbenchState.EMPTY */) {
            return true;
        }
        const workspace = this.workspaceService.getWorkspace();
        if (workspace) {
            return isTemporaryWorkspace(this.workspaceService.getWorkspace()) && workspace.folders.length === 0;
        }
        return false;
    }
    isTrustedVirtualResource(uri) {
        return isVirtualResource(uri) && uri.scheme !== 'vscode-vfs';
    }
    isTrustedByRemote(uri) {
        if (!this.environmentService.remoteAuthority) {
            return false;
        }
        if (!this._remoteAuthority) {
            return false;
        }
        return (isEqualAuthority(getRemoteAuthority(uri), this._remoteAuthority.authority.authority)) && !!this._remoteAuthority.options?.isTrusted;
    }
    set isTrusted(value) {
        this._isTrusted = value;
        // Reset acceptsOutOfWorkspaceFiles
        if (!value) {
            this._storedTrustState.acceptsOutOfWorkspaceFiles = false;
        }
        // Empty workspace - save memento
        if (this.isEmptyWorkspace()) {
            this._storedTrustState.isEmptyWorkspaceTrusted = value;
        }
    }
    //#endregion
    //#region public interface
    get workspaceResolved() {
        return this._workspaceResolvedPromise;
    }
    get workspaceTrustInitialized() {
        return this._workspaceTrustInitializedPromise;
    }
    get acceptsOutOfWorkspaceFiles() {
        return this._storedTrustState.acceptsOutOfWorkspaceFiles;
    }
    set acceptsOutOfWorkspaceFiles(value) {
        this._storedTrustState.acceptsOutOfWorkspaceFiles = value;
    }
    isWorkspaceTrusted() {
        return this._isTrusted;
    }
    isWorkspaceTrustForced() {
        // Remote - remote authority explicitly sets workspace trust
        if (this.environmentService.remoteAuthority && this._remoteAuthority?.options?.isTrusted !== undefined) {
            return true;
        }
        // All workspace uris are trusted automatically
        const workspaceUris = this.getWorkspaceUris().filter(uri => !this.isTrustedVirtualResource(uri));
        if (workspaceUris.length === 0) {
            return true;
        }
        return false;
    }
    canSetParentFolderTrust() {
        const workspaceIdentifier = toWorkspaceIdentifier(this._canonicalWorkspace);
        if (!isSingleFolderWorkspaceIdentifier(workspaceIdentifier)) {
            return false;
        }
        if (workspaceIdentifier.uri.scheme !== Schemas.file && workspaceIdentifier.uri.scheme !== Schemas.vscodeRemote) {
            return false;
        }
        const parentFolder = this.uriIdentityService.extUri.dirname(workspaceIdentifier.uri);
        if (this.uriIdentityService.extUri.isEqual(workspaceIdentifier.uri, parentFolder)) {
            return false;
        }
        return true;
    }
    async setParentFolderTrust(trusted) {
        if (this.canSetParentFolderTrust()) {
            const workspaceUri = toWorkspaceIdentifier(this._canonicalWorkspace).uri;
            const parentFolder = this.uriIdentityService.extUri.dirname(workspaceUri);
            await this.setUrisTrust([parentFolder], trusted);
        }
    }
    canSetWorkspaceTrust() {
        // Remote - remote authority not yet resolved, or remote authority explicitly sets workspace trust
        if (this.environmentService.remoteAuthority && (!this._remoteAuthority || this._remoteAuthority.options?.isTrusted !== undefined)) {
            return false;
        }
        // Empty workspace
        if (this.isEmptyWorkspace()) {
            return true;
        }
        // All workspace uris are trusted automatically
        const workspaceUris = this.getWorkspaceUris().filter(uri => !this.isTrustedVirtualResource(uri));
        if (workspaceUris.length === 0) {
            return false;
        }
        // Untrusted workspace
        if (!this.isWorkspaceTrusted()) {
            return true;
        }
        // Trusted workspaces
        // Can only untrusted in the single folder scenario
        const workspaceIdentifier = toWorkspaceIdentifier(this._canonicalWorkspace);
        if (!isSingleFolderWorkspaceIdentifier(workspaceIdentifier)) {
            return false;
        }
        // Can only be untrusted in certain schemes
        if (workspaceIdentifier.uri.scheme !== Schemas.file && workspaceIdentifier.uri.scheme !== 'vscode-vfs') {
            return false;
        }
        // If the current folder isn't trusted directly, return false
        const trustInfo = this.doGetUriTrustInfo(workspaceIdentifier.uri);
        if (!trustInfo.trusted || !this.uriIdentityService.extUri.isEqual(workspaceIdentifier.uri, trustInfo.uri)) {
            return false;
        }
        // Check if the parent is also trusted
        if (this.canSetParentFolderTrust()) {
            const parentFolder = this.uriIdentityService.extUri.dirname(workspaceIdentifier.uri);
            const parentPathTrustInfo = this.doGetUriTrustInfo(parentFolder);
            if (parentPathTrustInfo.trusted) {
                return false;
            }
        }
        return true;
    }
    async setWorkspaceTrust(trusted) {
        // Empty workspace
        if (this.isEmptyWorkspace()) {
            await this.updateWorkspaceTrust(trusted);
            return;
        }
        const workspaceFolders = this.getWorkspaceUris();
        await this.setUrisTrust(workspaceFolders, trusted);
    }
    async getUriTrustInfo(uri) {
        // Return trusted when workspace trust is disabled
        if (!this.workspaceTrustEnablementService.isWorkspaceTrustEnabled()) {
            return { trusted: true, uri };
        }
        // Uri is trusted automatically by the remote
        if (this.isTrustedByRemote(uri)) {
            return { trusted: true, uri };
        }
        return this.doGetUriTrustInfo(await this.getCanonicalUri(uri));
    }
    async setUrisTrust(uris, trusted) {
        this.doSetUrisTrust(await Promise.all(uris.map(uri => this.getCanonicalUri(uri))), trusted);
    }
    getTrustedUris() {
        return this._trustStateInfo.uriTrustInfo.map(info => info.uri);
    }
    async setTrustedUris(uris) {
        this._trustStateInfo.uriTrustInfo = [];
        for (const uri of uris) {
            const canonicalUri = await this.getCanonicalUri(uri);
            const cleanUri = this.uriIdentityService.extUri.removeTrailingPathSeparator(canonicalUri);
            let added = false;
            for (const addedUri of this._trustStateInfo.uriTrustInfo) {
                if (this.uriIdentityService.extUri.isEqual(addedUri.uri, cleanUri)) {
                    added = true;
                    break;
                }
            }
            if (added) {
                continue;
            }
            this._trustStateInfo.uriTrustInfo.push({
                trusted: true,
                uri: cleanUri
            });
        }
        await this.saveTrustInfo();
    }
    addWorkspaceTrustTransitionParticipant(participant) {
        return this._trustTransitionManager.addWorkspaceTrustTransitionParticipant(participant);
    }
};
WorkspaceTrustManagementService = __decorate([
    __param(0, IConfigurationService),
    __param(1, IRemoteAuthorityResolverService),
    __param(2, IStorageService),
    __param(3, IUriIdentityService),
    __param(4, IWorkbenchEnvironmentService),
    __param(5, IWorkspaceContextService),
    __param(6, IWorkspaceTrustEnablementService),
    __param(7, IFileService)
], WorkspaceTrustManagementService);
export { WorkspaceTrustManagementService };
let WorkspaceTrustRequestService = class WorkspaceTrustRequestService extends Disposable {
    constructor(configurationService, workspaceTrustManagementService) {
        super();
        this.configurationService = configurationService;
        this.workspaceTrustManagementService = workspaceTrustManagementService;
        this._onDidInitiateOpenFilesTrustRequest = this._register(new Emitter());
        this.onDidInitiateOpenFilesTrustRequest = this._onDidInitiateOpenFilesTrustRequest.event;
        this._onDidInitiateWorkspaceTrustRequest = this._register(new Emitter());
        this.onDidInitiateWorkspaceTrustRequest = this._onDidInitiateWorkspaceTrustRequest.event;
        this._onDidInitiateWorkspaceTrustRequestOnStartup = this._register(new Emitter());
        this.onDidInitiateWorkspaceTrustRequestOnStartup = this._onDidInitiateWorkspaceTrustRequestOnStartup.event;
    }
    //#region Open file(s) trust request
    get untrustedFilesSetting() {
        return this.configurationService.getValue(WORKSPACE_TRUST_UNTRUSTED_FILES);
    }
    set untrustedFilesSetting(value) {
        this.configurationService.updateValue(WORKSPACE_TRUST_UNTRUSTED_FILES, value);
    }
    async completeOpenFilesTrustRequest(result, saveResponse) {
        if (!this._openFilesTrustRequestResolver) {
            return;
        }
        // Set acceptsOutOfWorkspaceFiles
        if (result === 1 /* WorkspaceTrustUriResponse.Open */) {
            this.workspaceTrustManagementService.acceptsOutOfWorkspaceFiles = true;
        }
        // Save response
        if (saveResponse) {
            if (result === 1 /* WorkspaceTrustUriResponse.Open */) {
                this.untrustedFilesSetting = 'open';
            }
            if (result === 2 /* WorkspaceTrustUriResponse.OpenInNewWindow */) {
                this.untrustedFilesSetting = 'newWindow';
            }
        }
        // Resolve promise
        this._openFilesTrustRequestResolver(result);
        this._openFilesTrustRequestResolver = undefined;
        this._openFilesTrustRequestPromise = undefined;
    }
    async requestOpenFilesTrust(uris) {
        // If workspace is untrusted, there is no conflict
        if (!this.workspaceTrustManagementService.isWorkspaceTrusted()) {
            return 1 /* WorkspaceTrustUriResponse.Open */;
        }
        const openFilesTrustInfo = await Promise.all(uris.map(uri => this.workspaceTrustManagementService.getUriTrustInfo(uri)));
        // If all uris are trusted, there is no conflict
        if (openFilesTrustInfo.map(info => info.trusted).every(trusted => trusted)) {
            return 1 /* WorkspaceTrustUriResponse.Open */;
        }
        // If user has setting, don't need to ask
        if (this.untrustedFilesSetting !== 'prompt') {
            if (this.untrustedFilesSetting === 'newWindow') {
                return 2 /* WorkspaceTrustUriResponse.OpenInNewWindow */;
            }
            if (this.untrustedFilesSetting === 'open') {
                return 1 /* WorkspaceTrustUriResponse.Open */;
            }
        }
        // If we already asked the user, don't need to ask again
        if (this.workspaceTrustManagementService.acceptsOutOfWorkspaceFiles) {
            return 1 /* WorkspaceTrustUriResponse.Open */;
        }
        // Create/return a promise
        if (!this._openFilesTrustRequestPromise) {
            this._openFilesTrustRequestPromise = new Promise(resolve => {
                this._openFilesTrustRequestResolver = resolve;
            });
        }
        else {
            return this._openFilesTrustRequestPromise;
        }
        this._onDidInitiateOpenFilesTrustRequest.fire();
        return this._openFilesTrustRequestPromise;
    }
    //#endregion
    //#region Workspace trust request
    resolveWorkspaceTrustRequest(trusted) {
        if (this._workspaceTrustRequestResolver) {
            this._workspaceTrustRequestResolver(trusted ?? this.workspaceTrustManagementService.isWorkspaceTrusted());
            this._workspaceTrustRequestResolver = undefined;
            this._workspaceTrustRequestPromise = undefined;
        }
    }
    cancelWorkspaceTrustRequest() {
        if (this._workspaceTrustRequestResolver) {
            this._workspaceTrustRequestResolver(undefined);
            this._workspaceTrustRequestResolver = undefined;
            this._workspaceTrustRequestPromise = undefined;
        }
    }
    async completeWorkspaceTrustRequest(trusted) {
        if (trusted === undefined || trusted === this.workspaceTrustManagementService.isWorkspaceTrusted()) {
            this.resolveWorkspaceTrustRequest(trusted);
            return;
        }
        // Register one-time event handler to resolve the promise when workspace trust changed
        Event.once(this.workspaceTrustManagementService.onDidChangeTrust)(trusted => this.resolveWorkspaceTrustRequest(trusted));
        // Update storage, transition workspace state
        await this.workspaceTrustManagementService.setWorkspaceTrust(trusted);
    }
    async requestWorkspaceTrust(options) {
        // Trusted workspace
        if (this.workspaceTrustManagementService.isWorkspaceTrusted()) {
            return this.workspaceTrustManagementService.isWorkspaceTrusted();
        }
        // Modal request
        if (!this._workspaceTrustRequestPromise) {
            // Create promise
            this._workspaceTrustRequestPromise = new Promise(resolve => {
                this._workspaceTrustRequestResolver = resolve;
            });
        }
        else {
            // Return existing promise
            return this._workspaceTrustRequestPromise;
        }
        this._onDidInitiateWorkspaceTrustRequest.fire(options);
        return this._workspaceTrustRequestPromise;
    }
    requestWorkspaceTrustOnStartup() {
        if (!this._workspaceTrustRequestPromise) {
            // Create promise
            this._workspaceTrustRequestPromise = new Promise(resolve => {
                this._workspaceTrustRequestResolver = resolve;
            });
        }
        this._onDidInitiateWorkspaceTrustRequestOnStartup.fire();
    }
};
WorkspaceTrustRequestService = __decorate([
    __param(0, IConfigurationService),
    __param(1, IWorkspaceTrustManagementService)
], WorkspaceTrustRequestService);
export { WorkspaceTrustRequestService };
class WorkspaceTrustTransitionManager extends Disposable {
    constructor() {
        super(...arguments);
        this.participants = new LinkedList();
    }
    addWorkspaceTrustTransitionParticipant(participant) {
        const remove = this.participants.push(participant);
        return toDisposable(() => remove());
    }
    async participate(trusted) {
        for (const participant of this.participants) {
            await participant.participate(trusted);
        }
    }
    dispose() {
        this.participants.clear();
        super.dispose();
    }
}
class WorkspaceTrustMemento {
    constructor(storageService) {
        this._acceptsOutOfWorkspaceFilesKey = 'acceptsOutOfWorkspaceFiles';
        this._isEmptyWorkspaceTrustedKey = 'isEmptyWorkspaceTrusted';
        if (storageService) {
            this._memento = new Memento('workspaceTrust', storageService);
            this._mementoObject = this._memento.getMemento(1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        }
        else {
            this._mementoObject = {};
        }
    }
    get acceptsOutOfWorkspaceFiles() {
        return this._mementoObject[this._acceptsOutOfWorkspaceFilesKey] ?? false;
    }
    set acceptsOutOfWorkspaceFiles(value) {
        this._mementoObject[this._acceptsOutOfWorkspaceFilesKey] = value;
        this._memento?.saveMemento();
    }
    get isEmptyWorkspaceTrusted() {
        return this._mementoObject[this._isEmptyWorkspaceTrustedKey];
    }
    set isEmptyWorkspaceTrusted(value) {
        this._mementoObject[this._isEmptyWorkspaceTrustedKey] = value;
        this._memento?.saveMemento();
    }
}
registerSingleton(IWorkspaceTrustRequestService, WorkspaceTrustRequestService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya3NwYWNlVHJ1c3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL3dvcmtzcGFjZXMvY29tbW9uL3dvcmtzcGFjZVRydXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFVBQVUsRUFBZSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM3RixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDbkUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVyRCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLCtCQUErQixFQUFrQixNQUFNLCtEQUErRCxDQUFDO0FBQ2hJLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sZ0RBQWdELENBQUM7QUFDOUcsT0FBTyxFQUFvQyxnQkFBZ0IsRUFBRSxpQ0FBaUMsRUFBRSxvQkFBb0IsRUFBYyx3QkFBd0IsRUFBb0IscUJBQXFCLEVBQWtCLE1BQU0sb0RBQW9ELENBQUM7QUFDaFIsT0FBTyxFQUFnQyxnQ0FBZ0MsRUFBK0MsNkJBQTZCLEVBQW1FLGdDQUFnQyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDeFQsT0FBTyxFQUFFLE9BQU8s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