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
var InstallAction_1, InstallInOtherServerAction_1, UninstallAction_1, UpdateAction_1, ToggleAutoUpdateForExtensionAction_1, ToggleAutoUpdatesForPublisherAction_1, MigrateDeprecatedExtensionAction_1, ManageExtensionAction_1, TogglePreReleaseExtensionAction_1, InstallAnotherVersionAction_1, EnableForWorkspaceAction_1, EnableGloballyAction_1, DisableForWorkspaceAction_1, DisableGloballyAction_1, ExtensionRuntimeStateAction_1, SetColorThemeAction_1, SetFileIconThemeAction_1, SetProductIconThemeAction_1, SetLanguageAction_1, ClearLanguageAction_1, ShowRecommendedExtensionAction_1, InstallRecommendedExtensionAction_1, IgnoreExtensionRecommendationAction_1, UndoIgnoreExtensionRecommendationAction_1, ExtensionStatusLabelAction_1, ToggleSyncExtensionAction_1, ExtensionStatusAction_1, InstallSpecificVersionOfExtensionAction_1;
import './media/extensionActions.css';
import { localize, localize2 } from '../../../../nls.js';
import { Action, Separator, SubmenuAction } from '../../../../base/common/actions.js';
import { Delayer, Promises, Throttler } from '../../../../base/common/async.js';
import * as DOM from '../../../../base/browser/dom.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import * as json from '../../../../base/common/json.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { disposeIfDisposable } from '../../../../base/common/lifecycle.js';
import { IExtensionsWorkbenchService, TOGGLE_IGNORE_EXTENSION_ACTION_ID, SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID, THEME_ACTIONS_GROUP, INSTALL_ACTIONS_GROUP, UPDATE_ACTIONS_GROUP, AutoUpdateConfigurationKey } from '../common/extensions.js';
import { ExtensionsConfigurationInitialContent } from '../common/extensionsFileTemplate.js';
import { IExtensionGalleryService, IAllowedExtensionsService, shouldRequireRepositorySignatureFor } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { IWorkbenchExtensionEnablementService, IExtensionManagementServerService, IWorkbenchExtensionManagementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionIgnoredRecommendationsService, IExtensionRecommendationsService } from '../../../services/extensionRecommendations/common/extensionRecommendations.js';
import { areSameExtensions, getExtensionId } from '../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { ExtensionIdentifier, isLanguagePackExtension, getWorkspaceSupportTypeMessage, isApplicationScopedExtension } from '../../../../platform/extensions/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IExtensionService, toExtension, toExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { URI } from '../../../../base/common/uri.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { registerThemingParticipant } from '../../../../platform/theme/common/themeService.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { buttonBackground, buttonForeground, buttonHoverBackground, registerColor, editorWarningForeground, editorInfoForeground, editorErrorForeground, buttonSeparator } from '../../../../platform/theme/common/colorRegistry.js';
import { IJSONEditingService } from '../../../services/configuration/common/jsonEditing.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { MenuId, IMenuService } from '../../../../platform/actions/common/actions.js';
import { PICK_WORKSPACE_FOLDER_COMMAND_ID } from '../../../browser/actions/workspaceCommands.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { alert } from '../../../../base/browser/ui/aria/aria.js';
import { IWorkbenchThemeService } from '../../../services/themes/common/workbenchThemeService.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { ActionViewItem } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { EXTENSIONS_CONFIG } from '../../../services/extensionRecommendations/common/workspaceExtensionsConfig.js';
import { getErrorMessage, isCancellationError } from '../../../../base/common/errors.js';
import { IUserDataSyncEnablementService } from '../../../../platform/userDataSync/common/userDataSync.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { errorIcon, infoIcon, manageExtensionIcon, syncEnabledIcon, syncIgnoredIcon, trustIcon, warningIcon } from './extensionsIcons.js';
import { isIOS, isWeb, language } from '../../../../base/common/platform.js';
import { IExtensionManifestPropertiesService } from '../../../services/extensions/common/extensionManifestPropertiesService.js';
import { IWorkspaceTrustEnablementService, IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { isVirtualWorkspace } from '../../../../platform/workspace/common/virtualWorkspace.js';
import { createCommandUri, escapeMarkdownSyntaxTokens, MarkdownString } from '../../../../base/common/htmlContent.js';
import { fromNow } from '../../../../base/common/date.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { getLocale } from '../../../../platform/languagePacks/common/languagePacks.js';
import { ILocaleService } from '../../../services/localization/common/locale.js';
import { isString } from '../../../../base/common/types.js';
import { showWindowLogActionId } from '../../../services/log/common/logConstants.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { Extensions, IExtensionFeaturesManagementService } from '../../../services/extensionManagement/common/extensionFeatures.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IUpdateService } from '../../../../platform/update/common/update.js';
import { ActionWithDropdownActionViewItem } from '../../../../base/browser/ui/dropdown/dropdownActionViewItem.js';
import { IAuthenticationUsageService } from '../../../services/authentication/browser/authenticationUsageService.js';
import { IExtensionGalleryManifestService } from '../../../../platform/extensionManagement/common/extensionGalleryManifest.js';
import { IWorkbenchIssueService } from '../../issue/common/issue.js';
import { IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile.js';
let PromptExtensionInstallFailureAction = class PromptExtensionInstallFailureAction extends Action {
    constructor(extension, options, version, installOperation, error, productService, openerService, notificationService, dialogService, commandService, logService, extensionManagementServerService, instantiationService, galleryService, extensionManifestPropertiesService, workbenchIssueService) {
        super('extension.promptExtensionInstallFailure');
        this.extension = extension;
        this.options = options;
        this.version = version;
        this.installOperation = installOperation;
        this.error = error;
        this.productService = productService;
        this.openerService = openerService;
        this.notificationService = notificationService;
        this.dialogService = dialogService;
        this.commandService = commandService;
        this.logService = logService;
        this.extensionManagementServerService = extensionManagementServerService;
        this.instantiationService = instantiationService;
        this.galleryService = galleryService;
        this.extensionManifestPropertiesService = extensionManifestPropertiesService;
        this.workbenchIssueService = workbenchIssueService;
    }
    async run() {
        if (isCancellationError(this.error)) {
            return;
        }
        this.logService.error(this.error);
        if (this.error.name === "Unsupported" /* ExtensionManagementErrorCode.Unsupported */) {
            const productName = isWeb ? localize('VS Code for Web', "{0} for the Web", this.productService.nameLong) : this.productService.nameLong;
            const message = localize('cannot be installed', "The '{0}' extension is not available in {1}. Click 'More Information' to learn more.", this.extension.displayName || this.extension.identifier.id, productName);
            const { confirmed } = await this.dialogService.confirm({
                type: Severity.Info,
                message,
                primaryButton: localize({ key: 'more information', comment: ['&& denotes a mnemonic'] }, "&&More Information"),
                cancelButton: localize('close', "Close")
            });
            if (confirmed) {
                this.openerService.open(isWeb ? URI.parse('https://aka.ms/vscode-web-extensions-guide') : URI.parse('https://aka.ms/vscode-remote'));
            }
            return;
        }
        if ("ReleaseVersionNotFound" /* ExtensionManagementErrorCode.ReleaseVersionNotFound */ === this.error.name) {
            await this.dialogService.prompt({
                type: 'error',
                message: getErrorMessage(this.error),
                buttons: [{
                        label: localize('install prerelease', "Install Pre-Release"),
                        run: () => {
                            const installAction = this.instantiationService.createInstance(InstallAction, { installPreReleaseVersion: true });
                            installAction.extension = this.extension;
                            return installAction.run();
                        }
                    }],
                cancelButton: localize('cancel', "Cancel")
            });
            return;
        }
        if (["Incompatible" /* ExtensionManagementErrorCode.Incompatible */, "IncompatibleApi" /* ExtensionManagementErrorCode.IncompatibleApi */, "IncompatibleTargetPlatform" /* ExtensionManagementErrorCode.IncompatibleTargetPlatform */, "Malicious" /* ExtensionManagementErrorCode.Malicious */, "Deprecated" /* ExtensionManagementErrorCode.Deprecated */].includes(this.error.name)) {
            await this.dialogService.info(getErrorMessage(this.error));
            return;
        }
        if ("PackageNotSigned" /* ExtensionManagementErrorCode.PackageNotSigned */ === this.error.name) {
            await this.dialogService.prompt({
                type: 'error',
                message: localize('not signed', "'{0}' is an extension from an unknown source. Are you sure you want to install?", this.extension.displayName),
                detail: getErrorMessage(this.error),
                buttons: [{
                        label: localize('install anyway', "Install Anyway"),
                        run: () => {
                            const installAction = this.instantiationService.createInstance(InstallAction, { ...this.options, donotVerifySignature: true, });
                            installAction.extension = this.extension;
                            return installAction.run();
                        }
                    }],
                cancelButton: true
            });
            return;
        }
        if ("SignatureVerificationFailed" /* ExtensionManagementErrorCode.SignatureVerificationFailed */ === this.error.name) {
            await this.dialogService.prompt({
                type: 'error',
                message: localize('verification failed', "Cannot install '{0}' extension because {1} cannot verify the extension signature", this.extension.displayName, this.productService.nameLong),
                detail: getErrorMessage(this.error),
                buttons: [{
                        label: localize('learn more', "Learn More"),
                        run: () => this.openerService.open('https://code.visualstudio.com/docs/editor/extension-marketplace#_the-extension-signature-cannot-be-verified-by-vs-code')
                    }, {
                        label: localize('install donot verify', "Install Anyway (Don't Verify Signature)"),
                        run: () => {
                            const installAction = this.instantiationService.createInstance(InstallAction, { ...this.options, donotVerifySignature: true, });
                            installAction.extension = this.extension;
                            return installAction.run();
                        }
                    }],
                cancelButton: true
            });
            return;
        }
        if ("SignatureVerificationInternal" /* ExtensionManagementErrorCode.SignatureVerificationInternal */ === this.error.name) {
            await this.dialogService.prompt({
                type: 'error',
                message: localize('verification failed', "Cannot install '{0}' extension because {1} cannot verify the extension signature", this.extension.displayName, this.productService.nameLong),
                detail: getErrorMessage(this.error),
                buttons: [{
                        label: localize('learn more', "Learn More"),
                        run: () => this.openerService.open('https://code.visualstudio.com/docs/editor/extension-marketplace#_the-extension-signature-cannot-be-verified-by-vs-code')
                    }, {
                        label: localize('report issue', "Report Issue"),
                        run: () => this.workbenchIssueService.openReporter({
                            issueTitle: localize('report issue title', "Extension Signature Verification Failed: {0}", this.extension.displayName),
                            issueBody: localize('report issue body', "Please include following log `F1 > Open View... > Shared` below.\n\n")
                        })
                    }, {
                        label: localize('install donot verify', "Install Anyway (Don't Verify Signature)"),
                        run: () => {
                            const installAction = this.instantiationService.createInstance(InstallAction, { ...this.options, donotVerifySignature: true, });
                            installAction.extension = this.extension;
                            return installAction.run();
                        }
                    }],
                cancelButton: true
            });
            return;
        }
        const operationMessage = this.installOperation === 3 /* InstallOperation.Update */ ? localize('update operation', "Error while updating '{0}' extension.", this.extension.displayName || this.extension.identifier.id)
            : localize('install operation', "Error while installing '{0}' extension.", this.extension.displayName || this.extension.identifier.id);
        let additionalMessage;
        const promptChoices = [];
        const downloadUrl = await this.getDownloadUrl();
        if (downloadUrl) {
            additionalMessage = localize('check logs', "Please check the [log]({0}) for more details.", createCommandUri(showWindowLogActionId).toString());
            promptChoices.push({
                label: localize('download', "Try Downloading Manually..."),
                run: () => this.openerService.open(downloadUrl).then(() => {
                    this.notificationService.prompt(Severity.Info, localize('install vsix', 'Once downloaded, please manually install the downloaded VSIX of \'{0}\'.', this.extension.identifier.id), [{
                            label: localize('installVSIX', "Install from VSIX..."),
                            run: () => this.commandService.executeCommand(SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID)
                        }]);
                })
            });
        }
        const message = `${operationMessage}${additionalMessage ? ` ${additionalMessage}` : ''}`;
        this.notificationService.prompt(Severity.Error, message, promptChoices);
    }
    async getDownloadUrl() {
        if (isIOS) {
            return undefined;
        }
        if (!this.extension.gallery) {
            return undefined;
        }
        if (!this.extensionManagementServerService.localExtensionManagementServer && !this.extensionManagementServerService.remoteExtensionManagementServer) {
            return undefined;
        }
        let targetPlatform = this.extension.gallery.properties.targetPlatform;
        if (targetPlatform !== "universal" /* TargetPlatform.UNIVERSAL */ && targetPlatform !== "undefined" /* TargetPlatform.UNDEFINED */ && this.extensionManagementServerService.remoteExtensionManagementServer) {
            try {
                const manifest = await this.galleryService.getManifest(this.extension.gallery, CancellationToken.None);
                if (manifest && this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(manifest)) {
                    targetPlatform = await this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.getTargetPlatform();
                }
            }
            catch (error) {
                this.logService.error(error);
                return undefined;
            }
        }
        if (targetPlatform === "unknown" /* TargetPlatform.UNKNOWN */) {
            return undefined;
        }
        const [extension] = await this.galleryService.getExtensions([{
                ...this.extension.identifier,
                version: this.version
            }], {
            targetPlatform
        }, CancellationToken.None);
        if (!extension) {
            return undefined;
        }
        return URI.parse(extension.assets.download.uri);
    }
};
PromptExtensionInstallFailureAction = __decorate([
    __param(5, IProductService),
    __param(6, IOpenerService),
    __param(7, INotificationService),
    __param(8, IDialogService),
    __param(9, ICommandService),
    __param(10, ILogService),
    __param(11, IExtensionManagementServerService),
    __param(12, IInstantiationService),
    __param(13, IExtensionGalleryService),
    __param(14, IExtensionManifestPropertiesService),
    __param(15, IWorkbenchIssueService)
], PromptExtensionInstallFailureAction);
export { PromptExtensionInstallFailureAction };
export class ExtensionAction extends Action {
    constructor() {
        super(...arguments);
        this._onDidChange = this._register(new Emitter());
        this._extension = null;
        this._hidden = false;
        this.hideOnDisabled = true;
    }
    get onDidChange() { return this._onDidChange.event; }
    static { this.EXTENSION_ACTION_CLASS = 'extension-action'; }
    static { this.TEXT_ACTION_CLASS = `${ExtensionAction.EXTENSION_ACTION_CLASS} text`; }
    static { this.LABEL_ACTION_CLASS = `${ExtensionAction.EXTENSION_ACTION_CLASS} label`; }
    static { this.PROMINENT_LABEL_ACTION_CLASS = `${ExtensionAction.LABEL_ACTION_CLASS} prominent`; }
    static { this.ICON_ACTION_CLASS = `${ExtensionAction.EXTENSION_ACTION_CLASS} icon`; }
    get extension() { return this._extension; }
    set extension(extension) { this._extension = extension; this.update(); }
    get hidden() { return this._hidden; }
    set hidden(hidden) {
        if (this._hidden !== hidden) {
            this._hidden = hidden;
            this._onDidChange.fire({ hidden });
        }
    }
    _setEnabled(value) {
        super._setEnabled(value);
        if (this.hideOnDisabled) {
            this.hidden = !value;
        }
    }
}
export class ButtonWithDropDownExtensionAction extends ExtensionAction {
    get menuActions() { return [...this._menuActions]; }
    get extension() {
        return super.extension;
    }
    set extension(extension) {
        this.extensionActions.forEach(a => a.extension = extension);
        super.extension = extension;
    }
    constructor(id, clazz, actionsGroups) {
        clazz = `${clazz} action-dropdown`;
        super(id, undefined, clazz);
        this.actionsGroups = actionsGroups;
        this.menuActionClassNames = [];
        this._menuActions = [];
        this.menuActionClassNames = clazz.split(' ');
        this.hideOnDisabled = false;
        this.extensionActions = actionsGroups.flat();
        this.update();
        this._register(Event.any(...this.extensionActions.map(a => a.onDidChange))(() => this.update(true)));
        this.extensionActions.forEach(a => this._register(a));
    }
    update(donotUpdateActions) {
        if (!donotUpdateActions) {
            this.extensionActions.forEach(a => a.update());
        }
        const actionsGroups = this.actionsGroups.map(actionsGroup => actionsGroup.filter(a => !a.hidden));
        let actions = [];
        for (const visibleActions of actionsGroups) {
            if (visibleActions.length) {
                actions = [...actions, ...visibleActions, new Separator()];
            }
        }
        actions = actions.length ? actions.slice(0, actions.length - 1) : actions;
        this.primaryAction = actions[0];
        this._menuActions = actions.length > 1 ? actions : [];
        this._onDidChange.fire({ menuActions: this._menuActions });
        if (this.primaryAction) {
            this.hidden = false;
            this.enabled = this.primaryAction.enabled;
            this.label = this.getLabel(this.primaryAction);
            this.tooltip = this.primaryAction.tooltip;
        }
        else {
            this.hidden = true;
            this.enabled = false;
        }
    }
    async run() {
        if (this.enabled) {
            await this.primaryAction?.run();
        }
    }
    getLabel(action) {
        return action.label;
    }
}
export class ButtonWithDropdownExtensionActionViewItem extends ActionWithDropdownActionViewItem {
    constructor(action, options, contextMenuProvider) {
        super(null, action, options, contextMenuProvider);
        this._register(action.onDidChange(e => {
            if (e.hidden !== undefined || e.menuActions !== undefined) {
                this.updateClass();
            }
        }));
    }
    render(container) {
        super.render(container);
        this.updateClass();
    }
    updateClass() {
        super.updateClass();
        if (this.element && this.dropdownMenuActionViewItem?.element) {
            this.element.classList.toggle('hide', this._action.hidden);
            const isMenuEmpty = this._action.menuActions.length === 0;
            this.element.classList.toggle('empty', isMenuEmpty);
            this.dropdownMenuActionViewItem.element.classList.toggle('hide', isMenuEmpty);
        }
    }
}
let InstallAction = class InstallAction extends ExtensionAction {
    static { InstallAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent install`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    set manifest(manifest) {
        this._manifest = manifest;
        this.updateLabel();
    }
    constructor(options, extensionsWorkbenchService, instantiationService, runtimeExtensionService, workbenchThemeService, labelService, dialogService, preferencesService, telemetryService, contextService, allowedExtensionsService, extensionGalleryManifestService) {
        super('extensions.install', localize('install', "Install"), InstallAction_1.CLASS, false);
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.instantiationService = instantiationService;
        this.runtimeExtensionService = runtimeExtensionService;
        this.workbenchThemeService = workbenchThemeService;
        this.labelService = labelService;
        this.dialogService = dialogService;
        this.preferencesService = preferencesService;
        this.telemetryService = telemetryService;
        this.contextService = contextService;
        this.allowedExtensionsService = allowedExtensionsService;
        this.extensionGalleryManifestService = extensionGalleryManifestService;
        this._manifest = null;
        this.updateThrottler = new Throttler();
        this.hideOnDisabled = false;
        this.options = { isMachineScoped: false, ...options };
        this.update();
        this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(() => this.update()));
        this._register(this.labelService.onDidChangeFormatters(() => this.updateLabel(), this));
    }
    update() {
        this.updateThrottler.queue(() => this.computeAndUpdateEnablement());
    }
    async computeAndUpdateEnablement() {
        this.enabled = false;
        this.class = InstallAction_1.HIDE;
        this.hidden = true;
        if (!this.extension) {
            return;
        }
        if (this.extension.isBuiltin) {
            return;
        }
        if (this.extensionsWorkbenchService.canSetLanguage(this.extension)) {
            return;
        }
        if (this.extension.state !== 3 /* ExtensionState.Uninstalled */) {
            return;
        }
        if (this.options.installPreReleaseVersion && (!this.extension.hasPreReleaseVersion || this.allowedExtensionsService.isAllowed({ id: this.extension.identifier.id, publisherDisplayName: this.extension.publisherDisplayName, prerelease: true }) !== true)) {
            return;
        }
        if (!this.options.installPreReleaseVersion && !this.extension.hasReleaseVersion) {
            return;
        }
        this.hidden = false;
        this.class = InstallAction_1.CLASS;
        if (await this.extensionsWorkbenchService.canInstall(this.extension) === true) {
            this.enabled = true;
            this.updateLabel();
        }
    }
    async run() {
        if (!this.extension) {
            return;
        }
        if (this.extension.gallery && !this.extension.gallery.isSigned && shouldRequireRepositorySignatureFor(this.extension.private, await this.extensionGalleryManifestService.getExtensionGalleryManifest())) {
            const { result } = await this.dialogService.prompt({
                type: Severity.Warning,
                message: localize('not signed', "'{0}' is an extension from an unknown source. Are you sure you want to install?", this.extension.displayName),
                detail: localize('not signed detail', "Extension is not signed."),
                buttons: [
                    {
                        label: localize('install anyway', "Install Anyway"),
                        run: () => {
                            this.options.donotVerifySignature = true;
                            return true;
                        }
                    }
                ],
                cancelButton: {
                    run: () => false
                }
            });
            if (!result) {
                return;
            }
        }
        if (this.extension.deprecationInfo) {
            let detail = localize('deprecated message', "This extension is deprecated as it is no longer being maintained.");
            let DeprecationChoice;
            (function (DeprecationChoice) {
                DeprecationChoice[DeprecationChoice["InstallAnyway"] = 0] = "InstallAnyway";
                DeprecationChoice[DeprecationChoice["ShowAlternateExtension"] = 1] = "ShowAlternateExtension";
                DeprecationChoice[DeprecationChoice["ConfigureSettings"] = 2] = "ConfigureSettings";
                DeprecationChoice[DeprecationChoice["Cancel"] = 3] = "Cancel";
            })(DeprecationChoice || (DeprecationChoice = {}));
            const buttons = [
                {
                    label: localize('install anyway', "Install Anyway"),
                    run: () => DeprecationChoice.InstallAnyway
                }
            ];
            if (this.extension.deprecationInfo.extension) {
                detail = localize('deprecated with alternate extension message', "This extension is deprecated. Use the {0} extension instead.", this.extension.deprecationInfo.extension.displayName);
                const alternateExtension = this.extension.deprecationInfo.extension;
                buttons.push({
                    label: localize({ key: 'Show alternate extension', comment: ['&& denotes a mnemonic'] }, "&&Open {0}", this.extension.deprecationInfo.extension.displayName),
                    run: async () => {
                        const [extension] = await this.extensionsWorkbenchService.getExtensions([{ id: alternateExtension.id, preRelease: alternateExtension.preRelease }], CancellationToken.None);
                        await this.extensionsWorkbenchService.open(extension);
                        return DeprecationChoice.ShowAlternateExtension;
                    }
                });
            }
            else if (this.extension.deprecationInfo.settings) {
                detail = localize('deprecated with alternate settings message', "This extension is deprecated as this functionality is now built-in to VS Code.");
                const settings = this.extension.deprecationInfo.settings;
                buttons.push({
                    label: localize({ key: 'configure in settings', comment: ['&& denotes a mnemonic'] }, "&&Configure Settings"),
                    run: async () => {
                        await this.preferencesService.openSettings({ query: settings.map(setting => `@id:${setting}`).join(' ') });
                        return DeprecationChoice.ConfigureSettings;
                    }
                });
            }
            else if (this.extension.deprecationInfo.additionalInfo) {
                detail = new MarkdownString(`${detail} ${this.extension.deprecationInfo.additionalInfo}`);
            }
            const { result } = await this.dialogService.prompt({
                type: Severity.Warning,
                message: localize('install confirmation', "Are you sure you want to install '{0}'?", this.extension.displayName),
                detail: isString(detail) ? detail : undefined,
                custom: isString(detail) ? undefined : {
                    markdownDetails: [{
                            markdown: detail
                        }]
                },
                buttons,
                cancelButton: {
                    run: () => DeprecationChoice.Cancel
                }
            });
            if (result !== DeprecationChoice.InstallAnyway) {
                return;
            }
        }
        this.extensionsWorkbenchService.open(this.extension, { showPreReleaseVersion: this.options.installPreReleaseVersion });
        alert(localize('installExtensionStart', "Installing extension {0} started. An editor is now open with more details on this extension", this.extension.displayName));
        /* __GDPR__
            "extensions:action:install" : {
                "owner": "sandy081",
                "actionId" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                "${include}": [
                    "${GalleryExtensionTelemetryData}"
                ]
            }
        */
        this.telemetryService.publicLog('extensions:action:install', { ...this.extension.telemetryData, actionId: this.id });
        const extension = await this.install(this.extension);
        if (extension?.local) {
            alert(localize('installExtensionComplete', "Installing extension {0} is completed.", this.extension.displayName));
            const runningExtension = await this.getRunningExtension(extension.local);
            if (runningExtension && !(runningExtension.activationEvents && runningExtension.activationEvents.some(activationEent => activationEent.startsWith('onLanguage')))) {
                const action = await this.getThemeAction(extension);
                if (action) {
                    action.extension = extension;
                    try {
                        return action.run({ showCurrentTheme: true, ignoreFocusLost: true });
                    }
                    finally {
                        action.dispose();
                    }
                }
            }
        }
    }
    async getThemeAction(extension) {
        const colorThemes = await this.workbenchThemeService.getColorThemes();
        if (colorThemes.some(theme => isThemeFromExtension(theme, extension))) {
            return this.instantiationService.createInstance(SetColorThemeAction);
        }
        const fileIconThemes = await this.workbenchThemeService.getFileIconThemes();
        if (fileIconThemes.some(theme => isThemeFromExtension(theme, extension))) {
            return this.instantiationService.createInstance(SetFileIconThemeAction);
        }
        const productIconThemes = await this.workbenchThemeService.getProductIconThemes();
        if (productIconThemes.some(theme => isThemeFromExtension(theme, extension))) {
            return this.instantiationService.createInstance(SetProductIconThemeAction);
        }
        return undefined;
    }
    async install(extension) {
        try {
            return await this.extensionsWorkbenchService.install(extension, this.options);
        }
        catch (error) {
            await this.instantiationService.createInstance(PromptExtensionInstallFailureAction, extension, this.options, extension.latestVersion, 2 /* InstallOperation.Install */, error).run();
            return undefined;
        }
    }
    async getRunningExtension(extension) {
        const runningExtension = await this.runtimeExtensionService.getExtension(extension.identifier.id);
        if (runningExtension) {
            return runningExtension;
        }
        if (this.runtimeExtensionService.canAddExtension(toExtensionDescription(extension))) {
            return new Promise((c, e) => {
                const disposable = this.runtimeExtensionService.onDidChangeExtensions(async () => {
                    const runningExtension = await this.runtimeExtensionService.getExtension(extension.identifier.id);
                    if (runningExtension) {
                        disposable.dispose();
                        c(runningExtension);
                    }
                });
            });
        }
        return null;
    }
    updateLabel() {
        this.label = this.getLabel();
    }
    getLabel(primary) {
        if (this.extension?.isWorkspaceScoped && this.extension.resourceExtension && this.contextService.isInsideWorkspace(this.extension.resourceExtension.location)) {
            return localize('install workspace version', "Install Workspace Extension");
        }
        /* install pre-release version */
        if (this.options.installPreReleaseVersion && this.extension?.hasPreReleaseVersion) {
            return primary ? localize('install pre-release', "Install Pre-Release") : localize('install pre-release version', "Install Pre-Release Version");
        }
        /* install released version that has a pre release version */
        if (this.extension?.hasPreReleaseVersion) {
            return primary ? localize('install', "Install") : localize('install release version', "Install Release Version");
        }
        return localize('install', "Install");
    }
};
InstallAction = InstallAction_1 = __decorate([
    __param(1, IExtensionsWorkbenchService),
    __param(2, IInstantiationService),
    __param(3, IExtensionService),
    __param(4, IWorkbenchThemeService),
    __param(5, ILabelService),
    __param(6, IDialogService),
    __param(7, IPreferencesService),
    __param(8, ITelemetryService),
    __param(9, IWorkspaceContextService),
    __param(10, IAllowedExtensionsService),
    __param(11, IExtensionGalleryManifestService)
], InstallAction);
export { InstallAction };
let InstallDropdownAction = class InstallDropdownAction extends ButtonWithDropDownExtensionAction {
    set manifest(manifest) {
        this.extensionActions.forEach(a => a.manifest = manifest);
        this.update();
    }
    constructor(instantiationService, extensionManagementService) {
        super(`extensions.installActions`, InstallAction.CLASS, [
            [
                instantiationService.createInstance(InstallAction, { installPreReleaseVersion: extensionManagementService.preferPreReleases }),
                instantiationService.createInstance(InstallAction, { installPreReleaseVersion: !extensionManagementService.preferPreReleases }),
            ]
        ]);
    }
    getLabel(action) {
        return action.getLabel(true);
    }
};
InstallDropdownAction = __decorate([
    __param(0, IInstantiationService),
    __param(1, IWorkbenchExtensionManagementService)
], InstallDropdownAction);
export { InstallDropdownAction };
export class InstallingLabelAction extends ExtensionAction {
    static { this.LABEL = localize('installing', "Installing"); }
    static { this.CLASS = `${ExtensionAction.LABEL_ACTION_CLASS} install installing`; }
    constructor() {
        super('extension.installing', InstallingLabelAction.LABEL, InstallingLabelAction.CLASS, false);
    }
    update() {
        this.class = `${InstallingLabelAction.CLASS}${this.extension && this.extension.state === 0 /* ExtensionState.Installing */ ? '' : ' hide'}`;
    }
}
let InstallInOtherServerAction = class InstallInOtherServerAction extends ExtensionAction {
    static { InstallInOtherServerAction_1 = this; }
    static { this.INSTALL_LABEL = localize('install', "Install"); }
    static { this.INSTALLING_LABEL = localize('installing', "Installing"); }
    static { this.Class = `${ExtensionAction.LABEL_ACTION_CLASS} prominent install-other-server`; }
    static { this.InstallingClass = `${ExtensionAction.LABEL_ACTION_CLASS} install-other-server installing`; }
    constructor(id, server, canInstallAnyWhere, extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService) {
        super(id, InstallInOtherServerAction_1.INSTALL_LABEL, InstallInOtherServerAction_1.Class, false);
        this.server = server;
        this.canInstallAnyWhere = canInstallAnyWhere;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionManagementServerService = extensionManagementServerService;
        this.extensionManifestPropertiesService = extensionManifestPropertiesService;
        this.updateWhenCounterExtensionChanges = true;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = InstallInOtherServerAction_1.Class;
        if (this.canInstall()) {
            const extensionInOtherServer = this.extensionsWorkbenchService.installed.filter(e => areSameExtensions(e.identifier, this.extension.identifier) && e.server === this.server)[0];
            if (extensionInOtherServer) {
                // Getting installed in other server
                if (extensionInOtherServer.state === 0 /* ExtensionState.Installing */ && !extensionInOtherServer.local) {
                    this.enabled = true;
                    this.label = InstallInOtherServerAction_1.INSTALLING_LABEL;
                    this.class = InstallInOtherServerAction_1.InstallingClass;
                }
            }
            else {
                // Not installed in other server
                this.enabled = true;
                this.label = this.getInstallLabel();
            }
        }
    }
    canInstall() {
        // Disable if extension is not installed or not an user extension
        if (!this.extension
            || !this.server
            || !this.extension.local
            || this.extension.state !== 1 /* ExtensionState.Installed */
            || this.extension.type !== 1 /* ExtensionType.User */
            || this.extension.enablementState === 2 /* EnablementState.DisabledByEnvironment */ || this.extension.enablementState === 0 /* EnablementState.DisabledByTrustRequirement */ || this.extension.enablementState === 5 /* EnablementState.DisabledByVirtualWorkspace */) {
            return false;
        }
        if (isLanguagePackExtension(this.extension.local.manifest)) {
            return true;
        }
        // Prefers to run on UI
        if (this.server === this.extensionManagementServerService.localExtensionManagementServer && this.extensionManifestPropertiesService.prefersExecuteOnUI(this.extension.local.manifest)) {
            return true;
        }
        // Prefers to run on Workspace
        if (this.server === this.extensionManagementServerService.remoteExtensionManagementServer && this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(this.extension.local.manifest)) {
            return true;
        }
        // Prefers to run on Web
        if (this.server === this.extensionManagementServerService.webExtensionManagementServer && this.extensionManifestPropertiesService.prefersExecuteOnWeb(this.extension.local.manifest)) {
            return true;
        }
        if (this.canInstallAnyWhere) {
            // Can run on UI
            if (this.server === this.extensionManagementServerService.localExtensionManagementServer && this.extensionManifestPropertiesService.canExecuteOnUI(this.extension.local.manifest)) {
                return true;
            }
            // Can run on Workspace
            if (this.server === this.extensionManagementServerService.remoteExtensionManagementServer && this.extensionManifestPropertiesService.canExecuteOnWorkspace(this.extension.local.manifest)) {
                return true;
            }
        }
        return false;
    }
    async run() {
        if (!this.extension?.local) {
            return;
        }
        if (!this.extension?.server) {
            return;
        }
        if (!this.server) {
            return;
        }
        this.extensionsWorkbenchService.open(this.extension);
        alert(localize('installExtensionStart', "Installing extension {0} started. An editor is now open with more details on this extension", this.extension.displayName));
        return this.extensionsWorkbenchService.installInServer(this.extension, this.server);
    }
};
InstallInOtherServerAction = InstallInOtherServerAction_1 = __decorate([
    __param(3, IExtensionsWorkbenchService),
    __param(4, IExtensionManagementServerService),
    __param(5, IExtensionManifestPropertiesService)
], InstallInOtherServerAction);
export { InstallInOtherServerAction };
let RemoteInstallAction = class RemoteInstallAction extends InstallInOtherServerAction {
    constructor(canInstallAnyWhere, extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService) {
        super(`extensions.remoteinstall`, extensionManagementServerService.remoteExtensionManagementServer, canInstallAnyWhere, extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService);
    }
    getInstallLabel() {
        return this.extensionManagementServerService.remoteExtensionManagementServer
            ? localize({ key: 'install in remote', comment: ['This is the name of the action to install an extension in remote server. Placeholder is for the name of remote server.'] }, "Install in {0}", this.extensionManagementServerService.remoteExtensionManagementServer.label)
            : InstallInOtherServerAction.INSTALL_LABEL;
    }
};
RemoteInstallAction = __decorate([
    __param(1, IExtensionsWorkbenchService),
    __param(2, IExtensionManagementServerService),
    __param(3, IExtensionManifestPropertiesService)
], RemoteInstallAction);
export { RemoteInstallAction };
let LocalInstallAction = class LocalInstallAction extends InstallInOtherServerAction {
    constructor(extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService) {
        super(`extensions.localinstall`, extensionManagementServerService.localExtensionManagementServer, false, extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService);
    }
    getInstallLabel() {
        return localize('install locally', "Install Locally");
    }
};
LocalInstallAction = __decorate([
    __param(0, IExtensionsWorkbenchService),
    __param(1, IExtensionManagementServerService),
    __param(2, IExtensionManifestPropertiesService)
], LocalInstallAction);
export { LocalInstallAction };
let WebInstallAction = class WebInstallAction extends InstallInOtherServerAction {
    constructor(extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService) {
        super(`extensions.webInstall`, extensionManagementServerService.webExtensionManagementServer, false, extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService);
    }
    getInstallLabel() {
        return localize('install browser', "Install in Browser");
    }
};
WebInstallAction = __decorate([
    __param(0, IExtensionsWorkbenchService),
    __param(1, IExtensionManagementServerService),
    __param(2, IExtensionManifestPropertiesService)
], WebInstallAction);
export { WebInstallAction };
let UninstallAction = class UninstallAction extends ExtensionAction {
    static { UninstallAction_1 = this; }
    static { this.UninstallLabel = localize('uninstallAction', "Uninstall"); }
    static { this.UninstallingLabel = localize('Uninstalling', "Uninstalling"); }
    static { this.UninstallClass = `${ExtensionAction.LABEL_ACTION_CLASS} uninstall`; }
    static { this.UnInstallingClass = `${ExtensionAction.LABEL_ACTION_CLASS} uninstall uninstalling`; }
    constructor(extensionsWorkbenchService, userDataProfilesService, dialogService) {
        super('extensions.uninstall', UninstallAction_1.UninstallLabel, UninstallAction_1.UninstallClass, false);
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.userDataProfilesService = userDataProfilesService;
        this.dialogService = dialogService;
        this.update();
    }
    update() {
        if (!this.extension) {
            this.enabled = false;
            return;
        }
        const state = this.extension.state;
        if (state === 2 /* ExtensionState.Uninstalling */) {
            this.label = UninstallAction_1.UninstallingLabel;
            this.class = UninstallAction_1.UnInstallingClass;
            this.enabled = false;
            return;
        }
        this.label = this.extension.local?.isApplicationScoped && this.userDataProfilesService.profiles.length > 1 ? localize('uninstallAll', "Uninstall (All Profiles)") : UninstallAction_1.UninstallLabel;
        this.class = UninstallAction_1.UninstallClass;
        this.tooltip = UninstallAction_1.UninstallLabel;
        if (state !== 1 /* ExtensionState.Installed */) {
            this.enabled = false;
            return;
        }
        if (this.extension.isBuiltin) {
            this.enabled = false;
            return;
        }
        this.enabled = true;
    }
    async run() {
        if (!this.extension) {
            return;
        }
        alert(localize('uninstallExtensionStart', "Uninstalling extension {0} started.", this.extension.displayName));
        try {
            await this.extensionsWorkbenchService.uninstall(this.extension);
            alert(localize('uninstallExtensionComplete', "Please reload Visual Studio Code to complete the uninstallation of the extension {0}.", this.extension.displayName));
        }
        catch (error) {
            if (!isCancellationError(error)) {
                this.dialogService.error(getErrorMessage(error));
            }
        }
    }
};
UninstallAction = UninstallAction_1 = __decorate([
    __param(0, IExtensionsWorkbenchService),
    __param(1, IUserDataProfilesService),
    __param(2, IDialogService)
], UninstallAction);
export { UninstallAction };
let UpdateAction = class UpdateAction extends ExtensionAction {
    static { UpdateAction_1 = this; }
    static { this.EnabledClass = `${this.LABEL_ACTION_CLASS} prominent update`; }
    static { this.DisabledClass = `${this.EnabledClass} disabled`; }
    constructor(verbose, extensionsWorkbenchService, dialogService, openerService, instantiationService) {
        super(`extensions.update`, localize('update', "Update"), UpdateAction_1.DisabledClass, false);
        this.verbose = verbose;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.dialogService = dialogService;
        this.openerService = openerService;
        this.instantiationService = instantiationService;
        this.updateThrottler = new Throttler();
        this.update();
    }
    update() {
        this.updateThrottler.queue(() => this.computeAndUpdateEnablement());
        if (this.extension) {
            this.label = this.verbose ? localize('update to', "Update to v{0}", this.extension.latestVersion) : localize('update', "Update");
        }
    }
    async computeAndUpdateEnablement() {
        this.enabled = false;
        this.class = UpdateAction_1.DisabledClass;
        if (!this.extension) {
            return;
        }
        if (this.extension.deprecationInfo) {
            return;
        }
        const canInstall = await this.extensionsWorkbenchService.canInstall(this.extension);
        const isInstalled = this.extension.state === 1 /* ExtensionState.Installed */;
        this.enabled = canInstall === true && isInstalled && this.extension.outdated;
        this.class = this.enabled ? UpdateAction_1.EnabledClass : UpdateAction_1.DisabledClass;
    }
    async run() {
        if (!this.extension) {
            return;
        }
        const consent = await this.extensionsWorkbenchService.shouldRequireConsentToUpdate(this.extension);
        if (consent) {
            const { result } = await this.dialogService.prompt({
                type: 'warning',
                title: localize('updateExtensionConsentTitle', "Update {0} Extension", this.extension.displayName),
                message: localize('updateExtensionConsent', "{0}\n\nWould you like to update the extension?", consent),
                buttons: [{
                        label: localize('update', "Update"),
                        run: () => 'update'
                    }, {
                        label: localize('review', "Review"),
                        run: () => 'review'
                    }, {
                        label: localize('cancel', "Cancel"),
                        run: () => 'cancel'
                    }]
            });
            if (result === 'cancel') {
                return;
            }
            if (result === 'review') {
                if (this.extension.hasChangelog()) {
                    return this.extensionsWorkbenchService.open(this.extension, { tab: "changelog" /* ExtensionEditorTab.Changelog */ });
                }
                if (this.extension.repository) {
                    return this.openerService.open(this.extension.repository);
                }
                return this.extensionsWorkbenchService.open(this.extension);
            }
        }
        const installOptions = {};
        if (this.extension.local?.source === 'vsix' && this.extension.local.pinned) {
            installOptions.pinned = false;
        }
        if (this.extension.local?.preRelease) {
            installOptions.installPreReleaseVersion = true;
        }
        try {
            alert(localize('updateExtensionStart', "Updating extension {0} to version {1} started.", this.extension.displayName, this.extension.latestVersion));
            await this.extensionsWorkbenchService.install(this.extension, installOptions);
            alert(localize('updateExtensionComplete', "Updating extension {0} to version {1} completed.", this.extension.displayName, this.extension.latestVersion));
        }
        catch (err) {
            this.instantiationService.createInstance(PromptExtensionInstallFailureAction, this.extension, installOptions, this.extension.latestVersion, 3 /* InstallOperation.Update */, err).run();
        }
    }
};
UpdateAction = UpdateAction_1 = __decorate([
    __param(1, IExtensionsWorkbenchService),
    __param(2, IDialogService),
    __param(3, IOpenerService),
    __param(4, IInstantiationService)
], UpdateAction);
export { UpdateAction };
let ToggleAutoUpdateForExtensionAction = class ToggleAutoUpdateForExtensionAction extends ExtensionAction {
    static { ToggleAutoUpdateForExtensionAction_1 = this; }
    static { this.ID = 'workbench.extensions.action.toggleAutoUpdateForExtension'; }
    static { this.LABEL = localize2('enableAutoUpdateLabel', "Auto Update"); }
    static { this.EnabledClass = `${ExtensionAction.EXTENSION_ACTION_CLASS} auto-update`; }
    static { this.DisabledClass = `${this.EnabledClass} hide`; }
    constructor(extensionsWorkbenchService, extensionEnablementService, allowedExtensionsService, configurationService) {
        super(ToggleAutoUpdateForExtensionAction_1.ID, ToggleAutoUpdateForExtensionAction_1.LABEL.value, ToggleAutoUpdateForExtensionAction_1.DisabledClass);
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionEnablementService = extensionEnablementService;
        this.allowedExtensionsService = allowedExtensionsService;
        this._register(configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(AutoUpdateConfigurationKey)) {
                this.update();
            }
        }));
        this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(e => this.update()));
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = ToggleAutoUpdateForExtensionAction_1.DisabledClass;
        if (!this.extension) {
            return;
        }
        if (this.extension.isBuiltin) {
            return;
        }
        if (this.extension.deprecationInfo?.disallowInstall) {
            return;
        }
        const extension = this.extension.local ?? this.extension.gallery;
        if (extension && this.allowedExtensionsService.isAllowed(extension) !== true) {
            return;
        }
        if (this.extensionsWorkbenchService.getAutoUpdateValue() === 'onlyEnabledExtensions' && !this.extensionEnablementService.isEnabledEnablementState(this.extension.enablementState)) {
            return;
        }
        this.enabled = true;
        this.class = ToggleAutoUpdateForExtensionAction_1.EnabledClass;
        this.checked = this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension);
    }
    async run() {
        if (!this.extension) {
            return;
        }
        const enableAutoUpdate = !this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension);
        await this.extensionsWorkbenchService.updateAutoUpdateEnablementFor(this.extension, enableAutoUpdate);
        if (enableAutoUpdate) {
            alert(localize('enableAutoUpdate', "Enabled auto updates for", this.extension.displayName));
        }
        else {
            alert(localize('disableAutoUpdate', "Disabled auto updates for", this.extension.displayName));
        }
    }
};
ToggleAutoUpdateForExtensionAction = ToggleAutoUpdateForExtensionAction_1 = __decorate([
    __param(0, IExtensionsWorkbenchService),
    __param(1, IWorkbenchExtensionEnablementService),
    __param(2, IAllowedExtensionsService),
    __param(3, IConfigurationService)
], ToggleAutoUpdateForExtensionAction);
export { ToggleAutoUpdateForExtensionAction };
let ToggleAutoUpdatesForPublisherAction = class ToggleAutoUpdatesForPublisherAction extends ExtensionAction {
    static { ToggleAutoUpdatesForPublisherAction_1 = this; }
    static { this.ID = 'workbench.extensions.action.toggleAutoUpdatesForPublisher'; }
    static { this.LABEL = localize('toggleAutoUpdatesForPublisherLabel', "Auto Update All (From Publisher)"); }
    constructor(extensionsWorkbenchService) {
        super(ToggleAutoUpdatesForPublisherAction_1.ID, ToggleAutoUpdatesForPublisherAction_1.LABEL);
        this.extensionsWorkbenchService = extensionsWorkbenchService;
    }
    update() { }
    async run() {
        if (!this.extension) {
            return;
        }
        alert(localize('ignoreExtensionUpdatePublisher', "Ignoring updates published by {0}.", this.extension.publisherDisplayName));
        const enableAutoUpdate = !this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension.publisher);
        await this.extensionsWorkbenchService.updateAutoUpdateEnablementFor(this.extension.publisher, enableAutoUpdate);
        if (enableAutoUpdate) {
            alert(localize('enableAutoUpdate', "Enabled auto updates for", this.extension.displayName));
        }
        else {
            alert(localize('disableAutoUpdate', "Disabled auto updates for", this.extension.displayName));
        }
    }
};
ToggleAutoUpdatesForPublisherAction = ToggleAutoUpdatesForPublisherAction_1 = __decorate([
    __param(0, IExtensionsWorkbenchService)
], ToggleAutoUpdatesForPublisherAction);
export { ToggleAutoUpdatesForPublisherAction };
let MigrateDeprecatedExtensionAction = class MigrateDeprecatedExtensionAction extends ExtensionAction {
    static { MigrateDeprecatedExtensionAction_1 = this; }
    static { this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} migrate`; }
    static { this.DisabledClass = `${this.EnabledClass} disabled`; }
    constructor(small, extensionsWorkbenchService) {
        super('extensionsAction.migrateDeprecatedExtension', localize('migrateExtension', "Migrate"), MigrateDeprecatedExtensionAction_1.DisabledClass, false);
        this.small = small;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = MigrateDeprecatedExtensionAction_1.DisabledClass;
        if (!this.extension?.local) {
            return;
        }
        if (this.extension.state !== 1 /* ExtensionState.Installed */) {
            return;
        }
        if (!this.extension.deprecationInfo?.extension) {
            return;
        }
        const id = this.extension.deprecationInfo.extension.id;
        if (this.extensionsWorkbenchService.local.some(e => areSameExtensions(e.identifier, { id }))) {
            return;
        }
        this.enabled = true;
        this.class = MigrateDeprecatedExtensionAction_1.EnabledClass;
        this.tooltip = localize('migrate to', "Migrate to {0}", this.extension.deprecationInfo.extension.displayName);
        this.label = this.small ? localize('migrate', "Migrate") : this.tooltip;
    }
    async run() {
        if (!this.extension?.deprecationInfo?.extension) {
            return;
        }
        const local = this.extension.local;
        await this.extensionsWorkbenchService.uninstall(this.extension);
        const [extension] = await this.extensionsWorkbenchService.getExtensions([{ id: this.extension.deprecationInfo.extension.id, preRelease: this.extension.deprecationInfo?.extension?.preRelease }], CancellationToken.None);
        await this.extensionsWorkbenchService.install(extension, { isMachineScoped: local?.isMachineScoped });
    }
};
MigrateDeprecatedExtensionAction = MigrateDeprecatedExtensionAction_1 = __decorate([
    __param(1, IExtensionsWorkbenchService)
], MigrateDeprecatedExtensionAction);
export { MigrateDeprecatedExtensionAction };
let DropDownExtensionAction = class DropDownExtensionAction extends ExtensionAction {
    constructor(id, label, cssClass, enabled, instantiationService) {
        super(id, label, cssClass, enabled);
        this.instantiationService = instantiationService;
        this._actionViewItem = null;
    }
    createActionViewItem(options) {
        this._actionViewItem = this.instantiationService.createInstance(DropDownExtensionActionViewItem, this, options);
        return this._actionViewItem;
    }
    run(actionGroups) {
        this._actionViewItem?.showMenu(actionGroups);
        return Promise.resolve();
    }
};
DropDownExtensionAction = __decorate([
    __param(4, IInstantiationService)
], DropDownExtensionAction);
export { DropDownExtensionAction };
let DropDownExtensionActionViewItem = class DropDownExtensionActionViewItem extends ActionViewItem {
    constructor(action, options, contextMenuService) {
        super(null, action, { ...options, icon: true, label: true });
        this.contextMenuService = contextMenuService;
    }
    showMenu(menuActionGroups) {
        if (this.element) {
            const actions = this.getActions(menuActionGroups);
            const elementPosition = DOM.getDomNodePagePosition(this.element);
            const anchor = { x: elementPosition.left, y: elementPosition.top + elementPosition.height + 10 };
            this.contextMenuService.showContextMenu({
                getAnchor: () => anchor,
                getActions: () => actions,
                actionRunner: this.actionRunner,
                onHide: () => disposeIfDisposable(actions)
            });
        }
    }
    getActions(menuActionGroups) {
        let actions = [];
        for (const menuActions of menuActionGroups) {
            actions = [...actions, ...menuActions, new Separator()];
        }
        return actions.length ? actions.slice(0, actions.length - 1) : actions;
    }
};
DropDownExtensionActionViewItem = __decorate([
    __param(2, IContextMenuService)
], DropDownExtensionActionViewItem);
export { DropDownExtensionActionViewItem };
async function getContextMenuActionsGroups(extension, contextKeyService, instantiationService) {
    return instantiationService.invokeFunction(async (accessor) => {
        const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const extensionEnablementService = accessor.get(IWorkbenchExtensionEnablementService);
        const menuService = accessor.get(IMenuService);
        const extensionRecommendationsService = accessor.get(IExtensionRecommendationsService);
        const extensionIgnoredRecommendationsService = accessor.get(IExtensionIgnoredRecommendationsService);
        const workbenchThemeService = accessor.get(IWorkbenchThemeService);
        const authenticationUsageService = accessor.get(IAuthenticationUsageService);
        const allowedExtensionsService = accessor.get(IAllowedExtensionsService);
        const cksOverlay = [];
        if (extension) {
            cksOverlay.push(['extension', extension.identifier.id]);
            cksOverlay.push(['isBuiltinExtension', extension.isBuiltin]);
            cksOverlay.push(['isDefaultApplicationScopedExtension', extension.local && isApplicationScopedExtension(extension.local.manifest)]);
            cksOverlay.push(['isApplicationScopedExtension', extension.local && extension.local.isApplicationScoped]);
            cksOverlay.push(['isWorkspaceScopedExtension', extension.isWorkspaceScoped]);
            cksOverlay.push(['isGalleryExtension', !!extension.identifier.uuid]);
            if (extension.local) {
                cksOverlay.push(['extensionSource', extension.local.source]);
            }
            cksOverlay.push(['extensionHasConfiguration', extension.local && !!extension.local.manifest.contributes && !!extension.local.manifest.contributes.configuration]);
            cksOverlay.push(['extensionHasKeybindings', extension.local && !!extension.local.manifest.contributes && !!extension.local.manifest.contributes.keybindings]);
            cksOverlay.push(['extensionHasCommands', extension.local && !!extension.local.manifest.contributes && !!extension.local.manifest.contributes?.commands]);
            cksOverlay.push(['isExtensionRecommended', !!extensionRecommendationsService.getAllRecommendationsWithReason()[extension.identifier.id.toLowerCase()]]);
            cksOverlay.push(['isExtensionWorkspaceRecommended', extensionRecommendationsService.getAllRecommendationsWithReason()[extension.identifier.id.toLowerCase()]?.reasonId === 0 /* ExtensionRecommendationReason.Workspace */]);
            cksOverlay.push(['isUserIgnoredRecommendation', extensionIgnoredRecommendationsService.globalIgnoredRecommendations.some(e => e === extension.identifier.id.toLowerCase())]);
            cksOverlay.push(['isExtensionPinned', extension.pinned]);
            cksOverlay.push(['isExtensionEnabled', extensionEnablementService.isEnabledEnablementState(extension.enablementState)]);
            switch (extension.state) {
                case 0 /* ExtensionState.Installing */:
                    cksOverlay.push(['extensionStatus', 'installing']);
                    break;
                case 1 /* ExtensionState.Installed */:
                    cksOverlay.push(['extensionStatus', 'installed']);
                    break;
                case 2 /* ExtensionState.Uninstalling */:
                    cksOverlay.push(['extensionStatus', 'uninstalling']);
                    break;
                case 3 /* ExtensionState.Uninstalled */:
                    cksOverlay.push(['extensionStatus', 'uninstalled']);
                    break;
            }
            cksOverlay.push(['installedExtensionIsPreReleaseVersion', !!extension.local?.isPreReleaseVersion]);
            cksOverlay.push(['installedExtensionIsOptedToPreRelease', !!extension.local?.preRelease]);
            cksOverlay.push(['galleryExtensionIsPreReleaseVersion', !!extension.gallery?.properties.isPreReleaseVersion]);
            cksOverlay.push(['galleryExtensionHasPreReleaseVersion', extension.gallery?.hasPreReleaseVersion]);
            cksOverlay.push(['extensionHasPreReleaseVersion', extension.hasPreReleaseVersion]);
            cksOverlay.push(['extensionHasReleaseVersion', extension.hasReleaseVersion]);
            cksOverlay.push(['extensionDisallowInstall', extension.isMalicious || extension.deprecationInfo?.disallowInstall]);
            cksOverlay.push(['isExtensionAllowed', allowedExtensionsService.isAllowed({ id: extension.identifier.id, publisherDisplayName: extension.publisherDisplayName }) === true]);
            cksOverlay.push(['isPreReleaseExtensionAllowed', allowedExtensionsService.isAllowed({ id: extension.identifier.id, publisherDisplayName: extension.publisherDisplayName, prerelease: true }) === true]);
            cksOverlay.push(['extensionIsUnsigned', extension.gallery && !extension.gallery.isSigned]);
            cksOverlay.push(['extensionIsPrivate', extension.gallery?.private]);
            const [colorThemes, fileIconThemes, productIconThemes, extensionUsesAuth] = await Promise.all([workbenchThemeService.getColorThemes(), workbenchThemeService.getFileIconThemes(), workbenchThemeService.getProductIconThemes(), authenticationUsageService.extensionUsesAuth(extension.identifier.id.toLowerCase())]);
            cksOverlay.push(['extensionHasColorThemes', colorThemes.some(theme => isThemeFromExtension(theme, extension))]);
            cksOverlay.push(['extensionHasFileIconThemes', fileIconThemes.some(theme => isThemeFromExtension(theme, extension))]);
            cksOverlay.push(['extensionHasProductIconThemes', productIconThemes.some(theme => isThemeFromExtension(theme, extension))]);
            cksOverlay.push(['extensionHasAccountPreferences', extensionUsesAuth]);
            cksOverlay.push(['canSetLanguage', extensionsWorkbenchService.canSetLanguage(extension)]);
            cksOverlay.push(['isActiveLanguagePackExtension', extension.gallery && language === getLocale(extension.gallery)]);
        }
        const actionsGroups = menuService.getMenuActions(MenuId.ExtensionContext, contextKeyService.createOverlay(cksOverlay), { shouldForwardArgs: true });
        return actionsGroups;
    });
}
function toActions(actionsGroups, instantiationService) {
    const result = [];
    for (const [, actions] of actionsGroups) {
        result.push(actions.map(action => {
            if (action instanceof SubmenuAction) {
                return action;
            }
            return instantiationService.createInstance(MenuItemExtensionAction, action);
        }));
    }
    return result;
}
export async function getContextMenuActions(extension, contextKeyService, instantiationService) {
    const actionsGroups = await getContextMenuActionsGroups(extension, contextKeyService, instantiationService);
    return toActions(actionsGroups, instantiationService);
}
let ManageExtensionAction = class ManageExtensionAction extends DropDownExtensionAction {
    static { ManageExtensionAction_1 = this; }
    static { this.ID = 'extensions.manage'; }
    static { this.Class = `${ExtensionAction.ICON_ACTION_CLASS} manage ` + ThemeIcon.asClassName(manageExtensionIcon); }
    static { this.HideManageExtensionClass = `${this.Class} hide`; }
    constructor(instantiationService, extensionService, contextKeyService) {
        super(ManageExtensionAction_1.ID, '', '', true, instantiationService);
        this.extensionService = extensionService;
        this.contextKeyService = contextKeyService;
        this.tooltip = localize('manage', "Manage");
        this.update();
    }
    async getActionGroups() {
        const groups = [];
        const contextMenuActionsGroups = await getContextMenuActionsGroups(this.extension, this.contextKeyService, this.instantiationService);
        const themeActions = [], installActions = [], updateActions = [], otherActionGroups = [];
        for (const [group, actions] of contextMenuActionsGroups) {
            if (group === INSTALL_ACTIONS_GROUP) {
                installActions.push(...toActions([[group, actions]], this.instantiationService)[0]);
            }
            else if (group === UPDATE_ACTIONS_GROUP) {
                updateActions.push(...toActions([[group, actions]], this.instantiationService)[0]);
            }
            else if (group === THEME_ACTIONS_GROUP) {
                themeActions.push(...toActions([[group, actions]], this.instantiationService)[0]);
            }
            else {
                otherActionGroups.push(...toActions([[group, actions]], this.instantiationService));
            }
        }
        if (themeActions.length) {
            groups.push(themeActions);
        }
        groups.push([
            this.instantiationService.createInstance(EnableGloballyAction),
            this.instantiationService.createInstance(EnableForWorkspaceAction)
        ]);
        groups.push([
            this.instantiationService.createInstance(DisableGloballyAction),
            this.instantiationService.createInstance(DisableForWorkspaceAction)
        ]);
        if (updateActions.length) {
            groups.push(updateActions);
        }
        groups.push([
            ...(installActions.length ? installActions : []),
            this.instantiationService.createInstance(InstallAnotherVersionAction, this.extension, false),
            this.instantiationService.createInstance(UninstallAction),
        ]);
        otherActionGroups.forEach(actions => groups.push(actions));
        groups.forEach(group => group.forEach(extensionAction => {
            if (extensionAction instanceof ExtensionAction) {
                extensionAction.extension = this.extension;
            }
        }));
        return groups;
    }
    async run() {
        await this.extensionService.whenInstalledExtensionsRegistered();
        return super.run(await this.getActionGroups());
    }
    update() {
        this.class = ManageExtensionAction_1.HideManageExtensionClass;
        this.enabled = false;
        if (this.extension) {
            const state = this.extension.state;
            this.enabled = state === 1 /* ExtensionState.Installed */;
            this.class = this.enabled || state === 2 /* ExtensionState.Uninstalling */ ? ManageExtensionAction_1.Class : ManageExtensionAction_1.HideManageExtensionClass;
        }
    }
};
ManageExtensionAction = ManageExtensionAction_1 = __decorate([
    __param(0, IInstantiationService),
    __param(1, IExtensionService),
    __param(2, IContextKeyService)
], ManageExtensionAction);
export { ManageExtensionAction };
export class ExtensionEditorManageExtensionAction extends DropDownExtensionAction {
    constructor(contextKeyService, instantiationService) {
        super('extensionEditor.manageExtension', '', `${ExtensionAction.ICON_ACTION_CLASS} manage ${ThemeIcon.asClassName(manageExtensionIcon)}`, true, instantiationService);
        this.contextKeyService = contextKeyService;
        this.tooltip = localize('manage', "Manage");
    }
    update() { }
    async run() {
        const actionGroups = [];
        (await getContextMenuActions(this.extension, this.contextKeyService, this.instantiationService)).forEach(actions => actionGroups.push(actions));
        actionGroups.forEach(group => group.forEach(extensionAction => {
            if (extensionAction instanceof ExtensionAction) {
                extensionAction.extension = this.extension;
            }
        }));
        return super.run(actionGroups);
    }
}
let MenuItemExtensionAction = class MenuItemExtensionAction extends ExtensionAction {
    constructor(action, extensionsWorkbenchService) {
        super(action.id, action.label);
        this.action = action;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
    }
    get enabled() {
        return this.action.enabled;
    }
    set enabled(value) {
        this.action.enabled = value;
    }
    update() {
        if (!this.extension) {
            return;
        }
        if (this.action.id === TOGGLE_IGNORE_EXTENSION_ACTION_ID) {
            this.checked = !this.extensionsWorkbenchService.isExtensionIgnoredToSync(this.extension);
        }
        else if (this.action.id === ToggleAutoUpdateForExtensionAction.ID) {
            this.checked = this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension);
        }
        else if (this.action.id === ToggleAutoUpdatesForPublisherAction.ID) {
            this.checked = this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension.publisher);
        }
        else {
            this.checked = this.action.checked;
        }
    }
    async run() {
        if (this.extension) {
            const id = this.extension.local ? getExtensionId(this.extension.local.manifest.publisher, this.extension.local.manifest.name)
                : this.extension.gallery ? getExtensionId(this.extension.gallery.publisher, this.extension.gallery.name)
                    : this.extension.identifier.id;
            const extensionArg = {
                id: this.extension.identifier.id,
                version: this.extension.version,
                location: this.extension.local?.location,
                galleryLink: this.extension.url
            };
            await this.action.run(id, extensionArg);
        }
    }
};
MenuItemExtensionAction = __decorate([
    __param(1, IExtensionsWorkbenchService)
], MenuItemExtensionAction);
export { MenuItemExtensionAction };
let TogglePreReleaseExtensionAction = class TogglePreReleaseExtensionAction extends ExtensionAction {
    static { TogglePreReleaseExtensionAction_1 = this; }
    static { this.ID = 'workbench.extensions.action.togglePreRlease'; }
    static { this.LABEL = localize('togglePreRleaseLabel', "Pre-Release"); }
    static { this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} pre-release`; }
    static { this.DisabledClass = `${this.EnabledClass} hide`; }
    constructor(extensionsWorkbenchService, allowedExtensionsService) {
        super(TogglePreReleaseExtensionAction_1.ID, TogglePreReleaseExtensionAction_1.LABEL, TogglePreReleaseExtensionAction_1.DisabledClass);
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.allowedExtensionsService = allowedExtensionsService;
        this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(() => this.update()));
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = TogglePreReleaseExtensionAction_1.DisabledClass;
        if (!this.extension) {
            return;
        }
        if (this.extension.isBuiltin) {
            return;
        }
        if (this.extension.state !== 1 /* ExtensionState.Installed */) {
            return;
        }
        if (!this.extension.hasPreReleaseVersion) {
            return;
        }
        if (!this.extension.gallery) {
            return;
        }
        if (this.extension.preRelease) {
            if (!this.extension.isPreReleaseVersion) {
                return;
            }
            if (this.allowedExtensionsService.isAllowed({ id: this.extension.identifier.id, publisherDisplayName: this.extension.publisherDisplayName }) !== true) {
                return;
            }
        }
        if (!this.extension.preRelease) {
            if (!this.extension.gallery.hasPreReleaseVersion) {
                return;
            }
            if (this.allowedExtensionsService.isAllowed(this.extension.gallery) !== true) {
                return;
            }
        }
        this.enabled = true;
        this.class = TogglePreReleaseExtensionAction_1.EnabledClass;
        if (this.extension.preRelease) {
            this.label = localize('togglePreRleaseDisableLabel', "Switch to Release Version");
            this.tooltip = localize('togglePreRleaseDisableTooltip', "This will switch and enable updates to release versions");
        }
        else {
            this.label = localize('switchToPreReleaseLabel', "Switch to Pre-Release Version");
            this.tooltip = localize('switchToPreReleaseTooltip', "This will switch to pre-release version and enable updates to latest version always");
        }
    }
    async run() {
        if (!this.extension) {
            return;
        }
        this.extensionsWorkbenchService.open(this.extension, { showPreReleaseVersion: !this.extension.preRelease });
        await this.extensionsWorkbenchService.togglePreRelease(this.extension);
    }
};
TogglePreReleaseExtensionAction = TogglePreReleaseExtensionAction_1 = __decorate([
    __param(0, IExtensionsWorkbenchService),
    __param(1, IAllowedExtensionsService)
], TogglePreReleaseExtensionAction);
export { TogglePreReleaseExtensionAction };
let InstallAnotherVersionAction = class InstallAnotherVersionAction extends ExtensionAction {
    static { InstallAnotherVersionAction_1 = this; }
    static { this.ID = 'workbench.extensions.action.install.anotherVersion'; }
    static { this.LABEL = localize('install another version', "Install Specific Version..."); }
    constructor(extension, whenInstalled, extensionsWorkbenchService, extensionManagementService, extensionGalleryService, quickInputService, instantiationService, dialogService, allowedExtensionsService) {
        super(InstallAnotherVersionAction_1.ID, InstallAnotherVersionAction_1.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
        this.whenInstalled = whenInstalled;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionManagementService = extensionManagementService;
        this.extensionGalleryService = extensionGalleryService;
        this.quickInputService = quickInputService;
        this.instantiationService = instantiationService;
        this.dialogService = dialogService;
        this.allowedExtensionsService = allowedExtensionsService;
        this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(() => this.update()));
        this.extension = extension;
        this.update();
    }
    update() {
        this.enabled = !!this.extension && !this.extension.isBuiltin && !!this.extension.identifier.uuid && !this.extension.deprecationInfo
            && this.allowedExtensionsService.isAllowed({ id: this.extension.identifier.id, publisherDisplayName: this.extension.publisherDisplayName }) === true;
        if (this.enabled && this.whenInstalled) {
            this.enabled = !!this.extension?.local && !!this.extension.server && this.extension.state === 1 /* ExtensionState.Installed */;
        }
    }
    async run() {
        if (!this.enabled) {
            return;
        }
        if (!this.extension) {
            return;
        }
        const targetPlatform = this.extension.server ? await this.extension.server.extensionManagementService.getTargetPlatform() : await this.extensionManagementService.getTargetPlatform();
        const allVersions = await this.extensionGalleryService.getAllCompatibleVersions(this.extension.identifier, this.extension.local?.preRelease ?? this.extension.gallery?.properties.isPreReleaseVersion ?? false, targetPlatform);
        if (!allVersions.length) {
            await this.dialogService.info(localize('no versions', "This extension has no other versions."));
            return;
        }
        const picks = allVersions.map((v, i) => {
            return {
                id: v.version,
                label: v.version,
                description: `${fromNow(new Date(Date.parse(v.date)), true)}${v.isPreReleaseVersion ? ` (${localize('pre-release', "pre-release")})` : ''}${v.version === this.extension?.local?.manifest.version ? ` (${localize('current', "current")})` : ''}`,
                ariaLabel: `${v.isPreReleaseVersion ? 'Pre-Release version' : 'Release version'} ${v.version}`,
                isPreReleaseVersion: v.isPreReleaseVersion
            };
        });
        const pick = await this.quickInputService.pick(picks, {
            placeHolder: localize('selectVersion', "Select Version to Install"),
            matchOnDetail: true
        });
        if (pick) {
            if (this.extension.local?.manifest.version === pick.id) {
                return;
            }
            const options = { installPreReleaseVersion: pick.isPreReleaseVersion, version: pick.id };
            try {
                await this.extensionsWorkbenchService.install(this.extension, options);
            }
            catch (error) {
                this.instantiationService.createInstance(PromptExtensionInstallFailureAction, this.extension, options, pick.id, 2 /* InstallOperation.Install */, error).run();
            }
        }
        return null;
    }
};
InstallAnotherVersionAction = InstallAnotherVersionAction_1 = __decorate([
    __param(2, IExtensionsWorkbenchService),
    __param(3, IWorkbenchExtensionManagementService),
    __param(4, IExtensionGalleryService),
    __param(5, IQuickInputService),
    __param(6, IInstantiationService),
    __param(7, IDialogService),
    __param(8, IAllowedExtensionsService)
], InstallAnotherVersionAction);
export { InstallAnotherVersionAction };
let EnableForWorkspaceAction = class EnableForWorkspaceAction extends ExtensionAction {
    static { EnableForWorkspaceAction_1 = this; }
    static { this.ID = 'extensions.enableForWorkspace'; }
    static { this.LABEL = localize('enableForWorkspaceAction', "Enable (Workspace)"); }
    constructor(extensionsWorkbenchService, extensionEnablementService) {
        super(EnableForWorkspaceAction_1.ID, EnableForWorkspaceAction_1.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionEnablementService = extensionEnablementService;
        this.tooltip = localize('enableForWorkspaceActionToolTip', "Enable this extension only in this workspace");
        this.update();
    }
    update() {
        this.enabled = false;
        if (this.extension && this.extension.local && !this.extension.isWorkspaceScoped) {
            this.enabled = this.extension.state === 1 /* ExtensionState.Installed */
                && !this.extensionEnablementService.isEnabled(this.extension.local)
                && this.extensionEnablementService.canChangeWorkspaceEnablement(this.extension.local);
        }
    }
    async run() {
        if (!this.extension) {
            return;
        }
        return this.extensionsWorkbenchService.setEnablement(this.extension, 13 /* EnablementState.EnabledWorkspace */);
    }
};
EnableForWorkspaceAction = EnableForWorkspaceAction_1 = __decorate([
    __param(0, IExtensionsWorkbenchService),
    __param(1, IWorkbenchExtensionEnablementService)
], EnableForWorkspaceAction);
export { EnableForWorkspaceAction };
let EnableGloballyAction = class EnableGloballyAction extends ExtensionAction {
    static { EnableGloballyAction_1 = this; }
    static { this.ID = 'extensions.enableGlobally'; }
    static { this.LABEL = localize('enableGloballyAction', "Enable"); }
    constructor(extensionsWorkbenchService, extensionEnablementService) {
        super(EnableGloballyAction_1.ID, EnableGloballyAction_1.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionEnablementService = extensionEnablementService;
        this.tooltip = localize('enableGloballyActionToolTip', "Enable this extension");
        this.update();
    }
    update() {
        this.enabled = false;
        if (this.extension && this.extension.local && !this.extension.isWorkspaceScoped) {
            this.enabled = this.extension.state === 1 /* ExtensionState.Installed */
                && this.extensionEnablementService.isDisabledGlobally(this.extension.local)
                && this.extensionEnablementService.canChangeEnablement(this.extension.local);
        }
    }
    async run() {
        if (!this.extension) {
            return;
        }
        return this.extensionsWorkbenchService.setEnablement(this.extension, 12 /* EnablementState.EnabledGlobally */);
    }
};
EnableGloballyAction = EnableGloballyAction_1 = __decorate([
    __param(0, IExtensionsWorkbenchService),
    __param(1, IWorkbenchExtensionEnablementService)
], EnableGloballyAction);
export { EnableGloballyAction };
let DisableForWorkspaceAction = class DisableForWorkspaceAction extends ExtensionAction {
    static { DisableForWorkspaceAction_1 = this; }
    static { this.ID = 'extensions.disableForWorkspace'; }
    static { this.LABEL = localize('disableForWorkspaceAction', "Disable (Workspace)"); }
    constructor(workspaceContextService, extensionsWorkbenchService, extensionEnablementService, extensionService) {
        super(DisableForWorkspaceAction_1.ID, DisableForWorkspaceAction_1.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
        this.workspaceContextService = workspaceContextService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionEnablementService = extensionEnablementService;
        this.extensionService = extensionService;
        this.tooltip = localize('disableForWorkspaceActionToolTip', "Disable this extension only in this workspace");
        this.update();
        this._register(this.extensionService.onDidChangeExtensions(() => this.update()));
    }
    update() {
        this.enabled = false;
        if (this.extension && this.extension.local && !this.extension.isWorkspaceScoped && this.extensionService.extensions.some(e => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier) && this.workspaceContextService.getWorkbenchState() !== 1 /* WorkbenchState.EMPTY */)) {
            this.enabled = this.extension.state === 1 /* ExtensionState.Installed */
                && (this.extension.enablementState === 12 /* EnablementState.EnabledGlobally */ || this.extension.enablementState === 13 /* EnablementState.EnabledWorkspace */)
                && this.extensionEnablementService.canChangeWorkspaceEnablement(this.extension.local);
        }
    }
    async run() {
        if (!this.extension) {
            return;
        }
        return this.extensionsWorkbenchService.setEnablement(this.extension, 11 /* EnablementState.DisabledWorkspace */);
    }
};
DisableForWorkspaceAction = DisableForWorkspaceAction_1 = __decorate([
    __param(0, IWorkspaceContextService),
    __param(1, IExtensionsWorkbenchService),
    __param(2, IWorkbenchExtensionEnablementService),
    __param(3, IExtensionService)
], DisableForWorkspaceAction);
export { DisableForWorkspaceAction };
let DisableGloballyAction = class DisableGloballyAction extends ExtensionAction {
    static { DisableGloballyAction_1 = this; }
    static { this.ID = 'extensions.disableGlobally'; }
    static { this.LABEL = localize('disableGloballyAction', "Disable"); }
    constructor(extensionsWorkbenchService, extensionEnablementService, extensionService) {
        super(DisableGloballyAction_1.ID, DisableGloballyAction_1.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionEnablementService = extensionEnablementService;
        this.extensionService = extensionService;
        this.tooltip = localize('disableGloballyActionToolTip', "Disable this extension");
        this.update();
        this._register(this.extensionService.onDidChangeExtensions(() => this.update()));
    }
    update() {
        this.enabled = false;
        if (this.extension && this.extension.local && !this.extension.isWorkspaceScoped && this.extensionService.extensions.some(e => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier))) {
            this.enabled = this.extension.state === 1 /* ExtensionState.Installed */
                && (this.extension.enablementState === 12 /* EnablementState.EnabledGlobally */ || this.extension.enablementState === 13 /* EnablementState.EnabledWorkspace */)
                && this.extensionEnablementService.canChangeEnablement(this.extension.local);
        }
    }
    async run() {
        if (!this.extension) {
            return;
        }
        return this.extensionsWorkbenchService.setEnablement(this.extension, 10 /* EnablementState.DisabledGlobally */);
    }
};
DisableGloballyAction = DisableGloballyAction_1 = __decorate([
    __param(0, IExtensionsWorkbenchService),
    __param(1, IWorkbenchExtensionEnablementService),
    __param(2, IExtensionService)
], DisableGloballyAction);
export { DisableGloballyAction };
let EnableDropDownAction = class EnableDropDownAction extends ButtonWithDropDownExtensionAction {
    constructor(instantiationService) {
        super('extensions.enable', ExtensionAction.LABEL_ACTION_CLASS, [
            [
                instantiationService.createInstance(EnableGloballyAction),
                instantiationService.createInstance(EnableForWorkspaceAction)
            ]
        ]);
    }
};
EnableDropDownAction = __decorate([
    __param(0, IInstantiationService)
], EnableDropDownAction);
export { EnableDropDownAction };
let DisableDropDownAction = class DisableDropDownAction extends ButtonWithDropDownExtensionAction {
    constructor(instantiationService) {
        super('extensions.disable', ExtensionAction.LABEL_ACTION_CLASS, [[
                instantiationService.createInstance(DisableGloballyAction),
                instantiationService.createInstance(DisableForWorkspaceAction)
            ]]);
    }
};
DisableDropDownAction = __decorate([
    __param(0, IInstantiationService)
], DisableDropDownAction);
export { DisableDropDownAction };
let ExtensionRuntimeStateAction = class ExtensionRuntimeStateAction extends ExtensionAction {
    static { ExtensionRuntimeStateAction_1 = this; }
    static { this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} reload`; }
    static { this.DisabledClass = `${this.EnabledClass} disabled`; }
    constructor(hostService, extensionsWorkbenchService, updateService, extensionService, productService, telemetryService) {
        super('extensions.runtimeState', '', ExtensionRuntimeStateAction_1.DisabledClass, false);
        this.hostService = hostService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.updateService = updateService;
        this.extensionService = extensionService;
        this.productService = productService;
        this.telemetryService = telemetryService;
        this.updateWhenCounterExtensionChanges = true;
        this._register(this.extensionService.onDidChangeExtensions(() => this.update()));
        this.update();
    }
    update() {
        this.enabled = false;
        this.tooltip = '';
        this.class = ExtensionRuntimeStateAction_1.DisabledClass;
        if (!this.extension) {
            return;
        }
        const state = this.extension.state;
        if (state === 0 /* ExtensionState.Installing */ || state === 2 /* ExtensionState.Uninstalling */) {
            return;
        }
        if (this.extension.local && this.extension.local.manifest && this.extension.local.manifest.contributes && this.extension.local.manifest.contributes.localizations && this.extension.local.manifest.contributes.localizations.length > 0) {
            return;
        }
        const runtimeState = this.extension.runtimeState;
        if (!runtimeState) {
            return;
        }
        this.enabled = true;
        this.class = ExtensionRuntimeStateAction_1.EnabledClass;
        this.tooltip = runtimeState.reason;
        this.label = runtimeState.action === "reloadWindow" /* ExtensionRuntimeActionType.ReloadWindow */ ? localize('reload window', 'Reload Window')
            : runtimeState.action === "restartExtensions" /* ExtensionRuntimeActionType.RestartExtensions */ ? localize('restart extensions', 'Restart Extensions')
                : runtimeState.action === "quitAndInstall" /* ExtensionRuntimeActionType.QuitAndInstall */ ? localize('restart product', 'Restart to Update')
                    : runtimeState.action === "applyUpdate" /* ExtensionRuntimeActionType.ApplyUpdate */ || runtimeState.action === "downloadUpdate" /* ExtensionRuntimeActionType.DownloadUpdate */ ? localize('update product', 'Update {0}', this.productService.nameShort) : '';
    }
    async run() {
        const runtimeState = this.extension?.runtimeState;
        if (!runtimeState?.action) {
            return;
        }
        this.telemetryService.publicLog2('extensions:runtimestate:action', {
            action: runtimeState.action
        });
        if (runtimeState?.action === "reloadWindow" /* ExtensionRuntimeActionType.ReloadWindow */) {
            return this.hostService.reload();
        }
        else if (runtimeState?.action === "restartExtensions" /* ExtensionRuntimeActionType.RestartExtensions */) {
            return this.extensionsWorkbenchService.updateRunningExtensions();
        }
        else if (runtimeState?.action === "downloadUpdate" /* ExtensionRuntimeActionType.DownloadUpdate */) {
            return this.updateService.downloadUpdate();
        }
        else if (runtimeState?.action === "applyUpdate" /* ExtensionRuntimeActionType.ApplyUpdate */) {
            return this.updateService.applyUpdate();
        }
        else if (runtimeState?.action === "quitAndInstall" /* ExtensionRuntimeActionType.QuitAndInstall */) {
            return this.updateService.quitAndInstall();
        }
    }
};
ExtensionRuntimeStateAction = ExtensionRuntimeStateAction_1 = __decorate([
    __param(0, IHostService),
    __param(1, IExtensionsWorkbenchService),
    __param(2, IUpdateService),
    __param(3, IExtensionService),
    __param(4, IProductService),
    __param(5, ITelemetryService)
], ExtensionRuntimeStateAction);
export { ExtensionRuntimeStateAction };
function isThemeFromExtension(theme, extension) {
    return !!(extension && theme.extensionData && ExtensionIdentifier.equals(theme.extensionData.extensionId, extension.identifier.id));
}
function getQuickPickEntries(themes, currentTheme, extension, showCurrentTheme) {
    const picks = [];
    for (const theme of themes) {
        if (isThemeFromExtension(theme, extension) && !(showCurrentTheme && theme === currentTheme)) {
            picks.push({ label: theme.label, id: theme.id });
        }
    }
    if (showCurrentTheme) {
        picks.push({ type: 'separator', label: localize('current', "current") });
        picks.push({ label: currentTheme.label, id: currentTheme.id });
    }
    return picks;
}
let SetColorThemeAction = class SetColorThemeAction extends ExtensionAction {
    static { SetColorThemeAction_1 = this; }
    static { this.ID = 'workbench.extensions.action.setColorTheme'; }
    static { this.TITLE = localize2('workbench.extensions.action.setColorTheme', 'Set Color Theme'); }
    static { this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} theme`; }
    static { this.DisabledClass = `${this.EnabledClass} disabled`; }
    constructor(extensionService, workbenchThemeService, quickInputService, extensionEnablementService) {
        super(SetColorThemeAction_1.ID, SetColorThemeAction_1.TITLE.value, SetColorThemeAction_1.DisabledClass, false);
        this.workbenchThemeService = workbenchThemeService;
        this.quickInputService = quickInputService;
        this.extensionEnablementService = extensionEnablementService;
        this._register(Event.any(extensionService.onDidChangeExtensions, workbenchThemeService.onDidColorThemeChange)(() => this.update(), this));
        this.update();
    }
    update() {
        this.workbenchThemeService.getColorThemes().then(colorThemes => {
            this.enabled = this.computeEnablement(colorThemes);
            this.class = this.enabled ? SetColorThemeAction_1.EnabledClass : SetColorThemeAction_1.DisabledClass;
        });
    }
    computeEnablement(colorThemes) {
        return !!this.extension && this.extension.state === 1 /* ExtensionState.Installed */ && this.extensionEnablementService.isEnabledEnablementState(this.extension.enablementState) && colorThemes.some(th => isThemeFromExtension(th, this.extension));
    }
    async run({ showCurrentTheme, ignoreFocusLost } = { showCurrentTheme: false, ignoreFocusLost: false }) {
        const colorThemes = await this.workbenchThemeService.getColorThemes();
        if (!this.computeEnablement(colorThemes)) {
            return;
        }
        const currentTheme = this.workbenchThemeService.getColorTheme();
        const delayer = new Delayer(100);
        const picks = getQuickPickEntries(colorThemes, currentTheme, this.extension, showCurrentTheme);
        const pickedTheme = await this.quickInputService.pick(picks, {
            placeHolder: localize('select color theme', "Select Color Theme"),
            onDidFocus: item => delayer.trigger(() => this.workbenchThemeService.setColorTheme(item.id, undefined)),
            ignoreFocusLost
        });
        return this.workbenchThemeService.setColorTheme(pickedTheme ? pickedTheme.id : currentTheme.id, 'auto');
    }
};
SetColorThemeAction = SetColorThemeAction_1 = __decorate([
    __param(0, IExtensionService),
    __param(1, IWorkbenchThemeService),
    __param(2, IQuickInputService),
    __param(3, IWorkbenchExtensionEnablementService)
], SetColorThemeAction);
export { SetColorThemeAction };
let SetFileIconThemeAction = class SetFileIconThemeAction extends ExtensionAction {
    static { SetFileIconThemeAction_1 = this; }
    static { this.ID = 'workbench.extensions.action.setFileIconTheme'; }
    static { this.TITLE = localize2('workbench.extensions.action.setFileIconTheme', 'Set File Icon Theme'); }
    static { this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} theme`; }
    static { this.DisabledClass = `${this.EnabledClass} disabled`; }
    constructor(extensionService, workbenchThemeService, quickInputService, extensionEnablementService) {
        super(SetFileIconThemeAction_1.ID, SetFileIconThemeAction_1.TITLE.value, SetFileIconThemeAction_1.DisabledClass, false);
        this.workbenchThemeService = workbenchThemeService;
        this.quickInputService = quickInputService;
        this.extensionEnablementService = extensionEnablementService;
        this._register(Event.any(extensionService.onDidChangeExtensions, workbenchThemeService.onDidFileIconThemeChange)(() => this.update(), this));
        this.update();
    }
    update() {
        this.workbenchThemeService.getFileIconThemes().then(fileIconThemes => {
            this.enabled = this.computeEnablement(fileIconThemes);
            this.class = this.enabled ? SetFileIconThemeAction_1.EnabledClass : SetFileIconThemeAction_1.DisabledClass;
        });
    }
    computeEnablement(colorThemfileIconThemess) {
        return !!this.extension && this.extension.state === 1 /* ExtensionState.Installed */ && this.extensionEnablementService.isEnabledEnablementState(this.extension.enablementState) && colorThemfileIconThemess.some(th => isThemeFromExtension(th, this.extension));
    }
    async run({ showCurrentTheme, ignoreFocusLost } = { showCurrentTheme: false, ignoreFocusLost: false }) {
        const fileIconThemes = await this.workbenchThemeService.getFileIconThemes();
        if (!this.computeEnablement(fileIconThemes)) {
            return;
        }
        const currentTheme = this.workbenchThemeService.getFileIconTheme();
        const delayer = new Delayer(100);
        const picks = getQuickPickEntries(fileIconThemes, currentTheme, this.extension, showCurrentTheme);
        const pickedTheme = await this.quickInputService.pick(picks, {
            placeHolder: localize('select file icon theme', "Select File Icon Theme"),
            onDidFocus: item => delayer.trigger(() => this.workbenchThemeService.setFileIconTheme(item.id, undefined)),
            ignoreFocusLost
        });
        return this.workbenchThemeService.setFileIconTheme(pickedTheme ? pickedTheme.id : currentTheme.id, 'auto');
    }
};
SetFileIconThemeAction = SetFileIconThemeAction_1 = __decorate([
    __param(0, IExtensionService),
    __param(1, IWorkbenchThemeService),
    __param(2, IQuickInputService),
    __param(3, IWorkbenchExtensionEnablementService)
], SetFileIconThemeAction);
export { SetFileIconThemeAction };
let SetProductIconThemeAction = class SetProductIconThemeAction extends ExtensionAction {
    static { SetProductIconThemeAction_1 = this; }
    static { this.ID = 'workbench.extensions.action.setProductIconTheme'; }
    static { this.TITLE = localize2('workbench.extensions.action.setProductIconTheme', 'Set Product Icon Theme'); }
    static { this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} theme`; }
    static { this.DisabledClass = `${this.EnabledClass} disabled`; }
    constructor(extensionService, workbenchThemeService, quickInputService, extensionEnablementService) {
        super(SetProductIconThemeAction_1.ID, SetProductIconThemeAction_1.TITLE.value, SetProductIconThemeAction_1.DisabledClass, false);
        this.workbenchThemeService = workbenchThemeService;
        this.quickInputService = quickInputService;
        this.extensionEnablementService = extensionEnablementService;
        this._register(Event.any(extensionService.onDidChangeExtensions, workbenchThemeService.onDidProductIconThemeChange)(() => this.update(), this));
        this.update();
    }
    update() {
        this.workbenchThemeService.getProductIconThemes().then(productIconThemes => {
            this.enabled = this.computeEnablement(productIconThemes);
            this.class = this.enabled ? SetProductIconThemeAction_1.EnabledClass : SetProductIconThemeAction_1.DisabledClass;
        });
    }
    computeEnablement(productIconThemes) {
        return !!this.extension && this.extension.state === 1 /* ExtensionState.Installed */ && this.extensionEnablementService.isEnabledEnablementState(this.extension.enablementState) && productIconThemes.some(th => isThemeFromExtension(th, this.extension));
    }
    async run({ showCurrentTheme, ignoreFocusLost } = { showCurrentTheme: false, ignoreFocusLost: false }) {
        const productIconThemes = await this.workbenchThemeService.getProductIconThemes();
        if (!this.computeEnablement(productIconThemes)) {
            return;
        }
        const currentTheme = this.workbenchThemeService.getProductIconTheme();
        const delayer = new Delayer(100);
        const picks = getQuickPickEntries(productIconThemes, currentTheme, this.extension, showCurrentTheme);
        const pickedTheme = await this.quickInputService.pick(picks, {
            placeHolder: localize('select product icon theme', "Select Product Icon Theme"),
            onDidFocus: item => delayer.trigger(() => this.workbenchThemeService.setProductIconTheme(item.id, undefined)),
            ignoreFocusLost
        });
        return this.workbenchThemeService.setProductIconTheme(pickedTheme ? pickedTheme.id : currentTheme.id, 'auto');
    }
};
SetProductIconThemeAction = SetProductIconThemeAction_1 = __decorate([
    __param(0, IExtensionService),
    __param(1, IWorkbenchThemeService),
    __param(2, IQuickInputService),
    __param(3, IWorkbenchExtensionEnablementService)
], SetProductIconThemeAction);
export { SetProductIconThemeAction };
let SetLanguageAction = class SetLanguageAction extends ExtensionAction {
    static { SetLanguageAction_1 = this; }
    static { this.ID = 'workbench.extensions.action.setDisplayLanguage'; }
    static { this.TITLE = localize2('workbench.extensions.action.setDisplayLanguage', 'Set Display Language'); }
    static { this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} language`; }
    static { this.DisabledClass = `${this.EnabledClass} disabled`; }
    constructor(extensionsWorkbenchService) {
        super(SetLanguageAction_1.ID, SetLanguageAction_1.TITLE.value, SetLanguageAction_1.DisabledClass, false);
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = SetLanguageAction_1.DisabledClass;
        if (!this.extension) {
            return;
        }
        if (!this.extensionsWorkbenchService.canSetLanguage(this.extension)) {
            return;
        }
        if (this.extension.gallery && language === getLocale(this.extension.gallery)) {
            return;
        }
        this.enabled = true;
        this.class = SetLanguageAction_1.EnabledClass;
    }
    async run() {
        return this.extension && this.extensionsWorkbenchService.setLanguage(this.extension);
    }
};
SetLanguageAction = SetLanguageAction_1 = __decorate([
    __param(0, IExtensionsWorkbenchService)
], SetLanguageAction);
export { SetLanguageAction };
let ClearLanguageAction = class ClearLanguageAction extends ExtensionAction {
    static { ClearLanguageAction_1 = this; }
    static { this.ID = 'workbench.extensions.action.clearLanguage'; }
    static { this.TITLE = localize2('workbench.extensions.action.clearLanguage', 'Clear Display Language'); }
    static { this.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} language`; }
    static { this.DisabledClass = `${this.EnabledClass} disabled`; }
    constructor(extensionsWorkbenchService, localeService) {
        super(ClearLanguageAction_1.ID, ClearLanguageAction_1.TITLE.value, ClearLanguageAction_1.DisabledClass, false);
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.localeService = localeService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = ClearLanguageAction_1.DisabledClass;
        if (!this.extension) {
            return;
        }
        if (!this.extensionsWorkbenchService.canSetLanguage(this.extension)) {
            return;
        }
        if (this.extension.gallery && language !== getLocale(this.extension.gallery)) {
            return;
        }
        this.enabled = true;
        this.class = ClearLanguageAction_1.EnabledClass;
    }
    async run() {
        return this.extension && this.localeService.clearLocalePreference();
    }
};
ClearLanguageAction = ClearLanguageAction_1 = __decorate([
    __param(0, IExtensionsWorkbenchService),
    __param(1, ILocaleService)
], ClearLanguageAction);
export { ClearLanguageAction };
let ShowRecommendedExtensionAction = class ShowRecommendedExtensionAction extends Action {
    static { ShowRecommendedExtensionAction_1 = this; }
    static { this.ID = 'workbench.extensions.action.showRecommendedExtension'; }
    static { this.LABEL = localize('showRecommendedExtension', "Show Recommended Extension"); }
    constructor(extensionId, extensionWorkbenchService) {
        super(ShowRecommendedExtensionAction_1.ID, ShowRecommendedExtensionAction_1.LABEL, undefined, false);
        this.extensionWorkbenchService = extensionWorkbenchService;
        this.extensionId = extensionId;
    }
    async run() {
        await this.extensionWorkbenchService.openSearch(`@id:${this.extensionId}`);
        const [extension] = await this.extensionWorkbenchService.getExtensions([{ id: this.extensionId }], { source: 'install-recommendation' }, CancellationToken.None);
        if (extension) {
            return this.extensionWorkbenchService.open(extension);
        }
        return null;
    }
};
ShowRecommendedExtensionAction = ShowRecommendedExtensionAction_1 = __decorate([
    __param(1, IExtensionsWorkbenchService)
], ShowRecommendedExtensionAction);
export { ShowRecommendedExtensionAction };
let InstallRecommendedExtensionAction = class InstallRecommendedExtensionAction extends Action {
    static { InstallRecommendedExtensionAction_1 = this; }
    static { this.ID = 'workbench.extensions.action.installRecommendedExtension'; }
    static { this.LABEL = localize('installRecommendedExtension', "Install Recommended Extension"); }
    constructor(extensionId, instantiationService, extensionWorkbenchService) {
        super(InstallRecommendedExtensionAction_1.ID, InstallRecommendedExtensionAction_1.LABEL, undefined, false);
        this.instantiationService = instantiationService;
        this.extensionWorkbenchService = extensionWorkbenchService;
        this.extensionId = extensionId;
    }
    async run() {
        await this.extensionWorkbenchService.openSearch(`@id:${this.extensionId}`);
        const [extension] = await this.extensionWorkbenchService.getExtensions([{ id: this.extensionId }], { source: 'install-recommendation' }, CancellationToken.None);
        if (extension) {
            await this.extensionWorkbenchService.open(extension);
            try {
                await this.extensionWorkbenchService.install(extension);
            }
            catch (err) {
                this.instantiationService.createInstance(PromptExtensionInstallFailureAction, extension, undefined, extension.latestVersion, 2 /* InstallOperation.Install */, err).run();
            }
        }
    }
};
InstallRecommendedExtensionAction = InstallRecommendedExtensionAction_1 = __decorate([
    __param(1, IInstantiationService),
    __param(2, IExtensionsWorkbenchService)
], InstallRecommendedExtensionAction);
export { InstallRecommendedExtensionAction };
let IgnoreExtensionRecommendationAction = class IgnoreExtensionRecommendationAction extends Action {
    static { IgnoreExtensionRecommendationAction_1 = this; }
    static { this.ID = 'extensions.ignore'; }
    static { this.Class = `${ExtensionAction.LABEL_ACTION_CLASS} ignore`; }
    constructor(extension, extensionRecommendationsManagementService) {
        super(IgnoreExtensionRecommendationAction_1.ID, 'Ignore Recommendation');
        this.extension = extension;
        this.extensionRecommendationsManagementService = extensionRecommendationsManagementService;
        this.class = IgnoreExtensionRecommendationAction_1.Class;
        this.tooltip = localize('ignoreExtensionRecommendation', "Do not recommend this extension again");
        this.enabled = true;
    }
    run() {
        this.extensionRecommendationsManagementService.toggleGlobalIgnoredRecommendation(this.extension.identifier.id, true);
        return Promise.resolve();
    }
};
IgnoreExtensionRecommendationAction = IgnoreExtensionRecommendationAction_1 = __decorate([
    __param(1, IExtensionIgnoredRecommendationsService)
], IgnoreExtensionRecommendationAction);
export { IgnoreExtensionRecommendationAction };
let UndoIgnoreExtensionRecommendationAction = class UndoIgnoreExtensionRecommendationAction extends Action {
    static { UndoIgnoreExtensionRecommendationAction_1 = this; }
    static { this.ID = 'extensions.ignore'; }
    static { this.Class = `${ExtensionAction.LABEL_ACTION_CLASS} undo-ignore`; }
    constructor(extension, extensionRecommendationsManagementService) {
        super(UndoIgnoreExtensionRecommendationAction_1.ID, 'Undo');
        this.extension = extension;
        this.extensionRecommendationsManagementService = extensionRecommendationsManagementService;
        this.class = UndoIgnoreExtensionRecommendationAction_1.Class;
        this.tooltip = localize('undo', "Undo");
        this.enabled = true;
    }
    run() {
        this.extensionRecommendationsManagementService.toggleGlobalIgnoredRecommendation(this.extension.identifier.id, false);
        return Promise.resolve();
    }
};
UndoIgnoreExtensionRecommendationAction = UndoIgnoreExtensionRecommendationAction_1 = __decorate([
    __param(1, IExtensionIgnoredRecommendationsService)
], UndoIgnoreExtensionRecommendationAction);
export { UndoIgnoreExtensionRecommendationAction };
let AbstractConfigureRecommendedExtensionsAction = class AbstractConfigureRecommendedExtensionsAction extends Action {
    constructor(id, label, contextService, fileService, textFileService, editorService, jsonEditingService, textModelResolverService) {
        super(id, label);
        this.contextService = contextService;
        this.fileService = fileService;
        this.textFileService = textFileService;
        this.editorService = editorService;
        this.jsonEditingService = jsonEditingService;
        this.textModelResolverService = textModelResolverService;
    }
    openExtensionsFile(extensionsFileResource) {
        return this.getOrCreateExtensionsFile(extensionsFileResource)
            .then(({ created, content }) => this.getSelectionPosition(content, extensionsFileResource, ['recommendations'])
            .then(selection => this.editorService.openEditor({
            resource: extensionsFileResource,
            options: {
                pinned: created,
                selection
            }
        })), error => Promise.reject(new Error(localize('OpenExtensionsFile.failed', "Unable to create 'extensions.json' file inside the '.vscode' folder ({0}).", error))));
    }
    openWorkspaceConfigurationFile(workspaceConfigurationFile) {
        return this.getOrUpdateWorkspaceConfigurationFile(workspaceConfigurationFile)
            .then(content => this.getSelectionPosition(content.value.toString(), content.resource, ['extensions', 'recommendations']))
            .then(selection => this.editorService.openEditor({
            resource: workspaceConfigurationFile,
            options: {
                selection,
                forceReload: true // because content has changed
            }
        }));
    }
    getOrUpdateWorkspaceConfigurationFile(workspaceConfigurationFile) {
        return Promise.resolve(this.fileService.readFile(workspaceConfigurationFile))
            .then(content => {
            const workspaceRecommendations = json.parse(content.value.toString())['extensions'];
            if (!workspaceRecommendations || !workspaceRecommendations.recommendations) {
                return this.jsonEditingService.write(workspaceConfigurationFile, [{ path: ['extensions'], value: { recommendations: [] } }], true)
                    .then(() => this.fileService.readFile(workspaceConfigurationFile));
            }
            return content;
        });
    }
    getSelectionPosition(content, resource, path) {
        const tree = json.parseTree(content);
        const node = json.findNodeAtLocation(tree, path);
        if (node && node.parent && node.parent.children) {
            const recommendationsValueNode = node.parent.children[1];
            const lastExtensionNode = recommendationsValueNode.children && recommendationsValueNode.children.length ? recommendationsValueNode.children[recommendationsValueNode.children.length - 1] : null;
            const offset = lastExtensionNode ? lastExtensionNode.offset + lastExtensionNode.length : recommendationsValueNode.offset + 1;
            return Promise.resolve(this.textModelResolverService.createModelReference(resource))
                .then(reference => {
                const position = reference.object.textEditorModel.getPositionAt(offset);
                reference.dispose();
                return {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                };
            });
        }
        return Promise.resolve(undefined);
    }
    getOrCreateExtensionsFile(extensionsFileResource) {
        return Promise.resolve(this.fileService.readFile(extensionsFileResource)).then(content => {
            return { created: false, extensionsFileResource, content: content.value.toString() };
        }, err => {
            return this.textFileService.write(extensionsFileResource, ExtensionsConfigurationInitialContent).then(() => {
                return { created: true, extensionsFileResource, content: ExtensionsConfigurationInitialContent };
            });
        });
    }
};
AbstractConfigureRecommendedExtensionsAction = __decorate([
    __param(2, IWorkspaceContextService),
    __param(3, IFileService),
    __param(4, ITextFileService),
    __param(5, IEditorService),
    __param(6, IJSONEditingService),
    __param(7, ITextModelService)
], AbstractConfigureRecommendedExtensionsAction);
export { AbstractConfigureRecommendedExtensionsAction };
let ConfigureWorkspaceRecommendedExtensionsAction = class ConfigureWorkspaceRecommendedExtensionsAction extends AbstractConfigureRecommendedExtensionsAction {
    static { this.ID = 'workbench.extensions.action.configureWorkspaceRecommendedExtensions'; }
    static { this.LABEL = localize('configureWorkspaceRecommendedExtensions', "Configure Recommended Extensions (Workspace)"); }
    constructor(id, label, fileService, textFileService, contextService, editorService, jsonEditingService, textModelResolverService) {
        super(id, label, contextService, fileService, textFileService, editorService, jsonEditingService, textModelResolverService);
        this._register(this.contextService.onDidChangeWorkbenchState(() => this.update(), this));
        this.update();
    }
    update() {
        this.enabled = this.contextService.getWorkbenchState() !== 1 /* WorkbenchState.EMPTY */;
    }
    run() {
        switch (this.contextService.getWorkbenchState()) {
            case 2 /* WorkbenchState.FOLDER */:
                return this.openExtensionsFile(this.contextService.getWorkspace().folders[0].toResource(EXTENSIONS_CONFIG));
            case 3 /* WorkbenchState.WORKSPACE */:
                return this.openWorkspaceConfigurationFile(this.contextService.getWorkspace().configuration);
        }
        return Promise.resolve();
    }
};
ConfigureWorkspaceRecommendedExtensionsAction = __decorate([
    __param(2, IFileService),
    __param(3, ITextFileService),
    __param(4, IWorkspaceContextService),
    __param(5, IEditorService),
    __param(6, IJSONEditingService),
    __param(7, ITextModelService)
], ConfigureWorkspaceRecommendedExtensionsAction);
export { ConfigureWorkspaceRecommendedExtensionsAction };
let ConfigureWorkspaceFolderRecommendedExtensionsAction = class ConfigureWorkspaceFolderRecommendedExtensionsAction extends AbstractConfigureRecommendedExtensionsAction {
    static { this.ID = 'workbench.extensions.action.configureWorkspaceFolderRecommendedExtensions'; }
    static { this.LABEL = localize('configureWorkspaceFolderRecommendedExtensions', "Configure Recommended Extensions (Workspace Folder)"); }
    constructor(id, label, fileService, textFileService, contextService, editorService, jsonEditingService, textModelResolverService, commandService) {
        super(id, label, contextService, fileService, textFileService, editorService, jsonEditingService, textModelResolverService);
        this.commandService = commandService;
    }
    run() {
        const folderCount = this.contextService.getWorkspace().folders.length;
        const pickFolderPromise = folderCount === 1 ? Promise.resolve(this.contextService.getWorkspace().folders[0]) : this.commandService.executeCommand(PICK_WORKSPACE_FOLDER_COMMAND_ID);
        return Promise.resolve(pickFolderPromise)
            .then(workspaceFolder => {
            if (workspaceFolder) {
                return this.openExtensionsFile(workspaceFolder.toResource(EXTENSIONS_CONFIG));
            }
            return null;
        });
    }
};
ConfigureWorkspaceFolderRecommendedExtensionsAction = __decorate([
    __param(2, IFileService),
    __param(3, ITextFileService),
    __param(4, IWorkspaceContextService),
    __param(5, IEditorService),
    __param(6, IJSONEditingService),
    __param(7, ITextModelService),
    __param(8, ICommandService)
], ConfigureWorkspaceFolderRecommendedExtensionsAction);
export { ConfigureWorkspaceFolderRecommendedExtensionsAction };
let ExtensionStatusLabelAction = class ExtensionStatusLabelAction extends Action {
    static { ExtensionStatusLabelAction_1 = this; }
    static { this.ENABLED_CLASS = `${ExtensionAction.TEXT_ACTION_CLASS} extension-status-label`; }
    static { this.DISABLED_CLASS = `${this.ENABLED_CLASS} hide`; }
    get extension() { return this._extension; }
    set extension(extension) {
        if (!(this._extension && extension && areSameExtensions(this._extension.identifier, extension.identifier))) {
            // Different extension. Reset
            this.initialStatus = null;
            this.status = null;
            this.enablementState = null;
        }
        this._extension = extension;
        this.update();
    }
    constructor(extensionService, extensionManagementServerService, extensionEnablementService) {
        super('extensions.action.statusLabel', '', ExtensionStatusLabelAction_1.DISABLED_CLASS, false);
        this.extensionService = extensionService;
        this.extensionManagementServerService = extensionManagementServerService;
        this.extensionEnablementService = extensionEnablementService;
        this.initialStatus = null;
        this.status = null;
        this.version = null;
        this.enablementState = null;
        this._extension = null;
    }
    update() {
        const label = this.computeLabel();
        this.label = label || '';
        this.class = label ? ExtensionStatusLabelAction_1.ENABLED_CLASS : ExtensionStatusLabelAction_1.DISABLED_CLASS;
    }
    computeLabel() {
        if (!this.extension) {
            return null;
        }
        const currentStatus = this.status;
        const currentVersion = this.version;
        const currentEnablementState = this.enablementState;
        this.status = this.extension.state;
        this.version = this.extension.version;
        if (this.initialStatus === null) {
            this.initialStatus = this.status;
        }
        this.enablementState = this.extension.enablementState;
        const canAddExtension = () => {
            const runningExtension = this.extensionService.extensions.filter(e => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier))[0];
            if (this.extension.local) {
                if (runningExtension && this.extension.version === runningExtension.version) {
                    return true;
                }
                return this.extensionService.canAddExtension(toExtensionDescription(this.extension.local));
            }
            return false;
        };
        const canRemoveExtension = () => {
            if (this.extension.local) {
                if (this.extensionService.extensions.every(e => !(areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier) && this.extension.server === this.extensionManagementServerService.getExtensionManagementServer(toExtension(e))))) {
                    return true;
                }
                return this.extensionService.canRemoveExtension(toExtensionDescription(this.extension.local));
            }
            return false;
        };
        if (currentStatus !== null) {
            if (currentStatus === 0 /* ExtensionState.Installing */ && this.status === 1 /* ExtensionState.Installed */) {
                if (this.initialStatus === 3 /* ExtensionState.Uninstalled */ && canAddExtension()) {
                    return localize('installed', "Installed");
                }
                if (this.initialStatus === 1 /* ExtensionState.Installed */ && this.version !== currentVersion && canAddExtension()) {
                    return localize('updated', "Updated");
                }
                return null;
            }
            if (currentStatus === 2 /* ExtensionState.Uninstalling */ && this.status === 3 /* ExtensionState.Uninstalled */) {
                this.initialStatus = this.status;
                return canRemoveExtension() ? localize('uninstalled', "Uninstalled") : null;
            }
        }
        if (currentEnablementState !== null) {
            const currentlyEnabled = this.extensionEnablementService.isEnabledEnablementState(currentEnablementState);
            const enabled = this.extensionEnablementService.isEnabledEnablementState(this.enablementState);
            if (!currentlyEnabled && enabled) {
                return canAddExtension() ? localize('enabled', "Enabled") : null;
            }
            if (currentlyEnabled && !enabled) {
                return canRemoveExtension() ? localize('disabled', "Disabled") : null;
            }
        }
        return null;
    }
    run() {
        return Promise.resolve();
    }
};
ExtensionStatusLabelAction = ExtensionStatusLabelAction_1 = __decorate([
    __param(0, IExtensionService),
    __param(1, IExtensionManagementServerService),
    __param(2, IWorkbenchExtensionEnablementService)
], ExtensionStatusLabelAction);
export { ExtensionStatusLabelAction };
let ToggleSyncExtensionAction = class ToggleSyncExtensionAction extends DropDownExtensionAction {
    static { ToggleSyncExtensionAction_1 = this; }
    static { this.IGNORED_SYNC_CLASS = `${ExtensionAction.ICON_ACTION_CLASS} extension-sync ${ThemeIcon.asClassName(syncIgnoredIcon)}`; }
    static { this.SYNC_CLASS = `${this.ICON_ACTION_CLASS} extension-sync ${ThemeIcon.asClassName(syncEnabledIcon)}`; }
    constructor(configurationService, extensionsWorkbenchService, userDataSyncEnablementService, instantiationService) {
        super('extensions.sync', '', ToggleSyncExtensionAction_1.SYNC_CLASS, false, instantiationService);
        this.configurationService = configurationService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.userDataSyncEnablementService = userDataSyncEnablementService;
        this._register(Event.filter(this.configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('settingsSync.ignoredExtensions'))(() => this.update()));
        this._register(userDataSyncEnablementService.onDidChangeEnablement(() => this.update()));
        this.update();
    }
    update() {
        this.enabled = !!this.extension && this.userDataSyncEnablementService.isEnabled() && this.extension.state === 1 /* ExtensionState.Installed */;
        if (this.extension) {
            const isIgnored = this.extensionsWorkbenchService.isExtensionIgnoredToSync(this.extension);
            this.class = isIgnored ? ToggleSyncExtensionAction_1.IGNORED_SYNC_CLASS : ToggleSyncExtensionAction_1.SYNC_CLASS;
            this.tooltip = isIgnored ? localize('ignored', "This extension is ignored during sync") : localize('synced', "This extension is synced");
        }
    }
    async run() {
        return super.run([
            [
                new Action('extensions.syncignore', this.extensionsWorkbenchService.isExtensionIgnoredToSync(this.extension) ? localize('sync', "Sync this extension") : localize('do not sync', "Do not sync this extension"), undefined, true, () => this.extensionsWorkbenchService.toggleExtensionIgnoredToSync(this.extension))
            ]
        ]);
    }
};
ToggleSyncExtensionAction = ToggleSyncExtensionAction_1 = __decorate([
    __param(0, IConfigurationService),
    __param(1, IExtensionsWorkbenchService),
    __param(2, IUserDataSyncEnablementService),
    __param(3, IInstantiationService)
], ToggleSyncExtensionAction);
export { ToggleSyncExtensionAction };
let ExtensionStatusAction = class ExtensionStatusAction extends ExtensionAction {
    static { ExtensionStatusAction_1 = this; }
    static { this.CLASS = `${ExtensionAction.ICON_ACTION_CLASS} extension-status`; }
    get status() { return this._status; }
    constructor(extensionManagementServerService, labelService, commandService, workspaceTrustEnablementService, workspaceTrustService, extensionsWorkbenchService, extensionService, extensionManifestPropertiesService, contextService, productService, allowedExtensionsService, workbenchExtensionEnablementService, extensionFeaturesManagementService, extensionGalleryManifestService) {
        super('extensions.status', '', `${ExtensionStatusAction_1.CLASS} hide`, false);
        this.extensionManagementServerService = extensionManagementServerService;
        this.labelService = labelService;
        this.commandService = commandService;
        this.workspaceTrustEnablementService = workspaceTrustEnablementService;
        this.workspaceTrustService = workspaceTrustService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionService = extensionService;
        this.extensionManifestPropertiesService = extensionManifestPropertiesService;
        this.contextService = contextService;
        this.productService = productService;
        this.allowedExtensionsService = allowedExtensionsService;
        this.workbenchExtensionEnablementService = workbenchExtensionEnablementService;
        this.extensionFeaturesManagementService = extensionFeaturesManagementService;
        this.extensionGalleryManifestService = extensionGalleryManifestService;
        this.updateWhenCounterExtensionChanges = true;
        this._status = [];
        this._onDidChangeStatus = this._register(new Emitter());
        this.onDidChangeStatus = this._onDidChangeStatus.event;
        this.updateThrottler = new Throttler();
        this._register(this.labelService.onDidChangeFormatters(() => this.update(), this));
        this._register(this.extensionService.onDidChangeExtensions(() => this.update()));
        this._register(this.extensionFeaturesManagementService.onDidChangeAccessData(() => this.update()));
        this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(() => this.update()));
        this.update();
    }
    update() {
        this.updateThrottler.queue(() => this.computeAndUpdateStatus());
    }
    async computeAndUpdateStatus() {
        this.updateStatus(undefined, true);
        this.enabled = false;
        if (!this.extension) {
            return;
        }
        if (this.extension.isMalicious) {
            this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize('malicious tooltip', "This extension was reported to be problematic.")) }, true);
            return;
        }
        if (this.extension.state === 3 /* ExtensionState.Uninstalled */ && this.extension.gallery && !this.extension.gallery.isSigned && shouldRequireRepositorySignatureFor(this.extension.private, await this.extensionGalleryManifestService.getExtensionGalleryManifest())) {
            this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize('not signed tooltip', "This extension is not signed by the Extension Marketplace.")) }, true);
            return;
        }
        if (this.extension.deprecationInfo) {
            if (this.extension.deprecationInfo.extension) {
                const link = `[${this.extension.deprecationInfo.extension.displayName}](${createCommandUri('extension.open', this.extension.deprecationInfo.extension.id)})`;
                this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize('deprecated with alternate extension tooltip', "This extension is deprecated. Use the {0} extension instead.", link)) }, true);
            }
            else if (this.extension.deprecationInfo.settings) {
                const link = `[${localize('settings', "settings")}](${createCommandUri('workbench.action.openSettings', this.extension.deprecationInfo.settings.map(setting => `@id:${setting}`).join(' '))}})`;
                this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize('deprecated with alternate settings tooltip', "This extension is deprecated as this functionality is now built-in to VS Code. Configure these {0} to use this functionality.", link)) }, true);
            }
            else {
                const message = new MarkdownString(localize('deprecated tooltip', "This extension is deprecated as it is no longer being maintained."));
                if (this.extension.deprecationInfo.additionalInfo) {
                    message.appendMarkdown(` ${this.extension.deprecationInfo.additionalInfo}`);
                }
                this.updateStatus({ icon: warningIcon, message }, true);
            }
            return;
        }
        if (this.extension.missingFromGallery) {
            this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize('missing from gallery tooltip', "This extension is no longer available on the Extension Marketplace.")) }, true);
            return;
        }
        if (this.extensionsWorkbenchService.canSetLanguage(this.extension)) {
            return;
        }
        if (this.extension.outdated) {
            const message = await this.extensionsWorkbenchService.shouldRequireConsentToUpdate(this.extension);
            if (message) {
                const markdown = new MarkdownString();
                markdown.appendMarkdown(`${message} `);
                markdown.appendMarkdown(localize('auto update message', "Please [review the extension]({0}) and update it manually.", this.extension.hasChangelog()
                    ? createCommandUri('extension.open', this.extension.identifier.id, "changelog" /* ExtensionEditorTab.Changelog */).toString()
                    : this.extension.repository
                        ? this.extension.repository
                        : createCommandUri('extension.open', this.extension.identifier.id).toString()));
                this.updateStatus({ icon: warningIcon, message: markdown }, true);
            }
        }
        if (this.extension.gallery && this.extension.state === 3 /* ExtensionState.Uninstalled */) {
            const result = await this.extensionsWorkbenchService.canInstall(this.extension);
            if (result !== true) {
                this.updateStatus({ icon: warningIcon, message: result }, true);
                return;
            }
        }
        if (!this.extension.local ||
            !this.extension.server ||
            this.extension.state !== 1 /* ExtensionState.Installed */) {
            return;
        }
        // Extension is disabled by allowed list
        if (this.extension.enablementState === 7 /* EnablementState.DisabledByAllowlist */) {
            const result = this.allowedExtensionsService.isAllowed(this.extension.local);
            if (result !== true) {
                this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize('disabled - not allowed', "This extension is disabled because {0}", result.value)) }, true);
                return;
            }
        }
        // Extension is disabled by environment
        if (this.extension.enablementState === 2 /* EnablementState.DisabledByEnvironment */) {
            this.updateStatus({ message: new MarkdownString(localize('disabled by environment', "This extension is disabled by the environment.")) }, true);
            return;
        }
        // Extension is enabled by environment
        if (this.extension.enablementState === 3 /* EnablementState.EnabledByEnvironment */) {
            this.updateStatus({ message: new MarkdownString(localize('enabled by environment', "This extension is enabled because it is required in the current environment.")) }, true);
            return;
        }
        // Extension is disabled by virtual workspace
        if (this.extension.enablementState === 5 /* EnablementState.DisabledByVirtualWorkspace */) {
            const details = getWorkspaceSupportTypeMessage(this.extension.local.manifest.capabilities?.virtualWorkspaces);
            this.updateStatus({ icon: infoIcon, message: new MarkdownString(details ? escapeMarkdownSyntaxTokens(details) : localize('disabled because of virtual workspace', "This extension has been disabled because it does not support virtual workspaces.")) }, true);
            return;
        }
        // Limited support in Virtual Workspace
        if (isVirtualWorkspace(this.contextService.getWorkspace())) {
            const virtualSupportType = this.extensionManifestPropertiesService.getExtensionVirtualWorkspaceSupportType(this.extension.local.manifest);
            const details = getWorkspaceSupportTypeMessage(this.extension.local.manifest.capabilities?.virtualWorkspaces);
            if (virtualSupportType === 'limited' || details) {
                this.updateStatus({ icon: warningIcon, message: new MarkdownString(details ? escapeMarkdownSyntaxTokens(details) : localize('extension limited because of virtual workspace', "This extension has limited features because the current workspace is virtual.")) }, true);
                return;
            }
        }
        // Unification
        if (this.extension.enablementState === 9 /* EnablementState.DisabledByUnification */) {
            this.updateStatus({ icon: infoIcon, message: new MarkdownString(localize('extension disabled because of unification', "All GitHub Copilot functionality is now being served from the GitHub Copilot Chat extension. To temporarily opt out of this extension unification, toggle the {0} setting.", '`chat.extensionUnification.enabled`')) }, true);
            return;
        }
        if (!this.workspaceTrustService.isWorkspaceTrusted() &&
            // Extension is disabled by untrusted workspace
            (this.extension.enablementState === 0 /* EnablementState.DisabledByTrustRequirement */ ||
                // All disabled dependencies of the extension are disabled by untrusted workspace
                (this.extension.enablementState === 8 /* EnablementState.DisabledByExtensionDependency */ && this.workbenchExtensionEnablementService.getDependenciesEnablementStates(this.extension.local).every(([, enablementState]) => this.workbenchExtensionEnablementService.isEnabledEnablementState(enablementState) || enablementState === 0 /* EnablementState.DisabledByTrustRequirement */)))) {
            this.enabled = true;
            const untrustedDetails = getWorkspaceSupportTypeMessage(this.extension.local.manifest.capabilities?.untrustedWorkspaces);
            this.updateStatus({ icon: trustIcon, message: new MarkdownString(untrustedDetails ? escapeMarkdownSyntaxTokens(untrustedDetails) : localize('extension disabled because of trust requirement', "This extension has been disabled because the current workspace is not trusted.")) }, true);
            return;
        }
        // Limited support in Untrusted Workspace
        if (this.workspaceTrustEnablementService.isWorkspaceTrustEnabled() && !this.workspaceTrustService.isWorkspaceTrusted()) {
            const untrustedSupportType = this.extensionManifestPropertiesService.getExtensionUntrustedWorkspaceSupportType(this.extension.local.manifest);
            const untrustedDetails = getWorkspaceSupportTypeMessage(this.extension.local.manifest.capabilities?.untrustedWorkspaces);
            if (untrustedSupportType === 'limited' || untrustedDetails) {
                this.enabled = true;
                this.updateStatus({ icon: trustIcon, message: new MarkdownString(untrustedDetails ? escapeMarkdownSyntaxTokens(untrustedDetails) : localize('extension limited because of trust requirement', "This extension has limited features because the current workspace is not trusted.")) }, true);
                return;
            }
        }
        // Extension is disabled by extension kind
        if (this.extension.enablementState === 1 /* EnablementState.DisabledByExtensionKind */) {
            if (!this.extensionsWorkbenchService.installed.some(e => areSameExtensions(e.identifier, this.extension.identifier) && e.server !== this.extension.server)) {
                let message;
                // Extension on Local Server
                if (this.extensionManagementServerService.localExtensionManagementServer === this.extension.server) {
                    if (this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(this.extension.local.manifest)) {
                        if (this.extensionManagementServerService.remoteExtensionManagementServer) {
                            message = new MarkdownString(`${localize('Install in remote server to enable', "This extension is disabled in this workspace because it is defined to run in the Remote Extension Host. Please install the extension in '{0}' to enable.", this.extensionManagementServerService.remoteExtensionManagementServer.label)} [${localize('learn more', "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`);
                        }
                    }
                }
                // Extension on Remote Server
                else if (this.extensionManagementServerService.remoteExtensionManagementServer === this.extension.server) {
                    if (this.extensionManifestPropertiesService.prefersExecuteOnUI(this.extension.local.manifest)) {
                        if (this.extensionManagementServerService.localExtensionManagementServer) {
                            message = new MarkdownString(`${localize('Install in local server to enable', "This extension is disabled in this workspace because it is defined to run in the Local Extension Host. Please install the extension locally to enable.", this.extensionManagementServerService.remoteExtensionManagementServer.label)} [${localize('learn more', "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`);
                        }
                        else if (isWeb) {
                            message = new MarkdownString(`${localize('Defined to run in desktop', "This extension is disabled because it is defined to run only in {0} for the Desktop.", this.productService.nameLong)} [${localize('learn more', "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`);
                        }
                    }
                }
                // Extension on Web Server
                else if (this.extensionManagementServerService.webExtensionManagementServer === this.extension.server) {
                    message = new MarkdownString(`${localize('Cannot be enabled', "This extension is disabled because it is not supported in {0} for the Web.", this.productService.nameLong)} [${localize('learn more', "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`);
                }
                if (message) {
                    this.updateStatus({ icon: warningIcon, message }, true);
                }
                return;
            }
        }
        const extensionId = new ExtensionIdentifier(this.extension.identifier.id);
        const features = Registry.as(Extensions.ExtensionFeaturesRegistry).getExtensionFeatures();
        for (const feature of features) {
            const status = this.extensionFeaturesManagementService.getAccessData(extensionId, feature.id)?.current?.status;
            const manageAccessLink = `[${localize('manage access', 'Manage Access')}](${createCommandUri('extension.open', this.extension.identifier.id, "features" /* ExtensionEditorTab.Features */, false, feature.id)})`;
            if (status?.severity === Severity.Error) {
                this.updateStatus({ icon: errorIcon, message: new MarkdownString().appendText(status.message).appendMarkdown(` ${manageAccessLink}`) }, true);
                return;
            }
            if (status?.severity === Severity.Warning) {
                this.updateStatus({ icon: warningIcon, message: new MarkdownString().appendText(status.message).appendMarkdown(` ${manageAccessLink}`) }, true);
                return;
            }
        }
        // Remote Workspace
        if (this.extensionManagementServerService.remoteExtensionManagementServer) {
            if (isLanguagePackExtension(this.extension.local.manifest)) {
                if (!this.extensionsWorkbenchService.installed.some(e => areSameExtensions(e.identifier, this.extension.identifier) && e.server !== this.extension.server)) {
                    const message = this.extension.server === this.extensionManagementServerService.localExtensionManagementServer
                        ? new MarkdownString(localize('Install language pack also in remote server', "Install the language pack extension on '{0}' to enable it there also.", this.extensionManagementServerService.remoteExtensionManagementServer.label))
                        : new MarkdownString(localize('Install language pack also locally', "Install the language pack extension locally to enable it there also."));
                    this.updateStatus({ icon: infoIcon, message }, true);
                }
                return;
            }
            const runningExtension = this.extensionService.extensions.filter(e => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier))[0];
            const runningExtensionServer = runningExtension ? this.extensionManagementServerService.getExtensionManagementServer(toExtension(runningExtension)) : null;
            if (this.extension.server === this.extensionManagementServerService.localExtensionManagementServer && runningExtensionServer === this.extensionManagementServerService.remoteExtensionManagementServer) {
                if (this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(this.extension.local.manifest)) {
                    this.updateStatus({ icon: infoIcon, message: new MarkdownString(`${localize('enabled remotely', "This extension is enabled in the Remote Extension Host because it prefers to run there.")} [${localize('learn more', "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`) }, true);
                }
                return;
            }
            if (this.extension.server === this.extensionManagementServerService.remoteExtensionManagementServer && runningExtensionServer === this.extensionManagementServerService.localExtensionManagementServer) {
                if (this.extensionManifestPropertiesService.prefersExecuteOnUI(this.extension.local.manifest)) {
                    this.updateStatus({ icon: infoIcon, message: new MarkdownString(`${localize('enabled locally', "This extension is enabled in the Local Extension Host because it prefers to run there.")} [${localize('learn more', "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`) }, true);
                }
                return;
            }
            if (this.extension.server === this.extensionManagementServerService.remoteExtensionManagementServer && runningExtensionServer === this.extensionManagementServerService.webExtensionManagementServer) {
                if (this.extensionManifestPropertiesService.canExecuteOnWeb(this.extension.local.manifest)) {
                    this.updateStatus({ icon: infoIcon, message: new MarkdownString(`${localize('enabled in web worker', "This extension is enabled in the Web Worker Extension Host because it prefers to run there.")} [${localize('learn more', "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`) }, true);
                }
                return;
            }
        }
        // Extension is disabled by its dependency
        if (this.extension.enablementState === 8 /* EnablementState.DisabledByExtensionDependency */) {
            this.updateStatus({
                icon: warningIcon,
                message: new MarkdownString(localize('extension disabled because of dependency', "This extension depends on an extension that is disabled."))
                    .appendMarkdown(`&nbsp;[${localize('dependencies', "Show Dependencies")}](${createCommandUri('extension.open', this.extension.identifier.id, "dependencies" /* ExtensionEditorTab.Dependencies */)})`)
            }, true);
            return;
        }
        if (!this.extension.local.isValid) {
            const errors = this.extension.local.validations.filter(([severity]) => severity === Severity.Error).map(([, message]) => message);
            this.updateStatus({ icon: warningIcon, message: new MarkdownString(errors.join(' ').trim()) }, true);
            return;
        }
        const isEnabled = this.workbenchExtensionEnablementService.isEnabled(this.extension.local);
        const isRunning = this.extensionService.extensions.some(e => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier));
        if (!this.extension.isWorkspaceScoped && isEnabled && isRunning) {
            if (this.extension.enablementState === 13 /* EnablementState.EnabledWorkspace */) {
                this.updateStatus({ message: new MarkdownString(localize('workspace enabled', "This extension is enabled for this workspace by the user.")) }, true);
                return;
            }
            if (this.extensionManagementServerService.localExtensionManagementServer && this.extensionManagementServerService.remoteExtensionManagementServer) {
                if (this.extension.server === this.extensionManagementServerService.remoteExtensionManagementServer) {
                    this.updateStatus({ message: new MarkdownString(localize('extension enabled on remote', "Extension is enabled on '{0}'", this.extension.server.label)) }, true);
                    return;
                }
            }
            if (this.extension.enablementState === 12 /* EnablementState.EnabledGlobally */) {
                return;
            }
        }
        if (!isEnabled && !isRunning) {
            if (this.extension.enablementState === 10 /* EnablementState.DisabledGlobally */) {
                this.updateStatus({ message: new MarkdownString(localize('globally disabled', "This extension is disabled globally by the user.")) }, true);
                return;
            }
            if (this.extension.enablementState === 11 /* EnablementState.DisabledWorkspace */) {
                this.updateStatus({ message: new MarkdownString(localize('workspace disabled', "This extension is disabled for this workspace by the user.")) }, true);
                return;
            }
        }
    }
    updateStatus(status, updateClass) {
        if (status) {
            if (this._status.some(s => s.message.value === status.message.value && s.icon?.id === status.icon?.id)) {
                return;
            }
        }
        else {
            if (this._status.length === 0) {
                return;
            }
            this._status = [];
        }
        if (status) {
            this._status.push(status);
            this._status.sort((a, b) => b.icon === trustIcon ? -1 :
                a.icon === trustIcon ? 1 :
                    b.icon === errorIcon ? -1 :
                        a.icon === errorIcon ? 1 :
                            b.icon === warningIcon ? -1 :
                                a.icon === warningIcon ? 1 :
                                    b.icon === infoIcon ? -1 :
                                        a.icon === infoIcon ? 1 :
                                            0);
        }
        if (updateClass) {
            if (status?.icon === errorIcon) {
                this.class = `${ExtensionStatusAction_1.CLASS} extension-status-error ${ThemeIcon.asClassName(errorIcon)}`;
            }
            else if (status?.icon === warningIcon) {
                this.class = `${ExtensionStatusAction_1.CLASS} extension-status-warning ${ThemeIcon.asClassName(warningIcon)}`;
            }
            else if (status?.icon === infoIcon) {
                this.class = `${ExtensionStatusAction_1.CLASS} extension-status-info ${ThemeIcon.asClassName(infoIcon)}`;
            }
            else if (status?.icon === trustIcon) {
                this.class = `${ExtensionStatusAction_1.CLASS} ${ThemeIcon.asClassName(trustIcon)}`;
            }
            else {
                this.class = `${ExtensionStatusAction_1.CLASS} hide`;
            }
        }
        this._onDidChangeStatus.fire();
    }
    async run() {
        if (this._status[0]?.icon === trustIcon) {
            return this.commandService.executeCommand('workbench.trust.manage');
        }
    }
};
ExtensionStatusAction = ExtensionStatusAction_1 = __decorate([
    __param(0, IExtensionManagementServerService),
    __param(1, ILabelService),
    __param(2, ICommandService),
    __param(3, IWorkspaceTrustEnablementService),
    __param(4, IWorkspaceTrustManagementService),
    __param(5, IExtensionsWorkbenchService),
    __param(6, IExtensionService),
    __param(7, IExtensionManifestPropertiesService),
    __param(8, IWorkspaceContextService),
    __param(9, IProductService),
    __param(10, IAllowedExtensionsService),
    __param(11, IWorkbenchExtensionEnablementService),
    __param(12, IExtensionFeaturesManagementService),
    __param(13, IExtensionGalleryManifestService)
], ExtensionStatusAction);
export { ExtensionStatusAction };
let InstallSpecificVersionOfExtensionAction = class InstallSpecificVersionOfExtensionAction extends Action {
    static { InstallSpecificVersionOfExtensionAction_1 = this; }
    static { this.ID = 'workbench.extensions.action.install.specificVersion'; }
    static { this.LABEL = localize('install previous version', "Install Specific Version of Extension..."); }
    constructor(id = InstallSpecificVersionOfExtensionAction_1.ID, label = InstallSpecificVersionOfExtensionAction_1.LABEL, extensionsWorkbenchService, quickInputService, instantiationService, extensionEnablementService) {
        super(id, label);
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.quickInputService = quickInputService;
        this.instantiationService = instantiationService;
        this.extensionEnablementService = extensionEnablementService;
    }
    get enabled() {
        return this.extensionsWorkbenchService.local.some(l => this.isEnabled(l));
    }
    async run() {
        const extensionPick = await this.quickInputService.pick(this.getExtensionEntries(), { placeHolder: localize('selectExtension', "Select Extension"), matchOnDetail: true });
        if (extensionPick && extensionPick.extension) {
            const action = this.instantiationService.createInstance(InstallAnotherVersionAction, extensionPick.extension, true);
            await action.run();
            await this.extensionsWorkbenchService.openSearch(extensionPick.extension.identifier.id);
        }
    }
    isEnabled(extension) {
        const action = this.instantiationService.createInstance(InstallAnotherVersionAction, extension, true);
        return action.enabled && !!extension.local && this.extensionEnablementService.isEnabled(extension.local);
    }
    async getExtensionEntries() {
        const installed = await this.extensionsWorkbenchService.queryLocal();
        const entries = [];
        for (const extension of installed) {
            if (this.isEnabled(extension)) {
                entries.push({
                    id: extension.identifier.id,
                    label: extension.displayName || extension.identifier.id,
                    description: extension.identifier.id,
                    extension,
                });
            }
        }
        return entries.sort((e1, e2) => e1.extension.displayName.localeCompare(e2.extension.displayName));
    }
};
InstallSpecificVersionOfExtensionAction = InstallSpecificVersionOfExtensionAction_1 = __decorate([
    __param(2, IExtensionsWorkbenchService),
    __param(3, IQuickInputService),
    __param(4, IInstantiationService),
    __param(5, IWorkbenchExtensionEnablementService)
], InstallSpecificVersionOfExtensionAction);
export { InstallSpecificVersionOfExtensionAction };
let AbstractInstallExtensionsInServerAction = class AbstractInstallExtensionsInServerAction extends Action {
    constructor(id, extensionsWorkbenchService, quickInputService, notificationService, progressService) {
        super(id);
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.quickInputService = quickInputService;
        this.notificationService = notificationService;
        this.progressService = progressService;
        this.extensions = undefined;
        this.update();
        this.extensionsWorkbenchService.queryLocal().then(() => this.updateExtensions());
        this._register(this.extensionsWorkbenchService.onChange(() => {
            if (this.extensions) {
                this.updateExtensions();
            }
        }));
    }
    updateExtensions() {
        this.extensions = this.extensionsWorkbenchService.local;
        this.update();
    }
    update() {
        this.enabled = !!this.extensions && this.getExtensionsToInstall(this.extensions).length > 0;
        this.tooltip = this.label;
    }
    async run() {
        return this.selectAndInstallExtensions();
    }
    async queryExtensionsToInstall() {
        const local = await this.extensionsWorkbenchService.queryLocal();
        return this.getExtensionsToInstall(local);
    }
    async selectAndInstallExtensions() {
        const quickPick = this.quickInputService.createQuickPick();
        quickPick.busy = true;
        const disposable = quickPick.onDidAccept(() => {
            disposable.dispose();
            quickPick.hide();
            quickPick.dispose();
            this.onDidAccept(quickPick.selectedItems);
        });
        quickPick.show();
        const localExtensionsToInstall = await this.queryExtensionsToInstall();
        quickPick.busy = false;
        if (localExtensionsToInstall.length) {
            quickPick.title = this.getQuickPickTitle();
            quickPick.placeholder = localize('select extensions to install', "Select extensions to install");
            quickPick.canSelectMany = true;
            localExtensionsToInstall.sort((e1, e2) => e1.displayName.localeCompare(e2.displayName));
            quickPick.items = localExtensionsToInstall.map(extension => ({ extension, label: extension.displayName, description: extension.version }));
        }
        else {
            quickPick.hide();
            quickPick.dispose();
            this.notificationService.notify({
                severity: Severity.Info,
                message: localize('no local extensions', "There are no extensions to install.")
            });
        }
    }
    async onDidAccept(selectedItems) {
        if (selectedItems.length) {
            const localExtensionsToInstall = selectedItems.filter(r => !!r.extension).map(r => r.extension);
            if (localExtensionsToInstall.length) {
                await this.progressService.withProgress({
                    location: 15 /* ProgressLocation.Notification */,
                    title: localize('installing extensions', "Installing Extensions...")
                }, () => this.installExtensions(localExtensionsToInstall));
                this.notificationService.info(localize('finished installing', "Successfully installed extensions."));
            }
        }
    }
};
AbstractInstallExtensionsInServerAction = __decorate([
    __param(1, IExtensionsWorkbenchService),
    __param(2, IQuickInputService),
    __param(3, INotificationService),
    __param(4, IProgressService)
], AbstractInstallExtensionsInServerAction);
export { AbstractInstallExtensionsInServerAction };
let InstallLocalExtensionsInRemoteAction = class InstallLocalExtensionsInRemoteAction extends AbstractInstallExtensionsInServerAction {
    constructor(extensionsWorkbenchService, quickInputService, progressService, notificationService, extensionManagementServerService, extensionGalleryService, instantiationService, fileService, logService) {
        super('workbench.extensions.actions.installLocalExtensionsInRemote', extensionsWorkbenchService, quickInputService, notificationService, progressService);
        this.extensionManagementServerService = extensionManagementServerService;
        this.extensionGalleryService = extensionGalleryService;
        this.instantiationService = instantiationService;
        this.fileService = fileService;
        this.logService = logService;
    }
    get label() {
        if (this.extensionManagementServerService && this.extensionManagementServerService.remoteExtensionManagementServer) {
            return localize('select and install local extensions', "Install Local Extensions in '{0}'...", this.extensionManagementServerService.remoteExtensionManagementServer.label);
        }
        return '';
    }
    getQuickPickTitle() {
        return localize('install local extensions title', "Install Local Extensions in '{0}'", this.extensionManagementServerService.remoteExtensionManagementServer.label);
    }
    getExtensionsToInstall(local) {
        return local.filter(extension => {
            const action = this.instantiationService.createInstance(RemoteInstallAction, true);
            action.extension = extension;
            return action.enabled;
        });
    }
    async installExtensions(localExtensionsToInstall) {
        const galleryExtensions = [];
        const vsixs = [];
        const targetPlatform = await this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.getTargetPlatform();
        await Promises.settled(localExtensionsToInstall.map(async (extension) => {
            if (this.extensionGalleryService.isEnabled()) {
                const gallery = (await this.extensionGalleryService.getExtensions([{ ...extension.identifier, preRelease: !!extension.local?.preRelease }], { targetPlatform, compatible: true }, CancellationToken.None))[0];
                if (gallery) {
                    galleryExtensions.push(gallery);
                    return;
                }
            }
            const vsix = await this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.zip(extension.local);
            vsixs.push(vsix);
        }));
        await Promises.settled(galleryExtensions.map(gallery => this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.installFromGallery(gallery)));
        try {
            await Promises.settled(vsixs.map(vsix => this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.install(vsix)));
        }
        finally {
            try {
                await Promise.allSettled(vsixs.map(vsix => this.fileService.del(vsix)));
            }
            catch (error) {
                this.logService.error(error);
            }
        }
    }
};
InstallLocalExtensionsInRemoteAction = __decorate([
    __param(0, IExtensionsWorkbenchService),
    __param(1, IQuickInputService),
    __param(2, IProgressService),
    __param(3, INotificationService),
    __param(4, IExtensionManagementServerService),
    __param(5, IExtensionGalleryService),
    __param(6, IInstantiationService),
    __param(7, IFileService),
    __param(8, ILogService)
], InstallLocalExtensionsInRemoteAction);
export { InstallLocalExtensionsInRemoteAction };
let InstallRemoteExtensionsInLocalAction = class InstallRemoteExtensionsInLocalAction extends AbstractInstallExtensionsInServerAction {
    constructor(id, extensionsWorkbenchService, quickInputService, progressService, notificationService, extensionManagementServerService, extensionGalleryService, fileService, logService) {
        super(id, extensionsWorkbenchService, quickInputService, notificationService, progressService);
        this.extensionManagementServerService = extensionManagementServerService;
        this.extensionGalleryService = extensionGalleryService;
        this.fileService = fileService;
        this.logService = logService;
    }
    get label() {
        return localize('select and install remote extensions', "Install Remote Extensions Locally...");
    }
    getQuickPickTitle() {
        return localize('install remote extensions', "Install Remote Extensions Locally");
    }
    getExtensionsToInstall(local) {
        return local.filter(extension => extension.type === 1 /* ExtensionType.User */ && extension.server !== this.extensionManagementServerService.localExtensionManagementServer
            && !this.extensionsWorkbenchService.installed.some(e => e.server === this.extensionManagementServerService.localExtensionManagementServer && areSameExtensions(e.identifier, extension.identifier)));
    }
    async installExtensions(extensions) {
        const galleryExtensions = [];
        const vsixs = [];
        const targetPlatform = await this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.getTargetPlatform();
        await Promises.settled(extensions.map(async (extension) => {
            if (this.extensionGalleryService.isEnabled()) {
                const gallery = (await this.extensionGalleryService.getExtensions([{ ...extension.identifier, preRelease: !!extension.local?.preRelease }], { targetPlatform, compatible: true }, CancellationToken.None))[0];
                if (gallery) {
                    galleryExtensions.push(gallery);
                    return;
                }
            }
            const vsix = await this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.zip(extension.local);
            vsixs.push(vsix);
        }));
        await Promises.settled(galleryExtensions.map(gallery => this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.installFromGallery(gallery)));
        try {
            await Promises.settled(vsixs.map(vsix => this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.install(vsix)));
        }
        finally {
            try {
                await Promise.allSettled(vsixs.map(vsix => this.fileService.del(vsix)));
            }
            catch (error) {
                this.logService.error(error);
            }
        }
    }
};
InstallRemoteExtensionsInLocalAction = __decorate([
    __param(1, IExtensionsWorkbenchService),
    __param(2, IQuickInputService),
    __param(3, IProgressService),
    __param(4, INotificationService),
    __param(5, IExtensionManagementServerService),
    __param(6, IExtensionGalleryService),
    __param(7, IFileService),
    __param(8, ILogService)
], InstallRemoteExtensionsInLocalAction);
export { InstallRemoteExtensionsInLocalAction };
CommandsRegistry.registerCommand('workbench.extensions.action.showExtensionsForLanguage', function (accessor, fileExtension) {
    const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
    return extensionsWorkbenchService.openSearch(`ext:${fileExtension.replace(/^\./, '')}`);
});
export const showExtensionsWithIdsCommandId = 'workbench.extensions.action.showExtensionsWithIds';
CommandsRegistry.registerCommand(showExtensionsWithIdsCommandId, function (accessor, extensionIds) {
    const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
    return extensionsWorkbenchService.openSearch(extensionIds.map(id => `@id:${id}`).join(' '));
});
registerColor('extensionButton.background', {
    dark: buttonBackground,
    light: buttonBackground,
    hcDark: null,
    hcLight: null
}, localize('extensionButtonBackground', "Button background color for extension actions."));
registerColor('extensionButton.foreground', {
    dark: buttonForeground,
    light: buttonForeground,
    hcDark: null,
    hcLight: null
}, localize('extensionButtonForeground', "Button foreground color for extension actions."));
registerColor('extensionButton.hoverBackground', {
    dark: buttonHoverBackground,
    light: buttonHoverBackground,
    hcDark: null,
    hcLight: null
}, localize('extensionButtonHoverBackground', "Button background hover color for extension actions."));
registerColor('extensionButton.separator', buttonSeparator, localize('extensionButtonSeparator', "Button separator color for extension actions"));
export const extensionButtonProminentBackground = registerColor('extensionButton.prominentBackground', {
    dark: buttonBackground,
    light: buttonBackground,
    hcDark: null,
    hcLight: null
}, localize('extensionButtonProminentBackground', "Button background color for extension actions that stand out (e.g. install button)."));
registerColor('extensionButton.prominentForeground', {
    dark: buttonForeground,
    light: buttonForeground,
    hcDark: null,
    hcLight: null
}, localize('extensionButtonProminentForeground', "Button foreground color for extension actions that stand out (e.g. install button)."));
registerColor('extensionButton.prominentHoverBackground', {
    dark: buttonHoverBackground,
    light: buttonHoverBackground,
    hcDark: null,
    hcLight: null
}, localize('extensionButtonProminentHoverBackground', "Button background hover color for extension actions that stand out (e.g. install button)."));
registerThemingParticipant((theme, collector) => {
    const errorColor = theme.getColor(editorErrorForeground);
    if (errorColor) {
        collector.addRule(`.extension-editor .header .actions-status-container > .status ${ThemeIcon.asCSSSelector(errorIcon)} { color: ${errorColor}; }`);
        collector.addRule(`.extension-editor .body .subcontent .runtime-status ${ThemeIcon.asCSSSelector(errorIcon)} { color: ${errorColor}; }`);
        collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(errorIcon)} { color: ${errorColor}; }`);
    }
    const warningColor = theme.getColor(editorWarningForeground);
    if (warningColor) {
        collector.addRule(`.extension-editor .header .actions-status-container > .status ${ThemeIcon.asCSSSelector(warningIcon)} { color: ${warningColor}; }`);
        collector.addRule(`.extension-editor .body .subcontent .runtime-status ${ThemeIcon.asCSSSelector(warningIcon)} { color: ${warningColor}; }`);
        collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(warningIcon)} { color: ${warningColor}; }`);
    }
    const infoColor = theme.getColor(editorInfoForeground);
    if (infoColor) {
        collector.addRule(`.extension-editor .header .actions-status-container > .status ${ThemeIcon.asCSSSelector(infoIcon)} { color: ${infoColor}; }`);
        collector.addRule(`.extension-editor .body .subcontent .runtime-status ${ThemeIcon.asCSSSelector(infoIcon)} { color: ${infoColor}; }`);
        collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(infoIcon)} { color: ${infoColor}; }`);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uc0FjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZXh0ZW5zaW9ucy9icm93c2VyL2V4dGVuc2lvbnNBY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLDhCQUE4QixDQUFDO0FBQ3RDLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFXLE1BQU0sRUFBRSxTQUFTLEVBQUUsYUFBYSxFQUFzQixNQUFNLG9DQUFvQyxDQUFDO0FBQ25ILE9BQU8sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2hGLE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEtBQUssSUFBSSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNFLE9BQU8sRUFBOEIsMkJBQTJCLEVBQXVCLGlDQUFpQyxFQUFFLHdDQUF3QyxFQUFFLG1CQUFtQixFQUFFLHFCQUFxQixFQUFFLG9CQUFvQixFQUFpRSwwQkFBMEIsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ2pXLE9BQU8sRUFBRSxxQ0FBcUMsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzVGLE9BQU8sRUFBcUIsd0JBQXdCLEVBQW1GLHlCQUF5QixFQUFFLG1DQUFtQyxFQUFFLE1BQU0sd0VBQXdFLENBQUM7QUFDdFIsT0FBTyxFQUFFLG9DQUFvQyxFQUFtQixp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