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
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IRemoteAgentService } from '../../remote/common/remoteAgentService.js';
import { IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile.js';
import { IRemoteUserDataProfilesService } from '../../userDataProfile/common/remoteUserDataProfiles.js';
import { WorkbenchMcpManagementService as BaseWorkbenchMcpManagementService, IWorkbenchMcpManagementService } from '../common/mcpWorkbenchManagementService.js';
import { McpManagementService } from '../../../../platform/mcp/common/mcpManagementService.js';
import { IAllowedMcpServersService } from '../../../../platform/mcp/common/mcpManagement.js';
import { ILogService } from '../../../../platform/log/common/log.js';
let WorkbenchMcpManagementService = class WorkbenchMcpManagementService extends BaseWorkbenchMcpManagementService {
    constructor(allowedMcpServersService, logService, userDataProfileService, uriIdentityService, workspaceContextService, remoteAgentService, userDataProfilesService, remoteUserDataProfilesService, instantiationService) {
        const mMcpManagementService = instantiationService.createInstance(McpManagementService);
        super(mMcpManagementService, allowedMcpServersService, logService, userDataProfileService, uriIdentityService, workspaceContextService, remoteAgentService, userDataProfilesService, remoteUserDataProfilesService, instantiationService);
        this._register(mMcpManagementService);
    }
};
WorkbenchMcpManagementService = __decorate([
    __param(0, IAllowedMcpServersService),
    __param(1, ILogService),
    __param(2, IUserDataProfileService),
    __param(3, IUriIdentityService),
    __param(4, IWorkspaceContextService),
    __param(5, IRemoteAgentService),
    __param(6, IUserDataProfilesService),
    __param(7, IRemoteUserDataProfilesService),
    __param(8, IInstantiationService)
], WorkbenchMcpManagementService);
export { WorkbenchMcpManagementService };
registerSingleton(IWorkbenchMcpManagementService, WorkbenchMcpManagementService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwV29ya2JlbmNoTWFuYWdlbWVudFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL21jcC9icm93c2VyL21jcFdvcmtiZW5jaE1hbmFnZW1lbnRTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ3RHLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUM5RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUM3RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUNoRixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUMxRyxPQUFPLEVBQUUsOEJBQThCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUN4RyxPQUFPLEVBQUUsNkJBQTZCLElBQUksaUNBQWlDLEVBQUUsOEJBQThCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNoSyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRixPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM3RixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFOUQsSUFBTSw2QkFBNkIsR0FBbkMsTUFBTSw2QkFBOEIsU0FBUSxpQ0FBaUM7SUFFbkYsWUFDNEIsd0JBQW1ELEVBQ2pFLFVBQXVCLEVBQ1gsc0JBQStDLEVBQ25ELGtCQUF1QyxFQUNsQyx1QkFBaUQsRUFDdEQsa0JBQXVDLEVBQ2xDLHVCQUFpRCxFQUMzQyw2QkFBNkQsRUFDdEUsb0JBQTJDO1FBRWxFLE1BQU0scUJBQXFCLEdBQUcsb0JBQW9CLENBQUMsY0FBYyxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDeEYsS0FBSyxDQUFDLHFCQUFxQixFQUFFLHdCQUF3QixFQUFFLFVBQVUsRUFBRSxzQkFBc0IsRUFBRSxrQkFBa0IsRUFBRSx1QkFBdUIsRUFBRSxrQkFBa0IsRUFBRSx1QkFBdUIsRUFBRSw2QkFBNkIsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1FBQzFPLElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsQ0FBQztJQUN2QyxDQUFDO0NBQ0QsQ0FBQTtBQWpCWSw2QkFBNkI7SUFHdkMsV0FBQSx5QkFBeUIsQ0FBQTtJQUN6QixXQUFBLFdBQVcsQ0FBQTtJQUNYLFdBQUEsdUJBQXVCLENBQUE7SUFDdkIsV0FBQSxtQkFBbUIsQ0FBQTtJQUNuQixXQUFBLHdCQUF3QixDQUFBO0lBQ3hCLFdBQUEsbUJBQW1CLENBQUE7SUFDbkIsV0FBQSx3QkFBd0IsQ0FBQTtJQUN4QixXQUFBLDhCQUE4QixDQUFBO0lBQzlCLFdBQUEscUJBQXFCLENBQUE7R0FYWCw2QkFBNkIsQ0FpQnpDOztBQUVELGlCQUFpQixDQUFDLDhCQUE4QixFQUFFLDZCQUE2QixvQ0FBNEIsQ0FBQyJ9