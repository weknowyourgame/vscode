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
import { fork } from 'child_process';
import { Limiter } from '../../../base/common/async.js';
import { toErrorMessage } from '../../../base/common/errorMessage.js';
import { Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { Schemas } from '../../../base/common/network.js';
import { join } from '../../../base/common/path.js';
import { Promises } from '../../../base/node/pfs.js';
import { ILogService } from '../../log/common/log.js';
import { IUserDataProfilesService } from '../../userDataProfile/common/userDataProfile.js';
let ExtensionsLifecycle = class ExtensionsLifecycle extends Disposable {
    constructor(userDataProfilesService, logService) {
        super();
        this.userDataProfilesService = userDataProfilesService;
        this.logService = logService;
        this.processesLimiter = new Limiter(5); // Run max 5 processes in parallel
    }
    async postUninstall(extension) {
        const script = this.parseScript(extension, 'uninstall');
        if (script) {
            this.logService.info(extension.identifier.id, extension.manifest.version, `Running post uninstall script`);
            await this.processesLimiter.queue(async () => {
                try {
                    await this.runLifecycleHook(script.script, 'uninstall', script.args, true, extension);
                    this.logService.info(`Finished running post uninstall script`, extension.identifier.id, extension.manifest.version);
                }
                catch (error) {
                    this.logService.error('Failed to run post uninstall script', extension.identifier.id, extension.manifest.version);
                    this.logService.error(error);
                }
            });
        }
        try {
            await Promises.rm(this.getExtensionStoragePath(extension));
        }
        catch (error) {
            this.logService.error('Error while removing extension storage path', extension.identifier.id);
            this.logService.error(error);
        }
    }
    parseScript(extension, type) {
        const scriptKey = `vscode:${type}`;
        if (extension.location.scheme === Schemas.file && extension.manifest && extension.manifest['scripts'] && typeof extension.manifest['scripts'][scriptKey] === 'string') {
            const script = (extension.manifest['scripts'][scriptKey]).split(' ');
            if (script.length < 2 || script[0] !== 'node' || !script[1]) {
                this.logService.warn(extension.identifier.id, extension.manifest.version, `${scriptKey} should be a node script`);
                return null;
            }
            return { script: join(extension.location.fsPath, script[1]), args: script.slice(2) || [] };
        }
        return null;
    }
    runLifecycleHook(lifecycleHook, lifecycleType, args, timeout, extension) {
        return new Promise((c, e) => {
            const extensionLifecycleProcess = this.start(lifecycleHook, lifecycleType, args, extension);
            let timeoutHandler;
            const onexit = (error) => {
                if (timeoutHandler) {
                    clearTimeout(timeoutHandler);
                    timeoutHandler = null;
                }
                if (error) {
                    e(error);
                }
                else {
                    c(undefined);
                }
            };
            // on error
            extensionLifecycleProcess.on('error', (err) => {
                onexit(toErrorMessage(err) || 'Unknown');
            });
            // on exit
            extensionLifecycleProcess.on('exit', (code, signal) => {
                onexit(code ? `post-${lifecycleType} process exited with code ${code}` : undefined);
            });
            if (timeout) {
                // timeout: kill process after waiting for 5s
                timeoutHandler = setTimeout(() => {
                    timeoutHandler = null;
                    extensionLifecycleProcess.kill();
                    e('timed out');
                }, 5000);
            }
        });
    }
    start(uninstallHook, lifecycleType, args, extension) {
        const opts = {
            silent: true,
            execArgv: undefined
        };
        const extensionUninstallProcess = fork(uninstallHook, [`--type=extension-post-${lifecycleType}`, ...args], opts);
        extensionUninstallProcess.stdout.setEncoding('utf8');
        extensionUninstallProcess.stderr.setEncoding('utf8');
        const onStdout = Event.fromNodeEventEmitter(extensionUninstallProcess.stdout, 'data');
        const onStderr = Event.fromNodeEventEmitter(extensionUninstallProcess.stderr, 'data');
        // Log output
        this._register(onStdout(data => this.logService.info(extension.identifier.id, extension.manifest.version, `post-${lifecycleType}`, data)));
        this._register(onStderr(data => this.logService.error(extension.identifier.id, extension.manifest.version, `post-${lifecycleType}`, data)));
        const onOutput = Event.any(Event.map(onStdout, o => ({ data: `%c${o}`, format: [''] }), this._store), Event.map(onStderr, o => ({ data: `%c${o}`, format: ['color: red'] }), this._store));
        // Debounce all output, so we can render it in the Chrome console as a group
        const onDebouncedOutput = Event.debounce(onOutput, (r, o) => {
            return r
                ? { data: r.data + o.data, format: [...r.format, ...o.format] }
                : { data: o.data, format: o.format };
        }, 100, undefined, undefined, undefined, this._store);
        // Print out output
        onDebouncedOutput(data => {
            console.group(extension.identifier.id);
            console.log(data.data, ...data.format);
            console.groupEnd();
        });
        return extensionUninstallProcess;
    }
    getExtensionStoragePath(extension) {
        return join(this.userDataProfilesService.defaultProfile.globalStorageHome.fsPath, extension.identifier.id.toLowerCase());
    }
};
ExtensionsLifecycle = __decorate([
    __param(0, IUserDataProfilesService),
    __param(1, ILogService)
], ExtensionsLifecycle);
export { ExtensionsLifecycle };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uTGlmZWN5Y2xlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvbm9kZS9leHRlbnNpb25MaWZlY3ljbGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFnQixJQUFJLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDbkQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN0RSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDdEQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMxRCxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDcEQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBRXJELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUVwRixJQUFNLG1CQUFtQixHQUF6QixNQUFNLG1CQUFvQixTQUFRLFVBQVU7SUFJbEQsWUFDMkIsdUJBQXlELEVBQ3RFLFVBQXdDO1FBRXJELEtBQUssRUFBRSxDQUFDO1FBSDBCLDRCQUF1QixHQUF2Qix1QkFBdUIsQ0FBMEI7UUFDckQsZUFBVSxHQUFWLFVBQVUsQ0FBYTtRQUo5QyxxQkFBZ0IsR0FBa0IsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQ0FBa0M7SUFPNUYsQ0FBQztJQUVELEtBQUssQ0FBQyxhQUFhLENBQUMsU0FBMEI7UUFDN0MsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDeEQsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUNaLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLCtCQUErQixDQUFDLENBQUM7WUFDM0csTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEtBQUssSUFBSSxFQUFFO2dCQUM1QyxJQUFJLENBQUM7b0JBQ0osTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxXQUFXLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7b0JBQ3RGLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLHdDQUF3QyxFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ3JILENBQUM7Z0JBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztvQkFDaEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMscUNBQXFDLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsU0FBUyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztvQkFDbEgsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzlCLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQztRQUNKLENBQUM7UUFDRCxJQUFJLENBQUM7WUFDSixNQUFNLFFBQVEsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDNUQsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsNkNBQTZDLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUM5RixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM5QixDQUFDO0lBQ0YsQ0FBQztJQUVPLFdBQVcsQ0FBQyxTQUEwQixFQUFFLElBQVk7UUFDM0QsTUFBTSxTQUFTLEdBQUcsVUFBVSxJQUFJLEVBQUUsQ0FBQztRQUNuQyxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsTUFBTSxLQUFLLE9BQU8sQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDLFFBQVEsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxTQUFTLENBQUMsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUN2SyxNQUFNLE1BQU0sR0FBRyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDckUsSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQzdELElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLEdBQUcsU0FBUywwQkFBMEIsQ0FBQyxDQUFDO2dCQUNsSCxPQUFPLElBQUksQ0FBQztZQUNiLENBQUM7WUFDRCxPQUFPLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztRQUM1RixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRU8sZ0JBQWdCLENBQUMsYUFBcUIsRUFBRSxhQUFxQixFQUFFLElBQWMsRUFBRSxPQUFnQixFQUFFLFNBQTBCO1FBQ2xJLE9BQU8sSUFBSSxPQUFPLENBQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFFakMsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVGLElBQUksY0FBOEIsQ0FBQztZQUVuQyxNQUFNLE1BQU0sR0FBRyxDQUFDLEtBQWMsRUFBRSxFQUFFO2dCQUNqQyxJQUFJLGNBQWMsRUFBRSxDQUFDO29CQUNwQixZQUFZLENBQUMsY0FBYyxDQUFDLENBQUM7b0JBQzdCLGNBQWMsR0FBRyxJQUFJLENBQUM7Z0JBQ3ZCLENBQUM7Z0JBQ0QsSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDWCxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ1YsQ0FBQztxQkFBTSxDQUFDO29CQUNQLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDZCxDQUFDO1lBQ0YsQ0FBQyxDQUFDO1lBRUYsV0FBVztZQUNYLHlCQUF5QixDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQkFDN0MsTUFBTSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQztZQUMxQyxDQUFDLENBQUMsQ0FBQztZQUVILFVBQVU7WUFDVix5QkFBeUIsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBWSxFQUFFLE1BQWMsRUFBRSxFQUFFO2dCQUNyRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLGFBQWEsNkJBQTZCLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNyRixDQUFDLENBQUMsQ0FBQztZQUVILElBQUksT0FBTyxFQUFFLENBQUM7Z0JBQ2IsNkNBQTZDO2dCQUM3QyxjQUFjLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRTtvQkFDaEMsY0FBYyxHQUFHLElBQUksQ0FBQztvQkFDdEIseUJBQXlCLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBQ2pDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDaEIsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ1YsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVPLEtBQUssQ0FBQyxhQUFxQixFQUFFLGFBQXFCLEVBQUUsSUFBYyxFQUFFLFNBQTBCO1FBQ3JHLE1BQU0sSUFBSSxHQUFHO1lBQ1osTUFBTSxFQUFFLElBQUk7WUFDWixRQUFRLEVBQUUsU0FBUztTQUNuQixDQUFDO1FBQ0YsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMseUJBQXlCLGFBQWEsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFJakgseUJBQXlCLENBQUMsTUFBTyxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN0RCx5QkFBeUIsQ0FBQyxNQUFPLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRXRELE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxvQkFBb0IsQ0FBUyx5QkFBeUIsQ0FBQyxNQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDL0YsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLG9CQUFvQixDQUFTLHlCQUF5QixDQUFDLE1BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUUvRixhQUFhO1FBQ2IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxRQUFRLGFBQWEsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMzSSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLFFBQVEsYUFBYSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTVJLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQ3pCLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQ3pFLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQ25GLENBQUM7UUFDRiw0RUFBNEU7UUFDNUUsTUFBTSxpQkFBaUIsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFTLFFBQVEsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUNuRSxPQUFPLENBQUM7Z0JBQ1AsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQy9ELENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDdkMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFdEQsbUJBQW1CO1FBQ25CLGlCQUFpQixDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3hCLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUN2QyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdkMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3BCLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyx5QkFBeUIsQ0FBQztJQUNsQyxDQUFDO0lBRU8sdUJBQXVCLENBQUMsU0FBMEI7UUFDekQsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztJQUMxSCxDQUFDO0NBQ0QsQ0FBQTtBQWhJWSxtQkFBbUI7SUFLN0IsV0FBQSx3QkFBd0IsQ0FBQTtJQUN4QixXQUFBLFdBQVcsQ0FBQTtHQU5ELG1CQUFtQixDQWdJL0IifQ==