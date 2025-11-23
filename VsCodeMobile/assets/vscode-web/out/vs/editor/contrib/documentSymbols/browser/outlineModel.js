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
import { binarySearch, coalesceInPlace, equals } from '../../../../base/common/arrays.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { onUnexpectedExternalError } from '../../../../base/common/errors.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { LRUCache } from '../../../../base/common/map.js';
import { commonPrefixLength } from '../../../../base/common/strings.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import { ILanguageFeatureDebounceService } from '../../../common/services/languageFeatureDebounce.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IModelService } from '../../../common/services/model.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ILanguageFeaturesService } from '../../../common/services/languageFeatures.js';
export class TreeElement {
    remove() {
        this.parent?.children.delete(this.id);
    }
    static findId(candidate, container) {
        // complex id-computation which contains the origin/extension,
        // the parent path, and some dedupe logic when names collide
        let candidateId;
        if (typeof candidate === 'string') {
            candidateId = `${container.id}/${candidate}`;
        }
        else {
            candidateId = `${container.id}/${candidate.name}`;
            if (container.children.get(candidateId) !== undefined) {
                candidateId = `${container.id}/${candidate.name}_${candidate.range.startLineNumber}_${candidate.range.startColumn}`;
            }
        }
        let id = candidateId;
        for (let i = 0; container.children.get(id) !== undefined; i++) {
            id = `${candidateId}_${i}`;
        }
        return id;
    }
    static getElementById(id, element) {
        if (!id) {
            return undefined;
        }
        const len = commonPrefixLength(id, element.id);
        if (len === id.length) {
            return element;
        }
        if (len < element.id.length) {
            return undefined;
        }
        for (const [, child] of element.children) {
            // eslint-disable-next-line no-restricted-syntax
            const candidate = TreeElement.getElementById(id, child);
            if (candidate) {
                return candidate;
            }
        }
        return undefined;
    }
    static size(element) {
        let res = 1;
        for (const [, child] of element.children) {
            res += TreeElement.size(child);
        }
        return res;
    }
    static empty(element) {
        return element.children.size === 0;
    }
}
export class OutlineElement extends TreeElement {
    constructor(id, parent, symbol) {
        super();
        this.id = id;
        this.parent = parent;
        this.symbol = symbol;
        this.children = new Map();
    }
}
export class OutlineGroup extends TreeElement {
    constructor(id, parent, label, order) {
        super();
        this.id = id;
        this.parent = parent;
        this.label = label;
        this.order = order;
        this.children = new Map();
    }
    getItemEnclosingPosition(position) {
        return position ? this._getItemEnclosingPosition(position, this.children) : undefined;
    }
    _getItemEnclosingPosition(position, children) {
        for (const [, item] of children) {
            if (!item.symbol.range || !Range.containsPosition(item.symbol.range, position)) {
                continue;
            }
            return this._getItemEnclosingPosition(position, item.children) || item;
        }
        return undefined;
    }
    updateMarker(marker) {
        for (const [, child] of this.children) {
            this._updateMarker(marker, child);
        }
    }
    _updateMarker(markers, item) {
        item.marker = undefined;
        // find the proper start index to check for item/marker overlap.
        const idx = binarySearch(markers, item.symbol.range, Range.compareRangesUsingStarts);
        let start;
        if (idx < 0) {
            start = ~idx;
            if (start > 0 && Range.areIntersecting(markers[start - 1], item.symbol.range)) {
                start -= 1;
            }
        }
        else {
            start = idx;
        }
        const myMarkers = [];
        let myTopSev;
        for (; start < markers.length && Range.areIntersecting(item.symbol.range, markers[start]); start++) {
            // remove markers intersecting with this outline element
            // and store them in a 'private' array.
            const marker = markers[start];
            myMarkers.push(marker);
            markers[start] = undefined;
            if (!myTopSev || marker.severity > myTopSev) {
                myTopSev = marker.severity;
            }
        }
        // Recurse into children and let them match markers that have matched
        // this outline element. This might remove markers from this element and
        // therefore we remember that we have had markers. That allows us to render
        // the dot, saying 'this element has children with markers'
        for (const [, child] of item.children) {
            this._updateMarker(myMarkers, child);
        }
        if (myTopSev) {
            item.marker = {
                count: myMarkers.length,
                topSev: myTopSev
            };
        }
        coalesceInPlace(markers);
    }
}
export class OutlineModel extends TreeElement {
    static create(registry, textModel, token) {
        const cts = new CancellationTokenSource(token);
        const result = new OutlineModel(textModel.uri);
        const provider = registry.ordered(textModel);
        const promises = provider.map((provider, index) => {
            const id = TreeElement.findId(`provider_${index}`, result);
            const group = new OutlineGroup(id, result, provider.displayName ?? 'Unknown Outline Provider', index);
            return Promise.resolve(provider.provideDocumentSymbols(textModel, cts.token)).then(result => {
                for (const info of result || []) {
                    OutlineModel._makeOutlineElement(info, group);
                }
                return group;
            }, err => {
                onUnexpectedExternalError(err);
                return group;
            }).then(group => {
                if (!TreeElement.empty(group)) {
                    result._groups.set(id, group);
                }
                else {
                    group.remove();
                }
            });
        });
        const listener = registry.onDidChange(() => {
            const newProvider = registry.ordered(textModel);
            if (!equals(newProvider, provider)) {
                cts.cancel();
            }
        });
        return Promise.all(promises).then(() => {
            if (cts.token.isCancellationRequested && !token.isCancellationRequested) {
                return OutlineModel.create(registry, textModel, token);
            }
            else {
                return result._compact();
            }
        }).finally(() => {
            cts.dispose();
            listener.dispose();
            cts.dispose();
        });
    }
    static _makeOutlineElement(info, container) {
        const id = TreeElement.findId(info, container);
        const res = new OutlineElement(id, container, info);
        if (info.children) {
            for (const childInfo of info.children) {
                OutlineModel._makeOutlineElement(childInfo, res);
            }
        }
        container.children.set(res.id, res);
    }
    static get(element) {
        while (element) {
            if (element instanceof OutlineModel) {
                return element;
            }
            element = element.parent;
        }
        return undefined;
    }
    constructor(uri) {
        super();
        this.uri = uri;
        this.id = 'root';
        this.parent = undefined;
        this._groups = new Map();
        this.children = new Map();
        this.id = 'root';
        this.parent = undefined;
    }
    _compact() {
        let count = 0;
        for (const [key, group] of this._groups) {
            if (group.children.size === 0) { // empty
                this._groups.delete(key);
            }
            else {
                count += 1;
            }
        }
        if (count !== 1) {
            //
            this.children = this._groups;
        }
        else {
            // adopt all elements of the first group
            const group = Iterable.first(this._groups.values());
            for (const [, child] of group.children) {
                child.parent = this;
                this.children.set(child.id, child);
            }
        }
        return this;
    }
    merge(other) {
        if (this.uri.toString() !== other.uri.toString()) {
            return false;
        }
        if (this._groups.size !== other._groups.size) {
            return false;
        }
        this._groups = other._groups;
        this.children = other.children;
        return true;
    }
    getItemEnclosingPosition(position, context) {
        let preferredGroup;
        if (context) {
            let candidate = context.parent;
            while (candidate && !preferredGroup) {
                if (candidate instanceof OutlineGroup) {
                    preferredGroup = candidate;
                }
                candidate = candidate.parent;
            }
        }
        let result = undefined;
        for (const [, group] of this._groups) {
            result = group.getItemEnclosingPosition(position);
            if (result && (!preferredGroup || preferredGroup === group)) {
                break;
            }
        }
        return result;
    }
    getItemById(id) {
        // eslint-disable-next-line no-restricted-syntax
        return TreeElement.getElementById(id, this);
    }
    updateMarker(marker) {
        // sort markers by start range so that we can use
        // outline element starts for quicker look up
        marker.sort(Range.compareRangesUsingStarts);
        for (const [, group] of this._groups) {
            group.updateMarker(marker.slice(0));
        }
    }
    getTopLevelSymbols() {
        const roots = [];
        for (const child of this.children.values()) {
            if (child instanceof OutlineElement) {
                roots.push(child.symbol);
            }
            else {
                roots.push(...Iterable.map(child.children.values(), child => child.symbol));
            }
        }
        return roots.sort((a, b) => Range.compareRangesUsingStarts(a.range, b.range));
    }
    asListOfDocumentSymbols() {
        const roots = this.getTopLevelSymbols();
        const bucket = [];
        OutlineModel._flattenDocumentSymbols(bucket, roots, '');
        return bucket.sort((a, b) => Position.compare(Range.getStartPosition(a.range), Range.getStartPosition(b.range)) || Position.compare(Range.getEndPosition(b.range), Range.getEndPosition(a.range)));
    }
    static _flattenDocumentSymbols(bucket, entries, overrideContainerLabel) {
        for (const entry of entries) {
            bucket.push({
                kind: entry.kind,
                tags: entry.tags,
                name: entry.name,
                detail: entry.detail,
                containerName: entry.containerName || overrideContainerLabel,
                range: entry.range,
                selectionRange: entry.selectionRange,
                children: undefined, // we flatten it...
            });
            // Recurse over children
            if (entry.children) {
                OutlineModel._flattenDocumentSymbols(bucket, entry.children, entry.name);
            }
        }
    }
}
export const IOutlineModelService = createDecorator('IOutlineModelService');
let OutlineModelService = class OutlineModelService {
    constructor(_languageFeaturesService, debounces, modelService) {
        this._languageFeaturesService = _languageFeaturesService;
        this._disposables = new DisposableStore();
        this._cache = new LRUCache(15, 0.7);
        this._debounceInformation = debounces.for(_languageFeaturesService.documentSymbolProvider, 'DocumentSymbols', { min: 350 });
        // don't cache outline models longer than their text model
        this._disposables.add(modelService.onModelRemoved(textModel => {
            this._cache.delete(textModel.id);
        }));
    }
    dispose() {
        this._disposables.dispose();
    }
    async getOrCreate(textModel, token) {
        const registry = this._languageFeaturesService.documentSymbolProvider;
        const provider = registry.ordered(textModel);
        let data = this._cache.get(textModel.id);
        if (!data || data.versionId !== textModel.getVersionId() || !equals(data.provider, provider)) {
            const source = new CancellationTokenSource();
            data = {
                versionId: textModel.getVersionId(),
                provider,
                promiseCnt: 0,
                source,
                promise: OutlineModel.create(registry, textModel, source.token),
                model: undefined,
            };
            this._cache.set(textModel.id, data);
            const now = Date.now();
            data.promise.then(outlineModel => {
                data.model = outlineModel;
                this._debounceInformation.update(textModel, Date.now() - now);
            }).catch(_err => {
                this._cache.delete(textModel.id);
            });
        }
        if (data.model) {
            // resolved -> return data
            return data.model;
        }
        // increase usage counter
        data.promiseCnt += 1;
        const listener = token.onCancellationRequested(() => {
            // last -> cancel provider request, remove cached promise
            if (--data.promiseCnt === 0) {
                data.source.cancel();
                this._cache.delete(textModel.id);
            }
        });
        try {
            return await data.promise;
        }
        finally {
            listener.dispose();
        }
    }
    getDebounceValue(textModel) {
        return this._debounceInformation.get(textModel);
    }
    getCachedModels() {
        return Iterable.filter(Iterable.map(this._cache.values(), entry => entry.model), model => model !== undefined);
    }
};
OutlineModelService = __decorate([
    __param(0, ILanguageFeaturesService),
    __param(1, ILanguageFeatureDebounceService),
    __param(2, IModelService)
], OutlineModelService);
export { OutlineModelService };
registerSingleton(IOutlineModelService, OutlineModelService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0bGluZU1vZGVsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2RvY3VtZW50U3ltYm9scy9icm93c2VyL291dGxpbmVNb2RlbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxNQUFNLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMxRixPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckcsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUV4RSxPQUFPLEVBQWEsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDdkUsT0FBTyxFQUFVLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBSTlELE9BQU8sRUFBK0IsK0JBQStCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNuSSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDN0YsT0FBTyxFQUFxQixpQkFBaUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQy9HLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFdkUsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFFeEYsTUFBTSxPQUFnQixXQUFXO0lBTWhDLE1BQU07UUFDTCxJQUFJLENBQUMsTUFBTSxFQUFFLFFB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