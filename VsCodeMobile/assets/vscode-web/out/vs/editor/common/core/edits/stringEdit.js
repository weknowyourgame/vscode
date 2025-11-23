/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { commonPrefixLength, commonSuffixLength } from '../../../../base/common/strings.js';
import { OffsetRange } from '../ranges/offsetRange.js';
import { StringText } from '../text/abstractText.js';
import { BaseEdit, BaseReplacement } from './edit.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class BaseStringEdit extends BaseEdit {
    get TReplacement() {
        throw new Error('TReplacement is not defined for BaseStringEdit');
    }
    static composeOrUndefined(edits) {
        if (edits.length === 0) {
            return undefined;
        }
        let result = edits[0];
        for (let i = 1; i < edits.length; i++) {
            // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
            result = result.compose(edits[i]);
        }
        return result;
    }
    /**
     * r := trySwap(e1, e2);
     * e1.compose(e2) === r.e1.compose(r.e2)
    */
    static trySwap(e1, e2) {
        // TODO make this more efficient
        const e1Inv = e1.inverseOnSlice((start, endEx) => ' '.repeat(endEx - start));
        const e1_ = e2.tryRebase(e1Inv);
        if (!e1_) {
            return undefined;
        }
        const e2_ = e1.tryRebase(e1_);
        if (!e2_) {
            return undefined;
        }
        return { e1: e1_, e2: e2_ };
    }
    apply(base) {
        const resultText = [];
        let pos = 0;
        for (const edit of this.replacements) {
            resultText.push(base.substring(pos, edit.replaceRange.start));
            resultText.push(edit.newText);
            pos = edit.replaceRange.endExclusive;
        }
        resultText.push(base.substring(pos));
        return resultText.join('');
    }
    /**
     * Creates an edit that reverts this edit.
     */
    inverseOnSlice(getOriginalSlice) {
        const edits = [];
        let offset = 0;
        for (const e of this.replacements) {
            edits.push(StringReplacement.replace(OffsetRange.ofStartAndLength(e.replaceRange.start + offset, e.newText.length), getOriginalSlice(e.replaceRange.start, e.replaceRange.endExclusive)));
            offset += e.newText.length - e.replaceRange.length;
        }
        return new StringEdit(edits);
    }
    /**
     * Creates an edit that reverts this edit.
     */
    inverse(original) {
        return this.inverseOnSlice((start, endEx) => original.substring(start, endEx));
    }
    rebaseSkipConflicting(base) {
        return this._tryRebase(base, false);
    }
    tryRebase(base) {
        return this._tryRebase(base, true);
    }
    _tryRebase(base, noOverlap) {
        const newEdits = [];
        let baseIdx = 0;
        let ourIdx = 0;
        let offset = 0;
        while (ourIdx < this.replacements.length || baseIdx < base.replacements.length) {
            // take the edit that starts first
            const baseEdit = base.replacements[baseIdx];
            const ourEdit = this.replacements[ourIdx];
            if (!ourEdit) {
                // We processed all our edits
                break;
            }
            else if (!baseEdit) {
                // no more edits from base
                newEdits.push(new StringReplacement(ourEdit.replaceRange.delta(offset), ourEdit.newText));
                ourIdx++;
            }
            else if (ourEdit.replaceRange.intersectsOrTouches(baseEdit.replaceRange)) {
                ourIdx++; // Don't take our edit, as it is conflicting -> skip
                if (noOverlap) {
                    return undefined;
                }
            }
            else if (ourEdit.replaceRange.start < baseEdit.replaceRange.start) {
                // Our edit starts first
                newEdits.push(new StringReplacement(ourEdit.replaceRange.delta(offset), ourEdit.newText));
                ourIdx++;
            }
            else {
                baseIdx++;
                offset += baseEdit.newText.length - baseEdit.replaceRange.length;
            }
        }
        return new StringEdit(newEdits);
    }
    toJson() {
        return this.replacements.map(e => e.toJson());
    }
    isNeutralOn(text) {
        return this.replacements.every(e => e.isNeutralOn(text));
    }
    removeCommonSuffixPrefix(originalText) {
        const edits = [];
        for (const e of this.replacements) {
            const edit = e.removeCommonSuffixPrefix(originalText);
            if (!edit.isEmpty) {
                edits.push(edit);
            }
        }
        return new StringEdit(edits);
    }
    normalizeEOL(eol) {
        return new StringEdit(this.replacements.map(edit => edit.normalizeEOL(eol)));
    }
    /**
     * If `e1.apply(source) === e2.apply(source)`, then `e1.normalizeOnSource(source).equals(e2.normalizeOnSource(source))`.
    */
    normalizeOnSource(source) {
        const result = this.apply(source);
        const edit = StringReplacement.replace(OffsetRange.ofLength(source.length), result);
        const e = edit.removeCommonSuffixAndPrefix(source);
        if (e.isEmpty) {
            return StringEdit.empty;
        }
        return e.toEdit();
    }
    removeCommonSuffixAndPrefix(source) {
        return this._createNew(this.replacements.map(e => e.removeCommonSuffixAndPrefix(source))).normalize();
    }
    applyOnText(docContents) {
        return new StringText(this.apply(docContents.value));
    }
    mapData(f) {
        return new AnnotatedStringEdit(this.replacements.map(e => new AnnotatedStringReplacement(e.replaceRange, e.newText, f(e))));
    }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class BaseStringReplacement extends BaseReplacement {
    constructor(range, newText) {
        super(range);
        this.newText = newText;
    }
    getNewLength() { return this.newText.length; }
    toString() {
        return `${this.replaceRange} -> ${JSON.stringify(this.newText)}`;
    }
    replace(str) {
        return str.substring(0, this.replaceRange.start) + this.newText + str.substring(this.replaceRange.endExclusive);
    }
    /**
     * Checks if the edit would produce no changes when applied to the given text.
     */
    isNeutralOn(text) {
        return this.newText === text.substring(this.replaceRange.start, this.replaceRange.endExclusive);
    }
    removeCommonSuffixPrefix(originalText) {
        const oldText = originalText.substring(this.replaceRange.start, this.replaceRange.endExclusive);
        const prefixLen = commonPrefixLength(oldText, this.newText);
        const suffixLen = Math.min(oldText.length - prefixLen, this.newText.length - prefixLen, commonSuffixLength(oldText, this.newText));
        const replaceRange = new OffsetRange(this.replaceRange.start + prefixLen, this.replaceRange.endExclusive - suffixLen);
        const newText = this.newText.substring(prefixLen, this.newText.length - suffixLen);
        return new StringReplacement(replaceRange, newText);
    }
    normalizeEOL(eol) {
        const newText = this.newText.replace(/\r\n|\n/g, eol);
        return new StringReplacement(this.replaceRange, newText);
    }
    removeCommonSuffixAndPrefix(source) {
        return this.removeCommonSuffix(source).removeCommonPrefix(source);
    }
    removeCommonPrefix(source) {
        const oldText = this.replaceRange.substring(source);
        const prefixLen = commonPrefixLength(oldText, this.newText);
        if (prefixLen === 0) {
            return this;
        }
        return this.slice(this.replaceRange.deltaStart(prefixLen), new OffsetRange(prefixLen, this.newText.length));
    }
    removeCommonSuffix(source) {
        const oldText = this.replaceRange.substring(source);
        const suffixLen = commonSuffixLength(oldText, this.newText);
        if (suffixLen === 0) {
            return this;
        }
        return this.slice(this.replaceRange.deltaEnd(-suffixLen), new OffsetRange(0, this.newText.length - suffixLen));
    }
    toEdit() {
        return new StringEdit([this]);
    }
    toJson() {
        return ({
            txt: this.newText,
            pos: this.replaceRange.start,
            len: this.replaceRange.length,
        });
    }
}
/**
 * Represents a set of replacements to a string.
 * All these replacements are applied at once.
*/
export class StringEdit extends BaseStringEdit {
    static { this.empty = new StringEdit([]); }
    static create(replacements) {
        return new StringEdit(replacements);
    }
    static single(replacement) {
        return new StringEdit([replacement]);
    }
    static replace(range, replacement) {
        return new StringEdit([new StringReplacement(range, replacement)]);
    }
    static insert(offset, replacement) {
        return new StringEdit([new StringReplacement(OffsetRange.emptyAt(offset), replacement)]);
    }
    static delete(range) {
        return new StringEdit([new StringReplacement(range, '')]);
    }
    static fromJson(data) {
        return new StringEdit(data.map(StringReplacement.fromJson));
    }
    static compose(edits) {
        if (edits.length === 0) {
            return StringEdit.empty;
        }
        let result = edits[0];
        for (let i = 1; i < edits.length; i++) {
            result = result.compose(edits[i]);
        }
        return result;
    }
    /**
     * The replacements are applied in order!
     * Equals `StringEdit.compose(replacements.map(r => r.toEdit()))`, but is much more performant.
    */
    static composeSequentialReplacements(replacements) {
        let edit = StringEdit.empty;
        let curEditReplacements = []; // These are reverse sorted
        for (const r of replacements) {
            const last = curEditReplacements.at(-1);
            if (!last || r.replaceRange.isBefore(last.replaceRange)) {
                // Detect subsequences of reverse sorted replacements
                curEditReplacements.push(r);
            }
            else {
                // Once the subsequence is broken, compose the current replacements and look for a new subsequence.
                edit = edit.compose(StringEdit.create(curEditReplacements.reverse()));
                curEditReplacements = [r];
            }
        }
        edit = edit.compose(StringEdit.create(curEditReplacements.reverse()));
        return edit;
    }
    constructor(replacements) {
        super(replacements);
    }
    _createNew(replacements) {
        return new StringEdit(replacements);
    }
}
export class StringReplacement extends BaseStringReplacement {
    static insert(offset, text) {
        return new StringReplacement(OffsetRange.emptyAt(offset), text);
    }
    static replace(range, text) {
        return new StringReplacement(range, text);
    }
    static delete(range) {
        return new StringReplacement(range, '');
    }
    static fromJson(data) {
        return new StringReplacement(OffsetRange.ofStartAndLength(data.pos, data.len), data.txt);
    }
    equals(other) {
        return this.replaceRange.equals(other.replaceRange) && this.newText === other.newText;
    }
    tryJoinTouching(other) {
        return new StringReplacement(this.replaceRange.joinRightTouching(other.replaceRange), this.newText + other.newText);
    }
    slice(range, rangeInReplacement) {
        return new StringReplacement(range, rangeInReplacement ? rangeInReplacement.substring(this.newText) : this.newText);
    }
}
export function applyEditsToRanges(sortedRanges, edit) {
    sortedRanges = sortedRanges.slice();
    // treat edits as deletion of the replace range and then as insertion that extends the first range
    const result = [];
    let offset = 0;
    for (const e of edit.replacements) {
        while (true) {
            // ranges before the current edit
            const r = sortedRanges[0];
            if (!r || r.endExclusive >= e.replaceRange.start) {
                break;
            }
            sortedRanges.shift();
            result.push(r.delta(offset));
        }
        const intersecting = [];
        while (true) {
            const r = sortedRanges[0];
            if (!r || !r.intersectsOrTouches(e.replaceRange)) {
                break;
            }
            sortedRanges.shift();
            intersecting.push(r);
        }
        for (let i = intersecting.length - 1; i >= 0; i--) {
            let r = intersecting[i];
            const overlap = r.intersect(e.replaceRange).length;
            r = r.deltaEnd(-overlap + (i === 0 ? e.newText.length : 0));
            const rangeAheadOfReplaceRange = r.start - e.replaceRange.start;
            if (rangeAheadOfReplaceRange > 0) {
                r = r.delta(-rangeAheadOfReplaceRange);
            }
            if (i !== 0) {
                r = r.delta(e.newText.length);
            }
            // We already took our offset into account.
            // Because we add r back to the queue (which then adds offset again),
            // we have to remove it here.
            r = r.delta(-(e.newText.length - e.replaceRange.length));
            sortedRanges.unshift(r);
        }
        offset += e.newText.length - e.replaceRange.length;
    }
    while (true) {
        const r = sortedRanges[0];
        if (!r) {
            break;
        }
        sortedRanges.shift();
        result.push(r.delta(offset));
    }
    return result;
}
export class VoidEditData {
    join(other) {
        return this;
    }
}
/**
 * Represents a set of replacements to a string.
 * All these replacements are applied at once.
*/
export class AnnotatedStringEdit extends BaseStringEdit {
    static { this.empty = new AnnotatedStringEdit([]); }
    static create(replacements) {
        return new AnnotatedStringEdit(replacements);
    }
    static single(replacement) {
        return new AnnotatedStringEdit([replacement]);
    }
    static replace(range, replacement, data) {
        return new AnnotatedStringEdit([new AnnotatedStringReplacement(range, replacement, data)]);
    }
    static insert(offset, replacement, data) {
        return new AnnotatedStringEdit([new AnnotatedStringReplacement(OffsetRange.emptyAt(offset), replacement, data)]);
    }
    static delete(range, data) {
        return new AnnotatedStringEdit([new AnnotatedStringReplacement(range, '', data)]);
    }
    static compose(edits) {
        if (edits.length === 0) {
            return AnnotatedStringEdit.empty;
        }
        let result = edits[0];
        for (let i = 1; i < edits.length; i++) {
            result = result.compose(edits[i]);
        }
        return result;
    }
    constructor(replacements) {
        super(replacements);
    }
    _createNew(replacements) {
        return new AnnotatedStringEdit(replacements);
    }
    toStringEdit(filter) {
        const newReplacements = [];
        for (const r of this.replacements) {
            if (!filter || filter(r)) {
                newReplacements.push(new StringReplacement(r.replaceRange, r.newText));
            }
        }
        return new StringEdit(newReplacements);
    }
}
export class AnnotatedStringReplacement extends BaseStringReplacement {
    static insert(offset, text, data) {
        return new AnnotatedStringReplacement(OffsetRange.emptyAt(offset), text, data);
    }
    static replace(range, text, data) {
        return new AnnotatedStringReplacement(range, text, data);
    }
    static delete(range, data) {
        return new AnnotatedStringReplacement(range, '', data);
    }
    constructor(range, newText, data) {
        super(range, newText);
        this.data = data;
    }
    equals(other) {
        return this.replaceRange.equals(other.replaceRange) && this.newText === other.newText && this.data === other.data;
    }
    tryJoinTouching(other) {
        const joined = this.data.join(other.data);
        if (joined === undefined) {
            return undefined;
        }
        return new AnnotatedStringReplacement(this.replaceRange.joinRightTouching(other.replaceRange), this.newText + other.newText, joined);
    }
    slice(range, rangeInReplacement) {
        return new AnnotatedStringReplacement(range, rangeInReplacement ? rangeInReplacement.substring(this.newText) : this.newText, this.data);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RyaW5nRWRpdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL2NvcmUvZWRpdHMvc3RyaW5nRWRpdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM1RixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDdkQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ3JELE9BQU8sRUFBRSxRQUFRLEVBQUUsZUFBZSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBR3RELDhEQUE4RDtBQUM5RCxNQUFNLE9BQWdCLGNBQW1KLFNBQVEsUUFBa0I7SUFDbE0sSUFBSSxZQUFZO1FBQ2YsTUFBTSxJQUFJLEtBQUssQ0FBQyxnREFBZ0QsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFFTSxNQUFNLENBQUMsa0JBQWtCLENBQTJCLEtBQW1CO1FBQzdFLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUN4QixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBQ0QsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDdkMsdUZBQXVGO1lBQ3ZGLE1BQU0sR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBUSxDQUFDO1FBQzFDLENBQUM7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFFRDs7O01BR0U7SUFDSyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQWtCLEVBQUUsRUFB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