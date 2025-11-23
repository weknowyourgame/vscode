/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { compareBy, concatArrays, numberComparator } from '../../../../../base/common/arrays.js';
import { findLast } from '../../../../../base/common/arraysFind.js';
import { assertFn, checkAdjacentItems } from '../../../../../base/common/assert.js';
import { BugIndicatingError } from '../../../../../base/common/errors.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { LineRangeEdit } from './editing.js';
import { MergeEditorLineRange } from './lineRange.js';
import { addLength, lengthBetweenPositions, rangeContainsPosition, rangeIsBeforeOrTouching } from './rangeUtils.js';
/**
 * Represents a mapping of an input line range to an output line range.
*/
export class LineRangeMapping {
    static join(mappings) {
        return mappings.reduce((acc, cur) => acc ? acc.join(cur) : cur, undefined);
    }
    constructor(inputRange, outputRange) {
        this.inputRange = inputRange;
        this.outputRange = outputRange;
    }
    extendInputRange(extendedInputRange) {
        if (!extendedInputRange.containsRange(this.inputRange)) {
            throw new BugIndicatingError();
        }
        const startDelta = extendedInputRange.startLineNumber - this.inputRange.startLineNumber;
        const endDelta = extendedInputRange.endLineNumberExclusive - this.inputRange.endLineNumberExclusive;
        return new LineRangeMapping(extendedInputRange, MergeEditorLineRange.fromLength(this.outputRange.startLineNumber + startDelta, this.outputRange.length - startDelta + endDelta));
    }
    join(other) {
        return new LineRangeMapping(this.inputRange.join(other.inputRange), this.outputRange.join(other.outputRange));
    }
    get resultingDeltaFromOriginalToModified() {
        return this.outputRange.endLineNumberExclusive - this.inputRange.endLineNumberExclusive;
    }
    toString() {
        return `${this.inputRange.toString()} -> ${this.outputRange.toString()}`;
    }
    addOutputLineDelta(delta) {
        return new LineRangeMapping(this.inputRange, this.outputRange.delta(delta));
    }
    addInputLineDelta(delta) {
        return new LineRangeMapping(this.inputRange.delta(delta), this.outputRange);
    }
    reverse() {
        return new LineRangeMapping(this.outputRange, this.inputRange);
    }
}
/**
* Represents a total monotonous mapping of line ranges in one document to another document.
*/
export class DocumentLineRangeMap {
    static betweenOutputs(inputToOutput1, inputToOutput2, inputLineCount) {
        const alignments = MappingAlignment.compute(inputToOutput1, inputToOutput2);
        const mappings = alignments.map((m) => new LineRangeMapping(m.output1Range, m.output2Range));
        return new DocumentLineRangeMap(mappings, inputLineCount);
    }
    constructor(
    /**
     * The line range mappings that define this document mapping.
     * The space between two input ranges must equal the space between two output ranges.
     * These holes act as dense sequence of 1:1 line mappings.
    */
    lineRangeMappings, inputLineCount) {
        this.lineRangeMappings = lineRangeMappings;
        this.inputLineCount = inputLineCount;
        assertFn(() => {
            return checkAdjacentItems(lineRangeMappings, (m1, m2) => m1.inputRange.isBefore(m2.inputRange) && m1.outputRange.isBefore(m2.outputRange) &&
                m2.inputRange.startLineNumber - m1.inputRange.endLineNumberExclusive === m2.outputRange.startLineNumber - m1.outputRange.endLineNumberExclusive);
        });
    }
    project(lineNumber) {
        const lastBefore = findLast(this.lineRangeMappings, r => r.inputRange.startLineNumber <= lineNumber);
        if (!lastBefore) {
            return new LineRangeMapping(MergeEditorLineRange.fromLength(lineNumber, 1), MergeEditorLineRange.fromLength(lineNumber, 1));
        }
        if (lastBefore.inputRange.contains(lineNumber)) {
            return lastBefore;
        }
        const containingRange = MergeEditorLineRange.fromLength(lineNumber, 1);
        const mappedRange = MergeEditorLineRange.fromLength(lineNumber +
            lastBefore.outputRange.endLineNumberExclusive -
            lastBefore.inputRange.endLineNumberExclusive, 1);
        return new LineRangeMapping(containingRange, mappedRange);
    }
    get outputLineCount() {
        const last = this.lineRangeMappings.at(-1);
        const diff = last ? last.outputRange.endLineNumberExclusive - last.inputRange.endLineNumberExclusive : 0;
        return this.inputLineCount + diff;
    }
    reverse() {
        return new DocumentLineRangeMap(this.lineRangeMappings.map(r => r.reverse()), this.outputLineCount);
    }
}
/**
 * Aligns two mappings with a common input range.
 */
export class MappingAlignment {
    static compute(fromInputToOutput1, fromInputToOutput2) {
        const compareByStartLineNumber = compareBy((d) => d.inputRange.startLineNumber, numberComparator);
        const combinedDiffs = concatArrays(fromInputToOutput1.map((diff) => ({ source: 0, diff })), fromInputToOutput2.map((diff) => ({ source: 1, diff }))).sort(compareBy((d) => d.diff, compareByStartLineNumber));
        const currentDiffs = [new Array(), new Array()];
        const deltaFromBaseToInput = [0, 0];
        const alignments = new Array();
        function pushAndReset(inputRange) {
            const mapping1 = LineRangeMapping.join(currentDiffs[0]) || new LineRangeMapping(inputRange, inputRange.delta(deltaFromBaseToInput[0]));
            const mapping2 = LineRangeMapping.join(currentDiffs[1]) || new LineRangeMapping(inputRange, inputRange.delta(deltaFromBaseToInput[1]));
            alignments.push(new MappingAlignment(currentInputRange, mapping1.extendInputRange(currentInputRange).outputRange, currentDiffs[0], mapping2.extendInputRange(currentInputRange).outputRange, currentDiffs[1]));
            currentDiffs[0] = [];
            currentDiffs[1] = [];
        }
        let currentInputRange;
        for (const diff of combinedDiffs) {
            const range = diff.diff.inputRange;
            if (currentInputRange && !currentInputRange.intersectsOrTouches(range)) {
                pushAndReset(currentInputRange);
                currentInputRange = undefined;
            }
            deltaFromBaseToInput[diff.source] =
                diff.diff.resultingDeltaFromOriginalToModified;
            currentInputRange = currentInputRange ? currentInputRange.join(range) : range;
            currentDiffs[diff.source].push(diff.diff);
        }
        if (currentInputRange) {
            pushAndReset(currentInputRange);
        }
        return alignments;
    }
    constructor(inputRange, output1Range, output1LineMappings, output2Range, output2LineMappings) {
        this.inputRange = inputRange;
        this.output1Range = output1Range;
        this.output1LineMappings = output1LineMappings;
        this.output2Range = output2Range;
        this.output2LineMappings = output2LineMappings;
    }
    toString() {
        return `${this.output1Range} <- ${this.inputRange} -> ${this.output2Range}`;
    }
}
/**
 * A line range mapping with inner range mappings.
*/
export class DetailedLineRangeMapping extends LineRangeMapping {
    static join(mappings) {
        return mappings.reduce((acc, cur) => acc ? acc.join(cur) : cur, undefined);
    }
    constructor(inputRange, inputTextModel, outputRange, outputTextModel, rangeMappings) {
        super(inputRange, outputRange);
        this.inputTextModel = inputTextModel;
        this.outputTextModel = outputTextModel;
        this.rangeMappings = rangeMappings || [new RangeMapping(this.inputRange.toExclusiveRange(), this.outputRange.toExclusiveRange())];
    }
    addOutputLineDelta(delta) {
        return new DetailedLineRangeMapping(this.inputRange, this.inputTextModel, this.outputRange.delta(delta), this.outputTextModel, this.rangeMappings.map(d => d.addOutputLineDelta(delta)));
    }
    addInputLineDelta(delta) {
        return new DetailedLineRangeMapping(this.inputRange.delta(delta), this.inputTextModel, this.outputRange, this.outputTextModel, this.rangeMappings.map(d => d.addInputLineDelta(delta)));
    }
    join(other) {
        return new DetailedLineRangeMapping(this.inputRange.join(other.inputRange), this.inputTextModel, this.outputRange.join(other.outputRange), this.outputTextModel);
    }
    getLineEdit() {
        return new LineRangeEdit(this.inputRange, this.getOutputLines());
    }
    getReverseLineEdit() {
        return new LineRangeEdit(this.outputRange, this.getInputLines());
    }
    getOutputLines() {
        return this.outputRange.getLines(this.outputTextModel);
    }
    getInputLines() {
        return this.inputRange.getLines(this.inputTextModel);
    }
}
/**
 * Represents a mapping of an input range to an output range.
*/
export class RangeMapping {
    constructor(inputRange, outputRange) {
        this.inputRange = inputRange;
        this.outputRange = outputRange;
    }
    toString() {
        function rangeToString(range) {
            // TODO@hediet make this the default Range.toString
            return `[${range.startLineNumber}:${range.startColumn}, ${range.endLineNumber}:${range.endColumn})`;
        }
        return `${rangeToString(this.inputRange)} -> ${rangeToString(this.outputRange)}`;
    }
    addOutputLineDelta(deltaLines) {
        return new RangeMapping(this.inputRange, new Range(this.outputRange.startLineNumber + deltaLines, this.outputRange.startColumn, this.outputRange.endLineNumber + deltaLines, this.outputRange.endColumn));
    }
    addInputLineDelta(deltaLines) {
        return new RangeMapping(new Range(this.inputRange.startLineNumber + deltaLines, this.inputRange.startColumn, this.inputRange.endLineNumber + deltaLines, this.inputRange.endColumn), this.outputRange);
    }
    reverse() {
        return new RangeMapping(this.outputRange, this.inputRange);
    }
}
/**
* Represents a total monotonous mapping of ranges in one document to another document.
*/
export class DocumentRangeMap {
    constructor(
    /**
     * The line range mappings that define this document mapping.
     * Can have holes.
    */
    rangeMappings, inputLineCount) {
        this.rangeMappings = rangeMappings;
        this.inputLineCount = inputLineCount;
        assertFn(() => checkAdjacentItems(rangeMappings, (m1, m2) => rangeIsBeforeOrTouching(m1.inputRange, m2.inputRange) &&
            rangeIsBeforeOrTouching(m1.outputRange, m2.outputRange) /*&&
        lengthBetweenPositions(m1.inputRange.getEndPosition(), m2.inputRange.getStartPosition()).equals(
            lengthBetweenPositions(m1.outputRange.getEndPosition(), m2.outputRange.getStartPosition())
        )*/));
    }
    project(position) {
        const lastBefore = findLast(this.rangeMappings, r => r.inputRange.getStartPosition().isBeforeOrEqual(position));
        if (!lastBefore) {
            return new RangeMapping(Range.fromPositions(position, position), Range.fromPositions(position, position));
        }
        if (rangeContainsPosition(lastBefore.inputRange, position)) {
            return lastBefore;
        }
        const dist = lengthBetweenPositions(lastBefore.inputRange.getEndPosition(), position);
        const outputPos = addLength(lastBefore.outputRange.getEndPosition(), dist);
        return new RangeMapping(Range.fromPositions(position), Range.fromPositions(outputPos));
    }
    projectRange(range) {
        const start = this.project(range.getStartPosition());
        const end = this.project(range.getEndPosition());
        return new RangeMapping(start.inputRange.plusRange(end.inputRange), start.outputRange.plusRange(end.outputRange));
    }
    get outputLineCount() {
        const last = this.rangeMappings.at(-1);
        const diff = last ? last.outputRange.endLineNumber - last.inputRange.endLineNumber : 0;
        return this.inputLineCount + diff;
    }
    reverse() {
        return new DocumentRangeMap(this.rangeMappings.map(m => m.reverse()), this.outputLineCount);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFwcGluZy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL21vZGVsL21hcHBpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRTFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUVuRSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQzdDLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ3RELE9BQU8sRUFBRSxTQUFTLEVBQUUsc0JBQXNCLEVBQUUscUJBQXFCLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUVwSDs7RUFFRTtBQUNGLE1BQU0sT0FBTyxnQkFBZ0I7SUFDckIsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFxQztRQUN2RCxPQUFPLFFBQVEsQ0FBQyxNQUFNLENBQStCLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDMUcsQ0FBQztJQUNELFlBQ2lCLFVBQWdDLEVBQ2hDLFdBQWlDO1FBRGpDLGVBQVUsR0FBVixVQUFVLENBQXNCO1FBQ2hD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