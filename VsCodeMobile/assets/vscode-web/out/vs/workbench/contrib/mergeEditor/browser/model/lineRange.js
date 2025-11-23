/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Range } from '../../../../../editor/common/core/range.js';
import { LineRange } from '../../../../../editor/common/core/ranges/lineRange.js';
/**
 * TODO: Deprecate in favor of LineRange!
 */
export class MergeEditorLineRange extends LineRange {
    static fromLineNumbers(startLineNumber, endExclusiveLineNumber) {
        return MergeEditorLineRange.fromLength(startLineNumber, endExclusiveLineNumber - startLineNumber);
    }
    static fromLength(startLineNumber, length) {
        return new MergeEditorLineRange(startLineNumber, startLineNumber + length);
    }
    join(other) {
        return MergeEditorLineRange.fromLineNumbers(Math.min(this.startLineNumber, other.startLineNumber), Math.max(this.endLineNumberExclusive, other.endLineNumberExclusive));
    }
    isAfter(range) {
        return this.startLineNumber >= range.endLineNumberExclusive;
    }
    isBefore(range) {
        return range.startLineNumber >= this.endLineNumberExclusive;
    }
    delta(lineDelta) {
        return MergeEditorLineRange.fromLength(this.startLineNumber + lineDelta, this.length);
    }
    deltaEnd(delta) {
        return MergeEditorLineRange.fromLength(this.startLineNumber, this.length + delta);
    }
    deltaStart(lineDelta) {
        return MergeEditorLineRange.fromLength(this.startLineNumber + lineDelta, this.length - lineDelta);
    }
    getLines(model) {
        const result = new Array(this.length);
        for (let i = 0; i < this.length; i++) {
            result[i] = model.getLineContent(this.startLineNumber + i);
        }
        return result;
    }
    toInclusiveRangeOrEmpty() {
        if (this.isEmpty) {
            return new Range(this.startLineNumber, 1, this.startLineNumber, 1);
        }
        return new Range(this.startLineNumber, 1, this.endLineNumberExclusive - 1, 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluZVJhbmdlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL21lcmdlRWRpdG9yL2Jyb3dzZXIvbW9kZWwvbGluZVJhbmdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFHbEY7O0dBRUc7QUFDSCxNQUFNLE9BQU8sb0JBQXFCLFNBQVEsU0FBUztJQUNsRCxNQUFNLENBQUMsZUFBZSxDQUFDLGVBQXVCLEVBQUUsc0JBQThCO1FBQzdFLE9BQU8sb0JBQW9CLENBQUMsVUFBVSxDQUFDLGVBQWUsRUFBRSxzQkFBc0IsR0FBRyxlQUFlLENBQUMsQ0FBQztJQUNuRyxDQUFDO0lBRUQsTUFBTSxDQUFDLFVBQVUsQ0FBQyxlQUF1QixFQUFFLE1BQWM7UUFDeEQsT0FBTyxJQUFJLG9CQUFvQixDQUFDLGVBQWUsRUFBRSxlQUFlLEdBQUcsTUFBTSxDQUFDLENBQUM7SUFDNUUsQ0FBQztJQUVlLElBQUksQ0FBQyxLQUEyQjtRQUMvQyxPQUFPLG9CQUFvQixDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsS0FBSyxDQUFDLGVBQWUsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHNCQUFzQixFQUFFLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUM7SUFDekssQ0FBQztJQUVNLE9BQU8sQ0FBQyxLQUEyQjtRQUN6QyxPQUFPLElBQUksQ0FBQyxlQUFlLElBQUksS0FBSyxDQUFDLHNCQUFzQixDQUFDO0lBQzdELENBQUM7SUFFTSxRQUFRLENBQUMsS0FBMkI7UUFDMUMsT0FBTyxLQUFLLENBQUMsZUFBZSxJQUFJLElBQUksQ0FBQyxzQkFBc0IsQ0FBQztJQUM3RCxDQUFDO0lBRWUsS0FBSyxDQUFDLFNBQWlCO1FBQ3RDLE9BQU8sb0JBQW9CLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxlQUFlLEdBQUcsU0FBUyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN2RixDQUFDO0lBRU0sUUFBUSxDQUFDLEtBQWE7UUFDNUIsT0FBTyxvQkFBb0IsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxDQUFDO0lBQ25GLENBQUM7SUFFTSxVQUFVLENBQUMsU0FBaUI7UUFDbEMsT0FBTyxvQkFBb0IsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRyxTQUFTLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxTQUFTLENBQUMsQ0FBQztJQUNuRyxDQUFDO0lBRU0sUUFBUSxDQUFDLEtBQWlCO1FBQ2hDLE1BQU0sTUFBTSxHQUFHLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN0QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxlQUFlLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDNUQsQ0FBQztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQUVNLHVCQUF1QjtRQUM3QixJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsQixPQUFPLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDcEUsQ0FBQztRQUNELE9BQU8sSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLHNCQUFzQixHQUFHLENBQUMsb0RBQW1DLENBQUM7SUFDOUcsQ0FBQztDQUNEIn0=