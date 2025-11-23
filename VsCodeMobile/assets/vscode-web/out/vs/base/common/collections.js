/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var _a;
/**
 * Groups the collection into a dictionary based on the provided
 * group function.
 */
export function groupBy(data, groupFn) {
    const result = Object.create(null);
    for (const element of data) {
        const key = groupFn(element);
        let target = result[key];
        if (!target) {
            target = result[key] = [];
        }
        target.push(element);
    }
    return result;
}
export function groupByMap(data, groupFn) {
    const result = new Map();
    for (const element of data) {
        const key = groupFn(element);
        let target = result.get(key);
        if (!target) {
            target = [];
            result.set(key, target);
        }
        target.push(element);
    }
    return result;
}
export function diffSets(before, after) {
    const removed = [];
    const added = [];
    for (const element of before) {
        if (!after.has(element)) {
            removed.push(element);
        }
    }
    for (const element of after) {
        if (!before.has(element)) {
            added.push(element);
        }
    }
    return { removed, added };
}
export function diffMaps(before, after) {
    const removed = [];
    const added = [];
    for (const [index, value] of before) {
        if (!after.has(index)) {
            removed.push(value);
        }
    }
    for (const [index, value] of after) {
        if (!before.has(index)) {
            added.push(value);
        }
    }
    return { removed, added };
}
/**
 * Computes the intersection of two sets.
 *
 * @param setA - The first set.
 * @param setB - The second iterable.
 * @returns A new set containing the elements that are in both `setA` and `setB`.
 */
export function intersection(setA, setB) {
    const result = new Set();
    for (const elem of setB) {
        if (setA.has(elem)) {
            result.add(elem);
        }
    }
    return result;
}
export class SetWithKey {
    static { _a = Symbol.toStringTag; }
    constructor(values, toKey) {
        this.toKey = toKey;
        this._map = new Map();
        this[_a] = 'SetWithKey';
        for (const value of values) {
            this.add(value);
        }
    }
    get size() {
        return this._map.size;
    }
    add(value) {
        const key = this.toKey(value);
        this._map.set(key, value);
        return this;
    }
    delete(value) {
        return this._map.delete(this.toKey(value));
    }
    has(value) {
        return this._map.has(this.toKey(value));
    }
    *entries() {
        for (const entry of this._map.values()) {
            yield [entry, entry];
        }
    }
    keys() {
        return this.values();
    }
    *values() {
        for (const entry of this._map.values()) {
            yield entry;
        }
    }
    clear() {
        this._map.clear();
    }
    forEach(callbackfn, thisArg) {
        this._map.forEach(entry => callbackfn.call(thisArg, entry, entry, this));
    }
    [Symbol.iterator]() {
        return this.values();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29sbGVjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vY29sbGVjdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7O0FBY2hHOzs7R0FHRztBQUNILE1BQU0sVUFBVSxPQUFPLENBQXdDLElBQWtCLEVBQUUsT0FBMEI7SUFDNUcsTUFBTSxNQUFNLEdBQTRCLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDNUQsS0FBSyxNQUFNLE9BQU8sSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUM1QixNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDN0IsSUFBSSxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3pCLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNiLE1BQU0sR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQzNCLENBQUM7UUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3RCLENBQUM7SUFDRCxPQUFPLE1BQU0sQ0FBQztBQUNmLENBQUM7QUFFRCxNQUFNLFVBQVUsVUFBVSxDQUFPLElBQVMsRUFBRSxPQUEwQjtJQUNyRSxNQUFNLE1BQU0sR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO0lBQ2pDLEtBQUssTUFBTSxPQUFPLElBQUksSUFBSSxFQUFFLENBQUM7UUFDNUIsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzdCLElBQUksTUFBTSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDN0IsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2IsTUFBTSxHQUFHLEVBQUUsQ0FBQztZQUNaLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFF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