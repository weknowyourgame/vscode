/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Range } from '../../../../common/core/range.js';
import { TextReplacement } from '../../../../common/core/edits/textEdit.js';
import { createTextModel } from '../../../../test/common/testTextModel.js';
import { computeGhostText } from '../../browser/model/computeGhostText.js';
suite('computeGhostText', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    function getOutput(text, suggestion) {
        const rangeStartOffset = text.indexOf('[');
        const rangeEndOffset = text.indexOf(']') - 1;
        const cleanedText = text.replace('[', '').replace(']', '');
        const tempModel = createTextModel(cleanedText);
        const range = Range.fromPositions(tempModel.getPositionAt(rangeStartOffset), tempModel.getPositionAt(rangeEndOffset));
        const options = ['prefix', 'subword'];
        // eslint-disable-next-line local/code-no-any-casts
        const result = {};
        for (const option of options) {
            result[option] = computeGhostText(new TextReplacement(range, suggestion), tempModel, option)?.render(cleanedText, true);
        }
        tempModel.dispose();
        if (new Set(Object.values(result)).size === 1) {
            return Object.values(result)[0];
        }
        return result;
    }
    test('Basic', () => {
        assert.deepStrictEqual(getOutput('[foo]baz', 'foobar'), 'foo[bar]baz');
        assert.deepStrictEqual(getOutput('[aaa]aaa', 'aaaaaa'), 'aaa[aaa]aaa');
        assert.deepStrictEqual(getOutput('[foo]baz', 'boobar'), undefined);
        assert.deepStrictEqual(getOutput('[foo]foo', 'foofoo'), 'foo[foo]foo');
        assert.deepStrictEqual(getOutput('foo[]', 'bar\nhello'), 'foo[bar\nhello]');
    });
    test('Empty ghost text', () => {
        assert.deepStrictEqual(getOutput('[foo]', 'foo'), 'foo');
    });
    test('Whitespace (indentation)', () => {
        assert.deepStrictEqual(getOutput('[ foo]', 'foobar'), ' foo[bar]');
        assert.deepStrictEqual(getOutput('[\tfoo]', 'foobar'), '\tfoo[bar]');
        assert.deepStrictEqual(getOutput('[\t foo]', '\tfoobar'), '	 foo[bar]');
        assert.deepStrictEqual(getOutput('[\tfoo]', '\t\tfoobar'), { prefix: undefined, subword: '\t[\t]foo[bar]' });
        assert.deepStrictEqual(getOutput('[\t]', '\t\tfoobar'), '\t[\tfoobar]');
        assert.deepStrictEqual(getOutput('\t[]', '\t'), '\t[\t]');
        assert.deepStrictEqual(getOutput('\t[\t]', ''), '\t\t');
        assert.deepStrictEqual(getOutput('[ ]', 'return 1'), ' [return 1]');
    });
    test('Whitespace (outside of indentation)', () => {
        assert.deepStrictEqual(getOutput('bar[ foo]', 'foobar'), undefined);
        assert.deepStrictEqual(getOutput('bar[\tfoo]', 'foobar'), undefined);
    });
    test('Unsupported Case', () => {
        assert.deepStrictEqual(getOutput('fo[o\n]', 'x\nbar'), undefined);
    });
    test('New Line', () => {
        assert.deepStrictEqual(getOutput('fo[o\n]', 'o\nbar'), 'foo\n[bar]');
    });
    test('Multi Part Diffing', () => {
        assert.deepStrictEqual(getOutput('foo[()]', '(x);'), { prefix: undefined, subword: 'foo([x])[;]' });
        assert.deepStrictEqual(getOutput('[\tfoo]', '\t\tfoobar'), { prefix: undefined, subword: '\t[\t]foo[bar]' });
        assert.deepStrictEqual(getOutput('[(y ===)]', '(y === 1) { f(); }'), { prefix: undefined, subword: '(y ===[ 1])[ { f(); }]' });
        assert.deepStrictEqual(getOutput('[(y ==)]', '(y === 1) { f(); }'), { prefix: undefined, subword: '(y ==[= 1])[ { f(); }]' });
        assert.deepStrictEqual(getOutput('[(y ==)]', '(y === 1) { f(); }'), { prefix: undefined, subword: '(y ==[= 1])[ { f(); }]' });
    });
    test('Multi Part Diffing 1', () => {
        assert.deepStrictEqual(getOutput('[if () ()]', 'if (1 == f()) ()'), { prefix: undefined, subword: 'if ([1 == f()]) ()' });
    });
    test('Multi Part Diffing 2', () => {
        assert.deepStrictEqual(getOutput('[)]', '())'), ({ prefix: undefined, subword: '[(])[)]' }));
        assert.deepStrictEqual(getOutput('[))]', '(())'), ({ prefix: undefined, subword: '[((]))' }));
    });
    test('Parenthesis Matching', () => {
        assert.deepStrictEqual(getOutput('[console.log()]', 'console.log({ label: "(" })'), {
            prefix: undefined,
            subword: 'console.log([{ label: "(" }])'
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZUdob3N0VGV4dC50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL3Rlc3QvYnJvd3Nlci9jb21wdXRlR2hvc3RUZXh0LnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDNUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRTNFLEtBQUssQ0FBQyxrQkFBa0IsRUFBRSxHQUFHLEVBQUU7SUFDOUIsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxTQUFTLFNBQVMsQ0FBQyxJQUFZLEVBQUUsVUFBa0I7UUFDbEQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzNDLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzdDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDM0QsTUFBTSxTQUFTLEdBQUcsZUFBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQy9DLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxn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