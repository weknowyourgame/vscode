/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DisposableStore, strictEquals } from '../commonFacade/deps.js';
import { DebugLocation } from '../debugLocation.js';
import { DebugNameData } from '../debugName.js';
import { _setDerivedOpts } from './baseObservable.js';
import { Derived, DerivedWithSetter } from './derivedImpl.js';
export function derived(computeFnOrOwner, computeFn, debugLocation = DebugLocation.ofCaller()) {
    if (computeFn !== undefined) {
        return new Derived(new DebugNameData(computeFnOrOwner, undefined, computeFn), computeFn, undefined, undefined, strictEquals, debugLocation);
    }
    return new Derived(
    // eslint-disable-next-line local/code-no-any-casts
    new DebugNameData(undefined, undefined, computeFnOrOwner), 
    // eslint-disable-next-line local/code-no-any-casts
    computeFnOrOwner, undefined, undefined, strictEquals, debugLocation);
}
export function derivedWithSetter(owner, computeFn, setter, debugLocation = DebugLocation.ofCaller()) {
    return new DerivedWithSetter(new DebugNameData(owner, undefined, computeFn), computeFn, undefined, undefined, strictEquals, setter, debugLocation);
}
export function derivedOpts(options, computeFn, debugLocation = DebugLocation.ofCaller()) {
    return new Derived(new DebugNameData(options.owner, options.debugName, options.debugReferenceFn), computeFn, undefined, options.onLastObserverRemoved, options.equalsFn ?? strictEquals, debugLocation);
}
_setDerivedOpts(derivedOpts);
/**
 * Represents an observable that is derived from other observables.
 * The value is only recomputed when absolutely needed.
 *
 * {@link computeFn} should start with a JS Doc using `@description` to name the derived.
 *
 * Use `createEmptyChangeSummary` to create a "change summary" that can collect the changes.
 * Use `handleChange` to add a reported change to the change summary.
 * The compute function is given the last change summary.
 * The change summary is discarded after the compute function was called.
 *
 * @see derived
 */
export function derivedHandleChanges(options, computeFn, debugLocation = DebugLocation.ofCaller()) {
    return new Derived(new DebugNameData(options.owner, options.debugName, undefined), computeFn, options.changeTracker, undefined, options.equalityComparer ?? strictEquals, debugLocation);
}
export function derivedWithStore(computeFnOrOwner, computeFnOrUndefined, debugLocation = DebugLocation.ofCaller()) {
    let computeFn;
    let owner;
    if (computeFnOrUndefined === undefined) {
        // eslint-disable-next-line local/code-no-any-casts
        computeFn = computeFnOrOwner;
        owner = undefined;
    }
    else {
        owner = computeFnOrOwner;
        // eslint-disable-next-line local/code-no-any-casts
        computeFn = computeFnOrUndefined;
    }
    // Intentionally re-assigned in case an inactive observable is re-used later
    // eslint-disable-next-line local/code-no-potentially-unsafe-disposables
    let store = new DisposableStore();
    return new Derived(new DebugNameData(owner, undefined, computeFn), r => {
        if (store.isDisposed) {
            store = new DisposableStore();
        }
        else {
            store.clear();
        }
        return computeFn(r, store);
    }, undefined, () => store.dispose(), strictEquals, debugLocation);
}
export function derivedDisposable(computeFnOrOwner, computeFnOrUndefined, debugLocation = DebugLocation.ofCaller()) {
    let computeFn;
    let owner;
    if (computeFnOrUndefined === undefined) {
        // eslint-disable-next-line local/code-no-any-casts
        computeFn = computeFnOrOwner;
        owner = undefined;
    }
    else {
        owner = computeFnOrOwner;
        // eslint-disable-next-line local/code-no-any-casts
        computeFn = computeFnOrUndefined;
    }
    let store = undefined;
    return new Derived(new DebugNameData(owner, undefined, computeFn), r => {
        if (!store) {
            store = new DisposableStore();
        }
        else {
            store.clear();
        }
        const result = computeFn(r);
        if (result) {
            store.add(result);
        }
        return result;
    }, undefined, () => {
        if (store) {
            store.dispose();
            store = undefined;
        }
    }, strictEquals, debugLocation);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVyaXZlZC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvb2JzZXJ2YWJsZXMvZGVyaXZlZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUloRyxPQUFPLEVBQUUsZUFBZSxFQUFpQyxZQUFZLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN2RyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDcEQsT0FBTyxFQUFjLGFBQWEsRUFBa0IsTUFBTSxpQkFBaUIsQ0FBQztBQUM1RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDdEQsT0FBTyxFQUFrQixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQVU5RSxNQUFNLFVBQVUsT0FBTyxDQUN0QixnQkFBdUUsRUFDdkUsU0FBZ0UsRUFDaEUsYUFBYSxHQUFHLGFBQWEsQ0FBQyxRQUFRLEVBQUU7SUFFeEMsSUFBSSxTQUFTLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDN0IsT0FBTyxJQUFJLE9BQU8sQ0FDakIsSUFBSSxhQUFhLENBQUMsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxFQUN6RCxTQUFTLEVBQ1QsU0FBUyxFQUNULFNBQVMsRUFDVCxZQUFZLEVBQ1osYUFBYSxDQUNiLENBQUM7SUFDSCxDQUFDO0lBQ0QsT0FBTyxJQUFJLE9BQU87SUFDakIsbURBQW1EO0lBQ25ELElBQUksYUFBYSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsZ0JBQXVCLENBQUM7SUFDaEUsbURBQW1EO0lBQ25ELGdCQUF1QixFQUN2QixTQUFTLEVBQ1QsU0FBUyxFQUNULFlBQVksRUFDWixhQUFhLENBQ2IsQ0FBQztBQUNILENBQUM7QUFFRCxNQUFNLFVBQVUsaUJBQWlCLENBQUksS0FBNkIsRUFBRSxTQUFpQyxFQUFFLE1BQWlFLEVBQUUsYUFBYSxHQUFHLGFBQWEsQ0FBQyxRQUFRLEVBQUU7SUFDak4sT0FBTyxJQUFJLGlCQUFpQixDQUMzQixJQUFJLGFBQWEsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxFQUM5QyxTQUFTLEVBQ1QsU0FBUyxFQUNULFNBQVMsRUFDVCxZQUFZLEVBQ1osTUFBTSxFQUNOLGFBQWEsQ0FDYixDQUFDO0FBQ0gsQ0FBQztBQUVELE1BQU0sVUFBVSxXQUFXLENBQzFCLE9BR0MsRUFDRCxTQUFpQyxFQUNqQyxhQUFhLEdBQUcsYUFBYSxDQUFDLFFBQVEsRUFBRTtJQUV4QyxPQUFPLElBQUksT0FBTyxDQUNqQixJQUFJLGFBQWEsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEVBQzdFLFNBQVMsRUFDVCxTQUFTLEVBQ1QsT0FBTyxDQUFDLHFCQUFxQixFQUM3QixPQUFPLENBQUMsUUFBUSxJQUFJLFlBQVksRUFDaEMsYUFBYSxDQUNiLENBQUM7QUFDSCxDQUFDO0FBQ0QsZUFBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBRTdCOzs7Ozs7Ozs7Ozs7R0FZRztBQUNILE1BQU0sVUFBVSxvQkFBb0IsQ0FDbkMsT0FHQyxFQUNELFNBQStFLEVBQy9FLGFBQWEsR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFO0lBRXhDLE9BQU8sSUFBSSxPQUFPLENBQ2pCLElBQUksYUFBYSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsRUFDOUQsU0FBUyxFQUNULE9BQU8sQ0FBQyxhQUFhLEVBQ3JCLFNBQVMsRUFDVCxPQUFPLENBQUMsZ0JBQWdCLElBQUksWUFBWSxFQUN4QyxhQUFhLENBQ2IsQ0FBQztBQUNILENBQUM7QUFXRCxNQUFNLFVBQVUsZ0JBQWdCLENBQUksZ0JBQStFLEVBQUUsb0JBQXVFLEVBQUUsYUFBYSxHQUFHLGFBQWEsQ0FBQyxRQUFRLEVBQUU7SUFDck8sSUFBSSxTQUF5RCxDQUFDO0lBQzlELElBQUksS0FBaUIsQ0FBQztJQUN0QixJQUFJLG9CQUFvQixLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQ3hDLG1EQUFtRDtRQUNuRCxTQUFTLEdBQUcsZ0JBQXVCLENBQUM7UUFDcEMsS0FBSyxHQUFHLFNBQVMsQ0FBQztJQUNuQixDQUFDO1NBQU0sQ0FBQztRQUNQLEtBQUssR0FBRyxnQkFBZ0IsQ0FBQztRQUN6QixtREFBbUQ7UUFDbkQsU0FBUyxHQUFHLG9CQUEyQixDQUFDO0lBQ3pDLENBQUM7SUFFRCw0RUFBNEU7SUFDNUUsd0VBQXdFO0lBQ3hFLElBQUksS0FBSyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7SUFFbEMsT0FBTyxJQUFJLE9BQU8sQ0FDakIsSUFBSSxhQUFhLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsRUFDOUMsQ0FBQyxDQUFDLEVBQUU7UUFDSCxJQUFJLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUN0QixLQUFLLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztRQUMvQixDQUFDO2FBQU0sQ0FBQztZQUNQLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNmLENBQUM7UUFDRCxPQUFPLFNBQVMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDNUIsQ0FBQyxFQUNELFNBQVMsRUFDVCxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLEVBQ3JCLFlBQVksRUFDWixhQUFhLENBQ2IsQ0FBQztBQUNILENBQUM7QUFJRCxNQUFNLFVBQVUsaUJBQWlCLENBQW9DLGdCQUF1RCxFQUFFLG9CQUErQyxFQUFFLGFBQWEsR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFO0lBQ3ROLElBQUksU0FBaUMsQ0FBQztJQUN0QyxJQUFJLEtBQWlCLENBQUM7SUFDdEIsSUFBSSxvQkFBb0IsS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUN4QyxtREFBbUQ7UUFDbkQsU0FBUyxHQUFHLGdCQUF1QixDQUFDO1FBQ3BDLEtBQUssR0FBRyxTQUFTLENBQUM7SUFDbkIsQ0FBQztTQUFNLENBQUM7UUFDUCxLQUFLLEdBQUcsZ0JBQWdCLENBQUM7UUFDekIsbURBQW1EO1FBQ25ELFNBQVMsR0FBRyxvQkFBMkIsQ0FBQztJQUN6QyxDQUFDO0lBRUQsSUFBSSxLQUFLLEdBQWdDLFNBQVMsQ0FBQztJQUNuRCxPQUFPLElBQUksT0FBTyxDQUNqQixJQUFJLGFBQWEsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxFQUM5QyxDQUFDLENBQUMsRUFBRTtRQUNILElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNaLEtBQUssR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQy9CLENBQUM7YUFBTSxDQUFDO1lBQ1AsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2YsQ0FBQztRQUNELE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM1QixJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1osS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNuQixDQUFDO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDLEVBQ0QsU0FBUyxFQUNULEdBQUcsRUFBRTtRQUNKLElBQUksS0FBSyxFQUFFLENBQUM7WUFDWCxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDaEIsS0FBSyxHQUFHLFNBQVMsQ0FBQztRQUNuQixDQUFDO0lBQ0YsQ0FBQyxFQUNELFlBQVksRUFDWixhQUFhLENBQ2IsQ0FBQztBQUNILENBQUMifQ==