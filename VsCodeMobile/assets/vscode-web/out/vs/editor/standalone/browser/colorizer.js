/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createTrustedTypesPolicy } from '../../../base/browser/trustedTypes.js';
import * as strings from '../../../base/common/strings.js';
import { TokenizationRegistry } from '../../common/languages.js';
import { LineTokens } from '../../common/tokens/lineTokens.js';
import { RenderLineInput, renderViewLine2 as renderViewLine } from '../../common/viewLayout/viewLineRenderer.js';
import { ViewLineRenderingData } from '../../common/viewModel.js';
import { MonarchTokenizer } from '../common/monarch/monarchLexer.js';
const ttPolicy = createTrustedTypesPolicy('standaloneColorizer', { createHTML: value => value });
export class Colorizer {
    static colorizeElement(themeService, languageService, domNode, options) {
        options = options || {};
        const theme = options.theme || 'vs';
        const mimeType = options.mimeType || domNode.getAttribute('lang') || domNode.getAttribute('data-lang');
        if (!mimeType) {
            console.error('Mode not detected');
            return Promise.resolve();
        }
        const languageId = languageService.getLanguageIdByMimeType(mimeType) || mimeType;
        themeService.setTheme(theme);
        const text = domNode.firstChild ? domNode.firstChild.nodeValue : '';
        domNode.className += ' ' + theme;
        const render = (str) => {
            const trustedhtml = ttPolicy?.createHTML(str) ?? str;
            domNode.innerHTML = trustedhtml;
        };
        return this.colorize(languageService, text || '', languageId, options).then(render, (err) => console.error(err));
    }
    static async colorize(languageService, text, languageId, options) {
        const languageIdCodec = languageService.languageIdCodec;
        let tabSize = 4;
        if (options && typeof options.tabSize === 'number') {
            tabSize = options.tabSize;
        }
        if (strings.startsWithUTF8BOM(text)) {
            text = text.substr(1);
        }
        const lines = strings.splitLines(text);
        if (!languageService.isRegisteredLanguageId(languageId)) {
            return _fakeColorize(lines, tabSize, languageIdCodec);
        }
        const tokenizationSupport = await TokenizationRegistry.getOrCreate(languageId);
        if (tokenizationSupport) {
            return _colorize(lines, tabSize, tokenizationSupport, languageIdCodec);
        }
        return _fakeColorize(lines, tabSize, languageIdCodec);
    }
    static colorizeLine(line, mightContainNonBasicASCII, mightContainRTL, tokens, tabSize = 4) {
        const isBasicASCII = ViewLineRenderingData.isBasicASCII(line, mightContainNonBasicASCII);
        const containsRTL = ViewLineRenderingData.containsRTL(line, isBasicASCII, mightContainRTL);
        const renderResult = renderViewLine(new RenderLineInput(false, true, line, false, isBasicASCII, containsRTL, 0, tokens, [], tabSize, 0, 0, 0, 0, -1, 'none', false, false, null, null, 0));
        return renderResult.html;
    }
    static colorizeModelLine(model, lineNumber, tabSize = 4) {
        const content = model.getLineContent(lineNumber);
        model.tokenization.forceTokenization(lineNumber);
        const tokens = model.tokenization.getLineTokens(lineNumber);
        const inflatedTokens = tokens.inflate();
        return this.colorizeLine(content, model.mightContainNonBasicASCII(), model.mightContainRTL(), inflatedTokens, tabSize);
    }
}
function _colorize(lines, tabSize, tokenizationSupport, languageIdCodec) {
    return new Promise((c, e) => {
        const execute = () => {
            const result = _actualColorize(lines, tabSize, tokenizationSupport, languageIdCodec);
            if (tokenizationSupport instanceof MonarchTokenizer) {
                const status = tokenizationSupport.getLoadStatus();
                if (status.loaded === false) {
                    status.promise.then(execute, e);
                    return;
                }
            }
            c(result);
        };
        execute();
    });
}
function _fakeColorize(lines, tabSize, languageIdCodec) {
    let html = [];
    const defaultMetadata = ((0 /* FontStyle.None */ << 11 /* MetadataConsts.FONT_STYLE_OFFSET */)
        | (1 /* ColorId.DefaultForeground */ << 15 /* MetadataConsts.FOREGROUND_OFFSET */)
        | (2 /* ColorId.DefaultBackground */ << 24 /* MetadataConsts.BACKGROUND_OFFSET */)) >>> 0;
    const tokens = new Uint32Array(2);
    tokens[0] = 0;
    tokens[1] = defaultMetadata;
    for (let i = 0, length = lines.length; i < length; i++) {
        const line = lines[i];
        tokens[0] = line.length;
        const lineTokens = new LineTokens(tokens, line, languageIdCodec);
        const isBasicASCII = ViewLineRenderingData.isBasicASCII(line, /* check for basic ASCII */ true);
        const containsRTL = ViewLineRenderingData.containsRTL(line, isBasicASCII, /* check for RTL */ true);
        const renderResult = renderViewLine(new RenderLineInput(false, true, line, false, isBasicASCII, containsRTL, 0, lineTokens, [], tabSize, 0, 0, 0, 0, -1, 'none', false, false, null, null, 0));
        html = html.concat(renderResult.html);
        html.push('<br/>');
    }
    return html.join('');
}
function _actualColorize(lines, tabSize, tokenizationSupport, languageIdCodec) {
    let html = [];
    let state = tokenizationSupport.getInitialState();
    for (let i = 0, length = lines.length; i < length; i++) {
        const line = lines[i];
        const tokenizeResult = tokenizationSupport.tokenizeEncoded(line, true, state);
        LineTokens.convertToEndOffset(tokenizeResult.tokens, line.length);
        const lineTokens = new LineTokens(tokenizeResult.tokens, line, languageIdCodec);
        const isBasicASCII = ViewLineRenderingData.isBasicASCII(line, /* check for basic ASCII */ true);
        const containsRTL = ViewLineRenderingData.containsRTL(line, isBasicASCII, /* check for RTL */ true);
        const renderResult = renderViewLine(new RenderLineInput(false, true, line, false, isBasicASCII, containsRTL, 0, lineTokens.inflate(), [], tabSize, 0, 0, 0, 0, -1, 'none', false, false, null, null, 0));
        html = html.concat(renderResult.html);
        html.push('<br/>');
        state = tokenizeResult.endState;
    }
    return html.join('');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29sb3JpemVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9zdGFuZGFsb25lL2Jyb3dzZXIvY29sb3JpemVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2pGLE9BQU8sS0FBSyxPQUFPLE1BQU0saUNBQWlDLENBQUM7QUFFM0QsT0FBTyxFQUEwQyxvQkFBb0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBR3pHLE9BQU8sRUFBbUIsVUFBVSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEYsT0FBTyxFQUFFLGVBQWUsRUFBRSxlQUFlLElBQUksY0FBYyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDakgsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDbEUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFHckUsTUFBTSxRQUFRLEdBQUcsd0JBQXdCLENBQUMscUJBQXFCLEVBQUUsRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBV2pHLE1BQU0sT0FBTyxTQUFTO0lBRWQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxZQUFxQyxFQUFFLGVBQWlDLEVBQUUsT0FBb0IsRUFBRSxPQUFpQztRQUM5SixPQUFPLEdBQUcsT0FBTyxJQUFJLEVBQUUsQ0FBQztRQUN4QixNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQztRQUNwQyxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxJQUFJLE9BQU8sQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLElBQUksT0FBTyxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN2RyxJQUFJLENBQUMs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