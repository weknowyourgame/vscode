/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BugIndicatingError } from '../../../../base/common/errors.js';
/**
 * A range of offsets (0-based).
*/
export class OffsetRange {
    static fromTo(start, endExclusive) {
        return new OffsetRange(start, endExclusive);
    }
    static addRange(range, sortedRanges) {
        let i = 0;
        while (i < sortedRanges.length && sortedRanges[i].endExclusive < range.start) {
            i++;
        }
        let j = i;
        while (j < sortedRanges.length && sortedRanges[j].start <= range.endExclusive) {
            j++;
        }
        if (i === j) {
            sortedRanges.splice(i, 0, range);
        }
        else {
            const start = Math.min(range.start, sortedRanges[i].start);
            const end = Math.max(range.endExclusive, sortedRanges[j - 1].endExclusive);
            sortedRanges.splice(i, j - i, new OffsetRange(start, end));
        }
    }
    static tryCreate(start, endExclusive) {
        if (start > endExclusive) {
            return undefined;
        }
        return new OffsetRange(start, endExclusive);
    }
    static ofLength(length) {
        return new OffsetRange(0, length);
    }
    static ofStartAndLength(start, length) {
        return new OffsetRange(start, start + length);
    }
    static emptyAt(offset) {
        return new OffsetRange(offset, offset);
    }
    constructor(start, endExclusive) {
        this.start = start;
        this.endExclusive = endExclusive;
        if (start > endExclusive) {
            throw new BugIndicatingError(`Invalid range: ${this.toString()}`);
        }
    }
    get isEmpty() {
        return this.start === this.endExclusive;
    }
    delta(offset) {
        return new OffsetRange(this.start + offset, this.endExclusive + offset);
    }
    deltaStart(offset) {
        return new OffsetRange(this.start + offset, this.endExclusive);
    }
    deltaEnd(offset) {
        return new OffsetRange(this.start, this.endExclusive + offset);
    }
    get length() {
        return this.endExclusive - this.start;
    }
    toString() {
        return `[${this.start}, ${this.endExclusive})`;
    }
    equals(other) {
        return this.start === other.start && this.endExclusive === other.endExclusive;
    }
    containsRange(other) {
        return this.start <= other.start && other.endExclusive <= this.endExclusive;
    }
    contains(offset) {
        return this.start <= offset && offset < this.endExclusive;
    }
    /**
     * for all numbers n: range1.contains(n) or range2.contains(n) => range1.join(range2).contains(n)
     * The joined range is the smallest range that contains both ranges.
     */
    join(other) {
        return new OffsetRange(Math.min(this.start, other.start), Math.max(this.endExclusive, other.endExclusive));
    }
    /**
     * for all numbers n: range1.contains(n) and range2.contains(n) <=> range1.intersect(range2).contains(n)
     *
     * The resulting range is empty if the ranges do not intersect, but touch.
     * If the ranges don't even touch, the result is undefined.
     */
    intersect(other) {
        const start = Math.max(this.start, other.start);
        const end = Math.min(this.endExclusive, other.endExclusive);
        if (start <= end) {
            return new OffsetRange(start, end);
        }
        return undefined;
    }
    intersectionLength(range) {
        const start = Math.max(this.start, range.start);
        const end = Math.min(this.endExclusive, range.endExclusive);
        return Math.max(0, end - start);
    }
    intersects(other) {
        const start = Math.max(this.start, other.start);
        const end = Math.min(this.endExclusive, other.endExclusive);
        return start < end;
    }
    intersectsOrTouches(other) {
        const start = Math.max(this.start, other.start);
        const end = Math.min(this.endExclusive, other.endExclusive);
        return start <= end;
    }
    isBefore(other) {
        return this.endExclusive <= other.start;
    }
    isAfter(other) {
        return this.start >= other.endExclusive;
    }
    slice(arr) {
        return arr.slice(this.start, this.endExclusive);
    }
    substring(str) {
        return str.substring(this.start, this.endExclusive);
    }
    /**
     * Returns the given value if it is contained in this instance, otherwise the closest value that is contained.
     * The range must not be empty.
     */
    clip(value) {
        if (this.isEmpty) {
            throw new BugIndicatingError(`Invalid clipping range: ${this.toString()}`);
        }
        return Math.max(this.start, Math.min(this.endExclusive - 1, value));
    }
    /**
     * Returns `r := value + k * length` such that `r` is contained in this range.
     * The range must not be empty.
     *
     * E.g. `[5, 10).clipCyclic(10) === 5`, `[5, 10).clipCyclic(11) === 6` and `[5, 10).clipCyclic(4) === 9`.
     */
    clipCyclic(value) {
        if (this.isEmpty) {
            throw new BugIndicatingError(`Invalid clipping range: ${this.toString()}`);
        }
        if (value < this.start) {
            return this.endExclusive - ((this.start - value) % this.length);
        }
        if (value >= this.endExclusive) {
            return this.start + ((value - this.start) % this.length);
        }
        return value;
    }
    map(f) {
        const result = [];
        for (let i = this.start; i < this.endExclusive; i++) {
            result.push(f(i));
        }
        return result;
    }
    forEach(f) {
        for (let i = this.start; i < this.endExclusive; i++) {
            f(i);
        }
    }
    /**
     * this: [ 5, 10), range: [10, 15) => [5, 15)]
     * Throws if the ranges are not touching.
    */
    joinRightTouching(range) {
        if (this.endExclusive !== range.start) {
            throw new BugIndicatingError(`Invalid join: ${this.toString()} and ${range.toString()}`);
        }
        return new OffsetRange(this.start, range.endExclusive);
    }
    withMargin(marginStart, marginEnd) {
        if (marginEnd === undefined) {
            marginEnd = marginStart;
        }
        return new OffsetRange(this.start - marginStart, this.endExclusive + marginEnd);
    }
}
export class OffsetRangeSet {
    constructor() {
        this._sortedRanges = [];
    }
    get ranges() {
        return [...this._sortedRanges];
    }
    addRange(range) {
        let i = 0;
        while (i < this._sortedRanges.length && this._sortedRanges[i].endExclusive < range.start) {
            i++;
        }
        let j = i;
        while (j < this._sortedRanges.length && this._sortedRanges[j].start <= range.endExclusive) {
            j++;
        }
        if (i === j) {
            this._sortedRanges.splice(i, 0, range);
        }
        else {
            const start = Math.min(range.start, this._sortedRanges[i].start);
            const end = Math.max(range.endExclusive, this._sortedRanges[j - 1].endExclusive);
            this._sortedRanges.splice(i, j - i, new OffsetRange(start, end));
        }
    }
    toString() {
        return this._sortedRanges.map(r => r.toString()).join(', ');
    }
    /**
     * Returns of there is a value that is contained in this instance and the given range.
     */
    intersectsStrict(other) {
        // TODO use binary search
        let i = 0;
        while (i < this._sortedRanges.length && this._sortedRanges[i].endExclusive <= other.start) {
            i++;
        }
        return i < this._sortedRanges.length && this._sortedRanges[i].start < other.endExclusive;
    }
    intersectWithRange(other) {
        // TODO use binary search + slice
        const result = new OffsetRangeSet();
        for (const range of this._sortedRanges) {
            const intersection = range.intersect(other);
            if (intersection) {
                result.addRange(intersection);
            }
        }
        return result;
    }
    intersectWithRangeLength(other) {
        return this.intersectWithRange(other).length;
    }
    get length() {
        return this._sortedRanges.reduce((prev, cur) => prev + cur.length, 0);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2Zmc2V0UmFuZ2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi9jb3JlL3Jhbmdlcy9vZmZzZXRSYW5nZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQU92RTs7RUFFRTtBQUNGLE1BQU0sT0FBTyxXQUFXO0lBQ2hCLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBYSxFQUFFLFlBQW9CO1FBQ3ZELE9BQU8sSUFBSSxXQUFXLENBQUMsS0FBSyxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFTSxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQWtCLEVBQUUsWUFBMkI7UUFDckUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ1YsT0FBTyxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUM5RSxDQUFDLEVBQUUsQ0FBQztRQUNMLENBQUM7UUFDRCxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDVixPQUFPLENBQUMsR0FBRyxZQUFZLENBQUMsTUFBTSxJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQy9FLENBQUMsRUFBRSxDQUFDO1FBQ0wsQ0FBQztRQUNELElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ2IsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2xDLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFF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