/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { compareBy, numberComparator } from '../../../../../base/common/arrays.js';
import { BugIndicatingError } from '../../../../../base/common/errors.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { DetailedLineRangeMapping } from './mapping.js';
import { LineRangeEdit } from './editing.js';
import { MergeEditorLineRange } from './lineRange.js';
import { ReentrancyBarrier } from '../../../../../base/common/controlFlow.js';
import { autorun, observableSignal, observableValue, transaction } from '../../../../../base/common/observable.js';
export class TextModelDiffs extends Disposable {
    get isApplyingChange() {
        return this._barrier.isOccupied;
    }
    constructor(baseTextModel, textModel, diffComputer) {
        super();
        this.baseTextModel = baseTextModel;
        this.textModel = textModel;
        this.diffComputer = diffComputer;
        this._recomputeCount = 0;
        this._state = observableValue(this, 1 /* TextModelDiffState.initializing */);
        this._diffs = observableValue(this, []);
        this._barrier = new ReentrancyBarrier();
        this._isDisposed = false;
        this._isInitializing = true;
        const recomputeSignal = observableSignal('recompute');
        this._register(autorun(reader => {
            /** @description Update diff state */
            recomputeSignal.read(reader);
            this._recompute(reader);
        }));
        this._register(baseTextModel.onDidChangeContent(this._barrier.makeExclusiveOrSkip(() => {
            recomputeSignal.trigger(undefined);
        })));
        this._register(textModel.onDidChangeContent(this._barrier.makeExclusiveOrSkip(() => {
            recomputeSignal.trigger(undefined);
        })));
        this._register(toDisposable(() => {
            this._isDisposed = true;
        }));
    }
    get state() {
        return this._state;
    }
    /**
     * Diffs from base to input.
    */
    get diffs() {
        return this._diffs;
    }
    _recompute(reader) {
        this._recomputeCount++;
        const currentRecomputeIdx = this._recomputeCount;
        if (this._state.get() === 1 /* TextModelDiffState.initializing */) {
            this._isInitializing = true;
        }
        transaction(tx => {
            /** @description Starting Diff Computation. */
            this._state.set(this._isInitializing ? 1 /* TextModelDiffState.initializing */ : 3 /* TextModelDiffState.updating */, tx, 0 /* TextModelDiffChangeReason.other */);
        });
        const result = this.diffComputer.computeDiff(this.baseTextModel, this.textModel, reader);
        result.then((result) => {
            if (this._isDisposed) {
                return;
            }
            if (currentRecomputeIdx !== this._recomputeCount) {
                // There is a newer recompute call
                return;
            }
            transaction(tx => {
                /** @description Completed Diff Computation */
                if (result.diffs) {
                    this._state.set(2 /* TextModelDiffState.upToDate */, tx, 1 /* TextModelDiffChangeReason.textChange */);
                    this._diffs.set(result.diffs, tx, 1 /* TextModelDiffChangeReason.textChange */);
                }
                else {
                    this._state.set(4 /* TextModelDiffState.error */, tx, 1 /* TextModelDiffChangeReason.textChange */);
                }
                this._isInitializing = false;
            });
        });
    }
    ensureUpToDate() {
        if (this.state.get() !== 2 /* TextModelDiffState.upToDate */) {
            throw new BugIndicatingError('Cannot remove diffs when the model is not up to date');
        }
    }
    removeDiffs(diffToRemoves, transaction, group) {
        this.ensureUpToDate();
        diffToRemoves.sort(compareBy((d) => d.inputRange.startLineNumber, numberComparator));
        diffToRemoves.reverse();
        let diffs = this._diffs.get();
        for (const diffToRemove of diffToRemoves) {
            // TODO improve performance
            const len = diffs.length;
            diffs = diffs.filter((d) => d !== diffToRemove);
            if (len === diffs.length) {
                throw new BugIndicatingError();
            }
            this._barrier.runExclusivelyOrThrow(() => {
                const edits = diffToRemove.getReverseLineEdit().toEdits(this.textModel.getLineCount());
                this.textModel.pushEditOperations(null, edits, () => null, group);
            });
            diffs = diffs.map((d) => d.outputRange.isAfter(diffToRemove.outputRange)
                ? d.addOutputLineDelta(diffToRemove.inputRange.length - diffToRemove.outputRange.length)
                : d);
        }
        this._diffs.set(diffs, transaction, 0 /* TextModelDiffChangeReason.other */);
    }
    /**
     * Edit must be conflict free.
     */
    applyEditRelativeToOriginal(edit, transaction, group) {
        this.ensureUpToDate();
        const editMapping = new DetailedLineRangeMapping(edit.range, this.baseTextModel, MergeEditorLineRange.fromLength(edit.range.startLineNumber, edit.newLines.length), this.textModel);
        let firstAfter = false;
        let delta = 0;
        const newDiffs = new Array();
        for (const diff of this.diffs.get()) {
            if (diff.inputRange.intersectsOrTouches(edit.range)) {
                throw new BugIndicatingError('Edit must be conflict free.');
            }
            else if (diff.inputRange.isAfter(edit.range)) {
                if (!firstAfter) {
                    firstAfter = true;
                    newDiffs.push(editMapping.addOutputLineDelta(delta));
                }
                newDiffs.push(diff.addOutputLineDelta(edit.newLines.length - edit.range.length));
            }
            else {
                newDiffs.push(diff);
            }
            if (!firstAfter) {
                delta += diff.outputRange.length - diff.inputRange.length;
            }
        }
        if (!firstAfter) {
            firstAfter = true;
            newDiffs.push(editMapping.addOutputLineDelta(delta));
        }
        this._barrier.runExclusivelyOrThrow(() => {
            const edits = new LineRangeEdit(edit.range.delta(delta), edit.newLines).toEdits(this.textModel.getLineCount());
            this.textModel.pushEditOperations(null, edits, () => null, group);
        });
        this._diffs.set(newDiffs, transaction, 0 /* TextModelDiffChangeReason.other */);
    }
    findTouchingDiffs(baseRange) {
        return this.diffs.get().filter(d => d.inputRange.intersectsOrTouches(baseRange));
    }
    getResultLine(lineNumber, reader) {
        let offset = 0;
        const diffs = reader ? this.diffs.read(reader) : this.diffs.get();
        for (const diff of diffs) {
            if (diff.inputRange.contains(lineNumber) || diff.inputRange.endLineNumberExclusive === lineNumber) {
                return diff;
            }
            else if (diff.inputRange.endLineNumberExclusive < lineNumber) {
                offset = diff.resultingDeltaFromOriginalToModified;
            }
            else {
                break;
            }
        }
        return lineNumber + offset;
    }
    getResultLineRange(baseRange, reader) {
        let start = this.getResultLine(baseRange.startLineNumber, reader);
        if (typeof start !== 'number') {
            start = start.outputRange.startLineNumber;
        }
        let endExclusive = this.getResultLine(baseRange.endLineNumberExclusive, reader);
        if (typeof endExclusive !== 'number') {
            endExclusive = endExclusive.outputRange.endLineNumberExclusive;
        }
        return MergeEditorLineRange.fromLineNumbers(start, endExclusive);
    }
}
export var TextModelDiffChangeReason;
(function (TextModelDiffChangeReason) {
    TextModelDiffChangeReason[TextModelDiffChangeReason["other"] = 0] = "other";
    TextModelDiffChangeReason[TextModelDiffChangeReason["textChange"] = 1] = "textChange";
})(TextModelDiffChangeReason || (TextModelDiffChangeReason = {}));
export var TextModelDiffState;
(function (TextModelDiffState) {
    TextModelDiffState[TextModelDiffState["initializing"] = 1] = "initializing";
    TextModelDiffState[TextModelDiffState["upToDate"] = 2] = "upToDate";
    TextModelDiffState[TextModelDiffState["updating"] = 3] = "updating";
    TextModelDiffState[TextModelDiffState["error"] = 4] = "error";
})(TextModelDiffState || (TextModelDiffState = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dE1vZGVsRGlmZnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWVyZ2VFZGl0b3IvYnJvd3Nlci9tb2RlbC90ZXh0TW9kZWxEaWZmcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbkYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUVuRixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFDeEQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUM3QyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUN0RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUU5RSxPQUFPLEVBQUUsT0FBTyxFQUFnRCxnQkFBZ0IsRUFBRSxlQUFlLEVBQUUsV0FBVyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFHakssTUFBTSxPQUFPLGNBQWUsU0FBUSxVQUFVO0lBUTdDLElBQVcsZ0JBQWdCO1FBQzFCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7SUFDakMsQ0FBQztJQUVELFlBQ2tCLGFBQXlCLEVBQ3pCLFNBQXFCLEVBQ3JCLFlBQWdDO1FBRWpELEtBQUssRUFBRSxDQUFDO1FBSlMsa0JBQWEsR0FBYixhQUFhLENBQVk7UUFDekIsY0FBUyxHQUFULFNBQVMsQ0FBWTtRQUNyQixpQkFBWSxHQUFaLFlBQVksQ0FBb0I7UUFkMUMsb0JBQWUsR0FBRyxDQUFDLENBQUM7UUFDWCxXQUFNLEdBQUcsZUFBZSxDQUFn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