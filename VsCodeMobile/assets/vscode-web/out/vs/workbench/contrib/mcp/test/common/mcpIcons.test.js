/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NullLogger } from '../../../../../platform/log/common/log.js';
import { McpIcons, parseAndValidateMcpIcon } from '../../common/mcpIcons.js';
const createHttpLaunch = (url) => ({
    type: 2 /* McpServerTransportType.HTTP */,
    uri: URI.parse(url),
    headers: []
});
const createStdioLaunch = () => ({
    type: 1 /* McpServerTransportType.Stdio */,
    cwd: undefined,
    command: 'cmd',
    args: [],
    env: {},
    envFile: undefined
});
suite('MCP Icons', () => {
    suite('parseAndValidateMcpIcon', () => {
        ensureNoDisposablesAreLeakedInTestSuite();
        test('includes supported icons and sorts sizes ascending', () => {
            const logger = new NullLogger();
            const launch = createHttpLaunch('https://example.com');
            const result = parseAndValidateMcpIcon({
                icons: [
                    { src: 'ftp://example.com/ignored.png', mimeType: 'image/png' },
                    { src: 'data:image/png;base64,AAA', mimeType: 'image/png', sizes: '64x64 16x16' },
                    { src: 'https://example.com/icon.png', mimeType: 'image/png', sizes: '128x128' }
                ]
            }, launch, logger);
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].src.toString(true), 'data:image/png;base64,AAA');
            assert.deepStrictEqual(result[0].sizes.map(s => s.width), [16, 64]);
            assert.strictEqual(result[1].src.toString(), 'https://example.com/icon.png');
            assert.deepStrictEqual(result[1].sizes, [{ width: 128, height: 128 }]);
        });
        test('requires http transport with matching authority for remote icons', () => {
            const logger = new NullLogger();
            const httpLaunch = createHttpLaunch('https://example.com');
            const stdioLaunch = createStdioLaunch();
            const icons = {
                icons: [
                    { src: 'https://example.com/icon.png', mimeType: 'image/png', sizes: '64x64' },
                    { src: 'https://other.com/icon.png', mimeType: 'image/png', sizes: '64x64' }
                ]
            };
            const httpResult = parseAndValidateMcpIcon(icons, httpLaunch, logger);
            assert.deepStrictEqual(httpResult.map(icon => icon.src.toString()), ['https://example.com/icon.png']);
            const stdioResult = parseAndValidateMcpIcon(icons, stdioLaunch, logger);
            assert.strictEqual(stdioResult.length, 0);
        });
        test('accepts file icons only for stdio transport', () => {
            const logger = new NullLogger();
            const stdioLaunch = createStdioLaunch();
            const httpLaunch = createHttpLaunch('https://example.com');
            const icons = {
                icons: [
                    { src: 'file:///tmp/icon.png', mimeType: 'image/png', sizes: '32x32' }
                ]
            };
            const stdioResult = parseAndValidateMcpIcon(icons, stdioLaunch, logger);
            assert.strictEqual(stdioResult.length, 1);
            assert.strictEqual(stdioResult[0].src.scheme, 'file');
            const httpResult = parseAndValidateMcpIcon(icons, httpLaunch, logger);
            assert.strictEqual(httpResult.length, 0);
        });
    });
    suite('McpIcons', () => {
        ensureNoDisposablesAreLeakedInTestSuite();
        test('getUrl returns undefined when no icons are available', () => {
            const icons = McpIcons.fromParsed(undefined);
            assert.strictEqual(icons.getUrl(16), undefined);
        });
        test('getUrl prefers theme-specific icons and keeps light fallback', () => {
            const logger = new NullLogger();
            const launch = createHttpLaunch('https://example.com');
            const parsed = parseAndValidateMcpIcon({
                icons: [
                    { src: 'https://example.com/dark.png', mimeType: 'image/png', sizes: '16x16 48x48', theme: 'dark' },
                    { src: 'https://example.com/any.png', mimeType: 'image/png', sizes: '24x24' },
                    { src: 'https://example.com/light.png', mimeType: 'image/png', sizes: '64x64', theme: 'light' }
                ]
            }, launch, logger);
            const icons = McpIcons.fromParsed(parsed);
            const result = icons.getUrl(32);
            assert.ok(result);
            assert.strictEqual(result.dark.toString(), 'https://example.com/dark.png');
            assert.strictEqual(result.light?.toString(), 'https://example.com/light.png');
        });
        test('getUrl falls back to any-theme icons when no exact size exists', () => {
            const logger = new NullLogger();
            const launch = createHttpLaunch('https://example.com');
            const parsed = parseAndValidateMcpIcon({
                icons: [
                    { src: 'https://example.com/dark.png', mimeType: 'image/png', sizes: '16x16', theme: 'dark' },
                    { src: 'https://example.com/any.png', mimeType: 'image/png', sizes: '64x64' }
                ]
            }, launch, logger);
            const icons = McpIcons.fromParsed(parsed);
            const result = icons.getUrl(60);
            assert.ok(result);
            assert.strictEqual(result.dark.toString(), 'https://example.com/any.png');
            assert.strictEqual(result.light, undefined);
        });
        test('getUrl reuses light icons when dark theme assets are missing', () => {
            const logger = new NullLogger();
            const launch = createHttpLaunch('https://example.com');
            const parsed = parseAndValidateMcpIcon({
                icons: [
                    { src: 'https://example.com/light.png', mimeType: 'image/png', sizes: '32x32', theme: 'light' }
                ]
            }, launch, logger);
            const icons = McpIcons.fromParsed(parsed);
            const result = icons.getUrl(16);
            assert.ok(result);
            assert.strictEqual(result.dark.toString(), 'https://example.com/light.png');
            assert.strictEqual(result.light?.toString(), 'https://example.com/light.png');
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwSWNvbnMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvdGVzdC9jb21tb24vbWNwSWNvbnMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUNqQyxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEQsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxRQUFRLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUc3RSxNQUFNLGdCQUFnQixHQUFHLENBQUMsR0FBVyxFQUEwQixFQUFFLENBQUMsQ0FBQztJQUNsRSxJQUFJLHFDQUE2QjtJQUNqQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUM7SUFDbkIsT0FBTyxFQUFFLEVBQUU7Q0FDWCxDQUFDLENBQUM7QUFFSCxNQUFNLGlCQUFpQixHQUFHLEdBQTRCLEVBQUUsQ0FBQyxDQUFDO0lBQ3pELElBQUksc0NBQThCO0lBQ2xDLEdBQUcsRUFBRSxTQUFTO0lBQ2QsT0FBTyxFQUFFLEtBQUs7SUFDZCxJQUFJLEVBQUUsRUFBRTtJQUNSLEdBQUcsRUFBRSxFQUFFO0lBQ1AsT0FBTyxFQUFFLFNBQVM7Q0FDbEIsQ0FBQyxDQUFDO0FBRUgsS0FBSyxDQUFDLFdBQVcsRUFBRSxHQUFHLEVBQUU7SUFDdkIsS0FBSyxDQUFDLHlCQUF5QixFQUFFLEdBQUcsRUFBRTtRQUNyQyx1Q0FBdUMsRUFBRSxDQUFDO1FBRTFDLElBQUksQ0FBQyxvREFBb0QsRUFBRSxHQUFHLEVBQUU7WUFDL0QsTUFBTSxNQUFNLEdBQUcs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