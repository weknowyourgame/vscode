/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { safeIntl } from '../../../../base/common/date.js';
import { EditOperation } from '../../../common/core/editOperation.js';
import { Range } from '../../../common/core/range.js';
export class SortLinesCommand {
    static { this._COLLATOR = safeIntl.Collator(); }
    constructor(selection, descending) {
        this.selection = selection;
        this.descending = descending;
        this.selectionId = null;
    }
    getEditOperations(model, builder) {
        const op = sortLines(model, this.selection, this.descending);
        if (op) {
            builder.addEditOperation(op.range, op.text);
        }
        this.selectionId = builder.trackSelection(this.selection);
    }
    computeCursorState(model, helper) {
        return helper.getTrackedSelection(this.selectionId);
    }
    static canRun(model, selection, descending) {
        if (model === null) {
            return false;
        }
        const data = getSortData(model, selection, descending);
        if (!data) {
            return false;
        }
        for (let i = 0, len = data.before.length; i < len; i++) {
            if (data.before[i] !== data.after[i]) {
                return true;
            }
        }
        return false;
    }
}
function getSortData(model, selection, descending) {
    const startLineNumber = selection.startLineNumber;
    let endLineNumber = selection.endLineNumber;
    if (selection.endColumn === 1) {
        endLineNumber--;
    }
    // Nothing to sort if user didn't select anything.
    if (startLineNumber >= endLineNumber) {
        return null;
    }
    const linesToSort = [];
    // Get the contents of the selection to be sorted.
    for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
        linesToSort.push(model.getLineContent(lineNumber));
    }
    let sorted = linesToSort.slice(0);
    sorted.sort(SortLinesCommand._COLLATOR.value.compare);
    // If descending, reverse the order.
    if (descending === true) {
        sorted = sorted.reverse();
    }
    return {
        startLineNumber: startLineNumber,
        endLineNumber: endLineNumber,
        before: linesToSort,
        after: sorted
    };
}
/**
 * Generate commands for sorting lines on a model.
 */
function sortLines(model, selection, descending) {
    const data = getSortData(model, selection, descending);
    if (!data) {
        return null;
    }
    return EditOperation.replace(new Range(data.startLineNumber, 1, data.endLineNumber, model.getLineMaxColumn(data.endLineNumber)), data.after.join('\n'));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic29ydExpbmVzQ29tbWFuZC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9saW5lc09wZXJhdGlvbnMvYnJvd3Nlci9zb3J0TGluZXNDb21tYW5kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUUzRCxPQUFPLEVBQUUsYUFBYSxFQUF3QixNQUFNLHVDQUF1QyxDQUFDO0FBQzVGLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUt0RCxNQUFNLE9BQU8sZ0JBQWdCO2FBRXJCLGNBQVMsR0FBd0IsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBTTVELFlBQVksU0FBb0IsRUFBRSxVQUFtQjtRQUNwRCxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztRQUMzQixJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztRQUM3QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztJQUN6QixDQUFDO0lBRU0saUJBQWlCLENBQUMsS0FBaUIsRUFBRSxPQUE4QjtRQUN6RSxNQUFNLEVBQUUsR0FBRyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzdELElBQUksRUFBRSxFQUFFLENBQUM7WUFDUixPQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0MsQ0FBQztRQUVELElBQUksQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUVNLGtCQUFrQixDQUFDLEtBQWlCLEVBQUUsTUFBZ0M7UUFDNUUsT0FBTyxN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