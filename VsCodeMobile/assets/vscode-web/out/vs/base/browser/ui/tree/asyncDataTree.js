/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ElementsDragAndDropData } from '../list/listView.js';
import { ComposedTreeDelegate, TreeFindMode as TreeFindMode, FindFilter, FindController } from './abstractTree.js';
import { getVisibleState, isFilterResult } from './indexTreeModel.js';
import { CompressibleObjectTree, ObjectTree } from './objectTree.js';
import { ObjectTreeElementCollapseState, TreeError, WeakMapper } from './tree.js';
import { createCancelablePromise, Promises, ThrottledDelayer, timeout } from '../../../common/async.js';
import { Codicon } from '../../../common/codicons.js';
import { ThemeIcon } from '../../../common/themables.js';
import { isCancellationError, onUnexpectedError } from '../../../common/errors.js';
import { Emitter, Event } from '../../../common/event.js';
import { Iterable } from '../../../common/iterator.js';
import { DisposableStore, dispose, toDisposable } from '../../../common/lifecycle.js';
import { isIterable } from '../../../common/types.js';
import { CancellationTokenSource } from '../../../common/cancellation.js';
import { FuzzyScore } from '../../../common/filters.js';
import { insertInto, splice } from '../../../common/arrays.js';
import { localize } from '../../../../nls.js';
function createAsyncDataTreeNode(props) {
    return {
        ...props,
        children: [],
        refreshPromise: undefined,
        stale: true,
        slow: false,
        forceExpanded: false
    };
}
function isAncestor(ancestor, descendant) {
    if (!descendant.parent) {
        return false;
    }
    else if (descendant.parent === ancestor) {
        return true;
    }
    else {
        return isAncestor(ancestor, descendant.parent);
    }
}
function intersects(node, other) {
    return node === other || isAncestor(node, other) || isAncestor(other, node);
}
class AsyncDataTreeNodeWrapper {
    get element() { return this.node.element.element; }
    get children() { return this.node.children.map(node => new AsyncDataTreeNodeWrapper(node)); }
    get depth() { return this.node.depth; }
    get visibleChildrenCount() { return this.node.visibleChildrenCount; }
    get visibleChildIndex() { return this.node.visibleChildIndex; }
    get collapsible() { return this.node.collapsible; }
    get collapsed() { return this.node.collapsed; }
    get visible() { return this.node.visible; }
    get filterData() { return this.node.filterData; }
    constructor(node) {
        this.node = node;
    }
}
class AsyncDataTreeRenderer {
    constructor(renderer, nodeMapper, onDidChangeTwistieState) {
        this.renderer = renderer;
        this.nodeMapper = nodeMapper;
        this.onDidChangeTwistieState = onDidChangeTwistieState;
        this.renderedNodes = new Map();
        this.templateId = renderer.templateId;
    }
    renderTemplate(container) {
        const templateData = this.renderer.renderTemplate(container);
        return { templateData };
    }
    renderElement(node, index, templateData, details) {
        this.renderer.renderElement(this.nodeMapper.map(node), index, templateData.templateData, details);
    }
    renderTwistie(element, twistieElement) {
        if (element.slow) {
            twistieElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.treeItemLoading));
            return true;
        }
        else {
            twistieElement.classList.remove(...ThemeIcon.asClassNameArray(Codicon.treeItemLoading));
            return false;
        }
    }
    disposeElement(node, index, templateData, details) {
        this.renderer.disposeElement?.(this.nodeMapper.map(node), index, templateData.templateData, details);
    }
    disposeTemplate(templateData) {
        this.renderer.disposeTemplate(templateData.templateData);
    }
    dispose() {
        this.renderedNodes.clear();
    }
}
function asTreeEvent(e) {
    return {
        browserEvent: e.browserEvent,
        elements: e.elements.map(e => e.element)
    };
}
function asTreeMouseEvent(e) {
    return {
        browserEvent: e.browserEvent,
        element: e.element && e.element.element,
        target: e.target
    };
}
function asTreeContextMenuEvent(e) {
    return {
        browserEvent: e.browserEvent,
        element: e.element && e.element.element,
        anchor: e.anchor,
        isStickyScroll: e.isStickyScroll
    };
}
class AsyncDataTreeElementsDragAndDropData extends ElementsDragAndDropData {
    set context(context) {
        this.data.context = context;
    }
    get context() {
        return this.data.context;
    }
    constructor(data) {
        super(data.elements.map(node => node.element));
        this.data = data;
    }
}
function asAsyncDataTreeDragAndDropData(data) {
    if (data instanceof ElementsDragAndDropData) {
        return new AsyncDataTreeElementsDragAndDropData(data);
    }
    return data;
}
class AsyncDataTreeNodeListDragAndDrop {
    constructor(dnd) {
        this.dnd = dnd;
    }
    getDragURI(node) {
        return this.dnd.getDragURI(node.element);
    }
    getDragLabel(nodes, originalEvent) {
        if (this.dnd.getDragLabel) {
            return this.dnd.getDragLabel(nodes.map(node => node.element), originalEvent);
        }
        return undefined;
    }
    onDragStart(data, originalEvent) {
        this.dnd.onDragStart?.(asAsyncDataTreeDragAndDropData(data), originalEvent);
    }
    onDragOver(data, targetNode, targetIndex, targetSector, originalEvent, raw = true) {
        return this.dnd.onDragOver(asAsyncDataTreeDragAndDropData(data), targetNode && targetNode.element, targetIndex, targetSector, originalEvent);
    }
    drop(data, targetNode, targetIndex, targetSector, originalEvent) {
        this.dnd.drop(asAsyncDataTreeDragAndDropData(data), targetNode && targetNode.element, targetIndex, targetSector, originalEvent);
    }
    onDragEnd(originalEvent) {
        this.dnd.onDragEnd?.(originalEvent);
    }
    dispose() {
        this.dnd.dispose();
    }
}
class AsyncFindFilter extends FindFilter {
    constructor(findProvider, // remove public
    keyboardNavigationLabelProvider, filter) {
        super(keyboardNavigationLabelProvider, filter);
        this.findProvider = findProvider;
        this.isFindSessionActive = false;
    }
    filter(element, parentVisibility) {
        const filterResult = super.filter(element, parentVisibility);
        if (!this.isFindSessionActive || this.findMode === TreeFindMode.Highlight || !this.findProvider.isVisible) {
            return filterResult;
        }
        const visibility = isFilterResult(filterResult) ? filterResult.visibility : filterResult;
        if (getVisibleState(visibility) === 0 /* TreeVisibility.Hidden */) {
            return 0 /* TreeVisibility.Hidden */;
        }
        return this.findProvider.isVisible(element) ? filterResult : 0 /* TreeVisibility.Hidden */;
    }
}
// TODO Fix types
class AsyncFindController extends FindController {
    constructor(tree, findProvider, filter, contextViewProvider, options) {
        super(tree, filter, contextViewProvider, options);
        this.findProvider = findProvider;
        this.filter = filter;
        this.activeSession = false;
        this.asyncWorkInProgress = false;
        this.taskQueue = new ThrottledDelayer(250);
        // Always make sure to end the session before disposing
        this.disposables.add(toDisposable(async () => {
            if (this.activeSession) {
                await this.findProvider.endSession?.();
            }
        }));
    }
    applyPattern(_pattern) {
        this.renderMessage(false);
        this.activeTokenSource?.cancel();
        this.activeTokenSource = new CancellationTokenSource();
        this.taskQueue.trigger(() => this.applyPatternAsync());
    }
    async applyPatternAsync() {
        const token = this.activeTokenSource?.token;
        if (!token || token.isCancellationRequested) {
            return;
        }
        const pattern = this.pattern;
        if (pattern === '') {
            if (this.activeSession) {
                this.asyncWorkInProgress = true;
                await this.deactivateFindSession();
                this.asyncWorkInProgress = false;
                if (!token.isCancellationRequested) {
                    this.filter.reset();
                    super.applyPattern('');
                }
            }
            return;
        }
        if (!this.activeSession) {
            this.activateFindSession();
        }
        this.asyncWorkInProgress = true;
        this.activeFindMetadata = undefined;
        const findMetadata = await this.findProvider.find(pattern, { matchType: this.matchType, findMode: this.mode }, token);
        if (token.isCancellationRequested || findMetadata === undefined) {
            return;
        }
        this.asyncWorkInProgress = false;
        this.activeFindMetadata = findMetadata;
        this.filter.reset();
        super.applyPattern(pattern);
        if (findMetadata.warningMessage) {
            this.renderMessage(true, findMetadata.warningMessage);
        }
    }
    activateFindSession() {
        this.activeSession = true;
        this.filter.isFindSessionActive = true;
        this.findProvider.startSession?.();
    }
    async deactivateFindSession() {
        this.activeSession = false;
        this.filter.isFindSessionActive = false;
        await this.findProvider.endSession?.();
    }
    render() {
        if (this.asyncWorkInProgress || !this.activeFindMetadata) {
            return;
        }
        const showNotFound = this.activeFindMetadata.matchCount === 0 && this.pattern.length > 0;
        this.renderMessage(showNotFound);
        if (this.pattern.length) {
            this.alertResults(this.activeFindMetadata.matchCount);
        }
    }
    onDidToggleChange(e) {
        // TODO@benibenj handle toggles nicely across all controllers and between controller and filter
        this.toggles.set(e.id, e.isChecked);
        this.filter.findMode = this.mode;
        this.filter.findMatchType = this.matchType;
        this.placeholder = this.mode === TreeFindMode.Filter ? localize('type to filter', "Type to filter") : localize('type to search', "Type to search");
        this.applyPattern(this.pattern);
    }
    shouldAllowFocus(node) {
        return this.shouldFocusWhenNavigating(node);
    }
    shouldFocusWhenNavigating(node) {
        if (!this.activeSession || !this.activeFindMetadata) {
            return true;
        }
        const element = node.element?.element;
        if (element && this.activeFindMetadata.isMatch(element)) {
            return true;
        }
        return !FuzzyScore.isDefault(node.filterData);
    }
}
function asObjectTreeOptions(options) {
    return options && {
        ...options,
        collapseByDefault: true,
        identityProvider: options.identityProvider && {
            getId(el) {
                return options.identityProvider.getId(el.element);
            }
        },
        dnd: options.dnd && new AsyncDataTreeNodeListDragAndDrop(options.dnd),
        multipleSelectionController: options.multipleSelectionController && {
            isSelectionSingleChangeEvent(e) {
                // eslint-disable-next-line local/code-no-dangerous-type-assertions
                return options.multipleSelectionController.isSelectionSingleChangeEvent({ ...e, element: e.element });
            },
            isSelectionRangeChangeEvent(e) {
                // eslint-disable-next-line local/code-no-dangerous-type-assertions
                return options.multipleSelectionController.isSelectionRangeChangeEvent({ ...e, element: e.element });
            }
        },
        accessibilityProvider: options.accessibilityProvider && {
            ...options.accessibilityProvider,
            getPosInSet: undefined,
            getSetSize: undefined,
            getRole: options.accessibilityProvider.getRole ? (el) => {
                return options.accessibilityProvider.getRole(el.element);
            } : () => 'treeitem',
            isChecked: options.accessibilityProvider.isChecked ? (e) => {
                return !!(options.accessibilityProvider?.isChecked(e.element));
            } : undefined,
            getAriaLabel(e) {
                return options.accessibilityProvider.getAriaLabel(e.element);
            },
            getWidgetAriaLabel() {
                return options.accessibilityProvider.getWidgetAriaLabel();
            },
            getWidgetRole: options.accessibilityProvider.getWidgetRole ? () => options.accessibilityProvider.getWidgetRole() : () => 'tree',
            getAriaLevel: options.accessibilityProvider.getAriaLevel && (node => {
                return options.accessibilityProvider.getAriaLevel(node.element);
            }),
            getActiveDescendantId: options.accessibilityProvider.getActiveDescendantId && (node => {
                return options.accessibilityProvider.getActiveDescendantId(node.element);
            })
        },
        filter: options.filter && {
            filter(e, parentVisibility) {
                return options.filter.filter(e.element, parentVisibility);
            }
        },
        keyboardNavigationLabelProvider: options.keyboardNavigationLabelProvider && {
            ...options.keyboardNavigationLabelProvider,
            getKeyboardNavigationLabel(e) {
                return options.keyboardNavigationLabelProvider.getKeyboardNavigationLabel(e.element);
            }
        },
        sorter: undefined,
        expandOnlyOnTwistieClick: typeof options.expandOnlyOnTwistieClick === 'undefined' ? undefined : (typeof options.expandOnlyOnTwistieClick !== 'function' ? options.expandOnlyOnTwistieClick : ((e) => options.expandOnlyOnTwistieClick(e.element))),
        twistieAdditionalCssClass: typeof options.twistieAdditionalCssClass === 'undefined' ? undefined : ((e) => options.twistieAdditionalCssClass(e.element)),
        defaultFindVisibility: (e) => {
            if (e.hasChildren && e.stale) {
                return 1 /* TreeVisibility.Visible */;
            }
            else if (typeof options.defaultFindVisibility === 'number') {
                return options.defaultFindVisibility;
            }
            else if (typeof options.defaultFindVisibility === 'undefined') {
                return 2 /* TreeVisibility.Recurse */;
            }
            else {
                return options.defaultFindVisibility(e.element);
            }
        },
        stickyScrollDelegate: options.stickyScrollDelegate
    };
}
function dfs(node, fn) {
    fn(node);
    node.children.forEach(child => dfs(child, fn));
}
export class AsyncDataTree {
    get onDidScroll() { return this.tree.onDidScroll; }
    get onDidChangeFocus() { return Event.map(this.tree.onDidChangeFocus, asTreeEvent); }
    get onDidChangeSelection() { return Event.map(this.tree.onDidChangeSelection, asTreeEvent); }
    get onKeyDown() { return this.tree.onKeyDown; }
    get onMouseClick() { return Event.map(this.tree.onMouseClick, asTreeMouseEvent); }
    get onMouseDblClick() { return Event.map(this.tree.onMouseDblClick, asTreeMouseEvent); }
    get onContextMenu() { return Event.map(this.tree.onContextMenu, asTreeContextMenuEvent); }
    get onTap() { return Event.map(this.tree.onTap, asTreeMouseEvent); }
    get onPointer() { return Event.map(this.tree.onPointer, asTreeMouseEvent); }
    get onDidFocus() { return this.tree.onDidFocus; }
    get onDidBlur() { return this.tree.onDidBlur; }
    /**
     * To be used internally only!
     * @deprecated
     */
    get onDidChangeModel() { return this.tree.onDidChangeModel; }
    get onDidChangeCollapseState() { return this.tree.onDidChangeCollapseState; }
    get onDidUpdateOptions() { return this.tree.onDidUpdateOptions; }
    get onDidChangeStickyScrollFocused() { return this.tree.onDidChangeStickyScrollFocused; }
    get findMode() { return this.findController ? this.findController.mode : this.tree.findMode; }
    set findMode(mode) { this.findController ? this.findController.mode = mode : this.tree.findMode = mode; }
    get findMatchType() { return this.findController ? this.findController.matchType : this.tree.findMatchType; }
    set findMatchType(matchType) { this.findController ? this.findController.matchType = matchType : this.tree.findMatchType = matchType; }
    get expandOnlyOnTwistieClick() {
        if (typeof this.tree.expandOnlyOnTwistieClick === 'boolean') {
            return this.tree.expandOnlyOnTwistieClick;
        }
        const fn = this.tree.expandOnlyOnTwistieClick;
        return element => fn(this.nodes.get((element === this.root.element ? null : element)) || null);
    }
    get onDidDispose() { return this.tree.onDidDispose; }
    constructor(user, container, delegate, renderers, dataSource, options = {}) {
        this.user = user;
        this.dataSource = dataSource;
        this.nodes = new Map();
        this.subTreeRefreshPromises = new Map();
        this.refreshPromises = new Map();
        this._onDidRender = new Emitter();
        this._onDidChangeNodeSlowState = new Emitter();
        this.nodeMapper = new WeakMapper(node => new AsyncDataTreeNodeWrapper(node));
        this.disposables = new DisposableStore();
        this.identityProvider = options.identityProvider;
        this.autoExpandSingleChildren = typeof options.autoExpandSingleChildren === 'undefined' ? false : options.autoExpandSingleChildren;
        this.sorter = options.sorter;
        this.getDefaultCollapseState = e => options.collapseByDefault ? (options.collapseByDefault(e) ? ObjectTreeElementCollapseState.PreserveOrCollapsed : ObjectTreeElementCollapseState.PreserveOrExpanded) : undefined;
        let asyncFindEnabled = false;
        let findFilter;
        if (options.findProvider && (options.findWidgetEnabled ?? true) && options.keyboardNavigationLabelProvider && options.contextViewProvider) {
            asyncFindEnabled = true;
            findFilter = new AsyncFindFilter(options.findProvider, options.keyboardNavigationLabelProvider, options.filter);
        }
        this.tree = this.createTree(user, container, delegate, renderers, { ...options, findWidgetEnabled: !asyncFindEnabled, filter: findFilter ?? options.filter });
        this.root = createAsyncDataTreeNode({
            element: undefined,
            parent: null,
            hasChildren: true,
            defaultCollapseState: undefined
        });
        if (this.identityProvider) {
            this.root = {
                ...this.root,
                id: null
            };
        }
        this.nodes.set(null, this.root);
        this.tree.onDidChangeCollapseState(this._onDidChangeCollapseState, this, this.disposables);
        if (asyncFindEnabled) {
            const findOptions = {
                styles: options.findWidgetStyles,
                showNotFoundMessage: options.showNotFoundMessage,
                defaultFindMatchType: options.defaultFindMatchType,
                defaultFindMode: options.defaultFindMode,
            };
            this.findController = this.disposables.add(new AsyncFindController(this.tree, options.findProvider, findFilter, this.tree.options.contextViewProvider, findOptions));
            this.focusNavigationFilter = node => this.findController.shouldFocusWhenNavigating(node);
            this.onDidChangeFindOpenState = this.findController.onDidChangeOpenState;
            this.onDidChangeFindMode = this.findController.onDidChangeMode;
            this.onDidChangeFindMatchType = this.findController.onDidChangeMatchType;
        }
        else {
            this.onDidChangeFindOpenState = this.tree.onDidChangeFindOpenState;
            this.onDidChangeFindMode = this.tree.onDidChangeFindMode;
            this.onDidChangeFindMatchType = this.tree.onDidChangeFindMatchType;
        }
    }
    createTree(user, container, delegate, renderers, options) {
        const objectTreeDelegate = new ComposedTreeDelegate(delegate);
        const objectTreeRenderers = renderers.map(r => new AsyncDataTreeRenderer(r, this.nodeMapper, this._onDidChangeNodeSlowState.event));
        const objectTreeOptions = asObjectTreeOptions(options) || {};
        return new ObjectTree(user, container, objectTreeDelegate, objectTreeRenderers, objectTreeOptions);
    }
    updateOptions(optionsUpdate = {}) {
        if (this.findController) {
            if (optionsUpdate.defaultFindMode !== undefined) {
                this.findController.mode = optionsUpdate.defaultFindMode;
            }
            if (optionsUpdate.defaultFindMatchType !== undefined) {
                this.findController.matchType = optionsUpdate.defaultFindMatchType;
            }
        }
        this.tree.updateOptions(optionsUpdate);
    }
    get options() {
        return this.tree.options;
    }
    // Widget
    getHTMLElement() {
        return this.tree.getHTMLElement();
    }
    get contentHeight() {
        return this.tree.contentHeight;
    }
    get contentWidth() {
        return this.tree.contentWidth;
    }
    get onDidChangeContentHeight() {
        return this.tree.onDidChangeContentHeight;
    }
    get onDidChangeContentWidth() {
        return this.tree.onDidChangeContentWidth;
    }
    get scrollTop() {
        return this.tree.scrollTop;
    }
    set scrollTop(scrollTop) {
        this.tree.scrollTop = scrollTop;
    }
    get scrollLeft() {
        return this.tree.scrollLeft;
    }
    set scrollLeft(scrollLeft) {
        this.tree.scrollLeft = scrollLeft;
    }
    get scrollHeight() {
        return this.tree.scrollHeight;
    }
    get renderHeight() {
        return this.tree.renderHeight;
    }
    get lastVisibleElement() {
        return this.tree.lastVisibleElement.element;
    }
    get ariaLabel() {
        return this.tree.ariaLabel;
    }
    set ariaLabel(value) {
        this.tree.ariaLabel = value;
    }
    domFocus() {
        this.tree.domFocus();
    }
    isDOMFocused() {
        return this.tree.isDOMFocused();
    }
    navigate(start) {
        let startNode;
        if (start) {
            startNode = this.getDataNode(start);
        }
        return new AsyncDataTreeNavigator(this.tree.navigate(startNode));
    }
    layout(height, width) {
        this.tree.layout(height, width);
    }
    style(styles) {
        this.tree.style(styles);
    }
    // Model
    getInput() {
        return this.root.element;
    }
    async setInput(input, viewState) {
        this.cancelAllRefreshPromises();
        this.root.element = input;
        const viewStateContext = viewState && { viewState, focus: [], selection: [] };
        await this._updateChildren(input, true, false, viewStateContext);
        if (viewStateContext) {
            this.tree.setFocus(viewStateContext.focus);
            this.tree.setSelection(viewStateContext.selection);
        }
        if (viewState && typeof viewState.scrollTop === 'number') {
            this.scrollTop = viewState.scrollTop;
        }
    }
    async updateChildren(element = this.root.element, recursive = true, rerender = false, options) {
        await this._updateChildren(element, recursive, rerender, undefined, options);
    }
    cancelAllRefreshPromises(includeSubTrees = false) {
        this.refreshPromises.forEach(promise => promise.cancel());
        this.refreshPromises.clear();
        if (includeSubTrees) {
            this.subTreeRefreshPromises.forEach(promise => promise.cancel());
            this.subTreeRefreshPromises.clear();
        }
    }
    async _updateChildren(element = this.root.element, recursive = true, rerender = false, viewStateContext, options) {
        if (typeof this.root.element === 'undefined') {
            throw new TreeError(this.user, 'Tree input not set');
        }
        if (this.root.refreshPromise) {
            await this.root.refreshPromise;
            await Event.toPromise(this._onDidRender.event);
        }
        const node = this.getDataNode(element);
        await this.refreshAndRenderNode(node, recursive, viewStateContext, options);
        if (rerender) {
            try {
                this.tree.rerender(node);
            }
            catch {
                // missing nodes are fine, this could've resulted from
                // parallel refresh calls, removing `node` altogether
            }
        }
    }
    resort(element = this.root.element, recursive = true) {
        this.tree.resort(this.getDataNode(element), recursive);
    }
    hasNode(element) {
        return element === this.root.element || this.nodes.has(element);
    }
    // View
    rerender(element) {
        if (element === undefined || element === this.root.element) {
            this.tree.rerender();
            return;
        }
        const node = this.getDataNode(element);
        this.tree.rerender(node);
    }
    updateElementHeight(element, height) {
        const node = this.getDataNode(element);
        this.tree.updateElementHeight(node, height);
    }
    updateWidth(element) {
        const node = this.getDataNode(element);
        this.tree.updateWidth(node);
    }
    // Tree
    getNode(element = this.root.element) {
        const dataNode = this.getDataNode(element);
        const node = this.tree.getNode(dataNode === this.root ? null : dataNode);
        return this.nodeMapper.map(node);
    }
    collapse(element, recursive = false) {
        const node = this.getDataNode(element);
        return this.tree.collapse(node === this.root ? null : node, recursive);
    }
    async expand(element, recursive = false) {
        if (typeof this.root.element === 'undefined') {
            throw new TreeError(this.user, 'Tree input not set');
        }
        if (this.root.refreshPromise) {
            await this.root.refreshPromise;
            await Event.toPromise(this._onDidRender.event);
        }
        const node = this.getDataNode(element);
        if (this.tree.hasElement(node) && !this.tree.isCollapsible(node)) {
            return false;
        }
        if (node.refreshPromise) {
            await node.refreshPromise;
            await Event.toPromise(this._onDidRender.event);
        }
        if (node !== this.root && !node.refreshPromise && !this.tree.isCollapsed(node)) {
            return false;
        }
        const result = this.tree.expand(node === this.root ? null : node, recursive);
        if (node.refreshPromise) {
            await node.refreshPromise;
            await Event.toPromise(this._onDidRender.event);
        }
        return result;
    }
    toggleCollapsed(element, recursive = false) {
        return this.tree.toggleCollapsed(this.getDataNode(element), recursive);
    }
    expandAll() {
        this.tree.expandAll();
    }
    async expandTo(element) {
        if (!this.dataSource.getParent) {
            throw new Error('Can\'t expand to element without getParent method');
        }
        const elements = [];
        while (!this.hasNode(element)) {
            element = this.dataSource.getParent(element);
            if (element !== this.root.element) {
                elements.push(element);
            }
        }
        for (const element of Iterable.reverse(elements)) {
            await this.expand(element);
        }
        this.tree.expandTo(this.getDataNode(element));
    }
    collapseAll() {
        this.tree.collapseAll();
    }
    isCollapsible(element) {
        return this.tree.isCollapsible(this.getDataNode(element));
    }
    isCollapsed(element) {
        return this.tree.isCollapsed(this.getDataNode(element));
    }
    triggerTypeNavigation() {
        this.tree.triggerTypeNavigation();
    }
    openFind() {
        if (this.findController) {
            this.findController.open();
        }
        else {
            this.tree.openFind();
        }
    }
    closeFind() {
        if (this.findController) {
            this.findController.close();
        }
        else {
            this.tree.closeFind();
        }
    }
    refilter() {
        this.tree.refilter();
    }
    setAnchor(element) {
        this.tree.setAnchor(typeof element === 'undefined' ? undefined : this.getDataNode(element));
    }
    getAnchor() {
        const node = this.tree.getAnchor();
        return node?.element;
    }
    setSelection(elements, browserEvent) {
        const nodes = elements.map(e => this.getDataNode(e));
        this.tree.setSelection(nodes, browserEvent);
    }
    getSelection() {
        const nodes = this.tree.getSelection();
        return nodes.map(n => n.element);
    }
    setFocus(elements, browserEvent) {
        const nodes = elements.map(e => this.getDataNode(e));
        this.tree.setFocus(nodes, browserEvent);
    }
    focusNext(n = 1, loop = false, browserEvent) {
        this.tree.focusNext(n, loop, browserEvent, this.focusNavigationFilter);
    }
    focusPrevious(n = 1, loop = false, browserEvent) {
        this.tree.focusPrevious(n, loop, browserEvent, this.focusNavigationFilter);
    }
    focusNextPage(browserEvent) {
        return this.tree.focusNextPage(browserEvent, this.focusNavigationFilter);
    }
    focusPreviousPage(browserEvent) {
        return this.tree.focusPreviousPage(browserEvent, this.focusNavigationFilter);
    }
    focusLast(browserEvent) {
        this.tree.focusLast(browserEvent, this.focusNavigationFilter);
    }
    focusFirst(browserEvent) {
        this.tree.focusFirst(browserEvent, this.focusNavigationFilter);
    }
    getFocus() {
        const nodes = this.tree.getFocus();
        return nodes.map(n => n.element);
    }
    getStickyScrollFocus() {
        const nodes = this.tree.getStickyScrollFocus();
        return nodes.map(n => n.element);
    }
    getFocusedPart() {
        return this.tree.getFocusedPart();
    }
    reveal(element, relativeTop) {
        this.tree.reveal(this.getDataNode(element), relativeTop);
    }
    getRelativeTop(element) {
        return this.tree.getRelativeTop(this.getDataNode(element));
    }
    // Tree navigation
    getParentElement(element) {
        const node = this.tree.getParentElement(this.getDataNode(element));
        return (node && node.element);
    }
    getFirstElementChild(element = this.root.element) {
        const dataNode = this.getDataNode(element);
        const node = this.tree.getFirstElementChild(dataNode === this.root ? null : dataNode);
        return (node && node.element);
    }
    // Implementation
    getDataNode(element) {
        const node = this.nodes.get((element === this.root.element ? null : element));
        if (!node) {
            const nodeIdentity = this.identityProvider?.getId(element).toString();
            throw new TreeError(this.user, `Data tree node not found${nodeIdentity ? `: ${nodeIdentity}` : ''}`);
        }
        return node;
    }
    async refreshAndRenderNode(node, recursive, viewStateContext, options) {
        if (this.disposables.isDisposed) {
            return; // tree disposed during refresh, again (#228211)
        }
        await this.refreshNode(node, recursive, viewStateContext);
        if (this.disposables.isDisposed) {
            return; // tree disposed during refresh (#199264)
        }
        this.render(node, viewStateContext, options);
    }
    async refreshNode(node, recursive, viewStateContext) {
        let result;
        this.subTreeRefreshPromises.forEach((refreshPromise, refreshNode) => {
            if (!result && intersects(refreshNode, node)) {
                result = refreshPromise.then(() => this.refreshNode(node, recursive, viewStateContext));
            }
        });
        if (result) {
            return result;
        }
        if (node !== this.root) {
            const treeNode = this.tree.getNode(node);
            if (treeNode.collapsed) {
                node.hasChildren = !!this.dataSource.hasChildren(node.element);
                node.stale = true;
                this.setChildren(node, [], recursive, viewStateContext);
                return;
            }
        }
        return this.doRefreshSubTree(node, recursive, viewStateContext);
    }
    async doRefreshSubTree(node, recursive, viewStateContext) {
        const cancelablePromise = createCancelablePromise(async () => {
            const childrenToRefresh = await this.doRefreshNode(node, recursive, viewStateContext);
            node.stale = false;
            await Promises.settled(childrenToRefresh.map(child => this.doRefreshSubTree(child, recursive, viewStateContext)));
        });
        node.refreshPromise = cancelablePromise;
        this.subTreeRefreshPromises.set(node, cancelablePromise);
        cancelablePromise.finally(() => {
            node.refreshPromise = undefined;
            this.subTreeRefreshPromises.delete(node);
        });
        return cancelablePromise;
    }
    async doRefreshNode(node, recursive, viewStateContext) {
        node.hasChildren = !!this.dataSource.hasChildren(node.element);
        let childrenPromise;
        if (!node.hasChildren) {
            childrenPromise = Promise.resolve(Iterable.empty());
        }
        else {
            const children = this.doGetChildren(node);
            if (isIterable(children)) {
                childrenPromise = Promise.resolve(children);
            }
            else {
                const slowTimeout = timeout(800);
                slowTimeout.then(() => {
                    node.slow = true;
                    this._onDidChangeNodeSlowState.fire(node);
                }, _ => null);
                childrenPromise = children.finally(() => slowTimeout.cancel());
            }
        }
        try {
            const children = await childrenPromise;
            return this.setChildren(node, children, recursive, viewStateContext);
        }
        catch (err) {
            if (node !== this.root && this.tree.hasElement(node)) {
                this.tree.collapse(node);
            }
            if (isCancellationError(err)) {
                return [];
            }
            throw err;
        }
        finally {
            if (node.slow) {
                node.slow = false;
                this._onDidChangeNodeSlowState.fire(node);
            }
        }
    }
    doGetChildren(node) {
        let result = this.refreshPromises.get(node);
        if (result) {
            return result;
        }
        const children = this.dataSource.getChildren(node.element);
        if (isIterable(children)) {
            return this.processChildren(children);
        }
        else {
            result = createCancelablePromise(async () => this.processChildren(await children));
            this.refreshPromises.set(node, result);
            return result.finally(() => { this.refreshPromises.delete(node); });
        }
    }
    _onDidChangeCollapseState({ node, deep }) {
        if (node.element === null) {
            return;
        }
        if (!node.collapsed && node.element.stale) {
            if (deep) {
                this.collapse(node.element.element);
            }
            else {
                this.refreshAndRenderNode(node.element, false)
                    .catch(onUnexpectedError);
            }
        }
    }
    setChildren(node, childrenElementsIterable, recursive, viewStateContext) {
        const childrenElements = [...childrenElementsIterable];
        // perf: if the node was and still is a leaf, avoid all this hassle
        if (node.children.length === 0 && childrenElements.length === 0) {
            return [];
        }
        const nodesToForget = new Map();
        const childrenTreeNodesById = new Map();
        for (const child of node.children) {
            nodesToForget.set(child.element, child);
            if (this.identityProvider) {
                childrenTreeNodesById.set(child.id, { node: child, collapsed: this.tree.hasElement(child) && this.tree.isCollapsed(child) });
            }
        }
        const childrenToRefresh = [];
        const children = childrenElements.map(element => {
            const hasChildren = !!this.dataSource.hasChildren(element);
            if (!this.identityProvider) {
                const asyncDataTreeNode = createAsyncDataTreeNode({ element, parent: node, hasChildren, defaultCollapseState: this.getDefaultCollapseState(element) });
                if (hasChildren && asyncDataTreeNode.defaultCollapseState === ObjectTreeElementCollapseState.PreserveOrExpanded) {
                    childrenToRefresh.push(asyncDataTreeNode);
                }
                return asyncDataTreeNode;
            }
            const id = this.identityProvider.getId(element).toString();
            const result = childrenTreeNodesById.get(id);
            if (result) {
                const asyncDataTreeNode = result.node;
                nodesToForget.delete(asyncDataTreeNode.element);
                this.nodes.delete(asyncDataTreeNode.element);
                this.nodes.set(element, asyncDataTreeNode);
                asyncDataTreeNode.element = element;
                asyncDataTreeNode.hasChildren = hasChildren;
                if (recursive) {
                    if (result.collapsed) {
                        asyncDataTreeNode.children.forEach(node => dfs(node, node => this.nodes.delete(node.element)));
                        asyncDataTreeNode.children.splice(0, asyncDataTreeNode.children.length);
                        asyncDataTreeNode.stale = true;
                    }
                    else {
                        childrenToRefresh.push(asyncDataTreeNode);
                    }
                }
                else if (hasChildren && !result.collapsed) {
                    childrenToRefresh.push(asyncDataTreeNode);
                }
                return asyncDataTreeNode;
            }
            const childAsyncDataTreeNode = createAsyncDataTreeNode({ element, parent: node, id, hasChildren, defaultCollapseState: this.getDefaultCollapseState(element) });
            if (viewStateContext && viewStateContext.viewState.focus && viewStateContext.viewState.focus.indexOf(id) > -1) {
                viewStateContext.focus.push(childAsyncDataTreeNode);
            }
            if (viewStateContext && viewStateContext.viewState.selection && viewStateContext.viewState.selection.indexOf(id) > -1) {
                viewStateContext.selection.push(childAsyncDataTreeNode);
            }
            if (viewStateContext && viewStateContext.viewState.expanded && viewStateContext.viewState.expanded.indexOf(id) > -1) {
                childrenToRefresh.push(childAsyncDataTreeNode);
            }
            else if (hasChildren && childAsyncDataTreeNode.defaultCollapseState === ObjectTreeElementCollapseState.PreserveOrExpanded) {
                childrenToRefresh.push(childAsyncDataTreeNode);
            }
            return childAsyncDataTreeNode;
        });
        for (const node of nodesToForget.values()) {
            dfs(node, node => this.nodes.delete(node.element));
        }
        for (const child of children) {
            this.nodes.set(child.element, child);
        }
        splice(node.children, 0, node.children.length, children);
        // TODO@joao this doesn't take filter into account
        if (node !== this.root && this.autoExpandSingleChildren && children.length === 1 && childrenToRefresh.length === 0) {
            children[0].forceExpanded = true;
            childrenToRefresh.push(children[0]);
        }
        return childrenToRefresh;
    }
    render(node, viewStateContext, options) {
        const children = node.children.map(node => this.asTreeElement(node, viewStateContext));
        const objectTreeOptions = options && {
            ...options,
            diffIdentityProvider: options.diffIdentityProvider && {
                getId(node) {
                    return options.diffIdentityProvider.getId(node.element);
                }
            }
        };
        this.tree.setChildren(node === this.root ? null : node, children, objectTreeOptions);
        if (node !== this.root) {
            this.tree.setCollapsible(node, node.hasChildren);
        }
        this._onDidRender.fire();
    }
    asTreeElement(node, viewStateContext) {
        if (node.stale) {
            return {
                element: node,
                collapsible: node.hasChildren,
                collapsed: true
            };
        }
        let collapsed;
        if (viewStateContext && viewStateContext.viewState.expanded && node.id && viewStateContext.viewState.expanded.indexOf(node.id) > -1) {
            collapsed = false;
        }
        else if (node.forceExpanded) {
            collapsed = false;
            node.forceExpanded = false;
        }
        else {
            collapsed = node.defaultCollapseState;
        }
        return {
            element: node,
            children: node.hasChildren ? Iterable.map(node.children, child => this.asTreeElement(child, viewStateContext)) : [],
            collapsible: node.hasChildren,
            collapsed
        };
    }
    processChildren(children) {
        if (this.sorter) {
            children = [...children].sort(this.sorter.compare.bind(this.sorter));
        }
        return children;
    }
    // view state
    getViewState() {
        if (!this.identityProvider) {
            throw new TreeError(this.user, 'Can\'t get tree view state without an identity provider');
        }
        const getId = (element) => this.identityProvider.getId(element).toString();
        const focus = this.getFocus().map(getId);
        const selection = this.getSelection().map(getId);
        const expanded = [];
        const root = this.tree.getNode();
        const stack = [root];
        while (stack.length > 0) {
            const node = stack.pop();
            if (node !== root && node.collapsible && !node.collapsed) {
                expanded.push(getId(node.element.element));
            }
            insertInto(stack, stack.length, node.children);
        }
        return { focus, selection, expanded, scrollTop: this.scrollTop };
    }
    dispose() {
        this.disposables.dispose();
        this.tree.dispose();
    }
}
class CompressibleAsyncDataTreeNodeWrapper {
    get element() {
        return {
            elements: this.node.element.elements.map(e => e.element),
            incompressible: this.node.element.incompressible
        };
    }
    get children() { return this.node.children.map(node => new CompressibleAsyncDataTreeNodeWrapper(node)); }
    get depth() { return this.node.depth; }
    get visibleChildrenCount() { return this.node.visibleChildrenCount; }
    get visibleChildIndex() { return this.node.visibleChildIndex; }
    get collapsible() { return this.node.collapsible; }
    get collapsed() { return this.node.collapsed; }
    get visible() { return this.node.visible; }
    get filterData() { return this.node.filterData; }
    constructor(node) {
        this.node = node;
    }
}
class CompressibleAsyncDataTreeRenderer {
    constructor(renderer, nodeMapper, compressibleNodeMapperProvider, onDidChangeTwistieState) {
        this.renderer = renderer;
        this.nodeMapper = nodeMapper;
        this.compressibleNodeMapperProvider = compressibleNodeMapperProvider;
        this.onDidChangeTwistieState = onDidChangeTwistieState;
        this.renderedNodes = new Map();
        this.disposables = [];
        this.templateId = renderer.templateId;
    }
    renderTemplate(container) {
        const templateData = this.renderer.renderTemplate(container);
        return { templateData };
    }
    renderElement(node, index, templateData, details) {
        this.renderer.renderElement(this.nodeMapper.map(node), index, templateData.templateData, details);
    }
    renderCompressedElements(node, index, templateData, details) {
        this.renderer.renderCompressedElements(this.compressibleNodeMapperProvider().map(node), index, templateData.templateData, details);
    }
    renderTwistie(element, twistieElement) {
        if (element.slow) {
            twistieElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.treeItemLoading));
            return true;
        }
        else {
            twistieElement.classList.remove(...ThemeIcon.asClassNameArray(Codicon.treeItemLoading));
            return false;
        }
    }
    disposeElement(node, index, templateData, details) {
        this.renderer.disposeElement?.(this.nodeMapper.map(node), index, templateData.templateData, details);
    }
    disposeCompressedElements(node, index, templateData, details) {
        this.renderer.disposeCompressedElements?.(this.compressibleNodeMapperProvider().map(node), index, templateData.templateData, details);
    }
    disposeTemplate(templateData) {
        this.renderer.disposeTemplate(templateData.templateData);
    }
    dispose() {
        this.renderedNodes.clear();
        this.disposables = dispose(this.disposables);
    }
}
function asCompressibleObjectTreeOptions(options) {
    const objectTreeOptions = options && asObjectTreeOptions(options);
    return objectTreeOptions && {
        ...objectTreeOptions,
        keyboardNavigationLabelProvider: objectTreeOptions.keyboardNavigationLabelProvider && {
            ...objectTreeOptions.keyboardNavigationLabelProvider,
            getCompressedNodeKeyboardNavigationLabel(els) {
                return options.keyboardNavigationLabelProvider.getCompressedNodeKeyboardNavigationLabel(els.map(e => e.element));
            }
        },
        stickyScrollDelegate: objectTreeOptions.stickyScrollDelegate
    };
}
export class CompressibleAsyncDataTree extends AsyncDataTree {
    constructor(user, container, virtualDelegate, compressionDelegate, renderers, dataSource, options = {}) {
        super(user, container, virtualDelegate, renderers, dataSource, options);
        this.compressionDelegate = compressionDelegate;
        this.compressibleNodeMapper = new WeakMapper(node => new CompressibleAsyncDataTreeNodeWrapper(node));
        this.filter = options.filter;
    }
    getCompressedTreeNode(e) {
        const node = this.getDataNode(e);
        return this.tree.getCompressedTreeNode(node).element;
    }
    createTree(user, container, delegate, renderers, options) {
        const objectTreeDelegate = new ComposedTreeDelegate(delegate);
        const objectTreeRenderers = renderers.map(r => new CompressibleAsyncDataTreeRenderer(r, this.nodeMapper, () => this.compressibleNodeMapper, this._onDidChangeNodeSlowState.event));
        const objectTreeOptions = asCompressibleObjectTreeOptions(options) || {};
        return new CompressibleObjectTree(user, container, objectTreeDelegate, objectTreeRenderers, objectTreeOptions);
    }
    asTreeElement(node, viewStateContext) {
        return {
            incompressible: this.compressionDelegate.isIncompressible(node.element),
            ...super.asTreeElement(node, viewStateContext)
        };
    }
    getViewState() {
        if (!this.identityProvider) {
            throw new TreeError(this.user, 'Can\'t get tree view state without an identity provider');
        }
        const getId = (element) => this.identityProvider.getId(element).toString();
        const focus = this.getFocus().map(getId);
        const selection = this.getSelection().map(getId);
        const expanded = [];
        const root = this.tree.getCompressedTreeNode();
        const stack = [root];
        while (stack.length > 0) {
            const node = stack.pop();
            if (node !== root && node.collapsible && !node.collapsed) {
                for (const asyncNode of node.element.elements) {
                    expanded.push(getId(asyncNode.element));
                }
            }
            stack.push(...node.children);
        }
        return { focus, selection, expanded, scrollTop: this.scrollTop };
    }
    render(node, viewStateContext, options) {
        if (!this.identityProvider) {
            return super.render(node, viewStateContext);
        }
        // Preserve traits across compressions. Hacky but does the trick.
        // This is hard to fix properly since it requires rewriting the traits
        // across trees and lists. Let's just keep it this way for now.
        const getId = (element) => this.identityProvider.getId(element).toString();
        const getUncompressedIds = (nodes) => {
            const result = new Set();
            for (const node of nodes) {
                const compressedNode = this.tree.getCompressedTreeNode(node === this.root ? null : node);
                if (!compressedNode.element) {
                    continue;
                }
                for (const node of compressedNode.element.elements) {
                    result.add(getId(node.element));
                }
            }
            return result;
        };
        const oldSelection = getUncompressedIds(this.tree.getSelection());
        const oldFocus = getUncompressedIds(this.tree.getFocus());
        super.render(node, viewStateContext, options);
        const selection = this.getSelection();
        let didChangeSelection = false;
        const focus = this.getFocus();
        let didChangeFocus = false;
        const visit = (node) => {
            const compressedNode = node.element;
            if (compressedNode) {
                for (let i = 0; i < compressedNode.elements.length; i++) {
                    const id = getId(compressedNode.elements[i].element);
                    const element = compressedNode.elements[compressedNode.elements.length - 1].element;
                    // github.com/microsoft/vscode/issues/85938
                    if (oldSelection.has(id) && selection.indexOf(element) === -1) {
                        selection.push(element);
                        didChangeSelection = true;
                    }
                    if (oldFocus.has(id) && focus.indexOf(element) === -1) {
                        focus.push(element);
                        didChangeFocus = true;
                    }
                }
            }
            node.children.forEach(visit);
        };
        visit(this.tree.getCompressedTreeNode(node === this.root ? null : node));
        if (didChangeSelection) {
            this.setSelection(selection);
        }
        if (didChangeFocus) {
            this.setFocus(focus);
        }
    }
    // For compressed async data trees, `TreeVisibility.Recurse` doesn't currently work
    // and we have to filter everything beforehand
    // Related to #85193 and #85835
    processChildren(children) {
        if (this.filter) {
            children = Iterable.filter(children, e => {
                const result = this.filter.filter(e, 1 /* TreeVisibility.Visible */);
                const visibility = getVisibility(result);
                if (visibility === 2 /* TreeVisibility.Recurse */) {
                    throw new Error('Recursive tree visibility not supported in async data compressed trees');
                }
                return visibility === 1 /* TreeVisibility.Visible */;
            });
        }
        return super.processChildren(children);
    }
    navigate(start) {
        // Assumptions are made about how tree navigation works in compressed trees
        // These assumptions may be wrong and we should revisit this when needed
        // Example:	[a, b/ba, ba.txt]
        // - previous(ba) => a
        // - previous(b) => a
        // - next(a) => ba
        // - next(b) => ba
        // - next(ba) => ba.txt
        return super.navigate(start);
    }
}
function getVisibility(filterResult) {
    if (typeof filterResult === 'boolean') {
        return filterResult ? 1 /* TreeVisibility.Visible */ : 0 /* TreeVisibility.Hidden */;
    }
    else if (isFilterResult(filterResult)) {
        return getVisibleState(filterResult.visibility);
    }
    else {
        return getVisibleState(filterResult);
    }
}
class AsyncDataTreeNavigator {
    constructor(navigator) {
        this.navigator = navigator;
    }
    current() {
        const current = this.navigator.current();
        if (current === null) {
            return null;
        }
        return current.element;
    }
    previous() {
        this.navigator.previous();
        return this.current();
    }
    first() {
        this.navigator.first();
        return this.current();
    }
    last() {
        this.navigator.last();
        return this.current();
    }
    next() {
        this.navigator.next();
        return this.current();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN5bmNEYXRhVHJlZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9hc3luY0RhdGFUcmVlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBSWhHLE9BQU8sRUFBRSx1QkFBdUIsRUFBd0IsTUFBTSxxQkFBcUIsQ0FBQztBQUVwRixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsWUFBWSxJQUFJLFlBQVksRUFBMEcsVUFBVSxFQUFFLGNBQWMsRUFBMkYsTUFBTSxtQkFBbUIsQ0FBQztBQUVwVCxPQUFPLEVBQUUsZUFBZSxFQUFFLGNBQWMsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQ3RFLE9BQU8sRUFBRSxzQkFBc0IsRUFBOEosVUFBVSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDak8sT0FBTyxFQUF3Tyw4QkFBOEIsRUFBRSxTQUFTLEVBQW9DLFVBQVUsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUMxVixPQUFPLEVBQXFCLHVCQUF1QixFQUFFLFFBQVEsRUFBRSxnQkFBZ0IsRUFBRSxPQUFPLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzSCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDdEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ25GLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDMUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFlLFlBQVksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRW5HLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwwQkFB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