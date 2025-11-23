/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { AsyncIterableProducer } from '../../../../../base/common/async.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { observableValue, runOnChange, transaction } from '../../../../../base/common/observable.js';
export function sumByCategory(items, getValue, getCategory) {
    return items.reduce((acc, item) => {
        const category = getCategory(item);
        acc[category] = (acc[category] || 0) + getValue(item);
        return acc;
        // eslint-disable-next-line local/code-no-any-casts
    }, {});
}
export function mapObservableDelta(obs, mapFn, store) {
    const obsResult = observableValue('mapped', obs.get());
    store.add(runOnChange(obs, (value, _prevValue, changes) => {
        transaction(tx => {
            for (const c of changes) {
                obsResult.set(value, tx, mapFn(c));
            }
        });
    }));
    return obsResult;
}
export function iterateObservableChanges(obs, store) {
    return new AsyncIterableProducer((e) => {
        if (store.isDisposed) {
            return;
        }
        store.add(runOnChange(obs, (value, prevValue, change) => {
            e.emitOne({ value, prevValue, change: change });
        }));
        return new Promise((res) => {
            store.add(toDisposable(() => {
                res(undefined);
            }));
        });
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZWRpdFRlbGVtZXRyeS9icm93c2VyL2hlbHBlcnMvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDNUUsT0FBTyxFQUFtQixZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN4RixPQUFPLEVBQXlCLGVBQWUsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFtQixNQUFNLDBDQUEwQyxDQUFDO0FBRTdJLE1BQU0sVUFBVSxhQUFhLENBQThCLEtBQW1CLEVBQUUsUUFBNkIsRUFBRSxXQUFtQztJQUNqSixPQUFPLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUU7UUFDakMsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ25DLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsT0FBTyxHQUFHLENBQUM7UUFDWCxtREFBbUQ7SUFDcEQsQ0FBQyxFQUFFLEVBQXNDLENBQUMsQ0FBQztBQUM1QyxDQUFDO0FBRUQsTUFBTSxVQUFVLGtCQUFrQixDQUF1QixHQUFxQyxFQUFFLEtBQW1DLEVBQUUsS0FBc0I7SUFDMUosTUFBTSxTQUFTLEdBQUcsZUFBZSxDQUFlLFFBQVEsRUFBRSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUNyRSxLQUFLLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxFQUFFO1FBQ3pELFdBQVcsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUNoQixLQUFLLE1BQU0sQ0FBQyxJQUFJLE9BQU8sRUFBRSxDQUFDO2dCQUN6QixTQUFTLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDcEMsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNKLE9BQU8sU0FBUyxDQUFDO0FBQ2xCLENBQUM7QUFFRCxNQUFNLFVBQVUsd0JBQXdCLENBQWEsR0FBc0MsRUFBRSxLQUFzQjtJQUNsSCxPQUFPLElBQUkscUJBQXFCLENBQWlFLENBQUMsQ0FBQyxFQUFFLEVBQUU7UUFDdEcsSUFBSSxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDdEIsT0FBTztRQUNSLENBQUM7UUFDRCxLQUFLLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3ZELENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ2pELENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDMUIsS0FBSyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFO2dCQUMzQixHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDaEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDIn0=