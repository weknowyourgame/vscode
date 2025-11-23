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
var ProductContribution_1;
import * as nls from '../../../../nls.js';
import severity from '../../../../base/common/severity.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IActivityService, NumberBadge, ProgressBadge } from '../../../services/activity/common/activity.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IUpdateService } from '../../../../platform/update/common/update.js';
import { INotificationService, NotificationPriority, Severity } from '../../../../platform/notification/common/notification.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IBrowserWorkbenchEnvironmentService } from '../../../services/environment/browser/environmentService.js';
import { ReleaseNotesManager } from './releaseNotesEditor.js';
import { isMacintosh, isWeb, isWindows } from '../../../../base/common/platform.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { RawContextKey, IContextKeyService, ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { MenuRegistry, MenuId, registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IUserDataSyncEnablementService, IUserDataSyncService, IUserDataSyncStoreManagementService } from '../../../../platform/userDataSync/common/userDataSync.js';
import { IsWebContext } from '../../../../platform/contextkey/common/contextkeys.js';
import { Promises } from '../../../../base/common/async.js';
import { IUserDataSyncWorkbenchService } from '../../../services/userDataSync/common/userDataSync.js';
import { Event } from '../../../../base/common/event.js';
import { toAction } from '../../../../base/common/actions.js';
export const CONTEXT_UPDATE_STATE = new RawContextKey('updateState', "uninitialized" /* StateType.Uninitialized */);
export const MAJOR_MINOR_UPDATE_AVAILABLE = new RawContextKey('majorMinorUpdateAvailable', false);
export const RELEASE_NOTES_URL = new RawContextKey('releaseNotesUrl', '');
export const DOWNLOAD_URL = new RawContextKey('downloadUrl', '');
let releaseNotesManager = undefined;
export function showReleaseNotesInEditor(instantiationService, version, useCurrentFile) {
    if (!releaseNotesManager) {
        releaseNotesManager = instantiationService.createInstance(ReleaseNotesManager);
    }
    return releaseNotesManager.show(version, useCurrentFile);
}
async function openLatestReleaseNotesInBrowser(accessor) {
    const openerService = accessor.get(IOpenerService);
    const productService = accessor.get(IProductService);
    if (productService.releaseNotesUrl) {
        const uri = URI.parse(productService.releaseNotesUrl);
        await openerService.open(uri);
    }
    else {
        throw new Error(nls.localize('update.noReleaseNotesOnline', "This version of {0} does not have release notes online", productService.nameLong));
    }
}
async function showReleaseNotes(accessor, version) {
    const instantiationService = accessor.get(IInstantiationService);
    try {
        await showReleaseNotesInEditor(instantiationService, version, false);
    }
    catch (err) {
        try {
            await instantiationService.invokeFunction(openLatestReleaseNotesInBrowser);
        }
        catch (err2) {
            throw new Error(`${err.message} and ${err2.message}`);
        }
    }
}
function parseVersion(version) {
    const match = /([0-9]+)\.([0-9]+)\.([0-9]+)/.exec(version);
    if (!match) {
        return undefined;
    }
    return {
        major: parseInt(match[1]),
        minor: parseInt(match[2]),
        patch: parseInt(match[3])
    };
}
function isMajorMinorUpdate(before, after) {
    return before.major < after.major || before.minor < after.minor;
}
let ProductContribution = class ProductContribution {
    static { ProductContribution_1 = this; }
    static { this.KEY = 'releaseNotes/lastVersion'; }
    constructor(storageService, instantiationService, notificationService, environmentService, openerService, configurationService, hostService, productService, contextKeyService) {
        if (productService.releaseNotesUrl) {
            const releaseNotesUrlKey = RELEASE_NOTES_URL.bindTo(contextKeyService);
            releaseNotesUrlKey.set(productService.releaseNotesUrl);
        }
        if (productService.downloadUrl) {
            const downloadUrlKey = DOWNLOAD_URL.bindTo(contextKeyService);
            downloadUrlKey.set(productService.downloadUrl);
        }
        if (isWeb) {
            return;
        }
        hostService.hadLastFocus().then(async (hadLastFocus) => {
            if (!hadLastFocus) {
                return;
            }
            const lastVersion = parseVersion(storageService.get(ProductContribution_1.KEY, -1 /* StorageScope.APPLICATION */, ''));
            const currentVersion = parseVersion(productService.version);
            const shouldShowReleaseNotes = configurationService.getValue('update.showReleaseNotes');
            const releaseNotesUrl = productService.releaseNotesUrl;
            // was there a major/minor update? if so, open release notes
            if (shouldShowReleaseNotes && !environmentService.skipReleaseNotes && releaseNotesUrl && lastVersion && currentVersion && isMajorMinorUpdate(lastVersion, currentVersion)) {
                showReleaseNotesInEditor(instantiationService, productService.version, false)
                    .then(undefined, () => {
                    notificationService.prompt(severity.Info, nls.localize('read the release notes', "Welcome to {0} v{1}! Would you like to read the Release Notes?", productService.nameLong, productService.version), [{
                            label: nls.localize('releaseNotes', "Release Notes"),
                            run: () => {
                                const uri = URI.parse(releaseNotesUrl);
                                openerService.open(uri);
                            }
                        }], { priority: NotificationPriority.OPTIONAL });
                });
            }
            storageService.store(ProductContribution_1.KEY, productService.version, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
        });
    }
};
ProductContribution = ProductContribution_1 = __decorate([
    __param(0, IStorageService),
    __param(1, IInstantiationService),
    __param(2, INotificationService),
    __param(3, IBrowserWorkbenchEnvironmentService),
    __param(4, IOpenerService),
    __param(5, IConfigurationService),
    __param(6, IHostService),
    __param(7, IProductService),
    __param(8, IContextKeyService)
], ProductContribution);
export { ProductContribution };
let UpdateContribution = class UpdateContribution extends Disposable {
    constructor(storageService, instantiationService, notificationService, dialogService, updateService, activityService, contextKeyService, productService, openerService, configurationService, hostService) {
        super();
        this.storageService = storageService;
        this.instantiationService = instantiationService;
        this.notificationService = notificationService;
        this.dialogService = dialogService;
        this.updateService = updateService;
        this.activityService = activityService;
        this.contextKeyService = contextKeyService;
        this.productService = productService;
        this.openerService = openerService;
        this.configurationService = configurationService;
        this.hostService = hostService;
        this.badgeDisposable = this._register(new MutableDisposable());
        this.state = updateService.state;
        this.updateStateContextKey = CONTEXT_UPDATE_STATE.bindTo(this.contextKeyService);
        this.majorMinorUpdateAvailableContextKey = MAJOR_MINOR_UPDATE_AVAILABLE.bindTo(this.contextKeyService);
        this._register(updateService.onStateChange(this.onUpdateStateChange, this));
        this.onUpdateStateChange(this.updateService.state);
        /*
        The `update/lastKnownVersion` and `update/updateNotificationTime` storage keys are used in
        combination to figure out when to show a message to the user that he should update.

        This message should appear if the user has received an update notification but hasn't
        updated since 5 days.
        */
        const currentVersion = this.productService.commit;
        const lastKnownVersion = this.storageService.get('update/lastKnownVersion', -1 /* StorageScope.APPLICATION */);
        // if current version != stored version, clear both fields
        if (currentVersion !== lastKnownVersion) {
            this.storageService.remove('update/lastKnownVersion', -1 /* StorageScope.APPLICATION */);
            this.storageService.remove('update/updateNotificationTime', -1 /* StorageScope.APPLICATION */);
        }
        this.registerGlobalActivityActions();
    }
    async onUpdateStateChange(state) {
        this.updateStateContextKey.set(state.type);
        switch (state.type) {
            case "disabled" /* StateType.Disabled */:
                if (state.reason === 5 /* DisablementReason.RunningAsAdmin */) {
                    this.notificationService.notify({
                        severity: Severity.Info,
                        message: nls.localize('update service disabled', "Updates are disabled because you are running the user-scope installation of {0} as Administrator.", this.productService.nameLong),
                        actions: {
                            primary: [
                                toAction({
                                    id: '',
                                    label: nls.localize('learn more', "Learn More"),
                                    run: () => this.openerService.open('https://aka.ms/vscode-windows-setup')
                                })
                            ]
                        },
                        neverShowAgain: { id: 'no-updates-running-as-admin', }
                    });
                }
                break;
            case "idle" /* StateType.Idle */:
                if (state.error) {
                    this.onError(state.error);
                }
                else if (this.state.type === "checking for updates" /* StateType.CheckingForUpdates */ && this.state.explicit && await this.hostService.hadLastFocus()) {
                    this.onUpdateNotAvailable();
                }
                break;
            case "available for download" /* StateType.AvailableForDownload */:
                this.onUpdateAvailable(state.update);
                break;
            case "downloaded" /* StateType.Downloaded */:
                this.onUpdateDownloaded(state.update);
                break;
            case "ready" /* StateType.Ready */: {
                const productVersion = state.update.productVersion;
                if (productVersion) {
                    const currentVersion = parseVersion(this.productService.version);
                    const nextVersion = parseVersion(productVersion);
                    this.majorMinorUpdateAvailableContextKey.set(Boolean(currentVersion && nextVersion && isMajorMinorUpdate(currentVersion, nextVersion)));
                    this.onUpdateReady(state.update);
                }
                break;
            }
        }
        let badge = undefined;
        if (state.type === "available for download" /* StateType.AvailableForDownload */ || state.type === "downloaded" /* StateType.Downloaded */ || state.type === "ready" /* StateType.Ready */) {
            badge = new NumberBadge(1, () => nls.localize('updateIsReady', "New {0} update available.", this.productService.nameShort));
        }
        else if (state.type === "checking for updates" /* StateType.CheckingForUpdates */) {
            badge = new ProgressBadge(() => nls.localize('checkingForUpdates', "Checking for {0} updates...", this.productService.nameShort));
        }
        else if (state.type === "downloading" /* StateType.Downloading */) {
            badge = new ProgressBadge(() => nls.localize('downloading', "Downloading {0} update...", this.productService.nameShort));
        }
        else if (state.type === "updating" /* StateType.Updating */) {
            badge = new ProgressBadge(() => nls.localize('updating', "Updating {0}...", this.productService.nameShort));
        }
        this.badgeDisposable.clear();
        if (badge) {
            this.badgeDisposable.value = this.activityService.showGlobalActivity({ badge });
        }
        this.state = state;
    }
    onError(error) {
        if (/The request timed out|The network connection was lost/i.test(error)) {
            return;
        }
        error = error.replace(/See https:\/\/github\.com\/Squirrel\/Squirrel\.Mac\/issues\/182 for more information/, 'This might mean the application was put on quarantine by macOS. See [this link](https://github.com/microsoft/vscode/issues/7426#issuecomment-425093469) for more information');
        this.notificationService.notify({
            severity: Severity.Error,
            message: error,
            source: nls.localize('update service', "Update Service"),
        });
    }
    onUpdateNotAvailable() {
        this.dialogService.info(nls.localize('noUpdatesAvailable', "There are currently no updates available."));
    }
    // linux
    onUpdateAvailable(update) {
        if (!this.shouldShowNotification()) {
            return;
        }
        const productVersion = update.productVersion;
        if (!productVersion) {
            return;
        }
        this.notificationService.prompt(severity.Info, nls.localize('thereIsUpdateAvailable', "There is an available update."), [{
                label: nls.localize('download update', "Download Update"),
                run: () => this.updateService.downloadUpdate()
            }, {
                label: nls.localize('later', "Later"),
                run: () => { }
            }, {
                label: nls.localize('releaseNotes', "Release Notes"),
                run: () => {
                    this.instantiationService.invokeFunction(accessor => showReleaseNotes(accessor, productVersion));
                }
            }], { priority: NotificationPriority.OPTIONAL });
    }
    // windows fast updates
    onUpdateDownloaded(update) {
        if (isMacintosh) {
            return;
        }
        if (this.configurationService.getValue('update.enableWindowsBackgroundUpdates') && this.productService.target === 'user') {
            return;
        }
        if (!this.shouldShowNotification()) {
            return;
        }
        const productVersion = update.productVersion;
        if (!productVersion) {
            return;
        }
        this.notificationService.prompt(severity.Info, nls.localize('updateAvailable', "There's an update available: {0} {1}", this.productService.nameLong, productVersion), [{
                label: nls.localize('installUpdate', "Install Update"),
                run: () => this.updateService.applyUpdate()
            }, {
                label: nls.localize('later', "Later"),
                run: () => { }
            }, {
                label: nls.localize('releaseNotes', "Release Notes"),
                run: () => {
                    this.instantiationService.invokeFunction(accessor => showReleaseNotes(accessor, productVersion));
                }
            }], { priority: NotificationPriority.OPTIONAL });
    }
    // windows and mac
    onUpdateReady(update) {
        if (!(isWindows && this.productService.target !== 'user') && !this.shouldShowNotification()) {
            return;
        }
        const actions = [{
                label: nls.localize('updateNow', "Update Now"),
                run: () => this.updateService.quitAndInstall()
            }, {
                label: nls.localize('later', "Later"),
                run: () => { }
            }];
        const productVersion = update.productVersion;
        if (productVersion) {
            actions.push({
                label: nls.localize('releaseNotes', "Release Notes"),
                run: () => {
                    this.instantiationService.invokeFunction(accessor => showReleaseNotes(accessor, productVersion));
                }
            });
        }
        // windows user fast updates and mac
        this.notificationService.prompt(severity.Info, nls.localize('updateAvailableAfterRestart', "Restart {0} to apply the latest update.", this.productService.nameLong), actions, {
            sticky: true,
            priority: NotificationPriority.OPTIONAL
        });
    }
    shouldShowNotification() {
        const currentVersion = this.productService.commit;
        const currentMillis = new Date().getTime();
        const lastKnownVersion = this.storageService.get('update/lastKnownVersion', -1 /* StorageScope.APPLICATION */);
        // if version != stored version, save version and date
        if (currentVersion !== lastKnownVersion) {
            this.storageService.store('update/lastKnownVersion', currentVersion, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
            this.storageService.store('update/updateNotificationTime', currentMillis, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
        }
        const updateNotificationMillis = this.storageService.getNumber('update/updateNotificationTime', -1 /* StorageScope.APPLICATION */, currentMillis);
        const diffDays = (currentMillis - updateNotificationMillis) / (1000 * 60 * 60 * 24);
        return diffDays > 5;
    }
    registerGlobalActivityActions() {
        CommandsRegistry.registerCommand('update.check', () => this.updateService.checkForUpdates(true));
        MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
            group: '7_update',
            command: {
                id: 'update.check',
                title: nls.localize('checkForUpdates', "Check for Updates...")
            },
            when: CONTEXT_UPDATE_STATE.isEqualTo("idle" /* StateType.Idle */)
        });
        CommandsRegistry.registerCommand('update.checking', () => { });
        MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
            group: '7_update',
            command: {
                id: 'update.checking',
                title: nls.localize('checkingForUpdates2', "Checking for Updates..."),
                precondition: ContextKeyExpr.false()
            },
            when: CONTEXT_UPDATE_STATE.isEqualTo("checking for updates" /* StateType.CheckingForUpdates */)
        });
        CommandsRegistry.registerCommand('update.downloadNow', () => this.updateService.downloadUpdate());
        MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
            group: '7_update',
            command: {
                id: 'update.downloadNow',
                title: nls.localize('download update_1', "Download Update (1)")
            },
            when: CONTEXT_UPDATE_STATE.isEqualTo("available for download" /* StateType.AvailableForDownload */)
        });
        CommandsRegistry.registerCommand('update.downloading', () => { });
        MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
            group: '7_update',
            command: {
                id: 'update.downloading',
                title: nls.localize('DownloadingUpdate', "Downloading Update..."),
                precondition: ContextKeyExpr.false()
            },
            when: CONTEXT_UPDATE_STATE.isEqualTo("downloading" /* StateType.Downloading */)
        });
        CommandsRegistry.registerCommand('update.install', () => this.updateService.applyUpdate());
        MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
            group: '7_update',
            command: {
                id: 'update.install',
                title: nls.localize('installUpdate...', "Install Update... (1)")
            },
            when: CONTEXT_UPDATE_STATE.isEqualTo("downloaded" /* StateType.Downloaded */)
        });
        CommandsRegistry.registerCommand('update.updating', () => { });
        MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
            group: '7_update',
            command: {
                id: 'update.updating',
                title: nls.localize('installingUpdate', "Installing Update..."),
                precondition: ContextKeyExpr.false()
            },
            when: CONTEXT_UPDATE_STATE.isEqualTo("updating" /* StateType.Updating */)
        });
        if (this.productService.quality === 'stable') {
            CommandsRegistry.registerCommand('update.showUpdateReleaseNotes', () => {
                if (this.updateService.state.type !== "ready" /* StateType.Ready */) {
                    return;
                }
                const productVersion = this.updateService.state.update.productVersion;
                if (productVersion) {
                    this.instantiationService.invokeFunction(accessor => showReleaseNotes(accessor, productVersion));
                }
            });
            MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
                group: '7_update',
                order: 1,
                command: {
                    id: 'update.showUpdateReleaseNotes',
                    title: nls.localize('showUpdateReleaseNotes', "Show Update Release Notes")
                },
                when: ContextKeyExpr.and(CONTEXT_UPDATE_STATE.isEqualTo("ready" /* StateType.Ready */), MAJOR_MINOR_UPDATE_AVAILABLE)
            });
        }
        CommandsRegistry.registerCommand('update.restart', () => this.updateService.quitAndInstall());
        MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
            group: '7_update',
            order: 2,
            command: {
                id: 'update.restart',
                title: nls.localize('restartToUpdate', "Restart to Update (1)")
            },
            when: CONTEXT_UPDATE_STATE.isEqualTo("ready" /* StateType.Ready */)
        });
        CommandsRegistry.registerCommand('_update.state', () => {
            return this.state;
        });
    }
};
UpdateContribution = __decorate([
    __param(0, IStorageService),
    __param(1, IInstantiationService),
    __param(2, INotificationService),
    __param(3, IDialogService),
    __param(4, IUpdateService),
    __param(5, IActivityService),
    __param(6, IContextKeyService),
    __param(7, IProductService),
    __param(8, IOpenerService),
    __param(9, IConfigurationService),
    __param(10, IHostService)
], UpdateContribution);
export { UpdateContribution };
let SwitchProductQualityContribution = class SwitchProductQualityContribution extends Disposable {
    constructor(productService, environmentService) {
        super();
        this.productService = productService;
        this.environmentService = environmentService;
        this.registerGlobalActivityActions();
    }
    registerGlobalActivityActions() {
        const quality = this.productService.quality;
        const productQualityChangeHandler = this.environmentService.options?.productQualityChangeHandler;
        if (productQualityChangeHandler && (quality === 'stable' || quality === 'insider')) {
            const newQuality = quality === 'stable' ? 'insider' : 'stable';
            const commandId = `update.switchQuality.${newQuality}`;
            const isSwitchingToInsiders = newQuality === 'insider';
            this._register(registerAction2(class SwitchQuality extends Action2 {
                constructor() {
                    super({
                        id: commandId,
                        title: isSwitchingToInsiders ? nls.localize('switchToInsiders', "Switch to Insiders Version...") : nls.localize('switchToStable', "Switch to Stable Version..."),
                        precondition: IsWebContext,
                        menu: {
                            id: MenuId.GlobalActivity,
                            when: IsWebContext,
                            group: '7_update',
                        }
                    });
                }
                async run(accessor) {
                    const dialogService = accessor.get(IDialogService);
                    const userDataSyncEnablementService = accessor.get(IUserDataSyncEnablementService);
                    const userDataSyncStoreManagementService = accessor.get(IUserDataSyncStoreManagementService);
                    const storageService = accessor.get(IStorageService);
                    const userDataSyncWorkbenchService = accessor.get(IUserDataSyncWorkbenchService);
                    const userDataSyncService = accessor.get(IUserDataSyncService);
                    const notificationService = accessor.get(INotificationService);
                    try {
                        const selectSettingsSyncServiceDialogShownKey = 'switchQuality.selectSettingsSyncServiceDialogShown';
                        const userDataSyncStore = userDataSyncStoreManagementService.userDataSyncStore;
                        let userDataSyncStoreType;
                        if (userDataSyncStore && isSwitchingToInsiders && userDataSyncEnablementService.isEnabled()
                            && !storageService.getBoolean(selectSettingsSyncServiceDialogShownKey, -1 /* StorageScope.APPLICATION */, false)) {
                            userDataSyncStoreType = await this.selectSettingsSyncService(dialogService);
                            if (!userDataSyncStoreType) {
                                return;
                            }
                            storageService.store(selectSettingsSyncServiceDialogShownKey, true, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
                            if (userDataSyncStoreType === 'stable') {
                                // Update the stable service type in the current window, so that it uses stable service after switched to insiders version (after reload).
                                await userDataSyncStoreManagementService.switch(userDataSyncStoreType);
                            }
                        }
                        const res = await dialogService.confirm({
                            type: 'info',
                            message: nls.localize('relaunchMessage', "Changing the version requires a reload to take effect"),
                            detail: newQuality === 'insider' ?
                                nls.localize('relaunchDetailInsiders', "Press the reload button to switch to the Insiders version of VS Code.") :
                                nls.localize('relaunchDetailStable', "Press the reload button to switch to the Stable version of VS Code."),
                            primaryButton: nls.localize({ key: 'reload', comment: ['&& denotes a mnemonic'] }, "&&Reload")
                        });
                        if (res.confirmed) {
                            const promises = [];
                            // If sync is happening wait until it is finished before reload
                            if (userDataSyncService.status === "syncing" /* SyncStatus.Syncing */) {
                                promises.push(Event.toPromise(Event.filter(userDataSyncService.onDidChangeStatus, status => status !== "syncing" /* SyncStatus.Syncing */)));
                            }
                            // If user chose the sync service then synchronise the store type option in insiders service, so that other clients using insiders service are also updated.
                            if (isSwitchingToInsiders && userDataSyncStoreType) {
                                promises.push(userDataSyncWorkbenchService.synchroniseUserDataSyncStoreType());
                            }
                            await Promises.settled(promises);
                            productQualityChangeHandler(newQuality);
                        }
                        else {
                            // Reset
                            if (userDataSyncStoreType) {
                                storageService.remove(selectSettingsSyncServiceDialogShownKey, -1 /* StorageScope.APPLICATION */);
                            }
                        }
                    }
                    catch (error) {
                        notificationService.error(error);
                    }
                }
                async selectSettingsSyncService(dialogService) {
                    const { result } = await dialogService.prompt({
                        type: Severity.Info,
                        message: nls.localize('selectSyncService.message', "Choose the settings sync service to use after changing the version"),
                        detail: nls.localize('selectSyncService.detail', "The Insiders version of VS Code will synchronize your settings, keybindings, extensions, snippets and UI State using separate insiders settings sync service by default."),
                        buttons: [
                            {
                                label: nls.localize({ key: 'use insiders', comment: ['&& denotes a mnemonic'] }, "&&Insiders"),
                                run: () => 'insiders'
                            },
                            {
                                label: nls.localize({ key: 'use stable', comment: ['&& denotes a mnemonic'] }, "&&Stable (current)"),
                                run: () => 'stable'
                            }
                        ],
                        cancelButton: true
                    });
                    return result;
                }
            }));
        }
    }
};
SwitchProductQualityContribution = __decorate([
    __param(0, IProductService),
    __param(1, IBrowserWorkbenchEnvironmentService)
], SwitchProductQualityContribution);
export { SwitchProductQualityContribution };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBkYXRlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3VwZGF0ZS9icm93c2VyL3VwZGF0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUMxQyxPQUFPLFFBQVEsTUFBTSxxQ0FBcUMsQ0FBQztBQUMzRCxPQUFPLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDckYsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxXQUFXLEVBQVUsYUFBYSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDckgsT0FBTyxFQUFFLHFCQUFxQixFQUFvQixNQUFNLDREQUE0RCxDQUFDO0FBQ3JILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUU5RSxPQUFPLEVBQUUsZUFBZSxFQUErQixNQUFNLGdEQUFnRCxDQUFDO0FBQzlHLE9BQU8sRUFBRSxjQUFjLEVBQStELE1BQU0sOENBQThDLENBQUM7QUFDM0ksT0FBTyxFQUFFLG9CQUFvQixFQUFFLG9CQUFvQixFQUFFLFFBQVEsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQ2hJLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNoRixPQUFPLEVBQUUsbUNBQW1DLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUNsSCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUM5RCxPQUFPLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNwRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQs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