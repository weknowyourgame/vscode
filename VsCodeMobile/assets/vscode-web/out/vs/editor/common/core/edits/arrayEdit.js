/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { OffsetRange } from '../ranges/offsetRange.js';
import { BaseEdit, BaseReplacement } from './edit.js';
/**
 * Represents a set of replacements to an array.
 * All these replacements are applied at once.
*/
export class ArrayEdit extends BaseEdit {
    static { this.empty = new ArrayEdit([]); }
    static create(replacements) {
        return new ArrayEdit(replacements);
    }
    static single(replacement) {
        return new ArrayEdit([replacement]);
    }
    static replace(range, replacement) {
        return new ArrayEdit([new ArrayReplacement(range, replacement)]);
    }
    static insert(offset, replacement) {
        return new ArrayEdit([new ArrayReplacement(OffsetRange.emptyAt(offset), replacement)]);
    }
    static delete(range) {
        return new ArrayEdit([new ArrayReplacement(range, [])]);
    }
    _createNew(replacements) {
        return new ArrayEdit(replacements);
    }
    apply(data) {
        const resultData = [];
        let pos = 0;
        for (const edit of this.replacements) {
            resultData.push(...data.slice(pos, edit.replaceRange.start));
            resultData.push(...edit.newValue);
            pos = edit.replaceRange.endExclusive;
        }
        resultData.push(...data.slice(pos));
        return resultData;
    }
    /**
     * Creates an edit that reverts this edit.
     */
    inverse(baseVal) {
        const edits = [];
        let offset = 0;
        for (const e of this.replacements) {
            edits.push(new ArrayReplacement(OffsetRange.ofStartAndLength(e.replaceRange.start + offset, e.newValue.length), baseVal.slice(e.replaceRange.start, e.replaceRange.endExclusive)));
            offset += e.newValue.length - e.replaceRange.length;
        }
        return new ArrayEdit(edits);
    }
}
export class ArrayReplacement extends BaseReplacement {
    constructor(range, newValue) {
        super(range);
        this.newValue = newValue;
    }
    equals(other) {
        return this.replaceRange.equals(other.replaceRange) && this.newValue.length === other.newValue.length && this.newValue.every((v, i) => v === other.newValue[i]);
    }
    getNewLength() { return this.newValue.length; }
    tryJoinTouching(other) {
        return new ArrayReplacement(this.replaceRange.joinRightTouching(other.replaceRange), this.newValue.concat(other.newValue));
    }
    slice(range, rangeInReplacement) {
        return new ArrayReplacement(range, rangeInReplacement.slice(this.newValue));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJyYXlFZGl0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb21tb24vY29yZS9lZGl0cy9hcnJheUVkaXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxRQUFRLEVBQUUsZUFBZSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBRXREOzs7RUFHRTtBQUNGLE1BQU0sT0FBTyxTQUFhLFNBQVEsUUFBMkM7YUFDckQsVUFBSyxHQUFHLElBQUksU0FBUyxDQUFRLEVBQUUsQ0FBQyxDQUFDO0lBRWpELE1BQU0sQ0FBQyxNQUFNLENBQUksWUFBNEM7UUFDbkUsT0FBTyxJQUFJLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRU0sTUFBTSxDQUFDLE1BQU0sQ0FBSSxXQUFnQztRQUN2RCxPQUFPLElBQUksU0FBUyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRU0sTUFBTSxDQUFDLE9BQU8sQ0FBSSxLQUFrQixFQUFFLFdBQXlCO1FBQ3JFLE9BQU8sSUFBSSxTQUFTLENBQUMsQ0FBQyxJQUFJLGdCQUFnQixDQUFDLEtBQUssRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEUsQ0FBQztJQUVNLE1BQU0sQ0FBQyxNQUFNLENBQUksTUFBYyxFQUFFLFdBQXlCO1FBQ2hFLE9BQU8sSUFBSSxTQUFTLENBQUMsQ0FBQyxJQUFJLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3hGLENBQUM7SUFFTSxNQUFNLENBQUMsTUFBTSxDQUFJLEtBQWtCO1FBQ3pDLE9BQU8sSUFBSSxTQUFTLENBQUMsQ0FBQyxJQUFJLGdC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