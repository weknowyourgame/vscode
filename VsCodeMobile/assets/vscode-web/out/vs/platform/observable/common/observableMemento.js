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
import { strictEquals } from '../../../base/common/equals.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { DebugLocation } from '../../../base/common/observable.js';
// eslint-disable-next-line local/code-no-deep-import-of-internal
import { DebugNameData } from '../../../base/common/observableInternal/debugName.js';
// eslint-disable-next-line local/code-no-deep-import-of-internal
import { ObservableValue } from '../../../base/common/observableInternal/observables/observableValue.js';
import { IStorageService } from '../../storage/common/storage.js';
/**
 * Defines an observable memento. Returns a function that can be called with
 * the specific storage scope, target, and service to use in a class.
 *
 * Note that the returned Observable is a disposable, because it interacts
 * with storage service events, and must be tracked appropriately.
 */
export function observableMemento(opts) {
    return (scope, target, storageService) => {
        return new ObservableMemento(opts, scope, target, storageService);
    };
}
/**
 * A value that is stored, and is also observable. Note: T should be readonly.
 */
let ObservableMemento = class ObservableMemento extends ObservableValue {
    constructor(opts, storageScope, storageTarget, storageService) {
        const getStorageValue = () => {
            const fromStorage = storageService.get(opts.key, storageScope);
            if (fromStorage !== undefined) {
                try {
                    return opts.fromStorage(fromStorage);
                }
                catch {
                    return opts.defaultValue;
                }
            }
            return opts.defaultValue;
        };
        const initialValue = getStorageValue();
        super(new DebugNameData(undefined, `storage/${opts.key}`, undefined), initialValue, strictEquals, DebugLocation.ofCaller());
        this.opts = opts;
        this.storageScope = storageScope;
        this.storageTarget = storageTarget;
        this.storageService = storageService;
        this._store = new DisposableStore();
        this._noStorageUpdateNeeded = false;
        const didChange = storageService.onDidChangeValue(storageScope, opts.key, this._store);
        this._store.add(didChange((e) => {
            if (e.external && e.key === opts.key) {
                this._noStorageUpdateNeeded = true;
                try {
                    this.set(getStorageValue(), undefined);
                }
                finally {
                    this._noStorageUpdateNeeded = false;
                }
            }
        }));
    }
    _setValue(newValue) {
        super._setValue(newValue);
        if (this._noStorageUpdateNeeded) {
            return;
        }
        const valueToStore = this.opts.toStorage(this.get());
        this.storageService.store(this.opts.key, valueToStore, this.storageScope, this.storageTarget);
    }
    dispose() {
        this._store.dispose();
    }
};
ObservableMemento = __decorate([
    __param(3, IStorageService)
], ObservableMemento);
export { ObservableMemento };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JzZXJ2YWJsZU1lbWVudG8uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vb2JzZXJ2YWJsZS9jb21tb24vb2JzZXJ2YWJsZU1lbWVudG8udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxlQUFlLEVBQWUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNqRixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDbkUsaUVBQWlFO0FBQ2pFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNyRixpRUFBaUU7QUFDakUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdFQUF3RSxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0saUNBQWlDLENBQUM7QUFTL0Y7Ozs7OztHQU1HO0FBQ0gsTUFBTSxVQUFVLGlCQUFpQixDQUFJLElBQStCO0lBQ25FLE9BQU8sQ0FBQyxLQUFtQixFQUFFLE1BQXFCLEVBQUUsY0FBK0IsRUFBd0IsRUFBRTtRQUM1RyxPQUFPLElBQUksaUJBQWlCLENBQUksSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDdEUsQ0FBQyxDQUFDO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0ksSUFBTSxpQkFBaUIsR0FBdkIsTUFBTSxpQkFBcUIsU0FBUSxlQUFrQjtJQUkzRCxZQUNrQixJQUErQixFQUMvQixZQUEwQixFQUMxQixhQUE0QixFQUM1QixjQUFnRDtRQUVqRSxNQUFNLGVBQWUsR0FBRyxHQUFNLEVBQUU7WUFDL0IsTUFBTSxXQUFXLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLFlBQVksQ0FB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