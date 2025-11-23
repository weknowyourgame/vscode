/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { basename } from '../../../../base/common/path.js';
import * as Json from '../../../../base/common/json.js';
import { Color } from '../../../../base/common/color.js';
import { ExtensionData, THEME_SCOPE_CLOSE_PAREN, THEME_SCOPE_OPEN_PAREN, themeScopeRegex, THEME_SCOPE_WILDCARD } from './workbenchThemeService.js';
import { convertSettings } from './themeCompatibility.js';
import * as nls from '../../../../nls.js';
import * as types from '../../../../base/common/types.js';
import * as resources from '../../../../base/common/resources.js';
import { Extensions as ColorRegistryExtensions, editorBackground, editorForeground, DEFAULT_COLOR_CONFIG_VALUE } from '../../../../platform/theme/common/colorRegistry.js';
import { getThemeTypeSelector } from '../../../../platform/theme/common/themeService.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { getParseErrorMessage } from '../../../../base/common/jsonErrorMessages.js';
import { parse as parsePList } from './plistParser.js';
import { TokenStyle, SemanticTokenRule, getTokenClassificationRegistry, parseClassifierString } from '../../../../platform/theme/common/tokenClassificationRegistry.js';
import { createMatchers } from './textMateScopeMatcher.js';
import { ColorScheme, ThemeTypeSelector } from '../../../../platform/theme/common/theme.js';
import { toStandardTokenType } from '../../../../editor/common/languages/supports/tokenization.js';
const colorRegistry = Registry.as(ColorRegistryExtensions.ColorContribution);
const tokenClassificationRegistry = getTokenClassificationRegistry();
const tokenGroupToScopesMap = {
    comments: ['comment', 'punctuation.definition.comment'],
    strings: ['string', 'meta.embedded.assembly'],
    keywords: ['keyword - keyword.operator', 'keyword.control', 'storage', 'storage.type'],
    numbers: ['constant.numeric'],
    types: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class'],
    functions: ['entity.name.function', 'support.function'],
    variables: ['variable', 'entity.name.variable']
};
export class ColorThemeData {
    static { this.STORAGE_KEY = 'colorThemeData'; }
    constructor(id, label, settingsId) {
        this.themeTokenColors = [];
        this.customTokenColors = [];
        this.colorMap = {};
        this.customColorMap = {};
        this.semanticTokenRules = [];
        this.customSemanticTokenRules = [];
        this.textMateThemingRules = undefined; // created on demand
        this.tokenColorIndex = undefined; // created on demand
        this.id = id;
        this.label = label;
        this.settingsId = settingsId;
        this.isLoaded = false;
    }
    get semanticHighlighting() {
        if (this.customSemanticHighlighting !== undefined) {
            return this.customSemanticHighlighting;
        }
        if (this.customSemanticHighlightingDeprecated !== undefined) {
            return this.customSemanticHighlightingDeprecated;
        }
        return !!this.themeSemanticHighlighting;
    }
    get tokenColors() {
        if (!this.textMateThemingRules) {
            const result = [];
            // the default rule (scope empty) is always the first rule. Ignore all other default rules.
            const foreground = this.getColor(editorForeground) || this.getDefault(editorForeground);
            const background = this.getColor(editorBackground) || this.getDefault(editorBackground);
            result.push({
                settings: {
                    foreground: normalizeColor(foreground),
                    background: normalizeColor(background)
                }
            });
            let hasDefaultTokens = false;
            function addRule(rule) {
                if (rule.scope && rule.settings) {
                    if (rule.scope === 'token.info-token') {
                        hasDefaultTokens = true;
                    }
                    result.push({ scope: rule.scope, settings: { foreground: normalizeColor(rule.settings.foreground), background: normalizeColor(rule.settings.background), fontStyle: rule.settings.fontStyle } });
                }
            }
            this.themeTokenColors.forEach(addRule);
            // Add the custom colors after the theme colors
            // so that they will override them
            this.customTokenColors.forEach(addRule);
            if (!hasDefaultTokens) {
                defaultThemeColors[this.type].forEach(addRule);
            }
            this.textMateThemingRules = result;
        }
        return this.textMateThemingRules;
    }
    getColor(colorId, useDefault) {
        const customColor = this.customColorMap[colorId];
        if (customColor instanceof Color) {
            return customColor;
        }
        if (customColor === undefined) { /* !== DEFAULT_COLOR_CONFIG_VALUE */
            const color = this.colorMap[colorId];
            if (color !== undefined) {
                return color;
            }
        }
        if (useDefault !== false) {
            return this.getDefault(colorId);
        }
        return undefined;
    }
    getTokenStyle(type, modifiers, language, useDefault = true, definitions = {}) {
        const result = {
            foreground: undefined,
            bold: undefined,
            underline: undefined,
            strikethrough: undefined,
            italic: undefined
        };
        const score = {
            foreground: -1,
            bold: -1,
            underline: -1,
            strikethrough: -1,
            italic: -1
        };
        function _processStyle(matchScore, style, definition) {
            if (style.foreground && score.foreground <= matchScore) {
                score.foreground = matchScore;
                result.foreground = style.foreground;
                definitions.foreground = definition;
            }
            for (const p of ['bold', 'underline', 'strikethrough', 'italic']) {
                const property = p;
                const info = style[property];
                if (info !== undefined) {
                    if (score[property] <= matchScore) {
                        score[property] = matchScore;
                        result[property] = info;
                        definitions[property] = definition;
                    }
                }
            }
        }
        function _processSemanticTokenRule(rule) {
            const matchScore = rule.selector.match(type, modifiers, language);
            if (matchScore >= 0) {
                _processStyle(matchScore, rule.style, rule);
            }
        }
        this.semanticTokenRules.forEach(_processSemanticTokenRule);
        this.customSemanticTokenRules.forEach(_processSemanticTokenRule);
        let hasUndefinedStyleProperty = false;
        for (const k in score) {
            const key = k;
            if (score[key] === -1) {
                hasUndefinedStyleProperty = true;
            }
            else {
                score[key] = Number.MAX_VALUE; // set it to the max, so it won't be replaced by a default
            }
        }
        if (hasUndefinedStyleProperty) {
            for (const rule of tokenClassificationRegistry.getTokenStylingDefaultRules()) {
                const matchScore = rule.selector.match(type, modifiers, language);
                if (matchScore >= 0) {
                    let style;
                    if (rule.defaults.scopesToProbe) {
                        style = this.resolveScopes(rule.defaults.scopesToProbe);
                        if (style) {
                            _processStyle(matchScore, style, rule.defaults.scopesToProbe);
                        }
                    }
                    if (!style && useDefault !== false) {
                        const tokenStyleValue = rule.defaults[this.type];
                        style = this.resolveTokenStyleValue(tokenStyleValue);
                        if (style) {
                            _processStyle(matchScore, style, tokenStyleValue);
                        }
                    }
                }
            }
        }
        return TokenStyle.fromData(result);
    }
    /**
     * @param tokenStyleValue Resolve a tokenStyleValue in the context of a theme
     */
    resolveTokenStyleValue(tokenStyleValue) {
        if (tokenStyleValue === undefined) {
            return undefined;
        }
        else if (typeof tokenStyleValue === 'string') {
            const { type, modifiers, language } = parseClassifierString(tokenStyleValue, '');
            return this.getTokenStyle(type, modifiers, language);
        }
        else if (typeof tokenStyleValue === 'object') {
            return tokenStyleValue;
        }
        return undefined;
    }
    getTokenColorIndex() {
        // collect all colors that tokens can have
        if (!this.tokenColorIndex) {
            const index = new TokenColorIndex();
            this.tokenColors.forEach(rule => {
                index.add(rule.settings.foreground);
                index.add(rule.settings.background);
            });
            this.semanticTokenRules.forEach(r => index.add(r.style.foreground));
            tokenClassificationRegistry.getTokenStylingDefaultRules().forEach(r => {
                const defaultColor = r.defaults[this.type];
                if (defaultColor && typeof defaultColor === 'object') {
                    index.add(defaultColor.foreground);
                }
            });
            this.customSemanticTokenRules.forEach(r => index.add(r.style.foreground));
            this.tokenColorIndex = index;
        }
        return this.tokenColorIndex;
    }
    get tokenColorMap() {
        return this.getTokenColorIndex().asArray();
    }
    getTokenStyleMetadata(typeWithLanguage, modifiers, defaultLanguage, useDefault = true, definitions = {}) {
        const { type, language } = parseClassifierString(typeWithLanguage, defaultLanguage);
        const style = this.getTokenStyle(type, modifiers, language, useDefault, definitions);
        if (!style) {
            return undefined;
        }
        return {
            foreground: this.getTokenColorIndex().get(style.foreground),
            bold: style.bold,
            underline: style.underline,
            strikethrough: style.strikethrough,
            italic: style.italic,
        };
    }
    getTokenStylingRuleScope(rule) {
        if (this.customSemanticTokenRules.indexOf(rule) !== -1) {
            return 'setting';
        }
        if (this.semanticTokenRules.indexOf(rule) !== -1) {
            return 'theme';
        }
        return undefined;
    }
    getDefault(colorId) {
        return colorRegistry.resolveDefaultColor(colorId, this);
    }
    resolveScopes(scopes, definitions) {
        if (!this.themeTokenScopeMatchers) {
            this.themeTokenScopeMatchers = this.themeTokenColors.map(getScopeMatcher);
        }
        if (!this.customTokenScopeMatchers) {
            this.customTokenScopeMatchers = this.customTokenColors.map(getScopeMatcher);
        }
        for (const scope of scopes) {
            let foreground = undefined;
            let fontStyle = undefined;
            let foregroundScore = -1;
            let fontStyleScore = -1;
            let fontStyleThemingRule = undefined;
            let foregroundThemingRule = undefined;
            function findTokenStyleForScopeInScopes(scopeMatchers, themingRules) {
                for (let i = 0; i < scopeMatchers.length; i++) {
                    const score = scopeMatchers[i](scope);
                    if (score >= 0) {
                        const themingRule = themingRules[i];
                        const settings = themingRules[i].settings;
                        if (score >= foregroundScore && settings.foreground) {
                            foreground = settings.foreground;
                            foregroundScore = score;
                            foregroundThemingRule = themingRule;
                        }
                        if (score >= fontStyleScore && types.isString(settings.fontStyle)) {
                            fontStyle = settings.fontStyle;
                            fontStyleScore = score;
                            fontStyleThemingRule = themingRule;
                        }
                    }
                }
            }
            findTokenStyleForScopeInScopes(this.themeTokenScopeMatchers, this.themeTokenColors);
            findTokenStyleForScopeInScopes(this.customTokenScopeMatchers, this.customTokenColors);
            if (foreground !== undefined || fontStyle !== undefined) {
                if (definitions) {
                    definitions.foreground = foregroundThemingRule;
                    definitions.bold = definitions.italic = definitions.underline = definitions.strikethrough = fontStyleThemingRule;
                    definitions.scope = scope;
                }
                return TokenStyle.fromSettings(foreground, fontStyle);
            }
        }
        return undefined;
    }
    defines(colorId) {
        const customColor = this.customColorMap[colorId];
        if (customColor instanceof Color) {
            return true;
        }
        return customColor === undefined /* !== DEFAULT_COLOR_CONFIG_VALUE */ && this.colorMap.hasOwnProperty(colorId);
    }
    setCustomizations(settings) {
        this.setCustomColors(settings.colorCustomizations);
        this.setCustomTokenColors(settings.tokenColorCustomizations);
        this.setCustomSemanticTokenColors(settings.semanticTokenColorCustomizations);
    }
    setCustomColors(colors) {
        this.customColorMap = {};
        this.overwriteCustomColors(colors);
        const themeSpecificColors = this.getThemeSpecificColors(colors);
        if (types.isObject(themeSpecificColors)) {
            this.overwriteCustomColors(themeSpecificColors);
        }
        this.tokenColorIndex = undefined;
        this.textMateThemingRules = undefined;
        this.customTokenScopeMatchers = undefined;
    }
    overwriteCustomColors(colors) {
        for (const id in colors) {
            const colorVal = colors[id];
            if (colorVal === DEFAULT_COLOR_CONFIG_VALUE) {
                this.customColorMap[id] = DEFAULT_COLOR_CONFIG_VALUE;
            }
            else if (typeof colorVal === 'string') {
                this.customColorMap[id] = Color.fromHex(colorVal);
            }
        }
    }
    setCustomTokenColors(customTokenColors) {
        this.customTokenColors = [];
        this.customSemanticHighlightingDeprecated = undefined;
        // first add the non-theme specific settings
        this.addCustomTokenColors(customTokenColors);
        // append theme specific settings. Last rules will win.
        const themeSpecificTokenColors = this.getThemeSpecificColors(customTokenColors);
        if (types.isObject(themeSpecificTokenColors)) {
            this.addCustomTokenColors(themeSpecificTokenColors);
        }
        this.tokenColorIndex = undefined;
        this.textMateThemingRules = undefined;
        this.customTokenScopeMatchers = undefined;
    }
    setCustomSemanticTokenColors(semanticTokenColors) {
        this.customSemanticTokenRules = [];
        this.customSemanticHighlighting = undefined;
        if (semanticTokenColors) {
            this.customSemanticHighlighting = semanticTokenColors.enabled;
            if (semanticTokenColors.rules) {
                this.readSemanticTokenRules(semanticTokenColors.rules);
            }
            const themeSpecificColors = this.getThemeSpecificColors(semanticTokenColors);
            if (types.isObject(themeSpecificColors)) {
                if (themeSpecificColors.enabled !== undefined) {
                    this.customSemanticHighlighting = themeSpecificColors.enabled;
                }
                if (themeSpecificColors.rules) {
                    this.readSemanticTokenRules(themeSpecificColors.rules);
                }
            }
        }
        this.tokenColorIndex = undefined;
        this.textMateThemingRules = undefined;
    }
    isThemeScope(key) {
        return key.charAt(0) === THEME_SCOPE_OPEN_PAREN && key.charAt(key.length - 1) === THEME_SCOPE_CLOSE_PAREN;
    }
    isThemeScopeMatch(themeId) {
        const themeIdFirstChar = themeId.charAt(0);
        const themeIdLastChar = themeId.charAt(themeId.length - 1);
        const themeIdPrefix = themeId.slice(0, -1);
        const themeIdInfix = themeId.slice(1, -1);
        const themeIdSuffix = themeId.slice(1);
        return themeId === this.settingsId
            || (this.settingsId.includes(themeIdInfix) && themeIdFirstChar === THEME_SCOPE_WILDCARD && themeIdLastChar === THEME_SCOPE_WILDCARD)
            || (this.settingsId.startsWith(themeIdPrefix) && themeIdLastChar === THEME_SCOPE_WILDCARD)
            || (this.settingsId.endsWith(themeIdSuffix) && themeIdFirstChar === THEME_SCOPE_WILDCARD);
    }
    getThemeSpecificColors(colors) {
        let themeSpecificColors;
        for (const key in colors) {
            const scopedColors = colors[key];
            if (this.isThemeScope(key) && scopedColors instanceof Object && !Array.isArray(scopedColors)) {
                const themeScopeList = key.match(themeScopeRegex) || [];
                for (const themeScope of themeScopeList) {
                    const themeId = themeScope.substring(1, themeScope.length - 1);
                    if (this.isThemeScopeMatch(themeId)) {
                        if (!themeSpecificColors) {
                            themeSpecificColors = {};
                        }
                        const scopedThemeSpecificColors = scopedColors;
                        for (const subkey in scopedThemeSpecificColors) {
                            const originalColors = themeSpecificColors[subkey];
                            const overrideColors = scopedThemeSpecificColors[subkey];
                            if (Array.isArray(originalColors) && Array.isArray(overrideColors)) {
                                themeSpecificColors[subkey] = originalColors.concat(overrideColors);
                            }
                            else if (overrideColors) {
                                themeSpecificColors[subkey] = overrideColors;
                            }
                        }
                    }
                }
            }
        }
        return themeSpecificColors;
    }
    readSemanticTokenRules(tokenStylingRuleSection) {
        for (const key in tokenStylingRuleSection) {
            if (!this.isThemeScope(key)) { // still do this test until experimental settings are gone
                try {
                    const rule = readSemanticTokenRule(key, tokenStylingRuleSection[key]);
                    if (rule) {
                        this.customSemanticTokenRules.push(rule);
                    }
                }
                catch (e) {
                    // invalid selector, ignore
                }
            }
        }
    }
    addCustomTokenColors(customTokenColors) {
        // Put the general customizations such as comments, strings, etc. first so that
        // they can be overridden by specific customizations like "string.interpolated"
        for (const tokenGroup in tokenGroupToScopesMap) {
            const group = tokenGroup; // TS doesn't type 'tokenGroup' properly
            const value = customTokenColors[group];
            if (value) {
                const settings = typeof value === 'string' ? { foreground: value } : value;
                const scopes = tokenGroupToScopesMap[group];
                for (const scope of scopes) {
                    this.customTokenColors.push({ scope, settings });
                }
            }
        }
        // specific customizations
        if (Array.isArray(customTokenColors.textMateRules)) {
            for (const rule of customTokenColors.textMateRules) {
                if (rule.scope && rule.settings) {
                    this.customTokenColors.push(rule);
                }
            }
        }
        if (customTokenColors.semanticHighlighting !== undefined) {
            this.customSemanticHighlightingDeprecated = customTokenColors.semanticHighlighting;
        }
    }
    ensureLoaded(extensionResourceLoaderService) {
        return !this.isLoaded ? this.load(extensionResourceLoaderService) : Promise.resolve(undefined);
    }
    reload(extensionResourceLoaderService) {
        return this.load(extensionResourceLoaderService);
    }
    load(extensionResourceLoaderService) {
        if (!this.location) {
            return Promise.resolve(undefined);
        }
        this.themeTokenColors = [];
        this.clearCaches();
        const result = {
            colors: {},
            textMateRules: [],
            semanticTokenRules: [],
            semanticHighlighting: false
        };
        return _loadColorTheme(extensionResourceLoaderService, this.location, result).then(_ => {
            this.isLoaded = true;
            this.semanticTokenRules = result.semanticTokenRules;
            this.colorMap = result.colors;
            this.themeTokenColors = result.textMateRules;
            this.themeSemanticHighlighting = result.semanticHighlighting;
        });
    }
    clearCaches() {
        this.tokenColorIndex = undefined;
        this.textMateThemingRules = undefined;
        this.themeTokenScopeMatchers = undefined;
        this.customTokenScopeMatchers = undefined;
    }
    toStorage(storageService) {
        const colorMapData = {};
        for (const key in this.colorMap) {
            colorMapData[key] = Color.Format.CSS.formatHexA(this.colorMap[key], true);
        }
        // no need to persist custom colors, they will be taken from the settings
        const value = JSON.stringify({
            id: this.id,
            label: this.label,
            settingsId: this.settingsId,
            themeTokenColors: this.themeTokenColors.map(tc => ({ settings: tc.settings, scope: tc.scope })), // don't persist names
            semanticTokenRules: this.semanticTokenRules.map(SemanticTokenRule.toJSONObject),
            extensionData: ExtensionData.toJSONObject(this.extensionData),
            themeSemanticHighlighting: this.themeSemanticHighlighting,
            colorMap: colorMapData,
            watch: this.watch
        });
        // roam persisted color theme colors. Don't enable for icons as they contain references to fonts and images.
        storageService.store(ColorThemeData.STORAGE_KEY, value, 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
    }
    get themeTypeSelector() {
        return this.classNames[0];
    }
    get classNames() {
        return this.id.split(' ');
    }
    get type() {
        switch (this.themeTypeSelector) {
            case ThemeTypeSelector.VS: return ColorScheme.LIGHT;
            case ThemeTypeSelector.HC_BLACK: return ColorScheme.HIGH_CONTRAST_DARK;
            case ThemeTypeSelector.HC_LIGHT: return ColorScheme.HIGH_CONTRAST_LIGHT;
            default: return ColorScheme.DARK;
        }
    }
    // constructors
    static createUnloadedThemeForThemeType(themeType, colorMap) {
        return ColorThemeData.createUnloadedTheme(getThemeTypeSelector(themeType), colorMap);
    }
    static createUnloadedTheme(id, colorMap) {
        const themeData = new ColorThemeData(id, '', '__' + id);
        themeData.isLoaded = false;
        themeData.themeTokenColors = [];
        themeData.watch = false;
        if (colorMap) {
            for (const id in colorMap) {
                themeData.colorMap[id] = Color.fromHex(colorMap[id]);
            }
        }
        return themeData;
    }
    static createLoadedEmptyTheme(id, settingsId) {
        const themeData = new ColorThemeData(id, '', settingsId);
        themeData.isLoaded = true;
        themeData.themeTokenColors = [];
        themeData.watch = false;
        return themeData;
    }
    static fromStorageData(storageService) {
        const input = storageService.get(ColorThemeData.STORAGE_KEY, 0 /* StorageScope.PROFILE */);
        if (!input) {
            return undefined;
        }
        try {
            const data = JSON.parse(input);
            const theme = new ColorThemeData('', '', '');
            for (const key in data) {
                switch (key) {
                    case 'colorMap': {
                        const colorMapData = data[key];
                        for (const id in colorMapData) {
                            theme.colorMap[id] = Color.fromHex(colorMapData[id]);
                        }
                        break;
                    }
                    case 'themeTokenColors':
                    case 'id':
                    case 'label':
                    case 'settingsId':
                    case 'watch':
                    case 'themeSemanticHighlighting':
                        // eslint-disable-next-line local/code-no-any-casts
                        theme[key] = data[key];
                        break;
                    case 'semanticTokenRules': {
                        const rulesData = data[key];
                        if (Array.isArray(rulesData)) {
                            for (const d of rulesData) {
                                const rule = SemanticTokenRule.fromJSONObject(tokenClassificationRegistry, d);
                                if (rule) {
                                    theme.semanticTokenRules.push(rule);
                                }
                            }
                        }
                        break;
                    }
                    case 'location':
                        // ignore, no longer restore
                        break;
                    case 'extensionData':
                        theme.extensionData = ExtensionData.fromJSONObject(data.extensionData);
                        break;
                }
            }
            if (!theme.id || !theme.settingsId) {
                return undefined;
            }
            return theme;
        }
        catch (e) {
            return undefined;
        }
    }
    static fromExtensionTheme(theme, colorThemeLocation, extensionData) {
        const baseTheme = theme['uiTheme'] || 'vs-dark';
        const themeSelector = toCSSSelector(extensionData.extensionId, theme.path);
        const id = `${baseTheme} ${themeSelector}`;
        const label = theme.label || basename(theme.path);
        const settingsId = theme.id || label;
        const themeData = new ColorThemeData(id, label, settingsId);
        themeData.description = theme.description;
        themeData.watch = theme._watch === true;
        themeData.location = colorThemeLocation;
        themeData.extensionData = extensionData;
        themeData.isLoaded = false;
        return themeData;
    }
}
function toCSSSelector(extensionId, path) {
    if (path.startsWith('./')) {
        path = path.substr(2);
    }
    let str = `${extensionId}-${path}`;
    //remove all characters that are not allowed in css
    str = str.replace(/[^_a-zA-Z0-9-]/g, '-');
    if (str.charAt(0).match(/[0-9-]/)) {
        str = '_' + str;
    }
    return str;
}
async function _loadColorTheme(extensionResourceLoaderService, themeLocation, result) {
    if (resources.extname(themeLocation) === '.json') {
        const content = await extensionResourceLoaderService.readExtensionResource(themeLocation);
        const errors = [];
        const contentValue = Json.parse(content, errors);
        if (errors.length > 0) {
            return Promise.reject(new Error(nls.localize('error.cannotparsejson', "Problems parsing JSON theme file: {0}", errors.map(e => getParseErrorMessage(e.error)).join(', '))));
        }
        else if (Json.getNodeType(contentValue) !== 'object') {
            return Promise.reject(new Error(nls.localize('error.invalidformat', "Invalid format for JSON theme file: Object expected.")));
        }
        if (contentValue.include) {
            await _loadColorTheme(extensionResourceLoaderService, resources.joinPath(resources.dirname(themeLocation), contentValue.include), result);
        }
        if (Array.isArray(contentValue.settings)) {
            convertSettings(contentValue.settings, result);
            return null;
        }
        result.semanticHighlighting = result.semanticHighlighting || contentValue.semanticHighlighting;
        const colors = contentValue.colors;
        if (colors) {
            if (typeof colors !== 'object') {
                return Promise.reject(new Error(nls.localize({ key: 'error.invalidformat.colors', comment: ['{0} will be replaced by a path. Values in quotes should not be translated.'] }, "Problem parsing color theme file: {0}. Property 'colors' is not of type 'object'.", themeLocation.toString())));
            }
            // new JSON color themes format
            for (const colorId in colors) {
                const colorVal = colors[colorId];
                if (colorVal === DEFAULT_COLOR_CONFIG_VALUE) { // ignore colors that are set to to default
                    delete result.colors[colorId];
                }
                else if (typeof colorVal === 'string') {
                    result.colors[colorId] = Color.fromHex(colors[colorId]);
                }
            }
        }
        const tokenColors = contentValue.tokenColors;
        if (tokenColors) {
            if (Array.isArray(tokenColors)) {
                result.textMateRules.push(...tokenColors);
            }
            else if (typeof tokenColors === 'string') {
                await _loadSyntaxTokens(extensionResourceLoaderService, resources.joinPath(resources.dirname(themeLocation), tokenColors), result);
            }
            else {
                return Promise.reject(new Error(nls.localize({ key: 'error.invalidformat.tokenColors', comment: ['{0} will be replaced by a path. Values in quotes should not be translated.'] }, "Problem parsing color theme file: {0}. Property 'tokenColors' should be either an array specifying colors or a path to a TextMate theme file", themeLocation.toString())));
            }
        }
        const semanticTokenColors = contentValue.semanticTokenColors;
        if (semanticTokenColors && typeof semanticTokenColors === 'object') {
            for (const key in semanticTokenColors) {
                try {
                    const rule = readSemanticTokenRule(key, semanticTokenColors[key]);
                    if (rule) {
                        result.semanticTokenRules.push(rule);
                    }
                }
                catch (e) {
                    return Promise.reject(new Error(nls.localize({ key: 'error.invalidformat.semanticTokenColors', comment: ['{0} will be replaced by a path. Values in quotes should not be translated.'] }, "Problem parsing color theme file: {0}. Property 'semanticTokenColors' contains a invalid selector", themeLocation.toString())));
                }
            }
        }
    }
    else {
        return _loadSyntaxTokens(extensionResourceLoaderService, themeLocation, result);
    }
}
function _loadSyntaxTokens(extensionResourceLoaderService, themeLocation, result) {
    return extensionResourceLoaderService.readExtensionResource(themeLocation).then(content => {
        try {
            const contentValue = parsePList(content);
            const settings = contentValue.settings;
            if (!Array.isArray(settings)) {
                return Promise.reject(new Error(nls.localize('error.plist.invalidformat', "Problem parsing tmTheme file: {0}. 'settings' is not array.")));
            }
            convertSettings(settings, result);
            return Promise.resolve(null);
        }
        catch (e) {
            return Promise.reject(new Error(nls.localize('error.cannotparse', "Problems parsing tmTheme file: {0}", e.message)));
        }
    }, error => {
        return Promise.reject(new Error(nls.localize('error.cannotload', "Problems loading tmTheme file {0}: {1}", themeLocation.toString(), error.message)));
    });
}
const defaultThemeColors = {
    'light': [
        { scope: 'token.info-token', settings: { foreground: '#316bcd' } },
        { scope: 'token.warn-token', settings: { foreground: '#cd9731' } },
        { scope: 'token.error-token', settings: { foreground: '#cd3131' } },
        { scope: 'token.debug-token', settings: { foreground: '#800080' } }
    ],
    'dark': [
        { scope: 'token.info-token', settings: { foreground: '#6796e6' } },
        { scope: 'token.warn-token', settings: { foreground: '#cd9731' } },
        { scope: 'token.error-token', settings: { foreground: '#f44747' } },
        { scope: 'token.debug-token', settings: { foreground: '#b267e6' } }
    ],
    'hcLight': [
        { scope: 'token.info-token', settings: { foreground: '#316bcd' } },
        { scope: 'token.warn-token', settings: { foreground: '#cd9731' } },
        { scope: 'token.error-token', settings: { foreground: '#cd3131' } },
        { scope: 'token.debug-token', settings: { foreground: '#800080' } }
    ],
    'hcDark': [
        { scope: 'token.info-token', settings: { foreground: '#6796e6' } },
        { scope: 'token.warn-token', settings: { foreground: '#008000' } },
        { scope: 'token.error-token', settings: { foreground: '#FF0000' } },
        { scope: 'token.debug-token', settings: { foreground: '#b267e6' } }
    ]
};
const noMatch = (_scope) => -1;
function nameMatcher(identifiers, scopes) {
    if (scopes.length < identifiers.length) {
        return -1;
    }
    let score = undefined;
    const every = identifiers.every((identifier) => {
        for (let i = scopes.length - 1; i >= 0; i--) {
            if (scopesAreMatching(scopes[i], identifier)) {
                score = (i + 1) * 0x10000 + identifier.length;
                return true;
            }
        }
        return false;
    });
    return every && score !== undefined ? score : -1;
}
function scopesAreMatching(thisScopeName, scopeName) {
    if (!thisScopeName) {
        return false;
    }
    if (thisScopeName === scopeName) {
        return true;
    }
    const len = scopeName.length;
    return thisScopeName.length > len && thisScopeName.substr(0, len) === scopeName && thisScopeName[len] === '.';
}
function getScopeMatcher(rule) {
    const ruleScope = rule.scope;
    if (!ruleScope || !rule.settings) {
        return noMatch;
    }
    const matchers = [];
    if (Array.isArray(ruleScope)) {
        for (const rs of ruleScope) {
            createMatchers(rs, nameMatcher, matchers);
        }
    }
    else {
        createMatchers(ruleScope, nameMatcher, matchers);
    }
    if (matchers.length === 0) {
        return noMatch;
    }
    return (scope) => {
        let max = matchers[0].matcher(scope);
        for (let i = 1; i < matchers.length; i++) {
            max = Math.max(max, matchers[i].matcher(scope));
        }
        return max;
    };
}
function readSemanticTokenRule(selectorString, settings) {
    const selector = tokenClassificationRegistry.parseTokenSelector(selectorString);
    let style;
    if (typeof settings === 'string') {
        style = TokenStyle.fromSettings(settings, undefined);
    }
    else if (isSemanticTokenColorizationSetting(settings)) {
        style = TokenStyle.fromSettings(settings.foreground, settings.fontStyle, settings.bold, settings.underline, settings.strikethrough, settings.italic);
    }
    if (style) {
        return { selector, style };
    }
    return undefined;
}
function isSemanticTokenColorizationSetting(style) {
    return style && (types.isString(style.foreground) || types.isString(style.fontStyle) || types.isBoolean(style.italic)
        || types.isBoolean(style.underline) || types.isBoolean(style.strikethrough) || types.isBoolean(style.bold));
}
export function findMetadata(colorThemeData, captureNames, languageId, bracket) {
    let metadata = 0;
    metadata |= (languageId << 0 /* MetadataConsts.LANGUAGEID_OFFSET */);
    const definitions = {};
    const tokenStyle = colorThemeData.resolveScopes([captureNames], definitions);
    if (captureNames.length > 0) {
        const standardToken = toStandardTokenType(captureNames[captureNames.length - 1]);
        metadata |= (standardToken << 8 /* MetadataConsts.TOKEN_TYPE_OFFSET */);
    }
    const fontStyle = definitions.foreground?.settings.fontStyle || definitions.bold?.settings.fontStyle;
    if (fontStyle?.includes('italic')) {
        metadata |= 1 /* FontStyle.Italic */ | 2048 /* MetadataConsts.ITALIC_MASK */;
    }
    if (fontStyle?.includes('bold')) {
        metadata |= 2 /* FontStyle.Bold */ | 4096 /* MetadataConsts.BOLD_MASK */;
    }
    if (fontStyle?.includes('underline')) {
        metadata |= 4 /* FontStyle.Underline */ | 8192 /* MetadataConsts.UNDERLINE_MASK */;
    }
    if (fontStyle?.includes('strikethrough')) {
        metadata |= 8 /* FontStyle.Strikethrough */ | 16384 /* MetadataConsts.STRIKETHROUGH_MASK */;
    }
    const foreground = tokenStyle?.foreground;
    const tokenStyleForeground = (foreground !== undefined) ? colorThemeData.getTokenColorIndex().get(foreground) : 1 /* ColorId.DefaultForeground */;
    metadata |= tokenStyleForeground << 15 /* MetadataConsts.FOREGROUND_OFFSET */;
    if (bracket) {
        metadata |= 1024 /* MetadataConsts.BALANCED_BRACKETS_MASK */;
    }
    return metadata;
}
class TokenColorIndex {
    constructor() {
        this._lastColorId = 0;
        this._id2color = [];
        this._color2id = Object.create(null);
    }
    add(color) {
        color = normalizeColor(color);
        if (color === undefined) {
            return 0;
        }
        let value = this._color2id[color];
        if (value) {
            return value;
        }
        value = ++this._lastColorId;
        this._color2id[color] = value;
        this._id2color[value] = color;
        return value;
    }
    get(color) {
        color = normalizeColor(color);
        if (color === undefined) {
            return 0;
        }
        const value = this._color2id[color];
        if (value) {
            return value;
        }
        console.log(`Color ${color} not in index.`);
        return 0;
    }
    asArray() {
        return this._id2color.slice(0);
    }
}
function normalizeColor(color) {
    if (!color) {
        return undefined;
    }
    if (typeof color !== 'string') {
        color = Color.Format.CSS.formatHexA(color, true);
    }
    const len = color.length;
    if (color.charCodeAt(0) !== 35 /* CharCode.Hash */ || (len !== 4 && len !== 5 && len !== 7 && len !== 9)) {
        return undefined;
    }
    const result = [35 /* CharCode.Hash */];
    for (let i = 1; i < len; i++) {
        const upper = hexUpper(color.charCodeAt(i));
        if (!upper) {
            return undefined;
        }
        result.push(upper);
        if (len === 4 || len === 5) {
            result.push(upper);
        }
    }
    if (result.length === 9 && result[7] === 70 /* CharCode.F */ && result[8] === 70 /* CharCode.F */) {
        result.length = 7;
    }
    return String.fromCharCode(...result);
}
function hexUpper(charCode) {
    if (charCode >= 48 /* CharCode.Digit0 */ && charCode <= 57 /* CharCode.Digit9 */ || charCode >= 65 /* CharCode.A */ && charCode <= 70 /* CharCode.F */) {
        return charCode;
    }
    else if (charCode >= 97 /* CharCode.a */ && charCode <= 102 /* CharCode.f */) {
        return charCode - 97 /* CharCode.a */ + 65 /* CharCode.A */;
    }
    return 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29sb3JUaGVtZURhdGEuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL3RoZW1lcy9jb21tb24vY29sb3JUaGVtZURhdGEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzNELE9BQU8sS0FBSyxJQUFJLE1BQU0saUNBQWlDLENBQUM7QUFDeEQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxhQUFhLEVBQXFSLHVCQUF1QixFQUFFLHNCQUFzQixFQUFFLGVBQWUsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ3RhLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUMxRCxPQUFPLEtBQUssR0FBRyxNQUFNLG9CQUFvQixDQUFDO0FBQzFDLE9BQU8sS0FBSyxLQUFLLE1BQU0sa0NBQWtDLENBQUM7QUFDMUQsT0FBTyxLQUFLLFNBQVMsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsVUFBVSxJQUFJLHVCQUF1QixFQUFtQyxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFBRSwwQkFBMEIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQzVNLE9BQU8sRUFBZSxvQkFBb0IsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUVwRixPQUFPLEVBQUUsS0FBSyxJQUFJLFVBQVUsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQWMsOEJBQThCLEVBQW1DLHFCQUFxQixF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UUFBUSxFQUFFLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxFQUFFO1FBQ2xFLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixFQUFFLFFBQVEsRUFBRSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsRUFBRTtRQUNuRSxFQUFFLEtBQUssRUFBRSxtQkFBbUIsRUFBRSxRQUFRLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEVBQUU7S0FDbkU7SUFDRCxNQUFNLEVBQUU7UUFDUCxFQUFFLEtBQUssRUFBRSxrQkFBa0IsRUFBRSxRQUFRLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEVBQUU7UUFDbEUsRUFBRSxLQUFLLEVBQUUsa0JBQWtCLEVBQUUsUUFBUSxFQUFFLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxFQUFFO1FBQ2xFLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixFQUFFLFFBQVEsRUFBRSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsRUFBRTtRQUNuRSxFQUFFLEtBQUssRUFBRSxtQkFBbUIsRUFBRSxRQUFRLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEVBQUU7S0FDbkU7SUFDRCxTQUFTLEVBQUU7UUFDVixFQUFFLEtBQUssRUFBRSxrQkFBa0IsRUFBRSxRQUFRLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEVBQUU7UUFDbEUsRUFBRSxLQUFLLEVBQUUsa0JBQWtCLEVBQUUsUUFBUSxFQUFFLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxFQUFFO1FBQ2xFLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixFQUFFLFFBQVEsRUFBRSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsRUFBRTtRQUNuRSxFQUFFLEtBQUssRUFBRSxtQkFBbUIsRUFBRSxRQUFRLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEVBQUU7S0FDbkU7SUFDRCxRQUFRLEVBQUU7UUFDVCxFQUFFLEtBQUssRUFBRSxrQkFBa0IsRUFBRSxRQUFRLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEVB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