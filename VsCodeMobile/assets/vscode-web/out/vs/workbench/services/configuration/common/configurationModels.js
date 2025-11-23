/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { equals } from '../../../../base/common/objects.js';
import { toValuesTree } from '../../../../platform/configuration/common/configuration.js';
import { Configuration as BaseConfiguration, ConfigurationModelParser, ConfigurationModel } from '../../../../platform/configuration/common/configurationModels.js';
import { isBoolean } from '../../../../base/common/types.js';
import { distinct } from '../../../../base/common/arrays.js';
export class WorkspaceConfigurationModelParser extends ConfigurationModelParser {
    constructor(name, logService) {
        super(name, logService);
        this._folders = [];
        this._transient = false;
        this._settingsModelParser = new ConfigurationModelParser(name, logService);
        this._launchModel = ConfigurationModel.createEmptyModel(logService);
        this._tasksModel = ConfigurationModel.createEmptyModel(logService);
    }
    get folders() {
        return this._folders;
    }
    get transient() {
        return this._transient;
    }
    get settingsModel() {
        return this._settingsModelParser.configurationModel;
    }
    get launchModel() {
        return this._launchModel;
    }
    get tasksModel() {
        return this._tasksModel;
    }
    reparseWorkspaceSettings(configurationParseOptions) {
        this._settingsModelParser.reparse(configurationParseOptions);
    }
    getRestrictedWorkspaceSettings() {
        return this._settingsModelParser.restrictedConfigurations;
    }
    doParseRaw(raw, configurationParseOptions) {
        this._folders = (raw['folders'] || []);
        this._transient = isBoolean(raw['transient']) && raw['transient'];
        this._settingsModelParser.parseRaw(raw['settings'], configurationParseOptions);
        this._launchModel = this.createConfigurationModelFrom(raw, 'launch');
        this._tasksModel = this.createConfigurationModelFrom(raw, 'tasks');
        return super.doParseRaw(raw, configurationParseOptions);
    }
    createConfigurationModelFrom(raw, key) {
        const data = raw[key];
        if (data) {
            const contents = toValuesTree(data, message => console.error(`Conflict in settings file ${this._name}: ${message}`));
            const scopedContents = Object.create(null);
            scopedContents[key] = contents;
            const keys = Object.keys(data).map(k => `${key}.${k}`);
            return new ConfigurationModel(scopedContents, keys, [], undefined, this.logService);
        }
        return ConfigurationModel.createEmptyModel(this.logService);
    }
}
export class StandaloneConfigurationModelParser extends ConfigurationModelParser {
    constructor(name, scope, logService) {
        super(name, logService);
        this.scope = scope;
    }
    doParseRaw(raw, configurationParseOptions) {
        const contents = toValuesTree(raw, message => console.error(`Conflict in settings file ${this._name}: ${message}`));
        const scopedContents = Object.create(null);
        scopedContents[this.scope] = contents;
        const keys = Object.keys(raw).map(key => `${this.scope}.${key}`);
        return { contents: scopedContents, keys, overrides: [] };
    }
}
export class Configuration extends BaseConfiguration {
    constructor(defaults, policy, application, localUser, remoteUser, workspaceConfiguration, folders, memoryConfiguration, memoryConfigurationByResource, _workspace, logService) {
        super(defaults, policy, application, localUser, remoteUser, workspaceConfiguration, folders, memoryConfiguration, memoryConfigurationByResource, logService);
        this._workspace = _workspace;
    }
    getValue(key, overrides = {}) {
        return super.getValue(key, overrides, this._workspace);
    }
    inspect(key, overrides = {}) {
        return super.inspect(key, overrides, this._workspace);
    }
    keys() {
        return super.keys(this._workspace);
    }
    compareAndDeleteFolderConfiguration(folder) {
        if (this._workspace && this._workspace.folders.length > 0 && this._workspace.folders[0].uri.toString() === folder.toString()) {
            // Do not remove workspace configuration
            return { keys: [], overrides: [] };
        }
        return super.compareAndDeleteFolderConfiguration(folder);
    }
    compare(other) {
        const compare = (fromKeys, toKeys, overrideIdentifier) => {
            const keys = [];
            keys.push(...toKeys.filter(key => fromKeys.indexOf(key) === -1));
            keys.push(...fromKeys.filter(key => toKeys.indexOf(key) === -1));
            keys.push(...fromKeys.filter(key => {
                // Ignore if the key does not exist in both models
                if (toKeys.indexOf(key) === -1) {
                    return false;
                }
                // Compare workspace value
                if (!equals(this.getValue(key, { overrideIdentifier }), other.getValue(key, { overrideIdentifier }))) {
                    return true;
                }
                // Compare workspace folder value
                return this._workspace && this._workspace.folders.some(folder => !equals(this.getValue(key, { resource: folder.uri, overrideIdentifier }), other.getValue(key, { resource: folder.uri, overrideIdentifier })));
            }));
            return keys;
        };
        const keys = compare(this.allKeys(), other.allKeys());
        const overrides = [];
        const allOverrideIdentifiers = distinct([...this.allOverrideIdentifiers(), ...other.allOverrideIdentifiers()]);
        for (const overrideIdentifier of allOverrideIdentifiers) {
            const keys = compare(this.getAllKeysForOverrideIdentifier(overrideIdentifier), other.getAllKeysForOverrideIdentifier(overrideIdentifier), overrideIdentifier);
            if (keys.length) {
                overrides.push([overrideIdentifier, keys]);
            }
        }
        return { keys, overrides };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlndXJhdGlvbk1vZGVscy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbk1vZGVscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDNUQsT0FBTyxFQUFFLFlBQVksRUFBMkYsTUFBTSw0REFBNEQsQ0FBQztBQUNuTCxPQUFPLEVBQUUsYUFBYSxJQUFJLGlCQUFpQixFQUFFLHdCQUF3QixFQUFFLGtCQUFrQixFQUE2QixNQUFNLGtFQUFrRSxDQUFDO0FBSy9MLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFJN0QsTUFBTSxPQUFPLGlDQUFrQyxTQUFRLHdCQUF3QjtJQVE5RSxZQUFZLElBQVksRUFBRSxVQUF1QjtRQUNoRCxLQUFLLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBUGpCLGFBQVEsR0FBNkIsRUFBRSxDQUFDO1FBQ3hDLGVBQVUsR0FBWSxLQUFLLENBQUM7UUFPbkMsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksd0JBQXdCLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzNFLElBQUksQ0FBQyxZQUFZLEdBQUcsa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDcEUsSUFBSSxDQUFDLFdBQVcsR0FBRyxrQkFBa0IsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNwRSxDQUFDO0lBRUQsSUFBSSxPQUFPO1FBQ1YsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDO0lBQ3RCLENBQUM7SUFFRCxJQUFJLFNBQVM7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