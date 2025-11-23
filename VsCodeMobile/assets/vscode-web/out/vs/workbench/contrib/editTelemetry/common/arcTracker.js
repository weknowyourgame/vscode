/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { sumBy } from '../../../../base/common/arrays.js';
import { LineEdit } from '../../../../editor/common/core/edits/lineEdit.js';
/**
 * The ARC (accepted and retained characters) counts how many characters inserted by the initial suggestion (trackedEdit)
 * stay unmodified after a certain amount of time after acceptance.
*/
export class ArcTracker {
    constructor(_valueBeforeTrackedEdit, trackedEdit) {
        this._valueBeforeTrackedEdit = _valueBeforeTrackedEdit;
        this._trackedEdit = trackedEdit.removeCommonSuffixPrefix(_valueBeforeTrackedEdit.getValue());
        this._updatedTrackedEdit = this._trackedEdit.mapData(() => new IsTrackedEditData(true));
    }
    getOriginalCharacterCount() {
        return sumBy(this._trackedEdit.replacements, e => e.getNewLength());
    }
    /**
     * edit must apply to _updatedTrackedEdit.apply(_valueBeforeTrackedEdit)
    */
    handleEdits(edit) {
        const e = edit.mapData(_d => new IsTrackedEditData(false));
        const composedEdit = this._updatedTrackedEdit.compose(e); // (still) applies to _valueBeforeTrackedEdit
        // TODO@hediet improve memory by using:
        // composedEdit = const onlyTrackedEdit = composedEdit.decomposeSplit(e => !e.data.isTrackedEdit).e2;
        this._updatedTrackedEdit = composedEdit;
    }
    getAcceptedRestrainedCharactersCount() {
        const s = sumBy(this._updatedTrackedEdit.replacements, e => e.data.isTrackedEdit ? e.getNewLength() : 0);
        return s;
    }
    getDebugState() {
        return {
            edits: this._updatedTrackedEdit.replacements.map(e => ({
                range: e.replaceRange.toString(),
                newText: e.newText,
                isTrackedEdit: e.data.isTrackedEdit,
            }))
        };
    }
    getLineCountInfo() {
        const e = this._updatedTrackedEdit.toStringEdit(r => r.data.isTrackedEdit);
        const le = LineEdit.fromStringEdit(e, this._valueBeforeTrackedEdit);
        const deletedLineCount = sumBy(le.replacements, r => r.lineRange.length);
        const insertedLineCount = sumBy(le.getNewLineRanges(), r => r.length);
        return {
            deletedLineCounts: deletedLineCount,
            insertedLineCounts: insertedLineCount,
        };
    }
    getValues() {
        return {
            arc: this.getAcceptedRestrainedCharactersCount(),
            ...this.getLineCountInfo(),
        };
    }
}
export class IsTrackedEditData {
    constructor(isTrackedEdit) {
        this.isTrackedEdit = isTrackedEdit;
    }
    join(data) {
        if (this.isTrackedEdit !== data.isTrackedEdit) {
            return undefined;
        }
        return this;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJjVHJhY2tlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9lZGl0VGVsZW1ldHJ5L2NvbW1vbi9hcmNUcmFja2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMxRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFJNUU7OztFQUdFO0FBQ0YsTUFBTSxPQUFPLFVBQVU7SUFJdEIsWUFDa0IsdUJBQXFDLEVBQ3RELFdBQTJCO1FBRFYsNEJBQXVCLEdBQXZCLHVCQUF1QixDQUFjO1FBR3RELElBQUksQ0FBQyxZQUFZLEdBQUcsV0FBVyxDQUFDLHdCQUF3QixDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDN0YsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN6RixDQUFDO0lBRUQseUJBQXlCO1FBQ3hCLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7SUFDckUsQ0FBQztJQUVEOztNQUVFO0lBQ0YsV0FBVyxDQUFDLElBQW9CO1FBQy9CLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDM0QsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLDZDQUE2QztRQUV2Ryx1Q0FBdUM7UUFDdkMscUdBQXFHO1FBRXJHLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxZQUFZLENBQUM7SUFDekMsQ0FBQztJQUVELG9DQUFvQztRQUNuQyxNQUFNLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3pHLE9BQU8sQ0FBQyxDQUFDO0lBQ1YsQ0FBQztJQUVELGFBQWE7UUFDWixPQUFPO1lBQ04sS0FBSyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDdEQsS0FBSyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFO2dCQUNoQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLE9BQU87Z0JBQ2xCLGFBQWEsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWE7YUFDbkMsQ0FBQyxDQUFDO1NBQ0gsQ0FBQztJQUNILENBQUM7SUFFTSxnQkFBZ0I7UUFDdEIsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDM0UsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQUM7UUFDcEUsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsRUFBRSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDekUsTUFBTSxpQkFBaUIsR0FBRyxLQUFLLENBQUMsRUFBRSxDQUFDLGdCQUFnQixFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdEUsT0FBTztZQUNOLGlCQUFpQixFQUFFLGdCQUFnQjtZQUNuQyxrQkFBa0IsRUFBRSxpQkFBaUI7U0FDckMsQ0FBQztJQUNILENBQUM7SUFFTSxTQUFTO1FBQ2YsT0FBTztZQUNOLEdBQUcsRUFBRSxJQUFJLENBQUMsb0NBQW9DLEVBQUU7WUFDaEQsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7U0FDMUIsQ0FBQztJQUNILENBQUM7Q0FDRDtBQUVELE1BQU0sT0FBTyxpQkFBaUI7SUFDN0IsWUFDaUIsYUFBc0I7UUFBdEIsa0JBQWEsR0FBYixhQUFhLENBQVM7SUFDbkMsQ0FBQztJQUVMLElBQUksQ0FBQyxJQUF1QjtRQUMzQixJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQy9DLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7Q0FDRCJ9