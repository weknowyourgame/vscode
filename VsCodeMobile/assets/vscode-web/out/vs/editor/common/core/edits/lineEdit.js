/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { compareBy, groupAdjacentBy, numberComparator } from '../../../../base/common/arrays.js';
import { assert, checkAdjacentItems } from '../../../../base/common/assert.js';
import { splitLines } from '../../../../base/common/strings.js';
import { LineRange } from '../ranges/lineRange.js';
import { StringEdit, StringReplacement } from './stringEdit.js';
import { Position } from '../position.js';
import { Range } from '../range.js';
import { TextReplacement, TextEdit } from './textEdit.js';
export class LineEdit {
    static { this.empty = new LineEdit([]); }
    static deserialize(data) {
        return new LineEdit(data.map(e => LineReplacement.deserialize(e)));
    }
    static fromStringEdit(edit, initialValue) {
        const textEdit = TextEdit.fromStringEdit(edit, initialValue);
        return LineEdit.fromTextEdit(textEdit, initialValue);
    }
    static fromTextEdit(edit, initialValue) {
        const edits = edit.replacements;
        const result = [];
        const currentEdits = [];
        for (let i = 0; i < edits.length; i++) {
            const edit = edits[i];
            const nextEditRange = i + 1 < edits.length ? edits[i + 1] : undefined;
            currentEdits.push(edit);
            if (nextEditRange && nextEditRange.range.startLineNumber === edit.range.endLineNumber) {
                continue;
            }
            const singleEdit = TextReplacement.joinReplacements(currentEdits, initialValue);
            currentEdits.length = 0;
            const singleLineEdit = LineReplacement.fromSingleTextEdit(singleEdit, initialValue);
            result.push(singleLineEdit);
        }
        return new LineEdit(result);
    }
    static createFromUnsorted(edits) {
        const result = edits.slice();
        result.sort(compareBy(i => i.lineRange.startLineNumber, numberComparator));
        return new LineEdit(result);
    }
    constructor(
    /**
     * Have to be sorted by start line number and non-intersecting.
    */
    replacements) {
        this.replacements = replacements;
        assert(checkAdjacentItems(replacements, (i1, i2) => i1.lineRange.endLineNumberExclusive <= i2.lineRange.startLineNumber));
    }
    isEmpty() {
        return this.replacements.length === 0;
    }
    toEdit(initialValue) {
        const edits = [];
        for (const edit of this.replacements) {
            const singleEdit = edit.toSingleEdit(initialValue);
            edits.push(singleEdit);
        }
        return new StringEdit(edits);
    }
    toString() {
        return this.replacements.map(e => e.toString()).join(',');
    }
    serialize() {
        return this.replacements.map(e => e.serialize());
    }
    getNewLineRanges() {
        const ranges = [];
        let offset = 0;
        for (const e of this.replacements) {
            ranges.push(LineRange.ofLength(e.lineRange.startLineNumber + offset, e.newLines.length));
            offset += e.newLines.length - e.lineRange.length;
        }
        return ranges;
    }
    mapLineNumber(lineNumber) {
        let lineDelta = 0;
        for (const e of this.replacements) {
            if (e.lineRange.endLineNumberExclusive > lineNumber) {
                break;
            }
            lineDelta += e.newLines.length - e.lineRange.length;
        }
        return lineNumber + lineDelta;
    }
    mapLineRange(lineRange) {
        return new LineRange(this.mapLineNumber(lineRange.startLineNumber), this.mapLineNumber(lineRange.endLineNumberExclusive));
    }
    /** TODO improve, dont require originalLines */
    mapBackLineRange(lineRange, originalLines) {
        const i = this.inverse(originalLines);
        return i.mapLineRange(lineRange);
    }
    touches(other) {
        return this.replacements.some(e1 => other.replacements.some(e2 => e1.lineRange.intersect(e2.lineRange)));
    }
    rebase(base) {
        return new LineEdit(this.replacements.map(e => new LineReplacement(base.mapLineRange(e.lineRange), e.newLines)));
    }
    humanReadablePatch(originalLines) {
        const result = [];
        function pushLine(originalLineNumber, modifiedLineNumber, kind, content) {
            const specialChar = (kind === 'unmodified' ? ' ' : (kind === 'deleted' ? '-' : '+'));
            if (content === undefined) {
                content = '[[[[[ WARNING: LINE DOES NOT EXIST ]]]]]';
            }
            const origLn = originalLineNumber === -1 ? '   ' : originalLineNumber.toString().padStart(3, ' ');
            const modLn = modifiedLineNumber === -1 ? '   ' : modifiedLineNumber.toString().padStart(3, ' ');
            result.push(`${specialChar} ${origLn} ${modLn} ${content}`);
        }
        function pushSeperator() {
            result.push('---');
        }
        let lineDelta = 0;
        let first = true;
        for (const edits of groupAdjacentBy(this.replacements, (e1, e2) => e1.lineRange.distanceToRange(e2.lineRange) <= 5)) {
            if (!first) {
                pushSeperator();
            }
            else {
                first = false;
            }
            let lastLineNumber = edits[0].lineRange.startLineNumber - 2;
            for (const edit of edits) {
                for (let i = Math.max(1, lastLineNumber); i < edit.lineRange.startLineNumber; i++) {
                    pushLine(i, i + lineDelta, 'unmodified', originalLines[i - 1]);
                }
                const range = edit.lineRange;
                const newLines = edit.newLines;
                for (const replaceLineNumber of range.mapToLineArray(n => n)) {
                    const line = originalLines[replaceLineNumber - 1];
                    pushLine(replaceLineNumber, -1, 'deleted', line);
                }
                for (let i = 0; i < newLines.length; i++) {
                    const line = newLines[i];
                    pushLine(-1, range.startLineNumber + lineDelta + i, 'added', line);
                }
                lastLineNumber = range.endLineNumberExclusive;
                lineDelta += edit.newLines.length - edit.lineRange.length;
            }
            for (let i = lastLineNumber; i <= Math.min(lastLineNumber + 2, originalLines.length); i++) {
                pushLine(i, i + lineDelta, 'unmodified', originalLines[i - 1]);
            }
        }
        return result.join('\n');
    }
    apply(lines) {
        const result = [];
        let currentLineIndex = 0;
        for (const edit of this.replacements) {
            while (currentLineIndex < edit.lineRange.startLineNumber - 1) {
                result.push(lines[currentLineIndex]);
                currentLineIndex++;
            }
            for (const newLine of edit.newLines) {
                result.push(newLine);
            }
            currentLineIndex = edit.lineRange.endLineNumberExclusive - 1;
        }
        while (currentLineIndex < lines.length) {
            result.push(lines[currentLineIndex]);
            currentLineIndex++;
        }
        return result;
    }
    inverse(originalLines) {
        const newRanges = this.getNewLineRanges();
        return new LineEdit(this.replacements.map((e, idx) => new LineReplacement(newRanges[idx], originalLines.slice(e.lineRange.startLineNumber - 1, e.lineRange.endLineNumberExclusive - 1))));
    }
}
export class LineReplacement {
    static deserialize(e) {
        return new LineReplacement(LineRange.ofLength(e[0], e[1] - e[0]), e[2]);
    }
    static fromSingleTextEdit(edit, initialValue) {
        // 1: ab[cde
        // 2: fghijk
        // 3: lmn]opq
        // replaced with
        // 1n: 123
        // 2n: 456
        // 3n: 789
        // simple solution: replace [1..4) with [1n..4n)
        const newLines = splitLines(edit.text);
        let startLineNumber = edit.range.startLineNumber;
        const survivingFirstLineText = initialValue.getValueOfRange(Range.fromPositions(new Position(edit.range.startLineNumber, 1), edit.range.getStartPosition()));
        newLines[0] = survivingFirstLineText + newLines[0];
        let endLineNumberEx = edit.range.endLineNumber + 1;
        const editEndLineNumberMaxColumn = initialValue.getTransformer().getLineLength(edit.range.endLineNumber) + 1;
        const survivingEndLineText = initialValue.getValueOfRange(Range.fromPositions(edit.range.getEndPosition(), new Position(edit.range.endLineNumber, editEndLineNumberMaxColumn)));
        newLines[newLines.length - 1] = newLines[newLines.length - 1] + survivingEndLineText;
        // Replacing [startLineNumber, endLineNumberEx) with newLines would be correct, however it might not be minimal.
        const startBeforeNewLine = edit.range.startColumn === initialValue.getTransformer().getLineLength(edit.range.startLineNumber) + 1;
        const endAfterNewLine = edit.range.endColumn === 1;
        if (startBeforeNewLine && newLines[0].length === survivingFirstLineText.length) {
            // the replacement would not delete any text on the first line
            startLineNumber++;
            newLines.shift();
        }
        if (newLines.length > 0 && startLineNumber < endLineNumberEx && endAfterNewLine && newLines[newLines.length - 1].length === survivingEndLineText.length) {
            // the replacement would not delete any text on the last line
            endLineNumberEx--;
            newLines.pop();
        }
        return new LineReplacement(new LineRange(startLineNumber, endLineNumberEx), newLines);
    }
    constructor(lineRange, newLines) {
        this.lineRange = lineRange;
        this.newLines = newLines;
    }
    toSingleTextEdit(initialValue) {
        if (this.newLines.length === 0) {
            // Deletion
            const textLen = initialValue.getTransformer().textLength;
            if (this.lineRange.endLineNumberExclusive === textLen.lineCount + 2) {
                let startPos;
                if (this.lineRange.startLineNumber > 1) {
                    const startLineNumber = this.lineRange.startLineNumber - 1;
                    const startColumn = initialValue.getTransformer().getLineLength(startLineNumber) + 1;
                    startPos = new Position(startLineNumber, startColumn);
                }
                else {
                    // Delete everything.
                    // In terms of lines, this would end up with 0 lines.
                    // However, a string has always 1 line (which can be empty).
                    startPos = new Position(1, 1);
                }
                const lastPosition = textLen.addToPosition(new Position(1, 1));
                return new TextReplacement(Range.fromPositions(startPos, lastPosition), '');
            }
            else {
                return new TextReplacement(new Range(this.lineRange.startLineNumber, 1, this.lineRange.endLineNumberExclusive, 1), '');
            }
        }
        else if (this.lineRange.isEmpty) {
            // Insertion
            let endLineNumber;
            let column;
            let text;
            const insertionLine = this.lineRange.startLineNumber;
            if (insertionLine === initialValue.getTransformer().textLength.lineCount + 2) {
                endLineNumber = insertionLine - 1;
                column = initialValue.getTransformer().getLineLength(endLineNumber) + 1;
                text = this.newLines.map(l => '\n' + l).join('');
            }
            else {
                endLineNumber = insertionLine;
                column = 1;
                text = this.newLines.map(l => l + '\n').join('');
            }
            return new TextReplacement(Range.fromPositions(new Position(endLineNumber, column)), text);
        }
        else {
            const endLineNumber = this.lineRange.endLineNumberExclusive - 1;
            const endLineNumberMaxColumn = initialValue.getTransformer().getLineLength(endLineNumber) + 1;
            const range = new Range(this.lineRange.startLineNumber, 1, endLineNumber, endLineNumberMaxColumn);
            // Don't add \n to the last line. This is because we subtract one from lineRange.endLineNumberExclusive for endLineNumber.
            const text = this.newLines.join('\n');
            return new TextReplacement(range, text);
        }
    }
    toSingleEdit(initialValue) {
        const textEdit = this.toSingleTextEdit(initialValue);
        const range = initialValue.getTransformer().getOffsetRange(textEdit.range);
        return new StringReplacement(range, textEdit.text);
    }
    toString() {
        return `${this.lineRange}->${JSON.stringify(this.newLines)}`;
    }
    serialize() {
        return [
            this.lineRange.startLineNumber,
            this.lineRange.endLineNumberExclusive,
            this.newLines,
        ];
    }
    removeCommonSuffixPrefixLines(initialValue) {
        let startLineNumber = this.lineRange.startLineNumber;
        let endLineNumberEx = this.lineRange.endLineNumberExclusive;
        let trimStartCount = 0;
        while (startLineNumber < endLineNumberEx && trimStartCount < this.newLines.length
            && this.newLines[trimStartCount] === initialValue.getLineAt(startLineNumber)) {
            startLineNumber++;
            trimStartCount++;
        }
        let trimEndCount = 0;
        while (startLineNumber < endLineNumberEx && trimEndCount + trimStartCount < this.newLines.length
            && this.newLines[this.newLines.length - 1 - trimEndCount] === initialValue.getLineAt(endLineNumberEx - 1)) {
            endLineNumberEx--;
            trimEndCount++;
        }
        if (trimStartCount === 0 && trimEndCount === 0) {
            return this;
        }
        return new LineReplacement(new LineRange(startLineNumber, endLineNumberEx), this.newLines.slice(trimStartCount, this.newLines.length - trimEndCount));
    }
    toLineEdit() {
        return new LineEdit([this]);
    }
}
export var SerializedLineReplacement;
(function (SerializedLineReplacement) {
    function is(thing) {
        return (Array.isArray(thing)
            && thing.length === 3
            && typeof thing[0] === 'number'
            && typeof thing[1] === 'number'
            && Array.isArray(thing[2])
            && thing[2].every((e) => typeof e === 'string'));
    }
    SerializedLineReplacement.is = is;
})(SerializedLineReplacement || (SerializedLineReplacement = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluZUVkaXQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi9jb3JlL2VkaXRzL2xpbmVFZGl0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxTQUFTLEVBQUUsZUFBZSxFQUFFLGdCQUFnQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDakcsT0FBTyxFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDbkQsT0FBTyxFQUFrQixVQUFVLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUNoRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDMUMsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUNwQyxPQUFPLEVBQUUsZUFBZSxFQUFFLFFBQVEsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUcxRCxNQUFNLE9BQU8sUUFBUTthQUNHLFVBQUssR0FBRyxJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUV6QyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQXdCO1FBQ2pELE9BQU8sSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFFTSxNQUFNLENBQUMsY0FBYyxDQUFDLElBQW9CLEVBQUUsWUFBMEI7UUFDNUUsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFD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