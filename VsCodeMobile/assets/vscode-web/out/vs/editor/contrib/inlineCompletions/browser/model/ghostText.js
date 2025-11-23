/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { equals } from '../../../../../base/common/arrays.js';
import { splitLines } from '../../../../../base/common/strings.js';
import { Position } from '../../../../common/core/position.js';
import { Range } from '../../../../common/core/range.js';
import { TextReplacement, TextEdit } from '../../../../common/core/edits/textEdit.js';
import { LineDecoration } from '../../../../common/viewLayout/lineDecorations.js';
import { assertFn, checkAdjacentItems } from '../../../../../base/common/assert.js';
export class GhostText {
    constructor(lineNumber, parts) {
        this.lineNumber = lineNumber;
        this.parts = parts;
        assertFn(() => checkAdjacentItems(parts, (p1, p2) => p1.column <= p2.column));
    }
    equals(other) {
        return this.lineNumber === other.lineNumber &&
            this.parts.length === other.parts.length &&
            this.parts.every((part, index) => part.equals(other.parts[index]));
    }
    /**
     * Only used for testing/debugging.
    */
    render(documentText, debug = false) {
        return new TextEdit([
            ...this.parts.map(p => new TextReplacement(Range.fromPositions(new Position(this.lineNumber, p.column)), debug ? `[${p.lines.map(line => line.line).join('\n')}]` : p.lines.map(line => line.line).join('\n'))),
        ]).applyToString(documentText);
    }
    renderForScreenReader(lineText) {
        if (this.parts.length === 0) {
            return '';
        }
        const lastPart = this.parts[this.parts.length - 1];
        const cappedLineText = lineText.substr(0, lastPart.column - 1);
        const text = new TextEdit([
            ...this.parts.map(p => new TextReplacement(Range.fromPositions(new Position(1, p.column)), p.lines.map(line => line.line).join('\n'))),
        ]).applyToString(cappedLineText);
        return text.substring(this.parts[0].column - 1);
    }
    isEmpty() {
        return this.parts.every(p => p.lines.length === 0);
    }
    get lineCount() {
        return 1 + this.parts.reduce((r, p) => r + p.lines.length - 1, 0);
    }
}
export class GhostTextPart {
    constructor(column, text, 
    /**
     * Indicates if this part is a preview of an inline suggestion when a suggestion is previewed.
    */
    preview, _inlineDecorations = []) {
        this.column = column;
        this.text = text;
        this.preview = preview;
        this._inlineDecorations = _inlineDecorations;
        this.lines = splitLines(this.text).map((line, i) => ({
            line,
            lineDecorations: LineDecoration.filter(this._inlineDecorations, i + 1, 1, line.length + 1)
        }));
    }
    equals(other) {
        return this.column === other.column &&
            this.lines.length === other.lines.length &&
            this.lines.every((line, index) => line.line === other.lines[index].line &&
                LineDecoration.equalsArr(line.lineDecorations, other.lines[index].lineDecorations));
    }
}
export class GhostTextReplacement {
    constructor(lineNumber, columnRange, text, additionalReservedLineCount = 0) {
        this.lineNumber = lineNumber;
        this.columnRange = columnRange;
        this.text = text;
        this.additionalReservedLineCount = additionalReservedLineCount;
        this.parts = [
            new GhostTextPart(this.columnRange.endColumnExclusive, this.text, false),
        ];
        this.newLines = splitLines(this.text);
    }
    renderForScreenReader(_lineText) {
        return this.newLines.join('\n');
    }
    render(documentText, debug = false) {
        const replaceRange = this.columnRange.toRange(this.lineNumber);
        if (debug) {
            return new TextEdit([
                new TextReplacement(Range.fromPositions(replaceRange.getStartPosition()), '('),
                new TextReplacement(Range.fromPositions(replaceRange.getEndPosition()), `)[${this.newLines.join('\n')}]`),
            ]).applyToString(documentText);
        }
        else {
            return new TextEdit([
                new TextReplacement(replaceRange, this.newLines.join('\n')),
            ]).applyToString(documentText);
        }
    }
    get lineCount() {
        return this.newLines.length;
    }
    isEmpty() {
        return this.parts.every(p => p.lines.length === 0);
    }
    equals(other) {
        return this.lineNumber === other.lineNumber &&
            this.columnRange.equals(other.columnRange) &&
            this.newLines.length === other.newLines.length &&
            this.newLines.every((line, index) => line === other.newLines[index]) &&
            this.additionalReservedLineCount === other.additionalReservedLineCount;
    }
}
export function ghostTextsOrReplacementsEqual(a, b) {
    return equals(a, b, ghostTextOrReplacementEquals);
}
export function ghostTextOrReplacementEquals(a, b) {
    if (a === b) {
        return true;
    }
    if (!a || !b) {
        return false;
    }
    if (a instanceof GhostText && b instanceof GhostText) {
        return a.equals(b);
    }
    if (a instanceof GhostTextReplacement && b instanceof GhostTextReplacement) {
        return a.equals(b);
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2hvc3RUZXh0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvbW9kZWwvZ2hvc3RUZXh0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDbkUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUsZUFBZSxFQUFFLFFBQVEsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUVsRixPQUFPLEVBQUUsUUFBUSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFHcEYsTUFBTSxPQUFPLFNBQVM7SUFDckIsWUFDaUIsVUFBa0IsRUFDbEIsS0FBc0I7UUFEdEIsZUFBVSxHQUFWLFVBQVUsQ0FBUTtRQUNsQixVQUFLLEdBQUwsS0FBSyxDQUFpQjtRQUV0QyxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsa0JBQWtCLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUMvRSxDQUFDO0lBRUQsTUFBTSxDQUFDLEtBQWdCO1FBQ3RCLE9BQU8sSUFBSSxDQUFDLFVBQVUsS0FBSyxLQUFLLENBQUMsVUFBVTtZQUMxQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sS0FBSyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU07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