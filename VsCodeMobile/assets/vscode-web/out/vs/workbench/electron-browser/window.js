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
var NativeWindow_1;
import './media/window.css';
import { localize } from '../../nls.js';
import { URI } from '../../base/common/uri.js';
import { equals } from '../../base/common/objects.js';
import { EventType, EventHelper, addDisposableListener, ModifierKeyEmitter, getActiveElement, hasWindow, getWindowById, getWindows, $ } from '../../base/browser/dom.js';
import { Action, Separator } from '../../base/common/actions.js';
import { IFileService } from '../../platform/files/common/files.js';
import { EditorResourceAccessor, SideBySideEditor, pathsToEditors, isResourceEditorInput } from '../common/editor.js';
import { IEditorService } from '../services/editor/common/editorService.js';
import { ITelemetryService } from '../../platform/telemetry/common/telemetry.js';
import { WindowMinimumSize, hasNativeTitlebar } from '../../platform/window/common/window.js';
import { ITitleService } from '../services/title/browser/titleService.js';
import { IWorkbenchThemeService } from '../services/themes/common/workbenchThemeService.js';
import { ApplyZoomTarget, applyZoom } from '../../platform/window/electron-browser/window.js';
import { setFullscreen, getZoomLevel, onDidChangeZoomLevel, getZoomFactor } from '../../base/browser/browser.js';
import { ICommandService, CommandsRegistry } from '../../platform/commands/common/commands.js';
import { ipcRenderer, process } from '../../base/parts/sandbox/electron-browser/globals.js';
import { IWorkspaceEditingService } from '../services/workspaces/common/workspaceEditing.js';
import { IMenuService, MenuId, MenuItemAction, MenuRegistry } from '../../platform/actions/common/actions.js';
import { getFlatActionBarActions } from '../../platform/actions/browser/menuEntryActionViewItem.js';
import { RunOnceScheduler } from '../../base/common/async.js';
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from '../../base/common/lifecycle.js';
import { ILifecycleService } from '../services/lifecycle/common/lifecycle.js';
import { IIntegrityService } from '../services/integrity/common/integrity.js';
import { isWindows, isMacintosh } from '../../base/common/platform.js';
import { IProductService } from '../../platform/product/common/productService.js';
import { INotificationService, NeverShowAgainScope, NotificationPriority, Severity } from '../../platform/notification/common/notification.js';
import { IKeybindingService } from '../../platform/keybinding/common/keybinding.js';
import { INativeWorkbenchEnvironmentService } from '../services/environment/electron-browser/environmentService.js';
import { IAccessibilityService } from '../../platform/accessibility/common/accessibility.js';
import { IWorkspaceContextService } from '../../platform/workspace/common/workspace.js';
import { coalesce } from '../../base/common/arrays.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IStorageService } from '../../platform/storage/common/storage.js';
import { IOpenerService } from '../../platform/opener/common/opener.js';
import { Schemas } from '../../base/common/network.js';
import { INativeHostService } from '../../platform/native/common/native.js';
import { posix } from '../../base/common/path.js';
import { ITunnelService, extractLocalHostUriMetaDataForPortMapping, extractQueryLocalHostUriMetaDataForPortMapping } from '../../platform/tunnel/common/tunnel.js';
import { IWorkbenchLayoutService, positionFromString } from '../services/layout/browser/layoutService.js';
import { IWorkingCopyService } from '../services/workingCopy/common/workingCopyService.js';
import { IFilesConfigurationService } from '../services/filesConfiguration/common/filesConfigurationService.js';
import { Event } from '../../base/common/event.js';
import { IRemoteAuthorityResolverService } from '../../platform/remote/common/remoteAuthorityResolver.js';
import { IEditorGroupsService } from '../services/editor/common/editorGroupsService.js';
import { IDialogService } from '../../platform/dialogs/common/dialogs.js';
import { ILogService } from '../../platform/log/common/log.js';
import { IInstantiationService } from '../../platform/instantiation/common/instantiation.js';
import { whenEditorClosed } from '../browser/editor.js';
import { ISharedProcessService } from '../../platform/ipc/electron-browser/services.js';
import { IProgressService } from '../../platform/progress/common/progress.js';
import { toErrorMessage } from '../../base/common/errorMessage.js';
import { ILabelService } from '../../platform/label/common/label.js';
import { dirname } from '../../base/common/resources.js';
import { IBannerService } from '../services/banner/browser/bannerService.js';
import { Codicon } from '../../base/common/codicons.js';
import { IUriIdentityService } from '../../platform/uriIdentity/common/uriIdentity.js';
import { IPreferencesService } from '../services/preferences/common/preferences.js';
import { IUtilityProcessWorkerWorkbenchService } from '../services/utilityProcess/electron-browser/utilityProcessWorkerWorkbenchService.js';
import { registerWindowDriver } from '../services/driver/browser/driver.js';
import { mainWindow } from '../../base/browser/window.js';
import { BaseWindow } from '../browser/window.js';
import { IHostService } from '../services/host/browser/host.js';
import { IStatusbarService, ShowTooltipCommand } from '../services/statusbar/browser/statusbar.js';
import { ActionBar } from '../../base/browser/ui/actionbar/actionbar.js';
import { ThemeIcon } from '../../base/common/themables.js';
import { getWorkbenchContribution } from '../common/contributions.js';
import { DynamicWorkbenchSecurityConfiguration } from '../common/configuration.js';
import { nativeHoverDelegate } from '../../platform/hover/browser/hover.js';
import { WINDOW_ACTIVE_BORDER, WINDOW_INACTIVE_BORDER } from '../common/theme.js';
import { IContextMenuService } from '../../platform/contextview/browser/contextView.js';
let NativeWindow = NativeWindow_1 = class NativeWindow extends BaseWindow {
    constructor(editorService, editorGroupService, configurationService, titleService, themeService, notificationService, commandService, keybindingService, telemetryService, workspaceEditingService, fileService, menuService, lifecycleService, integrityService, nativeEnvironmentService, accessibilityService, contextService, openerService, nativeHostService, tunnelService, layoutService, workingCopyService, filesConfigurationService, productService, remoteAuthorityResolverService, dialogService, storageService, logService, instantiationService, sharedProcessService, progressService, labelService, bannerService, uriIdentityService, preferencesService, utilityProcessWorkerWorkbenchService, hostService, contextMenuService) {
        super(mainWindow, undefined, hostService, nativeEnvironmentService, contextMenuService, layoutService);
        this.editorService = editorService;
        this.editorGroupService = editorGroupService;
        this.configurationService = configurationService;
        this.titleService = titleService;
        this.themeService = themeService;
        this.notificationService = notificationService;
        this.commandService = commandService;
        this.keybindingService = keybindingService;
        this.telemetryService = telemetryService;
        this.workspaceEditingService = workspaceEditingService;
        this.fileService = fileService;
        this.menuService = menuService;
        this.lifecycleService = lifecycleService;
        this.integrityService = integrityService;
        this.nativeEnvironmentService = nativeEnvironmentService;
        this.accessibilityService = accessibilityService;
        this.contextService = contextService;
        this.openerService = openerService;
        this.nativeHostService = nativeHostService;
        this.tunnelService = tunnelService;
        this.workingCopyService = workingCopyService;
        this.filesConfigurationService = filesConfigurationService;
        this.productService = productService;
        this.remoteAuthorityResolverService = remoteAuthorityResolverService;
        this.dialogService = dialogService;
        this.storageService = storageService;
        this.logService = logService;
        this.instantiationService = instantiationService;
        this.sharedProcessService = sharedProcessService;
        this.progressService = progressService;
        this.labelService = labelService;
        this.bannerService = bannerService;
        this.uriIdentityService = uriIdentityService;
        this.preferencesService = preferencesService;
        this.utilityProcessWorkerWorkbenchService = utilityProcessWorkerWorkbenchService;
        this.customTitleContextMenuDisposable = this._register(new DisposableStore());
        this.addRemoveFoldersScheduler = this._register(new RunOnceScheduler(() => this.doAddRemoveFolders(), 100));
        this.pendingFoldersToAdd = [];
        this.pendingFoldersToRemove = [];
        this.isDocumentedEdited = false;
        this.touchBarDisposables = this._register(new DisposableStore());
        //#region Window Zoom
        this.mapWindowIdToZoomStatusEntry = new Map();
        this.configuredWindowZoomLevel = this.resolveConfiguredWindowZoomLevel();
        this.registerListeners();
        this.create();
    }
    registerListeners() {
        // Layout
        this._register(addDisposableListener(mainWindow, EventType.RESIZE, () => this.layoutService.layout()));
        // React to editor input changes
        this._register(this.editorService.onDidActiveEditorChange(() => this.updateTouchbarMenu()));
        // Prevent opening a real URL inside the window
        for (const event of [EventType.DRAG_OVER, EventType.DROP]) {
            this._register(addDisposableListener(mainWindow.document.body, event, (e) => {
                EventHelper.stop(e);
            }));
        }
        // Support `runAction` event
        ipcRenderer.on('vscode:runAction', async (event, ...argsRaw) => {
            const request = argsRaw[0];
            const args = request.args || [];
            // If we run an action from the touchbar, we fill in the currently active resource
            // as payload because the touch bar items are context aware depending on the editor
            if (request.from === 'touchbar') {
                const activeEditor = this.editorService.activeEditor;
                if (activeEditor) {
                    const resource = EditorResourceAccessor.getOriginalUri(activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
                    if (resource) {
                        args.push(resource);
                    }
                }
            }
            else {
                args.push({ from: request.from });
            }
            try {
                await this.commandService.executeCommand(request.id, ...args);
                this.telemetryService.publicLog2('workbenchActionExecuted', { id: request.id, from: request.from });
            }
            catch (error) {
                this.notificationService.error(error);
            }
        });
        // Support runKeybinding event
        ipcRenderer.on('vscode:runKeybinding', (event, ...argsRaw) => {
            const request = argsRaw[0];
            const activeElement = getActiveElement();
            if (activeElement) {
                this.keybindingService.dispatchByUserSettingsLabel(request.userSettingsLabel, activeElement);
            }
        });
        // Shared Process crash reported from main
        ipcRenderer.on('vscode:reportSharedProcessCrash', (event, ...argsRaw) => {
            this.notificationService.prompt(Severity.Error, localize('sharedProcessCrash', "A shared background process terminated unexpectedly. Please restart the application to recover."), [{
                    label: localize('restart', "Restart"),
                    run: () => this.nativeHostService.relaunch()
                }], {
                priority: NotificationPriority.URGENT
            });
        });
        // Support openFiles event for existing and new files
        ipcRenderer.on('vscode:openFiles', (event, ...argsRaw) => { this.onOpenFiles(argsRaw[0]); });
        // Support addRemoveFolders event for workspace management
        ipcRenderer.on('vscode:addRemoveFolders', (event, ...argsRaw) => this.onAddRemoveFoldersRequest(argsRaw[0]));
        // Message support
        ipcRenderer.on('vscode:showInfoMessage', (event, ...argsRaw) => this.notificationService.info(argsRaw[0]));
        // Shell Environment Issue Notifications
        ipcRenderer.on('vscode:showResolveShellEnvError', (event, ...argsRaw) => {
            const message = argsRaw[0];
            this.notificationService.prompt(Severity.Error, message, [{
                    label: localize('restart', "Restart"),
                    run: () => this.nativeHostService.relaunch()
                },
                {
                    label: localize('configure', "Configure"),
                    run: () => this.preferencesService.openUserSettings({ query: 'application.shellEnvironmentResolutionTimeout' })
                },
                {
                    label: localize('learnMore', "Learn More"),
                    run: () => this.openerService.open('https://go.microsoft.com/fwlink/?linkid=2149667')
                }]);
        });
        ipcRenderer.on('vscode:showCredentialsError', (event, ...argsRaw) => {
            const message = argsRaw[0];
            this.notificationService.prompt(Severity.Error, localize('keychainWriteError', "Writing login information to the keychain failed with error '{0}'.", message), [{
                    label: localize('troubleshooting', "Troubleshooting Guide"),
                    run: () => this.openerService.open('https://go.microsoft.com/fwlink/?linkid=2190713')
                }]);
        });
        ipcRenderer.on('vscode:showTranslatedBuildWarning', () => {
            this.notificationService.prompt(Severity.Warning, localize("runningTranslated", "You are running an emulated version of {0}. For better performance download the native arm64 version of {0} build for your machine.", this.productService.nameLong), [{
                    label: localize('downloadArmBuild', "Download"),
                    run: () => {
                        const quality = this.productService.quality;
                        const stableURL = 'https://code.visualstudio.com/docs/?dv=osx';
                        const insidersURL = 'https://code.visualstudio.com/docs/?dv=osx&build=insiders';
                        this.openerService.open(quality === 'stable' ? stableURL : insidersURL);
                    }
                }], {
                priority: NotificationPriority.URGENT
            });
        });
        ipcRenderer.on('vscode:showArgvParseWarning', () => {
            this.notificationService.prompt(Severity.Warning, localize("showArgvParseWarning", "The runtime arguments file 'argv.json' contains errors. Please correct them and restart."), [{
                    label: localize('showArgvParseWarningAction', "Open File"),
                    run: () => this.editorService.openEditor({ resource: this.nativeEnvironmentService.argvResource })
                }], {
                priority: NotificationPriority.URGENT
            });
        });
        // Fullscreen Events
        ipcRenderer.on('vscode:enterFullScreen', () => setFullscreen(true, mainWindow));
        ipcRenderer.on('vscode:leaveFullScreen', () => setFullscreen(false, mainWindow));
        // Proxy Login Dialog
        ipcRenderer.on('vscode:openProxyAuthenticationDialog', async (event, ...argsRaw) => {
            const payload = argsRaw[0];
            const rememberCredentialsKey = 'window.rememberProxyCredentials';
            const rememberCredentials = this.storageService.getBoolean(rememberCredentialsKey, -1 /* StorageScope.APPLICATION */);
            const result = await this.dialogService.input({
                type: 'warning',
                message: localize('proxyAuthRequired', "Proxy Authentication Required"),
                primaryButton: localize({ key: 'loginButton', comment: ['&& denotes a mnemonic'] }, "&&Log In"),
                inputs: [
                    { placeholder: localize('username', "Username"), value: payload.username },
                    { placeholder: localize('password', "Password"), type: 'password', value: payload.password }
                ],
                detail: localize('proxyDetail', "The proxy {0} requires a username and password.", `${payload.authInfo.host}:${payload.authInfo.port}`),
                checkbox: {
                    label: localize('rememberCredentials', "Remember my credentials"),
                    checked: rememberCredentials
                }
            });
            // Reply back to the channel without result to indicate
            // that the login dialog was cancelled
            if (!result.confirmed || !result.values) {
                ipcRenderer.send(payload.replyChannel);
            }
            // Other reply back with the picked credentials
            else {
                // Update state based on checkbox
                if (result.checkboxChecked) {
                    this.storageService.store(rememberCredentialsKey, true, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
                }
                else {
                    this.storageService.remove(rememberCredentialsKey, -1 /* StorageScope.APPLICATION */);
                }
                // Reply back to main side with credentials
                const [username, password] = result.values;
                ipcRenderer.send(payload.replyChannel, { username, password, remember: !!result.checkboxChecked });
            }
        });
        // Accessibility support changed event
        ipcRenderer.on('vscode:accessibilitySupportChanged', (event, ...argsRaw) => {
            const accessibilitySupportEnabled = argsRaw[0];
            this.accessibilityService.setAccessibilitySupport(accessibilitySupportEnabled ? 2 /* AccessibilitySupport.Enabled */ : 1 /* AccessibilitySupport.Disabled */);
        });
        // Allow to update security settings around allowed UNC Host
        ipcRenderer.on('vscode:configureAllowedUNCHost', async (event, ...argsRaw) => {
            const host = argsRaw[0];
            if (!isWindows) {
                return; // only supported on Windows
            }
            const allowedUncHosts = new Set();
            const configuredAllowedUncHosts = this.configurationService.getValue('security.allowedUNCHosts') ?? [];
            if (Array.isArray(configuredAllowedUncHosts)) {
                for (const configuredAllowedUncHost of configuredAllowedUncHosts) {
                    if (typeof configuredAllowedUncHost === 'string') {
                        allowedUncHosts.add(configuredAllowedUncHost);
                    }
                }
            }
            if (!allowedUncHosts.has(host)) {
                allowedUncHosts.add(host);
                await getWorkbenchContribution(DynamicWorkbenchSecurityConfiguration.ID).ready; // ensure this setting is registered
                this.configurationService.updateValue('security.allowedUNCHosts', [...allowedUncHosts.values()], 2 /* ConfigurationTarget.USER */);
            }
        });
        // Allow to update security settings around protocol handlers
        ipcRenderer.on('vscode:disablePromptForProtocolHandling', (event, ...argsRaw) => {
            const kind = argsRaw[0];
            const setting = kind === 'local' ? 'security.promptForLocalFileProtocolHandling' : 'security.promptForRemoteFileProtocolHandling';
            this.configurationService.updateValue(setting, false);
        });
        // Window Settings
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('window.zoomLevel') || (e.affectsConfiguration('window.zoomPerWindow') && this.configurationService.getValue('window.zoomPerWindow') === false)) {
                this.onDidChangeConfiguredWindowZoomLevel();
            }
            else if (e.affectsConfiguration('keyboard.touchbar.enabled') || e.affectsConfiguration('keyboard.touchbar.ignored')) {
                this.updateTouchbarMenu();
            }
            else if (e.affectsConfiguration('window.border')) {
                this.updateWindowBorder();
            }
        }));
        this._register(onDidChangeZoomLevel(targetWindowId => this.handleOnDidChangeZoomLevel(targetWindowId)));
        for (const part of this.editorGroupService.parts) {
            this.createWindowZoomStatusEntry(part);
        }
        this._register(this.editorGroupService.onDidCreateAuxiliaryEditorPart(part => this.createWindowZoomStatusEntry(part)));
        // Listen to visible editor changes (debounced in case a new editor opens immediately after)
        this._register(Event.debounce(this.editorService.onDidVisibleEditorsChange, () => undefined, 0, undefined, undefined, undefined, this._store)(() => this.maybeCloseWindow()));
        // Listen to editor closing (if we run with --wait)
        const filesToWait = this.nativeEnvironmentService.filesToWait;
        if (filesToWait) {
            this.trackClosedWaitFiles(filesToWait.waitMarkerFileUri, coalesce(filesToWait.paths.map(path => path.fileUri)));
        }
        // macOS OS integration: represented file name
        if (isMacintosh) {
            for (const part of this.editorGroupService.parts) {
                this.handleRepresentedFilename(part);
            }
            this._register(this.editorGroupService.onDidCreateAuxiliaryEditorPart(part => this.handleRepresentedFilename(part)));
        }
        // Document edited: indicate for dirty working copies
        this._register(this.workingCopyService.onDidChangeDirty(workingCopy => {
            const gotDirty = workingCopy.isDirty();
            if (gotDirty && !(workingCopy.capabilities & 2 /* WorkingCopyCapabilities.Untitled */) && this.filesConfigurationService.hasShortAutoSaveDelay(workingCopy.resource)) {
                return; // do not indicate dirty of working copies that are auto saved after short delay
            }
            this.updateDocumentEdited(gotDirty ? true : undefined);
        }));
        this.updateDocumentEdited(undefined);
        // Detect minimize / maximize
        this._register(Event.any(Event.map(Event.filter(this.nativeHostService.onDidMaximizeWindow, windowId => !!hasWindow(windowId)), windowId => ({ maximized: true, windowId })), Event.map(Event.filter(this.nativeHostService.onDidUnmaximizeWindow, windowId => !!hasWindow(windowId)), windowId => ({ maximized: false, windowId })))(e => this.layoutService.updateWindowMaximizedState(getWindowById(e.windowId).window, e.maximized)));
        this.layoutService.updateWindowMaximizedState(mainWindow, this.nativeEnvironmentService.window.maximized ?? false);
        // Detect panel position to determine minimum width
        this._register(this.layoutService.onDidChangePanelPosition(pos => this.onDidChangePanelPosition(positionFromString(pos))));
        this.onDidChangePanelPosition(this.layoutService.getPanelPosition());
        // Border
        this._register(this.themeService.onDidColorThemeChange(() => this.updateWindowBorder()));
        this._register(this.hostService.onDidChangeActiveWindow(() => this.updateWindowBorder()));
        this._register(this.hostService.onDidChangeFocus(() => this.updateWindowBorder()));
        // Lifecycle
        this._register(this.lifecycleService.onBeforeShutdown(e => this.onBeforeShutdown(e)));
        this._register(this.lifecycleService.onBeforeShutdownError(e => this.onBeforeShutdownError(e)));
        this._register(this.lifecycleService.onWillShutdown(e => this.onWillShutdown(e)));
    }
    handleRepresentedFilename(part) {
        const disposables = new DisposableStore();
        Event.once(part.onWillDispose)(() => disposables.dispose());
        this.editorGroupService.getScopedInstantiationService(part).invokeFunction(accessor => {
            const editorService = accessor.get(IEditorService);
            disposables.add(editorService.onDidActiveEditorChange(() => this.updateRepresentedFilename(editorService, part.windowId)));
        });
    }
    updateRepresentedFilename(editorService, targetWindowId) {
        const file = EditorResourceAccessor.getOriginalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY, filterByScheme: Schemas.file });
        // Represented Filename
        this.nativeHostService.setRepresentedFilename(file?.fsPath ?? '', { targetWindowId });
        // Custom title menu (main window only currently)
        if (targetWindowId === mainWindow.vscodeWindowId) {
            this.provideCustomTitleContextMenu(file?.fsPath);
        }
    }
    //#region Window Lifecycle
    onBeforeShutdown({ veto, reason }) {
        if (reason === 1 /* ShutdownReason.CLOSE */) {
            const confirmBeforeCloseSetting = this.configurationService.getValue('window.confirmBeforeClose');
            const confirmBeforeClose = confirmBeforeCloseSetting === 'always' || (confirmBeforeCloseSetting === 'keyboardOnly' && ModifierKeyEmitter.getInstance().isModifierPressed);
            if (confirmBeforeClose) {
                // When we need to confirm on close or quit, veto the shutdown
                // with a long running promise to figure out whether shutdown
                // can proceed or not.
                return veto((async () => {
                    let actualReason = reason;
                    if (reason === 1 /* ShutdownReason.CLOSE */ && !isMacintosh) {
                        const windowCount = await this.nativeHostService.getWindowCount();
                        if (windowCount === 1) {
                            actualReason = 2 /* ShutdownReason.QUIT */; // Windows/Linux: closing last window means to QUIT
                        }
                    }
                    let confirmed = true;
                    if (confirmBeforeClose) {
                        confirmed = await this.instantiationService.invokeFunction(accessor => NativeWindow_1.confirmOnShutdown(accessor, actualReason));
                    }
                    // Progress for long running shutdown
                    if (confirmed) {
                        this.progressOnBeforeShutdown(reason);
                    }
                    return !confirmed;
                })(), 'veto.confirmBeforeClose');
            }
        }
        // Progress for long running shutdown
        this.progressOnBeforeShutdown(reason);
    }
    progressOnBeforeShutdown(reason) {
        this.progressService.withProgress({
            location: 10 /* ProgressLocation.Window */, // use window progress to not be too annoying about this operation
            delay: 800, // delay so that it only appears when operation takes a long time
            title: this.toShutdownLabel(reason, false),
        }, () => {
            return Event.toPromise(Event.any(this.lifecycleService.onWillShutdown, // dismiss this dialog when we shutdown
            this.lifecycleService.onShutdownVeto, // or when shutdown was vetoed
            this.dialogService.onWillShowDialog // or when a dialog asks for input
            ));
        });
    }
    onBeforeShutdownError({ error, reason }) {
        this.dialogService.error(this.toShutdownLabel(reason, true), localize('shutdownErrorDetail', "Error: {0}", toErrorMessage(error)));
    }
    onWillShutdown({ reason, force, joiners }) {
        // Delay so that the dialog only appears after timeout
        const shutdownDialogScheduler = new RunOnceScheduler(() => {
            const pendingJoiners = joiners();
            this.progressService.withProgress({
                location: 20 /* ProgressLocation.Dialog */, // use a dialog to prevent the user from making any more interactions now
                buttons: [this.toForceShutdownLabel(reason)], // allow to force shutdown anyway
                cancellable: false, // do not allow to cancel
                sticky: true, // do not allow to dismiss
                title: this.toShutdownLabel(reason, false),
                detail: pendingJoiners.length > 0 ? localize('willShutdownDetail', "The following operations are still running: \n{0}", pendingJoiners.map(joiner => `- ${joiner.label}`).join('\n')) : undefined
            }, () => {
                return Event.toPromise(this.lifecycleService.onDidShutdown); // dismiss this dialog when we actually shutdown
            }, () => {
                force();
            });
        }, 1200);
        shutdownDialogScheduler.schedule();
        // Dispose scheduler when we actually shutdown
        Event.once(this.lifecycleService.onDidShutdown)(() => shutdownDialogScheduler.dispose());
    }
    toShutdownLabel(reason, isError) {
        if (isError) {
            switch (reason) {
                case 1 /* ShutdownReason.CLOSE */:
                    return localize('shutdownErrorClose', "An unexpected error prevented the window to close");
                case 2 /* ShutdownReason.QUIT */:
                    return localize('shutdownErrorQuit', "An unexpected error prevented the application to quit");
                case 3 /* ShutdownReason.RELOAD */:
                    return localize('shutdownErrorReload', "An unexpected error prevented the window to reload");
                case 4 /* ShutdownReason.LOAD */:
                    return localize('shutdownErrorLoad', "An unexpected error prevented to change the workspace");
            }
        }
        switch (reason) {
            case 1 /* ShutdownReason.CLOSE */:
                return localize('shutdownTitleClose', "Closing the window is taking a bit longer...");
            case 2 /* ShutdownReason.QUIT */:
                return localize('shutdownTitleQuit', "Quitting the application is taking a bit longer...");
            case 3 /* ShutdownReason.RELOAD */:
                return localize('shutdownTitleReload', "Reloading the window is taking a bit longer...");
            case 4 /* ShutdownReason.LOAD */:
                return localize('shutdownTitleLoad', "Changing the workspace is taking a bit longer...");
        }
    }
    toForceShutdownLabel(reason) {
        switch (reason) {
            case 1 /* ShutdownReason.CLOSE */:
                return localize('shutdownForceClose', "Close Anyway");
            case 2 /* ShutdownReason.QUIT */:
                return localize('shutdownForceQuit', "Quit Anyway");
            case 3 /* ShutdownReason.RELOAD */:
                return localize('shutdownForceReload', "Reload Anyway");
            case 4 /* ShutdownReason.LOAD */:
                return localize('shutdownForceLoad', "Change Anyway");
        }
    }
    //#endregion
    updateDocumentEdited(documentEdited) {
        let setDocumentEdited;
        if (typeof documentEdited === 'boolean') {
            setDocumentEdited = documentEdited;
        }
        else {
            setDocumentEdited = this.workingCopyService.hasDirty;
        }
        if ((!this.isDocumentedEdited && setDocumentEdited) || (this.isDocumentedEdited && !setDocumentEdited)) {
            this.isDocumentedEdited = setDocumentEdited;
            this.nativeHostService.setDocumentEdited(setDocumentEdited);
        }
    }
    getWindowMinimumWidth(panelPosition = this.layoutService.getPanelPosition()) {
        // if panel is on the side, then return the larger minwidth
        const panelOnSide = panelPosition === 0 /* Position.LEFT */ || panelPosition === 1 /* Position.RIGHT */;
        if (panelOnSide) {
            return WindowMinimumSize.WIDTH_WITH_VERTICAL_PANEL;
        }
        return WindowMinimumSize.WIDTH;
    }
    onDidChangePanelPosition(pos) {
        const minWidth = this.getWindowMinimumWidth(pos);
        this.nativeHostService.setMinimumSize(minWidth, undefined);
    }
    maybeCloseWindow() {
        const closeWhenEmpty = this.configurationService.getValue('window.closeWhenEmpty') || this.nativeEnvironmentService.args.wait;
        if (!closeWhenEmpty) {
            return; // return early if configured to not close when empty
        }
        // Close empty editor groups based on setting and environment
        for (const editorPart of this.editorGroupService.parts) {
            if (editorPart.groups.some(group => !group.isEmpty)) {
                continue; // not empty
            }
            if (editorPart === this.editorGroupService.mainPart && (this.contextService.getWorkbenchState() !== 1 /* WorkbenchState.EMPTY */ || // only for empty windows
                this.environmentService.isExtensionDevelopment || // not when developing an extension
                this.editorService.visibleEditors.length > 0 // not when there are still editors open in other windows
            )) {
                continue;
            }
            if (editorPart === this.editorGroupService.mainPart) {
                this.nativeHostService.closeWindow();
            }
            else {
                editorPart.removeGroup(editorPart.activeGroup);
            }
        }
    }
    provideCustomTitleContextMenu(filePath) {
        // Clear old menu
        this.customTitleContextMenuDisposable.clear();
        // Only provide a menu when we have a file path and custom titlebar
        if (!filePath || hasNativeTitlebar(this.configurationService)) {
            return;
        }
        // Split up filepath into segments
        const segments = filePath.split(posix.sep);
        for (let i = segments.length; i > 0; i--) {
            const isFile = (i === segments.length);
            let pathOffset = i;
            if (!isFile) {
                pathOffset++; // for segments which are not the file name we want to open the folder
            }
            const path = URI.file(segments.slice(0, pathOffset).join(posix.sep));
            let label;
            if (!isFile) {
                label = this.labelService.getUriBasenameLabel(dirname(path));
            }
            else {
                label = this.labelService.getUriBasenameLabel(path);
            }
            const commandId = `workbench.action.revealPathInFinder${i}`;
            this.customTitleContextMenuDisposable.add(CommandsRegistry.registerCommand(commandId, () => this.nativeHostService.showItemInFolder(path.fsPath)));
            this.customTitleContextMenuDisposable.add(MenuRegistry.appendMenuItem(MenuId.TitleBarTitleContext, { command: { id: commandId, title: label || posix.sep }, order: -i, group: '1_file' }));
        }
    }
    create() {
        // Handle open calls
        this.setupOpenHandlers();
        // Notify some services about lifecycle phases
        this.lifecycleService.when(2 /* LifecyclePhase.Ready */).then(() => this.nativeHostService.notifyReady());
        this.lifecycleService.when(3 /* LifecyclePhase.Restored */).then(() => {
            this.sharedProcessService.notifyRestored();
            this.utilityProcessWorkerWorkbenchService.notifyRestored();
        });
        // Check for situations that are worth warning the user about
        this.handleWarnings();
        // Touchbar menu (if enabled)
        this.updateTouchbarMenu();
        // Window border
        this.updateWindowBorder();
        // Smoke Test Driver
        if (this.environmentService.enableSmokeTestDriver) {
            registerWindowDriver(this.instantiationService);
        }
    }
    async handleWarnings() {
        // After restored phase is fine for the following ones
        await this.lifecycleService.when(3 /* LifecyclePhase.Restored */);
        // Integrity / Root warning
        (async () => {
            const isAdmin = await this.nativeHostService.isAdmin();
            const { isPure } = await this.integrityService.isPure();
            // Update to title
            this.titleService.updateProperties({ isPure, isAdmin });
            // Show warning message (unix only)
            if (isAdmin && !isWindows) {
                this.notificationService.warn(localize('runningAsRoot', "It is not recommended to run {0} as root user.", this.productService.nameShort));
            }
        })();
        // Installation Dir Warning
        if (this.environmentService.isBuilt && !this.environmentService.extensionDevelopmentLocationURI?.length) {
            let installLocationUri;
            if (isMacintosh) {
                // appRoot = /Applications/Visual Studio Code - Insiders.app/Contents/Resources/app
                installLocationUri = dirname(dirname(dirname(URI.file(this.nativeEnvironmentService.appRoot))));
            }
            else {
                // appRoot = C:\Users\<name>\AppData\Local\Programs\Microsoft VS Code Insiders\resources\app
                // appRoot = /usr/share/code-insiders/resources/app
                installLocationUri = dirname(dirname(URI.file(this.nativeEnvironmentService.appRoot)));
            }
            for (const folder of this.contextService.getWorkspace().folders) {
                if (this.uriIdentityService.extUri.isEqualOrParent(folder.uri, installLocationUri)) {
                    this.bannerService.show({
                        id: 'appRootWarning.banner',
                        message: localize('appRootWarning.banner', "Files you store within the installation folder ('{0}') may be OVERWRITTEN or DELETED IRREVERSIBLY without warning at update time.", this.labelService.getUriLabel(installLocationUri)),
                        icon: Codicon.warning
                    });
                    break;
                }
            }
        }
        // macOS 11 warning
        if (isMacintosh) {
            const majorVersion = this.nativeEnvironmentService.os.release.split('.')[0];
            const eolReleases = new Map([
                ['20', 'macOS Big Sur'],
            ]);
            if (eolReleases.has(majorVersion)) {
                const message = localize('macoseolmessage', "{0} on {1} will soon stop receiving updates. Consider upgrading your macOS version.", this.productService.nameLong, eolReleases.get(majorVersion));
                this.notificationService.prompt(Severity.Warning, message, [{
                        label: localize('learnMore', "Learn More"),
                        run: () => this.openerService.open(URI.parse('https://aka.ms/vscode-faq-old-macOS'))
                    }], {
                    neverShowAgain: { id: 'macoseol', isSecondary: true, scope: NeverShowAgainScope.APPLICATION },
                    priority: NotificationPriority.URGENT,
                    sticky: true
                });
            }
        }
        // Slow shell environment progress indicator
        const shellEnv = process.shellEnv();
        this.progressService.withProgress({
            title: localize('resolveShellEnvironment', "Resolving shell environment..."),
            location: 10 /* ProgressLocation.Window */,
            delay: 1600,
            buttons: [localize('learnMore', "Learn More")]
        }, () => shellEnv, () => this.openerService.open('https://go.microsoft.com/fwlink/?linkid=2149667'));
    }
    async resolveExternalUri(uri, options) {
        let queryTunnel;
        if (options?.allowTunneling) {
            const portMappingRequest = extractLocalHostUriMetaDataForPortMapping(uri);
            const queryPortMapping = extractQueryLocalHostUriMetaDataForPortMapping(uri);
            if (queryPortMapping) {
                queryTunnel = await this.openTunnel(queryPortMapping.address, queryPortMapping.port);
                if (queryTunnel && (typeof queryTunnel !== 'string')) {
                    // If the tunnel was mapped to a different port, dispose it, because some services
                    // validate the port number in the query string.
                    if (queryTunnel.tunnelRemotePort !== queryPortMapping.port) {
                        queryTunnel.dispose();
                        queryTunnel = undefined;
                    }
                    else {
                        if (!portMappingRequest) {
                            const tunnel = queryTunnel;
                            return {
                                resolved: uri,
                                dispose: () => tunnel.dispose()
                            };
                        }
                    }
                }
            }
            if (portMappingRequest) {
                const tunnel = await this.openTunnel(portMappingRequest.address, portMappingRequest.port);
                if (tunnel && (typeof tunnel !== 'string')) {
                    const addressAsUri = URI.parse(tunnel.localAddress).with({ path: uri.path });
                    const resolved = addressAsUri.scheme.startsWith(uri.scheme) ? addressAsUri : uri.with({ authority: tunnel.localAddress });
                    return {
                        resolved,
                        dispose() {
                            tunnel.dispose();
                            if (queryTunnel && (typeof queryTunnel !== 'string')) {
                                queryTunnel.dispose();
                            }
                        }
                    };
                }
            }
        }
        if (!options?.openExternal) {
            const canHandleResource = await this.fileService.canHandleResource(uri);
            if (canHandleResource) {
                return {
                    resolved: URI.from({
                        scheme: this.productService.urlProtocol,
                        path: 'workspace',
                        query: uri.toString()
                    }),
                    dispose() { }
                };
            }
        }
        return undefined;
    }
    async openTunnel(address, port) {
        const remoteAuthority = this.environmentService.remoteAuthority;
        const addressProvider = remoteAuthority ? {
            getAddress: async () => {
                return (await this.remoteAuthorityResolverService.resolveAuthority(remoteAuthority)).authority;
            }
        } : undefined;
        const tunnel = await this.tunnelService.getExistingTunnel(address, port);
        if (!tunnel || (typeof tunnel === 'string')) {
            return this.tunnelService.openTunnel(addressProvider, address, port);
        }
        return tunnel;
    }
    setupOpenHandlers() {
        // Handle external open() calls
        this.openerService.setDefaultExternalOpener({
            openExternal: async (href) => {
                const success = await this.nativeHostService.openExternal(href, this.configurationService.getValue('workbench.externalBrowser'));
                if (!success) {
                    const fileCandidate = URI.parse(href);
                    if (fileCandidate.scheme === Schemas.file) {
                        // if opening failed, and this is a file, we can still try to reveal it
                        await this.nativeHostService.showItemInFolder(fileCandidate.fsPath);
                    }
                }
                return true;
            }
        });
        // Register external URI resolver
        this.openerService.registerExternalUriResolver({
            resolveExternalUri: async (uri, options) => {
                return this.resolveExternalUri(uri, options);
            }
        });
    }
    updateTouchbarMenu() {
        if (!isMacintosh) {
            return; // macOS only
        }
        // Dispose old
        this.touchBarDisposables.clear();
        this.touchBarMenu = undefined;
        // Create new (delayed)
        const scheduler = this.touchBarDisposables.add(new RunOnceScheduler(() => this.doUpdateTouchbarMenu(scheduler), 300));
        scheduler.schedule();
    }
    doUpdateTouchbarMenu(scheduler) {
        if (!this.touchBarMenu) {
            const scopedContextKeyService = this.editorService.activeEditorPane?.scopedContextKeyService || this.editorGroupService.activeGroup.scopedContextKeyService;
            this.touchBarMenu = this.menuService.createMenu(MenuId.TouchBarContext, scopedContextKeyService);
            this.touchBarDisposables.add(this.touchBarMenu);
            this.touchBarDisposables.add(this.touchBarMenu.onDidChange(() => scheduler.schedule()));
        }
        const disabled = this.configurationService.getValue('keyboard.touchbar.enabled') === false;
        const touchbarIgnored = this.configurationService.getValue('keyboard.touchbar.ignored');
        const ignoredItems = Array.isArray(touchbarIgnored) ? touchbarIgnored : [];
        // Fill actions into groups respecting order
        const actions = getFlatActionBarActions(this.touchBarMenu.getActions());
        // Convert into command action multi array
        const items = [];
        let group = [];
        if (!disabled) {
            for (const action of actions) {
                // Command
                if (action instanceof MenuItemAction) {
                    if (ignoredItems.indexOf(action.item.id) >= 0) {
                        continue; // ignored
                    }
                    group.push(action.item);
                }
                // Separator
                else if (action instanceof Separator) {
                    if (group.length) {
                        items.push(group);
                    }
                    group = [];
                }
            }
            if (group.length) {
                items.push(group);
            }
        }
        // Only update if the actions have changed
        if (!equals(this.lastInstalledTouchedBar, items)) {
            this.lastInstalledTouchedBar = items;
            this.nativeHostService.updateTouchBar(items);
        }
    }
    //#endregion
    //#region Window Border
    updateWindowBorder() {
        if (!isWindows) {
            return; // windows only
        }
        const theme = this.themeService.getColorTheme();
        let activeBorder = theme.getColor(WINDOW_ACTIVE_BORDER)?.toString();
        let inactiveBorder = theme.getColor(WINDOW_INACTIVE_BORDER)?.toString();
        const borderSetting = this.configurationService.getValue('window.border');
        if (borderSetting === 'off') {
            activeBorder = 'off';
            inactiveBorder = undefined;
        }
        else if (borderSetting === 'default') {
            activeBorder = activeBorder ?? 'default';
        }
        else if (borderSetting === 'system') {
            activeBorder = 'default';
            inactiveBorder = undefined;
        }
        else {
            activeBorder = borderSetting;
            inactiveBorder = undefined;
        }
        this.nativeHostService.updateWindowAccentColor(activeBorder, inactiveBorder);
    }
    //#endregion
    onAddRemoveFoldersRequest(request) {
        // Buffer all pending requests
        this.pendingFoldersToAdd.push(...request.foldersToAdd.map(folder => URI.revive(folder)));
        this.pendingFoldersToRemove.push(...request.foldersToRemove.map(folder => URI.revive(folder)));
        // Delay the adding of folders a bit to buffer in case more requests are coming
        if (!this.addRemoveFoldersScheduler.isScheduled()) {
            this.addRemoveFoldersScheduler.schedule();
        }
    }
    async doAddRemoveFolders() {
        const foldersToAdd = this.pendingFoldersToAdd.map(folder => ({ uri: folder }));
        const foldersToRemove = this.pendingFoldersToRemove.slice(0);
        this.pendingFoldersToAdd = [];
        this.pendingFoldersToRemove = [];
        if (foldersToAdd.length) {
            await this.workspaceEditingService.addFolders(foldersToAdd);
        }
        if (foldersToRemove.length) {
            await this.workspaceEditingService.removeFolders(foldersToRemove);
        }
    }
    async onOpenFiles(request) {
        const diffMode = !!(request.filesToDiff && (request.filesToDiff.length === 2));
        const mergeMode = !!(request.filesToMerge && (request.filesToMerge.length === 4));
        const inputs = coalesce(await pathsToEditors(mergeMode ? request.filesToMerge : diffMode ? request.filesToDiff : request.filesToOpenOrCreate, this.fileService, this.logService));
        if (inputs.length) {
            const openedEditorPanes = await this.openResources(inputs, diffMode, mergeMode);
            if (request.filesToWait) {
                // In wait mode, listen to changes to the editors and wait until the files
                // are closed that the user wants to wait for. When this happens we delete
                // the wait marker file to signal to the outside that editing is done.
                // However, it is possible that opening of the editors failed, as such we
                // check for whether editor panes got opened and otherwise delete the marker
                // right away.
                if (openedEditorPanes.length) {
                    return this.trackClosedWaitFiles(URI.revive(request.filesToWait.waitMarkerFileUri), coalesce(request.filesToWait.paths.map(path => URI.revive(path.fileUri))));
                }
                else {
                    return this.fileService.del(URI.revive(request.filesToWait.waitMarkerFileUri));
                }
            }
        }
    }
    async trackClosedWaitFiles(waitMarkerFile, resourcesToWaitFor) {
        // Wait for the resources to be closed in the text editor...
        await this.instantiationService.invokeFunction(accessor => whenEditorClosed(accessor, resourcesToWaitFor));
        // ...before deleting the wait marker file
        await this.fileService.del(waitMarkerFile);
    }
    async openResources(resources, diffMode, mergeMode) {
        const editors = [];
        if (mergeMode && isResourceEditorInput(resources[0]) && isResourceEditorInput(resources[1]) && isResourceEditorInput(resources[2]) && isResourceEditorInput(resources[3])) {
            const mergeEditor = {
                input1: { resource: resources[0].resource },
                input2: { resource: resources[1].resource },
                base: { resource: resources[2].resource },
                result: { resource: resources[3].resource },
                options: { pinned: true }
            };
            editors.push(mergeEditor);
        }
        else if (diffMode && isResourceEditorInput(resources[0]) && isResourceEditorInput(resources[1])) {
            const diffEditor = {
                original: { resource: resources[0].resource },
                modified: { resource: resources[1].resource },
                options: { pinned: true }
            };
            editors.push(diffEditor);
        }
        else {
            editors.push(...resources);
        }
        return this.editorService.openEditors(editors, undefined, { validateTrust: true });
    }
    resolveConfiguredWindowZoomLevel() {
        const windowZoomLevel = this.configurationService.getValue('window.zoomLevel');
        return typeof windowZoomLevel === 'number' ? windowZoomLevel : 0;
    }
    handleOnDidChangeZoomLevel(targetWindowId) {
        // Zoom status entry
        this.updateWindowZoomStatusEntry(targetWindowId);
        // Notify main process about a custom zoom level
        if (targetWindowId === mainWindow.vscodeWindowId) {
            const currentWindowZoomLevel = getZoomLevel(mainWindow);
            let notifyZoomLevel = undefined;
            if (this.configuredWindowZoomLevel !== currentWindowZoomLevel) {
                notifyZoomLevel = currentWindowZoomLevel;
            }
            ipcRenderer.invoke('vscode:notifyZoomLevel', notifyZoomLevel);
        }
    }
    createWindowZoomStatusEntry(part) {
        const disposables = new DisposableStore();
        Event.once(part.onWillDispose)(() => disposables.dispose());
        const scopedInstantiationService = this.editorGroupService.getScopedInstantiationService(part);
        this.mapWindowIdToZoomStatusEntry.set(part.windowId, disposables.add(scopedInstantiationService.createInstance(ZoomStatusEntry)));
        disposables.add(toDisposable(() => this.mapWindowIdToZoomStatusEntry.delete(part.windowId)));
        this.updateWindowZoomStatusEntry(part.windowId);
    }
    updateWindowZoomStatusEntry(targetWindowId) {
        const targetWindow = getWindowById(targetWindowId);
        const entry = this.mapWindowIdToZoomStatusEntry.get(targetWindowId);
        if (entry && targetWindow) {
            const currentZoomLevel = getZoomLevel(targetWindow.window);
            let text = undefined;
            if (currentZoomLevel < this.configuredWindowZoomLevel) {
                text = '$(zoom-out)';
            }
            else if (currentZoomLevel > this.configuredWindowZoomLevel) {
                text = '$(zoom-in)';
            }
            entry.updateZoomEntry(text ?? false, targetWindowId);
        }
    }
    onDidChangeConfiguredWindowZoomLevel() {
        this.configuredWindowZoomLevel = this.resolveConfiguredWindowZoomLevel();
        let applyZoomLevel = false;
        for (const { window } of getWindows()) {
            if (getZoomLevel(window) !== this.configuredWindowZoomLevel) {
                applyZoomLevel = true;
                break;
            }
        }
        if (applyZoomLevel) {
            applyZoom(this.configuredWindowZoomLevel, ApplyZoomTarget.ALL_WINDOWS);
        }
        for (const [windowId] of this.mapWindowIdToZoomStatusEntry) {
            this.updateWindowZoomStatusEntry(windowId);
        }
    }
    //#endregion
    dispose() {
        super.dispose();
        for (const [, entry] of this.mapWindowIdToZoomStatusEntry) {
            entry.dispose();
        }
    }
};
NativeWindow = NativeWindow_1 = __decorate([
    __param(0, IEditorService),
    __param(1, IEditorGroupsService),
    __param(2, IConfigurationService),
    __param(3, ITitleService),
    __param(4, IWorkbenchThemeService),
    __param(5, INotificationService),
    __param(6, ICommandService),
    __param(7, IKeybindingService),
    __param(8, ITelemetryService),
    __param(9, IWorkspaceEditingService),
    __param(10, IFileService),
    __param(11, IMenuService),
    __param(12, ILifecycleService),
    __param(13, IIntegrityService),
    __param(14, INativeWorkbenchEnvironmentService),
    __param(15, IAccessibilityService),
    __param(16, IWorkspaceContextService),
    __param(17, IOpenerService),
    __param(18, INativeHostService),
    __param(19, ITunnelService),
    __param(20, IWorkbenchLayoutService),
    __param(21, IWorkingCopyService),
    __param(22, IFilesConfigurationService),
    __param(23, IProductService),
    __param(24, IRemoteAuthorityResolverService),
    __param(25, IDialogService),
    __param(26, IStorageService),
    __param(27, ILogService),
    __param(28, IInstantiationService),
    __param(29, ISharedProcessService),
    __param(30, IProgressService),
    __param(31, ILabelService),
    __param(32, IBannerService),
    __param(33, IUriIdentityService),
    __param(34, IPreferencesService),
    __param(35, IUtilityProcessWorkerWorkbenchService),
    __param(36, IHostService),
    __param(37, IContextMenuService)
], NativeWindow);
export { NativeWindow };
let ZoomStatusEntry = class ZoomStatusEntry extends Disposable {
    constructor(statusbarService, commandService, keybindingService) {
        super();
        this.statusbarService = statusbarService;
        this.commandService = commandService;
        this.keybindingService = keybindingService;
        this.disposable = this._register(new MutableDisposable());
        this.zoomLevelLabel = undefined;
    }
    updateZoomEntry(visibleOrText, targetWindowId) {
        if (typeof visibleOrText === 'string') {
            if (!this.disposable.value) {
                this.createZoomEntry(visibleOrText);
            }
            this.updateZoomLevelLabel(targetWindowId);
        }
        else {
            this.disposable.clear();
        }
    }
    createZoomEntry(visibleOrText) {
        const disposables = new DisposableStore();
        this.disposable.value = disposables;
        const container = $('.zoom-status');
        const left = $('.zoom-status-left');
        container.appendChild(left);
        const zoomOutAction = disposables.add(new Action('workbench.action.zoomOut', localize('zoomOut', "Zoom Out"), ThemeIcon.asClassName(Codicon.remove), true, () => this.commandService.executeCommand(zoomOutAction.id)));
        const zoomInAction = disposables.add(new Action('workbench.action.zoomIn', localize('zoomIn', "Zoom In"), ThemeIcon.asClassName(Codicon.plus), true, () => this.commandService.executeCommand(zoomInAction.id)));
        const zoomResetAction = disposables.add(new Action('workbench.action.zoomReset', localize('zoomReset', "Reset"), undefined, true, () => this.commandService.executeCommand(zoomResetAction.id)));
        zoomResetAction.tooltip = localize('zoomResetLabel', "{0} ({1})", zoomResetAction.label, this.keybindingService.lookupKeybinding(zoomResetAction.id)?.getLabel());
        const zoomSettingsAction = disposables.add(new Action('workbench.action.openSettings', localize('zoomSettings', "Settings"), ThemeIcon.asClassName(Codicon.settingsGear), true, () => this.commandService.executeCommand(zoomSettingsAction.id, 'window.zoom')));
        const zoomLevelLabel = disposables.add(new Action('zoomLabel', undefined, undefined, false));
        this.zoomLevelLabel = zoomLevelLabel;
        disposables.add(toDisposable(() => this.zoomLevelLabel = undefined));
        const actionBarLeft = disposables.add(new ActionBar(left, { hoverDelegate: nativeHoverDelegate }));
        actionBarLeft.push(zoomOutAction, { icon: true, label: false, keybinding: this.keybindingService.lookupKeybinding(zoomOutAction.id)?.getLabel() });
        actionBarLeft.push(this.zoomLevelLabel, { icon: false, label: true });
        actionBarLeft.push(zoomInAction, { icon: true, label: false, keybinding: this.keybindingService.lookupKeybinding(zoomInAction.id)?.getLabel() });
        const right = $('.zoom-status-right');
        container.appendChild(right);
        const actionBarRight = disposables.add(new ActionBar(right, { hoverDelegate: nativeHoverDelegate }));
        actionBarRight.push(zoomResetAction, { icon: false, label: true });
        actionBarRight.push(zoomSettingsAction, { icon: true, label: false, keybinding: this.keybindingService.lookupKeybinding(zoomSettingsAction.id)?.getLabel() });
        const name = localize('status.windowZoom', "Window Zoom");
        disposables.add(this.statusbarService.addEntry({
            name,
            text: visibleOrText,
            tooltip: container,
            ariaLabel: name,
            command: ShowTooltipCommand,
            kind: 'prominent'
        }, 'status.windowZoom', 1 /* StatusbarAlignment.RIGHT */, 102));
    }
    updateZoomLevelLabel(targetWindowId) {
        if (this.zoomLevelLabel) {
            const targetWindow = getWindowById(targetWindowId, true).window;
            const zoomFactor = Math.round(getZoomFactor(targetWindow) * 100);
            const zoomLevel = getZoomLevel(targetWindow);
            this.zoomLevelLabel.label = `${zoomLevel}`;
            this.zoomLevelLabel.tooltip = localize('zoomNumber', "Zoom Level: {0} ({1}%)", zoomLevel, zoomFactor);
        }
    }
};
ZoomStatusEntry = __decorate([
    __param(0, IStatusbarService),
    __param(1, ICommandService),
    __param(2, IKeybindingService)
], ZoomStatusEntry);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2luZG93LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9lbGVjdHJvbi1icm93c2VyL3dpbmRvdy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxvQkFBb0IsQ0FBQztBQUM1QixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ3hDLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDdEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUscUJBQXFCLEVBQUUsa0JBQWtCLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLGFBQWEsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDekssT0FBTyxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQXVFLE1BQU0sOEJBQThCLENBQUM7QUFDdEksT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxzQkFBc0IsRUFBb0MsZ0JBQWdCLEVBQUUsY0FBYyxFQUE4RCxxQkFBcUIsRUFBNkIsTUFBTSxxQkFBcUIsQ0FBQztBQUMvTyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDNUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDakYsT0FBTyxFQUFFLGlCQUFpQixFQUE0SSxpQkFBaUIsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3hPLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUM1RixPQUFPLEVBQUUsZUFBZSxFQUFFLFNB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