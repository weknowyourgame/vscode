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
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import * as errors from '../../../../../base/common/errors.js';
import { Emitter, Event, PauseableEmitter } from '../../../../../base/common/event.js';
import { Lazy } from '../../../../../base/common/lazy.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { INotebookSearchService } from '../../common/notebookSearch.js';
import { ReplacePattern } from '../../../../services/search/common/replace.js';
import { ISearchService } from '../../../../services/search/common/search.js';
import { mergeSearchResultEvents, SearchModelLocation, SEARCH_MODEL_PREFIX } from './searchTreeCommon.js';
import { SearchResultImpl } from './searchResult.js';
let SearchModelImpl = class SearchModelImpl extends Disposable {
    constructor(searchService, telemetryService, configurationService, instantiationService, logService, notebookSearchService) {
        super();
        this.searchService = searchService;
        this.telemetryService = telemetryService;
        this.configurationService = configurationService;
        this.instantiationService = instantiationService;
        this.logService = logService;
        this.notebookSearchService = notebookSearchService;
        this._searchQuery = null;
        this._replaceActive = false;
        this._replaceString = null;
        this._replacePattern = null;
        this._preserveCase = false;
        this._startStreamDelay = Promise.resolve();
        this._resultQueue = [];
        this._aiResultQueue = [];
        this._onReplaceTermChanged = this._register(new Emitter());
        this.onReplaceTermChanged = this._onReplaceTermChanged.event;
        this._onSearchResultChanged = this._register(new PauseableEmitter({
            merge: mergeSearchResultEvents
        }));
        this.onSearchResultChanged = this._onSearchResultChanged.event;
        this.currentCancelTokenSource = null;
        this.currentAICancelTokenSource = null;
        this.searchCancelledForNewSearch = false;
        this.aiSearchCancelledForNewSearch = false;
        this.location = SearchModelLocation.PANEL;
        this._searchResult = this.instantiationService.createInstance(SearchResultImpl, this);
        this._register(this._searchResult.onChange((e) => this._onSearchResultChanged.fire(e)));
        this._aiTextResultProviderName = new Lazy(async () => this.searchService.getAIName());
        this._id = SEARCH_MODEL_PREFIX + Date.now().toString();
    }
    id() {
        return this._id;
    }
    async getAITextResultProviderName() {
        const result = await this._aiTextResultProviderName.value;
        if (!result) {
            throw Error('Fetching AI name when no provider present.');
        }
        return result;
    }
    isReplaceActive() {
        return this._replaceActive;
    }
    set replaceActive(replaceActive) {
        this._replaceActive = replaceActive;
    }
    get replacePattern() {
        return this._replacePattern;
    }
    get replaceString() {
        return this._replaceString || '';
    }
    set preserveCase(value) {
        this._preserveCase = value;
    }
    get preserveCase() {
        return this._preserveCase;
    }
    set replaceString(replaceString) {
        this._replaceString = replaceString;
        if (this._searchQuery) {
            this._replacePattern = new ReplacePattern(replaceString, this._searchQuery.contentPattern);
        }
        this._onReplaceTermChanged.fire();
    }
    get searchResult() {
        return this._searchResult;
    }
    aiSearch(onResult) {
        if (this.hasAIResults) {
            // already has matches or pending matches
            throw Error('AI results already exist');
        }
        if (!this._searchQuery) {
            throw Error('No search query');
        }
        const searchInstanceID = Date.now().toString();
        const tokenSource = new CancellationTokenSource();
        this.currentAICancelTokenSource = tokenSource;
        const start = Date.now();
        const asyncAIResults = this.searchService.aiTextSearch({ ...this._searchQuery, contentPattern: this._searchQuery.contentPattern.pattern, type: 3 /* QueryType.aiText */ }, tokenSource.token, async (p) => {
            onResult(p);
            this.onSearchProgress(p, searchInstanceID, false, true);
        }).finally(() => {
            tokenSource.dispose(true);
        }).then(value => {
            if (value.results.length === 0) {
                // alert of no results since onProgress won't be called
                onResult(undefined);
            }
            this.onSearchCompleted(value, Date.now() - start, searchInstanceID, true);
            return value;
        }, e => {
            this.onSearchError(e, Date.now() - start, true);
            throw e;
        });
        return asyncAIResults;
    }
    doSearch(query, progressEmitter, searchQuery, searchInstanceID, onProgress, callerToken) {
        const asyncGenerateOnProgress = async (p) => {
            progressEmitter.fire();
            this.onSearchProgress(p, searchInstanceID, false, false);
            onProgress?.(p);
        };
        const syncGenerateOnProgress = (p) => {
            progressEmitter.fire();
            this.onSearchProgress(p, searchInstanceID, true);
            onProgress?.(p);
        };
        const tokenSource = this.currentCancelTokenSource = new CancellationTokenSource(callerToken);
        const notebookResult = this.notebookSearchService.notebookSearch(query, tokenSource.token, searchInstanceID, asyncGenerateOnProgress);
        const textResult = this.searchService.textSearchSplitSyncAsync(searchQuery, tokenSource.token, asyncGenerateOnProgress, notebookResult.openFilesToScan, notebookResult.allScannedFiles);
        const syncResults = textResult.syncResults.results;
        syncResults.forEach(p => { if (p) {
            syncGenerateOnProgress(p);
        } });
        const getAsyncResults = async () => {
            const searchStart = Date.now();
            // resolve async parts of search
            const allClosedEditorResults = await textResult.asyncResults;
            const resolvedNotebookResults = await notebookResult.completeData;
            const searchLength = Date.now() - searchStart;
            const resolvedResult = {
                results: [...allClosedEditorResults.results, ...resolvedNotebookResults.results],
                messages: [...allClosedEditorResults.messages, ...resolvedNotebookResults.messages],
                limitHit: allClosedEditorResults.limitHit || resolvedNotebookResults.limitHit,
                exit: allClosedEditorResults.exit,
                stats: allClosedEditorResults.stats,
            };
            this.logService.trace(`whole search time | ${searchLength}ms`);
            return resolvedResult;
        };
        return {
            asyncResults: getAsyncResults()
                .finally(() => tokenSource.dispose(true)),
            syncResults
        };
    }
    get hasAIResults() {
        return !!(this.searchResult.getCachedSearchComplete(true)) || (!!this.currentAICancelTokenSource && !this.currentAICancelTokenSource.token.isCancellationRequested);
    }
    get hasPlainResults() {
        return !!(this.searchResult.getCachedSearchComplete(false)) || (!!this.currentCancelTokenSource && !this.currentCancelTokenSource.token.isCancellationRequested);
    }
    search(query, onProgress, callerToken) {
        this.cancelSearch(true);
        this._searchQuery = query;
        if (!this.searchConfig.searchOnType) {
            this.searchResult.clear();
        }
        const searchInstanceID = Date.now().toString();
        this._searchResult.query = this._searchQuery;
        const progressEmitter = this._register(new Emitter());
        this._replacePattern = new ReplacePattern(this.replaceString, this._searchQuery.contentPattern);
        // In search on type case, delay the streaming of results just a bit, so that we don't flash the only "local results" fast path
        this._startStreamDelay = new Promise(resolve => setTimeout(resolve, this.searchConfig.searchOnType ? 150 : 0));
        const req = this.doSearch(query, progressEmitter, this._searchQuery, searchInstanceID, onProgress, callerToken);
        const asyncResults = req.asyncResults;
        const syncResults = req.syncResults;
        if (onProgress) {
            syncResults.forEach(p => {
                if (p) {
                    onProgress(p);
                }
            });
        }
        const start = Date.now();
        let event;
        const progressEmitterPromise = new Promise(resolve => {
            event = Event.once(progressEmitter.event)(resolve);
            return event;
        });
        Promise.race([asyncResults, progressEmitterPromise]).finally(() => {
            /* __GDPR__
                "searchResultsFirstRender" : {
                    "owner": "roblourens",
                    "duration" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true }
                }
            */
            event?.dispose();
            this.telemetryService.publicLog('searchResultsFirstRender', { duration: Date.now() - start });
        });
        try {
            return {
                asyncResults: asyncResults.then(value => {
                    this.onSearchCompleted(value, Date.now() - start, searchInstanceID, false);
                    return value;
                }, e => {
                    this.onSearchError(e, Date.now() - start, false);
                    throw e;
                }),
                syncResults
            };
        }
        finally {
            /* __GDPR__
                "searchResultsFinished" : {
                    "owner": "roblourens",
                    "duration" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true }
                }
            */
            this.telemetryService.publicLog('searchResultsFinished', { duration: Date.now() - start });
        }
    }
    onSearchCompleted(completed, duration, searchInstanceID, ai) {
        if (!this._searchQuery) {
            throw new Error('onSearchCompleted must be called after a search is started');
        }
        if (ai) {
            this._searchResult.add(this._aiResultQueue, searchInstanceID, true);
            this._aiResultQueue.length = 0;
        }
        else {
            this._searchResult.add(this._resultQueue, searchInstanceID, false);
            this._resultQueue.length = 0;
        }
        this.searchResult.setCachedSearchComplete(completed, ai);
        const options = Object.assign({}, this._searchQuery.contentPattern);
        // eslint-disable-next-line local/code-no-any-casts
        delete options.pattern;
        const stats = completed && completed.stats;
        const fileSchemeOnly = this._searchQuery.folderQueries.every(fq => fq.folder.scheme === Schemas.file);
        const otherSchemeOnly = this._searchQuery.folderQueries.every(fq => fq.folder.scheme !== Schemas.file);
        const scheme = fileSchemeOnly ? Schemas.file :
            otherSchemeOnly ? 'other' :
                'mixed';
        /* __GDPR__
            "searchResultsShown" : {
                "owner": "roblourens",
                "count" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
                "fileCount": { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
                "options": { "${inline}": [ "${IPatternInfo}" ] },
                "duration": { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true },
                "type" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" },
                "scheme" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" },
                "searchOnTypeEnabled" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
            }
        */
        this.telemetryService.publicLog('searchResultsShown', {
            count: this._searchResult.count(),
            fileCount: this._searchResult.fileCount(),
            options,
            duration,
            type: stats && stats.type,
            scheme,
            searchOnTypeEnabled: this.searchConfig.searchOnType
        });
        return completed;
    }
    onSearchError(e, duration, ai) {
        if (errors.isCancellationError(e)) {
            this.onSearchCompleted((ai ? this.aiSearchCancelledForNewSearch : this.searchCancelledForNewSearch)
                ? { exit: 1 /* SearchCompletionExitCode.NewSearchStarted */, results: [], messages: [] }
                : undefined, duration, '', ai);
            if (ai) {
                this.aiSearchCancelledForNewSearch = false;
            }
            else {
                this.searchCancelledForNewSearch = false;
            }
        }
    }
    onSearchProgress(p, searchInstanceID, sync = true, ai = false) {
        const targetQueue = ai ? this._aiResultQueue : this._resultQueue;
        if (p.resource) {
            targetQueue.push(p);
            if (sync) {
                if (targetQueue.length) {
                    this._searchResult.add(targetQueue, searchInstanceID, false, true);
                    targetQueue.length = 0;
                }
            }
            else {
                this._startStreamDelay.then(() => {
                    if (targetQueue.length) {
                        this._searchResult.add(targetQueue, searchInstanceID, ai, !ai);
                        targetQueue.length = 0;
                    }
                });
            }
        }
    }
    get searchConfig() {
        return this.configurationService.getValue('search');
    }
    cancelSearch(cancelledForNewSearch = false) {
        if (this.currentCancelTokenSource) {
            this.searchCancelledForNewSearch = cancelledForNewSearch;
            this.currentCancelTokenSource.cancel();
            return true;
        }
        return false;
    }
    cancelAISearch(cancelledForNewSearch = false) {
        if (this.currentAICancelTokenSource) {
            this.aiSearchCancelledForNewSearch = cancelledForNewSearch;
            this.currentAICancelTokenSource.cancel();
            return true;
        }
        return false;
    }
    clearAiSearchResults() {
        this._aiResultQueue.length = 0;
        // it's not clear all as we are only clearing the AI results
        this._searchResult.aiTextSearchResult.clear(false);
    }
    dispose() {
        this.cancelSearch();
        this.cancelAISearch();
        this.searchResult.dispose();
        super.dispose();
    }
};
SearchModelImpl = __decorate([
    __param(0, ISearchService),
    __param(1, ITelemetryService),
    __param(2, IConfigurationService),
    __param(3, IInstantiationService),
    __param(4, ILogService),
    __param(5, INotebookSearchService)
], SearchModelImpl);
export { SearchModelImpl };
let SearchViewModelWorkbenchService = class SearchViewModelWorkbenchService {
    constructor(instantiationService) {
        this.instantiationService = instantiationService;
        this._searchModel = null;
    }
    get searchModel() {
        if (!this._searchModel) {
            this._searchModel = this.instantiationService.createInstance(SearchModelImpl);
        }
        return this._searchModel;
    }
    set searchModel(searchModel) {
        this._searchModel?.dispose();
        this._searchModel = searchModel;
    }
};
SearchViewModelWorkbenchService = __decorate([
    __param(0, IInstantiationService)
], SearchViewModelWorkbenchService);
export { SearchViewModelWorkbenchService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VhcmNoTW9kZWwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvc2VhcmNoL2Jyb3dzZXIvc2VhcmNoVHJlZU1vZGVsL3NlYXJjaE1vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBcUIsdUJBQXVCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN4RyxPQUFPLEtBQUssTUFBTSxNQUFNLHNDQUFzQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDdkYsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNsRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFaEUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUMvRSxPQUFPLEVBQWtHLGNBQWMsRUFBcUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNqUCxPQUFPLEVBQWdCLHVCQUF1QixFQUFFLG1CQUFtQixFQUErQixtQkFBbUIsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ3JKLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxN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