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
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, autorunWithStore, derived, observableSignal, observableSignalFromEvent, observableValue, transaction, waitForState } from '../../../../base/common/observable.js';
import { IDiffProviderFactoryService } from './diffProviderFactoryService.js';
import { filterWithPrevious } from './utils.js';
import { readHotReloadableExport } from '../../../../base/common/hotReloadHelpers.js';
import { LineRange, LineRangeSet } from '../../../common/core/ranges/lineRange.js';
import { DefaultLinesDiffComputer } from '../../../common/diff/defaultLinesDiffComputer/defaultLinesDiffComputer.js';
import { DetailedLineRangeMapping, LineRangeMapping, RangeMapping } from '../../../common/diff/rangeMapping.js';
import { TextEditInfo } from '../../../common/model/bracketPairsTextModelPart/bracketPairsTree/beforeEditPositionMapper.js';
import { combineTextEditInfos } from '../../../common/model/bracketPairsTextModelPart/bracketPairsTree/combineTextEditInfos.js';
import { optimizeSequenceDiffs } from '../../../common/diff/defaultLinesDiffComputer/heuristicSequenceOptimizations.js';
import { isDefined } from '../../../../base/common/types.js';
import { groupAdjacentBy } from '../../../../base/common/arrays.js';
import { softAssert } from '../../../../base/common/assert.js';
let DiffEditorViewModel = class DiffEditorViewModel extends Disposable {
    setActiveMovedText(movedText) {
        this._activeMovedText.set(movedText, undefined);
    }
    setHoveredMovedText(movedText) {
        this._hoveredMovedText.set(movedText, undefined);
    }
    constructor(model, _options, _diffProviderFactoryService) {
        super();
        this.model = model;
        this._options = _options;
        this._diffProviderFactoryService = _diffProviderFactoryService;
        this._isDiffUpToDate = observableValue(this, false);
        this.isDiffUpToDate = this._isDiffUpToDate;
        this._diff = observableValue(this, undefined);
        this.diff = this._diff;
        this._unchangedRegions = observableValue(this, undefined);
        this.unchangedRegions = derived(this, r => {
            if (this._options.hideUnchangedRegions.read(r)) {
                return this._unchangedRegions.read(r)?.regions ?? [];
            }
            else {
                // Reset state
                transaction(tx => {
                    for (const r of this._unchangedRegions.read(undefined)?.regions || []) {
                        r.collapseAll(tx);
                    }
                });
                return [];
            }
        });
        this.movedTextToCompare = observableValue(this, undefined);
        this._activeMovedText = observableValue(this, undefined);
        this._hoveredMovedText = observableValue(this, undefined);
        this.activeMovedText = derived(this, r => this.movedTextToCompare.read(r) ?? this._hoveredMovedText.read(r) ?? this._activeMovedText.read(r));
        this._cancellationTokenSource = new CancellationTokenSource();
        this._diffProvider = derived(this, reader => {
            const diffProvider = this._diffProviderFactoryService.createDiffProvider({
                diffAlgorithm: this._options.diffAlgorithm.read(reader)
            });
            const onChangeSignal = observableSignalFromEvent('onDidChange', diffProvider.onDidChange);
            return {
                diffProvider,
                onChangeSignal,
            };
        });
        this._register(toDisposable(() => this._cancellationTokenSource.cancel()));
        const contentChangedSignal = observableSignal('contentChangedSignal');
        const debouncer = this._register(new RunOnceScheduler(() => contentChangedSignal.trigger(undefined), 200));
        this._register(autorun(reader => {
            /** @description collapse touching unchanged ranges */
            const lastUnchangedRegions = this._unchangedRegions.read(reader);
            if (!lastUnchangedRegions || lastUnchangedRegions.regions.some(r => r.isDragged.read(reader))) {
                return;
            }
            const lastUnchangedRegionsOrigRanges = lastUnchangedRegions.originalDecorationIds
                .map(id => model.original.getDecorationRange(id))
                .map(r => r ? LineRange.fromRangeInclusive(r) : undefined);
            const lastUnchangedRegionsModRanges = lastUnchangedRegions.modifiedDecorationIds
                .map(id => model.modified.getDecorationRange(id))
                .map(r => r ? LineRange.fromRangeInclusive(r) : undefined);
            const updatedLastUnchangedRegions = lastUnchangedRegions.regions.map((r, idx) => (!lastUnchangedRegionsOrigRanges[idx] || !lastUnchangedRegionsModRanges[idx]) ? undefined :
                new UnchangedRegion(lastUnchangedRegionsOrigRanges[idx].startLineNumber, lastUnchangedRegionsModRanges[idx].startLineNumber, lastUnchangedRegionsOrigRanges[idx].length, r.visibleLineCountTop.read(reader), r.visibleLineCountBottom.read(reader))).filter(isDefined);
            const newRanges = [];
            let didChange = false;
            for (const touching of groupAdjacentBy(updatedLastUnchangedRegions, (a, b) => a.getHiddenModifiedRange(reader).endLineNumberExclusive === b.getHiddenModifiedRange(reader).startLineNumber)) {
                if (touching.length > 1) {
                    didChange = true;
                    const sumLineCount = touching.reduce((sum, r) => sum + r.lineCount, 0);
                    const r = new UnchangedRegion(touching[0].originalLineNumber, touching[0].modifiedLineNumber, sumLineCount, touching[0].visibleLineCountTop.read(undefined), touching[touching.length - 1].visibleLineCountBottom.read(undefined));
                    newRanges.push(r);
                }
                else {
                    newRanges.push(touching[0]);
                }
            }
            if (didChange) {
                const originalDecorationIds = model.original.deltaDecorations(lastUnchangedRegions.originalDecorationIds, newRanges.map(r => ({ range: r.originalUnchangedRange.toInclusiveRange(), options: { description: 'unchanged' } })));
                const modifiedDecorationIds = model.modified.deltaDecorations(lastUnchangedRegions.modifiedDecorationIds, newRanges.map(r => ({ range: r.modifiedUnchangedRange.toInclusiveRange(), options: { description: 'unchanged' } })));
                transaction(tx => {
                    this._unchangedRegions.set({
                        regions: newRanges,
                        originalDecorationIds,
                        modifiedDecorationIds
                    }, tx);
                });
            }
        }));
        const updateUnchangedRegions = (result, tx, reader) => {
            const newUnchangedRegions = UnchangedRegion.fromDiffs(result.changes, model.original.getLineCount(), model.modified.getLineCount(), this._options.hideUnchangedRegionsMinimumLineCount.read(reader), this._options.hideUnchangedRegionsContextLineCount.read(reader));
            // Transfer state from cur state
            let visibleRegions = undefined;
            const lastUnchangedRegions = this._unchangedRegions.get();
            if (lastUnchangedRegions) {
                const lastUnchangedRegionsOrigRanges = lastUnchangedRegions.originalDecorationIds
                    .map(id => model.original.getDecorationRange(id))
                    .map(r => r ? LineRange.fromRangeInclusive(r) : undefined);
                const lastUnchangedRegionsModRanges = lastUnchangedRegions.modifiedDecorationIds
                    .map(id => model.modified.getDecorationRange(id))
                    .map(r => r ? LineRange.fromRangeInclusive(r) : undefined);
                const updatedLastUnchangedRegions = filterWithPrevious(lastUnchangedRegions.regions
                    .map((r, idx) => {
                    if (!lastUnchangedRegionsOrigRanges[idx] || !lastUnchangedRegionsModRanges[idx]) {
                        return undefined;
                    }
                    const length = lastUnchangedRegionsOrigRanges[idx].length;
                    return new UnchangedRegion(lastUnchangedRegionsOrigRanges[idx].startLineNumber, lastUnchangedRegionsModRanges[idx].startLineNumber, length, 
                    // The visible area can shrink by edits -> we have to account for this
                    Math.min(r.visibleLineCountTop.get(), length), Math.min(r.visibleLineCountBottom.get(), length - r.visibleLineCountTop.get()));
                }).filter(isDefined), (cur, prev) => !prev || (cur.modifiedLineNumber >= prev.modifiedLineNumber + prev.lineCount && cur.originalLineNumber >= prev.originalLineNumber + prev.lineCount));
                let hiddenRegions = updatedLastUnchangedRegions.map(r => new LineRangeMapping(r.getHiddenOriginalRange(reader), r.getHiddenModifiedRange(reader)));
                hiddenRegions = LineRangeMapping.clip(hiddenRegions, LineRange.ofLength(1, model.original.getLineCount()), LineRange.ofLength(1, model.modified.getLineCount()));
                visibleRegions = LineRangeMapping.inverse(hiddenRegions, model.original.getLineCount(), model.modified.getLineCount());
            }
            const newUnchangedRegions2 = [];
            if (visibleRegions) {
                for (const r of newUnchangedRegions) {
                    const intersecting = visibleRegions.filter(f => f.original.intersectsStrict(r.originalUnchangedRange) && f.modified.intersectsStrict(r.modifiedUnchangedRange));
                    newUnchangedRegions2.push(...r.setVisibleRanges(intersecting, tx));
                }
            }
            else {
                newUnchangedRegions2.push(...newUnchangedRegions);
            }
            const originalDecorationIds = model.original.deltaDecorations(lastUnchangedRegions?.originalDecorationIds || [], newUnchangedRegions2.map(r => ({ range: r.originalUnchangedRange.toInclusiveRange(), options: { description: 'unchanged' } })));
            const modifiedDecorationIds = model.modified.deltaDecorations(lastUnchangedRegions?.modifiedDecorationIds || [], newUnchangedRegions2.map(r => ({ range: r.modifiedUnchangedRange.toInclusiveRange(), options: { description: 'unchanged' } })));
            this._unchangedRegions.set({
                regions: newUnchangedRegions2,
                originalDecorationIds,
                modifiedDecorationIds
            }, tx);
        };
        this._register(model.modified.onDidChangeContent((e) => {
            const diff = this._diff.get();
            if (diff) {
                const textEdits = TextEditInfo.fromModelContentChanges(e.changes);
                const result = applyModifiedEdits(this._lastDiff, textEdits, model.original, model.modified);
                if (result) {
                    this._lastDiff = result;
                    transaction(tx => {
                        this._diff.set(DiffState.fromDiffResult(this._lastDiff), tx);
                        updateUnchangedRegions(result, tx);
                        const currentSyncedMovedText = this.movedTextToCompare.get();
                        this.movedTextToCompare.set(currentSyncedMovedText ? this._lastDiff.moves.find(m => m.lineRangeMapping.modified.intersect(currentSyncedMovedText.lineRangeMapping.modified)) : undefined, tx);
                    });
                }
            }
            this._isDiffUpToDate.set(false, undefined);
            debouncer.schedule();
        }));
        this._register(model.original.onDidChangeContent((e) => {
            const diff = this._diff.get();
            if (diff) {
                const textEdits = TextEditInfo.fromModelContentChanges(e.changes);
                const result = applyOriginalEdits(this._lastDiff, textEdits, model.original, model.modified);
                if (result) {
                    this._lastDiff = result;
                    transaction(tx => {
                        this._diff.set(DiffState.fromDiffResult(this._lastDiff), tx);
                        updateUnchangedRegions(result, tx);
                        const currentSyncedMovedText = this.movedTextToCompare.get();
                        this.movedTextToCompare.set(currentSyncedMovedText ? this._lastDiff.moves.find(m => m.lineRangeMapping.modified.intersect(currentSyncedMovedText.lineRangeMapping.modified)) : undefined, tx);
                    });
                }
            }
            this._isDiffUpToDate.set(false, undefined);
            debouncer.schedule();
        }));
        this._register(autorunWithStore(async (reader, store) => {
            /** @description compute diff */
            // So that they get recomputed when these settings change
            this._options.hideUnchangedRegionsMinimumLineCount.read(reader);
            this._options.hideUnchangedRegionsContextLineCount.read(reader);
            debouncer.cancel();
            contentChangedSignal.read(reader);
            const documentDiffProvider = this._diffProvider.read(reader);
            documentDiffProvider.onChangeSignal.read(reader);
            readHotReloadableExport(DefaultLinesDiffComputer, reader);
            readHotReloadableExport(optimizeSequenceDiffs, reader);
            this._isDiffUpToDate.set(false, undefined);
            let originalTextEditInfos = [];
            store.add(model.original.onDidChangeContent((e) => {
                const edits = TextEditInfo.fromModelContentChanges(e.changes);
                originalTextEditInfos = combineTextEditInfos(originalTextEditInfos, edits);
            }));
            let modifiedTextEditInfos = [];
            store.add(model.modified.onDidChangeContent((e) => {
                const edits = TextEditInfo.fromModelContentChanges(e.changes);
                modifiedTextEditInfos = combineTextEditInfos(modifiedTextEditInfos, edits);
            }));
            let result = await documentDiffProvider.diffProvider.computeDiff(model.original, model.modified, {
                ignoreTrimWhitespace: this._options.ignoreTrimWhitespace.read(reader),
                maxComputationTimeMs: this._options.maxComputationTimeMs.read(reader),
                computeMoves: this._options.showMoves.read(reader),
            }, this._cancellationTokenSource.token);
            if (this._cancellationTokenSource.token.isCancellationRequested) {
                return;
            }
            if (model.original.isDisposed() || model.modified.isDisposed()) {
                // TODO@hediet fishy?
                return;
            }
            result = normalizeDocumentDiff(result, model.original, model.modified);
            result = applyOriginalEdits(result, originalTextEditInfos, model.original, model.modified) ?? result;
            result = applyModifiedEdits(result, modifiedTextEditInfos, model.original, model.modified) ?? result;
            transaction(tx => {
                /** @description write diff result */
                updateUnchangedRegions(result, tx);
                this._lastDiff = result;
                const state = DiffState.fromDiffResult(result);
                this._diff.set(state, tx);
                this._isDiffUpToDate.set(true, tx);
                const currentSyncedMovedText = this.movedTextToCompare.read(undefined);
                this.movedTextToCompare.set(currentSyncedMovedText ? this._lastDiff.moves.find(m => m.lineRangeMapping.modified.intersect(currentSyncedMovedText.lineRangeMapping.modified)) : undefined, tx);
            });
        }));
    }
    ensureModifiedLineIsVisible(lineNumber, preference, tx) {
        if (this.diff.get()?.mappings.length === 0) {
            return;
        }
        const unchangedRegions = this._unchangedRegions.get()?.regions || [];
        for (const r of unchangedRegions) {
            if (r.getHiddenModifiedRange(undefined).contains(lineNumber)) {
                r.showModifiedLine(lineNumber, preference, tx);
                return;
            }
        }
    }
    ensureOriginalLineIsVisible(lineNumber, preference, tx) {
        if (this.diff.get()?.mappings.length === 0) {
            return;
        }
        const unchangedRegions = this._unchangedRegions.get()?.regions || [];
        for (const r of unchangedRegions) {
            if (r.getHiddenOriginalRange(undefined).contains(lineNumber)) {
                r.showOriginalLine(lineNumber, preference, tx);
                return;
            }
        }
    }
    async waitForDiff() {
        await waitForState(this.isDiffUpToDate, s => s);
    }
    serializeState() {
        const regions = this._unchangedRegions.get();
        return {
            collapsedRegions: regions?.regions.map(r => ({ range: r.getHiddenModifiedRange(undefined).serialize() }))
        };
    }
    restoreSerializedState(state) {
        const ranges = state.collapsedRegions?.map(r => LineRange.deserialize(r.range));
        const regions = this._unchangedRegions.get();
        if (!regions || !ranges) {
            return;
        }
        transaction(tx => {
            for (const r of regions.regions) {
                for (const range of ranges) {
                    if (r.modifiedUnchangedRange.intersect(range)) {
                        r.setHiddenModifiedRange(range, tx);
                        break;
                    }
                }
            }
        });
    }
};
DiffEditorViewModel = __decorate([
    __param(2, IDiffProviderFactoryService)
], DiffEditorViewModel);
export { DiffEditorViewModel };
function normalizeDocumentDiff(diff, original, modified) {
    return {
        changes: diff.changes.map(c => new DetailedLineRangeMapping(c.original, c.modified, c.innerChanges ? c.innerChanges.map(i => normalizeRangeMapping(i, original, modified)) : undefined)),
        moves: diff.moves,
        identical: diff.identical,
        quitEarly: diff.quitEarly,
    };
}
function normalizeRangeMapping(rangeMapping, original, modified) {
    let originalRange = rangeMapping.originalRange;
    let modifiedRange = rangeMapping.modifiedRange;
    if (originalRange.startColumn === 1 && modifiedRange.startColumn === 1 &&
        (originalRange.endColumn !== 1 || modifiedRange.endColumn !== 1) &&
        originalRange.endColumn === original.getLineMaxColumn(originalRange.endLineNumber)
        && modifiedRange.endColumn === modified.getLineMaxColumn(modifiedRange.endLineNumber)
        && originalRange.endLineNumber < original.getLineCount()
        && modifiedRange.endLineNumber < modified.getLineCount()) {
        originalRange = originalRange.setEndPosition(originalRange.endLineNumber + 1, 1);
        modifiedRange = modifiedRange.setEndPosition(modifiedRange.endLineNumber + 1, 1);
    }
    return new RangeMapping(originalRange, modifiedRange);
}
export class DiffState {
    static fromDiffResult(result) {
        return new DiffState(result.changes.map(c => new DiffMapping(c)), result.moves || [], result.identical, result.quitEarly);
    }
    constructor(mappings, movedTexts, identical, quitEarly) {
        this.mappings = mappings;
        this.movedTexts = movedTexts;
        this.identical = identical;
        this.quitEarly = quitEarly;
    }
}
export class DiffMapping {
    constructor(lineRangeMapping) {
        this.lineRangeMapping = lineRangeMapping;
        /*
        readonly movedTo: MovedText | undefined,
        readonly movedFrom: MovedText | undefined,

        if (movedTo) {
            assertFn(() =>
                movedTo.lineRangeMapping.modifiedRange.equals(lineRangeMapping.modifiedRange)
                && lineRangeMapping.originalRange.isEmpty
                && !movedFrom
            );
        } else if (movedFrom) {
            assertFn(() =>
                movedFrom.lineRangeMapping.originalRange.equals(lineRangeMapping.originalRange)
                && lineRangeMapping.modifiedRange.isEmpty
                && !movedTo
            );
        }
        */
    }
}
export class UnchangedRegion {
    static fromDiffs(changes, originalLineCount, modifiedLineCount, minHiddenLineCount, minContext) {
        const inversedMappings = DetailedLineRangeMapping.inverse(changes, originalLineCount, modifiedLineCount);
        const result = [];
        for (const mapping of inversedMappings) {
            let origStart = mapping.original.startLineNumber;
            let modStart = mapping.modified.startLineNumber;
            let length = mapping.original.length;
            const atStart = origStart === 1 && modStart === 1;
            const atEnd = origStart + length === originalLineCount + 1 && modStart + length === modifiedLineCount + 1;
            if ((atStart || atEnd) && length >= minContext + minHiddenLineCount) {
                if (atStart && !atEnd) {
                    length -= minContext;
                }
                if (atEnd && !atStart) {
                    origStart += minContext;
                    modStart += minContext;
                    length -= minContext;
                }
                result.push(new UnchangedRegion(origStart, modStart, length, 0, 0));
            }
            else if (length >= minContext * 2 + minHiddenLineCount) {
                origStart += minContext;
                modStart += minContext;
                length -= minContext * 2;
                result.push(new UnchangedRegion(origStart, modStart, length, 0, 0));
            }
        }
        return result;
    }
    get originalUnchangedRange() {
        return LineRange.ofLength(this.originalLineNumber, this.lineCount);
    }
    get modifiedUnchangedRange() {
        return LineRange.ofLength(this.modifiedLineNumber, this.lineCount);
    }
    constructor(originalLineNumber, modifiedLineNumber, lineCount, visibleLineCountTop, visibleLineCountBottom) {
        this.originalLineNumber = originalLineNumber;
        this.modifiedLineNumber = modifiedLineNumber;
        this.lineCount = lineCount;
        this._visibleLineCountTop = observableValue(this, 0);
        this.visibleLineCountTop = this._visibleLineCountTop;
        this._visibleLineCountBottom = observableValue(this, 0);
        this.visibleLineCountBottom = this._visibleLineCountBottom;
        this._shouldHideControls = derived(this, reader => /** @description isVisible */ this.visibleLineCountTop.read(reader) + this.visibleLineCountBottom.read(reader) === this.lineCount && !this.isDragged.read(reader));
        this.isDragged = observableValue(this, undefined);
        const visibleLineCountTop2 = Math.max(Math.min(visibleLineCountTop, this.lineCount), 0);
        const visibleLineCountBottom2 = Math.max(Math.min(visibleLineCountBottom, this.lineCount - visibleLineCountTop), 0);
        softAssert(visibleLineCountTop === visibleLineCountTop2);
        softAssert(visibleLineCountBottom === visibleLineCountBottom2);
        this._visibleLineCountTop.set(visibleLineCountTop2, undefined);
        this._visibleLineCountBottom.set(visibleLineCountBottom2, undefined);
    }
    setVisibleRanges(visibleRanges, tx) {
        const result = [];
        const hiddenModified = new LineRangeSet(visibleRanges.map(r => r.modified)).subtractFrom(this.modifiedUnchangedRange);
        let originalStartLineNumber = this.originalLineNumber;
        let modifiedStartLineNumber = this.modifiedLineNumber;
        const modifiedEndLineNumberEx = this.modifiedLineNumber + this.lineCount;
        if (hiddenModified.ranges.length === 0) {
            this.showAll(tx);
            result.push(this);
        }
        else {
            let i = 0;
            for (const r of hiddenModified.ranges) {
                const isLast = i === hiddenModified.ranges.length - 1;
                i++;
                const length = (isLast ? modifiedEndLineNumberEx : r.endLineNumberExclusive) - modifiedStartLineNumber;
                const newR = new UnchangedRegion(originalStartLineNumber, modifiedStartLineNumber, length, 0, 0);
                newR.setHiddenModifiedRange(r, tx);
                result.push(newR);
                originalStartLineNumber = newR.originalUnchangedRange.endLineNumberExclusive;
                modifiedStartLineNumber = newR.modifiedUnchangedRange.endLineNumberExclusive;
            }
        }
        return result;
    }
    shouldHideControls(reader) {
        return this._shouldHideControls.read(reader);
    }
    getHiddenOriginalRange(reader) {
        return LineRange.ofLength(this.originalLineNumber + this._visibleLineCountTop.read(reader), this.lineCount - this._visibleLineCountTop.read(reader) - this._visibleLineCountBottom.read(reader));
    }
    getHiddenModifiedRange(reader) {
        return LineRange.ofLength(this.modifiedLineNumber + this._visibleLineCountTop.read(reader), this.lineCount - this._visibleLineCountTop.read(reader) - this._visibleLineCountBottom.read(reader));
    }
    setHiddenModifiedRange(range, tx) {
        const visibleLineCountTop = range.startLineNumber - this.modifiedLineNumber;
        const visibleLineCountBottom = (this.modifiedLineNumber + this.lineCount) - range.endLineNumberExclusive;
        this.setState(visibleLineCountTop, visibleLineCountBottom, tx);
    }
    getMaxVisibleLineCountTop() {
        return this.lineCount - this._visibleLineCountBottom.get();
    }
    getMaxVisibleLineCountBottom() {
        return this.lineCount - this._visibleLineCountTop.get();
    }
    showMoreAbove(count = 10, tx) {
        const maxVisibleLineCountTop = this.getMaxVisibleLineCountTop();
        this._visibleLineCountTop.set(Math.min(this._visibleLineCountTop.get() + count, maxVisibleLineCountTop), tx);
    }
    showMoreBelow(count = 10, tx) {
        const maxVisibleLineCountBottom = this.lineCount - this._visibleLineCountTop.get();
        this._visibleLineCountBottom.set(Math.min(this._visibleLineCountBottom.get() + count, maxVisibleLineCountBottom), tx);
    }
    showAll(tx) {
        this._visibleLineCountBottom.set(this.lineCount - this._visibleLineCountTop.get(), tx);
    }
    showModifiedLine(lineNumber, preference, tx) {
        const top = lineNumber + 1 - (this.modifiedLineNumber + this._visibleLineCountTop.get());
        const bottom = (this.modifiedLineNumber - this._visibleLineCountBottom.get() + this.lineCount) - lineNumber;
        if (preference === 0 /* RevealPreference.FromCloserSide */ && top < bottom || preference === 1 /* RevealPreference.FromTop */) {
            this._visibleLineCountTop.set(this._visibleLineCountTop.get() + top, tx);
        }
        else {
            this._visibleLineCountBottom.set(this._visibleLineCountBottom.get() + bottom, tx);
        }
    }
    showOriginalLine(lineNumber, preference, tx) {
        const top = lineNumber - this.originalLineNumber;
        const bottom = (this.originalLineNumber + this.lineCount) - lineNumber;
        if (preference === 0 /* RevealPreference.FromCloserSide */ && top < bottom || preference === 1 /* RevealPreference.FromTop */) {
            this._visibleLineCountTop.set(Math.min(this._visibleLineCountTop.get() + bottom - top, this.getMaxVisibleLineCountTop()), tx);
        }
        else {
            this._visibleLineCountBottom.set(Math.min(this._visibleLineCountBottom.get() + top - bottom, this.getMaxVisibleLineCountBottom()), tx);
        }
    }
    collapseAll(tx) {
        this._visibleLineCountTop.set(0, tx);
        this._visibleLineCountBottom.set(0, tx);
    }
    setState(visibleLineCountTop, visibleLineCountBottom, tx) {
        visibleLineCountTop = Math.max(Math.min(visibleLineCountTop, this.lineCount), 0);
        visibleLineCountBottom = Math.max(Math.min(visibleLineCountBottom, this.lineCount - visibleLineCountTop), 0);
        this._visibleLineCountTop.set(visibleLineCountTop, tx);
        this._visibleLineCountBottom.set(visibleLineCountBottom, tx);
    }
}
export var RevealPreference;
(function (RevealPreference) {
    RevealPreference[RevealPreference["FromCloserSide"] = 0] = "FromCloserSide";
    RevealPreference[RevealPreference["FromTop"] = 1] = "FromTop";
    RevealPreference[RevealPreference["FromBottom"] = 2] = "FromBottom";
})(RevealPreference || (RevealPreference = {}));
function applyOriginalEdits(diff, textEdits, originalTextModel, modifiedTextModel) {
    return undefined;
    /*
    TODO@hediet
    if (textEdits.length === 0) {
        return diff;
    }

    const diff2 = flip(diff);
    const diff3 = applyModifiedEdits(diff2, textEdits, modifiedTextModel, originalTextModel);
    if (!diff3) {
        return undefined;
    }
    return flip(diff3);*/
}
/*
function flip(diff: IDocumentDiff): IDocumentDiff {
    return {
        changes: diff.changes.map(c => c.flip()),
        moves: diff.moves.map(m => m.flip()),
        identical: diff.identical,
        quitEarly: diff.quitEarly,
    };
}
*/
function applyModifiedEdits(diff, textEdits, originalTextModel, modifiedTextModel) {
    return undefined;
    /*
    TODO@hediet
    if (textEdits.length === 0) {
        return diff;
    }
    if (diff.changes.some(c => !c.innerChanges) || diff.moves.length > 0) {
        // TODO support these cases
        return undefined;
    }

    const changes = applyModifiedEditsToLineRangeMappings(diff.changes, textEdits, originalTextModel, modifiedTextModel);

    const moves = diff.moves.map(m => {
        const newModifiedRange = applyEditToLineRange(m.lineRangeMapping.modified, textEdits);
        return newModifiedRange ? new MovedText(
            new SimpleLineRangeMapping(m.lineRangeMapping.original, newModifiedRange),
            applyModifiedEditsToLineRangeMappings(m.changes, textEdits, originalTextModel, modifiedTextModel),
        ) : undefined;
    }).filter(isDefined);

    return {
        identical: false,
        quitEarly: false,
        changes,
        moves,
    };*/
}
/*
function applyEditToLineRange(range: LineRange, textEdits: TextEditInfo[]): LineRange | undefined {
    let rangeStartLineNumber = range.startLineNumber;
    let rangeEndLineNumberEx = range.endLineNumberExclusive;

    for (let i = textEdits.length - 1; i >= 0; i--) {
        const textEdit = textEdits[i];
        const textEditStartLineNumber = lengthGetLineCount(textEdit.startOffset) + 1;
        const textEditEndLineNumber = lengthGetLineCount(textEdit.endOffset) + 1;
        const newLengthLineCount = lengthGetLineCount(textEdit.newLength);
        const delta = newLengthLineCount - (textEditEndLineNumber - textEditStartLineNumber);

        if (textEditEndLineNumber < rangeStartLineNumber) {
            // the text edit is before us
            rangeStartLineNumber += delta;
            rangeEndLineNumberEx += delta;
        } else if (textEditStartLineNumber > rangeEndLineNumberEx) {
            // the text edit is after us
            // NOOP
        } else if (textEditStartLineNumber < rangeStartLineNumber && rangeEndLineNumberEx < textEditEndLineNumber) {
            // the range is fully contained in the text edit
            return undefined;
        } else if (textEditStartLineNumber < rangeStartLineNumber && textEditEndLineNumber <= rangeEndLineNumberEx) {
            // the text edit ends inside our range
            rangeStartLineNumber = textEditEndLineNumber + 1;
            rangeStartLineNumber += delta;
            rangeEndLineNumberEx += delta;
        } else if (rangeStartLineNumber <= textEditStartLineNumber && textEditEndLineNumber < rangeStartLineNumber) {
            // the text edit starts inside our range
            rangeEndLineNumberEx = textEditStartLineNumber;
        } else {
            rangeEndLineNumberEx += delta;
        }
    }

    return new LineRange(rangeStartLineNumber, rangeEndLineNumberEx);
}

function applyModifiedEditsToLineRangeMappings(changes: readonly LineRangeMapping[], textEdits: TextEditInfo[], originalTextModel: ITextModel, modifiedTextModel: ITextModel): LineRangeMapping[] {
    const diffTextEdits = changes.flatMap(c => c.innerChanges!.map(c => new TextEditInfo(
        positionToLength(c.originalRange.getStartPosition()),
        positionToLength(c.originalRange.getEndPosition()),
        lengthOfRange(c.modifiedRange).toLength(),
    )));

    const combined = combineTextEditInfos(diffTextEdits, textEdits);

    let lastOriginalEndOffset = lengthZero;
    let lastModifiedEndOffset = lengthZero;
    const rangeMappings = combined.map(c => {
        const modifiedStartOffset = lengthAdd(lastModifiedEndOffset, lengthDiffNonNegative(lastOriginalEndOffset, c.startOffset));
        lastOriginalEndOffset = c.endOffset;
        lastModifiedEndOffset = lengthAdd(modifiedStartOffset, c.newLength);

        return new RangeMapping(
            Range.fromPositions(lengthToPosition(c.startOffset), lengthToPosition(c.endOffset)),
            Range.fromPositions(lengthToPosition(modifiedStartOffset), lengthToPosition(lastModifiedEndOffset)),
        );
    });

    const newChanges = lineRangeMappingFromRangeMappings(
        rangeMappings,
        originalTextModel.getLinesContent(),
        modifiedTextModel.getLinesContent(),
    );
    return newChanges;
}
*/
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlmZkVkaXRvclZpZXdNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9kaWZmRWRpdG9yVmlld01vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDaEYsT0FBTyxFQUEyRCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLHlCQUF5QixFQUFFLGVBQWUsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDN08sT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDOUUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ2hELE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RGLE9BQU8sRUFBd0IsU0FBUyxFQUFFLFlBQVksRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3pHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDJFQUEyRSxDQUFDO0FBR3JILE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxnQkFBZ0IsRUFBRSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUdoSCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sOEZBQThGLENBQUM7QUFDNUgsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sMEZBQTBGLENBQUM7QUFFaEksT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0saUZBQWlG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