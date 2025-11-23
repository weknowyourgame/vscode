/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { renderFormattedText, renderText } from '../../browser/formattedTextRenderer.js';
import { DisposableStore } from '../../common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../common/utils.js';
import { $ } from '../../browser/dom.js';
suite('FormattedTextRenderer', () => {
    const store = new DisposableStore();
    setup(() => {
        store.clear();
    });
    teardown(() => {
        store.clear();
    });
    test('render simple element', () => {
        const result = renderText('testing');
        assert.strictEqual(result.nodeType, document.ELEMENT_NODE);
        assert.strictEqual(result.textContent, 'testing');
        assert.strictEqual(result.tagName, 'DIV');
    });
    test('render element with target', () => {
        const target = $('div.testClass');
        const result = renderText('testing', {}, target);
        assert.strictEqual(result.nodeType, document.ELEMENT_NODE);
        assert.strictEqual(result, target);
        assert.strictEqual(result.className, 'testClass');
    });
    test('simple formatting', () => {
        let result = renderFormattedText('**bold**');
        assert.strictEqual(result.children.length, 1);
        assert.strictEqual(result.firstChild.textContent, 'bold');
        assert.strictEqual(result.firstChild.tagName, 'B');
        assert.strictEqual(result.innerHTML, '<b>bold</b>');
        result = renderFormattedText('__italics__');
        assert.strictEqual(result.innerHTML, '<i>italics</i>');
        result = renderFormattedText('``code``');
        assert.strictEqual(result.innerHTML, '``code``');
        result = renderFormattedText('``code``', { renderCodeSegments: true });
        assert.strictEqual(result.innerHTML, '<code>code</code>');
        result = renderFormattedText('this string has **bold**, __italics__, and ``code``!!', { renderCodeSegments: true });
        assert.strictEqual(result.innerHTML, 'this string has <b>bold</b>, <i>italics</i>, and <code>code</code>!!');
    });
    test('no formatting', () => {
        const result = renderFormattedText('this is just a string');
        assert.strictEqual(result.innerHTML, 'this is just a string');
    });
    test('preserve newlines', () => {
        const result = renderFormattedText('line one\nline two');
        assert.strictEqual(result.innerHTML, 'line one<br>line two');
    });
    test('action', () => {
        let callbackCalled = false;
        const result = renderFormattedText('[[action]]', {
            actionHandler: {
                callback(content) {
                    assert.strictEqual(content, '0');
                    callbackCalled = true;
                },
                disposables: store
            }
        });
        assert.strictEqual(result.innerHTML, '<a>action</a>');
        const event = document.createEvent('MouseEvent');
        event.initEvent('click', true, true);
        result.firstChild.dispatchEvent(event);
        assert.strictEqual(callbackCalled, true);
    });
    test('fancy action', () => {
        let callbackCalled = false;
        const result = renderFormattedText('__**[[action]]**__', {
            actionHandler: {
                callback(content) {
                    assert.strictEqual(content, '0');
                    callbackCalled = true;
                },
                disposables: store
            }
        });
        assert.strictEqual(result.innerHTML, '<i><b><a>action</a></b></i>');
        const event = document.createEvent('MouseEvent');
        event.initEvent('click', true, true);
        result.firstChild.firstChild.firstChild.dispatchEvent(event);
        assert.strictEqual(callbackCalled, true);
    });
    test('fancier action', () => {
        let callbackCalled = false;
        const result = renderFormattedText('``__**[[action]]**__``', {
            renderCodeSegments: true,
            actionHandler: {
                callback(content) {
                    assert.strictEqual(content, '0');
                    callbackCalled = true;
                },
                disposables: store
            }
        });
        assert.strictEqual(result.innerHTML, '<code><i><b><a>action</a></b></i></code>');
        const event = document.createEvent('MouseEvent');
        event.initEvent('click', true, true);
        result.firstChild.firstChild.firstChild.firstChild.dispatchEvent(event);
        assert.strictEqual(callbackCalled, true);
    });
    test('escaped formatting', () => {
        const result = renderFormattedText('\\*\\*bold\\*\\*');
        assert.strictEqual(result.children.length, 0);
        assert.strictEqual(result.innerHTML, '**bold**');
    });
    ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9ybWF0dGVkVGV4dFJlbmRlcmVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS90ZXN0L2Jyb3dzZXIvZm9ybWF0dGVkVGV4dFJlbmRlcmVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxVQUFVLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN6RixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDNUQsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDN0UsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBRXpDLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLEVBQUU7SUFDbkMsTUFBTSxLQUFLLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztJQUVwQyxLQUFLLENBQUMsR0FBRyxFQUFFO1FBQ1YsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ2YsQ0FBQyxDQUFDLENBQUM7SUFFSCxRQUFRLENBQUMsR0FBRyxFQUFFO1FBQ2IsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ2YsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxFQUFFO1FBQ2xDLE1BQU0sTUFBTSxHQUFnQixVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFbEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUMzRCxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDbEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMs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