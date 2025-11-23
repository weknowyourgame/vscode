/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../base/common/event.js';
import { TernarySearchTree } from '../../../../base/common/ternarySearchTree.js';
import { getConfigurationValue, isConfigurationOverrides } from '../../common/configuration.js';
import { Extensions } from '../../common/configurationRegistry.js';
import { Registry } from '../../../registry/common/platform.js';
export class TestConfigurationService {
    constructor(configuration) {
        this.onDidChangeConfigurationEmitter = new Emitter();
        this.onDidChangeConfiguration = this.onDidChangeConfigurationEmitter.event;
        this.configurationByRoot = TernarySearchTree.forPaths();
        this.overrideIdentifiers = new Map();
        this.configuration = configuration || Object.create(null);
    }
    reloadConfiguration() {
        return Promise.resolve(this.getValue());
    }
    getValue(arg1, arg2) {
        let configuration;
        const overrides = isConfigurationOverrides(arg1) ? arg1 : isConfigurationOverrides(arg2) ? arg2 : undefined;
        if (overrides) {
            if (overrides.resource) {
                configuration = this.configurationByRoot.findSubstr(overrides.resource.fsPath);
            }
        }
        configuration = configuration ? configuration : this.configuration;
        if (arg1 && typeof arg1 === 'string') {
            return (configuration[arg1] ?? getConfigurationValue(configuration, arg1));
        }
        return configuration;
    }
    updateValue(key, value) {
        return Promise.resolve(undefined);
    }
    setUserConfiguration(key, value, root) {
        if (root) {
            const configForRoot = this.configurationByRoot.get(root.fsPath) || Object.create(null);
            configForRoot[key] = value;
            this.configurationByRoot.set(root.fsPath, configForRoot);
        }
        else {
            this.configuration[key] = value;
        }
        return Promise.resolve(undefined);
    }
    setOverrideIdentifiers(key, identifiers) {
        this.overrideIdentifiers.set(key, identifiers);
    }
    inspect(key, overrides) {
        const value = this.getValue(key, overrides);
        return {
            value,
            defaultValue: undefined,
            userValue: value,
            userLocalValue: value,
            overrideIdentifiers: this.overrideIdentifiers.get(key)
        };
    }
    keys() {
        return {
            default: Object.keys(Registry.as(Extensions.Configuration).getConfigurationProperties()),
            policy: [],
            user: Object.keys(this.configuration),
            workspace: [],
            workspaceFolder: []
        };
    }
    getConfigurationData() {
        return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUVqRixPQUFPLEVBQUUscUJBQXFCLEVBQWtHLHdCQUF3QixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDaE0sT0FBTyxFQUFFLFVBQVUsRUFBMEIsTUFBTSx1Q0FBdUMsQ0FBQztBQUMzRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFaEUsTUFBTSxPQUFPLHdCQUF3QjtJQU9wQyxZQUFZLGFBQXVDO1FBSDFDLG9DQUErQixHQUFHLElBQUksT0FBTyxFQUE2QixDQUFDO1FBQzNFLDZCQUF3QixHQUFHLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxLQUFLLENBQUM7UUFNdkUsd0JBQW1CLEdBQXVELGlCQUFpQixDQUFDLFFBQVEsRUFBMkIsQ0FBQztRQXFDaEksd0JBQW1CLEdBQTBCLElBQUksR0FBRyxFQUFFLENBQUM7UUF4QzlELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUlNLG1CQUFtQjtRQUN6QixPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBTyxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQUVNLFFBQVEsQ0FBSSxJQUF1QyxFQUFFLElBQThCO1FBQ3pGLElBQUksYUFBYSxDQUFDO1FBQ2xCLE1BQU0sU0FBUyxH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