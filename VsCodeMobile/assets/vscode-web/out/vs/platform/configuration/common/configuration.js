/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { assertNever } from '../../../base/common/assert.js';
import * as types from '../../../base/common/types.js';
import { URI } from '../../../base/common/uri.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
export const IConfigurationService = createDecorator('configurationService');
export function isConfigurationOverrides(obj) {
    const thing = obj;
    return thing
        && typeof thing === 'object'
        && (!thing.overrideIdentifier || typeof thing.overrideIdentifier === 'string')
        && (!thing.resource || thing.resource instanceof URI);
}
export function isConfigurationUpdateOverrides(obj) {
    const thing = obj;
    return thing
        && typeof thing === 'object'
        && (!thing.overrideIdentifiers || Array.isArray(thing.overrideIdentifiers))
        && !thing.overrideIdentifier
        && (!thing.resource || thing.resource instanceof URI);
}
export var ConfigurationTarget;
(function (ConfigurationTarget) {
    ConfigurationTarget[ConfigurationTarget["APPLICATION"] = 1] = "APPLICATION";
    ConfigurationTarget[ConfigurationTarget["USER"] = 2] = "USER";
    ConfigurationTarget[ConfigurationTarget["USER_LOCAL"] = 3] = "USER_LOCAL";
    ConfigurationTarget[ConfigurationTarget["USER_REMOTE"] = 4] = "USER_REMOTE";
    ConfigurationTarget[ConfigurationTarget["WORKSPACE"] = 5] = "WORKSPACE";
    ConfigurationTarget[ConfigurationTarget["WORKSPACE_FOLDER"] = 6] = "WORKSPACE_FOLDER";
    ConfigurationTarget[ConfigurationTarget["DEFAULT"] = 7] = "DEFAULT";
    ConfigurationTarget[ConfigurationTarget["MEMORY"] = 8] = "MEMORY";
})(ConfigurationTarget || (ConfigurationTarget = {}));
export function ConfigurationTargetToString(configurationTarget) {
    switch (configurationTarget) {
        case 1 /* ConfigurationTarget.APPLICATION */: return 'APPLICATION';
        case 2 /* ConfigurationTarget.USER */: return 'USER';
        case 3 /* ConfigurationTarget.USER_LOCAL */: return 'USER_LOCAL';
        case 4 /* ConfigurationTarget.USER_REMOTE */: return 'USER_REMOTE';
        case 5 /* ConfigurationTarget.WORKSPACE */: return 'WORKSPACE';
        case 6 /* ConfigurationTarget.WORKSPACE_FOLDER */: return 'WORKSPACE_FOLDER';
        case 7 /* ConfigurationTarget.DEFAULT */: return 'DEFAULT';
        case 8 /* ConfigurationTarget.MEMORY */: return 'MEMORY';
    }
}
export function getConfigValueInTarget(configValue, scope) {
    switch (scope) {
        case 1 /* ConfigurationTarget.APPLICATION */:
            return configValue.applicationValue;
        case 2 /* ConfigurationTarget.USER */:
            return configValue.userValue;
        case 3 /* ConfigurationTarget.USER_LOCAL */:
            return configValue.userLocalValue;
        case 4 /* ConfigurationTarget.USER_REMOTE */:
            return configValue.userRemoteValue;
        case 5 /* ConfigurationTarget.WORKSPACE */:
            return configValue.workspaceValue;
        case 6 /* ConfigurationTarget.WORKSPACE_FOLDER */:
            return configValue.workspaceFolderValue;
        case 7 /* ConfigurationTarget.DEFAULT */:
            return configValue.defaultValue;
        case 8 /* ConfigurationTarget.MEMORY */:
            return configValue.memoryValue;
        default:
            assertNever(scope);
    }
}
export function isConfigured(configValue) {
    return configValue.applicationValue !== undefined ||
        configValue.userValue !== undefined ||
        configValue.userLocalValue !== undefined ||
        configValue.userRemoteValue !== undefined ||
        configValue.workspaceValue !== undefined ||
        configValue.workspaceFolderValue !== undefined;
}
export function toValuesTree(properties, conflictReporter) {
    const root = Object.create(null);
    for (const key in properties) {
        addToValueTree(root, key, properties[key], conflictReporter);
    }
    return root;
}
export function addToValueTree(settingsTreeRoot, key, value, conflictReporter) {
    const segments = key.split('.');
    const last = segments.pop();
    let curr = settingsTreeRoot;
    for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        let obj = curr[s];
        switch (typeof obj) {
            case 'undefined':
                obj = curr[s] = Object.create(null);
                break;
            case 'object':
                if (obj === null) {
                    conflictReporter(`Ignoring ${key} as ${segments.slice(0, i + 1).join('.')} is null`);
                    return;
                }
                break;
            default:
                conflictReporter(`Ignoring ${key} as ${segments.slice(0, i + 1).join('.')} is ${JSON.stringify(obj)}`);
                return;
        }
        curr = obj;
    }
    if (typeof curr === 'object' && curr !== null) {
        try {
            curr[last] = value; // workaround https://github.com/microsoft/vscode/issues/13606
        }
        catch (e) {
            conflictReporter(`Ignoring ${key} as ${segments.join('.')} is ${JSON.stringify(curr)}`);
        }
    }
    else {
        conflictReporter(`Ignoring ${key} as ${segments.join('.')} is ${JSON.stringify(curr)}`);
    }
}
export function removeFromValueTree(valueTree, key) {
    const segments = key.split('.');
    doRemoveFromValueTree(valueTree, segments);
}
function doRemoveFromValueTree(valueTree, segments) {
    if (!valueTree) {
        return;
    }
    const valueTreeRecord = valueTree;
    const first = segments.shift();
    if (segments.length === 0) {
        // Reached last segment
        delete valueTreeRecord[first];
        return;
    }
    if (Object.keys(valueTreeRecord).indexOf(first) !== -1) {
        const value = valueTreeRecord[first];
        if (typeof value === 'object' && !Array.isArray(value)) {
            doRemoveFromValueTree(value, segments);
            if (Object.keys(value).length === 0) {
                delete valueTreeRecord[first];
            }
        }
    }
}
export function getConfigurationValue(config, settingPath, defaultValue) {
    function accessSetting(config, path) {
        let current = config;
        for (const component of path) {
            if (typeof current !== 'object' || current === null) {
                return undefined;
            }
            current = current[component];
        }
        return current;
    }
    const path = settingPath.split('.');
    const result = accessSetting(config, path);
    return typeof result === 'undefined' ? defaultValue : result;
}
export function merge(base, add, overwrite) {
    Object.keys(add).forEach(key => {
        if (key !== '__proto__') {
            if (key in base) {
                if (types.isObject(base[key]) && types.isObject(add[key])) {
                    merge(base[key], add[key], overwrite);
                }
                else if (overwrite) {
                    base[key] = add[key];
                }
            }
            else {
                base[key] = add[key];
            }
        }
    });
}
export function getLanguageTagSettingPlainKey(settingKey) {
    return settingKey
        .replace(/^\[/, '')
        .replace(/]$/g, '')
        .replace(/\]\[/g, ', ');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlndXJhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUc3RCxPQUFPLEtBQUssS0FBSyxNQUFNLCtCQUErQixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxHQUFHLEVBQWlCLE1BQU0sNkJBQTZCLENBQUM7QUFDakUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRzlFLE1BQU0sQ0FBQyxNQUFNLHFCQUFxQixHQUFHLGVBQWUsQ0FBd0Isc0JBQXNCLENBQUMsQ0FBQztBQUVwRyxNQUFNLFVBQVUsd0JBQXdCLENBQUMsR0FBWTtJQUNwRCxNQUFNLEtBQUssR0FBRyxHQUE4QixDQUFDO0lBQzdDLE9BQU8sS0FBSztXQUNSLE9BQU8sS0FBSyxLQUFLLFFBQVE7V0FDekIsQ0FBQyxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsSUFBSSxPQUFPLEtBQUssQ0FBQyxrQkFBa0IsS0FBSyxRQUFRLENBQUM7V0FDM0UsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDLFFBQVEsWUFBWSxHQUFHLENBQUMsQ0FBQztBQUN4RCxDQUFDO0FBT0QsTUFBTSxVQUFVLDhCQUE4QixDQUFDLEdBQVk7SUFDMUQsTUFBTSxLQUFLLEdBQUcsR0FBOEQsQ0FBQztJQUM3RSxPQUFPLEtBQUs7V0FDUixPQUFPLEtBQUssS0FBSyxRQUFRO1dBQ3pCLENBQUMsQ0FBRSxLQUF1QyxDQUFDLG1CQUFtQixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUUsS0FBdUMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1dBQzlJLENBQUUsS0FBaUMsQ0FBQyxrQkFBa0I7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