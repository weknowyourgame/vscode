/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { URI } from '../../../../../base/common/uri.js';
export function arrayContainsElementOrParent(element, testArray) {
    do {
        if (testArray.includes(element)) {
            return true;
        }
    } while (!isSearchResult(element.parent()) && (element = element.parent()));
    return false;
}
export var SearchModelLocation;
(function (SearchModelLocation) {
    SearchModelLocation[SearchModelLocation["PANEL"] = 0] = "PANEL";
    SearchModelLocation[SearchModelLocation["QUICK_ACCESS"] = 1] = "QUICK_ACCESS";
})(SearchModelLocation || (SearchModelLocation = {}));
export const PLAIN_TEXT_SEARCH__RESULT_ID = 'plainTextSearch';
export const AI_TEXT_SEARCH_RESULT_ID = 'aiTextSearch';
export function createParentList(element) {
    const parentArray = [];
    let currElement = element;
    while (!isTextSearchHeading(currElement)) {
        parentArray.push(currElement);
        currElement = currElement.parent();
    }
    return parentArray;
}
export const SEARCH_MODEL_PREFIX = 'SEARCH_MODEL_';
export const SEARCH_RESULT_PREFIX = 'SEARCH_RESULT_';
export const TEXT_SEARCH_HEADING_PREFIX = 'TEXT_SEARCH_HEADING_';
export const FOLDER_MATCH_PREFIX = 'FOLDER_MATCH_';
export const FILE_MATCH_PREFIX = 'FILE_MATCH_';
export const MATCH_PREFIX = 'MATCH_';
export function mergeSearchResultEvents(events) {
    const retEvent = {
        elements: [],
        added: false,
        removed: false,
    };
    events.forEach((e) => {
        if (e.added) {
            retEvent.added = true;
        }
        if (e.removed) {
            retEvent.removed = true;
        }
        retEvent.elements = retEvent.elements.concat(e.elements);
    });
    return retEvent;
}
export function isSearchModel(obj) {
    return typeof obj === 'object' &&
        obj !== null &&
        typeof obj.id === 'function' &&
        obj.id().startsWith(SEARCH_MODEL_PREFIX);
}
export function isSearchResult(obj) {
    return typeof obj === 'object' &&
        obj !== null &&
        typeof obj.id === 'function' &&
        obj.id().startsWith(SEARCH_RESULT_PREFIX);
}
export function isTextSearchHeading(obj) {
    return typeof obj === 'object' &&
        obj !== null &&
        typeof obj.id === 'function' &&
        obj.id().startsWith(TEXT_SEARCH_HEADING_PREFIX);
}
export function isPlainTextSearchHeading(obj) {
    return isTextSearchHeading(obj) &&
        // eslint-disable-next-line local/code-no-any-casts
        typeof obj.replace === 'function' &&
        // eslint-disable-next-line local/code-no-any-casts
        typeof obj.replaceAll === 'function';
}
export function isSearchTreeFolderMatch(obj) {
    return typeof obj === 'object' &&
        obj !== null &&
        typeof obj.id === 'function' &&
        obj.id().startsWith(FOLDER_MATCH_PREFIX);
}
export function isSearchTreeFolderMatchWithResource(obj) {
    return isSearchTreeFolderMatch(obj) && obj.resource instanceof URI;
}
export function isSearchTreeFolderMatchWorkspaceRoot(obj) {
    return isSearchTreeFolderMatchWithResource(obj) &&
        // eslint-disable-next-line local/code-no-any-casts
        typeof obj.createAndConfigureFileMatch === 'function';
}
export function isSearchTreeFolderMatchNoRoot(obj) {
    return isSearchTreeFolderMatch(obj) &&
        // eslint-disable-next-line local/code-no-any-casts
        typeof obj.createAndConfigureFileMatch === 'function';
}
export function isSearchTreeFileMatch(obj) {
    return typeof obj === 'object' &&
        obj !== null &&
        typeof obj.id === 'function' &&
        obj.id().startsWith(FILE_MATCH_PREFIX);
}
export function isSearchTreeMatch(obj) {
    return typeof obj === 'object' &&
        obj !== null &&
        typeof obj.id === 'function' &&
        obj.id().startsWith(MATCH_PREFIX);
}
export function isSearchHeader(obj) {
    return typeof obj === 'object' &&
        obj !== null &&
        typeof obj.id === 'function' &&
        obj.id().startsWith(TEXT_SEARCH_HEADING_PREFIX);
}
export function getFileMatches(matches) {
    const folderMatches = [];
    const fileMatches = [];
    matches.forEach((e) => {
        if (isSearchTreeFileMatch(e)) {
            fileMatches.push(e);
        }
        else {
            folderMatches.push(e);
        }
    });
    return fileMatches.concat(folderMatches.map(e => e.allDownstreamFileMatches()).flat());
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VhcmNoVHJlZUNvbW1vbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hUcmVlTW9kZWwvc2VhcmNoVHJlZUNvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUtoRyxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFZeEQsTUFBTSxVQUFVLDRCQUE0QixDQUFDLE9BQXdCLEVBQUUsU0FBNEI7SUFDbEcsR0FBRyxDQUFDO1FBQ0gsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO0lBQ0YsQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxHQUFvQixPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRTtJQUU3RixPQUFPLEtBQUssQ0FBQztBQUNkLENBQUM7QUFTRCxNQUFNLENBQU4sSUFBWSxtQkFHWDtBQUhELFdBQVksbUJBQW1CO0lBQzlCLCtEQUFLLENBQUE7SUFDTCw2RUFBWSxDQUFBO0FBQ2IsQ0FBQyxFQUhXLG1CQUFtQixLQUFuQixtQkFBbUIsUUFHOUI7QUFHRCxNQUFNLENBQUMsTUFBTSw0QkFBNEIsR0FBRyxpQkFBaUIsQ0FBQztBQUM5RCxNQUFNLENBQUMsTUFBTSx3QkFBd0IsR0FBRyxjQUFjLENBQUM7QUFFdkQsTUFBTSxVQUFVLGdCQUFnQixDQUFDLE9BQXdCO0lBQ3hELE1BQU0sV0FBVyxHQUFzQixFQUFFLENBQUM7SUFDMUMsSUFBSSxXQUFXLEdBQXlDLE9BQU8sQ0FBQztJQUVoRSxPQUFPLENBQUMsbUJBQW1CLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQztRQUMxQyxXQUFXLENBQUMs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