/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { sumBy } from '../../../../base/common/arrays.js';
import { BugIndicatingError } from '../../../../base/common/errors.js';
import { OffsetRange } from '../ranges/offsetRange.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class BaseEdit {
    constructor(replacements) {
        this.replacements = replacements;
        let lastEndEx = -1;
        for (const replacement of replacements) {
            if (!(replacement.replaceRange.start >= lastEndEx)) {
                throw new BugIndicatingError(`Edits must be disjoint and sorted. Found ${replacement} after ${lastEndEx}`);
            }
            lastEndEx = replacement.replaceRange.endExclusive;
        }
    }
    /**
     * Returns true if and only if this edit and the given edit are structurally equal.
     * Note that this does not mean that the edits have the same effect on a given input!
     * See `.normalize()` or `.normalizeOnBase(base)` for that.
    */
    equals(other) {
        if (this.replacements.length !== other.replacements.length) {
            return false;
        }
        for (let i = 0; i < this.replacements.length; i++) {
            if (!this.replacements[i].equals(other.replacements[i])) {
                return false;
            }
        }
        return true;
    }
    toString() {
        const edits = this.replacements.map(e => e.toString()).join(', ');
        return `[${edits}]`;
    }
    /**
     * Normalizes the edit by removing empty replacements and joining touching replacements (if the replacements allow joining).
     * Two edits have an equal normalized edit if and only if they have the same effect on any input.
     *
     * ![](https://raw.githubusercontent.com/microsoft/vscode/refs/heads/main/src/vs/editor/common/core/edits/docs/BaseEdit_normalize.drawio.png)
     *
     * Invariant:
     * ```
     * (forall base: TEdit.apply(base).equals(other.apply(base))) <-> this.normalize().equals(other.normalize())
     * ```
     * and
     * ```
     * forall base: TEdit.apply(base).equals(this.normalize().apply(base))
     * ```
     *
     */
    normalize() {
        const newReplacements = [];
        let lastReplacement;
        for (const r of this.replacements) {
            if (r.getNewLength() === 0 && r.replaceRange.length === 0) {
                continue;
            }
            if (lastReplacement && lastReplacement.replaceRange.endExclusive === r.replaceRange.start) {
                const joined = lastReplacement.tryJoinTouching(r);
                if (joined) {
                    lastReplacement = joined;
                    continue;
                }
            }
            if (lastReplacement) {
                newReplacements.push(lastReplacement);
            }
            lastReplacement = r;
        }
        if (lastReplacement) {
            newReplacements.push(lastReplacement);
        }
        return this._createNew(newReplacements);
    }
    /**
     * Combines two edits into one with the same effect.
     *
     * ![](https://raw.githubusercontent.com/microsoft/vscode/refs/heads/main/src/vs/editor/common/core/edits/docs/BaseEdit_compose.drawio.png)
     *
     * Invariant:
     * ```
     * other.apply(this.apply(s0)) = this.compose(other).apply(s0)
     * ```
     */
    compose(other) {
        const edits1 = this.normalize();
        const edits2 = other.normalize();
        if (edits1.isEmpty()) {
            return edits2;
        }
        if (edits2.isEmpty()) {
            return edits1;
        }
        const edit1Queue = [...edits1.replacements];
        const result = [];
        let edit1ToEdit2 = 0;
        for (const r2 of edits2.replacements) {
            // Copy over edit1 unmodified until it touches edit2.
            while (true) {
                const r1 = edit1Queue[0];
                if (!r1 || r1.replaceRange.start + edit1ToEdit2 + r1.getNewLength() >= r2.replaceRange.start) {
                    break;
                }
                edit1Queue.shift();
                result.push(r1);
                edit1ToEdit2 += r1.getNewLength() - r1.replaceRange.length;
            }
            const firstEdit1ToEdit2 = edit1ToEdit2;
            let firstIntersecting; // or touching
            let lastIntersecting; // or touching
            while (true) {
                const r1 = edit1Queue[0];
                if (!r1 || r1.replaceRange.start + edit1ToEdit2 > r2.replaceRange.endExclusive) {
                    break;
                }
                // else we intersect, because the new end of edit1 is after or equal to our start
                if (!firstIntersecting) {
                    firstIntersecting = r1;
                }
                lastIntersecting = r1;
                edit1Queue.shift();
                edit1ToEdit2 += r1.getNewLength() - r1.replaceRange.length;
            }
            if (!firstIntersecting) {
                result.push(r2.delta(-edit1ToEdit2));
            }
            else {
                const newReplaceRangeStart = Math.min(firstIntersecting.replaceRange.start, r2.replaceRange.start - firstEdit1ToEdit2);
                const prefixLength = r2.replaceRange.start - (firstIntersecting.replaceRange.start + firstEdit1ToEdit2);
                if (prefixLength > 0) {
                    const prefix = firstIntersecting.slice(OffsetRange.emptyAt(newReplaceRangeStart), new OffsetRange(0, prefixLength));
                    result.push(prefix);
                }
                if (!lastIntersecting) {
                    throw new BugIndicatingError(`Invariant violation: lastIntersecting is undefined`);
                }
                const suffixLength = (lastIntersecting.replaceRange.endExclusive + edit1ToEdit2) - r2.replaceRange.endExclusive;
                if (suffixLength > 0) {
                    const e = lastIntersecting.slice(OffsetRange.ofStartAndLength(lastIntersecting.replaceRange.endExclusive, 0), new OffsetRange(lastIntersecting.getNewLength() - suffixLength, lastIntersecting.getNewLength()));
                    edit1Queue.unshift(e);
                    edit1ToEdit2 -= e.getNewLength() - e.replaceRange.length;
                }
                const newReplaceRange = new OffsetRange(newReplaceRangeStart, r2.replaceRange.endExclusive - edit1ToEdit2);
                const middle = r2.slice(newReplaceRange, new OffsetRange(0, r2.getNewLength()));
                result.push(middle);
            }
        }
        while (true) {
            const item = edit1Queue.shift();
            if (!item) {
                break;
            }
            result.push(item);
        }
        return this._createNew(result).normalize();
    }
    decomposeSplit(shouldBeInE1) {
        const e1 = [];
        const e2 = [];
        let e2delta = 0;
        for (const edit of this.replacements) {
            if (shouldBeInE1(edit)) {
                e1.push(edit);
                e2delta += edit.getNewLength() - edit.replaceRange.length;
            }
            else {
                e2.push(edit.slice(edit.replaceRange.delta(e2delta), new OffsetRange(0, edit.getNewLength())));
            }
        }
        return { e1: this._createNew(e1), e2: this._createNew(e2) };
    }
    /**
     * Returns the range of each replacement in the applied value.
    */
    getNewRanges() {
        const ranges = [];
        let offset = 0;
        for (const e of this.replacements) {
            ranges.push(OffsetRange.ofStartAndLength(e.replaceRange.start + offset, e.getNewLength()));
            offset += e.getLengthDelta();
        }
        return ranges;
    }
    getJoinedReplaceRange() {
        if (this.replacements.length === 0) {
            return undefined;
        }
        return this.replacements[0].replaceRange.join(this.replacements.at(-1).replaceRange);
    }
    isEmpty() {
        return this.replacements.length === 0;
    }
    getLengthDelta() {
        return sumBy(this.replacements, (replacement) => replacement.getLengthDelta());
    }
    getNewDataLength(dataLength) {
        return dataLength + this.getLengthDelta();
    }
    applyToOffset(originalOffset) {
        let accumulatedDelta = 0;
        for (const r of this.replacements) {
            if (r.replaceRange.start <= originalOffset) {
                if (originalOffset < r.replaceRange.endExclusive) {
                    // the offset is in the replaced range
                    return r.replaceRange.start + accumulatedDelta;
                }
                accumulatedDelta += r.getNewLength() - r.replaceRange.length;
            }
            else {
                break;
            }
        }
        return originalOffset + accumulatedDelta;
    }
    applyToOffsetRange(originalRange) {
        return new OffsetRange(this.applyToOffset(originalRange.start), this.applyToOffset(originalRange.endExclusive));
    }
    applyInverseToOffset(postEditsOffset) {
        let accumulatedDelta = 0;
        for (const edit of this.replacements) {
            const editLength = edit.getNewLength();
            if (edit.replaceRange.start <= postEditsOffset - accumulatedDelta) {
                if (postEditsOffset - accumulatedDelta < edit.replaceRange.start + editLength) {
                    // the offset is in the replaced range
                    return edit.replaceRange.start;
                }
                accumulatedDelta += editLength - edit.replaceRange.length;
            }
            else {
                break;
            }
        }
        return postEditsOffset - accumulatedDelta;
    }
    /**
     * Return undefined if the originalOffset is within an edit
     */
    applyToOffsetOrUndefined(originalOffset) {
        let accumulatedDelta = 0;
        for (const edit of this.replacements) {
            if (edit.replaceRange.start <= originalOffset) {
                if (originalOffset < edit.replaceRange.endExclusive) {
                    // the offset is in the replaced range
                    return undefined;
                }
                accumulatedDelta += edit.getNewLength() - edit.replaceRange.length;
            }
            else {
                break;
            }
        }
        return originalOffset + accumulatedDelta;
    }
    /**
     * Return undefined if the originalRange is within an edit
     */
    applyToOffsetRangeOrUndefined(originalRange) {
        const start = this.applyToOffsetOrUndefined(originalRange.start);
        if (start === undefined) {
            return undefined;
        }
        const end = this.applyToOffsetOrUndefined(originalRange.endExclusive);
        if (end === undefined) {
            return undefined;
        }
        return new OffsetRange(start, end);
    }
}
export class BaseReplacement {
    constructor(
    /**
     * The range to be replaced.
    */
    replaceRange) {
        this.replaceRange = replaceRange;
    }
    delta(offset) {
        return this.slice(this.replaceRange.delta(offset), new OffsetRange(0, this.getNewLength()));
    }
    getLengthDelta() {
        return this.getNewLength() - this.replaceRange.length;
    }
    toString() {
        return `{ ${this.replaceRange.toString()} -> ${this.getNewLength()} }`;
    }
    get isEmpty() {
        return this.getNewLength() === 0 && this.replaceRange.length === 0;
    }
    getRangeAfterReplace() {
        return new OffsetRange(this.replaceRange.start, this.replaceRange.start + this.getNewLength());
    }
}
export class Edit extends BaseEdit {
    /**
     * Represents a set of edits to a string.
     * All these edits are applied at once.
    */
    static { this.empty = new Edit([]); }
    static create(replacements) {
        return new Edit(replacements);
    }
    static single(replacement) {
        return new Edit([replacement]);
    }
    _createNew(replacements) {
        return new Edit(replacements);
    }
}
export class AnnotationReplacement extends BaseReplacement {
    constructor(range, newLength, annotation) {
        super(range);
        this.newLength = newLength;
        this.annotation = annotation;
    }
    equals(other) {
        return this.replaceRange.equals(other.replaceRange) && this.newLength === other.newLength && this.annotation === other.annotation;
    }
    getNewLength() { return this.newLength; }
    tryJoinTouching(other) {
        if (this.annotation !== other.annotation) {
            return undefined;
        }
        return new AnnotationReplacement(this.replaceRange.joinRightTouching(other.replaceRange), this.newLength + other.newLength, this.annotation);
    }
    slice(range, rangeInReplacement) {
        return new AnnotationReplacement(range, rangeInReplacement ? rangeInReplacement.length : this.newLength, this.annotation);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL2NvcmUvZWRpdHMvZWRpdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDMUQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdkUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBRXZELDhEQUE4RDtBQUM5RCxNQUFNLE9BQWdCLFFBQVE7SUFDN0IsWUFDaUIsWUFBMEI7UUFBMUIsaUJBQVksR0FBWixZQUFZLENBQWM7UUFFMUMsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkIsS0FBSyxNQUFNLFdBQVcsSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUN4QyxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLEtBQUssSUFBSSxTQUFTLENBQUMsRUFBRSxDQUFDO2dCQUNwRCxNQUFNLElBQUksa0JBQWtCLENBQUMsNENBQTRDLFdBQVcsVUFBVSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBQzVHLENBQUM7WUFDRCxTQUFTLEdBQUcsV0FBVyxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUM7UUFDbkQsQ0FBQztJQUNGLENBQUM7SUFJRDs7OztNQUlFO0lBQ0ssTUFBTSxDQUFDLEtBQVk7UUFDekIsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sS0FBSyxLQUFLLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzVELE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFD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