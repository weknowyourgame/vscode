/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EditOperation } from '../core/editOperation.js';
import { Range } from '../core/range.js';
import { StringEdit, StringReplacement } from '../core/edits/stringEdit.js';
import { OffsetRange } from '../core/ranges/offsetRange.js';
import { LengthEdit } from '../core/edits/lengthEdit.js';
import { countEOL } from '../core/misc/eolCounter.js';
export function offsetEditToEditOperations(offsetEdit, doc) {
    const edits = [];
    for (const singleEdit of offsetEdit.replacements) {
        const range = Range.fromPositions(doc.getPositionAt(singleEdit.replaceRange.start), doc.getPositionAt(singleEdit.replaceRange.start + singleEdit.replaceRange.length));
        edits.push(EditOperation.replace(range, singleEdit.newText));
    }
    return edits;
}
export function offsetEditFromContentChanges(contentChanges) {
    const editsArr = contentChanges.map(c => new StringReplacement(OffsetRange.ofStartAndLength(c.rangeOffset, c.rangeLength), c.text));
    editsArr.reverse();
    const edits = new StringEdit(editsArr);
    return edits;
}
export function offsetEditFromLineRangeMapping(original, modified, changes) {
    const edits = [];
    for (const c of changes) {
        for (const i of c.innerChanges ?? []) {
            const newText = modified.getValueInRange(i.modifiedRange);
            const startOrig = original.getOffsetAt(i.originalRange.getStartPosition());
            const endExOrig = original.getOffsetAt(i.originalRange.getEndPosition());
            const origRange = new OffsetRange(startOrig, endExOrig);
            edits.push(new StringReplacement(origRange, newText));
        }
    }
    return new StringEdit(edits);
}
export function linesLengthEditFromModelContentChange(c) {
    const contentChanges = c.slice().reverse();
    const lengthEdits = contentChanges.map(c => LengthEdit.replace(
    // Expand the edit range to include the entire line
    new OffsetRange(c.range.startLineNumber - 1, c.range.endLineNumber), countEOL(c.text)[0] + 1));
    const lengthEdit = LengthEdit.compose(lengthEdits);
    return lengthEdit;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dE1vZGVsU3RyaW5nRWRpdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL21vZGVsL3RleHRNb2RlbFN0cmluZ0VkaXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3pELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDNUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBSTVELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUN6RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFFdEQsTUFBTSxVQUFVLDBCQUEwQixDQUFDLFVBQXNCLEVBQUUsR0FBZTtJQUNqRixNQUFNLEtBQUssR0FBcUMsRUFBRSxDQUFDO0lBQ25ELEtBQUssTUFBTSxVQUFVLElBQUksVUFBVSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ2xELE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxhQUFhLENBQ2hDLEdBQUcsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsRUFDaEQsR0FBRyxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUNqRixDQUFDO1FBQ0YsS0FBSyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUM5RCxDQUFDO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZCxDQUFDO0FBRUQsTUFBTSxVQUFVLDRCQUE0QixDQUFDLGNBQThDO0lBQzFGLE1BQU0sUUFBUSxHQUFHLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNwSSxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDbkIsTUFBTSxLQUFLLEdBQUcsSUFBSSxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDdkMsT0FBTyxLQUFLLENBQUM7QUFDZCxDQUFDO0FBRUQsTUFBTSxVQUFVLDhCQUE4QixDQUFDLFFBQW9CLEVBQUUsUUFBb0IsRUFBRSxPQUE0QztJQUN0SSxNQUFNLEtBQUssR0FBd0IsRUFBRSxDQUFDO0lBQ3RDLEtBQUssTUFBTSxDQUFDLElBQUksT0FBTyxFQUFFLENBQUM7UUFDekIsS0FBSyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsWUFBWSxJQUFJLEVBQUUsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBRTFELE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7WUFDM0UsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUM7WUFDekUsTUFBTSxTQUFTLEdBQUcsSUFBSSxXQUFXLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBRXhELEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUN2RCxDQUFDO0lBQ0YsQ0FBQztJQUVELE9BQU8sSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDOUIsQ0FBQztBQUVELE1BQU0sVUFBVSxxQ0FBcUMsQ0FBQyxDQUF3QjtJQUM3RSxNQUFNLGNBQWMsR0FBRyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDM0MsTUFBTSxXQUFXLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPO0lBQzdELG1EQUFtRDtJQUNuRCxJQUFJLFdBQVcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsRUFDbkUsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FDeEIsQ0FBQztJQUNGLE1BQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDbkQsT0FBTyxVQUFVLENBQUM7QUFDbkIsQ0FBQyJ9