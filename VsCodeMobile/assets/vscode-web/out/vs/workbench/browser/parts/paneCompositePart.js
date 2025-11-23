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
var AbstractPaneCompositePart_1;
import './media/paneCompositePart.css';
import { Event } from '../../../base/common/event.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { Extensions } from '../panecomposite.js';
import { IViewDescriptorService } from '../../common/views.js';
import { DisposableStore, MutableDisposable } from '../../../base/common/lifecycle.js';
import { IWorkbenchLayoutService } from '../../services/layout/browser/layoutService.js';
import { CompositePart } from './compositePart.js';
import { PaneCompositeBar } from './paneCompositeBar.js';
import { Dimension, EventHelper, trackFocus, $, addDisposableListener, EventType, prepend, getWindow } from '../../../base/browser/dom.js';
import { Registry } from '../../../platform/registry/common/platform.js';
import { INotificationService } from '../../../platform/notification/common/notification.js';
import { IStorageService } from '../../../platform/storage/common/storage.js';
import { IContextMenuService } from '../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../platform/keybinding/common/keybinding.js';
import { IThemeService } from '../../../platform/theme/common/themeService.js';
import { IContextKeyService } from '../../../platform/contextkey/common/contextkey.js';
import { IExtensionService } from '../../services/extensions/common/extensions.js';
import { localize } from '../../../nls.js';
import { CompositeDragAndDropObserver, toggleDropEffect } from '../dnd.js';
import { EDITOR_DRAG_AND_DROP_BACKGROUND } from '../../common/theme.js';
import { IMenuService, MenuId } from '../../../platform/actions/common/actions.js';
import { Gesture, EventType as GestureEventType } from '../../../base/browser/touch.js';
import { StandardMouseEvent } from '../../../base/browser/mouseEvent.js';
import { SubmenuAction } from '../../../base/common/actions.js';
import { ViewsSubMenu } from './views/viewPaneContainer.js';
import { getActionBarActions } from '../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IHoverService } from '../../../platform/hover/browser/hover.js';
import { MenuWorkbenchToolBar } from '../../../platform/actions/browser/toolbar.js';
import { DeferredPromise } from '../../../base/common/async.js';
export var CompositeBarPosition;
(function (CompositeBarPosition) {
    CompositeBarPosition[CompositeBarPosition["TOP"] = 0] = "TOP";
    CompositeBarPosition[CompositeBarPosition["TITLE"] = 1] = "TITLE";
    CompositeBarPosition[CompositeBarPosition["BOTTOM"] = 2] = "BOTTOM";
})(CompositeBarPosition || (CompositeBarPosition = {}));
let AbstractPaneCompositePart = class AbstractPaneCompositePart extends CompositePart {
    static { AbstractPaneCompositePart_1 = this; }
    static { this.MIN_COMPOSITE_BAR_WIDTH = 50; }
    get snap() {
        // Always allow snapping closed
        // Only allow dragging open if the panel contains view containers
        return this.layoutService.isVisible(this.partId) || !!this.paneCompositeBar.value?.getVisiblePaneCompositeIds().length;
    }
    get onDidPaneCompositeOpen() { return Event.map(this.onDidCompositeOpen.event, compositeEvent => compositeEvent.composite); }
    constructor(partId, partOptions, activePaneCompositeSettingsKey, activePaneContextKey, paneFocusContextKey, nameForTelemetry, compositeCSSClass, titleForegroundColor, titleBorderColor, notificationService, storageService, contextMenuService, layoutService, keybindingService, hoverService, instantiationService, themeService, viewDescriptorService, contextKeyService, extensionService, menuService) {
        let location = 0 /* ViewContainerLocation.Sidebar */;
        let registryId = Extensions.Viewlets;
        let globalActionsMenuId = MenuId.SidebarTitle;
        if (partId === "workbench.parts.panel" /* Parts.PANEL_PART */) {
            location = 1 /* ViewContainerLocation.Panel */;
            registryId = Extensions.Panels;
            globalActionsMenuId = MenuId.PanelTitle;
        }
        else if (partId === "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */) {
            location = 2 /* ViewContainerLocation.AuxiliaryBar */;
            registryId = Extensions.Auxiliary;
            globalActionsMenuId = MenuId.AuxiliaryBarTitle;
        }
        super(notificationService, storageService, contextMenuService, layoutService, keybindingService, hoverService, instantiationService, themeService, Registry.as(registryId), activePaneCompositeSettingsKey, viewDescriptorService.getDefaultViewContainer(location)?.id || '', nameForTelemetry, compositeCSSClass, titleForegroundColor, titleBorderColor, partId, partOptions);
        this.partId = partId;
        this.activePaneContextKey = activePaneContextKey;
        this.paneFocusContextKey = paneFocusContextKey;
        this.viewDescriptorService = viewDescriptorService;
        this.contextKeyService = contextKeyService;
        this.extensionService = extensionService;
        this.menuService = menuService;
        this.onDidPaneCompositeClose = this.onDidCompositeClose.event;
        this.headerFooterCompositeBarDispoables = this._register(new DisposableStore());
        this.paneCompositeBar = this._register(new MutableDisposable());
        this.compositeBarPosition = undefined;
        this.blockOpening = undefined;
        this.location = location;
        this.globalActionsMenuId = globalActionsMenuId;
        this.registerListeners();
    }
    registerListeners() {
        this._register(this.onDidPaneCompositeOpen(composite => this.onDidOpen(composite)));
        this._register(this.onDidPaneCompositeClose(this.onDidClose, this));
        this._register(this.registry.onDidDeregister((viewletDescriptor) => {
            const activeContainers = this.viewDescriptorService.getViewContainersByLocation(this.location)
                .filter(container => this.viewDescriptorService.getViewContainerModel(container).activeViewDescriptors.length > 0);
            if (activeContainers.length) {
                if (this.getActiveComposite()?.getId() === viewletDescriptor.id) {
                    const defaultViewletId = this.viewDescriptorService.getDefaultViewContainer(this.location)?.id;
                    const containerToOpen = activeContainers.filter(c => c.id === defaultViewletId)[0] || activeContainers[0];
                    this.doOpenPaneComposite(containerToOpen.id);
                }
            }
            else {
                this.layoutService.setPartHidden(true, this.partId);
            }
            this.removeComposite(viewletDescriptor.id);
        }));
        this._register(this.extensionService.onDidRegisterExtensions(() => {
            this.layoutCompositeBar();
        }));
    }
    onDidOpen(composite) {
        this.activePaneContextKey.set(composite.getId());
    }
    onDidClose(composite) {
        const id = composite.getId();
        if (this.activePaneContextKey.get() === id) {
            this.activePaneContextKey.reset();
        }
    }
    showComposite(composite) {
        super.showComposite(composite);
        this.layoutCompositeBar();
        this.layoutEmptyMessage();
    }
    hideActiveComposite() {
        const composite = super.hideActiveComposite();
        this.layoutCompositeBar();
        this.layoutEmptyMessage();
        return composite;
    }
    create(parent) {
        this.element = parent;
        this.element.classList.add('pane-composite-part');
        super.create(parent);
        if (this.contentArea) {
            this.createEmptyPaneMessage(this.contentArea);
        }
        this.updateCompositeBar();
        const focusTracker = this._register(trackFocus(parent));
        this._register(focusTracker.onDidFocus(() => this.paneFocusContextKey.set(true)));
        this._register(focusTracker.onDidBlur(() => this.paneFocusContextKey.set(false)));
    }
    createEmptyPaneMessage(parent) {
        this.emptyPaneMessageElement = $('.empty-pane-message-area');
        const messageElement = $('.empty-pane-message');
        messageElement.textContent = localize('pane.emptyMessage', "Drag a view here to display.");
        this.emptyPaneMessageElement.appendChild(messageElement);
        parent.appendChild(this.emptyPaneMessageElement);
        const setDropBackgroundFeedback = (visible) => {
            const updateActivityBarBackground = !this.getActiveComposite() || !visible;
            const backgroundColor = visible ? this.theme.getColor(EDITOR_DRAG_AND_DROP_BACKGROUND)?.toString() || '' : '';
            if (this.titleContainer && updateActivityBarBackground) {
                this.titleContainer.style.backgroundColor = backgroundColor;
            }
            if (this.headerFooterCompositeBarContainer && updateActivityBarBackground) {
                this.headerFooterCompositeBarContainer.style.backgroundColor = backgroundColor;
            }
            this.emptyPaneMessageElement.style.backgroundColor = backgroundColor;
        };
        this._register(CompositeDragAndDropObserver.INSTANCE.registerTarget(this.element, {
            onDragOver: (e) => {
                EventHelper.stop(e.eventData, true);
                if (this.paneCompositeBar.value) {
                    const validDropTarget = this.paneCompositeBar.value.dndHandler.onDragEnter(e.dragAndDropData, undefined, e.eventData);
                    toggleDropEffect(e.eventData.dataTransfer, 'move', validDropTarget);
                }
            },
            onDragEnter: (e) => {
                EventHelper.stop(e.eventData, true);
                if (this.paneCompositeBar.value) {
                    const validDropTarget = this.paneCompositeBar.value.dndHandler.onDragEnter(e.dragAndDropData, undefined, e.eventData);
                    setDropBackgroundFeedback(validDropTarget);
                }
            },
            onDragLeave: (e) => {
                EventHelper.stop(e.eventData, true);
                setDropBackgroundFeedback(false);
            },
            onDragEnd: (e) => {
                EventHelper.stop(e.eventData, true);
                setDropBackgroundFeedback(false);
            },
            onDrop: (e) => {
                EventHelper.stop(e.eventData, true);
                setDropBackgroundFeedback(false);
                if (this.paneCompositeBar.value) {
                    this.paneCompositeBar.value.dndHandler.drop(e.dragAndDropData, undefined, e.eventData);
                }
                else {
                    // Allow opening views/composites if the composite bar is hidden
                    const dragData = e.dragAndDropData.getData();
                    if (dragData.type === 'composite') {
                        const currentContainer = this.viewDescriptorService.getViewContainerById(dragData.id);
                        this.viewDescriptorService.moveViewContainerToLocation(currentContainer, this.location, undefined, 'dnd');
                        this.openPaneComposite(currentContainer.id, true);
                    }
                    else if (dragData.type === 'view') {
                        const viewToMove = this.viewDescriptorService.getViewDescriptorById(dragData.id);
                        if (viewToMove.canMoveView) {
                            this.viewDescriptorService.moveViewToLocation(viewToMove, this.location, 'dnd');
                            const newContainer = this.viewDescriptorService.getViewContainerByViewId(viewToMove.id);
                            this.openPaneComposite(newContainer.id, true).then(composite => {
                                composite?.openView(viewToMove.id, true);
                            });
                        }
                    }
                }
            },
        }));
    }
    createTitleArea(parent) {
        const titleArea = super.createTitleArea(parent);
        this._register(addDisposableListener(titleArea, EventType.CONTEXT_MENU, e => {
            this.onTitleAreaContextMenu(new StandardMouseEvent(getWindow(titleArea), e));
        }));
        this._register(Gesture.addTarget(titleArea));
        this._register(addDisposableListener(titleArea, GestureEventType.Contextmenu, e => {
            this.onTitleAreaContextMenu(new StandardMouseEvent(getWindow(titleArea), e));
        }));
        const globalTitleActionsContainer = titleArea.appendChild($('.global-actions'));
        // Global Actions Toolbar
        this.globalToolBar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, globalTitleActionsContainer, this.globalActionsMenuId, {
            actionViewItemProvider: (action, options) => this.actionViewItemProvider(action, options),
            orientation: 0 /* ActionsOrientation.HORIZONTAL */,
            getKeyBinding: action => this.keybindingService.lookupKeybinding(action.id),
            anchorAlignmentProvider: () => this.getTitleAreaDropDownAnchorAlignment(),
            toggleMenuTitle: localize('moreActions', "More Actions..."),
            hoverDelegate: this.toolbarHoverDelegate,
            hiddenItemStrategy: -1 /* HiddenItemStrategy.NoHide */,
            highlightToggledItems: true,
            telemetrySource: this.nameForTelemetry
        }));
        return titleArea;
    }
    createTitleLabel(parent) {
        this.titleContainer = parent;
        const titleLabel = super.createTitleLabel(parent);
        this.titleLabelElement.draggable = true;
        const draggedItemProvider = () => {
            const activeViewlet = this.getActivePaneComposite();
            return { type: 'composite', id: activeViewlet.getId() };
        };
        this._register(CompositeDragAndDropObserver.INSTANCE.registerDraggable(this.titleLabelElement, draggedItemProvider, {}));
        return titleLabel;
    }
    updateCompositeBar(updateCompositeBarOption = false) {
        const wasCompositeBarVisible = this.compositeBarPosition !== undefined;
        const isCompositeBarVisible = this.shouldShowCompositeBar();
        const previousPosition = this.compositeBarPosition;
        const newPosition = isCompositeBarVisible ? this.getCompositeBarPosition() : undefined;
        // Only update if the visibility or position has changed or if the composite bar options should be updated
        if (!updateCompositeBarOption && previousPosition === newPosition) {
            return;
        }
        // Remove old composite bar
        if (wasCompositeBarVisible) {
            const previousCompositeBarContainer = previousPosition === CompositeBarPosition.TITLE ? this.titleContainer : this.headerFooterCompositeBarContainer;
            if (!this.paneCompositeBarContainer || !this.paneCompositeBar.value || !previousCompositeBarContainer) {
                throw new Error('Composite bar containers should exist when removing the previous composite bar');
            }
            this.paneCompositeBarContainer.remove();
            this.paneCompositeBarContainer = undefined;
            this.paneCompositeBar.value = undefined;
            previousCompositeBarContainer.classList.remove('has-composite-bar');
            if (previousPosition === CompositeBarPosition.TOP) {
                this.removeFooterHeaderArea(true);
            }
            else if (previousPosition === CompositeBarPosition.BOTTOM) {
                this.removeFooterHeaderArea(false);
            }
        }
        // Create new composite bar
        let newCompositeBarContainer;
        switch (newPosition) {
            case CompositeBarPosition.TOP:
                newCompositeBarContainer = this.createHeaderArea();
                break;
            case CompositeBarPosition.TITLE:
                newCompositeBarContainer = this.titleContainer;
                break;
            case CompositeBarPosition.BOTTOM:
                newCompositeBarContainer = this.createFooterArea();
                break;
        }
        if (isCompositeBarVisible) {
            if (this.paneCompositeBarContainer || this.paneCompositeBar.value || !newCompositeBarContainer) {
                throw new Error('Invalid composite bar state when creating the new composite bar');
            }
            newCompositeBarContainer.classList.add('has-composite-bar');
            this.paneCompositeBarContainer = prepend(newCompositeBarContainer, $('.composite-bar-container'));
            this.paneCompositeBar.value = this.createCompositeBar();
            this.paneCompositeBar.value.create(this.paneCompositeBarContainer);
            if (newPosition === CompositeBarPosition.TOP) {
                this.setHeaderArea(newCompositeBarContainer);
            }
            else if (newPosition === CompositeBarPosition.BOTTOM) {
                this.setFooterArea(newCompositeBarContainer);
            }
        }
        this.compositeBarPosition = newPosition;
        if (updateCompositeBarOption) {
            this.layoutCompositeBar();
        }
    }
    createHeaderArea() {
        const headerArea = super.createHeaderArea();
        return this.createHeaderFooterCompositeBarArea(headerArea);
    }
    createFooterArea() {
        const footerArea = super.createFooterArea();
        return this.createHeaderFooterCompositeBarArea(footerArea);
    }
    createHeaderFooterCompositeBarArea(area) {
        if (this.headerFooterCompositeBarContainer) {
            // A pane composite part has either a header or a footer, but not both
            throw new Error('Header or Footer composite bar already exists');
        }
        this.headerFooterCompositeBarContainer = area;
        this.headerFooterCompositeBarDispoables.add(addDisposableListener(area, EventType.CONTEXT_MENU, e => {
            this.onCompositeBarAreaContextMenu(new StandardMouseEvent(getWindow(area), e));
        }));
        this.headerFooterCompositeBarDispoables.add(Gesture.addTarget(area));
        this.headerFooterCompositeBarDispoables.add(addDisposableListener(area, GestureEventType.Contextmenu, e => {
            this.onCompositeBarAreaContextMenu(new StandardMouseEvent(getWindow(area), e));
        }));
        return area;
    }
    removeFooterHeaderArea(header) {
        this.headerFooterCompositeBarContainer = undefined;
        this.headerFooterCompositeBarDispoables.clear();
        if (header) {
            this.removeHeaderArea();
        }
        else {
            this.removeFooterArea();
        }
    }
    createCompositeBar() {
        return this.instantiationService.createInstance(PaneCompositeBar, this.getCompositeBarOptions(), this.partId, this);
    }
    onTitleAreaUpdate(compositeId) {
        super.onTitleAreaUpdate(compositeId);
        // If title actions change, relayout the composite bar
        this.layoutCompositeBar();
    }
    async openPaneComposite(id, focus) {
        if (typeof id === 'string' && this.getPaneComposite(id)) {
            return this.doOpenPaneComposite(id, focus);
        }
        await this.extensionService.whenInstalledExtensionsRegistered();
        if (typeof id === 'string' && this.getPaneComposite(id)) {
            return this.doOpenPaneComposite(id, focus);
        }
        return undefined;
    }
    async doOpenPaneComposite(id, focus) {
        if (this.blockOpening) {
            // Workaround against a potential race condition when calling
            // `setPartHidden` we may end up in `openPaneComposite` again.
            // But we still want to return the result of the original call,
            // so we return the promise of the original call.
            return this.blockOpening.p;
        }
        let blockOpening;
        if (!this.layoutService.isVisible(this.partId)) {
            try {
                blockOpening = this.blockOpening = new DeferredPromise();
                this.layoutService.setPartHidden(false, this.partId);
            }
            finally {
                this.blockOpening = undefined;
            }
        }
        try {
            const result = this.openComposite(id, focus);
            blockOpening?.complete(result);
            return result;
        }
        catch (error) {
            blockOpening?.error(error);
            throw error;
        }
    }
    getPaneComposite(id) {
        return this.registry.getPaneComposite(id);
    }
    getPaneComposites() {
        return this.registry.getPaneComposites()
            .sort((v1, v2) => {
            if (typeof v1.order !== 'number') {
                return 1;
            }
            if (typeof v2.order !== 'number') {
                return -1;
            }
            return v1.order - v2.order;
        });
    }
    getPinnedPaneCompositeIds() {
        return this.paneCompositeBar.value?.getPinnedPaneCompositeIds() ?? [];
    }
    getVisiblePaneCompositeIds() {
        return this.paneCompositeBar.value?.getVisiblePaneCompositeIds() ?? [];
    }
    getPaneCompositeIds() {
        return this.paneCompositeBar.value?.getPaneCompositeIds() ?? [];
    }
    getActivePaneComposite() {
        return this.getActiveComposite();
    }
    getLastActivePaneCompositeId() {
        return this.getLastActiveCompositeId();
    }
    hideActivePaneComposite() {
        if (this.layoutService.isVisible(this.partId)) {
            this.layoutService.setPartHidden(true, this.partId);
        }
        this.hideActiveComposite();
    }
    focusCompositeBar() {
        this.paneCompositeBar.value?.focus();
    }
    layout(width, height, top, left) {
        if (!this.layoutService.isVisible(this.partId)) {
            return;
        }
        this.contentDimension = new Dimension(width, height);
        // Layout contents
        super.layout(this.contentDimension.width, this.contentDimension.height, top, left);
        // Layout composite bar
        this.layoutCompositeBar();
        // Add empty pane message
        this.layoutEmptyMessage();
    }
    layoutCompositeBar() {
        if (this.contentDimension && this.dimension && this.paneCompositeBar.value) {
            const padding = this.compositeBarPosition === CompositeBarPosition.TITLE ? 16 : 8;
            const borderWidth = this.partId === "workbench.parts.panel" /* Parts.PANEL_PART */ ? 0 : 1;
            let availableWidth = this.contentDimension.width - padding - borderWidth;
            availableWidth = Math.max(AbstractPaneCompositePart_1.MIN_COMPOSITE_BAR_WIDTH, availableWidth - this.getToolbarWidth());
            this.paneCompositeBar.value.layout(availableWidth, this.dimension.height);
        }
    }
    layoutEmptyMessage() {
        const visible = !this.getActiveComposite();
        this.element.classList.toggle('empty', visible);
        if (visible) {
            this.titleLabel?.updateTitle('', '');
        }
    }
    getToolbarWidth() {
        if (!this.toolBar || this.compositeBarPosition !== CompositeBarPosition.TITLE) {
            return 0;
        }
        const activePane = this.getActivePaneComposite();
        if (!activePane) {
            return 0;
        }
        // Each toolbar item has 4px margin
        const toolBarWidth = this.toolBar.getItemsWidth() + this.toolBar.getItemsLength() * 4;
        const globalToolBarWidth = this.globalToolBar ? this.globalToolBar.getItemsWidth() + this.globalToolBar.getItemsLength() * 4 : 0;
        return toolBarWidth + globalToolBarWidth + 8; // 8px padding left
    }
    onTitleAreaContextMenu(event) {
        if (this.shouldShowCompositeBar() && this.getCompositeBarPosition() === CompositeBarPosition.TITLE) {
            return this.onCompositeBarContextMenu(event);
        }
        else {
            const activePaneComposite = this.getActivePaneComposite();
            const activePaneCompositeActions = activePaneComposite ? activePaneComposite.getContextMenuActions() : [];
            if (activePaneCompositeActions.length) {
                this.contextMenuService.showContextMenu({
                    getAnchor: () => event,
                    getActions: () => activePaneCompositeActions,
                    getActionViewItem: (action, options) => this.actionViewItemProvider(action, options),
                    actionRunner: activePaneComposite.getActionRunner(),
                    skipTelemetry: true
                });
            }
        }
    }
    onCompositeBarAreaContextMenu(event) {
        return this.onCompositeBarContextMenu(event);
    }
    onCompositeBarContextMenu(event) {
        if (this.paneCompositeBar.value) {
            const actions = [...this.paneCompositeBar.value.getContextMenuActions()];
            if (actions.length) {
                this.contextMenuService.showContextMenu({
                    getAnchor: () => event,
                    getActions: () => actions,
                    skipTelemetry: true
                });
            }
        }
    }
    getViewsSubmenuAction() {
        const viewPaneContainer = this.getActivePaneComposite()?.getViewPaneContainer();
        if (viewPaneContainer) {
            const disposables = new DisposableStore();
            const scopedContextKeyService = disposables.add(this.contextKeyService.createScoped(this.element));
            scopedContextKeyService.createKey('viewContainer', viewPaneContainer.viewContainer.id);
            const menu = this.menuService.getMenuActions(ViewsSubMenu, scopedContextKeyService, { shouldForwardArgs: true, renderShortTitle: true });
            const viewsActions = getActionBarActions(menu, () => true).primary;
            disposables.dispose();
            return viewsActions.length > 1 && viewsActions.some(a => a.enabled) ? new SubmenuAction('views', localize('views', "Views"), viewsActions) : undefined;
        }
        return undefined;
    }
};
AbstractPaneCompositePart = AbstractPaneCompositePart_1 = __decorate([
    __param(9, INotificationService),
    __param(10, IStorageService),
    __param(11, IContextMenuService),
    __param(12, IWorkbenchLayoutService),
    __param(13, IKeybindingService),
    __param(14, IHoverService),
    __param(15, IInstantiationService),
    __param(16, IThemeService),
    __param(17, IViewDescriptorService),
    __param(18, IContextKeyService),
    __param(19, IExtensionService),
    __param(20, IMenuService)
], AbstractPaneCompositePart);
export { AbstractPaneCompositePart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFuZUNvbXBvc2l0ZVBhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2Jyb3dzZXIvcGFydHMvcGFuZUNvbXBvc2l0ZVBhcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sK0JBQStCLENBQUM7QUFDdkMsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3RELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQWlFLE1BQU0scUJBQXFCLENBQUM7QUFFaEgsT0FBTyxFQUFFLHNCQUFzQixFQUF5QixNQUFNLHVCQUF1QixDQUFDO0FBQ3RGLE9BQU8sRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUV2RixPQUFPLEVBQUUsdUJBQXVCLEVBQVMsTUFBTSxnREFBZ0QsQ0FBQztBQUNoRyxPQUFPLEVBQUUsYUFBYSxFQUErQyxNQUFNLG9CQUFvQixDQUFDO0FBQ2hHLE9BQU8sRUFBNEIsZ0JBQWdCLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNuRixPQUFPLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLHFCQUFxQixFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDM0ksT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMzRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUN2RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDL0UsT0FBTyxFQUFlLGtCQUFrQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDcEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFFbkYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzNDLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUMzRSxPQUFPLEVBQUUsK0JBQStCLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUN4RSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRW5GLE9BQU8sRUFBRSxPQUFPLEVBQUUsU0FBUyxJQUFJLGdCQUFnQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDeEYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDekUsT0FBTyxFQUFXLGFBQWEsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRXpFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDekUsT0FBTyxFQUFzQixvQkFBb0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3hHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUVoRSxNQUFNLENBQU4sSUFBWSxvQkFJWDtBQUpELFdBQVksb0JBQW9CO0lBQy9CLDZEQUFHLENBQUE7SUFDSCxpRUFBSyxDQUFBO0lBQ0wsbUVBQU0sQ0FBQTtBQUNQLENBQUMsRUFKVyxvQkFBb0IsS0FBcEIsb0JBQW9CLFFBSS9CO0FBNERNLElBQWUseUJBQXlCLEdBQXhDLE1BQWUseUJBQTBCLFNBQVEsYUFBNEI7O2FBRTNELDRCQUF1QixHQUFHLEVBQUUsQUFBTCxDQUFNO0lBRXJELElBQUksSUFBSTtRQUNQLCtCQUErQjtRQUMvQixpRUFBaUU7UUFDakUsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsMEJBQTBCLEVBQUUsQ0FBQyxNQUFNLENBQUM7SUFDeEgsQ0FBQztJQUVELElBQUksc0JBQXNCLEtBQTRCLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxFQUFFLENBQWlCLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFrQnBLLFlBQ1UsTUFBdUUsRUFDaEYsV0FBa0MsRUFDbEMsOEJBQXNDLEVBQ3JCLG9CQUF5QyxFQUNsRCxtQkFBeUMsRUFDakQsZ0JBQXdCLEVBQ3hCLGlCQUF5QixFQUN6QixvQkFBd0MsRUFDeEMsZ0JBQW9DLEVBQ2QsbUJBQXlDLEVBQzlDLGNBQStCLEVBQzNCLGtCQUF1QyxFQUNuQyxhQUFzQyxFQUMzQyxpQkFBcUMsRUFDMUMsWUFBMkIsRUFDbkIsb0JBQTJDLEVBQ25ELFlBQTJCLEVBQ2xCLHFCQUE4RCxFQUNsRSxpQkFBd0QsRUFDekQsZ0JBQW9ELEVBQ3pELFdBQTRDO1FBRTFELElBQUksUUFBUSx3Q0FBZ0MsQ0FBQztRQUM3QyxJQUFJLFVBQVUsR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDO1FBQ3JDLElBQUksbUJBQW1CLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQztRQUM5QyxJQUFJLE1BQU0sbURBQXFCLEVBQUUsQ0FBQztZQUNqQyxRQUFRLHNDQUE4QixDQUFDO1lBQ3ZDLFVBQVUsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDO1lBQy9CLG1CQUFtQixHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUM7UUFDekMsQ0FBQzthQUFNLElBQUksTUFBTSxpRUFBNEIsRUFBRSxDQUFDO1lBQy9DLFFBQVEsNkNBQXFDLENBQUM7WUFDOUMsVUFBVSxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUM7WUFDbEMsbUJBQW1CLEdBQUcsTUFBTSxDQUFDLGlCQUFpQixDQUFDO1FBQ2hELENBQUM7UUFDRCxLQUFLLENBQ0osbUJBQW1CLEVBQ25CLGNBQWMsRUFDZCxrQkFBa0IsRUFDbEIsYUFBYSxFQUNiLGlCQUFpQixFQUNqQixZQUFZLEVBQ1osb0JBQW9CLEVBQ3BCLFlBQVksRUFDWixRQUFRLENBQUMsRUFBRSxDQUF3QixVQUFVLENBQUMsRUFDOUMsOEJBQThCLEVBQzlCLHFCQUFxQixDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQ2pFLGdCQUFnQixFQUNoQixpQkFBaUIsRUFDakIsb0JBQW9CLEVBQ3BCLGdCQUFnQixFQUNoQixNQUFNLEVBQ04sV0FBVyxDQUNYLENBQUM7UUFwRE8sV0FBTSxHQUFOLE1BQU0sQ0FBaUU7UUFHL0QseUJBQW9CLEdBQXBCLG9CQUFvQixDQUFxQjtRQUNsRCx3QkFBbUIsR0FBbkIsbUJBQW1CLENBQXNCO1FBYVIsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF3QjtRQUMvQyxzQkFBaUIsR0FBakIsaUJBQWlCLENBQW9CO1FBQ3hDLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBbUI7UUFDdEMsZ0JBQVcsR0FBWCxXQUFXLENBQWM7UUF0Q2xELDRCQUF1QixHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUE4QixDQUFDO1FBS3hFLHVDQUFrQyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxlQUFlLEVBQUUsQ0FBQyxDQUFDO1FBRTdFLHFCQUFnQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxpQkFBaUIsRUFBb0IsQ0FBQyxDQUFDO1FBQ3RGLHlCQUFvQixHQUFxQyxTQUFTLENBQUM7UUFNbkUsaUJBQVksR0FBMkQsU0FBUyxDQUFDO1FBMER4RixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsbUJBQW1CLEdBQUcsbUJBQW1CLENBQUM7UUFDL0MsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7SUFDMUIsQ0FBQztJQUVPLGlCQUFpQjtRQUN4QixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BGLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUVwRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLENBQUMsaUJBQTBDLEVBQUUsRUFBRTtZQUUzRixNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO2lCQUM1RixNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMscUJBQXFCLENBQUMsU0FBUyxDQUFDLENBQUMscUJBQXFCLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBRXBILElBQUksZ0JBQWdCLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQzdCLElBQUksSUFBSSxDQUFDLGtCQUFrQixFQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssaUJBQWlCLENBQUMsRUFBRSxFQUFFLENBQUM7b0JBQ2pFLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLENBQUM7b0JBQy9GLE1BQU0sZUFBZSxHQUFHLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDMUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDOUMsQ0FBQztZQUNGLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3JELENBQUM7WUFFRCxJQUFJLENBQUMsZUFBZSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzVDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLEVBQUU7WUFDakUsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDM0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyxTQUFTLENBQUMsU0FBcUI7UUFDdEMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUNsRCxDQUFDO0lBRU8sVUFBVSxDQUFDLFNBQXFCO1FBQ3ZDLE1BQU0sRUFBRSxHQUFHLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3QixJQUFJLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQztZQUM1QyxJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDbkMsQ0FBQztJQUNGLENBQUM7SUFFa0IsYUFBYSxDQUFDLFNBQW9CO1FBQ3BELEtBQUssQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDL0IsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7SUFDM0IsQ0FBQztJQUVrQixtQkFBbUI7UUFDckMsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLG1CQUFtQixFQUFFLENBQUM7UUFDOUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDMUIsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVRLE1BQU0sQ0FBQyxNQUFtQjtRQUNsQyxJQUFJLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQztRQUN0QixJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUVsRCxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRXJCLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3RCLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDL0MsQ0FBQztRQUVELElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBRTFCLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDeEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xGLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNuRixDQUFDO0lBRU8sc0JBQXNCLENBQUMsTUFBbUI7UUFDakQsSUFBSSxDQUFDLHVCQUF1QixHQUFHLENBQUMsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO1FBRTdELE1BQU0sY0FBYyxHQUFHLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBQ2hELGNBQWMsQ0FBQyxXQUFXLEdBQUcsUUFBUSxDQUFDLG1CQUFtQixFQUFFLDhCQUE4QixDQUFDLENBQUM7UUFFM0YsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUN6RCxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBRWpELE1BQU0seUJBQXlCLEdBQUcsQ0FBQyxPQUFnQixFQUFFLEVBQUU7WUFDdEQsTUFBTSwyQkFBMkIsR0FBRyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDO1lBQzNFLE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsK0JBQStCLENBQUMsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUU5RyxJQUFJLElBQUksQ0FBQyxjQUFjLElBQUksMkJBQTJCLEVBQUUsQ0FBQztnQkFDeEQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLGVBQWUsQ0FBQztZQUM3RCxDQUFDO1lBQ0QsSUFBSSxJQUFJLENBQUMsaUNBQWlDLElBQUksMkJBQTJCLEVBQUUsQ0FBQztnQkFDM0UsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsZUFBZSxDQUFDO1lBQ2hGLENBQUM7WUFFRCxJQUFJLENBQUMsdUJBQXdCLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7UUFDdkUsQ0FBQyxDQUFDO1FBRUYsSUFBSSxDQUFDLFNBQVMsQ0FBQyw0QkFBNEIsQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDakYsVUFBVSxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUU7Z0JBQ2pCLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDcEMsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLENBQUM7b0JBQ2pDLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsZUFBZSxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7b0JBQ3RILGdCQUFnQixDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLE1BQU0sRUFBRSxlQUFlLENBQUMsQ0FBQztnQkFDckUsQ0FBQztZQUNGLENBQUM7WUFDRCxXQUFXLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRTtnQkFDbEIsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNwQyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztvQkFDakMsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxlQUFlLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDdEgseUJBQXlCLENBQUMsZUFBZSxDQUFDLENBQUM7Z0JBQzVDLENBQUM7WUFDRixDQUFDO1lBQ0QsV0FBVyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUU7Z0JBQ2xCLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDcEMseUJBQXlCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbEMsQ0FBQztZQUNELFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFO2dCQUNoQixXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3BDLHlCQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2xDLENBQUM7WUFDRCxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRTtnQkFDYixXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3BDLHlCQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNqQyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztvQkFDakMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxlQUFlLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDeEYsQ0FBQztxQkFBTSxDQUFDO29CQUNQLGdFQUFnRTtvQkFDaEUsTUFBTSxRQUFRLEdBQUcsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFFN0MsSUFBSSxRQUFRLENBQUMsSUFBSSxLQUFLLFdBQVcsRUFBRSxDQUFDO3dCQUNuQyxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFFLENBQUM7d0JBQ3ZGLElBQUksQ0FBQyxxQkFBcUIsQ0FBQywyQkFBMkIsQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQzt3QkFDMUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDbkQsQ0FBQzt5QkFFSSxJQUFJLFFBQVEsQ0FBQyxJQUFJLEtBQUssTUFBTSxFQUFFLENBQUM7d0JBQ25DLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFFLENBQUM7d0JBQ2xGLElBQUksVUFBVSxDQUFDLFdBQVcsRUFBRSxDQUFDOzRCQUM1QixJQUFJLENBQUMscUJBQXFCLENBQUMsa0JBQWtCLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7NEJBRWhGLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyx3QkFBd0IsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFFLENBQUM7NEJBRXpGLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRTtnQ0FDOUQsU0FBUyxFQUFFLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDOzRCQUMxQyxDQUFDLENBQUMsQ0FBQzt3QkFDSixDQUFDO29CQUNGLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7U0FDRCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFa0IsZUFBZSxDQUFDLE1BQW1CO1FBQ3JELE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFaEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsRUFBRTtZQUMzRSxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5RSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0osSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDN0MsSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLEVBQUUsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQ2pGLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixNQUFNLDJCQUEyQixHQUFHLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQztRQUVoRix5QkFBeUI7UUFDekIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsb0JBQW9CLEVBQ2hHLDJCQUEyQixFQUMzQixJQUFJLENBQUMsbUJBQW1CLEVBQ3hCO1lBQ0Msc0JBQXNCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQztZQUN6RixXQUFXLHVDQUErQjtZQUMxQyxhQUFhLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUMzRSx1QkFBdUIsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsbUNBQW1DLEVBQUU7WUFDekUsZUFBZSxFQUFFLFFBQVEsQ0FBQyxhQUFhLEVBQUUsaUJBQWlCLENBQUM7WUFDM0QsYUFBYSxFQUFFLElBQUksQ0FBQyxvQkFBb0I7WUFDeEMsa0JBQWtCLG9DQUEyQjtZQUM3QyxxQkFBcUIsRUFBRSxJQUFJO1lBQzNCLGVBQWUsRUFBRSxJQUFJLENBQUMsZ0JBQWdCO1NBQ3RDLENBQ0QsQ0FBQyxDQUFDO1FBRUgsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVrQixnQkFBZ0IsQ0FBQyxNQUFtQjtRQUN0RCxJQUFJLENBQUMsY0FBYyxHQUFHLE1BQU0sQ0FBQztRQUU3QixNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEQsSUFBSSxDQUFDLGlCQUFrQixDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDekMsTUFBTSxtQkFBbUIsR0FBRyxHQUErQyxFQUFFO1lBQzVFLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxzQkFBc0IsRUFBRyxDQUFDO1lBQ3JELE9BQU8sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRSxhQUFhLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQztRQUN6RCxDQUFDLENBQUM7UUFDRixJQUFJLENBQUMsU0FBUyxDQUFDLDRCQUE0QixDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsaUJBQWtCLEVBQUUsbUJBQW1CLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUUxSCxPQUFPLFVBQVUsQ0FBQztJQUNuQixDQUFDO0lBRVMsa0JBQWtCLENBQUMsMkJBQW9DLEtBQUs7UUFDckUsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLENBQUMsb0JBQW9CLEtBQUssU0FBUyxDQUFDO1FBQ3ZFLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7UUFDNUQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUM7UUFDbkQsTUFBTSxXQUFXLEdBQUcscUJBQXFCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFFdkYsMEdBQTBHO1FBQzFHLElBQUksQ0FBQyx3QkFBd0IsSUFBSSxnQkFBZ0IsS0FBSyxXQUFXLEVBQUUsQ0FBQztZQUNuRSxPQUFPO1FBQ1IsQ0FBQztRQUVELDJCQUEyQjtRQUMzQixJQUFJLHNCQUFzQixFQUFFLENBQUM7WUFDNUIsTUFBTSw2QkFBNkIsR0FBRyxnQkFBZ0IsS0FBSyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQztZQUNySixJQUFJLENBQUMsSUFBSSxDQUFDLHlCQUF5QixJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssSUFBSSxDQUFDLDZCQUE2QixFQUFFLENBQUM7Z0JBQ3ZHLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0ZBQWdGLENBQUMsQ0FBQztZQUNuRyxDQUFDO1lBRUQsSUFBSSxDQUFDLHlCQUF5QixDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3hDLElBQUksQ0FBQyx5QkFBeUIsR0FBRyxTQUFTLENBQUM7WUFDM0MsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssR0FBRyxTQUFTLENBQUM7WUFFeEMsNkJBQTZCLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1lBRXBFLElBQUksZ0JBQWdCLEtBQUssb0JBQW9CLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ25ELElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuQyxDQUFDO2lCQUFNLElBQUksZ0JBQWdCLEtBQUssb0JBQW9CLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQzdELElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNwQyxDQUFDO1FBQ0YsQ0FBQztRQUVELDJCQUEyQjtRQUMzQixJQUFJLHdCQUF3QixDQUFDO1FBQzdCLFFBQVEsV0FBVyxFQUFFLENBQUM7WUFDckIsS0FBSyxvQkFBb0IsQ0FBQyxHQUFHO2dCQUFFLHdCQUF3QixHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO2dCQUFDLE1BQU07WUFDekYsS0FBSyxvQkFBb0IsQ0FBQyxLQUFLO2dCQUFFLHdCQUF3QixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7Z0JBQUMsTUFBTTtZQUN2RixLQUFLLG9CQUFvQixDQUFDLE1BQU07Z0JBQUUsd0JBQXdCLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7Z0JBQUMsTUFBTTtRQUM3RixDQUFDO1FBQ0QsSUFBSSxxQkFBcUIsRUFBRSxDQUFDO1lBRTNCLElBQUksSUFBSSxDQUFDLHlCQUF5QixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO2dCQUNoRyxNQUFNLElBQUksS0FBSyxDQUFDLGlFQUFpRSxDQUFDLENBQUM7WUFDcEYsQ0FBQztZQUVELHdCQUF3QixDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUM1RCxJQUFJLENBQUMseUJBQXlCLEdBQUcsT0FBTyxDQUFDLHdCQUF3QixFQUFFLENBQUMsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUM7WUFDbEcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUN4RCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsQ0FBQztZQUVuRSxJQUFJLFdBQVcsS0FBSyxvQkFBb0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDOUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1lBQzlDLENBQUM7aUJBQU0sSUFBSSxXQUFXLEtBQUssb0JBQW9CLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ3hELElBQUksQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsQ0FBQztZQUM5QyxDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksQ0FBQyxvQkFBb0IsR0FBRyxXQUFXLENBQUM7UUFFeEMsSUFBSSx3QkFBd0IsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBQzNCLENBQUM7SUFDRixDQUFDO0lBRWtCLGdCQUFnQjtRQUNsQyxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUU1QyxPQUFPLElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBRWtCLGdCQUFnQjtRQUNsQyxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUU1QyxPQUFPLElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBRVMsa0NBQWtDLENBQUMsSUFBaUI7UUFDN0QsSUFBSSxJQUFJLENBQUMsaUNBQWlDLEVBQUUsQ0FBQztZQUM1QyxzRUFBc0U7WUFDdEUsTUFBTSxJQUFJLEtBQUssQ0FBQywrQ0FBK0MsQ0FBQyxDQUFDO1FBQ2xFLENBQUM7UUFDRCxJQUFJLENBQUMsaUNBQWlDLEdBQUcsSUFBSSxDQUFDO1FBRTlDLElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLEVBQUU7WUFDbkcsSUFBSSxDQUFDLDZCQUE2QixDQUFDLElBQUksa0JBQWtCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEYsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNKLElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3JFLElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUN6RyxJQUFJLENBQUMsNkJBQTZCLENBQUMsSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRU8sc0JBQXNCLENBQUMsTUFBZTtRQUM3QyxJQUFJLENBQUMsaUNBQWlDLEdBQUcsU0FBUyxDQUFDO1FBQ25ELElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNoRCxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1osSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDekIsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN6QixDQUFDO0lBQ0YsQ0FBQztJQUVTLGtCQUFrQjtRQUMzQixPQUFPLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLHNCQUFzQixFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNySCxDQUFDO0lBRWtCLGlCQUFpQixDQUFDLFdBQW1CO1FBQ3ZELEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUVyQyxzREFBc0Q7UUFDdEQsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7SUFDM0IsQ0FBQztJQUVELEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxFQUFXLEVBQUUsS0FBZTtRQUNuRCxJQUFJLE9BQU8sRUFBRSxLQUFLLFFBQVEsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUN6RCxPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUVELE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLGlDQUFpQyxFQUFFLENBQUM7UUFFaEUsSUFBSSxPQUFPLEVBQUUsS0FBSyxRQUFRLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7WUFDekQsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRU8sS0FBSyxDQUFDLG1CQUFtQixDQUFDLEVBQVUsRUFBRSxLQUFlO1FBQzVELElBQUksSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ3ZCLDZEQUE2RDtZQUM3RCw4REFBOEQ7WUFDOUQsK0RBQStEO1lBQy9ELGlEQUFpRDtZQUNqRCxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO1FBQzVCLENBQUM7UUFFRCxJQUFJLFlBQW9FLENBQUM7UUFDekUsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQ2hELElBQUksQ0FBQztnQkFDSixZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLGVBQWUsRUFBNkIsQ0FBQztnQkFDcEYsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN0RCxDQUFDO29CQUFTLENBQUM7Z0JBQ1YsSUFBSSxDQUFDLFlBQVksR0FBRyxTQUFTLENBQUM7WUFDL0IsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLENBQUM7WUFDSixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQThCLENBQUM7WUFDMUUsWUFBWSxFQUFFLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUUvQixPQUFPLE1BQU0sQ0FBQztRQUNmLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2hCLFlBQVksRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDM0IsTUFBTSxLQUFLLENBQUM7UUFDYixDQUFDO0lBQ0YsQ0FBQztJQUVELGdCQUFnQixDQUFDLEVBQVU7UUFDMUIsT0FBUSxJQUFJLENBQUMsUUFBa0MsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBRUQsaUJBQWlCO1FBQ2hCLE9BQVEsSUFBSSxDQUFDLFFBQWtDLENBQUMsaUJBQWlCLEVBQUU7YUFDakUsSUFBSSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO1lBQ2hCLElBQUksT0FBTyxFQUFFLENBQUMsS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUNsQyxPQUFPLENBQUMsQ0FBQztZQUNWLENBQUM7WUFFRCxJQUFJLE9BQU8sRUFBRSxDQUFDLEtBQUssS0FBSyxRQUFRLEVBQUUsQ0FBQztnQkFDbEMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNYLENBQUM7WUFFRCxPQUFPLEVBQUUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQztRQUM1QixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCx5QkFBeUI7UUFDeEIsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLHlCQUF5QixFQUFFLElBQUksRUFBRSxDQUFDO0lBQ3ZFLENBQUM7SUFFRCwwQkFBMEI7UUFDekIsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLDBCQUEwQixFQUFFLElBQUksRUFBRSxDQUFDO0lBQ3hFLENBQUM7SUFFRCxtQkFBbUI7UUFDbEIsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLG1CQUFtQixFQUFFLElBQUksRUFBRSxDQUFDO0lBQ2pFLENBQUM7SUFFRCxzQkFBc0I7UUFDckIsT0FBdUIsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7SUFDbEQsQ0FBQztJQUVELDRCQUE0QjtRQUMzQixPQUFPLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO0lBQ3hDLENBQUM7SUFFRCx1QkFBdUI7UUFDdEIsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUMvQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JELENBQUM7UUFFRCxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztJQUM1QixDQUFDO0lBRVMsaUJBQWlCO1FBQzFCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUM7SUFDdEMsQ0FBQztJQUVRLE1BQU0sQ0FBQyxLQUFhLEVBQUUsTUFBYyxFQUFFLEdBQVcsRUFBRSxJQUFZO1FBQ3ZFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUNoRCxPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLFNBQVMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFckQsa0JBQWtCO1FBQ2xCLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUVuRix1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFFMUIseUJBQXlCO1FBQ3pCLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0lBQzNCLENBQUM7SUFFTyxrQkFBa0I7UUFDekIsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLElBQUksSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDNUUsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixLQUFLLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbEYsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLE1BQU0sbURBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzdELElBQUksY0FBYyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEdBQUcsT0FBTyxHQUFHLFdBQVcsQ0FBQztZQUN6RSxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQywyQkFBeUIsQ0FBQyx1QkFBdUIsRUFBRSxjQUFjLEdBQUcsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUM7WUFDdEgsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDM0UsQ0FBQztJQUNGLENBQUM7SUFFTyxrQkFBa0I7UUFDekIsTUFBTSxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUMzQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2hELElBQUksT0FBTyxFQUFFLENBQUM7WUFDYixJQUFJLENBQUMsVUFBVSxFQUFFLFdBQVcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDdEMsQ0FBQztJQUNGLENBQUM7SUFFUyxlQUFlO1FBQ3hCLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxvQkFBb0IsS0FBSyxvQkFBb0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUMvRSxPQUFPLENBQUMsQ0FBQztRQUNWLENBQUM7UUFFRCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUNqRCxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDakIsT0FBTyxDQUFDLENBQUM7UUFDVixDQUFDO1FBRUQsbUNBQW1DO1FBQ25DLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDdEYsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsRUFBRSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakksT0FBTyxZQUFZLEdBQUcsa0JBQWtCLEdBQUcsQ0FBQyxDQUFDLENBQUMsbUJBQW1CO0lBQ2xFLENBQUM7SUFFTyxzQkFBc0IsQ0FBQyxLQUF5QjtRQUN2RCxJQUFJLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxJQUFJLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxLQUFLLG9CQUFvQixDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3BHLE9BQU8sSUFBSSxDQUFDLHlCQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzlDLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsc0JBQXNCLEVBQW1CLENBQUM7WUFDM0UsTUFBTSwwQkFBMEIsR0FBRyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsbUJBQW1CLENBQUMscUJBQXFCLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQzFHLElBQUksMEJBQTBCLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ3ZDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLENBQUM7b0JBQ3ZDLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLO29CQUN0QixVQUFVLEVBQUUsR0FBRyxFQUFFLENBQUMsMEJBQTBCO29CQUM1QyxpQkFBaUIsRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDO29CQUNwRixZQUFZLEVBQUUsbUJBQW1CLENBQUMsZUFBZSxFQUFFO29CQUNuRCxhQUFhLEVBQUUsSUFBSTtpQkFDbkIsQ0FBQyxDQUFDO1lBQ0osQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRU8sNkJBQTZCLENBQUMsS0FBeUI7UUFDOUQsT0FBTyxJQUFJLENBQUMseUJBQXlCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQUVPLHlCQUF5QixDQUFDLEtBQXlCO1FBQzFELElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2pDLE1BQU0sT0FBTyxHQUFjLENBQUMsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLHFCQUFxQixFQUFFLENBQUMsQ0FBQztZQUNwRixJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDcEIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGVBQWUsQ0FBQztvQkFDdkMsU0FBUyxFQUFFLEdBQUcsRUFBRSxDQUFDLEtBQUs7b0JBQ3RCLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxPQUFPO29CQUN6QixhQUFhLEVBQUUsSUFBSTtpQkFDbkIsQ0FBQyxDQUFDO1lBQ0osQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRVMscUJBQXFCO1FBQzlCLE1BQU0saUJBQWlCLEdBQUksSUFBSSxDQUFDLHNCQUFzQixFQUFvQixFQUFFLG9CQUFvQixFQUFFLENBQUM7UUFDbkcsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO1lBQ3ZCLE1BQU0sV0FBVyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7WUFDMUMsTUFBTSx1QkFBdUIsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDbkcsdUJBQXVCLENBQUMsU0FBUyxDQUFDLGVBQWUsRUFBRSxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDdkYsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsWUFBWSxFQUFFLHVCQUF1QixFQUFFLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7WUFDekksTUFBTSxZQUFZLEdBQUcsbUJBQW1CLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQztZQUNuRSxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdEIsT0FBTyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ3hKLENBQUM7UUFDRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDOztBQTVrQm9CLHlCQUF5QjtJQXNDNUMsV0FBQSxvQkFBb0IsQ0FBQTtJQUNwQixZQUFBLGVBQWUsQ0FBQTtJQUNmLFlBQUEsbUJBQW1CLENBQUE7SUFDbkIsWUFBQSx1QkFBdUIsQ0FBQTtJQUN2QixZQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFlBQUEsYUFBYSxDQUFBO0lBQ2IsWUFBQSxxQkFBcUIsQ0FBQTtJQUNyQixZQUFBLGFBQWEsQ0FBQTtJQUNiLFlBQUEsc0JBQXNCLENBQUE7SUFDdEIsWUFBQSxrQkFBa0IsQ0FBQTtJQUNsQixZQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFlBQUEsWUFBWSxDQUFBO0dBakRPLHlCQUF5QixDQWlsQjlDIn0=