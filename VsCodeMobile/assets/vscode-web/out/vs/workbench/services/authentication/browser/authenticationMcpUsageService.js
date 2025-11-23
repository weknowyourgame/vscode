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
import { Queue } from '../../../../base/common/async.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IAuthenticationService } from '../common/authentication.js';
export const IAuthenticationMcpUsageService = createDecorator('IAuthenticationMcpUsageService');
let AuthenticationMcpUsageService = class AuthenticationMcpUsageService extends Disposable {
    constructor(_storageService, _authenticationService, _logService, productService) {
        super();
        this._storageService = _storageService;
        this._authenticationService = _authenticationService;
        this._logService = _logService;
        this._queue = new Queue();
        this._mcpServersUsingAuth = new Set();
        // If an MCP server is listed in `trustedMcpAuthAccess` we should consider it as using auth
        const trustedMcpAuthAccess = productService.trustedMcpAuthAccess;
        if (Array.isArray(trustedMcpAuthAccess)) {
            for (const mcpServerId of trustedMcpAuthAccess) {
                this._mcpServersUsingAuth.add(mcpServerId);
            }
        }
        else if (trustedMcpAuthAccess) {
            for (const mcpServers of Object.values(trustedMcpAuthAccess)) {
                for (const mcpServerId of mcpServers) {
                    this._mcpServersUsingAuth.add(mcpServerId);
                }
            }
        }
        this._register(this._authenticationService.onDidRegisterAuthenticationProvider(provider => this._queue.queue(() => this._addToCache(provider.id))));
    }
    async initializeUsageCache() {
        await this._queue.queue(() => Promise.all(this._authenticationService.getProviderIds().map(providerId => this._addToCache(providerId))));
    }
    async hasUsedAuth(mcpServerId) {
        await this._queue.whenIdle();
        return this._mcpServersUsingAuth.has(mcpServerId);
    }
    readAccountUsages(providerId, accountName) {
        const accountKey = `${providerId}-${accountName}-mcpserver-usages`;
        const storedUsages = this._storageService.get(accountKey, -1 /* StorageScope.APPLICATION */);
        let usages = [];
        if (storedUsages) {
            try {
                usages = JSON.parse(storedUsages);
            }
            catch (e) {
                // ignore
            }
        }
        return usages;
    }
    removeAccountUsage(providerId, accountName) {
        const accountKey = `${providerId}-${accountName}-mcpserver-usages`;
        this._storageService.remove(accountKey, -1 /* StorageScope.APPLICATION */);
    }
    addAccountUsage(providerId, accountName, scopes, mcpServerId, mcpServerName) {
        const accountKey = `${providerId}-${accountName}-mcpserver-usages`;
        const usages = this.readAccountUsages(providerId, accountName);
        const existingUsageIndex = usages.findIndex(usage => usage.mcpServerId === mcpServerId);
        if (existingUsageIndex > -1) {
            usages.splice(existingUsageIndex, 1, {
                mcpServerId,
                mcpServerName,
                scopes,
                lastUsed: Date.now()
            });
        }
        else {
            usages.push({
                mcpServerId,
                mcpServerName,
                scopes,
                lastUsed: Date.now()
            });
        }
        this._storageService.store(accountKey, JSON.stringify(usages), -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
        this._mcpServersUsingAuth.add(mcpServerId);
    }
    async _addToCache(providerId) {
        try {
            const accounts = await this._authenticationService.getAccounts(providerId);
            for (const account of accounts) {
                const usage = this.readAccountUsages(providerId, account.label);
                for (const u of usage) {
                    this._mcpServersUsingAuth.add(u.mcpServerId);
                }
            }
        }
        catch (e) {
            this._logService.error(e);
        }
    }
};
AuthenticationMcpUsageService = __decorate([
    __param(0, IStorageService),
    __param(1, IAuthenticationService),
    __param(2, ILogService),
    __param(3, IProductService)
], AuthenticationMcpUsageService);
export { AuthenticationMcpUsageService };
registerSingleton(IAuthenticationMcpUsageService, AuthenticationMcpUsageService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb25NY3BVc2FnZVNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL2F1dGhlbnRpY2F0aW9uL2Jyb3dzZXIvYXV0aGVudGljYXRpb25NY3BVc2FnZVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDeEYsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxnREFBZ0QsQ0FBQztBQUM5RyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQVNyRSxNQUFNLENBQUMsTUFBTSw4QkFBOEIsR0FBRyxlQUFlLENBQWlDLGdDQUFnQyxDQUFDLENBQUM7QUFrQ3pILElBQU0sNkJBQTZCLEdBQW5DLE1BQU0sNkJBQThCLFNBQVEsVUFBVTtJQU01RCxZQUNrQixlQUFpRCxFQUMxQyxzQkFBK0QsRUFDMUUsV0FBeUMsRUFDckMsY0FBK0I7UUFFaEQsS0FBSyxFQUFFLENBQUM7UUFMMEIsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBQ3pCLDJCQUFzQixHQUF0QixzQkFBc0IsQ0FBd0I7UUFDekQsZ0JBQVcsR0FBWCxXQUFXLENBQWE7UUFOL0MsV0FBTSxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7UUFDckIseUJBQW9CLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQVVoRCwyRkFBMkY7UUFDM0YsTUFBTSxvQkFBb0IsR0FBRyxjQUFjLENBQUMsb0JBQW9CLENBQUM7UUFDakUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQztZQUN6QyxLQUFLLE1BQU0sV0FBVyxJQUFJLG9CQUFvQixFQUFFLENBQUM7Z0JBQ2hELElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDNUMsQ0FBQztRQUNGLENBQUM7YUFBTSxJQUFJLG9CQUFvQixFQUFFLENBQUM7WUFDakMsS0FBSyxNQUFNLFVBQVUsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQztnQkFDOUQsS0FBSyxNQUFNLFdBQVcsSUFBSSxVQUFVLEVBQUUsQ0FBQztvQkFDdEMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDNUMsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsbUNBQW1DLENBQzdFLFFBQVEsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQzVCLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUNuQyxDQUNELENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxLQUFLLENBQUMsb0JBQW9CO1FBQ3pCLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsY0FBYyxFQUFFLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMxSSxDQUFDO0lBRUQsS0FBSyxDQUFDLFdBQVcsQ0FBQyxXQUFtQjtRQUNwQyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDN0IsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFRCxpQkFBaUIsQ0FBQyxVQUFrQixFQUFFLFdBQW1CO1FBQ3hELE1BQU0sVUFBVSxHQUFHLEdBQUcsVUFBVSxJQUFJLFdBQVcsbUJBQW1CLENBQUM7UUFDbkUsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsVUFBVSxvQ0FBMkIsQ0FBQztRQUNwRixJQUFJLE1BQU0sR0FBOEIsRUFBRSxDQUFDO1FBQzNDLElBQUksWUFBWSxFQUFFLENBQUM7WUFDbEIsSUFBSSxDQUFDO2dCQUNKLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ25DLENBQUM7WUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUNaLFNBQVM7WUFDVixDQUFDO1FBQ0YsQ0FBQztRQUVELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQUVELGtCQUFrQixDQUFDLFVBQWtCLEVBQUUsV0FBbUI7UUFDekQsTUFBTSxVQUFVLEdBQUcsR0FBRyxVQUFVLElBQUksV0FBVyxtQkFBbUIsQ0FBQztRQUNuRSxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxVQUFVLG9DQUEyQixDQUFDO0lBQ25FLENBQUM7SUFFRCxlQUFlLENBQUMsVUFBa0IsRUFBRSxXQUFtQixFQUFFLE1BQWdCLEVBQUUsV0FBbUIsRUFBRSxhQUFxQjtRQUNwSCxNQUFNLFVBQVUsR0FBRyxHQUFHLFVBQVUsSUFBSSxXQUFXLG1CQUFtQixDQUFDO1FBQ25FLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFFL0QsTUFBTSxrQkFBa0IsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFdBQVcsS0FBSyxXQUFXLENBQUMsQ0FBQztRQUN4RixJQUFJLGtCQUFrQixHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDN0IsTUFBTSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLEVBQUU7Z0JBQ3BDLFdBQVc7Z0JBQ1gsYUFBYTtnQkFDYixNQUFNO2dCQUNOLFFBQVEsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO2FBQ3BCLENBQUMsQ0FBQztRQUNKLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFDWCxXQUFXO2dCQUNYLGFBQWE7Z0JBQ2IsTUFBTTtnQkFDTixRQUFRLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTthQUNwQixDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLG1FQUFrRCxDQUFDO1FBQ2hILElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVPLEtBQUssQ0FBQyxXQUFXLENBQUMsVUFBa0I7UUFDM0MsSUFBSSxDQUFDO1lBQ0osTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQzNFLEtBQUssTUFBTSxPQUFPLElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQ2hDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNoRSxLQUFLLE1BQU0sQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDO29CQUN2QixJQUFJLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDOUMsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNaLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzNCLENBQUM7SUFDRixDQUFDO0NBQ0QsQ0FBQTtBQXRHWSw2QkFBNkI7SUFPdkMsV0FBQSxlQUFlLENBQUE7SUFDZixXQUFBLHNCQUFzQixDQUFBO0lBQ3RCLFdBQUEsV0FBVyxDQUFBO0lBQ1gsV0FBQSxlQUFlLENBQUE7R0FWTCw2QkFBNkIsQ0FzR3pDOztBQUVELGlCQUFpQixDQUFDLDhCQUE4QixFQUFFLDZCQUE2QixvQ0FBNEIsQ0FBQyJ9