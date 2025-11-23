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
var AnythingQuickAccessProvider_1;
import './media/anythingQuickAccess.css';
import { quickPickItemScorerAccessor, QuickPickItemScorerAccessor, QuickInputHideReason, IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { PickerQuickAccessProvider, TriggerAction } from '../../../../platform/quickinput/browser/pickerQuickAccess.js';
import { prepareQuery, compareItemsByFuzzyScore, scoreItemFuzzy } from '../../../../base/common/fuzzyScorer.js';
import { QueryBuilder } from '../../../services/search/common/queryBuilder.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { getOutOfWorkspaceEditorResources, extractRangeFromFilter } from '../common/search.js';
import { ISearchService } from '../../../services/search/common/search.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { untildify } from '../../../../base/common/labels.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { URI } from '../../../../base/common/uri.js';
import { toLocalResource, dirname, basenameOrAuthority } from '../../../../base/common/resources.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { DisposableStore, toDisposable, MutableDisposable, Disposable } from '../../../../base/common/lifecycle.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { getIconClasses } from '../../../../editor/common/services/getIconClasses.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { localize } from '../../../../nls.js';
import { IWorkingCopyService } from '../../../services/workingCopy/common/workingCopyService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { EditorResourceAccessor, isEditorInput } from '../../../common/editor.js';
import { IEditorService, SIDE_GROUP, ACTIVE_GROUP } from '../../../services/editor/common/editorService.js';
import { Range } from '../../../../editor/common/core/range.js';
import { ThrottledDelayer } from '../../../../base/common/async.js';
import { top } from '../../../../base/common/arrays.js';
import { FileQueryCacheState } from '../common/cacheState.js';
import { IHistoryService } from '../../../services/history/common/history.js';
import { Schemas } from '../../../../base/common/network.js';
import { IFilesConfigurationService } from '../../../services/filesConfiguration/common/filesConfigurationService.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { SymbolsQuickAccessProvider } from './symbolsQuickAccess.js';
import { DefaultQuickAccessFilterValue, Extensions } from '../../../../platform/quickinput/common/quickAccess.js';
import { PickerEditorState } from '../../../browser/quickaccess.js';
import { GotoSymbolQuickAccessProvider } from '../../codeEditor/browser/quickaccess/gotoSymbolQuickAccess.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { Event } from '../../../../base/common/event.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { stripIcons } from '../../../../base/common/iconLabels.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ASK_QUICK_QUESTION_ACTION_ID } from '../../chat/browser/actions/chatQuickInputActions.js';
import { IQuickChatService } from '../../chat/browser/chat.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ICustomEditorLabelService } from '../../../services/editor/common/customEditorLabelService.js';
function isEditorSymbolQuickPickItem(pick) {
    const candidate = pick;
    return !!candidate?.range && !!candidate.resource;
}
let AnythingQuickAccessProvider = class AnythingQuickAccessProvider extends PickerQuickAccessProvider {
    static { AnythingQuickAccessProvider_1 = this; }
    static { this.PREFIX = ''; }
    static { this.NO_RESULTS_PICK = {
        label: localize('noAnythingResults', "No matching results")
    }; }
    static { this.MAX_RESULTS = 512; }
    static { this.TYPING_SEARCH_DELAY = 200; } // this delay accommodates for the user typing a word and then stops typing to start searching
    static { this.SYMBOL_PICKS_MERGE_DELAY = 200; } // allow some time to merge fast and slow picks to reduce flickering
    get defaultFilterValue() {
        if (this.configuration.preserveInput) {
            return DefaultQuickAccessFilterValue.LAST;
        }
        return undefined;
    }
    constructor(instantiationService, searchService, contextService, pathService, environmentService, fileService, labelService, modelService, languageService, workingCopyService, configurationService, editorService, historyService, filesConfigurationService, textModelService, uriIdentityService, quickInputService, keybindingService, quickChatService, logService, customEditorLabelService) {
        super(AnythingQuickAccessProvider_1.PREFIX, {
            canAcceptInBackground: true,
            noResultsPick: AnythingQuickAccessProvider_1.NO_RESULTS_PICK
        });
        this.instantiationService = instantiationService;
        this.searchService = searchService;
        this.contextService = contextService;
        this.pathService = pathService;
        this.environmentService = environmentService;
        this.fileService = fileService;
        this.labelService = labelService;
        this.modelService = modelService;
        this.languageService = languageService;
        this.workingCopyService = workingCopyService;
        this.configurationService = configurationService;
        this.editorService = editorService;
        this.historyService = historyService;
        this.filesConfigurationService = filesConfigurationService;
        this.textModelService = textModelService;
        this.uriIdentityService = uriIdentityService;
        this.quickInputService = quickInputService;
        this.keybindingService = keybindingService;
        this.quickChatService = quickChatService;
        this.logService = logService;
        this.customEditorLabelService = customEditorLabelService;
        //#region Editor History
        this.labelOnlyEditorHistoryPickAccessor = new QuickPickItemScorerAccessor({ skipDescription: true });
        //#endregion
        //#region File Search
        this.fileQueryDelayer = this._register(new ThrottledDelayer(AnythingQuickAccessProvider_1.TYPING_SEARCH_DELAY));
        //#endregion
        //#region Command Center (if enabled)
        this.lazyRegistry = new Lazy(() => Registry.as(Extensions.Quickaccess));
        this.pickState = this._register(new class extends Disposable {
            constructor(provider, instantiationService) {
                super();
                this.provider = provider;
                this.picker = undefined;
                this.scorerCache = Object.create(null);
                this.fileQueryCache = undefined;
                this.lastOriginalFilter = undefined;
                this.lastFilter = undefined;
                this.lastRange = undefined;
                this.lastGlobalPicks = undefined;
                this.isQuickNavigating = undefined;
                this.editorViewState = this._register(instantiationService.createInstance(PickerEditorState));
            }
            set(picker) {
                // Picker for this run
                this.picker = picker;
                Event.once(picker.onDispose)(() => {
                    if (picker === this.picker) {
                        this.picker = undefined; // clear the picker when disposed to not keep it in memory for too long
                    }
                });
                // Caches
                const isQuickNavigating = !!picker.quickNavigate;
                if (!isQuickNavigating) {
                    this.fileQueryCache = this.provider.createFileQueryCache();
                    this.scorerCache = Object.create(null);
                }
                // Other
                this.isQuickNavigating = isQuickNavigating;
                this.lastOriginalFilter = undefined;
                this.lastFilter = undefined;
                this.lastRange = undefined;
                this.lastGlobalPicks = undefined;
                this.editorViewState.reset();
            }
        }(this, instantiationService));
        this.fileQueryBuilder = this.instantiationService.createInstance(QueryBuilder);
        this.workspaceSymbolsQuickAccess = this._register(instantiationService.createInstance(SymbolsQuickAccessProvider));
        this.editorSymbolsQuickAccess = this.instantiationService.createInstance(GotoSymbolQuickAccessProvider);
    }
    get configuration() {
        const editorConfig = this.configurationService.getValue().workbench?.editor;
        const searchConfig = this.configurationService.getValue().search;
        const quickAccessConfig = this.configurationService.getValue().workbench.quickOpen;
        return {
            openEditorPinned: !editorConfig?.enablePreviewFromQuickOpen || !editorConfig?.enablePreview,
            openSideBySideDirection: editorConfig?.openSideBySideDirection,
            includeSymbols: searchConfig?.quickOpen.includeSymbols,
            includeHistory: searchConfig?.quickOpen.includeHistory,
            historyFilterSortOrder: searchConfig?.quickOpen.history.filterSortOrder,
            preserveInput: quickAccessConfig.preserveInput
        };
    }
    provide(picker, token, runOptions) {
        const disposables = new DisposableStore();
        // Update the pick state for this run
        this.pickState.set(picker);
        // Add editor decorations for active editor symbol picks
        const editorDecorationsDisposable = disposables.add(new MutableDisposable());
        disposables.add(picker.onDidChangeActive(() => {
            // Clear old decorations
            editorDecorationsDisposable.value = undefined;
            // Add new decoration if editor symbol is active
            const [item] = picker.activeItems;
            if (isEditorSymbolQuickPickItem(item)) {
                editorDecorationsDisposable.value = this.decorateAndRevealSymbolRange(item);
            }
        }));
        // Restore view state upon cancellation if we changed it
        // but only when the picker was closed via explicit user
        // gesture and not e.g. when focus was lost because that
        // could mean the user clicked into the editor directly.
        disposables.add(Event.once(picker.onDidHide)(({ reason }) => {
            if (reason === QuickInputHideReason.Gesture) {
                this.pickState.editorViewState.restore();
            }
        }));
        // Start picker
        disposables.add(super.provide(picker, token, runOptions));
        return disposables;
    }
    decorateAndRevealSymbolRange(pick) {
        const activeEditor = this.editorService.activeEditor;
        if (!this.uriIdentityService.extUri.isEqual(pick.resource, activeEditor?.resource)) {
            return Disposable.None; // active editor needs to be for resource
        }
        const activeEditorControl = this.editorService.activeTextEditorControl;
        if (!activeEditorControl) {
            return Disposable.None; // we need a text editor control to decorate and reveal
        }
        // we must remember our current view state to be able to restore
        this.pickState.editorViewState.set();
        // Reveal
        activeEditorControl.revealRangeInCenter(pick.range.selection, 0 /* ScrollType.Smooth */);
        // Decorate
        this.addDecorations(activeEditorControl, pick.range.decoration);
        return toDisposable(() => this.clearDecorations(activeEditorControl));
    }
    _getPicks(originalFilter, disposables, token, runOptions) {
        // Find a suitable range from the pattern looking for ":", "#" or ","
        // unless we have the `@` editor symbol character inside the filter
        const filterWithRange = extractRangeFromFilter(originalFilter, [GotoSymbolQuickAccessProvider.PREFIX]);
        // Update filter with normalized values
        let filter;
        if (filterWithRange) {
            filter = filterWithRange.filter;
        }
        else {
            filter = originalFilter;
        }
        // Remember as last range
        this.pickState.lastRange = filterWithRange?.range;
        // If the original filter value has changed but the normalized
        // one has not, we return early with a `null` result indicating
        // that the results should preserve because the range information
        // (:<line>:<column>) does not need to trigger any re-sorting.
        if (originalFilter !== this.pickState.lastOriginalFilter && filter === this.pickState.lastFilter) {
            return null;
        }
        // Remember as last filter
        const lastWasFiltering = !!this.pickState.lastOriginalFilter;
        this.pickState.lastOriginalFilter = originalFilter;
        this.pickState.lastFilter = filter;
        // Remember our pick state before returning new picks
        // unless we are inside an editor symbol filter or result.
        // We can use this state to return back to the global pick
        // when the user is narrowing back out of editor symbols.
        const picks = this.pickState.picker?.items;
        const activePick = this.pickState.picker?.activeItems[0];
        if (picks && activePick) {
            const activePickIsEditorSymbol = isEditorSymbolQuickPickItem(activePick);
            const activePickIsNoResultsInEditorSymbols = activePick === AnythingQuickAccessProvider_1.NO_RESULTS_PICK && filter.indexOf(GotoSymbolQuickAccessProvider.PREFIX) >= 0;
            if (!activePickIsEditorSymbol && !activePickIsNoResultsInEditorSymbols) {
                this.pickState.lastGlobalPicks = {
                    items: picks,
                    active: activePick
                };
            }
        }
        // `enableEditorSymbolSearch`: this will enable local editor symbol
        // search if the filter value includes `@` character. We only want
        // to enable this support though if the user was filtering in the
        // picker because this feature depends on an active item in the result
        // list to get symbols from. If we would simply trigger editor symbol
        // search without prior filtering, you could not paste a file name
        // including the `@` character to open it (e.g. /some/file@path)
        // refs: https://github.com/microsoft/vscode/issues/93845
        return this.doGetPicks(filter, {
            ...runOptions,
            enableEditorSymbolSearch: lastWasFiltering
        }, disposables, token);
    }
    doGetPicks(filter, options, disposables, token) {
        const query = prepareQuery(filter);
        // Return early if we have editor symbol picks. We support this by:
        // - having a previously active global pick (e.g. a file)
        // - the user typing `@` to start the local symbol query
        if (options.enableEditorSymbolSearch) {
            const editorSymbolPicks = this.getEditorSymbolPicks(query, disposables, token);
            if (editorSymbolPicks) {
                return editorSymbolPicks;
            }
        }
        // If we have a known last active editor symbol pick, we try to restore
        // the last global pick to support the case of narrowing out from a
        // editor symbol search back into the global search
        const activePick = this.pickState.picker?.activeItems[0];
        if (isEditorSymbolQuickPickItem(activePick) && this.pickState.lastGlobalPicks) {
            return this.pickState.lastGlobalPicks;
        }
        // Otherwise return normally with history and file/symbol results
        const historyEditorPicks = this.getEditorHistoryPicks(query);
        let picks = new Array();
        if (options.additionPicks) {
            for (const pick of options.additionPicks) {
                if (pick.type === 'separator') {
                    picks.push(pick);
                    continue;
                }
                if (!query.original) {
                    pick.highlights = undefined;
                    picks.push(pick);
                    continue;
                }
                const { score, labelMatch, descriptionMatch } = scoreItemFuzzy(pick, query, true, quickPickItemScorerAccessor, this.pickState.scorerCache);
                if (!score) {
                    continue;
                }
                pick.highlights = {
                    label: labelMatch,
                    description: descriptionMatch
                };
                picks.push(pick);
            }
        }
        if (this.pickState.isQuickNavigating) {
            if (picks.length > 0) {
                picks.push({ type: 'separator', label: localize('recentlyOpenedSeparator', "recently opened") });
            }
            picks = historyEditorPicks;
        }
        else {
            if (options.includeHelp) {
                picks.push(...this.getHelpPicks(query, token, options));
            }
            if (historyEditorPicks.length !== 0) {
                picks.push({ type: 'separator', label: localize('recentlyOpenedSeparator', "recently opened") });
                picks.push(...historyEditorPicks);
            }
        }
        return {
            // Fast picks: help (if included) & editor history
            picks: options.filter ? picks.filter((p) => options.filter?.(p)) : picks,
            // Slow picks: files and symbols
            additionalPicks: (async () => {
                // Exclude any result that is already present in editor history.
                const additionalPicksExcludes = new ResourceMap(uri => this.uriIdentityService.extUri.getComparisonKey(uri));
                for (const historyEditorPick of historyEditorPicks) {
                    if (historyEditorPick.resource) {
                        additionalPicksExcludes.set(historyEditorPick.resource, true);
                    }
                }
                let additionalPicks = await this.getAdditionalPicks(query, additionalPicksExcludes, this.configuration.includeSymbols, token);
                if (options.filter) {
                    additionalPicks = additionalPicks.filter((p) => options.filter?.(p));
                }
                if (token.isCancellationRequested) {
                    return [];
                }
                return additionalPicks.length > 0 ? [
                    { type: 'separator', label: this.configuration.includeSymbols ? localize('fileAndSymbolResultsSeparator', "file and symbol results") : localize('fileResultsSeparator', "file results") },
                    ...additionalPicks
                ] : [];
            })(),
            // allow some time to merge files and symbols to reduce flickering
            mergeDelay: AnythingQuickAccessProvider_1.SYMBOL_PICKS_MERGE_DELAY
        };
    }
    async getAdditionalPicks(query, excludes, includeSymbols, token) {
        // Resolve file and symbol picks (if enabled)
        const [filePicks, symbolPicks] = await Promise.all([
            this.getFilePicks(query, excludes, token),
            this.getWorkspaceSymbolPicks(query, includeSymbols, token)
        ]);
        if (token.isCancellationRequested) {
            return [];
        }
        // Perform sorting (top results by score)
        const sortedAnythingPicks = top([...filePicks, ...symbolPicks], (anyPickA, anyPickB) => compareItemsByFuzzyScore(anyPickA, anyPickB, query, true, quickPickItemScorerAccessor, this.pickState.scorerCache), AnythingQuickAccessProvider_1.MAX_RESULTS);
        // Perform filtering
        const filteredAnythingPicks = [];
        for (const anythingPick of sortedAnythingPicks) {
            // Always preserve any existing highlights (e.g. from workspace symbols)
            if (anythingPick.highlights) {
                filteredAnythingPicks.push(anythingPick);
            }
            // Otherwise, do the scoring and matching here
            else {
                const { score, labelMatch, descriptionMatch } = scoreItemFuzzy(anythingPick, query, true, quickPickItemScorerAccessor, this.pickState.scorerCache);
                if (!score) {
                    continue;
                }
                anythingPick.highlights = {
                    label: labelMatch,
                    description: descriptionMatch
                };
                filteredAnythingPicks.push(anythingPick);
            }
        }
        return filteredAnythingPicks;
    }
    getEditorHistoryPicks(query) {
        const configuration = this.configuration;
        // Just return all history entries if not searching
        if (!query.normalized) {
            return this.historyService.getHistory().map(editor => this.createAnythingPick(editor, configuration));
        }
        if (!this.configuration.includeHistory) {
            return []; // disabled when searching
        }
        // Perform filtering
        const editorHistoryScorerAccessor = query.containsPathSeparator ? quickPickItemScorerAccessor : this.labelOnlyEditorHistoryPickAccessor; // Only match on label of the editor unless the search includes path separators
        const editorHistoryPicks = [];
        for (const editor of this.historyService.getHistory()) {
            const resource = editor.resource;
            if (!resource) {
                continue;
            }
            const editorHistoryPick = this.createAnythingPick(editor, configuration);
            const { score, labelMatch, descriptionMatch } = scoreItemFuzzy(editorHistoryPick, query, false, editorHistoryScorerAccessor, this.pickState.scorerCache);
            if (!score) {
                continue; // exclude editors not matching query
            }
            editorHistoryPick.highlights = {
                label: labelMatch,
                description: descriptionMatch
            };
            editorHistoryPicks.push(editorHistoryPick);
        }
        // Return without sorting if settings tell to sort by recency
        if (this.configuration.historyFilterSortOrder === 'recency') {
            return editorHistoryPicks;
        }
        // Perform sorting
        return editorHistoryPicks.sort((editorA, editorB) => compareItemsByFuzzyScore(editorA, editorB, query, false, editorHistoryScorerAccessor, this.pickState.scorerCache));
    }
    createFileQueryCache() {
        return new FileQueryCacheState(cacheKey => this.fileQueryBuilder.file(this.contextService.getWorkspace().folders, this.getFileQueryOptions({ cacheKey })), query => this.searchService.fileSearch(query), cacheKey => this.searchService.clearCache(cacheKey), this.pickState.fileQueryCache).load();
    }
    async getFilePicks(query, excludes, token) {
        if (!query.normalized) {
            return [];
        }
        // Absolute path result
        const absolutePathResult = await this.getAbsolutePathFileResult(query, token);
        if (token.isCancellationRequested) {
            return [];
        }
        // Use absolute path result as only results if present
        let fileMatches;
        if (absolutePathResult) {
            if (excludes.has(absolutePathResult)) {
                return []; // excluded
            }
            // Create a single result pick and make sure to apply full
            // highlights to ensure the pick is displayed. Since a
            // ~ might have been used for searching, our fuzzy scorer
            // may otherwise not properly respect the pick as a result
            const absolutePathPick = this.createAnythingPick(absolutePathResult, this.configuration);
            absolutePathPick.highlights = {
                label: [{ start: 0, end: absolutePathPick.label.length }],
                description: absolutePathPick.description ? [{ start: 0, end: absolutePathPick.description.length }] : undefined
            };
            return [absolutePathPick];
        }
        // Otherwise run the file search (with a delayer if cache is not ready yet)
        if (this.pickState.fileQueryCache?.isLoaded) {
            fileMatches = await this.doFileSearch(query, token);
        }
        else {
            fileMatches = await this.fileQueryDelayer.trigger(async () => {
                if (token.isCancellationRequested) {
                    return [];
                }
                return this.doFileSearch(query, token);
            });
        }
        if (token.isCancellationRequested) {
            return [];
        }
        // Filter excludes & convert to picks
        const configuration = this.configuration;
        return fileMatches
            .filter(resource => !excludes.has(resource))
            .map(resource => this.createAnythingPick(resource, configuration));
    }
    async doFileSearch(query, token) {
        const [fileSearchResults, relativePathFileResults] = await Promise.all([
            // File search: this is a search over all files of the workspace using the provided pattern
            this.getFileSearchResults(query, token),
            // Relative path search: we also want to consider results that match files inside the workspace
            // by looking for relative paths that the user typed as query. This allows to return even excluded
            // results into the picker if found (e.g. helps for opening compilation results that are otherwise
            // excluded)
            this.getRelativePathFileResults(query, token)
        ]);
        if (token.isCancellationRequested) {
            return [];
        }
        // Return quickly if no relative results are present
        if (!relativePathFileResults) {
            return fileSearchResults;
        }
        // Otherwise, make sure to filter relative path results from
        // the search results to prevent duplicates
        const relativePathFileResultsMap = new ResourceMap(uri => this.uriIdentityService.extUri.getComparisonKey(uri));
        for (const relativePathFileResult of relativePathFileResults) {
            relativePathFileResultsMap.set(relativePathFileResult, true);
        }
        return [
            ...fileSearchResults.filter(result => !relativePathFileResultsMap.has(result)),
            ...relativePathFileResults
        ];
    }
    async getFileSearchResults(query, token) {
        // filePattern for search depends on the number of queries in input:
        // - with multiple: only take the first one and let the filter later drop non-matching results
        // - with single: just take the original in full
        //
        // This enables to e.g. search for "someFile someFolder" by only returning
        // search results for "someFile" and not both that would normally not match.
        //
        let filePattern = '';
        if (query.values && query.values.length > 1) {
            filePattern = query.values[0].original;
        }
        else {
            filePattern = query.original;
        }
        const fileSearchResults = await this.doGetFileSearchResults(filePattern, token);
        if (token.isCancellationRequested) {
            return [];
        }
        // If we detect that the search limit has been hit and we have a query
        // that was composed of multiple inputs where we only took the first part
        // we run another search with the full original query included to make
        // sure we are including all possible results that could match.
        if (fileSearchResults.limitHit && query.values && query.values.length > 1) {
            const additionalFileSearchResults = await this.doGetFileSearchResults(query.original, token);
            if (token.isCancellationRequested) {
                return [];
            }
            // Remember which result we already covered
            const existingFileSearchResultsMap = new ResourceMap(uri => this.uriIdentityService.extUri.getComparisonKey(uri));
            for (const fileSearchResult of fileSearchResults.results) {
                existingFileSearchResultsMap.set(fileSearchResult.resource, true);
            }
            // Add all additional results to the original set for inclusion
            for (const additionalFileSearchResult of additionalFileSearchResults.results) {
                if (!existingFileSearchResultsMap.has(additionalFileSearchResult.resource)) {
                    fileSearchResults.results.push(additionalFileSearchResult);
                }
            }
        }
        return fileSearchResults.results.map(result => result.resource);
    }
    doGetFileSearchResults(filePattern, token) {
        const start = Date.now();
        return this.searchService.fileSearch(this.fileQueryBuilder.file(this.contextService.getWorkspace().folders, this.getFileQueryOptions({
            filePattern,
            cacheKey: this.pickState.fileQueryCache?.cacheKey,
            maxResults: AnythingQuickAccessProvider_1.MAX_RESULTS
        })), token).finally(() => {
            this.logService.trace(`QuickAccess fileSearch ${Date.now() - start}ms`);
        });
    }
    getFileQueryOptions(input) {
        return {
            _reason: 'openFileHandler', // used for telemetry - do not change
            extraFileResources: this.instantiationService.invokeFunction(getOutOfWorkspaceEditorResources),
            filePattern: input.filePattern || '',
            cacheKey: input.cacheKey,
            maxResults: input.maxResults || 0,
            sortByScore: true
        };
    }
    async getAbsolutePathFileResult(query, token) {
        if (!query.containsPathSeparator) {
            return;
        }
        const userHome = await this.pathService.userHome();
        const detildifiedQuery = untildify(query.original, userHome.scheme === Schemas.file ? userHome.fsPath : userHome.path);
        if (token.isCancellationRequested) {
            return;
        }
        const isAbsolutePathQuery = (await this.pathService.path).isAbsolute(detildifiedQuery);
        if (token.isCancellationRequested) {
            return;
        }
        if (isAbsolutePathQuery) {
            const resource = toLocalResource(await this.pathService.fileURI(detildifiedQuery), this.environmentService.remoteAuthority, this.pathService.defaultUriScheme);
            if (token.isCancellationRequested) {
                return;
            }
            try {
                const stat = await this.fileService.stat(resource);
                if (stat.isFile) {
                    return await this.matchFilenameCasing(resource);
                }
            }
            catch (error) {
                // ignore if file does not exist
            }
        }
        return;
    }
    async getRelativePathFileResults(query, token) {
        if (!query.containsPathSeparator) {
            return;
        }
        // Convert relative paths to absolute paths over all folders of the workspace
        // and return them as results if the absolute paths exist
        const isAbsolutePathQuery = (await this.pathService.path).isAbsolute(query.original);
        if (!isAbsolutePathQuery) {
            const resources = [];
            for (const folder of this.contextService.getWorkspace().folders) {
                if (token.isCancellationRequested) {
                    break;
                }
                const resource = toLocalResource(folder.toResource(query.original), this.environmentService.remoteAuthority, this.pathService.defaultUriScheme);
                try {
                    const stat = await this.fileService.stat(resource);
                    if (stat.isFile) {
                        resources.push(await this.matchFilenameCasing(resource));
                    }
                }
                catch (error) {
                    // ignore if file does not exist
                }
            }
            return resources;
        }
        return;
    }
    /**
     * Attempts to match the filename casing to file system by checking the parent folder's children.
     */
    async matchFilenameCasing(resource) {
        const parent = dirname(resource);
        const stat = await this.fileService.resolve(parent, { resolveTo: [resource] });
        if (stat?.children) {
            const match = stat.children.find(child => this.uriIdentityService.extUri.isEqual(child.resource, resource));
            if (match) {
                return URI.joinPath(parent, match.name);
            }
        }
        return resource;
    }
    getHelpPicks(query, token, runOptions) {
        if (query.normalized) {
            return []; // If there's a filter, we don't show the help
        }
        const providers = this.lazyRegistry.value.getQuickAccessProviders()
            .filter(p => p.helpEntries.some(h => h.commandCenterOrder !== undefined))
            .flatMap(provider => provider.helpEntries
            .filter(h => h.commandCenterOrder !== undefined)
            .map(helpEntry => {
            const providerSpecificOptions = {
                ...runOptions,
                includeHelp: provider.prefix === AnythingQuickAccessProvider_1.PREFIX ? false : runOptions?.includeHelp
            };
            const label = helpEntry.commandCenterLabel ?? helpEntry.description;
            return {
                label,
                description: helpEntry.prefix ?? provider.prefix,
                commandCenterOrder: helpEntry.commandCenterOrder,
                keybinding: helpEntry.commandId ? this.keybindingService.lookupKeybinding(helpEntry.commandId) : undefined,
                ariaLabel: localize('helpPickAriaLabel', "{0}, {1}", label, helpEntry.description),
                accept: () => {
                    this.quickInputService.quickAccess.show(provider.prefix, {
                        preserveValue: true,
                        providerOptions: providerSpecificOptions
                    });
                }
            };
        }));
        // TODO: There has to be a better place for this, but it's the first time we are adding a non-quick access provider
        // to the command center, so for now, let's do this.
        if (this.quickChatService.enabled) {
            providers.push({
                label: localize('chat', "Open Quick Chat"),
                commandCenterOrder: 30,
                keybinding: this.keybindingService.lookupKeybinding(ASK_QUICK_QUESTION_ACTION_ID),
                accept: () => this.quickChatService.toggle()
            });
        }
        return providers.sort((a, b) => a.commandCenterOrder - b.commandCenterOrder);
    }
    async getWorkspaceSymbolPicks(query, includeSymbols, token) {
        if (!query.normalized || // we need a value for search for
            !includeSymbols || // we need to enable symbols in search
            this.pickState.lastRange // a range is an indicator for just searching for files
        ) {
            return [];
        }
        // Delegate to the existing symbols quick access
        // but skip local results and also do not score
        return this.workspaceSymbolsQuickAccess.getSymbolPicks(query.original, {
            skipLocal: true,
            skipSorting: true,
            delay: AnythingQuickAccessProvider_1.TYPING_SEARCH_DELAY
        }, token);
    }
    getEditorSymbolPicks(query, disposables, token) {
        const filterSegments = query.original.split(GotoSymbolQuickAccessProvider.PREFIX);
        const filter = filterSegments.length > 1 ? filterSegments[filterSegments.length - 1].trim() : undefined;
        if (typeof filter !== 'string') {
            return null; // we need to be searched for editor symbols via `@`
        }
        const activeGlobalPick = this.pickState.lastGlobalPicks?.active;
        if (!activeGlobalPick) {
            return null; // we need an active global pick to find symbols for
        }
        const activeGlobalResource = activeGlobalPick.resource;
        if (!activeGlobalResource || (!this.fileService.hasProvider(activeGlobalResource) && activeGlobalResource.scheme !== Schemas.untitled)) {
            return null; // we need a resource that we can resolve
        }
        if (activeGlobalPick.label.includes(GotoSymbolQuickAccessProvider.PREFIX) || activeGlobalPick.description?.includes(GotoSymbolQuickAccessProvider.PREFIX)) {
            if (filterSegments.length < 3) {
                return null; // require at least 2 `@` if our active pick contains `@` in label or description
            }
        }
        return this.doGetEditorSymbolPicks(activeGlobalPick, activeGlobalResource, filter, disposables, token);
    }
    async doGetEditorSymbolPicks(activeGlobalPick, activeGlobalResource, filter, disposables, token) {
        // Bring the editor to front to review symbols to go to
        try {
            // we must remember our current view state to be able to restore
            this.pickState.editorViewState.set();
            // open it
            await this.pickState.editorViewState.openTransientEditor({
                resource: activeGlobalResource,
                options: { preserveFocus: true, revealIfOpened: true, ignoreError: true }
            });
        }
        catch (error) {
            return []; // return if resource cannot be opened
        }
        if (token.isCancellationRequested) {
            return [];
        }
        // Obtain model from resource
        let model = this.modelService.getModel(activeGlobalResource);
        if (!model) {
            try {
                const modelReference = disposables.add(await this.textModelService.createModelReference(activeGlobalResource));
                if (token.isCancellationRequested) {
                    return [];
                }
                model = modelReference.object.textEditorModel;
            }
            catch (error) {
                return []; // return if model cannot be resolved
            }
        }
        // Ask provider for editor symbols
        const editorSymbolPicks = (await this.editorSymbolsQuickAccess.getSymbolPicks(model, filter, { extraContainerLabel: stripIcons(activeGlobalPick.label) }, disposables, token));
        if (token.isCancellationRequested) {
            return [];
        }
        return editorSymbolPicks.map(editorSymbolPick => {
            // Preserve separators
            if (editorSymbolPick.type === 'separator') {
                return editorSymbolPick;
            }
            // Convert editor symbols to anything pick
            return {
                ...editorSymbolPick,
                resource: activeGlobalResource,
                description: editorSymbolPick.description,
                trigger: (buttonIndex, keyMods) => {
                    this.openAnything(activeGlobalResource, { keyMods, range: editorSymbolPick.range?.selection, forceOpenSideBySide: true });
                    return TriggerAction.CLOSE_PICKER;
                },
                accept: (keyMods, event) => this.openAnything(activeGlobalResource, { keyMods, range: editorSymbolPick.range?.selection, preserveFocus: event.inBackground, forcePinned: event.inBackground })
            };
        });
    }
    addDecorations(editor, range) {
        this.editorSymbolsQuickAccess.addDecorations(editor, range);
    }
    clearDecorations(editor) {
        this.editorSymbolsQuickAccess.clearDecorations(editor);
    }
    //#endregion
    //#region Helpers
    createAnythingPick(resourceOrEditor, configuration) {
        const isEditorHistoryEntry = !URI.isUri(resourceOrEditor);
        let resource;
        let label;
        let description = undefined;
        let isDirty = undefined;
        let extraClasses;
        let icon = undefined;
        if (isEditorInput(resourceOrEditor)) {
            resource = EditorResourceAccessor.getOriginalUri(resourceOrEditor);
            label = resourceOrEditor.getName();
            description = resourceOrEditor.getDescription();
            isDirty = resourceOrEditor.isDirty() && !resourceOrEditor.isSaving();
            extraClasses = resourceOrEditor.getLabelExtraClasses();
            icon = resourceOrEditor.getIcon();
        }
        else {
            resource = URI.isUri(resourceOrEditor) ? resourceOrEditor : resourceOrEditor.resource;
            const customLabel = this.customEditorLabelService.getName(resource);
            label = customLabel || basenameOrAuthority(resource);
            description = this.labelService.getUriLabel(!!customLabel ? resource : dirname(resource), { relative: true });
            isDirty = this.workingCopyService.isDirty(resource) && !this.filesConfigurationService.hasShortAutoSaveDelay(resource);
            extraClasses = [];
        }
        const labelAndDescription = description ? `${label} ${description}` : label;
        const iconClassesValue = new Lazy(() => getIconClasses(this.modelService, this.languageService, resource, undefined, icon).concat(extraClasses));
        const buttonsValue = new Lazy(() => {
            const openSideBySideDirection = configuration.openSideBySideDirection;
            const buttons = [];
            // Open to side / below
            buttons.push({
                iconClass: openSideBySideDirection === 'right' ? ThemeIcon.asClassName(Codicon.splitHorizontal) : ThemeIcon.asClassName(Codicon.splitVertical),
                tooltip: openSideBySideDirection === 'right' ?
                    localize({ key: 'openToSide', comment: ['Open this file in a split editor on the left/right side'] }, "Open to the Side") :
                    localize({ key: 'openToBottom', comment: ['Open this file in a split editor on the bottom'] }, "Open to the Bottom")
            });
            // Remove from History
            if (isEditorHistoryEntry) {
                buttons.push({
                    iconClass: isDirty ? ('dirty-anything ' + ThemeIcon.asClassName(Codicon.circleFilled)) : ThemeIcon.asClassName(Codicon.close),
                    tooltip: localize('closeEditor', "Remove from Recently Opened"),
                    alwaysVisible: isDirty
                });
            }
            return buttons;
        });
        return {
            resource,
            label,
            ariaLabel: isDirty ? localize('filePickAriaLabelDirty', "{0} unsaved changes", labelAndDescription) : labelAndDescription,
            description,
            get iconClasses() { return iconClassesValue.value; },
            get buttons() { return buttonsValue.value; },
            trigger: (buttonIndex, keyMods) => {
                switch (buttonIndex) {
                    // Open to side / below
                    case 0:
                        this.openAnything(resourceOrEditor, { keyMods, range: this.pickState.lastRange, forceOpenSideBySide: true });
                        return TriggerAction.CLOSE_PICKER;
                    // Remove from History
                    case 1:
                        if (!URI.isUri(resourceOrEditor)) {
                            this.historyService.removeFromHistory(resourceOrEditor);
                            return TriggerAction.REMOVE_ITEM;
                        }
                }
                return TriggerAction.NO_ACTION;
            },
            accept: (keyMods, event) => this.openAnything(resourceOrEditor, { keyMods, range: this.pickState.lastRange, preserveFocus: event.inBackground, forcePinned: event.inBackground })
        };
    }
    async openAnything(resourceOrEditor, options) {
        // Craft some editor options based on quick access usage
        const editorOptions = {
            preserveFocus: options.preserveFocus,
            pinned: options.keyMods?.ctrlCmd || options.forcePinned || this.configuration.openEditorPinned,
            selection: options.range ? Range.collapseToStart(options.range) : undefined
        };
        const targetGroup = options.keyMods?.alt || (this.configuration.openEditorPinned && options.keyMods?.ctrlCmd) || options.forceOpenSideBySide ? SIDE_GROUP : ACTIVE_GROUP;
        // Restore any view state if the target is the side group
        if (targetGroup === SIDE_GROUP) {
            await this.pickState.editorViewState.restore();
        }
        // Open editor (typed)
        if (isEditorInput(resourceOrEditor)) {
            await this.editorService.openEditor(resourceOrEditor, editorOptions, targetGroup);
        }
        // Open editor (untyped)
        else {
            let resourceEditorInput;
            if (URI.isUri(resourceOrEditor)) {
                resourceEditorInput = {
                    resource: resourceOrEditor,
                    options: editorOptions
                };
            }
            else {
                resourceEditorInput = {
                    ...resourceOrEditor,
                    options: {
                        ...resourceOrEditor.options,
                        ...editorOptions
                    }
                };
            }
            await this.editorService.openEditor(resourceEditorInput, targetGroup);
        }
    }
};
AnythingQuickAccessProvider = AnythingQuickAccessProvider_1 = __decorate([
    __param(0, IInstantiationService),
    __param(1, ISearchService),
    __param(2, IWorkspaceContextService),
    __param(3, IPathService),
    __param(4, IWorkbenchEnvironmentService),
    __param(5, IFileService),
    __param(6, ILabelService),
    __param(7, IModelService),
    __param(8, ILanguageService),
    __param(9, IWorkingCopyService),
    __param(10, IConfigurationService),
    __param(11, IEditorService),
    __param(12, IHistoryService),
    __param(13, IFilesConfigurationService),
    __param(14, ITextModelService),
    __param(15, IUriIdentityService),
    __param(16, IQuickInputService),
    __param(17, IKeybindingService),
    __param(18, IQuickChatService),
    __param(19, ILogService),
    __param(20, ICustomEditorLabelService)
], AnythingQuickAccessProvider);
export { AnythingQuickAccessProvider };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW55dGhpbmdRdWlja0FjY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9hbnl0aGluZ1F1aWNrQWNjZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLGlDQUFpQyxDQUFDO0FBQ3pDLE9BQU8sRUFBK0IsMkJBQTJCLEVBQUUsMkJBQTJCLEVBQTBDLG9CQUFvQixFQUFFLGtCQUFrQixFQUF1QixNQUFNLHNEQUFzRCxDQUFDO0FBQ3BRLE9BQU8sRUFBMEIseUJBQXlCLEVBQUUsYUFBYSxFQUE0QyxNQUFNLDhEQUE4RCxDQUFDO0FBQzFMLE9BQU8sRUFBRSxZQUFZLEVBQWtCLHdCQUF3QixFQUFFLGNBQWMsRUFBb0IsTUFBTSx3Q0FBd0MsQ0FBQztBQUNsSixPQUFPLEVBQTRCLFlBQVksRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSxzQkFBc0IsRUFBaUMsTUFBTSxxQkFBcUIsQ0FBQztBQUM5SCxPQUFPLEVBQUUsY0FBYyxFQUFtQixNQUFNLDJDQUEyQyxDQUFDO0FBQzVGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDNUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDckcsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDMUcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBRTFFLE9BQU8sRUFBRSxlQUFlLEVBQWUsWUFBWSxFQUFFLGlCQUFpQixFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pJLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdEYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNqRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQWlDLHNCQUFzQixFQUFFLGFBQWEsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBRWpILE9BQU8sRUFBRSxjQUFjLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzVHLE9BQU8sRUFBRSxLQUFLLEVBQVUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNwRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEQsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDOUQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRTlFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSwwRUFBMEUsQ0FBQztBQUN0SCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDN0QsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDckUsT0FBTyxFQUF5Qyw2QkFBNkIsRUFBRSxVQUFVLEVBQXdCLE1BQU0sdURBQXVELENBQUM7QUFDL0ssT0FBTyxFQUFFLGlCQUFpQixFQUFzQyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3hHLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQzlHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBRTFGLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzVFLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQy9ELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQVN4RyxTQUFTLDJCQUEyQixDQUFDLElBQTZCO0lBQ2pFLE1BQU0sU0FBUyxHQUFHLElBQXNELENBQUM7SUFFekUsT0FBTyxDQUFDLENBQUMsU0FBUyxFQUFFLEtBQUssSUFBSSxDQUFDLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQztBQUNuRCxDQUFDO0FBd0JNLElBQU0sMkJBQTJCLEdBQWpDLE1BQU0sMkJBQTRCLFNBQVEseUJBQWlEOzthQUUxRixXQUFNLEdBQUcsRUFBRSxBQUFMLENBQU07YUFFSyxvQkFBZSxHQUEyQjtRQUNqRSxLQUFLLEVBQUUsUUFBUSxDQUFDLG1CQUFtQixFQUFFLHFCQUFxQixDQUFDO0tBQzNELEFBRnNDLENBRXJDO2FBRXNCLGdCQUFXLEdBQUcsR0FBRyxBQUFOLENBQU87YUFFbEIsd0JBQW1CLEdBQUcsR0FBRyxBQUFOLENBQU8sR0FBQyw4RkFBOEY7YUFFbEksNkJBQXdCLEdBQUcsR0FBRyxBQUFOLENBQU8sR0FBQyxvRUFBb0U7SUFJbkgsSUFBSSxrQkFBa0I7UUFDckIsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3RDLE9BQU8sNkJBQTZCLENBQUMsSUFBSSxDQUFDO1FBQzNDLENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsWUFDd0Isb0JBQTRELEVBQ25FLGFBQThDLEVBQ3BDLGNBQXlELEVBQ3JFLFdBQTBDLEVBQzFCLGtCQUFpRSxFQUNqRixXQUEwQyxFQUN6QyxZQUE0QyxFQUM1QyxZQUE0QyxFQUN6QyxlQUFrRCxFQUMvQyxrQkFBd0QsRUFDdEQsb0JBQTRELEVBQ25FLGFBQThDLEVBQzdDLGNBQWdELEVBQ3JDLHlCQUFzRSxFQUMvRSxnQkFBb0QsRUFDbEQsa0JBQXdELEVBQ3pELGlCQUFzRCxFQUN0RCxpQkFBc0QsRUFDdkQsZ0JBQW9ELEVBQzFELFVBQXdDLEVBQzFCLHdCQUFvRTtRQUUvRixLQUFLLENBQUMsNkJBQTJCLENBQUMsTUFBTSxFQUFFO1lBQ3pDLHFCQUFxQixFQUFFLElBQUk7WUFDM0IsYUFBYSxFQUFFLDZCQUEyQixDQUFDLGVBQWU7U0FDMUQsQ0FBQyxDQUFDO1FBekJxQyx5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXVCO1FBQ2xELGtCQUFhLEdBQWIsYUFBYSxDQUFnQjtRQUNuQixtQkFBYyxHQUFkLGNBQWMsQ0FBMEI7UUFDcEQsZ0JBQVcsR0FBWCxXQUFXLENBQWM7UUFDVCx1QkFBa0IsR0FBbEIsa0JBQWtCLENBQThCO1FBQ2hFLGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBQ3hCLGlCQUFZLEdBQVosWUFBWSxDQUFlO1FBQzNCLGlCQUFZLEdBQVosWUFBWSxDQUFlO1FBQ3hCLG9CQUFlLEdBQWYsZUFBZSxDQUFrQjtRQUM5Qix1QkFBa0IsR0FBbEIsa0JBQWtCLENBQXFCO1FBQ3JDLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBdUI7UUFDbEQsa0JBQWEsR0FBYixhQUFhLENBQWdCO1FBQzVCLG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUNwQiw4QkFBeUIsR0FBekIseUJBQXlCLENBQTRCO1FBQzlELHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBbUI7UUFDakMsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFxQjtRQUN4QyxzQkFBaUIsR0FBakIsaUJBQWlCLENBQW9CO1FBQ3JDLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBb0I7UUFDdEMscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFtQjtRQUN6QyxlQUFVLEdBQVYsVUFBVSxDQUFhO1FBQ1QsNkJBQXdCLEdBQXhCLHdCQUF3QixDQUEyQjtRQWtXaEcsd0JBQXdCO1FBRVAsdUNBQWtDLEdBQUcsSUFBSSwyQkFBMkIsQ0FBQyxFQUFFLGVBQWUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBK0NqSCxZQUFZO1FBR1oscUJBQXFCO1FBRUoscUJBQWdCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGdCQUFnQixDQUFRLDZCQUEyQixDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztRQTZRakksWUFBWTtRQUVaLHFDQUFxQztRQUVwQixpQkFBWSxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQXVCLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBbHFCekcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksS0FBTSxTQUFRLFVBQVU7WUFpQjNELFlBQ2tCLFFBQXFDLEVBQ3RELG9CQUEyQztnQkFFM0MsS0FBSyxFQUFFLENBQUM7Z0JBSFMsYUFBUSxHQUFSLFFBQVEsQ0FBNkI7Z0JBaEJ2RCxXQUFNLEdBQTRFLFNBQVMsQ0FBQztnQkFJNUYsZ0JBQVcsR0FBcUIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDcEQsbUJBQWMsR0FBb0MsU0FBUyxDQUFDO2dCQUU1RCx1QkFBa0IsR0FBdUIsU0FBUyxDQUFDO2dCQUNuRCxlQUFVLEdBQXVCLFNBQVMsQ0FBQztnQkFDM0MsY0FBUyxHQUF1QixTQUFTLENBQUM7Z0JBRTFDLG9CQUFlLEdBQXdELFNBQVMsQ0FBQztnQkFFakYsc0JBQWlCLEdBQXdCLFNBQVMsQ0FBQztnQkFPbEQsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7WUFDL0YsQ0FBQztZQUVELEdBQUcsQ0FBQyxNQUFtRTtnQkFFdEUsc0JBQXNCO2dCQUN0QixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztnQkFDckIsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxFQUFFO29CQUNqQyxJQUFJLE1BQU0sS0FBSyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7d0JBQzVCLElBQUksQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDLENBQUMsdUVBQXVFO29CQUNqRyxDQUFDO2dCQUNGLENBQUMsQ0FBQyxDQUFDO2dCQUVILFNBQVM7Z0JBQ1QsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQztnQkFDakQsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7b0JBQ3hCLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO29CQUMzRCxJQUFJLENBQUMsV0FBVyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3hDLENBQUM7Z0JBRUQsUUFBUTtnQkFDUixJQUFJLENBQUMsaUJBQWlCLEdBQUcsaUJBQWlCLENBQUM7Z0JBQzNDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxTQUFTLENBQUM7Z0JBQ3BDLElBQUksQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO2dCQUM1QixJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztnQkFDM0IsSUFBSSxDQUFDLGVBQWUsR0FBRyxTQUFTLENBQUM7Z0JBQ2pDLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDOUIsQ0FBQztTQUNELENBQUMsSUFBSSxFQUFFLG9CQUFvQixDQUFDLENBQUMsQ0FBQztRQUUvQixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUMvRSxJQUFJLENBQUMsMkJBQTJCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDO1FBQ25ILElBQUksQ0FBQyx3QkFBd0IsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLDZCQUE2QixDQUFDLENBQUM7SUFDekcsQ0FBQztJQUVELElBQVksYUFBYTtRQUN4QixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsUUFBUSxFQUFpQyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUM7UUFDM0csTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsRUFBaUMsQ0FBQyxNQUFNLENBQUM7UUFDaEcsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsUUFBUSxFQUFzQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUM7UUFFdkgsT0FBTztZQUNOLGdCQUFnQixFQUFFLENBQUMsWUFBWSxFQUFFLDBCQUEwQixJQUFJLENBQUMsWUFBWSxFQUFFLGFBQWE7WUFDM0YsdUJBQXVCLEVBQUUsWUFBWSxFQUFFLHVCQUF1QjtZQUM5RCxjQUFjLEVBQUUsWUFBWSxFQUFFLFNBQVMsQ0FBQyxjQUFjO1lBQ3RELGNBQWMsRUFBRSxZQUFZLEVBQUUsU0FBUyxDQUFDLGNBQWM7WUFDdEQsc0JBQXNCLEVBQUUsWUFBWSxFQUFFLFNBQVMsQ0FBQyxPQUFPLENBQUMsZUFBZTtZQUN2RSxhQUFhLEVBQUUsaUJBQWlCLENBQUMsYUFBYTtTQUM5QyxDQUFDO0lBQ0gsQ0FBQztJQUVRLE9BQU8sQ0FBQyxNQUFtRSxFQUFFLEtBQXdCLEVBQUUsVUFBa0Q7UUFDakssTUFBTSxXQUFXLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztRQUUxQyxxQ0FBcUM7UUFDckMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFM0Isd0RBQXdEO1FBQ3hELE1BQU0sMkJBQTJCLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUM3RSxXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLEVBQUU7WUFFN0Msd0JBQXdCO1lBQ3hCLDJCQUEyQixDQUFDLEtBQUssR0FBRyxTQUFTLENBQUM7WUFFOUMsZ0RBQWdEO1lBQ2hELE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDO1lBQ2xDLElBQUksMkJBQTJCLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDdkMsMkJBQTJCLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM3RSxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLHdEQUF3RDtRQUN4RCx3REFBd0Q7UUFDeEQsd0RBQXdEO1FBQ3hELHdEQUF3RDtRQUN4RCxXQUFXLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFO1lBQzNELElBQUksTUFBTSxLQUFLLG9CQUFvQixDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUM3QyxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUMxQyxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLGVBQWU7UUFDZixXQUFXLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBRTFELE9BQU8sV0FBVyxDQUFDO0lBQ3BCLENBQUM7SUFFTyw0QkFBNEIsQ0FBQyxJQUF3QztRQUM1RSxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQztRQUNyRCxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxZQUFZLEVBQUUsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUNwRixPQUFPLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyx5Q0FBeUM7UUFDbEUsQ0FBQztRQUVELE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQztRQUN2RSxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztZQUMxQixPQUFPLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyx1REFBdUQ7UUFDaEYsQ0FBQztRQUVELGdFQUFnRTtRQUNoRSxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUVyQyxTQUFTO1FBQ1QsbUJBQW1CLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLDRCQUFvQixDQUFDO1FBRWpGLFdBQVc7UUFDWCxJQUFJLENBQUMsY0FBYyxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFaEUsT0FBTyxZQUFZLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRVMsU0FBUyxDQUFDLGNBQXNCLEVBQUUsV0FBNEIsRUFBRSxLQUF3QixFQUFFLFVBQWtEO1FBRXJKLHFFQUFxRTtRQUNyRSxtRUFBbUU7UUFDbkUsTUFBTSxlQUFlLEdBQUcsc0JBQXNCLENBQUMsY0FBYyxFQUFFLENBQUMsNkJBQTZCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUV2Ryx1Q0FBdUM7UUFDdkMsSUFBSSxNQUFjLENBQUM7UUFDbkIsSUFBSSxlQUFlLEVBQUUsQ0FBQztZQUNyQixNQUFNLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQztRQUNqQyxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sR0FBRyxjQUFjLENBQUM7UUFDekIsQ0FBQztRQUVELHlCQUF5QjtRQUN6QixJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxlQUFlLEVBQUUsS0FBSyxDQUFDO1FBRWxELDhEQUE4RDtRQUM5RCwrREFBK0Q7UUFDL0QsaUVBQWlFO1FBQ2pFLDhEQUE4RDtRQUM5RCxJQUFJLGNBQWMsS0FBSyxJQUFJLENBQUMsU0FBUyxDQUFDLGtCQUFrQixJQUFJLE1BQU0sS0FBSyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2xHLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELDBCQUEwQjtRQUMxQixNQUFNLGdCQUFnQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDO1FBQzdELElBQUksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLEdBQUcsY0FBYyxDQUFDO1FBQ25ELElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQztRQUVuQyxxREFBcUQ7UUFDckQsMERBQTBEO1FBQzFELDBEQUEwRDtRQUMxRCx5REFBeUQ7UUFDekQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDO1FBQzNDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN6RCxJQUFJLEtBQUssSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUN6QixNQUFNLHdCQUF3QixHQUFHLDJCQUEyQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3pFLE1BQU0sb0NBQW9DLEdBQUcsVUFBVSxLQUFLLDZCQUEyQixDQUFDLGVBQWUsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLDZCQUE2QixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNySyxJQUFJLENBQUMsd0JBQXdCLElBQUksQ0FBQyxvQ0FBb0MsRUFBRSxDQUFDO2dCQUN4RSxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsR0FBRztvQkFDaEMsS0FBSyxFQUFFLEtBQUs7b0JBQ1osTUFBTSxFQUFFLFVBQVU7aUJBQ2xCLENBQUM7WUFDSCxDQUFDO1FBQ0YsQ0FBQztRQUVELG1FQUFtRTtRQUNuRSxrRUFBa0U7UUFDbEUsaUVBQWlFO1FBQ2pFLHNFQUFzRTtRQUN0RSxxRUFBcUU7UUFDckUsa0VBQWtFO1FBQ2xFLGdFQUFnRTtRQUNoRSx5REFBeUQ7UUFDekQsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUNyQixNQUFNLEVBQ047WUFDQyxHQUFHLFVBQVU7WUFDYix3QkFBd0IsRUFBRSxnQkFBZ0I7U0FDMUMsRUFDRCxXQUFXLEVBQ1gsS0FBSyxDQUNMLENBQUM7SUFDSCxDQUFDO0lBRU8sVUFBVSxDQUNqQixNQUFjLEVBQ2QsT0FBc0YsRUFDdEYsV0FBNEIsRUFDNUIsS0FBd0I7UUFFeEIsTUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRW5DLG1FQUFtRTtRQUNuRSx5REFBeUQ7UUFDekQsd0RBQXdEO1FBQ3hELElBQUksT0FBTyxDQUFDLHdCQUF3QixFQUFFLENBQUM7WUFDdEMsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxFQUFFLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUMvRSxJQUFJLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3ZCLE9BQU8saUJBQWlCLENBQUM7WUFDMUIsQ0FBQztRQUNGLENBQUM7UUFFRCx1RUFBdUU7UUFDdkUsbUVBQW1FO1FBQ25FLG1EQUFtRDtRQUNuRCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekQsSUFBSSwyQkFBMkIsQ0FBQyxVQUFVLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQy9FLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUM7UUFDdkMsQ0FBQztRQUVELGlFQUFpRTtRQUNqRSxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUU3RCxJQUFJLEtBQUssR0FBRyxJQUFJLEtBQUssRUFBZ0QsQ0FBQztRQUN0RSxJQUFJLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUMzQixLQUFLLE1BQU0sSUFBSSxJQUFJLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBQztnQkFDMUMsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFdBQVcsRUFBRSxDQUFDO29CQUMvQixLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUNqQixTQUFTO2dCQUNWLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFDckIsSUFBSSxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUM7b0JBQzVCLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2pCLFNBQVM7Z0JBQ1YsQ0FBQztnQkFDRCxNQUFNLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLGNBQWMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSwyQkFBMkIsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUMzSSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7b0JBQ1osU0FBUztnQkFDVixDQUFDO2dCQUNELElBQUksQ0FBQyxVQUFVLEdBQUc7b0JBQ2pCLEtBQUssRUFBRSxVQUFVO29CQUNqQixXQUFXLEVBQUUsZ0JBQWdCO2lCQUM3QixDQUFDO2dCQUNGLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbEIsQ0FBQztRQUNGLENBQUM7UUFDRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUN0QyxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ3RCLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMseUJBQXlCLEVBQUUsaUJBQWlCLENBQUMsRUFBZ0MsQ0FBQyxDQUFDO1lBQ2hJLENBQUM7WUFDRCxLQUFLLEdBQUcsa0JBQWtCLENBQUM7UUFDNUIsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDekIsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ3pELENBQUM7WUFDRCxJQUFJLGtCQUFrQixDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDckMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSxpQkFBaUIsQ0FBQyxFQUFnQyxDQUFDLENBQUM7Z0JBQy9ILEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxrQkFBa0IsQ0FBQyxDQUFDO1lBQ25DLENBQUM7UUFDRixDQUFDO1FBRUQsT0FBTztZQUVOLGtEQUFrRDtZQUNsRCxLQUFLLEVBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUs7WUFFeEUsZ0NBQWdDO1lBQ2hDLGVBQWUsRUFBRSxDQUFDLEtBQUssSUFBNEMsRUFBRTtnQkFFcEUsZ0VBQWdFO2dCQUNoRSxNQUFNLHVCQUF1QixHQUFHLElBQUksV0FBVyxDQUFVLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUN0SCxLQUFLLE1BQU0saUJBQWlCLElBQUksa0JBQWtCLEVBQUUsQ0FBQztvQkFDcEQsSUFBSSxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsQ0FBQzt3QkFDaEMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDL0QsQ0FBQztnQkFDRixDQUFDO2dCQUVELElBQUksZUFBZSxHQUFHLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssRUFBRSx1QkFBdUIsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDOUgsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQ3BCLGVBQWUsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdEUsQ0FBQztnQkFDRCxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO29CQUNuQyxPQUFPLEVBQUUsQ0FBQztnQkFDWCxDQUFDO2dCQUVELE9BQU8sZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNuQyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsK0JBQStCLEVBQUUseUJBQXlCLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLHNCQUFzQixFQUFFLGNBQWMsQ0FBQyxFQUFFO29CQUN6TCxHQUFHLGVBQWU7aUJBQ2xCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNSLENBQUMsQ0FBQyxFQUFFO1lBRUosa0VBQWtFO1lBQ2xFLFVBQVUsRUFBRSw2QkFBMkIsQ0FBQyx3QkFBd0I7U0FDaEUsQ0FBQztJQUNILENBQUM7SUFFTyxLQUFLLENBQUMsa0JBQWtCLENBQUMsS0FBcUIsRUFBRSxRQUE4QixFQUFFLGNBQXVCLEVBQUUsS0FBd0I7UUFFeEksNkNBQTZDO1FBQzdDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsV0FBVyxDQUFDLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDO1lBQ2xELElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUM7WUFDekMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssRUFBRSxjQUFjLEVBQUUsS0FBSyxDQUFDO1NBQzFELENBQUMsQ0FBQztRQUVILElBQUksS0FBSyxDQUFDLHVCQUF1QixFQUFFLENBQUM7WUFDbkMsT0FBTyxFQUFFLENBQUM7UUFDWCxDQUFDO1FBRUQseUNBQXlDO1FBQ3pDLE1BQU0sbUJBQW1CLEdBQUcsR0FBRyxDQUM5QixDQUFDLEdBQUcsU0FBUyxFQUFFLEdBQUcsV0FBVyxDQUFDLEVBQzlCLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxFQUFFLENBQUMsd0JBQXdCLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLDJCQUEyQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLEVBQzFJLDZCQUEyQixDQUFDLFdBQVcsQ0FDdkMsQ0FBQztRQUVGLG9CQUFvQjtRQUNwQixNQUFNLHFCQUFxQixHQUE2QixFQUFFLENBQUM7UUFDM0QsS0FBSyxNQUFNLFlBQVksSUFBSSxtQkFBbUIsRUFBRSxDQUFDO1lBRWhELHdFQUF3RTtZQUN4RSxJQUFJLFlBQVksQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDN0IscUJBQXFCLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQzFDLENBQUM7WUFFRCw4Q0FBOEM7aUJBQ3pDLENBQUM7Z0JBQ0wsTUFBTSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxjQUFjLENBQUMsWUFBWSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsMkJBQTJCLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDbkosSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUNaLFNBQVM7Z0JBQ1YsQ0FBQztnQkFFRCxZQUFZLENBQUMsVUFBVSxHQUFHO29CQUN6QixLQUFLLEVBQUUsVUFBVTtvQkFDakIsV0FBVyxFQUFFLGdCQUFnQjtpQkFDN0IsQ0FBQztnQkFFRixxQkFBcUIsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDMUMsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLHFCQUFxQixDQUFDO0lBQzlCLENBQUM7SUFPTyxxQkFBcUIsQ0FBQyxLQUFxQjtRQUNsRCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO1FBRXpDLG1EQUFtRDtRQUNuRCxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3ZCLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUM7UUFDdkcsQ0FBQztRQUVELElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3hDLE9BQU8sRUFBRSxDQUFDLENBQUMsMEJBQTBCO1FBQ3RDLENBQUM7UUFFRCxvQkFBb0I7UUFDcEIsTUFBTSwyQkFBMkIsR0FBRyxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsa0NBQWtDLENBQUMsQ0FBQywrRUFBK0U7UUFDeE4sTUFBTSxrQkFBa0IsR0FBa0MsRUFBRSxDQUFDO1FBQzdELEtBQUssTUFBTSxNQUFNLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBQ3ZELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUM7WUFDakMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNmLFNBQVM7WUFDVixDQUFDO1lBRUQsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1lBRXpFLE1BQU0sRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLGdCQUFnQixFQUFFLEdBQUcsY0FBYyxDQUFDLGlCQUFpQixFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsMkJBQTJCLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUN6SixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ1osU0FBUyxDQUFDLHFDQUFxQztZQUNoRCxDQUFDO1lBRUQsaUJBQWlCLENBQUMsVUFBVSxHQUFHO2dCQUM5QixLQUFLLEVBQUUsVUFBVTtnQkFDakIsV0FBVyxFQUFFLGdCQUFnQjthQUM3QixDQUFDO1lBRUYsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUVELDZEQUE2RDtRQUM3RCxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsc0JBQXNCLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDN0QsT0FBTyxrQkFBa0IsQ0FBQztRQUMzQixDQUFDO1FBRUQsa0JBQWtCO1FBQ2xCLE9BQU8sa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxFQUFFLENBQUMsd0JBQXdCLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLDJCQUEyQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztJQUN6SyxDQUFDO0lBV08sb0JBQW9CO1FBQzNCLE9BQU8sSUFBSSxtQkFBbUIsQ0FDN0IsUUFBUSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxFQUFFLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUMsRUFDMUgsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFDN0MsUUFBUSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFDbkQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQzdCLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDVixDQUFDO0lBRU8sS0FBSyxDQUFDLFlBQVksQ0FBQyxLQUFxQixFQUFFLFFBQThCLEVBQUUsS0FBd0I7UUFDekcsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUN2QixPQUFPLEVBQUUsQ0FBQztRQUNYLENBQUM7UUFFRCx1QkFBdUI7UUFDdkIsTUFBTSxrQkFBa0IsR0FBRyxNQUFNLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDOUUsSUFBSSxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztZQUNuQyxPQUFPLEVBQUUsQ0FBQztRQUNYLENBQUM7UUFFRCxzREFBc0Q7UUFDdEQsSUFBSSxXQUF1QixDQUFDO1FBQzVCLElBQUksa0JBQWtCLEVBQUUsQ0FBQztZQUN4QixJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUFDO2dCQUN0QyxPQUFPLEVBQUUsQ0FBQyxDQUFDLFdBQVc7WUFDdkIsQ0FBQztZQUVELDBEQUEwRDtZQUMxRCxzREFBc0Q7WUFDdEQseURBQXlEO1lBQ3pELDBEQUEwRDtZQUMxRCxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDekYsZ0JBQWdCLENBQUMsVUFBVSxHQUFHO2dCQUM3QixLQUFLLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDekQsV0FBVyxFQUFFLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO2FBQ2hILENBQUM7WUFFRixPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUMzQixDQUFDO1FBRUQsMkVBQTJFO1FBQzNFLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsUUFBUSxFQUFFLENBQUM7WUFDN0MsV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDckQsQ0FBQzthQUFNLENBQUM7WUFDUCxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLEtBQUssSUFBSSxFQUFFO2dCQUM1RCxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO29CQUNuQyxPQUFPLEVBQUUsQ0FBQztnQkFDWCxDQUFDO2dCQUVELE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDeEMsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsSUFBSSxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztZQUNuQyxPQUFPLEVBQUUsQ0FBQztRQUNYLENBQUM7UUFFRCxxQ0FBcUM7UUFDckMsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztRQUN6QyxPQUFPLFdBQVc7YUFDaEIsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2FBQzNDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQztJQUNyRSxDQUFDO0lBRU8sS0FBSyxDQUFDLFlBQVksQ0FBQyxLQUFxQixFQUFFLEtBQXdCO1FBQ3pFLE1BQU0sQ0FBQyxpQkFBaUIsRUFBRSx1QkFBdUIsQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQztZQUV0RSwyRkFBMkY7WUFDM0YsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssRUFBRSxLQUFLLENBQUM7WUFFdkMsK0ZBQStGO1lBQy9GLGtHQUFrRztZQUNsRyxrR0FBa0c7WUFDbEcsWUFBWTtZQUNaLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDO1NBQzdDLENBQUMsQ0FBQztRQUVILElBQUksS0FBSyxDQUFDLHVCQUF1QixFQUFFLENBQUM7WUFDbkMsT0FBTyxFQUFFLENBQUM7UUFDWCxDQUFDO1FBRUQsb0RBQW9EO1FBQ3BELElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQzlCLE9BQU8saUJBQWlCLENBQUM7UUFDMUIsQ0FBQztRQUVELDREQUE0RDtRQUM1RCwyQ0FBMkM7UUFDM0MsTUFBTSwwQkFBMEIsR0FBRyxJQUFJLFdBQVcsQ0FBVSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN6SCxLQUFLLE1BQU0sc0JBQXNCLElBQUksdUJBQXVCLEVBQUUsQ0FBQztZQUM5RCwwQkFBMEIsQ0FBQyxHQUFHLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDOUQsQ0FBQztRQUVELE9BQU87WUFDTixHQUFHLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsMEJBQTBCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzlFLEdBQUcsdUJBQXVCO1NBQzFCLENBQUM7SUFDSCxDQUFDO0lBRU8sS0FBSyxDQUFDLG9CQUFvQixDQUFDLEtBQXFCLEVBQUUsS0FBd0I7UUFFakYsb0VBQW9FO1FBQ3BFLDhGQUE4RjtRQUM5RixnREFBZ0Q7UUFDaEQsRUFBRTtRQUNGLDBFQUEwRTtRQUMxRSw0RUFBNEU7UUFDNUUsRUFBRTtRQUNGLElBQUksV0FBVyxHQUFHLEVBQUUsQ0FBQztRQUNyQixJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDN0MsV0FBVyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO1FBQ3hDLENBQUM7YUFBTSxDQUFDO1lBQ1AsV0FBVyxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUM7UUFDOUIsQ0FBQztRQUVELE1BQU0saUJBQWlCLEdBQUcsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2hGLElBQUksS0FBSyxDQUFDLHVCQUF1QixFQUFFLENBQUM7WUFDbkMsT0FBTyxFQUFFLENBQUM7UUFDWCxDQUFDO1FBRUQsc0VBQXNFO1FBQ3RFLHlFQUF5RTtRQUN6RSxzRUFBc0U7UUFDdEUsK0RBQStEO1FBQy9ELElBQUksaUJBQWlCLENBQUMsUUFBUSxJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDM0UsTUFBTSwyQkFBMkIsR0FBRyxNQUFNLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzdGLElBQUksS0FBSyxDQUFDLHVCQUF1QixFQUFFLENBQUM7Z0JBQ25DLE9BQU8sRUFBRSxDQUFDO1lBQ1gsQ0FBQztZQUVELDJDQUEyQztZQUMzQyxNQUFNLDRCQUE0QixHQUFHLElBQUksV0FBVyxDQUFVLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQzNILEtBQUssTUFBTSxnQkFBZ0IsSUFBSSxpQkFBaUIsQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDMUQsNEJBQTRCLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNuRSxDQUFDO1lBRUQsK0RBQStEO1lBQy9ELEtBQUssTUFBTSwwQkFBMEIsSUFBSSwyQkFBMkIsQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDOUUsSUFBSSxDQUFDLDRCQUE0QixDQUFDLEdBQUcsQ0FBQywwQkFBMEIsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO29CQUM1RSxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLENBQUM7Z0JBQzVELENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUVELE9BQU8saUJBQWlCLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRU8sc0JBQXNCLENBQUMsV0FBbUIsRUFBRSxLQUF3QjtRQUMzRSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDekIsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FDbkMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FDekIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxPQUFPLEVBQzFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQztZQUN4QixXQUFXO1lBQ1gsUUFBUSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLFFBQVE7WUFDakQsVUFBVSxFQUFFLDZCQUEyQixDQUFDLFdBQVc7U0FDbkQsQ0FBQyxDQUNGLEVBQUUsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtZQUN0QixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQywwQkFBMEIsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLEtBQUssSUFBSSxDQUFDLENBQUM7UUFDekUsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8sbUJBQW1CLENBQUMsS0FBdUU7UUFDbEcsT0FBTztZQUNOLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxxQ0FBcUM7WUFDakUsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxnQ0FBZ0MsQ0FBQztZQUM5RixXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVcsSUFBSSxFQUFFO1lBQ3BDLFFBQVEsRUFBRSxLQUFLLENBQUMsUUFBUTtZQUN4QixVQUFVLEVBQUUsS0FBSyxDQUFDLFVBQVUsSUFBSSxDQUFDO1lBQ2pDLFdBQVcsRUFBRSxJQUFJO1NBQ2pCLENBQUM7SUFDSCxDQUFDO0lBRU8sS0FBSyxDQUFDLHlCQUF5QixDQUFDLEtBQXFCLEVBQUUsS0FBd0I7UUFDdEYsSUFBSSxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1lBQ2xDLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ25ELE1BQU0sZ0JBQWdCLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLE1BQU0sS0FBSyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkgsSUFBSSxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztZQUNuQyxPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sbUJBQW1CLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDdkYsSUFBSSxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztZQUNuQyxPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksbUJBQW1CLEVBQUUsQ0FBQztZQUN6QixNQUFNLFFBQVEsR0FBRyxlQUFlLENBQy9CLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFDaEQsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGVBQWUsRUFDdkMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FDakMsQ0FBQztZQUVGLElBQUksS0FBSyxDQUFDLHVCQUF1QixFQUFFLENBQUM7Z0JBQ25DLE9BQU87WUFDUixDQUFDO1lBRUQsSUFBSSxDQUFDO2dCQUNKLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ25ELElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO29CQUNqQixPQUFPLE1BQU0sSUFBSSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUNqRCxDQUFDO1lBQ0YsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2hCLGdDQUFnQztZQUNqQyxDQUFDO1FBQ0YsQ0FBQztRQUVELE9BQU87SUFDUixDQUFDO0lBRU8sS0FBSyxDQUFDLDBCQUEwQixDQUFDLEtBQXFCLEVBQUUsS0FBd0I7UUFDdkYsSUFBSSxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1lBQ2xDLE9BQU87UUFDUixDQUFDO1FBRUQsNkVBQTZFO1FBQzdFLHlEQUF5RDtRQUN6RCxNQUFNLG1CQUFtQixHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDckYsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7WUFDMUIsTUFBTSxTQUFTLEdBQVUsRUFBRSxDQUFDO1lBQzVCLEtBQUssTUFBTSxNQUFNLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDakUsSUFBSSxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztvQkFDbkMsTUFBTTtnQkFDUCxDQUFDO2dCQUVELE1BQU0sUUFBUSxHQUFHLGVBQWUsQ0FDL0IsTUFBTSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQ2pDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLEVBQ3ZDLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQ2pDLENBQUM7Z0JBRUYsSUFBSSxDQUFDO29CQUNKLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQ25ELElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO3dCQUNqQixTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7b0JBQzFELENBQUM7Z0JBQ0YsQ0FBQztnQkFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO29CQUNoQixnQ0FBZ0M7Z0JBQ2pDLENBQUM7WUFDRixDQUFDO1lBRUQsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELE9BQU87SUFDUixDQUFDO0lBRUQ7O09BRUc7SUFDSyxLQUFLLENBQUMsbUJBQW1CLENBQUMsUUFBYTtRQUM5QyxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDakMsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsRUFBRSxTQUFTLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDL0UsSUFBSSxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUM7WUFDcEIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDNUcsSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDWCxPQUFPLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN6QyxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sUUFBUSxDQUFDO0lBQ2pCLENBQUM7SUFRTyxZQUFZLENBQUMsS0FBcUIsRUFBRSxLQUF3QixFQUFFLFVBQWtEO1FBQ3ZILElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3RCLE9BQU8sRUFBRSxDQUFDLENBQUMsOENBQThDO1FBQzFELENBQUM7UUFHRCxNQUFNLFNBQVMsR0FBaUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsdUJBQXVCLEVBQUU7YUFDL0YsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLEtBQUssU0FBUyxDQUFDLENBQUM7YUFDeEUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLFdBQVc7YUFDdkMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixLQUFLLFNBQVMsQ0FBQzthQUMvQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUU7WUFDaEIsTUFBTSx1QkFBdUIsR0FBc0Q7Z0JBQ2xGLEdBQUcsVUFBVTtnQkFDYixXQUFXLEVBQUUsUUFBUSxDQUFDLE1BQU0sS0FBSyw2QkFBMkIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLFdBQVc7YUFDckcsQ0FBQztZQUVGLE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxrQkFBa0IsSUFBSSxTQUFTLENBQUMsV0FBVyxDQUFDO1lBQ3BFLE9BQU87Z0JBQ04sS0FBSztnQkFDTCxXQUFXLEVBQUUsU0FBUyxDQUFDLE1BQU0sSUFBSSxRQUFRLENBQUMsTUFBTTtnQkFDaEQsa0JBQWtCLEVBQUUsU0FBUyxDQUFDLGtCQUFtQjtnQkFDakQsVUFBVSxFQUFFLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7Z0JBQzFHLFNBQVMsRUFBRSxRQUFRLENBQUMsbUJBQW1CLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxTQUFTLENBQUMsV0FBVyxDQUFDO2dCQUNsRixNQUFNLEVBQUUsR0FBRyxFQUFFO29CQUNaLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUU7d0JBQ3hELGFBQWEsRUFBRSxJQUFJO3dCQUNuQixlQUFlLEVBQUUsdUJBQXVCO3FCQUN4QyxDQUFDLENBQUM7Z0JBQ0osQ0FBQzthQUNELENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRU4sbUhBQW1IO1FBQ25ILG9EQUFvRDtRQUNwRCxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNuQyxTQUFTLENBQUMsSUFBSSxDQUFDO2dCQUNkLEtBQUssRUFBRSxRQUFRLENBQUMsTUFBTSxFQUFFLGlCQUFpQixDQUFDO2dCQUMxQyxrQkFBa0IsRUFBRSxFQUFFO2dCQUN0QixVQUFVLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDLDRCQUE0QixDQUFDO2dCQUNqRixNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sRUFBRTthQUM1QyxDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsT0FBTyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixHQUFHLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFRTyxLQUFLLENBQUMsdUJBQXVCLENBQUMsS0FBcUIsRUFBRSxjQUF1QixFQUFFLEtBQXdCO1FBQzdHLElBQ0MsQ0FBQyxLQUFLLENBQUMsVUFBVSxJQUFJLGlDQUFpQztZQUN0RCxDQUFDLGNBQWMsSUFBSyxzQ0FBc0M7WUFDMUQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUksdURBQXVEO1VBQ2xGLENBQUM7WUFDRixPQUFPLEVBQUUsQ0FBQztRQUNYLENBQUM7UUFFRCxnREFBZ0Q7UUFDaEQsK0NBQStDO1FBQy9DLE9BQU8sSUFBSSxDQUFDLDJCQUEyQixDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFO1lBQ3RFLFNBQVMsRUFBRSxJQUFJO1lBQ2YsV0FBVyxFQUFFLElBQUk7WUFDakIsS0FBSyxFQUFFLDZCQUEyQixDQUFDLG1CQUFtQjtTQUN0RCxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ1gsQ0FBQztJQVNPLG9CQUFvQixDQUFDLEtBQXFCLEVBQUUsV0FBNEIsRUFBRSxLQUF3QjtRQUN6RyxNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyw2QkFBNkIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNsRixNQUFNLE1BQU0sR0FBRyxjQUFjLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUN4RyxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ2hDLE9BQU8sSUFBSSxDQUFDLENBQUMsb0RBQW9EO1FBQ2xFLENBQUM7UUFFRCxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQztRQUNoRSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUN2QixPQUFPLElBQUksQ0FBQyxDQUFDLG9EQUFvRDtRQUNsRSxDQUFDO1FBRUQsTUFBTSxvQkFBb0IsR0FBRyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUM7UUFDdkQsSUFBSSxDQUFDLG9CQUFvQixJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLG9CQUFvQixDQUFDLE1BQU0sS0FBSyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUN4SSxPQUFPLElBQUksQ0FBQyxDQUFDLHlDQUF5QztRQUN2RCxDQUFDO1FBRUQsSUFBSSxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLDZCQUE2QixDQUFDLE1BQU0sQ0FBQyxJQUFJLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxRQUFRLENBQUMsNkJBQTZCLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUMzSixJQUFJLGNBQWMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQy9CLE9BQU8sSUFBSSxDQUFDLENBQUMsaUZBQWlGO1lBQy9GLENBQUM7UUFDRixDQUFDO1FBRUQsT0FBTyxJQUFJLENBQUMsc0JBQXNCLENBQUMsZ0JBQWdCLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUN4RyxDQUFDO0lBRU8sS0FBSyxDQUFDLHNCQUFzQixDQUFDLGdCQUF3QyxFQUFFLG9CQUF5QixFQUFFLE1BQWMsRUFBRSxXQUE0QixFQUFFLEtBQXdCO1FBRS9LLHVEQUF1RDtRQUN2RCxJQUFJLENBQUM7WUFFSixnRUFBZ0U7WUFDaEUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFLENBQUM7WUFFckMsVUFBVTtZQUNWLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsbUJBQW1CLENBQUM7Z0JBQ3hELFFBQVEsRUFBRSxvQkFBb0I7Z0JBQzlCLE9BQU8sRUFBRSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFO2FBQ3pFLENBQUMsQ0FBQztRQUNKLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2hCLE9BQU8sRUFBRSxDQUFDLENBQUMsc0NBQXNDO1FBQ2xELENBQUM7UUFFRCxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQ25DLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztRQUVELDZCQUE2QjtRQUM3QixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQzdELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNaLElBQUksQ0FBQztnQkFDSixNQUFNLGNBQWMsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLG9CQUFvQixDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztnQkFDL0csSUFBSSxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztvQkFDbkMsT0FBTyxFQUFFLENBQUM7Z0JBQ1gsQ0FBQztnQkFFRCxLQUFLLEdBQUcsY0FBYyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUM7WUFDL0MsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2hCLE9BQU8sRUFBRSxDQUFDLENBQUMscUNBQXFDO1lBQ2pELENBQUM7UUFDRixDQUFDO1FBRUQsa0NBQWtDO1FBQ2xDLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxFQUFFLG1CQUFtQixFQUFFLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQy9LLElBQUksS0FBSyxDQUFDLHVCQUF1QixFQUFFLENBQUM7WUFDbkMsT0FBTyxFQUFFLENBQUM7UUFDWCxDQUFDO1FBRUQsT0FBTyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtZQUUvQyxzQkFBc0I7WUFDdEIsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLEtBQUssV0FBVyxFQUFFLENBQUM7Z0JBQzNDLE9BQU8sZ0JBQWdCLENBQUM7WUFDekIsQ0FBQztZQUVELDBDQUEwQztZQUMxQyxPQUFPO2dCQUNOLEdBQUcsZ0JBQWdCO2dCQUNuQixRQUFRLEVBQUUsb0JBQW9CO2dCQUM5QixXQUFXLEVBQUUsZ0JBQWdCLENBQUMsV0FBVztnQkFDekMsT0FBTyxFQUFFLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxFQUFFO29CQUNqQyxJQUFJLENBQUMsWUFBWSxDQUFDLG9CQUFvQixFQUFFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLG1CQUFtQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7b0JBRTFILE9BQU8sYUFBYSxDQUFDLFlBQVksQ0FBQztnQkFDbkMsQ0FBQztnQkFDRCxNQUFNLEVBQUUsQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLG9CQUFvQixFQUFFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLGFBQWEsRUFBRSxLQUFLLENBQUMsWUFBWSxFQUFFLFdBQVcsRUFBRSxLQUFLLENBQUMsWUFBWSxFQUFFLENBQUM7YUFDOUwsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELGNBQWMsQ0FBQyxNQUFlLEVBQUUsS0FBYTtRQUM1QyxJQUFJLENBQUMsd0JBQXdCLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztJQUM3RCxDQUFDO0lBRUQsZ0JBQWdCLENBQUMsTUFBZTtRQUMvQixJQUFJLENBQUMsd0JBQXdCLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDeEQsQ0FBQztJQUVELFlBQVk7SUFHWixpQkFBaUI7SUFFVCxrQkFBa0IsQ0FBQyxnQkFBMEQsRUFBRSxhQUF3RTtRQUM5SixNQUFNLG9CQUFvQixHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRTFELElBQUksUUFBeUIsQ0FBQztRQUM5QixJQUFJLEtBQWEsQ0FBQztRQUNsQixJQUFJLFdBQVcsR0FBdUIsU0FBUyxDQUFDO1FBQ2hELElBQUksT0FBTyxHQUF3QixTQUFTLENBQUM7UUFDN0MsSUFBSSxZQUFzQixDQUFDO1FBQzNCLElBQUksSUFBSSxHQUFnQyxTQUFTLENBQUM7UUFFbEQsSUFBSSxhQUFhLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDO1lBQ3JDLFFBQVEsR0FBRyxzQkFBc0IsQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUNuRSxLQUFLLEdBQUcsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbkMsV0FBVyxHQUFHLGdCQUFnQixDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ2hELE9BQU8sR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3JFLFlBQVksR0FBRyxnQkFBZ0IsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1lBQ3ZELElBQUksR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNuQyxDQUFDO2FBQU0sQ0FBQztZQUNQLFFBQVEsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUM7WUFDdEYsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNwRSxLQUFLLEdBQUcsV0FBVyxJQUFJLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3JELFdBQVcsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQzlHLE9BQU8sR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3ZILFlBQVksR0FBRyxFQUFFLENBQUM7UUFDbkIsQ0FBQztRQUVELE1BQU0sbUJBQW1CLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssSUFBSSxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBRTVFLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO1FBRWpKLE1BQU0sWUFBWSxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRTtZQUNsQyxNQUFNLHVCQUF1QixHQUFHLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQztZQUN0RSxNQUFNLE9BQU8sR0FBd0IsRUFBRSxDQUFDO1lBRXhDLHVCQUF1QjtZQUN2QixPQUFPLENBQUMsSUFBSSxDQUFDO2dCQUNaLFNBQVMsRUFBRSx1QkFBdUIsS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUM7Z0JBQzlJLE9BQU8sRUFBRSx1QkFBdUIsS0FBSyxPQUFPLENBQUMsQ0FBQztvQkFDN0MsUUFBUSxDQUFDLEVBQUUsR0FBRyxFQUFFLFlBQVksRUFBRSxPQUFPLEVBQUUsQ0FBQyx5REFBeUQsQ0FBQyxFQUFFLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO29CQUMzSCxRQUFRLENBQUMsRUFBRSxHQUFHLEVBQUUsY0FBYyxFQUFFLE9BQU8sRUFBRSxDQUFDLGdEQUFnRCxDQUFDLEVBQUUsRUFBRSxvQkFBb0IsQ0FBQzthQUNySCxDQUFDLENBQUM7WUFFSCxzQkFBc0I7WUFDdEIsSUFBSSxvQkFBb0IsRUFBRSxDQUFDO2dCQUMxQixPQUFPLENBQUMsSUFBSSxDQUFDO29CQUNaLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLEdBQUcsU0FBUyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO29CQUM3SCxPQUFPLEVBQUUsUUFBUSxDQUFDLGFBQWEsRUFBRSw2QkFBNkIsQ0FBQztvQkFDL0QsYUFBYSxFQUFFLE9BQU87aUJBQ3RCLENBQUMsQ0FBQztZQUNKLENBQUM7WUFFRCxPQUFPLE9BQU8sQ0FBQztRQUNoQixDQUFDLENBQUMsQ0FBQztRQUVILE9BQU87WUFDTixRQUFRO1lBQ1IsS0FBSztZQUNMLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyx3QkFBd0IsRUFBRSxxQkFBcUIsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxtQkFBbUI7WUFDekgsV0FBVztZQUNYLElBQUksV0FBVyxLQUFLLE9BQU8sZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNwRCxJQUFJLE9BQU8sS0FBSyxPQUFPLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQzVDLE9BQU8sRUFBRSxDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsRUFBRTtnQkFDakMsUUFBUSxXQUFXLEVBQUUsQ0FBQztvQkFFckIsdUJBQXVCO29CQUN2QixLQUFLLENBQUM7d0JBQ0wsSUFBSSxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsbUJBQW1CLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQzt3QkFFN0csT0FBTyxhQUFhLENBQUMsWUFBWSxDQUFDO29CQUVuQyxzQkFBc0I7b0JBQ3RCLEtBQUssQ0FBQzt3QkFDTCxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUM7NEJBQ2xDLElBQUksQ0FBQyxjQUFjLENBQUMsaUJBQWlCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQzs0QkFFeEQsT0FBTyxhQUFhLENBQUMsV0FBVyxDQUFDO3dCQUNsQyxDQUFDO2dCQUNILENBQUM7Z0JBRUQsT0FBTyxhQUFhLENBQUMsU0FBUyxDQUFDO1lBQ2hDLENBQUM7WUFDRCxNQUFNLEVBQUUsQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGdCQUFnQixFQUFFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxhQUFhLEVBQUUsS0FBSyxDQUFDLFlBQVksRUFBRSxXQUFXLEVBQUUsS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ2pMLENBQUM7SUFDSCxDQUFDO0lBRU8sS0FBSyxDQUFDLFlBQVksQ0FBQyxnQkFBMEQsRUFBRSxPQUE4SDtRQUVwTix3REFBd0Q7UUFDeEQsTUFBTSxhQUFhLEdBQXVCO1lBQ3pDLGFBQWEsRUFBRSxPQUFPLENBQUMsYUFBYTtZQUNwQyxNQUFNLEVBQUUsT0FBTyxDQUFDLE9BQU8sRUFBRSxPQUFPLElBQUksT0FBTyxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQjtZQUM5RixTQUFTLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7U0FDM0UsQ0FBQztRQUVGLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsSUFBSSxPQUFPLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxJQUFJLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUM7UUFFeksseURBQXlEO1FBQ3pELElBQUksV0FBVyxLQUFLLFVBQVUsRUFBRSxDQUFDO1lBQ2hDLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDaEQsQ0FBQztRQUVELHNCQUFzQjtRQUN0QixJQUFJLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUM7WUFDckMsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDbkYsQ0FBQztRQUVELHdCQUF3QjthQUNuQixDQUFDO1lBQ0wsSUFBSSxtQkFBeUMsQ0FBQztZQUM5QyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDO2dCQUNqQyxtQkFBbUIsR0FBRztvQkFDckIsUUFBUSxFQUFFLGdCQUFnQjtvQkFDMUIsT0FBTyxFQUFFLGFBQWE7aUJBQ3RCLENBQUM7WUFDSCxDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsbUJBQW1CLEdBQUc7b0JBQ3JCLEdBQUcsZ0JBQWdCO29CQUNuQixPQUFPLEVBQUU7d0JBQ1IsR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPO3dCQUMzQixHQUFHLGFBQWE7cUJBQ2hCO2lCQUNELENBQUM7WUFDSCxDQUFDO1lBRUQsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsRUFBRSxXQUFXLENBQUMsQ0FBQztRQUN2RSxDQUFDO0lBQ0YsQ0FBQzs7QUExZ0NXLDJCQUEyQjtJQXlCckMsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLGNBQWMsQ0FBQTtJQUNkLFdBQUEsd0JBQXdCLENBQUE7SUFDeEIsV0FBQSxZQUFZLENBQUE7SUFDWixXQUFBLDRCQUE0QixDQUFBO0lBQzVCLFdBQUEsWUFBWSxDQUFBO0lBQ1osV0FBQSxhQUFhLENBQUE7SUFDYixXQUFBLGFBQWEsQ0FBQTtJQUNiLFdBQUEsZ0JBQWdCLENBQUE7SUFDaEIsV0FBQSxtQkFBbUIsQ0FBQTtJQUNuQixZQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFlBQUEsY0FBYyxDQUFBO0lBQ2QsWUFBQSxlQUFlLENBQUE7SUFDZixZQUFBLDBCQUEwQixDQUFBO0lBQzFCLFlBQUEsaUJBQWlCLENBQUE7SUFDakIsWUFBQSxtQkFBbUIsQ0FBQTtJQUNuQixZQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFlBQUEsa0JBQWtCLENBQUE7SUFDbEIsWUFBQSxpQkFBaUIsQ0FBQTtJQUNqQixZQUFBLFdBQVcsQ0FBQTtJQUNYLFlBQUEseUJBQXlCLENBQUE7R0E3Q2YsMkJBQTJCLENBNmdDdkMifQ==