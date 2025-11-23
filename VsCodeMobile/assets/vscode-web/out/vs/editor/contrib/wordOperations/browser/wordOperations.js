/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from '../../../../nls.js';
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from '../../../../platform/accessibility/common/accessibility.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IsWindowsContext } from '../../../../platform/contextkey/common/contextkeys.js';
import { EditorAction, EditorCommand, registerEditorAction, registerEditorCommand } from '../../../browser/editorExtensions.js';
import { ReplaceCommand } from '../../../common/commands/replaceCommand.js';
import { EditorOptions } from '../../../common/config/editorOptions.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import { Selection } from '../../../common/core/selection.js';
import { getMapForWordSeparators } from '../../../common/core/wordCharacterClassifier.js';
import { WordOperations } from '../../../common/cursor/cursorWordOperations.js';
import { CursorState } from '../../../common/cursorCommon.js';
import { EditorContextKeys } from '../../../common/editorContextKeys.js';
import { ILanguageConfigurationService } from '../../../common/languages/languageConfigurationRegistry.js';
export class MoveWordCommand extends EditorCommand {
    constructor(opts) {
        super(opts);
        this._inSelectionMode = opts.inSelectionMode;
        this._wordNavigationType = opts.wordNavigationType;
    }
    runEditorCommand(accessor, editor, args) {
        if (!editor.hasModel()) {
            return;
        }
        const wordSeparators = getMapForWordSeparators(editor.getOption(148 /* EditorOption.wordSeparators */), editor.getOption(147 /* EditorOption.wordSegmenterLocales */));
        const model = editor.getModel();
        const selections = editor.getSelections();
        const hasMulticursor = selections.length > 1;
        const result = selections.map((sel) => {
            const inPosition = new Position(sel.positionLineNumber, sel.positionColumn);
            const outPosition = this._move(wordSeparators, model, inPosition, this._wordNavigationType, hasMulticursor);
            return this._moveTo(sel, outPosition, this._inSelectionMode);
        });
        model.pushStackElement();
        editor._getViewModel().setCursorStates('moveWordCommand', 3 /* CursorChangeReason.Explicit */, result.map(r => CursorState.fromModelSelection(r)));
        if (result.length === 1) {
            const pos = new Position(result[0].positionLineNumber, result[0].positionColumn);
            editor.revealPosition(pos, 0 /* ScrollType.Smooth */);
        }
    }
    _moveTo(from, to, inSelectionMode) {
        if (inSelectionMode) {
            // move just position
            return new Selection(from.selectionStartLineNumber, from.selectionStartColumn, to.lineNumber, to.column);
        }
        else {
            // move everything
            return new Selection(to.lineNumber, to.column, to.lineNumber, to.column);
        }
    }
}
export class WordLeftCommand extends MoveWordCommand {
    _move(wordSeparators, model, position, wordNavigationType, hasMulticursor) {
        return WordOperations.moveWordLeft(wordSeparators, model, position, wordNavigationType, hasMulticursor);
    }
}
export class WordRightCommand extends MoveWordCommand {
    _move(wordSeparators, model, position, wordNavigationType, hasMulticursor) {
        return WordOperations.moveWordRight(wordSeparators, model, position, wordNavigationType);
    }
}
export class CursorWordStartLeft extends WordLeftCommand {
    constructor() {
        super({
            inSelectionMode: false,
            wordNavigationType: 0 /* WordNavigationType.WordStart */,
            id: 'cursorWordStartLeft',
            precondition: undefined
        });
    }
}
export class CursorWordEndLeft extends WordLeftCommand {
    constructor() {
        super({
            inSelectionMode: false,
            wordNavigationType: 2 /* WordNavigationType.WordEnd */,
            id: 'cursorWordEndLeft',
            precondition: undefined
        });
    }
}
export class CursorWordLeft extends WordLeftCommand {
    constructor() {
        super({
            inSelectionMode: false,
            wordNavigationType: 1 /* WordNavigationType.WordStartFast */,
            id: 'cursorWordLeft',
            precondition: undefined,
            kbOpts: {
                kbExpr: ContextKeyExpr.and(EditorContextKeys.textInputFocus, ContextKeyExpr.and(CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext)?.negate()),
                primary: 2048 /* KeyMod.CtrlCmd */ | 15 /* KeyCode.LeftArrow */,
                mac: { primary: 512 /* KeyMod.Alt */ | 15 /* KeyCode.LeftArrow */ },
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
}
export class CursorWordStartLeftSelect extends WordLeftCommand {
    constructor() {
        super({
            inSelectionMode: true,
            wordNavigationType: 0 /* WordNavigationType.WordStart */,
            id: 'cursorWordStartLeftSelect',
            precondition: undefined
        });
    }
}
export class CursorWordEndLeftSelect extends WordLeftCommand {
    constructor() {
        super({
            inSelectionMode: true,
            wordNavigationType: 2 /* WordNavigationType.WordEnd */,
            id: 'cursorWordEndLeftSelect',
            precondition: undefined
        });
    }
}
export class CursorWordLeftSelect extends WordLeftCommand {
    constructor() {
        super({
            inSelectionMode: true,
            wordNavigationType: 1 /* WordNavigationType.WordStartFast */,
            id: 'cursorWordLeftSelect',
            precondition: undefined,
            kbOpts: {
                kbExpr: ContextKeyExpr.and(EditorContextKeys.textInputFocus, ContextKeyExpr.and(CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext)?.negate()),
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 15 /* KeyCode.LeftArrow */,
                mac: { primary: 512 /* KeyMod.Alt */ | 1024 /* KeyMod.Shift */ | 15 /* KeyCode.LeftArrow */ },
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
}
// Accessibility navigation commands should only be enabled on windows since they are tuned to what NVDA expects
export class CursorWordAccessibilityLeft extends WordLeftCommand {
    constructor() {
        super({
            inSelectionMode: false,
            wordNavigationType: 3 /* WordNavigationType.WordAccessibility */,
            id: 'cursorWordAccessibilityLeft',
            precondition: undefined
        });
    }
    _move(wordCharacterClassifier, model, position, wordNavigationType, hasMulticursor) {
        return super._move(getMapForWordSeparators(EditorOptions.wordSeparators.defaultValue, wordCharacterClassifier.intlSegmenterLocales), model, position, wordNavigationType, hasMulticursor);
    }
}
export class CursorWordAccessibilityLeftSelect extends WordLeftCommand {
    constructor() {
        super({
            inSelectionMode: true,
            wordNavigationType: 3 /* WordNavigationType.WordAccessibility */,
            id: 'cursorWordAccessibilityLeftSelect',
            precondition: undefined
        });
    }
    _move(wordCharacterClassifier, model, position, wordNavigationType, hasMulticursor) {
        return super._move(getMapForWordSeparators(EditorOptions.wordSeparators.defaultValue, wordCharacterClassifier.intlSegmenterLocales), model, position, wordNavigationType, hasMulticursor);
    }
}
export class CursorWordStartRight extends WordRightCommand {
    constructor() {
        super({
            inSelectionMode: false,
            wordNavigationType: 0 /* WordNavigationType.WordStart */,
            id: 'cursorWordStartRight',
            precondition: undefined
        });
    }
}
export class CursorWordEndRight extends WordRightCommand {
    constructor() {
        super({
            inSelectionMode: false,
            wordNavigationType: 2 /* WordNavigationType.WordEnd */,
            id: 'cursorWordEndRight',
            precondition: undefined,
            kbOpts: {
                kbExpr: ContextKeyExpr.and(EditorContextKeys.textInputFocus, ContextKeyExpr.and(CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext)?.negate()),
                primary: 2048 /* KeyMod.CtrlCmd */ | 17 /* KeyCode.RightArrow */,
                mac: { primary: 512 /* KeyMod.Alt */ | 17 /* KeyCode.RightArrow */ },
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
}
export class CursorWordRight extends WordRightCommand {
    constructor() {
        super({
            inSelectionMode: false,
            wordNavigationType: 2 /* WordNavigationType.WordEnd */,
            id: 'cursorWordRight',
            precondition: undefined
        });
    }
}
export class CursorWordStartRightSelect extends WordRightCommand {
    constructor() {
        super({
            inSelectionMode: true,
            wordNavigationType: 0 /* WordNavigationType.WordStart */,
            id: 'cursorWordStartRightSelect',
            precondition: undefined
        });
    }
}
export class CursorWordEndRightSelect extends WordRightCommand {
    constructor() {
        super({
            inSelectionMode: true,
            wordNavigationType: 2 /* WordNavigationType.WordEnd */,
            id: 'cursorWordEndRightSelect',
            precondition: undefined,
            kbOpts: {
                kbExpr: ContextKeyExpr.and(EditorContextKeys.textInputFocus, ContextKeyExpr.and(CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext)?.negate()),
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 17 /* KeyCode.RightArrow */,
                mac: { primary: 512 /* KeyMod.Alt */ | 1024 /* KeyMod.Shift */ | 17 /* KeyCode.RightArrow */ },
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
}
export class CursorWordRightSelect extends WordRightCommand {
    constructor() {
        super({
            inSelectionMode: true,
            wordNavigationType: 2 /* WordNavigationType.WordEnd */,
            id: 'cursorWordRightSelect',
            precondition: undefined
        });
    }
}
export class CursorWordAccessibilityRight extends WordRightCommand {
    constructor() {
        super({
            inSelectionMode: false,
            wordNavigationType: 3 /* WordNavigationType.WordAccessibility */,
            id: 'cursorWordAccessibilityRight',
            precondition: undefined
        });
    }
    _move(wordCharacterClassifier, model, position, wordNavigationType, hasMulticursor) {
        return super._move(getMapForWordSeparators(EditorOptions.wordSeparators.defaultValue, wordCharacterClassifier.intlSegmenterLocales), model, position, wordNavigationType, hasMulticursor);
    }
}
export class CursorWordAccessibilityRightSelect extends WordRightCommand {
    constructor() {
        super({
            inSelectionMode: true,
            wordNavigationType: 3 /* WordNavigationType.WordAccessibility */,
            id: 'cursorWordAccessibilityRightSelect',
            precondition: undefined
        });
    }
    _move(wordCharacterClassifier, model, position, wordNavigationType, hasMulticursor) {
        return super._move(getMapForWordSeparators(EditorOptions.wordSeparators.defaultValue, wordCharacterClassifier.intlSegmenterLocales), model, position, wordNavigationType, hasMulticursor);
    }
}
export class DeleteWordCommand extends EditorCommand {
    constructor(opts) {
        super({ canTriggerInlineEdits: true, ...opts });
        this._whitespaceHeuristics = opts.whitespaceHeuristics;
        this._wordNavigationType = opts.wordNavigationType;
    }
    runEditorCommand(accessor, editor, args) {
        const languageConfigurationService = accessor?.get(ILanguageConfigurationService);
        if (!editor.hasModel() || !languageConfigurationService) {
            return;
        }
        const wordSeparators = getMapForWordSeparators(editor.getOption(148 /* EditorOption.wordSeparators */), editor.getOption(147 /* EditorOption.wordSegmenterLocales */));
        const model = editor.getModel();
        const selections = editor.getSelections();
        const autoClosingBrackets = editor.getOption(10 /* EditorOption.autoClosingBrackets */);
        const autoClosingQuotes = editor.getOption(15 /* EditorOption.autoClosingQuotes */);
        const autoClosingPairs = languageConfigurationService.getLanguageConfiguration(model.getLanguageId()).getAutoClosingPairs();
        const viewModel = editor._getViewModel();
        const commands = selections.map((sel) => {
            const deleteRange = this._delete({
                wordSeparators,
                model,
                selection: sel,
                whitespaceHeuristics: this._whitespaceHeuristics,
                autoClosingDelete: editor.getOption(13 /* EditorOption.autoClosingDelete */),
                autoClosingBrackets,
                autoClosingQuotes,
                autoClosingPairs,
                autoClosedCharacters: viewModel.getCursorAutoClosedCharacters(),
            }, this._wordNavigationType);
            return new ReplaceCommand(deleteRange, '');
        });
        editor.pushUndoStop();
        editor.executeCommands(this.id, commands);
        editor.pushUndoStop();
    }
}
export class DeleteWordLeftCommand extends DeleteWordCommand {
    _delete(ctx, wordNavigationType) {
        const r = WordOperations.deleteWordLeft(ctx, wordNavigationType);
        if (r) {
            return r;
        }
        return new Range(1, 1, 1, 1);
    }
}
export class DeleteWordRightCommand extends DeleteWordCommand {
    _delete(ctx, wordNavigationType) {
        const r = WordOperations.deleteWordRight(ctx, wordNavigationType);
        if (r) {
            return r;
        }
        const lineCount = ctx.model.getLineCount();
        const maxColumn = ctx.model.getLineMaxColumn(lineCount);
        return new Range(lineCount, maxColumn, lineCount, maxColumn);
    }
}
export class DeleteWordStartLeft extends DeleteWordLeftCommand {
    constructor() {
        super({
            whitespaceHeuristics: false,
            wordNavigationType: 0 /* WordNavigationType.WordStart */,
            id: 'deleteWordStartLeft',
            precondition: EditorContextKeys.writable
        });
    }
}
export class DeleteWordEndLeft extends DeleteWordLeftCommand {
    constructor() {
        super({
            whitespaceHeuristics: false,
            wordNavigationType: 2 /* WordNavigationType.WordEnd */,
            id: 'deleteWordEndLeft',
            precondition: EditorContextKeys.writable
        });
    }
}
export class DeleteWordLeft extends DeleteWordLeftCommand {
    constructor() {
        super({
            whitespaceHeuristics: true,
            wordNavigationType: 0 /* WordNavigationType.WordStart */,
            id: 'deleteWordLeft',
            precondition: EditorContextKeys.writable,
            kbOpts: {
                kbExpr: EditorContextKeys.textInputFocus,
                primary: 2048 /* KeyMod.CtrlCmd */ | 1 /* KeyCode.Backspace */,
                mac: { primary: 512 /* KeyMod.Alt */ | 1 /* KeyCode.Backspace */ },
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
}
export class DeleteWordStartRight extends DeleteWordRightCommand {
    constructor() {
        super({
            whitespaceHeuristics: false,
            wordNavigationType: 0 /* WordNavigationType.WordStart */,
            id: 'deleteWordStartRight',
            precondition: EditorContextKeys.writable
        });
    }
}
export class DeleteWordEndRight extends DeleteWordRightCommand {
    constructor() {
        super({
            whitespaceHeuristics: false,
            wordNavigationType: 2 /* WordNavigationType.WordEnd */,
            id: 'deleteWordEndRight',
            precondition: EditorContextKeys.writable
        });
    }
}
export class DeleteWordRight extends DeleteWordRightCommand {
    constructor() {
        super({
            whitespaceHeuristics: true,
            wordNavigationType: 2 /* WordNavigationType.WordEnd */,
            id: 'deleteWordRight',
            precondition: EditorContextKeys.writable,
            kbOpts: {
                kbExpr: EditorContextKeys.textInputFocus,
                primary: 2048 /* KeyMod.CtrlCmd */ | 20 /* KeyCode.Delete */,
                mac: { primary: 512 /* KeyMod.Alt */ | 20 /* KeyCode.Delete */ },
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
}
export class DeleteInsideWord extends EditorAction {
    constructor() {
        super({
            id: 'deleteInsideWord',
            precondition: EditorContextKeys.writable,
            label: nls.localize2('deleteInsideWord', "Delete Word"),
        });
    }
    run(accessor, editor, args) {
        if (!editor.hasModel()) {
            return;
        }
        const wordSeparators = getMapForWordSeparators(editor.getOption(148 /* EditorOption.wordSeparators */), editor.getOption(147 /* EditorOption.wordSegmenterLocales */));
        const model = editor.getModel();
        const selections = editor.getSelections();
        const commands = selections.map((sel) => {
            const deleteRange = WordOperations.deleteInsideWord(wordSeparators, model, sel);
            return new ReplaceCommand(deleteRange, '');
        });
        editor.pushUndoStop();
        editor.executeCommands(this.id, commands);
        editor.pushUndoStop();
    }
}
registerEditorCommand(new CursorWordStartLeft());
registerEditorCommand(new CursorWordEndLeft());
registerEditorCommand(new CursorWordLeft());
registerEditorCommand(new CursorWordStartLeftSelect());
registerEditorCommand(new CursorWordEndLeftSelect());
registerEditorCommand(new CursorWordLeftSelect());
registerEditorCommand(new CursorWordStartRight());
registerEditorCommand(new CursorWordEndRight());
registerEditorCommand(new CursorWordRight());
registerEditorCommand(new CursorWordStartRightSelect());
registerEditorCommand(new CursorWordEndRightSelect());
registerEditorCommand(new CursorWordRightSelect());
registerEditorCommand(new CursorWordAccessibilityLeft());
registerEditorCommand(new CursorWordAccessibilityLeftSelect());
registerEditorCommand(new CursorWordAccessibilityRight());
registerEditorCommand(new CursorWordAccessibilityRightSelect());
registerEditorCommand(new DeleteWordStartLeft());
registerEditorCommand(new DeleteWordEndLeft());
registerEditorCommand(new DeleteWordLeft());
registerEditorCommand(new DeleteWordStartRight());
registerEditorCommand(new DeleteWordEndRight());
registerEditorCommand(new DeleteWordRight());
registerEditorAction(DeleteInsideWord);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29yZE9wZXJhdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvd29yZE9wZXJhdGlvbnMvYnJvd3Nlci93b3JkT3BlcmF0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9CQUFvQixDQUFDO0FBQzFDLE9BQU8sRUFBRSxrQ0FBa0MsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2hILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN0RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUd6RixPQUFPLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBbUIsb0JBQW9CLEVBQUUscUJBQXFCLEVBQW9CLE1BQU0sc0NBQXNDLENBQUM7QUFDbkssT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQzVFLE9BQU8sRUFBZ0IsYUFBYSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDdEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUQsT0FBTyxFQUFFLHVCQUF1QixFQUEyQixNQUFNLGlEQUFpRCxDQUFDO0FBQ25ILE9BQU8sRUFBeUMsY0FBYyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDdkgsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRzlELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBUTNHLE1BQU0sT0FB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