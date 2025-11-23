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
import '../media/simpleBrowserOverlay.css';
import { combinedDisposable, DisposableMap, DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun, derivedOpts, observableFromEvent, observableSignalFromEvent } from '../../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { localize } from '../../../../../nls.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { EditorGroupView } from '../../../../browser/parts/editor/editorGroupView.js';
import { Event } from '../../../../../base/common/event.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { EditorResourceAccessor, SideBySideEditor } from '../../../../common/editor.js';
import { isEqual, joinPath } from '../../../../../base/common/resources.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { IChatWidgetService } from '../chat.js';
import { Button, ButtonWithDropdown } from '../../../../../base/browser/ui/button/button.js';
import { defaultButtonStyles } from '../../../../../platform/theme/browser/defaultStyles.js';
import { addDisposableListener } from '../../../../../base/browser/dom.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { cleanupOldImages, createFileForMedia } from '../imageUtils.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IPreferencesService } from '../../../../services/preferences/common/preferences.js';
import { IBrowserElementsService } from '../../../../services/browserElements/browser/browserElementsService.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { toAction } from '../../../../../base/common/actions.js';
import { BrowserType } from '../../../../../platform/browserElements/common/browserElements.js';
let SimpleBrowserOverlayWidget = class SimpleBrowserOverlayWidget {
    constructor(_editor, _container, _hostService, _chatWidgetService, fileService, environmentService, logService, configurationService, _preferencesService, _browserElementsService, contextMenuService) {
        this._editor = _editor;
        this._container = _container;
        this._hostService = _hostService;
        this._chatWidgetService = _chatWidgetService;
        this.fileService = fileService;
        this.environmentService = environmentService;
        this.logService = logService;
        this.configurationService = configurationService;
        this._preferencesService = _preferencesService;
        this._browserElementsService = _browserElementsService;
        this.contextMenuService = contextMenuService;
        this._showStore = new DisposableStore();
        this._timeout = undefined;
        this._activeBrowserType = undefined;
        this._showStore.add(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('chat.sendElementsToChat.enabled')) {
                if (this.configurationService.getValue('chat.sendElementsToChat.enabled')) {
                    this.showElement(this._domNode);
                }
                else {
                    this.hideElement(this._domNode);
                }
            }
        }));
        this.imagesFolder = joinPath(this.environmentService.workspaceStorageHome, 'vscode-chat-images');
        cleanupOldImages(this.fileService, this.logService, this.imagesFolder);
        this._domNode = document.createElement('div');
        this._domNode.className = 'element-selection-message';
        const mainContent = document.createElement('div');
        mainContent.className = 'element-selection-main-content';
        const message = document.createElement('span');
        const startSelectionMessage = localize('elementSelectionMessage', 'Add element to chat');
        message.textContent = startSelectionMessage;
        mainContent.appendChild(message);
        let cts;
        const actions = [];
        actions.push(toAction({
            id: 'singleSelection',
            label: localize('selectElementDropdown', 'Select an Element'),
            enabled: true,
            run: async () => { await startElementSelection(); }
        }), toAction({
            id: 'continuousSelection',
            label: localize('continuousSelectionDropdown', 'Continuous Selection'),
            enabled: true,
            run: async () => {
                this._editor.focus();
                cts = new CancellationTokenSource();
                // start selection
                message.textContent = localize('elementSelectionInProgress', 'Selecting element...');
                this.hideElement(startButton.element);
                this.showElement(cancelButton.element);
                cancelButton.label = localize('finishSelectionLabel', 'Done');
                while (!cts.token.isCancellationRequested) {
                    try {
                        await this.addElementToChat(cts);
                    }
                    catch (err) {
                        this.logService.error('Failed to select this element.', err);
                        cts.cancel();
                        break;
                    }
                }
                // stop selection
                message.textContent = localize('elementSelectionComplete', 'Element added to chat');
                finishedSelecting();
            }
        }));
        const startButton = this._showStore.add(new ButtonWithDropdown(mainContent, {
            actions: actions,
            addPrimaryActionToDropdown: false,
            contextMenuProvider: this.contextMenuService,
            supportShortLabel: true,
            title: localize('selectAnElement', 'Click to select an element.'),
            supportIcons: true,
            ...defaultButtonStyles
        }));
        startButton.primaryButton.label = localize('startSelection', 'Start');
        startButton.element.classList.add('element-selection-start');
        const cancelButton = this._showStore.add(new Button(mainContent, { ...defaultButtonStyles, supportIcons: true, title: localize('cancelSelection', 'Click to cancel selection.') }));
        cancelButton.element.className = 'element-selection-cancel hidden';
        const cancelButtonLabel = localize('cancelSelectionLabel', 'Cancel');
        cancelButton.label = cancelButtonLabel;
        const configure = this._showStore.add(new Button(mainContent, { supportIcons: true, title: localize('chat.configureElements', "Configure Attachments Sent") }));
        configure.icon = Codicon.gear;
        const collapseOverlay = this._showStore.add(new Button(mainContent, { supportIcons: true, title: localize('chat.hideOverlay', "Collapse Overlay") }));
        collapseOverlay.icon = Codicon.chevronRight;
        const nextSelection = this._showStore.add(new Button(mainContent, { supportIcons: true, title: localize('chat.nextSelection', "Select Again") }));
        nextSelection.icon = Codicon.close;
        nextSelection.element.classList.add('hidden');
        // shown if the overlay is collapsed
        const expandContainer = document.createElement('div');
        expandContainer.className = 'element-expand-container hidden';
        const expandOverlay = this._showStore.add(new Button(expandContainer, { supportIcons: true, title: localize('chat.expandOverlay', "Expand Overlay") }));
        expandOverlay.icon = Codicon.layout;
        this._domNode.appendChild(mainContent);
        this._domNode.appendChild(expandContainer);
        const resetButtons = () => {
            this.hideElement(nextSelection.element);
            this.showElement(startButton.element);
            this.showElement(collapseOverlay.element);
        };
        const finishedSelecting = () => {
            // stop selection
            this.hideElement(cancelButton.element);
            cancelButton.label = cancelButtonLabel;
            this.hideElement(collapseOverlay.element);
            this.showElement(nextSelection.element);
            // wait 3 seconds before showing the start button again unless cancelled out.
            this._timeout = setTimeout(() => {
                message.textContent = startSelectionMessage;
                resetButtons();
            }, 3000);
        };
        const startElementSelection = async () => {
            cts = new CancellationTokenSource();
            this._editor.focus();
            // start selection
            message.textContent = localize('elementSelectionInProgress', 'Selecting element...');
            this.hideElement(startButton.element);
            this.showElement(cancelButton.element);
            await this.addElementToChat(cts);
            // stop selection
            message.textContent = localize('elementSelectionComplete', 'Element added to chat');
            finishedSelecting();
        };
        this._showStore.add(addDisposableListener(startButton.primaryButton.element, 'click', async () => {
            await startElementSelection();
        }));
        this._showStore.add(addDisposableListener(cancelButton.element, 'click', () => {
            cts.cancel();
            message.textContent = localize('elementCancelMessage', 'Selection canceled');
            finishedSelecting();
        }));
        this._showStore.add(addDisposableListener(collapseOverlay.element, 'click', () => {
            this.hideElement(mainContent);
            this.showElement(expandContainer);
        }));
        this._showStore.add(addDisposableListener(expandOverlay.element, 'click', () => {
            this.showElement(mainContent);
            this.hideElement(expandContainer);
        }));
        this._showStore.add(addDisposableListener(nextSelection.element, 'click', () => {
            clearTimeout(this._timeout);
            message.textContent = startSelectionMessage;
            resetButtons();
        }));
        this._showStore.add(addDisposableListener(configure.element, 'click', () => {
            this._preferencesService.openSettings({ jsonEditor: false, query: '@id:chat.sendElementsToChat.enabled,chat.sendElementsToChat.attachCSS,chat.sendElementsToChat.attachImages' });
        }));
    }
    setActiveBrowserType(type) {
        this._activeBrowserType = type;
    }
    hideElement(element) {
        if (element.classList.contains('hidden')) {
            return;
        }
        element.classList.add('hidden');
    }
    showElement(element) {
        if (!element.classList.contains('hidden')) {
            return;
        }
        element.classList.remove('hidden');
    }
    async addElementToChat(cts) {
        // eslint-disable-next-line no-restricted-syntax
        const editorContainer = this._container.querySelector('.editor-container');
        const editorContainerPosition = editorContainer ? editorContainer.getBoundingClientRect() : this._container.getBoundingClientRect();
        const elementData = await this._browserElementsService.getElementData(editorContainerPosition, cts.token, this._activeBrowserType);
        if (!elementData) {
            throw new Error('Element data not found');
        }
        const bounds = elementData.bounds;
        const toAttach = [];
        const widget = await this._chatWidgetService.revealWidget() ?? this._chatWidgetService.lastFocusedWidget;
        let value = 'Attached HTML and CSS Context\n\n' + elementData.outerHTML;
        if (this.configurationService.getValue('chat.sendElementsToChat.attachCSS')) {
            value += '\n\n' + elementData.computedStyle;
        }
        toAttach.push({
            id: 'element-' + Date.now(),
            name: this.getDisplayNameFromOuterHTML(elementData.outerHTML),
            fullName: this.getDisplayNameFromOuterHTML(elementData.outerHTML),
            value: value,
            kind: 'element',
            icon: ThemeIcon.fromId(Codicon.layout.id),
        });
        if (this.configurationService.getValue('chat.sendElementsToChat.attachImages')) {
            // remove container so we don't block anything on screenshot
            this._domNode.style.display = 'none';
            // Wait 1 extra frame to make sure overlay is gone
            await new Promise(resolve => setTimeout(resolve, 100));
            const screenshot = await this._hostService.getScreenshot(bounds);
            if (!screenshot) {
                throw new Error('Screenshot failed');
            }
            const fileReference = await createFileForMedia(this.fileService, this.imagesFolder, screenshot.buffer, 'image/png');
            toAttach.push({
                id: 'element-screenshot-' + Date.now(),
                name: 'Element Screenshot',
                fullName: 'Element Screenshot',
                kind: 'image',
                value: screenshot.buffer,
                references: fileReference ? [{ reference: fileReference, kind: 'reference' }] : [],
            });
            this._domNode.style.display = '';
        }
        widget?.attachmentModel?.addContext(...toAttach);
    }
    getDisplayNameFromOuterHTML(outerHTML) {
        const firstElementMatch = outerHTML.match(/^<(\w+)([^>]*?)>/);
        if (!firstElementMatch) {
            throw new Error('No outer element found');
        }
        const tagName = firstElementMatch[1];
        const idMatch = firstElementMatch[2].match(/\s+id\s*=\s*["']([^"']+)["']/i);
        const id = idMatch ? `#${idMatch[1]}` : '';
        const classMatch = firstElementMatch[2].match(/\s+class\s*=\s*["']([^"']+)["']/i);
        const className = classMatch ? `.${classMatch[1].replace(/\s+/g, '.')}` : '';
        return `${tagName}${id}${className}`;
    }
    dispose() {
        this._showStore.dispose();
    }
    getDomNode() {
        return this._domNode;
    }
};
SimpleBrowserOverlayWidget = __decorate([
    __param(2, IHostService),
    __param(3, IChatWidgetService),
    __param(4, IFileService),
    __param(5, IEnvironmentService),
    __param(6, ILogService),
    __param(7, IConfigurationService),
    __param(8, IPreferencesService),
    __param(9, IBrowserElementsService),
    __param(10, IContextMenuService)
], SimpleBrowserOverlayWidget);
let SimpleBrowserOverlayController = class SimpleBrowserOverlayController {
    constructor(container, group, instaService, configurationService, _browserElementsService) {
        this.configurationService = configurationService;
        this._browserElementsService = _browserElementsService;
        this._store = new DisposableStore();
        this._domNode = document.createElement('div');
        if (!this.configurationService.getValue('chat.sendElementsToChat.enabled')) {
            return;
        }
        this._domNode.classList.add('chat-simple-browser-overlay');
        this._domNode.style.position = 'absolute';
        this._domNode.style.bottom = `5px`;
        this._domNode.style.right = `5px`;
        this._domNode.style.zIndex = `100`;
        const widget = instaService.createInstance(SimpleBrowserOverlayWidget, group, container);
        this._domNode.appendChild(widget.getDomNode());
        this._store.add(toDisposable(() => this._domNode.remove()));
        this._store.add(widget);
        const connectingWebviewElement = document.createElement('div');
        connectingWebviewElement.className = 'connecting-webview-element';
        const getActiveBrowserType = () => {
            const editor = group.activeEditorPane;
            const isSimpleBrowser = editor?.input.editorId === 'mainThreadWebview-simpleBrowser.view';
            const isLiveServer = editor?.input.editorId === 'mainThreadWebview-browserPreview';
            return isSimpleBrowser ? BrowserType.SimpleBrowser : isLiveServer ? BrowserType.LiveServer : undefined;
        };
        let cts = new CancellationTokenSource();
        const show = async () => {
            // Show the connecting indicator while establishing the session
            connectingWebviewElement.textContent = localize('connectingWebviewElement', 'Connecting to webview...');
            if (!container.contains(connectingWebviewElement)) {
                container.appendChild(connectingWebviewElement);
            }
            cts = new CancellationTokenSource();
            const activeBrowserType = getActiveBrowserType();
            if (activeBrowserType) {
                try {
                    await this._browserElementsService.startDebugSession(cts.token, activeBrowserType);
                }
                catch (error) {
                    connectingWebviewElement.textContent = localize('reopenErrorWebviewElement', 'Please reopen the preview.');
                    return;
                }
            }
            if (!container.contains(this._domNode)) {
                container.appendChild(this._domNode);
            }
            connectingWebviewElement.remove();
        };
        const hide = () => {
            if (container.contains(this._domNode)) {
                cts.cancel();
                this._domNode.remove();
            }
            connectingWebviewElement.remove();
        };
        const activeEditorSignal = observableSignalFromEvent(this, Event.any(group.onDidActiveEditorChange, group.onDidModelChange));
        const activeUriObs = derivedOpts({ equalsFn: isEqual }, r => {
            activeEditorSignal.read(r); // signal
            const editor = group.activeEditorPane;
            const activeBrowser = getActiveBrowserType();
            widget.setActiveBrowserType(activeBrowser);
            if (activeBrowser) {
                const uri = EditorResourceAccessor.getOriginalUri(editor?.input, { supportSideBySide: SideBySideEditor.PRIMARY });
                return uri;
            }
            return undefined;
        });
        this._store.add(autorun(r => {
            const data = activeUriObs.read(r);
            if (!data) {
                hide();
                return;
            }
            show();
        }));
    }
    dispose() {
        this._store.dispose();
    }
};
SimpleBrowserOverlayController = __decorate([
    __param(2, IInstantiationService),
    __param(3, IConfigurationService),
    __param(4, IBrowserElementsService)
], SimpleBrowserOverlayController);
let SimpleBrowserOverlay = class SimpleBrowserOverlay {
    static { this.ID = 'chat.simpleBrowser.overlay'; }
    constructor(editorGroupsService, instantiationService) {
        this._store = new DisposableStore();
        const editorGroups = observableFromEvent(this, Event.any(editorGroupsService.onDidAddGroup, editorGroupsService.onDidRemoveGroup), () => editorGroupsService.groups);
        const overlayWidgets = new DisposableMap();
        this._store.add(autorun(r => {
            const toDelete = new Set(overlayWidgets.keys());
            const groups = editorGroups.read(r);
            for (const group of groups) {
                if (!(group instanceof EditorGroupView)) {
                    // TODO@jrieken better with https://github.com/microsoft/vscode/tree/ben/layout-group-container
                    continue;
                }
                toDelete.delete(group); // we keep the widget for this group!
                if (!overlayWidgets.has(group)) {
                    const scopedInstaService = instantiationService.createChild(new ServiceCollection([IContextKeyService, group.scopedContextKeyService]));
                    const container = group.element;
                    const ctrl = scopedInstaService.createInstance(SimpleBrowserOverlayController, container, group);
                    overlayWidgets.set(group, combinedDisposable(ctrl, scopedInstaService));
                }
            }
            for (const group of toDelete) {
                overlayWidgets.deleteAndDispose(group);
            }
        }));
    }
    dispose() {
        this._store.dispose();
    }
};
SimpleBrowserOverlay = __decorate([
    __param(0, IEditorGroupsService),
    __param(1, IInstantiationService)
], SimpleBrowserOverlay);
export { SimpleBrowserOverlay };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2ltcGxlQnJvd3NlckVkaXRvck92ZXJsYXkuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRFZGl0aW5nL3NpbXBsZUJyb3dzZXJFZGl0b3JPdmVybGF5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sbUNBQW1DLENBQUM7QUFDM0MsT0FBTyxFQUFFLGtCQUFrQixFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDM0gsT0FBTyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsbUJBQW1CLEVBQUUseUJBQXlCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNoSSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDcEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUVqRCxPQUFPLEVBQWdCLG9CQUFvQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDL0csT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUN0RyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM3RixPQUFPLEVBQUUsc0JBQXNCLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUN4RixPQUFPLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxN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