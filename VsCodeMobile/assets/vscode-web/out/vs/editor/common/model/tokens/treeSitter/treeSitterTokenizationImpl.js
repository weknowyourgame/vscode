/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { setTimeout0 } from '../../../../../base/common/platform.js';
import { StopWatch } from '../../../../../base/common/stopwatch.js';
import { findLikelyRelevantLines } from '../../textModelTokens.js';
import { TokenStore, TokenQuality } from './tokenStore.js';
import { autorun, autorunHandleChanges, recordChanges, runOnChange } from '../../../../../base/common/observable.js';
import { LineTokens } from '../../../tokens/lineTokens.js';
import { Position } from '../../../core/position.js';
import { Range } from '../../../core/range.js';
import { isDefined } from '../../../../../base/common/types.js';
import { ITreeSitterThemeService } from '../../../services/treeSitter/treeSitterThemeService.js';
import { BugIndicatingError } from '../../../../../base/common/errors.js';
let TreeSitterTokenizationImpl = class TreeSitterTokenizationImpl extends Disposable {
    get _textModel() {
        return this._tree.textModel;
    }
    constructor(_tree, _highlightingQueries, _languageIdCodec, _visibleLineRanges, _treeSitterThemeService) {
        super();
        this._tree = _tree;
        this._highlightingQueries = _highlightingQueries;
        this._languageIdCodec = _languageIdCodec;
        this._visibleLineRanges = _visibleLineRanges;
        this._treeSitterThemeService = _treeSitterThemeService;
        this._onDidChangeTokens = this._register(new Emitter());
        this.onDidChangeTokens = this._onDidChangeTokens.event;
        this._onDidCompleteBackgroundTokenization = this._register(new Emitter());
        this.onDidChangeBackgroundTokenization = this._onDidCompleteBackgroundTokenization.event;
        this._encodedLanguageId = this._languageIdCodec.encodeLanguageId(this._tree.languageId);
        this._register(runOnChange(this._treeSitterThemeService.onChange, () => {
            this._updateTheme();
        }));
        this._tokenStore = this._register(new TokenStore(this._textModel));
        this._accurateVersion = this._textModel.getVersionId();
        this._guessVersion = this._textModel.getVersionId();
        this._tokenStore.buildStore(this._createEmptyTokens(), TokenQuality.None);
        this._register(autorun(reader => {
            const visibleLineRanges = this._visibleLineRanges.read(reader);
            this._parseAndTokenizeViewPort(visibleLineRanges);
        }));
        this._register(autorunHandleChanges({
            owner: this,
            changeTracker: recordChanges({ tree: this._tree.tree }),
        }, (reader, ctx) => {
            const changeEvent = ctx.changes.at(0)?.change;
            if (ctx.changes.length > 1) {
                throw new BugIndicatingError('The tree changed twice in one transaction. This is currently not supported and should not happen.');
            }
            if (!changeEvent) {
                if (ctx.tree) {
                    this._firstTreeUpdate(this._tree.treeLastParsedVersion.read(reader));
                }
            }
            else {
                if (this.hasTokens()) {
                    // Mark the range for refresh immediately
                    for (const range of changeEvent.ranges) {
                        this._markForRefresh(range.newRange);
                    }
                }
                // First time we see a tree we need to build a token store.
                if (!this.hasTokens()) {
                    this._firstTreeUpdate(changeEvent.versionId);
                }
                else {
                    this._handleTreeUpdate(changeEvent.ranges, changeEvent.versionId);
                }
            }
        }));
    }
    handleContentChanged(e) {
        this._guessVersion = e.versionId;
        for (const change of e.changes) {
            if (change.text.length > change.rangeLength) {
                // If possible, use the token before the change as the starting point for the new token.
                // This is more likely to let the new text be the correct color as typeing is usually at the end of the token.
                const offset = change.rangeOffset > 0 ? change.rangeOffset - 1 : change.rangeOffset;
                const oldToken = this._tokenStore.getTokenAt(offset);
                let newToken;
                if (oldToken) {
                    // Insert. Just grow the token at this position to include the insert.
                    newToken = { startOffsetInclusive: oldToken.startOffsetInclusive, length: oldToken.length + change.text.length - change.rangeLength, token: oldToken.token };
                    // Also mark tokens that are in the range of the change as needing a refresh.
                    this._tokenStore.markForRefresh(offset, change.rangeOffset + (change.text.length > change.rangeLength ? change.text.length : change.rangeLength));
                }
                else {
                    // The document got larger and the change is at the end of the document.
                    newToken = { startOffsetInclusive: offset, length: change.text.length, token: 0 };
                }
                this._tokenStore.update(oldToken?.length ?? 0, [newToken], TokenQuality.EditGuess);
            }
            else if (change.text.length < change.rangeLength) {
                // Delete. Delete the tokens at the corresponding range.
                const deletedCharCount = change.rangeLength - change.text.length;
                this._tokenStore.delete(deletedCharCount, change.rangeOffset);
            }
        }
    }
    getLineTokens(lineNumber) {
        const content = this._textModel.getLineContent(lineNumber);
        const rawTokens = this.getTokens(lineNumber);
        return new LineTokens(rawTokens, content, this._languageIdCodec);
    }
    _createEmptyTokens() {
        const emptyToken = this._emptyToken();
        const modelEndOffset = this._textModel.getValueLength();
        const emptyTokens = [this._emptyTokensForOffsetAndLength(0, modelEndOffset, emptyToken)];
        return emptyTokens;
    }
    _emptyToken() {
        return this._treeSitterThemeService.findMetadata([], this._encodedLanguageId, false, undefined);
    }
    _emptyTokensForOffsetAndLength(offset, length, emptyToken) {
        return { token: emptyToken, length: offset + length, startOffsetInclusive: 0 };
    }
    hasAccurateTokensForLine(lineNumber) {
        return this.hasTokens(new Range(lineNumber, 1, lineNumber, this._textModel.getLineMaxColumn(lineNumber)));
    }
    tokenizeLinesAt(lineNumber, lines) {
        const rawLineTokens = this._guessTokensForLinesContent(lineNumber, lines);
        const lineTokens = [];
        if (!rawLineTokens) {
            return null;
        }
        for (let i = 0; i < rawLineTokens.length; i++) {
            lineTokens.push(new LineTokens(rawLineTokens[i], lines[i], this._languageIdCodec));
        }
        return lineTokens;
    }
    _rangeHasTokens(range, minimumTokenQuality) {
        return this._tokenStore.rangeHasTokens(this._textModel.getOffsetAt(range.getStartPosition()), this._textModel.getOffsetAt(range.getEndPosition()), minimumTokenQuality);
    }
    hasTokens(accurateForRange) {
        if (!accurateForRange || (this._guessVersion === this._accurateVersion)) {
            return true;
        }
        return !this._tokenStore.rangeNeedsRefresh(this._textModel.getOffsetAt(accurateForRange.getStartPosition()), this._textModel.getOffsetAt(accurateForRange.getEndPosition()));
    }
    getTokens(line) {
        const lineStartOffset = this._textModel.getOffsetAt({ lineNumber: line, column: 1 });
        const lineEndOffset = this._textModel.getOffsetAt({ lineNumber: line, column: this._textModel.getLineLength(line) + 1 });
        const lineTokens = this._tokenStore.getTokensInRange(lineStartOffset, lineEndOffset);
        const result = new Uint32Array(lineTokens.length * 2);
        for (let i = 0; i < lineTokens.length; i++) {
            result[i * 2] = lineTokens[i].startOffsetInclusive - lineStartOffset + lineTokens[i].length;
            result[i * 2 + 1] = lineTokens[i].token;
        }
        return result;
    }
    getTokensInRange(range, rangeStartOffset, rangeEndOffset, captures) {
        const tokens = captures ? this._tokenizeCapturesWithMetadata(captures, rangeStartOffset, rangeEndOffset) : this._tokenize(range, rangeStartOffset, rangeEndOffset);
        if (tokens?.endOffsetsAndMetadata) {
            return this._rangeTokensAsUpdates(rangeStartOffset, tokens.endOffsetsAndMetadata);
        }
        return undefined;
    }
    _updateTokensInStore(version, updates, tokenQuality) {
        this._accurateVersion = version;
        for (const update of updates) {
            const lastToken = update.newTokens.length > 0 ? update.newTokens[update.newTokens.length - 1] : undefined;
            let oldRangeLength;
            if (lastToken && (this._guessVersion >= version)) {
                oldRangeLength = lastToken.startOffsetInclusive + lastToken.length - update.newTokens[0].startOffsetInclusive;
            }
            else if (update.oldRangeLength) {
                oldRangeLength = update.oldRangeLength;
            }
            else {
                oldRangeLength = 0;
            }
            this._tokenStore.update(oldRangeLength, update.newTokens, tokenQuality);
        }
    }
    _markForRefresh(range) {
        this._tokenStore.markForRefresh(this._textModel.getOffsetAt(range.getStartPosition()), this._textModel.getOffsetAt(range.getEndPosition()));
    }
    _getNeedsRefresh() {
        const needsRefreshOffsetRanges = this._tokenStore.getNeedsRefresh();
        if (!needsRefreshOffsetRanges) {
            return [];
        }
        return needsRefreshOffsetRanges.map(range => ({
            range: Range.fromPositions(this._textModel.getPositionAt(range.startOffset), this._textModel.getPositionAt(range.endOffset)),
            startOffset: range.startOffset,
            endOffset: range.endOffset
        }));
    }
    _parseAndTokenizeViewPort(lineRanges) {
        const viewportRanges = lineRanges.map(r => r.toInclusiveRange()).filter(isDefined);
        for (const range of viewportRanges) {
            const startOffsetOfRangeInDocument = this._textModel.getOffsetAt(range.getStartPosition());
            const endOffsetOfRangeInDocument = this._textModel.getOffsetAt(range.getEndPosition());
            const version = this._textModel.getVersionId();
            if (this._rangeHasTokens(range, TokenQuality.ViewportGuess)) {
                continue;
            }
            const content = this._textModel.getValueInRange(range);
            const tokenUpdates = this._forceParseAndTokenizeContent(range, startOffsetOfRangeInDocument, endOffsetOfRangeInDocument, content, true);
            if (!tokenUpdates || this._rangeHasTokens(range, TokenQuality.ViewportGuess)) {
                continue;
            }
            if (tokenUpdates.length === 0) {
                continue;
            }
            const lastToken = tokenUpdates[tokenUpdates.length - 1];
            const oldRangeLength = lastToken.startOffsetInclusive + lastToken.length - tokenUpdates[0].startOffsetInclusive;
            this._updateTokensInStore(version, [{ newTokens: tokenUpdates, oldRangeLength }], TokenQuality.ViewportGuess);
            this._onDidChangeTokens.fire({ changes: { semanticTokensApplied: false, ranges: [{ fromLineNumber: range.startLineNumber, toLineNumber: range.endLineNumber }] } });
        }
    }
    _guessTokensForLinesContent(lineNumber, lines) {
        if (lines.length === 0) {
            return undefined;
        }
        const lineContent = lines.join(this._textModel.getEOL());
        const range = new Range(1, 1, lineNumber + lines.length, lines[lines.length - 1].length + 1);
        const startOffset = this._textModel.getOffsetAt({ lineNumber, column: 1 });
        const tokens = this._forceParseAndTokenizeContent(range, startOffset, startOffset + lineContent.length, lineContent, false);
        if (!tokens) {
            return undefined;
        }
        const tokensByLine = new Array(lines.length);
        let tokensIndex = 0;
        let tokenStartOffset = 0;
        let lineStartOffset = 0;
        for (let i = 0; i < lines.length; i++) {
            const tokensForLine = [];
            let moveToNextLine = false;
            for (let j = tokensIndex; (!moveToNextLine && (j < tokens.length)); j++) {
                const token = tokens[j];
                const lineAdjustedEndOffset = token.endOffset - lineStartOffset;
                const lineAdjustedStartOffset = tokenStartOffset - lineStartOffset;
                if (lineAdjustedEndOffset <= lines[i].length) {
                    tokensForLine.push({ endOffset: lineAdjustedEndOffset, metadata: token.metadata });
                    tokensIndex++;
                }
                else if (lineAdjustedStartOffset < lines[i].length) {
                    const partialToken = { endOffset: lines[i].length, metadata: token.metadata };
                    tokensForLine.push(partialToken);
                    moveToNextLine = true;
                }
                else {
                    moveToNextLine = true;
                }
                tokenStartOffset = token.endOffset;
            }
            tokensByLine[i] = this._endOffsetTokensToUint32Array(tokensForLine);
            lineStartOffset += lines[i].length + this._textModel.getEOL().length;
        }
        return tokensByLine;
    }
    _forceParseAndTokenizeContent(range, startOffsetOfRangeInDocument, endOffsetOfRangeInDocument, content, asUpdate) {
        const likelyRelevantLines = findLikelyRelevantLines(this._textModel, range.startLineNumber).likelyRelevantLines;
        const likelyRelevantPrefix = likelyRelevantLines.join(this._textModel.getEOL());
        const tree = this._tree.createParsedTreeSync(`${likelyRelevantPrefix}${content}`);
        if (!tree) {
            return;
        }
        const treeRange = new Range(1, 1, range.endLineNumber - range.startLineNumber + 1 + likelyRelevantLines.length, range.endColumn);
        const captures = this.captureAtRange(treeRange);
        const tokens = this._tokenizeCapturesWithMetadata(captures, likelyRelevantPrefix.length, endOffsetOfRangeInDocument - startOffsetOfRangeInDocument + likelyRelevantPrefix.length);
        tree.delete();
        if (!tokens) {
            return;
        }
        if (asUpdate) {
            return this._rangeTokensAsUpdates(startOffsetOfRangeInDocument, tokens.endOffsetsAndMetadata, likelyRelevantPrefix.length);
        }
        else {
            return tokens.endOffsetsAndMetadata;
        }
    }
    _firstTreeUpdate(versionId) {
        return this._setViewPortTokens(versionId);
    }
    _setViewPortTokens(versionId) {
        const rangeChanges = this._visibleLineRanges.get().map(lineRange => {
            const range = lineRange.toInclusiveRange();
            if (!range) {
                return undefined;
            }
            const newRangeStartOffset = this._textModel.getOffsetAt(range.getStartPosition());
            const newRangeEndOffset = this._textModel.getOffsetAt(range.getEndPosition());
            return {
                newRange: range,
                newRangeEndOffset,
                newRangeStartOffset,
            };
        }).filter(isDefined);
        return this._handleTreeUpdate(rangeChanges, versionId);
    }
    /**
     * Do not await in this method, it will cause a race
     */
    _handleTreeUpdate(ranges, versionId) {
        const rangeChanges = [];
        const chunkSize = 1000;
        for (let i = 0; i < ranges.length; i++) {
            const rangeLinesLength = ranges[i].newRange.endLineNumber - ranges[i].newRange.startLineNumber;
            if (rangeLinesLength > chunkSize) {
                // Split the range into chunks to avoid long operations
                const fullRangeEndLineNumber = ranges[i].newRange.endLineNumber;
                let chunkLineStart = ranges[i].newRange.startLineNumber;
                let chunkColumnStart = ranges[i].newRange.startColumn;
                let chunkLineEnd = chunkLineStart + chunkSize;
                do {
                    const chunkStartingPosition = new Position(chunkLineStart, chunkColumnStart);
                    const chunkEndColumn = ((chunkLineEnd === ranges[i].newRange.endLineNumber) ? ranges[i].newRange.endColumn : this._textModel.getLineMaxColumn(chunkLineEnd));
                    const chunkEndPosition = new Position(chunkLineEnd, chunkEndColumn);
                    const chunkRange = Range.fromPositions(chunkStartingPosition, chunkEndPosition);
                    rangeChanges.push({
                        range: chunkRange,
                        startOffset: this._textModel.getOffsetAt(chunkRange.getStartPosition()),
                        endOffset: this._textModel.getOffsetAt(chunkRange.getEndPosition())
                    });
                    chunkLineStart = chunkLineEnd + 1;
                    chunkColumnStart = 1;
                    if (chunkLineEnd < fullRangeEndLineNumber && chunkLineEnd + chunkSize > fullRangeEndLineNumber) {
                        chunkLineEnd = fullRangeEndLineNumber;
                    }
                    else {
                        chunkLineEnd = chunkLineEnd + chunkSize;
                    }
                } while (chunkLineEnd <= fullRangeEndLineNumber);
            }
            else {
                // Check that the previous range doesn't overlap
                if ((i === 0) || (rangeChanges[i - 1].endOffset < ranges[i].newRangeStartOffset)) {
                    rangeChanges.push({
                        range: ranges[i].newRange,
                        startOffset: ranges[i].newRangeStartOffset,
                        endOffset: ranges[i].newRangeEndOffset
                    });
                }
                else if (rangeChanges[i - 1].endOffset < ranges[i].newRangeEndOffset) {
                    // clip the range to the previous range
                    const startPosition = this._textModel.getPositionAt(rangeChanges[i - 1].endOffset + 1);
                    const range = new Range(startPosition.lineNumber, startPosition.column, ranges[i].newRange.endLineNumber, ranges[i].newRange.endColumn);
                    rangeChanges.push({
                        range,
                        startOffset: rangeChanges[i - 1].endOffset + 1,
                        endOffset: ranges[i].newRangeEndOffset
                    });
                }
            }
        }
        // Get the captures immediately while the text model is correct
        const captures = rangeChanges.map(range => this._getCaptures(range.range));
        // Don't block
        return this._updateTreeForRanges(rangeChanges, versionId, captures).then(() => {
            if (!this._textModel.isDisposed() && (this._tree.treeLastParsedVersion.get() === this._textModel.getVersionId())) {
                this._refreshNeedsRefresh(versionId);
            }
        });
    }
    async _updateTreeForRanges(rangeChanges, versionId, captures) {
        let tokenUpdate;
        for (let i = 0; i < rangeChanges.length; i++) {
            if (!this._textModel.isDisposed() && versionId !== this._textModel.getVersionId()) {
                // Our captures have become invalid and we need to re-capture
                break;
            }
            const capture = captures[i];
            const range = rangeChanges[i];
            const updates = this.getTokensInRange(range.range, range.startOffset, range.endOffset, capture);
            if (updates) {
                tokenUpdate = { newTokens: updates };
            }
            else {
                tokenUpdate = { newTokens: [] };
            }
            this._updateTokensInStore(versionId, [tokenUpdate], TokenQuality.Accurate);
            this._onDidChangeTokens.fire({
                changes: {
                    semanticTokensApplied: false,
                    ranges: [{ fromLineNumber: range.range.getStartPosition().lineNumber, toLineNumber: range.range.getEndPosition().lineNumber }]
                }
            });
            await new Promise(resolve => setTimeout0(resolve));
        }
        this._onDidCompleteBackgroundTokenization.fire();
    }
    _refreshNeedsRefresh(versionId) {
        const rangesToRefresh = this._getNeedsRefresh();
        if (rangesToRefresh.length === 0) {
            return;
        }
        const rangeChanges = new Array(rangesToRefresh.length);
        for (let i = 0; i < rangesToRefresh.length; i++) {
            const range = rangesToRefresh[i];
            rangeChanges[i] = {
                newRange: range.range,
                newRangeStartOffset: range.startOffset,
                newRangeEndOffset: range.endOffset
            };
        }
        this._handleTreeUpdate(rangeChanges, versionId);
    }
    _rangeTokensAsUpdates(rangeOffset, endOffsetToken, startingOffsetInArray) {
        const updates = [];
        let lastEnd = 0;
        for (const token of endOffsetToken) {
            if (token.endOffset <= lastEnd || (startingOffsetInArray && (token.endOffset < startingOffsetInArray))) {
                continue;
            }
            let tokenUpdate;
            if (startingOffsetInArray && (lastEnd < startingOffsetInArray)) {
                tokenUpdate = { startOffsetInclusive: rangeOffset + startingOffsetInArray, length: token.endOffset - startingOffsetInArray, token: token.metadata };
            }
            else {
                tokenUpdate = { startOffsetInclusive: rangeOffset + lastEnd, length: token.endOffset - lastEnd, token: token.metadata };
            }
            updates.push(tokenUpdate);
            lastEnd = token.endOffset;
        }
        return updates;
    }
    _updateTheme() {
        const modelRange = this._textModel.getFullModelRange();
        this._markForRefresh(modelRange);
        this._parseAndTokenizeViewPort(this._visibleLineRanges.get());
    }
    // Was used for inspect editor tokens command
    captureAtPosition(lineNumber, column) {
        const captures = this.captureAtRangeWithInjections(new Range(lineNumber, column, lineNumber, column + 1));
        return captures;
    }
    // Was used for the colorization tests
    captureAtRangeTree(range) {
        const captures = this.captureAtRangeWithInjections(range);
        return captures;
    }
    captureAtRange(range) {
        const tree = this._tree.tree.get();
        if (!tree) {
            return [];
        }
        // Tree sitter row is 0 based, column is 0 based
        return this._highlightingQueries.captures(tree.rootNode, { startPosition: { row: range.startLineNumber - 1, column: range.startColumn - 1 }, endPosition: { row: range.endLineNumber - 1, column: range.endColumn - 1 } }).map(capture => ({
            name: capture.name,
            text: capture.node.text,
            node: {
                startIndex: capture.node.startIndex,
                endIndex: capture.node.endIndex,
                startPosition: {
                    lineNumber: capture.node.startPosition.row + 1,
                    column: capture.node.startPosition.column + 1
                },
                endPosition: {
                    lineNumber: capture.node.endPosition.row + 1,
                    column: capture.node.endPosition.column + 1
                }
            },
            encodedLanguageId: this._encodedLanguageId
        }));
    }
    captureAtRangeWithInjections(range) {
        const captures = this.captureAtRange(range);
        for (let i = 0; i < captures.length; i++) {
            const capture = captures[i];
            const capStartLine = capture.node.startPosition.lineNumber;
            const capEndLine = capture.node.endPosition.lineNumber;
            const capStartColumn = capture.node.startPosition.column;
            const capEndColumn = capture.node.endPosition.column;
            const startLine = ((capStartLine > range.startLineNumber) && (capStartLine < range.endLineNumber)) ? capStartLine : range.startLineNumber;
            const endLine = ((capEndLine > range.startLineNumber) && (capEndLine < range.endLineNumber)) ? capEndLine : range.endLineNumber;
            const startColumn = (capStartLine === range.startLineNumber) ? (capStartColumn < range.startColumn ? range.startColumn : capStartColumn) : (capStartLine < range.startLineNumber ? range.startColumn : capStartColumn);
            const endColumn = (capEndLine === range.endLineNumber) ? (capEndColumn > range.endColumn ? range.endColumn : capEndColumn) : (capEndLine > range.endLineNumber ? range.endColumn : capEndColumn);
            const injectionRange = new Range(startLine, startColumn, endLine, endColumn);
            const injection = this._getInjectionCaptures(capture, injectionRange);
            if (injection && injection.length > 0) {
                captures.splice(i + 1, 0, ...injection);
                i += injection.length;
            }
        }
        return captures;
    }
    /**
     * Gets the tokens for a given line.
     * Each token takes 2 elements in the array. The first element is the offset of the end of the token *in the line, not in the document*, and the second element is the metadata.
     *
     * @param lineNumber
     * @returns
     */
    tokenizeEncoded(lineNumber) {
        const tokens = this._tokenizeEncoded(lineNumber);
        if (!tokens) {
            return undefined;
        }
        const updates = this._rangeTokensAsUpdates(this._textModel.getOffsetAt({ lineNumber, column: 1 }), tokens.result);
        if (tokens.versionId === this._textModel.getVersionId()) {
            this._updateTokensInStore(tokens.versionId, [{ newTokens: updates, oldRangeLength: this._textModel.getLineLength(lineNumber) }], TokenQuality.Accurate);
        }
    }
    tokenizeEncodedInstrumented(lineNumber) {
        const tokens = this._tokenizeEncoded(lineNumber);
        if (!tokens) {
            return undefined;
        }
        return { result: this._endOffsetTokensToUint32Array(tokens.result), captureTime: tokens.captureTime, metadataTime: tokens.metadataTime };
    }
    _getCaptures(range) {
        const captures = this.captureAtRangeWithInjections(range);
        return captures;
    }
    _tokenize(range, rangeStartOffset, rangeEndOffset) {
        const captures = this._getCaptures(range);
        const result = this._tokenizeCapturesWithMetadata(captures, rangeStartOffset, rangeEndOffset);
        if (!result) {
            return undefined;
        }
        return { ...result, versionId: this._tree.treeLastParsedVersion.get() };
    }
    _createTokensFromCaptures(captures, rangeStartOffset, rangeEndOffset) {
        const tree = this._tree.tree.get();
        const stopwatch = StopWatch.create();
        const rangeLength = rangeEndOffset - rangeStartOffset;
        const encodedLanguageId = this._languageIdCodec.encodeLanguageId(this._tree.languageId);
        const baseScope = TREESITTER_BASE_SCOPES[this._tree.languageId] || 'source';
        if (captures.length === 0) {
            if (tree) {
                stopwatch.stop();
                const endOffsetsAndMetadata = [{ endOffset: rangeLength, scopes: [], encodedLanguageId }];
                return { endOffsets: endOffsetsAndMetadata, captureTime: stopwatch.elapsed() };
            }
            return undefined;
        }
        const endOffsetsAndScopes = Array(captures.length);
        endOffsetsAndScopes.fill({ endOffset: 0, scopes: [baseScope], encodedLanguageId });
        let tokenIndex = 0;
        const increaseSizeOfTokensByOneToken = () => {
            endOffsetsAndScopes.push({ endOffset: 0, scopes: [baseScope], encodedLanguageId });
        };
        const brackets = (capture, startOffset) => {
            return (capture.name.includes('punctuation') && capture.text) ? Array.from(capture.text.matchAll(BRACKETS)).map(match => startOffset + match.index) : undefined;
        };
        const addCurrentTokenToArray = (capture, startOffset, endOffset, position) => {
            if (position !== undefined) {
                const oldScopes = endOffsetsAndScopes[position].scopes;
                let oldBracket = endOffsetsAndScopes[position].bracket;
                // Check that the previous token ends at the same point that the current token starts
                const prevEndOffset = position > 0 ? endOffsetsAndScopes[position - 1].endOffset : 0;
                if (prevEndOffset !== startOffset) {
                    let preInsertBracket = undefined;
                    if (oldBracket && oldBracket.length > 0) {
                        preInsertBracket = [];
                        const postInsertBracket = [];
                        for (let i = 0; i < oldBracket.length; i++) {
                            const bracket = oldBracket[i];
                            if (bracket < startOffset) {
                                preInsertBracket.push(bracket);
                            }
                            else if (bracket > endOffset) {
                                postInsertBracket.push(bracket);
                            }
                        }
                        if (preInsertBracket.length === 0) {
                            preInsertBracket = undefined;
                        }
                        if (postInsertBracket.length === 0) {
                            oldBracket = undefined;
                        }
                        else {
                            oldBracket = postInsertBracket;
                        }
                    }
                    // We need to add some of the position token to cover the space
                    endOffsetsAndScopes.splice(position, 0, { endOffset: startOffset, scopes: [...oldScopes], bracket: preInsertBracket, encodedLanguageId: capture.encodedLanguageId });
                    position++;
                    increaseSizeOfTokensByOneToken();
                    tokenIndex++;
                }
                endOffsetsAndScopes.splice(position, 0, { endOffset: endOffset, scopes: [...oldScopes, capture.name], bracket: brackets(capture, startOffset), encodedLanguageId: capture.encodedLanguageId });
                endOffsetsAndScopes[tokenIndex].bracket = oldBracket;
            }
            else {
                endOffsetsAndScopes[tokenIndex] = { endOffset: endOffset, scopes: [baseScope, capture.name], bracket: brackets(capture, startOffset), encodedLanguageId: capture.encodedLanguageId };
            }
            tokenIndex++;
        };
        for (let captureIndex = 0; captureIndex < captures.length; captureIndex++) {
            const capture = captures[captureIndex];
            const tokenEndIndex = capture.node.endIndex < rangeEndOffset ? ((capture.node.endIndex < rangeStartOffset) ? rangeStartOffset : capture.node.endIndex) : rangeEndOffset;
            const tokenStartIndex = capture.node.startIndex < rangeStartOffset ? rangeStartOffset : capture.node.startIndex;
            const endOffset = tokenEndIndex - rangeStartOffset;
            // Not every character will get captured, so we need to make sure that our current capture doesn't bleed toward the start of the line and cover characters that it doesn't apply to.
            // We do this by creating a new token in the array if the previous token ends before the current token starts.
            let previousEndOffset;
            const currentTokenLength = tokenEndIndex - tokenStartIndex;
            if (captureIndex > 0) {
                previousEndOffset = endOffsetsAndScopes[(tokenIndex - 1)].endOffset;
            }
            else {
                previousEndOffset = tokenStartIndex - rangeStartOffset - 1;
            }
            const startOffset = endOffset - currentTokenLength;
            if ((previousEndOffset >= 0) && (previousEndOffset < startOffset)) {
                // Add en empty token to cover the space where there were no captures
                endOffsetsAndScopes[tokenIndex] = { endOffset: startOffset, scopes: [baseScope], encodedLanguageId: this._encodedLanguageId };
                tokenIndex++;
                increaseSizeOfTokensByOneToken();
            }
            if (currentTokenLength < 0) {
                // This happens when we have a token "gap" right at the end of the capture range. The last capture isn't used because it's start index isn't included in the range.
                continue;
            }
            if (previousEndOffset >= endOffset) {
                // walk back through the tokens until we find the one that contains the current token
                let withinTokenIndex = tokenIndex - 1;
                let previousTokenEndOffset = endOffsetsAndScopes[withinTokenIndex].endOffset;
                let previousTokenStartOffset = ((withinTokenIndex >= 2) ? endOffsetsAndScopes[withinTokenIndex - 1].endOffset : 0);
                do {
                    // Check that the current token doesn't just replace the last token
                    if ((previousTokenStartOffset + currentTokenLength) === previousTokenEndOffset) {
                        if (previousTokenStartOffset === startOffset) {
                            // Current token and previous token span the exact same characters, add the scopes to the previous token
                            endOffsetsAndScopes[withinTokenIndex].scopes.push(capture.name);
                            const oldBracket = endOffsetsAndScopes[withinTokenIndex].bracket;
                            endOffsetsAndScopes[withinTokenIndex].bracket = ((oldBracket && (oldBracket.length > 0)) ? oldBracket : brackets(capture, startOffset));
                        }
                    }
                    else if (previousTokenStartOffset <= startOffset) {
                        addCurrentTokenToArray(capture, startOffset, endOffset, withinTokenIndex);
                        break;
                    }
                    withinTokenIndex--;
                    previousTokenStartOffset = ((withinTokenIndex >= 1) ? endOffsetsAndScopes[withinTokenIndex - 1].endOffset : 0);
                    previousTokenEndOffset = ((withinTokenIndex >= 0) ? endOffsetsAndScopes[withinTokenIndex].endOffset : 0);
                } while (previousTokenEndOffset > startOffset);
            }
            else {
                // Just add the token to the array
                addCurrentTokenToArray(capture, startOffset, endOffset);
            }
        }
        // Account for uncaptured characters at the end of the line
        if ((endOffsetsAndScopes[tokenIndex - 1].endOffset < rangeLength)) {
            if (rangeLength - endOffsetsAndScopes[tokenIndex - 1].endOffset > 0) {
                increaseSizeOfTokensByOneToken();
                endOffsetsAndScopes[tokenIndex] = { endOffset: rangeLength, scopes: endOffsetsAndScopes[tokenIndex].scopes, encodedLanguageId: this._encodedLanguageId };
                tokenIndex++;
            }
        }
        for (let i = 0; i < endOffsetsAndScopes.length; i++) {
            const token = endOffsetsAndScopes[i];
            if (token.endOffset === 0 && i !== 0) {
                endOffsetsAndScopes.splice(i, endOffsetsAndScopes.length - i);
                break;
            }
        }
        const captureTime = stopwatch.elapsed();
        return { endOffsets: endOffsetsAndScopes, captureTime };
    }
    _getInjectionCaptures(parentCapture, range) {
        /*
                const injection = textModelTreeSitter.getInjection(parentCapture.node.startIndex, this._treeSitterModel.languageId);
                if (!injection?.tree || injection.versionId !== textModelTreeSitter.parseResult?.versionId) {
                    return undefined;
                }

                const feature = TreeSitterTokenizationRegistry.get(injection.languageId);
                if (!feature) {
                    return undefined;
                }
                return feature.tokSupport_captureAtRangeTree(range, injection.tree, textModelTreeSitter);*/
        return [];
    }
    _tokenizeCapturesWithMetadata(captures, rangeStartOffset, rangeEndOffset) {
        const stopwatch = StopWatch.create();
        const emptyTokens = this._createTokensFromCaptures(captures, rangeStartOffset, rangeEndOffset);
        if (!emptyTokens) {
            return undefined;
        }
        const endOffsetsAndScopes = emptyTokens.endOffsets;
        for (let i = 0; i < endOffsetsAndScopes.length; i++) {
            const token = endOffsetsAndScopes[i];
            token.metadata = this._treeSitterThemeService.findMetadata(token.scopes, token.encodedLanguageId, !!token.bracket && (token.bracket.length > 0), undefined);
        }
        const metadataTime = stopwatch.elapsed();
        return { endOffsetsAndMetadata: endOffsetsAndScopes, captureTime: emptyTokens.captureTime, metadataTime };
    }
    _tokenizeEncoded(lineNumber) {
        const lineOffset = this._textModel.getOffsetAt({ lineNumber: lineNumber, column: 1 });
        const maxLine = this._textModel.getLineCount();
        const lineEndOffset = (lineNumber + 1 <= maxLine) ? this._textModel.getOffsetAt({ lineNumber: lineNumber + 1, column: 1 }) : this._textModel.getValueLength();
        const lineLength = lineEndOffset - lineOffset;
        const result = this._tokenize(new Range(lineNumber, 1, lineNumber, lineLength + 1), lineOffset, lineEndOffset);
        if (!result) {
            return undefined;
        }
        return { result: result.endOffsetsAndMetadata, captureTime: result.captureTime, metadataTime: result.metadataTime, versionId: result.versionId };
    }
    _endOffsetTokensToUint32Array(endOffsetsAndMetadata) {
        const uint32Array = new Uint32Array(endOffsetsAndMetadata.length * 2);
        for (let i = 0; i < endOffsetsAndMetadata.length; i++) {
            uint32Array[i * 2] = endOffsetsAndMetadata[i].endOffset;
            uint32Array[i * 2 + 1] = endOffsetsAndMetadata[i].metadata;
        }
        return uint32Array;
    }
};
TreeSitterTokenizationImpl = __decorate([
    __param(4, ITreeSitterThemeService)
], TreeSitterTokenizationImpl);
export { TreeSitterTokenizationImpl };
export const TREESITTER_BASE_SCOPES = {
    'css': 'source.css',
    'typescript': 'source.ts',
    'ini': 'source.ini',
    'regex': 'source.regex',
};
const BRACKETS = /[\{\}\[\]\<\>\(\)]/g;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJlZVNpdHRlclRva2VuaXphdGlvbkltcGwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi9tb2RlbC90b2tlbnMvdHJlZVNpdHRlci90cmVlU2l0dGVyVG9rZW5pemF0aW9uSW1wbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0scUNBQXFDLENBQUM7QUFDckUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFJcEUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDbkUsT0FBTyxFQUFFLFVBQVUsRUFBZSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUd4RSxPQUFPLEVBQUUsT0FBTyxFQUFFLG9CQUFvQixFQUFlLGFBQWEsRUFBRSxXQUFXLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUVsSSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDM0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ3JELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUMvQyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDaEUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDakcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFbkUsSUFBTSwwQkFBMEIsR0FBaEMsTUFBTSwwQkFBMkIsU0FBUSxVQUFVO0lBWXpELElBQVksVUFBVTtR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