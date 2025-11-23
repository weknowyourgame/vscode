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
import { CancellationToken } from '../../../base/common/cancellation.js';
import { DisposableStore, dispose } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { ITelemetryService } from '../../../platform/telemetry/common/telemetry.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { ISearchService } from '../../services/search/common/search.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { revive } from '../../../base/common/marshalling.js';
import * as Constants from '../../contrib/search/common/constants.js';
import { IContextKeyService } from '../../../platform/contextkey/common/contextkey.js';
let MainThreadSearch = class MainThreadSearch {
    constructor(extHostContext, _searchService, _telemetryService, _configurationService, contextKeyService) {
        this._searchService = _searchService;
        this._telemetryService = _telemetryService;
        this.contextKeyService = contextKeyService;
        this._searchProvider = new Map();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostSearch);
        this._proxy.$enableExtensionHostSearch();
    }
    dispose() {
        this._searchProvider.forEach(value => value.dispose());
        this._searchProvider.clear();
    }
    $registerTextSearchProvider(handle, scheme) {
        this._searchProvider.set(handle, new RemoteSearchProvider(this._searchService, 1 /* SearchProviderType.text */, scheme, handle, this._proxy));
    }
    $registerAITextSearchProvider(handle, scheme) {
        Constants.SearchContext.hasAIResultProvider.bindTo(this.contextKeyService).set(true);
        this._searchProvider.set(handle, new RemoteSearchProvider(this._searchService, 2 /* SearchProviderType.aiText */, scheme, handle, this._proxy));
    }
    $registerFileSearchProvider(handle, scheme) {
        this._searchProvider.set(handle, new RemoteSearchProvider(this._searchService, 0 /* SearchProviderType.file */, scheme, handle, this._proxy));
    }
    $unregisterProvider(handle) {
        dispose(this._searchProvider.get(handle));
        this._searchProvider.delete(handle);
    }
    $handleFileMatch(handle, session, data) {
        const provider = this._searchProvider.get(handle);
        if (!provider) {
            throw new Error('Got result for unknown provider');
        }
        provider.handleFindMatch(session, data);
    }
    $handleTextMatch(handle, session, data) {
        const provider = this._searchProvider.get(handle);
        if (!provider) {
            throw new Error('Got result for unknown provider');
        }
        provider.handleFindMatch(session, data);
    }
    $handleKeywordResult(handle, session, data) {
        const provider = this._searchProvider.get(handle);
        if (!provider) {
            throw new Error('Got result for unknown provider');
        }
        provider.handleKeywordResult(session, data);
    }
    $handleTelemetry(eventName, data) {
        this._telemetryService.publicLog(eventName, data);
    }
};
MainThreadSearch = __decorate([
    extHostNamedCustomer(MainContext.MainThreadSearch),
    __param(1, ISearchService),
    __param(2, ITelemetryService),
    __param(3, IConfigurationService),
    __param(4, IContextKeyService)
], MainThreadSearch);
export { MainThreadSearch };
class SearchOperation {
    static { this._idPool = 0; }
    constructor(progress, id = ++SearchOperation._idPool, matches = new Map(), keywords = []) {
        this.progress = progress;
        this.id = id;
        this.matches = matches;
        this.keywords = keywords;
        //
    }
    addMatch(match) {
        const existingMatch = this.matches.get(match.resource.toString());
        if (existingMatch) {
            // TODO@rob clean up text/file result types
            // If a file search returns the same file twice, we would enter this branch.
            // It's possible that could happen, #90813
            if (existingMatch.results && match.results) {
                existingMatch.results.push(...match.results);
            }
        }
        else {
            this.matches.set(match.resource.toString(), match);
        }
        this.progress?.(match);
    }
    addKeyword(result) {
        this.keywords.push(result);
        this.progress?.(result);
    }
}
class RemoteSearchProvider {
    constructor(searchService, type, _scheme, _handle, _proxy) {
        this._scheme = _scheme;
        this._handle = _handle;
        this._proxy = _proxy;
        this._registrations = new DisposableStore();
        this._searches = new Map();
        this._registrations.add(searchService.registerSearchResultProvider(this._scheme, type, this));
    }
    async getAIName() {
        if (this.cachedAIName === undefined) {
            this.cachedAIName = await this._proxy.$getAIName(this._handle);
        }
        return this.cachedAIName;
    }
    dispose() {
        this._registrations.dispose();
    }
    fileSearch(query, token = CancellationToken.None) {
        return this.doSearch(query, undefined, token);
    }
    textSearch(query, onProgress, token = CancellationToken.None) {
        return this.doSearch(query, onProgress, token);
    }
    doSearch(query, onProgress, token = CancellationToken.None) {
        if (!query.folderQueries.length) {
            throw new Error('Empty folderQueries');
        }
        const search = new SearchOperation(onProgress);
        this._searches.set(search.id, search);
        const searchP = this._provideSearchResults(query, search.id, token);
        return Promise.resolve(searchP).then((result) => {
            this._searches.delete(search.id);
            return { results: Array.from(search.matches.values()), aiKeywords: Array.from(search.keywords), stats: result.stats, limitHit: result.limitHit, messages: result.messages };
        }, err => {
            this._searches.delete(search.id);
            return Promise.reject(err);
        });
    }
    clearCache(cacheKey) {
        return Promise.resolve(this._proxy.$clearCache(cacheKey));
    }
    handleFindMatch(session, dataOrUri) {
        const searchOp = this._searches.get(session);
        if (!searchOp) {
            // ignore...
            return;
        }
        dataOrUri.forEach(result => {
            if (result.results) {
                searchOp.addMatch(revive(result));
            }
            else {
                searchOp.addMatch({
                    resource: URI.revive(result)
                });
            }
        });
    }
    handleKeywordResult(session, data) {
        const searchOp = this._searches.get(session);
        if (!searchOp) {
            // ignore...
            return;
        }
        searchOp.addKeyword(data);
    }
    _provideSearchResults(query, session, token) {
        switch (query.type) {
            case 1 /* QueryType.File */:
                return this._proxy.$provideFileSearchResults(this._handle, session, query, token);
            case 2 /* QueryType.Text */:
                return this._proxy.$provideTextSearchResults(this._handle, session, query, token);
            default:
                return this._proxy.$provideAITextSearchResults(this._handle, session, query, token);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZFNlYXJjaC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZFNlYXJjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBZSxNQUFNLG1DQUFtQyxDQUFDO0FBQzFGLE9BQU8sRUFBRSxHQUFHLEVBQWlCLE1BQU0sNkJBQTZCLENBQUM7QUFDakUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDaEcsT0FBTyxFQUFrQixpQkFBaUIsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxvQkFBb0IsRUFBbUIsTUFBTSxzREFBc0QsQ0FBQztBQUM3RyxPQUFPLEVBQTJJLGNBQWMsRUFBNkMsTUFBTSx3Q0FBd0MsQ0FBQztBQUM1UCxPQUFPLEVBQUUsY0FBYyxFQUFzQixXQUFXLEVBQXlCLE1BQU0sK0JBQStCLENBQUM7QUFDdkgsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzdELE9BQU8sS0FBSyxTQUFTLE1BQU0sMENBQTBDLENBQUM7QUFDdEUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFJaEYsSUFBTSxnQkFBZ0IsR0FBdEIsTUFBTSxnQkFBZ0I7SUFLNUIsWUFDQyxjQUErQixFQUNmLGNBQStDLEVBQzVDLGlCQUFxRCxFQUNqRCxxQkFBNEMsRUFDL0MsaUJBQStDO1FBSGxDLG1CQUFjLEdBQWQsY0FBYyxDQUFnQjtRQUMzQixzQkFBaUIsR0FBakIsaUJBQWlCLENBQW1CO1FBRTFDLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBb0I7UUFQbkQs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