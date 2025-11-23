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
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { ILanguageFeaturesService } from '../../../common/services/languageFeatures.js';
import { CancellationTokenSource, } from '../../../../base/common/cancellation.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { binarySearch } from '../../../../base/common/arrays.js';
import { Emitter } from '../../../../base/common/event.js';
import { ILanguageConfigurationService } from '../../../common/languages/languageConfigurationRegistry.js';
import { StickyModelProvider } from './stickyScrollModelProvider.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
export class StickyLineCandidate {
    constructor(startLineNumber, endLineNumber, top, height) {
        this.startLineNumber = startLineNumber;
        this.endLineNumber = endLineNumber;
        this.top = top;
        this.height = height;
    }
}
let StickyLineCandidateProvider = class StickyLineCandidateProvider extends Disposable {
    static { this.ID = 'store.contrib.stickyScrollController'; }
    constructor(editor, _languageFeaturesService, _languageConfigurationService) {
        super();
        this._languageFeaturesService = _languageFeaturesService;
        this._languageConfigurationService = _languageConfigurationService;
        this._onDidChangeStickyScroll = this._register(new Emitter());
        this.onDidChangeStickyScroll = this._onDidChangeStickyScroll.event;
        this._model = null;
        this._cts = null;
        this._stickyModelProvider = null;
        this._editor = editor;
        this._sessionStore = this._register(new DisposableStore());
        this._updateSoon = this._register(new RunOnceScheduler(() => this.update(), 50));
        this._register(this._editor.onDidChangeConfiguration(e => {
            if (e.hasChanged(131 /* EditorOption.stickyScroll */)) {
                this.readConfiguration();
            }
        }));
        this.readConfiguration();
    }
    /**
     * Read and apply the sticky scroll configuration.
     */
    readConfiguration() {
        this._sessionStore.clear();
        const options = this._editor.getOption(131 /* EditorOption.stickyScroll */);
        if (!options.enabled) {
            return;
        }
        this._sessionStore.add(this._editor.onDidChangeModel(() => {
            this._model = null;
            this.updateStickyModelProvider();
            this._onDidChangeStickyScroll.fire();
            this.update();
        }));
        this._sessionStore.add(this._editor.onDidChangeHiddenAreas(() => this.update()));
        this._sessionStore.add(this._editor.onDidChangeModelContent(() => this._updateSoon.schedule()));
        this._sessionStore.add(this._languageFeaturesService.documentSymbolProvider.onDidChange(() => this.update()));
        this._sessionStore.add(toDisposable(() => {
            this._stickyModelProvider?.dispose();
            this._stickyModelProvider = null;
        }));
        this.updateStickyModelProvider();
        this.update();
    }
    /**
     * Get the version ID of the sticky model.
     */
    getVersionId() {
        return this._model?.version;
    }
    /**
     * Update the sticky model provider.
     */
    updateStickyModelProvider() {
        this._stickyModelProvider?.dispose();
        this._stickyModelProvider = null;
        if (this._editor.hasModel()) {
            this._stickyModelProvider = new StickyModelProvider(this._editor, () => this._updateSoon.schedule(), this._languageConfigurationService, this._languageFeaturesService);
        }
    }
    /**
     * Update the sticky line candidates.
     */
    async update() {
        this._cts?.dispose(true);
        this._cts = new CancellationTokenSource();
        await this.updateStickyModel(this._cts.token);
        this._onDidChangeStickyScroll.fire();
    }
    /**
     * Update the sticky model based on the current editor state.
     */
    async updateStickyModel(token) {
        if (!this._editor.hasModel() || !this._stickyModelProvider || this._editor.getModel().isTooLargeForTokenization()) {
            this._model = null;
            return;
        }
        const model = await this._stickyModelProvider.update(token);
        if (!token.isCancellationRequested) {
            this._model = model;
        }
    }
    /**
     * Get sticky line candidates intersecting a given range.
     */
    getCandidateStickyLinesIntersecting(range) {
        if (!this._model?.element) {
            return [];
        }
        const stickyLineCandidates = [];
        this.getCandidateStickyLinesIntersectingFromStickyModel(range, this._model.element, stickyLineCandidates, 0, 0, -1);
        return this.filterHiddenRanges(stickyLineCandidates);
    }
    /**
     * Get sticky line candidates intersecting a given range from the sticky model.
     */
    getCandidateStickyLinesIntersectingFromStickyModel(range, outlineModel, result, depth, top, lastStartLineNumber) {
        const textModel = this._editor.getModel();
        if (!textModel) {
            return;
        }
        if (outlineModel.children.length === 0) {
            return;
        }
        let lastLine = lastStartLineNumber;
        const childrenStartLines = [];
        for (let i = 0; i < outlineModel.children.length; i++) {
            const child = outlineModel.children[i];
            if (child.range) {
                childrenStartLines.push(child.range.startLineNumber);
            }
        }
        const lowerBound = this.updateIndex(binarySearch(childrenStartLines, range.startLineNumber, (a, b) => { return a - b; }));
        const upperBound = this.updateIndex(binarySearch(childrenStartLines, range.endLineNumber, (a, b) => { return a - b; }));
        for (let i = lowerBound; i <= upperBound; i++) {
            const child = outlineModel.children[i];
            if (!child || !child.range) {
                continue;
            }
            const { startLineNumber, endLineNumber } = child.range;
            if (endLineNumber > startLineNumber + 1
                && range.startLineNumber <= endLineNumber + 1
                && startLineNumber - 1 <= range.endLineNumber
                && startLineNumber !== lastLine
                && textModel.isValidRange(new Range(startLineNumber, 1, endLineNumber, 1))) {
                lastLine = startLineNumber;
                const lineHeight = this._editor.getLineHeightForPosition(new Position(startLineNumber, 1));
                result.push(new StickyLineCandidate(startLineNumber, endLineNumber - 1, top, lineHeight));
                this.getCandidateStickyLinesIntersectingFromStickyModel(range, child, result, depth + 1, top + lineHeight, startLineNumber);
            }
        }
    }
    /**
     * Filter out sticky line candidates that are within hidden ranges.
     */
    filterHiddenRanges(stickyLineCandidates) {
        const hiddenRanges = this._editor._getViewModel()?.getHiddenAreas();
        if (!hiddenRanges) {
            return stickyLineCandidates;
        }
        return stickyLineCandidates.filter(candidate => {
            return !hiddenRanges.some(hiddenRange => candidate.startLineNumber >= hiddenRange.startLineNumber &&
                candidate.endLineNumber <= hiddenRange.endLineNumber + 1);
        });
    }
    /**
     * Update the binary search index.
     */
    updateIndex(index) {
        if (index === -1) {
            return 0;
        }
        else if (index < 0) {
            return -index - 2;
        }
        return index;
    }
};
StickyLineCandidateProvider = __decorate([
    __param(1, ILanguageFeaturesService),
    __param(2, ILanguageConfigurationService)
], StickyLineCandidateProvider);
export { StickyLineCandidateProvider };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RpY2t5U2Nyb2xsUHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvc3RpY2t5U2Nyb2xsL2Jyb3dzZXIvc3RpY2t5U2Nyb2xsUHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFakcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDeEYsT0FBTyxFQUFxQix1QkFBdUIsR0FBRyxNQUFNLHlDQUF5QyxDQUFDO0FBRXRHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNqRSxPQUFPLEVBQVMsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDM0csT0FBTyxFQUFFLG1CQUFtQixFQUF3QixNQUFNLGdDQUFnQyxDQUFDO0FBRTNGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM1RCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFdEQsTUFBTSxPQUFPLG1CQUFtQjtJQUMvQixZQUNpQixlQUF1QixFQUN2QixhQUFxQixFQUNyQixHQUFXLEVBQ1gsTUFBYztRQUhkLG9CQUFlLEdBQWYsZUFBZSxDQUFRO1FBQ3ZCLGtCQUFhLEdBQWIsYUFBYSxDQUFRO1FBQ3JCLFFBQUcsR0FBSCxHQUFHLENBQVE7UUFDWCxXQUFNLEdBQU4sTUFBTSxDQUFRO0lBQzNCLENBQUM7Q0FDTDtBQTZCTSxJQUFNLDJCQUEyQixHQUFqQyxNQUFN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