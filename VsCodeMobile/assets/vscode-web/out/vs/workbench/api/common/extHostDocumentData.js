/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ok } from '../../../base/common/assert.js';
import { Schemas } from '../../../base/common/network.js';
import { regExpLeadsToEndlessLoop } from '../../../base/common/strings.js';
import { MirrorTextModel } from '../../../editor/common/model/mirrorTextModel.js';
import { ensureValidWordDefinition, getWordAtText } from '../../../editor/common/core/wordHelper.js';
import { equals } from '../../../base/common/arrays.js';
import { EndOfLine } from './extHostTypes/textEdit.js';
import { Position } from './extHostTypes/position.js';
import { Range } from './extHostTypes/range.js';
const _languageId2WordDefinition = new Map();
export function setWordDefinitionFor(languageId, wordDefinition) {
    if (!wordDefinition) {
        _languageId2WordDefinition.delete(languageId);
    }
    else {
        _languageId2WordDefinition.set(languageId, wordDefinition);
    }
}
function getWordDefinitionFor(languageId) {
    return _languageId2WordDefinition.get(languageId);
}
export class ExtHostDocumentData extends MirrorTextModel {
    constructor(_proxy, uri, lines, eol, versionId, _languageId, _isDirty, _encoding, _strictInstanceofChecks = true // used for code reuse
    ) {
        super(uri, lines, eol, versionId);
        this._proxy = _proxy;
        this._languageId = _languageId;
        this._isDirty = _isDirty;
        this._encoding = _encoding;
        this._strictInstanceofChecks = _strictInstanceofChecks;
        this._isDisposed = false;
    }
    // eslint-disable-next-line local/code-must-use-super-dispose
    dispose() {
        // we don't really dispose documents but let
        // extensions still read from them. some
        // operations, live saving, will now error tho
        ok(!this._isDisposed);
        this._isDisposed = true;
        this._isDirty = false;
    }
    equalLines(lines) {
        return equals(this._lines, lines);
    }
    get document() {
        if (!this._document) {
            const that = this;
            this._document = {
                get uri() { return that._uri; },
                get fileName() { return that._uri.fsPath; },
                get isUntitled() { return that._uri.scheme === Schemas.untitled; },
                get languageId() { return that._languageId; },
                get version() { return that._versionId; },
                get isClosed() { return that._isDisposed; },
                get isDirty() { return that._isDirty; },
                get encoding() { return that._encoding; },
                save() { return that._save(); },
                getText(range) { return range ? that._getTextInRange(range) : that.getText(); },
                get eol() { return that._eol === '\n' ? EndOfLine.LF : EndOfLine.CRLF; },
                get lineCount() { return that._lines.length; },
                lineAt(lineOrPos) { return that._lineAt(lineOrPos); },
                offsetAt(pos) { return that._offsetAt(pos); },
                positionAt(offset) { return that._positionAt(offset); },
                validateRange(ran) { return that._validateRange(ran); },
                validatePosition(pos) { return that._validatePosition(pos); },
                getWordRangeAtPosition(pos, regexp) { return that._getWordRangeAtPosition(pos, regexp); },
                [Symbol.for('debug.description')]() {
                    return `TextDocument(${that._uri.toString()})`;
                }
            };
        }
        return Object.freeze(this._document);
    }
    _acceptLanguageId(newLanguageId) {
        ok(!this._isDisposed);
        this._languageId = newLanguageId;
    }
    _acceptIsDirty(isDirty) {
        ok(!this._isDisposed);
        this._isDirty = isDirty;
    }
    _acceptEncoding(encoding) {
        ok(!this._isDisposed);
        this._encoding = encoding;
    }
    _save() {
        if (this._isDisposed) {
            return Promise.reject(new Error('Document has been closed'));
        }
        return this._proxy.$trySaveDocument(this._uri);
    }
    _getTextInRange(_range) {
        const range = this._validateRange(_range);
        if (range.isEmpty) {
            return '';
        }
        if (range.isSingleLine) {
            return this._lines[range.start.line].substring(range.start.character, range.end.character);
        }
        const lineEnding = this._eol, startLineIndex = range.start.line, endLineIndex = range.end.line, resultLines = [];
        resultLines.push(this._lines[startLineIndex].substring(range.start.character));
        for (let i = startLineIndex + 1; i < endLineIndex; i++) {
            resultLines.push(this._lines[i]);
        }
        resultLines.push(this._lines[endLineIndex].substring(0, range.end.character));
        return resultLines.join(lineEnding);
    }
    _lineAt(lineOrPosition) {
        let line;
        if (lineOrPosition instanceof Position) {
            line = lineOrPosition.line;
        }
        else if (typeof lineOrPosition === 'number') {
            line = lineOrPosition;
        }
        else if (!this._strictInstanceofChecks && Position.isPosition(lineOrPosition)) {
            line = lineOrPosition.line;
        }
        if (typeof line !== 'number' || line < 0 || line >= this._lines.length || Math.floor(line) !== line) {
            throw new Error('Illegal value for `line`');
        }
        return new ExtHostDocumentLine(line, this._lines[line], line === this._lines.length - 1);
    }
    _offsetAt(position) {
        position = this._validatePosition(position);
        this._ensureLineStarts();
        return this._lineStarts.getPrefixSum(position.line - 1) + position.character;
    }
    _positionAt(offset) {
        offset = Math.floor(offset);
        offset = Math.max(0, offset);
        this._ensureLineStarts();
        const out = this._lineStarts.getIndexOf(offset);
        const lineLength = this._lines[out.index].length;
        // Ensure we return a valid position
        return new Position(out.index, Math.min(out.remainder, lineLength));
    }
    // ---- range math
    _validateRange(range) {
        if (this._strictInstanceofChecks) {
            if (!(range instanceof Range)) {
                throw new Error('Invalid argument');
            }
        }
        else {
            if (!Range.isRange(range)) {
                throw new Error('Invalid argument');
            }
        }
        const start = this._validatePosition(range.start);
        const end = this._validatePosition(range.end);
        if (start === range.start && end === range.end) {
            return range;
        }
        return new Range(start.line, start.character, end.line, end.character);
    }
    _validatePosition(position) {
        if (this._strictInstanceofChecks) {
            if (!(position instanceof Position)) {
                throw new Error('Invalid argument');
            }
        }
        else {
            if (!Position.isPosition(position)) {
                throw new Error('Invalid argument');
            }
        }
        if (this._lines.length === 0) {
            return position.with(0, 0);
        }
        let { line, character } = position;
        let hasChanged = false;
        if (line < 0) {
            line = 0;
            character = 0;
            hasChanged = true;
        }
        else if (line >= this._lines.length) {
            line = this._lines.length - 1;
            character = this._lines[line].length;
            hasChanged = true;
        }
        else {
            const maxCharacter = this._lines[line].length;
            if (character < 0) {
                character = 0;
                hasChanged = true;
            }
            else if (character > maxCharacter) {
                character = maxCharacter;
                hasChanged = true;
            }
        }
        if (!hasChanged) {
            return position;
        }
        return new Position(line, character);
    }
    _getWordRangeAtPosition(_position, regexp) {
        const position = this._validatePosition(_position);
        if (!regexp) {
            // use default when custom-regexp isn't provided
            regexp = getWordDefinitionFor(this._languageId);
        }
        else if (regExpLeadsToEndlessLoop(regexp)) {
            // use default when custom-regexp is bad
            throw new Error(`[getWordRangeAtPosition]: ignoring custom regexp '${regexp.source}' because it matches the empty string.`);
        }
        const wordAtText = getWordAtText(position.character + 1, ensureValidWordDefinition(regexp), this._lines[position.line], 0);
        if (wordAtText) {
            return new Range(position.line, wordAtText.startColumn - 1, position.line, wordAtText.endColumn - 1);
        }
        return undefined;
    }
}
export class ExtHostDocumentLine {
    constructor(line, text, isLastLine) {
        this._line = line;
        this._text = text;
        this._isLastLine = isLastLine;
    }
    get lineNumber() {
        return this._line;
    }
    get text() {
        return this._text;
    }
    get range() {
        return new Range(this._line, 0, this._line, this._text.length);
    }
    get rangeIncludingLineBreak() {
        if (this._isLastLine) {
            return this.range;
        }
        return new Range(this._line, 0, this._line + 1, 0);
    }
    get firstNonWhitespaceCharacterIndex() {
        //TODO@api, rename to 'leadingWhitespaceLength'
        return /^(\s*)/.exec(this._text)[1].length;
    }
    get isEmptyOrWhitespace() {
        return this.firstNonWhitespaceCharacterIndex === this._text.length;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdERvY3VtZW50RGF0YS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0RG9jdW1lbnREYXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxFQUFFLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNwRCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDMUQsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFFM0UsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ2xGLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxhQUFhLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUVyRyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDeEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFFaEQsTUFBTSwwQkFBMEIsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztBQUM3RCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsVUFBa0IsRUFBRSxjQUFrQztJQUMxRixJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDckIsMEJBQTBCLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQy9DLENBQUM7U0FBTSxDQUFDO1FBQ1AsMEJBQTBCLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxjQUFjLENBQUMsQ0FBQztJQUM1RCxDQUFDO0FBQ0YsQ0FBQztBQUVELFNBQVMsb0JBQW9CLENBQUMsVUFBa0I7SUFDL0MsT0FBTywwQkFBMEIsQ0FBQyxH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