/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DeferredPromise } from '../../../../base/common/async.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import * as DOM from '../../../../base/browser/dom.js';
export class NotebookCellLayoutManager extends Disposable {
    constructor(notebookWidget, _list, loggingService) {
        super();
        this.notebookWidget = notebookWidget;
        this._list = _list;
        this.loggingService = loggingService;
        this._pendingLayouts = new WeakMap();
        this._layoutDisposables = new Set();
        this._layoutStack = [];
        this._isDisposed = false;
    }
    checkStackDepth() {
        if (this._layoutStack.length > 30) {
            const layoutTrace = this._layoutStack.join(' -> ');
            throw new Error('NotebookCellLayoutManager: layout stack is too deep: ' + layoutTrace);
        }
    }
    async layoutNotebookCell(cell, height) {
        const layoutTag = `cell:${cell.handle}, height:${height}`;
        this.loggingService.debug('cell layout', layoutTag);
        const viewIndex = this._list.getViewIndex(cell);
        if (viewIndex === undefined) {
            // the cell is hidden
            return;
        }
        if (this._pendingLayouts?.has(cell)) {
            this._pendingLayouts?.get(cell).dispose();
        }
        const deferred = new DeferredPromise();
        const doLayout = () => {
            const pendingLayout = this._pendingLayouts?.get(cell);
            this._pendingLayouts?.delete(cell);
            this._layoutStack.push(layoutTag);
            try {
                if (this._isDisposed) {
                    return;
                }
                if (!this.notebookWidget.viewModel?.hasCell(cell)) {
                    // Cell removed in the meantime?
                    return;
                }
                if (this._list.getViewIndex(cell) === undefined) {
                    // Cell can be hidden
                    return;
                }
                if (this._list.elementHeight(cell) === height) {
                    return;
                }
                this.checkStackDepth();
                if (!this.notebookWidget.hasEditorFocus()) {
                    // Do not scroll inactive notebook
                    // https://github.com/microsoft/vscode/issues/145340
                    const cellIndex = this.notebookWidget.viewModel?.getCellIndex(cell);
                    const visibleRanges = this.notebookWidget.visibleRanges;
                    if (cellIndex !== undefined
                        && visibleRanges && visibleRanges.length && visibleRanges[0].start === cellIndex
                        // cell is partially visible
                        && this._list.scrollTop > this.notebookWidget.getAbsoluteTopOfElement(cell)) {
                        return this._list.updateElementHeight2(cell, height, Math.min(cellIndex + 1, this.notebookWidget.getLength() - 1));
                    }
                }
                this._list.updateElementHeight2(cell, height);
            }
            finally {
                this._layoutStack.pop();
                deferred.complete(undefined);
                if (pendingLayout) {
                    pendingLayout.dispose();
                    this._layoutDisposables.delete(pendingLayout);
                }
            }
        };
        if (this._list.inRenderingTransaction) {
            const layoutDisposable = DOM.scheduleAtNextAnimationFrame(DOM.getWindow(this.notebookWidget.getDomNode()), doLayout);
            const disposable = toDisposable(() => {
                layoutDisposable.dispose();
                deferred.complete(undefined);
            });
            this._pendingLayouts?.set(cell, disposable);
            this._layoutDisposables.add(disposable);
        }
        else {
            doLayout();
        }
        return deferred.p;
    }
    dispose() {
        super.dispose();
        this._isDisposed = true;
        this._layoutDisposables.forEach(d => d.dispose());
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tDZWxsTGF5b3V0TWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL25vdGVib29rQ2VsbExheW91dE1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxVQUFVLEVBQWUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFJN0YsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUd2RCxNQUFNLE9BQU8seUJBQTBCLFNBQVEsVUFBVTtJQUt4RCxZQUNTLGNBQW9DLEVBQ3BDLEtBQXdCLEVBQ3hCLGNBQXVDO1FBRS9DLEtBQUssRUFBRSxDQUFDO1FBSkEsbUJBQWMsR0FBZCxjQUFjLENBQXNCO1FBQ3BDLFVBQUssR0FBTCxLQUFLLENBQW1CO1FBQ3hCLG1CQUFjLEdBQWQsY0FBYyxDQUF5QjtRQVB4QyxvQkFBZSxHQUFnRCxJQUFJLE9BQU8sRUFBK0IsQ0FBQztRQUMxRyx1QkFBa0IsR0FBcUIsSUFBSSxHQUFHLEVBQWUsQ0FBQztRQUNyRCxpQkFBWSxHQUFhLEVBQUUsQ0FBQztRQUNyQyxnQkFBVyxHQUFHLEtBQUssQ0FBQztJQU81QixDQUFDO0lBRU8sZUFBZTtRQUN0QixJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxHQUFHLEVBQUUsRUFBRSxDQUFDO1lBQ25DLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ25ELE1BQU0sSUFBSSxLQUFLLENBQUMsdURBQXVELEdBQUcsV0FBVyxDQUFDLENBQUM7UUFDeEYsQ0FBQztJQUNGLENBQUM7SUFFRCxLQUFLLENBQUMsa0JBQWtCLENB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