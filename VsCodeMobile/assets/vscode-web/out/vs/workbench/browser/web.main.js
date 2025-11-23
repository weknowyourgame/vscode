/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { mark } from '../../base/common/performance.js';
import { domContentLoaded, detectFullscreen, getCookieValue, getWindow } from '../../base/browser/dom.js';
import { assertReturnsDefined } from '../../base/common/types.js';
import { ServiceCollection } from '../../platform/instantiation/common/serviceCollection.js';
import { ILogService, ConsoleLogger, getLogLevel, ILoggerService } from '../../platform/log/common/log.js';
import { ConsoleLogInAutomationLogger } from '../../platform/log/browser/log.js';
import { Disposable, DisposableStore, toDisposable } from '../../base/common/lifecycle.js';
import { BrowserWorkbenchEnvironmentService, IBrowserWorkbenchEnvironmentService } from '../services/environment/browser/environmentService.js';
import { Workbench } from './workbench.js';
import { RemoteFileSystemProviderClient } from '../services/remote/common/remoteFileSystemProviderClient.js';
import { IProductService } from '../../platform/product/common/productService.js';
import product from '../../platform/product/common/product.js';
import { RemoteAgentService } from '../services/remote/browser/remoteAgentService.js';
import { RemoteAuthorityResolverService } from '../../platform/remote/browser/remoteAuthorityResolverService.js';
import { IRemoteAuthorityResolverService } from '../../platform/remote/common/remoteAuthorityResolver.js';
import { IRemoteAgentService } from '../services/remote/common/remoteAgentService.js';
import { IFileService } from '../../platform/files/common/files.js';
import { FileService } from '../../platform/files/common/fileService.js';
import { Schemas, connectionTokenCookieName } from '../../base/common/network.js';
import { IWorkspaceContextService, UNKNOWN_EMPTY_WINDOW_WORKSPACE, isTemporaryWorkspace, isWorkspaceIdentifier } from '../../platform/workspace/common/workspace.js';
import { IWorkbenchConfigurationService } from '../services/configuration/common/configuration.js';
import { onUnexpectedError } from '../../base/common/errors.js';
import { setFullscreen } from '../../base/browser/browser.js';
import { URI } from '../../base/common/uri.js';
import { WorkspaceService } from '../services/configuration/browser/configurationService.js';
import { ConfigurationCache } from '../services/configuration/common/configurationCache.js';
import { ISignService } from '../../platform/sign/common/sign.js';
import { SignService } from '../../platform/sign/browser/signService.js';
import { BrowserStorageService } from '../services/storage/browser/storageService.js';
import { IStorageService } from '../../platform/storage/common/storage.js';
import { toLocalISOString } from '../../base/common/date.js';
import { isWorkspaceToOpen, isFolderToOpen } from '../../platform/window/common/window.js';
import { getSingleFolderWorkspaceIdentifier, getWorkspaceIdentifier } from '../services/workspaces/browser/workspaces.js';
import { InMemoryFileSystemProvider } from '../../platform/files/common/inMemoryFilesystemProvider.js';
import { ICommandService } from '../../platform/commands/common/commands.js';
import { IndexedDBFileSystemProvider } from '../../platform/files/browser/indexedDBFileSystemProvider.js';
import { BrowserRequestService } from '../services/request/browser/requestService.js';
import { IRequestService } from '../../platform/request/common/request.js';
import { IUserDataInitializationService, UserDataInitializationService } from '../services/userData/browser/userDataInit.js';
import { UserDataSyncStoreManagementService } from '../../platform/userDataSync/common/userDataSyncStoreService.js';
import { IUserDataSyncStoreManagementService } from '../../platform/userDataSync/common/userDataSync.js';
import { ILifecycleService } from '../services/lifecycle/common/lifecycle.js';
import { Action2, MenuId, registerAction2 } from '../../platform/actions/common/actions.js';
import { IInstantiationService } from '../../platform/instantiation/common/instantiation.js';
import { localize, localize2 } from '../../nls.js';
import { Categories } from '../../platform/action/common/actionCommonCategories.js';
import { IDialogService } from '../../platform/dialogs/common/dialogs.js';
import { IHostService } from '../services/host/browser/host.js';
import { IUriIdentityService } from '../../platform/uriIdentity/common/uriIdentity.js';
import { UriIdentityService } from '../../platform/uriIdentity/common/uriIdentityService.js';
import { BrowserWindow } from './window.js';
import { ITimerService } from '../services/timer/browser/timerService.js';
import { WorkspaceTrustEnablementService, WorkspaceTrustManagementService } from '../services/workspaces/common/workspaceTrust.js';
import { IWorkspaceTrustEnablementService, IWorkspaceTrustManagementService } from '../../platform/workspace/common/workspaceTrust.js';
import { HTMLFileSystemProvider } from '../../platform/files/browser/htmlFileSystemProvider.js';
import { IOpenerService } from '../../platform/opener/common/opener.js';
import { mixin, safeStringify } from '../../base/common/objects.js';
import { IndexedDB } from '../../base/browser/indexedDB.js';
import { WebFileSystemAccess } from '../../platform/files/browser/webFileSystemAccess.js';
import { IProgressService } from '../../platform/progress/common/progress.js';
import { DelayedLogChannel } from '../services/output/common/delayedLogChannel.js';
import { dirname, joinPath } from '../../base/common/resources.js';
import { IUserDataProfilesService } from '../../platform/userDataProfile/common/userDataProfile.js';
import { IPolicyService } from '../../platform/policy/common/policy.js';
import { IRemoteExplorerService } from '../services/remote/common/remoteExplorerService.js';
import { DisposableTunnel, TunnelProtocol } from '../../platform/tunnel/common/tunnel.js';
import { ILabelService } from '../../platform/label/common/label.js';
import { UserDataProfileService } from '../services/userDataProfile/common/userDataProfileService.js';
import { IUserDataProfileService } from '../services/userDataProfile/common/userDataProfile.js';
import { BrowserUserDataProfilesService } from '../../platform/userDataProfile/browser/userDataProfile.js';
import { DeferredPromise, timeout } from '../../base/common/async.js';
import { windowLogGroup, windowLogId } from '../services/log/common/logConstants.js';
import { LogService } from '../../platform/log/common/logService.js';
import { IRemoteSocketFactoryService, RemoteSocketFactoryService } from '../../platform/remote/common/remoteSocketFactoryService.js';
import { BrowserSocketFactory } from '../../platform/remote/browser/browserSocketFactory.js';
import { VSBuffer } from '../../base/common/buffer.js';
import { UserDataProfileInitializer } from '../services/userDataProfile/browser/userDataProfileInit.js';
import { UserDataSyncInitializer } from '../services/userDataSync/browser/userDataSyncInit.js';
import { BrowserRemoteResourceLoader } from '../services/remote/browser/browserRemoteResourceHandler.js';
import { BufferLogger } from '../../platform/log/common/bufferLog.js';
import { FileLoggerService } from '../../platform/log/common/fileLog.js';
import { IEmbedderTerminalService } from '../services/terminal/common/embedderTerminalService.js';
import { BrowserSecretStorageService } from '../services/secrets/browser/secretStorageService.js';
import { EncryptionService } from '../services/encryption/browser/encryptionService.js';
import { IEncryptionService } from '../../platform/encryption/common/encryptionService.js';
import { ISecretStorageService } from '../../platform/secrets/common/secrets.js';
import { TunnelSource } from '../services/remote/common/tunnelModel.js';
import { mainWindow } from '../../base/browser/window.js';
import { INotificationService, Severity } from '../../platform/notification/common/notification.js';
import { DefaultAccountService, IDefaultAccountService } from '../services/accounts/common/defaultAccount.js';
import { AccountPolicyService } from '../services/policies/common/accountPolicyService.js';
export class BrowserMain extends Disposable {
    constructor(domElement, configuration) {
        super();
        this.domElement = domElement;
        this.configuration = configuration;
        this.onWillShutdownDisposables = this._register(new DisposableStore());
        this.indexedDBFileSystemProviders = [];
        this.init();
    }
    init() {
        // Browser config
        setFullscreen(!!detectFullscreen(mainWindow), mainWindow);
    }
    async open() {
        // Init services and wait for DOM to be ready in parallel
        const [services] = await Promise.all([this.initServices(), domContentLoaded(getWindow(this.domElement))]);
        // Create Workbench
        const workbench = new Workbench(this.domElement, undefined, services.serviceCollection, services.logService);
        // Listeners
        this.registerListeners(workbench);
        // Startup
        const instantiationService = workbench.startup();
        // Window
        this._register(instantiationService.createInstance(BrowserWindow));
        // Logging
        services.logService.trace('workbench#open with configuration', safeStringify(this.configuration));
        // Return API Facade
        return instantiationService.invokeFunction(accessor => {
            const commandService = accessor.get(ICommandService);
            const lifecycleService = accessor.get(ILifecycleService);
            const timerService = accessor.get(ITimerService);
            const openerService = accessor.get(IOpenerService);
            const productService = accessor.get(IProductService);
            const progressService = accessor.get(IProgressService);
            const environmentService = accessor.get(IBrowserWorkbenchEnvironmentService);
            const instantiationService = accessor.get(IInstantiationService);
            const remoteExplorerService = accessor.get(IRemoteExplorerService);
            const labelService = accessor.get(ILabelService);
            const embedderTerminalService = accessor.get(IEmbedderTerminalService);
            const remoteAuthorityResolverService = accessor.get(IRemoteAuthorityResolverService);
            const notificationService = accessor.get(INotificationService);
            async function showMessage(severity, message, ...items) {
                const choice = new DeferredPromise();
                const handle = notificationService.prompt(severity, message, items.map(item => ({
                    label: item,
                    run: () => choice.complete(item)
                })));
                const disposable = handle.onDidClose(() => {
                    choice.complete(undefined);
                    disposable.dispose();
                });
                const result = await choice.p;
                handle.close();
                return result;
            }
            let logger = undefined;
            return {
                commands: {
                    executeCommand: (command, ...args) => commandService.executeCommand(command, ...args)
                },
                env: {
                    async getUriScheme() {
                        return productService.urlProtocol;
                    },
                    async retrievePerformanceMarks() {
                        await timerService.whenReady();
                        return timerService.getPerformanceMarks();
                    },
                    async openUri(uri) {
                        return openerService.open(URI.isUri(uri) ? uri : URI.from(uri), {});
                    }
                },
                logger: {
                    log: (level, message) => {
                        if (!logger) {
                            logger = instantiationService.createInstance(DelayedLogChannel, 'webEmbedder', productService.embedderIdentifier || productService.nameShort, joinPath(dirname(environmentService.logFile), 'webEmbedder.log'));
                        }
                        logger.log(level, message);
                    }
                },
                window: {
                    withProgress: (options, task) => progressService.withProgress(options, task),
                    createTerminal: async (options) => embedderTerminalService.createTerminal(options),
                    showInformationMessage: (message, ...items) => showMessage(Severity.Info, message, ...items),
                },
                workspace: {
                    didResolveRemoteAuthority: async () => {
                        if (!this.configuration.remoteAuthority) {
                            return;
                        }
                        await remoteAuthorityResolverService.resolveAuthority(this.configuration.remoteAuthority);
                    },
                    openTunnel: async (tunnelOptions) => {
                        const tunnel = assertReturnsDefined(await remoteExplorerService.forward({
                            remote: tunnelOptions.remoteAddress,
                            local: tunnelOptions.localAddressPort,
                            name: tunnelOptions.label,
                            source: {
                                source: TunnelSource.Extension,
                                description: labelService.getHostLabel(Schemas.vscodeRemote, this.configuration.remoteAuthority)
                            },
                            elevateIfNeeded: false,
                            privacy: tunnelOptions.privacy
                        }, {
                            label: tunnelOptions.label,
                            elevateIfNeeded: undefined,
                            onAutoForward: undefined,
                            requireLocalPort: undefined,
                            protocol: tunnelOptions.protocol === TunnelProtocol.Https ? tunnelOptions.protocol : TunnelProtocol.Http
                        }));
                        if (typeof tunnel === 'string') {
                            throw new Error(tunnel);
                        }
                        return new class extends DisposableTunnel {
                        }({
                            port: tunnel.tunnelRemotePort,
                            host: tunnel.tunnelRemoteHost
                        }, tunnel.localAddress, () => tunnel.dispose());
                    }
                },
                shutdown: () => lifecycleService.shutdown()
            };
        });
    }
    registerListeners(workbench) {
        // Workbench Lifecycle
        this._register(workbench.onWillShutdown(() => this.onWillShutdownDisposables.clear()));
        this._register(workbench.onDidShutdown(() => this.dispose()));
    }
    async initServices() {
        const serviceCollection = new ServiceCollection();
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //
        // NOTE: Please do NOT register services here. Use `registerSingleton()`
        //       from `workbench.common.main.ts` if the service is shared between
        //       desktop and web or `workbench.web.main.ts` if the service
        //       is web only.
        //
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        const workspace = this.resolveWorkspace();
        // Product
        const productService = mixin({ _serviceBrand: undefined, ...product }, this.configuration.productConfiguration);
        serviceCollection.set(IProductService, productService);
        // Environment
        const logsPath = URI.file(toLocalISOString(new Date()).replace(/-|:|\.\d+Z$/g, '')).with({ scheme: 'vscode-log' });
        const environmentService = new BrowserWorkbenchEnvironmentService(workspace.id, logsPath, this.configuration, productService);
        serviceCollection.set(IBrowserWorkbenchEnvironmentService, environmentService);
        // Files
        const fileLogger = new BufferLogger();
        const fileService = this._register(new FileService(fileLogger));
        serviceCollection.set(IFileService, fileService);
        // Logger
        const loggerService = new FileLoggerService(getLogLevel(environmentService), logsPath, fileService);
        serviceCollection.set(ILoggerService, loggerService);
        // Log Service
        const otherLoggers = [new ConsoleLogger(loggerService.getLogLevel())];
        if (environmentService.isExtensionDevelopment && !!environmentService.extensionTestsLocationURI) {
            otherLoggers.push(new ConsoleLogInAutomationLogger(loggerService.getLogLevel()));
        }
        const logger = loggerService.createLogger(environmentService.logFile, { id: windowLogId, name: windowLogGroup.name, group: windowLogGroup });
        const logService = new LogService(logger, otherLoggers);
        serviceCollection.set(ILogService, logService);
        // Set the logger of the fileLogger after the log service is ready.
        // This is to avoid cyclic dependency
        fileLogger.logger = logService;
        // Register File System Providers depending on IndexedDB support
        // Register them early because they are needed for the profiles initialization
        await this.registerIndexedDBFileSystemProviders(environmentService, fileService, logService, loggerService, logsPath);
        const connectionToken = environmentService.options.connectionToken || getCookieValue(connectionTokenCookieName);
        const remoteResourceLoader = this.configuration.remoteResourceProvider ? new BrowserRemoteResourceLoader(fileService, this.configuration.remoteResourceProvider) : undefined;
        const resourceUriProvider = this.configuration.resourceUriProvider ?? remoteResourceLoader?.getResourceUriProvider();
        const remoteAuthorityResolverService = new RemoteAuthorityResolverService(!environmentService.expectsResolverExtension, connectionToken, resourceUriProvider, this.configuration.serverBasePath, productService, logService);
        serviceCollection.set(IRemoteAuthorityResolverService, remoteAuthorityResolverService);
        // Signing
        const signService = new SignService(productService);
        serviceCollection.set(ISignService, signService);
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //
        // NOTE: Please do NOT register services here. Use `registerSingleton()`
        //       from `workbench.common.main.ts` if the service is shared between
        //       desktop and web or `workbench.web.main.ts` if the service
        //       is web only.
        //
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // URI Identity
        const uriIdentityService = new UriIdentityService(fileService);
        serviceCollection.set(IUriIdentityService, uriIdentityService);
        // User Data Profiles
        const userDataProfilesService = new BrowserUserDataProfilesService(environmentService, fileService, uriIdentityService, logService);
        serviceCollection.set(IUserDataProfilesService, userDataProfilesService);
        const currentProfile = await this.getCurrentProfile(workspace, userDataProfilesService, environmentService);
        await userDataProfilesService.setProfileForWorkspace(workspace, currentProfile);
        const userDataProfileService = new UserDataProfileService(currentProfile);
        serviceCollection.set(IUserDataProfileService, userDataProfileService);
        // Remote Agent
        const remoteSocketFactoryService = new RemoteSocketFactoryService();
        remoteSocketFactoryService.register(0 /* RemoteConnectionType.WebSocket */, new BrowserSocketFactory(this.configuration.webSocketFactory));
        serviceCollection.set(IRemoteSocketFactoryService, remoteSocketFactoryService);
        const remoteAgentService = this._register(new RemoteAgentService(remoteSocketFactoryService, userDataProfileService, environmentService, productService, remoteAuthorityResolverService, signService, logService));
        serviceCollection.set(IRemoteAgentService, remoteAgentService);
        this._register(RemoteFileSystemProviderClient.register(remoteAgentService, fileService, logService));
        // Default Account
        const defaultAccountService = this._register(new DefaultAccountService());
        serviceCollection.set(IDefaultAccountService, defaultAccountService);
        // Policies
        const policyService = new AccountPolicyService(logService, defaultAccountService);
        serviceCollection.set(IPolicyService, policyService);
        // Long running services (workspace, config, storage)
        const [configurationService, storageService] = await Promise.all([
            this.createWorkspaceService(workspace, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, policyService, logService).then(service => {
                // Workspace
                serviceCollection.set(IWorkspaceContextService, service);
                // Configuration
                serviceCollection.set(IWorkbenchConfigurationService, service);
                return service;
            }),
            this.createStorageService(workspace, logService, userDataProfileService).then(service => {
                // Storage
                serviceCollection.set(IStorageService, service);
                return service;
            })
        ]);
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //
        // NOTE: Please do NOT register services here. Use `registerSingleton()`
        //       from `workbench.common.main.ts` if the service is shared between
        //       desktop and web or `workbench.web.main.ts` if the service
        //       is web only.
        //
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // Workspace Trust Service
        const workspaceTrustEnablementService = new WorkspaceTrustEnablementService(configurationService, environmentService);
        serviceCollection.set(IWorkspaceTrustEnablementService, workspaceTrustEnablementService);
        const workspaceTrustManagementService = new WorkspaceTrustManagementService(configurationService, remoteAuthorityResolverService, storageService, uriIdentityService, environmentService, configurationService, workspaceTrustEnablementService, fileService);
        serviceCollection.set(IWorkspaceTrustManagementService, workspaceTrustManagementService);
        // Update workspace trust so that configuration is updated accordingly
        configurationService.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted());
        this._register(workspaceTrustManagementService.onDidChangeTrust(() => configurationService.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted())));
        // Request Service
        const requestService = new BrowserRequestService(remoteAgentService, configurationService, loggerService);
        serviceCollection.set(IRequestService, requestService);
        // Userdata Sync Store Management Service
        const userDataSyncStoreManagementService = new UserDataSyncStoreManagementService(productService, configurationService, storageService);
        serviceCollection.set(IUserDataSyncStoreManagementService, userDataSyncStoreManagementService);
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //
        // NOTE: Please do NOT register services here. Use `registerSingleton()`
        //       from `workbench.common.main.ts` if the service is shared between
        //       desktop and web or `workbench.web.main.ts` if the service
        //       is web only.
        //
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        const encryptionService = new EncryptionService();
        serviceCollection.set(IEncryptionService, encryptionService);
        const secretStorageService = new BrowserSecretStorageService(storageService, encryptionService, environmentService, logService);
        serviceCollection.set(ISecretStorageService, secretStorageService);
        // Userdata Initialize Service
        const userDataInitializers = [];
        userDataInitializers.push(new UserDataSyncInitializer(environmentService, secretStorageService, userDataSyncStoreManagementService, fileService, userDataProfilesService, storageService, productService, requestService, logService, uriIdentityService));
        if (environmentService.options.profile) {
            userDataInitializers.push(new UserDataProfileInitializer(environmentService, fileService, userDataProfileService, storageService, logService, uriIdentityService, requestService));
        }
        const userDataInitializationService = new UserDataInitializationService(userDataInitializers);
        serviceCollection.set(IUserDataInitializationService, userDataInitializationService);
        try {
            await Promise.race([
                // Do not block more than 5s
                timeout(5000),
                this.initializeUserData(userDataInitializationService, configurationService)
            ]);
        }
        catch (error) {
            logService.error(error);
        }
        return { serviceCollection, configurationService, logService };
    }
    async initializeUserData(userDataInitializationService, configurationService) {
        if (await userDataInitializationService.requiresInitialization()) {
            mark('code/willInitRequiredUserData');
            // Initialize required resources - settings & global state
            await userDataInitializationService.initializeRequiredResources();
            // Important: Reload only local user configuration after initializing
            // Reloading complete configuration blocks workbench until remote configuration is loaded.
            await configurationService.reloadLocalUserConfiguration();
            mark('code/didInitRequiredUserData');
        }
    }
    async registerIndexedDBFileSystemProviders(environmentService, fileService, logService, loggerService, logsPath) {
        // IndexedDB is used for logging and user data
        let indexedDB;
        const userDataStore = 'vscode-userdata-store';
        const logsStore = 'vscode-logs-store';
        const handlesStore = 'vscode-filehandles-store';
        try {
            indexedDB = await IndexedDB.create('vscode-web-db', 3, [userDataStore, logsStore, handlesStore]);
            // Close onWillShutdown
            this.onWillShutdownDisposables.add(toDisposable(() => indexedDB?.close()));
        }
        catch (error) {
            logService.error('Error while creating IndexedDB', error);
        }
        // Logger
        if (indexedDB) {
            const logFileSystemProvider = new IndexedDBFileSystemProvider(logsPath.scheme, indexedDB, logsStore, false);
            this.indexedDBFileSystemProviders.push(logFileSystemProvider);
            fileService.registerProvider(logsPath.scheme, logFileSystemProvider);
        }
        else {
            fileService.registerProvider(logsPath.scheme, new InMemoryFileSystemProvider());
        }
        // User data
        let userDataProvider;
        if (indexedDB) {
            userDataProvider = new IndexedDBFileSystemProvider(Schemas.vscodeUserData, indexedDB, userDataStore, true);
            this.indexedDBFileSystemProviders.push(userDataProvider);
            this.registerDeveloperActions(userDataProvider);
        }
        else {
            logService.info('Using in-memory user data provider');
            userDataProvider = new InMemoryFileSystemProvider();
        }
        fileService.registerProvider(Schemas.vscodeUserData, userDataProvider);
        // Local file access (if supported by browser)
        if (WebFileSystemAccess.supported(mainWindow)) {
            fileService.registerProvider(Schemas.file, new HTMLFileSystemProvider(indexedDB, handlesStore, logService));
        }
        // In-memory
        fileService.registerProvider(Schemas.tmp, new InMemoryFileSystemProvider());
    }
    registerDeveloperActions(provider) {
        this._register(registerAction2(class ResetUserDataAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.resetUserData',
                    title: localize2('reset', "Reset User Data"),
                    category: Categories.Developer,
                    menu: {
                        id: MenuId.CommandPalette
                    }
                });
            }
            async run(accessor) {
                const dialogService = accessor.get(IDialogService);
                const hostService = accessor.get(IHostService);
                const storageService = accessor.get(IStorageService);
                const logService = accessor.get(ILogService);
                const result = await dialogService.confirm({
                    message: localize('reset user data message', "Would you like to reset your data (settings, keybindings, extensions, snippets and UI State) and reload?")
                });
                if (result.confirmed) {
                    try {
                        await provider?.reset();
                        if (storageService instanceof BrowserStorageService) {
                            await storageService.clear();
                        }
                    }
                    catch (error) {
                        logService.error(error);
                        throw error;
                    }
                }
                hostService.reload();
            }
        }));
    }
    async createStorageService(workspace, logService, userDataProfileService) {
        const storageService = new BrowserStorageService(workspace, userDataProfileService, logService);
        try {
            await storageService.initialize();
            // Register to close on shutdown
            this.onWillShutdownDisposables.add(toDisposable(() => storageService.close()));
            return storageService;
        }
        catch (error) {
            onUnexpectedError(error);
            logService.error(error);
            return storageService;
        }
    }
    async createWorkspaceService(workspace, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, policyService, logService) {
        // Temporary workspaces do not exist on startup because they are
        // just in memory. As such, detect this case and eagerly create
        // the workspace file empty so that it is a valid workspace.
        if (isWorkspaceIdentifier(workspace) && isTemporaryWorkspace(workspace.configPath)) {
            try {
                const emptyWorkspace = { folders: [] };
                await fileService.createFile(workspace.configPath, VSBuffer.fromString(JSON.stringify(emptyWorkspace, null, '\t')), { overwrite: false });
            }
            catch (error) {
                // ignore if workspace file already exists
            }
        }
        const configurationCache = new ConfigurationCache([Schemas.file, Schemas.vscodeUserData, Schemas.tmp] /* Cache all non native resources */, environmentService, fileService);
        const workspaceService = new WorkspaceService({ remoteAuthority: this.configuration.remoteAuthority, configurationCache }, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, logService, policyService);
        try {
            await workspaceService.initialize(workspace);
            return workspaceService;
        }
        catch (error) {
            onUnexpectedError(error);
            logService.error(error);
            return workspaceService;
        }
    }
    async getCurrentProfile(workspace, userDataProfilesService, environmentService) {
        const profileName = environmentService.options?.profile?.name ?? environmentService.profile;
        if (profileName) {
            const profile = userDataProfilesService.profiles.find(p => p.name === profileName);
            if (profile) {
                return profile;
            }
            return userDataProfilesService.createNamedProfile(profileName, undefined, workspace);
        }
        return userDataProfilesService.getProfileForWorkspace(workspace) ?? userDataProfilesService.defaultProfile;
    }
    resolveWorkspace() {
        let workspace = undefined;
        if (this.configuration.workspaceProvider) {
            workspace = this.configuration.workspaceProvider.workspace;
        }
        // Multi-root workspace
        if (workspace && isWorkspaceToOpen(workspace)) {
            return getWorkspaceIdentifier(workspace.workspaceUri);
        }
        // Single-folder workspace
        if (workspace && isFolderToOpen(workspace)) {
            return getSingleFolderWorkspaceIdentifier(workspace.folderUri);
        }
        // Empty window workspace
        return UNKNOWN_EMPTY_WINDOW_WORKSPACE;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViLm1haW4uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2Jyb3dzZXIvd2ViLm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDMUcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDbEUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDN0YsT0FBTyxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsV0FBVyxFQUFFLGNBQWMsRUFBVyxNQUFNLGtDQUFrQyxDQUFDO0FBQ3BILE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzNGLE9BQU8sRUFBRSxrQ0FBa0MsRUFBRSxtQ0FBbUMsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ2hKLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUMzQyxPQUFPLEVBQUUsOEJBQThCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUU3RyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0saURBQWlELENBQUM7QUFDbEYsT0FBTyxPQUFPLE1BQU0sMENBQTBDLENBQUM7QUFDL0QsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDdEYsT0FBTyxFQUFFLDhCQUE4QixFQUFFLE1BQU0saUVBQWlFLENBQUM7QUFDakgsT0FBTyxFQUFFLCtCQUErQixFQUF3QixNQUFN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