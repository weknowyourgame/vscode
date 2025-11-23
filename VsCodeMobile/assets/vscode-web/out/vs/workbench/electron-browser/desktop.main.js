/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../nls.js';
import product from '../../platform/product/common/product.js';
import { Workbench } from '../browser/workbench.js';
import { NativeWindow } from './window.js';
import { setFullscreen } from '../../base/browser/browser.js';
import { domContentLoaded } from '../../base/browser/dom.js';
import { onUnexpectedError } from '../../base/common/errors.js';
import { URI } from '../../base/common/uri.js';
import { WorkspaceService } from '../services/configuration/browser/configurationService.js';
import { INativeWorkbenchEnvironmentService, NativeWorkbenchEnvironmentService } from '../services/environment/electron-browser/environmentService.js';
import { ServiceCollection } from '../../platform/instantiation/common/serviceCollection.js';
import { ILoggerService, ILogService, LogLevel } from '../../platform/log/common/log.js';
import { NativeWorkbenchStorageService } from '../services/storage/electron-browser/storageService.js';
import { IWorkspaceContextService, isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier, reviveIdentifier, toWorkspaceIdentifier } from '../../platform/workspace/common/workspace.js';
import { IWorkbenchConfigurationService } from '../services/configuration/common/configuration.js';
import { IStorageService } from '../../platform/storage/common/storage.js';
import { Disposable } from '../../base/common/lifecycle.js';
import { ISharedProcessService } from '../../platform/ipc/electron-browser/services.js';
import { IMainProcessService } from '../../platform/ipc/common/mainProcessService.js';
import { SharedProcessService } from '../services/sharedProcess/electron-browser/sharedProcessService.js';
import { RemoteAuthorityResolverService } from '../../platform/remote/electron-browser/remoteAuthorityResolverService.js';
import { IRemoteAuthorityResolverService } from '../../platform/remote/common/remoteAuthorityResolver.js';
import { RemoteAgentService } from '../services/remote/electron-browser/remoteAgentService.js';
import { IRemoteAgentService } from '../services/remote/common/remoteAgentService.js';
import { FileService } from '../../platform/files/common/fileService.js';
import { IFileService } from '../../platform/files/common/files.js';
import { RemoteFileSystemProviderClient } from '../services/remote/common/remoteFileSystemProviderClient.js';
import { ConfigurationCache } from '../services/configuration/common/configurationCache.js';
import { ISignService } from '../../platform/sign/common/sign.js';
import { IProductService } from '../../platform/product/common/productService.js';
import { IUriIdentityService } from '../../platform/uriIdentity/common/uriIdentity.js';
import { UriIdentityService } from '../../platform/uriIdentity/common/uriIdentityService.js';
import { INativeKeyboardLayoutService, NativeKeyboardLayoutService } from '../services/keybinding/electron-browser/nativeKeyboardLayoutService.js';
import { ElectronIPCMainProcessService } from '../../platform/ipc/electron-browser/mainProcessService.js';
import { LoggerChannelClient } from '../../platform/log/common/logIpc.js';
import { ProxyChannel } from '../../base/parts/ipc/common/ipc.js';
import { NativeLogService } from '../services/log/electron-browser/logService.js';
import { WorkspaceTrustEnablementService, WorkspaceTrustManagementService } from '../services/workspaces/common/workspaceTrust.js';
import { IWorkspaceTrustEnablementService, IWorkspaceTrustManagementService } from '../../platform/workspace/common/workspaceTrust.js';
import { safeStringify } from '../../base/common/objects.js';
import { IUtilityProcessWorkerWorkbenchService, UtilityProcessWorkerWorkbenchService } from '../services/utilityProcess/electron-browser/utilityProcessWorkerWorkbenchService.js';
import { isCI, isMacintosh, isTahoeOrNewer } from '../../base/common/platform.js';
import { Schemas } from '../../base/common/network.js';
import { DiskFileSystemProvider } from '../services/files/electron-browser/diskFileSystemProvider.js';
import { FileUserDataProvider } from '../../platform/userData/common/fileUserDataProvider.js';
import { IUserDataProfilesService, reviveProfile } from '../../platform/userDataProfile/common/userDataProfile.js';
import { UserDataProfilesService } from '../../platform/userDataProfile/common/userDataProfileIpc.js';
import { PolicyChannelClient } from '../../platform/policy/common/policyIpc.js';
import { IPolicyService } from '../../platform/policy/common/policy.js';
import { UserDataProfileService } from '../services/userDataProfile/common/userDataProfileService.js';
import { IUserDataProfileService } from '../services/userDataProfile/common/userDataProfile.js';
import { BrowserSocketFactory } from '../../platform/remote/browser/browserSocketFactory.js';
import { RemoteSocketFactoryService, IRemoteSocketFactoryService } from '../../platform/remote/common/remoteSocketFactoryService.js';
import { ElectronRemoteResourceLoader } from '../../platform/remote/electron-browser/electronRemoteResourceLoader.js';
import { applyZoom } from '../../platform/window/electron-browser/window.js';
import { mainWindow } from '../../base/browser/window.js';
import { DefaultAccountService, IDefaultAccountService } from '../services/accounts/common/defaultAccount.js';
import { AccountPolicyService } from '../services/policies/common/accountPolicyService.js';
import { MultiplexPolicyService } from '../services/policies/common/multiplexPolicyService.js';
export class DesktopMain extends Disposable {
    constructor(configuration) {
        super();
        this.configuration = configuration;
        this.init();
    }
    init() {
        // Massage configuration file URIs
        this.reviveUris();
        // Apply fullscreen early if configured
        setFullscreen(!!this.configuration.fullscreen, mainWindow);
    }
    reviveUris() {
        // Workspace
        const workspace = reviveIdentifier(this.configuration.workspace);
        if (isWorkspaceIdentifier(workspace) || isSingleFolderWorkspaceIdentifier(workspace)) {
            this.configuration.workspace = workspace;
        }
        // Files
        const filesToWait = this.configuration.filesToWait;
        const filesToWaitPaths = filesToWait?.paths;
        for (const paths of [filesToWaitPaths, this.configuration.filesToOpenOrCreate, this.configuration.filesToDiff, this.configuration.filesToMerge]) {
            if (Array.isArray(paths)) {
                for (const path of paths) {
                    if (path.fileUri) {
                        path.fileUri = URI.revive(path.fileUri);
                    }
                }
            }
        }
        if (filesToWait) {
            filesToWait.waitMarkerFileUri = URI.revive(filesToWait.waitMarkerFileUri);
        }
    }
    async open() {
        // Init services and wait for DOM to be ready in parallel
        const [services] = await Promise.all([this.initServices(), domContentLoaded(mainWindow)]);
        // Apply zoom level early once we have a configuration service
        // and before the workbench is created to prevent flickering.
        // We also need to respect that zoom level can be configured per
        // workspace, so we need the resolved configuration service.
        // Finally, it is possible for the window to have a custom
        // zoom level that is not derived from settings.
        // (fixes https://github.com/microsoft/vscode/issues/187982)
        this.applyWindowZoomLevel(services.configurationService);
        // Create Workbench
        const workbench = new Workbench(mainWindow.document.body, {
            extraClasses: this.getExtraClasses(),
            resetLayout: this.configuration['disable-layout-restore'] === true
        }, services.serviceCollection, services.logService);
        // Listeners
        this.registerListeners(workbench, services.storageService);
        // Startup
        const instantiationService = workbench.startup();
        // Window
        this._register(instantiationService.createInstance(NativeWindow));
    }
    applyWindowZoomLevel(configurationService) {
        let zoomLevel = undefined;
        if (this.configuration.isCustomZoomLevel && typeof this.configuration.zoomLevel === 'number') {
            zoomLevel = this.configuration.zoomLevel;
        }
        else {
            const windowConfig = configurationService.getValue();
            zoomLevel = typeof windowConfig.window?.zoomLevel === 'number' ? windowConfig.window.zoomLevel : 0;
        }
        applyZoom(zoomLevel, mainWindow);
    }
    getExtraClasses() {
        if (isMacintosh) {
            if (isTahoeOrNewer(this.configuration.os.release)) {
                return ['macos-rounded-tahoe'];
            }
            else {
                return ['macos-rounded-default'];
            }
        }
        return [];
    }
    registerListeners(workbench, storageService) {
        // Workbench Lifecycle
        this._register(workbench.onWillShutdown(event => event.join(storageService.close(), { id: 'join.closeStorage', label: localize('join.closeStorage', "Saving UI state") })));
        this._register(workbench.onDidShutdown(() => this.dispose()));
    }
    async initServices() {
        const serviceCollection = new ServiceCollection();
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //
        // NOTE: Please do NOT register services here. Use `registerSingleton()`
        //       from `workbench.common.main.ts` if the service is shared between
        //       desktop and web or `workbench.desktop.main.ts` if the service
        //       is desktop only.
        //
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // Main Process
        const mainProcessService = this._register(new ElectronIPCMainProcessService(this.configuration.windowId));
        serviceCollection.set(IMainProcessService, mainProcessService);
        // Product
        const productService = { _serviceBrand: undefined, ...product };
        serviceCollection.set(IProductService, productService);
        // Environment
        const environmentService = new NativeWorkbenchEnvironmentService(this.configuration, productService);
        serviceCollection.set(INativeWorkbenchEnvironmentService, environmentService);
        // Logger
        const loggers = this.configuration.loggers.map(loggerResource => ({ ...loggerResource, resource: URI.revive(loggerResource.resource) }));
        const loggerService = new LoggerChannelClient(this.configuration.windowId, this.configuration.logLevel, environmentService.windowLogsPath, loggers, mainProcessService.getChannel('logger'));
        serviceCollection.set(ILoggerService, loggerService);
        // Log
        const logService = this._register(new NativeLogService(loggerService, environmentService));
        serviceCollection.set(ILogService, logService);
        if (isCI) {
            logService.info('workbench#open()'); // marking workbench open helps to diagnose flaky integration/smoke tests
        }
        if (logService.getLevel() === LogLevel.Trace) {
            logService.trace('workbench#open(): with configuration', safeStringify({ ...this.configuration, nls: undefined /* exclude large property */ }));
        }
        // Default Account
        const defaultAccountService = this._register(new DefaultAccountService());
        serviceCollection.set(IDefaultAccountService, defaultAccountService);
        // Policies
        let policyService;
        const accountPolicy = new AccountPolicyService(logService, defaultAccountService);
        if (this.configuration.policiesData) {
            const policyChannel = new PolicyChannelClient(this.configuration.policiesData, mainProcessService.getChannel('policy'));
            policyService = new MultiplexPolicyService([policyChannel, accountPolicy], logService);
        }
        else {
            policyService = accountPolicy;
        }
        serviceCollection.set(IPolicyService, policyService);
        // Shared Process
        const sharedProcessService = new SharedProcessService(this.configuration.windowId, logService);
        serviceCollection.set(ISharedProcessService, sharedProcessService);
        // Utility Process Worker
        const utilityProcessWorkerWorkbenchService = new UtilityProcessWorkerWorkbenchService(this.configuration.windowId, logService, mainProcessService);
        serviceCollection.set(IUtilityProcessWorkerWorkbenchService, utilityProcessWorkerWorkbenchService);
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //
        // NOTE: Please do NOT register services here. Use `registerSingleton()`
        //       from `workbench.common.main.ts` if the service is shared between
        //       desktop and web or `workbench.desktop.main.ts` if the service
        //       is desktop only.
        //
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // Sign
        const signService = ProxyChannel.toService(mainProcessService.getChannel('sign'));
        serviceCollection.set(ISignService, signService);
        // Files
        const fileService = this._register(new FileService(logService));
        serviceCollection.set(IFileService, fileService);
        // Remote
        const remoteAuthorityResolverService = new RemoteAuthorityResolverService(productService, new ElectronRemoteResourceLoader(environmentService.window.id, mainProcessService, fileService));
        serviceCollection.set(IRemoteAuthorityResolverService, remoteAuthorityResolverService);
        // Local Files
        const diskFileSystemProvider = this._register(new DiskFileSystemProvider(mainProcessService, utilityProcessWorkerWorkbenchService, logService, loggerService));
        fileService.registerProvider(Schemas.file, diskFileSystemProvider);
        // URI Identity
        const uriIdentityService = new UriIdentityService(fileService);
        serviceCollection.set(IUriIdentityService, uriIdentityService);
        // User Data Profiles
        const userDataProfilesService = new UserDataProfilesService(this.configuration.profiles.all, URI.revive(this.configuration.profiles.home).with({ scheme: environmentService.userRoamingDataHome.scheme }), mainProcessService.getChannel('userDataProfiles'));
        serviceCollection.set(IUserDataProfilesService, userDataProfilesService);
        const userDataProfileService = new UserDataProfileService(reviveProfile(this.configuration.profiles.profile, userDataProfilesService.profilesHome.scheme));
        serviceCollection.set(IUserDataProfileService, userDataProfileService);
        // Use FileUserDataProvider for user data to
        // enable atomic read / write operations.
        fileService.registerProvider(Schemas.vscodeUserData, this._register(new FileUserDataProvider(Schemas.file, diskFileSystemProvider, Schemas.vscodeUserData, userDataProfilesService, uriIdentityService, logService)));
        // Remote Agent
        const remoteSocketFactoryService = new RemoteSocketFactoryService();
        remoteSocketFactoryService.register(0 /* RemoteConnectionType.WebSocket */, new BrowserSocketFactory(null));
        serviceCollection.set(IRemoteSocketFactoryService, remoteSocketFactoryService);
        const remoteAgentService = this._register(new RemoteAgentService(remoteSocketFactoryService, userDataProfileService, environmentService, productService, remoteAuthorityResolverService, signService, logService));
        serviceCollection.set(IRemoteAgentService, remoteAgentService);
        // Remote Files
        this._register(RemoteFileSystemProviderClient.register(remoteAgentService, fileService, logService));
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //
        // NOTE: Please do NOT register services here. Use `registerSingleton()`
        //       from `workbench.common.main.ts` if the service is shared between
        //       desktop and web or `workbench.desktop.main.ts` if the service
        //       is desktop only.
        //
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // Create services that require resolving in parallel
        const workspace = this.resolveWorkspaceIdentifier(environmentService);
        const [configurationService, storageService] = await Promise.all([
            this.createWorkspaceService(workspace, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, logService, policyService).then(service => {
                // Workspace
                serviceCollection.set(IWorkspaceContextService, service);
                // Configuration
                serviceCollection.set(IWorkbenchConfigurationService, service);
                return service;
            }),
            this.createStorageService(workspace, environmentService, userDataProfileService, userDataProfilesService, mainProcessService).then(service => {
                // Storage
                serviceCollection.set(IStorageService, service);
                return service;
            }),
            this.createKeyboardLayoutService(mainProcessService).then(service => {
                // KeyboardLayout
                serviceCollection.set(INativeKeyboardLayoutService, service);
                return service;
            })
        ]);
        // Workspace Trust Service
        const workspaceTrustEnablementService = new WorkspaceTrustEnablementService(configurationService, environmentService);
        serviceCollection.set(IWorkspaceTrustEnablementService, workspaceTrustEnablementService);
        const workspaceTrustManagementService = new WorkspaceTrustManagementService(configurationService, remoteAuthorityResolverService, storageService, uriIdentityService, environmentService, configurationService, workspaceTrustEnablementService, fileService);
        serviceCollection.set(IWorkspaceTrustManagementService, workspaceTrustManagementService);
        // Update workspace trust so that configuration is updated accordingly
        configurationService.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted());
        this._register(workspaceTrustManagementService.onDidChangeTrust(() => configurationService.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted())));
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //
        // NOTE: Please do NOT register services here. Use `registerSingleton()`
        //       from `workbench.common.main.ts` if the service is shared between
        //       desktop and web or `workbench.desktop.main.ts` if the service
        //       is desktop only.
        //
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        return { serviceCollection, logService, storageService, configurationService };
    }
    resolveWorkspaceIdentifier(environmentService) {
        // Return early for when a folder or multi-root is opened
        if (this.configuration.workspace) {
            return this.configuration.workspace;
        }
        // Otherwise, workspace is empty, so we derive an identifier
        return toWorkspaceIdentifier(this.configuration.backupPath, environmentService.isExtensionDevelopment);
    }
    async createWorkspaceService(workspace, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, logService, policyService) {
        const configurationCache = new ConfigurationCache([Schemas.file, Schemas.vscodeUserData] /* Cache all non native resources */, environmentService, fileService);
        const workspaceService = new WorkspaceService({ remoteAuthority: environmentService.remoteAuthority, configurationCache }, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, logService, policyService);
        try {
            await workspaceService.initialize(workspace);
            return workspaceService;
        }
        catch (error) {
            onUnexpectedError(error);
            return workspaceService;
        }
    }
    async createStorageService(workspace, environmentService, userDataProfileService, userDataProfilesService, mainProcessService) {
        const storageService = new NativeWorkbenchStorageService(workspace, userDataProfileService, userDataProfilesService, mainProcessService, environmentService);
        try {
            await storageService.initialize();
            return storageService;
        }
        catch (error) {
            onUnexpectedError(error);
            return storageService;
        }
    }
    async createKeyboardLayoutService(mainProcessService) {
        const keyboardLayoutService = new NativeKeyboardLayoutService(mainProcessService);
        try {
            await keyboardLayoutService.initialize();
            return keyboardLayoutService;
        }
        catch (error) {
            onUnexpectedError(error);
            return keyboardLayoutService;
        }
    }
}
export function main(configuration) {
    const workbench = new DesktopMain(configuration);
    return workbench.open();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVza3RvcC5tYWluLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9lbGVjdHJvbi1icm93c2VyL2Rlc2t0b3AubWFpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ3hDLE9BQU8sT0FBTyxNQUFNLDBDQUEwQyxDQUFDO0FBRS9ELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBQzNDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUM5RCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNoRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDN0YsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLGlDQUFpQyxFQUFFLE1BQU0sZ0VBQWdFLENBQUM7QUFDdkosT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDN0YsT0FBTyxFQUFFLGNBQWMsRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekYsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDdkcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLGlDQUFpQyxFQUFFLHFCQUFxQixFQUEyQixnQkFBZ0IsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3BOLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxNQUFNLG1E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