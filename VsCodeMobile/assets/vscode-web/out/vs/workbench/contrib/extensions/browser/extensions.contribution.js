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
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Event } from '../../../../base/common/event.js';
import { mnemonicButtonLabel } from '../../../../base/common/labels.js';
import { Disposable, DisposableStore, isDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { isNative, isWeb } from '../../../../base/common/platform.js';
import { PolicyCategory } from '../../../../base/common/policy.js';
import { URI } from '../../../../base/common/uri.js';
import { CopyAction, CutAction, PasteAction } from '../../../../editor/contrib/clipboard/browser/clipboard.js';
import { localize, localize2 } from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ExtensionGalleryServiceUrlConfigKey, getExtensionGalleryManifestResourceUri, IExtensionGalleryManifestService } from '../../../../platform/extensionManagement/common/extensionGalleryManifest.js';
import { EXTENSION_INSTALL_SOURCE_CONTEXT, ExtensionRequestsTimeoutConfigKey, ExtensionsLocalizedLabel, IExtensionGalleryService, IExtensionManagementService, PreferencesLocalizedLabel, VerifyExtensionSignatureConfigKey } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { areSameExtensions, getIdAndVersion } from '../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { ExtensionStorageService } from '../../../../platform/extensionManagement/common/extensionStorage.js';
import { IExtensionRecommendationNotificationService } from '../../../../platform/extensionRecommendations/common/extensionRecommendations.js';
import { EXTENSION_CATEGORIES } from '../../../../platform/extensions/common/extensions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import * as jsonContributionRegistry from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import product from '../../../../platform/product/common/product.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { Extensions } from '../../../../platform/quickinput/common/quickAccess.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile.js';
import { EditorPaneDescriptor } from '../../../browser/editor.js';
import { Extensions as ConfigurationMigrationExtensions } from '../../../common/configuration.js';
import { ResourceContextKey, WorkbenchStateContext } from '../../../common/contextkeys.js';
import { registerWorkbenchContribution2, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { EditorExtensions } from '../../../common/editor.js';
import { Extensions as ViewContainerExtensions } from '../../../common/views.js';
import { DEFAULT_ACCOUNT_SIGN_IN_COMMAND } from '../../../services/accounts/common/defaultAccount.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IExtensionManagementServerService, IWorkbenchExtensionEnablementService, IWorkbenchExtensionManagementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionIgnoredRecommendationsService, IExtensionRecommendationsService } from '../../../services/extensionRecommendations/common/extensionRecommendations.js';
import { IWorkspaceExtensionsConfigService } from '../../../services/extensionRecommendations/common/workspaceExtensionsConfig.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { CONTEXT_SYNC_ENABLEMENT } from '../../../services/userDataSync/common/userDataSync.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { WORKSPACE_TRUST_EXTENSION_SUPPORT } from '../../../services/workspaces/common/workspaceTrust.js';
import { ILanguageModelToolsService } from '../../chat/common/languageModelToolsService.js';
import { CONTEXT_KEYBINDINGS_EDITOR } from '../../preferences/common/preferences.js';
import { Query } from '../common/extensionQuery.js';
import { AutoRestartConfigurationKey, AutoUpdateConfigurationKey, CONTEXT_EXTENSIONS_GALLERY_STATUS, CONTEXT_HAS_GALLERY, DefaultViewsContext, EXTENSIONS_CATEGORY, extensionsFilterSubMenu, extensionsSearchActionsMenu, HasOutdatedExtensionsContext, IExtensionsWorkbenchService, INSTALL_ACTIONS_GROUP, INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID, LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID, OUTDATED_EXTENSIONS_VIEW_ID, SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID, THEME_ACTIONS_GROUP, TOGGLE_IGNORE_EXTENSION_ACTION_ID, UPDATE_ACTIONS_GROUP, VIEWLET_ID, WORKSPACE_RECOMMENDATIONS_VIEW_ID } from '../common/extensions.js';
import { ExtensionsConfigurationSchema, ExtensionsConfigurationSchemaId } from '../common/extensionsFileTemplate.js';
import { ExtensionsInput } from '../common/extensionsInput.js';
import { KeymapExtensions } from '../common/extensionsUtils.js';
import { SearchExtensionsTool, SearchExtensionsToolData } from '../common/searchExtensionsTool.js';
import { ShowRuntimeExtensionsAction } from './abstractRuntimeExtensionsEditor.js';
import { ExtensionEditor } from './extensionEditor.js';
import { ExtensionEnablementWorkspaceTrustTransitionParticipant } from './extensionEnablementWorkspaceTrustTransitionParticipant.js';
import { ExtensionRecommendationNotificationService } from './extensionRecommendationNotificationService.js';
import { ExtensionRecommendationsService } from './extensionRecommendationsService.js';
import { ClearLanguageAction, ConfigureWorkspaceFolderRecommendedExtensionsAction, ConfigureWorkspaceRecommendedExtensionsAction, InstallAction, InstallAnotherVersionAction, InstallSpecificVersionOfExtensionAction, SetColorThemeAction, SetFileIconThemeAction, SetProductIconThemeAction, ToggleAutoUpdateForExtensionAction, ToggleAutoUpdatesForPublisherAction, TogglePreReleaseExtensionAction } from './extensionsActions.js';
import { ExtensionActivationProgress } from './extensionsActivationProgress.js';
import { ExtensionsCompletionItemsProvider } from './extensionsCompletionItemsProvider.js';
import { ExtensionDependencyChecker } from './extensionsDependencyChecker.js';
import { clearSearchResultsIcon, configureRecommendedIcon, extensionsViewIcon, filterIcon, installWorkspaceRecommendedIcon, refreshIcon } from './extensionsIcons.js';
import { InstallExtensionQuickAccessProvider, ManageExtensionsQuickAccessProvider } from './extensionsQuickAccess.js';
import { BuiltInExtensionsContext, ExtensionMarketplaceStatusUpdater, ExtensionsSearchValueContext, ExtensionsSortByContext, ExtensionsViewletViewsContribution, ExtensionsViewPaneContainer, MaliciousExtensionChecker, RecommendedExtensionsContext, SearchHasTextContext, SearchMarketplaceExtensionsContext, StatusUpdater } from './extensionsViewlet.js';
import { ExtensionsWorkbenchService } from './extensionsWorkbenchService.js';
import './media/extensionManagement.css';
import { UnsupportedExtensionsMigrationContrib } from './unsupportedExtensionsMigrationContribution.js';
// Singletons
registerSingleton(IExtensionsWorkbenchService, ExtensionsWorkbenchService, 0 /* InstantiationType.Eager */);
registerSingleton(IExtensionRecommendationNotificationService, ExtensionRecommendationNotificationService, 1 /* InstantiationType.Delayed */);
registerSingleton(IExtensionRecommendationsService, ExtensionRecommendationsService, 0 /* InstantiationType.Eager */);
// Quick Access
Registry.as(Extensions.Quickaccess).registerQuickAccessProvider({
    ctor: ManageExtensionsQuickAccessProvider,
    prefix: ManageExtensionsQuickAccessProvider.PREFIX,
    placeholder: localize('manageExtensionsQuickAccessPlaceholder', "Press Enter to manage extensions."),
    helpEntries: [{ description: localize('manageExtensionsHelp', "Manage Extensions") }]
});
// Editor
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(ExtensionEditor, ExtensionEditor.ID, localize('extension', "Extension")), [
    new SyncDescriptor(ExtensionsInput)
]);
export const VIEW_CONTAINER = Registry.as(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
    id: VIEWLET_ID,
    title: localize2('extensions', "Extensions"),
    openCommandActionDescriptor: {
        id: VIEWLET_ID,
        mnemonicTitle: localize({ key: 'miViewExtensions', comment: ['&& denotes a mnemonic'] }, "E&&xtensions"),
        keybindings: { primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 54 /* KeyCode.KeyX */ },
        order: 4,
    },
    ctorDescriptor: new SyncDescriptor(ExtensionsViewPaneContainer),
    icon: extensionsViewIcon,
    order: 4,
    rejectAddedViews: true,
    alwaysUseContainerInfo: true,
}, 0 /* ViewContainerLocation.Sidebar */);
Registry.as(ConfigurationExtensions.Configuration)
    .registerConfiguration({
    id: 'extensions',
    order: 30,
    title: localize('extensionsConfigurationTitle', "Extensions"),
    type: 'object',
    properties: {
        'extensions.autoUpdate': {
            enum: [true, 'onlyEnabledExtensions', false,],
            enumItemLabels: [
                localize('all', "All Extensions"),
                localize('enabled', "Only Enabled Extensions"),
                localize('none', "None"),
            ],
            enumDescriptions: [
                localize('extensions.autoUpdate.true', 'Download and install updates automatically for all extensions.'),
                localize('extensions.autoUpdate.enabled', 'Download and install updates automatically only for enabled extensions.'),
                localize('extensions.autoUpdate.false', 'Extensions are not automatically updated.'),
            ],
            description: localize('extensions.autoUpdate', "Controls the automatic update behavior of extensions. The updates are fetched from a Microsoft online service."),
            default: true,
            scope: 1 /* ConfigurationScope.APPLICATION */,
            tags: ['usesOnlineServices']
        },
        'extensions.autoCheckUpdates': {
            type: 'boolean',
            description: localize('extensionsCheckUpdates', "When enabled, automatically checks extensions for updates. If an extension has an update, it is marked as outdated in the Extensions view. The updates are fetched from a Microsoft online service."),
            default: true,
            scope: 1 /* ConfigurationScope.APPLICATION */,
            tags: ['usesOnlineServices']
        },
        'extensions.ignoreRecommendations': {
            type: 'boolean',
            description: localize('extensionsIgnoreRecommendations', "When enabled, the notifications for extension recommendations will not be shown."),
            default: false
        },
        'extensions.showRecommendationsOnlyOnDemand': {
            type: 'boolean',
            deprecationMessage: localize('extensionsShowRecommendationsOnlyOnDemand_Deprecated', "This setting is deprecated. Use extensions.ignoreRecommendations setting to control recommendation notifications. Use Extensions view's visibility actions to hide Recommended view by default."),
            default: false,
            tags: ['usesOnlineServices']
        },
        'extensions.closeExtensionDetailsOnViewChange': {
            type: 'boolean',
            description: localize('extensionsCloseExtensionDetailsOnViewChange', "When enabled, editors with extension details will be automatically closed upon navigating away from the Extensions View."),
            default: false
        },
        'extensions.confirmedUriHandlerExtensionIds': {
            type: 'array',
            items: {
                type: 'string'
            },
            description: localize('handleUriConfirmedExtensions', "When an extension is listed here, a confirmation prompt will not be shown when that extension handles a URI."),
            default: [],
            scope: 1 /* ConfigurationScope.APPLICATION */
        },
        'extensions.webWorker': {
            type: ['boolean', 'string'],
            enum: [true, false, 'auto'],
            enumDescriptions: [
                localize('extensionsWebWorker.true', "The Web Worker Extension Host will always be launched."),
                localize('extensionsWebWorker.false', "The Web Worker Extension Host will never be launched."),
                localize('extensionsWebWorker.auto', "The Web Worker Extension Host will be launched when a web extension needs it."),
            ],
            description: localize('extensionsWebWorker', "Enable web worker extension host."),
            default: 'auto'
        },
        'extensions.supportVirtualWorkspaces': {
            type: 'object',
            markdownDescription: localize('extensions.supportVirtualWorkspaces', "Override the virtual workspaces support of an extension."),
            patternProperties: {
                '([a-z0-9A-Z][a-z0-9-A-Z]*)\\.([a-z0-9A-Z][a-z0-9-A-Z]*)$': {
                    type: 'boolean',
                    default: false
                }
            },
            additionalProperties: false,
            default: {},
            defaultSnippets: [{
                    'body': {
                        'pub.name': false
                    }
                }]
        },
        'extensions.experimental.affinity': {
            type: 'object',
            markdownDescription: localize('extensions.affinity', "Configure an extension to execute in a different extension host process."),
            patternProperties: {
                '([a-z0-9A-Z][a-z0-9-A-Z]*)\\.([a-z0-9A-Z][a-z0-9-A-Z]*)$': {
                    type: 'integer',
                    default: 1
                }
            },
            additionalProperties: false,
            default: {},
            defaultSnippets: [{
                    'body': {
                        'pub.name': 1
                    }
                }]
        },
        [WORKSPACE_TRUST_EXTENSION_SUPPORT]: {
            type: 'object',
            scope: 1 /* ConfigurationScope.APPLICATION */,
            markdownDescription: localize('extensions.supportUntrustedWorkspaces', "Override the untrusted workspace support of an extension. Extensions using `true` will always be enabled. Extensions using `limited` will always be enabled, and the extension will hide functionality that requires trust. Extensions using `false` will only be enabled only when the workspace is trusted."),
            patternProperties: {
                '([a-z0-9A-Z][a-z0-9-A-Z]*)\\.([a-z0-9A-Z][a-z0-9-A-Z]*)$': {
                    type: 'object',
                    properties: {
                        'supported': {
                            type: ['boolean', 'string'],
                            enum: [true, false, 'limited'],
                            enumDescriptions: [
                                localize('extensions.supportUntrustedWorkspaces.true', "Extension will always be enabled."),
                                localize('extensions.supportUntrustedWorkspaces.false', "Extension will only be enabled only when the workspace is trusted."),
                                localize('extensions.supportUntrustedWorkspaces.limited', "Extension will always be enabled, and the extension will hide functionality requiring trust."),
                            ],
                            description: localize('extensions.supportUntrustedWorkspaces.supported', "Defines the untrusted workspace support setting for the extension."),
                        },
                        'version': {
                            type: 'string',
                            description: localize('extensions.supportUntrustedWorkspaces.version', "Defines the version of the extension for which the override should be applied. If not specified, the override will be applied independent of the extension version."),
                        }
                    }
                }
            }
        },
        'extensions.experimental.deferredStartupFinishedActivation': {
            type: 'boolean',
            description: localize('extensionsDeferredStartupFinishedActivation', "When enabled, extensions which declare the `onStartupFinished` activation event will be activated after a timeout."),
            default: false
        },
        'extensions.experimental.issueQuickAccess': {
            type: 'boolean',
            description: localize('extensionsInQuickAccess', "When enabled, extensions can be searched for via Quick Access and report issues from there."),
            default: true
        },
        [VerifyExtensionSignatureConfigKey]: {
            type: 'boolean',
            description: localize('extensions.verifySignature', "When enabled, extensions are verified to be signed before getting installed."),
            default: true,
            scope: 1 /* ConfigurationScope.APPLICATION */,
            included: isNative
        },
        [AutoRestartConfigurationKey]: {
            type: 'boolean',
            description: localize('autoRestart', "If activated, extensions will automatically restart following an update if the window is not in focus. There can be a data loss if you have open Notebooks or Custom Editors."),
            default: false,
            included: product.quality !== 'stable'
        },
        [ExtensionGalleryServiceUrlConfigKey]: {
            type: 'string',
            description: localize('extensions.gallery.serviceUrl', "Configure the Marketplace service URL to connect to"),
            default: '',
            scope: 1 /* ConfigurationScope.APPLICATION */,
            tags: ['usesOnlineServices'],
            included: false,
            policy: {
                name: 'ExtensionGalleryServiceUrl',
                category: PolicyCategory.Extensions,
                minimumVersion: '1.99',
                localization: {
                    description: {
                        key: 'extensions.gallery.serviceUrl',
                        value: localize('extensions.gallery.serviceUrl', "Configure the Marketplace service URL to connect to"),
                    }
                }
            },
        },
        'extensions.supportNodeGlobalNavigator': {
            type: 'boolean',
            description: localize('extensionsSupportNodeGlobalNavigator', "When enabled, Node.js navigator object is exposed on the global scope."),
            default: false,
        },
        [ExtensionRequestsTimeoutConfigKey]: {
            type: 'number',
            description: localize('extensionsRequestTimeout', "Controls the timeout in milliseconds for HTTP requests made when fetching extensions from the Marketplace"),
            default: 60_000,
            scope: 1 /* ConfigurationScope.APPLICATION */,
            tags: ['advanced', 'usesOnlineServices']
        },
    }
});
const jsonRegistry = Registry.as(jsonContributionRegistry.Extensions.JSONContribution);
jsonRegistry.registerSchema(ExtensionsConfigurationSchemaId, ExtensionsConfigurationSchema);
// Register Commands
CommandsRegistry.registerCommand('_extensions.manage', (accessor, extensionId, tab, preserveFocus, feature) => {
    const extensionService = accessor.get(IExtensionsWorkbenchService);
    const extension = extensionService.local.find(e => areSameExtensions(e.identifier, { id: extensionId }));
    if (extension) {
        extensionService.open(extension, { tab, preserveFocus, feature });
    }
    else {
        throw new Error(localize('notFound', "Extension '{0}' not found.", extensionId));
    }
});
CommandsRegistry.registerCommand('extension.open', async (accessor, extensionId, tab, preserveFocus, feature, sideByside) => {
    const extensionService = accessor.get(IExtensionsWorkbenchService);
    const commandService = accessor.get(ICommandService);
    const [extension] = await extensionService.getExtensions([{ id: extensionId }], CancellationToken.None);
    if (extension) {
        return extensionService.open(extension, { tab, preserveFocus, feature, sideByside });
    }
    return commandService.executeCommand('_extensions.manage', extensionId, tab, preserveFocus, feature);
});
CommandsRegistry.registerCommand({
    id: 'workbench.extensions.installExtension',
    metadata: {
        description: localize('workbench.extensions.installExtension.description', "Install the given extension"),
        args: [
            {
                name: 'extensionIdOrVSIXUri',
                description: localize('workbench.extensions.installExtension.arg.decription', "Extension id or VSIX resource uri"),
                constraint: (value) => typeof value === 'string' || value instanceof URI,
            },
            {
                name: 'options',
                description: '(optional) Options for installing the extension. Object with the following properties: ' +
                    '`installOnlyNewlyAddedFromExtensionPackVSIX`: When enabled, VS Code installs only newly added extensions from the extension pack VSIX. This option is considered only when installing VSIX. ',
                isOptional: true,
                schema: {
                    'type': 'object',
                    'properties': {
                        'installOnlyNewlyAddedFromExtensionPackVSIX': {
                            'type': 'boolean',
                            'description': localize('workbench.extensions.installExtension.option.installOnlyNewlyAddedFromExtensionPackVSIX', "When enabled, VS Code installs only newly added extensions from the extension pack VSIX. This option is considered only while installing a VSIX."),
                            default: false
                        },
                        'installPreReleaseVersion': {
                            'type': 'boolean',
                            'description': localize('workbench.extensions.installExtension.option.installPreReleaseVersion', "When enabled, VS Code installs the pre-release version of the extension if available."),
                            default: false
                        },
                        'donotSync': {
                            'type': 'boolean',
                            'description': localize('workbench.extensions.installExtension.option.donotSync', "When enabled, VS Code do not sync this extension when Settings Sync is on."),
                            default: false
                        },
                        'justification': {
                            'type': ['string', 'object'],
                            'description': localize('workbench.extensions.installExtension.option.justification', "Justification for installing the extension. This is a string or an object that can be used to pass any information to the installation handlers. i.e. `{reason: 'This extension wants to open a URI', action: 'Open URI'}` will show a message box with the reason and action upon install."),
                        },
                        'enable': {
                            'type': 'boolean',
                            'description': localize('workbench.extensions.installExtension.option.enable', "When enabled, the extension will be enabled if it is installed but disabled. If the extension is already enabled, this has no effect."),
                            default: false
                        },
                        'context': {
                            'type': 'object',
                            'description': localize('workbench.extensions.installExtension.option.context', "Context for the installation. This is a JSON object that can be used to pass any information to the installation handlers. i.e. `{skipWalkthrough: true}` will skip opening the walkthrough upon install."),
                        }
                    }
                }
            }
        ]
    },
    handler: async (accessor, arg, options) => {
        const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const extensionManagementService = accessor.get(IWorkbenchExtensionManagementService);
        const extensionGalleryService = accessor.get(IExtensionGalleryService);
        try {
            if (typeof arg === 'string') {
                const [id, version] = getIdAndVersion(arg);
                const extension = extensionsWorkbenchService.local.find(e => areSameExtensions(e.identifier, { id, uuid: version }));
                if (extension?.enablementState === 1 /* EnablementState.DisabledByExtensionKind */) {
                    const [gallery] = await extensionGalleryService.getExtensions([{ id, preRelease: options?.installPreReleaseVersion }], CancellationToken.None);
                    if (!gallery) {
                        throw new Error(localize('notFound', "Extension '{0}' not found.", arg));
                    }
                    await extensionManagementService.installFromGallery(gallery, {
                        isMachineScoped: options?.donotSync ? true : undefined, /* do not allow syncing extensions automatically while installing through the command */
                        installPreReleaseVersion: options?.installPreReleaseVersion,
                        installGivenVersion: !!version,
                        context: { ...options?.context, [EXTENSION_INSTALL_SOURCE_CONTEXT]: "command" /* ExtensionInstallSource.COMMAND */ },
                    });
                }
                else {
                    await extensionsWorkbenchService.install(arg, {
                        version,
                        installPreReleaseVersion: options?.installPreReleaseVersion,
                        context: { ...options?.context, [EXTENSION_INSTALL_SOURCE_CONTEXT]: "command" /* ExtensionInstallSource.COMMAND */ },
                        justification: options?.justification,
                        enable: options?.enable,
                        isMachineScoped: options?.donotSync ? true : undefined, /* do not allow syncing extensions automatically while installing through the command */
                    }, 15 /* ProgressLocation.Notification */);
                }
            }
            else {
                const vsix = URI.revive(arg);
                await extensionsWorkbenchService.install(vsix, { installGivenVersion: true });
            }
        }
        catch (e) {
            onUnexpectedError(e);
            throw e;
        }
    }
});
CommandsRegistry.registerCommand({
    id: 'workbench.extensions.uninstallExtension',
    metadata: {
        description: localize('workbench.extensions.uninstallExtension.description', "Uninstall the given extension"),
        args: [
            {
                name: localize('workbench.extensions.uninstallExtension.arg.name', "Id of the extension to uninstall"),
                schema: {
                    'type': 'string'
                }
            }
        ]
    },
    handler: async (accessor, id) => {
        if (!id) {
            throw new Error(localize('id required', "Extension id required."));
        }
        const extensionManagementService = accessor.get(IExtensionManagementService);
        const installed = await extensionManagementService.getInstalled();
        const [extensionToUninstall] = installed.filter(e => areSameExtensions(e.identifier, { id }));
        if (!extensionToUninstall) {
            throw new Error(localize('notInstalled', "Extension '{0}' is not installed. Make sure you use the full extension ID, including the publisher, e.g.: ms-dotnettools.csharp.", id));
        }
        if (extensionToUninstall.isBuiltin) {
            throw new Error(localize('builtin', "Extension '{0}' is a Built-in extension and cannot be uninstalled", id));
        }
        try {
            await extensionManagementService.uninstall(extensionToUninstall);
        }
        catch (e) {
            onUnexpectedError(e);
            throw e;
        }
    }
});
CommandsRegistry.registerCommand({
    id: 'workbench.extensions.search',
    metadata: {
        description: localize('workbench.extensions.search.description', "Search for a specific extension"),
        args: [
            {
                name: localize('workbench.extensions.search.arg.name', "Query to use in search"),
                schema: { 'type': 'string' }
            }
        ]
    },
    handler: async (accessor, query = '') => {
        return accessor.get(IExtensionsWorkbenchService).openSearch(query);
    }
});
function overrideActionForActiveExtensionEditorWebview(command, f) {
    command?.addImplementation(105, 'extensions-editor', (accessor) => {
        const editorService = accessor.get(IEditorService);
        const editor = editorService.activeEditorPane;
        if (editor instanceof ExtensionEditor) {
            if (editor.activeWebview?.isFocused) {
                f(editor.activeWebview);
                return true;
            }
        }
        return false;
    });
}
overrideActionForActiveExtensionEditorWebview(CopyAction, webview => webview.copy());
overrideActionForActiveExtensionEditorWebview(CutAction, webview => webview.cut());
overrideActionForActiveExtensionEditorWebview(PasteAction, webview => webview.paste());
// Contexts
export const CONTEXT_HAS_LOCAL_SERVER = new RawContextKey('hasLocalServer', false);
export const CONTEXT_HAS_REMOTE_SERVER = new RawContextKey('hasRemoteServer', false);
export const CONTEXT_HAS_WEB_SERVER = new RawContextKey('hasWebServer', false);
const CONTEXT_GALLERY_SORT_CAPABILITIES = new RawContextKey('gallerySortCapabilities', '');
const CONTEXT_GALLERY_FILTER_CAPABILITIES = new RawContextKey('galleryFilterCapabilities', '');
const CONTEXT_GALLERY_ALL_PUBLIC_REPOSITORY_SIGNED = new RawContextKey('galleryAllPublicRepositorySigned', false);
const CONTEXT_GALLERY_ALL_PRIVATE_REPOSITORY_SIGNED = new RawContextKey('galleryAllPrivateRepositorySigned', false);
const CONTEXT_GALLERY_HAS_EXTENSION_LINK = new RawContextKey('galleryHasExtensionLink', false);
async function runAction(action) {
    try {
        await action.run();
    }
    finally {
        if (isDisposable(action)) {
            action.dispose();
        }
    }
}
let ExtensionsContributions = class ExtensionsContributions extends Disposable {
    constructor(extensionManagementService, extensionManagementServerService, extensionGalleryManifestService, contextKeyService, viewsService, extensionsWorkbenchService, extensionEnablementService, instantiationService, dialogService, commandService, productService) {
        super();
        this.extensionManagementService = extensionManagementService;
        this.extensionManagementServerService = extensionManagementServerService;
        this.extensionGalleryManifestService = extensionGalleryManifestService;
        this.contextKeyService = contextKeyService;
        this.viewsService = viewsService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionEnablementService = extensionEnablementService;
        this.instantiationService = instantiationService;
        this.dialogService = dialogService;
        this.commandService = commandService;
        this.productService = productService;
        const hasLocalServerContext = CONTEXT_HAS_LOCAL_SERVER.bindTo(contextKeyService);
        if (this.extensionManagementServerService.localExtensionManagementServer) {
            hasLocalServerContext.set(true);
        }
        const hasRemoteServerContext = CONTEXT_HAS_REMOTE_SERVER.bindTo(contextKeyService);
        if (this.extensionManagementServerService.remoteExtensionManagementServer) {
            hasRemoteServerContext.set(true);
        }
        const hasWebServerContext = CONTEXT_HAS_WEB_SERVER.bindTo(contextKeyService);
        if (this.extensionManagementServerService.webExtensionManagementServer) {
            hasWebServerContext.set(true);
        }
        this.updateExtensionGalleryStatusContexts();
        this._register(extensionGalleryManifestService.onDidChangeExtensionGalleryManifestStatus(() => this.updateExtensionGalleryStatusContexts()));
        extensionGalleryManifestService.getExtensionGalleryManifest()
            .then(extensionGalleryManifest => {
            this.updateGalleryCapabilitiesContexts(extensionGalleryManifest);
            this._register(extensionGalleryManifestService.onDidChangeExtensionGalleryManifest(extensionGalleryManifest => this.updateGalleryCapabilitiesContexts(extensionGalleryManifest)));
        });
        this.registerGlobalActions();
        this.registerContextMenuActions();
        this.registerQuickAccessProvider();
    }
    async updateExtensionGalleryStatusContexts() {
        CONTEXT_HAS_GALLERY.bindTo(this.contextKeyService).set(this.extensionGalleryManifestService.extensionGalleryManifestStatus === "available" /* ExtensionGalleryManifestStatus.Available */);
        CONTEXT_EXTENSIONS_GALLERY_STATUS.bindTo(this.contextKeyService).set(this.extensionGalleryManifestService.extensionGalleryManifestStatus);
    }
    async updateGalleryCapabilitiesContexts(extensionGalleryManifest) {
        CONTEXT_GALLERY_SORT_CAPABILITIES.bindTo(this.contextKeyService).set(`_${extensionGalleryManifest?.capabilities.extensionQuery.sorting?.map(s => s.name)?.join('_')}_UpdateDate_`);
        CONTEXT_GALLERY_FILTER_CAPABILITIES.bindTo(this.contextKeyService).set(`_${extensionGalleryManifest?.capabilities.extensionQuery.filtering?.map(s => s.name)?.join('_')}_`);
        CONTEXT_GALLERY_ALL_PUBLIC_REPOSITORY_SIGNED.bindTo(this.contextKeyService).set(!!extensionGalleryManifest?.capabilities?.signing?.allPublicRepositorySigned);
        CONTEXT_GALLERY_ALL_PRIVATE_REPOSITORY_SIGNED.bindTo(this.contextKeyService).set(!!extensionGalleryManifest?.capabilities?.signing?.allPrivateRepositorySigned);
        CONTEXT_GALLERY_HAS_EXTENSION_LINK.bindTo(this.contextKeyService).set(!!(extensionGalleryManifest && getExtensionGalleryManifestResourceUri(extensionGalleryManifest, "ExtensionDetailsViewUriTemplate" /* ExtensionGalleryResourceType.ExtensionDetailsViewUri */)));
    }
    registerQuickAccessProvider() {
        if (this.extensionManagementServerService.localExtensionManagementServer
            || this.extensionManagementServerService.remoteExtensionManagementServer
            || this.extensionManagementServerService.webExtensionManagementServer) {
            Registry.as(Extensions.Quickaccess).registerQuickAccessProvider({
                ctor: InstallExtensionQuickAccessProvider,
                prefix: InstallExtensionQuickAccessProvider.PREFIX,
                placeholder: localize('installExtensionQuickAccessPlaceholder', "Type the name of an extension to install or search."),
                helpEntries: [{ description: localize('installExtensionQuickAccessHelp', "Install or Search Extensions") }]
            });
        }
    }
    // Global actions
    registerGlobalActions() {
        this._register(MenuRegistry.appendMenuItem(MenuId.MenubarPreferencesMenu, {
            command: {
                id: VIEWLET_ID,
                title: localize({ key: 'miPreferencesExtensions', comment: ['&& denotes a mnemonic'] }, "&&Extensions")
            },
            group: '2_configuration',
            order: 3
        }));
        this._register(MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
            command: {
                id: VIEWLET_ID,
                title: localize('showExtensions', "Extensions")
            },
            group: '2_configuration',
            order: 3
        }));
        this.registerExtensionAction({
            id: 'workbench.extensions.action.focusExtensionsView',
            title: localize2('focusExtensions', 'Focus on Extensions View'),
            category: ExtensionsLocalizedLabel,
            f1: true,
            run: async (accessor) => {
                await accessor.get(IExtensionsWorkbenchService).openSearch('');
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.installExtensions',
            title: localize2('installExtensions', 'Install Extensions'),
            category: ExtensionsLocalizedLabel,
            menu: {
                id: MenuId.CommandPalette,
                when: ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER))
            },
            run: async (accessor) => {
                accessor.get(IViewsService).openViewContainer(VIEWLET_ID, true);
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.showRecommendedKeymapExtensions',
            title: localize2('showRecommendedKeymapExtensionsShort', 'Keymaps'),
            category: PreferencesLocalizedLabel,
            menu: [{
                    id: MenuId.CommandPalette,
                    when: CONTEXT_HAS_GALLERY
                }, {
                    id: MenuId.EditorTitle,
                    when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_HAS_GALLERY),
                    group: '2_keyboard_discover_actions'
                }],
            menuTitles: {
                [MenuId.EditorTitle.id]: localize('importKeyboardShortcutsFroms', "Migrate Keyboard Shortcuts from...")
            },
            run: () => this.extensionsWorkbenchService.openSearch('@recommended:keymaps ')
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.showLanguageExtensions',
            title: localize2('showLanguageExtensionsShort', 'Language Extensions'),
            category: PreferencesLocalizedLabel,
            menu: {
                id: MenuId.CommandPalette,
                when: CONTEXT_HAS_GALLERY
            },
            run: () => this.extensionsWorkbenchService.openSearch('@recommended:languages ')
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.checkForUpdates',
            title: localize2('checkForUpdates', 'Check for Extension Updates'),
            category: ExtensionsLocalizedLabel,
            menu: [{
                    id: MenuId.CommandPalette,
                    when: ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER))
                }, {
                    id: MenuId.ViewContainerTitle,
                    when: ContextKeyExpr.and(ContextKeyExpr.equals('viewContainer', VIEWLET_ID), CONTEXT_HAS_GALLERY),
                    group: '1_updates',
                    order: 1
                }],
            run: async () => {
                await this.extensionsWorkbenchService.checkForUpdates();
                const outdated = this.extensionsWorkbenchService.outdated;
                if (outdated.length) {
                    return this.extensionsWorkbenchService.openSearch('@outdated ');
                }
                else {
                    return this.dialogService.info(localize('noUpdatesAvailable', "All extensions are up to date."));
                }
            }
        });
        const enableAutoUpdateWhenCondition = ContextKeyExpr.equals(`config.${AutoUpdateConfigurationKey}`, false);
        this.registerExtensionAction({
            id: 'workbench.extensions.action.enableAutoUpdate',
            title: localize2('enableAutoUpdate', 'Enable Auto Update for All Extensions'),
            category: ExtensionsLocalizedLabel,
            precondition: enableAutoUpdateWhenCondition,
            menu: [{
                    id: MenuId.ViewContainerTitle,
                    order: 5,
                    group: '1_updates',
                    when: ContextKeyExpr.and(ContextKeyExpr.equals('viewContainer', VIEWLET_ID), enableAutoUpdateWhenCondition)
                }, {
                    id: MenuId.CommandPalette,
                }],
            run: (accessor) => accessor.get(IExtensionsWorkbenchService).updateAutoUpdateForAllExtensions(true)
        });
        const disableAutoUpdateWhenCondition = ContextKeyExpr.notEquals(`config.${AutoUpdateConfigurationKey}`, false);
        this.registerExtensionAction({
            id: 'workbench.extensions.action.disableAutoUpdate',
            title: localize2('disableAutoUpdate', 'Disable Auto Update for All Extensions'),
            precondition: disableAutoUpdateWhenCondition,
            category: ExtensionsLocalizedLabel,
            menu: [{
                    id: MenuId.ViewContainerTitle,
                    order: 5,
                    group: '1_updates',
                    when: ContextKeyExpr.and(ContextKeyExpr.equals('viewContainer', VIEWLET_ID), disableAutoUpdateWhenCondition)
                }, {
                    id: MenuId.CommandPalette,
                }],
            run: (accessor) => accessor.get(IExtensionsWorkbenchService).updateAutoUpdateForAllExtensions(false)
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.updateAllExtensions',
            title: localize2('updateAll', 'Update All Extensions'),
            category: ExtensionsLocalizedLabel,
            precondition: HasOutdatedExtensionsContext,
            menu: [
                {
                    id: MenuId.CommandPalette,
                    when: ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER))
                }, {
                    id: MenuId.ViewContainerTitle,
                    when: ContextKeyExpr.and(ContextKeyExpr.equals('viewContainer', VIEWLET_ID), ContextKeyExpr.or(ContextKeyExpr.has(`config.${AutoUpdateConfigurationKey}`).negate(), ContextKeyExpr.equals(`config.${AutoUpdateConfigurationKey}`, 'onlyEnabledExtensions'))),
                    group: '1_updates',
                    order: 2
                }, {
                    id: MenuId.ViewTitle,
                    when: ContextKeyExpr.equals('view', OUTDATED_EXTENSIONS_VIEW_ID),
                    group: 'navigation',
                    order: 1
                }
            ],
            icon: installWorkspaceRecommendedIcon,
            run: async () => {
                await this.extensionsWorkbenchService.updateAll();
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.enableAll',
            title: localize2('enableAll', 'Enable All Extensions'),
            category: ExtensionsLocalizedLabel,
            menu: [{
                    id: MenuId.CommandPalette,
                    when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER)
                }, {
                    id: MenuId.ViewContainerTitle,
                    when: ContextKeyExpr.equals('viewContainer', VIEWLET_ID),
                    group: '2_enablement',
                    order: 1
                }],
            run: async () => {
                const extensionsToEnable = this.extensionsWorkbenchService.local.filter(e => !!e.local && this.extensionEnablementService.canChangeEnablement(e.local) && !this.extensionEnablementService.isEnabled(e.local));
                if (extensionsToEnable.length) {
                    await this.extensionsWorkbenchService.setEnablement(extensionsToEnable, 12 /* EnablementState.EnabledGlobally */);
                }
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.enableAllWorkspace',
            title: localize2('enableAllWorkspace', 'Enable All Extensions for this Workspace'),
            category: ExtensionsLocalizedLabel,
            menu: {
                id: MenuId.CommandPalette,
                when: ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo('empty'), ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER))
            },
            run: async () => {
                const extensionsToEnable = this.extensionsWorkbenchService.local.filter(e => !!e.local && this.extensionEnablementService.canChangeEnablement(e.local) && !this.extensionEnablementService.isEnabled(e.local));
                if (extensionsToEnable.length) {
                    await this.extensionsWorkbenchService.setEnablement(extensionsToEnable, 13 /* EnablementState.EnabledWorkspace */);
                }
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.disableAll',
            title: localize2('disableAll', 'Disable All Installed Extensions'),
            category: ExtensionsLocalizedLabel,
            menu: [{
                    id: MenuId.CommandPalette,
                    when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER)
                }, {
                    id: MenuId.ViewContainerTitle,
                    when: ContextKeyExpr.equals('viewContainer', VIEWLET_ID),
                    group: '2_enablement',
                    order: 2
                }],
            run: async () => {
                const extensionsToDisable = this.extensionsWorkbenchService.local.filter(e => !e.isBuiltin && !!e.local && this.extensionEnablementService.isEnabled(e.local) && this.extensionEnablementService.canChangeEnablement(e.local));
                if (extensionsToDisable.length) {
                    await this.extensionsWorkbenchService.setEnablement(extensionsToDisable, 10 /* EnablementState.DisabledGlobally */);
                }
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.disableAllWorkspace',
            title: localize2('disableAllWorkspace', 'Disable All Installed Extensions for this Workspace'),
            category: ExtensionsLocalizedLabel,
            menu: {
                id: MenuId.CommandPalette,
                when: ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo('empty'), ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER))
            },
            run: async () => {
                const extensionsToDisable = this.extensionsWorkbenchService.local.filter(e => !e.isBuiltin && !!e.local && this.extensionEnablementService.isEnabled(e.local) && this.extensionEnablementService.canChangeEnablement(e.local));
                if (extensionsToDisable.length) {
                    await this.extensionsWorkbenchService.setEnablement(extensionsToDisable, 11 /* EnablementState.DisabledWorkspace */);
                }
            }
        });
        this.registerExtensionAction({
            id: SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID,
            title: localize2('InstallFromVSIX', 'Install from VSIX...'),
            category: ExtensionsLocalizedLabel,
            menu: [{
                    id: MenuId.CommandPalette,
                    when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER)
                }, {
                    id: MenuId.ViewContainerTitle,
                    when: ContextKeyExpr.and(ContextKeyExpr.equals('viewContainer', VIEWLET_ID), ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER)),
                    group: '3_install',
                    order: 1
                }],
            run: async (accessor) => {
                const fileDialogService = accessor.get(IFileDialogService);
                const commandService = accessor.get(ICommandService);
                const vsixPaths = await fileDialogService.showOpenDialog({
                    title: localize('installFromVSIX', "Install from VSIX"),
                    filters: [{ name: 'VSIX Extensions', extensions: ['vsix'] }],
                    canSelectFiles: true,
                    canSelectMany: true,
                    openLabel: mnemonicButtonLabel(localize({ key: 'installButton', comment: ['&& denotes a mnemonic'] }, "&&Install"))
                });
                if (vsixPaths) {
                    await commandService.executeCommand(INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID, vsixPaths);
                }
            }
        });
        this.registerExtensionAction({
            id: INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID,
            title: localize('installVSIX', "Install Extension VSIX"),
            menu: [{
                    id: MenuId.ExplorerContext,
                    group: 'extensions',
                    when: ContextKeyExpr.and(ResourceContextKey.Extension.isEqualTo('.vsix'), ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER)),
                }],
            run: async (accessor, resources) => {
                const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
                const hostService = accessor.get(IHostService);
                const notificationService = accessor.get(INotificationService);
                const vsixs = Array.isArray(resources) ? resources : [resources];
                const result = await Promise.allSettled(vsixs.map(async (vsix) => await extensionsWorkbenchService.install(vsix, { installGivenVersion: true })));
                let error, requireReload = false, requireRestart = false;
                for (const r of result) {
                    if (r.status === 'rejected') {
                        error = new Error(r.reason);
                        break;
                    }
                    requireReload = requireReload || r.value.runtimeState?.action === "reloadWindow" /* ExtensionRuntimeActionType.ReloadWindow */;
                    requireRestart = requireRestart || r.value.runtimeState?.action === "restartExtensions" /* ExtensionRuntimeActionType.RestartExtensions */;
                }
                if (error) {
                    throw error;
                }
                if (requireReload) {
                    notificationService.prompt(Severity.Info, vsixs.length > 1 ? localize('InstallVSIXs.successReload', "Completed installing extensions. Please reload Visual Studio Code to enable them.")
                        : localize('InstallVSIXAction.successReload', "Completed installing extension. Please reload Visual Studio Code to enable it."), [{
                            label: localize('InstallVSIXAction.reloadNow', "Reload Now"),
                            run: () => hostService.reload()
                        }]);
                }
                else if (requireRestart) {
                    notificationService.prompt(Severity.Info, vsixs.length > 1 ? localize('InstallVSIXs.successRestart', "Completed installing extensions. Please restart extensions to enable them.")
                        : localize('InstallVSIXAction.successRestart', "Completed installing extension. Please restart extensions to enable it."), [{
                            label: localize('InstallVSIXAction.restartExtensions', "Restart Extensions"),
                            run: () => extensionsWorkbenchService.updateRunningExtensions()
                        }]);
                }
                else {
                    notificationService.prompt(Severity.Info, vsixs.length > 1 ? localize('InstallVSIXs.successNoReload', "Completed installing extensions.") : localize('InstallVSIXAction.successNoReload', "Completed installing extension."), []);
                }
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.installExtensionFromLocation',
            title: localize2('installExtensionFromLocation', 'Install Extension from Location...'),
            category: Categories.Developer,
            menu: [{
                    id: MenuId.CommandPalette,
                    when: ContextKeyExpr.or(CONTEXT_HAS_WEB_SERVER, CONTEXT_HAS_LOCAL_SERVER)
                }],
            run: async (accessor) => {
                const extensionManagementService = accessor.get(IWorkbenchExtensionManagementService);
                if (isWeb) {
                    return new Promise((c, e) => {
                        const quickInputService = accessor.get(IQuickInputService);
                        const disposables = new DisposableStore();
                        const quickPick = disposables.add(quickInputService.createQuickPick());
                        quickPick.title = localize('installFromLocation', "Install Extension from Location");
                        quickPick.customButton = true;
                        quickPick.customLabel = localize('install button', "Install");
                        quickPick.placeholder = localize('installFromLocationPlaceHolder', "Location of the web extension");
                        quickPick.ignoreFocusOut = true;
                        disposables.add(Event.any(quickPick.onDidAccept, quickPick.onDidCustom)(async () => {
                            quickPick.hide();
                            if (quickPick.value) {
                                try {
                                    await extensionManagementService.installFromLocation(URI.parse(quickPick.value));
                                }
                                catch (error) {
                                    e(error);
                                    return;
                                }
                            }
                            c();
                        }));
                        disposables.add(quickPick.onDidHide(() => disposables.dispose()));
                        quickPick.show();
                    });
                }
                else {
                    const fileDialogService = accessor.get(IFileDialogService);
                    const extensionLocation = await fileDialogService.showOpenDialog({
                        canSelectFolders: true,
                        canSelectFiles: false,
                        canSelectMany: false,
                        title: localize('installFromLocation', "Install Extension from Location"),
                    });
                    if (extensionLocation?.[0]) {
                        await extensionManagementService.installFromLocation(extensionLocation[0]);
                    }
                }
            }
        });
        MenuRegistry.appendMenuItem(extensionsSearchActionsMenu, {
            submenu: extensionsFilterSubMenu,
            title: localize('filterExtensions', "Filter Extensions..."),
            group: 'navigation',
            order: 2,
            icon: filterIcon,
        });
        const showFeaturedExtensionsId = 'extensions.filter.featured';
        const featuresExtensionsWhenContext = ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.regex(CONTEXT_GALLERY_FILTER_CAPABILITIES.key, new RegExp(`_${"Featured" /* FilterType.Featured */}_`)));
        this.registerExtensionAction({
            id: showFeaturedExtensionsId,
            title: localize2('showFeaturedExtensions', 'Show Featured Extensions'),
            category: ExtensionsLocalizedLabel,
            menu: [{
                    id: MenuId.CommandPalette,
                    when: featuresExtensionsWhenContext
                }, {
                    id: extensionsFilterSubMenu,
                    when: featuresExtensionsWhenContext,
                    group: '1_predefined',
                    order: 1,
                }],
            menuTitles: {
                [extensionsFilterSubMenu.id]: localize('featured filter', "Featured")
            },
            run: () => this.extensionsWorkbenchService.openSearch('@featured ')
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.showPopularExtensions',
            title: localize2('showPopularExtensions', 'Show Popular Extensions'),
            category: ExtensionsLocalizedLabel,
            menu: [{
                    id: MenuId.CommandPalette,
                    when: CONTEXT_HAS_GALLERY
                }, {
                    id: extensionsFilterSubMenu,
                    when: CONTEXT_HAS_GALLERY,
                    group: '1_predefined',
                    order: 2,
                }],
            menuTitles: {
                [extensionsFilterSubMenu.id]: localize('most popular filter', "Most Popular")
            },
            run: () => this.extensionsWorkbenchService.openSearch('@popular ')
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.showRecommendedExtensions',
            title: localize2('showRecommendedExtensions', 'Show Recommended Extensions'),
            category: ExtensionsLocalizedLabel,
            menu: [{
                    id: MenuId.CommandPalette,
                    when: CONTEXT_HAS_GALLERY
                }, {
                    id: extensionsFilterSubMenu,
                    when: CONTEXT_HAS_GALLERY,
                    group: '1_predefined',
                    order: 2,
                }],
            menuTitles: {
                [extensionsFilterSubMenu.id]: localize('most popular recommended', "Recommended")
            },
            run: () => this.extensionsWorkbenchService.openSearch('@recommended ')
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.recentlyPublishedExtensions',
            title: localize2('recentlyPublishedExtensions', 'Show Recently Published Extensions'),
            category: ExtensionsLocalizedLabel,
            menu: [{
                    id: MenuId.CommandPalette,
                    when: CONTEXT_HAS_GALLERY
                }, {
                    id: extensionsFilterSubMenu,
                    when: CONTEXT_HAS_GALLERY,
                    group: '1_predefined',
                    order: 2,
                }],
            menuTitles: {
                [extensionsFilterSubMenu.id]: localize('recently published filter', "Recently Published")
            },
            run: () => this.extensionsWorkbenchService.openSearch('@recentlyPublished ')
        });
        const extensionsCategoryFilterSubMenu = new MenuId('extensionsCategoryFilterSubMenu');
        MenuRegistry.appendMenuItem(extensionsFilterSubMenu, {
            submenu: extensionsCategoryFilterSubMenu,
            title: localize('filter by category', "Category"),
            when: ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.regex(CONTEXT_GALLERY_FILTER_CAPABILITIES.key, new RegExp(`_${"Category" /* FilterType.Category */}_`))),
            group: '2_categories',
            order: 1,
        });
        EXTENSION_CATEGORIES.forEach((category, index) => {
            this.registerExtensionAction({
                id: `extensions.actions.searchByCategory.${category}`,
                title: category,
                menu: [{
                        id: extensionsCategoryFilterSubMenu,
                        when: CONTEXT_HAS_GALLERY,
                        order: index,
                    }],
                run: () => this.extensionsWorkbenchService.openSearch(`@category:"${category.toLowerCase()}"`)
            });
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.installedExtensions',
            title: localize2('installedExtensions', 'Show Installed Extensions'),
            category: ExtensionsLocalizedLabel,
            f1: true,
            menu: [{
                    id: extensionsFilterSubMenu,
                    group: '3_installed',
                    order: 1,
                }],
            menuTitles: {
                [extensionsFilterSubMenu.id]: localize('installed filter', "Installed")
            },
            run: () => this.extensionsWorkbenchService.openSearch('@installed ')
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.listBuiltInExtensions',
            title: localize2('showBuiltInExtensions', 'Show Built-in Extensions'),
            category: ExtensionsLocalizedLabel,
            menu: [{
                    id: MenuId.CommandPalette,
                    when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER)
                }, {
                    id: extensionsFilterSubMenu,
                    group: '3_installed',
                    order: 3,
                }],
            menuTitles: {
                [extensionsFilterSubMenu.id]: localize('builtin filter', "Built-in")
            },
            run: () => this.extensionsWorkbenchService.openSearch('@builtin ')
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.extensionUpdates',
            title: localize2('extensionUpdates', 'Show Extension Updates'),
            category: ExtensionsLocalizedLabel,
            precondition: CONTEXT_HAS_GALLERY,
            f1: true,
            menu: [{
                    id: extensionsFilterSubMenu,
                    group: '3_installed',
                    when: CONTEXT_HAS_GALLERY,
                    order: 2,
                }],
            menuTitles: {
                [extensionsFilterSubMenu.id]: localize('extension updates filter', "Updates")
            },
            run: () => this.extensionsWorkbenchService.openSearch('@updates')
        });
        this.registerExtensionAction({
            id: LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID,
            title: localize2('showWorkspaceUnsupportedExtensions', 'Show Extensions Unsupported By Workspace'),
            category: ExtensionsLocalizedLabel,
            menu: [{
                    id: MenuId.CommandPalette,
                    when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER),
                }, {
                    id: extensionsFilterSubMenu,
                    group: '3_installed',
                    order: 6,
                    when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER),
                }],
            menuTitles: {
                [extensionsFilterSubMenu.id]: localize('workspace unsupported filter', "Workspace Unsupported")
            },
            run: () => this.extensionsWorkbenchService.openSearch('@workspaceUnsupported')
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.showEnabledExtensions',
            title: localize2('showEnabledExtensions', 'Show Enabled Extensions'),
            category: ExtensionsLocalizedLabel,
            menu: [{
                    id: MenuId.CommandPalette,
                    when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER)
                }, {
                    id: extensionsFilterSubMenu,
                    group: '3_installed',
                    order: 4,
                }],
            menuTitles: {
                [extensionsFilterSubMenu.id]: localize('enabled filter', "Enabled")
            },
            run: () => this.extensionsWorkbenchService.openSearch('@enabled ')
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.showDisabledExtensions',
            title: localize2('showDisabledExtensions', 'Show Disabled Extensions'),
            category: ExtensionsLocalizedLabel,
            menu: [{
                    id: MenuId.CommandPalette,
                    when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER)
                }, {
                    id: extensionsFilterSubMenu,
                    group: '3_installed',
                    order: 5,
                }],
            menuTitles: {
                [extensionsFilterSubMenu.id]: localize('disabled filter', "Disabled")
            },
            run: () => this.extensionsWorkbenchService.openSearch('@disabled ')
        });
        const extensionsSortSubMenu = new MenuId('extensionsSortSubMenu');
        MenuRegistry.appendMenuItem(extensionsFilterSubMenu, {
            submenu: extensionsSortSubMenu,
            title: localize('sorty by', "Sort By"),
            when: ContextKeyExpr.and(ContextKeyExpr.or(CONTEXT_HAS_GALLERY, DefaultViewsContext)),
            group: '4_sort',
            order: 1,
        });
        [
            { id: 'installs', title: localize('sort by installs', "Install Count"), precondition: BuiltInExtensionsContext.negate(), sortCapability: "InstallCount" /* SortBy.InstallCount */ },
            { id: 'rating', title: localize('sort by rating', "Rating"), precondition: BuiltInExtensionsContext.negate(), sortCapability: "WeightedRating" /* SortBy.WeightedRating */ },
            { id: 'name', title: localize('sort by name', "Name"), precondition: BuiltInExtensionsContext.negate(), sortCapability: "Title" /* SortBy.Title */ },
            { id: 'publishedDate', title: localize('sort by published date', "Published Date"), precondition: BuiltInExtensionsContext.negate(), sortCapability: "PublishedDate" /* SortBy.PublishedDate */ },
            { id: 'updateDate', title: localize('sort by update date', "Updated Date"), precondition: ContextKeyExpr.and(SearchMarketplaceExtensionsContext.negate(), RecommendedExtensionsContext.negate(), BuiltInExtensionsContext.negate()), sortCapability: 'UpdateDate' },
        ].map(({ id, title, precondition, sortCapability }, index) => {
            const sortCapabilityContext = ContextKeyExpr.regex(CONTEXT_GALLERY_SORT_CAPABILITIES.key, new RegExp(`_${sortCapability}_`));
            this.registerExtensionAction({
                id: `extensions.sort.${id}`,
                title,
                precondition: ContextKeyExpr.and(precondition, ContextKeyExpr.regex(ExtensionsSearchValueContext.key, /^@feature:/).negate(), sortCapabilityContext),
                menu: [{
                        id: extensionsSortSubMenu,
                        when: ContextKeyExpr.and(ContextKeyExpr.or(CONTEXT_HAS_GALLERY, DefaultViewsContext), sortCapabilityContext),
                        order: index,
                    }],
                toggled: ExtensionsSortByContext.isEqualTo(id),
                run: async () => {
                    const extensionsViewPaneContainer = ((await this.viewsService.openViewContainer(VIEWLET_ID, true))?.getViewPaneContainer());
                    const currentQuery = Query.parse(extensionsViewPaneContainer?.searchValue ?? '');
                    extensionsViewPaneContainer?.search(new Query(currentQuery.value, id).toString());
                    extensionsViewPaneContainer?.focus();
                }
            });
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.clearExtensionsSearchResults',
            title: localize2('clearExtensionsSearchResults', 'Clear Extensions Search Results'),
            category: ExtensionsLocalizedLabel,
            icon: clearSearchResultsIcon,
            f1: true,
            precondition: SearchHasTextContext,
            menu: {
                id: extensionsSearchActionsMenu,
                group: 'navigation',
                order: 1,
            },
            run: async (accessor) => {
                const viewPaneContainer = accessor.get(IViewsService).getActiveViewPaneContainerWithId(VIEWLET_ID);
                if (viewPaneContainer) {
                    const extensionsViewPaneContainer = viewPaneContainer;
                    extensionsViewPaneContainer.search('');
                    extensionsViewPaneContainer.focus();
                }
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.refreshExtension',
            title: localize2('refreshExtension', 'Refresh'),
            category: ExtensionsLocalizedLabel,
            icon: refreshIcon,
            f1: true,
            menu: {
                id: MenuId.ViewContainerTitle,
                when: ContextKeyExpr.equals('viewContainer', VIEWLET_ID),
                group: 'navigation',
                order: 2
            },
            run: async (accessor) => {
                const viewPaneContainer = accessor.get(IViewsService).getActiveViewPaneContainerWithId(VIEWLET_ID);
                if (viewPaneContainer) {
                    await viewPaneContainer.refresh();
                }
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.installWorkspaceRecommendedExtensions',
            title: localize('installWorkspaceRecommendedExtensions', "Install Workspace Recommended Extensions"),
            icon: installWorkspaceRecommendedIcon,
            menu: {
                id: MenuId.ViewTitle,
                when: ContextKeyExpr.equals('view', WORKSPACE_RECOMMENDATIONS_VIEW_ID),
                group: 'navigation',
                order: 1
            },
            run: async (accessor) => {
                const view = accessor.get(IViewsService).getActiveViewWithId(WORKSPACE_RECOMMENDATIONS_VIEW_ID);
                return view.installWorkspaceRecommendations();
            }
        });
        this.registerExtensionAction({
            id: ConfigureWorkspaceFolderRecommendedExtensionsAction.ID,
            title: ConfigureWorkspaceFolderRecommendedExtensionsAction.LABEL,
            icon: configureRecommendedIcon,
            menu: [{
                    id: MenuId.CommandPalette,
                    when: WorkbenchStateContext.notEqualsTo('empty'),
                }, {
                    id: MenuId.ViewTitle,
                    when: ContextKeyExpr.equals('view', WORKSPACE_RECOMMENDATIONS_VIEW_ID),
                    group: 'navigation',
                    order: 2
                }],
            run: () => runAction(this.instantiationService.createInstance(ConfigureWorkspaceFolderRecommendedExtensionsAction, ConfigureWorkspaceFolderRecommendedExtensionsAction.ID, ConfigureWorkspaceFolderRecommendedExtensionsAction.LABEL))
        });
        this.registerExtensionAction({
            id: InstallSpecificVersionOfExtensionAction.ID,
            title: { value: InstallSpecificVersionOfExtensionAction.LABEL, original: 'Install Specific Version of Extension...' },
            category: ExtensionsLocalizedLabel,
            menu: {
                id: MenuId.CommandPalette,
                when: ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER))
            },
            run: () => runAction(this.instantiationService.createInstance(InstallSpecificVersionOfExtensionAction, InstallSpecificVersionOfExtensionAction.ID, InstallSpecificVersionOfExtensionAction.LABEL))
        });
    }
    // Extension Context Menu
    registerContextMenuActions() {
        this.registerExtensionAction({
            id: SetColorThemeAction.ID,
            title: SetColorThemeAction.TITLE,
            menu: {
                id: MenuId.ExtensionContext,
                group: THEME_ACTIONS_GROUP,
                order: 0,
                when: ContextKeyExpr.and(ContextKeyExpr.not('inExtensionEditor'), ContextKeyExpr.equals('extensionStatus', 'installed'), ContextKeyExpr.has('extensionHasColorThemes'))
            },
            run: async (accessor, extensionId) => {
                const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
                const instantiationService = accessor.get(IInstantiationService);
                const extension = extensionWorkbenchService.local.find(e => areSameExtensions(e.identifier, { id: extensionId }));
                if (extension) {
                    const action = instantiationService.createInstance(SetColorThemeAction);
                    action.extension = extension;
                    return action.run();
                }
            }
        });
        this.registerExtensionAction({
            id: SetFileIconThemeAction.ID,
            title: SetFileIconThemeAction.TITLE,
            menu: {
                id: MenuId.ExtensionContext,
                group: THEME_ACTIONS_GROUP,
                order: 0,
                when: ContextKeyExpr.and(ContextKeyExpr.not('inExtensionEditor'), ContextKeyExpr.equals('extensionStatus', 'installed'), ContextKeyExpr.has('extensionHasFileIconThemes'))
            },
            run: async (accessor, extensionId) => {
                const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
                const instantiationService = accessor.get(IInstantiationService);
                const extension = extensionWorkbenchService.local.find(e => areSameExtensions(e.identifier, { id: extensionId }));
                if (extension) {
                    const action = instantiationService.createInstance(SetFileIconThemeAction);
                    action.extension = extension;
                    return action.run();
                }
            }
        });
        this.registerExtensionAction({
            id: SetProductIconThemeAction.ID,
            title: SetProductIconThemeAction.TITLE,
            menu: {
                id: MenuId.ExtensionContext,
                group: THEME_ACTIONS_GROUP,
                order: 0,
                when: ContextKeyExpr.and(ContextKeyExpr.not('inExtensionEditor'), ContextKeyExpr.equals('extensionStatus', 'installed'), ContextKeyExpr.has('extensionHasProductIconThemes'))
            },
            run: async (accessor, extensionId) => {
                const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
                const instantiationService = accessor.get(IInstantiationService);
                const extension = extensionWorkbenchService.local.find(e => areSameExtensions(e.identifier, { id: extensionId }));
                if (extension) {
                    const action = instantiationService.createInstance(SetProductIconThemeAction);
                    action.extension = extension;
                    return action.run();
                }
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.showPreReleaseVersion',
            title: localize2('show pre-release version', 'Show Pre-Release Version'),
            menu: {
                id: MenuId.ExtensionContext,
                group: INSTALL_ACTIONS_GROUP,
                order: 0,
                when: ContextKeyExpr.and(ContextKeyExpr.has('inExtensionEditor'), ContextKeyExpr.has('galleryExtensionHasPreReleaseVersion'), ContextKeyExpr.has('isPreReleaseExtensionAllowed'), ContextKeyExpr.not('showPreReleaseVersion'), ContextKeyExpr.not('isBuiltinExtension'))
            },
            run: async (accessor, extensionId) => {
                const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
                const extension = (await extensionWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
                extensionWorkbenchService.open(extension, { showPreReleaseVersion: true });
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.showReleasedVersion',
            title: localize2('show released version', 'Show Release Version'),
            menu: {
                id: MenuId.ExtensionContext,
                group: INSTALL_ACTIONS_GROUP,
                order: 1,
                when: ContextKeyExpr.and(ContextKeyExpr.has('inExtensionEditor'), ContextKeyExpr.has('galleryExtensionHasPreReleaseVersion'), ContextKeyExpr.has('extensionHasReleaseVersion'), ContextKeyExpr.has('showPreReleaseVersion'), ContextKeyExpr.not('isBuiltinExtension'))
            },
            run: async (accessor, extensionId) => {
                const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
                const extension = (await extensionWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
                extensionWorkbenchService.open(extension, { showPreReleaseVersion: false });
            }
        });
        this.registerExtensionAction({
            id: ToggleAutoUpdateForExtensionAction.ID,
            title: ToggleAutoUpdateForExtensionAction.LABEL,
            category: ExtensionsLocalizedLabel,
            precondition: ContextKeyExpr.and(ContextKeyExpr.or(ContextKeyExpr.notEquals(`config.${AutoUpdateConfigurationKey}`, 'onlyEnabledExtensions'), ContextKeyExpr.equals('isExtensionEnabled', true)), ContextKeyExpr.not('extensionDisallowInstall'), ContextKeyExpr.has('isExtensionAllowed')),
            menu: {
                id: MenuId.ExtensionContext,
                group: UPDATE_ACTIONS_GROUP,
                order: 1,
                when: ContextKeyExpr.and(ContextKeyExpr.not('inExtensionEditor'), ContextKeyExpr.equals('extensionStatus', 'installed'), ContextKeyExpr.not('isBuiltinExtension'))
            },
            run: async (accessor, id) => {
                const instantiationService = accessor.get(IInstantiationService);
                const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
                const extension = extensionWorkbenchService.local.find(e => areSameExtensions(e.identifier, { id }));
                if (extension) {
                    const action = instantiationService.createInstance(ToggleAutoUpdateForExtensionAction);
                    action.extension = extension;
                    return action.run();
                }
            }
        });
        this.registerExtensionAction({
            id: ToggleAutoUpdatesForPublisherAction.ID,
            title: { value: ToggleAutoUpdatesForPublisherAction.LABEL, original: 'Auto Update (Publisher)' },
            category: ExtensionsLocalizedLabel,
            precondition: ContextKeyExpr.equals(`config.${AutoUpdateConfigurationKey}`, false),
            menu: {
                id: MenuId.ExtensionContext,
                group: UPDATE_ACTIONS_GROUP,
                order: 2,
                when: ContextKeyExpr.and(ContextKeyExpr.equals('extensionStatus', 'installed'), ContextKeyExpr.not('isBuiltinExtension'))
            },
            run: async (accessor, id) => {
                const instantiationService = accessor.get(IInstantiationService);
                const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
                const extension = extensionWorkbenchService.local.find(e => areSameExtensions(e.identifier, { id }));
                if (extension) {
                    const action = instantiationService.createInstance(ToggleAutoUpdatesForPublisherAction);
                    action.extension = extension;
                    return action.run();
                }
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.switchToPreRlease',
            title: localize('enablePreRleaseLabel', "Switch to Pre-Release Version"),
            category: ExtensionsLocalizedLabel,
            menu: {
                id: MenuId.ExtensionContext,
                group: INSTALL_ACTIONS_GROUP,
                order: 2,
                when: ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.has('galleryExtensionHasPreReleaseVersion'), ContextKeyExpr.has('isPreReleaseExtensionAllowed'), ContextKeyExpr.not('installedExtensionIsOptedToPreRelease'), ContextKeyExpr.not('inExtensionEditor'), ContextKeyExpr.equals('extensionStatus', 'installed'), ContextKeyExpr.not('isBuiltinExtension'))
            },
            run: async (accessor, id) => {
                const instantiationService = accessor.get(IInstantiationService);
                const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
                const extension = extensionWorkbenchService.local.find(e => areSameExtensions(e.identifier, { id }));
                if (extension) {
                    const action = instantiationService.createInstance(TogglePreReleaseExtensionAction);
                    action.extension = extension;
                    return action.run();
                }
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.switchToRelease',
            title: localize('disablePreRleaseLabel', "Switch to Release Version"),
            category: ExtensionsLocalizedLabel,
            menu: {
                id: MenuId.ExtensionContext,
                group: INSTALL_ACTIONS_GROUP,
                order: 2,
                when: ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.has('galleryExtensionHasPreReleaseVersion'), ContextKeyExpr.has('isExtensionAllowed'), ContextKeyExpr.has('installedExtensionIsOptedToPreRelease'), ContextKeyExpr.not('inExtensionEditor'), ContextKeyExpr.equals('extensionStatus', 'installed'), ContextKeyExpr.not('isBuiltinExtension'))
            },
            run: async (accessor, id) => {
                const instantiationService = accessor.get(IInstantiationService);
                const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
                const extension = extensionWorkbenchService.local.find(e => areSameExtensions(e.identifier, { id }));
                if (extension) {
                    const action = instantiationService.createInstance(TogglePreReleaseExtensionAction);
                    action.extension = extension;
                    return action.run();
                }
            }
        });
        this.registerExtensionAction({
            id: ClearLanguageAction.ID,
            title: ClearLanguageAction.TITLE,
            menu: {
                id: MenuId.ExtensionContext,
                group: INSTALL_ACTIONS_GROUP,
                order: 0,
                when: ContextKeyExpr.and(ContextKeyExpr.not('inExtensionEditor'), ContextKeyExpr.has('canSetLanguage'), ContextKeyExpr.has('isActiveLanguagePackExtension'))
            },
            run: async (accessor, extensionId) => {
                const instantiationService = accessor.get(IInstantiationService);
                const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
                const extension = (await extensionsWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
                const action = instantiationService.createInstance(ClearLanguageAction);
                action.extension = extension;
                return action.run();
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.installUnsigned',
            title: localize('install', "Install"),
            menu: {
                id: MenuId.ExtensionContext,
                group: '0_install',
                when: ContextKeyExpr.and(ContextKeyExpr.equals('extensionStatus', 'uninstalled'), ContextKeyExpr.has('isGalleryExtension'), ContextKeyExpr.not('extensionDisallowInstall'), ContextKeyExpr.has('extensionIsUnsigned'), ContextKeyExpr.or(ContextKeyExpr.and(CONTEXT_GALLERY_ALL_PUBLIC_REPOSITORY_SIGNED, ContextKeyExpr.not('extensionIsPrivate')), ContextKeyExpr.and(CONTEXT_GALLERY_ALL_PRIVATE_REPOSITORY_SIGNED, ContextKeyExpr.has('extensionIsPrivate')))),
                order: 1
            },
            run: async (accessor, extensionId) => {
                const instantiationService = accessor.get(IInstantiationService);
                const extension = this.extensionsWorkbenchService.local.filter(e => areSameExtensions(e.identifier, { id: extensionId }))[0]
                    || (await this.extensionsWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
                if (extension) {
                    const action = instantiationService.createInstance(InstallAction, { installPreReleaseVersion: this.extensionManagementService.preferPreReleases });
                    action.extension = extension;
                    return action.run();
                }
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.installAndDonotSync',
            title: localize('install installAndDonotSync', "Install (Do not Sync)"),
            menu: {
                id: MenuId.ExtensionContext,
                group: '0_install',
                when: ContextKeyExpr.and(ContextKeyExpr.equals('extensionStatus', 'uninstalled'), ContextKeyExpr.has('isGalleryExtension'), ContextKeyExpr.has('isExtensionAllowed'), ContextKeyExpr.not('extensionDisallowInstall'), CONTEXT_SYNC_ENABLEMENT),
                order: 1
            },
            run: async (accessor, extensionId) => {
                const instantiationService = accessor.get(IInstantiationService);
                const extension = this.extensionsWorkbenchService.local.filter(e => areSameExtensions(e.identifier, { id: extensionId }))[0]
                    || (await this.extensionsWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
                if (extension) {
                    const action = instantiationService.createInstance(InstallAction, {
                        installPreReleaseVersion: this.extensionManagementService.preferPreReleases,
                        isMachineScoped: true,
                    });
                    action.extension = extension;
                    return action.run();
                }
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.installPrereleaseAndDonotSync',
            title: localize('installPrereleaseAndDonotSync', "Install Pre-Release (Do not Sync)"),
            menu: {
                id: MenuId.ExtensionContext,
                group: '0_install',
                when: ContextKeyExpr.and(ContextKeyExpr.equals('extensionStatus', 'uninstalled'), ContextKeyExpr.has('isGalleryExtension'), ContextKeyExpr.has('extensionHasPreReleaseVersion'), ContextKeyExpr.has('isPreReleaseExtensionAllowed'), ContextKeyExpr.not('extensionDisallowInstall'), CONTEXT_SYNC_ENABLEMENT),
                order: 2
            },
            run: async (accessor, extensionId) => {
                const instantiationService = accessor.get(IInstantiationService);
                const extension = this.extensionsWorkbenchService.local.filter(e => areSameExtensions(e.identifier, { id: extensionId }))[0]
                    || (await this.extensionsWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
                if (extension) {
                    const action = instantiationService.createInstance(InstallAction, {
                        isMachineScoped: true,
                        preRelease: true
                    });
                    action.extension = extension;
                    return action.run();
                }
            }
        });
        this.registerExtensionAction({
            id: InstallAnotherVersionAction.ID,
            title: InstallAnotherVersionAction.LABEL,
            menu: {
                id: MenuId.ExtensionContext,
                group: '0_install',
                when: ContextKeyExpr.and(ContextKeyExpr.equals('extensionStatus', 'uninstalled'), ContextKeyExpr.has('isGalleryExtension'), ContextKeyExpr.has('isExtensionAllowed'), ContextKeyExpr.not('extensionDisallowInstall')),
                order: 3
            },
            run: async (accessor, extensionId) => {
                const instantiationService = accessor.get(IInstantiationService);
                const extension = this.extensionsWorkbenchService.local.filter(e => areSameExtensions(e.identifier, { id: extensionId }))[0]
                    || (await this.extensionsWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
                if (extension) {
                    return instantiationService.createInstance(InstallAnotherVersionAction, extension, false).run();
                }
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.copyExtension',
            title: localize2('workbench.extensions.action.copyExtension', 'Copy'),
            menu: {
                id: MenuId.ExtensionContext,
                group: '1_copy'
            },
            run: async (accessor, extensionId) => {
                const clipboardService = accessor.get(IClipboardService);
                const extension = this.extensionsWorkbenchService.local.filter(e => areSameExtensions(e.identifier, { id: extensionId }))[0]
                    || (await this.extensionsWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
                if (extension) {
                    const name = localize('extensionInfoName', 'Name: {0}', extension.displayName);
                    const id = localize('extensionInfoId', 'Id: {0}', extensionId);
                    const description = localize('extensionInfoDescription', 'Description: {0}', extension.description);
                    const verision = localize('extensionInfoVersion', 'Version: {0}', extension.version);
                    const publisher = localize('extensionInfoPublisher', 'Publisher: {0}', extension.publisherDisplayName);
                    const link = extension.url ? localize('extensionInfoVSMarketplaceLink', 'VS Marketplace Link: {0}', `${extension.url}`) : null;
                    const clipboardStr = `${name}\n${id}\n${description}\n${verision}\n${publisher}${link ? '\n' + link : ''}`;
                    await clipboardService.writeText(clipboardStr);
                }
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.copyExtensionId',
            title: localize2('workbench.extensions.action.copyExtensionId', 'Copy Extension ID'),
            menu: {
                id: MenuId.ExtensionContext,
                group: '1_copy'
            },
            run: async (accessor, id) => accessor.get(IClipboardService).writeText(id)
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.copyLink',
            title: localize2('workbench.extensions.action.copyLink', 'Copy Link'),
            menu: {
                id: MenuId.ExtensionContext,
                group: '1_copy',
                when: ContextKeyExpr.and(ContextKeyExpr.has('isGalleryExtension'), CONTEXT_GALLERY_HAS_EXTENSION_LINK),
            },
            run: async (accessor, _, extension) => {
                const clipboardService = accessor.get(IClipboardService);
                if (extension.galleryLink) {
                    await clipboardService.writeText(extension.galleryLink);
                }
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.configure',
            title: localize2('workbench.extensions.action.configure', 'Settings'),
            menu: {
                id: MenuId.ExtensionContext,
                group: '2_configure',
                when: ContextKeyExpr.and(ContextKeyExpr.equals('extensionStatus', 'installed'), ContextKeyExpr.has('extensionHasConfiguration')),
                order: 1
            },
            run: async (accessor, id) => accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: `@ext:${id}` })
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.download',
            title: localize('download VSIX', "Download VSIX"),
            menu: {
                id: MenuId.ExtensionContext,
                when: ContextKeyExpr.and(ContextKeyExpr.not('extensionDisallowInstall'), ContextKeyExpr.has('isGalleryExtension')),
                order: this.productService.quality === 'stable' ? 0 : 1
            },
            run: async (accessor, extensionId) => {
                accessor.get(IExtensionsWorkbenchService).downloadVSIX(extensionId, 'release');
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.downloadPreRelease',
            title: localize('download pre-release', "Download Pre-Release VSIX"),
            menu: {
                id: MenuId.ExtensionContext,
                when: ContextKeyExpr.and(ContextKeyExpr.not('extensionDisallowInstall'), ContextKeyExpr.has('isGalleryExtension'), ContextKeyExpr.has('extensionHasPreReleaseVersion')),
                order: this.productService.quality === 'stable' ? 1 : 0
            },
            run: async (accessor, extensionId) => {
                accessor.get(IExtensionsWorkbenchService).downloadVSIX(extensionId, 'prerelease');
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.downloadSpecificVersion',
            title: localize('download specific version', "Download Specific Version VSIX..."),
            menu: {
                id: MenuId.ExtensionContext,
                when: ContextKeyExpr.and(ContextKeyExpr.not('extensionDisallowInstall'), ContextKeyExpr.has('isGalleryExtension')),
                order: 2
            },
            run: async (accessor, extensionId) => {
                accessor.get(IExtensionsWorkbenchService).downloadVSIX(extensionId, 'any');
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.manageAccountPreferences',
            title: localize2('workbench.extensions.action.changeAccountPreference', "Account Preferences"),
            menu: {
                id: MenuId.ExtensionContext,
                group: '2_configure',
                when: ContextKeyExpr.and(ContextKeyExpr.equals('extensionStatus', 'installed'), ContextKeyExpr.has('extensionHasAccountPreferences')),
                order: 2,
            },
            run: (accessor, id) => accessor.get(ICommandService).executeCommand('_manageAccountPreferencesForExtension', id)
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.configureKeybindings',
            title: localize2('workbench.extensions.action.configureKeybindings', 'Keyboard Shortcuts'),
            menu: {
                id: MenuId.ExtensionContext,
                group: '2_configure',
                when: ContextKeyExpr.and(ContextKeyExpr.equals('extensionStatus', 'installed'), ContextKeyExpr.has('extensionHasKeybindings')),
                order: 2
            },
            run: async (accessor, id) => accessor.get(IPreferencesService).openGlobalKeybindingSettings(false, { query: `@ext:${id}` })
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.toggleApplyToAllProfiles',
            title: localize2('workbench.extensions.action.toggleApplyToAllProfiles', "Apply Extension to all Profiles"),
            toggled: ContextKeyExpr.has('isApplicationScopedExtension'),
            menu: {
                id: MenuId.ExtensionContext,
                group: '2_configure',
                when: ContextKeyExpr.and(ContextKeyExpr.equals('extensionStatus', 'installed'), ContextKeyExpr.has('isDefaultApplicationScopedExtension').negate(), ContextKeyExpr.has('isBuiltinExtension').negate(), ContextKeyExpr.equals('isWorkspaceScopedExtension', false)),
                order: 3
            },
            run: async (accessor, _, extensionArg) => {
                const uriIdentityService = accessor.get(IUriIdentityService);
                const extension = extensionArg.location ? this.extensionsWorkbenchService.installed.find(e => uriIdentityService.extUri.isEqual(e.local?.location, extensionArg.location)) : undefined;
                if (extension) {
                    return this.extensionsWorkbenchService.toggleApplyExtensionToAllProfiles(extension);
                }
            }
        });
        this.registerExtensionAction({
            id: TOGGLE_IGNORE_EXTENSION_ACTION_ID,
            title: localize2('workbench.extensions.action.toggleIgnoreExtension', "Sync This Extension"),
            menu: {
                id: MenuId.ExtensionContext,
                group: '2_configure',
                when: ContextKeyExpr.and(ContextKeyExpr.equals('extensionStatus', 'installed'), CONTEXT_SYNC_ENABLEMENT, ContextKeyExpr.equals('isWorkspaceScopedExtension', false)),
                order: 4
            },
            run: async (accessor, id) => {
                const extension = this.extensionsWorkbenchService.local.find(e => areSameExtensions({ id }, e.identifier));
                if (extension) {
                    return this.extensionsWorkbenchService.toggleExtensionIgnoredToSync(extension);
                }
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.ignoreRecommendation',
            title: localize2('workbench.extensions.action.ignoreRecommendation', "Ignore Recommendation"),
            menu: {
                id: MenuId.ExtensionContext,
                group: '3_recommendations',
                when: ContextKeyExpr.has('isExtensionRecommended'),
                order: 1
            },
            run: async (accessor, id) => accessor.get(IExtensionIgnoredRecommendationsService).toggleGlobalIgnoredRecommendation(id, true)
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.undoIgnoredRecommendation',
            title: localize2('workbench.extensions.action.undoIgnoredRecommendation', "Undo Ignored Recommendation"),
            menu: {
                id: MenuId.ExtensionContext,
                group: '3_recommendations',
                when: ContextKeyExpr.has('isUserIgnoredRecommendation'),
                order: 1
            },
            run: async (accessor, id) => accessor.get(IExtensionIgnoredRecommendationsService).toggleGlobalIgnoredRecommendation(id, false)
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.addExtensionToWorkspaceRecommendations',
            title: localize2('workbench.extensions.action.addExtensionToWorkspaceRecommendations', "Add to Workspace Recommendations"),
            menu: {
                id: MenuId.ExtensionContext,
                group: '3_recommendations',
                when: ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo('empty'), ContextKeyExpr.has('isBuiltinExtension').negate(), ContextKeyExpr.has('isExtensionWorkspaceRecommended').negate(), ContextKeyExpr.has('isUserIgnoredRecommendation').negate(), ContextKeyExpr.notEquals('extensionSource', 'resource')),
                order: 2
            },
            run: (accessor, id) => accessor.get(IWorkspaceExtensionsConfigService).toggleRecommendation(id)
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.removeExtensionFromWorkspaceRecommendations',
            title: localize2('workbench.extensions.action.removeExtensionFromWorkspaceRecommendations', "Remove from Workspace Recommendations"),
            menu: {
                id: MenuId.ExtensionContext,
                group: '3_recommendations',
                when: ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo('empty'), ContextKeyExpr.has('isBuiltinExtension').negate(), ContextKeyExpr.has('isExtensionWorkspaceRecommended')),
                order: 2
            },
            run: (accessor, id) => accessor.get(IWorkspaceExtensionsConfigService).toggleRecommendation(id)
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.addToWorkspaceRecommendations',
            title: localize2('workbench.extensions.action.addToWorkspaceRecommendations', "Add Extension to Workspace Recommendations"),
            category: EXTENSIONS_CATEGORY,
            menu: {
                id: MenuId.CommandPalette,
                when: ContextKeyExpr.and(WorkbenchStateContext.isEqualTo('workspace'), ContextKeyExpr.equals('resourceScheme', Schemas.extension)),
            },
            async run(accessor) {
                const editorService = accessor.get(IEditorService);
                const workspaceExtensionsConfigService = accessor.get(IWorkspaceExtensionsConfigService);
                if (!(editorService.activeEditor instanceof ExtensionsInput)) {
                    return;
                }
                const extensionId = editorService.activeEditor.extension.identifier.id.toLowerCase();
                const recommendations = await workspaceExtensionsConfigService.getRecommendations();
                if (recommendations.includes(extensionId)) {
                    return;
                }
                await workspaceExtensionsConfigService.toggleRecommendation(extensionId);
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.addToWorkspaceFolderRecommendations',
            title: localize2('workbench.extensions.action.addToWorkspaceFolderRecommendations', "Add Extension to Workspace Folder Recommendations"),
            category: EXTENSIONS_CATEGORY,
            menu: {
                id: MenuId.CommandPalette,
                when: ContextKeyExpr.and(WorkbenchStateContext.isEqualTo('folder'), ContextKeyExpr.equals('resourceScheme', Schemas.extension)),
            },
            run: () => this.commandService.executeCommand('workbench.extensions.action.addToWorkspaceRecommendations')
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.addToWorkspaceIgnoredRecommendations',
            title: localize2('workbench.extensions.action.addToWorkspaceIgnoredRecommendations', "Add Extension to Workspace Ignored Recommendations"),
            category: EXTENSIONS_CATEGORY,
            menu: {
                id: MenuId.CommandPalette,
                when: ContextKeyExpr.and(WorkbenchStateContext.isEqualTo('workspace'), ContextKeyExpr.equals('resourceScheme', Schemas.extension)),
            },
            async run(accessor) {
                const editorService = accessor.get(IEditorService);
                const workspaceExtensionsConfigService = accessor.get(IWorkspaceExtensionsConfigService);
                if (!(editorService.activeEditor instanceof ExtensionsInput)) {
                    return;
                }
                const extensionId = editorService.activeEditor.extension.identifier.id.toLowerCase();
                const unwantedRecommendations = await workspaceExtensionsConfigService.getUnwantedRecommendations();
                if (unwantedRecommendations.includes(extensionId)) {
                    return;
                }
                await workspaceExtensionsConfigService.toggleUnwantedRecommendation(extensionId);
            }
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.addToWorkspaceFolderIgnoredRecommendations',
            title: localize2('workbench.extensions.action.addToWorkspaceFolderIgnoredRecommendations', "Add Extension to Workspace Folder Ignored Recommendations"),
            category: EXTENSIONS_CATEGORY,
            menu: {
                id: MenuId.CommandPalette,
                when: ContextKeyExpr.and(WorkbenchStateContext.isEqualTo('folder'), ContextKeyExpr.equals('resourceScheme', Schemas.extension)),
            },
            run: () => this.commandService.executeCommand('workbench.extensions.action.addToWorkspaceIgnoredRecommendations')
        });
        this.registerExtensionAction({
            id: ConfigureWorkspaceRecommendedExtensionsAction.ID,
            title: { value: ConfigureWorkspaceRecommendedExtensionsAction.LABEL, original: 'Configure Recommended Extensions (Workspace)' },
            category: EXTENSIONS_CATEGORY,
            menu: {
                id: MenuId.CommandPalette,
                when: WorkbenchStateContext.isEqualTo('workspace'),
            },
            run: () => runAction(this.instantiationService.createInstance(ConfigureWorkspaceRecommendedExtensionsAction, ConfigureWorkspaceRecommendedExtensionsAction.ID, ConfigureWorkspaceRecommendedExtensionsAction.LABEL))
        });
        this.registerExtensionAction({
            id: 'workbench.extensions.action.manageTrustedPublishers',
            title: localize2('workbench.extensions.action.manageTrustedPublishers', "Manage Trusted Extension Publishers"),
            category: EXTENSIONS_CATEGORY,
            f1: true,
            run: async (accessor) => {
                const quickInputService = accessor.get(IQuickInputService);
                const extensionManagementService = accessor.get(IWorkbenchExtensionManagementService);
                const trustedPublishers = extensionManagementService.getTrustedPublishers();
                const trustedPublisherItems = trustedPublishers.map(publisher => ({
                    id: publisher.publisher,
                    label: publisher.publisherDisplayName,
                    description: publisher.publisher,
                    picked: true,
                })).sort((a, b) => a.label.localeCompare(b.label));
                const result = await quickInputService.pick(trustedPublisherItems, {
                    canPickMany: true,
                    title: localize('trustedPublishers', "Manage Trusted Extension Publishers"),
                    placeHolder: localize('trustedPublishersPlaceholder', "Choose which publishers to trust"),
                });
                if (result) {
                    const untrustedPublishers = [];
                    for (const { publisher } of trustedPublishers) {
                        if (!result.some(r => r.id === publisher)) {
                            untrustedPublishers.push(publisher);
                        }
                    }
                    trustedPublishers.filter(publisher => !result.some(r => r.id === publisher.publisher));
                    extensionManagementService.untrustPublishers(...untrustedPublishers);
                }
            }
        });
    }
    registerExtensionAction(extensionActionOptions) {
        const menus = extensionActionOptions.menu ? Array.isArray(extensionActionOptions.menu) ? extensionActionOptions.menu : [extensionActionOptions.menu] : [];
        let menusWithOutTitles = [];
        const menusWithTitles = [];
        if (extensionActionOptions.menuTitles) {
            for (let index = 0; index < menus.length; index++) {
                const menu = menus[index];
                const menuTitle = extensionActionOptions.menuTitles[menu.id.id];
                if (menuTitle) {
                    menusWithTitles.push({ id: menu.id, item: { ...menu, command: { id: extensionActionOptions.id, title: menuTitle } } });
                }
                else {
                    menusWithOutTitles.push(menu);
                }
            }
        }
        else {
            menusWithOutTitles = menus;
        }
        const disposables = new DisposableStore();
        disposables.add(registerAction2(class extends Action2 {
            constructor() {
                super({
                    ...extensionActionOptions,
                    menu: menusWithOutTitles
                });
            }
            run(accessor, ...args) {
                return extensionActionOptions.run(accessor, ...args);
            }
        }));
        if (menusWithTitles.length) {
            disposables.add(MenuRegistry.appendMenuItems(menusWithTitles));
        }
        return disposables;
    }
};
ExtensionsContributions = __decorate([
    __param(0, IExtensionManagementService),
    __param(1, IExtensionManagementServerService),
    __param(2, IExtensionGalleryManifestService),
    __param(3, IContextKeyService),
    __param(4, IViewsService),
    __param(5, IExtensionsWorkbenchService),
    __param(6, IWorkbenchExtensionEnablementService),
    __param(7, IInstantiationService),
    __param(8, IDialogService),
    __param(9, ICommandService),
    __param(10, IProductService)
], ExtensionsContributions);
let ExtensionStorageCleaner = class ExtensionStorageCleaner {
    constructor(extensionManagementService, storageService) {
        ExtensionStorageService.removeOutdatedExtensionVersions(extensionManagementService, storageService);
    }
};
ExtensionStorageCleaner = __decorate([
    __param(0, IExtensionManagementService),
    __param(1, IStorageService)
], ExtensionStorageCleaner);
let TrustedPublishersInitializer = class TrustedPublishersInitializer {
    constructor(extensionManagementService, userDataProfilesService, productService, storageService) {
        const trustedPublishersInitStatusKey = 'trusted-publishers-init-migration';
        if (!storageService.get(trustedPublishersInitStatusKey, -1 /* StorageScope.APPLICATION */)) {
            for (const profile of userDataProfilesService.profiles) {
                extensionManagementService.getInstalled(1 /* ExtensionType.User */, profile.extensionsResource)
                    .then(async (extensions) => {
                    const trustedPublishers = new Map();
                    for (const extension of extensions) {
                        if (!extension.publisherDisplayName) {
                            continue;
                        }
                        const publisher = extension.manifest.publisher.toLowerCase();
                        if (productService.trustedExtensionPublishers?.includes(publisher)
                            || (extension.publisherDisplayName && productService.trustedExtensionPublishers?.includes(extension.publisherDisplayName.toLowerCase()))) {
                            continue;
                        }
                        trustedPublishers.set(publisher, { publisher, publisherDisplayName: extension.publisherDisplayName });
                    }
                    if (trustedPublishers.size) {
                        extensionManagementService.trustPublishers(...trustedPublishers.values());
                    }
                    storageService.store(trustedPublishersInitStatusKey, 'true', -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
                });
            }
        }
    }
};
TrustedPublishersInitializer = __decorate([
    __param(0, IWorkbenchExtensionManagementService),
    __param(1, IUserDataProfilesService),
    __param(2, IProductService),
    __param(3, IStorageService)
], TrustedPublishersInitializer);
let ExtensionToolsContribution = class ExtensionToolsContribution extends Disposable {
    static { this.ID = 'extensions.chat.toolsContribution'; }
    constructor(toolsService, instantiationService) {
        super();
        const searchExtensionsTool = instantiationService.createInstance(SearchExtensionsTool);
        this._register(toolsService.registerTool(SearchExtensionsToolData, searchExtensionsTool));
        this._register(toolsService.vscodeToolSet.addTool(SearchExtensionsToolData));
    }
};
ExtensionToolsContribution = __decorate([
    __param(0, ILanguageModelToolsService),
    __param(1, IInstantiationService)
], ExtensionToolsContribution);
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(ExtensionsContributions, 3 /* LifecyclePhase.Restored */);
workbenchRegistry.registerWorkbenchContribution(StatusUpdater, 4 /* LifecyclePhase.Eventually */);
workbenchRegistry.registerWorkbenchContribution(MaliciousExtensionChecker, 4 /* LifecyclePhase.Eventually */);
workbenchRegistry.registerWorkbenchContribution(KeymapExtensions, 3 /* LifecyclePhase.Restored */);
workbenchRegistry.registerWorkbenchContribution(ExtensionsViewletViewsContribution, 3 /* LifecyclePhase.Restored */);
workbenchRegistry.registerWorkbenchContribution(ExtensionActivationProgress, 4 /* LifecyclePhase.Eventually */);
workbenchRegistry.registerWorkbenchContribution(ExtensionDependencyChecker, 4 /* LifecyclePhase.Eventually */);
workbenchRegistry.registerWorkbenchContribution(ExtensionEnablementWorkspaceTrustTransitionParticipant, 3 /* LifecyclePhase.Restored */);
workbenchRegistry.registerWorkbenchContribution(ExtensionsCompletionItemsProvider, 3 /* LifecyclePhase.Restored */);
workbenchRegistry.registerWorkbenchContribution(UnsupportedExtensionsMigrationContrib, 4 /* LifecyclePhase.Eventually */);
workbenchRegistry.registerWorkbenchContribution(TrustedPublishersInitializer, 4 /* LifecyclePhase.Eventually */);
workbenchRegistry.registerWorkbenchContribution(ExtensionMarketplaceStatusUpdater, 4 /* LifecyclePhase.Eventually */);
if (isWeb) {
    workbenchRegistry.registerWorkbenchContribution(ExtensionStorageCleaner, 4 /* LifecyclePhase.Eventually */);
}
registerWorkbenchContribution2(ExtensionToolsContribution.ID, ExtensionToolsContribution, 3 /* WorkbenchPhase.AfterRestored */);
// Running Extensions
registerAction2(ShowRuntimeExtensionsAction);
registerAction2(class ExtensionsGallerySignInAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.extensions.actions.gallery.signIn',
            title: localize2('signInToMarketplace', 'Sign in to access Extensions Marketplace'),
            menu: {
                id: MenuId.AccountsContext,
                when: CONTEXT_EXTENSIONS_GALLERY_STATUS.isEqualTo("requiresSignIn" /* ExtensionGalleryManifestStatus.RequiresSignIn */)
            },
        });
    }
    run(accessor) {
        return accessor.get(ICommandService).executeCommand(DEFAULT_ACCOUNT_SIGN_IN_COMMAND);
    }
});
Registry.as(ConfigurationMigrationExtensions.ConfigurationMigration)
    .registerConfigurationMigrations([{
        key: AutoUpdateConfigurationKey,
        migrateFn: (value, accessor) => {
            if (value === 'onlySelectedExtensions') {
                return { value: false };
            }
            return [];
        }
    }]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9ucy5jb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZXh0ZW5zaW9ucy9icm93c2VyL2V4dGVuc2lvbnMuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRTVFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUV6RCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM5RyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDbkUsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVwRSxPQUFPLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3pELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUMxRixPQUFPLEVBQUUsT0FBTyxFQUE4QixNQUFNLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQzVJLE9BQU8sRUFBRSxpQkFB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