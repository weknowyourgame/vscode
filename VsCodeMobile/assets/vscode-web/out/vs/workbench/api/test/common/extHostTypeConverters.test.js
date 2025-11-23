/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IconPath } from '../../common/extHostTypeConverters.js';
import { ThemeColor, ThemeIcon } from '../../common/extHostTypes.js';
suite('extHostTypeConverters', function () {
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('IconPath', function () {
        suite('from', function () {
            test('undefined', function () {
                assert.strictEqual(IconPath.from(undefined), undefined);
            });
            test('ThemeIcon', function () {
                const themeIcon = new ThemeIcon('account', new ThemeColor('testing.iconForeground'));
                assert.strictEqual(IconPath.from(themeIcon), themeIcon);
            });
            test('URI', function () {
                const uri = URI.parse('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
                assert.strictEqual(IconPath.from(uri), uri);
            });
            test('string', function () {
                const str = '/path/to/icon.png';
                // eslint-disable-next-line local/code-no-any-casts
                const r1 = IconPath.from(str);
                assert.ok(URI.isUri(r1));
                assert.strictEqual(r1.scheme, 'file');
                assert.strictEqual(r1.path, str);
            });
            test('dark only', function () {
                const input = { dark: URI.file('/path/to/dark.png') };
                // eslint-disable-next-line local/code-no-any-casts
                const result = IconPath.from(input);
                assert.strictEqual(typeof result, 'object');
                assert.ok('light' in result && 'dark' in result);
                assert.ok(URI.isUri(result.light));
                assert.ok(URI.isUri(result.dark));
                assert.strictEqual(result.dark.toString(), input.dark.toString());
                assert.strictEqual(result.light.toString(), input.dark.toString());
            });
            test('dark/light', function () {
                const input = { light: URI.file('/path/to/light.png'), dark: URI.file('/path/to/dark.png') };
                const result = IconPath.from(input);
                assert.strictEqual(typeof result, 'object');
                assert.ok('light' in result && 'dark' in result);
                assert.ok(URI.isUri(result.light));
                assert.ok(URI.isUri(result.dark));
                assert.strictEqual(result.dark.toString(), input.dark.toString());
                assert.strictEqual(result.light.toString(), input.light.toString());
            });
            test('dark/light strings', function () {
                const input = { light: '/path/to/light.png', dark: '/path/to/dark.png' };
                // eslint-disable-next-line local/code-no-any-casts
                const result = IconPath.from(input);
                assert.strictEqual(typeof result, 'object');
                assert.ok('light' in result && 'dark' in result);
                assert.ok(URI.isUri(result.light));
                assert.ok(URI.isUri(result.dark));
                assert.strictEqual(result.dark.path, input.dark);
                assert.strictEqual(result.light.path, input.light);
            });
            test('invalid object', function () {
                const invalidObject = { foo: 'bar' };
                // eslint-disable-next-line local/code-no-any-casts
                const result = IconPath.from(invalidObject);
                assert.strictEqual(result, undefined);
            });
            test('light only', function () {
                const input = { light: URI.file('/path/to/light.png') };
                // eslint-disable-next-line local/code-no-any-casts
                const result = IconPath.from(input);
                assert.strictEqual(result, undefined);
            });
        });
        suite('to', function () {
            test('undefined', function () {
                assert.strictEqual(IconPath.to(undefined), undefined);
            });
            test('ThemeIcon', function () {
                const themeIcon = new ThemeIcon('account');
                assert.strictEqual(IconPath.to(themeIcon), themeIcon);
            });
            test('URI', function () {
                const uri = { scheme: 'data', path: 'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' };
                const result = IconPath.to(uri);
                assert.ok(URI.isUri(result));
                assert.strictEqual(result.toString(), URI.revive(uri).toString());
            });
            test('dark/light', function () {
                const input = {
                    light: { scheme: 'file', path: '/path/to/light.png' },
                    dark: { scheme: 'file', path: '/path/to/dark.png' }
                };
                const result = IconPath.to(input);
                assert.strictEqual(typeof result, 'object');
                assert.ok('light' in result && 'dark' in result);
                assert.ok(URI.isUri(result.light));
                assert.ok(URI.isUri(result.dark));
                assert.strictEqual(result.dark.toString(), URI.revive(input.dark).toString());
                assert.strictEqual(result.light.toString(), URI.revive(input.light).toString());
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdFR5cGVDb252ZXJ0ZXJzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS90ZXN0L2NvbW1vbi9leHRIb3N0VHlwZUNvbnZlcnRlcnMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNwRSxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDakUsT0FBTyxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUVyRSxLQUFLLENBQUMsdUJBQXVCLEVBQUU7SUFDOUIsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxLQUFLLENBQUMsVUFBVSxFQUFFO1FBQ2pCLEtBQUssQ0FBQyxNQUFNLEVBQUU7WUFDYixJQUFJLENBQUMsV0FBVyxFQUFFO2dCQUNqQixNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDekQsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsV0FBVyxFQUFFO2dCQUNqQixNQUFNLFNBQVMsR0FBRyxJQUFJLFNBQVMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxVQUFVLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDO2dCQUNyRixNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDekQsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsS0FBSyxFQUFFO2dCQUNYLE1BQU0sR0FBRyxH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