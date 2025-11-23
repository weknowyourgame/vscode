/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { URI } from '../../../../base/common/uri.js';
/**
 * Normalizes a URL by removing trailing slashes and query/fragment components.
 * @param url The URL to normalize.
 * @returns URI - The normalized URI object.
 */
function normalizeURL(url) {
    const uri = typeof url === 'string' ? URI.parse(url) : url;
    return uri.with({
        // Remove trailing slashes
        path: uri.path.replace(/\/+$/, ''),
        // Remove query and fragment
        query: null,
        fragment: null,
    });
}
/**
 * Checks if a given URL matches a glob URL pattern.
 * The glob URL pattern can contain wildcards (*) and subdomain matching (*.)
 * @param uri The URL to check.
 * @param globUrl The glob URL pattern to match against.
 * @returns boolean - True if the URL matches the glob URL pattern, false otherwise.
 */
export function testUrlMatchesGlob(uri, globUrl) {
    const normalizedUrl = normalizeURL(uri);
    let normalizedGlobUrl;
    const globHasScheme = /^[^./:]*:\/\//.test(globUrl);
    // if the glob does not have a scheme we assume the scheme is http or https
    // so if the url doesn't have a scheme of http or https we return false
    if (!globHasScheme) {
        if (normalizedUrl.scheme !== 'http' && normalizedUrl.scheme !== 'https') {
            return false;
        }
        normalizedGlobUrl = normalizeURL(`${normalizedUrl.scheme}://${globUrl}`);
    }
    else {
        normalizedGlobUrl = normalizeURL(globUrl);
    }
    return (doMemoUrlMatch(normalizedUrl.scheme, normalizedGlobUrl.scheme) &&
        // The authority is the only thing that should do port logic.
        doMemoUrlMatch(normalizedUrl.authority, normalizedGlobUrl.authority, true) &&
        (
        //
        normalizedGlobUrl.path === '/' ||
            doMemoUrlMatch(normalizedUrl.path, normalizedGlobUrl.path)));
}
/**
 * @param normalizedUrlPart The normalized URL part to match.
 * @param normalizedGlobUrlPart The normalized glob URL part to match against.
 * @param includePortLogic Whether to include port logic in the matching process.
 * @returns boolean - True if the URL part matches the glob URL part, false otherwise.
 */
function doMemoUrlMatch(normalizedUrlPart, normalizedGlobUrlPart, includePortLogic = false) {
    const memo = Array.from({ length: normalizedUrlPart.length + 1 }).map(() => Array.from({ length: normalizedGlobUrlPart.length + 1 }).map(() => undefined));
    return doUrlPartMatch(memo, includePortLogic, normalizedUrlPart, normalizedGlobUrlPart, 0, 0);
}
/**
 * Recursively checks if a URL part matches a glob URL part.
 * This function uses memoization to avoid recomputing results for the same inputs.
 * It handles various cases such as exact matches, wildcard matches, and port logic.
 * @param memo A memoization table to avoid recomputing results for the same inputs.
 * @param includePortLogic Whether to include port logic in the matching process.
 * @param urlPart The URL part to match with.
 * @param globUrlPart The glob URL part to match against.
 * @param urlOffset The current offset in the URL part.
 * @param globUrlOffset The current offset in the glob URL part.
 * @returns boolean - True if the URL part matches the glob URL part, false otherwise.
 */
function doUrlPartMatch(memo, includePortLogic, urlPart, globUrlPart, urlOffset, globUrlOffset) {
    if (memo[urlOffset]?.[globUrlOffset] !== undefined) {
        return memo[urlOffset][globUrlOffset];
    }
    const options = [];
    // We've reached the end of the url.
    if (urlOffset === urlPart.length) {
        // We're also at the end of the glob url as well so we have an exact match.
        if (globUrlOffset === globUrlPart.length) {
            return true;
        }
        if (includePortLogic && globUrlPart[globUrlOffset] + globUrlPart[globUrlOffset + 1] === ':*') {
            // any port match. Consume a port if it exists otherwise nothing. Always consume the base.
            return globUrlOffset + 2 === globUrlPart.length;
        }
        return false;
    }
    // Some path remaining in url
    if (globUrlOffset === globUrlPart.length) {
        const remaining = urlPart.slice(urlOffset);
        return remaining[0] === '/';
    }
    if (urlPart[urlOffset] === globUrlPart[globUrlOffset]) {
        // Exact match.
        options.push(doUrlPartMatch(memo, includePortLogic, urlPart, globUrlPart, urlOffset + 1, globUrlOffset + 1));
    }
    if (globUrlPart[globUrlOffset] + globUrlPart[globUrlOffset + 1] === '*.') {
        // Any subdomain match. Either consume one thing that's not a / or : and don't advance base or consume nothing and do.
        if (!['/', ':'].includes(urlPart[urlOffset])) {
            options.push(doUrlPartMatch(memo, includePortLogic, urlPart, globUrlPart, urlOffset + 1, globUrlOffset));
        }
        options.push(doUrlPartMatch(memo, includePortLogic, urlPart, globUrlPart, urlOffset, globUrlOffset + 2));
    }
    if (globUrlPart[globUrlOffset] === '*') {
        // Any match. Either consume one thing and don't advance base or consume nothing and do.
        if (urlOffset + 1 === urlPart.length) {
            // If we're at the end of the input url consume one from both.
            options.push(doUrlPartMatch(memo, includePortLogic, urlPart, globUrlPart, urlOffset + 1, globUrlOffset + 1));
        }
        else {
            options.push(doUrlPartMatch(memo, includePortLogic, urlPart, globUrlPart, urlOffset + 1, globUrlOffset));
        }
        options.push(doUrlPartMatch(memo, includePortLogic, urlPart, globUrlPart, urlOffset, globUrlOffset + 1));
    }
    if (includePortLogic && globUrlPart[globUrlOffset] + globUrlPart[globUrlOffset + 1] === ':*') {
        // any port match. Consume a port if it exists otherwise nothing. Always consume the base.
        if (urlPart[urlOffset] === ':') {
            let endPortIndex = urlOffset + 1;
            do {
                endPortIndex++;
            } while (/[0-9]/.test(urlPart[endPortIndex]));
            options.push(doUrlPartMatch(memo, includePortLogic, urlPart, globUrlPart, endPortIndex, globUrlOffset + 2));
        }
        else {
            options.push(doUrlPartMatch(memo, includePortLogic, urlPart, globUrlPart, urlOffset, globUrlOffset + 2));
        }
    }
    return (memo[urlOffset][globUrlOffset] = options.some(a => a === true));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXJsR2xvYi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi91cmwvY29tbW9uL3VybEdsb2IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRXJEOzs7O0dBSUc7QUFDSCxTQUFTLFlBQVksQ0FBQyxHQUFpQjtJQUN0QyxNQUFNLEdBQUcsR0FBRyxPQUFPLEdBQUcsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztJQUMzRCxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUM7UUFDZiwwQkFBMEI7UUFDMUIsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUM7UUFDbEMsNEJBQTRCO1FBQzVCLEtBQUssRUFBRSxJQUFJO1FBQ1gsUUFBUSxFQUFFLElBQUk7S0FDZCxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSxVQUFVLGtCQUFrQixDQUFDLEdBQWlCLEVBQUUsT0FBZTtJQUNwRSxNQUFNLGFBQWEsR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDeEMsSUFBSSxpQkFBc0IsQ0FBQztJQUUzQixNQUFNLGFBQWEsR0FBRyxlQUFlLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3BELDJFQUEyRTtJQUMzRSx1RUFBdUU7SUFDdkUsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ3BCLElBQUksYUFBYSxDQUFDLE1BQU0sS0FBSyxNQUFNLElBQUksYUFBYSxDQUFDLE1BQU0sS0FBSyxPQUFPLEVBQUUsQ0FBQztZQUN6RSxPQUFPLEtBQUssQ0FBQztRQUNkLENB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