/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { migrateOptions } from '../../../browser/config/migrateOptions.js';
import { EditorZoom } from '../../../common/config/editorZoom.js';
import { TestConfiguration } from './testConfiguration.js';
suite('Common Editor Config', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('Zoom Level', () => {
        //Zoom levels are defined to go between -5, 20 inclusive
        const zoom = EditorZoom;
        zoom.setZoomLevel(0);
        assert.strictEqual(zoom.getZoomLevel(), 0);
        zoom.setZoomLevel(-0);
        assert.strictEqual(zoom.getZoomLevel(), 0);
        zoom.setZoomLevel(5);
        assert.strictEqual(zoom.getZoomLevel(), 5);
        zoom.setZoomLevel(-1);
        assert.strictEqual(zoom.getZoomLevel(), -1);
        zoom.setZoomLevel(9);
        assert.strictEqual(zoom.getZoomLevel(), 9);
        zoom.setZoomLevel(-9);
        assert.strictEqual(zoom.getZoomLevel(), -5);
        zoom.setZoomLevel(20);
        assert.strictEqual(zoom.getZoomLevel(), 20);
        zoom.setZoomLevel(-10);
        assert.strictEqual(zoom.getZoomLevel(), -5);
        zoom.setZoomLevel(9.1);
        assert.strictEqual(zoom.getZoomLevel(), 9.1);
        zoom.setZoomLevel(-9.1);
        assert.strictEqual(zoom.getZoomLevel(), -5);
        zoom.setZoomLevel(Infinity);
        assert.strictEqual(zoom.getZoomLevel(), 20);
        zoom.setZoomLevel(Number.NEGATIVE_INFINITY);
        assert.strictEqual(zoom.getZoomLevel(), -5);
    });
    class TestWrappingConfiguration extends TestConfiguration {
        _readEnvConfiguration() {
            return {
                extraEditorClassName: '',
                outerWidth: 1000,
                outerHeight: 100,
                emptySelectionClipboard: true,
                pixelRatio: 1,
                accessibilitySupport: 0 /* AccessibilitySupport.Unknown */,
                editContextSupported: true,
            };
        }
    }
    function assertWrapping(config, isViewportWrapping, wrappingColumn) {
        const options = config.options;
        const wrappingInfo = options.get(166 /* EditorOption.wrappingInfo */);
        assert.strictEqual(wrappingInfo.isViewportWrapping, isViewportWrapping);
        assert.strictEqual(wrappingInfo.wrappingColumn, wrappingColumn);
    }
    test('wordWrap default', () => {
        const config = new TestWrappingConfiguration({});
        assertWrapping(config, false, -1);
        config.dispose();
    });
    test('wordWrap compat false', () => {
        const config = new TestWrappingConfiguration({
            // eslint-disable-next-line local/code-no-any-casts
            wordWrap: false
        });
        assertWrapping(config, false, -1);
        config.dispose();
    });
    test('wordWrap compat true', () => {
        const config = new TestWrappingConfiguration({
            // eslint-disable-next-line local/code-no-any-casts
            wordWrap: true
        });
        assertWrapping(config, true, 80);
        config.dispose();
    });
    test('wordWrap on', () => {
        const config = new TestWrappingConfiguration({
            wordWrap: 'on'
        });
        assertWrapping(config, true, 80);
        config.dispose();
    });
    test('wordWrap on without minimap', () => {
        const config = new TestWrappingConfiguration({
            wordWrap: 'on',
            minimap: {
                enabled: false
            }
        });
        assertWrapping(config, true, 88);
        config.dispose();
    });
    test('wordWrap on does not use wordWrapColumn', () => {
        const config = new TestWrappingConfiguration({
            wordWrap: 'on',
            wordWrapColumn: 10
        });
        assertWrapping(config, true, 80);
        config.dispose();
    });
    test('wordWrap off', () => {
        const config = new TestWrappingConfiguration({
            wordWrap: 'off'
        });
        assertWrapping(config, false, -1);
        config.dispose();
    });
    test('wordWrap off does not use wordWrapColumn', () => {
        const config = new TestWrappingConfiguration({
            wordWrap: 'off',
            wordWrapColumn: 10
        });
        assertWrapping(config, false, -1);
        config.dispose();
    });
    test('wordWrap wordWrapColumn uses default wordWrapColumn', () => {
        const config = new TestWrappingConfiguration({
            wordWrap: 'wordWrapColumn'
        });
        assertWrapping(config, false, 80);
        config.dispose();
    });
    test('wordWrap wordWrapColumn uses wordWrapColumn', () => {
        const config = new TestWrappingConfiguration({
            wordWrap: 'wordWrapColumn',
            wordWrapColumn: 100
        });
        assertWrapping(config, false, 100);
        config.dispose();
    });
    test('wordWrap wordWrapColumn validates wordWrapColumn', () => {
        const config = new TestWrappingConfiguration({
            wordWrap: 'wordWrapColumn',
            wordWrapColumn: -1
        });
        assertWrapping(config, false, 1);
        config.dispose();
    });
    test('wordWrap bounded uses default wordWrapColumn', () => {
        const config = new TestWrappingConfiguration({
            wordWrap: 'bounded'
        });
        assertWrapping(config, true, 80);
        config.dispose();
    });
    test('wordWrap bounded uses wordWrapColumn', () => {
        const config = new TestWrappingConfiguration({
            wordWrap: 'bounded',
            wordWrapColumn: 40
        });
        assertWrapping(config, true, 40);
        config.dispose();
    });
    test('wordWrap bounded validates wordWrapColumn', () => {
        const config = new TestWrappingConfiguration({
            wordWrap: 'bounded',
            wordWrapColumn: -1
        });
        assertWrapping(config, true, 1);
        config.dispose();
    });
    test('issue #53152: Cannot assign to read only property \'enabled\' of object', () => {
        const hoverOptions = {};
        Object.defineProperty(hoverOptions, 'enabled', {
            writable: false,
            value: 'on'
        });
        const config = new TestConfiguration({ hover: hoverOptions });
        assert.strictEqual(config.options.get(69 /* EditorOption.hover */).enabled, 'on');
        config.updateOptions({ hover: { enabled: 'off' } });
        assert.strictEqual(config.options.get(69 /* EditorOption.hover */).enabled, 'off');
        config.dispose();
    });
    test('does not emit event when nothing changes', () => {
        const config = new TestConfiguration({ glyphMargin: true, roundedSelection: false });
        let event = null;
        const disposable = config.onDidChange(e => event = e);
        assert.strictEqual(config.options.get(66 /* EditorOption.glyphMargin */), true);
        config.updateOptions({ glyphMargin: true });
        config.updateOptions({ roundedSelection: false });
        assert.strictEqual(event, null);
        config.dispose();
        disposable.dispose();
    });
    test('issue #94931: Unable to open source file', () => {
        const config = new TestConfiguration({ quickSuggestions: null });
        const actual = config.options.get(102 /* EditorOption.quickSuggestions */);
        assert.deepStrictEqual(actual, {
            other: 'on',
            comments: 'off',
            strings: 'off'
        });
        config.dispose();
    });
    test('issue #102920: Can\'t snap or split view with JSON files', () => {
        const config = new TestConfiguration({ quickSuggestions: null });
        config.updateOptions({ quickSuggestions: { strings: true } });
        const actual = config.options.get(102 /* EditorOption.quickSuggestions */);
        assert.deepStrictEqual(actual, {
            other: 'on',
            comments: 'off',
            strings: 'on'
        });
        config.dispose();
    });
    test('issue #151926: Untyped editor options apply', () => {
        const config = new TestConfiguration({});
        config.updateOptions({ unicodeHighlight: { allowedCharacters: { 'x': true } } });
        const actual = config.options.get(142 /* EditorOption.unicodeHighlighting */);
        assert.deepStrictEqual(actual, {
            nonBasicASCII: 'inUntrustedWorkspace',
            invisibleCharacters: true,
            ambiguousCharacters: true,
            includeComments: 'inUntrustedWorkspace',
            includeStrings: 'inUntrustedWorkspace',
            allowedCharacters: { 'x': true },
            allowedLocales: { '_os': true, '_vscode': true }
        });
        config.dispose();
    });
});
suite('migrateOptions', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    function migrate(options) {
        migrateOptions(options);
        return options;
    }
    test('wordWrap', () => {
        assert.deepStrictEqual(migrate({ wordWrap: true }), { wordWrap: 'on' });
        assert.deepStrictEqual(migrate({ wordWrap: false }), { wordWrap: 'off' });
    });
    test('lineNumbers', () => {
        assert.deepStrictEqual(migrate({ lineNumbers: true }), { lineNumbers: 'on' });
        assert.deepStrictEqual(migrate({ lineNumbers: false }), { lineNumbers: 'off' });
    });
    test('autoClosingBrackets', () => {
        assert.deepStrictEqual(migrate({ autoClosingBrackets: false }), { autoClosingBrackets: 'never', autoClosingQuotes: 'never', autoSurround: 'never' });
    });
    test('cursorBlinking', () => {
        assert.deepStrictEqual(migrate({ cursorBlinking: 'visible' }), { cursorBlinking: 'solid' });
    });
    test('renderWhitespace', () => {
        assert.deepStrictEqual(migrate({ renderWhitespace: true }), { renderWhitespace: 'boundary' });
        assert.deepStrictEqual(migrate({ renderWhitespace: false }), { renderWhitespace: 'none' });
    });
    test('renderLineHighlight', () => {
        assert.deepStrictEqual(migrate({ renderLineHighlight: true }), { renderLineHighlight: 'line' });
        assert.deepStrictEqual(migrate({ renderLineHighlight: false }), { renderLineHighlight: 'none' });
    });
    test('acceptSuggestionOnEnter', () => {
        assert.deepStrictEqual(migrate({ acceptSuggestionOnEnter: true }), { acceptSuggestionOnEnter: 'on' });
        assert.deepStrictEqual(migrate({ acceptSuggestionOnEnter: false }), { acceptSuggestionOnEnter: 'off' });
    });
    test('tabCompletion', () => {
        assert.deepStrictEqual(migrate({ tabCompletion: true }), { tabCompletion: 'onlySnippets' });
        assert.deepStrictEqual(migrate({ tabCompletion: false }), { tabCompletion: 'off' });
    });
    test('suggest.filteredTypes', () => {
        assert.deepStrictEqual(migrate({
            suggest: {
                filteredTypes: {
                    method: false,
                    function: false,
                    constructor: false,
                    deprecated: false,
                    field: false,
                    variable: false,
                    class: false,
                    struct: false,
                    interface: false,
                    module: false,
                    property: false,
                    event: false,
                    operator: false,
                    unit: false,
                    value: false,
                    constant: false,
                    enum: false,
                    enumMember: false,
                    keyword: false,
                    text: false,
                    color: false,
                    file: false,
                    reference: false,
                    folder: false,
                    typeParameter: false,
                    snippet: false,
                }
            }
        }), {
            suggest: {
                filteredTypes: undefined,
                showMethods: false,
                showFunctions: false,
                showConstructors: false,
                showDeprecated: false,
                showFields: false,
                showVariables: false,
                showClasses: false,
                showStructs: false,
                showInterfaces: false,
                showModules: false,
                showProperties: false,
                showEvents: false,
                showOperators: false,
                showUnits: false,
                showValues: false,
                showConstants: false,
                showEnums: false,
                showEnumMembers: false,
                showKeywords: false,
                showWords: false,
                showColors: false,
                showFiles: false,
                showReferences: false,
                showFolders: false,
                showTypeParameters: false,
                showSnippets: false,
            }
        });
    });
    test('quickSuggestions', () => {
        assert.deepStrictEqual(migrate({ quickSuggestions: true }), { quickSuggestions: { comments: 'on', strings: 'on', other: 'on' } });
        assert.deepStrictEqual(migrate({ quickSuggestions: false }), { quickSuggestions: { comments: 'off', strings: 'off', other: 'off' } });
        assert.deepStrictEqual(migrate({ quickSuggestions: { comments: 'on', strings: 'off' } }), { quickSuggestions: { comments: 'on', strings: 'off' } });
    });
    test('hover', () => {
        assert.deepStrictEqual(migrate({ hover: true }), { hover: { enabled: 'on' } });
        assert.deepStrictEqual(migrate({ hover: false }), { hover: { enabled: 'off' } });
    });
    test('parameterHints', () => {
        assert.deepStrictEqual(migrate({ parameterHints: true }), { parameterHints: { enabled: true } });
        assert.deepStrictEqual(migrate({ parameterHints: false }), { parameterHints: { enabled: false } });
    });
    test('autoIndent', () => {
        assert.deepStrictEqual(migrate({ autoIndent: true }), { autoIndent: 'full' });
        assert.deepStrictEqual(migrate({ autoIndent: false }), { autoIndent: 'advanced' });
    });
    test('matchBrackets', () => {
        assert.deepStrictEqual(migrate({ matchBrackets: true }), { matchBrackets: 'always' });
        assert.deepStrictEqual(migrate({ matchBrackets: false }), { matchBrackets: 'never' });
    });
    test('renderIndentGuides, highlightActiveIndentGuide', () => {
        assert.deepStrictEqual(migrate({ renderIndentGuides: true }), { renderIndentGuides: undefined, guides: { indentation: true } });
        assert.deepStrictEqual(migrate({ renderIndentGuides: false }), { renderIndentGuides: undefined, guides: { indentation: false } });
        assert.deepStrictEqual(migrate({ highlightActiveIndentGuide: true }), { highlightActiveIndentGuide: undefined, guides: { highlightActiveIndentation: true } });
        assert.deepStrictEqual(migrate({ highlightActiveIndentGuide: false }), { highlightActiveIndentGuide: undefined, guides: { highlightActiveIndentation: false } });
    });
    test('migration does not overwrite new setting', () => {
        assert.deepStrictEqual(migrate({ renderIndentGuides: true, guides: { indentation: false } }), { renderIndentGuides: undefined, guides: { indentation: false } });
        assert.deepStrictEqual(migrate({ highlightActiveIndentGuide: true, guides: { highlightActiveIndentation: false } }), { highlightActiveIndentGuide: undefined, guides: { highlightActiveIndentation: false } });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yQ29uZmlndXJhdGlvbi50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci90ZXN0L2Jyb3dzZXIvY29uZmlnL2VkaXRvckNvbmZpZ3VyYXRpb24udGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFaEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBRTNFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUczRCxLQUFLLENBQUMsc0JBQXNCLEVBQUUsR0FBRyxFQUFFO0lBRWxDLHVDQUF1QyxFQUFFLENBQUM7SUFFMUMsSUFBSSxDQUFDLFlBQVksRUFBRSxHQUFHLEVBQUU7UUFFdkIsd0RBQXdEO1FBQ3hELE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQztRQUV4QixJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3JCLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRTNDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0QixNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUUzQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3JCLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRTNDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0QixNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTVDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDckIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFM0MsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFNUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUN0QixNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUU1QyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDdkIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUU1QyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRTdDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN4QixNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTVDLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDNUIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFNUMsSUFBSSxDQUFDLFlBQVksQ0FB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