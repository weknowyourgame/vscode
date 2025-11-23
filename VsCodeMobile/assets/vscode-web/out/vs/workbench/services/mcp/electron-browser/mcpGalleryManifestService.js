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
import { Emitter } from '../../../../base/common/event.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IMcpGalleryManifestService } from '../../../../platform/mcp/common/mcpGalleryManifest.js';
import { McpGalleryManifestService as McpGalleryManifestService } from '../../../../platform/mcp/common/mcpGalleryManifestService.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ISharedProcessService } from '../../../../platform/ipc/electron-browser/services.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IRemoteAgentService } from '../../remote/common/remoteAgentService.js';
import { mcpGalleryServiceUrlConfig } from '../../../../platform/mcp/common/mcpManagement.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IRequestService } from '../../../../platform/request/common/request.js';
let WorkbenchMcpGalleryManifestService = class WorkbenchMcpGalleryManifestService extends McpGalleryManifestService {
    get mcpGalleryManifestStatus() { return this.currentStatus; }
    constructor(productService, remoteAgentService, requestService, logService, sharedProcessService, configurationService) {
        super(productService, requestService, logService);
        this.configurationService = configurationService;
        this.mcpGalleryManifest = null;
        this._onDidChangeMcpGalleryManifest = this._register(new Emitter());
        this.onDidChangeMcpGalleryManifest = this._onDidChangeMcpGalleryManifest.event;
        this.currentStatus = "unavailable" /* McpGalleryManifestStatus.Unavailable */;
        this._onDidChangeMcpGalleryManifestStatus = this._register(new Emitter());
        this.onDidChangeMcpGalleryManifestStatus = this._onDidChangeMcpGalleryManifestStatus.event;
        const channels = [sharedProcessService.getChannel('mcpGalleryManifest')];
        const remoteConnection = remoteAgentService.getConnection();
        if (remoteConnection) {
            channels.push(remoteConnection.getChannel('mcpGalleryManifest'));
        }
        this.getMcpGalleryManifest().then(manifest => {
            channels.forEach(channel => channel.call('setMcpGalleryManifest', [manifest]));
        });
    }
    async getMcpGalleryManifest() {
        if (!this.initPromise) {
            this.initPromise = this.doGetMcpGalleryManifest();
        }
        await this.initPromise;
        return this.mcpGalleryManifest;
    }
    async doGetMcpGalleryManifest() {
        await this.getAndUpdateMcpGalleryManifest();
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(mcpGalleryServiceUrlConfig) || e.affectsConfiguration('chat.mcp.gallery.version')) {
                this.getAndUpdateMcpGalleryManifest();
            }
        }));
    }
    async getAndUpdateMcpGalleryManifest() {
        const mcpGalleryConfig = this.configurationService.getValue('chat.mcp.gallery');
        if (mcpGalleryConfig?.serviceUrl) {
            this.update(await this.createMcpGalleryManifest(mcpGalleryConfig.serviceUrl, mcpGalleryConfig.version));
        }
        else {
            this.update(await super.getMcpGalleryManifest());
        }
    }
    update(manifest) {
        if (this.mcpGalleryManifest?.url === manifest?.url && this.mcpGalleryManifest?.version === manifest?.version) {
            return;
        }
        this.mcpGalleryManifest = manifest;
        if (this.mcpGalleryManifest) {
            this.logService.info('MCP Registry configured:', this.mcpGalleryManifest.url);
        }
        else {
            this.logService.info('No MCP Registry configured');
        }
        this.currentStatus = this.mcpGalleryManifest ? "available" /* McpGalleryManifestStatus.Available */ : "unavailable" /* McpGalleryManifestStatus.Unavailable */;
        this._onDidChangeMcpGalleryManifest.fire(this.mcpGalleryManifest);
        this._onDidChangeMcpGalleryManifestStatus.fire(this.currentStatus);
    }
};
WorkbenchMcpGalleryManifestService = __decorate([
    __param(0, IProductService),
    __param(1, IRemoteAgentService),
    __param(2, IRequestService),
    __param(3, ILogService),
    __param(4, ISharedProcessService),
    __param(5, IConfigurationService)
], WorkbenchMcpGalleryManifestService);
export { WorkbenchMcpGalleryManifestService };
registerSingleton(IMcpGalleryManifestService, WorkbenchMcpGalleryManifestService, 0 /* InstantiationType.Eager */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwR2FsbGVyeU1hbmlmZXN0U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvbWNwL2VsZWN0cm9uLWJyb3dzZXIvbWNwR2FsbGVyeU1hbmlmZXN0U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDM0QsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLDBCQUEwQixFQUFpRCxNQUFNLHVEQUF1RCxDQUFDO0FBQ2xKLE9BQU8sRUFBRSx5QkFBeUIsSUFBSSx5QkFBeUIsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQ3RJLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUM5RixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDeEYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDaEYsT0FBTyxFQUFxQiwwQkFBMEIsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ2pILE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFFMUUsSUFBTSxrQ0FBa0MsR0FBeEMsTUFBTSxrQ0FBbUMsU0FBUSx5QkFBeUI7SUFRaEYsSUFBYSx3QkFBd0IsS0FBK0IsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztJQUloRyxZQUNrQixjQUErQixFQUMzQixrQkFBdUMsRUFDM0MsY0FBK0IsRUFDbkMsVUFBdUIsRUFDYixv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