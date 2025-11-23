/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { h, reset } from '../../../../../base/browser/dom.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun, observableFromEvent, observableSignal, observableSignalFromEvent, transaction } from '../../../../../base/common/observable.js';
import { MergeEditorLineRange } from '../model/lineRange.js';
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
        if (visibleRanges.length > 0) {
            const visibleRange = visibleRanges[0];
            const visibleRange2 = MergeEditorLineRange.fromLength(visibleRange.startLineNumber, visibleRange.endLineNumber - visibleRange.startLineNumber).deltaEnd(1);
            const gutterItems = this.itemProvider.getIntersectingGutterItems(visibleRange2, reader);
            for (const gutterItem of gutterItems) {
                if (!gutterItem.range.intersectsOrTouches(visibleRange2)) {
                    continue;
                }
                unusedIds.delete(gutterItem.id);
                let view = this.views.get(gutterItem.id);
                if (!view) {
                    const viewDomNode = document.createElement('div');
                    this._domNode.appendChild(viewDomNode);
                    const itemView = this.itemProvider.createView(gutterItem, viewDomNode);
                    view = new ManagedGutterItemView(itemView, viewDomNode);
                    this.views.set(gutterItem.id, view);
                }
                else {
                    view.gutterItemView.update(gutterItem);
                }
                const top = gutterItem.range.startLineNumber <= this._editor.getModel().getLineCount()
                    ? this._editor.getTopForLineNumber(gutterItem.range.startLineNumber, true) - scrollTop
                    : this._editor.getBottomForLineNumber(gutterItem.range.startLineNumber - 1, false) - scrollTop;
                const bottom = this._editor.getBottomForLineNumber(gutterItem.range.endLineNumberExclusive - 1, true) - scrollTop;
                const height = bottom - top;
                view.domNode.style.top = `${top}px`;
                view.domNode.style.height = `${height}px`;
                view.gutterItemView.layout(top, height, 0, this._domNode.clientHeight);
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
    constructor(gutterItemView, domNode) {
        this.gutterItemView = gutterItemView;
        this.domNode = domNode;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yR3V0dGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL21lcmdlRWRpdG9yL2Jyb3dzZXIvdmlldy9lZGl0b3JHdXR0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFlLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxPQUFPLEVBQVcsbUJBQW1CLEVBQUUsZ0JBQWdCLEVBQUUseUJBQXlCLEVBQUUsV0FBVyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFM0osT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFFN0QsTUFBTSxPQUFPLFlBQTBELFNBQVEsVUFBVTtJQVN4RixZQUNrQixPQUF5QixFQUN6QixRQUFxQixFQUNyQixZQUFvQztRQUVyRCxLQUFLLEVBQUUsQ0FBQztRQUpTLFlBQU8sR0FBUCxPQUFPLENBQWtCO1FBQ3pCLGFBQVEsR0FBUixRQUFRLENBQWE7UUFDckIsaUJBQVksR0FBWixZQUFZLENBQXdCO1FBR3JELElBQUksQ0FBQyxTQUFTLEdBQUcsbUJBQW1CLENBQUMsSUFBSSxFQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixFQUM5QixDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsNENBQTRDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FDL0UsQ0FBQztRQUNGLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLG1DQUFtQyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUM5RyxJQUFJ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