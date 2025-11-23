/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Position } from './core/position.js';
import { Range } from './core/range.js';
import { Selection } from './core/selection.js';
import { createScopedLineTokens } from './languages/supports.js';
import { CursorColumns } from './core/cursorColumns.js';
import { normalizeIndentation } from './core/misc/indentation.js';
import { InputMode } from './inputMode.js';
/**
 * This is an operation type that will be recorded for undo/redo purposes.
 * The goal is to introduce an undo stop when the controller switches between different operation types.
 */
export var EditOperationType;
(function (EditOperationType) {
    EditOperationType[EditOperationType["Other"] = 0] = "Other";
    EditOperationType[EditOperationType["DeletingLeft"] = 2] = "DeletingLeft";
    EditOperationType[EditOperationType["DeletingRight"] = 3] = "DeletingRight";
    EditOperationType[EditOperationType["TypingOther"] = 4] = "TypingOther";
    EditOperationType[EditOperationType["TypingFirstSpace"] = 5] = "TypingFirstSpace";
    EditOperationType[EditOperationType["TypingConsecutiveSpace"] = 6] = "TypingConsecutiveSpace";
})(EditOperationType || (EditOperationType = {}));
const autoCloseAlways = () => true;
const autoCloseNever = () => false;
const autoCloseBeforeWhitespace = (chr) => (chr === ' ' || chr === '\t');
export class CursorConfiguration {
    static shouldRecreate(e) {
        return (e.hasChanged(165 /* EditorOption.layoutInfo */)
            || e.hasChanged(148 /* EditorOption.wordSeparators */)
            || e.hasChanged(45 /* EditorOption.emptySelectionClipboard */)
            || e.hasChanged(85 /* EditorOption.multiCursorMergeOverlapping */)
            || e.hasChanged(88 /* EditorOption.multiCursorPaste */)
            || e.hasChanged(89 /* EditorOption.multiCursorLimit */)
            || e.hasChanged(10 /* EditorOption.autoClosingBrackets */)
            || e.hasChanged(11 /* EditorOption.autoClosingComments */)
            || e.hasChanged(15 /* EditorOption.autoClosingQuotes */)
            || e.hasChanged(13 /* EditorOption.autoClosingDelete */)
            || e.hasChanged(14 /* EditorOption.autoClosingOvertype */)
            || e.hasChanged(20 /* EditorOption.autoSurround */)
            || e.hasChanged(145 /* EditorOption.useTabStops */)
            || e.hasChanged(141 /* EditorOption.trimWhitespaceOnDelete */)
            || e.hasChanged(59 /* EditorOption.fontInfo */)
            || e.hasChanged(104 /* EditorOption.readOnly */)
            || e.hasChanged(147 /* EditorOption.wordSegmenterLocales */)
            || e.hasChanged(93 /* EditorOption.overtypeOnPaste */));
    }
    constructor(languageId, modelOptions, configuration, languageConfigurationService) {
        this.languageConfigurationService = languageConfigurationService;
        this._cursorMoveConfigurationBrand = undefined;
        this._languageId = languageId;
        const options = configuration.options;
        const layoutInfo = options.get(165 /* EditorOption.layoutInfo */);
        const fontInfo = options.get(59 /* EditorOption.fontInfo */);
        this.readOnly = options.get(104 /* EditorOption.readOnly */);
        this.tabSize = modelOptions.tabSize;
        this.indentSize = modelOptions.indentSize;
        this.insertSpaces = modelOptions.insertSpaces;
        this.stickyTabStops = options.get(132 /* EditorOption.stickyTabStops */);
        this.lineHeight = fontInfo.lineHeight;
        this.typicalHalfwidthCharacterWidth = fontInfo.typicalHalfwidthCharacterWidth;
        this.pageSize = Math.max(1, Math.floor(layoutInfo.height / this.lineHeight) - 2);
        this.useTabStops = options.get(145 /* EditorOption.useTabStops */);
        this.trimWhitespaceOnDelete = options.get(141 /* EditorOption.trimWhitespaceOnDelete */);
        this.wordSeparators = options.get(148 /* EditorOption.wordSeparators */);
        this.emptySelectionClipboard = options.get(45 /* EditorOption.emptySelectionClipboard */);
        this.copyWithSyntaxHighlighting = options.get(31 /* EditorOption.copyWithSyntaxHighlighting */);
        this.multiCursorMergeOverlapping = options.get(85 /* EditorOption.multiCursorMergeOverlapping */);
        this.multiCursorPaste = options.get(88 /* EditorOption.multiCursorPaste */);
        this.multiCursorLimit = options.get(89 /* EditorOption.multiCursorLimit */);
        this.autoClosingBrackets = options.get(10 /* EditorOption.autoClosingBrackets */);
        this.autoClosingComments = options.get(11 /* EditorOption.autoClosingComments */);
        this.autoClosingQuotes = options.get(15 /* EditorOption.autoClosingQuotes */);
        this.autoClosingDelete = options.get(13 /* EditorOption.autoClosingDelete */);
        this.autoClosingOvertype = options.get(14 /* EditorOption.autoClosingOvertype */);
        this.autoSurround = options.get(20 /* EditorOption.autoSurround */);
        this.autoIndent = options.get(16 /* EditorOption.autoIndent */);
        this.wordSegmenterLocales = options.get(147 /* EditorOption.wordSegmenterLocales */);
        this.overtypeOnPaste = options.get(93 /* EditorOption.overtypeOnPaste */);
        this.surroundingPairs = {};
        this._electricChars = null;
        this.shouldAutoCloseBefore = {
            quote: this._getShouldAutoClose(languageId, this.autoClosingQuotes, true),
            comment: this._getShouldAutoClose(languageId, this.autoClosingComments, false),
            bracket: this._getShouldAutoClose(languageId, this.autoClosingBrackets, false),
        };
        this.autoClosingPairs = this.languageConfigurationService.getLanguageConfiguration(languageId).getAutoClosingPairs();
        const surroundingPairs = this.languageConfigurationService.getLanguageConfiguration(languageId).getSurroundingPairs();
        if (surroundingPairs) {
            for (const pair of surroundingPairs) {
                this.surroundingPairs[pair.open] = pair.close;
            }
        }
        const commentsConfiguration = this.languageConfigurationService.getLanguageConfiguration(languageId).comments;
        this.blockCommentStartToken = commentsConfiguration?.blockCommentStartToken ?? null;
    }
    get electricChars() {
        if (!this._electricChars) {
            this._electricChars = {};
            const electricChars = this.languageConfigurationService.getLanguageConfiguration(this._languageId).electricCharacter?.getElectricCharacters();
            if (electricChars) {
                for (const char of electricChars) {
                    this._electricChars[char] = true;
                }
            }
        }
        return this._electricChars;
    }
    get inputMode() {
        return InputMode.getInputMode();
    }
    /**
     * Should return opening bracket type to match indentation with
     */
    onElectricCharacter(character, context, column) {
        const scopedLineTokens = createScopedLineTokens(context, column - 1);
        const electricCharacterSupport = this.languageConfigurationService.getLanguageConfiguration(scopedLineTokens.languageId).electricCharacter;
        if (!electricCharacterSupport) {
            return null;
        }
        return electricCharacterSupport.onElectricCharacter(character, scopedLineTokens, column - scopedLineTokens.firstCharOffset);
    }
    normalizeIndentation(str) {
        return normalizeIndentation(str, this.indentSize, this.insertSpaces);
    }
    _getShouldAutoClose(languageId, autoCloseConfig, forQuotes) {
        switch (autoCloseConfig) {
            case 'beforeWhitespace':
                return autoCloseBeforeWhitespace;
            case 'languageDefined':
                return this._getLanguageDefinedShouldAutoClose(languageId, forQuotes);
            case 'always':
                return autoCloseAlways;
            case 'never':
                return autoCloseNever;
        }
    }
    _getLanguageDefinedShouldAutoClose(languageId, forQuotes) {
        const autoCloseBeforeSet = this.languageConfigurationService.getLanguageConfiguration(languageId).getAutoCloseBeforeSet(forQuotes);
        return c => autoCloseBeforeSet.indexOf(c) !== -1;
    }
    /**
     * Returns a visible column from a column.
     * @see {@link CursorColumns}
     */
    visibleColumnFromColumn(model, position) {
        return CursorColumns.visibleColumnFromColumn(model.getLineContent(position.lineNumber), position.column, this.tabSize);
    }
    /**
     * Returns a visible column from a column.
     * @see {@link CursorColumns}
     */
    columnFromVisibleColumn(model, lineNumber, visibleColumn) {
        const result = CursorColumns.columnFromVisibleColumn(model.getLineContent(lineNumber), visibleColumn, this.tabSize);
        const minColumn = model.getLineMinColumn(lineNumber);
        if (result < minColumn) {
            return minColumn;
        }
        const maxColumn = model.getLineMaxColumn(lineNumber);
        if (result > maxColumn) {
            return maxColumn;
        }
        return result;
    }
}
export class CursorState {
    static fromModelState(modelState) {
        return new PartialModelCursorState(modelState);
    }
    static fromViewState(viewState) {
        return new PartialViewCursorState(viewState);
    }
    static fromModelSelection(modelSelection) {
        const selection = Selection.liftSelection(modelSelection);
        const modelState = new SingleCursorState(Range.fromPositions(selection.getSelectionStart()), 0 /* SelectionStartKind.Simple */, 0, selection.getPosition(), 0);
        return CursorState.fromModelState(modelState);
    }
    static fromModelSelections(modelSelections) {
        const states = [];
        for (let i = 0, len = modelSelections.length; i < len; i++) {
            states[i] = this.fromModelSelection(modelSelections[i]);
        }
        return states;
    }
    constructor(modelState, viewState) {
        this._cursorStateBrand = undefined;
        this.modelState = modelState;
        this.viewState = viewState;
    }
    equals(other) {
        return (this.viewState.equals(other.viewState) && this.modelState.equals(other.modelState));
    }
}
export class PartialModelCursorState {
    constructor(modelState) {
        this.modelState = modelState;
        this.viewState = null;
    }
}
export class PartialViewCursorState {
    constructor(viewState) {
        this.modelState = null;
        this.viewState = viewState;
    }
}
export var SelectionStartKind;
(function (SelectionStartKind) {
    SelectionStartKind[SelectionStartKind["Simple"] = 0] = "Simple";
    SelectionStartKind[SelectionStartKind["Word"] = 1] = "Word";
    SelectionStartKind[SelectionStartKind["Line"] = 2] = "Line";
})(SelectionStartKind || (SelectionStartKind = {}));
/**
 * Represents the cursor state on either the model or on the view model.
 */
export class SingleCursorState {
    constructor(selectionStart, selectionStartKind, selectionStartLeftoverVisibleColumns, position, leftoverVisibleColumns) {
        this.selectionStart = selectionStart;
        this.selectionStartKind = selectionStartKind;
        this.selectionStartLeftoverVisibleColumns = selectionStartLeftoverVisibleColumns;
        this.position = position;
        this.leftoverVisibleColumns = leftoverVisibleColumns;
        this._singleCursorStateBrand = undefined;
        this.selection = SingleCursorState._computeSelection(this.selectionStart, this.position);
    }
    equals(other) {
        return (this.selectionStartLeftoverVisibleColumns === other.selectionStartLeftoverVisibleColumns
            && this.leftoverVisibleColumns === other.leftoverVisibleColumns
            && this.selectionStartKind === other.selectionStartKind
            && this.position.equals(other.position)
            && this.selectionStart.equalsRange(other.selectionStart));
    }
    hasSelection() {
        return (!this.selection.isEmpty() || !this.selectionStart.isEmpty());
    }
    move(inSelectionMode, lineNumber, column, leftoverVisibleColumns) {
        if (inSelectionMode) {
            // move just position
            return new SingleCursorState(this.selectionStart, this.selectionStartKind, this.selectionStartLeftoverVisibleColumns, new Position(lineNumber, column), leftoverVisibleColumns);
        }
        else {
            // move everything
            return new SingleCursorState(new Range(lineNumber, column, lineNumber, column), 0 /* SelectionStartKind.Simple */, leftoverVisibleColumns, new Position(lineNumber, column), leftoverVisibleColumns);
        }
    }
    static _computeSelection(selectionStart, position) {
        if (selectionStart.isEmpty() || !position.isBeforeOrEqual(selectionStart.getStartPosition())) {
            return Selection.fromPositions(selectionStart.getStartPosition(), position);
        }
        else {
            return Selection.fromPositions(selectionStart.getEndPosition(), position);
        }
    }
}
export class EditOperationResult {
    constructor(type, commands, opts) {
        this._editOperationResultBrand = undefined;
        this.type = type;
        this.commands = commands;
        this.shouldPushStackElementBefore = opts.shouldPushStackElementBefore;
        this.shouldPushStackElementAfter = opts.shouldPushStackElementAfter;
    }
}
export function isQuote(ch) {
    return (ch === '\'' || ch === '"' || ch === '`');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3Vyc29yQ29tbW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb21tb24vY3Vyc29yQ29tbW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBSWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDeEMsT0FBTyxFQUFjLFNBQVMsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBTTVELE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBRWpFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN4RCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNsRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFVM0M7OztHQUdHO0FBQ0gsTUFBTSxDQUFOLElBQWtCLGlCQU9qQjtBQVBELFdBQWtCLGlCQUFpQjtJQUNsQywyREFBUyxDQUFBO0lBQ1QseUVBQWdCLENBQUE7SUFDaEIsMkVBQWlCLENBQUE7SUFDakIsdUVBQWUsQ0FBQTtJQUNmLGlGQUFvQixDQUFBO0lBQ3BCLDZGQUEwQixDQUFBO0FBQzNCLENBQUMsRUFQaUIsaUJBQWlCLEtBQWpCLGlCQUFpQixRQU9sQztBQU1ELE1BQU0sZUFBZSxHQUFHLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQztBQUNuQyxNQUFNLGNBQWMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUM7QUFDbkMsTUFBTSx5QkFBeUIsR0FBRyxDQUFDLEdBQVcsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLEdBQUcsS0FBSyxJQUFJLENBQUMsQ0FBQztBQUVqRixNQUFNLE9BQU8sbUJBQW1CO0lBb0N4QixN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