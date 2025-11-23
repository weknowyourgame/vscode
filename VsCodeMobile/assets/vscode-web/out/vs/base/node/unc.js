/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export function getUNCHostAllowlist() {
    const allowlist = processUNCHostAllowlist();
    if (allowlist) {
        return Array.from(allowlist);
    }
    return [];
}
function processUNCHostAllowlist() {
    // The property `process.uncHostAllowlist` is not available in official node.js
    // releases, only in our own builds, so we have to probe for availability
    return process.uncHostAllowlist;
}
export function addUNCHostToAllowlist(allowedHost) {
    if (process.platform !== 'win32') {
        return;
    }
    const allowlist = processUNCHostAllowlist();
    if (allowlist) {
        if (typeof allowedHost === 'string') {
            allowlist.add(allowedHost.toLowerCase()); // UNC hosts are case-insensitive
        }
        else {
            for (const host of toSafeStringArray(allowedHost)) {
                addUNCHostToAllowlist(host);
            }
        }
    }
}
function toSafeStringArray(arg0) {
    const allowedUNCHosts = new Set();
    if (Array.isArray(arg0)) {
        for (const host of arg0) {
            if (typeof host === 'string') {
                allowedUNCHosts.add(host);
            }
        }
    }
    return Array.from(allowedUNCHosts);
}
export function getUNCHost(maybeUNCPath) {
    if (typeof maybeUNCPath !== 'string') {
        return undefined; // require a valid string
    }
    const uncRoots = [
        '\\\\.\\UNC\\', // DOS Device paths (https://learn.microsoft.com/en-us/dotnet/standard/io/file-path-formats)
        '\\\\?\\UNC\\',
        '\\\\' // standard UNC path
    ];
    let host = undefined;
    for (const uncRoot of uncRoots) {
        const indexOfUNCRoot = maybeUNCPath.indexOf(uncRoot);
        if (indexOfUNCRoot !== 0) {
            continue; // not matching any of our expected UNC roots
        }
        const indexOfUNCPath = maybeUNCPath.indexOf('\\', uncRoot.length);
        if (indexOfUNCPath === -1) {
            continue; // no path component found
        }
        const hostCandidate = maybeUNCPath.substring(uncRoot.length, indexOfUNCPath);
        if (hostCandidate) {
            host = hostCandidate;
            break;
        }
    }
    return host;
}
export function disableUNCAccessRestrictions() {
    if (process.platform !== 'win32') {
        return;
    }
    process.restrictUNCAccess = false;
}
export function isUNCAccessRestrictionsDisabled() {
    if (process.platform !== 'win32') {
        return true;
    }
    return process.restrictUNCAccess === false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5jLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2Uvbm9kZS91bmMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsTUFBTSxVQUFVLG1CQUFtQjtJQUNsQyxNQUFNLFNBQVMsR0FBRyx1QkFBdUIsRUFBRSxDQUFDO0lBQzVDLElBQUksU0FBUyxFQUFFLENBQUM7UUFDZixPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVELE9BQU8sRUFBRSxDQUFDO0FBQ1gsQ0FBQztBQUVELFNBQVMsdUJBQXVCO0lBRS9CLCtFQUErRTtJQUMvRSx5RUFBeUU7SUFFekUsT0FBUSxPQUF5RCxDQUFDLGdCQUFnQixDQUFDO0FBQ3BGLENBQUM7QUFFRCxNQUFNLFVBQVUscUJBQXFCLENBQUMsV0FBOEI7SUFDbkUsSUFBSSxPQUFPLENBQUMsUUFBUSxLQUFLLE9BQU8sRUFBRSxDQUFDO1FBQ2xDLE9BQU87SUFDUixDQUFDO0lBRUQsTUFBTSxTQUFTLEdBQUcsdUJBQXVCLEVBQUUsQ0FBQztJQUM1QyxJQUFJLFNBQVMsRUFBRSxDQUFDO1FBQ2YsSUFBSSxPQUFPLFdBQVcsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUNyQyxTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUMsaUNBQWlDO1FBQzVFLENBQUM7YUFBTSxDQUFDO1lBQ1AsS0FBSyxNQUFNLElBQUksSUFBSSxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO2dCQUNuRCxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM3QixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7QUFDRixDQUFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxJQUFhO0lBQ3ZDLE1BQU0sZUFBZSxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7SUFFMUMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDekIsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUN6QixJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUM5QixlQUFlLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzNCLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVELE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUNwQyxDQUFDO0FBRUQsTUFBTSxVQUFVLFVBQVUsQ0FBQyxZQUF1QztJQUNqRSxJQUFJLE9BQU8sWUFBWSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQ3RDLE9BQU8sU0FBUyxDQUFDLENBQUMseUJBQXlCO0lBQzVDLENBQUM7SUFFRCxNQUFNLFFBQVEsR0FBRztRQUNoQixjQUFjLEVBQUUsNEZBQTRGO1FBQzVHLGNBQWM7UUFDZCxNQUFNLENBQUcsb0JBQW9CO0tBQzdCLENBQUM7SUFFRixJQUFJLElBQUksR0FBRyxTQUFTLENBQUM7SUFFckIsS0FBSyxNQUFNLE9BQU8sSUFBSSxRQUFRLEVBQUUsQ0FBQztRQUNoQyxNQUFNLGNBQWMsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3JELElBQUksY0FBYyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzFCLFNBQVMsQ0FBQyw2Q0FBNkM7UUFDeEQsQ0FBQztRQUVELE1BQU0sY0FBYyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNsRSxJQUFJLGNBQWMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQzNCLFNBQVMsQ0FBQywwQkFBMEI7UUFDckMsQ0FBQztRQUVELE1BQU0sYUFBYSxHQUFHLFlBQVksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUMsQ0FBQztRQUM3RSxJQUFJLGFBQWEsRUFBRSxDQUFDO1lBQ25CLElBQUksR0FBRyxhQUFhLENBQUM7WUFDckIsTUFBTTtRQUNQLENBQUM7SUFDRixDQUFDO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDYixDQUFDO0FBRUQsTUFBTSxVQUFVLDRCQUE0QjtJQUMzQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssT0FBTyxFQUFFLENBQUM7UUFDbEMsT0FBTztJQUNSLENBQUM7SUFFQSxPQUFzRCxDQUFDLGlCQUFpQixHQUFHLEtBQUssQ0FBQztBQUNuRixDQUFDO0FBRUQsTUFBTSxVQUFVLCtCQUErQjtJQUM5QyxJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssT0FBTyxFQUFFLENBQUM7UUFDbEMsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRUQsT0FBUSxPQUFzRCxDQUFDLGlCQUFpQixLQUFLLEtBQUssQ0FBQztBQUM1RixDQUFDIn0=