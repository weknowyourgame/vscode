/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import * as strings from '../../../../base/common/strings.js';
import { assertSnapshot } from '../../../../base/test/common/snapshot.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { OffsetRange } from '../../../common/core/ranges/offsetRange.js';
import { LineDecoration } from '../../../common/viewLayout/lineDecorations.js';
import { DomPosition, RenderLineInput, renderViewLine2 as renderViewLine } from '../../../common/viewLayout/viewLineRenderer.js';
import { TestLineToken, TestLineTokens } from '../core/testLineToken.js';
const HTML_EXTENSION = { extension: 'html' };
function createViewLineTokens(viewLineTokens) {
    return new TestLineTokens(viewLineTokens);
}
function createPart(endIndex, foreground) {
    return new TestLineToken(endIndex, (foreground << 15 /* MetadataConsts.FOREGROUND_OFFSET */) >>> 0);
}
function inflateRenderLineOutput(renderLineOutput) {
    // remove encompassing <span> to simplify test writing.
    let html = renderLineOutput.html;
    if (html.startsWith('<span>')) {
        html = html.replace(/^<span>/, '');
    }
    html = html.replace(/<\/span>$/, '');
    const spans = [];
    let lastIndex = 0;
    do {
        const newIndex = html.indexOf('<span', lastIndex + 1);
        if (newIndex === -1) {
            break;
        }
        spans.push(html.substring(lastIndex, newIndex));
        lastIndex = newIndex;
    } while (true);
    spans.push(html.substring(lastIndex));
    return {
        html: spans,
        mapping: renderLineOutput.characterMapping.inflate(),
    };
}
const defaultRenderLineInputOptions = {
    useMonospaceOptimizations: false,
    canUseHalfwidthRightwardsArrow: true,
    lineContent: '',
    continuesWithWrappedLine: false,
    isBasicASCII: true,
    containsRTL: false,
    fauxIndentLength: 0,
    lineTokens: createViewLineTokens([]),
    lineDecorations: [],
    tabSize: 4,
    startVisibleColumn: 0,
    spaceWidth: 10,
    middotWidth: 10,
    wsmiddotWidth: 10,
    stopRenderingLineAfter: -1,
    renderWhitespace: 'none',
    renderControlCharacters: false,
    fontLigatures: false,
    selectionsOnLine: null,
    textDirection: null,
    verticalScrollbarSize: 14,
    renderNewLineWhenEmpty: false
};
function createRenderLineInputOptions(opts) {
    return {
        ...defaultRenderLineInputOptions,
        ...opts
    };
}
function createRenderLineInput(opts) {
    const options = createRenderLineInputOptions(opts);
    return new RenderLineInput(options.useMonospaceOptimizations, options.canUseHalfwidthRightwardsArrow, options.lineContent, options.continuesWithWrappedLine, options.isBasicASCII, options.containsRTL, options.fauxIndentLength, options.lineTokens, options.lineDecorations, options.tabSize, options.startVisibleColumn, options.spaceWidth, options.middotWidth, options.wsmiddotWidth, options.stopRenderingLineAfter, options.renderWhitespace, options.renderControlCharacters, options.fontLigatures, options.selectionsOnLine, options.textDirection, options.verticalScrollbarSize, options.renderNewLineWhenEmpty);
}
suite('viewLineRenderer.renderLine', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    function assertCharacterReplacement(lineContent, tabSize, expected, expectedCharOffsetInPart) {
        const _actual = renderViewLine(createRenderLineInput({
            lineContent,
            isBasicASCII: strings.isBasicASCII(lineContent),
            lineTokens: createViewLineTokens([new TestLineToken(lineContent.length, 0)]),
            tabSize,
            spaceWidth: 0,
            middotWidth: 0,
            wsmiddotWidth: 0
        }));
        assert.strictEqual(_actual.html, '<span><span class="mtk0">' + expected + '</span></span>');
        const info = expectedCharOffsetInPart.map((absoluteOffset) => [absoluteOffset, [0, absoluteOffset]]);
        assertCharacterMapping3(_actual.characterMapping, info);
    }
    test('replaces spaces', () => {
        assertCharacterReplacement(' ', 4, '\u00a0', [0, 1]);
        assertCharacterReplacement('  ', 4, '\u00a0\u00a0', [0, 1, 2]);
        assertCharacterReplacement('a  b', 4, 'a\u00a0\u00a0b', [0, 1, 2, 3, 4]);
    });
    test('escapes HTML markup', () => {
        assertCharacterReplacement('a<b', 4, 'a&lt;b', [0, 1, 2, 3]);
        assertCharacterReplacement('a>b', 4, 'a&gt;b', [0, 1, 2, 3]);
        assertCharacterReplacement('a&b', 4, 'a&amp;b', [0, 1, 2, 3]);
    });
    test('replaces some bad characters', () => {
        assertCharacterReplacement('a\0b', 4, 'a&#00;b', [0, 1, 2, 3]);
        assertCharacterReplacement('a' + String.fromCharCode(65279 /* CharCode.UTF8_BOM */) + 'b', 4, 'a\ufffdb', [0, 1, 2, 3]);
        assertCharacterReplacement('a\u2028b', 4, 'a\ufffdb', [0, 1, 2, 3]);
    });
    test('handles tabs', () => {
        assertCharacterReplacement('\t', 4, '\u00a0\u00a0\u00a0\u00a0', [0, 4]);
        assertCharacterReplacement('x\t', 4, 'x\u00a0\u00a0\u00a0', [0, 1, 4]);
        assertCharacterReplacement('xx\t', 4, 'xx\u00a0\u00a0', [0, 1, 2, 4]);
        assertCharacterReplacement('xxx\t', 4, 'xxx\u00a0', [0, 1, 2, 3, 4]);
        assertCharacterReplacement('xxxx\t', 4, 'xxxx\u00a0\u00a0\u00a0\u00a0', [0, 1, 2, 3, 4, 8]);
    });
    function assertParts(lineContent, tabSize, parts, expected, info) {
        const _actual = renderViewLine(createRenderLineInput({
            lineContent,
            lineTokens: createViewLineTokens(parts),
            tabSize,
            spaceWidth: 0,
            middotWidth: 0,
            wsmiddotWidth: 0
        }));
        assert.strictEqual(_actual.html, '<span>' + expected + '</span>');
        assertCharacterMapping3(_actual.characterMapping, info);
    }
    test('empty line', () => {
        assertParts('', 4, [], '<span></span>', []);
    });
    test('uses part type', () => {
        assertParts('x', 4, [createPart(1, 10)], '<span class="mtk10">x</span>', [[0, [0, 0]], [1, [0, 1]]]);
        assertParts('x', 4, [createPart(1, 20)], '<span class="mtk20">x</span>', [[0, [0, 0]], [1, [0, 1]]]);
        assertParts('x', 4, [createPart(1, 30)], '<span class="mtk30">x</span>', [[0, [0, 0]], [1, [0, 1]]]);
    });
    test('two parts', () => {
        assertParts('xy', 4, [createPart(1, 1), createPart(2, 2)], '<span class="mtk1">x</span><span class="mtk2">y</span>', [[0, [0, 0]], [1, [1, 0]], [2, [1, 1]]]);
        assertParts('xyz', 4, [createPart(1, 1), createPart(3, 2)], '<span class="mtk1">x</span><span class="mtk2">yz</span>', [[0, [0, 0]], [1, [1, 0]], [2, [1, 1]], [3, [1, 2]]]);
        assertParts('xyz', 4, [createPart(2, 1), createPart(3, 2)], '<span class="mtk1">xy</span><span class="mtk2">z</span>', [[0, [0, 0]], [1, [0, 1]], [2, [1, 0]], [3, [1, 1]]]);
    });
    test('overflow', async () => {
        const _actual = renderViewLine(createRenderLineInput({
            lineContent: 'Hello world!',
            lineTokens: createViewLineTokens([
                createPart(1, 0),
                createPart(2, 1),
                createPart(3, 2),
                createPart(4, 3),
                createPart(5, 4),
                createPart(6, 5),
                createPart(7, 6),
                createPart(8, 7),
                createPart(9, 8),
                createPart(10, 9),
                createPart(11, 10),
                createPart(12, 11),
            ]),
            stopRenderingLineAfter: 6,
            renderWhitespace: 'boundary'
        }));
        const inflated = inflateRenderLineOutput(_actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('typical line', async () => {
        const lineContent = '\t    export class Game { // http://test.com     ';
        const lineTokens = createViewLineTokens([
            createPart(5, 1),
            createPart(11, 2),
            createPart(12, 3),
            createPart(17, 4),
            createPart(18, 5),
            createPart(22, 6),
            createPart(23, 7),
            createPart(24, 8),
            createPart(25, 9),
            createPart(28, 10),
            createPart(43, 11),
            createPart(48, 12),
        ]);
        const _actual = renderViewLine(createRenderLineInput({
            lineContent,
            lineTokens,
            renderWhitespace: 'boundary'
        }));
        const inflated = inflateRenderLineOutput(_actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #2255: Weird line rendering part 1', async () => {
        const lineContent = '\t\t\tcursorStyle:\t\t\t\t\t\t(prevOpts.cursorStyle !== newOpts.cursorStyle),';
        const lineTokens = createViewLineTokens([
            createPart(3, 1), // 3 chars
            createPart(15, 2), // 12 chars
            createPart(21, 3), // 6 chars
            createPart(22, 4), // 1 char
            createPart(43, 5), // 21 chars
            createPart(45, 6), // 2 chars
            createPart(46, 7), // 1 char
            createPart(66, 8), // 20 chars
            createPart(67, 9), // 1 char
            createPart(68, 10), // 2 chars
        ]);
        const _actual = renderViewLine(createRenderLineInput({
            lineContent,
            lineTokens
        }));
        const inflated = inflateRenderLineOutput(_actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #2255: Weird line rendering part 2', async () => {
        const lineContent = ' \t\t\tcursorStyle:\t\t\t\t\t\t(prevOpts.cursorStyle !== newOpts.cursorStyle),';
        const lineTokens = createViewLineTokens([
            createPart(4, 1), // 4 chars
            createPart(16, 2), // 12 chars
            createPart(22, 3), // 6 chars
            createPart(23, 4), // 1 char
            createPart(44, 5), // 21 chars
            createPart(46, 6), // 2 chars
            createPart(47, 7), // 1 char
            createPart(67, 8), // 20 chars
            createPart(68, 9), // 1 char
            createPart(69, 10), // 2 chars
        ]);
        const _actual = renderViewLine(createRenderLineInput({
            lineContent,
            lineTokens
        }));
        const inflated = inflateRenderLineOutput(_actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #91178: after decoration type shown before cursor', async () => {
        const lineContent = '//just a comment';
        const lineTokens = createViewLineTokens([
            createPart(16, 1)
        ]);
        const actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            canUseHalfwidthRightwardsArrow: false,
            lineContent,
            lineTokens,
            lineDecorations: [
                new LineDecoration(13, 13, 'dec1', 2 /* InlineDecorationType.After */),
                new LineDecoration(13, 13, 'dec2', 1 /* InlineDecorationType.Before */),
            ]
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue microsoft/monaco-editor#280: Improved source code rendering for RTL languages', async () => {
        const lineContent = 'var קודמות = \"מיותר קודמות צ\'ט של, אם לשון העברית שינויים ויש, אם\";';
        const lineTokens = createViewLineTokens([
            createPart(3, 6),
            createPart(13, 1),
            createPart(66, 20),
            createPart(67, 1),
        ]);
        const _actual = renderViewLine(createRenderLineInput({
            lineContent,
            isBasicASCII: false,
            containsRTL: true,
            lineTokens
        }));
        const inflated = inflateRenderLineOutput(_actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #137036: Issue in RTL languages in recent versions', async () => {
        const lineContent = '<option value=\"العربية\">العربية</option>';
        const lineTokens = createViewLineTokens([
            createPart(1, 2),
            createPart(7, 3),
            createPart(8, 4),
            createPart(13, 5),
            createPart(14, 4),
            createPart(23, 6),
            createPart(24, 2),
            createPart(31, 4),
            createPart(33, 2),
            createPart(39, 3),
            createPart(40, 2),
        ]);
        const _actual = renderViewLine(createRenderLineInput({
            lineContent,
            isBasicASCII: false,
            containsRTL: true,
            lineTokens
        }));
        const inflated = inflateRenderLineOutput(_actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #99589: Rendering whitespace influences bidi layout', async () => {
        const lineContent = '    [\"🖨️ چاپ فاکتور\",\"🎨 تنظیمات\"]';
        const lineTokens = createViewLineTokens([
            createPart(5, 2),
            createPart(21, 3),
            createPart(22, 2),
            createPart(34, 3),
            createPart(35, 2),
        ]);
        const _actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            lineContent,
            isBasicASCII: false,
            containsRTL: true,
            lineTokens,
            renderWhitespace: 'all'
        }));
        const inflated = inflateRenderLineOutput(_actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #260239: HTML containing bidirectional text is rendered incorrectly', async () => {
        // Simulating HTML like: <p class="myclass" title="العربي">نشاط التدويل!</p>
        // The line contains both LTR (class="myclass") and RTL (title="العربي") attribute values
        const lineContent = '<p class="myclass" title="العربي">نشاط التدويل!</p>';
        const lineTokens = createViewLineTokens([
            createPart(1, 1), // <
            createPart(2, 2), // p
            createPart(3, 3), // (space)
            createPart(8, 4), // class
            createPart(9, 5), // =
            createPart(10, 6), // "
            createPart(17, 7), // myclass
            createPart(18, 6), // "
            createPart(19, 3), // (space)
            createPart(24, 4), // title
            createPart(25, 5), // =
            createPart(26, 6), // "
            createPart(32, 8), // العربي (RTL text) - 6 Arabic characters from position 26-31
            createPart(33, 6), // " - closing quote at position 32
            createPart(34, 1), // >
            createPart(47, 9), // نشاط التدويل! (RTL text) - 13 characters from position 34-46
            createPart(48, 1), // <
            createPart(49, 2), // /
            createPart(50, 2), // p
            createPart(51, 1), // >
        ]);
        const _actual = renderViewLine(new RenderLineInput(false, true, lineContent, false, false, true, 0, lineTokens, [], 4, 0, 10, 10, 10, -1, 'none', false, false, null, null, 14));
        const inflated = inflateRenderLineOutput(_actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #6885: Splits large tokens', async () => {
        //                                                                                                                  1         1         1
        //                        1         2         3         4         5         6         7         8         9         0         1         2
        //               1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234
        const _lineText = 'This is just a long line that contains very interesting text. This is just a long line that contains very interesting text.';
        function assertSplitsTokens(message, lineContent, expectedOutput) {
            const lineTokens = createViewLineTokens([createPart(lineContent.length, 1)]);
            const actual = renderViewLine(createRenderLineInput({
                lineContent,
                lineTokens
            }));
            assert.strictEqual(actual.html, '<span>' + expectedOutput.join('') + '</span>', message);
        }
        // A token with 49 chars
        {
            assertSplitsTokens('49 chars', _lineText.substr(0, 49), [
                '<span class="mtk1">This\u00a0is\u00a0just\u00a0a\u00a0long\u00a0line\u00a0that\u00a0contains\u00a0very\u00a0inter</span>',
            ]);
        }
        // A token with 50 chars
        {
            assertSplitsTokens('50 chars', _lineText.substr(0, 50), [
                '<span class="mtk1">This\u00a0is\u00a0just\u00a0a\u00a0long\u00a0line\u00a0that\u00a0contains\u00a0very\u00a0intere</span>',
            ]);
        }
        // A token with 51 chars
        {
            assertSplitsTokens('51 chars', _lineText.substr(0, 51), [
                '<span class="mtk1">This\u00a0is\u00a0just\u00a0a\u00a0long\u00a0line\u00a0that\u00a0contains\u00a0very\u00a0intere</span>',
                '<span class="mtk1">s</span>',
            ]);
        }
        // A token with 99 chars
        {
            assertSplitsTokens('99 chars', _lineText.substr(0, 99), [
                '<span class="mtk1">This\u00a0is\u00a0just\u00a0a\u00a0long\u00a0line\u00a0that\u00a0contains\u00a0very\u00a0intere</span>',
                '<span class="mtk1">sting\u00a0text.\u00a0This\u00a0is\u00a0just\u00a0a\u00a0long\u00a0line\u00a0that\u00a0contain</span>',
            ]);
        }
        // A token with 100 chars
        {
            assertSplitsTokens('100 chars', _lineText.substr(0, 100), [
                '<span class="mtk1">This\u00a0is\u00a0just\u00a0a\u00a0long\u00a0line\u00a0that\u00a0contains\u00a0very\u00a0intere</span>',
                '<span class="mtk1">sting\u00a0text.\u00a0This\u00a0is\u00a0just\u00a0a\u00a0long\u00a0line\u00a0that\u00a0contains</span>',
            ]);
        }
        // A token with 101 chars
        {
            assertSplitsTokens('101 chars', _lineText.substr(0, 101), [
                '<span class="mtk1">This\u00a0is\u00a0just\u00a0a\u00a0long\u00a0line\u00a0that\u00a0contains\u00a0very\u00a0intere</span>',
                '<span class="mtk1">sting\u00a0text.\u00a0This\u00a0is\u00a0just\u00a0a\u00a0long\u00a0line\u00a0that\u00a0contains</span>',
                '<span class="mtk1">\u00a0</span>',
            ]);
        }
    });
    test('issue #21476: Does not split large tokens when ligatures are on', async () => {
        //                                                                                                                  1         1         1
        //                        1         2         3         4         5         6         7         8         9         0         1         2
        //               1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234
        const _lineText = 'This is just a long line that contains very interesting text. This is just a long line that contains very interesting text.';
        function assertSplitsTokens(message, lineContent, expectedOutput) {
            const lineTokens = createViewLineTokens([createPart(lineContent.length, 1)]);
            const actual = renderViewLine(createRenderLineInput({
                lineContent,
                lineTokens,
                fontLigatures: true
            }));
            assert.strictEqual(actual.html, '<span>' + expectedOutput.join('') + '</span>', message);
        }
        // A token with 101 chars
        {
            assertSplitsTokens('101 chars', _lineText.substr(0, 101), [
                '<span class="mtk1">This\u00a0is\u00a0just\u00a0a\u00a0long\u00a0line\u00a0that\u00a0contains\u00a0very\u00a0</span>',
                '<span class="mtk1">interesting\u00a0text.\u00a0This\u00a0is\u00a0just\u00a0a\u00a0long\u00a0line\u00a0that\u00a0</span>',
                '<span class="mtk1">contains\u00a0</span>',
            ]);
        }
    });
    test('issue #20624: Unaligned surrogate pairs are corrupted at multiples of 50 columns', async () => {
        const lineContent = 'a𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷';
        const lineTokens = createViewLineTokens([createPart(lineContent.length, 1)]);
        const actual = renderViewLine(createRenderLineInput({
            lineContent,
            isBasicASCII: false,
            lineTokens
        }));
        await assertSnapshot(inflateRenderLineOutput(actual).html.join(''), HTML_EXTENSION);
    });
    test('issue #6885: Does not split large tokens in RTL text', async () => {
        const lineContent = 'את גרמנית בהתייחסות שמו, שנתי המשפט אל חפש, אם כתב אחרים ולחבר. של התוכן אודות בויקיפדיה כלל, של עזרה כימיה היא. על עמוד יוצרים מיתולוגיה סדר, אם שכל שתפו לעברית שינויים, אם שאלות אנגלית עזה. שמות בקלות מה סדר.';
        const lineTokens = createViewLineTokens([createPart(lineContent.length, 1)]);
        const actual = renderViewLine(createRenderLineInput({
            lineContent,
            isBasicASCII: false,
            containsRTL: true,
            lineTokens
        }));
        await assertSnapshot(actual.html, HTML_EXTENSION);
    });
    test('issue #95685: Uses unicode replacement character for Paragraph Separator', async () => {
        const lineContent = 'var ftext = [\u2029"Und", "dann", "eines"];';
        const lineTokens = createViewLineTokens([createPart(lineContent.length, 1)]);
        const actual = renderViewLine(createRenderLineInput({
            lineContent,
            isBasicASCII: false,
            lineTokens
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #19673: Monokai Theme bad-highlighting in line wrap', async () => {
        const lineContent = '    MongoCallback<string>): void {';
        const lineTokens = createViewLineTokens([
            createPart(17, 1),
            createPart(18, 2),
            createPart(24, 3),
            createPart(26, 4),
            createPart(27, 5),
            createPart(28, 6),
            createPart(32, 7),
            createPart(34, 8),
        ]);
        const _actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            lineContent,
            fauxIndentLength: 4,
            lineTokens
        }));
        const inflated = inflateRenderLineOutput(_actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
});
function assertCharacterMapping3(actual, expectedInfo) {
    for (let i = 0; i < expectedInfo.length; i++) {
        const [horizontalOffset, [partIndex, charIndex]] = expectedInfo[i];
        const actualDomPosition = actual.getDomPosition(i + 1);
        assert.deepStrictEqual(actualDomPosition, new DomPosition(partIndex, charIndex), `getDomPosition(${i + 1})`);
        let partLength = charIndex + 1;
        for (let j = i + 1; j < expectedInfo.length; j++) {
            const [, [nextPartIndex, nextCharIndex]] = expectedInfo[j];
            if (nextPartIndex === partIndex) {
                partLength = nextCharIndex + 1;
            }
            else {
                break;
            }
        }
        const actualColumn = actual.getColumn(new DomPosition(partIndex, charIndex), partLength);
        assert.strictEqual(actualColumn, i + 1, `actual.getColumn(${partIndex}, ${charIndex})`);
        const actualHorizontalOffset = actual.getHorizontalOffset(i + 1);
        assert.strictEqual(actualHorizontalOffset, horizontalOffset, `actual.getHorizontalOffset(${i + 1})`);
    }
    assert.strictEqual(actual.length, expectedInfo.length, `length mismatch`);
}
suite('viewLineRenderer.renderLine 2', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    function testCreateLineParts(fontIsMonospace, lineContent, tokens, fauxIndentLength, renderWhitespace, selections) {
        const actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: fontIsMonospace,
            lineContent,
            fauxIndentLength,
            lineTokens: createViewLineTokens(tokens),
            renderWhitespace,
            selectionsOnLine: selections
        }));
        return inflateRenderLineOutput(actual);
    }
    test('issue #18616: Inline decorations ending at the text length are no longer rendered', async () => {
        const lineContent = 'https://microsoft.com';
        const actual = renderViewLine(createRenderLineInput({
            lineContent,
            lineTokens: createViewLineTokens([createPart(21, 3)]),
            lineDecorations: [new LineDecoration(1, 22, 'link', 0 /* InlineDecorationType.Regular */)]
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #19207: Link in Monokai is not rendered correctly', async () => {
        const lineContent = '\'let url = `http://***/_api/web/lists/GetByTitle(\\\'Teambuildingaanvragen\\\')/items`;\'';
        const actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            lineContent,
            lineTokens: createViewLineTokens([
                createPart(49, 6),
                createPart(51, 4),
                createPart(72, 6),
                createPart(74, 4),
                createPart(84, 6),
            ]),
            lineDecorations: [
                new LineDecoration(13, 51, 'detected-link', 0 /* InlineDecorationType.Regular */)
            ]
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('createLineParts simple', async () => {
        const actual = testCreateLineParts(false, 'Hello world!', [
            createPart(12, 1)
        ], 0, 'none', null);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts simple two tokens', async () => {
        const actual = testCreateLineParts(false, 'Hello world!', [
            createPart(6, 1),
            createPart(12, 2)
        ], 0, 'none', null);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace - 4 leading spaces', async () => {
        const actual = testCreateLineParts(false, '    Hello world!    ', [
            createPart(4, 1),
            createPart(6, 2),
            createPart(20, 3)
        ], 0, 'boundary', null);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace - 8 leading spaces', async () => {
        const actual = testCreateLineParts(false, '        Hello world!        ', [
            createPart(8, 1),
            createPart(10, 2),
            createPart(28, 3)
        ], 0, 'boundary', null);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace - 2 leading tabs', async () => {
        const actual = testCreateLineParts(false, '\t\tHello world!\t', [
            createPart(2, 1),
            createPart(4, 2),
            createPart(15, 3)
        ], 0, 'boundary', null);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace - mixed leading spaces and tabs', async () => {
        const actual = testCreateLineParts(false, '  \t\t  Hello world! \t  \t   \t    ', [
            createPart(6, 1),
            createPart(8, 2),
            createPart(31, 3)
        ], 0, 'boundary', null);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace skips faux indent', async () => {
        const actual = testCreateLineParts(false, '\t\t  Hello world! \t  \t   \t    ', [
            createPart(4, 1),
            createPart(6, 2),
            createPart(29, 3)
        ], 2, 'boundary', null);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts does not emit width for monospace fonts', async () => {
        const actual = testCreateLineParts(true, '\t\t  Hello world! \t  \t   \t    ', [
            createPart(4, 1),
            createPart(6, 2),
            createPart(29, 3)
        ], 2, 'boundary', null);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace in middle but not for one space', async () => {
        const actual = testCreateLineParts(false, 'it  it it  it', [
            createPart(6, 1),
            createPart(7, 2),
            createPart(13, 3)
        ], 0, 'boundary', null);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace for all in middle', async () => {
        const actual = testCreateLineParts(false, ' Hello world!\t', [
            createPart(4, 0),
            createPart(6, 1),
            createPart(14, 2)
        ], 0, 'all', null);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace for selection with no selections', async () => {
        const actual = testCreateLineParts(false, ' Hello world!\t', [
            createPart(4, 0),
            createPart(6, 1),
            createPart(14, 2)
        ], 0, 'selection', null);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace for selection with whole line selection', async () => {
        const actual = testCreateLineParts(false, ' Hello world!\t', [
            createPart(4, 0),
            createPart(6, 1),
            createPart(14, 2)
        ], 0, 'selection', [new OffsetRange(0, 14)]);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace for selection with selection spanning part of whitespace', async () => {
        const actual = testCreateLineParts(false, ' Hello world!\t', [
            createPart(4, 0),
            createPart(6, 1),
            createPart(14, 2)
        ], 0, 'selection', [new OffsetRange(0, 5)]);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace for selection with multiple selections', async () => {
        const actual = testCreateLineParts(false, ' Hello world!\t', [
            createPart(4, 0),
            createPart(6, 1),
            createPart(14, 2)
        ], 0, 'selection', [new OffsetRange(0, 5), new OffsetRange(9, 14)]);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace for selection with multiple, initially unsorted selections', async () => {
        const actual = testCreateLineParts(false, ' Hello world!\t', [
            createPart(4, 0),
            createPart(6, 1),
            createPart(14, 2)
        ], 0, 'selection', [new OffsetRange(9, 14), new OffsetRange(0, 5)]);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace for selection with selections next to each other', async () => {
        const actual = testCreateLineParts(false, ' * S', [
            createPart(4, 0)
        ], 0, 'selection', [new OffsetRange(0, 1), new OffsetRange(1, 2), new OffsetRange(2, 3)]);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace for trailing with leading, inner, and without trailing whitespace', async () => {
        const actual = testCreateLineParts(false, ' Hello world!', [
            createPart(4, 0),
            createPart(6, 1),
            createPart(14, 2)
        ], 0, 'trailing', null);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace for trailing with leading, inner, and trailing whitespace', async () => {
        const actual = testCreateLineParts(false, ' Hello world! \t', [
            createPart(4, 0),
            createPart(6, 1),
            createPart(15, 2)
        ], 0, 'trailing', null);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace for trailing with 8 leading and 8 trailing whitespaces', async () => {
        const actual = testCreateLineParts(false, '        Hello world!        ', [
            createPart(8, 1),
            createPart(10, 2),
            createPart(28, 3)
        ], 0, 'trailing', null);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts render whitespace for trailing with line containing only whitespaces', async () => {
        const actual = testCreateLineParts(false, ' \t ', [
            createPart(2, 0),
            createPart(3, 1),
        ], 0, 'trailing', null);
        await assertSnapshot(actual.html.join(''), HTML_EXTENSION);
        await assertSnapshot(actual.mapping);
    });
    test('createLineParts can handle unsorted inline decorations', async () => {
        const actual = renderViewLine(createRenderLineInput({
            lineContent: 'Hello world',
            lineTokens: createViewLineTokens([createPart(11, 0)]),
            lineDecorations: [
                new LineDecoration(5, 7, 'a', 0 /* InlineDecorationType.Regular */),
                new LineDecoration(1, 3, 'b', 0 /* InlineDecorationType.Regular */),
                new LineDecoration(2, 8, 'c', 0 /* InlineDecorationType.Regular */),
            ]
        }));
        // 01234567890
        // Hello world
        // ----aa-----
        // bb---------
        // -cccccc----
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #11485: Visible whitespace conflicts with before decorator attachment', async () => {
        const lineContent = '\tbla';
        const actual = renderViewLine(createRenderLineInput({
            lineContent,
            lineTokens: createViewLineTokens([createPart(4, 3)]),
            lineDecorations: [new LineDecoration(1, 2, 'before', 1 /* InlineDecorationType.Before */)],
            renderWhitespace: 'all',
            fontLigatures: true
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #32436: Non-monospace font + visible whitespace + After decorator causes line to "jump"', async () => {
        const lineContent = '\tbla';
        const actual = renderViewLine(createRenderLineInput({
            lineContent,
            lineTokens: createViewLineTokens([createPart(4, 3)]),
            lineDecorations: [new LineDecoration(2, 3, 'before', 1 /* InlineDecorationType.Before */)],
            renderWhitespace: 'all',
            fontLigatures: true
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #30133: Empty lines don\'t render inline decorations', async () => {
        const lineContent = '';
        const actual = renderViewLine(createRenderLineInput({
            lineContent,
            lineTokens: createViewLineTokens([createPart(0, 3)]),
            lineDecorations: [new LineDecoration(1, 2, 'before', 1 /* InlineDecorationType.Before */)],
            renderWhitespace: 'all',
            fontLigatures: true
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #37208: Collapsing bullet point containing emoji in Markdown document results in [??] character', async () => {
        const actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            lineContent: '  1. 🙏',
            isBasicASCII: false,
            lineTokens: createViewLineTokens([createPart(7, 3)]),
            lineDecorations: [new LineDecoration(7, 8, 'inline-folded', 2 /* InlineDecorationType.After */)],
            tabSize: 2,
            stopRenderingLineAfter: 10000
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #37401 #40127: Allow both before and after decorations on empty line', async () => {
        const actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            lineContent: '',
            lineTokens: createViewLineTokens([createPart(0, 3)]),
            lineDecorations: [
                new LineDecoration(1, 1, 'before', 1 /* InlineDecorationType.Before */),
                new LineDecoration(1, 1, 'after', 2 /* InlineDecorationType.After */),
            ],
            tabSize: 2,
            stopRenderingLineAfter: 10000
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #118759: enable multiple text editor decorations in empty lines', async () => {
        const actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            lineContent: '',
            lineTokens: createViewLineTokens([createPart(0, 3)]),
            lineDecorations: [
                new LineDecoration(1, 1, 'after1', 2 /* InlineDecorationType.After */),
                new LineDecoration(1, 1, 'after2', 2 /* InlineDecorationType.After */),
                new LineDecoration(1, 1, 'before1', 1 /* InlineDecorationType.Before */),
                new LineDecoration(1, 1, 'before2', 1 /* InlineDecorationType.Before */),
            ],
            tabSize: 2,
            stopRenderingLineAfter: 10000
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #38935: GitLens end-of-line blame no longer rendering', async () => {
        const actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            lineContent: '\t}',
            lineTokens: createViewLineTokens([createPart(2, 3)]),
            lineDecorations: [
                new LineDecoration(3, 3, 'ced-TextEditorDecorationType2-5e9b9b3f-3 ced-TextEditorDecorationType2-3', 1 /* InlineDecorationType.Before */),
                new LineDecoration(3, 3, 'ced-TextEditorDecorationType2-5e9b9b3f-4 ced-TextEditorDecorationType2-4', 2 /* InlineDecorationType.After */),
            ],
            stopRenderingLineAfter: 10000
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #136622: Inline decorations are not rendering on non-ASCII lines when renderControlCharacters is on', async () => {
        const actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            lineContent: 'some text £',
            isBasicASCII: false,
            lineTokens: createViewLineTokens([createPart(11, 3)]),
            lineDecorations: [
                new LineDecoration(5, 5, 'inlineDec1', 2 /* InlineDecorationType.After */),
                new LineDecoration(6, 6, 'inlineDec2', 1 /* InlineDecorationType.Before */),
            ],
            stopRenderingLineAfter: 10000,
            renderControlCharacters: true
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #22832: Consider fullwidth characters when rendering tabs', async () => {
        const actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            lineContent: 'asd = "擦"\t\t#asd',
            isBasicASCII: false,
            lineTokens: createViewLineTokens([createPart(15, 3)]),
            stopRenderingLineAfter: 10000
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #22832: Consider fullwidth characters when rendering tabs (render whitespace)', async () => {
        const actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            lineContent: 'asd = "擦"\t\t#asd',
            isBasicASCII: false,
            lineTokens: createViewLineTokens([createPart(15, 3)]),
            stopRenderingLineAfter: 10000,
            renderWhitespace: 'all'
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #22352: COMBINING ACUTE ACCENT (U+0301)', async () => {
        const actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            lineContent: '12345689012345678901234568901234567890123456890abába',
            isBasicASCII: false,
            lineTokens: createViewLineTokens([createPart(53, 3)]),
            stopRenderingLineAfter: 10000
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #22352: Partially Broken Complex Script Rendering of Tamil', async () => {
        const actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            lineContent: ' JoyShareல் பின்தொடர்ந்து, விடீயோ, ஜோக்குகள், அனிமேசன், நகைச்சுவை படங்கள் மற்றும் செய்திகளை பெறுவீர்',
            isBasicASCII: false,
            lineTokens: createViewLineTokens([createPart(100, 3)]),
            stopRenderingLineAfter: 10000
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #42700: Hindi characters are not being rendered properly', async () => {
        const actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            lineContent: ' वो ऐसा क्या है जो हमारे अंदर भी है और बाहर भी है। जिसकी वजह से हम सब हैं। जिसने इस सृष्टि की रचना की है।',
            isBasicASCII: false,
            lineTokens: createViewLineTokens([createPart(105, 3)]),
            stopRenderingLineAfter: 10000
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #38123: editor.renderWhitespace: "boundary" renders whitespace at line wrap point when line is wrapped', async () => {
        const actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            lineContent: 'This is a long line which never uses more than two spaces. ',
            continuesWithWrappedLine: true,
            lineTokens: createViewLineTokens([createPart(59, 3)]),
            stopRenderingLineAfter: 10000,
            renderWhitespace: 'boundary'
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #33525: Long line with ligatures takes a long time to paint decorations', async () => {
        const actual = renderViewLine(createRenderLineInput({
            canUseHalfwidthRightwardsArrow: false,
            lineContent: 'append data to append data to append data to append data to append data to append data to append data to append data to append data to append data to append data to append data to append data to',
            lineTokens: createViewLineTokens([createPart(194, 3)]),
            stopRenderingLineAfter: 10000,
            fontLigatures: true
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #33525: Long line with ligatures takes a long time to paint decorations - not possible', async () => {
        const actual = renderViewLine(createRenderLineInput({
            canUseHalfwidthRightwardsArrow: false,
            lineContent: 'appenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatato',
            lineTokens: createViewLineTokens([createPart(194, 3)]),
            stopRenderingLineAfter: 10000,
            fontLigatures: true
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #91936: Semantic token color highlighting fails on line with selected text', async () => {
        const actual = renderViewLine(createRenderLineInput({
            lineContent: '                    else if ($s = 08) then \'\\b\'',
            lineTokens: createViewLineTokens([
                createPart(20, 1),
                createPart(24, 15),
                createPart(25, 1),
                createPart(27, 15),
                createPart(28, 1),
                createPart(29, 1),
                createPart(29, 1),
                createPart(31, 16),
                createPart(32, 1),
                createPart(33, 1),
                createPart(34, 1),
                createPart(36, 6),
                createPart(36, 1),
                createPart(37, 1),
                createPart(38, 1),
                createPart(42, 15),
                createPart(43, 1),
                createPart(47, 11)
            ]),
            stopRenderingLineAfter: 10000,
            renderWhitespace: 'selection',
            selectionsOnLine: [new OffsetRange(0, 47)],
            middotWidth: 11,
            wsmiddotWidth: 11
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #119416: Delete Control Character (U+007F / &#127;) displayed as space', async () => {
        const actual = renderViewLine(createRenderLineInput({
            canUseHalfwidthRightwardsArrow: false,
            lineContent: '[' + String.fromCharCode(127) + '] [' + String.fromCharCode(0) + ']',
            lineTokens: createViewLineTokens([createPart(7, 3)]),
            stopRenderingLineAfter: 10000,
            renderControlCharacters: true,
            fontLigatures: true
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #116939: Important control characters aren\'t rendered', async () => {
        const actual = renderViewLine(createRenderLineInput({
            canUseHalfwidthRightwardsArrow: false,
            lineContent: `transferBalance(5678,${String.fromCharCode(0x202E)}6776,4321${String.fromCharCode(0x202C)},"USD");`,
            isBasicASCII: false,
            lineTokens: createViewLineTokens([createPart(42, 3)]),
            stopRenderingLineAfter: 10000,
            renderControlCharacters: true
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    test('issue #124038: Multiple end-of-line text decorations get merged', async () => {
        const actual = renderViewLine(createRenderLineInput({
            useMonospaceOptimizations: true,
            canUseHalfwidthRightwardsArrow: false,
            lineContent: '    if',
            lineTokens: createViewLineTokens([createPart(4, 1), createPart(6, 2)]),
            lineDecorations: [
                new LineDecoration(7, 7, 'ced-1-TextEditorDecorationType2-17c14d98-3 ced-1-TextEditorDecorationType2-3', 1 /* InlineDecorationType.Before */),
                new LineDecoration(7, 7, 'ced-1-TextEditorDecorationType2-17c14d98-4 ced-1-TextEditorDecorationType2-4', 2 /* InlineDecorationType.After */),
                new LineDecoration(7, 7, 'ced-ghost-text-1-4', 2 /* InlineDecorationType.After */),
            ],
            stopRenderingLineAfter: 10000,
            renderWhitespace: 'all'
        }));
        const inflated = inflateRenderLineOutput(actual);
        await assertSnapshot(inflated.html.join(''), HTML_EXTENSION);
        await assertSnapshot(inflated.mapping);
    });
    function createTestGetColumnOfLinePartOffset(lineContent, tabSize, parts, expectedPartLengths) {
        const renderLineOutput = renderViewLine(createRenderLineInput({
            lineContent,
            tabSize,
            lineTokens: createViewLineTokens(parts)
        }));
        return (partIndex, partLength, offset, expected) => {
            const actualColumn = renderLineOutput.characterMapping.getColumn(new DomPosition(partIndex, offset), partLength);
            assert.strictEqual(actualColumn, expected, 'getColumn for ' + partIndex + ', ' + offset);
        };
    }
    test('getColumnOfLinePartOffset 1 - simple text', () => {
        const testGetColumnOfLinePartOffset = createTestGetColumnOfLinePartOffset('hello world', 4, [
            createPart(11, 1)
        ], [11]);
        testGetColumnOfLinePartOffset(0, 11, 0, 1);
        testGetColumnOfLinePartOffset(0, 11, 1, 2);
        testGetColumnOfLinePartOffset(0, 11, 2, 3);
        testGetColumnOfLinePartOffset(0, 11, 3, 4);
        testGetColumnOfLinePartOffset(0, 11, 4, 5);
        testGetColumnOfLinePartOffset(0, 11, 5, 6);
        testGetColumnOfLinePartOffset(0, 11, 6, 7);
        testGetColumnOfLinePartOffset(0, 11, 7, 8);
        testGetColumnOfLinePartOffset(0, 11, 8, 9);
        testGetColumnOfLinePartOffset(0, 11, 9, 10);
        testGetColumnOfLinePartOffset(0, 11, 10, 11);
        testGetColumnOfLinePartOffset(0, 11, 11, 12);
    });
    test('getColumnOfLinePartOffset 2 - regular JS', () => {
        const testGetColumnOfLinePartOffset = createTestGetColumnOfLinePartOffset('var x = 3;', 4, [
            createPart(3, 1),
            createPart(4, 2),
            createPart(5, 3),
            createPart(8, 4),
            createPart(9, 5),
            createPart(10, 6),
        ], [3, 1, 1, 3, 1, 1]);
        testGetColumnOfLinePartOffset(0, 3, 0, 1);
        testGetColumnOfLinePartOffset(0, 3, 1, 2);
        testGetColumnOfLinePartOffset(0, 3, 2, 3);
        testGetColumnOfLinePartOffset(0, 3, 3, 4);
        testGetColumnOfLinePartOffset(1, 1, 0, 4);
        testGetColumnOfLinePartOffset(1, 1, 1, 5);
        testGetColumnOfLinePartOffset(2, 1, 0, 5);
        testGetColumnOfLinePartOffset(2, 1, 1, 6);
        testGetColumnOfLinePartOffset(3, 3, 0, 6);
        testGetColumnOfLinePartOffset(3, 3, 1, 7);
        testGetColumnOfLinePartOffset(3, 3, 2, 8);
        testGetColumnOfLinePartOffset(3, 3, 3, 9);
        testGetColumnOfLinePartOffset(4, 1, 0, 9);
        testGetColumnOfLinePartOffset(4, 1, 1, 10);
        testGetColumnOfLinePartOffset(5, 1, 0, 10);
        testGetColumnOfLinePartOffset(5, 1, 1, 11);
    });
    test('getColumnOfLinePartOffset 3 - tab with tab size 6', () => {
        const testGetColumnOfLinePartOffset = createTestGetColumnOfLinePartOffset('\t', 6, [
            createPart(1, 1)
        ], [6]);
        testGetColumnOfLinePartOffset(0, 6, 0, 1);
        testGetColumnOfLinePartOffset(0, 6, 1, 1);
        testGetColumnOfLinePartOffset(0, 6, 2, 1);
        testGetColumnOfLinePartOffset(0, 6, 3, 1);
        testGetColumnOfLinePartOffset(0, 6, 4, 2);
        testGetColumnOfLinePartOffset(0, 6, 5, 2);
        testGetColumnOfLinePartOffset(0, 6, 6, 2);
    });
    test('getColumnOfLinePartOffset 4 - once indented line, tab size 4', () => {
        const testGetColumnOfLinePartOffset = createTestGetColumnOfLinePartOffset('\tfunction', 4, [
            createPart(1, 1),
            createPart(9, 2),
        ], [4, 8]);
        testGetColumnOfLinePartOffset(0, 4, 0, 1);
        testGetColumnOfLinePartOffset(0, 4, 1, 1);
        testGetColumnOfLinePartOffset(0, 4, 2, 1);
        testGetColumnOfLinePartOffset(0, 4, 3, 2);
        testGetColumnOfLinePartOffset(0, 4, 4, 2);
        testGetColumnOfLinePartOffset(1, 8, 0, 2);
        testGetColumnOfLinePartOffset(1, 8, 1, 3);
        testGetColumnOfLinePartOffset(1, 8, 2, 4);
        testGetColumnOfLinePartOffset(1, 8, 3, 5);
        testGetColumnOfLinePartOffset(1, 8, 4, 6);
        testGetColumnOfLinePartOffset(1, 8, 5, 7);
        testGetColumnOfLinePartOffset(1, 8, 6, 8);
        testGetColumnOfLinePartOffset(1, 8, 7, 9);
        testGetColumnOfLinePartOffset(1, 8, 8, 10);
    });
    test('getColumnOfLinePartOffset 5 - twice indented line, tab size 4', () => {
        const testGetColumnOfLinePartOffset = createTestGetColumnOfLinePartOffset('\t\tfunction', 4, [
            createPart(2, 1),
            createPart(10, 2),
        ], [8, 8]);
        testGetColumnOfLinePartOffset(0, 8, 0, 1);
        testGetColumnOfLinePartOffset(0, 8, 1, 1);
        testGetColumnOfLinePartOffset(0, 8, 2, 1);
        testGetColumnOfLinePartOffset(0, 8, 3, 2);
        testGetColumnOfLinePartOffset(0, 8, 4, 2);
        testGetColumnOfLinePartOffset(0, 8, 5, 2);
        testGetColumnOfLinePartOffset(0, 8, 6, 2);
        testGetColumnOfLinePartOffset(0, 8, 7, 3);
        testGetColumnOfLinePartOffset(0, 8, 8, 3);
        testGetColumnOfLinePartOffset(1, 8, 0, 3);
        testGetColumnOfLinePartOffset(1, 8, 1, 4);
        testGetColumnOfLinePartOffset(1, 8, 2, 5);
        testGetColumnOfLinePartOffset(1, 8, 3, 6);
        testGetColumnOfLinePartOffset(1, 8, 4, 7);
        testGetColumnOfLinePartOffset(1, 8, 5, 8);
        testGetColumnOfLinePartOffset(1, 8, 6, 9);
        testGetColumnOfLinePartOffset(1, 8, 7, 10);
        testGetColumnOfLinePartOffset(1, 8, 8, 11);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld0xpbmVSZW5kZXJlci50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci90ZXN0L2NvbW1vbi92aWV3TGF5b3V0L3ZpZXdMaW5lUmVuZGVyZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFFNUIsT0FBTyxLQUFLLE9BQU8sTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDMUUsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBR3pFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUMvRSxPQUFPLEVBQW9CLFdBQVcsRUFBMkIsZUFBZSxFQUFxQixlQUFlLElBQUksY0FBYyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFFL0wsT0FBTyxFQUFFLGFBQWEsRUFBRSxjQUFjLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUV6RSxNQUFNLGNBQWMsR0FBRyxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsQ0FBQztBQUU3QyxTQUFTLG9CQUFvQixDQUFDLGNBQStCO0lBQzVELE9BQU8sSUFBSSxjQUFjLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDM0MsQ0FBQztBQUVELFNBQVMsVUFBVSxDQUFDLFFBQWdCLEVBQUUsVUFBa0I7SUFDdkQsT0FBTyxJQUFJLGFBQWEsQ0FBQyxRQUFRLEVBQUUsQ0FDbEMsVUFBVSw2Q0FBb0MsQ0FDOUMsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUNWLENBQUM7QUFFRCxTQUFTLHVCQUF1QixDQUFDLGdCQUFtQztJQUNuRSx1REFBdUQ7SUFDdkQsSUFBSSxJQUFJLEdBQUcsZ0JB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QUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdEcsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRTtRQUN0QixXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLHdEQUF3RCxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlKLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUseURBQXlELEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3SyxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FB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UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDM0MsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDM0MsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDNUMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsbURBQW1ELEVBQUUsR0FBRyxFQUFFO1FBQzlELE1BQU0sNkJBQTZCLEdBQUcsbUNBQW1DLENBQ3hFLElBQUksRUFDSixDQUFDLEVBQ0Q7WUFDQyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUNoQixFQUNELENBQUMsQ0FBQyxDQUFDLENBQ0gsQ0FBQztRQUNGLDZCQUE2QixDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzFDLDZCQUE2QixDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzFDLDZCQUE2QixDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzFDLDZCQUE2QixDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzFDLDZCQUE2QixDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzFDLDZCQUE2QixDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzFDLDZCQUE2QixDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzNDLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDhEQUE4RCxFQUFFLEdBQUcsRUFBRTtRQUN6RSxNQUFNLDZCQUE2QixHQUFHLG1DQUFtQyxDQUN4RSxZQUFZLEVBQ1osQ0FBQyxFQUNEO1lBQ0MsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDaEIsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDaEIsRUFDRCxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FDTixDQUFDO1FBQ0YsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsNkJBQTZCLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDNUMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsK0RBQStELEVBQUUsR0FBRyxFQUFFO1FBQzFFLE1BQU0sNkJBQTZCLEdBQUcsbUNBQW1DLENBQ3hFLGNBQWMsRUFDZCxDQUFDLEVBQ0Q7WUFDQyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNoQixVQUFVLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztTQUNqQixFQUNELENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUNOLENBQUM7UUFDRiw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMzQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUM1QyxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIn0=