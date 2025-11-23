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
var BackupMainService_1;
import { createHash } from 'crypto';
import { isEqual } from '../../../base/common/extpath.js';
import { Schemas } from '../../../base/common/network.js';
import { join } from '../../../base/common/path.js';
import { isLinux } from '../../../base/common/platform.js';
import { extUriBiasedIgnorePathCase } from '../../../base/common/resources.js';
import { Promises, RimRafMode } from '../../../base/node/pfs.js';
import { isEmptyWindowBackupInfo, deserializeWorkspaceInfos, deserializeFolderInfos } from '../node/backup.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IEnvironmentMainService } from '../../environment/electron-main/environmentMainService.js';
import { IStateService } from '../../state/node/state.js';
import { HotExitConfiguration } from '../../files/common/files.js';
import { ILogService } from '../../log/common/log.js';
import { isFolderBackupInfo } from '../common/backup.js';
import { isWorkspaceIdentifier } from '../../workspace/common/workspace.js';
import { createEmptyWorkspaceIdentifier } from '../../workspaces/node/workspaces.js';
let BackupMainService = class BackupMainService {
    static { BackupMainService_1 = this; }
    static { this.backupWorkspacesMetadataStorageKey = 'backupWorkspaces'; }
    constructor(environmentMainService, configurationService, logService, stateService) {
        this.configurationService = configurationService;
        this.logService = logService;
        this.stateService = stateService;
        this.workspaces = [];
        this.folders = [];
        this.emptyWindows = [];
        // Comparers for paths and resources that will
        // - ignore path casing on Windows/macOS
        // - respect path casing on Linux
        this.backupUriComparer = extUriBiasedIgnorePathCase;
        this.backupPathComparer = { isEqual: (pathA, pathB) => isEqual(pathA, pathB, !isLinux) };
        this.backupHome = environmentMainService.backupHome;
    }
    async initialize() {
        // read backup workspaces
        const serializedBackupWorkspaces = this.stateService.getItem(BackupMainService_1.backupWorkspacesMetadataStorageKey) ?? { workspaces: [], folders: [], emptyWindows: [] };
        // validate empty workspaces backups first
        this.emptyWindows = await this.validateEmptyWorkspaces(serializedBackupWorkspaces.emptyWindows);
        // validate workspace backups
        this.workspaces = await this.validateWorkspaces(deserializeWorkspaceInfos(serializedBackupWorkspaces));
        // validate folder backups
        this.folders = await this.validateFolders(deserializeFolderInfos(serializedBackupWorkspaces));
        // store metadata in case some workspaces or folders have been removed
        this.storeWorkspacesMetadata();
    }
    getWorkspaceBackups() {
        if (this.isHotExitOnExitAndWindowClose()) {
            // Only non-folder windows are restored on main process launch when
            // hot exit is configured as onExitAndWindowClose.
            return [];
        }
        return this.workspaces.slice(0); // return a copy
    }
    getFolderBackups() {
        if (this.isHotExitOnExitAndWindowClose()) {
            // Only non-folder windows are restored on main process launch when
            // hot exit is configured as onExitAndWindowClose.
            return [];
        }
        return this.folders.slice(0); // return a copy
    }
    isHotExitEnabled() {
        return this.getHotExitConfig() !== HotExitConfiguration.OFF;
    }
    isHotExitOnExitAndWindowClose() {
        return this.getHotExitConfig() === HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE;
    }
    getHotExitConfig() {
        const config = this.configurationService.getValue();
        return config?.files?.hotExit || HotExitConfiguration.ON_EXIT;
    }
    getEmptyWindowBackups() {
        return this.emptyWindows.slice(0); // return a copy
    }
    registerWorkspaceBackup(workspaceInfo, migrateFrom) {
        if (!this.workspaces.some(workspace => workspaceInfo.workspace.id === workspace.workspace.id)) {
            this.workspaces.push(workspaceInfo);
            this.storeWorkspacesMetadata();
        }
        const backupPath = join(this.backupHome, workspaceInfo.workspace.id);
        if (migrateFrom) {
            return this.moveBackupFolder(backupPath, migrateFrom).then(() => backupPath);
        }
        return backupPath;
    }
    async moveBackupFolder(backupPath, moveFromPath) {
        // Target exists: make sure to convert existing backups to empty window backups
        if (await Promises.exists(backupPath)) {
            await this.convertToEmptyWindowBackup(backupPath);
        }
        // When we have data to migrate from, move it over to the target location
        if (await Promises.exists(moveFromPath)) {
            try {
                await Promises.rename(moveFromPath, backupPath, false /* no retry */);
            }
            catch (error) {
                this.logService.error(`Backup: Could not move backup folder to new location: ${error.toString()}`);
            }
        }
    }
    registerFolderBackup(folderInfo) {
        if (!this.folders.some(folder => this.backupUriComparer.isEqual(folderInfo.folderUri, folder.folderUri))) {
            this.folders.push(folderInfo);
            this.storeWorkspacesMetadata();
        }
        return join(this.backupHome, this.getFolderHash(folderInfo));
    }
    registerEmptyWindowBackup(emptyWindowInfo) {
        if (!this.emptyWindows.some(emptyWindow => !!emptyWindow.backupFolder && this.backupPathComparer.isEqual(emptyWindow.backupFolder, emptyWindowInfo.backupFolder))) {
            this.emptyWindows.push(emptyWindowInfo);
            this.storeWorkspacesMetadata();
        }
        return join(this.backupHome, emptyWindowInfo.backupFolder);
    }
    async validateWorkspaces(rootWorkspaces) {
        if (!Array.isArray(rootWorkspaces)) {
            return [];
        }
        const seenIds = new Set();
        const result = [];
        // Validate Workspaces
        for (const workspaceInfo of rootWorkspaces) {
            const workspace = workspaceInfo.workspace;
            if (!isWorkspaceIdentifier(workspace)) {
                return []; // wrong format, skip all entries
            }
            if (!seenIds.has(workspace.id)) {
                seenIds.add(workspace.id);
                const backupPath = join(this.backupHome, workspace.id);
                const hasBackups = await this.doHasBackups(backupPath);
                // If the workspace has no backups, ignore it
                if (hasBackups) {
                    if (workspace.configPath.scheme !== Schemas.file || await Promises.exists(workspace.configPath.fsPath)) {
                        result.push(workspaceInfo);
                    }
                    else {
                        // If the workspace has backups, but the target workspace is missing, convert backups to empty ones
                        await this.convertToEmptyWindowBackup(backupPath);
                    }
                }
                else {
                    await this.deleteStaleBackup(backupPath);
                }
            }
        }
        return result;
    }
    async validateFolders(folderWorkspaces) {
        if (!Array.isArray(folderWorkspaces)) {
            return [];
        }
        const result = [];
        const seenIds = new Set();
        for (const folderInfo of folderWorkspaces) {
            const folderURI = folderInfo.folderUri;
            const key = this.backupUriComparer.getComparisonKey(folderURI);
            if (!seenIds.has(key)) {
                seenIds.add(key);
                const backupPath = join(this.backupHome, this.getFolderHash(folderInfo));
                const hasBackups = await this.doHasBackups(backupPath);
                // If the folder has no backups, ignore it
                if (hasBackups) {
                    if (folderURI.scheme !== Schemas.file || await Promises.exists(folderURI.fsPath)) {
                        result.push(folderInfo);
                    }
                    else {
                        // If the folder has backups, but the target workspace is missing, convert backups to empty ones
                        await this.convertToEmptyWindowBackup(backupPath);
                    }
                }
                else {
                    await this.deleteStaleBackup(backupPath);
                }
            }
        }
        return result;
    }
    async validateEmptyWorkspaces(emptyWorkspaces) {
        if (!Array.isArray(emptyWorkspaces)) {
            return [];
        }
        const result = [];
        const seenIds = new Set();
        // Validate Empty Windows
        for (const backupInfo of emptyWorkspaces) {
            const backupFolder = backupInfo.backupFolder;
            if (typeof backupFolder !== 'string') {
                return [];
            }
            if (!seenIds.has(backupFolder)) {
                seenIds.add(backupFolder);
                const backupPath = join(this.backupHome, backupFolder);
                if (await this.doHasBackups(backupPath)) {
                    result.push(backupInfo);
                }
                else {
                    await this.deleteStaleBackup(backupPath);
                }
            }
        }
        return result;
    }
    async deleteStaleBackup(backupPath) {
        try {
            await Promises.rm(backupPath, RimRafMode.MOVE);
        }
        catch (error) {
            this.logService.error(`Backup: Could not delete stale backup: ${error.toString()}`);
        }
    }
    prepareNewEmptyWindowBackup() {
        // We are asked to prepare a new empty window backup folder.
        // Empty windows backup folders are derived from a workspace
        // identifier, so we generate a new empty workspace identifier
        // until we found a unique one.
        let emptyWorkspaceIdentifier = createEmptyWorkspaceIdentifier();
        while (this.emptyWindows.some(emptyWindow => !!emptyWindow.backupFolder && this.backupPathComparer.isEqual(emptyWindow.backupFolder, emptyWorkspaceIdentifier.id))) {
            emptyWorkspaceIdentifier = createEmptyWorkspaceIdentifier();
        }
        return { backupFolder: emptyWorkspaceIdentifier.id };
    }
    async convertToEmptyWindowBackup(backupPath) {
        const newEmptyWindowBackupInfo = this.prepareNewEmptyWindowBackup();
        // Rename backupPath to new empty window backup path
        const newEmptyWindowBackupPath = join(this.backupHome, newEmptyWindowBackupInfo.backupFolder);
        try {
            await Promises.rename(backupPath, newEmptyWindowBackupPath, false /* no retry */);
        }
        catch (error) {
            this.logService.error(`Backup: Could not rename backup folder: ${error.toString()}`);
            return false;
        }
        this.emptyWindows.push(newEmptyWindowBackupInfo);
        return true;
    }
    async getDirtyWorkspaces() {
        const dirtyWorkspaces = [];
        // Workspaces with backups
        for (const workspace of this.workspaces) {
            if ((await this.hasBackups(workspace))) {
                dirtyWorkspaces.push(workspace);
            }
        }
        // Folders with backups
        for (const folder of this.folders) {
            if ((await this.hasBackups(folder))) {
                dirtyWorkspaces.push(folder);
            }
        }
        return dirtyWorkspaces;
    }
    hasBackups(backupLocation) {
        let backupPath;
        // Empty
        if (isEmptyWindowBackupInfo(backupLocation)) {
            backupPath = join(this.backupHome, backupLocation.backupFolder);
        }
        // Folder
        else if (isFolderBackupInfo(backupLocation)) {
            backupPath = join(this.backupHome, this.getFolderHash(backupLocation));
        }
        // Workspace
        else {
            backupPath = join(this.backupHome, backupLocation.workspace.id);
        }
        return this.doHasBackups(backupPath);
    }
    async doHasBackups(backupPath) {
        try {
            const backupSchemas = await Promises.readdir(backupPath);
            for (const backupSchema of backupSchemas) {
                try {
                    const backupSchemaChildren = await Promises.readdir(join(backupPath, backupSchema));
                    if (backupSchemaChildren.length > 0) {
                        return true;
                    }
                }
                catch {
                    // invalid folder
                }
            }
        }
        catch {
            // backup path does not exist
        }
        return false;
    }
    storeWorkspacesMetadata() {
        const serializedBackupWorkspaces = {
            workspaces: this.workspaces.map(({ workspace, remoteAuthority }) => {
                const serializedWorkspaceBackupInfo = {
                    id: workspace.id,
                    configURIPath: workspace.configPath.toString()
                };
                if (remoteAuthority) {
                    serializedWorkspaceBackupInfo.remoteAuthority = remoteAuthority;
                }
                return serializedWorkspaceBackupInfo;
            }),
            folders: this.folders.map(({ folderUri, remoteAuthority }) => {
                const serializedFolderBackupInfo = {
                    folderUri: folderUri.toString()
                };
                if (remoteAuthority) {
                    serializedFolderBackupInfo.remoteAuthority = remoteAuthority;
                }
                return serializedFolderBackupInfo;
            }),
            emptyWindows: this.emptyWindows.map(({ backupFolder, remoteAuthority }) => {
                const serializedEmptyWindowBackupInfo = {
                    backupFolder
                };
                if (remoteAuthority) {
                    serializedEmptyWindowBackupInfo.remoteAuthority = remoteAuthority;
                }
                return serializedEmptyWindowBackupInfo;
            })
        };
        this.stateService.setItem(BackupMainService_1.backupWorkspacesMetadataStorageKey, serializedBackupWorkspaces);
    }
    getFolderHash(folder) {
        const folderUri = folder.folderUri;
        let key;
        if (folderUri.scheme === Schemas.file) {
            key = isLinux ? folderUri.fsPath : folderUri.fsPath.toLowerCase(); // for backward compatibility, use the fspath as key
        }
        else {
            key = folderUri.toString().toLowerCase();
        }
        return createHash('md5').update(key).digest('hex'); // CodeQL [SM04514] Using MD5 to convert a file path to a fixed length
    }
};
BackupMainService = BackupMainService_1 = __decorate([
    __param(0, IEnvironmentMainService),
    __param(1, IConfigurationService),
    __param(2, ILogService),
    __param(3, IStateService)
], BackupMainService);
export { BackupMainService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja3VwTWFpblNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vYmFja3VwL2VsZWN0cm9uLW1haW4vYmFja3VwTWFpblNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDcEMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMxRCxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDcEQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFFakUsT0FBTyxFQUF1RCx1QkFBdUIsRUFBRSx5QkFBeUIsRUFBRSxzQkFBc0IsRUFBaUcsTUFBTSxtQkFBbUIsQ0FBQztBQUNuUSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUNwRixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUNwRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDMUQsT0FBTyxFQUFFLG9CQUFvQixFQUF1QixNQUFNLDZCQUE2QixDQUFDO0FBQ3hGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RCxPQUFPLEVBQXFCLGtCQUFrQixFQUF3QixNQUFNLHFCQUFxQixDQUFDO0FBQ2xHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHFDQUFxQyxDQUFD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