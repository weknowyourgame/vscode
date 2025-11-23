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
var SettingsChangeRelauncher_1;
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { Disposable, dispose, toDisposable } from '../../../../base/common/lifecycle.js';
import { isLinux, isMacintosh, isNative } from '../../../../base/common/platform.js';
import { isEqual } from '../../../../base/common/resources.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IUserDataSyncEnablementService, IUserDataSyncService } from '../../../../platform/userDataSync/common/userDataSync.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IUserDataSyncWorkbenchService } from '../../../services/userDataSync/common/userDataSync.js';
let SettingsChangeRelauncher = class SettingsChangeRelauncher extends Disposable {
    static { SettingsChangeRelauncher_1 = this; }
    static { this.SETTINGS = [
        "window.titleBarStyle" /* TitleBarSetting.TITLE_BAR_STYLE */,
        "window.menuStyle" /* MenuSettings.MenuStyle */,
        'window.nativeTabs',
        'window.nativeFullScreen',
        'window.clickThroughInactive',
        'window.controlsStyle',
        'update.mode',
        'editor.accessibilitySupport',
        'security.workspace.trust.enabled',
        'workbench.enableExperiments',
        '_extensionsGallery.enablePPE',
        'security.restrictUNCAccess',
        'accessibility.verbosity.debug',
        'telemetry.feedback.enabled',
        'chat.extensionUnification.enabled'
    ]; }
    constructor(hostService, configurationService, userDataSyncService, userDataSyncEnablementService, userDataSyncWorkbenchService, productService, dialogService) {
        super();
        this.hostService = hostService;
        this.configurationService = configurationService;
        this.userDataSyncService = userDataSyncService;
        this.userDataSyncEnablementService = userDataSyncEnablementService;
        this.productService = productService;
        this.dialogService = dialogService;
        this.titleBarStyle = new ChangeObserver('string');
        this.menuStyle = new ChangeObserver('string');
        this.nativeTabs = new ChangeObserver('boolean');
        this.nativeFullScreen = new ChangeObserver('boolean');
        this.clickThroughInactive = new ChangeObserver('boolean');
        this.controlsStyle = new ChangeObserver('string');
        this.updateMode = new ChangeObserver('string');
        this.workspaceTrustEnabled = new ChangeObserver('boolean');
        this.experimentsEnabled = new ChangeObserver('boolean');
        this.enablePPEExtensionsGallery = new ChangeObserver('boolean');
        this.restrictUNCAccess = new ChangeObserver('boolean');
        this.accessibilityVerbosityDebug = new ChangeObserver('boolean');
        this.telemetryFeedbackEnabled = new ChangeObserver('boolean');
        this.extensionUnificationEnabled = new ChangeObserver('boolean');
        this.update(false);
        this._register(this.configurationService.onDidChangeConfiguration(e => this.onConfigurationChange(e)));
        this._register(userDataSyncWorkbenchService.onDidTurnOnSync(e => this.update(true)));
    }
    onConfigurationChange(e) {
        if (e && !SettingsChangeRelauncher_1.SETTINGS.some(key => e.affectsConfiguration(key))) {
            return;
        }
        // Skip if turning on sync is in progress
        if (this.isTurningOnSyncInProgress()) {
            return;
        }
        this.update(e.source !== 7 /* ConfigurationTarget.DEFAULT */ /* do not ask to relaunch if defaults changed */);
    }
    isTurningOnSyncInProgress() {
        return !this.userDataSyncEnablementService.isEnabled() && this.userDataSyncService.status === "syncing" /* SyncStatus.Syncing */;
    }
    update(askToRelaunch) {
        let changed = false;
        function processChanged(didChange) {
            changed = changed || didChange;
        }
        const config = this.configurationService.getValue();
        if (isNative) {
            // Titlebar style
            processChanged((config.window.titleBarStyle === "native" /* TitlebarStyle.NATIVE */ || config.window.titleBarStyle === "custom" /* TitlebarStyle.CUSTOM */) && this.titleBarStyle.handleChange(config.window?.titleBarStyle));
            // Windows/Linux: Menu style
            processChanged(!isMacintosh && this.menuStyle.handleChange(config.window?.menuStyle));
            // macOS: Native tabs
            processChanged(isMacintosh && this.nativeTabs.handleChange(config.window?.nativeTabs));
            // macOS: Native fullscreen
            processChanged(isMacintosh && this.nativeFullScreen.handleChange(config.window?.nativeFullScreen));
            // macOS: Click through (accept first mouse)
            processChanged(isMacintosh && this.clickThroughInactive.handleChange(config.window?.clickThroughInactive));
            // Windows/Linux: Window controls style
            processChanged(!isMacintosh && this.controlsStyle.handleChange(config.window?.controlsStyle));
            // Update mode
            processChanged(this.updateMode.handleChange(config.update?.mode));
            // On linux turning on accessibility support will also pass this flag to the chrome renderer, thus a restart is required
            if (isLinux && typeof config.editor?.accessibilitySupport === 'string' && config.editor.accessibilitySupport !== this.accessibilitySupport) {
                this.accessibilitySupport = config.editor.accessibilitySupport;
                if (this.accessibilitySupport === 'on') {
                    changed = true;
                }
            }
            // Workspace trust
            processChanged(this.workspaceTrustEnabled.handleChange(config?.security?.workspace?.trust?.enabled));
            // UNC host access restrictions
            processChanged(this.restrictUNCAccess.handleChange(config?.security?.restrictUNCAccess));
            // Debug accessibility verbosity
            processChanged(this.accessibilityVerbosityDebug.handleChange(config?.accessibility?.verbosity?.debug));
        }
        // Experiments
        processChanged(this.experimentsEnabled.handleChange(config.workbench?.enableExperiments));
        // Profiles
        processChanged(this.productService.quality !== 'stable' && this.enablePPEExtensionsGallery.handleChange(config._extensionsGallery?.enablePPE));
        // Enable Feedback
        processChanged(this.telemetryFeedbackEnabled.handleChange(config.telemetry?.feedback?.enabled));
        // Extension Unification (only when turning on)
        processChanged(this.extensionUnificationEnabled.handleChange(config.chat?.extensionUnification?.enabled) && config.chat?.extensionUnification?.enabled === true);
        if (askToRelaunch && changed && this.hostService.hasFocus) {
            this.doConfirm(isNative ?
                localize('relaunchSettingMessage', "A setting has changed that requires a restart to take effect.") :
                localize('relaunchSettingMessageWeb', "A setting has changed that requires a reload to take effect."), isNative ?
                localize('relaunchSettingDetail', "Press the restart button to restart {0} and enable the setting.", this.productService.nameLong) :
                localize('relaunchSettingDetailWeb', "Press the reload button to reload {0} and enable the setting.", this.productService.nameLong), isNative ?
                localize({ key: 'restart', comment: ['&& denotes a mnemonic'] }, "&&Restart") :
                localize({ key: 'restartWeb', comment: ['&& denotes a mnemonic'] }, "&&Reload"), () => this.hostService.restart());
        }
    }
    async doConfirm(message, detail, primaryButton, confirmedFn) {
        const { confirmed } = await this.dialogService.confirm({ message, detail, primaryButton });
        if (confirmed) {
            confirmedFn();
        }
    }
};
SettingsChangeRelauncher = SettingsChangeRelauncher_1 = __decorate([
    __param(0, IHostService),
    __param(1, IConfigurationService),
    __param(2, IUserDataSyncService),
    __param(3, IUserDataSyncEnablementService),
    __param(4, IUserDataSyncWorkbenchService),
    __param(5, IProductService),
    __param(6, IDialogService)
], SettingsChangeRelauncher);
export { SettingsChangeRelauncher };
class ChangeObserver {
    static create(typeName) {
        return new ChangeObserver(typeName);
    }
    constructor(typeName) {
        this.typeName = typeName;
        this.lastValue = undefined;
    }
    /**
     * Returns if there was a change compared to the last value
     */
    handleChange(value) {
        if (typeof value === this.typeName && value !== this.lastValue) {
            this.lastValue = value;
            return true;
        }
        return false;
    }
}
let WorkspaceChangeExtHostRelauncher = class WorkspaceChangeExtHostRelauncher extends Disposable {
    constructor(contextService, extensionService, hostService, environmentService) {
        super();
        this.contextService = contextService;
        this.extensionHostRestarter = this._register(new RunOnceScheduler(async () => {
            if (!!environmentService.extensionTestsLocationURI) {
                return; // no restart when in tests: see https://github.com/microsoft/vscode/issues/66936
            }
            if (environmentService.remoteAuthority) {
                hostService.reload(); // TODO@aeschli, workaround
            }
            else if (isNative) {
                const stopped = await extensionService.stopExtensionHosts(localize('restartExtensionHost.reason', "Changing workspace folders"));
                if (stopped) {
                    extensionService.startExtensionHosts();
                }
            }
        }, 10));
        this.contextService.getCompleteWorkspace()
            .then(workspace => {
            this.firstFolderResource = workspace.folders.length > 0 ? workspace.folders[0].uri : undefined;
            this.handleWorkbenchState();
            this._register(this.contextService.onDidChangeWorkbenchState(() => setTimeout(() => this.handleWorkbenchState())));
        });
        this._register(toDisposable(() => {
            this.onDidChangeWorkspaceFoldersUnbind?.dispose();
        }));
    }
    handleWorkbenchState() {
        // React to folder changes when we are in workspace state
        if (this.contextService.getWorkbenchState() === 3 /* WorkbenchState.WORKSPACE */) {
            // Update our known first folder path if we entered workspace
            const workspace = this.contextService.getWorkspace();
            this.firstFolderResource = workspace.folders.length > 0 ? workspace.folders[0].uri : undefined;
            // Install workspace folder listener
            if (!this.onDidChangeWorkspaceFoldersUnbind) {
                this.onDidChangeWorkspaceFoldersUnbind = this.contextService.onDidChangeWorkspaceFolders(() => this.onDidChangeWorkspaceFolders());
            }
        }
        // Ignore the workspace folder changes in EMPTY or FOLDER state
        else {
            dispose(this.onDidChangeWorkspaceFoldersUnbind);
            this.onDidChangeWorkspaceFoldersUnbind = undefined;
        }
    }
    onDidChangeWorkspaceFolders() {
        const workspace = this.contextService.getWorkspace();
        // Restart extension host if first root folder changed (impact on deprecated workspace.rootPath API)
        const newFirstFolderResource = workspace.folders.length > 0 ? workspace.folders[0].uri : undefined;
        if (!isEqual(this.firstFolderResource, newFirstFolderResource)) {
            this.firstFolderResource = newFirstFolderResource;
            this.extensionHostRestarter.schedule(); // buffer calls to extension host restart
        }
    }
};
WorkspaceChangeExtHostRelauncher = __decorate([
    __param(0, IWorkspaceContextService),
    __param(1, IExtensionService),
    __param(2, IHostService),
    __param(3, IWorkbenchEnvironmentService)
], WorkspaceChangeExtHostRelauncher);
export { WorkspaceChangeExtHostRelauncher };
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(SettingsChangeRelauncher, 3 /* LifecyclePhase.Restored */);
workbenchRegistry.registerWorkbenchContribution(WorkspaceChangeExtHostRelauncher, 3 /* LifecyclePhase.Restored */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVsYXVuY2hlci5jb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvcmVsYXVuY2hlci9icm93c2VyL3JlbGF1bmNoZXIuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNwRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBZSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN0RyxPQUFPLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNyRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFL0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBa0QscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuSixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsOEJBQThCLEVBQUUsb0JBQW9CLEVBQWMsTUFBTSwwREFBMEQsQ0FBQztBQUU1SSxPQUFPLEVBQUUsd0JBQXdCLEVBQWtCLE1BQU0sb0RBQW9ELENBQUM7QUFDOUcsT0FBTyxFQUEyRCxVQUFVLElBQUksbUJBQW1CLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM5SSxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUMxRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtREFBbUQs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