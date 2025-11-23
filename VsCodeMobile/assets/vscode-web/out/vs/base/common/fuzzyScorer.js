/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { compareAnything } from './comparers.js';
import { createMatches as createFuzzyMatches, fuzzyScore, isUpper, matchesPrefix } from './filters.js';
import { hash } from './hash.js';
import { sep } from './path.js';
import { isLinux, isWindows } from './platform.js';
import { equalsIgnoreCase } from './strings.js';
const NO_MATCH = 0;
const NO_SCORE = [NO_MATCH, []];
// const DEBUG = true;
// const DEBUG_MATRIX = false;
export function scoreFuzzy(target, query, queryLower, allowNonContiguousMatches) {
    if (!target || !query) {
        return NO_SCORE; // return early if target or query are undefined
    }
    const targetLength = target.length;
    const queryLength = query.length;
    if (targetLength < queryLength) {
        return NO_SCORE; // impossible for query to be contained in target
    }
    // if (DEBUG) {
    // 	console.group(`Target: ${target}, Query: ${query}`);
    // }
    const targetLower = target.toLowerCase();
    const res = doScoreFuzzy(query, queryLower, queryLength, target, targetLower, targetLength, allowNonContiguousMatches);
    // if (DEBUG) {
    // 	console.log(`%cFinal Score: ${res[0]}`, 'font-weight: bold');
    // 	console.groupEnd();
    // }
    return res;
}
function doScoreFuzzy(query, queryLower, queryLength, target, targetLower, targetLength, allowNonContiguousMatches) {
    const scores = [];
    const matches = [];
    //
    // Build Scorer Matrix:
    //
    // The matrix is composed of query q and target t. For each index we score
    // q[i] with t[i] and compare that with the previous score. If the score is
    // equal or larger, we keep the match. In addition to the score, we also keep
    // the length of the consecutive matches to use as boost for the score.
    //
    //      t   a   r   g   e   t
    //  q
    //  u
    //  e
    //  r
    //  y
    //
    for (let queryIndex = 0; queryIndex < queryLength; queryIndex++) {
        const queryIndexOffset = queryIndex * targetLength;
        const queryIndexPreviousOffset = queryIndexOffset - targetLength;
        const queryIndexGtNull = queryIndex > 0;
        const queryCharAtIndex = query[queryIndex];
        const queryLowerCharAtIndex = queryLower[queryIndex];
        for (let targetIndex = 0; targetIndex < targetLength; targetIndex++) {
            const targetIndexGtNull = targetIndex > 0;
            const currentIndex = queryIndexOffset + targetIndex;
            const leftIndex = currentIndex - 1;
            const diagIndex = queryIndexPreviousOffset + targetIndex - 1;
            const leftScore = targetIndexGtNull ? scores[leftIndex] : 0;
            const diagScore = queryIndexGtNull && targetIndexGtNull ? scores[diagIndex] : 0;
            const matchesSequenceLength = queryIndexGtNull && targetIndexGtNull ? matches[diagIndex] : 0;
            // If we are not matching on the first query character any more, we only produce a
            // score if we had a score previously for the last query index (by looking at the diagScore).
            // This makes sure that the query always matches in sequence on the target. For example
            // given a target of "ede" and a query of "de", we would otherwise produce a wrong high score
            // for query[1] ("e") matching on target[0] ("e") because of the "beginning of word" boost.
            let score;
            if (!diagScore && queryIndexGtNull) {
                score = 0;
            }
            else {
                score = computeCharScore(queryCharAtIndex, queryLowerCharAtIndex, target, targetLower, targetIndex, matchesSequenceLength);
            }
            // We have a score and its equal or larger than the left score
            // Match: sequence continues growing from previous diag value
            // Score: increases by diag score value
            const isValidScore = score && diagScore + score >= leftScore;
            if (isValidScore && (
            // We don't need to check if it's contiguous if we allow non-contiguous matches
            allowNonContiguousMatches ||
                // We must be looking for a contiguous match.
                // Looking at an index higher than 0 in the query means we must have already
                // found out this is contiguous otherwise there wouldn't have been a score
                queryIndexGtNull ||
                // lastly check if the query is completely contiguous at this index in the target
                targetLower.startsWith(queryLower, targetIndex))) {
                matches[currentIndex] = matchesSequenceLength + 1;
                scores[currentIndex] = diagScore + score;
            }
            // We either have no score or the score is lower than the left score
            // Match: reset to 0
            // Score: pick up from left hand side
            else {
                matches[currentIndex] = NO_MATCH;
                scores[currentIndex] = leftScore;
            }
        }
    }
    // Restore Positions (starting from bottom right of matrix)
    const positions = [];
    let queryIndex = queryLength - 1;
    let targetIndex = targetLength - 1;
    while (queryIndex >= 0 && targetIndex >= 0) {
        const currentIndex = queryIndex * targetLength + targetIndex;
        const match = matches[currentIndex];
        if (match === NO_MATCH) {
            targetIndex--; // go left
        }
        else {
            positions.push(targetIndex);
            // go up and left
            queryIndex--;
            targetIndex--;
        }
    }
    // Print matrix
    // if (DEBUG_MATRIX) {
    // 	printMatrix(query, target, matches, scores);
    // }
    return [scores[queryLength * targetLength - 1], positions.reverse()];
}
function computeCharScore(queryCharAtIndex, queryLowerCharAtIndex, target, targetLower, targetIndex, matchesSequenceLength) {
    let score = 0;
    if (!considerAsEqual(queryLowerCharAtIndex, targetLower[targetIndex])) {
        return score; // no match of characters
    }
    // if (DEBUG) {
    // 	console.groupCollapsed(`%cFound a match of char: ${queryLowerCharAtIndex} at index ${targetIndex}`, 'font-weight: normal');
    // }
    // Character match bonus
    score += 1;
    // if (DEBUG) {
    // 	console.log(`%cCharacter match bonus: +1`, 'font-weight: normal');
    // }
    // Consecutive match bonus: sequences up to 3 get the full bonus (6)
    // and the remainder gets half the bonus (3). This helps reduce the
    // overall boost for long sequence matches.
    if (matchesSequenceLength > 0) {
        score += (Math.min(matchesSequenceLength, 3) * 6) + (Math.max(0, matchesSequenceLength - 3) * 3);
        // if (DEBUG) {
        // 	console.log(`Consecutive match bonus: +${matchesSequenceLength * 5}`);
        // }
    }
    // Same case bonus
    if (queryCharAtIndex === target[targetIndex]) {
        score += 1;
        // if (DEBUG) {
        // 	console.log('Same case bonus: +1');
        // }
    }
    // Start of word bonus
    if (targetIndex === 0) {
        score += 8;
        // if (DEBUG) {
        // 	console.log('Start of word bonus: +8');
        // }
    }
    else {
        // After separator bonus
        const separatorBonus = scoreSeparatorAtPos(target.charCodeAt(targetIndex - 1));
        if (separatorBonus) {
            score += separatorBonus;
            // if (DEBUG) {
            // 	console.log(`After separator bonus: +${separatorBonus}`);
            // }
        }
        // Inside word upper case bonus (camel case). We only give this bonus if we're not in a contiguous sequence.
        // For example:
        // NPE => NullPointerException = boost
        // HTTP => HTTP = not boost
        else if (isUpper(target.charCodeAt(targetIndex)) && matchesSequenceLength === 0) {
            score += 2;
            // if (DEBUG) {
            // 	console.log('Inside word upper case bonus: +2');
            // }
        }
    }
    // if (DEBUG) {
    // 	console.log(`Total score: ${score}`);
    // 	console.groupEnd();
    // }
    return score;
}
function considerAsEqual(a, b) {
    if (a === b) {
        return true;
    }
    // Special case path separators: ignore platform differences
    if (a === '/' || a === '\\') {
        return b === '/' || b === '\\';
    }
    return false;
}
function scoreSeparatorAtPos(charCode) {
    switch (charCode) {
        case 47 /* CharCode.Slash */:
        case 92 /* CharCode.Backslash */:
            return 5; // prefer path separators...
        case 95 /* CharCode.Underline */:
        case 45 /* CharCode.Dash */:
        case 46 /* CharCode.Period */:
        case 32 /* CharCode.Space */:
        case 39 /* CharCode.SingleQuote */:
        case 34 /* CharCode.DoubleQuote */:
        case 58 /* CharCode.Colon */:
            return 4; // ...over other separators
        default:
            return 0;
    }
}
const NO_SCORE2 = [undefined, []];
export function scoreFuzzy2(target, query, patternStart = 0, wordStart = 0) {
    // Score: multiple inputs
    const preparedQuery = query;
    if (preparedQuery.values && preparedQuery.values.length > 1) {
        return doScoreFuzzy2Multiple(target, preparedQuery.values, patternStart, wordStart);
    }
    // Score: single input
    return doScoreFuzzy2Single(target, query, patternStart, wordStart);
}
function doScoreFuzzy2Multiple(target, query, patternStart, wordStart) {
    let totalScore = 0;
    const totalMatches = [];
    for (const queryPiece of query) {
        const [score, matches] = doScoreFuzzy2Single(target, queryPiece, patternStart, wordStart);
        if (typeof score !== 'number') {
            // if a single query value does not match, return with
            // no score entirely, we require all queries to match
            return NO_SCORE2;
        }
        totalScore += score;
        totalMatches.push(...matches);
    }
    // if we have a score, ensure that the positions are
    // sorted in ascending order and distinct
    return [totalScore, normalizeMatches(totalMatches)];
}
function doScoreFuzzy2Single(target, query, patternStart, wordStart) {
    const score = fuzzyScore(query.original, query.originalLowercase, patternStart, target, target.toLowerCase(), wordStart, { firstMatchCanBeWeak: true, boostFullMatch: true });
    if (!score) {
        return NO_SCORE2;
    }
    return [score[0], createFuzzyMatches(score)];
}
const NO_ITEM_SCORE = Object.freeze({ score: 0 });
const PATH_IDENTITY_SCORE = 1 << 18;
const LABEL_PREFIX_SCORE_THRESHOLD = 1 << 17;
const LABEL_SCORE_THRESHOLD = 1 << 16;
function getCacheHash(label, description, allowNonContiguousMatches, query) {
    const values = query.values ? query.values : [query];
    const cacheHash = hash({
        [query.normalized]: {
            values: values.map(v => ({ value: v.normalized, expectContiguousMatch: v.expectContiguousMatch })),
            label,
            description,
            allowNonContiguousMatches
        }
    });
    return cacheHash;
}
export function scoreItemFuzzy(item, query, allowNonContiguousMatches, accessor, cache) {
    if (!item || !query.normalized) {
        return NO_ITEM_SCORE; // we need an item and query to score on at least
    }
    const label = accessor.getItemLabel(item);
    if (!label) {
        return NO_ITEM_SCORE; // we need a label at least
    }
    const description = accessor.getItemDescription(item);
    // in order to speed up scoring, we cache the score with a unique hash based on:
    // - label
    // - description (if provided)
    // - whether non-contiguous matching is enabled or not
    // - hash of the query (normalized) values
    const cacheHash = getCacheHash(label, description, allowNonContiguousMatches, query);
    const cached = cache[cacheHash];
    if (cached) {
        return cached;
    }
    const itemScore = doScoreItemFuzzy(label, description, accessor.getItemPath(item), query, allowNonContiguousMatches);
    cache[cacheHash] = itemScore;
    return itemScore;
}
function doScoreItemFuzzy(label, description, path, query, allowNonContiguousMatches) {
    const preferLabelMatches = !path || !query.containsPathSeparator;
    // Treat identity matches on full path highest
    if (path && (isLinux ? query.pathNormalized === path : equalsIgnoreCase(query.pathNormalized, path))) {
        return { score: PATH_IDENTITY_SCORE, labelMatch: [{ start: 0, end: label.length }], descriptionMatch: description ? [{ start: 0, end: description.length }] : undefined };
    }
    // Score: multiple inputs
    if (query.values && query.values.length > 1) {
        return doScoreItemFuzzyMultiple(label, description, path, query.values, preferLabelMatches, allowNonContiguousMatches);
    }
    // Score: single input
    return doScoreItemFuzzySingle(label, description, path, query, preferLabelMatches, allowNonContiguousMatches);
}
function doScoreItemFuzzyMultiple(label, description, path, query, preferLabelMatches, allowNonContiguousMatches) {
    let totalScore = 0;
    const totalLabelMatches = [];
    const totalDescriptionMatches = [];
    for (const queryPiece of query) {
        const { score, labelMatch, descriptionMatch } = doScoreItemFuzzySingle(label, description, path, queryPiece, preferLabelMatches, allowNonContiguousMatches);
        if (score === NO_MATCH) {
            // if a single query value does not match, return with
            // no score entirely, we require all queries to match
            return NO_ITEM_SCORE;
        }
        totalScore += score;
        if (labelMatch) {
            totalLabelMatches.push(...labelMatch);
        }
        if (descriptionMatch) {
            totalDescriptionMatches.push(...descriptionMatch);
        }
    }
    // if we have a score, ensure that the positions are
    // sorted in ascending order and distinct
    return {
        score: totalScore,
        labelMatch: normalizeMatches(totalLabelMatches),
        descriptionMatch: normalizeMatches(totalDescriptionMatches)
    };
}
function doScoreItemFuzzySingle(label, description, path, query, preferLabelMatches, allowNonContiguousMatches) {
    // Prefer label matches if told so or we have no description
    if (preferLabelMatches || !description) {
        const [labelScore, labelPositions] = scoreFuzzy(label, query.normalized, query.normalizedLowercase, allowNonContiguousMatches && !query.expectContiguousMatch);
        if (labelScore) {
            // If we have a prefix match on the label, we give a much
            // higher baseScore to elevate these matches over others
            // This ensures that typing a file name wins over results
            // that are present somewhere in the label, but not the
            // beginning.
            const labelPrefixMatch = matchesPrefix(query.normalized, label);
            let baseScore;
            if (labelPrefixMatch) {
                baseScore = LABEL_PREFIX_SCORE_THRESHOLD;
                // We give another boost to labels that are short, e.g. given
                // files "window.ts" and "windowActions.ts" and a query of
                // "window", we want "window.ts" to receive a higher score.
                // As such we compute the percentage the query has within the
                // label and add that to the baseScore.
                const prefixLengthBoost = Math.round((query.normalized.length / label.length) * 100);
                baseScore += prefixLengthBoost;
            }
            else {
                baseScore = LABEL_SCORE_THRESHOLD;
            }
            return { score: baseScore + labelScore, labelMatch: labelPrefixMatch || createMatches(labelPositions) };
        }
    }
    // Finally compute description + label scores if we have a description
    if (description) {
        let descriptionPrefix = description;
        if (!!path) {
            descriptionPrefix = `${description}${sep}`; // assume this is a file path
        }
        const descriptionPrefixLength = descriptionPrefix.length;
        const descriptionAndLabel = `${descriptionPrefix}${label}`;
        const [labelDescriptionScore, labelDescriptionPositions] = scoreFuzzy(descriptionAndLabel, query.normalized, query.normalizedLowercase, allowNonContiguousMatches && !query.expectContiguousMatch);
        if (labelDescriptionScore) {
            const labelDescriptionMatches = createMatches(labelDescriptionPositions);
            const labelMatch = [];
            const descriptionMatch = [];
            // We have to split the matches back onto the label and description portions
            labelDescriptionMatches.forEach(h => {
                // Match overlaps label and description part, we need to split it up
                if (h.start < descriptionPrefixLength && h.end > descriptionPrefixLength) {
                    labelMatch.push({ start: 0, end: h.end - descriptionPrefixLength });
                    descriptionMatch.push({ start: h.start, end: descriptionPrefixLength });
                }
                // Match on label part
                else if (h.start >= descriptionPrefixLength) {
                    labelMatch.push({ start: h.start - descriptionPrefixLength, end: h.end - descriptionPrefixLength });
                }
                // Match on description part
                else {
                    descriptionMatch.push(h);
                }
            });
            return { score: labelDescriptionScore, labelMatch, descriptionMatch };
        }
    }
    return NO_ITEM_SCORE;
}
function createMatches(offsets) {
    const ret = [];
    if (!offsets) {
        return ret;
    }
    let last;
    for (const pos of offsets) {
        if (last && last.end === pos) {
            last.end += 1;
        }
        else {
            last = { start: pos, end: pos + 1 };
            ret.push(last);
        }
    }
    return ret;
}
function normalizeMatches(matches) {
    // sort matches by start to be able to normalize
    const sortedMatches = matches.sort((matchA, matchB) => {
        return matchA.start - matchB.start;
    });
    // merge matches that overlap
    const normalizedMatches = [];
    let currentMatch = undefined;
    for (const match of sortedMatches) {
        // if we have no current match or the matches
        // do not overlap, we take it as is and remember
        // it for future merging
        if (!currentMatch || !matchOverlaps(currentMatch, match)) {
            currentMatch = match;
            normalizedMatches.push(match);
        }
        // otherwise we merge the matches
        else {
            currentMatch.start = Math.min(currentMatch.start, match.start);
            currentMatch.end = Math.max(currentMatch.end, match.end);
        }
    }
    return normalizedMatches;
}
function matchOverlaps(matchA, matchB) {
    if (matchA.end < matchB.start) {
        return false; // A ends before B starts
    }
    if (matchB.end < matchA.start) {
        return false; // B ends before A starts
    }
    return true;
}
//#endregion
//#region Comparers
export function compareItemsByFuzzyScore(itemA, itemB, query, allowNonContiguousMatches, accessor, cache) {
    const itemScoreA = scoreItemFuzzy(itemA, query, allowNonContiguousMatches, accessor, cache);
    const itemScoreB = scoreItemFuzzy(itemB, query, allowNonContiguousMatches, accessor, cache);
    const scoreA = itemScoreA.score;
    const scoreB = itemScoreB.score;
    // 1.) identity matches have highest score
    if (scoreA === PATH_IDENTITY_SCORE || scoreB === PATH_IDENTITY_SCORE) {
        if (scoreA !== scoreB) {
            return scoreA === PATH_IDENTITY_SCORE ? -1 : 1;
        }
    }
    // 2.) matches on label are considered higher compared to label+description matches
    if (scoreA > LABEL_SCORE_THRESHOLD || scoreB > LABEL_SCORE_THRESHOLD) {
        if (scoreA !== scoreB) {
            return scoreA > scoreB ? -1 : 1;
        }
        // prefer more compact matches over longer in label (unless this is a prefix match where
        // longer prefix matches are actually preferred)
        if (scoreA < LABEL_PREFIX_SCORE_THRESHOLD && scoreB < LABEL_PREFIX_SCORE_THRESHOLD) {
            const comparedByMatchLength = compareByMatchLength(itemScoreA.labelMatch, itemScoreB.labelMatch);
            if (comparedByMatchLength !== 0) {
                return comparedByMatchLength;
            }
        }
        // prefer shorter labels over longer labels
        const labelA = accessor.getItemLabel(itemA) || '';
        const labelB = accessor.getItemLabel(itemB) || '';
        if (labelA.length !== labelB.length) {
            return labelA.length - labelB.length;
        }
    }
    // 3.) compare by score in label+description
    if (scoreA !== scoreB) {
        return scoreA > scoreB ? -1 : 1;
    }
    // 4.) scores are identical: prefer matches in label over non-label matches
    const itemAHasLabelMatches = Array.isArray(itemScoreA.labelMatch) && itemScoreA.labelMatch.length > 0;
    const itemBHasLabelMatches = Array.isArray(itemScoreB.labelMatch) && itemScoreB.labelMatch.length > 0;
    if (itemAHasLabelMatches && !itemBHasLabelMatches) {
        return -1;
    }
    else if (itemBHasLabelMatches && !itemAHasLabelMatches) {
        return 1;
    }
    // 5.) scores are identical: prefer more compact matches (label and description)
    const itemAMatchDistance = computeLabelAndDescriptionMatchDistance(itemA, itemScoreA, accessor);
    const itemBMatchDistance = computeLabelAndDescriptionMatchDistance(itemB, itemScoreB, accessor);
    if (itemAMatchDistance && itemBMatchDistance && itemAMatchDistance !== itemBMatchDistance) {
        return itemBMatchDistance > itemAMatchDistance ? -1 : 1;
    }
    // 6.) scores are identical: start to use the fallback compare
    return fallbackCompare(itemA, itemB, query, accessor);
}
function computeLabelAndDescriptionMatchDistance(item, score, accessor) {
    let matchStart = -1;
    let matchEnd = -1;
    // If we have description matches, the start is first of description match
    if (score.descriptionMatch?.length) {
        matchStart = score.descriptionMatch[0].start;
    }
    // Otherwise, the start is the first label match
    else if (score.labelMatch?.length) {
        matchStart = score.labelMatch[0].start;
    }
    // If we have label match, the end is the last label match
    // If we had a description match, we add the length of the description
    // as offset to the end to indicate this.
    if (score.labelMatch?.length) {
        matchEnd = score.labelMatch[score.labelMatch.length - 1].end;
        if (score.descriptionMatch?.length) {
            const itemDescription = accessor.getItemDescription(item);
            if (itemDescription) {
                matchEnd += itemDescription.length;
            }
        }
    }
    // If we have just a description match, the end is the last description match
    else if (score.descriptionMatch?.length) {
        matchEnd = score.descriptionMatch[score.descriptionMatch.length - 1].end;
    }
    return matchEnd - matchStart;
}
function compareByMatchLength(matchesA, matchesB) {
    if ((!matchesA && !matchesB) || ((!matchesA?.length) && (!matchesB?.length))) {
        return 0; // make sure to not cause bad comparing when matches are not provided
    }
    if (!matchesB?.length) {
        return -1;
    }
    if (!matchesA?.length) {
        return 1;
    }
    // Compute match length of A (first to last match)
    const matchStartA = matchesA[0].start;
    const matchEndA = matchesA[matchesA.length - 1].end;
    const matchLengthA = matchEndA - matchStartA;
    // Compute match length of B (first to last match)
    const matchStartB = matchesB[0].start;
    const matchEndB = matchesB[matchesB.length - 1].end;
    const matchLengthB = matchEndB - matchStartB;
    // Prefer shorter match length
    return matchLengthA === matchLengthB ? 0 : matchLengthB < matchLengthA ? 1 : -1;
}
function fallbackCompare(itemA, itemB, query, accessor) {
    // check for label + description length and prefer shorter
    const labelA = accessor.getItemLabel(itemA) || '';
    const labelB = accessor.getItemLabel(itemB) || '';
    const descriptionA = accessor.getItemDescription(itemA);
    const descriptionB = accessor.getItemDescription(itemB);
    const labelDescriptionALength = labelA.length + (descriptionA ? descriptionA.length : 0);
    const labelDescriptionBLength = labelB.length + (descriptionB ? descriptionB.length : 0);
    if (labelDescriptionALength !== labelDescriptionBLength) {
        return labelDescriptionALength - labelDescriptionBLength;
    }
    // check for path length and prefer shorter
    const pathA = accessor.getItemPath(itemA);
    const pathB = accessor.getItemPath(itemB);
    if (pathA && pathB && pathA.length !== pathB.length) {
        return pathA.length - pathB.length;
    }
    // 7.) finally we have equal scores and equal length, we fallback to comparer
    // compare by label
    if (labelA !== labelB) {
        return compareAnything(labelA, labelB, query.normalized);
    }
    // compare by description
    if (descriptionA && descriptionB && descriptionA !== descriptionB) {
        return compareAnything(descriptionA, descriptionB, query.normalized);
    }
    // compare by path
    if (pathA && pathB && pathA !== pathB) {
        return compareAnything(pathA, pathB, query.normalized);
    }
    // equal
    return 0;
}
/*
 * If a query is wrapped in quotes, the user does not want to
 * use fuzzy search for this query.
 */
function queryExpectsExactMatch(query) {
    return query.startsWith('"') && query.endsWith('"');
}
/**
 * Helper function to prepare a search value for scoring by removing unwanted characters
 * and allowing to score on multiple pieces separated by whitespace character.
 */
const MULTIPLE_QUERY_VALUES_SEPARATOR = ' ';
export function prepareQuery(original) {
    if (typeof original !== 'string') {
        original = '';
    }
    const originalLowercase = original.toLowerCase();
    const { pathNormalized, normalized, normalizedLowercase } = normalizeQuery(original);
    const containsPathSeparator = pathNormalized.indexOf(sep) >= 0;
    const expectExactMatch = queryExpectsExactMatch(original);
    let values = undefined;
    const originalSplit = original.split(MULTIPLE_QUERY_VALUES_SEPARATOR);
    if (originalSplit.length > 1) {
        for (const originalPiece of originalSplit) {
            const expectExactMatchPiece = queryExpectsExactMatch(originalPiece);
            const { pathNormalized: pathNormalizedPiece, normalized: normalizedPiece, normalizedLowercase: normalizedLowercasePiece } = normalizeQuery(originalPiece);
            if (normalizedPiece) {
                if (!values) {
                    values = [];
                }
                values.push({
                    original: originalPiece,
                    originalLowercase: originalPiece.toLowerCase(),
                    pathNormalized: pathNormalizedPiece,
                    normalized: normalizedPiece,
                    normalizedLowercase: normalizedLowercasePiece,
                    expectContiguousMatch: expectExactMatchPiece
                });
            }
        }
    }
    return { original, originalLowercase, pathNormalized, normalized, normalizedLowercase, values, containsPathSeparator, expectContiguousMatch: expectExactMatch };
}
function normalizeQuery(original) {
    let pathNormalized;
    if (isWindows) {
        pathNormalized = original.replace(/\//g, sep); // Help Windows users to search for paths when using slash
    }
    else {
        pathNormalized = original.replace(/\\/g, sep); // Help macOS/Linux users to search for paths when using backslash
    }
    // remove certain characters that help find better results:
    // - quotes: are used for exact match search
    // - wildcards: are used for fuzzy matching
    // - whitespace: are used to separate queries
    // - ellipsis: sometimes used to indicate any path segments
    const normalized = pathNormalized.replace(/[\*\u2026\s"]/g, '');
    return {
        pathNormalized,
        normalized,
        normalizedLowercase: normalized.toLowerCase()
    };
}
export function pieceToQuery(arg1) {
    if (Array.isArray(arg1)) {
        return prepareQuery(arg1.map(piece => piece.original).join(MULTIPLE_QUERY_VALUES_SEPARATOR));
    }
    return prepareQuery(arg1.original);
}
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnV6enlTY29yZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vZnV6enlTY29yZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ2pELE9BQU8sRUFBRSxhQUFhLElBQUksa0JBQWtCLEVBQUUsVUFBVSxFQUFVLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFDL0csT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUNqQyxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQ2hDLE9BQU8sRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ25ELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQU9oRCxNQUFNLFFBQVEsR0FBRyxDQUFDLENBQUM7QUFDbkIsTUFBTSxRQUFRLEdBQWUsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFFNUMsc0JBQXNCO0FBQ3RCLDhCQUE4QjtBQUU5QixNQUFNLFVBQVUsVUFBVSxDQUFDLE1BQWMsRUFBRSxLQUFhLEVBQUUsVUFBa0IsRUFBRSx5QkFBa0M7SUFDL0csSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ3ZCLE9BQU8sUUFBUSxDQUFDLENBQUMsZ0RBQWdEO0lBQ2xFLENBQUM7SUFFRCxNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ25DLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFFakMsSUFBSSxZQUFZLEdBQUcsV0FBVyxFQUFFLENBQUM7UUFDaEMsT0FBTyxRQUFRLENBQUMsQ0FBQyxpREFBaUQ7SUFDbkUsQ0FBQztJQUVELGVBQWU7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