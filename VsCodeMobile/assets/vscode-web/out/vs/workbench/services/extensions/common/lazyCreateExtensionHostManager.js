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
import { Barrier } from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { RemoteAuthorityResolverErrorCode } from '../../../../platform/remote/common/remoteAuthorityResolver.js';
import { ExtensionHostManager, friendlyExtHostName } from './extensionHostManager.js';
/**
 * Waits until `start()` and only if it has extensions proceeds to really start.
 */
let LazyCreateExtensionHostManager = class LazyCreateExtensionHostManager extends Disposable {
    get pid() {
        if (this._actual) {
            return this._actual.pid;
        }
        return null;
    }
    get kind() {
        return this._extensionHost.runningLocation.kind;
    }
    get startup() {
        return this._extensionHost.startup;
    }
    get friendyName() {
        return friendlyExtHostName(this.kind, this.pid);
    }
    constructor(extensionHost, _initialActivationEvents, _internalExtensionService, _instantiationService, _logService) {
        super();
        this._initialActivationEvents = _initialActivationEvents;
        this._internalExtensionService = _internalExtensionService;
        this._instantiationService = _instantiationService;
        this._logService = _logService;
        this._onDidChangeResponsiveState = this._register(new Emitter());
        this.onDidChangeResponsiveState = this._onDidChangeResponsiveState.event;
        this._extensionHost = extensionHost;
        this.onDidExit = extensionHost.onExit;
        this._startCalled = new Barrier();
        this._actual = null;
    }
    dispose() {
        if (!this._actual) {
            this._extensionHost.dispose();
        }
        super.dispose();
    }
    _createActual(reason) {
        this._logService.info(`Creating lazy extension host (${this.friendyName}). Reason: ${reason}`);
        this._actual = this._register(this._instantiationService.createInstance(ExtensionHostManager, this._extensionHost, this._initialActivationEvents, this._internalExtensionService));
        this._register(this._actual.onDidChangeResponsiveState((e) => this._onDidChangeResponsiveState.fire(e)));
        return this._actual;
    }
    async _getOrCreateActualAndStart(reason) {
        if (this._actual) {
            // already created/started
            return this._actual;
        }
        const actual = this._createActual(reason);
        await actual.ready();
        return actual;
    }
    async ready() {
        await this._startCalled.wait();
        if (this._actual) {
            await this._actual.ready();
        }
    }
    async disconnect() {
        await this._actual?.disconnect();
    }
    representsRunningLocation(runningLocation) {
        return this._extensionHost.runningLocation.equals(runningLocation);
    }
    async deltaExtensions(extensionsDelta) {
        await this._startCalled.wait();
        if (this._actual) {
            return this._actual.deltaExtensions(extensionsDelta);
        }
        if (extensionsDelta.myToAdd.length > 0) {
            const actual = this._createActual(`contains ${extensionsDelta.myToAdd.length} new extension(s) (installed or enabled): ${extensionsDelta.myToAdd.map(extId => extId.value)}`);
            await actual.ready();
            return;
        }
    }
    containsExtension(extensionId) {
        return this._extensionHost.extensions?.containsExtension(extensionId) ?? false;
    }
    async activate(extension, reason) {
        await this._startCalled.wait();
        if (this._actual) {
            return this._actual.activate(extension, reason);
        }
        return false;
    }
    async activateByEvent(activationEvent, activationKind) {
        if (activationKind === 1 /* ActivationKind.Immediate */) {
            // this is an immediate request, so we cannot wait for start to be called
            if (this._actual) {
                return this._actual.activateByEvent(activationEvent, activationKind);
            }
            return;
        }
        await this._startCalled.wait();
        if (this._actual) {
            return this._actual.activateByEvent(activationEvent, activationKind);
        }
    }
    activationEventIsDone(activationEvent) {
        if (!this._startCalled.isOpen()) {
            return false;
        }
        if (this._actual) {
            return this._actual.activationEventIsDone(activationEvent);
        }
        return true;
    }
    async getInspectPort(tryEnableInspector) {
        await this._startCalled.wait();
        return this._actual?.getInspectPort(tryEnableInspector);
    }
    async resolveAuthority(remoteAuthority, resolveAttempt) {
        await this._startCalled.wait();
        if (this._actual) {
            return this._actual.resolveAuthority(remoteAuthority, resolveAttempt);
        }
        return {
            type: 'error',
            error: {
                message: `Cannot resolve authority`,
                code: RemoteAuthorityResolverErrorCode.Unknown,
                detail: undefined
            }
        };
    }
    async getCanonicalURI(remoteAuthority, uri) {
        await this._startCalled.wait();
        if (this._actual) {
            return this._actual.getCanonicalURI(remoteAuthority, uri);
        }
        throw new Error(`Cannot resolve canonical URI`);
    }
    async start(extensionRegistryVersionId, allExtensions, myExtensions) {
        if (myExtensions.length > 0) {
            // there are actual extensions, so let's launch the extension host (auto-start)
            const actual = this._createActual(`contains ${myExtensions.length} extension(s): ${myExtensions.map(extId => extId.value)}.`);
            const result = actual.ready();
            this._startCalled.open();
            return result;
        }
        // there are no actual extensions running
        this._startCalled.open();
    }
    async extensionTestsExecute() {
        await this._startCalled.wait();
        const actual = await this._getOrCreateActualAndStart(`execute tests.`);
        return actual.extensionTestsExecute();
    }
    async setRemoteEnvironment(env) {
        await this._startCalled.wait();
        if (this._actual) {
            return this._actual.setRemoteEnvironment(env);
        }
    }
};
LazyCreateExtensionHostManager = __decorate([
    __param(3, IInstantiationService),
    __param(4, ILogService)
], LazyCreateExtensionHostManager);
export { LazyCreateExtensionHostManager };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF6eUNyZWF0ZUV4dGVuc2lvbkhvc3RNYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9sYXp5Q3JlYXRlRXh0ZW5zaW9uSG9zdE1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFHbEUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBRWpILE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBUXRGOztHQUVHO0FBQ0ksSUFBTSw4QkFBOEIsR0FBcEMsTUFBTSw4QkFBK0IsU0FBUSxVQUFVO0lBVTdELElBQVcsR0FBRztRQUNiLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2xCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUM7UUFDekIsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVELElBQVcsSUFBSTtRQUNkLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDO0lBQ2pELENBQUM7SUFFRCxJQUFXLE9BQU87UUFDakIsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQztJQUNwQyxDQUFDO0lBRUQsSUFBVyxX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