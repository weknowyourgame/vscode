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
import { Emitter, Event } from '../../../../base/common/event.js';
import { IHostService } from './host.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { IEditorService } from '../../editor/common/editorService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { isFolderToOpen, isWorkspaceToOpen, isFileToOpen } from '../../../../platform/window/common/window.js';
import { isResourceEditorInput, pathsToEditors } from '../../../common/editor.js';
import { whenEditorClosed } from '../../../browser/editor.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { EventType, ModifierKeyEmitter, addDisposableListener, addDisposableThrottledListener, detectFullscreen, disposableWindowInterval, getActiveDocument, getActiveWindow, getWindowId, onDidRegisterWindow, trackFocus, getWindows as getDOMWindows } from '../../../../base/browser/dom.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { IBrowserWorkbenchEnvironmentService } from '../../environment/browser/environmentService.js';
import { memoize } from '../../../../base/common/decorators.js';
import { parseLineAndColumnAware } from '../../../../base/common/extpath.js';
import { IWorkspaceEditingService } from '../../workspaces/common/workspaceEditing.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILifecycleService } from '../../lifecycle/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { getWorkspaceIdentifier } from '../../workspaces/browser/workspaces.js';
import { localize } from '../../../../nls.js';
import Severity from '../../../../base/common/severity.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { DomEmitter } from '../../../../base/browser/event.js';
import { isUndefined } from '../../../../base/common/types.js';
import { isTemporaryWorkspace, IWorkspaceContextService, toWorkspaceIdentifier } from '../../../../platform/workspace/common/workspace.js';
import { Schemas } from '../../../../base/common/network.js';
import { coalesce } from '../../../../base/common/arrays.js';
import { mainWindow, isAuxiliaryWindow } from '../../../../base/browser/window.js';
import { isIOS, isMacintosh } from '../../../../base/common/platform.js';
import { IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
var HostShutdownReason;
(function (HostShutdownReason) {
    /**
     * An unknown shutdown reason.
     */
    HostShutdownReason[HostShutdownReason["Unknown"] = 1] = "Unknown";
    /**
     * A shutdown that was potentially triggered by keyboard use.
     */
    HostShutdownReason[HostShutdownReason["Keyboard"] = 2] = "Keyboard";
    /**
     * An explicit shutdown via code.
     */
    HostShutdownReason[HostShutdownReason["Api"] = 3] = "Api";
})(HostShutdownReason || (HostShutdownReason = {}));
let BrowserHostService = class BrowserHostService extends Disposable {
    constructor(layoutService, configurationService, fileService, labelService, environmentService, instantiationService, lifecycleService, logService, dialogService, contextService, userDataProfilesService) {
        super();
        this.layoutService = layoutService;
        this.configurationService = configurationService;
        this.fileService = fileService;
        this.labelService = labelService;
        this.environmentService = environmentService;
        this.instantiationService = instantiationService;
        this.lifecycleService = lifecycleService;
        this.logService = logService;
        this.dialogService = dialogService;
        this.contextService = contextService;
        this.userDataProfilesService = userDataProfilesService;
        this.shutdownReason = HostShutdownReason.Unknown;
        if (environmentService.options?.workspaceProvider) {
            this.workspaceProvider = environmentService.options.workspaceProvider;
        }
        else {
            this.workspaceProvider = new class {
                constructor() {
                    this.workspace = undefined;
                    this.trusted = undefined;
                }
                async open() { return true; }
            };
        }
        this.registerListeners();
    }
    registerListeners() {
        // Veto shutdown depending on `window.confirmBeforeClose` setting
        this._register(this.lifecycleService.onBeforeShutdown(e => this.onBeforeShutdown(e)));
        // Track modifier keys to detect keybinding usage
        this._register(ModifierKeyEmitter.getInstance().event(() => this.updateShutdownReasonFromEvent()));
    }
    onBeforeShutdown(e) {
        switch (this.shutdownReason) {
            // Unknown / Keyboard shows veto depending on setting
            case HostShutdownReason.Unknown:
            case HostShutdownReason.Keyboard: {
                const confirmBeforeClose = this.configurationService.getValue('window.confirmBeforeClose');
                if (confirmBeforeClose === 'always' || (confirmBeforeClose === 'keyboardOnly' && this.shutdownReason === HostShutdownReason.Keyboard)) {
                    e.veto(true, 'veto.confirmBeforeClose');
                }
                break;
            }
            // Api never shows veto
            case HostShutdownReason.Api:
                break;
        }
        // Unset for next shutdown
        this.shutdownReason = HostShutdownReason.Unknown;
    }
    updateShutdownReasonFromEvent() {
        if (this.shutdownReason === HostShutdownReason.Api) {
            return; // do not overwrite any explicitly set shutdown reason
        }
        if (ModifierKeyEmitter.getInstance().isModifierPressed) {
            this.shutdownReason = HostShutdownReason.Keyboard;
        }
        else {
            this.shutdownReason = HostShutdownReason.Unknown;
        }
    }
    //#region Focus
    get onDidChangeFocus() {
        const emitter = this._register(new Emitter());
        this._register(Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => {
            const focusTracker = disposables.add(trackFocus(window));
            const visibilityTracker = disposables.add(new DomEmitter(window.document, 'visibilitychange'));
            Event.any(Event.map(focusTracker.onDidFocus, () => this.hasFocus, disposables), Event.map(focusTracker.onDidBlur, () => this.hasFocus, disposables), Event.map(visibilityTracker.event, () => this.hasFocus, disposables), Event.map(this.onDidChangeActiveWindow, () => this.hasFocus, disposables))(focus => emitter.fire(focus), undefined, disposables);
        }, { window: mainWindow, disposables: this._store }));
        return Event.latch(emitter.event, undefined, this._store);
    }
    get hasFocus() {
        return getActiveDocument().hasFocus();
    }
    async hadLastFocus() {
        return true;
    }
    async focus(targetWindow) {
        targetWindow.focus();
    }
    //#endregion
    //#region Window
    get onDidChangeActiveWindow() {
        const emitter = this._register(new Emitter());
        this._register(Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => {
            const windowId = getWindowId(window);
            // Emit via focus tracking
            const focusTracker = disposables.add(trackFocus(window));
            disposables.add(focusTracker.onDidFocus(() => emitter.fire(windowId)));
            // Emit via interval: immediately when opening an auxiliary window,
            // it is possible that document focus has not yet changed, so we
            // poll for a while to ensure we catch the event.
            if (isAuxiliaryWindow(window)) {
                disposables.add(disposableWindowInterval(window, () => {
                    const hasFocus = window.document.hasFocus();
                    if (hasFocus) {
                        emitter.fire(windowId);
                    }
                    return hasFocus;
                }, 100, 20));
            }
        }, { window: mainWindow, disposables: this._store }));
        return Event.latch(emitter.event, undefined, this._store);
    }
    get onDidChangeFullScreen() {
        const emitter = this._register(new Emitter());
        this._register(Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => {
            const windowId = getWindowId(window);
            const viewport = isIOS && window.visualViewport ? window.visualViewport /** Visual viewport */ : window /** Layout viewport */;
            // Fullscreen (Browser)
            for (const event of [EventType.FULLSCREEN_CHANGE, EventType.WK_FULLSCREEN_CHANGE]) {
                disposables.add(addDisposableListener(window.document, event, () => emitter.fire({ windowId, fullscreen: !!detectFullscreen(window) })));
            }
            // Fullscreen (Native)
            disposables.add(addDisposableThrottledListener(viewport, EventType.RESIZE, () => emitter.fire({ windowId, fullscreen: !!detectFullscreen(window) }), undefined, isMacintosh ? 2000 /* adjust for macOS animation */ : 800 /* can be throttled */));
        }, { window: mainWindow, disposables: this._store }));
        return emitter.event;
    }
    openWindow(arg1, arg2) {
        if (Array.isArray(arg1)) {
            return this.doOpenWindow(arg1, arg2);
        }
        return this.doOpenEmptyWindow(arg1);
    }
    async doOpenWindow(toOpen, options) {
        const payload = this.preservePayload(false /* not an empty window */, options);
        const fileOpenables = [];
        const foldersToAdd = [];
        const foldersToRemove = [];
        for (const openable of toOpen) {
            openable.label = openable.label || this.getRecentLabel(openable);
            // Folder
            if (isFolderToOpen(openable)) {
                if (options?.addMode) {
                    foldersToAdd.push({ uri: openable.folderUri });
                }
                else if (options?.removeMode) {
                    foldersToRemove.push(openable.folderUri);
                }
                else {
                    this.doOpen({ folderUri: openable.folderUri }, { reuse: this.shouldReuse(options, false /* no file */), payload });
                }
            }
            // Workspace
            else if (isWorkspaceToOpen(openable)) {
                this.doOpen({ workspaceUri: openable.workspaceUri }, { reuse: this.shouldReuse(options, false /* no file */), payload });
            }
            // File (handled later in bulk)
            else if (isFileToOpen(openable)) {
                fileOpenables.push(openable);
            }
        }
        // Handle Folders to add or remove
        if (foldersToAdd.length > 0 || foldersToRemove.length > 0) {
            this.withServices(async (accessor) => {
                const workspaceEditingService = accessor.get(IWorkspaceEditingService);
                if (foldersToAdd.length > 0) {
                    await workspaceEditingService.addFolders(foldersToAdd);
                }
                if (foldersToRemove.length > 0) {
                    await workspaceEditingService.removeFolders(foldersToRemove);
                }
            });
        }
        // Handle Files
        if (fileOpenables.length > 0) {
            this.withServices(async (accessor) => {
                const editorService = accessor.get(IEditorService);
                // Support mergeMode
                if (options?.mergeMode && fileOpenables.length === 4) {
                    const editors = coalesce(await pathsToEditors(fileOpenables, this.fileService, this.logService));
                    if (editors.length !== 4 || !isResourceEditorInput(editors[0]) || !isResourceEditorInput(editors[1]) || !isResourceEditorInput(editors[2]) || !isResourceEditorInput(editors[3])) {
                        return; // invalid resources
                    }
                    // Same Window: open via editor service in current window
                    if (this.shouldReuse(options, true /* file */)) {
                        editorService.openEditor({
                            input1: { resource: editors[0].resource },
                            input2: { resource: editors[1].resource },
                            base: { resource: editors[2].resource },
                            result: { resource: editors[3].resource },
                            options: { pinned: true }
                        });
                    }
                    // New Window: open into empty window
                    else {
                        const environment = new Map();
                        environment.set('mergeFile1', editors[0].resource.toString());
                        environment.set('mergeFile2', editors[1].resource.toString());
                        environment.set('mergeFileBase', editors[2].resource.toString());
                        environment.set('mergeFileResult', editors[3].resource.toString());
                        this.doOpen(undefined, { payload: Array.from(environment.entries()) });
                    }
                }
                // Support diffMode
                else if (options?.diffMode && fileOpenables.length === 2) {
                    const editors = coalesce(await pathsToEditors(fileOpenables, this.fileService, this.logService));
                    if (editors.length !== 2 || !isResourceEditorInput(editors[0]) || !isResourceEditorInput(editors[1])) {
                        return; // invalid resources
                    }
                    // Same Window: open via editor service in current window
                    if (this.shouldReuse(options, true /* file */)) {
                        editorService.openEditor({
                            original: { resource: editors[0].resource },
                            modified: { resource: editors[1].resource },
                            options: { pinned: true }
                        });
                    }
                    // New Window: open into empty window
                    else {
                        const environment = new Map();
                        environment.set('diffFileSecondary', editors[0].resource.toString());
                        environment.set('diffFilePrimary', editors[1].resource.toString());
                        this.doOpen(undefined, { payload: Array.from(environment.entries()) });
                    }
                }
                // Just open normally
                else {
                    for (const openable of fileOpenables) {
                        // Same Window: open via editor service in current window
                        if (this.shouldReuse(options, true /* file */)) {
                            let openables = [];
                            // Support: --goto parameter to open on line/col
                            if (options?.gotoLineMode) {
                                const pathColumnAware = parseLineAndColumnAware(openable.fileUri.path);
                                openables = [{
                                        fileUri: openable.fileUri.with({ path: pathColumnAware.path }),
                                        options: {
                                            selection: !isUndefined(pathColumnAware.line) ? { startLineNumber: pathColumnAware.line, startColumn: pathColumnAware.column || 1 } : undefined
                                        }
                                    }];
                            }
                            else {
                                openables = [openable];
                            }
                            editorService.openEditors(coalesce(await pathsToEditors(openables, this.fileService, this.logService)), undefined, { validateTrust: true });
                        }
                        // New Window: open into empty window
                        else {
                            const environment = new Map();
                            environment.set('openFile', openable.fileUri.toString());
                            if (options?.gotoLineMode) {
                                environment.set('gotoLineMode', 'true');
                            }
                            this.doOpen(undefined, { payload: Array.from(environment.entries()) });
                        }
                    }
                }
                // Support wait mode
                const waitMarkerFileURI = options?.waitMarkerFileURI;
                if (waitMarkerFileURI) {
                    (async () => {
                        // Wait for the resources to be closed in the text editor...
                        const filesToWaitFor = [];
                        if (options.mergeMode) {
                            filesToWaitFor.push(fileOpenables[3].fileUri /* [3] is the resulting merge file */);
                        }
                        else {
                            filesToWaitFor.push(...fileOpenables.map(fileOpenable => fileOpenable.fileUri));
                        }
                        await this.instantiationService.invokeFunction(accessor => whenEditorClosed(accessor, filesToWaitFor));
                        // ...before deleting the wait marker file
                        await this.fileService.del(waitMarkerFileURI);
                    })();
                }
            });
        }
    }
    withServices(fn) {
        // Host service is used in a lot of contexts and some services
        // need to be resolved dynamically to avoid cyclic dependencies
        // (https://github.com/microsoft/vscode/issues/108522)
        this.instantiationService.invokeFunction(accessor => fn(accessor));
    }
    preservePayload(isEmptyWindow, options) {
        // Selectively copy payload: for now only extension debugging properties are considered
        const newPayload = [];
        if (!isEmptyWindow && this.environmentService.extensionDevelopmentLocationURI) {
            newPayload.push(['extensionDevelopmentPath', this.environmentService.extensionDevelopmentLocationURI.toString()]);
            if (this.environmentService.debugExtensionHost.debugId) {
                newPayload.push(['debugId', this.environmentService.debugExtensionHost.debugId]);
            }
            if (this.environmentService.debugExtensionHost.port) {
                newPayload.push(['inspect-brk-extensions', String(this.environmentService.debugExtensionHost.port)]);
            }
        }
        const newWindowProfile = options?.forceProfile
            ? this.userDataProfilesService.profiles.find(profile => profile.name === options?.forceProfile)
            : undefined;
        if (newWindowProfile && !newWindowProfile.isDefault) {
            newPayload.push(['profile', newWindowProfile.name]);
        }
        return newPayload.length ? newPayload : undefined;
    }
    getRecentLabel(openable) {
        if (isFolderToOpen(openable)) {
            return this.labelService.getWorkspaceLabel(openable.folderUri, { verbose: 2 /* Verbosity.LONG */ });
        }
        if (isWorkspaceToOpen(openable)) {
            return this.labelService.getWorkspaceLabel(getWorkspaceIdentifier(openable.workspaceUri), { verbose: 2 /* Verbosity.LONG */ });
        }
        return this.labelService.getUriLabel(openable.fileUri, { appendWorkspaceSuffix: true });
    }
    shouldReuse(options = Object.create(null), isFile) {
        if (options.waitMarkerFileURI) {
            return true; // always handle --wait in same window
        }
        const windowConfig = this.configurationService.getValue('window');
        const openInNewWindowConfig = isFile ? (windowConfig?.openFilesInNewWindow || 'off' /* default */) : (windowConfig?.openFoldersInNewWindow || 'default' /* default */);
        let openInNewWindow = (options.preferNewWindow || !!options.forceNewWindow) && !options.forceReuseWindow;
        if (!options.forceNewWindow && !options.forceReuseWindow && (openInNewWindowConfig === 'on' || openInNewWindowConfig === 'off')) {
            openInNewWindow = (openInNewWindowConfig === 'on');
        }
        return !openInNewWindow;
    }
    async doOpenEmptyWindow(options) {
        return this.doOpen(undefined, {
            reuse: options?.forceReuseWindow,
            payload: this.preservePayload(true /* empty window */, options)
        });
    }
    async doOpen(workspace, options) {
        // When we are in a temporary workspace and are asked to open a local folder
        // we swap that folder into the workspace to avoid a window reload. Access
        // to local resources is only possible without a window reload because it
        // needs user activation.
        if (workspace && isFolderToOpen(workspace) && workspace.folderUri.scheme === Schemas.file && isTemporaryWorkspace(this.contextService.getWorkspace())) {
            this.withServices(async (accessor) => {
                const workspaceEditingService = accessor.get(IWorkspaceEditingService);
                await workspaceEditingService.updateFolders(0, this.contextService.getWorkspace().folders.length, [{ uri: workspace.folderUri }]);
            });
            return;
        }
        // We know that `workspaceProvider.open` will trigger a shutdown
        // with `options.reuse` so we handle this expected shutdown
        if (options?.reuse) {
            await this.handleExpectedShutdown(4 /* ShutdownReason.LOAD */);
        }
        const opened = await this.workspaceProvider.open(workspace, options);
        if (!opened) {
            await this.dialogService.prompt({
                type: Severity.Warning,
                message: workspace ?
                    localize('unableToOpenExternalWorkspace', "The browser blocked opening a new tab or window for '{0}'. Press 'Retry' to try again.", this.getRecentLabel(workspace)) :
                    localize('unableToOpenExternal', "The browser blocked opening a new tab or window. Press 'Retry' to try again."),
                custom: {
                    markdownDetails: [{ markdown: new MarkdownString(localize('unableToOpenWindowDetail', "Please allow pop-ups for this website in your [browser settings]({0}).", 'https://aka.ms/allow-vscode-popup'), true) }]
                },
                buttons: [
                    {
                        label: localize({ key: 'retry', comment: ['&& denotes a mnemonic'] }, "&&Retry"),
                        run: () => this.workspaceProvider.open(workspace, options)
                    }
                ],
                cancelButton: true
            });
        }
    }
    async toggleFullScreen(targetWindow) {
        const target = this.layoutService.getContainer(targetWindow);
        // Chromium
        if (targetWindow.document.fullscreen !== undefined) {
            if (!targetWindow.document.fullscreen) {
                try {
                    return await target.requestFullscreen();
                }
                catch (error) {
                    this.logService.warn('toggleFullScreen(): requestFullscreen failed'); // https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen
                }
            }
            else {
                try {
                    return await targetWindow.document.exitFullscreen();
                }
                catch (error) {
                    this.logService.warn('toggleFullScreen(): exitFullscreen failed');
                }
            }
        }
        const webkitDocument = targetWindow.document;
        const webkitElement = target;
        if (webkitDocument.webkitIsFullScreen !== undefined) {
            try {
                if (!webkitDocument.webkitIsFullScreen) {
                    webkitElement.webkitRequestFullscreen(); // it's async, but doesn't return a real promise
                }
                else {
                    webkitDocument.webkitExitFullscreen(); // it's async, but doesn't return a real promise
                }
            }
            catch {
                this.logService.warn('toggleFullScreen(): requestFullscreen/exitFullscreen failed');
            }
        }
    }
    async moveTop(targetWindow) {
        // There seems to be no API to bring a window to front in browsers
    }
    async getCursorScreenPoint() {
        return undefined;
    }
    async getWindows(options) {
        const activeWindow = getActiveWindow();
        const activeWindowId = getWindowId(activeWindow);
        // Main window
        const result = [{
                id: activeWindowId,
                title: activeWindow.document.title,
                workspace: toWorkspaceIdentifier(this.contextService.getWorkspace()),
                dirty: false
            }];
        // Auxiliary windows
        if (options.includeAuxiliaryWindows) {
            for (const { window } of getDOMWindows()) {
                const windowId = getWindowId(window);
                if (windowId !== activeWindowId && isAuxiliaryWindow(window)) {
                    result.push({
                        id: windowId,
                        title: window.document.title,
                        parentId: activeWindowId
                    });
                }
            }
        }
        return result;
    }
    //#endregion
    //#region Lifecycle
    async restart() {
        this.reload();
    }
    async reload() {
        await this.handleExpectedShutdown(3 /* ShutdownReason.RELOAD */);
        mainWindow.location.reload();
    }
    async close() {
        await this.handleExpectedShutdown(1 /* ShutdownReason.CLOSE */);
        mainWindow.close();
    }
    async withExpectedShutdown(expectedShutdownTask) {
        const previousShutdownReason = this.shutdownReason;
        try {
            this.shutdownReason = HostShutdownReason.Api;
            return await expectedShutdownTask();
        }
        finally {
            this.shutdownReason = previousShutdownReason;
        }
    }
    async handleExpectedShutdown(reason) {
        // Update shutdown reason in a way that we do
        // not show a dialog because this is a expected
        // shutdown.
        this.shutdownReason = HostShutdownReason.Api;
        // Signal shutdown reason to lifecycle
        return this.lifecycleService.withExpectedShutdown(reason);
    }
    //#endregion
    //#region Screenshots
    async getScreenshot() {
        // Gets a screenshot from the browser. This gets the screenshot via the browser's display
        // media API which will typically offer a picker of all available screens and windows for
        // the user to select. Using the video stream provided by the display media API, this will
        // capture a single frame of the video and convert it to a JPEG image.
        const store = new DisposableStore();
        // Create a video element to play the captured screen source
        const video = document.createElement('video');
        store.add(toDisposable(() => video.remove()));
        let stream;
        try {
            // Create a stream from the screen source (capture screen without audio)
            stream = await navigator.mediaDevices.getDisplayMedia({
                audio: false,
                video: true
            });
            // Set the stream as the source of the video element
            video.srcObject = stream;
            video.play();
            // Wait for the video to load properly before capturing the screenshot
            await Promise.all([
                new Promise(r => store.add(addDisposableListener(video, 'loadedmetadata', () => r()))),
                new Promise(r => store.add(addDisposableListener(video, 'canplaythrough', () => r())))
            ]);
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return undefined;
            }
            // Draw the portion of the video (x, y) with the specified width and height
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // Convert the canvas to a Blob (JPEG format), use .95 for quality
            const blob = await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95));
            if (!blob) {
                throw new Error('Failed to create blob from canvas');
            }
            const buf = await blob.bytes();
            return VSBuffer.wrap(buf);
        }
        catch (error) {
            console.error('Error taking screenshot:', error);
            return undefined;
        }
        finally {
            store.dispose();
            if (stream) {
                for (const track of stream.getTracks()) {
                    track.stop();
                }
            }
        }
    }
    async getBrowserId() {
        return undefined;
    }
    //#endregion
    //#region Native Handle
    async getNativeWindowHandle(_windowId) {
        return undefined;
    }
};
__decorate([
    memoize
], BrowserHostService.prototype, "onDidChangeFocus", null);
__decorate([
    memoize
], BrowserHostService.prototype, "onDidChangeActiveWindow", null);
__decorate([
    memoize
], BrowserHostService.prototype, "onDidChangeFullScreen", null);
BrowserHostService = __decorate([
    __param(0, ILayoutService),
    __param(1, IConfigurationService),
    __param(2, IFileService),
    __param(3, ILabelService),
    __param(4, IBrowserWorkbenchEnvironmentService),
    __param(5, IInstantiationService),
    __param(6, ILifecycleService),
    __param(7, ILogService),
    __param(8, IDialogService),
    __param(9, IWorkspaceContextService),
    __param(10, IUserDataProfilesService)
], BrowserHostService);
export { BrowserHostService };
registerSingleton(IHostService, BrowserHostService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlckhvc3RTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9ob3N0L2Jyb3dzZXIvYnJvd3Nlckhvc3RTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUN6QyxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN0RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQXdELGNBQWMsRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQThGLE1BQU0sOENBQThDLENBQUM7QUFDalEsT0FBTyxFQUFFLHFCQUFxQixFQUFFLGNBQWMsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ2xGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBRTlELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsYUFBYSxFQUFhLE1BQU0sNENBQTRDLENBQUM7QUFDdEYsT0FBTyxFQUFFLFNBQVMsRUFBRSxrQkFBa0IsRUFBRSxxQkFBcUIsRUFBRSw4QkFBOEIsRUFBRSxnQkFBZ0IsRUFBRSx3QkFBd0IsRUFBRSxpQkFBaUIsRUFBRSxlQUFlLEVBQUUsV0FBVyxFQUFFLG1CQUFtQixFQUFFLFVBQVUsRUFBRSxVQUFVLElBQUksYUFBYSxFQUFFLE1BQU0saUNB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