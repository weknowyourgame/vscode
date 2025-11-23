/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DisposableStore, toDisposable } from '../commonFacade/deps.js';
import { DebugNameData } from '../debugName.js';
import { AutorunObserver } from './autorunImpl.js';
import { DebugLocation } from '../debugLocation.js';
/**
 * Runs immediately and whenever a transaction ends and an observed observable changed.
 * {@link fn} should start with a JS Doc using `@description` to name the autorun.
 */
export function autorun(fn, debugLocation = DebugLocation.ofCaller()) {
    return new AutorunObserver(new DebugNameData(undefined, undefined, fn), fn, undefined, debugLocation);
}
/**
 * Runs immediately and whenever a transaction ends and an observed observable changed.
 * {@link fn} should start with a JS Doc using `@description` to name the autorun.
 */
export function autorunOpts(options, fn, debugLocation = DebugLocation.ofCaller()) {
    return new AutorunObserver(new DebugNameData(options.owner, options.debugName, options.debugReferenceFn ?? fn), fn, undefined, debugLocation);
}
/**
 * Runs immediately and whenever a transaction ends and an observed observable changed.
 * {@link fn} should start with a JS Doc using `@description` to name the autorun.
 *
 * Use `changeTracker.createChangeSummary` to create a "change summary" that can collect the changes.
 * Use `changeTracker.handleChange` to add a reported change to the change summary.
 * The run function is given the last change summary.
 * The change summary is discarded after the run function was called.
 *
 * @see autorun
 */
export function autorunHandleChanges(options, fn, debugLocation = DebugLocation.ofCaller()) {
    return new AutorunObserver(new DebugNameData(options.owner, options.debugName, options.debugReferenceFn ?? fn), fn, options.changeTracker, debugLocation);
}
/**
 * @see autorunHandleChanges (but with a disposable store that is cleared before the next run or on dispose)
 */
export function autorunWithStoreHandleChanges(options, fn) {
    const store = new DisposableStore();
    const disposable = autorunHandleChanges({
        owner: options.owner,
        debugName: options.debugName,
        debugReferenceFn: options.debugReferenceFn ?? fn,
        changeTracker: options.changeTracker,
    }, (reader, changeSummary) => {
        store.clear();
        fn(reader, changeSummary, store);
    });
    return toDisposable(() => {
        disposable.dispose();
        store.dispose();
    });
}
/**
 * @see autorun (but with a disposable store that is cleared before the next run or on dispose)
 *
 * @deprecated Use `autorun(reader => { reader.store.add(...) })` instead!
 */
export function autorunWithStore(fn) {
    const store = new DisposableStore();
    const disposable = autorunOpts({
        owner: undefined,
        debugName: undefined,
        debugReferenceFn: fn,
    }, reader => {
        store.clear();
        fn(reader, store);
    });
    return toDisposable(() => {
        disposable.dispose();
        store.dispose();
    });
}
export function autorunDelta(observable, handler) {
    let _lastValue;
    return autorunOpts({ debugReferenceFn: handler }, (reader) => {
        const newValue = observable.read(reader);
        const lastValue = _lastValue;
        _lastValue = newValue;
        handler({ lastValue, newValue });
    });
}
export function autorunIterableDelta(getValue, handler, getUniqueIdentifier = v => v) {
    const lastValues = new Map();
    return autorunOpts({ debugReferenceFn: getValue }, (reader) => {
        const newValues = new Map();
        const removedValues = new Map(lastValues);
        for (const value of getValue(reader)) {
            const id = getUniqueIdentifier(value);
            if (lastValues.has(id)) {
                removedValues.delete(id);
            }
            else {
                newValues.set(id, value);
                lastValues.set(id, value);
            }
        }
        for (const id of removedValues.keys()) {
            lastValues.delete(id);
        }
        if (newValues.size || removedValues.size) {
            handler({ addedValues: [...newValues.values()], removedValues: [...removedValues.values()] });
        }
    });
}
/**
 * An autorun with a `dispose()` method on its `reader` which cancels the autorun.
 * It it safe to call `dispose()` synchronously.
 */
export function autorunSelfDisposable(fn, debugLocation = DebugLocation.ofCaller()) {
    let ar;
    let disposed = false;
    // eslint-disable-next-line prefer-const
    ar = autorun(reader => {
        fn({
            delayedStore: reader.delayedStore,
            store: reader.store,
            readObservable: reader.readObservable.bind(reader),
            dispose: () => {
                ar?.dispose();
                disposed = true;
            }
        });
    }, debugLocation);
    if (disposed) {
        ar.dispose();
    }
    return ar;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0b3J1bi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvcmVhY3Rpb25zL2F1dG9ydW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFJaEcsT0FBTyxFQUFFLGVBQWUsRUFBZSxZQUFZLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUNyRixPQUFPLEVBQUUsYUFBYSxFQUFrQixNQUFNLGlCQUFpQixDQUFDO0FBQ2hFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUNuRCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFFcEQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLE9BQU8sQ0FBQyxFQUFzQyxFQUFFLGFBQWEsR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFO0lBQ3ZHLE9BQU8sSUFBSSxlQUFlLENBQ3pCLElBQUksYUFBYSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsRUFBRSxDQUFDLEVBQzNDLEVBQUUsRUFDRixTQUFTLEVBQ1QsYUFBYSxDQUNiLENBQUM7QUFDSCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLFdBQVcsQ0FBQyxPQUE0QixFQUFFLEVBQXNDLEVBQUUsYUFBYSxHQUFHLGFBQWEsQ0FBQyxRQUFRLEVBQUU7SUFDekksT0FBTyxJQUFJLGVBQWUsQ0FDekIsSUFBSSxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsSUFBSSxFQUFFLENBQUMsRUFDbkYsRUFBRSxFQUNGLFNBQVMsRUFDVCxhQUFhLENBQ2IsQ0FBQztBQUNILENBQUM7QUFFRDs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBTSxVQUFVLG9CQUFvQixDQUNuQyxPQUVDLEVBQ0QsRUFBNEQsRUFDNUQsYUFBYSxH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