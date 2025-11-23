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
import { mapFindFirst } from '../../../../../base/common/arraysFind.js';
import { itemsEquals } from '../../../../../base/common/equals.js';
import { BugIndicatingError, onUnexpectedExternalError } from '../../../../../base/common/errors.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { autorun, constObservable, derived, derivedHandleChanges, derivedOpts, mapObservableArrayCached, observableFromEvent, observableSignal, observableValue, recomputeInitiallyAndOnChange, subtransaction, transaction } from '../../../../../base/common/observable.js';
import { firstNonWhitespaceIndex } from '../../../../../base/common/strings.js';
import { isDefined } from '../../../../../base/common/types.js';
import { IAccessibilityService } from '../../../../../platform/accessibility/common/accessibility.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { observableCodeEditor } from '../../../../browser/observableCodeEditor.js';
import { CursorColumns } from '../../../../common/core/cursorColumns.js';
import { LineRange } from '../../../../common/core/ranges/lineRange.js';
import { Position } from '../../../../common/core/position.js';
import { Range } from '../../../../common/core/range.js';
import { Selection } from '../../../../common/core/selection.js';
import { TextReplacement, TextEdit } from '../../../../common/core/edits/textEdit.js';
import { TextLength } from '../../../../common/core/text/textLength.js';
import { InlineCompletionEndOfLifeReasonKind, InlineCompletionTriggerKind } from '../../../../common/languages.js';
import { ILanguageConfigurationService } from '../../../../common/languages/languageConfigurationRegistry.js';
import { TextModelText } from '../../../../common/model/textModelText.js';
import { ILanguageFeaturesService } from '../../../../common/services/languageFeatures.js';
import { SnippetController2 } from '../../../snippet/browser/snippetController2.js';
import { getEndPositionsAfterApplying, removeTextReplacementCommonSuffixPrefix } from '../utils.js';
import { AnimatedValue, easeOutCubic, ObservableAnimatedValue } from './animation.js';
import { computeGhostText } from './computeGhostText.js';
import { GhostText, ghostTextOrReplacementEquals, ghostTextsOrReplacementsEqual } from './ghostText.js';
import { InlineCompletionsSource } from './inlineCompletionsSource.js';
import { InlineEdit } from './inlineEdit.js';
import { InlineCompletionEditorType } from './provideInlineCompletions.js';
import { singleTextEditAugments, singleTextRemoveCommonPrefix } from './singleTextEditHelpers.js';
import { EditSources } from '../../../../common/textModelEditSource.js';
import { ICodeEditorService } from '../../../../browser/services/codeEditorService.js';
import { IInlineCompletionsService } from '../../../../browser/services/inlineCompletionsService.js';
import { TypingInterval } from './typingSpeed.js';
import { StringReplacement } from '../../../../common/core/edits/stringEdit.js';
import { OffsetRange } from '../../../../common/core/ranges/offsetRange.js';
import { URI } from '../../../../../base/common/uri.js';
let InlineCompletionsModel = class InlineCompletionsModel extends Disposable {
    get isAcceptingPartially() { return this._isAcceptingPartially; }
    get editor() {
        return this._editor;
    }
    constructor(textModel, _selectedSuggestItem, _textModelVersionId, _positions, _debounceValue, _enabled, _editor, _instantiationService, _commandService, _languageConfigurationService, _accessibilityService, _languageFeaturesService, _codeEditorService, _inlineCompletionsService) {
        super();
        this.textModel = textModel;
        this._selectedSuggestItem = _selectedSuggestItem;
        this._textModelVersionId = _textModelVersionId;
        this._positions = _positions;
        this._debounceValue = _debounceValue;
        this._enabled = _enabled;
        this._editor = _editor;
        this._instantiationService = _instantiationService;
        this._commandService = _commandService;
        this._languageConfigurationService = _languageConfigurationService;
        this._accessibilityService = _accessibilityService;
        this._languageFeaturesService = _languageFeaturesService;
        this._codeEditorService = _codeEditorService;
        this._inlineCompletionsService = _inlineCompletionsService;
        this._isActive = observableValue(this, false);
        this._onlyRequestInlineEditsSignal = observableSignal(this);
        this._forceUpdateExplicitlySignal = observableSignal(this);
        this._noDelaySignal = observableSignal(this);
        this._fetchSpecificProviderSignal = observableSignal(this);
        // We use a semantic id to keep the same inline completion selected even if the provider reorders the completions.
        this._selectedInlineCompletionId = observableValue(this, undefined);
        this.primaryPosition = derived(this, reader => this._positions.read(reader)[0] ?? new Position(1, 1));
        this.allPositions = derived(this, reader => this._positions.read(reader));
        this._isAcceptingPartially = false;
        this._appearedInsideViewport = derived(this, reader => {
            const state = this.state.read(reader);
            if (!state || !state.inlineSuggestion) {
                return false;
            }
            return isSuggestionInViewport(this._editor, state.inlineSuggestion);
        });
        this._onDidAccept = new Emitter();
        this.onDidAccept = this._onDidAccept.event;
        this._lastShownInlineCompletionInfo = undefined;
        this._lastAcceptedInlineCompletionInfo = undefined;
        this._didUndoInlineEdits = derivedHandleChanges({
            owner: this,
            changeTracker: {
                createChangeSummary: () => ({ didUndo: false }),
                handleChange: (ctx, changeSummary) => {
                    changeSummary.didUndo = ctx.didChange(this._textModelVersionId) && !!ctx.change?.isUndoing;
                    return true;
                }
            }
        }, (reader, changeSummary) => {
            const versionId = this._textModelVersionId.read(reader);
            if (versionId !== null
                && this._lastAcceptedInlineCompletionInfo
                && this._lastAcceptedInlineCompletionInfo.textModelVersionIdAfter === versionId - 1
                && this._lastAcceptedInlineCompletionInfo.inlineCompletion.isInlineEdit
                && changeSummary.didUndo) {
                this._lastAcceptedInlineCompletionInfo = undefined;
                return true;
            }
            return false;
        });
        this._preserveCurrentCompletionReasons = new Set([
            VersionIdChangeReason.Redo,
            VersionIdChangeReason.Undo,
            VersionIdChangeReason.AcceptWord,
        ]);
        this.dontRefetchSignal = observableSignal(this);
        this._fetchInlineCompletionsPromise = derivedHandleChanges({
            owner: this,
            changeTracker: {
                createChangeSummary: () => ({
                    dontRefetch: false,
                    preserveCurrentCompletion: false,
                    inlineCompletionTriggerKind: InlineCompletionTriggerKind.Automatic,
                    onlyRequestInlineEdits: false,
                    shouldDebounce: true,
                    provider: undefined,
                    textChange: false,
                    changeReason: '',
                }),
                handleChange: (ctx, changeSummary) => {
                    /** @description fetch inline completions */
                    if (ctx.didChange(this._textModelVersionId)) {
                        if (this._preserveCurrentCompletionReasons.has(this._getReason(ctx.change))) {
                            changeSummary.preserveCurrentCompletion = true;
                        }
                        const detailedReasons = ctx.change?.detailedReasons ?? [];
                        changeSummary.changeReason = detailedReasons.length > 0 ? detailedReasons[0].getType() : '';
                        changeSummary.textChange = true;
                    }
                    else if (ctx.didChange(this._forceUpdateExplicitlySignal)) {
                        changeSummary.preserveCurrentCompletion = true;
                        changeSummary.inlineCompletionTriggerKind = InlineCompletionTriggerKind.Explicit;
                    }
                    else if (ctx.didChange(this.dontRefetchSignal)) {
                        changeSummary.dontRefetch = true;
                    }
                    else if (ctx.didChange(this._onlyRequestInlineEditsSignal)) {
                        changeSummary.onlyRequestInlineEdits = true;
                    }
                    else if (ctx.didChange(this._fetchSpecificProviderSignal)) {
                        changeSummary.provider = ctx.change;
                    }
                    return true;
                },
            },
        }, (reader, changeSummary) => {
            this._source.clearOperationOnTextModelChange.read(reader); // Make sure the clear operation runs before the fetch operation
            this._noDelaySignal.read(reader);
            this.dontRefetchSignal.read(reader);
            this._onlyRequestInlineEditsSignal.read(reader);
            this._forceUpdateExplicitlySignal.read(reader);
            this._fetchSpecificProviderSignal.read(reader);
            const shouldUpdate = ((this._enabled.read(reader) && this._selectedSuggestItem.read(reader)) || this._isActive.read(reader))
                && (!this._inlineCompletionsService.isSnoozing() || changeSummary.inlineCompletionTriggerKind === InlineCompletionTriggerKind.Explicit);
            if (!shouldUpdate) {
                this._source.cancelUpdate();
                return undefined;
            }
            this._textModelVersionId.read(reader); // Refetch on text change
            const suggestWidgetInlineCompletions = this._source.suggestWidgetInlineCompletions.read(undefined);
            let suggestItem = this._selectedSuggestItem.read(reader);
            if (this._shouldShowOnSuggestConflict.read(undefined)) {
                suggestItem = undefined;
            }
            if (suggestWidgetInlineCompletions && !suggestItem) {
                this._source.seedInlineCompletionsWithSuggestWidget();
            }
            if (changeSummary.dontRefetch) {
                return Promise.resolve(true);
            }
            if (this._didUndoInlineEdits.read(reader) && changeSummary.inlineCompletionTriggerKind !== InlineCompletionTriggerKind.Explicit) {
                transaction(tx => {
                    this._source.clear(tx);
                });
                return undefined;
            }
            let reason = '';
            if (changeSummary.provider) {
                reason += 'providerOnDidChange';
            }
            else if (changeSummary.inlineCompletionTriggerKind === InlineCompletionTriggerKind.Explicit) {
                reason += 'explicit';
            }
            if (changeSummary.changeReason) {
                reason += reason.length > 0 ? `:${changeSummary.changeReason}` : changeSummary.changeReason;
            }
            const typingInterval = this._typing.getTypingInterval();
            const requestInfo = {
                editorType: this.editorType,
                startTime: Date.now(),
                languageId: this.textModel.getLanguageId(),
                reason,
                typingInterval: typingInterval.averageInterval,
                typingIntervalCharacterCount: typingInterval.characterCount,
                availableProviders: [],
            };
            let context = {
                triggerKind: changeSummary.inlineCompletionTriggerKind,
                selectedSuggestionInfo: suggestItem?.toSelectedSuggestionInfo(),
                includeInlineCompletions: !changeSummary.onlyRequestInlineEdits,
                includeInlineEdits: this._inlineEditsEnabled.read(reader),
                requestIssuedDateTime: requestInfo.startTime,
                earliestShownDateTime: requestInfo.startTime + (changeSummary.inlineCompletionTriggerKind === InlineCompletionTriggerKind.Explicit || this.inAcceptFlow.read(undefined) ? 0 : this._minShowDelay.read(undefined)),
            };
            if (context.triggerKind === InlineCompletionTriggerKind.Automatic && changeSummary.textChange) {
                if (this.textModel.getAlternativeVersionId() === this._lastShownInlineCompletionInfo?.alternateTextModelVersionId) {
                    // When undoing back to a version where an inline edit/completion was shown,
                    // we want to show an inline edit (or completion) again if it was originally an inline edit (or completion).
                    context = {
                        ...context,
                        includeInlineCompletions: !this._lastShownInlineCompletionInfo.inlineCompletion.isInlineEdit,
                        includeInlineEdits: this._lastShownInlineCompletionInfo.inlineCompletion.isInlineEdit,
                    };
                }
            }
            const itemToPreserveCandidate = this.selectedInlineCompletion.read(undefined) ?? this._inlineCompletionItems.read(undefined)?.inlineEdit;
            const itemToPreserve = changeSummary.preserveCurrentCompletion || itemToPreserveCandidate?.forwardStable
                ? itemToPreserveCandidate : undefined;
            const userJumpedToActiveCompletion = this._jumpedToId.map(jumpedTo => !!jumpedTo && jumpedTo === this._inlineCompletionItems.read(undefined)?.inlineEdit?.semanticId);
            const providers = changeSummary.provider
                ? { providers: [changeSummary.provider], label: 'single:' + changeSummary.provider.providerId?.toString() }
                : { providers: this._languageFeaturesService.inlineCompletionsProvider.all(this.textModel), label: undefined }; // TODO: should use inlineCompletionProviders
            const availableProviders = this.getAvailableProviders(providers.providers);
            requestInfo.availableProviders = availableProviders.map(p => p.providerId).filter(isDefined);
            return this._source.fetch(availableProviders, providers.label, context, itemToPreserve?.identity, changeSummary.shouldDebounce, userJumpedToActiveCompletion, requestInfo);
        });
        this._inlineCompletionItems = derivedOpts({ owner: this }, reader => {
            const c = this._source.inlineCompletions.read(reader);
            if (!c) {
                return undefined;
            }
            const cursorPosition = this.primaryPosition.read(reader);
            let inlineEdit = undefined;
            const visibleCompletions = [];
            for (const completion of c.inlineCompletions) {
                if (!completion.isInlineEdit) {
                    if (completion.isVisible(this.textModel, cursorPosition)) {
                        visibleCompletions.push(completion);
                    }
                }
                else {
                    inlineEdit = completion;
                }
            }
            if (visibleCompletions.length !== 0) {
                // Don't show the inline edit if there is a visible completion
                inlineEdit = undefined;
            }
            return {
                inlineCompletions: visibleCompletions,
                inlineEdit,
            };
        });
        this._filteredInlineCompletionItems = derivedOpts({ owner: this, equalsFn: itemsEquals() }, reader => {
            const c = this._inlineCompletionItems.read(reader);
            return c?.inlineCompletions ?? [];
        });
        this.selectedInlineCompletionIndex = derived(this, (reader) => {
            const selectedInlineCompletionId = this._selectedInlineCompletionId.read(reader);
            const filteredCompletions = this._filteredInlineCompletionItems.read(reader);
            const idx = this._selectedInlineCompletionId === undefined ? -1
                : filteredCompletions.findIndex(v => v.semanticId === selectedInlineCompletionId);
            if (idx === -1) {
                // Reset the selection so that the selection does not jump back when it appears again
                this._selectedInlineCompletionId.set(undefined, undefined);
                return 0;
            }
            return idx;
        });
        this.selectedInlineCompletion = derived(this, (reader) => {
            const filteredCompletions = this._filteredInlineCompletionItems.read(reader);
            const idx = this.selectedInlineCompletionIndex.read(reader);
            return filteredCompletions[idx];
        });
        this.activeCommands = derivedOpts({ owner: this, equalsFn: itemsEquals() }, r => this.selectedInlineCompletion.read(r)?.source.inlineSuggestions.commands ?? []);
        this.inlineCompletionsCount = derived(this, reader => {
            if (this.lastTriggerKind.read(reader) === InlineCompletionTriggerKind.Explicit) {
                return this._filteredInlineCompletionItems.read(reader).length;
            }
            else {
                return undefined;
            }
        });
        this._hasVisiblePeekWidgets = derived(this, reader => this._editorObs.openedPeekWidgets.read(reader) > 0);
        this._shouldShowOnSuggestConflict = derived(this, reader => {
            const showOnSuggestConflict = this._showOnSuggestConflict.read(reader);
            if (showOnSuggestConflict !== 'never') {
                const hasInlineCompletion = !!this.selectedInlineCompletion.read(reader);
                if (hasInlineCompletion) {
                    const item = this._selectedSuggestItem.read(reader);
                    if (!item) {
                        return false;
                    }
                    if (showOnSuggestConflict === 'whenSuggestListIsIncomplete') {
                        return item.listIncomplete;
                    }
                    return true;
                }
            }
            return false;
        });
        this.state = derivedOpts({
            owner: this,
            equalsFn: (a, b) => {
                if (!a || !b) {
                    return a === b;
                }
                if (a.kind === 'ghostText' && b.kind === 'ghostText') {
                    return ghostTextsOrReplacementsEqual(a.ghostTexts, b.ghostTexts)
                        && a.inlineSuggestion === b.inlineSuggestion
                        && a.suggestItem === b.suggestItem;
                }
                else if (a.kind === 'inlineEdit' && b.kind === 'inlineEdit') {
                    return a.inlineEdit.equals(b.inlineEdit);
                }
                return false;
            }
        }, (reader) => {
            const model = this.textModel;
            if (this._suppressInSnippetMode.read(reader) && this._isInSnippetMode.read(reader)) {
                return undefined;
            }
            const item = this._inlineCompletionItems.read(reader);
            const inlineEditResult = item?.inlineEdit;
            if (inlineEditResult) {
                if (this._hasVisiblePeekWidgets.read(reader)) {
                    return undefined;
                }
                let edit = inlineEditResult.getSingleTextEdit();
                edit = singleTextRemoveCommonPrefix(edit, model);
                const cursorAtInlineEdit = this.primaryPosition.map(cursorPos => LineRange.fromRangeInclusive(inlineEditResult.targetRange).addMargin(1, 1).contains(cursorPos.lineNumber));
                const commands = inlineEditResult.source.inlineSuggestions.commands;
                const inlineEdit = new InlineEdit(edit, commands ?? [], inlineEditResult);
                const edits = inlineEditResult.updatedEdit;
                const e = edits ? TextEdit.fromStringEdit(edits, new TextModelText(this.textModel)).replacements : [edit];
                const nextEditUri = (item.inlineEdit?.command?.id === 'vscode.open' || item.inlineEdit?.command?.id === '_workbench.open') &&
                    // eslint-disable-next-line local/code-no-any-casts
                    item.inlineEdit?.command.arguments?.length ? URI.from(item.inlineEdit?.command.arguments[0]) : undefined;
                return { kind: 'inlineEdit', inlineEdit, inlineSuggestion: inlineEditResult, edits: e, cursorAtInlineEdit, nextEditUri };
            }
            const suggestItem = this._selectedSuggestItem.read(reader);
            if (!this._shouldShowOnSuggestConflict.read(reader) && suggestItem) {
                const suggestCompletionEdit = singleTextRemoveCommonPrefix(suggestItem.getSingleTextEdit(), model);
                const augmentation = this._computeAugmentation(suggestCompletionEdit, reader);
                const isSuggestionPreviewEnabled = this._suggestPreviewEnabled.read(reader);
                if (!isSuggestionPreviewEnabled && !augmentation) {
                    return undefined;
                }
                const fullEdit = augmentation?.edit ?? suggestCompletionEdit;
                const fullEditPreviewLength = augmentation ? augmentation.edit.text.length - suggestCompletionEdit.text.length : 0;
                const mode = this._suggestPreviewMode.read(reader);
                const positions = this._positions.read(reader);
                const allPotentialEdits = [fullEdit, ...getSecondaryEdits(this.textModel, positions, fullEdit)];
                const validEditsAndGhostTexts = allPotentialEdits
                    .map((edit, idx) => ({ edit, ghostText: edit ? computeGhostText(edit, model, mode, positions[idx], fullEditPreviewLength) : undefined }))
                    .filter(({ edit, ghostText }) => edit !== undefined && ghostText !== undefined);
                const edits = validEditsAndGhostTexts.map(({ edit }) => edit);
                const ghostTexts = validEditsAndGhostTexts.map(({ ghostText }) => ghostText);
                const primaryGhostText = ghostTexts[0] ?? new GhostText(fullEdit.range.endLineNumber, []);
                return { kind: 'ghostText', edits, primaryGhostText, ghostTexts, inlineSuggestion: augmentation?.completion, suggestItem };
            }
            else {
                if (!this._isActive.read(reader)) {
                    return undefined;
                }
                const inlineSuggestion = this.selectedInlineCompletion.read(reader);
                if (!inlineSuggestion) {
                    return undefined;
                }
                const replacement = inlineSuggestion.getSingleTextEdit();
                const mode = this._inlineSuggestMode.read(reader);
                const positions = this._positions.read(reader);
                const allPotentialEdits = [replacement, ...getSecondaryEdits(this.textModel, positions, replacement)];
                const validEditsAndGhostTexts = allPotentialEdits
                    .map((edit, idx) => ({ edit, ghostText: edit ? computeGhostText(edit, model, mode, positions[idx], 0) : undefined }))
                    .filter(({ edit, ghostText }) => edit !== undefined && ghostText !== undefined);
                const edits = validEditsAndGhostTexts.map(({ edit }) => edit);
                const ghostTexts = validEditsAndGhostTexts.map(({ ghostText }) => ghostText);
                if (!ghostTexts[0]) {
                    return undefined;
                }
                return { kind: 'ghostText', edits, primaryGhostText: ghostTexts[0], ghostTexts, inlineSuggestion, suggestItem: undefined };
            }
        });
        this.status = derived(this, reader => {
            if (this._source.loading.read(reader)) {
                return 'loading';
            }
            const s = this.state.read(reader);
            if (s?.kind === 'ghostText') {
                return 'ghostText';
            }
            if (s?.kind === 'inlineEdit') {
                return 'inlineEdit';
            }
            return 'noSuggestion';
        });
        this.inlineCompletionState = derived(this, reader => {
            const s = this.state.read(reader);
            if (!s || s.kind !== 'ghostText') {
                return undefined;
            }
            if (this._editorObs.inComposition.read(reader)) {
                return undefined;
            }
            return s;
        });
        this.inlineEditState = derived(this, reader => {
            const s = this.state.read(reader);
            if (!s || s.kind !== 'inlineEdit') {
                return undefined;
            }
            return s;
        });
        this.inlineEditAvailable = derived(this, reader => {
            const s = this.inlineEditState.read(reader);
            return !!s;
        });
        this.warning = derived(this, reader => {
            return this.inlineCompletionState.read(reader)?.inlineSuggestion?.warning;
        });
        this.ghostTexts = derivedOpts({ owner: this, equalsFn: ghostTextsOrReplacementsEqual }, reader => {
            const v = this.inlineCompletionState.read(reader);
            if (!v) {
                return undefined;
            }
            return v.ghostTexts;
        });
        this.primaryGhostText = derivedOpts({ owner: this, equalsFn: ghostTextOrReplacementEquals }, reader => {
            const v = this.inlineCompletionState.read(reader);
            if (!v) {
                return undefined;
            }
            return v?.primaryGhostText;
        });
        this.showCollapsed = derived(this, reader => {
            const state = this.state.read(reader);
            if (!state || state.kind !== 'inlineEdit') {
                return false;
            }
            if (state.inlineSuggestion.hint) {
                return false;
            }
            const isCurrentModelVersion = state.inlineSuggestion.updatedEditModelVersion === this._textModelVersionId.read(reader);
            return (this._inlineEditsShowCollapsedEnabled.read(reader) || !isCurrentModelVersion)
                && this._jumpedToId.read(reader) !== state.inlineSuggestion.semanticId
                && !this._inAcceptFlow.read(reader);
        });
        this._tabShouldIndent = derived(this, reader => {
            if (this._inAcceptFlow.read(reader)) {
                return false;
            }
            function isMultiLine(range) {
                return range.startLineNumber !== range.endLineNumber;
            }
            function getNonIndentationRange(model, lineNumber) {
                const columnStart = model.getLineIndentColumn(lineNumber);
                const lastNonWsColumn = model.getLineLastNonWhitespaceColumn(lineNumber);
                const columnEnd = Math.max(lastNonWsColumn, columnStart);
                return new Range(lineNumber, columnStart, lineNumber, columnEnd);
            }
            const selections = this._editorObs.selections.read(reader);
            return selections?.some(s => {
                if (s.isEmpty()) {
                    return this.textModel.getLineLength(s.startLineNumber) === 0;
                }
                else {
                    return isMultiLine(s) || s.containsRange(getNonIndentationRange(this.textModel, s.startLineNumber));
                }
            });
        });
        this.tabShouldJumpToInlineEdit = derived(this, reader => {
            if (this._tabShouldIndent.read(reader)) {
                return false;
            }
            const s = this.inlineEditState.read(reader);
            if (!s) {
                return false;
            }
            if (this.showCollapsed.read(reader)) {
                return true;
            }
            if (this._inAcceptFlow.read(reader) && this._appearedInsideViewport.read(reader)) {
                return false;
            }
            return !s.cursorAtInlineEdit.read(reader);
        });
        this.tabShouldAcceptInlineEdit = derived(this, reader => {
            const s = this.inlineEditState.read(reader);
            if (!s) {
                return false;
            }
            if (this.showCollapsed.read(reader)) {
                return false;
            }
            if (this._tabShouldIndent.read(reader)) {
                return false;
            }
            if (this._inAcceptFlow.read(reader) && this._appearedInsideViewport.read(reader)) {
                return true;
            }
            if (s.inlineSuggestion.targetRange.startLineNumber === this._editorObs.cursorLineNumber.read(reader)) {
                return true;
            }
            if (this._jumpedToId.read(reader) === s.inlineSuggestion.semanticId) {
                return true;
            }
            return s.cursorAtInlineEdit.read(reader);
        });
        this._jumpedToId = observableValue(this, undefined);
        this._inAcceptFlow = observableValue(this, false);
        this.inAcceptFlow = this._inAcceptFlow;
        this._source = this._register(this._instantiationService.createInstance(InlineCompletionsSource, this.textModel, this._textModelVersionId, this._debounceValue, this.primaryPosition));
        this.lastTriggerKind = this._source.inlineCompletions.map(this, v => v?.request?.context.triggerKind);
        this._editorObs = observableCodeEditor(this._editor);
        const suggest = this._editorObs.getOption(134 /* EditorOption.suggest */);
        this._suggestPreviewEnabled = suggest.map(v => v.preview);
        this._suggestPreviewMode = suggest.map(v => v.previewMode);
        const inlineSuggest = this._editorObs.getOption(71 /* EditorOption.inlineSuggest */);
        this._inlineSuggestMode = inlineSuggest.map(v => v.mode);
        this._suppressedInlineCompletionGroupIds = inlineSuggest.map(v => new Set(v.experimental.suppressInlineSuggestions.split(',')));
        this._inlineEditsEnabled = inlineSuggest.map(v => !!v.edits.enabled);
        this._inlineEditsShowCollapsedEnabled = inlineSuggest.map(s => s.edits.showCollapsed);
        this._triggerCommandOnProviderChange = inlineSuggest.map(s => s.triggerCommandOnProviderChange);
        this._minShowDelay = inlineSuggest.map(s => s.minShowDelay);
        this._showOnSuggestConflict = inlineSuggest.map(s => s.experimental.showOnSuggestConflict);
        this._suppressInSnippetMode = inlineSuggest.map(s => s.suppressInSnippetMode);
        const snippetController = SnippetController2.get(this._editor);
        this._isInSnippetMode = snippetController?.isInSnippetObservable ?? constObservable(false);
        this._typing = this._register(new TypingInterval(this.textModel));
        this._register(this._inlineCompletionsService.onDidChangeIsSnoozing((isSnoozing) => {
            if (isSnoozing) {
                this.stop();
            }
        }));
        { // Determine editor type
            const isNotebook = this.textModel.uri.scheme === 'vscode-notebook-cell';
            const [diffEditor] = this._codeEditorService.listDiffEditors()
                .filter(d => d.getOriginalEditor().getId() === this._editor.getId() ||
                d.getModifiedEditor().getId() === this._editor.getId());
            this.isInDiffEditor = !!diffEditor;
            this.editorType = isNotebook ? InlineCompletionEditorType.Notebook
                : this.isInDiffEditor ? InlineCompletionEditorType.DiffEditor
                    : InlineCompletionEditorType.TextEditor;
        }
        this._register(recomputeInitiallyAndOnChange(this.state, (s) => {
            if (s && s.inlineSuggestion) {
                this._inlineCompletionsService.reportNewCompletion(s.inlineSuggestion.requestUuid);
            }
        }));
        this._register(recomputeInitiallyAndOnChange(this._fetchInlineCompletionsPromise));
        this._register(autorun(reader => {
            this._editorObs.versionId.read(reader);
            this._inAcceptFlow.set(false, undefined);
        }));
        this._register(autorun(reader => {
            const jumpToReset = this.state.map((s, reader) => !s || s.kind === 'inlineEdit' && !s.cursorAtInlineEdit.read(reader)).read(reader);
            if (jumpToReset) {
                this._jumpedToId.set(undefined, undefined);
            }
        }));
        const inlineEditSemanticId = this.inlineEditState.map(s => s?.inlineSuggestion.semanticId);
        this._register(autorun(reader => {
            const id = inlineEditSemanticId.read(reader);
            if (id) {
                this._editor.pushUndoStop();
                this._lastShownInlineCompletionInfo = {
                    alternateTextModelVersionId: this.textModel.getAlternativeVersionId(),
                    inlineCompletion: this.state.get().inlineSuggestion,
                };
            }
        }));
        // TODO: should use getAvailableProviders and update on _suppressedInlineCompletionGroupIds change
        const inlineCompletionProviders = observableFromEvent(this._languageFeaturesService.inlineCompletionsProvider.onDidChange, () => this._languageFeaturesService.inlineCompletionsProvider.all(textModel));
        mapObservableArrayCached(this, inlineCompletionProviders, (provider, store) => {
            if (!provider.onDidChangeInlineCompletions) {
                return;
            }
            store.add(provider.onDidChangeInlineCompletions(() => {
                if (!this._enabled.get()) {
                    return;
                }
                // Only update the active editor
                const activeEditor = this._codeEditorService.getFocusedCodeEditor() || this._codeEditorService.getActiveCodeEditor();
                if (activeEditor !== this._editor) {
                    return;
                }
                if (this._triggerCommandOnProviderChange.get()) {
                    // TODO@hediet remove this and always do the else branch.
                    this.trigger(undefined, { onlyFetchInlineEdits: true });
                    return;
                }
                // If there is an active suggestion from a different provider, we ignore the update
                const activeState = this.state.get();
                if (activeState && (activeState.inlineSuggestion || activeState.edits) && activeState.inlineSuggestion?.source.provider !== provider) {
                    return;
                }
                transaction(tx => {
                    this._fetchSpecificProviderSignal.trigger(tx, provider);
                    this.trigger(tx);
                });
            }));
        }).recomputeInitiallyAndOnChange(this._store);
        this._didUndoInlineEdits.recomputeInitiallyAndOnChange(this._store);
    }
    debugGetSelectedSuggestItem() {
        return this._selectedSuggestItem;
    }
    getIndentationInfo(reader) {
        let startsWithIndentation = false;
        let startsWithIndentationLessThanTabSize = true;
        const ghostText = this?.primaryGhostText.read(reader);
        if (!!this?._selectedSuggestItem && ghostText && ghostText.parts.length > 0) {
            const { column, lines } = ghostText.parts[0];
            const firstLine = lines[0].line;
            const indentationEndColumn = this.textModel.getLineIndentColumn(ghostText.lineNumber);
            const inIndentation = column <= indentationEndColumn;
            if (inIndentation) {
                let firstNonWsIdx = firstNonWhitespaceIndex(firstLine);
                if (firstNonWsIdx === -1) {
                    firstNonWsIdx = firstLine.length - 1;
                }
                startsWithIndentation = firstNonWsIdx > 0;
                const tabSize = this.textModel.getOptions().tabSize;
                const visibleColumnIndentation = CursorColumns.visibleColumnFromColumn(firstLine, firstNonWsIdx + 1, tabSize);
                startsWithIndentationLessThanTabSize = visibleColumnIndentation < tabSize;
            }
        }
        return {
            startsWithIndentation,
            startsWithIndentationLessThanTabSize,
        };
    }
    _getReason(e) {
        if (e?.isUndoing) {
            return VersionIdChangeReason.Undo;
        }
        if (e?.isRedoing) {
            return VersionIdChangeReason.Redo;
        }
        if (this.isAcceptingPartially) {
            return VersionIdChangeReason.AcceptWord;
        }
        return VersionIdChangeReason.Other;
    }
    // TODO: This is not an ideal implementation of excludesGroupIds, however as this is currently still behind proposed API
    // and due to the time constraints, we are using a simplified approach
    getAvailableProviders(providers) {
        const suppressedProviderGroupIds = this._suppressedInlineCompletionGroupIds.get();
        const unsuppressedProviders = providers.filter(provider => !(provider.groupId && suppressedProviderGroupIds.has(provider.groupId)));
        const excludedGroupIds = new Set();
        for (const provider of unsuppressedProviders) {
            provider.excludesGroupIds?.forEach(p => excludedGroupIds.add(p));
        }
        const availableProviders = [];
        for (const provider of unsuppressedProviders) {
            if (provider.groupId && excludedGroupIds.has(provider.groupId)) {
                continue;
            }
            availableProviders.push(provider);
        }
        return availableProviders;
    }
    async trigger(tx, options = {}) {
        subtransaction(tx, tx => {
            if (options.onlyFetchInlineEdits) {
                this._onlyRequestInlineEditsSignal.trigger(tx);
            }
            if (options.noDelay) {
                this._noDelaySignal.trigger(tx);
            }
            this._isActive.set(true, tx);
            if (options.explicit) {
                this._inAcceptFlow.set(true, tx);
                this._forceUpdateExplicitlySignal.trigger(tx);
            }
            if (options.provider) {
                this._fetchSpecificProviderSignal.trigger(tx, options.provider);
            }
        });
        await this._fetchInlineCompletionsPromise.get();
    }
    async triggerExplicitly(tx, onlyFetchInlineEdits = false) {
        return this.trigger(tx, { onlyFetchInlineEdits, explicit: true });
    }
    stop(stopReason = 'automatic', tx) {
        subtransaction(tx, tx => {
            if (stopReason === 'explicitCancel') {
                const inlineCompletion = this.state.get()?.inlineSuggestion;
                if (inlineCompletion) {
                    inlineCompletion.reportEndOfLife({ kind: InlineCompletionEndOfLifeReasonKind.Rejected });
                }
            }
            this._isActive.set(false, tx);
            this._source.clear(tx);
        });
    }
    _computeAugmentation(suggestCompletion, reader) {
        const model = this.textModel;
        const suggestWidgetInlineCompletions = this._source.suggestWidgetInlineCompletions.read(reader);
        const candidateInlineCompletions = suggestWidgetInlineCompletions
            ? suggestWidgetInlineCompletions.inlineCompletions.filter(c => !c.isInlineEdit)
            : [this.selectedInlineCompletion.read(reader)].filter(isDefined);
        const augmentedCompletion = mapFindFirst(candidateInlineCompletions, completion => {
            let r = completion.getSingleTextEdit();
            r = singleTextRemoveCommonPrefix(r, model, Range.fromPositions(r.range.getStartPosition(), suggestCompletion.range.getEndPosition()));
            return singleTextEditAugments(r, suggestCompletion) ? { completion, edit: r } : undefined;
        });
        return augmentedCompletion;
    }
    async _deltaSelectedInlineCompletionIndex(delta) {
        await this.triggerExplicitly();
        const completions = this._filteredInlineCompletionItems.get() || [];
        if (completions.length > 0) {
            const newIdx = (this.selectedInlineCompletionIndex.get() + delta + completions.length) % completions.length;
            this._selectedInlineCompletionId.set(completions[newIdx].semanticId, undefined);
        }
        else {
            this._selectedInlineCompletionId.set(undefined, undefined);
        }
    }
    async next() { await this._deltaSelectedInlineCompletionIndex(1); }
    async previous() { await this._deltaSelectedInlineCompletionIndex(-1); }
    _getMetadata(completion, languageId, type = undefined) {
        if (type) {
            return EditSources.inlineCompletionPartialAccept({
                nes: completion.isInlineEdit,
                requestUuid: completion.requestUuid,
                providerId: completion.source.provider.providerId,
                languageId,
                type,
            });
        }
        else {
            return EditSources.inlineCompletionAccept({
                nes: completion.isInlineEdit,
                requestUuid: completion.requestUuid,
                providerId: completion.source.provider.providerId,
                languageId
            });
        }
    }
    async accept(editor = this._editor) {
        if (editor.getModel() !== this.textModel) {
            throw new BugIndicatingError();
        }
        let completion;
        let isNextEditUri = false;
        const state = this.state.get();
        if (state?.kind === 'ghostText') {
            if (!state || state.primaryGhostText.isEmpty() || !state.inlineSuggestion) {
                return;
            }
            completion = state.inlineSuggestion;
        }
        else if (state?.kind === 'inlineEdit') {
            completion = state.inlineSuggestion;
            isNextEditUri = !!state.nextEditUri;
        }
        else {
            return;
        }
        // Make sure the completion list will not be disposed before the text change is sent.
        completion.addRef();
        try {
            editor.pushUndoStop();
            if (isNextEditUri) {
                // Do nothing
            }
            else if (completion.snippetInfo) {
                const mainEdit = TextReplacement.delete(completion.editRange);
                const additionalEdits = completion.additionalTextEdits.map(e => new TextReplacement(Range.lift(e.range), e.text ?? ''));
                const edit = TextEdit.fromParallelReplacementsUnsorted([mainEdit, ...additionalEdits]);
                editor.edit(edit, this._getMetadata(completion, this.textModel.getLanguageId()));
                editor.setPosition(completion.snippetInfo.range.getStartPosition(), 'inlineCompletionAccept');
                SnippetController2.get(editor)?.insert(completion.snippetInfo.snippet, { undoStopBefore: false });
            }
            else {
                const edits = state.edits;
                // The cursor should move to the end of the edit, not the end of the range provided by the extension
                // Inline Edit diffs (human readable) the suggestion from the extension so it already removes common suffix/prefix
                // Inline Completions does diff the suggestion so it may contain common suffix
                let minimalEdits = edits;
                if (state.kind === 'ghostText') {
                    minimalEdits = removeTextReplacementCommonSuffixPrefix(edits, this.textModel);
                }
                const selections = getEndPositionsAfterApplying(minimalEdits).map(p => Selection.fromPositions(p));
                const additionalEdits = completion.additionalTextEdits.map(e => new TextReplacement(Range.lift(e.range), e.text ?? ''));
                const edit = TextEdit.fromParallelReplacementsUnsorted([...edits, ...additionalEdits]);
                editor.edit(edit, this._getMetadata(completion, this.textModel.getLanguageId()));
                if (completion.hint === undefined) {
                    // do not move the cursor when the completion is displayed in a different location
                    editor.setSelections(state.kind === 'inlineEdit' ? selections.slice(-1) : selections, 'inlineCompletionAccept');
                }
                if (state.kind === 'inlineEdit' && !this._accessibilityService.isMotionReduced()) {
                    const editRanges = edit.getNewRanges();
                    const dec = this._store.add(new FadeoutDecoration(editor, editRanges, () => {
                        this._store.delete(dec);
                    }));
                }
            }
            this._onDidAccept.fire();
            // Reset before invoking the command, as the command might cause a follow up trigger (which we don't want to reset).
            this.stop();
            if (completion.command) {
                await this._commandService
                    .executeCommand(completion.command.id, ...(completion.command.arguments || []))
                    .then(undefined, onUnexpectedExternalError);
            }
            completion.reportEndOfLife({ kind: InlineCompletionEndOfLifeReasonKind.Accepted });
        }
        finally {
            completion.removeRef();
            this._inAcceptFlow.set(true, undefined);
            this._lastAcceptedInlineCompletionInfo = { textModelVersionIdAfter: this.textModel.getVersionId(), inlineCompletion: completion };
        }
    }
    async acceptNextWord() {
        await this._acceptNext(this._editor, 'word', (pos, text) => {
            const langId = this.textModel.getLanguageIdAtPosition(pos.lineNumber, pos.column);
            const config = this._languageConfigurationService.getLanguageConfiguration(langId);
            const wordRegExp = new RegExp(config.wordDefinition.source, config.wordDefinition.flags.replace('g', ''));
            const m1 = text.match(wordRegExp);
            let acceptUntilIndexExclusive = 0;
            if (m1 && m1.index !== undefined) {
                if (m1.index === 0) {
                    acceptUntilIndexExclusive = m1[0].length;
                }
                else {
                    acceptUntilIndexExclusive = m1.index;
                }
            }
            else {
                acceptUntilIndexExclusive = text.length;
            }
            const wsRegExp = /\s+/g;
            const m2 = wsRegExp.exec(text);
            if (m2 && m2.index !== undefined) {
                if (m2.index + m2[0].length < acceptUntilIndexExclusive) {
                    acceptUntilIndexExclusive = m2.index + m2[0].length;
                }
            }
            return acceptUntilIndexExclusive;
        }, 0 /* PartialAcceptTriggerKind.Word */);
    }
    async acceptNextLine() {
        await this._acceptNext(this._editor, 'line', (pos, text) => {
            const m = text.match(/\n/);
            if (m && m.index !== undefined) {
                return m.index + 1;
            }
            return text.length;
        }, 1 /* PartialAcceptTriggerKind.Line */);
    }
    async _acceptNext(editor, type, getAcceptUntilIndex, kind) {
        if (editor.getModel() !== this.textModel) {
            throw new BugIndicatingError();
        }
        const state = this.inlineCompletionState.get();
        if (!state || state.primaryGhostText.isEmpty() || !state.inlineSuggestion) {
            return;
        }
        const ghostText = state.primaryGhostText;
        const completion = state.inlineSuggestion;
        if (completion.snippetInfo) {
            // not in WYSIWYG mode, partial commit might change completion, thus it is not supported
            await this.accept(editor);
            return;
        }
        const firstPart = ghostText.parts[0];
        const ghostTextPos = new Position(ghostText.lineNumber, firstPart.column);
        const ghostTextVal = firstPart.text;
        const acceptUntilIndexExclusive = getAcceptUntilIndex(ghostTextPos, ghostTextVal);
        if (acceptUntilIndexExclusive === ghostTextVal.length && ghostText.parts.length === 1) {
            this.accept(editor);
            return;
        }
        const partialGhostTextVal = ghostTextVal.substring(0, acceptUntilIndexExclusive);
        const positions = this._positions.get();
        const cursorPosition = positions[0];
        // Executing the edit might free the completion, so we have to hold a reference on it.
        completion.addRef();
        try {
            this._isAcceptingPartially = true;
            try {
                editor.pushUndoStop();
                const replaceRange = Range.fromPositions(cursorPosition, ghostTextPos);
                const newText = editor.getModel().getValueInRange(replaceRange) + partialGhostTextVal;
                const primaryEdit = new TextReplacement(replaceRange, newText);
                const edits = [primaryEdit, ...getSecondaryEdits(this.textModel, positions, primaryEdit)].filter(isDefined);
                const selections = getEndPositionsAfterApplying(edits).map(p => Selection.fromPositions(p));
                editor.edit(TextEdit.fromParallelReplacementsUnsorted(edits), this._getMetadata(completion, type));
                editor.setSelections(selections, 'inlineCompletionPartialAccept');
                editor.revealPositionInCenterIfOutsideViewport(editor.getPosition(), 0 /* ScrollType.Smooth */);
            }
            finally {
                this._isAcceptingPartially = false;
            }
            const acceptedRange = Range.fromPositions(completion.editRange.getStartPosition(), TextLength.ofText(partialGhostTextVal).addToPosition(ghostTextPos));
            // This assumes that the inline completion and the model use the same EOL style.
            const text = editor.getModel().getValueInRange(acceptedRange, 1 /* EndOfLinePreference.LF */);
            const acceptedLength = text.length;
            completion.reportPartialAccept(acceptedLength, { kind, acceptedLength: acceptedLength }, { characters: acceptUntilIndexExclusive, ratio: acceptUntilIndexExclusive / ghostTextVal.length, count: 1 });
        }
        finally {
            completion.removeRef();
        }
    }
    handleSuggestAccepted(item) {
        const itemEdit = singleTextRemoveCommonPrefix(item.getSingleTextEdit(), this.textModel);
        const augmentedCompletion = this._computeAugmentation(itemEdit, undefined);
        if (!augmentedCompletion) {
            return;
        }
        // This assumes that the inline completion and the model use the same EOL style.
        const alreadyAcceptedLength = this.textModel.getValueInRange(augmentedCompletion.completion.editRange, 1 /* EndOfLinePreference.LF */).length;
        const acceptedLength = alreadyAcceptedLength + itemEdit.text.length;
        augmentedCompletion.completion.reportPartialAccept(itemEdit.text.length, {
            kind: 2 /* PartialAcceptTriggerKind.Suggest */,
            acceptedLength,
        }, {
            characters: itemEdit.text.length,
            count: 1,
            ratio: 1
        });
    }
    extractReproSample() {
        const value = this.textModel.getValue();
        const item = this.state.get()?.inlineSuggestion;
        return {
            documentValue: value,
            inlineCompletion: item?.getSourceCompletion(),
        };
    }
    jump() {
        const s = this.inlineEditState.get();
        if (!s) {
            return;
        }
        transaction(tx => {
            this._jumpedToId.set(s.inlineSuggestion.semanticId, tx);
            this.dontRefetchSignal.trigger(tx);
            const targetRange = s.inlineSuggestion.targetRange;
            const targetPosition = targetRange.getStartPosition();
            this._editor.setPosition(targetPosition, 'inlineCompletions.jump');
            // TODO: consider using view information to reveal it
            const isSingleLineChange = targetRange.isSingleLine() && (s.inlineSuggestion.hint || !s.inlineSuggestion.insertText.includes('\n'));
            if (isSingleLineChange) {
                this._editor.revealPosition(targetPosition, 0 /* ScrollType.Smooth */);
            }
            else {
                const revealRange = new Range(targetRange.startLineNumber - 1, 1, targetRange.endLineNumber + 1, 1);
                this._editor.revealRange(revealRange, 0 /* ScrollType.Smooth */);
            }
            s.inlineSuggestion.identity.setJumpTo(tx);
            this._editor.focus();
        });
    }
    async handleInlineSuggestionShown(inlineCompletion, viewKind, viewData) {
        await inlineCompletion.reportInlineEditShown(this._commandService, viewKind, viewData);
    }
};
InlineCompletionsModel = __decorate([
    __param(7, IInstantiationService),
    __param(8, ICommandService),
    __param(9, ILanguageConfigurationService),
    __param(10, IAccessibilityService),
    __param(11, ILanguageFeaturesService),
    __param(12, ICodeEditorService),
    __param(13, IInlineCompletionsService)
], InlineCompletionsModel);
export { InlineCompletionsModel };
export var VersionIdChangeReason;
(function (VersionIdChangeReason) {
    VersionIdChangeReason[VersionIdChangeReason["Undo"] = 0] = "Undo";
    VersionIdChangeReason[VersionIdChangeReason["Redo"] = 1] = "Redo";
    VersionIdChangeReason[VersionIdChangeReason["AcceptWord"] = 2] = "AcceptWord";
    VersionIdChangeReason[VersionIdChangeReason["Other"] = 3] = "Other";
})(VersionIdChangeReason || (VersionIdChangeReason = {}));
export function getSecondaryEdits(textModel, positions, primaryTextRepl) {
    if (positions.length === 1) {
        // No secondary cursor positions
        return [];
    }
    const text = new TextModelText(textModel);
    const textTransformer = text.getTransformer();
    const primaryOffset = textTransformer.getOffset(positions[0]);
    const secondaryOffsets = positions.slice(1).map(pos => textTransformer.getOffset(pos));
    primaryTextRepl = primaryTextRepl.removeCommonPrefixAndSuffix(text);
    const primaryStringRepl = textTransformer.getStringReplacement(primaryTextRepl);
    const deltaFromOffsetToRangeStart = primaryStringRepl.replaceRange.start - primaryOffset;
    const primaryContextRange = primaryStringRepl.replaceRange.join(OffsetRange.emptyAt(primaryOffset));
    const primaryContextValue = text.getValueOfOffsetRange(primaryContextRange);
    const replacements = secondaryOffsets.map(secondaryOffset => {
        const newRangeStart = secondaryOffset + deltaFromOffsetToRangeStart;
        const newRangeEnd = newRangeStart + primaryStringRepl.replaceRange.length;
        const range = new OffsetRange(newRangeStart, newRangeEnd);
        const contextRange = range.join(OffsetRange.emptyAt(secondaryOffset));
        const contextValue = text.getValueOfOffsetRange(contextRange);
        if (contextValue !== primaryContextValue) {
            return undefined;
        }
        const stringRepl = new StringReplacement(range, primaryStringRepl.newText);
        const repl = textTransformer.getTextReplacement(stringRepl);
        return repl;
    }).filter(isDefined);
    return replacements;
}
class FadeoutDecoration extends Disposable {
    constructor(editor, ranges, onDispose) {
        super();
        if (onDispose) {
            this._register({ dispose: () => onDispose() });
        }
        this._register(observableCodeEditor(editor).setDecorations(constObservable(ranges.map(range => ({
            range: range,
            options: {
                description: 'animation',
                className: 'edits-fadeout-decoration',
                zIndex: 1,
            }
        })))));
        const animation = new AnimatedValue(1, 0, 1000, easeOutCubic);
        const val = new ObservableAnimatedValue(animation);
        this._register(autorun(reader => {
            const opacity = val.getValue(reader);
            editor.getContainerDomNode().style.setProperty('--animation-opacity', opacity.toString());
            if (animation.isFinished()) {
                this.dispose();
            }
        }));
    }
}
export function isSuggestionInViewport(editor, suggestion, reader = undefined) {
    const targetRange = suggestion.targetRange;
    // TODO make getVisibleRanges reactive!
    observableCodeEditor(editor).scrollTop.read(reader);
    const visibleRanges = editor.getVisibleRanges();
    if (visibleRanges.length < 1) {
        return false;
    }
    const viewportRange = new Range(visibleRanges[0].startLineNumber, visibleRanges[0].startColumn, visibleRanges[visibleRanges.length - 1].endLineNumber, visibleRanges[visibleRanges.length - 1].endColumn);
    return viewportRange.containsRange(targetRange);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ29tcGxldGlvbnNNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL21vZGVsL2lubGluZUNvbXBsZXRpb25zTW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNyRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JFLE9BQU8sRUFBNkQsT0FBTyxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsV0FBVyxFQUFFLHdCQUF3QixFQUFFLG1CQUFtQixFQUFFLGdCQUFnQixFQUFFLGVBQWUsRUFBRSw2QkFBNkIsRUFBRSxjQUFjLEVBQUUsV0FBVyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDelUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEYsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN0RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUV0RyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUVuRixPQUFP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