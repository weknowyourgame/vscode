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
var ExtHostDiagnostics_1;
/* eslint-disable local/code-no-native-private */
import { localize } from '../../../nls.js';
import { MarkerSeverity } from '../../../platform/markers/common/markers.js';
import { URI } from '../../../base/common/uri.js';
import { MainContext } from './extHost.protocol.js';
import { DiagnosticSeverity } from './extHostTypes.js';
import * as converter from './extHostTypeConverters.js';
import { Event, DebounceEmitter } from '../../../base/common/event.js';
import { coalesce } from '../../../base/common/arrays.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { ResourceMap } from '../../../base/common/map.js';
import { IExtHostFileSystemInfo } from './extHostFileSystemInfo.js';
export class DiagnosticCollection {
    #proxy;
    #onDidChangeDiagnostics;
    #data;
    constructor(_name, _owner, _maxDiagnosticsTotal, _maxDiagnosticsPerFile, _modelVersionIdProvider, extUri, proxy, onDidChangeDiagnostics) {
        this._name = _name;
        this._owner = _owner;
        this._maxDiagnosticsTotal = _maxDiagnosticsTotal;
        this._maxDiagnosticsPerFile = _maxDiagnosticsPerFile;
        this._modelVersionIdProvider = _modelVersionIdProvider;
        this._isDisposed = false;
        this._maxDiagnosticsTotal = Math.max(_maxDiagnosticsPerFile, _maxDiagnosticsTotal);
        this.#data = new ResourceMap(uri => extUri.getComparisonKey(uri));
        this.#proxy = proxy;
        this.#onDidChangeDiagnostics = onDidChangeDiagnostics;
    }
    dispose() {
        if (!this._isDisposed) {
            this.#onDidChangeDiagnostics.fire([...this.#data.keys()]);
            this.#proxy?.$clear(this._owner);
            this.#data.clear();
            this._isDisposed = true;
        }
    }
    get name() {
        this._checkDisposed();
        return this._name;
    }
    set(first, diagnostics) {
        if (!first) {
            // this set-call is a clear-call
            this.clear();
            return;
        }
        // the actual implementation for #set
        this._checkDisposed();
        let toSync = [];
        if (URI.isUri(first)) {
            if (!diagnostics) {
                // remove this entry
                this.delete(first);
                return;
            }
            // update single row
            this.#data.set(first, coalesce(diagnostics));
            toSync = [first];
        }
        else if (Array.isArray(first)) {
            // update many rows
            toSync = [];
            let lastUri;
            // ensure stable-sort
            first = [...first].sort(DiagnosticCollection._compareIndexedTuplesByUri);
            for (const tuple of first) {
                const [uri, diagnostics] = tuple;
                if (!lastUri || uri.toString() !== lastUri.toString()) {
                    if (lastUri && this.#data.get(lastUri).length === 0) {
                        this.#data.delete(lastUri);
                    }
                    lastUri = uri;
                    toSync.push(uri);
                    this.#data.set(uri, []);
                }
                if (!diagnostics) {
                    // [Uri, undefined] means clear this
                    const currentDiagnostics = this.#data.get(uri);
                    if (currentDiagnostics) {
                        currentDiagnostics.length = 0;
                    }
                }
                else {
                    const currentDiagnostics = this.#data.get(uri);
                    currentDiagnostics?.push(...coalesce(diagnostics));
                }
            }
        }
        // send event for extensions
        this.#onDidChangeDiagnostics.fire(toSync);
        // compute change and send to main side
        if (!this.#proxy) {
            return;
        }
        const entries = [];
        let totalMarkerCount = 0;
        for (const uri of toSync) {
            let marker = [];
            const diagnostics = this.#data.get(uri);
            if (diagnostics) {
                // no more than N diagnostics per file
                if (diagnostics.length > this._maxDiagnosticsPerFile) {
                    marker = [];
                    const order = [DiagnosticSeverity.Error, DiagnosticSeverity.Warning, DiagnosticSeverity.Information, DiagnosticSeverity.Hint];
                    orderLoop: for (let i = 0; i < 4; i++) {
                        for (const diagnostic of diagnostics) {
                            if (diagnostic.severity === order[i]) {
                                const len = marker.push({ ...converter.Diagnostic.from(diagnostic), modelVersionId: this._modelVersionIdProvider(uri) });
                                if (len === this._maxDiagnosticsPerFile) {
                                    break orderLoop;
                                }
                            }
                        }
                    }
                    // add 'signal' marker for showing omitted errors/warnings
                    marker.push({
                        severity: MarkerSeverity.Info,
                        message: localize({ key: 'limitHit', comment: ['amount of errors/warning skipped due to limits'] }, "Not showing {0} further errors and warnings.", diagnostics.length - this._maxDiagnosticsPerFile),
                        startLineNumber: marker[marker.length - 1].startLineNumber,
                        startColumn: marker[marker.length - 1].startColumn,
                        endLineNumber: marker[marker.length - 1].endLineNumber,
                        endColumn: marker[marker.length - 1].endColumn
                    });
                }
                else {
                    marker = diagnostics.map(diag => ({ ...converter.Diagnostic.from(diag), modelVersionId: this._modelVersionIdProvider(uri) }));
                }
            }
            entries.push([uri, marker]);
            totalMarkerCount += marker.length;
            if (totalMarkerCount > this._maxDiagnosticsTotal) {
                // ignore markers that are above the limit
                break;
            }
        }
        this.#proxy.$changeMany(this._owner, entries);
    }
    delete(uri) {
        this._checkDisposed();
        this.#onDidChangeDiagnostics.fire([uri]);
        this.#data.delete(uri);
        this.#proxy?.$changeMany(this._owner, [[uri, undefined]]);
    }
    clear() {
        this._checkDisposed();
        this.#onDidChangeDiagnostics.fire([...this.#data.keys()]);
        this.#data.clear();
        this.#proxy?.$clear(this._owner);
    }
    forEach(callback, thisArg) {
        this._checkDisposed();
        for (const [uri, values] of this) {
            callback.call(thisArg, uri, values, this);
        }
    }
    *[Symbol.iterator]() {
        this._checkDisposed();
        for (const uri of this.#data.keys()) {
            yield [uri, this.get(uri)];
        }
    }
    get(uri) {
        this._checkDisposed();
        const result = this.#data.get(uri);
        if (Array.isArray(result)) {
            return Object.freeze(result.slice(0));
        }
        return [];
    }
    has(uri) {
        this._checkDisposed();
        return Array.isArray(this.#data.get(uri));
    }
    _checkDisposed() {
        if (this._isDisposed) {
            throw new Error('illegal state - object is disposed');
        }
    }
    static _compareIndexedTuplesByUri(a, b) {
        if (a[0].toString() < b[0].toString()) {
            return -1;
        }
        else if (a[0].toString() > b[0].toString()) {
            return 1;
        }
        else {
            return 0;
        }
    }
}
let ExtHostDiagnostics = class ExtHostDiagnostics {
    static { ExtHostDiagnostics_1 = this; }
    static { this._idPool = 0; }
    static { this._maxDiagnosticsPerFile = 1000; }
    static { this._maxDiagnosticsTotal = 1.1 * this._maxDiagnosticsPerFile; }
    static _mapper(last) {
        const map = new ResourceMap();
        for (const uri of last) {
            map.set(uri, uri);
        }
        return { uris: Object.freeze(Array.from(map.values())) };
    }
    constructor(mainContext, _logService, _fileSystemInfoService, _extHostDocumentsAndEditors) {
        this._logService = _logService;
        this._fileSystemInfoService = _fileSystemInfoService;
        this._extHostDocumentsAndEditors = _extHostDocumentsAndEditors;
        this._collections = new Map();
        this._onDidChangeDiagnostics = new DebounceEmitter({ merge: all => all.flat(), delay: 50 });
        this.onDidChangeDiagnostics = Event.map(this._onDidChangeDiagnostics.event, ExtHostDiagnostics_1._mapper);
        this._proxy = mainContext.getProxy(MainContext.MainThreadDiagnostics);
    }
    createDiagnosticCollection(extensionId, name) {
        const { _collections, _proxy, _onDidChangeDiagnostics, _logService, _fileSystemInfoService, _extHostDocumentsAndEditors } = this;
        const loggingProxy = new class {
            $changeMany(owner, entries) {
                _proxy.$changeMany(owner, entries);
                _logService.trace('[DiagnosticCollection] change many (extension, owner, uris)', extensionId.value, owner, entries.length === 0 ? 'CLEARING' : entries);
            }
            $clear(owner) {
                _proxy.$clear(owner);
                _logService.trace('[DiagnosticCollection] remove all (extension, owner)', extensionId.value, owner);
            }
            dispose() {
                _proxy.dispose();
            }
        };
        let owner;
        if (!name) {
            name = '_generated_diagnostic_collection_name_#' + ExtHostDiagnostics_1._idPool++;
            owner = name;
        }
        else if (!_collections.has(name)) {
            owner = name;
        }
        else {
            this._logService.warn(`DiagnosticCollection with name '${name}' does already exist.`);
            do {
                owner = name + ExtHostDiagnostics_1._idPool++;
            } while (_collections.has(owner));
        }
        const result = new class extends DiagnosticCollection {
            constructor() {
                super(name, owner, ExtHostDiagnostics_1._maxDiagnosticsTotal, ExtHostDiagnostics_1._maxDiagnosticsPerFile, uri => _extHostDocumentsAndEditors.getDocument(uri)?.version, _fileSystemInfoService.extUri, loggingProxy, _onDidChangeDiagnostics);
                _collections.set(owner, this);
            }
            dispose() {
                super.dispose();
                _collections.delete(owner);
            }
        };
        return result;
    }
    getDiagnostics(resource) {
        if (resource) {
            return this._getDiagnostics(resource);
        }
        else {
            const index = new Map();
            const res = [];
            for (const collection of this._collections.values()) {
                collection.forEach((uri, diagnostics) => {
                    let idx = index.get(uri.toString());
                    if (typeof idx === 'undefined') {
                        idx = res.length;
                        index.set(uri.toString(), idx);
                        res.push([uri, []]);
                    }
                    res[idx][1] = res[idx][1].concat(...diagnostics);
                });
            }
            return res;
        }
    }
    _getDiagnostics(resource) {
        let res = [];
        for (const collection of this._collections.values()) {
            if (collection.has(resource)) {
                res = res.concat(collection.get(resource));
            }
        }
        return res;
    }
    $acceptMarkersChange(data) {
        if (!this._mirrorCollection) {
            const name = '_generated_mirror';
            const collection = new DiagnosticCollection(name, name, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, // no limits because this collection is just a mirror of "sanitized" data
            // no limits because this collection is just a mirror of "sanitized" data
            _uri => undefined, this._fileSystemInfoService.extUri, undefined, this._onDidChangeDiagnostics);
            this._collections.set(name, collection);
            this._mirrorCollection = collection;
        }
        for (const [uri, markers] of data) {
            this._mirrorCollection.set(URI.revive(uri), markers.map(converter.Diagnostic.to));
        }
    }
};
ExtHostDiagnostics = ExtHostDiagnostics_1 = __decorate([
    __param(1, ILogService),
    __param(2, IExtHostFileSystemInfo)
], ExtHostDiagnostics);
export { ExtHostDiagnostics };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdERpYWdub3N0aWNzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvY29tbW9uL2V4dEhvc3REaWFnbm9zdGljcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsaURBQWlEO0FBRWpELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMzQyxPQUFPLEVBQWUsY0FBYyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDMUYsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSw2QkFBNkIsQ0FBQztBQUVqRSxPQUFPLEVBQUUsV0FBVyxFQUFxRSxNQUFNLHVCQUF1QixDQUFDO0FBQ3ZILE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ3ZELE9BQU8sS0FBSyxTQUFTLE1BQU0sNEJBQTRCLENBQUM7QUFDeEQsT0FBTyxFQUFFLEtBQUssRUFBVyxlQUFlLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNoRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDMUQsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUUxRCxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUlwRSxNQUFNLE9BQU8sb0JBQW9CO0lBRXZCLE1BQU0sQ0FBeUM7SUFDL0MsdUJBQXVCLENBQWlDO0lBQ3hELEtBQUssQ0FBbUM7SUFJakQsWUFDa0IsS0FBYSxFQUNiLE1BQWMsRUFDZCxvQkFBNEIsRUFDNUIsc0JBQThCLEVBQzlCLHVCQUF5RCxFQUMxRSxNQUFlLEVBQ2YsS0FBNkMsRUFDN0Msc0JBQXNEO1FBUHJDLFVBQUssR0FBTCxLQUFLLENBQVE7UUFD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