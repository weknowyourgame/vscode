/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var EditorMarkdownCodeBlockRenderer_1;
import { isHTMLElement } from '../../../../../base/browser/dom.js';
import { createTrustedTypesPolicy } from '../../../../../base/browser/trustedTypes.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { createBareFontInfoFromRawSettings } from '../../../../common/config/fontInfoFromSettings.js';
import { ILanguageService } from '../../../../common/languages/language.js';
import { PLAINTEXT_LANGUAGE_ID } from '../../../../common/languages/modesRegistry.js';
import { tokenizeToString } from '../../../../common/languages/textToHtmlTokenizer.js';
import { applyFontInfo } from '../../../config/domFontInfo.js';
import { isCodeEditor } from '../../../editorBrowser.js';
import './renderedMarkdown.css';
/**
 * Renders markdown code blocks using the editor's tokenization and font settings.
 */
let EditorMarkdownCodeBlockRenderer = class EditorMarkdownCodeBlockRenderer {
    static { EditorMarkdownCodeBlockRenderer_1 = this; }
    static { this._ttpTokenizer = createTrustedTypesPolicy('tokenizeToString', {
        createHTML(html) {
            return html;
        }
    }); }
    constructor(_configurationService, _languageService) {
        this._configurationService = _configurationService;
        this._languageService = _languageService;
    }
    async renderCodeBlock(languageAlias, value, options) {
        const editor = isCodeEditor(options.context) ? options.context : undefined;
        // In markdown, it is possible that we stumble upon language aliases (e.g.js instead of javascript).
        // it is possible no alias is given in which case we fall back to the current editor lang
        let languageId;
        if (languageAlias) {
            languageId = this._languageService.getLanguageIdByLanguageName(languageAlias);
        }
        else if (editor) {
            languageId = editor.getModel()?.getLanguageId();
        }
        if (!languageId) {
            languageId = PLAINTEXT_LANGUAGE_ID;
        }
        const html = await tokenizeToString(this._languageService, value, languageId);
        const content = EditorMarkdownCodeBlockRenderer_1._ttpTokenizer ? EditorMarkdownCodeBlockRenderer_1._ttpTokenizer.createHTML(html) ?? html : html;
        const root = document.createElement('span');
        root.innerHTML = content;
        // eslint-disable-next-line no-restricted-syntax
        const codeElement = root.querySelector('.monaco-tokenized-source');
        if (!isHTMLElement(codeElement)) {
            return document.createElement('span');
        }
        applyFontInfo(codeElement, this.getFontInfo(editor));
        return root;
    }
    getFontInfo(editor) {
        // Use editor's font if we have one
        if (editor) {
            return editor.getOption(59 /* EditorOption.fontInfo */);
        }
        else {
            // Otherwise use the global font settings.
            // Pass in fake pixel ratio of 1 since we only need the font info to apply font family
            return createBareFontInfoFromRawSettings({
                fontFamily: this._configurationService.getValue('editor').fontFamily
            }, 1);
        }
    }
};
EditorMarkdownCodeBlockRenderer = EditorMarkdownCodeBlockRenderer_1 = __decorate([
    __param(0, IConfigurationService),
    __param(1, ILanguageService)
], EditorMarkdownCodeBlockRenderer);
export { EditorMarkdownCodeBlockRenderer };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yTWFya2Rvd25Db2RlQmxvY2tSZW5kZXJlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvbWFya2Rvd25SZW5kZXJlci9icm93c2VyL2VkaXRvck1hcmtkb3duQ29kZUJsb2NrUmVuZGVyZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN2RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUl0RyxPQUFPLEVBQUUsaUNBQWlDLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUN0RyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUM1RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUN0RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN2RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDL0QsT0FBTyxFQUFlLFlBQVksRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ3RFLE9BQU8sd0JBQXdCLENBQUM7QUFFaEM7O0dBRUc7QUFDSSxJQUFNLCtCQUErQixHQUFyQyxNQUFNLCtCQUErQjs7YUFFNUIsa0JBQWEsR0FBRyx3QkFBd0IsQ0FBQyxrQkFBa0IsRUFBRTtRQUMzRSxVQUFVLENBQUMsSUFBWTtZQUN0QixPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7S0FDRCxDQUFDLEFBSjBCLENBSXpCO0lBRUgsWUFDeUMscUJBQTRDLEVBQ2pELGdCQUFrQztRQUQ3QiwwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO1FBQ2pELHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBa0I7SUFDbEUsQ0FBQztJQUVFLEtBQUssQ0FBQyxlQUFlLENBQUMsYUFBaUMsRUFBRSxLQUFhLEVBQUUsT0FBc0M7UUFDcEgsTUFBTSxNQUFNLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBRTNFLG9HQUFvRztRQUNwRyx5RkFBeUY7UUFDekYsSUFBSSxVQUFxQyxDQUFDO1FBQzFDLElBQUksYUFBYSxFQUFFLENBQUM7WUFDbkIsVUFBVSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQywyQkFBMkIsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUMvRSxDQUFDO2FBQU0sSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUNuQixVQUFVLEdBQUcsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLGFBQWEsRUFBRSxDQUFDO1FBQ2pELENBQUM7UUFDRCxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDakIsVUFBVSxHQUFHLHFCQUFxQixDQUFDO1FBQ3BDLENBQUM7UUFDRCxNQUFNLElBQUksR0FBRyxNQUFNLGdCQUFnQixDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFFOUUsTUFBTSxPQUFPLEdBQUcsaUNBQStCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxpQ0FBK0IsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBRTlJLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDNUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFpQixDQUFDO1FBQ25DLGdEQUFnRDtRQUNoRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLDBCQUEwQixDQUFDLENBQUM7UUFDbkUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO1lBQ2pDLE9BQU8sUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN2QyxDQUFDO1FBRUQsYUFBYSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFFckQsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRU8sV0FBVyxDQUFDLE1BQStCO1FBQ2xELG1DQUFtQztRQUNuQyxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1osT0FBTyxNQUFNLENBQUMsU0FBUyxnQ0FBdUIsQ0FBQztRQUNoRCxDQUFDO2FBQU0sQ0FBQztZQUNQLDBDQUEwQztZQUMxQyxzRkFBc0Y7WUFDdEYsT0FBTyxpQ0FBaUMsQ0FBQztnQkFDeEMsVUFBVSxFQUFFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQWlCLFFBQVEsQ0FBQyxDQUFDLFVBQVU7YUFDcEYsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUM7SUFDRixDQUFDOztBQXZEVywrQkFBK0I7SUFTekMsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLGdCQUFnQixDQUFBO0dBVk4sK0JBQStCLENBd0QzQyJ9