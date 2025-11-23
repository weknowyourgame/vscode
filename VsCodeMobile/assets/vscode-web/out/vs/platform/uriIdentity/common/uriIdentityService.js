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
import { IUriIdentityService } from './uriIdentity.js';
import { URI } from '../../../base/common/uri.js';
import { registerSingleton } from '../../instantiation/common/extensions.js';
import { IFileService } from '../../files/common/files.js';
import { ExtUri, normalizePath } from '../../../base/common/resources.js';
import { Event } from '../../../base/common/event.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { quickSelect } from '../../../base/common/arrays.js';
class Entry {
    static { this._clock = 0; }
    constructor(uri) {
        this.uri = uri;
        this.time = Entry._clock++;
    }
    touch() {
        this.time = Entry._clock++;
        return this;
    }
}
let UriIdentityService = class UriIdentityService {
    constructor(_fileService) {
        this._fileService = _fileService;
        this._dispooables = new DisposableStore();
        this._limit = 2 ** 16;
        const schemeIgnoresPathCasingCache = new Map();
        // assume path casing matters unless the file system provider spec'ed the opposite.
        // for all other cases path casing matters, e.g for
        // * virtual documents
        // * in-memory uris
        // * all kind of "private" schemes
        const ignorePathCasing = (uri) => {
            let ignorePathCasing = schemeIgnoresPathCasingCache.get(uri.scheme);
            if (ignorePathCasing === undefined) {
                // retrieve once and then case per scheme until a change happens
                ignorePathCasing = _fileService.hasProvider(uri) && !this._fileService.hasCapability(uri, 1024 /* FileSystemProviderCapabilities.PathCaseSensitive */);
                schemeIgnoresPathCasingCache.set(uri.scheme, ignorePathCasing);
            }
            return ignorePathCasing;
        };
        this._dispooables.add(Event.any(_fileService.onDidChangeFileSystemProviderRegistrations, _fileService.onDidChangeFileSystemProviderCapabilities)(e => {
            const oldIgnorePathCasingValue = schemeIgnoresPathCasingCache.get(e.scheme);
            if (oldIgnorePathCasingValue === undefined) {
                return;
            }
            schemeIgnoresPathCasingCache.delete(e.scheme);
            const newIgnorePathCasingValue = ignorePathCasing(URI.from({ scheme: e.scheme }));
            if (newIgnorePathCasingValue === newIgnorePathCasingValue) {
                return;
            }
            for (const [key, entry] of this._canonicalUris.entries()) {
                if (entry.uri.scheme !== e.scheme) {
                    continue;
                }
                this._canonicalUris.delete(key);
            }
        }));
        this.extUri = new ExtUri(ignorePathCasing);
        this._canonicalUris = new Map();
    }
    dispose() {
        this._dispooables.dispose();
        this._canonicalUris.clear();
    }
    asCanonicalUri(uri) {
        // (1) normalize URI
        if (this._fileService.hasProvider(uri)) {
            uri = normalizePath(uri);
        }
        // (2) find the uri in its canonical form or use this uri to define it
        const uriKey = this.extUri.getComparisonKey(uri, true);
        const item = this._canonicalUris.get(uriKey);
        if (item) {
            return item.touch().uri.with({ fragment: uri.fragment });
        }
        // this uri is first and defines the canonical form
        this._canonicalUris.set(uriKey, new Entry(uri));
        this._checkTrim();
        return uri;
    }
    _checkTrim() {
        if (this._canonicalUris.size < this._limit) {
            return;
        }
        Entry._clock = 1;
        const times = [...this._canonicalUris.values()].map(e => e.time);
        const median = quickSelect(Math.floor(times.length / 2), times, (a, b) => a - b);
        for (const [key, entry] of this._canonicalUris.entries()) {
            // Its important to remove the median value here (<= not <).
            // If we have not touched any items since the last trim, the
            // median will be 0 and no items will be removed otherwise.
            if (entry.time <= median) {
                this._canonicalUris.delete(key);
            }
            else {
                entry.time = 0;
            }
        }
    }
};
UriIdentityService = __decorate([
    __param(0, IFileService)
], UriIdentityService);
export { UriIdentityService };
registerSingleton(IUriIdentityService, UriIdentityService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXJpSWRlbnRpdHlTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDdkQsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ2xELE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNoRyxPQUFPLEVBQUUsWUFBWSxFQUFvSCxNQUFNLDZCQUE2QixDQUFDO0FBQzdLLE9BQU8sRUFBRSxNQUFNLEVBQVcsYUFBYSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDbkYsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3RELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFN0QsTUFBTSxLQUFLO2FBQ0gsV0FBTSxHQUFHLENBQUMsQUFBSixDQUFLO0lBRWxCLFlBQXFCLEdBQVE7UUFBUixRQUFHLEdBQUgsR0FBRyxDQUFLO1FBRDdCLFNBQUksR0FBVyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDRyxDQUFDO0lBQ2xDLEtBQUs7UUFDSixJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUMzQixPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7O0FBR0ssSUFBTSxrQkFBa0IsR0FBeEIsTUFBTSxrQkFBa0I7SUFVOUIsWUFBMEIsWUFBMkM7UUFBMUIsaUJBQVksR0FBWixZQUFZLENBQWM7UUFKcEQsaUJBQVksR0FBRyxJQUFJLGVB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