/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { FileAccess, nodeModulesAsarPath, nodeModulesPath, Schemas, VSCODE_AUTHORITY } from './base/common/network.js';
import * as platform from './base/common/platform.js';
import { URI } from './base/common/uri.js';
import { generateUuid } from './base/common/uuid.js';
export const canASAR = false; // TODO@esm: ASAR disabled in ESM
class DefineCall {
    constructor(id, dependencies, callback) {
        this.id = id;
        this.dependencies = dependencies;
        this.callback = callback;
    }
}
var AMDModuleImporterState;
(function (AMDModuleImporterState) {
    AMDModuleImporterState[AMDModuleImporterState["Uninitialized"] = 1] = "Uninitialized";
    AMDModuleImporterState[AMDModuleImporterState["InitializedInternal"] = 2] = "InitializedInternal";
    AMDModuleImporterState[AMDModuleImporterState["InitializedExternal"] = 3] = "InitializedExternal";
})(AMDModuleImporterState || (AMDModuleImporterState = {}));
class AMDModuleImporter {
    static { this.INSTANCE = new AMDModuleImporter(); }
    constructor() {
        this._isWebWorker = (typeof self === 'object' && self.constructor && self.constructor.name === 'DedicatedWorkerGlobalScope');
        this._isRenderer = typeof document === 'object';
        this._defineCalls = [];
        this._state = AMDModuleImporterState.Uninitialized;
    }
    _initialize() {
        if (this._state === AMDModuleImporterState.Uninitialized) {
            if (globalThis.define) {
                this._state = AMDModuleImporterState.InitializedExternal;
                return;
            }
        }
        else {
            return;
        }
        this._state = AMDModuleImporterState.InitializedInternal;
        globalThis.define = (id, dependencies, callback) => {
            if (typeof id !== 'string') {
                callback = dependencies;
                dependencies = id;
                id = null;
            }
            if (typeof dependencies !== 'object' || !Array.isArray(dependencies)) {
                callback = dependencies;
                dependencies = null;
            }
            // if (!dependencies) {
            // 	dependencies = ['require', 'exports', 'module'];
            // }
            this._defineCalls.push(new DefineCall(id, dependencies, callback));
        };
        globalThis.define.amd = true;
        if (this._isRenderer) {
            this._amdPolicy = globalThis._VSCODE_WEB_PACKAGE_TTP ?? window.trustedTypes?.createPolicy('amdLoader', {
                createScriptURL(value) {
                    if (value.startsWith(window.location.origin)) {
                        return value;
                    }
                    if (value.startsWith(`${Schemas.vscodeFileResource}://${VSCODE_AUTHORITY}`)) {
                        return value;
                    }
                    throw new Error(`[trusted_script_src] Invalid script url: ${value}`);
                }
            });
        }
        else if (this._isWebWorker) {
            this._amdPolicy = globalThis._VSCODE_WEB_PACKAGE_TTP ?? globalThis.trustedTypes?.createPolicy('amdLoader', {
                createScriptURL(value) {
                    return value;
                }
            });
        }
    }
    async load(scriptSrc) {
        this._initialize();
        if (this._state === AMDModuleImporterState.InitializedExternal) {
            return new Promise(resolve => {
                const tmpModuleId = generateUuid();
                globalThis.define(tmpModuleId, [scriptSrc], function (moduleResult) {
                    resolve(moduleResult);
                });
            });
        }
        const defineCall = await (this._isWebWorker ? this._workerLoadScript(scriptSrc) : this._isRenderer ? this._rendererLoadScript(scriptSrc) : this._nodeJSLoadScript(scriptSrc));
        if (!defineCall) {
            console.warn(`Did not receive a define call from script ${scriptSrc}`);
            return undefined;
        }
        // TODO@esm require, module
        const exports = {};
        const dependencyObjs = [];
        const dependencyModules = [];
        if (Array.isArray(defineCall.dependencies)) {
            for (const mod of defineCall.dependencies) {
                if (mod === 'exports') {
                    dependencyObjs.push(exports);
                }
                else {
                    dependencyModules.push(mod);
                }
            }
        }
        if (dependencyModules.length > 0) {
            throw new Error(`Cannot resolve dependencies for script ${scriptSrc}. The dependencies are: ${dependencyModules.join(', ')}`);
        }
        if (typeof defineCall.callback === 'function') {
            return defineCall.callback(...dependencyObjs) ?? exports;
        }
        else {
            return defineCall.callback;
        }
    }
    _rendererLoadScript(scriptSrc) {
        return new Promise((resolve, reject) => {
            const scriptElement = document.createElement('script');
            scriptElement.setAttribute('async', 'async');
            scriptElement.setAttribute('type', 'text/javascript');
            const unbind = () => {
                scriptElement.removeEventListener('load', loadEventListener);
                scriptElement.removeEventListener('error', errorEventListener);
            };
            const loadEventListener = (e) => {
                unbind();
                resolve(this._defineCalls.pop());
            };
            const errorEventListener = (e) => {
                unbind();
                reject(e);
            };
            scriptElement.addEventListener('load', loadEventListener);
            scriptElement.addEventListener('error', errorEventListener);
            if (this._amdPolicy) {
                scriptSrc = this._amdPolicy.createScriptURL(scriptSrc);
            }
            scriptElement.setAttribute('src', scriptSrc);
            window.document.getElementsByTagName('head')[0].appendChild(scriptElement);
        });
    }
    async _workerLoadScript(scriptSrc) {
        if (this._amdPolicy) {
            scriptSrc = this._amdPolicy.createScriptURL(scriptSrc);
        }
        await import(scriptSrc);
        return this._defineCalls.pop();
    }
    async _nodeJSLoadScript(scriptSrc) {
        try {
            const fs = (await import(`${'fs'}`)).default;
            const vm = (await import(`${'vm'}`)).default;
            const module = (await import(`${'module'}`)).default;
            const filePath = URI.parse(scriptSrc).fsPath;
            const content = fs.readFileSync(filePath).toString();
            const scriptSource = module.wrap(content.replace(/^#!.*/, ''));
            const script = new vm.Script(scriptSource);
            const compileWrapper = script.runInThisContext();
            compileWrapper.apply();
            return this._defineCalls.pop();
        }
        catch (error) {
            throw error;
        }
    }
}
const cache = new Map();
/**
 * Utility for importing an AMD node module. This util supports AMD and ESM contexts and should be used while the ESM adoption
 * is on its way.
 *
 * e.g. pass in `vscode-textmate/release/main.js`
 */
export async function importAMDNodeModule(nodeModuleName, pathInsideNodeModule, isBuilt) {
    if (isBuilt === undefined) {
        const product = globalThis._VSCODE_PRODUCT_JSON;
        isBuilt = Boolean((product ?? globalThis.vscode?.context?.configuration()?.product)?.commit);
    }
    const nodeModulePath = pathInsideNodeModule ? `${nodeModuleName}/${pathInsideNodeModule}` : nodeModuleName;
    if (cache.has(nodeModulePath)) {
        return cache.get(nodeModulePath);
    }
    let scriptSrc;
    if (/^\w[\w\d+.-]*:\/\//.test(nodeModulePath)) {
        // looks like a URL
        // bit of a special case for: src/vs/workbench/services/languageDetection/browser/languageDetectionWebWorker.ts
        scriptSrc = nodeModulePath;
    }
    else {
        const useASAR = (canASAR && isBuilt && !platform.isWeb);
        const actualNodeModulesPath = (useASAR ? nodeModulesAsarPath : nodeModulesPath);
        const resourcePath = `${actualNodeModulesPath}/${nodeModulePath}`;
        scriptSrc = FileAccess.asBrowserUri(resourcePath).toString(true);
    }
    const result = AMDModuleImporter.INSTANCE.load(scriptSrc);
    cache.set(nodeModulePath, result);
    return result;
}
export function resolveAmdNodeModulePath(nodeModuleName, pathInsideNodeModule) {
    const product = globalThis._VSCODE_PRODUCT_JSON;
    const isBuilt = Boolean((product ?? globalThis.vscode?.context?.configuration()?.product)?.commit);
    const useASAR = (canASAR && isBuilt && !platform.isWeb);
    const nodeModulePath = `${nodeModuleName}/${pathInsideNodeModule}`;
    const actualNodeModulesPath = (useASAR ? nodeModulesAsarPath : nodeModulesPath);
    const resourcePath = `${actualNodeModulesPath}/${nodeModulePath}`;
    return FileAccess.asBrowserUri(resourcePath).toString(true);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW1kWC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9hbWRYLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBbUIsVUFBVSxFQUFFLG1CQUFtQixFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUN4SSxPQUFPLEtBQUssUUFBUSxNQUFNLDJCQUEyQixDQUFDO0FBRXRELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUMzQyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFFckQsTUFBTSxDQUFDLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxDQUFDLGlDQUFpQztBQU8vRCxNQUFNLFVBQVU7SUFDZixZQUNpQixFQUE2QixFQUM3QixZQUF5QyxFQUN6QyxRQUFhO1FBRmIsT0FBRSxHQUFGLEVBQUUsQ0FBMkI7UUFDN0IsaUJBQVksR0FBWixZQUFZLENBQTZCO1FBQ3pDLGFBQVEsR0FBUixRQUFRLENBQUs7SUFDMUIsQ0FBQztDQUNMO0FBRUQsSUFBSyxzQkFJSjtBQUpELFdBQUssc0JBQXNCO0lBQzFCLHFGQUFpQixDQUFBO0lBQ2pCLGlHQUFtQixDQUFBO0lBQ25CLGlHQUFtQixDQUFBO0FBQ3BCLENBQUMsRUFKSSxzQkFBc0IsS0FBdEIsc0JBQXNCLFFBSTFCO0FBRUQsTUFBTSxpQkFBaUI7YUFDUixhQUFRLEdBQUcsSUFBSSxpQkFBaUIsRUFBRSxBQUExQixDQUEyQjtJQVNqRDtRQVBpQixpQkFBWSxHQUFHLENBQUMsT0FBTyxJQUFJLEtBQUssUUFBUSxJQUFJLElBQUksQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEtBQUssNEJBQTRCLENBQUMsQ0FBQztRQUN4SCxnQkFBVyxHQUFHLE9BQU8sUUFBUSxLQUFLLFFB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