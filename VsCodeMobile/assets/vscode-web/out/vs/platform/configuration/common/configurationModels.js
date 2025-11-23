/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as arrays from '../../../base/common/arrays.js';
import { Emitter, Event } from '../../../base/common/event.js';
import * as json from '../../../base/common/json.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { getOrSet, ResourceMap } from '../../../base/common/map.js';
import * as objects from '../../../base/common/objects.js';
import * as types from '../../../base/common/types.js';
import { URI } from '../../../base/common/uri.js';
import { addToValueTree, getConfigurationValue, removeFromValueTree, toValuesTree } from './configuration.js';
import { Extensions, overrideIdentifiersFromKey, OVERRIDE_PROPERTY_REGEX } from './configurationRegistry.js';
import { Registry } from '../../registry/common/platform.js';
function freeze(data) {
    return Object.isFrozen(data) ? data : objects.deepFreeze(data);
}
export class ConfigurationModel {
    static createEmptyModel(logService) {
        return new ConfigurationModel({}, [], [], undefined, logService);
    }
    constructor(_contents, _keys, _overrides, _raw, logService) {
        this._contents = _contents;
        this._keys = _keys;
        this._overrides = _overrides;
        this._raw = _raw;
        this.logService = logService;
        this.overrideConfigurations = new Map();
    }
    get rawConfiguration() {
        if (!this._rawConfiguration) {
            if (this._raw) {
                const rawConfigurationModels = (Array.isArray(this._raw) ? this._raw : [this._raw]).map(raw => {
                    if (raw instanceof ConfigurationModel) {
                        return raw;
                    }
                    const parser = new ConfigurationModelParser('', this.logService);
                    parser.parseRaw(raw);
                    return parser.configurationModel;
                });
                this._rawConfiguration = rawConfigurationModels.reduce((previous, current) => current === previous ? current : previous.merge(current), rawConfigurationModels[0]);
            }
            else {
                // raw is same as current
                this._rawConfiguration = this;
            }
        }
        return this._rawConfiguration;
    }
    get contents() {
        return this._contents;
    }
    get overrides() {
        return this._overrides;
    }
    get keys() {
        return this._keys;
    }
    get raw() {
        if (!this._raw) {
            return undefined;
        }
        if (Array.isArray(this._raw) && this._raw.every(raw => raw instanceof ConfigurationModel)) {
            return undefined;
        }
        return this._raw;
    }
    isEmpty() {
        return this._keys.length === 0 && Object.keys(this._contents).length === 0 && this._overrides.length === 0;
    }
    getValue(section) {
        return section ? getConfigurationValue(this.contents, section) : this.contents;
    }
    inspect(section, overrideIdentifier) {
        const that = this;
        return {
            get value() {
                return freeze(that.rawConfiguration.getValue(section));
            },
            get override() {
                return overrideIdentifier ? freeze(that.rawConfiguration.getOverrideValue(section, overrideIdentifier)) : undefined;
            },
            get merged() {
                return freeze(overrideIdentifier ? that.rawConfiguration.override(overrideIdentifier).getValue(section) : that.rawConfiguration.getValue(section));
            },
            get overrides() {
                const overrides = [];
                for (const { contents, identifiers, keys } of that.rawConfiguration.overrides) {
                    const value = new ConfigurationModel(contents, keys, [], undefined, that.logService).getValue(section);
                    if (value !== undefined) {
                        overrides.push({ identifiers, value });
                    }
                }
                return overrides.length ? freeze(overrides) : undefined;
            }
        };
    }
    getOverrideValue(section, overrideIdentifier) {
        const overrideContents = this.getContentsForOverrideIdentifer(overrideIdentifier);
        return overrideContents
            ? section ? getConfigurationValue(overrideContents, section) : overrideContents
            : undefined;
    }
    getKeysForOverrideIdentifier(identifier) {
        const keys = [];
        for (const override of this.overrides) {
            if (override.identifiers.includes(identifier)) {
                keys.push(...override.keys);
            }
        }
        return arrays.distinct(keys);
    }
    getAllOverrideIdentifiers() {
        const result = [];
        for (const override of this.overrides) {
            result.push(...override.identifiers);
        }
        return arrays.distinct(result);
    }
    override(identifier) {
        let overrideConfigurationModel = this.overrideConfigurations.get(identifier);
        if (!overrideConfigurationModel) {
            overrideConfigurationModel = this.createOverrideConfigurationModel(identifier);
            this.overrideConfigurations.set(identifier, overrideConfigurationModel);
        }
        return overrideConfigurationModel;
    }
    merge(...others) {
        const contents = objects.deepClone(this.contents);
        const overrides = objects.deepClone(this.overrides);
        const keys = [...this.keys];
        const raws = this._raw ? Array.isArray(this._raw) ? [...this._raw] : [this._raw] : [this];
        for (const other of others) {
            raws.push(...(other._raw ? Array.isArray(other._raw) ? other._raw : [other._raw] : [other]));
            if (other.isEmpty()) {
                continue;
            }
            this.mergeContents(contents, other.contents);
            for (const otherOverride of other.overrides) {
                const [override] = overrides.filter(o => arrays.equals(o.identifiers, otherOverride.identifiers));
                if (override) {
                    this.mergeContents(override.contents, otherOverride.contents);
                    override.keys.push(...otherOverride.keys);
                    override.keys = arrays.distinct(override.keys);
                }
                else {
                    overrides.push(objects.deepClone(otherOverride));
                }
            }
            for (const key of other.keys) {
                if (keys.indexOf(key) === -1) {
                    keys.push(key);
                }
            }
        }
        return new ConfigurationModel(contents, keys, overrides, !raws.length || raws.every(raw => raw instanceof ConfigurationModel) ? undefined : raws, this.logService);
    }
    createOverrideConfigurationModel(identifier) {
        const overrideContents = this.getContentsForOverrideIdentifer(identifier);
        if (!overrideContents || typeof overrideContents !== 'object' || !Object.keys(overrideContents).length) {
            // If there are no valid overrides, return self
            return this;
        }
        const contents = {};
        for (const key of arrays.distinct([...Object.keys(this.contents), ...Object.keys(overrideContents)])) {
            let contentsForKey = this.contents[key];
            const overrideContentsForKey = overrideContents[key];
            // If there are override contents for the key, clone and merge otherwise use base contents
            if (overrideContentsForKey) {
                // Clone and merge only if base contents and override contents are of type object otherwise just override
                if (typeof contentsForKey === 'object' && typeof overrideContentsForKey === 'object') {
                    contentsForKey = objects.deepClone(contentsForKey);
                    this.mergeContents(contentsForKey, overrideContentsForKey);
                }
                else {
                    contentsForKey = overrideContentsForKey;
                }
            }
            contents[key] = contentsForKey;
        }
        return new ConfigurationModel(contents, this.keys, this.overrides, undefined, this.logService);
    }
    mergeContents(source, target) {
        for (const key of Object.keys(target)) {
            if (key in source) {
                if (types.isObject(source[key]) && types.isObject(target[key])) {
                    this.mergeContents(source[key], target[key]);
                    continue;
                }
            }
            source[key] = objects.deepClone(target[key]);
        }
    }
    getContentsForOverrideIdentifer(identifier) {
        let contentsForIdentifierOnly = null;
        let contents = null;
        const mergeContents = (contentsToMerge) => {
            if (contentsToMerge) {
                if (contents) {
                    this.mergeContents(contents, contentsToMerge);
                }
                else {
                    contents = objects.deepClone(contentsToMerge);
                }
            }
        };
        for (const override of this.overrides) {
            if (override.identifiers.length === 1 && override.identifiers[0] === identifier) {
                contentsForIdentifierOnly = override.contents;
            }
            else if (override.identifiers.includes(identifier)) {
                mergeContents(override.contents);
            }
        }
        // Merge contents of the identifier only at the end to take precedence.
        mergeContents(contentsForIdentifierOnly);
        return contents;
    }
    toJSON() {
        return {
            contents: this.contents,
            overrides: this.overrides,
            keys: this.keys
        };
    }
    // Update methods
    addValue(key, value) {
        this.updateValue(key, value, true);
    }
    setValue(key, value) {
        this.updateValue(key, value, false);
    }
    removeValue(key) {
        const index = this.keys.indexOf(key);
        if (index === -1) {
            return;
        }
        this.keys.splice(index, 1);
        removeFromValueTree(this.contents, key);
        if (OVERRIDE_PROPERTY_REGEX.test(key)) {
            this.overrides.splice(this.overrides.findIndex(o => arrays.equals(o.identifiers, overrideIdentifiersFromKey(key))), 1);
        }
    }
    updateValue(key, value, add) {
        addToValueTree(this.contents, key, value, e => this.logService.error(e));
        add = add || this.keys.indexOf(key) === -1;
        if (add) {
            this.keys.push(key);
        }
        if (OVERRIDE_PROPERTY_REGEX.test(key)) {
            const overrideContents = this.contents[key];
            const identifiers = overrideIdentifiersFromKey(key);
            const override = {
                identifiers,
                keys: Object.keys(overrideContents),
                contents: toValuesTree(overrideContents, message => this.logService.error(message)),
            };
            const index = this.overrides.findIndex(o => arrays.equals(o.identifiers, identifiers));
            if (index !== -1) {
                this.overrides[index] = override;
            }
            else {
                this.overrides.push(override);
            }
        }
    }
}
export class ConfigurationModelParser {
    constructor(_name, logService) {
        this._name = _name;
        this.logService = logService;
        this._raw = null;
        this._configurationModel = null;
        this._restrictedConfigurations = [];
        this._parseErrors = [];
    }
    get configurationModel() {
        return this._configurationModel || ConfigurationModel.createEmptyModel(this.logService);
    }
    get restrictedConfigurations() {
        return this._restrictedConfigurations;
    }
    get errors() {
        return this._parseErrors;
    }
    parse(content, options) {
        if (!types.isUndefinedOrNull(content)) {
            const raw = this.doParseContent(content);
            this.parseRaw(raw, options);
        }
    }
    reparse(options) {
        if (this._raw) {
            this.parseRaw(this._raw, options);
        }
    }
    parseRaw(raw, options) {
        this._raw = raw;
        const { contents, keys, overrides, restricted, hasExcludedProperties } = this.doParseRaw(raw, options);
        this._configurationModel = new ConfigurationModel(contents, keys, overrides, hasExcludedProperties ? [raw] : undefined /* raw has not changed */, this.logService);
        this._restrictedConfigurations = restricted || [];
    }
    doParseContent(content) {
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
            try {
                json.visit(content, visitor);
                raw = currentParent[0] || {};
            }
            catch (e) {
                this.logService.error(`Error while parsing settings file ${this._name}: ${e}`);
                this._parseErrors = [e];
            }
        }
        return raw;
    }
    doParseRaw(raw, options) {
        const registry = Registry.as(Extensions.Configuration);
        const configurationProperties = registry.getConfigurationProperties();
        const excludedConfigurationProperties = registry.getExcludedConfigurationProperties();
        const filtered = this.filter(raw, configurationProperties, excludedConfigurationProperties, true, options);
        raw = filtered.raw;
        const contents = toValuesTree(raw, message => this.logService.error(`Conflict in settings file ${this._name}: ${message}`));
        const keys = Object.keys(raw);
        const overrides = this.toOverrides(raw, message => this.logService.error(`Conflict in settings file ${this._name}: ${message}`));
        return { contents, keys, overrides, restricted: filtered.restricted, hasExcludedProperties: filtered.hasExcludedProperties };
    }
    filter(properties, configurationProperties, excludedConfigurationProperties, filterOverriddenProperties, options) {
        let hasExcludedProperties = false;
        if (!options?.scopes && !options?.skipRestricted && !options?.skipUnregistered && !options?.exclude?.length) {
            return { raw: properties, restricted: [], hasExcludedProperties };
        }
        const raw = {};
        const restricted = [];
        for (const key in properties) {
            if (OVERRIDE_PROPERTY_REGEX.test(key) && filterOverriddenProperties) {
                const result = this.filter(properties[key], configurationProperties, excludedConfigurationProperties, false, options);
                raw[key] = result.raw;
                hasExcludedProperties = hasExcludedProperties || result.hasExcludedProperties;
                restricted.push(...result.restricted);
            }
            else {
                const propertySchema = configurationProperties[key];
                if (propertySchema?.restricted) {
                    restricted.push(key);
                }
                if (this.shouldInclude(key, propertySchema, excludedConfigurationProperties, options)) {
                    raw[key] = properties[key];
                }
                else {
                    hasExcludedProperties = true;
                }
            }
        }
        return { raw, restricted, hasExcludedProperties };
    }
    shouldInclude(key, propertySchema, excludedConfigurationProperties, options) {
        if (options.exclude?.includes(key)) {
            return false;
        }
        if (options.include?.includes(key)) {
            return true;
        }
        if (options.skipRestricted && propertySchema?.restricted) {
            return false;
        }
        if (options.skipUnregistered && !propertySchema) {
            return false;
        }
        const schema = propertySchema ?? excludedConfigurationProperties[key];
        const scope = schema ? typeof schema.scope !== 'undefined' ? schema.scope : 4 /* ConfigurationScope.WINDOW */ : undefined;
        if (scope === undefined || options.scopes === undefined) {
            return true;
        }
        return options.scopes.includes(scope);
    }
    toOverrides(raw, conflictReporter) {
        const overrides = [];
        for (const key of Object.keys(raw)) {
            if (OVERRIDE_PROPERTY_REGEX.test(key)) {
                const overrideRaw = {};
                const rawKey = raw[key];
                for (const keyInOverrideRaw in rawKey) {
                    overrideRaw[keyInOverrideRaw] = rawKey[keyInOverrideRaw];
                }
                overrides.push({
                    identifiers: overrideIdentifiersFromKey(key),
                    keys: Object.keys(overrideRaw),
                    contents: toValuesTree(overrideRaw, conflictReporter)
                });
            }
        }
        return overrides;
    }
}
export class UserSettings extends Disposable {
    constructor(userSettingsResource, parseOptions, extUri, fileService, logService) {
        super();
        this.userSettingsResource = userSettingsResource;
        this.parseOptions = parseOptions;
        this.fileService = fileService;
        this.logService = logService;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this.parser = new ConfigurationModelParser(this.userSettingsResource.toString(), logService);
        this._register(this.fileService.watch(extUri.dirname(this.userSettingsResource)));
        // Also listen to the resource incase the resource is a symlink - https://github.com/microsoft/vscode/issues/118134
        this._register(this.fileService.watch(this.userSettingsResource));
        this._register(Event.any(Event.filter(this.fileService.onDidFilesChange, e => e.contains(this.userSettingsResource)), Event.filter(this.fileService.onDidRunOperation, e => (e.isOperation(0 /* FileOperation.CREATE */) || e.isOperation(3 /* FileOperation.COPY */) || e.isOperation(1 /* FileOperation.DELETE */) || e.isOperation(4 /* FileOperation.WRITE */)) && extUri.isEqual(e.resource, userSettingsResource)))(() => this._onDidChange.fire()));
    }
    async loadConfiguration() {
        try {
            const content = await this.fileService.readFile(this.userSettingsResource);
            this.parser.parse(content.value.toString() || '{}', this.parseOptions);
            return this.parser.configurationModel;
        }
        catch (e) {
            return ConfigurationModel.createEmptyModel(this.logService);
        }
    }
    reparse(parseOptions) {
        if (parseOptions) {
            this.parseOptions = parseOptions;
        }
        this.parser.reparse(this.parseOptions);
        return this.parser.configurationModel;
    }
    getRestrictedSettings() {
        return this.parser.restrictedConfigurations;
    }
}
class ConfigurationInspectValue {
    constructor(key, overrides, _value, overrideIdentifiers, defaultConfiguration, policyConfiguration, applicationConfiguration, userConfiguration, localUserConfiguration, remoteUserConfiguration, workspaceConfiguration, folderConfigurationModel, memoryConfigurationModel) {
        this.key = key;
        this.overrides = overrides;
        this._value = _value;
        this.overrideIdentifiers = overrideIdentifiers;
        this.defaultConfiguration = defaultConfiguration;
        this.policyConfiguration = policyConfiguration;
        this.applicationConfiguration = applicationConfiguration;
        this.userConfiguration = userConfiguration;
        this.localUserConfiguration = localUserConfiguration;
        this.remoteUserConfiguration = remoteUserConfiguration;
        this.workspaceConfiguration = workspaceConfiguration;
        this.folderConfigurationModel = folderConfigurationModel;
        this.memoryConfigurationModel = memoryConfigurationModel;
    }
    get value() {
        return freeze(this._value);
    }
    toInspectValue(inspectValue) {
        return inspectValue?.value !== undefined || inspectValue?.override !== undefined || inspectValue?.overrides !== undefined ? inspectValue : undefined;
    }
    get defaultInspectValue() {
        if (!this._defaultInspectValue) {
            this._defaultInspectValue = this.defaultConfiguration.inspect(this.key, this.overrides.overrideIdentifier);
        }
        return this._defaultInspectValue;
    }
    get defaultValue() {
        return this.defaultInspectValue.merged;
    }
    get default() {
        return this.toInspectValue(this.defaultInspectValue);
    }
    get policyInspectValue() {
        if (this._policyInspectValue === undefined) {
            this._policyInspectValue = this.policyConfiguration ? this.policyConfiguration.inspect(this.key) : null;
        }
        return this._policyInspectValue;
    }
    get policyValue() {
        return this.policyInspectValue?.merged;
    }
    get policy() {
        return this.policyInspectValue?.value !== undefined ? { value: this.policyInspectValue.value } : undefined;
    }
    get applicationInspectValue() {
        if (this._applicationInspectValue === undefined) {
            this._applicationInspectValue = this.applicationConfiguration ? this.applicationConfiguration.inspect(this.key) : null;
        }
        return this._applicationInspectValue;
    }
    get applicationValue() {
        return this.applicationInspectValue?.merged;
    }
    get application() {
        return this.toInspectValue(this.applicationInspectValue);
    }
    get userInspectValue() {
        if (!this._userInspectValue) {
            this._userInspectValue = this.userConfiguration.inspect(this.key, this.overrides.overrideIdentifier);
        }
        return this._userInspectValue;
    }
    get userValue() {
        return this.userInspectValue.merged;
    }
    get user() {
        return this.toInspectValue(this.userInspectValue);
    }
    get userLocalInspectValue() {
        if (!this._userLocalInspectValue) {
            this._userLocalInspectValue = this.localUserConfiguration.inspect(this.key, this.overrides.overrideIdentifier);
        }
        return this._userLocalInspectValue;
    }
    get userLocalValue() {
        return this.userLocalInspectValue.merged;
    }
    get userLocal() {
        return this.toInspectValue(this.userLocalInspectValue);
    }
    get userRemoteInspectValue() {
        if (!this._userRemoteInspectValue) {
            this._userRemoteInspectValue = this.remoteUserConfiguration.inspect(this.key, this.overrides.overrideIdentifier);
        }
        return this._userRemoteInspectValue;
    }
    get userRemoteValue() {
        return this.userRemoteInspectValue.merged;
    }
    get userRemote() {
        return this.toInspectValue(this.userRemoteInspectValue);
    }
    get workspaceInspectValue() {
        if (this._workspaceInspectValue === undefined) {
            this._workspaceInspectValue = this.workspaceConfiguration ? this.workspaceConfiguration.inspect(this.key, this.overrides.overrideIdentifier) : null;
        }
        return this._workspaceInspectValue;
    }
    get workspaceValue() {
        return this.workspaceInspectValue?.merged;
    }
    get workspace() {
        return this.toInspectValue(this.workspaceInspectValue);
    }
    get workspaceFolderInspectValue() {
        if (this._workspaceFolderInspectValue === undefined) {
            this._workspaceFolderInspectValue = this.folderConfigurationModel ? this.folderConfigurationModel.inspect(this.key, this.overrides.overrideIdentifier) : null;
        }
        return this._workspaceFolderInspectValue;
    }
    get workspaceFolderValue() {
        return this.workspaceFolderInspectValue?.merged;
    }
    get workspaceFolder() {
        return this.toInspectValue(this.workspaceFolderInspectValue);
    }
    get memoryInspectValue() {
        if (this._memoryInspectValue === undefined) {
            this._memoryInspectValue = this.memoryConfigurationModel.inspect(this.key, this.overrides.overrideIdentifier);
        }
        return this._memoryInspectValue;
    }
    get memoryValue() {
        return this.memoryInspectValue.merged;
    }
    get memory() {
        return this.toInspectValue(this.memoryInspectValue);
    }
}
export class Configuration {
    constructor(_defaultConfiguration, _policyConfiguration, _applicationConfiguration, _localUserConfiguration, _remoteUserConfiguration, _workspaceConfiguration, _folderConfigurations, _memoryConfiguration, _memoryConfigurationByResource, logService) {
        this._defaultConfiguration = _defaultConfiguration;
        this._policyConfiguration = _policyConfiguration;
        this._applicationConfiguration = _applicationConfiguration;
        this._localUserConfiguration = _localUserConfiguration;
        this._remoteUserConfiguration = _remoteUserConfiguration;
        this._workspaceConfiguration = _workspaceConfiguration;
        this._folderConfigurations = _folderConfigurations;
        this._memoryConfiguration = _memoryConfiguration;
        this._memoryConfigurationByResource = _memoryConfigurationByResource;
        this.logService = logService;
        this._workspaceConsolidatedConfiguration = null;
        this._foldersConsolidatedConfigurations = new ResourceMap();
        this._userConfiguration = null;
    }
    getValue(section, overrides, workspace) {
        const consolidateConfigurationModel = this.getConsolidatedConfigurationModel(section, overrides, workspace);
        return consolidateConfigurationModel.getValue(section);
    }
    updateValue(key, value, overrides = {}) {
        let memoryConfiguration;
        if (overrides.resource) {
            memoryConfiguration = this._memoryConfigurationByResource.get(overrides.resource);
            if (!memoryConfiguration) {
                memoryConfiguration = ConfigurationModel.createEmptyModel(this.logService);
                this._memoryConfigurationByResource.set(overrides.resource, memoryConfiguration);
            }
        }
        else {
            memoryConfiguration = this._memoryConfiguration;
        }
        if (value === undefined) {
            memoryConfiguration.removeValue(key);
        }
        else {
            memoryConfiguration.setValue(key, value);
        }
        if (!overrides.resource) {
            this._workspaceConsolidatedConfiguration = null;
        }
    }
    inspect(key, overrides, workspace) {
        const consolidateConfigurationModel = this.getConsolidatedConfigurationModel(key, overrides, workspace);
        const folderConfigurationModel = this.getFolderConfigurationModelForResource(overrides.resource, workspace);
        const memoryConfigurationModel = overrides.resource ? this._memoryConfigurationByResource.get(overrides.resource) || this._memoryConfiguration : this._memoryConfiguration;
        const overrideIdentifiers = new Set();
        for (const override of consolidateConfigurationModel.overrides) {
            for (const overrideIdentifier of override.identifiers) {
                if (consolidateConfigurationModel.getOverrideValue(key, overrideIdentifier) !== undefined) {
                    overrideIdentifiers.add(overrideIdentifier);
                }
            }
        }
        return new ConfigurationInspectValue(key, overrides, consolidateConfigurationModel.getValue(key), overrideIdentifiers.size ? [...overrideIdentifiers] : undefined, this._defaultConfiguration, this._policyConfiguration.isEmpty() ? undefined : this._policyConfiguration, this.applicationConfiguration.isEmpty() ? undefined : this.applicationConfiguration, this.userConfiguration, this.localUserConfiguration, this.remoteUserConfiguration, workspace ? this._workspaceConfiguration : undefined, folderConfigurationModel ? folderConfigurationModel : undefined, memoryConfigurationModel);
    }
    keys(workspace) {
        const folderConfigurationModel = this.getFolderConfigurationModelForResource(undefined, workspace);
        return {
            default: this._defaultConfiguration.keys.slice(0),
            policy: this._policyConfiguration.keys.slice(0),
            user: this.userConfiguration.keys.slice(0),
            workspace: this._workspaceConfiguration.keys.slice(0),
            workspaceFolder: folderConfigurationModel ? folderConfigurationModel.keys.slice(0) : []
        };
    }
    updateDefaultConfiguration(defaultConfiguration) {
        this._defaultConfiguration = defaultConfiguration;
        this._workspaceConsolidatedConfiguration = null;
        this._foldersConsolidatedConfigurations.clear();
    }
    updatePolicyConfiguration(policyConfiguration) {
        this._policyConfiguration = policyConfiguration;
    }
    updateApplicationConfiguration(applicationConfiguration) {
        this._applicationConfiguration = applicationConfiguration;
        this._workspaceConsolidatedConfiguration = null;
        this._foldersConsolidatedConfigurations.clear();
    }
    updateLocalUserConfiguration(localUserConfiguration) {
        this._localUserConfiguration = localUserConfiguration;
        this._userConfiguration = null;
        this._workspaceConsolidatedConfiguration = null;
        this._foldersConsolidatedConfigurations.clear();
    }
    updateRemoteUserConfiguration(remoteUserConfiguration) {
        this._remoteUserConfiguration = remoteUserConfiguration;
        this._userConfiguration = null;
        this._workspaceConsolidatedConfiguration = null;
        this._foldersConsolidatedConfigurations.clear();
    }
    updateWorkspaceConfiguration(workspaceConfiguration) {
        this._workspaceConfiguration = workspaceConfiguration;
        this._workspaceConsolidatedConfiguration = null;
        this._foldersConsolidatedConfigurations.clear();
    }
    updateFolderConfiguration(resource, configuration) {
        this._folderConfigurations.set(resource, configuration);
        this._foldersConsolidatedConfigurations.delete(resource);
    }
    deleteFolderConfiguration(resource) {
        this.folderConfigurations.delete(resource);
        this._foldersConsolidatedConfigurations.delete(resource);
    }
    compareAndUpdateDefaultConfiguration(defaults, keys) {
        const overrides = [];
        if (!keys) {
            const { added, updated, removed } = compare(this._defaultConfiguration, defaults);
            keys = [...added, ...updated, ...removed];
        }
        for (const key of keys) {
            for (const overrideIdentifier of overrideIdentifiersFromKey(key)) {
                const fromKeys = this._defaultConfiguration.getKeysForOverrideIdentifier(overrideIdentifier);
                const toKeys = defaults.getKeysForOverrideIdentifier(overrideIdentifier);
                const keys = [
                    ...toKeys.filter(key => fromKeys.indexOf(key) === -1),
                    ...fromKeys.filter(key => toKeys.indexOf(key) === -1),
                    ...fromKeys.filter(key => !objects.equals(this._defaultConfiguration.override(overrideIdentifier).getValue(key), defaults.override(overrideIdentifier).getValue(key)))
                ];
                overrides.push([overrideIdentifier, keys]);
            }
        }
        this.updateDefaultConfiguration(defaults);
        return { keys, overrides };
    }
    compareAndUpdatePolicyConfiguration(policyConfiguration) {
        const { added, updated, removed } = compare(this._policyConfiguration, policyConfiguration);
        const keys = [...added, ...updated, ...removed];
        if (keys.length) {
            this.updatePolicyConfiguration(policyConfiguration);
        }
        return { keys, overrides: [] };
    }
    compareAndUpdateApplicationConfiguration(application) {
        const { added, updated, removed, overrides } = compare(this.applicationConfiguration, application);
        const keys = [...added, ...updated, ...removed];
        if (keys.length) {
            this.updateApplicationConfiguration(application);
        }
        return { keys, overrides };
    }
    compareAndUpdateLocalUserConfiguration(user) {
        const { added, updated, removed, overrides } = compare(this.localUserConfiguration, user);
        const keys = [...added, ...updated, ...removed];
        if (keys.length) {
            this.updateLocalUserConfiguration(user);
        }
        return { keys, overrides };
    }
    compareAndUpdateRemoteUserConfiguration(user) {
        const { added, updated, removed, overrides } = compare(this.remoteUserConfiguration, user);
        const keys = [...added, ...updated, ...removed];
        if (keys.length) {
            this.updateRemoteUserConfiguration(user);
        }
        return { keys, overrides };
    }
    compareAndUpdateWorkspaceConfiguration(workspaceConfiguration) {
        const { added, updated, removed, overrides } = compare(this.workspaceConfiguration, workspaceConfiguration);
        const keys = [...added, ...updated, ...removed];
        if (keys.length) {
            this.updateWorkspaceConfiguration(workspaceConfiguration);
        }
        return { keys, overrides };
    }
    compareAndUpdateFolderConfiguration(resource, folderConfiguration) {
        const currentFolderConfiguration = this.folderConfigurations.get(resource);
        const { added, updated, removed, overrides } = compare(currentFolderConfiguration, folderConfiguration);
        const keys = [...added, ...updated, ...removed];
        if (keys.length || !currentFolderConfiguration) {
            this.updateFolderConfiguration(resource, folderConfiguration);
        }
        return { keys, overrides };
    }
    compareAndDeleteFolderConfiguration(folder) {
        const folderConfig = this.folderConfigurations.get(folder);
        if (!folderConfig) {
            throw new Error('Unknown folder');
        }
        this.deleteFolderConfiguration(folder);
        const { added, updated, removed, overrides } = compare(folderConfig, undefined);
        return { keys: [...added, ...updated, ...removed], overrides };
    }
    get defaults() {
        return this._defaultConfiguration;
    }
    get applicationConfiguration() {
        return this._applicationConfiguration;
    }
    get userConfiguration() {
        if (!this._userConfiguration) {
            if (this._remoteUserConfiguration.isEmpty()) {
                this._userConfiguration = this._localUserConfiguration;
            }
            else {
                const merged = this._localUserConfiguration.merge(this._remoteUserConfiguration);
                this._userConfiguration = new ConfigurationModel(merged.contents, merged.keys, merged.overrides, undefined, this.logService);
            }
        }
        return this._userConfiguration;
    }
    get localUserConfiguration() {
        return this._localUserConfiguration;
    }
    get remoteUserConfiguration() {
        return this._remoteUserConfiguration;
    }
    get workspaceConfiguration() {
        return this._workspaceConfiguration;
    }
    get folderConfigurations() {
        return this._folderConfigurations;
    }
    getConsolidatedConfigurationModel(section, overrides, workspace) {
        let configurationModel = this.getConsolidatedConfigurationModelForResource(overrides, workspace);
        if (overrides.overrideIdentifier) {
            configurationModel = configurationModel.override(overrides.overrideIdentifier);
        }
        if (!this._policyConfiguration.isEmpty() && this._policyConfiguration.getValue(section) !== undefined) {
            // clone by merging
            configurationModel = configurationModel.merge();
            for (const key of this._policyConfiguration.keys) {
                configurationModel.setValue(key, this._policyConfiguration.getValue(key));
            }
        }
        return configurationModel;
    }
    getConsolidatedConfigurationModelForResource({ resource }, workspace) {
        let consolidateConfiguration = this.getWorkspaceConsolidatedConfiguration();
        if (workspace && resource) {
            const root = workspace.getFolder(resource);
            if (root) {
                consolidateConfiguration = this.getFolderConsolidatedConfiguration(root.uri) || consolidateConfiguration;
            }
            const memoryConfigurationForResource = this._memoryConfigurationByResource.get(resource);
            if (memoryConfigurationForResource) {
                consolidateConfiguration = consolidateConfiguration.merge(memoryConfigurationForResource);
            }
        }
        return consolidateConfiguration;
    }
    getWorkspaceConsolidatedConfiguration() {
        if (!this._workspaceConsolidatedConfiguration) {
            this._workspaceConsolidatedConfiguration = this._defaultConfiguration.merge(this.applicationConfiguration, this.userConfiguration, this._workspaceConfiguration, this._memoryConfiguration);
        }
        return this._workspaceConsolidatedConfiguration;
    }
    getFolderConsolidatedConfiguration(folder) {
        let folderConsolidatedConfiguration = this._foldersConsolidatedConfigurations.get(folder);
        if (!folderConsolidatedConfiguration) {
            const workspaceConsolidateConfiguration = this.getWorkspaceConsolidatedConfiguration();
            const folderConfiguration = this._folderConfigurations.get(folder);
            if (folderConfiguration) {
                folderConsolidatedConfiguration = workspaceConsolidateConfiguration.merge(folderConfiguration);
                this._foldersConsolidatedConfigurations.set(folder, folderConsolidatedConfiguration);
            }
            else {
                folderConsolidatedConfiguration = workspaceConsolidateConfiguration;
            }
        }
        return folderConsolidatedConfiguration;
    }
    getFolderConfigurationModelForResource(resource, workspace) {
        if (workspace && resource) {
            const root = workspace.getFolder(resource);
            if (root) {
                return this._folderConfigurations.get(root.uri);
            }
        }
        return undefined;
    }
    toData() {
        return {
            defaults: {
                contents: this._defaultConfiguration.contents,
                overrides: this._defaultConfiguration.overrides,
                keys: this._defaultConfiguration.keys,
            },
            policy: {
                contents: this._policyConfiguration.contents,
                overrides: this._policyConfiguration.overrides,
                keys: this._policyConfiguration.keys
            },
            application: {
                contents: this.applicationConfiguration.contents,
                overrides: this.applicationConfiguration.overrides,
                keys: this.applicationConfiguration.keys,
                raw: Array.isArray(this.applicationConfiguration.raw) ? undefined : this.applicationConfiguration.raw
            },
            userLocal: {
                contents: this.localUserConfiguration.contents,
                overrides: this.localUserConfiguration.overrides,
                keys: this.localUserConfiguration.keys,
                raw: Array.isArray(this.localUserConfiguration.raw) ? undefined : this.localUserConfiguration.raw
            },
            userRemote: {
                contents: this.remoteUserConfiguration.contents,
                overrides: this.remoteUserConfiguration.overrides,
                keys: this.remoteUserConfiguration.keys,
                raw: Array.isArray(this.remoteUserConfiguration.raw) ? undefined : this.remoteUserConfiguration.raw
            },
            workspace: {
                contents: this._workspaceConfiguration.contents,
                overrides: this._workspaceConfiguration.overrides,
                keys: this._workspaceConfiguration.keys
            },
            folders: [...this._folderConfigurations.keys()].reduce((result, folder) => {
                const { contents, overrides, keys } = this._folderConfigurations.get(folder);
                result.push([folder, { contents, overrides, keys }]);
                return result;
            }, [])
        };
    }
    allKeys() {
        const keys = new Set();
        this._defaultConfiguration.keys.forEach(key => keys.add(key));
        this.userConfiguration.keys.forEach(key => keys.add(key));
        this._workspaceConfiguration.keys.forEach(key => keys.add(key));
        this._folderConfigurations.forEach(folderConfiguration => folderConfiguration.keys.forEach(key => keys.add(key)));
        return [...keys.values()];
    }
    allOverrideIdentifiers() {
        const keys = new Set();
        this._defaultConfiguration.getAllOverrideIdentifiers().forEach(key => keys.add(key));
        this.userConfiguration.getAllOverrideIdentifiers().forEach(key => keys.add(key));
        this._workspaceConfiguration.getAllOverrideIdentifiers().forEach(key => keys.add(key));
        this._folderConfigurations.forEach(folderConfiguration => folderConfiguration.getAllOverrideIdentifiers().forEach(key => keys.add(key)));
        return [...keys.values()];
    }
    getAllKeysForOverrideIdentifier(overrideIdentifier) {
        const keys = new Set();
        this._defaultConfiguration.getKeysForOverrideIdentifier(overrideIdentifier).forEach(key => keys.add(key));
        this.userConfiguration.getKeysForOverrideIdentifier(overrideIdentifier).forEach(key => keys.add(key));
        this._workspaceConfiguration.getKeysForOverrideIdentifier(overrideIdentifier).forEach(key => keys.add(key));
        this._folderConfigurations.forEach(folderConfiguration => folderConfiguration.getKeysForOverrideIdentifier(overrideIdentifier).forEach(key => keys.add(key)));
        return [...keys.values()];
    }
    static parse(data, logService) {
        const defaultConfiguration = this.parseConfigurationModel(data.defaults, logService);
        const policyConfiguration = this.parseConfigurationModel(data.policy, logService);
        const applicationConfiguration = this.parseConfigurationModel(data.application, logService);
        const userLocalConfiguration = this.parseConfigurationModel(data.userLocal, logService);
        const userRemoteConfiguration = this.parseConfigurationModel(data.userRemote, logService);
        const workspaceConfiguration = this.parseConfigurationModel(data.workspace, logService);
        const folders = data.folders.reduce((result, value) => {
            result.set(URI.revive(value[0]), this.parseConfigurationModel(value[1], logService));
            return result;
        }, new ResourceMap());
        return new Configuration(defaultConfiguration, policyConfiguration, applicationConfiguration, userLocalConfiguration, userRemoteConfiguration, workspaceConfiguration, folders, ConfigurationModel.createEmptyModel(logService), new ResourceMap(), logService);
    }
    static parseConfigurationModel(model, logService) {
        return new ConfigurationModel(model.contents, model.keys, model.overrides, model.raw, logService);
    }
}
export function mergeChanges(...changes) {
    if (changes.length === 0) {
        return { keys: [], overrides: [] };
    }
    if (changes.length === 1) {
        return changes[0];
    }
    const keysSet = new Set();
    const overridesMap = new Map();
    for (const change of changes) {
        change.keys.forEach(key => keysSet.add(key));
        change.overrides.forEach(([identifier, keys]) => {
            const result = getOrSet(overridesMap, identifier, new Set());
            keys.forEach(key => result.add(key));
        });
    }
    const overrides = [];
    overridesMap.forEach((keys, identifier) => overrides.push([identifier, [...keys.values()]]));
    return { keys: [...keysSet.values()], overrides };
}
export class ConfigurationChangeEvent {
    constructor(change, previous, currentConfiguraiton, currentWorkspace, logService) {
        this.change = change;
        this.previous = previous;
        this.currentConfiguraiton = currentConfiguraiton;
        this.currentWorkspace = currentWorkspace;
        this.logService = logService;
        this._marker = '\n';
        this._markerCode1 = this._marker.charCodeAt(0);
        this._markerCode2 = '.'.charCodeAt(0);
        this.affectedKeys = new Set();
        this._previousConfiguration = undefined;
        for (const key of change.keys) {
            this.affectedKeys.add(key);
        }
        for (const [, keys] of change.overrides) {
            for (const key of keys) {
                this.affectedKeys.add(key);
            }
        }
        // Example: '\nfoo.bar\nabc.def\n'
        this._affectsConfigStr = this._marker;
        for (const key of this.affectedKeys) {
            this._affectsConfigStr += key + this._marker;
        }
    }
    get previousConfiguration() {
        if (!this._previousConfiguration && this.previous) {
            this._previousConfiguration = Configuration.parse(this.previous.data, this.logService);
        }
        return this._previousConfiguration;
    }
    affectsConfiguration(section, overrides) {
        // we have one large string with all keys that have changed. we pad (marker) the section
        // and check that either find it padded or before a segment character
        const needle = this._marker + section;
        const idx = this._affectsConfigStr.indexOf(needle);
        if (idx < 0) {
            // NOT: (marker + section)
            return false;
        }
        const pos = idx + needle.length;
        if (pos >= this._affectsConfigStr.length) {
            return false;
        }
        const code = this._affectsConfigStr.charCodeAt(pos);
        if (code !== this._markerCode1 && code !== this._markerCode2) {
            // NOT: section + (marker | segment)
            return false;
        }
        if (overrides) {
            const value1 = this.previousConfiguration ? this.previousConfiguration.getValue(section, overrides, this.previous?.workspace) : undefined;
            const value2 = this.currentConfiguraiton.getValue(section, overrides, this.currentWorkspace);
            return !objects.equals(value1, value2);
        }
        return true;
    }
}
function compare(from, to) {
    const { added, removed, updated } = compareConfigurationContents(to?.rawConfiguration, from?.rawConfiguration);
    const overrides = [];
    const fromOverrideIdentifiers = from?.getAllOverrideIdentifiers() || [];
    const toOverrideIdentifiers = to?.getAllOverrideIdentifiers() || [];
    if (to) {
        const addedOverrideIdentifiers = toOverrideIdentifiers.filter(key => !fromOverrideIdentifiers.includes(key));
        for (const identifier of addedOverrideIdentifiers) {
            overrides.push([identifier, to.getKeysForOverrideIdentifier(identifier)]);
        }
    }
    if (from) {
        const removedOverrideIdentifiers = fromOverrideIdentifiers.filter(key => !toOverrideIdentifiers.includes(key));
        for (const identifier of removedOverrideIdentifiers) {
            overrides.push([identifier, from.getKeysForOverrideIdentifier(identifier)]);
        }
    }
    if (to && from) {
        for (const identifier of fromOverrideIdentifiers) {
            if (toOverrideIdentifiers.includes(identifier)) {
                const result = compareConfigurationContents({ contents: from.getOverrideValue(undefined, identifier) || {}, keys: from.getKeysForOverrideIdentifier(identifier) }, { contents: to.getOverrideValue(undefined, identifier) || {}, keys: to.getKeysForOverrideIdentifier(identifier) });
                overrides.push([identifier, [...result.added, ...result.removed, ...result.updated]]);
            }
        }
    }
    return { added, removed, updated, overrides };
}
function compareConfigurationContents(to, from) {
    const added = to
        ? from ? to.keys.filter(key => from.keys.indexOf(key) === -1) : [...to.keys]
        : [];
    const removed = from
        ? to ? from.keys.filter(key => to.keys.indexOf(key) === -1) : [...from.keys]
        : [];
    const updated = [];
    if (to && from) {
        for (const key of from.keys) {
            if (to.keys.indexOf(key) !== -1) {
                const value1 = getConfigurationValue(from.contents, key);
                const value2 = getConfigurationValue(to.contents, key);
                if (!objects.equals(value1, value2)) {
                    updated.push(key);
                }
            }
        }
    }
    return { added, removed, updated };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlndXJhdGlvbk1vZGVscy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uTW9kZWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxNQUFNLE1BQU0sZ0NBQWdDLENBQUM7QUFFekQsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEtBQUssSUFBSSxNQUFNLDhCQUE4QixDQUFDO0FBQ3JELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3BFLE9BQU8sS0FBSyxPQUFPLE1BQU0saUNBQWlDLENBQUM7QUFFM0QsT0FBTyxLQUFLLEtBQUssTUFBTSwrQkFBK0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLDZCQUE2QixDQUFDO0FBQ2pFLE9BQU8sRUFBRSxjQUFjLEVBQXVCLHFCQUFxQixFQUFpTyxtQkFBbUIsRUFBRSxZQUFZLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUNsVyxPQUFPLEVBQXNCLFVBQVUsRUFBd0QsMEJBQTBCLEVBQUUsdUJBQXVCLEVBQTBDLE1BQU0sNEJBQTRCLENBQUM7QUFHL04sT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRzdELFNBQVMsTUFBTSxDQUFJLElBQU87SUFDekIsT0FBTyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDaEUsQ0FBQztBQUlELE1BQU0sT0FBTyxr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