/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { derived } from '../../../../../base/common/observable.js';
import { DocumentLineRangeMap } from '../model/mapping.js';
import { ReentrancyBarrier } from '../../../../../base/common/controlFlow.js';
import { BugIndicatingError } from '../../../../../base/common/errors.js';
import { isDefined } from '../../../../../base/common/types.js';
export class ScrollSynchronizer extends Disposable {
    get model() { return this.viewModel.get()?.model; }
    get lockResultWithInputs() { return this.layout.get().kind === 'columns'; }
    get lockBaseWithInputs() { return this.layout.get().kind === 'mixed' && !this.layout.get().showBaseAtTop; }
    constructor(viewModel, input1View, input2View, baseView, inputResultView, layout) {
        super();
        this.viewModel = viewModel;
        this.input1View = input1View;
        this.input2View = input2View;
        this.baseView = baseView;
        this.inputResultView = inputResultView;
        this.layout = layout;
        this.reentrancyBarrier = new ReentrancyBarrier();
        this._isSyncing = true;
        const s = derived((reader) => {
            const baseView = this.baseView.read(reader);
            const editors = [this.input1View, this.input2View, this.inputResultView, baseView].filter(isDefined);
            const alignScrolling = (source, updateScrollLeft, updateScrollTop) => {
                this.reentrancyBarrier.runExclusivelyOrSkip(() => {
                    if (updateScrollLeft) {
                        const scrollLeft = source.editor.getScrollLeft();
                        for (const editorView of editors) {
                            if (editorView !== source) {
                                editorView.editor.setScrollLeft(scrollLeft, 1 /* ScrollType.Immediate */);
                            }
                        }
                    }
                    if (updateScrollTop) {
                        const scrollTop = source.editor.getScrollTop();
                        for (const editorView of editors) {
                            if (editorView !== source) {
                                if (this._shouldLock(source, editorView)) {
                                    editorView.editor.setScrollTop(scrollTop, 1 /* ScrollType.Immediate */);
                                }
                                else {
                                    const m = this._getMapping(source, editorView);
                                    if (m) {
                                        this._synchronizeScrolling(source.editor, editorView.editor, m);
                                    }
                                }
                            }
                        }
                    }
                });
            };
            for (const editorView of editors) {
                reader.store.add(editorView.editor.onDidScrollChange(e => {
                    if (!this._isSyncing) {
                        return;
                    }
                    alignScrolling(editorView, e.scrollLeftChanged, e.scrollTopChanged);
                }));
            }
            return {
                update: () => {
                    alignScrolling(this.inputResultView, true, true);
                }
            };
        }).recomputeInitiallyAndOnChange(this._store);
        this.updateScrolling = () => {
            s.get().update();
        };
    }
    stopSync() {
        this._isSyncing = false;
    }
    startSync() {
        this._isSyncing = true;
    }
    _shouldLock(editor1, editor2) {
        const isInput = (editor) => editor === this.input1View || editor === this.input2View;
        if (isInput(editor1) && editor2 === this.inputResultView || isInput(editor2) && editor1 === this.inputResultView) {
            return this.lockResultWithInputs;
        }
        if (isInput(editor1) && editor2 === this.baseView.get() || isInput(editor2) && editor1 === this.baseView.get()) {
            return this.lockBaseWithInputs;
        }
        if (isInput(editor1) && isInput(editor2)) {
            return true;
        }
        return false;
    }
    _getMapping(editor1, editor2) {
        if (editor1 === this.input1View) {
            if (editor2 === this.input2View) {
                return undefined;
            }
            else if (editor2 === this.inputResultView) {
                return this.model?.input1ResultMapping.get();
            }
            else if (editor2 === this.baseView.get()) {
                const b = this.model?.baseInput1Diffs.get();
                if (!b) {
                    return undefined;
                }
                return new DocumentLineRangeMap(b, -1).reverse();
            }
        }
        else if (editor1 === this.input2View) {
            if (editor2 === this.input1View) {
                return undefined;
            }
            else if (editor2 === this.inputResultView) {
                return this.model?.input2ResultMapping.get();
            }
            else if (editor2 === this.baseView.get()) {
                const b = this.model?.baseInput2Diffs.get();
                if (!b) {
                    return undefined;
                }
                return new DocumentLineRangeMap(b, -1).reverse();
            }
        }
        else if (editor1 === this.inputResultView) {
            if (editor2 === this.input1View) {
                return this.model?.resultInput1Mapping.get();
            }
            else if (editor2 === this.input2View) {
                return this.model?.resultInput2Mapping.get();
            }
            else if (editor2 === this.baseView.get()) {
                const b = this.model?.resultBaseMapping.get();
                if (!b) {
                    return undefined;
                }
                return b;
            }
        }
        else if (editor1 === this.baseView.get()) {
            if (editor2 === this.input1View) {
                const b = this.model?.baseInput1Diffs.get();
                if (!b) {
                    return undefined;
                }
                return new DocumentLineRangeMap(b, -1);
            }
            else if (editor2 === this.input2View) {
                const b = this.model?.baseInput2Diffs.get();
                if (!b) {
                    return undefined;
                }
                return new DocumentLineRangeMap(b, -1);
            }
            else if (editor2 === this.inputResultView) {
                const b = this.model?.baseResultMapping.get();
                if (!b) {
                    return undefined;
                }
                return b;
            }
        }
        throw new BugIndicatingError();
    }
    _synchronizeScrolling(scrollingEditor, targetEditor, mapping) {
        if (!mapping) {
            return;
        }
        const visibleRanges = scrollingEditor.getVisibleRanges();
        if (visibleRanges.length === 0) {
            return;
        }
        const topLineNumber = visibleRanges[0].startLineNumber - 1;
        const result = mapping.project(topLineNumber);
        const sourceRange = result.inputRange;
        const targetRange = result.outputRange;
        const resultStartTopPx = targetEditor.getTopForLineNumber(targetRange.startLineNumber);
        const resultEndPx = targetEditor.getTopForLineNumber(targetRange.endLineNumberExclusive);
        const sourceStartTopPx = scrollingEditor.getTopForLineNumber(sourceRange.startLineNumber);
        const sourceEndPx = scrollingEditor.getTopForLineNumber(sourceRange.endLineNumberExclusive);
        const factor = Math.min((scrollingEditor.getScrollTop() - sourceStartTopPx) / (sourceEndPx - sourceStartTopPx), 1);
        const resultScrollPosition = resultStartTopPx + (resultEndPx - resultStartTopPx) * factor;
        targetEditor.setScrollTop(resultScrollPosition, 1 /* ScrollType.Immediate */);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Nyb2xsU3luY2hyb25pemVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL21lcmdlRWRpdG9yL2Jyb3dzZXIvdmlldy9zY3JvbGxTeW5jaHJvbml6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxPQUFPLEVBQWUsTUFBTSwwQ0FBMEMsQ0FBQztBQUdoRixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQU85RSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMxRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFaEUsTUFBTSxPQUFPLGtCQUFtQixTQUFRLFVBQVU7SUFDakQsSUFBWSxLQUFLLEtBQUssT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFNM0QsSUFBWSxvQkFBb0IsS0FBSyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUM7SUFDbkYsSUFBWSxrQkFBa0IsS0FBSyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxLQUFLLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztJQUluSCxZQUNrQixTQUF3RCxFQUN4RCxVQUErQixFQUMvQixVQUErQixFQUMvQixRQUFxRCxFQUNyRCxlQUFxQyxFQUNyQyxNQUF1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