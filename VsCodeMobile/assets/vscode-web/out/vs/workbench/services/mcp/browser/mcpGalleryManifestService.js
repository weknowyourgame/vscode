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
import { IMcpGalleryManifestService } from '../../../../platform/mcp/common/mcpGalleryManifest.js';
import { McpGalleryManifestService as McpGalleryManifestService } from '../../../../platform/mcp/common/mcpGalleryManifestService.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IRemoteAgentService } from '../../remote/common/remoteAgentService.js';
import { IRequestService } from '../../../../platform/request/common/request.js';
import { ILogService } from '../../../../platform/log/common/log.js';
let WebMcpGalleryManifestService = class WebMcpGalleryManifestService extends McpGalleryManifestService {
    constructor(productService, requestService, logService, remoteAgentService) {
        super(productService, requestService, logService);
        const remoteConnection = remoteAgentService.getConnection();
        if (remoteConnection) {
            const channel = remoteConnection.getChannel('mcpGalleryManifest');
            this.getMcpGalleryManifest().then(manifest => {
                channel.call('setMcpGalleryManifest', [manifest]);
                this._register(this.onDidChangeMcpGalleryManifest(manifest => channel.call('setMcpGalleryManifest', [manifest])));
            });
        }
    }
};
WebMcpGalleryManifestService = __decorate([
    __param(0, IProductService),
    __param(1, IRequestService),
    __param(2, ILogService),
    __param(3, IRemoteAgentService)
], WebMcpGalleryManifestService);
registerSingleton(IMcpGalleryManifestService, WebMcpGalleryManifestService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwR2FsbGVyeU1hbmlmZXN0U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvbWNwL2Jyb3dzZXIvbWNwR2FsbGVyeU1hbmlmZXN0U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNuRyxPQUFPLEVBQUUseUJBQXlCLElBQUkseUJBQXlCLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUN0SSxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNqRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFckUsSUFBTSw0QkFBNEIsR0FBbEMsTUFBTSw0QkFBNkIsU0FBUSx5QkFBeUI7SUFFbkUsWUFDa0IsY0FBK0IsRUFDL0IsY0FBK0IsRUFDbkMsVUFBdUIsRUFDZixrQkFBdUM7UUFFNUQsS0FBSyxDQUFDLGNBQWMsRUFBRSxjQUFjLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDbEQsTUFBTSxnQkFBZ0IsR0FBRyxrQkFBa0IsQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUM1RCxJQUFJLGdCQUFnQixFQUFFLENBQUM7WUFDdEIsTUFBTSxPQUFPLEdBQUcsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLG9CQUFvQixDQUFDLENBQUM7WUFDbEUsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUM1QyxPQUFPLENBQUMsSUFBSSxDQUFDLHVCQUF1QixFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDbEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsNkJBQTZCLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLHVCQUF1QixFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbkgsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO0lBQ0YsQ0FBQztDQUVELENBQUE7QUFuQkssNEJBQTRCO0lBRy9CLFdBQUEsZUFBZSxDQUFBO0lBQ2YsV0FBQSxlQUFlLENBQUE7SUFDZixXQUFBLFdBQVcsQ0FBQTtJQUNYLFdBQUEsbUJBQW1CLENBQUE7R0FOaEIsNEJBQTRCLENBbUJqQztBQUVELGlCQUFpQixDQUFDLDBCQUEwQixFQUFFLDRCQUE0QixvQ0FBNEIsQ0FBQyJ9