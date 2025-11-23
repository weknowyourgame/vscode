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
import { toAction } from '../../../base/common/actions.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { transformErrorFromSerialization } from '../../../base/common/errors.js';
import { FileAccess } from '../../../base/common/network.js';
import Severity from '../../../base/common/severity.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { ICommandService } from '../../../platform/commands/common/commands.js';
import { areSameExtensions } from '../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { INotificationService } from '../../../platform/notification/common/notification.js';
import { ManagedRemoteConnection, WebSocketRemoteConnection } from '../../../platform/remote/common/remoteAuthorityResolver.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { IExtensionsWorkbenchService } from '../../contrib/extensions/common/extensions.js';
import { IWorkbenchEnvironmentService } from '../../services/environment/common/environmentService.js';
import { IWorkbenchExtensionEnablementService } from '../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionService } from '../../services/extensions/common/extensions.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { IHostService } from '../../services/host/browser/host.js';
import { ITimerService } from '../../services/timer/browser/timerService.js';
let MainThreadExtensionService = class MainThreadExtensionService {
    constructor(extHostContext, _extensionService, _notificationService, _extensionsWorkbenchService, _hostService, _extensionEnablementService, _timerService, _commandService, _environmentService) {
        this._extensionService = _extensionService;
        this._notificationService = _notificationService;
        this._extensionsWorkbenchService = _extensionsWorkbenchService;
        this._hostService = _hostService;
        this._extensionEnablementService = _extensionEnablementService;
        this._timerService = _timerService;
        this._commandService = _commandService;
        this._environmentService = _environmentService;
        this._extensionHostKind = extHostContext.extensionHostKind;
        const internalExtHostContext = extHostContext;
        this._internalExtensionService = internalExtHostContext.internalExtensionService;
        internalExtHostContext._setExtensionHostProxy(new ExtensionHostProxy(extHostContext.getProxy(ExtHostContext.ExtHostExtensionService)));
        // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
        internalExtHostContext._setAllMainProxyIdentifiers(Object.keys(MainContext).map((key) => MainContext[key]));
    }
    dispose() {
    }
    $getExtension(extensionId) {
        return this._extensionService.getExtension(extensionId);
    }
    $activateExtension(extensionId, reason) {
        return this._internalExtensionService._activateById(extensionId, reason);
    }
    async $onWillActivateExtension(extensionId) {
        this._internalExtensionService._onWillActivateExtension(extensionId);
    }
    $onDidActivateExtension(extensionId, codeLoadingTime, activateCallTime, activateResolvedTime, activationReason) {
        this._internalExtensionService._onDidActivateExtension(extensionId, codeLoadingTime, activateCallTime, activateResolvedTime, activationReason);
    }
    $onExtensionRuntimeError(extensionId, data) {
        const error = transformErrorFromSerialization(data);
        this._internalExtensionService._onExtensionRuntimeError(extensionId, error);
        console.error(`[${extensionId.value}]${error.message}`);
        console.error(error.stack);
    }
    async $onExtensionActivationError(extensionId, data, missingExtensionDependency) {
        const error = transformErrorFromSerialization(data);
        this._internalExtensionService._onDidActivateExtensionError(extensionId, error);
        if (missingExtensionDependency) {
            const extension = await this._extensionService.getExtension(extensionId.value);
            if (extension) {
                const local = await this._extensionsWorkbenchService.queryLocal();
                const installedDependency = local.find(i => areSameExtensions(i.identifier, { id: missingExtensionDependency.dependency }));
                if (installedDependency?.local) {
                    await this._handleMissingInstalledDependency(extension, installedDependency.local);
                    return;
                }
                else {
                    await this._handleMissingNotInstalledDependency(extension, missingExtensionDependency.dependency);
                    return;
                }
            }
        }
        const isDev = !this._environmentService.isBuilt || this._environmentService.isExtensionDevelopment;
        if (isDev) {
            this._notificationService.error(error);
            return;
        }
        console.error(error.message);
    }
    async _handleMissingInstalledDependency(extension, missingInstalledDependency) {
        const extName = extension.displayName || extension.name;
        if (this._extensionEnablementService.isEnabled(missingInstalledDependency)) {
            this._notificationService.notify({
                severity: Severity.Error,
                message: localize('reload window', "Cannot activate the '{0}' extension because it depends on the '{1}' extension, which is not loaded. Would you like to reload the window to load the extension?", extName, missingInstalledDependency.manifest.displayName || missingInstalledDependency.manifest.name),
                actions: {
                    primary: [toAction({ id: 'reload', label: localize('reload', "Reload Window"), run: () => this._hostService.reload() })]
                }
            });
        }
        else {
            const enablementState = this._extensionEnablementService.getEnablementState(missingInstalledDependency);
            if (enablementState === 5 /* EnablementState.DisabledByVirtualWorkspace */) {
                this._notificationService.notify({
                    severity: Severity.Error,
                    message: localize('notSupportedInWorkspace', "Cannot activate the '{0}' extension because it depends on the '{1}' extension which is not supported in the current workspace", extName, missingInstalledDependency.manifest.displayName || missingInstalledDependency.manifest.name),
                });
            }
            else if (enablementState === 0 /* EnablementState.DisabledByTrustRequirement */) {
                this._notificationService.notify({
                    severity: Severity.Error,
                    message: localize('restrictedMode', "Cannot activate the '{0}' extension because it depends on the '{1}' extension which is not supported in Restricted Mode", extName, missingInstalledDependency.manifest.displayName || missingInstalledDependency.manifest.name),
                    actions: {
                        primary: [toAction({ id: 'manageWorkspaceTrust', label: localize('manageWorkspaceTrust', "Manage Workspace Trust"), run: () => this._commandService.executeCommand('workbench.trust.manage') })]
                    }
                });
            }
            else if (this._extensionEnablementService.canChangeEnablement(missingInstalledDependency)) {
                this._notificationService.notify({
                    severity: Severity.Error,
                    message: localize('disabledDep', "Cannot activate the '{0}' extension because it depends on the '{1}' extension which is disabled. Would you like to enable the extension and reload the window?", extName, missingInstalledDependency.manifest.displayName || missingInstalledDependency.manifest.name),
                    actions: {
                        primary: [toAction({
                                id: 'enable', label: localize('enable dep', "Enable and Reload"), enabled: true,
                                run: () => this._extensionEnablementService.setEnablement([missingInstalledDependency], enablementState === 10 /* EnablementState.DisabledGlobally */ ? 12 /* EnablementState.EnabledGlobally */ : 13 /* EnablementState.EnabledWorkspace */)
                                    .then(() => this._hostService.reload(), e => this._notificationService.error(e))
                            })]
                    }
                });
            }
            else {
                this._notificationService.notify({
                    severity: Severity.Error,
                    message: localize('disabledDepNoAction', "Cannot activate the '{0}' extension because it depends on the '{1}' extension which is disabled.", extName, missingInstalledDependency.manifest.displayName || missingInstalledDependency.manifest.name),
                });
            }
        }
    }
    async _handleMissingNotInstalledDependency(extension, missingDependency) {
        const extName = extension.displayName || extension.name;
        let dependencyExtension = null;
        try {
            dependencyExtension = (await this._extensionsWorkbenchService.getExtensions([{ id: missingDependency }], CancellationToken.None))[0];
        }
        catch (err) {
        }
        if (dependencyExtension) {
            this._notificationService.notify({
                severity: Severity.Error,
                message: localize('uninstalledDep', "Cannot activate the '{0}' extension because it depends on the '{1}' extension from '{2}', which is not installed. Would you like to install the extension and reload the window?", extName, dependencyExtension.displayName, dependencyExtension.publisherDisplayName),
                actions: {
                    primary: [toAction({
                            id: 'install',
                            label: localize('install missing dep', "Install and Reload"),
                            run: () => this._extensionsWorkbenchService.install(dependencyExtension)
                                .then(() => this._hostService.reload(), e => this._notificationService.error(e))
                        })]
                }
            });
        }
        else {
            this._notificationService.error(localize('unknownDep', "Cannot activate the '{0}' extension because it depends on an unknown '{1}' extension.", extName, missingDependency));
        }
    }
    async $setPerformanceMarks(marks) {
        if (this._extensionHostKind === 1 /* ExtensionHostKind.LocalProcess */) {
            this._timerService.setPerformanceMarks('localExtHost', marks);
        }
        else if (this._extensionHostKind === 2 /* ExtensionHostKind.LocalWebWorker */) {
            this._timerService.setPerformanceMarks('workerExtHost', marks);
        }
        else {
            this._timerService.setPerformanceMarks('remoteExtHost', marks);
        }
    }
    async $asBrowserUri(uri) {
        return FileAccess.uriToBrowserUri(URI.revive(uri));
    }
};
MainThreadExtensionService = __decorate([
    extHostNamedCustomer(MainContext.MainThreadExtensionService),
    __param(1, IExtensionService),
    __param(2, INotificationService),
    __param(3, IExtensionsWorkbenchService),
    __param(4, IHostService),
    __param(5, IWorkbenchExtensionEnablementService),
    __param(6, ITimerService),
    __param(7, ICommandService),
    __param(8, IWorkbenchEnvironmentService)
], MainThreadExtensionService);
export { MainThreadExtensionService };
class ExtensionHostProxy {
    constructor(_actual) {
        this._actual = _actual;
    }
    async resolveAuthority(remoteAuthority, resolveAttempt) {
        const resolved = reviveResolveAuthorityResult(await this._actual.$resolveAuthority(remoteAuthority, resolveAttempt));
        return resolved;
    }
    async getCanonicalURI(remoteAuthority, uri) {
        const uriComponents = await this._actual.$getCanonicalURI(remoteAuthority, uri);
        return (uriComponents ? URI.revive(uriComponents) : uriComponents);
    }
    startExtensionHost(extensionsDelta) {
        return this._actual.$startExtensionHost(extensionsDelta);
    }
    extensionTestsExecute() {
        return this._actual.$extensionTestsExecute();
    }
    activateByEvent(activationEvent, activationKind) {
        return this._actual.$activateByEvent(activationEvent, activationKind);
    }
    activate(extensionId, reason) {
        return this._actual.$activate(extensionId, reason);
    }
    setRemoteEnvironment(env) {
        return this._actual.$setRemoteEnvironment(env);
    }
    updateRemoteConnectionData(connectionData) {
        return this._actual.$updateRemoteConnectionData(connectionData);
    }
    deltaExtensions(extensionsDelta) {
        return this._actual.$deltaExtensions(extensionsDelta);
    }
    test_latency(n) {
        return this._actual.$test_latency(n);
    }
    test_up(b) {
        return this._actual.$test_up(b);
    }
    test_down(size) {
        return this._actual.$test_down(size);
    }
}
function reviveResolveAuthorityResult(result) {
    if (result.type === 'ok') {
        return {
            type: 'ok',
            value: {
                ...result.value,
                authority: reviveResolvedAuthority(result.value.authority),
            }
        };
    }
    else {
        return result;
    }
}
function reviveResolvedAuthority(resolvedAuthority) {
    return {
        ...resolvedAuthority,
        connectTo: reviveConnection(resolvedAuthority.connectTo),
    };
}
function reviveConnection(connection) {
    if (connection.type === 0 /* RemoteConnectionType.WebSocket */) {
        return new WebSocketRemoteConnection(connection.host, connection.port);
    }
    return new ManagedRemoteConnection(connection.id);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZEV4dGVuc2lvblNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9icm93c2VyL21haW5UaHJlYWRFeHRlbnNpb25TZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUUzRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN6RSxPQUFPLEVBQW1CLCtCQUErQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDbEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzdELE9BQU8sUUFBUSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxHQUFHLEVBQWlCLE1BQU0sNkJBQTZCLENBQUM7QUFDakUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzNDLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUVoRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5RUFBeUUsQ0FBQztBQUU1RyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUM3RixPQUFPLEVBQXlCLHVCQUF1QixFQUE2RCx5QkFBeUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2xOLE9BQU8sRUFBRSxjQUFjLEVBQWdDLFdBQVcsRUFBbUMsTUFBTSwrQkFBK0IsQ0FBQztBQUMzSSxPQUFPLEVBQWMsMkJBQTJCLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUN4RyxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN2RyxPQUFPLEVBQW1CLG9DQUFvQyxFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFJekksT0FBTyxFQUE2QyxpQkFBaUIsRUFBeUQsTUFBTSxnREFBZ0QsQ0FBQztBQUNyTCxPQUFPLEVBQUUsb0JBQW9CLEVBQTRDLE1BQU0sc0RBQXNELENBQUM7QUFFdEksT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUd0RSxJQUFNLDBCQUEwQixHQUFoQyxNQUFNLDBCQUEwQjtJQUt0QyxZQUNDLGNBQStCLEVBQ0ssaUJBQW9DLEVBQ2pDLG9CQUEwQyxFQUNuQywyQkFBd0QsRUFDdkUsWUFBMEIsRUFDRiwyQkFBaUUsRUFDeEYsYUFBNEIsRUFDMUIsZUFBZ0MsRUFDakIsbUJBQWlEO1FBUDlELHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBbUI7UUFDakMseUJBQW9CLEdBQXBCLG9CQUFvQixDQUFzQjtRQUNuQyxnQ0FBMkIsR0FBM0IsMkJBQTJCLENBQTZCO1FBQ3ZFLGlCQUFZLEdBQVosWUFBWSxDQUFjO1FBQ0YsZ0NBQTJCLEdBQTNCLDJCQUEyQixDQUFzQztRQUN4RixrQkFBYSxHQUFiLGFBQWEsQ0FBZTtRQUMxQixvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUFDakIsd0JBQW1CLEdBQW5CLG1CQUFtQixDQUE4QjtRQUVsRyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsY0FBYyxDQUFDLGlCQUFpQixDQUFDO1FBRTNELE1BQU0sc0JBQXNCLEdBQTZCLGNBQWUsQ0FBQztRQUN6RSxJQUFJLENBQUMseUJBQXlCLEdBQUcsc0JBQXNCLENBQUMsd0JBQXdCLENBQUM7UUFDakYsc0JBQXNCLENBQUMsc0JBQXNCLENBQzVDLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUN2RixDQUFDO1FBQ0YsdUZBQXVGO1FBQ3ZGLHNCQUFzQixDQUFDLDJCQUEyQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBTyxXQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3BILENBQUM7SUFFTSxPQUFPO0lBQ2QsQ0FBQztJQUVELGFBQWEsQ0FBQyxXQUFtQjtRQUNoQyxPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDekQsQ0FBQztJQUNELGtCQUFrQixDQUFDLFdBQWdDLEVBQUUsTUFBaUM7UUFDckYsT0FBTyxJQUFJLENBQUMseUJBQXlCLENBQUMsYUFBYSxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUMxRSxDQUFDO0lBQ0QsS0FBSyxDQUFDLHdCQUF3QixDQUFDLFdBQWdDO1FBQzlELElBQUksQ0FBQyx5QkFBeUIsQ0FBQyx3QkFBd0IsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBQ0QsdUJBQXVCLENBQUMsV0FBZ0MsRUFBRSxlQUF1QixFQUFFLGdCQUF3QixFQUFFLG9CQUE0QixFQUFFLGdCQUEyQztRQUNyTCxJQUFJLENBQUMseUJBQXlCLENBQUMsdUJBQXVCLENBQUMsV0FBVyxFQUFFLGVBQWUsRUFBRSxnQkFBZ0IsRUFBRSxvQkFBb0IsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ2hKLENBQUM7SUFDRCx3QkFBd0IsQ0FBQyxXQUFnQyxFQUFFLElBQXFCO1FBQy9FLE1BQU0sS0FBSyxHQUFHLCtCQUErQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BELElBQUksQ0FBQyx5QkFBeUIsQ0FBQyx3QkFBd0IsQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDNUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLFdBQVcsQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDeEQsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQUNELEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxXQUFnQyxFQUFFLElBQXFCLEVBQUUsMEJBQTZEO1FBQ3ZKLE1BQU0sS0FBSyxHQUFHLCtCQUErQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXBELElBQUksQ0FBQyx5QkFBeUIsQ0FBQyw0QkFBNEIsQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFaEYsSUFBSSwwQkFBMEIsRUFBRSxDQUFDO1lBQ2hDLE1BQU0sU0FBUyxHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDL0UsSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDZixNQUFNLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDbEUsTUFBTSxtQkFBbUIsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxFQUFFLEVBQUUsRUFBRSwwQkFBMEIsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQzVILElBQUksbUJBQW1CLEVBQUUsS0FBSyxFQUFFLENBQUM7b0JBQ2hDLE1BQU0sSUFBSSxDQUFDLGlDQUFpQyxDQUFDLFNBQVMsRUFBRSxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDbkYsT0FBTztnQkFDUixDQUFDO3FCQUFNLENBQUM7b0JBQ1AsTUFBTSxJQUFJLENBQUMsb0NBQW9DLENBQUMsU0FBUyxFQUFFLDBCQUEwQixDQUFDLFVBQVUsQ0FBQyxDQUFDO29CQUNsRyxPQUFPO2dCQUNSLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUVELE1BQU0sS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsc0JBQXNCLENBQUM7UUFDbkcsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNYLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDdkMsT0FBTztRQUNSLENBQUM7UUFFRCxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBRU8sS0FBSyxDQUFDLGlDQUFpQyxDQUFDLFNBQWdDLEVBQUUsMEJBQTJDO1FBQzVILE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxXQUFXLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQztRQUN4RCxJQUFJLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxTQUFTLENBQUMsMEJBQTBCLENBQUMsRUFBRSxDQUFDO1lBQzVFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUM7Z0JBQ2hDLFFBQVEsRUFBRSxRQUFRLENBQUMsS0FBSztnQkFDeEIsT0FBTyxFQUFFLFFBQVEsQ0FBQyxlQUFlLEVBQUUsZ0tBQWdLLEVBQUUsT0FBTyxFQUFFLDBCQUEwQixDQUFDLFFBQVEsQ0FBQyxXQUFXLElBQUksMEJBQTBCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztnQkFDMVMsT0FBTyxFQUFFO29CQUNSLE9BQU8sRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxRQUFRLEVBQUUsZUFBZSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDO2lCQUN4SDthQUNELENBQUMsQ0FBQztRQUNKLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLDJCQUEyQixDQUFDLGtCQUFrQixDQUFDLDBCQUEwQixDQUFDLENBQUM7WUFDeEcsSUFBSSxlQUFlLHVEQUErQyxFQUFFLENBQUM7Z0JBQ3BFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUM7b0JBQ2hDLFFBQVEsRUFBRSxRQUFRLENBQUMsS0FBSztvQkFDeEIsT0FBTyxFQUFFLFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSwrSEFBK0gsRUFBRSxPQUFPLEVBQUUsMEJBQTBCLENBQUMsUUFBUSxDQUFDLFdBQVcsSUFBSSwwQkFBMEIsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDO2lCQUNuUixDQUFDLENBQUM7WUFDSixDQUFDO2lCQUFNLElBQUksZUFBZSx1REFBK0MsRUFBRSxDQUFDO2dCQUMzRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDO29CQUNoQyxRQUFRLEVBQUUsUUFBUSxDQUFDLEtBQUs7b0JBQ3hCLE9BQU8sRUFBRSxRQUFRLENBQUMsZ0JBQWdCLEVBQUUseUhBQXlILEVBQUUsT0FBTyxFQUFFLDBCQUEwQixDQUFDLFFBQVEsQ0FBQyxXQUFXLElBQUksMEJBQTBCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztvQkFDcFEsT0FBTyxFQUFFO3dCQUNSLE9BQU8sRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxzQkFBc0IsRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLHNCQUFzQixFQUFFLHdCQUF3QixDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDLHdCQUF3QixDQUFDLEVBQUUsQ0FBQyxDQUFDO3FCQUNoTTtpQkFDRCxDQUFDLENBQUM7WUFDSixDQUFDO2lCQUFNLElBQUksSUFBSSxDQUFDLDJCQUEyQixDQUFDLG1CQUFtQixDQUFDLDBCQUEwQixDQUFDLEVBQUUsQ0FBQztnQkFDN0YsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQztvQkFDaEMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxLQUFLO29CQUN4QixPQUFPLEVBQUUsUUFBUSxDQUFDLGFBQWEsRUFBRSxnS0FBZ0ssRUFBRSxPQUFPLEVBQUUsMEJBQTBCLENBQUMsUUFBUSxDQUFDLFdBQVcsSUFBSSwwQkFBMEIsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDO29CQUN4UyxPQUFPLEVBQUU7d0JBQ1IsT0FBTyxFQUFFLENBQUMsUUFBUSxDQUFDO2dDQUNsQixFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsWUFBWSxFQUFFLG1CQUFtQixDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUk7Z0NBQy9FLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsYUFBYSxDQUFDLENBQUMsMEJBQTBCLENBQUMsRUFBRSxlQUFlLDhDQUFxQyxDQUFDLENBQUMsMENBQWlDLENBQUMsMENBQWlDLENBQUM7cUNBQ2hOLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzs2QkFDakYsQ0FBQyxDQUFDO3FCQUNIO2lCQUNELENBQUMsQ0FBQztZQUNKLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDO29CQUNoQyxRQUFRLEVBQUUsUUFBUSxDQUFDLEtBQUs7b0JBQ3hCLE9BQU8sRUFBRSxRQUFRLENBQUMscUJBQXFCLEVBQUUsa0dBQWtHLEVBQUUsT0FBTyxFQUFFLDBCQUEwQixDQUFDLFFBQVEsQ0FBQyxXQUFXLElBQUksMEJBQTBCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztpQkFDbFAsQ0FBQyxDQUFDO1lBQ0osQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRU8sS0FBSyxDQUFDLG9DQUFvQyxDQUFDLFNBQWdDLEVBQUUsaUJBQXlCO1FBQzdHLE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxXQUFXLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQztRQUN4RCxJQUFJLG1CQUFtQixHQUFzQixJQUFJLENBQUM7UUFDbEQsSUFBSSxDQUFDO1lBQ0osbUJBQW1CLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxhQUFhLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxDQUFDLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0SSxDQUFDO1FBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUNmLENBQUM7UUFDRCxJQUFJLG1CQUFtQixFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQztnQkFDaEMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxLQUFLO2dCQUN4QixPQUFPLEVBQUUsUUFBUSxDQUFDLGdCQUFnQixFQUFFLGtMQUFrTCxFQUFFLE9BQU8sRUFBRSxtQkFBbUIsQ0FBQyxXQUFXLEVBQUUsbUJBQW1CLENBQUMsb0JBQW9CLENBQUM7Z0JBQzNTLE9BQU8sRUFBRTtvQkFDUixPQUFPLEVBQUUsQ0FBQyxRQUFRLENBQUM7NEJBQ2xCLEVBQUUsRUFBRSxTQUFTOzRCQUNiLEtBQUssRUFBRSxRQUFRLENBQUMscUJBQXFCLEVBQUUsb0JBQW9CLENBQUM7NEJBQzVELEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDO2lDQUN0RSxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7eUJBQ2pGLENBQUMsQ0FBQztpQkFDSDthQUNELENBQUMsQ0FBQztRQUNKLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFLHVGQUF1RixFQUFFLE9BQU8sRUFBRSxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7UUFDOUssQ0FBQztJQUNGLENBQUM7SUFFRCxLQUFLLENBQUMsb0JBQW9CLENBQUMsS0FBd0I7UUFDbEQsSUFBSSxJQUFJLENBQUMsa0JBQWtCLDJDQUFtQyxFQUFFLENBQUM7WUFDaEUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDL0QsQ0FBQzthQUFNLElBQUksSUFBSSxDQUFDLGtCQUFrQiw2Q0FBcUMsRUFBRSxDQUFDO1lBQ3pFLElBQUksQ0FBQyxhQUFhLENBQUMsbUJBQW1CLENBQUMsZUFBZSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2hFLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQyxlQUFlLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDaEUsQ0FBQztJQUNGLENBQUM7SUFFRCxLQUFLLENBQUMsYUFBYSxDQUFDLEdBQWtCO1FBQ3JDLE9BQU8sVUFBVSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDcEQsQ0FBQztDQUNELENBQUE7QUFqS1ksMEJBQTBCO0lBRHRDLG9CQUFvQixDQUFDLFdBQVcsQ0FBQywwQkFBMEIsQ0FBQztJQVExRCxXQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFdBQUEsb0JBQW9CLENBQUE7SUFDcEIsV0FBQSwyQkFBMkIsQ0FBQTtJQUMzQixXQUFBLFlBQVksQ0FBQTtJQUNaLFdBQUEsb0NBQW9DLENBQUE7SUFDcEMsV0FBQSxhQUFhLENBQUE7SUFDYixXQUFBLGVBQWUsQ0FBQTtJQUNmLFdBQUEsNEJBQTRCLENBQUE7R0FkbEIsMEJBQTBCLENBaUt0Qzs7QUFFRCxNQUFNLGtCQUFrQjtJQUN2QixZQUNrQixPQUFxQztRQUFyQyxZQUFPLEdBQVAsT0FBTyxDQUE4QjtJQUNuRCxDQUFDO0lBRUwsS0FBSyxDQUFDLGdCQUFnQixDQUFDLGVBQXVCLEVBQUUsY0FBc0I7UUFDckUsTUFBTSxRQUFRLEdBQUcsNEJBQTRCLENBQUMsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLGVBQWUsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO1FBQ3JILE9BQU8sUUFBUSxDQUFDO0lBQ2pCLENBQUM7SUFDRCxLQUFLLENBQUMsZUFBZSxDQUFDLGVBQXVCLEVBQUUsR0FBUTtRQUN0RCxNQUFNLGFBQWEsR0FBRyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsZUFBZSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ2hGLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFDRCxrQkFBa0IsQ0FBQyxlQUEyQztRQUM3RCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDMUQsQ0FBQztJQUNELHFCQUFxQjtRQUNwQixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztJQUM5QyxDQUFDO0lBQ0QsZUFBZSxDQUFDLGVBQXVCLEVBQUUsY0FBOEI7UUFDdEUsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLGVBQWUsRUFBRSxjQUFjLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBQ0QsUUFBUSxDQUFDLFdBQWdDLEVBQUUsTUFBaUM7UUFDM0UsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUNELG9CQUFvQixDQUFDLEdBQXFDO1FBQ3pELE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBQ0QsMEJBQTBCLENBQUMsY0FBcUM7UUFDL0QsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLDJCQUEyQixDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFDRCxlQUFlLENBQUMsZUFBMkM7UUFDMUQsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ3ZELENBQUM7SUFDRCxZQUFZLENBQUMsQ0FBUztRQUNyQixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFDRCxPQUFPLENBQUMsQ0FBVztRQUNsQixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLENBQUM7SUFDRCxTQUFTLENBQUMsSUFBWTtRQUNyQixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3RDLENBQUM7Q0FDRDtBQUVELFNBQVMsNEJBQTRCLENBQUMsTUFBb0M7SUFDekUsSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLElBQUksRUFBRSxDQUFDO1FBQzFCLE9BQU87WUFDTixJQUFJLEVBQUUsSUFBSTtZQUNWLEtBQUssRUFBRTtnQkFDTixHQUFHLE1BQU0sQ0FBQyxLQUFLO2dCQUNmLFNBQVMsRUFBRSx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQzthQUMxRDtTQUNELENBQUM7SUFDSCxDQUFDO1NBQU0sQ0FBQztRQUNQLE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztBQUNGLENBQUM7QUFFRCxTQUFTLHVCQUF1QixDQUFDLGlCQUF5QztJQUN6RSxPQUFPO1FBQ04sR0FBRyxpQkFBaUI7UUFDcEIsU0FBUyxFQUFFLGdCQUFnQixDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQztLQUN4RCxDQUFDO0FBQ0gsQ0FBQztBQUVELFNBQVMsZ0JBQWdCLENBQUMsVUFBaUM7SUFDMUQsSUFBSSxVQUFVLENBQUMsSUFBSSwyQ0FBbUMsRUFBRSxDQUFDO1FBQ3hELE9BQU8sSUFBSSx5QkFBeUIsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN4RSxDQUFDO0lBQ0QsT0FBTyxJQUFJLHVCQUF1QixDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNuRCxDQUFDIn0=