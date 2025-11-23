/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as arrays from '../../../base/common/arrays.js';
import { LineTokens } from './lineTokens.js';
/**
 * Represents sparse tokens in a text model.
 */
export class SparseTokensStore {
    constructor(languageIdCodec) {
        this._pieces = [];
        this._isComplete = false;
        this._languageIdCodec = languageIdCodec;
    }
    flush() {
        this._pieces = [];
        this._isComplete = false;
    }
    isEmpty() {
        return (this._pieces.length === 0);
    }
    set(pieces, isComplete, textModel = undefined) {
        this._pieces = pieces || [];
        this._isComplete = isComplete;
        if (textModel) {
            for (const p of this._pieces) {
                p.reportIfInvalid(textModel);
            }
        }
    }
    setPartial(_range, pieces) {
        // console.log(`setPartial ${_range} ${pieces.map(p => p.toString()).join(', ')}`);
        let range = _range;
        if (pieces.length > 0) {
            const _firstRange = pieces[0].getRange();
            const _lastRange = pieces[pieces.length - 1].getRange();
            if (!_firstRange || !_lastRange) {
                return _range;
            }
            range = _range.plusRange(_firstRange).plusRange(_lastRange);
        }
        let insertPosition = null;
        for (let i = 0, len = this._pieces.length; i < len; i++) {
            const piece = this._pieces[i];
            if (piece.endLineNumber < range.startLineNumber) {
                // this piece is before the range
                continue;
            }
            if (piece.startLineNumber > range.endLineNumber) {
                // this piece is after the range, so mark the spot before this piece
                // as a good insertion position and stop looping
                insertPosition = insertPosition || { index: i };
                break;
            }
            // this piece might intersect with the range
            piece.removeTokens(range);
            if (piece.isEmpty()) {
                // remove the piece if it became empty
                this._pieces.splice(i, 1);
                i--;
                len--;
                continue;
            }
            if (piece.endLineNumber < range.startLineNumber) {
                // after removal, this piece is before the range
                continue;
            }
            if (piece.startLineNumber > range.endLineNumber) {
                // after removal, this piece is after the range
                insertPosition = insertPosition || { index: i };
                continue;
            }
            // after removal, this piece contains the range
            const [a, b] = piece.split(range);
            if (a.isEmpty()) {
                // this piece is actually after the range
                insertPosition = insertPosition || { index: i };
                continue;
            }
            if (b.isEmpty()) {
                // this piece is actually before the range
                continue;
            }
            this._pieces.splice(i, 1, a, b);
            i++;
            len++;
            insertPosition = insertPosition || { index: i };
        }
        insertPosition = insertPosition || { index: this._pieces.length };
        if (pieces.length > 0) {
            this._pieces = arrays.arrayInsert(this._pieces, insertPosition.index, pieces);
        }
        // console.log(`I HAVE ${this._pieces.length} pieces`);
        // console.log(`${this._pieces.map(p => p.toString()).join('\n')}`);
        return range;
    }
    isComplete() {
        return this._isComplete;
    }
    addSparseTokens(lineNumber, aTokens) {
        if (aTokens.getTextLength() === 0) {
            // Don't do anything for empty lines
            return aTokens;
        }
        const pieces = this._pieces;
        if (pieces.length === 0) {
            return aTokens;
        }
        const pieceIndex = SparseTokensStore._findFirstPieceWithLine(pieces, lineNumber);
        const bTokens = pieces[pieceIndex].getLineTokens(lineNumber);
        if (!bTokens) {
            return aTokens;
        }
        const aLen = aTokens.getCount();
        const bLen = bTokens.getCount();
        let aIndex = 0;
        const result = [];
        let resultLen = 0;
        let lastEndOffset = 0;
        const emitToken = (endOffset, metadata) => {
            if (endOffset === lastEndOffset) {
                return;
            }
            lastEndOffset = endOffset;
            result[resultLen++] = endOffset;
            result[resultLen++] = metadata;
        };
        for (let bIndex = 0; bIndex < bLen; bIndex++) {
            // bTokens is not validated yet, but aTokens is. We want to make sure that the LineTokens we return
            // are valid, so we clamp the ranges to ensure that.
            const bStartCharacter = Math.min(bTokens.getStartCharacter(bIndex), aTokens.getTextLength());
            const bEndCharacter = Math.min(bTokens.getEndCharacter(bIndex), aTokens.getTextLength());
            const bMetadata = bTokens.getMetadata(bIndex);
            const bMask = (((bMetadata & 1 /* MetadataConsts.SEMANTIC_USE_ITALIC */) ? 2048 /* MetadataConsts.ITALIC_MASK */ : 0)
                | ((bMetadata & 2 /* MetadataConsts.SEMANTIC_USE_BOLD */) ? 4096 /* MetadataConsts.BOLD_MASK */ : 0)
                | ((bMetadata & 4 /* MetadataConsts.SEMANTIC_USE_UNDERLINE */) ? 8192 /* MetadataConsts.UNDERLINE_MASK */ : 0)
                | ((bMetadata & 8 /* MetadataConsts.SEMANTIC_USE_STRIKETHROUGH */) ? 16384 /* MetadataConsts.STRIKETHROUGH_MASK */ : 0)
                | ((bMetadata & 16 /* MetadataConsts.SEMANTIC_USE_FOREGROUND */) ? 16744448 /* MetadataConsts.FOREGROUND_MASK */ : 0)
                | ((bMetadata & 32 /* MetadataConsts.SEMANTIC_USE_BACKGROUND */) ? 4278190080 /* MetadataConsts.BACKGROUND_MASK */ : 0)) >>> 0;
            const aMask = (~bMask) >>> 0;
            // push any token from `a` that is before `b`
            while (aIndex < aLen && aTokens.getEndOffset(aIndex) <= bStartCharacter) {
                emitToken(aTokens.getEndOffset(aIndex), aTokens.getMetadata(aIndex));
                aIndex++;
            }
            // push the token from `a` if it intersects the token from `b`
            if (aIndex < aLen && aTokens.getStartOffset(aIndex) < bStartCharacter) {
                emitToken(bStartCharacter, aTokens.getMetadata(aIndex));
            }
            // skip any tokens from `a` that are contained inside `b`
            while (aIndex < aLen && aTokens.getEndOffset(aIndex) < bEndCharacter) {
                emitToken(aTokens.getEndOffset(aIndex), (aTokens.getMetadata(aIndex) & aMask) | (bMetadata & bMask));
                aIndex++;
            }
            if (aIndex < aLen) {
                emitToken(bEndCharacter, (aTokens.getMetadata(aIndex) & aMask) | (bMetadata & bMask));
                if (aTokens.getEndOffset(aIndex) === bEndCharacter) {
                    // `a` ends exactly at the same spot as `b`!
                    aIndex++;
                }
            }
            else {
                const aMergeIndex = Math.min(Math.max(0, aIndex - 1), aLen - 1);
                // push the token from `b`
                emitToken(bEndCharacter, (aTokens.getMetadata(aMergeIndex) & aMask) | (bMetadata & bMask));
            }
        }
        // push the remaining tokens from `a`
        while (aIndex < aLen) {
            emitToken(aTokens.getEndOffset(aIndex), aTokens.getMetadata(aIndex));
            aIndex++;
        }
        return new LineTokens(new Uint32Array(result), aTokens.getLineContent(), this._languageIdCodec);
    }
    static _findFirstPieceWithLine(pieces, lineNumber) {
        let low = 0;
        let high = pieces.length - 1;
        while (low < high) {
            let mid = low + Math.floor((high - low) / 2);
            if (pieces[mid].endLineNumber < lineNumber) {
                low = mid + 1;
            }
            else if (pieces[mid].startLineNumber > lineNumber) {
                high = mid - 1;
            }
            else {
                while (mid > low && pieces[mid - 1].startLineNumber <= lineNumber && lineNumber <= pieces[mid - 1].endLineNumber) {
                    mid--;
                }
                return mid;
            }
        }
        return low;
    }
    acceptEdit(range, eolCount, firstLineLength, lastLineLength, firstCharCode) {
        for (let i = 0; i < this._pieces.length; i++) {
            const piece = this._pieces[i];
            piece.acceptEdit(range, eolCount, firstLineLength, lastLineLength, firstCharCode);
            if (piece.isEmpty()) {
                // Remove empty pieces
                this._pieces.splice(i, 1);
                i--;
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BhcnNlVG9rZW5zU3RvcmUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi90b2tlbnMvc3BhcnNlVG9rZW5zU3RvcmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLE1BQU0sTUFBTSxnQ0FBZ0MsQ0FBQztBQUV6RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFNN0M7O0dBRUc7QUFDSCxNQUFNLE9BQU8saUJBQWlCO0lBTTdCLFlBQVksZUFBaUM7UUFDNUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFDbEIsSUFBSSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7UUFDekIsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGVBQWUsQ0FBQztJQUN6QyxDQUFDO0lBRU0sS0FBSztRQUNYLElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQ2xCLElBQUksQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDO0lBQzFCLENBQUM7SUFFTSxPQUFPO1FBQ2IsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFTSxHQUFHLENBQUMsTUFBc0MsRUFBRSxVQUFtQixFQUFFLFlBQW9DLFNBQVM7UUFDcEgsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLElBQUksRUFBRSxDQUFDO1FBQzVCLElBQUksQ0FBQyxXQUFXLEdBQUcsVUFBVSxDQUFDO1FBRTlCLElBQUksU0FBUyxFQUFFLENBQUM7WUFDZixLQUFLLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDOUIsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUM5QixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFTSxVQUFV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