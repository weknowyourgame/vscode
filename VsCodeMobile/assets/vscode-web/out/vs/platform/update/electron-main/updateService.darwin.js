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
import * as electron from 'electron';
import { memoize } from '../../../base/common/decorators.js';
import { Event } from '../../../base/common/event.js';
import { hash } from '../../../base/common/hash.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IEnvironmentMainService } from '../../environment/electron-main/environmentMainService.js';
import { ILifecycleMainService } from '../../lifecycle/electron-main/lifecycleMainService.js';
import { ILogService } from '../../log/common/log.js';
import { IProductService } from '../../product/common/productService.js';
import { IRequestService } from '../../request/common/request.js';
import { ITelemetryService } from '../../telemetry/common/telemetry.js';
import { State } from '../common/update.js';
import { AbstractUpdateService, createUpdateURL } from './abstractUpdateService.js';
let DarwinUpdateService = class DarwinUpdateService extends AbstractUpdateService {
    get onRawError() { return Event.fromNodeEventEmitter(electron.autoUpdater, 'error', (_, message) => message); }
    get onRawUpdateNotAvailable() { return Event.fromNodeEventEmitter(electron.autoUpdater, 'update-not-available'); }
    get onRawUpdateAvailable() { return Event.fromNodeEventEmitter(electron.autoUpdater, 'update-available'); }
    get onRawUpdateDownloaded() { return Event.fromNodeEventEmitter(electron.autoUpdater, 'update-downloaded', (_, releaseNotes, version, timestamp) => ({ version, productVersion: version, timestamp })); }
    constructor(lifecycleMainService, configurationService, telemetryService, environmentMainService, requestService, logService, productService) {
        super(lifecycleMainService, configurationService, environmentMainService, requestService, logService, productService);
        this.telemetryService = telemetryService;
        this.disposables = new DisposableStore();
        lifecycleMainService.setRelaunchHandler(this);
    }
    handleRelaunch(options) {
        if (options?.addArgs || options?.removeArgs) {
            return false; // we cannot apply an update and restart with different args
        }
        if (this.state.type !== "ready" /* StateType.Ready */) {
            return false; // we only handle the relaunch when we have a pending update
        }
        this.logService.trace('update#handleRelaunch(): running raw#quitAndInstall()');
        this.doQuitAndInstall();
        return true;
    }
    async initialize() {
        await super.initialize();
        this.onRawError(this.onError, this, this.disposables);
        this.onRawUpdateAvailable(this.onUpdateAvailable, this, this.disposables);
        this.onRawUpdateDownloaded(this.onUpdateDownloaded, this, this.disposables);
        this.onRawUpdateNotAvailable(this.onUpdateNotAvailable, this, this.disposables);
    }
    onError(err) {
        this.telemetryService.publicLog2('update:error', { messageHash: String(hash(String(err))) });
        this.logService.error('UpdateService error:', err);
        // only show message when explicitly checking for updates
        const message = (this.state.type === "checking for updates" /* StateType.CheckingForUpdates */ && this.state.explicit) ? err : undefined;
        this.setState(State.Idle(1 /* UpdateType.Archive */, message));
    }
    buildUpdateFeedUrl(quality) {
        let assetID;
        if (!this.productService.darwinUniversalAssetId) {
            assetID = process.arch === 'x64' ? 'darwin' : 'darwin-arm64';
        }
        else {
            assetID = this.productService.darwinUniversalAssetId;
        }
        const url = createUpdateURL(assetID, quality, this.productService);
        try {
            electron.autoUpdater.setFeedURL({ url });
        }
        catch (e) {
            // application is very likely not signed
            this.logService.error('Failed to set update feed URL', e);
            return undefined;
        }
        return url;
    }
    doCheckForUpdates(explicit) {
        if (!this.url) {
            return;
        }
        this.setState(State.CheckingForUpdates(explicit));
        const url = explicit ? this.url : `${this.url}?bg=true`;
        electron.autoUpdater.setFeedURL({ url });
        electron.autoUpdater.checkForUpdates();
    }
    onUpdateAvailable() {
        if (this.state.type !== "checking for updates" /* StateType.CheckingForUpdates */) {
            return;
        }
        this.setState(State.Downloading);
    }
    onUpdateDownloaded(update) {
        if (this.state.type !== "downloading" /* StateType.Downloading */) {
            return;
        }
        this.setState(State.Downloaded(update));
        this.telemetryService.publicLog2('update:downloaded', { newVersion: update.version });
        this.setState(State.Ready(update));
    }
    onUpdateNotAvailable() {
        if (this.state.type !== "checking for updates" /* StateType.CheckingForUpdates */) {
            return;
        }
        this.setState(State.Idle(1 /* UpdateType.Archive */));
    }
    doQuitAndInstall() {
        this.logService.trace('update#quitAndInstall(): running raw#quitAndInstall()');
        electron.autoUpdater.quitAndInstall();
    }
    dispose() {
        this.disposables.dispose();
    }
};
__decorate([
    memoize
], DarwinUpdateService.prototype, "onRawError", null);
__decorate([
    memoize
], DarwinUpdateService.prototype, "onRawUpdateNotAvailable", null);
__decorate([
    memoize
], DarwinUpdateService.prototype, "onRawUpdateAvailable", null);
__decorate([
    memoize
], DarwinUpdateService.prototype, "onRawUpdateDownloaded", null);
DarwinUpdateService = __decorate([
    __param(0, ILifecycleMainService),
    __param(1, IConfigurationService),
    __param(2, ITelemetryService),
    __param(3, IEnvironmentMainService),
    __param(4, IRequestService),
    __param(5, ILogService),
    __param(6, IProductService)
], DarwinUpdateService);
export { DarwinUpdateService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBkYXRlU2VydmljZS5kYXJ3aW4uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vdXBkYXRlL2VsZWN0cm9uLW1haW4vdXBkYXRlU2VydmljZS5kYXJ3aW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLFFBQVEsTUFBTSxVQUFVLENBQUM7QUFDckMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RCxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDcEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxxQkFBcUIsRUFBc0MsTUFBTSx1REFBdUQsQ0FBQztBQUNsSSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDdEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN4RSxPQUFPLEVBQVcsS0FBSyxFQUF5QixNQUFNLHFCQUFxQixDQUFDO0FBQzVFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxlQUFlLEVBQTZCLE1BQU0sNEJBQTRCLENBQUM7QUFFeEcsSUFBTSxtQkFBbUIsR0FBekIsTUFBTSxtQkFBb0IsU0FBUSxxQkFBcUI7SUFJcEQsSUFBWSxVQUFVLEtBQW9CLE9B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