/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BugIndicatingError, DisposableStore } from '../commonFacade/deps.js';
import { getDebugName, DebugNameData } from '../debugName.js';
import { observableFromEvent } from '../observables/observableFromEvent.js';
import { autorunOpts } from '../reactions/autorun.js';
import { derivedObservableWithCache } from '../utils/utils.js';
/**
 * Creates an observable that has the latest changed value of the given observables.
 * Initially (and when not observed), it has the value of the last observable.
 * When observed and any of the observables change, it has the value of the last changed observable.
 * If multiple observables change in the same transaction, the last observable wins.
*/
export function latestChangedValue(owner, observables) {
    if (observables.length === 0) {
        throw new BugIndicatingError();
    }
    let hasLastChangedValue = false;
    let lastChangedValue = undefined;
    const result = observableFromEvent(owner, cb => {
        const store = new DisposableStore();
        for (const o of observables) {
            store.add(autorunOpts({ debugName: () => getDebugName(result, new DebugNameData(owner, undefined, undefined)) + '.updateLastChangedValue' }, reader => {
                hasLastChangedValue = true;
                lastChangedValue = o.read(reader);
                cb();
            }));
        }
        store.add({
            dispose() {
                hasLastChangedValue = false;
                lastChangedValue = undefined;
            },
        });
        return store;
    }, () => {
        if (hasLastChangedValue) {
            return lastChangedValue;
        }
        else {
            return observables[observables.length - 1].get();
        }
    });
    return result;
}
/**
 * Works like a derived.
 * However, if the value is not undefined, it is cached and will not be recomputed anymore.
 * In that case, the derived will unsubscribe from its dependencies.
*/
export function derivedConstOnceDefined(owner, fn) {
    return derivedObservableWithCache(owner, (reader, lastValue) => lastValue ?? fn(reader));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vb2JzZXJ2YWJsZUludGVybmFsL2V4cGVyaW1lbnRhbC91dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsZUFBZSxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDOUUsT0FBTyxFQUFjLFlBQVksRUFBRSxhQUFhLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMxRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDdEQsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFFL0Q7Ozs7O0VBS0U7QUFDRixNQUFNLFVBQVUsa0JBQWtCLENBQStCLEtBQWlCLEVBQUUsV0FBYztJQUNqRyxJQUFJLFdBQVcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDOUIsTUFBTSxJQUFJLGtCQUFrQixFQUFFLENBQUM7SUFDaEMsQ0FBQztJQUVELElBQUksbUJBQW1CLEdBQUcsS0FBSyxDQUFDO0lBQ2hDLElBQUksZ0JBQWdCLEdBQVksU0FBUyxDQUFDO0lBRTFDLE1BQU0sTUFBTSxHQUFHLG1CQUFtQixDQUFZLEtBQUssRUFBRSxFQUFFLENBQUMsRUFBRTtRQUN6RCxNQUFNLEtBQUssR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQ3BDLEtBQUssTUFBTSxDQUFDLElBQUksV0FBVyxFQUFFLENBQUM7WUFDN0IsS0FBSyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxJQUFJLGFBQWEsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDLEdBQUcseUJBQXlCLEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRTtnQkFDckosbUJBQW1CLEdBQUcsSUFBSSxDQUFDO2dCQUMzQixnQkFBZ0IsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNsQyxFQUFFLEVBQUUsQ0FBQztZQUNOLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQ0QsS0FBSyxDQUFDLEdBQUcsQ0FBQztZQUNULE9BQU87Z0JBQ04sbUJBQW1CLEdBQUcsS0FBSyxDQUFDO2dCQUM1QixnQkFBZ0IsR0FBRyxTQUFTLENBQUM7WUFDOUIsQ0FBQztTQUNELENBQUMsQ0FBQztRQUNILE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQyxFQUFFLEdBQUcsRUFBRTtRQUNQLElBQUksbUJBQW1CLEVBQUUsQ0FBQztZQUN6QixPQUFPLGdCQUFnQixDQUFDO1FBQ3pCLENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxXQUFXLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNsRCxDQUFDO0lBQ0YsQ0FBQyxDQUFDLENBQUM7SUFDSCxPQUFPLE1BQU0sQ0FBQztBQUNmLENBQUM7QUFFRDs7OztFQUlFO0FBQ0YsTUFBTSxVQUFVLHVCQUF1QixDQUFJLEtBQWlCLEVBQUUsRUFBMEI7SUFDdkYsT0FBTywwQkFBMEIsQ0FBZ0IsS0FBSyxFQUFFLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQ3pHLENBQUMifQ==