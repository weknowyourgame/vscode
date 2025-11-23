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
import { VSBuffer } from '../../../base/common/buffer.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IEnvironmentService } from '../../environment/common/environment.js';
import { IFileService } from '../../files/common/files.js';
import { IStorageService } from '../../storage/common/storage.js';
import { ITelemetryService } from '../../telemetry/common/telemetry.js';
import { IUriIdentityService } from '../../uriIdentity/common/uriIdentity.js';
import { IUserDataProfilesService } from '../../userDataProfile/common/userDataProfile.js';
import { AbstractJsonSynchronizer } from './abstractJsonSynchronizer.js';
import { AbstractInitializer } from './abstractSynchronizer.js';
import { IUserDataSyncLocalStoreService, IUserDataSyncLogService, IUserDataSyncEnablementService, IUserDataSyncStoreService } from './userDataSync.js';
export function getTasksContentFromSyncContent(syncContent, logService) {
    try {
        const parsed = JSON.parse(syncContent);
        return parsed.tasks ?? null;
    }
    catch (e) {
        logService.error(e);
        return null;
    }
}
let TasksSynchroniser = class TasksSynchroniser extends AbstractJsonSynchronizer {
    constructor(profile, collection, userDataSyncStoreService, userDataSyncLocalStoreService, logService, configurationService, userDataSyncEnablementService, fileService, environmentService, storageService, telemetryService, uriIdentityService) {
        super(profile.tasksResource, { syncResource: "tasks" /* SyncResource.Tasks */, profile }, collection, 'tasks.json', fileService, environmentService, storageService, userDataSyncStoreService, userDataSyncLocalStoreService, userDataSyncEnablementService, telemetryService, logService, configurationService, uriIdentityService);
    }
    getContentFromSyncContent(syncContent) {
        return getTasksContentFromSyncContent(syncContent, this.logService);
    }
    toSyncContent(tasks) {
        return tasks ? { tasks } : {};
    }
};
TasksSynchroniser = __decorate([
    __param(2, IUserDataSyncStoreService),
    __param(3, IUserDataSyncLocalStoreService),
    __param(4, IUserDataSyncLogService),
    __param(5, IConfigurationService),
    __param(6, IUserDataSyncEnablementService),
    __param(7, IFileService),
    __param(8, IEnvironmentService),
    __param(9, IStorageService),
    __param(10, ITelemetryService),
    __param(11, IUriIdentityService)
], TasksSynchroniser);
export { TasksSynchroniser };
let TasksInitializer = class TasksInitializer extends AbstractInitializer {
    constructor(fileService, userDataProfilesService, environmentService, logService, storageService, uriIdentityService) {
        super("tasks" /* SyncResource.Tasks */, userDataProfilesService, environmentService, logService, fileService, storageService, uriIdentityService);
        this.tasksResource = this.userDataProfilesService.defaultProfile.tasksResource;
    }
    async doInitialize(remoteUserData) {
        const tasksContent = remoteUserData.syncData ? getTasksContentFromSyncContent(remoteUserData.syncData.content, this.logService) : null;
        if (!tasksContent) {
            this.logService.info('Skipping initializing tasks because remote tasks does not exist.');
            return;
        }
        const isEmpty = await this.isEmpty();
        if (!isEmpty) {
            this.logService.info('Skipping initializing tasks because local tasks exist.');
            return;
        }
        await this.fileService.writeFile(this.tasksResource, VSBuffer.fromString(tasksContent));
        await this.updateLastSyncUserData(remoteUserData);
    }
    async isEmpty() {
        return this.fileService.exists(this.tasksResource);
    }
};
TasksInitializer = __decorate([
    __param(0, IFileService),
    __param(1, IUserDataProfilesService),
    __param(2, IEnvironmentService),
    __param(3, IUserDataSyncLogService),
    __param(4, IStorageService),
    __param(5, IUriIdentityService)
], TasksInitializer);
export { TasksInitializer };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFza3NTeW5jLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3VzZXJEYXRhU3luYy9jb21tb24vdGFza3NTeW5jLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUNwRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFFM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzlFLE9BQU8sRUFBb0Isd0JBQXdCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUM3RyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN6RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUNoRSxPQUFPLEVBQW1CLDhCQUE4QixFQUF5Qix1QkFBdUIsRUFBRSw4QkFBOEIsRUFBRSx5QkFBeUIsRUFBZ0IsTUFBTSxtQkFBbUIsQ0FBQztBQU03TSxNQUFNLFVBQVUsOEJBQThCLENBQUMsV0FBbUIsRUFBRSxVQUF1QjtJQUMxRixJQUFJLENBQUM7UUFDSixNQUFNLE1BQU0sR0FBc0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMxRCxPQUFPLE1BQU0sQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDO0lBQzdCLENBQUM7SUFBQyxPQUFPLENBQUMs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