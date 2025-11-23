/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { sanitizeHtml } from '../../browser/domSanitize.js';
import { Schemas } from '../../common/network.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../common/utils.js';
suite('DomSanitize', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('removes unsupported tags by default', () => {
        const html = '<div>safe<script>alert(1)</script>content</div>';
        const result = sanitizeHtml(html);
        const str = result.toString();
        assert.ok(str.includes('<div>'));
        assert.ok(str.includes('safe'));
        assert.ok(str.includes('content'));
        assert.ok(!str.includes('<script>'));
        assert.ok(!str.includes('alert(1)'));
    });
    test('removes unsupported attributes by default', () => {
        const html = '<div onclick="alert(1)" title="safe">content</div>';
        const result = sanitizeHtml(html);
        const str = result.toString();
        assert.ok(str.includes('<div title="safe">'));
        assert.ok(!str.includes('onclick'));
        assert.ok(!str.includes('alert(1)'));
    });
    test('allows custom tags via config', () => {
        {
            const html = '<div>removed</div><custom-tag>hello</custom-tag>';
            const result = sanitizeHtml(html, {
                allowedTags: { override: ['custom-tag'] }
            });
            assert.strictEqual(result.toString(), 'removed<custom-tag>hello</custom-tag>');
        }
        {
            const html = '<div>kept</div><augmented-tag>world</augmented-tag>';
            const result = sanitizeHtml(html, {
                allowedTags: { augment: ['augmented-tag'] }
            });
            assert.strictEqual(result.toString(), '<div>kept</div><augmented-tag>world</augmented-tag>');
        }
    });
    test('allows custom attributes via config', () => {
        const html = '<div custom-attr="value">content</div>';
        const result = sanitizeHtml(html, {
            allowedAttributes: { override: ['custom-attr'] }
        });
        const str = result.toString();
        assert.ok(str.includes('custom-attr="value"'));
    });
    test('Attributes in config should be case insensitive', () => {
        const html = '<div Custom-Attr="value">content</div>';
        {
            const result = sanitizeHtml(html, {
                allowedAttributes: { override: ['custom-attr'] }
            });
            assert.ok(result.toString().includes('custom-attr="value"'));
        }
        {
            const result = sanitizeHtml(html, {
                allowedAttributes: { override: ['CUSTOM-ATTR'] }
            });
            assert.ok(result.toString().includes('custom-attr="value"'));
        }
    });
    test('removes unsupported protocols for href by default', () => {
        const html = '<a href="javascript:alert(1)">bad link</a>';
        const result = sanitizeHtml(html);
        const str = result.toString();
        assert.ok(str.includes('<a>bad link</a>'));
        assert.ok(!str.includes('javascript:'));
    });
    test('removes unsupported protocols for src by default', () => {
        const html = '<img alt="text" src="javascript:alert(1)">';
        const result = sanitizeHtml(html);
        const str = result.toString();
        assert.ok(str.includes('<img alt="text">'));
        assert.ok(!str.includes('javascript:'));
    });
    test('allows safe protocols for href', () => {
        const html = '<a href="https://example.com">safe link</a>';
        const result = sanitizeHtml(html);
        assert.ok(result.toString().includes('href="https://example.com"'));
    });
    test('allows fragment links', () => {
        const html = '<a href="#section">fragment link</a>';
        const result = sanitizeHtml(html);
        const str = result.toString();
        assert.ok(str.includes('href="#section"'));
    });
    test('removes data images by default', () => {
        const html = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==">';
        const result = sanitizeHtml(html);
        const str = result.toString();
        assert.ok(str.includes('<img>'));
        assert.ok(!str.includes('src="data:'));
    });
    test('allows data images when enabled', () => {
        const html = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==">';
        const result = sanitizeHtml(html, {
            allowedMediaProtocols: { override: [Schemas.data] }
        });
        assert.ok(result.toString().includes('src="data:image/png;base64,'));
    });
    test('Removes relative paths for img src by default', () => {
        const html = '<img src="path/img.png">';
        const result = sanitizeHtml(html);
        assert.strictEqual(result.toString(), '<img>');
    });
    test('Can allow relative paths for image', () => {
        const html = '<img src="path/img.png">';
        const result = sanitizeHtml(html, {
            allowRelativeMediaPaths: true,
        });
        assert.strictEqual(result.toString(), '<img src="path/img.png">');
    });
    test('Supports dynamic attribute sanitization', () => {
        const html = '<div title="a" other="1">text1</div><div title="b" other="2">text2</div>';
        const result = sanitizeHtml(html, {
            allowedAttributes: {
                override: [
                    {
                        attributeName: 'title',
                        shouldKeep: (_el, data) => {
                            return data.attrValue.includes('b');
                        }
                    }
                ]
            }
        });
        assert.strictEqual(result.toString(), '<div>text1</div><div title="b">text2</div>');
    });
    test('Supports changing attributes in dynamic sanitization', () => {
        const html = '<div title="abc" other="1">text1</div><div title="xyz" other="2">text2</div>';
        const result = sanitizeHtml(html, {
            allowedAttributes: {
                override: [
                    {
                        attributeName: 'title',
                        shouldKeep: (_el, data) => {
                            if (data.attrValue === 'abc') {
                                return false;
                            }
                            return data.attrValue + data.attrValue;
                        }
                    }
                ]
            }
        });
        // xyz title should be preserved and doubled
        assert.strictEqual(result.toString(), '<div>text1</div><div title="xyzxyz">text2</div>');
    });
    test('Attr name should clear previously set dynamic sanitizer', () => {
        const html = '<div title="abc" other="1">text1</div><div title="xyz" other="2">text2</div>';
        const result = sanitizeHtml(html, {
            allowedAttributes: {
                override: [
                    {
                        attributeName: 'title',
                        shouldKeep: () => false
                    },
                    'title' // Should allow everything since it comes after custom rule
                ]
            }
        });
        assert.strictEqual(result.toString(), '<div title="abc">text1</div><div title="xyz">text2</div>');
    });
    suite('replaceWithPlaintext', () => {
        test('replaces unsupported tags with plaintext representation', () => {
            const html = '<div>safe<script>alert(1)</script>content</div>';
            const result = sanitizeHtml(html, {
                replaceWithPlaintext: true
            });
            const str = result.toString();
            assert.strictEqual(str, `<div>safe&lt;script&gt;alert(1)&lt;/script&gt;content</div>`);
        });
        test('handles self-closing tags correctly', () => {
            const html = '<div><input type="text"><custom-input /></div>';
            const result = sanitizeHtml(html, {
                replaceWithPlaintext: true
            });
            assert.strictEqual(result.toString(), '<div>&lt;input type="text"&gt;&lt;custom-input&gt;&lt;/custom-input&gt;</div>');
        });
        test('handles tags with attributes', () => {
            const html = '<div><unknown-tag class="test" id="myid">content</unknown-tag></div>';
            const result = sanitizeHtml(html, {
                replaceWithPlaintext: true
            });
            assert.strictEqual(result.toString(), '<div>&lt;unknown-tag class="test" id="myid"&gt;content&lt;/unknown-tag&gt;</div>');
        });
        test('handles nested unsupported tags', () => {
            const html = '<div><outer><inner>nested</inner></outer></div>';
            const result = sanitizeHtml(html, {
                replaceWithPlaintext: true
            });
            assert.strictEqual(result.toString(), '<div>&lt;outer&gt;&lt;inner&gt;nested&lt;/inner&gt;&lt;/outer&gt;</div>');
        });
        test('handles comments correctly', () => {
            const html = '<div><!-- this is a comment -->content</div>';
            const result = sanitizeHtml(html, {
                replaceWithPlaintext: true
            });
            assert.strictEqual(result.toString(), '<div>&lt;!-- this is a comment --&gt;content</div>');
        });
        test('handles empty tags', () => {
            const html = '<div><empty></empty></div>';
            const result = sanitizeHtml(html, {
                replaceWithPlaintext: true
            });
            assert.strictEqual(result.toString(), '<div>&lt;empty&gt;&lt;/empty&gt;</div>');
        });
        test('works with custom allowed tags configuration', () => {
            const html = '<div><custom>allowed</custom><forbidden>not allowed</forbidden></div>';
            const result = sanitizeHtml(html, {
                replaceWithPlaintext: true,
                allowedTags: { augment: ['custom'] }
            });
            assert.strictEqual(result.toString(), '<div><custom>allowed</custom>&lt;forbidden&gt;not allowed&lt;/forbidden&gt;</div>');
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9tU2FuaXRpemUudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL3Rlc3QvYnJvd3Nlci9kb21TYW5pdGl6ZS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQ2pDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDbEQsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFN0UsS0FBSyxDQUFDLGFBQWEsRUFBRSxHQUFHLEVBQUU7SUFFekIsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxJQUFJLENBQUMscUNBQXFDLEVBQUUsR0FBRyxFQUFFO1FBQ2hELE1BQU0sSUFBSSxHQUFHLGlEQUFpRCxDQUFDO1FBQy9ELE1BQU0sTUFBTSxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsQyxNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7UUFFOUIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDakMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDaEMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDbkMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUNyQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMs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