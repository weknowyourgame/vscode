/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EditorOptions } from './common/config/editorOptions.js';
import { createMonacoBaseAPI } from './common/services/editorBaseApi.js';
import { createMonacoEditorAPI } from './standalone/browser/standaloneEditor.js';
import { createMonacoLanguagesAPI } from './standalone/browser/standaloneLanguages.js';
import { FormattingConflicts } from './contrib/format/browser/format.js';
import { getMonacoEnvironment } from '../base/browser/browser.js';
// Set defaults for standalone editor
EditorOptions.wrappingIndent.defaultValue = 0 /* WrappingIndent.None */;
EditorOptions.glyphMargin.defaultValue = false;
EditorOptions.autoIndent.defaultValue = 3 /* EditorAutoIndentStrategy.Advanced */;
EditorOptions.overviewRulerLanes.defaultValue = 2;
// We need to register a formatter selector which simply picks the first available formatter.
// See https://github.com/microsoft/monaco-editor/issues/2327
FormattingConflicts.setFormatterSelector((formatter, document, mode) => Promise.resolve(formatter[0]));
const api = createMonacoBaseAPI();
api.editor = createMonacoEditorAPI();
api.languages = createMonacoLanguagesAPI();
export const CancellationTokenSource = api.CancellationTokenSource;
export const Emitter = api.Emitter;
export const KeyCode = api.KeyCode;
export const KeyMod = api.KeyMod;
export const Position = api.Position;
export const Range = api.Range;
export const Selection = api.Selection;
export const SelectionDirection = api.SelectionDirection;
export const MarkerSeverity = api.MarkerSeverity;
export const MarkerTag = api.MarkerTag;
export const Uri = api.Uri;
export const Token = api.Token;
export const editor = api.editor;
export const languages = api.languages;
const monacoEnvironment = getMonacoEnvironment();
const globalWithAMD = globalThis;
if (monacoEnvironment?.globalAPI || (typeof globalWithAMD.define === 'function' && globalWithAMD.define.amd)) {
    globalWithAMD.monaco = api;
}
if (typeof globalWithAMD.require !== 'undefined' && typeof globalWithAMD.require.config === 'function') {
    globalWithAMD.require.config({
        ignoreDuplicateModules: [
            'vscode-languageserver-types',
            'vscode-languageserver-types/main',
            'vscode-languageserver-textdocument',
            'vscode-languageserver-textdocument/main',
            'vscode-nls',
            'vscode-nls/vscode-nls',
            'jsonc-parser',
            'jsonc-parser/main',
            'vscode-uri',
            'vscode-uri/index',
            'vs/basic-languages/typescript/typescript'
        ]
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yLmFwaS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvZWRpdG9yLmFwaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsYUFBYSxFQUE0QyxNQUFNLGtDQUFrQyxDQUFDO0FBQzNHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBRWxFLHFDQUFxQztBQUNyQyxhQUFhLENBQUMsY0FBYyxDQUFDLFlBQVksOEJBQXNCLENBQUM7QUFDaEUsYUFBYSxDQUFDLFdBQVcsQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDO0FBQy9DLGFBQWEsQ0FBQyxVQUFVLENBQUMsWUFBWSw0Q0FBb0MsQ0FBQztBQUMxRSxhQUFhLENBQUMsa0JBQWtCLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQztBQUVsRCw2RkFBNkY7QUFDN0YsNkRBQTZEO0FBQzdELG1CQUFtQixDQUFDLG9CQUFvQixDQUFDLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUV2RyxNQUFNLEdBQUcsR0FBRyxtQkFBbUIsRUFBRSxDQUFDO0FBQ2xDLEdBQUcsQ0FBQyxNQUFNLEdBQUcscUJBQXFCLEVBQUUsQ0FBQztBQUNyQyxHQUFHLENBQUMsU0FBUyxHQUFHLHdCQUF3QixFQUFFLENBQUM7QUFDM0MsTUFBTSxDQUFDLE1BQU0sdUJBQXVCLEdBQUcsR0FBRyxDQUFDLHVCQUF1QixDQUFDO0FBQ25FLE1BQU0sQ0FBQyxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDO0FBQ25DLE1BQU0sQ0FBQyxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDO0FBQ25DLE1BQU0sQ0FBQyxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO0FBQ2pDLE1BQU0sQ0FBQyxNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDO0FBQ3JDLE1BQU0sQ0FBQyxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDO0FBQy9CLE1BQU0sQ0FBQyxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDO0FBQ3ZDLE1BQU0sQ0FBQyxNQUFNLGtCQUFrQixHQUFHLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQztBQUN6RCxNQUFNLENBQUMsTUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDLGNBQWMsQ0FBQztBQUNqRCxNQUFNLENBQUMsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQztBQUN2QyxNQUFNLENBQUMsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQztBQUMzQixNQUFNLENBQUMsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQztBQUMvQixNQUFNLENBQUMsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQztBQUNqQyxNQUFNLENBQUMsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQztBQVl2QyxNQUFNLGlCQUFpQixHQUFHLG9CQUFvQixFQUFFLENBQUM7QUFDakQsTUFBTSxhQUFhLEdBQUcsVUFBMkIsQ0FBQztBQUNsRCxJQUFJLGlCQUFpQixFQUFFLFNBQVMsSUFBSSxDQUFDLE9BQU8sYUFBYSxDQUFDLE1BQU0sS0FBSyxVQUFVLElBQUksYUFBYSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO0lBQzlHLGFBQWEsQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDO0FBQzVCLENBQUM7QUFFRCxJQUFJLE9BQU8sYUFBYSxDQUFDLE9BQU8sS0FBSyxXQUFXLElBQUksT0FBTyxhQUFhLENBQUMsT0FBTyxDQUFDLE1BQU0sS0FBSyxVQUFVLEVBQUUsQ0FBQztJQUN4RyxhQUFhLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztRQUM1QixzQkFBc0IsRUFBRTtZQUN2Qiw2QkFBNkI7WUFDN0Isa0NBQWtDO1lBQ2xDLG9DQUFvQztZQUNwQyx5Q0FBeUM7WUFDekMsWUFBWTtZQUNaLHVCQUF1QjtZQUN2QixjQUFjO1lBQ2QsbUJBQW1CO1lBQ25CLFlBQVk7WUFDWixrQkFBa0I7WUFDbEIsMENBQTBDO1NBQzFDO0tBQ0QsQ0FBQyxDQUFDO0FBQ0osQ0FBQyJ9