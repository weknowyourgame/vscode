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
import { toAction } from '../../../../base/common/actions.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { joinPath } from '../../../../base/common/resources.js';
import { isNumber, isObject, isString } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { ILoggerService } from '../../../../platform/log/common/log.js';
import { INotificationService, NotificationPriority, Severity } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { CONFIGURATION_KEY_HOST_NAME, CONFIGURATION_KEY_PREFIX, CONFIGURATION_KEY_PREVENT_SLEEP, INACTIVE_TUNNEL_MODE, IRemoteTunnelService, LOGGER_NAME, LOG_ID } from '../../../../platform/remoteTunnel/common/remoteTunnel.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService, isUntitledWorkspace } from '../../../../platform/workspace/common/workspace.js';
import { Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IOutputService } from '../../../services/output/common/output.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
export const REMOTE_TUNNEL_CATEGORY = localize2('remoteTunnel.category', 'Remote Tunnels');
export const REMOTE_TUNNEL_CONNECTION_STATE_KEY = 'remoteTunnelConnection';
export const REMOTE_TUNNEL_CONNECTION_STATE = new RawContextKey(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'disconnected');
const REMOTE_TUNNEL_USED_STORAGE_KEY = 'remoteTunnelServiceUsed';
const REMOTE_TUNNEL_PROMPTED_PREVIEW_STORAGE_KEY = 'remoteTunnelServicePromptedPreview';
const REMOTE_TUNNEL_EXTENSION_RECOMMENDED_KEY = 'remoteTunnelExtensionRecommended';
const REMOTE_TUNNEL_HAS_USED_BEFORE = 'remoteTunnelHasUsed';
const REMOTE_TUNNEL_EXTENSION_TIMEOUT = 4 * 60 * 1000; // show the recommendation that a machine started using tunnels if it joined less than 4 minutes ago
const INVALID_TOKEN_RETRIES = 2;
var RemoteTunnelCommandIds;
(function (RemoteTunnelCommandIds) {
    RemoteTunnelCommandIds["turnOn"] = "workbench.remoteTunnel.actions.turnOn";
    RemoteTunnelCommandIds["turnOff"] = "workbench.remoteTunnel.actions.turnOff";
    RemoteTunnelCommandIds["connecting"] = "workbench.remoteTunnel.actions.connecting";
    RemoteTunnelCommandIds["manage"] = "workbench.remoteTunnel.actions.manage";
    RemoteTunnelCommandIds["showLog"] = "workbench.remoteTunnel.actions.showLog";
    RemoteTunnelCommandIds["configure"] = "workbench.remoteTunnel.actions.configure";
    RemoteTunnelCommandIds["copyToClipboard"] = "workbench.remoteTunnel.actions.copyToClipboard";
    RemoteTunnelCommandIds["learnMore"] = "workbench.remoteTunnel.actions.learnMore";
})(RemoteTunnelCommandIds || (RemoteTunnelCommandIds = {}));
// name shown in nofications
var RemoteTunnelCommandLabels;
(function (RemoteTunnelCommandLabels) {
    RemoteTunnelCommandLabels.turnOn = localize('remoteTunnel.actions.turnOn', 'Turn on Remote Tunnel Access...');
    RemoteTunnelCommandLabels.turnOff = localize('remoteTunnel.actions.turnOff', 'Turn off Remote Tunnel Access...');
    RemoteTunnelCommandLabels.showLog = localize('remoteTunnel.actions.showLog', 'Show Remote Tunnel Service Log');
    RemoteTunnelCommandLabels.configure = localize('remoteTunnel.actions.configure', 'Configure Tunnel Name...');
    RemoteTunnelCommandLabels.copyToClipboard = localize('remoteTunnel.actions.copyToClipboard', 'Copy Browser URI to Clipboard');
    RemoteTunnelCommandLabels.learnMore = localize('remoteTunnel.actions.learnMore', 'Get Started with Tunnels');
})(RemoteTunnelCommandLabels || (RemoteTunnelCommandLabels = {}));
let RemoteTunnelWorkbenchContribution = class RemoteTunnelWorkbenchContribution extends Disposable {
    constructor(authenticationService, dialogService, extensionService, contextKeyService, productService, storageService, loggerService, quickInputService, environmentService, remoteTunnelService, commandService, workspaceContextService, progressService, notificationService) {
        super();
        this.authenticationService = authenticationService;
        this.dialogService = dialogService;
        this.extensionService = extensionService;
        this.contextKeyService = contextKeyService;
        this.storageService = storageService;
        this.quickInputService = quickInputService;
        this.environmentService = environmentService;
        this.remoteTunnelService = remoteTunnelService;
        this.commandService = commandService;
        this.workspaceContextService = workspaceContextService;
        this.progressService = progressService;
        this.notificationService = notificationService;
        this.expiredSessions = new Set();
        this.logger = this._register(loggerService.createLogger(joinPath(environmentService.logsHome, `${LOG_ID}.log`), { id: LOG_ID, name: LOGGER_NAME }));
        this.connectionStateContext = REMOTE_TUNNEL_CONNECTION_STATE.bindTo(this.contextKeyService);
        const serverConfiguration = productService.tunnelApplicationConfig;
        if (!serverConfiguration || !productService.tunnelApplicationName) {
            this.logger.error('Missing \'tunnelApplicationConfig\' or \'tunnelApplicationName\' in product.json. Remote tunneling is not available.');
            this.serverConfiguration = { authenticationProviders: {}, editorWebUrl: '', extension: { extensionId: '', friendlyName: '' } };
            return;
        }
        this.serverConfiguration = serverConfiguration;
        this._register(this.remoteTunnelService.onDidChangeTunnelStatus(s => this.handleTunnelStatusUpdate(s)));
        this.registerCommands();
        this.initialize();
        this.recommendRemoteExtensionIfNeeded();
    }
    handleTunnelStatusUpdate(status) {
        this.connectionInfo = undefined;
        if (status.type === 'disconnected') {
            if (status.onTokenFailed) {
                this.expiredSessions.add(status.onTokenFailed.sessionId);
            }
            this.connectionStateContext.set('disconnected');
        }
        else if (status.type === 'connecting') {
            this.connectionStateContext.set('connecting');
        }
        else if (status.type === 'connected') {
            this.connectionInfo = status.info;
            this.connectionStateContext.set('connected');
        }
    }
    async recommendRemoteExtensionIfNeeded() {
        await this.extensionService.whenInstalledExtensionsRegistered();
        const remoteExtension = this.serverConfiguration.extension;
        const shouldRecommend = async () => {
            if (this.storageService.getBoolean(REMOTE_TUNNEL_EXTENSION_RECOMMENDED_KEY, -1 /* StorageScope.APPLICATION */)) {
                return false;
            }
            if (await this.extensionService.getExtension(remoteExtension.extensionId)) {
                return false;
            }
            const usedOnHostMessage = this.storageService.get(REMOTE_TUNNEL_USED_STORAGE_KEY, -1 /* StorageScope.APPLICATION */);
            if (!usedOnHostMessage) {
                return false;
            }
            let usedTunnelName;
            try {
                const message = JSON.parse(usedOnHostMessage);
                if (!isObject(message)) {
                    return false;
                }
                const { hostName, timeStamp } = message;
                if (!isString(hostName) || !isNumber(timeStamp) || new Date().getTime() > timeStamp + REMOTE_TUNNEL_EXTENSION_TIMEOUT) {
                    return false;
                }
                usedTunnelName = hostName;
            }
            catch (_) {
                // problems parsing the message, likly the old message format
                return false;
            }
            const currentTunnelName = await this.remoteTunnelService.getTunnelName();
            if (!currentTunnelName || currentTunnelName === usedTunnelName) {
                return false;
            }
            return usedTunnelName;
        };
        const recommed = async () => {
            const usedOnHost = await shouldRecommend();
            if (!usedOnHost) {
                return false;
            }
            this.notificationService.notify({
                severity: Severity.Info,
                priority: NotificationPriority.OPTIONAL,
                message: localize({
                    key: 'recommend.remoteExtension',
                    comment: ['{0} will be a tunnel name, {1} will the link address to the web UI, {6} an extension name. [label](command:commandId) is a markdown link. Only translate the label, do not modify the format']
                }, "Tunnel '{0}' is avaiable for remote access. The {1} extension can be used to connect to it.", usedOnHost, remoteExtension.friendlyName),
                actions: {
                    primary: [
                        toAction({
                            id: 'showExtension', label: localize('action.showExtension', "Show Extension"), run: () => {
                                return this.commandService.executeCommand('workbench.extensions.action.showExtensionsWithIds', [remoteExtension.extensionId]);
                            }
                        }),
                        toAction({
                            id: 'doNotShowAgain', label: localize('action.doNotShowAgain', "Do not show again"), run: () => {
                                this.storageService.store(REMOTE_TUNNEL_EXTENSION_RECOMMENDED_KEY, true, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
                            }
                        }),
                    ]
                }
            });
            return true;
        };
        if (await shouldRecommend()) {
            const disposables = this._register(new DisposableStore());
            disposables.add(this.storageService.onDidChangeValue(-1 /* StorageScope.APPLICATION */, REMOTE_TUNNEL_USED_STORAGE_KEY, disposables)(async () => {
                const success = await recommed();
                if (success) {
                    disposables.dispose();
                }
            }));
        }
    }
    async initialize() {
        const [mode, status] = await Promise.all([
            this.remoteTunnelService.getMode(),
            this.remoteTunnelService.getTunnelStatus(),
        ]);
        this.handleTunnelStatusUpdate(status);
        if (mode.active && mode.session.token) {
            return; // already initialized, token available
        }
        const doInitialStateDiscovery = async (progress) => {
            const listener = progress && this.remoteTunnelService.onDidChangeTunnelStatus(status => {
                switch (status.type) {
                    case 'connecting':
                        if (status.progress) {
                            progress.report({ message: status.progress });
                        }
                        break;
                }
            });
            let newSession;
            if (mode.active) {
                const token = await this.getSessionToken(mode.session);
                if (token) {
                    newSession = { ...mode.session, token };
                }
            }
            const status = await this.remoteTunnelService.initialize(mode.active && newSession ? { ...mode, session: newSession } : INACTIVE_TUNNEL_MODE);
            listener?.dispose();
            if (status.type === 'connected') {
                this.connectionInfo = status.info;
                this.connectionStateContext.set('connected');
                return;
            }
        };
        const hasUsed = this.storageService.getBoolean(REMOTE_TUNNEL_HAS_USED_BEFORE, -1 /* StorageScope.APPLICATION */, false);
        if (hasUsed) {
            await this.progressService.withProgress({
                location: 10 /* ProgressLocation.Window */,
                title: localize({ key: 'initialize.progress.title', comment: ['Only translate \'Looking for remote tunnel\', do not change the format of the rest (markdown link format)'] }, "[Looking for remote tunnel](command:{0})", RemoteTunnelCommandIds.showLog),
            }, doInitialStateDiscovery);
        }
        else {
            doInitialStateDiscovery(undefined);
        }
    }
    getPreferredTokenFromSession(session) {
        return session.session.accessToken || session.session.idToken;
    }
    async startTunnel(asService) {
        if (this.connectionInfo) {
            return this.connectionInfo;
        }
        this.storageService.store(REMOTE_TUNNEL_HAS_USED_BEFORE, true, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
        let tokenProblems = false;
        for (let i = 0; i < INVALID_TOKEN_RETRIES; i++) {
            tokenProblems = false;
            const authenticationSession = await this.getAuthenticationSession();
            if (authenticationSession === undefined) {
                this.logger.info('No authentication session available, not starting tunnel');
                return undefined;
            }
            const result = await this.progressService.withProgress({
                location: 15 /* ProgressLocation.Notification */,
                title: localize({ key: 'startTunnel.progress.title', comment: ['Only translate \'Starting remote tunnel\', do not change the format of the rest (markdown link format)'] }, "[Starting remote tunnel](command:{0})", RemoteTunnelCommandIds.showLog),
            }, (progress) => {
                return new Promise((s, e) => {
                    let completed = false;
                    const listener = this.remoteTunnelService.onDidChangeTunnelStatus(status => {
                        switch (status.type) {
                            case 'connecting':
                                if (status.progress) {
                                    progress.report({ message: status.progress });
                                }
                                break;
                            case 'connected':
                                listener.dispose();
                                completed = true;
                                s(status.info);
                                if (status.serviceInstallFailed) {
                                    this.notificationService.notify({
                                        severity: Severity.Warning,
                                        message: localize({
                                            key: 'remoteTunnel.serviceInstallFailed',
                                            comment: ['{Locked="](command:{0})"}']
                                        }, "Installation as a service failed, and we fell back to running the tunnel for this session. See the [error log](command:{0}) for details.", RemoteTunnelCommandIds.showLog),
                                    });
                                }
                                break;
                            case 'disconnected':
                                listener.dispose();
                                completed = true;
                                tokenProblems = !!status.onTokenFailed;
                                s(undefined);
                                break;
                        }
                    });
                    const token = this.getPreferredTokenFromSession(authenticationSession);
                    const account = { sessionId: authenticationSession.session.id, token, providerId: authenticationSession.providerId, accountLabel: authenticationSession.session.account.label };
                    this.remoteTunnelService.startTunnel({ active: true, asService, session: account }).then(status => {
                        if (!completed && (status.type === 'connected' || status.type === 'disconnected')) {
                            listener.dispose();
                            if (status.type === 'connected') {
                                s(status.info);
                            }
                            else {
                                tokenProblems = !!status.onTokenFailed;
                                s(undefined);
                            }
                        }
                    });
                });
            });
            if (result || !tokenProblems) {
                return result;
            }
        }
        return undefined;
    }
    async getAuthenticationSession() {
        const sessions = await this.getAllSessions();
        const disposables = new DisposableStore();
        const quickpick = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
        quickpick.ok = false;
        quickpick.placeholder = localize('accountPreference.placeholder', "Sign in to an account to enable remote access");
        quickpick.ignoreFocusOut = true;
        quickpick.items = await this.createQuickpickItems(sessions);
        return new Promise((resolve, reject) => {
            disposables.add(quickpick.onDidHide((e) => {
                resolve(undefined);
                disposables.dispose();
            }));
            disposables.add(quickpick.onDidAccept(async (e) => {
                const selection = quickpick.selectedItems[0];
                if ('provider' in selection) {
                    const session = await this.authenticationService.createSession(selection.provider.id, selection.provider.scopes);
                    resolve(this.createExistingSessionItem(session, selection.provider.id));
                }
                else if ('session' in selection) {
                    resolve(selection);
                }
                else {
                    resolve(undefined);
                }
                quickpick.hide();
            }));
            quickpick.show();
        });
    }
    createExistingSessionItem(session, providerId) {
        return {
            label: session.account.label,
            description: this.authenticationService.getProvider(providerId).label,
            session,
            providerId
        };
    }
    async createQuickpickItems(sessions) {
        const options = [];
        if (sessions.length) {
            options.push({ type: 'separator', label: localize('signed in', "Signed In") });
            options.push(...sessions);
            options.push({ type: 'separator', label: localize('others', "Others") });
        }
        for (const authenticationProvider of (await this.getAuthenticationProviders())) {
            const signedInForProvider = sessions.some(account => account.providerId === authenticationProvider.id);
            const provider = this.authenticationService.getProvider(authenticationProvider.id);
            if (!signedInForProvider || provider.supportsMultipleAccounts) {
                options.push({ label: localize({ key: 'sign in using account', comment: ['{0} will be a auth provider (e.g. Github)'] }, "Sign in with {0}", provider.label), provider: authenticationProvider });
            }
        }
        return options;
    }
    /**
     * Returns all authentication sessions available from {@link getAuthenticationProviders}.
     */
    async getAllSessions() {
        const authenticationProviders = await this.getAuthenticationProviders();
        const accounts = new Map();
        const currentAccount = await this.remoteTunnelService.getMode();
        let currentSession;
        for (const provider of authenticationProviders) {
            const sessions = await this.authenticationService.getSessions(provider.id, provider.scopes);
            for (const session of sessions) {
                if (!this.expiredSessions.has(session.id)) {
                    const item = this.createExistingSessionItem(session, provider.id);
                    accounts.set(item.session.account.id, item);
                    if (currentAccount.active && currentAccount.session.sessionId === session.id) {
                        currentSession = item;
                    }
                }
            }
        }
        if (currentSession !== undefined) {
            accounts.set(currentSession.session.account.id, currentSession);
        }
        return [...accounts.values()];
    }
    async getSessionToken(session) {
        if (session) {
            const sessionItem = (await this.getAllSessions()).find(s => s.session.id === session.sessionId);
            if (sessionItem) {
                return this.getPreferredTokenFromSession(sessionItem);
            }
        }
        return undefined;
    }
    /**
     * Returns all authentication providers which can be used to authenticate
     * to the remote storage service, based on product.json configuration
     * and registered authentication providers.
     */
    async getAuthenticationProviders() {
        // Get the list of authentication providers configured in product.json
        const authenticationProviders = this.serverConfiguration.authenticationProviders;
        const configuredAuthenticationProviders = Object.keys(authenticationProviders).reduce((result, id) => {
            result.push({ id, scopes: authenticationProviders[id].scopes });
            return result;
        }, []);
        // Filter out anything that isn't currently available through the authenticationService
        const availableAuthenticationProviders = this.authenticationService.declaredProviders;
        return configuredAuthenticationProviders.filter(({ id }) => availableAuthenticationProviders.some(provider => provider.id === id));
    }
    registerCommands() {
        const that = this;
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: RemoteTunnelCommandIds.turnOn,
                    title: RemoteTunnelCommandLabels.turnOn,
                    category: REMOTE_TUNNEL_CATEGORY,
                    precondition: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'disconnected'),
                    menu: [{
                            id: MenuId.CommandPalette,
                        },
                        {
                            id: MenuId.AccountsContext,
                            group: '2_remoteTunnel',
                            when: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'disconnected'),
                        }]
                });
            }
            async run(accessor) {
                const notificationService = accessor.get(INotificationService);
                const clipboardService = accessor.get(IClipboardService);
                const commandService = accessor.get(ICommandService);
                const storageService = accessor.get(IStorageService);
                const dialogService = accessor.get(IDialogService);
                const quickInputService = accessor.get(IQuickInputService);
                const productService = accessor.get(IProductService);
                const didNotifyPreview = storageService.getBoolean(REMOTE_TUNNEL_PROMPTED_PREVIEW_STORAGE_KEY, -1 /* StorageScope.APPLICATION */, false);
                if (!didNotifyPreview) {
                    const { confirmed } = await dialogService.confirm({
                        message: localize('tunnel.preview', 'Remote Tunnels is currently in preview. Please report any problems using the "Help: Report Issue" command.'),
                        primaryButton: localize({ key: 'enable', comment: ['&& denotes a mnemonic'] }, '&&Enable')
                    });
                    if (!confirmed) {
                        return;
                    }
                    storageService.store(REMOTE_TUNNEL_PROMPTED_PREVIEW_STORAGE_KEY, true, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
                }
                const disposables = new DisposableStore();
                const quickPick = quickInputService.createQuickPick();
                quickPick.placeholder = localize('tunnel.enable.placeholder', 'Select how you want to enable access');
                quickPick.items = [
                    { service: false, label: localize('tunnel.enable.session', 'Turn on for this session'), description: localize('tunnel.enable.session.description', 'Run whenever {0} is open', productService.nameShort) },
                    { service: true, label: localize('tunnel.enable.service', 'Install as a service'), description: localize('tunnel.enable.service.description', 'Run whenever you\'re logged in') }
                ];
                const asService = await new Promise(resolve => {
                    disposables.add(quickPick.onDidAccept(() => resolve(quickPick.selectedItems[0]?.service)));
                    disposables.add(quickPick.onDidHide(() => resolve(undefined)));
                    quickPick.show();
                });
                quickPick.dispose();
                if (asService === undefined) {
                    return; // no-op
                }
                const connectionInfo = await that.startTunnel(/* installAsService= */ asService);
                if (connectionInfo) {
                    const linkToOpen = that.getLinkToOpen(connectionInfo);
                    const remoteExtension = that.serverConfiguration.extension;
                    const linkToOpenForMarkdown = linkToOpen.toString(false).replace(/\)/g, '%29');
                    notificationService.notify({
                        severity: Severity.Info,
                        message: localize({
                            key: 'progress.turnOn.final',
                            comment: ['{0} will be the tunnel name, {1} will the link address to the web UI, {6} an extension name, {7} a link to the extension documentation. [label](command:commandId) is a markdown link. Only translate the label, do not modify the format']
                        }, "You can now access this machine anywhere via the secure tunnel [{0}](command:{4}). To connect via a different machine, use the generated [{1}]({2}) link or use the [{6}]({7}) extension in the desktop or web. You can [configure](command:{3}) or [turn off](command:{5}) this access via the VS Code Accounts menu.", connectionInfo.tunnelName, connectionInfo.domain, linkToOpenForMarkdown, RemoteTunnelCommandIds.manage, RemoteTunnelCommandIds.configure, RemoteTunnelCommandIds.turnOff, remoteExtension.friendlyName, 'https://code.visualstudio.com/docs/remote/tunnels'),
                        actions: {
                            primary: [
                                toAction({ id: 'copyToClipboard', label: localize('action.copyToClipboard', "Copy Browser Link to Clipboard"), run: () => clipboardService.writeText(linkToOpen.toString(true)) }),
                                toAction({
                                    id: 'showExtension', label: localize('action.showExtension', "Show Extension"), run: () => {
                                        return commandService.executeCommand('workbench.extensions.action.showExtensionsWithIds', [remoteExtension.extensionId]);
                                    }
                                })
                            ]
                        }
                    });
                    const usedOnHostMessage = { hostName: connectionInfo.tunnelName, timeStamp: new Date().getTime() };
                    storageService.store(REMOTE_TUNNEL_USED_STORAGE_KEY, JSON.stringify(usedOnHostMessage), -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
                }
                else {
                    notificationService.notify({
                        severity: Severity.Info,
                        message: localize('progress.turnOn.failed', "Unable to turn on the remote tunnel access. Check the Remote Tunnel Service log for details."),
                    });
                    await commandService.executeCommand(RemoteTunnelCommandIds.showLog);
                }
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: RemoteTunnelCommandIds.manage,
                    title: localize('remoteTunnel.actions.manage.on.v2', 'Remote Tunnel Access is On'),
                    category: REMOTE_TUNNEL_CATEGORY,
                    menu: [{
                            id: MenuId.AccountsContext,
                            group: '2_remoteTunnel',
                            when: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'connected'),
                        }]
                });
            }
            async run() {
                that.showManageOptions();
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: RemoteTunnelCommandIds.connecting,
                    title: localize('remoteTunnel.actions.manage.connecting', 'Remote Tunnel Access is Connecting'),
                    category: REMOTE_TUNNEL_CATEGORY,
                    menu: [{
                            id: MenuId.AccountsContext,
                            group: '2_remoteTunnel',
                            when: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'connecting'),
                        }]
                });
            }
            async run() {
                that.showManageOptions();
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: RemoteTunnelCommandIds.turnOff,
                    title: RemoteTunnelCommandLabels.turnOff,
                    category: REMOTE_TUNNEL_CATEGORY,
                    precondition: ContextKeyExpr.notEquals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'disconnected'),
                    menu: [{
                            id: MenuId.CommandPalette,
                            when: ContextKeyExpr.notEquals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, ''),
                        }]
                });
            }
            async run() {
                const message = that.connectionInfo?.isAttached ?
                    localize('remoteTunnel.turnOffAttached.confirm', 'Do you want to turn off Remote Tunnel Access? This will also stop the service that was started externally.') :
                    localize('remoteTunnel.turnOff.confirm', 'Do you want to turn off Remote Tunnel Access?');
                const { confirmed } = await that.dialogService.confirm({ message });
                if (confirmed) {
                    that.remoteTunnelService.stopTunnel();
                }
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: RemoteTunnelCommandIds.showLog,
                    title: RemoteTunnelCommandLabels.showLog,
                    category: REMOTE_TUNNEL_CATEGORY,
                    menu: [{
                            id: MenuId.CommandPalette,
                            when: ContextKeyExpr.notEquals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, ''),
                        }]
                });
            }
            async run(accessor) {
                const outputService = accessor.get(IOutputService);
                outputService.showChannel(LOG_ID);
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: RemoteTunnelCommandIds.configure,
                    title: RemoteTunnelCommandLabels.configure,
                    category: REMOTE_TUNNEL_CATEGORY,
                    menu: [{
                            id: MenuId.CommandPalette,
                            when: ContextKeyExpr.notEquals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, ''),
                        }]
                });
            }
            async run(accessor) {
                const preferencesService = accessor.get(IPreferencesService);
                preferencesService.openSettings({ query: CONFIGURATION_KEY_PREFIX });
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: RemoteTunnelCommandIds.copyToClipboard,
                    title: RemoteTunnelCommandLabels.copyToClipboard,
                    category: REMOTE_TUNNEL_CATEGORY,
                    precondition: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'connected'),
                    menu: [{
                            id: MenuId.CommandPalette,
                            when: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'connected'),
                        }]
                });
            }
            async run(accessor) {
                const clipboardService = accessor.get(IClipboardService);
                if (that.connectionInfo) {
                    const linkToOpen = that.getLinkToOpen(that.connectionInfo);
                    clipboardService.writeText(linkToOpen.toString(true));
                }
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: RemoteTunnelCommandIds.learnMore,
                    title: RemoteTunnelCommandLabels.learnMore,
                    category: REMOTE_TUNNEL_CATEGORY,
                    menu: []
                });
            }
            async run(accessor) {
                const openerService = accessor.get(IOpenerService);
                await openerService.open('https://aka.ms/vscode-server-doc');
            }
        }));
    }
    getLinkToOpen(connectionInfo) {
        const workspace = this.workspaceContextService.getWorkspace();
        const folders = workspace.folders;
        let resource;
        if (folders.length === 1) {
            resource = folders[0].uri;
        }
        else if (workspace.configuration && !isUntitledWorkspace(workspace.configuration, this.environmentService)) {
            resource = workspace.configuration;
        }
        const link = URI.parse(connectionInfo.link);
        if (resource?.scheme === Schemas.file) {
            return joinPath(link, resource.path);
        }
        return joinPath(link, this.environmentService.userHome.path);
    }
    async showManageOptions() {
        const account = await this.remoteTunnelService.getMode();
        return new Promise((c, e) => {
            const disposables = new DisposableStore();
            const quickPick = this.quickInputService.createQuickPick({ useSeparators: true });
            quickPick.placeholder = localize('manage.placeholder', 'Select a command to invoke');
            disposables.add(quickPick);
            const items = [];
            items.push({ id: RemoteTunnelCommandIds.learnMore, label: RemoteTunnelCommandLabels.learnMore });
            if (this.connectionInfo) {
                quickPick.title =
                    this.connectionInfo.isAttached ?
                        localize({ key: 'manage.title.attached', comment: ['{0} is the tunnel name'] }, 'Remote Tunnel Access enabled for {0} (launched externally)', this.connectionInfo.tunnelName) :
                        localize({ key: 'manage.title.orunning', comment: ['{0} is the tunnel name'] }, 'Remote Tunnel Access enabled for {0}', this.connectionInfo.tunnelName);
                items.push({ id: RemoteTunnelCommandIds.copyToClipboard, label: RemoteTunnelCommandLabels.copyToClipboard, description: this.connectionInfo.domain });
            }
            else {
                quickPick.title = localize('manage.title.off', 'Remote Tunnel Access not enabled');
            }
            items.push({ id: RemoteTunnelCommandIds.showLog, label: localize('manage.showLog', 'Show Log') });
            items.push({ type: 'separator' });
            items.push({ id: RemoteTunnelCommandIds.configure, label: localize('manage.tunnelName', 'Change Tunnel Name'), description: this.connectionInfo?.tunnelName });
            items.push({ id: RemoteTunnelCommandIds.turnOff, label: RemoteTunnelCommandLabels.turnOff, description: account.active ? `${account.session.accountLabel} (${account.session.providerId})` : undefined });
            quickPick.items = items;
            disposables.add(quickPick.onDidAccept(() => {
                if (quickPick.selectedItems[0] && quickPick.selectedItems[0].id) {
                    this.commandService.executeCommand(quickPick.selectedItems[0].id);
                }
                quickPick.hide();
            }));
            disposables.add(quickPick.onDidHide(() => {
                disposables.dispose();
                c();
            }));
            quickPick.show();
        });
    }
};
RemoteTunnelWorkbenchContribution = __decorate([
    __param(0, IAuthenticationService),
    __param(1, IDialogService),
    __param(2, IExtensionService),
    __param(3, IContextKeyService),
    __param(4, IProductService),
    __param(5, IStorageService),
    __param(6, ILoggerService),
    __param(7, IQuickInputService),
    __param(8, INativeEnvironmentService),
    __param(9, IRemoteTunnelService),
    __param(10, ICommandService),
    __param(11, IWorkspaceContextService),
    __param(12, IProgressService),
    __param(13, INotificationService)
], RemoteTunnelWorkbenchContribution);
export { RemoteTunnelWorkbenchContribution };
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(RemoteTunnelWorkbenchContribution, 3 /* LifecyclePhase.Restored */);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
    type: 'object',
    properties: {
        [CONFIGURATION_KEY_HOST_NAME]: {
            description: localize('remoteTunnelAccess.machineName', "The name under which the remote tunnel access is registered. If not set, the host name is used."),
            type: 'string',
            scope: 1 /* ConfigurationScope.APPLICATION */,
            ignoreSync: true,
            pattern: '^(\\w[\\w-]*)?$',
            patternErrorMessage: localize('remoteTunnelAccess.machineNameRegex', "The name must only consist of letters, numbers, underscore and dash. It must not start with a dash."),
            maxLength: 20,
            default: ''
        },
        [CONFIGURATION_KEY_PREVENT_SLEEP]: {
            description: localize('remoteTunnelAccess.preventSleep', "Prevent this computer from sleeping when remote tunnel access is turned on."),
            type: 'boolean',
            scope: 1 /* ConfigurationScope.APPLICATION */,
            default: false,
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVtb3RlVHVubmVsLmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9yZW1vdGVUdW5uZWwvZWxlY3Ryb24tYnJvd3Nlci9yZW1vdGVUdW5uZWwuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUU3RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDaEYsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDbEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDOUYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxVQUFVLElBQUksdUJBQXVCLEVBQThDLE1BQU0sb0VBQW9FLENBQUM7QUFDdkssT0FBTyxFQUFFLGNBQWMsRUFBZSxrQkFBa0IsRUFBRSxhQUFhLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN0SSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEYs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