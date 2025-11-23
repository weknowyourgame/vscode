/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { compareBy, equals } from '../../../../base/common/arrays.js';
import { assertFn, checkAdjacentItems } from '../../../../base/common/assert.js';
import { BugIndicatingError } from '../../../../base/common/errors.js';
import { commonPrefixLength, commonSuffixLength } from '../../../../base/common/strings.js';
import { Position } from '../position.js';
import { Range } from '../range.js';
import { TextLength } from '../text/textLength.js';
import { StringText } from '../text/abstractText.js';
export class TextEdit {
    static fromStringEdit(edit, initialState) {
        const edits = edit.replacements.map(e => TextReplacement.fromStringReplacement(e, initialState));
        return new TextEdit(edits);
    }
    static replace(originalRange, newText) {
        return new TextEdit([new TextReplacement(originalRange, newText)]);
    }
    static delete(range) {
        return new TextEdit([new TextReplacement(range, '')]);
    }
    static insert(position, newText) {
        return new TextEdit([new TextReplacement(Range.fromPositions(position, position), newText)]);
    }
    static fromParallelReplacementsUnsorted(replacements) {
        const r = replacements.slice().sort(compareBy(i => i.range, Range.compareRangesUsingStarts));
        return new TextEdit(r);
    }
    constructor(replacements) {
        this.replacements = replacements;
        assertFn(() => checkAdjacentItems(replacements, (a, b) => a.range.getEndPosition().isBeforeOrEqual(b.range.getStartPosition())));
    }
    /**
     * Joins touching edits and removes empty edits.
     */
    normalize() {
        const replacements = [];
        for (const r of this.replacements) {
            if (replacements.length > 0 && replacements[replacements.length - 1].range.getEndPosition().equals(r.range.getStartPosition())) {
                const last = replacements[replacements.length - 1];
                replacements[replacements.length - 1] = new TextReplacement(last.range.plusRange(r.range), last.text + r.text);
            }
            else if (!r.isEmpty) {
                replacements.push(r);
            }
        }
        return new TextEdit(replacements);
    }
    mapPosition(position) {
        let lineDelta = 0;
        let curLine = 0;
        let columnDeltaInCurLine = 0;
        for (const replacement of this.replacements) {
            const start = replacement.range.getStartPosition();
            if (position.isBeforeOrEqual(start)) {
                break;
            }
            const end = replacement.range.getEndPosition();
            const len = TextLength.ofText(replacement.text);
            if (position.isBefore(end)) {
                const startPos = new Position(start.lineNumber + lineDelta, start.column + (start.lineNumber + lineDelta === curLine ? columnDeltaInCurLine : 0));
                const endPos = len.addToPosition(startPos);
                return rangeFromPositions(startPos, endPos);
            }
            if (start.lineNumber + lineDelta !== curLine) {
                columnDeltaInCurLine = 0;
            }
            lineDelta += len.lineCount - (replacement.range.endLineNumber - replacement.range.startLineNumber);
            if (len.lineCount === 0) {
                if (end.lineNumber !== start.lineNumber) {
                    columnDeltaInCurLine += len.columnCount - (end.column - 1);
                }
                else {
                    columnDeltaInCurLine += len.columnCount - (end.column - start.column);
                }
            }
            else {
                columnDeltaInCurLine = len.columnCount;
            }
            curLine = end.lineNumber + lineDelta;
        }
        return new Position(position.lineNumber + lineDelta, position.column + (position.lineNumber + lineDelta === curLine ? columnDeltaInCurLine : 0));
    }
    mapRange(range) {
        function getStart(p) {
            return p instanceof Position ? p : p.getStartPosition();
        }
        function getEnd(p) {
            return p instanceof Position ? p : p.getEndPosition();
        }
        const start = getStart(this.mapPosition(range.getStartPosition()));
        const end = getEnd(this.mapPosition(range.getEndPosition()));
        return rangeFromPositions(start, end);
    }
    // TODO: `doc` is not needed for this!
    inverseMapPosition(positionAfterEdit, doc) {
        const reversed = this.inverse(doc);
        return reversed.mapPosition(positionAfterEdit);
    }
    inverseMapRange(range, doc) {
        const reversed = this.inverse(doc);
        return reversed.mapRange(range);
    }
    apply(text) {
        let result = '';
        let lastEditEnd = new Position(1, 1);
        for (const replacement of this.replacements) {
            const editRange = replacement.range;
            const editStart = editRange.getStartPosition();
            const editEnd = editRange.getEndPosition();
            const r = rangeFromPositions(lastEditEnd, editStart);
            if (!r.isEmpty()) {
                result += text.getValueOfRange(r);
            }
            result += replacement.text;
            lastEditEnd = editEnd;
        }
        const r = rangeFromPositions(lastEditEnd, text.endPositionExclusive);
        if (!r.isEmpty()) {
            result += text.getValueOfRange(r);
        }
        return result;
    }
    applyToString(str) {
        const strText = new StringText(str);
        return this.apply(strText);
    }
    inverse(doc) {
        const ranges = this.getNewRanges();
        return new TextEdit(this.replacements.map((e, idx) => new TextReplacement(ranges[idx], doc.getValueOfRange(e.range))));
    }
    getNewRanges() {
        const newRanges = [];
        let previousEditEndLineNumber = 0;
        let lineOffset = 0;
        let columnOffset = 0;
        for (const replacement of this.replacements) {
            const textLength = TextLength.ofText(replacement.text);
            const newRangeStart = Position.lift({
                lineNumber: replacement.range.startLineNumber + lineOffset,
                column: replacement.range.startColumn + (replacement.range.startLineNumber === previousEditEndLineNumber ? columnOffset : 0)
            });
            const newRange = textLength.createRange(newRangeStart);
            newRanges.push(newRange);
            lineOffset = newRange.endLineNumber - replacement.range.endLineNumber;
            columnOffset = newRange.endColumn - replacement.range.endColumn;
            previousEditEndLineNumber = replacement.range.endLineNumber;
        }
        return newRanges;
    }
    toReplacement(text) {
        if (this.replacements.length === 0) {
            throw new BugIndicatingError();
        }
        if (this.replacements.length === 1) {
            return this.replacements[0];
        }
        const startPos = this.replacements[0].range.getStartPosition();
        const endPos = this.replacements[this.replacements.length - 1].range.getEndPosition();
        let newText = '';
        for (let i = 0; i < this.replacements.length; i++) {
            const curEdit = this.replacements[i];
            newText += curEdit.text;
            if (i < this.replacements.length - 1) {
                const nextEdit = this.replacements[i + 1];
                const gapRange = Range.fromPositions(curEdit.range.getEndPosition(), nextEdit.range.getStartPosition());
                const gapText = text.getValueOfRange(gapRange);
                newText += gapText;
            }
        }
        return new TextReplacement(Range.fromPositions(startPos, endPos), newText);
    }
    equals(other) {
        return equals(this.replacements, other.replacements, (a, b) => a.equals(b));
    }
    /**
     * Combines two edits into one with the same effect.
     * WARNING: This is written by AI, but well tested. I do not understand the implementation myself.
     *
     * Invariant:
     * ```
     * other.applyToString(this.applyToString(s0)) = this.compose(other).applyToString(s0)
     * ```
     */
    compose(other) {
        const edits1 = this.normalize();
        const edits2 = other.normalize();
        if (edits1.replacements.length === 0) {
            return edits2;
        }
        if (edits2.replacements.length === 0) {
            return edits1;
        }
        const resultReplacements = [];
        let edit1Idx = 0;
        let lastEdit1EndS0Line = 1;
        let lastEdit1EndS0Col = 1;
        let headSrcRangeStartLine = 0;
        let headSrcRangeStartCol = 0;
        let headSrcRangeEndLine = 0;
        let headSrcRangeEndCol = 0;
        let headText = null;
        let headLengthLine = 0;
        let headLengthCol = 0;
        let headHasValue = false;
        let headIsInfinite = false;
        let currentPosInS1Line = 1;
        let currentPosInS1Col = 1;
        function ensureHead() {
            if (headHasValue) {
                return;
            }
            if (edit1Idx < edits1.replacements.length) {
                const nextEdit = edits1.replacements[edit1Idx];
                const nextEditStart = nextEdit.range.getStartPosition();
                const gapIsEmpty = (lastEdit1EndS0Line === nextEditStart.lineNumber) && (lastEdit1EndS0Col === nextEditStart.column);
                if (!gapIsEmpty) {
                    headSrcRangeStartLine = lastEdit1EndS0Line;
                    headSrcRangeStartCol = lastEdit1EndS0Col;
                    headSrcRangeEndLine = nextEditStart.lineNumber;
                    headSrcRangeEndCol = nextEditStart.column;
                    headText = null;
                    if (lastEdit1EndS0Line === nextEditStart.lineNumber) {
                        headLengthLine = 0;
                        headLengthCol = nextEditStart.column - lastEdit1EndS0Col;
                    }
                    else {
                        headLengthLine = nextEditStart.lineNumber - lastEdit1EndS0Line;
                        headLengthCol = nextEditStart.column - 1;
                    }
                    headHasValue = true;
                    lastEdit1EndS0Line = nextEditStart.lineNumber;
                    lastEdit1EndS0Col = nextEditStart.column;
                }
                else {
                    const nextEditEnd = nextEdit.range.getEndPosition();
                    headSrcRangeStartLine = nextEditStart.lineNumber;
                    headSrcRangeStartCol = nextEditStart.column;
                    headSrcRangeEndLine = nextEditEnd.lineNumber;
                    headSrcRangeEndCol = nextEditEnd.column;
                    headText = nextEdit.text;
                    let line = 0;
                    let column = 0;
                    const text = nextEdit.text;
                    for (let i = 0; i < text.length; i++) {
                        if (text.charCodeAt(i) === 10) {
                            line++;
                            column = 0;
                        }
                        else {
                            column++;
                        }
                    }
                    headLengthLine = line;
                    headLengthCol = column;
                    headHasValue = true;
                    lastEdit1EndS0Line = nextEditEnd.lineNumber;
                    lastEdit1EndS0Col = nextEditEnd.column;
                    edit1Idx++;
                }
            }
            else {
                headIsInfinite = true;
                headSrcRangeStartLine = lastEdit1EndS0Line;
                headSrcRangeStartCol = lastEdit1EndS0Col;
                headHasValue = true;
            }
        }
        function splitText(text, lenLine, lenCol) {
            if (lenLine === 0 && lenCol === 0) {
                return ['', text];
            }
            let line = 0;
            let offset = 0;
            while (line < lenLine) {
                const idx = text.indexOf('\n', offset);
                if (idx === -1) {
                    throw new BugIndicatingError('Text length mismatch');
                }
                offset = idx + 1;
                line++;
            }
            offset += lenCol;
            return [text.substring(0, offset), text.substring(offset)];
        }
        for (const r2 of edits2.replacements) {
            const r2Start = r2.range.getStartPosition();
            const r2End = r2.range.getEndPosition();
            while (true) {
                if (currentPosInS1Line === r2Start.lineNumber && currentPosInS1Col === r2Start.column) {
                    break;
                }
                ensureHead();
                if (headIsInfinite) {
                    let distLine, distCol;
                    if (currentPosInS1Line === r2Start.lineNumber) {
                        distLine = 0;
                        distCol = r2Start.column - currentPosInS1Col;
                    }
                    else {
                        distLine = r2Start.lineNumber - currentPosInS1Line;
                        distCol = r2Start.column - 1;
                    }
                    currentPosInS1Line = r2Start.lineNumber;
                    currentPosInS1Col = r2Start.column;
                    if (distLine === 0) {
                        headSrcRangeStartCol += distCol;
                    }
                    else {
                        headSrcRangeStartLine += distLine;
                        headSrcRangeStartCol = distCol + 1;
                    }
                    break;
                }
                let headEndInS1Line, headEndInS1Col;
                if (headLengthLine === 0) {
                    headEndInS1Line = currentPosInS1Line;
                    headEndInS1Col = currentPosInS1Col + headLengthCol;
                }
                else {
                    headEndInS1Line = currentPosInS1Line + headLengthLine;
                    headEndInS1Col = headLengthCol + 1;
                }
                let r2StartIsBeforeHeadEnd = false;
                if (r2Start.lineNumber < headEndInS1Line) {
                    r2StartIsBeforeHeadEnd = true;
                }
                else if (r2Start.lineNumber === headEndInS1Line) {
                    r2StartIsBeforeHeadEnd = r2Start.column < headEndInS1Col;
                }
                if (r2StartIsBeforeHeadEnd) {
                    let splitLenLine, splitLenCol;
                    if (currentPosInS1Line === r2Start.lineNumber) {
                        splitLenLine = 0;
                        splitLenCol = r2Start.column - currentPosInS1Col;
                    }
                    else {
                        splitLenLine = r2Start.lineNumber - currentPosInS1Line;
                        splitLenCol = r2Start.column - 1;
                    }
                    let remainingLenLine, remainingLenCol;
                    if (splitLenLine === headLengthLine) {
                        remainingLenLine = 0;
                        remainingLenCol = headLengthCol - splitLenCol;
                    }
                    else {
                        remainingLenLine = headLengthLine - splitLenLine;
                        remainingLenCol = headLengthCol;
                    }
                    if (headText !== null) {
                        const [t1, t2] = splitText(headText, splitLenLine, splitLenCol);
                        resultReplacements.push(new TextReplacement(new Range(headSrcRangeStartLine, headSrcRangeStartCol, headSrcRangeEndLine, headSrcRangeEndCol), t1));
                        headText = t2;
                        headLengthLine = remainingLenLine;
                        headLengthCol = remainingLenCol;
                        headSrcRangeStartLine = headSrcRangeEndLine;
                        headSrcRangeStartCol = headSrcRangeEndCol;
                    }
                    else {
                        let splitPosLine, splitPosCol;
                        if (splitLenLine === 0) {
                            splitPosLine = headSrcRangeStartLine;
                            splitPosCol = headSrcRangeStartCol + splitLenCol;
                        }
                        else {
                            splitPosLine = headSrcRangeStartLine + splitLenLine;
                            splitPosCol = splitLenCol + 1;
                        }
                        headSrcRangeStartLine = splitPosLine;
                        headSrcRangeStartCol = splitPosCol;
                        headLengthLine = remainingLenLine;
                        headLengthCol = remainingLenCol;
                    }
                    currentPosInS1Line = r2Start.lineNumber;
                    currentPosInS1Col = r2Start.column;
                    break;
                }
                if (headText !== null) {
                    resultReplacements.push(new TextReplacement(new Range(headSrcRangeStartLine, headSrcRangeStartCol, headSrcRangeEndLine, headSrcRangeEndCol), headText));
                }
                currentPosInS1Line = headEndInS1Line;
                currentPosInS1Col = headEndInS1Col;
                headHasValue = false;
            }
            let consumedStartS0Line = null;
            let consumedStartS0Col = null;
            let consumedEndS0Line = null;
            let consumedEndS0Col = null;
            while (true) {
                if (currentPosInS1Line === r2End.lineNumber && currentPosInS1Col === r2End.column) {
                    break;
                }
                ensureHead();
                if (headIsInfinite) {
                    let distLine, distCol;
                    if (currentPosInS1Line === r2End.lineNumber) {
                        distLine = 0;
                        distCol = r2End.column - currentPosInS1Col;
                    }
                    else {
                        distLine = r2End.lineNumber - currentPosInS1Line;
                        distCol = r2End.column - 1;
                    }
                    let rangeInS0EndLine, rangeInS0EndCol;
                    if (distLine === 0) {
                        rangeInS0EndLine = headSrcRangeStartLine;
                        rangeInS0EndCol = headSrcRangeStartCol + distCol;
                    }
                    else {
                        rangeInS0EndLine = headSrcRangeStartLine + distLine;
                        rangeInS0EndCol = distCol + 1;
                    }
                    if (consumedStartS0Line === null) {
                        consumedStartS0Line = headSrcRangeStartLine;
                        consumedStartS0Col = headSrcRangeStartCol;
                    }
                    consumedEndS0Line = rangeInS0EndLine;
                    consumedEndS0Col = rangeInS0EndCol;
                    currentPosInS1Line = r2End.lineNumber;
                    currentPosInS1Col = r2End.column;
                    headSrcRangeStartLine = rangeInS0EndLine;
                    headSrcRangeStartCol = rangeInS0EndCol;
                    break;
                }
                let headEndInS1Line, headEndInS1Col;
                if (headLengthLine === 0) {
                    headEndInS1Line = currentPosInS1Line;
                    headEndInS1Col = currentPosInS1Col + headLengthCol;
                }
                else {
                    headEndInS1Line = currentPosInS1Line + headLengthLine;
                    headEndInS1Col = headLengthCol + 1;
                }
                let r2EndIsBeforeHeadEnd = false;
                if (r2End.lineNumber < headEndInS1Line) {
                    r2EndIsBeforeHeadEnd = true;
                }
                else if (r2End.lineNumber === headEndInS1Line) {
                    r2EndIsBeforeHeadEnd = r2End.column < headEndInS1Col;
                }
                if (r2EndIsBeforeHeadEnd) {
                    let splitLenLine, splitLenCol;
                    if (currentPosInS1Line === r2End.lineNumber) {
                        splitLenLine = 0;
                        splitLenCol = r2End.column - currentPosInS1Col;
                    }
                    else {
                        splitLenLine = r2End.lineNumber - currentPosInS1Line;
                        splitLenCol = r2End.column - 1;
                    }
                    let remainingLenLine, remainingLenCol;
                    if (splitLenLine === headLengthLine) {
                        remainingLenLine = 0;
                        remainingLenCol = headLengthCol - splitLenCol;
                    }
                    else {
                        remainingLenLine = headLengthLine - splitLenLine;
                        remainingLenCol = headLengthCol;
                    }
                    if (headText !== null) {
                        if (consumedStartS0Line === null) {
                            consumedStartS0Line = headSrcRangeStartLine;
                            consumedStartS0Col = headSrcRangeStartCol;
                        }
                        consumedEndS0Line = headSrcRangeEndLine;
                        consumedEndS0Col = headSrcRangeEndCol;
                        const [, t2] = splitText(headText, splitLenLine, splitLenCol);
                        headText = t2;
                        headLengthLine = remainingLenLine;
                        headLengthCol = remainingLenCol;
                        headSrcRangeStartLine = headSrcRangeEndLine;
                        headSrcRangeStartCol = headSrcRangeEndCol;
                    }
                    else {
                        let splitPosLine, splitPosCol;
                        if (splitLenLine === 0) {
                            splitPosLine = headSrcRangeStartLine;
                            splitPosCol = headSrcRangeStartCol + splitLenCol;
                        }
                        else {
                            splitPosLine = headSrcRangeStartLine + splitLenLine;
                            splitPosCol = splitLenCol + 1;
                        }
                        if (consumedStartS0Line === null) {
                            consumedStartS0Line = headSrcRangeStartLine;
                            consumedStartS0Col = headSrcRangeStartCol;
                        }
                        consumedEndS0Line = splitPosLine;
                        consumedEndS0Col = splitPosCol;
                        headSrcRangeStartLine = splitPosLine;
                        headSrcRangeStartCol = splitPosCol;
                        headLengthLine = remainingLenLine;
                        headLengthCol = remainingLenCol;
                    }
                    currentPosInS1Line = r2End.lineNumber;
                    currentPosInS1Col = r2End.column;
                    break;
                }
                if (consumedStartS0Line === null) {
                    consumedStartS0Line = headSrcRangeStartLine;
                    consumedStartS0Col = headSrcRangeStartCol;
                }
                consumedEndS0Line = headSrcRangeEndLine;
                consumedEndS0Col = headSrcRangeEndCol;
                currentPosInS1Line = headEndInS1Line;
                currentPosInS1Col = headEndInS1Col;
                headHasValue = false;
            }
            if (consumedStartS0Line !== null) {
                resultReplacements.push(new TextReplacement(new Range(consumedStartS0Line, consumedStartS0Col, consumedEndS0Line, consumedEndS0Col), r2.text));
            }
            else {
                ensureHead();
                const insertPosS0Line = headSrcRangeStartLine;
                const insertPosS0Col = headSrcRangeStartCol;
                resultReplacements.push(new TextReplacement(new Range(insertPosS0Line, insertPosS0Col, insertPosS0Line, insertPosS0Col), r2.text));
            }
        }
        while (true) {
            ensureHead();
            if (headIsInfinite) {
                break;
            }
            if (headText !== null) {
                resultReplacements.push(new TextReplacement(new Range(headSrcRangeStartLine, headSrcRangeStartCol, headSrcRangeEndLine, headSrcRangeEndCol), headText));
            }
            headHasValue = false;
        }
        return new TextEdit(resultReplacements).normalize();
    }
    toString(text) {
        if (text === undefined) {
            return this.replacements.map(edit => edit.toString()).join('\n');
        }
        if (typeof text === 'string') {
            return this.toString(new StringText(text));
        }
        if (this.replacements.length === 0) {
            return '';
        }
        return this.replacements.map(r => {
            const maxLength = 10;
            const originalText = text.getValueOfRange(r.range);
            // Get text before the edit
            const beforeRange = Range.fromPositions(new Position(Math.max(1, r.range.startLineNumber - 1), 1), r.range.getStartPosition());
            let beforeText = text.getValueOfRange(beforeRange);
            if (beforeText.length > maxLength) {
                beforeText = '...' + beforeText.substring(beforeText.length - maxLength);
            }
            // Get text after the edit
            const afterRange = Range.fromPositions(r.range.getEndPosition(), new Position(r.range.endLineNumber + 1, 1));
            let afterText = text.getValueOfRange(afterRange);
            if (afterText.length > maxLength) {
                afterText = afterText.substring(0, maxLength) + '...';
            }
            // Format the replaced text
            let replacedText = originalText;
            if (replacedText.length > maxLength) {
                const halfMax = Math.floor(maxLength / 2);
                replacedText = replacedText.substring(0, halfMax) + '...' +
                    replacedText.substring(replacedText.length - halfMax);
            }
            // Format the new text
            let newText = r.text;
            if (newText.length > maxLength) {
                const halfMax = Math.floor(maxLength / 2);
                newText = newText.substring(0, halfMax) + '...' +
                    newText.substring(newText.length - halfMax);
            }
            if (replacedText.length === 0) {
                // allow-any-unicode-next-line
                return `${beforeText}❰${newText}❱${afterText}`;
            }
            // allow-any-unicode-next-line
            return `${beforeText}❰${replacedText}↦${newText}❱${afterText}`;
        }).join('\n');
    }
}
export class TextReplacement {
    static joinReplacements(replacements, initialValue) {
        if (replacements.length === 0) {
            throw new BugIndicatingError();
        }
        if (replacements.length === 1) {
            return replacements[0];
        }
        const startPos = replacements[0].range.getStartPosition();
        const endPos = replacements[replacements.length - 1].range.getEndPosition();
        let newText = '';
        for (let i = 0; i < replacements.length; i++) {
            const curEdit = replacements[i];
            newText += curEdit.text;
            if (i < replacements.length - 1) {
                const nextEdit = replacements[i + 1];
                const gapRange = Range.fromPositions(curEdit.range.getEndPosition(), nextEdit.range.getStartPosition());
                const gapText = initialValue.getValueOfRange(gapRange);
                newText += gapText;
            }
        }
        return new TextReplacement(Range.fromPositions(startPos, endPos), newText);
    }
    static fromStringReplacement(replacement, initialState) {
        return new TextReplacement(initialState.getTransformer().getRange(replacement.replaceRange), replacement.newText);
    }
    static delete(range) {
        return new TextReplacement(range, '');
    }
    constructor(range, text) {
        this.range = range;
        this.text = text;
    }
    get isEmpty() {
        return this.range.isEmpty() && this.text.length === 0;
    }
    static equals(first, second) {
        return first.range.equalsRange(second.range) && first.text === second.text;
    }
    toSingleEditOperation() {
        return {
            range: this.range,
            text: this.text,
        };
    }
    toEdit() {
        return new TextEdit([this]);
    }
    equals(other) {
        return TextReplacement.equals(this, other);
    }
    extendToCoverRange(range, initialValue) {
        if (this.range.containsRange(range)) {
            return this;
        }
        const newRange = this.range.plusRange(range);
        const textBefore = initialValue.getValueOfRange(Range.fromPositions(newRange.getStartPosition(), this.range.getStartPosition()));
        const textAfter = initialValue.getValueOfRange(Range.fromPositions(this.range.getEndPosition(), newRange.getEndPosition()));
        const newText = textBefore + this.text + textAfter;
        return new TextReplacement(newRange, newText);
    }
    extendToFullLine(initialValue) {
        const newRange = new Range(this.range.startLineNumber, 1, this.range.endLineNumber, initialValue.getTransformer().getLineLength(this.range.endLineNumber) + 1);
        return this.extendToCoverRange(newRange, initialValue);
    }
    removeCommonPrefixAndSuffix(text) {
        const prefix = this.removeCommonPrefix(text);
        const suffix = prefix.removeCommonSuffix(text);
        return suffix;
    }
    removeCommonPrefix(text) {
        const normalizedOriginalText = text.getValueOfRange(this.range).replaceAll('\r\n', '\n');
        const normalizedModifiedText = this.text.replaceAll('\r\n', '\n');
        const commonPrefixLen = commonPrefixLength(normalizedOriginalText, normalizedModifiedText);
        const start = TextLength.ofText(normalizedOriginalText.substring(0, commonPrefixLen))
            .addToPosition(this.range.getStartPosition());
        const newText = normalizedModifiedText.substring(commonPrefixLen);
        const range = Range.fromPositions(start, this.range.getEndPosition());
        return new TextReplacement(range, newText);
    }
    removeCommonSuffix(text) {
        const normalizedOriginalText = text.getValueOfRange(this.range).replaceAll('\r\n', '\n');
        const normalizedModifiedText = this.text.replaceAll('\r\n', '\n');
        const commonSuffixLen = commonSuffixLength(normalizedOriginalText, normalizedModifiedText);
        const end = TextLength.ofText(normalizedOriginalText.substring(0, normalizedOriginalText.length - commonSuffixLen))
            .addToPosition(this.range.getStartPosition());
        const newText = normalizedModifiedText.substring(0, normalizedModifiedText.length - commonSuffixLen);
        const range = Range.fromPositions(this.range.getStartPosition(), end);
        return new TextReplacement(range, newText);
    }
    isEffectiveDeletion(text) {
        let newText = this.text.replaceAll('\r\n', '\n');
        let existingText = text.getValueOfRange(this.range).replaceAll('\r\n', '\n');
        const l = commonPrefixLength(newText, existingText);
        newText = newText.substring(l);
        existingText = existingText.substring(l);
        const r = commonSuffixLength(newText, existingText);
        newText = newText.substring(0, newText.length - r);
        existingText = existingText.substring(0, existingText.length - r);
        return newText === '';
    }
    toString() {
        const start = this.range.getStartPosition();
        const end = this.range.getEndPosition();
        return `(${start.lineNumber},${start.column} -> ${end.lineNumber},${end.column}): "${this.text}"`;
    }
}
function rangeFromPositions(start, end) {
    if (start.lineNumber === end.lineNumber && start.column === Number.MAX_SAFE_INTEGER) {
        return Range.fromPositions(end, end);
    }
    else if (!start.isBeforeOrEqual(end)) {
        throw new BugIndicatingError('start must be before end');
    }
    return new Range(start.lineNumber, start.column, end.lineNumber, end.column);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dEVkaXQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi9jb3JlL2VkaXRzL3RleHRFZGl0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBRzVGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBQ3BDLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNuRCxPQUFPLEVBQWdCLFVBQVUsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBRW5FLE1BQU0sT0FBTyxRQUFRO0lBQ2IsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFvQixFQUFFLFlBQTBCO1FBQzVFLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLHFCQUFxQixDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO1FBQ2pHLE9BQU8sSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQUVNLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBb0IsRUFBRSxPQUFlO1FBQzFELE9BQU8sSUFBSSxRQUFRLENBQUMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxhQUFhLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFFTSxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQVk7UUFDaEMsT0FBTyxJQUFJLFFBQVEsQ0FBQyxDQUFDLElBQUksZUFBZSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUVNLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBa0IsRUFBRSxPQUFlO1FBQ3ZELE9BQU8sSUFBSSxRQUFRLENBQUMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUYsQ0FBQztJQUVNLE1BQU0sQ0FBQyxnQ0FBZ0MsQ0FBQyxZQUF3QztRQUN0RixNQUFNLENBQUMsR0FBRyxZQUFZLENBQUMsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQztRQUM3RixPQUFPLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3hCLENBQUM7SUFFRCxZQUNpQixZQUF3QztRQUF4QyxpQkFBWSxHQUFaLFlBQVksQ0FBNEI7UUFFeEQsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLGtCQUFrQixDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsSSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTO1FBQ1IsTUFBTSxZQUFZLEdBQXNCLEVBQUUsQ0FBQztRQUMzQyxLQUFLLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNuQyxJQUFJLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLFlBQVksQ0FBQyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLEVBQUUsQ0FBQztnQkFDaEksTUFBTSxJQUFJLEdBQUcsWUFBWSxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ25ELFlBQVksQ0FBQyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksZUFBZSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoSCxDQUFDO2lCQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3ZCLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdEIsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLElBQUksUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFRCxXQUFXLENBQUMsUUFBa0I7UUFDN0IsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBQ2xCLElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQztRQUNoQixJQUFJLG9CQUFvQixHQUFHLENBQUMsQ0FBQztRQUU3QixLQUFLLE1BQU0sV0FBVyxJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUM3QyxNQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFFbkQsSUFBSSxRQUFRLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ3JDLE1BQU07WUFDUCxDQUFDO1lBRUQsTUFBTSxHQUFHLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUMvQyxNQUFNLEdBQUcsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoRCxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDNUIsTUFBTSxRQUFRLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxTQUFTLEVBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsU0FBUyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2xKLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQzNDLE9BQU8sa0JBQWtCLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzdDLENBQUM7WUFFRCxJQUFJLEtBQUssQ0FBQyxVQUFVLEdBQUcsU0FBUyxLQUFLLE9BQU8sRUFBRSxDQUFDO2dCQUM5QyxvQkFBb0IsR0FBRyxDQUFDLENBQUM7WUFDMUIsQ0FBQztZQUVELFNBQVMsSUFBSSxHQUFHLENBQUMsU0FBUyxHQUFHLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxhQUFhLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUVuRyxJQUFJLEdBQUcsQ0FBQyxTQUFTLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ3pCLElBQUksR0FBRyxDQUFDLFVBQVUsS0FBSyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7b0JBQ3pDLG9CQUFvQixJQUFJLEdBQUcsQ0FBQyxXQUFXLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUM1RCxDQUFDO3FCQUFNLENBQUM7b0JBQ1Asb0JBQW9CLElBQUksR0FBRyxDQUFDLFdBQVcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUN2RSxDQUFDO1lBQ0YsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLG9CQUFvQixHQUFHLEdBQUcsQ0FBQyxXQUFXLENBQUM7WUFDeEMsQ0FBQztZQUNELE9BQU8sR0FBRyxHQUFHLENBQUMsVUFBVSxHQUFHLFNBQVMsQ0FBQztRQUN0QyxDQUFDO1FBRUQsT0FBTyxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsVUFBVSxHQUFHLFNBQVMsRUFBRSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsUUFBUSxDQUFDLFVBQVUsR0FBRyxTQUFTLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsSixDQUFDO0lBRUQsUUFBUSxDQUFDLEtBQVk7UUFDcEIsU0FBUyxRQUFRLENBQUMsQ0FBbUI7WUFDcEMsT0FBTyxDQUFDLFlBQVksUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3pELENBQUM7UUFFRCxTQUFTLE1BQU0sQ0FBQyxDQUFtQjtZQUNsQyxPQUFPLENBQUMsWUFBWSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3ZELENBQUM7UUFFRCxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDbkUsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUU3RCxPQUFPLGtCQUFrQixDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztJQUN2QyxDQUFDO0lBRUQsc0NBQXNDO0lBQ3RDLGtCQUFrQixDQUFDLGlCQUEyQixFQUFFLEdBQWlCO1FBQ2hFLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbkMsT0FBTyxRQUFRLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVELGVBQWUsQ0FBQyxLQUFZLEVBQUUsR0FBaUI7UUFDOUMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNuQyxPQUFPLFFBQVEsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUVELEtBQUssQ0FBQyxJQUFrQjtRQUN2QixJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7UUFDaEIsSUFBSSxXQUFXLEdBQUcsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLEtBQUssTUFBTSxXQUFXLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQzdDLE1BQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUM7WUFDcEMsTUFBTSxTQUFTLEdBQUcsU0FBUyxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDL0MsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBRTNDLE1BQU0sQ0FBQyxHQUFHLGtCQUFrQixDQUFDLFdBQVcsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUNyRCxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUM7Z0JBQ2xCLE1BQU0sSUFBSSxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25DLENBQUM7WUFDRCxNQUFNLElBQUksV0FBVyxDQUFDLElBQUksQ0FBQztZQUMzQixXQUFXLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLENBQUM7UUFDRCxNQUFNLENBQUMsR0FBRyxrQkFBa0IsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDckUsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDO1lBQ2xCLE1BQU0sSUFBSSxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ25DLENBQUM7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFFRCxhQUFhLENBQUMsR0FBVztRQUN4QixNQUFNLE9BQU8sR0FBRyxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNwQyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQUVELE9BQU8sQ0FBQyxHQUFpQjtRQUN4QixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDbkMsT0FBTyxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLElBQUksZUFBZSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN4SCxDQUFDO0lBRUQsWUFBWTtRQUNYLE1BQU0sU0FBUyxHQUFZLEVBQUUsQ0FBQztRQUM5QixJQUFJLHlCQUF5QixHQUFHLENBQUMsQ0FBQztRQUNsQyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7UUFDbkIsSUFBSSxZQUFZLEdBQUcsQ0FBQyxDQUFDO1FBQ3JCLEtBQUssTUFBTSxXQUFXLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQzdDLE1BQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3ZELE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7Z0JBQ25DLFVBQVUsRUFBRSxXQUFXLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxVQUFVO2dCQUMxRCxNQUFNLEVBQUUsV0FBVyxDQUFDLEtBQUssQ0FBQyxXQUFXLEdBQUcsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLGVBQWUsS0FBSyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDNUgsQ0FBQyxDQUFDO1lBQ0gsTUFBTSxRQUFRLEdBQUcsVUFBVSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUN2RCxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3pCLFVBQVUsR0FBRyxRQUFRLENBQUMsYUFBYSxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDO1lBQ3RFLFlBQVksR0FBRyxRQUFRLENBQUMsU0FBUyxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDO1lBQ2hFLHlCQUF5QixHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDO1FBQzdELENBQUM7UUFDRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsYUFBYSxDQUFDLElBQWtCO1FBQy9CLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFBQyxNQUFNLElBQUksa0JBQWtCLEVBQUUsQ0FBQztRQUFDLENBQUM7UUFDdkUsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUFDLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUFDLENBQUM7UUFFcEUsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUMvRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUV0RixJQUFJLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFFakIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDbkQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNyQyxPQUFPLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQztZQUN4QixJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDdEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQzFDLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQztnQkFDeEcsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDL0MsT0FBTyxJQUFJLE9BQU8sQ0FBQztZQUNwQixDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sSUFBSSxlQUFlLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDNUUsQ0FBQztJQUVELE1BQU0sQ0FBQyxLQUFlO1FBQ3JCLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM3RSxDQUFDO0lBRUQ7Ozs7Ozs7O09BUUc7SUFDSCxPQUFPLENBQUMsS0FBZTtRQUN0QixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDaEMsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBRWpDLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFBQyxPQUFPLE1BQU0sQ0FBQztRQUFDLENBQUM7UUFDeEQsSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUFDLE9BQU8sTUFBTSxDQUFDO1FBQUMsQ0FBQztRQUV4RCxNQUFNLGtCQUFrQixHQUFzQixFQUFFLENBQUM7UUFFakQsSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDO1FBQ2pCLElBQUksa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO1FBQzNCLElBQUksaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO1FBRTFCLElBQUkscUJBQXFCLEdBQUcsQ0FBQyxDQUFDO1FBQzlCLElBQUksb0JBQW9CLEdBQUcsQ0FBQyxDQUFDO1FBQzdCLElBQUksbUJBQW1CLEdBQUcsQ0FBQyxDQUFDO1FBQzVCLElBQUksa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO1FBQzNCLElBQUksUUFBUSxHQUFrQixJQUFJLENBQUM7UUFDbkMsSUFBSSxjQUFjLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLElBQUksYUFBYSxHQUFHLENBQUMsQ0FBQztRQUV0QixJQUFJLFlBQVksR0FBRyxLQUFLLENBQUM7UUFDekIsSUFBSSxjQUFjLEdBQUcsS0FBSyxDQUFDO1FBRTNCLElBQUksa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO1FBQzNCLElBQUksaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO1FBRTFCLFNBQVMsVUFBVTtZQUNsQixJQUFJLFlBQVksRUFBRSxDQUFDO2dCQUFDLE9BQU87WUFBQyxDQUFDO1lBRTdCLElBQUksUUFBUSxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQzNDLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQy9DLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztnQkFFeEQsTUFBTSxVQUFVLEdBQUcsQ0FBQyxrQkFBa0IsS0FBSyxhQUFhLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsS0FBSyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBRXJILElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztvQkFDakIscUJBQXFCLEdBQUcsa0JBQWtCLENBQUM7b0JBQzNDLG9CQUFvQixHQUFHLGlCQUFpQixDQUFDO29CQUN6QyxtQkFBbUIsR0FBRyxhQUFhLENBQUMsVUFBVSxDQUFDO29CQUMvQyxrQkFBa0IsR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDO29CQUUxQyxRQUFRLEdBQUcsSUFBSSxDQUFDO29CQUVoQixJQUFJLGtCQUFrQixLQUFLLGFBQWEsQ0FBQyxVQUFVLEVBQUUsQ0FBQzt3QkFDckQsY0FBYyxHQUFHLENBQUMsQ0FBQzt3QkFDbkIsYUFBYSxHQUFHLGFBQWEsQ0FBQyxNQUFNLEdBQUcsaUJBQWlCLENBQUM7b0JBQzFELENBQUM7eUJBQU0sQ0FBQzt3QkFDUCxjQUFjLEdBQUcsYUFBYSxDQUFDLFVBQVUsR0FBRyxrQkFBa0IsQ0FBQzt3QkFDL0QsYUFBYSxHQUFHLGFBQWEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO29CQUMxQyxDQUFDO29CQUVELFlBQVksR0FBRyxJQUFJLENBQUM7b0JBQ3BCLGtCQUFrQixHQUFHLGFBQWEsQ0FBQyxVQUFVLENBQUM7b0JBQzlDLGlCQUFpQixHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUM7Z0JBQzFDLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDO29CQUNwRCxxQkFBcUIsR0FBRyxhQUFhLENBQUMsVUFBVSxDQUFDO29CQUNqRCxvQkFBb0IsR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDO29CQUM1QyxtQkFBbUIsR0FBRyxXQUFXLENBQUMsVUFBVSxDQUFDO29CQUM3QyxrQkFBa0IsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDO29CQUV4QyxRQUFRLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQztvQkFFekIsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDO29CQUNiLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztvQkFDZixNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDO29CQUMzQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO3dCQUN0QyxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUM7NEJBQy9CLElBQUksRUFBRSxDQUFDOzRCQUNQLE1BQU0sR0FBRyxDQUFDLENBQUM7d0JBQ1osQ0FBQzs2QkFBTSxDQUFDOzRCQUNQLE1BQU0sRUFBRSxDQUFDO3dCQUNWLENBQUM7b0JBQ0YsQ0FBQztvQkFDRCxjQUFjLEdBQUcsSUFBSSxDQUFDO29CQUN0QixhQUFhLEdBQUcsTUFBTSxDQUFDO29CQUV2QixZQUFZLEdBQUcsSUFBSSxDQUFDO29CQUNwQixrQkFBa0IsR0FBRyxXQUFXLENBQUMsVUFBVSxDQUFDO29CQUM1QyxpQkFBaUIsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDO29CQUN2QyxRQUFRLEVBQUUsQ0FBQztnQkFDWixDQUFDO1lBQ0YsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLGNBQWMsR0FBRyxJQUFJLENBQUM7Z0JBQ3RCLHFCQUFxQixHQUFHLGtCQUFrQixDQUFDO2dCQUMzQyxvQkFBb0IsR0FBRyxpQkFBaUIsQ0FBQztnQkFDekMsWUFBWSxHQUFHLElBQUksQ0FBQztZQUNyQixDQUFDO1FBQ0YsQ0FBQztRQUVELFNBQVMsU0FBUyxDQUFDLElBQVksRUFBRSxPQUFlLEVBQUUsTUFBYztZQUMvRCxJQUFJLE9BQU8sS0FBSyxDQUFDLElBQUksTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFBQyxDQUFDO1lBQ3pELElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQztZQUNiLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztZQUNmLE9BQU8sSUFBSSxHQUFHLE9BQU8sRUFBRSxDQUFDO2dCQUN2QixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDdkMsSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFBQyxNQUFNLElBQUksa0JBQWtCLENBQUMsc0JBQXNCLENBQUMsQ0FBQztnQkFBQyxDQUFDO2dCQUN6RSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztnQkFDakIsSUFBSSxFQUFFLENBQUM7WUFDUixDQUFDO1lBQ0QsTUFBTSxJQUFJLE1BQU0sQ0FBQztZQUNqQixPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQzVELENBQUM7UUFFRCxLQUFLLE1BQU0sRUFBRSxJQUFJLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUN0QyxNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDNUMsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUV4QyxPQUFPLElBQUksRUFBRSxDQUFDO2dCQUNiLElBQUksa0JBQWtCLEtBQUssT0FBTyxDQUFDLFVBQVUsSUFBSSxpQkFBaUIsS0FBSyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQUMsTUFBTTtnQkFBQyxDQUFDO2dCQUNqRyxVQUFVLEVBQUUsQ0FBQztnQkFFYixJQUFJLGNBQWMsRUFBRSxDQUFDO29CQUNwQixJQUFJLFFBQWdCLEVBQUUsT0FBZSxDQUFDO29CQUN0QyxJQUFJLGtCQUFrQixLQUFLLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQzt3QkFDL0MsUUFBUSxHQUFHLENBQUMsQ0FBQzt3QkFDYixPQUFPLEdBQUcsT0FBTyxDQUFDLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQztvQkFDOUMsQ0FBQzt5QkFBTSxDQUFDO3dCQUNQLFFBQVEsR0FBRyxPQUFPLENBQUMsVUFBVSxHQUFHLGtCQUFrQixDQUFDO3dCQUNuRCxPQUFPLEdBQUcsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7b0JBQzlCLENBQUM7b0JBRUQsa0JBQWtCLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQztvQkFDeEMsaUJBQWlCLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztvQkFFbkMsSUFBSSxRQUFRLEtBQUssQ0FBQyxFQUFFLENBQUM7d0JBQ3BCLG9CQUFvQixJQUFJLE9BQU8sQ0FBQztvQkFDakMsQ0FBQzt5QkFBTSxDQUFDO3dCQUNQLHFCQUFxQixJQUFJLFFBQVEsQ0FBQzt3QkFDbEMsb0JBQW9CLEdBQUcsT0FBTyxHQUFHLENBQUMsQ0FBQztvQkFDcEMsQ0FBQztvQkFDRCxNQUFNO2dCQUNQLENBQUM7Z0JBRUQsSUFBSSxlQUF1QixFQUFFLGNBQXNCLENBQUM7Z0JBQ3BELElBQUksY0FBYyxLQUFLLENBQUMsRUFBRSxDQUFDO29CQUMxQixlQUFlLEdBQUcsa0JBQWtCLENBQUM7b0JBQ3JDLGNBQWMsR0FBRyxpQkFBaUIsR0FBRyxhQUFhLENBQUM7Z0JBQ3BELENBQUM7cUJBQU0sQ0FBQztvQkFDUCxlQUFlLEdBQUcsa0JBQWtCLEdBQUcsY0FBYyxDQUFDO29CQUN0RCxjQUFjLEdBQUcsYUFBYSxHQUFHLENBQUMsQ0FBQztnQkFDcEMsQ0FBQztnQkFFRCxJQUFJLHNCQUFzQixHQUFHLEtBQUssQ0FBQztnQkFDbkMsSUFBSSxPQUFPLENBQUMsVUFBVSxHQUFHLGVBQWUsRUFBRSxDQUFDO29CQUMxQyxzQkFBc0IsR0FBRyxJQUFJLENBQUM7Z0JBQy9CLENBQUM7cUJBQU0sSUFBSSxPQUFPLENBQUMsVUFBVSxLQUFLLGVBQWUsRUFBRSxDQUFDO29CQUNuRCxzQkFBc0IsR0FBRyxPQUFPLENBQUMsTUFBTSxHQUFHLGNBQWMsQ0FBQztnQkFDMUQsQ0FBQztnQkFFRCxJQUFJLHNCQUFzQixFQUFFLENBQUM7b0JBQzVCLElBQUksWUFBb0IsRUFBRSxXQUFtQixDQUFDO29CQUM5QyxJQUFJLGtCQUFrQixLQUFLLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQzt3QkFDL0MsWUFBWSxHQUFHLENBQUMsQ0FBQzt3QkFDakIsV0FBVyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEdBQUcsaUJBQWlCLENBQUM7b0JBQ2xELENBQUM7eUJBQU0sQ0FBQzt3QkFDUCxZQUFZLEdBQUcsT0FBTyxDQUFDLFVBQVUsR0FBRyxrQkFBa0IsQ0FBQzt3QkFDdkQsV0FBVyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO29CQUNsQyxDQUFDO29CQUVELElBQUksZ0JBQXdCLEVBQUUsZUFBdUIsQ0FBQztvQkFDdEQsSUFBSSxZQUFZLEtBQUssY0FBYyxFQUFFLENBQUM7d0JBQ3JDLGdCQUFnQixHQUFHLENBQUMsQ0FBQzt3QkFDckIsZUFBZSxHQUFHLGFBQWEsR0FBRyxXQUFXLENBQUM7b0JBQy9DLENBQUM7eUJBQU0sQ0FBQzt3QkFDUCxnQkFBZ0IsR0FBRyxjQUFjLEdBQUcsWUFBWSxDQUFDO3dCQUNqRCxlQUFlLEdBQUcsYUFBYSxDQUFDO29CQUNqQyxDQUFDO29CQUVELElBQUksUUFBUSxLQUFLLElBQUksRUFBRSxDQUFDO3dCQUN2QixNQUFNLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxRQUFRLEVBQUUsWUFBWSxFQUFFLFdBQVcsQ0FBQyxDQUFDO3dCQUNoRSxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxlQUFlLENBQUMsSUFBSSxLQUFLLENBQUMscUJBQXFCLEVBQUUsb0JBQW9CLEVBQUUsbUJBQW1CLEVBQUUsa0JBQWtCLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUVsSixRQUFRLEdBQUcsRUFBRSxDQUFDO3dCQUNkLGNBQWMsR0FBRyxnQkFBZ0IsQ0FBQzt3QkFDbEMsYUFBYSxHQUFHLGVBQWUsQ0FBQzt3QkFFaEMscUJBQXFCLEdBQUcsbUJBQW1CLENBQUM7d0JBQzVDLG9CQUFvQixHQUFHLGtCQUFrQixDQUFDO29CQUMzQyxDQUFDO3lCQUFNLENBQUM7d0JBQ1AsSUFBSSxZQUFvQixFQUFFLFdBQW1CLENBQUM7d0JBQzlDLElBQUksWUFBWSxLQUFLLENBQUMsRUFBRSxDQUFDOzRCQUN4QixZQUFZLEdBQUcscUJBQXFCLENBQUM7NEJBQ3JDLFdBQVcsR0FBRyxvQkFBb0IsR0FBRyxXQUFXLENBQUM7d0JBQ2xELENBQUM7NkJBQU0sQ0FBQzs0QkFDUCxZQUFZLEdBQUcscUJBQXFCLEdBQUcsWUFBWSxDQUFDOzRCQUNwRCxXQUFXLEdBQUcsV0FBVyxHQUFHLENBQUMsQ0FBQzt3QkFDL0IsQ0FBQzt3QkFFRCxxQkFBcUIsR0FBRyxZQUFZLENBQUM7d0JBQ3JDLG9CQUFvQixHQUFHLFdBQVcsQ0FBQzt3QkFFbkMsY0FBYyxHQUFHLGdCQUFnQixDQUFDO3dCQUNsQyxhQUFhLEdBQUcsZUFBZSxDQUFDO29CQUNqQyxDQUFDO29CQUNELGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUM7b0JBQ3hDLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7b0JBQ25DLE1BQU07Z0JBQ1AsQ0FBQztnQkFFRCxJQUFJLFFBQVEsS0FBSyxJQUFJLEVBQUUsQ0FBQztvQkFDdkIsa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksZUFBZSxDQUFDLElBQUksS0FBSyxDQUFDLHFCQUFxQixFQUFFLG9CQUFvQixFQUFFLG1CQUFtQixFQUFFLGtCQUFrQixDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDekosQ0FBQztnQkFFRCxrQkFBa0IsR0FBRyxlQUFlLENBQUM7Z0JBQ3JDLGlCQUFpQixHQUFHLGNBQWMsQ0FBQztnQkFDbkMsWUFBWSxHQUFHLEtBQUssQ0FBQztZQUN0QixDQUFDO1lBRUQsSUFBSSxtQkFBbUIsR0FBa0IsSUFBSSxDQUFDO1lBQzlDLElBQUksa0JBQWtCLEdBQWtCLElBQUksQ0FBQztZQUM3QyxJQUFJLGlCQUFpQixHQUFrQixJQUFJLENBQUM7WUFDNUMsSUFBSSxnQkFBZ0IsR0FBa0IsSUFBSSxDQUFDO1lBRTNDLE9BQU8sSUFBSSxFQUFFLENBQUM7Z0JBQ2IsSUFBSSxrQkFBa0IsS0FBSyxLQUFLLENBQUMsVUFBVSxJQUFJLGlCQUFpQixLQUFLLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztvQkFBQyxNQUFNO2dCQUFDLENBQUM7Z0JBQzdGLFVBQVUsRUFBRSxDQUFDO2dCQUViLElBQUksY0FBYyxFQUFFLENBQUM7b0JBQ3BCLElBQUksUUFBZ0IsRUFBRSxPQUFlLENBQUM7b0JBQ3RDLElBQUksa0JBQWtCLEtBQUssS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO3dCQUM3QyxRQUFRLEdBQUcsQ0FBQyxDQUFDO3dCQUNiLE9BQU8sR0FBRyxLQUFLLENBQUMsTUFBTSxHQUFHLGlCQUFpQixDQUFDO29CQUM1QyxDQUFDO3lCQUFNLENBQUM7d0JBQ1AsUUFBUSxHQUFHLEtBQUssQ0FBQyxVQUFVLEdBQUcsa0JBQWtCLENBQUM7d0JBQ2pELE9BQU8sR0FBRyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztvQkFDNUIsQ0FBQztvQkFFRCxJQUFJLGdCQUF3QixFQUFFLGVBQXVCLENBQUM7b0JBQ3RELElBQUksUUFBUSxLQUFLLENBQUMsRUFBRSxDQUFDO3dCQUNwQixnQkFBZ0IsR0FBRyxxQkFBcUIsQ0FBQzt3QkFDekMsZUFBZSxHQUFHLG9CQUFvQixHQUFHLE9BQU8sQ0FBQztvQkFDbEQsQ0FBQzt5QkFBTSxDQUFDO3dCQUNQLGdCQUFnQixHQUFHLHFCQUFxQixHQUFHLFFBQVEsQ0FBQzt3QkFDcEQsZUFBZSxHQUFHLE9BQU8sR0FBRyxDQUFDLENBQUM7b0JBQy9CLENBQUM7b0JBRUQsSUFBSSxtQkFBbUIsS0FBSyxJQUFJLEVBQUUsQ0FBQzt3QkFDbEMsbUJBQW1CLEdBQUcscUJBQXFCLENBQUM7d0JBQzVDLGtCQUFrQixHQUFHLG9CQUFvQixDQUFDO29CQUMzQyxDQUFDO29CQUNELGlCQUFpQixHQUFHLGdCQUFnQixDQUFDO29CQUNyQyxnQkFBZ0IsR0FBRyxlQUFlLENBQUM7b0JBRW5DLGtCQUFrQixHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUM7b0JBQ3RDLGlCQUFpQixHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7b0JBRWpDLHFCQUFxQixHQUFHLGdCQUFnQixDQUFDO29CQUN6QyxvQkFBb0IsR0FBRyxlQUFlLENBQUM7b0JBQ3ZDLE1BQU07Z0JBQ1AsQ0FBQztnQkFFRCxJQUFJLGVBQXVCLEVBQUUsY0FBc0IsQ0FBQztnQkFDcEQsSUFBSSxjQUFjLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQzFCLGVBQWUsR0FBRyxrQkFBa0IsQ0FBQztvQkFDckMsY0FBYyxHQUFHLGlCQUFpQixHQUFHLGFBQWEsQ0FBQztnQkFDcEQsQ0FBQztxQkFBTSxDQUFDO29CQUNQLGVBQWUsR0FBRyxrQkFBa0IsR0FBRyxjQUFjLENBQUM7b0JBQ3RELGNBQWMsR0FBRyxhQUFhLEdBQUcsQ0FBQyxDQUFDO2dCQUNwQyxDQUFDO2dCQUVELElBQUksb0JBQW9CLEdBQUcsS0FBSyxDQUFDO2dCQUNqQyxJQUFJLEtBQUssQ0FBQyxVQUFVLEdBQUcsZUFBZSxFQUFFLENBQUM7b0JBQ3hDLG9CQUFvQixHQUFHLElBQUksQ0FBQztnQkFDN0IsQ0FBQztxQkFBTSxJQUFJLEtBQUssQ0FBQyxVQUFVLEtBQUssZUFBZSxFQUFFLENBQUM7b0JBQ2pELG9CQUFvQixHQUFHLEtBQUssQ0FBQyxNQUFNLEdBQUcsY0FBYyxDQUFDO2dCQUN0RCxDQUFDO2dCQUVELElBQUksb0JBQW9CLEVBQUUsQ0FBQztvQkFDMUIsSUFBSSxZQUFvQixFQUFFLFdBQW1CLENBQUM7b0JBQzlDLElBQUksa0JBQWtCLEtBQUssS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO3dCQUM3QyxZQUFZLEdBQUcsQ0FBQyxDQUFDO3dCQUNqQixXQUFXLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQztvQkFDaEQsQ0FBQzt5QkFBTSxDQUFDO3dCQUNQLFlBQVksR0FBRyxLQUFLLENBQUMsVUFBVSxHQUFHLGtCQUFrQixDQUFDO3dCQUNyRCxXQUFXLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7b0JBQ2hDLENBQUM7b0JBRUQsSUFBSSxnQkFBd0IsRUFBRSxlQUF1QixDQUFDO29CQUN0RCxJQUFJLFlBQVksS0FBSyxjQUFjLEVBQUUsQ0FBQzt3QkFDckMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO3dCQUNyQixlQUFlLEdBQUcsYUFBYSxHQUFHLFdBQVcsQ0FBQztvQkFDL0MsQ0FBQzt5QkFBTSxDQUFDO3dCQUNQLGdCQUFnQixHQUFHLGNBQWMsR0FBRyxZQUFZLENBQUM7d0JBQ2pELGVBQWUsR0FBRyxhQUFhLENBQUM7b0JBQ2pDLENBQUM7b0JBRUQsSUFBSSxRQUFRLEtBQUssSUFBSSxFQUFFLENBQUM7d0JBQ3ZCLElBQUksbUJBQW1CLEtBQUssSUFBSSxFQUFFLENBQUM7NEJBQ2xDLG1CQUFtQixHQUFHLHFCQUFxQixDQUFDOzRCQUM1QyxrQkFBa0IsR0FBRyxvQkFBb0IsQ0FBQzt3QkFDM0MsQ0FBQzt3QkFDRCxpQkFBaUIsR0FBRyxtQkFBbUIsQ0FBQzt3QkFDeEMsZ0JBQWdCLEdBQUcsa0JBQWtCLENBQUM7d0JBRXRDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxRQUFRLEVBQUUsWUFBWSxFQUFFLFdBQVcsQ0FBQyxDQUFDO3dCQUM5RCxRQUFRLEdBQUcsRUFBRSxDQUFDO3dCQUNkLGNBQWMsR0FBRyxnQkFBZ0IsQ0FBQzt3QkFDbEMsYUFBYSxHQUFHLGVBQWUsQ0FBQzt3QkFFaEMscUJBQXFCLEdBQUcsbUJBQW1CLENBQUM7d0JBQzVDLG9CQUFvQixHQUFHLGtCQUFrQixDQUFDO29CQUMzQyxDQUFDO3lCQUFNLENBQUM7d0JBQ1AsSUFBSSxZQUFvQixFQUFFLFdBQW1CLENBQUM7d0JBQzlDLElBQUksWUFBWSxLQUFLLENBQUMsRUFBRSxDQUFDOzRCQUN4QixZQUFZLEdBQUcscUJBQXFCLENBQUM7NEJBQ3JDLFdBQVcsR0FBRyxvQkFBb0IsR0FBRyxXQUFXLENBQUM7d0JBQ2xELENBQUM7NkJBQU0sQ0FBQzs0QkFDUCxZQUFZLEdBQUcscUJBQXFCLEdBQUcsWUFBWSxDQUFDOzRCQUNwRCxXQUFXLEdBQUcsV0FBVyxHQUFHLENBQUMsQ0FBQzt3QkFDL0IsQ0FBQzt3QkFFRCxJQUFJLG1CQUFtQixLQUFLLElBQUksRUFBRSxDQUFDOzRCQUNsQyxtQkFBbUIsR0FBRyxxQkFBcUIsQ0FBQzs0QkFDNUMsa0JBQWtCLEdBQUcsb0JBQW9CLENBQUM7d0JBQzNDLENBQUM7d0JBQ0QsaUJBQWlCLEdBQUcsWUFBWSxDQUFDO3dCQUNqQyxnQkFBZ0IsR0FBRyxXQUFXLENBQUM7d0JBRS9CLHFCQUFxQixHQUFHLFlBQVksQ0FBQzt3QkFDckMsb0JBQW9CLEdBQUcsV0FBVyxDQUFDO3dCQUVuQyxjQUFjLEdBQUcsZ0JBQWdCLENBQUM7d0JBQ2xDLGFBQWEsR0FBRyxlQUFlLENBQUM7b0JBQ2pDLENBQUM7b0JBQ0Qsa0JBQWtCLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQztvQkFDdEMsaUJBQWlCLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztvQkFDakMsTUFBTTtnQkFDUCxDQUFDO2dCQUVELElBQUksbUJBQW1CLEtBQUssSUFBSSxFQUFFLENBQUM7b0JBQ2xDLG1CQUFtQixHQUFHLHFCQUFxQixDQUFDO29CQUM1QyxrQkFBa0IsR0FBRyxvQkFBb0IsQ0FBQztnQkFDM0MsQ0FBQztnQkFDRCxpQkFBaUIsR0FBRyxtQkFBbUIsQ0FBQztnQkFDeEMsZ0JBQWdCLEdBQUcsa0JBQWtCLENBQUM7Z0JBRXRDLGtCQUFrQixHQUFHLGVBQWUsQ0FBQztnQkFDckMsaUJBQWlCLEdBQUcsY0FBYyxDQUFDO2dCQUNuQyxZQUFZLEdBQUcsS0FBSyxDQUFDO1lBQ3RCLENBQUM7WUFFRCxJQUFJLG1CQUFtQixLQUFLLElBQUksRUFBRSxDQUFDO2dCQUNsQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxlQUFlLENBQUMsSUFBSSxLQUFLLENBQUMsbUJBQW1CLEVBQUUsa0JBQW1CLEVBQUUsaUJBQWtCLEVBQUUsZ0JBQWlCLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNuSixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsVUFBVSxFQUFFLENBQUM7Z0JBQ2IsTUFBTSxlQUFlLEdBQUcscUJBQXFCLENBQUM7Z0JBQzlDLE1BQU0sY0FBYyxHQUFHLG9CQUFvQixDQUFDO2dCQUM1QyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxlQUFlLENBQUMsSUFBSSxLQUFLLENBQUMsZUFBZSxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsY0FBYyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDcEksQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLElBQUksRUFBRSxDQUFDO1lBQ2IsVUFBVSxFQUFFLENBQUM7WUFDYixJQUFJLGNBQWMsRUFBRSxDQUFDO2dCQUFDLE1BQU07WUFBQyxDQUFDO1lBQzlCLElBQUksUUFBUSxLQUFLLElBQUksRUFBRSxDQUFDO2dCQUN2QixrQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxlQUFlLENBQUMsSUFBSSxLQUFLLENBQUMscUJBQXFCLEVBQUUsb0JBQW9CLEVBQUUsbUJBQW1CLEVBQUUsa0JBQWtCLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBQ3pKLENBQUM7WUFDRCxZQUFZLEdBQUcsS0FBSyxDQUFDO1FBQ3RCLENBQUM7UUFFRCxPQUFPLElBQUksUUFBUSxDQUFDLGtCQUFrQixDQUFDLENBQUMsU0FBUyxFQUFFLENBQUM7SUFDckQsQ0FBQztJQUVELFFBQVEsQ0FBQyxJQUF1QztRQUMvQyxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUN4QixPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xFLENBQUM7UUFFRCxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzlCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3BDLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDaEMsTUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDO1lBQ3JCLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRW5ELDJCQUEyQjtZQUMzQixNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsYUFBYSxDQUN0QyxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFDekQsQ0FBQyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxDQUMxQixDQUFDO1lBQ0YsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUNuRCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEdBQUcsU0FBUyxFQUFFLENBQUM7Z0JBQ25DLFVBQVUsR0FBRyxLQUFLLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQyxDQUFDO1lBQzFFLENBQUM7WUFFRCwwQkFBMEI7WUFDMUIsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLGFBQWEsQ0FDckMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsRUFDeEIsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUMxQyxDQUFDO1lBQ0YsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNqRCxJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsU0FBUyxFQUFFLENBQUM7Z0JBQ2xDLFNBQVMsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsR0FBRyxLQUFLLENBQUM7WUFDdkQsQ0FBQztZQUVELDJCQUEyQjtZQUMzQixJQUFJLFlBQVksR0FBRyxZQUFZLENBQUM7WUFDaEMsSUFBSSxZQUFZLENBQUMsTUFBTSxHQUFHLFNBQVMsRUFBRSxDQUFDO2dCQUNyQyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDMUMsWUFBWSxHQUFHLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxHQUFHLEtBQUs7b0JBQ3hELFlBQVksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsQ0FBQztZQUN4RCxDQUFDO1lBRUQsc0JBQXNCO1lBQ3RCLElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDckIsSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLFNBQVMsRUFBRSxDQUFDO2dCQUNoQyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDMUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxHQUFHLEtBQUs7b0JBQzlDLE9BQU8sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsQ0FBQztZQUM5QyxDQUFDO1lBRUQsSUFBSSxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUMvQiw4QkFBOEI7Z0JBQzlCLE9BQU8sR0FBRyxVQUFVLElBQUksT0FBTyxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2hELENBQUM7WUFDRCw4QkFBOEI7WUFDOUIsT0FBTyxHQUFHLFVBQVUsSUFBSSxZQUFZLElBQUksT0FBTyxJQUFJLFNBQVMsRUFBRSxDQUFDO1FBQ2hFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNmLENBQUM7Q0FDRDtBQUVELE1BQU0sT0FBTyxlQUFlO0lBQ3BCLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxZQUErQixFQUFFLFlBQTBCO1FBQ3pGLElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUFDLE1BQU0sSUFBSSxrQkFBa0IsRUFBRSxDQUFDO1FBQUMsQ0FBQztRQUNsRSxJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFBQyxPQUFPLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUFDLENBQUM7UUFFMUQsTUFBTSxRQUFRLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQzFELE1BQU0sTUFBTSxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUU1RSxJQUFJLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFFakIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUM5QyxNQUFNLE9BQU8sR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDaEMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUM7WUFDeEIsSUFBSSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDakMsTUFBTSxRQUFRLEdBQUcsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDckMsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDO2dCQUN4RyxNQUFNLE9BQU8sR0FBRyxZQUFZLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUN2RCxPQUFPLElBQUksT0FBTyxDQUFDO1lBQ3BCLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxJQUFJLGVBQWUsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUM1RSxDQUFDO0lBRU0sTUFBTSxDQUFDLHFCQUFxQixDQUFDLFdBQThCLEVBQUUsWUFBMEI7UUFDN0YsT0FBTyxJQUFJLGVBQWUsQ0FBQyxZQUFZLENBQUMsY0FBYyxFQUFFLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsRUFBRSxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDbkgsQ0FBQztJQUVNLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBWTtRQUNoQyxPQUFPLElBQUksZUFBZSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN2QyxDQUFDO0lBRUQsWUFDaUIsS0FBWSxFQUNaLElBQVk7UUFEWixVQUFLLEdBQUwsS0FBSyxDQUFPO1FBQ1osU0FBSSxHQUFKLElBQUksQ0FBUTtJQUU3QixDQUFDO0lBRUQsSUFBSSxPQUFPO1FBQ1YsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBRUQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFzQixFQUFFLE1BQXVCO1FBQzVELE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssTUFBTSxDQUFDLElBQUksQ0FBQztJQUM1RSxDQUFDO0lBRU0scUJBQXFCO1FBQzNCLE9BQU87WUFDTixLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7WUFDakIsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1NBQ2YsQ0FBQztJQUNILENBQUM7SUFFTSxNQUFNO1FBQ1osT0FBTyxJQUFJLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDN0IsQ0FBQztJQUVNLE1BQU0sQ0FBQyxLQUFzQjtRQUNuQyxPQUFPLGVBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFTSxrQkFBa0IsQ0FBQyxLQUFZLEVBQUUsWUFBMEI7UUFDakUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQUMsT0FBTyxJQUFJLENBQUM7UUFBQyxDQUFDO1FBRXJELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzdDLE1BQU0sVUFBVSxHQUFHLFlBQVksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ2pJLE1BQU0sU0FBUyxHQUFHLFlBQVksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxFQUFFLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUgsTUFBTSxPQUFPLEdBQUcsVUFBVSxHQUFHLElBQUksQ0FBQyxJQUFJLEdBQUcsU0FBUyxDQUFDO1FBQ25ELE9BQU8sSUFBSSxlQUFlLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFFTSxnQkFBZ0IsQ0FBQyxZQUEwQjtRQUNqRCxNQUFNLFFBQVEsR0FBRyxJQUFJLEtBQUssQ0FDekIsSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLEVBQzFCLENBQUMsRUFDRCxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsRUFDeEIsWUFBWSxDQUFDLGNBQWMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FDekUsQ0FBQztRQUNGLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUN4RCxDQUFDO0lBRU0sMkJBQTJCLENBQUMsSUFBa0I7UUFDcEQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzdDLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMvQyxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFFTSxrQkFBa0IsQ0FBQyxJQUFrQjtRQUMzQyxNQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDekYsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFbEUsTUFBTSxlQUFlLEdBQUcsa0JBQWtCLENBQUMsc0JBQXNCLEVBQUUsc0JBQXNCLENBQUMsQ0FBQztRQUMzRixNQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLHNCQUFzQixDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsZUFBZSxDQUFDLENBQUM7YUFDbkYsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDO1FBRS9DLE1BQU0sT0FBTyxHQUFHLHNCQUFzQixDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUNsRSxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUM7UUFDdEUsT0FBTyxJQUFJLGVBQWUsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVNLGtCQUFrQixDQUFDLElBQWtCO1FBQzNDLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN6RixNQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUVsRSxNQUFNLGVBQWUsR0FBRyxrQkFBa0IsQ0FBQyxzQkFBc0IsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1FBQzNGLE1BQU0sR0FBRyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsc0JBQXNCLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxzQkFBc0IsQ0FBQyxNQUFNLEdBQUcsZUFBZSxDQUFDLENBQUM7YUFDakgsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDO1FBRS9DLE1BQU0sT0FBTyxHQUFHLHNCQUFzQixDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsc0JBQXNCLENBQUMsTUFBTSxHQUFHLGVBQWUsQ0FBQyxDQUFDO1FBQ3JHLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3RFLE9BQU8sSUFBSSxlQUFlLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFTSxtQkFBbUIsQ0FBQyxJQUFrQjtRQUM1QyxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDakQsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUM3RSxNQUFNLENBQUMsR0FBRyxrQkFBa0IsQ0FBQyxPQUFPLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDcEQsT0FBTyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0IsWUFBWSxHQUFHLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekMsTUFBTSxDQUFDLEdBQUcsa0JBQWtCLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ3BELE9BQU8sR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ25ELFlBQVksR0FBRyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBRWxFLE9BQU8sT0FBTyxLQUFLLEVBQUUsQ0FBQztJQUN2QixDQUFDO0lBRU0sUUFBUTtRQUNkLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUM1QyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3hDLE9BQU8sSUFBSSxLQUFLLENBQUMsVUFBVSxJQUFJLEtBQUssQ0FBQyxNQUFNLE9BQU8sR0FBRyxDQUFDLFVBQVUsSUFBSSxHQUFHLENBQUMsTUFBTSxPQUFPLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQztJQUNuRyxDQUFDO0NBQ0Q7QUFFRCxTQUFTLGtCQUFrQixDQUFDLEtBQWUsRUFBRSxHQUFhO0lBQ3pELElBQUksS0FBSyxDQUFDLFVBQVUsS0FBSyxHQUFHLENBQUMsVUFBVSxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssTUFBTSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDckYsT0FBTyxLQUFLLENBQUMsYUFBYSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUN0QyxDQUFDO1NBQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztRQUN4QyxNQUFNLElBQUksa0JBQWtCLENBQUMsMEJBQTBCLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBQ0QsT0FBTyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDOUUsQ0FBQyJ9