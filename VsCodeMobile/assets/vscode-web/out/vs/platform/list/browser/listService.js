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
import { isActiveElement, isKeyboardEvent } from '../../../base/browser/dom.js';
import { PagedList } from '../../../base/browser/ui/list/listPaging.js';
import { isSelectionRangeChangeEvent, isSelectionSingleChangeEvent, List, TypeNavigationMode } from '../../../base/browser/ui/list/listWidget.js';
import { Table } from '../../../base/browser/ui/table/tableWidget.js';
import { TreeFindMatchType, TreeFindMode } from '../../../base/browser/ui/tree/abstractTree.js';
import { AsyncDataTree, CompressibleAsyncDataTree } from '../../../base/browser/ui/tree/asyncDataTree.js';
import { DataTree } from '../../../base/browser/ui/tree/dataTree.js';
import { CompressibleObjectTree, ObjectTree } from '../../../base/browser/ui/tree/objectTree.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { combinedDisposable, Disposable, DisposableStore, dispose, toDisposable } from '../../../base/common/lifecycle.js';
import { localize } from '../../../nls.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { Extensions as ConfigurationExtensions } from '../../configuration/common/configurationRegistry.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../contextkey/common/contextkey.js';
import { InputFocusedContextKey } from '../../contextkey/common/contextkeys.js';
import { IContextViewService } from '../../contextview/browser/contextView.js';
import { createDecorator, IInstantiationService } from '../../instantiation/common/instantiation.js';
import { IKeybindingService } from '../../keybinding/common/keybinding.js';
import { Registry } from '../../registry/common/platform.js';
import { defaultFindWidgetStyles, defaultListStyles, getListStyles } from '../../theme/browser/defaultStyles.js';
export const IListService = createDecorator('listService');
export class ListService {
    get lastFocusedList() {
        return this._lastFocusedWidget;
    }
    constructor() {
        this.disposables = new DisposableStore();
        this.lists = [];
        this._lastFocusedWidget = undefined;
    }
    setLastFocusedList(widget) {
        if (widget === this._lastFocusedWidget) {
            return;
        }
        this._lastFocusedWidget?.getHTMLElement().classList.remove('last-focused');
        this._lastFocusedWidget = widget;
        this._lastFocusedWidget?.getHTMLElement().classList.add('last-focused');
    }
    register(widget, extraContextKeys) {
        if (this.lists.some(l => l.widget === widget)) {
            throw new Error('Cannot register the same widget multiple times');
        }
        // Keep in our lists list
        const registeredList = { widget, extraContextKeys };
        this.lists.push(registeredList);
        // Check for currently being focused
        if (isActiveElement(widget.getHTMLElement())) {
            this.setLastFocusedList(widget);
        }
        return combinedDisposable(widget.onDidFocus(() => this.setLastFocusedList(widget)), toDisposable(() => this.lists.splice(this.lists.indexOf(registeredList), 1)), widget.onDidDispose(() => {
            this.lists = this.lists.filter(l => l !== registeredList);
            if (this._lastFocusedWidget === widget) {
                this.setLastFocusedList(undefined);
            }
        }));
    }
    dispose() {
        this.disposables.dispose();
    }
}
export const RawWorkbenchListScrollAtBoundaryContextKey = new RawContextKey('listScrollAtBoundary', 'none');
export const WorkbenchListScrollAtTopContextKey = ContextKeyExpr.or(RawWorkbenchListScrollAtBoundaryContextKey.isEqualTo('top'), RawWorkbenchListScrollAtBoundaryContextKey.isEqualTo('both'));
export const WorkbenchListScrollAtBottomContextKey = ContextKeyExpr.or(RawWorkbenchListScrollAtBoundaryContextKey.isEqualTo('bottom'), RawWorkbenchListScrollAtBoundaryContextKey.isEqualTo('both'));
export const RawWorkbenchListFocusContextKey = new RawContextKey('listFocus', true);
export const WorkbenchTreeStickyScrollFocused = new RawContextKey('treestickyScrollFocused', false);
export const WorkbenchListSupportsMultiSelectContextKey = new RawContextKey('listSupportsMultiselect', true);
export const WorkbenchListFocusContextKey = ContextKeyExpr.and(RawWorkbenchListFocusContextKey, ContextKeyExpr.not(InputFocusedContextKey), WorkbenchTreeStickyScrollFocused.negate());
export const WorkbenchListHasSelectionOrFocus = new RawContextKey('listHasSelectionOrFocus', false);
export const WorkbenchListDoubleSelection = new RawContextKey('listDoubleSelection', false);
export const WorkbenchListMultiSelection = new RawContextKey('listMultiSelection', false);
export const WorkbenchListSelectionNavigation = new RawContextKey('listSelectionNavigation', false);
export const WorkbenchListSupportsFind = new RawContextKey('listSupportsFind', true);
export const WorkbenchTreeElementCanCollapse = new RawContextKey('treeElementCanCollapse', false);
export const WorkbenchTreeElementHasParent = new RawContextKey('treeElementHasParent', false);
export const WorkbenchTreeElementCanExpand = new RawContextKey('treeElementCanExpand', false);
export const WorkbenchTreeElementHasChild = new RawContextKey('treeElementHasChild', false);
export const WorkbenchTreeFindOpen = new RawContextKey('treeFindOpen', false);
const WorkbenchListTypeNavigationModeKey = 'listTypeNavigationMode';
/**
 * @deprecated in favor of WorkbenchListTypeNavigationModeKey
 */
const WorkbenchListAutomaticKeyboardNavigationLegacyKey = 'listAutomaticKeyboardNavigation';
function createScopedContextKeyService(contextKeyService, widget) {
    const result = contextKeyService.createScoped(widget.getHTMLElement());
    RawWorkbenchListFocusContextKey.bindTo(result);
    return result;
}
function createScrollObserver(contextKeyService, widget) {
    const listScrollAt = RawWorkbenchListScrollAtBoundaryContextKey.bindTo(contextKeyService);
    const update = () => {
        const atTop = widget.scrollTop === 0;
        // We need a threshold `1` since scrollHeight is rounded.
        // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight#determine_if_an_element_has_been_totally_scrolled
        const atBottom = widget.scrollHeight - widget.renderHeight - widget.scrollTop < 1;
        if (atTop && atBottom) {
            listScrollAt.set('both');
        }
        else if (atTop) {
            listScrollAt.set('top');
        }
        else if (atBottom) {
            listScrollAt.set('bottom');
        }
        else {
            listScrollAt.set('none');
        }
    };
    update();
    return widget.onDidScroll(update);
}
const multiSelectModifierSettingKey = 'workbench.list.multiSelectModifier';
const openModeSettingKey = 'workbench.list.openMode';
const horizontalScrollingKey = 'workbench.list.horizontalScrolling';
const defaultFindModeSettingKey = 'workbench.list.defaultFindMode';
const typeNavigationModeSettingKey = 'workbench.list.typeNavigationMode';
/** @deprecated in favor of `workbench.list.defaultFindMode` and `workbench.list.typeNavigationMode` */
const keyboardNavigationSettingKey = 'workbench.list.keyboardNavigation';
const scrollByPageKey = 'workbench.list.scrollByPage';
const defaultFindMatchTypeSettingKey = 'workbench.list.defaultFindMatchType';
const treeIndentKey = 'workbench.tree.indent';
const treeRenderIndentGuidesKey = 'workbench.tree.renderIndentGuides';
const listSmoothScrolling = 'workbench.list.smoothScrolling';
const mouseWheelScrollSensitivityKey = 'workbench.list.mouseWheelScrollSensitivity';
const fastScrollSensitivityKey = 'workbench.list.fastScrollSensitivity';
const treeExpandMode = 'workbench.tree.expandMode';
const treeStickyScroll = 'workbench.tree.enableStickyScroll';
const treeStickyScrollMaxElements = 'workbench.tree.stickyScrollMaxItemCount';
function useAltAsMultipleSelectionModifier(configurationService) {
    return configurationService.getValue(multiSelectModifierSettingKey) === 'alt';
}
class MultipleSelectionController extends Disposable {
    constructor(configurationService) {
        super();
        this.configurationService = configurationService;
        this.useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
        this.registerListeners();
    }
    registerListeners() {
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
                this.useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(this.configurationService);
            }
        }));
    }
    isSelectionSingleChangeEvent(event) {
        if (this.useAltAsMultipleSelectionModifier) {
            return event.browserEvent.altKey;
        }
        return isSelectionSingleChangeEvent(event);
    }
    isSelectionRangeChangeEvent(event) {
        return isSelectionRangeChangeEvent(event);
    }
}
function toWorkbenchListOptions(accessor, options) {
    const configurationService = accessor.get(IConfigurationService);
    const keybindingService = accessor.get(IKeybindingService);
    const disposables = new DisposableStore();
    const result = {
        ...options,
        keyboardNavigationDelegate: { mightProducePrintableCharacter(e) { return keybindingService.mightProducePrintableCharacter(e); } },
        smoothScrolling: Boolean(configurationService.getValue(listSmoothScrolling)),
        mouseWheelScrollSensitivity: configurationService.getValue(mouseWheelScrollSensitivityKey),
        fastScrollSensitivity: configurationService.getValue(fastScrollSensitivityKey),
        multipleSelectionController: options.multipleSelectionController ?? disposables.add(new MultipleSelectionController(configurationService)),
        keyboardNavigationEventFilter: createKeyboardNavigationEventFilter(keybindingService),
        scrollByPage: Boolean(configurationService.getValue(scrollByPageKey))
    };
    return [result, disposables];
}
let WorkbenchList = class WorkbenchList extends List {
    get onDidOpen() { return this.navigator.onDidOpen; }
    constructor(user, container, delegate, renderers, options, contextKeyService, listService, configurationService, instantiationService) {
        const horizontalScrolling = typeof options.horizontalScrolling !== 'undefined' ? options.horizontalScrolling : Boolean(configurationService.getValue(horizontalScrollingKey));
        const [workbenchListOptions, workbenchListOptionsDisposable] = instantiationService.invokeFunction(toWorkbenchListOptions, options);
        super(user, container, delegate, renderers, {
            keyboardSupport: false,
            ...workbenchListOptions,
            horizontalScrolling,
        });
        this.disposables.add(workbenchListOptionsDisposable);
        this.contextKeyService = createScopedContextKeyService(contextKeyService, this);
        this.disposables.add(createScrollObserver(this.contextKeyService, this));
        this.listSupportsMultiSelect = WorkbenchListSupportsMultiSelectContextKey.bindTo(this.contextKeyService);
        this.listSupportsMultiSelect.set(options.multipleSelectionSupport !== false);
        const listSelectionNavigation = WorkbenchListSelectionNavigation.bindTo(this.contextKeyService);
        listSelectionNavigation.set(Boolean(options.selectionNavigation));
        this.listHasSelectionOrFocus = WorkbenchListHasSelectionOrFocus.bindTo(this.contextKeyService);
        this.listDoubleSelection = WorkbenchListDoubleSelection.bindTo(this.contextKeyService);
        this.listMultiSelection = WorkbenchListMultiSelection.bindTo(this.contextKeyService);
        this.horizontalScrolling = options.horizontalScrolling;
        this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
        this.disposables.add(this.contextKeyService);
        this.disposables.add(listService.register(this));
        this.updateStyles(options.overrideStyles);
        this.disposables.add(this.onDidChangeSelection(() => {
            const selection = this.getSelection();
            const focus = this.getFocus();
            this.contextKeyService.bufferChangeEvents(() => {
                this.listHasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
                this.listMultiSelection.set(selection.length > 1);
                this.listDoubleSelection.set(selection.length === 2);
            });
        }));
        this.disposables.add(this.onDidChangeFocus(() => {
            const selection = this.getSelection();
            const focus = this.getFocus();
            this.listHasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
        }));
        this.disposables.add(configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
                this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
            }
            let options = {};
            if (e.affectsConfiguration(horizontalScrollingKey) && this.horizontalScrolling === undefined) {
                const horizontalScrolling = Boolean(configurationService.getValue(horizontalScrollingKey));
                options = { ...options, horizontalScrolling };
            }
            if (e.affectsConfiguration(scrollByPageKey)) {
                const scrollByPage = Boolean(configurationService.getValue(scrollByPageKey));
                options = { ...options, scrollByPage };
            }
            if (e.affectsConfiguration(listSmoothScrolling)) {
                const smoothScrolling = Boolean(configurationService.getValue(listSmoothScrolling));
                options = { ...options, smoothScrolling };
            }
            if (e.affectsConfiguration(mouseWheelScrollSensitivityKey)) {
                const mouseWheelScrollSensitivity = configurationService.getValue(mouseWheelScrollSensitivityKey);
                options = { ...options, mouseWheelScrollSensitivity };
            }
            if (e.affectsConfiguration(fastScrollSensitivityKey)) {
                const fastScrollSensitivity = configurationService.getValue(fastScrollSensitivityKey);
                options = { ...options, fastScrollSensitivity };
            }
            if (Object.keys(options).length > 0) {
                this.updateOptions(options);
            }
        }));
        this.navigator = new ListResourceNavigator(this, { configurationService, ...options });
        this.disposables.add(this.navigator);
    }
    updateOptions(options) {
        super.updateOptions(options);
        if (options.overrideStyles !== undefined) {
            this.updateStyles(options.overrideStyles);
        }
        if (options.multipleSelectionSupport !== undefined) {
            this.listSupportsMultiSelect.set(!!options.multipleSelectionSupport);
        }
    }
    updateStyles(styles) {
        this.style(styles ? getListStyles(styles) : defaultListStyles);
    }
    get useAltAsMultipleSelectionModifier() {
        return this._useAltAsMultipleSelectionModifier;
    }
};
WorkbenchList = __decorate([
    __param(5, IContextKeyService),
    __param(6, IListService),
    __param(7, IConfigurationService),
    __param(8, IInstantiationService)
], WorkbenchList);
export { WorkbenchList };
let WorkbenchPagedList = class WorkbenchPagedList extends PagedList {
    get onDidOpen() { return this.navigator.onDidOpen; }
    constructor(user, container, delegate, renderers, options, contextKeyService, listService, configurationService, instantiationService) {
        const horizontalScrolling = typeof options.horizontalScrolling !== 'undefined' ? options.horizontalScrolling : Boolean(configurationService.getValue(horizontalScrollingKey));
        const [workbenchListOptions, workbenchListOptionsDisposable] = instantiationService.invokeFunction(toWorkbenchListOptions, options);
        super(user, container, delegate, renderers, {
            keyboardSupport: false,
            ...workbenchListOptions,
            horizontalScrolling,
        });
        this.disposables = new DisposableStore();
        this.disposables.add(workbenchListOptionsDisposable);
        this.contextKeyService = createScopedContextKeyService(contextKeyService, this);
        this.disposables.add(createScrollObserver(this.contextKeyService, this.widget));
        this.horizontalScrolling = options.horizontalScrolling;
        this.listSupportsMultiSelect = WorkbenchListSupportsMultiSelectContextKey.bindTo(this.contextKeyService);
        this.listSupportsMultiSelect.set(options.multipleSelectionSupport !== false);
        const listSelectionNavigation = WorkbenchListSelectionNavigation.bindTo(this.contextKeyService);
        listSelectionNavigation.set(Boolean(options.selectionNavigation));
        this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
        this.disposables.add(this.contextKeyService);
        this.disposables.add(listService.register(this));
        this.updateStyles(options.overrideStyles);
        this.disposables.add(configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
                this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
            }
            let options = {};
            if (e.affectsConfiguration(horizontalScrollingKey) && this.horizontalScrolling === undefined) {
                const horizontalScrolling = Boolean(configurationService.getValue(horizontalScrollingKey));
                options = { ...options, horizontalScrolling };
            }
            if (e.affectsConfiguration(scrollByPageKey)) {
                const scrollByPage = Boolean(configurationService.getValue(scrollByPageKey));
                options = { ...options, scrollByPage };
            }
            if (e.affectsConfiguration(listSmoothScrolling)) {
                const smoothScrolling = Boolean(configurationService.getValue(listSmoothScrolling));
                options = { ...options, smoothScrolling };
            }
            if (e.affectsConfiguration(mouseWheelScrollSensitivityKey)) {
                const mouseWheelScrollSensitivity = configurationService.getValue(mouseWheelScrollSensitivityKey);
                options = { ...options, mouseWheelScrollSensitivity };
            }
            if (e.affectsConfiguration(fastScrollSensitivityKey)) {
                const fastScrollSensitivity = configurationService.getValue(fastScrollSensitivityKey);
                options = { ...options, fastScrollSensitivity };
            }
            if (Object.keys(options).length > 0) {
                this.updateOptions(options);
            }
        }));
        this.navigator = new ListResourceNavigator(this, { configurationService, ...options });
        this.disposables.add(this.navigator);
    }
    updateOptions(options) {
        super.updateOptions(options);
        if (options.overrideStyles !== undefined) {
            this.updateStyles(options.overrideStyles);
        }
        if (options.multipleSelectionSupport !== undefined) {
            this.listSupportsMultiSelect.set(!!options.multipleSelectionSupport);
        }
    }
    updateStyles(styles) {
        this.style(styles ? getListStyles(styles) : defaultListStyles);
    }
    get useAltAsMultipleSelectionModifier() {
        return this._useAltAsMultipleSelectionModifier;
    }
    dispose() {
        this.disposables.dispose();
        super.dispose();
    }
};
WorkbenchPagedList = __decorate([
    __param(5, IContextKeyService),
    __param(6, IListService),
    __param(7, IConfigurationService),
    __param(8, IInstantiationService)
], WorkbenchPagedList);
export { WorkbenchPagedList };
let WorkbenchTable = class WorkbenchTable extends Table {
    get onDidOpen() { return this.navigator.onDidOpen; }
    constructor(user, container, delegate, columns, renderers, options, contextKeyService, listService, configurationService, instantiationService) {
        const horizontalScrolling = typeof options.horizontalScrolling !== 'undefined' ? options.horizontalScrolling : Boolean(configurationService.getValue(horizontalScrollingKey));
        const [workbenchListOptions, workbenchListOptionsDisposable] = instantiationService.invokeFunction(toWorkbenchListOptions, options);
        super(user, container, delegate, columns, renderers, {
            keyboardSupport: false,
            ...workbenchListOptions,
            horizontalScrolling,
        });
        this.disposables.add(workbenchListOptionsDisposable);
        this.contextKeyService = createScopedContextKeyService(contextKeyService, this);
        this.disposables.add(createScrollObserver(this.contextKeyService, this));
        this.listSupportsMultiSelect = WorkbenchListSupportsMultiSelectContextKey.bindTo(this.contextKeyService);
        this.listSupportsMultiSelect.set(options.multipleSelectionSupport !== false);
        const listSelectionNavigation = WorkbenchListSelectionNavigation.bindTo(this.contextKeyService);
        listSelectionNavigation.set(Boolean(options.selectionNavigation));
        this.listHasSelectionOrFocus = WorkbenchListHasSelectionOrFocus.bindTo(this.contextKeyService);
        this.listDoubleSelection = WorkbenchListDoubleSelection.bindTo(this.contextKeyService);
        this.listMultiSelection = WorkbenchListMultiSelection.bindTo(this.contextKeyService);
        this.horizontalScrolling = options.horizontalScrolling;
        this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
        this.disposables.add(this.contextKeyService);
        this.disposables.add(listService.register(this));
        this.updateStyles(options.overrideStyles);
        this.disposables.add(this.onDidChangeSelection(() => {
            const selection = this.getSelection();
            const focus = this.getFocus();
            this.contextKeyService.bufferChangeEvents(() => {
                this.listHasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
                this.listMultiSelection.set(selection.length > 1);
                this.listDoubleSelection.set(selection.length === 2);
            });
        }));
        this.disposables.add(this.onDidChangeFocus(() => {
            const selection = this.getSelection();
            const focus = this.getFocus();
            this.listHasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
        }));
        this.disposables.add(configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
                this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
            }
            let options = {};
            if (e.affectsConfiguration(horizontalScrollingKey) && this.horizontalScrolling === undefined) {
                const horizontalScrolling = Boolean(configurationService.getValue(horizontalScrollingKey));
                options = { ...options, horizontalScrolling };
            }
            if (e.affectsConfiguration(scrollByPageKey)) {
                const scrollByPage = Boolean(configurationService.getValue(scrollByPageKey));
                options = { ...options, scrollByPage };
            }
            if (e.affectsConfiguration(listSmoothScrolling)) {
                const smoothScrolling = Boolean(configurationService.getValue(listSmoothScrolling));
                options = { ...options, smoothScrolling };
            }
            if (e.affectsConfiguration(mouseWheelScrollSensitivityKey)) {
                const mouseWheelScrollSensitivity = configurationService.getValue(mouseWheelScrollSensitivityKey);
                options = { ...options, mouseWheelScrollSensitivity };
            }
            if (e.affectsConfiguration(fastScrollSensitivityKey)) {
                const fastScrollSensitivity = configurationService.getValue(fastScrollSensitivityKey);
                options = { ...options, fastScrollSensitivity };
            }
            if (Object.keys(options).length > 0) {
                this.updateOptions(options);
            }
        }));
        this.navigator = new TableResourceNavigator(this, { configurationService, ...options });
        this.disposables.add(this.navigator);
    }
    updateOptions(options) {
        super.updateOptions(options);
        if (options.overrideStyles !== undefined) {
            this.updateStyles(options.overrideStyles);
        }
        if (options.multipleSelectionSupport !== undefined) {
            this.listSupportsMultiSelect.set(!!options.multipleSelectionSupport);
        }
    }
    updateStyles(styles) {
        this.style(styles ? getListStyles(styles) : defaultListStyles);
    }
    get useAltAsMultipleSelectionModifier() {
        return this._useAltAsMultipleSelectionModifier;
    }
    dispose() {
        this.disposables.dispose();
        super.dispose();
    }
};
WorkbenchTable = __decorate([
    __param(6, IContextKeyService),
    __param(7, IListService),
    __param(8, IConfigurationService),
    __param(9, IInstantiationService)
], WorkbenchTable);
export { WorkbenchTable };
export function getSelectionKeyboardEvent(typeArg = 'keydown', preserveFocus, pinned) {
    const e = new KeyboardEvent(typeArg);
    e.preserveFocus = preserveFocus;
    e.pinned = pinned;
    e.__forceEvent = true;
    return e;
}
class ResourceNavigator extends Disposable {
    constructor(widget, options) {
        super();
        this.widget = widget;
        this._onDidOpen = this._register(new Emitter());
        this.onDidOpen = this._onDidOpen.event;
        this._register(Event.filter(this.widget.onDidChangeSelection, e => isKeyboardEvent(e.browserEvent))(e => this.onSelectionFromKeyboard(e)));
        this._register(this.widget.onPointer((e) => this.onPointer(e.element, e.browserEvent)));
        this._register(this.widget.onMouseDblClick((e) => this.onMouseDblClick(e.element, e.browserEvent)));
        if (typeof options?.openOnSingleClick !== 'boolean' && options?.configurationService) {
            this.openOnSingleClick = options?.configurationService.getValue(openModeSettingKey) !== 'doubleClick';
            this._register(options?.configurationService.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration(openModeSettingKey)) {
                    this.openOnSingleClick = options?.configurationService.getValue(openModeSettingKey) !== 'doubleClick';
                }
            }));
        }
        else {
            this.openOnSingleClick = options?.openOnSingleClick ?? true;
        }
    }
    onSelectionFromKeyboard(event) {
        if (event.elements.length !== 1) {
            return;
        }
        const selectionKeyboardEvent = event.browserEvent;
        const preserveFocus = typeof selectionKeyboardEvent.preserveFocus === 'boolean' ? selectionKeyboardEvent.preserveFocus : true;
        const pinned = typeof selectionKeyboardEvent.pinned === 'boolean' ? selectionKeyboardEvent.pinned : !preserveFocus;
        const sideBySide = false;
        this._open(this.getSelectedElement(), preserveFocus, pinned, sideBySide, event.browserEvent);
    }
    onPointer(element, browserEvent) {
        if (!this.openOnSingleClick) {
            return;
        }
        const isDoubleClick = browserEvent.detail === 2;
        if (isDoubleClick) {
            return;
        }
        const isMiddleClick = browserEvent.button === 1;
        const preserveFocus = true;
        const pinned = isMiddleClick;
        const sideBySide = browserEvent.ctrlKey || browserEvent.metaKey || browserEvent.altKey;
        this._open(element, preserveFocus, pinned, sideBySide, browserEvent);
    }
    onMouseDblClick(element, browserEvent) {
        if (!browserEvent) {
            return;
        }
        // copied from AbstractTree
        const target = browserEvent.target;
        const onTwistie = target.classList.contains('monaco-tl-twistie')
            || (target.classList.contains('monaco-icon-label') && target.classList.contains('folder-icon') && browserEvent.offsetX < 16);
        if (onTwistie) {
            return;
        }
        const preserveFocus = false;
        const pinned = true;
        const sideBySide = (browserEvent.ctrlKey || browserEvent.metaKey || browserEvent.altKey);
        this._open(element, preserveFocus, pinned, sideBySide, browserEvent);
    }
    _open(element, preserveFocus, pinned, sideBySide, browserEvent) {
        if (!element) {
            return;
        }
        this._onDidOpen.fire({
            editorOptions: {
                preserveFocus,
                pinned,
                revealIfVisible: true
            },
            sideBySide,
            element,
            browserEvent
        });
    }
}
class ListResourceNavigator extends ResourceNavigator {
    constructor(widget, options) {
        super(widget, options);
        this.widget = widget;
    }
    getSelectedElement() {
        return this.widget.getSelectedElements()[0];
    }
}
class TableResourceNavigator extends ResourceNavigator {
    constructor(widget, options) {
        super(widget, options);
    }
    getSelectedElement() {
        return this.widget.getSelectedElements()[0];
    }
}
class TreeResourceNavigator extends ResourceNavigator {
    constructor(widget, options) {
        super(widget, options);
    }
    getSelectedElement() {
        return this.widget.getSelection()[0] ?? undefined;
    }
}
function createKeyboardNavigationEventFilter(keybindingService) {
    let inMultiChord = false;
    return event => {
        if (event.toKeyCodeChord().isModifierKey()) {
            return false;
        }
        if (inMultiChord) {
            inMultiChord = false;
            return false;
        }
        const result = keybindingService.softDispatch(event, event.target);
        if (result.kind === 1 /* ResultKind.MoreChordsNeeded */) {
            inMultiChord = true;
            return false;
        }
        inMultiChord = false;
        return result.kind === 0 /* ResultKind.NoMatchingKb */;
    };
}
let WorkbenchObjectTree = class WorkbenchObjectTree extends ObjectTree {
    get contextKeyService() { return this.internals.contextKeyService; }
    get useAltAsMultipleSelectionModifier() { return this.internals.useAltAsMultipleSelectionModifier; }
    get onDidOpen() { return this.internals.onDidOpen; }
    constructor(user, container, delegate, renderers, options, instantiationService, contextKeyService, listService, configurationService) {
        // eslint-disable-next-line local/code-no-any-casts
        const { options: treeOptions, getTypeNavigationMode, disposable } = instantiationService.invokeFunction(workbenchTreeDataPreamble, options);
        super(user, container, delegate, renderers, treeOptions);
        this.disposables.add(disposable);
        this.internals = new WorkbenchTreeInternals(this, options, getTypeNavigationMode, options.overrideStyles, contextKeyService, listService, configurationService);
        this.disposables.add(this.internals);
    }
    updateOptions(options) {
        super.updateOptions(options);
        this.internals.updateOptions(options);
    }
};
WorkbenchObjectTree = __decorate([
    __param(5, IInstantiationService),
    __param(6, IContextKeyService),
    __param(7, IListService),
    __param(8, IConfigurationService)
], WorkbenchObjectTree);
export { WorkbenchObjectTree };
let WorkbenchCompressibleObjectTree = class WorkbenchCompressibleObjectTree extends CompressibleObjectTree {
    get contextKeyService() { return this.internals.contextKeyService; }
    get useAltAsMultipleSelectionModifier() { return this.internals.useAltAsMultipleSelectionModifier; }
    get onDidOpen() { return this.internals.onDidOpen; }
    constructor(user, container, delegate, renderers, options, instantiationService, contextKeyService, listService, configurationService) {
        // eslint-disable-next-line local/code-no-any-casts
        const { options: treeOptions, getTypeNavigationMode, disposable } = instantiationService.invokeFunction(workbenchTreeDataPreamble, options);
        super(user, container, delegate, renderers, treeOptions);
        this.disposables.add(disposable);
        this.internals = new WorkbenchTreeInternals(this, options, getTypeNavigationMode, options.overrideStyles, contextKeyService, listService, configurationService);
        this.disposables.add(this.internals);
    }
    updateOptions(options = {}) {
        super.updateOptions(options);
        if (options.overrideStyles) {
            this.internals.updateStyleOverrides(options.overrideStyles);
        }
        this.internals.updateOptions(options);
    }
};
WorkbenchCompressibleObjectTree = __decorate([
    __param(5, IInstantiationService),
    __param(6, IContextKeyService),
    __param(7, IListService),
    __param(8, IConfigurationService)
], WorkbenchCompressibleObjectTree);
export { WorkbenchCompressibleObjectTree };
let WorkbenchDataTree = class WorkbenchDataTree extends DataTree {
    get contextKeyService() { return this.internals.contextKeyService; }
    get useAltAsMultipleSelectionModifier() { return this.internals.useAltAsMultipleSelectionModifier; }
    get onDidOpen() { return this.internals.onDidOpen; }
    constructor(user, container, delegate, renderers, dataSource, options, instantiationService, contextKeyService, listService, configurationService) {
        // eslint-disable-next-line local/code-no-any-casts
        const { options: treeOptions, getTypeNavigationMode, disposable } = instantiationService.invokeFunction(workbenchTreeDataPreamble, options);
        super(user, container, delegate, renderers, dataSource, treeOptions);
        this.disposables.add(disposable);
        this.internals = new WorkbenchTreeInternals(this, options, getTypeNavigationMode, options.overrideStyles, contextKeyService, listService, configurationService);
        this.disposables.add(this.internals);
    }
    updateOptions(options = {}) {
        super.updateOptions(options);
        if (options.overrideStyles !== undefined) {
            this.internals.updateStyleOverrides(options.overrideStyles);
        }
        this.internals.updateOptions(options);
    }
};
WorkbenchDataTree = __decorate([
    __param(6, IInstantiationService),
    __param(7, IContextKeyService),
    __param(8, IListService),
    __param(9, IConfigurationService)
], WorkbenchDataTree);
export { WorkbenchDataTree };
let WorkbenchAsyncDataTree = class WorkbenchAsyncDataTree extends AsyncDataTree {
    get contextKeyService() { return this.internals.contextKeyService; }
    get useAltAsMultipleSelectionModifier() { return this.internals.useAltAsMultipleSelectionModifier; }
    get onDidOpen() { return this.internals.onDidOpen; }
    constructor(user, container, delegate, renderers, dataSource, options, instantiationService, contextKeyService, listService, configurationService) {
        // eslint-disable-next-line local/code-no-any-casts
        const { options: treeOptions, getTypeNavigationMode, disposable } = instantiationService.invokeFunction(workbenchTreeDataPreamble, options);
        super(user, container, delegate, renderers, dataSource, treeOptions);
        this.disposables.add(disposable);
        this.internals = new WorkbenchTreeInternals(this, options, getTypeNavigationMode, options.overrideStyles, contextKeyService, listService, configurationService);
        this.disposables.add(this.internals);
    }
    updateOptions(options = {}) {
        super.updateOptions(options);
        if (options.overrideStyles) {
            this.internals.updateStyleOverrides(options.overrideStyles);
        }
        this.internals.updateOptions(options);
    }
};
WorkbenchAsyncDataTree = __decorate([
    __param(6, IInstantiationService),
    __param(7, IContextKeyService),
    __param(8, IListService),
    __param(9, IConfigurationService)
], WorkbenchAsyncDataTree);
export { WorkbenchAsyncDataTree };
let WorkbenchCompressibleAsyncDataTree = class WorkbenchCompressibleAsyncDataTree extends CompressibleAsyncDataTree {
    get contextKeyService() { return this.internals.contextKeyService; }
    get useAltAsMultipleSelectionModifier() { return this.internals.useAltAsMultipleSelectionModifier; }
    get onDidOpen() { return this.internals.onDidOpen; }
    constructor(user, container, virtualDelegate, compressionDelegate, renderers, dataSource, options, instantiationService, contextKeyService, listService, configurationService) {
        // eslint-disable-next-line local/code-no-any-casts
        const { options: treeOptions, getTypeNavigationMode, disposable } = instantiationService.invokeFunction(workbenchTreeDataPreamble, options);
        super(user, container, virtualDelegate, compressionDelegate, renderers, dataSource, treeOptions);
        this.disposables.add(disposable);
        this.internals = new WorkbenchTreeInternals(this, options, getTypeNavigationMode, options.overrideStyles, contextKeyService, listService, configurationService);
        this.disposables.add(this.internals);
    }
    updateOptions(options) {
        super.updateOptions(options);
        this.internals.updateOptions(options);
    }
};
WorkbenchCompressibleAsyncDataTree = __decorate([
    __param(7, IInstantiationService),
    __param(8, IContextKeyService),
    __param(9, IListService),
    __param(10, IConfigurationService)
], WorkbenchCompressibleAsyncDataTree);
export { WorkbenchCompressibleAsyncDataTree };
function getDefaultTreeFindMode(configurationService) {
    const value = configurationService.getValue(defaultFindModeSettingKey);
    if (value === 'highlight') {
        return TreeFindMode.Highlight;
    }
    else if (value === 'filter') {
        return TreeFindMode.Filter;
    }
    const deprecatedValue = configurationService.getValue(keyboardNavigationSettingKey);
    if (deprecatedValue === 'simple' || deprecatedValue === 'highlight') {
        return TreeFindMode.Highlight;
    }
    else if (deprecatedValue === 'filter') {
        return TreeFindMode.Filter;
    }
    return undefined;
}
function getDefaultTreeFindMatchType(configurationService) {
    const value = configurationService.getValue(defaultFindMatchTypeSettingKey);
    if (value === 'fuzzy') {
        return TreeFindMatchType.Fuzzy;
    }
    else if (value === 'contiguous') {
        return TreeFindMatchType.Contiguous;
    }
    return undefined;
}
function workbenchTreeDataPreamble(accessor, options) {
    const configurationService = accessor.get(IConfigurationService);
    const contextViewService = accessor.get(IContextViewService);
    const contextKeyService = accessor.get(IContextKeyService);
    const instantiationService = accessor.get(IInstantiationService);
    const getTypeNavigationMode = () => {
        // give priority to the context key value to specify a value
        const modeString = contextKeyService.getContextKeyValue(WorkbenchListTypeNavigationModeKey);
        if (modeString === 'automatic') {
            return TypeNavigationMode.Automatic;
        }
        else if (modeString === 'trigger') {
            return TypeNavigationMode.Trigger;
        }
        // also check the deprecated context key to set the mode to 'trigger'
        const modeBoolean = contextKeyService.getContextKeyValue(WorkbenchListAutomaticKeyboardNavigationLegacyKey);
        if (modeBoolean === false) {
            return TypeNavigationMode.Trigger;
        }
        // finally, check the setting
        const configString = configurationService.getValue(typeNavigationModeSettingKey);
        if (configString === 'automatic') {
            return TypeNavigationMode.Automatic;
        }
        else if (configString === 'trigger') {
            return TypeNavigationMode.Trigger;
        }
        return undefined;
    };
    const horizontalScrolling = options.horizontalScrolling !== undefined ? options.horizontalScrolling : Boolean(configurationService.getValue(horizontalScrollingKey));
    const [workbenchListOptions, disposable] = instantiationService.invokeFunction(toWorkbenchListOptions, options);
    const paddingBottom = options.paddingBottom;
    const renderIndentGuides = options.renderIndentGuides !== undefined ? options.renderIndentGuides : configurationService.getValue(treeRenderIndentGuidesKey);
    return {
        getTypeNavigationMode,
        disposable,
        // eslint-disable-next-line local/code-no-dangerous-type-assertions
        options: {
            // ...options, // TODO@Joao why is this not splatted here?
            keyboardSupport: false,
            ...workbenchListOptions,
            indent: typeof configurationService.getValue(treeIndentKey) === 'number' ? configurationService.getValue(treeIndentKey) : undefined,
            renderIndentGuides,
            smoothScrolling: Boolean(configurationService.getValue(listSmoothScrolling)),
            defaultFindMode: options.defaultFindMode ?? getDefaultTreeFindMode(configurationService),
            defaultFindMatchType: options.defaultFindMatchType ?? getDefaultTreeFindMatchType(configurationService),
            horizontalScrolling,
            scrollByPage: Boolean(configurationService.getValue(scrollByPageKey)),
            paddingBottom: paddingBottom,
            hideTwistiesOfChildlessElements: options.hideTwistiesOfChildlessElements,
            expandOnlyOnTwistieClick: options.expandOnlyOnTwistieClick ?? (configurationService.getValue(treeExpandMode) === 'doubleClick'),
            contextViewProvider: contextViewService,
            findWidgetStyles: defaultFindWidgetStyles,
            enableStickyScroll: Boolean(configurationService.getValue(treeStickyScroll)),
            stickyScrollMaxItemCount: Number(configurationService.getValue(treeStickyScrollMaxElements)),
        }
    };
}
let WorkbenchTreeInternals = class WorkbenchTreeInternals {
    get onDidOpen() { return this.navigator.onDidOpen; }
    constructor(tree, options, getTypeNavigationMode, overrideStyles, contextKeyService, listService, configurationService) {
        this.tree = tree;
        this.disposables = [];
        this.contextKeyService = createScopedContextKeyService(contextKeyService, tree);
        this.disposables.push(createScrollObserver(this.contextKeyService, tree));
        this.listSupportsMultiSelect = WorkbenchListSupportsMultiSelectContextKey.bindTo(this.contextKeyService);
        this.listSupportsMultiSelect.set(options.multipleSelectionSupport !== false);
        const listSelectionNavigation = WorkbenchListSelectionNavigation.bindTo(this.contextKeyService);
        listSelectionNavigation.set(Boolean(options.selectionNavigation));
        this.listSupportFindWidget = WorkbenchListSupportsFind.bindTo(this.contextKeyService);
        this.listSupportFindWidget.set(options.findWidgetEnabled ?? true);
        this.hasSelectionOrFocus = WorkbenchListHasSelectionOrFocus.bindTo(this.contextKeyService);
        this.hasDoubleSelection = WorkbenchListDoubleSelection.bindTo(this.contextKeyService);
        this.hasMultiSelection = WorkbenchListMultiSelection.bindTo(this.contextKeyService);
        this.treeElementCanCollapse = WorkbenchTreeElementCanCollapse.bindTo(this.contextKeyService);
        this.treeElementHasParent = WorkbenchTreeElementHasParent.bindTo(this.contextKeyService);
        this.treeElementCanExpand = WorkbenchTreeElementCanExpand.bindTo(this.contextKeyService);
        this.treeElementHasChild = WorkbenchTreeElementHasChild.bindTo(this.contextKeyService);
        this.treeFindOpen = WorkbenchTreeFindOpen.bindTo(this.contextKeyService);
        this.treeStickyScrollFocused = WorkbenchTreeStickyScrollFocused.bindTo(this.contextKeyService);
        this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
        this.updateStyleOverrides(overrideStyles);
        const updateCollapseContextKeys = () => {
            const focus = tree.getFocus()[0];
            if (!focus) {
                return;
            }
            const node = tree.getNode(focus);
            this.treeElementCanCollapse.set(node.collapsible && !node.collapsed);
            this.treeElementHasParent.set(!!tree.getParentElement(focus));
            this.treeElementCanExpand.set(node.collapsible && node.collapsed);
            this.treeElementHasChild.set(!!tree.getFirstElementChild(focus));
        };
        const interestingContextKeys = new Set();
        interestingContextKeys.add(WorkbenchListTypeNavigationModeKey);
        interestingContextKeys.add(WorkbenchListAutomaticKeyboardNavigationLegacyKey);
        this.disposables.push(this.contextKeyService, listService.register(tree), tree.onDidChangeSelection(() => {
            const selection = tree.getSelection();
            const focus = tree.getFocus();
            this.contextKeyService.bufferChangeEvents(() => {
                this.hasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
                this.hasMultiSelection.set(selection.length > 1);
                this.hasDoubleSelection.set(selection.length === 2);
            });
        }), tree.onDidChangeFocus(() => {
            const selection = tree.getSelection();
            const focus = tree.getFocus();
            this.hasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
            updateCollapseContextKeys();
        }), tree.onDidChangeCollapseState(updateCollapseContextKeys), tree.onDidChangeModel(updateCollapseContextKeys), tree.onDidChangeFindOpenState(enabled => this.treeFindOpen.set(enabled)), tree.onDidChangeStickyScrollFocused(focused => this.treeStickyScrollFocused.set(focused)), configurationService.onDidChangeConfiguration(e => {
            let newOptions = {};
            if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
                this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
            }
            if (e.affectsConfiguration(treeIndentKey)) {
                const indent = configurationService.getValue(treeIndentKey);
                newOptions = { ...newOptions, indent };
            }
            if (e.affectsConfiguration(treeRenderIndentGuidesKey) && options.renderIndentGuides === undefined) {
                const renderIndentGuides = configurationService.getValue(treeRenderIndentGuidesKey);
                newOptions = { ...newOptions, renderIndentGuides };
            }
            if (e.affectsConfiguration(listSmoothScrolling)) {
                const smoothScrolling = Boolean(configurationService.getValue(listSmoothScrolling));
                newOptions = { ...newOptions, smoothScrolling };
            }
            if (e.affectsConfiguration(defaultFindModeSettingKey) || e.affectsConfiguration(keyboardNavigationSettingKey)) {
                const defaultFindMode = getDefaultTreeFindMode(configurationService);
                newOptions = { ...newOptions, defaultFindMode };
            }
            if (e.affectsConfiguration(typeNavigationModeSettingKey) || e.affectsConfiguration(keyboardNavigationSettingKey)) {
                const typeNavigationMode = getTypeNavigationMode();
                newOptions = { ...newOptions, typeNavigationMode };
            }
            if (e.affectsConfiguration(defaultFindMatchTypeSettingKey)) {
                const defaultFindMatchType = getDefaultTreeFindMatchType(configurationService);
                newOptions = { ...newOptions, defaultFindMatchType };
            }
            if (e.affectsConfiguration(horizontalScrollingKey) && options.horizontalScrolling === undefined) {
                const horizontalScrolling = Boolean(configurationService.getValue(horizontalScrollingKey));
                newOptions = { ...newOptions, horizontalScrolling };
            }
            if (e.affectsConfiguration(scrollByPageKey)) {
                const scrollByPage = Boolean(configurationService.getValue(scrollByPageKey));
                newOptions = { ...newOptions, scrollByPage };
            }
            if (e.affectsConfiguration(treeExpandMode) && options.expandOnlyOnTwistieClick === undefined) {
                newOptions = { ...newOptions, expandOnlyOnTwistieClick: configurationService.getValue(treeExpandMode) === 'doubleClick' };
            }
            if (e.affectsConfiguration(treeStickyScroll)) {
                const enableStickyScroll = configurationService.getValue(treeStickyScroll);
                newOptions = { ...newOptions, enableStickyScroll };
            }
            if (e.affectsConfiguration(treeStickyScrollMaxElements)) {
                const stickyScrollMaxItemCount = Math.max(1, configurationService.getValue(treeStickyScrollMaxElements));
                newOptions = { ...newOptions, stickyScrollMaxItemCount };
            }
            if (e.affectsConfiguration(mouseWheelScrollSensitivityKey)) {
                const mouseWheelScrollSensitivity = configurationService.getValue(mouseWheelScrollSensitivityKey);
                newOptions = { ...newOptions, mouseWheelScrollSensitivity };
            }
            if (e.affectsConfiguration(fastScrollSensitivityKey)) {
                const fastScrollSensitivity = configurationService.getValue(fastScrollSensitivityKey);
                newOptions = { ...newOptions, fastScrollSensitivity };
            }
            if (Object.keys(newOptions).length > 0) {
                tree.updateOptions(newOptions);
            }
        }), this.contextKeyService.onDidChangeContext(e => {
            if (e.affectsSome(interestingContextKeys)) {
                tree.updateOptions({ typeNavigationMode: getTypeNavigationMode() });
            }
        }));
        this.navigator = new TreeResourceNavigator(tree, { configurationService, ...options });
        this.disposables.push(this.navigator);
    }
    get useAltAsMultipleSelectionModifier() {
        return this._useAltAsMultipleSelectionModifier;
    }
    updateOptions(options) {
        if (options.multipleSelectionSupport !== undefined) {
            this.listSupportsMultiSelect.set(!!options.multipleSelectionSupport);
        }
    }
    updateStyleOverrides(overrideStyles) {
        this.tree.style(overrideStyles ? getListStyles(overrideStyles) : defaultListStyles);
    }
    dispose() {
        this.disposables = dispose(this.disposables);
    }
};
WorkbenchTreeInternals = __decorate([
    __param(4, IContextKeyService),
    __param(5, IListService),
    __param(6, IConfigurationService)
], WorkbenchTreeInternals);
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
    id: 'workbench',
    order: 7,
    title: localize('workbenchConfigurationTitle', "Workbench"),
    type: 'object',
    properties: {
        [multiSelectModifierSettingKey]: {
            type: 'string',
            enum: ['ctrlCmd', 'alt'],
            markdownEnumDescriptions: [
                localize('multiSelectModifier.ctrlCmd', "Maps to `Control` on Windows and Linux and to `Command` on macOS."),
                localize('multiSelectModifier.alt', "Maps to `Alt` on Windows and Linux and to `Option` on macOS.")
            ],
            default: 'ctrlCmd',
            description: localize({
                key: 'multiSelectModifier',
                comment: [
                    '- `ctrlCmd` refers to a value the setting can take and should not be localized.',
                    '- `Control` and `Command` refer to the modifier keys Ctrl or Cmd on the keyboard and can be localized.'
                ]
            }, "The modifier to be used to add an item in trees and lists to a multi-selection with the mouse (for example in the explorer, open editors and scm view). The 'Open to Side' mouse gestures - if supported - will adapt such that they do not conflict with the multiselect modifier.")
        },
        [openModeSettingKey]: {
            type: 'string',
            enum: ['singleClick', 'doubleClick'],
            default: 'singleClick',
            description: localize({
                key: 'openModeModifier',
                comment: ['`singleClick` and `doubleClick` refers to a value the setting can take and should not be localized.']
            }, "Controls how to open items in trees and lists using the mouse (if supported). Note that some trees and lists might choose to ignore this setting if it is not applicable.")
        },
        [horizontalScrollingKey]: {
            type: 'boolean',
            default: false,
            description: localize('horizontalScrolling setting', "Controls whether lists and trees support horizontal scrolling in the workbench. Warning: turning on this setting has a performance implication.")
        },
        [scrollByPageKey]: {
            type: 'boolean',
            default: false,
            description: localize('list.scrollByPage', "Controls whether clicks in the scrollbar scroll page by page.")
        },
        [treeIndentKey]: {
            type: 'number',
            default: 8,
            minimum: 4,
            maximum: 40,
            description: localize('tree indent setting', "Controls tree indentation in pixels.")
        },
        [treeRenderIndentGuidesKey]: {
            type: 'string',
            enum: ['none', 'onHover', 'always'],
            default: 'onHover',
            description: localize('render tree indent guides', "Controls whether the tree should render indent guides.")
        },
        [listSmoothScrolling]: {
            type: 'boolean',
            default: false,
            description: localize('list smoothScrolling setting', "Controls whether lists and trees have smooth scrolling."),
        },
        [mouseWheelScrollSensitivityKey]: {
            type: 'number',
            default: 1,
            markdownDescription: localize('Mouse Wheel Scroll Sensitivity', "A multiplier to be used on the `deltaX` and `deltaY` of mouse wheel scroll events.")
        },
        [fastScrollSensitivityKey]: {
            type: 'number',
            default: 5,
            markdownDescription: localize('Fast Scroll Sensitivity', "Scrolling speed multiplier when pressing `Alt`.")
        },
        [defaultFindModeSettingKey]: {
            type: 'string',
            enum: ['highlight', 'filter'],
            enumDescriptions: [
                localize('defaultFindModeSettingKey.highlight', "Highlight elements when searching. Further up and down navigation will traverse only the highlighted elements."),
                localize('defaultFindModeSettingKey.filter', "Filter elements when searching.")
            ],
            default: 'highlight',
            description: localize('defaultFindModeSettingKey', "Controls the default find mode for lists and trees in the workbench.")
        },
        [keyboardNavigationSettingKey]: {
            type: 'string',
            enum: ['simple', 'highlight', 'filter'],
            enumDescriptions: [
                localize('keyboardNavigationSettingKey.simple', "Simple keyboard navigation focuses elements which match the keyboard input. Matching is done only on prefixes."),
                localize('keyboardNavigationSettingKey.highlight', "Highlight keyboard navigation highlights elements which match the keyboard input. Further up and down navigation will traverse only the highlighted elements."),
                localize('keyboardNavigationSettingKey.filter', "Filter keyboard navigation will filter out and hide all the elements which do not match the keyboard input.")
            ],
            default: 'highlight',
            description: localize('keyboardNavigationSettingKey', "Controls the keyboard navigation style for lists and trees in the workbench. Can be simple, highlight and filter."),
            deprecated: true,
            deprecationMessage: localize('keyboardNavigationSettingKeyDeprecated', "Please use 'workbench.list.defaultFindMode' and	'workbench.list.typeNavigationMode' instead.")
        },
        [defaultFindMatchTypeSettingKey]: {
            type: 'string',
            enum: ['fuzzy', 'contiguous'],
            enumDescriptions: [
                localize('defaultFindMatchTypeSettingKey.fuzzy', "Use fuzzy matching when searching."),
                localize('defaultFindMatchTypeSettingKey.contiguous', "Use contiguous matching when searching.")
            ],
            default: 'fuzzy',
            description: localize('defaultFindMatchTypeSettingKey', "Controls the type of matching used when searching lists and trees in the workbench.")
        },
        [treeExpandMode]: {
            type: 'string',
            enum: ['singleClick', 'doubleClick'],
            default: 'singleClick',
            description: localize('expand mode', "Controls how tree folders are expanded when clicking the folder names. Note that some trees and lists might choose to ignore this setting if it is not applicable."),
        },
        [treeStickyScroll]: {
            type: 'boolean',
            default: true,
            description: localize('sticky scroll', "Controls whether sticky scrolling is enabled in trees."),
        },
        [treeStickyScrollMaxElements]: {
            type: 'number',
            minimum: 1,
            default: 7,
            markdownDescription: localize('sticky scroll maximum items', "Controls the number of sticky elements displayed in the tree when {0} is enabled.", '`#workbench.tree.enableStickyScroll#`'),
        },
        [typeNavigationModeSettingKey]: {
            type: 'string',
            enum: ['automatic', 'trigger'],
            default: 'automatic',
            markdownDescription: localize('typeNavigationMode2', "Controls how type navigation works in lists and trees in the workbench. When set to `trigger`, type navigation begins once the `list.triggerTypeNavigation` command is run."),
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlzdFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFHaEYsT0FBTyxFQUFxQyxTQUFTLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUMzRyxPQUFPLEVBQTJJLDJCQUEyQixFQUFFLDRCQUE0QixFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRTNSLE9BQU8sRUFBb0QsS0FBSyxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDeEgsT0FBTyxFQUF3RSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUN0SyxPQUFPLEVBQUUsYUFBYSxFQUFFLHlCQUF5QixFQUFnTCxNQUFNLGdEQUFnRCxDQUFDO0FBQ3hSLE9BQU8sRUFBRSxRQUFRLEVBQW9CLE1BQU0sMkNBQTJDLENBQUM7QUFDdkYsT0FBTyxFQUFFLHNCQUFzQixFQUF1SCxVQUFVLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUV0TixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBZSxZQUFZLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4SSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDM0MsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDcEYsT0FBTyxFQUFFLFVBQVUsSUFBSSx1QkFBdUIsRUFBMEIsTUFBTSxxREFBcUQsQ0FBQztB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