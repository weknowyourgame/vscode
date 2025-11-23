/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { derived, ObservablePromise } from '../../../../base/common/observable.js';
import { compare } from '../../../../base/common/strings.js';
import { isObject } from '../../../../base/common/types.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
export function isChatContextPickerPickItem(item) {
    return isObject(item) && typeof item.asAttachment === 'function';
}
/**
 * Helper for use in {@IChatContextPickerItem} that wraps a simple query->promise
 * function into the requisite observable.
 */
export function picksWithPromiseFn(fn) {
    return (query, token) => {
        const promise = derived(reader => {
            const queryValue = query.read(reader);
            const cts = new CancellationTokenSource(token);
            reader.store.add(toDisposable(() => cts.dispose(true)));
            return new ObservablePromise(fn(queryValue, cts.token));
        });
        return promise.map((value, reader) => {
            const result = value.promiseResult.read(reader);
            return { picks: result?.data || [], busy: result === undefined };
        });
    };
}
export const IChatContextPickService = createDecorator('IContextPickService');
export class ChatContextPickService {
    constructor() {
        this._picks = [];
        this.items = this._picks;
    }
    registerChatContextItem(pick) {
        this._picks.push(pick);
        this._picks.sort((a, b) => {
            const valueA = a.ordinal ?? 0;
            const valueB = b.ordinal ?? 0;
            if (valueA === valueB) {
                return compare(a.label, b.label);
            }
            else if (valueA < valueB) {
                return 1;
            }
            else {
                return -1;
            }
        });
        return toDisposable(() => {
            const index = this._picks.indexOf(pick);
            if (index >= 0) {
                this._picks.splice(index, 1);
            }
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdENvbnRleHRQaWNrU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRleHRQaWNrU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUNoRyxPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckcsT0FBTyxFQUFlLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxPQUFPLEVBQWUsaUJBQWlCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFFN0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQWtCN0YsTUFBTSxVQUFVLDJCQUEyQixDQUFDLElBQWE7SUFDeEQsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksT0FBUSxJQUFtQyxDQUFDLFlBQVksS0FBSyxVQUFVLENBQUM7QUFDbEcsQ0FBQztBQTRDRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsRUFBMkU7SUFDN0csT0FBTyxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsRUFBRTtRQUN2QixNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDaEMsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN0QyxNQUFNLEdBQUcsR0FBRyxJQUFJLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQy9DLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN4RCxPQUFPLElBQUksaUJBQWlCLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUN6RCxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUNwQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNoRCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxJQUFJLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDbEUsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUM7QUFDSCxDQUFDO0FBZUQsTUFBTSxDQUFDLE1BQU0sdUJBQXVCLEdBQUcsZUFBZSxDQUEwQixxQkFBcUIsQ0FBQyxDQUFDO0FBRXZHLE1BQU0sT0FBTyxzQkFBc0I7SUFBbkM7UUFJa0IsV0FBTSxHQUE0QixFQUFFLENBQUM7UUFFN0MsVUFBSyxHQUFvQyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBd0IvRCxDQUFDO0lBdEJBLHVCQUF1QixDQUFDLElBQTJCO1FBQ2xELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXZCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3pCLE1BQU0sTUFBTSxHQUFHLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDO1lBQzlCLE1BQU0sTUFBTSxHQUFHLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDO1lBQzlCLElBQUksTUFBTSxLQUFLLE1BQU0sRUFBRSxDQUFDO2dCQUN2QixPQUFPLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNsQyxDQUFDO2lCQUFNLElBQUksTUFBTSxHQUFHLE1BQU0sRUFBRSxDQUFDO2dCQUM1QixPQUFPLENBQUMsQ0FBQztZQUNWLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ1gsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxZQUFZLENBQUMsR0FBRyxFQUFFO1lBQ3hCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3hDLElBQUksS0FBSyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUNoQixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDOUIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztDQUNEIn0=