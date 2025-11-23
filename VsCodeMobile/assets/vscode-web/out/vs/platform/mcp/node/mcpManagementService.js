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
import { IEnvironmentService } from '../../environment/common/environment.js';
import { IFileService } from '../../files/common/files.js';
import { ILogService } from '../../log/common/log.js';
import { IUriIdentityService } from '../../uriIdentity/common/uriIdentity.js';
import { IMcpGalleryService } from '../common/mcpManagement.js';
import { McpUserResourceManagementService as CommonMcpUserResourceManagementService, McpManagementService as CommonMcpManagementService } from '../common/mcpManagementService.js';
import { IMcpResourceScannerService } from '../common/mcpResourceScannerService.js';
let McpUserResourceManagementService = class McpUserResourceManagementService extends CommonMcpUserResourceManagementService {
    constructor(mcpResource, mcpGalleryService, fileService, uriIdentityService, logService, mcpResourceScannerService, environmentService) {
        super(mcpResource, mcpGalleryService, fileService, uriIdentityService, logService, mcpResourceScannerService, environmentService);
    }
    async installFromGallery(server, options) {
        this.logService.trace('MCP Management Service: installGallery', server.name, server.galleryUrl);
        this._onInstallMcpServer.fire({ name: server.name, mcpResource: this.mcpResource });
        try {
            const manifest = await this.updateMetadataFromGallery(server);
            const packageType = options?.packageType ?? manifest.packages?.[0]?.registryType ?? "remote" /* RegistryType.REMOTE */;
            const { mcpServerConfiguration, notices } = this.getMcpServerConfigurationFromManifest(manifest, packageType);
            if (notices.length > 0) {
                this.logService.warn(`MCP Management Service: Warnings while installing ${server.name}`, notices);
            }
            const installable = {
                name: server.name,
                config: {
                    ...mcpServerConfiguration.config,
                    gallery: server.galleryUrl ?? true,
                    version: server.version
                },
                inputs: mcpServerConfiguration.inputs
            };
            await this.mcpResourceScannerService.addMcpServers([installable], this.mcpResource, this.target);
            await this.updateLocal();
            const local = (await this.getInstalled()).find(s => s.name === server.name);
            if (!local) {
                throw new Error(`Failed to install MCP server: ${server.name}`);
            }
            return local;
        }
        catch (e) {
            this._onDidInstallMcpServers.fire([{ name: server.name, source: server, error: e, mcpResource: this.mcpResource }]);
            throw e;
        }
    }
};
McpUserResourceManagementService = __decorate([
    __param(1, IMcpGalleryService),
    __param(2, IFileService),
    __param(3, IUriIdentityService),
    __param(4, ILogService),
    __param(5, IMcpResourceScannerService),
    __param(6, IEnvironmentService)
], McpUserResourceManagementService);
export { McpUserResourceManagementService };
export class McpManagementService extends CommonMcpManagementService {
    createMcpResourceManagementService(mcpResource) {
        return this.instantiationService.createInstance(McpUserResourceManagementService, mcpResource);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwTWFuYWdlbWVudFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vbWNwL25vZGUvbWNwTWFuYWdlbWVudFNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDOUUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQzNELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM5RSxPQUFPLEVBQXFCLGtCQUFrQixFQUErRixNQUFNLDRCQUE0QixDQUFDO0FBQ2hMLE9BQU8sRUFBRSxnQ0FBZ0MsSUFBSSxzQ0FBc0MsRUFBRSxvQkFBb0IsSUFBSSwwQkFBMEIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ25MLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRTdFLElBQU0sZ0NBQWdDLEdBQXRDLE1BQU0sZ0NBQWlDLFNBQVEsc0NBQXNDO0lBQzNGLFlBQ0MsV0FBZ0IsRUFDSSxpQkFBcUMsRUFDM0MsV0FBeUIsRUFDbEIsa0JBQXVDLEVBQy9DLFVBQXVCLEVBQ1IseUJBQXFELEVBQzVELGtCQUF1QztRQUU1RCxLQUFLLENBQUMsV0FBVyxFQUFFLGlCQUFpQixFQUFFLFdBQVcsRUFBRSxrQkFBa0IsRUFBRSxVQUFVLEVBQUUseUJBQXlCLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUNuSSxDQUFDO0lBRVEsS0FBSyxDQUFDLGtCQUFrQixDQUFDLE1BQXlCLEVBQUUsT0FBd0I7UUFDcEYsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsd0NBQXdDLEVBQUUsTUFBTSxDQUFDLElB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