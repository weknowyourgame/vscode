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
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { supportsTelemetry, NullTelemetryService, getPiiPathsFromEnvironment, isInternalTelemetry } from '../../../../platform/telemetry/common/telemetryUtils.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { INativeWorkbenchEnvironmentService } from '../../environment/electron-browser/environmentService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { ISharedProcessService } from '../../../../platform/ipc/electron-browser/services.js';
import { TelemetryAppenderClient } from '../../../../platform/telemetry/common/telemetryIpc.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { resolveWorkbenchCommonProperties } from '../common/workbenchCommonProperties.js';
import { TelemetryService as BaseTelemetryService } from '../../../../platform/telemetry/common/telemetryService.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { process } from '../../../../base/parts/sandbox/electron-browser/globals.js';
let TelemetryService = class TelemetryService extends Disposable {
    get sessionId() { return this.impl.sessionId; }
    get machineId() { return this.impl.machineId; }
    get sqmId() { return this.impl.sqmId; }
    get devDeviceId() { return this.impl.devDeviceId; }
    get firstSessionDate() { return this.impl.firstSessionDate; }
    get msftInternal() { return this.impl.msftInternal; }
    constructor(environmentService, productService, sharedProcessService, storageService, configurationService) {
        super();
        if (supportsTelemetry(productService, environmentService)) {
            const isInternal = isInternalTelemetry(productService, configurationService);
            const channel = sharedProcessService.getChannel('telemetryAppender');
            const config = {
                appenders: [new TelemetryAppenderClient(channel)],
                commonProperties: resolveWorkbenchCommonProperties(storageService, environmentService.os.release, environmentService.os.hostname, productService.commit, productService.version, environmentService.machineId, environmentService.sqmId, environmentService.devDeviceId, isInternal, process, productService.date, environmentService.remoteAuthority),
                piiPaths: getPiiPathsFromEnvironment(environmentService),
                sendErrorTelemetry: true
            };
            this.impl = this._register(new BaseTelemetryService(config, configurationService, productService));
        }
        else {
            this.impl = NullTelemetryService;
        }
        this.sendErrorTelemetry = this.impl.sendErrorTelemetry;
    }
    setExperimentProperty(name, value) {
        return this.impl.setExperimentProperty(name, value);
    }
    get telemetryLevel() {
        return this.impl.telemetryLevel;
    }
    publicLog(eventName, data) {
        this.impl.publicLog(eventName, data);
    }
    publicLog2(eventName, data) {
        this.publicLog(eventName, data);
    }
    publicLogError(errorEventName, data) {
        this.impl.publicLogError(errorEventName, data);
    }
    publicLogError2(eventName, data) {
        this.publicLogError(eventName, data);
    }
};
TelemetryService = __decorate([
    __param(0, INativeWorkbenchEnvironmentService),
    __param(1, IProductService),
    __param(2, ISharedProcessService),
    __param(3, IStorageService),
    __param(4, IConfigurationService)
], TelemetryService);
export { TelemetryService };
registerSingleton(ITelemetryService, TelemetryService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVsZW1ldHJ5U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvdGVsZW1ldHJ5L2VsZWN0cm9uLWJyb3dzZXIvdGVsZW1ldHJ5U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQWtDLE1BQU0sb0RBQW9ELENBQUM7QUFDdkgsT0FBTyxFQUFFLGlCQUFpQixFQUFFLG9CQUFvQixFQUFFLDBCQUEwQixFQUFFLG1CQUFtQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDbkssT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxrQ0FBa0MsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzlHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN4RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUM5RixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDakYsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDMUYsT0FBTyxFQUFFLGdCQUFnQixJQUFJLG9CQUFvQixFQUEyQixNQUFNLDJEQUEyRCxDQUFDO0FBQzlJLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUUvRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFFOUUsSUFBTSxnQkFBZ0IsR0FBdEIsTUFBTSxnQkFBaUIsU0FBUSxVQUFVO0lBTy9DLElB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