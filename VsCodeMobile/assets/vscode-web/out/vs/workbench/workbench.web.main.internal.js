/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// #######################################################################
// ###                                                                 ###
// ### !!! PLEASE ADD COMMON IMPORTS INTO WORKBENCH.COMMON.MAIN.TS !!! ###
// ###                                                                 ###
// #######################################################################
//#region --- workbench common
import './workbench.common.main.js';
//#endregion
//#region --- workbench parts
import './browser/parts/dialogs/dialog.web.contribution.js';
//#endregion
//#region --- workbench (web main)
import './browser/web.main.js';
//#endregion
//#region --- workbench services
import './services/integrity/browser/integrityService.js';
import './services/search/browser/searchService.js';
import './services/textfile/browser/browserTextFileService.js';
import './services/keybinding/browser/keyboardLayoutService.js';
import './services/extensions/browser/extensionService.js';
import './services/extensionManagement/browser/extensionsProfileScannerService.js';
import './services/extensions/browser/extensionsScannerService.js';
import './services/extensionManagement/browser/webExtensionsScannerService.js';
import './services/extensionManagement/common/extensionManagementServerService.js';
import './services/mcp/browser/mcpGalleryManifestService.js';
import './services/mcp/browser/mcpWorkbenchManagementService.js';
import './services/extensionManagement/browser/extensionGalleryManifestService.js';
import './services/telemetry/browser/telemetryService.js';
import './services/url/browser/urlService.js';
import './services/update/browser/updateService.js';
import './services/workspaces/browser/workspacesService.js';
import './services/workspaces/browser/workspaceEditingService.js';
import './services/dialogs/browser/fileDialogService.js';
import './services/host/browser/browserHostService.js';
import './services/lifecycle/browser/lifecycleService.js';
import './services/clipboard/browser/clipboardService.js';
import './services/localization/browser/localeService.js';
import './services/path/browser/pathService.js';
import './services/themes/browser/browserHostColorSchemeService.js';
import './services/encryption/browser/encryptionService.js';
import './services/imageResize/browser/imageResizeService.js';
import './services/secrets/browser/secretStorageService.js';
import './services/workingCopy/browser/workingCopyBackupService.js';
import './services/tunnel/browser/tunnelService.js';
import './services/files/browser/elevatedFileService.js';
import './services/workingCopy/browser/workingCopyHistoryService.js';
import './services/userDataSync/browser/webUserDataSyncEnablementService.js';
import './services/userDataProfile/browser/userDataProfileStorageService.js';
import './services/configurationResolver/browser/configurationResolverService.js';
import '../platform/extensionResourceLoader/browser/extensionResourceLoaderService.js';
import './services/auxiliaryWindow/browser/auxiliaryWindowService.js';
import './services/browserElements/browser/webBrowserElementsService.js';
import { registerSingleton } from '../platform/instantiation/common/extensions.js';
import { IAccessibilityService } from '../platform/accessibility/common/accessibility.js';
import { IContextMenuService } from '../platform/contextview/browser/contextView.js';
import { ContextMenuService } from '../platform/contextview/browser/contextMenuService.js';
import { IExtensionTipsService } from '../platform/extensionManagement/common/extensionManagement.js';
import { ExtensionTipsService } from '../platform/extensionManagement/common/extensionTipsService.js';
import { IWorkbenchExtensionManagementService } from './services/extensionManagement/common/extensionManagement.js';
import { ExtensionManagementService } from './services/extensionManagement/common/extensionManagementService.js';
import { LogLevel } from '../platform/log/common/log.js';
import { UserDataSyncMachinesService, IUserDataSyncMachinesService } from '../platform/userDataSync/common/userDataSyncMachines.js';
import { IUserDataSyncStoreService, IUserDataSyncService, IUserDataAutoSyncService, IUserDataSyncLocalStoreService, IUserDataSyncResourceProviderService } from '../platform/userDataSync/common/userDataSync.js';
import { UserDataSyncStoreService } from '../platform/userDataSync/common/userDataSyncStoreService.js';
import { UserDataSyncLocalStoreService } from '../platform/userDataSync/common/userDataSyncLocalStoreService.js';
import { UserDataSyncService } from '../platform/userDataSync/common/userDataSyncService.js';
import { IUserDataSyncAccountService, UserDataSyncAccountService } from '../platform/userDataSync/common/userDataSyncAccount.js';
import { UserDataAutoSyncService } from '../platform/userDataSync/common/userDataAutoSyncService.js';
import { AccessibilityService } from '../platform/accessibility/browser/accessibilityService.js';
import { ICustomEndpointTelemetryService } from '../platform/telemetry/common/telemetry.js';
import { NullEndpointTelemetryService } from '../platform/telemetry/common/telemetryUtils.js';
import { ITitleService } from './services/title/browser/titleService.js';
import { BrowserTitleService } from './browser/parts/titlebar/titlebarPart.js';
import { ITimerService, TimerService } from './services/timer/browser/timerService.js';
import { IDiagnosticsService, NullDiagnosticsService } from '../platform/diagnostics/common/diagnostics.js';
import { ILanguagePackService } from '../platform/languagePacks/common/languagePacks.js';
import { WebLanguagePacksService } from '../platform/languagePacks/browser/languagePacks.js';
import { IWebContentExtractorService, NullWebContentExtractorService, ISharedWebContentExtractorService, NullSharedWebContentExtractorService } from '../platform/webContentExtractor/common/webContentExtractor.js';
registerSingleton(IWorkbenchExtensionManagementService, ExtensionManagementService, 1 /* InstantiationType.Delayed */);
registerSingleton(IAccessibilityService, AccessibilityService, 1 /* InstantiationType.Delayed */);
registerSingleton(IContextMenuService, ContextMenuService, 1 /* InstantiationType.Delayed */);
registerSingleton(IUserDataSyncStoreService, UserDataSyncStoreService, 1 /* InstantiationType.Delayed */);
registerSingleton(IUserDataSyncMachinesService, UserDataSyncMachinesService, 1 /* InstantiationType.Delayed */);
registerSingleton(IUserDataSyncLocalStoreService, UserDataSyncLocalStoreService, 1 /* InstantiationType.Delayed */);
registerSingleton(IUserDataSyncAccountService, UserDataSyncAccountService, 1 /* InstantiationType.Delayed */);
registerSingleton(IUserDataSyncService, UserDataSyncService, 1 /* InstantiationType.Delayed */);
registerSingleton(IUserDataSyncResourceProviderService, UserDataSyncResourceProviderService, 1 /* InstantiationType.Delayed */);
registerSingleton(IUserDataAutoSyncService, UserDataAutoSyncService, 0 /* InstantiationType.Eager */);
registerSingleton(ITitleService, BrowserTitleService, 0 /* InstantiationType.Eager */);
registerSingleton(IExtensionTipsService, ExtensionTipsService, 1 /* InstantiationType.Delayed */);
registerSingleton(ITimerService, TimerService, 1 /* InstantiationType.Delayed */);
registerSingleton(ICustomEndpointTelemetryService, NullEndpointTelemetryService, 1 /* InstantiationType.Delayed */);
registerSingleton(IDiagnosticsService, NullDiagnosticsService, 1 /* InstantiationType.Delayed */);
registerSingleton(ILanguagePackService, WebLanguagePacksService, 1 /* InstantiationType.Delayed */);
registerSingleton(IWebContentExtractorService, NullWebContentExtractorService, 1 /* InstantiationType.Delayed */);
registerSingleton(ISharedWebContentExtractorService, NullSharedWebContentExtractorService, 1 /* InstantiationType.Delayed */);
//#endregion
//#region --- workbench contributions
// Logs
import './contrib/logs/browser/logs.contribution.js';
// Localization
import './contrib/localization/browser/localization.contribution.js';
// Performance
import './contrib/performance/browser/performance.web.contribution.js';
// Preferences
import './contrib/preferences/browser/keyboardLayoutPicker.js';
// Debug
import './contrib/debug/browser/extensionHostDebugService.js';
// Welcome Banner
import './contrib/welcomeBanner/browser/welcomeBanner.contribution.js';
// Webview
import './contrib/webview/browser/webview.web.contribution.js';
// Extensions Management
import './contrib/extensions/browser/extensions.web.contribution.js';
// Terminal
import './contrib/terminal/browser/terminal.web.contribution.js';
import './contrib/externalTerminal/browser/externalTerminal.contribution.js';
import './contrib/terminal/browser/terminalInstanceService.js';
// Tasks
import './contrib/tasks/browser/taskService.js';
// Tags
import './contrib/tags/browser/workspaceTagsService.js';
// Issues
import './contrib/issue/browser/issue.contribution.js';
// Splash
import './contrib/splash/browser/splash.contribution.js';
// Remote Start Entry for the Web
import './contrib/remote/browser/remoteStartEntry.contribution.js';
// Process Explorer
import './contrib/processExplorer/browser/processExplorer.web.contribution.js';
//#endregion
//#region --- export workbench factory
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
// Do NOT change these exports in a way that something is removed unless
// intentional. These exports are used by web embedders and thus require
// an adoption when something changes.
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
import { create, commands, env, window, workspace, logger } from './browser/web.factory.js';
import { Menu } from './browser/web.api.js';
import { URI } from '../base/common/uri.js';
import { Event, Emitter } from '../base/common/event.js';
import { Disposable } from '../base/common/lifecycle.js';
import { GroupOrientation } from './services/editor/common/editorGroupsService.js';
import { UserDataSyncResourceProviderService } from '../platform/userDataSync/common/userDataSyncResourceProvider.js';
import { RemoteAuthorityResolverError, RemoteAuthorityResolverErrorCode } from '../platform/remote/common/remoteAuthorityResolver.js';
// TODO@esm remove me once we stop supporting our web-esm-bridge
// eslint-disable-next-line local/code-no-any-casts
if (globalThis.__VSCODE_WEB_ESM_PROMISE) {
    const exports = {
        // Factory
        create: create,
        // Basic Types
        URI: URI,
        Event: Event,
        Emitter: Emitter,
        Disposable: Disposable,
        // GroupOrientation,
        LogLevel: LogLevel,
        RemoteAuthorityResolverError: RemoteAuthorityResolverError,
        RemoteAuthorityResolverErrorCode: RemoteAuthorityResolverErrorCode,
        // Facade API
        env: env,
        window: window,
        workspace: workspace,
        commands: commands,
        logger: logger,
        Menu: Menu
    };
    // eslint-disable-next-line local/code-no-any-casts
    globalThis.__VSCODE_WEB_ESM_PROMISE(exports);
    // eslint-disable-next-line local/code-no-any-casts
    delete globalThis.__VSCODE_WEB_ESM_PROMISE;
}
export { 
// Factory
create, 
// Basic Types
URI, Event, Emitter, Disposable, GroupOrientation, LogLevel, RemoteAuthorityResolverError, RemoteAuthorityResolverErrorCode, 
// Facade API
env, window, workspace, commands, logger, Menu };
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2JlbmNoLndlYi5tYWluLmludGVybmFsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC93b3JrYmVuY2gud2ViLm1haW4uaW50ZXJuYWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsMEVBQTBFO0FBQzFFLDBFQUEwRTtBQUMxRSwwRUFBMEU7QUFDMUUsMEVBQTBFO0FBQzFFLDBFQUEwRTtBQUcxRSw4QkFBOEI7QUFFOUIsT0FBTyw0QkFBNEIsQ0FBQztBQUVwQyxZQUFZO0FBR1osNkJBQTZCO0FBRTdCLE9BQU8sb0RBQW9ELENBQUM7QUFFNUQsWUFBWTtBQUdaLGtDQUFrQztBQUVsQyxPQUFPLHVCQUF1QixDQUFDO0FBRS9CLFlBQVk7QUFHWixnQ0FBZ0M7QUFFaEMsT0FBTyxrREFBa0QsQ0FBQztBQUMxRCxPQUFPLDRDQUE0QyxDQUFDO0FBQ3BELE9BQU8sdURBQXVELENBQUM7QUFDL0QsT0FBTyx3REFBd0QsQ0FBQztBQUNoRSxPQUFPLG1EQUFtRCxDQUFDO0FBQzNELE9BQU8sMkVBQTJFLENBQUM7QUFDbkYsT0FBTywyREFBMkQsQ0FBQztBQUNuRSxPQUFPLHVFQUF1RSxDQUFDO0FBQy9FLE9BQU8sMkVBQTJFLENBQUM7QUFDbkYsT0FBTyxxREFBcUQsQ0FBQztBQUM3RCxPQUFPLHlEQUF5RCxDQUFDO0FBQ2pFLE9BQU8sMkVBQTJFLENBQUM7QUFDbkYsT0FBTyxrREFBa0QsQ0FBQztBQUMxRCxPQUFPLHNDQUFzQyxDQUFDO0FBQzlDLE9BQU8sNENBQTRDLENBQUM7QUFDcEQsT0FBTyxvREFBb0QsQ0FBQztBQUM1RCxPQUFPLDBEQUEwRCxDQUFDO0FBQ2xFLE9BQU8saURBQWlELENBQUM7QUFDekQsT0FBTywrQ0FBK0MsQ0FBQztBQUN2RCxPQUFPLGtEQUFrRCxDQUFDO0FBQzFELE9BQU8sa0RBQWtELENBQUM7QUFDMUQs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