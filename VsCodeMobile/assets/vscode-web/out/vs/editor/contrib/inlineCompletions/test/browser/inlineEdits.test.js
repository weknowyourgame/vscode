/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { AnnotatedText, InlineEditContext, MockSearchReplaceCompletionsProvider, withAsyncTestCodeEditorAndInlineCompletionsModel } from './utils.js';
suite('Inline Edits', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    const val = new AnnotatedText(`
class Point {
	constructor(public x: number, public y: number) {}

	getLength2D(): number {
		return↓ Math.sqrt(this.x * this.x + this.y * this.y↓);
	}
}
`);
    async function runTest(cb) {
        const provider = new MockSearchReplaceCompletionsProvider();
        await withAsyncTestCodeEditorAndInlineCompletionsModel(val.value, { fakeClock: true, provider, inlineSuggest: { enabled: true } }, async (ctx) => {
            const view = new InlineEditContext(ctx.model, ctx.editor);
            ctx.store.add(view);
            await cb(ctx, provider, view);
        });
    }
    test('Can Accept Inline Edit', async function () {
        await runTest(async ({ context, model, editor, editorViewModel }, provider, view) => {
            provider.add(`getLength2D(): number {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}`, `getLength3D(): number {
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	}`);
            await model.trigger();
            await timeout(10000);
            assert.deepStrictEqual(view.getAndClearViewStates(), ([
                undefined,
                '\n\tget❰Length2↦Length3❱D(): numbe...\n...y * this.y❰ + th...his.z❱);\n'
            ]));
            model.accept();
            assert.deepStrictEqual(editor.getValue(), `
class Point {
	constructor(public x: number, public y: number) {}

	getLength3D(): number {
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	}
}
`);
        });
    });
    test('Can Type Inline Edit', async function () {
        await runTest(async ({ context, model, editor, editorViewModel }, provider, view) => {
            provider.add(`getLength2D(): number {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}`, `getLength3D(): number {
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	}`);
            await model.trigger();
            await timeout(10000);
            assert.deepStrictEqual(view.getAndClearViewStates(), ([
                undefined,
                '\n\tget❰Length2↦Length3❱D(): numbe...\n...y * this.y❰ + th...his.z❱);\n'
            ]));
            editor.setPosition(val.getMarkerPosition(1));
            editorViewModel.type(' + t');
            assert.deepStrictEqual(view.getAndClearViewStates(), ([
                '\n\tget❰Length2↦Length3❱D(): numbe...\n...this.y + t❰his.z...his.z❱);\n'
            ]));
            editorViewModel.type('his.z * this.z');
            assert.deepStrictEqual(view.getAndClearViewStates(), ([
                '\n\tget❰Length2↦Length3❱D(): numbe...'
            ]));
        });
    });
    test('Inline Edit Stays On Unrelated Edit', async function () {
        await runTest(async ({ context, model, editor, editorViewModel }, provider, view) => {
            provider.add(`getLength2D(): number {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}`, `getLength3D(): number {
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	}`);
            await model.trigger();
            await timeout(10000);
            assert.deepStrictEqual(view.getAndClearViewStates(), ([
                undefined,
                '\n\tget❰Length2↦Length3❱D(): numbe...\n...y * this.y❰ + th...his.z❱);\n'
            ]));
            editor.setPosition(val.getMarkerPosition(0));
            editorViewModel.type('/* */');
            assert.deepStrictEqual(view.getAndClearViewStates(), ([
                '\n\tget❰Length2↦Length3❱D(): numbe...\n...y * this.y❰ + th...his.z❱);\n'
            ]));
            await timeout(10000);
            assert.deepStrictEqual(view.getAndClearViewStates(), ([
                undefined
            ]));
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdHMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy90ZXN0L2Jyb3dzZXIvaW5saW5lRWRpdHMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxhQUFhLEVBQUUsaUJBQWlCLEVBQXFELG9DQUFvQyxFQUFFLGdEQUFnRCxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRXpNLEtBQUssQ0FBQyxjQUFjLEVBQUUsR0FBRyxFQUFFO0lBQzFCLHVDQUF1QyxFQUFFLENBQUM7SUFFMUMsTUFBTSxHQUFHLEdBQUcsSUFBSSxhQUFhLENBQUM7Ozs7Ozs7O0NBUTlCLENBQUMsQ0FBQztJQUVGLEtBQUssVUFBVSxPQUFPLENBQUMsRUFBc0o7UUFDNUssTUFBTSxRQUFRLEdBQUcsSUFBSSxvQ0FBb0MsRUFBRSxDQUFDO1FBQzVELE1BQU0sZ0RBQWdELENBQUMsR0FBRyxDQUFDLEtBQUssRUFDL0QsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFDL0QsS0FBSyxFQUFFLEdBQUcsRUFBRSxFQUFFO1lBQ2IsTUFBTSxJQUFJLEdBQUcsSUFBSSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMxRCxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwQixNQUFNLEVBQUUsQ0FB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