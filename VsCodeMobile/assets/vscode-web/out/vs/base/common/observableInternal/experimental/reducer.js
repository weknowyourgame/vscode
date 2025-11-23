/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { strictEquals, BugIndicatingError } from '../commonFacade/deps.js';
import { subtransaction } from '../transaction.js';
import { DebugNameData } from '../debugName.js';
import { DerivedWithSetter } from '../observables/derivedImpl.js';
import { DebugLocation } from '../debugLocation.js';
/**
 * Creates an observable value that is based on values and changes from other observables.
 * Additionally, a reducer can report how that state changed.
*/
export function observableReducer(owner, options) {
    // eslint-disable-next-line local/code-no-any-casts
    return observableReducerSettable(owner, options);
}
/**
 * Creates an observable value that is based on values and changes from other observables.
 * Additionally, a reducer can report how that state changed.
*/
export function observableReducerSettable(owner, options) {
    let prevValue = undefined;
    let hasValue = false;
    const d = new DerivedWithSetter(new DebugNameData(owner, undefined, options.update), (reader, changeSummary) => {
        if (!hasValue) {
            prevValue = options.initial instanceof Function ? options.initial() : options.initial;
            hasValue = true;
        }
        const newValue = options.update(reader, prevValue, changeSummary);
        prevValue = newValue;
        return newValue;
    }, options.changeTracker, () => {
        if (hasValue) {
            options.disposeFinal?.(prevValue);
            hasValue = false;
        }
    }, options.equalityComparer ?? strictEquals, (value, tx, change) => {
        if (!hasValue) {
            throw new BugIndicatingError('Can only set when there is a listener! This is to prevent leaks.');
        }
        subtransaction(tx, tx => {
            prevValue = value;
            d.setValue(value, tx, change);
        });
    }, DebugLocation.ofCaller());
    return d;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVkdWNlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvZXhwZXJpbWVudGFsL3JlZHVjZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFvQixZQUFZLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUU3RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFFbkQsT0FBTyxFQUFFLGFBQWEsRUFBYyxNQUFNLGlCQUFpQixDQUFDO0FBQzVELE9BQU8sRUFBRSxpQkFBaUIsRUFBa0IsTUFBTSwrQkFBK0IsQ0FBQztBQUNsRixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFzQnBEOzs7RUFHRTtBQUNGLE1BQU0sVUFBVSxpQkFBaUIsQ0FBbUMsS0FBaUIsRUFBRSxPQUFtRDtJQUN6SSxtREFBbUQ7SUFDbkQsT0FBTyx5QkFBeUIsQ0FBNEIsS0FBSyxFQUFFLE9BQU8sQ0FBUSxDQUFDO0FBQ3BGLENBQUM7QUFFRDs7O0VBR0U7QUFDRixNQUFNLFVBQVUseUJBQXlCLENBQW1DLEtBQWlCLEVBQUUsT0FBbUQ7SUFDakosSUFBSSxTQUFTLEdBQWtCLFNBQVMsQ0FBQztJQUN6QyxJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUM7SUFFckIsTUFBTSxDQUFDLEdBQUcsSUFBSSxpQkFBaUIsQ0FDOUIsSUFBSSxhQUFhLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQ25ELENBQUMsTUFBa0MsRUFBRSxhQUFhLEVBQUUsRUFBRTtRQUNyRCxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDZixTQUFTLEdBQUcsT0FBTyxDQUFDLE9BQU8sWUFBWSxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztZQUN0RixRQUFRLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLENBQUM7UUFDRCxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFVLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDbkUsU0FBUyxHQUFHLFFBQVEsQ0FBQztRQUNyQixPQUFPLFFBQVEsQ0FBQztJQUNqQixDQUFDLEVBQ0QsT0FBTyxDQUFDLGFBQWEsRUFDckIsR0FBRyxFQUFFO1FBQ0osSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNkLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQyxTQUFVLENBQUMsQ0FBQztZQUNuQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQ2xCLENBQUM7SUFDRixDQUFDLEVBQ0QsT0FBTyxDQUFDLGdCQUFnQixJQUFJLFlBQVksRUFDeEMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQ3JCLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNmLE1BQU0sSUFBSSxrQkFBa0IsQ0FBQyxrRUFBa0UsQ0FBQyxDQUFDO1FBQ2xHLENBQUM7UUFDRCxjQUFjLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFO1lBQ3ZCLFNBQVMsR0FBRyxLQUFLLENBQUM7WUFDbEIsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQy9CLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxFQUNELGFBQWEsQ0FBQyxRQUFRLEVBQUUsQ0FDeEIsQ0FBQztJQUVGLE9BQU8sQ0FBQyxDQUFDO0FBQ1YsQ0FBQyJ9