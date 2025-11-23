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
import { DataTransfers } from '../../dnd.js';
import { addDisposableListener, animate, getActiveElement, getContentHeight, getContentWidth, getDocument, getTopLeftOffset, getWindow, isAncestor, isHTMLElement, isSVGElement, scheduleAtNextAnimationFrame } from '../../dom.js';
import { DomEmitter } from '../../event.js';
import { EventType as TouchEventType, Gesture } from '../../touch.js';
import { SmoothScrollableElement } from '../scrollbar/scrollableElement.js';
import { distinct, equals, splice } from '../../../common/arrays.js';
import { Delayer, disposableTimeout } from '../../../common/async.js';
import { memoize } from '../../../common/decorators.js';
import { Emitter, Event } from '../../../common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../../common/lifecycle.js';
import { Range } from '../../../common/range.js';
import { Scrollable } from '../../../common/scrollable.js';
import { RangeMap, shift } from './rangeMap.js';
import { RowCache } from './rowCache.js';
import { BugIndicatingError } from '../../../common/errors.js';
import { clamp } from '../../../common/numbers.js';
import { applyDragImage } from '../dnd/dnd.js';
const StaticDND = {
    CurrentDragAndDropData: undefined
};
export var ListViewTargetSector;
(function (ListViewTargetSector) {
    // drop position relative to the top of the item
    ListViewTargetSector[ListViewTargetSector["TOP"] = 0] = "TOP";
    ListViewTargetSector[ListViewTargetSector["CENTER_TOP"] = 1] = "CENTER_TOP";
    ListViewTargetSector[ListViewTargetSector["CENTER_BOTTOM"] = 2] = "CENTER_BOTTOM";
    ListViewTargetSector[ListViewTargetSector["BOTTOM"] = 3] = "BOTTOM"; // [75%-100%)
})(ListViewTargetSector || (ListViewTargetSector = {}));
const DefaultOptions = {
    useShadows: true,
    verticalScrollMode: 1 /* ScrollbarVisibility.Auto */,
    setRowLineHeight: true,
    setRowHeight: true,
    supportDynamicHeights: false,
    dnd: {
        getDragElements(e) { return [e]; },
        getDragURI() { return null; },
        onDragStart() { },
        onDragOver() { return false; },
        drop() { },
        dispose() { }
    },
    horizontalScrolling: false,
    transformOptimization: true,
    alwaysConsumeMouseWheel: true,
};
export class ElementsDragAndDropData {
    get context() {
        return this._context;
    }
    set context(value) {
        this._context = value;
    }
    constructor(elements) {
        this.elements = elements;
    }
    update() { }
    getData() {
        return this.elements;
    }
}
export class ExternalElementsDragAndDropData {
    constructor(elements) {
        this.elements = elements;
    }
    update() { }
    getData() {
        return this.elements;
    }
}
export class NativeDragAndDropData {
    constructor() {
        this.types = [];
        this.files = [];
    }
    update(dataTransfer) {
        if (dataTransfer.types) {
            this.types.splice(0, this.types.length, ...dataTransfer.types);
        }
        if (dataTransfer.files) {
            this.files.splice(0, this.files.length);
            for (let i = 0; i < dataTransfer.files.length; i++) {
                const file = dataTransfer.files.item(i);
                if (file && (file.size || file.type)) {
                    this.files.push(file);
                }
            }
        }
    }
    getData() {
        return {
            types: this.types,
            files: this.files
        };
    }
}
function equalsDragFeedback(f1, f2) {
    if (Array.isArray(f1) && Array.isArray(f2)) {
        return equals(f1, f2);
    }
    return f1 === f2;
}
class ListViewAccessibilityProvider {
    constructor(accessibilityProvider) {
        if (accessibilityProvider?.getSetSize) {
            this.getSetSize = accessibilityProvider.getSetSize.bind(accessibilityProvider);
        }
        else {
            this.getSetSize = (e, i, l) => l;
        }
        if (accessibilityProvider?.getPosInSet) {
            this.getPosInSet = accessibilityProvider.getPosInSet.bind(accessibilityProvider);
        }
        else {
            this.getPosInSet = (e, i) => i + 1;
        }
        if (accessibilityProvider?.getRole) {
            this.getRole = accessibilityProvider.getRole.bind(accessibilityProvider);
        }
        else {
            this.getRole = _ => 'listitem';
        }
        if (accessibilityProvider?.isChecked) {
            this.isChecked = accessibilityProvider.isChecked.bind(accessibilityProvider);
        }
        else {
            this.isChecked = _ => undefined;
        }
    }
}
/**
 * The {@link ListView} is a virtual scrolling engine.
 *
 * Given that it only renders elements within its viewport, it can hold large
 * collections of elements and stay very performant. The performance bottleneck
 * usually lies within the user's rendering code for each element.
 *
 * @remarks It is a low-level widget, not meant to be used directly. Refer to the
 * List widget instead.
 */
export class ListView {
    static { this.InstanceCount = 0; }
    get contentHeight() { return this.rangeMap.size; }
    get contentWidth() { return this.scrollWidth ?? 0; }
    get onDidScroll() { return this.scrollableElement.onScroll; }
    get onWillScroll() { return this.scrollableElement.onWillScroll; }
    get containerDomNode() { return this.rowsContainer; }
    get scrollableElementDomNode() { return this.scrollableElement.getDomNode(); }
    get horizontalScrolling() { return this._horizontalScrolling; }
    set horizontalScrolling(value) {
        if (value === this._horizontalScrolling) {
            return;
        }
        if (value && this.supportDynamicHeights) {
            throw new Error('Horizontal scrolling and dynamic heights not supported simultaneously');
        }
        this._horizontalScrolling = value;
        this.domNode.classList.toggle('horizontal-scrolling', this._horizontalScrolling);
        if (this._horizontalScrolling) {
            for (const item of this.items) {
                this.measureItemWidth(item);
            }
            this.updateScrollWidth();
            this.scrollableElement.setScrollDimensions({ width: getContentWidth(this.domNode) });
            this.rowsContainer.style.width = `${Math.max(this.scrollWidth || 0, this.renderWidth)}px`;
        }
        else {
            this.scrollableElementWidthDelayer.cancel();
            this.scrollableElement.setScrollDimensions({ width: this.renderWidth, scrollWidth: this.renderWidth });
            this.rowsContainer.style.width = '';
        }
    }
    constructor(container, virtualDelegate, renderers, options = DefaultOptions) {
        this.virtualDelegate = virtualDelegate;
        this.domId = `list_id_${++ListView.InstanceCount}`;
        this.renderers = new Map();
        this.renderWidth = 0;
        this._scrollHeight = 0;
        this.scrollableElementUpdateDisposable = null;
        this.scrollableElementWidthDelayer = new Delayer(50);
        this.splicing = false;
        this.dragOverAnimationStopDisposable = Disposable.None;
        this.dragOverMouseY = 0;
        this.canDrop = false;
        this.currentDragFeedbackDisposable = Disposable.None;
        this.onDragLeaveTimeout = Disposable.None;
        this.currentSelectionDisposable = Disposable.None;
        this.disposables = new DisposableStore();
        this._onDidChangeContentHeight = new Emitter();
        this._onDidChangeContentWidth = new Emitter();
        this.onDidChangeContentHeight = Event.latch(this._onDidChangeContentHeight.event, undefined, this.disposables);
        this.onDidChangeContentWidth = Event.latch(this._onDidChangeContentWidth.event, undefined, this.disposables);
        this._horizontalScrolling = false;
        if (options.horizontalScrolling && options.supportDynamicHeights) {
            throw new Error('Horizontal scrolling and dynamic heights not supported simultaneously');
        }
        this.items = [];
        this.itemId = 0;
        this.rangeMap = this.createRangeMap(options.paddingTop ?? 0);
        for (const renderer of renderers) {
            this.renderers.set(renderer.templateId, renderer);
        }
        this.cache = this.disposables.add(new RowCache(this.renderers));
        this.lastRenderTop = 0;
        this.lastRenderHeight = 0;
        this.domNode = document.createElement('div');
        this.domNode.className = 'monaco-list';
        this.domNode.classList.add(this.domId);
        this.domNode.tabIndex = 0;
        this.domNode.classList.toggle('mouse-support', typeof options.mouseSupport === 'boolean' ? options.mouseSupport : true);
        this._horizontalScrolling = options.horizontalScrolling ?? DefaultOptions.horizontalScrolling;
        this.domNode.classList.toggle('horizontal-scrolling', this._horizontalScrolling);
        this.paddingBottom = typeof options.paddingBottom === 'undefined' ? 0 : options.paddingBottom;
        this.accessibilityProvider = new ListViewAccessibilityProvider(options.accessibilityProvider);
        this.rowsContainer = document.createElement('div');
        this.rowsContainer.className = 'monaco-list-rows';
        const transformOptimization = options.transformOptimization ?? DefaultOptions.transformOptimization;
        if (transformOptimization) {
            this.rowsContainer.style.transform = 'translate3d(0px, 0px, 0px)';
            this.rowsContainer.style.overflow = 'hidden';
            this.rowsContainer.style.contain = 'strict';
        }
        this.disposables.add(Gesture.addTarget(this.rowsContainer));
        this.scrollable = this.disposables.add(new Scrollable({
            forceIntegerValues: true,
            smoothScrollDuration: (options.smoothScrolling ?? false) ? 125 : 0,
            scheduleAtNextAnimationFrame: cb => scheduleAtNextAnimationFrame(getWindow(this.domNode), cb)
        }));
        this.scrollableElement = this.disposables.add(new SmoothScrollableElement(this.rowsContainer, {
            alwaysConsumeMouseWheel: options.alwaysConsumeMouseWheel ?? DefaultOptions.alwaysConsumeMouseWheel,
            horizontal: 1 /* ScrollbarVisibility.Auto */,
            vertical: options.verticalScrollMode ?? DefaultOptions.verticalScrollMode,
            useShadows: options.useShadows ?? DefaultOptions.useShadows,
            mouseWheelScrollSensitivity: options.mouseWheelScrollSensitivity,
            fastScrollSensitivity: options.fastScrollSensitivity,
            scrollByPage: options.scrollByPage
        }, this.scrollable));
        this.domNode.appendChild(this.scrollableElement.getDomNode());
        container.appendChild(this.domNode);
        this.scrollableElement.onScroll(this.onScroll, this, this.disposables);
        this.disposables.add(addDisposableListener(this.rowsContainer, TouchEventType.Change, e => this.onTouchChange(e)));
        this.disposables.add(addDisposableListener(this.scrollableElement.getDomNode(), 'scroll', e => {
            // Make sure the active element is scrolled into view
            const element = e.target;
            const scrollValue = element.scrollTop;
            element.scrollTop = 0;
            if (options.scrollToActiveElement) {
                this.setScrollTop(this.scrollTop + scrollValue);
            }
        }));
        this.disposables.add(addDisposableListener(this.domNode, 'dragover', e => this.onDragOver(this.toDragEvent(e))));
        this.disposables.add(addDisposableListener(this.domNode, 'drop', e => this.onDrop(this.toDragEvent(e))));
        this.disposables.add(addDisposableListener(this.domNode, 'dragleave', e => this.onDragLeave(this.toDragEvent(e))));
        this.disposables.add(addDisposableListener(this.domNode, 'dragend', e => this.onDragEnd(e)));
        if (options.userSelection) {
            if (options.dnd) {
                throw new Error('DND and user selection cannot be used simultaneously');
            }
            this.disposables.add(addDisposableListener(this.domNode, 'mousedown', e => this.onPotentialSelectionStart(e)));
        }
        this.setRowLineHeight = options.setRowLineHeight ?? DefaultOptions.setRowLineHeight;
        this.setRowHeight = options.setRowHeight ?? DefaultOptions.setRowHeight;
        this.supportDynamicHeights = options.supportDynamicHeights ?? DefaultOptions.supportDynamicHeights;
        this.dnd = options.dnd ?? this.disposables.add(DefaultOptions.dnd);
        this.layout(options.initialSize?.height, options.initialSize?.width);
        if (options.scrollToActiveElement) {
            this._setupFocusObserver(container);
        }
    }
    _setupFocusObserver(container) {
        this.disposables.add(addDisposableListener(container, 'focus', () => {
            const element = getActiveElement();
            if (this.activeElement !== element && element !== null) {
                this.activeElement = element;
                this._scrollToActiveElement(this.activeElement, container);
            }
        }, true));
    }
    _scrollToActiveElement(element, container) {
        // The scroll event on the list only fires when scrolling down.
        // If the active element is above the viewport, we need to scroll up.
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const topOffset = elementRect.top - containerRect.top;
        if (topOffset < 0) {
            // Scroll up
            this.setScrollTop(this.scrollTop + topOffset);
        }
    }
    updateOptions(options) {
        if (options.paddingBottom !== undefined) {
            this.paddingBottom = options.paddingBottom;
            this.scrollableElement.setScrollDimensions({ scrollHeight: this.scrollHeight });
        }
        if (options.smoothScrolling !== undefined) {
            this.scrollable.setSmoothScrollDuration(options.smoothScrolling ? 125 : 0);
        }
        if (options.horizontalScrolling !== undefined) {
            this.horizontalScrolling = options.horizontalScrolling;
        }
        let scrollableOptions;
        if (options.scrollByPage !== undefined) {
            scrollableOptions = { ...(scrollableOptions ?? {}), scrollByPage: options.scrollByPage };
        }
        if (options.mouseWheelScrollSensitivity !== undefined) {
            scrollableOptions = { ...(scrollableOptions ?? {}), mouseWheelScrollSensitivity: options.mouseWheelScrollSensitivity };
        }
        if (options.fastScrollSensitivity !== undefined) {
            scrollableOptions = { ...(scrollableOptions ?? {}), fastScrollSensitivity: options.fastScrollSensitivity };
        }
        if (scrollableOptions) {
            this.scrollableElement.updateOptions(scrollableOptions);
        }
        if (options.paddingTop !== undefined && options.paddingTop !== this.rangeMap.paddingTop) {
            // trigger a rerender
            const lastRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
            const offset = options.paddingTop - this.rangeMap.paddingTop;
            this.rangeMap.paddingTop = options.paddingTop;
            this.render(lastRenderRange, Math.max(0, this.lastRenderTop + offset), this.lastRenderHeight, undefined, undefined, true);
            this.setScrollTop(this.lastRenderTop);
            this.eventuallyUpdateScrollDimensions();
            if (this.supportDynamicHeights) {
                this._rerender(this.lastRenderTop, this.lastRenderHeight);
            }
        }
    }
    delegateScrollFromMouseWheelEvent(browserEvent) {
        this.scrollableElement.delegateScrollFromMouseWheelEvent(browserEvent);
    }
    delegateVerticalScrollbarPointerDown(browserEvent) {
        this.scrollableElement.delegateVerticalScrollbarPointerDown(browserEvent);
    }
    updateElementHeight(index, size, anchorIndex) {
        if (index < 0 || index >= this.items.length) {
            return;
        }
        const originalSize = this.items[index].size;
        if (typeof size === 'undefined') {
            if (!this.supportDynamicHeights) {
                console.warn('Dynamic heights not supported', new Error().stack);
                return;
            }
            this.items[index].lastDynamicHeightWidth = undefined;
            size = originalSize + this.probeDynamicHeight(index);
        }
        if (originalSize === size) {
            return;
        }
        const lastRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
        let heightDiff = 0;
        if (index < lastRenderRange.start) {
            // do not scroll the viewport if resized element is out of viewport
            heightDiff = size - originalSize;
        }
        else {
            if (anchorIndex !== null && anchorIndex > index && anchorIndex < lastRenderRange.end) {
                // anchor in viewport
                // resized element in viewport and above the anchor
                heightDiff = size - originalSize;
            }
            else {
                heightDiff = 0;
            }
        }
        this.rangeMap.splice(index, 1, [{ size: size }]);
        this.items[index].size = size;
        this.render(lastRenderRange, Math.max(0, this.lastRenderTop + heightDiff), this.lastRenderHeight, undefined, undefined, true);
        this.setScrollTop(this.lastRenderTop);
        this.eventuallyUpdateScrollDimensions();
        if (this.supportDynamicHeights) {
            this._rerender(this.lastRenderTop, this.lastRenderHeight);
        }
        else {
            this._onDidChangeContentHeight.fire(this.contentHeight); // otherwise fired in _rerender()
        }
    }
    createRangeMap(paddingTop) {
        return new RangeMap(paddingTop);
    }
    splice(start, deleteCount, elements = []) {
        if (this.splicing) {
            throw new Error('Can\'t run recursive splices.');
        }
        this.splicing = true;
        try {
            return this._splice(start, deleteCount, elements);
        }
        finally {
            this.splicing = false;
            this._onDidChangeContentHeight.fire(this.contentHeight);
        }
    }
    _splice(start, deleteCount, elements = []) {
        const previousRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
        const deleteRange = { start, end: start + deleteCount };
        const removeRange = Range.intersect(previousRenderRange, deleteRange);
        // try to reuse rows, avoid removing them from DOM
        const rowsToDispose = new Map();
        for (let i = removeRange.end - 1; i >= removeRange.start; i--) {
            const item = this.items[i];
            item.dragStartDisposable.dispose();
            item.checkedDisposable.dispose();
            if (item.row) {
                let rows = rowsToDispose.get(item.templateId);
                if (!rows) {
                    rows = [];
                    rowsToDispose.set(item.templateId, rows);
                }
                const renderer = this.renderers.get(item.templateId);
                if (renderer && renderer.disposeElement) {
                    renderer.disposeElement(item.element, i, item.row.templateData, { height: item.size });
                }
                rows.unshift(item.row);
            }
            item.row = null;
            item.stale = true;
        }
        const previousRestRange = { start: start + deleteCount, end: this.items.length };
        const previousRenderedRestRange = Range.intersect(previousRestRange, previousRenderRange);
        const previousUnrenderedRestRanges = Range.relativeComplement(previousRestRange, previousRenderRange);
        const inserted = elements.map(element => ({
            id: String(this.itemId++),
            element,
            templateId: this.virtualDelegate.getTemplateId(element),
            size: this.virtualDelegate.getHeight(element),
            width: undefined,
            hasDynamicHeight: !!this.virtualDelegate.hasDynamicHeight && this.virtualDelegate.hasDynamicHeight(element),
            lastDynamicHeightWidth: undefined,
            row: null,
            uri: undefined,
            dropTarget: false,
            dragStartDisposable: Disposable.None,
            checkedDisposable: Disposable.None,
            stale: false
        }));
        let deleted;
        // TODO@joao: improve this optimization to catch even more cases
        if (start === 0 && deleteCount >= this.items.length) {
            this.rangeMap = this.createRangeMap(this.rangeMap.paddingTop);
            this.rangeMap.splice(0, 0, inserted);
            deleted = this.items;
            this.items = inserted;
        }
        else {
            this.rangeMap.splice(start, deleteCount, inserted);
            deleted = splice(this.items, start, deleteCount, inserted);
        }
        const delta = elements.length - deleteCount;
        const renderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
        const renderedRestRange = shift(previousRenderedRestRange, delta);
        const updateRange = Range.intersect(renderRange, renderedRestRange);
        for (let i = updateRange.start; i < updateRange.end; i++) {
            this.updateItemInDOM(this.items[i], i);
        }
        const removeRanges = Range.relativeComplement(renderedRestRange, renderRange);
        for (const range of removeRanges) {
            for (let i = range.start; i < range.end; i++) {
                this.removeItemFromDOM(i);
            }
        }
        const unrenderedRestRanges = previousUnrenderedRestRanges.map(r => shift(r, delta));
        const elementsRange = { start, end: start + elements.length };
        const insertRanges = [elementsRange, ...unrenderedRestRanges].map(r => Range.intersect(renderRange, r)).reverse();
        for (const range of insertRanges) {
            for (let i = range.end - 1; i >= range.start; i--) {
                const item = this.items[i];
                const rows = rowsToDispose.get(item.templateId);
                const row = rows?.pop();
                this.insertItemInDOM(i, row);
            }
        }
        for (const rows of rowsToDispose.values()) {
            for (const row of rows) {
                this.cache.release(row);
            }
        }
        this.eventuallyUpdateScrollDimensions();
        if (this.supportDynamicHeights) {
            this._rerender(this.scrollTop, this.renderHeight);
        }
        return deleted.map(i => i.element);
    }
    eventuallyUpdateScrollDimensions() {
        this._scrollHeight = this.contentHeight;
        this.rowsContainer.style.height = `${this._scrollHeight}px`;
        if (!this.scrollableElementUpdateDisposable) {
            this.scrollableElementUpdateDisposable = scheduleAtNextAnimationFrame(getWindow(this.domNode), () => {
                this.scrollableElement.setScrollDimensions({ scrollHeight: this.scrollHeight });
                this.updateScrollWidth();
                this.scrollableElementUpdateDisposable = null;
            });
        }
    }
    eventuallyUpdateScrollWidth() {
        if (!this.horizontalScrolling) {
            this.scrollableElementWidthDelayer.cancel();
            return;
        }
        this.scrollableElementWidthDelayer.trigger(() => this.updateScrollWidth());
    }
    updateScrollWidth() {
        if (!this.horizontalScrolling) {
            return;
        }
        let scrollWidth = 0;
        for (const item of this.items) {
            if (typeof item.width !== 'undefined') {
                scrollWidth = Math.max(scrollWidth, item.width);
            }
        }
        this.scrollWidth = scrollWidth;
        this.scrollableElement.setScrollDimensions({ scrollWidth: scrollWidth === 0 ? 0 : (scrollWidth + 10) });
        this._onDidChangeContentWidth.fire(this.scrollWidth);
    }
    updateWidth(index) {
        if (!this.horizontalScrolling || typeof this.scrollWidth === 'undefined') {
            return;
        }
        const item = this.items[index];
        this.measureItemWidth(item);
        if (typeof item.width !== 'undefined' && item.width > this.scrollWidth) {
            this.scrollWidth = item.width;
            this.scrollableElement.setScrollDimensions({ scrollWidth: this.scrollWidth + 10 });
            this._onDidChangeContentWidth.fire(this.scrollWidth);
        }
    }
    rerender() {
        if (!this.supportDynamicHeights) {
            return;
        }
        for (const item of this.items) {
            item.lastDynamicHeightWidth = undefined;
        }
        this._rerender(this.lastRenderTop, this.lastRenderHeight);
    }
    get length() {
        return this.items.length;
    }
    get renderHeight() {
        const scrollDimensions = this.scrollableElement.getScrollDimensions();
        return scrollDimensions.height;
    }
    get firstVisibleIndex() {
        const range = this.getVisibleRange(this.lastRenderTop, this.lastRenderHeight);
        return range.start;
    }
    get firstMostlyVisibleIndex() {
        const firstVisibleIndex = this.firstVisibleIndex;
        const firstElTop = this.rangeMap.positionAt(firstVisibleIndex);
        const nextElTop = this.rangeMap.positionAt(firstVisibleIndex + 1);
        if (nextElTop !== -1) {
            const firstElMidpoint = (nextElTop - firstElTop) / 2 + firstElTop;
            if (firstElMidpoint < this.scrollTop) {
                return firstVisibleIndex + 1;
            }
        }
        return firstVisibleIndex;
    }
    get lastVisibleIndex() {
        const range = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
        return range.end - 1;
    }
    element(index) {
        return this.items[index].element;
    }
    indexOf(element) {
        return this.items.findIndex(item => item.element === element);
    }
    domElement(index) {
        const row = this.items[index].row;
        return row && row.domNode;
    }
    elementHeight(index) {
        return this.items[index].size;
    }
    elementTop(index) {
        return this.rangeMap.positionAt(index);
    }
    indexAt(position) {
        return this.rangeMap.indexAt(position);
    }
    indexAfter(position) {
        return this.rangeMap.indexAfter(position);
    }
    layout(height, width) {
        const scrollDimensions = {
            height: typeof height === 'number' ? height : getContentHeight(this.domNode)
        };
        if (this.scrollableElementUpdateDisposable) {
            this.scrollableElementUpdateDisposable.dispose();
            this.scrollableElementUpdateDisposable = null;
            scrollDimensions.scrollHeight = this.scrollHeight;
        }
        this.scrollableElement.setScrollDimensions(scrollDimensions);
        if (typeof width !== 'undefined') {
            this.renderWidth = width;
            if (this.supportDynamicHeights) {
                this._rerender(this.scrollTop, this.renderHeight);
            }
        }
        if (this.horizontalScrolling) {
            this.scrollableElement.setScrollDimensions({
                width: typeof width === 'number' ? width : getContentWidth(this.domNode)
            });
        }
    }
    // Render
    render(previousRenderRange, renderTop, renderHeight, renderLeft, scrollWidth, updateItemsInDOM = false, onScroll = false) {
        const renderRange = this.getRenderRange(renderTop, renderHeight);
        const rangesToInsert = Range.relativeComplement(renderRange, previousRenderRange).reverse();
        const rangesToRemove = Range.relativeComplement(previousRenderRange, renderRange);
        if (updateItemsInDOM) {
            const rangesToUpdate = Range.intersect(previousRenderRange, renderRange);
            for (let i = rangesToUpdate.start; i < rangesToUpdate.end; i++) {
                this.updateItemInDOM(this.items[i], i);
            }
        }
        this.cache.transact(() => {
            for (const range of rangesToRemove) {
                for (let i = range.start; i < range.end; i++) {
                    this.removeItemFromDOM(i, onScroll);
                }
            }
            for (const range of rangesToInsert) {
                for (let i = range.end - 1; i >= range.start; i--) {
                    this.insertItemInDOM(i);
                }
            }
        });
        if (renderLeft !== undefined) {
            this.rowsContainer.style.left = `-${renderLeft}px`;
        }
        this.rowsContainer.style.top = `-${renderTop}px`;
        if (this.horizontalScrolling && scrollWidth !== undefined) {
            this.rowsContainer.style.width = `${Math.max(scrollWidth, this.renderWidth)}px`;
        }
        this.lastRenderTop = renderTop;
        this.lastRenderHeight = renderHeight;
    }
    // DOM operations
    insertItemInDOM(index, row) {
        const item = this.items[index];
        if (!item.row) {
            if (row) {
                item.row = row;
                item.stale = true;
            }
            else {
                const result = this.cache.alloc(item.templateId);
                item.row = result.row;
                item.stale ||= result.isReusingConnectedDomNode;
            }
        }
        const role = this.accessibilityProvider.getRole(item.element) || 'listitem';
        item.row.domNode.setAttribute('role', role);
        const checked = this.accessibilityProvider.isChecked(item.element);
        const toAriaState = (value) => value === 'mixed' ? 'mixed' : String(!!value);
        if (typeof checked === 'boolean' || checked === 'mixed') {
            item.row.domNode.setAttribute('aria-checked', toAriaState(checked));
        }
        else if (checked) {
            const update = (value) => item.row.domNode.setAttribute('aria-checked', toAriaState(value));
            update(checked.value);
            item.checkedDisposable = checked.onDidChange(() => update(checked.value));
        }
        if (item.stale || !item.row.domNode.parentElement) {
            const referenceNode = this.items.at(index + 1)?.row?.domNode ?? null;
            if (item.row.domNode.parentElement !== this.rowsContainer || item.row.domNode.nextElementSibling !== referenceNode) {
                this.rowsContainer.insertBefore(item.row.domNode, referenceNode);
            }
            item.stale = false;
        }
        this.updateItemInDOM(item, index);
        const renderer = this.renderers.get(item.templateId);
        if (!renderer) {
            throw new Error(`No renderer found for template id ${item.templateId}`);
        }
        renderer?.renderElement(item.element, index, item.row.templateData, { height: item.size });
        const uri = this.dnd.getDragURI(item.element);
        item.dragStartDisposable.dispose();
        item.row.domNode.draggable = !!uri;
        if (uri) {
            item.dragStartDisposable = addDisposableListener(item.row.domNode, 'dragstart', event => this.onDragStart(item.element, uri, event));
        }
        if (this.horizontalScrolling) {
            this.measureItemWidth(item);
            this.eventuallyUpdateScrollWidth();
        }
    }
    measureItemWidth(item) {
        if (!item.row || !item.row.domNode) {
            return;
        }
        item.row.domNode.style.width = 'fit-content';
        item.width = getContentWidth(item.row.domNode);
        const style = getWindow(item.row.domNode).getComputedStyle(item.row.domNode);
        if (style.paddingLeft) {
            item.width += parseFloat(style.paddingLeft);
        }
        if (style.paddingRight) {
            item.width += parseFloat(style.paddingRight);
        }
        item.row.domNode.style.width = '';
    }
    updateItemInDOM(item, index) {
        item.row.domNode.style.top = `${this.elementTop(index)}px`;
        if (this.setRowHeight) {
            item.row.domNode.style.height = `${item.size}px`;
        }
        if (this.setRowLineHeight) {
            item.row.domNode.style.lineHeight = `${item.size}px`;
        }
        item.row.domNode.setAttribute('data-index', `${index}`);
        item.row.domNode.setAttribute('data-last-element', index === this.length - 1 ? 'true' : 'false');
        item.row.domNode.setAttribute('data-parity', index % 2 === 0 ? 'even' : 'odd');
        item.row.domNode.setAttribute('aria-setsize', String(this.accessibilityProvider.getSetSize(item.element, index, this.length)));
        item.row.domNode.setAttribute('aria-posinset', String(this.accessibilityProvider.getPosInSet(item.element, index)));
        item.row.domNode.setAttribute('id', this.getElementDomId(index));
        item.row.domNode.classList.toggle('drop-target', item.dropTarget);
    }
    removeItemFromDOM(index, onScroll) {
        const item = this.items[index];
        item.dragStartDisposable.dispose();
        item.checkedDisposable.dispose();
        if (item.row) {
            const renderer = this.renderers.get(item.templateId);
            if (renderer && renderer.disposeElement) {
                renderer.disposeElement(item.element, index, item.row.templateData, { height: item.size, onScroll });
            }
            this.cache.release(item.row);
            item.row = null;
        }
        if (this.horizontalScrolling) {
            this.eventuallyUpdateScrollWidth();
        }
    }
    getScrollTop() {
        const scrollPosition = this.scrollableElement.getScrollPosition();
        return scrollPosition.scrollTop;
    }
    setScrollTop(scrollTop, reuseAnimation) {
        if (this.scrollableElementUpdateDisposable) {
            this.scrollableElementUpdateDisposable.dispose();
            this.scrollableElementUpdateDisposable = null;
            this.scrollableElement.setScrollDimensions({ scrollHeight: this.scrollHeight });
        }
        this.scrollableElement.setScrollPosition({ scrollTop, reuseAnimation });
    }
    getScrollLeft() {
        const scrollPosition = this.scrollableElement.getScrollPosition();
        return scrollPosition.scrollLeft;
    }
    setScrollLeft(scrollLeft) {
        if (this.scrollableElementUpdateDisposable) {
            this.scrollableElementUpdateDisposable.dispose();
            this.scrollableElementUpdateDisposable = null;
            this.scrollableElement.setScrollDimensions({ scrollWidth: this.scrollWidth });
        }
        this.scrollableElement.setScrollPosition({ scrollLeft });
    }
    get scrollTop() {
        return this.getScrollTop();
    }
    set scrollTop(scrollTop) {
        this.setScrollTop(scrollTop);
    }
    get scrollHeight() {
        return this._scrollHeight + (this.horizontalScrolling ? 10 : 0) + this.paddingBottom;
    }
    // Events
    get onMouseClick() { return Event.map(this.disposables.add(new DomEmitter(this.domNode, 'click')).event, e => this.toMouseEvent(e), this.disposables); }
    get onMouseDblClick() { return Event.map(this.disposables.add(new DomEmitter(this.domNode, 'dblclick')).event, e => this.toMouseEvent(e), this.disposables); }
    get onMouseMiddleClick() { return Event.filter(Event.map(this.disposables.add(new DomEmitter(this.domNode, 'auxclick')).event, e => this.toMouseEvent(e), this.disposables), e => e.browserEvent.button === 1, this.disposables); }
    get onMouseUp() { return Event.map(this.disposables.add(new DomEmitter(this.domNode, 'mouseup')).event, e => this.toMouseEvent(e), this.disposables); }
    get onMouseDown() { return Event.map(this.disposables.add(new DomEmitter(this.domNode, 'mousedown')).event, e => this.toMouseEvent(e), this.disposables); }
    get onMouseOver() { return Event.map(this.disposables.add(new DomEmitter(this.domNode, 'mouseover')).event, e => this.toMouseEvent(e), this.disposables); }
    get onMouseMove() { return Event.map(this.disposables.add(new DomEmitter(this.domNode, 'mousemove')).event, e => this.toMouseEvent(e), this.disposables); }
    get onMouseOut() { return Event.map(this.disposables.add(new DomEmitter(this.domNode, 'mouseout')).event, e => this.toMouseEvent(e), this.disposables); }
    get onContextMenu() { return Event.any(Event.map(this.disposables.add(new DomEmitter(this.domNode, 'contextmenu')).event, e => this.toMouseEvent(e), this.disposables), Event.map(this.disposables.add(new DomEmitter(this.domNode, TouchEventType.Contextmenu)).event, e => this.toGestureEvent(e), this.disposables)); }
    get onTouchStart() { return Event.map(this.disposables.add(new DomEmitter(this.domNode, 'touchstart')).event, e => this.toTouchEvent(e), this.disposables); }
    get onTap() { return Event.map(this.disposables.add(new DomEmitter(this.rowsContainer, TouchEventType.Tap)).event, e => this.toGestureEvent(e), this.disposables); }
    toMouseEvent(browserEvent) {
        const index = this.getItemIndexFromEventTarget(browserEvent.target || null);
        const item = typeof index === 'undefined' ? undefined : this.items[index];
        const element = item && item.element;
        return { browserEvent, index, element };
    }
    toTouchEvent(browserEvent) {
        const index = this.getItemIndexFromEventTarget(browserEvent.target || null);
        const item = typeof index === 'undefined' ? undefined : this.items[index];
        const element = item && item.element;
        return { browserEvent, index, element };
    }
    toGestureEvent(browserEvent) {
        const index = this.getItemIndexFromEventTarget(browserEvent.initialTarget || null);
        const item = typeof index === 'undefined' ? undefined : this.items[index];
        const element = item && item.element;
        return { browserEvent, index, element };
    }
    toDragEvent(browserEvent) {
        const index = this.getItemIndexFromEventTarget(browserEvent.target || null);
        const item = typeof index === 'undefined' ? undefined : this.items[index];
        const element = item && item.element;
        const sector = this.getTargetSector(browserEvent, index);
        return { browserEvent, index, element, sector };
    }
    onScroll(e) {
        try {
            const previousRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
            this.render(previousRenderRange, e.scrollTop, e.height, e.scrollLeft, e.scrollWidth, undefined, true);
            if (this.supportDynamicHeights) {
                this._rerender(e.scrollTop, e.height, e.inSmoothScrolling);
            }
        }
        catch (err) {
            console.error('Got bad scroll event:', e);
            throw err;
        }
    }
    onTouchChange(event) {
        event.preventDefault();
        event.stopPropagation();
        this.scrollTop -= event.translationY;
    }
    // DND
    onDragStart(element, uri, event) {
        if (!event.dataTransfer) {
            return;
        }
        const elements = this.dnd.getDragElements(element);
        event.dataTransfer.effectAllowed = 'copyMove';
        event.dataTransfer.setData(DataTransfers.TEXT, uri);
        let label;
        if (this.dnd.getDragLabel) {
            label = this.dnd.getDragLabel(elements, event);
        }
        if (typeof label === 'undefined') {
            label = String(elements.length);
        }
        applyDragImage(event, this.domNode, label, [this.domId /* add domId to get list specific styling */]);
        this.domNode.classList.add('dragging');
        this.currentDragData = new ElementsDragAndDropData(elements);
        StaticDND.CurrentDragAndDropData = new ExternalElementsDragAndDropData(elements);
        this.dnd.onDragStart?.(this.currentDragData, event);
    }
    onPotentialSelectionStart(e) {
        this.currentSelectionDisposable.dispose();
        const doc = getDocument(this.domNode);
        // Set up both the 'movement store' for watching the mouse, and the
        // 'selection store' which lasts as long as there's a selection, even
        // after the usr has stopped modifying it.
        const selectionStore = this.currentSelectionDisposable = new DisposableStore();
        const movementStore = selectionStore.add(new DisposableStore());
        // The selection events we get from the DOM are fairly limited and we lack a 'selection end' event.
        // Selection events also don't tell us where the input doing the selection is. So, make a poor
        // assumption that a user is using the mouse, and base our events on that.
        movementStore.add(addDisposableListener(this.domNode, 'selectstart', () => {
            movementStore.add(addDisposableListener(doc, 'mousemove', e => {
                if (doc.getSelection()?.isCollapsed === false) {
                    this.setupDragAndDropScrollTopAnimation(e);
                }
            }));
            // The selection is cleared either on mouseup if there's no selection, or on next mousedown
            // when `this.currentSelectionDisposable` is reset.
            selectionStore.add(toDisposable(() => {
                const previousRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
                this.currentSelectionBounds = undefined;
                this.render(previousRenderRange, this.lastRenderTop, this.lastRenderHeight, undefined, undefined);
            }));
            selectionStore.add(addDisposableListener(doc, 'selectionchange', () => {
                const selection = doc.getSelection();
                // if the selection changed _after_ mouseup, it's from clearing the list or similar, so teardown
                if (!selection || selection.isCollapsed) {
                    if (movementStore.isDisposed) {
                        selectionStore.dispose();
                    }
                    return;
                }
                let start = this.getIndexOfListElement(selection.anchorNode);
                let end = this.getIndexOfListElement(selection.focusNode);
                if (start !== undefined && end !== undefined) {
                    if (end < start) {
                        [start, end] = [end, start];
                    }
                    this.currentSelectionBounds = { start, end };
                }
            }));
        }));
        movementStore.add(addDisposableListener(doc, 'mouseup', () => {
            movementStore.dispose();
            this.teardownDragAndDropScrollTopAnimation();
            if (doc.getSelection()?.isCollapsed !== false) {
                selectionStore.dispose();
            }
        }));
    }
    getIndexOfListElement(element) {
        if (!element || !this.domNode.contains(element)) {
            return undefined;
        }
        while (element && element !== this.domNode) {
            if (element.dataset?.index) {
                return Number(element.dataset.index);
            }
            element = element.parentElement;
        }
        return undefined;
    }
    onDragOver(event) {
        event.browserEvent.preventDefault(); // needed so that the drop event fires (https://stackoverflow.com/questions/21339924/drop-event-not-firing-in-chrome)
        this.onDragLeaveTimeout.dispose();
        if (StaticDND.CurrentDragAndDropData && StaticDND.CurrentDragAndDropData.getData() === 'vscode-ui') {
            return false;
        }
        this.setupDragAndDropScrollTopAnimation(event.browserEvent);
        if (!event.browserEvent.dataTransfer) {
            return false;
        }
        // Drag over from outside
        if (!this.currentDragData) {
            if (StaticDND.CurrentDragAndDropData) {
                // Drag over from another list
                this.currentDragData = StaticDND.CurrentDragAndDropData;
            }
            else {
                // Drag over from the desktop
                if (!event.browserEvent.dataTransfer.types) {
                    return false;
                }
                this.currentDragData = new NativeDragAndDropData();
            }
        }
        const result = this.dnd.onDragOver(this.currentDragData, event.element, event.index, event.sector, event.browserEvent);
        this.canDrop = typeof result === 'boolean' ? result : result.accept;
        if (!this.canDrop) {
            this.currentDragFeedback = undefined;
            this.currentDragFeedbackDisposable.dispose();
            return false;
        }
        event.browserEvent.dataTransfer.dropEffect = (typeof result !== 'boolean' && result.effect?.type === 0 /* ListDragOverEffectType.Copy */) ? 'copy' : 'move';
        let feedback;
        if (typeof result !== 'boolean' && result.feedback) {
            feedback = result.feedback;
        }
        else {
            if (typeof event.index === 'undefined') {
                feedback = [-1];
            }
            else {
                feedback = [event.index];
            }
        }
        // sanitize feedback list
        feedback = distinct(feedback).filter(i => i >= -1 && i < this.length).sort((a, b) => a - b);
        feedback = feedback[0] === -1 ? [-1] : feedback;
        let dragOverEffectPosition = typeof result !== 'boolean' && result.effect && result.effect.position ? result.effect.position : "drop-target" /* ListDragOverEffectPosition.Over */;
        if (equalsDragFeedback(this.currentDragFeedback, feedback) && this.currentDragFeedbackPosition === dragOverEffectPosition) {
            return true;
        }
        this.currentDragFeedback = feedback;
        this.currentDragFeedbackPosition = dragOverEffectPosition;
        this.currentDragFeedbackDisposable.dispose();
        if (feedback[0] === -1) { // entire list feedback
            this.domNode.classList.add(dragOverEffectPosition);
            this.rowsContainer.classList.add(dragOverEffectPosition);
            this.currentDragFeedbackDisposable = toDisposable(() => {
                this.domNode.classList.remove(dragOverEffectPosition);
                this.rowsContainer.classList.remove(dragOverEffectPosition);
            });
        }
        else {
            if (feedback.length > 1 && dragOverEffectPosition !== "drop-target" /* ListDragOverEffectPosition.Over */) {
                throw new Error('Can\'t use multiple feedbacks with position different than \'over\'');
            }
            // Make sure there is no flicker when moving between two items
            // Always use the before feedback if possible
            if (dragOverEffectPosition === "drop-target-after" /* ListDragOverEffectPosition.After */) {
                if (feedback[0] < this.length - 1) {
                    feedback[0] += 1;
                    dragOverEffectPosition = "drop-target-before" /* ListDragOverEffectPosition.Before */;
                }
            }
            for (const index of feedback) {
                const item = this.items[index];
                item.dropTarget = true;
                item.row?.domNode.classList.add(dragOverEffectPosition);
            }
            this.currentDragFeedbackDisposable = toDisposable(() => {
                for (const index of feedback) {
                    const item = this.items[index];
                    item.dropTarget = false;
                    item.row?.domNode.classList.remove(dragOverEffectPosition);
                }
            });
        }
        return true;
    }
    onDragLeave(event) {
        this.onDragLeaveTimeout.dispose();
        this.onDragLeaveTimeout = disposableTimeout(() => this.clearDragOverFeedback(), 100, this.disposables);
        if (this.currentDragData) {
            this.dnd.onDragLeave?.(this.currentDragData, event.element, event.index, event.browserEvent);
        }
    }
    onDrop(event) {
        if (!this.canDrop) {
            return;
        }
        const dragData = this.currentDragData;
        this.teardownDragAndDropScrollTopAnimation();
        this.clearDragOverFeedback();
        this.domNode.classList.remove('dragging');
        this.currentDragData = undefined;
        StaticDND.CurrentDragAndDropData = undefined;
        if (!dragData || !event.browserEvent.dataTransfer) {
            return;
        }
        event.browserEvent.preventDefault();
        dragData.update(event.browserEvent.dataTransfer);
        this.dnd.drop(dragData, event.element, event.index, event.sector, event.browserEvent);
    }
    onDragEnd(event) {
        this.canDrop = false;
        this.teardownDragAndDropScrollTopAnimation();
        this.clearDragOverFeedback();
        this.domNode.classList.remove('dragging');
        this.currentDragData = undefined;
        StaticDND.CurrentDragAndDropData = undefined;
        this.dnd.onDragEnd?.(event);
    }
    clearDragOverFeedback() {
        this.currentDragFeedback = undefined;
        this.currentDragFeedbackPosition = undefined;
        this.currentDragFeedbackDisposable.dispose();
        this.currentDragFeedbackDisposable = Disposable.None;
    }
    // DND scroll top animation
    setupDragAndDropScrollTopAnimation(event) {
        if (!this.dragOverAnimationDisposable) {
            const viewTop = getTopLeftOffset(this.domNode).top;
            this.dragOverAnimationDisposable = animate(getWindow(this.domNode), this.animateDragAndDropScrollTop.bind(this, viewTop));
        }
        this.dragOverAnimationStopDisposable.dispose();
        this.dragOverAnimationStopDisposable = disposableTimeout(() => {
            if (this.dragOverAnimationDisposable) {
                this.dragOverAnimationDisposable.dispose();
                this.dragOverAnimationDisposable = undefined;
            }
        }, 1000, this.disposables);
        this.dragOverMouseY = event.pageY;
    }
    animateDragAndDropScrollTop(viewTop) {
        if (this.dragOverMouseY === undefined) {
            return;
        }
        const diff = this.dragOverMouseY - viewTop;
        const upperLimit = this.renderHeight - 35;
        if (diff < 35) {
            this.scrollTop += Math.max(-14, Math.floor(0.3 * (diff - 35)));
        }
        else if (diff > upperLimit) {
            this.scrollTop += Math.min(14, Math.floor(0.3 * (diff - upperLimit)));
        }
    }
    teardownDragAndDropScrollTopAnimation() {
        this.dragOverAnimationStopDisposable.dispose();
        if (this.dragOverAnimationDisposable) {
            this.dragOverAnimationDisposable.dispose();
            this.dragOverAnimationDisposable = undefined;
        }
    }
    // Util
    getTargetSector(browserEvent, targetIndex) {
        if (targetIndex === undefined) {
            return undefined;
        }
        const relativePosition = browserEvent.offsetY / this.items[targetIndex].size;
        const sector = Math.floor(relativePosition / 0.25);
        return clamp(sector, 0, 3);
    }
    getItemIndexFromEventTarget(target) {
        const scrollableElement = this.scrollableElement.getDomNode();
        let element = target;
        while ((isHTMLElement(element) || isSVGElement(element)) && element !== this.rowsContainer && scrollableElement.contains(element)) {
            const rawIndex = element.getAttribute('data-index');
            if (rawIndex) {
                const index = Number(rawIndex);
                if (!isNaN(index)) {
                    return index;
                }
            }
            element = element.parentElement;
        }
        return undefined;
    }
    getVisibleRange(renderTop, renderHeight) {
        return {
            start: this.rangeMap.indexAt(renderTop),
            end: this.rangeMap.indexAfter(renderTop + renderHeight - 1)
        };
    }
    getRenderRange(renderTop, renderHeight) {
        const range = this.getVisibleRange(renderTop, renderHeight);
        if (this.currentSelectionBounds) {
            const max = this.rangeMap.count;
            range.start = Math.min(range.start, this.currentSelectionBounds.start, max);
            range.end = Math.min(Math.max(range.end, this.currentSelectionBounds.end + 1), max);
        }
        return range;
    }
    /**
     * Given a stable rendered state, checks every rendered element whether it needs
     * to be probed for dynamic height. Adjusts scroll height and top if necessary.
     */
    _rerender(renderTop, renderHeight, inSmoothScrolling) {
        const previousRenderRange = this.getRenderRange(renderTop, renderHeight);
        // Let's remember the second element's position, this helps in scrolling up
        // and preserving a linear upwards scroll movement
        let anchorElementIndex;
        let anchorElementTopDelta;
        if (renderTop === this.elementTop(previousRenderRange.start)) {
            anchorElementIndex = previousRenderRange.start;
            anchorElementTopDelta = 0;
        }
        else if (previousRenderRange.end - previousRenderRange.start > 1) {
            anchorElementIndex = previousRenderRange.start + 1;
            anchorElementTopDelta = this.elementTop(anchorElementIndex) - renderTop;
        }
        let heightDiff = 0;
        while (true) {
            const renderRange = this.getRenderRange(renderTop, renderHeight);
            let didChange = false;
            for (let i = renderRange.start; i < renderRange.end; i++) {
                const diff = this.probeDynamicHeight(i);
                if (diff !== 0) {
                    this.rangeMap.splice(i, 1, [this.items[i]]);
                }
                heightDiff += diff;
                didChange = didChange || diff !== 0;
            }
            if (!didChange) {
                if (heightDiff !== 0) {
                    this.eventuallyUpdateScrollDimensions();
                }
                const unrenderRanges = Range.relativeComplement(previousRenderRange, renderRange);
                for (const range of unrenderRanges) {
                    for (let i = range.start; i < range.end; i++) {
                        if (this.items[i].row) {
                            this.removeItemFromDOM(i);
                        }
                    }
                }
                const renderRanges = Range.relativeComplement(renderRange, previousRenderRange).reverse();
                for (const range of renderRanges) {
                    for (let i = range.end - 1; i >= range.start; i--) {
                        this.insertItemInDOM(i);
                    }
                }
                for (let i = renderRange.start; i < renderRange.end; i++) {
                    if (this.items[i].row) {
                        this.updateItemInDOM(this.items[i], i);
                    }
                }
                if (typeof anchorElementIndex === 'number') {
                    // To compute a destination scroll top, we need to take into account the current smooth scrolling
                    // animation, and then reuse it with a new target (to avoid prolonging the scroll)
                    // See https://github.com/microsoft/vscode/issues/104144
                    // See https://github.com/microsoft/vscode/pull/104284
                    // See https://github.com/microsoft/vscode/issues/107704
                    const deltaScrollTop = this.scrollable.getFutureScrollPosition().scrollTop - renderTop;
                    const newScrollTop = this.elementTop(anchorElementIndex) - anchorElementTopDelta + deltaScrollTop;
                    this.setScrollTop(newScrollTop, inSmoothScrolling);
                }
                this._onDidChangeContentHeight.fire(this.contentHeight);
                return;
            }
        }
    }
    probeDynamicHeight(index) {
        const item = this.items[index];
        if (!!this.virtualDelegate.getDynamicHeight) {
            const newSize = this.virtualDelegate.getDynamicHeight(item.element);
            if (newSize !== null) {
                const size = item.size;
                item.size = newSize;
                item.lastDynamicHeightWidth = this.renderWidth;
                return newSize - size;
            }
        }
        if (!item.hasDynamicHeight || item.lastDynamicHeightWidth === this.renderWidth) {
            return 0;
        }
        if (!!this.virtualDelegate.hasDynamicHeight && !this.virtualDelegate.hasDynamicHeight(item.element)) {
            return 0;
        }
        const size = item.size;
        if (item.row) {
            item.row.domNode.style.height = '';
            item.size = item.row.domNode.offsetHeight;
            if (item.size === 0) {
                if (!isAncestor(item.row.domNode, getWindow(item.row.domNode).document.body)) {
                    console.warn('Measuring item node that is not in DOM! Add ListView to the DOM before measuring row height!', new Error().stack);
                }
                else {
                    console.warn('Measured item node at 0px- ensure that ListView is not display:none before measuring row height!', new Error().stack);
                }
            }
            item.lastDynamicHeightWidth = this.renderWidth;
            return item.size - size;
        }
        const { row } = this.cache.alloc(item.templateId);
        row.domNode.style.height = '';
        this.rowsContainer.appendChild(row.domNode);
        const renderer = this.renderers.get(item.templateId);
        if (!renderer) {
            throw new BugIndicatingError('Missing renderer for templateId: ' + item.templateId);
        }
        renderer.renderElement(item.element, index, row.templateData);
        item.size = row.domNode.offsetHeight;
        renderer.disposeElement?.(item.element, index, row.templateData);
        this.virtualDelegate.setDynamicHeight?.(item.element, item.size);
        item.lastDynamicHeightWidth = this.renderWidth;
        row.domNode.remove();
        this.cache.release(row);
        return item.size - size;
    }
    getElementDomId(index) {
        return `${this.domId}_${index}`;
    }
    // Dispose
    dispose() {
        for (const item of this.items) {
            item.dragStartDisposable.dispose();
            item.checkedDisposable.dispose();
            if (item.row) {
                const renderer = this.renderers.get(item.row.templateId);
                if (renderer) {
                    renderer.disposeElement?.(item.element, -1, item.row.templateData, undefined);
                    renderer.disposeTemplate(item.row.templateData);
                }
            }
        }
        this.items = [];
        this.domNode?.remove();
        this.dragOverAnimationDisposable?.dispose();
        this.disposables.dispose();
    }
}
__decorate([
    memoize
], ListView.prototype, "onMouseClick", null);
__decorate([
    memoize
], ListView.prototype, "onMouseDblClick", null);
__decorate([
    memoize
], ListView.prototype, "onMouseMiddleClick", null);
__decorate([
    memoize
], ListView.prototype, "onMouseUp", null);
__decorate([
    memoize
], ListView.prototype, "onMouseDown", null);
__decorate([
    memoize
], ListView.prototype, "onMouseOver", null);
__decorate([
    memoize
], ListView.prototype, "onMouseMove", null);
__decorate([
    memoize
], ListView.prototype, "onMouseOut", null);
__decorate([
    memoize
], ListView.prototype, "onContextMenu", null);
__decorate([
    memoize
], ListView.prototype, "onTouchStart", null);
__decorate([
    memoize
], ListView.prototype, "onTap", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlzdFZpZXcuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdFZpZXcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGFBQWEsRUFBb0IsTUFBTSxjQUFjLENBQUM7QUFDL0QsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE9BQU8sRUFBYSxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFBRSxlQUFlLEVBQUUsV0FBVyxFQUFFLGdCQUFnQixFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSw0QkFBNEIsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUMvTyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFFNUMsT0FBTyxFQUFFLFNBQVMsSUFBSSxjQUFjLEVBQUUsT0FBTyxFQUFnQixNQUFNLGdCQUFnQixDQUFDO0FBQ3BGLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ3JFLE9BQU8sRUFBRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUN0RSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDeEQsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQXlCLE1BQU0sMEJBQTBCLENBQUM7QUFDakYsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsWUFBWSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDdEcsT0FBTyxFQUFVLEtBQUssRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3pELE9BQU8sRUFBd0IsVUFBVSxFQUFvQyxNQUFNLCtCQUErQixDQUFDO0FBR25ILE9BQU8sRUFBYSxRQUFRLEVBQUUsS0FBSyxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQzNELE9BQU8sRUFBUSxRQUFRLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDL0MsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFHL0QsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ25ELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFrQi9DLE1BQU0sU0FBUyxHQUFHO0lBQ2pCLHNCQUFzQixFQUFFLFNBQXlDO0NBQ2pFLENBQUM7QUFNRixNQUFNLENBQU4sSUFBa0Isb0JBTWpCO0FBTkQsV0FBa0Isb0JBQW9CO0lBQ3JDLGdEQUFnRDtJQUNoRCw2REFBTyxDQUFBO0lBQ1AsMkVBQWMsQ0FBQTtJQUNkLGlGQUFpQixDQUFBO0lBQ2pCLG1FQUFVLENBQUEsQ0FBSSxhQUFhO0FBQzVCLENBQUMsRUFOaUIsb0JBQW9CLEtBQXBCLG9CQUFvQixRQU1yQztBQXFDRCxNQUFNLGNBQWMsR0FBRztJQUN0QixVQUFVLEVBQUUsSUFBSTtJQUNoQixrQkFBa0Isa0NBQTBCO0lBQzVDLGdCQUFnQixFQUFFLElBQUk7SUFDdEIsWUFBWSxFQUFFLElBQUk7SUFDbEIscUJBQXFCLEVBQUUsS0FBSztJQUM1QixHQUFHLEVBQUU7UUFDSixlQUFlLENBQUksQ0FBSSxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEMsVUFBVSxLQUFLLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQztRQUM3QixXQUFXLEtBQVcsQ0FBQztRQUN2QixVQUFVLEtBQUssT0FBTyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQzlCLElBQUksS0FBSyxDQUFDO1FBQ1YsT0FBTyxLQUFLLENBQUM7S0FDYjtJQUNELG1CQUFtQixFQUFFLEtBQUs7SUFDMUIscUJBQXFCLEVBQUUsSUFBSTtJQUMzQix1QkFBdUIsRUFBRSxJQUFJO0NBQ0csQ0FBQztBQUVsQyxNQUFNLE9BQU8sdUJBQXVCO0lBS25DLElBQVcsT0FBTztRQUNqQixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUM7SUFDdEIsQ0FBQztJQUNELElBQVcsT0FBTyxDQUFDLEtBQTJCO1FBQzdDLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxZQUFZLFFBQWE7UUFDeEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7SUFDMUIsQ0FBQztJQUVELE1BQU0sS0FBVyxDQUFDO0lBRWxCLE9BQU87UUFDTixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUM7SUFDdEIsQ0FBQztDQUNEO0FBRUQsTUFBTSxPQUFPLCtCQUErQjtJQUkzQyxZQUFZLFFBQWE7UUFDeEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7SUFDMUIsQ0FBQztJQUVELE1BQU0sS0FBVyxDQUFDO0lBRWxCLE9BQU87UUFDTixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUM7SUFDdEIsQ0FBQztDQUNEO0FBRUQsTUFBTSxPQUFPLHFCQUFxQjtJQUtqQztRQUNDLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO1FBQ2hCLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO0lBQ2pCLENBQUM7SUFFRCxNQUFNLENBQUMsWUFBMEI7UUFDaEMsSUFBSSxZQUFZLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDeEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2hFLENBQUM7UUFFRCxJQUFJLFlBQVksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUN4QixJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUV4QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDcEQsTUFBTSxJQUFJLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRXhDLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztvQkFDdEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3ZCLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFRCxPQUFPO1FBQ04sT0FBTztZQUNOLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSztZQUNqQixLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7U0FDakIsQ0FBQztJQUNILENBQUM7Q0FDRDtBQUVELFNBQVMsa0JBQWtCLENBQUMsRUFBd0IsRUFBRSxFQUF3QjtJQUM3RSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO1FBQzVDLE9BQU8sTUFBTSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN2QixDQUFDO0lBRUQsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO0FBQ2xCLENBQUM7QUFFRCxNQUFNLDZCQUE2QjtJQU9sQyxZQUFZLHFCQUF5RDtRQUNwRSxJQUFJLHFCQUFxQixFQUFFLFVBQVUsRUFBRSxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxVQUFVLEdBQUcscUJBQXFCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBQ2hGLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDbEMsQ0FBQztRQUVELElBQUkscUJBQXFCLEVBQUUsV0FBVyxFQUFFLENBQUM7WUFDeEMsSUFBSSxDQUFDLFdBQVcsR0FBRyxxQkFBcUIsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDbEYsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNwQyxDQUFDO1FBRUQsSUFBSSxxQkFBcUIsRUFBRSxPQUFPLEVBQUUsQ0FBQztZQUNwQyxJQUFJLENBQUMsT0FBTyxHQUFHLHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUMxRSxDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUM7UUFDaEMsQ0FBQztRQUVELElBQUkscUJBQXFCLEVBQUUsU0FBUyxFQUFFLENBQUM7WUFDdEMsSUFBSSxDQUFDLFNBQVMsR0FBRyxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDOUUsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDO1FBQ2pDLENBQUM7SUFDRixDQUFDO0NBQ0Q7QUFtREQ7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBTSxPQUFPLFFBQVE7YUFFTCxrQkFBYSxHQUFHLENBQUMsQUFBSixDQUFLO0lBK0NqQyxJQUFJLGFBQWEsS0FBYSxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMxRCxJQUFJLFlBQVksS0FBYSxPQUFPLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUU1RCxJQUFJLFdBQVcsS0FBeUIsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUNqRixJQUFJLFlBQVksS0FBeUIsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztJQUN0RixJQUFJLGdCQUFnQixLQUFrQixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO0lBQ2xFLElBQUksd0JBQXdCLEtBQWtCLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUczRixJQUFZLG1CQUFtQixLQUFjLE9BQU8sSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztJQUNoRixJQUFZLG1CQUFtQixDQUFDLEtBQWM7UUFDN0MsSUFBSSxLQUFLLEtBQUssSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFDekMsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLEtBQUssSUFBSSxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUN6QyxNQUFNLElBQUksS0FBSyxDQUFDLHVFQUF1RSxDQUFDLENBQUM7UUFDMUYsQ0FBQztRQUVELElBQUksQ0FBQyxvQkFBb0IsR0FBRyxLQUFLLENBQUM7UUFDbEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLHNCQUFzQixFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBRWpGLElBQUksSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFDL0IsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQy9CLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM3QixDQUFDO1lBRUQsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLG1CQUFtQixDQUFDLEVBQUUsS0FBSyxFQUFFLGVBQWUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3JGLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7UUFDM0YsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsNkJBQTZCLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDNUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLG1CQUFtQixDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZHLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUM7UUFDckMsQ0FBQztJQUNGLENBQUM7SUFFRCxZQUNDLFNBQXNCLEVBQ2QsZUFBd0MsRUFDaEQsU0FBb0QsRUFDcEQsVUFBK0IsY0FBYztRQUZyQyxvQkFBZSxHQUFmLGVBQWUsQ0FBeUI7UUFyRnhDLFVBQUssR0FBRyxXQUFXLEVBQUUsUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBUS9DLGNBQVMsR0FBRyxJQUFJLEdBQUcsRUFBbUQsQ0FBQztRQUd2RSxnQkFBVyxHQUFHLENBQUMsQ0FBQztRQUloQixrQkFBYSxHQUFXLENBQUMsQ0FBQztRQUMxQixzQ0FBaUMsR0FBdUIsSUFBSSxDQUFDO1FBQzdELGtDQUE2QixHQUFHLElBQUksT0FBTyxDQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ3RELGFBQVEsR0FBRyxLQUFLLENBQUM7UUFFakIsb0NBQStCLEdBQWdCLFVBQVUsQ0FBQyxJQUFJLENBQUM7UUFDL0QsbUJBQWMsR0FBVyxDQUFDLENBQUM7UUFTM0IsWUFBTyxHQUFZLEtBQUssQ0FBQztRQUl6QixrQ0FBNkIsR0FBZ0IsVUFBVSxDQUFDLElBQUksQ0FBQztRQUM3RCx1QkFBa0IsR0FBZ0IsVUFBVSxDQUFDLElBQUksQ0FBQztRQUNsRCwrQkFBMEIsR0FBZ0IsVUFBVSxDQUFDLElBQUksQ0FBQztRQUlqRCxnQkFBVyxHQUFvQixJQUFJLGVBQWUsRUFBRSxDQUFDO1FBRXJELDhCQUF5QixHQUFHLElBQUksT0FBTyxFQUFVLENBQUM7UUFDbEQsNkJBQXdCLEdBQUcsSUFBSSxPQUFPLEVBQVUsQ0FBQztRQUN6RCw2QkFBd0IsR0FBa0IsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDekgsNEJBQXVCLEdBQWtCLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBU3hILHlCQUFvQixHQUFZLEtBQUssQ0FBQztRQW1DN0MsSUFBSSxPQUFPLENBQUMsbUJBQW1CLElBQUksT0FBTyxDQUFDLHFCQUFxQixFQUFFLENBQUM7WUFDbEUsTUFBTSxJQUFJLEtBQUssQ0FBQyx1RUFBdUUsQ0FBQyxDQUFDO1FBQzFGLENBQUM7UUFFRCxJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQztRQUNoQixJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNoQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLFVBQVUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUU3RCxLQUFLLE1BQU0sUUFBUSxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDbkQsQ0FBQztRQUVELElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFFaEUsSUFBSSxDQUFDLGFBQWEsR0FBRyxDQUFDLENBQUM7UUFDdkIsSUFBSSxDQUFDLGdCQUFnQixHQUFHLENBQUMsQ0FBQztRQUUxQixJQUFJLENBQUMsT0FBTyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDN0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEdBQUcsYUFBYSxDQUFDO1FBRXZDLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDO1FBRTFCLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxlQUFlLEVBQUUsT0FBTyxPQUFPLENBQUMsWUFBWSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFeEgsSUFBSSxDQUFDLG9CQUFvQixHQUFHLE9BQU8sQ0FBQyxtQkFBbUIsSUFBSSxjQUFjLENBQUMsbUJBQW1CLENBQUM7UUFDOUYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLHNCQUFzQixFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBRWpGLElBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxPQUFPLENBQUMsYUFBYSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDO1FBRTlGLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxJQUFJLDZCQUE2QixDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBRTlGLElBQUksQ0FBQyxhQUFhLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsR0FBRyxrQkFBa0IsQ0FBQztRQUVsRCxNQUFNLHFCQUFxQixHQUFHLE9BQU8sQ0FBQyxxQkFBcUIsSUFBSSxjQUFjLENBQUMscUJBQXFCLENBQUM7UUFDcEcsSUFBSSxxQkFBcUIsRUFBRSxDQUFDO1lBQzNCLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyw0QkFBNEIsQ0FBQztZQUNsRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1lBQzdDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxRQUFRLENBQUM7UUFDN0MsQ0FBQztRQUVELElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7UUFFNUQsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLFVBQVUsQ0FBQztZQUNyRCxrQkFBa0IsRUFBRSxJQUFJO1lBQ3hCLG9CQUFvQixFQUFFLENBQUMsT0FBTyxDQUFDLGVBQWUsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2xFLDRCQUE0QixFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsNEJBQTRCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLENBQUM7U0FDN0YsQ0FBQyxDQUFDLENBQUM7UUFDSixJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFO1lBQzdGLHVCQUF1QixFQUFFLE9BQU8sQ0FBQyx1QkFBdUIsSUFBSSxjQUFjLENBQUMsdUJBQXVCO1lBQ2xHLFVBQVUsa0NBQTBCO1lBQ3BDLFFBQVEsRUFBRSxPQUFPLENBQUMsa0JBQWtCLElBQUksY0FBYyxDQUFDLGtCQUFrQjtZQUN6RSxVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVUsSUFBSSxjQUFjLENBQUMsVUFBVTtZQUMzRCwyQkFBMkIsRUFBRSxPQUFPLENBQUMsMkJBQTJCO1lBQ2hFLHFCQUFxQixFQUFFLE9BQU8sQ0FBQyxxQkFBcUI7WUFDcEQsWUFBWSxFQUFFLE9BQU8sQ0FBQyxZQUFZO1NBQ2xDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFFckIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDOUQsU0FBUyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFcEMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDdkUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxjQUFjLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRW5JLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLEVBQUU7WUFDN0YscURBQXFEO1lBQ3JELE1BQU0sT0FBTyxHQUFJLENBQUMsQ0FBQyxNQUFzQixDQUFDO1lBQzFDLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7WUFDdEMsT0FBTyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7WUFDdEIsSUFBSSxPQUFPLENBQUMscUJBQXFCLEVBQUUsQ0FBQztnQkFDbkMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLFdBQVcsQ0FBQyxDQUFDO1lBQ2pELENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakgsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkgsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3RixJQUFJLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUMzQixJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyxzREFBc0QsQ0FBQyxDQUFDO1lBQ3pFLENBQUM7WUFDRCxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEgsQ0FBQztRQUVELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsZ0JBQWdCLElBQUksY0FBYyxDQUFDLGdCQUFnQixDQUFDO1FBQ3BGLElBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksSUFBSSxjQUFjLENBQUMsWUFBWSxDQUFDO1FBQ3hFLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxPQUFPLENBQUMscUJBQXFCLElBQUksY0FBYyxDQUFDLHFCQUFxQixDQUFDO1FBQ25HLElBQUksQ0FBQyxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFbkUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3JFLElBQUksT0FBTyxDQUFDLHFCQUFxQixFQUFFLENBQUM7WUFDbkMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3JDLENBQUM7SUFDRixDQUFDO0lBRU8sbUJBQW1CLENBQUMsU0FBc0I7UUFDakQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsU0FBUyxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUU7WUFDbkUsTUFBTSxPQUFPLEdBQUcsZ0JBQWdCLEVBQXdCLENBQUM7WUFDekQsSUFBSSxJQUFJLENBQUMsYUFBYSxLQUFLLE9BQU8sSUFBSSxPQUFPLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQ3hELElBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDO2dCQUM3QixJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUM1RCxDQUFDO1FBQ0YsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDWCxDQUFDO0lBRU8sc0JBQXNCLENBQUMsT0FBb0IsRUFBRSxTQUFzQjtRQUMxRSwrREFBK0Q7UUFDL0QscUVBQXFFO1FBQ3JFLE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQ3hELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBRXBELE1BQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxHQUFHLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQztRQUV0RCxJQUFJLFNBQVMsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNuQixZQUFZO1lBQ1osSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQyxDQUFDO1FBQy9DLENBQUM7SUFDRixDQUFDO0lBRUQsYUFBYSxDQUFDLE9BQStCO1FBQzVDLElBQUksT0FBTyxDQUFDLGFBQWEsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUN6QyxJQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7WUFDM0MsSUFBSSxDQUFDLGlCQUFpQixDQUFDLG1CQUFtQixDQUFDLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO1FBQ2pGLENBQUM7UUFFRCxJQUFJLE9BQU8sQ0FBQyxlQUFlLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDM0MsSUFBSSxDQUFDLFVBQVUsQ0FBQyx1QkFBdUIsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVFLENBQUM7UUFFRCxJQUFJLE9BQU8sQ0FBQyxtQkFBbUIsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUMvQyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixDQUFDO1FBQ3hELENBQUM7UUFFRCxJQUFJLGlCQUE2RCxDQUFDO1FBRWxFLElBQUksT0FBTyxDQUFDLFlBQVksS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUN4QyxpQkFBaUIsR0FBRyxFQUFFLEdBQUcsQ0FBQyxpQkFBaUIsSUFBSSxFQUFFLENBQUMsRUFBRSxZQUFZLEVBQUUsT0FBTyxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQzFGLENBQUM7UUFFRCxJQUFJLE9BQU8sQ0FBQywyQkFBMkIsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUN2RCxpQkFBaUIsR0FBRyxFQUFFLEdBQUcsQ0FBQyxpQkFBaUIsSUFBSSxFQUFFLENBQUMsRUFBRSwyQkFBMkIsRUFBRSxPQUFPLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztRQUN4SCxDQUFDO1FBRUQsSUFBSSxPQUFPLENBQUMscUJBQXFCLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDakQsaUJBQWlCLEdBQUcsRUFBRSxHQUFHLENBQUMsaUJBQWlCLElBQUksRUFBRSxDQUFDLEVBQUUscUJBQXFCLEVBQUUsT0FBTyxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDNUcsQ0FBQztRQUVELElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUN2QixJQUFJLENBQUMsaUJBQWlCLENBQUMsYUFBYSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDekQsQ0FBQztRQUVELElBQUksT0FBTyxDQUFDLFVBQVUsS0FBSyxTQUFTLElBQUksT0FBTyxDQUFDLFVBQVUsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3pGLHFCQUFxQjtZQUNyQixNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFDdkYsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQztZQUM3RCxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDO1lBRTlDLElBQUksQ0FBQyxNQUFNLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxhQUFhLEdBQUcsTUFBTSxDQUFDLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDMUgsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7WUFFdEMsSUFBSSxDQUFDLGdDQUFnQyxFQUFFLENBQUM7WUFFeEMsSUFBSSxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztnQkFDaEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1lBQzNELENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVELGlDQUFpQyxDQUFDLFlBQThCO1FBQy9ELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxpQ0FBaUMsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUN4RSxDQUFDO0lBRUQsb0NBQW9DLENBQUMsWUFBMEI7UUFDOUQsSUFBSSxDQUFDLGlCQUFpQixDQUFDLG9DQUFvQyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQzNFLENBQUM7SUFFRCxtQkFBbUIsQ0FBQyxLQUFhLEVBQUUsSUFBd0IsRUFBRSxXQUEwQjtRQUN0RixJQUFJLEtBQUssR0FBRyxDQUFDLElBQUksS0FBSyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0MsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQztRQUU1QyxJQUFJLE9BQU8sSUFBSSxLQUFLLFdBQVcsRUFBRSxDQUFDO1lBQ2pDLElBQUksQ0FBQyxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztnQkFDakMsT0FBTyxDQUFDLElBQUksQ0FBQywrQkFBK0IsRUFBRSxJQUFJLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNqRSxPQUFPO1lBQ1IsQ0FBQztZQUVELElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsc0JBQXNCLEdBQUcsU0FBUyxDQUFDO1lBQ3JELElBQUksR0FBRyxZQUFZLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3RELENBQUM7UUFFRCxJQUFJLFlBQVksS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUMzQixPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUV2RixJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7UUFFbkIsSUFBSSxLQUFLLEdBQUcsZUFBZSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ25DLG1FQUFtRTtZQUNuRSxVQUFVLEdBQUcsSUFBSSxHQUFHLFlBQVksQ0FBQztRQUNsQyxDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksV0FBVyxLQUFLLElBQUksSUFBSSxXQUFXLEdBQUcsS0FBSyxJQUFJLFdBQVcsR0FBRyxlQUFlLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ3RGLHFCQUFxQjtnQkFDckIsbURBQW1EO2dCQUNuRCxVQUFVLEdBQUcsSUFBSSxHQUFHLFlBQVksQ0FBQztZQUNsQyxDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsVUFBVSxHQUFHLENBQUMsQ0FBQztZQUNoQixDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBRTlCLElBQUksQ0FBQyxNQUFNLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxhQUFhLEdBQUcsVUFBVSxDQUFDLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDOUgsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFdEMsSUFBSSxDQUFDLGdDQUFnQyxFQUFFLENBQUM7UUFFeEMsSUFBSSxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUNoQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDM0QsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLGlDQUFpQztRQUMzRixDQUFDO0lBQ0YsQ0FBQztJQUVTLGNBQWMsQ0FBQyxVQUFrQjtRQUMxQyxPQUFPLElBQUksUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2pDLENBQUM7SUFFRCxNQUFNLENBQUMsS0FBYSxFQUFFLFdBQW1CLEVBQUUsV0FBeUIsRUFBRTtRQUNyRSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNuQixNQUFNLElBQUksS0FBSyxDQUFDLCtCQUErQixDQUFDLENBQUM7UUFDbEQsQ0FBQztRQUVELElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBRXJCLElBQUksQ0FBQztZQUNKLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ25ELENBQUM7Z0JBQVMsQ0FBQztZQUNWLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1lBQ3RCLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ3pELENBQUM7SUFDRixDQUFDO0lBRU8sT0FBTyxDQUFDLEtBQWEsRUFBRSxXQUFtQixFQUFFLFdBQXlCLEVBQUU7UUFDOUUsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDM0YsTUFBTSxXQUFXLEdBQUcsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLEtBQUssR0FBRyxXQUFXLEVBQUUsQ0FBQztRQUN4RCxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLG1CQUFtQixFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBRXRFLGtEQUFrRDtRQUNsRCxNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztRQUNoRCxLQUFLLElBQUksQ0FBQyxHQUFHLFdBQVcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDL0QsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzQixJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbkMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sRUFBRSxDQUFDO1lBRWpDLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNkLElBQUksSUFBSSxHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUU5QyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBQ1gsSUFBSSxHQUFHLEVBQUUsQ0FBQztvQkFDVixhQUFhLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzFDLENBQUM7Z0JBRUQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUVyRCxJQUFJLFFBQVEsSUFBSSxRQUFRLENBQUMsY0FBYyxFQUFFLENBQUM7b0JBQ3pDLFFBQVEsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7Z0JBQ3hGLENBQUM7Z0JBRUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDeEIsQ0FBQztZQUVELElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDO1lBQ2hCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDO1FBQ25CLENBQUM7UUFFRCxNQUFNLGlCQUFpQixHQUFXLEVBQUUsS0FBSyxFQUFFLEtBQUssR0FBRyxXQUFXLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDekYsTUFBTSx5QkFBeUIsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLGlCQUFpQixFQUFFLG1CQUFtQixDQUFDLENBQUM7UUFDMUYsTUFBTSw0QkFBNEIsR0FBRyxLQUFLLENBQUMsa0JBQWtCLENBQUMsaUJBQWlCLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUV0RyxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFXLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNuRCxFQUFFLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN6QixPQUFPO1lBQ1AsVUFBVSxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQztZQUN2RCxJQUFJLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDO1lBQzdDLEtBQUssRUFBRSxTQUFTO1lBQ2hCLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDO1lBQzNHLHNCQUFzQixFQUFFLFNBQVM7WUFDakMsR0FBRyxFQUFFLElBQUk7WUFDVCxHQUFHLEVBQUUsU0FBUztZQUNkLFVBQVUsRUFBRSxLQUFLO1lBQ2pCLG1CQUFtQixFQUFFLFVBQVUsQ0FBQyxJQUFJO1lBQ3BDLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxJQUFJO1lBQ2xDLEtBQUssRUFBRSxLQUFLO1NBQ1osQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLE9BQW1CLENBQUM7UUFFeEIsZ0VBQWdFO1FBQ2hFLElBQUksS0FBSyxLQUFLLENBQUMsSUFBSSxXQUFXLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNyRCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUM5RCxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ3JDLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO1lBQ3JCLElBQUksQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDO1FBQ3ZCLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLFdBQVcsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNuRCxPQUFPLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUM1RCxDQUFDO1FBRUQsTUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUM7UUFDNUMsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ25GLE1BQU0saUJBQWlCLEdBQUcsS0FBSyxDQUFDLHlCQUF5QixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2xFLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFFcEUsS0FBSyxJQUFJLENBQUMsR0FBRyxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDMUQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3hDLENBQUM7UUFFRCxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsa0JBQWtCLENBQUMsaUJBQWlCLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFFOUUsS0FBSyxNQUFNLEtBQUssSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUNsQyxLQUFLLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDOUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNCLENBQUM7UUFDRixDQUFDO1FBRUQsTUFBTSxvQkFBb0IsR0FBRyw0QkFBNEIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDcEYsTUFBTSxhQUFhLEdBQUcsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLEtBQUssR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDOUQsTUFBTSxZQUFZLEdBQUcsQ0FBQyxhQUFhLEVBQUUsR0FBRyxvQkFBb0IsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7UUFFbEgsS0FBSyxNQUFNLEtBQUssSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUNsQyxLQUFLLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ25ELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzNCLE1BQU0sSUFBSSxHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUNoRCxNQUFNLEdBQUcsR0FBRyxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUM7Z0JBQ3hCLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQzlCLENBQUM7UUFDRixDQUFDO1FBRUQsS0FBSyxNQUFNLElBQUksSUFBSSxhQUFhLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztZQUMzQyxLQUFLLE1BQU0sR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO2dCQUN4QixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN6QixDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksQ0FBQyxnQ0FBZ0MsRUFBRSxDQUFDO1FBRXhDLElBQUksSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7WUFDaEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNuRCxDQUFDO1FBRUQsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFUyxnQ0FBZ0M7UUFDekMsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO1FBQ3hDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQztRQUU1RCxJQUFJLENBQUMsSUFBSSxDQUFDLGlDQUFpQyxFQUFFLENBQUM7WUFDN0MsSUFBSSxDQUFDLGlDQUFpQyxHQUFHLDRCQUE0QixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsR0FBRyxFQUFFO2dCQUNuRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsbUJBQW1CLENBQUMsRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7Z0JBQ2hGLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO2dCQUN6QixJQUFJLENBQUMsaUNBQWlDLEdBQUcsSUFBSSxDQUFDO1lBQy9DLENBQUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQztJQUNGLENBQUM7SUFFTywyQkFBMkI7UUFDbEMsSUFBSSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1lBQy9CLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM1QyxPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQztJQUM1RSxDQUFDO0lBRU8saUJBQWlCO1FBQ3hCLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztZQUMvQixPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksV0FBVyxHQUFHLENBQUMsQ0FBQztRQUVwQixLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUMvQixJQUFJLE9BQU8sSUFBSSxDQUFDLEtBQUssS0FBSyxXQUFXLEVBQUUsQ0FBQztnQkFDdkMsV0FBVyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNqRCxDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1FBQy9CLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLFdBQVcsRUFBRSxXQUFXLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUN4RyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lBRUQsV0FBVyxDQUFDLEtBQWE7UUFDeEIsSUFBSSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsSUFBSSxPQUFPLElBQUksQ0FBQyxXQUFXLEtBQUssV0FBVyxFQUFFLENBQUM7WUFDMUUsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQy9CLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUU1QixJQUFJLE9BQU8sSUFBSSxDQUFDLEtBQUssS0FBSyxXQUFXLElBQUksSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDeEUsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO1lBQzlCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDbkYsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDdEQsQ0FBQztJQUNGLENBQUM7SUFFRCxRQUFRO1FBQ1AsSUFBSSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1lBQ2pDLE9BQU87UUFDUixDQUFDO1FBRUQsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDL0IsSUFBSSxDQUFDLHNCQUFzQixHQUFHLFNBQVMsQ0FBQztRQUN6QyxDQUFDO1FBRUQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQzNELENBQUM7SUFFRCxJQUFJLE1BQU07UUFDVCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBQzFCLENBQUM7SUFFRCxJQUFJLFlBQVk7UUFDZixNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBQ3RFLE9BQU8sZ0JBQWdCLENBQUMsTUFBTSxDQUFDO0lBQ2hDLENBQUM7SUFFRCxJQUFJLGlCQUFpQjtRQUNwQixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDOUUsT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDO0lBQ3BCLENBQUM7SUFFRCxJQUFJLHVCQUF1QjtRQUMxQixNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztRQUNqRCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQy9ELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLGlCQUFpQixHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2xFLElBQUksU0FBUyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDdEIsTUFBTSxlQUFlLEdBQUcsQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFVBQVUsQ0FBQztZQUNsRSxJQUFJLGVBQWUsR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ3RDLE9BQU8saUJBQWlCLEdBQUcsQ0FBQyxDQUFDO1lBQzlCLENBQUM7UUFDRixDQUFDO1FBRUQsT0FBTyxpQkFBaUIsQ0FBQztJQUMxQixDQUFDO0lBRUQsSUFBSSxnQkFBZ0I7UUFDbkIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQzdFLE9BQU8sS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7SUFDdEIsQ0FBQztJQUVELE9BQU8sQ0FBQyxLQUFhO1FBQ3BCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUM7SUFDbEMsQ0FBQztJQUVELE9BQU8sQ0FBQyxPQUFVO1FBQ2pCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxLQUFLLE9BQU8sQ0FBQyxDQUFDO0lBQy9ELENBQUM7SUFFRCxVQUFVLENBQUMsS0FBYTtRQUN2QixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQztRQUNsQyxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDO0lBQzNCLENBQUM7SUFFRCxhQUFhLENBQUMsS0FBYTtRQUMxQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQy9CLENBQUM7SUFFRCxVQUFVLENBQUMsS0FBYTtRQUN2QixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRCxPQUFPLENBQUMsUUFBZ0I7UUFDdkIsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN4QyxDQUFDO0lBRUQsVUFBVSxDQUFDLFFBQWdCO1FBQzFCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUVELE1BQU0sQ0FBQyxNQUFlLEVBQUUsS0FBYztRQUNyQyxNQUFNLGdCQUFnQixHQUF5QjtZQUM5QyxNQUFNLEVBQUUsT0FBTyxNQUFNLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7U0FDNUUsQ0FBQztRQUVGLElBQUksSUFBSSxDQUFDLGlDQUFpQyxFQUFFLENBQUM7WUFDNUMsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2pELElBQUksQ0FBQyxpQ0FBaUMsR0FBRyxJQUFJLENBQUM7WUFDOUMsZ0JBQWdCLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7UUFDbkQsQ0FBQztRQUVELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxtQkFBbUIsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRTdELElBQUksT0FBTyxLQUFLLEtBQUssV0FBVyxFQUFFLENBQUM7WUFDbEMsSUFBSSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7WUFFekIsSUFBSSxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztnQkFDaEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUNuRCxDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLG1CQUFtQixDQUFDO2dCQUMxQyxLQUFLLEVBQUUsT0FBTyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO2FBQ3hFLENBQUMsQ0FBQztRQUNKLENBQUM7SUFDRixDQUFDO0lBRUQsU0FBUztJQUVDLE1BQU0sQ0FBQyxtQkFBMkIsRUFBRSxTQUFpQixFQUFFLFlBQW9CLEVBQUUsVUFBOEIsRUFBRSxXQUErQixFQUFFLG1CQUE0QixLQUFLLEVBQUUsV0FBb0IsS0FBSztRQUNuTixNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUVqRSxNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUMsa0JBQWtCLENBQUMsV0FBVyxFQUFFLG1CQUFtQixDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDNUYsTUFBTSxjQUFjLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDLG1CQUFtQixFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBRWxGLElBQUksZ0JBQWdCLEVBQUUsQ0FBQztZQUN0QixNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLG1CQUFtQixFQUFFLFdBQVcsQ0FBQyxDQUFDO1lBRXpFLEtBQUssSUFBSSxDQUFDLEdBQUcsY0FBYyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsY0FBYyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUNoRSxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDeEMsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUU7WUFDeEIsS0FBSyxNQUFNLEtBQUssSUFBSSxjQUFjLEVBQUUsQ0FBQztnQkFDcEMsS0FBSyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7b0JBQzlDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQ3JDLENBQUM7WUFDRixDQUFDO1lBRUQsS0FBSyxNQUFNLEtBQUssSUFBSSxjQUFjLEVBQUUsQ0FBQztnQkFDcEMsS0FBSyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO29CQUNuRCxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN6QixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxVQUFVLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLElBQUksVUFBVSxJQUFJLENBQUM7UUFDcEQsQ0FBQztRQUVELElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxJQUFJLFNBQVMsSUFBSSxDQUFDO1FBRWpELElBQUksSUFBSSxDQUFDLG1CQUFtQixJQUFJLFdBQVcsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUMzRCxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztRQUNqRixDQUFDO1FBRUQsSUFBSSxDQUFDLGFBQWEsR0FBRyxTQUFTLENBQUM7UUFDL0IsSUFBSSxDQUFDLGdCQUFnQixHQUFHLFlBQVksQ0FBQztJQUN0QyxDQUFDO0lBRUQsaUJBQWlCO0lBRVQsZUFBZSxDQUFDLEtBQWEsRUFBRSxHQUFVO1FBQ2hELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFL0IsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNmLElBQUksR0FBRyxFQUFFLENBQUM7Z0JBQ1QsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7Z0JBQ2YsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7WUFDbkIsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDakQsSUFBSSxDQUFDLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDO2dCQUN0QixJQUFJLENBQUMsS0FBSyxLQUFLLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQztZQUNqRCxDQUFDO1FBQ0YsQ0FBQztRQUVELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLFVBQVUsQ0FBQztRQUM1RSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRTVDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ25FLE1BQU0sV0FBVyxHQUFHLENBQUMsS0FBOEIsRUFBRSxFQUFFLENBQUMsS0FBSyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXRHLElBQUksT0FBTyxPQUFPLEtBQUssU0FBUyxJQUFJLE9BQU8sS0FBSyxPQUFPLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsY0FBYyxFQUFFLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7YUFBTSxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ3BCLE1BQU0sTUFBTSxHQUFHLENBQUMsS0FBOEIsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLGNBQWMsRUFBRSxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUN0SCxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3RCLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUMzRSxDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDbkQsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxPQUFPLElBQUksSUFBSSxDQUFDO1lBQ3JFLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsYUFBYSxLQUFLLElBQUksQ0FBQyxhQUFhLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLEtBQUssYUFBYSxFQUFFLENBQUM7Z0JBQ3BILElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1lBQ2xFLENBQUM7WUFDRCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNwQixDQUFDO1FBRUQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFbEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRXJELElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNmLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7UUFFRCxRQUFRLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBRTNGLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM5QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDbkMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUM7UUFFbkMsSUFBSSxHQUFHLEVBQUUsQ0FBQztZQUNULElBQUksQ0FBQyxtQkFBbUIsR0FBRyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDdEksQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzVCLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1FBQ3BDLENBQUM7SUFDRixDQUFDO0lBRU8sZ0JBQWdCLENBQUMsSUFBYztRQUN0QyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDcEMsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLGFBQWEsQ0FBQztRQUM3QyxJQUFJLENBQUMsS0FBSyxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQy9DLE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFN0UsSUFBSSxLQUFLLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDdkIsSUFBSSxDQUFDLEtBQUssSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzdDLENBQUM7UUFFRCxJQUFJLEtBQUssQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUN4QixJQUFJLENBQUMsS0FBSyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDOUMsQ0FBQztRQUVELElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO0lBQ25DLENBQUM7SUFFTyxlQUFlLENBQUMsSUFBYyxFQUFFLEtBQWE7UUFDcEQsSUFBSSxDQUFDLEdBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztRQUU1RCxJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUN2QixJQUFJLENBQUMsR0FBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDO1FBQ25ELENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQzNCLElBQUksQ0FBQyxHQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUM7UUFDdkQsQ0FBQztRQUVELElBQUksQ0FBQyxHQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxZQUFZLEVBQUUsR0FBRyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQ3pELElBQUksQ0FBQyxHQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsRUFBRSxLQUFLLEtBQUssSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDbEcsSUFBSSxDQUFDLEdBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLGFBQWEsRUFBRSxLQUFLLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNoRixJQUFJLENBQUMsR0FBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEksSUFBSSxDQUFDLEdBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLGVBQWUsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNySCxJQUFJLENBQUMsR0FBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUVsRSxJQUFJLENBQUMsR0FBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDcEUsQ0FBQztJQUVPLGlCQUFpQixDQUFDLEtBQWEsRUFBRSxRQUFrQjtRQUMxRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQy9CLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNuQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxFQUFFLENBQUM7UUFFakMsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDZCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFFckQsSUFBSSxRQUFRLElBQUksUUFBUSxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUN6QyxRQUFRLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUN0RyxDQUFDO1lBRUQsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzdCLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1FBQ3BDLENBQUM7SUFDRixDQUFDO0lBRUQsWUFBWTtRQUNYLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQ2xFLE9BQU8sY0FBYyxDQUFDLFNBQVMsQ0FBQztJQUNqQyxDQUFDO0lBRUQsWUFBWSxDQUFDLFNBQWlCLEVBQUUsY0FBd0I7UUFDdkQsSUFBSSxJQUFJLENBQUMsaUNBQWlDLEVBQUUsQ0FBQztZQUM1QyxJQUFJLENBQUMsaUNBQWlDLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDakQsSUFBSSxDQUFDLGlDQUFpQyxHQUFHLElBQUksQ0FBQztZQUM5QyxJQUFJLENBQUMsaUJBQWlCLENBQUMsbUJBQW1CLENBQUMsRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7UUFDakYsQ0FBQztRQUVELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsQ0FBQyxDQUFDO0lBQ3pFLENBQUM7SUFFRCxhQUFhO1FBQ1osTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDbEUsT0FBTyxjQUFjLENBQUMsVUFBVSxDQUFDO0lBQ2xDLENBQUM7SUFFRCxhQUFhLENBQUMsVUFBa0I7UUFDL0IsSUFBSSxJQUFJLENBQUMsaUNBQWlDLEVBQUUsQ0FBQztZQUM1QyxJQUFJLENBQUMsaUNBQWlDLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDakQsSUFBSSxDQUFDLGlDQUFpQyxHQUFHLElBQUksQ0FBQztZQUM5QyxJQUFJLENBQUMsaUJBQWlCLENBQUMsbUJBQW1CLENBQUMsRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7UUFDL0UsQ0FBQztRQUVELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDMUQsQ0FBQztJQUdELElBQUksU0FBUztRQUNaLE9BQU8sSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQzVCLENBQUM7SUFFRCxJQUFJLFNBQVMsQ0FBQyxTQUFpQjtRQUM5QixJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFRCxJQUFJLFlBQVk7UUFDZixPQUFPLElBQUksQ0FBQyxhQUFhLEdBQUcsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztJQUN0RixDQUFDO0lBRUQsU0FBUztJQUVBLElBQUksWUFBWSxLQUFnQyxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNuTCxJQUFJLGVBQWUsS0FBZ0MsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDekwsSUFBSSxrQkFBa0IsS0FBZ0MsT0FBTyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBZSxDQUFDLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNVEsSUFBSSxTQUFTLEtBQWdDLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xMLElBQUksV0FBVyxLQUFnQyxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN0TCxJQUFJLFdBQVcsS0FBZ0MsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdEwsSUFBSSxXQUFXLEtBQWdDLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RMLElBQUksVUFBVSxLQUFnQyxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwTCxJQUFJLGFBQWEsS0FBdUQsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFnRCxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENB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