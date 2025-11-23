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
import { mixin, deepClone } from '../../../base/common/objects.js';
import { Emitter } from '../../../base/common/event.js';
import { IExtHostWorkspace } from './extHostWorkspace.js';
import { MainContext } from './extHost.protocol.js';
import { ConfigurationTarget as ExtHostConfigurationTarget } from './extHostTypes.js';
import { Configuration, ConfigurationChangeEvent } from '../../../platform/configuration/common/configurationModels.js';
import { OVERRIDE_PROPERTY_REGEX } from '../../../platform/configuration/common/configurationRegistry.js';
import { isObject } from '../../../base/common/types.js';
import { Barrier } from '../../../base/common/async.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { URI } from '../../../base/common/uri.js';
function lookUp(tree, key) {
    if (key) {
        const parts = key.split('.');
        let node = tree;
        for (let i = 0; node && i < parts.length; i++) {
            node = node[parts[i]];
        }
        return node;
    }
    return undefined;
}
function isUri(thing) {
    return thing instanceof URI;
}
function isResourceLanguage(thing) {
    return isObject(thing)
        && thing.uri instanceof URI
        && !!thing.languageId
        && typeof thing.languageId === 'string';
}
function isLanguage(thing) {
    return isObject(thing)
        && !thing.uri
        && !!thing.languageId
        && typeof thing.languageId === 'string';
}
function isWorkspaceFolder(thing) {
    return isObject(thing)
        && thing.uri instanceof URI
        && (!thing.name || typeof thing.name === 'string')
        && (!thing.index || typeof thing.index === 'number');
}
function scopeToOverrides(scope) {
    if (isUri(scope)) {
        return { resource: scope };
    }
    if (isResourceLanguage(scope)) {
        return { resource: scope.uri, overrideIdentifier: scope.languageId };
    }
    if (isLanguage(scope)) {
        return { overrideIdentifier: scope.languageId };
    }
    if (isWorkspaceFolder(scope)) {
        return { resource: scope.uri };
    }
    if (scope === null) {
        return { resource: null };
    }
    return undefined;
}
let ExtHostConfiguration = class ExtHostConfiguration {
    constructor(extHostRpc, extHostWorkspace, logService) {
        this._proxy = extHostRpc.getProxy(MainContext.MainThreadConfiguration);
        this._extHostWorkspace = extHostWorkspace;
        this._logService = logService;
        this._barrier = new Barrier();
        this._actual = null;
    }
    getConfigProvider() {
        return this._barrier.wait().then(_ => this._actual);
    }
    $initializeConfiguration(data) {
        this._actual = new ExtHostConfigProvider(this._proxy, this._extHostWorkspace, data, this._logService);
        this._barrier.open();
    }
    $acceptConfigurationChanged(data, change) {
        this.getConfigProvider().then(provider => provider.$acceptConfigurationChanged(data, change));
    }
};
ExtHostConfiguration = __decorate([
    __param(0, IExtHostRpcService),
    __param(1, IExtHostWorkspace),
    __param(2, ILogService)
], ExtHostConfiguration);
export { ExtHostConfiguration };
export class ExtHostConfigProvider {
    constructor(proxy, extHostWorkspace, data, logService) {
        this._onDidChangeConfiguration = new Emitter();
        this._proxy = proxy;
        this._logService = logService;
        this._extHostWorkspace = extHostWorkspace;
        this._configuration = Configuration.parse(data, logService);
        this._configurationScopes = this._toMap(data.configurationScopes);
    }
    get onDidChangeConfiguration() {
        return this._onDidChangeConfiguration && this._onDidChangeConfiguration.event;
    }
    $acceptConfigurationChanged(data, change) {
        const previous = { data: this._configuration.toData(), workspace: this._extHostWorkspace.workspace };
        this._configuration = Configuration.parse(data, this._logService);
        this._configurationScopes = this._toMap(data.configurationScopes);
        this._onDidChangeConfiguration.fire(this._toConfigurationChangeEvent(change, previous));
    }
    getConfiguration(section, scope, extensionDescription) {
        const overrides = scopeToOverrides(scope) || {};
        const config = this._toReadonlyValue(this._configuration.getValue(section, overrides, this._extHostWorkspace.workspace));
        if (section) {
            this._validateConfigurationAccess(section, overrides, extensionDescription?.identifier);
        }
        function parseConfigurationTarget(arg) {
            if (arg === undefined || arg === null) {
                return null;
            }
            if (typeof arg === 'boolean') {
                return arg ? 2 /* ConfigurationTarget.USER */ : 5 /* ConfigurationTarget.WORKSPACE */;
            }
            switch (arg) {
                case ExtHostConfigurationTarget.Global: return 2 /* ConfigurationTarget.USER */;
                case ExtHostConfigurationTarget.Workspace: return 5 /* ConfigurationTarget.WORKSPACE */;
                case ExtHostConfigurationTarget.WorkspaceFolder: return 6 /* ConfigurationTarget.WORKSPACE_FOLDER */;
            }
        }
        const result = {
            has(key) {
                return typeof lookUp(config, key) !== 'undefined';
            },
            get: (key, defaultValue) => {
                this._validateConfigurationAccess(section ? `${section}.${key}` : key, overrides, extensionDescription?.identifier);
                let result = lookUp(config, key);
                if (typeof result === 'undefined') {
                    result = defaultValue;
                }
                else {
                    let clonedConfig = undefined;
                    const cloneOnWriteProxy = (target, accessor) => {
                        if (isObject(target)) {
                            let clonedTarget = undefined;
                            const cloneTarget = () => {
                                clonedConfig = clonedConfig ? clonedConfig : deepClone(config);
                                clonedTarget = clonedTarget ? clonedTarget : lookUp(clonedConfig, accessor);
                            };
                            return new Proxy(target, {
                                get: (target, property) => {
                                    if (typeof property === 'string' && property.toLowerCase() === 'tojson') {
                                        cloneTarget();
                                        return () => clonedTarget;
                                    }
                                    if (clonedConfig) {
                                        clonedTarget = clonedTarget ? clonedTarget : lookUp(clonedConfig, accessor);
                                        return clonedTarget[property];
                                    }
                                    const result = target[property];
                                    if (typeof property === 'string') {
                                        return cloneOnWriteProxy(result, `${accessor}.${property}`);
                                    }
                                    return result;
                                },
                                set: (_target, property, value) => {
                                    cloneTarget();
                                    if (clonedTarget) {
                                        clonedTarget[property] = value;
                                    }
                                    return true;
                                },
                                deleteProperty: (_target, property) => {
                                    cloneTarget();
                                    if (clonedTarget) {
                                        delete clonedTarget[property];
                                    }
                                    return true;
                                },
                                defineProperty: (_target, property, descriptor) => {
                                    cloneTarget();
                                    if (clonedTarget) {
                                        Object.defineProperty(clonedTarget, property, descriptor);
                                    }
                                    return true;
                                }
                            });
                        }
                        if (Array.isArray(target)) {
                            return deepClone(target);
                        }
                        return target;
                    };
                    result = cloneOnWriteProxy(result, key);
                }
                return result;
            },
            update: (key, value, extHostConfigurationTarget, scopeToLanguage) => {
                key = section ? `${section}.${key}` : key;
                const target = parseConfigurationTarget(extHostConfigurationTarget);
                if (value !== undefined) {
                    return this._proxy.$updateConfigurationOption(target, key, value, overrides, scopeToLanguage);
                }
                else {
                    return this._proxy.$removeConfigurationOption(target, key, overrides, scopeToLanguage);
                }
            },
            inspect: (key) => {
                key = section ? `${section}.${key}` : key;
                const config = this._configuration.inspect(key, overrides, this._extHostWorkspace.workspace);
                if (config) {
                    return {
                        key,
                        defaultValue: deepClone(config.policy?.value ?? config.default?.value),
                        globalLocalValue: deepClone(config.userLocal?.value),
                        globalRemoteValue: deepClone(config.userRemote?.value),
                        globalValue: deepClone(config.user?.value ?? config.application?.value),
                        workspaceValue: deepClone(config.workspace?.value),
                        workspaceFolderValue: deepClone(config.workspaceFolder?.value),
                        defaultLanguageValue: deepClone(config.default?.override),
                        globalLocalLanguageValue: deepClone(config.userLocal?.override),
                        globalRemoteLanguageValue: deepClone(config.userRemote?.override),
                        globalLanguageValue: deepClone(config.user?.override ?? config.application?.override),
                        workspaceLanguageValue: deepClone(config.workspace?.override),
                        workspaceFolderLanguageValue: deepClone(config.workspaceFolder?.override),
                        languageIds: deepClone(config.overrideIdentifiers)
                    };
                }
                return undefined;
            }
        };
        if (typeof config === 'object') {
            mixin(result, config, false);
        }
        return Object.freeze(result);
    }
    _toReadonlyValue(result) {
        const readonlyProxy = (target) => {
            return isObject(target) ?
                new Proxy(target, {
                    get: (target, property) => readonlyProxy(target[property]),
                    set: (_target, property, _value) => { throw new Error(`TypeError: Cannot assign to read only property '${String(property)}' of object`); },
                    deleteProperty: (_target, property) => { throw new Error(`TypeError: Cannot delete read only property '${String(property)}' of object`); },
                    defineProperty: (_target, property) => { throw new Error(`TypeError: Cannot define property '${String(property)}' for a readonly object`); },
                    setPrototypeOf: (_target) => { throw new Error(`TypeError: Cannot set prototype for a readonly object`); },
                    isExtensible: () => false,
                    preventExtensions: () => true
                }) : target;
        };
        return readonlyProxy(result);
    }
    _validateConfigurationAccess(key, overrides, extensionId) {
        const scope = OVERRIDE_PROPERTY_REGEX.test(key) ? 5 /* ConfigurationScope.RESOURCE */ : this._configurationScopes.get(key);
        const extensionIdText = extensionId ? `[${extensionId.value}] ` : '';
        if (5 /* ConfigurationScope.RESOURCE */ === scope) {
            if (typeof overrides?.resource === 'undefined') {
                this._logService.warn(`${extensionIdText}Accessing a resource scoped configuration without providing a resource is not expected. To get the effective value for '${key}', provide the URI of a resource or 'null' for any resource.`);
            }
            return;
        }
        if (4 /* ConfigurationScope.WINDOW */ === scope) {
            if (overrides?.resource) {
                this._logService.warn(`${extensionIdText}Accessing a window scoped configuration for a resource is not expected. To associate '${key}' to a resource, define its scope to 'resource' in configuration contributions in 'package.json'.`);
            }
            return;
        }
    }
    _toConfigurationChangeEvent(change, previous) {
        const event = new ConfigurationChangeEvent(change, previous, this._configuration, this._extHostWorkspace.workspace, this._logService);
        return Object.freeze({
            affectsConfiguration: (section, scope) => event.affectsConfiguration(section, scopeToOverrides(scope))
        });
    }
    _toMap(scopes) {
        return scopes.reduce((result, scope) => { result.set(scope[0], scope[1]); return result; }, new Map());
    }
}
export const IExtHostConfiguration = createDecorator('IExtHostConfiguration');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdENvbmZpZ3VyYXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9jb21tb24vZXh0SG9zdENvbmZpZ3VyYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNuRSxPQUFPLEVBQVMsT0FBTyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFL0QsT0FBTyxFQUFvQixpQkFBaUIsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzVFLE9BQU8sRUFBbUYsV0FBVyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDckksT0FBTyxFQUFFLG1CQUFtQixJQUFJLDBCQUEwQixFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFFdEYsT0FBTyxFQUFFLGFBQWEsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3hILE9BQU8sRUFBc0IsdUJBQXVCLEVBQUUsTUFBTSxpRUFBaUUsQ0FBQztBQUM5SCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFekQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUM1RCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFbEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBRWxELFNBQVMsTUFBTSxDQUFDLElBQWEsRUFBRSxHQUFXO0lBQ3pDLElBQUksR0FBRyxFQUFFLENBQUM7UUFDVCxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FB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