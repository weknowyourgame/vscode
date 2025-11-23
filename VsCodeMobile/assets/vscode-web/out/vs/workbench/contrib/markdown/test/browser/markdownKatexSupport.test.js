/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { getWindow } from '../../../../../base/browser/dom.js';
import { basicMarkupHtmlTags, defaultAllowedAttrs } from '../../../../../base/browser/domSanitize.js';
import { renderMarkdown } from '../../../../../base/browser/markdownRenderer.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { assertSnapshot } from '../../../../../base/test/common/snapshot.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { MarkedKatexSupport } from '../../browser/markedKatexSupport.js';
suite('Markdown Katex Support Test', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    async function renderMarkdownWithKatex(str) {
        const katex = await MarkedKatexSupport.loadExtension(getWindow(document), {});
        const rendered = store.add(renderMarkdown(new MarkdownString(str), {
            sanitizerConfig: MarkedKatexSupport.getSanitizerOptions({
                allowedTags: basicMarkupHtmlTags,
                allowedAttributes: defaultAllowedAttrs,
            }),
            markedExtensions: [katex],
        }));
        return rendered;
    }
    test('Basic inline equation', async () => {
        const rendered = await renderMarkdownWithKatex('Hello $\\frac{1}{2}$ World!');
        assert.ok(rendered.element.innerHTML.includes('katex'));
        await assertSnapshot(rendered.element.innerHTML);
    });
    test('Should support inline equation wrapped in parans', async () => {
        const rendered = await renderMarkdownWithKatex('Hello ($\\frac{1}{2}$) World!');
        assert.ok(rendered.element.innerHTML.includes('katex'));
        await assertSnapshot(rendered.element.innerHTML);
    });
    test('Should support blocks immediately after paragraph', async () => {
        const rendered = await renderMarkdownWithKatex([
            'Block example:',
            '$$',
            '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}',
            '$$',
        ].join('\n'));
        assert.ok(rendered.element.innerHTML.includes('katex'));
        await assertSnapshot(rendered.element.innerHTML);
    });
    test('Should not render math when dollar sign is preceded by word character', async () => {
        const rendered = await renderMarkdownWithKatex('for ($i = 1; $i -le 20; $i++) { echo "hello world"; Start-Sleep 1 }');
        assert.ok(!rendered.element.innerHTML.includes('katex'));
        await assertSnapshot(rendered.element.innerHTML);
    });
    test('Should not render math when dollar sign is followed by word character', async () => {
        const rendered = await renderMarkdownWithKatex('The cost is $10dollars for this item');
        assert.ok(!rendered.element.innerHTML.includes('katex'));
        await assertSnapshot(rendered.element.innerHTML);
    });
    test('Should still render math with special characters around dollars', async () => {
        const rendered = await renderMarkdownWithKatex('Hello ($\\frac{1}{2}$) and [$x^2$] work fine');
        assert.ok(rendered.element.innerHTML.includes('katex'));
        await assertSnapshot(rendered.element.innerHTML);
    });
    test('Should still render math at start and end of line', async () => {
        const rendered = await renderMarkdownWithKatex('$\\frac{1}{2}$ at start, and at end $x^2$');
        assert.ok(rendered.element.innerHTML.includes('katex'));
        await assertSnapshot(rendered.element.innerHTML);
    });
    test('Should not render math when dollar signs appear in jQuery expressions', async () => {
        const rendered = await renderMarkdownWithKatex('$.getJSON, $.ajax, $.get and $("#dialogDetalleZona").dialog(...) / $("#dialogDetallePDC").dialog(...)');
        assert.ok(!rendered.element.innerHTML.includes('katex'));
        await assertSnapshot(rendered.element.innerHTML);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFya2Rvd25LYXRleFN1cHBvcnQudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tYXJrZG93bi90ZXN0L2Jyb3dzZXIvbWFya2Rvd25LYXRleFN1cHBvcnQudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUNoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUNqRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzdFLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBR3pFLEtBQUssQ0FBQyw2QkFBNkIsRUFBRSxHQUFHLEVBQUU7SUFDekMsTUFBTSxLQUFLLEdBQUcsdUNBQXVDLEVBQUUsQ0FBQztJQUV4RCxLQUFLLFVBQVUsdUJBQXVCLENBQUMsR0FBVztRQUNqRCxNQUFNLEtBQUssR0FBRyxNQUFNLGtCQUFrQixDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDOUUsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsSUFBSSxjQUFjLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDbEUsZUFBZSxFQUFFLGtCQUFrQixDQUFDLG1CQUFtQixDQUFDO2dCQUN2RCxXQUFX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