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
var InspectEditorTokensController_1;
import './inspectEditorTokens.css';
import * as nls from '../../../../../nls.js';
import * as dom from '../../../../../base/browser/dom.js';
import { Color } from '../../../../../base/common/color.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { EditorAction, registerEditorAction, registerEditorContribution } from '../../../../../editor/browser/editorExtensions.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { TokenMetadata } from '../../../../../editor/common/encodedTokenAttributes.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { findMatchingThemeRule } from '../../../../services/textMate/common/TMHelper.js';
import { ITextMateTokenizationService } from '../../../../services/textMate/browser/textMateTokenizationFeature.js';
import { IWorkbenchThemeService } from '../../../../services/themes/common/workbenchThemeService.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { SemanticTokenRule } from '../../../../../platform/theme/common/tokenClassificationRegistry.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { SEMANTIC_HIGHLIGHTING_SETTING_ID } from '../../../../../editor/contrib/semanticTokens/common/semanticTokensConfig.js';
import { Schemas } from '../../../../../base/common/network.js';
import { ILanguageFeaturesService } from '../../../../../editor/common/services/languageFeatures.js';
import { TreeSitterSyntaxTokenBackend } from '../../../../../editor/common/model/tokens/treeSitter/treeSitterSyntaxTokenBackend.js';
const $ = dom.$;
let InspectEditorTokensController = class InspectEditorTokensController extends Disposable {
    static { InspectEditorTokensController_1 = this; }
    static { this.ID = 'editor.contrib.inspectEditorTokens'; }
    static get(editor) {
        return editor.getContribution(InspectEditorTokensController_1.ID);
    }
    constructor(editor, textMateService, languageService, themeService, notificationService, configurationService, languageFeaturesService) {
        super();
        this._editor = editor;
        this._textMateService = textMateService;
        this._themeService = themeService;
        this._languageService = languageService;
        this._notificationService = notificationService;
        this._configurationService = configurationService;
        this._languageFeaturesService = languageFeaturesService;
        this._widget = null;
        this._register(this._editor.onDidChangeModel((e) => this.stop()));
        this._register(this._editor.onDidChangeModelLanguage((e) => this.stop()));
        this._register(this._editor.onKeyUp((e) => e.keyCode === 9 /* KeyCode.Escape */ && this.stop()));
    }
    dispose() {
        this.stop();
        super.dispose();
    }
    launch() {
        if (this._widget) {
            return;
        }
        if (!this._editor.hasModel()) {
            return;
        }
        if (this._editor.getModel().uri.scheme === Schemas.vscodeNotebookCell) {
            // disable in notebooks
            return;
        }
        this._widget = new InspectEditorTokensWidget(this._editor, this._textMateService, this._languageService, this._themeService, this._notificationService, this._configurationService, this._languageFeaturesService);
    }
    stop() {
        if (this._widget) {
            this._widget.dispose();
            this._widget = null;
        }
    }
    toggle() {
        if (!this._widget) {
            this.launch();
        }
        else {
            this.stop();
        }
    }
};
InspectEditorTokensController = InspectEditorTokensController_1 = __decorate([
    __param(1, ITextMateTokenizationService),
    __param(2, ILanguageService),
    __param(3, IWorkbenchThemeService),
    __param(4, INotificationService),
    __param(5, IConfigurationService),
    __param(6, ILanguageFeaturesService)
], InspectEditorTokensController);
export { InspectEditorTokensController };
class InspectEditorTokens extends EditorAction {
    constructor() {
        super({
            id: 'editor.action.inspectTMScopes',
            label: nls.localize2('inspectEditorTokens', "Developer: Inspect Editor Tokens and Scopes"),
            precondition: undefined
        });
    }
    run(accessor, editor) {
        const controller = InspectEditorTokensController.get(editor);
        controller?.toggle();
    }
}
function renderTokenText(tokenText) {
    if (tokenText.length > 40) {
        tokenText = tokenText.substr(0, 20) + '…' + tokenText.substr(tokenText.length - 20);
    }
    let result = '';
    for (let charIndex = 0, len = tokenText.length; charIndex < len; charIndex++) {
        const charCode = tokenText.charCodeAt(charIndex);
        switch (charCode) {
            case 9 /* CharCode.Tab */:
                result += '\u2192'; // &rarr;
                break;
            case 32 /* CharCode.Space */:
                result += '\u00B7'; // &middot;
                break;
            default:
                result += String.fromCharCode(charCode);
        }
    }
    return result;
}
class InspectEditorTokensWidget extends Disposable {
    static { this._ID = 'editor.contrib.inspectEditorTokensWidget'; }
    constructor(editor, textMateService, languageService, themeService, notificationService, configurationService, languageFeaturesService) {
        super();
        // Editor.IContentWidget.allowEditorOverflow
        this.allowEditorOverflow = true;
        this._isDisposed = false;
        this._editor = editor;
        this._languageService = languageService;
        this._themeService = themeService;
        this._textMateService = textMateService;
        this._notificationService = notificationService;
        this._configurationService = configurationService;
        this._languageFeaturesService = languageFeaturesService;
        this._model = this._editor.getModel();
        this._domNode = document.createElement('div');
        this._domNode.className = 'token-inspect-widget';
        this._currentRequestCancellationTokenSource = new CancellationTokenSource();
        this._beginCompute(this._editor.getPosition());
        this._register(this._editor.onDidChangeCursorPosition((e) => this._beginCompute(this._editor.getPosition())));
        this._register(themeService.onDidColorThemeChange(_ => this._beginCompute(this._editor.getPosition())));
        this._register(configurationService.onDidChangeConfiguration(e => e.affectsConfiguration('editor.semanticHighlighting.enabled') && this._beginCompute(this._editor.getPosition())));
        this._editor.addContentWidget(this);
    }
    dispose() {
        this._isDisposed = true;
        this._editor.removeContentWidget(this);
        this._currentRequestCancellationTokenSource.cancel();
        super.dispose();
    }
    getId() {
        return InspectEditorTokensWidget._ID;
    }
    _beginCompute(position) {
        const grammar = this._textMateService.createTokenizer(this._model.getLanguageId());
        const semanticTokens = this._computeSemanticTokens(position);
        const backend = this._model.tokenization.tokens.get();
        const asTreeSitterBackend = backend instanceof TreeSitterSyntaxTokenBackend ? backend : undefined;
        dom.clearNode(this._domNode);
        this._domNode.appendChild(document.createTextNode(nls.localize('inspectTMScopesWidget.loading', "Loading...")));
        Promise.all([grammar, semanticTokens]).then(([grammar, semanticTokens]) => {
            if (this._isDisposed) {
                return;
            }
            const treeSitterTree = asTreeSitterBackend?.tree.get();
            this._compute(grammar, semanticTokens, treeSitterTree, position);
            this._domNode.style.maxWidth = `${Math.max(this._editor.getLayoutInfo().width * 0.66, 500)}px`;
            this._editor.layoutContentWidget(this);
        }, (err) => {
            this._notificationService.warn(err);
            setTimeout(() => {
                InspectEditorTokensController.get(this._editor)?.stop();
            });
        });
    }
    _isSemanticColoringEnabled() {
        const setting = this._configurationService.getValue(SEMANTIC_HIGHLIGHTING_SETTING_ID, { overrideIdentifier: this._model.getLanguageId(), resource: this._model.uri })?.enabled;
        if (typeof setting === 'boolean') {
            return setting;
        }
        return this._themeService.getColorTheme().semanticHighlighting;
    }
    _compute(grammar, semanticTokens, tree, position) {
        const textMateTokenInfo = grammar && this._getTokensAtPosition(grammar, position);
        const semanticTokenInfo = semanticTokens && this._getSemanticTokenAtPosition(semanticTokens, position);
        const treeSitterTokenInfo = tree && this._getTreeSitterTokenAtPosition(tree, position);
        if (!textMateTokenInfo && !semanticTokenInfo && !treeSitterTokenInfo) {
            dom.reset(this._domNode, 'No grammar or semantic tokens available.');
            return;
        }
        const tmMetadata = textMateTokenInfo?.metadata;
        const semMetadata = semanticTokenInfo?.metadata;
        const semTokenText = semanticTokenInfo && renderTokenText(this._model.getValueInRange(semanticTokenInfo.range));
        const tmTokenText = textMateTokenInfo && renderTokenText(this._model.getLineContent(position.lineNumber).substring(textMateTokenInfo.token.startIndex, textMateTokenInfo.token.endIndex));
        const semTokenLength = semanticTokenInfo && this._model.getValueLengthInRange(semanticTokenInfo.range);
        const tmTokenLength = textMateTokenInfo && (textMateTokenInfo.token.endIndex - textMateTokenInfo.token.startIndex);
        const tokenText = semTokenText || tmTokenText || '';
        const tokenLength = semTokenLength || tmTokenLength || 0;
        dom.reset(this._domNode, $('h2.tiw-token', undefined, tokenText, $('span.tiw-token-length', undefined, `${tokenLength} ${tokenLength === 1 ? 'char' : 'chars'}`)));
        dom.append(this._domNode, $('hr.tiw-metadata-separator', { 'style': 'clear:both' }));
        dom.append(this._domNode, $('table.tiw-metadata-table', undefined, $('tbody', undefined, $('tr', undefined, $('td.tiw-metadata-key', undefined, 'language'), $('td.tiw-metadata-value', undefined, tmMetadata?.languageId || '')), $('tr', undefined, $('td.tiw-metadata-key', undefined, 'standard token type'), $('td.tiw-metadata-value', undefined, this._tokenTypeToString(tmMetadata?.tokenType || 0 /* StandardTokenType.Other */))), ...this._formatMetadata(semMetadata, tmMetadata))));
        if (semanticTokenInfo) {
            dom.append(this._domNode, $('hr.tiw-metadata-separator'));
            const table = dom.append(this._domNode, $('table.tiw-metadata-table', undefined));
            const tbody = dom.append(table, $('tbody', undefined, $('tr', undefined, $('td.tiw-metadata-key', undefined, 'semantic token type'), $('td.tiw-metadata-value', undefined, semanticTokenInfo.type))));
            if (semanticTokenInfo.modifiers.length) {
                dom.append(tbody, $('tr', undefined, $('td.tiw-metadata-key', undefined, 'modifiers'), $('td.tiw-metadata-value', undefined, semanticTokenInfo.modifiers.join(' '))));
            }
            if (semanticTokenInfo.metadata) {
                const properties = ['foreground', 'bold', 'italic', 'underline', 'strikethrough'];
                const propertiesByDefValue = {};
                const allDefValues = new Array(); // remember the order
                // first collect to detect when the same rule is used for multiple properties
                for (const property of properties) {
                    if (semanticTokenInfo.metadata[property] !== undefined) {
                        const definition = semanticTokenInfo.definitions[property];
                        const defValue = this._renderTokenStyleDefinition(definition, property);
                        const defValueStr = defValue.map(el => dom.isHTMLElement(el) ? el.outerHTML : el).join();
                        let properties = propertiesByDefValue[defValueStr];
                        if (!properties) {
                            propertiesByDefValue[defValueStr] = properties = [];
                            allDefValues.push([defValue, defValueStr]);
                        }
                        properties.push(property);
                    }
                }
                for (const [defValue, defValueStr] of allDefValues) {
                    dom.append(tbody, $('tr', undefined, $('td.tiw-metadata-key', undefined, propertiesByDefValue[defValueStr].join(', ')), $('td.tiw-metadata-value', undefined, ...defValue)));
                }
            }
        }
        if (textMateTokenInfo) {
            const theme = this._themeService.getColorTheme();
            dom.append(this._domNode, $('hr.tiw-metadata-separator'));
            const table = dom.append(this._domNode, $('table.tiw-metadata-table'));
            const tbody = dom.append(table, $('tbody'));
            if (tmTokenText && tmTokenText !== tokenText) {
                dom.append(tbody, $('tr', undefined, $('td.tiw-metadata-key', undefined, 'textmate token'), $('td.tiw-metadata-value', undefined, `${tmTokenText} (${tmTokenText.length})`)));
            }
            const scopes = new Array();
            for (let i = textMateTokenInfo.token.scopes.length - 1; i >= 0; i--) {
                scopes.push(textMateTokenInfo.token.scopes[i]);
                if (i > 0) {
                    scopes.push($('br'));
                }
            }
            dom.append(tbody, $('tr', undefined, $('td.tiw-metadata-key', undefined, 'textmate scopes'), $('td.tiw-metadata-value.tiw-metadata-scopes', undefined, ...scopes)));
            const matchingRule = findMatchingThemeRule(theme, textMateTokenInfo.token.scopes, false);
            const semForeground = semanticTokenInfo?.metadata?.foreground;
            if (matchingRule) {
                if (semForeground !== textMateTokenInfo.metadata.foreground) {
                    let defValue = $('code.tiw-theme-selector', undefined, matchingRule.rawSelector, $('br'), JSON.stringify(matchingRule.settings, null, '\t'));
                    if (semForeground) {
                        defValue = $('s', undefined, defValue);
                    }
                    dom.append(tbody, $('tr', undefined, $('td.tiw-metadata-key', undefined, 'foreground'), $('td.tiw-metadata-value', undefined, defValue)));
                }
            }
            else if (!semForeground) {
                dom.append(tbody, $('tr', undefined, $('td.tiw-metadata-key', undefined, 'foreground'), $('td.tiw-metadata-value', undefined, 'No theme selector')));
            }
        }
        if (treeSitterTokenInfo) {
            const lastTokenInfo = treeSitterTokenInfo[treeSitterTokenInfo.length - 1];
            dom.append(this._domNode, $('hr.tiw-metadata-separator'));
            const table = dom.append(this._domNode, $('table.tiw-metadata-table'));
            const tbody = dom.append(table, $('tbody'));
            dom.append(tbody, $('tr', undefined, $('td.tiw-metadata-key', undefined, `tree-sitter token ${lastTokenInfo.id}`), $('td.tiw-metadata-value', undefined, `${lastTokenInfo.text}`)));
            const scopes = new Array();
            let i = treeSitterTokenInfo.length - 1;
            let node = treeSitterTokenInfo[i];
            while (node.parent || i > 0) {
                scopes.push(node.type);
                node = node.parent ?? treeSitterTokenInfo[--i];
                if (node) {
                    scopes.push($('br'));
                }
            }
            dom.append(tbody, $('tr', undefined, $('td.tiw-metadata-key', undefined, 'tree-sitter tree'), $('td.tiw-metadata-value.tiw-metadata-scopes', undefined, ...scopes)));
            const tokenizationSupport = this._model.tokenization.tokens.get().tokenizationImpl.get();
            const captures = tokenizationSupport?.captureAtPosition(position.lineNumber, position.column);
            if (captures && captures.length > 0) {
                dom.append(tbody, $('tr', undefined, $('td.tiw-metadata-key', undefined, 'foreground'), $('td.tiw-metadata-value', undefined, captures.map(cap => cap.name).join(' '))));
            }
        }
    }
    _formatMetadata(semantic, tm) {
        const elements = new Array();
        function render(property) {
            const value = semantic?.[property] || tm?.[property];
            if (value !== undefined) {
                const semanticStyle = semantic?.[property] ? 'tiw-metadata-semantic' : '';
                elements.push($('tr', undefined, $('td.tiw-metadata-key', undefined, property), $(`td.tiw-metadata-value.${semanticStyle}`, undefined, value)));
            }
            return value;
        }
        const foreground = render('foreground');
        const background = render('background');
        if (foreground && background) {
            const backgroundColor = Color.fromHex(background), foregroundColor = Color.fromHex(foreground);
            if (backgroundColor.isOpaque()) {
                elements.push($('tr', undefined, $('td.tiw-metadata-key', undefined, 'contrast ratio'), $('td.tiw-metadata-value', undefined, backgroundColor.getContrastRatio(foregroundColor.makeOpaque(backgroundColor)).toFixed(2))));
            }
            else {
                elements.push($('tr', undefined, $('td.tiw-metadata-key', undefined, 'Contrast ratio cannot be precise for background colors that use transparency'), $('td.tiw-metadata-value')));
            }
        }
        const fontStyleLabels = new Array();
        function addStyle(key) {
            let label;
            if (semantic && semantic[key]) {
                label = $('span.tiw-metadata-semantic', undefined, key);
            }
            else if (tm && tm[key]) {
                label = key;
            }
            if (label) {
                if (fontStyleLabels.length) {
                    fontStyleLabels.push(' ');
                }
                fontStyleLabels.push(label);
            }
        }
        addStyle('bold');
        addStyle('italic');
        addStyle('underline');
        addStyle('strikethrough');
        if (fontStyleLabels.length) {
            elements.push($('tr', undefined, $('td.tiw-metadata-key', undefined, 'font style'), $('td.tiw-metadata-value', undefined, ...fontStyleLabels)));
        }
        return elements;
    }
    _decodeMetadata(metadata) {
        const colorMap = this._themeService.getColorTheme().tokenColorMap;
        const languageId = TokenMetadata.getLanguageId(metadata);
        const tokenType = TokenMetadata.getTokenType(metadata);
        const fontStyle = TokenMetadata.getFontStyle(metadata);
        const foreground = TokenMetadata.getForeground(metadata);
        const background = TokenMetadata.getBackground(metadata);
        return {
            languageId: this._languageService.languageIdCodec.decodeLanguageId(languageId),
            tokenType: tokenType,
            bold: (fontStyle & 2 /* FontStyle.Bold */) ? true : undefined,
            italic: (fontStyle & 1 /* FontStyle.Italic */) ? true : undefined,
            underline: (fontStyle & 4 /* FontStyle.Underline */) ? true : undefined,
            strikethrough: (fontStyle & 8 /* FontStyle.Strikethrough */) ? true : undefined,
            foreground: colorMap[foreground],
            background: colorMap[background]
        };
    }
    _tokenTypeToString(tokenType) {
        switch (tokenType) {
            case 0 /* StandardTokenType.Other */: return 'Other';
            case 1 /* StandardTokenType.Comment */: return 'Comment';
            case 2 /* StandardTokenType.String */: return 'String';
            case 3 /* StandardTokenType.RegEx */: return 'RegEx';
            default: return '??';
        }
    }
    _getTokensAtPosition(grammar, position) {
        const lineNumber = position.lineNumber;
        const stateBeforeLine = this._getStateBeforeLine(grammar, lineNumber);
        const tokenizationResult1 = grammar.tokenizeLine(this._model.getLineContent(lineNumber), stateBeforeLine);
        const tokenizationResult2 = grammar.tokenizeLine2(this._model.getLineContent(lineNumber), stateBeforeLine);
        let token1Index = 0;
        for (let i = tokenizationResult1.tokens.length - 1; i >= 0; i--) {
            const t = tokenizationResult1.tokens[i];
            if (position.column - 1 >= t.startIndex) {
                token1Index = i;
                break;
            }
        }
        let token2Index = 0;
        for (let i = (tokenizationResult2.tokens.length >>> 1); i >= 0; i--) {
            if (position.column - 1 >= tokenizationResult2.tokens[(i << 1)]) {
                token2Index = i;
                break;
            }
        }
        return {
            token: tokenizationResult1.tokens[token1Index],
            metadata: this._decodeMetadata(tokenizationResult2.tokens[(token2Index << 1) + 1])
        };
    }
    _getStateBeforeLine(grammar, lineNumber) {
        let state = null;
        for (let i = 1; i < lineNumber; i++) {
            const tokenizationResult = grammar.tokenizeLine(this._model.getLineContent(i), state);
            state = tokenizationResult.ruleStack;
        }
        return state;
    }
    isSemanticTokens(token) {
        return token && token.data;
    }
    async _computeSemanticTokens(position) {
        if (!this._isSemanticColoringEnabled()) {
            return null;
        }
        const tokenProviders = this._languageFeaturesService.documentSemanticTokensProvider.ordered(this._model);
        if (tokenProviders.length) {
            const provider = tokenProviders[0];
            const tokens = await Promise.resolve(provider.provideDocumentSemanticTokens(this._model, null, this._currentRequestCancellationTokenSource.token));
            if (this.isSemanticTokens(tokens)) {
                return { tokens, legend: provider.getLegend() };
            }
        }
        const rangeTokenProviders = this._languageFeaturesService.documentRangeSemanticTokensProvider.ordered(this._model);
        if (rangeTokenProviders.length) {
            const provider = rangeTokenProviders[0];
            const lineNumber = position.lineNumber;
            const range = new Range(lineNumber, 1, lineNumber, this._model.getLineMaxColumn(lineNumber));
            const tokens = await Promise.resolve(provider.provideDocumentRangeSemanticTokens(this._model, range, this._currentRequestCancellationTokenSource.token));
            if (this.isSemanticTokens(tokens)) {
                return { tokens, legend: provider.getLegend() };
            }
        }
        return null;
    }
    _getSemanticTokenAtPosition(semanticTokens, pos) {
        const tokenData = semanticTokens.tokens.data;
        const defaultLanguage = this._model.getLanguageId();
        let lastLine = 0;
        let lastCharacter = 0;
        const posLine = pos.lineNumber - 1, posCharacter = pos.column - 1; // to 0-based position
        for (let i = 0; i < tokenData.length; i += 5) {
            const lineDelta = tokenData[i], charDelta = tokenData[i + 1], len = tokenData[i + 2], typeIdx = tokenData[i + 3], modSet = tokenData[i + 4];
            const line = lastLine + lineDelta; // 0-based
            const character = lineDelta === 0 ? lastCharacter + charDelta : charDelta; // 0-based
            if (posLine === line && character <= posCharacter && posCharacter < character + len) {
                const type = semanticTokens.legend.tokenTypes[typeIdx] || 'not in legend (ignored)';
                const modifiers = [];
                let modifierSet = modSet;
                for (let modifierIndex = 0; modifierSet > 0 && modifierIndex < semanticTokens.legend.tokenModifiers.length; modifierIndex++) {
                    if (modifierSet & 1) {
                        modifiers.push(semanticTokens.legend.tokenModifiers[modifierIndex]);
                    }
                    modifierSet = modifierSet >> 1;
                }
                if (modifierSet > 0) {
                    modifiers.push('not in legend (ignored)');
                }
                const range = new Range(line + 1, character + 1, line + 1, character + 1 + len);
                const definitions = {};
                const colorMap = this._themeService.getColorTheme().tokenColorMap;
                const theme = this._themeService.getColorTheme();
                const tokenStyle = theme.getTokenStyleMetadata(type, modifiers, defaultLanguage, true, definitions);
                let metadata = undefined;
                if (tokenStyle) {
                    metadata = {
                        languageId: undefined,
                        tokenType: 0 /* StandardTokenType.Other */,
                        bold: tokenStyle?.bold,
                        italic: tokenStyle?.italic,
                        underline: tokenStyle?.underline,
                        strikethrough: tokenStyle?.strikethrough,
                        foreground: colorMap[tokenStyle?.foreground || 0 /* ColorId.None */],
                        background: undefined
                    };
                }
                return { type, modifiers, range, metadata, definitions };
            }
            lastLine = line;
            lastCharacter = character;
        }
        return null;
    }
    _walkTreeforPosition(cursor, pos) {
        const offset = this._model.getOffsetAt(pos);
        cursor.gotoFirstChild();
        let goChild = false;
        let lastGoodNode = null;
        do {
            if (cursor.currentNode.startIndex <= offset && offset < cursor.currentNode.endIndex) {
                goChild = true;
                lastGoodNode = cursor.currentNode;
            }
            else {
                goChild = false;
            }
        } while (goChild ? cursor.gotoFirstChild() : cursor.gotoNextSibling());
        return lastGoodNode;
    }
    _getTreeSitterTokenAtPosition(treeSitterTree, pos) {
        const nodes = [];
        let tree = treeSitterTree?.tree.get();
        while (tree) {
            const cursor = tree.walk();
            const node = this._walkTreeforPosition(cursor, pos);
            cursor.delete();
            if (node) {
                nodes.push(node);
                treeSitterTree = treeSitterTree?.getInjectionTrees(node.startIndex, treeSitterTree.languageId);
                tree = treeSitterTree?.tree.get();
            }
            else {
                tree = undefined;
            }
        }
        return nodes.length > 0 ? nodes : null;
    }
    _renderTokenStyleDefinition(definition, property) {
        const elements = new Array();
        if (definition === undefined) {
            return elements;
        }
        const theme = this._themeService.getColorTheme();
        if (Array.isArray(definition)) {
            const scopesDefinition = {};
            theme.resolveScopes(definition, scopesDefinition);
            const matchingRule = scopesDefinition[property];
            if (matchingRule && scopesDefinition.scope) {
                const scopes = $('ul.tiw-metadata-values');
                const strScopes = Array.isArray(matchingRule.scope) ? matchingRule.scope : [String(matchingRule.scope)];
                for (const strScope of strScopes) {
                    scopes.appendChild($('li.tiw-metadata-value.tiw-metadata-scopes', undefined, strScope));
                }
                elements.push(scopesDefinition.scope.join(' '), scopes, $('code.tiw-theme-selector', undefined, JSON.stringify(matchingRule.settings, null, '\t')));
                return elements;
            }
            return elements;
        }
        else if (SemanticTokenRule.is(definition)) {
            const scope = theme.getTokenStylingRuleScope(definition);
            if (scope === 'setting') {
                elements.push(`User settings: ${definition.selector.id} - ${this._renderStyleProperty(definition.style, property)}`);
                return elements;
            }
            else if (scope === 'theme') {
                elements.push(`Color theme: ${definition.selector.id} - ${this._renderStyleProperty(definition.style, property)}`);
                return elements;
            }
            return elements;
        }
        else {
            const style = theme.resolveTokenStyleValue(definition);
            elements.push(`Default: ${style ? this._renderStyleProperty(style, property) : ''}`);
            return elements;
        }
    }
    _renderStyleProperty(style, property) {
        switch (property) {
            case 'foreground': return style.foreground ? Color.Format.CSS.formatHexA(style.foreground, true) : '';
            default: return style[property] !== undefined ? String(style[property]) : '';
        }
    }
    getDomNode() {
        return this._domNode;
    }
    getPosition() {
        return {
            position: this._editor.getPosition(),
            preference: [2 /* ContentWidgetPositionPreference.BELOW */, 1 /* ContentWidgetPositionPreference.ABOVE */]
        };
    }
}
registerEditorContribution(InspectEditorTokensController.ID, InspectEditorTokensController, 4 /* EditorContributionInstantiation.Lazy */);
registerEditorAction(InspectEditorTokens);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zcGVjdEVkaXRvclRva2Vucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvaW5zcGVjdEVkaXRvclRva2Vucy9pbnNwZWN0RWRpdG9yVG9rZW5zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLDJCQUEyQixDQUFDO0FBQ25DLE9BQU8sS0FBSyxHQUFHLE1BQU0sdUJBQXVCLENBQUM7QUFDN0MsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQ0FBb0MsQ0FBQztBQUUxRCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFNUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRXJFLE9BQU8sRUFBRSxZQUFZLEVBQW9CLG9CQUFvQixFQUFFLDBCQUEwQixFQUFtQyxNQUFNLG1EQUFtRCxDQUFDO0FBRXRMLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUluRSxPQUFPLEVBQXlDLGFBQWEsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzlILE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLHNFQUFzRSxDQUFDO0FBRXBILE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBRXJGLE9BQU8sRUFBRSxpQkFBaUIsRUFBOEIsTUFBTSxxRUFBcUUsQ0FBQztBQUNwSSxP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