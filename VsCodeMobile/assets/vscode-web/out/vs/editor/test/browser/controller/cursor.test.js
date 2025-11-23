/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { CoreEditingCommands, CoreNavigationCommands } from '../../../browser/coreCommands.js';
import { EditOperation } from '../../../common/core/editOperation.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import { Selection } from '../../../common/core/selection.js';
import { EncodedTokenizationResult, TokenizationRegistry } from '../../../common/languages.js';
import { ILanguageService } from '../../../common/languages/language.js';
import { IndentAction } from '../../../common/languages/languageConfiguration.js';
import { ILanguageConfigurationService } from '../../../common/languages/languageConfigurationRegistry.js';
import { NullState } from '../../../common/languages/nullTokenize.js';
import { TextModel } from '../../../common/model/textModel.js';
import { createCodeEditorServices, instantiateTestCodeEditor, withTestCodeEditor } from '../testCodeEditor.js';
import { createTextModel, instantiateTextModel } from '../../common/testTextModel.js';
import { InputMode } from '../../../common/inputMode.js';
import { EditSources } from '../../../common/textModelEditSource.js';
// --------- utils
function moveTo(editor, viewModel, lineNumber, column, inSelectionMode = false) {
    if (inSelectionMode) {
        CoreNavigationCommands.MoveToSelect.runCoreEditorCommand(viewModel, {
            position: new Position(lineNumber, column)
        });
    }
    else {
        CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, {
            position: new Position(lineNumber, column)
        });
    }
}
function moveLeft(editor, viewModel, inSelectionMode = false) {
    if (inSelectionMode) {
        CoreNavigationCommands.CursorLeftSelect.runCoreEditorCommand(viewModel, {});
    }
    else {
        CoreNavigationCommands.CursorLeft.runCoreEditorCommand(viewModel, {});
    }
}
function moveRight(editor, viewModel, inSelectionMode = false) {
    if (inSelectionMode) {
        CoreNavigationCommands.CursorRightSelect.runCoreEditorCommand(viewModel, {});
    }
    else {
        CoreNavigationCommands.CursorRight.runCoreEditorCommand(viewModel, {});
    }
}
function moveDown(editor, viewModel, inSelectionMode = false) {
    if (inSelectionMode) {
        CoreNavigationCommands.CursorDownSelect.runCoreEditorCommand(viewModel, {});
    }
    else {
        CoreNavigationCommands.CursorDown.runCoreEditorCommand(viewModel, {});
    }
}
function moveUp(editor, viewModel, inSelectionMode = false) {
    if (inSelectionMode) {
        CoreNavigationCommands.CursorUpSelect.runCoreEditorCommand(viewModel, {});
    }
    else {
        CoreNavigationCommands.CursorUp.runCoreEditorCommand(viewModel, {});
    }
}
function moveToBeginningOfLine(editor, viewModel, inSelectionMode = false) {
    if (inSelectionMode) {
        CoreNavigationCommands.CursorHomeSelect.runCoreEditorCommand(viewModel, {});
    }
    else {
        CoreNavigationCommands.CursorHome.runCoreEditorCommand(viewModel, {});
    }
}
function moveToEndOfLine(editor, viewModel, inSelectionMode = false) {
    if (inSelectionMode) {
        CoreNavigationCommands.CursorEndSelect.runCoreEditorCommand(viewModel, {});
    }
    else {
        CoreNavigationCommands.CursorEnd.runCoreEditorCommand(viewModel, {});
    }
}
function moveToBeginningOfBuffer(editor, viewModel, inSelectionMode = false) {
    if (inSelectionMode) {
        CoreNavigationCommands.CursorTopSelect.runCoreEditorCommand(viewModel, {});
    }
    else {
        CoreNavigationCommands.CursorTop.runCoreEditorCommand(viewModel, {});
    }
}
function moveToEndOfBuffer(editor, viewModel, inSelectionMode = false) {
    if (inSelectionMode) {
        CoreNavigationCommands.CursorBottomSelect.runCoreEditorCommand(viewModel, {});
    }
    else {
        CoreNavigationCommands.CursorBottom.runCoreEditorCommand(viewModel, {});
    }
}
function assertCursor(viewModel, what) {
    let selections;
    if (what instanceof Position) {
        selections = [new Selection(what.lineNumber, what.column, what.lineNumber, what.column)];
    }
    else if (what instanceof Selection) {
        selections = [what];
    }
    else {
        selections = what;
    }
    const actual = viewModel.getSelections().map(s => s.toString());
    const expected = selections.map(s => s.toString());
    assert.deepStrictEqual(actual, expected);
}
suite('Editor Controller - Cursor', () => {
    const LINE1 = '    \tMy First Line\t ';
    const LINE2 = '\tMy Second Line';
    const LINE3 = '    Third Line🐶';
    const LINE4 = '';
    const LINE5 = '1';
    const TEXT = LINE1 + '\r\n' +
        LINE2 + '\n' +
        LINE3 + '\n' +
        LINE4 + '\r\n' +
        LINE5;
    function runTest(callback) {
        withTestCodeEditor(TEXT, {}, (editor, viewModel) => {
            callback(editor, viewModel);
        });
    }
    ensureNoDisposablesAreLeakedInTestSuite();
    test('cursor initialized', () => {
        runTest((editor, viewModel) => {
            assertCursor(viewModel, new Position(1, 1));
        });
    });
    // --------- absolute move
    test('no move', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 1);
            assertCursor(viewModel, new Position(1, 1));
        });
    });
    test('move', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 2);
            assertCursor(viewModel, new Position(1, 2));
        });
    });
    test('move in selection mode', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 2, true);
            assertCursor(viewModel, new Selection(1, 1, 1, 2));
        });
    });
    test('move beyond line end', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 25);
            assertCursor(viewModel, new Position(1, LINE1.length + 1));
        });
    });
    test('move empty line', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 4, 20);
            assertCursor(viewModel, new Position(4, 1));
        });
    });
    test('move one char line', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 5, 20);
            assertCursor(viewModel, new Position(5, 2));
        });
    });
    test('selection down', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 2, 1, true);
            assertCursor(viewModel, new Selection(1, 1, 2, 1));
        });
    });
    test('move and then select', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 2, 3);
            assertCursor(viewModel, new Position(2, 3));
            moveTo(editor, viewModel, 2, 15, true);
            assertCursor(viewModel, new Selection(2, 3, 2, 15));
            moveTo(editor, viewModel, 1, 2, true);
            assertCursor(viewModel, new Selection(2, 3, 1, 2));
        });
    });
    // --------- move left
    test('move left on top left position', () => {
        runTest((editor, viewModel) => {
            moveLeft(editor, viewModel);
            assertCursor(viewModel, new Position(1, 1));
        });
    });
    test('move left', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 3);
            assertCursor(viewModel, new Position(1, 3));
            moveLeft(editor, viewModel);
            assertCursor(viewModel, new Position(1, 2));
        });
    });
    test('move left with surrogate pair', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 3, 17);
            assertCursor(viewModel, new Position(3, 17));
            moveLeft(editor, viewModel);
            assertCursor(viewModel, new Position(3, 15));
        });
    });
    test('move left goes to previous row', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 2, 1);
            assertCursor(viewModel, new Position(2, 1));
            moveLeft(editor, viewModel);
            assertCursor(viewModel, new Position(1, 21));
        });
    });
    test('move left selection', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 2, 1);
            assertCursor(viewModel, new Position(2, 1));
            moveLeft(editor, viewModel, true);
            assertCursor(viewModel, new Selection(2, 1, 1, 21));
        });
    });
    // --------- move right
    test('move right on bottom right position', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 5, 2);
            assertCursor(viewModel, new Position(5, 2));
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Position(5, 2));
        });
    });
    test('move right', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 3);
            assertCursor(viewModel, new Position(1, 3));
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Position(1, 4));
        });
    });
    test('move right with surrogate pair', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 3, 15);
            assertCursor(viewModel, new Position(3, 15));
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Position(3, 17));
        });
    });
    test('move right goes to next row', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 21);
            assertCursor(viewModel, new Position(1, 21));
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Position(2, 1));
        });
    });
    test('move right selection', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 21);
            assertCursor(viewModel, new Position(1, 21));
            moveRight(editor, viewModel, true);
            assertCursor(viewModel, new Selection(1, 21, 2, 1));
        });
    });
    // --------- move down
    test('move down', () => {
        runTest((editor, viewModel) => {
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(2, 1));
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(3, 1));
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(4, 1));
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(5, 1));
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(5, 2));
        });
    });
    test('move down with selection', () => {
        runTest((editor, viewModel) => {
            moveDown(editor, viewModel, true);
            assertCursor(viewModel, new Selection(1, 1, 2, 1));
            moveDown(editor, viewModel, true);
            assertCursor(viewModel, new Selection(1, 1, 3, 1));
            moveDown(editor, viewModel, true);
            assertCursor(viewModel, new Selection(1, 1, 4, 1));
            moveDown(editor, viewModel, true);
            assertCursor(viewModel, new Selection(1, 1, 5, 1));
            moveDown(editor, viewModel, true);
            assertCursor(viewModel, new Selection(1, 1, 5, 2));
        });
    });
    test('move down with tabs', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 5);
            assertCursor(viewModel, new Position(1, 5));
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(2, 2));
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(3, 5));
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(4, 1));
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(5, 2));
        });
    });
    // --------- move up
    test('move up', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 3, 5);
            assertCursor(viewModel, new Position(3, 5));
            moveUp(editor, viewModel);
            assertCursor(viewModel, new Position(2, 2));
            moveUp(editor, viewModel);
            assertCursor(viewModel, new Position(1, 5));
        });
    });
    test('move up with selection', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 3, 5);
            assertCursor(viewModel, new Position(3, 5));
            moveUp(editor, viewModel, true);
            assertCursor(viewModel, new Selection(3, 5, 2, 2));
            moveUp(editor, viewModel, true);
            assertCursor(viewModel, new Selection(3, 5, 1, 5));
        });
    });
    test('move up and down with tabs', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 5);
            assertCursor(viewModel, new Position(1, 5));
            moveDown(editor, viewModel);
            moveDown(editor, viewModel);
            moveDown(editor, viewModel);
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(5, 2));
            moveUp(editor, viewModel);
            assertCursor(viewModel, new Position(4, 1));
            moveUp(editor, viewModel);
            assertCursor(viewModel, new Position(3, 5));
            moveUp(editor, viewModel);
            assertCursor(viewModel, new Position(2, 2));
            moveUp(editor, viewModel);
            assertCursor(viewModel, new Position(1, 5));
        });
    });
    test('move up and down with end of lines starting from a long one', () => {
        runTest((editor, viewModel) => {
            moveToEndOfLine(editor, viewModel);
            assertCursor(viewModel, new Position(1, LINE1.length + 1));
            moveToEndOfLine(editor, viewModel);
            assertCursor(viewModel, new Position(1, LINE1.length + 1));
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(2, LINE2.length + 1));
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(3, LINE3.length + 1));
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(4, LINE4.length + 1));
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(5, LINE5.length + 1));
            moveUp(editor, viewModel);
            moveUp(editor, viewModel);
            moveUp(editor, viewModel);
            moveUp(editor, viewModel);
            assertCursor(viewModel, new Position(1, LINE1.length + 1));
        });
    });
    test('issue #44465: cursor position not correct when move', () => {
        runTest((editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 5, 1, 5)]);
            // going once up on the first line remembers the offset visual columns
            moveUp(editor, viewModel);
            assertCursor(viewModel, new Position(1, 1));
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(2, 2));
            moveUp(editor, viewModel);
            assertCursor(viewModel, new Position(1, 5));
            // going twice up on the first line discards the offset visual columns
            moveUp(editor, viewModel);
            assertCursor(viewModel, new Position(1, 1));
            moveUp(editor, viewModel);
            assertCursor(viewModel, new Position(1, 1));
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(2, 1));
        });
    });
    test('issue #144041: Cursor up/down works', () => {
        const model = createTextModel([
            'Word1 Word2 Word3 Word4',
            'Word5 Word6 Word7 Word8',
        ].join('\n'));
        withTestCodeEditor(model, { wrappingIndent: 'indent', wordWrap: 'wordWrapColumn', wordWrapColumn: 20 }, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 1, 1, 1)]);
            const cursorPositions = [];
            function reportCursorPosition() {
                cursorPositions.push(viewModel.getCursorStates()[0].viewState.position.toString());
            }
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorDown, null);
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorDown, null);
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorDown, null);
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorDown, null);
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorUp, null);
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorUp, null);
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorUp, null);
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorUp, null);
            reportCursorPosition();
            assert.deepStrictEqual(cursorPositions, [
                '(1,1)',
                '(2,5)',
                '(3,1)',
                '(4,5)',
                '(4,10)',
                '(3,1)',
                '(2,5)',
                '(1,1)',
                '(1,1)',
            ]);
        });
        model.dispose();
    });
    test('issue #140195: Cursor up/down makes progress', () => {
        const model = createTextModel([
            'Word1 Word2 Word3 Word4',
            'Word5 Word6 Word7 Word8',
        ].join('\n'));
        withTestCodeEditor(model, { wrappingIndent: 'indent', wordWrap: 'wordWrapColumn', wordWrapColumn: 20 }, (editor, viewModel) => {
            editor.changeDecorations((changeAccessor) => {
                changeAccessor.deltaDecorations([], [
                    {
                        range: new Range(1, 22, 1, 22),
                        options: {
                            showIfCollapsed: true,
                            description: 'test',
                            after: {
                                content: 'some very very very very very very very very long text',
                            }
                        }
                    }
                ]);
            });
            viewModel.setSelections('test', [new Selection(1, 1, 1, 1)]);
            const cursorPositions = [];
            function reportCursorPosition() {
                cursorPositions.push(viewModel.getCursorStates()[0].viewState.position.toString());
            }
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorDown, null);
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorDown, null);
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorDown, null);
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorDown, null);
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorUp, null);
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorUp, null);
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorUp, null);
            reportCursorPosition();
            editor.runCommand(CoreNavigationCommands.CursorUp, null);
            reportCursorPosition();
            assert.deepStrictEqual(cursorPositions, [
                '(1,1)',
                '(2,5)',
                '(5,19)',
                '(6,1)',
                '(7,5)',
                '(6,1)',
                '(2,8)',
                '(1,1)',
                '(1,1)',
            ]);
        });
        model.dispose();
    });
    // --------- move to beginning of line
    test('move to beginning of line', () => {
        runTest((editor, viewModel) => {
            moveToBeginningOfLine(editor, viewModel);
            assertCursor(viewModel, new Position(1, 6));
            moveToBeginningOfLine(editor, viewModel);
            assertCursor(viewModel, new Position(1, 1));
        });
    });
    test('move to beginning of line from within line', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 8);
            moveToBeginningOfLine(editor, viewModel);
            assertCursor(viewModel, new Position(1, 6));
            moveToBeginningOfLine(editor, viewModel);
            assertCursor(viewModel, new Position(1, 1));
        });
    });
    test('move to beginning of line from whitespace at beginning of line', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 2);
            moveToBeginningOfLine(editor, viewModel);
            assertCursor(viewModel, new Position(1, 6));
            moveToBeginningOfLine(editor, viewModel);
            assertCursor(viewModel, new Position(1, 1));
        });
    });
    test('move to beginning of line from within line selection', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 8);
            moveToBeginningOfLine(editor, viewModel, true);
            assertCursor(viewModel, new Selection(1, 8, 1, 6));
            moveToBeginningOfLine(editor, viewModel, true);
            assertCursor(viewModel, new Selection(1, 8, 1, 1));
        });
    });
    test('move to beginning of line with selection multiline forward', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 8);
            moveTo(editor, viewModel, 3, 9, true);
            moveToBeginningOfLine(editor, viewModel, false);
            assertCursor(viewModel, new Selection(3, 5, 3, 5));
        });
    });
    test('move to beginning of line with selection multiline backward', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 3, 9);
            moveTo(editor, viewModel, 1, 8, true);
            moveToBeginningOfLine(editor, viewModel, false);
            assertCursor(viewModel, new Selection(1, 6, 1, 6));
        });
    });
    test('move to beginning of line with selection single line forward', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 3, 2);
            moveTo(editor, viewModel, 3, 9, true);
            moveToBeginningOfLine(editor, viewModel, false);
            assertCursor(viewModel, new Selection(3, 5, 3, 5));
        });
    });
    test('move to beginning of line with selection single line backward', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 3, 9);
            moveTo(editor, viewModel, 3, 2, true);
            moveToBeginningOfLine(editor, viewModel, false);
            assertCursor(viewModel, new Selection(3, 5, 3, 5));
        });
    });
    test('issue #15401: "End" key is behaving weird when text is selected part 1', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 8);
            moveTo(editor, viewModel, 3, 9, true);
            moveToBeginningOfLine(editor, viewModel, false);
            assertCursor(viewModel, new Selection(3, 5, 3, 5));
        });
    });
    test('issue #17011: Shift+home/end now go to the end of the selection start\'s line, not the selection\'s end', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 8);
            moveTo(editor, viewModel, 3, 9, true);
            moveToBeginningOfLine(editor, viewModel, true);
            assertCursor(viewModel, new Selection(1, 8, 3, 5));
        });
    });
    // --------- move to end of line
    test('move to end of line', () => {
        runTest((editor, viewModel) => {
            moveToEndOfLine(editor, viewModel);
            assertCursor(viewModel, new Position(1, LINE1.length + 1));
            moveToEndOfLine(editor, viewModel);
            assertCursor(viewModel, new Position(1, LINE1.length + 1));
        });
    });
    test('move to end of line from within line', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 6);
            moveToEndOfLine(editor, viewModel);
            assertCursor(viewModel, new Position(1, LINE1.length + 1));
            moveToEndOfLine(editor, viewModel);
            assertCursor(viewModel, new Position(1, LINE1.length + 1));
        });
    });
    test('move to end of line from whitespace at end of line', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 20);
            moveToEndOfLine(editor, viewModel);
            assertCursor(viewModel, new Position(1, LINE1.length + 1));
            moveToEndOfLine(editor, viewModel);
            assertCursor(viewModel, new Position(1, LINE1.length + 1));
        });
    });
    test('move to end of line from within line selection', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 6);
            moveToEndOfLine(editor, viewModel, true);
            assertCursor(viewModel, new Selection(1, 6, 1, LINE1.length + 1));
            moveToEndOfLine(editor, viewModel, true);
            assertCursor(viewModel, new Selection(1, 6, 1, LINE1.length + 1));
        });
    });
    test('move to end of line with selection multiline forward', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 1);
            moveTo(editor, viewModel, 3, 9, true);
            moveToEndOfLine(editor, viewModel, false);
            assertCursor(viewModel, new Selection(3, 17, 3, 17));
        });
    });
    test('move to end of line with selection multiline backward', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 3, 9);
            moveTo(editor, viewModel, 1, 1, true);
            moveToEndOfLine(editor, viewModel, false);
            assertCursor(viewModel, new Selection(1, 21, 1, 21));
        });
    });
    test('move to end of line with selection single line forward', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 3, 1);
            moveTo(editor, viewModel, 3, 9, true);
            moveToEndOfLine(editor, viewModel, false);
            assertCursor(viewModel, new Selection(3, 17, 3, 17));
        });
    });
    test('move to end of line with selection single line backward', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 3, 9);
            moveTo(editor, viewModel, 3, 1, true);
            moveToEndOfLine(editor, viewModel, false);
            assertCursor(viewModel, new Selection(3, 17, 3, 17));
        });
    });
    test('issue #15401: "End" key is behaving weird when text is selected part 2', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 1);
            moveTo(editor, viewModel, 3, 9, true);
            moveToEndOfLine(editor, viewModel, false);
            assertCursor(viewModel, new Selection(3, 17, 3, 17));
        });
    });
    // --------- move to beginning of buffer
    test('move to beginning of buffer', () => {
        runTest((editor, viewModel) => {
            moveToBeginningOfBuffer(editor, viewModel);
            assertCursor(viewModel, new Position(1, 1));
        });
    });
    test('move to beginning of buffer from within first line', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 3);
            moveToBeginningOfBuffer(editor, viewModel);
            assertCursor(viewModel, new Position(1, 1));
        });
    });
    test('move to beginning of buffer from within another line', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 3, 3);
            moveToBeginningOfBuffer(editor, viewModel);
            assertCursor(viewModel, new Position(1, 1));
        });
    });
    test('move to beginning of buffer from within first line selection', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 1, 3);
            moveToBeginningOfBuffer(editor, viewModel, true);
            assertCursor(viewModel, new Selection(1, 3, 1, 1));
        });
    });
    test('move to beginning of buffer from within another line selection', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 3, 3);
            moveToBeginningOfBuffer(editor, viewModel, true);
            assertCursor(viewModel, new Selection(3, 3, 1, 1));
        });
    });
    // --------- move to end of buffer
    test('move to end of buffer', () => {
        runTest((editor, viewModel) => {
            moveToEndOfBuffer(editor, viewModel);
            assertCursor(viewModel, new Position(5, LINE5.length + 1));
        });
    });
    test('move to end of buffer from within last line', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 5, 1);
            moveToEndOfBuffer(editor, viewModel);
            assertCursor(viewModel, new Position(5, LINE5.length + 1));
        });
    });
    test('move to end of buffer from within another line', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 3, 3);
            moveToEndOfBuffer(editor, viewModel);
            assertCursor(viewModel, new Position(5, LINE5.length + 1));
        });
    });
    test('move to end of buffer from within last line selection', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 5, 1);
            moveToEndOfBuffer(editor, viewModel, true);
            assertCursor(viewModel, new Selection(5, 1, 5, LINE5.length + 1));
        });
    });
    test('move to end of buffer from within another line selection', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 3, 3);
            moveToEndOfBuffer(editor, viewModel, true);
            assertCursor(viewModel, new Selection(3, 3, 5, LINE5.length + 1));
        });
    });
    // --------- misc
    test('select all', () => {
        runTest((editor, viewModel) => {
            CoreNavigationCommands.SelectAll.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, new Selection(1, 1, 5, LINE5.length + 1));
        });
    });
    // --------- eventing
    test('no move doesn\'t trigger event', () => {
        runTest((editor, viewModel) => {
            const disposable = viewModel.onEvent((e) => {
                assert.ok(false, 'was not expecting event');
            });
            moveTo(editor, viewModel, 1, 1);
            disposable.dispose();
        });
    });
    test('move eventing', () => {
        runTest((editor, viewModel) => {
            let events = 0;
            const disposable = viewModel.onEvent((e) => {
                if (e.kind === 7 /* OutgoingViewModelEventKind.CursorStateChanged */) {
                    events++;
                    assert.deepStrictEqual(e.selections, [new Selection(1, 2, 1, 2)]);
                }
            });
            moveTo(editor, viewModel, 1, 2);
            assert.strictEqual(events, 1, 'receives 1 event');
            disposable.dispose();
        });
    });
    test('move in selection mode eventing', () => {
        runTest((editor, viewModel) => {
            let events = 0;
            const disposable = viewModel.onEvent((e) => {
                if (e.kind === 7 /* OutgoingViewModelEventKind.CursorStateChanged */) {
                    events++;
                    assert.deepStrictEqual(e.selections, [new Selection(1, 1, 1, 2)]);
                }
            });
            moveTo(editor, viewModel, 1, 2, true);
            assert.strictEqual(events, 1, 'receives 1 event');
            disposable.dispose();
        });
    });
    // --------- state save & restore
    test('saveState & restoreState', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 2, 1, true);
            assertCursor(viewModel, new Selection(1, 1, 2, 1));
            const savedState = JSON.stringify(viewModel.saveCursorState());
            moveTo(editor, viewModel, 1, 1, false);
            assertCursor(viewModel, new Position(1, 1));
            viewModel.restoreCursorState(JSON.parse(savedState));
            assertCursor(viewModel, new Selection(1, 1, 2, 1));
        });
    });
    // --------- updating cursor
    test('Independent model edit 1', () => {
        runTest((editor, viewModel) => {
            moveTo(editor, viewModel, 2, 16, true);
            editor.getModel().applyEdits([EditOperation.delete(new Range(2, 1, 2, 2))]);
            assertCursor(viewModel, new Selection(1, 1, 2, 15));
        });
    });
    test('column select 1', () => {
        withTestCodeEditor([
            '\tprivate compute(a:number): boolean {',
            '\t\tif (a + 3 === 0 || a + 5 === 0) {',
            '\t\t\treturn false;',
            '\t\t}',
            '\t}'
        ], {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 1, 7, false);
            assertCursor(viewModel, new Position(1, 7));
            CoreNavigationCommands.ColumnSelect.runCoreEditorCommand(viewModel, {
                position: new Position(4, 4),
                viewPosition: new Position(4, 4),
                mouseColumn: 15,
                doColumnSelect: true
            });
            const expectedSelections = [
                new Selection(1, 7, 1, 12),
                new Selection(2, 4, 2, 9),
                new Selection(3, 3, 3, 6),
                new Selection(4, 4, 4, 4),
            ];
            assertCursor(viewModel, expectedSelections);
        });
    });
    test('grapheme breaking', () => {
        withTestCodeEditor([
            'abcabc',
            'ãããããã',
            '辻󠄀辻󠄀辻󠄀',
            'பு',
        ], {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(2, 1, 2, 1)]);
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Position(2, 3));
            moveLeft(editor, viewModel);
            assertCursor(viewModel, new Position(2, 1));
            viewModel.setSelections('test', [new Selection(3, 1, 3, 1)]);
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Position(3, 4));
            moveLeft(editor, viewModel);
            assertCursor(viewModel, new Position(3, 1));
            viewModel.setSelections('test', [new Selection(4, 1, 4, 1)]);
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Position(4, 3));
            moveLeft(editor, viewModel);
            assertCursor(viewModel, new Position(4, 1));
            viewModel.setSelections('test', [new Selection(1, 3, 1, 3)]);
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(2, 5));
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Position(3, 4));
            moveUp(editor, viewModel);
            assertCursor(viewModel, new Position(2, 5));
            moveUp(editor, viewModel);
            assertCursor(viewModel, new Position(1, 3));
        });
    });
    test('issue #4905 - column select is biased to the right', () => {
        withTestCodeEditor([
            'var gulp = require("gulp");',
            'var path = require("path");',
            'var rimraf = require("rimraf");',
            'var isarray = require("isarray");',
            'var merge = require("merge-stream");',
            'var concat = require("gulp-concat");',
            'var newer = require("gulp-newer");',
        ].join('\n'), {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 1, 4, false);
            assertCursor(viewModel, new Position(1, 4));
            CoreNavigationCommands.ColumnSelect.runCoreEditorCommand(viewModel, {
                position: new Position(4, 1),
                viewPosition: new Position(4, 1),
                mouseColumn: 1,
                doColumnSelect: true
            });
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 1),
                new Selection(2, 4, 2, 1),
                new Selection(3, 4, 3, 1),
                new Selection(4, 4, 4, 1),
            ]);
        });
    });
    test('issue #20087: column select with mouse', () => {
        withTestCodeEditor([
            '<property id="SomeThing" key="SomeKey" value="000"/>',
            '<property id="SomeThing" key="SomeKey" value="000"/>',
            '<property id="SomeThing" Key="SomeKey" value="000"/>',
            '<property id="SomeThing" key="SomeKey" value="000"/>',
            '<property id="SomeThing" key="SoMEKEy" value="000"/>',
            '<property id="SomeThing" key="SomeKey" value="000"/>',
            '<property id="SomeThing" key="SomeKey" value="000"/>',
            '<property id="SomeThing" key="SomeKey" valuE="000"/>',
            '<property id="SomeThing" key="SomeKey" value="000"/>',
            '<property id="SomeThing" key="SomeKey" value="00X"/>',
        ].join('\n'), {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 10, 10, false);
            assertCursor(viewModel, new Position(10, 10));
            CoreNavigationCommands.ColumnSelect.runCoreEditorCommand(viewModel, {
                position: new Position(1, 1),
                viewPosition: new Position(1, 1),
                mouseColumn: 1,
                doColumnSelect: true
            });
            assertCursor(viewModel, [
                new Selection(10, 10, 10, 1),
                new Selection(9, 10, 9, 1),
                new Selection(8, 10, 8, 1),
                new Selection(7, 10, 7, 1),
                new Selection(6, 10, 6, 1),
                new Selection(5, 10, 5, 1),
                new Selection(4, 10, 4, 1),
                new Selection(3, 10, 3, 1),
                new Selection(2, 10, 2, 1),
                new Selection(1, 10, 1, 1),
            ]);
            CoreNavigationCommands.ColumnSelect.runCoreEditorCommand(viewModel, {
                position: new Position(1, 1),
                viewPosition: new Position(1, 1),
                mouseColumn: 1,
                doColumnSelect: true
            });
            assertCursor(viewModel, [
                new Selection(10, 10, 10, 1),
                new Selection(9, 10, 9, 1),
                new Selection(8, 10, 8, 1),
                new Selection(7, 10, 7, 1),
                new Selection(6, 10, 6, 1),
                new Selection(5, 10, 5, 1),
                new Selection(4, 10, 4, 1),
                new Selection(3, 10, 3, 1),
                new Selection(2, 10, 2, 1),
                new Selection(1, 10, 1, 1),
            ]);
        });
    });
    test('issue #20087: column select with keyboard', () => {
        withTestCodeEditor([
            '<property id="SomeThing" key="SomeKey" value="000"/>',
            '<property id="SomeThing" key="SomeKey" value="000"/>',
            '<property id="SomeThing" Key="SomeKey" value="000"/>',
            '<property id="SomeThing" key="SomeKey" value="000"/>',
            '<property id="SomeThing" key="SoMEKEy" value="000"/>',
            '<property id="SomeThing" key="SomeKey" value="000"/>',
            '<property id="SomeThing" key="SomeKey" value="000"/>',
            '<property id="SomeThing" key="SomeKey" valuE="000"/>',
            '<property id="SomeThing" key="SomeKey" value="000"/>',
            '<property id="SomeThing" key="SomeKey" value="00X"/>',
        ].join('\n'), {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 10, 10, false);
            assertCursor(viewModel, new Position(10, 10));
            CoreNavigationCommands.CursorColumnSelectLeft.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(10, 10, 10, 9)
            ]);
            CoreNavigationCommands.CursorColumnSelectLeft.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(10, 10, 10, 8)
            ]);
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(10, 10, 10, 9)
            ]);
            CoreNavigationCommands.CursorColumnSelectUp.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(10, 10, 10, 9),
                new Selection(9, 10, 9, 9),
            ]);
            CoreNavigationCommands.CursorColumnSelectDown.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(10, 10, 10, 9)
            ]);
        });
    });
    test('issue #118062: Column selection cannot select first position of a line', () => {
        withTestCodeEditor([
            'hello world',
        ].join('\n'), {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 1, 2, false);
            assertCursor(viewModel, new Position(1, 2));
            CoreNavigationCommands.CursorColumnSelectLeft.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 2, 1, 1)
            ]);
        });
    });
    test('column select with keyboard', () => {
        withTestCodeEditor([
            'var gulp = require("gulp");',
            'var path = require("path");',
            'var rimraf = require("rimraf");',
            'var isarray = require("isarray");',
            'var merge = require("merge-stream");',
            'var concat = require("gulp-concat");',
            'var newer = require("gulp-newer");',
        ].join('\n'), {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 1, 4, false);
            assertCursor(viewModel, new Position(1, 4));
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 5)
            ]);
            CoreNavigationCommands.CursorColumnSelectDown.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 5),
                new Selection(2, 4, 2, 5)
            ]);
            CoreNavigationCommands.CursorColumnSelectDown.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 5),
                new Selection(2, 4, 2, 5),
                new Selection(3, 4, 3, 5),
            ]);
            CoreNavigationCommands.CursorColumnSelectDown.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectDown.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectDown.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectDown.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 5),
                new Selection(2, 4, 2, 5),
                new Selection(3, 4, 3, 5),
                new Selection(4, 4, 4, 5),
                new Selection(5, 4, 5, 5),
                new Selection(6, 4, 6, 5),
                new Selection(7, 4, 7, 5),
            ]);
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 6),
                new Selection(2, 4, 2, 6),
                new Selection(3, 4, 3, 6),
                new Selection(4, 4, 4, 6),
                new Selection(5, 4, 5, 6),
                new Selection(6, 4, 6, 6),
                new Selection(7, 4, 7, 6),
            ]);
            // 10 times
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 16),
                new Selection(2, 4, 2, 16),
                new Selection(3, 4, 3, 16),
                new Selection(4, 4, 4, 16),
                new Selection(5, 4, 5, 16),
                new Selection(6, 4, 6, 16),
                new Selection(7, 4, 7, 16),
            ]);
            // 10 times
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 26),
                new Selection(2, 4, 2, 26),
                new Selection(3, 4, 3, 26),
                new Selection(4, 4, 4, 26),
                new Selection(5, 4, 5, 26),
                new Selection(6, 4, 6, 26),
                new Selection(7, 4, 7, 26),
            ]);
            // 2 times => reaching the ending of lines 1 and 2
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 28),
                new Selection(2, 4, 2, 28),
                new Selection(3, 4, 3, 28),
                new Selection(4, 4, 4, 28),
                new Selection(5, 4, 5, 28),
                new Selection(6, 4, 6, 28),
                new Selection(7, 4, 7, 28),
            ]);
            // 4 times => reaching the ending of line 3
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 28),
                new Selection(2, 4, 2, 28),
                new Selection(3, 4, 3, 32),
                new Selection(4, 4, 4, 32),
                new Selection(5, 4, 5, 32),
                new Selection(6, 4, 6, 32),
                new Selection(7, 4, 7, 32),
            ]);
            // 2 times => reaching the ending of line 4
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 28),
                new Selection(2, 4, 2, 28),
                new Selection(3, 4, 3, 32),
                new Selection(4, 4, 4, 34),
                new Selection(5, 4, 5, 34),
                new Selection(6, 4, 6, 34),
                new Selection(7, 4, 7, 34),
            ]);
            // 1 time => reaching the ending of line 7
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 28),
                new Selection(2, 4, 2, 28),
                new Selection(3, 4, 3, 32),
                new Selection(4, 4, 4, 34),
                new Selection(5, 4, 5, 35),
                new Selection(6, 4, 6, 35),
                new Selection(7, 4, 7, 35),
            ]);
            // 3 times => reaching the ending of lines 5 & 6
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 28),
                new Selection(2, 4, 2, 28),
                new Selection(3, 4, 3, 32),
                new Selection(4, 4, 4, 34),
                new Selection(5, 4, 5, 37),
                new Selection(6, 4, 6, 37),
                new Selection(7, 4, 7, 35),
            ]);
            // cannot go anywhere anymore
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 28),
                new Selection(2, 4, 2, 28),
                new Selection(3, 4, 3, 32),
                new Selection(4, 4, 4, 34),
                new Selection(5, 4, 5, 37),
                new Selection(6, 4, 6, 37),
                new Selection(7, 4, 7, 35),
            ]);
            // cannot go anywhere anymore even if we insist
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            CoreNavigationCommands.CursorColumnSelectRight.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 28),
                new Selection(2, 4, 2, 28),
                new Selection(3, 4, 3, 32),
                new Selection(4, 4, 4, 34),
                new Selection(5, 4, 5, 37),
                new Selection(6, 4, 6, 37),
                new Selection(7, 4, 7, 35),
            ]);
            // can easily go back
            CoreNavigationCommands.CursorColumnSelectLeft.runCoreEditorCommand(viewModel, {});
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 28),
                new Selection(2, 4, 2, 28),
                new Selection(3, 4, 3, 32),
                new Selection(4, 4, 4, 34),
                new Selection(5, 4, 5, 36),
                new Selection(6, 4, 6, 36),
                new Selection(7, 4, 7, 35),
            ]);
        });
    });
    test('setSelection / setPosition with source', () => {
        const tokenizationSupport = {
            getInitialState: () => NullState,
            tokenize: undefined,
            tokenizeEncoded: (line, hasEOL, state) => {
                return new EncodedTokenizationResult(new Uint32Array(0), state);
            }
        };
        const LANGUAGE_ID = 'modelModeTest1';
        const languageRegistration = TokenizationRegistry.register(LANGUAGE_ID, tokenizationSupport);
        const model = createTextModel('Just text', LANGUAGE_ID);
        withTestCodeEditor(model, {}, (editor1, cursor1) => {
            let event = undefined;
            const disposable = editor1.onDidChangeCursorPosition(e => {
                event = e;
            });
            editor1.setSelection(new Range(1, 2, 1, 3), 'navigation');
            assert.strictEqual(event.source, 'navigation');
            event = undefined;
            editor1.setPosition(new Position(1, 2), 'navigation');
            assert.strictEqual(event.source, 'navigation');
            disposable.dispose();
        });
        languageRegistration.dispose();
        model.dispose();
    });
});
suite('Editor Controller', () => {
    const surroundingLanguageId = 'surroundingLanguage';
    const indentRulesLanguageId = 'indentRulesLanguage';
    const electricCharLanguageId = 'electricCharLanguage';
    const autoClosingLanguageId = 'autoClosingLanguage';
    const emptyClosingSurroundLanguageId = 'emptyClosingSurroundLanguage';
    let disposables;
    let instantiationService;
    let languageConfigurationService;
    let languageService;
    setup(() => {
        disposables = new DisposableStore();
        instantiationService = createCodeEditorServices(disposables);
        languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
        languageService = instantiationService.get(ILanguageService);
        disposables.add(languageService.registerLanguage({ id: surroundingLanguageId }));
        disposables.add(languageConfigurationService.register(surroundingLanguageId, {
            autoClosingPairs: [{ open: '(', close: ')' }]
        }));
        disposables.add(languageService.registerLanguage({ id: emptyClosingSurroundLanguageId }));
        disposables.add(languageConfigurationService.register(emptyClosingSurroundLanguageId, {
            surroundingPairs: [{ open: '<', close: '' }]
        }));
        setupIndentRulesLanguage(indentRulesLanguageId, {
            decreaseIndentPattern: /^\s*((?!\S.*\/[*]).*[*]\/\s*)?[})\]]|^\s*(case\b.*|default):\s*(\/\/.*|\/[*].*[*]\/\s*)?$/,
            increaseIndentPattern: /^((?!\/\/).)*(\{[^}"'`]*|\([^)"']*|\[[^\]"']*|^\s*(\{\}|\(\)|\[\]|(case\b.*|default):))\s*(\/\/.*|\/[*].*[*]\/\s*)?$/,
            indentNextLinePattern: /^\s*(for|while|if|else)\b(?!.*[;{}]\s*(\/\/.*|\/[*].*[*]\/\s*)?$)/,
            unIndentedLinePattern: /^(?!.*([;{}]|\S:)\s*(\/\/.*|\/[*].*[*]\/\s*)?$)(?!.*(\{[^}"']*|\([^)"']*|\[[^\]"']*|^\s*(\{\}|\(\)|\[\]|(case\b.*|default):))\s*(\/\/.*|\/[*].*[*]\/\s*)?$)(?!^\s*((?!\S.*\/[*]).*[*]\/\s*)?[})\]]|^\s*(case\b.*|default):\s*(\/\/.*|\/[*].*[*]\/\s*)?$)(?!^\s*(for|while|if|else)\b(?!.*[;{}]\s*(\/\/.*|\/[*].*[*]\/\s*)?$))/
        });
        disposables.add(languageService.registerLanguage({ id: electricCharLanguageId }));
        disposables.add(languageConfigurationService.register(electricCharLanguageId, {
            __electricCharacterSupport: {
                docComment: { open: '/**', close: ' */' }
            },
            brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')']
            ]
        }));
        setupAutoClosingLanguage();
    });
    teardown(() => {
        disposables.dispose();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    function setupOnEnterLanguage(indentAction) {
        const onEnterLanguageId = 'onEnterMode';
        disposables.add(languageService.registerLanguage({ id: onEnterLanguageId }));
        disposables.add(languageConfigurationService.register(onEnterLanguageId, {
            onEnterRules: [{
                    beforeText: /.*/,
                    action: {
                        indentAction: indentAction
                    }
                }]
        }));
        return onEnterLanguageId;
    }
    function setupIndentRulesLanguage(languageId, indentationRules) {
        disposables.add(languageService.registerLanguage({ id: languageId }));
        disposables.add(languageConfigurationService.register(languageId, {
            indentationRules: indentationRules
        }));
        return languageId;
    }
    function setupAutoClosingLanguage() {
        disposables.add(languageService.registerLanguage({ id: autoClosingLanguageId }));
        disposables.add(languageConfigurationService.register(autoClosingLanguageId, {
            comments: {
                blockComment: ['/*', '*/']
            },
            autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '\'', close: '\'', notIn: ['string', 'comment'] },
                { open: '\"', close: '\"', notIn: ['string'] },
                { open: '`', close: '`', notIn: ['string', 'comment'] },
                { open: '/**', close: ' */', notIn: ['string'] },
                { open: 'begin', close: 'end', notIn: ['string'] }
            ],
            __electricCharacterSupport: {
                docComment: { open: '/**', close: ' */' }
            }
        }));
    }
    function setupAutoClosingLanguageTokenization() {
        class BaseState {
            constructor(parent = null) {
                this.parent = parent;
            }
            clone() { return this; }
            equals(other) {
                if (!(other instanceof BaseState)) {
                    return false;
                }
                if (!this.parent && !other.parent) {
                    return true;
                }
                if (!this.parent || !other.parent) {
                    return false;
                }
                return this.parent.equals(other.parent);
            }
        }
        class StringState {
            constructor(char, parentState) {
                this.char = char;
                this.parentState = parentState;
            }
            clone() { return this; }
            equals(other) { return other instanceof StringState && this.char === other.char && this.parentState.equals(other.parentState); }
        }
        class BlockCommentState {
            constructor(parentState) {
                this.parentState = parentState;
            }
            clone() { return this; }
            equals(other) { return other instanceof StringState && this.parentState.equals(other.parentState); }
        }
        const encodedLanguageId = languageService.languageIdCodec.encodeLanguageId(autoClosingLanguageId);
        disposables.add(TokenizationRegistry.register(autoClosingLanguageId, {
            getInitialState: () => new BaseState(),
            tokenize: undefined,
            tokenizeEncoded: function (line, hasEOL, _state) {
                let state = _state;
                const tokens = [];
                const generateToken = (length, type, newState) => {
                    if (tokens.length > 0 && tokens[tokens.length - 1].type === type) {
                        // grow last tokens
                        tokens[tokens.length - 1].length += length;
                    }
                    else {
                        tokens.push({ length, type });
                    }
                    line = line.substring(length);
                    if (newState) {
                        state = newState;
                    }
                };
                while (line.length > 0) {
                    advance();
                }
                const result = new Uint32Array(tokens.length * 2);
                let startIndex = 0;
                for (let i = 0; i < tokens.length; i++) {
                    result[2 * i] = startIndex;
                    result[2 * i + 1] = ((encodedLanguageId << 0 /* MetadataConsts.LANGUAGEID_OFFSET */)
                        | (tokens[i].type << 8 /* MetadataConsts.TOKEN_TYPE_OFFSET */));
                    startIndex += tokens[i].length;
                }
                return new EncodedTokenizationResult(result, state);
                function advance() {
                    if (state instanceof BaseState) {
                        const m1 = line.match(/^[^'"`{}/]+/g);
                        if (m1) {
                            return generateToken(m1[0].length, 0 /* StandardTokenType.Other */);
                        }
                        if (/^['"`]/.test(line)) {
                            return generateToken(1, 2 /* StandardTokenType.String */, new StringState(line.charAt(0), state));
                        }
                        if (/^{/.test(line)) {
                            return generateToken(1, 0 /* StandardTokenType.Other */, new BaseState(state));
                        }
                        if (/^}/.test(line)) {
                            return generateToken(1, 0 /* StandardTokenType.Other */, state.parent || new BaseState());
                        }
                        if (/^\/\//.test(line)) {
                            return generateToken(line.length, 1 /* StandardTokenType.Comment */, state);
                        }
                        if (/^\/\*/.test(line)) {
                            return generateToken(2, 1 /* StandardTokenType.Comment */, new BlockCommentState(state));
                        }
                        return generateToken(1, 0 /* StandardTokenType.Other */, state);
                    }
                    else if (state instanceof StringState) {
                        const m1 = line.match(/^[^\\'"`\$]+/g);
                        if (m1) {
                            return generateToken(m1[0].length, 2 /* StandardTokenType.String */);
                        }
                        if (/^\\/.test(line)) {
                            return generateToken(2, 2 /* StandardTokenType.String */);
                        }
                        if (line.charAt(0) === state.char) {
                            return generateToken(1, 2 /* StandardTokenType.String */, state.parentState);
                        }
                        if (/^\$\{/.test(line)) {
                            return generateToken(2, 0 /* StandardTokenType.Other */, new BaseState(state));
                        }
                        return generateToken(1, 0 /* StandardTokenType.Other */, state);
                    }
                    else if (state instanceof BlockCommentState) {
                        const m1 = line.match(/^[^*]+/g);
                        if (m1) {
                            return generateToken(m1[0].length, 2 /* StandardTokenType.String */);
                        }
                        if (/^\*\//.test(line)) {
                            return generateToken(2, 1 /* StandardTokenType.Comment */, state.parentState);
                        }
                        return generateToken(1, 0 /* StandardTokenType.Other */, state);
                    }
                    else {
                        throw new Error(`unknown state`);
                    }
                }
            }
        }));
    }
    function setAutoClosingLanguageEnabledSet(chars) {
        disposables.add(languageConfigurationService.register(autoClosingLanguageId, {
            autoCloseBefore: chars,
            autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '\'', close: '\'', notIn: ['string', 'comment'] },
                { open: '\"', close: '\"', notIn: ['string'] },
                { open: '`', close: '`', notIn: ['string', 'comment'] },
                { open: '/**', close: ' */', notIn: ['string'] }
            ],
        }));
    }
    function createTextModel(text, languageId = null, options = TextModel.DEFAULT_CREATION_OPTIONS, uri = null) {
        return disposables.add(instantiateTextModel(instantiationService, text, languageId, options, uri));
    }
    function withTestCodeEditor(text, options, callback) {
        let model;
        if (typeof text === 'string') {
            model = createTextModel(text);
        }
        else if (Array.isArray(text)) {
            model = createTextModel(text.join('\n'));
        }
        else {
            model = text;
        }
        const editor = disposables.add(instantiateTestCodeEditor(instantiationService, model, options));
        const viewModel = editor.getViewModel();
        viewModel.setHasFocus(true);
        callback(editor, viewModel);
    }
    function usingCursor(opts, callback) {
        const model = createTextModel(opts.text.join('\n'), opts.languageId, opts.modelOpts);
        const editorOptions = opts.editorOpts || {};
        withTestCodeEditor(model, editorOptions, (editor, viewModel) => {
            callback(editor, model, viewModel);
        });
    }
    let AutoClosingColumnType;
    (function (AutoClosingColumnType) {
        AutoClosingColumnType[AutoClosingColumnType["Normal"] = 0] = "Normal";
        AutoClosingColumnType[AutoClosingColumnType["Special1"] = 1] = "Special1";
        AutoClosingColumnType[AutoClosingColumnType["Special2"] = 2] = "Special2";
    })(AutoClosingColumnType || (AutoClosingColumnType = {}));
    function extractAutoClosingSpecialColumns(maxColumn, annotatedLine) {
        const result = [];
        for (let j = 1; j <= maxColumn; j++) {
            result[j] = 0 /* AutoClosingColumnType.Normal */;
        }
        let column = 1;
        for (let j = 0; j < annotatedLine.length; j++) {
            if (annotatedLine.charAt(j) === '|') {
                result[column] = 1 /* AutoClosingColumnType.Special1 */;
            }
            else if (annotatedLine.charAt(j) === '!') {
                result[column] = 2 /* AutoClosingColumnType.Special2 */;
            }
            else {
                column++;
            }
        }
        return result;
    }
    function assertType(editor, model, viewModel, lineNumber, column, chr, expectedInsert, message) {
        const lineContent = model.getLineContent(lineNumber);
        const expected = lineContent.substr(0, column - 1) + expectedInsert + lineContent.substr(column - 1);
        moveTo(editor, viewModel, lineNumber, column);
        viewModel.type(chr, 'keyboard');
        assert.deepStrictEqual(model.getLineContent(lineNumber), expected, message);
        model.undo();
    }
    test('issue microsoft/monaco-editor#443: Indentation of a single row deletes selected text in some cases', () => {
        const model = createTextModel([
            'Hello world!',
            'another line'
        ].join('\n'), undefined, {
            insertSpaces: false
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 1, 1, 13)]);
            // Check that indenting maintains the selection start at column 1
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.deepStrictEqual(viewModel.getSelection(), new Selection(1, 1, 1, 14));
        });
    });
    test('Bug 9121: Auto indent + undo + redo is funky', () => {
        const model = createTextModel([
            ''
        ].join('\n'), undefined, {
            insertSpaces: false,
            trimAutoWhitespace: false
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n', 'assert1');
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\t', 'assert2');
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\t\n\t', 'assert3');
            viewModel.type('x');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\t\n\tx', 'assert4');
            CoreNavigationCommands.CursorLeft.runCoreEditorCommand(viewModel, {});
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\t\n\tx', 'assert5');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\t\nx', 'assert6');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\tx', 'assert7');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\nx', 'assert8');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'x', 'assert9');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\nx', 'assert10');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\t\nx', 'assert11');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\t\n\tx', 'assert12');
            editor.runCommand(CoreEditingCommands.Redo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\t\nx', 'assert13');
            editor.runCommand(CoreEditingCommands.Redo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\nx', 'assert14');
            editor.runCommand(CoreEditingCommands.Redo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'x', 'assert15');
        });
    });
    test('issue #23539: Setting model EOL isn\'t undoable', () => {
        withTestCodeEditor([
            'Hello',
            'world'
        ], {}, (editor, viewModel) => {
            const model = editor.getModel();
            assertCursor(viewModel, new Position(1, 1));
            model.setEOL(0 /* EndOfLineSequence.LF */);
            assert.strictEqual(model.getValue(), 'Hello\nworld');
            model.pushEOL(1 /* EndOfLineSequence.CRLF */);
            assert.strictEqual(model.getValue(), 'Hello\r\nworld');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(), 'Hello\nworld');
        });
    });
    test('issue #47733: Undo mangles unicode characters', () => {
        const languageId = 'myMode';
        disposables.add(languageService.registerLanguage({ id: languageId }));
        disposables.add(languageConfigurationService.register(languageId, {
            surroundingPairs: [{ open: '%', close: '%' }]
        }));
        const model = createTextModel('\'👁\'', languageId);
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            editor.setSelection(new Selection(1, 1, 1, 2));
            viewModel.type('%', 'keyboard');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '%\'%👁\'', 'assert1');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\'👁\'', 'assert2');
        });
    });
    test('issue #46208: Allow empty selections in the undo/redo stack', () => {
        const model = createTextModel('');
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.type('Hello', 'keyboard');
            viewModel.type(' ', 'keyboard');
            viewModel.type('world', 'keyboard');
            viewModel.type(' ', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'Hello world ');
            assertCursor(viewModel, new Position(1, 13));
            moveLeft(editor, viewModel);
            moveRight(editor, viewModel);
            model.pushEditOperations([], [EditOperation.replaceMove(new Range(1, 12, 1, 13), '')], () => []);
            assert.strictEqual(model.getLineContent(1), 'Hello world');
            assertCursor(viewModel, new Position(1, 12));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(1), 'Hello world ');
            assertCursor(viewModel, new Selection(1, 13, 1, 13));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(1), 'Hello world');
            assertCursor(viewModel, new Position(1, 12));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(1), 'Hello');
            assertCursor(viewModel, new Position(1, 6));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(1), '');
            assertCursor(viewModel, new Position(1, 1));
            editor.runCommand(CoreEditingCommands.Redo, null);
            assert.strictEqual(model.getLineContent(1), 'Hello');
            assertCursor(viewModel, new Position(1, 6));
            editor.runCommand(CoreEditingCommands.Redo, null);
            assert.strictEqual(model.getLineContent(1), 'Hello world');
            assertCursor(viewModel, new Position(1, 12));
            editor.runCommand(CoreEditingCommands.Redo, null);
            assert.strictEqual(model.getLineContent(1), 'Hello world ');
            assertCursor(viewModel, new Position(1, 13));
            editor.runCommand(CoreEditingCommands.Redo, null);
            assert.strictEqual(model.getLineContent(1), 'Hello world');
            assertCursor(viewModel, new Position(1, 12));
            editor.runCommand(CoreEditingCommands.Redo, null);
            assert.strictEqual(model.getLineContent(1), 'Hello world');
            assertCursor(viewModel, new Position(1, 12));
        });
    });
    test('bug #16815:Shift+Tab doesn\'t go back to tabstop', () => {
        const languageId = setupOnEnterLanguage(IndentAction.IndentOutdent);
        const model = createTextModel([
            '     function baz() {'
        ].join('\n'), languageId);
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 1, 6, false);
            assertCursor(viewModel, new Selection(1, 6, 1, 6));
            editor.runCommand(CoreEditingCommands.Outdent, null);
            assert.strictEqual(model.getLineContent(1), '    function baz() {');
            assertCursor(viewModel, new Selection(1, 5, 1, 5));
        });
    });
    test('Bug #18293:[regression][editor] Can\'t outdent whitespace line', () => {
        const model = createTextModel([
            '      '
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 1, 7, false);
            assertCursor(viewModel, new Selection(1, 7, 1, 7));
            editor.runCommand(CoreEditingCommands.Outdent, null);
            assert.strictEqual(model.getLineContent(1), '    ');
            assertCursor(viewModel, new Selection(1, 5, 1, 5));
        });
    });
    test('issue #95591: Unindenting moves cursor to beginning of line', () => {
        const model = createTextModel([
            '        '
        ].join('\n'));
        withTestCodeEditor(model, { useTabStops: false }, (editor, viewModel) => {
            moveTo(editor, viewModel, 1, 9, false);
            assertCursor(viewModel, new Selection(1, 9, 1, 9));
            editor.runCommand(CoreEditingCommands.Outdent, null);
            assert.strictEqual(model.getLineContent(1), '    ');
            assertCursor(viewModel, new Selection(1, 5, 1, 5));
        });
    });
    test('Bug #16657: [editor] Tab on empty line of zero indentation moves cursor to position (1,1)', () => {
        const model = createTextModel([
            'function baz() {',
            '\tfunction hello() { // something here',
            '\t',
            '',
            '\t}',
            '}',
            ''
        ].join('\n'), undefined, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 7, 1, false);
            assertCursor(viewModel, new Selection(7, 1, 7, 1));
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(7), '\t');
            assertCursor(viewModel, new Selection(7, 2, 7, 2));
        });
    });
    test('bug #16740: [editor] Cut line doesn\'t quite cut the last line', () => {
        // Part 1 => there is text on the last line
        withTestCodeEditor([
            'asdasd',
            'qwerty'
        ], {}, (editor, viewModel) => {
            const model = editor.getModel();
            moveTo(editor, viewModel, 2, 1, false);
            assertCursor(viewModel, new Selection(2, 1, 2, 1));
            viewModel.cut('keyboard');
            assert.strictEqual(model.getLineCount(), 1);
            assert.strictEqual(model.getLineContent(1), 'asdasd');
        });
        // Part 2 => there is no text on the last line
        withTestCodeEditor([
            'asdasd',
            ''
        ], {}, (editor, viewModel) => {
            const model = editor.getModel();
            moveTo(editor, viewModel, 2, 1, false);
            assertCursor(viewModel, new Selection(2, 1, 2, 1));
            viewModel.cut('keyboard');
            assert.strictEqual(model.getLineCount(), 1);
            assert.strictEqual(model.getLineContent(1), 'asdasd');
            viewModel.cut('keyboard');
            assert.strictEqual(model.getLineCount(), 1);
            assert.strictEqual(model.getLineContent(1), '');
        });
    });
    test('issue #128602: When cutting multiple lines (ctrl x), the last line will not be erased', () => {
        withTestCodeEditor([
            'a1',
            'a2',
            'a3'
        ], {}, (editor, viewModel) => {
            const model = editor.getModel();
            viewModel.setSelections('test', [
                new Selection(1, 1, 1, 1),
                new Selection(2, 1, 2, 1),
                new Selection(3, 1, 3, 1),
            ]);
            viewModel.cut('keyboard');
            assert.strictEqual(model.getLineCount(), 1);
            assert.strictEqual(model.getLineContent(1), '');
        });
    });
    test('Bug #11476: Double bracket surrounding + undo is broken', () => {
        usingCursor({
            text: [
                'hello'
            ],
            languageId: surroundingLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 1, 3, false);
            moveTo(editor, viewModel, 1, 5, true);
            assertCursor(viewModel, new Selection(1, 3, 1, 5));
            viewModel.type('(', 'keyboard');
            assertCursor(viewModel, new Selection(1, 4, 1, 6));
            viewModel.type('(', 'keyboard');
            assertCursor(viewModel, new Selection(1, 5, 1, 7));
        });
    });
    test('issue #206774: SurroundSelectionCommand with empty charAfterSelection should not throw', () => {
        // This test reproduces the issue where SurroundSelectionCommand throws when charAfterSelection is empty
        // The problem is that addTrackedEditOperation ignores empty strings, causing computeCursorState to fail
        // when trying to access inverseEditOperations[1].range (which is undefined)
        usingCursor({
            text: [
                'hello world'
            ],
            languageId: emptyClosingSurroundLanguageId
        }, (editor, model, viewModel) => {
            // Select "hello"
            moveTo(editor, viewModel, 1, 1, false);
            moveTo(editor, viewModel, 1, 6, true);
            assertCursor(viewModel, new Selection(1, 1, 1, 6));
            // Type < which should surround with '<' and empty string
            // This reproduces the crash where charAfterSelection is empty
            viewModel.type('<', 'keyboard');
            // Test passes if we don't crash - the exact cursor position depends on the fix
            // The main issue is that computeCursorState fails when charAfterSelection is empty
            assert.strictEqual(model.getValue(), '<hello world');
        });
    });
    test('issue #1140: Backspace stops prematurely', () => {
        const model = createTextModel([
            'function baz() {',
            '  return 1;',
            '};'
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 3, 2, false);
            moveTo(editor, viewModel, 1, 14, true);
            assertCursor(viewModel, new Selection(3, 2, 1, 14));
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assertCursor(viewModel, new Selection(1, 14, 1, 14));
            assert.strictEqual(model.getLineCount(), 1);
            assert.strictEqual(model.getLineContent(1), 'function baz(;');
        });
    });
    test('issue #10212: Pasting entire line does not replace selection', () => {
        usingCursor({
            text: [
                'line1',
                'line2'
            ],
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 1, false);
            moveTo(editor, viewModel, 2, 6, true);
            viewModel.paste('line1\n', true);
            assert.strictEqual(model.getLineContent(1), 'line1');
            assert.strictEqual(model.getLineContent(2), 'line1');
            assert.strictEqual(model.getLineContent(3), '');
        });
    });
    test('issue #74722: Pasting whole line does not replace selection', () => {
        usingCursor({
            text: [
                'line1',
                'line sel 2',
                'line3'
            ],
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [new Selection(2, 6, 2, 9)]);
            viewModel.paste('line1\n', true);
            assert.strictEqual(model.getLineContent(1), 'line1');
            assert.strictEqual(model.getLineContent(2), 'line line1');
            assert.strictEqual(model.getLineContent(3), ' 2');
            assert.strictEqual(model.getLineContent(4), 'line3');
        });
    });
    test('issue #4996: Multiple cursor paste pastes contents of all cursors', () => {
        usingCursor({
            text: [
                'line1',
                'line2',
                'line3'
            ],
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 1, 1, 1), new Selection(2, 1, 2, 1)]);
            viewModel.paste('a\nb\nc\nd', false, [
                'a\nb',
                'c\nd'
            ]);
            assert.strictEqual(model.getValue(), [
                'a',
                'bline1',
                'c',
                'dline2',
                'line3'
            ].join('\n'));
        });
    });
    test('issue #16155: Paste into multiple cursors has edge case when number of lines equals number of cursors - 1', () => {
        usingCursor({
            text: [
                'test',
                'test',
                'test',
                'test'
            ],
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [
                new Selection(1, 1, 1, 5),
                new Selection(2, 1, 2, 5),
                new Selection(3, 1, 3, 5),
                new Selection(4, 1, 4, 5),
            ]);
            viewModel.paste('aaa\nbbb\nccc\n', false, null);
            assert.strictEqual(model.getValue(), [
                'aaa',
                'bbb',
                'ccc',
                '',
                'aaa',
                'bbb',
                'ccc',
                '',
                'aaa',
                'bbb',
                'ccc',
                '',
                'aaa',
                'bbb',
                'ccc',
                '',
            ].join('\n'));
        });
    });
    test('issue #43722: Multiline paste doesn\'t work anymore', () => {
        usingCursor({
            text: [
                'test',
                'test',
                'test',
                'test'
            ],
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [
                new Selection(1, 1, 1, 5),
                new Selection(2, 1, 2, 5),
                new Selection(3, 1, 3, 5),
                new Selection(4, 1, 4, 5),
            ]);
            viewModel.paste('aaa\r\nbbb\r\nccc\r\nddd\r\n', false, null);
            assert.strictEqual(model.getValue(), [
                'aaa',
                'bbb',
                'ccc',
                'ddd',
            ].join('\n'));
        });
    });
    test('issue #46440: (1) Pasting a multi-line selection pastes entire selection into every insertion point', () => {
        usingCursor({
            text: [
                'line1',
                'line2',
                'line3'
            ],
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 1, 1, 1), new Selection(2, 1, 2, 1), new Selection(3, 1, 3, 1)]);
            viewModel.paste('a\nb\nc', false, null);
            assert.strictEqual(model.getValue(), [
                'aline1',
                'bline2',
                'cline3'
            ].join('\n'));
        });
    });
    test('issue #46440: (2) Pasting a multi-line selection pastes entire selection into every insertion point', () => {
        usingCursor({
            text: [
                'line1',
                'line2',
                'line3'
            ],
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 1, 1, 1), new Selection(2, 1, 2, 1), new Selection(3, 1, 3, 1)]);
            viewModel.paste('a\nb\nc\n', false, null);
            assert.strictEqual(model.getValue(), [
                'aline1',
                'bline2',
                'cline3'
            ].join('\n'));
        });
    });
    test('issue #3071: Investigate why undo stack gets corrupted', () => {
        const model = createTextModel([
            'some lines',
            'and more lines',
            'just some text',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 1, 1, false);
            moveTo(editor, viewModel, 3, 4, true);
            let isFirst = true;
            const disposable = model.onDidChangeContent(() => {
                if (isFirst) {
                    isFirst = false;
                    viewModel.type('\t', 'keyboard');
                }
            });
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getValue(), [
                '\t just some text'
            ].join('\n'), '001');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(), [
                '    some lines',
                '    and more lines',
                '    just some text',
            ].join('\n'), '002');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(), [
                'some lines',
                'and more lines',
                'just some text',
            ].join('\n'), '003');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(), [
                'some lines',
                'and more lines',
                'just some text',
            ].join('\n'), '004');
            disposable.dispose();
        });
    });
    test('issue #12950: Cannot Double Click To Insert Emoji Using OSX Emoji Panel', () => {
        usingCursor({
            text: [
                'some lines',
                'and more lines',
                'just some text',
            ],
            languageId: null
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 3, 1, false);
            viewModel.type('😍', 'keyboard');
            assert.strictEqual(model.getValue(), [
                'some lines',
                'and more lines',
                '😍just some text',
            ].join('\n'));
        });
    });
    test('issue #3463: pressing tab adds spaces, but not as many as for a tab', () => {
        const model = createTextModel([
            'function a() {',
            '\tvar a = {',
            '\t\tx: 3',
            '\t};',
            '}',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 3, 2, false);
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(3), '\t    \tx: 3');
        });
    });
    test('issue #4312: trying to type a tab character over a sequence of spaces results in unexpected behaviour', () => {
        const model = createTextModel([
            'var foo = 123;       // this is a comment',
            'var bar = 4;       // another comment'
        ].join('\n'), undefined, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 1, 15, false);
            moveTo(editor, viewModel, 1, 22, true);
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(1), 'var foo = 123;\t// this is a comment');
        });
    });
    test('issue #832: word right', () => {
        usingCursor({
            text: [
                '   /* Just some   more   text a+= 3 +5-3 + 7 */  '
            ],
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 1, 1, false);
            function assertWordRight(col, expectedCol) {
                const args = {
                    position: {
                        lineNumber: 1,
                        column: col
                    }
                };
                if (col === 1) {
                    CoreNavigationCommands.WordSelect.runCoreEditorCommand(viewModel, args);
                }
                else {
                    CoreNavigationCommands.WordSelectDrag.runCoreEditorCommand(viewModel, args);
                }
                assert.strictEqual(viewModel.getSelection().startColumn, 1, 'TEST FOR ' + col);
                assert.strictEqual(viewModel.getSelection().endColumn, expectedCol, 'TEST FOR ' + col);
            }
            assertWordRight(1, '   '.length + 1);
            assertWordRight(2, '   '.length + 1);
            assertWordRight(3, '   '.length + 1);
            assertWordRight(4, '   '.length + 1);
            assertWordRight(5, '   /'.length + 1);
            assertWordRight(6, '   /*'.length + 1);
            assertWordRight(7, '   /* '.length + 1);
            assertWordRight(8, '   /* Just'.length + 1);
            assertWordRight(9, '   /* Just'.length + 1);
            assertWordRight(10, '   /* Just'.length + 1);
            assertWordRight(11, '   /* Just'.length + 1);
            assertWordRight(12, '   /* Just '.length + 1);
            assertWordRight(13, '   /* Just some'.length + 1);
            assertWordRight(14, '   /* Just some'.length + 1);
            assertWordRight(15, '   /* Just some'.length + 1);
            assertWordRight(16, '   /* Just some'.length + 1);
            assertWordRight(17, '   /* Just some '.length + 1);
            assertWordRight(18, '   /* Just some  '.length + 1);
            assertWordRight(19, '   /* Just some   '.length + 1);
            assertWordRight(20, '   /* Just some   more'.length + 1);
            assertWordRight(21, '   /* Just some   more'.length + 1);
            assertWordRight(22, '   /* Just some   more'.length + 1);
            assertWordRight(23, '   /* Just some   more'.length + 1);
            assertWordRight(24, '   /* Just some   more '.length + 1);
            assertWordRight(25, '   /* Just some   more  '.length + 1);
            assertWordRight(26, '   /* Just some   more   '.length + 1);
            assertWordRight(27, '   /* Just some   more   text'.length + 1);
            assertWordRight(28, '   /* Just some   more   text'.length + 1);
            assertWordRight(29, '   /* Just some   more   text'.length + 1);
            assertWordRight(30, '   /* Just some   more   text'.length + 1);
            assertWordRight(31, '   /* Just some   more   text '.length + 1);
            assertWordRight(32, '   /* Just some   more   text a'.length + 1);
            assertWordRight(33, '   /* Just some   more   text a+'.length + 1);
            assertWordRight(34, '   /* Just some   more   text a+='.length + 1);
            assertWordRight(35, '   /* Just some   more   text a+= '.length + 1);
            assertWordRight(36, '   /* Just some   more   text a+= 3'.length + 1);
            assertWordRight(37, '   /* Just some   more   text a+= 3 '.length + 1);
            assertWordRight(38, '   /* Just some   more   text a+= 3 +'.length + 1);
            assertWordRight(39, '   /* Just some   more   text a+= 3 +5'.length + 1);
            assertWordRight(40, '   /* Just some   more   text a+= 3 +5-'.length + 1);
            assertWordRight(41, '   /* Just some   more   text a+= 3 +5-3'.length + 1);
            assertWordRight(42, '   /* Just some   more   text a+= 3 +5-3 '.length + 1);
            assertWordRight(43, '   /* Just some   more   text a+= 3 +5-3 +'.length + 1);
            assertWordRight(44, '   /* Just some   more   text a+= 3 +5-3 + '.length + 1);
            assertWordRight(45, '   /* Just some   more   text a+= 3 +5-3 + 7'.length + 1);
            assertWordRight(46, '   /* Just some   more   text a+= 3 +5-3 + 7 '.length + 1);
            assertWordRight(47, '   /* Just some   more   text a+= 3 +5-3 + 7 *'.length + 1);
            assertWordRight(48, '   /* Just some   more   text a+= 3 +5-3 + 7 */'.length + 1);
            assertWordRight(49, '   /* Just some   more   text a+= 3 +5-3 + 7 */ '.length + 1);
            assertWordRight(50, '   /* Just some   more   text a+= 3 +5-3 + 7 */  '.length + 1);
        });
    });
    test('issue #33788: Wrong cursor position when double click to select a word', () => {
        const model = createTextModel([
            'Just some text'
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            CoreNavigationCommands.WordSelect.runCoreEditorCommand(viewModel, { position: new Position(1, 8) });
            assert.deepStrictEqual(viewModel.getSelection(), new Selection(1, 6, 1, 10));
            CoreNavigationCommands.WordSelectDrag.runCoreEditorCommand(viewModel, { position: new Position(1, 8) });
            assert.deepStrictEqual(viewModel.getSelection(), new Selection(1, 6, 1, 10));
        });
    });
    test('issue #12887: Double-click highlighting separating white space', () => {
        const model = createTextModel([
            'abc def'
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            CoreNavigationCommands.WordSelect.runCoreEditorCommand(viewModel, { position: new Position(1, 5) });
            assert.deepStrictEqual(viewModel.getSelection(), new Selection(1, 5, 1, 8));
        });
    });
    test('Double-click on punctuation should select the character, not adjacent space', () => {
        const model = createTextModel([
            '// a b c 1 2 3 ~ ! @ # $ % ^ & * ( ) _ + \\ /'
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            // Test double-click on '@' at position 20
            CoreNavigationCommands.WordSelect.runCoreEditorCommand(viewModel, { position: new Position(1, 20) });
            assert.deepStrictEqual(viewModel.getSelection(), new Selection(1, 20, 1, 21), 'Should select @ character');
            // Test double-click on '#' at position 22
            CoreNavigationCommands.WordSelect.runCoreEditorCommand(viewModel, { position: new Position(1, 22) });
            assert.deepStrictEqual(viewModel.getSelection(), new Selection(1, 22, 1, 23), 'Should select # character');
            // Test double-click on '!' at position 18
            CoreNavigationCommands.WordSelect.runCoreEditorCommand(viewModel, { position: new Position(1, 18) });
            assert.deepStrictEqual(viewModel.getSelection(), new Selection(1, 18, 1, 19), 'Should select ! character');
            // Test double-click on first '/' in '//' at position 1
            CoreNavigationCommands.WordSelect.runCoreEditorCommand(viewModel, { position: new Position(1, 1) });
            assert.deepStrictEqual(viewModel.getSelection(), new Selection(1, 1, 1, 3), 'Should select // token');
            // Test double-click on second '/' in '//' at position 2
            CoreNavigationCommands.WordSelect.runCoreEditorCommand(viewModel, { position: new Position(1, 2) });
            assert.deepStrictEqual(viewModel.getSelection(), new Selection(1, 1, 1, 3), 'Should select // token');
            // Test double-click on '\' at position 42
            CoreNavigationCommands.WordSelect.runCoreEditorCommand(viewModel, { position: new Position(1, 42) });
            assert.deepStrictEqual(viewModel.getSelection(), new Selection(1, 42, 1, 43), 'Should select \\ character');
        });
    });
    test('issue #9675: Undo/Redo adds a stop in between CHN Characters', () => {
        withTestCodeEditor([], {}, (editor, viewModel) => {
            const model = editor.getModel();
            assertCursor(viewModel, new Position(1, 1));
            // Typing sennsei in Japanese - Hiragana
            viewModel.type('ｓ', 'keyboard');
            viewModel.compositionType('せ', 1, 0, 0);
            viewModel.compositionType('せｎ', 1, 0, 0);
            viewModel.compositionType('せん', 2, 0, 0);
            viewModel.compositionType('せんｓ', 2, 0, 0);
            viewModel.compositionType('せんせ', 3, 0, 0);
            viewModel.compositionType('せんせ', 3, 0, 0);
            viewModel.compositionType('せんせい', 3, 0, 0);
            viewModel.compositionType('せんせい', 4, 0, 0);
            viewModel.compositionType('せんせい', 4, 0, 0);
            viewModel.compositionType('せんせい', 4, 0, 0);
            assert.strictEqual(model.getLineContent(1), 'せんせい');
            assertCursor(viewModel, new Position(1, 5));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(1), '');
            assertCursor(viewModel, new Position(1, 1));
        });
    });
    test('issue #23983: Calling model.setEOL does not reset cursor position', () => {
        usingCursor({
            text: [
                'first line',
                'second line'
            ]
        }, (editor, model, viewModel) => {
            model.setEOL(1 /* EndOfLineSequence.CRLF */);
            viewModel.setSelections('test', [new Selection(2, 2, 2, 2)]);
            model.setEOL(0 /* EndOfLineSequence.LF */);
            assertCursor(viewModel, new Selection(2, 2, 2, 2));
        });
    });
    test('issue #23983: Calling model.setValue() resets cursor position', () => {
        usingCursor({
            text: [
                'first line',
                'second line'
            ]
        }, (editor, model, viewModel) => {
            model.setEOL(1 /* EndOfLineSequence.CRLF */);
            viewModel.setSelections('test', [new Selection(2, 2, 2, 2)]);
            model.setValue([
                'different first line',
                'different second line',
                'new third line'
            ].join('\n'));
            assertCursor(viewModel, new Selection(1, 1, 1, 1));
        });
    });
    test('issue #36740: wordwrap creates an extra step / character at the wrapping point', () => {
        // a single model line => 4 view lines
        withTestCodeEditor([
            [
                'Lorem ipsum ',
                'dolor sit amet ',
                'consectetur ',
                'adipiscing elit',
            ].join('')
        ], { wordWrap: 'wordWrapColumn', wordWrapColumn: 16 }, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 7, 1, 7)]);
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Selection(1, 8, 1, 8));
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Selection(1, 9, 1, 9));
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Selection(1, 10, 1, 10));
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Selection(1, 11, 1, 11));
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Selection(1, 12, 1, 12));
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Selection(1, 13, 1, 13));
            // moving to view line 2
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Selection(1, 14, 1, 14));
            moveLeft(editor, viewModel);
            assertCursor(viewModel, new Selection(1, 13, 1, 13));
            // moving back to view line 1
            moveLeft(editor, viewModel);
            assertCursor(viewModel, new Selection(1, 12, 1, 12));
        });
    });
    test('issue #110376: multiple selections with wordwrap behave differently', () => {
        // a single model line => 4 view lines
        withTestCodeEditor([
            [
                'just a sentence. just a ',
                'sentence. just a sentence.',
            ].join('')
        ], { wordWrap: 'wordWrapColumn', wordWrapColumn: 25 }, (editor, viewModel) => {
            viewModel.setSelections('test', [
                new Selection(1, 1, 1, 16),
                new Selection(1, 18, 1, 33),
                new Selection(1, 35, 1, 50),
            ]);
            moveLeft(editor, viewModel);
            assertCursor(viewModel, [
                new Selection(1, 1, 1, 1),
                new Selection(1, 18, 1, 18),
                new Selection(1, 35, 1, 35),
            ]);
            viewModel.setSelections('test', [
                new Selection(1, 1, 1, 16),
                new Selection(1, 18, 1, 33),
                new Selection(1, 35, 1, 50),
            ]);
            moveRight(editor, viewModel);
            assertCursor(viewModel, [
                new Selection(1, 16, 1, 16),
                new Selection(1, 33, 1, 33),
                new Selection(1, 50, 1, 50),
            ]);
        });
    });
    test('issue #98320: Multi-Cursor, Wrap lines and cursorSelectRight ==> cursors out of sync', () => {
        // a single model line => 4 view lines
        withTestCodeEditor([
            [
                'lorem_ipsum-1993x11x13',
                'dolor_sit_amet-1998x04x27',
                'consectetur-2007x10x08',
                'adipiscing-2012x07x27',
                'elit-2015x02x27',
            ].join('\n')
        ], { wordWrap: 'wordWrapColumn', wordWrapColumn: 16 }, (editor, viewModel) => {
            viewModel.setSelections('test', [
                new Selection(1, 13, 1, 13),
                new Selection(2, 16, 2, 16),
                new Selection(3, 13, 3, 13),
                new Selection(4, 12, 4, 12),
                new Selection(5, 6, 5, 6),
            ]);
            assertCursor(viewModel, [
                new Selection(1, 13, 1, 13),
                new Selection(2, 16, 2, 16),
                new Selection(3, 13, 3, 13),
                new Selection(4, 12, 4, 12),
                new Selection(5, 6, 5, 6),
            ]);
            moveRight(editor, viewModel, true);
            assertCursor(viewModel, [
                new Selection(1, 13, 1, 14),
                new Selection(2, 16, 2, 17),
                new Selection(3, 13, 3, 14),
                new Selection(4, 12, 4, 13),
                new Selection(5, 6, 5, 7),
            ]);
            moveRight(editor, viewModel, true);
            assertCursor(viewModel, [
                new Selection(1, 13, 1, 15),
                new Selection(2, 16, 2, 18),
                new Selection(3, 13, 3, 15),
                new Selection(4, 12, 4, 14),
                new Selection(5, 6, 5, 8),
            ]);
            moveRight(editor, viewModel, true);
            assertCursor(viewModel, [
                new Selection(1, 13, 1, 16),
                new Selection(2, 16, 2, 19),
                new Selection(3, 13, 3, 16),
                new Selection(4, 12, 4, 15),
                new Selection(5, 6, 5, 9),
            ]);
            moveRight(editor, viewModel, true);
            assertCursor(viewModel, [
                new Selection(1, 13, 1, 17),
                new Selection(2, 16, 2, 20),
                new Selection(3, 13, 3, 17),
                new Selection(4, 12, 4, 16),
                new Selection(5, 6, 5, 10),
            ]);
        });
    });
    test('issue #41573 - delete across multiple lines does not shrink the selection when word wraps', () => {
        withTestCodeEditor([
            'Authorization: \'Bearer pHKRfCTFSnGxs6akKlb9ddIXcca0sIUSZJutPHYqz7vEeHdMTMh0SGN0IGU3a0n59DXjTLRsj5EJ2u33qLNIFi9fk5XF8pK39PndLYUZhPt4QvHGLScgSkK0L4gwzkzMloTQPpKhqiikiIOvyNNSpd2o8j29NnOmdTUOKi9DVt74PD2ohKxyOrWZ6oZprTkb3eKajcpnS0LABKfaw2rmv4\','
        ].join('\n'), { wordWrap: 'wordWrapColumn', wordWrapColumn: 100 }, (editor, viewModel) => {
            moveTo(editor, viewModel, 1, 43, false);
            moveTo(editor, viewModel, 1, 147, true);
            assertCursor(viewModel, new Selection(1, 43, 1, 147));
            editor.getModel().applyEdits([{
                    range: new Range(1, 1, 1, 43),
                    text: ''
                }]);
            assertCursor(viewModel, new Selection(1, 1, 1, 105));
        });
    });
    test('issue #22717: Moving text cursor cause an incorrect position in Chinese', () => {
        // a single model line => 4 view lines
        withTestCodeEditor([
            [
                '一二三四五六七八九十',
                '12345678901234567890',
            ].join('\n')
        ], {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 5, 1, 5)]);
            moveDown(editor, viewModel);
            assertCursor(viewModel, new Selection(2, 9, 2, 9));
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Selection(2, 10, 2, 10));
            moveRight(editor, viewModel);
            assertCursor(viewModel, new Selection(2, 11, 2, 11));
            moveUp(editor, viewModel);
            assertCursor(viewModel, new Selection(1, 6, 1, 6));
        });
    });
    test('issue #112301: new stickyTabStops feature interferes with word wrap', () => {
        withTestCodeEditor([
            [
                'function hello() {',
                '        console.log(`this is a long console message`)',
                '}',
            ].join('\n')
        ], { wordWrap: 'wordWrapColumn', wordWrapColumn: 32, stickyTabStops: true }, (editor, viewModel) => {
            viewModel.setSelections('test', [
                new Selection(2, 31, 2, 31)
            ]);
            moveRight(editor, viewModel, false);
            assertCursor(viewModel, new Position(2, 32));
            moveRight(editor, viewModel, false);
            assertCursor(viewModel, new Position(2, 33));
            moveRight(editor, viewModel, false);
            assertCursor(viewModel, new Position(2, 34));
            moveLeft(editor, viewModel, false);
            assertCursor(viewModel, new Position(2, 33));
            moveLeft(editor, viewModel, false);
            assertCursor(viewModel, new Position(2, 32));
            moveLeft(editor, viewModel, false);
            assertCursor(viewModel, new Position(2, 31));
        });
    });
    test('issue #44805: Should not be able to undo in readonly editor', () => {
        const model = createTextModel([
            ''
        ].join('\n'));
        withTestCodeEditor(model, { readOnly: true }, (editor, viewModel) => {
            model.pushEditOperations([new Selection(1, 1, 1, 1)], [{
                    range: new Range(1, 1, 1, 1),
                    text: 'Hello world!'
                }], () => [new Selection(1, 1, 1, 1)]);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'Hello world!');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'Hello world!');
        });
    });
    test('issue #46314: ViewModel is out of sync with Model!', () => {
        const tokenizationSupport = {
            getInitialState: () => NullState,
            tokenize: undefined,
            tokenizeEncoded: (line, hasEOL, state) => {
                return new EncodedTokenizationResult(new Uint32Array(0), state);
            }
        };
        const LANGUAGE_ID = 'modelModeTest1';
        const languageRegistration = TokenizationRegistry.register(LANGUAGE_ID, tokenizationSupport);
        const model = createTextModel('Just text', LANGUAGE_ID);
        withTestCodeEditor(model, {}, (editor1, cursor1) => {
            withTestCodeEditor(model, {}, (editor2, cursor2) => {
                const disposable = editor1.onDidChangeCursorPosition(() => {
                    model.tokenization.tokenizeIfCheap(1);
                });
                model.applyEdits([{ range: new Range(1, 1, 1, 1), text: '-' }]);
                disposable.dispose();
            });
        });
        languageRegistration.dispose();
        model.dispose();
    });
    test('issue #37967: problem replacing consecutive characters', () => {
        const model = createTextModel([
            'const a = "foo";',
            'const b = ""'
        ].join('\n'));
        withTestCodeEditor(model, { multiCursorMergeOverlapping: false }, (editor, viewModel) => {
            editor.setSelections([
                new Selection(1, 12, 1, 12),
                new Selection(1, 16, 1, 16),
                new Selection(2, 12, 2, 12),
                new Selection(2, 13, 2, 13),
            ]);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assertCursor(viewModel, [
                new Selection(1, 11, 1, 11),
                new Selection(1, 14, 1, 14),
                new Selection(2, 11, 2, 11),
                new Selection(2, 11, 2, 11),
            ]);
            viewModel.type('\'', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'const a = \'foo\';');
            assert.strictEqual(model.getLineContent(2), 'const b = \'\'');
        });
    });
    test('issue #15761: Cursor doesn\'t move in a redo operation', () => {
        const model = createTextModel([
            'hello'
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            editor.setSelections([
                new Selection(1, 4, 1, 4)
            ]);
            editor.executeEdits('test', [{
                    range: new Range(1, 1, 1, 1),
                    text: '*',
                    forceMoveMarkers: true
                }]);
            assertCursor(viewModel, [
                new Selection(1, 5, 1, 5),
            ]);
            editor.runCommand(CoreEditingCommands.Undo, null);
            assertCursor(viewModel, [
                new Selection(1, 4, 1, 4),
            ]);
            editor.runCommand(CoreEditingCommands.Redo, null);
            assertCursor(viewModel, [
                new Selection(1, 5, 1, 5),
            ]);
        });
    });
    test('issue #42783: API Calls with Undo Leave Cursor in Wrong Position', () => {
        const model = createTextModel([
            'ab'
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            editor.setSelections([
                new Selection(1, 1, 1, 1)
            ]);
            editor.executeEdits('test', [{
                    range: new Range(1, 1, 1, 3),
                    text: ''
                }]);
            assertCursor(viewModel, [
                new Selection(1, 1, 1, 1),
            ]);
            editor.runCommand(CoreEditingCommands.Undo, null);
            assertCursor(viewModel, [
                new Selection(1, 1, 1, 1),
            ]);
            editor.executeEdits('test', [{
                    range: new Range(1, 1, 1, 2),
                    text: ''
                }]);
            assertCursor(viewModel, [
                new Selection(1, 1, 1, 1),
            ]);
        });
    });
    test('issue #85712: Paste line moves cursor to start of current line rather than start of next line', () => {
        const model = createTextModel([
            'abc123',
            ''
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            editor.setSelections([
                new Selection(2, 1, 2, 1)
            ]);
            viewModel.paste('something\n', true);
            assert.strictEqual(model.getValue(), [
                'abc123',
                'something',
                ''
            ].join('\n'));
            assertCursor(viewModel, new Position(3, 1));
        });
    });
    test('issue #84897: Left delete behavior in some languages is changed', () => {
        const model = createTextModel([
            'สวัสดี'
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            editor.setSelections([
                new Selection(1, 7, 1, 7)
            ]);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'สวัสด');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'สวัส');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'สวั');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'สว');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'ส');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '');
        });
    });
    test('issue #122914: Left delete behavior in some languages is changed (useTabStops: false)', () => {
        const model = createTextModel([
            'สวัสดี'
        ].join('\n'));
        withTestCodeEditor(model, { useTabStops: false }, (editor, viewModel) => {
            editor.setSelections([
                new Selection(1, 7, 1, 7)
            ]);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'สวัสด');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'สวัส');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'สวั');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'สว');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'ส');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '');
        });
    });
    test('issue #99629: Emoji modifiers in text treated separately when using backspace', () => {
        const model = createTextModel([
            '👶🏾'
        ].join('\n'));
        withTestCodeEditor(model, { useTabStops: false }, (editor, viewModel) => {
            const len = model.getValueLength();
            editor.setSelections([
                new Selection(1, 1 + len, 1, 1 + len)
            ]);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '');
        });
    });
    test('issue #99629: Emoji modifiers in text treated separately when using backspace (ZWJ sequence)', () => {
        const model = createTextModel([
            '👨‍👩🏽‍👧‍👦'
        ].join('\n'));
        withTestCodeEditor(model, { useTabStops: false }, (editor, viewModel) => {
            const len = model.getValueLength();
            editor.setSelections([
                new Selection(1, 1 + len, 1, 1 + len)
            ]);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '👨‍👩🏽‍👧');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '👨‍👩🏽');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '👨');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '');
        });
    });
    test('issue #105730: move left behaves differently for multiple cursors', () => {
        const model = createTextModel('asdfghjkl, asdfghjkl, asdfghjkl, ');
        withTestCodeEditor(model, {
            wordWrap: 'wordWrapColumn',
            wordWrapColumn: 24
        }, (editor, viewModel) => {
            viewModel.setSelections('test', [
                new Selection(1, 10, 1, 12),
                new Selection(1, 21, 1, 23),
                new Selection(1, 32, 1, 34)
            ]);
            moveLeft(editor, viewModel, false);
            assertCursor(viewModel, [
                new Selection(1, 10, 1, 10),
                new Selection(1, 21, 1, 21),
                new Selection(1, 32, 1, 32)
            ]);
            viewModel.setSelections('test', [
                new Selection(1, 10, 1, 12),
                new Selection(1, 21, 1, 23),
                new Selection(1, 32, 1, 34)
            ]);
            moveLeft(editor, viewModel, true);
            assertCursor(viewModel, [
                new Selection(1, 10, 1, 11),
                new Selection(1, 21, 1, 22),
                new Selection(1, 32, 1, 33)
            ]);
        });
    });
    test('issue #105730: move right should always skip wrap point', () => {
        const model = createTextModel('asdfghjkl, asdfghjkl, asdfghjkl, \nasdfghjkl,');
        withTestCodeEditor(model, {
            wordWrap: 'wordWrapColumn',
            wordWrapColumn: 24
        }, (editor, viewModel) => {
            viewModel.setSelections('test', [
                new Selection(1, 22, 1, 22)
            ]);
            moveRight(editor, viewModel, false);
            moveRight(editor, viewModel, false);
            assertCursor(viewModel, [
                new Selection(1, 24, 1, 24),
            ]);
            viewModel.setSelections('test', [
                new Selection(1, 22, 1, 22)
            ]);
            moveRight(editor, viewModel, true);
            moveRight(editor, viewModel, true);
            assertCursor(viewModel, [
                new Selection(1, 22, 1, 24),
            ]);
        });
    });
    test('issue #123178: sticky tab in consecutive wrapped lines', () => {
        const model = createTextModel('    aaaa        aaaa', undefined, { tabSize: 4 });
        withTestCodeEditor(model, {
            wordWrap: 'wordWrapColumn',
            wordWrapColumn: 8,
            stickyTabStops: true,
        }, (editor, viewModel) => {
            viewModel.setSelections('test', [
                new Selection(1, 9, 1, 9)
            ]);
            moveRight(editor, viewModel, false);
            assertCursor(viewModel, [
                new Selection(1, 10, 1, 10),
            ]);
            moveLeft(editor, viewModel, false);
            assertCursor(viewModel, [
                new Selection(1, 9, 1, 9),
            ]);
        });
    });
    test('Cursor honors insertSpaces configuration on new line', () => {
        usingCursor({
            text: [
                '    \tMy First Line\t ',
                '\tMy Second Line',
                '    Third Line',
                '',
                '1'
            ]
        }, (editor, model, viewModel) => {
            CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(1, 21), source: 'keyboard' });
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '    \tMy First Line\t ');
            assert.strictEqual(model.getLineContent(2), '        ');
        });
    });
    test('Cursor honors insertSpaces configuration on tab', () => {
        const model = createTextModel([
            '    \tMy First Line\t ',
            'My Second Line123',
            '    Third Line',
            '',
            '1'
        ].join('\n'), undefined, {
            tabSize: 13,
            indentSize: 13,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            // Tab on column 1
            CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 1) });
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(2), '             My Second Line123');
            editor.runCommand(CoreEditingCommands.Undo, null);
            // Tab on column 2
            assert.strictEqual(model.getLineContent(2), 'My Second Line123');
            CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 2) });
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(2), 'M            y Second Line123');
            editor.runCommand(CoreEditingCommands.Undo, null);
            // Tab on column 3
            assert.strictEqual(model.getLineContent(2), 'My Second Line123');
            CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 3) });
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(2), 'My            Second Line123');
            editor.runCommand(CoreEditingCommands.Undo, null);
            // Tab on column 4
            assert.strictEqual(model.getLineContent(2), 'My Second Line123');
            CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 4) });
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(2), 'My           Second Line123');
            editor.runCommand(CoreEditingCommands.Undo, null);
            // Tab on column 5
            assert.strictEqual(model.getLineContent(2), 'My Second Line123');
            CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 5) });
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(2), 'My S         econd Line123');
            editor.runCommand(CoreEditingCommands.Undo, null);
            // Tab on column 5
            assert.strictEqual(model.getLineContent(2), 'My Second Line123');
            CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 5) });
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(2), 'My S         econd Line123');
            editor.runCommand(CoreEditingCommands.Undo, null);
            // Tab on column 13
            assert.strictEqual(model.getLineContent(2), 'My Second Line123');
            CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 13) });
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(2), 'My Second Li ne123');
            editor.runCommand(CoreEditingCommands.Undo, null);
            // Tab on column 14
            assert.strictEqual(model.getLineContent(2), 'My Second Line123');
            CoreNavigationCommands.MoveTo.runCoreEditorCommand(viewModel, { position: new Position(2, 14) });
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(2), 'My Second Lin             e123');
        });
    });
    test('Enter auto-indents with insertSpaces setting 1', () => {
        const languageId = setupOnEnterLanguage(IndentAction.Indent);
        usingCursor({
            text: [
                '\thello'
            ],
            languageId: languageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 1, 7, false);
            assertCursor(viewModel, new Selection(1, 7, 1, 7));
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getValue(2 /* EndOfLinePreference.CRLF */), '\thello\r\n        ');
        });
    });
    test('Enter auto-indents with insertSpaces setting 2', () => {
        const languageId = setupOnEnterLanguage(IndentAction.None);
        usingCursor({
            text: [
                '\thello'
            ],
            languageId: languageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 1, 7, false);
            assertCursor(viewModel, new Selection(1, 7, 1, 7));
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getValue(2 /* EndOfLinePreference.CRLF */), '\thello\r\n    ');
        });
    });
    test('Enter auto-indents with insertSpaces setting 3', () => {
        const languageId = setupOnEnterLanguage(IndentAction.IndentOutdent);
        usingCursor({
            text: [
                '\thell()'
            ],
            languageId: languageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 1, 7, false);
            assertCursor(viewModel, new Selection(1, 7, 1, 7));
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getValue(2 /* EndOfLinePreference.CRLF */), '\thell(\r\n        \r\n    )');
        });
    });
    test('issue #148256: Pressing Enter creates line with bad indent with insertSpaces: true', () => {
        usingCursor({
            text: [
                '  \t'
            ],
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 1, 4, false);
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getValue(), '  \t\n    ');
        });
    });
    test('issue #148256: Pressing Enter creates line with bad indent with insertSpaces: false', () => {
        usingCursor({
            text: [
                '  \t'
            ]
        }, (editor, model, viewModel) => {
            model.updateOptions({
                insertSpaces: false
            });
            moveTo(editor, viewModel, 1, 4, false);
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getValue(), '  \t\n\t');
        });
    });
    test('removeAutoWhitespace off', () => {
        usingCursor({
            text: [
                '    some  line abc  '
            ],
            modelOpts: {
                trimAutoWhitespace: false
            }
        }, (editor, model, viewModel) => {
            // Move cursor to the end, verify that we do not trim whitespaces if line has values
            moveTo(editor, viewModel, 1, model.getLineContent(1).length + 1);
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '    some  line abc  ');
            assert.strictEqual(model.getLineContent(2), '    ');
            // Try to enter again, we should trimmed previous line
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '    some  line abc  ');
            assert.strictEqual(model.getLineContent(2), '    ');
            assert.strictEqual(model.getLineContent(3), '    ');
        });
    });
    test('removeAutoWhitespace on: removes only whitespace the cursor added 1', () => {
        usingCursor({
            text: [
                '    '
            ]
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 1, model.getLineContent(1).length + 1);
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '    ');
            assert.strictEqual(model.getLineContent(2), '    ');
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '    ');
            assert.strictEqual(model.getLineContent(2), '');
            assert.strictEqual(model.getLineContent(3), '    ');
        });
    });
    test('issue #115033: indent and appendText', () => {
        const languageId = 'onEnterMode';
        disposables.add(languageService.registerLanguage({ id: languageId }));
        disposables.add(languageConfigurationService.register(languageId, {
            onEnterRules: [{
                    beforeText: /.*/,
                    action: {
                        indentAction: IndentAction.Indent,
                        appendText: 'x'
                    }
                }]
        }));
        usingCursor({
            text: [
                'text'
            ],
            languageId: languageId,
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 1, 5);
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'text');
            assert.strictEqual(model.getLineContent(2), '    x');
            assertCursor(viewModel, new Position(2, 6));
        });
    });
    test('issue #6862: Editor removes auto inserted indentation when formatting on type', () => {
        const languageId = setupOnEnterLanguage(IndentAction.IndentOutdent);
        usingCursor({
            text: [
                'function foo (params: string) {}'
            ],
            languageId: languageId,
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 1, 32);
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'function foo (params: string) {');
            assert.strictEqual(model.getLineContent(2), '    ');
            assert.strictEqual(model.getLineContent(3), '}');
            class TestCommand {
                constructor() {
                    this._selectionId = null;
                }
                getEditOperations(model, builder) {
                    builder.addEditOperation(new Range(1, 13, 1, 14), '');
                    this._selectionId = builder.trackSelection(viewModel.getSelection());
                }
                computeCursorState(model, helper) {
                    return helper.getTrackedSelection(this._selectionId);
                }
            }
            viewModel.executeCommand(new TestCommand(), 'autoFormat');
            assert.strictEqual(model.getLineContent(1), 'function foo(params: string) {');
            assert.strictEqual(model.getLineContent(2), '    ');
            assert.strictEqual(model.getLineContent(3), '}');
        });
    });
    test('removeAutoWhitespace on: removes only whitespace the cursor added 2', () => {
        const languageId = 'testLang';
        const registration = languageService.registerLanguage({ id: languageId });
        const model = createTextModel([
            '    if (a) {',
            '        ',
            '',
            '',
            '    }'
        ].join('\n'), languageId);
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 3, 1);
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(1), '    if (a) {');
            assert.strictEqual(model.getLineContent(2), '        ');
            assert.strictEqual(model.getLineContent(3), '    ');
            assert.strictEqual(model.getLineContent(4), '');
            assert.strictEqual(model.getLineContent(5), '    }');
            moveTo(editor, viewModel, 4, 1);
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(1), '    if (a) {');
            assert.strictEqual(model.getLineContent(2), '        ');
            assert.strictEqual(model.getLineContent(3), '');
            assert.strictEqual(model.getLineContent(4), '    ');
            assert.strictEqual(model.getLineContent(5), '    }');
            moveTo(editor, viewModel, 5, model.getLineMaxColumn(5));
            viewModel.type('something', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '    if (a) {');
            assert.strictEqual(model.getLineContent(2), '        ');
            assert.strictEqual(model.getLineContent(3), '');
            assert.strictEqual(model.getLineContent(4), '');
            assert.strictEqual(model.getLineContent(5), '    }something');
        });
        registration.dispose();
    });
    test('removeAutoWhitespace on: test 1', () => {
        const model = createTextModel([
            '    some  line abc  '
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            // Move cursor to the end, verify that we do not trim whitespaces if line has values
            moveTo(editor, viewModel, 1, model.getLineContent(1).length + 1);
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '    some  line abc  ');
            assert.strictEqual(model.getLineContent(2), '    ');
            // Try to enter again, we should trimmed previous line
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '    some  line abc  ');
            assert.strictEqual(model.getLineContent(2), '');
            assert.strictEqual(model.getLineContent(3), '    ');
            // More whitespaces
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(1), '    some  line abc  ');
            assert.strictEqual(model.getLineContent(2), '');
            assert.strictEqual(model.getLineContent(3), '        ');
            // Enter and verify that trimmed again
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '    some  line abc  ');
            assert.strictEqual(model.getLineContent(2), '');
            assert.strictEqual(model.getLineContent(3), '');
            assert.strictEqual(model.getLineContent(4), '        ');
            // Trimmed if we will keep only text
            moveTo(editor, viewModel, 1, 5);
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '    ');
            assert.strictEqual(model.getLineContent(2), '    some  line abc  ');
            assert.strictEqual(model.getLineContent(3), '');
            assert.strictEqual(model.getLineContent(4), '');
            assert.strictEqual(model.getLineContent(5), '');
            // Trimmed if we will keep only text by selection
            moveTo(editor, viewModel, 2, 5);
            moveTo(editor, viewModel, 3, 1, true);
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '    ');
            assert.strictEqual(model.getLineContent(2), '    ');
            assert.strictEqual(model.getLineContent(3), '    ');
            assert.strictEqual(model.getLineContent(4), '');
            assert.strictEqual(model.getLineContent(5), '');
        });
    });
    test('issue #15118: remove auto whitespace when pasting entire line', () => {
        const model = createTextModel([
            '    function f() {',
            '        // I\'m gonna copy this line',
            '        return 3;',
            '    }',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 3, model.getLineMaxColumn(3));
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getValue(), [
                '    function f() {',
                '        // I\'m gonna copy this line',
                '        return 3;',
                '        ',
                '    }',
            ].join('\n'));
            assertCursor(viewModel, new Position(4, model.getLineMaxColumn(4)));
            viewModel.paste('        // I\'m gonna copy this line\n', true);
            assert.strictEqual(model.getValue(), [
                '    function f() {',
                '        // I\'m gonna copy this line',
                '        return 3;',
                '        // I\'m gonna copy this line',
                '',
                '    }',
            ].join('\n'));
            assertCursor(viewModel, new Position(5, 1));
        });
    });
    test('issue #40695: maintain cursor position when copying lines using ctrl+c, ctrl+v', () => {
        const model = createTextModel([
            '    function f() {',
            '        // I\'m gonna copy this line',
            '        // Another line',
            '        return 3;',
            '    }',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            editor.setSelections([new Selection(4, 10, 4, 10)]);
            viewModel.paste('        // I\'m gonna copy this line\n', true);
            assert.strictEqual(model.getValue(), [
                '    function f() {',
                '        // I\'m gonna copy this line',
                '        // Another line',
                '        // I\'m gonna copy this line',
                '        return 3;',
                '    }',
            ].join('\n'));
            assertCursor(viewModel, new Position(5, 10));
        });
    });
    test('UseTabStops is off', () => {
        const model = createTextModel([
            '    x',
            '        a    ',
            '    '
        ].join('\n'));
        withTestCodeEditor(model, { useTabStops: false }, (editor, viewModel) => {
            // DeleteLeft removes just one whitespace
            moveTo(editor, viewModel, 2, 9);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(2), '       a    ');
        });
    });
    test('Backspace removes whitespaces with tab size', () => {
        const model = createTextModel([
            ' \t \t     x',
            '        a    ',
            '    '
        ].join('\n'));
        withTestCodeEditor(model, { useTabStops: true }, (editor, viewModel) => {
            // DeleteLeft does not remove tab size, because some text exists before
            moveTo(editor, viewModel, 2, model.getLineContent(2).length + 1);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(2), '        a   ');
            // DeleteLeft removes tab size = 4
            moveTo(editor, viewModel, 2, 9);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(2), '    a   ');
            // DeleteLeft removes tab size = 4
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(2), 'a   ');
            // Undo DeleteLeft - get us back to original indentation
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(2), '        a   ');
            // Nothing is broken when cursor is in (1,1)
            moveTo(editor, viewModel, 1, 1);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(1), ' \t \t     x');
            // DeleteLeft stops at tab stops even in mixed whitespace case
            moveTo(editor, viewModel, 1, 10);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(1), ' \t \t    x');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(1), ' \t \tx');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(1), ' \tx');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(1), 'x');
            // DeleteLeft on last line
            moveTo(editor, viewModel, 3, model.getLineContent(3).length + 1);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(3), '');
            // DeleteLeft with removing new line symbol
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'x\n        a   ');
            // In case of selection DeleteLeft only deletes selected text
            moveTo(editor, viewModel, 2, 3);
            moveTo(editor, viewModel, 2, 4, true);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(2), '       a   ');
        });
    });
    test('PR #5423: Auto indent + undo + redo is funky', () => {
        const model = createTextModel([
            ''
        ].join('\n'), undefined, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n', 'assert1');
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\t', 'assert2');
            viewModel.type('y', 'keyboard');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\ty', 'assert2');
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\ty\n\t', 'assert3');
            viewModel.type('x');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\ty\n\tx', 'assert4');
            CoreNavigationCommands.CursorLeft.runCoreEditorCommand(viewModel, {});
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\ty\n\tx', 'assert5');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\ty\nx', 'assert6');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\tyx', 'assert7');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\tx', 'assert8');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\nx', 'assert9');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'x', 'assert10');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\nx', 'assert11');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\ty\nx', 'assert12');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\ty\n\tx', 'assert13');
            editor.runCommand(CoreEditingCommands.Redo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\n\ty\nx', 'assert14');
            editor.runCommand(CoreEditingCommands.Redo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '\nx', 'assert15');
            editor.runCommand(CoreEditingCommands.Redo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'x', 'assert16');
        });
    });
    test('issue #90973: Undo brings back model alternative version', () => {
        const model = createTextModel([
            ''
        ].join('\n'), undefined, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            const beforeVersion = model.getVersionId();
            const beforeAltVersion = model.getAlternativeVersionId();
            viewModel.type('Hello', 'keyboard');
            editor.runCommand(CoreEditingCommands.Undo, null);
            const afterVersion = model.getVersionId();
            const afterAltVersion = model.getAlternativeVersionId();
            assert.notStrictEqual(beforeVersion, afterVersion);
            assert.strictEqual(beforeAltVersion, afterAltVersion);
        });
    });
    test('Enter honors increaseIndentPattern', () => {
        usingCursor({
            text: [
                'if (true) {',
                '\tif (true) {'
            ],
            languageId: indentRulesLanguageId,
            modelOpts: { insertSpaces: false },
            editorOpts: { autoIndent: 'full' }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 1, 12, false);
            assertCursor(viewModel, new Selection(1, 12, 1, 12));
            viewModel.type('\n', 'keyboard');
            model.tokenization.forceTokenization(model.getLineCount());
            assertCursor(viewModel, new Selection(2, 2, 2, 2));
            moveTo(editor, viewModel, 3, 13, false);
            assertCursor(viewModel, new Selection(3, 13, 3, 13));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(4, 3, 4, 3));
        });
    });
    test('Type honors decreaseIndentPattern', () => {
        usingCursor({
            text: [
                'if (true) {',
                '\t'
            ],
            languageId: indentRulesLanguageId,
            editorOpts: { autoIndent: 'full' }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 2, false);
            assertCursor(viewModel, new Selection(2, 2, 2, 2));
            viewModel.type('}', 'keyboard');
            assertCursor(viewModel, new Selection(2, 2, 2, 2));
            assert.strictEqual(model.getLineContent(2), '}', '001');
        });
    });
    test('Enter honors unIndentedLinePattern', () => {
        usingCursor({
            text: [
                'if (true) {',
                '\t\t\treturn true'
            ],
            languageId: indentRulesLanguageId,
            modelOpts: { insertSpaces: false },
            editorOpts: { autoIndent: 'full' }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 15, false);
            assertCursor(viewModel, new Selection(2, 15, 2, 15));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(3, 2, 3, 2));
        });
    });
    test('Enter honors indentNextLinePattern', () => {
        usingCursor({
            text: [
                'if (true)',
                '\treturn true;',
                'if (true)',
                '\t\t\t\treturn true'
            ],
            languageId: indentRulesLanguageId,
            modelOpts: { insertSpaces: false },
            editorOpts: { autoIndent: 'full' }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 14, false);
            assertCursor(viewModel, new Selection(2, 14, 2, 14));
            viewModel.type('\n', 'keyboard');
            model.tokenization.forceTokenization(model.getLineCount());
            assertCursor(viewModel, new Selection(3, 1, 3, 1));
            moveTo(editor, viewModel, 5, 16, false);
            assertCursor(viewModel, new Selection(5, 16, 5, 16));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(6, 2, 6, 2));
        });
    });
    test('Enter honors indentNextLinePattern 2', () => {
        const model = createTextModel([
            'if (true)',
            '\tif (true)'
        ].join('\n'), indentRulesLanguageId, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, { autoIndent: 'full' }, (editor, viewModel) => {
            moveTo(editor, viewModel, 2, 11, false);
            assertCursor(viewModel, new Selection(2, 11, 2, 11));
            viewModel.type('\n', 'keyboard');
            model.tokenization.forceTokenization(model.getLineCount());
            assertCursor(viewModel, new Selection(3, 3, 3, 3));
            viewModel.type('console.log();', 'keyboard');
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(4, 1, 4, 1));
        });
    });
    test('Enter honors intential indent', () => {
        usingCursor({
            text: [
                'if (true) {',
                '\tif (true) {',
                'return true;',
                '}}'
            ],
            languageId: indentRulesLanguageId,
            editorOpts: { autoIndent: 'full' }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 3, 13, false);
            assertCursor(viewModel, new Selection(3, 13, 3, 13));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(4, 1, 4, 1));
            assert.strictEqual(model.getLineContent(3), 'return true;', '001');
        });
    });
    test('Enter supports selection 1', () => {
        usingCursor({
            text: [
                'if (true) {',
                '\tif (true) {',
                '\t\treturn true;',
                '\t}a}'
            ],
            languageId: indentRulesLanguageId,
            modelOpts: { insertSpaces: false }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 4, 3, false);
            moveTo(editor, viewModel, 4, 4, true);
            assertCursor(viewModel, new Selection(4, 3, 4, 4));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(5, 1, 5, 1));
            assert.strictEqual(model.getLineContent(4), '\t}', '001');
        });
    });
    test('Enter supports selection 2', () => {
        usingCursor({
            text: [
                'if (true) {',
                '\tif (true) {'
            ],
            languageId: indentRulesLanguageId,
            modelOpts: { insertSpaces: false }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 12, false);
            moveTo(editor, viewModel, 2, 13, true);
            assertCursor(viewModel, new Selection(2, 12, 2, 13));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(3, 3, 3, 3));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(4, 3, 4, 3));
        });
    });
    test('Enter honors tabSize and insertSpaces 1', () => {
        usingCursor({
            text: [
                'if (true) {',
                '\tif (true) {'
            ],
            languageId: indentRulesLanguageId,
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 1, 12, false);
            assertCursor(viewModel, new Selection(1, 12, 1, 12));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(2, 5, 2, 5));
            model.tokenization.forceTokenization(model.getLineCount());
            moveTo(editor, viewModel, 3, 13, false);
            assertCursor(viewModel, new Selection(3, 13, 3, 13));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(4, 9, 4, 9));
        });
    });
    test('Enter honors tabSize and insertSpaces 2', () => {
        usingCursor({
            text: [
                'if (true) {',
                '    if (true) {'
            ],
            languageId: indentRulesLanguageId,
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 1, 12, false);
            assertCursor(viewModel, new Selection(1, 12, 1, 12));
            viewModel.type('\n', 'keyboard');
            model.tokenization.forceTokenization(model.getLineCount());
            assertCursor(viewModel, new Selection(2, 5, 2, 5));
            moveTo(editor, viewModel, 3, 16, false);
            assertCursor(viewModel, new Selection(3, 16, 3, 16));
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(3), '    if (true) {');
            assertCursor(viewModel, new Selection(4, 9, 4, 9));
        });
    });
    test('Enter honors tabSize and insertSpaces 3', () => {
        usingCursor({
            text: [
                'if (true) {',
                '    if (true) {'
            ],
            languageId: indentRulesLanguageId,
            modelOpts: { insertSpaces: false }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 1, 12, false);
            assertCursor(viewModel, new Selection(1, 12, 1, 12));
            viewModel.type('\n', 'keyboard');
            model.tokenization.forceTokenization(model.getLineCount());
            assertCursor(viewModel, new Selection(2, 2, 2, 2));
            moveTo(editor, viewModel, 3, 16, false);
            assertCursor(viewModel, new Selection(3, 16, 3, 16));
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(3), '    if (true) {');
            assertCursor(viewModel, new Selection(4, 3, 4, 3));
        });
    });
    test('Enter supports intentional indentation', () => {
        usingCursor({
            text: [
                '\tif (true) {',
                '\t\tswitch(true) {',
                '\t\t\tcase true:',
                '\t\t\t\tbreak;',
                '\t\t}',
                '\t}'
            ],
            languageId: indentRulesLanguageId,
            modelOpts: { insertSpaces: false },
            editorOpts: { autoIndent: 'full' }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 5, 4, false);
            assertCursor(viewModel, new Selection(5, 4, 5, 4));
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(5), '\t\t}');
            assertCursor(viewModel, new Selection(6, 3, 6, 3));
        });
    });
    test('Enter should not adjust cursor position when press enter in the middle of a line 1', () => {
        usingCursor({
            text: [
                'if (true) {',
                '\tif (true) {',
                '\t\treturn true;',
                '\t}a}'
            ],
            languageId: indentRulesLanguageId,
            modelOpts: { insertSpaces: false }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 3, 9, false);
            assertCursor(viewModel, new Selection(3, 9, 3, 9));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(4, 3, 4, 3));
            assert.strictEqual(model.getLineContent(4), '\t\t true;', '001');
        });
    });
    test('Enter should not adjust cursor position when press enter in the middle of a line 2', () => {
        usingCursor({
            text: [
                'if (true) {',
                '\tif (true) {',
                '\t\treturn true;',
                '\t}a}'
            ],
            languageId: indentRulesLanguageId,
            modelOpts: { insertSpaces: false }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 3, 3, false);
            assertCursor(viewModel, new Selection(3, 3, 3, 3));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(4, 3, 4, 3));
            assert.strictEqual(model.getLineContent(4), '\t\treturn true;', '001');
        });
    });
    test('Enter should not adjust cursor position when press enter in the middle of a line 3', () => {
        usingCursor({
            text: [
                'if (true) {',
                '  if (true) {',
                '    return true;',
                '  }a}'
            ],
            languageId: indentRulesLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 3, 11, false);
            assertCursor(viewModel, new Selection(3, 11, 3, 11));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(4, 5, 4, 5));
            assert.strictEqual(model.getLineContent(4), '     true;', '001');
        });
    });
    test('Enter should adjust cursor position when press enter in the middle of leading whitespaces 1', () => {
        usingCursor({
            text: [
                'if (true) {',
                '\tif (true) {',
                '\t\treturn true;',
                '\t}a}'
            ],
            languageId: indentRulesLanguageId,
            modelOpts: { insertSpaces: false }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 3, 2, false);
            assertCursor(viewModel, new Selection(3, 2, 3, 2));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(4, 2, 4, 2));
            assert.strictEqual(model.getLineContent(4), '\t\treturn true;', '001');
            moveTo(editor, viewModel, 4, 1, false);
            assertCursor(viewModel, new Selection(4, 1, 4, 1));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(5, 1, 5, 1));
            assert.strictEqual(model.getLineContent(5), '\t\treturn true;', '002');
        });
    });
    test('Enter should adjust cursor position when press enter in the middle of leading whitespaces 2', () => {
        usingCursor({
            text: [
                '\tif (true) {',
                '\t\tif (true) {',
                '\t    \treturn true;',
                '\t\t}a}'
            ],
            languageId: indentRulesLanguageId,
            modelOpts: { insertSpaces: false }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 3, 4, false);
            assertCursor(viewModel, new Selection(3, 4, 3, 4));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(4, 3, 4, 3));
            assert.strictEqual(model.getLineContent(4), '\t\t\treturn true;', '001');
            moveTo(editor, viewModel, 4, 1, false);
            assertCursor(viewModel, new Selection(4, 1, 4, 1));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(5, 1, 5, 1));
            assert.strictEqual(model.getLineContent(5), '\t\t\treturn true;', '002');
        });
    });
    test('Enter should adjust cursor position when press enter in the middle of leading whitespaces 3', () => {
        usingCursor({
            text: [
                'if (true) {',
                '  if (true) {',
                '    return true;',
                '}a}'
            ],
            languageId: indentRulesLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 3, 2, false);
            assertCursor(viewModel, new Selection(3, 2, 3, 2));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(4, 2, 4, 2));
            assert.strictEqual(model.getLineContent(4), '    return true;', '001');
            moveTo(editor, viewModel, 4, 3, false);
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(5, 3, 5, 3));
            assert.strictEqual(model.getLineContent(5), '    return true;', '002');
        });
    });
    test('Enter should adjust cursor position when press enter in the middle of leading whitespaces 4', () => {
        usingCursor({
            text: [
                'if (true) {',
                '  if (true) {',
                '\t  return true;',
                '}a}',
                '',
                'if (true) {',
                '  if (true) {',
                '\t  return true;',
                '}a}'
            ],
            languageId: indentRulesLanguageId,
            modelOpts: {
                tabSize: 2,
                indentSize: 2
            }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 3, 3, false);
            assertCursor(viewModel, new Selection(3, 3, 3, 3));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(4, 4, 4, 4));
            assert.strictEqual(model.getLineContent(4), '    return true;', '001');
            moveTo(editor, viewModel, 9, 4, false);
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(10, 5, 10, 5));
            assert.strictEqual(model.getLineContent(10), '    return true;', '001');
        });
    });
    test('Enter should adjust cursor position when press enter in the middle of leading whitespaces 5', () => {
        usingCursor({
            text: [
                'if (true) {',
                '  if (true) {',
                '    return true;',
                '    return true;',
                ''
            ],
            languageId: indentRulesLanguageId,
            modelOpts: { tabSize: 2 }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 3, 5, false);
            moveTo(editor, viewModel, 4, 3, true);
            assertCursor(viewModel, new Selection(3, 5, 4, 3));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(4, 3, 4, 3));
            assert.strictEqual(model.getLineContent(4), '    return true;', '001');
        });
    });
    test('issue microsoft/monaco-editor#108 part 1/2: Auto indentation on Enter with selection is half broken', () => {
        usingCursor({
            text: [
                'function baz() {',
                '\tvar x = 1;',
                '\t\t\t\t\t\t\treturn x;',
                '}'
            ],
            modelOpts: {
                insertSpaces: false,
            },
            languageId: indentRulesLanguageId,
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 3, 8, false);
            moveTo(editor, viewModel, 2, 12, true);
            assertCursor(viewModel, new Selection(3, 8, 2, 12));
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(3), '\treturn x;');
            assertCursor(viewModel, new Position(3, 2));
        });
    });
    test('issue microsoft/monaco-editor#108 part 2/2: Auto indentation on Enter with selection is half broken', () => {
        usingCursor({
            text: [
                'function baz() {',
                '\tvar x = 1;',
                '\t\t\t\t\t\t\treturn x;',
                '}'
            ],
            modelOpts: {
                insertSpaces: false,
            },
            languageId: indentRulesLanguageId,
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 12, false);
            moveTo(editor, viewModel, 3, 8, true);
            assertCursor(viewModel, new Selection(2, 12, 3, 8));
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(3), '\treturn x;');
            assertCursor(viewModel, new Position(3, 2));
        });
    });
    test('onEnter works if there are no indentation rules', () => {
        usingCursor({
            text: [
                '<?',
                '\tif (true) {',
                '\t\techo $hi;',
                '\t\techo $bye;',
                '\t}',
                '?>'
            ],
            modelOpts: { insertSpaces: false }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 5, 3, false);
            assertCursor(viewModel, new Selection(5, 3, 5, 3));
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getLineContent(6), '\t');
            assertCursor(viewModel, new Selection(6, 2, 6, 2));
            assert.strictEqual(model.getLineContent(5), '\t}');
        });
    });
    test('onEnter works if there are no indentation rules 2', () => {
        usingCursor({
            text: [
                '	if (5)',
                '		return 5;',
                '	'
            ],
            modelOpts: { insertSpaces: false }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 3, 2, false);
            assertCursor(viewModel, new Selection(3, 2, 3, 2));
            viewModel.type('\n', 'keyboard');
            assertCursor(viewModel, new Selection(4, 2, 4, 2));
            assert.strictEqual(model.getLineContent(4), '\t');
        });
    });
    test('bug #16543: Tab should indent to correct indentation spot immediately', () => {
        const model = createTextModel([
            'function baz() {',
            '\tfunction hello() { // something here',
            '\t',
            '',
            '\t}',
            '}'
        ].join('\n'), indentRulesLanguageId, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 4, 1, false);
            assertCursor(viewModel, new Selection(4, 1, 4, 1));
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(4), '\t\t');
        });
    });
    test('bug #2938 (1): When pressing Tab on white-space only lines, indent straight to the right spot (similar to empty lines)', () => {
        const model = createTextModel([
            '\tfunction baz() {',
            '\t\tfunction hello() { // something here',
            '\t\t',
            '\t',
            '\t\t}',
            '\t}'
        ].join('\n'), indentRulesLanguageId, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 4, 2, false);
            assertCursor(viewModel, new Selection(4, 2, 4, 2));
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(4), '\t\t\t');
        });
    });
    test('bug #2938 (2): When pressing Tab on white-space only lines, indent straight to the right spot (similar to empty lines)', () => {
        const model = createTextModel([
            '\tfunction baz() {',
            '\t\tfunction hello() { // something here',
            '\t\t',
            '    ',
            '\t\t}',
            '\t}'
        ].join('\n'), indentRulesLanguageId, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 4, 1, false);
            assertCursor(viewModel, new Selection(4, 1, 4, 1));
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(4), '\t\t\t');
        });
    });
    test('bug #2938 (3): When pressing Tab on white-space only lines, indent straight to the right spot (similar to empty lines)', () => {
        const model = createTextModel([
            '\tfunction baz() {',
            '\t\tfunction hello() { // something here',
            '\t\t',
            '\t\t\t',
            '\t\t}',
            '\t}'
        ].join('\n'), indentRulesLanguageId, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 4, 3, false);
            assertCursor(viewModel, new Selection(4, 3, 4, 3));
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(4), '\t\t\t\t');
        });
    });
    test('bug #2938 (4): When pressing Tab on white-space only lines, indent straight to the right spot (similar to empty lines)', () => {
        const model = createTextModel([
            '\tfunction baz() {',
            '\t\tfunction hello() { // something here',
            '\t\t',
            '\t\t\t\t',
            '\t\t}',
            '\t}'
        ].join('\n'), indentRulesLanguageId, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 4, 4, false);
            assertCursor(viewModel, new Selection(4, 4, 4, 4));
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(4), '\t\t\t\t\t');
        });
    });
    test('bug #31015: When pressing Tab on lines and Enter rules are avail, indent straight to the right spotTab', () => {
        const onEnterLanguageId = setupOnEnterLanguage(IndentAction.Indent);
        const model = createTextModel([
            '    if (a) {',
            '        ',
            '',
            '',
            '    }'
        ].join('\n'), onEnterLanguageId);
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            moveTo(editor, viewModel, 3, 1);
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getLineContent(1), '    if (a) {');
            assert.strictEqual(model.getLineContent(2), '        ');
            assert.strictEqual(model.getLineContent(3), '        ');
            assert.strictEqual(model.getLineContent(4), '');
            assert.strictEqual(model.getLineContent(5), '    }');
        });
    });
    test('type honors indentation rules: ruby keywords', () => {
        const rubyLanguageId = setupIndentRulesLanguage('ruby', {
            increaseIndentPattern: /^\s*((begin|class|def|else|elsif|ensure|for|if|module|rescue|unless|until|when|while)|(.*\sdo\b))\b[^\{;]*$/,
            decreaseIndentPattern: /^\s*([}\]]([,)]?\s*(#|$)|\.[a-zA-Z_]\w*\b)|(end|rescue|ensure|else|elsif|when)\b)/
        });
        const model = createTextModel([
            'class Greeter',
            '  def initialize(name)',
            '    @name = name',
            '    en'
        ].join('\n'), rubyLanguageId);
        withTestCodeEditor(model, { autoIndent: 'full' }, (editor, viewModel) => {
            moveTo(editor, viewModel, 4, 7, false);
            assertCursor(viewModel, new Selection(4, 7, 4, 7));
            viewModel.type('d', 'keyboard');
            assert.strictEqual(model.getLineContent(4), '  end');
        });
    });
    test('Auto indent on type: increaseIndentPattern has higher priority than decreaseIndent when inheriting', () => {
        usingCursor({
            text: [
                '\tif (true) {',
                '\t\tconsole.log();',
                '\t} else if {',
                '\t\tconsole.log()',
                '\t}'
            ],
            languageId: indentRulesLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 5, 3, false);
            assertCursor(viewModel, new Selection(5, 3, 5, 3));
            viewModel.type('e', 'keyboard');
            assertCursor(viewModel, new Selection(5, 4, 5, 4));
            assert.strictEqual(model.getLineContent(5), '\t}e', 'This line should not decrease indent');
        });
    });
    test('type honors users indentation adjustment', () => {
        usingCursor({
            text: [
                '\tif (true ||',
                '\t ) {',
                '\t}',
                'if (true ||',
                ') {',
                '}'
            ],
            languageId: indentRulesLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 3, false);
            assertCursor(viewModel, new Selection(2, 3, 2, 3));
            viewModel.type(' ', 'keyboard');
            assertCursor(viewModel, new Selection(2, 4, 2, 4));
            assert.strictEqual(model.getLineContent(2), '\t  ) {', 'This line should not decrease indent');
        });
    });
    test('bug 29972: if a line is line comment, open bracket should not indent next line', () => {
        usingCursor({
            text: [
                'if (true) {',
                '\t// {',
                '\t\t'
            ],
            languageId: indentRulesLanguageId,
            editorOpts: { autoIndent: 'full' }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 3, 3, false);
            assertCursor(viewModel, new Selection(3, 3, 3, 3));
            viewModel.type('}', 'keyboard');
            assertCursor(viewModel, new Selection(3, 2, 3, 2));
            assert.strictEqual(model.getLineContent(3), '}');
        });
    });
    test('issue #38261: TAB key results in bizarre indentation in C++ mode ', () => {
        const languageId = 'indentRulesMode';
        disposables.add(languageService.registerLanguage({ id: languageId }));
        disposables.add(languageConfigurationService.register(languageId, {
            brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')']
            ],
            indentationRules: {
                increaseIndentPattern: new RegExp('(^.*\\{[^}]*$)'),
                decreaseIndentPattern: new RegExp('^\\s*\\}')
            }
        }));
        const model = createTextModel([
            'int main() {',
            '  return 0;',
            '}',
            '',
            'bool Foo::bar(const string &a,',
            '              const string &b) {',
            '  foo();',
            '',
            ')',
        ].join('\n'), languageId, {
            tabSize: 2,
            indentSize: 2
        });
        withTestCodeEditor(model, { autoIndent: 'advanced' }, (editor, viewModel) => {
            moveTo(editor, viewModel, 8, 1, false);
            assertCursor(viewModel, new Selection(8, 1, 8, 1));
            editor.runCommand(CoreEditingCommands.Tab, null);
            assert.strictEqual(model.getValue(), [
                'int main() {',
                '  return 0;',
                '}',
                '',
                'bool Foo::bar(const string &a,',
                '              const string &b) {',
                '  foo();',
                '  ',
                ')',
            ].join('\n'));
            assert.deepStrictEqual(viewModel.getSelection(), new Selection(8, 3, 8, 3));
        });
    });
    test('issue #57197: indent rules regex should be stateless', () => {
        const languageId = setupIndentRulesLanguage('lang', {
            decreaseIndentPattern: /^\s*}$/gm,
            increaseIndentPattern: /^(?![^\S\n]*(?!--|––|——)(?:[-❍❑■⬜□☐▪▫–—≡→›✘xX✔✓☑+]|\[[ xX+-]?\])\s[^\n]*)[^\S\n]*(.+:)[^\S\n]*(?:(?=@[^\s*~(]+(?::\/\/[^\s*~(:]+)?(?:\([^)]*\))?)|$)/gm,
        });
        usingCursor({
            text: [
                'Project:',
            ],
            languageId: languageId,
            modelOpts: { insertSpaces: false },
            editorOpts: { autoIndent: 'full' }
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 1, 9, false);
            assertCursor(viewModel, new Selection(1, 9, 1, 9));
            viewModel.type('\n', 'keyboard');
            model.tokenization.forceTokenization(model.getLineCount());
            assertCursor(viewModel, new Selection(2, 2, 2, 2));
            moveTo(editor, viewModel, 1, 9, false);
            assertCursor(viewModel, new Selection(1, 9, 1, 9));
            viewModel.type('\n', 'keyboard');
            model.tokenization.forceTokenization(model.getLineCount());
            assertCursor(viewModel, new Selection(2, 2, 2, 2));
        });
    });
    test('typing in json', () => {
        const languageId = 'indentRulesMode';
        disposables.add(languageService.registerLanguage({ id: languageId }));
        disposables.add(languageConfigurationService.register(languageId, {
            brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')']
            ],
            indentationRules: {
                increaseIndentPattern: new RegExp('({+(?=([^"]*"[^"]*")*[^"}]*$))|(\\[+(?=([^"]*"[^"]*")*[^"\\]]*$))'),
                decreaseIndentPattern: new RegExp('^\\s*[}\\]],?\\s*$')
            }
        }));
        const model = createTextModel([
            '{',
            '  "scripts: {"',
            '    "watch": "a {"',
            '    "build{": "b"',
            '    "tasks": []',
            '    "tasks": ["a"]',
            '  "}"',
            '"}"'
        ].join('\n'), languageId, {
            tabSize: 2,
            indentSize: 2
        });
        withTestCodeEditor(model, { autoIndent: 'full' }, (editor, viewModel) => {
            moveTo(editor, viewModel, 3, 19, false);
            assertCursor(viewModel, new Selection(3, 19, 3, 19));
            viewModel.type('\n', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(4), '    ');
            moveTo(editor, viewModel, 5, 18, false);
            assertCursor(viewModel, new Selection(5, 18, 5, 18));
            viewModel.type('\n', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(6), '    ');
            moveTo(editor, viewModel, 7, 15, false);
            assertCursor(viewModel, new Selection(7, 15, 7, 15));
            viewModel.type('\n', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(8), '      ');
            assert.deepStrictEqual(model.getLineContent(9), '    ]');
            moveTo(editor, viewModel, 10, 18, false);
            assertCursor(viewModel, new Selection(10, 18, 10, 18));
            viewModel.type('\n', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(11), '    ]');
        });
    });
    test('issue #111128: Multicursor `Enter` issue with indentation', () => {
        const model = createTextModel('    let a, b, c;', indentRulesLanguageId, { detectIndentation: false, insertSpaces: false, tabSize: 4 });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            editor.setSelections([
                new Selection(1, 11, 1, 11),
                new Selection(1, 14, 1, 14),
            ]);
            viewModel.type('\n', 'keyboard');
            assert.strictEqual(model.getValue(), '    let a,\n\t b,\n\t c;');
        });
    });
    test('issue #122714: tabSize=1 prevent typing a string matching decreaseIndentPattern in an empty file', () => {
        const latextLanguageId = setupIndentRulesLanguage('latex', {
            increaseIndentPattern: new RegExp('\\\\begin{(?!document)([^}]*)}(?!.*\\\\end{\\1})'),
            decreaseIndentPattern: new RegExp('^\\s*\\\\end{(?!document)')
        });
        const model = createTextModel('\\end', latextLanguageId, { tabSize: 1 });
        withTestCodeEditor(model, { autoIndent: 'full' }, (editor, viewModel) => {
            moveTo(editor, viewModel, 1, 5, false);
            assertCursor(viewModel, new Selection(1, 5, 1, 5));
            viewModel.type('{', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '\\end{}');
        });
    });
    test('ElectricCharacter - does nothing if no electric char', () => {
        usingCursor({
            text: [
                '  if (a) {',
                ''
            ],
            languageId: electricCharLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 1);
            viewModel.type('*', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(2), '*');
        });
    });
    test('ElectricCharacter - indents in order to match bracket', () => {
        usingCursor({
            text: [
                '  if (a) {',
                ''
            ],
            languageId: electricCharLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 1);
            viewModel.type('}', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(2), '  }');
        });
    });
    test('ElectricCharacter - unindents in order to match bracket', () => {
        usingCursor({
            text: [
                '  if (a) {',
                '    '
            ],
            languageId: electricCharLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 5);
            viewModel.type('}', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(2), '  }');
        });
    });
    test('ElectricCharacter - matches with correct bracket', () => {
        usingCursor({
            text: [
                '  if (a) {',
                '    if (b) {',
                '    }',
                '    '
            ],
            languageId: electricCharLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 4, 1);
            viewModel.type('}', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(4), '  }    ');
        });
    });
    test('ElectricCharacter - does nothing if bracket does not match', () => {
        usingCursor({
            text: [
                '  if (a) {',
                '    if (b) {',
                '    }',
                '  }  '
            ],
            languageId: electricCharLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 4, 6);
            viewModel.type('}', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(4), '  }  }');
        });
    });
    test('ElectricCharacter - matches bracket even in line with content', () => {
        usingCursor({
            text: [
                '  if (a) {',
                '// hello'
            ],
            languageId: electricCharLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 1);
            viewModel.type('}', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(2), '  }// hello');
        });
    });
    test('ElectricCharacter - is no-op if bracket is lined up', () => {
        usingCursor({
            text: [
                '  if (a) {',
                '  '
            ],
            languageId: electricCharLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 3);
            viewModel.type('}', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(2), '  }');
        });
    });
    test('ElectricCharacter - is no-op if there is non-whitespace text before', () => {
        usingCursor({
            text: [
                '  if (a) {',
                'a'
            ],
            languageId: electricCharLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 2);
            viewModel.type('}', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(2), 'a}');
        });
    });
    test('ElectricCharacter - is no-op if pairs are all matched before', () => {
        usingCursor({
            text: [
                'foo(() => {',
                '  ( 1 + 2 ) ',
                '})'
            ],
            languageId: electricCharLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 13);
            viewModel.type('*', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(2), '  ( 1 + 2 ) *');
        });
    });
    test('ElectricCharacter - is no-op if matching bracket is on the same line', () => {
        usingCursor({
            text: [
                '(div',
            ],
            languageId: electricCharLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 1, 5);
            let changeText = null;
            const disposable = model.onDidChangeContent(e => {
                changeText = e.changes[0].text;
            });
            viewModel.type(')', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(1), '(div)');
            assert.deepStrictEqual(changeText, ')');
            disposable.dispose();
        });
    });
    test('ElectricCharacter - is no-op if the line has other content', () => {
        usingCursor({
            text: [
                'Math.max(',
                '\t2',
                '\t3'
            ],
            languageId: electricCharLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 3, 3);
            viewModel.type(')', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(3), '\t3)');
        });
    });
    test('ElectricCharacter - appends text', () => {
        usingCursor({
            text: [
                '  if (a) {',
                '/*'
            ],
            languageId: electricCharLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 3);
            viewModel.type('*', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(2), '/** */');
        });
    });
    test('ElectricCharacter - appends text 2', () => {
        usingCursor({
            text: [
                '  if (a) {',
                '  /*'
            ],
            languageId: electricCharLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 5);
            viewModel.type('*', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(2), '  /** */');
        });
    });
    test('ElectricCharacter - issue #23711: Replacing selected text with )]} fails to delete old text with backwards-dragged selection', () => {
        usingCursor({
            text: [
                '{',
                'word'
            ],
            languageId: electricCharLanguageId
        }, (editor, model, viewModel) => {
            moveTo(editor, viewModel, 2, 5);
            moveTo(editor, viewModel, 2, 1, true);
            viewModel.type('}', 'keyboard');
            assert.deepStrictEqual(model.getLineContent(2), '}');
        });
    });
    test('issue #61070: backtick (`) should auto-close after a word character', () => {
        usingCursor({
            text: ['const markup = highlight'],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            model.tokenization.forceTokenization(1);
            assertType(editor, model, viewModel, 1, 25, '`', '``', `auto closes \` @ (1, 25)`);
        });
    });
    test('issue #132912: quotes should not auto-close if they are closing a string', () => {
        setupAutoClosingLanguageTokenization();
        const model = createTextModel('const t2 = `something ${t1}', autoClosingLanguageId);
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            const model = viewModel.model;
            model.tokenization.forceTokenization(1);
            assertType(editor, model, viewModel, 1, 28, '`', '`', `does not auto close \` @ (1, 28)`);
        });
    });
    test('autoClosingPairs - open parens: default', () => {
        usingCursor({
            text: [
                'var a = [];',
                'var b = `asd`;',
                'var c = \'asd\';',
                'var d = "asd";',
                'var e = /*3*/	3;',
                'var f = /** 3 */3;',
                'var g = (3+5);',
                'var h = { a: \'value\' };',
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            const autoClosePositions = [
                'var| a| |=| [|]|;|',
                'var| b| |=| |`asd|`|;|',
                'var| c| |=| |\'asd|\'|;|',
                'var| d| |=| |"asd|"|;|',
                'var| e| |=| /*3*/|	3|;|',
                'var| f| |=| /**| 3| */3|;|',
                'var| g| |=| (3+5|)|;|',
                'var| h| |=| {| a|:| |\'value|\'| |}|;|',
            ];
            for (let i = 0, len = autoClosePositions.length; i < len; i++) {
                const lineNumber = i + 1;
                const autoCloseColumns = extractAutoClosingSpecialColumns(model.getLineMaxColumn(lineNumber), autoClosePositions[i]);
                for (let column = 1; column < autoCloseColumns.length; column++) {
                    model.tokenization.forceTokenization(lineNumber);
                    if (autoCloseColumns[column] === 1 /* AutoClosingColumnType.Special1 */) {
                        assertType(editor, model, viewModel, lineNumber, column, '(', '()', `auto closes @ (${lineNumber}, ${column})`);
                    }
                    else {
                        assertType(editor, model, viewModel, lineNumber, column, '(', '(', `does not auto close @ (${lineNumber}, ${column})`);
                    }
                }
            }
        });
    });
    test('autoClosingPairs - open parens: whitespace', () => {
        usingCursor({
            text: [
                'var a = [];',
                'var b = `asd`;',
                'var c = \'asd\';',
                'var d = "asd";',
                'var e = /*3*/	3;',
                'var f = /** 3 */3;',
                'var g = (3+5);',
                'var h = { a: \'value\' };',
            ],
            languageId: autoClosingLanguageId,
            editorOpts: {
                autoClosingBrackets: 'beforeWhitespace'
            }
        }, (editor, model, viewModel) => {
            const autoClosePositions = [
                'var| a| =| [|];|',
                'var| b| =| `asd`;|',
                'var| c| =| \'asd\';|',
                'var| d| =| "asd";|',
                'var| e| =| /*3*/|	3;|',
                'var| f| =| /**| 3| */3;|',
                'var| g| =| (3+5|);|',
                'var| h| =| {| a:| \'value\'| |};|',
            ];
            for (let i = 0, len = autoClosePositions.length; i < len; i++) {
                const lineNumber = i + 1;
                const autoCloseColumns = extractAutoClosingSpecialColumns(model.getLineMaxColumn(lineNumber), autoClosePositions[i]);
                for (let column = 1; column < autoCloseColumns.length; column++) {
                    model.tokenization.forceTokenization(lineNumber);
                    if (autoCloseColumns[column] === 1 /* AutoClosingColumnType.Special1 */) {
                        assertType(editor, model, viewModel, lineNumber, column, '(', '()', `auto closes @ (${lineNumber}, ${column})`);
                    }
                    else {
                        assertType(editor, model, viewModel, lineNumber, column, '(', '(', `does not auto close @ (${lineNumber}, ${column})`);
                    }
                }
            }
        });
    });
    test('autoClosingPairs - open parens disabled/enabled open quotes enabled/disabled', () => {
        usingCursor({
            text: [
                'var a = [];',
            ],
            languageId: autoClosingLanguageId,
            editorOpts: {
                autoClosingBrackets: 'beforeWhitespace',
                autoClosingQuotes: 'never'
            }
        }, (editor, model, viewModel) => {
            const autoClosePositions = [
                'var| a| =| [|];|',
            ];
            for (let i = 0, len = autoClosePositions.length; i < len; i++) {
                const lineNumber = i + 1;
                const autoCloseColumns = extractAutoClosingSpecialColumns(model.getLineMaxColumn(lineNumber), autoClosePositions[i]);
                for (let column = 1; column < autoCloseColumns.length; column++) {
                    model.tokenization.forceTokenization(lineNumber);
                    if (autoCloseColumns[column] === 1 /* AutoClosingColumnType.Special1 */) {
                        assertType(editor, model, viewModel, lineNumber, column, '(', '()', `auto closes @ (${lineNumber}, ${column})`);
                    }
                    else {
                        assertType(editor, model, viewModel, lineNumber, column, '(', '(', `does not auto close @ (${lineNumber}, ${column})`);
                    }
                    assertType(editor, model, viewModel, lineNumber, column, '\'', '\'', `does not auto close @ (${lineNumber}, ${column})`);
                }
            }
        });
        usingCursor({
            text: [
                'var b = [];',
            ],
            languageId: autoClosingLanguageId,
            editorOpts: {
                autoClosingBrackets: 'never',
                autoClosingQuotes: 'beforeWhitespace'
            }
        }, (editor, model, viewModel) => {
            const autoClosePositions = [
                'var b =| [|];|',
            ];
            for (let i = 0, len = autoClosePositions.length; i < len; i++) {
                const lineNumber = i + 1;
                const autoCloseColumns = extractAutoClosingSpecialColumns(model.getLineMaxColumn(lineNumber), autoClosePositions[i]);
                for (let column = 1; column < autoCloseColumns.length; column++) {
                    model.tokenization.forceTokenization(lineNumber);
                    if (autoCloseColumns[column] === 1 /* AutoClosingColumnType.Special1 */) {
                        assertType(editor, model, viewModel, lineNumber, column, '\'', '\'\'', `auto closes @ (${lineNumber}, ${column})`);
                    }
                    else {
                        assertType(editor, model, viewModel, lineNumber, column, '\'', '\'', `does not auto close @ (${lineNumber}, ${column})`);
                    }
                    assertType(editor, model, viewModel, lineNumber, column, '(', '(', `does not auto close @ (${lineNumber}, ${column})`);
                }
            }
        });
    });
    test('autoClosingPairs - configurable open parens', () => {
        setAutoClosingLanguageEnabledSet('abc');
        usingCursor({
            text: [
                'var a = [];',
                'var b = `asd`;',
                'var c = \'asd\';',
                'var d = "asd";',
                'var e = /*3*/	3;',
                'var f = /** 3 */3;',
                'var g = (3+5);',
                'var h = { a: \'value\' };',
            ],
            languageId: autoClosingLanguageId,
            editorOpts: {
                autoClosingBrackets: 'languageDefined'
            }
        }, (editor, model, viewModel) => {
            const autoClosePositions = [
                'v|ar |a = [|];|',
                'v|ar |b = `|asd`;|',
                'v|ar |c = \'|asd\';|',
                'v|ar d = "|asd";|',
                'v|ar e = /*3*/	3;|',
                'v|ar f = /** 3| */3;|',
                'v|ar g = (3+5|);|',
                'v|ar h = { |a: \'v|alue\' |};|',
            ];
            for (let i = 0, len = autoClosePositions.length; i < len; i++) {
                const lineNumber = i + 1;
                const autoCloseColumns = extractAutoClosingSpecialColumns(model.getLineMaxColumn(lineNumber), autoClosePositions[i]);
                for (let column = 1; column < autoCloseColumns.length; column++) {
                    model.tokenization.forceTokenization(lineNumber);
                    if (autoCloseColumns[column] === 1 /* AutoClosingColumnType.Special1 */) {
                        assertType(editor, model, viewModel, lineNumber, column, '(', '()', `auto closes @ (${lineNumber}, ${column})`);
                    }
                    else {
                        assertType(editor, model, viewModel, lineNumber, column, '(', '(', `does not auto close @ (${lineNumber}, ${column})`);
                    }
                }
            }
        });
    });
    test('autoClosingPairs - auto-pairing can be disabled', () => {
        usingCursor({
            text: [
                'var a = [];',
                'var b = `asd`;',
                'var c = \'asd\';',
                'var d = "asd";',
                'var e = /*3*/	3;',
                'var f = /** 3 */3;',
                'var g = (3+5);',
                'var h = { a: \'value\' };',
            ],
            languageId: autoClosingLanguageId,
            editorOpts: {
                autoClosingBrackets: 'never',
                autoClosingQuotes: 'never'
            }
        }, (editor, model, viewModel) => {
            const autoClosePositions = [
                'var a = [];',
                'var b = `asd`;',
                'var c = \'asd\';',
                'var d = "asd";',
                'var e = /*3*/	3;',
                'var f = /** 3 */3;',
                'var g = (3+5);',
                'var h = { a: \'value\' };',
            ];
            for (let i = 0, len = autoClosePositions.length; i < len; i++) {
                const lineNumber = i + 1;
                const autoCloseColumns = extractAutoClosingSpecialColumns(model.getLineMaxColumn(lineNumber), autoClosePositions[i]);
                for (let column = 1; column < autoCloseColumns.length; column++) {
                    model.tokenization.forceTokenization(lineNumber);
                    if (autoCloseColumns[column] === 1 /* AutoClosingColumnType.Special1 */) {
                        assertType(editor, model, viewModel, lineNumber, column, '(', '()', `auto closes @ (${lineNumber}, ${column})`);
                        assertType(editor, model, viewModel, lineNumber, column, '"', '""', `auto closes @ (${lineNumber}, ${column})`);
                    }
                    else {
                        assertType(editor, model, viewModel, lineNumber, column, '(', '(', `does not auto close @ (${lineNumber}, ${column})`);
                        assertType(editor, model, viewModel, lineNumber, column, '"', '"', `does not auto close @ (${lineNumber}, ${column})`);
                    }
                }
            }
        });
    });
    test('autoClosingPairs - auto wrapping is configurable', () => {
        usingCursor({
            text: [
                'var a = asd'
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [
                new Selection(1, 1, 1, 4),
                new Selection(1, 9, 1, 12),
            ]);
            // type a `
            viewModel.type('`', 'keyboard');
            assert.strictEqual(model.getValue(), '`var` a = `asd`');
            // type a (
            viewModel.type('(', 'keyboard');
            assert.strictEqual(model.getValue(), '`(var)` a = `(asd)`');
        });
        usingCursor({
            text: [
                'var a = asd'
            ],
            languageId: autoClosingLanguageId,
            editorOpts: {
                autoSurround: 'never'
            }
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [
                new Selection(1, 1, 1, 4),
            ]);
            // type a `
            viewModel.type('`', 'keyboard');
            assert.strictEqual(model.getValue(), '` a = asd');
        });
        usingCursor({
            text: [
                'var a = asd'
            ],
            languageId: autoClosingLanguageId,
            editorOpts: {
                autoSurround: 'quotes'
            }
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [
                new Selection(1, 1, 1, 4),
            ]);
            // type a `
            viewModel.type('`', 'keyboard');
            assert.strictEqual(model.getValue(), '`var` a = asd');
            // type a (
            viewModel.type('(', 'keyboard');
            assert.strictEqual(model.getValue(), '`(` a = asd');
        });
        usingCursor({
            text: [
                'var a = asd'
            ],
            languageId: autoClosingLanguageId,
            editorOpts: {
                autoSurround: 'brackets'
            }
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [
                new Selection(1, 1, 1, 4),
            ]);
            // type a (
            viewModel.type('(', 'keyboard');
            assert.strictEqual(model.getValue(), '(var) a = asd');
            // type a `
            viewModel.type('`', 'keyboard');
            assert.strictEqual(model.getValue(), '(`) a = asd');
        });
    });
    test('autoClosingPairs - quote', () => {
        usingCursor({
            text: [
                'var a = [];',
                'var b = `asd`;',
                'var c = \'asd\';',
                'var d = "asd";',
                'var e = /*3*/	3;',
                'var f = /** 3 */3;',
                'var g = (3+5);',
                'var h = { a: \'value\' };',
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            const autoClosePositions = [
                'var a |=| [|]|;|',
                'var b |=| `asd`|;|',
                'var c |=| \'asd\'|;|',
                'var d |=| "asd"|;|',
                'var e |=| /*3*/|	3;|',
                'var f |=| /**| 3 */3;|',
                'var g |=| (3+5)|;|',
                'var h |=| {| a:| \'value\'| |}|;|',
            ];
            for (let i = 0, len = autoClosePositions.length; i < len; i++) {
                const lineNumber = i + 1;
                const autoCloseColumns = extractAutoClosingSpecialColumns(model.getLineMaxColumn(lineNumber), autoClosePositions[i]);
                for (let column = 1; column < autoCloseColumns.length; column++) {
                    model.tokenization.forceTokenization(lineNumber);
                    if (autoCloseColumns[column] === 1 /* AutoClosingColumnType.Special1 */) {
                        assertType(editor, model, viewModel, lineNumber, column, '\'', '\'\'', `auto closes @ (${lineNumber}, ${column})`);
                    }
                    else if (autoCloseColumns[column] === 2 /* AutoClosingColumnType.Special2 */) {
                        assertType(editor, model, viewModel, lineNumber, column, '\'', '', `over types @ (${lineNumber}, ${column})`);
                    }
                    else {
                        assertType(editor, model, viewModel, lineNumber, column, '\'', '\'', `does not auto close @ (${lineNumber}, ${column})`);
                    }
                }
            }
        });
    });
    test('autoClosingPairs - multi-character autoclose', () => {
        usingCursor({
            text: [
                '',
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            model.setValue('begi');
            viewModel.setSelections('test', [new Selection(1, 5, 1, 5)]);
            viewModel.type('n', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'beginend');
            model.setValue('/*');
            viewModel.setSelections('test', [new Selection(1, 3, 1, 3)]);
            viewModel.type('*', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '/** */');
        });
    });
    test('autoClosingPairs - doc comments can be turned off', () => {
        usingCursor({
            text: [
                '',
            ],
            languageId: autoClosingLanguageId,
            editorOpts: {
                autoClosingComments: 'never'
            }
        }, (editor, model, viewModel) => {
            model.setValue('/*');
            viewModel.setSelections('test', [new Selection(1, 3, 1, 3)]);
            viewModel.type('*', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '/**');
        });
    });
    test('issue #72177: multi-character autoclose with conflicting patterns', () => {
        const languageId = 'autoClosingModeMultiChar';
        disposables.add(languageService.registerLanguage({ id: languageId }));
        disposables.add(languageConfigurationService.register(languageId, {
            autoClosingPairs: [
                { open: '(', close: ')' },
                { open: '(*', close: '*)' },
                { open: '<@', close: '@>' },
                { open: '<@@', close: '@@>' },
            ],
        }));
        usingCursor({
            text: [
                '',
            ],
            languageId: languageId
        }, (editor, model, viewModel) => {
            viewModel.type('(', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '()');
            viewModel.type('*', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '(**)', `doesn't add entire close when already closed substring is there`);
            model.setValue('(');
            viewModel.setSelections('test', [new Selection(1, 2, 1, 2)]);
            viewModel.type('*', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '(**)', `does add entire close if not already there`);
            model.setValue('');
            viewModel.type('<@', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '<@@>');
            viewModel.type('@', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '<@@@@>', `autocloses when before multi-character closing brace`);
            viewModel.type('(', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '<@@()@@>', `autocloses when before multi-character closing brace`);
        });
    });
    test('issue #55314: Do not auto-close when ending with open', () => {
        const languageId = 'myElectricMode';
        disposables.add(languageService.registerLanguage({ id: languageId }));
        disposables.add(languageConfigurationService.register(languageId, {
            autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '\'', close: '\'', notIn: ['string', 'comment'] },
                { open: '\"', close: '\"', notIn: ['string'] },
                { open: 'B\"', close: '\"', notIn: ['string', 'comment'] },
                { open: '`', close: '`', notIn: ['string', 'comment'] },
                { open: '/**', close: ' */', notIn: ['string'] }
            ],
        }));
        usingCursor({
            text: [
                'little goat',
                'little LAMB',
                'little sheep',
                'Big LAMB'
            ],
            languageId: languageId
        }, (editor, model, viewModel) => {
            model.tokenization.forceTokenization(model.getLineCount());
            assertType(editor, model, viewModel, 1, 4, '"', '"', `does not double quote when ending with open`);
            model.tokenization.forceTokenization(model.getLineCount());
            assertType(editor, model, viewModel, 2, 4, '"', '"', `does not double quote when ending with open`);
            model.tokenization.forceTokenization(model.getLineCount());
            assertType(editor, model, viewModel, 3, 4, '"', '"', `does not double quote when ending with open`);
            model.tokenization.forceTokenization(model.getLineCount());
            assertType(editor, model, viewModel, 4, 2, '"', '"', `does not double quote when ending with open`);
            model.tokenization.forceTokenization(model.getLineCount());
            assertType(editor, model, viewModel, 4, 3, '"', '"', `does not double quote when ending with open`);
        });
    });
    test('issue #27937: Trying to add an item to the front of a list is cumbersome', () => {
        usingCursor({
            text: [
                'var arr = ["b", "c"];'
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            assertType(editor, model, viewModel, 1, 12, '"', '"', `does not over type and will not auto close`);
        });
    });
    test('issue #25658 - Do not auto-close single/double quotes after word characters', () => {
        usingCursor({
            text: [
                '',
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            function typeCharacters(viewModel, chars) {
                for (let i = 0, len = chars.length; i < len; i++) {
                    viewModel.type(chars[i], 'keyboard');
                }
            }
            // First gif
            model.tokenization.forceTokenization(model.getLineCount());
            typeCharacters(viewModel, 'teste1 = teste\' ok');
            assert.strictEqual(model.getLineContent(1), 'teste1 = teste\' ok');
            viewModel.setSelections('test', [new Selection(1, 1000, 1, 1000)]);
            typeCharacters(viewModel, '\n');
            model.tokenization.forceTokenization(model.getLineCount());
            typeCharacters(viewModel, 'teste2 = teste \'ok');
            assert.strictEqual(model.getLineContent(2), 'teste2 = teste \'ok\'');
            viewModel.setSelections('test', [new Selection(2, 1000, 2, 1000)]);
            typeCharacters(viewModel, '\n');
            model.tokenization.forceTokenization(model.getLineCount());
            typeCharacters(viewModel, 'teste3 = teste" ok');
            assert.strictEqual(model.getLineContent(3), 'teste3 = teste" ok');
            viewModel.setSelections('test', [new Selection(3, 1000, 3, 1000)]);
            typeCharacters(viewModel, '\n');
            model.tokenization.forceTokenization(model.getLineCount());
            typeCharacters(viewModel, 'teste4 = teste "ok');
            assert.strictEqual(model.getLineContent(4), 'teste4 = teste "ok"');
            // Second gif
            viewModel.setSelections('test', [new Selection(4, 1000, 4, 1000)]);
            typeCharacters(viewModel, '\n');
            model.tokenization.forceTokenization(model.getLineCount());
            typeCharacters(viewModel, 'teste \'');
            assert.strictEqual(model.getLineContent(5), 'teste \'\'');
            viewModel.setSelections('test', [new Selection(5, 1000, 5, 1000)]);
            typeCharacters(viewModel, '\n');
            model.tokenization.forceTokenization(model.getLineCount());
            typeCharacters(viewModel, 'teste "');
            assert.strictEqual(model.getLineContent(6), 'teste ""');
            viewModel.setSelections('test', [new Selection(6, 1000, 6, 1000)]);
            typeCharacters(viewModel, '\n');
            model.tokenization.forceTokenization(model.getLineCount());
            typeCharacters(viewModel, 'teste\'');
            assert.strictEqual(model.getLineContent(7), 'teste\'');
            viewModel.setSelections('test', [new Selection(7, 1000, 7, 1000)]);
            typeCharacters(viewModel, '\n');
            model.tokenization.forceTokenization(model.getLineCount());
            typeCharacters(viewModel, 'teste"');
            assert.strictEqual(model.getLineContent(8), 'teste"');
        });
    });
    test('issue #37315 - overtypes only those characters that it inserted', () => {
        usingCursor({
            text: [
                '',
                'y=();'
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            assertCursor(viewModel, new Position(1, 1));
            viewModel.type('x=(', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=()');
            viewModel.type('asd', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=(asd)');
            // overtype!
            viewModel.type(')', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=(asd)');
            // do not overtype!
            viewModel.setSelections('test', [new Selection(2, 4, 2, 4)]);
            viewModel.type(')', 'keyboard');
            assert.strictEqual(model.getLineContent(2), 'y=());');
        });
    });
    test('issue #37315 - stops overtyping once cursor leaves area', () => {
        usingCursor({
            text: [
                '',
                'y=();'
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            assertCursor(viewModel, new Position(1, 1));
            viewModel.type('x=(', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=()');
            viewModel.setSelections('test', [new Selection(1, 5, 1, 5)]);
            viewModel.type(')', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=())');
        });
    });
    test('issue #37315 - it overtypes only once', () => {
        usingCursor({
            text: [
                '',
                'y=();'
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            assertCursor(viewModel, new Position(1, 1));
            viewModel.type('x=(', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=()');
            viewModel.type(')', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=()');
            viewModel.setSelections('test', [new Selection(1, 4, 1, 4)]);
            viewModel.type(')', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=())');
        });
    });
    test('issue #37315 - it can remember multiple auto-closed instances', () => {
        usingCursor({
            text: [
                '',
                'y=();'
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            assertCursor(viewModel, new Position(1, 1));
            viewModel.type('x=(', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=()');
            viewModel.type('(', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=(())');
            viewModel.type(')', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=(())');
            viewModel.type(')', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=(())');
        });
    });
    test('issue #118270 - auto closing deletes only those characters that it inserted', () => {
        usingCursor({
            text: [
                '',
                'y=();'
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            assertCursor(viewModel, new Position(1, 1));
            viewModel.type('x=(', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=()');
            viewModel.type('asd', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=(asd)');
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(1), 'x=()');
            // delete closing char!
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(1), 'x=');
            // do not delete closing char!
            viewModel.setSelections('test', [new Selection(2, 4, 2, 4)]);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(2), 'y=);');
        });
    });
    test('issue #78527 - does not close quote on odd count', () => {
        usingCursor({
            text: [
                'std::cout << \'"\' << entryMap'
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 29, 1, 29)]);
            viewModel.type('[', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'std::cout << \'"\' << entryMap[]');
            viewModel.type('"', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'std::cout << \'"\' << entryMap[""]');
            viewModel.type('a', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'std::cout << \'"\' << entryMap["a"]');
            viewModel.type('"', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'std::cout << \'"\' << entryMap["a"]');
            viewModel.type(']', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'std::cout << \'"\' << entryMap["a"]');
        });
    });
    test('issue #85983 - editor.autoClosingBrackets: beforeWhitespace is incorrect for Python', () => {
        const languageId = 'pythonMode';
        disposables.add(languageService.registerLanguage({ id: languageId }));
        disposables.add(languageConfigurationService.register(languageId, {
            autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '\"', close: '\"', notIn: ['string'] },
                { open: 'r\"', close: '\"', notIn: ['string', 'comment'] },
                { open: 'R\"', close: '\"', notIn: ['string', 'comment'] },
                { open: 'u\"', close: '\"', notIn: ['string', 'comment'] },
                { open: 'U\"', close: '\"', notIn: ['string', 'comment'] },
                { open: 'f\"', close: '\"', notIn: ['string', 'comment'] },
                { open: 'F\"', close: '\"', notIn: ['string', 'comment'] },
                { open: 'b\"', close: '\"', notIn: ['string', 'comment'] },
                { open: 'B\"', close: '\"', notIn: ['string', 'comment'] },
                { open: '\'', close: '\'', notIn: ['string', 'comment'] },
                { open: 'r\'', close: '\'', notIn: ['string', 'comment'] },
                { open: 'R\'', close: '\'', notIn: ['string', 'comment'] },
                { open: 'u\'', close: '\'', notIn: ['string', 'comment'] },
                { open: 'U\'', close: '\'', notIn: ['string', 'comment'] },
                { open: 'f\'', close: '\'', notIn: ['string', 'comment'] },
                { open: 'F\'', close: '\'', notIn: ['string', 'comment'] },
                { open: 'b\'', close: '\'', notIn: ['string', 'comment'] },
                { open: 'B\'', close: '\'', notIn: ['string', 'comment'] },
                { open: '`', close: '`', notIn: ['string'] }
            ],
        }));
        usingCursor({
            text: [
                'foo\'hello\''
            ],
            editorOpts: {
                autoClosingBrackets: 'beforeWhitespace'
            },
            languageId: languageId
        }, (editor, model, viewModel) => {
            assertType(editor, model, viewModel, 1, 4, '(', '(', `does not auto close @ (1, 4)`);
        });
    });
    test('issue #78975 - Parentheses swallowing does not work when parentheses are inserted by autocomplete', () => {
        usingCursor({
            text: [
                '<div id'
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 8, 1, 8)]);
            viewModel.executeEdits('snippet', [{ range: new Range(1, 6, 1, 8), text: 'id=""' }], () => [new Selection(1, 10, 1, 10)], EditSources.unknown({}));
            assert.strictEqual(model.getLineContent(1), '<div id=""');
            viewModel.type('a', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '<div id="a"');
            viewModel.type('"', 'keyboard');
            assert.strictEqual(model.getLineContent(1), '<div id="a"');
        });
    });
    test('issue #78833 - Add config to use old brackets/quotes overtyping', () => {
        usingCursor({
            text: [
                '',
                'y=();'
            ],
            languageId: autoClosingLanguageId,
            editorOpts: {
                autoClosingOvertype: 'always'
            }
        }, (editor, model, viewModel) => {
            assertCursor(viewModel, new Position(1, 1));
            viewModel.type('x=(', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=()');
            viewModel.type(')', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=()');
            viewModel.setSelections('test', [new Selection(1, 4, 1, 4)]);
            viewModel.type(')', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'x=()');
            viewModel.setSelections('test', [new Selection(2, 4, 2, 4)]);
            viewModel.type(')', 'keyboard');
            assert.strictEqual(model.getLineContent(2), 'y=();');
        });
    });
    test('issue #15825: accents on mac US intl keyboard', () => {
        usingCursor({
            text: [],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            assertCursor(viewModel, new Position(1, 1));
            // Typing ` + e on the mac US intl kb layout
            viewModel.startComposition();
            viewModel.type('`', 'keyboard');
            viewModel.compositionType('è', 1, 0, 0, 'keyboard');
            viewModel.endComposition('keyboard');
            assert.strictEqual(model.getValue(), 'è');
        });
    });
    test('issue #90016: allow accents on mac US intl keyboard to surround selection', () => {
        usingCursor({
            text: [
                'test'
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 1, 1, 5)]);
            // Typing ` + e on the mac US intl kb layout
            viewModel.startComposition();
            viewModel.type('\'', 'keyboard');
            viewModel.compositionType('\'', 1, 0, 0, 'keyboard');
            viewModel.compositionType('\'', 1, 0, 0, 'keyboard');
            viewModel.endComposition('keyboard');
            assert.strictEqual(model.getValue(), '\'test\'');
        });
    });
    test('issue #53357: Over typing ignores characters after backslash', () => {
        usingCursor({
            text: [
                'console.log();'
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 13, 1, 13)]);
            viewModel.type('\'', 'keyboard');
            assert.strictEqual(model.getValue(), 'console.log(\'\');');
            viewModel.type('it', 'keyboard');
            assert.strictEqual(model.getValue(), 'console.log(\'it\');');
            viewModel.type('\\', 'keyboard');
            assert.strictEqual(model.getValue(), 'console.log(\'it\\\');');
            viewModel.type('\'', 'keyboard');
            assert.strictEqual(model.getValue(), 'console.log(\'it\\\'\');');
        });
    });
    test('issue #84998: Overtyping Brackets doesn\'t work after backslash', () => {
        usingCursor({
            text: [
                ''
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 1, 1, 1)]);
            viewModel.type('\\', 'keyboard');
            assert.strictEqual(model.getValue(), '\\');
            viewModel.type('(', 'keyboard');
            assert.strictEqual(model.getValue(), '\\()');
            viewModel.type('abc', 'keyboard');
            assert.strictEqual(model.getValue(), '\\(abc)');
            viewModel.type('\\', 'keyboard');
            assert.strictEqual(model.getValue(), '\\(abc\\)');
            viewModel.type(')', 'keyboard');
            assert.strictEqual(model.getValue(), '\\(abc\\)');
        });
    });
    test('issue #2773: Accents (´`¨^, others?) are inserted in the wrong position (Mac)', () => {
        usingCursor({
            text: [
                'hello',
                'world'
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            assertCursor(viewModel, new Position(1, 1));
            // Typing ` and pressing shift+down on the mac US intl kb layout
            // Here we're just replaying what the cursor gets
            viewModel.startComposition();
            viewModel.type('`', 'keyboard');
            moveDown(editor, viewModel, true);
            viewModel.compositionType('`', 1, 0, 0, 'keyboard');
            viewModel.compositionType('`', 1, 0, 0, 'keyboard');
            viewModel.endComposition('keyboard');
            assert.strictEqual(model.getValue(), '`hello\nworld');
            assertCursor(viewModel, new Selection(1, 2, 2, 2));
        });
    });
    test('issue #26820: auto close quotes when not used as accents', () => {
        usingCursor({
            text: [
                ''
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            assertCursor(viewModel, new Position(1, 1));
            // on the mac US intl kb layout
            // Typing ' + space
            viewModel.startComposition();
            viewModel.type('\'', 'keyboard');
            viewModel.compositionType('\'', 1, 0, 0, 'keyboard');
            viewModel.endComposition('keyboard');
            assert.strictEqual(model.getValue(), '\'\'');
            // Typing one more ' + space
            viewModel.startComposition();
            viewModel.type('\'', 'keyboard');
            viewModel.compositionType('\'', 1, 0, 0, 'keyboard');
            viewModel.endComposition('keyboard');
            assert.strictEqual(model.getValue(), '\'\'');
            // Typing ' as a closing tag
            model.setValue('\'abc');
            viewModel.setSelections('test', [new Selection(1, 5, 1, 5)]);
            viewModel.startComposition();
            viewModel.type('\'', 'keyboard');
            viewModel.compositionType('\'', 1, 0, 0, 'keyboard');
            viewModel.endComposition('keyboard');
            assert.strictEqual(model.getValue(), '\'abc\'');
            // quotes before the newly added character are all paired.
            model.setValue('\'abc\'def ');
            viewModel.setSelections('test', [new Selection(1, 10, 1, 10)]);
            viewModel.startComposition();
            viewModel.type('\'', 'keyboard');
            viewModel.compositionType('\'', 1, 0, 0, 'keyboard');
            viewModel.endComposition('keyboard');
            assert.strictEqual(model.getValue(), '\'abc\'def \'\'');
            // No auto closing if there is non-whitespace character after the cursor
            model.setValue('abc');
            viewModel.setSelections('test', [new Selection(1, 1, 1, 1)]);
            viewModel.startComposition();
            viewModel.type('\'', 'keyboard');
            viewModel.compositionType('\'', 1, 0, 0, 'keyboard');
            viewModel.endComposition('keyboard');
            // No auto closing if it's after a word.
            model.setValue('abc');
            viewModel.setSelections('test', [new Selection(1, 4, 1, 4)]);
            viewModel.startComposition();
            viewModel.type('\'', 'keyboard');
            viewModel.compositionType('\'', 1, 0, 0, 'keyboard');
            viewModel.endComposition('keyboard');
            assert.strictEqual(model.getValue(), 'abc\'');
        });
    });
    test('issue #144690: Quotes do not overtype when using US Intl PC keyboard layout', () => {
        usingCursor({
            text: [
                ''
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            assertCursor(viewModel, new Position(1, 1));
            // Pressing ' + ' + ;
            viewModel.startComposition();
            viewModel.type(`'`, 'keyboard');
            viewModel.compositionType(`'`, 1, 0, 0, 'keyboard');
            viewModel.compositionType(`'`, 1, 0, 0, 'keyboard');
            viewModel.endComposition('keyboard');
            viewModel.startComposition();
            viewModel.type(`'`, 'keyboard');
            viewModel.compositionType(`';`, 1, 0, 0, 'keyboard');
            viewModel.compositionType(`';`, 2, 0, 0, 'keyboard');
            viewModel.endComposition('keyboard');
            assert.strictEqual(model.getValue(), `'';`);
        });
    });
    test('issue #144693: Typing a quote using US Intl PC keyboard layout always surrounds words', () => {
        usingCursor({
            text: [
                'const hello = 3;'
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 7, 1, 12)]);
            // Pressing ' + e
            viewModel.startComposition();
            viewModel.type(`'`, 'keyboard');
            viewModel.compositionType(`é`, 1, 0, 0, 'keyboard');
            viewModel.compositionType(`é`, 1, 0, 0, 'keyboard');
            viewModel.endComposition('keyboard');
            assert.strictEqual(model.getValue(), `const é = 3;`);
        });
    });
    test('issue #82701: auto close does not execute when IME is canceled via backspace', () => {
        usingCursor({
            text: [
                '{}'
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 2, 1, 2)]);
            // Typing a + backspace
            viewModel.startComposition();
            viewModel.type('a', 'keyboard');
            viewModel.compositionType('', 1, 0, 0, 'keyboard');
            viewModel.endComposition('keyboard');
            assert.strictEqual(model.getValue(), '{}');
        });
    });
    test('issue #20891: All cursors should do the same thing', () => {
        usingCursor({
            text: [
                'var a = asd'
            ],
            languageId: autoClosingLanguageId
        }, (editor, model, viewModel) => {
            viewModel.setSelections('test', [
                new Selection(1, 9, 1, 9),
                new Selection(1, 12, 1, 12),
            ]);
            // type a `
            viewModel.type('`', 'keyboard');
            assert.strictEqual(model.getValue(), 'var a = `asd`');
        });
    });
    test('issue #41825: Special handling of quotes in surrounding pairs', () => {
        const languageId = 'myMode';
        disposables.add(languageService.registerLanguage({ id: languageId }));
        disposables.add(languageConfigurationService.register(languageId, {
            surroundingPairs: [
                { open: '"', close: '"' },
                { open: '\'', close: '\'' },
            ]
        }));
        const model = createTextModel('var x = \'hi\';', languageId);
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            editor.setSelections([
                new Selection(1, 9, 1, 10),
                new Selection(1, 12, 1, 13)
            ]);
            viewModel.type('"', 'keyboard');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'var x = "hi";', 'assert1');
            editor.setSelections([
                new Selection(1, 9, 1, 10),
                new Selection(1, 12, 1, 13)
            ]);
            viewModel.type('\'', 'keyboard');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'var x = \'hi\';', 'assert2');
        });
    });
    test('All cursors should do the same thing when deleting left', () => {
        const model = createTextModel([
            'var a = ()'
        ].join('\n'), autoClosingLanguageId);
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [
                new Selection(1, 4, 1, 4),
                new Selection(1, 10, 1, 10),
            ]);
            // delete left
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getValue(), 'va a = )');
        });
    });
    test('issue #7100: Mouse word selection is strange when non-word character is at the end of line', () => {
        const model = createTextModel([
            'before.a',
            'before',
            'hello:',
            'there:',
            'this is strange:',
            'here',
            'it',
            'is',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            editor.runCommand(CoreNavigationCommands.WordSelect, {
                position: new Position(3, 7)
            });
            assertCursor(viewModel, new Selection(3, 7, 3, 7));
            editor.runCommand(CoreNavigationCommands.WordSelectDrag, {
                position: new Position(4, 7)
            });
            assertCursor(viewModel, new Selection(3, 7, 4, 7));
        });
    });
    test('issue #112039: shift-continuing a double/triple-click and drag selection does not remember its starting mode', () => {
        const model = createTextModel([
            'just some text',
            'and another line',
            'and another one',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            editor.runCommand(CoreNavigationCommands.WordSelect, {
                position: new Position(2, 6)
            });
            editor.runCommand(CoreNavigationCommands.MoveToSelect, {
                position: new Position(1, 8),
            });
            assertCursor(viewModel, new Selection(2, 12, 1, 6));
        });
    });
    test('issue #158236: Shift click selection does not work on line number indicator', () => {
        const model = createTextModel([
            'just some text',
            'and another line',
            'and another one',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            editor.runCommand(CoreNavigationCommands.MoveTo, {
                position: new Position(3, 5)
            });
            editor.runCommand(CoreNavigationCommands.LineSelectDrag, {
                position: new Position(2, 1)
            });
            assertCursor(viewModel, new Selection(3, 5, 2, 1));
        });
    });
    test('issue #111513: Text gets automatically selected when typing at the same location in another editor', () => {
        const model = createTextModel([
            'just',
            '',
            'some text',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor1, viewModel1) => {
            editor1.setSelections([
                new Selection(2, 1, 2, 1)
            ]);
            withTestCodeEditor(model, {}, (editor2, viewModel2) => {
                editor2.setSelections([
                    new Selection(2, 1, 2, 1)
                ]);
                viewModel2.type('e', 'keyboard');
                assertCursor(viewModel2, new Position(2, 2));
                assertCursor(viewModel1, new Position(2, 2));
            });
        });
    });
});
suite('Undo stops', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('there is an undo stop between typing and deleting left', () => {
        const model = createTextModel([
            'A  line',
            'Another line',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 3, 1, 3)]);
            viewModel.type('first', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'A first line');
            assertCursor(viewModel, new Selection(1, 8, 1, 8));
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(1), 'A fir line');
            assertCursor(viewModel, new Selection(1, 6, 1, 6));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(1), 'A first line');
            assertCursor(viewModel, new Selection(1, 8, 1, 8));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(1), 'A  line');
            assertCursor(viewModel, new Selection(1, 3, 1, 3));
        });
        model.dispose();
    });
    test('there is an undo stop between typing and deleting right', () => {
        const model = createTextModel([
            'A  line',
            'Another line',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 3, 1, 3)]);
            viewModel.type('first', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'A first line');
            assertCursor(viewModel, new Selection(1, 8, 1, 8));
            editor.runCommand(CoreEditingCommands.DeleteRight, null);
            editor.runCommand(CoreEditingCommands.DeleteRight, null);
            assert.strictEqual(model.getLineContent(1), 'A firstine');
            assertCursor(viewModel, new Selection(1, 8, 1, 8));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(1), 'A first line');
            assertCursor(viewModel, new Selection(1, 8, 1, 8));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(1), 'A  line');
            assertCursor(viewModel, new Selection(1, 3, 1, 3));
        });
        model.dispose();
    });
    test('there is an undo stop between deleting left and typing', () => {
        const model = createTextModel([
            'A  line',
            'Another line',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(2, 8, 2, 8)]);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(2), ' line');
            assertCursor(viewModel, new Selection(2, 1, 2, 1));
            viewModel.type('Second', 'keyboard');
            assert.strictEqual(model.getLineContent(2), 'Second line');
            assertCursor(viewModel, new Selection(2, 7, 2, 7));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(2), ' line');
            assertCursor(viewModel, new Selection(2, 1, 2, 1));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(2), 'Another line');
            assertCursor(viewModel, new Selection(2, 8, 2, 8));
        });
        model.dispose();
    });
    test('there is an undo stop between deleting left and deleting right', () => {
        const model = createTextModel([
            'A  line',
            'Another line',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(2, 8, 2, 8)]);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(2), ' line');
            assertCursor(viewModel, new Selection(2, 1, 2, 1));
            editor.runCommand(CoreEditingCommands.DeleteRight, null);
            editor.runCommand(CoreEditingCommands.DeleteRight, null);
            editor.runCommand(CoreEditingCommands.DeleteRight, null);
            editor.runCommand(CoreEditingCommands.DeleteRight, null);
            editor.runCommand(CoreEditingCommands.DeleteRight, null);
            assert.strictEqual(model.getLineContent(2), '');
            assertCursor(viewModel, new Selection(2, 1, 2, 1));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(2), ' line');
            assertCursor(viewModel, new Selection(2, 1, 2, 1));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(2), 'Another line');
            assertCursor(viewModel, new Selection(2, 8, 2, 8));
        });
        model.dispose();
    });
    test('there is an undo stop between deleting right and typing', () => {
        const model = createTextModel([
            'A  line',
            'Another line',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(2, 9, 2, 9)]);
            editor.runCommand(CoreEditingCommands.DeleteRight, null);
            editor.runCommand(CoreEditingCommands.DeleteRight, null);
            editor.runCommand(CoreEditingCommands.DeleteRight, null);
            editor.runCommand(CoreEditingCommands.DeleteRight, null);
            assert.strictEqual(model.getLineContent(2), 'Another ');
            assertCursor(viewModel, new Selection(2, 9, 2, 9));
            viewModel.type('text', 'keyboard');
            assert.strictEqual(model.getLineContent(2), 'Another text');
            assertCursor(viewModel, new Selection(2, 13, 2, 13));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(2), 'Another ');
            assertCursor(viewModel, new Selection(2, 9, 2, 9));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(2), 'Another line');
            assertCursor(viewModel, new Selection(2, 9, 2, 9));
        });
        model.dispose();
    });
    test('there is an undo stop between deleting right and deleting left', () => {
        const model = createTextModel([
            'A  line',
            'Another line',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(2, 9, 2, 9)]);
            editor.runCommand(CoreEditingCommands.DeleteRight, null);
            editor.runCommand(CoreEditingCommands.DeleteRight, null);
            editor.runCommand(CoreEditingCommands.DeleteRight, null);
            editor.runCommand(CoreEditingCommands.DeleteRight, null);
            assert.strictEqual(model.getLineContent(2), 'Another ');
            assertCursor(viewModel, new Selection(2, 9, 2, 9));
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            editor.runCommand(CoreEditingCommands.DeleteLeft, null);
            assert.strictEqual(model.getLineContent(2), 'An');
            assertCursor(viewModel, new Selection(2, 3, 2, 3));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(2), 'Another ');
            assertCursor(viewModel, new Selection(2, 9, 2, 9));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(2), 'Another line');
            assertCursor(viewModel, new Selection(2, 9, 2, 9));
        });
        model.dispose();
    });
    test('inserts undo stop when typing space', () => {
        const model = createTextModel([
            'A  line',
            'Another line',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 3, 1, 3)]);
            viewModel.type('first and interesting', 'keyboard');
            assert.strictEqual(model.getLineContent(1), 'A first and interesting line');
            assertCursor(viewModel, new Selection(1, 24, 1, 24));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(1), 'A first and line');
            assertCursor(viewModel, new Selection(1, 12, 1, 12));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(1), 'A first line');
            assertCursor(viewModel, new Selection(1, 8, 1, 8));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getLineContent(1), 'A  line');
            assertCursor(viewModel, new Selection(1, 3, 1, 3));
        });
        model.dispose();
    });
    test('can undo typing and EOL change in one undo stop', () => {
        const model = createTextModel([
            'A  line',
            'Another line',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 3, 1, 3)]);
            viewModel.type('first', 'keyboard');
            assert.strictEqual(model.getValue(), 'A first line\nAnother line');
            assertCursor(viewModel, new Selection(1, 8, 1, 8));
            model.pushEOL(1 /* EndOfLineSequence.CRLF */);
            assert.strictEqual(model.getValue(), 'A first line\r\nAnother line');
            assertCursor(viewModel, new Selection(1, 8, 1, 8));
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(), 'A  line\nAnother line');
            assertCursor(viewModel, new Selection(1, 3, 1, 3));
        });
        model.dispose();
    });
    test('issue #93585: Undo multi cursor edit corrupts document', () => {
        const model = createTextModel([
            'hello world',
            'hello world',
        ].join('\n'));
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [
                new Selection(2, 7, 2, 12),
                new Selection(1, 7, 1, 12),
            ]);
            viewModel.type('no', 'keyboard');
            assert.strictEqual(model.getValue(), 'hello no\nhello no');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(), 'hello world\nhello world');
        });
        model.dispose();
    });
    test('there is a single undo stop for consecutive whitespaces', () => {
        const model = createTextModel([
            ''
        ].join('\n'), undefined, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.type('a', 'keyboard');
            viewModel.type('b', 'keyboard');
            viewModel.type(' ', 'keyboard');
            viewModel.type(' ', 'keyboard');
            viewModel.type('c', 'keyboard');
            viewModel.type('d', 'keyboard');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'ab  cd', 'assert1');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'ab  ', 'assert2');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'ab', 'assert3');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '', 'assert4');
        });
        model.dispose();
    });
    test('there is no undo stop after a single whitespace', () => {
        const model = createTextModel([
            ''
        ].join('\n'), undefined, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.type('a', 'keyboard');
            viewModel.type('b', 'keyboard');
            viewModel.type(' ', 'keyboard');
            viewModel.type('c', 'keyboard');
            viewModel.type('d', 'keyboard');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'ab cd', 'assert1');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), 'ab', 'assert3');
            editor.runCommand(CoreEditingCommands.Undo, null);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), '', 'assert4');
        });
        model.dispose();
    });
});
suite('Overtype Mode', () => {
    setup(() => {
        InputMode.setInputMode('overtype');
    });
    teardown(() => {
        InputMode.setInputMode('insert');
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('simple type', () => {
        const model = createTextModel([
            '123456789',
            '123456789',
        ].join('\n'), undefined, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 3, 1, 3)]);
            viewModel.type('a', 'keyboard');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), [
                '12a456789',
                '123456789',
            ].join('\n'), 'assert1');
            viewModel.setSelections('test', [new Selection(1, 9, 1, 9)]);
            viewModel.type('bbb', 'keyboard');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), [
                '12a45678bbb',
                '123456789',
            ].join('\n'), 'assert2');
        });
        model.dispose();
    });
    test('multi-line selection type', () => {
        const model = createTextModel([
            '123456789',
            '123456789',
        ].join('\n'), undefined, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 5, 2, 3)]);
            viewModel.type('cc', 'keyboard');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), [
                '1234cc456789',
            ].join('\n'), 'assert1');
        });
        model.dispose();
    });
    test('simple paste', () => {
        const model = createTextModel([
            '123456789',
            '123456789',
        ].join('\n'), undefined, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 5, 1, 5)]);
            viewModel.paste('cc', false);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), [
                '1234cc789',
                '123456789',
            ].join('\n'), 'assert1');
            viewModel.setSelections('test', [new Selection(1, 5, 1, 5)]);
            viewModel.paste('dddddddd', false);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), [
                '1234dddddddd',
                '123456789',
            ].join('\n'), 'assert2');
        });
        model.dispose();
    });
    test('multi-line selection paste', () => {
        const model = createTextModel([
            '123456789',
            '123456789',
        ].join('\n'), undefined, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 5, 2, 3)]);
            viewModel.paste('cc', false);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), [
                '1234cc456789',
            ].join('\n'), 'assert1');
        });
        model.dispose();
    });
    test('paste multi-line text', () => {
        const model = createTextModel([
            '123456789',
            '123456789',
        ].join('\n'), undefined, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 5, 1, 5)]);
            viewModel.paste([
                'aaaaaaa',
                'bbbbbbb'
            ].join('\n'), false);
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), [
                '1234aaaaaaa',
                'bbbbbbb',
                '123456789',
            ].join('\n'), 'assert1');
        });
        model.dispose();
    });
    test('composition type', () => {
        const model = createTextModel([
            '123456789',
            '123456789',
        ].join('\n'), undefined, {
            insertSpaces: false,
        });
        withTestCodeEditor(model, {}, (editor, viewModel) => {
            viewModel.setSelections('test', [new Selection(1, 5, 1, 5)]);
            viewModel.startComposition();
            viewModel.compositionType('セ', 0, 0, 0, 'keyboard');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), [
                '1234セ56789',
                '123456789',
            ].join('\n'), 'assert1');
            viewModel.endComposition('keyboard');
            assert.strictEqual(model.getValue(1 /* EndOfLinePreference.LF */), [
                '1234セ6789',
                '123456789',
            ].join('\n'), 'assert1');
        });
        model.dispose();
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3Vyc29yLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL3Rlc3QvYnJvd3Nlci9jb250cm9sbGVyL2N1cnNvci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFdkUsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLHNCQUFzQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFL0YsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM1RCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDdEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBSTlELE9BQU8sRUFBRSx5QkFBeUIsRUFBZ0Msb0JBQW9CLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUM3SCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsWUFBWSxFQUFtQixNQUFNLG9EQUFvRCxDQUFDO0FBQ25HLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzNHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUV0RSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFHL0QsT0FBTyxFQUF1RCx3QkFBd0IsRUFBRSx5QkFBeUIsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ3BLLE9BQU8sRUFBb0MsZUFBZSxFQUFFLG9CQUFvQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFeEgsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUVyRSxrQkFBa0I7QUFFbEIsU0FBUyxNQUFNLENBQUMsTUFBdUIsRUFBRSxTQUFvQixFQUFFLFVBQWtCLEVBQUUsTUFBYyxFQUFFLGtCQUEyQixLQUFLO0lBQ2xJLElBQUksZUFBZSxFQUFFLENBQUM7UUFDckIsc0JBQXNCLENBQUMsWUFBWSxDQUFDLG9CQUFvQixDQUFDLFNBQVMsRUFBRTtZQUNuRSxRQUFRLEVBQUUsSUFBSSxRQUFRLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQztTQUMxQyxDQUFDLENBQUM7SUFDSixDQUFDO1NBQU0sQ0FBQztRQUNQLHNCQUFzQixDQUFDLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLEVBQUU7WUFDN0QsUUFBUSxFQUFFLElBQUksUUFBUSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUM7U0FDMUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztBQUNGLENBQUM7QUFFRCxTQUFTLFFBQVEsQ0FBQyxNQUF1QixFQUFFLFNBQW9CLEVBQUUsa0JBQTJCLEtBQUs7SUFDaEcsSUFBSSxlQUFlLEVBQUUsQ0FBQztRQUNyQixzQkFBc0IsQ0FBQyxnQkFBZ0IsQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDN0UsQ0FBQztTQUFNLENBQUM7UUFDUCxzQkFBc0IsQ0FBQyxVQUFVLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7QUFDRixDQUFDO0FBRUQsU0FBUyxTQUFTLENBQUMsTUFBdUIsRUFBRSxTQUFvQixFQUFFLGtCQUEyQixLQUFLO0lBQ2pHLElBQUksZUFBZSxFQUFFLENBQUM7UUFDckIsc0JBQXNCLENBQUMsaUJBQWlCLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQzlFLENBQUM7U0FBTSxDQUFDO1FBQ1Asc0JBQXNCLENBQUMsV0FBVyxDQUFDLG9CQUFvQixDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN4RSxDQUFDO0FBQ0YsQ0FBQztBQUVELFNBQVMsUUFBUSxDQUFDLE1BQXVCLEVBQUUsU0FBb0IsRUFBRSxrQkFBMkIsS0FBSztJQUNoRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQ3JCLHNCQUFzQixDQUFDLGdCQUFnQixDQUFDLG9CQUFvQixDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUM3RSxDQUFDO1NBQU0sQ0FBQztRQUNQLHNCQUFzQixDQUFDLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDdkUsQ0FBQztBQUNGLENBQUM7QUFFRCxTQUFTLE1BQU0sQ0FBQyxNQUF1QixFQUFFLFNBQW9CLEVBQUUsa0JBQTJCLEtBQUs7SUFDOUYsSUFBSSxlQUFlLEVBQUUsQ0FBQztRQUNyQixzQkFBc0IsQ0FBQyxjQUFjLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQzNFLENBQUM7U0FBTSxDQUFDO1FBQ1Asc0JBQXNCLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNyRSxDQUFDO0FBQ0YsQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQUMsTUFBdUIsRUFBRSxTQUFvQixFQUFFLGtCQUEyQixLQUFLO0lBQzdHLElBQUksZUFBZSxFQUFFLENBQUM7UUFDckIsc0JBQXNCLENBQUMsZ0JBQWdCLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQzdFLENBQUM7U0FBTSxDQUFDO1FBQ1Asc0JBQXNCLENBQUMsVUFBVSxDQUFDLG9CQUFvQixDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN2RSxDQUFDO0FBQ0YsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFDLE1BQXVCLEVBQUUsU0FBb0IsRUFBRSxrQkFBMkIsS0FBSztJQUN2RyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQ3JCLHNCQUFzQixDQUFDLGVBQWUsQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDNUUsQ0FBQztTQUFNLENBQUM7UUFDUCxzQkFBc0IsQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3RFLENBQUM7QUFDRixDQUFDO0FBRUQsU0FBUyx1QkFBdUIsQ0FBQyxNQUF1QixFQUFFLFNBQW9CLEVBQUUsa0JBQTJCLEtBQUs7SUFDL0csSUFBSSxlQUFlLEVBQUUsQ0FBQztRQUNyQixzQkFBc0IsQ0FBQyxlQUFlLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQzVFLENBQUM7U0FBTSxDQUFDO1FBQ1Asc0JBQXNCLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN0RSxDQUFDO0FBQ0YsQ0FBQztBQUVELFNBQVMsaUJBQWlCLENBQUMsTUFBdUIsRUFBRSxTQUFvQixFQUFFLGtCQUEyQixLQUFLO0lBQ3pHLElBQUksZUFBZSxFQUFFLENBQUM7UUFDckIsc0JBQXNCLENBQUMsa0JBQWtCLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQy9FLENBQUM7U0FBTSxDQUFDO1FBQ1Asc0JBQXNCLENBQUMsWUFBWSxDQUFDLG9CQUFvQixDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN6RSxDQUFDO0FBQ0YsQ0FBQztBQUVELFNBQVMsWUFBWSxDQUFDLFNBQW9CLEVBQUUsSUFBd0M7SUFDbkYsSUFBSSxVQUF1QixDQUFDO0lBQzVCLElBQUksSUFBSSxZQUFZLFFBQVEsRUFBRSxDQUFDO1FBQzlCLFVBQVUsR0FBRyxDQUFDLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQzFGLENBQUM7U0FBTSxJQUFJLElBQUksWUFBWSxTQUFTLEVBQUUsQ0FBQztRQUN0QyxVQUFVLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNyQixDQUFDO1NBQU0sQ0FBQztRQUNQLFVBQVUsR0FBRyxJQUFJLENBQUM7SUFDbkIsQ0FBQztJQUNELE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUNoRSxNQUFNLFFBQVEsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFFbkQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDMUMsQ0FBQztBQUVELEtBQUssQ0FBQyw0QkFBNEIsRUFBRSxHQUFHLEVBQUU7SUFDeEMsTUFBTSxLQUFLLEdBQUcsd0JBQXdCLENBQUM7SUFDdkMsTUFBTSxLQUFLLEdBQUcsa0JBQWtCLENBQUM7SUFDakMsTUFBTSxLQUFLLEdBQUcsa0JBQWtCLENBQUM7SUFDakMsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDO0lBQ2pCLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQztJQUVsQixNQUFNLElBQUksR0FDVCxLQUFLLEdBQUcsTUFBTTtRQUNkLEtBQUssR0FBRyxJQUFJO1FBQ1osS0FBSyxHQUFHLElBQUk7UUFDWixLQUFLLEdBQUcsTUFBTTtRQUNkLEtBQUssQ0FBQztJQUVQLFNBQVMsT0FBTyxDQUFDLFFBQWlFO1FBQ2pGLGtCQUFrQixDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUU7WUFDbEQsUUFBUSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM3QixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCx1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxHQUFHLEVBQUU7UUFDL0IsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFO1lBQzdCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0MsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILDBCQUEwQjtJQUUxQixJQUFJLENBQUMsU0FBUyxFQUFFLEdBQUcsRUFBRTtRQUNwQixPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUU7WUFDN0IsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0MsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFO1FBQ2pCLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsRUFBRTtZQUM3QixNQUFNLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDaEMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3QyxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHdCQUF3QixFQUFFLEdBQUcsRUFBRTtRQUNuQyxPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUU7WUFDN0IsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUN0QyxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEQsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxzQkFBc0IsRUFBRSxHQUFHLEVBQUU7UUFDakMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFO1lBQzdCLE1BQU0sQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNqQyxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUQsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxpQkFBaUIsRUFBRSxHQUFHLEVBQUU7UUFDNUIsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFO1lBQzdCLE1BQU0sQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNqQyxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdDLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxFQUFFO1FBQy9CLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsRUFBRTtZQUM3QixNQUFNLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDakMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3QyxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGdCQUFnQixFQUFFLEdBQUcsRUFBRTtRQUMzQixPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUU7WUFDN0IsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUN0QyxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEQsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxzQkFBc0IsRUFBRSxHQUFHLEVBQUU7UUFDakMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFO1lBQzdCLE1BQU0sQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNoQyxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRTVDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDdkMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBRXBELE1BQU0sQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDdEMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BELENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxzQkFBc0I7SUFFdEIsSUFBSSxDQUFDLGdDQUFnQyxFQUFFLEdBQUcsRUFBRTtRQUMzQyxPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUU7WUFDN0IsUUFBUSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUM1QixZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdDLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRTtRQUN0QixPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUU7WUFDN0IsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUM1QixZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdDLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsK0JBQStCLEVBQUUsR0FBRyxFQUFFO1FBQzFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsRUFBRTtZQUM3QixNQUFNLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDakMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUM3QyxRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDOUMsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxnQ0FBZ0MsRUFBRSxHQUFHLEVBQUU7UUFDM0MsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFO1lBQzdCLE1BQU0sQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNoQyxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDNUIsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM5QyxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHFCQUFxQixFQUFFLEdBQUcsRUFBRTtRQUNoQyxPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUU7WUFDN0IsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDbEMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3JELENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCx1QkFBdUI7SUFFdkIsSUFBSSxDQUFDLHFDQUFxQyxFQUFFLEdBQUcsRUFBRTtRQUNoRCxPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUU7WUFDN0IsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUM3QixZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdDLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsWUFBWSxFQUFFLEdBQUcsRUFBRTtRQUN2QixPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUU7WUFDN0IsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUM3QixZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdDLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsZ0NBQWdDLEVBQUUsR0FBRyxFQUFFO1FBQzNDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsRUFBRTtZQUM3QixNQUFNLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDakMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUM3QyxTQUFTLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzdCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDOUMsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw2QkFBNkIsRUFBRSxHQUFHLEVBQUU7UUFDeEMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFO1lBQzdCLE1BQU0sQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNqQyxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzdDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDN0IsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3QyxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHNCQUFzQixFQUFFLEdBQUcsRUFBRTtRQUNqQyxPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUU7WUFDN0IsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ2pDLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDN0MsU0FBUyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDbkMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3JELENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxzQkFBc0I7SUFFdEIsSUFBSSxDQUFDLFdBQVcsRUFBRSxHQUFHLEVBQUU7UUFDdEIsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFO1lBQzdCLFFBQVEsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDNUIsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1QyxRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUM1QixZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDNUIsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1QyxRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0MsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQywwQkFBMEIsRUFBRSxHQUFHLEVBQUU7UUFDckMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFO1lBQzdCLFFBQVEsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xDLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNuRCxRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNsQyxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbkQsUUFBUSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDbEMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25ELFFBQVEsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xDLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNuRCxRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNsQyxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEQsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxxQkFBcUIsRUFBRSxHQUFHLEVBQUU7UUFDaEMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFO1lBQzdCLE1BQU0sQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNoQyxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDNUIsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1QyxRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUM1QixZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDNUIsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3QyxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsb0JBQW9CO0lBRXBCLElBQUksQ0FBQyxTQUFTLEVBQUUsR0FBRyxFQUFFO1FBQ3BCLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsRUFBRTtZQUM3QixNQUFNLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDaEMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUU1QyxNQUFNLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzFCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFNUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUMxQixZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdDLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsd0JBQXdCLEVBQUUsR0FBRyxFQUFFO1FBQ25DLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsRUFBRTtZQUM3QixNQUFNLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDaEMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUU1QyxNQUFNLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNoQyxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFbkQsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDaEMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BELENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsNEJBQTRCLEVBQUUsR0FBRyxFQUFFO1FBQ3ZDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsRUFBRTtZQUM3QixNQUFNLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDaEMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1QyxRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVCLFFBQVEsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDNUIsUUFBUSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUM1QixRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUMxQixZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDMUIsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1QyxNQUFNLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzFCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUMxQixZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdDLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsNkRBQTZELEVBQUUsR0FBRyxFQUFFO1FBQ3hFLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsRUFBRTtZQUM3QixlQUFlLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ25DLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzRCxlQUFlLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ25DLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzRCxRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzRCxRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzRCxRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzRCxRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzRCxNQUFNLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzFCLE1BQU0sQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDMUIsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUMxQixNQUFNLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzFCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM1RCxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHFEQUFxRCxFQUFFLEdBQUcsRUFBRTtRQUNoRSxPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUU7WUFDN0IsU0FBUyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDN0Qsc0VBQXNFO1lBQ3RFLE1BQU0sQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDMUIsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1QyxRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUMxQixZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRTVDLHNFQUFzRTtZQUN0RSxNQUFNLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzFCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUMxQixZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDNUIsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FB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LFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUU1QyxTQUFTLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM3RCxTQUFTLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzdCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUM1QixZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRTVDLFNBQVMsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzdELFFBQVEsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDNUIsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1QyxRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVCLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztZQUMxQixZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDMUIsWUFBWSxDQUFDLFNBQVMs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QUFFLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQzFCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDMUIsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUMxQixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQzFCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDMUIsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUMxQixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQzFCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUMxQixDQUFDLENBQUM7WUFFSCxzQkFBc0IsQ0FBQyxZQUFZLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFO2dCQUNuRSxRQUFRLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDNUIsWUFBWSxFQUFFLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ2hDLFdBQVcsRUFBRSxDQUFDO2dCQUNkLGNBQWMsRUFBRSxJQUFJO2FBQ3BCLENBQUMsQ0FBQztZQUNILFlBQVksQ0FBQyxTQUFTLEVBQUU7Z0JBQ3ZCLElBQUksU0FBUyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDNUIsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUMxQixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JB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QyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsR0FBRyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBRTNFLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBRTlFLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBRWxGLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsV0FBVyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBRXBGLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBRWxGLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBRTlFLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsR0FBRyxFQUFFLFVBQVUs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TUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1lBQzNELFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFFN0MsTUFBTSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDbEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3JELFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFNUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDbEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ2hELFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFNUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDbEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3JELFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFNUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDbEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1lBQzNELFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFFN0MsTUFBTSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDbEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1lBQzVELFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFFN0MsTUFBTSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDbEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1lBQzNELFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFFN0MsTUFBTSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDbEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1lBQzNELFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDOUMsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxrREFBa0QsRUFBRSxHQUFHLEVBQUU7UUFDN0QsTUFBTSxVQUFVLEdBQUcsb0JBQW9CLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ3BFLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FDNUI7WUFDQyx1QkFBdUI7U0FDdkIsQ0FB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LE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUN6RCxlQUFlLENBQUMsRUFBRSxFQUFFLHdCQUF3QixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUN6RCxlQUFlLENBQUMsRUFBRSxFQUFFLHdCQUF3QixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUN6RCxlQUFlLENBQUMsRUFBRSxFQUFFLHlCQUF5QixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUMxRCxlQUFlLENBQUMsRUFBRSxFQUFFLDBCQUEwQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUMzRCxlQUFlLENBQUMsRUFBRSxFQUFFLDJCQUEyQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUM1RCxlQUFlLENBQUMsRUFBRSxFQUFFLCtCQUErQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNoRSxlQUFlLENBQUMsRUFBRSxFQUFFLCtCQUErQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNoRSxlQUFlLENBQUMsRUFBRSxFQUFFLCtCQUErQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNoRSxlQUFlLENBQUMsRUFBRSxFQUFFLCtCQUErQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNoRSxlQUFlLENBQUMsRUFBRSxFQUFFLGdDQUFnQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNqRSxlQUFlLENBQUMsRUFBRSxFQUFFLGlDQUFpQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNsRSxlQUFlLENBQUMsRUFBRSxFQUFFLGtDQUFrQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNuRSxlQUFlLENBQUMsRUFBRSxFQUFFLG1DQUFtQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNwRSxlQUFlLENBQUMsRUFBRSxFQUFFLG9DQUFvQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENB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TSxFQUFFLFNBQVMsRUFBRSxFQUFFO1lBQzVFLFNBQVMsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO2dCQUMvQixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzFCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDM0IsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2FBQzNCLENBQUMsQ0FBQztZQUVILFFBQVEsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDNUIsWUFBWSxDQUFDLFNBQVMsRUFBRTtnQkFDdkIsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUN6QixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzNCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQzthQUMzQixDQUFDLENBQUM7WUFFSCxTQUFTLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtnQkFDL0IsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUMxQixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzNCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQzthQUMzQixDQUFDLENBQUM7WUFFSCxTQUFTLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzdCLFlBQVksQ0FBQyxTQUFTLEVBQUU7Z0JBQ3ZCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDM0IsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUMzQixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7YUFDM0IsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxzRkFBc0YsRUFBRSxHQUFHLEVBQUU7UUFDakcsc0NBQXNDO1FBQ3RDLGtCQUFrQixDQUFDO1lBQ2xCO2dCQUNDLHdCQUF3QjtnQkFDeEIsMkJBQTJCO2dCQUMzQix3QkFBd0I7Z0JBQ3hCLHVCQUF1QjtnQkFDdkIsaUJBQWlCO2FBQ2pCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztTQUNaLEVBQUUsRUFBRSxRQUFRLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFO1lBQzVFLFNBQVMsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO2dCQUMvQixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzNCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDM0IsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUMzQixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzNCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUN6QixDQUFDLENBQUM7WUFDSCxZQUFZLENBQUMsU0FBUyxFQUFFO2dCQUN2QixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzNCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDM0IsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUMzQixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzNCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUN6QixDQUFDLENBQUM7WUFFSCxTQUFTLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNuQyxZQUFZLENBQUMsU0FBUyxFQUFFO2dCQUN2QixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzNCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDM0IsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUMzQixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzNCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUN6QixDQUFDLENBQUM7WUFFSCxTQUFTLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNuQyxZQUFZLENBQUMsU0FBUyxFQUFFO2dCQUN2QixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzNCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDM0IsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUMzQixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzNCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUN6QixDQUFDLENBQUM7WUFFSCxTQUFTLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNuQyxZQUFZLENBQUMsU0FBUyxFQUFFO2dCQUN2QixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzNCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDM0IsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUMzQixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzNCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUN6QixDQUFDLENBQUM7WUFFSCxTQUFTLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNuQyxZQUFZLENBQUMsU0FBUyxFQUFFO2dCQUN2QixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzNCLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDM0IsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUMzQixJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzNCLElBQUksU0FBUyxD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RixzQkFBc0IsQ0FBQyxVQUFVLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3RFLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsWUFBWSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBRXBGLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3hELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBRWxGLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3hELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBRWhGLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3hELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBRS9FLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3hELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBRTdFLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3hELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBRTVFLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBRTlFLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBRW5GLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsWUFBWSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBRXJGLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBRW5GLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBRTlFLE1BQU0sQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsZ0NBQXdCLEVBQUUsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzdFLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsMERBQTBELEVBQUUsR0FBRyxFQUFFO1FBQ3JFLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FDNUI7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VjtZQUNELFVBQVUsRUFBRSxVQUFVO1NBQ3RCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxFQUFFO1lBQy9CLEtBQUssQ0FBQyxZQUFZLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7WUFDM0QsVUFBVSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSw2Q0FBNkMsQ0FBQyxDQUFDO1lBQ3BHLEtBQUssQ0FBQyxZQUFZLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7WUFDM0QsVUFBVSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSw2Q0FBNkMsQ0FBQyxDQUFDO1lBQ3BHLEtBQUssQ0FBQyxZQUFZLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7WUFDM0QsVUFBVSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSw2Q0FBNkMsQ0FBQyxDQUFDO1lBQ3BHLEtBQUssQ0FBQyxZQUFZLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7WUFDM0QsVUFBVSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSw2Q0FBNkMsQ0FBQyxDQUFDO1lBQ3BHLEtBQUssQ0FBQyxZQUFZLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7WUFDM0QsVUFBVSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFF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SyxFQUFFLEdBQUcsRUFBRTtnQkFDekIsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUU7Z0JBQ3pCLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUM5QyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQUU7Z0JBQzFELEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFBRTtnQkFDMUQsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUFFO2dCQUMxRCxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQUU7Z0JBQzFELEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFBRTtnQkFDMUQsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUFFO2dCQUMxRCxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQUU7Z0JBQzFELEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFBRTtnQkFDMUQsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUFFO2dCQUN6RCxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQUU7Z0JBQzFELEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFBRTtnQkFDMUQsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUFFO2dCQUMxRCxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQUU7Z0JBQzFELEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFBRTtnQkFDMUQsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxFQUFFO2dCQUMxRCxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLEVBQUU7Z0JBQzFELEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFBRTtnQkFDMUQsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUU7YUFD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