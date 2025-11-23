/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { assertNever } from '../../../../../base/common/assert.js';
import { AsyncIterableProducer } from '../../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { onUnexpectedExternalError } from '../../../../../base/common/errors.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { prefixedUuid } from '../../../../../base/common/uuid.js';
import { StringReplacement } from '../../../../common/core/edits/stringEdit.js';
import { OffsetRange } from '../../../../common/core/ranges/offsetRange.js';
import { Range } from '../../../../common/core/range.js';
import { TextReplacement } from '../../../../common/core/edits/textEdit.js';
import { InlineCompletionEndOfLifeReasonKind } from '../../../../common/languages.js';
import { fixBracketsInLine } from '../../../../common/model/bracketPairsTextModelPart/fixBrackets.js';
import { SnippetParser, Text } from '../../../snippet/browser/snippetParser.js';
import { getReadonlyEmptyArray } from '../utils.js';
import { groupByMap } from '../../../../../base/common/collections.js';
import { DirectedGraph } from './graph.js';
import { CachedFunction } from '../../../../../base/common/cache.js';
import { InlineCompletionViewKind } from '../view/inlineEdits/inlineEditsViewInterface.js';
import { isDefined } from '../../../../../base/common/types.js';
import { inlineCompletionIsVisible } from './inlineSuggestionItem.js';
import { EditDeltaInfo } from '../../../../common/textModelEditSource.js';
import { URI } from '../../../../../base/common/uri.js';
export function provideInlineCompletions(providers, position, model, context, requestInfo, languageConfigurationService) {
    const requestUuid = prefixedUuid('icr');
    const cancellationTokenSource = new CancellationTokenSource();
    let cancelReason = undefined;
    const contextWithUuid = { ...context, requestUuid: requestUuid };
    const defaultReplaceRange = getDefaultRange(position, model);
    const providersByGroupId = groupByMap(providers, p => p.groupId);
    const yieldsToGraph = DirectedGraph.from(providers, p => {
        return p.yieldsToGroupIds?.flatMap(groupId => providersByGroupId.get(groupId) ?? []) ?? [];
    });
    const { foundCycles } = yieldsToGraph.removeCycles();
    if (foundCycles.length > 0) {
        onUnexpectedExternalError(new Error(`Inline completions: cyclic yield-to dependency detected.`
            + ` Path: ${foundCycles.map(s => s.toString ? s.toString() : ('' + s)).join(' -> ')}`));
    }
    let runningCount = 0;
    const queryProvider = new CachedFunction(async (provider) => {
        try {
            runningCount++;
            if (cancellationTokenSource.token.isCancellationRequested) {
                return undefined;
            }
            const yieldsTo = yieldsToGraph.getOutgoing(provider);
            for (const p of yieldsTo) {
                // We know there is no cycle, so no recursion here
                const result = await queryProvider.get(p);
                if (result) {
                    for (const item of result.inlineSuggestions.items) {
                        if (item.isInlineEdit || typeof item.insertText !== 'string' && item.insertText !== undefined) {
                            return undefined;
                        }
                        if (item.insertText !== undefined) {
                            const t = new TextReplacement(Range.lift(item.range) ?? defaultReplaceRange, item.insertText);
                            if (inlineCompletionIsVisible(t, undefined, model, position)) {
                                return undefined;
                            }
                        }
                        // else: inline completion is not visible, so lets not block
                    }
                }
            }
            let result;
            const providerStartTime = Date.now();
            try {
                result = await provider.provideInlineCompletions(model, position, contextWithUuid, cancellationTokenSource.token);
            }
            catch (e) {
                onUnexpectedExternalError(e);
                return undefined;
            }
            const providerEndTime = Date.now();
            if (!result) {
                return undefined;
            }
            const data = [];
            const list = new InlineSuggestionList(result, data, provider);
            list.addRef();
            runWhenCancelled(cancellationTokenSource.token, () => {
                return list.removeRef(cancelReason);
            });
            if (cancellationTokenSource.token.isCancellationRequested) {
                return undefined; // The list is disposed now, so we cannot return the items!
            }
            for (const item of result.items) {
                data.push(toInlineSuggestData(item, list, defaultReplaceRange, model, languageConfigurationService, contextWithUuid, requestInfo, { startTime: providerStartTime, endTime: providerEndTime }));
            }
            return list;
        }
        finally {
            runningCount--;
        }
    });
    const inlineCompletionLists = AsyncIterableProducer.fromPromisesResolveOrder(providers.map(p => queryProvider.get(p))).filter(isDefined);
    return {
        contextWithUuid,
        get didAllProvidersReturn() { return runningCount === 0; },
        lists: inlineCompletionLists,
        cancelAndDispose: reason => {
            if (cancelReason !== undefined) {
                return;
            }
            cancelReason = reason;
            cancellationTokenSource.dispose(true);
        }
    };
}
/** If the token is eventually cancelled, this will not leak either. */
export function runWhenCancelled(token, callback) {
    if (token.isCancellationRequested) {
        callback();
        return Disposable.None;
    }
    else {
        const listener = token.onCancellationRequested(() => {
            listener.dispose();
            callback();
        });
        return { dispose: () => listener.dispose() };
    }
}
function toInlineSuggestData(inlineCompletion, source, defaultReplaceRange, textModel, languageConfigurationService, context, requestInfo, providerRequestInfo) {
    let insertText;
    let snippetInfo;
    let range = inlineCompletion.range ? Range.lift(inlineCompletion.range) : defaultReplaceRange;
    if (typeof inlineCompletion.insertText === 'string') {
        insertText = inlineCompletion.insertText;
        if (languageConfigurationService && inlineCompletion.completeBracketPairs) {
            insertText = closeBrackets(insertText, range.getStartPosition(), textModel, languageConfigurationService);
            // Modify range depending on if brackets are added or removed
            const diff = insertText.length - inlineCompletion.insertText.length;
            if (diff !== 0) {
                range = new Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn + diff);
            }
        }
        snippetInfo = undefined;
    }
    else if (inlineCompletion.insertText === undefined) {
        insertText = ''; // TODO use undefined
        snippetInfo = undefined;
        range = new Range(1, 1, 1, 1);
    }
    else if ('snippet' in inlineCompletion.insertText) {
        const preBracketCompletionLength = inlineCompletion.insertText.snippet.length;
        if (languageConfigurationService && inlineCompletion.completeBracketPairs) {
            inlineCompletion.insertText.snippet = closeBrackets(inlineCompletion.insertText.snippet, range.getStartPosition(), textModel, languageConfigurationService);
            // Modify range depending on if brackets are added or removed
            const diff = inlineCompletion.insertText.snippet.length - preBracketCompletionLength;
            if (diff !== 0) {
                range = new Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn + diff);
            }
        }
        const snippet = new SnippetParser().parse(inlineCompletion.insertText.snippet);
        if (snippet.children.length === 1 && snippet.children[0] instanceof Text) {
            insertText = snippet.children[0].value;
            snippetInfo = undefined;
        }
        else {
            insertText = snippet.toString();
            snippetInfo = {
                snippet: inlineCompletion.insertText.snippet,
                range: range
            };
        }
    }
    else {
        assertNever(inlineCompletion.insertText);
    }
    return new InlineSuggestData(range, insertText, snippetInfo, URI.revive(inlineCompletion.uri), inlineCompletion.hint, inlineCompletion.additionalTextEdits || getReadonlyEmptyArray(), inlineCompletion, source, context, inlineCompletion.isInlineEdit ?? false, requestInfo, providerRequestInfo, inlineCompletion.correlationId);
}
export class InlineSuggestData {
    constructor(range, insertText, snippetInfo, uri, hint, additionalTextEdits, sourceInlineCompletion, source, context, isInlineEdit, _requestInfo, _providerRequestInfo, _correlationId) {
        this.range = range;
        this.insertText = insertText;
        this.snippetInfo = snippetInfo;
        this.uri = uri;
        this.hint = hint;
        this.additionalTextEdits = additionalTextEdits;
        this.sourceInlineCompletion = sourceInlineCompletion;
        this.source = source;
        this.context = context;
        this.isInlineEdit = isInlineEdit;
        this._requestInfo = _requestInfo;
        this._providerRequestInfo = _providerRequestInfo;
        this._correlationId = _correlationId;
        this._didShow = false;
        this._timeUntilShown = undefined;
        this._showStartTime = undefined;
        this._shownDuration = 0;
        this._showUncollapsedStartTime = undefined;
        this._showUncollapsedDuration = 0;
        this._notShownReason = undefined;
        this._didReportEndOfLife = false;
        this._lastSetEndOfLifeReason = undefined;
        this._isPreceeded = false;
        this._partiallyAcceptedCount = 0;
        this._partiallyAcceptedSinceOriginal = { characters: 0, ratio: 0, count: 0 };
        this._viewData = { editorType: _requestInfo.editorType };
    }
    get showInlineEditMenu() { return this.sourceInlineCompletion.showInlineEditMenu ?? false; }
    get partialAccepts() { return this._partiallyAcceptedSinceOriginal; }
    getSingleTextEdit() {
        return new TextReplacement(this.range, this.insertText);
    }
    async reportInlineEditShown(commandService, updatedInsertText, viewKind, viewData) {
        this.updateShownDuration(viewKind);
        if (this._didShow) {
            return;
        }
        this._didShow = true;
        this._viewData.viewKind = viewKind;
        this._viewData.renderData = viewData;
        this._timeUntilShown = Date.now() - this._requestInfo.startTime;
        const editDeltaInfo = new EditDeltaInfo(viewData.lineCountModified, viewData.lineCountOriginal, viewData.characterCountModified, viewData.characterCountOriginal);
        this.source.provider.handleItemDidShow?.(this.source.inlineSuggestions, this.sourceInlineCompletion, updatedInsertText, editDeltaInfo);
        if (this.sourceInlineCompletion.shownCommand) {
            await commandService.executeCommand(this.sourceInlineCompletion.shownCommand.id, ...(this.sourceInlineCompletion.shownCommand.arguments || []));
        }
    }
    reportPartialAccept(acceptedCharacters, info, partialAcceptance) {
        this._partiallyAcceptedCount++;
        this._partiallyAcceptedSinceOriginal.characters += partialAcceptance.characters;
        this._partiallyAcceptedSinceOriginal.ratio = Math.min(this._partiallyAcceptedSinceOriginal.ratio + (1 - this._partiallyAcceptedSinceOriginal.ratio) * partialAcceptance.ratio, 1);
        this._partiallyAcceptedSinceOriginal.count += partialAcceptance.count;
        this.source.provider.handlePartialAccept?.(this.source.inlineSuggestions, this.sourceInlineCompletion, acceptedCharacters, info);
    }
    /**
     * Sends the end of life event to the provider.
     * If no reason is provided, the last set reason is used.
     * If no reason was set, the default reason is used.
    */
    reportEndOfLife(reason) {
        if (this._didReportEndOfLife) {
            return;
        }
        this._didReportEndOfLife = true;
        this.reportInlineEditHidden();
        if (!reason) {
            reason = this._lastSetEndOfLifeReason ?? { kind: InlineCompletionEndOfLifeReasonKind.Ignored, userTypingDisagreed: false, supersededBy: undefined };
        }
        if (reason.kind === InlineCompletionEndOfLifeReasonKind.Rejected && this.source.provider.handleRejection) {
            this.source.provider.handleRejection(this.source.inlineSuggestions, this.sourceInlineCompletion);
        }
        if (this.source.provider.handleEndOfLifetime) {
            const summary = {
                requestUuid: this.context.requestUuid,
                correlationId: this._correlationId,
                selectedSuggestionInfo: !!this.context.selectedSuggestionInfo,
                partiallyAccepted: this._partiallyAcceptedCount,
                partiallyAcceptedCountSinceOriginal: this._partiallyAcceptedSinceOriginal.count,
                partiallyAcceptedRatioSinceOriginal: this._partiallyAcceptedSinceOriginal.ratio,
                partiallyAcceptedCharactersSinceOriginal: this._partiallyAcceptedSinceOriginal.characters,
                shown: this._didShow,
                shownDuration: this._shownDuration,
                shownDurationUncollapsed: this._showUncollapsedDuration,
                preceeded: this._isPreceeded,
                timeUntilShown: this._timeUntilShown,
                timeUntilProviderRequest: this._providerRequestInfo.startTime - this._requestInfo.startTime,
                timeUntilProviderResponse: this._providerRequestInfo.endTime - this._requestInfo.startTime,
                editorType: this._viewData.editorType,
                languageId: this._requestInfo.languageId,
                requestReason: this._requestInfo.reason,
                viewKind: this._viewData.viewKind,
                notShownReason: this._notShownReason,
                typingInterval: this._requestInfo.typingInterval,
                typingIntervalCharacterCount: this._requestInfo.typingIntervalCharacterCount,
                availableProviders: this._requestInfo.availableProviders.map(p => p.toString()).join(','),
                ...this._viewData.renderData,
            };
            this.source.provider.handleEndOfLifetime(this.source.inlineSuggestions, this.sourceInlineCompletion, reason, summary);
        }
    }
    setIsPreceeded(partialAccepts) {
        this._isPreceeded = true;
        if (this._partiallyAcceptedSinceOriginal.characters !== 0 || this._partiallyAcceptedSinceOriginal.ratio !== 0 || this._partiallyAcceptedSinceOriginal.count !== 0) {
            console.warn('Expected partiallyAcceptedCountSinceOriginal to be { characters: 0, rate: 0, partialAcceptances: 0 } before setIsPreceeded.');
        }
        this._partiallyAcceptedSinceOriginal = partialAccepts;
    }
    setNotShownReason(reason) {
        this._notShownReason ??= reason;
    }
    /**
     * Sets the end of life reason, but does not send the event to the provider yet.
    */
    setEndOfLifeReason(reason) {
        this.reportInlineEditHidden();
        this._lastSetEndOfLifeReason = reason;
    }
    updateShownDuration(viewKind) {
        const timeNow = Date.now();
        if (!this._showStartTime) {
            this._showStartTime = timeNow;
        }
        const isCollapsed = viewKind === InlineCompletionViewKind.Collapsed;
        if (!isCollapsed && this._showUncollapsedStartTime === undefined) {
            this._showUncollapsedStartTime = timeNow;
        }
        if (isCollapsed && this._showUncollapsedStartTime !== undefined) {
            this._showUncollapsedDuration += timeNow - this._showUncollapsedStartTime;
        }
    }
    reportInlineEditHidden() {
        if (this._showStartTime === undefined) {
            return;
        }
        const timeNow = Date.now();
        this._shownDuration += timeNow - this._showStartTime;
        this._showStartTime = undefined;
        if (this._showUncollapsedStartTime === undefined) {
            return;
        }
        this._showUncollapsedDuration += timeNow - this._showUncollapsedStartTime;
        this._showUncollapsedStartTime = undefined;
    }
}
export var InlineCompletionEditorType;
(function (InlineCompletionEditorType) {
    InlineCompletionEditorType["TextEditor"] = "textEditor";
    InlineCompletionEditorType["DiffEditor"] = "diffEditor";
    InlineCompletionEditorType["Notebook"] = "notebook";
})(InlineCompletionEditorType || (InlineCompletionEditorType = {}));
/**
 * A ref counted pointer to the computed `InlineCompletions` and the `InlineCompletionsProvider` that
 * computed them.
 */
export class InlineSuggestionList {
    constructor(inlineSuggestions, inlineSuggestionsData, provider) {
        this.inlineSuggestions = inlineSuggestions;
        this.inlineSuggestionsData = inlineSuggestionsData;
        this.provider = provider;
        this.refCount = 0;
    }
    addRef() {
        this.refCount++;
    }
    removeRef(reason = { kind: 'other' }) {
        this.refCount--;
        if (this.refCount === 0) {
            for (const item of this.inlineSuggestionsData) {
                // Fallback if it has not been called before
                item.reportEndOfLife();
            }
            this.provider.disposeInlineCompletions(this.inlineSuggestions, reason);
        }
    }
}
function getDefaultRange(position, model) {
    const word = model.getWordAtPosition(position);
    const maxColumn = model.getLineMaxColumn(position.lineNumber);
    // By default, always replace up until the end of the current line.
    // This default might be subject to change!
    return word
        ? new Range(position.lineNumber, word.startColumn, position.lineNumber, maxColumn)
        : Range.fromPositions(position, position.with(undefined, maxColumn));
}
function closeBrackets(text, position, model, languageConfigurationService) {
    const currentLine = model.getLineContent(position.lineNumber);
    const edit = StringReplacement.replace(new OffsetRange(position.column - 1, currentLine.length), text);
    const proposedLineTokens = model.tokenization.tokenizeLinesAt(position.lineNumber, [edit.replace(currentLine)]);
    const textTokens = proposedLineTokens?.[0].sliceZeroCopy(edit.getRangeAfterReplace());
    if (!textTokens) {
        return text;
    }
    const fixedText = fixBracketsInLine(textTokens, languageConfigurationService);
    return fixedText;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvdmlkZUlubGluZUNvbXBsZXRpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvbW9kZWwvcHJvdmlkZUlubGluZUNvbXBsZXRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM1RSxPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDeEcsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakYsT0FBTyxFQUFFLFVBQVUsRUFBZSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUdsRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUNoRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFFNUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUM1RSxPQUFPLEVBQW1DLG1DQUFtQyxFQUFpTSxNQUFNLGlDQUFpQyxDQUFDO0FBR3RULE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1FQUFtRSxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDaEYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sYUFBYSxDQUFDO0FBQ3BELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUN2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