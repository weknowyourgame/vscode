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
import { EditSuggestionId } from '../../../../../../editor/common/textModelEditSource.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { TelemetryTrustedValue } from '../../../../../../platform/telemetry/common/telemetryUtils.js';
import { DataChannelForwardingTelemetryService, forwardToChannelIf, isCopilotLikeExtension } from '../../../../../../platform/dataChannel/browser/forwardingTelemetryService.js';
import { IRandomService } from '../../randomService.js';
let AiEditTelemetryServiceImpl = class AiEditTelemetryServiceImpl {
    constructor(instantiationService, _randomService) {
        this.instantiationService = instantiationService;
        this._randomService = _randomService;
        this._telemetryService = this.instantiationService.createInstance(DataChannelForwardingTelemetryService);
    }
    createSuggestionId(data) {
        const suggestionId = EditSuggestionId.newId(ns => this._randomService.generatePrefixedUuid(ns));
        this._telemetryService.publicLog2('editTelemetry.codeSuggested', {
            eventId: this._randomService.generatePrefixedUuid('evt'),
            suggestionId: suggestionId,
            presentation: data.presentation,
            feature: data.feature,
            sourceExtensionId: data.source?.extensionId,
            sourceExtensionVersion: data.source?.extensionVersion,
            sourceProviderId: data.source?.providerId,
            languageId: data.languageId,
            editCharsInserted: data.editDeltaInfo?.charsAdded,
            editCharsDeleted: data.editDeltaInfo?.charsRemoved,
            editLinesInserted: data.editDeltaInfo?.linesAdded,
            editLinesDeleted: data.editDeltaInfo?.linesRemoved,
            modeId: data.modeId,
            modelId: new TelemetryTrustedValue(data.modelId),
            applyCodeBlockSuggestionId: data.applyCodeBlockSuggestionId,
            ...forwardToChannelIf(isCopilotLikeExtension(data.source?.extensionId)),
        });
        return suggestionId;
    }
    handleCodeAccepted(data) {
        this._telemetryService.publicLog2('editTelemetry.codeAccepted', {
            eventId: this._randomService.generatePrefixedUuid('evt'),
            suggestionId: data.suggestionId,
            presentation: data.presentation,
            feature: data.feature,
            sourceExtensionId: data.source?.extensionId,
            sourceExtensionVersion: data.source?.extensionVersion,
            sourceProviderId: data.source?.providerId,
            languageId: data.languageId,
            editCharsInserted: data.editDeltaInfo?.charsAdded,
            editCharsDeleted: data.editDeltaInfo?.charsRemoved,
            editLinesInserted: data.editDeltaInfo?.linesAdded,
            editLinesDeleted: data.editDeltaInfo?.linesRemoved,
            modeId: data.modeId,
            modelId: new TelemetryTrustedValue(data.modelId),
            applyCodeBlockSuggestionId: data.applyCodeBlockSuggestionId,
            acceptanceMethod: data.acceptanceMethod,
            ...forwardToChannelIf(isCopilotLikeExtension(data.source?.extensionId)),
        });
    }
};
AiEditTelemetryServiceImpl = __decorate([
    __param(0, IInstantiationService),
    __param(1, IRandomService)
], AiEditTelemetryServiceImpl);
export { AiEditTelemetryServiceImpl };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWlFZGl0VGVsZW1ldHJ5U2VydmljZUltcGwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZWRpdFRlbGVtZXRyeS9icm93c2VyL3RlbGVtZXRyeS9haUVkaXRUZWxlbWV0cnkvYWlFZGl0VGVsZW1ldHJ5U2VydmljZUltcGwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDMUYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFFekcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLHFDQUFxQyxFQUFFLGtCQUFrQixFQUFFLHNCQUFzQixFQUFFLE1BQU0sOEVBQThFLENBQUM7QUFFakwsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBRWpELElBQU0sMEJBQTBCLEdBQWhDLE1BQU0sMEJBQTBCO0lBS3RDLFlBQ3lDLG9CQUEyQyxFQUNsRCxjQUE4QjtRQUR2Qix5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXVCO1FBQ2xELG1CQUFjLEdBQWQsY0FBYyxDQUFnQjtRQUUvRCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO0lBQzFHLENBQUM7SUFFTSxrQkFBa0IsQ0FBQyxJQUEyRDtRQUNwRixNQUFNLFlBQVksR0FBRyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDaEcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0EyQzlCLDZC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