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
import { memoize } from '../../../base/common/decorators.js';
import { join } from '../../../base/common/path.js';
import { isLinux } from '../../../base/common/platform.js';
import { createStaticIPCHandle } from '../../../base/parts/ipc/node/ipc.net.js';
import { IEnvironmentService } from '../common/environment.js';
import { NativeEnvironmentService } from '../node/environmentService.js';
import { refineServiceDecorator } from '../../instantiation/common/instantiation.js';
export const IEnvironmentMainService = refineServiceDecorator(IEnvironmentService);
export class EnvironmentMainService extends NativeEnvironmentService {
    constructor() {
        super(...arguments);
        this._snapEnv = {};
    }
    get backupHome() { return join(this.userDataPath, 'Backups'); }
    get mainIPCHandle() { return createStaticIPCHandle(this.userDataPath, 'main', this.productService.version); }
    get mainLockfile() { return join(this.userDataPath, 'code.lock'); }
    get disableUpdates() { return !!this.args['disable-updates']; }
    get crossOriginIsolated() { return !!this.args['enable-coi']; }
    get enableRDPDisplayTracking() { return !!this.args['enable-rdp-display-tracking']; }
    get codeCachePath() { return process.env['VSCODE_CODE_CACHE_PATH'] || undefined; }
    get useCodeCache() { return !!this.codeCachePath; }
    unsetSnapExportedVariables() {
        if (!isLinux) {
            return;
        }
        for (const key in process.env) {
            if (key.endsWith('_VSCODE_SNAP_ORIG')) {
                const originalKey = key.slice(0, -17); // Remove the _VSCODE_SNAP_ORIG suffix
                if (this._snapEnv[originalKey]) {
                    continue;
                }
                // Preserve the original value in case the snap env is re-entered
                if (process.env[originalKey]) {
                    this._snapEnv[originalKey] = process.env[originalKey];
                }
                // Copy the original value from before entering the snap env if available,
                // if not delete the env variable.
                if (process.env[key]) {
                    process.env[originalKey] = process.env[key];
                }
                else {
                    delete process.env[originalKey];
                }
            }
        }
    }
    restoreSnapExportedVariables() {
        if (!isLinux) {
            return;
        }
        for (const key in this._snapEnv) {
            process.env[key] = this._snapEnv[key];
            delete this._snapEnv[key];
        }
    }
}
__decorate([
    memoize
], EnvironmentMainService.prototype, "backupHome", null);
__decorate([
    memoize
], EnvironmentMainService.prototype, "mainIPCHandle", null);
__decorate([
    memoize
], EnvironmentMainService.prototype, "mainLockfile", null);
__decorate([
    memoize
], EnvironmentMainService.prototype, "disableUpdates", null);
__decorate([
    memoize
], EnvironmentMainService.prototype, "crossOriginIsolated", null);
__decorate([
    memoize
], EnvironmentMainService.prototype, "enableRDPDisplayTracking", null);
__decorate([
    memoize
], EnvironmentMainService.prototype, "codeCachePath", null);
__decorate([
    memoize
], EnvironmentMainService.prototype, "useCodeCache", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnRNYWluU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9lbnZpcm9ubWVudC9lbGVjdHJvbi1tYWluL2Vudmlyb25tZW50TWFpblNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDM0QsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDaEYsT0FBTyxFQUFFLG1CQUFtQixFQUE2QixNQUFNLDBCQUEwQixDQUFDO0FBQzFGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3pFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRXJGLE1BQU0sQ0FBQyxNQUFNLHVCQUF1QixHQUFHLHNCQUFzQixDQUErQyxtQkFBbUIsQ0FBQyxDQUFDO0FBNkJqSSxNQUFNLE9BQU8sc0JBQXVCLFNBQVEsd0JBQXdCO0lBQXBFOztRQUVTLGFBQVEsR0FBMkIsRUFBRSxDQUFDO0lBNEQvQyxDQUFDO0lBekRBLElBQUksVUFBVSxLQUFhLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBR3ZFLElBQUksYUFBYSxLQUFhLE9BQU8scUJBQXFCLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFHckgsSUFBSSxZQUFZLEtBQWEsT0FBTyxJQUFJLENBQUMs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