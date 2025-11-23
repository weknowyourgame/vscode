/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ColumnRange } from './columnRange.js';
import { Range } from '../range.js';
/**
 * Represents a column range in a single line.
*/
export class RangeSingleLine {
    static fromRange(range) {
        if (range.endLineNumber !== range.startLineNumber) {
            return undefined;
        }
        return new RangeSingleLine(range.startLineNumber, new ColumnRange(range.startColumn, range.endColumn));
    }
    constructor(
    /** 1-based */
    lineNumber, columnRange) {
        this.lineNumber = lineNumber;
        this.columnRange = columnRange;
    }
    toRange() {
        return new Range(this.lineNumber, this.columnRange.startColumn, this.lineNumber, this.columnRange.endColumnExclusive);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmFuZ2VTaW5nbGVMaW5lLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb21tb24vY29yZS9yYW5nZXMvcmFuZ2VTaW5nbGVMaW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUMvQyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBRXBDOztFQUVFO0FBQ0YsTUFBTSxPQUFPLGVBQWU7SUFDcEIsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFZO1FBQ25DLElBQUksS0FBSyxDQUFDLGFBQWEsS0FBSyxLQUFLLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDbkQsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUNELE9BQU8sSUFBSSxlQUFlLENBQUMsS0FBSyxDQUFDLGVBQWUsRUFBRSxJQUFJLFdBQVcsQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQ3hHLENBQUM7SUFFRDtJQUNDLGNBQWM7SUFDRSxVQUFrQixFQUNsQixXQUF3QjtRQUR4QixlQUFVLEdBQVYsVUFBVSxDQUFRO1FBQ2xCLGdCQUFXLEdBQVgsV0FBVyxDQUFhO0lBQ3JDLENBQUM7SUFFTCxPQUFPO1FBQ04sT0FBTyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBQ3ZILENBQUM7Q0FDRCJ9