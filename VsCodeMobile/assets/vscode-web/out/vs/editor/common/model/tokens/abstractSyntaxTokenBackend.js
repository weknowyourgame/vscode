/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { equals } from '../../../../base/common/arrays.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { LineRange } from '../../core/ranges/lineRange.js';
import { derivedOpts, observableSignal, observableValueOpts } from '../../../../base/common/observable.js';
import { equalsIfDefined, itemEquals, itemsEquals } from '../../../../base/common/equals.js';
/**
 * @internal
 */
export class AttachedViews {
    constructor() {
        this._onDidChangeVisibleRanges = new Emitter();
        this.onDidChangeVisibleRanges = this._onDidChangeVisibleRanges.event;
        this._views = new Set();
        this._viewsChanged = observableSignal(this);
        this.visibleLineRanges = derivedOpts({
            owner: this,
            equalsFn: itemsEquals(itemEquals())
        }, reader => {
            this._viewsChanged.read(reader);
            const ranges = LineRange.joinMany([...this._views].map(view => view.state.read(reader)?.visibleLineRanges ?? []));
            return ranges;
        });
    }
    attachView() {
        const view = new AttachedViewImpl((state) => {
            this._onDidChangeVisibleRanges.fire({ view, state });
        });
        this._views.add(view);
        this._viewsChanged.trigger(undefined);
        return view;
    }
    detachView(view) {
        this._views.delete(view);
        this._onDidChangeVisibleRanges.fire({ view, state: undefined });
        this._viewsChanged.trigger(undefined);
    }
}
/**
 * @internal
 */
export class AttachedViewState {
    constructor(visibleLineRanges, stabilized) {
        this.visibleLineRanges = visibleLineRanges;
        this.stabilized = stabilized;
    }
    equals(other) {
        if (this === other) {
            return true;
        }
        if (!equals(this.visibleLineRanges, other.visibleLineRanges, (a, b) => a.equals(b))) {
            return false;
        }
        if (this.stabilized !== other.stabilized) {
            return false;
        }
        return true;
    }
}
class AttachedViewImpl {
    get state() { return this._state; }
    constructor(handleStateChange) {
        this.handleStateChange = handleStateChange;
        this._state = observableValueOpts({ owner: this, equalsFn: equalsIfDefined((a, b) => a.equals(b)) }, undefined);
    }
    setVisibleLines(visibleLines, stabilized) {
        const visibleLineRanges = visibleLines.map((line) => new LineRange(line.startLineNumber, line.endLineNumber + 1));
        const state = new AttachedViewState(visibleLineRanges, stabilized);
        this._state.set(state, undefined, undefined);
        this.handleStateChange(state);
    }
}
export class AttachedViewHandler extends Disposable {
    get lineRanges() { return this._lineRanges; }
    constructor(_refreshTokens) {
        super();
        this._refreshTokens = _refreshTokens;
        this.runner = this._register(new RunOnceScheduler(() => this.update(), 50));
        this._computedLineRanges = [];
        this._lineRanges = [];
    }
    update() {
        if (equals(this._computedLineRanges, this._lineRanges, (a, b) => a.equals(b))) {
            return;
        }
        this._computedLineRanges = this._lineRanges;
        this._refreshTokens();
    }
    handleStateChange(state) {
        this._lineRanges = state.visibleLineRanges;
        if (state.stabilized) {
            this.runner.cancel();
            this.update();
        }
        else {
            this.runner.schedule();
        }
    }
}
export class AbstractSyntaxTokenBackend extends Disposable {
    get backgroundTokenizationState() {
        return this._backgroundTokenizationState;
    }
    constructor(_languageIdCodec, _textModel) {
        super();
        this._languageIdCodec = _languageIdCodec;
        this._textModel = _textModel;
        this._onDidChangeTokens = this._register(new Emitter());
        /** @internal, should not be exposed by the text model! */
        this.onDidChangeTokens = this._onDidChangeTokens.event;
    }
    tokenizeIfCheap(lineNumber) {
        if (this.isCheapToTokenize(lineNumber)) {
            this.forceTokenization(lineNumber);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJzdHJhY3RTeW50YXhUb2tlbkJhY2tlbmQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi9tb2RlbC90b2tlbnMvYWJzdHJhY3RTeW50YXhUb2tlbkJhY2tlbmQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBUTNELE9BQU8sRUFBRSxXQUFXLEVBQW9DLGdCQUFnQixFQUFFLG1CQUFtQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDN0ksT0FBTyxFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFN0Y7O0dBRUc7QUFDSCxNQUFNLE9BQU8sYUFBYTtJQVN6QjtRQVJpQiw4QkFBeUIsR0FBRyxJQUFJLE9BQU8sRUFBaUUsQ0FBQztRQUMxRyw2QkFBd0IsR0FBRyxJQUFJLENBQUMseUJBQXlCLENBQUMsS0FBSyxDQUFDO1FBRS9ELFdBQU0sR0FBRyxJQUFJLEdBQUcsRUFBb0IsQ0FBQztRQUNyQyxrQkFBYSxHQUFHLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBS3ZELElBQUksQ0FBQyxpQkFBaUIsR0FBRyxXQUFXLENBQUM7WUFDcEMsS0FBSyxFQUFFLElBQUk7WUFDWCxRQUFRLEVBQUUsV0FBVyxDQUFDLFVBQVUsRUFBRSxDQUFDO1NBQ25DLEVBQUUsTUFBTSxDQUFDLEVBQUU7WUFDWCxJQUFJ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