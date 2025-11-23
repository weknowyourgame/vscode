/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { mapArrayOrNot } from '../../../../base/common/arrays.js';
import * as glob from '../../../../base/common/glob.js';
import * as objects from '../../../../base/common/objects.js';
import * as extpath from '../../../../base/common/extpath.js';
import { fuzzyContains, getNLines } from '../../../../base/common/strings.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import * as paths from '../../../../base/common/path.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { TextSearchCompleteMessageType } from './searchExtTypes.js';
import { isThenable } from '../../../../base/common/async.js';
export { TextSearchCompleteMessageType };
export const VIEWLET_ID = 'workbench.view.search';
export const PANEL_ID = 'workbench.panel.search';
export const VIEW_ID = 'workbench.view.search';
export const SEARCH_RESULT_LANGUAGE_ID = 'search-result';
export const SEARCH_EXCLUDE_CONFIG = 'search.exclude';
export const DEFAULT_MAX_SEARCH_RESULTS = 20000;
// Warning: this pattern is used in the search editor to detect offsets. If you
// change this, also change the search-result built-in extension
const SEARCH_ELIDED_PREFIX = '⟪ ';
const SEARCH_ELIDED_SUFFIX = ' characters skipped ⟫';
const SEARCH_ELIDED_MIN_LEN = (SEARCH_ELIDED_PREFIX.length + SEARCH_ELIDED_SUFFIX.length + 5) * 2;
export const ISearchService = createDecorator('searchService');
/**
 * TODO@roblou - split text from file search entirely, or share code in a more natural way.
 */
export var SearchProviderType;
(function (SearchProviderType) {
    SearchProviderType[SearchProviderType["file"] = 0] = "file";
    SearchProviderType[SearchProviderType["text"] = 1] = "text";
    SearchProviderType[SearchProviderType["aiText"] = 2] = "aiText";
})(SearchProviderType || (SearchProviderType = {}));
export var QueryType;
(function (QueryType) {
    QueryType[QueryType["File"] = 1] = "File";
    QueryType[QueryType["Text"] = 2] = "Text";
    QueryType[QueryType["aiText"] = 3] = "aiText";
})(QueryType || (QueryType = {}));
export function resultIsMatch(result) {
    return !!result.rangeLocations && !!result.previewText;
}
export function isFileMatch(p) {
    return !!p.resource;
}
export function isAIKeyword(p) {
    return !!p.keyword;
}
export function isProgressMessage(p) {
    return !!p.message;
}
export var SearchCompletionExitCode;
(function (SearchCompletionExitCode) {
    SearchCompletionExitCode[SearchCompletionExitCode["Normal"] = 0] = "Normal";
    SearchCompletionExitCode[SearchCompletionExitCode["NewSearchStarted"] = 1] = "NewSearchStarted";
})(SearchCompletionExitCode || (SearchCompletionExitCode = {}));
export class FileMatch {
    constructor(resource) {
        this.resource = resource;
        this.results = [];
        // empty
    }
}
export class TextSearchMatch {
    constructor(text, ranges, previewOptions, webviewIndex) {
        this.rangeLocations = [];
        this.webviewIndex = webviewIndex;
        // Trim preview if this is one match and a single-line match with a preview requested.
        // Otherwise send the full text, like for replace or for showing multiple previews.
        // TODO this is fishy.
        const rangesArr = Array.isArray(ranges) ? ranges : [ranges];
        if (previewOptions && previewOptions.matchLines === 1 && isSingleLineRangeList(rangesArr)) {
            // 1 line preview requested
            text = getNLines(text, previewOptions.matchLines);
            let result = '';
            let shift = 0;
            let lastEnd = 0;
            const leadingChars = Math.floor(previewOptions.charsPerLine / 5);
            for (const range of rangesArr) {
                const previewStart = Math.max(range.startColumn - leadingChars, 0);
                const previewEnd = range.startColumn + previewOptions.charsPerLine;
                if (previewStart > lastEnd + leadingChars + SEARCH_ELIDED_MIN_LEN) {
                    const elision = SEARCH_ELIDED_PREFIX + (previewStart - lastEnd) + SEARCH_ELIDED_SUFFIX;
                    result += elision + text.slice(previewStart, previewEnd);
                    shift += previewStart - (lastEnd + elision.length);
                }
                else {
                    result += text.slice(lastEnd, previewEnd);
                }
                lastEnd = previewEnd;
                this.rangeLocations.push({
                    source: range,
                    preview: new OneLineRange(0, range.startColumn - shift, range.endColumn - shift)
                });
            }
            this.previewText = result;
        }
        else {
            const firstMatchLine = Array.isArray(ranges) ? ranges[0].startLineNumber : ranges.startLineNumber;
            const rangeLocs = mapArrayOrNot(ranges, r => ({
                preview: new SearchRange(r.startLineNumber - firstMatchLine, r.startColumn, r.endLineNumber - firstMatchLine, r.endColumn),
                source: r
            }));
            this.rangeLocations = Array.isArray(rangeLocs) ? rangeLocs : [rangeLocs];
            this.previewText = text;
        }
    }
}
function isSingleLineRangeList(ranges) {
    const line = ranges[0].startLineNumber;
    for (const r of ranges) {
        if (r.startLineNumber !== line || r.endLineNumber !== line) {
            return false;
        }
    }
    return true;
}
export class SearchRange {
    constructor(startLineNumber, startColumn, endLineNumber, endColumn) {
        this.startLineNumber = startLineNumber;
        this.startColumn = startColumn;
        this.endLineNumber = endLineNumber;
        this.endColumn = endColumn;
    }
}
export class OneLineRange extends SearchRange {
    constructor(lineNumber, startColumn, endColumn) {
        super(lineNumber, startColumn, lineNumber, endColumn);
    }
}
export var ViewMode;
(function (ViewMode) {
    ViewMode["List"] = "list";
    ViewMode["Tree"] = "tree";
})(ViewMode || (ViewMode = {}));
export var SearchSortOrder;
(function (SearchSortOrder) {
    SearchSortOrder["Default"] = "default";
    SearchSortOrder["FileNames"] = "fileNames";
    SearchSortOrder["Type"] = "type";
    SearchSortOrder["Modified"] = "modified";
    SearchSortOrder["CountDescending"] = "countDescending";
    SearchSortOrder["CountAscending"] = "countAscending";
})(SearchSortOrder || (SearchSortOrder = {}));
export var SemanticSearchBehavior;
(function (SemanticSearchBehavior) {
    SemanticSearchBehavior["Auto"] = "auto";
    SemanticSearchBehavior["Manual"] = "manual";
    SemanticSearchBehavior["RunOnEmpty"] = "runOnEmpty";
})(SemanticSearchBehavior || (SemanticSearchBehavior = {}));
export function getExcludes(configuration, includeSearchExcludes = true) {
    const fileExcludes = configuration && configuration.files && configuration.files.exclude;
    const searchExcludes = includeSearchExcludes && configuration && configuration.search && configuration.search.exclude;
    if (!fileExcludes && !searchExcludes) {
        return undefined;
    }
    if (!fileExcludes || !searchExcludes) {
        return fileExcludes || searchExcludes || undefined;
    }
    let allExcludes = Object.create(null);
    // clone the config as it could be frozen
    allExcludes = objects.mixin(allExcludes, objects.deepClone(fileExcludes));
    allExcludes = objects.mixin(allExcludes, objects.deepClone(searchExcludes), true);
    return allExcludes;
}
export function pathIncludedInQuery(queryProps, fsPath) {
    if (queryProps.excludePattern && glob.match(queryProps.excludePattern, fsPath)) {
        return false;
    }
    if (queryProps.includePattern || queryProps.usingSearchPaths) {
        if (queryProps.includePattern && glob.match(queryProps.includePattern, fsPath)) {
            return true;
        }
        // If searchPaths are being used, the extra file must be in a subfolder and match the pattern, if present
        if (queryProps.usingSearchPaths) {
            return !!queryProps.folderQueries && queryProps.folderQueries.some(fq => {
                const searchPath = fq.folder.fsPath;
                if (extpath.isEqualOrParent(fsPath, searchPath)) {
                    const relPath = paths.relative(searchPath, fsPath);
                    return !fq.includePattern || !!glob.match(fq.includePattern, relPath);
                }
                else {
                    return false;
                }
            });
        }
        return false;
    }
    return true;
}
export var SearchErrorCode;
(function (SearchErrorCode) {
    SearchErrorCode[SearchErrorCode["unknownEncoding"] = 1] = "unknownEncoding";
    SearchErrorCode[SearchErrorCode["regexParseError"] = 2] = "regexParseError";
    SearchErrorCode[SearchErrorCode["globParseError"] = 3] = "globParseError";
    SearchErrorCode[SearchErrorCode["invalidLiteral"] = 4] = "invalidLiteral";
    SearchErrorCode[SearchErrorCode["rgProcessError"] = 5] = "rgProcessError";
    SearchErrorCode[SearchErrorCode["other"] = 6] = "other";
    SearchErrorCode[SearchErrorCode["canceled"] = 7] = "canceled";
})(SearchErrorCode || (SearchErrorCode = {}));
export class SearchError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}
export function deserializeSearchError(error) {
    const errorMsg = error.message;
    if (isCancellationError(error)) {
        return new SearchError(errorMsg, SearchErrorCode.canceled);
    }
    try {
        const details = JSON.parse(errorMsg);
        return new SearchError(details.message, details.code);
    }
    catch (e) {
        return new SearchError(errorMsg, SearchErrorCode.other);
    }
}
export function serializeSearchError(searchError) {
    const details = { message: searchError.message, code: searchError.code };
    return new Error(JSON.stringify(details));
}
export function isSerializedSearchComplete(arg) {
    // eslint-disable-next-line local/code-no-any-casts
    if (arg.type === 'error') {
        return true;
        // eslint-disable-next-line local/code-no-any-casts
    }
    else if (arg.type === 'success') {
        return true;
    }
    else {
        return false;
    }
}
export function isSerializedSearchSuccess(arg) {
    return arg.type === 'success';
}
export function isSerializedFileMatch(arg) {
    return !!arg.path;
}
export function isFilePatternMatch(candidate, filePatternToUse, fuzzy = true) {
    const pathToMatch = candidate.searchPath ? candidate.searchPath : candidate.relativePath;
    return fuzzy ?
        fuzzyContains(pathToMatch, filePatternToUse) :
        glob.match(filePatternToUse, pathToMatch);
}
export class SerializableFileMatch {
    constructor(path) {
        this.path = path;
        this.results = [];
    }
    addMatch(match) {
        this.results.push(match);
    }
    serialize() {
        return {
            path: this.path,
            results: this.results,
            numMatches: this.results.length
        };
    }
}
/**
 *  Computes the patterns that the provider handles. Discards sibling clauses and 'false' patterns
 */
export function resolvePatternsForProvider(globalPattern, folderPattern) {
    const merged = {
        ...(globalPattern || {}),
        ...(folderPattern || {})
    };
    return Object.keys(merged)
        .filter(key => {
        const value = merged[key];
        return typeof value === 'boolean' && value;
    });
}
export class QueryGlobTester {
    constructor(config, folderQuery) {
        this._parsedIncludeExpression = null;
        // todo: try to incorporate folderQuery.excludePattern.folder if available
        this._excludeExpression = folderQuery.excludePattern?.map(excludePattern => {
            return {
                ...(config.excludePattern || {}),
                ...(excludePattern.pattern || {})
            };
        }) ?? [];
        if (this._excludeExpression.length === 0) {
            // even if there are no folderQueries, we want to observe  the global excludes
            this._excludeExpression = [config.excludePattern || {}];
        }
        this._parsedExcludeExpression = this._excludeExpression.map(e => glob.parse(e));
        // Empty includeExpression means include nothing, so no {} shortcuts
        let includeExpression = config.includePattern;
        if (folderQuery.includePattern) {
            if (includeExpression) {
                includeExpression = {
                    ...includeExpression,
                    ...folderQuery.includePattern
                };
            }
            else {
                includeExpression = folderQuery.includePattern;
            }
        }
        if (includeExpression) {
            this._parsedIncludeExpression = glob.parse(includeExpression);
        }
    }
    _evalParsedExcludeExpression(testPath, basename, hasSibling) {
        // todo: less hacky way of evaluating sync vs async sibling clauses
        let result = null;
        for (const folderExclude of this._parsedExcludeExpression) {
            // find first non-null result
            const evaluation = folderExclude(testPath, basename, hasSibling);
            if (typeof evaluation === 'string') {
                result = evaluation;
                break;
            }
        }
        return result;
    }
    matchesExcludesSync(testPath, basename, hasSibling) {
        if (this._parsedExcludeExpression && this._evalParsedExcludeExpression(testPath, basename, hasSibling)) {
            return true;
        }
        return false;
    }
    /**
     * Guaranteed sync - siblingsFn should not return a promise.
     */
    includedInQuerySync(testPath, basename, hasSibling) {
        if (this._parsedExcludeExpression && this._evalParsedExcludeExpression(testPath, basename, hasSibling)) {
            return false;
        }
        if (this._parsedIncludeExpression && !this._parsedIncludeExpression(testPath, basename, hasSibling)) {
            return false;
        }
        return true;
    }
    /**
     * Evaluating the exclude expression is only async if it includes sibling clauses. As an optimization, avoid doing anything with Promises
     * unless the expression is async.
     */
    includedInQuery(testPath, basename, hasSibling) {
        const isIncluded = () => {
            return this._parsedIncludeExpression ?
                !!(this._parsedIncludeExpression(testPath, basename, hasSibling)) :
                true;
        };
        return Promise.all(this._parsedExcludeExpression.map(e => {
            const excluded = e(testPath, basename, hasSibling);
            if (isThenable(excluded)) {
                return excluded.then(excluded => {
                    if (excluded) {
                        return false;
                    }
                    return isIncluded();
                });
            }
            return isIncluded();
        })).then(e => e.some(e => !!e));
    }
    hasSiblingExcludeClauses() {
        return this._excludeExpression.reduce((prev, curr) => hasSiblingClauses(curr) || prev, false);
    }
}
function hasSiblingClauses(pattern) {
    for (const key in pattern) {
        if (typeof pattern[key] !== 'boolean') {
            return true;
        }
    }
    return false;
}
export function hasSiblingPromiseFn(siblingsFn) {
    if (!siblingsFn) {
        return undefined;
    }
    let siblings;
    return (name) => {
        if (!siblings) {
            siblings = (siblingsFn() || Promise.resolve([]))
                .then(list => list ? listToMap(list) : {});
        }
        return siblings.then(map => !!map[name]);
    };
}
export function hasSiblingFn(siblingsFn) {
    if (!siblingsFn) {
        return undefined;
    }
    let siblings;
    return (name) => {
        if (!siblings) {
            const list = siblingsFn();
            siblings = list ? listToMap(list) : {};
        }
        return !!siblings[name];
    };
}
function listToMap(list) {
    const map = {};
    for (const key of list) {
        map[key] = true;
    }
    return map;
}
export function excludeToGlobPattern(excludesForFolder) {
    return excludesForFolder.flatMap(exclude => exclude.patterns.map(pattern => {
        return exclude.baseUri ?
            {
                baseUri: exclude.baseUri,
                pattern: pattern
            } : pattern;
    }));
}
export const DEFAULT_TEXT_SEARCH_PREVIEW_OPTIONS = {
    matchLines: 100,
    charsPerLine: 10000
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VhcmNoLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9zZWFyY2gvY29tbW9uL3NlYXJjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFbEUsT0FBTyxLQUFLLElBQUksTUFBTSxpQ0FBaUMsQ0FBQztBQUV4RCxPQUFPLEtBQUssT0FBTyxNQUFNLG9DQUFvQyxDQUFDO0FBQzlELE9BQU8sS0FBSyxPQUFPLE1BQU0sb0NBQW9DLENBQUM7QUFDOUQsT0FBTyxFQUFFLGFBQWEsRUFBRSxTQUFTLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUc5RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFHN0YsT0FBTyxLQUFLLEtBQUssTUFBTSxpQ0FBaUMsQ0FBQztBQUN6RCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RSxPQUFPLEVBQWdDLDZCQUE2QixFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDbEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRzlELE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxDQUFDO0FBRXpDLE1BQU0sQ0FBQyxNQUFNLFVBQVUsR0FBRyx1QkFBdUIsQ0FBQztBQUNsRCxNQUFNLENBQUMsTUFBTSxRQUFRLEdBQUcsd0JBQXdCLENBQUM7QUFDakQsTUFBTSxDQUFDLE1BQU0sT0FBTyxHQUFHLHVCQUF1QixDQUFDO0FBQy9DLE1BQU0sQ0FBQyxNQUFNLHlCQUF5QixHQUFHLGVBQWUsQ0FBQztBQUV6RCxNQUFNLENBQUMsTUFBTSxxQkFBcUIsR0FBRyxnQkFBZ0IsQ0FBQztBQUN0RCxNQUFNLENBQUMsTUFBTSwwQkFBMEIsR0FBRyxLQUFLLENBQUM7QUFFaEQsK0VBQStFO0FBQy9FLGdFQUFnRTtBQUNoRSxNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQztBQUNsQyxNQUFNLG9CQUFvQixHQUFHLHVCQUF1QixDQUFDO0FBQ3JELE1BQU0scUJBQXFCLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLEdBQUcsb0JBQW9CLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUVsRyxNQUFNLENBQUMsTUFBTSxjQUFjLEdBQUcsZUFBZSxDQUFpQixlQUFlLENBQUMsQ0FBQztBQWlCL0U7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBa0Isa0JBSWpCO0FBSkQsV0FBa0Isa0JBQWtCO0lBQ25DLDJEQUFJLENBQUE7SUFDSiwyREFBSSxDQUFBO0lBQ0osK0RBQU0sQ0FBQTtBQUNQLENBQUMsRUFKaUIsa0JBQWtCLEtBQWxCLGtCQUFrQixRQUluQztBQWdHRCxNQUFNLENBQU4sSUFBa0IsU0FJakI7QUFKRCxXQUFrQixTQUFTO0lBQzFCLHlDQUFRLENBQUE7SUFDUix5Q0FBUSxDQUFBO0lBQ1IsNkNBQVUsQ0FBQTtBQUNYLENBQUMsRUFKaUIsU0FBUyxLQUFULFNBQVMsUUFJMUI7QUFxRUQsTUFBTSxVQUFVLGFBQWEsQ0FBQyxNQUF5QjtJQUN0RCxPQUFPLENBQUMsQ0FBb0IsTUFBTyxDQUFDLGNBQWMsSUFBSSxDQUFDLENBQW9CLE1BQU8sQ0FBQyxXQUFXLENBQUM7QUFDaEcsQ0FBQztBQVFELE1BQU0sVUFBVSxXQUFXLENBQUMsQ0FBc0I7SUFDakQsT0FBTyxDQUFDLENBQWMsQ0FBRSxDQUFDLFFBQVEsQ0FBQztBQUNuQyxDQUFDO0FBRUQsTUFBTSxVQUFVLFdBQVcsQ0FBQyxDQUFzQjtJQUNqRCxPQUFPLENBQUMsQ0FBbUIsQ0FBRSxDQUFDLE9BQU8sQ0FBQztBQUN2QyxDQUFDO0FBRUQsTUFBTSxVQUFVLGlCQUFpQixDQUFDLENBQXNEO0lBQ3ZGLE9BQU8sQ0FBQyxDQUFFLENBQXNCLENBQUMsT0FBTyxDQUFDO0FBQzFDLENBQUM7QUFvQkQsTUFBTSxDQUFOLElBQWtCLHdCQUdqQjtBQUhELFdBQWtCLHdCQUF3QjtJQUN6QywyRUFBTSxDQUFBO0lBQ04sK0ZBQWdCLENBQUE7QUFDakIsQ0FBQyxFQUhpQix3QkFBd0IsS0FBeEIsd0JBQXdCLFFBR3pDO0FBbUNELE1BQU0sT0FBTyxTQUFTO0lBRXJCLFlBQW1CLFFBQWE7UUFBYixhQUFRLEdBQVIsUUFBUSxDQUFLO1FBRGhDLFlBQU8sR0FBd0IsRUFBRSxDQUFDO1FBRWpDLFFBQVE7SUFDVCxDQUFDO0NBQ0Q7QUFPRCxNQUFNLE9BQU8sZUFBZTtJQUszQixZQUFZLElBQVksRUFBRSxNQUFxQyxFQUFFLGNBQTBDLEVBQUUsWUFBcUI7UUFKbEksbUJBQWMsR0FBNEIsRUFBRSxDQUFDO1FBSzVDLElBQUksQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDO1FBRWpDLHNGQUFzRjtRQUN0RixtRkFBbUY7UUFDbkYsc0JBQXNCO1FBQ3RCLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUU1RCxJQUFJLGNBQWMsSUFBSSxjQUFjLENBQUMsVUFBVSxLQUFLLENBQUMsSUFBSSxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQzNGLDJCQUEyQjtZQUMzQixJQUFJLEdBQUcsU0FBUyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUM7WUFFbEQsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO1lBQ2hCLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztZQUNkLElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQztZQUNoQixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDakUsS0FBSyxNQUFNLEtBQUssSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDL0IsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsV0FBVyxHQUFHLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDbkUsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLFdBQVcsR0FBRyxjQUFjLENBQUMsWUFBWSxDQUFDO2dCQUNuRSxJQUFJLFlBQVksR0FBRyxPQUFPLEdBQUcsWUFBWSxHQUFHLHFCQUFxQixFQUFFLENBQUM7b0JBQ25FLE1BQU0sT0FBTyxHQUFHLG9CQUFvQixHQUFHLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQyxHQUFHLG9CQUFvQixDQUFDO29CQUN2RixNQUFNLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxDQUFDO29CQUN6RCxLQUFLLElBQUksWUFBWSxHQUFHLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDcEQsQ0FBQztxQkFBTSxDQUFDO29CQUNQLE1BQU0sSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQztnQkFDM0MsQ0FBQztnQkFFRCxPQUFPLEdBQUcsVUFBVSxDQUFDO2dCQUNyQixJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQztvQkFDeEIsTUFBTSxFQUFFLEtBQUs7b0JBQ2IsT0FBTyxFQUFFLElBQUksWUFBWSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsV0FBVyxHQUFHLEtBQUssRUFBRSxLQUFLLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztpQkFDaEYsQ0FBQyxDQUFDO1lBRUosQ0FBQztZQUVELElBQUksQ0FBQyxXQUFXLEdBQUcsTUFBTSxDQUFDO1FBQzNCLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxjQUFjLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQztZQUVsRyxNQUFNLFNBQVMsR0FBRyxhQUFhLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDN0MsT0FBTyxFQUFFLElBQUksV0FBVyxDQUFDLENBQUMsQ0FBQyxlQUFlLEdBQUcsY0FBYyxFQUFFLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLGFBQWEsR0FBRyxjQUFjLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQztnQkFDMUgsTUFBTSxFQUFFLENBQUM7YUFDVCxDQUFDLENBQUMsQ0FBQztZQUVKLElBQUksQ0FBQyxjQUFjLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3pFLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBQ3pCLENBQUM7SUFDRixDQUFDO0NBQ0Q7QUFFRCxTQUFTLHFCQUFxQixDQUFDLE1BQXNCO0lBQ3BELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUM7SUFDdkMsS0FBSyxNQUFNLENBQUMsSUFBSSxNQUFNLEVBQUUsQ0FBQztRQUN4QixJQUFJLENBQUMsQ0FBQyxlQUFlLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQyxhQUFhLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDNUQsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO0lBQ0YsQ0FBQztJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2IsQ0FBQztBQUVELE1BQU0sT0FBTyxXQUFXO0lBTXZCLFlBQVksZUFBdUIsRUFBRSxXQUFtQixFQUFFLGFBQXFCLEVBQUUsU0FBaUI7UUFDakcsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7UUFDdkMsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7UUFDL0IsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDbkMsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7SUFDNUIsQ0FBQztDQUNEO0FBRUQsTUFBTSxPQUFPLFlBQWEsU0FBUSxXQUFXO0lBQzVDLFlBQVksVUFBa0IsRUFBRSxXQUFtQixFQUFFLFNBQWlCO1FBQ3JFLEtBQUssQ0FBQyxVQUFVLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUN2RCxDQUFDO0NBQ0Q7QUFFRCxNQUFNLENBQU4sSUFBa0IsUUFHakI7QUFIRCxXQUFrQixRQUFRO0lBQ3pCLHlCQUFhLENBQUE7SUFDYix5QkFBYSxDQUFBO0FBQ2QsQ0FBQyxFQUhpQixRQUFRLEtBQVIsUUFBUSxRQUd6QjtBQUVELE1BQU0sQ0FBTixJQUFrQixlQU9qQjtBQVBELFdBQWtCLGVBQWU7SUFDaEMsc0NBQW1CLENBQUE7SUFDbkIsMENBQXVCLENBQUE7SUFDdkIsZ0NBQWEsQ0FBQTtJQUNiLHdDQUFxQixDQUFBO0lBQ3JCLHNEQUFtQyxDQUFBO0lBQ25DLG9EQUFpQyxDQUFBO0FBQ2xDLENBQUMsRUFQaUIsZUFBZSxLQUFmLGVBQWUsUUFPaEM7QUFFRCxNQUFNLENBQU4sSUFBa0Isc0JBSWpCO0FBSkQsV0FBa0Isc0JBQXNCO0lBQ3ZDLHVDQUFhLENBQUE7SUFDYiwyQ0FBaUIsQ0FBQTtJQUNqQixtREFBeUIsQ0FBQTtBQUMxQixDQUFDLEVBSmlCLHNCQUFzQixLQUF0QixzQkFBc0IsUUFJdkM7QUE0REQsTUFBTSxVQUFVLFdBQVcsQ0FBQyxhQUFtQyxFQUFFLHFCQUFxQixHQUFHLElBQUk7SUFDNUYsTUFBTSxZQUFZLEdBQUcsYUFBYSxJQUFJLGFBQWEsQ0FBQyxLQUFLLElBQUksYUFBYSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUM7SUFDekYsTUFBTSxjQUFjLEdBQUcscUJBQXFCLElBQUksYUFBYSxJQUFJLGFBQWEsQ0FBQyxNQUFNLElBQUksYUFBYSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7SUFFdEgsSUFBSSxDQUFDLFlBQVksSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3RDLE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFRCxJQUFJLENBQUMsWUFBWSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDdEMsT0FBTyxZQUFZLElBQUksY0FBYyxJQUFJLFNBQVMsQ0FBQztJQUNwRCxDQUFDO0lBRUQsSUFBSSxXQUFXLEdBQXFCLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDeEQseUNBQXlDO0lBQ3pDLFdBQVcsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFDMUUsV0FBVyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFFbEYsT0FBTyxXQUFXLENBQUM7QUFDcEIsQ0FBQztBQUVELE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxVQUFrQyxFQUFFLE1BQWM7SUFDckYsSUFBSSxVQUFVLENBQUMsY0FBYyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDO1FBQ2hGLE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVELElBQUksVUFBVSxDQUFDLGNBQWMsSUFBSSxVQUFVLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUM5RCxJQUFJLFVBQVUsQ0FBQyxjQUFjLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDaEYsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBRUQseUdBQXlHO1FBQ3pHLElBQUksVUFBVSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDakMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLGFBQWEsSUFBSSxVQUFVLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRTtnQkFDdkUsTUFBTSxVQUFVLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7Z0JBQ3BDLElBQUksT0FBTyxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLEVBQUUsQ0FBQztvQkFDakQsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDLENBQUM7b0JBQ25ELE9BQU8sQ0FBQyxFQUFFLENBQUMsY0FBYyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ3ZFLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxPQUFPLEtBQUssQ0FBQztnQkFDZCxDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDYixDQUFDO0FBRUQsTUFBTSxDQUFOLElBQVksZUFRWDtBQVJELFdBQVksZUFBZTtJQUMxQiwyRUFBbUIsQ0FBQTtJQUNuQiwyRUFBZSxDQUFBO0lBQ2YseUVBQWMsQ0FBQTtJQUNkLHlFQUFjLENBQUE7SUFDZCx5RUFBYyxDQUFBO0lBQ2QsdURBQUssQ0FBQTtJQUNMLDZEQUFRLENBQUE7QUFDVCxDQUFDLEVBUlcsZUFBZSxLQUFmLGVBQWUsUUFRMUI7QUFFRCxNQUFNLE9BQU8sV0FBWSxTQUFRLEtBQUs7SUFDckMsWUFBWSxPQUFlLEVBQVcsSUFBc0I7UUFDM0QsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRHNCLFNBQUksR0FBSixJQUFJLENBQWtCO0lBRTVELENBQUM7Q0FDRDtBQUVELE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxLQUFZO0lBQ2xELE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUM7SUFFL0IsSUFBSSxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ2hDLE9BQU8sSUFBSSxXQUFXLENBQUMsUUFBUSxFQUFFLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBRUQsSUFBSSxDQUFDO1FBQ0osTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNyQyxPQUFPLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3ZELENBQUM7SUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQ1osT0FBTyxJQUFJLFdBQVcsQ0FBQyxRQUFRLEVBQUUsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3pELENBQUM7QUFDRixDQUFDO0FBRUQsTUFBTSxVQUFVLG9CQUFvQixDQUFDLFdBQXdCO0lBQzVELE1BQU0sT0FBTyxHQUFHLEVBQUUsT0FBTyxFQUFFLFdBQVcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUN6RSxPQUFPLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUMzQyxDQUFDO0FBeURELE1BQU0sVUFBVSwwQkFBMEIsQ0FBQyxHQUE4RDtJQUN4RyxtREFBbUQ7SUFDbkQsSUFBSyxHQUFXLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBRSxDQUFDO1FBQ25DLE9BQU8sSUFBSSxDQUFDO1FBQ1osbURBQW1EO0lBQ3BELENBQUM7U0FBTSxJQUFLLEdBQVcsQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDNUMsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO1NBQU0sQ0FBQztRQUNQLE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztBQUNGLENBQUM7QUFFRCxNQUFNLFVBQVUseUJBQXlCLENBQUMsR0FBOEI7SUFDdkUsT0FBTyxHQUFHLENBQUMsSUFBSSxLQUFLLFNBQVMsQ0FBQztBQUMvQixDQUFDO0FBRUQsTUFBTSxVQUFVLHFCQUFxQixDQUFDLEdBQWtDO0lBQ3ZFLE9BQU8sQ0FBQyxDQUF3QixHQUFJLENBQUMsSUFBSSxDQUFDO0FBQzNDLENBQUM7QUFFRCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsU0FBd0IsRUFBRSxnQkFBd0IsRUFBRSxLQUFLLEdBQUcsSUFBSTtJQUNsRyxNQUFNLFdBQVcsR0FBRyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDO0lBQ3pGLE9BQU8sS0FBSyxDQUFDLENBQUM7UUFDYixhQUFhLENBQUMsV0FBVyxFQUFFLGdCQUFnQixDQUFDLENBQUMsQ0FBQztRQUM5QyxJQUFJLENBQUMsS0FBSyxDQUFDLGdCQUFnQixFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBQzVDLENBQUM7QUFhRCxNQUFNLE9BQU8scUJBQXFCO0lBSWpDLFlBQVksSUFBWTtRQUN2QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztJQUNuQixDQUFDO0lBRUQsUUFBUSxDQUFDLEtBQXVCO1FBQy9CLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzFCLENBQUM7SUFFRCxTQUFTO1FBQ1IsT0FBTztZQUNOLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtZQUNmLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTztZQUNyQixVQUFVLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNO1NBQy9CLENBQUM7SUFDSCxDQUFDO0NBQ0Q7QUFFRDs7R0FFRztBQUNILE1BQU0sVUFBVSwwQkFBMEIsQ0FBQyxhQUEyQyxFQUFFLGFBQTJDO0lBQ2xJLE1BQU0sTUFBTSxHQUFHO1FBQ2QsR0FBRyxDQUFDLGFBQWEsSUFBSSxFQUFFLENBQUM7UUFDeEIsR0FBRyxDQUFDLGFBQWEsSUFBSSxFQUFFLENBQUM7S0FDeEIsQ0FBQztJQUVGLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7U0FDeEIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQ2IsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzFCLE9BQU8sT0FBTyxLQUFLLEtBQUssU0FBUyxJQUFJLEtBQUssQ0FBQztJQUM1QyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxNQUFNLE9BQU8sZUFBZTtJQU8zQixZQUFZLE1BQW9CLEVBQUUsV0FBeUI7UUFGbkQsNkJBQXdCLEdBQWlDLElBQUksQ0FBQztRQUdyRSwwRUFBMEU7UUFDMUUsSUFBSSxDQUFDLGtCQUFrQixHQUFHLFdBQVcsQ0FBQyxjQUFjLEVBQUUsR0FBRyxDQUFDLGNBQWMsQ0FBQyxFQUFFO1lBQzFFLE9BQU87Z0JBQ04sR0FBRyxDQUFDLE1BQU0sQ0FBQyxjQUFjLElBQUksRUFBRSxDQUFDO2dCQUNoQyxHQUFHLENBQUMsY0FBYyxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUM7YUFDTixDQUFDO1FBQzlCLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUVULElBQUksSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUMxQyw4RUFBOEU7WUFDOUUsSUFBSSxDQUFDLGtCQUFrQixHQUFHLENBQUMsTUFBTSxDQUFDLGNBQWMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUN6RCxDQUFDO1FBRUQsSUFBSSxDQUFDLHdCQUF3QixHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFaEYsb0VBQW9FO1FBQ3BFLElBQUksaUJBQWlCLEdBQWlDLE1BQU0sQ0FBQyxjQUFjLENBQUM7UUFDNUUsSUFBSSxXQUFXLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDaEMsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO2dCQUN2QixpQkFBaUIsR0FBRztvQkFDbkIsR0FBRyxpQkFBaUI7b0JBQ3BCLEdBQUcsV0FBVyxDQUFDLGNBQWM7aUJBQzdCLENBQUM7WUFDSCxDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsaUJBQWlCLEdBQUcsV0FBVyxDQUFDLGNBQWMsQ0FBQztZQUNoRCxDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUN2QixJQUFJLENBQUMsd0JBQXdCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQy9ELENBQUM7SUFDRixDQUFDO0lBRU8sNEJBQTRCLENBQUMsUUFBZ0IsRUFBRSxRQUE0QixFQUFFLFVBQXNDO1FBQzFILG1FQUFtRTtRQUNuRSxJQUFJLE1BQU0sR0FBa0IsSUFBSSxDQUFDO1FBRWpDLEtBQUssTUFBTSxhQUFhLElBQUksSUFBSSxDQUFDLHdCQUF3QixFQUFFLENBQUM7WUFFM0QsNkJBQTZCO1lBQzdCLE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBRWpFLElBQUksT0FBTyxVQUFVLEtBQUssUUFBUSxFQUFFLENBQUM7Z0JBQ3BDLE1BQU0sR0FBRyxVQUFVLENBQUM7Z0JBQ3BCLE1BQU07WUFDUCxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQUdELG1CQUFtQixDQUFDLFFBQWdCLEVBQUUsUUFBaUIsRUFBRSxVQUFzQztRQUM5RixJQUFJLElBQUksQ0FBQyx3QkFBd0IsSUFBSSxJQUFJLENBQUMsNEJBQTRCLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxVQUFVLENBQUMsRUFBRSxDQUFDO1lBQ3hHLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVEOztPQUVHO0lBQ0gsbUJBQW1CLENBQUMsUUFBZ0IsRUFBRSxRQUFpQixFQUFFLFVBQXNDO1FBQzlGLElBQUksSUFBSSxDQUFDLHdCQUF3QixJQUFJLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxFQUFFLENBQUM7WUFDeEcsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsd0JBQXdCLElBQUksQ0FBQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxVQUFVLENBQUMsRUFBRSxDQUFDO1lBQ3JHLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVEOzs7T0FHRztJQUNILGVBQWUsQ0FBQyxRQUFnQixFQUFFLFFBQWlCLEVBQUUsVUFBeUQ7UUFFN0csTUFBTSxVQUFVLEdBQUcsR0FBRyxFQUFFO1lBQ3ZCLE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLENBQUM7Z0JBQ3JDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDbkUsSUFBSSxDQUFDO1FBQ1AsQ0FBQyxDQUFDO1FBRUYsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDeEQsTUFBTSxRQUFRLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDbkQsSUFBSSxVQUFVLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztnQkFDMUIsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFO29CQUMvQixJQUFJLFFBQVEsRUFBRSxDQUFDO3dCQUNkLE9BQU8sS0FBSyxDQUFDO29CQUNkLENBQUM7b0JBRUQsT0FBTyxVQUFVLEVBQUUsQ0FBQztnQkFDckIsQ0FBQyxDQUFDLENBQUM7WUFDSixDQUFDO1lBRUQsT0FBTyxVQUFVLEVBQUUsQ0FBQztRQUVyQixDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUdqQyxDQUFDO0lBRUQsd0JBQXdCO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztJQUMvRixDQUFDO0NBQ0Q7QUFFRCxTQUFTLGlCQUFpQixDQUFDLE9BQXlCO0lBQ25ELEtBQUssTUFBTSxHQUFHLElBQUksT0FBTyxFQUFFLENBQUM7UUFDM0IsSUFBSSxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUN2QyxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7SUFDRixDQUFDO0lBRUQsT0FBTyxLQUFLLENBQUM7QUFDZCxDQUFDO0FBRUQsTUFBTSxVQUFVLG1CQUFtQixDQUFDLFVBQW9DO0lBQ3ZFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNqQixPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsSUFBSSxRQUF1QyxDQUFDO0lBQzVDLE9BQU8sQ0FBQyxJQUFZLEVBQUUsRUFBRTtRQUN2QixJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDZixRQUFRLEdBQUcsQ0FBQyxVQUFVLEVBQUUsSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2lCQUM5QyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDN0MsQ0FBQztRQUNELE9BQU8sUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMxQyxDQUFDLENBQUM7QUFDSCxDQUFDO0FBRUQsTUFBTSxVQUFVLFlBQVksQ0FBQyxVQUEyQjtJQUN2RCxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDakIsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVELElBQUksUUFBOEIsQ0FBQztJQUNuQyxPQUFPLENBQUMsSUFBWSxFQUFFLEVBQUU7UUFDdkIsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2YsTUFBTSxJQUFJLEdBQUcsVUFBVSxFQUFFLENBQUM7WUFDMUIsUUFBUSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDeEMsQ0FBQztRQUNELE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN6QixDQUFDLENBQUM7QUFDSCxDQUFDO0FBRUQsU0FBUyxTQUFTLENBQUMsSUFBYztJQUNoQyxNQUFNLEdBQUcsR0FBeUIsRUFBRSxDQUFDO0lBQ3JDLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7UUFDeEIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQztJQUNqQixDQUFDO0lBQ0QsT0FBTyxHQUFHLENBQUM7QUFDWixDQUFDO0FBRUQsTUFBTSxVQUFVLG9CQUFvQixDQUFDLGlCQUFzRTtJQUMxRyxPQUFPLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzFFLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3ZCO2dCQUNDLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTztnQkFDeEIsT0FBTyxFQUFFLE9BQU87YUFDaEIsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO0lBQ2QsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxNQUFNLENBQUMsTUFBTSxtQ0FBbUMsR0FBRztJQUNsRCxVQUFVLEVBQUUsR0FBRztJQUNmLFlBQVksRUFBRSxLQUFLO0NBQ25CLENBQUMifQ==