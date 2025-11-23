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
import { equals } from '../../../../base/common/arrays.js';
import { Event, Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IExtensionManagementService } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IWorkbenchAssignmentService } from '../../assignment/common/assignmentService.js';
import { IWorkbenchExtensionEnablementService } from '../../extensionManagement/common/extensionManagement.js';
import { IExtensionService } from '../../extensions/common/extensions.js';
export const IInlineCompletionsUnificationService = createDecorator('inlineCompletionsUnificationService');
const CODE_UNIFICATION_PREFIX = 'cmp-cht-';
const EXTENSION_UNIFICATION_PREFIX = 'cmp-ext-';
const CODE_UNIFICATION_FF = 'inlineCompletionsUnificationCode';
const MODEL_UNIFICATION_FF = 'inlineCompletionsUnificationModel';
export const isRunningUnificationExperiment = new RawContextKey('isRunningUnificationExperiment', false);
const ExtensionUnificationSetting = 'chat.extensionUnification.enabled';
let InlineCompletionsUnificationImpl = class InlineCompletionsUnificationImpl extends Disposable {
    get state() { return this._state; }
    constructor(_assignmentService, _contextKeyService, _configurationService, _extensionEnablementService, _extensionManagementService, _extensionService, productService) {
        super();
        this._assignmentService = _assignmentService;
        this._contextKeyService = _contextKeyService;
        this._configurationService = _configurationService;
        this._extensionEnablementService = _extensionEnablementService;
        this._extensionManagementService = _extensionManagementService;
        this._extensionService = _extensionService;
        this._state = new InlineCompletionsUnificationState(false, false, false, []);
        this._onDidStateChange = this._register(new Emitter());
        this.onDidStateChange = this._onDidStateChange.event;
        this._onDidChangeExtensionUnificationState = this._register(new Emitter());
        this._onDidChangeExtensionUnificationSetting = this._register(new Emitter());
        this._completionsExtensionId = productService.defaultChatAgent?.extensionId.toLowerCase();
        this._chatExtensionId = productService.defaultChatAgent?.chatExtensionId.toLowerCase();
        const relevantExtensions = [this._completionsExtensionId, this._chatExtensionId].filter((id) => !!id);
        this.isRunningUnificationExperiment = isRunningUnificationExperiment.bindTo(this._contextKeyService);
        this._assignmentService.addTelemetryAssignmentFilter({
            exclude: (assignment) => assignment.startsWith(EXTENSION_UNIFICATION_PREFIX) && this._state.extensionUnification !== this._configurationService.getValue(ExtensionUnificationSetting),
            onDidChange: Event.any(this._onDidChangeExtensionUnificationState.event, this._onDidChangeExtensionUnificationSetting.event)
        });
        this._register(this._extensionEnablementService.onEnablementChanged((extensions) => {
            if (extensions.some(ext => relevantExtensions.includes(ext.identifier.id.toLowerCase()))) {
                this._update();
            }
        }));
        this._register(this._configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(ExtensionUnificationSetting)) {
                this._update();
                this._onDidChangeExtensionUnificationSetting.fire();
            }
        }));
        this._register(this._extensionService.onDidChangeExtensions(({ added }) => {
            if (added.some(ext => relevantExtensions.includes(ext.identifier.value.toLowerCase()))) {
                this._update();
            }
        }));
        this._register(this._assignmentService.onDidRefetchAssignments(() => this._update()));
        this._update();
    }
    async _update() {
        const [codeUnificationFF, modelUnificationFF, extensionUnificationEnabled] = await Promise.all([
            this._assignmentService.getTreatment(CODE_UNIFICATION_FF),
            this._assignmentService.getTreatment(MODEL_UNIFICATION_FF),
            this._isExtensionUnificationActive()
        ]);
        const extensionStatesMatchUnificationSetting = this._configurationService.getValue(ExtensionUnificationSetting) === extensionUnificationEnabled;
        // Intentionally read the current experiments after fetching the treatments
        const currentExperiments = await this._assignmentService.getCurrentExperiments();
        const newState = new InlineCompletionsUnificationState(codeUnificationFF === true, modelUnificationFF === true, extensionUnificationEnabled, currentExperiments?.filter(exp => exp.startsWith(CODE_UNIFICATION_PREFIX) || (extensionStatesMatchUnificationSetting && exp.startsWith(EXTENSION_UNIFICATION_PREFIX))) ?? []);
        if (this._state.equals(newState)) {
            return;
        }
        const previousState = this._state;
        this._state = newState;
        this.isRunningUnificationExperiment.set(this._state.codeUnification || this._state.modelUnification || this._state.extensionUnification);
        this._onDidStateChange.fire();
        if (previousState.extensionUnification !== this._state.extensionUnification) {
            this._onDidChangeExtensionUnificationState.fire();
        }
    }
    async _isExtensionUnificationActive() {
        if (!this._configurationService.getValue(ExtensionUnificationSetting)) {
            return false;
        }
        if (!this._completionsExtensionId || !this._chatExtensionId) {
            return false;
        }
        const [completionsExtension, chatExtension, installedExtensions] = await Promise.all([
            this._extensionService.getExtension(this._completionsExtensionId),
            this._extensionService.getExtension(this._chatExtensionId),
            this._extensionManagementService.getInstalled(1 /* ExtensionType.User */)
        ]);
        if (!chatExtension || completionsExtension) {
            return false;
        }
        // Extension might be installed on remote and local
        const completionExtensionInstalled = installedExtensions.filter(ext => ext.identifier.id.toLowerCase() === this._completionsExtensionId);
        if (completionExtensionInstalled.length === 0) {
            return false;
        }
        const completionsExtensionDisabledByUnification = completionExtensionInstalled.some(ext => this._extensionEnablementService.getEnablementState(ext) === 9 /* EnablementState.DisabledByUnification */);
        return !!chatExtension && completionsExtensionDisabledByUnification;
    }
};
InlineCompletionsUnificationImpl = __decorate([
    __param(0, IWorkbenchAssignmentService),
    __param(1, IContextKeyService),
    __param(2, IConfigurationService),
    __param(3, IWorkbenchExtensionEnablementService),
    __param(4, IExtensionManagementService),
    __param(5, IExtensionService),
    __param(6, IProductService)
], InlineCompletionsUnificationImpl);
export { InlineCompletionsUnificationImpl };
class InlineCompletionsUnificationState {
    constructor(codeUnification, modelUnification, extensionUnification, expAssignments) {
        this.codeUnification = codeUnification;
        this.modelUnification = modelUnification;
        this.extensionUnification = extensionUnification;
        this.expAssignments = expAssignments;
    }
    equals(other) {
        return this.codeUnification === other.codeUnification
            && this.modelUnification === other.modelUnification
            && this.extensionUnification === other.extensionUnification
            && equals(this.expAssignments, other.expAssignments);
    }
}
registerSingleton(IInlineCompletionsUnificationService, InlineCompletionsUnificationImpl, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ29tcGxldGlvbnNVbmlmaWNhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvaW5saW5lQ29tcGxldGlvbnMvY29tbW9uL2lubGluZUNvbXBsZXRpb25zVW5pZmljYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxhQUFhLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN6RyxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSx3RUFBd0UsQ0FBQztBQUVySCxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN4RixPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUMzRixPQUFPLEVBQW1CLG9DQUFvQyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDaEksT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFMUUsTUFBTSxDQUFDLE1BQU0sb0NBQW9DLEdBQUcsZUFBZSxDQUF1QyxxQ0FBcUMsQ0FBQyxDQUFDO0FBZ0JqSixNQUFNLHVCQUF1QixHQUFHLFVBQVUsQ0FBQztBQUMzQyxNQUFNLDRC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