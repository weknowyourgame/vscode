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
import { getWindow, h, scheduleAtNextAnimationFrame } from '../../../../base/browser/dom.js';
import { SmoothScrollableElement } from '../../../../base/browser/ui/scrollbar/scrollableElement.js';
import { compareBy, numberComparator } from '../../../../base/common/arrays.js';
import { findFirstMax } from '../../../../base/common/arraysFind.js';
import { BugIndicatingError } from '../../../../base/common/errors.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, autorunWithStore, derived, disposableObservableValue, globalTransaction, observableFromEvent, observableValue, transaction } from '../../../../base/common/observable.js';
import { Scrollable } from '../../../../base/common/scrollable.js';
import { localize } from '../../../../nls.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { OffsetRange } from '../../../common/core/ranges/offsetRange.js';
import { Selection } from '../../../common/core/selection.js';
import { EditorContextKeys } from '../../../common/editorContextKeys.js';
import { ObservableElementSizeObserver } from '../diffEditor/utils.js';
import { DiffEditorItemTemplate, TemplateData } from './diffEditorItemTemplate.js';
import { ObjectPool } from './objectPool.js';
import './style.css';
let MultiDiffEditorWidgetImpl = class MultiDiffEditorWidgetImpl extends Disposable {
    constructor(_element, _dimension, _viewModel, _workbenchUIElementFactory, _parentContextKeyService, _parentInstantiationService) {
        super();
        this._element = _element;
        this._dimension = _dimension;
        this._viewModel = _viewModel;
        this._workbenchUIElementFactory = _workbenchUIElementFactory;
        this._parentContextKeyService = _parentContextKeyService;
        this._parentInstantiationService = _parentInstantiationService;
        this._scrollableElements = h('div.scrollContent', [
            h('div@content', {
                style: {
                    overflow: 'hidden',
                }
            }),
            h('div.monaco-editor@overflowWidgetsDomNode', {}),
        ]);
        this._scrollable = this._register(new Scrollable({
            forceIntegerValues: false,
            scheduleAtNextAnimationFrame: (cb) => scheduleAtNextAnimationFrame(getWindow(this._element), cb),
            smoothScrollDuration: 100,
        }));
        this._scrollableElement = this._register(new SmoothScrollableElement(this._scrollableElements.root, {
            vertical: 1 /* ScrollbarVisibility.Auto */,
            horizontal: 1 /* ScrollbarVisibility.Auto */,
            useShadows: false,
        }, this._scrollable));
        this._elements = h('div.monaco-component.multiDiffEditor', {}, [
            h('div', {}, [this._scrollableElement.getDomNode()]),
            h('div.placeholder@placeholder', {}, [h('div')]),
        ]);
        this._sizeObserver = this._register(new ObservableElementSizeObserver(this._element, undefined));
        this._objectPool = this._register(new ObjectPool((data) => {
            const template = this._instantiationService.createInstance(DiffEditorItemTemplate, this._scrollableElements.content, this._scrollableElements.overflowWidgetsDomNode, this._workbenchUIElementFactory);
            template.setData(data);
            return template;
        }));
        this.scrollTop = observableFromEvent(this, this._scrollableElement.onScroll, () => /** @description scrollTop */ this._scrollableElement.getScrollPosition().scrollTop);
        this.scrollLeft = observableFromEvent(this, this._scrollableElement.onScroll, () => /** @description scrollLeft */ this._scrollableElement.getScrollPosition().scrollLeft);
        this._viewItemsInfo = derived(this, (reader) => {
            const vm = this._viewModel.read(reader);
            if (!vm) {
                return { items: [], getItem: _d => { throw new BugIndicatingError(); } };
            }
            const viewModels = vm.items.read(reader);
            const map = new Map();
            const items = viewModels.map(d => {
                const item = reader.store.add(new VirtualizedViewItem(d, this._objectPool, this.scrollLeft, delta => {
                    this._scrollableElement.setScrollPosition({ scrollTop: this._scrollableElement.getScrollPosition().scrollTop + delta });
                }));
                const data = this._lastDocStates?.[item.getKey()];
                if (data) {
                    transaction(tx => {
                        item.setViewState(data, tx);
                    });
                }
                map.set(d, item);
                return item;
            });
            return { items, getItem: d => map.get(d) };
        });
        this._viewItems = this._viewItemsInfo.map(this, items => items.items);
        this._spaceBetweenPx = 0;
        this._totalHeight = this._viewItems.map(this, (items, reader) => items.reduce((r, i) => r + i.contentHeight.read(reader) + this._spaceBetweenPx, 0));
        this.activeControl = derived(this, reader => {
            const activeDiffItem = this._viewModel.read(reader)?.activeDiffItem.read(reader);
            if (!activeDiffItem) {
                return undefined;
            }
            const viewItem = this._viewItemsInfo.read(reader).getItem(activeDiffItem);
            return viewItem.template.read(reader)?.editor;
        });
        this._contextKeyService = this._register(this._parentContextKeyService.createScoped(this._element));
        this._instantiationService = this._register(this._parentInstantiationService.createChild(new ServiceCollection([IContextKeyService, this._contextKeyService])));
        this._contextKeyService.createKey(EditorContextKeys.inMultiDiffEditor.key, true);
        this._lastDocStates = {};
        this._register(autorunWithStore((reader, store) => {
            const viewModel = this._viewModel.read(reader);
            if (viewModel && viewModel.contextKeys) {
                for (const [key, value] of Object.entries(viewModel.contextKeys)) {
                    const contextKey = this._contextKeyService.createKey(key, undefined);
                    contextKey.set(value);
                    store.add(toDisposable(() => contextKey.reset()));
                }
            }
        }));
        const ctxAllCollapsed = this._parentContextKeyService.createKey(EditorContextKeys.multiDiffEditorAllCollapsed.key, false);
        this._register(autorun((reader) => {
            const viewModel = this._viewModel.read(reader);
            if (viewModel) {
                const allCollapsed = viewModel.items.read(reader).every(item => item.collapsed.read(reader));
                ctxAllCollapsed.set(allCollapsed);
            }
        }));
        this._register(autorun((reader) => {
            /** @description Update widget dimension */
            const dimension = this._dimension.read(reader);
            this._sizeObserver.observe(dimension);
        }));
        const placeholderMessage = derived(reader => {
            const items = this._viewItems.read(reader);
            if (items.length > 0) {
                return undefined;
            }
            const vm = this._viewModel.read(reader);
            return (!vm || vm.isLoading.read(reader))
                ? localize('loading', 'Loading...')
                : localize('noChangedFiles', 'No Changed Files');
        });
        this._register(autorun((reader) => {
            const message = placeholderMessage.read(reader);
            this._elements.placeholder.innerText = message ?? '';
            this._elements.placeholder.classList.toggle('visible', !!message);
        }));
        this._scrollableElements.content.style.position = 'relative';
        this._register(autorun((reader) => {
            /** @description Update scroll dimensions */
            const height = this._sizeObserver.height.read(reader);
            this._scrollableElements.root.style.height = `${height}px`;
            const totalHeight = this._totalHeight.read(reader);
            this._scrollableElements.content.style.height = `${totalHeight}px`;
            const width = this._sizeObserver.width.read(reader);
            let scrollWidth = width;
            const viewItems = this._viewItems.read(reader);
            const max = findFirstMax(viewItems, compareBy(i => i.maxScroll.read(reader).maxScroll, numberComparator));
            if (max) {
                const maxScroll = max.maxScroll.read(reader);
                scrollWidth = width + maxScroll.maxScroll;
            }
            this._scrollableElement.setScrollDimensions({
                width: width,
                height: height,
                scrollHeight: totalHeight,
                scrollWidth,
            });
        }));
        _element.replaceChildren(this._elements.root);
        this._register(toDisposable(() => {
            _element.replaceChildren();
        }));
        // Automatically select the first change in the first file when items are loaded
        this._register(autorun(reader => {
            /** @description Initialize first change */
            const viewModel = this._viewModel.read(reader);
            if (!viewModel) {
                return;
            }
            // Only initialize when loading is complete
            if (!viewModel.isLoading.read(reader)) {
                const items = viewModel.items.read(reader);
                if (items.length === 0) {
                    return;
                }
                // Only initialize if there's no active item yet
                const activeDiffItem = viewModel.activeDiffItem.read(reader);
                if (activeDiffItem) {
                    return;
                }
                // Navigate to the first change using the existing navigation logic
                this.goToNextChange();
            }
        }));
        this._register(this._register(autorun(reader => {
            /** @description Render all */
            globalTransaction(tx => {
                this.render(reader);
            });
        })));
    }
    setScrollState(scrollState) {
        this._scrollableElement.setScrollPosition({ scrollLeft: scrollState.left, scrollTop: scrollState.top });
    }
    reveal(resource, options) {
        const viewItems = this._viewItems.get();
        const index = viewItems.findIndex((item) => item.viewModel.originalUri?.toString() === resource.original?.toString()
            && item.viewModel.modifiedUri?.toString() === resource.modified?.toString());
        if (index === -1) {
            throw new BugIndicatingError('Resource not found in diff editor');
        }
        const viewItem = viewItems[index];
        this._viewModel.get().activeDiffItem.setCache(viewItem.viewModel, undefined);
        let scrollTop = 0;
        for (let i = 0; i < index; i++) {
            scrollTop += viewItems[i].contentHeight.get() + this._spaceBetweenPx;
        }
        this._scrollableElement.setScrollPosition({ scrollTop });
        const diffEditor = viewItem.template.get()?.editor;
        const editor = 'original' in resource ? diffEditor?.getOriginalEditor() : diffEditor?.getModifiedEditor();
        if (editor && options?.range) {
            editor.revealRangeInCenter(options.range);
            highlightRange(editor, options.range);
        }
    }
    getViewState() {
        return {
            scrollState: {
                top: this.scrollTop.get(),
                left: this.scrollLeft.get(),
            },
            docStates: Object.fromEntries(this._viewItems.get().map(i => [i.getKey(), i.getViewState()])),
        };
    }
    setViewState(viewState) {
        this.setScrollState(viewState.scrollState);
        this._lastDocStates = viewState.docStates;
        transaction(tx => {
            /** setViewState */
            if (viewState.docStates) {
                for (const i of this._viewItems.get()) {
                    const state = viewState.docStates[i.getKey()];
                    if (state) {
                        i.setViewState(state, tx);
                    }
                }
            }
        });
    }
    findDocumentDiffItem(resource) {
        const item = this._viewItems.get().find(v => v.viewModel.diffEditorViewModel.model.modified.uri.toString() === resource.toString()
            || v.viewModel.diffEditorViewModel.model.original.uri.toString() === resource.toString());
        return item?.viewModel.documentDiffItem;
    }
    tryGetCodeEditor(resource) {
        const item = this._viewItems.get().find(v => v.viewModel.diffEditorViewModel.model.modified.uri.toString() === resource.toString()
            || v.viewModel.diffEditorViewModel.model.original.uri.toString() === resource.toString());
        const editor = item?.template.get()?.editor;
        if (!editor) {
            return undefined;
        }
        if (item.viewModel.diffEditorViewModel.model.modified.uri.toString() === resource.toString()) {
            return { diffEditor: editor, editor: editor.getModifiedEditor() };
        }
        else {
            return { diffEditor: editor, editor: editor.getOriginalEditor() };
        }
    }
    goToNextChange() {
        this._navigateToChange('next');
    }
    goToPreviousChange() {
        this._navigateToChange('previous');
    }
    _navigateToChange(direction) {
        const viewItems = this._viewItems.get();
        if (viewItems.length === 0) {
            return;
        }
        const activeViewModel = this._viewModel.get()?.activeDiffItem.get();
        const currentIndex = activeViewModel ? viewItems.findIndex(v => v.viewModel === activeViewModel) : -1;
        // Start with first file if no active item
        if (currentIndex === -1) {
            this._goToFile(0, 'first');
            return;
        }
        // Try current file first - expand if collapsed
        const currentItem = viewItems[currentIndex];
        if (currentItem.viewModel.collapsed.get()) {
            currentItem.viewModel.collapsed.set(false, undefined);
        }
        const editor = currentItem.template.get()?.editor;
        if (editor?.getDiffComputationResult()?.changes2?.length) {
            const pos = editor.getModifiedEditor().getPosition()?.lineNumber || 1;
            const changes = editor.getDiffComputationResult().changes2;
            const hasNext = direction === 'next' ? changes.some(c => c.modified.startLineNumber > pos) : changes.some(c => c.modified.endLineNumberExclusive <= pos);
            if (hasNext) {
                editor.goToDiff(direction);
                return;
            }
        }
        // Move to next/previous file
        const nextIndex = (currentIndex + (direction === 'next' ? 1 : -1) + viewItems.length) % viewItems.length;
        this._goToFile(nextIndex, direction === 'next' ? 'first' : 'last');
    }
    _goToFile(index, position) {
        const item = this._viewItems.get()[index];
        if (item.viewModel.collapsed.get()) {
            item.viewModel.collapsed.set(false, undefined);
        }
        this.reveal({ original: item.viewModel.originalUri, modified: item.viewModel.modifiedUri });
        const editor = item.template.get()?.editor;
        if (editor?.getDiffComputationResult()?.changes2?.length) {
            if (position === 'first') {
                editor.revealFirstDiff();
            }
            else {
                const lastChange = editor.getDiffComputationResult().changes2.at(-1);
                const modifiedEditor = editor.getModifiedEditor();
                modifiedEditor.setPosition({ lineNumber: lastChange.modified.startLineNumber, column: 1 });
                modifiedEditor.revealLineInCenter(lastChange.modified.startLineNumber);
            }
        }
        editor?.focus();
    }
    render(reader) {
        const scrollTop = this.scrollTop.read(reader);
        let contentScrollOffsetToScrollOffset = 0;
        let itemHeightSumBefore = 0;
        let itemContentHeightSumBefore = 0;
        const viewPortHeight = this._sizeObserver.height.read(reader);
        const contentViewPort = OffsetRange.ofStartAndLength(scrollTop, viewPortHeight);
        const width = this._sizeObserver.width.read(reader);
        for (const v of this._viewItems.read(reader)) {
            const itemContentHeight = v.contentHeight.read(reader);
            const itemHeight = Math.min(itemContentHeight, viewPortHeight);
            const itemRange = OffsetRange.ofStartAndLength(itemHeightSumBefore, itemHeight);
            const itemContentRange = OffsetRange.ofStartAndLength(itemContentHeightSumBefore, itemContentHeight);
            if (itemContentRange.isBefore(contentViewPort)) {
                contentScrollOffsetToScrollOffset -= itemContentHeight - itemHeight;
                v.hide();
            }
            else if (itemContentRange.isAfter(contentViewPort)) {
                v.hide();
            }
            else {
                const scroll = Math.max(0, Math.min(contentViewPort.start - itemContentRange.start, itemContentHeight - itemHeight));
                contentScrollOffsetToScrollOffset -= scroll;
                const viewPort = OffsetRange.ofStartAndLength(scrollTop + contentScrollOffsetToScrollOffset, viewPortHeight);
                v.render(itemRange, scroll, width, viewPort);
            }
            itemHeightSumBefore += itemHeight + this._spaceBetweenPx;
            itemContentHeightSumBefore += itemContentHeight + this._spaceBetweenPx;
        }
        this._scrollableElements.content.style.transform = `translateY(${-(scrollTop + contentScrollOffsetToScrollOffset)}px)`;
    }
};
MultiDiffEditorWidgetImpl = __decorate([
    __param(4, IContextKeyService),
    __param(5, IInstantiationService)
], MultiDiffEditorWidgetImpl);
export { MultiDiffEditorWidgetImpl };
function highlightRange(targetEditor, range) {
    const modelNow = targetEditor.getModel();
    const decorations = targetEditor.createDecorationsCollection([{ range, options: { description: 'symbol-navigate-action-highlight', className: 'symbolHighlight' } }]);
    setTimeout(() => {
        if (targetEditor.getModel() === modelNow) {
            decorations.clear();
        }
    }, 350);
}
class VirtualizedViewItem extends Disposable {
    constructor(viewModel, _objectPool, _scrollLeft, _deltaScrollVertical) {
        super();
        this.viewModel = viewModel;
        this._objectPool = _objectPool;
        this._scrollLeft = _scrollLeft;
        this._deltaScrollVertical = _deltaScrollVertical;
        this._templateRef = this._register(disposableObservableValue(this, undefined));
        this.contentHeight = derived(this, reader => this._templateRef.read(reader)?.object.contentHeight?.read(reader) ?? this.viewModel.lastTemplateData.read(reader).contentHeight);
        this.maxScroll = derived(this, reader => this._templateRef.read(reader)?.object.maxScroll.read(reader) ?? { maxScroll: 0, scrollWidth: 0 });
        this.template = derived(this, reader => this._templateRef.read(reader)?.object);
        this._isHidden = observableValue(this, false);
        this._isFocused = derived(this, reader => this.template.read(reader)?.isFocused.read(reader) ?? false);
        this.viewModel.setIsFocused(this._isFocused, undefined);
        this._register(autorun((reader) => {
            const scrollLeft = this._scrollLeft.read(reader);
            this._templateRef.read(reader)?.object.setScrollLeft(scrollLeft);
        }));
        this._register(autorun(reader => {
            const ref = this._templateRef.read(reader);
            if (!ref) {
                return;
            }
            const isHidden = this._isHidden.read(reader);
            if (!isHidden) {
                return;
            }
            const isFocused = ref.object.isFocused.read(reader);
            if (isFocused) {
                return;
            }
            this._clear();
        }));
    }
    dispose() {
        this._clear();
        super.dispose();
    }
    toString() {
        return `VirtualViewItem(${this.viewModel.documentDiffItem.modified?.uri.toString()})`;
    }
    getKey() {
        return this.viewModel.getKey();
    }
    getViewState() {
        transaction(tx => {
            this._updateTemplateData(tx);
        });
        return {
            collapsed: this.viewModel.collapsed.get(),
            selections: this.viewModel.lastTemplateData.get().selections,
        };
    }
    setViewState(viewState, tx) {
        this.viewModel.collapsed.set(viewState.collapsed, tx);
        this._updateTemplateData(tx);
        const data = this.viewModel.lastTemplateData.get();
        const selections = viewState.selections?.map(Selection.liftSelection);
        this.viewModel.lastTemplateData.set({
            ...data,
            selections,
        }, tx);
        const ref = this._templateRef.get();
        if (ref) {
            if (selections) {
                ref.object.editor.setSelections(selections);
            }
        }
    }
    _updateTemplateData(tx) {
        const ref = this._templateRef.get();
        if (!ref) {
            return;
        }
        this.viewModel.lastTemplateData.set({
            contentHeight: ref.object.contentHeight.get(),
            selections: ref.object.editor.getSelections() ?? undefined,
        }, tx);
    }
    _clear() {
        const ref = this._templateRef.get();
        if (!ref) {
            return;
        }
        transaction(tx => {
            this._updateTemplateData(tx);
            ref.object.hide();
            this._templateRef.set(undefined, tx);
        });
    }
    hide() {
        this._isHidden.set(true, undefined);
    }
    render(verticalSpace, offset, width, viewPort) {
        this._isHidden.set(false, undefined);
        let ref = this._templateRef.get();
        if (!ref) {
            ref = this._objectPool.getUnusedObj(new TemplateData(this.viewModel, this._deltaScrollVertical));
            this._templateRef.set(ref, undefined);
            const selections = this.viewModel.lastTemplateData.get().selections;
            if (selections) {
                ref.object.editor.setSelections(selections);
            }
        }
        ref.object.render(verticalSpace, width, offset, viewPort);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVsdGlEaWZmRWRpdG9yV2lkZ2V0SW1wbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvbXVsdGlEaWZmRWRpdG9yL211bHRpRGlmZkVkaXRvcldpZGdldEltcGwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFhLFNBQVMsRUFBRSxDQUFDLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN4RyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNyRyxPQUFPLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxVQUFVLEVBQWMsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDNUYsT0FBTyxFQUFzQyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsT0FBTyxFQUFFLHlCQUF5QixFQUFFLGlCQUFpQixFQUFFLG1CQUFtQixFQUFFLGVBQWUsRUFBRSxXQUFXLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoTyxPQUFPLEVBQUUsVUFBVSxFQUF1QixNQUFNLHVDQUF1QyxDQUFDO0FBRXhGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQW1CLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFM0csT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0VBQWdFLENBQUM7QUFDbkcsT0FBTyxFQUFFLFdBQVcs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