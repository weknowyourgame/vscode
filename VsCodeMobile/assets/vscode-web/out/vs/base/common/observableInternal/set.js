/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { observableValueOpts } from './observables/observableValueOpts.js';
export class ObservableSet {
    constructor() {
        this._data = new Set();
        this._obs = observableValueOpts({ equalsFn: () => false }, this);
        this.observable = this._obs;
    }
    get size() {
        return this._data.size;
    }
    has(value) {
        return this._data.has(value);
    }
    add(value, tx) {
        const hadValue = this._data.has(value);
        if (!hadValue) {
            this._data.add(value);
            this._obs.set(this, tx);
        }
        return this;
    }
    delete(value, tx) {
        const result = this._data.delete(value);
        if (result) {
            this._obs.set(this, tx);
        }
        return result;
    }
    clear(tx) {
        if (this._data.size > 0) {
            this._data.clear();
            this._obs.set(this, tx);
        }
    }
    forEach(callbackfn, thisArg) {
        this._data.forEach((value, value2, _set) => {
            // eslint-disable-next-line local/code-no-any-casts
            callbackfn.call(thisArg, value, value2, this);
        });
    }
    *entries() {
        for (const value of this._data) {
            yield [value, value];
        }
    }
    *keys() {
        yield* this._data.keys();
    }
    *values() {
        yield* this._data.values();
    }
    [Symbol.iterator]() {
        return this.values();
    }
    get [Symbol.toStringTag]() {
        return 'ObservableSet';
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvY29tbW9uL29ic2VydmFibGVJbnRlcm5hbC9zZXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFM0UsTUFBTSxPQUFPLGFBQWE7SUFBMUI7UUFFa0IsVUFBSyxHQUFHLElBQUksR0FBRyxFQUFLLENBQUM7UUFFOUIsU0FBSSxHQUFHLG1CQUFtQixDQUFDLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRTNELGVBQVUsR0FBd0IsSUFBSSxDQUFDLElBQUksQ0FBQztJQThEdEQsQ0FBQztJQTVEQSxJQUFJLElBQUk7UUFDUCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO0lBQ3hCLENBQUM7SUFFRCxHQUFHLENBQUMsS0FBUTtRQUNYLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVELEdBQUcsQ0FBQyxLQUFRLEVBQUUsRUFBaUI7UUFDOUIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2YsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3pCLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxNQUFNLENBQUMsS0FBUSxFQUFFLEVBQWlCO1FBQ2pDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3hDLElBQUksTUFBTSxFQUFFLENBQUM7WUFDWixJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDekIsQ0FBQztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQUVELEtBQUssQ0FBQyxFQUFpQjtRQUN0QixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3pCLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDbkIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3pCLENBQUM7SUFDRixDQUFDO0lBRUQsT0FBTyxDQUFDLFVBQXNELEVBQUUsT0FBYTtRQUM1RSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEVBQUU7WUFDMUMsbURBQW1EO1lBQ25ELFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsSUFBVyxDQUFDLENBQUM7UUFDdEQsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsQ0FBQyxPQUFPO1FBQ1AsS0FBSyxNQUFNLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDaEMsTUFBTSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN0QixDQUFDO0lBQ0YsQ0FBQztJQUVELENBQUMsSUFBSTtRQUNKLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDMUIsQ0FBQztJQUVELENBQUMsTUFBTTtRQUNOLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDNUIsQ0FBQztJQUVELENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQztRQUNoQixPQUFPLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUN0QixDQUFDO0lBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUM7UUFDdkIsT0FBTyxlQUFlLENBQUM7SUFDeEIsQ0FBQztDQUNEIn0=