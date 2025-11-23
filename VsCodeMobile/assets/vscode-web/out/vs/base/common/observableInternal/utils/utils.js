/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { autorun } from '../reactions/autorun.js';
import { observableValue } from '../observables/observableValue.js';
import { DisposableStore, toDisposable } from '../commonFacade/deps.js';
import { derived, derivedOpts } from '../observables/derived.js';
import { observableFromEvent } from '../observables/observableFromEvent.js';
import { observableSignal } from '../observables/observableSignal.js';
import { _setKeepObserved, _setRecomputeInitiallyAndOnChange } from '../observables/baseObservable.js';
import { DebugLocation } from '../debugLocation.js';
export function observableFromPromise(promise) {
    const observable = observableValue('promiseValue', {});
    promise.then((value) => {
        observable.set({ value }, undefined);
    });
    return observable;
}
export function signalFromObservable(owner, observable) {
    return derivedOpts({
        owner,
        equalsFn: () => false,
    }, reader => {
        observable.read(reader);
    });
}
/**
 * Creates an observable that debounces the input observable.
 */
export function debouncedObservable(observable, debounceMs, debugLocation = DebugLocation.ofCaller()) {
    let hasValue = false;
    let lastValue;
    let timeout = undefined;
    return observableFromEvent(undefined, cb => {
        const d = autorun(reader => {
            const value = observable.read(reader);
            if (!hasValue) {
                hasValue = true;
                lastValue = value;
            }
            else {
                if (timeout) {
                    clearTimeout(timeout);
                }
                const debounceDuration = typeof debounceMs === 'number' ? debounceMs : debounceMs(lastValue, value);
                if (debounceDuration === 0) {
                    lastValue = value;
                    cb();
                    return;
                }
                timeout = setTimeout(() => {
                    lastValue = value;
                    cb();
                }, debounceDuration);
            }
        });
        return {
            dispose() {
                d.dispose();
                hasValue = false;
                lastValue = undefined;
            },
        };
    }, () => {
        if (hasValue) {
            return lastValue;
        }
        else {
            return observable.get();
        }
    }, debugLocation);
}
/**
 * Creates an observable that debounces the input observable.
 */
export function debouncedObservable2(observable, debounceMs, debugLocation = DebugLocation.ofCaller()) {
    const s = observableSignal('handleTimeout');
    let currentValue = undefined;
    let timeout = undefined;
    const d = derivedOpts({
        owner: undefined,
        onLastObserverRemoved: () => {
            currentValue = undefined;
        }
    }, reader => {
        const val = observable.read(reader);
        s.read(reader);
        if (val !== currentValue) {
            const debounceDuration = typeof debounceMs === 'number' ? debounceMs : debounceMs(currentValue, val);
            if (debounceDuration === 0) {
                currentValue = val;
                return val;
            }
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => {
                currentValue = val;
                s.trigger(undefined);
            }, debounceDuration);
        }
        return currentValue;
    }, debugLocation);
    return d;
}
export function wasEventTriggeredRecently(event, timeoutMs, disposableStore) {
    const observable = observableValue('triggeredRecently', false);
    let timeout = undefined;
    disposableStore.add(event(() => {
        observable.set(true, undefined);
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            observable.set(false, undefined);
        }, timeoutMs);
    }));
    return observable;
}
/**
 * This makes sure the observable is being observed and keeps its cache alive.
 */
export function keepObserved(observable) {
    const o = new KeepAliveObserver(false, undefined);
    observable.addObserver(o);
    return toDisposable(() => {
        observable.removeObserver(o);
    });
}
_setKeepObserved(keepObserved);
/**
 * This converts the given observable into an autorun.
 */
export function recomputeInitiallyAndOnChange(observable, handleValue) {
    const o = new KeepAliveObserver(true, handleValue);
    observable.addObserver(o);
    try {
        o.beginUpdate(observable);
    }
    finally {
        o.endUpdate(observable);
    }
    return toDisposable(() => {
        observable.removeObserver(o);
    });
}
_setRecomputeInitiallyAndOnChange(recomputeInitiallyAndOnChange);
export class KeepAliveObserver {
    constructor(_forceRecompute, _handleValue) {
        this._forceRecompute = _forceRecompute;
        this._handleValue = _handleValue;
        this._counter = 0;
    }
    beginUpdate(observable) {
        this._counter++;
    }
    endUpdate(observable) {
        if (this._counter === 1 && this._forceRecompute) {
            if (this._handleValue) {
                this._handleValue(observable.get());
            }
            else {
                observable.reportChanges();
            }
        }
        this._counter--;
    }
    handlePossibleChange(observable) {
        // NO OP
    }
    handleChange(observable, change) {
        // NO OP
    }
}
export function derivedObservableWithCache(owner, computeFn) {
    let lastValue = undefined;
    const observable = derivedOpts({ owner, debugReferenceFn: computeFn }, reader => {
        lastValue = computeFn(reader, lastValue);
        return lastValue;
    });
    return observable;
}
export function derivedObservableWithWritableCache(owner, computeFn) {
    let lastValue = undefined;
    const onChange = observableSignal('derivedObservableWithWritableCache');
    const observable = derived(owner, reader => {
        onChange.read(reader);
        lastValue = computeFn(reader, lastValue);
        return lastValue;
    });
    return Object.assign(observable, {
        clearCache: (tx) => {
            lastValue = undefined;
            onChange.trigger(tx);
        },
        setCache: (newValue, tx) => {
            lastValue = newValue;
            onChange.trigger(tx);
        }
    });
}
/**
 * When the items array changes, referential equal items are not mapped again.
 */
export function mapObservableArrayCached(owner, items, map, keySelector) {
    let m = new ArrayMap(map, keySelector);
    const self = derivedOpts({
        debugReferenceFn: map,
        owner,
        onLastObserverRemoved: () => {
            m.dispose();
            m = new ArrayMap(map);
        }
    }, (reader) => {
        const i = items.read(reader);
        m.setItems(i);
        return m.getItems();
    });
    return self;
}
class ArrayMap {
    constructor(_map, _keySelector) {
        this._map = _map;
        this._keySelector = _keySelector;
        this._cache = new Map();
        this._items = [];
    }
    dispose() {
        this._cache.forEach(entry => entry.store.dispose());
        this._cache.clear();
    }
    setItems(items) {
        const newItems = [];
        const itemsToRemove = new Set(this._cache.keys());
        for (const item of items) {
            const key = this._keySelector ? this._keySelector(item) : item;
            let entry = this._cache.get(key);
            if (!entry) {
                const store = new DisposableStore();
                const out = this._map(item, store);
                entry = { out, store };
                this._cache.set(key, entry);
            }
            else {
                itemsToRemove.delete(key);
            }
            newItems.push(entry.out);
        }
        for (const item of itemsToRemove) {
            const entry = this._cache.get(item);
            entry.store.dispose();
            this._cache.delete(item);
        }
        this._items = newItems;
    }
    getItems() {
        return this._items;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vb2JzZXJ2YWJsZUludGVybmFsL3V0aWxzL3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUVsRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFcEUsT0FBTyxFQUFFLGVBQWUsRUFBc0IsWUFBWSxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDNUYsT0FBTyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUNqRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN0RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsaUNBQWlDLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN2RyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFFcEQsTUFBTSxVQUFVLHFCQUFxQixDQUFJLE9BQW1CO0lBQzNELE1BQU0sVUFBVSxHQUFHLGVBQWUsQ0FBZ0IsY0FBYyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3RFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtRQUN0QixVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDdEMsQ0FBQyxDQUFDLENBQUM7SUFDSCxPQUFPLFVBQVUsQ0FBQztBQUNuQixDQUFDO0FBRUQsTUFBTSxVQUFVLG9CQUFvQixDQUFJLEtBQTZCLEVBQUUsVUFBMEI7SUFDaEcsT0FBTyxXQUFXLENBQUM7UUFDbEIsS0FBSztRQUNMLFFBQVEsRUFB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