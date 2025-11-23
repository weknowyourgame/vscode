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
import { getErrorMessage, isCancellationError } from '../../../../base/common/errors.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { isEqual } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { localize, localize2 } from '../../../../nls.js';
import { MenuId, MenuRegistry, registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ContextKeyExpr, ContextKeyTrueExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IUserDataAutoSyncService, IUserDataSyncService, registerConfiguration, UserDataSyncError, USER_DATA_SYNC_SCHEME, IUserDataSyncEnablementService, IUserDataSyncStoreManagementService, USER_DATA_SYNC_LOG_ID } from '../../../../platform/userDataSync/common/userDataSync.js';
import { EditorResourceAccessor, SideBySideEditor } from '../../../common/editor.js';
import { IOutputService } from '../../../services/output/common/output.js';
import { IActivityService, NumberBadge, ProgressBadge } from '../../../services/activity/common/activity.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { fromNow } from '../../../../base/common/date.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Extensions } from '../../../common/views.js';
import { UserDataSyncDataViews } from './userDataSyncViews.js';
import { IUserDataSyncWorkbenchService, getSyncAreaLabel, CONTEXT_SYNC_STATE, CONTEXT_SYNC_ENABLEMENT, CONTEXT_ACCOUNT_STATE, CONFIGURE_SYNC_COMMAND_ID, SHOW_SYNC_LOG_COMMAND_ID, SYNC_VIEW_CONTAINER_ID, SYNC_TITLE, SYNC_VIEW_ICON, CONTEXT_HAS_CONFLICTS, DOWNLOAD_ACTIVITY_ACTION_DESCRIPTOR } from '../../../services/userDataSync/common/userDataSync.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { ctxIsMergeResultEditor, ctxMergeBaseUri } from '../../mergeEditor/common/mergeEditor.js';
import { IWorkbenchIssueService } from '../../issue/common/issue.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { isWeb } from '../../../../base/common/platform.js';
const turnOffSyncCommand = { id: 'workbench.userDataSync.actions.turnOff', title: localize2('stop sync', 'Turn Off') };
const configureSyncCommand = { id: CONFIGURE_SYNC_COMMAND_ID, title: localize2('configure sync', 'Configure...') };
const showConflictsCommandId = 'workbench.userDataSync.actions.showConflicts';
const syncNowCommand = {
    id: 'workbench.userDataSync.actions.syncNow',
    title: localize2('sync now', 'Sync Now'),
    description(userDataSyncService) {
        if (userDataSyncService.status === "syncing" /* SyncStatus.Syncing */) {
            return localize('syncing', "syncing");
        }
        if (userDataSyncService.lastSyncTime) {
            return localize('synced with time', "synced {0}", fromNow(userDataSyncService.lastSyncTime, true));
        }
        return undefined;
    }
};
const showSyncSettingsCommand = { id: 'workbench.userDataSync.actions.settings', title: localize2('sync settings', 'Show Settings'), };
const showSyncedDataCommand = { id: 'workbench.userDataSync.actions.showSyncedData', title: localize2('show synced data', 'Show Synced Data'), };
const CONTEXT_TURNING_ON_STATE = new RawContextKey('userDataSyncTurningOn', false);
let UserDataSyncWorkbenchContribution = class UserDataSyncWorkbenchContribution extends Disposable {
    constructor(userDataSyncEnablementService, userDataSyncService, userDataSyncWorkbenchService, contextKeyService, activityService, notificationService, editorService, userDataProfileService, dialogService, quickInputService, instantiationService, outputService, userDataAutoSyncService, textModelResolverService, preferencesService, telemetryService, productService, openerService, authenticationService, userDataSyncStoreManagementService, hostService, commandService, workbenchIssueService) {
        super();
        this.userDataSyncEnablementService = userDataSyncEnablementService;
        this.userDataSyncService = userDataSyncService;
        this.userDataSyncWorkbenchService = userDataSyncWorkbenchService;
        this.activityService = activityService;
        this.notificationService = notificationService;
        this.editorService = editorService;
        this.userDataProfileService = userDataProfileService;
        this.dialogService = dialogService;
        this.quickInputService = quickInputService;
        this.instantiationService = instantiationService;
        this.outputService = outputService;
        this.preferencesService = preferencesService;
        this.telemetryService = telemetryService;
        this.productService = productService;
        this.openerService = openerService;
        this.authenticationService = authenticationService;
        this.userDataSyncStoreManagementService = userDataSyncStoreManagementService;
        this.hostService = hostService;
        this.commandService = commandService;
        this.workbenchIssueService = workbenchIssueService;
        this.globalActivityBadgeDisposable = this._register(new MutableDisposable());
        this.accountBadgeDisposable = this._register(new MutableDisposable());
        this.conflictsDisposables = new Map();
        this.invalidContentErrorDisposables = new Map();
        this.conflictsActionDisposable = this._register(new MutableDisposable());
        this.turningOnSyncContext = CONTEXT_TURNING_ON_STATE.bindTo(contextKeyService);
        if (userDataSyncWorkbenchService.enabled) {
            registerConfiguration();
            this.updateAccountBadge();
            this.updateGlobalActivityBadge();
            this.onDidChangeConflicts(this.userDataSyncService.conflicts);
            this._register(Event.any(Event.debounce(userDataSyncService.onDidChangeStatus, () => undefined, 500), this.userDataSyncEnablementService.onDidChangeEnablement, this.userDataSyncWorkbenchService.onDidChangeAccountStatus)(() => {
                this.updateAccountBadge();
                this.updateGlobalActivityBadge();
            }));
            this._register(userDataSyncService.onDidChangeConflicts(() => this.onDidChangeConflicts(this.userDataSyncService.conflicts)));
            this._register(userDataSyncEnablementService.onDidChangeEnablement(() => this.onDidChangeConflicts(this.userDataSyncService.conflicts)));
            this._register(userDataSyncService.onSyncErrors(errors => this.onSynchronizerErrors(errors)));
            this._register(userDataAutoSyncService.onError(error => this.onAutoSyncError(error)));
            this.registerActions();
            this.registerViews();
            textModelResolverService.registerTextModelContentProvider(USER_DATA_SYNC_SCHEME, instantiationService.createInstance(UserDataRemoteContentProvider));
            this._register(Event.any(userDataSyncService.onDidChangeStatus, userDataSyncEnablementService.onDidChangeEnablement)(() => this.turningOnSync = !userDataSyncEnablementService.isEnabled() && userDataSyncService.status !== "idle" /* SyncStatus.Idle */));
        }
    }
    get turningOnSync() {
        return !!this.turningOnSyncContext.get();
    }
    set turningOnSync(turningOn) {
        this.turningOnSyncContext.set(turningOn);
        this.updateGlobalActivityBadge();
    }
    toKey({ syncResource: resource, profile }) {
        return `${profile.id}:${resource}`;
    }
    onDidChangeConflicts(conflicts) {
        this.updateGlobalActivityBadge();
        this.registerShowConflictsAction();
        if (!this.userDataSyncEnablementService.isEnabled()) {
            return;
        }
        if (conflicts.length) {
            // Clear and dispose conflicts those were cleared
            for (const [key, disposable] of this.conflictsDisposables.entries()) {
                if (!conflicts.some(conflict => this.toKey(conflict) === key)) {
                    disposable.dispose();
                    this.conflictsDisposables.delete(key);
                }
            }
            for (const conflict of this.userDataSyncService.conflicts) {
                const key = this.toKey(conflict);
                // Show conflicts notification if not shown before
                if (!this.conflictsDisposables.has(key)) {
                    const conflictsArea = getSyncAreaLabel(conflict.syncResource);
                    const handle = this.notificationService.prompt(Severity.Warning, localize('conflicts detected', "Unable to sync due to conflicts in {0}. Please resolve them to continue.", conflictsArea.toLowerCase()), [
                        {
                            label: localize('replace remote', "Replace Remote"),
                            run: () => {
                                this.acceptLocal(conflict, conflict.conflicts[0]);
                            }
                        },
                        {
                            label: localize('replace local', "Replace Local"),
                            run: () => {
                                this.acceptRemote(conflict, conflict.conflicts[0]);
                            }
                        },
                        {
                            label: localize('show conflicts', "Show Conflicts"),
                            run: () => {
                                this.telemetryService.publicLog2('sync/showConflicts', { source: conflict.syncResource });
                                this.userDataSyncWorkbenchService.showConflicts(conflict.conflicts[0]);
                            }
                        }
                    ], {
                        sticky: true
                    });
                    this.conflictsDisposables.set(key, toDisposable(() => {
                        // close the conflicts warning notification
                        handle.close();
                        this.conflictsDisposables.delete(key);
                    }));
                }
            }
        }
        else {
            this.conflictsDisposables.forEach(disposable => disposable.dispose());
            this.conflictsDisposables.clear();
        }
    }
    async acceptRemote(syncResource, conflict) {
        try {
            await this.userDataSyncService.accept(syncResource, conflict.remoteResource, undefined, this.userDataSyncEnablementService.isEnabled());
        }
        catch (e) {
            this.notificationService.error(localize('accept failed', "Error while accepting changes. Please check [logs]({0}) for more details.", `command:${SHOW_SYNC_LOG_COMMAND_ID}`));
        }
    }
    async acceptLocal(syncResource, conflict) {
        try {
            await this.userDataSyncService.accept(syncResource, conflict.localResource, undefined, this.userDataSyncEnablementService.isEnabled());
        }
        catch (e) {
            this.notificationService.error(localize('accept failed', "Error while accepting changes. Please check [logs]({0}) for more details.", `command:${SHOW_SYNC_LOG_COMMAND_ID}`));
        }
    }
    onAutoSyncError(error) {
        switch (error.code) {
            case "SessionExpired" /* UserDataSyncErrorCode.SessionExpired */:
                this.notificationService.notify({
                    severity: Severity.Info,
                    message: localize('session expired', "Settings sync was turned off because current session is expired, please sign in again to turn on sync."),
                    actions: {
                        primary: [toAction({
                                id: 'turn on sync',
                                label: localize('turn on sync', "Turn on Settings Sync..."),
                                run: () => this.turnOn()
                            })]
                    }
                });
                break;
            case "TurnedOff" /* UserDataSyncErrorCode.TurnedOff */:
                this.notificationService.notify({
                    severity: Severity.Info,
                    message: localize('turned off', "Settings sync was turned off from another device, please turn on sync again."),
                    actions: {
                        primary: [toAction({
                                id: 'turn on sync',
                                label: localize('turn on sync', "Turn on Settings Sync..."),
                                run: () => this.turnOn()
                            })]
                    }
                });
                break;
            case "TooLarge" /* UserDataSyncErrorCode.TooLarge */:
                if (error.resource === "keybindings" /* SyncResource.Keybindings */ || error.resource === "settings" /* SyncResource.Settings */ || error.resource === "tasks" /* SyncResource.Tasks */) {
                    this.disableSync(error.resource);
                    const sourceArea = getSyncAreaLabel(error.resource);
                    this.handleTooLargeError(error.resource, localize('too large', "Disabled syncing {0} because size of the {1} file to sync is larger than {2}. Please open the file and reduce the size and enable sync", sourceArea.toLowerCase(), sourceArea.toLowerCase(), '100kb'), error);
                }
                break;
            case "LocalTooManyProfiles" /* UserDataSyncErrorCode.LocalTooManyProfiles */:
                this.disableSync("profiles" /* SyncResource.Profiles */);
                this.notificationService.error(localize('too many profiles', "Disabled syncing profiles because there are too many profiles to sync. Settings Sync supports syncing maximum 20 profiles. Please reduce the number of profiles and enable sync"));
                break;
            case "IncompatibleLocalContent" /* UserDataSyncErrorCode.IncompatibleLocalContent */:
            case "Gone" /* UserDataSyncErrorCode.Gone */:
            case "UpgradeRequired" /* UserDataSyncErrorCode.UpgradeRequired */: {
                const message = localize('error upgrade required', "Settings sync is disabled because the current version ({0}, {1}) is not compatible with the sync service. Please update before turning on sync.", this.productService.version, this.productService.commit);
                const operationId = error.operationId ? localize('operationId', "Operation Id: {0}", error.operationId) : undefined;
                this.notificationService.notify({
                    severity: Severity.Error,
                    message: operationId ? `${message} ${operationId}` : message,
                });
                break;
            }
            case "MethodNotFound" /* UserDataSyncErrorCode.MethodNotFound */: {
                const message = localize('method not found', "Settings sync is disabled because the client is making invalid requests. Please report an issue with the logs.");
                const operationId = error.operationId ? localize('operationId', "Operation Id: {0}", error.operationId) : undefined;
                this.notificationService.notify({
                    severity: Severity.Error,
                    message: operationId ? `${message} ${operationId}` : message,
                    actions: {
                        primary: [
                            toAction({
                                id: 'Show Sync Logs',
                                label: localize('show sync logs', "Show Log"),
                                run: () => this.commandService.executeCommand(SHOW_SYNC_LOG_COMMAND_ID)
                            }),
                            toAction({
                                id: 'Report Issue',
                                label: localize('report issue', "Report Issue"),
                                run: () => this.workbenchIssueService.openReporter()
                            })
                        ]
                    }
                });
                break;
            }
            case "IncompatibleRemoteContent" /* UserDataSyncErrorCode.IncompatibleRemoteContent */:
                this.notificationService.notify({
                    severity: Severity.Error,
                    message: localize('error reset required', "Settings sync is disabled because your data in the cloud is older than that of the client. Please clear your data in the cloud before turning on sync."),
                    actions: {
                        primary: [
                            toAction({
                                id: 'reset',
                                label: localize('reset', "Clear Data in Cloud..."),
                                run: () => this.userDataSyncWorkbenchService.resetSyncedData()
                            }),
                            toAction({
                                id: 'show synced data',
                                label: localize('show synced data action', "Show Synced Data"),
                                run: () => this.userDataSyncWorkbenchService.showSyncActivity()
                            })
                        ]
                    }
                });
                return;
            case "ServiceChanged" /* UserDataSyncErrorCode.ServiceChanged */:
                this.notificationService.notify({
                    severity: Severity.Info,
                    message: this.userDataSyncStoreManagementService.userDataSyncStore?.type === 'insiders' ?
                        localize('service switched to insiders', "Settings Sync has been switched to insiders service") :
                        localize('service switched to stable', "Settings Sync has been switched to stable service"),
                });
                return;
            case "DefaultServiceChanged" /* UserDataSyncErrorCode.DefaultServiceChanged */:
                // Settings sync is using separate service
                if (this.userDataSyncEnablementService.isEnabled()) {
                    this.notificationService.notify({
                        severity: Severity.Info,
                        message: localize('using separate service', "Settings sync now uses a separate service, more information is available in the [Settings Sync Documentation](https://aka.ms/vscode-settings-sync-help#_syncing-stable-versus-insiders)."),
                    });
                }
                // If settings sync got turned off then ask user to turn on sync again.
                else {
                    this.notificationService.notify({
                        severity: Severity.Info,
                        message: localize('service changed and turned off', "Settings sync was turned off because {0} now uses a separate service. Please turn on sync again.", this.productService.nameLong),
                        actions: {
                            primary: [toAction({
                                    id: 'turn on sync',
                                    label: localize('turn on sync', "Turn on Settings Sync..."),
                                    run: () => this.turnOn()
                                })]
                        }
                    });
                }
                return;
        }
    }
    handleTooLargeError(resource, message, error) {
        const operationId = error.operationId ? localize('operationId', "Operation Id: {0}", error.operationId) : undefined;
        this.notificationService.notify({
            severity: Severity.Error,
            message: operationId ? `${message} ${operationId}` : message,
            actions: {
                primary: [toAction({
                        id: 'open sync file',
                        label: localize('open file', "Open {0} File", getSyncAreaLabel(resource)),
                        run: () => resource === "settings" /* SyncResource.Settings */ ? this.preferencesService.openUserSettings({ jsonEditor: true }) : this.preferencesService.openGlobalKeybindingSettings(true)
                    })]
            }
        });
    }
    onSynchronizerErrors(errors) {
        if (errors.length) {
            for (const { profile, syncResource: resource, error } of errors) {
                switch (error.code) {
                    case "LocalInvalidContent" /* UserDataSyncErrorCode.LocalInvalidContent */:
                        this.handleInvalidContentError({ profile, syncResource: resource });
                        break;
                    default: {
                        const key = `${profile.id}:${resource}`;
                        const disposable = this.invalidContentErrorDisposables.get(key);
                        if (disposable) {
                            disposable.dispose();
                            this.invalidContentErrorDisposables.delete(key);
                        }
                    }
                }
            }
        }
        else {
            this.invalidContentErrorDisposables.forEach(disposable => disposable.dispose());
            this.invalidContentErrorDisposables.clear();
        }
    }
    handleInvalidContentError({ profile, syncResource: source }) {
        if (this.userDataProfileService.currentProfile.id !== profile.id) {
            return;
        }
        const key = `${profile.id}:${source}`;
        if (this.invalidContentErrorDisposables.has(key)) {
            return;
        }
        if (source !== "settings" /* SyncResource.Settings */ && source !== "keybindings" /* SyncResource.Keybindings */ && source !== "tasks" /* SyncResource.Tasks */) {
            return;
        }
        if (!this.hostService.hasFocus) {
            return;
        }
        const resource = source === "settings" /* SyncResource.Settings */ ? this.userDataProfileService.currentProfile.settingsResource
            : source === "keybindings" /* SyncResource.Keybindings */ ? this.userDataProfileService.currentProfile.keybindingsResource
                : this.userDataProfileService.currentProfile.tasksResource;
        const editorUri = EditorResourceAccessor.getCanonicalUri(this.editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
        if (isEqual(resource, editorUri)) {
            // Do not show notification if the file in error is active
            return;
        }
        const errorArea = getSyncAreaLabel(source);
        const handle = this.notificationService.notify({
            severity: Severity.Error,
            message: localize('errorInvalidConfiguration', "Unable to sync {0} because the content in the file is not valid. Please open the file and correct it.", errorArea.toLowerCase()),
            actions: {
                primary: [toAction({
                        id: 'open sync file',
                        label: localize('open file', "Open {0} File", errorArea),
                        run: () => source === "settings" /* SyncResource.Settings */ ? this.preferencesService.openUserSettings({ jsonEditor: true }) : this.preferencesService.openGlobalKeybindingSettings(true)
                    })]
            }
        });
        this.invalidContentErrorDisposables.set(key, toDisposable(() => {
            // close the error warning notification
            handle.close();
            this.invalidContentErrorDisposables.delete(key);
        }));
    }
    getConflictsCount() {
        return this.userDataSyncService.conflicts.reduce((result, { conflicts }) => { return result + conflicts.length; }, 0);
    }
    async updateGlobalActivityBadge() {
        this.globalActivityBadgeDisposable.clear();
        let badge = undefined;
        if (this.userDataSyncService.conflicts.length && this.userDataSyncEnablementService.isEnabled()) {
            badge = new NumberBadge(this.getConflictsCount(), () => localize('has conflicts', "{0}: Conflicts Detected", SYNC_TITLE.value));
        }
        else if (this.turningOnSync) {
            badge = new ProgressBadge(() => localize('turning on syncing', "Turning on Settings Sync..."));
        }
        if (badge) {
            this.globalActivityBadgeDisposable.value = this.activityService.showGlobalActivity({ badge });
        }
    }
    async updateAccountBadge() {
        this.accountBadgeDisposable.clear();
        let badge = undefined;
        if (this.userDataSyncService.status !== "uninitialized" /* SyncStatus.Uninitialized */ && this.userDataSyncEnablementService.isEnabled() && this.userDataSyncWorkbenchService.accountStatus === "unavailable" /* AccountStatus.Unavailable */) {
            badge = new NumberBadge(1, () => localize('sign in to sync', "Sign in to Sync Settings"));
        }
        if (badge) {
            this.accountBadgeDisposable.value = this.activityService.showAccountsActivity({ badge });
        }
    }
    async turnOn() {
        try {
            if (!this.userDataSyncWorkbenchService.authenticationProviders.length) {
                throw new Error(localize('no authentication providers', "No authentication providers are available."));
            }
            const turnOn = await this.askToConfigure();
            if (!turnOn) {
                return;
            }
            if (this.userDataSyncStoreManagementService.userDataSyncStore?.canSwitch) {
                await this.selectSettingsSyncService(this.userDataSyncStoreManagementService.userDataSyncStore);
            }
            await this.userDataSyncWorkbenchService.turnOn();
        }
        catch (e) {
            if (isCancellationError(e)) {
                return;
            }
            if (e instanceof UserDataSyncError) {
                switch (e.code) {
                    case "TooLarge" /* UserDataSyncErrorCode.TooLarge */:
                        if (e.resource === "keybindings" /* SyncResource.Keybindings */ || e.resource === "settings" /* SyncResource.Settings */ || e.resource === "tasks" /* SyncResource.Tasks */) {
                            this.handleTooLargeError(e.resource, localize('too large while starting sync', "Settings sync cannot be turned on because size of the {0} file to sync is larger than {1}. Please open the file and reduce the size and turn on sync", getSyncAreaLabel(e.resource).toLowerCase(), '100kb'), e);
                            return;
                        }
                        break;
                    case "IncompatibleLocalContent" /* UserDataSyncErrorCode.IncompatibleLocalContent */:
                    case "Gone" /* UserDataSyncErrorCode.Gone */:
                    case "UpgradeRequired" /* UserDataSyncErrorCode.UpgradeRequired */: {
                        const message = localize('error upgrade required while starting sync', "Settings sync cannot be turned on because the current version ({0}, {1}) is not compatible with the sync service. Please update before turning on sync.", this.productService.version, this.productService.commit);
                        const operationId = e.operationId ? localize('operationId', "Operation Id: {0}", e.operationId) : undefined;
                        this.notificationService.notify({
                            severity: Severity.Error,
                            message: operationId ? `${message} ${operationId}` : message,
                        });
                        return;
                    }
                    case "IncompatibleRemoteContent" /* UserDataSyncErrorCode.IncompatibleRemoteContent */:
                        this.notificationService.notify({
                            severity: Severity.Error,
                            message: localize('error reset required while starting sync', "Settings sync cannot be turned on because your data in the cloud is older than that of the client. Please clear your data in the cloud before turning on sync."),
                            actions: {
                                primary: [
                                    toAction({
                                        id: 'reset',
                                        label: localize('reset', "Clear Data in Cloud..."),
                                        run: () => this.userDataSyncWorkbenchService.resetSyncedData()
                                    }),
                                    toAction({
                                        id: 'show synced data',
                                        label: localize('show synced data action', "Show Synced Data"),
                                        run: () => this.userDataSyncWorkbenchService.showSyncActivity()
                                    })
                                ]
                            }
                        });
                        return;
                    case "Unauthorized" /* UserDataSyncErrorCode.Unauthorized */:
                    case "Forbidden" /* UserDataSyncErrorCode.Forbidden */:
                        this.notificationService.error(localize('auth failed', "Error while turning on Settings Sync: Authentication failed."));
                        return;
                }
                this.notificationService.error(localize('turn on failed with user data sync error', "Error while turning on Settings Sync. Please check [logs]({0}) for more details.", `command:${SHOW_SYNC_LOG_COMMAND_ID}`));
            }
            else {
                this.notificationService.error(localize({ key: 'turn on failed', comment: ['Substitution is for error reason'] }, "Error while turning on Settings Sync. {0}", getErrorMessage(e)));
            }
        }
    }
    async askToConfigure() {
        return new Promise((c, e) => {
            const disposables = new DisposableStore();
            const quickPick = this.quickInputService.createQuickPick();
            disposables.add(quickPick);
            quickPick.title = SYNC_TITLE.value;
            quickPick.ok = false;
            quickPick.customButton = true;
            quickPick.customLabel = localize('sign in and turn on', "Sign in");
            quickPick.description = localize('configure and turn on sync detail', "Please sign in to backup and sync your data across devices.");
            quickPick.canSelectMany = true;
            quickPick.ignoreFocusOut = true;
            quickPick.hideInput = true;
            quickPick.hideCheckAll = true;
            const items = this.getConfigureSyncQuickPickItems();
            quickPick.items = items;
            quickPick.selectedItems = items.filter(item => this.userDataSyncEnablementService.isResourceEnabled(item.id, true));
            let accepted = false;
            disposables.add(Event.any(quickPick.onDidAccept, quickPick.onDidCustom)(() => {
                accepted = true;
                quickPick.hide();
            }));
            disposables.add(quickPick.onDidHide(() => {
                try {
                    if (accepted) {
                        this.updateConfiguration(items, quickPick.selectedItems);
                    }
                    c(accepted);
                }
                catch (error) {
                    e(error);
                }
                finally {
                    disposables.dispose();
                }
            }));
            quickPick.show();
        });
    }
    getConfigureSyncQuickPickItems() {
        const result = [{
                id: "settings" /* SyncResource.Settings */,
                label: getSyncAreaLabel("settings" /* SyncResource.Settings */)
            }, {
                id: "keybindings" /* SyncResource.Keybindings */,
                label: getSyncAreaLabel("keybindings" /* SyncResource.Keybindings */),
            }, {
                id: "snippets" /* SyncResource.Snippets */,
                label: getSyncAreaLabel("snippets" /* SyncResource.Snippets */)
            }, {
                id: "tasks" /* SyncResource.Tasks */,
                label: getSyncAreaLabel("tasks" /* SyncResource.Tasks */)
            }, {
                id: "mcp" /* SyncResource.Mcp */,
                label: getSyncAreaLabel("mcp" /* SyncResource.Mcp */)
            }, {
                id: "globalState" /* SyncResource.GlobalState */,
                label: getSyncAreaLabel("globalState" /* SyncResource.GlobalState */),
            }, {
                id: "extensions" /* SyncResource.Extensions */,
                label: getSyncAreaLabel("extensions" /* SyncResource.Extensions */)
            }, {
                id: "profiles" /* SyncResource.Profiles */,
                label: getSyncAreaLabel("profiles" /* SyncResource.Profiles */),
            }, {
                id: "prompts" /* SyncResource.Prompts */,
                label: getSyncAreaLabel("prompts" /* SyncResource.Prompts */)
            }];
        return result;
    }
    updateConfiguration(items, selectedItems) {
        for (const item of items) {
            const wasEnabled = this.userDataSyncEnablementService.isResourceEnabled(item.id);
            const isEnabled = !!selectedItems.filter(selected => selected.id === item.id)[0];
            if (wasEnabled !== isEnabled) {
                this.userDataSyncEnablementService.setResourceEnablement(item.id, isEnabled);
            }
        }
    }
    async configureSyncOptions() {
        return new Promise((c, e) => {
            const disposables = new DisposableStore();
            const quickPick = this.quickInputService.createQuickPick();
            disposables.add(quickPick);
            quickPick.title = localize('configure sync title', "{0}: Configure...", SYNC_TITLE.value);
            quickPick.placeholder = localize('configure sync placeholder', "Choose what to sync");
            quickPick.canSelectMany = true;
            quickPick.ignoreFocusOut = true;
            quickPick.ok = true;
            const items = this.getConfigureSyncQuickPickItems();
            quickPick.items = items;
            quickPick.selectedItems = items.filter(item => this.userDataSyncEnablementService.isResourceEnabled(item.id));
            disposables.add(quickPick.onDidAccept(async () => {
                if (quickPick.selectedItems.length) {
                    this.updateConfiguration(items, quickPick.selectedItems);
                    quickPick.hide();
                }
            }));
            disposables.add(quickPick.onDidHide(() => {
                disposables.dispose();
                c();
            }));
            quickPick.show();
        });
    }
    async turnOff() {
        const result = await this.dialogService.confirm({
            message: localize('turn off sync confirmation', "Do you want to turn off sync?"),
            detail: localize('turn off sync detail', "Your settings, keybindings, extensions, snippets and UI State will no longer be synced."),
            primaryButton: localize({ key: 'turn off', comment: ['&& denotes a mnemonic'] }, "&&Turn off"),
            checkbox: this.userDataSyncWorkbenchService.accountStatus === "available" /* AccountStatus.Available */ ? {
                label: localize('turn off sync everywhere', "Turn off sync on all your devices and clear the data from the cloud.")
            } : undefined
        });
        if (result.confirmed) {
            return this.userDataSyncWorkbenchService.turnoff(!!result.checkboxChecked);
        }
    }
    disableSync(source) {
        switch (source) {
            case "settings" /* SyncResource.Settings */: return this.userDataSyncEnablementService.setResourceEnablement("settings" /* SyncResource.Settings */, false);
            case "keybindings" /* SyncResource.Keybindings */: return this.userDataSyncEnablementService.setResourceEnablement("keybindings" /* SyncResource.Keybindings */, false);
            case "snippets" /* SyncResource.Snippets */: return this.userDataSyncEnablementService.setResourceEnablement("snippets" /* SyncResource.Snippets */, false);
            case "tasks" /* SyncResource.Tasks */: return this.userDataSyncEnablementService.setResourceEnablement("tasks" /* SyncResource.Tasks */, false);
            case "extensions" /* SyncResource.Extensions */: return this.userDataSyncEnablementService.setResourceEnablement("extensions" /* SyncResource.Extensions */, false);
            case "globalState" /* SyncResource.GlobalState */: return this.userDataSyncEnablementService.setResourceEnablement("globalState" /* SyncResource.GlobalState */, false);
            case "profiles" /* SyncResource.Profiles */: return this.userDataSyncEnablementService.setResourceEnablement("profiles" /* SyncResource.Profiles */, false);
        }
    }
    showSyncActivity() {
        return this.outputService.showChannel(USER_DATA_SYNC_LOG_ID);
    }
    async selectSettingsSyncService(userDataSyncStore) {
        return new Promise((c, e) => {
            const disposables = new DisposableStore();
            const quickPick = disposables.add(this.quickInputService.createQuickPick());
            quickPick.title = localize('switchSyncService.title', "{0}: Select Service", SYNC_TITLE.value);
            quickPick.description = localize('switchSyncService.description', "Ensure you are using the same settings sync service when syncing with multiple environments");
            quickPick.hideInput = true;
            quickPick.ignoreFocusOut = true;
            const getDescription = (url) => {
                const isDefault = isEqual(url, userDataSyncStore.defaultUrl);
                if (isDefault) {
                    return localize('default', "Default");
                }
                return undefined;
            };
            quickPick.items = [
                {
                    id: 'insiders',
                    label: localize('insiders', "Insiders"),
                    description: getDescription(userDataSyncStore.insidersUrl)
                },
                {
                    id: 'stable',
                    label: localize('stable', "Stable"),
                    description: getDescription(userDataSyncStore.stableUrl)
                }
            ];
            disposables.add(quickPick.onDidAccept(async () => {
                try {
                    await this.userDataSyncStoreManagementService.switch(quickPick.selectedItems[0].id);
                    c();
                }
                catch (error) {
                    e(error);
                }
                finally {
                    quickPick.hide();
                }
            }));
            disposables.add(quickPick.onDidHide(() => disposables.dispose()));
            quickPick.show();
        });
    }
    registerActions() {
        if (this.userDataSyncEnablementService.canToggleEnablement()) {
            this.registerTurnOnSyncAction();
            this.registerTurnOffSyncAction();
        }
        this.registerTurningOnSyncAction();
        this.registerCancelTurnOnSyncAction();
        this.registerSignInAction(); // When Sync is turned on from CLI
        this.registerShowConflictsAction();
        this.registerEnableSyncViewsAction();
        this.registerManageSyncAction();
        this.registerSyncNowAction();
        this.registerConfigureSyncAction();
        this.registerShowSettingsAction();
        this.registerHelpAction();
        this.registerShowLogAction();
        this.registerResetSyncDataAction();
        this.registerAcceptMergesAction();
        if (isWeb) {
            this.registerDownloadSyncActivityAction();
        }
    }
    registerTurnOnSyncAction() {
        const that = this;
        const when = ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo("uninitialized" /* SyncStatus.Uninitialized */), CONTEXT_SYNC_ENABLEMENT.toNegated(), CONTEXT_TURNING_ON_STATE.negate());
        this._register(registerAction2(class TurningOnSyncAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.userDataSync.actions.turnOn',
                    title: localize2('global activity turn on sync', 'Backup and Sync Settings...'),
                    category: SYNC_TITLE,
                    f1: true,
                    precondition: when,
                    menu: [{
                            group: '3_configuration',
                            id: MenuId.GlobalActivity,
                            when,
                            order: 2
                        }, {
                            group: '3_configuration',
                            id: MenuId.MenubarPreferencesMenu,
                            when,
                            order: 2
                        }, {
                            group: '1_settings',
                            id: MenuId.AccountsContext,
                            when,
                            order: 2
                        }]
                });
            }
            async run() {
                return that.turnOn();
            }
        }));
    }
    registerTurningOnSyncAction() {
        const when = ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo("uninitialized" /* SyncStatus.Uninitialized */), CONTEXT_SYNC_ENABLEMENT.toNegated(), CONTEXT_TURNING_ON_STATE);
        this._register(registerAction2(class TurningOnSyncAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.userData.actions.turningOn',
                    title: localize('turning on sync', "Turning on Settings Sync..."),
                    precondition: ContextKeyExpr.false(),
                    menu: [{
                            group: '3_configuration',
                            id: MenuId.GlobalActivity,
                            when,
                            order: 2
                        }, {
                            group: '1_settings',
                            id: MenuId.AccountsContext,
                            when,
                        }]
                });
            }
            async run() { }
        }));
    }
    registerCancelTurnOnSyncAction() {
        const that = this;
        this._register(registerAction2(class TurningOnSyncAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.userData.actions.cancelTurnOn',
                    title: localize('cancel turning on sync', "Cancel"),
                    icon: Codicon.stopCircle,
                    menu: {
                        id: MenuId.ViewContainerTitle,
                        when: ContextKeyExpr.and(CONTEXT_TURNING_ON_STATE, ContextKeyExpr.equals('viewContainer', SYNC_VIEW_CONTAINER_ID)),
                        group: 'navigation',
                        order: 1
                    }
                });
            }
            async run() {
                return that.userDataSyncWorkbenchService.turnoff(false);
            }
        }));
    }
    registerSignInAction() {
        const that = this;
        const id = 'workbench.userData.actions.signin';
        const when = ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo("uninitialized" /* SyncStatus.Uninitialized */), CONTEXT_SYNC_ENABLEMENT, CONTEXT_ACCOUNT_STATE.isEqualTo("unavailable" /* AccountStatus.Unavailable */));
        this._register(registerAction2(class StopSyncAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.userData.actions.signin',
                    title: localize('sign in global', "Sign in to Sync Settings"),
                    menu: {
                        group: '3_configuration',
                        id: MenuId.GlobalActivity,
                        when,
                        order: 2
                    }
                });
            }
            async run() {
                try {
                    await that.userDataSyncWorkbenchService.signIn();
                }
                catch (e) {
                    that.notificationService.error(e);
                }
            }
        }));
        this._register(MenuRegistry.appendMenuItem(MenuId.AccountsContext, {
            group: '1_settings',
            command: {
                id,
                title: localize('sign in accounts', "Sign in to Sync Settings (1)"),
            },
            when
        }));
    }
    getShowConflictsTitle() {
        return localize2('resolveConflicts_global', "Show Conflicts ({0})", this.getConflictsCount());
    }
    registerShowConflictsAction() {
        this.conflictsActionDisposable.value = undefined;
        const that = this;
        this.conflictsActionDisposable.value = registerAction2(class TurningOnSyncAction extends Action2 {
            constructor() {
                super({
                    id: showConflictsCommandId,
                    get title() { return that.getShowConflictsTitle(); },
                    category: SYNC_TITLE,
                    f1: true,
                    precondition: CONTEXT_HAS_CONFLICTS,
                    menu: [{
                            group: '3_configuration',
                            id: MenuId.GlobalActivity,
                            when: CONTEXT_HAS_CONFLICTS,
                            order: 2
                        }, {
                            group: '3_configuration',
                            id: MenuId.MenubarPreferencesMenu,
                            when: CONTEXT_HAS_CONFLICTS,
                            order: 2
                        }]
                });
            }
            async run() {
                return that.userDataSyncWorkbenchService.showConflicts();
            }
        });
    }
    registerManageSyncAction() {
        const that = this;
        const when = ContextKeyExpr.and(CONTEXT_SYNC_ENABLEMENT, CONTEXT_ACCOUNT_STATE.notEqualsTo("unavailable" /* AccountStatus.Unavailable */), CONTEXT_SYNC_STATE.notEqualsTo("uninitialized" /* SyncStatus.Uninitialized */));
        this._register(registerAction2(class SyncStatusAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.userDataSync.actions.manage',
                    title: localize('sync is on', "Settings Sync is On"),
                    toggled: ContextKeyTrueExpr.INSTANCE,
                    menu: [
                        {
                            id: MenuId.GlobalActivity,
                            group: '3_configuration',
                            when,
                            order: 2
                        },
                        {
                            id: MenuId.MenubarPreferencesMenu,
                            group: '3_configuration',
                            when,
                            order: 2,
                        },
                        {
                            id: MenuId.AccountsContext,
                            group: '1_settings',
                            when,
                        }
                    ],
                });
            }
            run(accessor) {
                return new Promise((c, e) => {
                    const quickInputService = accessor.get(IQuickInputService);
                    const commandService = accessor.get(ICommandService);
                    const disposables = new DisposableStore();
                    const quickPick = quickInputService.createQuickPick({ useSeparators: true });
                    disposables.add(quickPick);
                    const items = [];
                    if (that.userDataSyncService.conflicts.length) {
                        items.push({ id: showConflictsCommandId, label: `${SYNC_TITLE.value}: ${that.getShowConflictsTitle().original}` });
                        items.push({ type: 'separator' });
                    }
                    items.push({ id: configureSyncCommand.id, label: `${SYNC_TITLE.value}: ${configureSyncCommand.title.original}` });
                    items.push({ id: showSyncSettingsCommand.id, label: `${SYNC_TITLE.value}: ${showSyncSettingsCommand.title.original}` });
                    items.push({ id: showSyncedDataCommand.id, label: `${SYNC_TITLE.value}: ${showSyncedDataCommand.title.original}` });
                    items.push({ type: 'separator' });
                    items.push({ id: syncNowCommand.id, label: `${SYNC_TITLE.value}: ${syncNowCommand.title.original}`, description: syncNowCommand.description(that.userDataSyncService) });
                    if (that.userDataSyncEnablementService.canToggleEnablement()) {
                        const account = that.userDataSyncWorkbenchService.current;
                        items.push({ id: turnOffSyncCommand.id, label: `${SYNC_TITLE.value}: ${turnOffSyncCommand.title.original}`, description: account ? `${account.accountName} (${that.authenticationService.getProvider(account.authenticationProviderId).label})` : undefined });
                    }
                    quickPick.items = items;
                    disposables.add(quickPick.onDidAccept(() => {
                        if (quickPick.selectedItems[0] && quickPick.selectedItems[0].id) {
                            commandService.executeCommand(quickPick.selectedItems[0].id);
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
        }));
    }
    registerEnableSyncViewsAction() {
        const that = this;
        const when = ContextKeyExpr.and(CONTEXT_ACCOUNT_STATE.isEqualTo("available" /* AccountStatus.Available */), CONTEXT_SYNC_STATE.notEqualsTo("uninitialized" /* SyncStatus.Uninitialized */));
        this._register(registerAction2(class SyncStatusAction extends Action2 {
            constructor() {
                super({
                    id: showSyncedDataCommand.id,
                    title: showSyncedDataCommand.title,
                    category: SYNC_TITLE,
                    precondition: when,
                    menu: {
                        id: MenuId.CommandPalette,
                        when
                    }
                });
            }
            run(accessor) {
                return that.userDataSyncWorkbenchService.showSyncActivity();
            }
        }));
    }
    registerSyncNowAction() {
        const that = this;
        this._register(registerAction2(class SyncNowAction extends Action2 {
            constructor() {
                super({
                    id: syncNowCommand.id,
                    title: syncNowCommand.title,
                    category: SYNC_TITLE,
                    menu: {
                        id: MenuId.CommandPalette,
                        when: ContextKeyExpr.and(CONTEXT_SYNC_ENABLEMENT, CONTEXT_ACCOUNT_STATE.isEqualTo("available" /* AccountStatus.Available */), CONTEXT_SYNC_STATE.notEqualsTo("uninitialized" /* SyncStatus.Uninitialized */))
                    }
                });
            }
            run(accessor) {
                return that.userDataSyncWorkbenchService.syncNow();
            }
        }));
    }
    registerTurnOffSyncAction() {
        const that = this;
        this._register(registerAction2(class StopSyncAction extends Action2 {
            constructor() {
                super({
                    id: turnOffSyncCommand.id,
                    title: turnOffSyncCommand.title,
                    category: SYNC_TITLE,
                    menu: {
                        id: MenuId.CommandPalette,
                        when: ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo("uninitialized" /* SyncStatus.Uninitialized */), CONTEXT_SYNC_ENABLEMENT),
                    },
                });
            }
            async run() {
                try {
                    await that.turnOff();
                }
                catch (e) {
                    if (!isCancellationError(e)) {
                        that.notificationService.error(localize('turn off failed', "Error while turning off Settings Sync. Please check [logs]({0}) for more details.", `command:${SHOW_SYNC_LOG_COMMAND_ID}`));
                    }
                }
            }
        }));
    }
    registerConfigureSyncAction() {
        const that = this;
        const when = ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo("uninitialized" /* SyncStatus.Uninitialized */), CONTEXT_SYNC_ENABLEMENT);
        this._register(registerAction2(class ConfigureSyncAction extends Action2 {
            constructor() {
                super({
                    id: configureSyncCommand.id,
                    title: configureSyncCommand.title,
                    category: SYNC_TITLE,
                    icon: Codicon.settingsGear,
                    tooltip: localize('configure', "Configure..."),
                    menu: [{
                            id: MenuId.CommandPalette,
                            when
                        }, {
                            id: MenuId.ViewContainerTitle,
                            when: ContextKeyExpr.and(CONTEXT_SYNC_ENABLEMENT, ContextKeyExpr.equals('viewContainer', SYNC_VIEW_CONTAINER_ID)),
                            group: 'navigation',
                            order: 2
                        }]
                });
            }
            run() { return that.configureSyncOptions(); }
        }));
    }
    registerShowLogAction() {
        const that = this;
        this._register(registerAction2(class ShowSyncActivityAction extends Action2 {
            constructor() {
                super({
                    id: SHOW_SYNC_LOG_COMMAND_ID,
                    title: localize('show sync log title', "{0}: Show Log", SYNC_TITLE.value),
                    tooltip: localize('show sync log toolrip', "Show Log"),
                    icon: Codicon.output,
                    menu: [{
                            id: MenuId.CommandPalette,
                            when: ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo("uninitialized" /* SyncStatus.Uninitialized */)),
                        }, {
                            id: MenuId.ViewContainerTitle,
                            when: ContextKeyExpr.equals('viewContainer', SYNC_VIEW_CONTAINER_ID),
                            group: 'navigation',
                            order: 1
                        }],
                });
            }
            run() { return that.showSyncActivity(); }
        }));
    }
    registerShowSettingsAction() {
        this._register(registerAction2(class ShowSyncSettingsAction extends Action2 {
            constructor() {
                super({
                    id: showSyncSettingsCommand.id,
                    title: showSyncSettingsCommand.title,
                    category: SYNC_TITLE,
                    menu: {
                        id: MenuId.CommandPalette,
                        when: ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo("uninitialized" /* SyncStatus.Uninitialized */)),
                    },
                });
            }
            run(accessor) {
                accessor.get(IPreferencesService).openUserSettings({ jsonEditor: false, query: '@tag:sync' });
            }
        }));
    }
    registerHelpAction() {
        const that = this;
        this._register(registerAction2(class HelpAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.userDataSync.actions.help',
                    title: SYNC_TITLE,
                    category: Categories.Help,
                    menu: [{
                            id: MenuId.CommandPalette,
                            when: ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo("uninitialized" /* SyncStatus.Uninitialized */)),
                        }],
                });
            }
            run() { return that.openerService.open(URI.parse('https://aka.ms/vscode-settings-sync-help')); }
        }));
        MenuRegistry.appendMenuItem(MenuId.ViewContainerTitle, {
            command: {
                id: 'workbench.userDataSync.actions.help',
                title: Categories.Help.value
            },
            when: ContextKeyExpr.equals('viewContainer', SYNC_VIEW_CONTAINER_ID),
            group: '1_help',
        });
    }
    registerAcceptMergesAction() {
        const that = this;
        this._register(registerAction2(class AcceptMergesAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.userDataSync.actions.acceptMerges',
                    title: localize('complete merges title', "Complete Merge"),
                    menu: [{
                            id: MenuId.EditorContent,
                            when: ContextKeyExpr.and(ctxIsMergeResultEditor, ContextKeyExpr.regex(ctxMergeBaseUri.key, new RegExp(`^${USER_DATA_SYNC_SCHEME}:`))),
                        }],
                });
            }
            async run(accessor, previewResource) {
                const textFileService = accessor.get(ITextFileService);
                await textFileService.save(previewResource);
                const content = await textFileService.read(previewResource);
                await that.userDataSyncService.accept(this.getSyncResource(previewResource), previewResource, content.value, true);
            }
            getSyncResource(previewResource) {
                const conflict = that.userDataSyncService.conflicts.find(({ conflicts }) => conflicts.some(conflict => isEqual(conflict.previewResource, previewResource)));
                if (conflict) {
                    return conflict;
                }
                throw new Error(`Unknown resource: ${previewResource.toString()}`);
            }
        }));
    }
    registerDownloadSyncActivityAction() {
        this._register(registerAction2(class DownloadSyncActivityAction extends Action2 {
            constructor() {
                super(DOWNLOAD_ACTIVITY_ACTION_DESCRIPTOR);
            }
            async run(accessor) {
                const userDataSyncWorkbenchService = accessor.get(IUserDataSyncWorkbenchService);
                const notificationService = accessor.get(INotificationService);
                const folder = await userDataSyncWorkbenchService.downloadSyncActivity();
                if (folder) {
                    notificationService.info(localize('download sync activity complete', "Successfully downloaded Settings Sync activity."));
                }
            }
        }));
    }
    registerViews() {
        const container = this.registerViewContainer();
        this.registerDataViews(container);
    }
    registerViewContainer() {
        return Registry.as(Extensions.ViewContainersRegistry).registerViewContainer({
            id: SYNC_VIEW_CONTAINER_ID,
            title: SYNC_TITLE,
            ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [SYNC_VIEW_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
            icon: SYNC_VIEW_ICON,
            hideIfEmpty: true,
        }, 0 /* ViewContainerLocation.Sidebar */);
    }
    registerResetSyncDataAction() {
        const that = this;
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.actions.syncData.reset',
                    title: localize('workbench.actions.syncData.reset', "Clear Data in Cloud..."),
                    menu: [{
                            id: MenuId.ViewContainerTitle,
                            when: ContextKeyExpr.equals('viewContainer', SYNC_VIEW_CONTAINER_ID),
                            group: '0_configure',
                        }],
                });
            }
            run() { return that.userDataSyncWorkbenchService.resetSyncedData(); }
        }));
    }
    registerDataViews(container) {
        this._register(this.instantiationService.createInstance(UserDataSyncDataViews, container));
    }
};
UserDataSyncWorkbenchContribution = __decorate([
    __param(0, IUserDataSyncEnablementService),
    __param(1, IUserDataSyncService),
    __param(2, IUserDataSyncWorkbenchService),
    __param(3, IContextKeyService),
    __param(4, IActivityService),
    __param(5, INotificationService),
    __param(6, IEditorService),
    __param(7, IUserDataProfileService),
    __param(8, IDialogService),
    __param(9, IQuickInputService),
    __param(10, IInstantiationService),
    __param(11, IOutputService),
    __param(12, IUserDataAutoSyncService),
    __param(13, ITextModelService),
    __param(14, IPreferencesService),
    __param(15, ITelemetryService),
    __param(16, IProductService),
    __param(17, IOpenerService),
    __param(18, IAuthenticationService),
    __param(19, IUserDataSyncStoreManagementService),
    __param(20, IHostService),
    __param(21, ICommandService),
    __param(22, IWorkbenchIssueService)
], UserDataSyncWorkbenchContribution);
export { UserDataSyncWorkbenchContribution };
let UserDataRemoteContentProvider = class UserDataRemoteContentProvider {
    constructor(userDataSyncService, modelService, languageService) {
        this.userDataSyncService = userDataSyncService;
        this.modelService = modelService;
        this.languageService = languageService;
    }
    provideTextContent(uri) {
        if (uri.scheme === USER_DATA_SYNC_SCHEME) {
            return this.userDataSyncService.resolveContent(uri).then(content => this.modelService.createModel(content || '', this.languageService.createById('jsonc'), uri));
        }
        return null;
    }
};
UserDataRemoteContentProvider = __decorate([
    __param(0, IUserDataSyncService),
    __param(1, IModelService),
    __param(2, ILanguageService)
], UserDataRemoteContentProvider);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlckRhdGFTeW5jLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3VzZXJEYXRhU3luYy9icm93c2VyL3VzZXJEYXRhU3luYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDOUQsT0FBTyxFQUFFLGVBQWUsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQWUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqSSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDL0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBR3JELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUNuRixPQUFPLEVBQTZCLGlCQUFpQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDckgsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUN6RCxPQUFPLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEgsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQWUsa0JBQWtCLEVBQUUsYUFBYSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUosT0FBTyxFQUFF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