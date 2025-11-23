/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as markedKatexExtension from '../../markdown/common/markedKatexExtension.js';
const r = String.raw;
/**
 * Matches `[text](link title?)` or `[text](<link> title?)`
 *
 * Taken from vscode-markdown-languageservice
 */
const linkPattern = r `(?<!\\)` + // Must not start with escape
    // text
    r `(!?\[` + // open prefix match -->
    /**/ r `(?:` +
    /*****/ r `[^\[\]\\]|` + // Non-bracket chars, or...
    /*****/ r `\\.|` + // Escaped char, or...
    /*****/ r `\[[^\[\]]*\]` + // Matched bracket pair
    /**/ r `)*` +
    r `\])` + // <-- close prefix match
    // Destination
    r `(\(\s*)` + // Pre href
    /**/ r `(` +
    /*****/ r `[^\s\(\)<](?:[^\s\(\)]|\([^\s\(\)]*?\))*|` + // Link without whitespace, or...
    /*****/ r `<(?:\\[<>]|[^<>])+>` + // In angle brackets
    /**/ r `)` +
    // Title
    /**/ r `\s*(?:"[^"]*"|'[^']*'|\([^\(\)]*\))?\s*` +
    r `\)`;
export function getNWords(str, numWordsToCount) {
    // This regex matches each word and skips over whitespace and separators. A word is:
    // A markdown link
    // Inline math
    // One chinese character
    // One or more + - =, handled so that code like "a=1+2-3" is broken up better
    // One or more characters that aren't whitepace or any of the above
    const backtick = '`';
    const wordRegExp = new RegExp('(?:' + linkPattern + ')|(?:' + markedKatexExtension.mathInlineRegExp.source + r `)|\p{sc=Han}|=+|\++|-+|[^\s\|\p{sc=Han}|=|\+|\-|${backtick}]+`, 'gu');
    const allWordMatches = Array.from(str.matchAll(wordRegExp));
    const targetWords = allWordMatches.slice(0, numWordsToCount);
    const endIndex = numWordsToCount >= allWordMatches.length
        ? str.length // Reached end of string
        : targetWords.length ? targetWords.at(-1).index + targetWords.at(-1)[0].length : 0;
    const value = str.substring(0, endIndex);
    return {
        value,
        returnedWordCount: targetWords.length === 0 ? (value.length ? 1 : 0) : targetWords.length,
        isFullString: endIndex >= str.length,
        totalWordCount: allWordMatches.length
    };
}
export function countWords(str) {
    const result = getNWords(str, Number.MAX_SAFE_INTEGER);
    return result.returnedWordCount;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFdvcmRDb3VudGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL2NoYXRXb3JkQ291bnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssb0JBQW9CLE1BQU0sK0NBQStDLENBQUM7QUFTdEYsTUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQztBQUVyQjs7OztHQUlHO0FBQ0gsTUFBTSxXQUFXLEdBQ2hCLENBQUMsQ0FBQSxTQUFTLEdBQUcsNkJBQTZCO0lBRTFDLE9BQU87SUFDUCxDQUFDLENBQUEsT0FBTyxHQUFHLHdCQUF3QjtJQUNuQyxJQUFJLENBQUEsQ0FBQyxDQUFBLEtBQUs7SUFDVixPQUFPLENBQUEsQ0FBQyxDQUFBLFlBQVksR0FBRywyQkFBMkI7SUFDbEQsT0FBTyxDQUFBLENBQUMsQ0FBQSxNQUFNLEdBQUcsc0JBQXNCO0lBQ3ZDLE9BQU8sQ0FBQSxDQUFDLENBQUEsY0FBYyxHQUFHLHVCQUF1QjtJQUNoRCxJQUFJLENBQUEsQ0FBQyxDQUFBLElBQUk7SUFDVCxDQUFDLENBQUEsS0FBSyxHQUFHLHlCQUF5QjtJQUVsQyxjQUFjO0lBQ2QsQ0FBQyxDQUFBLFNBQVMsR0FBRyxXQUFXO0lBQ3hCLElBQUksQ0FBQSxDQUFDLENBQUEsR0FBRztJQUNSLE9BQU8sQ0FBQSxDQUFDLENBQUEsMkNBQTJDLEdBQUcsaUNBQWlDO0lBQ3ZGLE9BQU8sQ0FBQSxDQUFDLENBQUEscUJBQXFCLEdBQUcsb0JBQW9CO0lBQ3BELElBQUksQ0FBQSxDQUFDLENBQUEsR0FBRztJQUVSLFFBQVE7SUFDUixJQUFJLENBQUEsQ0FBQyxDQUFBLHlDQUF5QztJQUM5QyxDQUFDLENBQUEsSUFBSSxDQUFDO0FBRVAsTUFBTSxVQUFVLFNBQVMsQ0FBQyxHQUFXLEVBQUUsZUFBdUI7SUFDN0Qsb0ZBQW9GO0lBQ3BGLGtCQUFrQjtJQUNsQixjQUFjO0lBQ2Qsd0JBQXdCO0lBQ3hCLDZFQUE2RTtJQUM3RSxtRUFBbUU7SUFDbkUsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDO0lBRXJCLE1BQU0sVUFBVSxHQUFHLElBQUksTUFBTSxDQUFDLEtBQUssR0FBRyxXQUFXLEdBQUcsT0FBTyxHQUFHLG9CQUFvQixDQUFDLGdCQUFnQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUEsbURBQW1ELFFBQVEsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3JMLE1BQU0sY0FBYyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBRTVELE1BQU0sV0FBVyxHQUFHLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLGVBQWUsQ0FBQyxDQUFDO0lBRTdELE1BQU0sUUFBUSxHQUFHLGVBQWUsSUFBSSxjQUFjLENBQUMsTUFBTTtRQUN4RCxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyx3QkFBd0I7UUFDckMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUUsQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRXRGLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ3pDLE9BQU87UUFDTixLQUFLO1FBQ0wsaUJBQWlCLEVBQUUsV0FBVyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLE1BQU07UUFDekYsWUFBWSxFQUFFLFFBQVEsSUFBSSxHQUFHLENBQUMsTUFBTTtRQUNwQyxjQUFjLEVBQUUsY0FBYyxDQUFDLE1BQU07S0FDckMsQ0FBQztBQUNILENBQUM7QUFFRCxNQUFNLFVBQVUsVUFBVSxDQUFDLEdBQVc7SUFDckMsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztJQUN2RCxPQUFPLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQztBQUNqQyxDQUFDIn0=