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
var TokenizationTextModelPart_1;
import { BugIndicatingError } from '../../../../base/common/errors.js';
import { Emitter } from '../../../../base/common/event.js';
import { countEOL } from '../../core/misc/eolCounter.js';
import { Position } from '../../core/position.js';
import { getWordAtText } from '../../core/wordHelper.js';
import { ILanguageService } from '../../languages/language.js';
import { ILanguageConfigurationService } from '../../languages/languageConfigurationRegistry.js';
import { TextModelPart } from '../textModelPart.js';
import { TreeSitterSyntaxTokenBackend } from './treeSitter/treeSitterSyntaxTokenBackend.js';
import { SparseTokensStore } from '../../tokens/sparseTokensStore.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { TokenizerSyntaxTokenBackend } from './tokenizerSyntaxTokenBackend.js';
import { ITreeSitterLibraryService } from '../../services/treeSitter/treeSitterLibraryService.js';
import { derived, observableValue } from '../../../../base/common/observable.js';
let TokenizationTextModelPart = TokenizationTextModelPart_1 = class TokenizationTextModelPart extends TextModelPart {
    constructor(_textModel, _bracketPairsTextModelPart, _languageId, _attachedViews, _languageService, _languageConfigurationService, _instantiationService, _treeSitterLibraryService) {
        super();
        this._textModel = _textModel;
        this._bracketPairsTextModelPart = _bracketPairsTextModelPart;
        this._languageId = _languageId;
        this._attachedViews = _attachedViews;
        this._languageService = _languageService;
        this._languageConfigurationService = _languageConfigurationService;
        this._instantiationService = _instantiationService;
        this._treeSitterLibraryService = _treeSitterLibraryService;
        this._languageIdObs = observableValue(this, this._languageId);
        this._useTreeSitter = derived(this, reader => {
            const languageId = this._languageIdObs.read(reader);
            return this._treeSitterLibraryService.supportsLanguage(languageId, reader);
        });
        this.tokens = derived(this, reader => {
            let tokens;
            if (this._useTreeSitter.read(reader)) {
                tokens = reader.store.add(this._instantiationService.createInstance(TreeSitterSyntaxTokenBackend, this._languageIdObs, this._languageService.languageIdCodec, this._textModel, this._attachedViews.visibleLineRanges));
            }
            else {
                tokens = reader.store.add(new TokenizerSyntaxTokenBackend(this._languageService.languageIdCodec, this._textModel, () => this._languageId, this._attachedViews));
            }
            reader.store.add(tokens.onDidChangeTokens(e => {
                this._emitModelTokensChangedEvent(e);
            }));
            reader.store.add(tokens.onDidChangeBackgroundTokenizationState(e => {
                this._bracketPairsTextModelPart.handleDidChangeBackgroundTokenizationState();
            }));
            return tokens;
        });
        let hadTokens = false;
        this.tokens.recomputeInitiallyAndOnChange(this._store, value => {
            if (hadTokens) {
                // We need to reset the tokenization, as the new token provider otherwise won't have a chance to provide tokens until some action happens in the editor.
                // TODO@hediet: Look into why this is needed.
                value.todo_resetTokenization();
            }
            hadTokens = true;
        });
        this._semanticTokens = new SparseTokensStore(this._languageService.languageIdCodec);
        this._onDidChangeLanguage = this._register(new Emitter());
        this.onDidChangeLanguage = this._onDidChangeLanguage.event;
        this._onDidChangeLanguageConfiguration = this._register(new Emitter());
        this.onDidChangeLanguageConfiguration = this._onDidChangeLanguageConfiguration.event;
        this._onDidChangeTokens = this._register(new Emitter());
        this.onDidChangeTokens = this._onDidChangeTokens.event;
    }
    _hasListeners() {
        return (this._onDidChangeLanguage.hasListeners()
            || this._onDidChangeLanguageConfiguration.hasListeners()
            || this._onDidChangeTokens.hasListeners());
    }
    handleLanguageConfigurationServiceChange(e) {
        if (e.affects(this._languageId)) {
            this._onDidChangeLanguageConfiguration.fire({});
        }
    }
    handleDidChangeContent(e) {
        if (e.isFlush) {
            this._semanticTokens.flush();
        }
        else if (!e.isEolChange) { // We don't have to do anything on an EOL change
            for (const c of e.changes) {
                const [eolCount, firstLineLength, lastLineLength] = countEOL(c.text);
                this._semanticTokens.acceptEdit(c.range, eolCount, firstLineLength, lastLineLength, c.text.length > 0 ? c.text.charCodeAt(0) : 0 /* CharCode.Null */);
            }
        }
        this.tokens.get().handleDidChangeContent(e);
    }
    handleDidChangeAttached() {
        this.tokens.get().handleDidChangeAttached();
    }
    /**
     * Includes grammar and semantic tokens.
     */
    getLineTokens(lineNumber) {
        this.validateLineNumber(lineNumber);
        const syntacticTokens = this.tokens.get().getLineTokens(lineNumber);
        return this._semanticTokens.addSparseTokens(lineNumber, syntacticTokens);
    }
    _emitModelTokensChangedEvent(e) {
        if (!this._textModel._isDisposing()) {
            this._bracketPairsTextModelPart.handleDidChangeTokens(e);
            this._onDidChangeTokens.fire(e);
        }
    }
    // #region Grammar Tokens
    validateLineNumber(lineNumber) {
        if (lineNumber < 1 || lineNumber > this._textModel.getLineCount()) {
            throw new BugIndicatingError('Illegal value for lineNumber');
        }
    }
    get hasTokens() {
        return this.tokens.get().hasTokens;
    }
    resetTokenization() {
        this.tokens.get().todo_resetTokenization();
    }
    get backgroundTokenizationState() {
        return this.tokens.get().backgroundTokenizationState;
    }
    forceTokenization(lineNumber) {
        this.validateLineNumber(lineNumber);
        this.tokens.get().forceTokenization(lineNumber);
    }
    hasAccurateTokensForLine(lineNumber) {
        this.validateLineNumber(lineNumber);
        return this.tokens.get().hasAccurateTokensForLine(lineNumber);
    }
    isCheapToTokenize(lineNumber) {
        this.validateLineNumber(lineNumber);
        return this.tokens.get().isCheapToTokenize(lineNumber);
    }
    tokenizeIfCheap(lineNumber) {
        this.validateLineNumber(lineNumber);
        this.tokens.get().tokenizeIfCheap(lineNumber);
    }
    getTokenTypeIfInsertingCharacter(lineNumber, column, character) {
        return this.tokens.get().getTokenTypeIfInsertingCharacter(lineNumber, column, character);
    }
    tokenizeLinesAt(lineNumber, lines) {
        return this.tokens.get().tokenizeLinesAt(lineNumber, lines);
    }
    // #endregion
    // #region Semantic Tokens
    setSemanticTokens(tokens, isComplete) {
        this._semanticTokens.set(tokens, isComplete, this._textModel);
        this._emitModelTokensChangedEvent({
            semanticTokensApplied: tokens !== null,
            ranges: [{ fromLineNumber: 1, toLineNumber: this._textModel.getLineCount() }],
        });
    }
    hasCompleteSemanticTokens() {
        return this._semanticTokens.isComplete();
    }
    hasSomeSemanticTokens() {
        return !this._semanticTokens.isEmpty();
    }
    setPartialSemanticTokens(range, tokens) {
        if (this.hasCompleteSemanticTokens()) {
            return;
        }
        const changedRange = this._textModel.validateRange(this._semanticTokens.setPartial(range, tokens));
        this._emitModelTokensChangedEvent({
            semanticTokensApplied: true,
            ranges: [
                {
                    fromLineNumber: changedRange.startLineNumber,
                    toLineNumber: changedRange.endLineNumber,
                },
            ],
        });
    }
    // #endregion
    // #region Utility Methods
    getWordAtPosition(_position) {
        this.assertNotDisposed();
        const position = this._textModel.validatePosition(_position);
        const lineContent = this._textModel.getLineContent(position.lineNumber);
        const lineTokens = this.getLineTokens(position.lineNumber);
        const tokenIndex = lineTokens.findTokenIndexAtOffset(position.column - 1);
        // (1). First try checking right biased word
        const [rbStartOffset, rbEndOffset] = TokenizationTextModelPart_1._findLanguageBoundaries(lineTokens, tokenIndex);
        const rightBiasedWord = getWordAtText(position.column, this.getLanguageConfiguration(lineTokens.getLanguageId(tokenIndex)).getWordDefinition(), lineContent.substring(rbStartOffset, rbEndOffset), rbStartOffset);
        // Make sure the result touches the original passed in position
        if (rightBiasedWord &&
            rightBiasedWord.startColumn <= _position.column &&
            _position.column <= rightBiasedWord.endColumn) {
            return rightBiasedWord;
        }
        // (2). Else, if we were at a language boundary, check the left biased word
        if (tokenIndex > 0 && rbStartOffset === position.column - 1) {
            // edge case, where `position` sits between two tokens belonging to two different languages
            const [lbStartOffset, lbEndOffset] = TokenizationTextModelPart_1._findLanguageBoundaries(lineTokens, tokenIndex - 1);
            const leftBiasedWord = getWordAtText(position.column, this.getLanguageConfiguration(lineTokens.getLanguageId(tokenIndex - 1)).getWordDefinition(), lineContent.substring(lbStartOffset, lbEndOffset), lbStartOffset);
            // Make sure the result touches the original passed in position
            if (leftBiasedWord &&
                leftBiasedWord.startColumn <= _position.column &&
                _position.column <= leftBiasedWord.endColumn) {
                return leftBiasedWord;
            }
        }
        return null;
    }
    getLanguageConfiguration(languageId) {
        return this._languageConfigurationService.getLanguageConfiguration(languageId);
    }
    static _findLanguageBoundaries(lineTokens, tokenIndex) {
        const languageId = lineTokens.getLanguageId(tokenIndex);
        // go left until a different language is hit
        let startOffset = 0;
        for (let i = tokenIndex; i >= 0 && lineTokens.getLanguageId(i) === languageId; i--) {
            startOffset = lineTokens.getStartOffset(i);
        }
        // go right until a different language is hit
        let endOffset = lineTokens.getLineContent().length;
        for (let i = tokenIndex, tokenCount = lineTokens.getCount(); i < tokenCount && lineTokens.getLanguageId(i) === languageId; i++) {
            endOffset = lineTokens.getEndOffset(i);
        }
        return [startOffset, endOffset];
    }
    getWordUntilPosition(position) {
        const wordAtPosition = this.getWordAtPosition(position);
        if (!wordAtPosition) {
            return { word: '', startColumn: position.column, endColumn: position.column, };
        }
        return {
            word: wordAtPosition.word.substr(0, position.column - wordAtPosition.startColumn),
            startColumn: wordAtPosition.startColumn,
            endColumn: position.column,
        };
    }
    // #endregion
    // #region Language Id handling
    getLanguageId() {
        return this._languageId;
    }
    getLanguageIdAtPosition(lineNumber, column) {
        const position = this._textModel.validatePosition(new Position(lineNumber, column));
        const lineTokens = this.getLineTokens(position.lineNumber);
        return lineTokens.getLanguageId(lineTokens.findTokenIndexAtOffset(position.column - 1));
    }
    setLanguageId(languageId, source = 'api') {
        if (this._languageId === languageId) {
            // There's nothing to do
            return;
        }
        const e = {
            oldLanguage: this._languageId,
            newLanguage: languageId,
            source
        };
        this._languageId = languageId;
        this._languageIdObs.set(languageId, undefined);
        this._bracketPairsTextModelPart.handleDidChangeLanguage(e);
        this._onDidChangeLanguage.fire(e);
        this._onDidChangeLanguageConfiguration.fire({});
    }
};
TokenizationTextModelPart = TokenizationTextModelPart_1 = __decorate([
    __param(4, ILanguageService),
    __param(5, ILanguageConfigurationService),
    __param(6, IInstantiationService),
    __param(7, ITreeSitterLibraryService)
], TokenizationTextModelPart);
export { TokenizationTextModelPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9rZW5pemF0aW9uVGV4dE1vZGVsUGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL21vZGVsL3Rva2Vucy90b2tlbml6YXRpb25UZXh0TW9kZWxQYXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3pELE9BQU8sRUFBYSxRQUFRLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUU3RCxPQUFPLEVBQW1CLGFBQWEsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBRTFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQy9ELE9BQU8sRUFBRSw2QkFBNkIsRUFBMEUsTUFBTSxrREFBa0QsQ0FBQztBQUd6SyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFFcEQsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFLNUYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdEUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDL0UsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDbEcsT0FBTyxFQUFFLE9BQU8sRUFBb0MsZUFBZSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFNUcsSUFBTSx5QkFBeUIsaUNBQS9CLE1BQU0seUJBQTBCLFNBQVEsYUFBYTtJQWdC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