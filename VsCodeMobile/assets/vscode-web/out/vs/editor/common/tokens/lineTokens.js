/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { TokenMetadata } from '../encodedTokenAttributes.js';
import { OffsetRange } from '../core/ranges/offsetRange.js';
import { onUnexpectedError } from '../../../base/common/errors.js';
export class LineTokens {
    static createEmpty(lineContent, decoder) {
        const defaultMetadata = LineTokens.defaultTokenMetadata;
        const tokens = new Uint32Array(2);
        tokens[0] = lineContent.length;
        tokens[1] = defaultMetadata;
        return new LineTokens(tokens, lineContent, decoder);
    }
    static createFromTextAndMetadata(data, decoder) {
        let offset = 0;
        let fullText = '';
        const tokens = new Array();
        for (const { text, metadata } of data) {
            tokens.push(offset + text.length, metadata);
            offset += text.length;
            fullText += text;
        }
        return new LineTokens(new Uint32Array(tokens), fullText, decoder);
    }
    static convertToEndOffset(tokens, lineTextLength) {
        const tokenCount = (tokens.length >>> 1);
        const lastTokenIndex = tokenCount - 1;
        for (let tokenIndex = 0; tokenIndex < lastTokenIndex; tokenIndex++) {
            tokens[tokenIndex << 1] = tokens[(tokenIndex + 1) << 1];
        }
        tokens[lastTokenIndex << 1] = lineTextLength;
    }
    static findIndexInTokensArray(tokens, desiredIndex) {
        if (tokens.length <= 2) {
            return 0;
        }
        let low = 0;
        let high = (tokens.length >>> 1) - 1;
        while (low < high) {
            const mid = low + Math.floor((high - low) / 2);
            const endOffset = tokens[(mid << 1)];
            if (endOffset === desiredIndex) {
                return mid + 1;
            }
            else if (endOffset < desiredIndex) {
                low = mid + 1;
            }
            else if (endOffset > desiredIndex) {
                high = mid;
            }
        }
        return low;
    }
    static { this.defaultTokenMetadata = ((0 /* FontStyle.None */ << 11 /* MetadataConsts.FONT_STYLE_OFFSET */)
        | (1 /* ColorId.DefaultForeground */ << 15 /* MetadataConsts.FOREGROUND_OFFSET */)
        | (2 /* ColorId.DefaultBackground */ << 24 /* MetadataConsts.BACKGROUND_OFFSET */)) >>> 0; }
    constructor(tokens, text, decoder) {
        this._lineTokensBrand = undefined;
        const tokensLength = tokens.length > 1 ? tokens[tokens.length - 2] : 0;
        if (tokensLength !== text.length) {
            onUnexpectedError(new Error('Token length and text length do not match!'));
        }
        this._tokens = tokens;
        this._tokensCount = (this._tokens.length >>> 1);
        this._text = text;
        this.languageIdCodec = decoder;
    }
    getTextLength() {
        return this._text.length;
    }
    equals(other) {
        if (other instanceof LineTokens) {
            return this.slicedEquals(other, 0, this._tokensCount);
        }
        return false;
    }
    slicedEquals(other, sliceFromTokenIndex, sliceTokenCount) {
        if (this._text !== other._text) {
            return false;
        }
        if (this._tokensCount !== other._tokensCount) {
            return false;
        }
        const from = (sliceFromTokenIndex << 1);
        const to = from + (sliceTokenCount << 1);
        for (let i = from; i < to; i++) {
            if (this._tokens[i] !== other._tokens[i]) {
                return false;
            }
        }
        return true;
    }
    getLineContent() {
        return this._text;
    }
    getCount() {
        return this._tokensCount;
    }
    getStartOffset(tokenIndex) {
        if (tokenIndex > 0) {
            return this._tokens[(tokenIndex - 1) << 1];
        }
        return 0;
    }
    getMetadata(tokenIndex) {
        const metadata = this._tokens[(tokenIndex << 1) + 1];
        return metadata;
    }
    getLanguageId(tokenIndex) {
        const metadata = this._tokens[(tokenIndex << 1) + 1];
        const languageId = TokenMetadata.getLanguageId(metadata);
        return this.languageIdCodec.decodeLanguageId(languageId);
    }
    getStandardTokenType(tokenIndex) {
        const metadata = this._tokens[(tokenIndex << 1) + 1];
        return TokenMetadata.getTokenType(metadata);
    }
    getForeground(tokenIndex) {
        const metadata = this._tokens[(tokenIndex << 1) + 1];
        return TokenMetadata.getForeground(metadata);
    }
    getClassName(tokenIndex) {
        const metadata = this._tokens[(tokenIndex << 1) + 1];
        return TokenMetadata.getClassNameFromMetadata(metadata);
    }
    getInlineStyle(tokenIndex, colorMap) {
        const metadata = this._tokens[(tokenIndex << 1) + 1];
        return TokenMetadata.getInlineStyleFromMetadata(metadata, colorMap);
    }
    getPresentation(tokenIndex) {
        const metadata = this._tokens[(tokenIndex << 1) + 1];
        return TokenMetadata.getPresentationFromMetadata(metadata);
    }
    getEndOffset(tokenIndex) {
        return this._tokens[tokenIndex << 1];
    }
    /**
     * Find the token containing offset `offset`.
     * @param offset The search offset
     * @return The index of the token containing the offset.
     */
    findTokenIndexAtOffset(offset) {
        return LineTokens.findIndexInTokensArray(this._tokens, offset);
    }
    inflate() {
        return this;
    }
    sliceAndInflate(startOffset, endOffset, deltaOffset) {
        return new SliceLineTokens(this, startOffset, endOffset, deltaOffset);
    }
    sliceZeroCopy(range) {
        return this.sliceAndInflate(range.start, range.endExclusive, 0);
    }
    /**
     * @pure
     * @param insertTokens Must be sorted by offset.
    */
    withInserted(insertTokens) {
        if (insertTokens.length === 0) {
            return this;
        }
        let nextOriginalTokenIdx = 0;
        let nextInsertTokenIdx = 0;
        let text = '';
        const newTokens = new Array();
        let originalEndOffset = 0;
        while (true) {
            const nextOriginalTokenEndOffset = nextOriginalTokenIdx < this._tokensCount ? this._tokens[nextOriginalTokenIdx << 1] : -1;
            const nextInsertToken = nextInsertTokenIdx < insertTokens.length ? insertTokens[nextInsertTokenIdx] : null;
            if (nextOriginalTokenEndOffset !== -1 && (nextInsertToken === null || nextOriginalTokenEndOffset <= nextInsertToken.offset)) {
                // original token ends before next insert token
                text += this._text.substring(originalEndOffset, nextOriginalTokenEndOffset);
                const metadata = this._tokens[(nextOriginalTokenIdx << 1) + 1];
                newTokens.push(text.length, metadata);
                nextOriginalTokenIdx++;
                originalEndOffset = nextOriginalTokenEndOffset;
            }
            else if (nextInsertToken) {
                if (nextInsertToken.offset > originalEndOffset) {
                    // insert token is in the middle of the next token.
                    text += this._text.substring(originalEndOffset, nextInsertToken.offset);
                    const metadata = this._tokens[(nextOriginalTokenIdx << 1) + 1];
                    newTokens.push(text.length, metadata);
                    originalEndOffset = nextInsertToken.offset;
                }
                text += nextInsertToken.text;
                newTokens.push(text.length, nextInsertToken.tokenMetadata);
                nextInsertTokenIdx++;
            }
            else {
                break;
            }
        }
        return new LineTokens(new Uint32Array(newTokens), text, this.languageIdCodec);
    }
    getTokensInRange(range) {
        const builder = new TokenArrayBuilder();
        const startTokenIndex = this.findTokenIndexAtOffset(range.start);
        const endTokenIndex = this.findTokenIndexAtOffset(range.endExclusive);
        for (let tokenIndex = startTokenIndex; tokenIndex <= endTokenIndex; tokenIndex++) {
            const tokenRange = new OffsetRange(this.getStartOffset(tokenIndex), this.getEndOffset(tokenIndex));
            const length = tokenRange.intersectionLength(range);
            if (length > 0) {
                builder.add(length, this.getMetadata(tokenIndex));
            }
        }
        return builder.build();
    }
    getTokenText(tokenIndex) {
        const startOffset = this.getStartOffset(tokenIndex);
        const endOffset = this.getEndOffset(tokenIndex);
        const text = this._text.substring(startOffset, endOffset);
        return text;
    }
    forEach(callback) {
        const tokenCount = this.getCount();
        for (let tokenIndex = 0; tokenIndex < tokenCount; tokenIndex++) {
            callback(tokenIndex);
        }
    }
    toString() {
        let result = '';
        this.forEach((i) => {
            result += `[${this.getTokenText(i)}]{${this.getClassName(i)}}`;
        });
        return result;
    }
}
class SliceLineTokens {
    constructor(source, startOffset, endOffset, deltaOffset) {
        this._source = source;
        this._startOffset = startOffset;
        this._endOffset = endOffset;
        this._deltaOffset = deltaOffset;
        this._firstTokenIndex = source.findTokenIndexAtOffset(startOffset);
        this.languageIdCodec = source.languageIdCodec;
        this._tokensCount = 0;
        for (let i = this._firstTokenIndex, len = source.getCount(); i < len; i++) {
            const tokenStartOffset = source.getStartOffset(i);
            if (tokenStartOffset >= endOffset) {
                break;
            }
            this._tokensCount++;
        }
    }
    getMetadata(tokenIndex) {
        return this._source.getMetadata(this._firstTokenIndex + tokenIndex);
    }
    getLanguageId(tokenIndex) {
        return this._source.getLanguageId(this._firstTokenIndex + tokenIndex);
    }
    getLineContent() {
        return this._source.getLineContent().substring(this._startOffset, this._endOffset);
    }
    equals(other) {
        if (other instanceof SliceLineTokens) {
            return (this._startOffset === other._startOffset
                && this._endOffset === other._endOffset
                && this._deltaOffset === other._deltaOffset
                && this._source.slicedEquals(other._source, this._firstTokenIndex, this._tokensCount));
        }
        return false;
    }
    getCount() {
        return this._tokensCount;
    }
    getStandardTokenType(tokenIndex) {
        return this._source.getStandardTokenType(this._firstTokenIndex + tokenIndex);
    }
    getForeground(tokenIndex) {
        return this._source.getForeground(this._firstTokenIndex + tokenIndex);
    }
    getEndOffset(tokenIndex) {
        const tokenEndOffset = this._source.getEndOffset(this._firstTokenIndex + tokenIndex);
        return Math.min(this._endOffset, tokenEndOffset) - this._startOffset + this._deltaOffset;
    }
    getClassName(tokenIndex) {
        return this._source.getClassName(this._firstTokenIndex + tokenIndex);
    }
    getInlineStyle(tokenIndex, colorMap) {
        return this._source.getInlineStyle(this._firstTokenIndex + tokenIndex, colorMap);
    }
    getPresentation(tokenIndex) {
        return this._source.getPresentation(this._firstTokenIndex + tokenIndex);
    }
    findTokenIndexAtOffset(offset) {
        return this._source.findTokenIndexAtOffset(offset + this._startOffset - this._deltaOffset) - this._firstTokenIndex;
    }
    getTokenText(tokenIndex) {
        const adjustedTokenIndex = this._firstTokenIndex + tokenIndex;
        const tokenStartOffset = this._source.getStartOffset(adjustedTokenIndex);
        const tokenEndOffset = this._source.getEndOffset(adjustedTokenIndex);
        let text = this._source.getTokenText(adjustedTokenIndex);
        if (tokenStartOffset < this._startOffset) {
            text = text.substring(this._startOffset - tokenStartOffset);
        }
        if (tokenEndOffset > this._endOffset) {
            text = text.substring(0, text.length - (tokenEndOffset - this._endOffset));
        }
        return text;
    }
    forEach(callback) {
        for (let tokenIndex = 0; tokenIndex < this.getCount(); tokenIndex++) {
            callback(tokenIndex);
        }
    }
}
export function getStandardTokenTypeAtPosition(model, position) {
    const lineNumber = position.lineNumber;
    if (!model.tokenization.isCheapToTokenize(lineNumber)) {
        return undefined;
    }
    model.tokenization.forceTokenization(lineNumber);
    const lineTokens = model.tokenization.getLineTokens(lineNumber);
    const tokenIndex = lineTokens.findTokenIndexAtOffset(position.column - 1);
    const tokenType = lineTokens.getStandardTokenType(tokenIndex);
    return tokenType;
}
/**
 * This class represents a sequence of tokens.
 * Conceptually, each token has a length and a metadata number.
 * A token array might be used to annotate a string with metadata.
 * Use {@link TokenArrayBuilder} to efficiently create a token array.
 *
 * TODO: Make this class more efficient (e.g. by using a Int32Array).
*/
export class TokenArray {
    static fromLineTokens(lineTokens) {
        const tokenInfo = [];
        for (let i = 0; i < lineTokens.getCount(); i++) {
            tokenInfo.push(new TokenInfo(lineTokens.getEndOffset(i) - lineTokens.getStartOffset(i), lineTokens.getMetadata(i)));
        }
        return TokenArray.create(tokenInfo);
    }
    static create(tokenInfo) {
        return new TokenArray(tokenInfo);
    }
    constructor(_tokenInfo) {
        this._tokenInfo = _tokenInfo;
    }
    toLineTokens(lineContent, decoder) {
        return LineTokens.createFromTextAndMetadata(this.map((r, t) => ({ text: r.substring(lineContent), metadata: t.metadata })), decoder);
    }
    forEach(cb) {
        let lengthSum = 0;
        for (const tokenInfo of this._tokenInfo) {
            const range = new OffsetRange(lengthSum, lengthSum + tokenInfo.length);
            cb(range, tokenInfo);
            lengthSum += tokenInfo.length;
        }
    }
    map(cb) {
        const result = [];
        let lengthSum = 0;
        for (const tokenInfo of this._tokenInfo) {
            const range = new OffsetRange(lengthSum, lengthSum + tokenInfo.length);
            result.push(cb(range, tokenInfo));
            lengthSum += tokenInfo.length;
        }
        return result;
    }
    slice(range) {
        const result = [];
        let lengthSum = 0;
        for (const tokenInfo of this._tokenInfo) {
            const tokenStart = lengthSum;
            const tokenEndEx = tokenStart + tokenInfo.length;
            if (tokenEndEx > range.start) {
                if (tokenStart >= range.endExclusive) {
                    break;
                }
                const deltaBefore = Math.max(0, range.start - tokenStart);
                const deltaAfter = Math.max(0, tokenEndEx - range.endExclusive);
                result.push(new TokenInfo(tokenInfo.length - deltaBefore - deltaAfter, tokenInfo.metadata));
            }
            lengthSum += tokenInfo.length;
        }
        return TokenArray.create(result);
    }
    append(other) {
        const result = this._tokenInfo.concat(other._tokenInfo);
        return TokenArray.create(result);
    }
}
export class TokenInfo {
    constructor(length, metadata) {
        this.length = length;
        this.metadata = metadata;
    }
}
/**
 * TODO: Make this class more efficient (e.g. by using a Int32Array).
*/
export class TokenArrayBuilder {
    constructor() {
        this._tokens = [];
    }
    add(length, metadata) {
        this._tokens.push(new TokenInfo(length, metadata));
    }
    build() {
        return TokenArray.create(this._tokens);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluZVRva2Vucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL3Rva2Vucy9saW5lVG9rZW5zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBNkUsYUFBYSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFHeEksT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQzVELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBcUJuRSxNQUFNLE9BQU8sVUFBVTtJQUNmLE1BQU0sQ0FBQyxXQUFXLENBQUMsV0FBbUIsRUFBRSxPQUF5QjtRQUN2RSxNQUFNLGVBQWUsR0FBRyxVQUFVLENBQUMsb0JBQW9CLENBQUM7UUFFeEQsTUFBTSxNQUFNLEdBQUcsSUFBSSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUM7UUFDL0IsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLGVBQWUsQ0FBQztRQUU1QixPQUFPLElBQUksVUFBVSxDQUFDLE1BQU0sRUFBRSxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVNLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxJQUEwQyxFQUFFLE9BQXlCO1FBQzVHLElBQUksTUFBTSxHQUFXLENBQUMsQ0FBQztRQUN2QixJQUFJLFFBQVEsR0FBVyxFQUFFLENBQUM7UUFDMUIsTUFBTSxNQUFNLEdBQUcsSUFBSSxLQUFLLEVBQVUsQ0FBQztRQUNuQyxLQUFLLE1BQU0sRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksSUFBSSxFQUFFLENBQUM7WUFDdkMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMs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