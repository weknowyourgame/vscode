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
import { CompareResult, equals } from '../../../../../base/common/arrays.js';
import { BugIndicatingError } from '../../../../../base/common/errors.js';
import { autorunHandleChanges, derived, keepObserved, observableValue, transaction, waitForState } from '../../../../../base/common/observable.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { localize } from '../../../../../nls.js';
import { IUndoRedoService, UndoRedoGroup } from '../../../../../platform/undoRedo/common/undoRedo.js';
import { EditorModel } from '../../../../common/editor/editorModel.js';
import { MergeEditorLineRange } from './lineRange.js';
import { DocumentLineRangeMap, DocumentRangeMap, LineRangeMapping } from './mapping.js';
import { TextModelDiffs } from './textModelDiffs.js';
import { leftJoin } from '../utils.js';
import { ModifiedBaseRange, ModifiedBaseRangeState, ModifiedBaseRangeStateKind } from './modifiedBaseRange.js';
let MergeEditorModel = class MergeEditorModel extends EditorModel {
    constructor(base, input1, input2, resultTextModel, diffComputer, options, telemetry, languageService, undoRedoService) {
        super();
        this.base = base;
        this.input1 = input1;
        this.input2 = input2;
        this.resultTextModel = resultTextModel;
        this.diffComputer = diffComputer;
        this.options = options;
        this.telemetry = telemetry;
        this.languageService = languageService;
        this.undoRedoService = undoRedoService;
        this.input1TextModelDiffs = this._register(new TextModelDiffs(this.base, this.input1.textModel, this.diffComputer));
        this.input2TextModelDiffs = this._register(new TextModelDiffs(this.base, this.input2.textModel, this.diffComputer));
        this.resultTextModelDiffs = this._register(new TextModelDiffs(this.base, this.resultTextModel, this.diffComputer));
        this.modifiedBaseRanges = derived(this, (reader) => {
            const input1Diffs = this.input1TextModelDiffs.diffs.read(reader);
            const input2Diffs = this.input2TextModelDiffs.diffs.read(reader);
            return ModifiedBaseRange.fromDiffs(input1Diffs, input2Diffs, this.base, this.input1.textModel, this.input2.textModel);
        });
        this.modifiedBaseRangeResultStates = derived(this, reader => {
            const map = new Map(this.modifiedBaseRanges.read(reader).map((s) => [
                s, new ModifiedBaseRangeData(s)
            ]));
            return map;
        });
        this.resultSnapshot = this.resultTextModel.createSnapshot();
        this.baseInput1Diffs = this.input1TextModelDiffs.diffs;
        this.baseInput2Diffs = this.input2TextModelDiffs.diffs;
        this.baseResultDiffs = this.resultTextModelDiffs.diffs;
        this.input1ResultMapping = derived(this, reader => {
            return this.getInputResultMapping(this.baseInput1Diffs.read(reader), this.baseResultDiffs.read(reader), this.input1.textModel.getLineCount());
        });
        this.resultInput1Mapping = derived(this, reader => this.input1ResultMapping.read(reader).reverse());
        this.input2ResultMapping = derived(this, reader => {
            return this.getInputResultMapping(this.baseInput2Diffs.read(reader), this.baseResultDiffs.read(reader), this.input2.textModel.getLineCount());
        });
        this.resultInput2Mapping = derived(this, reader => this.input2ResultMapping.read(reader).reverse());
        this.baseResultMapping = derived(this, reader => {
            const map = new DocumentLineRangeMap(this.baseResultDiffs.read(reader), -1);
            return new DocumentLineRangeMap(map.lineRangeMappings.map((m) => m.inputRange.isEmpty || m.outputRange.isEmpty
                ? new LineRangeMapping(
                // We can do this because two adjacent diffs have one line in between.
                m.inputRange.deltaStart(-1), m.outputRange.deltaStart(-1))
                : m), map.inputLineCount);
        });
        this.resultBaseMapping = derived(this, reader => this.baseResultMapping.read(reader).reverse());
        this.diffComputingState = derived(this, reader => {
            const states = [
                this.input1TextModelDiffs,
                this.input2TextModelDiffs,
                this.resultTextModelDiffs,
            ].map((s) => s.state.read(reader));
            if (states.some((s) => s === 1 /* TextModelDiffState.initializing */)) {
                return 1 /* MergeEditorModelState.initializing */;
            }
            if (states.some((s) => s === 3 /* TextModelDiffState.updating */)) {
                return 3 /* MergeEditorModelState.updating */;
            }
            return 2 /* MergeEditorModelState.upToDate */;
        });
        this.inputDiffComputingState = derived(this, reader => {
            const states = [
                this.input1TextModelDiffs,
                this.input2TextModelDiffs,
            ].map((s) => s.state.read(reader));
            if (states.some((s) => s === 1 /* TextModelDiffState.initializing */)) {
                return 1 /* MergeEditorModelState.initializing */;
            }
            if (states.some((s) => s === 3 /* TextModelDiffState.updating */)) {
                return 3 /* MergeEditorModelState.updating */;
            }
            return 2 /* MergeEditorModelState.upToDate */;
        });
        this.isUpToDate = derived(this, reader => this.diffComputingState.read(reader) === 2 /* MergeEditorModelState.upToDate */);
        this.firstRun = true;
        this.unhandledConflictsCount = derived(this, reader => {
            const map = this.modifiedBaseRangeResultStates.read(reader);
            let unhandledCount = 0;
            for (const [_key, value] of map) {
                if (!value.handled.read(reader)) {
                    unhandledCount++;
                }
            }
            return unhandledCount;
        });
        this.hasUnhandledConflicts = this.unhandledConflictsCount.map(value => /** @description hasUnhandledConflicts */ value > 0);
        this._register(keepObserved(this.modifiedBaseRangeResultStates));
        this._register(keepObserved(this.input1ResultMapping));
        this._register(keepObserved(this.input2ResultMapping));
        const initializePromise = this.initialize();
        this.onInitialized = waitForState(this.diffComputingState, state => state === 2 /* MergeEditorModelState.upToDate */).then(async () => {
            await initializePromise;
        });
        initializePromise.then(() => {
            let shouldRecomputeHandledFromAccepted = true;
            this._register(autorunHandleChanges({
                changeTracker: {
                    createChangeSummary: () => undefined,
                    handleChange: (ctx) => {
                        if (ctx.didChange(this.modifiedBaseRangeResultStates)) {
                            shouldRecomputeHandledFromAccepted = true;
                        }
                        return ctx.didChange(this.resultTextModelDiffs.diffs)
                            // Ignore non-text changes as we update the state directly
                            ? ctx.change === 1 /* TextModelDiffChangeReason.textChange */
                            : true;
                    },
                }
            }, (reader) => {
                /** @description Merge Editor Model: Recompute State From Result */
                const states = this.modifiedBaseRangeResultStates.read(reader);
                if (!this.isUpToDate.read(reader)) {
                    return;
                }
                const resultDiffs = this.resultTextModelDiffs.diffs.read(reader);
                transaction(tx => {
                    /** @description Merge Editor Model: Recompute State */
                    this.updateBaseRangeAcceptedState(resultDiffs, states, tx);
                    if (shouldRecomputeHandledFromAccepted) {
                        shouldRecomputeHandledFromAccepted = false;
                        for (const [_range, observableState] of states) {
                            const state = observableState.accepted.read(undefined);
                            const handled = !(state.kind === ModifiedBaseRangeStateKind.base || state.kind === ModifiedBaseRangeStateKind.unrecognized);
                            observableState.handledInput1.set(handled, tx);
                            observableState.handledInput2.set(handled, tx);
                        }
                    }
                });
            }));
        });
    }
    async initialize() {
        if (this.options.resetResult) {
            await this.reset();
        }
    }
    async reset() {
        await waitForState(this.inputDiffComputingState, state => state === 2 /* MergeEditorModelState.upToDate */);
        const states = this.modifiedBaseRangeResultStates.get();
        transaction(tx => {
            /** @description Set initial state */
            for (const [range, state] of states) {
                let newState;
                let handled = false;
                if (range.input1Diffs.length === 0) {
                    newState = ModifiedBaseRangeState.base.withInputValue(2, true);
                    handled = true;
                }
                else if (range.input2Diffs.length === 0) {
                    newState = ModifiedBaseRangeState.base.withInputValue(1, true);
                    handled = true;
                }
                else if (range.isEqualChange) {
                    newState = ModifiedBaseRangeState.base.withInputValue(1, true);
                    handled = true;
                }
                else {
                    newState = ModifiedBaseRangeState.base;
                    handled = false;
                }
                state.accepted.set(newState, tx);
                state.computedFromDiffing = false;
                state.previousNonDiffingState = undefined;
                state.handledInput1.set(handled, tx);
                state.handledInput2.set(handled, tx);
            }
            this.resultTextModel.pushEditOperations(null, [{
                    range: new Range(1, 1, Number.MAX_SAFE_INTEGER, 1),
                    text: this.computeAutoMergedResult()
                }], () => null);
        });
    }
    computeAutoMergedResult() {
        const baseRanges = this.modifiedBaseRanges.get();
        const baseLines = this.base.getLinesContent();
        const input1Lines = this.input1.textModel.getLinesContent();
        const input2Lines = this.input2.textModel.getLinesContent();
        const resultLines = [];
        function appendLinesToResult(source, lineRange) {
            for (let i = lineRange.startLineNumber; i < lineRange.endLineNumberExclusive; i++) {
                resultLines.push(source[i - 1]);
            }
        }
        let baseStartLineNumber = 1;
        for (const baseRange of baseRanges) {
            appendLinesToResult(baseLines, MergeEditorLineRange.fromLineNumbers(baseStartLineNumber, baseRange.baseRange.startLineNumber));
            baseStartLineNumber = baseRange.baseRange.endLineNumberExclusive;
            if (baseRange.input1Diffs.length === 0) {
                appendLinesToResult(input2Lines, baseRange.input2Range);
            }
            else if (baseRange.input2Diffs.length === 0) {
                appendLinesToResult(input1Lines, baseRange.input1Range);
            }
            else if (baseRange.isEqualChange) {
                appendLinesToResult(input1Lines, baseRange.input1Range);
            }
            else {
                appendLinesToResult(baseLines, baseRange.baseRange);
            }
        }
        appendLinesToResult(baseLines, MergeEditorLineRange.fromLineNumbers(baseStartLineNumber, baseLines.length + 1));
        return resultLines.join(this.resultTextModel.getEOL());
    }
    hasBaseRange(baseRange) {
        return this.modifiedBaseRangeResultStates.get().has(baseRange);
    }
    get isApplyingEditInResult() { return this.resultTextModelDiffs.isApplyingChange; }
    getInputResultMapping(inputLinesDiffs, resultDiffs, inputLineCount) {
        const map = DocumentLineRangeMap.betweenOutputs(inputLinesDiffs, resultDiffs, inputLineCount);
        return new DocumentLineRangeMap(map.lineRangeMappings.map((m) => m.inputRange.isEmpty || m.outputRange.isEmpty
            ? new LineRangeMapping(
            // We can do this because two adjacent diffs have one line in between.
            m.inputRange.deltaStart(-1), m.outputRange.deltaStart(-1))
            : m), map.inputLineCount);
    }
    translateInputRangeToBase(input, range) {
        const baseInputDiffs = input === 1 ? this.baseInput1Diffs.get() : this.baseInput2Diffs.get();
        const map = new DocumentRangeMap(baseInputDiffs.flatMap(d => d.rangeMappings), 0).reverse();
        return map.projectRange(range).outputRange;
    }
    translateBaseRangeToInput(input, range) {
        const baseInputDiffs = input === 1 ? this.baseInput1Diffs.get() : this.baseInput2Diffs.get();
        const map = new DocumentRangeMap(baseInputDiffs.flatMap(d => d.rangeMappings), 0);
        return map.projectRange(range).outputRange;
    }
    getLineRangeInResult(baseRange, reader) {
        return this.resultTextModelDiffs.getResultLineRange(baseRange, reader);
    }
    translateResultRangeToBase(range) {
        const map = new DocumentRangeMap(this.baseResultDiffs.get().flatMap(d => d.rangeMappings), 0).reverse();
        return map.projectRange(range).outputRange;
    }
    translateBaseRangeToResult(range) {
        const map = new DocumentRangeMap(this.baseResultDiffs.get().flatMap(d => d.rangeMappings), 0);
        return map.projectRange(range).outputRange;
    }
    findModifiedBaseRangesInRange(rangeInBase) {
        // TODO use binary search
        return this.modifiedBaseRanges.get().filter(r => r.baseRange.intersectsOrTouches(rangeInBase));
    }
    updateBaseRangeAcceptedState(resultDiffs, states, tx) {
        const baseRangeWithStoreAndTouchingDiffs = leftJoin(states, resultDiffs, (baseRange, diff) => baseRange[0].baseRange.intersectsOrTouches(diff.inputRange)
            ? CompareResult.neitherLessOrGreaterThan
            : MergeEditorLineRange.compareByStart(baseRange[0].baseRange, diff.inputRange));
        for (const row of baseRangeWithStoreAndTouchingDiffs) {
            const newState = this.computeState(row.left[0], row.rights);
            const data = row.left[1];
            const oldState = data.accepted.get();
            if (!oldState.equals(newState)) {
                if (!this.firstRun && !data.computedFromDiffing) {
                    // Don't set this on the first run - the first run might be used to restore state.
                    data.computedFromDiffing = true;
                    data.previousNonDiffingState = oldState;
                }
                data.accepted.set(newState, tx);
            }
        }
        if (this.firstRun) {
            this.firstRun = false;
        }
    }
    computeState(baseRange, conflictingDiffs) {
        if (conflictingDiffs.length === 0) {
            return ModifiedBaseRangeState.base;
        }
        const conflictingEdits = conflictingDiffs.map((d) => d.getLineEdit());
        function editsAgreeWithDiffs(diffs) {
            return equals(conflictingEdits, diffs.map((d) => d.getLineEdit()), (a, b) => a.equals(b));
        }
        if (editsAgreeWithDiffs(baseRange.input1Diffs)) {
            return ModifiedBaseRangeState.base.withInputValue(1, true);
        }
        if (editsAgreeWithDiffs(baseRange.input2Diffs)) {
            return ModifiedBaseRangeState.base.withInputValue(2, true);
        }
        const states = [
            ModifiedBaseRangeState.base.withInputValue(1, true).withInputValue(2, true, true),
            ModifiedBaseRangeState.base.withInputValue(2, true).withInputValue(1, true, true),
            ModifiedBaseRangeState.base.withInputValue(1, true).withInputValue(2, true, false),
            ModifiedBaseRangeState.base.withInputValue(2, true).withInputValue(1, true, false),
        ];
        for (const s of states) {
            const { edit } = baseRange.getEditForBase(s);
            if (edit) {
                const resultRange = this.resultTextModelDiffs.getResultLineRange(baseRange.baseRange);
                const existingLines = resultRange.getLines(this.resultTextModel);
                if (equals(edit.newLines, existingLines, (a, b) => a === b)) {
                    return s;
                }
            }
        }
        return ModifiedBaseRangeState.unrecognized;
    }
    getState(baseRange) {
        const existingState = this.modifiedBaseRangeResultStates.get().get(baseRange);
        if (!existingState) {
            throw new BugIndicatingError('object must be from this instance');
        }
        return existingState.accepted;
    }
    setState(baseRange, state, _markInputAsHandled, tx, _pushStackElement = false) {
        if (!this.isUpToDate.get()) {
            throw new BugIndicatingError('Cannot set state while updating');
        }
        const existingState = this.modifiedBaseRangeResultStates.get().get(baseRange);
        if (!existingState) {
            throw new BugIndicatingError('object must be from this instance');
        }
        const conflictingDiffs = this.resultTextModelDiffs.findTouchingDiffs(baseRange.baseRange);
        const group = new UndoRedoGroup();
        if (conflictingDiffs) {
            this.resultTextModelDiffs.removeDiffs(conflictingDiffs, tx, group);
        }
        const { edit, effectiveState } = baseRange.getEditForBase(state);
        existingState.accepted.set(effectiveState, tx);
        existingState.previousNonDiffingState = undefined;
        existingState.computedFromDiffing = false;
        const input1Handled = existingState.handledInput1.get();
        const input2Handled = existingState.handledInput2.get();
        if (!input1Handled || !input2Handled) {
            this.undoRedoService.pushElement(new MarkAsHandledUndoRedoElement(this.resultTextModel.uri, new WeakRef(this), new WeakRef(existingState), input1Handled, input2Handled), group);
        }
        if (edit) {
            this.resultTextModel.pushStackElement();
            this.resultTextModelDiffs.applyEditRelativeToOriginal(edit, tx, group);
            this.resultTextModel.pushStackElement();
        }
        // always set conflict as handled
        existingState.handledInput1.set(true, tx);
        existingState.handledInput2.set(true, tx);
    }
    resetDirtyConflictsToBase() {
        transaction(tx => {
            /** @description Reset Unknown Base Range States */
            this.resultTextModel.pushStackElement();
            for (const range of this.modifiedBaseRanges.get()) {
                if (this.getState(range).get().kind === ModifiedBaseRangeStateKind.unrecognized) {
                    this.setState(range, ModifiedBaseRangeState.base, false, tx, false);
                }
            }
            this.resultTextModel.pushStackElement();
        });
    }
    isHandled(baseRange) {
        return this.modifiedBaseRangeResultStates.get().get(baseRange).handled;
    }
    isInputHandled(baseRange, inputNumber) {
        const state = this.modifiedBaseRangeResultStates.get().get(baseRange);
        return inputNumber === 1 ? state.handledInput1 : state.handledInput2;
    }
    setInputHandled(baseRange, inputNumber, handled, tx) {
        const state = this.modifiedBaseRangeResultStates.get().get(baseRange);
        if (state.handled.get() === handled) {
            return;
        }
        const dataRef = new WeakRef(ModifiedBaseRangeData);
        const modelRef = new WeakRef(this);
        this.undoRedoService.pushElement({
            type: 0 /* UndoRedoElementType.Resource */,
            resource: this.resultTextModel.uri,
            code: 'setInputHandled',
            label: localize('setInputHandled', "Set Input Handled"),
            redo() {
                const model = modelRef.deref();
                const data = dataRef.deref();
                if (model && !model.isDisposed() && data) {
                    transaction(tx => {
                        if (inputNumber === 1) {
                            state.handledInput1.set(handled, tx);
                        }
                        else {
                            state.handledInput2.set(handled, tx);
                        }
                    });
                }
            },
            undo() {
                const model = modelRef.deref();
                const data = dataRef.deref();
                if (model && !model.isDisposed() && data) {
                    transaction(tx => {
                        if (inputNumber === 1) {
                            state.handledInput1.set(!handled, tx);
                        }
                        else {
                            state.handledInput2.set(!handled, tx);
                        }
                    });
                }
            },
        });
        if (inputNumber === 1) {
            state.handledInput1.set(handled, tx);
        }
        else {
            state.handledInput2.set(handled, tx);
        }
    }
    setHandled(baseRange, handled, tx) {
        const state = this.modifiedBaseRangeResultStates.get().get(baseRange);
        if (state.handled.get() === handled) {
            return;
        }
        state.handledInput1.set(handled, tx);
        state.handledInput2.set(handled, tx);
    }
    setLanguageId(languageId, source) {
        const language = this.languageService.createById(languageId);
        this.base.setLanguage(language, source);
        this.input1.textModel.setLanguage(language, source);
        this.input2.textModel.setLanguage(language, source);
        this.resultTextModel.setLanguage(language, source);
    }
    getInitialResultValue() {
        const chunks = [];
        while (true) {
            const chunk = this.resultSnapshot.read();
            if (chunk === null) {
                break;
            }
            chunks.push(chunk);
        }
        return chunks.join();
    }
    async getResultValueWithConflictMarkers() {
        await waitForState(this.diffComputingState, state => state === 2 /* MergeEditorModelState.upToDate */);
        if (this.unhandledConflictsCount.get() === 0) {
            return this.resultTextModel.getValue();
        }
        const resultLines = this.resultTextModel.getLinesContent();
        const input1Lines = this.input1.textModel.getLinesContent();
        const input2Lines = this.input2.textModel.getLinesContent();
        const states = this.modifiedBaseRangeResultStates.get();
        const outputLines = [];
        function appendLinesToResult(source, lineRange) {
            for (let i = lineRange.startLineNumber; i < lineRange.endLineNumberExclusive; i++) {
                outputLines.push(source[i - 1]);
            }
        }
        let resultStartLineNumber = 1;
        for (const [range, state] of states) {
            if (state.handled.get()) {
                continue;
            }
            const resultRange = this.resultTextModelDiffs.getResultLineRange(range.baseRange);
            appendLinesToResult(resultLines, MergeEditorLineRange.fromLineNumbers(resultStartLineNumber, Math.max(resultStartLineNumber, resultRange.startLineNumber)));
            resultStartLineNumber = resultRange.endLineNumberExclusive;
            outputLines.push('<<<<<<<');
            if (state.accepted.get().kind === ModifiedBaseRangeStateKind.unrecognized) {
                // to prevent loss of data, use modified result as "ours"
                appendLinesToResult(resultLines, resultRange);
            }
            else {
                appendLinesToResult(input1Lines, range.input1Range);
            }
            outputLines.push('=======');
            appendLinesToResult(input2Lines, range.input2Range);
            outputLines.push('>>>>>>>');
        }
        appendLinesToResult(resultLines, MergeEditorLineRange.fromLineNumbers(resultStartLineNumber, resultLines.length + 1));
        return outputLines.join('\n');
    }
    get conflictCount() {
        return arrayCount(this.modifiedBaseRanges.get(), r => r.isConflicting);
    }
    get combinableConflictCount() {
        return arrayCount(this.modifiedBaseRanges.get(), r => r.isConflicting && r.canBeCombined);
    }
    get conflictsResolvedWithBase() {
        return arrayCount(this.modifiedBaseRangeResultStates.get().entries(), ([r, s]) => r.isConflicting &&
            s.accepted.get().kind === ModifiedBaseRangeStateKind.base);
    }
    get conflictsResolvedWithInput1() {
        return arrayCount(this.modifiedBaseRangeResultStates.get().entries(), ([r, s]) => r.isConflicting &&
            s.accepted.get().kind === ModifiedBaseRangeStateKind.input1);
    }
    get conflictsResolvedWithInput2() {
        return arrayCount(this.modifiedBaseRangeResultStates.get().entries(), ([r, s]) => r.isConflicting &&
            s.accepted.get().kind === ModifiedBaseRangeStateKind.input2);
    }
    get conflictsResolvedWithSmartCombination() {
        return arrayCount(this.modifiedBaseRangeResultStates.get().entries(), ([r, s]) => {
            const state = s.accepted.get();
            return r.isConflicting && state.kind === ModifiedBaseRangeStateKind.both && state.smartCombination;
        });
    }
    get manuallySolvedConflictCountThatEqualNone() {
        return arrayCount(this.modifiedBaseRangeResultStates.get().entries(), ([r, s]) => r.isConflicting &&
            s.accepted.get().kind === ModifiedBaseRangeStateKind.unrecognized);
    }
    get manuallySolvedConflictCountThatEqualSmartCombine() {
        return arrayCount(this.modifiedBaseRangeResultStates.get().entries(), ([r, s]) => {
            const state = s.accepted.get();
            return r.isConflicting && s.computedFromDiffing && state.kind === ModifiedBaseRangeStateKind.both && state.smartCombination;
        });
    }
    get manuallySolvedConflictCountThatEqualInput1() {
        return arrayCount(this.modifiedBaseRangeResultStates.get().entries(), ([r, s]) => {
            const state = s.accepted.get();
            return r.isConflicting && s.computedFromDiffing && state.kind === ModifiedBaseRangeStateKind.input1;
        });
    }
    get manuallySolvedConflictCountThatEqualInput2() {
        return arrayCount(this.modifiedBaseRangeResultStates.get().entries(), ([r, s]) => {
            const state = s.accepted.get();
            return r.isConflicting && s.computedFromDiffing && state.kind === ModifiedBaseRangeStateKind.input2;
        });
    }
    get manuallySolvedConflictCountThatEqualNoneAndStartedWithBase() {
        return arrayCount(this.modifiedBaseRangeResultStates.get().entries(), ([r, s]) => {
            const state = s.accepted.get();
            return r.isConflicting && state.kind === ModifiedBaseRangeStateKind.unrecognized && s.previousNonDiffingState?.kind === ModifiedBaseRangeStateKind.base;
        });
    }
    get manuallySolvedConflictCountThatEqualNoneAndStartedWithInput1() {
        return arrayCount(this.modifiedBaseRangeResultStates.get().entries(), ([r, s]) => {
            const state = s.accepted.get();
            return r.isConflicting && state.kind === ModifiedBaseRangeStateKind.unrecognized && s.previousNonDiffingState?.kind === ModifiedBaseRangeStateKind.input1;
        });
    }
    get manuallySolvedConflictCountThatEqualNoneAndStartedWithInput2() {
        return arrayCount(this.modifiedBaseRangeResultStates.get().entries(), ([r, s]) => {
            const state = s.accepted.get();
            return r.isConflicting && state.kind === ModifiedBaseRangeStateKind.unrecognized && s.previousNonDiffingState?.kind === ModifiedBaseRangeStateKind.input2;
        });
    }
    get manuallySolvedConflictCountThatEqualNoneAndStartedWithBothNonSmart() {
        return arrayCount(this.modifiedBaseRangeResultStates.get().entries(), ([r, s]) => {
            const state = s.accepted.get();
            return r.isConflicting && state.kind === ModifiedBaseRangeStateKind.unrecognized && s.previousNonDiffingState?.kind === ModifiedBaseRangeStateKind.both && !s.previousNonDiffingState?.smartCombination;
        });
    }
    get manuallySolvedConflictCountThatEqualNoneAndStartedWithBothSmart() {
        return arrayCount(this.modifiedBaseRangeResultStates.get().entries(), ([r, s]) => {
            const state = s.accepted.get();
            return r.isConflicting && state.kind === ModifiedBaseRangeStateKind.unrecognized && s.previousNonDiffingState?.kind === ModifiedBaseRangeStateKind.both && s.previousNonDiffingState?.smartCombination;
        });
    }
};
MergeEditorModel = __decorate([
    __param(7, ILanguageService),
    __param(8, IUndoRedoService)
], MergeEditorModel);
export { MergeEditorModel };
function arrayCount(array, predicate) {
    let count = 0;
    for (const value of array) {
        if (predicate(value)) {
            count++;
        }
    }
    return count;
}
class ModifiedBaseRangeData {
    constructor(baseRange) {
        this.baseRange = baseRange;
        this.accepted = observableValue(`BaseRangeState${this.baseRange.baseRange}`, ModifiedBaseRangeState.base);
        this.handledInput1 = observableValue(`BaseRangeHandledState${this.baseRange.baseRange}.Input1`, false);
        this.handledInput2 = observableValue(`BaseRangeHandledState${this.baseRange.baseRange}.Input2`, false);
        this.computedFromDiffing = false;
        this.previousNonDiffingState = undefined;
        this.handled = derived(this, reader => this.handledInput1.read(reader) && this.handledInput2.read(reader));
    }
}
export var MergeEditorModelState;
(function (MergeEditorModelState) {
    MergeEditorModelState[MergeEditorModelState["initializing"] = 1] = "initializing";
    MergeEditorModelState[MergeEditorModelState["upToDate"] = 2] = "upToDate";
    MergeEditorModelState[MergeEditorModelState["updating"] = 3] = "updating";
})(MergeEditorModelState || (MergeEditorModelState = {}));
class MarkAsHandledUndoRedoElement {
    constructor(resource, mergeEditorModelRef, stateRef, input1Handled, input2Handled) {
        this.resource = resource;
        this.mergeEditorModelRef = mergeEditorModelRef;
        this.stateRef = stateRef;
        this.input1Handled = input1Handled;
        this.input2Handled = input2Handled;
        this.code = 'undoMarkAsHandled';
        this.label = localize('undoMarkAsHandled', 'Undo Mark As Handled');
        this.type = 0 /* UndoRedoElementType.Resource */;
    }
    redo() {
        const mergeEditorModel = this.mergeEditorModelRef.deref();
        if (!mergeEditorModel || mergeEditorModel.isDisposed()) {
            return;
        }
        const state = this.stateRef.deref();
        if (!state) {
            return;
        }
        transaction(tx => {
            state.handledInput1.set(true, tx);
            state.handledInput2.set(true, tx);
        });
    }
    undo() {
        const mergeEditorModel = this.mergeEditorModelRef.deref();
        if (!mergeEditorModel || mergeEditorModel.isDisposed()) {
            return;
        }
        const state = this.stateRef.deref();
        if (!state) {
            return;
        }
        transaction(tx => {
            state.handledInput1.set(this.input1Handled, tx);
            state.handledInput2.set(this.input2Handled, tx);
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVyZ2VFZGl0b3JNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL21vZGVsL21lcmdlRWRpdG9yTW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM3RSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMxRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsT0FBTyxFQUEyRCxZQUFZLEVBQUUsZUFBZSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUU1TSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDbkUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFFdEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBNEIsZ0JBQWdCLEVBQXVCLGFBQWEsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3JKLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUV2RSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUN0RCxPQUFPLEVBQTRCLG9CQUFvQixFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ2xILE9BQU8sRUFBNkIsY0FBYyxFQUFzQixNQUFNLHFCQUFxQixDQUFDO0FBRXBHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDdkMsT0FBTyxFQUFlLGlCQUFpQixFQUFFLHNCQUFzQixFQUFFLDBCQUEwQixFQUFFLE1BQU0sd0JB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