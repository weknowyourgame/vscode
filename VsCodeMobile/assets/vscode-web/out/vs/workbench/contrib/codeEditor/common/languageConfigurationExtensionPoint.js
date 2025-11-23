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
var LanguageConfigurationFileHandler_1;
import * as nls from '../../../../nls.js';
import { parse, getNodeType } from '../../../../base/common/json.js';
import * as types from '../../../../base/common/types.js';
import { IndentAction } from '../../../../editor/common/languages/languageConfiguration.js';
import { ILanguageConfigurationService } from '../../../../editor/common/languages/languageConfigurationRegistry.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { Extensions } from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { getParseErrorMessage } from '../../../../base/common/jsonErrorMessages.js';
import { IExtensionResourceLoaderService } from '../../../../platform/extensionResourceLoader/common/extensionResourceLoader.js';
import { hash } from '../../../../base/common/hash.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
function isStringArr(something) {
    if (!Array.isArray(something)) {
        return false;
    }
    for (let i = 0, len = something.length; i < len; i++) {
        if (typeof something[i] !== 'string') {
            return false;
        }
    }
    return true;
}
function isCharacterPair(something) {
    return (isStringArr(something)
        && something.length === 2);
}
let LanguageConfigurationFileHandler = LanguageConfigurationFileHandler_1 = class LanguageConfigurationFileHandler extends Disposable {
    constructor(_languageService, _extensionResourceLoaderService, _extensionService, _languageConfigurationService) {
        super();
        this._languageService = _languageService;
        this._extensionResourceLoaderService = _extensionResourceLoaderService;
        this._extensionService = _extensionService;
        this._languageConfigurationService = _languageConfigurationService;
        /**
         * A map from language id to a hash computed from the config files locations.
         */
        this._done = new Map();
        this._register(this._languageService.onDidRequestBasicLanguageFeatures(async (languageIdentifier) => {
            // Modes can be instantiated before the extension points have finished registering
            this._extensionService.whenInstalledExtensionsRegistered().then(() => {
                this._loadConfigurationsForMode(languageIdentifier);
            });
        }));
        this._register(this._languageService.onDidChange(() => {
            // reload language configurations as necessary
            for (const [languageId] of this._done) {
                this._loadConfigurationsForMode(languageId);
            }
        }));
    }
    async _loadConfigurationsForMode(languageId) {
        const configurationFiles = this._languageService.getConfigurationFiles(languageId);
        const configurationHash = hash(configurationFiles.map(uri => uri.toString()));
        if (this._done.get(languageId) === configurationHash) {
            return;
        }
        this._done.set(languageId, configurationHash);
        const configs = await Promise.all(configurationFiles.map(configFile => this._readConfigFile(configFile)));
        for (const config of configs) {
            this._handleConfig(languageId, config);
        }
    }
    async _readConfigFile(configFileLocation) {
        try {
            const contents = await this._extensionResourceLoaderService.readExtensionResource(configFileLocation);
            const errors = [];
            let configuration = parse(contents, errors);
            if (errors.length) {
                console.error(nls.localize('parseErrors', "Errors parsing {0}: {1}", configFileLocation.toString(), errors.map(e => (`[${e.offset}, ${e.length}] ${getParseErrorMessage(e.error)}`)).join('\n')));
            }
            if (getNodeType(configuration) !== 'object') {
                console.error(nls.localize('formatError', "{0}: Invalid format, JSON object expected.", configFileLocation.toString()));
                configuration = {};
            }
            return configuration;
        }
        catch (err) {
            console.error(err);
            return {};
        }
    }
    static _extractValidCommentRule(languageId, configuration) {
        const source = configuration.comments;
        if (typeof source === 'undefined') {
            return undefined;
        }
        if (!types.isObject(source)) {
            console.warn(`[${languageId}]: language configuration: expected \`comments\` to be an object.`);
            return undefined;
        }
        let result = undefined;
        if (typeof source.lineComment !== 'undefined') {
            if (typeof source.lineComment === 'string') {
                result = result || {};
                result.lineComment = source.lineComment;
            }
            else if (types.isObject(source.lineComment)) {
                const lineCommentObj = source.lineComment;
                if (typeof lineCommentObj.comment === 'string') {
                    result = result || {};
                    result.lineComment = {
                        comment: lineCommentObj.comment,
                        noIndent: lineCommentObj.noIndent
                    };
                }
                else {
                    console.warn(`[${languageId}]: language configuration: expected \`comments.lineComment.comment\` to be a string.`);
                }
            }
            else {
                console.warn(`[${languageId}]: language configuration: expected \`comments.lineComment\` to be a string or an object with comment property.`);
            }
        }
        if (typeof source.blockComment !== 'undefined') {
            if (!isCharacterPair(source.blockComment)) {
                console.warn(`[${languageId}]: language configuration: expected \`comments.blockComment\` to be an array of two strings.`);
            }
            else {
                result = result || {};
                result.blockComment = source.blockComment;
            }
        }
        return result;
    }
    static _extractValidBrackets(languageId, configuration) {
        const source = configuration.brackets;
        if (typeof source === 'undefined') {
            return undefined;
        }
        if (!Array.isArray(source)) {
            console.warn(`[${languageId}]: language configuration: expected \`brackets\` to be an array.`);
            return undefined;
        }
        let result = undefined;
        for (let i = 0, len = source.length; i < len; i++) {
            const pair = source[i];
            if (!isCharacterPair(pair)) {
                console.warn(`[${languageId}]: language configuration: expected \`brackets[${i}]\` to be an array of two strings.`);
                continue;
            }
            result = result || [];
            result.push(pair);
        }
        return result;
    }
    static _extractValidAutoClosingPairs(languageId, configuration) {
        const source = configuration.autoClosingPairs;
        if (typeof source === 'undefined') {
            return undefined;
        }
        if (!Array.isArray(source)) {
            console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs\` to be an array.`);
            return undefined;
        }
        let result = undefined;
        for (let i = 0, len = source.length; i < len; i++) {
            const pair = source[i];
            if (Array.isArray(pair)) {
                if (!isCharacterPair(pair)) {
                    console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}]\` to be an array of two strings or an object.`);
                    continue;
                }
                result = result || [];
                result.push({ open: pair[0], close: pair[1] });
            }
            else {
                if (!types.isObject(pair)) {
                    console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}]\` to be an array of two strings or an object.`);
                    continue;
                }
                if (typeof pair.open !== 'string') {
                    console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}].open\` to be a string.`);
                    continue;
                }
                if (typeof pair.close !== 'string') {
                    console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}].close\` to be a string.`);
                    continue;
                }
                if (typeof pair.notIn !== 'undefined') {
                    if (!isStringArr(pair.notIn)) {
                        console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}].notIn\` to be a string array.`);
                        continue;
                    }
                }
                result = result || [];
                result.push({ open: pair.open, close: pair.close, notIn: pair.notIn });
            }
        }
        return result;
    }
    static _extractValidSurroundingPairs(languageId, configuration) {
        const source = configuration.surroundingPairs;
        if (typeof source === 'undefined') {
            return undefined;
        }
        if (!Array.isArray(source)) {
            console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs\` to be an array.`);
            return undefined;
        }
        let result = undefined;
        for (let i = 0, len = source.length; i < len; i++) {
            const pair = source[i];
            if (Array.isArray(pair)) {
                if (!isCharacterPair(pair)) {
                    console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}]\` to be an array of two strings or an object.`);
                    continue;
                }
                result = result || [];
                result.push({ open: pair[0], close: pair[1] });
            }
            else {
                if (!types.isObject(pair)) {
                    console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}]\` to be an array of two strings or an object.`);
                    continue;
                }
                if (typeof pair.open !== 'string') {
                    console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}].open\` to be a string.`);
                    continue;
                }
                if (typeof pair.close !== 'string') {
                    console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}].close\` to be a string.`);
                    continue;
                }
                result = result || [];
                result.push({ open: pair.open, close: pair.close });
            }
        }
        return result;
    }
    static _extractValidColorizedBracketPairs(languageId, configuration) {
        const source = configuration.colorizedBracketPairs;
        if (typeof source === 'undefined') {
            return undefined;
        }
        if (!Array.isArray(source)) {
            console.warn(`[${languageId}]: language configuration: expected \`colorizedBracketPairs\` to be an array.`);
            return undefined;
        }
        const result = [];
        for (let i = 0, len = source.length; i < len; i++) {
            const pair = source[i];
            if (!isCharacterPair(pair)) {
                console.warn(`[${languageId}]: language configuration: expected \`colorizedBracketPairs[${i}]\` to be an array of two strings.`);
                continue;
            }
            result.push([pair[0], pair[1]]);
        }
        return result;
    }
    static _extractValidOnEnterRules(languageId, configuration) {
        const source = configuration.onEnterRules;
        if (typeof source === 'undefined') {
            return undefined;
        }
        if (!Array.isArray(source)) {
            console.warn(`[${languageId}]: language configuration: expected \`onEnterRules\` to be an array.`);
            return undefined;
        }
        let result = undefined;
        for (let i = 0, len = source.length; i < len; i++) {
            const onEnterRule = source[i];
            if (!types.isObject(onEnterRule)) {
                console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}]\` to be an object.`);
                continue;
            }
            if (!types.isObject(onEnterRule.action)) {
                console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action\` to be an object.`);
                continue;
            }
            let indentAction;
            if (onEnterRule.action.indent === 'none') {
                indentAction = IndentAction.None;
            }
            else if (onEnterRule.action.indent === 'indent') {
                indentAction = IndentAction.Indent;
            }
            else if (onEnterRule.action.indent === 'indentOutdent') {
                indentAction = IndentAction.IndentOutdent;
            }
            else if (onEnterRule.action.indent === 'outdent') {
                indentAction = IndentAction.Outdent;
            }
            else {
                console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action.indent\` to be 'none', 'indent', 'indentOutdent' or 'outdent'.`);
                continue;
            }
            const action = { indentAction };
            if (onEnterRule.action.appendText) {
                if (typeof onEnterRule.action.appendText === 'string') {
                    action.appendText = onEnterRule.action.appendText;
                }
                else {
                    console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action.appendText\` to be undefined or a string.`);
                }
            }
            if (onEnterRule.action.removeText) {
                if (typeof onEnterRule.action.removeText === 'number') {
                    action.removeText = onEnterRule.action.removeText;
                }
                else {
                    console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action.removeText\` to be undefined or a number.`);
                }
            }
            const beforeText = this._parseRegex(languageId, `onEnterRules[${i}].beforeText`, onEnterRule.beforeText);
            if (!beforeText) {
                continue;
            }
            const resultingOnEnterRule = { beforeText, action };
            if (onEnterRule.afterText) {
                const afterText = this._parseRegex(languageId, `onEnterRules[${i}].afterText`, onEnterRule.afterText);
                if (afterText) {
                    resultingOnEnterRule.afterText = afterText;
                }
            }
            if (onEnterRule.previousLineText) {
                const previousLineText = this._parseRegex(languageId, `onEnterRules[${i}].previousLineText`, onEnterRule.previousLineText);
                if (previousLineText) {
                    resultingOnEnterRule.previousLineText = previousLineText;
                }
            }
            result = result || [];
            result.push(resultingOnEnterRule);
        }
        return result;
    }
    static extractValidConfig(languageId, configuration) {
        const comments = this._extractValidCommentRule(languageId, configuration);
        const brackets = this._extractValidBrackets(languageId, configuration);
        const autoClosingPairs = this._extractValidAutoClosingPairs(languageId, configuration);
        const surroundingPairs = this._extractValidSurroundingPairs(languageId, configuration);
        const colorizedBracketPairs = this._extractValidColorizedBracketPairs(languageId, configuration);
        const autoCloseBefore = (typeof configuration.autoCloseBefore === 'string' ? configuration.autoCloseBefore : undefined);
        const wordPattern = (configuration.wordPattern ? this._parseRegex(languageId, `wordPattern`, configuration.wordPattern) : undefined);
        const indentationRules = (configuration.indentationRules ? this._mapIndentationRules(languageId, configuration.indentationRules) : undefined);
        let folding = undefined;
        if (configuration.folding) {
            const rawMarkers = configuration.folding.markers;
            const startMarker = (rawMarkers && rawMarkers.start ? this._parseRegex(languageId, `folding.markers.start`, rawMarkers.start) : undefined);
            const endMarker = (rawMarkers && rawMarkers.end ? this._parseRegex(languageId, `folding.markers.end`, rawMarkers.end) : undefined);
            const markers = (startMarker && endMarker ? { start: startMarker, end: endMarker } : undefined);
            folding = {
                offSide: configuration.folding.offSide,
                markers
            };
        }
        const onEnterRules = this._extractValidOnEnterRules(languageId, configuration);
        const richEditConfig = {
            comments,
            brackets,
            wordPattern,
            indentationRules,
            onEnterRules,
            autoClosingPairs,
            surroundingPairs,
            colorizedBracketPairs,
            autoCloseBefore,
            folding,
            __electricCharacterSupport: undefined,
        };
        return richEditConfig;
    }
    _handleConfig(languageId, configuration) {
        const richEditConfig = LanguageConfigurationFileHandler_1.extractValidConfig(languageId, configuration);
        this._languageConfigurationService.register(languageId, richEditConfig, 50);
    }
    static _parseRegex(languageId, confPath, value) {
        if (typeof value === 'string') {
            try {
                return new RegExp(value, '');
            }
            catch (err) {
                console.warn(`[${languageId}]: Invalid regular expression in \`${confPath}\`: `, err);
                return undefined;
            }
        }
        if (types.isObject(value)) {
            if (typeof value.pattern !== 'string') {
                console.warn(`[${languageId}]: language configuration: expected \`${confPath}.pattern\` to be a string.`);
                return undefined;
            }
            if (typeof value.flags !== 'undefined' && typeof value.flags !== 'string') {
                console.warn(`[${languageId}]: language configuration: expected \`${confPath}.flags\` to be a string.`);
                return undefined;
            }
            try {
                return new RegExp(value.pattern, value.flags);
            }
            catch (err) {
                console.warn(`[${languageId}]: Invalid regular expression in \`${confPath}\`: `, err);
                return undefined;
            }
        }
        console.warn(`[${languageId}]: language configuration: expected \`${confPath}\` to be a string or an object.`);
        return undefined;
    }
    static _mapIndentationRules(languageId, indentationRules) {
        const increaseIndentPattern = this._parseRegex(languageId, `indentationRules.increaseIndentPattern`, indentationRules.increaseIndentPattern);
        if (!increaseIndentPattern) {
            return undefined;
        }
        const decreaseIndentPattern = this._parseRegex(languageId, `indentationRules.decreaseIndentPattern`, indentationRules.decreaseIndentPattern);
        if (!decreaseIndentPattern) {
            return undefined;
        }
        const result = {
            increaseIndentPattern: increaseIndentPattern,
            decreaseIndentPattern: decreaseIndentPattern
        };
        if (indentationRules.indentNextLinePattern) {
            result.indentNextLinePattern = this._parseRegex(languageId, `indentationRules.indentNextLinePattern`, indentationRules.indentNextLinePattern);
        }
        if (indentationRules.unIndentedLinePattern) {
            result.unIndentedLinePattern = this._parseRegex(languageId, `indentationRules.unIndentedLinePattern`, indentationRules.unIndentedLinePattern);
        }
        return result;
    }
};
LanguageConfigurationFileHandler = LanguageConfigurationFileHandler_1 = __decorate([
    __param(0, ILanguageService),
    __param(1, IExtensionResourceLoaderService),
    __param(2, IExtensionService),
    __param(3, ILanguageConfigurationService)
], LanguageConfigurationFileHandler);
export { LanguageConfigurationFileHandler };
const schemaId = 'vscode://schemas/language-configuration';
const schema = {
    allowComments: true,
    allowTrailingCommas: true,
    default: {
        comments: {
            blockComment: ['/*', '*/'],
            lineComment: '//'
        },
        brackets: [['(', ')'], ['[', ']'], ['{', '}']],
        autoClosingPairs: [['(', ')'], ['[', ']'], ['{', '}']],
        surroundingPairs: [['(', ')'], ['[', ']'], ['{', '}']]
    },
    definitions: {
        openBracket: {
            type: 'string',
            description: nls.localize('schema.openBracket', 'The opening bracket character or string sequence.')
        },
        closeBracket: {
            type: 'string',
            description: nls.localize('schema.closeBracket', 'The closing bracket character or string sequence.')
        },
        bracketPair: {
            type: 'array',
            items: [{
                    $ref: '#/definitions/openBracket'
                }, {
                    $ref: '#/definitions/closeBracket'
                }]
        }
    },
    properties: {
        comments: {
            default: {
                blockComment: ['/*', '*/'],
                lineComment: { comment: '//', noIndent: false }
            },
            description: nls.localize('schema.comments', 'Defines the comment symbols'),
            type: 'object',
            properties: {
                blockComment: {
                    type: 'array',
                    description: nls.localize('schema.blockComments', 'Defines how block comments are marked.'),
                    items: [{
                            type: 'string',
                            description: nls.localize('schema.blockComment.begin', 'The character sequence that starts a block comment.')
                        }, {
                            type: 'string',
                            description: nls.localize('schema.blockComment.end', 'The character sequence that ends a block comment.')
                        }]
                },
                lineComment: {
                    type: 'object',
                    description: nls.localize('schema.lineComment.object', 'Configuration for line comments.'),
                    properties: {
                        comment: {
                            type: 'string',
                            description: nls.localize('schema.lineComment.comment', 'The character sequence that starts a line comment.')
                        },
                        noIndent: {
                            type: 'boolean',
                            description: nls.localize('schema.lineComment.noIndent', 'Whether the comment token should not be indented and placed at the first column. Defaults to false.'),
                            default: false
                        }
                    },
                    required: ['comment'],
                    additionalProperties: false
                }
            }
        },
        brackets: {
            default: [['(', ')'], ['[', ']'], ['{', '}']],
            markdownDescription: nls.localize('schema.brackets', 'Defines the bracket symbols that increase or decrease the indentation. When bracket pair colorization is enabled and {0} is not defined, this also defines the bracket pairs that are colorized by their nesting level.', '\`colorizedBracketPairs\`'),
            type: 'array',
            items: {
                $ref: '#/definitions/bracketPair'
            }
        },
        colorizedBracketPairs: {
            default: [['(', ')'], ['[', ']'], ['{', '}']],
            markdownDescription: nls.localize('schema.colorizedBracketPairs', 'Defines the bracket pairs that are colorized by their nesting level if bracket pair colorization is enabled. Any brackets included here that are not included in {0} will be automatically included in {0}.', '\`brackets\`'),
            type: 'array',
            items: {
                $ref: '#/definitions/bracketPair'
            }
        },
        autoClosingPairs: {
            default: [['(', ')'], ['[', ']'], ['{', '}']],
            description: nls.localize('schema.autoClosingPairs', 'Defines the bracket pairs. When a opening bracket is entered, the closing bracket is inserted automatically.'),
            type: 'array',
            items: {
                oneOf: [{
                        $ref: '#/definitions/bracketPair'
                    }, {
                        type: 'object',
                        properties: {
                            open: {
                                $ref: '#/definitions/openBracket'
                            },
                            close: {
                                $ref: '#/definitions/closeBracket'
                            },
                            notIn: {
                                type: 'array',
                                description: nls.localize('schema.autoClosingPairs.notIn', 'Defines a list of scopes where the auto pairs are disabled.'),
                                items: {
                                    enum: ['string', 'comment']
                                }
                            }
                        }
                    }]
            }
        },
        autoCloseBefore: {
            default: ';:.,=}])> \n\t',
            description: nls.localize('schema.autoCloseBefore', 'Defines what characters must be after the cursor in order for bracket or quote autoclosing to occur when using the \'languageDefined\' autoclosing setting. This is typically the set of characters which can not start an expression.'),
            type: 'string',
        },
        surroundingPairs: {
            default: [['(', ')'], ['[', ']'], ['{', '}']],
            description: nls.localize('schema.surroundingPairs', 'Defines the bracket pairs that can be used to surround a selected string.'),
            type: 'array',
            items: {
                oneOf: [{
                        $ref: '#/definitions/bracketPair'
                    }, {
                        type: 'object',
                        properties: {
                            open: {
                                $ref: '#/definitions/openBracket'
                            },
                            close: {
                                $ref: '#/definitions/closeBracket'
                            }
                        }
                    }]
            }
        },
        wordPattern: {
            default: '',
            description: nls.localize('schema.wordPattern', 'Defines what is considered to be a word in the programming language.'),
            type: ['string', 'object'],
            properties: {
                pattern: {
                    type: 'string',
                    description: nls.localize('schema.wordPattern.pattern', 'The RegExp pattern used to match words.'),
                    default: '',
                },
                flags: {
                    type: 'string',
                    description: nls.localize('schema.wordPattern.flags', 'The RegExp flags used to match words.'),
                    default: 'g',
                    pattern: '^([gimuy]+)$',
                    patternErrorMessage: nls.localize('schema.wordPattern.flags.errorMessage', 'Must match the pattern `/^([gimuy]+)$/`.')
                }
            }
        },
        indentationRules: {
            default: {
                increaseIndentPattern: '',
                decreaseIndentPattern: ''
            },
            description: nls.localize('schema.indentationRules', 'The language\'s indentation settings.'),
            type: 'object',
            properties: {
                increaseIndentPattern: {
                    type: ['string', 'object'],
                    description: nls.localize('schema.indentationRules.increaseIndentPattern', 'If a line matches this pattern, then all the lines after it should be indented once (until another rule matches).'),
                    properties: {
                        pattern: {
                            type: 'string',
                            description: nls.localize('schema.indentationRules.increaseIndentPattern.pattern', 'The RegExp pattern for increaseIndentPattern.'),
                            default: '',
                        },
                        flags: {
                            type: 'string',
                            description: nls.localize('schema.indentationRules.increaseIndentPattern.flags', 'The RegExp flags for increaseIndentPattern.'),
                            default: '',
                            pattern: '^([gimuy]+)$',
                            patternErrorMessage: nls.localize('schema.indentationRules.increaseIndentPattern.errorMessage', 'Must match the pattern `/^([gimuy]+)$/`.')
                        }
                    }
                },
                decreaseIndentPattern: {
                    type: ['string', 'object'],
                    description: nls.localize('schema.indentationRules.decreaseIndentPattern', 'If a line matches this pattern, then all the lines after it should be unindented once (until another rule matches).'),
                    properties: {
                        pattern: {
                            type: 'string',
                            description: nls.localize('schema.indentationRules.decreaseIndentPattern.pattern', 'The RegExp pattern for decreaseIndentPattern.'),
                            default: '',
                        },
                        flags: {
                            type: 'string',
                            description: nls.localize('schema.indentationRules.decreaseIndentPattern.flags', 'The RegExp flags for decreaseIndentPattern.'),
                            default: '',
                            pattern: '^([gimuy]+)$',
                            patternErrorMessage: nls.localize('schema.indentationRules.decreaseIndentPattern.errorMessage', 'Must match the pattern `/^([gimuy]+)$/`.')
                        }
                    }
                },
                indentNextLinePattern: {
                    type: ['string', 'object'],
                    description: nls.localize('schema.indentationRules.indentNextLinePattern', 'If a line matches this pattern, then **only the next line** after it should be indented once.'),
                    properties: {
                        pattern: {
                            type: 'string',
                            description: nls.localize('schema.indentationRules.indentNextLinePattern.pattern', 'The RegExp pattern for indentNextLinePattern.'),
                            default: '',
                        },
                        flags: {
                            type: 'string',
                            description: nls.localize('schema.indentationRules.indentNextLinePattern.flags', 'The RegExp flags for indentNextLinePattern.'),
                            default: '',
                            pattern: '^([gimuy]+)$',
                            patternErrorMessage: nls.localize('schema.indentationRules.indentNextLinePattern.errorMessage', 'Must match the pattern `/^([gimuy]+)$/`.')
                        }
                    }
                },
                unIndentedLinePattern: {
                    type: ['string', 'object'],
                    description: nls.localize('schema.indentationRules.unIndentedLinePattern', 'If a line matches this pattern, then its indentation should not be changed and it should not be evaluated against the other rules.'),
                    properties: {
                        pattern: {
                            type: 'string',
                            description: nls.localize('schema.indentationRules.unIndentedLinePattern.pattern', 'The RegExp pattern for unIndentedLinePattern.'),
                            default: '',
                        },
                        flags: {
                            type: 'string',
                            description: nls.localize('schema.indentationRules.unIndentedLinePattern.flags', 'The RegExp flags for unIndentedLinePattern.'),
                            default: '',
                            pattern: '^([gimuy]+)$',
                            patternErrorMessage: nls.localize('schema.indentationRules.unIndentedLinePattern.errorMessage', 'Must match the pattern `/^([gimuy]+)$/`.')
                        }
                    }
                }
            }
        },
        folding: {
            type: 'object',
            description: nls.localize('schema.folding', 'The language\'s folding settings.'),
            properties: {
                offSide: {
                    type: 'boolean',
                    description: nls.localize('schema.folding.offSide', 'A language adheres to the off-side rule if blocks in that language are expressed by their indentation. If set, empty lines belong to the subsequent block.'),
                },
                markers: {
                    type: 'object',
                    description: nls.localize('schema.folding.markers', 'Language specific folding markers such as \'#region\' and \'#endregion\'. The start and end regexes will be tested against the contents of all lines and must be designed efficiently'),
                    properties: {
                        start: {
                            type: 'string',
                            description: nls.localize('schema.folding.markers.start', 'The RegExp pattern for the start marker. The regexp must start with \'^\'.')
                        },
                        end: {
                            type: 'string',
                            description: nls.localize('schema.folding.markers.end', 'The RegExp pattern for the end marker. The regexp must start with \'^\'.')
                        },
                    }
                }
            }
        },
        onEnterRules: {
            type: 'array',
            description: nls.localize('schema.onEnterRules', 'The language\'s rules to be evaluated when pressing Enter.'),
            items: {
                type: 'object',
                description: nls.localize('schema.onEnterRules', 'The language\'s rules to be evaluated when pressing Enter.'),
                required: ['beforeText', 'action'],
                properties: {
                    beforeText: {
                        type: ['string', 'object'],
                        description: nls.localize('schema.onEnterRules.beforeText', 'This rule will only execute if the text before the cursor matches this regular expression.'),
                        properties: {
                            pattern: {
                                type: 'string',
                                description: nls.localize('schema.onEnterRules.beforeText.pattern', 'The RegExp pattern for beforeText.'),
                                default: '',
                            },
                            flags: {
                                type: 'string',
                                description: nls.localize('schema.onEnterRules.beforeText.flags', 'The RegExp flags for beforeText.'),
                                default: '',
                                pattern: '^([gimuy]+)$',
                                patternErrorMessage: nls.localize('schema.onEnterRules.beforeText.errorMessage', 'Must match the pattern `/^([gimuy]+)$/`.')
                            }
                        }
                    },
                    afterText: {
                        type: ['string', 'object'],
                        description: nls.localize('schema.onEnterRules.afterText', 'This rule will only execute if the text after the cursor matches this regular expression.'),
                        properties: {
                            pattern: {
                                type: 'string',
                                description: nls.localize('schema.onEnterRules.afterText.pattern', 'The RegExp pattern for afterText.'),
                                default: '',
                            },
                            flags: {
                                type: 'string',
                                description: nls.localize('schema.onEnterRules.afterText.flags', 'The RegExp flags for afterText.'),
                                default: '',
                                pattern: '^([gimuy]+)$',
                                patternErrorMessage: nls.localize('schema.onEnterRules.afterText.errorMessage', 'Must match the pattern `/^([gimuy]+)$/`.')
                            }
                        }
                    },
                    previousLineText: {
                        type: ['string', 'object'],
                        description: nls.localize('schema.onEnterRules.previousLineText', 'This rule will only execute if the text above the line matches this regular expression.'),
                        properties: {
                            pattern: {
                                type: 'string',
                                description: nls.localize('schema.onEnterRules.previousLineText.pattern', 'The RegExp pattern for previousLineText.'),
                                default: '',
                            },
                            flags: {
                                type: 'string',
                                description: nls.localize('schema.onEnterRules.previousLineText.flags', 'The RegExp flags for previousLineText.'),
                                default: '',
                                pattern: '^([gimuy]+)$',
                                patternErrorMessage: nls.localize('schema.onEnterRules.previousLineText.errorMessage', 'Must match the pattern `/^([gimuy]+)$/`.')
                            }
                        }
                    },
                    action: {
                        type: ['string', 'object'],
                        description: nls.localize('schema.onEnterRules.action', 'The action to execute.'),
                        required: ['indent'],
                        default: { 'indent': 'indent' },
                        properties: {
                            indent: {
                                type: 'string',
                                description: nls.localize('schema.onEnterRules.action.indent', "Describe what to do with the indentation"),
                                default: 'indent',
                                enum: ['none', 'indent', 'indentOutdent', 'outdent'],
                                markdownEnumDescriptions: [
                                    nls.localize('schema.onEnterRules.action.indent.none', "Insert new line and copy the previous line's indentation."),
                                    nls.localize('schema.onEnterRules.action.indent.indent', "Insert new line and indent once (relative to the previous line's indentation)."),
                                    nls.localize('schema.onEnterRules.action.indent.indentOutdent', "Insert two new lines:\n - the first one indented which will hold the cursor\n - the second one at the same indentation level"),
                                    nls.localize('schema.onEnterRules.action.indent.outdent', "Insert new line and outdent once (relative to the previous line's indentation).")
                                ]
                            },
                            appendText: {
                                type: 'string',
                                description: nls.localize('schema.onEnterRules.action.appendText', 'Describes text to be appended after the new line and after the indentation.'),
                                default: '',
                            },
                            removeText: {
                                type: 'number',
                                description: nls.localize('schema.onEnterRules.action.removeText', 'Describes the number of characters to remove from the new line\'s indentation.'),
                                default: 0,
                            }
                        }
                    }
                }
            }
        }
    }
};
const schemaRegistry = Registry.as(Extensions.JSONContribution);
schemaRegistry.registerSchema(schemaId, schema);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFuZ3VhZ2VDb25maWd1cmF0aW9uRXh0ZW5zaW9uUG9pbnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY29kZUVkaXRvci9jb21tb24vbGFuZ3VhZ2VDb25maWd1cmF0aW9uRXh0ZW5zaW9uUG9pbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFjLEtBQUssRUFBRSxXQUFXLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUVqRixPQUFPLEtBQUssS0FBSyxNQUFNLGtDQUFrQyxDQUFDO0FBRTFELE9BQU8sRUFBdUosWUFBWSxFQUFnQyxNQUFNLDhEQUE4RCxDQUFDO0FBQy9RLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHNFQUFzRSxDQUFDO0FBQ3JILE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxVQUFVLEVBQTZCLE1BQU0scUVBQXFFLENBQUM7QUFDNUgsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzVFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSwrQkFBK0IsRUFBRSxNQUFNLGdGQUFnRixDQUFDO0FBQ2pJLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFpRGxFLFNBQVMsV0FBVyxDQUFDLFNBQTBCO0lBQzlDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENB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