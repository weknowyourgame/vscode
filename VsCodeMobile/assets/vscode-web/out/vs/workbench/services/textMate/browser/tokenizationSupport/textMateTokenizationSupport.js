/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { StopWatch } from '../../../../../base/common/stopwatch.js';
import { TokenMetadata } from '../../../../../editor/common/encodedTokenAttributes.js';
import { EncodedTokenizationResult } from '../../../../../editor/common/languages.js';
export class TextMateTokenizationSupport extends Disposable {
    get onDidEncounterLanguage() { return this._onDidEncounterLanguage.event; }
    constructor(_grammar, _initialState, _containsEmbeddedLanguages, _createBackgroundTokenizer, _backgroundTokenizerShouldOnlyVerifyTokens, _reportTokenizationTime, _reportSlowTokenization) {
        super();
        this._grammar = _grammar;
        this._initialState = _initialState;
        this._containsEmbeddedLanguages = _containsEmbeddedLanguages;
        this._createBackgroundTokenizer = _createBackgroundTokenizer;
        this._backgroundTokenizerShouldOnlyVerifyTokens = _backgroundTokenizerShouldOnlyVerifyTokens;
        this._reportTokenizationTime = _reportTokenizationTime;
        this._reportSlowTokenization = _reportSlowTokenization;
        this._seenLanguages = [];
        this._onDidEncounterLanguage = this._register(new Emitter());
    }
    get backgroundTokenizerShouldOnlyVerifyTokens() {
        return this._backgroundTokenizerShouldOnlyVerifyTokens();
    }
    getInitialState() {
        return this._initialState;
    }
    tokenize(line, hasEOL, state) {
        throw new Error('Not supported!');
    }
    createBackgroundTokenizer(textModel, store) {
        if (this._createBackgroundTokenizer) {
            return this._createBackgroundTokenizer(textModel, store);
        }
        return undefined;
    }
    tokenizeEncoded(line, hasEOL, state) {
        const isRandomSample = Math.random() * 10_000 < 1;
        const shouldMeasure = this._reportSlowTokenization || isRandomSample;
        const sw = shouldMeasure ? new StopWatch(true) : undefined;
        const textMateResult = this._grammar.tokenizeLine2(line, state, 500);
        if (shouldMeasure) {
            const timeMS = sw.elapsed();
            if (isRandomSample || timeMS > 32) {
                this._reportTokenizationTime(timeMS, line.length, isRandomSample);
            }
        }
        if (textMateResult.stoppedEarly) {
            console.warn(`Time limit reached when tokenizing line: ${line.substring(0, 100)}`);
            // return the state at the beginning of the line
            return new EncodedTokenizationResult(textMateResult.tokens, state);
        }
        if (this._containsEmbeddedLanguages) {
            const seenLanguages = this._seenLanguages;
            const tokens = textMateResult.tokens;
            // Must check if any of the embedded languages was hit
            for (let i = 0, len = (tokens.length >>> 1); i < len; i++) {
                const metadata = tokens[(i << 1) + 1];
                const languageId = TokenMetadata.getLanguageId(metadata);
                if (!seenLanguages[languageId]) {
                    seenLanguages[languageId] = true;
                    this._onDidEncounterLanguage.fire(languageId);
                }
            }
        }
        let endState;
        // try to save an object if possible
        if (state.equals(textMateResult.ruleStack)) {
            endState = state;
        }
        else {
            endState = textMateResult.ruleStack;
        }
        return new EncodedTokenizationResult(textMateResult.tokens, endState);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dE1hdGVUb2tlbml6YXRpb25TdXBwb3J0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy90ZXh0TWF0ZS9icm93c2VyL3Rva2VuaXphdGlvblN1cHBvcnQvdGV4dE1hdGVUb2tlbml6YXRpb25TdXBwb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxxQ0FBcUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BFLE9BQU8sRUFBYyxhQUFhLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUNuRyxPQUFPLEVBQUUseUJBQXlCLEVBQXdHLE1BQU0sMkNBQTJDLENBQUM7QUFJNUwsTUFBTSxPQUFPLDJCQUE0QixTQUFRLFVBQVU7SUFHMUQsSUFBVyxzQkFBc0IsS0FBd0IsT0FBTyxJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUVyRyxZQUNrQixRQUFrQixFQUNsQixhQUF5QixFQUN6QiwwQkFBbUMsRUFDbkMsMEJBQStJLEVBQy9JLDBDQUF5RCxFQUN6RCx1QkFBOEYsRUFDOUYsdUJBQWdDO1FBRWpELEtBQUssRUFBRSxDQUFDO1FBUlMsYUFBUSxHQUFSLFFBQVEsQ0FBVTtRQUNsQixrQkFBYSxHQUFiLGFBQWEsQ0FBWTtRQUN6QiwrQkFBMEIsR0FBMUIsMEJBQTBCLENBQVM7UUFDbkMsK0JBQTBCLEdBQTFCLDBCQUEwQixDQUFxSDtRQUMvSSwrQ0FBMEMsR0FBMUMsMENBQTBDLENBQWU7UUFDekQsNEJBQXVCLEdBQXZCLHVCQUF1QixDQUF1RTtRQUM5Riw0QkFBdUIsR0FBdkIsdUJBQXVCLENBQVM7UUFYakMsbUJBQWMs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