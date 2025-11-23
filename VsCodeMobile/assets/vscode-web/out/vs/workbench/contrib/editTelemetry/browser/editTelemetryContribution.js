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
import { Disposable } from '../../../../base/common/lifecycle.js';
import { autorun, derived } from '../../../../base/common/observable.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { observableConfigValue } from '../../../../platform/observable/common/platformObservableUtils.js';
import { ITelemetryService, telemetryLevelEnabled } from '../../../../platform/telemetry/common/telemetry.js';
import { AnnotatedDocuments } from './helpers/annotatedDocuments.js';
import { EditTrackingFeature } from './telemetry/editSourceTrackingFeature.js';
import { VSCodeWorkspace } from './helpers/vscodeObservableWorkspace.js';
import { AiStatsFeature } from './editStats/aiStatsFeature.js';
import { EDIT_TELEMETRY_SETTING_ID, AI_STATS_SETTING_ID } from './settingIds.js';
let EditTelemetryContribution = class EditTelemetryContribution extends Disposable {
    constructor(_instantiationService, _configurationService, _telemetryService) {
        super();
        this._instantiationService = _instantiationService;
        this._configurationService = _configurationService;
        this._telemetryService = _telemetryService;
        const workspace = derived(reader => reader.store.add(this._instantiationService.createInstance(VSCodeWorkspace)));
        const annotatedDocuments = derived(reader => reader.store.add(this._instantiationService.createInstance(AnnotatedDocuments, workspace.read(reader))));
        const editSourceTrackingEnabled = observableConfigValue(EDIT_TELEMETRY_SETTING_ID, true, this._configurationService);
        this._register(autorun(r => {
            const enabled = editSourceTrackingEnabled.read(r);
            if (!enabled || !telemetryLevelEnabled(this._telemetryService, 3 /* TelemetryLevel.USAGE */)) {
                return;
            }
            r.store.add(this._instantiationService.createInstance(EditTrackingFeature, workspace.read(r), annotatedDocuments.read(r)));
        }));
        const aiStatsEnabled = observableConfigValue(AI_STATS_SETTING_ID, true, this._configurationService);
        this._register(autorun(r => {
            const enabled = aiStatsEnabled.read(r);
            if (!enabled) {
                return;
            }
            r.store.add(this._instantiationService.createInstance(AiStatsFeature, annotatedDocuments.read(r)));
        }));
    }
};
EditTelemetryContribution = __decorate([
    __param(0, IInstantiationService),
    __param(1, IConfigurationService),
    __param(2, ITelemetryService)
], EditTelemetryContribution);
export { EditTelemetryContribution };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdFRlbGVtZXRyeUNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9lZGl0VGVsZW1ldHJ5L2Jyb3dzZXIvZWRpdFRlbGVtZXRyeUNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUMxRyxPQUFPLEVBQUUsaUJBQWlCLEVBQWtCLHFCQUFxQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDOUgsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDckUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDL0UsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUseUJBQXlCLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUUxRSxJQUFNLHlCQUF5QixHQUEvQixNQUFNLHlCQUEwQixTQUFRLFVBQVU7SUFDeEQsWUFDeUMscUJBQTRDLEVBQzVDLHFCQUE0QyxFQUNoRCxpQkFBb0M7UUFFeEUsS0FBSyxFQUFFLENBQUM7UUFKZ0MsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtRQUM1QywwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO1FBQ2hELHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBbUI7UUFJeEUsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLGNBQWMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEgsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsY0FBYyxDQUFDLGtCQUFrQixFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFdEosTUFBTSx5QkFBeUIsR0FBRyxxQkFBcUIsQ0FBQyx5QkFBeUIsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDckgsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDMUIsTUFBTSxPQUFPLEdBQUcseUJBQXlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2xELElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLCtCQUF1QixFQUFFLENBQUM7Z0JBQ3RGLE9BQU87WUFDUixDQUFDO1lBQ0QsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLGNBQWMsQ0FBQyxtQkFBbUIsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUgsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLE1BQU0sY0FBYyxHQUFHLHFCQUFxQixDQUFDLG1CQUFtQixFQUFFLElBQUksRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUNwRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUMxQixNQUFNLE9BQU8sR0FBRyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDZCxPQUFPO1lBQ1IsQ0FBQztZQUVELENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLENBQUMsY0FBYyxFQUFFLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRCxDQUFBO0FBOUJZLHlCQUF5QjtJQUVuQyxXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxpQkFBaUIsQ0FBQTtHQUpQLHlCQUF5QixDQThCckMifQ==