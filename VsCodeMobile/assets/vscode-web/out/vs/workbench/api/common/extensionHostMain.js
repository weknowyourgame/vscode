/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as errors from '../../../base/common/errors.js';
import * as performance from '../../../base/common/performance.js';
import { URI } from '../../../base/common/uri.js';
import { MainContext } from './extHost.protocol.js';
import { RPCProtocol } from '../../services/extensions/common/rpcProtocol.js';
import { ExtensionError } from '../../../platform/extensions/common/extensions.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { getSingletonServiceDescriptors } from '../../../platform/instantiation/common/extensions.js';
import { ServiceCollection } from '../../../platform/instantiation/common/serviceCollection.js';
import { IExtHostInitDataService } from './extHostInitDataService.js';
import { InstantiationService } from '../../../platform/instantiation/common/instantiationService.js';
import { IExtHostRpcService, ExtHostRpcService } from './extHostRpcService.js';
import { IURITransformerService, URITransformerService } from './extHostUriTransformerService.js';
import { IExtHostExtensionService, IHostUtils } from './extHostExtensionService.js';
import { IExtHostTelemetry } from './extHostTelemetry.js';
import { IExtHostApiDeprecationService } from './extHostApiDeprecationService.js';
export class ErrorHandler {
    static async installEarlyHandler(accessor) {
        // increase number of stack frames (from 10, https://github.com/v8/v8/wiki/Stack-Trace-API)
        Error.stackTraceLimit = 100;
        // does NOT dependent of extension information, can be installed immediately, and simply forwards
        // to the log service and main thread errors
        const logService = accessor.get(ILogService);
        const rpcService = accessor.get(IExtHostRpcService);
        const mainThreadErrors = rpcService.getProxy(MainContext.MainThreadErrors);
        errors.setUnexpectedErrorHandler(err => {
            logService.error(err);
            const data = errors.transformErrorForSerialization(err);
            mainThreadErrors.$onUnexpectedError(data);
        });
    }
    static async installFullHandler(accessor) {
        // uses extension knowledges to correlate errors with extensions
        const logService = accessor.get(ILogService);
        const rpcService = accessor.get(IExtHostRpcService);
        const extensionService = accessor.get(IExtHostExtensionService);
        const extensionTelemetry = accessor.get(IExtHostTelemetry);
        const apiDeprecationService = accessor.get(IExtHostApiDeprecationService);
        const mainThreadExtensions = rpcService.getProxy(MainContext.MainThreadExtensionService);
        const mainThreadErrors = rpcService.getProxy(MainContext.MainThreadErrors);
        const extensionsRegistry = await extensionService.getExtensionRegistry();
        const extensionsMap = await extensionService.getExtensionPathIndex();
        const extensionErrors = new WeakMap();
        // PART 1
        // set the prepareStackTrace-handle and use it as a side-effect to associate errors
        // with extensions - this works by looking up callsites in the extension path index
        function prepareStackTraceAndFindExtension(error, stackTrace) {
            if (extensionErrors.has(error)) {
                return extensionErrors.get(error).stack;
            }
            let stackTraceMessage = '';
            let extension;
            let fileName;
            for (const call of stackTrace) {
                stackTraceMessage += `\n\tat ${call.toString()}`;
                fileName = call.getFileName();
                if (!extension && fileName) {
                    extension = extensionsMap.findSubstr(URI.file(fileName));
                }
            }
            const result = `${error.name || 'Error'}: ${error.message || ''}${stackTraceMessage}`;
            extensionErrors.set(error, { extensionIdentifier: extension?.identifier, stack: result });
            return result;
        }
        const _wasWrapped = Symbol('prepareStackTrace wrapped');
        let _prepareStackTrace = prepareStackTraceAndFindExtension;
        Object.defineProperty(Error, 'prepareStackTrace', {
            configurable: false,
            get() {
                return _prepareStackTrace;
            },
            set(v) {
                if (v === prepareStackTraceAndFindExtension || !v || v[_wasWrapped]) {
                    _prepareStackTrace = v || prepareStackTraceAndFindExtension;
                    return;
                }
                _prepareStackTrace = function (error, stackTrace) {
                    prepareStackTraceAndFindExtension(error, stackTrace);
                    return v.call(Error, error, stackTrace);
                };
                Object.assign(_prepareStackTrace, { [_wasWrapped]: true });
            },
        });
        // PART 2
        // set the unexpectedErrorHandler and check for extensions that have been identified as
        // having caused the error. Note that the runtime order is actually reversed, the code
        // below accesses the stack-property which triggers the code above
        errors.setUnexpectedErrorHandler(err => {
            if (!errors.PendingMigrationError.is(err)) {
                logService.error(err);
            }
            const errorData = errors.transformErrorForSerialization(err);
            let extension;
            if (err instanceof ExtensionError) {
                extension = err.extension;
            }
            else {
                const stackData = extensionErrors.get(err);
                extension = stackData?.extensionIdentifier;
            }
            if (!extension) {
                return;
            }
            if (errors.PendingMigrationError.is(err)) {
                // report pending migration via the API deprecation service which (1) informs the extensions author during
                // dev-time and (2) collects telemetry so that we can reach out too
                const extensionDesc = extensionsRegistry.getExtensionDescription(extension);
                if (extensionDesc) {
                    apiDeprecationService.report(err.name, extensionDesc, `${err.message}\n FROM: ${err.stack}`);
                }
            }
            else {
                mainThreadExtensions.$onExtensionRuntimeError(extension, errorData);
                const reported = extensionTelemetry.onExtensionError(extension, err);
                logService.trace('forwarded error to extension?', reported, extension);
            }
        });
        errors.errorHandler.addListener(err => {
            mainThreadErrors.$onUnexpectedError(err);
        });
    }
}
export class ExtensionHostMain {
    constructor(protocol, initData, hostUtils, uriTransformer, messagePorts) {
        this._hostUtils = hostUtils;
        this._rpcProtocol = new RPCProtocol(protocol, null, uriTransformer);
        // ensure URIs are transformed and revived
        initData = ExtensionHostMain._transform(initData, this._rpcProtocol);
        // bootstrap services
        const services = new ServiceCollection(...getSingletonServiceDescriptors());
        services.set(IExtHostInitDataService, { _serviceBrand: undefined, ...initData, messagePorts });
        services.set(IExtHostRpcService, new ExtHostRpcService(this._rpcProtocol));
        services.set(IURITransformerService, new URITransformerService(uriTransformer));
        services.set(IHostUtils, hostUtils);
        const instaService = new InstantiationService(services, true);
        instaService.invokeFunction(ErrorHandler.installEarlyHandler);
        // ugly self - inject
        this._logService = instaService.invokeFunction(accessor => accessor.get(ILogService));
        performance.mark(`code/extHost/didCreateServices`);
        if (this._hostUtils.pid) {
            this._logService.info(`Extension host with pid ${this._hostUtils.pid} started`);
        }
        else {
            this._logService.info(`Extension host started`);
        }
        this._logService.trace('initData', initData);
        // ugly self - inject
        // must call initialize *after* creating the extension service
        // because `initialize` itself creates instances that depend on it
        this._extensionService = instaService.invokeFunction(accessor => accessor.get(IExtHostExtensionService));
        this._extensionService.initialize();
        // install error handler that is extension-aware
        instaService.invokeFunction(ErrorHandler.installFullHandler);
    }
    async asBrowserUri(uri) {
        const mainThreadExtensionsProxy = this._rpcProtocol.getProxy(MainContext.MainThreadExtensionService);
        return URI.revive(await mainThreadExtensionsProxy.$asBrowserUri(uri));
    }
    terminate(reason) {
        this._extensionService.terminate(reason);
    }
    static _transform(initData, rpcProtocol) {
        initData.extensions.allExtensions.forEach((ext) => {
            ext.extensionLocation = URI.revive(rpcProtocol.transformIncomingURIs(ext.extensionLocation));
        });
        initData.environment.appRoot = URI.revive(rpcProtocol.transformIncomingURIs(initData.environment.appRoot));
        const extDevLocs = initData.environment.extensionDevelopmentLocationURI;
        if (extDevLocs) {
            initData.environment.extensionDevelopmentLocationURI = extDevLocs.map(url => URI.revive(rpcProtocol.transformIncomingURIs(url)));
        }
        initData.environment.extensionTestsLocationURI = URI.revive(rpcProtocol.transformIncomingURIs(initData.environment.extensionTestsLocationURI));
        initData.environment.globalStorageHome = URI.revive(rpcProtocol.transformIncomingURIs(initData.environment.globalStorageHome));
        initData.environment.workspaceStorageHome = URI.revive(rpcProtocol.transformIncomingURIs(initData.environment.workspaceStorageHome));
        initData.nlsBaseUrl = URI.revive(rpcProtocol.transformIncomingURIs(initData.nlsBaseUrl));
        initData.logsLocation = URI.revive(rpcProtocol.transformIncomingURIs(initData.logsLocation));
        initData.workspace = rpcProtocol.transformIncomingURIs(initData.workspace);
        return initData;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uSG9zdE1haW4uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9jb21tb24vZXh0ZW5zaW9uSG9zdE1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLE1BQU0sTUFBTSxnQ0FBZ0MsQ0FBQztBQUN6RCxPQUFPLEtBQUssV0FBVyxNQUFNLHFDQUFxQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUdsRCxPQUFPLEVBQUUsV0FBVyxFQUEwQixNQUFNLHVCQUF1QixDQUFDO0FBRTVFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUM5RSxPQUFPLEVBQUUsY0FBYyxFQUE4QyxNQUFNLG1EQUFtRCxDQUFDO0FBQy9ILE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsOEJBQThCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUNoRyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUN0RSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUV0RyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUMvRSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNsRyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsVUFBVSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDcEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFFMUQsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFVbEYsTUFBTSxPQUFnQixZQUFZO0lBRWpDLE1BQU0sQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUMsUUFBMEI7UUFFMUQsMkZBQTJGO1FBQzNGLEtBQUssQ0FBQyxlQUFlLEdBQUcsR0FBRyxDQUFDO1FBRTVCLGlHQUFpRztRQUNqRyw0Q0FBNEM7UUFDNUMsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM3QyxNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDcEQsTUFBTSxnQkFBZ0IsR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRTNFLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUN0QyxVQUFVLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3RCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyw4QkFBOEIsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN4RCxnQkFBZ0IsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMzQyxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxNQUFNLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLFFBQTBCO1FBQ3pELGdFQUFnRTtRQUVoRSxNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzdDLE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUNwRCxNQUFNLGdCQUFnQixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsd0JBQXdCLENBQUMsQ0FBQztRQUNoRSxNQUFNLGtCQUFrQixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUMzRCxNQUFNLHFCQUFxQixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsNkJBQTZCLENBQUMsQ0FBQztRQUUxRSxNQUFNLG9CQUFvQixHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLDBCQUEwQixDQUFDLENBQUM7UUFDekYsTUFBTSxnQkFBZ0IsR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRTNFLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxnQkFBZ0IsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1FBQ3pFLE1BQU0sYUFBYSxHQUFHLE1BQU0sZ0JBQWdCLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUNyRSxNQUFNLGVBQWUsR0FBRyxJQUFJLE9BQU8sRUFBa0YsQ0FBQztRQUV0SCxTQUFTO1FBQ1QsbUZBQW1GO1FBQ25GLG1GQUFtRjtRQUNuRixTQUFTLGlDQUFpQyxDQUFDLEtBQVksRUFBRSxVQUErQjtZQUN2RixJQUFJLGVBQWUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDaEMsT0FBTyxlQUFlLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBRSxDQUFDLEtBQUssQ0FBQztZQUMxQyxDQUFDO1lBQ0QsSUFBSSxpQkFBaUIsR0FBRyxFQUFFLENBQUM7WUFDM0IsSUFBSSxTQUE0QyxDQUFDO1lBQ2pELElBQUksUUFBdUIsQ0FBQztZQUM1QixLQUFLLE1BQU0sSUFBSSxJQUFJLFVBQVUsRUFBRSxDQUFDO2dCQUMvQixpQkFBaUIsSUFBSSxVQUFVLElBQUksQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDO2dCQUNqRCxRQUFRLEdBQUcsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUM5QixJQUFJLENBQUMsU0FBUyxJQUFJLFFBQVEsRUFBRSxDQUFDO29CQUM1QixTQUFTLEdBQUcsYUFBYSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQzFELENBQUM7WUFDRixDQUFDO1lBQ0QsTUFBTSxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxJQUFJLE9BQU8sS0FBSyxLQUFLLENBQUMsT0FBTyxJQUFJLEVBQUUsR0FBRyxpQkFBaUIsRUFBRSxDQUFDO1lBQ3RGLGVBQWUsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEVBQUUsbUJBQW1CLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztZQUMxRixPQUFPLE1BQU0sQ0FBQztRQUNmLENBQUM7UUFFRCxNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsMkJBQTJCLENBQUMsQ0FBQztRQUN4RCxJQUFJLGtCQUFrQixHQUFHLGlDQUFpQyxDQUFDO1FBRTNELE1BQU0sQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLG1CQUFtQixFQUFFO1lBQ2pELFlBQVksRUFBRSxLQUFLO1lBQ25CLEdBQUc7Z0JBQ0YsT0FBTyxrQkFBa0IsQ0FBQztZQUMzQixDQUFDO1lBQ0QsR0FBRyxDQUFDLENBQUM7Z0JBQ0osSUFBSSxDQUFDLEtBQUssaUNBQWlDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7b0JBQ3JFLGtCQUFrQixHQUFHLENBQUMsSUFBSSxpQ0FBaUMsQ0FBQztvQkFDNUQsT0FBTztnQkFDUixDQUFDO2dCQUVELGtCQUFrQixHQUFHLFVBQVUsS0FBSyxFQUFFLFVBQVU7b0JBQy9DLGlDQUFpQyxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQztvQkFDckQsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUM7Z0JBQ3pDLENBQUMsQ0FBQztnQkFFRixNQUFNLENBQUMsTUFBTSxDQUFDLGtCQUFrQixFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQzVELENBQUM7U0FDRCxDQUFDLENBQUM7UUFFSCxTQUFTO1FBQ1QsdUZBQXVGO1FBQ3ZGLHNGQUFzRjtRQUN0RixrRUFBa0U7UUFDbEUsTUFBTSxDQUFDLHlCQUF5QixDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBRXRDLElBQUksQ0FBQyxNQUFNLENBQUMscUJBQXFCLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQzNDLFVBQVUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDdkIsQ0FBQztZQUVELE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyw4QkFBOEIsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUU3RCxJQUFJLFNBQTBDLENBQUM7WUFDL0MsSUFBSSxHQUFHLFlBQVksY0FBYyxFQUFFLENBQUM7Z0JBQ25DLFNBQVMsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDO1lBQzNCLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxNQUFNLFNBQVMsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUMzQyxTQUFTLEdBQUcsU0FBUyxFQUFFLG1CQUFtQixDQUFDO1lBQzVDLENBQUM7WUFFRCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ2hCLE9BQU87WUFDUixDQUFDO1lBRUQsSUFBSSxNQUFNLENBQUMscUJBQXFCLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQzFDLDBHQUEwRztnQkFDMUcsbUVBQW1FO2dCQUNuRSxNQUFNLGFBQWEsR0FBRyxrQkFBa0IsQ0FBQyx1QkFBdUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDNUUsSUFBSSxhQUFhLEVBQUUsQ0FBQztvQkFDbkIscUJBQXFCLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFLEdBQUcsR0FBRyxDQUFDLE9BQU8sWUFBWSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztnQkFDOUYsQ0FBQztZQUNGLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxvQkFBb0IsQ0FBQyx3QkFBd0IsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7Z0JBQ3BFLE1BQU0sUUFBUSxHQUFHLGtCQUFrQixDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDckUsVUFBVSxDQUFDLEtBQUssQ0FBQywrQkFBK0IsRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDeEUsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDckMsZ0JBQWdCLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDMUMsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0NBQ0Q7QUFFRCxNQUFNLE9BQU8saUJBQWlCO0lBTzdCLFlBQ0MsUUFBaUMsRUFDakMsUUFBZ0MsRUFDaEMsU0FBcUIsRUFDckIsY0FBc0MsRUFDdEMsWUFBK0M7UUFFL0MsSUFBSSxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUM7UUFDNUIsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLFdBQVcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBRXBFLDBDQUEwQztRQUMxQyxRQUFRLEdBQUcsaUJBQWlCLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFckUscUJBQXFCO1FBQ3JCLE1BQU0sUUFBUSxHQUFHLElBQUksaUJBQWlCLENBQUMsR0FBRyw4QkFBOEIsRUFBRSxDQUFDLENBQUM7UUFDNUUsUUFBUSxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsRUFBRSxFQUFFLGFBQWEsRUFBRSxTQUFTLEVBQUUsR0FBRyxRQUFRLEVBQUUsWUFBWSxFQUFFLENBQUMsQ0FBQztRQUMvRixRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFLElBQUksaUJBQWlCLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7UUFDM0UsUUFBUSxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsRUFBRSxJQUFJLHFCQUFxQixDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7UUFDaEYsUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFcEMsTUFBTSxZQUFZLEdBQTBCLElBQUksb0JBQW9CLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRXJGLFlBQVksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFFOUQscUJBQXFCO1FBQ3JCLElBQUksQ0FBQyxXQUFXLEdBQUcsWUFBWSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUV0RixXQUFXLENBQUMsSUFBSSxDQUFDLGdDQUFnQyxDQUFDLENBQUM7UUFDbkQsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ3pCLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLDJCQUEyQixJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUM7UUFDakYsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBQ2pELENBQUM7UUFDRCxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFFN0MscUJBQXFCO1FBQ3JCLDhEQUE4RDtRQUM5RCxrRUFBa0U7UUFDbEUsSUFBSSxDQUFDLGlCQUFpQixHQUFHLFlBQVksQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQztRQUN6RyxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxFQUFFLENBQUM7UUFFcEMsZ0RBQWdEO1FBQ2hELFlBQVksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFDOUQsQ0FBQztJQUVELEtBQUssQ0FBQyxZQUFZLENBQUMsR0FBUTtRQUMxQixNQUFNLHlCQUF5QixHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO1FBQ3JHLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLHlCQUF5QixDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFFRCxTQUFTLENBQUMsTUFBYztRQUN2QixJQUFJLENBQUMsaUJBQWlCLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFTyxNQUFNLENBQUMsVUFBVSxDQUFDLFFBQWdDLEVBQUUsV0FBd0I7UUFDbkYsUUFBUSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDaEIsR0FBSSxDQUFDLGlCQUFpQixHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7UUFDaEksQ0FBQyxDQUFDLENBQUM7UUFDSCxRQUFRLENBQUMsV0FBVyxDQUFDLE9BQU8sR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDM0csTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQywrQkFBK0IsQ0FBQztRQUN4RSxJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ2hCLFFBQVEsQ0FBQyxXQUFXLENBQUMsK0JBQStCLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsSSxDQUFDO1FBQ0QsUUFBUSxDQUFDLFdBQVcsQ0FBQyx5QkFBeUIsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLHlCQUF5QixDQUFDLENBQUMsQ0FBQztRQUMvSSxRQUFRLENBQUMsV0FBVyxDQUFDLGlCQUFpQixHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1FBQy9ILFFBQVEsQ0FBQyxXQUFXLENBQUMsb0JBQW9CLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMscUJBQXFCLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7UUFDckksUUFBUSxDQUFDLFVBQVUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUN6RixRQUFRLENBQUMsWUFBWSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO1FBQzdGLFFBQVEsQ0FBQyxTQUFTLEdBQUcsV0FBVyxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMzRSxPQUFPLFFBQVEsQ0FBQztJQUNqQixDQUFDO0NBQ0QifQ==