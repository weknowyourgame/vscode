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
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
export const IAuthenticationAccessService = createDecorator('IAuthenticationAccessService');
// TODO@TylerLeonhardt: Move this class to MainThreadAuthentication
// TODO@TylerLeonhardt: Should this class only keep track of allowed things and throw away disallowed ones?
let AuthenticationAccessService = class AuthenticationAccessService extends Disposable {
    constructor(_storageService, _productService) {
        super();
        this._storageService = _storageService;
        this._productService = _productService;
        this._onDidChangeExtensionSessionAccess = this._register(new Emitter());
        this.onDidChangeExtensionSessionAccess = this._onDidChangeExtensionSessionAccess.event;
    }
    isAccessAllowed(providerId, accountName, extensionId) {
        const trustedExtensionAuthAccess = this._productService.trustedExtensionAuthAccess;
        const extensionKey = ExtensionIdentifier.toKey(extensionId);
        if (Array.isArray(trustedExtensionAuthAccess)) {
            if (trustedExtensionAuthAccess.includes(extensionKey)) {
                return true;
            }
        }
        else if (trustedExtensionAuthAccess?.[providerId]?.includes(extensionKey)) {
            return true;
        }
        const allowList = this.readAllowedExtensions(providerId, accountName);
        const extensionData = allowList.find(extension => extension.id === extensionKey);
        if (!extensionData) {
            return undefined;
        }
        // This property didn't exist on this data previously, inclusion in the list at all indicates allowance
        return extensionData.allowed !== undefined
            ? extensionData.allowed
            : true;
    }
    readAllowedExtensions(providerId, accountName) {
        let trustedExtensions = [];
        try {
            const trustedExtensionSrc = this._storageService.get(`${providerId}-${accountName}`, -1 /* StorageScope.APPLICATION */);
            if (trustedExtensionSrc) {
                trustedExtensions = JSON.parse(trustedExtensionSrc);
            }
        }
        catch (err) { }
        // Add trusted extensions from product.json if they're not already in the list
        const trustedExtensionAuthAccess = this._productService.trustedExtensionAuthAccess;
        const trustedExtensionIds = 
        // Case 1: trustedExtensionAuthAccess is an array
        Array.isArray(trustedExtensionAuthAccess)
            ? trustedExtensionAuthAccess
            // Case 2: trustedExtensionAuthAccess is an object
            : typeof trustedExtensionAuthAccess === 'object'
                ? trustedExtensionAuthAccess[providerId] ?? []
                : [];
        for (const extensionId of trustedExtensionIds) {
            const extensionKey = ExtensionIdentifier.toKey(extensionId);
            const existingExtension = trustedExtensions.find(extension => extension.id === extensionKey);
            if (!existingExtension) {
                // Add new trusted extension (name will be set by caller if they have extension info)
                trustedExtensions.push({
                    id: extensionKey,
                    name: extensionId, // Use original casing for display name
                    allowed: true,
                    trusted: true
                });
            }
            else {
                // Update existing extension to be trusted
                existingExtension.allowed = true;
                existingExtension.trusted = true;
            }
        }
        return trustedExtensions;
    }
    updateAllowedExtensions(providerId, accountName, extensions) {
        const allowList = this.readAllowedExtensions(providerId, accountName);
        for (const extension of extensions) {
            const extensionKey = ExtensionIdentifier.toKey(extension.id);
            const index = allowList.findIndex(e => e.id === extensionKey);
            if (index === -1) {
                allowList.push({
                    ...extension,
                    id: extensionKey
                });
            }
            else {
                allowList[index].allowed = extension.allowed;
                // Update name if provided and not already set to a proper name
                if (extension.name && extension.name !== extensionKey && allowList[index].name !== extension.name) {
                    allowList[index].name = extension.name;
                }
            }
        }
        // Filter out trusted extensions before storing - they should only come from product.json, not user storage
        const userManagedExtensions = allowList.filter(extension => !extension.trusted);
        this._storageService.store(`${providerId}-${accountName}`, JSON.stringify(userManagedExtensions), -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
        this._onDidChangeExtensionSessionAccess.fire({ providerId, accountName });
    }
    removeAllowedExtensions(providerId, accountName) {
        this._storageService.remove(`${providerId}-${accountName}`, -1 /* StorageScope.APPLICATION */);
        this._onDidChangeExtensionSessionAccess.fire({ providerId, accountName });
    }
};
AuthenticationAccessService = __decorate([
    __param(0, IStorageService),
    __param(1, IProductService)
], AuthenticationAccessService);
export { AuthenticationAccessService };
registerSingleton(IAuthenticationAccessService, AuthenticationAccessService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb25BY2Nlc3NTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9hdXRoZW50aWNhdGlvbi9icm93c2VyL2F1dGhlbnRpY2F0aW9uQWNjZXNzU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzNGLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDN0YsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sZ0RBQWdELENBQUM7QUFHOUcsTUFBTSxDQUFDLE1BQU0sNEJBQTRCLEdBQUcsZUFBZSxDQUErQiw4QkFBOEIsQ0FBQyxDQUFDO0FBb0IxSCxtRUFBbUU7QUFDbkUsMkdBQTJHO0FBQ3BHLElBQU0sMkJBQTJCLEdBQWpDLE1BQU0sMkJBQTRCLFNBQVEsVUFBVTtJQU0xRCxZQUNrQixlQUFpRCxFQUNqRCxlQUFpRDtRQUVsRSxLQUFLLEVBQUUsQ0FBQztRQUgwQixvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUFDaEMsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBTDNELHVDQUFrQyxHQUF5RCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUErQyxDQUFDLENBQUM7UUFDckssc0NBQWlDLEdBQXVELElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxLQUFLLENBQUM7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