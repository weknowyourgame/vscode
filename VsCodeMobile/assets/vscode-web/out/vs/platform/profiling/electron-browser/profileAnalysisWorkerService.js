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
import { WebWorkerDescriptor } from '../../webWorker/browser/webWorkerDescriptor.js';
import { registerSingleton } from '../../instantiation/common/extensions.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { IWebWorkerService } from '../../webWorker/browser/webWorkerService.js';
import { ILogService } from '../../log/common/log.js';
import { reportSample } from '../common/profilingTelemetrySpec.js';
import { ITelemetryService } from '../../telemetry/common/telemetry.js';
import { FileAccess } from '../../../base/common/network.js';
export var ProfilingOutput;
(function (ProfilingOutput) {
    ProfilingOutput[ProfilingOutput["Failure"] = 0] = "Failure";
    ProfilingOutput[ProfilingOutput["Irrelevant"] = 1] = "Irrelevant";
    ProfilingOutput[ProfilingOutput["Interesting"] = 2] = "Interesting";
})(ProfilingOutput || (ProfilingOutput = {}));
export const IProfileAnalysisWorkerService = createDecorator('IProfileAnalysisWorkerService');
// ---- impl
let ProfileAnalysisWorkerService = class ProfileAnalysisWorkerService {
    constructor(_telemetryService, _logService, _webWorkerService) {
        this._telemetryService = _telemetryService;
        this._logService = _logService;
        this._webWorkerService = _webWorkerService;
    }
    async _withWorker(callback) {
        const worker = this._webWorkerService.createWorkerClient(new WebWorkerDescriptor({
            esmModuleLocation: FileAccess.asBrowserUri('vs/platform/profiling/electron-browser/profileAnalysisWorkerMain.js'),
            label: 'CpuProfileAnalysisWorker'
        }));
        try {
            const r = await callback(worker.proxy);
            return r;
        }
        finally {
            worker.dispose();
        }
    }
    async analyseBottomUp(profile, callFrameClassifier, perfBaseline, sendAsErrorTelemtry) {
        return this._withWorker(async (worker) => {
            const result = await worker.$analyseBottomUp(profile);
            if (result.kind === 2 /* ProfilingOutput.Interesting */) {
                for (const sample of result.samples) {
                    reportSample({
                        sample,
                        perfBaseline,
                        source: callFrameClassifier(sample.url)
                    }, this._telemetryService, this._logService, sendAsErrorTelemtry);
                }
            }
            return result.kind;
        });
    }
    async analyseByLocation(profile, locations) {
        return this._withWorker(async (worker) => {
            const result = await worker.$analyseByUrlCategory(profile, locations);
            return result;
        });
    }
};
ProfileAnalysisWorkerService = __decorate([
    __param(0, ITelemetryService),
    __param(1, ILogService),
    __param(2, IWebWorkerService)
], ProfileAnalysisWorkerService);
registerSingleton(IProfileAnalysisWorkerService, ProfileAnalysisWorkerService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZmlsZUFuYWx5c2lzV29ya2VyU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9wcm9maWxpbmcvZWxlY3Ryb24tYnJvd3Nlci9wcm9maWxlQW5hbHlzaXNXb3JrZXJTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBR3JGLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDOUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDaEYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBR3RELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFFN0QsTUFBTSxDQUFOLElBQWtCLGVBSWpCO0FBSkQsV0FBa0IsZUFBZTtJQUNoQywyREFBTyxDQUFBO0lBQ1AsaUVBQVUsQ0FBQTtJQUNWLG1FQUFXLENBQUE7QUFDWixDQUFDLEVBSmlCLGVBQWUsS0FBZixlQUFlLFFBSWhDO0FBTUQsTUFBTSxDQUFDLE1BQU0sNkJBQTZCLEdBQUcsZUFBZSxDQUFnQywrQkFBK0IsQ0FBQyxDQUFDO0FBUzdILFlBQVk7QUFFWixJQUFNLDRCQUE0QixHQUFsQyxNQUFNLDRCQUE0QjtJQUlqQyxZQUNxQyxpQkFBb0MsRUFDMUMsV0FBd0IsRUFDbEIsaUJBQW9DO1FBRnBDLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBbUI7UUFDMUMsZ0JBQVcsR0FBWCxXQUFXLENBQWE7UUFDbEIsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFtQjtJQUNyRSxDQUFDO0lBRUcsS0FBSyxDQUFDLFdBQVcsQ0FBSSxRQUFpRTtRQUU3RixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLENBQ3ZELElBQUksbUJBQW1CLENBQUM7WUFDdkIsaUJBQWlCLEVBQUUsVUFBVSxDQUFDLFlBQVksQ0FBQyxxRUFBcUUsQ0FBQztZQUNqSCxLQUFLLEVBQUUsMEJBQTBCO1NBQ2pDLENBQUMsQ0FDRixDQUFDO1FBRUYsSUFBSSxDQUFDO1lBQ0osTUFBTSxDQUFDLEdBQUcsTUFBTSxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3ZDLE9BQU8sQ0FBQyxDQUFDO1FBQ1YsQ0FBQztnQkFBUyxDQUFDO1lBQ1YsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2xCLENBQUM7SUFDRixDQUFDO0lBRUQsS0FBSyxDQUFDLGVBQWUsQ0FBQyxPQUFtQixFQUFFLG1CQUF5QyxFQUFFLFlBQW9CLEVBQUUsbUJBQTRCO1FBQ3ZJLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUMsTUFBTSxFQUFDLEVBQUU7WUFDdEMsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDdEQsSUFBSSxNQUFNLENBQUMsSUFBSSx3Q0FBZ0MsRUFBRSxDQUFDO2dCQUNqRCxLQUFLLE1BQU0sTUFBTSxJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDckMsWUFBWSxDQUFDO3dCQUNaLE1BQU07d0JBQ04sWUFBWTt3QkFDWixNQUFNLEVBQUUsbUJBQW1CLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQztxQkFDdkMsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO2dCQUNuRSxDQUFDO1lBQ0YsQ0FBQztZQUNELE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQztRQUNwQixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxLQUFLLENBQUMsaUJBQWlCLENBQUMsT0FBbUIsRUFBRSxTQUF3QztRQUNwRixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFDLE1BQU0sRUFBQyxFQUFFO1lBQ3RDLE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLHFCQUFxQixDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUN0RSxPQUFPLE1BQU0sQ0FBQztRQUNmLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztDQUNELENBQUE7QUFqREssNEJBQTRCO0lBSy9CLFdBQUEsaUJBQWlCLENBQUE7SUFDakIsV0FBQSxXQUFXLENBQUE7SUFDWCxXQUFBLGlCQUFpQixDQUFBO0dBUGQsNEJBQTRCLENBaURqQztBQXFCRCxpQkFBaUIsQ0FBQyw2QkFBNkIsRUFBRSw0QkFBNEIsb0NBQTRCLENBQUMifQ==