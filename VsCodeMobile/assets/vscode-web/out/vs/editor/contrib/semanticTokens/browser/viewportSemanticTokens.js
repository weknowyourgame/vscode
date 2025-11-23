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
var ViewportSemanticTokensContribution_1;
import { createCancelablePromise, RunOnceScheduler } from '../../../../base/common/async.js';
import { Disposable, dispose } from '../../../../base/common/lifecycle.js';
import { registerEditorContribution } from '../../../browser/editorExtensions.js';
import { getDocumentRangeSemanticTokens, hasDocumentRangeSemanticTokensProvider } from '../common/getSemanticTokens.js';
import { isSemanticColoringEnabled, SEMANTIC_HIGHLIGHTING_SETTING_ID } from '../common/semanticTokensConfig.js';
import { toMultilineTokens2 } from '../../../common/services/semanticTokensProviderStyling.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ILanguageFeatureDebounceService } from '../../../common/services/languageFeatureDebounce.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';
import { ILanguageFeaturesService } from '../../../common/services/languageFeatures.js';
import { ISemanticTokensStylingService } from '../../../common/services/semanticTokensStyling.js';
let ViewportSemanticTokensContribution = class ViewportSemanticTokensContribution extends Disposable {
    static { ViewportSemanticTokensContribution_1 = this; }
    static { this.ID = 'editor.contrib.viewportSemanticTokens'; }
    static get(editor) {
        return editor.getContribution(ViewportSemanticTokensContribution_1.ID);
    }
    constructor(editor, _semanticTokensStylingService, _themeService, _configurationService, languageFeatureDebounceService, languageFeaturesService) {
        super();
        this._semanticTokensStylingService = _semanticTokensStylingService;
        this._themeService = _themeService;
        this._configurationService = _configurationService;
        this._editor = editor;
        this._provider = languageFeaturesService.documentRangeSemanticTokensProvider;
        this._debounceInformation = languageFeatureDebounceService.for(this._provider, 'DocumentRangeSemanticTokens', { min: 100, max: 500 });
        this._tokenizeViewport = this._register(new RunOnceScheduler(() => this._tokenizeViewportNow(), 100));
        this._outstandingRequests = [];
        this._rangeProvidersChangeListeners = [];
        const scheduleTokenizeViewport = () => {
            if (this._editor.hasModel()) {
                this._tokenizeViewport.schedule(this._debounceInformation.get(this._editor.getModel()));
            }
        };
        const bindRangeProvidersChangeListeners = () => {
            this._cleanupProviderListeners();
            if (this._editor.hasModel()) {
                const model = this._editor.getModel();
                for (const provider of this._provider.all(model)) {
                    const disposable = provider.onDidChange?.(() => {
                        this._cancelAll();
                        scheduleTokenizeViewport();
                    });
                    if (disposable) {
                        this._rangeProvidersChangeListeners.push(disposable);
                    }
                }
            }
        };
        this._register(this._editor.onDidScrollChange(() => {
            scheduleTokenizeViewport();
        }));
        this._register(this._editor.onDidChangeModel(() => {
            bindRangeProvidersChangeListeners();
            this._cancelAll();
            scheduleTokenizeViewport();
        }));
        this._register(this._editor.onDidChangeModelLanguage(() => {
            // The cleanup of the model's semantic tokens happens in the DocumentSemanticTokensFeature
            bindRangeProvidersChangeListeners();
            this._cancelAll();
            scheduleTokenizeViewport();
        }));
        this._register(this._editor.onDidChangeModelContent((e) => {
            this._cancelAll();
            scheduleTokenizeViewport();
        }));
        bindRangeProvidersChangeListeners();
        this._register(this._provider.onDidChange(() => {
            bindRangeProvidersChangeListeners();
            this._cancelAll();
            scheduleTokenizeViewport();
        }));
        this._register(this._configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(SEMANTIC_HIGHLIGHTING_SETTING_ID)) {
                this._cancelAll();
                scheduleTokenizeViewport();
            }
        }));
        this._register(this._themeService.onDidColorThemeChange(() => {
            this._cancelAll();
            scheduleTokenizeViewport();
        }));
        scheduleTokenizeViewport();
    }
    dispose() {
        this._cleanupProviderListeners();
        super.dispose();
    }
    _cleanupProviderListeners() {
        dispose(this._rangeProvidersChangeListeners);
        this._rangeProvidersChangeListeners = [];
    }
    _cancelAll() {
        for (const request of this._outstandingRequests) {
            request.cancel();
        }
        this._outstandingRequests = [];
    }
    _removeOutstandingRequest(req) {
        for (let i = 0, len = this._outstandingRequests.length; i < len; i++) {
            if (this._outstandingRequests[i] === req) {
                this._outstandingRequests.splice(i, 1);
                return;
            }
        }
    }
    _tokenizeViewportNow() {
        if (!this._editor.hasModel()) {
            return;
        }
        const model = this._editor.getModel();
        if (model.tokenization.hasCompleteSemanticTokens()) {
            return;
        }
        if (!isSemanticColoringEnabled(model, this._themeService, this._configurationService)) {
            if (model.tokenization.hasSomeSemanticTokens()) {
                model.tokenization.setSemanticTokens(null, false);
            }
            return;
        }
        if (!hasDocumentRangeSemanticTokensProvider(this._provider, model)) {
            if (model.tokenization.hasSomeSemanticTokens()) {
                model.tokenization.setSemanticTokens(null, false);
            }
            return;
        }
        const visibleRanges = this._editor.getVisibleRangesPlusViewportAboveBelow();
        this._outstandingRequests = this._outstandingRequests.concat(visibleRanges.map(range => this._requestRange(model, range)));
    }
    _requestRange(model, range) {
        const requestVersionId = model.getVersionId();
        const request = createCancelablePromise(token => Promise.resolve(getDocumentRangeSemanticTokens(this._provider, model, range, token)));
        const sw = new StopWatch(false);
        request.then((r) => {
            this._debounceInformation.update(model, sw.elapsed());
            if (!r || !r.tokens || model.isDisposed() || model.getVersionId() !== requestVersionId) {
                return;
            }
            const { provider, tokens: result } = r;
            const styling = this._semanticTokensStylingService.getStyling(provider);
            model.tokenization.setPartialSemanticTokens(range, toMultilineTokens2(result, styling, model.getLanguageId()));
        }).then(() => this._removeOutstandingRequest(request), () => this._removeOutstandingRequest(request));
        return request;
    }
};
ViewportSemanticTokensContribution = ViewportSemanticTokensContribution_1 = __decorate([
    __param(1, ISemanticTokensStylingService),
    __param(2, IThemeService),
    __param(3, IConfigurationService),
    __param(4, ILanguageFeatureDebounceService),
    __param(5, ILanguageFeaturesService)
], ViewportSemanticTokensContribution);
export { ViewportSemanticTokensContribution };
registerEditorContribution(ViewportSemanticTokensContribution.ID, ViewportSemanticTokensContribution, 1 /* EditorContributionInstantiation.AfterFirstRender */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld3BvcnRTZW1hbnRpY1Rva2Vucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9zZW1hbnRpY1Rva2Vucy9icm93c2VyL3ZpZXdwb3J0U2VtYW50aWNUb2tlbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBcUIsdUJBQXVCLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNoSCxPQUFPLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBZSxNQUFNLHNDQUFzQyxDQUFDO0FBRXhGLE9BQU8sRUFBbUMsMEJBQTBCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUluSCxPQUFPLEVBQUUsOEJBQThCLEVBQUUsc0NBQXNDLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUN4SCxPQUFPLEVBQUUseUJBQXlCLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNoSCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUMvRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUErQiwrQkFBK0IsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ25JLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUdqRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUN4RixPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUUzRixJQUFNLGtDQUFrQyxHQUF4QyxNQUFNLGtDQUFtQyxTQUFRLFVBQVU7O2FBRTFDLE9BQUUsR0FBRyx1Q0FBdUMsQUFBMUMsQ0FBMkM7SUFFN0QsTUFBTSxD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