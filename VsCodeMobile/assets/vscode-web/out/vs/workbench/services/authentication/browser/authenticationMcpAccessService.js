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
import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
export const IAuthenticationMcpAccessService = createDecorator('IAuthenticationMcpAccessService');
// TODO@TylerLeonhardt: Should this class only keep track of allowed things and throw away disallowed ones?
let AuthenticationMcpAccessService = class AuthenticationMcpAccessService extends Disposable {
    constructor(_storageService, _productService) {
        super();
        this._storageService = _storageService;
        this._productService = _productService;
        this._onDidChangeMcpSessionAccess = this._register(new Emitter());
        this.onDidChangeMcpSessionAccess = this._onDidChangeMcpSessionAccess.event;
    }
    isAccessAllowed(providerId, accountName, mcpServerId) {
        const trustedMCPServerAuthAccess = this._productService.trustedMcpAuthAccess;
        if (Array.isArray(trustedMCPServerAuthAccess)) {
            if (trustedMCPServerAuthAccess.includes(mcpServerId)) {
                return true;
            }
        }
        else if (trustedMCPServerAuthAccess?.[providerId]?.includes(mcpServerId)) {
            return true;
        }
        const allowList = this.readAllowedMcpServers(providerId, accountName);
        const mcpServerData = allowList.find(mcpServer => mcpServer.id === mcpServerId);
        if (!mcpServerData) {
            return undefined;
        }
        // This property didn't exist on this data previously, inclusion in the list at all indicates allowance
        return mcpServerData.allowed !== undefined
            ? mcpServerData.allowed
            : true;
    }
    readAllowedMcpServers(providerId, accountName) {
        let trustedMCPServers = [];
        try {
            const trustedMCPServerSrc = this._storageService.get(`mcpserver-${providerId}-${accountName}`, -1 /* StorageScope.APPLICATION */);
            if (trustedMCPServerSrc) {
                trustedMCPServers = JSON.parse(trustedMCPServerSrc);
            }
        }
        catch (err) { }
        // Add trusted MCP servers from product.json if they're not already in the list
        const trustedMcpServerAuthAccess = this._productService.trustedMcpAuthAccess;
        const trustedMcpServerIds = 
        // Case 1: trustedMcpServerAuthAccess is an array
        Array.isArray(trustedMcpServerAuthAccess)
            ? trustedMcpServerAuthAccess
            // Case 2: trustedMcpServerAuthAccess is an object
            : typeof trustedMcpServerAuthAccess === 'object'
                ? trustedMcpServerAuthAccess[providerId] ?? []
                : [];
        for (const mcpServerId of trustedMcpServerIds) {
            const existingServer = trustedMCPServers.find(server => server.id === mcpServerId);
            if (!existingServer) {
                // Add new trusted server (name will be set by caller if they have server info)
                trustedMCPServers.push({
                    id: mcpServerId,
                    name: mcpServerId, // Default to ID, caller can update with proper name
                    allowed: true,
                    trusted: true
                });
            }
            else {
                // Update existing server to be trusted
                existingServer.allowed = true;
                existingServer.trusted = true;
            }
        }
        return trustedMCPServers;
    }
    updateAllowedMcpServers(providerId, accountName, mcpServers) {
        const allowList = this.readAllowedMcpServers(providerId, accountName);
        for (const mcpServer of mcpServers) {
            const index = allowList.findIndex(e => e.id === mcpServer.id);
            if (index === -1) {
                allowList.push(mcpServer);
            }
            else {
                allowList[index].allowed = mcpServer.allowed;
                // Update name if provided and not already set to a proper name
                if (mcpServer.name && mcpServer.name !== mcpServer.id && allowList[index].name !== mcpServer.name) {
                    allowList[index].name = mcpServer.name;
                }
            }
        }
        // Filter out trusted servers before storing - they should only come from product.json, not user storage
        const userManagedServers = allowList.filter(server => !server.trusted);
        this._storageService.store(`mcpserver-${providerId}-${accountName}`, JSON.stringify(userManagedServers), -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
        this._onDidChangeMcpSessionAccess.fire({ providerId, accountName });
    }
    removeAllowedMcpServers(providerId, accountName) {
        this._storageService.remove(`mcpserver-${providerId}-${accountName}`, -1 /* StorageScope.APPLICATION */);
        this._onDidChangeMcpSessionAccess.fire({ providerId, accountName });
    }
};
AuthenticationMcpAccessService = __decorate([
    __param(0, IStorageService),
    __param(1, IProductService)
], AuthenticationMcpAccessService);
export { AuthenticationMcpAccessService };
registerSingleton(IAuthenticationMcpAccessService, AuthenticationMcpAccessService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb25NY3BBY2Nlc3NTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9hdXRoZW50aWNhdGlvbi9icm93c2VyL2F1dGhlbnRpY2F0aW9uTWNwQWNjZXNzU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDN0YsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sZ0RBQWdELENBQUM7QUFnQjlHLE1BQU0sQ0FBQyxNQUFNLCtCQUErQixHQUFHLGVBQWUsQ0FBa0MsaUNBQWlDLENBQUMsQ0FBQztBQW9CbkksMkdBQTJHO0FBQ3BHLElBQU0sOEJBQThCLEdBQXBDLE1BQU0sOEJBQStCLFNBQVEsVUFBVTtJQU03RCxZQUNrQixlQUFpRCxFQUNqRCxlQUFpRDtRQUVsRSxLQUFLLEVBQUUsQ0FBQztRQUgwQixvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUFDaEMsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBTDNELGlDQUE0QixHQUF5RCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUErQyxDQUFDLENBQUM7UUFDL0osZ0NBQTJCLEdBQXVELElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxLQUFLLENBQUM7SUFPbkksQ0FBQztJQUVELGVBQWUsQ0FBQyxVQUFrQixFQUFFLFdBQW1CLEVBQUUsV0FB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