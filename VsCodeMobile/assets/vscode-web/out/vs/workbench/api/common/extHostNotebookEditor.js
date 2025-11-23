/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { illegalArgument } from '../../../base/common/errors.js';
import * as extHostConverter from './extHostTypeConverters.js';
import * as extHostTypes from './extHostTypes.js';
import { NotebookRange } from './extHostTypes.js';
export class ExtHostNotebookEditor {
    static { this.apiEditorsToExtHost = new WeakMap(); }
    constructor(id, _proxy, notebookData, _visibleRanges, _selections, _viewColumn, viewType) {
        this.id = id;
        this._proxy = _proxy;
        this.notebookData = notebookData;
        this._visibleRanges = _visibleRanges;
        this._selections = _selections;
        this._viewColumn = _viewColumn;
        this.viewType = viewType;
        this._visible = false;
    }
    get apiEditor() {
        if (!this._editor) {
            const that = this;
            this._editor = {
                get notebook() {
                    return that.notebookData.apiNotebook;
                },
                get selection() {
                    return that._selections[0];
                },
                set selection(selection) {
                    this.selections = [selection];
                },
                get selections() {
                    return that._selections;
                },
                set selections(value) {
                    if (!Array.isArray(value) || !value.every(extHostTypes.NotebookRange.isNotebookRange)) {
                        throw illegalArgument('selections');
                    }
                    that._selections = value.length === 0 ? [new NotebookRange(0, 0)] : value;
                    that._trySetSelections(that._selections);
                },
                get visibleRanges() {
                    return that._visibleRanges;
                },
                revealRange(range, revealType) {
                    that._proxy.$tryRevealRange(that.id, extHostConverter.NotebookRange.from(range), revealType ?? extHostTypes.NotebookEditorRevealType.Default);
                },
                get viewColumn() {
                    return that._viewColumn;
                },
                get replOptions() {
                    if (that.viewType === 'repl') {
                        return { appendIndex: this.notebook.cellCount - 1 };
                    }
                    return undefined;
                },
                [Symbol.for('debug.description')]() {
                    return `NotebookEditor(${this.notebook.uri.toString()})`;
                }
            };
            ExtHostNotebookEditor.apiEditorsToExtHost.set(this._editor, this);
        }
        return this._editor;
    }
    get visible() {
        return this._visible;
    }
    _acceptVisibility(value) {
        this._visible = value;
    }
    _acceptVisibleRanges(value) {
        this._visibleRanges = value;
    }
    _acceptSelections(selections) {
        this._selections = selections;
    }
    _trySetSelections(value) {
        this._proxy.$trySetSelections(this.id, value.map(extHostConverter.NotebookRange.from));
    }
    _acceptViewColumn(value) {
        this._viewColumn = value;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdE5vdGVib29rRWRpdG9yLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvY29tbW9uL2V4dEhvc3ROb3RlYm9va0VkaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFakUsT0FBTyxLQUFLLGdCQUFnQixNQUFNLDRCQUE0QixDQUFDO0FBQy9ELE9BQU8sS0FBSyxZQUFZLE1BQU0sbUJBQW1CLENBQUM7QUFHbEQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBRWxELE1BQU0sT0FBTyxxQkFBcUI7YUFFVix3QkFBbUIsR0FBRyxJQUFJLE9BQU8sRUFBZ0QsQUFBOUQsQ0FBK0Q7SUFNekcsWUFDVSxFQUFVLEVBQ0YsTUFBc0MsRUFDOUMsWUFBcUMsRUFDdEMsY0FBc0MsRUFDdEMsV0FBbUMsRUFDbkMsV0FBMEMsRUFDakMsUUFBZ0I7UUFOeEIsT0FBRSxHQUFGLEVBQUUsQ0FBUTtRQUNGLFdBQU0sR0FBTixNQUFNLENBQWdDO1FBQzlDLGlCQUFZLEdBQVosWUFBWSxDQUF5QjtRQUN0QyxtQkFBYyxHQUFkLGNBQWMsQ0FBd0I7UUFDdEMsZ0JBQVcsR0FBWCxXQUFXLENBQXdCO1FBQ25DLGdCQUFXLEdBQVgsV0FBVyxDQUErQjtRQUNqQyxhQUFRLEdBQVIsUUFBUSxDQUFRO1FBWDFCLGFBQVEsR0FBWSxLQUFLLENBQUM7SUFZOUIsQ0FBQztJQUVMLElBQUksU0FBUztRQUNaLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbkIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDO1lBQ2xCLElBQUksQ0FBQyxPQUFPLEdBQUc7Z0JBQ2QsSUFBSSxRQUFRO29CQUNYLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxX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