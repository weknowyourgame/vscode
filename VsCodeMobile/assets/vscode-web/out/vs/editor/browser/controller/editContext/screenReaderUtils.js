/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Range } from '../../../common/core/range.js';
import * as nls from '../../../../nls.js';
export class SimplePagedScreenReaderStrategy {
    _getPageOfLine(lineNumber, linesPerPage) {
        return Math.floor((lineNumber - 1) / linesPerPage);
    }
    _getRangeForPage(page, linesPerPage) {
        const offset = page * linesPerPage;
        const startLineNumber = offset + 1;
        const endLineNumber = offset + linesPerPage;
        return new Range(startLineNumber, 1, endLineNumber + 1, 1);
    }
    fromEditorSelection(model, selection, linesPerPage, trimLongText) {
        // Chromium handles very poorly text even of a few thousand chars
        // Cut text to avoid stalling the entire UI
        const LIMIT_CHARS = 500;
        const selectionStartPage = this._getPageOfLine(selection.startLineNumber, linesPerPage);
        const selectionStartPageRange = this._getRangeForPage(selectionStartPage, linesPerPage);
        const selectionEndPage = this._getPageOfLine(selection.endLineNumber, linesPerPage);
        const selectionEndPageRange = this._getRangeForPage(selectionEndPage, linesPerPage);
        let pretextRange = selectionStartPageRange.intersectRanges(new Range(1, 1, selection.startLineNumber, selection.startColumn));
        if (trimLongText && model.getValueLengthInRange(pretextRange, 1 /* EndOfLinePreference.LF */) > LIMIT_CHARS) {
            const pretextStart = model.modifyPosition(pretextRange.getEndPosition(), -LIMIT_CHARS);
            pretextRange = Range.fromPositions(pretextStart, pretextRange.getEndPosition());
        }
        const pretext = model.getValueInRange(pretextRange, 1 /* EndOfLinePreference.LF */);
        const lastLine = model.getLineCount();
        const lastLineMaxColumn = model.getLineMaxColumn(lastLine);
        let posttextRange = selectionEndPageRange.intersectRanges(new Range(selection.endLineNumber, selection.endColumn, lastLine, lastLineMaxColumn));
        if (trimLongText && model.getValueLengthInRange(posttextRange, 1 /* EndOfLinePreference.LF */) > LIMIT_CHARS) {
            const posttextEnd = model.modifyPosition(posttextRange.getStartPosition(), LIMIT_CHARS);
            posttextRange = Range.fromPositions(posttextRange.getStartPosition(), posttextEnd);
        }
        const posttext = model.getValueInRange(posttextRange, 1 /* EndOfLinePreference.LF */);
        let text;
        if (selectionStartPage === selectionEndPage || selectionStartPage + 1 === selectionEndPage) {
            // take full selection
            text = model.getValueInRange(selection, 1 /* EndOfLinePreference.LF */);
        }
        else {
            const selectionRange1 = selectionStartPageRange.intersectRanges(selection);
            const selectionRange2 = selectionEndPageRange.intersectRanges(selection);
            text = (model.getValueInRange(selectionRange1, 1 /* EndOfLinePreference.LF */)
                + String.fromCharCode(8230)
                + model.getValueInRange(selectionRange2, 1 /* EndOfLinePreference.LF */));
        }
        if (trimLongText && text.length > 2 * LIMIT_CHARS) {
            text = text.substring(0, LIMIT_CHARS) + String.fromCharCode(8230) + text.substring(text.length - LIMIT_CHARS, text.length);
        }
        let selectionStart;
        let selectionEnd;
        if (selection.getDirection() === 0 /* SelectionDirection.LTR */) {
            selectionStart = pretext.length;
            selectionEnd = pretext.length + text.length;
        }
        else {
            selectionEnd = pretext.length;
            selectionStart = pretext.length + text.length;
        }
        return {
            value: pretext + text + posttext,
            selection: selection,
            selectionStart,
            selectionEnd,
            startPositionWithinEditor: pretextRange.getStartPosition(),
            newlineCountBeforeSelection: pretextRange.endLineNumber - pretextRange.startLineNumber,
        };
    }
}
export function ariaLabelForScreenReaderContent(options, keybindingService) {
    const accessibilitySupport = options.get(2 /* EditorOption.accessibilitySupport */);
    if (accessibilitySupport === 1 /* AccessibilitySupport.Disabled */) {
        const toggleKeybindingLabel = keybindingService.lookupKeybinding('editor.action.toggleScreenReaderAccessibilityMode')?.getAriaLabel();
        const runCommandKeybindingLabel = keybindingService.lookupKeybinding('workbench.action.showCommands')?.getAriaLabel();
        const keybindingEditorKeybindingLabel = keybindingService.lookupKeybinding('workbench.action.openGlobalKeybindings')?.getAriaLabel();
        const editorNotAccessibleMessage = nls.localize('accessibilityModeOff', "The editor is not accessible at this time.");
        if (toggleKeybindingLabel) {
            return nls.localize('accessibilityOffAriaLabel', "{0} To enable screen reader optimized mode, use {1}", editorNotAccessibleMessage, toggleKeybindingLabel);
        }
        else if (runCommandKeybindingLabel) {
            return nls.localize('accessibilityOffAriaLabelNoKb', "{0} To enable screen reader optimized mode, open the quick pick with {1} and run the command Toggle Screen Reader Accessibility Mode, which is currently not triggerable via keyboard.", editorNotAccessibleMessage, runCommandKeybindingLabel);
        }
        else if (keybindingEditorKeybindingLabel) {
            return nls.localize('accessibilityOffAriaLabelNoKbs', "{0} Please assign a keybinding for the command Toggle Screen Reader Accessibility Mode by accessing the keybindings editor with {1} and run it.", editorNotAccessibleMessage, keybindingEditorKeybindingLabel);
        }
        else {
            // SOS
            return editorNotAccessibleMessage;
        }
    }
    return options.get(8 /* EditorOption.ariaLabel */);
}
export function newlinecount(text) {
    let result = 0;
    let startIndex = -1;
    do {
        startIndex = text.indexOf('\n', startIndex + 1);
        if (startIndex === -1) {
            break;
        }
        result++;
    } while (true);
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyZWVuUmVhZGVyVXRpbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvY29udHJvbGxlci9lZGl0Q29udGV4dC9zY3JlZW5SZWFkZXJVdGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUloRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFLdEQsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQTBCMUMsTUFBTSxPQUFPLCtCQUErQjtJQUNuQyxjQUFjLENBQUMsVUFBa0IsRUFBRSxZQUFvQjtRQUM5RCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVPLGdCQUFnQixDQUFDLElBQVksRUFBRSxZQUFvQjtRQUMxRCxNQUFNLE1BQU0sR0FBRyxJQUFJLEdBQUcsWUFBWSxDQUFDO1FBQ25DLE1BQU0sZUFBZSxHQUFHLE1BQU0sR0FBRyxDQUFDLENBQUM7UUFDbkMsTUFBTSxhQUFhLEdBQUcsTUFBTSxHQUFHLFlBQVksQ0FBQztRQUM1QyxPQUFPLElBQUksS0FBSyxDQUFDLGVBQWUsRUFBRSxDQUFDLEVBQUUsYUFBYSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBRU0sbUJBQW1CLENBQUMsS0FBbUIsRUFBRSxTQUFvQixFQUFFLFlBQW9CLEVBQUUsWUFBcUI7UUFDaEgsaUVBQWlFO1FBQ2pFLDJDQUEyQztRQUMzQyxNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUM7UUFFeEIsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxlQUFlLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDeEYsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLENBQUMs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