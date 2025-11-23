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
var StatusbarPart_1, AuxiliaryStatusbarPart_1;
import './media/statusbarpart.css';
import { localize } from '../../../../nls.js';
import { Disposable, DisposableStore, disposeIfDisposable, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { MultiWindowParts, Part } from '../../part.js';
import { EventType as TouchEventType, Gesture } from '../../../../base/browser/touch.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStatusbarService, isStatusbarEntryLocation, isStatusbarEntryPriority } from '../../../services/statusbar/browser/statusbar.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { Separator, toAction } from '../../../../base/common/actions.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { STATUS_BAR_BACKGROUND, STATUS_BAR_FOREGROUND, STATUS_BAR_NO_FOLDER_BACKGROUND, STATUS_BAR_ITEM_HOVER_BACKGROUND, STATUS_BAR_BORDER, STATUS_BAR_NO_FOLDER_FOREGROUND, STATUS_BAR_NO_FOLDER_BORDER, STATUS_BAR_ITEM_COMPACT_HOVER_BACKGROUND, STATUS_BAR_ITEM_FOCUS_BORDER, STATUS_BAR_FOCUS_BORDER } from '../../../common/theme.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { contrastBorder, activeContrastBorder } from '../../../../platform/theme/common/colorRegistry.js';
import { EventHelper, addDisposableListener, EventType, clearNode, getWindow, isHTMLElement, $ } from '../../../../base/browser/dom.js';
import { createStyleSheet } from '../../../../base/browser/domStylesheets.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { equals } from '../../../../base/common/arrays.js';
import { StandardMouseEvent } from '../../../../base/browser/mouseEvent.js';
import { ToggleStatusbarVisibilityAction } from '../../actions/layoutActions.js';
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { isHighContrast } from '../../../../platform/theme/common/theme.js';
import { hash } from '../../../../base/common/hash.js';
import { WorkbenchHoverDelegate } from '../../../../platform/hover/browser/hover.js';
import { HideStatusbarEntryAction, ManageExtensionAction, ToggleStatusbarEntryVisibilityAction } from './statusbarActions.js';
import { StatusbarViewModel } from './statusbarModel.js';
import { StatusbarEntryItem } from './statusbarItem.js';
import { StatusBarFocused } from '../../../common/contextkeys.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { isManagedHoverTooltipHTMLElement, isManagedHoverTooltipMarkdownString } from '../../../../base/browser/ui/hover/hover.js';
let StatusbarPart = class StatusbarPart extends Part {
    static { StatusbarPart_1 = this; }
    static { this.HEIGHT = 22; }
    constructor(id, instantiationService, themeService, contextService, storageService, layoutService, contextMenuService, contextKeyService) {
        super(id, { hasTitle: false }, themeService, storageService, layoutService);
        this.instantiationService = instantiationService;
        this.contextService = contextService;
        this.contextMenuService = contextMenuService;
        this.contextKeyService = contextKeyService;
        //#region IView
        this.minimumWidth = 0;
        this.maximumWidth = Number.POSITIVE_INFINITY;
        this.minimumHeight = StatusbarPart_1.HEIGHT;
        this.maximumHeight = StatusbarPart_1.HEIGHT;
        this.pendingEntries = [];
        this._onWillDispose = this._register(new Emitter());
        this.onWillDispose = this._onWillDispose.event;
        this.onDidOverrideEntry = this._register(new Emitter());
        this.entryOverrides = new Map();
        this.compactEntriesDisposable = this._register(new MutableDisposable());
        this.styleOverrides = new Set();
        this.viewModel = this._register(new StatusbarViewModel(storageService));
        this.onDidChangeEntryVisibility = this.viewModel.onDidChangeEntryVisibility;
        this.hoverDelegate = this._register(this.instantiationService.createInstance(WorkbenchHoverDelegate, 'element', {
            instantHover: true,
            dynamicDelay(content) {
                if (typeof content === 'function' ||
                    isHTMLElement(content) ||
                    (isManagedHoverTooltipMarkdownString(content) && typeof content.markdown === 'function') ||
                    isManagedHoverTooltipHTMLElement(content)) {
                    // override the delay for content that is rich (e.g. html or long running)
                    // so that it appears more instantly. these hovers carry more important
                    // information and should not be delayed by preference.
                    return 500;
                }
                return undefined;
            }
        }, (_, focus) => ({
            persistence: {
                hideOnKeyDown: true,
                sticky: focus
            },
            appearance: {
                maxHeightRatio: 0.9
            }
        })));
        this.registerListeners();
    }
    registerListeners() {
        // Entry visibility changes
        this._register(this.onDidChangeEntryVisibility(() => this.updateCompactEntries()));
        // Workbench state changes
        this._register(this.contextService.onDidChangeWorkbenchState(() => this.updateStyles()));
    }
    overrideEntry(id, override) {
        this.entryOverrides.set(id, override);
        this.onDidOverrideEntry.fire(id);
        return toDisposable(() => {
            const currentOverride = this.entryOverrides.get(id);
            if (currentOverride === override) {
                this.entryOverrides.delete(id);
                this.onDidOverrideEntry.fire(id);
            }
        });
    }
    withEntryOverride(entry, id) {
        const override = this.entryOverrides.get(id);
        if (override) {
            entry = { ...entry, ...override };
        }
        return entry;
    }
    addEntry(entry, id, alignment, priorityOrLocation = 0) {
        let priority;
        if (isStatusbarEntryPriority(priorityOrLocation)) {
            priority = priorityOrLocation;
        }
        else {
            priority = {
                primary: priorityOrLocation,
                secondary: hash(id) // derive from identifier to accomplish uniqueness
            };
        }
        // As long as we have not been created into a container yet, record all entries
        // that are pending so that they can get created at a later point
        if (!this.element) {
            return this.doAddPendingEntry(entry, id, alignment, priority);
        }
        // Otherwise add to view
        return this.doAddEntry(entry, id, alignment, priority);
    }
    doAddPendingEntry(entry, id, alignment, priority) {
        const pendingEntry = { entry, id, alignment, priority };
        this.pendingEntries.push(pendingEntry);
        const accessor = {
            update: (entry) => {
                if (pendingEntry.accessor) {
                    pendingEntry.accessor.update(entry);
                }
                else {
                    pendingEntry.entry = entry;
                }
            },
            dispose: () => {
                if (pendingEntry.accessor) {
                    pendingEntry.accessor.dispose();
                }
                else {
                    this.pendingEntries = this.pendingEntries.filter(entry => entry !== pendingEntry);
                }
            }
        };
        return accessor;
    }
    doAddEntry(entry, id, alignment, priority) {
        const disposables = new DisposableStore();
        // View model item
        const itemContainer = this.doCreateStatusItem(id, alignment);
        const item = disposables.add(this.instantiationService.createInstance(StatusbarEntryItem, itemContainer, this.withEntryOverride(entry, id), this.hoverDelegate));
        // View model entry
        const viewModelEntry = new class {
            constructor() {
                this.id = id;
                this.extensionId = entry.extensionId;
                this.alignment = alignment;
                this.priority = priority;
                this.container = itemContainer;
                this.labelContainer = item.labelContainer;
            }
            get name() { return item.name; }
            get hasCommand() { return item.hasCommand; }
        };
        // Add to view model
        const { needsFullRefresh } = this.doAddOrRemoveModelEntry(viewModelEntry, true);
        if (needsFullRefresh) {
            this.appendStatusbarEntries();
        }
        else {
            this.appendStatusbarEntry(viewModelEntry);
        }
        let lastEntry = entry;
        const accessor = {
            update: entry => {
                lastEntry = entry;
                item.update(this.withEntryOverride(entry, id));
            },
            dispose: () => {
                const { needsFullRefresh } = this.doAddOrRemoveModelEntry(viewModelEntry, false);
                if (needsFullRefresh) {
                    this.appendStatusbarEntries();
                }
                else {
                    itemContainer.remove();
                    this.updateCompactEntries();
                }
                disposables.dispose();
            }
        };
        // React to overrides
        disposables.add(this.onDidOverrideEntry.event(overrideEntryId => {
            if (overrideEntryId === id) {
                accessor.update(lastEntry);
            }
        }));
        return accessor;
    }
    doCreateStatusItem(id, alignment, ...extraClasses) {
        const itemContainer = $('.statusbar-item', { id });
        if (extraClasses) {
            itemContainer.classList.add(...extraClasses);
        }
        if (alignment === 1 /* StatusbarAlignment.RIGHT */) {
            itemContainer.classList.add('right');
        }
        else {
            itemContainer.classList.add('left');
        }
        return itemContainer;
    }
    doAddOrRemoveModelEntry(entry, add) {
        // Update model but remember previous entries
        const entriesBefore = this.viewModel.entries;
        if (add) {
            this.viewModel.add(entry);
        }
        else {
            this.viewModel.remove(entry);
        }
        const entriesAfter = this.viewModel.entries;
        // Apply operation onto the entries from before
        if (add) {
            entriesBefore.splice(entriesAfter.indexOf(entry), 0, entry);
        }
        else {
            entriesBefore.splice(entriesBefore.indexOf(entry), 1);
        }
        // Figure out if a full refresh is needed by comparing arrays
        const needsFullRefresh = !equals(entriesBefore, entriesAfter);
        return { needsFullRefresh };
    }
    isEntryVisible(id) {
        return !this.viewModel.isHidden(id);
    }
    updateEntryVisibility(id, visible) {
        if (visible) {
            this.viewModel.show(id);
        }
        else {
            this.viewModel.hide(id);
        }
    }
    focusNextEntry() {
        this.viewModel.focusNextEntry();
    }
    focusPreviousEntry() {
        this.viewModel.focusPreviousEntry();
    }
    isEntryFocused() {
        return this.viewModel.isEntryFocused();
    }
    focus(preserveEntryFocus = true) {
        this.getContainer()?.focus();
        const lastFocusedEntry = this.viewModel.lastFocusedEntry;
        if (preserveEntryFocus && lastFocusedEntry) {
            setTimeout(() => lastFocusedEntry.labelContainer.focus(), 0); // Need a timeout, for some reason without it the inner label container will not get focused
        }
    }
    createContentArea(parent) {
        this.element = parent;
        // Track focus within container
        const scopedContextKeyService = this._register(this.contextKeyService.createScoped(this.element));
        StatusBarFocused.bindTo(scopedContextKeyService).set(true);
        // Left items container
        this.leftItemsContainer = $('.left-items.items-container');
        this.element.appendChild(this.leftItemsContainer);
        this.element.tabIndex = 0;
        // Right items container
        this.rightItemsContainer = $('.right-items.items-container');
        this.element.appendChild(this.rightItemsContainer);
        // Context menu support
        this._register(addDisposableListener(parent, EventType.CONTEXT_MENU, e => this.showContextMenu(e)));
        this._register(Gesture.addTarget(parent));
        this._register(addDisposableListener(parent, TouchEventType.Contextmenu, e => this.showContextMenu(e)));
        // Initial status bar entries
        this.createInitialStatusbarEntries();
        return this.element;
    }
    createInitialStatusbarEntries() {
        // Add items in order according to alignment
        this.appendStatusbarEntries();
        // Fill in pending entries if any
        while (this.pendingEntries.length) {
            const pending = this.pendingEntries.shift();
            if (pending) {
                pending.accessor = this.addEntry(pending.entry, pending.id, pending.alignment, pending.priority.primary);
            }
        }
    }
    appendStatusbarEntries() {
        const leftItemsContainer = assertReturnsDefined(this.leftItemsContainer);
        const rightItemsContainer = assertReturnsDefined(this.rightItemsContainer);
        // Clear containers
        clearNode(leftItemsContainer);
        clearNode(rightItemsContainer);
        // Append all
        for (const entry of [
            ...this.viewModel.getEntries(0 /* StatusbarAlignment.LEFT */),
            ...this.viewModel.getEntries(1 /* StatusbarAlignment.RIGHT */).reverse() // reversing due to flex: row-reverse
        ]) {
            const target = entry.alignment === 0 /* StatusbarAlignment.LEFT */ ? leftItemsContainer : rightItemsContainer;
            target.appendChild(entry.container);
        }
        // Update compact entries
        this.updateCompactEntries();
    }
    appendStatusbarEntry(entry) {
        const entries = this.viewModel.getEntries(entry.alignment);
        if (entry.alignment === 1 /* StatusbarAlignment.RIGHT */) {
            entries.reverse(); // reversing due to flex: row-reverse
        }
        const target = assertReturnsDefined(entry.alignment === 0 /* StatusbarAlignment.LEFT */ ? this.leftItemsContainer : this.rightItemsContainer);
        const index = entries.indexOf(entry);
        if (index + 1 === entries.length) {
            target.appendChild(entry.container); // append at the end if last
        }
        else {
            target.insertBefore(entry.container, entries[index + 1].container); // insert before next element otherwise
        }
        // Update compact entries
        this.updateCompactEntries();
    }
    updateCompactEntries() {
        const entries = this.viewModel.entries;
        // Find visible entries and clear compact related CSS classes if any
        const mapIdToVisibleEntry = new Map();
        for (const entry of entries) {
            if (!this.viewModel.isHidden(entry.id)) {
                mapIdToVisibleEntry.set(entry.id, entry);
            }
            entry.container.classList.remove('compact-left', 'compact-right');
        }
        // Figure out groups of entries with `compact` alignment
        const compactEntryGroups = new Map();
        for (const entry of mapIdToVisibleEntry.values()) {
            if (isStatusbarEntryLocation(entry.priority.primary) && // entry references another entry as location
                entry.priority.primary.compact // entry wants to be compact
            ) {
                const locationId = entry.priority.primary.location.id;
                const location = mapIdToVisibleEntry.get(locationId);
                if (!location) {
                    continue; // skip if location does not exist
                }
                // Build a map of entries that are compact among each other
                let compactEntryGroup = compactEntryGroups.get(locationId);
                if (!compactEntryGroup) {
                    // It is possible that this entry references another entry
                    // that itself references an entry. In that case, we want
                    // to add it to the entries of the referenced entry.
                    for (const group of compactEntryGroups.values()) {
                        if (group.has(locationId)) {
                            compactEntryGroup = group;
                            break;
                        }
                    }
                    if (!compactEntryGroup) {
                        compactEntryGroup = new Map();
                        compactEntryGroups.set(locationId, compactEntryGroup);
                    }
                }
                compactEntryGroup.set(entry.id, entry);
                compactEntryGroup.set(location.id, location);
                // Adjust CSS classes to move compact items closer together
                if (entry.priority.primary.alignment === 0 /* StatusbarAlignment.LEFT */) {
                    location.container.classList.add('compact-left');
                    entry.container.classList.add('compact-right');
                }
                else {
                    location.container.classList.add('compact-right');
                    entry.container.classList.add('compact-left');
                }
            }
        }
        // Install mouse listeners to update hover feedback for
        // all compact entries that belong to each other
        const statusBarItemHoverBackground = this.getColor(STATUS_BAR_ITEM_HOVER_BACKGROUND);
        const statusBarItemCompactHoverBackground = this.getColor(STATUS_BAR_ITEM_COMPACT_HOVER_BACKGROUND);
        this.compactEntriesDisposable.value = new DisposableStore();
        if (statusBarItemHoverBackground && statusBarItemCompactHoverBackground && !isHighContrast(this.theme.type)) {
            for (const [, compactEntryGroup] of compactEntryGroups) {
                for (const compactEntry of compactEntryGroup.values()) {
                    if (!compactEntry.hasCommand) {
                        continue; // only show hover feedback when we have a command
                    }
                    this.compactEntriesDisposable.value.add(addDisposableListener(compactEntry.labelContainer, EventType.MOUSE_OVER, () => {
                        compactEntryGroup.forEach(compactEntry => compactEntry.labelContainer.style.backgroundColor = statusBarItemHoverBackground);
                        compactEntry.labelContainer.style.backgroundColor = statusBarItemCompactHoverBackground;
                    }));
                    this.compactEntriesDisposable.value.add(addDisposableListener(compactEntry.labelContainer, EventType.MOUSE_OUT, () => {
                        compactEntryGroup.forEach(compactEntry => compactEntry.labelContainer.style.backgroundColor = '');
                    }));
                }
            }
        }
    }
    showContextMenu(e) {
        EventHelper.stop(e, true);
        const event = new StandardMouseEvent(getWindow(this.element), e);
        let actions = undefined;
        this.contextMenuService.showContextMenu({
            getAnchor: () => event,
            getActions: () => {
                actions = this.getContextMenuActions(event);
                return actions;
            },
            onHide: () => {
                if (actions) {
                    disposeIfDisposable(actions);
                }
            }
        });
    }
    getContextMenuActions(event) {
        const actions = [];
        // Provide an action to hide the status bar at last
        actions.push(toAction({ id: ToggleStatusbarVisibilityAction.ID, label: localize('hideStatusBar', "Hide Status Bar"), run: () => this.instantiationService.invokeFunction(accessor => new ToggleStatusbarVisibilityAction().run(accessor)) }));
        actions.push(new Separator());
        // Show an entry per known status entry
        // Note: even though entries have an identifier, there can be multiple entries
        // having the same identifier (e.g. from extensions). So we make sure to only
        // show a single entry per identifier we handled.
        const handledEntries = new Set();
        for (const entry of this.viewModel.entries) {
            if (!handledEntries.has(entry.id)) {
                actions.push(new ToggleStatusbarEntryVisibilityAction(entry.id, entry.name, this.viewModel));
                handledEntries.add(entry.id);
            }
        }
        // Figure out if mouse is over an entry
        let statusEntryUnderMouse = undefined;
        for (let element = event.target; element; element = element.parentElement) {
            const entry = this.viewModel.findEntry(element);
            if (entry) {
                statusEntryUnderMouse = entry;
                break;
            }
        }
        if (statusEntryUnderMouse) {
            actions.push(new Separator());
            if (statusEntryUnderMouse.extensionId) {
                actions.push(this.instantiationService.createInstance(ManageExtensionAction, statusEntryUnderMouse.extensionId));
            }
            actions.push(new HideStatusbarEntryAction(statusEntryUnderMouse.id, statusEntryUnderMouse.name, this.viewModel));
        }
        return actions;
    }
    updateStyles() {
        super.updateStyles();
        const container = assertReturnsDefined(this.getContainer());
        const styleOverride = [...this.styleOverrides].sort((a, b) => a.priority - b.priority)[0];
        // Background / foreground colors
        const backgroundColor = this.getColor(styleOverride?.background ?? (this.contextService.getWorkbenchState() !== 1 /* WorkbenchState.EMPTY */ ? STATUS_BAR_BACKGROUND : STATUS_BAR_NO_FOLDER_BACKGROUND)) || '';
        container.style.backgroundColor = backgroundColor;
        const foregroundColor = this.getColor(styleOverride?.foreground ?? (this.contextService.getWorkbenchState() !== 1 /* WorkbenchState.EMPTY */ ? STATUS_BAR_FOREGROUND : STATUS_BAR_NO_FOLDER_FOREGROUND)) || '';
        container.style.color = foregroundColor;
        const itemBorderColor = this.getColor(STATUS_BAR_ITEM_FOCUS_BORDER);
        // Border color
        const borderColor = this.getColor(styleOverride?.border ?? (this.contextService.getWorkbenchState() !== 1 /* WorkbenchState.EMPTY */ ? STATUS_BAR_BORDER : STATUS_BAR_NO_FOLDER_BORDER)) || this.getColor(contrastBorder);
        if (borderColor) {
            container.classList.add('status-border-top');
            container.style.setProperty('--status-border-top-color', borderColor);
        }
        else {
            container.classList.remove('status-border-top');
            container.style.removeProperty('--status-border-top-color');
        }
        // Colors and focus outlines via dynamic stylesheet
        const statusBarFocusColor = this.getColor(STATUS_BAR_FOCUS_BORDER);
        if (!this.styleElement) {
            this.styleElement = createStyleSheet(container);
        }
        this.styleElement.textContent = `

				/* Status bar focus outline */
				.monaco-workbench .part.statusbar:focus {
					outline-color: ${statusBarFocusColor};
				}

				/* Status bar item focus outline */
				.monaco-workbench .part.statusbar > .items-container > .statusbar-item a:focus-visible {
					outline: 1px solid ${this.getColor(activeContrastBorder) ?? itemBorderColor};
					outline-offset: ${borderColor ? '-2px' : '-1px'};
				}

				/* Notification Beak */
				.monaco-workbench .part.statusbar > .items-container > .statusbar-item.has-beak > .status-bar-item-beak-container:before {
					border-bottom-color: ${borderColor ?? backgroundColor};
				}
			`;
    }
    layout(width, height, top, left) {
        super.layout(width, height, top, left);
        super.layoutContents(width, height);
    }
    overrideStyle(style) {
        this.styleOverrides.add(style);
        this.updateStyles();
        return toDisposable(() => {
            this.styleOverrides.delete(style);
            this.updateStyles();
        });
    }
    toJSON() {
        return {
            type: "workbench.parts.statusbar" /* Parts.STATUSBAR_PART */
        };
    }
    dispose() {
        this._onWillDispose.fire();
        super.dispose();
    }
};
StatusbarPart = StatusbarPart_1 = __decorate([
    __param(1, IInstantiationService),
    __param(2, IThemeService),
    __param(3, IWorkspaceContextService),
    __param(4, IStorageService),
    __param(5, IWorkbenchLayoutService),
    __param(6, IContextMenuService),
    __param(7, IContextKeyService)
], StatusbarPart);
let MainStatusbarPart = class MainStatusbarPart extends StatusbarPart {
    constructor(instantiationService, themeService, contextService, storageService, layoutService, contextMenuService, contextKeyService) {
        super("workbench.parts.statusbar" /* Parts.STATUSBAR_PART */, instantiationService, themeService, contextService, storageService, layoutService, contextMenuService, contextKeyService);
    }
};
MainStatusbarPart = __decorate([
    __param(0, IInstantiationService),
    __param(1, IThemeService),
    __param(2, IWorkspaceContextService),
    __param(3, IStorageService),
    __param(4, IWorkbenchLayoutService),
    __param(5, IContextMenuService),
    __param(6, IContextKeyService)
], MainStatusbarPart);
export { MainStatusbarPart };
let AuxiliaryStatusbarPart = class AuxiliaryStatusbarPart extends StatusbarPart {
    static { AuxiliaryStatusbarPart_1 = this; }
    static { this.COUNTER = 1; }
    constructor(container, instantiationService, themeService, contextService, storageService, layoutService, contextMenuService, contextKeyService) {
        const id = AuxiliaryStatusbarPart_1.COUNTER++;
        super(`workbench.parts.auxiliaryStatus.${id}`, instantiationService, themeService, contextService, storageService, layoutService, contextMenuService, contextKeyService);
        this.container = container;
        this.height = StatusbarPart.HEIGHT;
    }
};
AuxiliaryStatusbarPart = AuxiliaryStatusbarPart_1 = __decorate([
    __param(1, IInstantiationService),
    __param(2, IThemeService),
    __param(3, IWorkspaceContextService),
    __param(4, IStorageService),
    __param(5, IWorkbenchLayoutService),
    __param(6, IContextMenuService),
    __param(7, IContextKeyService)
], AuxiliaryStatusbarPart);
export { AuxiliaryStatusbarPart };
let StatusbarService = class StatusbarService extends MultiWindowParts {
    constructor(instantiationService, storageService, themeService) {
        super('workbench.statusBarService', themeService, storageService);
        this.instantiationService = instantiationService;
        this._onDidCreateAuxiliaryStatusbarPart = this._register(new Emitter());
        this.onDidCreateAuxiliaryStatusbarPart = this._onDidCreateAuxiliaryStatusbarPart.event;
        this.mainPart = this._register(this.instantiationService.createInstance(MainStatusbarPart));
        this._register(this.registerPart(this.mainPart));
        this.onDidChangeEntryVisibility = this.mainPart.onDidChangeEntryVisibility;
    }
    //#region Auxiliary Statusbar Parts
    createAuxiliaryStatusbarPart(container, instantiationService) {
        // Container
        const statusbarPartContainer = $('footer.part.statusbar', {
            'role': 'status',
            'aria-live': 'off',
            'tabIndex': '0'
        });
        statusbarPartContainer.style.position = 'relative';
        container.appendChild(statusbarPartContainer);
        // Statusbar Part
        const statusbarPart = instantiationService.createInstance(AuxiliaryStatusbarPart, statusbarPartContainer);
        const disposable = this.registerPart(statusbarPart);
        statusbarPart.create(statusbarPartContainer);
        Event.once(statusbarPart.onWillDispose)(() => disposable.dispose());
        // Emit internal event
        this._onDidCreateAuxiliaryStatusbarPart.fire(statusbarPart);
        return statusbarPart;
    }
    createScoped(statusbarEntryContainer, disposables) {
        return disposables.add(this.instantiationService.createInstance(ScopedStatusbarService, statusbarEntryContainer));
    }
    addEntry(entry, id, alignment, priorityOrLocation = 0) {
        if (entry.showInAllWindows) {
            return this.doAddEntryToAllWindows(entry, id, alignment, priorityOrLocation);
        }
        return this.mainPart.addEntry(entry, id, alignment, priorityOrLocation);
    }
    doAddEntryToAllWindows(originalEntry, id, alignment, priorityOrLocation = 0) {
        const entryDisposables = new DisposableStore();
        const accessors = new Set();
        let entry = originalEntry;
        function addEntry(part) {
            const partDisposables = new DisposableStore();
            partDisposables.add(part.onWillDispose(() => partDisposables.dispose()));
            const accessor = partDisposables.add(part.addEntry(entry, id, alignment, priorityOrLocation));
            accessors.add(accessor);
            partDisposables.add(toDisposable(() => accessors.delete(accessor)));
            entryDisposables.add(partDisposables);
            partDisposables.add(toDisposable(() => entryDisposables.delete(partDisposables)));
        }
        for (const part of this.parts) {
            addEntry(part);
        }
        entryDisposables.add(this.onDidCreateAuxiliaryStatusbarPart(part => addEntry(part)));
        return {
            update: (updatedEntry) => {
                entry = updatedEntry;
                for (const update of accessors) {
                    update.update(updatedEntry);
                }
            },
            dispose: () => entryDisposables.dispose()
        };
    }
    isEntryVisible(id) {
        return this.mainPart.isEntryVisible(id);
    }
    updateEntryVisibility(id, visible) {
        for (const part of this.parts) {
            part.updateEntryVisibility(id, visible);
        }
    }
    overrideEntry(id, override) {
        const disposables = new DisposableStore();
        for (const part of this.parts) {
            disposables.add(part.overrideEntry(id, override));
        }
        return disposables;
    }
    focus(preserveEntryFocus) {
        this.activePart.focus(preserveEntryFocus);
    }
    focusNextEntry() {
        this.activePart.focusNextEntry();
    }
    focusPreviousEntry() {
        this.activePart.focusPreviousEntry();
    }
    isEntryFocused() {
        return this.activePart.isEntryFocused();
    }
    overrideStyle(style) {
        const disposables = new DisposableStore();
        for (const part of this.parts) {
            disposables.add(part.overrideStyle(style));
        }
        return disposables;
    }
};
StatusbarService = __decorate([
    __param(0, IInstantiationService),
    __param(1, IStorageService),
    __param(2, IThemeService)
], StatusbarService);
export { StatusbarService };
let ScopedStatusbarService = class ScopedStatusbarService extends Disposable {
    constructor(statusbarEntryContainer, statusbarService) {
        super();
        this.statusbarEntryContainer = statusbarEntryContainer;
        this.statusbarService = statusbarService;
        this.onDidChangeEntryVisibility = this.statusbarEntryContainer.onDidChangeEntryVisibility;
    }
    createAuxiliaryStatusbarPart(container, instantiationService) {
        return this.statusbarService.createAuxiliaryStatusbarPart(container, instantiationService);
    }
    createScoped(statusbarEntryContainer, disposables) {
        return this.statusbarService.createScoped(statusbarEntryContainer, disposables);
    }
    getPart() {
        return this.statusbarEntryContainer;
    }
    addEntry(entry, id, alignment, priorityOrLocation = 0) {
        return this.statusbarEntryContainer.addEntry(entry, id, alignment, priorityOrLocation);
    }
    isEntryVisible(id) {
        return this.statusbarEntryContainer.isEntryVisible(id);
    }
    updateEntryVisibility(id, visible) {
        this.statusbarEntryContainer.updateEntryVisibility(id, visible);
    }
    overrideEntry(id, override) {
        return this.statusbarEntryContainer.overrideEntry(id, override);
    }
    focus(preserveEntryFocus) {
        this.statusbarEntryContainer.focus(preserveEntryFocus);
    }
    focusNextEntry() {
        this.statusbarEntryContainer.focusNextEntry();
    }
    focusPreviousEntry() {
        this.statusbarEntryContainer.focusPreviousEntry();
    }
    isEntryFocused() {
        return this.statusbarEntryContainer.isEntryFocused();
    }
    overrideStyle(style) {
        return this.statusbarEntryContainer.overrideStyle(style);
    }
};
ScopedStatusbarService = __decorate([
    __param(1, IStatusbarService)
], ScopedStatusbarService);
export { ScopedStatusbarService };
registerSingleton(IStatusbarService, StatusbarService, 0 /* InstantiationType.Eager */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHVzYmFyUGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9zdGF0dXNiYXIvc3RhdHVzYmFyUGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTywyQkFBMkIsQ0FBQztBQUNuQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsbUJBQW1CLEVBQWUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdEosT0FBTyxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUN2RCxPQUFPLEVBQUUsU0FBUyxJQUFJLGNBQWMsRUFBRSxPQUFPLEVBQWdCLE1BQU0sbUNBQW1DLENBQUM7QUFDdkcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFzQixpQkFBaUIsRUFBcUUsd0JBQXdCLEVBQTJCLHdCQUF3QixFQUEyQixNQUFNLGtEQUFrRCxDQUFDO0FBQ2xSLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzlGLE9BQU8sRUFBVyxTQUFTLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDbEYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxxQkFBcUIsRUFBRSwrQkFBK0IsRUFBRSxnQ0FBZ0MsRUFBRSxpQkFBaUIsRUFBRSwrQkFBK0IsRUFBRSwyQkFBMkIsRUFBRSx3Q0FBd0MsRUFBRSw0QkFBNEIsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzdVLE9BQU8sRUFBRSx3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