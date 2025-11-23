/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../nls.js';
import { basename } from '../../../base/common/resources.js';
import { URI } from '../../../base/common/uri.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, DisposableStore, dispose } from '../../../base/common/lifecycle.js';
import { NoTreeViewError } from '../../common/views.js';
import { asPromise } from '../../../base/common/async.js';
import * as extHostTypes from './extHostTypes.js';
import { isUndefinedOrNull, isString } from '../../../base/common/types.js';
import { equals, coalesce, distinct } from '../../../base/common/arrays.js';
import { LogLevel } from '../../../platform/log/common/log.js';
import { MarkdownString, ViewBadge, DataTransfer } from './extHostTypeConverters.js';
import { isMarkdownString } from '../../../base/common/htmlContent.js';
import { CancellationTokenSource } from '../../../base/common/cancellation.js';
import { TreeViewsDnDService } from '../../../editor/common/services/treeViewsDnd.js';
import { checkProposedApiEnabled } from '../../services/extensions/common/extensions.js';
function toTreeItemLabel(label, extension) {
    if (isString(label)) {
        return { label };
    }
    if (label && typeof label === 'object' && label.label) {
        let highlights = undefined;
        if (Array.isArray(label.highlights)) {
            highlights = label.highlights.filter((highlight => highlight.length === 2 && typeof highlight[0] === 'number' && typeof highlight[1] === 'number'));
            highlights = highlights.length ? highlights : undefined;
        }
        if (isString(label.label)) {
            return { label: label.label, highlights };
        }
        else if (extHostTypes.MarkdownString.isMarkdownString(label.label)) {
            checkProposedApiEnabled(extension, 'treeItemMarkdownLabel');
            return { label: MarkdownString.from(label.label), highlights };
        }
    }
    return undefined;
}
export class ExtHostTreeViews extends Disposable {
    constructor(_proxy, _commands, _logService) {
        super();
        this._proxy = _proxy;
        this._commands = _commands;
        this._logService = _logService;
        this._treeViews = new Map();
        this._treeDragAndDropService = new TreeViewsDnDService();
        function isTreeViewConvertableItem(arg) {
            return arg && arg.$treeViewId && (arg.$treeItemHandle || arg.$selectedTreeItems || arg.$focusedTreeItem);
        }
        _commands.registerArgumentProcessor({
            processArgument: arg => {
                if (isTreeViewConvertableItem(arg)) {
                    return this._convertArgument(arg);
                }
                else if (Array.isArray(arg) && (arg.length > 0)) {
                    return arg.map(item => {
                        if (isTreeViewConvertableItem(item)) {
                            return this._convertArgument(item);
                        }
                        return item;
                    });
                }
                return arg;
            }
        });
    }
    registerTreeDataProvider(id, treeDataProvider, extension) {
        const treeView = this.createTreeView(id, { treeDataProvider }, extension);
        return { dispose: () => treeView.dispose() };
    }
    createTreeView(viewId, options, extension) {
        if (!options || !options.treeDataProvider) {
            throw new Error('Options with treeDataProvider is mandatory');
        }
        const dropMimeTypes = options.dragAndDropController?.dropMimeTypes ?? [];
        const dragMimeTypes = options.dragAndDropController?.dragMimeTypes ?? [];
        const hasHandleDrag = !!options.dragAndDropController?.handleDrag;
        const hasHandleDrop = !!options.dragAndDropController?.handleDrop;
        const treeView = this._createExtHostTreeView(viewId, options, extension);
        const proxyOptions = { showCollapseAll: !!options.showCollapseAll, canSelectMany: !!options.canSelectMany, dropMimeTypes, dragMimeTypes, hasHandleDrag, hasHandleDrop, manuallyManageCheckboxes: !!options.manageCheckboxStateManually };
        const registerPromise = this._proxy.$registerTreeViewDataProvider(viewId, proxyOptions);
        const view = {
            get onDidCollapseElement() { return treeView.onDidCollapseElement; },
            get onDidExpandElement() { return treeView.onDidExpandElement; },
            get selection() { return treeView.selectedElements; },
            get onDidChangeSelection() { return treeView.onDidChangeSelection; },
            get activeItem() {
                checkProposedApiEnabled(extension, 'treeViewActiveItem');
                return treeView.focusedElement;
            },
            get onDidChangeActiveItem() {
                checkProposedApiEnabled(extension, 'treeViewActiveItem');
                return treeView.onDidChangeActiveItem;
            },
            get visible() { return treeView.visible; },
            get onDidChangeVisibility() { return treeView.onDidChangeVisibility; },
            get onDidChangeCheckboxState() {
                return treeView.onDidChangeCheckboxState;
            },
            get message() { return treeView.message; },
            set message(message) {
                if (isMarkdownString(message)) {
                    checkProposedApiEnabled(extension, 'treeViewMarkdownMessage');
                }
                treeView.message = message;
            },
            get title() { return treeView.title; },
            set title(title) {
                treeView.title = title;
            },
            get description() {
                return treeView.description;
            },
            set description(description) {
                treeView.description = description;
            },
            get badge() {
                return treeView.badge;
            },
            set badge(badge) {
                if ((badge !== undefined) && extHostTypes.ViewBadge.isViewBadge(badge)) {
                    treeView.badge = {
                        value: Math.floor(Math.abs(badge.value)),
                        tooltip: badge.tooltip
                    };
                }
                else if (badge === undefined) {
                    treeView.badge = undefined;
                }
            },
            reveal: (element, options) => {
                return treeView.reveal(element, options);
            },
            dispose: async () => {
                // Wait for the registration promise to finish before doing the dispose.
                await registerPromise;
                this._treeViews.delete(viewId);
                treeView.dispose();
            }
        };
        this._register(view);
        return view;
    }
    async $getChildren(treeViewId, treeItemHandles) {
        const treeView = this._treeViews.get(treeViewId);
        if (!treeView) {
            return Promise.reject(new NoTreeViewError(treeViewId));
        }
        if (!treeItemHandles) {
            const children = await treeView.getChildren();
            return children ? [[0, ...children]] : undefined;
        }
        // Keep order of treeItemHandles in case extension trees already depend on this
        const result = [];
        for (let i = 0; i < treeItemHandles.length; i++) {
            const treeItemHandle = treeItemHandles[i];
            const children = await treeView.getChildren(treeItemHandle);
            if (children) {
                result.push([i, ...children]);
            }
        }
        return result;
    }
    async $handleDrop(destinationViewId, requestId, treeDataTransferDTO, targetItemHandle, token, operationUuid, sourceViewId, sourceTreeItemHandles) {
        const treeView = this._treeViews.get(destinationViewId);
        if (!treeView) {
            return Promise.reject(new NoTreeViewError(destinationViewId));
        }
        const treeDataTransfer = DataTransfer.toDataTransfer(treeDataTransferDTO, async (dataItemIndex) => {
            return (await this._proxy.$resolveDropFileData(destinationViewId, requestId, dataItemIndex)).buffer;
        });
        if ((sourceViewId === destinationViewId) && sourceTreeItemHandles) {
            await this._addAdditionalTransferItems(treeDataTransfer, treeView, sourceTreeItemHandles, token, operationUuid);
        }
        return treeView.onDrop(treeDataTransfer, targetItemHandle, token);
    }
    async _addAdditionalTransferItems(treeDataTransfer, treeView, sourceTreeItemHandles, token, operationUuid) {
        const existingTransferOperation = this._treeDragAndDropService.removeDragOperationTransfer(operationUuid);
        if (existingTransferOperation) {
            (await existingTransferOperation)?.forEach((value, key) => {
                if (value) {
                    treeDataTransfer.set(key, value);
                }
            });
        }
        else if (operationUuid && treeView.handleDrag) {
            const willDropPromise = treeView.handleDrag(sourceTreeItemHandles, treeDataTransfer, token);
            this._treeDragAndDropService.addDragOperationTransfer(operationUuid, willDropPromise);
            await willDropPromise;
        }
        return treeDataTransfer;
    }
    async $handleDrag(sourceViewId, sourceTreeItemHandles, operationUuid, token) {
        const treeView = this._treeViews.get(sourceViewId);
        if (!treeView) {
            return Promise.reject(new NoTreeViewError(sourceViewId));
        }
        const treeDataTransfer = await this._addAdditionalTransferItems(new extHostTypes.DataTransfer(), treeView, sourceTreeItemHandles, token, operationUuid);
        if (!treeDataTransfer || token.isCancellationRequested) {
            return;
        }
        return DataTransfer.from(treeDataTransfer);
    }
    async $hasResolve(treeViewId) {
        const treeView = this._treeViews.get(treeViewId);
        if (!treeView) {
            throw new NoTreeViewError(treeViewId);
        }
        return treeView.hasResolve;
    }
    $resolve(treeViewId, treeItemHandle, token) {
        const treeView = this._treeViews.get(treeViewId);
        if (!treeView) {
            throw new NoTreeViewError(treeViewId);
        }
        return treeView.resolveTreeItem(treeItemHandle, token);
    }
    $setExpanded(treeViewId, treeItemHandle, expanded) {
        const treeView = this._treeViews.get(treeViewId);
        if (!treeView) {
            throw new NoTreeViewError(treeViewId);
        }
        treeView.setExpanded(treeItemHandle, expanded);
    }
    $setSelectionAndFocus(treeViewId, selectedHandles, focusedHandle) {
        const treeView = this._treeViews.get(treeViewId);
        if (!treeView) {
            throw new NoTreeViewError(treeViewId);
        }
        treeView.setSelectionAndFocus(selectedHandles, focusedHandle);
    }
    $setVisible(treeViewId, isVisible) {
        const treeView = this._treeViews.get(treeViewId);
        if (!treeView) {
            if (!isVisible) {
                return;
            }
            throw new NoTreeViewError(treeViewId);
        }
        treeView.setVisible(isVisible);
    }
    $changeCheckboxState(treeViewId, checkboxUpdate) {
        const treeView = this._treeViews.get(treeViewId);
        if (!treeView) {
            throw new NoTreeViewError(treeViewId);
        }
        treeView.setCheckboxState(checkboxUpdate);
    }
    _createExtHostTreeView(id, options, extension) {
        const treeView = this._register(new ExtHostTreeView(id, options, this._proxy, this._commands.converter, this._logService, extension));
        this._treeViews.set(id, treeView);
        return treeView;
    }
    _convertArgument(arg) {
        const treeView = this._treeViews.get(arg.$treeViewId);
        const asItemHandle = arg;
        if (treeView && asItemHandle.$treeItemHandle) {
            return treeView.getExtensionElement(asItemHandle.$treeItemHandle);
        }
        const asPaneHandle = arg;
        if (treeView && asPaneHandle.$focusedTreeItem) {
            return treeView.focusedElement;
        }
        return null;
    }
}
class ExtHostTreeView extends Disposable {
    static { this.LABEL_HANDLE_PREFIX = '0'; }
    static { this.ID_HANDLE_PREFIX = '1'; }
    get visible() { return this._visible; }
    get selectedElements() { return this._selectedHandles.map(handle => this.getExtensionElement(handle)).filter(element => !isUndefinedOrNull(element)); }
    get focusedElement() { return (this._focusedHandle ? this.getExtensionElement(this._focusedHandle) : undefined); }
    constructor(_viewId, options, _proxy, _commands, _logService, _extension) {
        super();
        this._viewId = _viewId;
        this._proxy = _proxy;
        this._commands = _commands;
        this._logService = _logService;
        this._extension = _extension;
        this._roots = undefined;
        this._elements = new Map();
        this._nodes = new Map();
        this._visible = false;
        this._selectedHandles = [];
        this._focusedHandle = undefined;
        this._onDidExpandElement = this._register(new Emitter());
        this.onDidExpandElement = this._onDidExpandElement.event;
        this._onDidCollapseElement = this._register(new Emitter());
        this.onDidCollapseElement = this._onDidCollapseElement.event;
        this._onDidChangeSelection = this._register(new Emitter());
        this.onDidChangeSelection = this._onDidChangeSelection.event;
        this._onDidChangeActiveItem = this._register(new Emitter());
        this.onDidChangeActiveItem = this._onDidChangeActiveItem.event;
        this._onDidChangeVisibility = this._register(new Emitter());
        this.onDidChangeVisibility = this._onDidChangeVisibility.event;
        this._onDidChangeCheckboxState = this._register(new Emitter());
        this.onDidChangeCheckboxState = this._onDidChangeCheckboxState.event;
        this._onDidChangeData = this._register(new Emitter());
        this._refreshPromise = Promise.resolve();
        this._refreshQueue = Promise.resolve();
        this._nodesToClear = new Set();
        this._message = '';
        this._title = '';
        this._refreshCancellationSource = new CancellationTokenSource();
        if (_extension.contributes && _extension.contributes.views) {
            for (const location in _extension.contributes.views) {
                for (const view of _extension.contributes.views[location]) {
                    if (view.id === _viewId) {
                        this._title = view.name;
                    }
                }
            }
        }
        this._dataProvider = options.treeDataProvider;
        this._dndController = options.dragAndDropController;
        if (this._dataProvider.onDidChangeTreeData) {
            this._register(this._dataProvider.onDidChangeTreeData(elementOrElements => {
                if (Array.isArray(elementOrElements) && elementOrElements.length === 0) {
                    return;
                }
                this._onDidChangeData.fire({ message: false, element: elementOrElements });
            }));
        }
        let refreshingPromise;
        let promiseCallback;
        const onDidChangeData = Event.debounce(this._onDidChangeData.event, (result, current) => {
            if (!result) {
                result = { message: false, elements: [] };
            }
            if (current.element !== false) {
                if (!refreshingPromise) {
                    // New refresh has started
                    refreshingPromise = new Promise(c => promiseCallback = c);
                    this._refreshPromise = this._refreshPromise.then(() => refreshingPromise);
                }
                if (Array.isArray(current.element)) {
                    result.elements.push(...current.element);
                }
                else {
                    result.elements.push(current.element);
                }
            }
            if (current.message) {
                result.message = true;
            }
            return result;
        }, 200, true);
        this._register(onDidChangeData(({ message, elements }) => {
            if (elements.length) {
                elements = distinct(elements);
                this._refreshQueue = this._refreshQueue.then(() => {
                    const _promiseCallback = promiseCallback;
                    refreshingPromise = null;
                    const childrenToClear = Array.from(this._nodesToClear);
                    this._nodesToClear.clear();
                    this._debugLogRefresh('start', elements, childrenToClear);
                    return this._refresh(elements).then(() => {
                        this._debugLogRefresh('done', elements, childrenToClear);
                        this._clearNodes(childrenToClear);
                        return _promiseCallback();
                    }).catch(e => {
                        const message = e instanceof Error ? e.message : JSON.stringify(e);
                        this._debugLogRefresh('error', elements, childrenToClear);
                        this._clearNodes(childrenToClear);
                        this._logService.error(`Unable to refresh tree view ${this._viewId}: ${message}`);
                        return _promiseCallback();
                    });
                });
            }
            if (message) {
                this._proxy.$setMessage(this._viewId, MarkdownString.fromStrict(this._message) ?? '');
            }
        }));
    }
    _debugCollectHandles(elements) {
        const changed = [];
        for (const el of elements) {
            if (!el) {
                changed.push('<root>');
                continue;
            }
            const node = this._nodes.get(el);
            if (node) {
                changed.push(node.item.handle);
            }
        }
        const roots = this._roots?.map(r => r.item.handle) ?? [];
        return { changed, roots };
    }
    _debugLogRefresh(phase, elements, childrenToClear) {
        if (!this._isDebugLogging()) {
            return;
        }
        try {
            const snapshot = this._debugCollectHandles(elements);
            snapshot.clearing = childrenToClear.map(n => n.item.handle);
            const changedCount = snapshot.changed.length;
            const nodesToClearLen = childrenToClear.length;
            this._logService.debug(`[TreeView:${this._viewId}] refresh ${phase} changed=${changedCount} nodesToClear=${nodesToClearLen} elements.size=${this._elements.size} nodes.size=${this._nodes.size} handles=${JSON.stringify(snapshot)}`);
        }
        catch {
            this._logService.debug(`[TreeView:${this._viewId}] refresh ${phase} (snapshot failed)`);
        }
    }
    _isDebugLogging() {
        try {
            const level = this._logService.getLevel();
            return (level === LogLevel.Debug) || (level === LogLevel.Trace);
        }
        catch {
            return false;
        }
    }
    async getChildren(parentHandle) {
        const parentElement = parentHandle ? this.getExtensionElement(parentHandle) : undefined;
        if (parentHandle && !parentElement) {
            this._logService.error(`No tree item with id \'${parentHandle}\' found.`);
            return Promise.resolve([]);
        }
        let childrenNodes = this._getChildrenNodes(parentHandle); // Get it from cache
        if (!childrenNodes) {
            childrenNodes = await this._fetchChildrenNodes(parentElement);
        }
        return childrenNodes ? childrenNodes.map(n => n.item) : undefined;
    }
    getExtensionElement(treeItemHandle) {
        return this._elements.get(treeItemHandle);
    }
    reveal(element, options) {
        options = options ? options : { select: true, focus: false };
        const select = isUndefinedOrNull(options.select) ? true : options.select;
        const focus = isUndefinedOrNull(options.focus) ? false : options.focus;
        const expand = isUndefinedOrNull(options.expand) ? false : options.expand;
        if (typeof this._dataProvider.getParent !== 'function') {
            return Promise.reject(new Error(`Required registered TreeDataProvider to implement 'getParent' method to access 'reveal' method`));
        }
        if (element) {
            return this._refreshPromise
                .then(() => this._resolveUnknownParentChain(element))
                .then(parentChain => this._resolveTreeNode(element, parentChain[parentChain.length - 1])
                .then(treeNode => this._proxy.$reveal(this._viewId, { item: treeNode.item, parentChain: parentChain.map(p => p.item) }, { select, focus, expand })), error => this._logService.error(error));
        }
        else {
            return this._proxy.$reveal(this._viewId, undefined, { select, focus, expand });
        }
    }
    get message() {
        return this._message;
    }
    set message(message) {
        this._message = message;
        this._onDidChangeData.fire({ message: true, element: false });
    }
    get title() {
        return this._title;
    }
    set title(title) {
        this._title = title;
        this._proxy.$setTitle(this._viewId, title, this._description);
    }
    get description() {
        return this._description;
    }
    set description(description) {
        this._description = description;
        this._proxy.$setTitle(this._viewId, this._title, description);
    }
    get badge() {
        return this._badge;
    }
    set badge(badge) {
        if (this._badge?.value === badge?.value &&
            this._badge?.tooltip === badge?.tooltip) {
            return;
        }
        this._badge = ViewBadge.from(badge);
        this._proxy.$setBadge(this._viewId, badge);
    }
    setExpanded(treeItemHandle, expanded) {
        const element = this.getExtensionElement(treeItemHandle);
        if (element) {
            if (expanded) {
                this._onDidExpandElement.fire(Object.freeze({ element }));
            }
            else {
                this._onDidCollapseElement.fire(Object.freeze({ element }));
            }
        }
    }
    setSelectionAndFocus(selectedHandles, focusedHandle) {
        const changedSelection = !equals(this._selectedHandles, selectedHandles);
        this._selectedHandles = selectedHandles;
        const changedFocus = this._focusedHandle !== focusedHandle;
        this._focusedHandle = focusedHandle;
        if (changedSelection) {
            this._onDidChangeSelection.fire(Object.freeze({ selection: this.selectedElements }));
        }
        if (changedFocus) {
            this._onDidChangeActiveItem.fire(Object.freeze({ activeItem: this.focusedElement }));
        }
    }
    setVisible(visible) {
        if (visible !== this._visible) {
            this._visible = visible;
            this._onDidChangeVisibility.fire(Object.freeze({ visible: this._visible }));
        }
    }
    async setCheckboxState(checkboxUpdates) {
        const items = (await Promise.all(checkboxUpdates.map(async (checkboxUpdate) => {
            const extensionItem = this.getExtensionElement(checkboxUpdate.treeItemHandle);
            if (extensionItem) {
                return {
                    extensionItem: extensionItem,
                    treeItem: await this._dataProvider.getTreeItem(extensionItem),
                    newState: checkboxUpdate.newState ? extHostTypes.TreeItemCheckboxState.Checked : extHostTypes.TreeItemCheckboxState.Unchecked
                };
            }
            return Promise.resolve(undefined);
        }))).filter((item) => item !== undefined);
        items.forEach(item => {
            item.treeItem.checkboxState = item.newState ? extHostTypes.TreeItemCheckboxState.Checked : extHostTypes.TreeItemCheckboxState.Unchecked;
        });
        this._onDidChangeCheckboxState.fire({ items: items.map(item => [item.extensionItem, item.newState]) });
    }
    async handleDrag(sourceTreeItemHandles, treeDataTransfer, token) {
        const extensionTreeItems = [];
        for (const sourceHandle of sourceTreeItemHandles) {
            const extensionItem = this.getExtensionElement(sourceHandle);
            if (extensionItem) {
                extensionTreeItems.push(extensionItem);
            }
        }
        if (!this._dndController?.handleDrag || (extensionTreeItems.length === 0)) {
            return;
        }
        await this._dndController.handleDrag(extensionTreeItems, treeDataTransfer, token);
        return treeDataTransfer;
    }
    get hasHandleDrag() {
        return !!this._dndController?.handleDrag;
    }
    async onDrop(treeDataTransfer, targetHandleOrNode, token) {
        const target = targetHandleOrNode ? this.getExtensionElement(targetHandleOrNode) : undefined;
        if ((!target && targetHandleOrNode) || !this._dndController?.handleDrop) {
            return;
        }
        return asPromise(() => this._dndController?.handleDrop
            ? this._dndController.handleDrop(target, treeDataTransfer, token)
            : undefined);
    }
    get hasResolve() {
        return !!this._dataProvider.resolveTreeItem;
    }
    async resolveTreeItem(treeItemHandle, token) {
        if (!this._dataProvider.resolveTreeItem) {
            return;
        }
        const element = this._elements.get(treeItemHandle);
        if (element) {
            const node = this._nodes.get(element);
            if (node) {
                const resolve = await this._dataProvider.resolveTreeItem(node.extensionItem, element, token) ?? node.extensionItem;
                this._validateTreeItem(resolve);
                // Resolvable elements. Currently only tooltip and command.
                node.item.tooltip = this._getTooltip(resolve.tooltip);
                node.item.command = this._getCommand(node.disposableStore, resolve.command);
                return node.item;
            }
        }
        return;
    }
    _resolveUnknownParentChain(element) {
        return this._resolveParent(element)
            .then((parent) => {
            if (!parent) {
                return Promise.resolve([]);
            }
            return this._resolveUnknownParentChain(parent)
                .then(result => this._resolveTreeNode(parent, result[result.length - 1])
                .then(parentNode => {
                result.push(parentNode);
                return result;
            }));
        });
    }
    _resolveParent(element) {
        const node = this._nodes.get(element);
        if (node) {
            return Promise.resolve(node.parent ? this._elements.get(node.parent.item.handle) : undefined);
        }
        return asPromise(() => this._dataProvider.getParent(element));
    }
    _resolveTreeNode(element, parent) {
        const node = this._nodes.get(element);
        if (node) {
            return Promise.resolve(node);
        }
        return asPromise(() => this._dataProvider.getTreeItem(element))
            .then(extTreeItem => this._createHandle(element, extTreeItem, parent, true))
            .then(handle => this.getChildren(parent ? parent.item.handle : undefined)
            .then(() => {
            const cachedElement = this.getExtensionElement(handle);
            if (cachedElement) {
                const node = this._nodes.get(cachedElement);
                if (node) {
                    return Promise.resolve(node);
                }
            }
            throw new Error(`Cannot resolve tree item for element ${handle} from extension ${this._extension.identifier.value}`);
        }));
    }
    _getChildrenNodes(parentNodeOrHandle) {
        if (parentNodeOrHandle) {
            let parentNode;
            if (typeof parentNodeOrHandle === 'string') {
                const parentElement = this.getExtensionElement(parentNodeOrHandle);
                parentNode = parentElement ? this._nodes.get(parentElement) : undefined;
            }
            else {
                parentNode = parentNodeOrHandle;
            }
            return parentNode ? parentNode.children || undefined : undefined;
        }
        return this._roots;
    }
    async _fetchChildrenNodes(parentElement) {
        // clear children cache
        this._addChildrenToClear(parentElement);
        const cts = new CancellationTokenSource(this._refreshCancellationSource.token);
        try {
            const elements = await this._dataProvider.getChildren(parentElement);
            const parentNode = parentElement ? this._nodes.get(parentElement) : undefined;
            if (cts.token.isCancellationRequested) {
                return undefined;
            }
            const coalescedElements = coalesce(elements || []);
            const treeItems = await Promise.all(coalesce(coalescedElements).map(element => {
                return this._dataProvider.getTreeItem(element);
            }));
            if (cts.token.isCancellationRequested) {
                return undefined;
            }
            // createAndRegisterTreeNodes adds the nodes to a cache. This must be done sync so that they get added in the correct order.
            const items = treeItems.map((item, index) => item ? this._createAndRegisterTreeNode(coalescedElements[index], item, parentNode) : null);
            return coalesce(items);
        }
        finally {
            cts.dispose();
        }
    }
    _refresh(elements) {
        const hasRoot = elements.some(element => !element);
        if (hasRoot) {
            // Cancel any pending children fetches
            this._refreshCancellationSource.dispose(true);
            this._refreshCancellationSource = new CancellationTokenSource();
            this._addChildrenToClear();
            return this._proxy.$refresh(this._viewId);
        }
        else {
            const handlesToRefresh = this._getHandlesToRefresh(elements);
            if (handlesToRefresh.length) {
                return this._refreshHandles(handlesToRefresh);
            }
        }
        return Promise.resolve(undefined);
    }
    _getHandlesToRefresh(elements) {
        const elementsToUpdate = new Set();
        const elementNodes = elements.map(element => this._nodes.get(element));
        for (const elementNode of elementNodes) {
            if (elementNode && !elementsToUpdate.has(elementNode.item.handle)) {
                // check if an ancestor of extElement is already in the elements list
                let currentNode = elementNode;
                while (currentNode && currentNode.parent && elementNodes.findIndex(node => currentNode && currentNode.parent && node && node.item.handle === currentNode.parent.item.handle) === -1) {
                    const parentElement = this._elements.get(currentNode.parent.item.handle);
                    currentNode = parentElement ? this._nodes.get(parentElement) : undefined;
                }
                if (currentNode && !currentNode.parent) {
                    elementsToUpdate.add(elementNode.item.handle);
                }
            }
        }
        const handlesToUpdate = [];
        // Take only top level elements
        elementsToUpdate.forEach((handle) => {
            const element = this._elements.get(handle);
            if (element) {
                const node = this._nodes.get(element);
                if (node && (!node.parent || !elementsToUpdate.has(node.parent.item.handle))) {
                    handlesToUpdate.push(handle);
                }
            }
        });
        return handlesToUpdate;
    }
    _refreshHandles(itemHandles) {
        const itemsToRefresh = {};
        return Promise.all(itemHandles.map(treeItemHandle => this._refreshNode(treeItemHandle)
            .then(node => {
            if (node) {
                itemsToRefresh[treeItemHandle] = node.item;
            }
        })))
            .then(() => Object.keys(itemsToRefresh).length ? this._proxy.$refresh(this._viewId, itemsToRefresh) : undefined);
    }
    _refreshNode(treeItemHandle) {
        const extElement = this.getExtensionElement(treeItemHandle);
        if (extElement) {
            const existing = this._nodes.get(extElement);
            if (existing) {
                this._addChildrenToClear(extElement); // clear children cache
                return asPromise(() => this._dataProvider.getTreeItem(extElement))
                    .then(extTreeItem => {
                    if (extTreeItem) {
                        const newNode = this._createTreeNode(extElement, extTreeItem, existing.parent);
                        this._updateNodeCache(extElement, newNode, existing, existing.parent);
                        existing.dispose();
                        return newNode;
                    }
                    return null;
                });
            }
        }
        return Promise.resolve(null);
    }
    _createAndRegisterTreeNode(element, extTreeItem, parentNode) {
        const node = this._createTreeNode(element, extTreeItem, parentNode);
        if (extTreeItem.id && this._elements.has(node.item.handle)) {
            throw new Error(localize('treeView.duplicateElement', 'Element with id {0} is already registered', extTreeItem.id));
        }
        this._addNodeToCache(element, node);
        this._addNodeToParentCache(node, parentNode);
        return node;
    }
    _getTooltip(tooltip) {
        if (extHostTypes.MarkdownString.isMarkdownString(tooltip)) {
            return MarkdownString.from(tooltip);
        }
        return tooltip;
    }
    _getCommand(disposable, command) {
        return command ? { ...this._commands.toInternal(command, disposable), originalId: command.command } : undefined;
    }
    _getCheckbox(extensionTreeItem) {
        if (extensionTreeItem.checkboxState === undefined) {
            return undefined;
        }
        let checkboxState;
        let tooltip = undefined;
        let accessibilityInformation = undefined;
        if (typeof extensionTreeItem.checkboxState === 'number') {
            checkboxState = extensionTreeItem.checkboxState;
        }
        else {
            checkboxState = extensionTreeItem.checkboxState.state;
            tooltip = extensionTreeItem.checkboxState.tooltip;
            accessibilityInformation = extensionTreeItem.checkboxState.accessibilityInformation;
        }
        return { isChecked: checkboxState === extHostTypes.TreeItemCheckboxState.Checked, tooltip, accessibilityInformation };
    }
    _validateTreeItem(extensionTreeItem) {
        if (!extHostTypes.TreeItem.isTreeItem(extensionTreeItem, this._extension)) {
            throw new Error(`Extension ${this._extension.identifier.value} has provided an invalid tree item.`);
        }
    }
    _createTreeNode(element, extensionTreeItem, parent) {
        this._validateTreeItem(extensionTreeItem);
        const disposableStore = this._register(new DisposableStore());
        const handle = this._createHandle(element, extensionTreeItem, parent);
        const icon = this._getLightIconPath(extensionTreeItem);
        const item = {
            handle,
            parentHandle: parent ? parent.item.handle : undefined,
            label: toTreeItemLabel(extensionTreeItem.label, this._extension),
            description: extensionTreeItem.description,
            resourceUri: extensionTreeItem.resourceUri,
            tooltip: this._getTooltip(extensionTreeItem.tooltip),
            command: this._getCommand(disposableStore, extensionTreeItem.command),
            contextValue: extensionTreeItem.contextValue,
            icon,
            iconDark: this._getDarkIconPath(extensionTreeItem) || icon,
            themeIcon: this._getThemeIcon(extensionTreeItem),
            collapsibleState: isUndefinedOrNull(extensionTreeItem.collapsibleState) ? extHostTypes.TreeItemCollapsibleState.None : extensionTreeItem.collapsibleState,
            accessibilityInformation: extensionTreeItem.accessibilityInformation,
            checkbox: this._getCheckbox(extensionTreeItem),
        };
        return {
            item,
            extensionItem: extensionTreeItem,
            parent,
            children: undefined,
            disposableStore,
            dispose() { disposableStore.dispose(); }
        };
    }
    _getThemeIcon(extensionTreeItem) {
        return extensionTreeItem.iconPath instanceof extHostTypes.ThemeIcon ? extensionTreeItem.iconPath : undefined;
    }
    _createHandle(element, { id, label, resourceUri }, parent, returnFirst) {
        if (id) {
            return `${ExtHostTreeView.ID_HANDLE_PREFIX}/${id}`;
        }
        const treeItemLabel = toTreeItemLabel(label, this._extension);
        const prefix = parent ? parent.item.handle : ExtHostTreeView.LABEL_HANDLE_PREFIX;
        let labelValue = '';
        if (treeItemLabel) {
            if (isMarkdownString(treeItemLabel.label)) {
                labelValue = treeItemLabel.label.value;
            }
            else {
                labelValue = treeItemLabel.label;
            }
        }
        let elementId = labelValue || (resourceUri ? basename(resourceUri) : '');
        elementId = elementId.indexOf('/') !== -1 ? elementId.replace('/', '//') : elementId;
        const existingHandle = this._nodes.has(element) ? this._nodes.get(element).item.handle : undefined;
        const childrenNodes = (this._getChildrenNodes(parent) || []);
        let handle;
        let counter = 0;
        do {
            handle = `${prefix}/${counter}:${elementId}`;
            if (returnFirst || !this._elements.has(handle) || existingHandle === handle) {
                // Return first if asked for or
                // Return if handle does not exist or
                // Return if handle is being reused
                break;
            }
            counter++;
        } while (counter <= childrenNodes.length);
        return handle;
    }
    _getLightIconPath(extensionTreeItem) {
        if (extensionTreeItem.iconPath && !(extensionTreeItem.iconPath instanceof extHostTypes.ThemeIcon)) {
            if (typeof extensionTreeItem.iconPath === 'string'
                || URI.isUri(extensionTreeItem.iconPath)) {
                return this._getIconPath(extensionTreeItem.iconPath);
            }
            return this._getIconPath(extensionTreeItem.iconPath.light);
        }
        return undefined;
    }
    _getDarkIconPath(extensionTreeItem) {
        if (extensionTreeItem.iconPath && !(extensionTreeItem.iconPath instanceof extHostTypes.ThemeIcon) && extensionTreeItem.iconPath.dark) {
            return this._getIconPath(extensionTreeItem.iconPath.dark);
        }
        return undefined;
    }
    _getIconPath(iconPath) {
        if (URI.isUri(iconPath)) {
            return iconPath;
        }
        return URI.file(iconPath);
    }
    _addNodeToCache(element, node) {
        this._elements.set(node.item.handle, element);
        this._nodes.set(element, node);
    }
    _updateNodeCache(element, newNode, existing, parentNode) {
        // Remove from the cache
        this._elements.delete(newNode.item.handle);
        this._nodes.delete(element);
        if (newNode.item.handle !== existing.item.handle) {
            this._elements.delete(existing.item.handle);
        }
        // Add the new node to the cache
        this._addNodeToCache(element, newNode);
        // Replace the node in parent's children nodes
        const childrenNodes = (this._getChildrenNodes(parentNode) || []);
        const childNode = childrenNodes.filter(c => c.item.handle === existing.item.handle)[0];
        if (childNode) {
            childrenNodes.splice(childrenNodes.indexOf(childNode), 1, newNode);
        }
    }
    _addNodeToParentCache(node, parentNode) {
        if (parentNode) {
            if (!parentNode.children) {
                parentNode.children = [];
            }
            parentNode.children.push(node);
        }
        else {
            if (!this._roots) {
                this._roots = [];
            }
            this._roots.push(node);
        }
    }
    _addChildrenToClear(parentElement) {
        if (parentElement) {
            const node = this._nodes.get(parentElement);
            if (node) {
                if (node.children) {
                    for (const child of node.children) {
                        this._nodesToClear.add(child);
                        const childElement = this._elements.get(child.item.handle);
                        if (childElement) {
                            this._addChildrenToClear(childElement);
                            this._nodes.delete(childElement);
                            this._elements.delete(child.item.handle);
                        }
                    }
                }
                node.children = undefined;
            }
        }
        else {
            this._addAllToClear();
        }
    }
    _addAllToClear() {
        this._roots = undefined;
        this._nodes.forEach(node => {
            this._nodesToClear.add(node);
        });
        this._nodes.clear();
        this._elements.clear();
    }
    _clearNodes(nodes) {
        dispose(nodes);
    }
    _clearAll() {
        this._roots = undefined;
        this._elements.clear();
        dispose(this._nodes.values());
        this._nodes.clear();
        dispose(this._nodesToClear);
        this._nodesToClear.clear();
    }
    dispose() {
        super.dispose();
        this._refreshCancellationSource.dispose();
        this._clearAll();
        this._proxy.$disposeTree(this._viewId);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdFRyZWVWaWV3cy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0VHJlZVZpZXdzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUUzQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDN0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ2xELE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFlLE1BQU0sbUNBQW1DLENBQUM7QUFFdEcsT0FBTyxFQUFnSSxlQUFlLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUV0TCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDMUQsT0FBTyxLQUFLLFlBQVksTUFBTSxtQkFBbUIsQ0FBQztBQUNsRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsUUFBUSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDNUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDNUUsT0FBTyxFQUFlLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRTVFLE9BQU8sRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ3JGLE9BQU8sRUFBbUIsZ0JBQWdCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN4RixPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEcsT0FBTyxFQUF3QixtQkFBbUIsRUFBRSxN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