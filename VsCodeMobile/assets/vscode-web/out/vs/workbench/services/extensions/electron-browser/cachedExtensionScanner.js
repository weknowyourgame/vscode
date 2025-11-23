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
import * as platform from '../../../../base/common/platform.js';
import { dedupExtensions } from '../common/extensionsUtil.js';
import { IExtensionsScannerService, toExtensionDescription as toExtensionDescriptionFromScannedExtension } from '../../../../platform/extensionManagement/common/extensionsScannerService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import Severity from '../../../../base/common/severity.js';
import { localize } from '../../../../nls.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IHostService } from '../../host/browser/host.js';
import { timeout } from '../../../../base/common/async.js';
import { IUserDataProfileService } from '../../userDataProfile/common/userDataProfile.js';
import { getErrorMessage } from '../../../../base/common/errors.js';
import { IWorkbenchExtensionManagementService } from '../../extensionManagement/common/extensionManagement.js';
import { toExtensionDescription } from '../common/extensions.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
let CachedExtensionScanner = class CachedExtensionScanner {
    constructor(_notificationService, _hostService, _extensionsScannerService, _userDataProfileService, _extensionManagementService, _environmentService, _logService) {
        this._notificationService = _notificationService;
        this._hostService = _hostService;
        this._extensionsScannerService = _extensionsScannerService;
        this._userDataProfileService = _userDataProfileService;
        this._extensionManagementService = _extensionManagementService;
        this._environmentService = _environmentService;
        this._logService = _logService;
        this.scannedExtensions = new Promise((resolve, reject) => {
            this._scannedExtensionsResolve = resolve;
            this._scannedExtensionsReject = reject;
        });
    }
    async startScanningExtensions() {
        try {
            const extensions = await this._scanInstalledExtensions();
            this._scannedExtensionsResolve(extensions);
        }
        catch (err) {
            this._scannedExtensionsReject(err);
        }
    }
    async _scanInstalledExtensions() {
        try {
            const language = platform.language;
            const result = await Promise.allSettled([
                this._extensionsScannerService.scanSystemExtensions({ language, checkControlFile: true }),
                this._extensionsScannerService.scanUserExtensions({ language, profileLocation: this._userDataProfileService.currentProfile.extensionsResource, useCache: true }),
                this._environmentService.remoteAuthority ? [] : this._extensionManagementService.getInstalledWorkspaceExtensions(false)
            ]);
            let hasErrors = false;
            let scannedSystemExtensions = [];
            if (result[0].status === 'fulfilled') {
                scannedSystemExtensions = result[0].value;
            }
            else {
                hasErrors = true;
                this._logService.error(`Error scanning system extensions:`, getErrorMessage(result[0].reason));
            }
            let scannedUserExtensions = [];
            if (result[1].status === 'fulfilled') {
                scannedUserExtensions = result[1].value;
            }
            else {
                hasErrors = true;
                this._logService.error(`Error scanning user extensions:`, getErrorMessage(result[1].reason));
            }
            let workspaceExtensions = [];
            if (result[2].status === 'fulfilled') {
                workspaceExtensions = result[2].value;
            }
            else {
                hasErrors = true;
                this._logService.error(`Error scanning workspace extensions:`, getErrorMessage(result[2].reason));
            }
            const scannedDevelopedExtensions = [];
            try {
                const allScannedDevelopedExtensions = await this._extensionsScannerService.scanExtensionsUnderDevelopment([...scannedSystemExtensions, ...scannedUserExtensions], { language, includeInvalid: true });
                const invalidExtensions = [];
                for (const extensionUnderDevelopment of allScannedDevelopedExtensions) {
                    if (extensionUnderDevelopment.isValid) {
                        scannedDevelopedExtensions.push(extensionUnderDevelopment);
                    }
                    else {
                        invalidExtensions.push(extensionUnderDevelopment);
                    }
                }
                if (invalidExtensions.length > 0) {
                    this._notificationService.prompt(Severity.Warning, invalidExtensions.length === 1
                        ? localize('extensionUnderDevelopment.invalid', "Failed loading extension '{0}' under development because it is invalid: {1}", invalidExtensions[0].location.fsPath, invalidExtensions[0].validations[0][1])
                        : localize('extensionsUnderDevelopment.invalid', "Failed loading extensions {0} under development because they are invalid: {1}", invalidExtensions.map(ext => `'${ext.location.fsPath}'`).join(', '), invalidExtensions.map(ext => `${ext.validations[0][1]}`).join(', ')), []);
                }
            }
            catch (error) {
                this._logService.error(error);
            }
            const system = scannedSystemExtensions.map(e => toExtensionDescriptionFromScannedExtension(e, false));
            const user = scannedUserExtensions.map(e => toExtensionDescriptionFromScannedExtension(e, false));
            const workspace = workspaceExtensions.map(e => toExtensionDescription(e, false));
            const development = scannedDevelopedExtensions.map(e => toExtensionDescriptionFromScannedExtension(e, true));
            const r = dedupExtensions(system, user, workspace, development, this._logService);
            if (!hasErrors) {
                const disposable = this._extensionsScannerService.onDidChangeCache(() => {
                    disposable.dispose();
                    this._notificationService.prompt(Severity.Error, localize('extensionCache.invalid', "Extensions have been modified on disk. Please reload the window."), [{
                            label: localize('reloadWindow', "Reload Window"),
                            run: () => this._hostService.reload()
                        }]);
                });
                timeout(5000).then(() => disposable.dispose());
            }
            return r;
        }
        catch (err) {
            this._logService.error(`Error scanning installed extensions:`);
            this._logService.error(err);
            return [];
        }
    }
};
CachedExtensionScanner = __decorate([
    __param(0, INotificationService),
    __param(1, IHostService),
    __param(2, IExtensionsScannerService),
    __param(3, IUserDataProfileService),
    __param(4, IWorkbenchExtensionManagementService),
    __param(5, IWorkbenchEnvironmentService),
    __param(6, ILogService)
], CachedExtensionScanner);
export { CachedExtensionScanner };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGVkRXh0ZW5zaW9uU2Nhbm5lci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9ucy9lbGVjdHJvbi1icm93c2VyL2NhY2hlZEV4dGVuc2lvblNjYW5uZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLFFBQVEsTUFBTSxxQ0FBcUMsQ0FBQztBQUVoRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDOUQsT0FBTyxFQUFFLHlCQUF5QixFQUFxQixzQkFBc0IsSUFBSSwwQ0FBMEMsRUFBRSxNQUFNLDZFQUE2RSxDQUFDO0FBQ2pOLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLFFBQVEsTUFBTSxxQ0FBcUMsQ0FBQztBQUMzRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDaEcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQzFELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDcEUsT0FBTyxFQUFFLG9DQUFvQyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDakUsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFFdkYsSUFBTSxzQkFBc0IsR0FBNUIsTUFBTSxzQkFBc0I7SUFNbEMsWUFD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