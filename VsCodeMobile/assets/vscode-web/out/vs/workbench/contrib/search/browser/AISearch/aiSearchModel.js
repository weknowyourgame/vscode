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
import { Emitter } from '../../../../../base/common/event.js';
import { Lazy } from '../../../../../base/common/lazy.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { resultIsMatch } from '../../../../services/search/common/search.js';
import { IReplaceService } from '../replace.js';
import { FileMatchImpl } from '../searchTreeModel/fileMatch.js';
import { TEXT_SEARCH_HEADING_PREFIX, AI_TEXT_SEARCH_RESULT_ID, FOLDER_MATCH_PREFIX, getFileMatches, FILE_MATCH_PREFIX } from '../searchTreeModel/searchTreeCommon.js';
import { TextSearchHeadingImpl } from '../searchTreeModel/textSearchHeading.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { textSearchResultToMatches } from '../searchTreeModel/match.js';
import { ResourceSet } from '../../../../../base/common/map.js';
let AITextSearchHeadingImpl = class AITextSearchHeadingImpl extends TextSearchHeadingImpl {
    constructor(parent, instantiationService, uriIdentityService) {
        super(false, parent, instantiationService, uriIdentityService);
        this.hidden = true;
    }
    name() {
        return 'AI';
    }
    id() {
        return TEXT_SEARCH_HEADING_PREFIX + AI_TEXT_SEARCH_RESULT_ID;
    }
    get isAIContributed() {
        return true;
    }
    get query() {
        return this._query;
    }
    set query(query) {
        this.clearQuery();
        if (!query) {
            return;
        }
        this._folderMatches = (query && query.folderQueries || [])
            .map(fq => fq.folder)
            .map((resource, index) => this._createBaseFolderMatch(resource, resource.toString(), index, query));
        this._folderMatches.forEach(fm => this._folderMatchesMap.set(fm.resource, fm));
        this._query = query;
    }
    fileCount() {
        const uniqueFileUris = new ResourceSet();
        for (const folderMatch of this.folderMatches()) {
            if (folderMatch.isEmpty()) {
                continue;
            }
            for (const fileMatch of folderMatch.allDownstreamFileMatches()) {
                uniqueFileUris.add(fileMatch.resource);
            }
        }
        return uniqueFileUris.size;
    }
    _createBaseFolderMatch(resource, id, index, query) {
        const folderMatch = this._register(this.createWorkspaceRootWithResourceImpl(resource, id, index, query));
        const disposable = folderMatch.onChange((event) => this._onChange.fire(event));
        this._register(folderMatch.onDispose(() => disposable.dispose()));
        return folderMatch;
    }
    createWorkspaceRootWithResourceImpl(resource, id, index, query) {
        return this.instantiationService.createInstance(AIFolderMatchWorkspaceRootImpl, resource, id, index, query, this);
    }
};
AITextSearchHeadingImpl = __decorate([
    __param(1, IInstantiationService),
    __param(2, IUriIdentityService)
], AITextSearchHeadingImpl);
export { AITextSearchHeadingImpl };
let AIFolderMatchWorkspaceRootImpl = class AIFolderMatchWorkspaceRootImpl extends Disposable {
    constructor(_resource, _id, _index, _query, _parent, instantiationService, labelService) {
        super();
        this._resource = _resource;
        this._index = _index;
        this._query = _query;
        this._parent = _parent;
        this.instantiationService = instantiationService;
        this._onChange = this._register(new Emitter());
        this.onChange = this._onChange.event;
        this._onDispose = this._register(new Emitter());
        this.onDispose = this._onDispose.event;
        this.latestRank = 0;
        this.replacingAll = false;
        this._fileMatches = new Map();
        this._id = FOLDER_MATCH_PREFIX + _id;
        this._name = new Lazy(() => this.resource ? labelService.getUriBasenameLabel(this.resource) : '');
        this._unDisposedFileMatches = new Map();
    }
    get resource() {
        return this._resource;
    }
    id() {
        return this._id;
    }
    index() {
        return this._index;
    }
    name() {
        return this._name.value;
    }
    count() {
        return this._fileMatches.size;
    }
    doAddFile(fileMatch) {
        this._fileMatches.set(fileMatch.id(), fileMatch);
    }
    createAndConfigureFileMatch(rawFileMatch, searchInstanceID) {
        const fileMatch = this.instantiationService.createInstance(AIFileMatch, this._query.contentPattern, this._query.previewOptions, this._query.maxResults, this, rawFileMatch, this, rawFileMatch.resource.toString() + '_' + Date.now().toString(), this.latestRank++);
        fileMatch.createMatches();
        this.doAddFile(fileMatch);
        const disposable = fileMatch.onChange(({ didRemove }) => this.onFileChange(fileMatch, didRemove));
        this._register(fileMatch.onDispose(() => disposable.dispose()));
        return fileMatch;
    }
    isAIContributed() {
        return true;
    }
    onFileChange(fileMatch, removed = false) {
        let added = false;
        if (!this._fileMatches.has(fileMatch.id())) {
            this.doAddFile(fileMatch);
            added = true;
        }
        if (fileMatch.count() === 0) {
            this.doRemoveFile([fileMatch], false, false);
            added = false;
            removed = true;
        }
        this._onChange.fire({ elements: [fileMatch], added: added, removed: removed });
    }
    get hasChildren() {
        return this._fileMatches.size > 0;
    }
    parent() {
        return this._parent;
    }
    matches() {
        return [...this._fileMatches.values()];
    }
    allDownstreamFileMatches() {
        return [...this._fileMatches.values()];
    }
    remove(matches) {
        if (!Array.isArray(matches)) {
            matches = [matches];
        }
        const allMatches = getFileMatches(matches);
        this.doRemoveFile(allMatches);
    }
    addFileMatch(raw, silent, searchInstanceID) {
        // when adding a fileMatch that has intermediate directories
        const added = [];
        const updated = [];
        raw.forEach(rawFileMatch => {
            const fileMatch = this.createAndConfigureFileMatch(rawFileMatch, searchInstanceID);
            added.push(fileMatch);
        });
        const elements = [...added, ...updated];
        if (!silent && elements.length) {
            this._onChange.fire({ elements, added: !!added.length });
        }
    }
    isEmpty() {
        return this.recursiveFileCount() === 0;
    }
    clear(clearingAll) {
        const changed = this.allDownstreamFileMatches();
        if (changed.length > 0) {
            this.disposeMatches();
            this._onChange.fire({ elements: changed, removed: true, added: false, clearingAll });
        }
    }
    get showHighlights() {
        return this._parent.showHighlights;
    }
    get searchModel() {
        return this._searchResult.searchModel;
    }
    get _searchResult() {
        return this._parent.parent();
    }
    get query() {
        return this._query;
    }
    getDownstreamFileMatch(uri) {
        for (const fileMatch of this._fileMatches.values()) {
            if (fileMatch.resource.toString() === uri.toString()) {
                return fileMatch;
            }
        }
        return null;
    }
    replaceAll() {
        throw new Error('Cannot replace in AI search');
    }
    recursiveFileCount() {
        return this._fileMatches.size;
    }
    doRemoveFile(fileMatches, dispose = true, trigger = true, keepReadonly = false) {
        const removed = [];
        for (const match of fileMatches) {
            if (this._fileMatches.get(match.id())) {
                if (keepReadonly && match.hasReadonlyMatches()) {
                    continue;
                }
                this._fileMatches.delete(match.id());
                if (dispose) {
                    match.dispose();
                }
                else {
                    this._unDisposedFileMatches.set(match.id(), match);
                }
                removed.push(match);
            }
        }
        if (trigger) {
            this._onChange.fire({ elements: removed, removed: true });
        }
    }
    replace(match) {
        throw new Error('Cannot replace in AI search');
    }
    bindModel(model) {
        // no op
    }
    unbindNotebookEditorWidget(editor, resource) {
        //no op
    }
    bindNotebookEditorWidget(editor, resource) {
        //no op
        return Promise.resolve();
    }
    hasOnlyReadOnlyMatches() {
        return Array.from(this._fileMatches.values()).every(fm => fm.hasOnlyReadOnlyMatches());
    }
    fileMatchesIterator() {
        return this._fileMatches.values();
    }
    folderMatchesIterator() {
        return [].values();
    }
    recursiveMatchCount() {
        return this._fileMatches.size;
    }
    disposeMatches() {
        [...this._fileMatches.values()].forEach((fileMatch) => fileMatch.dispose());
        [...this._unDisposedFileMatches.values()].forEach((fileMatch) => fileMatch.dispose());
        this._fileMatches.clear();
    }
    dispose() {
        this.disposeMatches();
        this._onDispose.fire();
        super.dispose();
    }
};
AIFolderMatchWorkspaceRootImpl = __decorate([
    __param(5, IInstantiationService),
    __param(6, ILabelService)
], AIFolderMatchWorkspaceRootImpl);
export { AIFolderMatchWorkspaceRootImpl };
let AIFileMatch = class AIFileMatch extends FileMatchImpl {
    constructor(_query, _previewOptions, _maxResults, _parent, rawMatch, _closestRoot, _id, rank, modelService, replaceService, labelService) {
        super({ pattern: _query }, _previewOptions, _maxResults, _parent, rawMatch, _closestRoot, modelService, replaceService, labelService);
        this._id = _id;
        this.rank = rank;
    }
    id() {
        return FILE_MATCH_PREFIX + this._id;
    }
    getFullRange() {
        let earliestStart = undefined;
        let latestEnd = undefined;
        for (const match of this.matches()) {
            const matchStart = match.range().getStartPosition();
            const matchEnd = match.range().getEndPosition();
            if (earliestStart === undefined) {
                earliestStart = matchStart;
            }
            else if (matchStart.isBefore(earliestStart)) {
                earliestStart = matchStart;
            }
            if (latestEnd === undefined) {
                latestEnd = matchEnd;
            }
            else if (!matchEnd.isBefore(latestEnd)) {
                latestEnd = matchEnd;
            }
        }
        if (earliestStart === undefined || latestEnd === undefined) {
            return undefined;
        }
        return new Range(earliestStart.lineNumber, earliestStart.column, latestEnd.lineNumber, latestEnd.column);
    }
    rangeAsString() {
        const range = this.getFullRange();
        if (!range) {
            return undefined;
        }
        return range.startLineNumber + ':' + range.startColumn + '-' + range.endLineNumber + ':' + range.endColumn;
    }
    name() {
        const range = this.rangeAsString();
        return super.name() + range ? ' ' + range : '';
    }
    createMatches() {
        if (this.rawMatch.results) {
            this.rawMatch.results
                .filter(resultIsMatch)
                .forEach(rawMatch => {
                textSearchResultToMatches(rawMatch, this, true)
                    .forEach(m => this.add(m));
            });
        }
    }
};
AIFileMatch = __decorate([
    __param(8, IModelService),
    __param(9, IReplaceService),
    __param(10, ILabelService)
], AIFileMatch);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWlTZWFyY2hNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9BSVNlYXJjaC9haVNlYXJjaE1vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxxQ0FBcUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBSXJFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMvRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDOUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDaEcsT0FBTyxFQUF1RCxhQUFhLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUVsSSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBRWhELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNoRSxPQUFPLEVBQWlCLDBCQUEwQixFQUFFLHdCQUF3QixFQUF5SyxtQkFBbUIsRUFBRSxjQUFjLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUM1VixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNoRixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDbkUsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFFeEUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1D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