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
import { localize } from '../../../../nls.js';
import { createDecorator, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Memento } from '../../../common/memento.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { ASSIGNMENT_REFETCH_INTERVAL, ASSIGNMENT_STORAGE_KEY, AssignmentFilterProvider, TargetPopulation } from '../../../../platform/assignment/common/assignment.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { workbenchConfigurationNodeBase } from '../../../common/configuration.js';
import { Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { getTelemetryLevel } from '../../../../platform/telemetry/common/telemetryUtils.js';
import { importAMDNodeModule } from '../../../../amdX.js';
import { timeout } from '../../../../base/common/async.js';
import { CopilotAssignmentFilterProvider } from './assignmentFilters.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';
export const IWorkbenchAssignmentService = createDecorator('assignmentService');
class MementoKeyValueStorage {
    constructor(memento) {
        this.memento = memento;
        this.mementoObj = memento.getMemento(-1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
    }
    async getValue(key, defaultValue) {
        const value = await this.mementoObj[key];
        return value || defaultValue;
    }
    setValue(key, value) {
        this.mementoObj[key] = value;
        this.memento.saveMemento();
    }
}
class WorkbenchAssignmentServiceTelemetry extends Disposable {
    get assignmentContext() {
        return this._lastAssignmentContext?.split(';');
    }
    constructor(telemetryService, productService) {
        super();
        this.telemetryService = telemetryService;
        this.productService = productService;
        this._onDidUpdateAssignmentContext = this._register(new Emitter());
        this.onDidUpdateAssignmentContext = this._onDidUpdateAssignmentContext.event;
        this._assignmentFilters = [];
        this._assignmentFilterDisposables = this._register(new DisposableStore());
    }
    _filterAssignmentContext(assignmentContext) {
        const assignments = assignmentContext.split(';');
        const filteredAssignments = assignments.filter(assignment => {
            for (const filter of this._assignmentFilters) {
                if (filter.exclude(assignment)) {
                    return false;
                }
            }
            return true;
        });
        return filteredAssignments.join(';');
    }
    _setAssignmentContext(value) {
        const filteredValue = this._filterAssignmentContext(value);
        this._lastAssignmentContext = filteredValue;
        this._onDidUpdateAssignmentContext.fire();
        if (this.productService.tasConfig?.assignmentContextTelemetryPropertyName) {
            this.telemetryService.setExperimentProperty(this.productService.tasConfig.assignmentContextTelemetryPropertyName, filteredValue);
        }
    }
    addAssignmentFilter(filter) {
        this._assignmentFilters.push(filter);
        this._assignmentFilterDisposables.add(filter.onDidChange(() => {
            if (this._previousAssignmentContext) {
                this._setAssignmentContext(this._previousAssignmentContext);
            }
        }));
        if (this._previousAssignmentContext) {
            this._setAssignmentContext(this._previousAssignmentContext);
        }
    }
    // __GDPR__COMMON__ "abexp.assignmentcontext" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    setSharedProperty(name, value) {
        if (name === this.productService.tasConfig?.assignmentContextTelemetryPropertyName) {
            this._previousAssignmentContext = value;
            return this._setAssignmentContext(value);
        }
        this.telemetryService.setExperimentProperty(name, value);
    }
    postEvent(eventName, props) {
        const data = {};
        for (const [key, value] of props.entries()) {
            data[key] = value;
        }
        /* __GDPR__
            "query-expfeature" : {
                "owner": "sbatten",
                "comment": "Logs queries to the experiment service by feature for metric calculations",
                "ABExp.queriedFeature": { "classification": "SystemMetaData", "purpose": "FeatureInsight", "comment": "The experimental feature being queried" }
            }
        */
        this.telemetryService.publicLog(eventName, data);
    }
}
let WorkbenchAssignmentService = class WorkbenchAssignmentService extends Disposable {
    constructor(telemetryService, storageService, configurationService, productService, environmentService, instantiationService) {
        super();
        this.telemetryService = telemetryService;
        this.configurationService = configurationService;
        this.productService = productService;
        this.instantiationService = instantiationService;
        this.tasSetupDisposables = new DisposableStore();
        this.networkInitialized = false;
        this._onDidRefetchAssignments = this._register(new Emitter());
        this.onDidRefetchAssignments = this._onDidRefetchAssignments.event;
        this.experimentsEnabled = getTelemetryLevel(configurationService) === 3 /* TelemetryLevel.USAGE */ &&
            !environmentService.disableExperiments &&
            !environmentService.extensionTestsLocationURI &&
            !environmentService.enableSmokeTestDriver &&
            configurationService.getValue('workbench.enableExperiments') === true;
        if (productService.tasConfig && this.experimentsEnabled) {
            this.tasClient = this.setupTASClient();
        }
        this.telemetry = this._register(new WorkbenchAssignmentServiceTelemetry(telemetryService, productService));
        this._register(this.telemetry.onDidUpdateAssignmentContext(() => this._onDidRefetchAssignments.fire()));
        this.keyValueStorage = new MementoKeyValueStorage(new Memento('experiment.service.memento', storageService));
        // For development purposes, configure the delay until tas local tas treatment ovverrides are available
        const overrideDelaySetting = configurationService.getValue('experiments.overrideDelay');
        const overrideDelay = typeof overrideDelaySetting === 'number' ? overrideDelaySetting : 0;
        this.overrideInitDelay = timeout(overrideDelay);
    }
    async getTreatment(name) {
        const result = await this.doGetTreatment(name);
        this.telemetryService.publicLog2('tasClientReadTreatmentComplete', {
            treatmentName: name,
            treatmentValue: JSON.stringify(result)
        });
        return result;
    }
    async doGetTreatment(name) {
        await this.overrideInitDelay; // For development purposes, allow overriding tas assignments to test variants locally.
        const override = this.configurationService.getValue(`experiments.override.${name}`);
        if (override !== undefined) {
            return override;
        }
        if (!this.tasClient) {
            return undefined;
        }
        if (!this.experimentsEnabled) {
            return undefined;
        }
        let result;
        const client = await this.tasClient;
        // The TAS client is initialized but we need to check if the initial fetch has completed yet
        // If it is complete, return a cached value for the treatment
        // If not, use the async call with `checkCache: true`. This will allow the module to return a cached value if it is present.
        // Otherwise it will await the initial fetch to return the most up to date value.
        if (this.networkInitialized) {
            result = client.getTreatmentVariable('vscode', name);
        }
        else {
            result = await client.getTreatmentVariableAsync('vscode', name, true);
        }
        result = client.getTreatmentVariable('vscode', name);
        return result;
    }
    async setupTASClient() {
        this.tasSetupDisposables.clear();
        const targetPopulation = this.productService.quality === 'stable' ?
            TargetPopulation.Public : (this.productService.quality === 'exploration' ?
            TargetPopulation.Exploration : TargetPopulation.Insiders);
        const filterProvider = new AssignmentFilterProvider(this.productService.version, this.productService.nameLong, this.telemetryService.machineId, this.telemetryService.devDeviceId, targetPopulation, this.productService.date ?? '');
        const extensionsFilterProvider = this.instantiationService.createInstance(CopilotAssignmentFilterProvider);
        this.tasSetupDisposables.add(extensionsFilterProvider);
        this.tasSetupDisposables.add(extensionsFilterProvider.onDidChangeFilters(() => this.refetchAssignments()));
        const tasConfig = this.productService.tasConfig;
        const tasClient = new (await importAMDNodeModule('tas-client', 'dist/tas-client.min.js')).ExperimentationService({
            filterProviders: [filterProvider, extensionsFilterProvider],
            telemetry: this.telemetry,
            storageKey: ASSIGNMENT_STORAGE_KEY,
            keyValueStorage: this.keyValueStorage,
            assignmentContextTelemetryPropertyName: tasConfig.assignmentContextTelemetryPropertyName,
            telemetryEventName: tasConfig.telemetryEventName,
            endpoint: tasConfig.endpoint,
            refetchInterval: ASSIGNMENT_REFETCH_INTERVAL,
        });
        await tasClient.initializePromise;
        tasClient.initialFetch.then(() => {
            this.networkInitialized = true;
        });
        return tasClient;
    }
    async refetchAssignments() {
        if (!this.tasClient) {
            return; // Setup has not started, assignments will use latest filters
        }
        // Await the client to be setup and the initial fetch to complete
        const tasClient = await this.tasClient;
        await tasClient.initialFetch;
        // Refresh the assignments
        await tasClient.getTreatmentVariableAsync('vscode', 'refresh', false);
    }
    async getCurrentExperiments() {
        if (!this.tasClient) {
            return undefined;
        }
        if (!this.experimentsEnabled) {
            return undefined;
        }
        await this.tasClient;
        return this.telemetry.assignmentContext;
    }
    addTelemetryAssignmentFilter(filter) {
        this.telemetry.addAssignmentFilter(filter);
    }
};
WorkbenchAssignmentService = __decorate([
    __param(0, ITelemetryService),
    __param(1, IStorageService),
    __param(2, IConfigurationService),
    __param(3, IProductService),
    __param(4, IWorkbenchEnvironmentService),
    __param(5, IInstantiationService)
], WorkbenchAssignmentService);
export { WorkbenchAssignmentService };
registerSingleton(IWorkbenchAssignmentService, WorkbenchAssignmentService, 1 /* InstantiationType.Delayed */);
const registry = Registry.as(ConfigurationExtensions.Configuration);
registry.registerConfiguration({
    ...workbenchConfigurationNodeBase,
    'properties': {
        'workbench.enableExperiments': {
            'type': 'boolean',
            'description': localize('workbench.enableExperiments', "Fetches experiments to run from a Microsoft online service."),
            'default': true,
            'scope': 1 /* ConfigurationScope.APPLICATION */,
            'restricted': true,
            'tags': ['usesOnlineServices']
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzaWdubWVudFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL2Fzc2lnbm1lbnQvY29tbW9uL2Fzc2lnbm1lbnRTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsZUFBZSxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFFcEgsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ3JELE9BQU8sRUFBRSxpQkFBaUIsRUFBa0IsTUFBTSxvREFBb0QsQ0FBQztBQUN2RyxPQUFPLEVBQUUsZUFBZSxFQUErQixNQUFNLGdEQUFnRCxDQUFDO0FBRTlHLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDeEYsT0FBTyxFQUFFLDJCQUEyQixFQUFFLHNCQUFzQixFQUFFLHdCQUF3QixFQUFzQixnQkFBZ0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzNMLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsOEJBQThCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRixPQUFPLEVBQTBCLFVBQVUsSUFBSSx1QkFBdUIsRUFBc0IsTUFBTSxvRUFBb0UsQ0FBQztBQUN2SyxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUM5RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM1RixP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