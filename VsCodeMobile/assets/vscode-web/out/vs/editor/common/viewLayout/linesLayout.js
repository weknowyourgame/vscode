/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as strings from '../../../base/common/strings.js';
import { LineHeightsManager } from './lineHeights.js';
class PendingChanges {
    constructor() {
        this._hasPending = false;
        this._inserts = [];
        this._changes = [];
        this._removes = [];
    }
    insert(x) {
        this._hasPending = true;
        this._inserts.push(x);
    }
    change(x) {
        this._hasPending = true;
        this._changes.push(x);
    }
    remove(x) {
        this._hasPending = true;
        this._removes.push(x);
    }
    commit(linesLayout) {
        if (!this._hasPending) {
            return;
        }
        const inserts = this._inserts;
        const changes = this._changes;
        const removes = this._removes;
        this._hasPending = false;
        this._inserts = [];
        this._changes = [];
        this._removes = [];
        linesLayout._commitPendingChanges(inserts, changes, removes);
    }
}
export class EditorWhitespace {
    constructor(id, afterLineNumber, ordinal, height, minWidth) {
        this.id = id;
        this.afterLineNumber = afterLineNumber;
        this.ordinal = ordinal;
        this.height = height;
        this.minWidth = minWidth;
        this.prefixSum = 0;
    }
}
/**
 * Layouting of objects that take vertical space (by having a height) and push down other objects.
 *
 * These objects are basically either text (lines) or spaces between those lines (whitespaces).
 * This provides commodity operations for working with lines that contain whitespace that pushes lines lower (vertically).
 */
export class LinesLayout {
    static { this.INSTANCE_COUNT = 0; }
    constructor(lineCount, defaultLineHeight, paddingTop, paddingBottom, customLineHeightData) {
        this._instanceId = strings.singleLetterHash(++LinesLayout.INSTANCE_COUNT);
        this._pendingChanges = new PendingChanges();
        this._lastWhitespaceId = 0;
        this._arr = [];
        this._prefixSumValidIndex = -1;
        this._minWidth = -1; /* marker for not being computed */
        this._lineCount = lineCount;
        this._paddingTop = paddingTop;
        this._paddingBottom = paddingBottom;
        this._lineHeightsManager = new LineHeightsManager(defaultLineHeight, customLineHeightData);
    }
    /**
     * Find the insertion index for a new value inside a sorted array of values.
     * If the value is already present in the sorted array, the insertion index will be after the already existing value.
     */
    static findInsertionIndex(arr, afterLineNumber, ordinal) {
        let low = 0;
        let high = arr.length;
        while (low < high) {
            const mid = ((low + high) >>> 1);
            if (afterLineNumber === arr[mid].afterLineNumber) {
                if (ordinal < arr[mid].ordinal) {
                    high = mid;
                }
                else {
                    low = mid + 1;
                }
            }
            else if (afterLineNumber < arr[mid].afterLineNumber) {
                high = mid;
            }
            else {
                low = mid + 1;
            }
        }
        return low;
    }
    /**
     * Change the height of a line in pixels.
     */
    setDefaultLineHeight(lineHeight) {
        this._lineHeightsManager.defaultLineHeight = lineHeight;
    }
    /**
     * Changes the padding used to calculate vertical offsets.
     */
    setPadding(paddingTop, paddingBottom) {
        this._paddingTop = paddingTop;
        this._paddingBottom = paddingBottom;
    }
    /**
     * Set the number of lines.
     *
     * @param lineCount New number of lines.
     */
    onFlushed(lineCount, customLineHeightData) {
        this._lineCount = lineCount;
        this._lineHeightsManager = new LineHeightsManager(this._lineHeightsManager.defaultLineHeight, customLineHeightData);
    }
    changeLineHeights(callback) {
        let hadAChange = false;
        try {
            const accessor = {
                insertOrChangeCustomLineHeight: (decorationId, startLineNumber, endLineNumber, lineHeight) => {
                    hadAChange = true;
                    this._lineHeightsManager.insertOrChangeCustomLineHeight(decorationId, startLineNumber, endLineNumber, lineHeight);
                },
                removeCustomLineHeight: (decorationId) => {
                    hadAChange = true;
                    this._lineHeightsManager.removeCustomLineHeight(decorationId);
                }
            };
            callback(accessor);
        }
        finally {
            this._lineHeightsManager.commit();
        }
        return hadAChange;
    }
    changeWhitespace(callback) {
        let hadAChange = false;
        try {
            const accessor = {
                insertWhitespace: (afterLineNumber, ordinal, heightInPx, minWidth) => {
                    hadAChange = true;
                    afterLineNumber = afterLineNumber | 0;
                    ordinal = ordinal | 0;
                    heightInPx = heightInPx | 0;
                    minWidth = minWidth | 0;
                    const id = this._instanceId + (++this._lastWhitespaceId);
                    this._pendingChanges.insert(new EditorWhitespace(id, afterLineNumber, ordinal, heightInPx, minWidth));
                    return id;
                },
                changeOneWhitespace: (id, newAfterLineNumber, newHeight) => {
                    hadAChange = true;
                    newAfterLineNumber = newAfterLineNumber | 0;
                    newHeight = newHeight | 0;
                    this._pendingChanges.change({ id, newAfterLineNumber, newHeight });
                },
                removeWhitespace: (id) => {
                    hadAChange = true;
                    this._pendingChanges.remove({ id });
                }
            };
            callback(accessor);
        }
        finally {
            this._pendingChanges.commit(this);
        }
        return hadAChange;
    }
    _commitPendingChanges(inserts, changes, removes) {
        if (inserts.length > 0 || removes.length > 0) {
            this._minWidth = -1; /* marker for not being computed */
        }
        if (inserts.length + changes.length + removes.length <= 1) {
            // when only one thing happened, handle it "delicately"
            for (const insert of inserts) {
                this._insertWhitespace(insert);
            }
            for (const change of changes) {
                this._changeOneWhitespace(change.id, change.newAfterLineNumber, change.newHeight);
            }
            for (const remove of removes) {
                const index = this._findWhitespaceIndex(remove.id);
                if (index === -1) {
                    continue;
                }
                this._removeWhitespace(index);
            }
            return;
        }
        // simply rebuild the entire datastructure
        const toRemove = new Set();
        for (const remove of removes) {
            toRemove.add(remove.id);
        }
        const toChange = new Map();
        for (const change of changes) {
            toChange.set(change.id, change);
        }
        const applyRemoveAndChange = (whitespaces) => {
            const result = [];
            for (const whitespace of whitespaces) {
                if (toRemove.has(whitespace.id)) {
                    continue;
                }
                if (toChange.has(whitespace.id)) {
                    const change = toChange.get(whitespace.id);
                    whitespace.afterLineNumber = change.newAfterLineNumber;
                    whitespace.height = change.newHeight;
                }
                result.push(whitespace);
            }
            return result;
        };
        const result = applyRemoveAndChange(this._arr).concat(applyRemoveAndChange(inserts));
        result.sort((a, b) => {
            if (a.afterLineNumber === b.afterLineNumber) {
                return a.ordinal - b.ordinal;
            }
            return a.afterLineNumber - b.afterLineNumber;
        });
        this._arr = result;
        this._prefixSumValidIndex = -1;
    }
    _insertWhitespace(whitespace) {
        const insertIndex = LinesLayout.findInsertionIndex(this._arr, whitespace.afterLineNumber, whitespace.ordinal);
        this._arr.splice(insertIndex, 0, whitespace);
        this._prefixSumValidIndex = Math.min(this._prefixSumValidIndex, insertIndex - 1);
    }
    _findWhitespaceIndex(id) {
        const arr = this._arr;
        for (let i = 0, len = arr.length; i < len; i++) {
            if (arr[i].id === id) {
                return i;
            }
        }
        return -1;
    }
    _changeOneWhitespace(id, newAfterLineNumber, newHeight) {
        const index = this._findWhitespaceIndex(id);
        if (index === -1) {
            return;
        }
        if (this._arr[index].height !== newHeight) {
            this._arr[index].height = newHeight;
            this._prefixSumValidIndex = Math.min(this._prefixSumValidIndex, index - 1);
        }
        if (this._arr[index].afterLineNumber !== newAfterLineNumber) {
            // `afterLineNumber` changed for this whitespace
            // Record old whitespace
            const whitespace = this._arr[index];
            // Since changing `afterLineNumber` can trigger a reordering, we're gonna remove this whitespace
            this._removeWhitespace(index);
            whitespace.afterLineNumber = newAfterLineNumber;
            // And add it again
            this._insertWhitespace(whitespace);
        }
    }
    _removeWhitespace(removeIndex) {
        this._arr.splice(removeIndex, 1);
        this._prefixSumValidIndex = Math.min(this._prefixSumValidIndex, removeIndex - 1);
    }
    /**
     * Notify the layouter that lines have been deleted (a continuous zone of lines).
     *
     * @param fromLineNumber The line number at which the deletion started, inclusive
     * @param toLineNumber The line number at which the deletion ended, inclusive
     */
    onLinesDeleted(fromLineNumber, toLineNumber) {
        fromLineNumber = fromLineNumber | 0;
        toLineNumber = toLineNumber | 0;
        this._lineCount -= (toLineNumber - fromLineNumber + 1);
        for (let i = 0, len = this._arr.length; i < len; i++) {
            const afterLineNumber = this._arr[i].afterLineNumber;
            if (fromLineNumber <= afterLineNumber && afterLineNumber <= toLineNumber) {
                // The line this whitespace was after has been deleted
                //  => move whitespace to before first deleted line
                this._arr[i].afterLineNumber = fromLineNumber - 1;
            }
            else if (afterLineNumber > toLineNumber) {
                // The line this whitespace was after has been moved up
                //  => move whitespace up
                this._arr[i].afterLineNumber -= (toLineNumber - fromLineNumber + 1);
            }
        }
        this._lineHeightsManager.onLinesDeleted(fromLineNumber, toLineNumber);
    }
    /**
     * Notify the layouter that lines have been inserted (a continuous zone of lines).
     *
     * @param fromLineNumber The line number at which the insertion started, inclusive
     * @param toLineNumber The line number at which the insertion ended, inclusive.
     */
    onLinesInserted(fromLineNumber, toLineNumber) {
        fromLineNumber = fromLineNumber | 0;
        toLineNumber = toLineNumber | 0;
        this._lineCount += (toLineNumber - fromLineNumber + 1);
        for (let i = 0, len = this._arr.length; i < len; i++) {
            const afterLineNumber = this._arr[i].afterLineNumber;
            if (fromLineNumber <= afterLineNumber) {
                this._arr[i].afterLineNumber += (toLineNumber - fromLineNumber + 1);
            }
        }
        this._lineHeightsManager.onLinesInserted(fromLineNumber, toLineNumber);
    }
    /**
     * Get the sum of all the whitespaces.
     */
    getWhitespacesTotalHeight() {
        if (this._arr.length === 0) {
            return 0;
        }
        return this.getWhitespacesAccumulatedHeight(this._arr.length - 1);
    }
    /**
     * Return the sum of the heights of the whitespaces at [0..index].
     * This includes the whitespace at `index`.
     *
     * @param index The index of the whitespace.
     * @return The sum of the heights of all whitespaces before the one at `index`, including the one at `index`.
     */
    getWhitespacesAccumulatedHeight(index) {
        index = index | 0;
        let startIndex = Math.max(0, this._prefixSumValidIndex + 1);
        if (startIndex === 0) {
            this._arr[0].prefixSum = this._arr[0].height;
            startIndex++;
        }
        for (let i = startIndex; i <= index; i++) {
            this._arr[i].prefixSum = this._arr[i - 1].prefixSum + this._arr[i].height;
        }
        this._prefixSumValidIndex = Math.max(this._prefixSumValidIndex, index);
        return this._arr[index].prefixSum;
    }
    /**
     * Get the sum of heights for all objects.
     *
     * @return The sum of heights for all objects.
     */
    getLinesTotalHeight() {
        const linesHeight = this._lineHeightsManager.getAccumulatedLineHeightsIncludingLineNumber(this._lineCount);
        const whitespacesHeight = this.getWhitespacesTotalHeight();
        return linesHeight + whitespacesHeight + this._paddingTop + this._paddingBottom;
    }
    /**
     * Returns the accumulated height of whitespaces before the given line number.
     *
     * @param lineNumber The line number
     */
    getWhitespaceAccumulatedHeightBeforeLineNumber(lineNumber) {
        lineNumber = lineNumber | 0;
        const lastWhitespaceBeforeLineNumber = this._findLastWhitespaceBeforeLineNumber(lineNumber);
        if (lastWhitespaceBeforeLineNumber === -1) {
            return 0;
        }
        return this.getWhitespacesAccumulatedHeight(lastWhitespaceBeforeLineNumber);
    }
    _findLastWhitespaceBeforeLineNumber(lineNumber) {
        lineNumber = lineNumber | 0;
        // Find the whitespace before line number
        const arr = this._arr;
        let low = 0;
        let high = arr.length - 1;
        while (low <= high) {
            const delta = (high - low) | 0;
            const halfDelta = (delta / 2) | 0;
            const mid = (low + halfDelta) | 0;
            if (arr[mid].afterLineNumber < lineNumber) {
                if (mid + 1 >= arr.length || arr[mid + 1].afterLineNumber >= lineNumber) {
                    return mid;
                }
                else {
                    low = (mid + 1) | 0;
                }
            }
            else {
                high = (mid - 1) | 0;
            }
        }
        return -1;
    }
    _findFirstWhitespaceAfterLineNumber(lineNumber) {
        lineNumber = lineNumber | 0;
        const lastWhitespaceBeforeLineNumber = this._findLastWhitespaceBeforeLineNumber(lineNumber);
        const firstWhitespaceAfterLineNumber = lastWhitespaceBeforeLineNumber + 1;
        if (firstWhitespaceAfterLineNumber < this._arr.length) {
            return firstWhitespaceAfterLineNumber;
        }
        return -1;
    }
    /**
     * Find the index of the first whitespace which has `afterLineNumber` >= `lineNumber`.
     * @return The index of the first whitespace with `afterLineNumber` >= `lineNumber` or -1 if no whitespace is found.
     */
    getFirstWhitespaceIndexAfterLineNumber(lineNumber) {
        lineNumber = lineNumber | 0;
        return this._findFirstWhitespaceAfterLineNumber(lineNumber);
    }
    /**
     * Get the vertical offset (the sum of heights for all objects above) a certain line number.
     *
     * @param lineNumber The line number
     * @return The sum of heights for all objects above `lineNumber`.
     */
    getVerticalOffsetForLineNumber(lineNumber, includeViewZones = false) {
        lineNumber = lineNumber | 0;
        let previousLinesHeight;
        if (lineNumber > 1) {
            previousLinesHeight = this._lineHeightsManager.getAccumulatedLineHeightsIncludingLineNumber(lineNumber - 1);
        }
        else {
            previousLinesHeight = 0;
        }
        const previousWhitespacesHeight = this.getWhitespaceAccumulatedHeightBeforeLineNumber(lineNumber - (includeViewZones ? 1 : 0));
        return previousLinesHeight + previousWhitespacesHeight + this._paddingTop;
    }
    getLineHeightForLineNumber(lineNumber) {
        return this._lineHeightsManager.heightForLineNumber(lineNumber);
    }
    /**
     * Get the vertical offset (the sum of heights for all objects above) a certain line number and also the line height of the line.
     *
     * @param lineNumber The line number
     * @return The sum of heights for all objects above `lineNumber`.
     */
    getVerticalOffsetAfterLineNumber(lineNumber, includeViewZones = false) {
        lineNumber = lineNumber | 0;
        const previousLinesHeight = this._lineHeightsManager.getAccumulatedLineHeightsIncludingLineNumber(lineNumber);
        const previousWhitespacesHeight = this.getWhitespaceAccumulatedHeightBeforeLineNumber(lineNumber + (includeViewZones ? 1 : 0));
        return previousLinesHeight + previousWhitespacesHeight + this._paddingTop;
    }
    /**
     * Returns if there is any whitespace in the document.
     */
    hasWhitespace() {
        return this.getWhitespacesCount() > 0;
    }
    /**
     * The maximum min width for all whitespaces.
     */
    getWhitespaceMinWidth() {
        if (this._minWidth === -1) {
            let minWidth = 0;
            for (let i = 0, len = this._arr.length; i < len; i++) {
                minWidth = Math.max(minWidth, this._arr[i].minWidth);
            }
            this._minWidth = minWidth;
        }
        return this._minWidth;
    }
    /**
     * Check if `verticalOffset` is below all lines.
     */
    isAfterLines(verticalOffset) {
        const totalHeight = this.getLinesTotalHeight();
        return verticalOffset > totalHeight;
    }
    isInTopPadding(verticalOffset) {
        if (this._paddingTop === 0) {
            return false;
        }
        return (verticalOffset < this._paddingTop);
    }
    isInBottomPadding(verticalOffset) {
        if (this._paddingBottom === 0) {
            return false;
        }
        const totalHeight = this.getLinesTotalHeight();
        return (verticalOffset >= totalHeight - this._paddingBottom);
    }
    /**
     * Find the first line number that is at or after vertical offset `verticalOffset`.
     * i.e. if getVerticalOffsetForLine(line) is x and getVerticalOffsetForLine(line + 1) is y, then
     * getLineNumberAtOrAfterVerticalOffset(i) = line, x <= i < y.
     *
     * @param verticalOffset The vertical offset to search at.
     * @return The line number at or after vertical offset `verticalOffset`.
     */
    getLineNumberAtOrAfterVerticalOffset(verticalOffset) {
        verticalOffset = verticalOffset | 0;
        if (verticalOffset < 0) {
            return 1;
        }
        const linesCount = this._lineCount | 0;
        let minLineNumber = 1;
        let maxLineNumber = linesCount;
        while (minLineNumber < maxLineNumber) {
            const midLineNumber = ((minLineNumber + maxLineNumber) / 2) | 0;
            const lineHeight = this.getLineHeightForLineNumber(midLineNumber);
            const midLineNumberVerticalOffset = this.getVerticalOffsetForLineNumber(midLineNumber) | 0;
            if (verticalOffset >= midLineNumberVerticalOffset + lineHeight) {
                // vertical offset is after mid line number
                minLineNumber = midLineNumber + 1;
            }
            else if (verticalOffset >= midLineNumberVerticalOffset) {
                // Hit
                return midLineNumber;
            }
            else {
                // vertical offset is before mid line number, but mid line number could still be what we're searching for
                maxLineNumber = midLineNumber;
            }
        }
        if (minLineNumber > linesCount) {
            return linesCount;
        }
        return minLineNumber;
    }
    /**
     * Get all the lines and their relative vertical offsets that are positioned between `verticalOffset1` and `verticalOffset2`.
     *
     * @param verticalOffset1 The beginning of the viewport.
     * @param verticalOffset2 The end of the viewport.
     * @return A structure describing the lines positioned between `verticalOffset1` and `verticalOffset2`.
     */
    getLinesViewportData(verticalOffset1, verticalOffset2) {
        verticalOffset1 = verticalOffset1 | 0;
        verticalOffset2 = verticalOffset2 | 0;
        // Find first line number
        // We don't live in a perfect world, so the line number might start before or after verticalOffset1
        const startLineNumber = this.getLineNumberAtOrAfterVerticalOffset(verticalOffset1) | 0;
        const startLineNumberVerticalOffset = this.getVerticalOffsetForLineNumber(startLineNumber) | 0;
        let endLineNumber = this._lineCount | 0;
        // Also keep track of what whitespace we've got
        let whitespaceIndex = this.getFirstWhitespaceIndexAfterLineNumber(startLineNumber) | 0;
        const whitespaceCount = this.getWhitespacesCount() | 0;
        let currentWhitespaceHeight;
        let currentWhitespaceAfterLineNumber;
        if (whitespaceIndex === -1) {
            whitespaceIndex = whitespaceCount;
            currentWhitespaceAfterLineNumber = endLineNumber + 1;
            currentWhitespaceHeight = 0;
        }
        else {
            currentWhitespaceAfterLineNumber = this.getAfterLineNumberForWhitespaceIndex(whitespaceIndex) | 0;
            currentWhitespaceHeight = this.getHeightForWhitespaceIndex(whitespaceIndex) | 0;
        }
        let currentVerticalOffset = startLineNumberVerticalOffset;
        let currentLineRelativeOffset = currentVerticalOffset;
        // IE (all versions) cannot handle units above about 1,533,908 px, so every 500k pixels bring numbers down
        const STEP_SIZE = 500000;
        let bigNumbersDelta = 0;
        if (startLineNumberVerticalOffset >= STEP_SIZE) {
            // Compute a delta that guarantees that lines are positioned at `lineHeight` increments
            bigNumbersDelta = Math.floor(startLineNumberVerticalOffset / STEP_SIZE) * STEP_SIZE;
            bigNumbersDelta = Math.floor(bigNumbersDelta / this._lineHeightsManager.defaultLineHeight) * this._lineHeightsManager.defaultLineHeight;
            currentLineRelativeOffset -= bigNumbersDelta;
        }
        const linesOffsets = [];
        const verticalCenter = verticalOffset1 + (verticalOffset2 - verticalOffset1) / 2;
        let centeredLineNumber = -1;
        // Figure out how far the lines go
        for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
            const lineHeight = this.getLineHeightForLineNumber(lineNumber);
            if (centeredLineNumber === -1) {
                const currentLineTop = currentVerticalOffset;
                const currentLineBottom = currentVerticalOffset + lineHeight;
                if ((currentLineTop <= verticalCenter && verticalCenter < currentLineBottom) || currentLineTop > verticalCenter) {
                    centeredLineNumber = lineNumber;
                }
            }
            // Count current line height in the vertical offsets
            currentVerticalOffset += lineHeight;
            linesOffsets[lineNumber - startLineNumber] = currentLineRelativeOffset;
            // Next line starts immediately after this one
            currentLineRelativeOffset += lineHeight;
            while (currentWhitespaceAfterLineNumber === lineNumber) {
                // Push down next line with the height of the current whitespace
                currentLineRelativeOffset += currentWhitespaceHeight;
                // Count current whitespace in the vertical offsets
                currentVerticalOffset += currentWhitespaceHeight;
                whitespaceIndex++;
                if (whitespaceIndex >= whitespaceCount) {
                    currentWhitespaceAfterLineNumber = endLineNumber + 1;
                }
                else {
                    currentWhitespaceAfterLineNumber = this.getAfterLineNumberForWhitespaceIndex(whitespaceIndex) | 0;
                    currentWhitespaceHeight = this.getHeightForWhitespaceIndex(whitespaceIndex) | 0;
                }
            }
            if (currentVerticalOffset >= verticalOffset2) {
                // We have covered the entire viewport area, time to stop
                endLineNumber = lineNumber;
                break;
            }
        }
        if (centeredLineNumber === -1) {
            centeredLineNumber = endLineNumber;
        }
        const endLineNumberVerticalOffset = this.getVerticalOffsetForLineNumber(endLineNumber) | 0;
        let completelyVisibleStartLineNumber = startLineNumber;
        let completelyVisibleEndLineNumber = endLineNumber;
        if (completelyVisibleStartLineNumber < completelyVisibleEndLineNumber) {
            if (startLineNumberVerticalOffset < verticalOffset1) {
                completelyVisibleStartLineNumber++;
            }
        }
        if (completelyVisibleStartLineNumber < completelyVisibleEndLineNumber) {
            const endLineHeight = this.getLineHeightForLineNumber(endLineNumber);
            if (endLineNumberVerticalOffset + endLineHeight > verticalOffset2) {
                completelyVisibleEndLineNumber--;
            }
        }
        return {
            bigNumbersDelta: bigNumbersDelta,
            startLineNumber: startLineNumber,
            endLineNumber: endLineNumber,
            relativeVerticalOffset: linesOffsets,
            centeredLineNumber: centeredLineNumber,
            completelyVisibleStartLineNumber: completelyVisibleStartLineNumber,
            completelyVisibleEndLineNumber: completelyVisibleEndLineNumber,
            lineHeight: this._lineHeightsManager.defaultLineHeight,
        };
    }
    getVerticalOffsetForWhitespaceIndex(whitespaceIndex) {
        whitespaceIndex = whitespaceIndex | 0;
        const afterLineNumber = this.getAfterLineNumberForWhitespaceIndex(whitespaceIndex);
        let previousLinesHeight;
        if (afterLineNumber >= 1) {
            previousLinesHeight = this._lineHeightsManager.getAccumulatedLineHeightsIncludingLineNumber(afterLineNumber);
        }
        else {
            previousLinesHeight = 0;
        }
        let previousWhitespacesHeight;
        if (whitespaceIndex > 0) {
            previousWhitespacesHeight = this.getWhitespacesAccumulatedHeight(whitespaceIndex - 1);
        }
        else {
            previousWhitespacesHeight = 0;
        }
        return previousLinesHeight + previousWhitespacesHeight + this._paddingTop;
    }
    getWhitespaceIndexAtOrAfterVerticallOffset(verticalOffset) {
        verticalOffset = verticalOffset | 0;
        let minWhitespaceIndex = 0;
        let maxWhitespaceIndex = this.getWhitespacesCount() - 1;
        if (maxWhitespaceIndex < 0) {
            return -1;
        }
        // Special case: nothing to be found
        const maxWhitespaceVerticalOffset = this.getVerticalOffsetForWhitespaceIndex(maxWhitespaceIndex);
        const maxWhitespaceHeight = this.getHeightForWhitespaceIndex(maxWhitespaceIndex);
        if (verticalOffset >= maxWhitespaceVerticalOffset + maxWhitespaceHeight) {
            return -1;
        }
        while (minWhitespaceIndex < maxWhitespaceIndex) {
            const midWhitespaceIndex = Math.floor((minWhitespaceIndex + maxWhitespaceIndex) / 2);
            const midWhitespaceVerticalOffset = this.getVerticalOffsetForWhitespaceIndex(midWhitespaceIndex);
            const midWhitespaceHeight = this.getHeightForWhitespaceIndex(midWhitespaceIndex);
            if (verticalOffset >= midWhitespaceVerticalOffset + midWhitespaceHeight) {
                // vertical offset is after whitespace
                minWhitespaceIndex = midWhitespaceIndex + 1;
            }
            else if (verticalOffset >= midWhitespaceVerticalOffset) {
                // Hit
                return midWhitespaceIndex;
            }
            else {
                // vertical offset is before whitespace, but midWhitespaceIndex might still be what we're searching for
                maxWhitespaceIndex = midWhitespaceIndex;
            }
        }
        return minWhitespaceIndex;
    }
    /**
     * Get exactly the whitespace that is layouted at `verticalOffset`.
     *
     * @param verticalOffset The vertical offset.
     * @return Precisely the whitespace that is layouted at `verticaloffset` or null.
     */
    getWhitespaceAtVerticalOffset(verticalOffset) {
        verticalOffset = verticalOffset | 0;
        const candidateIndex = this.getWhitespaceIndexAtOrAfterVerticallOffset(verticalOffset);
        if (candidateIndex < 0) {
            return null;
        }
        if (candidateIndex >= this.getWhitespacesCount()) {
            return null;
        }
        const candidateTop = this.getVerticalOffsetForWhitespaceIndex(candidateIndex);
        if (candidateTop > verticalOffset) {
            return null;
        }
        const candidateHeight = this.getHeightForWhitespaceIndex(candidateIndex);
        const candidateId = this.getIdForWhitespaceIndex(candidateIndex);
        const candidateAfterLineNumber = this.getAfterLineNumberForWhitespaceIndex(candidateIndex);
        return {
            id: candidateId,
            afterLineNumber: candidateAfterLineNumber,
            verticalOffset: candidateTop,
            height: candidateHeight
        };
    }
    /**
     * Get a list of whitespaces that are positioned between `verticalOffset1` and `verticalOffset2`.
     *
     * @param verticalOffset1 The beginning of the viewport.
     * @param verticalOffset2 The end of the viewport.
     * @return An array with all the whitespaces in the viewport. If no whitespace is in viewport, the array is empty.
     */
    getWhitespaceViewportData(verticalOffset1, verticalOffset2) {
        verticalOffset1 = verticalOffset1 | 0;
        verticalOffset2 = verticalOffset2 | 0;
        const startIndex = this.getWhitespaceIndexAtOrAfterVerticallOffset(verticalOffset1);
        const endIndex = this.getWhitespacesCount() - 1;
        if (startIndex < 0) {
            return [];
        }
        const result = [];
        for (let i = startIndex; i <= endIndex; i++) {
            const top = this.getVerticalOffsetForWhitespaceIndex(i);
            const height = this.getHeightForWhitespaceIndex(i);
            if (top >= verticalOffset2) {
                break;
            }
            result.push({
                id: this.getIdForWhitespaceIndex(i),
                afterLineNumber: this.getAfterLineNumberForWhitespaceIndex(i),
                verticalOffset: top,
                height: height
            });
        }
        return result;
    }
    /**
     * Get all whitespaces.
     */
    getWhitespaces() {
        return this._arr.slice(0);
    }
    /**
     * The number of whitespaces.
     */
    getWhitespacesCount() {
        return this._arr.length;
    }
    /**
     * Get the `id` for whitespace at index `index`.
     *
     * @param index The index of the whitespace.
     * @return `id` of whitespace at `index`.
     */
    getIdForWhitespaceIndex(index) {
        index = index | 0;
        return this._arr[index].id;
    }
    /**
     * Get the `afterLineNumber` for whitespace at index `index`.
     *
     * @param index The index of the whitespace.
     * @return `afterLineNumber` of whitespace at `index`.
     */
    getAfterLineNumberForWhitespaceIndex(index) {
        index = index | 0;
        return this._arr[index].afterLineNumber;
    }
    /**
     * Get the `height` for whitespace at index `index`.
     *
     * @param index The index of the whitespace.
     * @return `height` of whitespace at `index`.
     */
    getHeightForWhitespaceIndex(index) {
        index = index | 0;
        return this._arr[index].height;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluZXNMYXlvdXQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi92aWV3TGF5b3V0L2xpbmVzTGF5b3V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sS0FBSyxPQUFPLE1BQU0saUNBQWlDLENBQUM7QUFDM0QsT0FBTyxFQUF5QixrQkFBa0IsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBSzdFLE1BQU0sY0FBYztJQU1uQjtRQUNDLElBQUksQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDO1FBQ3pCLElBQUksQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDO1FBQ25CLElBQUksQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDO1FBQ25CLElBQUksQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDO0lBQ3BCLENBQUM7SUFFTSxNQUFNLENBQUMsQ0FBbUI7UUFDaEMsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7UUFDeEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdkIsQ0FBQztJQUVNLE1BQU0sQ0FBQyxDQUFpQjtRQUM5QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztRQUN4QixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2QixDQUFDO0lBRU0sTUFBTSxDQUFDLENBQWlCO1FBQzlCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZCLENBQUM7SUFFTSxNQUFNLENBQUMsV0FBd0I7UUFDckMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN2QixPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLElB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