/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BugIndicatingError } from '../../../../base/common/errors.js';
import { OffsetRange } from './offsetRange.js';
import { Range } from '../range.js';
/**
 * Represents a 1-based range of columns.
 * Use {@lik OffsetRange} to represent a 0-based range.
*/
export class ColumnRange {
    static fromOffsetRange(offsetRange) {
        return new ColumnRange(offsetRange.start + 1, offsetRange.endExclusive + 1);
    }
    constructor(
    /** 1-based */
    startColumn, endColumnExclusive) {
        this.startColumn = startColumn;
        this.endColumnExclusive = endColumnExclusive;
        if (startColumn > endColumnExclusive) {
            throw new BugIndicatingError(`startColumn ${startColumn} cannot be after endColumnExclusive ${endColumnExclusive}`);
        }
    }
    toRange(lineNumber) {
        return new Range(lineNumber, this.startColumn, lineNumber, this.endColumnExclusive);
    }
    equals(other) {
        return this.startColumn === other.startColumn
            && this.endColumnExclusive === other.endColumnExclusive;
    }
    toZeroBasedOffsetRange() {
        return new OffsetRange(this.startColumn - 1, this.endColumnExclusive - 1);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29sdW1uUmFuZ2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi9jb3JlL3Jhbmdlcy9jb2x1bW5SYW5nZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDL0MsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUVwQzs7O0VBR0U7QUFDRixNQUFNLE9BQU8sV0FBVztJQUNoQixNQUFNLENBQUMsZUFBZSxDQUFDLFdBQXdCO1FBQ3JELE9BQU8sSUFBSSxXQUFXLENBQUMsV0FBVyxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUUsV0FBVyxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUMsQ0FBQztJQUM3RSxDQUFDO0lBRUQ7SUFDQyxjQUFjO0lBQ0UsV0FBbUIsRUFDbkIsa0JBQTBCO1FBRDFCLGdCQUFXLEdBQVgsV0FBVyxDQUFRO1FBQ25CLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBUTtRQUUxQyxJQUFJLFdBQVcsR0FBRyxrQkFBa0IsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sSUFBSSxrQkFBa0IsQ0FBQyxlQUFlLFdBQVcsdUNBQXVDLGtCQUFrQixFQUFFLENBQUMsQ0FBQztRQUNySCxDQUFDO0lBQ0YsQ0FBQztJQUVELE9BQU8sQ0FBQyxVQUFrQjtRQUN6QixPQUFPLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsV0FBVyxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUNyRixDQUFDO0lBRUQsTUFBTSxDQUFDLEtBQWtCO1FBQ3hCLE9BQU8sSUFBSSxDQUFDLFdBQVcsS0FBSyxLQUFLLENBQUMsV0FBVztlQUN6QyxJQUFJLENBQUMsa0JBQWtCLEtBQUssS0FBSyxDQUFDLGtCQUFrQixDQUFDO0lBQzFELENBQUM7SUFFRCxzQkFBc0I7UUFDckIsT0FBTyxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDM0UsQ0FBQztDQUNEIn0=