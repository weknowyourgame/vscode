/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { Lazy } from '../../../../base/common/lazy.js';
import { URI } from '../../../../base/common/uri.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TextEditorCursorStyle } from '../../../../editor/common/config/editorOptions.js';
import { NullLogService } from '../../../../platform/log/common/log.js';
import { ExtHostDocumentData } from '../../common/extHostDocumentData.js';
import { ExtHostTextEditor, ExtHostTextEditorOptions } from '../../common/extHostTextEditor.js';
import { Range, TextEditorLineNumbersStyle } from '../../common/extHostTypes.js';
suite('ExtHostTextEditor', () => {
    let editor;
    const doc = new ExtHostDocumentData(undefined, URI.file(''), [
        'aaaa bbbb+cccc abc'
    ], '\n', 1, 'text', false, 'utf8');
    setup(() => {
        editor = new ExtHostTextEditor('fake', null, new NullLogService(), new Lazy(() => doc.document), [], { cursorStyle: TextEditorCursorStyle.Line, insertSpaces: true, lineNumbers: 1, tabSize: 4, indentSize: 4, originalIndentSize: 'tabSize' }, [], 1);
    });
    test('disposed editor', () => {
        assert.ok(editor.value.document);
        editor._acceptViewColumn(3);
        assert.strictEqual(3, editor.value.viewColumn);
        editor.dispose();
        assert.throws(() => editor._acceptViewColumn(2));
        assert.strictEqual(3, editor.value.viewColumn);
        assert.ok(editor.value.document);
        assert.throws(() => editor._acceptOptions(null));
        assert.throws(() => editor._acceptSelections([]));
    });
    test('API [bug]: registerTextEditorCommand clears redo stack even if no edits are made #55163', async function () {
        let applyCount = 0;
        const editor = new ExtHostTextEditor('edt1', new class extends mock() {
            $tryApplyEdits() {
                applyCount += 1;
                return Promise.resolve(true);
            }
        }, new NullLogService(), new Lazy(() => doc.document), [], { cursorStyle: TextEditorCursorStyle.Line, insertSpaces: true, lineNumbers: 1, tabSize: 4, indentSize: 4, originalIndentSize: 'tabSize' }, [], 1);
        await editor.value.edit(edit => { });
        assert.strictEqual(applyCount, 0);
        await editor.value.edit(edit => { edit.setEndOfLine(1); });
        assert.strictEqual(applyCount, 1);
        await editor.value.edit(edit => { edit.delete(new Range(0, 0, 1, 1)); });
        assert.strictEqual(applyCount, 2);
    });
    ensureNoDisposablesAreLeakedInTestSuite();
});
suite('ExtHostTextEditorOptions', () => {
    let opts;
    let calls = [];
    setup(() => {
        calls = [];
        const mockProxy = {
            dispose: undefined,
            $trySetOptions: (id, options) => {
                assert.strictEqual(id, '1');
                calls.push(options);
                return Promise.resolve(undefined);
            },
            $tryShowTextDocument: undefined,
            $registerTextEditorDecorationType: undefined,
            $removeTextEditorDecorationType: undefined,
            $tryShowEditor: undefined,
            $tryHideEditor: undefined,
            $trySetDecorations: undefined,
            $trySetDecorationsFast: undefined,
            $tryRevealRange: undefined,
            $trySetSelections: undefined,
            $tryApplyEdits: undefined,
            $tryInsertSnippet: undefined,
            $getDiffInformation: undefined
        };
        opts = new ExtHostTextEditorOptions(mockProxy, '1', {
            tabSize: 4,
            indentSize: 4,
            originalIndentSize: 'tabSize',
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        }, new NullLogService());
    });
    teardown(() => {
        opts = null;
        calls = null;
    });
    function assertState(opts, expected) {
        const actual = {
            tabSize: opts.value.tabSize,
            indentSize: opts.value.indentSize,
            insertSpaces: opts.value.insertSpaces,
            cursorStyle: opts.value.cursorStyle,
            lineNumbers: opts.value.lineNumbers
        };
        assert.deepStrictEqual(actual, expected);
    }
    test('can set tabSize to the same value', () => {
        opts.value.tabSize = 4;
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, []);
    });
    test('can change tabSize to positive integer', () => {
        opts.value.tabSize = 1;
        assertState(opts, {
            tabSize: 1,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ tabSize: 1 }]);
    });
    test('can change tabSize to positive float', () => {
        opts.value.tabSize = 2.3;
        assertState(opts, {
            tabSize: 2,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ tabSize: 2 }]);
    });
    test('can change tabSize to a string number', () => {
        opts.value.tabSize = '2';
        assertState(opts, {
            tabSize: 2,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ tabSize: 2 }]);
    });
    test('tabSize can request indentation detection', () => {
        opts.value.tabSize = 'auto';
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ tabSize: 'auto' }]);
    });
    test('ignores invalid tabSize 1', () => {
        opts.value.tabSize = null;
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, []);
    });
    test('ignores invalid tabSize 2', () => {
        opts.value.tabSize = -5;
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, []);
    });
    test('ignores invalid tabSize 3', () => {
        opts.value.tabSize = 'hello';
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, []);
    });
    test('ignores invalid tabSize 4', () => {
        opts.value.tabSize = '-17';
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, []);
    });
    test('can set indentSize to the same value', () => {
        opts.value.indentSize = 4;
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ indentSize: 4 }]);
    });
    test('can change indentSize to positive integer', () => {
        opts.value.indentSize = 1;
        assertState(opts, {
            tabSize: 4,
            indentSize: 1,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ indentSize: 1 }]);
    });
    test('can change indentSize to positive float', () => {
        opts.value.indentSize = 2.3;
        assertState(opts, {
            tabSize: 4,
            indentSize: 2,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ indentSize: 2 }]);
    });
    test('can change indentSize to a string number', () => {
        // eslint-disable-next-line local/code-no-any-casts
        opts.value.indentSize = '2';
        assertState(opts, {
            tabSize: 4,
            indentSize: 2,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ indentSize: 2 }]);
    });
    test('indentSize can request to use tabSize', () => {
        opts.value.indentSize = 'tabSize';
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ indentSize: 'tabSize' }]);
    });
    test('indentSize cannot request indentation detection', () => {
        // eslint-disable-next-line local/code-no-any-casts
        opts.value.indentSize = 'auto';
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, []);
    });
    test('ignores invalid indentSize 1', () => {
        opts.value.indentSize = null;
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, []);
    });
    test('ignores invalid indentSize 2', () => {
        opts.value.indentSize = -5;
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, []);
    });
    test('ignores invalid indentSize 3', () => {
        // eslint-disable-next-line local/code-no-any-casts
        opts.value.indentSize = 'hello';
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, []);
    });
    test('ignores invalid indentSize 4', () => {
        // eslint-disable-next-line local/code-no-any-casts
        opts.value.indentSize = '-17';
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, []);
    });
    test('can set insertSpaces to the same value', () => {
        opts.value.insertSpaces = false;
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, []);
    });
    test('can set insertSpaces to boolean', () => {
        opts.value.insertSpaces = true;
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: true,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ insertSpaces: true }]);
    });
    test('can set insertSpaces to false string', () => {
        opts.value.insertSpaces = 'false';
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, []);
    });
    test('can set insertSpaces to truey', () => {
        opts.value.insertSpaces = 'hello';
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: true,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ insertSpaces: true }]);
    });
    test('insertSpaces can request indentation detection', () => {
        opts.value.insertSpaces = 'auto';
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ insertSpaces: 'auto' }]);
    });
    test('can set cursorStyle to same value', () => {
        opts.value.cursorStyle = TextEditorCursorStyle.Line;
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, []);
    });
    test('can change cursorStyle', () => {
        opts.value.cursorStyle = TextEditorCursorStyle.Block;
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Block,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ cursorStyle: TextEditorCursorStyle.Block }]);
    });
    test('can set lineNumbers to same value', () => {
        opts.value.lineNumbers = TextEditorLineNumbersStyle.On;
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, []);
    });
    test('can change lineNumbers', () => {
        opts.value.lineNumbers = TextEditorLineNumbersStyle.Off;
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 0 /* RenderLineNumbersType.Off */
        });
        assert.deepStrictEqual(calls, [{ lineNumbers: 0 /* RenderLineNumbersType.Off */ }]);
    });
    test('can do bulk updates 0', () => {
        opts.assign({
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: TextEditorLineNumbersStyle.On
        });
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ indentSize: 4 }]);
    });
    test('can do bulk updates 1', () => {
        opts.assign({
            tabSize: 'auto',
            insertSpaces: true
        });
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: true,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ tabSize: 'auto', insertSpaces: true }]);
    });
    test('can do bulk updates 2', () => {
        opts.assign({
            tabSize: 3,
            insertSpaces: 'auto'
        });
        assertState(opts, {
            tabSize: 3,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Line,
            lineNumbers: 1 /* RenderLineNumbersType.On */
        });
        assert.deepStrictEqual(calls, [{ tabSize: 3, insertSpaces: 'auto' }]);
    });
    test('can do bulk updates 3', () => {
        opts.assign({
            cursorStyle: TextEditorCursorStyle.Block,
            lineNumbers: TextEditorLineNumbersStyle.Relative
        });
        assertState(opts, {
            tabSize: 4,
            indentSize: 4,
            insertSpaces: false,
            cursorStyle: TextEditorCursorStyle.Block,
            lineNumbers: 2 /* RenderLineNumbersType.Relative */
        });
        assert.deepStrictEqual(calls, [{ cursorStyle: TextEditorCursorStyle.Block, lineNumbers: 2 /* RenderLineNumbersType.Relative */ }]);
    });
    ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdFRleHRFZGl0b3IudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0VGV4dEVkaXRvci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBQ2hHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM1RCxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRyxPQUFPLEVBQXlCLHFCQUFxQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDakgsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRXhFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxLQUFLLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUVqRixLQUFLLENBQUMsbUJBQW1CLEVBQUUsR0FBRyxFQUFFO0lBRS9CLElBQUksTUFBeUIsQ0FBQztJQUM5QixNQUFNLEdBQUcsR0FBRyxJQUFJLG1CQUFtQixDQUFDLFNBQVUsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFO1FBQzdELG9CQUFvQjtLQUNwQixFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztJQUVuQyxLQUFLLENBQUMsR0FBRyxFQUFF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