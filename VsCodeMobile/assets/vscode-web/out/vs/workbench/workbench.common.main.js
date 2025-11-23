/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
//#region --- editor/workbench core
import '../editor/editor.all.js';
import './api/browser/extensionHost.contribution.js';
import './browser/workbench.contribution.js';
//#endregion
//#region --- workbench actions
import './browser/actions/textInputActions.js';
import './browser/actions/developerActions.js';
import './browser/actions/helpActions.js';
import './browser/actions/layoutActions.js';
import './browser/actions/listCommands.js';
import './browser/actions/navigationActions.js';
import './browser/actions/windowActions.js';
import './browser/actions/workspaceActions.js';
import './browser/actions/workspaceCommands.js';
import './browser/actions/quickAccessActions.js';
import './browser/actions/widgetNavigationCommands.js';
//#endregion
//#region --- API Extension Points
import './services/actions/common/menusExtensionPoint.js';
import './api/common/configurationExtensionPoint.js';
import './api/browser/viewsExtensionPoint.js';
//#endregion
//#region --- workbench parts
import './browser/parts/editor/editor.contribution.js';
import './browser/parts/editor/editorParts.js';
import './browser/parts/paneCompositePartService.js';
import './browser/parts/banner/bannerPart.js';
import './browser/parts/statusbar/statusbarPart.js';
//#endregion
//#region --- workbench services
import '../platform/actions/common/actions.contribution.js';
import '../platform/undoRedo/common/undoRedoService.js';
import '../platform/mcp/common/mcpResourceScannerService.js';
import './services/workspaces/common/editSessionIdentityService.js';
import './services/workspaces/common/canonicalUriService.js';
import './services/extensions/browser/extensionUrlHandler.js';
import './services/keybinding/common/keybindingEditing.js';
import './services/decorations/browser/decorationsService.js';
import './services/dialogs/common/dialogService.js';
import './services/progress/browser/progressService.js';
import './services/editor/browser/codeEditorService.js';
import './services/preferences/browser/preferencesService.js';
import './services/configuration/common/jsonEditingService.js';
import './services/textmodelResolver/common/textModelResolverService.js';
import './services/editor/browser/editorService.js';
import './services/editor/browser/editorResolverService.js';
import './services/aiEmbeddingVector/common/aiEmbeddingVectorService.js';
import './services/aiRelatedInformation/common/aiRelatedInformationService.js';
import './services/aiSettingsSearch/common/aiSettingsSearchService.js';
import './services/history/browser/historyService.js';
import './services/activity/browser/activityService.js';
import './services/keybinding/browser/keybindingService.js';
import './services/untitled/common/untitledTextEditorService.js';
import './services/textresourceProperties/common/textResourcePropertiesService.js';
import './services/textfile/common/textEditorService.js';
import './services/language/common/languageService.js';
import './services/model/common/modelService.js';
import './services/notebook/common/notebookDocumentService.js';
import './services/commands/common/commandService.js';
import './services/themes/browser/workbenchThemeService.js';
import './services/label/common/labelService.js';
import './services/extensions/common/extensionManifestPropertiesService.js';
import './services/extensionManagement/common/extensionGalleryService.js';
import './services/extensionManagement/browser/extensionEnablementService.js';
import './services/extensionManagement/browser/builtinExtensionsScannerService.js';
import './services/extensionRecommendations/common/extensionIgnoredRecommendationsService.js';
import './services/extensionRecommendations/common/workspaceExtensionsConfig.js';
import './services/extensionManagement/common/extensionFeaturesManagemetService.js';
import './services/notification/common/notificationService.js';
import './services/userDataSync/common/userDataSyncUtil.js';
import './services/userDataProfile/browser/userDataProfileImportExportService.js';
import './services/userDataProfile/browser/userDataProfileManagement.js';
import './services/userDataProfile/common/remoteUserDataProfiles.js';
import './services/remote/common/remoteExplorerService.js';
import './services/remote/common/remoteExtensionsScanner.js';
import './services/terminal/common/embedderTerminalService.js';
import './services/workingCopy/common/workingCopyService.js';
import './services/workingCopy/common/workingCopyFileService.js';
import './services/workingCopy/common/workingCopyEditorService.js';
import './services/filesConfiguration/common/filesConfigurationService.js';
import './services/views/browser/viewDescriptorService.js';
import './services/views/browser/viewsService.js';
import './services/quickinput/browser/quickInputService.js';
import './services/userDataSync/browser/userDataSyncWorkbenchService.js';
import './services/authentication/browser/authenticationService.js';
import './services/authentication/browser/authenticationExtensionsService.js';
import './services/authentication/browser/authenticationUsageService.js';
import './services/authentication/browser/authenticationAccessService.js';
import './services/authentication/browser/authenticationMcpUsageService.js';
import './services/authentication/browser/authenticationMcpAccessService.js';
import './services/authentication/browser/authenticationMcpService.js';
import './services/authentication/browser/dynamicAuthenticationProviderStorageService.js';
import './services/authentication/browser/authenticationQueryService.js';
import '../platform/hover/browser/hoverService.js';
import './services/assignment/common/assignmentService.js';
import './services/outline/browser/outlineService.js';
import './services/languageDetection/browser/languageDetectionWorkerServiceImpl.js';
import '../editor/common/services/languageFeaturesService.js';
import '../editor/common/services/semanticTokensStylingService.js';
import '../editor/common/services/treeViewsDndService.js';
import './services/textMate/browser/textMateTokenizationFeature.contribution.js';
import './services/treeSitter/browser/treeSitter.contribution.js';
import './services/userActivity/common/userActivityService.js';
import './services/userActivity/browser/userActivityBrowser.js';
import './services/editor/browser/editorPaneService.js';
import './services/editor/common/customEditorLabelService.js';
import './services/dataChannel/browser/dataChannelService.js';
import './services/inlineCompletions/common/inlineCompletionsUnification.js';
import './services/chat/common/chatEntitlementService.js';
import { registerSingleton } from '../platform/instantiation/common/extensions.js';
import { GlobalExtensionEnablementService } from '../platform/extensionManagement/common/extensionEnablementService.js';
import { IAllowedExtensionsService, IGlobalExtensionEnablementService } from '../platform/extensionManagement/common/extensionManagement.js';
import { ContextViewService } from '../platform/contextview/browser/contextViewService.js';
import { IContextViewService } from '../platform/contextview/browser/contextView.js';
import { IListService, ListService } from '../platform/list/browser/listService.js';
import { MarkerDecorationsService } from '../editor/common/services/markerDecorationsService.js';
import { IMarkerDecorationsService } from '../editor/common/services/markerDecorations.js';
import { IMarkerService } from '../platform/markers/common/markers.js';
import { MarkerService } from '../platform/markers/common/markerService.js';
import { ContextKeyService } from '../platform/contextkey/browser/contextKeyService.js';
import { IContextKeyService } from '../platform/contextkey/common/contextkey.js';
import { ITextResourceConfigurationService } from '../editor/common/services/textResourceConfiguration.js';
import { TextResourceConfigurationService } from '../editor/common/services/textResourceConfigurationService.js';
import { IDownloadService } from '../platform/download/common/download.js';
import { DownloadService } from '../platform/download/common/downloadService.js';
import { OpenerService } from '../editor/browser/services/openerService.js';
import { IOpenerService } from '../platform/opener/common/opener.js';
import { IgnoredExtensionsManagementService, IIgnoredExtensionsManagementService } from '../platform/userDataSync/common/ignoredExtensions.js';
import { ExtensionStorageService, IExtensionStorageService } from '../platform/extensionManagement/common/extensionStorage.js';
import { IUserDataSyncLogService } from '../platform/userDataSync/common/userDataSync.js';
import { UserDataSyncLogService } from '../platform/userDataSync/common/userDataSyncLog.js';
import { AllowedExtensionsService } from '../platform/extensionManagement/common/allowedExtensionsService.js';
import { IAllowedMcpServersService, IMcpGalleryService } from '../platform/mcp/common/mcpManagement.js';
import { McpGalleryService } from '../platform/mcp/common/mcpGalleryService.js';
import { AllowedMcpServersService } from '../platform/mcp/common/allowedMcpServersService.js';
import { IWebWorkerService } from '../platform/webWorker/browser/webWorkerService.js';
import { WebWorkerService } from '../platform/webWorker/browser/webWorkerServiceImpl.js';
registerSingleton(IUserDataSyncLogService, UserDataSyncLogService, 1 /* InstantiationType.Delayed */);
registerSingleton(IAllowedExtensionsService, AllowedExtensionsService, 1 /* InstantiationType.Delayed */);
registerSingleton(IIgnoredExtensionsManagementService, IgnoredExtensionsManagementService, 1 /* InstantiationType.Delayed */);
registerSingleton(IGlobalExtensionEnablementService, GlobalExtensionEnablementService, 1 /* InstantiationType.Delayed */);
registerSingleton(IExtensionStorageService, ExtensionStorageService, 1 /* InstantiationType.Delayed */);
registerSingleton(IContextViewService, ContextViewService, 1 /* InstantiationType.Delayed */);
registerSingleton(IListService, ListService, 1 /* InstantiationType.Delayed */);
registerSingleton(IMarkerDecorationsService, MarkerDecorationsService, 1 /* InstantiationType.Delayed */);
registerSingleton(IMarkerService, MarkerService, 1 /* InstantiationType.Delayed */);
registerSingleton(IContextKeyService, ContextKeyService, 1 /* InstantiationType.Delayed */);
registerSingleton(ITextResourceConfigurationService, TextResourceConfigurationService, 1 /* InstantiationType.Delayed */);
registerSingleton(IDownloadService, DownloadService, 1 /* InstantiationType.Delayed */);
registerSingleton(IOpenerService, OpenerService, 1 /* InstantiationType.Delayed */);
registerSingleton(IWebWorkerService, WebWorkerService, 1 /* InstantiationType.Delayed */);
registerSingleton(IMcpGalleryService, McpGalleryService, 1 /* InstantiationType.Delayed */);
registerSingleton(IAllowedMcpServersService, AllowedMcpServersService, 1 /* InstantiationType.Delayed */);
//#endregion
//#region --- workbench contributions
// Default Account
import './services/accounts/common/defaultAccount.js';
// Telemetry
import './contrib/telemetry/browser/telemetry.contribution.js';
// Preferences
import './contrib/preferences/browser/preferences.contribution.js';
import './contrib/preferences/browser/keybindingsEditorContribution.js';
import './contrib/preferences/browser/preferencesSearch.js';
// Performance
import './contrib/performance/browser/performance.contribution.js';
// Notebook
import './contrib/notebook/browser/notebook.contribution.js';
// Speech
import './contrib/speech/browser/speech.contribution.js';
// Chat
import './contrib/chat/browser/chat.contribution.js';
import './contrib/inlineChat/browser/inlineChat.contribution.js';
import './contrib/mcp/browser/mcp.contribution.js';
import './contrib/chat/browser/chatSessions.contribution.js';
import './contrib/chat/browser/chatContext.contribution.js';
// Interactive
import './contrib/interactive/browser/interactive.contribution.js';
// repl
import './contrib/replNotebook/browser/repl.contribution.js';
// Testing
import './contrib/testing/browser/testing.contribution.js';
// Logs
import './contrib/logs/common/logs.contribution.js';
// Quickaccess
import './contrib/quickaccess/browser/quickAccess.contribution.js';
// Explorer
import './contrib/files/browser/explorerViewlet.js';
import './contrib/files/browser/fileActions.contribution.js';
import './contrib/files/browser/files.contribution.js';
// Bulk Edit
import './contrib/bulkEdit/browser/bulkEditService.js';
import './contrib/bulkEdit/browser/preview/bulkEdit.contribution.js';
// Search
import './contrib/search/browser/search.contribution.js';
import './contrib/search/browser/searchView.js';
// Search Editor
import './contrib/searchEditor/browser/searchEditor.contribution.js';
// Sash
import './contrib/sash/browser/sash.contribution.js';
// SCM
import './contrib/scm/browser/scm.contribution.js';
// Debug
import './contrib/debug/browser/debug.contribution.js';
import './contrib/debug/browser/debugEditorContribution.js';
import './contrib/debug/browser/breakpointEditorContribution.js';
import './contrib/debug/browser/callStackEditorContribution.js';
import './contrib/debug/browser/repl.js';
import './contrib/debug/browser/debugViewlet.js';
// Markers
import './contrib/markers/browser/markers.contribution.js';
// Process Explorer
import './contrib/processExplorer/browser/processExplorer.contribution.js';
// Merge Editor
import './contrib/mergeEditor/browser/mergeEditor.contribution.js';
// Multi Diff Editor
import './contrib/multiDiffEditor/browser/multiDiffEditor.contribution.js';
// Commands
import './contrib/commands/common/commands.contribution.js';
// Comments
import './contrib/comments/browser/comments.contribution.js';
// URL Support
import './contrib/url/browser/url.contribution.js';
// Webview
import './contrib/webview/browser/webview.contribution.js';
import './contrib/webviewPanel/browser/webviewPanel.contribution.js';
import './contrib/webviewView/browser/webviewView.contribution.js';
import './contrib/customEditor/browser/customEditor.contribution.js';
// External Uri Opener
import './contrib/externalUriOpener/common/externalUriOpener.contribution.js';
// Extensions Management
import './contrib/extensions/browser/extensions.contribution.js';
import './contrib/extensions/browser/extensionsViewlet.js';
// Output View
import './contrib/output/browser/output.contribution.js';
import './contrib/output/browser/outputView.js';
// Terminal
import './contrib/terminal/terminal.all.js';
// External terminal
import './contrib/externalTerminal/browser/externalTerminal.contribution.js';
// Relauncher
import './contrib/relauncher/browser/relauncher.contribution.js';
// Tasks
import './contrib/tasks/browser/task.contribution.js';
// Remote
import './contrib/remote/common/remote.contribution.js';
import './contrib/remote/browser/remote.contribution.js';
// Emmet
import './contrib/emmet/browser/emmet.contribution.js';
// CodeEditor Contributions
import './contrib/codeEditor/browser/codeEditor.contribution.js';
// Markdown
import './contrib/markdown/browser/markdown.contribution.js';
// Keybindings Contributions
import './contrib/keybindings/browser/keybindings.contribution.js';
// Snippets
import './contrib/snippets/browser/snippets.contribution.js';
// Formatter Help
import './contrib/format/browser/format.contribution.js';
// Folding
import './contrib/folding/browser/folding.contribution.js';
// Limit Indicator
import './contrib/limitIndicator/browser/limitIndicator.contribution.js';
// Inlay Hint Accessibility
import './contrib/inlayHints/browser/inlayHintsAccessibilty.js';
// Themes
import './contrib/themes/browser/themes.contribution.js';
// Update
import './contrib/update/browser/update.contribution.js';
// Surveys
import './contrib/surveys/browser/nps.contribution.js';
import './contrib/surveys/browser/languageSurveys.contribution.js';
// Welcome
import './contrib/welcomeGettingStarted/browser/gettingStarted.contribution.js';
import './contrib/welcomeWalkthrough/browser/walkThrough.contribution.js';
import './contrib/welcomeViews/common/viewsWelcome.contribution.js';
import './contrib/welcomeViews/common/newFile.contribution.js';
// Call Hierarchy
import './contrib/callHierarchy/browser/callHierarchy.contribution.js';
// Type Hierarchy
import './contrib/typeHierarchy/browser/typeHierarchy.contribution.js';
// Outline
import './contrib/codeEditor/browser/outline/documentSymbolsOutline.js';
import './contrib/outline/browser/outline.contribution.js';
// Language Detection
import './contrib/languageDetection/browser/languageDetection.contribution.js';
// Language Status
import './contrib/languageStatus/browser/languageStatus.contribution.js';
// Authentication
import './contrib/authentication/browser/authentication.contribution.js';
// User Data Sync
import './contrib/userDataSync/browser/userDataSync.contribution.js';
// User Data Profiles
import './contrib/userDataProfile/browser/userDataProfile.contribution.js';
// Continue Edit Session
import './contrib/editSessions/browser/editSessions.contribution.js';
// Remote Coding Agents
import './contrib/remoteCodingAgents/browser/remoteCodingAgents.contribution.js';
// Code Actions
import './contrib/codeActions/browser/codeActions.contribution.js';
// Timeline
import './contrib/timeline/browser/timeline.contribution.js';
// Local History
import './contrib/localHistory/browser/localHistory.contribution.js';
// Workspace
import './contrib/workspace/browser/workspace.contribution.js';
// Workspaces
import './contrib/workspaces/browser/workspaces.contribution.js';
// List
import './contrib/list/browser/list.contribution.js';
// Accessibility Signals
import './contrib/accessibilitySignals/browser/accessibilitySignal.contribution.js';
// Bracket Pair Colorizer 2 Telemetry
import './contrib/bracketPairColorizer2Telemetry/browser/bracketPairColorizer2Telemetry.contribution.js';
// Accessibility
import './contrib/accessibility/browser/accessibility.contribution.js';
// Share
import './contrib/share/browser/share.contribution.js';
// Synchronized Scrolling
import './contrib/scrollLocking/browser/scrollLocking.contribution.js';
// Inline Completions
import './contrib/inlineCompletions/browser/inlineCompletions.contribution.js';
// Drop or paste into
import './contrib/dropOrPasteInto/browser/dropOrPasteInto.contribution.js';
// Edit Telemetry
import './contrib/editTelemetry/browser/editTelemetry.contribution.js';
// Opener
import './contrib/opener/browser/opener.contribution.js';
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2JlbmNoLmNvbW1vbi5tYWluLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC93b3JrYmVuY2guY29tbW9uLm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsbUNBQW1DO0FBRW5DLE9BQU8seUJBQXlCLENBQUM7QUFFakMsT0FBTyw2Q0FBNkMsQ0FBQztBQUNyRCxPQUFPLHFDQUFxQyxDQUFDO0FBRTdDLFlBQVk7QUFHWiwrQkFBK0I7QUFFL0IsT0FBTyx1Q0FBdUMsQ0FBQztBQUMvQyxPQUFPLHVDQUF1QyxDQUFDO0FBQy9DLE9BQU8sa0NBQWtDLENBQUM7QUFDMUMsT0FBTyxvQ0FBb0MsQ0FBQztBQUM1QyxPQUFPLG1DQUFtQyxDQUFDO0FBQzNDLE9BQU8sd0NBQXdDLENBQUM7QUFDaEQsT0FBTyxvQ0FBb0MsQ0FBQztBQUM1QyxPQUFPLHVDQUF1QyxDQUFDO0FBQy9DLE9BQU8sd0NBQXdDLENBQUM7QUFDaEQsT0FBTyx5Q0FBeUMsQ0FBQztBQUNqRCxPQUFPLCtDQUErQyxDQUFDO0FBRXZELFlBQVk7QUFHWixrQ0FBa0M7QUFFbEMsT0FBTyxrREFBa0QsQ0FBQztBQUMxRCxPQUFPLDZDQUE2QyxDQUFDO0FBQ3JELE9BQU8sc0NBQXNDLENBQUM7QUFFOUMsWUFBWTtBQUdaLDZCQUE2QjtBQUU3QixPQUFPLCtDQUErQyxDQUFDO0FBQ3ZELE9BQU8sdUNBQXVDLENBQUM7QUFDL0MsT0FBTyw2Q0FBNkMsQ0FBQztBQUNyRCxPQUFPLHNDQUFzQyxDQUFDO0FBQzlDLE9BQU8sNENBQTRDLENBQUM7QUFFcEQsWUFBWTtBQUdaLGdDQUFnQztBQUVoQyxPQUFPLG9EQUFvRCxDQUFDO0FBQzVELE9BQU8sZ0RBQWdELENBQUM7QUFDeEQsT0FBTyxxREFBcUQsQ0FBQztBQUM3RCxPQUFPLDREQUE0RCxDQUFDO0FBQ3BFLE9BQU8scURB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