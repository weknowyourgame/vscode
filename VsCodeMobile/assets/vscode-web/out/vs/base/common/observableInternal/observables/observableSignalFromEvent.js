/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { transaction } from '../transaction.js';
import { DebugNameData } from '../debugName.js';
import { BaseObservable } from './baseObservable.js';
import { DebugLocation } from '../debugLocation.js';
export function observableSignalFromEvent(owner, event, debugLocation = DebugLocation.ofCaller()) {
    return new FromEventObservableSignal(typeof owner === 'string' ? owner : new DebugNameData(owner, undefined, undefined), event, debugLocation);
}
class FromEventObservableSignal extends BaseObservable {
    constructor(debugNameDataOrName, event, debugLocation) {
        super(debugLocation);
        this.event = event;
        this.handleEvent = () => {
            transaction((tx) => {
                for (const o of this._observers) {
                    tx.updateObserver(o, this);
                    o.handleChange(this, undefined);
                }
            }, () => this.debugName);
        };
        this.debugName = typeof debugNameDataOrName === 'string'
            ? debugNameDataOrName
            : debugNameDataOrName.getDebugName(this) ?? 'Observable Signal From Event';
    }
    onFirstObserverAdded() {
        this.subscription = this.event(this.handleEvent);
    }
    onLastObserverRemoved() {
        this.subscription.dispose();
        this.subscription = undefined;
    }
    get() {
        // NO OP
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JzZXJ2YWJsZVNpZ25hbEZyb21FdmVudC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvb2JzZXJ2YWJsZXMvb2JzZXJ2YWJsZVNpZ25hbEZyb21FdmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFFaEQsT0FBTyxFQUFjLGFBQWEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzVELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFFcEQsTUFBTSxVQUFVLHlCQUF5QixDQUN4QyxLQUEwQixFQUMxQixLQUFpQixFQUNqQixhQUFhLEdBQUcsYUFBYSxDQUFDLFFBQVEsRUFBRTtJQUV4QyxPQUFPLElBQUkseUJBQXlCLENBQUMsT0FBTyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksYUFBYSxDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDLEVBQUUsS0FBSyxFQUFFLGFBQWEsQ0FBQyxDQUFDO0FBQ2hKLENBQUM7QUFFRCxNQUFNLHlCQUEwQixTQUFRLGNBQW9CO0lBSTNELFlBQ0MsbUJBQTJDLEVBQzFCLEtBQWlCLEVBQ2xDLGFBQTRCO1FBRTVCLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUhKLFVBQUssR0FBTCxLQUFLLENBQVk7UUFhbEIsZ0JBQVcsR0FBRyxHQUFHLEVBQUU7WUFDbkMsV0FBVyxDQUNWLENBQUMsRUFBRSxFQUFFLEVBQUU7Z0JBQ04sS0FBSyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7b0JBQ2pDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO29CQUMzQixDQUFDLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztnQkFDakMsQ0FBQztZQUNGLENBQUMsRUFDRCxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUNwQixDQUFDO1FBQ0gsQ0FBQyxDQUFDO1FBbkJELElBQUksQ0FBQyxTQUFTLEdBQUcsT0FBTyxtQkFBbUIsS0FBSyxRQUFRO1lBQ3ZELENBQUMsQ0FBQyxtQkFBbUI7WUFDckIsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSw4QkFBOEIsQ0FBQztJQUM3RSxDQUFDO0lBRWtCLG9CQUFvQjtRQUN0QyxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFja0IscUJBQXFCO1FBQ3ZDLElBQUksQ0FBQyxZQUFhLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDN0IsSUFBSSxDQUFDLFlBQVksR0FBRyxTQUFTLENBQUM7SUFDL0IsQ0FBQztJQUVlLEdBQUc7UUFDbEIsUUFBUTtJQUNULENBQUM7Q0FDRCJ9