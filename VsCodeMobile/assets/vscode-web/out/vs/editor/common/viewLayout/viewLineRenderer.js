/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from '../../../nls.js';
import * as strings from '../../../base/common/strings.js';
import { StringBuilder } from '../core/stringBuilder.js';
import { LineDecoration, LineDecorationsNormalizer } from './lineDecorations.js';
import { LinePart } from './linePart.js';
import { TextDirection } from '../model.js';
export var RenderWhitespace;
(function (RenderWhitespace) {
    RenderWhitespace[RenderWhitespace["None"] = 0] = "None";
    RenderWhitespace[RenderWhitespace["Boundary"] = 1] = "Boundary";
    RenderWhitespace[RenderWhitespace["Selection"] = 2] = "Selection";
    RenderWhitespace[RenderWhitespace["Trailing"] = 3] = "Trailing";
    RenderWhitespace[RenderWhitespace["All"] = 4] = "All";
})(RenderWhitespace || (RenderWhitespace = {}));
export class RenderLineInput {
    get isLTR() {
        return !this.containsRTL && this.textDirection !== TextDirection.RTL;
    }
    constructor(useMonospaceOptimizations, canUseHalfwidthRightwardsArrow, lineContent, continuesWithWrappedLine, isBasicASCII, containsRTL, fauxIndentLength, lineTokens, lineDecorations, tabSize, startVisibleColumn, spaceWidth, middotWidth, wsmiddotWidth, stopRenderingLineAfter, renderWhitespace, renderControlCharacters, fontLigatures, selectionsOnLine, textDirection, verticalScrollbarSize, renderNewLineWhenEmpty = false) {
        this.useMonospaceOptimizations = useMonospaceOptimizations;
        this.canUseHalfwidthRightwardsArrow = canUseHalfwidthRightwardsArrow;
        this.lineContent = lineContent;
        this.continuesWithWrappedLine = continuesWithWrappedLine;
        this.isBasicASCII = isBasicASCII;
        this.containsRTL = containsRTL;
        this.fauxIndentLength = fauxIndentLength;
        this.lineTokens = lineTokens;
        this.lineDecorations = lineDecorations.sort(LineDecoration.compare);
        this.tabSize = tabSize;
        this.startVisibleColumn = startVisibleColumn;
        this.spaceWidth = spaceWidth;
        this.stopRenderingLineAfter = stopRenderingLineAfter;
        this.renderWhitespace = (renderWhitespace === 'all'
            ? 4 /* RenderWhitespace.All */
            : renderWhitespace === 'boundary'
                ? 1 /* RenderWhitespace.Boundary */
                : renderWhitespace === 'selection'
                    ? 2 /* RenderWhitespace.Selection */
                    : renderWhitespace === 'trailing'
                        ? 3 /* RenderWhitespace.Trailing */
                        : 0 /* RenderWhitespace.None */);
        this.renderControlCharacters = renderControlCharacters;
        this.fontLigatures = fontLigatures;
        this.selectionsOnLine = selectionsOnLine && selectionsOnLine.sort((a, b) => a.start < b.start ? -1 : 1);
        this.renderNewLineWhenEmpty = renderNewLineWhenEmpty;
        this.textDirection = textDirection;
        this.verticalScrollbarSize = verticalScrollbarSize;
        const wsmiddotDiff = Math.abs(wsmiddotWidth - spaceWidth);
        const middotDiff = Math.abs(middotWidth - spaceWidth);
        if (wsmiddotDiff < middotDiff) {
            this.renderSpaceWidth = wsmiddotWidth;
            this.renderSpaceCharCode = 0x2E31; // U+2E31 - WORD SEPARATOR MIDDLE DOT
        }
        else {
            this.renderSpaceWidth = middotWidth;
            this.renderSpaceCharCode = 0xB7; // U+00B7 - MIDDLE DOT
        }
    }
    sameSelection(otherSelections) {
        if (this.selectionsOnLine === null) {
            return otherSelections === null;
        }
        if (otherSelections === null) {
            return false;
        }
        if (otherSelections.length !== this.selectionsOnLine.length) {
            return false;
        }
        for (let i = 0; i < this.selectionsOnLine.length; i++) {
            if (!this.selectionsOnLine[i].equals(otherSelections[i])) {
                return false;
            }
        }
        return true;
    }
    equals(other) {
        return (this.useMonospaceOptimizations === other.useMonospaceOptimizations
            && this.canUseHalfwidthRightwardsArrow === other.canUseHalfwidthRightwardsArrow
            && this.lineContent === other.lineContent
            && this.continuesWithWrappedLine === other.continuesWithWrappedLine
            && this.isBasicASCII === other.isBasicASCII
            && this.containsRTL === other.containsRTL
            && this.fauxIndentLength === other.fauxIndentLength
            && this.tabSize === other.tabSize
            && this.startVisibleColumn === other.startVisibleColumn
            && this.spaceWidth === other.spaceWidth
            && this.renderSpaceWidth === other.renderSpaceWidth
            && this.renderSpaceCharCode === other.renderSpaceCharCode
            && this.stopRenderingLineAfter === other.stopRenderingLineAfter
            && this.renderWhitespace === other.renderWhitespace
            && this.renderControlCharacters === other.renderControlCharacters
            && this.fontLigatures === other.fontLigatures
            && LineDecoration.equalsArr(this.lineDecorations, other.lineDecorations)
            && this.lineTokens.equals(other.lineTokens)
            && this.sameSelection(other.selectionsOnLine)
            && this.textDirection === other.textDirection
            && this.verticalScrollbarSize === other.verticalScrollbarSize
            && this.renderNewLineWhenEmpty === other.renderNewLineWhenEmpty);
    }
}
var CharacterMappingConstants;
(function (CharacterMappingConstants) {
    CharacterMappingConstants[CharacterMappingConstants["PART_INDEX_MASK"] = 4294901760] = "PART_INDEX_MASK";
    CharacterMappingConstants[CharacterMappingConstants["CHAR_INDEX_MASK"] = 65535] = "CHAR_INDEX_MASK";
    CharacterMappingConstants[CharacterMappingConstants["CHAR_INDEX_OFFSET"] = 0] = "CHAR_INDEX_OFFSET";
    CharacterMappingConstants[CharacterMappingConstants["PART_INDEX_OFFSET"] = 16] = "PART_INDEX_OFFSET";
})(CharacterMappingConstants || (CharacterMappingConstants = {}));
export class DomPosition {
    constructor(partIndex, charIndex) {
        this.partIndex = partIndex;
        this.charIndex = charIndex;
    }
}
/**
 * Provides a both direction mapping between a line's character and its rendered position.
 */
export class CharacterMapping {
    static getPartIndex(partData) {
        return (partData & 4294901760 /* CharacterMappingConstants.PART_INDEX_MASK */) >>> 16 /* CharacterMappingConstants.PART_INDEX_OFFSET */;
    }
    static getCharIndex(partData) {
        return (partData & 65535 /* CharacterMappingConstants.CHAR_INDEX_MASK */) >>> 0 /* CharacterMappingConstants.CHAR_INDEX_OFFSET */;
    }
    constructor(length, partCount) {
        this.length = length;
        this._data = new Uint32Array(this.length);
        this._horizontalOffset = new Uint32Array(this.length);
    }
    setColumnInfo(column, partIndex, charIndex, horizontalOffset) {
        const partData = ((partIndex << 16 /* CharacterMappingConstants.PART_INDEX_OFFSET */)
            | (charIndex << 0 /* CharacterMappingConstants.CHAR_INDEX_OFFSET */)) >>> 0;
        this._data[column - 1] = partData;
        this._horizontalOffset[column - 1] = horizontalOffset;
    }
    getHorizontalOffset(column) {
        if (this._horizontalOffset.length === 0) {
            // No characters on this line
            return 0;
        }
        return this._horizontalOffset[column - 1];
    }
    charOffsetToPartData(charOffset) {
        if (this.length === 0) {
            return 0;
        }
        if (charOffset < 0) {
            return this._data[0];
        }
        if (charOffset >= this.length) {
            return this._data[this.length - 1];
        }
        return this._data[charOffset];
    }
    getDomPosition(column) {
        const partData = this.charOffsetToPartData(column - 1);
        const partIndex = CharacterMapping.getPartIndex(partData);
        const charIndex = CharacterMapping.getCharIndex(partData);
        return new DomPosition(partIndex, charIndex);
    }
    getColumn(domPosition, partLength) {
        const charOffset = this.partDataToCharOffset(domPosition.partIndex, partLength, domPosition.charIndex);
        return charOffset + 1;
    }
    partDataToCharOffset(partIndex, partLength, charIndex) {
        if (this.length === 0) {
            return 0;
        }
        const searchEntry = ((partIndex << 16 /* CharacterMappingConstants.PART_INDEX_OFFSET */)
            | (charIndex << 0 /* CharacterMappingConstants.CHAR_INDEX_OFFSET */)) >>> 0;
        let min = 0;
        let max = this.length - 1;
        while (min + 1 < max) {
            const mid = ((min + max) >>> 1);
            const midEntry = this._data[mid];
            if (midEntry === searchEntry) {
                return mid;
            }
            else if (midEntry > searchEntry) {
                max = mid;
            }
            else {
                min = mid;
            }
        }
        if (min === max) {
            return min;
        }
        const minEntry = this._data[min];
        const maxEntry = this._data[max];
        if (minEntry === searchEntry) {
            return min;
        }
        if (maxEntry === searchEntry) {
            return max;
        }
        const minPartIndex = CharacterMapping.getPartIndex(minEntry);
        const minCharIndex = CharacterMapping.getCharIndex(minEntry);
        const maxPartIndex = CharacterMapping.getPartIndex(maxEntry);
        let maxCharIndex;
        if (minPartIndex !== maxPartIndex) {
            // sitting between parts
            maxCharIndex = partLength;
        }
        else {
            maxCharIndex = CharacterMapping.getCharIndex(maxEntry);
        }
        const minEntryDistance = charIndex - minCharIndex;
        const maxEntryDistance = maxCharIndex - charIndex;
        if (minEntryDistance <= maxEntryDistance) {
            return min;
        }
        return max;
    }
    inflate() {
        const result = [];
        for (let i = 0; i < this.length; i++) {
            const partData = this._data[i];
            const partIndex = CharacterMapping.getPartIndex(partData);
            const charIndex = CharacterMapping.getCharIndex(partData);
            const visibleColumn = this._horizontalOffset[i];
            result.push([partIndex, charIndex, visibleColumn]);
        }
        return result;
    }
}
export var ForeignElementType;
(function (ForeignElementType) {
    ForeignElementType[ForeignElementType["None"] = 0] = "None";
    ForeignElementType[ForeignElementType["Before"] = 1] = "Before";
    ForeignElementType[ForeignElementType["After"] = 2] = "After";
})(ForeignElementType || (ForeignElementType = {}));
export class RenderLineOutput {
    constructor(characterMapping, containsForeignElements) {
        this._renderLineOutputBrand = undefined;
        this.characterMapping = characterMapping;
        this.containsForeignElements = containsForeignElements;
    }
}
export function renderViewLine(input, sb) {
    if (input.lineContent.length === 0) {
        if (input.lineDecorations.length > 0) {
            // This line is empty, but it contains inline decorations
            sb.appendString(`<span>`);
            let beforeCount = 0;
            let afterCount = 0;
            let containsForeignElements = 0 /* ForeignElementType.None */;
            for (const lineDecoration of input.lineDecorations) {
                if (lineDecoration.type === 1 /* InlineDecorationType.Before */ || lineDecoration.type === 2 /* InlineDecorationType.After */) {
                    sb.appendString(`<span class="`);
                    sb.appendString(lineDecoration.className);
                    sb.appendString(`"></span>`);
                    if (lineDecoration.type === 1 /* InlineDecorationType.Before */) {
                        containsForeignElements |= 1 /* ForeignElementType.Before */;
                        beforeCount++;
                    }
                    if (lineDecoration.type === 2 /* InlineDecorationType.After */) {
                        containsForeignElements |= 2 /* ForeignElementType.After */;
                        afterCount++;
                    }
                }
            }
            sb.appendString(`</span>`);
            const characterMapping = new CharacterMapping(1, beforeCount + afterCount);
            characterMapping.setColumnInfo(1, beforeCount, 0, 0);
            return new RenderLineOutput(characterMapping, containsForeignElements);
        }
        // completely empty line
        if (input.renderNewLineWhenEmpty) {
            sb.appendString('<span><span>\n</span></span>');
        }
        else {
            sb.appendString('<span><span></span></span>');
        }
        return new RenderLineOutput(new CharacterMapping(0, 0), 0 /* ForeignElementType.None */);
    }
    return _renderLine(resolveRenderLineInput(input), sb);
}
export class RenderLineOutput2 {
    constructor(characterMapping, html, containsForeignElements) {
        this.characterMapping = characterMapping;
        this.html = html;
        this.containsForeignElements = containsForeignElements;
    }
}
export function renderViewLine2(input) {
    const sb = new StringBuilder(10000);
    const out = renderViewLine(input, sb);
    return new RenderLineOutput2(out.characterMapping, sb.build(), out.containsForeignElements);
}
class ResolvedRenderLineInput {
    constructor(fontIsMonospace, canUseHalfwidthRightwardsArrow, lineContent, len, isOverflowing, overflowingCharCount, parts, containsForeignElements, fauxIndentLength, tabSize, startVisibleColumn, spaceWidth, renderSpaceCharCode, renderWhitespace, renderControlCharacters) {
        this.fontIsMonospace = fontIsMonospace;
        this.canUseHalfwidthRightwardsArrow = canUseHalfwidthRightwardsArrow;
        this.lineContent = lineContent;
        this.len = len;
        this.isOverflowing = isOverflowing;
        this.overflowingCharCount = overflowingCharCount;
        this.parts = parts;
        this.containsForeignElements = containsForeignElements;
        this.fauxIndentLength = fauxIndentLength;
        this.tabSize = tabSize;
        this.startVisibleColumn = startVisibleColumn;
        this.spaceWidth = spaceWidth;
        this.renderSpaceCharCode = renderSpaceCharCode;
        this.renderWhitespace = renderWhitespace;
        this.renderControlCharacters = renderControlCharacters;
        //
    }
}
function resolveRenderLineInput(input) {
    const lineContent = input.lineContent;
    let isOverflowing;
    let overflowingCharCount;
    let len;
    if (input.stopRenderingLineAfter !== -1 && input.stopRenderingLineAfter < lineContent.length) {
        isOverflowing = true;
        overflowingCharCount = lineContent.length - input.stopRenderingLineAfter;
        len = input.stopRenderingLineAfter;
    }
    else {
        isOverflowing = false;
        overflowingCharCount = 0;
        len = lineContent.length;
    }
    let tokens = transformAndRemoveOverflowing(lineContent, input.containsRTL, input.lineTokens, input.fauxIndentLength, len);
    if (input.renderControlCharacters && !input.isBasicASCII) {
        // Calling `extractControlCharacters` before adding (possibly empty) line parts
        // for inline decorations. `extractControlCharacters` removes empty line parts.
        tokens = extractControlCharacters(lineContent, tokens);
    }
    if (input.renderWhitespace === 4 /* RenderWhitespace.All */ ||
        input.renderWhitespace === 1 /* RenderWhitespace.Boundary */ ||
        (input.renderWhitespace === 2 /* RenderWhitespace.Selection */ && !!input.selectionsOnLine) ||
        (input.renderWhitespace === 3 /* RenderWhitespace.Trailing */ && !input.continuesWithWrappedLine)) {
        tokens = _applyRenderWhitespace(input, lineContent, len, tokens);
    }
    let containsForeignElements = 0 /* ForeignElementType.None */;
    if (input.lineDecorations.length > 0) {
        for (let i = 0, len = input.lineDecorations.length; i < len; i++) {
            const lineDecoration = input.lineDecorations[i];
            if (lineDecoration.type === 3 /* InlineDecorationType.RegularAffectingLetterSpacing */) {
                // Pretend there are foreign elements... although not 100% accurate.
                containsForeignElements |= 1 /* ForeignElementType.Before */;
            }
            else if (lineDecoration.type === 1 /* InlineDecorationType.Before */) {
                containsForeignElements |= 1 /* ForeignElementType.Before */;
            }
            else if (lineDecoration.type === 2 /* InlineDecorationType.After */) {
                containsForeignElements |= 2 /* ForeignElementType.After */;
            }
        }
        tokens = _applyInlineDecorations(lineContent, len, tokens, input.lineDecorations);
    }
    if (!input.containsRTL) {
        // We can never split RTL text, as it ruins the rendering
        tokens = splitLargeTokens(lineContent, tokens, !input.isBasicASCII || input.fontLigatures);
    }
    else {
        // Split the first token if it contains both leading whitespace and RTL text
        tokens = splitLeadingWhitespaceFromRTL(lineContent, tokens);
    }
    return new ResolvedRenderLineInput(input.useMonospaceOptimizations, input.canUseHalfwidthRightwardsArrow, lineContent, len, isOverflowing, overflowingCharCount, tokens, containsForeignElements, input.fauxIndentLength, input.tabSize, input.startVisibleColumn, input.spaceWidth, input.renderSpaceCharCode, input.renderWhitespace, input.renderControlCharacters);
}
/**
 * In the rendering phase, characters are always looped until token.endIndex.
 * Ensure that all tokens end before `len` and the last one ends precisely at `len`.
 */
function transformAndRemoveOverflowing(lineContent, lineContainsRTL, tokens, fauxIndentLength, len) {
    const result = [];
    let resultLen = 0;
    // The faux indent part of the line should have no token type
    if (fauxIndentLength > 0) {
        result[resultLen++] = new LinePart(fauxIndentLength, '', 0, false);
    }
    let startOffset = fauxIndentLength;
    for (let tokenIndex = 0, tokensLen = tokens.getCount(); tokenIndex < tokensLen; tokenIndex++) {
        const endIndex = tokens.getEndOffset(tokenIndex);
        if (endIndex <= fauxIndentLength) {
            // The faux indent part of the line should have no token type
            continue;
        }
        const type = tokens.getClassName(tokenIndex);
        if (endIndex >= len) {
            const tokenContainsRTL = (lineContainsRTL ? strings.containsRTL(lineContent.substring(startOffset, len)) : false);
            result[resultLen++] = new LinePart(len, type, 0, tokenContainsRTL);
            break;
        }
        const tokenContainsRTL = (lineContainsRTL ? strings.containsRTL(lineContent.substring(startOffset, endIndex)) : false);
        result[resultLen++] = new LinePart(endIndex, type, 0, tokenContainsRTL);
        startOffset = endIndex;
    }
    return result;
}
/**
 * written as a const enum to get value inlining.
 */
var Constants;
(function (Constants) {
    Constants[Constants["LongToken"] = 50] = "LongToken";
})(Constants || (Constants = {}));
/**
 * See https://github.com/microsoft/vscode/issues/6885.
 * It appears that having very large spans causes very slow reading of character positions.
 * So here we try to avoid that.
 */
function splitLargeTokens(lineContent, tokens, onlyAtSpaces) {
    let lastTokenEndIndex = 0;
    const result = [];
    let resultLen = 0;
    if (onlyAtSpaces) {
        // Split only at spaces => we need to walk each character
        for (let i = 0, len = tokens.length; i < len; i++) {
            const token = tokens[i];
            const tokenEndIndex = token.endIndex;
            if (lastTokenEndIndex + 50 /* Constants.LongToken */ < tokenEndIndex) {
                const tokenType = token.type;
                const tokenMetadata = token.metadata;
                const tokenContainsRTL = token.containsRTL;
                let lastSpaceOffset = -1;
                let currTokenStart = lastTokenEndIndex;
                for (let j = lastTokenEndIndex; j < tokenEndIndex; j++) {
                    if (lineContent.charCodeAt(j) === 32 /* CharCode.Space */) {
                        lastSpaceOffset = j;
                    }
                    if (lastSpaceOffset !== -1 && j - currTokenStart >= 50 /* Constants.LongToken */) {
                        // Split at `lastSpaceOffset` + 1
                        result[resultLen++] = new LinePart(lastSpaceOffset + 1, tokenType, tokenMetadata, tokenContainsRTL);
                        currTokenStart = lastSpaceOffset + 1;
                        lastSpaceOffset = -1;
                    }
                }
                if (currTokenStart !== tokenEndIndex) {
                    result[resultLen++] = new LinePart(tokenEndIndex, tokenType, tokenMetadata, tokenContainsRTL);
                }
            }
            else {
                result[resultLen++] = token;
            }
            lastTokenEndIndex = tokenEndIndex;
        }
    }
    else {
        // Split anywhere => we don't need to walk each character
        for (let i = 0, len = tokens.length; i < len; i++) {
            const token = tokens[i];
            const tokenEndIndex = token.endIndex;
            const diff = (tokenEndIndex - lastTokenEndIndex);
            if (diff > 50 /* Constants.LongToken */) {
                const tokenType = token.type;
                const tokenMetadata = token.metadata;
                const tokenContainsRTL = token.containsRTL;
                const piecesCount = Math.ceil(diff / 50 /* Constants.LongToken */);
                for (let j = 1; j < piecesCount; j++) {
                    const pieceEndIndex = lastTokenEndIndex + (j * 50 /* Constants.LongToken */);
                    result[resultLen++] = new LinePart(pieceEndIndex, tokenType, tokenMetadata, tokenContainsRTL);
                }
                result[resultLen++] = new LinePart(tokenEndIndex, tokenType, tokenMetadata, tokenContainsRTL);
            }
            else {
                result[resultLen++] = token;
            }
            lastTokenEndIndex = tokenEndIndex;
        }
    }
    return result;
}
/**
 * Splits leading whitespace from the first token if it contains RTL text.
 */
function splitLeadingWhitespaceFromRTL(lineContent, tokens) {
    if (tokens.length === 0) {
        return tokens;
    }
    const firstToken = tokens[0];
    if (!firstToken.containsRTL) {
        return tokens;
    }
    // Check if the first token starts with whitespace
    const firstTokenEndIndex = firstToken.endIndex;
    let firstNonWhitespaceIndex = 0;
    for (let i = 0; i < firstTokenEndIndex; i++) {
        const charCode = lineContent.charCodeAt(i);
        if (charCode !== 32 /* CharCode.Space */ && charCode !== 9 /* CharCode.Tab */) {
            firstNonWhitespaceIndex = i;
            break;
        }
    }
    if (firstNonWhitespaceIndex === 0) {
        // No leading whitespace
        return tokens;
    }
    // Split the first token into leading whitespace and the rest
    const result = [];
    result.push(new LinePart(firstNonWhitespaceIndex, firstToken.type, firstToken.metadata, false));
    result.push(new LinePart(firstTokenEndIndex, firstToken.type, firstToken.metadata, firstToken.containsRTL));
    // Add remaining tokens
    for (let i = 1; i < tokens.length; i++) {
        result.push(tokens[i]);
    }
    return result;
}
function isControlCharacter(charCode) {
    if (charCode < 32) {
        return (charCode !== 9 /* CharCode.Tab */);
    }
    if (charCode === 127) {
        // DEL
        return true;
    }
    if ((charCode >= 0x202A && charCode <= 0x202E)
        || (charCode >= 0x2066 && charCode <= 0x2069)
        || (charCode >= 0x200E && charCode <= 0x200F)
        || charCode === 0x061C) {
        // Unicode Directional Formatting Characters
        // LRE	U+202A	LEFT-TO-RIGHT EMBEDDING
        // RLE	U+202B	RIGHT-TO-LEFT EMBEDDING
        // PDF	U+202C	POP DIRECTIONAL FORMATTING
        // LRO	U+202D	LEFT-TO-RIGHT OVERRIDE
        // RLO	U+202E	RIGHT-TO-LEFT OVERRIDE
        // LRI	U+2066	LEFT-TO-RIGHT ISOLATE
        // RLI	U+2067	RIGHT-TO-LEFT ISOLATE
        // FSI	U+2068	FIRST STRONG ISOLATE
        // PDI	U+2069	POP DIRECTIONAL ISOLATE
        // LRM	U+200E	LEFT-TO-RIGHT MARK
        // RLM	U+200F	RIGHT-TO-LEFT MARK
        // ALM	U+061C	ARABIC LETTER MARK
        return true;
    }
    return false;
}
function extractControlCharacters(lineContent, tokens) {
    const result = [];
    let lastLinePart = new LinePart(0, '', 0, false);
    let charOffset = 0;
    for (const token of tokens) {
        const tokenEndIndex = token.endIndex;
        for (; charOffset < tokenEndIndex; charOffset++) {
            const charCode = lineContent.charCodeAt(charOffset);
            if (isControlCharacter(charCode)) {
                if (charOffset > lastLinePart.endIndex) {
                    // emit previous part if it has text
                    lastLinePart = new LinePart(charOffset, token.type, token.metadata, token.containsRTL);
                    result.push(lastLinePart);
                }
                lastLinePart = new LinePart(charOffset + 1, 'mtkcontrol', token.metadata, false);
                result.push(lastLinePart);
            }
        }
        if (charOffset > lastLinePart.endIndex) {
            // emit previous part if it has text
            lastLinePart = new LinePart(tokenEndIndex, token.type, token.metadata, token.containsRTL);
            result.push(lastLinePart);
        }
    }
    return result;
}
/**
 * Whitespace is rendered by "replacing" tokens with a special-purpose `mtkw` type that is later recognized in the rendering phase.
 * Moreover, a token is created for every visual indent because on some fonts the glyphs used for rendering whitespace (&rarr; or &middot;) do not have the same width as &nbsp;.
 * The rendering phase will generate `style="width:..."` for these tokens.
 */
function _applyRenderWhitespace(input, lineContent, len, tokens) {
    const continuesWithWrappedLine = input.continuesWithWrappedLine;
    const fauxIndentLength = input.fauxIndentLength;
    const tabSize = input.tabSize;
    const startVisibleColumn = input.startVisibleColumn;
    const useMonospaceOptimizations = input.useMonospaceOptimizations;
    const selections = input.selectionsOnLine;
    const onlyBoundary = (input.renderWhitespace === 1 /* RenderWhitespace.Boundary */);
    const onlyTrailing = (input.renderWhitespace === 3 /* RenderWhitespace.Trailing */);
    const generateLinePartForEachWhitespace = (input.renderSpaceWidth !== input.spaceWidth);
    const result = [];
    let resultLen = 0;
    let tokenIndex = 0;
    let tokenType = tokens[tokenIndex].type;
    let tokenContainsRTL = tokens[tokenIndex].containsRTL;
    let tokenEndIndex = tokens[tokenIndex].endIndex;
    const tokensLength = tokens.length;
    let lineIsEmptyOrWhitespace = false;
    let firstNonWhitespaceIndex = strings.firstNonWhitespaceIndex(lineContent);
    let lastNonWhitespaceIndex;
    if (firstNonWhitespaceIndex === -1) {
        lineIsEmptyOrWhitespace = true;
        firstNonWhitespaceIndex = len;
        lastNonWhitespaceIndex = len;
    }
    else {
        lastNonWhitespaceIndex = strings.lastNonWhitespaceIndex(lineContent);
    }
    let wasInWhitespace = false;
    let currentSelectionIndex = 0;
    let currentSelection = selections && selections[currentSelectionIndex];
    let tmpIndent = startVisibleColumn % tabSize;
    for (let charIndex = fauxIndentLength; charIndex < len; charIndex++) {
        const chCode = lineContent.charCodeAt(charIndex);
        if (currentSelection && currentSelection.endExclusive <= charIndex) {
            currentSelectionIndex++;
            currentSelection = selections && selections[currentSelectionIndex];
        }
        let isInWhitespace;
        if (charIndex < firstNonWhitespaceIndex || charIndex > lastNonWhitespaceIndex) {
            // in leading or trailing whitespace
            isInWhitespace = true;
        }
        else if (chCode === 9 /* CharCode.Tab */) {
            // a tab character is rendered both in all and boundary cases
            isInWhitespace = true;
        }
        else if (chCode === 32 /* CharCode.Space */) {
            // hit a space character
            if (onlyBoundary) {
                // rendering only boundary whitespace
                if (wasInWhitespace) {
                    isInWhitespace = true;
                }
                else {
                    const nextChCode = (charIndex + 1 < len ? lineContent.charCodeAt(charIndex + 1) : 0 /* CharCode.Null */);
                    isInWhitespace = (nextChCode === 32 /* CharCode.Space */ || nextChCode === 9 /* CharCode.Tab */);
                }
            }
            else {
                isInWhitespace = true;
            }
        }
        else {
            isInWhitespace = false;
        }
        // If rendering whitespace on selection, check that the charIndex falls within a selection
        if (isInWhitespace && selections) {
            isInWhitespace = !!currentSelection && currentSelection.start <= charIndex && charIndex < currentSelection.endExclusive;
        }
        // If rendering only trailing whitespace, check that the charIndex points to trailing whitespace.
        if (isInWhitespace && onlyTrailing) {
            isInWhitespace = lineIsEmptyOrWhitespace || charIndex > lastNonWhitespaceIndex;
        }
        if (isInWhitespace && tokenContainsRTL) {
            // If the token contains RTL text, breaking it up into multiple line parts
            // to render whitespace might affect the browser's bidi layout.
            //
            // We render whitespace in such tokens only if the whitespace
            // is the leading or the trailing whitespace of the line,
            // which doesn't affect the browser's bidi layout.
            if (charIndex >= firstNonWhitespaceIndex && charIndex <= lastNonWhitespaceIndex) {
                isInWhitespace = false;
            }
        }
        if (wasInWhitespace) {
            // was in whitespace token
            if (!isInWhitespace || (!useMonospaceOptimizations && tmpIndent >= tabSize)) {
                // leaving whitespace token or entering a new indent
                if (generateLinePartForEachWhitespace) {
                    const lastEndIndex = (resultLen > 0 ? result[resultLen - 1].endIndex : fauxIndentLength);
                    for (let i = lastEndIndex + 1; i <= charIndex; i++) {
                        result[resultLen++] = new LinePart(i, 'mtkw', 1 /* LinePartMetadata.IS_WHITESPACE */, false);
                    }
                }
                else {
                    result[resultLen++] = new LinePart(charIndex, 'mtkw', 1 /* LinePartMetadata.IS_WHITESPACE */, false);
                }
                tmpIndent = tmpIndent % tabSize;
            }
        }
        else {
            // was in regular token
            if (charIndex === tokenEndIndex || (isInWhitespace && charIndex > fauxIndentLength)) {
                result[resultLen++] = new LinePart(charIndex, tokenType, 0, tokenContainsRTL);
                tmpIndent = tmpIndent % tabSize;
            }
        }
        if (chCode === 9 /* CharCode.Tab */) {
            tmpIndent = tabSize;
        }
        else if (strings.isFullWidthCharacter(chCode)) {
            tmpIndent += 2;
        }
        else {
            tmpIndent++;
        }
        wasInWhitespace = isInWhitespace;
        while (charIndex === tokenEndIndex) {
            tokenIndex++;
            if (tokenIndex < tokensLength) {
                tokenType = tokens[tokenIndex].type;
                tokenContainsRTL = tokens[tokenIndex].containsRTL;
                tokenEndIndex = tokens[tokenIndex].endIndex;
            }
            else {
                break;
            }
        }
    }
    let generateWhitespace = false;
    if (wasInWhitespace) {
        // was in whitespace token
        if (continuesWithWrappedLine && onlyBoundary) {
            const lastCharCode = (len > 0 ? lineContent.charCodeAt(len - 1) : 0 /* CharCode.Null */);
            const prevCharCode = (len > 1 ? lineContent.charCodeAt(len - 2) : 0 /* CharCode.Null */);
            const isSingleTrailingSpace = (lastCharCode === 32 /* CharCode.Space */ && (prevCharCode !== 32 /* CharCode.Space */ && prevCharCode !== 9 /* CharCode.Tab */));
            if (!isSingleTrailingSpace) {
                generateWhitespace = true;
            }
        }
        else {
            generateWhitespace = true;
        }
    }
    if (generateWhitespace) {
        if (generateLinePartForEachWhitespace) {
            const lastEndIndex = (resultLen > 0 ? result[resultLen - 1].endIndex : fauxIndentLength);
            for (let i = lastEndIndex + 1; i <= len; i++) {
                result[resultLen++] = new LinePart(i, 'mtkw', 1 /* LinePartMetadata.IS_WHITESPACE */, false);
            }
        }
        else {
            result[resultLen++] = new LinePart(len, 'mtkw', 1 /* LinePartMetadata.IS_WHITESPACE */, false);
        }
    }
    else {
        result[resultLen++] = new LinePart(len, tokenType, 0, tokenContainsRTL);
    }
    return result;
}
/**
 * Inline decorations are "merged" on top of tokens.
 * Special care must be taken when multiple inline decorations are at play and they overlap.
 */
function _applyInlineDecorations(lineContent, len, tokens, _lineDecorations) {
    _lineDecorations.sort(LineDecoration.compare);
    const lineDecorations = LineDecorationsNormalizer.normalize(lineContent, _lineDecorations);
    const lineDecorationsLen = lineDecorations.length;
    let lineDecorationIndex = 0;
    const result = [];
    let resultLen = 0;
    let lastResultEndIndex = 0;
    for (let tokenIndex = 0, len = tokens.length; tokenIndex < len; tokenIndex++) {
        const token = tokens[tokenIndex];
        const tokenEndIndex = token.endIndex;
        const tokenType = token.type;
        const tokenMetadata = token.metadata;
        const tokenContainsRTL = token.containsRTL;
        while (lineDecorationIndex < lineDecorationsLen && lineDecorations[lineDecorationIndex].startOffset < tokenEndIndex) {
            const lineDecoration = lineDecorations[lineDecorationIndex];
            if (lineDecoration.startOffset > lastResultEndIndex) {
                lastResultEndIndex = lineDecoration.startOffset;
                result[resultLen++] = new LinePart(lastResultEndIndex, tokenType, tokenMetadata, tokenContainsRTL);
            }
            if (lineDecoration.endOffset + 1 <= tokenEndIndex) {
                // This line decoration ends before this token ends
                lastResultEndIndex = lineDecoration.endOffset + 1;
                result[resultLen++] = new LinePart(lastResultEndIndex, tokenType + ' ' + lineDecoration.className, tokenMetadata | lineDecoration.metadata, tokenContainsRTL);
                lineDecorationIndex++;
            }
            else {
                // This line decoration continues on to the next token
                lastResultEndIndex = tokenEndIndex;
                result[resultLen++] = new LinePart(lastResultEndIndex, tokenType + ' ' + lineDecoration.className, tokenMetadata | lineDecoration.metadata, tokenContainsRTL);
                break;
            }
        }
        if (tokenEndIndex > lastResultEndIndex) {
            lastResultEndIndex = tokenEndIndex;
            result[resultLen++] = new LinePart(lastResultEndIndex, tokenType, tokenMetadata, tokenContainsRTL);
        }
    }
    const lastTokenEndIndex = tokens[tokens.length - 1].endIndex;
    if (lineDecorationIndex < lineDecorationsLen && lineDecorations[lineDecorationIndex].startOffset === lastTokenEndIndex) {
        while (lineDecorationIndex < lineDecorationsLen && lineDecorations[lineDecorationIndex].startOffset === lastTokenEndIndex) {
            const lineDecoration = lineDecorations[lineDecorationIndex];
            result[resultLen++] = new LinePart(lastResultEndIndex, lineDecoration.className, lineDecoration.metadata, false);
            lineDecorationIndex++;
        }
    }
    return result;
}
/**
 * This function is on purpose not split up into multiple functions to allow runtime type inference (i.e. performance reasons).
 * Notice how all the needed data is fully resolved and passed in (i.e. no other calls).
 */
function _renderLine(input, sb) {
    const fontIsMonospace = input.fontIsMonospace;
    const canUseHalfwidthRightwardsArrow = input.canUseHalfwidthRightwardsArrow;
    const containsForeignElements = input.containsForeignElements;
    const lineContent = input.lineContent;
    const len = input.len;
    const isOverflowing = input.isOverflowing;
    const overflowingCharCount = input.overflowingCharCount;
    const parts = input.parts;
    const fauxIndentLength = input.fauxIndentLength;
    const tabSize = input.tabSize;
    const startVisibleColumn = input.startVisibleColumn;
    const spaceWidth = input.spaceWidth;
    const renderSpaceCharCode = input.renderSpaceCharCode;
    const renderWhitespace = input.renderWhitespace;
    const renderControlCharacters = input.renderControlCharacters;
    const characterMapping = new CharacterMapping(len + 1, parts.length);
    let lastCharacterMappingDefined = false;
    let charIndex = 0;
    let visibleColumn = startVisibleColumn;
    let charOffsetInPart = 0; // the character offset in the current part
    let charHorizontalOffset = 0; // the character horizontal position in terms of chars relative to line start
    let partDisplacement = 0;
    sb.appendString('<span>');
    for (let partIndex = 0, tokensLen = parts.length; partIndex < tokensLen; partIndex++) {
        const part = parts[partIndex];
        const partEndIndex = part.endIndex;
        const partType = part.type;
        const partContainsRTL = part.containsRTL;
        const partRendersWhitespace = (renderWhitespace !== 0 /* RenderWhitespace.None */ && part.isWhitespace());
        const partRendersWhitespaceWithWidth = partRendersWhitespace && !fontIsMonospace && (partType === 'mtkw' /*only whitespace*/ || !containsForeignElements);
        const partIsEmptyAndHasPseudoAfter = (charIndex === partEndIndex && part.isPseudoAfter());
        charOffsetInPart = 0;
        sb.appendString('<span ');
        if (partContainsRTL) {
            sb.appendString('dir="rtl" style="unicode-bidi:isolate" ');
        }
        sb.appendString('class="');
        sb.appendString(partRendersWhitespaceWithWidth ? 'mtkz' : partType);
        sb.appendASCIICharCode(34 /* CharCode.DoubleQuote */);
        if (partRendersWhitespace) {
            let partWidth = 0;
            {
                let _charIndex = charIndex;
                let _visibleColumn = visibleColumn;
                for (; _charIndex < partEndIndex; _charIndex++) {
                    const charCode = lineContent.charCodeAt(_charIndex);
                    const charWidth = (charCode === 9 /* CharCode.Tab */ ? (tabSize - (_visibleColumn % tabSize)) : 1) | 0;
                    partWidth += charWidth;
                    if (_charIndex >= fauxIndentLength) {
                        _visibleColumn += charWidth;
                    }
                }
            }
            if (partRendersWhitespaceWithWidth) {
                sb.appendString(' style="width:');
                sb.appendString(String(spaceWidth * partWidth));
                sb.appendString('px"');
            }
            sb.appendASCIICharCode(62 /* CharCode.GreaterThan */);
            for (; charIndex < partEndIndex; charIndex++) {
                characterMapping.setColumnInfo(charIndex + 1, partIndex - partDisplacement, charOffsetInPart, charHorizontalOffset);
                partDisplacement = 0;
                const charCode = lineContent.charCodeAt(charIndex);
                let producedCharacters;
                let charWidth;
                if (charCode === 9 /* CharCode.Tab */) {
                    producedCharacters = (tabSize - (visibleColumn % tabSize)) | 0;
                    charWidth = producedCharacters;
                    if (!canUseHalfwidthRightwardsArrow || charWidth > 1) {
                        sb.appendCharCode(0x2192); // RIGHTWARDS ARROW
                    }
                    else {
                        sb.appendCharCode(0xFFEB); // HALFWIDTH RIGHTWARDS ARROW
                    }
                    for (let space = 2; space <= charWidth; space++) {
                        sb.appendCharCode(0xA0); // &nbsp;
                    }
                }
                else { // must be CharCode.Space
                    producedCharacters = 2;
                    charWidth = 1;
                    sb.appendCharCode(renderSpaceCharCode); // &middot; or word separator middle dot
                    sb.appendCharCode(0x200C); // ZERO WIDTH NON-JOINER
                }
                charOffsetInPart += producedCharacters;
                charHorizontalOffset += charWidth;
                if (charIndex >= fauxIndentLength) {
                    visibleColumn += charWidth;
                }
            }
        }
        else {
            sb.appendASCIICharCode(62 /* CharCode.GreaterThan */);
            for (; charIndex < partEndIndex; charIndex++) {
                characterMapping.setColumnInfo(charIndex + 1, partIndex - partDisplacement, charOffsetInPart, charHorizontalOffset);
                partDisplacement = 0;
                const charCode = lineContent.charCodeAt(charIndex);
                let producedCharacters = 1;
                let charWidth = 1;
                switch (charCode) {
                    case 9 /* CharCode.Tab */:
                        producedCharacters = (tabSize - (visibleColumn % tabSize));
                        charWidth = producedCharacters;
                        for (let space = 1; space <= producedCharacters; space++) {
                            sb.appendCharCode(0xA0); // &nbsp;
                        }
                        break;
                    case 32 /* CharCode.Space */:
                        sb.appendCharCode(0xA0); // &nbsp;
                        break;
                    case 60 /* CharCode.LessThan */:
                        sb.appendString('&lt;');
                        break;
                    case 62 /* CharCode.GreaterThan */:
                        sb.appendString('&gt;');
                        break;
                    case 38 /* CharCode.Ampersand */:
                        sb.appendString('&amp;');
                        break;
                    case 0 /* CharCode.Null */:
                        if (renderControlCharacters) {
                            // See https://unicode-table.com/en/blocks/control-pictures/
                            sb.appendCharCode(9216);
                        }
                        else {
                            sb.appendString('&#00;');
                        }
                        break;
                    case 65279 /* CharCode.UTF8_BOM */:
                    case 8232 /* CharCode.LINE_SEPARATOR */:
                    case 8233 /* CharCode.PARAGRAPH_SEPARATOR */:
                    case 133 /* CharCode.NEXT_LINE */:
                        sb.appendCharCode(0xFFFD);
                        break;
                    default:
                        if (strings.isFullWidthCharacter(charCode)) {
                            charWidth++;
                        }
                        // See https://unicode-table.com/en/blocks/control-pictures/
                        if (renderControlCharacters && charCode < 32) {
                            sb.appendCharCode(9216 + charCode);
                        }
                        else if (renderControlCharacters && charCode === 127) {
                            // DEL
                            sb.appendCharCode(9249);
                        }
                        else if (renderControlCharacters && isControlCharacter(charCode)) {
                            sb.appendString('[U+');
                            sb.appendString(to4CharHex(charCode));
                            sb.appendString(']');
                            producedCharacters = 8;
                            charWidth = producedCharacters;
                        }
                        else {
                            sb.appendCharCode(charCode);
                        }
                }
                charOffsetInPart += producedCharacters;
                charHorizontalOffset += charWidth;
                if (charIndex >= fauxIndentLength) {
                    visibleColumn += charWidth;
                }
            }
        }
        if (partIsEmptyAndHasPseudoAfter) {
            partDisplacement++;
        }
        else {
            partDisplacement = 0;
        }
        if (charIndex >= len && !lastCharacterMappingDefined && part.isPseudoAfter()) {
            lastCharacterMappingDefined = true;
            characterMapping.setColumnInfo(charIndex + 1, partIndex, charOffsetInPart, charHorizontalOffset);
        }
        sb.appendString('</span>');
    }
    if (!lastCharacterMappingDefined) {
        // When getting client rects for the last character, we will position the
        // text range at the end of the span, insteaf of at the beginning of next span
        characterMapping.setColumnInfo(len + 1, parts.length - 1, charOffsetInPart, charHorizontalOffset);
    }
    if (isOverflowing) {
        sb.appendString('<span class="mtkoverflow">');
        sb.appendString(nls.localize('showMore', "Show more ({0})", renderOverflowingCharCount(overflowingCharCount)));
        sb.appendString('</span>');
    }
    sb.appendString('</span>');
    return new RenderLineOutput(characterMapping, containsForeignElements);
}
function to4CharHex(n) {
    return n.toString(16).toUpperCase().padStart(4, '0');
}
function renderOverflowingCharCount(n) {
    if (n < 1024) {
        return nls.localize('overflow.chars', "{0} chars", n);
    }
    if (n < 1024 * 1024) {
        return `${(n / 1024).toFixed(1)} KB`;
    }
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld0xpbmVSZW5kZXJlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL3ZpZXdMYXlvdXQvdmlld0xpbmVSZW5kZXJlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLGlCQUFpQixDQUFDO0FBRXZDLE9BQU8sS0FBSyxPQUFPLE1BQU0saUNBQWlDLENBQUM7QUFFM0QsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3pELE9BQU8sRUFBRSxjQUFjLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUNqRixPQUFPLEVBQUUsUUFBUSxFQUFvQixNQUFNLGVBQWUsQ0FBQztBQUczRCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBRTVDLE1BQU0sQ0FBTixJQUFrQixnQkFNakI7QUFORCxXQUFrQixnQkFBZ0I7SUFDakMsdURBQVEsQ0FBQTtJQUNSLCtEQUFZLENBQUE7SUFDWixpRUFBYSxDQUFBO0lBQ2IsK0RBQVksQ0FBQTtJQUNaLHFEQUFPLENBQUE7QUFDUixDQUFDLEVBTmlCLGdCQUFnQixLQUFoQixnQkFBZ0IsUUFNakM7QUEyQkQsTUFBTSxPQUFPLGVBQWU7SUFpQzNCLElBQVcsS0FBSztRQUNmLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssYUFBYSxDQUFDLEdBQUcsQ0FBQztJQUN0RSxDQUFDO0lBRUQsWUFDQyx5QkFBa0MsRUFDbEMsOEJBQXVDLEVBQ3ZDLFdBQW1CLEVBQ25CLHdCQUFpQyxFQUNqQyxZQUFxQixFQUNyQixXQUFvQixFQUNwQixnQkFBd0IsRUFDeEIsVUFBMkIsRUFDM0IsZUFBaUMsRUFDakMsT0FBZSxFQUNmLGtCQUEwQixFQUMxQixVQUFrQixFQUNsQixXQUFt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LG9CQUFvQixDQUFDLENBQUM7UUFDbEcsQ0FBQztRQUVELEVBQUUsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUM7SUFFNUIsQ0FBQztJQUVELElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1FBQ2xDLHlFQUF5RTtRQUN6RSw4RUFBOEU7UUFDOUUsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsZ0JBQWdCLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztJQUNuRyxDQUFDO0lBRUQsSUFBSSxhQUFhLEVBQUUsQ0FBQztRQUNuQixFQUFFLENBQUMsWUFBWSxDQUFDLDRCQUE0QixDQUFDLENBQUM7UUFDOUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSwwQkFBMEIsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvRyxFQUFFLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFFRCxFQUFFLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBRTNCLE9BQU8sSUFBSSxnQkFBZ0IsQ0FBQyxnQkFBZ0IsRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO0FBQ3hFLENBQUM7QUFFRCxTQUFTLFVBQVUsQ0FBQyxDQUFTO0lBQzVCLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3RELENBQUM7QUFFRCxTQUFTLDBCQUEwQixDQUFDLENBQVM7SUFDNUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUM7UUFDZCxPQUFPLEdBQUcsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3ZELENBQUM7SUFDRCxJQUFJLENBQUMsR0FBRyxJQUFJLEdBQUcsSUFBSSxFQUFFLENBQUM7UUFDckIsT0FBTyxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0lBQ3RDLENBQUM7SUFDRCxPQUFPLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQzdDLENBQUMifQ==