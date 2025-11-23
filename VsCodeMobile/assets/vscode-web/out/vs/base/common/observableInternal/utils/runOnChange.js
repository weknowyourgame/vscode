/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { cancelOnDispose } from '../commonFacade/cancellation.js';
import { DisposableStore } from '../commonFacade/deps.js';
import { autorunWithStoreHandleChanges } from '../reactions/autorun.js';
export function runOnChange(observable, cb) {
    let _previousValue;
    let _firstRun = true;
    return autorunWithStoreHandleChanges({
        changeTracker: {
            createChangeSummary: () => ({ deltas: [], didChange: false }),
            handleChange: (context, changeSummary) => {
                if (context.didChange(observable)) {
                    const e = context.change;
                    if (e !== undefined) {
                        changeSummary.deltas.push(e);
                    }
                    changeSummary.didChange = true;
                }
                return true;
            },
        }
    }, (reader, changeSummary) => {
        const value = observable.read(reader);
        const previousValue = _previousValue;
        if (changeSummary.didChange) {
            _previousValue = value;
            // didChange can never be true on the first autorun, so we know previousValue is defined
            cb(value, previousValue, changeSummary.deltas);
        }
        if (_firstRun) {
            _firstRun = false;
            _previousValue = value;
        }
    });
}
export function runOnChangeWithStore(observable, cb) {
    const store = new DisposableStore();
    const disposable = runOnChange(observable, (value, previousValue, deltas) => {
        store.clear();
        cb(value, previousValue, deltas, store);
    });
    return {
        dispose() {
            disposable.dispose();
            store.dispose();
        }
    };
}
export function runOnChangeWithCancellationToken(observable, cb) {
    return runOnChangeWithStore(observable, (value, previousValue, deltas, store) => {
        cb(value, previousValue, deltas, cancelOnDispose(store));
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVuT25DaGFuZ2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vb2JzZXJ2YWJsZUludGVybmFsL3V0aWxzL3J1bk9uQ2hhbmdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBcUIsZUFBZSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDckYsT0FBTyxFQUFFLGVBQWUsRUFBZSxNQUFNLHlCQUF5QixDQUFDO0FBQ3ZFLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBSXhFLE1BQU0sVUFBVSxXQUFXLENBQWEsVUFBNkMsRUFBRSxFQUE0RTtJQUNsSyxJQUFJLGNBQTZCLENBQUM7SUFDbEMsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDO0lBQ3JCLE9BQU8sNkJBQTZCLENBQUM7UUFDcEMsYUFBYSxFQUFFO1lBQ2QsbUJBQW1CLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxFQUFnQyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsQ0FBQztZQUMzRixZQUFZLEVBQUUsQ0FBQyxPQUFPLEVBQUUsYUFBYSxFQUFFLEVBQUU7Z0JBQ3hDLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO29CQUNuQyxNQUFNLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDO29CQUN6QixJQUFJLENBQUMsS0FBSyxTQUFTLEVBQUUsQ0FBQzt3QkFDckIsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBNkIsQ0FBQyxDQUFDO29CQUMxRCxDQUFDO29CQUNELGFBQWEsQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO2dCQUNoQyxDQUFDO2dCQUNELE9BQU8sSUFBSSxDQUFDO1lBQ2IsQ0FBQztTQUNEO0tBQ0QsRUFBRSxDQUFDLE1BQU0sRUFBRSxhQUFhLEVBQUUsRUFBRTtRQUM1QixNQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3RDLE1BQU0sYUFBYSxHQUFHLGNBQWMsQ0FBQztRQUNyQyxJQUFJLGFBQWEsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUM3QixjQUFjLEdBQUcsS0FBSyxDQUFDO1lBQ3ZCLHdGQUF3RjtZQUN4RixFQUFFLENBQUMsS0FBSyxFQUFFLGFBQWMsRUFBRSxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDakQsQ0FBQztRQUNELElBQUksU0FBUyxFQUFFLENBQUM7WUFDZixTQUFTLEdBQUcsS0FBSyxDQUFDO1lBQ2xCLGNBQWMsR0FBRyxLQUFLLENBQUM7UUFDeEIsQ0FBQztJQUNGLENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVELE1BQU0sVUFBVSxvQkFBb0IsQ0FBYSxVQUE2QyxFQUFFLEVBQW9HO0lBQ25NLE1BQU0sS0FBSyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7SUFDcEMsTUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLFVBQVUsRUFBRSxDQUFDLEtBQUssRUFBRSxhQUFnQixFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQzlFLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNkLEVBQUUsQ0FBQyxLQUFLLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztJQUN6QyxDQUFDLENBQUMsQ0FBQztJQUNILE9BQU87UUFDTixPQUFPO1lBQ04sVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3JCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNqQixDQUFDO0tBQ0QsQ0FBQztBQUNILENBQUM7QUFFRCxNQUFNLFVBQVUsZ0NBQWdDLENBQWEsVUFBNkMsRUFBRSxFQUErRztJQUMxTixPQUFPLG9CQUFvQixDQUFDLFVBQVUsRUFBRSxDQUFDLEtBQUssRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxFQUFFO1FBQy9FLEVBQUUsQ0FBQyxLQUFLLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUMxRCxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMifQ==