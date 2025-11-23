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
import { validatedIpcMain } from '../../../base/parts/ipc/electron-main/ipcMain.js';
import { Barrier, DeferredPromise } from '../../../base/common/async.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { IEnvironmentMainService } from '../../environment/electron-main/environmentMainService.js';
import { ILifecycleMainService } from '../../lifecycle/electron-main/lifecycleMainService.js';
import { ILogService } from '../../log/common/log.js';
import { IUserDataProfilesService } from '../../userDataProfile/common/userDataProfile.js';
import { IPolicyService } from '../../policy/common/policy.js';
import { ILoggerMainService } from '../../log/electron-main/loggerService.js';
import { UtilityProcess } from '../../utilityProcess/electron-main/utilityProcess.js';
import { NullTelemetryService } from '../../telemetry/common/telemetryUtils.js';
import { parseSharedProcessDebugPort } from '../../environment/node/environmentService.js';
import { assertReturnsDefined } from '../../../base/common/types.js';
import { SharedProcessChannelConnection, SharedProcessRawConnection, SharedProcessLifecycle } from '../common/sharedProcess.js';
import { Emitter } from '../../../base/common/event.js';
let SharedProcess = class SharedProcess extends Disposable {
    constructor(machineId, sqmId, devDeviceId, environmentMainService, userDataProfilesService, lifecycleMainService, logService, loggerMainService, policyService) {
        super();
        this.machineId = machineId;
        this.sqmId = sqmId;
        this.devDeviceId = devDeviceId;
        this.environmentMainService = environmentMainService;
        this.userDataProfilesService = userDataProfilesService;
        this.lifecycleMainService = lifecycleMainService;
        this.logService = logService;
        this.loggerMainService = loggerMainService;
        this.policyService = policyService;
        this.firstWindowConnectionBarrier = new Barrier();
        this.utilityProcess = undefined;
        this.utilityProcessLogListener = undefined;
        this._onDidCrash = this._register(new Emitter());
        this.onDidCrash = this._onDidCrash.event;
        this._whenReady = undefined;
        this._whenIpcReady = undefined;
        this.registerListeners();
    }
    registerListeners() {
        // Shared process channel connections from workbench windows
        validatedIpcMain.on(SharedProcessChannelConnection.request, (e, nonce) => this.onWindowConnection(e, nonce, SharedProcessChannelConnection.response));
        // Shared process raw connections from workbench windows
        validatedIpcMain.on(SharedProcessRawConnection.request, (e, nonce) => this.onWindowConnection(e, nonce, SharedProcessRawConnection.response));
        // Lifecycle
        this._register(this.lifecycleMainService.onWillShutdown(() => this.onWillShutdown()));
    }
    async onWindowConnection(e, nonce, responseChannel) {
        this.logService.trace(`[SharedProcess] onWindowConnection for: ${responseChannel}`);
        // release barrier if this is the first window connection
        if (!this.firstWindowConnectionBarrier.isOpen()) {
            this.firstWindowConnectionBarrier.open();
        }
        // await the shared process to be overall ready
        // we do not just wait for IPC ready because the
        // workbench window will communicate directly
        await this.whenReady();
        // connect to the shared process passing the responseChannel
        // as payload to give a hint what the connection is about
        const port = await this.connect(responseChannel);
        // Check back if the requesting window meanwhile closed
        // Since shared process is delayed on startup there is
        // a chance that the window close before the shared process
        // was ready for a connection.
        if (e.sender.isDestroyed()) {
            return port.close();
        }
        // send the port back to the requesting window
        e.sender.postMessage(responseChannel, nonce, [port]);
    }
    onWillShutdown() {
        this.logService.trace('[SharedProcess] onWillShutdown');
        this.utilityProcess?.postMessage(SharedProcessLifecycle.exit);
        this.utilityProcess = undefined;
    }
    whenReady() {
        if (!this._whenReady) {
            this._whenReady = (async () => {
                // Wait for shared process being ready to accept connection
                await this.whenIpcReady;
                // Overall signal that the shared process was loaded and
                // all services within have been created.
                const whenReady = new DeferredPromise();
                this.utilityProcess?.once(SharedProcessLifecycle.initDone, () => whenReady.complete());
                await whenReady.p;
                this.utilityProcessLogListener?.dispose();
                this.logService.trace('[SharedProcess] Overall ready');
            })();
        }
        return this._whenReady;
    }
    get whenIpcReady() {
        if (!this._whenIpcReady) {
            this._whenIpcReady = (async () => {
                // Always wait for first window asking for connection
                await this.firstWindowConnectionBarrier.wait();
                // Spawn shared process
                this.createUtilityProcess();
                // Wait for shared process indicating that IPC connections are accepted
                const sharedProcessIpcReady = new DeferredPromise();
                this.utilityProcess?.once(SharedProcessLifecycle.ipcReady, () => sharedProcessIpcReady.complete());
                await sharedProcessIpcReady.p;
                this.logService.trace('[SharedProcess] IPC ready');
            })();
        }
        return this._whenIpcReady;
    }
    createUtilityProcess() {
        this.utilityProcess = this._register(new UtilityProcess(this.logService, NullTelemetryService, this.lifecycleMainService));
        // Install a log listener for very early shared process warnings and errors
        this.utilityProcessLogListener = this.utilityProcess.onMessage(e => {
            const logValue = e;
            if (typeof logValue.warning === 'string') {
                this.logService.warn(logValue.warning);
            }
            else if (typeof logValue.error === 'string') {
                this.logService.error(logValue.error);
            }
        });
        const inspectParams = parseSharedProcessDebugPort(this.environmentMainService.args, this.environmentMainService.isBuilt);
        let execArgv = undefined;
        if (inspectParams.port) {
            execArgv = ['--nolazy', '--experimental-network-inspection'];
            if (inspectParams.break) {
                execArgv.push(`--inspect-brk=${inspectParams.port}`);
            }
            else {
                execArgv.push(`--inspect=${inspectParams.port}`);
            }
        }
        this.utilityProcess.start({
            type: 'shared-process',
            name: 'shared-process',
            entryPoint: 'vs/code/electron-utility/sharedProcess/sharedProcessMain',
            payload: this.createSharedProcessConfiguration(),
            respondToAuthRequestsFromMainProcess: true,
            execArgv
        });
        this._register(this.utilityProcess.onCrash(() => this._onDidCrash.fire()));
    }
    createSharedProcessConfiguration() {
        return {
            machineId: this.machineId,
            sqmId: this.sqmId,
            devDeviceId: this.devDeviceId,
            codeCachePath: this.environmentMainService.codeCachePath,
            profiles: {
                home: this.userDataProfilesService.profilesHome,
                all: this.userDataProfilesService.profiles,
            },
            args: this.environmentMainService.args,
            logLevel: this.loggerMainService.getLogLevel(),
            loggers: this.loggerMainService.getGlobalLoggers(),
            policiesData: this.policyService.serialize()
        };
    }
    async connect(payload) {
        // Wait for shared process being ready to accept connection
        await this.whenIpcReady;
        // Connect and return message port
        const utilityProcess = assertReturnsDefined(this.utilityProcess);
        return utilityProcess.connect(payload);
    }
};
SharedProcess = __decorate([
    __param(3, IEnvironmentMainService),
    __param(4, IUserDataProfilesService),
    __param(5, ILifecycleMainService),
    __param(6, ILogService),
    __param(7, ILoggerMainService),
    __param(8, IPolicyService)
], SharedProcess);
export { SharedProcess };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhcmVkUHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9zaGFyZWRQcm9jZXNzL2VsZWN0cm9uLW1haW4vc2hhcmVkUHJvY2Vzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNwRixPQUFPLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3pFLE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUNwRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUM5RixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFFdEQsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDM0YsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN0RixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNoRixPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUMzRixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNyRSxPQUFPLEVBQUUsOEJBQThCLEVBQUUsMEJBQTBCLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNoSSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sK0JBQStCLENBQUM7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