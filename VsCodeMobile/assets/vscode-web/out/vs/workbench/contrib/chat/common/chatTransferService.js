var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { areWorkspaceFoldersEmpty } from '../../../services/workspaces/common/workspaceUtils.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
export const IChatTransferService = createDecorator('chatTransferService');
const transferredWorkspacesKey = 'chat.transferedWorkspaces';
let ChatTransferService = class ChatTransferService {
    constructor(workspaceService, storageService, fileService, workspaceTrustManagementService) {
        this.workspaceService = workspaceService;
        this.storageService = storageService;
        this.fileService = fileService;
        this.workspaceTrustManagementService = workspaceTrustManagementService;
    }
    deleteWorkspaceFromTransferredList(workspace) {
        const transferredWorkspaces = this.storageService.getObject(transferredWorkspacesKey, 0 /* StorageScope.PROFILE */, []);
        const updatedWorkspaces = transferredWorkspaces.filter(uri => uri !== workspace.toString());
        this.storageService.store(transferredWorkspacesKey, updatedWorkspaces, 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
    }
    addWorkspaceToTransferred(workspace) {
        const transferredWorkspaces = this.storageService.getObject(transferredWorkspacesKey, 0 /* StorageScope.PROFILE */, []);
        transferredWorkspaces.push(workspace.toString());
        this.storageService.store(transferredWorkspacesKey, transferredWorkspaces, 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
    }
    async checkAndSetTransferredWorkspaceTrust() {
        const workspace = this.workspaceService.getWorkspace();
        const currentWorkspaceUri = workspace.folders[0]?.uri;
        if (!currentWorkspaceUri) {
            return;
        }
        if (this.isChatTransferredWorkspace(currentWorkspaceUri, this.storageService) && await areWorkspaceFoldersEmpty(workspace, this.fileService)) {
            await this.workspaceTrustManagementService.setWorkspaceTrust(true);
            this.deleteWorkspaceFromTransferredList(currentWorkspaceUri);
        }
    }
    isChatTransferredWorkspace(workspace, storageService) {
        if (!workspace) {
            return false;
        }
        const chatWorkspaceTransfer = storageService.getObject(transferredWorkspacesKey, 0 /* StorageScope.PROFILE */, []);
        return chatWorkspaceTransfer.some(item => item.toString() === workspace.toString());
    }
};
ChatTransferService = __decorate([
    __param(0, IWorkspaceContextService),
    __param(1, IStorageService),
    __param(2, IFileService),
    __param(3, IWorkspaceTrustManagementService)
], ChatTransferService);
export { ChatTransferService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRyYW5zZmVyU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0VHJhbnNmZXJTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBOzs7Z0dBR2dHO0FBQ2hHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sZ0RBQWdELENBQUM7QUFDOUcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzNHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUc3RixNQUFNLENBQUMsTUFBTSxvQkFBb0IsR0FBRyxlQUFlLENBQXVCLHFCQUFxQixDQUFDLENBQUM7QUFDakcsTUFBTSx3QkFBd0IsR0FBRywyQkFBMkIsQ0FBQztBQVN0RCxJQUFNLG1CQUFtQixHQUF6QixNQUFNLG1CQUFtQjtJQUcvQixZQUM0QyxnQkFBMEMsRUFDbkQsY0FBK0IsRUFDbEMsV0FBeUIsRUFDTCwrQkFBaUU7UUFIekUscUJBQWdCLEdBQWhCLGdCQUFnQixDQUEwQjtRQUNuRCxtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7UUFDbEMsZ0JBQVcsR0FBWCxXQUFXLENBQWM7UUFDTCxvQ0FBK0IsR0FBL0IsK0JBQStCLENBQWtDO0lBQ2pILENBQUM7SUFFTCxrQ0FBa0MsQ0FBQyxTQUFjO1FBQ2hELE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQVcsd0JBQXdCLGdDQUF3QixFQUFFLENBQUMsQ0FBQztRQUMxSCxNQUFNLGlCQUFpQixHQUFHLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxTQUFTLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUM1RixJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsRUFBRSxpQkFBaUIsOERBQThDLENBQUM7SUFDckgsQ0FBQztJQUVELHlCQUF5QixDQUFDLFNBQWM7UUFDdkMsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBVyx3QkFBd0IsZ0NBQXdCLEVBQUUsQ0FBQyxDQUFDO1FBQzFILHFCQUFxQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsRUFBRSxxQkFBcUIsOERBQThDLENBQUM7SUFDekgsQ0FBQztJQUVELEtBQUssQ0FBQyxvQ0FBb0M7UUFDekMsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3ZELE1BQU0sbUJBQW1CLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUM7UUFDdEQsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7WUFDMUIsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksTUFBTSx3QkFBd0IsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7WUFDOUksTUFBTSxJQUFJLENBQUMsK0JBQStCLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbkUsSUFBSSxDQUFDLGtDQUFrQyxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDOUQsQ0FBQztJQUNGLENBQUM7SUFFRCwwQkFBMEIsQ0FBQyxTQUFjLEVBQUUsY0FBK0I7UUFDekUsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELE1BQU0scUJBQXFCLEdBQVUsY0FBYyxDQUFDLFNBQVMsQ0FBQyx3QkFBd0IsZ0NBQXdCLEVBQUUsQ0FBQyxDQUFDO1FBQ2xILE9BQU8scUJBQXFCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxLQUFLLFNBQVMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQ3JGLENBQUM7Q0FDRCxDQUFBO0FBekNZLG1CQUFtQjtJQUk3QixXQUFBLHdCQUF3QixDQUFBO0lBQ3hCLFdBQUEsZUFBZSxDQUFBO0lBQ2YsV0FBQSxZQUFZLENBQUE7SUFDWixXQUFBLGdDQUFnQyxDQUFBO0dBUHRCLG1CQUFtQixDQXlDL0IifQ==