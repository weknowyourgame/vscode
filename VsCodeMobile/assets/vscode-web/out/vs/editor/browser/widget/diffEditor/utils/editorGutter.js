/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { h, reset } from '../../../../../base/browser/dom.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun, observableFromEvent, observableSignal, observableSignalFromEvent, observableValue, transaction } from '../../../../../base/common/observable.js';
import { LineRange } from '../../../../common/core/ranges/lineRange.js';
import { OffsetRange } from '../../../../common/core/ranges/offsetRange.js';
export class EditorGutter extends Disposable {
    constructor(_editor, _domNode, itemProvider) {
        super();
        this._editor = _editor;
        this._domNode = _domNode;
        this.itemProvider = itemProvider;
        this.scrollTop = observableFromEvent(this, this._editor.onDidScrollChange, (e) => /** @description editor.onDidScrollChange */ this._editor.getScrollTop());
        this.isScrollTopZero = this.scrollTop.map((scrollTop) => /** @description isScrollTopZero */ scrollTop === 0);
        this.modelAttached = observableFromEvent(this, this._editor.onDidChangeModel, (e) => /** @description editor.onDidChangeModel */ this._editor.hasModel());
        this.editorOnDidChangeViewZones = observableSignalFromEvent('onDidChangeViewZones', this._editor.onDidChangeViewZones);
        this.editorOnDidContentSizeChange = observableSignalFromEvent('onDidContentSizeChange', this._editor.onDidContentSizeChange);
        this.domNodeSizeChanged = observableSignal('domNodeSizeChanged');
        this.views = new Map();
        this._domNode.className = 'gutter monaco-editor';
        const scrollDecoration = this._domNode.appendChild(h('div.scroll-decoration', { role: 'presentation', ariaHidden: 'true', style: { width: '100%' } })
            .root);
        const o = new ResizeObserver(() => {
            transaction(tx => {
                /** @description ResizeObserver: size changed */
                this.domNodeSizeChanged.trigger(tx);
            });
        });
        o.observe(this._domNode);
        this._register(toDisposable(() => o.disconnect()));
        this._register(autorun(reader => {
            /** @description update scroll decoration */
            scrollDecoration.className = this.isScrollTopZero.read(reader) ? '' : 'scroll-decoration';
        }));
        this._register(autorun(reader => /** @description EditorGutter.Render */ this.render(reader)));
    }
    dispose() {
        super.dispose();
        reset(this._domNode);
    }
    render(reader) {
        if (!this.modelAttached.read(reader)) {
            return;
        }
        this.domNodeSizeChanged.read(reader);
        this.editorOnDidChangeViewZones.read(reader);
        this.editorOnDidContentSizeChange.read(reader);
        const scrollTop = this.scrollTop.read(reader);
        const visibleRanges = this._editor.getVisibleRanges();
        const unusedIds = new Set(this.views.keys());
        const viewRange = OffsetRange.ofStartAndLength(0, this._domNode.clientHeight);
        if (!viewRange.isEmpty) {
            for (const visibleRange of visibleRanges) {
                const visibleRange2 = new LineRange(visibleRange.startLineNumber, visibleRange.endLineNumber + 1);
                const gutterItems = this.itemProvider.getIntersectingGutterItems(visibleRange2, reader);
                transaction(tx => {
                    /** EditorGutter.render */
                    for (const gutterItem of gutterItems) {
                        if (!gutterItem.range.intersect(visibleRange2)) {
                            continue;
                        }
                        unusedIds.delete(gutterItem.id);
                        let view = this.views.get(gutterItem.id);
                        if (!view) {
                            const viewDomNode = document.createElement('div');
                            this._domNode.appendChild(viewDomNode);
                            const gutterItemObs = observableValue('item', gutterItem);
                            const itemView = this.itemProvider.createView(gutterItemObs, viewDomNode);
                            view = new ManagedGutterItemView(gutterItemObs, itemView, viewDomNode);
                            this.views.set(gutterItem.id, view);
                        }
                        else {
                            view.item.set(gutterItem, tx);
                        }
                        const top = gutterItem.range.startLineNumber <= this._editor.getModel().getLineCount()
                            ? this._editor.getTopForLineNumber(gutterItem.range.startLineNumber, true) - scrollTop
                            : gutterItem.range.startLineNumber > 1
                                ? this._editor.getBottomForLineNumber(gutterItem.range.startLineNumber - 1, false) - scrollTop
                                : 0;
                        const bottom = gutterItem.range.endLineNumberExclusive === 1 ?
                            Math.max(top, this._editor.getTopForLineNumber(gutterItem.range.startLineNumber, false) - scrollTop)
                            : Math.max(top, this._editor.getBottomForLineNumber(gutterItem.range.endLineNumberExclusive - 1, true) - scrollTop);
                        const height = bottom - top;
                        view.domNode.style.top = `${top}px`;
                        view.domNode.style.height = `${height}px`;
                        view.gutterItemView.layout(OffsetRange.ofStartAndLength(top, height), viewRange);
                    }
                });
            }
        }
        for (const id of unusedIds) {
            const view = this.views.get(id);
            view.gutterItemView.dispose();
            view.domNode.remove();
            this.views.delete(id);
        }
    }
}
class ManagedGutterItemView {
    constructor(item, gutterItemView, domNode) {
        this.item = item;
        this.gutterItemView = gutterItemView;
        this.domNode = domNode;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yR3V0dGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9icm93c2VyL3dpZGdldC9kaWZmRWRpdG9yL3V0aWxzL2VkaXRvckd1dHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxVQUFVLEVBQWUsWUFBWSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDaEcsT0FBTyxFQUFFLE9BQU8sRUFBNkMsbUJBQW1CLEVBQUUsZ0JBQWdCLEVBQUUseUJBQXlCLEVBQUUsZUFBZSxFQUFFLFdBQVcsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRTlNLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFFNUUsTUFBTSxPQUFPLFlBQTBELFNBQVEsVUFBVTtJQVN4RixZQUNrQixPQUF5QixFQUN6QixRQUFxQixFQUNyQixZQUFvQztRQUVyRCxLQUFLLEVBQUUsQ0FBQztRQUpTLFlBQU8sR0FBUCxPQUFPLENBQWtCO1FBQ3pCLGFBQVEsR0FBUixRQUFRLENBQWE7UUFDckIsaUJBQVksR0FBWixZQUFZLENBQXdCO1FBR3JELElBQUksQ0FBQyxTQUFTLEdBQUcsbUJBQW1CLENBQUMsSUFBSSxFQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixFQUM5QixDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsNENBQTRDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FDL0UsQ0FBQztRQUNGLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFD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