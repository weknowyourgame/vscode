/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { binarySearch2 } from '../../../base/common/arrays.js';
import { intersection } from '../../../base/common/collections.js';
export class CustomLine {
    constructor(decorationId, index, lineNumber, specialHeight, prefixSum) {
        this.decorationId = decorationId;
        this.index = index;
        this.lineNumber = lineNumber;
        this.specialHeight = specialHeight;
        this.prefixSum = prefixSum;
        this.maximumSpecialHeight = specialHeight;
        this.deleted = false;
    }
}
/**
 * Manages line heights in the editor with support for custom line heights from decorations.
 *
 * This class maintains an ordered collection of line heights, where each line can have either
 * the default height or a custom height specified by decorations. It supports efficient querying
 * of individual line heights as well as accumulated heights up to a specific line.
 *
 * Line heights are stored in a sorted array for efficient binary search operations. Each line
 * with custom height is represented by a {@link CustomLine} object which tracks its special height,
 * accumulated height prefix sum, and associated decoration ID.
 *
 * The class optimizes performance by:
 * - Using binary search to locate lines in the ordered array
 * - Batching updates through a pending changes mechanism
 * - Computing prefix sums for O(1) accumulated height lookup
 * - Tracking maximum height for lines with multiple decorations
 * - Efficiently handling document changes (line insertions and deletions)
 *
 * When lines are inserted or deleted, the manager updates line numbers and prefix sums
 * for all affected lines. It also handles special cases like decorations that span
 * the insertion/deletion points by re-applying those decorations appropriately.
 *
 * All query operations automatically commit pending changes to ensure consistent results.
 * Clients can modify line heights by adding or removing custom line height decorations,
 * which are tracked by their unique decoration IDs.
 */
export class LineHeightsManager {
    constructor(defaultLineHeight, customLineHeightData) {
        this._decorationIDToCustomLine = new ArrayMap();
        this._orderedCustomLines = [];
        this._pendingSpecialLinesToInsert = [];
        this._invalidIndex = 0;
        this._hasPending = false;
        this._defaultLineHeight = defaultLineHeight;
        if (customLineHeightData.length > 0) {
            for (const data of customLineHeightData) {
                this.insertOrChangeCustomLineHeight(data.decorationId, data.startLineNumber, data.endLineNumber, data.lineHeight);
            }
            this.commit();
        }
    }
    set defaultLineHeight(defaultLineHeight) {
        this._defaultLineHeight = defaultLineHeight;
    }
    get defaultLineHeight() {
        return this._defaultLineHeight;
    }
    removeCustomLineHeight(decorationID) {
        const customLines = this._decorationIDToCustomLine.get(decorationID);
        if (!customLines) {
            return;
        }
        this._decorationIDToCustomLine.delete(decorationID);
        for (const customLine of customLines) {
            customLine.deleted = true;
            this._invalidIndex = Math.min(this._invalidIndex, customLine.index);
        }
        this._hasPending = true;
    }
    insertOrChangeCustomLineHeight(decorationId, startLineNumber, endLineNumber, lineHeight) {
        this.removeCustomLineHeight(decorationId);
        for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
            const customLine = new CustomLine(decorationId, -1, lineNumber, lineHeight, 0);
            this._pendingSpecialLinesToInsert.push(customLine);
        }
        this._hasPending = true;
    }
    heightForLineNumber(lineNumber) {
        const searchIndex = this._binarySearchOverOrderedCustomLinesArray(lineNumber);
        if (searchIndex >= 0) {
            return this._orderedCustomLines[searchIndex].maximumSpecialHeight;
        }
        return this._defaultLineHeight;
    }
    getAccumulatedLineHeightsIncludingLineNumber(lineNumber) {
        const searchIndex = this._binarySearchOverOrderedCustomLinesArray(lineNumber);
        if (searchIndex >= 0) {
            return this._orderedCustomLines[searchIndex].prefixSum + this._orderedCustomLines[searchIndex].maximumSpecialHeight;
        }
        if (searchIndex === -1) {
            return this._defaultLineHeight * lineNumber;
        }
        const modifiedIndex = -(searchIndex + 1);
        const previousSpecialLine = this._orderedCustomLines[modifiedIndex - 1];
        return previousSpecialLine.prefixSum + previousSpecialLine.maximumSpecialHeight + this._defaultLineHeight * (lineNumber - previousSpecialLine.lineNumber);
    }
    onLinesDeleted(fromLineNumber, toLineNumber) {
        const deleteCount = toLineNumber - fromLineNumber + 1;
        const numberOfCustomLines = this._orderedCustomLines.length;
        const candidateStartIndexOfDeletion = this._binarySearchOverOrderedCustomLinesArray(fromLineNumber);
        let startIndexOfDeletion;
        if (candidateStartIndexOfDeletion >= 0) {
            startIndexOfDeletion = candidateStartIndexOfDeletion;
            for (let i = candidateStartIndexOfDeletion - 1; i >= 0; i--) {
                if (this._orderedCustomLines[i].lineNumber === fromLineNumber) {
                    startIndexOfDeletion--;
                }
                else {
                    break;
                }
            }
        }
        else {
            startIndexOfDeletion = candidateStartIndexOfDeletion === -(numberOfCustomLines + 1) && candidateStartIndexOfDeletion !== -1 ? numberOfCustomLines - 1 : -(candidateStartIndexOfDeletion + 1);
        }
        const candidateEndIndexOfDeletion = this._binarySearchOverOrderedCustomLinesArray(toLineNumber);
        let endIndexOfDeletion;
        if (candidateEndIndexOfDeletion >= 0) {
            endIndexOfDeletion = candidateEndIndexOfDeletion;
            for (let i = candidateEndIndexOfDeletion + 1; i < numberOfCustomLines; i++) {
                if (this._orderedCustomLines[i].lineNumber === toLineNumber) {
                    endIndexOfDeletion++;
                }
                else {
                    break;
                }
            }
        }
        else {
            endIndexOfDeletion = candidateEndIndexOfDeletion === -(numberOfCustomLines + 1) && candidateEndIndexOfDeletion !== -1 ? numberOfCustomLines - 1 : -(candidateEndIndexOfDeletion + 1);
        }
        const isEndIndexBiggerThanStartIndex = endIndexOfDeletion > startIndexOfDeletion;
        const isEndIndexEqualToStartIndexAndCoversCustomLine = endIndexOfDeletion === startIndexOfDeletion
            && this._orderedCustomLines[startIndexOfDeletion]
            && this._orderedCustomLines[startIndexOfDeletion].lineNumber >= fromLineNumber
            && this._orderedCustomLines[startIndexOfDeletion].lineNumber <= toLineNumber;
        if (isEndIndexBiggerThanStartIndex || isEndIndexEqualToStartIndexAndCoversCustomLine) {
            let maximumSpecialHeightOnDeletedInterval = 0;
            for (let i = startIndexOfDeletion; i <= endIndexOfDeletion; i++) {
                maximumSpecialHeightOnDeletedInterval = Math.max(maximumSpecialHeightOnDeletedInterval, this._orderedCustomLines[i].maximumSpecialHeight);
            }
            let prefixSumOnDeletedInterval = 0;
            if (startIndexOfDeletion > 0) {
                const previousSpecialLine = this._orderedCustomLines[startIndexOfDeletion - 1];
                prefixSumOnDeletedInterval = previousSpecialLine.prefixSum + previousSpecialLine.maximumSpecialHeight + this._defaultLineHeight * (fromLineNumber - previousSpecialLine.lineNumber - 1);
            }
            else {
                prefixSumOnDeletedInterval = fromLineNumber > 0 ? (fromLineNumber - 1) * this._defaultLineHeight : 0;
            }
            const firstSpecialLineDeleted = this._orderedCustomLines[startIndexOfDeletion];
            const lastSpecialLineDeleted = this._orderedCustomLines[endIndexOfDeletion];
            const firstSpecialLineAfterDeletion = this._orderedCustomLines[endIndexOfDeletion + 1];
            const heightOfFirstLineAfterDeletion = firstSpecialLineAfterDeletion && firstSpecialLineAfterDeletion.lineNumber === toLineNumber + 1 ? firstSpecialLineAfterDeletion.maximumSpecialHeight : this._defaultLineHeight;
            const totalHeightDeleted = lastSpecialLineDeleted.prefixSum
                + lastSpecialLineDeleted.maximumSpecialHeight
                - firstSpecialLineDeleted.prefixSum
                + this._defaultLineHeight * (toLineNumber - lastSpecialLineDeleted.lineNumber)
                + this._defaultLineHeight * (firstSpecialLineDeleted.lineNumber - fromLineNumber)
                + heightOfFirstLineAfterDeletion - maximumSpecialHeightOnDeletedInterval;
            const decorationIdsSeen = new Set();
            const newOrderedCustomLines = [];
            const newDecorationIDToSpecialLine = new ArrayMap();
            let numberOfDeletions = 0;
            for (let i = 0; i < this._orderedCustomLines.length; i++) {
                const customLine = this._orderedCustomLines[i];
                if (i < startIndexOfDeletion) {
                    newOrderedCustomLines.push(customLine);
                    newDecorationIDToSpecialLine.add(customLine.decorationId, customLine);
                }
                else if (i >= startIndexOfDeletion && i <= endIndexOfDeletion) {
                    const decorationId = customLine.decorationId;
                    if (!decorationIdsSeen.has(decorationId)) {
                        customLine.index -= numberOfDeletions;
                        customLine.lineNumber = fromLineNumber;
                        customLine.prefixSum = prefixSumOnDeletedInterval;
                        customLine.maximumSpecialHeight = maximumSpecialHeightOnDeletedInterval;
                        newOrderedCustomLines.push(customLine);
                        newDecorationIDToSpecialLine.add(customLine.decorationId, customLine);
                    }
                    else {
                        numberOfDeletions++;
                    }
                }
                else if (i > endIndexOfDeletion) {
                    customLine.index -= numberOfDeletions;
                    customLine.lineNumber -= deleteCount;
                    customLine.prefixSum -= totalHeightDeleted;
                    newOrderedCustomLines.push(customLine);
                    newDecorationIDToSpecialLine.add(customLine.decorationId, customLine);
                }
                decorationIdsSeen.add(customLine.decorationId);
            }
            this._orderedCustomLines = newOrderedCustomLines;
            this._decorationIDToCustomLine = newDecorationIDToSpecialLine;
        }
        else {
            const totalHeightDeleted = deleteCount * this._defaultLineHeight;
            for (let i = endIndexOfDeletion; i < this._orderedCustomLines.length; i++) {
                const customLine = this._orderedCustomLines[i];
                if (customLine.lineNumber > toLineNumber) {
                    customLine.lineNumber -= deleteCount;
                    customLine.prefixSum -= totalHeightDeleted;
                }
            }
        }
    }
    onLinesInserted(fromLineNumber, toLineNumber) {
        const insertCount = toLineNumber - fromLineNumber + 1;
        const candidateStartIndexOfInsertion = this._binarySearchOverOrderedCustomLinesArray(fromLineNumber);
        let startIndexOfInsertion;
        if (candidateStartIndexOfInsertion >= 0) {
            startIndexOfInsertion = candidateStartIndexOfInsertion;
            for (let i = candidateStartIndexOfInsertion - 1; i >= 0; i--) {
                if (this._orderedCustomLines[i].lineNumber === fromLineNumber) {
                    startIndexOfInsertion--;
                }
                else {
                    break;
                }
            }
        }
        else {
            startIndexOfInsertion = -(candidateStartIndexOfInsertion + 1);
        }
        const toReAdd = [];
        const decorationsImmediatelyAfter = new Set();
        for (let i = startIndexOfInsertion; i < this._orderedCustomLines.length; i++) {
            if (this._orderedCustomLines[i].lineNumber === fromLineNumber) {
                decorationsImmediatelyAfter.add(this._orderedCustomLines[i].decorationId);
            }
        }
        const decorationsImmediatelyBefore = new Set();
        for (let i = startIndexOfInsertion - 1; i >= 0; i--) {
            if (this._orderedCustomLines[i].lineNumber === fromLineNumber - 1) {
                decorationsImmediatelyBefore.add(this._orderedCustomLines[i].decorationId);
            }
        }
        const decorationsWithGaps = intersection(decorationsImmediatelyBefore, decorationsImmediatelyAfter);
        for (let i = startIndexOfInsertion; i < this._orderedCustomLines.length; i++) {
            this._orderedCustomLines[i].lineNumber += insertCount;
            this._orderedCustomLines[i].prefixSum += this._defaultLineHeight * insertCount;
        }
        if (decorationsWithGaps.size > 0) {
            for (const decorationId of decorationsWithGaps) {
                const decoration = this._decorationIDToCustomLine.get(decorationId);
                if (decoration) {
                    const startLineNumber = decoration.reduce((min, l) => Math.min(min, l.lineNumber), fromLineNumber); // min
                    const endLineNumber = decoration.reduce((max, l) => Math.max(max, l.lineNumber), fromLineNumber); // max
                    const lineHeight = decoration.reduce((max, l) => Math.max(max, l.specialHeight), 0);
                    toReAdd.push({
                        decorationId,
                        startLineNumber,
                        endLineNumber,
                        lineHeight
                    });
                }
            }
            for (const dec of toReAdd) {
                this.insertOrChangeCustomLineHeight(dec.decorationId, dec.startLineNumber, dec.endLineNumber, dec.lineHeight);
            }
            this.commit();
        }
    }
    commit() {
        if (!this._hasPending) {
            return;
        }
        for (const pendingChange of this._pendingSpecialLinesToInsert) {
            const candidateInsertionIndex = this._binarySearchOverOrderedCustomLinesArray(pendingChange.lineNumber);
            const insertionIndex = candidateInsertionIndex >= 0 ? candidateInsertionIndex : -(candidateInsertionIndex + 1);
            this._orderedCustomLines.splice(insertionIndex, 0, pendingChange);
            this._invalidIndex = Math.min(this._invalidIndex, insertionIndex);
        }
        this._pendingSpecialLinesToInsert = [];
        const newDecorationIDToSpecialLine = new ArrayMap();
        const newOrderedSpecialLines = [];
        for (let i = 0; i < this._invalidIndex; i++) {
            const customLine = this._orderedCustomLines[i];
            newOrderedSpecialLines.push(customLine);
            newDecorationIDToSpecialLine.add(customLine.decorationId, customLine);
        }
        let numberOfDeletions = 0;
        let previousSpecialLine = (this._invalidIndex > 0) ? newOrderedSpecialLines[this._invalidIndex - 1] : undefined;
        for (let i = this._invalidIndex; i < this._orderedCustomLines.length; i++) {
            const customLine = this._orderedCustomLines[i];
            if (customLine.deleted) {
                numberOfDeletions++;
                continue;
            }
            customLine.index = i - numberOfDeletions;
            if (previousSpecialLine && previousSpecialLine.lineNumber === customLine.lineNumber) {
                customLine.maximumSpecialHeight = previousSpecialLine.maximumSpecialHeight;
                customLine.prefixSum = previousSpecialLine.prefixSum;
            }
            else {
                let maximumSpecialHeight = customLine.specialHeight;
                for (let j = i; j < this._orderedCustomLines.length; j++) {
                    const nextSpecialLine = this._orderedCustomLines[j];
                    if (nextSpecialLine.deleted) {
                        continue;
                    }
                    if (nextSpecialLine.lineNumber !== customLine.lineNumber) {
                        break;
                    }
                    maximumSpecialHeight = Math.max(maximumSpecialHeight, nextSpecialLine.specialHeight);
                }
                customLine.maximumSpecialHeight = maximumSpecialHeight;
                let prefixSum;
                if (previousSpecialLine) {
                    prefixSum = previousSpecialLine.prefixSum + previousSpecialLine.maximumSpecialHeight + this._defaultLineHeight * (customLine.lineNumber - previousSpecialLine.lineNumber - 1);
                }
                else {
                    prefixSum = this._defaultLineHeight * (customLine.lineNumber - 1);
                }
                customLine.prefixSum = prefixSum;
            }
            previousSpecialLine = customLine;
            newOrderedSpecialLines.push(customLine);
            newDecorationIDToSpecialLine.add(customLine.decorationId, customLine);
        }
        this._orderedCustomLines = newOrderedSpecialLines;
        this._decorationIDToCustomLine = newDecorationIDToSpecialLine;
        this._invalidIndex = Infinity;
        this._hasPending = false;
    }
    _binarySearchOverOrderedCustomLinesArray(lineNumber) {
        return binarySearch2(this._orderedCustomLines.length, (index) => {
            const line = this._orderedCustomLines[index];
            if (line.lineNumber === lineNumber) {
                return 0;
            }
            else if (line.lineNumber < lineNumber) {
                return -1;
            }
            else {
                return 1;
            }
        });
    }
}
class ArrayMap {
    constructor() {
        this._map = new Map();
    }
    add(key, value) {
        const array = this._map.get(key);
        if (!array) {
            this._map.set(key, [value]);
        }
        else {
            array.push(value);
        }
    }
    get(key) {
        return this._map.get(key);
    }
    delete(key) {
        this._map.delete(key);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluZUhlaWdodHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi92aWV3TGF5b3V0L2xpbmVIZWlnaHRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFbkUsTUFBTSxPQUFPLFVBQVU7SUFVdEIsWUFBWSxZQUFvQixFQUFFLEtBQWEsRUFBRSxVQUFrQixFQUFFLGFBQXFCLEVBQUUsU0FBaUI7UUFDNUcsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7UUFDakMsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7UUFDN0IsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDbkMsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDM0IsSUFBSSxDQUFDLG9CQUFvQixHQUFHLGFBQWEsQ0FBQztRQUMxQyxJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQztJQUN0QixDQUFDO0NBQ0Q7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXlCRztBQUNILE1BQU0sT0FBTyxrQkFBa0I7SUFTOUIsWUFBWSxpQkFBeUIsRUFBRSxvQkFBNkM7UUFQNUUsOEJBQXlCLEdBQWlDLElBQUksUUFBUSxFQUFzQixDQUFDO1FBQzdGLHdCQUFtQixHQUFpQixFQUFFLENBQUM7UUFDdkMsaUNBQTRCLEdBQWlCLEVBQUUsQ0FBQztRQUNoRCxrQkFBYSxHQUFXLENBQUMsQ0FBQztRQUUxQixnQkFBVyxHQUFZLEtBQUssQ0FBQztRQUdwQyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsaUJBQWlCLENBQUM7UUFDNUMs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