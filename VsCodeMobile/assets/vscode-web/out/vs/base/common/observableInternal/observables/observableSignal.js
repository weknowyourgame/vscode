/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { transaction } from '../transaction.js';
import { DebugNameData } from '../debugName.js';
import { BaseObservable } from './baseObservable.js';
import { DebugLocation } from '../debugLocation.js';
export function observableSignal(debugNameOrOwner, debugLocation = DebugLocation.ofCaller()) {
    if (typeof debugNameOrOwner === 'string') {
        return new ObservableSignal(debugNameOrOwner, undefined, debugLocation);
    }
    else {
        return new ObservableSignal(undefined, debugNameOrOwner, debugLocation);
    }
}
class ObservableSignal extends BaseObservable {
    get debugName() {
        return new DebugNameData(this._owner, this._debugName, undefined).getDebugName(this) ?? 'Observable Signal';
    }
    toString() {
        return this.debugName;
    }
    constructor(_debugName, _owner, debugLocation) {
        super(debugLocation);
        this._debugName = _debugName;
        this._owner = _owner;
    }
    trigger(tx, change) {
        if (!tx) {
            transaction(tx => {
                this.trigger(tx, change);
            }, () => `Trigger signal ${this.debugName}`);
            return;
        }
        for (const o of this._observers) {
            tx.updateObserver(o, this);
            o.handleChange(this, change);
        }
    }
    get() {
        // NO OP
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JzZXJ2YWJsZVNpZ25hbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvb2JzZXJ2YWJsZXMvb2JzZXJ2YWJsZVNpZ25hbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDaEQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ2hELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFTcEQsTUFBTSxVQUFVLGdCQUFnQixDQUFnQixnQkFBaUMsRUFBRSxhQUFhLEdBQUcsYUFBYSxDQUFDLFFBQVEsRUFBRTtJQUMxSCxJQUFJLE9BQU8sZ0JBQWdCLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDMUMsT0FBTyxJQUFJLGdCQUFnQixDQUFTLGdCQUFnQixFQUFFLFNBQVMsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUNqRixDQUFDO1NBQU0sQ0FBQztRQUNQLE9BQU8sSUFBSSxnQkFBZ0IsQ0FBUyxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDakYsQ0FBQztBQUNGLENBQUM7QUFNRCxNQUFNLGdCQUEwQixTQUFRLGNBQTZCO0lBQ3BFLElBQVcsU0FBUztRQUNuQixPQUFPLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksbUJBQW1CLENBQUM7SUFDN0csQ0FBQztJQUVlLFFBQVE7UUFDdkIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxZQUNrQixVQUE4QixFQUM5QixNQUEwQixFQUMzQyxhQUE0QjtRQUU1QixLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7UUFKSixlQUFVLEdBQVYsVUFBVSxDQUFvQjtRQUM5QixXQUFNLEdBQU4sTUFBTSxDQUFvQjtJQUk1QyxDQUFDO0lBRU0sT0FBTyxDQUFDLEVBQTRCLEVBQUUsTUFBZTtRQUMzRCxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDVCxXQUFXLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQ2hCLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzFCLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxrQkFBa0IsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFDN0MsT0FBTztRQUNSLENBQUM7UUFFRCxLQUFLLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNqQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUMzQixDQUFDLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUM5QixDQUFDO0lBQ0YsQ0FBQztJQUVlLEdBQUc7UUFDbEIsUUFBUTtJQUNULENBQUM7Q0FDRCJ9