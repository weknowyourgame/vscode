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
import { insert } from '../../../base/common/arrays.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { Event } from '../../../base/common/event.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { Schemas } from '../../../base/common/network.js';
import { IModelService } from '../../../editor/common/services/model.js';
import { IFileDialogService } from '../../../platform/dialogs/common/dialogs.js';
import { INativeEnvironmentService } from '../../../platform/environment/common/environment.js';
import { IExtensionManagementService } from '../../../platform/extensionManagement/common/extensionManagement.js';
import { AbstractNativeExtensionTipsService } from '../../../platform/extensionManagement/common/extensionTipsService.js';
import { IExtensionRecommendationNotificationService } from '../../../platform/extensionRecommendations/common/extensionRecommendations.js';
import { IFileService, FileType } from '../../../platform/files/common/files.js';
import { FileService } from '../../../platform/files/common/fileService.js';
import { InMemoryFileSystemProvider } from '../../../platform/files/common/inMemoryFilesystemProvider.js';
import { NullLogService } from '../../../platform/log/common/log.js';
import { INativeHostService } from '../../../platform/native/common/native.js';
import { IProductService } from '../../../platform/product/common/productService.js';
import { IStorageService } from '../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../platform/telemetry/common/telemetry.js';
import { UriIdentityService } from '../../../platform/uriIdentity/common/uriIdentityService.js';
import { FileUserDataProvider } from '../../../platform/userData/common/fileUserDataProvider.js';
import { UserDataProfilesService } from '../../../platform/userDataProfile/common/userDataProfile.js';
import { IWorkspaceContextService } from '../../../platform/workspace/common/workspace.js';
import { IEditorService } from '../../services/editor/common/editorService.js';
import { IFilesConfigurationService } from '../../services/filesConfiguration/common/filesConfigurationService.js';
import { ILifecycleService } from '../../services/lifecycle/common/lifecycle.js';
import { ITextFileService } from '../../services/textfile/common/textfiles.js';
import { NativeTextFileService } from '../../services/textfile/electron-browser/nativeTextFileService.js';
import { IWorkingCopyBackupService } from '../../services/workingCopy/common/workingCopyBackup.js';
import { IWorkingCopyService } from '../../services/workingCopy/common/workingCopyService.js';
import { NativeWorkingCopyBackupService } from '../../services/workingCopy/electron-browser/workingCopyBackupService.js';
import { workbenchInstantiationService as browserWorkbenchInstantiationService, TestEncodingOracle, TestEnvironmentService, TestLifecycleService } from '../browser/workbenchTestServices.js';
export class TestSharedProcessService {
    createRawConnection() { throw new Error('Not Implemented'); }
    getChannel(channelName) { return undefined; }
    registerChannel(channelName, channel) { }
    notifyRestored() { }
}
export class TestNativeHostService {
    constructor() {
        this.windowId = -1;
        this.onDidOpenMainWindow = Event.None;
        this.onDidMaximizeWindow = Event.None;
        this.onDidUnmaximizeWindow = Event.None;
        this.onDidFocusMainWindow = Event.None;
        this.onDidBlurMainWindow = Event.None;
        this.onDidFocusMainOrAuxiliaryWindow = Event.None;
        this.onDidBlurMainOrAuxiliaryWindow = Event.None;
        this.onDidResumeOS = Event.None;
        this.onDidChangeColorScheme = Event.None;
        this.onDidChangePassword = Event.None;
        this.onDidTriggerWindowSystemContextMenu = Event.None;
        this.onDidChangeWindowFullScreen = Event.None;
        this.onDidChangeWindowAlwaysOnTop = Event.None;
        this.onDidChangeDisplay = Event.None;
        this.windowCount = Promise.resolve(1);
    }
    getWindowCount() { return this.windowCount; }
    async getWindows() { return []; }
    async getActiveWindowId() { return undefined; }
    async getActiveWindowPosition() { return undefined; }
    async getNativeWindowHandle(windowId) { return undefined; }
    openWindow(arg1, arg2) {
        throw new Error('Method not implemented.');
    }
    async toggleFullScreen() { }
    async isMaximized() { return true; }
    async isFullScreen() { return true; }
    async maximizeWindow() { }
    async unmaximizeWindow() { }
    async minimizeWindow() { }
    async moveWindowTop(options) { }
    async isWindowAlwaysOnTop(options) { return false; }
    async toggleWindowAlwaysOnTop(options) { }
    async setWindowAlwaysOnTop(alwaysOnTop, options) { }
    async getCursorScreenPoint() { throw new Error('Method not implemented.'); }
    async positionWindow(position, options) { }
    async updateWindowControls(options) { }
    async updateWindowAccentColor(color) { }
    async setMinimumSize(width, height) { }
    async saveWindowSplash(value) { }
    async setBackgroundThrottling(throttling) { }
    async focusWindow(options) { }
    async showMessageBox(options) { throw new Error('Method not implemented.'); }
    async showSaveDialog(options) { throw new Error('Method not implemented.'); }
    async showOpenDialog(options) { throw new Error('Method not implemented.'); }
    async pickFileFolderAndOpen(options) { }
    async pickFileAndOpen(options) { }
    async pickFolderAndOpen(options) { }
    async pickWorkspaceAndOpen(options) { }
    async showItemInFolder(path) { }
    async setRepresentedFilename(path) { }
    async isAdmin() { return false; }
    async writeElevated(source, target) { }
    async isRunningUnderARM64Translation() { return false; }
    async getOSProperties() { return Object.create(null); }
    async getOSStatistics() { return Object.create(null); }
    async getOSVirtualMachineHint() { return 0; }
    async getOSColorScheme() { return { dark: true, highContrast: false }; }
    async hasWSLFeatureInstalled() { return false; }
    async getProcessId() { throw new Error('Method not implemented.'); }
    async killProcess() { }
    async setDocumentEdited(edited) { }
    async openExternal(url, defaultApplication) { return false; }
    async updateTouchBar() { }
    async moveItemToTrash() { }
    async newWindowTab() { }
    async showPreviousWindowTab() { }
    async showNextWindowTab() { }
    async moveWindowTabToNewWindow() { }
    async mergeAllWindowTabs() { }
    async toggleWindowTabsBar() { }
    async installShellCommand() { }
    async uninstallShellCommand() { }
    async notifyReady() { }
    async relaunch(options) { }
    async reload() { }
    async closeWindow() { }
    async quit() { }
    async exit(code) { }
    async openDevTools(options) { }
    async toggleDevTools() { }
    async stopTracing() { }
    async openDevToolsWindow(url) { }
    async openGPUInfoWindow() { }
    async resolveProxy(url) { return undefined; }
    async lookupAuthorization(authInfo) { return undefined; }
    async lookupKerberosAuthorization(url) { return undefined; }
    async loadCertificates() { return []; }
    async isPortFree() { return Promise.resolve(true); }
    async findFreePort(startPort, giveUpAfter, timeout, stride) { return -1; }
    async readClipboardText(type) { return ''; }
    async writeClipboardText(text, type) { }
    async readClipboardFindText() { return ''; }
    async writeClipboardFindText(text) { }
    async writeClipboardBuffer(format, buffer, type) { }
    async triggerPaste(options) { }
    async readImage() { return Uint8Array.from([]); }
    async readClipboardBuffer(format) { return VSBuffer.wrap(Uint8Array.from([])); }
    async hasClipboard(format, type) { return false; }
    async windowsGetStringRegKey(hive, path, name) { return undefined; }
    async profileRenderer() { throw new Error(); }
    async getScreenshot(rect) { return undefined; }
}
let TestExtensionTipsService = class TestExtensionTipsService extends AbstractNativeExtensionTipsService {
    constructor(environmentService, telemetryService, extensionManagementService, storageService, nativeHostService, extensionRecommendationNotificationService, fileService, productService) {
        super(environmentService.userHome, nativeHostService, telemetryService, extensionManagementService, storageService, extensionRecommendationNotificationService, fileService, productService);
    }
};
TestExtensionTipsService = __decorate([
    __param(0, INativeEnvironmentService),
    __param(1, ITelemetryService),
    __param(2, IExtensionManagementService),
    __param(3, IStorageService),
    __param(4, INativeHostService),
    __param(5, IExtensionRecommendationNotificationService),
    __param(6, IFileService),
    __param(7, IProductService)
], TestExtensionTipsService);
export { TestExtensionTipsService };
export function workbenchInstantiationService(overrides, disposables = new DisposableStore()) {
    const instantiationService = browserWorkbenchInstantiationService({
        workingCopyBackupService: () => disposables.add(new TestNativeWorkingCopyBackupService()),
        ...overrides
    }, disposables);
    instantiationService.stub(INativeHostService, new TestNativeHostService());
    return instantiationService;
}
let TestServiceAccessor = class TestServiceAccessor {
    constructor(lifecycleService, textFileService, filesConfigurationService, contextService, modelService, fileService, nativeHostService, fileDialogService, workingCopyBackupService, workingCopyService, editorService) {
        this.lifecycleService = lifecycleService;
        this.textFileService = textFileService;
        this.filesConfigurationService = filesConfigurationService;
        this.contextService = contextService;
        this.modelService = modelService;
        this.fileService = fileService;
        this.nativeHostService = nativeHostService;
        this.fileDialogService = fileDialogService;
        this.workingCopyBackupService = workingCopyBackupService;
        this.workingCopyService = workingCopyService;
        this.editorService = editorService;
    }
};
TestServiceAccessor = __decorate([
    __param(0, ILifecycleService),
    __param(1, ITextFileService),
    __param(2, IFilesConfigurationService),
    __param(3, IWorkspaceContextService),
    __param(4, IModelService),
    __param(5, IFileService),
    __param(6, INativeHostService),
    __param(7, IFileDialogService),
    __param(8, IWorkingCopyBackupService),
    __param(9, IWorkingCopyService),
    __param(10, IEditorService)
], TestServiceAccessor);
export { TestServiceAccessor };
export class TestNativeTextFileServiceWithEncodingOverrides extends NativeTextFileService {
    get encoding() {
        if (!this._testEncoding) {
            this._testEncoding = this._register(this.instantiationService.createInstance(TestEncodingOracle));
        }
        return this._testEncoding;
    }
}
export class TestNativeWorkingCopyBackupService extends NativeWorkingCopyBackupService {
    constructor() {
        const environmentService = TestEnvironmentService;
        const logService = new NullLogService();
        const fileService = new FileService(logService);
        const lifecycleService = new TestLifecycleService();
        // eslint-disable-next-line local/code-no-any-casts
        super(environmentService, fileService, logService, lifecycleService);
        const inMemoryFileSystemProvider = this._register(new InMemoryFileSystemProvider());
        this._register(fileService.registerProvider(Schemas.inMemory, inMemoryFileSystemProvider));
        const uriIdentityService = this._register(new UriIdentityService(fileService));
        const userDataProfilesService = this._register(new UserDataProfilesService(environmentService, fileService, uriIdentityService, logService));
        this._register(fileService.registerProvider(Schemas.vscodeUserData, this._register(new FileUserDataProvider(Schemas.file, inMemoryFileSystemProvider, Schemas.vscodeUserData, userDataProfilesService, uriIdentityService, logService))));
        this.backupResourceJoiners = [];
        this.discardBackupJoiners = [];
        this.discardedBackups = [];
        this.pendingBackupsArr = [];
        this.discardedAllBackups = false;
        this._register(fileService);
        this._register(lifecycleService);
    }
    testGetFileService() {
        return this.fileService;
    }
    async waitForAllBackups() {
        await Promise.all(this.pendingBackupsArr);
    }
    joinBackupResource() {
        return new Promise(resolve => this.backupResourceJoiners.push(resolve));
    }
    async backup(identifier, content, versionId, meta, token) {
        const p = super.backup(identifier, content, versionId, meta, token);
        const removeFromPendingBackups = insert(this.pendingBackupsArr, p.then(undefined, undefined));
        try {
            await p;
        }
        finally {
            removeFromPendingBackups();
        }
        while (this.backupResourceJoiners.length) {
            this.backupResourceJoiners.pop()();
        }
    }
    joinDiscardBackup() {
        return new Promise(resolve => this.discardBackupJoiners.push(resolve));
    }
    async discardBackup(identifier) {
        await super.discardBackup(identifier);
        this.discardedBackups.push(identifier);
        while (this.discardBackupJoiners.length) {
            this.discardBackupJoiners.pop()();
        }
    }
    async discardBackups(filter) {
        this.discardedAllBackups = true;
        return super.discardBackups(filter);
    }
    async getBackupContents(identifier) {
        const backupResource = this.toBackupResource(identifier);
        const fileContents = await this.fileService.readFile(backupResource);
        return fileContents.value.toString();
    }
}
export class TestIPCFileSystemProvider {
    constructor() {
        this.capabilities = 2 /* FileSystemProviderCapabilities.FileReadWrite */ | 1024 /* FileSystemProviderCapabilities.PathCaseSensitive */;
        this.onDidChangeCapabilities = Event.None;
        this.onDidChangeFile = Event.None;
    }
    async stat(resource) {
        const { ipcRenderer } = require('electron');
        const stats = await ipcRenderer.invoke('vscode:statFile', resource.fsPath);
        return {
            type: stats.isDirectory ? FileType.Directory : (stats.isFile ? FileType.File : FileType.Unknown),
            ctime: stats.ctimeMs,
            mtime: stats.mtimeMs,
            size: stats.size,
            permissions: stats.isReadonly ? 1 /* FilePermission.Readonly */ : undefined
        };
    }
    async readFile(resource) {
        const { ipcRenderer } = require('electron');
        const result = await ipcRenderer.invoke('vscode:readFile', resource.fsPath);
        return VSBuffer.wrap(result).buffer;
    }
    watch(resource, opts) { return { dispose: () => { } }; }
    mkdir(resource) { throw new Error('mkdir not implemented in test provider'); }
    readdir(resource) { throw new Error('readdir not implemented in test provider'); }
    delete(resource, opts) { throw new Error('delete not implemented in test provider'); }
    rename(from, to, opts) { throw new Error('rename not implemented in test provider'); }
    writeFile(resource, content, opts) { throw new Error('writeFile not implemented in test provider'); }
    readFileStream(resource, opts, token) { throw new Error('readFileStream not implemented in test provider'); }
    open(resource, opts) { throw new Error('open not implemented in test provider'); }
    close(fd) { throw new Error('close not implemented in test provider'); }
    read(fd, pos, data, offset, length) { throw new Error('read not implemented in test provider'); }
    write(fd, pos, data, offset, length) { throw new Error('write not implemented in test provider'); }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC90ZXN0L2VsZWN0cm9uLWJyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUN4RCxPQUFPLEVBQUUsUUFBUSxFQUE0QyxNQUFNLGdDQUFnQyxDQUFDO0FBRXBHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RCxPQUFPLEVBQUUsZUFBZSxFQUFlLE1BQU0sbUNBQW1DLENBQUM7QUFDakYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRTFELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUl6RSxPQUFPLEVBQUUsa0JBQWtCLEVBQTRCLE1BQU0sNkNBQTZDLENBQUM7QUFDM0csT0FBTyxFQUF1Qix5QkFBeUIsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3JILE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLHFFQUFxRSxDQUFDO0FBQ2xILE9BQU8sRUFBRSxrQ0FBa0MsRUFBRSxNQUFNLHNFQUFzRSxDQUFDO0FBQzFILE9BQU8sRUFBRSwyQ0FBMkMsRUFBRSxNQUFNLCtFQUErRSxDQUFDO0FBQzVJLE9BQU8sRUFBRSxZQUFZLEVBQXNLLFFBQVEsRUFBaUIsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwUSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDNUUsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sOERBQThELENBQUM7QUFHMUcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3JFLE9BQU8sRUFB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