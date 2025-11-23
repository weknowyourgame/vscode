/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { subtransaction } from '../transaction.js';
import { strictEquals } from '../commonFacade/deps.js';
import { DebugNameData } from '../debugName.js';
import { getLogger } from '../logging/logging.js';
import { BaseObservable } from './baseObservable.js';
import { DebugLocation } from '../debugLocation.js';
export function observableFromEvent(...args) {
    let owner;
    let event;
    let getValue;
    let debugLocation;
    if (args.length === 2) {
        [event, getValue] = args;
    }
    else {
        [owner, event, getValue, debugLocation] = args;
    }
    return new FromEventObservable(new DebugNameData(owner, undefined, getValue), event, getValue, () => FromEventObservable.globalTransaction, strictEquals, debugLocation ?? DebugLocation.ofCaller());
}
export function observableFromEventOpts(options, event, getValue, debugLocation = DebugLocation.ofCaller()) {
    return new FromEventObservable(new DebugNameData(options.owner, options.debugName, options.debugReferenceFn ?? getValue), event, getValue, () => FromEventObservable.globalTransaction, options.equalsFn ?? strictEquals, debugLocation);
}
export class FromEventObservable extends BaseObservable {
    constructor(_debugNameData, event, _getValue, _getTransaction, _equalityComparator, debugLocation) {
        super(debugLocation);
        this._debugNameData = _debugNameData;
        this.event = event;
        this._getValue = _getValue;
        this._getTransaction = _getTransaction;
        this._equalityComparator = _equalityComparator;
        this._hasValue = false;
        this.handleEvent = (args) => {
            const newValue = this._getValue(args);
            const oldValue = this._value;
            const didChange = !this._hasValue || !(this._equalityComparator(oldValue, newValue));
            let didRunTransaction = false;
            if (didChange) {
                this._value = newValue;
                if (this._hasValue) {
                    didRunTransaction = true;
                    subtransaction(this._getTransaction(), (tx) => {
                        getLogger()?.handleObservableUpdated(this, { oldValue, newValue, change: undefined, didChange, hadValue: this._hasValue });
                        for (const o of this._observers) {
                            tx.updateObserver(o, this);
                            o.handleChange(this, undefined);
                        }
                    }, () => {
                        const name = this.getDebugName();
                        return 'Event fired' + (name ? `: ${name}` : '');
                    });
                }
                this._hasValue = true;
            }
            if (!didRunTransaction) {
                getLogger()?.handleObservableUpdated(this, { oldValue, newValue, change: undefined, didChange, hadValue: this._hasValue });
            }
        };
    }
    getDebugName() {
        return this._debugNameData.getDebugName(this);
    }
    get debugName() {
        const name = this.getDebugName();
        return 'From Event' + (name ? `: ${name}` : '');
    }
    onFirstObserverAdded() {
        this._subscription = this.event(this.handleEvent);
    }
    onLastObserverRemoved() {
        this._subscription.dispose();
        this._subscription = undefined;
        this._hasValue = false;
        this._value = undefined;
    }
    get() {
        if (this._subscription) {
            if (!this._hasValue) {
                this.handleEvent(undefined);
            }
            return this._value;
        }
        else {
            // no cache, as there are no subscribers to keep it updated
            const value = this._getValue(undefined);
            return value;
        }
    }
    debugSetValue(value) {
        // eslint-disable-next-line local/code-no-any-casts
        this._value = value;
    }
    debugGetState() {
        return { value: this._value, hasValue: this._hasValue };
    }
}
(function (observableFromEvent) {
    observableFromEvent.Observer = FromEventObservable;
    function batchEventsGlobally(tx, fn) {
        let didSet = false;
        if (FromEventObservable.globalTransaction === undefined) {
            FromEventObservable.globalTransaction = tx;
            didSet = true;
        }
        try {
            fn();
        }
        finally {
            if (didSet) {
                FromEventObservable.globalTransaction = undefined;
            }
        }
    }
    observableFromEvent.batchEventsGlobally = batchEventsGlobally;
})(observableFromEvent || (observableFromEvent = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JzZXJ2YWJsZUZyb21FdmVudC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvb2JzZXJ2YWJsZXMvb2JzZXJ2YWJsZUZyb21FdmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDbkQsT0FBTyxFQUF3QyxZQUFZLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUM3RixPQUFPLEVBQWMsYUFBYSxFQUFrQixNQUFNLGlCQUFpQixDQUFDO0FBQzVFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNsRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDckQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBYXBELE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxHQUFHLElBRXVCO0lBRTdELElBQUksS0FBSyxDQUFDO0lBQ1YsSUFBSSxLQUFLLENBQUM7SUFDVixJQUFJLFFBQVEsQ0FBQztJQUNiLElBQUksYUFBYSxDQUFDO0lBQ2xCLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUN2QixDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsR0FBRyxJQUFJLENBQUM7SUFDMUIsQ0FBQztTQUFNLENBQUM7UUFDUCxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLGFBQWEsQ0FBQyxHQUFHLElBQUksQ0FBQztJQUNoRCxDQUFDO0lBQ0QsT0FBTyxJQUFJLG1CQUFtQixDQUM3QixJQUFJLGFBQWEsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLFFBQVEsQ0FBQyxFQUM3QyxLQUFLLEVBQ0wsUUFBUSxFQUNSLEdBQUcsRUFBRSxDQUFDLG1CQUFt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