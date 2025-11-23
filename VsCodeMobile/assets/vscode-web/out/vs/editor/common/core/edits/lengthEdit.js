/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { OffsetRange } from '../ranges/offsetRange.js';
import { BaseEdit, BaseReplacement } from './edit.js';
/**
 * Like a normal edit, but only captures the length information.
*/
export class LengthEdit extends BaseEdit {
    static { this.empty = new LengthEdit([]); }
    static fromEdit(edit) {
        return new LengthEdit(edit.replacements.map(r => new LengthReplacement(r.replaceRange, r.getNewLength())));
    }
    static create(replacements) {
        return new LengthEdit(replacements);
    }
    static single(replacement) {
        return new LengthEdit([replacement]);
    }
    static replace(range, newLength) {
        return new LengthEdit([new LengthReplacement(range, newLength)]);
    }
    static insert(offset, newLength) {
        return new LengthEdit([new LengthReplacement(OffsetRange.emptyAt(offset), newLength)]);
    }
    static delete(range) {
        return new LengthEdit([new LengthReplacement(range, 0)]);
    }
    static compose(edits) {
        let e = LengthEdit.empty;
        for (const edit of edits) {
            e = e.compose(edit);
        }
        return e;
    }
    /**
     * Creates an edit that reverts this edit.
     */
    inverse() {
        const edits = [];
        let offset = 0;
        for (const e of this.replacements) {
            edits.push(new LengthReplacement(OffsetRange.ofStartAndLength(e.replaceRange.start + offset, e.newLength), e.replaceRange.length));
            offset += e.newLength - e.replaceRange.length;
        }
        return new LengthEdit(edits);
    }
    _createNew(replacements) {
        return new LengthEdit(replacements);
    }
    applyArray(arr, fillItem) {
        const newArr = new Array(this.getNewDataLength(arr.length));
        let srcPos = 0;
        let dstPos = 0;
        for (const replacement of this.replacements) {
            // Copy items before the current replacement
            for (let i = srcPos; i < replacement.replaceRange.start; i++) {
                newArr[dstPos++] = arr[i];
            }
            // Skip the replaced items in the source array
            srcPos = replacement.replaceRange.endExclusive;
            // Fill with the provided fillItem for insertions
            for (let i = 0; i < replacement.newLength; i++) {
                newArr[dstPos++] = fillItem;
            }
        }
        // Copy any remaining items from the original array
        while (srcPos < arr.length) {
            newArr[dstPos++] = arr[srcPos++];
        }
        return newArr;
    }
}
export class LengthReplacement extends BaseReplacement {
    static create(startOffset, endOffsetExclusive, newLength) {
        return new LengthReplacement(new OffsetRange(startOffset, endOffsetExclusive), newLength);
    }
    constructor(range, newLength) {
        super(range);
        this.newLength = newLength;
    }
    equals(other) {
        return this.replaceRange.equals(other.replaceRange) && this.newLength === other.newLength;
    }
    getNewLength() { return this.newLength; }
    tryJoinTouching(other) {
        return new LengthReplacement(this.replaceRange.joinRightTouching(other.replaceRange), this.newLength + other.newLength);
    }
    slice(range, rangeInReplacement) {
        return new LengthReplacement(range, rangeInReplacement.length);
    }
    toString() {
        return `[${this.replaceRange.start}, +${this.replaceRange.length}) -> +${this.newLength}}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGVuZ3RoRWRpdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL2NvcmUvZWRpdHMvbGVuZ3RoRWRpdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDdkQsT0FBTyxFQUFXLFFBQVEsRUFBRSxlQUFlLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFFL0Q7O0VBRUU7QUFDRixNQUFNLE9BQU8sVUFBVyxTQUFRLFFBQXVDO2FBQy9DLFVBQUssR0FBRyxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUUzQyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQWE7UUFDbkMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUcsQ0FBQztJQUVNLE1BQU0sQ0FBQyxNQUFNLENBQUMsWUFBMEM7UUFDOUQsT0FBTyxJQUFJLFVBQVUsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRU0sTUFBTSxDQUFDLE1BQU0sQ0FBQyxXQUE4QjtRQUNsRCxPQUFPLElBQUksVUFBVSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFrQixFQUFFLFNBQWlCO1FBQzFELE9BQU8sSUFBSSxVQUFVLENBQUMsQ0FBQyxJQUFJLGlCQUFpQixDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEUsQ0FBQztJQUVNLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBYyxFQUFF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