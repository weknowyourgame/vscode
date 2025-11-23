/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { TransactionImpl } from '../transaction.js';
import { BaseObservable } from './baseObservable.js';
import { strictEquals } from '../commonFacade/deps.js';
import { DebugNameData } from '../debugName.js';
import { getLogger } from '../logging/logging.js';
import { DebugLocation } from '../debugLocation.js';
export function observableValue(nameOrOwner, initialValue, debugLocation = DebugLocation.ofCaller()) {
    let debugNameData;
    if (typeof nameOrOwner === 'string') {
        debugNameData = new DebugNameData(undefined, nameOrOwner, undefined);
    }
    else {
        debugNameData = new DebugNameData(nameOrOwner, undefined, undefined);
    }
    return new ObservableValue(debugNameData, initialValue, strictEquals, debugLocation);
}
export class ObservableValue extends BaseObservable {
    get debugName() {
        return this._debugNameData.getDebugName(this) ?? 'ObservableValue';
    }
    constructor(_debugNameData, initialValue, _equalityComparator, debugLocation) {
        super(debugLocation);
        this._debugNameData = _debugNameData;
        this._equalityComparator = _equalityComparator;
        this._value = initialValue;
        getLogger()?.handleObservableUpdated(this, { hadValue: false, newValue: initialValue, change: undefined, didChange: true, oldValue: undefined });
    }
    get() {
        return this._value;
    }
    set(value, tx, change) {
        if (change === undefined && this._equalityComparator(this._value, value)) {
            return;
        }
        let _tx;
        if (!tx) {
            tx = _tx = new TransactionImpl(() => { }, () => `Setting ${this.debugName}`);
        }
        try {
            const oldValue = this._value;
            this._setValue(value);
            getLogger()?.handleObservableUpdated(this, { oldValue, newValue: value, change, didChange: true, hadValue: true });
            for (const observer of this._observers) {
                tx.updateObserver(observer, this);
                observer.handleChange(this, change);
            }
        }
        finally {
            if (_tx) {
                _tx.finish();
            }
        }
    }
    toString() {
        return `${this.debugName}: ${this._value}`;
    }
    _setValue(newValue) {
        this._value = newValue;
    }
    debugGetState() {
        return {
            value: this._value,
        };
    }
    debugSetValue(value) {
        this._value = value;
    }
}
/**
 * A disposable observable. When disposed, its value is also disposed.
 * When a new value is set, the previous value is disposed.
 */
export function disposableObservableValue(nameOrOwner, initialValue, debugLocation = DebugLocation.ofCaller()) {
    let debugNameData;
    if (typeof nameOrOwner === 'string') {
        debugNameData = new DebugNameData(undefined, nameOrOwner, undefined);
    }
    else {
        debugNameData = new DebugNameData(nameOrOwner, undefined, undefined);
    }
    return new DisposableObservableValue(debugNameData, initialValue, strictEquals, debugLocation);
}
export class DisposableObservableValue extends ObservableValue {
    _setValue(newValue) {
        if (this._value === newValue) {
            return;
        }
        if (this._value) {
            this._value.dispose();
        }
        this._value = newValue;
    }
    dispose() {
        this._value?.dispose();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JzZXJ2YWJsZVZhbHVlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvY29tbW9uL29ic2VydmFibGVJbnRlcm5hbC9vYnNlcnZhYmxlcy9vYnNlcnZhYmxlVmFsdWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ3BELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNyRCxPQUFPLEVBQWlDLFlBQVksRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ3RGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUNoRCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDbEQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBV3BELE1BQU0sVUFBVSxlQUFlLENBQW9CLFdBQTRCLEVBQUUsWUFBZSxFQUFFLGFBQWEsR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFO0lBQ3pJLElBQUksYUFBNEIsQ0FBQztJQUNqQyxJQUFJLE9BQU8sV0FBVyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQ3JDLGFBQWEsR0FBRyxJQUFJLGFBQWEsQ0FBQyxTQUFTLEVBQUUsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3RFLENBQUM7U0FBTSxDQUFDO1FBQ1AsYUFBYSxHQUFHLElBQUksYUFBYSxDQUFDLFdBQVcsRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDdEUsQ0FBQztJQUNELE9BQU8sSUFBSSxlQUFlLENBQUMsYUFBYSxFQUFFLFlBQVksRUFBRSxZQUFZLEVBQUUsYUFBYSxDQUFDLENBQUM7QUFDdEYsQ0FBQztBQUVELE1BQU0sT0FBTyxlQUNaLFNBQVEsY0FBMEI7SUFJbEMsSUFBSSxTQUFTO1FBQ1osT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxpQkFBaUIsQ0FBQztJQUNwRSxDQUFDO0lBRUQsWUFDa0IsY0FBNkIsRUFDOUMsWUFBZSxFQUNFLG1CQUF3QyxFQUN6RCxhQUE0QjtRQUU1QixLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7UUFMSixtQkFBYyxHQUFkLGNBQWMsQ0FBZTtRQUU3Qix3QkFBbUIsR0FBbkIsbUJBQW1CLENBQXFCO1FBSXpELElBQUksQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDO1FBRTNCLFNBQVMsRUFBRSxFQUFFLHVCQUF1QixDQUFDLElBQUksRUFBRSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7SUFDbEosQ0FBQztJQUNlLEdBQUc7UUFDbEIsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3BCLENBQUM7SUFFTSxHQUFHLENBQUMsS0FBUSxFQUFFLEVBQTRCLEVBQUUsTUFBZTtRQUNqRSxJQUFJLE1BQU0sS0FBSyxTQUFTLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUMxRSxPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksR0FBZ0MsQ0FBQztRQUNyQyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDVCxFQUFFLEdBQUcsR0FBRyxHQUFHLElBQUksZUFBZSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxXQUFXLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBQzlFLENBQUM7UUFDRCxJQUFJLENBQUM7WUFDSixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQzdCLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDdEIsU0FBUyxFQUFFLEVBQUUsdUJBQXVCLENBQUMsSUFBSSxFQUFFLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7WUFFbkgsS0FBSyxNQUFNLFFBQVEsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQ3hDLEVBQUUsQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNsQyxRQUFRLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztZQUNyQyxDQUFDO1FBQ0YsQ0FBQztnQkFBUyxDQUFDO1lBQ1YsSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDVCxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDZCxDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFUSxRQUFRO1FBQ2hCLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxLQUFLLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUM1QyxDQUFDO0lBRVMsU0FBUyxDQUFDLFFBQVc7UUFDOUIsSUFBSSxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUM7SUFDeEIsQ0FBQztJQUVNLGFBQWE7UUFDbkIsT0FBTztZQUNOLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTTtTQUNsQixDQUFDO0lBQ0gsQ0FBQztJQUVNLGFBQWEsQ0FBQyxLQUFjO1FBQ2xDLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBVSxDQUFDO0lBQzFCLENBQUM7Q0FDRDtBQUNEOzs7R0FHRztBQUVILE1BQU0sVUFBVSx5QkFBeUIsQ0FBb0QsV0FBNEIsRUFBRSxZQUFlLEVBQUUsYUFBYSxHQUFHLGFBQWEsQ0FBQyxRQUFRLEVBQUU7SUFDbkwsSUFBSSxhQUE0QixDQUFDO0lBQ2pDLElBQUksT0FBTyxXQUFXLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDckMsYUFBYSxHQUFHLElBQUksYUFBYSxDQUFDLFNBQVMsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDdEUsQ0FBQztTQUFNLENBQUM7UUFDUCxhQUFhLEdBQUcsSUFBSSxhQUFhLENBQUMsV0FBVyxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBQ0QsT0FBTyxJQUFJLHlCQUF5QixDQUFDLGFBQWEsRUFBRSxZQUFZLEVBQUUsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0FBQ2hHLENBQUM7QUFFRCxNQUFNLE9BQU8seUJBQTZFLFNBQVEsZUFBMkI7SUFDekcsU0FBUyxDQUFDLFFBQVc7UUFDdkMsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzlCLE9BQU87UUFDUixDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN2QixDQUFDO1FBQ0QsSUFBSSxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUM7SUFDeEIsQ0FBQztJQUVNLE9BQU87UUFDYixJQUFJLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxDQUFDO0lBQ3hCLENBQUM7Q0FDRCJ9