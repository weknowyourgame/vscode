/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class EditorSettingMigration {
    static { this.items = []; }
    constructor(key, migrate) {
        this.key = key;
        this.migrate = migrate;
    }
    apply(options) {
        const value = EditorSettingMigration._read(options, this.key);
        const read = (key) => EditorSettingMigration._read(options, key);
        const write = (key, value) => EditorSettingMigration._write(options, key, value);
        this.migrate(value, read, write);
    }
    static _read(source, key) {
        if (typeof source === 'undefined' || source === null) {
            return undefined;
        }
        const firstDotIndex = key.indexOf('.');
        if (firstDotIndex >= 0) {
            const firstSegment = key.substring(0, firstDotIndex);
            return this._read(source[firstSegment], key.substring(firstDotIndex + 1));
        }
        return source[key];
    }
    static _write(target, key, value) {
        const firstDotIndex = key.indexOf('.');
        if (firstDotIndex >= 0) {
            const firstSegment = key.substring(0, firstDotIndex);
            target[firstSegment] = target[firstSegment] || {};
            this._write(target[firstSegment], key.substring(firstDotIndex + 1), value);
            return;
        }
        target[key] = value;
    }
}
function registerEditorSettingMigration(key, migrate) {
    EditorSettingMigration.items.push(new EditorSettingMigration(key, migrate));
}
function registerSimpleEditorSettingMigration(key, values) {
    registerEditorSettingMigration(key, (value, read, write) => {
        if (typeof value !== 'undefined') {
            for (const [oldValue, newValue] of values) {
                if (value === oldValue) {
                    write(key, newValue);
                    return;
                }
            }
        }
    });
}
/**
 * Compatibility with old options
 */
export function migrateOptions(options) {
    EditorSettingMigration.items.forEach(migration => migration.apply(options));
}
registerSimpleEditorSettingMigration('wordWrap', [[true, 'on'], [false, 'off']]);
registerSimpleEditorSettingMigration('lineNumbers', [[true, 'on'], [false, 'off']]);
registerSimpleEditorSettingMigration('cursorBlinking', [['visible', 'solid']]);
registerSimpleEditorSettingMigration('renderWhitespace', [[true, 'boundary'], [false, 'none']]);
registerSimpleEditorSettingMigration('renderLineHighlight', [[true, 'line'], [false, 'none']]);
registerSimpleEditorSettingMigration('acceptSuggestionOnEnter', [[true, 'on'], [false, 'off']]);
registerSimpleEditorSettingMigration('tabCompletion', [[false, 'off'], [true, 'onlySnippets']]);
registerSimpleEditorSettingMigration('hover', [[true, { enabled: true }], [false, { enabled: false }]]);
registerSimpleEditorSettingMigration('parameterHints', [[true, { enabled: true }], [false, { enabled: false }]]);
registerSimpleEditorSettingMigration('autoIndent', [[false, 'advanced'], [true, 'full']]);
registerSimpleEditorSettingMigration('matchBrackets', [[true, 'always'], [false, 'never']]);
registerSimpleEditorSettingMigration('renderFinalNewline', [[true, 'on'], [false, 'off']]);
registerSimpleEditorSettingMigration('cursorSmoothCaretAnimation', [[true, 'on'], [false, 'off']]);
registerSimpleEditorSettingMigration('occurrencesHighlight', [[true, 'singleFile'], [false, 'off']]);
registerSimpleEditorSettingMigration('wordBasedSuggestions', [[true, 'matchingDocuments'], [false, 'off']]);
registerSimpleEditorSettingMigration('defaultColorDecorators', [[true, 'auto'], [false, 'never']]);
registerSimpleEditorSettingMigration('minimap.autohide', [[true, 'mouseover'], [false, 'none']]);
registerEditorSettingMigration('autoClosingBrackets', (value, read, write) => {
    if (value === false) {
        write('autoClosingBrackets', 'never');
        if (typeof read('autoClosingQuotes') === 'undefined') {
            write('autoClosingQuotes', 'never');
        }
        if (typeof read('autoSurround') === 'undefined') {
            write('autoSurround', 'never');
        }
    }
});
registerEditorSettingMigration('renderIndentGuides', (value, read, write) => {
    if (typeof value !== 'undefined') {
        write('renderIndentGuides', undefined);
        if (typeof read('guides.indentation') === 'undefined') {
            write('guides.indentation', !!value);
        }
    }
});
registerEditorSettingMigration('highlightActiveIndentGuide', (value, read, write) => {
    if (typeof value !== 'undefined') {
        write('highlightActiveIndentGuide', undefined);
        if (typeof read('guides.highlightActiveIndentation') === 'undefined') {
            write('guides.highlightActiveIndentation', !!value);
        }
    }
});
const suggestFilteredTypesMapping = {
    method: 'showMethods',
    function: 'showFunctions',
    constructor: 'showConstructors',
    deprecated: 'showDeprecated',
    field: 'showFields',
    variable: 'showVariables',
    class: 'showClasses',
    struct: 'showStructs',
    interface: 'showInterfaces',
    module: 'showModules',
    property: 'showProperties',
    event: 'showEvents',
    operator: 'showOperators',
    unit: 'showUnits',
    value: 'showValues',
    constant: 'showConstants',
    enum: 'showEnums',
    enumMember: 'showEnumMembers',
    keyword: 'showKeywords',
    text: 'showWords',
    color: 'showColors',
    file: 'showFiles',
    reference: 'showReferences',
    folder: 'showFolders',
    typeParameter: 'showTypeParameters',
    snippet: 'showSnippets',
};
registerEditorSettingMigration('suggest.filteredTypes', (value, read, write) => {
    if (value && typeof value === 'object') {
        for (const entry of Object.entries(suggestFilteredTypesMapping)) {
            const v = value[entry[0]];
            if (v === false) {
                if (typeof read(`suggest.${entry[1]}`) === 'undefined') {
                    write(`suggest.${entry[1]}`, false);
                }
            }
        }
        write('suggest.filteredTypes', undefined);
    }
});
registerEditorSettingMigration('quickSuggestions', (input, read, write) => {
    if (typeof input === 'boolean') {
        const value = input ? 'on' : 'off';
        const newValue = { comments: value, strings: value, other: value };
        write('quickSuggestions', newValue);
    }
});
// Sticky Scroll
registerEditorSettingMigration('experimental.stickyScroll.enabled', (value, read, write) => {
    if (typeof value === 'boolean') {
        write('experimental.stickyScroll.enabled', undefined);
        if (typeof read('stickyScroll.enabled') === 'undefined') {
            write('stickyScroll.enabled', value);
        }
    }
});
registerEditorSettingMigration('experimental.stickyScroll.maxLineCount', (value, read, write) => {
    if (typeof value === 'number') {
        write('experimental.stickyScroll.maxLineCount', undefined);
        if (typeof read('stickyScroll.maxLineCount') === 'undefined') {
            write('stickyScroll.maxLineCount', value);
        }
    }
});
// Edit Context
registerEditorSettingMigration('editor.experimentalEditContextEnabled', (value, read, write) => {
    if (typeof value === 'boolean') {
        write('editor.experimentalEditContextEnabled', undefined);
        if (typeof read('editor.editContext') === 'undefined') {
            write('editor.editContext', value);
        }
    }
});
// Code Actions on Save
registerEditorSettingMigration('codeActionsOnSave', (value, read, write) => {
    if (value && typeof value === 'object') {
        let toBeModified = false;
        const newValue = {};
        for (const entry of Object.entries(value)) {
            if (typeof entry[1] === 'boolean') {
                toBeModified = true;
                newValue[entry[0]] = entry[1] ? 'explicit' : 'never';
            }
            else {
                newValue[entry[0]] = entry[1];
            }
        }
        if (toBeModified) {
            write(`codeActionsOnSave`, newValue);
        }
    }
});
// Migrate Quick Fix Settings
registerEditorSettingMigration('codeActionWidget.includeNearbyQuickfixes', (value, read, write) => {
    if (typeof value === 'boolean') {
        write('codeActionWidget.includeNearbyQuickfixes', undefined);
        if (typeof read('codeActionWidget.includeNearbyQuickFixes') === 'undefined') {
            write('codeActionWidget.includeNearbyQuickFixes', value);
        }
    }
});
// Migrate the lightbulb settings
registerEditorSettingMigration('lightbulb.enabled', (value, read, write) => {
    if (typeof value === 'boolean') {
        write('lightbulb.enabled', value ? undefined : 'off');
    }
});
// NES Code Shifting
registerEditorSettingMigration('inlineSuggest.edits.codeShifting', (value, read, write) => {
    if (typeof value === 'boolean') {
        write('inlineSuggest.edits.codeShifting', undefined);
        write('inlineSuggest.edits.allowCodeShifting', value ? 'always' : 'never');
    }
});
// Migrate Hover
registerEditorSettingMigration('hover.enabled', (value, read, write) => {
    if (typeof value === 'boolean') {
        write('hover.enabled', value ? 'on' : 'off');
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlncmF0ZU9wdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvY29uZmlnL21pZ3JhdGVPcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBWWhHLE1BQU0sT0FBTyxzQkFBc0I7YUFFcEIsVUFBSyxHQUE2QixFQUFFLENBQUM7SUFFbkQsWUFDaUIsR0FBVyxFQUNYLE9BQWdGO1FBRGhGLFFBQUcsR0FBSCxHQUFHLENBQVE7UUFDWCxZQUFPLEdBQVAsT0FBTyxDQUF5RTtJQUM3RixDQUFDO0lBRUwsS0FBSyxDQUFDLE9BQWdCO1FBQ3JCLE1BQU0sS0FBSyxHQUFHLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzlELE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBVyxFQUFFLEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3pFLE1BQU0sS0FBSyxHQUFHLENBQUMsR0FBVyxFQUFFLEtBQWMsRUFBRSxFQUFFLENBQUMsc0JBQXNCLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDbEcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFFTyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQWUsRUFBRSxHQUFXO1FBQ2hELElBQUksT0FBTyxNQUFNLEtBQUssV0FBVyxJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUN0RCxPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsTUFBTSxhQUFhLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN2QyxJQUFJLGFB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