/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { LRUCache } from './map.js';
const nfcCache = new LRUCache(10000); // bounded to 10000 elements
export function normalizeNFC(str) {
    return normalize(str, 'NFC', nfcCache);
}
const nfdCache = new LRUCache(10000); // bounded to 10000 elements
export function normalizeNFD(str) {
    return normalize(str, 'NFD', nfdCache);
}
const nonAsciiCharactersPattern = /[^\u0000-\u0080]/;
function normalize(str, form, normalizedCache) {
    if (!str) {
        return str;
    }
    const cached = normalizedCache.get(str);
    if (cached) {
        return cached;
    }
    let res;
    if (nonAsciiCharactersPattern.test(str)) {
        res = str.normalize(form);
    }
    else {
        res = str;
    }
    // Use the cache for fast lookup
    normalizedCache.set(str, res);
    return res;
}
/**
 * Attempts to normalize the string to Unicode base format (NFD -> remove accents -> lower case).
 * When original string contains accent characters directly, only lower casing will be performed.
 * This is done so as to keep the string length the same and not affect indices.
 *
 * @see https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript/37511463#37511463
 */
export const tryNormalizeToBase = function () {
    const cache = new LRUCache(10000); // bounded to 10000 elements
    const accentsRegex = /[\u0300-\u036f]/g;
    return function (str) {
        const cached = cache.get(str);
        if (cached) {
            return cached;
        }
        const noAccents = normalizeNFD(str).replace(accentsRegex, '');
        const result = (noAccents.length === str.length ? noAccents : str).toLowerCase();
        cache.set(str, result);
        return result;
    };
}();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsaXphdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi9ub3JtYWxpemF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFFcEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxRQUFRLENBQWlCLEtBQUssQ0FBQyxDQUFDLENBQUMsNEJBQTRCO0FBQ2xGLE1BQU0sVUFBVSxZQUFZLENBQUMsR0FBVztJQUN2QyxPQUFPLFNBQVMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ3hDLENBQUM7QUFFRCxNQUFNLFFBQVEsR0FBRyxJQUFJLFFBQVEsQ0FBaUIsS0FBSyxDQUFDLENBQUMsQ0FBQyw0QkFBNEI7QUFDbEYsTUFBTSxVQUFVLFlBQVksQ0FBQyxHQUFXO0lBQ3ZDLE9BQU8sU0FBUyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDeEMsQ0FBQztBQUVELE1BQU0seUJBQXlCLEdBQUcsa0JBQWtCLENBQUM7QUFDckQsU0FBUyxTQUFTLENBQUMsR0FBVyxFQUFFLElBQVksRUFBRSxlQUF5QztJQUN0RixJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDVixPQUFPLEdBQUcsQ0FBQztJQUNaLENBQUM7SUFFRCxNQUFNLE1BQU0sR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3hDLElBQUksTUFBTSxFQUFFLENBQUM7UUFDWixPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFFRCxJQUFJLEdBQVcsQ0FBQztJQUNoQixJQUFJLHlCQUF5QixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQ3pDLEdBQUcsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzNCLENBQUM7U0FBTSxDQUFDO1FBQ1AsR0FBRyxHQUFHLEdBQUcsQ0FBQztJQUNYLENBQUM7SUFFRCxnQ0FBZ0M7SUFDaEMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFFOUIsT0FBTyxHQUFHLENBQUM7QUFDWixDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQTRCO0lBQzFELE1BQU0sS0FBSyxHQUFHLElBQUksUUFBUSxDQUFpQixLQUFLLENBQUMsQ0FBQyxDQUFDLDRCQUE0QjtJQUMvRSxNQUFNLFlBQVksR0FBRyxrQkFBa0IsQ0FBQztJQUN4QyxPQUFPLFVBQVUsR0FBVztRQUMzQixNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzlCLElBQUksTUFBTSxFQUFFLENBQUM7WUFDWixPQUFPLE1BQU0sQ0FBQztRQUNmLENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQztRQUM5RCxNQUFNLE1BQU0sR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEtBQUssR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNqRixLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN2QixPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUMsQ0FBQztBQUNILENBQUMsRUFBRSxDQUFDIn0=