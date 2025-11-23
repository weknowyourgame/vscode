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
import { coalesce } from '../../../base/common/arrays.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { deepClone, equals } from '../../../base/common/objects.js';
import { isEmptyObject, isString } from '../../../base/common/types.js';
import { ConfigurationModel } from './configurationModels.js';
import { Extensions } from './configurationRegistry.js';
import { ILogService, NullLogService } from '../../log/common/log.js';
import { IPolicyService } from '../../policy/common/policy.js';
import { Registry } from '../../registry/common/platform.js';
import { getErrorMessage } from '../../../base/common/errors.js';
import * as json from '../../../base/common/json.js';
export class DefaultConfiguration extends Disposable {
    get configurationModel() {
        return this._configurationModel;
    }
    constructor(logService) {
        super();
        this.logService = logService;
        this._onDidChangeConfiguration = this._register(new Emitter());
        this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
        this._configurationModel = ConfigurationModel.createEmptyModel(logService);
    }
    async initialize() {
        this.resetConfigurationModel();
        this._register(Registry.as(Extensions.Configuration).onDidUpdateConfiguration(({ properties, defaultsOverrides }) => this.onDidUpdateConfiguration(Array.from(properties), defaultsOverrides)));
        return this.configurationModel;
    }
    reload() {
        this.resetConfigurationModel();
        return this.configurationModel;
    }
    onDidUpdateConfiguration(properties, defaultsOverrides) {
        this.updateConfigurationModel(properties, Registry.as(Extensions.Configuration).getConfigurationProperties());
        this._onDidChangeConfiguration.fire({ defaults: this.configurationModel, properties });
    }
    getConfigurationDefaultOverrides() {
        return {};
    }
    resetConfigurationModel() {
        this._configurationModel = ConfigurationModel.createEmptyModel(this.logService);
        const properties = Registry.as(Extensions.Configuration).getConfigurationProperties();
        this.updateConfigurationModel(Object.keys(properties), properties);
    }
    updateConfigurationModel(properties, configurationProperties) {
        const configurationDefaultsOverrides = this.getConfigurationDefaultOverrides();
        for (const key of properties) {
            const defaultOverrideValue = configurationDefaultsOverrides[key];
            const propertySchema = configurationProperties[key];
            if (defaultOverrideValue !== undefined) {
                this._configurationModel.setValue(key, defaultOverrideValue);
            }
            else if (propertySchema) {
                this._configurationModel.setValue(key, deepClone(propertySchema.default));
            }
            else {
                this._configurationModel.removeValue(key);
            }
        }
    }
}
export class NullPolicyConfiguration {
    constructor() {
        this.onDidChangeConfiguration = Event.None;
        this.configurationModel = ConfigurationModel.createEmptyModel(new NullLogService());
    }
    async initialize() { return this.configurationModel; }
}
let PolicyConfiguration = class PolicyConfiguration extends Disposable {
    get configurationModel() { return this._configurationModel; }
    constructor(defaultConfiguration, policyService, logService) {
        super();
        this.defaultConfiguration = defaultConfiguration;
        this.policyService = policyService;
        this.logService = logService;
        this._onDidChangeConfiguration = this._register(new Emitter());
        this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
        this._configurationModel = ConfigurationModel.createEmptyModel(this.logService);
        this.configurationRegistry = Registry.as(Extensions.Configuration);
    }
    async initialize() {
        this.logService.trace('PolicyConfiguration#initialize');
        this.update(await this.updatePolicyDefinitions(this.defaultConfiguration.configurationModel.keys), false);
        this.update(await this.updatePolicyDefinitions(Object.keys(this.configurationRegistry.getExcludedConfigurationProperties())), false);
        this._register(this.policyService.onDidChange(policyNames => this.onDidChangePolicies(policyNames)));
        this._register(this.defaultConfiguration.onDidChangeConfiguration(async ({ properties }) => this.update(await this.updatePolicyDefinitions(properties), true)));
        return this._configurationModel;
    }
    async updatePolicyDefinitions(properties) {
        this.logService.trace('PolicyConfiguration#updatePolicyDefinitions', properties);
        const policyDefinitions = {};
        const keys = [];
        const configurationProperties = this.configurationRegistry.getConfigurationProperties();
        const excludedConfigurationProperties = this.configurationRegistry.getExcludedConfigurationProperties();
        for (const key of properties) {
            const config = configurationProperties[key] ?? excludedConfigurationProperties[key];
            if (!config) {
                // Config is removed. So add it to the list if in case it was registered as policy before
                keys.push(key);
                continue;
            }
            if (config.policy) {
                if (config.type !== 'string' && config.type !== 'number' && config.type !== 'array' && config.type !== 'object' && config.type !== 'boolean') {
                    this.logService.warn(`Policy ${config.policy.name} has unsupported type ${config.type}`);
                    continue;
                }
                const { value } = config.policy;
                keys.push(key);
                policyDefinitions[config.policy.name] = {
                    type: config.type === 'number' ? 'number' : config.type === 'boolean' ? 'boolean' : 'string',
                    value,
                };
            }
        }
        if (!isEmptyObject(policyDefinitions)) {
            await this.policyService.updatePolicyDefinitions(policyDefinitions);
        }
        return keys;
    }
    onDidChangePolicies(policyNames) {
        this.logService.trace('PolicyConfiguration#onDidChangePolicies', policyNames);
        const policyConfigurations = this.configurationRegistry.getPolicyConfigurations();
        const keys = coalesce(policyNames.map(policyName => policyConfigurations.get(policyName)));
        this.update(keys, true);
    }
    update(keys, trigger) {
        this.logService.trace('PolicyConfiguration#update', keys);
        const configurationProperties = this.configurationRegistry.getConfigurationProperties();
        const excludedConfigurationProperties = this.configurationRegistry.getExcludedConfigurationProperties();
        const changed = [];
        const wasEmpty = this._configurationModel.isEmpty();
        for (const key of keys) {
            const proprety = configurationProperties[key] ?? excludedConfigurationProperties[key];
            const policyName = proprety?.policy?.name;
            if (policyName) {
                let policyValue = this.policyService.getPolicyValue(policyName);
                if (isString(policyValue) && proprety.type !== 'string') {
                    try {
                        policyValue = this.parse(policyValue);
                    }
                    catch (e) {
                        this.logService.error(`Error parsing policy value ${policyName}:`, getErrorMessage(e));
                        continue;
                    }
                }
                if (wasEmpty ? policyValue !== undefined : !equals(this._configurationModel.getValue(key), policyValue)) {
                    changed.push([key, policyValue]);
                }
            }
            else {
                if (this._configurationModel.getValue(key) !== undefined) {
                    changed.push([key, undefined]);
                }
            }
        }
        if (changed.length) {
            this.logService.trace('PolicyConfiguration#changed', changed);
            const old = this._configurationModel;
            this._configurationModel = ConfigurationModel.createEmptyModel(this.logService);
            for (const key of old.keys) {
                this._configurationModel.setValue(key, old.getValue(key));
            }
            for (const [key, policyValue] of changed) {
                if (policyValue === undefined) {
                    this._configurationModel.removeValue(key);
                }
                else {
                    this._configurationModel.setValue(key, policyValue);
                }
            }
            if (trigger) {
                this._onDidChangeConfiguration.fire(this._configurationModel);
            }
        }
    }
    parse(content) {
        let raw = {};
        let currentProperty = null;
        let currentParent = [];
        const previousParents = [];
        const parseErrors = [];
        function onValue(value) {
            if (Array.isArray(currentParent)) {
                currentParent.push(value);
            }
            else if (currentProperty !== null) {
                if (currentParent[currentProperty] !== undefined) {
                    throw new Error(`Duplicate property found: ${currentProperty}`);
                }
                currentParent[currentProperty] = value;
            }
        }
        const visitor = {
            onObjectBegin: () => {
                const object = {};
                onValue(object);
                previousParents.push(currentParent);
                currentParent = object;
                currentProperty = null;
            },
            onObjectProperty: (name) => {
                currentProperty = name;
            },
            onObjectEnd: () => {
                currentParent = previousParents.pop();
            },
            onArrayBegin: () => {
                const array = [];
                onValue(array);
                previousParents.push(currentParent);
                currentParent = array;
                currentProperty = null;
            },
            onArrayEnd: () => {
                currentParent = previousParents.pop();
            },
            onLiteralValue: onValue,
            onError: (error, offset, length) => {
                parseErrors.push({ error, offset, length });
            }
        };
        if (content) {
            json.visit(content, visitor);
            raw = currentParent[0] || raw;
        }
        if (parseErrors.length > 0) {
            throw new Error(parseErrors.map(e => getErrorMessage(e.error)).join('\n'));
        }
        return raw;
    }
};
PolicyConfiguration = __decorate([
    __param(1, IPolicyService),
    __param(2, ILogService)
], PolicyConfiguration);
export { PolicyConfiguration };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlndXJhdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRTFELE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDcEUsT0FBTyxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN4RSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFrRSxNQUFNLDRCQUE0QixDQUFDO0FBQ3hILE9BQU8sRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDdEUsT0FBTyxFQUFFLGNBQWMsRUFBaUMsTUFBTSwrQkFBK0IsQ0FBQztBQUM5RixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDN0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ2pFLE9BQU8sS0FBSyxJQUFJLE1BQU0sOEJBQThCLENBQUM7QUFHckQsTUFBTSxPQUFPLG9CQUFxQixTQUFRLFVBQVU7SUFNbkQsSUFBSSxrQkFBa0I7UUFDckIsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUM7SUFDakMsQ0FBQztJQUVELFlBQTZCLFVBQXVCO1FBQ25ELEtBQUssRUFBRSxDQUFDO1FBRG9CLGVBQVUsR0FB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