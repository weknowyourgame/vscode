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
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter } from '../../../../base/common/event.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { IExtensionGalleryManifestService, ExtensionGalleryServiceUrlConfigKey } from '../../../../platform/extensionManagement/common/extensionGalleryManifest.js';
import { ExtensionGalleryManifestService as ExtensionGalleryManifestService } from '../../../../platform/extensionManagement/common/extensionGalleryManifestService.js';
import { resolveMarketplaceHeaders } from '../../../../platform/externalServices/common/marketplace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ISharedProcessService } from '../../../../platform/ipc/electron-browser/services.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { asJson, IRequestService } from '../../../../platform/request/common/request.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IDefaultAccountService } from '../../accounts/common/defaultAccount.js';
import { IRemoteAgentService } from '../../remote/common/remoteAgentService.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IHostService } from '../../host/browser/host.js';
let WorkbenchExtensionGalleryManifestService = class WorkbenchExtensionGalleryManifestService extends ExtensionGalleryManifestService {
    get extensionGalleryManifestStatus() { return this.currentStatus; }
    constructor(productService, environmentService, fileService, telemetryService, storageService, remoteAgentService, sharedProcessService, configurationService, requestService, defaultAccountService, logService, dialogService, hostService) {
        super(productService);
        this.telemetryService = telemetryService;
        this.configurationService = configurationService;
        this.requestService = requestService;
        this.defaultAccountService = defaultAccountService;
        this.logService = logService;
        this.dialogService = dialogService;
        this.hostService = hostService;
        this.extensionGalleryManifest = null;
        this._onDidChangeExtensionGalleryManifest = this._register(new Emitter());
        this.onDidChangeExtensionGalleryManifest = this._onDidChangeExtensionGalleryManifest.event;
        this.currentStatus = "unavailable" /* ExtensionGalleryManifestStatus.Unavailable */;
        this._onDidChangeExtensionGalleryManifestStatus = this._register(new Emitter());
        this.onDidChangeExtensionGalleryManifestStatus = this._onDidChangeExtensionGalleryManifestStatus.event;
        this.commonHeadersPromise = resolveMarketplaceHeaders(productService.version, productService, environmentService, configurationService, fileService, storageService, telemetryService);
        const channels = [sharedProcessService.getChannel('extensionGalleryManifest')];
        const remoteConnection = remoteAgentService.getConnection();
        if (remoteConnection) {
            channels.push(remoteConnection.getChannel('extensionGalleryManifest'));
        }
        this.getExtensionGalleryManifest().then(manifest => {
            channels.forEach(channel => channel.call('setExtensionGalleryManifest', [manifest]));
        });
    }
    async getExtensionGalleryManifest() {
        if (!this.extensionGalleryManifestPromise) {
            this.extensionGalleryManifestPromise = this.doGetExtensionGalleryManifest();
        }
        await this.extensionGalleryManifestPromise;
        return this.extensionGalleryManifest;
    }
    async doGetExtensionGalleryManifest() {
        const defaultServiceUrl = this.productService.extensionsGallery?.serviceUrl;
        if (!defaultServiceUrl) {
            return;
        }
        const configuredServiceUrl = this.configurationService.getValue(ExtensionGalleryServiceUrlConfigKey);
        if (configuredServiceUrl) {
            await this.handleDefaultAccountAccess(configuredServiceUrl);
            this._register(this.defaultAccountService.onDidChangeDefaultAccount(() => this.handleDefaultAccountAccess(configuredServiceUrl)));
        }
        else {
            const defaultExtensionGalleryManifest = await super.getExtensionGalleryManifest();
            this.update(defaultExtensionGalleryManifest);
        }
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (!e.affectsConfiguration(ExtensionGalleryServiceUrlConfigKey)) {
                return;
            }
            this.requestRestart();
        }));
    }
    async handleDefaultAccountAccess(configuredServiceUrl) {
        const account = await this.defaultAccountService.getDefaultAccount();
        if (!account) {
            this.logService.debug('[Marketplace] Enterprise marketplace configured but user not signed in');
            this.update(null, "requiresSignIn" /* ExtensionGalleryManifestStatus.RequiresSignIn */);
        }
        else if (!this.checkAccess(account)) {
            this.logService.debug('[Marketplace] User signed in but lacks access to enterprise marketplace');
            this.update(null, "accessDenied" /* ExtensionGalleryManifestStatus.AccessDenied */);
        }
        else if (this.currentStatus !== "available" /* ExtensionGalleryManifestStatus.Available */) {
            try {
                const manifest = await this.getExtensionGalleryManifestFromServiceUrl(configuredServiceUrl);
                this.update(manifest);
                this.telemetryService.publicLog2('galleryservice:custom:marketplace');
            }
            catch (error) {
                this.logService.error('[Marketplace] Error retrieving enterprise gallery manifest', error);
                this.update(null, "accessDenied" /* ExtensionGalleryManifestStatus.AccessDenied */);
            }
        }
    }
    update(manifest, status) {
        if (this.extensionGalleryManifest !== manifest) {
            this.extensionGalleryManifest = manifest;
            this._onDidChangeExtensionGalleryManifest.fire(manifest);
        }
        this.updateStatus(status ?? (this.extensionGalleryManifest ? "available" /* ExtensionGalleryManifestStatus.Available */ : "unavailable" /* ExtensionGalleryManifestStatus.Unavailable */));
    }
    updateStatus(status) {
        if (this.currentStatus !== status) {
            this.currentStatus = status;
            this._onDidChangeExtensionGalleryManifestStatus.fire(status);
        }
    }
    checkAccess(account) {
        this.logService.debug('[Marketplace] Checking Account SKU access for configured gallery', account.access_type_sku);
        if (account.access_type_sku && this.productService.extensionsGallery?.accessSKUs?.includes(account.access_type_sku)) {
            this.logService.debug('[Marketplace] Account has access to configured gallery');
            return true;
        }
        this.logService.debug('[Marketplace] Checking enterprise account access for configured gallery', account.enterprise);
        return account.enterprise;
    }
    async requestRestart() {
        const confirmation = await this.dialogService.confirm({
            message: localize('extensionGalleryManifestService.accountChange', "{0} is now configured to a different Marketplace. Please restart to apply the changes.", this.productService.nameLong),
            primaryButton: localize({ key: 'restart', comment: ['&& denotes a mnemonic'] }, "&&Restart")
        });
        if (confirmation.confirmed) {
            return this.hostService.restart();
        }
    }
    async getExtensionGalleryManifestFromServiceUrl(url) {
        const commonHeaders = await this.commonHeadersPromise;
        const headers = {
            ...commonHeaders,
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip',
        };
        try {
            const context = await this.requestService.request({
                type: 'GET',
                url,
                headers,
            }, CancellationToken.None);
            const extensionGalleryManifest = await asJson(context);
            if (!extensionGalleryManifest) {
                throw new Error('Unable to retrieve extension gallery manifest.');
            }
            return extensionGalleryManifest;
        }
        catch (error) {
            this.logService.error('[Marketplace] Error retrieving extension gallery manifest', error);
            throw error;
        }
    }
};
WorkbenchExtensionGalleryManifestService = __decorate([
    __param(0, IProductService),
    __param(1, IEnvironmentService),
    __param(2, IFileService),
    __param(3, ITelemetryService),
    __param(4, IStorageService),
    __param(5, IRemoteAgentService),
    __param(6, ISharedProcessService),
    __param(7, IConfigurationService),
    __param(8, IRequestService),
    __param(9, IDefaultAccountService),
    __param(10, ILogService),
    __param(11, IDialogService),
    __param(12, IHostService)
], WorkbenchExtensionGalleryManifestService);
export { WorkbenchExtensionGalleryManifestService };
registerSingleton(IExtensionGalleryManifestService, WorkbenchExtensionGalleryManifestService, 0 /* InstantiationType.Eager */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9lbGVjdHJvbi1icm93c2VyL2V4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDNUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRTNELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUM3RixPQUFPLEVBQUUsZ0NBQWdDLEVBQTZCLG1DQUFtQyxFQUFrQyxNQUFNLDZFQUE2RSxDQUFDO0FBQy9OLE9BQU8sRUFBRSwrQkFBK0IsSUFBSSwrQkFBK0IsRUFBRSxNQUFNLG9GQUFvRixDQUFDO0FBQ3hLLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ3hHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMxRSxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDOUYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN4RixPQUFPLEVBQUUsTUFBTSxFQUFFLGVBQWUsRUFBRSxNQUFN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