/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { distinct } from '../../../base/common/arrays.js';
import { Emitter } from '../../../base/common/event.js';
import * as types from '../../../base/common/types.js';
import * as nls from '../../../nls.js';
import { getLanguageTagSettingPlainKey } from './configuration.js';
import { Extensions as JSONExtensions } from '../../jsonschemas/common/jsonContributionRegistry.js';
import { Registry } from '../../registry/common/platform.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import product from '../../product/common/product.js';
export var EditPresentationTypes;
(function (EditPresentationTypes) {
    EditPresentationTypes["Multiline"] = "multilineText";
    EditPresentationTypes["Singleline"] = "singlelineText";
})(EditPresentationTypes || (EditPresentationTypes = {}));
export const Extensions = {
    Configuration: 'base.contributions.configuration'
};
export var ConfigurationScope;
(function (ConfigurationScope) {
    /**
     * Application specific configuration, which can be configured only in default profile user settings.
     */
    ConfigurationScope[ConfigurationScope["APPLICATION"] = 1] = "APPLICATION";
    /**
     * Machine specific configuration, which can be configured only in local and remote user settings.
     */
    ConfigurationScope[ConfigurationScope["MACHINE"] = 2] = "MACHINE";
    /**
     * An application machine specific configuration, which can be configured only in default profile user settings and remote user settings.
     */
    ConfigurationScope[ConfigurationScope["APPLICATION_MACHINE"] = 3] = "APPLICATION_MACHINE";
    /**
     * Window specific configuration, which can be configured in the user or workspace settings.
     */
    ConfigurationScope[ConfigurationScope["WINDOW"] = 4] = "WINDOW";
    /**
     * Resource specific configuration, which can be configured in the user, workspace or folder settings.
     */
    ConfigurationScope[ConfigurationScope["RESOURCE"] = 5] = "RESOURCE";
    /**
     * Resource specific configuration that can be configured in language specific settings
     */
    ConfigurationScope[ConfigurationScope["LANGUAGE_OVERRIDABLE"] = 6] = "LANGUAGE_OVERRIDABLE";
    /**
     * Machine specific configuration that can also be configured in workspace or folder settings.
     */
    ConfigurationScope[ConfigurationScope["MACHINE_OVERRIDABLE"] = 7] = "MACHINE_OVERRIDABLE";
})(ConfigurationScope || (ConfigurationScope = {}));
export const allSettings = { properties: {}, patternProperties: {} };
export const applicationSettings = { properties: {}, patternProperties: {} };
export const applicationMachineSettings = { properties: {}, patternProperties: {} };
export const machineSettings = { properties: {}, patternProperties: {} };
export const machineOverridableSettings = { properties: {}, patternProperties: {} };
export const windowSettings = { properties: {}, patternProperties: {} };
export const resourceSettings = { properties: {}, patternProperties: {} };
export const resourceLanguageSettingsSchemaId = 'vscode://schemas/settings/resourceLanguage';
export const configurationDefaultsSchemaId = 'vscode://schemas/settings/configurationDefaults';
const contributionRegistry = Registry.as(JSONExtensions.JSONContribution);
class ConfigurationRegistry extends Disposable {
    constructor() {
        super();
        this.registeredConfigurationDefaults = [];
        this.overrideIdentifiers = new Set();
        this._onDidSchemaChange = this._register(new Emitter());
        this.onDidSchemaChange = this._onDidSchemaChange.event;
        this._onDidUpdateConfiguration = this._register(new Emitter());
        this.onDidUpdateConfiguration = this._onDidUpdateConfiguration.event;
        this.configurationDefaultsOverrides = new Map();
        this.defaultLanguageConfigurationOverridesNode = {
            id: 'defaultOverrides',
            title: nls.localize('defaultLanguageConfigurationOverrides.title', "Default Language Configuration Overrides"),
            properties: {}
        };
        this.configurationContributors = [this.defaultLanguageConfigurationOverridesNode];
        this.resourceLanguageSettingsSchema = {
            properties: {},
            patternProperties: {},
            additionalProperties: true,
            allowTrailingCommas: true,
            allowComments: true
        };
        this.configurationProperties = {};
        this.policyConfigurations = new Map();
        this.excludedConfigurationProperties = {};
        contributionRegistry.registerSchema(resourceLanguageSettingsSchemaId, this.resourceLanguageSettingsSchema);
        this.registerOverridePropertyPatternKey();
    }
    registerConfiguration(configuration, validate = true) {
        this.registerConfigurations([configuration], validate);
        return configuration;
    }
    registerConfigurations(configurations, validate = true) {
        const properties = new Set();
        this.doRegisterConfigurations(configurations, validate, properties);
        contributionRegistry.registerSchema(resourceLanguageSettingsSchemaId, this.resourceLanguageSettingsSchema);
        this._onDidSchemaChange.fire();
        this._onDidUpdateConfiguration.fire({ properties });
    }
    deregisterConfigurations(configurations) {
        const properties = new Set();
        this.doDeregisterConfigurations(configurations, properties);
        contributionRegistry.registerSchema(resourceLanguageSettingsSchemaId, this.resourceLanguageSettingsSchema);
        this._onDidSchemaChange.fire();
        this._onDidUpdateConfiguration.fire({ properties });
    }
    updateConfigurations({ add, remove }) {
        const properties = new Set();
        this.doDeregisterConfigurations(remove, properties);
        this.doRegisterConfigurations(add, false, properties);
        contributionRegistry.registerSchema(resourceLanguageSettingsSchemaId, this.resourceLanguageSettingsSchema);
        this._onDidSchemaChange.fire();
        this._onDidUpdateConfiguration.fire({ properties });
    }
    registerDefaultConfigurations(configurationDefaults) {
        const properties = new Set();
        this.doRegisterDefaultConfigurations(configurationDefaults, properties);
        this._onDidSchemaChange.fire();
        this._onDidUpdateConfiguration.fire({ properties, defaultsOverrides: true });
    }
    doRegisterDefaultConfigurations(configurationDefaults, bucket) {
        this.registeredConfigurationDefaults.push(...configurationDefaults);
        const overrideIdentifiers = [];
        for (const { overrides, source } of configurationDefaults) {
            for (const key in overrides) {
                bucket.add(key);
                const configurationDefaultOverridesForKey = this.configurationDefaultsOverrides.get(key)
                    ?? this.configurationDefaultsOverrides.set(key, { configurationDefaultOverrides: [] }).get(key);
                const value = overrides[key];
                configurationDefaultOverridesForKey.configurationDefaultOverrides.push({ value, source });
                // Configuration defaults for Override Identifiers
                if (OVERRIDE_PROPERTY_REGEX.test(key)) {
                    const newDefaultOverride = this.mergeDefaultConfigurationsForOverrideIdentifier(key, value, source, configurationDefaultOverridesForKey.configurationDefaultOverrideValue);
                    if (!newDefaultOverride) {
                        continue;
                    }
                    configurationDefaultOverridesForKey.configurationDefaultOverrideValue = newDefaultOverride;
                    this.updateDefaultOverrideProperty(key, newDefaultOverride, source);
                    overrideIdentifiers.push(...overrideIdentifiersFromKey(key));
                }
                // Configuration defaults for Configuration Properties
                else {
                    const newDefaultOverride = this.mergeDefaultConfigurationsForConfigurationProperty(key, value, source, configurationDefaultOverridesForKey.configurationDefaultOverrideValue);
                    if (!newDefaultOverride) {
                        continue;
                    }
                    configurationDefaultOverridesForKey.configurationDefaultOverrideValue = newDefaultOverride;
                    const property = this.configurationProperties[key];
                    if (property) {
                        this.updatePropertyDefaultValue(key, property);
                        this.updateSchema(key, property);
                    }
                }
            }
        }
        this.doRegisterOverrideIdentifiers(overrideIdentifiers);
    }
    deregisterDefaultConfigurations(defaultConfigurations) {
        const properties = new Set();
        this.doDeregisterDefaultConfigurations(defaultConfigurations, properties);
        this._onDidSchemaChange.fire();
        this._onDidUpdateConfiguration.fire({ properties, defaultsOverrides: true });
    }
    doDeregisterDefaultConfigurations(defaultConfigurations, bucket) {
        for (const defaultConfiguration of defaultConfigurations) {
            const index = this.registeredConfigurationDefaults.indexOf(defaultConfiguration);
            if (index !== -1) {
                this.registeredConfigurationDefaults.splice(index, 1);
            }
        }
        for (const { overrides, source } of defaultConfigurations) {
            for (const key in overrides) {
                const configurationDefaultOverridesForKey = this.configurationDefaultsOverrides.get(key);
                if (!configurationDefaultOverridesForKey) {
                    continue;
                }
                const index = configurationDefaultOverridesForKey.configurationDefaultOverrides
                    .findIndex(configurationDefaultOverride => source ? configurationDefaultOverride.source?.id === source.id : configurationDefaultOverride.value === overrides[key]);
                if (index === -1) {
                    continue;
                }
                configurationDefaultOverridesForKey.configurationDefaultOverrides.splice(index, 1);
                if (configurationDefaultOverridesForKey.configurationDefaultOverrides.length === 0) {
                    this.configurationDefaultsOverrides.delete(key);
                }
                if (OVERRIDE_PROPERTY_REGEX.test(key)) {
                    let configurationDefaultOverrideValue;
                    for (const configurationDefaultOverride of configurationDefaultOverridesForKey.configurationDefaultOverrides) {
                        configurationDefaultOverrideValue = this.mergeDefaultConfigurationsForOverrideIdentifier(key, configurationDefaultOverride.value, configurationDefaultOverride.source, configurationDefaultOverrideValue);
                    }
                    if (configurationDefaultOverrideValue && !types.isEmptyObject(configurationDefaultOverrideValue.value)) {
                        configurationDefaultOverridesForKey.configurationDefaultOverrideValue = configurationDefaultOverrideValue;
                        this.updateDefaultOverrideProperty(key, configurationDefaultOverrideValue, source);
                    }
                    else {
                        this.configurationDefaultsOverrides.delete(key);
                        delete this.configurationProperties[key];
                        delete this.defaultLanguageConfigurationOverridesNode.properties[key];
                    }
                }
                else {
                    let configurationDefaultOverrideValue;
                    for (const configurationDefaultOverride of configurationDefaultOverridesForKey.configurationDefaultOverrides) {
                        configurationDefaultOverrideValue = this.mergeDefaultConfigurationsForConfigurationProperty(key, configurationDefaultOverride.value, configurationDefaultOverride.source, configurationDefaultOverrideValue);
                    }
                    configurationDefaultOverridesForKey.configurationDefaultOverrideValue = configurationDefaultOverrideValue;
                    const property = this.configurationProperties[key];
                    if (property) {
                        this.updatePropertyDefaultValue(key, property);
                        this.updateSchema(key, property);
                    }
                }
                bucket.add(key);
            }
        }
        this.updateOverridePropertyPatternKey();
    }
    updateDefaultOverrideProperty(key, newDefaultOverride, source) {
        const property = {
            section: {
                id: this.defaultLanguageConfigurationOverridesNode.id,
                title: this.defaultLanguageConfigurationOverridesNode.title,
                order: this.defaultLanguageConfigurationOverridesNode.order,
                extensionInfo: this.defaultLanguageConfigurationOverridesNode.extensionInfo
            },
            type: 'object',
            default: newDefaultOverride.value,
            description: nls.localize('defaultLanguageConfiguration.description', "Configure settings to be overridden for {0}.", getLanguageTagSettingPlainKey(key)),
            $ref: resourceLanguageSettingsSchemaId,
            defaultDefaultValue: newDefaultOverride.value,
            source,
            defaultValueSource: source
        };
        this.configurationProperties[key] = property;
        this.defaultLanguageConfigurationOverridesNode.properties[key] = property;
    }
    mergeDefaultConfigurationsForOverrideIdentifier(overrideIdentifier, configurationValueObject, valueSource, existingDefaultOverride) {
        const defaultValue = existingDefaultOverride?.value || {};
        const source = existingDefaultOverride?.source ?? new Map();
        // This should not happen
        if (!(source instanceof Map)) {
            console.error('objectConfigurationSources is not a Map');
            return undefined;
        }
        for (const propertyKey of Object.keys(configurationValueObject)) {
            const propertyDefaultValue = configurationValueObject[propertyKey];
            const isObjectSetting = types.isObject(propertyDefaultValue) &&
                (types.isUndefined(defaultValue[propertyKey]) || types.isObject(defaultValue[propertyKey]));
            // If the default value is an object, merge the objects and store the source of each keys
            if (isObjectSetting) {
                defaultValue[propertyKey] = { ...(defaultValue[propertyKey] ?? {}), ...propertyDefaultValue };
                // Track the source of each value in the object
                if (valueSource) {
                    for (const objectKey in propertyDefaultValue) {
                        source.set(`${propertyKey}.${objectKey}`, valueSource);
                    }
                }
            }
            // Primitive values are overridden
            else {
                defaultValue[propertyKey] = propertyDefaultValue;
                if (valueSource) {
                    source.set(propertyKey, valueSource);
                }
                else {
                    source.delete(propertyKey);
                }
            }
        }
        return { value: defaultValue, source };
    }
    mergeDefaultConfigurationsForConfigurationProperty(propertyKey, value, valuesSource, existingDefaultOverride) {
        const property = this.configurationProperties[propertyKey];
        const existingDefaultValue = existingDefaultOverride?.value ?? property?.defaultDefaultValue;
        let source = valuesSource;
        const isObjectSetting = types.isObject(value) &&
            (property !== undefined && property.type === 'object' ||
                property === undefined && (types.isUndefined(existingDefaultValue) || types.isObject(existingDefaultValue)));
        // If the default value is an object, merge the objects and store the source of each keys
        if (isObjectSetting) {
            source = existingDefaultOverride?.source ?? new Map();
            // This should not happen
            if (!(source instanceof Map)) {
                console.error('defaultValueSource is not a Map');
                return undefined;
            }
            for (const objectKey in value) {
                if (valuesSource) {
                    source.set(`${propertyKey}.${objectKey}`, valuesSource);
                }
            }
            value = { ...(types.isObject(existingDefaultValue) ? existingDefaultValue : {}), ...value };
        }
        return { value, source };
    }
    deltaConfiguration(delta) {
        // defaults: remove
        let defaultsOverrides = false;
        const properties = new Set();
        if (delta.removedDefaults) {
            this.doDeregisterDefaultConfigurations(delta.removedDefaults, properties);
            defaultsOverrides = true;
        }
        // defaults: add
        if (delta.addedDefaults) {
            this.doRegisterDefaultConfigurations(delta.addedDefaults, properties);
            defaultsOverrides = true;
        }
        // configurations: remove
        if (delta.removedConfigurations) {
            this.doDeregisterConfigurations(delta.removedConfigurations, properties);
        }
        // configurations: add
        if (delta.addedConfigurations) {
            this.doRegisterConfigurations(delta.addedConfigurations, false, properties);
        }
        this._onDidSchemaChange.fire();
        this._onDidUpdateConfiguration.fire({ properties, defaultsOverrides });
    }
    notifyConfigurationSchemaUpdated(...configurations) {
        this._onDidSchemaChange.fire();
    }
    registerOverrideIdentifiers(overrideIdentifiers) {
        this.doRegisterOverrideIdentifiers(overrideIdentifiers);
        this._onDidSchemaChange.fire();
    }
    doRegisterOverrideIdentifiers(overrideIdentifiers) {
        for (const overrideIdentifier of overrideIdentifiers) {
            this.overrideIdentifiers.add(overrideIdentifier);
        }
        this.updateOverridePropertyPatternKey();
    }
    doRegisterConfigurations(configurations, validate, bucket) {
        configurations.forEach(configuration => {
            this.validateAndRegisterProperties(configuration, validate, configuration.extensionInfo, configuration.restrictedProperties, undefined, bucket);
            this.configurationContributors.push(configuration);
            this.registerJSONConfiguration(configuration);
        });
    }
    doDeregisterConfigurations(configurations, bucket) {
        const deregisterConfiguration = (configuration) => {
            if (configuration.properties) {
                for (const key in configuration.properties) {
                    bucket.add(key);
                    const property = this.configurationProperties[key];
                    if (property?.policy?.name) {
                        this.policyConfigurations.delete(property.policy.name);
                    }
                    delete this.configurationProperties[key];
                    this.removeFromSchema(key, configuration.properties[key]);
                }
            }
            configuration.allOf?.forEach(node => deregisterConfiguration(node));
        };
        for (const configuration of configurations) {
            deregisterConfiguration(configuration);
            const index = this.configurationContributors.indexOf(configuration);
            if (index !== -1) {
                this.configurationContributors.splice(index, 1);
            }
        }
    }
    validateAndRegisterProperties(configuration, validate = true, extensionInfo, restrictedProperties, scope = 4 /* ConfigurationScope.WINDOW */, bucket) {
        scope = types.isUndefinedOrNull(configuration.scope) ? scope : configuration.scope;
        const properties = configuration.properties;
        if (properties) {
            for (const key in properties) {
                const property = properties[key];
                property.section = {
                    id: configuration.id,
                    title: configuration.title,
                    order: configuration.order,
                    extensionInfo: configuration.extensionInfo
                };
                if (validate && validateProperty(key, property, extensionInfo?.id)) {
                    delete properties[key];
                    continue;
                }
                property.source = extensionInfo;
                // update default value
                property.defaultDefaultValue = properties[key].default;
                this.updatePropertyDefaultValue(key, property);
                // update scope
                if (OVERRIDE_PROPERTY_REGEX.test(key)) {
                    property.scope = undefined; // No scope for overridable properties `[${identifier}]`
                }
                else {
                    property.scope = types.isUndefinedOrNull(property.scope) ? scope : property.scope;
                    property.restricted = types.isUndefinedOrNull(property.restricted) ? !!restrictedProperties?.includes(key) : property.restricted;
                }
                if (property.experiment) {
                    if (!property.tags?.some(tag => tag.toLowerCase() === 'onexp')) {
                        property.tags = property.tags ?? [];
                        property.tags.push('onExP');
                    }
                }
                else if (property.tags?.some(tag => tag.toLowerCase() === 'onexp')) {
                    console.error(`Invalid tag 'onExP' found for property '${key}'. Please use 'experiment' property instead.`);
                    property.experiment = { mode: 'startup' };
                }
                const excluded = properties[key].hasOwnProperty('included') && !properties[key].included;
                const policyName = properties[key].policy?.name;
                if (excluded) {
                    this.excludedConfigurationProperties[key] = properties[key];
                    if (policyName) {
                        this.policyConfigurations.set(policyName, key);
                        bucket.add(key);
                    }
                    delete properties[key];
                }
                else {
                    bucket.add(key);
                    if (policyName) {
                        this.policyConfigurations.set(policyName, key);
                    }
                    this.configurationProperties[key] = properties[key];
                    if (!properties[key].deprecationMessage && properties[key].markdownDeprecationMessage) {
                        // If not set, default deprecationMessage to the markdown source
                        properties[key].deprecationMessage = properties[key].markdownDeprecationMessage;
                    }
                }
            }
        }
        const subNodes = configuration.allOf;
        if (subNodes) {
            for (const node of subNodes) {
                this.validateAndRegisterProperties(node, validate, extensionInfo, restrictedProperties, scope, bucket);
            }
        }
    }
    // Only for tests
    getConfigurations() {
        return this.configurationContributors;
    }
    getConfigurationProperties() {
        return this.configurationProperties;
    }
    getPolicyConfigurations() {
        return this.policyConfigurations;
    }
    getExcludedConfigurationProperties() {
        return this.excludedConfigurationProperties;
    }
    getRegisteredDefaultConfigurations() {
        return [...this.registeredConfigurationDefaults];
    }
    getConfigurationDefaultsOverrides() {
        const configurationDefaultsOverrides = new Map();
        for (const [key, value] of this.configurationDefaultsOverrides) {
            if (value.configurationDefaultOverrideValue) {
                configurationDefaultsOverrides.set(key, value.configurationDefaultOverrideValue);
            }
        }
        return configurationDefaultsOverrides;
    }
    registerJSONConfiguration(configuration) {
        const register = (configuration) => {
            const properties = configuration.properties;
            if (properties) {
                for (const key in properties) {
                    this.updateSchema(key, properties[key]);
                }
            }
            const subNodes = configuration.allOf;
            subNodes?.forEach(register);
        };
        register(configuration);
    }
    updateSchema(key, property) {
        allSettings.properties[key] = property;
        switch (property.scope) {
            case 1 /* ConfigurationScope.APPLICATION */:
                applicationSettings.properties[key] = property;
                break;
            case 2 /* ConfigurationScope.MACHINE */:
                machineSettings.properties[key] = property;
                break;
            case 3 /* ConfigurationScope.APPLICATION_MACHINE */:
                applicationMachineSettings.properties[key] = property;
                break;
            case 7 /* ConfigurationScope.MACHINE_OVERRIDABLE */:
                machineOverridableSettings.properties[key] = property;
                break;
            case 4 /* ConfigurationScope.WINDOW */:
                windowSettings.properties[key] = property;
                break;
            case 5 /* ConfigurationScope.RESOURCE */:
                resourceSettings.properties[key] = property;
                break;
            case 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */:
                resourceSettings.properties[key] = property;
                this.resourceLanguageSettingsSchema.properties[key] = property;
                break;
        }
    }
    removeFromSchema(key, property) {
        delete allSettings.properties[key];
        switch (property.scope) {
            case 1 /* ConfigurationScope.APPLICATION */:
                delete applicationSettings.properties[key];
                break;
            case 2 /* ConfigurationScope.MACHINE */:
                delete machineSettings.properties[key];
                break;
            case 3 /* ConfigurationScope.APPLICATION_MACHINE */:
                delete applicationMachineSettings.properties[key];
                break;
            case 7 /* ConfigurationScope.MACHINE_OVERRIDABLE */:
                delete machineOverridableSettings.properties[key];
                break;
            case 4 /* ConfigurationScope.WINDOW */:
                delete windowSettings.properties[key];
                break;
            case 5 /* ConfigurationScope.RESOURCE */:
            case 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */:
                delete resourceSettings.properties[key];
                delete this.resourceLanguageSettingsSchema.properties[key];
                break;
        }
    }
    updateOverridePropertyPatternKey() {
        for (const overrideIdentifier of this.overrideIdentifiers.values()) {
            const overrideIdentifierProperty = `[${overrideIdentifier}]`;
            const resourceLanguagePropertiesSchema = {
                type: 'object',
                description: nls.localize('overrideSettings.defaultDescription', "Configure editor settings to be overridden for a language."),
                errorMessage: nls.localize('overrideSettings.errorMessage', "This setting does not support per-language configuration."),
                $ref: resourceLanguageSettingsSchemaId,
            };
            this.updatePropertyDefaultValue(overrideIdentifierProperty, resourceLanguagePropertiesSchema);
            allSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
            applicationSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
            applicationMachineSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
            machineSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
            machineOverridableSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
            windowSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
            resourceSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
        }
    }
    registerOverridePropertyPatternKey() {
        const resourceLanguagePropertiesSchema = {
            type: 'object',
            description: nls.localize('overrideSettings.defaultDescription', "Configure editor settings to be overridden for a language."),
            errorMessage: nls.localize('overrideSettings.errorMessage', "This setting does not support per-language configuration."),
            $ref: resourceLanguageSettingsSchemaId,
        };
        allSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
        applicationSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
        applicationMachineSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
        machineSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
        machineOverridableSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
        windowSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
        resourceSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
        this._onDidSchemaChange.fire();
    }
    updatePropertyDefaultValue(key, property) {
        const configurationdefaultOverride = this.configurationDefaultsOverrides.get(key)?.configurationDefaultOverrideValue;
        let defaultValue = undefined;
        let defaultSource = undefined;
        if (configurationdefaultOverride
            && (!property.disallowConfigurationDefault || !configurationdefaultOverride.source) // Prevent overriding the default value if the property is disallowed to be overridden by configuration defaults from extensions
        ) {
            defaultValue = configurationdefaultOverride.value;
            defaultSource = configurationdefaultOverride.source;
        }
        if (types.isUndefined(defaultValue)) {
            defaultValue = property.defaultDefaultValue;
            defaultSource = undefined;
        }
        if (types.isUndefined(defaultValue)) {
            defaultValue = getDefaultValue(property.type);
        }
        property.default = defaultValue;
        property.defaultValueSource = defaultSource;
    }
}
const OVERRIDE_IDENTIFIER_PATTERN = `\\[([^\\]]+)\\]`;
const OVERRIDE_IDENTIFIER_REGEX = new RegExp(OVERRIDE_IDENTIFIER_PATTERN, 'g');
export const OVERRIDE_PROPERTY_PATTERN = `^(${OVERRIDE_IDENTIFIER_PATTERN})+$`;
export const OVERRIDE_PROPERTY_REGEX = new RegExp(OVERRIDE_PROPERTY_PATTERN);
export function overrideIdentifiersFromKey(key) {
    const identifiers = [];
    if (OVERRIDE_PROPERTY_REGEX.test(key)) {
        let matches = OVERRIDE_IDENTIFIER_REGEX.exec(key);
        while (matches?.length) {
            const identifier = matches[1].trim();
            if (identifier) {
                identifiers.push(identifier);
            }
            matches = OVERRIDE_IDENTIFIER_REGEX.exec(key);
        }
    }
    return distinct(identifiers);
}
export function keyFromOverrideIdentifiers(overrideIdentifiers) {
    return overrideIdentifiers.reduce((result, overrideIdentifier) => `${result}[${overrideIdentifier}]`, '');
}
export function getDefaultValue(type) {
    const t = Array.isArray(type) ? type[0] : type;
    switch (t) {
        case 'boolean':
            return false;
        case 'integer':
        case 'number':
            return 0;
        case 'string':
            return '';
        case 'array':
            return [];
        case 'object':
            return {};
        default:
            return null;
    }
}
const configurationRegistry = new ConfigurationRegistry();
Registry.add(Extensions.Configuration, configurationRegistry);
export function validateProperty(property, schema, extensionId) {
    if (!property.trim()) {
        return nls.localize('config.property.empty', "Cannot register an empty property");
    }
    if (OVERRIDE_PROPERTY_REGEX.test(property)) {
        return nls.localize('config.property.languageDefault', "Cannot register '{0}'. This matches property pattern '\\\\[.*\\\\]$' for describing language specific editor settings. Use 'configurationDefaults' contribution.", property);
    }
    if (configurationRegistry.getConfigurationProperties()[property] !== undefined && (!extensionId || !EXTENSION_UNIFICATION_EXTENSION_IDS.has(extensionId.toLowerCase()))) {
        return nls.localize('config.property.duplicate', "Cannot register '{0}'. This property is already registered.", property);
    }
    if (schema.policy?.name && configurationRegistry.getPolicyConfigurations().get(schema.policy?.name) !== undefined) {
        return nls.localize('config.policy.duplicate', "Cannot register '{0}'. The associated policy {1} is already registered with {2}.", property, schema.policy?.name, configurationRegistry.getPolicyConfigurations().get(schema.policy?.name));
    }
    return null;
}
export function getScopes() {
    const scopes = [];
    const configurationProperties = configurationRegistry.getConfigurationProperties();
    for (const key of Object.keys(configurationProperties)) {
        scopes.push([key, configurationProperties[key].scope]);
    }
    scopes.push(['launch', 5 /* ConfigurationScope.RESOURCE */]);
    scopes.push(['task', 5 /* ConfigurationScope.RESOURCE */]);
    return scopes;
}
export function getAllConfigurationProperties(configurationNode) {
    const result = {};
    for (const configuration of configurationNode) {
        const properties = configuration.properties;
        if (types.isObject(properties)) {
            for (const key in properties) {
                result[key] = properties[key];
            }
        }
        if (configuration.allOf) {
            Object.assign(result, getAllConfigurationProperties(configuration.allOf));
        }
    }
    return result;
}
export function parseScope(scope) {
    switch (scope) {
        case 'application':
            return 1 /* ConfigurationScope.APPLICATION */;
        case 'machine':
            return 2 /* ConfigurationScope.MACHINE */;
        case 'resource':
            return 5 /* ConfigurationScope.RESOURCE */;
        case 'machine-overridable':
            return 7 /* ConfigurationScope.MACHINE_OVERRIDABLE */;
        case 'language-overridable':
            return 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */;
        default:
            return 4 /* ConfigurationScope.WINDOW */;
    }
}
// Used for extension unification. Should be removed when complete.
export const EXTENSION_UNIFICATION_EXTENSION_IDS = new Set(product.defaultChatAgent ? [product.defaultChatAgent.extensionId, product.defaultChatAgent.chatExtensionId].map(id => id.toLowerCase()) : []);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFMUQsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLCtCQUErQixDQUFDO0FBRS9ELE9BQU8sS0FBSyxLQUFLLE1BQU0sK0JBQStCLENBQUM7QUFDdkQsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQkFBaUIsQ0FBQztBQUN2QyxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUNuRSxPQUFPLEVBQUUsVUFBVSxJQUFJLGNBQWMsRUFBNkIsTUFBTSxzREFBc0QsQ0FBQztBQUMvSCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFN0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQy9ELE9BQU8sT0FBTyxNQUFNLGlDQUFpQyxDQUFDO0FBRXRELE1BQU0sQ0FBTixJQUFZLHFCQUdYO0FBSEQsV0FBWSxxQkFBcUI7SUFDaEMsb0RBQTJCLENBQUE7SUFDM0Isc0RBQTZCLENBQUE7QUFDOUIsQ0FBQyxFQUhXLHFCQUFxQixLQUFyQixxQkFBcUIsUUFHaEM7QUFFRCxNQUFNLENBQUMsTUFBTSxVQUFVLEdBQUc7SUFDekIsYUFBYSxFQUFFLGtDQUFrQztDQUNqRCxDQUFDO0FBdUdGLE1BQU0sQ0FBTixJQUFrQixrQkE2QmpCO0FBN0JELFdBQWtCLGtCQUFrQjtJQUNuQzs7T0FFRztJQUNILHlFQUFlLENBQUE7SUFDZjs7T0FFRztJQUNILGlFQUFPLENBQUE7SUFDUDs7T0FFRztJQUNILHlGQUFtQixDQUFBO0lBQ25COztPQUVHO0lBQ0gsK0RBQU0sQ0FBQTtJQUNOOztPQUVHO0lBQ0gsbUVBQVEsQ0FBQTtJQUNSOztPQUVHO0lBQ0gsMkZBQW9CLENBQUE7SUFDcEI7O09BRUc7SUFDSCx5RkFBbUIsQ0FBQTtBQUNwQixDQUFDLEVBN0JpQixrQkFBa0IsS0FBbEIsa0JBQWtCLFFBNkJuQztBQWlJRCxNQUFNLENBQUMsTUFBTSxXQUFXLEdBQXdJLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxFQUFFLEVBQUUsQ0FBQztBQUMxTSxNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBd0ksRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFFLGlCQUFpQixFQUFFLEVBQUUsRUFBRSxDQUFDO0FBQ2xOLE1BQU0sQ0FBQyxNQUFNLDBCQUEwQixHQUF3SSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUUsaUJBQWlCLEVBQUUsRUFBRSxFQUFFLENBQUM7QUFDek4sTUFBTSxDQUFDLE1BQU0sZUFBZSxHQUF3SSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUUsaUJBQWlCLEVBQUUsRUFBRSxFQUFFLENBQUM7QUFDOU0sTUFBTSxDQUFDLE1BQU0sMEJBQTBCLEdBQXdJLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxFQUFFLEVBQUUsQ0FBQztBQUN6TixNQUFNLENBQUMsTUFBTSxjQUFjLEdBQXdJLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxFQUFFLEVBQUUsQ0FBQztBQUM3TSxNQUFNLENBQUMsTUFBTSxnQkFBZ0IsR0FBd0ksRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFFLGlCQUFpQixFQUFFLEVBQUUsRUFBRSxDQUFDO0FBRS9NLE1BQU0sQ0FBQyxNQUFNLGdDQUFnQyxHQUFHLDRDQUE0QyxDQUFDO0FBQzdGLE1BQU0sQ0FBQyxNQUFNLDZCQUE2QixHQUFHLGlEQUFpRCxDQUFDO0FBRS9GLE1BQU0sb0JBQW9CLEdBQUcsUUFBUSxDQUFDLEVBQUUsQ0FBNEIsY0FBYyxDQUFDLGdCQUFnQixDQUFDLENBQUM7QUFFckcsTUFBTSxxQkFBc0IsU0FBUSxVQUFVO0lBa0I3QztRQUNDLEtBQUssRUFBRSxDQUFDO1FBakJRLG9DQUErQixHQUE2QixFQUFFLENBQUM7UUFRL0Qsd0JBQW1CLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUV4Qyx1QkFBa0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUNqRSxzQkFBaUIsR0FBZ0IsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQztRQUV2RCw4QkFBeUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFvRSxDQUFDLENBQUM7UUFDcEksNkJBQXdCLEdBQUcsSUFBSSxDQUFDLHlCQUF5QixDQUFDLEtBQUssQ0FBQztRQUl4RSxJQUFJLENBQUMsOEJBQThCLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUNoRCxJQUFJLENBQUMseUNBQXlDLEdBQUc7WUFDaEQsRUFBRSxFQUFFLGtCQUFrQjtZQUN0QixLQUFLLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyw2Q0FBNkMsRUFBRSwwQ0FBMEMsQ0FBQztZQUM5RyxVQUFVLEVBQUUsRUFBRTtTQUNkLENBQUM7UUFDRixJQUFJLENBQUMseUJBQXlCLEdBQUcsQ0FBQyxJQUFJLENBQUMseUNBQXlDLENBQUMsQ0FBQztRQUNsRixJQUFJLENBQUMsOEJBQThCLEdBQUc7WUFDckMsVUFBVSxFQUFFLEVBQUU7WUFDZCxpQkFBaUIsRUFBRSxFQUFFO1lBQ3JCLG9CQUFvQixFQUFFLElBQUk7WUFDMUIsbUJBQW1CLEVBQUUsSUFBSTtZQUN6QixhQUFhLEVBQUUsSUFBSTtTQUNuQixDQUFDO1FBQ0YsSUFBSSxDQUFDLHVCQUF1QixHQUFHLEVBQUUsQ0FBQztRQUNsQyxJQUFJLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxHQUFHLEVBQXNCLENBQUM7UUFDMUQsSUFBSSxDQUFDLCtCQUErQixHQUFHLEVBQUUsQ0FBQztRQUUxQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsZ0NBQWdDLEVBQUUsSUFBSSxDQUFDLDhCQUE4QixDQUFDLENBQUM7UUFDM0csSUFBSSxDQUFDLGtDQUFrQyxFQUFFLENBQUM7SUFDM0MsQ0FBQztJQUVNLHFCQUFxQixDQUFDLGFBQWlDLEVBQUUsV0FBb0IsSUFBSTtRQUN2RixJQUFJLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxhQUFhLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN2RCxPQUFPLGFBQWEsQ0FBQztJQUN0QixDQUFDO0lBRU0sc0JBQXNCLENBQUMsY0FBb0MsRUFBRSxXQUFvQixJQUFJO1FBQzNGLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFDckMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLGNBQWMsRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFFcEUsb0JBQW9CLENBQUMsY0FBYyxDQUFDLGdDQUFnQyxFQUFFLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO1FBQzNHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUMvQixJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQztJQUNyRCxDQUFDO0lBRU0sd0JBQXdCLENBQUMsY0FBb0M7UUFDbkUsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUNyQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsY0FBYyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBRTVELG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxnQ0FBZ0MsRUFBRSxJQUFJLENBQUMsOEJBQThCLENBQUMsQ0FBQztRQUMzRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDL0IsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVNLG9CQUFvQixDQUFDLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBK0Q7UUFDdkcsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUNyQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3BELElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBRXRELG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxnQ0FBZ0MsRUFBRSxJQUFJLENBQUMsOEJBQThCLENBQUMsQ0FBQztRQUMzRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDL0IsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVNLDZCQUE2QixDQUFDLHFCQUErQztRQUNuRixNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO1FBQ3JDLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxxQkFBcUIsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUN4RSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDL0IsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFFTywrQkFBK0IsQ0FBQyxxQkFBK0MsRUFBRSxNQUFtQjtRQUUzRyxJQUFJLENBQUMsK0JBQStCLENBQUMsSUFBSSxDQUFDLEdBQUcscUJBQXFCLENBQUMsQ0FBQztRQUVwRSxNQUFNLG1CQUFtQixHQUFhLEVBQUUsQ0FBQztRQUV6QyxLQUFLLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLElBQUkscUJBQXFCLEVBQUUsQ0FBQztZQUMzRCxLQUFLLE1BQU0sR0FBRyxJQUFJLFNBQVMsRUFBRSxDQUFDO2dCQUM3QixNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUVoQixNQUFNLG1DQUFtQyxHQUFHLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO3VCQUNwRixJQUFJLENBQUMsOEJBQThCLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxFQUFFLDZCQUE2QixFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBRSxDQUFDO2dCQUVsRyxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQzdCLG1DQUFtQyxDQUFDLDZCQUE2QixDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO2dCQUUxRixrREFBa0Q7Z0JBQ2xELElBQUksdUJBQXVCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQ3ZDLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLCtDQUErQyxDQUFDLEdBQUcsRUFBRSxLQUFtQyxFQUFFLE1BQU0sRUFBRSxtQ0FBbUMsQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO29CQUN6TSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQzt3QkFDekIsU0FBUztvQkFDVixDQUFDO29CQUVELG1DQUFtQyxDQUFDLGlDQUFpQyxHQUFHLGtCQUFrQixDQUFDO29CQUMzRixJQUFJLENBQUMsNkJBQTZCLENBQUMsR0FBRyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxDQUFDO29CQUNwRSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsR0FBRywwQkFBMEIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUM5RCxDQUFDO2dCQUVELHNEQUFzRDtxQkFDakQsQ0FBQztvQkFDTCxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxrREFBa0QsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxtQ0FBbUMsQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO29CQUM5SyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQzt3QkFDekIsU0FBUztvQkFDVixDQUFDO29CQUVELG1DQUFtQyxDQUFDLGlDQUFpQyxHQUFHLGtCQUFrQixDQUFDO29CQUMzRixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ25ELElBQUksUUFBUSxFQUFFLENBQUM7d0JBQ2QsSUFBSSxDQUFDLDBCQUEwQixDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQzt3QkFDL0MsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7b0JBQ2xDLENBQUM7Z0JBQ0YsQ0FBQztZQUVGLENBQUM7UUFDRixDQUFDO1FBRUQsSUFBSSxDQUFDLDZCQUE2QixDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDekQsQ0FBQztJQUVNLCtCQUErQixDQUFDLHFCQUErQztRQUNyRixNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO1FBQ3JDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxxQkFBcUIsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUMxRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDL0IsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFFTyxpQ0FBaUMsQ0FBQyxxQkFBK0MsRUFBRSxNQUFtQjtRQUM3RyxLQUFLLE1BQU0sb0JBQW9CLElBQUkscUJBQXFCLEVBQUUsQ0FBQztZQUMxRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsK0JBQStCLENBQUMsT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUM7WUFDakYsSUFBSSxLQUFLLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDbEIsSUFBSSxDQUFDLCtCQUErQixDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDdkQsQ0FBQztRQUNGLENBQUM7UUFFRCxLQUFLLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLElBQUkscUJBQXFCLEVBQUUsQ0FBQztZQUMzRCxLQUFLLE1BQU0sR0FBRyxJQUFJLFNBQVMsRUFBRSxDQUFDO2dCQUM3QixNQUFNLG1DQUFtQyxHQUFHLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ3pGLElBQUksQ0FBQyxtQ0FBbUMsRUFBRSxDQUFDO29CQUMxQyxTQUFTO2dCQUNWLENBQUM7Z0JBRUQsTUFBTSxLQUFLLEdBQUcsbUNBQW1DLENBQUMsNkJBQTZCO3FCQUM3RSxTQUFTLENBQUMsNEJBQTRCLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsNEJBQTRCLENBQUMsTUFBTSxFQUFFLEVBQUUsS0FBSyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyw0QkFBNEIsQ0FBQyxLQUFLLEtBQUssU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BLLElBQUksS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQ2xCLFNBQVM7Z0JBQ1YsQ0FBQztnQkFFRCxtQ0FBbUMsQ0FBQyw2QkFBNkIsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNuRixJQUFJLG1DQUFtQyxDQUFDLDZCQUE2QixDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztvQkFDcEYsSUFBSSxDQUFDLDhCQUE4QixDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDakQsQ0FBQztnQkFFRCxJQUFJLHVCQUF1QixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO29CQUN2QyxJQUFJLGlDQUFpRixDQUFDO29CQUN0RixLQUFLLE1BQU0sNEJBQTRCLElBQUksbUNBQW1DLENBQUMsNkJBQTZCLEVBQUUsQ0FBQzt3QkFDOUcsaUNBQWlDLEdBQUcsSUFBSSxDQUFDLCtDQUErQyxDQUFDLEdBQUcsRUFBRSw0QkFBNEIsQ0FBQyxLQUFtQyxFQUFFLDRCQUE0QixDQUFDLE1BQU0sRUFBRSxpQ0FBaUMsQ0FBQyxDQUFDO29CQUN6TyxDQUFDO29CQUNELElBQUksaUNBQWlDLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLGlDQUFpQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7d0JBQ3hHLG1DQUFtQyxDQUFDLGlDQUFpQyxHQUFHLGlDQUFpQyxDQUFDO3dCQUMxRyxJQUFJLENBQUMsNkJBQTZCLENBQUMsR0FBRyxFQUFFLGlDQUFpQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO29CQUNwRixDQUFDO3lCQUFNLENBQUM7d0JBQ1AsSUFBSSxDQUFDLDhCQUE4QixDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQzt3QkFDaEQsT0FBTyxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLENBQUM7d0JBQ3pDLE9BQU8sSUFBSSxDQUFDLHlDQUF5QyxDQUFDLFVBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDeEUsQ0FBQztnQkFDRixDQUFDO3FCQUFNLENBQUM7b0JBQ1AsSUFBSSxpQ0FBaUYsQ0FBQztvQkFDdEYsS0FBSyxNQUFNLDRCQUE0QixJQUFJLG1DQUFtQyxDQUFDLDZCQUE2QixFQUFFLENBQUM7d0JBQzlHLGlDQUFpQyxHQUFHLElBQUksQ0FBQyxrREFBa0QsQ0FBQyxHQUFHLEVBQUUsNEJBQTRCLENBQUMsS0FBSyxFQUFFLDRCQUE0QixDQUFDLE1BQU0sRUFBRSxpQ0FBaUMsQ0FBQyxDQUFDO29CQUM5TSxDQUFDO29CQUNELG1DQUFtQyxDQUFDLGlDQUFpQyxHQUFHLGlDQUFpQyxDQUFDO29CQUMxRyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ25ELElBQUksUUFBUSxFQUFFLENBQUM7d0JBQ2QsSUFBSSxDQUFDLDBCQUEwQixDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQzt3QkFDL0MsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7b0JBQ2xDLENBQUM7Z0JBQ0YsQ0FBQztnQkFDRCxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2pCLENBQUM7UUFDRixDQUFDO1FBQ0QsSUFBSSxDQUFDLGdDQUFnQyxFQUFFLENBQUM7SUFDekMsQ0FBQztJQUVPLDZCQUE2QixDQUFDLEdBQVcsRUFBRSxrQkFBc0QsRUFBRSxNQUFrQztRQUM1SSxNQUFNLFFBQVEsR0FBMkM7WUFDeEQsT0FBTyxFQUFFO2dCQUNSLEVBQUUsRUFBRSxJQUFJLENBQUMseUNBQXlDLENBQUMsRUFBRTtnQkFDckQsS0FBSyxFQUFFLElBQUksQ0FBQyx5Q0FBeUMsQ0FBQyxLQUFLO2dCQUMzRCxLQUFLLEVBQUUsSUFBSSxDQUFDLHlDQUF5QyxDQUFDLEtBQUs7Z0JBQzNELGFBQWEsRUFBRSxJQUFJLENBQUMseUNBQXlDLENBQUMsYUFBYTthQUMzRTtZQUNELElBQUksRUFBRSxRQUFRO1lBQ2QsT0FBTyxFQUFFLGtCQUFrQixDQUFDLEtBQUs7WUFDakMsV0FBVyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsMENBQTBDLEVBQUUsOENBQThDLEVBQUUsNkJBQTZCLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDekosSUFBSSxFQUFFLGdDQUFnQztZQUN0QyxtQkFBbUIsRUFBRSxrQkFBa0IsQ0FBQyxLQUFLO1lBQzdDLE1BQU07WUFDTixrQkFBa0IsRUFBRSxNQUFNO1NBQzFCLENBQUM7UUFDRixJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLEdBQUcsUUFBUSxDQUFDO1FBQzdDLElBQUksQ0FBQyx5Q0FBeUMsQ0FBQyxVQUFXLENBQUMsR0FBRyxDQUFDLEdBQUcsUUFBUSxDQUFDO0lBQzVFLENBQUM7SUFFTywrQ0FBK0MsQ0FBQyxrQkFBMEIsRUFBRSx3QkFBb0QsRUFBRSxXQUF1QyxFQUFFLHVCQUF1RTtRQUN6UCxNQUFNLFlBQVksR0FBRyx1QkFBdUIsRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDO1FBQzFELE1BQU0sTUFBTSxHQUFHLHVCQUF1QixFQUFFLE1BQU0sSUFBSSxJQUFJLEdBQUcsRUFBMEIsQ0FBQztRQUVwRix5QkFBeUI7UUFDekIsSUFBSSxDQUFDLENBQUMsTUFBTSxZQUFZLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDOUIsT0FBTyxDQUFDLEtBQUssQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDO1lBQ3pELE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxLQUFLLE1BQU0sV0FBVyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsRUFBRSxDQUFDO1lBQ2pFLE1BQU0sb0JBQW9CLEdBQUcsd0JBQXdCLENBQUMsV0FBVyxDQUFDLENBQUM7WUFFbkUsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQztnQkFDM0QsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFFLFlBQTJDLENBQUMsV0FBVyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFFLFlBQTJDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRTdKLHlGQUF5RjtZQUN6RixJQUFJLGVBQWUsRUFBRSxDQUFDO2dCQUNwQixZQUEyQyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFFLFlBQTJDLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsR0FBRyxvQkFBb0IsRUFBRSxDQUFDO2dCQUM5SiwrQ0FBK0M7Z0JBQy9DLElBQUksV0FBVyxFQUFFLENBQUM7b0JBQ2pCLEtBQUssTUFBTSxTQUFTLElBQUksb0JBQW9CLEVBQUUsQ0FBQzt3QkFDOUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFdBQVcsSUFBSSxTQUFTLEVBQUUsRUFBRSxXQUFXLENBQUMsQ0FBQztvQkFDeEQsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztZQUVELGtDQUFrQztpQkFDN0IsQ0FBQztnQkFDSixZQUEyQyxDQUFDLFdBQVcsQ0FBQyxHQUFHLG9CQUFvQixDQUFDO2dCQUNqRixJQUFJLFdBQVcsRUFBRSxDQUFDO29CQUNqQixNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsQ0FBQztnQkFDdEMsQ0FBQztxQkFBTSxDQUFDO29CQUNQLE1BQU0sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQzVCLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUVELE9BQU8sRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxDQUFDO0lBQ3hDLENBQUM7SUFFTyxrREFBa0QsQ0FBQyxXQUFtQixFQUFFLEtBQWMsRUFBRSxZQUF3QyxFQUFFLHVCQUF1RTtRQUNoTixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDM0QsTUFBTSxvQkFBb0IsR0FBRyx1QkFBdUIsRUFBRSxLQUFLLElBQUksUUFBUSxFQUFFLG1CQUFtQixDQUFDO1FBQzdGLElBQUksTUFBTSxHQUFnRCxZQUFZLENBQUM7UUFFdkUsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUM7WUFDNUMsQ0FDQyxRQUFRLEtBQUssU0FBUyxJQUFJLFFBQVEsQ0FBQyxJQUFJLEtBQUssUUFBUTtnQkFDcEQsUUFBUSxLQUFLLFNBQVMsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUMsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FDM0csQ0FBQztRQUVILHlGQUF5RjtRQUN6RixJQUFJLGVBQWUsRUFBRSxDQUFDO1lBQ3JCLE1BQU0sR0FBRyx1QkFBdUIsRUFBRSxNQUFNLElBQUksSUFBSSxHQUFHLEVBQTBCLENBQUM7WUFFOUUseUJBQXlCO1lBQ3pCLElBQUksQ0FBQyxDQUFDLE1BQU0sWUFBWSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUM5QixPQUFPLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7Z0JBQ2pELE9BQU8sU0FBUyxDQUFDO1lBQ2xCLENBQUM7WUFFRCxLQUFLLE1BQU0sU0FBUyxJQUFLLEtBQW9DLEVBQUUsQ0FBQztnQkFDL0QsSUFBSSxZQUFZLEVBQUUsQ0FBQztvQkFDbEIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFdBQVcsSUFBSSxTQUFTLEVBQUUsRUFBRSxZQUFZLENBQUMsQ0FBQztnQkFDekQsQ0FBQztZQUNGLENBQUM7WUFDRCxLQUFLLEdBQUcsRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBSSxLQUFvQyxFQUFFLENBQUM7UUFDN0gsQ0FBQztRQUVELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUM7SUFDMUIsQ0FBQztJQUVNLGtCQUFrQixDQUFDLEtBQTBCO1FBQ25ELG1CQUFtQjtRQUNuQixJQUFJLGlCQUFpQixHQUFHLEtBQUssQ0FBQztRQUM5QixNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO1FBQ3JDLElBQUksS0FBSyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQzNCLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxLQUFLLENBQUMsZUFBZSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQzFFLGlCQUFpQixHQUFHLElBQUksQ0FBQztRQUMxQixDQUFDO1FBQ0QsZ0JBQWdCO1FBQ2hCLElBQUksS0FBSyxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3pCLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxLQUFLLENBQUMsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQ3RFLGlCQUFpQixHQUFHLElBQUksQ0FBQztRQUMxQixDQUFDO1FBQ0QseUJBQXlCO1FBQ3pCLElBQUksS0FBSyxDQUFDLHFCQUFxQixFQUFFLENBQUM7WUFDakMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLEtBQUssQ0FBQyxxQkFBcUIsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBQ0Qsc0JBQXNCO1FBQ3RCLElBQUksS0FBSyxDQUFDLG1CQUFtQixFQUFFLENBQUM7WUFDL0IsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDN0UsQ0FBQztRQUNELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUMvQixJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztJQUN4RSxDQUFDO0lBRU0sZ0NBQWdDLENBQUMsR0FBRyxjQUFvQztRQUM5RSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDaEMsQ0FBQztJQUVNLDJCQUEyQixDQUFDLG1CQUE2QjtRQUMvRCxJQUFJLENBQUMsNkJBQTZCLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUN4RCxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDaEMsQ0FBQztJQUVPLDZCQUE2QixDQUFDLG1CQUE2QjtRQUNsRSxLQUFLLE1BQU0sa0JBQWtCLElBQUksbUJBQW1CLEVBQUUsQ0FBQztZQUN0RCxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDbEQsQ0FBQztRQUNELElBQUksQ0FBQyxnQ0FBZ0MsRUFBRSxDQUFDO0lBQ3pDLENBQUM7SUFFTyx3QkFBd0IsQ0FBQyxjQUFvQyxFQUFFLFFBQWlCLEVBQUUsTUFBbUI7UUFFNUcsY0FBYyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsRUFBRTtZQUV0QyxJQUFJLENBQUMsNkJBQTZCLENBQUMsYUFBYSxFQUFFLFFBQVEsRUFBRSxhQUFhLENBQUMsYUFBYSxFQUFFLGFBQWEsQ0FBQyxvQkFBb0IsRUFBRSxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFFaEosSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUNuRCxJQUFJLENBQUMseUJBQXlCLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDL0MsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU8sMEJBQTBCLENBQUMsY0FBb0MsRUFBRSxNQUFtQjtRQUUzRixNQUFNLHVCQUF1QixHQUFHLENBQUMsYUFBaUMsRUFBRSxFQUFFO1lBQ3JFLElBQUksYUFBYSxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUM5QixLQUFLLE1BQU0sR0FBRyxJQUFJLGFBQWEsQ0FBQyxVQUFVLEVBQUUsQ0FBQztvQkFDNUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDaEIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUNuRCxJQUFJLFFBQVEsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUM7d0JBQzVCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDeEQsQ0FBQztvQkFDRCxPQUFPLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDekMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxhQUFhLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQzNELENBQUM7WUFDRixDQUFDO1lBQ0QsYUFBYSxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3JFLENBQUMsQ0FBQztRQUNGLEtBQUssTUFBTSxhQUFhLElBQUksY0FBYyxFQUFFLENBQUM7WUFDNUMsdUJBQXVCLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDdkMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUNwRSxJQUFJLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUNsQixJQUFJLENBQUMseUJBQXlCLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNqRCxDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFTyw2QkFBNkIsQ0FBQyxhQUFpQyxFQUFFLFdBQW9CLElBQUksRUFBRSxhQUF5QyxFQUFFLG9CQUEwQyxFQUFFLHlDQUFxRCxFQUFFLE1BQW1CO1FBQ25RLEtBQUssR0FBRyxLQUFLLENBQUMsaUJBQWlCLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUM7UUFDbkYsTUFBTSxVQUFVLEdBQUcsYUFBYSxDQUFDLFVBQVUsQ0FBQztRQUM1QyxJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ2hCLEtBQUssTUFBTSxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQzlCLE1BQU0sUUFBUSxHQUEyQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ3pFLFFBQVEsQ0FBQyxPQUFPLEdBQUc7b0JBQ2xCLEVBQUUsRUFBRSxhQUFhLENBQUMsRUFBRTtvQkFDcEIsS0FBSyxFQUFFLGFBQWEsQ0FBQyxLQUFLO29CQUMxQixLQUFLLEVBQUUsYUFBYSxDQUFDLEtBQUs7b0JBQzFCLGFBQWEsRUFBRSxhQUFhLENBQUMsYUFBYTtpQkFDMUMsQ0FBQztnQkFDRixJQUFJLFFBQVEsSUFBSSxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO29CQUNwRSxPQUFPLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDdkIsU0FBUztnQkFDVixDQUFDO2dCQUVELFFBQVEsQ0FBQyxNQUFNLEdBQUcsYUFBYSxDQUFDO2dCQUVoQyx1QkFBdUI7Z0JBQ3ZCLFFBQVEsQ0FBQyxtQkFBbUIsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDO2dCQUN2RCxJQUFJLENBQUMsMEJBQTBCLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUUvQyxlQUFlO2dCQUNmLElBQUksdUJBQXVCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQ3ZDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUMsd0RBQXdEO2dCQUNyRixDQUFDO3FCQUFNLENBQUM7b0JBQ1AsUUFBUSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUM7b0JBQ2xGLFFBQVEsQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixFQUFFLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQztnQkFDbEksQ0FBQztnQkFFRCxJQUFJLFFBQVEsQ0FBQyxVQUFVLEVBQUUsQ0FBQztvQkFDekIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxLQUFLLE9BQU8sQ0FBQyxFQUFFLENBQUM7d0JBQ2hFLFFBQVEsQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUM7d0JBQ3BDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUM3QixDQUFDO2dCQUNGLENBQUM7cUJBQU0sSUFBSSxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsS0FBSyxPQUFPLENBQUMsRUFBRSxDQUFDO29CQUN0RSxPQUFPLENBQUMsS0FBSyxDQUFDLDJDQUEyQyxHQUFHLDhDQUE4QyxDQUFDLENBQUM7b0JBQzVHLFFBQVEsQ0FBQyxVQUFVLEdBQUcsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLENBQUM7Z0JBQzNDLENBQUM7Z0JBRUQsTUFBTSxRQUFRLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUM7Z0JBQ3pGLE1BQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDO2dCQUVoRCxJQUFJLFFBQVEsRUFBRSxDQUFDO29CQUNkLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxHQUFHLENBQUMsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQzVELElBQUksVUFBVSxFQUFFLENBQUM7d0JBQ2hCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDO3dCQUMvQyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUNqQixDQUFDO29CQUNELE9BQU8sVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN4QixDQUFDO3FCQUFNLENBQUM7b0JBQ1AsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDaEIsSUFBSSxVQUFVLEVBQUUsQ0FBQzt3QkFDaEIsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLENBQUM7b0JBQ2hELENBQUM7b0JBQ0QsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDcEQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxrQkFBa0IsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsMEJBQTBCLEVBQUUsQ0FBQzt3QkFDdkYsZ0VBQWdFO3dCQUNoRSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsa0JBQWtCLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLDBCQUEwQixDQUFDO29CQUNqRixDQUFDO2dCQUNGLENBQUM7WUFHRixDQUFDO1FBQ0YsQ0FBQztRQUNELE1BQU0sUUFBUSxHQUFHLGFBQWEsQ0FBQyxLQUFLLENBQUM7UUFDckMsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNkLEtBQUssTUFBTSxJQUFJLElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQzdCLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxvQkFBb0IsRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDeEcsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRUQsaUJBQWlCO0lBQ2pCLGlCQUFpQjtRQUNoQixPQUFPLElBQUksQ0FBQyx5QkFBeUIsQ0FBQztJQUN2QyxDQUFDO0lBRUQsMEJBQTBCO1FBQ3pCLE9BQU8sSUFBSSxDQUFDLHVCQUF1QixDQUFDO0lBQ3JDLENBQUM7SUFFRCx1QkFBdUI7UUFDdEIsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUM7SUFDbEMsQ0FBQztJQUVELGtDQUFrQztRQUNqQyxPQUFPLElBQUksQ0FBQywrQkFBK0IsQ0FBQztJQUM3QyxDQUFDO0lBRUQsa0NBQWtDO1FBQ2pDLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFFRCxpQ0FBaUM7UUFDaEMsTUFBTSw4QkFBOEIsR0FBRyxJQUFJLEdBQUcsRUFBOEMsQ0FBQztRQUM3RixLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLDhCQUE4QixFQUFFLENBQUM7WUFDaEUsSUFBSSxLQUFLLENBQUMsaUNBQWlDLEVBQUUsQ0FBQztnQkFDN0MsOEJBQThCLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsaUNBQWlDLENBQUMsQ0FBQztZQUNsRixDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sOEJBQThCLENBQUM7SUFDdkMsQ0FBQztJQUVPLHlCQUF5QixDQUFDLGFBQWlDO1FBQ2xFLE1BQU0sUUFBUSxHQUFHLENBQUMsYUFBaUMsRUFBRSxFQUFFO1lBQ3RELE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxVQUFVLENBQUM7WUFDNUMsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDaEIsS0FBSyxNQUFNLEdBQUcsSUFBSSxVQUFVLEVBQUUsQ0FBQztvQkFDOUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pDLENBQUM7WUFDRixDQUFDO1lBQ0QsTUFBTSxRQUFRLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQztZQUNyQyxRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzdCLENBQUMsQ0FBQztRQUNGLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUN6QixDQUFDO0lBRU8sWUFBWSxDQUFDLEdBQVcsRUFBRSxRQUFzQztRQUN2RSxXQUFXLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFFBQVEsQ0FBQztRQUN2QyxRQUFRLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUN4QjtnQkFDQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsUUFBUSxDQUFDO2dCQUMvQyxNQUFNO1lBQ1A7Z0JBQ0MsZUFBZSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxRQUFRLENBQUM7Z0JBQzNDLE1BQU07WUFDUDtnQkFDQywwQkFBMEIsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsUUFBUSxDQUFDO2dCQUN0RCxNQUFNO1lBQ1A7Z0JBQ0MsMEJBQTBCLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFFBQVEsQ0FBQztnQkFDdEQsTUFBTTtZQUNQO2dCQUNDLGNBQWMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsUUFBUSxDQUFDO2dCQUMxQyxNQUFNO1lBQ1A7Z0JBQ0MsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFFBQVEsQ0FBQztnQkFDNUMsTUFBTTtZQUNQO2dCQUNDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxRQUFRLENBQUM7Z0JBQzVDLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxVQUFXLENBQUMsR0FBRyxDQUFDLEdBQUcsUUFBUSxDQUFDO2dCQUNoRSxNQUFNO1FBQ1IsQ0FBQztJQUNGLENBQUM7SUFFTyxnQkFBZ0IsQ0FBQyxHQUFXLEVBQUUsUUFBc0M7UUFDM0UsT0FBTyxXQUFXLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ25DLFFBQVEsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3hCO2dCQUNDLE9BQU8sbUJBQW1CLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUMzQyxNQUFNO1lBQ1A7Z0JBQ0MsT0FBTyxlQUFlLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN2QyxNQUFNO1lBQ1A7Z0JBQ0MsT0FBTywwQkFBMEIsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ2xELE1BQU07WUFDUDtnQkFDQyxPQUFPLDBCQUEwQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDbEQsTUFBTTtZQUNQO2dCQUNDLE9BQU8sY0FBYyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDdEMsTUFBTTtZQUNQLHlDQUFpQztZQUNqQztnQkFDQyxPQUFPLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDeEMsT0FBTyxJQUFJLENBQUMsOEJBQThCLENBQUMsVUFBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUM1RCxNQUFNO1FBQ1IsQ0FBQztJQUNGLENBQUM7SUFFTyxnQ0FBZ0M7UUFDdkMsS0FBSyxNQUFNLGtCQUFrQixJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDO1lBQ3BFLE1BQU0sMEJBQTBCLEdBQUcsSUFBSSxrQkFBa0IsR0FBRyxDQUFDO1lBQzdELE1BQU0sZ0NBQWdDLEdBQWdCO2dCQUNyRCxJQUFJLEVBQUUsUUFBUTtnQkFDZCxXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxxQ0FBcUMsRUFBRSw0REFBNEQsQ0FBQztnQkFDOUgsWUFBWSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsK0JBQStCLEVBQUUsMkRBQTJELENBQUM7Z0JBQ3hILElBQUksRUFBRSxnQ0FBZ0M7YUFDdEMsQ0FBQztZQUNGLElBQUksQ0FBQywwQkFBMEIsQ0FBQywwQkFBMEIsRUFBRSxnQ0FBZ0MsQ0FBQyxDQUFDO1lBQzlGLFdBQVcsQ0FBQyxVQUFVLENBQUMsMEJBQTBCLENBQUMsR0FBRyxnQ0FBZ0MsQ0FBQztZQUN0RixtQkFBbUIsQ0FBQyxVQUFVLENBQUMsMEJBQTBCLENBQUMsR0FBRyxnQ0FBZ0MsQ0FBQztZQUM5RiwwQkFBMEIsQ0FBQyxVQUFVLENBQUMsMEJBQTBCLENBQUMsR0FBRyxnQ0FBZ0MsQ0FBQztZQUNyRyxlQUFlLENBQUMsVUFBVSxDQUFDLDBCQUEwQixDQUFDLEdBQUcsZ0NBQWdDLENBQUM7WUFDMUYsMEJBQTBCLENBQUMsVUFBVSxDQUFDLDBCQUEwQixDQUFDLEdBQUcsZ0NBQWdDLENBQUM7WUFDckcsY0FBYyxDQUFDLFVBQVUsQ0FBQywwQkFBMEIsQ0FBQyxHQUFHLGdDQUFnQyxDQUFDO1lBQ3pGLGdCQUFnQixDQUFDLFVBQVUsQ0FBQywwQkFBMEIsQ0FBQyxHQUFHLGdDQUFnQyxDQUFDO1FBQzVGLENBQUM7SUFDRixDQUFDO0lBRU8sa0NBQWtDO1FBQ3pDLE1BQU0sZ0NBQWdDLEdBQWdCO1lBQ3JELElBQUksRUFBRSxRQUFRO1lBQ2QsV0FBVyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMscUNBQXFDLEVBQUUsNERBQTRELENBQUM7WUFDOUgsWUFBWSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsK0JBQStCLEVBQUUsMkRBQTJELENBQUM7WUFDeEgsSUFBSSxFQUFFLGdDQUFnQztTQUN0QyxDQUFDO1FBQ0YsV0FBVyxDQUFDLGlCQUFpQixDQUFDLHlCQUF5QixDQUFDLEdBQUcsZ0NBQWdDLENBQUM7UUFDNUYsbUJBQW1CLENBQUMsaUJBQWlCLENBQUMseUJBQXlCLENBQUMsR0FBRyxnQ0FBZ0MsQ0FBQztRQUNwRywwQkFBMEIsQ0FBQyxpQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQyxHQUFHLGdDQUFnQyxDQUFDO1FBQzNHLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQyxHQUFHLGdDQUFnQyxDQUFDO1FBQ2hHLDBCQUEwQixDQUFDLGlCQUFpQixDQUFDLHlCQUF5QixDQUFDLEdBQUcsZ0NBQWdDLENBQUM7UUFDM0csY0FBYyxDQUFDLGlCQUFpQixDQUFDLHlCQUF5QixDQUFDLEdBQUcsZ0NBQWdDLENBQUM7UUFDL0YsZ0JBQWdCLENBQUMsaUJBQWlCLENBQUMseUJBQXlCLENBQUMsR0FBRyxnQ0FBZ0MsQ0FBQztRQUNqRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDaEMsQ0FBQztJQUVPLDBCQUEwQixDQUFDLEdBQVcsRUFBRSxRQUFnRDtRQUMvRixNQUFNLDRCQUE0QixHQUFHLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsaUNBQWlDLENBQUM7UUFDckgsSUFBSSxZQUFZLEdBQUcsU0FBUyxDQUFDO1FBQzdCLElBQUksYUFBYSxHQUFHLFNBQVMsQ0FBQztRQUM5QixJQUFJLDRCQUE0QjtlQUM1QixDQUFDLENBQUMsUUFBUSxDQUFDLDRCQUE0QixJQUFJLENBQUMsNEJBQTRCLENBQUMsTUFBTSxDQUFDLENBQUMsZ0lBQWdJO1VBQ25OLENBQUM7WUFDRixZQUFZLEdBQUcsNEJBQTRCLENBQUMsS0FBSyxDQUFDO1lBQ2xELGFBQWEsR0FBRyw0QkFBNEIsQ0FBQyxNQUFNLENBQUM7UUFDckQsQ0FBQztRQUNELElBQUksS0FBSyxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1lBQ3JDLFlBQVksR0FBRyxRQUFRLENBQUMsbUJBQW1CLENBQUM7WUFDNUMsYUFBYSxHQUFHLFNBQVMsQ0FBQztRQUMzQixDQUFDO1FBQ0QsSUFBSSxLQUFLLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7WUFDckMsWUFBWSxHQUFHLGVBQWUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0MsQ0FBQztRQUNELFFBQVEsQ0FBQyxPQUFPLEdBQUcsWUFBWSxDQUFDO1FBQ2hDLFFBQVEsQ0FBQyxrQkFBa0IsR0FBRyxhQUFhLENBQUM7SUFDN0MsQ0FBQztDQUNEO0FBRUQsTUFBTSwyQkFBMkIsR0FBRyxpQkFBaUIsQ0FBQztBQUN0RCxNQUFNLHlCQUF5QixHQUFHLElBQUksTUFBTSxDQUFDLDJCQUEyQixFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQy9FLE1BQU0sQ0FBQyxNQUFNLHlCQUF5QixHQUFHLEtBQUssMkJBQTJCLEtBQUssQ0FBQztBQUMvRSxNQUFNLENBQUMsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBRTdFLE1BQU0sVUFBVSwwQkFBMEIsQ0FBQyxHQUFXO0lBQ3JELE1BQU0sV0FBVyxHQUFhLEVBQUUsQ0FBQztJQUNqQyxJQUFJLHVCQUF1QixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQ3ZDLElBQUksT0FBTyxHQUFHLHlCQUF5QixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNsRCxPQUFPLE9BQU8sRUFBRSxNQUFNLEVBQUUsQ0FBQztZQUN4QixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDckMsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDaEIsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUM5QixDQUFDO1lBQ0QsT0FBTyxHQUFHLHlCQUF5QixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMvQyxDQUFDO0lBQ0YsQ0FBQztJQUNELE9BQU8sUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQzlCLENBQUM7QUFFRCxNQUFNLFVBQVUsMEJBQTBCLENBQUMsbUJBQTZCO0lBQ3ZFLE9BQU8sbUJBQW1CLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxFQUFFLGtCQUFrQixFQUFFLEVBQUUsQ0FBQyxHQUFHLE1BQU0sSUFBSSxrQkFBa0IsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQzNHLENBQUM7QUFFRCxNQUFNLFVBQVUsZUFBZSxDQUFDLElBQW1DO0lBQ2xFLE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQVMsSUFBSSxDQUFDO0lBQ3ZELFFBQVEsQ0FBQyxFQUFFLENBQUM7UUFDWCxLQUFLLFNBQVM7WUFDYixPQUFPLEtBQUssQ0FBQztRQUNkLEtBQUssU0FBUyxDQUFDO1FBQ2YsS0FBSyxRQUFRO1lBQ1osT0FBTyxDQUFDLENBQUM7UUFDVixLQUFLLFFBQVE7WUFDWixPQUFPLEVBQUUsQ0FBQztRQUNYLEtBQUssT0FBTztZQUNYLE9BQU8sRUFBRSxDQUFDO1FBQ1gsS0FBSyxRQUFRO1lBQ1osT0FBTyxFQUFFLENBQUM7UUFDWDtZQUNDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztBQUNGLENBQUM7QUFFRCxNQUFNLHFCQUFxQixHQUFHLElBQUkscUJBQXFCLEVBQUUsQ0FBQztBQUMxRCxRQUFRLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxhQUFhLEVBQUUscUJBQXFCLENBQUMsQ0FBQztBQUU5RCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsUUFBZ0IsRUFBRSxNQUE4QyxFQUFFLFdBQW9CO0lBQ3RILElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztRQUN0QixPQUFPLEdBQUcsQ0FBQyxRQUFRLENBQUMsdUJBQXVCLEVBQUUsbUNBQW1DLENBQUMsQ0FBQztJQUNuRixDQUFDO0lBQ0QsSUFBSSx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztRQUM1QyxPQUFPLEdBQUcsQ0FBQyxRQUFRLENBQUMsaUNBQWlDLEVBQUUsa0tBQWtLLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDdE8sQ0FBQztJQUNELElBQUkscUJBQXFCLENBQUMsMEJBQTBCLEVBQUUsQ0FBQyxRQUFRLENBQUMsS0FBSyxTQUFTLElBQUksQ0FBQyxDQUFDLFdBQVcsSUFBSSxDQUFDLG1DQUFtQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDekssT0FBTyxHQUFHLENBQUMsUUFBUSxDQUFDLDJCQUEyQixFQUFFLDZEQUE2RCxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQzNILENBQUM7SUFDRCxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUUsSUFBSSxJQUFJLHFCQUFxQixDQUFDLHVCQUF1QixFQUFFLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDbkgsT0FBTyxHQUFHLENBQUMsUUFBUSxDQUFDLHlCQUF5QixFQUFFLGtGQUFrRixFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxxQkFBcUIsQ0FBQyx1QkFBdUIsRUFBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDN08sQ0FBQztJQUNELE9BQU8sSUFBSSxDQUFDO0FBQ2IsQ0FBQztBQUVELE1BQU0sVUFBVSxTQUFTO0lBQ3hCLE1BQU0sTUFBTSxHQUErQyxFQUFFLENBQUM7SUFDOUQsTUFBTSx1QkFBdUIsR0FBRyxxQkFBcUIsQ0FBQywwQkFBMEIsRUFBRSxDQUFDO0lBQ25GLEtBQUssTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLENBQUM7UUFDeEQsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxzQ0FBOEIsQ0FBQyxDQUFDO0lBQ3JELE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLHNDQUE4QixDQUFDLENBQUM7SUFDbkQsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBRUQsTUFBTSxVQUFVLDZCQUE2QixDQUFDLGlCQUF1QztJQUNwRixNQUFNLE1BQU0sR0FBOEQsRUFBRSxDQUFDO0lBQzdFLEtBQUssTUFBTSxhQUFhLElBQUksaUJBQWlCLEVBQUUsQ0FBQztRQUMvQyxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsVUFBVSxDQUFDO1FBQzVDLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO1lBQ2hDLEtBQUssTUFBTSxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQzlCLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDL0IsQ0FBQztRQUNGLENBQUM7UUFDRCxJQUFJLGFBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUN6QixNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSw2QkFBNkIsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUMzRSxDQUFDO0lBQ0YsQ0FBQztJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVELE1BQU0sVUFBVSxVQUFVLENBQUMsS0FBYTtJQUN2QyxRQUFRLEtBQUssRUFBRSxDQUFDO1FBQ2YsS0FBSyxhQUFhO1lBQ2pCLDhDQUFzQztRQUN2QyxLQUFLLFNBQVM7WUFDYiwwQ0FBa0M7UUFDbkMsS0FBSyxVQUFVO1lBQ2QsMkNBQW1DO1FBQ3BDLEtBQUsscUJBQXFCO1lBQ3pCLHNEQUE4QztRQUMvQyxLQUFLLHNCQUFzQjtZQUMxQix1REFBK0M7UUFDaEQ7WUFDQyx5Q0FBaUM7SUFDbkMsQ0FBQztBQUNGLENBQUM7QUFFRCxtRUFBbUU7QUFDbkUsTUFBTSxDQUFDLE1BQU0sbUNBQW1DLEdBQWdCLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxlQUFlLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMifQ==