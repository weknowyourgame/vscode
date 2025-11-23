/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as strings from '../../../base/common/strings.js';
import { LineTokens } from '../tokens/lineTokens.js';
import { TokenizationRegistry } from '../languages.js';
import { NullState, nullTokenizeEncoded } from './nullTokenize.js';
const fallback = {
    getInitialState: () => NullState,
    tokenizeEncoded: (buffer, hasEOL, state) => nullTokenizeEncoded(0 /* LanguageId.Null */, state)
};
export function tokenizeToStringSync(languageService, text, languageId) {
    return _tokenizeToString(text, languageService.languageIdCodec, TokenizationRegistry.get(languageId) || fallback);
}
export async function tokenizeToString(languageService, text, languageId) {
    if (!languageId) {
        return _tokenizeToString(text, languageService.languageIdCodec, fallback);
    }
    const tokenizationSupport = await TokenizationRegistry.getOrCreate(languageId);
    return _tokenizeToString(text, languageService.languageIdCodec, tokenizationSupport || fallback);
}
export function tokenizeLineToHTML(text, viewLineTokens, colorMap, startOffset, endOffset, tabSize, useNbsp) {
    let result = `<div>`;
    let charIndex = 0;
    let width = 0;
    let prevIsSpace = true;
    for (let tokenIndex = 0, tokenCount = viewLineTokens.getCount(); tokenIndex < tokenCount; tokenIndex++) {
        const tokenEndIndex = viewLineTokens.getEndOffset(tokenIndex);
        let partContent = '';
        for (; charIndex < tokenEndIndex && charIndex < endOffset; charIndex++) {
            const charCode = text.charCodeAt(charIndex);
            const isTab = charCode === 9 /* CharCode.Tab */;
            width += strings.isFullWidthCharacter(charCode) ? 2 : (isTab ? 0 : 1);
            if (charIndex < startOffset) {
                if (isTab) {
                    const remainder = width % tabSize;
                    width += remainder === 0 ? tabSize : tabSize - remainder;
                }
                continue;
            }
            switch (charCode) {
                case 9 /* CharCode.Tab */: {
                    const remainder = width % tabSize;
                    const insertSpacesCount = remainder === 0 ? tabSize : tabSize - remainder;
                    width += insertSpacesCount;
                    let spacesRemaining = insertSpacesCount;
                    while (spacesRemaining > 0) {
                        if (useNbsp && prevIsSpace) {
                            partContent += '&#160;';
                            prevIsSpace = false;
                        }
                        else {
                            partContent += ' ';
                            prevIsSpace = true;
                        }
                        spacesRemaining--;
                    }
                    break;
                }
                case 60 /* CharCode.LessThan */:
                    partContent += '&lt;';
                    prevIsSpace = false;
                    break;
                case 62 /* CharCode.GreaterThan */:
                    partContent += '&gt;';
                    prevIsSpace = false;
                    break;
                case 38 /* CharCode.Ampersand */:
                    partContent += '&amp;';
                    prevIsSpace = false;
                    break;
                case 0 /* CharCode.Null */:
                    partContent += '&#00;';
                    prevIsSpace = false;
                    break;
                case 65279 /* CharCode.UTF8_BOM */:
                case 8232 /* CharCode.LINE_SEPARATOR */:
                case 8233 /* CharCode.PARAGRAPH_SEPARATOR */:
                case 133 /* CharCode.NEXT_LINE */:
                    partContent += '\ufffd';
                    prevIsSpace = false;
                    break;
                case 13 /* CharCode.CarriageReturn */:
                    // zero width space, because carriage return would introduce a line break
                    partContent += '&#8203';
                    prevIsSpace = false;
                    break;
                case 32 /* CharCode.Space */:
                    if (useNbsp && prevIsSpace) {
                        partContent += '&#160;';
                        prevIsSpace = false;
                    }
                    else {
                        partContent += ' ';
                        prevIsSpace = true;
                    }
                    break;
                default:
                    partContent += String.fromCharCode(charCode);
                    prevIsSpace = false;
            }
        }
        if (tokenEndIndex <= startOffset) {
            continue;
        }
        result += `<span style="${viewLineTokens.getInlineStyle(tokenIndex, colorMap)}">${partContent}</span>`;
        if (tokenEndIndex > endOffset || charIndex >= endOffset || startOffset >= endOffset) {
            break;
        }
    }
    result += `</div>`;
    return result;
}
export function _tokenizeToString(text, languageIdCodec, tokenizationSupport) {
    let result = `<div class="monaco-tokenized-source">`;
    const lines = strings.splitLines(text);
    let currentState = tokenizationSupport.getInitialState();
    for (let i = 0, len = lines.length; i < len; i++) {
        const line = lines[i];
        if (i > 0) {
            result += `<br/>`;
        }
        const tokenizationResult = tokenizationSupport.tokenizeEncoded(line, true, currentState);
        LineTokens.convertToEndOffset(tokenizationResult.tokens, line.length);
        const lineTokens = new LineTokens(tokenizationResult.tokens, line, languageIdCodec);
        const viewLineTokens = lineTokens.inflate();
        let startOffset = 0;
        for (let j = 0, lenJ = viewLineTokens.getCount(); j < lenJ; j++) {
            const type = viewLineTokens.getClassName(j);
            const endIndex = viewLineTokens.getEndOffset(j);
            result += `<span class="${type}">${strings.escape(line.substring(startOffset, endIndex))}</span>`;
            startOffset = endIndex;
        }
        currentState = tokenizationResult.endState;
    }
    result += `</div>`;
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dFRvSHRtbFRva2VuaXplci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy90ZXh0VG9IdG1sVG9rZW5pemVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sS0FBSyxPQUFPLE1BQU0saUNBQWlDLENBQUM7QUFDM0QsT0FBTyxFQUFtQixVQUFVLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RSxPQUFPLEVBQWtELG9CQUFvQixFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFdkcsT0FBTyxFQUFFLFNBQVMsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBS25FLE1BQU0sUUFBUSxHQUFnQztJQUM3QyxlQUFlLEVBQUUsR0FBRyxFQUFFLENBQUMsU0FBUztJQUNoQyxlQUFlLEVBQUUsQ0FBQyxNQUFjLEVBQUUsTUFBZSxFQUFFLEtBQWEsRUFBRSxFQUFFLENBQUMsbUJBQW1CLDBCQUFrQixLQUFLLENBQUM7Q0FDaEgsQ0FBQztBQUVGLE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxlQUFpQyxFQUFFLElBQVksRUFBRSxVQUFrQjtJQUN2RyxPQUFPLGlCQUFpQixDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsZUFBZSxFQUFFLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQztBQUNuSCxDQUFDO0FBRUQsTUFBTSxDQUFDLEtBQUssVUFBVSxnQkFBZ0IsQ0FBQyxlQUFpQyxFQUFFLElBQVksRUFBRSxVQUF5QjtJQUNoSCxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDakIsT0FBTyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLGVBQWUsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUMzRSxDQUFDO0lBQ0QsTUFBTSxtQkFBbUIsR0FBRyxNQUFN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