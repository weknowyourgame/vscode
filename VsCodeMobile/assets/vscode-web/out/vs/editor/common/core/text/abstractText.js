/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { assert } from '../../../../base/common/assert.js';
import { splitLines } from '../../../../base/common/strings.js';
import { Position } from '../position.js';
import { Range } from '../range.js';
import { TextLength } from '../text/textLength.js';
import { PositionOffsetTransformer } from './positionToOffsetImpl.js';
export class AbstractText {
    constructor() {
        this._transformer = undefined;
    }
    get endPositionExclusive() {
        return this.length.addToPosition(new Position(1, 1));
    }
    get lineRange() {
        return this.length.toLineRange();
    }
    getValue() {
        return this.getValueOfRange(this.length.toRange());
    }
    getValueOfOffsetRange(range) {
        return this.getValueOfRange(this.getTransformer().getRange(range));
    }
    getLineLength(lineNumber) {
        return this.getValueOfRange(new Range(lineNumber, 1, lineNumber, Number.MAX_SAFE_INTEGER)).length;
    }
    getTransformer() {
        if (!this._transformer) {
            this._transformer = new PositionOffsetTransformer(this.getValue());
        }
        return this._transformer;
    }
    getLineAt(lineNumber) {
        return this.getValueOfRange(new Range(lineNumber, 1, lineNumber, Number.MAX_SAFE_INTEGER));
    }
    getLines() {
        const value = this.getValue();
        return splitLines(value);
    }
    getLinesOfRange(range) {
        return range.mapToLineArray(lineNumber => this.getLineAt(lineNumber));
    }
    equals(other) {
        if (this === other) {
            return true;
        }
        return this.getValue() === other.getValue();
    }
}
export class LineBasedText extends AbstractText {
    constructor(_getLineContent, _lineCount) {
        assert(_lineCount >= 1);
        super();
        this._getLineContent = _getLineContent;
        this._lineCount = _lineCount;
    }
    getValueOfRange(range) {
        if (range.startLineNumber === range.endLineNumber) {
            return this._getLineContent(range.startLineNumber).substring(range.startColumn - 1, range.endColumn - 1);
        }
        let result = this._getLineContent(range.startLineNumber).substring(range.startColumn - 1);
        for (let i = range.startLineNumber + 1; i < range.endLineNumber; i++) {
            result += '\n' + this._getLineContent(i);
        }
        result += '\n' + this._getLineContent(range.endLineNumber).substring(0, range.endColumn - 1);
        return result;
    }
    getLineLength(lineNumber) {
        return this._getLineContent(lineNumber).length;
    }
    get length() {
        const lastLine = this._getLineContent(this._lineCount);
        return new TextLength(this._lineCount - 1, lastLine.length);
    }
}
export class ArrayText extends LineBasedText {
    constructor(lines) {
        super(lineNumber => lines[lineNumber - 1], lines.length);
    }
}
export class StringText extends AbstractText {
    constructor(value) {
        super();
        this.value = value;
        this._t = new PositionOffsetTransformer(this.value);
    }
    getValueOfRange(range) {
        return this._t.getOffsetRange(range).substring(this.value);
    }
    get length() {
        return this._t.textLength;
    }
    // Override the getTransformer method to return the cached transformer
    getTransformer() {
        return this._t;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJzdHJhY3RUZXh0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb21tb24vY29yZS90ZXh0L2Fic3RyYWN0VGV4dC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDM0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBR3BDLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNuRCxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUV0RSxNQUFNLE9BQWdCLFlBQVk7SUFBbEM7UUF3QlMsaUJBQVksR0FBMEMsU0FBUyxDQUFDO0lBNEJ6RSxDQUFDO0lBaERBLElBQUksb0JBQW9CO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdEQsQ0FBQztJQUVELElBQUksU0FBUztRQUNaLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUNsQyxDQUFDO0lBRUQsUUFBUTtRQUNQLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELHFCQUFxQixDQUFDLEtBQWtCO1FBQ3ZDLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDcEUsQ0FB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