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
import { timeout } from '../../../base/common/async.js';
import { bufferToStream, readableToBuffer, VSBuffer } from '../../../base/common/buffer.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Iterable } from '../../../base/common/iterator.js';
import { Disposable, toDisposable } from '../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../base/common/map.js';
import { Schemas } from '../../../base/common/network.js';
import { observableValue } from '../../../base/common/observable.js';
import { join } from '../../../base/common/path.js';
import { isLinux, isMacintosh } from '../../../base/common/platform.js';
import { basename, isEqual, isEqualOrParent } from '../../../base/common/resources.js';
import { URI } from '../../../base/common/uri.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { AbstractLoggerService, LogLevel, NullLogger } from '../../../platform/log/common/log.js';
import product from '../../../platform/product/common/product.js';
import { InMemoryStorageService } from '../../../platform/storage/common/storage.js';
import { toUserDataProfile } from '../../../platform/userDataProfile/common/userDataProfile.js';
import { TestWorkspace } from '../../../platform/workspace/test/common/testWorkspace.js';
import { ChatEntitlement } from '../../services/chat/common/chatEntitlementService.js';
import { NullExtensionService } from '../../services/extensions/common/extensions.js';
export class TestLoggerService extends AbstractLoggerService {
    constructor(logsHome) {
        super(LogLevel.Info, logsHome ?? URI.file('tests').with({ scheme: 'vscode-tests' }));
    }
    doCreateLogger() { return new NullLogger(); }
}
let TestTextResourcePropertiesService = class TestTextResourcePropertiesService {
    constructor(configurationService) {
        this.configurationService = configurationService;
    }
    getEOL(resource, language) {
        const eol = this.configurationService.getValue('files.eol', { overrideIdentifier: language, resource });
        if (eol && typeof eol === 'string' && eol !== 'auto') {
            return eol;
        }
        return (isLinux || isMacintosh) ? '\n' : '\r\n';
    }
};
TestTextResourcePropertiesService = __decorate([
    __param(0, IConfigurationService)
], TestTextResourcePropertiesService);
export { TestTextResourcePropertiesService };
export class TestUserDataProfileService {
    constructor() {
        this.onDidChangeCurrentProfile = Event.None;
        this.currentProfile = toUserDataProfile('test', 'test', URI.file('tests').with({ scheme: 'vscode-tests' }), URI.file('tests').with({ scheme: 'vscode-tests' }));
    }
    async updateCurrentProfile() { }
}
export class TestContextService {
    get onDidChangeWorkspaceName() { return this._onDidChangeWorkspaceName.event; }
    get onWillChangeWorkspaceFolders() { return this._onWillChangeWorkspaceFolders.event; }
    get onDidChangeWorkspaceFolders() { return this._onDidChangeWorkspaceFolders.event; }
    get onDidChangeWorkbenchState() { return this._onDidChangeWorkbenchState.event; }
    constructor(workspace = TestWorkspace, options = null) {
        this.workspace = workspace;
        this.options = options || Object.create(null);
        this._onDidChangeWorkspaceName = new Emitter();
        this._onWillChangeWorkspaceFolders = new Emitter();
        this._onDidChangeWorkspaceFolders = new Emitter();
        this._onDidChangeWorkbenchState = new Emitter();
    }
    getFolders() {
        return this.workspace ? this.workspace.folders : [];
    }
    getWorkbenchState() {
        if (this.workspace.configuration) {
            return 3 /* WorkbenchState.WORKSPACE */;
        }
        if (this.workspace.folders.length) {
            return 2 /* WorkbenchState.FOLDER */;
        }
        return 1 /* WorkbenchState.EMPTY */;
    }
    getCompleteWorkspace() {
        return Promise.resolve(this.getWorkspace());
    }
    getWorkspace() {
        return this.workspace;
    }
    getWorkspaceFolder(resource) {
        return this.workspace.getFolder(resource);
    }
    setWorkspace(workspace) {
        this.workspace = workspace;
    }
    getOptions() {
        return this.options;
    }
    updateOptions() { }
    isInsideWorkspace(resource) {
        if (resource && this.workspace) {
            return isEqualOrParent(resource, this.workspace.folders[0].uri);
        }
        return false;
    }
    toResource(workspaceRelativePath) {
        return URI.file(join('C:\\', workspaceRelativePath));
    }
    isCurrentWorkspace(workspaceIdOrFolder) {
        return URI.isUri(workspaceIdOrFolder) && isEqual(this.workspace.folders[0].uri, workspaceIdOrFolder);
    }
}
export class TestStorageService extends InMemoryStorageService {
    testEmitWillSaveState(reason) {
        super.emitWillSaveState(reason);
    }
}
export class TestHistoryService {
    constructor(root) {
        this.root = root;
    }
    async reopenLastClosedEditor() { }
    async goForward() { }
    async goBack() { }
    async goPrevious() { }
    async goLast() { }
    removeFromHistory(_input) { }
    clear() { }
    clearRecentlyOpened() { }
    getHistory() { return []; }
    async openNextRecentlyUsedEditor(group) { }
    async openPreviouslyUsedEditor(group) { }
    getLastActiveWorkspaceRoot(_schemeFilter) { return this.root; }
    getLastActiveFile(_schemeFilter) { return undefined; }
}
export class TestWorkingCopy extends Disposable {
    constructor(resource, isDirty = false, typeId = 'testWorkingCopyType') {
        super();
        this.resource = resource;
        this.typeId = typeId;
        this._onDidChangeDirty = this._register(new Emitter());
        this.onDidChangeDirty = this._onDidChangeDirty.event;
        this._onDidChangeContent = this._register(new Emitter());
        this.onDidChangeContent = this._onDidChangeContent.event;
        this._onDidSave = this._register(new Emitter());
        this.onDidSave = this._onDidSave.event;
        this.capabilities = 0 /* WorkingCopyCapabilities.None */;
        this.dirty = false;
        this.name = basename(this.resource);
        this.dirty = isDirty;
    }
    setDirty(dirty) {
        if (this.dirty !== dirty) {
            this.dirty = dirty;
            this._onDidChangeDirty.fire();
        }
    }
    setContent(content) {
        this._onDidChangeContent.fire();
    }
    isDirty() {
        return this.dirty;
    }
    isModified() {
        return this.isDirty();
    }
    async save(options, stat) {
        this._onDidSave.fire({ reason: options?.reason ?? 1 /* SaveReason.EXPLICIT */, stat: stat ?? createFileStat(this.resource), source: options?.source });
        return true;
    }
    async revert(options) {
        this.setDirty(false);
    }
    async backup(token) {
        return {};
    }
}
export function createFileStat(resource, readonly = false, isFile, isDirectory, isSymbolicLink, children) {
    return {
        resource,
        etag: Date.now().toString(),
        mtime: Date.now(),
        ctime: Date.now(),
        size: 42,
        isFile: isFile ?? true,
        isDirectory: isDirectory ?? false,
        isSymbolicLink: isSymbolicLink ?? false,
        readonly,
        locked: false,
        name: basename(resource),
        children: children?.map(c => createFileStat(c.resource, false, c.isFile, c.isDirectory, c.isSymbolicLink)),
    };
}
export class TestWorkingCopyFileService {
    constructor() {
        this.onWillRunWorkingCopyFileOperation = Event.None;
        this.onDidFailWorkingCopyFileOperation = Event.None;
        this.onDidRunWorkingCopyFileOperation = Event.None;
        this.hasSaveParticipants = false;
    }
    addFileOperationParticipant(participant) { return Disposable.None; }
    addSaveParticipant(participant) { return Disposable.None; }
    async runSaveParticipants(workingCopy, context, progress, token) { }
    async delete(operations, token, undoInfo) { }
    registerWorkingCopyProvider(provider) { return Disposable.None; }
    getDirty(resource) { return []; }
    create(operations, token, undoInfo) { throw new Error('Method not implemented.'); }
    createFolder(operations, token, undoInfo) { throw new Error('Method not implemented.'); }
    move(operations, token, undoInfo) { throw new Error('Method not implemented.'); }
    copy(operations, token, undoInfo) { throw new Error('Method not implemented.'); }
}
export function mock() {
    // eslint-disable-next-line local/code-no-any-casts
    return function () { };
}
export class TestExtensionService extends NullExtensionService {
}
export const TestProductService = { _serviceBrand: undefined, ...product };
export class TestActivityService {
    constructor() {
        this.onDidChangeActivity = Event.None;
    }
    getViewContainerActivities(viewContainerId) {
        return [];
    }
    getActivity(id) {
        return [];
    }
    showViewContainerActivity(viewContainerId, badge) {
        return this;
    }
    showViewActivity(viewId, badge) {
        return this;
    }
    showAccountsActivity(activity) {
        return this;
    }
    showGlobalActivity(activity) {
        return this;
    }
    dispose() { }
}
export const NullFilesConfigurationService = new class {
    constructor() {
        this.onDidChangeAutoSaveConfiguration = Event.None;
        this.onDidChangeAutoSaveDisabled = Event.None;
        this.onDidChangeReadonly = Event.None;
        this.onDidChangeFilesAssociation = Event.None;
        this.isHotExitEnabled = false;
        this.hotExitConfiguration = undefined;
    }
    getAutoSaveConfiguration() { throw new Error('Method not implemented.'); }
    getAutoSaveMode() { throw new Error('Method not implemented.'); }
    hasShortAutoSaveDelay() { throw new Error('Method not implemented.'); }
    toggleAutoSave() { throw new Error('Method not implemented.'); }
    enableAutoSaveAfterShortDelay(resourceOrEditor) { throw new Error('Method not implemented.'); }
    disableAutoSave(resourceOrEditor) { throw new Error('Method not implemented.'); }
    isReadonly(resource, stat) { return false; }
    async updateReadonly(resource, readonly) { }
    preventSaveConflicts(resource, language) { throw new Error('Method not implemented.'); }
};
export class TestWorkspaceTrustEnablementService {
    constructor(isEnabled = true) {
        this.isEnabled = isEnabled;
    }
    isWorkspaceTrustEnabled() {
        return this.isEnabled;
    }
}
export class TestWorkspaceTrustManagementService extends Disposable {
    constructor(trusted = true) {
        super();
        this.trusted = trusted;
        this._onDidChangeTrust = this._register(new Emitter());
        this.onDidChangeTrust = this._onDidChangeTrust.event;
        this._onDidChangeTrustedFolders = this._register(new Emitter());
        this.onDidChangeTrustedFolders = this._onDidChangeTrustedFolders.event;
        this._onDidInitiateWorkspaceTrustRequestOnStartup = this._register(new Emitter());
        this.onDidInitiateWorkspaceTrustRequestOnStartup = this._onDidInitiateWorkspaceTrustRequestOnStartup.event;
    }
    get acceptsOutOfWorkspaceFiles() {
        throw new Error('Method not implemented.');
    }
    set acceptsOutOfWorkspaceFiles(value) {
        throw new Error('Method not implemented.');
    }
    addWorkspaceTrustTransitionParticipant(participant) {
        throw new Error('Method not implemented.');
    }
    getTrustedUris() {
        throw new Error('Method not implemented.');
    }
    setParentFolderTrust(trusted) {
        throw new Error('Method not implemented.');
    }
    getUriTrustInfo(uri) {
        throw new Error('Method not implemented.');
    }
    async setTrustedUris(folders) {
        throw new Error('Method not implemented.');
    }
    async setUrisTrust(uris, trusted) {
        throw new Error('Method not implemented.');
    }
    canSetParentFolderTrust() {
        throw new Error('Method not implemented.');
    }
    canSetWorkspaceTrust() {
        throw new Error('Method not implemented.');
    }
    isWorkspaceTrusted() {
        return this.trusted;
    }
    isWorkspaceTrustForced() {
        return false;
    }
    get workspaceTrustInitialized() {
        return Promise.resolve();
    }
    get workspaceResolved() {
        return Promise.resolve();
    }
    async setWorkspaceTrust(trusted) {
        if (this.trusted !== trusted) {
            this.trusted = trusted;
            this._onDidChangeTrust.fire(this.trusted);
        }
    }
}
export class TestWorkspaceTrustRequestService extends Disposable {
    constructor(_trusted) {
        super();
        this._trusted = _trusted;
        this._onDidInitiateOpenFilesTrustRequest = this._register(new Emitter());
        this.onDidInitiateOpenFilesTrustRequest = this._onDidInitiateOpenFilesTrustRequest.event;
        this._onDidInitiateWorkspaceTrustRequest = this._register(new Emitter());
        this.onDidInitiateWorkspaceTrustRequest = this._onDidInitiateWorkspaceTrustRequest.event;
        this._onDidInitiateWorkspaceTrustRequestOnStartup = this._register(new Emitter());
        this.onDidInitiateWorkspaceTrustRequestOnStartup = this._onDidInitiateWorkspaceTrustRequestOnStartup.event;
        this.requestOpenUrisHandler = async (uris) => {
            return 1 /* WorkspaceTrustUriResponse.Open */;
        };
    }
    requestOpenFilesTrust(uris) {
        return this.requestOpenUrisHandler(uris);
    }
    async completeOpenFilesTrustRequest(result, saveResponse) {
        throw new Error('Method not implemented.');
    }
    cancelWorkspaceTrustRequest() {
        throw new Error('Method not implemented.');
    }
    async completeWorkspaceTrustRequest(trusted) {
        throw new Error('Method not implemented.');
    }
    async requestWorkspaceTrust(options) {
        return this._trusted;
    }
    requestWorkspaceTrustOnStartup() {
        throw new Error('Method not implemented.');
    }
}
export class TestMarkerService {
    constructor() {
        this.onMarkerChanged = Event.None;
    }
    getStatistics() { throw new Error('Method not implemented.'); }
    changeOne(owner, resource, markers) { }
    changeAll(owner, data) { }
    remove(owner, resources) { }
    read(filter) { return []; }
    installResourceFilter(resource, reason) {
        return { dispose: () => { } };
    }
}
export class TestFileService {
    constructor() {
        this._onDidFilesChange = new Emitter();
        this._onDidRunOperation = new Emitter();
        this._onDidChangeFileSystemProviderCapabilities = new Emitter();
        this._onWillActivateFileSystemProvider = new Emitter();
        this.onWillActivateFileSystemProvider = this._onWillActivateFileSystemProvider.event;
        this.onDidWatchError = Event.None;
        this.content = 'Hello Html';
        this.readonly = false;
        // Tracking functionality for tests
        this.writeOperations = [];
        this.readOperations = [];
        this.notExistsSet = new ResourceMap();
        this.readShouldThrowError = undefined;
        this.writeShouldThrowError = undefined;
        this.onDidChangeFileSystemProviderRegistrations = Event.None;
        this.providers = new Map();
        this.watches = [];
    }
    get onDidFilesChange() { return this._onDidFilesChange.event; }
    fireFileChanges(event) { this._onDidFilesChange.fire(event); }
    get onDidRunOperation() { return this._onDidRunOperation.event; }
    fireAfterOperation(event) { this._onDidRunOperation.fire(event); }
    get onDidChangeFileSystemProviderCapabilities() { return this._onDidChangeFileSystemProviderCapabilities.event; }
    fireFileSystemProviderCapabilitiesChangeEvent(event) { this._onDidChangeFileSystemProviderCapabilities.fire(event); }
    setContent(content) { this.content = content; }
    getContent() { return this.content; }
    getLastReadFileUri() { return this.lastReadFileUri; }
    // Clear tracking data for tests
    clearTracking() {
        this.writeOperations.length = 0;
        this.readOperations.length = 0;
    }
    async resolve(resource, _options) {
        return createFileStat(resource, this.readonly);
    }
    stat(resource) {
        return this.resolve(resource, { resolveMetadata: true });
    }
    async realpath(resource) {
        return resource;
    }
    async resolveAll(toResolve) {
        const stats = await Promise.all(toResolve.map(resourceAndOption => this.resolve(resourceAndOption.resource, resourceAndOption.options)));
        return stats.map(stat => ({ stat, success: true }));
    }
    async exists(_resource) { return !this.notExistsSet.has(_resource); }
    async readFile(resource, options) {
        if (this.readShouldThrowError) {
            throw this.readShouldThrowError;
        }
        this.lastReadFileUri = resource;
        this.readOperations.push({ resource });
        return {
            ...createFileStat(resource, this.readonly),
            value: VSBuffer.fromString(this.content)
        };
    }
    async readFileStream(resource, options) {
        if (this.readShouldThrowError) {
            throw this.readShouldThrowError;
        }
        this.lastReadFileUri = resource;
        return {
            ...createFileStat(resource, this.readonly),
            value: bufferToStream(VSBuffer.fromString(this.content))
        };
    }
    async writeFile(resource, bufferOrReadable, options) {
        await timeout(0);
        if (this.writeShouldThrowError) {
            throw this.writeShouldThrowError;
        }
        let content;
        if (bufferOrReadable instanceof VSBuffer) {
            content = bufferOrReadable;
        }
        else {
            try {
                content = readableToBuffer(bufferOrReadable);
            }
            catch {
                // Some preexisting tests are writing with invalid objects
            }
        }
        if (content) {
            this.writeOperations.push({ resource, content: content.toString() });
        }
        return createFileStat(resource, this.readonly);
    }
    move(_source, _target, _overwrite) { return Promise.resolve(null); }
    copy(_source, _target, _overwrite) { return Promise.resolve(null); }
    async cloneFile(_source, _target) { }
    createFile(_resource, _content, _options) { return Promise.resolve(null); }
    createFolder(_resource) { return Promise.resolve(null); }
    registerProvider(scheme, provider) {
        this.providers.set(scheme, provider);
        return toDisposable(() => this.providers.delete(scheme));
    }
    getProvider(scheme) {
        return this.providers.get(scheme);
    }
    async activateProvider(_scheme) {
        this._onWillActivateFileSystemProvider.fire({ scheme: _scheme, join: () => { } });
    }
    async canHandleResource(resource) { return this.hasProvider(resource); }
    hasProvider(resource) { return resource.scheme === Schemas.file || this.providers.has(resource.scheme); }
    listCapabilities() {
        return [
            { scheme: Schemas.file, capabilities: 4 /* FileSystemProviderCapabilities.FileOpenReadWriteClose */ },
            ...Iterable.map(this.providers, ([scheme, p]) => { return { scheme, capabilities: p.capabilities }; })
        ];
    }
    hasCapability(resource, capability) {
        if (capability === 1024 /* FileSystemProviderCapabilities.PathCaseSensitive */ && isLinux) {
            return true;
        }
        const provider = this.getProvider(resource.scheme);
        return !!(provider && (provider.capabilities & capability));
    }
    async del(_resource, _options) { }
    createWatcher(resource, options) {
        return {
            onDidChange: Event.None,
            dispose: () => { }
        };
    }
    watch(_resource) {
        this.watches.push(_resource);
        return toDisposable(() => this.watches.splice(this.watches.indexOf(_resource), 1));
    }
    getWriteEncoding(_resource) { return { encoding: 'utf8', hasBOM: false }; }
    dispose() { }
    async canCreateFile(source, options) { return true; }
    async canMove(source, target, overwrite) { return true; }
    async canCopy(source, target, overwrite) { return true; }
    async canDelete(resource, options) { return true; }
}
/**
 * TestFileService with in-memory file storage.
 * Use this when your test needs to write files and read them back.
 */
export class InMemoryTestFileService extends TestFileService {
    constructor() {
        super(...arguments);
        this.files = new Map();
    }
    clearTracking() {
        super.clearTracking();
        this.files.clear();
    }
    async readFile(resource, options) {
        if (this.readShouldThrowError) {
            throw this.readShouldThrowError;
        }
        this.lastReadFileUri = resource;
        this.readOperations.push({ resource });
        // Check if we have content in our in-memory store
        const content = this.files.get(resource.toString());
        if (content) {
            return {
                ...createFileStat(resource, this.readonly),
                value: content
            };
        }
        return {
            ...createFileStat(resource, this.readonly),
            value: VSBuffer.fromString(this.content)
        };
    }
    async writeFile(resource, bufferOrReadable, options) {
        await timeout(0);
        if (this.writeShouldThrowError) {
            throw this.writeShouldThrowError;
        }
        let content;
        if (bufferOrReadable instanceof VSBuffer) {
            content = bufferOrReadable;
        }
        else {
            content = readableToBuffer(bufferOrReadable);
        }
        // Store in memory and track
        this.files.set(resource.toString(), content);
        this.writeOperations.push({ resource, content: content.toString() });
        return createFileStat(resource, this.readonly);
    }
}
export class TestChatEntitlementService {
    constructor() {
        this.isInternal = false;
        this.sku = undefined;
        this.onDidChangeQuotaExceeded = Event.None;
        this.onDidChangeQuotaRemaining = Event.None;
        this.quotas = {};
        this.onDidChangeSentiment = Event.None;
        this.sentimentObs = observableValue({}, {});
        this.sentiment = {};
        this.onDidChangeEntitlement = Event.None;
        this.entitlement = ChatEntitlement.Unknown;
        this.entitlementObs = observableValue({}, ChatEntitlement.Unknown);
        this.anonymous = false;
        this.onDidChangeAnonymous = Event.None;
        this.anonymousObs = observableValue({}, false);
    }
    update(token) {
        throw new Error('Method not implemented.');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC90ZXN0L2NvbW1vbi93b3JrYmVuY2hUZXN0U2VydmljZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxjQUFjLEVBQUUsZ0JBQWdCLEVBQUUsUUFBUSxFQUFvQixNQUFNLGdDQUFnQyxDQUFDO0FBRTlHLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxVQUFVLEVBQWUsWUFBWSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDMUYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQzFELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMxRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDckUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3BELE9BQU8sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdkYsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBRWxELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBR2hHLE9BQU8sRUFBRSxxQkFBcUIsRUFBVyxRQUFRLEVBQUUsVUFBVSxFQUFFLE1BQU0scUNBQXFDLENB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