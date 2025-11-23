/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { observableSignal, runOnChange } from '../../../../../base/common/observable.js';
import { AnnotatedStringEdit } from '../../../../../editor/common/core/edits/stringEdit.js';
/**
 * Tracks a single document.
*/
export class DocumentEditSourceTracker extends Disposable {
    constructor(_doc, data) {
        super();
        this._doc = _doc;
        this.data = data;
        this._edits = AnnotatedStringEdit.empty;
        this._pendingExternalEdits = AnnotatedStringEdit.empty;
        this._update = observableSignal(this);
        this._representativePerKey = new Map();
        this._sumAddedCharactersPerKey = new Map();
        this._register(runOnChange(this._doc.value, (_val, _prevVal, edits) => {
            const eComposed = AnnotatedStringEdit.compose(edits.map(e => e.edit));
            if (eComposed.replacements.every(e => e.data.source.category === 'external')) {
                if (this._edits.isEmpty()) {
                    // Ignore initial external edits
                }
                else {
                    // queue pending external edits
                    this._pendingExternalEdits = this._pendingExternalEdits.compose(eComposed);
                }
            }
            else {
                if (!this._pendingExternalEdits.isEmpty()) {
                    this._applyEdit(this._pendingExternalEdits);
                    this._pendingExternalEdits = AnnotatedStringEdit.empty;
                }
                this._applyEdit(eComposed);
            }
            this._update.trigger(undefined);
        }));
    }
    _applyEdit(e) {
        for (const r of e.replacements) {
            let existing = this._sumAddedCharactersPerKey.get(r.data.key);
            if (existing === undefined) {
                existing = 0;
                this._representativePerKey.set(r.data.key, r.data.representative);
            }
            const newCount = existing + r.getNewLength();
            this._sumAddedCharactersPerKey.set(r.data.key, newCount);
        }
        this._edits = this._edits.compose(e);
    }
    async waitForQueue() {
        await this._doc.waitForQueue();
    }
    getTotalInsertedCharactersCount(key) {
        const val = this._sumAddedCharactersPerKey.get(key);
        return val ?? 0;
    }
    getAllKeys() {
        return Array.from(this._sumAddedCharactersPerKey.keys());
    }
    getRepresentative(key) {
        return this._representativePerKey.get(key);
    }
    getTrackedRanges(reader) {
        this._update.read(reader);
        const ranges = this._edits.getNewRanges();
        return ranges.map((r, idx) => {
            const e = this._edits.replacements[idx];
            const te = new TrackedEdit(e.replaceRange, r, e.data.key, e.data.source, e.data.representative);
            return te;
        });
    }
    isEmpty() {
        return this._edits.isEmpty();
    }
    _getDebugVisualization() {
        const ranges = this.getTrackedRanges();
        const txt = this._doc.value.get().value;
        return {
            ...{ $fileExtension: 'text.w' },
            'value': txt,
            'decorations': ranges.map(r => {
                return {
                    range: [r.range.start, r.range.endExclusive],
                    color: r.source.getColor(),
                };
            })
        };
    }
}
export class TrackedEdit {
    constructor(originalRange, range, sourceKey, source, sourceRepresentative) {
        this.originalRange = originalRange;
        this.range = range;
        this.sourceKey = sourceKey;
        this.source = source;
        this.sourceRepresentative = sourceRepresentative;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdFRyYWNrZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZWRpdFRlbGVtZXRyeS9icm93c2VyL3RlbGVtZXRyeS9lZGl0VHJhY2tlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLFdBQVcsRUFBVyxNQUFNLDBDQUEwQyxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBSzVGOztFQUVFO0FBQ0YsTUFBTSxPQUFPLHlCQUFvQyxTQUFRLFVBQVU7SUFRbEUsWUFDa0IsSUFBaUMsRUFDbEMsSUFBTztRQUV2QixLQUFLLEVBQUUsQ0FBQztRQUhTLFNBQUksR0FBSixJQUFJLENBQTZCO1FBQ2xDLFNBQUksR0FBSixJQUFJLENBQUc7UUFUaEIsV0FBTSxHQUEyQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUM7UUFDM0UsMEJBQXFCLEdBQTJDLG1CQUFtQixDQUFDLEtBQUssQ0FBQztRQUVqRixZQUFPLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakMsMEJBQXFCLEdBQXFDLElBQUksR0FBRyxFQUFFLENBQUM7UUFDcEUsOEJBQXlCLEdBQWlDLElBQUksR0FBRyxFQUFFLENBQUM7UUFRcEYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQ3JFLE1BQU0sU0FBUyxHQUFHLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FB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