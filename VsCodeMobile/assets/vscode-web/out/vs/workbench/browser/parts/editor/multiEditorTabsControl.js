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
var MultiEditorTabsControl_1;
import './media/multieditortabscontrol.css';
import { isLinux, isMacintosh, isWindows } from '../../../../base/common/platform.js';
import { shorten } from '../../../../base/common/labels.js';
import { EditorResourceAccessor, SideBySideEditor, DEFAULT_EDITOR_ASSOCIATION, preventEditorClose, EditorCloseMethod } from '../../../common/editor.js';
import { computeEditorAriaLabel } from '../../editor.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { EventType as TouchEventType, Gesture } from '../../../../base/browser/touch.js';
import { ResourceLabels, DEFAULT_LABELS_CONTAINER } from '../../labels.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { EditorCommandsContextActionRunner, EditorTabsControl } from './editorTabsControl.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { dispose, DisposableStore, combinedDisposable, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { ScrollableElement } from '../../../../base/browser/ui/scrollbar/scrollableElement.js';
import { getOrSet } from '../../../../base/common/map.js';
import { IThemeService, registerThemingParticipant } from '../../../../platform/theme/common/themeService.js';
import { TAB_INACTIVE_BACKGROUND, TAB_ACTIVE_BACKGROUND, TAB_BORDER, EDITOR_DRAG_AND_DROP_BACKGROUND, TAB_UNFOCUSED_ACTIVE_BACKGROUND, TAB_UNFOCUSED_ACTIVE_BORDER, TAB_ACTIVE_BORDER, TAB_HOVER_BACKGROUND, TAB_HOVER_BORDER, TAB_UNFOCUSED_HOVER_BACKGROUND, TAB_UNFOCUSED_HOVER_BORDER, EDITOR_GROUP_HEADER_TABS_BACKGROUND, WORKBENCH_BACKGROUND, TAB_ACTIVE_BORDER_TOP, TAB_UNFOCUSED_ACTIVE_BORDER_TOP, TAB_ACTIVE_MODIFIED_BORDER, TAB_INACTIVE_MODIFIED_BORDER, TAB_UNFOCUSED_ACTIVE_MODIFIED_BORDER, TAB_UNFOCUSED_INACTIVE_MODIFIED_BORDER, TAB_UNFOCUSED_INACTIVE_BACKGROUND, TAB_HOVER_FOREGROUND, TAB_UNFOCUSED_HOVER_FOREGROUND, EDITOR_GROUP_HEADER_TABS_BORDER, TAB_LAST_PINNED_BORDER, TAB_SELECTED_BORDER_TOP } from '../../../common/theme.js';
import { activeContrastBorder, contrastBorder, editorBackground } from '../../../../platform/theme/common/colorRegistry.js';
import { ResourcesDropHandler, DraggedEditorIdentifier, DraggedEditorGroupIdentifier, extractTreeDropData, isWindowDraggedOver } from '../../dnd.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { addDisposableListener, EventType, EventHelper, Dimension, scheduleAtNextAnimationFrame, findParentWithClass, clearNode, DragAndDropObserver, isMouseEvent, getWindow, $ } from '../../../../base/browser/dom.js';
import { localize } from '../../../../nls.js';
import { prepareMoveCopyEditors } from './editor.js';
import { CloseEditorTabAction, UnpinEditorAction } from './editorActions.js';
import { assertReturnsAllDefined, assertReturnsDefined } from '../../../../base/common/types.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { basenameOrAuthority } from '../../../../base/common/resources.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { win32, posix } from '../../../../base/common/path.js';
import { coalesce, insert } from '../../../../base/common/arrays.js';
import { isHighContrast } from '../../../../platform/theme/common/theme.js';
import { isSafari } from '../../../../base/browser/browser.js';
import { equals } from '../../../../base/common/objects.js';
import { EditorActivation } from '../../../../platform/editor/common/editor.js';
import { UNLOCK_GROUP_COMMAND_ID } from './editorCommands.js';
import { StandardMouseEvent } from '../../../../base/browser/mouseEvent.js';
import { ITreeViewsDnDService } from '../../../../editor/common/services/treeViewsDndService.js';
import { DraggedTreeItemsIdentifier } from '../../../../editor/common/services/treeViewsDnd.js';
import { IEditorResolverService } from '../../../services/editor/common/editorResolverService.js';
import { StickyEditorGroupModel, UnstickyEditorGroupModel } from '../../../common/editor/filteredEditorGroupModel.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { BugIndicatingError } from '../../../../base/common/errors.js';
import { applyDragImage } from '../../../../base/browser/ui/dnd/dnd.js';
let MultiEditorTabsControl = class MultiEditorTabsControl extends EditorTabsControl {
    static { MultiEditorTabsControl_1 = this; }
    static { this.SCROLLBAR_SIZES = {
        default: 3,
        large: 10
    }; }
    static { this.TAB_WIDTH = {
        compact: 38,
        shrink: 80,
        fit: 120
    }; }
    static { this.DRAG_OVER_OPEN_TAB_THRESHOLD = 1500; }
    static { this.MOUSE_WHEEL_EVENT_THRESHOLD = 150; }
    static { this.MOUSE_WHEEL_DISTANCE_THRESHOLD = 1.5; }
    constructor(parent, editorPartsView, groupsView, groupView, tabsModel, contextMenuService, instantiationService, contextKeyService, keybindingService, notificationService, quickInputService, themeService, editorService, pathService, treeViewsDragAndDropService, editorResolverService, hostService) {
        super(parent, editorPartsView, groupsView, groupView, tabsModel, contextMenuService, instantiationService, contextKeyService, keybindingService, notificationService, quickInputService, themeService, editorResolverService, hostService);
        this.editorService = editorService;
        this.pathService = pathService;
        this.treeViewsDragAndDropService = treeViewsDragAndDropService;
        this.closeEditorAction = this._register(this.instantiationService.createInstance(CloseEditorTabAction, CloseEditorTabAction.ID, CloseEditorTabAction.LABEL));
        this.unpinEditorAction = this._register(this.instantiationService.createInstance(UnpinEditorAction, UnpinEditorAction.ID, UnpinEditorAction.LABEL));
        this.tabResourceLabels = this._register(this.instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER));
        this.tabLabels = [];
        this.tabActionBars = [];
        this.tabDisposables = [];
        this.dimensions = {
            container: Dimension.None,
            available: Dimension.None
        };
        this.layoutScheduler = this._register(new MutableDisposable());
        this.path = isWindows ? win32 : posix;
        this.lastMouseWheelEventTime = 0;
        this.isMouseOverTabs = false;
        this.updateEditorLabelScheduler = this._register(new RunOnceScheduler(() => this.doUpdateEditorLabels(), 0));
        // Resolve the correct path library for the OS we are on
        // If we are connected to remote, this accounts for the
        // remote OS.
        (async () => this.path = await this.pathService.path)();
        // React to decorations changing for our resource labels
        this._register(this.tabResourceLabels.onDidChangeDecorations(() => this.doHandleDecorationsChange()));
    }
    create(parent) {
        super.create(parent);
        this.titleContainer = parent;
        // Tabs and Actions Container (are on a single row with flex side-by-side)
        this.tabsAndActionsContainer = $('.tabs-and-actions-container');
        this.titleContainer.appendChild(this.tabsAndActionsContainer);
        // Tabs Container
        this.tabsContainer = $('.tabs-container', {
            role: 'tablist',
            draggable: true
        });
        this._register(Gesture.addTarget(this.tabsContainer));
        this.tabSizingFixedDisposables = this._register(new DisposableStore());
        this.updateTabSizing(false);
        // Tabs Scrollbar
        this.tabsScrollbar = this.createTabsScrollbar(this.tabsContainer);
        this.tabsAndActionsContainer.appendChild(this.tabsScrollbar.getDomNode());
        // Tabs Container listeners
        this.registerTabsContainerListeners(this.tabsContainer, this.tabsScrollbar);
        // Create Editor Toolbar
        this.createEditorActionsToolBar(this.tabsAndActionsContainer, ['editor-actions']);
        // Set tabs control visibility
        this.updateTabsControlVisibility();
        return this.tabsAndActionsContainer;
    }
    createTabsScrollbar(scrollable) {
        const tabsScrollbar = this._register(new ScrollableElement(scrollable, {
            horizontal: this.getTabsScrollbarVisibility(),
            horizontalScrollbarSize: this.getTabsScrollbarSizing(),
            vertical: 2 /* ScrollbarVisibility.Hidden */,
            scrollYToX: true,
            useShadows: false
        }));
        this._register(tabsScrollbar.onScroll(e => {
            if (e.scrollLeftChanged) {
                scrollable.scrollLeft = e.scrollLeft;
            }
        }));
        return tabsScrollbar;
    }
    updateTabsScrollbarSizing() {
        this.tabsScrollbar?.updateOptions({
            horizontalScrollbarSize: this.getTabsScrollbarSizing()
        });
    }
    updateTabsScrollbarVisibility() {
        this.tabsScrollbar?.updateOptions({
            horizontal: this.getTabsScrollbarVisibility()
        });
    }
    updateTabSizing(fromEvent) {
        const [tabsContainer, tabSizingFixedDisposables] = assertReturnsAllDefined(this.tabsContainer, this.tabSizingFixedDisposables);
        tabSizingFixedDisposables.clear();
        const options = this.groupsView.partOptions;
        if (options.tabSizing === 'fixed') {
            tabsContainer.style.setProperty('--tab-sizing-fixed-min-width', `${options.tabSizingFixedMinWidth}px`);
            tabsContainer.style.setProperty('--tab-sizing-fixed-max-width', `${options.tabSizingFixedMaxWidth}px`);
            // For https://github.com/microsoft/vscode/issues/40290 we want to
            // preserve the current tab widths as long as the mouse is over the
            // tabs so that you can quickly close them via mouse click. For that
            // we track mouse movements over the tabs container.
            tabSizingFixedDisposables.add(addDisposableListener(tabsContainer, EventType.MOUSE_ENTER, () => {
                this.isMouseOverTabs = true;
            }));
            tabSizingFixedDisposables.add(addDisposableListener(tabsContainer, EventType.MOUSE_LEAVE, () => {
                this.isMouseOverTabs = false;
                this.updateTabsFixedWidth(false);
            }));
        }
        else if (fromEvent) {
            tabsContainer.style.removeProperty('--tab-sizing-fixed-min-width');
            tabsContainer.style.removeProperty('--tab-sizing-fixed-max-width');
            this.updateTabsFixedWidth(false);
        }
    }
    updateTabsFixedWidth(fixed) {
        this.forEachTab((editor, tabIndex, tabContainer) => {
            if (fixed) {
                const { width } = tabContainer.getBoundingClientRect();
                tabContainer.style.setProperty('--tab-sizing-current-width', `${width}px`);
            }
            else {
                tabContainer.style.removeProperty('--tab-sizing-current-width');
            }
        });
    }
    getTabsScrollbarSizing() {
        if (this.groupsView.partOptions.titleScrollbarSizing !== 'large') {
            return MultiEditorTabsControl_1.SCROLLBAR_SIZES.default;
        }
        return MultiEditorTabsControl_1.SCROLLBAR_SIZES.large;
    }
    getTabsScrollbarVisibility() {
        switch (this.groupsView.partOptions.titleScrollbarVisibility) {
            case 'visible': return 3 /* ScrollbarVisibility.Visible */;
            case 'hidden': return 2 /* ScrollbarVisibility.Hidden */;
            default: return 1 /* ScrollbarVisibility.Auto */;
        }
    }
    registerTabsContainerListeners(tabsContainer, tabsScrollbar) {
        // Forward scrolling inside the container to our custom scrollbar
        this._register(addDisposableListener(tabsContainer, EventType.SCROLL, () => {
            if (tabsContainer.classList.contains('scroll')) {
                tabsScrollbar.setScrollPosition({
                    scrollLeft: tabsContainer.scrollLeft // during DND the container gets scrolled so we need to update the custom scrollbar
                });
            }
        }));
        // New file when double-clicking on tabs container (but not tabs)
        for (const eventType of [TouchEventType.Tap, EventType.DBLCLICK]) {
            this._register(addDisposableListener(tabsContainer, eventType, (e) => {
                if (eventType === EventType.DBLCLICK) {
                    if (e.target !== tabsContainer) {
                        return; // ignore if target is not tabs container
                    }
                }
                else {
                    if (e.tapCount !== 2) {
                        return; // ignore single taps
                    }
                    if (e.initialTarget !== tabsContainer) {
                        return; // ignore if target is not tabs container
                    }
                }
                EventHelper.stop(e);
                this.editorService.openEditor({
                    resource: undefined,
                    options: {
                        pinned: true,
                        index: this.groupView.count, // always at the end
                        override: DEFAULT_EDITOR_ASSOCIATION.id
                    }
                }, this.groupView.id);
            }));
        }
        // Prevent auto-scrolling (https://github.com/microsoft/vscode/issues/16690)
        this._register(addDisposableListener(tabsContainer, EventType.MOUSE_DOWN, e => {
            if (e.button === 1) {
                e.preventDefault();
            }
        }));
        // Prevent auto-pasting (https://github.com/microsoft/vscode/issues/201696)
        if (isLinux) {
            this._register(addDisposableListener(tabsContainer, EventType.MOUSE_UP, e => {
                if (e.button === 1) {
                    e.preventDefault();
                }
            }));
        }
        // Drag & Drop support
        let lastDragEvent = undefined;
        let isNewWindowOperation = false;
        this._register(new DragAndDropObserver(tabsContainer, {
            onDragStart: e => {
                isNewWindowOperation = this.onGroupDragStart(e, tabsContainer);
            },
            onDrag: e => {
                lastDragEvent = e;
            },
            onDragEnter: e => {
                // Always enable support to scroll while dragging
                tabsContainer.classList.add('scroll');
                // Return if the target is not on the tabs container
                if (e.target !== tabsContainer) {
                    return;
                }
                // Return if transfer is unsupported
                if (!this.isSupportedDropTransfer(e)) {
                    if (e.dataTransfer) {
                        e.dataTransfer.dropEffect = 'none';
                    }
                    return;
                }
                // Update the dropEffect to "copy" if there is no local data to be dragged because
                // in that case we can only copy the data into and not move it from its source
                if (!this.editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
                    if (e.dataTransfer) {
                        e.dataTransfer.dropEffect = 'copy';
                    }
                }
                this.updateDropFeedback(tabsContainer, true, e);
            },
            onDragLeave: e => {
                this.updateDropFeedback(tabsContainer, false, e);
                tabsContainer.classList.remove('scroll');
            },
            onDragEnd: e => {
                this.updateDropFeedback(tabsContainer, false, e);
                tabsContainer.classList.remove('scroll');
                this.onGroupDragEnd(e, lastDragEvent, tabsContainer, isNewWindowOperation);
            },
            onDrop: e => {
                this.updateDropFeedback(tabsContainer, false, e);
                tabsContainer.classList.remove('scroll');
                if (e.target === tabsContainer) {
                    const isGroupTransfer = this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype);
                    this.onDrop(e, isGroupTransfer ? this.groupView.count : this.tabsModel.count, tabsContainer);
                }
            }
        }));
        // Mouse-wheel support to switch to tabs optionally
        this._register(addDisposableListener(tabsContainer, EventType.MOUSE_WHEEL, (e) => {
            const activeEditor = this.groupView.activeEditor;
            if (!activeEditor || this.groupView.count < 2) {
                return; // need at least 2 open editors
            }
            // Shift-key enables or disables this behaviour depending on the setting
            if (this.groupsView.partOptions.scrollToSwitchTabs === true) {
                if (e.shiftKey) {
                    return; // 'on': only enable this when Shift-key is not pressed
                }
            }
            else {
                if (!e.shiftKey) {
                    return; // 'off': only enable this when Shift-key is pressed
                }
            }
            // Ignore event if the last one happened too recently (https://github.com/microsoft/vscode/issues/96409)
            // The restriction is relaxed according to the absolute value of `deltaX` and `deltaY`
            // to support discrete (mouse wheel) and contiguous scrolling (touchpad) equally well
            const now = Date.now();
            if (now - this.lastMouseWheelEventTime < MultiEditorTabsControl_1.MOUSE_WHEEL_EVENT_THRESHOLD - 2 * (Math.abs(e.deltaX) + Math.abs(e.deltaY))) {
                return;
            }
            this.lastMouseWheelEventTime = now;
            // Figure out scrolling direction but ignore it if too subtle
            let tabSwitchDirection;
            if (e.deltaX + e.deltaY < -MultiEditorTabsControl_1.MOUSE_WHEEL_DISTANCE_THRESHOLD) {
                tabSwitchDirection = -1;
            }
            else if (e.deltaX + e.deltaY > MultiEditorTabsControl_1.MOUSE_WHEEL_DISTANCE_THRESHOLD) {
                tabSwitchDirection = 1;
            }
            else {
                return;
            }
            const nextEditor = this.groupView.getEditorByIndex(this.groupView.getIndexOfEditor(activeEditor) + tabSwitchDirection);
            if (!nextEditor) {
                return;
            }
            // Open it
            this.groupView.openEditor(nextEditor);
            // Disable normal scrolling, opening the editor will already reveal it properly
            EventHelper.stop(e, true);
        }));
        // Context menu
        const showContextMenu = (e) => {
            EventHelper.stop(e);
            // Find target anchor
            let anchor = tabsContainer;
            if (isMouseEvent(e)) {
                anchor = new StandardMouseEvent(getWindow(this.parent), e);
            }
            // Show it
            this.contextMenuService.showContextMenu({
                getAnchor: () => anchor,
                menuId: MenuId.EditorTabsBarContext,
                contextKeyService: this.contextKeyService,
                menuActionOptions: { shouldForwardArgs: true },
                getActionsContext: () => ({ groupId: this.groupView.id }),
                getKeyBinding: action => this.getKeybinding(action),
                onHide: () => this.groupView.focus()
            });
        };
        this._register(addDisposableListener(tabsContainer, TouchEventType.Contextmenu, e => showContextMenu(e)));
        this._register(addDisposableListener(tabsContainer, EventType.CONTEXT_MENU, e => showContextMenu(e)));
    }
    doHandleDecorationsChange() {
        // A change to decorations potentially has an impact on the size of tabs
        // so we need to trigger a layout in that case to adjust things
        this.layout(this.dimensions);
    }
    updateEditorActionsToolbar() {
        super.updateEditorActionsToolbar();
        // Changing the actions in the toolbar can have an impact on the size of the
        // tab container, so we need to layout the tabs to make sure the active is visible
        this.layout(this.dimensions);
    }
    openEditor(editor, options) {
        const changed = this.handleOpenedEditors();
        // Respect option to focus tab control if provided
        if (options?.focusTabControl) {
            this.withTab(editor, (editor, tabIndex, tabContainer) => tabContainer.focus());
        }
        return changed;
    }
    openEditors(editors) {
        return this.handleOpenedEditors();
    }
    handleOpenedEditors() {
        // Set tabs control visibility
        this.updateTabsControlVisibility();
        // Create tabs as needed
        const [tabsContainer, tabsScrollbar] = assertReturnsAllDefined(this.tabsContainer, this.tabsScrollbar);
        for (let i = tabsContainer.children.length; i < this.tabsModel.count; i++) {
            tabsContainer.appendChild(this.createTab(i, tabsContainer, tabsScrollbar));
        }
        // Make sure to recompute tab labels and detect
        // if a label change occurred that requires a
        // redraw of tabs.
        const activeEditorChanged = this.didActiveEditorChange();
        const oldTabLabels = this.tabLabels;
        this.computeTabLabels();
        // Redraw and update in these cases
        let didChange = false;
        if (activeEditorChanged || // active editor changed
            oldTabLabels.length !== this.tabLabels.length || // number of tabs changed
            oldTabLabels.some((label, index) => !this.equalsEditorInputLabel(label, this.tabLabels.at(index))) // editor labels changed
        ) {
            this.redraw({ forceRevealActiveTab: true });
            didChange = true;
        }
        // Otherwise only layout for revealing
        else {
            this.layout(this.dimensions, { forceRevealActiveTab: true });
        }
        return didChange;
    }
    didActiveEditorChange() {
        if (!this.activeTabLabel?.editor && this.tabsModel.activeEditor || // active editor changed from null => editor
            this.activeTabLabel?.editor && !this.tabsModel.activeEditor || // active editor changed from editor => null
            (!this.activeTabLabel?.editor || !this.tabsModel.isActive(this.activeTabLabel.editor)) // active editor changed from editorA => editorB
        ) {
            return true;
        }
        return false;
    }
    equalsEditorInputLabel(labelA, labelB) {
        if (labelA === labelB) {
            return true;
        }
        if (!labelA || !labelB) {
            return false;
        }
        return labelA.name === labelB.name &&
            labelA.description === labelB.description &&
            labelA.forceDescription === labelB.forceDescription &&
            labelA.title === labelB.title &&
            labelA.ariaLabel === labelB.ariaLabel;
    }
    beforeCloseEditor(editor) {
        // Fix tabs width if the mouse is over tabs and before closing
        // a tab (except the last tab) when tab sizing is 'fixed'.
        // This helps keeping the close button stable under
        // the mouse and allows for rapid closing of tabs.
        if (this.isMouseOverTabs && this.groupsView.partOptions.tabSizing === 'fixed') {
            const closingLastTab = this.tabsModel.isLast(editor);
            this.updateTabsFixedWidth(!closingLastTab);
        }
    }
    closeEditor(editor) {
        this.handleClosedEditors();
    }
    closeEditors(editors) {
        this.handleClosedEditors();
    }
    handleClosedEditors() {
        // There are tabs to show
        if (this.tabsModel.count) {
            // Remove tabs that got closed
            const tabsContainer = assertReturnsDefined(this.tabsContainer);
            while (tabsContainer.children.length > this.tabsModel.count) {
                // Remove one tab from container (must be the last to keep indexes in order!)
                tabsContainer.lastChild?.remove();
                // Remove associated tab label and widget
                dispose(this.tabDisposables.pop());
            }
            // A removal of a label requires to recompute all labels
            this.computeTabLabels();
            // Redraw all tabs
            this.redraw({ forceRevealActiveTab: true });
        }
        // No tabs to show
        else {
            if (this.tabsContainer) {
                clearNode(this.tabsContainer);
            }
            this.tabDisposables = dispose(this.tabDisposables);
            this.tabResourceLabels.clear();
            this.tabLabels = [];
            this.activeTabLabel = undefined;
            this.tabActionBars = [];
            this.clearEditorActionsToolbar();
            this.updateTabsControlVisibility();
        }
    }
    moveEditor(editor, fromTabIndex, targetTabIndex) {
        // Move the editor label
        const editorLabel = this.tabLabels[fromTabIndex];
        this.tabLabels.splice(fromTabIndex, 1);
        this.tabLabels.splice(targetTabIndex, 0, editorLabel);
        // Redraw tabs in the range of the move
        this.forEachTab((editor, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar) => {
            this.redrawTab(editor, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar);
        }, Math.min(fromTabIndex, targetTabIndex), // from: smallest of fromTabIndex/targetTabIndex
        Math.max(fromTabIndex, targetTabIndex) //   to: largest of fromTabIndex/targetTabIndex
        );
        // Moving an editor requires a layout to keep the active editor visible
        this.layout(this.dimensions, { forceRevealActiveTab: true });
    }
    pinEditor(editor) {
        this.withTab(editor, (editor, tabIndex, tabContainer, tabLabelWidget, tabLabel) => this.redrawTabLabel(editor, tabIndex, tabContainer, tabLabelWidget, tabLabel));
    }
    stickEditor(editor) {
        this.doHandleStickyEditorChange(editor);
    }
    unstickEditor(editor) {
        this.doHandleStickyEditorChange(editor);
    }
    doHandleStickyEditorChange(editor) {
        // Update tab
        this.withTab(editor, (editor, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar) => this.redrawTab(editor, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar));
        // Sticky change has an impact on each tab's border because
        // it potentially moves the border to the last pinned tab
        this.forEachTab((editor, tabIndex, tabContainer, tabLabelWidget, tabLabel) => {
            this.redrawTabBorders(tabIndex, tabContainer);
        });
        // A change to the sticky state requires a layout to keep the active editor visible
        this.layout(this.dimensions, { forceRevealActiveTab: true });
    }
    setActive(isGroupActive) {
        // Activity has an impact on each tab's active indication
        this.forEachTab((editor, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar) => {
            this.redrawTabSelectedActiveAndDirty(isGroupActive, editor, tabContainer, tabActionBar);
        });
        // Activity has an impact on the toolbar, so we need to update and layout
        this.updateEditorActionsToolbar();
        this.layout(this.dimensions, { forceRevealActiveTab: true });
    }
    updateEditorSelections() {
        this.forEachTab((editor, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar) => {
            this.redrawTabSelectedActiveAndDirty(this.groupsView.activeGroup === this.groupView, editor, tabContainer, tabActionBar);
        });
    }
    updateEditorLabel(editor) {
        // Update all labels to account for changes to tab labels
        // Since this method may be called a lot of times from
        // individual editors, we collect all those requests and
        // then run the update once because we have to update
        // all opened tabs in the group at once.
        this.updateEditorLabelScheduler.schedule();
    }
    doUpdateEditorLabels() {
        // A change to a label requires to recompute all labels
        this.computeTabLabels();
        // As such we need to redraw each label
        this.forEachTab((editor, tabIndex, tabContainer, tabLabelWidget, tabLabel) => {
            this.redrawTabLabel(editor, tabIndex, tabContainer, tabLabelWidget, tabLabel);
        });
        // A change to a label requires a layout to keep the active editor visible
        this.layout(this.dimensions);
    }
    updateEditorDirty(editor) {
        this.withTab(editor, (editor, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar) => this.redrawTabSelectedActiveAndDirty(this.groupsView.activeGroup === this.groupView, editor, tabContainer, tabActionBar));
    }
    updateOptions(oldOptions, newOptions) {
        super.updateOptions(oldOptions, newOptions);
        // A change to a label format options requires to recompute all labels
        if (oldOptions.labelFormat !== newOptions.labelFormat) {
            this.computeTabLabels();
        }
        // Update tabs scrollbar sizing
        if (oldOptions.titleScrollbarSizing !== newOptions.titleScrollbarSizing) {
            this.updateTabsScrollbarSizing();
        }
        // Update tabs scrollbar visibility
        if (oldOptions.titleScrollbarVisibility !== newOptions.titleScrollbarVisibility) {
            this.updateTabsScrollbarVisibility();
        }
        // Update editor actions
        if (oldOptions.alwaysShowEditorActions !== newOptions.alwaysShowEditorActions) {
            this.updateEditorActionsToolbar();
        }
        // Update tabs sizing
        if (oldOptions.tabSizingFixedMinWidth !== newOptions.tabSizingFixedMinWidth ||
            oldOptions.tabSizingFixedMaxWidth !== newOptions.tabSizingFixedMaxWidth ||
            oldOptions.tabSizing !== newOptions.tabSizing) {
            this.updateTabSizing(true);
        }
        // Redraw tabs when other options change
        if (oldOptions.labelFormat !== newOptions.labelFormat ||
            oldOptions.tabActionLocation !== newOptions.tabActionLocation ||
            oldOptions.tabActionCloseVisibility !== newOptions.tabActionCloseVisibility ||
            oldOptions.tabActionUnpinVisibility !== newOptions.tabActionUnpinVisibility ||
            oldOptions.tabSizing !== newOptions.tabSizing ||
            oldOptions.pinnedTabSizing !== newOptions.pinnedTabSizing ||
            oldOptions.showIcons !== newOptions.showIcons ||
            oldOptions.hasIcons !== newOptions.hasIcons ||
            oldOptions.highlightModifiedTabs !== newOptions.highlightModifiedTabs ||
            oldOptions.wrapTabs !== newOptions.wrapTabs ||
            oldOptions.showTabIndex !== newOptions.showTabIndex ||
            !equals(oldOptions.decorations, newOptions.decorations)) {
            this.redraw();
        }
    }
    updateStyles() {
        this.redraw();
    }
    forEachTab(fn, fromTabIndex, toTabIndex) {
        this.tabsModel.getEditors(1 /* EditorsOrder.SEQUENTIAL */).forEach((editor, tabIndex) => {
            if (typeof fromTabIndex === 'number' && fromTabIndex > tabIndex) {
                return; // do nothing if we are not yet at `fromIndex`
            }
            if (typeof toTabIndex === 'number' && toTabIndex < tabIndex) {
                return; // do nothing if we are beyond `toIndex`
            }
            this.doWithTab(tabIndex, editor, fn);
        });
    }
    withTab(editor, fn) {
        this.doWithTab(this.tabsModel.indexOf(editor), editor, fn);
    }
    doWithTab(tabIndex, editor, fn) {
        const tabsContainer = assertReturnsDefined(this.tabsContainer);
        const tabContainer = tabsContainer.children[tabIndex];
        const tabResourceLabel = this.tabResourceLabels.get(tabIndex);
        const tabLabel = this.tabLabels[tabIndex];
        const tabActionBar = this.tabActionBars[tabIndex];
        if (tabContainer && tabResourceLabel && tabLabel) {
            fn(editor, tabIndex, tabContainer, tabResourceLabel, tabLabel, tabActionBar);
        }
    }
    createTab(tabIndex, tabsContainer, tabsScrollbar) {
        // Tab Container
        const tabContainer = $('.tab', {
            draggable: true,
            role: 'tab'
        });
        // Gesture Support
        this._register(Gesture.addTarget(tabContainer));
        // Tab Border Top
        const tabBorderTopContainer = $('.tab-border-top-container');
        tabContainer.appendChild(tabBorderTopContainer);
        // Tab Editor Label
        const editorLabel = this.tabResourceLabels.create(tabContainer, { hoverTargetOverride: tabContainer });
        // Tab Actions
        const tabActionsContainer = $('.tab-actions');
        tabContainer.appendChild(tabActionsContainer);
        const that = this;
        const tabActionRunner = new EditorCommandsContextActionRunner({
            groupId: this.groupView.id,
            get editorIndex() { return that.toEditorIndex(tabIndex); }
        });
        const tabActionBar = new ActionBar(tabActionsContainer, { ariaLabel: localize('ariaLabelTabActions', "Tab actions"), actionRunner: tabActionRunner });
        const tabActionListener = tabActionBar.onWillRun(e => {
            if (e.action.id === this.closeEditorAction.id) {
                this.blockRevealActiveTabOnce();
            }
        });
        const tabActionBarDisposable = combinedDisposable(tabActionRunner, tabActionBar, tabActionListener, toDisposable(insert(this.tabActionBars, tabActionBar)));
        // Tab Fade Hider
        // Hides the tab fade to the right when tab action left and sizing shrink/fixed, ::after, ::before are already used
        const tabShadowHider = $('.tab-fade-hider');
        tabContainer.appendChild(tabShadowHider);
        // Tab Border Bottom
        const tabBorderBottomContainer = $('.tab-border-bottom-container');
        tabContainer.appendChild(tabBorderBottomContainer);
        // Eventing
        const eventsDisposable = this.registerTabListeners(tabContainer, tabIndex, tabsContainer, tabsScrollbar);
        this.tabDisposables.push(combinedDisposable(eventsDisposable, tabActionBarDisposable, tabActionRunner, editorLabel));
        return tabContainer;
    }
    toEditorIndex(tabIndex) {
        // Given a `tabIndex` that is relative to the tabs model
        // returns the `editorIndex` relative to the entire group
        const editor = assertReturnsDefined(this.tabsModel.getEditorByIndex(tabIndex));
        return this.groupView.getIndexOfEditor(editor);
    }
    registerTabListeners(tab, tabIndex, tabsContainer, tabsScrollbar) {
        const disposables = new DisposableStore();
        const handleClickOrTouch = async (e, preserveFocus) => {
            tab.blur(); // prevent flicker of focus outline on tab until editor got focus
            if (isMouseEvent(e) && (e.button !== 0 /* middle/right mouse button */ || (isMacintosh && e.ctrlKey /* macOS context menu */))) {
                if (e.button === 1) {
                    e.preventDefault(); // required to prevent auto-scrolling (https://github.com/microsoft/vscode/issues/16690)
                }
                return;
            }
            if (this.originatesFromTabActionBar(e)) {
                return; // not when clicking on actions
            }
            // Open tabs editor
            const editor = this.tabsModel.getEditorByIndex(tabIndex);
            if (editor) {
                if (e.shiftKey) {
                    let anchor;
                    if (this.lastSingleSelectSelectedEditor && this.tabsModel.isSelected(this.lastSingleSelectSelectedEditor)) {
                        // The last selected editor is the anchor
                        anchor = this.lastSingleSelectSelectedEditor;
                    }
                    else {
                        // The active editor is the anchor
                        const activeEditor = assertReturnsDefined(this.groupView.activeEditor);
                        this.lastSingleSelectSelectedEditor = activeEditor;
                        anchor = activeEditor;
                    }
                    await this.selectEditorsBetween(editor, anchor);
                }
                else if ((e.ctrlKey && !isMacintosh) || (e.metaKey && isMacintosh)) {
                    if (this.tabsModel.isSelected(editor)) {
                        await this.unselectEditor(editor);
                    }
                    else {
                        await this.selectEditor(editor);
                        this.lastSingleSelectSelectedEditor = editor;
                    }
                }
                else {
                    // Even if focus is preserved make sure to activate the group.
                    // If a new active editor is selected, keep the current selection on key
                    // down such that drag and drop can operate over the selection. The selection
                    // is removed on key up in this case.
                    const inactiveSelection = this.tabsModel.isSelected(editor) ? this.groupView.selectedEditors.filter(e => !e.matches(editor)) : [];
                    await this.groupView.openEditor(editor, { preserveFocus, activation: EditorActivation.ACTIVATE }, { inactiveSelection, focusTabControl: true });
                }
            }
        };
        const showContextMenu = (e) => {
            EventHelper.stop(e);
            const editor = this.tabsModel.getEditorByIndex(tabIndex);
            if (editor) {
                this.onTabContextMenu(editor, e, tab);
            }
        };
        // Open on Click / Touch
        disposables.add(addDisposableListener(tab, EventType.MOUSE_DOWN, e => handleClickOrTouch(e, false)));
        disposables.add(addDisposableListener(tab, TouchEventType.Tap, (e) => handleClickOrTouch(e, true))); // Preserve focus on touch #125470
        // Touch Scroll Support
        disposables.add(addDisposableListener(tab, TouchEventType.Change, (e) => {
            tabsScrollbar.setScrollPosition({ scrollLeft: tabsScrollbar.getScrollPosition().scrollLeft - e.translationX });
        }));
        // Update selection & prevent flicker of focus outline on tab until editor got focus
        disposables.add(addDisposableListener(tab, EventType.MOUSE_UP, async (e) => {
            EventHelper.stop(e);
            tab.blur();
            if (isMouseEvent(e) && (e.button !== 0 /* middle/right mouse button */ || (isMacintosh && e.ctrlKey /* macOS context menu */))) {
                return;
            }
            if (this.originatesFromTabActionBar(e)) {
                return; // not when clicking on actions
            }
            const isCtrlCmd = (e.ctrlKey && !isMacintosh) || (e.metaKey && isMacintosh);
            if (!isCtrlCmd && !e.shiftKey && this.groupView.selectedEditors.length > 1) {
                await this.unselectAllEditors();
            }
        }));
        // Close on mouse middle click
        disposables.add(addDisposableListener(tab, EventType.AUXCLICK, e => {
            if (e.button === 1 /* Middle Button*/) {
                EventHelper.stop(e, true /* for https://github.com/microsoft/vscode/issues/56715 */);
                const editor = this.tabsModel.getEditorByIndex(tabIndex);
                if (editor) {
                    if (preventEditorClose(this.tabsModel, editor, EditorCloseMethod.MOUSE, this.groupsView.partOptions)) {
                        return;
                    }
                    this.blockRevealActiveTabOnce();
                    this.closeEditorAction.run({ groupId: this.groupView.id, editorIndex: this.groupView.getIndexOfEditor(editor) });
                }
            }
        }));
        // Context menu on Shift+F10
        disposables.add(addDisposableListener(tab, EventType.KEY_DOWN, e => {
            const event = new StandardKeyboardEvent(e);
            if (event.shiftKey && event.keyCode === 68 /* KeyCode.F10 */) {
                showContextMenu(e);
            }
        }));
        // Context menu on touch context menu gesture
        disposables.add(addDisposableListener(tab, TouchEventType.Contextmenu, (e) => {
            showContextMenu(e);
        }));
        // Keyboard accessibility
        disposables.add(addDisposableListener(tab, EventType.KEY_UP, e => {
            const event = new StandardKeyboardEvent(e);
            let handled = false;
            // Run action on Enter/Space
            if (event.equals(3 /* KeyCode.Enter */) || event.equals(10 /* KeyCode.Space */)) {
                handled = true;
                const editor = this.tabsModel.getEditorByIndex(tabIndex);
                if (editor) {
                    this.groupView.openEditor(editor);
                }
            }
            // Navigate in editors
            else if ([15 /* KeyCode.LeftArrow */, 17 /* KeyCode.RightArrow */, 16 /* KeyCode.UpArrow */, 18 /* KeyCode.DownArrow */, 14 /* KeyCode.Home */, 13 /* KeyCode.End */].some(kb => event.equals(kb))) {
                let editorIndex = this.toEditorIndex(tabIndex);
                if (event.equals(15 /* KeyCode.LeftArrow */) || event.equals(16 /* KeyCode.UpArrow */)) {
                    editorIndex = editorIndex - 1;
                }
                else if (event.equals(17 /* KeyCode.RightArrow */) || event.equals(18 /* KeyCode.DownArrow */)) {
                    editorIndex = editorIndex + 1;
                }
                else if (event.equals(14 /* KeyCode.Home */)) {
                    editorIndex = 0;
                }
                else {
                    editorIndex = this.groupView.count - 1;
                }
                const target = this.groupView.getEditorByIndex(editorIndex);
                if (target) {
                    handled = true;
                    this.groupView.openEditor(target, { preserveFocus: true }, { focusTabControl: true });
                }
            }
            if (handled) {
                EventHelper.stop(e, true);
            }
            // moving in the tabs container can have an impact on scrolling position, so we need to update the custom scrollbar
            tabsScrollbar.setScrollPosition({
                scrollLeft: tabsContainer.scrollLeft
            });
        }));
        // Double click: either pin or toggle maximized
        for (const eventType of [TouchEventType.Tap, EventType.DBLCLICK]) {
            disposables.add(addDisposableListener(tab, eventType, (e) => {
                if (eventType === EventType.DBLCLICK) {
                    EventHelper.stop(e);
                }
                else if (e.tapCount !== 2) {
                    return; // ignore single taps
                }
                const editor = this.tabsModel.getEditorByIndex(tabIndex);
                if (editor && this.tabsModel.isPinned(editor)) {
                    switch (this.groupsView.partOptions.doubleClickTabToToggleEditorGroupSizes) {
                        case 'maximize':
                            this.groupsView.toggleMaximizeGroup(this.groupView);
                            break;
                        case 'expand':
                            this.groupsView.toggleExpandGroup(this.groupView);
                            break;
                        case 'off':
                            break;
                    }
                }
                else {
                    this.groupView.pinEditor(editor);
                }
            }));
        }
        // Context menu
        disposables.add(addDisposableListener(tab, EventType.CONTEXT_MENU, e => {
            EventHelper.stop(e, true);
            const editor = this.tabsModel.getEditorByIndex(tabIndex);
            if (editor) {
                this.onTabContextMenu(editor, e, tab);
            }
        }, true /* use capture to fix https://github.com/microsoft/vscode/issues/19145 */));
        // Drag & Drop support
        let lastDragEvent = undefined;
        let isNewWindowOperation = false;
        disposables.add(new DragAndDropObserver(tab, {
            onDragStart: e => {
                const editor = this.tabsModel.getEditorByIndex(tabIndex);
                if (!editor) {
                    return;
                }
                isNewWindowOperation = this.isNewWindowOperation(e);
                const selectedEditors = this.groupView.selectedEditors;
                this.editorTransfer.setData(selectedEditors.map(e => new DraggedEditorIdentifier({ editor: e, groupId: this.groupView.id })), DraggedEditorIdentifier.prototype);
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'copyMove';
                    if (selectedEditors.length > 1) {
                        const label = `${editor.getName()} + ${selectedEditors.length - 1}`;
                        applyDragImage(e, tab, label);
                    }
                    else {
                        e.dataTransfer.setDragImage(tab, 0, 0); // top left corner of dragged tab set to cursor position to make room for drop-border feedback
                    }
                }
                // Apply some datatransfer types to allow for dragging the element outside of the application
                this.doFillResourceDataTransfers(selectedEditors, e, isNewWindowOperation);
                scheduleAtNextAnimationFrame(getWindow(this.parent), () => this.updateDropFeedback(tab, false, e, tabIndex));
            },
            onDrag: e => {
                lastDragEvent = e;
            },
            onDragEnter: e => {
                // Return if transfer is unsupported
                if (!this.isSupportedDropTransfer(e)) {
                    if (e.dataTransfer) {
                        e.dataTransfer.dropEffect = 'none';
                    }
                    return;
                }
                // Update the dropEffect to "copy" if there is no local data to be dragged because
                // in that case we can only copy the data into and not move it from its source
                if (!this.editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
                    if (e.dataTransfer) {
                        e.dataTransfer.dropEffect = 'copy';
                    }
                }
                this.updateDropFeedback(tab, true, e, tabIndex);
            },
            onDragOver: (e, dragDuration) => {
                if (dragDuration >= MultiEditorTabsControl_1.DRAG_OVER_OPEN_TAB_THRESHOLD) {
                    const draggedOverTab = this.tabsModel.getEditorByIndex(tabIndex);
                    if (draggedOverTab && this.tabsModel.activeEditor !== draggedOverTab) {
                        this.groupView.openEditor(draggedOverTab, { preserveFocus: true });
                    }
                }
                this.updateDropFeedback(tab, true, e, tabIndex);
            },
            onDragEnd: async (e) => {
                this.updateDropFeedback(tab, false, e, tabIndex);
                const draggedEditors = this.editorTransfer.getData(DraggedEditorIdentifier.prototype);
                this.editorTransfer.clearData(DraggedEditorIdentifier.prototype);
                if (!isNewWindowOperation ||
                    isWindowDraggedOver() ||
                    !draggedEditors ||
                    draggedEditors.length === 0) {
                    return; // drag to open in new window is disabled
                }
                const auxiliaryEditorPart = await this.maybeCreateAuxiliaryEditorPartAt(e, tab);
                if (!auxiliaryEditorPart) {
                    return;
                }
                const targetGroup = auxiliaryEditorPart.activeGroup;
                const editorsWithOptions = prepareMoveCopyEditors(this.groupView, draggedEditors.map(editor => editor.identifier.editor));
                if (this.isMoveOperation(lastDragEvent ?? e, targetGroup.id, draggedEditors[0].identifier.editor)) {
                    this.groupView.moveEditors(editorsWithOptions, targetGroup);
                }
                else {
                    this.groupView.copyEditors(editorsWithOptions, targetGroup);
                }
                targetGroup.focus();
            },
            onDrop: e => {
                this.updateDropFeedback(tab, false, e, tabIndex);
                // compute the target index
                let targetIndex = tabIndex;
                if (this.getTabDragOverLocation(e, tab) === 'right') {
                    targetIndex++;
                }
                this.onDrop(e, targetIndex, tabsContainer);
            }
        }));
        return disposables;
    }
    isSupportedDropTransfer(e) {
        if (this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype)) {
            const data = this.groupTransfer.getData(DraggedEditorGroupIdentifier.prototype);
            if (Array.isArray(data) && data.length > 0) {
                const group = data[0];
                if (group.identifier === this.groupView.id) {
                    return false; // groups cannot be dropped on group it originates from
                }
            }
            return true;
        }
        if (this.editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
            return true; // (local) editors can always be dropped
        }
        if (e.dataTransfer && e.dataTransfer.types.length > 0) {
            return true; // optimistically allow external data (// see https://github.com/microsoft/vscode/issues/25789)
        }
        return false;
    }
    updateDropFeedback(element, isDND, e, tabIndex) {
        const isTab = (typeof tabIndex === 'number');
        let dropTarget;
        if (isDND) {
            if (isTab) {
                dropTarget = this.computeDropTarget(e, tabIndex, element);
            }
            else {
                dropTarget = { leftElement: element.lastElementChild, rightElement: undefined };
            }
        }
        else {
            dropTarget = undefined;
        }
        this.updateDropTarget(dropTarget);
    }
    updateDropTarget(newTarget) {
        const oldTargets = this.dropTarget;
        if (oldTargets === newTarget || oldTargets && newTarget && oldTargets.leftElement === newTarget.leftElement && oldTargets.rightElement === newTarget.rightElement) {
            return;
        }
        const dropClassLeft = 'drop-target-left';
        const dropClassRight = 'drop-target-right';
        if (oldTargets) {
            oldTargets.leftElement?.classList.remove(dropClassLeft);
            oldTargets.rightElement?.classList.remove(dropClassRight);
        }
        if (newTarget) {
            newTarget.leftElement?.classList.add(dropClassLeft);
            newTarget.rightElement?.classList.add(dropClassRight);
        }
        this.dropTarget = newTarget;
    }
    getTabDragOverLocation(e, tab) {
        const rect = tab.getBoundingClientRect();
        const offsetXRelativeToParent = e.clientX - rect.left;
        return offsetXRelativeToParent <= rect.width / 2 ? 'left' : 'right';
    }
    computeDropTarget(e, tabIndex, targetTab) {
        const isLeftSideOfTab = this.getTabDragOverLocation(e, targetTab) === 'left';
        const isLastTab = tabIndex === this.tabsModel.count - 1;
        const isFirstTab = tabIndex === 0;
        // Before first tab
        if (isLeftSideOfTab && isFirstTab) {
            return { leftElement: undefined, rightElement: targetTab };
        }
        // After last tab
        if (!isLeftSideOfTab && isLastTab) {
            return { leftElement: targetTab, rightElement: undefined };
        }
        // Between two tabs
        const tabBefore = isLeftSideOfTab ? targetTab.previousElementSibling : targetTab;
        const tabAfter = isLeftSideOfTab ? targetTab : targetTab.nextElementSibling;
        return { leftElement: tabBefore, rightElement: tabAfter };
    }
    async selectEditor(editor) {
        if (this.groupView.isActive(editor)) {
            return;
        }
        await this.groupView.setSelection(editor, this.groupView.selectedEditors);
    }
    async selectEditorsBetween(target, anchor) {
        const editorIndex = this.groupView.getIndexOfEditor(target);
        if (editorIndex === -1) {
            throw new BugIndicatingError();
        }
        const anchorEditorIndex = this.groupView.getIndexOfEditor(anchor);
        if (anchorEditorIndex === -1) {
            throw new BugIndicatingError();
        }
        let selection = this.groupView.selectedEditors;
        // Unselect editors on other side of anchor in relation to the target
        let currentEditorIndex = anchorEditorIndex;
        while (currentEditorIndex >= 0 && currentEditorIndex <= this.groupView.count - 1) {
            currentEditorIndex = anchorEditorIndex < editorIndex ? currentEditorIndex - 1 : currentEditorIndex + 1;
            const currentEditor = this.groupView.getEditorByIndex(currentEditorIndex);
            if (!currentEditor) {
                break;
            }
            if (!this.groupView.isSelected(currentEditor)) {
                break;
            }
            selection = selection.filter(editor => !editor.matches(currentEditor));
        }
        // Select editors between anchor and target
        const fromEditorIndex = anchorEditorIndex < editorIndex ? anchorEditorIndex : editorIndex;
        const toEditorIndex = anchorEditorIndex < editorIndex ? editorIndex : anchorEditorIndex;
        const editorsToSelect = this.groupView.getEditors(1 /* EditorsOrder.SEQUENTIAL */).slice(fromEditorIndex, toEditorIndex + 1);
        for (const editor of editorsToSelect) {
            if (!this.groupView.isSelected(editor)) {
                selection.push(editor);
            }
        }
        const inactiveSelectedEditors = selection.filter(editor => !editor.matches(target));
        await this.groupView.setSelection(target, inactiveSelectedEditors);
    }
    async unselectEditor(editor) {
        const isUnselectingActiveEditor = this.groupView.isActive(editor);
        // If there is only one editor selected, do not unselect it
        if (isUnselectingActiveEditor && this.groupView.selectedEditors.length === 1) {
            return;
        }
        let newActiveEditor = assertReturnsDefined(this.groupView.activeEditor);
        // If active editor is bing unselected then find the most recently opened selected editor
        // that is not the editor being unselected
        if (isUnselectingActiveEditor) {
            const recentEditors = this.groupView.getEditors(0 /* EditorsOrder.MOST_RECENTLY_ACTIVE */);
            for (let i = 1; i < recentEditors.length; i++) { // First one is the active editor
                const recentEditor = recentEditors[i];
                if (this.groupView.isSelected(recentEditor)) {
                    newActiveEditor = recentEditor;
                    break;
                }
            }
        }
        const inactiveSelectedEditors = this.groupView.selectedEditors.filter(e => !e.matches(editor) && !e.matches(newActiveEditor));
        await this.groupView.setSelection(newActiveEditor, inactiveSelectedEditors);
    }
    async unselectAllEditors() {
        if (this.groupView.selectedEditors.length > 1) {
            const activeEditor = assertReturnsDefined(this.groupView.activeEditor);
            await this.groupView.setSelection(activeEditor, []);
        }
    }
    computeTabLabels() {
        const { labelFormat } = this.groupsView.partOptions;
        const { verbosity, shortenDuplicates } = this.getLabelConfigFlags(labelFormat);
        // Build labels and descriptions for each editor
        const labels = [];
        let activeEditorTabIndex = -1;
        this.tabsModel.getEditors(1 /* EditorsOrder.SEQUENTIAL */).forEach((editor, tabIndex) => {
            labels.push({
                editor,
                name: editor.getName(),
                description: editor.getDescription(verbosity),
                forceDescription: editor.hasCapability(64 /* EditorInputCapabilities.ForceDescription */),
                title: editor.getTitle(2 /* Verbosity.LONG */),
                ariaLabel: computeEditorAriaLabel(editor, tabIndex, this.groupView, this.editorPartsView.count)
            });
            if (editor === this.tabsModel.activeEditor) {
                activeEditorTabIndex = tabIndex;
            }
        });
        // Shorten labels as needed
        if (shortenDuplicates) {
            this.shortenTabLabels(labels);
        }
        // Remember for fast lookup
        this.tabLabels = labels;
        this.activeTabLabel = labels[activeEditorTabIndex];
    }
    shortenTabLabels(labels) {
        // Gather duplicate titles, while filtering out invalid descriptions
        const mapNameToDuplicates = new Map();
        for (const label of labels) {
            if (typeof label.description === 'string') {
                getOrSet(mapNameToDuplicates, label.name, []).push(label);
            }
            else {
                label.description = '';
            }
        }
        // Identify duplicate names and shorten descriptions
        for (const [, duplicateLabels] of mapNameToDuplicates) {
            // Remove description if the title isn't duplicated
            // and we have no indication to enforce description
            if (duplicateLabels.length === 1 && !duplicateLabels[0].forceDescription) {
                duplicateLabels[0].description = '';
                continue;
            }
            // Identify duplicate descriptions
            const mapDescriptionToDuplicates = new Map();
            for (const duplicateLabel of duplicateLabels) {
                getOrSet(mapDescriptionToDuplicates, duplicateLabel.description, []).push(duplicateLabel);
            }
            // For editors with duplicate descriptions, check whether any long descriptions differ
            let useLongDescriptions = false;
            for (const [, duplicateLabels] of mapDescriptionToDuplicates) {
                if (!useLongDescriptions && duplicateLabels.length > 1) {
                    const [first, ...rest] = duplicateLabels.map(({ editor }) => editor.getDescription(2 /* Verbosity.LONG */));
                    useLongDescriptions = rest.some(description => description !== first);
                }
            }
            // If so, replace all descriptions with long descriptions
            if (useLongDescriptions) {
                mapDescriptionToDuplicates.clear();
                for (const duplicateLabel of duplicateLabels) {
                    duplicateLabel.description = duplicateLabel.editor.getDescription(2 /* Verbosity.LONG */);
                    getOrSet(mapDescriptionToDuplicates, duplicateLabel.description, []).push(duplicateLabel);
                }
            }
            // Obtain final set of descriptions
            const descriptions = [];
            for (const [description] of mapDescriptionToDuplicates) {
                descriptions.push(description);
            }
            // Remove description if all descriptions are identical unless forced
            if (descriptions.length === 1) {
                for (const label of mapDescriptionToDuplicates.get(descriptions[0]) || []) {
                    if (!label.forceDescription) {
                        label.description = '';
                    }
                }
                continue;
            }
            // Shorten descriptions
            const shortenedDescriptions = shorten(descriptions, this.path.sep);
            descriptions.forEach((description, tabIndex) => {
                for (const label of mapDescriptionToDuplicates.get(description) || []) {
                    label.description = shortenedDescriptions[tabIndex];
                }
            });
        }
    }
    getLabelConfigFlags(value) {
        switch (value) {
            case 'short':
                return { verbosity: 0 /* Verbosity.SHORT */, shortenDuplicates: false };
            case 'medium':
                return { verbosity: 1 /* Verbosity.MEDIUM */, shortenDuplicates: false };
            case 'long':
                return { verbosity: 2 /* Verbosity.LONG */, shortenDuplicates: false };
            default:
                return { verbosity: 1 /* Verbosity.MEDIUM */, shortenDuplicates: true };
        }
    }
    redraw(options) {
        // Border below tabs if any with explicit high contrast support
        if (this.tabsAndActionsContainer) {
            let tabsContainerBorderColor = this.getColor(EDITOR_GROUP_HEADER_TABS_BORDER);
            if (!tabsContainerBorderColor && isHighContrast(this.theme.type)) {
                tabsContainerBorderColor = this.getColor(TAB_BORDER) || this.getColor(contrastBorder);
            }
            if (tabsContainerBorderColor) {
                this.tabsAndActionsContainer.classList.add('tabs-border-bottom');
                this.tabsAndActionsContainer.style.setProperty('--tabs-border-bottom-color', tabsContainerBorderColor.toString());
            }
            else {
                this.tabsAndActionsContainer.classList.remove('tabs-border-bottom');
                this.tabsAndActionsContainer.style.removeProperty('--tabs-border-bottom-color');
            }
        }
        // For each tab
        this.forEachTab((editor, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar) => {
            this.redrawTab(editor, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar);
        });
        // Update Editor Actions Toolbar
        this.updateEditorActionsToolbar();
        // Ensure the active tab is always revealed
        this.layout(this.dimensions, options);
    }
    redrawTab(editor, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar) {
        const isTabSticky = this.tabsModel.isSticky(tabIndex);
        const options = this.groupsView.partOptions;
        // Label
        this.redrawTabLabel(editor, tabIndex, tabContainer, tabLabelWidget, tabLabel);
        // Action
        const hasUnpinAction = isTabSticky && options.tabActionUnpinVisibility;
        const hasCloseAction = !hasUnpinAction && options.tabActionCloseVisibility;
        const hasAction = hasUnpinAction || hasCloseAction;
        let tabAction;
        if (hasAction) {
            tabAction = hasUnpinAction ? this.unpinEditorAction : this.closeEditorAction;
        }
        else {
            // Even if the action is not visible, add it as it contains the dirty indicator
            tabAction = isTabSticky ? this.unpinEditorAction : this.closeEditorAction;
        }
        if (!tabActionBar.hasAction(tabAction)) {
            if (!tabActionBar.isEmpty()) {
                tabActionBar.clear();
            }
            tabActionBar.push(tabAction, { icon: true, label: false, keybinding: this.getKeybindingLabel(tabAction) });
        }
        tabContainer.classList.toggle(`pinned-action-off`, isTabSticky && !hasUnpinAction);
        tabContainer.classList.toggle(`close-action-off`, !hasUnpinAction && !hasCloseAction);
        for (const option of ['left', 'right']) {
            tabContainer.classList.toggle(`tab-actions-${option}`, hasAction && options.tabActionLocation === option);
        }
        const tabSizing = isTabSticky && options.pinnedTabSizing === 'shrink' ? 'shrink' /* treat sticky shrink tabs as tabSizing: 'shrink' */ : options.tabSizing;
        for (const option of ['fit', 'shrink', 'fixed']) {
            tabContainer.classList.toggle(`sizing-${option}`, tabSizing === option);
        }
        tabContainer.classList.toggle('has-icon', options.showIcons && options.hasIcons);
        tabContainer.classList.toggle('sticky', isTabSticky);
        for (const option of ['normal', 'compact', 'shrink']) {
            tabContainer.classList.toggle(`sticky-${option}`, isTabSticky && options.pinnedTabSizing === option);
        }
        // If not wrapping tabs, sticky compact/shrink tabs need a position to remain at their location
        // when scrolling to stay in view (requirement for position: sticky)
        if (!options.wrapTabs && isTabSticky && options.pinnedTabSizing !== 'normal') {
            let stickyTabWidth = 0;
            switch (options.pinnedTabSizing) {
                case 'compact':
                    stickyTabWidth = MultiEditorTabsControl_1.TAB_WIDTH.compact;
                    break;
                case 'shrink':
                    stickyTabWidth = MultiEditorTabsControl_1.TAB_WIDTH.shrink;
                    break;
            }
            tabContainer.style.left = `${tabIndex * stickyTabWidth}px`;
        }
        else {
            tabContainer.style.left = 'auto';
        }
        // Borders / outline
        this.redrawTabBorders(tabIndex, tabContainer);
        // Selection / active / dirty state
        this.redrawTabSelectedActiveAndDirty(this.groupsView.activeGroup === this.groupView, editor, tabContainer, tabActionBar);
    }
    redrawTabLabel(editor, tabIndex, tabContainer, tabLabelWidget, tabLabel) {
        const options = this.groupsView.partOptions;
        // Unless tabs are sticky compact, show the full label and description
        // Sticky compact tabs will only show an icon if icons are enabled
        // or their first character of the name otherwise
        let name;
        let namePrefix;
        let forceLabel = false;
        let fileDecorationBadges = Boolean(options.decorations?.badges);
        const fileDecorationColors = Boolean(options.decorations?.colors);
        let description;
        if (options.pinnedTabSizing === 'compact' && this.tabsModel.isSticky(tabIndex)) {
            const isShowingIcons = options.showIcons && options.hasIcons;
            name = isShowingIcons ? '' : tabLabel.name?.charAt(0).toUpperCase();
            description = '';
            forceLabel = true;
            fileDecorationBadges = false; // not enough space when sticky tabs are compact
        }
        else {
            name = tabLabel.name;
            namePrefix = options.showTabIndex ? `${this.toEditorIndex(tabIndex) + 1}: ` : undefined;
            description = tabLabel.description || '';
        }
        if (tabLabel.ariaLabel) {
            tabContainer.setAttribute('aria-label', tabLabel.ariaLabel);
            // Set aria-description to empty string so that screen readers would not read the title as well
            // More details https://github.com/microsoft/vscode/issues/95378
            tabContainer.setAttribute('aria-description', '');
        }
        // Label
        tabLabelWidget.setResource({ name, description, resource: EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.BOTH }) }, {
            title: this.getHoverTitle(editor),
            extraClasses: coalesce(['tab-label', fileDecorationBadges ? 'tab-label-has-badge' : undefined].concat(editor.getLabelExtraClasses())),
            italic: !this.tabsModel.isPinned(editor),
            forceLabel,
            fileDecorations: {
                colors: fileDecorationColors,
                badges: fileDecorationBadges
            },
            icon: editor.getIcon(),
            hideIcon: options.showIcons === false,
            namePrefix,
        });
        // Tests helper
        const resource = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
        if (resource) {
            tabContainer.setAttribute('data-resource-name', basenameOrAuthority(resource));
        }
        else {
            tabContainer.removeAttribute('data-resource-name');
        }
    }
    redrawTabSelectedActiveAndDirty(isGroupActive, editor, tabContainer, tabActionBar) {
        const isTabActive = this.tabsModel.isActive(editor);
        const hasModifiedBorderTop = this.doRedrawTabDirty(isGroupActive, isTabActive, editor, tabContainer);
        this.doRedrawTabActive(isGroupActive, !hasModifiedBorderTop, editor, tabContainer, tabActionBar);
    }
    doRedrawTabActive(isGroupActive, allowBorderTop, editor, tabContainer, tabActionBar) {
        const isActive = this.tabsModel.isActive(editor);
        const isSelected = this.tabsModel.isSelected(editor);
        tabContainer.classList.toggle('active', isActive);
        tabContainer.classList.toggle('selected', isSelected);
        tabContainer.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tabContainer.tabIndex = isActive ? 0 : -1; // Only active tab can be focused into
        tabActionBar.setFocusable(isActive);
        // Set border BOTTOM if theme defined color
        if (isActive) {
            const activeTabBorderColorBottom = this.getColor(isGroupActive ? TAB_ACTIVE_BORDER : TAB_UNFOCUSED_ACTIVE_BORDER);
            tabContainer.classList.toggle('tab-border-bottom', !!activeTabBorderColorBottom);
            tabContainer.style.setProperty('--tab-border-bottom-color', activeTabBorderColorBottom ?? '');
        }
        // Set border TOP if theme defined color
        let tabBorderColorTop = null;
        if (allowBorderTop) {
            if (isActive) {
                tabBorderColorTop = this.getColor(isGroupActive ? TAB_ACTIVE_BORDER_TOP : TAB_UNFOCUSED_ACTIVE_BORDER_TOP);
            }
            if (tabBorderColorTop === null && isSelected) {
                tabBorderColorTop = this.getColor(TAB_SELECTED_BORDER_TOP);
            }
        }
        tabContainer.classList.toggle('tab-border-top', !!tabBorderColorTop);
        tabContainer.style.setProperty('--tab-border-top-color', tabBorderColorTop ?? '');
    }
    doRedrawTabDirty(isGroupActive, isTabActive, editor, tabContainer) {
        let hasModifiedBorderColor = false;
        // Tab: dirty (unless saving)
        if (editor.isDirty() && !editor.isSaving()) {
            tabContainer.classList.add('dirty');
            // Highlight modified tabs with a border if configured
            if (this.groupsView.partOptions.highlightModifiedTabs) {
                let modifiedBorderColor;
                if (isGroupActive && isTabActive) {
                    modifiedBorderColor = this.getColor(TAB_ACTIVE_MODIFIED_BORDER);
                }
                else if (isGroupActive && !isTabActive) {
                    modifiedBorderColor = this.getColor(TAB_INACTIVE_MODIFIED_BORDER);
                }
                else if (!isGroupActive && isTabActive) {
                    modifiedBorderColor = this.getColor(TAB_UNFOCUSED_ACTIVE_MODIFIED_BORDER);
                }
                else {
                    modifiedBorderColor = this.getColor(TAB_UNFOCUSED_INACTIVE_MODIFIED_BORDER);
                }
                if (modifiedBorderColor) {
                    hasModifiedBorderColor = true;
                    tabContainer.classList.add('dirty-border-top');
                    tabContainer.style.setProperty('--tab-dirty-border-top-color', modifiedBorderColor);
                }
            }
            else {
                tabContainer.classList.remove('dirty-border-top');
                tabContainer.style.removeProperty('--tab-dirty-border-top-color');
            }
        }
        // Tab: not dirty
        else {
            tabContainer.classList.remove('dirty', 'dirty-border-top');
            tabContainer.style.removeProperty('--tab-dirty-border-top-color');
        }
        return hasModifiedBorderColor;
    }
    redrawTabBorders(tabIndex, tabContainer) {
        const isTabSticky = this.tabsModel.isSticky(tabIndex);
        const isTabLastSticky = isTabSticky && this.tabsModel.stickyCount === tabIndex + 1;
        const showLastStickyTabBorderColor = this.tabsModel.stickyCount !== this.tabsModel.count;
        // Borders / Outline
        const borderRightColor = ((isTabLastSticky && showLastStickyTabBorderColor ? this.getColor(TAB_LAST_PINNED_BORDER) : undefined) || this.getColor(TAB_BORDER) || this.getColor(contrastBorder));
        tabContainer.style.borderRight = borderRightColor ? `1px solid ${borderRightColor}` : '';
        tabContainer.style.outlineColor = this.getColor(activeContrastBorder) || '';
    }
    prepareEditorActions(editorActions) {
        const isGroupActive = this.groupsView.activeGroup === this.groupView;
        // Active: allow all actions
        if (isGroupActive) {
            return editorActions;
        }
        // Inactive: only show "Unlock" and secondary actions
        else {
            return {
                primary: this.groupsView.partOptions.alwaysShowEditorActions ? editorActions.primary : editorActions.primary.filter(action => action.id === UNLOCK_GROUP_COMMAND_ID),
                secondary: editorActions.secondary
            };
        }
    }
    getHeight() {
        // Return quickly if our used dimensions are known
        if (this.dimensions.used) {
            return this.dimensions.used.height;
        }
        // Otherwise compute via browser APIs
        else {
            return this.computeHeight();
        }
    }
    computeHeight() {
        let height;
        if (!this.visible) {
            height = 0;
        }
        else if (this.groupsView.partOptions.wrapTabs && this.tabsAndActionsContainer?.classList.contains('wrapping')) {
            // Wrap: we need to ask `offsetHeight` to get
            // the real height of the title area with wrapping.
            height = this.tabsAndActionsContainer.offsetHeight;
        }
        else {
            height = this.tabHeight;
        }
        return height;
    }
    layout(dimensions, options) {
        // Remember dimensions that we get
        Object.assign(this.dimensions, dimensions);
        if (this.visible) {
            if (!this.layoutScheduler.value) {
                // The layout of tabs can be an expensive operation because we access DOM properties
                // that can result in the browser doing a full page layout to validate them. To buffer
                // this a little bit we try at least to schedule this work on the next animation frame
                // when we have restored or when idle otherwise.
                const disposable = scheduleAtNextAnimationFrame(getWindow(this.parent), () => {
                    this.doLayout(this.dimensions, this.layoutScheduler.value?.options /* ensure to pick up latest options */);
                    this.layoutScheduler.clear();
                });
                this.layoutScheduler.value = { options, dispose: () => disposable.dispose() };
            }
            // Make sure to keep options updated
            if (options?.forceRevealActiveTab) {
                this.layoutScheduler.value.options = {
                    ...this.layoutScheduler.value.options,
                    forceRevealActiveTab: true
                };
            }
        }
        // First time layout: compute the dimensions and store it
        if (!this.dimensions.used) {
            this.dimensions.used = new Dimension(dimensions.container.width, this.computeHeight());
        }
        return this.dimensions.used;
    }
    doLayout(dimensions, options) {
        // Layout tabs
        if (dimensions.container !== Dimension.None && dimensions.available !== Dimension.None) {
            this.doLayoutTabs(dimensions, options);
        }
        // Remember the dimensions used in the control so that we can
        // return it fast from the `layout` call without having to
        // compute it over and over again
        const oldDimension = this.dimensions.used;
        const newDimension = this.dimensions.used = new Dimension(dimensions.container.width, this.computeHeight());
        // In case the height of the title control changed from before
        // (currently only possible if wrapping changed on/off), we need
        // to signal this to the outside via a `relayout` call so that
        // e.g. the editor control can be adjusted accordingly.
        if (oldDimension && oldDimension.height !== newDimension.height) {
            this.groupView.relayout();
        }
    }
    doLayoutTabs(dimensions, options) {
        // Always first layout tabs with wrapping support even if wrapping
        // is disabled. The result indicates if tabs wrap and if not, we
        // need to proceed with the layout without wrapping because even
        // if wrapping is enabled in settings, there are cases where
        // wrapping is disabled (e.g. due to space constraints)
        const tabsWrapMultiLine = this.doLayoutTabsWrapping(dimensions);
        if (!tabsWrapMultiLine) {
            this.doLayoutTabsNonWrapping(options);
        }
    }
    doLayoutTabsWrapping(dimensions) {
        const [tabsAndActionsContainer, tabsContainer, editorToolbarContainer, tabsScrollbar] = assertReturnsAllDefined(this.tabsAndActionsContainer, this.tabsContainer, this.editorActionsToolbarContainer, this.tabsScrollbar);
        // Handle wrapping tabs according to setting:
        // - enabled: only add class if tabs wrap and don't exceed available dimensions
        // - disabled: remove class and margin-right variable
        const didTabsWrapMultiLine = tabsAndActionsContainer.classList.contains('wrapping');
        let tabsWrapMultiLine = didTabsWrapMultiLine;
        function updateTabsWrapping(enabled) {
            tabsWrapMultiLine = enabled;
            // Toggle the `wrapped` class to enable wrapping
            tabsAndActionsContainer.classList.toggle('wrapping', tabsWrapMultiLine);
            // Update `last-tab-margin-right` CSS variable to account for the absolute
            // positioned editor actions container when tabs wrap. The margin needs to
            // be the width of the editor actions container to avoid screen cheese.
            tabsContainer.style.setProperty('--last-tab-margin-right', tabsWrapMultiLine ? `${editorToolbarContainer.offsetWidth}px` : '0');
            // Remove old css classes that are not needed anymore
            for (const tab of tabsContainer.children) {
                tab.classList.remove('last-in-row');
            }
        }
        // Setting enabled: selectively enable wrapping if possible
        if (this.groupsView.partOptions.wrapTabs) {
            const visibleTabsWidth = tabsContainer.offsetWidth;
            const allTabsWidth = tabsContainer.scrollWidth;
            const lastTabFitsWrapped = () => {
                const lastTab = this.getLastTab();
                if (!lastTab) {
                    return true; // no tab always fits
                }
                const lastTabOverlapWithToolbarWidth = lastTab.offsetWidth + editorToolbarContainer.offsetWidth - dimensions.available.width;
                if (lastTabOverlapWithToolbarWidth > 1) {
                    // Allow for slight rounding errors related to zooming here
                    // https://github.com/microsoft/vscode/issues/116385
                    return false;
                }
                return true;
            };
            // If tabs wrap or should start to wrap (when width exceeds visible width)
            // we must trigger `updateWrapping` to set the `last-tab-margin-right`
            // accordingly based on the number of actions. The margin is important to
            // properly position the last tab apart from the actions
            //
            // We already check here if the last tab would fit when wrapped given the
            // editor toolbar will also show right next to it. This ensures we are not
            // enabling wrapping only to disable it again in the code below (this fixes
            // flickering issue https://github.com/microsoft/vscode/issues/115050)
            if (tabsWrapMultiLine || (allTabsWidth > visibleTabsWidth && lastTabFitsWrapped())) {
                updateTabsWrapping(true);
            }
            // Tabs wrap multiline: remove wrapping under certain size constraint conditions
            if (tabsWrapMultiLine) {
                if ((tabsContainer.offsetHeight > dimensions.available.height) || // if height exceeds available height
                    (allTabsWidth === visibleTabsWidth && tabsContainer.offsetHeight === this.tabHeight) || // if wrapping is not needed anymore
                    (!lastTabFitsWrapped()) // if last tab does not fit anymore
                ) {
                    updateTabsWrapping(false);
                }
            }
        }
        // Setting disabled: remove CSS traces only if tabs did wrap
        else if (didTabsWrapMultiLine) {
            updateTabsWrapping(false);
        }
        // If we transitioned from non-wrapping to wrapping, we need
        // to update the scrollbar to have an equal `width` and
        // `scrollWidth`. Otherwise a scrollbar would appear which is
        // never desired when wrapping.
        if (tabsWrapMultiLine && !didTabsWrapMultiLine) {
            const visibleTabsWidth = tabsContainer.offsetWidth;
            tabsScrollbar.setScrollDimensions({
                width: visibleTabsWidth,
                scrollWidth: visibleTabsWidth
            });
        }
        // Update the `last-in-row` class on tabs when wrapping
        // is enabled (it doesn't do any harm otherwise). This
        // class controls additional properties of tab when it is
        // the last tab in a row
        if (tabsWrapMultiLine) {
            // Using a map here to change classes after the for loop is
            // crucial for performance because changing the class on a
            // tab can result in layouts of the rendering engine.
            const tabs = new Map();
            let currentTabsPosY = undefined;
            let lastTab = undefined;
            for (const child of tabsContainer.children) {
                const tab = child;
                const tabPosY = tab.offsetTop;
                // Marks a new or the first row of tabs
                if (tabPosY !== currentTabsPosY) {
                    currentTabsPosY = tabPosY;
                    if (lastTab) {
                        tabs.set(lastTab, true); // previous tab must be last in row then
                    }
                }
                // Always remember last tab and ensure the
                // last-in-row class is not present until
                // we know the tab is last
                lastTab = tab;
                tabs.set(tab, false);
            }
            // Last tab overally is always last-in-row
            if (lastTab) {
                tabs.set(lastTab, true);
            }
            for (const [tab, lastInRow] of tabs) {
                tab.classList.toggle('last-in-row', lastInRow);
            }
        }
        return tabsWrapMultiLine;
    }
    doLayoutTabsNonWrapping(options) {
        const [tabsContainer, tabsScrollbar] = assertReturnsAllDefined(this.tabsContainer, this.tabsScrollbar);
        //
        // Synopsis
        // - allTabsWidth:   			sum of all tab widths
        // - stickyTabsWidth:			sum of all sticky tab widths (unless `pinnedTabSizing: normal`)
        // - visibleContainerWidth: 	size of tab container
        // - availableContainerWidth: 	size of tab container minus size of sticky tabs
        //
        // [------------------------------ All tabs width ---------------------------------------]
        // [------------------- Visible container width -------------------]
        //                         [------ Available container width ------]
        // [ Sticky A ][ Sticky B ][ Tab C ][ Tab D ][ Tab E ][ Tab F ][ Tab G ][ Tab H ][ Tab I ]
        //                 Active Tab Width [-------]
        // [------- Active Tab Pos X -------]
        // [-- Sticky Tabs Width --]
        //
        const visibleTabsWidth = tabsContainer.offsetWidth;
        const allTabsWidth = tabsContainer.scrollWidth;
        // Compute width of sticky tabs depending on pinned tab sizing
        // - compact: sticky-tabs * TAB_SIZES.compact
        // -  shrink: sticky-tabs * TAB_SIZES.shrink
        // -  normal: 0 (sticky tabs inherit look and feel from non-sticky tabs)
        let stickyTabsWidth = 0;
        if (this.tabsModel.stickyCount > 0) {
            let stickyTabWidth = 0;
            switch (this.groupsView.partOptions.pinnedTabSizing) {
                case 'compact':
                    stickyTabWidth = MultiEditorTabsControl_1.TAB_WIDTH.compact;
                    break;
                case 'shrink':
                    stickyTabWidth = MultiEditorTabsControl_1.TAB_WIDTH.shrink;
                    break;
            }
            stickyTabsWidth = this.tabsModel.stickyCount * stickyTabWidth;
        }
        const activeTabAndIndex = this.tabsModel.activeEditor ? this.getTabAndIndex(this.tabsModel.activeEditor) : undefined;
        const [activeTab, activeTabIndex] = activeTabAndIndex ?? [undefined, undefined];
        // Figure out if active tab is positioned static which has an
        // impact on whether to reveal the tab or not later
        let activeTabPositionStatic = this.groupsView.partOptions.pinnedTabSizing !== 'normal' && typeof activeTabIndex === 'number' && this.tabsModel.isSticky(activeTabIndex);
        // Special case: we have sticky tabs but the available space for showing tabs
        // is little enough that we need to disable sticky tabs sticky positioning
        // so that tabs can be scrolled at naturally.
        let availableTabsContainerWidth = visibleTabsWidth - stickyTabsWidth;
        if (this.tabsModel.stickyCount > 0 && availableTabsContainerWidth < MultiEditorTabsControl_1.TAB_WIDTH.fit) {
            tabsContainer.classList.add('disable-sticky-tabs');
            availableTabsContainerWidth = visibleTabsWidth;
            stickyTabsWidth = 0;
            activeTabPositionStatic = false;
        }
        else {
            tabsContainer.classList.remove('disable-sticky-tabs');
        }
        let activeTabPosX;
        let activeTabWidth;
        if (!this.blockRevealActiveTab && activeTab) {
            activeTabPosX = activeTab.offsetLeft;
            activeTabWidth = activeTab.offsetWidth;
        }
        // Update scrollbar
        const { width: oldVisibleTabsWidth, scrollWidth: oldAllTabsWidth } = tabsScrollbar.getScrollDimensions();
        tabsScrollbar.setScrollDimensions({
            width: visibleTabsWidth,
            scrollWidth: allTabsWidth
        });
        const dimensionsChanged = oldVisibleTabsWidth !== visibleTabsWidth || oldAllTabsWidth !== allTabsWidth;
        // Revealing the active tab is skipped under some conditions:
        if (this.blockRevealActiveTab || // explicitly disabled
            typeof activeTabPosX !== 'number' || // invalid dimension
            typeof activeTabWidth !== 'number' || // invalid dimension
            activeTabPositionStatic || // static tab (sticky)
            (!dimensionsChanged && !options?.forceRevealActiveTab) // dimensions did not change and we have low layout priority (https://github.com/microsoft/vscode/issues/133631)
        ) {
            this.blockRevealActiveTab = false;
            return;
        }
        // Reveal the active one
        const tabsContainerScrollPosX = tabsScrollbar.getScrollPosition().scrollLeft;
        const activeTabFits = activeTabWidth <= availableTabsContainerWidth;
        const adjustedActiveTabPosX = activeTabPosX - stickyTabsWidth;
        //
        // Synopsis
        // - adjustedActiveTabPosX: the adjusted tabPosX takes the width of sticky tabs into account
        //   conceptually the scrolling only begins after sticky tabs so in order to reveal a tab fully
        //   the actual position needs to be adjusted for sticky tabs.
        //
        // Tab is overflowing to the right: Scroll minimally until the element is fully visible to the right
        // Note: only try to do this if we actually have enough width to give to show the tab fully!
        //
        // Example: Tab G should be made active and needs to be fully revealed as such.
        //
        // [-------------------------------- All tabs width -----------------------------------------]
        // [-------------------- Visible container width --------------------]
        //                           [----- Available container width -------]
        //     [ Sticky A ][ Sticky B ][ Tab C ][ Tab D ][ Tab E ][ Tab F ][ Tab G ][ Tab H ][ Tab I ]
        //                     Active Tab Width [-------]
        //     [------- Active Tab Pos X -------]
        //                             [-------- Adjusted Tab Pos X -------]
        //     [-- Sticky Tabs Width --]
        //
        //
        if (activeTabFits && tabsContainerScrollPosX + availableTabsContainerWidth < adjustedActiveTabPosX + activeTabWidth) {
            tabsScrollbar.setScrollPosition({
                scrollLeft: tabsContainerScrollPosX + ((adjustedActiveTabPosX + activeTabWidth) /* right corner of tab */ - (tabsContainerScrollPosX + availableTabsContainerWidth) /* right corner of view port */)
            });
        }
        //
        // Tab is overlflowing to the left or does not fit: Scroll it into view to the left
        //
        // Example: Tab C should be made active and needs to be fully revealed as such.
        //
        // [----------------------------- All tabs width ----------------------------------------]
        //     [------------------ Visible container width ------------------]
        //                           [----- Available container width -------]
        // [ Sticky A ][ Sticky B ][ Tab C ][ Tab D ][ Tab E ][ Tab F ][ Tab G ][ Tab H ][ Tab I ]
        //                 Active Tab Width [-------]
        // [------- Active Tab Pos X -------]
        //      Adjusted Tab Pos X []
        // [-- Sticky Tabs Width --]
        //
        //
        else if (tabsContainerScrollPosX > adjustedActiveTabPosX || !activeTabFits) {
            tabsScrollbar.setScrollPosition({
                scrollLeft: adjustedActiveTabPosX
            });
        }
    }
    updateTabsControlVisibility() {
        const tabsAndActionsContainer = assertReturnsDefined(this.tabsAndActionsContainer);
        tabsAndActionsContainer.classList.toggle('empty', !this.visible);
        // Reset dimensions if hidden
        if (!this.visible && this.dimensions) {
            this.dimensions.used = undefined;
        }
    }
    get visible() {
        return this.tabsModel.count > 0;
    }
    getTabAndIndex(editor) {
        const tabIndex = this.tabsModel.indexOf(editor);
        const tab = this.getTabAtIndex(tabIndex);
        if (tab) {
            return [tab, tabIndex];
        }
        return undefined;
    }
    getTabAtIndex(tabIndex) {
        if (tabIndex >= 0) {
            const tabsContainer = assertReturnsDefined(this.tabsContainer);
            return tabsContainer.children[tabIndex];
        }
        return undefined;
    }
    getLastTab() {
        return this.getTabAtIndex(this.tabsModel.count - 1);
    }
    blockRevealActiveTabOnce() {
        // When closing tabs through the tab close button or gesture, the user
        // might want to rapidly close tabs in sequence and as such revealing
        // the active tab after each close would be annoying. As such we block
        // the automated revealing of the active tab once after the close is
        // triggered.
        this.blockRevealActiveTab = true;
    }
    originatesFromTabActionBar(e) {
        let element;
        if (isMouseEvent(e)) {
            element = (e.target || e.srcElement);
        }
        else {
            element = e.initialTarget;
        }
        return !!findParentWithClass(element, 'action-item', 'tab');
    }
    async onDrop(e, targetTabIndex, tabsContainer) {
        EventHelper.stop(e, true);
        this.updateDropFeedback(tabsContainer, false, e, targetTabIndex);
        tabsContainer.classList.remove('scroll');
        let targetEditorIndex = this.tabsModel instanceof UnstickyEditorGroupModel ? targetTabIndex + this.groupView.stickyCount : targetTabIndex;
        const options = {
            sticky: this.tabsModel instanceof StickyEditorGroupModel && this.tabsModel.stickyCount === targetEditorIndex,
            index: targetEditorIndex
        };
        // Check for group transfer
        if (this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype)) {
            const data = this.groupTransfer.getData(DraggedEditorGroupIdentifier.prototype);
            if (Array.isArray(data) && data.length > 0) {
                const sourceGroup = this.editorPartsView.getGroup(data[0].identifier);
                if (sourceGroup) {
                    const mergeGroupOptions = { index: targetEditorIndex };
                    if (!this.isMoveOperation(e, sourceGroup.id)) {
                        mergeGroupOptions.mode = 0 /* MergeGroupMode.COPY_EDITORS */;
                    }
                    this.groupsView.mergeGroup(sourceGroup, this.groupView, mergeGroupOptions);
                }
                this.groupView.focus();
                this.groupTransfer.clearData(DraggedEditorGroupIdentifier.prototype);
            }
        }
        // Check for editor transfer
        else if (this.editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
            const data = this.editorTransfer.getData(DraggedEditorIdentifier.prototype);
            if (Array.isArray(data) && data.length > 0) {
                const sourceGroup = this.editorPartsView.getGroup(data[0].identifier.groupId);
                if (sourceGroup) {
                    for (const de of data) {
                        const editor = de.identifier.editor;
                        // Only allow moving/copying from a single group source
                        if (sourceGroup.id !== de.identifier.groupId) {
                            continue;
                        }
                        // Keep the same order when moving / copying editors within the same group
                        const sourceEditorIndex = sourceGroup.getIndexOfEditor(editor);
                        if (sourceGroup === this.groupView && sourceEditorIndex < targetEditorIndex) {
                            targetEditorIndex--;
                        }
                        if (this.isMoveOperation(e, de.identifier.groupId, editor)) {
                            sourceGroup.moveEditor(editor, this.groupView, { ...options, index: targetEditorIndex });
                        }
                        else {
                            sourceGroup.copyEditor(editor, this.groupView, { ...options, index: targetEditorIndex });
                        }
                        targetEditorIndex++;
                    }
                }
            }
            this.groupView.focus();
            this.editorTransfer.clearData(DraggedEditorIdentifier.prototype);
        }
        // Check for tree items
        else if (this.treeItemsTransfer.hasData(DraggedTreeItemsIdentifier.prototype)) {
            const data = this.treeItemsTransfer.getData(DraggedTreeItemsIdentifier.prototype);
            if (Array.isArray(data) && data.length > 0) {
                const editors = [];
                for (const id of data) {
                    const dataTransferItem = await this.treeViewsDragAndDropService.removeDragOperationTransfer(id.identifier);
                    if (dataTransferItem) {
                        const treeDropData = await extractTreeDropData(dataTransferItem);
                        editors.push(...treeDropData.map(editor => ({ ...editor, options: { ...editor.options, pinned: true, index: targetEditorIndex } })));
                    }
                }
                this.editorService.openEditors(editors, this.groupView, { validateTrust: true });
            }
            this.treeItemsTransfer.clearData(DraggedTreeItemsIdentifier.prototype);
        }
        // Check for URI transfer
        else {
            const dropHandler = this.instantiationService.createInstance(ResourcesDropHandler, { allowWorkspaceOpen: false });
            dropHandler.handleDrop(e, getWindow(this.parent), () => this.groupView, () => this.groupView.focus(), options);
        }
    }
    dispose() {
        super.dispose();
        this.tabDisposables = dispose(this.tabDisposables);
    }
};
MultiEditorTabsControl = MultiEditorTabsControl_1 = __decorate([
    __param(5, IContextMenuService),
    __param(6, IInstantiationService),
    __param(7, IContextKeyService),
    __param(8, IKeybindingService),
    __param(9, INotificationService),
    __param(10, IQuickInputService),
    __param(11, IThemeService),
    __param(12, IEditorService),
    __param(13, IPathService),
    __param(14, ITreeViewsDnDService),
    __param(15, IEditorResolverService),
    __param(16, IHostService)
], MultiEditorTabsControl);
export { MultiEditorTabsControl };
registerThemingParticipant((theme, collector) => {
    // Add bottom border to tabs when wrapping
    const borderColor = theme.getColor(TAB_BORDER);
    if (borderColor) {
        collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container > .title > .tabs-and-actions-container.wrapping .tabs-container > .tab {
				border-bottom: 1px solid ${borderColor};
			}
		`);
    }
    // Styling with Outline color (e.g. high contrast theme)
    const activeContrastBorderColor = theme.getColor(activeContrastBorder);
    if (activeContrastBorderColor) {
        collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container.active > .title .tabs-container > .tab.active,
			.monaco-workbench .part.editor > .content .editor-group-container.active > .title .tabs-container > .tab.active:hover  {
				outline: 1px solid;
				outline-offset: -5px;
			}

			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab.selected:not(.active):not(:hover)  {
				outline: 1px dotted;
				outline-offset: -5px;
			}

			.monaco-workbench .part.editor > .content .editor-group-container.active > .title .tabs-container > .tab.active:focus {
				outline-style: dashed;
			}

			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab.active {
				outline: 1px dotted;
				outline-offset: -5px;
			}

			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab:hover  {
				outline: 1px dashed;
				outline-offset: -5px;
			}

			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab.active > .tab-actions .action-label,
			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab.active:hover > .tab-actions .action-label,
			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab.dirty > .tab-actions .action-label,
			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab.sticky > .tab-actions .action-label,
			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab:hover > .tab-actions .action-label {
				opacity: 1 !important;
			}
		`);
    }
    // High Contrast Border Color for Editor Actions
    const contrastBorderColor = theme.getColor(contrastBorder);
    if (contrastBorderColor) {
        collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container > .title .editor-actions {
				outline: 1px solid ${contrastBorderColor}
			}
		`);
    }
    // Hover Background
    const tabHoverBackground = theme.getColor(TAB_HOVER_BACKGROUND);
    if (tabHoverBackground) {
        collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container.active > .title .tabs-container > .tab:not(.selected):hover {
				background-color: ${tabHoverBackground} !important;
			}
		`);
    }
    const tabUnfocusedHoverBackground = theme.getColor(TAB_UNFOCUSED_HOVER_BACKGROUND);
    if (tabUnfocusedHoverBackground) {
        collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab:not(.selected):hover  {
				background-color: ${tabUnfocusedHoverBackground} !important;
			}
		`);
    }
    // Hover Foreground
    const tabHoverForeground = theme.getColor(TAB_HOVER_FOREGROUND);
    if (tabHoverForeground) {
        collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container.active > .title .tabs-container > .tab:not(.selected):hover  {
				color: ${tabHoverForeground} !important;
			}
		`);
    }
    const tabUnfocusedHoverForeground = theme.getColor(TAB_UNFOCUSED_HOVER_FOREGROUND);
    if (tabUnfocusedHoverForeground) {
        collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab:not(.selected):hover  {
				color: ${tabUnfocusedHoverForeground} !important;
			}
		`);
    }
    // Hover Border
    //
    // Unfortunately we need to copy a lot of CSS over from the
    // multiEditorTabsControl.css because we want to reuse the same
    // styles we already have for the normal bottom-border.
    const tabHoverBorder = theme.getColor(TAB_HOVER_BORDER);
    if (tabHoverBorder) {
        collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container.active > .title .tabs-container > .tab:hover > .tab-border-bottom-container {
				display: block;
				position: absolute;
				left: 0;
				pointer-events: none;
				width: 100%;
				z-index: 10;
				bottom: 0;
				height: 1px;
				background-color: ${tabHoverBorder};
			}
		`);
    }
    const tabUnfocusedHoverBorder = theme.getColor(TAB_UNFOCUSED_HOVER_BORDER);
    if (tabUnfocusedHoverBorder) {
        collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab:hover > .tab-border-bottom-container  {
				display: block;
				position: absolute;
				left: 0;
				pointer-events: none;
				width: 100%;
				z-index: 10;
				bottom: 0;
				height: 1px;
				background-color: ${tabUnfocusedHoverBorder};
			}
		`);
    }
    // Fade out styles via linear gradient (when tabs are set to shrink or fixed)
    // But not when:
    // - in high contrast theme
    // - if we have a contrast border (which draws an outline - https://github.com/microsoft/vscode/issues/109117)
    // - on Safari (https://github.com/microsoft/vscode/issues/108996)
    if (!isHighContrast(theme.type) && !isSafari && !activeContrastBorderColor) {
        const workbenchBackground = WORKBENCH_BACKGROUND(theme);
        const editorBackgroundColor = theme.getColor(editorBackground);
        const editorGroupHeaderTabsBackground = theme.getColor(EDITOR_GROUP_HEADER_TABS_BACKGROUND);
        const editorDragAndDropBackground = theme.getColor(EDITOR_DRAG_AND_DROP_BACKGROUND);
        let adjustedTabBackground;
        if (editorGroupHeaderTabsBackground && editorBackgroundColor) {
            adjustedTabBackground = editorGroupHeaderTabsBackground.flatten(editorBackgroundColor, editorBackgroundColor, workbenchBackground);
        }
        let adjustedTabDragBackground;
        if (editorGroupHeaderTabsBackground && editorBackgroundColor && editorDragAndDropBackground && editorBackgroundColor) {
            adjustedTabDragBackground = editorGroupHeaderTabsBackground.flatten(editorBackgroundColor, editorDragAndDropBackground, editorBackgroundColor, workbenchBackground);
        }
        // Adjust gradient for focused and unfocused hover background
        const makeTabHoverBackgroundRule = (color, colorDrag, hasFocus = false) => `
			.monaco-workbench .part.editor > .content:not(.dragged-over) .editor-group-container${hasFocus ? '.active' : ''} > .title .tabs-container > .tab.sizing-shrink:not(.dragged):not(.sticky-compact):hover > .tab-label > .monaco-icon-label-container::after,
			.monaco-workbench .part.editor > .content:not(.dragged-over) .editor-group-container${hasFocus ? '.active' : ''} > .title .tabs-container > .tab.sizing-fixed:not(.dragged):not(.sticky-compact):hover > .tab-label > .monaco-icon-label-container::after {
				background: linear-gradient(to left, ${color}, transparent) !important;
			}

			.monaco-workbench .part.editor > .content.dragged-over .editor-group-container${hasFocus ? '.active' : ''} > .title .tabs-container > .tab.sizing-shrink:not(.dragged):not(.sticky-compact):hover > .tab-label > .monaco-icon-label-container::after,
			.monaco-workbench .part.editor > .content.dragged-over .editor-group-container${hasFocus ? '.active' : ''} > .title .tabs-container > .tab.sizing-fixed:not(.dragged):not(.sticky-compact):hover > .tab-label > .monaco-icon-label-container::after {
				background: linear-gradient(to left, ${colorDrag}, transparent) !important;
			}
		`;
        // Adjust gradient for (focused) hover background
        if (tabHoverBackground && adjustedTabBackground && adjustedTabDragBackground) {
            const adjustedColor = tabHoverBackground.flatten(adjustedTabBackground);
            const adjustedColorDrag = tabHoverBackground.flatten(adjustedTabDragBackground);
            collector.addRule(makeTabHoverBackgroundRule(adjustedColor, adjustedColorDrag, true));
        }
        // Adjust gradient for unfocused hover background
        if (tabUnfocusedHoverBackground && adjustedTabBackground && adjustedTabDragBackground) {
            const adjustedColor = tabUnfocusedHoverBackground.flatten(adjustedTabBackground);
            const adjustedColorDrag = tabUnfocusedHoverBackground.flatten(adjustedTabDragBackground);
            collector.addRule(makeTabHoverBackgroundRule(adjustedColor, adjustedColorDrag));
        }
        // Adjust gradient for drag and drop background
        if (editorDragAndDropBackground && adjustedTabDragBackground) {
            const adjustedColorDrag = editorDragAndDropBackground.flatten(adjustedTabDragBackground);
            collector.addRule(`
				.monaco-workbench .part.editor > .content.dragged-over .editor-group-container.active > .title .tabs-container > .tab.sizing-shrink.dragged-over:not(.active):not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after,
				.monaco-workbench .part.editor > .content.dragged-over .editor-group-container:not(.active) > .title .tabs-container > .tab.sizing-shrink.dragged-over:not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after,
				.monaco-workbench .part.editor > .content.dragged-over .editor-group-container.active > .title .tabs-container > .tab.sizing-fixed.dragged-over:not(.active):not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after,
				.monaco-workbench .part.editor > .content.dragged-over .editor-group-container:not(.active) > .title .tabs-container > .tab.sizing-fixed.dragged-over:not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after {
					background: linear-gradient(to left, ${adjustedColorDrag}, transparent) !important;
				}
		`);
        }
        const makeTabBackgroundRule = (color, colorDrag, focused, active) => `
				.monaco-workbench .part.editor > .content:not(.dragged-over) .editor-group-container${focused ? '.active' : ':not(.active)'} > .title .tabs-container > .tab.sizing-shrink${active ? '.active' : ''}:not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after,
				.monaco-workbench .part.editor > .content:not(.dragged-over) .editor-group-container${focused ? '.active' : ':not(.active)'} > .title .tabs-container > .tab.sizing-fixed${active ? '.active' : ''}:not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after {
					background: linear-gradient(to left, ${color}, transparent);
				}

				.monaco-workbench .part.editor > .content.dragged-over .editor-group-container${focused ? '.active' : ':not(.active)'} > .title .tabs-container > .tab.sizing-shrink${active ? '.active' : ''}:not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after,
				.monaco-workbench .part.editor > .content.dragged-over .editor-group-container${focused ? '.active' : ':not(.active)'} > .title .tabs-container > .tab.sizing-fixed${active ? '.active' : ''}:not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after {
					background: linear-gradient(to left, ${colorDrag}, transparent);
				}
		`;
        // Adjust gradient for focused active tab background
        const tabActiveBackground = theme.getColor(TAB_ACTIVE_BACKGROUND);
        if (tabActiveBackground && adjustedTabBackground && adjustedTabDragBackground) {
            const adjustedColor = tabActiveBackground.flatten(adjustedTabBackground);
            const adjustedColorDrag = tabActiveBackground.flatten(adjustedTabDragBackground);
            collector.addRule(makeTabBackgroundRule(adjustedColor, adjustedColorDrag, true, true));
        }
        // Adjust gradient for unfocused active tab background
        const tabUnfocusedActiveBackground = theme.getColor(TAB_UNFOCUSED_ACTIVE_BACKGROUND);
        if (tabUnfocusedActiveBackground && adjustedTabBackground && adjustedTabDragBackground) {
            const adjustedColor = tabUnfocusedActiveBackground.flatten(adjustedTabBackground);
            const adjustedColorDrag = tabUnfocusedActiveBackground.flatten(adjustedTabDragBackground);
            collector.addRule(makeTabBackgroundRule(adjustedColor, adjustedColorDrag, false, true));
        }
        // Adjust gradient for focused inactive tab background
        const tabInactiveBackground = theme.getColor(TAB_INACTIVE_BACKGROUND);
        if (tabInactiveBackground && adjustedTabBackground && adjustedTabDragBackground) {
            const adjustedColor = tabInactiveBackground.flatten(adjustedTabBackground);
            const adjustedColorDrag = tabInactiveBackground.flatten(adjustedTabDragBackground);
            collector.addRule(makeTabBackgroundRule(adjustedColor, adjustedColorDrag, true, false));
        }
        // Adjust gradient for unfocused inactive tab background
        const tabUnfocusedInactiveBackground = theme.getColor(TAB_UNFOCUSED_INACTIVE_BACKGROUND);
        if (tabUnfocusedInactiveBackground && adjustedTabBackground && adjustedTabDragBackground) {
            const adjustedColor = tabUnfocusedInactiveBackground.flatten(adjustedTabBackground);
            const adjustedColorDrag = tabUnfocusedInactiveBackground.flatten(adjustedTabDragBackground);
            collector.addRule(makeTabBackgroundRule(adjustedColor, adjustedColorDrag, false, false));
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVsdGlFZGl0b3JUYWJzQ29udHJvbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvbXVsdGlFZGl0b3JUYWJzQ29udHJvbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxvQ0FBb0MsQ0FBQztBQUM1QyxPQUFPLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN0RixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDNUQsT0FBTyxFQUFFLHNCQUFzQixFQUFpQyxnQkFBZ0IsRUFBRSwwQkFBMEIsRUFBZ0Qsa0JBQWtCLEVBQUUsaUJBQWlCLEVBQWlDLE1BQU0sMkJBQTJCLENBQUM7QUFFcFEsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDekQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDbEYsT0FBTyxFQUFFLFNBQVMsSUFBSSxjQUFjLEVBQWdCLE9BQU8sRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRXZHLE9BQU8sRUFBRSxjQUFjLEVBQWtCLHdCQUF3QixFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDM0YsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQy9FLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxNQUFNLEVBQUUs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