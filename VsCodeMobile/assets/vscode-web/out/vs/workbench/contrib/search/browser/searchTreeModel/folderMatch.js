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
var FolderMatchImpl_1;
import { Emitter } from '../../../../../base/common/event.js';
import { Lazy } from '../../../../../base/common/lazy.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../../base/common/map.js';
import { TernarySearchTree } from '../../../../../base/common/ternarySearchTree.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { IReplaceService } from './../replace.js';
import { resultIsMatch } from '../../../../services/search/common/search.js';
import { isSearchTreeFolderMatchWorkspaceRoot, isSearchTreeFolderMatchNoRoot, FOLDER_MATCH_PREFIX, getFileMatches } from './searchTreeCommon.js';
import { isINotebookFileMatchNoModel } from '../../common/searchNotebookHelpers.js';
import { NotebookCompatibleFileMatch } from '../notebookSearch/notebookSearchModel.js';
import { isINotebookFileMatchWithModel, getIDFromINotebookCellMatch } from '../notebookSearch/searchNotebookHelpers.js';
import { isNotebookFileMatch } from '../notebookSearch/notebookSearchModelBase.js';
import { textSearchResultToMatches } from './match.js';
let FolderMatchImpl = FolderMatchImpl_1 = class FolderMatchImpl extends Disposable {
    constructor(_resource, _id, _index, _query, _parent, _searchResult, _closestRoot, replaceService, instantiationService, labelService, uriIdentityService) {
        super();
        this._resource = _resource;
        this._index = _index;
        this._query = _query;
        this._parent = _parent;
        this._searchResult = _searchResult;
        this._closestRoot = _closestRoot;
        this.replaceService = replaceService;
        this.instantiationService = instantiationService;
        this.uriIdentityService = uriIdentityService;
        this._onChange = this._register(new Emitter());
        this.onChange = this._onChange.event;
        this._onDispose = this._register(new Emitter());
        this.onDispose = this._onDispose.event;
        this._replacingAll = false;
        this._fileMatches = new ResourceMap();
        this._folderMatches = new ResourceMap();
        this._folderMatchesMap = TernarySearchTree.forUris(key => this.uriIdentityService.extUri.ignorePathCasing(key));
        this._unDisposedFileMatches = new ResourceMap();
        this._unDisposedFolderMatches = new ResourceMap();
        this._name = new Lazy(() => this.resource ? labelService.getUriBasenameLabel(this.resource) : '');
        this._id = FOLDER_MATCH_PREFIX + _id;
    }
    get searchModel() {
        return this._searchResult.searchModel;
    }
    get showHighlights() {
        return this._parent.showHighlights;
    }
    get closestRoot() {
        return this._closestRoot;
    }
    set replacingAll(b) {
        this._replacingAll = b;
    }
    id() {
        return this._id;
    }
    get resource() {
        return this._resource;
    }
    index() {
        return this._index;
    }
    name() {
        return this._name.value;
    }
    parent() {
        return this._parent;
    }
    isAIContributed() {
        return false;
    }
    get hasChildren() {
        return this._fileMatches.size > 0 || this._folderMatches.size > 0;
    }
    bindModel(model) {
        const fileMatch = this._fileMatches.get(model.uri);
        if (fileMatch) {
            fileMatch.bindModel(model);
        }
        else {
            const folderMatch = this.getFolderMatch(model.uri);
            const match = folderMatch?.getDownstreamFileMatch(model.uri);
            match?.bindModel(model);
        }
    }
    createIntermediateFolderMatch(resource, id, index, query, baseWorkspaceFolder) {
        const folderMatch = this._register(this.instantiationService.createInstance(FolderMatchWithResourceImpl, resource, id, index, query, this, this._searchResult, baseWorkspaceFolder));
        this.configureIntermediateMatch(folderMatch);
        this.doAddFolder(folderMatch);
        return folderMatch;
    }
    configureIntermediateMatch(folderMatch) {
        const disposable = folderMatch.onChange((event) => this.onFolderChange(folderMatch, event));
        this._register(folderMatch.onDispose(() => disposable.dispose()));
    }
    clear(clearingAll = false) {
        const changed = this.allDownstreamFileMatches();
        this.disposeMatches();
        this._onChange.fire({ elements: changed, removed: true, added: false, clearingAll });
    }
    remove(matches) {
        if (!Array.isArray(matches)) {
            matches = [matches];
        }
        const allMatches = getFileMatches(matches);
        this.doRemoveFile(allMatches);
    }
    async replace(match) {
        return this.replaceService.replace([match]).then(() => {
            this.doRemoveFile([match], true, true, true);
        });
    }
    replaceAll() {
        const matches = this.matches();
        return this.batchReplace(matches);
    }
    matches() {
        return [...this.fileMatchesIterator(), ...this.folderMatchesIterator()];
    }
    fileMatchesIterator() {
        return this._fileMatches.values();
    }
    folderMatchesIterator() {
        return this._folderMatches.values();
    }
    isEmpty() {
        return (this.fileCount() + this.folderCount()) === 0;
    }
    getDownstreamFileMatch(uri) {
        const directChildFileMatch = this._fileMatches.get(uri);
        if (directChildFileMatch) {
            return directChildFileMatch;
        }
        const folderMatch = this.getFolderMatch(uri);
        const match = folderMatch?.getDownstreamFileMatch(uri);
        if (match) {
            return match;
        }
        return null;
    }
    allDownstreamFileMatches() {
        let recursiveChildren = [];
        const iterator = this.folderMatchesIterator();
        for (const elem of iterator) {
            recursiveChildren = recursiveChildren.concat(elem.allDownstreamFileMatches());
        }
        return [...this.fileMatchesIterator(), ...recursiveChildren];
    }
    fileCount() {
        return this._fileMatches.size;
    }
    folderCount() {
        return this._folderMatches.size;
    }
    count() {
        return this.fileCount() + this.folderCount();
    }
    recursiveFileCount() {
        return this.allDownstreamFileMatches().length;
    }
    recursiveMatchCount() {
        return this.allDownstreamFileMatches().reduce((prev, match) => prev + match.count(), 0);
    }
    get query() {
        return this._query;
    }
    doAddFile(fileMatch) {
        this._fileMatches.set(fileMatch.resource, fileMatch);
        this._unDisposedFileMatches.delete(fileMatch.resource);
    }
    hasOnlyReadOnlyMatches() {
        return Array.from(this._fileMatches.values()).every(fm => fm.hasOnlyReadOnlyMatches());
    }
    uriHasParent(parent, child) {
        return this.uriIdentityService.extUri.isEqualOrParent(child, parent) && !this.uriIdentityService.extUri.isEqual(child, parent);
    }
    isInParentChain(folderMatch) {
        let matchItem = this;
        while (matchItem instanceof FolderMatchImpl_1) {
            if (matchItem.id() === folderMatch.id()) {
                return true;
            }
            matchItem = matchItem.parent();
        }
        return false;
    }
    getFolderMatch(resource) {
        const folderMatch = this._folderMatchesMap.findSubstr(resource);
        return folderMatch;
    }
    doAddFolder(folderMatch) {
        if (this.resource && !this.uriHasParent(this.resource, folderMatch.resource)) {
            throw Error(`${folderMatch.resource} does not belong as a child of ${this.resource}`);
        }
        else if (this.isInParentChain(folderMatch)) {
            throw Error(`${folderMatch.resource} is a parent of ${this.resource}`);
        }
        this._folderMatches.set(folderMatch.resource, folderMatch);
        this._folderMatchesMap.set(folderMatch.resource, folderMatch);
        this._unDisposedFolderMatches.delete(folderMatch.resource);
    }
    async batchReplace(matches) {
        const allMatches = getFileMatches(matches);
        await this.replaceService.replace(allMatches);
        this.doRemoveFile(allMatches, true, true, true);
    }
    onFileChange(fileMatch, removed = false) {
        let added = false;
        if (!this._fileMatches.has(fileMatch.resource)) {
            this.doAddFile(fileMatch);
            added = true;
        }
        if (fileMatch.count() === 0) {
            this.doRemoveFile([fileMatch], false, false);
            added = false;
            removed = true;
        }
        if (!this._replacingAll) {
            this._onChange.fire({ elements: [fileMatch], added: added, removed: removed });
        }
    }
    onFolderChange(folderMatch, event) {
        if (!this._folderMatches.has(folderMatch.resource)) {
            this.doAddFolder(folderMatch);
        }
        if (folderMatch.isEmpty()) {
            this._folderMatches.delete(folderMatch.resource);
            folderMatch.dispose();
        }
        this._onChange.fire(event);
    }
    doRemoveFile(fileMatches, dispose = true, trigger = true, keepReadonly = false) {
        const removed = [];
        for (const match of fileMatches) {
            if (this._fileMatches.get(match.resource)) {
                if (keepReadonly && match.hasReadonlyMatches()) {
                    continue;
                }
                this._fileMatches.delete(match.resource);
                if (dispose) {
                    match.dispose();
                }
                else {
                    this._unDisposedFileMatches.set(match.resource, match);
                }
                removed.push(match);
            }
            else {
                const folder = this.getFolderMatch(match.resource);
                if (folder) {
                    folder.doRemoveFile([match], dispose, trigger);
                }
                else {
                    throw Error(`FileMatch ${match.resource} is not located within FolderMatch ${this.resource}`);
                }
            }
        }
        if (trigger) {
            this._onChange.fire({ elements: removed, removed: true });
        }
    }
    async bindNotebookEditorWidget(editor, resource) {
        const fileMatch = this._fileMatches.get(resource);
        if (isNotebookFileMatch(fileMatch)) {
            if (fileMatch) {
                fileMatch.bindNotebookEditorWidget(editor);
                await fileMatch.updateMatchesForEditorWidget();
            }
            else {
                const folderMatches = this.folderMatchesIterator();
                for (const elem of folderMatches) {
                    await elem.bindNotebookEditorWidget(editor, resource);
                }
            }
        }
    }
    addFileMatch(raw, silent, searchInstanceID) {
        // when adding a fileMatch that has intermediate directories
        const added = [];
        const updated = [];
        raw.forEach(rawFileMatch => {
            const existingFileMatch = this.getDownstreamFileMatch(rawFileMatch.resource);
            if (existingFileMatch) {
                if (rawFileMatch.results) {
                    rawFileMatch
                        .results
                        .filter(resultIsMatch)
                        .forEach(m => {
                        textSearchResultToMatches(m, existingFileMatch, false)
                            .forEach(m => existingFileMatch.add(m));
                    });
                }
                // add cell matches
                if (isINotebookFileMatchWithModel(rawFileMatch) || isINotebookFileMatchNoModel(rawFileMatch)) {
                    rawFileMatch.cellResults?.forEach(rawCellMatch => {
                        if (isNotebookFileMatch(existingFileMatch)) {
                            const existingCellMatch = existingFileMatch.getCellMatch(getIDFromINotebookCellMatch(rawCellMatch));
                            if (existingCellMatch) {
                                existingCellMatch.addContentMatches(rawCellMatch.contentResults);
                                existingCellMatch.addWebviewMatches(rawCellMatch.webviewResults);
                            }
                            else {
                                existingFileMatch.addCellMatch(rawCellMatch);
                            }
                        }
                    });
                }
                updated.push(existingFileMatch);
                if (rawFileMatch.results && rawFileMatch.results.length > 0) {
                    existingFileMatch.addContext(rawFileMatch.results);
                }
            }
            else {
                if (isSearchTreeFolderMatchWorkspaceRoot(this) || isSearchTreeFolderMatchNoRoot(this)) {
                    const fileMatch = this.createAndConfigureFileMatch(rawFileMatch, searchInstanceID);
                    added.push(fileMatch);
                }
            }
        });
        const elements = [...added, ...updated];
        if (!silent && elements.length) {
            this._onChange.fire({ elements, added: !!added.length });
        }
    }
    unbindNotebookEditorWidget(editor, resource) {
        const fileMatch = this._fileMatches.get(resource);
        if (isNotebookFileMatch(fileMatch)) {
            if (fileMatch) {
                fileMatch.unbindNotebookEditorWidget(editor);
            }
            else {
                const folderMatches = this.folderMatchesIterator();
                for (const elem of folderMatches) {
                    elem.unbindNotebookEditorWidget(editor, resource);
                }
            }
        }
    }
    disposeMatches() {
        [...this._fileMatches.values()].forEach((fileMatch) => fileMatch.dispose());
        [...this._folderMatches.values()].forEach((folderMatch) => folderMatch.disposeMatches());
        [...this._unDisposedFileMatches.values()].forEach((fileMatch) => fileMatch.dispose());
        [...this._unDisposedFolderMatches.values()].forEach((folderMatch) => folderMatch.disposeMatches());
        this._fileMatches.clear();
        this._folderMatches.clear();
        this._unDisposedFileMatches.clear();
        this._unDisposedFolderMatches.clear();
    }
    dispose() {
        this.disposeMatches();
        this._onDispose.fire();
        super.dispose();
    }
};
FolderMatchImpl = FolderMatchImpl_1 = __decorate([
    __param(7, IReplaceService),
    __param(8, IInstantiationService),
    __param(9, ILabelService),
    __param(10, IUriIdentityService)
], FolderMatchImpl);
export { FolderMatchImpl };
let FolderMatchWithResourceImpl = class FolderMatchWithResourceImpl extends FolderMatchImpl {
    constructor(_resource, _id, _index, _query, _parent, _searchResult, _closestRoot, replaceService, instantiationService, labelService, uriIdentityService) {
        super(_resource, _id, _index, _query, _parent, _searchResult, _closestRoot, replaceService, instantiationService, labelService, uriIdentityService);
        this._normalizedResource = new Lazy(() => this.uriIdentityService.extUri.removeTrailingPathSeparator(this.uriIdentityService.extUri.normalizePath(this.resource)));
    }
    get resource() {
        return this._resource;
    }
    get normalizedResource() {
        return this._normalizedResource.value;
    }
};
FolderMatchWithResourceImpl = __decorate([
    __param(7, IReplaceService),
    __param(8, IInstantiationService),
    __param(9, ILabelService),
    __param(10, IUriIdentityService)
], FolderMatchWithResourceImpl);
export { FolderMatchWithResourceImpl };
/**
 * FolderMatchWorkspaceRoot => folder for workspace root
 */
let FolderMatchWorkspaceRootImpl = class FolderMatchWorkspaceRootImpl extends FolderMatchWithResourceImpl {
    constructor(_resource, _id, _index, _query, _parent, replaceService, instantiationService, labelService, uriIdentityService) {
        super(_resource, _id, _index, _query, _parent, _parent.parent(), null, replaceService, instantiationService, labelService, uriIdentityService);
    }
    normalizedUriParent(uri) {
        return this.uriIdentityService.extUri.normalizePath(this.uriIdentityService.extUri.dirname(uri));
    }
    uriEquals(uri1, ur2) {
        return this.uriIdentityService.extUri.isEqual(uri1, ur2);
    }
    createFileMatch(query, previewOptions, maxResults, parent, rawFileMatch, closestRoot, searchInstanceID) {
        // TODO: can probably just create FileMatchImpl if we don't expect cell results from the file.
        const fileMatch = this.instantiationService.createInstance(NotebookCompatibleFileMatch, query, previewOptions, maxResults, parent, rawFileMatch, closestRoot, searchInstanceID);
        fileMatch.createMatches();
        parent.doAddFile(fileMatch);
        const disposable = fileMatch.onChange(({ didRemove }) => parent.onFileChange(fileMatch, didRemove));
        this._register(fileMatch.onDispose(() => disposable.dispose()));
        return fileMatch;
    }
    createAndConfigureFileMatch(rawFileMatch, searchInstanceID) {
        if (!this.uriHasParent(this.resource, rawFileMatch.resource)) {
            throw Error(`${rawFileMatch.resource} is not a descendant of ${this.resource}`);
        }
        const fileMatchParentParts = [];
        let uri = this.normalizedUriParent(rawFileMatch.resource);
        while (!this.uriEquals(this.normalizedResource, uri)) {
            fileMatchParentParts.unshift(uri);
            const prevUri = uri;
            uri = this.uriIdentityService.extUri.removeTrailingPathSeparator(this.normalizedUriParent(uri));
            if (this.uriEquals(prevUri, uri)) {
                throw Error(`${rawFileMatch.resource} is not correctly configured as a child of ${this.normalizedResource}`);
            }
        }
        const root = this.closestRoot ?? this;
        let parent = this;
        for (let i = 0; i < fileMatchParentParts.length; i++) {
            let folderMatch = parent.getFolderMatch(fileMatchParentParts[i]);
            if (!folderMatch) {
                folderMatch = parent.createIntermediateFolderMatch(fileMatchParentParts[i], fileMatchParentParts[i].toString(), -1, this._query, root);
            }
            parent = folderMatch;
        }
        const contentPatternToUse = typeof (this._query.contentPattern) === 'string' ? { pattern: this._query.contentPattern } : this._query.contentPattern;
        return this.createFileMatch(contentPatternToUse, this._query.previewOptions, this._query.maxResults, parent, rawFileMatch, root, searchInstanceID);
    }
};
FolderMatchWorkspaceRootImpl = __decorate([
    __param(5, IReplaceService),
    __param(6, IInstantiationService),
    __param(7, ILabelService),
    __param(8, IUriIdentityService)
], FolderMatchWorkspaceRootImpl);
export { FolderMatchWorkspaceRootImpl };
// currently, no support for AI results in out-of-workspace files
let FolderMatchNoRootImpl = class FolderMatchNoRootImpl extends FolderMatchImpl {
    constructor(_id, _index, _query, _parent, replaceService, instantiationService, labelService, uriIdentityService) {
        super(null, _id, _index, _query, _parent, _parent.parent(), null, replaceService, instantiationService, labelService, uriIdentityService);
    }
    createAndConfigureFileMatch(rawFileMatch, searchInstanceID) {
        const contentPatternToUse = typeof (this._query.contentPattern) === 'string' ? { pattern: this._query.contentPattern } : this._query.contentPattern;
        // TODO: can probably just create FileMatchImpl if we don't expect cell results from the file.
        const fileMatch = this._register(this.instantiationService.createInstance(NotebookCompatibleFileMatch, contentPatternToUse, this._query.previewOptions, this._query.maxResults, this, rawFileMatch, null, searchInstanceID));
        fileMatch.createMatches();
        this.doAddFile(fileMatch);
        const disposable = fileMatch.onChange(({ didRemove }) => this.onFileChange(fileMatch, didRemove));
        this._register(fileMatch.onDispose(() => disposable.dispose()));
        return fileMatch;
    }
};
FolderMatchNoRootImpl = __decorate([
    __param(4, IReplaceService),
    __param(5, IInstantiationService),
    __param(6, ILabelService),
    __param(7, IUriIdentityService)
], FolderMatchNoRootImpl);
export { FolderMatchNoRootImpl };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9sZGVyTWF0Y2guanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvc2VhcmNoL2Jyb3dzZXIvc2VhcmNoVHJlZU1vZGVsL2ZvbGRlck1hdGNoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0scUNBQXFDLENBQUM7QUFDckUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFHcEYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUNsRCxPQUFPLEVBQW1FLGFBQWEsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBRzlJLE9BQU8sRUFBa00sb0NBQW9DLEVBQXNCLDZCQUE2QixFQUFFLG1CQUFtQixFQUFFLGNBQWMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBRXJXLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSwyQkFBMkIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3hILE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ25GLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVoRCxJQUFNLGVBQWUsdUJBQXJCLE1BQU0sZUFBZ0IsU0FBUSxVQUFVO0lBaUI5QyxZQUNXLFNBQXFCLEVBQy9CLEdBQVcsRUFDRCxNQUFjLEVBQ2QsTUFBa0IsRUFDcEIsT0FBNkMsRUFDN0MsYUFBNEIsRUFDNUIsWUFBd0QsRUFDL0MsY0FBZ0QsRUFDMUMsb0JBQThELEVBQ3RFLFlBQTJCLEVBQ3JCLGtCQUEwRDtRQUUvRSxLQUFLLEVBQUUsQ0FBQztRQVpFLGNBQVMsR0FBVCxTQUFTLENBQVk7UUFFckIsV0FBTSxHQUFOLE1BQU0sQ0FBUTtRQUNkLFdBQU0sR0FBTixNQUFNLENBQVk7UUFDcEIsWUFBTyxHQUFQLE9BQU8sQ0FBc0M7UUFDN0Msa0JBQWEsR0FBYixhQUFhLENBQWU7UUFDNUIsaUJBQVksR0FBWixZQUFZLENBQTRDO1FBQzlCLG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUN2Qix5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXVCO1FBRTdDLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBcUI7UUExQnRFLGNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFnQixDQUFDLENBQUM7UUFDekQsYUFBUSxHQUF3QixJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQztRQUV0RCxlQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFDaEQsY0FBUyxHQUFnQixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQztRQU9oRCxrQkFBYSxHQUFZLEtBQUssQ0FBQztRQWtCdEMsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLFdBQVcsRUFBd0IsQ0FBQztRQUM1RCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksV0FBVyxFQUErQixDQUFDO1FBQ3JFLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLENBQThCLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzdJLElBQUksQ0FBQyxzQkFBc0IsR0FBRyxJQUFJLFdBQVcsRUFBd0IsQ0FBQztRQUN0RSxJQUFJLENBQUMsd0JBQXdCLEdBQUcsSUFBSSxXQUFXLEVBQStCLENBQUM7UUFDL0UsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNsRyxJQUFJLENBQUMsR0FBRyxHQUFHLG1CQUFtQixHQUFHLEdBQUcsQ0FBQztJQUN0QyxDQUFDO0lBRUQsSUFBSSxXQUFXO1FBQ2QsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQztJQUN2QyxDQUFDO0lBRUQsSUFBSSxjQUFjO1FBQ2pCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUM7SUFDcEMsQ0FBQztJQUVELElBQUksV0FBVztRQUNkLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQztJQUMxQixDQUFDO0lBRUQsSUFBSSxZQUFZLENBQUMsQ0FBVTtRQUMxQixJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsQ0FBQztJQUN4QixDQUFDO0lBRUQsRUFBRTtRQUNELE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUNqQixDQUFDO0lBRUQsSUFBSSxRQUFRO1FBQ1gsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxLQUFLO1FBQ0osT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3BCLENBQUM7SUFFRCxJQUFJO1FBQ0gsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztJQUN6QixDQUFDO0lBRUQsTUFBTTtRQUNMLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQztJQUNyQixDQUFDO0lBRUQsZUFBZTtRQUNkLE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVELElBQUksV0FBVztRQUNkLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztJQUNuRSxDQUFDO0lBRUQsU0FBUyxDQUFDLEtBQWlCO1FBQzFCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUVuRCxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2YsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM1QixDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ25ELE1BQU0sS0FBSyxHQUFHLFdBQVcsRUFBRSxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDN0QsS0FBSyxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN6QixDQUFDO0lBQ0YsQ0FBQztJQUVNLDZCQUE2QixDQUFDLFFBQWEsRUFBRSxFQUFVLEVBQUUsS0FBYSxFQUFFLEtBQWlCLEVBQUUsbUJBQXdEO1FBQ3pKLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQywyQkFBMkIsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO1FBQ3JMLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM3QyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzlCLE9BQU8sV0FBVyxDQUFDO0lBQ3BCLENBQUM7SUFFTSwwQkFBMEIsQ0FBQyxXQUF3QztRQUN6RSxNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQzVGLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFFRCxLQUFLLENBQUMsV0FBVyxHQUFHLEtBQUs7UUFDeEIsTUFBTSxPQUFPLEdBQTJCLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1FBQ3hFLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUN0QixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUM7SUFDdEYsQ0FBQztJQUVELE1BQU0sQ0FBQyxPQUFrSTtRQUN4SSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQzdCLE9BQU8sR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3JCLENBQUM7UUFDRCxNQUFNLFVBQVUsR0FBRyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDM0MsSUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFvQjtRQUNqQyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO1lBQ3JELElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzlDLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELFVBQVU7UUFDVCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDL0IsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFRCxPQUFPO1FBQ04sT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixFQUFFLEVBQUUsR0FBRyxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQyxDQUFDO0lBQ3pFLENBQUM7SUFFRCxtQkFBbUI7UUFDbEIsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDO0lBQ25DLENBQUM7SUFFRCxxQkFBcUI7UUFDcEIsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxDQUFDO0lBQ3JDLENBQUM7SUFFRCxPQUFPO1FBQ04sT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDdEQsQ0FBQztJQUVELHNCQUFzQixDQUFDLEdBQVE7UUFDOUIsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN4RCxJQUFJLG9CQUFvQixFQUFFLENBQUM7WUFDMUIsT0FBTyxvQkFBb0IsQ0FBQztRQUM3QixDQUFDO1FBRUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM3QyxNQUFNLEtBQUssR0FBRyxXQUFXLEVBQUUsc0JBQXNCLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDdkQsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNYLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVELHdCQUF3QjtRQUN2QixJQUFJLGlCQUFpQixHQUEyQixFQUFFLENBQUM7UUFDbkQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDOUMsS0FBSyxNQUFNLElBQUksSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUM3QixpQkFBaUIsR0FBRyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHdCQUF3QixFQUFFLENBQUMsQ0FBQztRQUMvRSxDQUFDO1FBRUQsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixFQUFFLEVBQUUsR0FBRyxpQkFBaUIsQ0FBQyxDQUFDO0lBQzlELENBQUM7SUFFTyxTQUFTO1FBQ2hCLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUM7SUFDL0IsQ0FBQztJQUVPLFdBQVc7UUFDbEIsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQztJQUNqQyxDQUFDO0lBRUQsS0FBSztRQUNKLE9BQU8sSUFBSSxDQUFDLFNBQVMsRUFBRSxHQUFHLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUM5QyxDQUFDO0lBRUQsa0JBQWtCO1FBQ2pCLE9BQU8sSUFBSSxDQUFDLHdCQUF3QixFQUFFLENBQUMsTUFBTSxDQUFDO0lBQy9DLENBQUM7SUFFRCxtQkFBbUI7UUFDbEIsT0FBTyxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQyxNQUFNLENBQVMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2pHLENBQUM7SUFFRCxJQUFJLEtBQUs7UUFDUixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDcEIsQ0FBQztJQUVELFNBQVMsQ0FBQyxTQUErQjtRQUN4QyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3JELElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFFRCxzQkFBc0I7UUFDckIsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsc0JBQXNCLEVBQUUsQ0FBQyxDQUFDO0lBQ3hGLENBQUM7SUFFUyxZQUFZLENBQUMsTUFBVyxFQUFFLEtBQVU7UUFDN0MsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDaEksQ0FBQztJQUVPLGVBQWUsQ0FBQyxXQUF3QztRQUUvRCxJQUFJLFNBQVMsR0FBeUMsSUFBSSxDQUFDO1FBQzNELE9BQU8sU0FBUyxZQUFZLGlCQUFlLEVBQUUsQ0FBQztZQUM3QyxJQUFJLFNBQVMsQ0FBQyxFQUFFLEVBQUUsS0FBSyxXQUFXLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQztnQkFDekMsT0FBTyxJQUFJLENBQUM7WUFDYixDQUFDO1lBQ0QsU0FBUyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNoQyxDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0lBRU0sY0FBYyxDQUFDLFFBQWE7UUFDbEMsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNoRSxPQUFPLFdBQVcsQ0FBQztJQUNwQixDQUFDO0lBRUQsV0FBVyxDQUFDLFdBQXdDO1FBQ25ELElBQUksSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUM5RSxNQUFNLEtBQUssQ0FBQyxHQUFHLFdBQVcsQ0FBQyxRQUFRLGtDQUFrQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUN2RixDQUFDO2FBQU0sSUFBSSxJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7WUFDOUMsTUFBTSxLQUFLLENBQUMsR0FBRyxXQUFXLENBQUMsUUFBUSxtQkFBbUIsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDeEUsQ0FBQztRQUVELElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDM0QsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQzlELElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzVELENBQUM7SUFFTyxLQUFLLENBQUMsWUFBWSxDQUFDLE9BQXNFO1FBQ2hHLE1BQU0sVUFBVSxHQUFHLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUUzQyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzlDLElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUVNLFlBQVksQ0FBQyxTQUErQixFQUFFLE9BQU8sR0FBRyxLQUFLO1FBQ25FLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNsQixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDaEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUMxQixLQUFLLEdBQUcsSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNELElBQUksU0FBUyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzdCLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDN0MsS0FBSyxHQUFHLEtBQUssQ0FBQztZQUNkLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFDaEIsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ2hGLENBQUM7SUFDRixDQUFDO0lBRU0sY0FBYyxDQUFDLFdBQXdDLEVBQUUsS0FBbUI7UUFDbEYsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQ3BELElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDL0IsQ0FBQztRQUNELElBQUksV0FBVyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUM7WUFDM0IsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2pELFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN2QixDQUFDO1FBRUQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQUVELFlBQVksQ0FBQyxXQUFtQyxFQUFFLFVBQW1CLElBQUksRUFBRSxVQUFtQixJQUFJLEVBQUUsWUFBWSxHQUFHLEtBQUs7UUFFdkgsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQ25CLEtBQUssTUFBTSxLQUFLLElBQUksV0FBcUMsRUFBRSxDQUFDO1lBQzNELElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7Z0JBQzNDLElBQUksWUFBWSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUM7b0JBQ2hELFNBQVM7Z0JBQ1YsQ0FBQztnQkFDRCxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3pDLElBQUksT0FBTyxFQUFFLENBQUM7b0JBQ2IsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNqQixDQUFDO3FCQUFNLENBQUM7b0JBQ1AsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUN4RCxDQUFDO2dCQUNELE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDckIsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUNuRCxJQUFJLE1BQU0sRUFBRSxDQUFDO29CQUNaLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ2hELENBQUM7cUJBQU0sQ0FBQztvQkFDUCxNQUFNLEtBQUssQ0FBQyxhQUFhLEtBQUssQ0FBQyxRQUFRLHNDQUFzQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztnQkFDL0YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNiLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMzRCxDQUFDO0lBQ0YsQ0FBQztJQUVELEtBQUssQ0FBQyx3QkFBd0IsQ0FBQyxNQUE0QixFQUFFLFFBQWE7UUFDekUsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbEQsSUFBSSxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQ3BDLElBQUksU0FBUyxFQUFFLENBQUM7Z0JBQ2YsU0FBUyxDQUFDLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUMzQyxNQUFNLFNBQVMsQ0FBQyw0QkFBNEIsRUFBRSxDQUFDO1lBQ2hELENBQUM7aUJBQU0sQ0FBQztnQkFDUCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztnQkFDbkQsS0FBSyxNQUFNLElBQUksSUFBSSxhQUFhLEVBQUUsQ0FBQztvQkFDbEMsTUFBTSxJQUFJLENBQUMsd0JBQXdCLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUN2RCxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRUQsWUFBWSxDQUFDLEdBQWlCLEVBQUUsTUFBZSxFQUFFLGdCQUF3QjtRQUN4RSw0REFBNEQ7UUFDNUQsTUFBTSxLQUFLLEdBQTJCLEVBQUUsQ0FBQztRQUN6QyxNQUFNLE9BQU8sR0FBMkIsRUFBRSxDQUFDO1FBRTNDLEdBQUcsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEVBQUU7WUFDMUIsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsc0JBQXNCLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzdFLElBQUksaUJBQWlCLEVBQUUsQ0FBQztnQkFFdkIsSUFBSSxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQzFCLFlBQVk7eUJBQ1YsT0FBTzt5QkFDUCxNQUFNLENBQUMsYUFBYSxDQUFDO3lCQUNyQixPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7d0JBQ1oseUJBQXlCLENBQUMsQ0FBQyxFQUFFLGlCQUFpQixFQUFFLEtBQUssQ0FBQzs2QkFDcEQsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzFDLENBQUMsQ0FBQyxDQUFDO2dCQUNMLENBQUM7Z0JBRUQsbUJBQW1CO2dCQUNuQixJQUFJLDZCQUE2QixDQUFDLFlBQVksQ0FBQyxJQUFJLDJCQUEyQixDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7b0JBQzlGLFlBQVksQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLFlBQVksQ0FBQyxFQUFFO3dCQUNoRCxJQUFJLG1CQUFtQixDQUFDLGlCQUFpQixDQUFDLEVBQUUsQ0FBQzs0QkFDNUMsTUFBTSxpQkFBaUIsR0FBRyxpQkFBaUIsQ0FBQyxZQUFZLENBQUMsMkJBQTJCLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQzs0QkFDcEcsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO2dDQUN2QixpQkFBaUIsQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLENBQUMsY0FBYyxDQUFDLENBQUM7Z0NBQ2pFLGlCQUFpQixDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsQ0FBQzs0QkFDbEUsQ0FBQztpQ0FBTSxDQUFDO2dDQUNQLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsQ0FBQzs0QkFDOUMsQ0FBQzt3QkFDRixDQUFDO29CQUNGLENBQUMsQ0FBQyxDQUFDO2dCQUNKLENBQUM7Z0JBRUQsT0FBTyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO2dCQUVoQyxJQUFJLFlBQVksQ0FBQyxPQUFPLElBQUksWUFBWSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQzdELGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ3BELENBQUM7WUFDRixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsSUFBSSxvQ0FBb0MsQ0FBQyxJQUFJLENBQUMsSUFBSSw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO29CQUN2RixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsMkJBQTJCLENBQUMsWUFBWSxFQUFFLGdCQUFnQixDQUFDLENBQUM7b0JBQ25GLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQ3ZCLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFFSCxNQUFNLFFBQVEsR0FBRyxDQUFDLEdBQUcsS0FBSyxFQUFFLEdBQUcsT0FBTyxDQUFDLENBQUM7UUFDeEMsSUFBSSxDQUFDLE1BQU0sSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDaEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUMxRCxDQUFDO0lBQ0YsQ0FBQztJQUVELDBCQUEwQixDQUFDLE1BQTRCLEVBQUUsUUFBYTtRQUNyRSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUVsRCxJQUFJLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7WUFDcEMsSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDZixTQUFTLENBQUMsMEJBQTBCLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDOUMsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO2dCQUNuRCxLQUFLLE1BQU0sSUFBSSxJQUFJLGFBQWEsRUFBRSxDQUFDO29CQUNsQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUNuRCxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7SUFFRixDQUFDO0lBRUQsY0FBYztRQUNiLENBQUMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBK0IsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDbEcsQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxXQUE0QixFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQztRQUMxRyxDQUFDLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBK0IsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDNUcsQ0FBQyxHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFdBQTRCLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDO1FBQ3BILElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM1QixJQUFJLENBQUMsc0JBQXNCLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDcEMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3ZDLENBQUM7SUFFUSxPQUFPO1FBQ2YsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDdkIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2pCLENBQUM7Q0FDRCxDQUFBO0FBclpZLGVBQWU7SUF5QnpCLFdBQUEsZUFBZSxDQUFBO0lBQ2YsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLGFBQWEsQ0FBQTtJQUNiLFlBQUEsbUJBQW1CLENBQUE7R0E1QlQsZUFBZSxDQXFaM0I7O0FBRU0sSUFBTSwyQkFBMkIsR0FBakMsTUFBTSwyQkFBNEIsU0FBUSxlQUFlO0lBSS9ELFlBQVksU0FBYyxFQUN6QixHQUFXLEVBQ1gsTUFBYyxFQUNkLE1BQWtCLEVBQ2xCLE9BQTZDLEVBQzdDLGFBQTRCLEVBQzVCLFlBQXdELEVBQ3ZDLGNBQStCLEVBQ3pCLG9CQUEyQyxFQUNuRCxZQUEyQixFQUNyQixrQkFBdUM7UUFFNUQsS0FBSyxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsb0JBQW9CLEVBQUUsWUFBWSxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDcEosSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsMkJBQTJCLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQ2hKLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkIsQ0FBQztJQUVELElBQWEsUUFBUTtRQUNwQixPQUFPLElBQUksQ0FBQyxTQUFVLENBQUM7SUFDeEIsQ0FBQztJQUVELElBQUksa0JBQWtCO1FBQ3JCLE9BQU8sSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQztJQUN2QyxDQUFDO0NBQ0QsQ0FBQTtBQTVCWSwyQkFBMkI7SUFXckMsV0FBQSxlQUFlLENBQUE7SUFDZixXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEsYUFBYSxDQUFBO0lBQ2IsWUFBQSxtQkFBbUIsQ0FBQTtHQWRULDJCQUEyQixDQTRCdkM7O0FBRUQ7O0dBRUc7QUFDSSxJQUFNLDRCQUE0QixHQUFsQyxNQUFNLDRCQUE2QixTQUFRLDJCQUEyQjtJQUM1RSxZQUFZLFNBQWMsRUFBRSxHQUFXLEVBQUUsTUFBYyxFQUFFLE1BQWtCLEVBQUUsT0FBMkIsRUFDdEYsY0FBK0IsRUFDekIsb0JBQTJDLEVBQ25ELFlBQTJCLEVBQ3JCLGtCQUF1QztRQUU1RCxLQUFLLENBQUMsU0FBUyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxvQkFBb0IsRUFBRSxZQUFZLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUNoSixDQUFDO0lBRU8sbUJBQW1CLENBQUMsR0FBUTtRQUNuQyxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDbEcsQ0FBQztJQUVPLFNBQVMsQ0FBQyxJQUFTLEVBQUUsR0FBUTtRQUNwQyxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRU8sZUFBZSxDQUFDLEtBQW1CLEVBQUUsY0FBcUQsRUFBRSxVQUE4QixFQUFFLE1BQXVCLEVBQUUsWUFBd0IsRUFBRSxXQUF1RCxFQUFFLGdCQUF3QjtRQUN2USw4RkFBOEY7UUFDOUYsTUFBTSxTQUFTLEdBQ2QsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FDdkMsMkJBQTJCLEVBQzNCLEtBQUssRUFDTCxjQUFjLEVBQ2QsVUFBVSxFQUNWLE1BQU0sRUFDTixZQUFZLEVBQ1osV0FBVyxFQUNYLGdCQUFnQixDQUNoQixDQUFDO1FBQ0gsU0FBUyxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQzFCLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDNUIsTUFBTSxVQUFVLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDcEcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDaEUsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVELDJCQUEyQixDQUFDLFlBQTZCLEVBQUUsZ0JBQXdCO1FBRWxGLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsWUFBWSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDOUQsTUFBTSxLQUFLLENBQUMsR0FBRyxZQUFZLENBQUMsUUFBUSwyQkFBMkIsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDakYsQ0FBQztRQUVELE1BQU0sb0JBQW9CLEdBQVUsRUFBRSxDQUFDO1FBQ3ZDLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFMUQsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDdEQsb0JBQW9CLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2xDLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQztZQUNwQixHQUFHLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNoRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xDLE1BQU0sS0FBSyxDQUFDLEdBQUcsWUFBWSxDQUFDLFFBQVEsOENBQThDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUM7WUFDOUcsQ0FBQztRQUNGLENBQUM7UUFFRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQztRQUN0QyxJQUFJLE1BQU0sR0FBZ0MsSUFBSSxDQUFDO1FBQy9DLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxvQkFBb0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUN0RCxJQUFJLFdBQVcsR0FBNEMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzFHLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDbEIsV0FBVyxHQUFHLE1BQU0sQ0FBQyw2QkFBNkIsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3hJLENBQUM7WUFDRCxNQUFNLEdBQUcsV0FBVyxDQUFDO1FBQ3RCLENBQUM7UUFDRCxNQUFNLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUM7UUFDcEosT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixDQUFDLENBQUM7SUFDcEosQ0FBQztDQUNELENBQUE7QUFwRVksNEJBQTRCO0lBRXRDLFdBQUEsZUFBZSxDQUFBO0lBQ2YsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLGFBQWEsQ0FBQTtJQUNiLFdBQUEsbUJBQW1CLENBQUE7R0FMVCw0QkFBNEIsQ0FvRXhDOztBQUVELGlFQUFpRTtBQUMxRCxJQUFNLHFCQUFxQixHQUEzQixNQUFNLHFCQUFzQixTQUFRLGVBQWU7SUFDekQsWUFBWSxHQUFXLEVBQUUsTUFBYyxFQUFFLE1BQWtCLEVBQUUsT0FBMkIsRUFDdEUsY0FBK0IsRUFDekIsb0JBQTJDLEVBQ25ELFlBQTJCLEVBQ3JCLGtCQUF1QztRQUc1RCxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxvQkFBb0IsRUFBRSxZQUFZLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUMzSSxDQUFDO0lBRUQsMkJBQTJCLENBQUMsWUFBd0IsRUFBRSxnQkFBd0I7UUFDN0UsTUFBTSxtQkFBbUIsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDO1FBQ3BKLDhGQUE4RjtRQUM5RixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQ3hFLDJCQUEyQixFQUMzQixtQkFBbUIsRUFDbkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQzFCLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUN0QixJQUFJLEVBQUUsWUFBWSxFQUNsQixJQUFJLEVBQ0osZ0JBQWdCLENBQ2hCLENBQUMsQ0FBQztRQUNILFNBQVMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUMxQixJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzFCLE1BQU0sVUFBVSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ2xHLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ2hFLE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7Q0FDRCxDQUFBO0FBN0JZLHFCQUFxQjtJQUUvQixXQUFBLGVBQWUsQ0FBQTtJQUNmLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxhQUFhLENBQUE7SUFDYixXQUFBLG1CQUFtQixDQUFBO0dBTFQscUJBQXFCLENBNkJqQyJ9