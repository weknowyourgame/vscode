/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as strings from '../../../base/common/strings.js';
import { ReplaceCommand } from '../commands/replaceCommand.js';
import { EditOperationResult, isQuote } from '../cursorCommon.js';
import { CursorColumns } from '../core/cursorColumns.js';
import { MoveOperations } from './cursorMoveOperations.js';
import { Range } from '../core/range.js';
import { Position } from '../core/position.js';
export class DeleteOperations {
    static deleteRight(prevEditOperationType, config, model, selections) {
        const commands = [];
        let shouldPushStackElementBefore = (prevEditOperationType !== 3 /* EditOperationType.DeletingRight */);
        for (let i = 0, len = selections.length; i < len; i++) {
            const selection = selections[i];
            const deleteSelection = this.getDeleteRightRange(selection, model, config);
            if (deleteSelection.isEmpty()) {
                // Probably at end of file => ignore
                commands[i] = null;
                continue;
            }
            if (deleteSelection.startLineNumber !== deleteSelection.endLineNumber) {
                shouldPushStackElementBefore = true;
            }
            commands[i] = new ReplaceCommand(deleteSelection, '');
        }
        return [shouldPushStackElementBefore, commands];
    }
    static getDeleteRightRange(selection, model, config) {
        if (!selection.isEmpty()) {
            return selection;
        }
        const position = selection.getPosition();
        const rightOfPosition = MoveOperations.right(config, model, position);
        if (config.trimWhitespaceOnDelete && rightOfPosition.lineNumber !== position.lineNumber) {
            // Smart line join (deleting leading whitespace) is on
            // (and) Delete is happening at the end of a line
            const currentLineHasContent = (model.getLineFirstNonWhitespaceColumn(position.lineNumber) > 0);
            const firstNonWhitespaceColumn = model.getLineFirstNonWhitespaceColumn(rightOfPosition.lineNumber);
            if (currentLineHasContent && firstNonWhitespaceColumn > 0) {
                // The next line has content
                return new Range(rightOfPosition.lineNumber, firstNonWhitespaceColumn, position.lineNumber, position.column);
            }
        }
        return new Range(rightOfPosition.lineNumber, rightOfPosition.column, position.lineNumber, position.column);
    }
    static isAutoClosingPairDelete(autoClosingDelete, autoClosingBrackets, autoClosingQuotes, autoClosingPairsOpen, model, selections, autoClosedCharacters) {
        if (autoClosingBrackets === 'never' && autoClosingQuotes === 'never') {
            return false;
        }
        if (autoClosingDelete === 'never') {
            return false;
        }
        for (let i = 0, len = selections.length; i < len; i++) {
            const selection = selections[i];
            const position = selection.getPosition();
            if (!selection.isEmpty()) {
                return false;
            }
            const lineText = model.getLineContent(position.lineNumber);
            if (position.column < 2 || position.column >= lineText.length + 1) {
                return false;
            }
            const character = lineText.charAt(position.column - 2);
            const autoClosingPairCandidates = autoClosingPairsOpen.get(character);
            if (!autoClosingPairCandidates) {
                return false;
            }
            if (isQuote(character)) {
                if (autoClosingQuotes === 'never') {
                    return false;
                }
            }
            else {
                if (autoClosingBrackets === 'never') {
                    return false;
                }
            }
            const afterCharacter = lineText.charAt(position.column - 1);
            let foundAutoClosingPair = false;
            for (const autoClosingPairCandidate of autoClosingPairCandidates) {
                if (autoClosingPairCandidate.open === character && autoClosingPairCandidate.close === afterCharacter) {
                    foundAutoClosingPair = true;
                }
            }
            if (!foundAutoClosingPair) {
                return false;
            }
            // Must delete the pair only if it was automatically inserted by the editor
            if (autoClosingDelete === 'auto') {
                let found = false;
                for (let j = 0, lenJ = autoClosedCharacters.length; j < lenJ; j++) {
                    const autoClosedCharacter = autoClosedCharacters[j];
                    if (position.lineNumber === autoClosedCharacter.startLineNumber && position.column === autoClosedCharacter.startColumn) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    return false;
                }
            }
        }
        return true;
    }
    static _runAutoClosingPairDelete(config, model, selections) {
        const commands = [];
        for (let i = 0, len = selections.length; i < len; i++) {
            const position = selections[i].getPosition();
            const deleteSelection = new Range(position.lineNumber, position.column - 1, position.lineNumber, position.column + 1);
            commands[i] = new ReplaceCommand(deleteSelection, '');
        }
        return [true, commands];
    }
    static deleteLeft(prevEditOperationType, config, model, selections, autoClosedCharacters) {
        if (this.isAutoClosingPairDelete(config.autoClosingDelete, config.autoClosingBrackets, config.autoClosingQuotes, config.autoClosingPairs.autoClosingPairsOpenByEnd, model, selections, autoClosedCharacters)) {
            return this._runAutoClosingPairDelete(config, model, selections);
        }
        const commands = [];
        let shouldPushStackElementBefore = (prevEditOperationType !== 2 /* EditOperationType.DeletingLeft */);
        for (let i = 0, len = selections.length; i < len; i++) {
            const deleteRange = DeleteOperations.getDeleteLeftRange(selections[i], model, config);
            // Ignore empty delete ranges, as they have no effect
            // They happen if the cursor is at the beginning of the file.
            if (deleteRange.isEmpty()) {
                commands[i] = null;
                continue;
            }
            if (deleteRange.startLineNumber !== deleteRange.endLineNumber) {
                shouldPushStackElementBefore = true;
            }
            commands[i] = new ReplaceCommand(deleteRange, '');
        }
        return [shouldPushStackElementBefore, commands];
    }
    static getDeleteLeftRange(selection, model, config) {
        if (!selection.isEmpty()) {
            return selection;
        }
        const position = selection.getPosition();
        // Unintend when using tab stops and cursor is within indentation
        if (config.useTabStops && position.column > 1) {
            const lineContent = model.getLineContent(position.lineNumber);
            const firstNonWhitespaceIndex = strings.firstNonWhitespaceIndex(lineContent);
            const lastIndentationColumn = (firstNonWhitespaceIndex === -1
                ? /* entire string is whitespace */ lineContent.length + 1
                : firstNonWhitespaceIndex + 1);
            if (position.column <= lastIndentationColumn) {
                const fromVisibleColumn = config.visibleColumnFromColumn(model, position);
                const toVisibleColumn = CursorColumns.prevIndentTabStop(fromVisibleColumn, config.indentSize);
                const toColumn = config.columnFromVisibleColumn(model, position.lineNumber, toVisibleColumn);
                return new Range(position.lineNumber, toColumn, position.lineNumber, position.column);
            }
        }
        return Range.fromPositions(DeleteOperations.getPositionAfterDeleteLeft(position, model), position);
    }
    static getPositionAfterDeleteLeft(position, model) {
        if (position.column > 1) {
            // Convert 1-based columns to 0-based offsets and back.
            const idx = strings.getLeftDeleteOffset(position.column - 1, model.getLineContent(position.lineNumber));
            return position.with(undefined, idx + 1);
        }
        else if (position.lineNumber > 1) {
            const newLine = position.lineNumber - 1;
            return new Position(newLine, model.getLineMaxColumn(newLine));
        }
        else {
            return position;
        }
    }
    static cut(config, model, selections) {
        const commands = [];
        let lastCutRange = null;
        selections.sort((a, b) => Position.compare(a.getStartPosition(), b.getEndPosition()));
        for (let i = 0, len = selections.length; i < len; i++) {
            const selection = selections[i];
            if (selection.isEmpty()) {
                if (config.emptySelectionClipboard) {
                    // This is a full line cut
                    const position = selection.getPosition();
                    let startLineNumber, startColumn, endLineNumber, endColumn;
                    if (position.lineNumber < model.getLineCount()) {
                        // Cutting a line in the middle of the model
                        startLineNumber = position.lineNumber;
                        startColumn = 1;
                        endLineNumber = position.lineNumber + 1;
                        endColumn = 1;
                    }
                    else if (position.lineNumber > 1 && lastCutRange?.endLineNumber !== position.lineNumber) {
                        // Cutting the last line & there are more than 1 lines in the model & a previous cut operation does not touch the current cut operation
                        startLineNumber = position.lineNumber - 1;
                        startColumn = model.getLineMaxColumn(position.lineNumber - 1);
                        endLineNumber = position.lineNumber;
                        endColumn = model.getLineMaxColumn(position.lineNumber);
                    }
                    else {
                        // Cutting the single line that the model contains
                        startLineNumber = position.lineNumber;
                        startColumn = 1;
                        endLineNumber = position.lineNumber;
                        endColumn = model.getLineMaxColumn(position.lineNumber);
                    }
                    const deleteSelection = new Range(startLineNumber, startColumn, endLineNumber, endColumn);
                    lastCutRange = deleteSelection;
                    if (!deleteSelection.isEmpty()) {
                        commands[i] = new ReplaceCommand(deleteSelection, '');
                    }
                    else {
                        commands[i] = null;
                    }
                }
                else {
                    // Cannot cut empty selection
                    commands[i] = null;
                }
            }
            else {
                commands[i] = new ReplaceCommand(selection, '');
            }
        }
        return new EditOperationResult(0 /* EditOperationType.Other */, commands, {
            shouldPushStackElementBefore: true,
            shouldPushStackElementAfter: true
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3Vyc29yRGVsZXRlT3BlcmF0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL2N1cnNvci9jdXJzb3JEZWxldGVPcGVyYXRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxPQUFPLE1BQU0saUNBQWlDLENBQUM7QUFDM0QsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBRS9ELE9BQU8sRUFBdUIsbUJBQW1CLEVBQXlDLE9BQU8sRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlILE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUN6RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDM0QsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBSXpDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUUvQyxNQUFNLE9BQU8sZ0JBQWdCO0lBRXJCLE1BQU0sQ0FBQyxXQUFXLENBQUMscUJBQXdDLEVBQUUsTUFBMkIsRUFBRSxLQUF5QixFQUFFLFVBQXVCO1FBQ2xKLE1BQU0sUUFBUSxHQUEyQixFQUFFLENBQUM7UUFDNUMsSUFBSSw0QkFBNEIsR0FBRyxDQUFDLHFCQUFxQiw0Q0FBb0MsQ0FBQyxDQUFDO1FBQy9GLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUN2RCxNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFaEMsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxLQUFLLEVBQUUsTUFBTSxD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