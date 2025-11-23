/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { LineRange } from '../ranges/lineRange.js';
import { Position } from '../position.js';
import { Range } from '../range.js';
/**
 * Represents a non-negative length of text in terms of line and column count.
*/
export class TextLength {
    static { this.zero = new TextLength(0, 0); }
    static lengthDiffNonNegative(start, end) {
        if (end.isLessThan(start)) {
            return TextLength.zero;
        }
        if (start.lineCount === end.lineCount) {
            return new TextLength(0, end.columnCount - start.columnCount);
        }
        else {
            return new TextLength(end.lineCount - start.lineCount, end.columnCount);
        }
    }
    static betweenPositions(position1, position2) {
        if (position1.lineNumber === position2.lineNumber) {
            return new TextLength(0, position2.column - position1.column);
        }
        else {
            return new TextLength(position2.lineNumber - position1.lineNumber, position2.column - 1);
        }
    }
    static fromPosition(pos) {
        return new TextLength(pos.lineNumber - 1, pos.column - 1);
    }
    static ofRange(range) {
        return TextLength.betweenPositions(range.getStartPosition(), range.getEndPosition());
    }
    static ofText(text) {
        let line = 0;
        let column = 0;
        for (const c of text) {
            if (c === '\n') {
                line++;
                column = 0;
            }
            else {
                column++;
            }
        }
        return new TextLength(line, column);
    }
    static ofSubstr(str, range) {
        return TextLength.ofText(range.substring(str));
    }
    static sum(fragments, getLength) {
        return fragments.reduce((acc, f) => acc.add(getLength(f)), TextLength.zero);
    }
    constructor(lineCount, columnCount) {
        this.lineCount = lineCount;
        this.columnCount = columnCount;
    }
    isZero() {
        return this.lineCount === 0 && this.columnCount === 0;
    }
    isLessThan(other) {
        if (this.lineCount !== other.lineCount) {
            return this.lineCount < other.lineCount;
        }
        return this.columnCount < other.columnCount;
    }
    isGreaterThan(other) {
        if (this.lineCount !== other.lineCount) {
            return this.lineCount > other.lineCount;
        }
        return this.columnCount > other.columnCount;
    }
    isGreaterThanOrEqualTo(other) {
        if (this.lineCount !== other.lineCount) {
            return this.lineCount > other.lineCount;
        }
        return this.columnCount >= other.columnCount;
    }
    equals(other) {
        return this.lineCount === other.lineCount && this.columnCount === other.columnCount;
    }
    compare(other) {
        if (this.lineCount !== other.lineCount) {
            return this.lineCount - other.lineCount;
        }
        return this.columnCount - other.columnCount;
    }
    add(other) {
        if (other.lineCount === 0) {
            return new TextLength(this.lineCount, this.columnCount + other.columnCount);
        }
        else {
            return new TextLength(this.lineCount + other.lineCount, other.columnCount);
        }
    }
    createRange(startPosition) {
        if (this.lineCount === 0) {
            return new Range(startPosition.lineNumber, startPosition.column, startPosition.lineNumber, startPosition.column + this.columnCount);
        }
        else {
            return new Range(startPosition.lineNumber, startPosition.column, startPosition.lineNumber + this.lineCount, this.columnCount + 1);
        }
    }
    toRange() {
        return new Range(1, 1, this.lineCount + 1, this.columnCount + 1);
    }
    toLineRange() {
        return LineRange.ofLength(1, this.lineCount + 1);
    }
    addToPosition(position) {
        if (this.lineCount === 0) {
            return new Position(position.lineNumber, position.column + this.columnCount);
        }
        else {
            return new Position(position.lineNumber + this.lineCount, this.columnCount + 1);
        }
    }
    addToRange(range) {
        return Range.fromPositions(this.addToPosition(range.getStartPosition()), this.addToPosition(range.getEndPosition()));
    }
    toString() {
        return `${this.lineCount},${this.columnCount}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dExlbmd0aC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL2NvcmUvdGV4dC90ZXh0TGVuZ3RoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBQ2hHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUNuRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDMUMsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUdwQzs7RUFFRTtBQUNGLE1BQU0sT0FBTyxVQUFVO2FBQ1IsU0FBSSxHQUFHLElBQUksVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUVuQyxNQUFNLENBQUMscUJBQXFCLENBQUMsS0FBaUIsRUFBRSxHQUFlO1FBQ3JFLElBQUksR0FBRyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzNCLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQztRQUN4QixDQUFDO1FBQ0QsSUFBSSxLQUFLLENBQUMsU0FBUyxLQUFLLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUN2QyxPQUFPLElBQUksVUFBVSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMvRCxDQUFDO2FBQU0sQ0FBQztZQUNQLE9BQU8sSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN6RSxDQUFDO0lBQ0YsQ0FBQztJQUVNLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFtQixFQUFFLFNBQW1CO1FBQ3RFLElBQUksU0FBUyxDQUFDLFVBQVUsS0FBSyxTQUFTLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDbkQsT0FBTyxJQUFJLFVBQVUsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLE1BQU0sR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDL0QsQ0FBQzthQUFNLENBQUM7WUFDUCxPQUFPLElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzFGLENBQUM7SUFDRixDQUFDO0lBRU0sTUFBTSxDQUFDLFlBQVksQ0FBQyxHQUFhO1FBQ3ZDLE9BQU8sSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQVUsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBRU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFZO1FBQ2pDLE9BQU8sVUFBVSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDO0lBQ3RGLENBQUM7SUFFTSxNQUFNLENBQUMsTUFBTSxDQUFDLElBQVk7UUFDaEMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDO1FBQ2IsSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBQ2YsS0FBSyxNQUFNLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUN0QixJQUFJLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztnQkFDaEIsSUFBSSxFQUFFLENBQUM7Z0JBQ1AsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUNaLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxNQUFNLEVBQUUsQ0FBQztZQUNWLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxJQUFJLFVBQVUsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVNLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBVyxFQUFFLEtBQWtCO1FBQ3JELE9BQU8sVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVNLE1BQU0sQ0FBQyxHQUFHLENBQUksU0FBdUIsRUFBRSxTQUErQjtRQUM1RSxPQUFPLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM3RSxDQUFDO0lBRUQsWUFDaUIsU0FBaUIsRUFDakIsV0FBbUI7UUFEbkIsY0FBUyxHQUFULFNBQVMsQ0FBUTtRQUNqQixnQkFBVyxHQUFYLFdBQVcsQ0FBUTtJQUNoQyxDQUFDO0lBRUUsTUFBTTtRQUNaLE9BQU8sSUFBSSxDQUFDLFNBQVMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLFdBQVcsS0FBSyxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUVNLFVBQVUsQ0FBQyxLQUFpQjtRQUNsQyxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3hDLE9BQU8sSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDO1FBQ3pDLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQztJQUM3QyxDQUFDO0lBRU0sYUFBYSxDQUFDLEtBQWlCO1FBQ3JDLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxLQUFLLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDeEMsT0FBTyxJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUM7UUFDekMsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDO0lBQzdDLENBQUM7SUFFTSxzQkFBc0IsQ0FBQyxLQUFpQjtRQUM5QyxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3hDLE9BQU8sSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDO1FBQ3pDLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsQ0FBQztJQUM5QyxDQUFDO0lBRU0sTUFBTSxDQUFDLEtBQWlCO1FBQzlCLE9BQU8sSUFBSSxDQUFDLFNBQVMsS0FBSyxLQUFLLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxXQUFXLEtBQUssS0FBSyxDQUFDLFdBQVcsQ0FBQztJQUNyRixDQUFDO0lBRU0sT0FBTyxDQUFDLEtBQWlCO1FBQy9CLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxLQUFLLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDeEMsT0FBTyxJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUM7UUFDekMsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDO0lBQzdDLENBQUM7SUFFTSxHQUFHLENBQUMsS0FBaUI7UUFDM0IsSUFBSSxLQUFLLENBQUMsU0FBUyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzNCLE9BQU8sSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM3RSxDQUFDO2FBQU0sQ0FBQztZQUNQLE9BQU8sSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM1RSxDQUFDO0lBQ0YsQ0FBQztJQUVNLFdBQVcsQ0FBQyxhQUF1QjtRQUN6QyxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDMUIsT0FBTyxJQUFJLEtBQUssQ0FBQyxhQUFhLENBQUMsVUFBVSxFQUFFLGFBQWEsQ0FBQyxNQUFNLEVBQUUsYUFBYSxDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNySSxDQUFDO2FBQU0sQ0FBQztZQUNQLE9BQU8sSUFBSSxLQUFLLENBQUMsYUFBYSxDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsTUFBTSxFQUFFLGFBQWEsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ25JLENBQUM7SUFDRixDQUFDO0lBRU0sT0FBTztRQUNiLE9BQU8sSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ2xFLENBQUM7SUFFTSxXQUFXO1FBQ2pCLE9BQU8sU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNsRCxDQUFDO0lBRU0sYUFBYSxDQUFDLFFBQWtCO1FBQ3RDLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUMxQixPQUFPLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDOUUsQ0FBQzthQUFNLENBQUM7WUFDUCxPQUFPLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2pGLENBQUM7SUFDRixDQUFDO0lBRU0sVUFBVSxDQUFDLEtBQVk7UUFDN0IsT0FBTyxLQUFLLENBQUMsYUFBYSxDQUN6QixJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLEVBQzVDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQzFDLENBQUM7SUFDSCxDQUFDO0lBRUQsUUFBUTtRQUNQLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUNoRCxDQUFDIn0=