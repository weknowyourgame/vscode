/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isMultilineRegexSource } from '../model/textModelSearch.js';
import { regExpLeadsToEndlessLoop } from '../../../base/common/strings.js';
const trimDashesRegex = /^-+|-+$/g;
const CHUNK_SIZE = 100;
const MAX_SECTION_LINES = 5;
/**
 * Find section headers in the model.
 *
 * @param model the text model to search in
 * @param options options to search with
 * @returns an array of section headers
 */
export function findSectionHeaders(model, options) {
    let headers = [];
    if (options.findRegionSectionHeaders && options.foldingRules?.markers) {
        const regionHeaders = collectRegionHeaders(model, options);
        headers = headers.concat(regionHeaders);
    }
    if (options.findMarkSectionHeaders) {
        const markHeaders = collectMarkHeaders(model, options);
        headers = headers.concat(markHeaders);
    }
    return headers;
}
function collectRegionHeaders(model, options) {
    const regionHeaders = [];
    const endLineNumber = model.getLineCount();
    for (let lineNumber = 1; lineNumber <= endLineNumber; lineNumber++) {
        const lineContent = model.getLineContent(lineNumber);
        const match = lineContent.match(options.foldingRules.markers.start);
        if (match) {
            const range = { startLineNumber: lineNumber, startColumn: match[0].length + 1, endLineNumber: lineNumber, endColumn: lineContent.length + 1 };
            if (range.endColumn > range.startColumn) {
                const sectionHeader = {
                    range,
                    ...getHeaderText(lineContent.substring(match[0].length)),
                    shouldBeInComments: false
                };
                if (sectionHeader.text || sectionHeader.hasSeparatorLine) {
                    regionHeaders.push(sectionHeader);
                }
            }
        }
    }
    return regionHeaders;
}
export function collectMarkHeaders(model, options) {
    const markHeaders = [];
    const endLineNumber = model.getLineCount();
    // Validate regex to prevent infinite loops
    if (!options.markSectionHeaderRegex || options.markSectionHeaderRegex.trim() === '') {
        return markHeaders;
    }
    // Create regex with flags for:
    // - 'd' for indices to get proper match positions
    // - 'm' for multi-line mode so ^ and $ match line starts/ends
    // - 's' for dot-all mode so . matches newlines
    const multiline = isMultilineRegexSource(options.markSectionHeaderRegex);
    const regex = new RegExp(options.markSectionHeaderRegex, `gdm${multiline ? 's' : ''}`);
    // Check if the regex would lead to an endless loop
    if (regExpLeadsToEndlessLoop(regex)) {
        return markHeaders;
    }
    // Process text in overlapping chunks for better performance
    for (let startLine = 1; startLine <= endLineNumber; startLine += CHUNK_SIZE - MAX_SECTION_LINES) {
        const endLine = Math.min(startLine + CHUNK_SIZE - 1, endLineNumber);
        const lines = [];
        // Collect lines for the current chunk
        for (let i = startLine; i <= endLine; i++) {
            lines.push(model.getLineContent(i));
        }
        const text = lines.join('\n');
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            // Calculate which line this match starts on by counting newlines before it
            const precedingText = text.substring(0, match.index);
            const lineOffset = (precedingText.match(/\n/g) || []).length;
            const lineNumber = startLine + lineOffset;
            // Calculate match height to check overlap properly
            const matchLines = match[0].split('\n');
            const matchHeight = matchLines.length;
            const matchEndLine = lineNumber + matchHeight - 1;
            // Calculate start column - need to find the start of the line containing the match
            const lineStartIndex = precedingText.lastIndexOf('\n') + 1;
            const startColumn = match.index - lineStartIndex + 1;
            // Calculate end column - need to handle multi-line matches
            const lastMatchLine = matchLines[matchLines.length - 1];
            const endColumn = matchHeight === 1 ? startColumn + match[0].length : lastMatchLine.length + 1;
            const range = {
                startLineNumber: lineNumber,
                startColumn,
                endLineNumber: matchEndLine,
                endColumn
            };
            const text2 = (match.groups ?? {})['label'] ?? '';
            const hasSeparatorLine = ((match.groups ?? {})['separator'] ?? '') !== '';
            const sectionHeader = {
                range,
                text: text2,
                hasSeparatorLine,
                shouldBeInComments: true
            };
            if (sectionHeader.text || sectionHeader.hasSeparatorLine) {
                // only push if the previous one doesn't have this same linbe
                if (markHeaders.length === 0 || markHeaders[markHeaders.length - 1].range.endLineNumber < sectionHeader.range.startLineNumber) {
                    markHeaders.push(sectionHeader);
                }
            }
            // Move lastIndex past the current match to avoid infinite loop
            regex.lastIndex = match.index + match[0].length;
        }
    }
    return markHeaders;
}
function getHeaderText(text) {
    text = text.trim();
    const hasSeparatorLine = text.startsWith('-');
    text = text.replace(trimDashesRegex, '');
    return { text, hasSeparatorLine };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZFNlY3Rpb25IZWFkZXJzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb21tb24vc2VydmljZXMvZmluZFNlY3Rpb25IZWFkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBSWhHLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3JFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBaUMzRSxNQUFNLGVBQWUsR0FBRyxVQUFVLENBQUM7QUFFbkMsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDO0FBQ3ZCLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxDQUFDO0FBRTVCOzs7Ozs7R0FNRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FBQyxLQUFpQyxFQUFFLE9BQWlDO0lBQ3RHLElBQUksT0FBTyxHQUFvQixFQUFFLENBQUM7SUFDbEMsSUFBSSxPQUFPLENBQUMsd0JBQXdCLElBQUksT0FBTyxDQUFDLFlBQVksRUFBRSxPQUFPLEVBQUUsQ0FBQztRQUN2RSxNQUFNLGFBQWEsR0FBRyxvQkFBb0IsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDM0QsT0FBTyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUNELElBQUksT0FBTyxDQUFDLHNCQUFzQixFQUFFLENBQUM7UUFDcEMsTUFBTSxXQUFXLEdBQUcsa0JBQWtCLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZELE9BQU8sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFDRCxPQUFPLE9BQU8sQ0FBQztBQUNoQixDQUFDO0FBRUQsU0FBUyxvQkFBb0IsQ0FBQyxLQUFpQyxFQUFFLE9BQWlDO0lBQ2pHLE1BQU0sYUFBYSxH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