/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isFalsyOrEmpty, isNonEmptyArray } from '../../../base/common/arrays.js';
import { DebounceEmitter } from '../../../base/common/event.js';
import { Iterable } from '../../../base/common/iterator.js';
import { toDisposable } from '../../../base/common/lifecycle.js';
import { ResourceMap, ResourceSet } from '../../../base/common/map.js';
import { Schemas } from '../../../base/common/network.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { MarkerSeverity } from './markers.js';
export const unsupportedSchemas = new Set([
    Schemas.inMemory,
    Schemas.vscodeSourceControl,
    Schemas.walkThrough,
    Schemas.walkThroughSnippet,
    Schemas.vscodeChatCodeBlock,
    Schemas.vscodeTerminal
]);
class DoubleResourceMap {
    constructor() {
        this._byResource = new ResourceMap();
        this._byOwner = new Map();
    }
    set(resource, owner, value) {
        let ownerMap = this._byResource.get(resource);
        if (!ownerMap) {
            ownerMap = new Map();
            this._byResource.set(resource, ownerMap);
        }
        ownerMap.set(owner, value);
        let resourceMap = this._byOwner.get(owner);
        if (!resourceMap) {
            resourceMap = new ResourceMap();
            this._byOwner.set(owner, resourceMap);
        }
        resourceMap.set(resource, value);
    }
    get(resource, owner) {
        const ownerMap = this._byResource.get(resource);
        return ownerMap?.get(owner);
    }
    delete(resource, owner) {
        let removedA = false;
        let removedB = false;
        const ownerMap = this._byResource.get(resource);
        if (ownerMap) {
            removedA = ownerMap.delete(owner);
        }
        const resourceMap = this._byOwner.get(owner);
        if (resourceMap) {
            removedB = resourceMap.delete(resource);
        }
        if (removedA !== removedB) {
            throw new Error('illegal state');
        }
        return removedA && removedB;
    }
    values(key) {
        if (typeof key === 'string') {
            return this._byOwner.get(key)?.values() ?? Iterable.empty();
        }
        if (URI.isUri(key)) {
            return this._byResource.get(key)?.values() ?? Iterable.empty();
        }
        return Iterable.map(Iterable.concat(...this._byOwner.values()), map => map[1]);
    }
}
class MarkerStats {
    constructor(service) {
        this.errors = 0;
        this.infos = 0;
        this.warnings = 0;
        this.unknowns = 0;
        this._data = new ResourceMap();
        this._service = service;
        this._subscription = service.onMarkerChanged(this._update, this);
    }
    dispose() {
        this._subscription.dispose();
    }
    _update(resources) {
        for (const resource of resources) {
            const oldStats = this._data.get(resource);
            if (oldStats) {
                this._substract(oldStats);
            }
            const newStats = this._resourceStats(resource);
            this._add(newStats);
            this._data.set(resource, newStats);
        }
    }
    _resourceStats(resource) {
        const result = { errors: 0, warnings: 0, infos: 0, unknowns: 0 };
        // TODO this is a hack
        if (unsupportedSchemas.has(resource.scheme)) {
            return result;
        }
        for (const { severity } of this._service.read({ resource })) {
            if (severity === MarkerSeverity.Error) {
                result.errors += 1;
            }
            else if (severity === MarkerSeverity.Warning) {
                result.warnings += 1;
            }
            else if (severity === MarkerSeverity.Info) {
                result.infos += 1;
            }
            else {
                result.unknowns += 1;
            }
        }
        return result;
    }
    _substract(op) {
        this.errors -= op.errors;
        this.warnings -= op.warnings;
        this.infos -= op.infos;
        this.unknowns -= op.unknowns;
    }
    _add(op) {
        this.errors += op.errors;
        this.warnings += op.warnings;
        this.infos += op.infos;
        this.unknowns += op.unknowns;
    }
}
export class MarkerService {
    constructor() {
        this._onMarkerChanged = new DebounceEmitter({
            delay: 0,
            merge: MarkerService._merge
        });
        this.onMarkerChanged = this._onMarkerChanged.event;
        this._data = new DoubleResourceMap();
        this._stats = new MarkerStats(this);
        this._filteredResources = new ResourceMap();
    }
    dispose() {
        this._stats.dispose();
        this._onMarkerChanged.dispose();
    }
    getStatistics() {
        return this._stats;
    }
    remove(owner, resources) {
        for (const resource of resources || []) {
            this.changeOne(owner, resource, []);
        }
    }
    changeOne(owner, resource, markerData) {
        if (isFalsyOrEmpty(markerData)) {
            // remove marker for this (owner,resource)-tuple
            const removed = this._data.delete(resource, owner);
            if (removed) {
                this._onMarkerChanged.fire([resource]);
            }
        }
        else {
            // insert marker for this (owner,resource)-tuple
            const markers = [];
            for (const data of markerData) {
                const marker = MarkerService._toMarker(owner, resource, data);
                if (marker) {
                    markers.push(marker);
                }
            }
            this._data.set(resource, owner, markers);
            this._onMarkerChanged.fire([resource]);
        }
    }
    installResourceFilter(resource, reason) {
        let reasons = this._filteredResources.get(resource);
        if (!reasons) {
            reasons = [];
            this._filteredResources.set(resource, reasons);
        }
        reasons.push(reason);
        this._onMarkerChanged.fire([resource]);
        return toDisposable(() => {
            const reasons = this._filteredResources.get(resource);
            if (!reasons) {
                return;
            }
            const reasonIndex = reasons.indexOf(reason);
            if (reasonIndex !== -1) {
                reasons.splice(reasonIndex, 1);
                if (reasons.length === 0) {
                    this._filteredResources.delete(resource);
                }
                this._onMarkerChanged.fire([resource]);
            }
        });
    }
    static _toMarker(owner, resource, data) {
        let { code, severity, message, source, startLineNumber, startColumn, endLineNumber, endColumn, relatedInformation, tags, origin } = data;
        if (!message) {
            return undefined;
        }
        // santize data
        startLineNumber = startLineNumber > 0 ? startLineNumber : 1;
        startColumn = startColumn > 0 ? startColumn : 1;
        endLineNumber = endLineNumber >= startLineNumber ? endLineNumber : startLineNumber;
        endColumn = endColumn > 0 ? endColumn : startColumn;
        return {
            resource,
            owner,
            code,
            severity,
            message,
            source,
            startLineNumber,
            startColumn,
            endLineNumber,
            endColumn,
            relatedInformation,
            tags,
            origin
        };
    }
    changeAll(owner, data) {
        const changes = [];
        // remove old marker
        const existing = this._data.values(owner);
        if (existing) {
            for (const data of existing) {
                const first = Iterable.first(data);
                if (first) {
                    changes.push(first.resource);
                    this._data.delete(first.resource, owner);
                }
            }
        }
        // add new markers
        if (isNonEmptyArray(data)) {
            // group by resource
            const groups = new ResourceMap();
            for (const { resource, marker: markerData } of data) {
                const marker = MarkerService._toMarker(owner, resource, markerData);
                if (!marker) {
                    // filter bad markers
                    continue;
                }
                const array = groups.get(resource);
                if (!array) {
                    groups.set(resource, [marker]);
                    changes.push(resource);
                }
                else {
                    array.push(marker);
                }
            }
            // insert all
            for (const [resource, value] of groups) {
                this._data.set(resource, owner, value);
            }
        }
        if (changes.length > 0) {
            this._onMarkerChanged.fire(changes);
        }
    }
    /**
     * Creates an information marker for filtered resources
     */
    _createFilteredMarker(resource, reasons) {
        const message = reasons.length === 1
            ? localize('filtered', "Problems are paused because: \"{0}\"", reasons[0])
            : localize('filtered.network', "Problems are paused because: \"{0}\" and {1} more", reasons[0], reasons.length - 1);
        return {
            owner: 'markersFilter',
            resource,
            severity: MarkerSeverity.Info,
            message,
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1,
        };
    }
    read(filter = Object.create(null)) {
        let { owner, resource, severities, take } = filter;
        if (!take || take < 0) {
            take = -1;
        }
        if (owner && resource) {
            // exactly one owner AND resource
            const reasons = !filter.ignoreResourceFilters ? this._filteredResources.get(resource) : undefined;
            if (reasons?.length) {
                const infoMarker = this._createFilteredMarker(resource, reasons);
                return [infoMarker];
            }
            const data = this._data.get(resource, owner);
            if (!data) {
                return [];
            }
            const result = [];
            for (const marker of data) {
                if (take > 0 && result.length === take) {
                    break;
                }
                const reasons = !filter.ignoreResourceFilters ? this._filteredResources.get(resource) : undefined;
                if (reasons?.length) {
                    result.push(this._createFilteredMarker(resource, reasons));
                }
                else if (MarkerService._accept(marker, severities)) {
                    result.push(marker);
                }
            }
            return result;
        }
        else {
            // of one resource OR owner
            const iterable = !owner && !resource
                ? this._data.values()
                : this._data.values(resource ?? owner);
            const result = [];
            const filtered = new ResourceSet();
            for (const markers of iterable) {
                for (const data of markers) {
                    if (filtered.has(data.resource)) {
                        continue;
                    }
                    if (take > 0 && result.length === take) {
                        break;
                    }
                    const reasons = !filter.ignoreResourceFilters ? this._filteredResources.get(data.resource) : undefined;
                    if (reasons?.length) {
                        result.push(this._createFilteredMarker(data.resource, reasons));
                        filtered.add(data.resource);
                    }
                    else if (MarkerService._accept(data, severities)) {
                        result.push(data);
                    }
                }
            }
            return result;
        }
    }
    static _accept(marker, severities) {
        return severities === undefined || (severities & marker.severity) === marker.severity;
    }
    // --- event debounce logic
    static _merge(all) {
        const set = new ResourceMap();
        for (const array of all) {
            for (const item of array) {
                set.set(item, true);
            }
        }
        return Array.from(set.keys());
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFya2VyU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9tYXJrZXJzL2NvbW1vbi9tYXJrZXJTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDakYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ2hFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM1RCxPQUFPLEVBQWUsWUFBWSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUN2RSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDMUQsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ2xELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMzQyxPQUFPLEVBQTZFLGNBQWMsRUFBb0IsTUFBTSxjQUFjLENBQUM7QUFFM0ksTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDekMsT0FBTyxDQUFDLFFBQVE7SUFDaEIsT0FBTyxDQUFDLG1CQUFtQjtJQUMzQixPQUFPLENBQUMsV0FBVztJQUNuQixPQUFPLENBQUMsa0JBQWtCO0lBQzFCLE9BQU8sQ0FBQyxtQkFBbUI7SUFDM0IsT0FBTyxDQUFDLGNBQWM7Q0FDdEIsQ0FBQyxDQUFDO0FBRUgsTUFBTSxpQkFBaUI7SUFBdkI7UUFFUyxnQkFBVyxHQUFHLElBQUksV0FBVyxFQUFrQixDQUFDO1FBQ2hELGFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBMEIsQ0FBQztJQWtEdEQsQ0FBQztJQWhEQSxH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