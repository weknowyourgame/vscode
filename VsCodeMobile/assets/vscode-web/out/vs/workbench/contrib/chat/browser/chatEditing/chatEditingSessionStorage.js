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
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { hashAsync } from '../../../../../base/common/hash.js';
import { ResourceMap } from '../../../../../base/common/map.js';
import { revive } from '../../../../../base/common/marshalling.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { IEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { getKeyForChatSessionResource } from './chatEditingOperations.js';
const STORAGE_CONTENTS_FOLDER = 'contents';
const STORAGE_STATE_FILE = 'state.json';
let ChatEditingSessionStorage = class ChatEditingSessionStorage {
    constructor(_chatSessionResource, _fileService, _environmentService, _logService, _workspaceContextService) {
        this._chatSessionResource = _chatSessionResource;
        this._fileService = _fileService;
        this._environmentService = _environmentService;
        this._logService = _logService;
        this._workspaceContextService = _workspaceContextService;
        this.storageKey = getKeyForChatSessionResource(_chatSessionResource);
    }
    _getStorageLocation() {
        const workspaceId = this._workspaceContextService.getWorkspace().id;
        return joinPath(this._environmentService.workspaceStorageHome, workspaceId, 'chatEditingSessions', this.storageKey);
    }
    async restoreState() {
        const storageLocation = this._getStorageLocation();
        const fileContents = new Map();
        const getFileContent = (hash) => {
            let readPromise = fileContents.get(hash);
            if (!readPromise) {
                readPromise = this._fileService.readFile(joinPath(storageLocation, STORAGE_CONTENTS_FOLDER, hash)).then(content => content.value.toString());
                fileContents.set(hash, readPromise);
            }
            return readPromise;
        };
        const deserializeSnapshotEntriesDTO = async (dtoEntries) => {
            const entries = new ResourceMap();
            for (const entryDTO of dtoEntries) {
                const entry = await deserializeSnapshotEntry(entryDTO);
                entries.set(entry.resource, entry);
            }
            return entries;
        };
        const deserializeChatEditingStopDTO = async (stopDTO) => {
            const entries = await deserializeSnapshotEntriesDTO(stopDTO.entries);
            return { stopId: 'stopId' in stopDTO ? stopDTO.stopId : undefined, entries };
        };
        const deserializeSnapshotEntry = async (entry) => {
            return {
                resource: URI.parse(entry.resource),
                languageId: entry.languageId,
                original: await getFileContent(entry.originalHash),
                current: await getFileContent(entry.currentHash),
                state: entry.state,
                snapshotUri: URI.parse(entry.snapshotUri),
                telemetryInfo: {
                    requestId: entry.telemetryInfo.requestId,
                    agentId: entry.telemetryInfo.agentId,
                    command: entry.telemetryInfo.command,
                    sessionResource: this._chatSessionResource,
                    result: undefined,
                    modelId: entry.telemetryInfo.modelId,
                    modeId: entry.telemetryInfo.modeId,
                    applyCodeBlockSuggestionId: entry.telemetryInfo.applyCodeBlockSuggestionId,
                    feature: entry.telemetryInfo.feature,
                }
            };
        };
        try {
            const stateFilePath = joinPath(storageLocation, STORAGE_STATE_FILE);
            if (!await this._fileService.exists(stateFilePath)) {
                this._logService.debug(`chatEditingSession: No editing session state found at ${stateFilePath.toString()}`);
                return undefined;
            }
            this._logService.debug(`chatEditingSession: Restoring editing session at ${stateFilePath.toString()}`);
            const stateFileContent = await this._fileService.readFile(stateFilePath);
            const data = JSON.parse(stateFileContent.value.toString());
            if (!COMPATIBLE_STORAGE_VERSIONS.includes(data.version)) {
                return undefined;
            }
            const initialFileContents = new ResourceMap();
            for (const fileContentDTO of data.initialFileContents) {
                initialFileContents.set(URI.parse(fileContentDTO[0]), await getFileContent(fileContentDTO[1]));
            }
            const recentSnapshot = await deserializeChatEditingStopDTO(data.recentSnapshot);
            return {
                initialFileContents,
                recentSnapshot,
                timeline: revive(data.timeline),
            };
        }
        catch (e) {
            this._logService.error(`Error restoring chat editing session from ${storageLocation.toString()}`, e);
        }
        return undefined;
    }
    async storeState(state) {
        const storageFolder = this._getStorageLocation();
        const contentsFolder = URI.joinPath(storageFolder, STORAGE_CONTENTS_FOLDER);
        // prepare the content folder
        const existingContents = new Set();
        try {
            const stat = await this._fileService.resolve(contentsFolder);
            stat.children?.forEach(child => {
                if (child.isFile) {
                    existingContents.add(child.name);
                }
            });
        }
        catch (e) {
            try {
                // does not exist, create
                await this._fileService.createFolder(contentsFolder);
            }
            catch (e) {
                this._logService.error(`Error creating chat editing session content folder ${contentsFolder.toString()}`, e);
                return;
            }
        }
        const contentWritePromises = new Map();
        // saves a file content under a path containing a hash of the content.
        // Returns the hash to represent the content.
        const writeContent = async (content) => {
            const buffer = VSBuffer.fromString(content);
            const hash = (await hashAsync(buffer)).substring(0, 7);
            if (!existingContents.has(hash)) {
                await this._fileService.writeFile(joinPath(contentsFolder, hash), buffer);
            }
            return hash;
        };
        const addFileContent = async (content) => {
            let storedContentHash = contentWritePromises.get(content);
            if (!storedContentHash) {
                storedContentHash = writeContent(content);
                contentWritePromises.set(content, storedContentHash);
            }
            return storedContentHash;
        };
        const serializeResourceMap = async (resourceMap, serialize) => {
            return await Promise.all(Array.from(resourceMap.entries()).map(async ([resourceURI, value]) => [resourceURI.toString(), await serialize(value)]));
        };
        const serializeChatEditingSessionStop = async (stop) => {
            return {
                stopId: stop.stopId,
                entries: await Promise.all(Array.from(stop.entries.values()).map(serializeSnapshotEntry))
            };
        };
        const serializeSnapshotEntry = async (entry) => {
            return {
                resource: entry.resource.toString(),
                languageId: entry.languageId,
                originalHash: await addFileContent(entry.original),
                currentHash: await addFileContent(entry.current),
                state: entry.state,
                snapshotUri: entry.snapshotUri.toString(),
                telemetryInfo: { requestId: entry.telemetryInfo.requestId, agentId: entry.telemetryInfo.agentId, command: entry.telemetryInfo.command, modelId: entry.telemetryInfo.modelId, modeId: entry.telemetryInfo.modeId }
            };
        };
        try {
            const data = {
                version: STORAGE_VERSION,
                initialFileContents: await serializeResourceMap(state.initialFileContents, value => addFileContent(value)),
                timeline: state.timeline,
                recentSnapshot: await serializeChatEditingSessionStop(state.recentSnapshot),
            };
            this._logService.debug(`chatEditingSession: Storing editing session at ${storageFolder.toString()}: ${contentWritePromises.size} files`);
            await this._fileService.writeFile(joinPath(storageFolder, STORAGE_STATE_FILE), VSBuffer.fromString(JSON.stringify(data)));
        }
        catch (e) {
            this._logService.debug(`Error storing chat editing session to ${storageFolder.toString()}`, e);
        }
    }
    async clearState() {
        const storageFolder = this._getStorageLocation();
        if (await this._fileService.exists(storageFolder)) {
            this._logService.debug(`chatEditingSession: Clearing editing session at ${storageFolder.toString()}`);
            try {
                await this._fileService.del(storageFolder, { recursive: true });
            }
            catch (e) {
                this._logService.debug(`Error clearing chat editing session from ${storageFolder.toString()}`, e);
            }
        }
    }
};
ChatEditingSessionStorage = __decorate([
    __param(1, IFileService),
    __param(2, IEnvironmentService),
    __param(3, ILogService),
    __param(4, IWorkspaceContextService)
], ChatEditingSessionStorage);
export { ChatEditingSessionStorage };
const COMPATIBLE_STORAGE_VERSIONS = [1, 2];
const STORAGE_VERSION = 2;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdTZXNzaW9uU3RvcmFnZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdTZXNzaW9uU3RvcmFnZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDbkUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUV4RCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUNoRyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDN0UsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBR2pHLE9BQU8sRUFBRSw0QkFBNEIsRUFBNkIsTUFBTSw0QkFBNEIsQ0FBQztBQUVyRyxNQUFNLHVCQUF1QixHQUFHLFVBQVUsQ0FBQztBQUMzQyxNQUFNLGtCQUFrQixHQUFHLFlBQVksQ0FBQztBQVFqQyxJQUFNLHlCQUF5QixHQUEvQixNQUFNLHlCQUF5QjtJQUVyQyxZQUNrQixvQkFBeUIsRUFDWCxZQUEwQixFQUNuQixtQkFBd0MsRUFDaEQsV0FBd0IsRUFDWCx3QkFBa0Q7UUFKNUUseUJBQW9CLEdBQXBC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