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
import { ITerminalInstanceService } from './terminal.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { TerminalExtensions } from '../../../../platform/terminal/common/terminal.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { TerminalInstance } from './terminalInstance.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { Emitter } from '../../../../base/common/event.js';
import { TerminalContextKeys } from '../common/terminalContextKey.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { promiseWithResolvers } from '../../../../base/common/async.js';
import { hasKey } from '../../../../base/common/types.js';
let TerminalInstanceService = class TerminalInstanceService extends Disposable {
    get onDidCreateInstance() { return this._onDidCreateInstance.event; }
    get onDidRegisterBackend() { return this._onDidRegisterBackend.event; }
    constructor(_instantiationService, _contextKeyService, environmentService) {
        super();
        this._instantiationService = _instantiationService;
        this._contextKeyService = _contextKeyService;
        this._backendRegistration = new Map();
        this._onDidCreateInstance = this._register(new Emitter());
        this._onDidRegisterBackend = this._register(new Emitter());
        this._terminalShellTypeContextKey = TerminalContextKeys.shellType.bindTo(this._contextKeyService);
        for (const remoteAuthority of [undefined, environmentService.remoteAuthority]) {
            const { promise, resolve } = promiseWithResolvers();
            this._backendRegistration.set(remoteAuthority, { promise, resolve });
        }
    }
    createInstance(config, target) {
        const shellLaunchConfig = this.convertProfileToShellLaunchConfig(config);
        const instance = this._instantiationService.createInstance(TerminalInstance, this._terminalShellTypeContextKey, shellLaunchConfig);
        instance.target = target;
        this._onDidCreateInstance.fire(instance);
        return instance;
    }
    convertProfileToShellLaunchConfig(shellLaunchConfigOrProfile, cwd) {
        // Profile was provided
        if (shellLaunchConfigOrProfile && hasKey(shellLaunchConfigOrProfile, { profileName: true })) {
            const profile = shellLaunchConfigOrProfile;
            if (!profile.path) {
                return shellLaunchConfigOrProfile;
            }
            return {
                executable: profile.path,
                args: profile.args,
                env: profile.env,
                icon: profile.icon,
                color: profile.color,
                name: profile.overrideName ? profile.profileName : undefined,
                cwd
            };
        }
        // A shell launch config was provided
        if (shellLaunchConfigOrProfile) {
            if (cwd) {
                shellLaunchConfigOrProfile.cwd = cwd;
            }
            return shellLaunchConfigOrProfile;
        }
        // Return empty shell launch config
        return {};
    }
    async getBackend(remoteAuthority) {
        let backend = Registry.as(TerminalExtensions.Backend).getTerminalBackend(remoteAuthority);
        if (!backend) {
            // Ensure backend is initialized and try again
            await this._backendRegistration.get(remoteAuthority)?.promise;
            backend = Registry.as(TerminalExtensions.Backend).getTerminalBackend(remoteAuthority);
        }
        return backend;
    }
    getRegisteredBackends() {
        return Registry.as(TerminalExtensions.Backend).backends.values();
    }
    didRegisterBackend(backend) {
        this._backendRegistration.get(backend.remoteAuthority)?.resolve();
        this._onDidRegisterBackend.fire(backend);
    }
};
TerminalInstanceService = __decorate([
    __param(0, IInstantiationService),
    __param(1, IContextKeyService),
    __param(2, IWorkbenchEnvironmentService)
], TerminalInstanceService);
export { TerminalInstanceService };
registerSingleton(ITerminalInstanceService, TerminalInstanceService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxJbnN0YW5jZVNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbEluc3RhbmNlU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQXFCLHdCQUF3QixFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQzVFLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFvRixrQkFBa0IsRUFBb0IsTUFBTSxrREFBa0QsQ0FBQztBQUMxTCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUN6RCxPQUFPLEVBQWUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUV2RyxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzVFLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzFHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUVuRCxJQUFNLHVCQUF1QixHQUE3QixNQUFNLHVCQUF3QixTQUFRLFVBQVU7SUFNdEQsSUFBSSxtQkFBbUIsS0FBK0IsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FB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