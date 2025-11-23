/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Range } from '../../../../common/core/range.js';
import { MockInlineCompletionsProvider, withAsyncTestCodeEditorAndInlineCompletionsModel } from './utils.js';
import { Selection } from '../../../../common/core/selection.js';
suite('Inline Completions', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('Does not trigger automatically if disabled', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider, inlineSuggest: { enabled: false } }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('foo');
            await timeout(1000);
            // Provider is not called, no ghost text is shown.
            assert.deepStrictEqual(provider.getAndClearCallHistory(), []);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['']);
        });
    });
    test('Ghost text is shown after trigger', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('foo');
            provider.setReturnValue({ insertText: 'foobar', range: new Range(1, 1, 1, 4) });
            model.triggerExplicitly();
            await timeout(1000);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,4)', text: 'foo', triggerKind: 1, }
            ]);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['', 'foo[bar]']);
        });
    });
    test('Ghost text is shown automatically when configured', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider, inlineSuggest: { enabled: true } }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('foo');
            provider.setReturnValue({ insertText: 'foobar', range: new Range(1, 1, 1, 4) });
            await timeout(1000);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,4)', text: 'foo', triggerKind: 0, }
            ]);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['', 'foo[bar]']);
        });
    });
    test('Ghost text is updated automatically', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            provider.setReturnValue({ insertText: 'foobar', range: new Range(1, 1, 1, 4) });
            context.keyboardType('foo');
            model.triggerExplicitly();
            await timeout(1000);
            provider.setReturnValue({ insertText: 'foobizz', range: new Range(1, 1, 1, 6) });
            context.keyboardType('b');
            context.keyboardType('i');
            await timeout(1000);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,4)', text: 'foo', triggerKind: 1, },
                { position: '(1,6)', text: 'foobi', triggerKind: 0, }
            ]);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['', 'foo[bar]', 'foob[ar]', 'foobi', 'foobi[zz]']);
        });
    });
    test('Unindent whitespace', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('  ');
            provider.setReturnValue({ insertText: 'foo', range: new Range(1, 2, 1, 3) });
            model.triggerExplicitly();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['', '  [foo]']);
            model.accept(editor);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,3)', text: '  ', triggerKind: 1, },
            ]);
            assert.deepStrictEqual(context.getAndClearViewStates(), [' foo']);
        });
    });
    test('Unindent tab', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('\t\t');
            provider.setReturnValue({ insertText: 'foo', range: new Range(1, 2, 1, 3) });
            model.triggerExplicitly();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['', '\t\t[foo]']);
            model.accept(editor);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,3)', text: '\t\t', triggerKind: 1, },
            ]);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['\tfoo']);
        });
    });
    test('No unindent after indentation', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('buzz  ');
            provider.setReturnValue({ insertText: 'foo', range: new Range(1, 6, 1, 7) });
            model.triggerExplicitly();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['']);
            model.accept(editor);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,7)', text: 'buzz  ', triggerKind: 1, },
            ]);
            assert.deepStrictEqual(context.getAndClearViewStates(), []);
        });
    });
    test('Next/previous', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('foo');
            provider.setReturnValue({ insertText: 'foobar1', range: new Range(1, 1, 1, 4) });
            model.trigger();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['', 'foo[bar1]']);
            provider.setReturnValues([
                { insertText: 'foobar1', range: new Range(1, 1, 1, 4) },
                { insertText: 'foobizz2', range: new Range(1, 1, 1, 4) },
                { insertText: 'foobuzz3', range: new Range(1, 1, 1, 4) }
            ]);
            model.next();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['foo[bizz2]']);
            model.next();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['foo[buzz3]']);
            model.next();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['foo[bar1]']);
            model.previous();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['foo[buzz3]']);
            model.previous();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['foo[bizz2]']);
            model.previous();
            await timeout(1000);
            assert.deepStrictEqual(context.getAndClearViewStates(), ['foo[bar1]']);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,4)', text: 'foo', triggerKind: 0, },
                { position: '(1,4)', text: 'foo', triggerKind: 1, },
            ]);
        });
    });
    test('Calling the provider is debounced', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            model.trigger();
            context.keyboardType('f');
            await timeout(40);
            context.keyboardType('o');
            await timeout(40);
            context.keyboardType('o');
            await timeout(40);
            // The provider is not called
            assert.deepStrictEqual(provider.getAndClearCallHistory(), []);
            await timeout(400);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(1,4)', text: 'foo', triggerKind: 0, }
            ]);
            provider.assertNotCalledTwiceWithin50ms();
        });
    });
    test('Backspace is debounced', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider, inlineSuggest: { enabled: true } }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('foo');
            provider.setReturnValue({ insertText: 'foobar', range: new Range(1, 1, 1, 4) });
            await timeout(1000);
            for (let j = 0; j < 2; j++) {
                for (let i = 0; i < 3; i++) {
                    context.leftDelete();
                    await timeout(5);
                }
                context.keyboardType('bar');
            }
            await timeout(400);
            provider.assertNotCalledTwiceWithin50ms();
        });
    });
    suite('Forward Stability', () => {
        test('Typing agrees', async function () {
            // The user types the text as suggested and the provider is forward-stable
            const provider = new MockInlineCompletionsProvider();
            await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
                provider.setReturnValue({ insertText: 'foobar', });
                context.keyboardType('foo');
                model.trigger();
                await timeout(1000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                    { position: '(1,4)', text: 'foo', triggerKind: 0, }
                ]);
                assert.deepStrictEqual(context.getAndClearViewStates(), ['', 'foo[bar]']);
                context.keyboardType('b');
                assert.deepStrictEqual(context.getAndClearViewStates(), (['foob[ar]']));
                await timeout(1000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                    { position: '(1,5)', text: 'foob', triggerKind: 0, }
                ]);
                assert.deepStrictEqual(context.getAndClearViewStates(), []);
                context.keyboardType('a');
                assert.deepStrictEqual(context.getAndClearViewStates(), (['fooba[r]']));
                await timeout(1000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                    { position: '(1,6)', text: 'fooba', triggerKind: 0, }
                ]);
                assert.deepStrictEqual(context.getAndClearViewStates(), []);
            });
        });
        async function setupScenario({ editor, editorViewModel, model, context, store }, provider) {
            assert.deepStrictEqual(context.getAndClearViewStates(), ['']);
            provider.setReturnValue({ insertText: 'foo bar' });
            context.keyboardType('f');
            model.triggerExplicitly();
            await timeout(10000);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), ([{ position: '(1,2)', triggerKind: 1, text: 'f' }]));
            assert.deepStrictEqual(context.getAndClearViewStates(), (['f[oo bar]']));
            provider.setReturnValue({ insertText: 'foo baz' });
            await timeout(10000);
        }
        test('Support forward instability', async function () {
            // The user types the text as suggested and the provider reports a different suggestion.
            const provider = new MockInlineCompletionsProvider();
            await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async (ctx) => {
                await setupScenario(ctx, provider);
                ctx.context.keyboardType('o');
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), ['fo[o bar]']);
                await timeout(10000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                    { position: '(1,3)', text: 'fo', triggerKind: 0, }
                ]);
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), ['fo[o baz]']);
            });
        });
        test('when accepting word by word', async function () {
            // The user types the text as suggested and the provider reports a different suggestion.
            // Even when triggering explicitly, we want to keep the suggestion.
            const provider = new MockInlineCompletionsProvider();
            await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async (ctx) => {
                await setupScenario(ctx, provider);
                await ctx.model.acceptNextWord();
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), (['foo[ bar]']));
                await timeout(10000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), ([{ position: '(1,4)', triggerKind: 0, text: 'foo' }]));
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), ([]));
                await ctx.model.triggerExplicitly(); // reset to provider truth
                await timeout(10000);
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), ([]));
            });
        });
        test('when accepting undo', async function () {
            // The user types the text as suggested and the provider reports a different suggestion.
            const provider = new MockInlineCompletionsProvider();
            await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async (ctx) => {
                await setupScenario(ctx, provider);
                await ctx.model.acceptNextWord();
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), (['foo[ bar]']));
                await timeout(10000);
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), ([]));
                assert.deepStrictEqual(provider.getAndClearCallHistory(), ([{ position: '(1,4)', triggerKind: 0, text: 'foo' }]));
                await ctx.editor.getModel().undo();
                await timeout(10000);
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), (['f[oo bar]']));
                assert.deepStrictEqual(provider.getAndClearCallHistory(), ([{ position: '(1,2)', triggerKind: 0, text: 'f' }]));
                await ctx.editor.getModel().redo();
                await timeout(10000);
                assert.deepStrictEqual(ctx.context.getAndClearViewStates(), (['foo[ bar]']));
                assert.deepStrictEqual(provider.getAndClearCallHistory(), ([{ position: '(1,4)', triggerKind: 0, text: 'foo' }]));
            });
        });
        test('Support backward instability', async function () {
            // The user deletes text and the suggestion changes
            const provider = new MockInlineCompletionsProvider();
            await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
                context.keyboardType('fooba');
                provider.setReturnValue({ insertText: 'foobar', range: new Range(1, 1, 1, 6) });
                model.triggerExplicitly();
                await timeout(1000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                    { position: '(1,6)', text: 'fooba', triggerKind: 1, }
                ]);
                assert.deepStrictEqual(context.getAndClearViewStates(), ['', 'fooba[r]']);
                provider.setReturnValue({ insertText: 'foobaz', range: new Range(1, 1, 1, 5) });
                context.leftDelete();
                await timeout(1000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                    { position: '(1,5)', text: 'foob', triggerKind: 0, }
                ]);
                assert.deepStrictEqual(context.getAndClearViewStates(), [
                    'foob[ar]',
                    'foob[az]'
                ]);
            });
        });
        test('Push item to preserve to front', async function () {
            const provider = new MockInlineCompletionsProvider(true);
            await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
                provider.setReturnValue({ insertText: 'foobar', range: new Range(1, 1, 1, 4) });
                context.keyboardType('foo');
                await timeout(1000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), ([
                    {
                        position: '(1,4)',
                        triggerKind: 0,
                        text: 'foo'
                    }
                ]));
                assert.deepStrictEqual(context.getAndClearViewStates(), ([
                    '',
                    'foo[bar]'
                ]));
                provider.setReturnValues([{ insertText: 'foobar1', range: new Range(1, 1, 1, 4) }, { insertText: 'foobar', range: new Range(1, 1, 1, 4) }]);
                await model.triggerExplicitly();
                await timeout(1000);
                assert.deepStrictEqual(provider.getAndClearCallHistory(), ([
                    {
                        position: '(1,4)',
                        triggerKind: 1,
                        text: 'foo'
                    }
                ]));
                assert.deepStrictEqual(context.getAndClearViewStates(), ([]));
            });
        });
    });
    test('No race conditions', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider, }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('h');
            provider.setReturnValue({ insertText: 'helloworld', range: new Range(1, 1, 1, 2) }, 1000);
            model.triggerExplicitly();
            await timeout(1030);
            context.keyboardType('ello');
            provider.setReturnValue({ insertText: 'helloworld', range: new Range(1, 1, 1, 6) }, 1000);
            // after 20ms: Inline completion provider answers back
            // after 50ms: Debounce is triggered
            await timeout(2000);
            assert.deepStrictEqual(context.getAndClearViewStates(), [
                '',
                'hello[world]',
            ]);
        });
    });
    test('Do not reuse cache from previous session (#132516)', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider, inlineSuggest: { enabled: true } }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('hello\n');
            context.cursorLeft();
            context.keyboardType('x');
            context.leftDelete();
            provider.setReturnValue({ insertText: 'helloworld', range: new Range(1, 1, 1, 6) }, 1000);
            await timeout(2000);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                {
                    position: '(1,6)',
                    text: 'hello\n',
                    triggerKind: 0,
                }
            ]);
            provider.setReturnValue({ insertText: 'helloworld', range: new Range(2, 1, 2, 6) }, 1000);
            context.cursorDown();
            context.keyboardType('hello');
            await timeout(40);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), []);
            // Update ghost text
            context.keyboardType('w');
            context.leftDelete();
            await timeout(2000);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), [
                { position: '(2,6)', triggerKind: 0, text: 'hello\nhello' },
            ]);
            assert.deepStrictEqual(context.getAndClearViewStates(), [
                '',
                'hello[world]\n',
                'hello\n',
                'hello\nhello[world]',
            ]);
        });
    });
    test('Additional Text Edits', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('buzz\nbaz');
            provider.setReturnValue({
                insertText: 'bazz',
                range: new Range(2, 1, 2, 4),
                additionalTextEdits: [{
                        range: new Range(1, 1, 1, 5),
                        text: 'bla'
                    }],
            });
            model.triggerExplicitly();
            await timeout(1000);
            model.accept(editor);
            assert.deepStrictEqual(provider.getAndClearCallHistory(), ([{ position: '(2,4)', triggerKind: 1, text: 'buzz\nbaz' }]));
            assert.deepStrictEqual(context.getAndClearViewStates(), [
                '',
                'buzz\nbaz[z]',
                'bla\nbazz',
            ]);
        });
    });
});
suite('Multi Cursor Support', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('Basic', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('console\nconsole\n');
            editor.setSelections([
                new Selection(1, 1000, 1, 1000),
                new Selection(2, 1000, 2, 1000),
            ]);
            provider.setReturnValue({
                insertText: 'console.log("hello");',
                range: new Range(1, 1, 1, 1000),
            });
            model.triggerExplicitly();
            await timeout(1000);
            model.accept(editor);
            assert.deepStrictEqual(editor.getValue(), [
                `console.log("hello");`,
                `console.log("hello");`,
                ``
            ].join('\n'));
        });
    });
    test('Multi Part', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('console.log()\nconsole.log\n');
            editor.setSelections([
                new Selection(1, 12, 1, 12),
                new Selection(2, 1000, 2, 1000),
            ]);
            provider.setReturnValue({
                insertText: 'console.log("hello");',
                range: new Range(1, 1, 1, 1000),
            });
            model.triggerExplicitly();
            await timeout(1000);
            model.accept(editor);
            assert.deepStrictEqual(editor.getValue(), [
                `console.log("hello");`,
                `console.log`,
                ``
            ].join('\n'));
        });
    });
    test('Multi Part and Different Cursor Columns', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('console.log()\nconsole.warn\n');
            editor.setSelections([
                new Selection(1, 12, 1, 12),
                new Selection(2, 14, 2, 14),
            ]);
            provider.setReturnValue({
                insertText: 'console.log("hello");',
                range: new Range(1, 1, 1, 1000),
            });
            model.triggerExplicitly();
            await timeout(1000);
            model.accept(editor);
            assert.deepStrictEqual(editor.getValue(), [
                `console.log("hello");`,
                `console.warn`,
                ``
            ].join('\n'));
        });
    });
    async function acceptNextWord(model, editor, timesToAccept = 1) {
        for (let i = 0; i < timesToAccept; i++) {
            model.triggerExplicitly();
            await timeout(1000);
            await model.acceptNextWord();
        }
    }
    test('Basic Partial Completion', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('let\nlet\n');
            editor.setSelections([
                new Selection(1, 1000, 1, 1000),
                new Selection(2, 1000, 2, 1000),
            ]);
            provider.setReturnValue({
                insertText: `let a = 'some word'; `,
                range: new Range(1, 1, 1, 1000),
            });
            await acceptNextWord(model, editor, 2);
            assert.deepStrictEqual(editor.getValue(), [
                `let a`,
                `let a`,
                ``
            ].join('\n'));
        });
    });
    test('Partial Multi-Part Completion', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType('for ()\nfor \n');
            editor.setSelections([
                new Selection(1, 5, 1, 5),
                new Selection(2, 1000, 2, 1000),
            ]);
            provider.setReturnValue({
                insertText: `for (let i = 0; i < 10; i++) {`,
                range: new Range(1, 1, 1, 1000),
            });
            model.triggerExplicitly();
            await timeout(1000);
            await acceptNextWord(model, editor, 3);
            assert.deepStrictEqual(editor.getValue(), [
                `for (let i)`,
                `for `,
                ``
            ].join('\n'));
        });
    });
    test('Partial Mutli-Part and Different Cursor Columns Completion', async function () {
        const provider = new MockInlineCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel('', { fakeClock: true, provider }, async ({ editor, editorViewModel, model, context }) => {
            context.keyboardType(`console.log()\nconsole.warnnnn\n`);
            editor.setSelections([
                new Selection(1, 12, 1, 12),
                new Selection(2, 16, 2, 16),
            ]);
            provider.setReturnValue({
                insertText: `console.log("hello" + " " + "world");`,
                range: new Range(1, 1, 1, 1000),
            });
            model.triggerExplicitly();
            await timeout(1000);
            await acceptNextWord(model, editor, 4);
            assert.deepStrictEqual(editor.getValue(), [
                `console.log("hello" + )`,
                `console.warnnnn`,
                ``
            ].join('\n'));
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ29tcGxldGlvbnMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy90ZXN0L2Jyb3dzZXIvaW5saW5lQ29tcGxldGlvbnMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUV6RCxPQUFPLEVBQXFELDZCQUE2QixFQUFFLGdEQUFnRCxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWhLLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUVqRSxLQUFLLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxFQUFFO0lBQ2hDLHVDQUF1QyxFQUFFLENBQUM7SUFFMUMsSUFBSSxDQUFDLDRDQUE0QyxFQUFFLEtBQUs7UUFDdkQsTUFBTSxRQUFRLEdBQUcsSUFBSSw2QkFBNkIsRUFBRSxDQUFDO1FBQ3JELE1BQU0sZ0RBQWdELENBQUMsRUFBRSxFQUN4RCxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUNoRSxLQUFLLEVBQUUsRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFO1lBQ3JELE9BQU8sQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDNUIsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFcEIsa0RBQWtEO1lBQ2xELE1BQU0s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