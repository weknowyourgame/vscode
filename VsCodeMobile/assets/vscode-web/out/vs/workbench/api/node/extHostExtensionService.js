/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as performance from '../../../base/common/performance.js';
import { createApiFactoryAndRegisterActors } from '../common/extHost.api.impl.js';
import { RequireInterceptor } from '../common/extHostRequireInterceptor.js';
import { connectProxyResolver } from './proxyResolver.js';
import { AbstractExtHostExtensionService } from '../common/extHostExtensionService.js';
import { ExtHostDownloadService } from './extHostDownloadService.js';
import { URI } from '../../../base/common/uri.js';
import { Schemas } from '../../../base/common/network.js';
import { ExtensionRuntime } from '../common/extHostTypes.js';
import { CLIServer } from './extHostCLIServer.js';
import { realpathSync } from '../../../base/node/pfs.js';
import { ExtHostConsoleForwarder } from './extHostConsoleForwarder.js';
import { ExtHostDiskFileSystemProvider } from './extHostDiskFileSystemProvider.js';
import nodeModule from 'node:module';
import { assertType } from '../../../base/common/types.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { BidirectionalMap } from '../../../base/common/map.js';
import { DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
const require = nodeModule.createRequire(import.meta.url);
class NodeModuleRequireInterceptor extends RequireInterceptor {
    _installInterceptor() {
        const that = this;
        const node_module = require('module');
        const originalLoad = node_module._load;
        node_module._load = function load(request, parent, isMain) {
            request = applyAlternatives(request);
            if (!that._factories.has(request)) {
                return originalLoad.apply(this, arguments);
            }
            return that._factories.get(request).load(request, URI.file(realpathSync(parent.filename)), request => originalLoad.apply(this, [request, parent, isMain]));
        };
        const originalLookup = node_module._resolveLookupPaths;
        node_module._resolveLookupPaths = (request, parent) => {
            return originalLookup.call(this, applyAlternatives(request), parent);
        };
        const originalResolveFilename = node_module._resolveFilename;
        node_module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
            if (request === 'vsda' && Array.isArray(options?.paths) && options.paths.length === 0) {
                // ESM: ever since we moved to ESM, `require.main` will be `undefined` for extensions
                // Some extensions have been using `require.resolve('vsda', { paths: require.main.paths })`
                // to find the `vsda` module in our app root. To be backwards compatible with this pattern,
                // we help by filling in the `paths` array with the node modules paths of the current module.
                options.paths = node_module._nodeModulePaths(import.meta.dirname);
            }
            return originalResolveFilename.call(this, request, parent, isMain, options);
        };
        const applyAlternatives = (request) => {
            for (const alternativeModuleName of that._alternatives) {
                const alternative = alternativeModuleName(request);
                if (alternative) {
                    request = alternative;
                    break;
                }
            }
            return request;
        };
    }
}
class NodeModuleESMInterceptor extends RequireInterceptor {
    constructor() {
        super(...arguments);
        this._store = new DisposableStore();
    }
    static _createDataUri(scriptContent) {
        return `data:text/javascript;base64,${Buffer.from(scriptContent).toString('base64')}`;
    }
    // This string is a script that runs in the loader thread of NodeJS.
    static { this._loaderScript = `
	let lookup;
	export const initialize = async (context) => {
		let requestIds = 0;
		const { port } = context;
		const pendingRequests = new Map();
		port.onmessage = (event) => {
			const { id, url } = event.data;
			pendingRequests.get(id)?.(url);
		};
		lookup = url => {
			// debugger;
			const myId = requestIds++;
			return new Promise((resolve) => {
				pendingRequests.set(myId, resolve);
				port.postMessage({ id: myId, url, });
			});
		};
	};
	export const resolve = async (specifier, context, nextResolve) => {
		if (specifier !== 'vscode' || !context.parentURL) {
			return nextResolve(specifier, context);
		}
		const otherUrl = await lookup(context.parentURL);
		return {
			url: otherUrl,
			shortCircuit: true,
		};
	};`; }
    static { this._vscodeImportFnName = `_VSCODE_IMPORT_VSCODE_API`; }
    dispose() {
        this._store.dispose();
    }
    _installInterceptor() {
        const apiInstances = new BidirectionalMap();
        const apiImportDataUrl = new Map();
        // define a global function that can be used to get API instances given a random key
        Object.defineProperty(globalThis, NodeModuleESMInterceptor._vscodeImportFnName, {
            enumerable: false,
            configurable: false,
            writable: false,
            value: (key) => {
                return apiInstances.getKey(key);
            }
        });
        const { port1, port2 } = new MessageChannel();
        let apiModuleFactory;
        // this is a workaround for the fact that the layer checker does not understand
        // that onmessage is NodeJS API here
        const port1LayerCheckerWorkaround = port1;
        port1LayerCheckerWorkaround.onmessage = (e) => {
            // Get the vscode-module factory - which is the same logic that's also used by
            // the CommonJS require interceptor
            if (!apiModuleFactory) {
                apiModuleFactory = this._factories.get('vscode');
                assertType(apiModuleFactory);
            }
            const { id, url } = e.data;
            const uri = URI.parse(url);
            // Get or create the API instance. The interface is per extension and extensions are
            // looked up by the uri (e.data.url) and path containment.
            const apiInstance = apiModuleFactory.load('_not_used', uri, () => { throw new Error('CANNOT LOAD MODULE from here.'); });
            let key = apiInstances.get(apiInstance);
            if (!key) {
                key = generateUuid();
                apiInstances.set(apiInstance, key);
            }
            // Create and cache a data-url which is the import script for the API instance
            let scriptDataUrlSrc = apiImportDataUrl.get(key);
            if (!scriptDataUrlSrc) {
                const jsCode = `const _vscodeInstance = globalThis.${NodeModuleESMInterceptor._vscodeImportFnName}('${key}');\n\n${Object.keys(apiInstance).map((name => `export const ${name} = _vscodeInstance['${name}'];`)).join('\n')}`;
                scriptDataUrlSrc = NodeModuleESMInterceptor._createDataUri(jsCode);
                apiImportDataUrl.set(key, scriptDataUrlSrc);
            }
            port1.postMessage({
                id,
                url: scriptDataUrlSrc
            });
        };
        nodeModule.register(NodeModuleESMInterceptor._createDataUri(NodeModuleESMInterceptor._loaderScript), {
            parentURL: import.meta.url,
            data: { port: port2 },
            transferList: [port2],
        });
        this._store.add(toDisposable(() => {
            port1.close();
            port2.close();
        }));
    }
}
export class ExtHostExtensionService extends AbstractExtHostExtensionService {
    constructor() {
        super(...arguments);
        this.extensionRuntime = ExtensionRuntime.Node;
    }
    async _beforeAlmostReadyToRunExtensions() {
        // make sure console.log calls make it to the render
        this._instaService.createInstance(ExtHostConsoleForwarder);
        // initialize API and register actors
        const extensionApiFactory = this._instaService.invokeFunction(createApiFactoryAndRegisterActors);
        // Register Download command
        this._instaService.createInstance(ExtHostDownloadService);
        // Register CLI Server for ipc
        if (this._initData.remote.isRemote && this._initData.remote.authority) {
            const cliServer = this._instaService.createInstance(CLIServer);
            process.env['VSCODE_IPC_HOOK_CLI'] = cliServer.ipcHandlePath;
        }
        // Register local file system shortcut
        this._instaService.createInstance(ExtHostDiskFileSystemProvider);
        // Module loading tricks
        await this._instaService.createInstance(NodeModuleRequireInterceptor, extensionApiFactory, { mine: this._myRegistry, all: this._globalRegistry })
            .install();
        // ESM loading tricks
        await this._store.add(this._instaService.createInstance(NodeModuleESMInterceptor, extensionApiFactory, { mine: this._myRegistry, all: this._globalRegistry }))
            .install();
        performance.mark('code/extHost/didInitAPI');
        // Do this when extension service exists, but extensions are not being activated yet.
        const configProvider = await this._extHostConfiguration.getConfigProvider();
        await connectProxyResolver(this._extHostWorkspace, configProvider, this, this._logService, this._mainThreadTelemetryProxy, this._initData, this._store);
        performance.mark('code/extHost/didInitProxyResolver');
    }
    _getEntryPoint(extensionDescription) {
        return extensionDescription.main;
    }
    async _doLoadModule(extension, module, activationTimesBuilder, mode) {
        if (module.scheme !== Schemas.file) {
            throw new Error(`Cannot load URI: '${module}', must be of file-scheme`);
        }
        let r = null;
        activationTimesBuilder.codeLoadingStart();
        this._logService.trace(`ExtensionService#loadModule [${mode}] -> ${module.toString(true)}`);
        this._logService.flush();
        const extensionId = extension?.identifier.value;
        if (extension) {
            await this._extHostLocalizationService.initializeLocalizedMessages(extension);
        }
        try {
            if (extensionId) {
                performance.mark(`code/extHost/willLoadExtensionCode/${extensionId}`);
            }
            if (mode === 'esm') {
                r = await import(module.toString(true));
            }
            else {
                r = require(module.fsPath);
            }
        }
        finally {
            if (extensionId) {
                performance.mark(`code/extHost/didLoadExtensionCode/${extensionId}`);
            }
            activationTimesBuilder.codeLoadingStop();
        }
        return r;
    }
    async _loadCommonJSModule(extension, module, activationTimesBuilder) {
        return this._doLoadModule(extension, module, activationTimesBuilder, 'cjs');
    }
    async _loadESMModule(extension, module, activationTimesBuilder) {
        return this._doLoadModule(extension, module, activationTimesBuilder, 'esm');
    }
    async $setRemoteEnvironment(env) {
        if (!this._initData.remote.isRemote) {
            return;
        }
        for (const key in env) {
            const value = env[key];
            if (value === null) {
                delete process.env[key];
            }
            else {
                process.env[key] = value;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdEV4dGVuc2lvblNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9ub2RlL2V4dEhvc3RFeHRlbnNpb25TZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxXQUFXLE1BQU0scUNBQXFDLENBQUM7QUFFbkUsT0FBTyxFQUFFLGlDQUFpQyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDbEYsT0FBTyxFQUFzQixrQkFBa0IsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRWhHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzFELE9BQU8sRUFBRSwrQkFBK0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3JFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNsRCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFFMUQsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDN0QsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2xELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUN6RCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUN2RSxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNuRixPQUFPLFVBQVUsTUFBTSxhQUFhLENBQUM7QUFDckMsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQzNELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUM1RCxPQUFPLEVBQUUs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