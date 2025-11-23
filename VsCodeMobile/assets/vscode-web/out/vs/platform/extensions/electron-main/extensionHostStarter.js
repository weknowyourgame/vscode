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
var ExtensionHostStarter_1;
import { Promises } from '../../../base/common/async.js';
import { canceled } from '../../../base/common/errors.js';
import { Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { ILifecycleMainService } from '../../lifecycle/electron-main/lifecycleMainService.js';
import { ILogService } from '../../log/common/log.js';
import { ITelemetryService } from '../../telemetry/common/telemetry.js';
import { WindowUtilityProcess } from '../../utilityProcess/electron-main/utilityProcess.js';
import { IWindowsMainService } from '../../windows/electron-main/windows.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
let ExtensionHostStarter = class ExtensionHostStarter extends Disposable {
    static { ExtensionHostStarter_1 = this; }
    static { this._lastId = 0; }
    constructor(_logService, _lifecycleMainService, _windowsMainService, _telemetryService, _configurationService) {
        super();
        this._logService = _logService;
        this._lifecycleMainService = _lifecycleMainService;
        this._windowsMainService = _windowsMainService;
        this._telemetryService = _telemetryService;
        this._configurationService = _configurationService;
        this._extHosts = new Map();
        this._shutdown = false;
        // On shutdown: gracefully await extension host shutdowns
        this._register(this._lifecycleMainService.onWillShutdown(e => {
            this._shutdown = true;
            e.join('extHostStarter', this._waitForAllExit(6000));
        }));
    }
    dispose() {
        // Intentionally not killing the extension host processes
        super.dispose();
    }
    _getExtHost(id) {
        const extHostProcess = this._extHosts.get(id);
        if (!extHostProcess) {
            throw new Error(`Unknown extension host!`);
        }
        return extHostProcess;
    }
    onDynamicStdout(id) {
        return this._getExtHost(id).onStdout;
    }
    onDynamicStderr(id) {
        return this._getExtHost(id).onStderr;
    }
    onDynamicMessage(id) {
        return this._getExtHost(id).onMessage;
    }
    onDynamicExit(id) {
        return this._getExtHost(id).onExit;
    }
    async createExtensionHost() {
        if (this._shutdown) {
            throw canceled();
        }
        const id = String(++ExtensionHostStarter_1._lastId);
        const extHost = new WindowUtilityProcess(this._logService, this._windowsMainService, this._telemetryService, this._lifecycleMainService);
        this._extHosts.set(id, extHost);
        const disposable = extHost.onExit(({ pid, code, signal }) => {
            disposable.dispose();
            this._logService.info(`Extension host with pid ${pid} exited with code: ${code}, signal: ${signal}.`);
            setTimeout(() => {
                extHost.dispose();
                this._extHosts.delete(id);
            });
            // See https://github.com/microsoft/vscode/issues/194477
            // We have observed that sometimes the process sends an exit
            // event, but does not really exit and is stuck in an endless
            // loop. In these cases we kill the process forcefully after
            // a certain timeout.
            setTimeout(() => {
                try {
                    process.kill(pid, 0); // will throw if the process doesn't exist anymore.
                    this._logService.error(`Extension host with pid ${pid} still exists, forcefully killing it...`);
                    process.kill(pid);
                }
                catch (er) {
                    // ignore, as the process is already gone
                }
            }, 1000);
        });
        return { id };
    }
    async start(id, opts) {
        if (this._shutdown) {
            throw canceled();
        }
        const extHost = this._getExtHost(id);
        const args = ['--skipWorkspaceStorageLock'];
        if (this._configurationService.getValue('extensions.supportNodeGlobalNavigator')) {
            args.push('--supportGlobalNavigator');
        }
        extHost.start({
            ...opts,
            type: 'extensionHost',
            name: 'extension-host',
            entryPoint: 'vs/workbench/api/node/extensionHostProcess',
            args,
            execArgv: opts.execArgv,
            allowLoadingUnsignedLibraries: true,
            respondToAuthRequestsFromMainProcess: true,
            correlationId: id
        });
        const pid = await Event.toPromise(extHost.onSpawn);
        return { pid };
    }
    async enableInspectPort(id) {
        if (this._shutdown) {
            throw canceled();
        }
        const extHostProcess = this._extHosts.get(id);
        if (!extHostProcess) {
            return false;
        }
        return extHostProcess.enableInspectPort();
    }
    async kill(id) {
        if (this._shutdown) {
            throw canceled();
        }
        const extHostProcess = this._extHosts.get(id);
        if (!extHostProcess) {
            // already gone!
            return;
        }
        extHostProcess.kill();
    }
    async _killAllNow() {
        for (const [, extHost] of this._extHosts) {
            extHost.kill();
        }
    }
    async _waitForAllExit(maxWaitTimeMs) {
        const exitPromises = [];
        for (const [, extHost] of this._extHosts) {
            exitPromises.push(extHost.waitForExit(maxWaitTimeMs));
        }
        return Promises.settled(exitPromises).then(() => { });
    }
};
ExtensionHostStarter = ExtensionHostStarter_1 = __decorate([
    __param(0, ILogService),
    __param(1, ILifecycleMainService),
    __param(2, IWindowsMainService),
    __param(3, ITelemetryService),
    __param(4, IConfigurationService)
], ExtensionHostStarter);
export { ExtensionHostStarter };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uSG9zdFN0YXJ0ZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vZXh0ZW5zaW9ucy9lbGVjdHJvbi1tYWluL2V4dGVuc2lvbkhvc3RTdGFydGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDekQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RCxPQUFPLEVBQUUsVUFBVSxFQUFlLE1BQU0sbUNBQW1DLENBQUM7QUFFNUUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDOUYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ3RELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzVGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRTdFLElBQU0sb0JBQW9CLEdBQTFCLE1BQU0sb0JBQXFCLFNBQVEsVUFBVTs7YUFJcEMsWUFBTyxHQUFXLENBQUMsQUFBWixDQUFhO0lBS25DLFlBQ2MsV0FBeUMsRUFDL0IscUJBQTZELEVBQy9ELG1CQUF5RCxFQUMzRCxpQkFBcUQsRUFDakQscUJBQTZEO1FBRXBGLEtBQUssRUFBRSxDQUFDO1FBTnNCLGdCQUFXLEdBQVgsV0FBVyxDQUFhO1FBQ2QsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtRQUM5Qyx3QkFBbUIsR0FBbkIs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