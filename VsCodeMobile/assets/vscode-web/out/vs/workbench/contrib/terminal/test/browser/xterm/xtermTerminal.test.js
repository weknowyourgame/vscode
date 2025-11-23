/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { deepStrictEqual, strictEqual } from 'assert';
import { importAMDNodeModule } from '../../../../../../amdX.js';
import { Color, RGBA } from '../../../../../../base/common/color.js';
import { Emitter } from '../../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { TerminalCapabilityStore } from '../../../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js';
import { IThemeService } from '../../../../../../platform/theme/common/themeService.js';
import { TestColorTheme } from '../../../../../../platform/theme/test/common/testThemeService.js';
import { PANEL_BACKGROUND, SIDE_BAR_BACKGROUND } from '../../../../../common/theme.js';
import { XtermTerminal } from '../../../browser/xterm/xtermTerminal.js';
import { TERMINAL_VIEW_ID } from '../../../common/terminal.js';
import { registerColors, TERMINAL_BACKGROUND_COLOR, TERMINAL_CURSOR_BACKGROUND_COLOR, TERMINAL_CURSOR_FOREGROUND_COLOR, TERMINAL_FOREGROUND_COLOR, TERMINAL_INACTIVE_SELECTION_BACKGROUND_COLOR, TERMINAL_SELECTION_BACKGROUND_COLOR, TERMINAL_SELECTION_FOREGROUND_COLOR } from '../../../common/terminalColorRegistry.js';
import { workbenchInstantiationService } from '../../../../../test/browser/workbenchTestServices.js';
import { XtermAddonImporter } from '../../../browser/xterm/xtermAddonImporter.js';
registerColors();
class TestWebglAddon {
    static { this.shouldThrow = false; }
    static { this.isEnabled = false; }
    constructor(preserveDrawingBuffer) {
        this.onChangeTextureAtlas = new Emitter().event;
        this.onAddTextureAtlasCanvas = new Emitter().event;
        this.onRemoveTextureAtlasCanvas = new Emitter().event;
        this.onContextLoss = new Emitter().event;
    }
    activate() {
        TestWebglAddon.isEnabled = !TestWebglAddon.shouldThrow;
        if (TestWebglAddon.shouldThrow) {
            throw new Error('Test webgl set to throw');
        }
    }
    dispose() {
        TestWebglAddon.isEnabled = false;
    }
    clearTextureAtlas() { }
}
class TestXtermAddonImporter extends XtermAddonImporter {
    async importAddon(name) {
        if (name === 'webgl') {
            return TestWebglAddon;
        }
        return super.importAddon(name);
    }
}
export class TestViewDescriptorService {
    constructor() {
        this._location = 1 /* ViewContainerLocation.Panel */;
        this._onDidChangeLocation = new Emitter();
        this.onDidChangeLocation = this._onDidChangeLocation.event;
    }
    getViewLocationById(id) {
        return this._location;
    }
    moveTerminalToLocation(to) {
        const oldLocation = this._location;
        this._location = to;
        this._onDidChangeLocation.fire({
            views: [
                { id: TERMINAL_VIEW_ID }
            ],
            from: oldLocation,
            to
        });
    }
}
const defaultTerminalConfig = {
    fontFamily: 'monospace',
    fontWeight: 'normal',
    fontWeightBold: 'normal',
    gpuAcceleration: 'off',
    scrollback: 10,
    fastScrollSensitivity: 2,
    mouseWheelScrollSensitivity: 1,
    unicodeVersion: '6'
};
suite('XtermTerminal', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let configurationService;
    let themeService;
    let xterm;
    let XTermBaseCtor;
    function write(data) {
        return new Promise((resolve) => {
            xterm.write(data, resolve);
        });
    }
    setup(async () => {
        configurationService = new TestConfigurationService({
            editor: {
                fastScrollSensitivity: 2,
                mouseWheelScrollSensitivity: 1
            },
            files: {},
            terminal: {
                integrated: defaultTerminalConfig
            }
        });
        instantiationService = workbenchInstantiationService({
            configurationService: () => configurationService
        }, store);
        themeService = instantiationService.get(IThemeService);
        XTermBaseCtor = (await importAMDNodeModule('@xterm/xterm', 'lib/xterm.js')).Terminal;
        const capabilityStore = store.add(new TerminalCapabilityStore());
        xterm = store.add(instantiationService.createInstance(XtermTerminal, undefined, XTermBaseCtor, {
            cols: 80,
            rows: 30,
            xtermColorProvider: { getBackgroundColor: () => undefined },
            capabilities: capabilityStore,
            disableShellIntegrationReporting: true,
            xtermAddonImporter: new TestXtermAddonImporter(),
        }, undefined));
        TestWebglAddon.shouldThrow = false;
        TestWebglAddon.isEnabled = false;
    });
    test('should use fallback dimensions of 80x30', () => {
        strictEqual(xterm.raw.cols, 80);
        strictEqual(xterm.raw.rows, 30);
    });
    suite('getContentsAsText', () => {
        test('should return all buffer contents when no markers provided', async () => {
            await write('line 1\r\nline 2\r\nline 3\r\nline 4\r\nline 5');
            const result = xterm.getContentsAsText();
            strictEqual(result.startsWith('line 1\nline 2\nline 3\nline 4\nline 5'), true, 'Should include the content plus empty lines up to buffer length');
            const lines = result.split('\n');
            strictEqual(lines.length, xterm.raw.buffer.active.length, 'Should end with empty lines (total buffer size is 30 rows)');
        });
        test('should return contents from start marker to end', async () => {
            await write('line 1\r\n');
            const startMarker = xterm.raw.registerMarker(0);
            await write('line 2\r\nline 3\r\nline 4\r\nline 5');
            const result = xterm.getContentsAsText(startMarker);
            strictEqual(result.startsWith('line 2\nline 3\nline 4\nline 5'), true, 'Should start with line 2 and include empty lines');
        });
        test('should return contents from start to end marker', async () => {
            await write('line 1\r\n');
            const startMarker = xterm.raw.registerMarker(0);
            await write('line 2\r\nline 3\r\n');
            const endMarker = xterm.raw.registerMarker(0);
            await write('line 4\r\nline 5');
            const result = xterm.getContentsAsText(startMarker, endMarker);
            strictEqual(result, 'line 2\nline 3\nline 4');
        });
        test('should return single line when start and end markers are the same', async () => {
            await write('line 1\r\nline 2\r\n');
            const marker = xterm.raw.registerMarker(0);
            await write('line 3\r\nline 4\r\nline 5');
            const result = xterm.getContentsAsText(marker, marker);
            strictEqual(result, 'line 3');
        });
        test('should return empty string when start marker is beyond end marker', async () => {
            await write('line 1\r\n');
            const endMarker = xterm.raw.registerMarker(0);
            await write('line 2\r\nline 3\r\n');
            const startMarker = xterm.raw.registerMarker(0);
            await write('line 4\r\nline 5');
            const result = xterm.getContentsAsText(startMarker, endMarker);
            strictEqual(result, '');
        });
        test('should handle empty buffer', async () => {
            const result = xterm.getContentsAsText();
            const lines = result.split('\n');
            strictEqual(lines.length, xterm.raw.buffer.active.length, 'Empty terminal should have empty lines equal to buffer length');
            strictEqual(lines.every(line => line === ''), true, 'All lines should be empty');
        });
        test('should handle mixed content with spaces and special characters', async () => {
            await write('hello world\r\n  indented line\r\nline with $pecial chars!@#\r\n\r\nempty line above');
            const result = xterm.getContentsAsText();
            strictEqual(result.startsWith('hello world\n  indented line\nline with $pecial chars!@#\n\nempty line above'), true, 'Should handle spaces and special characters correctly');
        });
        test('should throw error when startMarker is disposed (line === -1)', async () => {
            await write('line 1\r\n');
            const disposedMarker = xterm.raw.registerMarker(0);
            await write('line 2\r\nline 3\r\nline 4\r\nline 5');
            disposedMarker.dispose();
            try {
                xterm.getContentsAsText(disposedMarker);
                throw new Error('Expected error was not thrown');
            }
            catch (error) {
                strictEqual(error.message, 'Cannot get contents of a disposed startMarker');
            }
        });
        test('should throw error when endMarker is disposed (line === -1)', async () => {
            await write('line 1\r\n');
            const startMarker = xterm.raw.registerMarker(0);
            await write('line 2\r\n');
            const disposedEndMarker = xterm.raw.registerMarker(0);
            await write('line 3\r\nline 4\r\nline 5');
            disposedEndMarker.dispose();
            try {
                xterm.getContentsAsText(startMarker, disposedEndMarker);
                throw new Error('Expected error was not thrown');
            }
            catch (error) {
                strictEqual(error.message, 'Cannot get contents of a disposed endMarker');
            }
        });
        test('should handle markers at buffer boundaries', async () => {
            const startMarker = xterm.raw.registerMarker(0);
            await write('line 1\r\nline 2\r\nline 3\r\nline 4\r\n');
            const endMarker = xterm.raw.registerMarker(0);
            await write('line 5');
            const result = xterm.getContentsAsText(startMarker, endMarker);
            strictEqual(result, 'line 1\nline 2\nline 3\nline 4\nline 5', 'Should handle markers at buffer boundaries correctly');
        });
        test('should handle terminal escape sequences properly', async () => {
            await write('\x1b[31mred text\x1b[0m\r\n\x1b[32mgreen text\x1b[0m');
            const result = xterm.getContentsAsText();
            strictEqual(result.startsWith('red text\ngreen text'), true, 'ANSI escape sequences should be filtered out, but there will be trailing empty lines');
        });
    });
    suite('getBufferReverseIterator', () => {
        test('should get text properly within scrollback limit', async () => {
            const text = 'line 1\r\nline 2\r\nline 3\r\nline 4\r\nline 5';
            await write(text);
            const result = [...xterm.getBufferReverseIterator()].reverse().join('\r\n');
            strictEqual(text, result, 'Should equal original text');
        });
        test('should get text properly when exceed scrollback limit', async () => {
            // max buffer lines(40) = rows(30) + scrollback(10)
            const text = 'line 1\r\nline 2\r\nline 3\r\nline 4\r\nline 5\r\n'.repeat(8).trim();
            await write(text);
            await write('\r\nline more');
            const result = [...xterm.getBufferReverseIterator()].reverse().join('\r\n');
            const expect = text.slice(8) + '\r\nline more';
            strictEqual(expect, result, 'Should equal original text without line 1');
        });
    });
    suite('theme', () => {
        test('should apply correct background color based on getBackgroundColor', () => {
            themeService.setTheme(new TestColorTheme({
                [PANEL_BACKGROUND]: '#ff0000',
                [SIDE_BAR_BACKGROUND]: '#00ff00'
            }));
            xterm = store.add(instantiationService.createInstance(XtermTerminal, undefined, XTermBaseCtor, {
                cols: 80,
                rows: 30,
                xtermAddonImporter: new TestXtermAddonImporter(),
                xtermColorProvider: { getBackgroundColor: () => new Color(new RGBA(255, 0, 0)) },
                capabilities: store.add(new TerminalCapabilityStore()),
                disableShellIntegrationReporting: true,
            }, undefined));
            strictEqual(xterm.raw.options.theme?.background, '#ff0000');
        });
        test('should react to and apply theme changes', () => {
            themeService.setTheme(new TestColorTheme({
                [TERMINAL_BACKGROUND_COLOR]: '#000100',
                [TERMINAL_FOREGROUND_COLOR]: '#000200',
                [TERMINAL_CURSOR_FOREGROUND_COLOR]: '#000300',
                [TERMINAL_CURSOR_BACKGROUND_COLOR]: '#000400',
                [TERMINAL_SELECTION_BACKGROUND_COLOR]: '#000500',
                [TERMINAL_INACTIVE_SELECTION_BACKGROUND_COLOR]: '#000600',
                [TERMINAL_SELECTION_FOREGROUND_COLOR]: undefined,
                'terminal.ansiBlack': '#010000',
                'terminal.ansiRed': '#020000',
                'terminal.ansiGreen': '#030000',
                'terminal.ansiYellow': '#040000',
                'terminal.ansiBlue': '#050000',
                'terminal.ansiMagenta': '#060000',
                'terminal.ansiCyan': '#070000',
                'terminal.ansiWhite': '#080000',
                'terminal.ansiBrightBlack': '#090000',
                'terminal.ansiBrightRed': '#100000',
                'terminal.ansiBrightGreen': '#110000',
                'terminal.ansiBrightYellow': '#120000',
                'terminal.ansiBrightBlue': '#130000',
                'terminal.ansiBrightMagenta': '#140000',
                'terminal.ansiBrightCyan': '#150000',
                'terminal.ansiBrightWhite': '#160000',
            }));
            xterm = store.add(instantiationService.createInstance(XtermTerminal, undefined, XTermBaseCtor, {
                cols: 80,
                rows: 30,
                xtermAddonImporter: new TestXtermAddonImporter(),
                xtermColorProvider: { getBackgroundColor: () => undefined },
                capabilities: store.add(new TerminalCapabilityStore()),
                disableShellIntegrationReporting: true
            }, undefined));
            deepStrictEqual(xterm.raw.options.theme, {
                background: undefined,
                foreground: '#000200',
                cursor: '#000300',
                cursorAccent: '#000400',
                selectionBackground: '#000500',
                selectionInactiveBackground: '#000600',
                selectionForeground: undefined,
                overviewRulerBorder: undefined,
                scrollbarSliderActiveBackground: undefined,
                scrollbarSliderBackground: undefined,
                scrollbarSliderHoverBackground: undefined,
                black: '#010000',
                green: '#030000',
                red: '#020000',
                yellow: '#040000',
                blue: '#050000',
                magenta: '#060000',
                cyan: '#070000',
                white: '#080000',
                brightBlack: '#090000',
                brightRed: '#100000',
                brightGreen: '#110000',
                brightYellow: '#120000',
                brightBlue: '#130000',
                brightMagenta: '#140000',
                brightCyan: '#150000',
                brightWhite: '#160000',
            });
            themeService.setTheme(new TestColorTheme({
                [TERMINAL_BACKGROUND_COLOR]: '#00010f',
                [TERMINAL_FOREGROUND_COLOR]: '#00020f',
                [TERMINAL_CURSOR_FOREGROUND_COLOR]: '#00030f',
                [TERMINAL_CURSOR_BACKGROUND_COLOR]: '#00040f',
                [TERMINAL_SELECTION_BACKGROUND_COLOR]: '#00050f',
                [TERMINAL_INACTIVE_SELECTION_BACKGROUND_COLOR]: '#00060f',
                [TERMINAL_SELECTION_FOREGROUND_COLOR]: '#00070f',
                'terminal.ansiBlack': '#01000f',
                'terminal.ansiRed': '#02000f',
                'terminal.ansiGreen': '#03000f',
                'terminal.ansiYellow': '#04000f',
                'terminal.ansiBlue': '#05000f',
                'terminal.ansiMagenta': '#06000f',
                'terminal.ansiCyan': '#07000f',
                'terminal.ansiWhite': '#08000f',
                'terminal.ansiBrightBlack': '#09000f',
                'terminal.ansiBrightRed': '#10000f',
                'terminal.ansiBrightGreen': '#11000f',
                'terminal.ansiBrightYellow': '#12000f',
                'terminal.ansiBrightBlue': '#13000f',
                'terminal.ansiBrightMagenta': '#14000f',
                'terminal.ansiBrightCyan': '#15000f',
                'terminal.ansiBrightWhite': '#16000f',
            }));
            deepStrictEqual(xterm.raw.options.theme, {
                background: undefined,
                foreground: '#00020f',
                cursor: '#00030f',
                cursorAccent: '#00040f',
                selectionBackground: '#00050f',
                selectionInactiveBackground: '#00060f',
                selectionForeground: '#00070f',
                overviewRulerBorder: undefined,
                scrollbarSliderActiveBackground: undefined,
                scrollbarSliderBackground: undefined,
                scrollbarSliderHoverBackground: undefined,
                black: '#01000f',
                green: '#03000f',
                red: '#02000f',
                yellow: '#04000f',
                blue: '#05000f',
                magenta: '#06000f',
                cyan: '#07000f',
                white: '#08000f',
                brightBlack: '#09000f',
                brightRed: '#10000f',
                brightGreen: '#11000f',
                brightYellow: '#12000f',
                brightBlue: '#13000f',
                brightMagenta: '#14000f',
                brightCyan: '#15000f',
                brightWhite: '#16000f',
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHRlcm1UZXJtaW5hbC50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL3Rlc3QvYnJvd3Nlci94dGVybS94dGVybVRlcm1pbmFsLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFJaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxXQUFXLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDdEQsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDaEUsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFdEcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sa0ZBQWtGLENBQUM7QUFFNUgsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sb0ZBQW9GLENBQUM7QUFDN0gsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxjQUFjLEVBQW9CLE1BQU0sa0VBQWtFLENBQUM7QUFDcEgsT0FBTyxFQUFFLGdCQUFnQixFQUFFLG1CQUFtQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFdkYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3hFLE9BQU8sRUFBMEIsZ0JBQWdCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUN2RixPQUFPLEVBQUUsY0FBYyxFQUFFLHlCQUF5QixFQUFFLGdDQUFnQyxFQUFFLGdDQUFnQyxFQUFFLHlCQUF5QixFQUFFLDRDQUE0QyxFQUFFLG1DQUFtQyxFQUFFLG1DQUFtQyxFQUFFLE1BQU0sMENBQTBDLENBQUM7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