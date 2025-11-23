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
import { findLast } from '../../../../../base/common/arraysFind.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { derived, derivedObservableWithWritableCache, observableValue, transaction } from '../../../../../base/common/observable.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { MergeEditorLineRange } from '../model/lineRange.js';
import { observableConfigValue } from '../../../../../platform/observable/common/platformObservableUtils.js';
let MergeEditorViewModel = class MergeEditorViewModel extends Disposable {
    constructor(model, inputCodeEditorView1, inputCodeEditorView2, resultCodeEditorView, baseCodeEditorView, showNonConflictingChanges, configurationService, notificationService) {
        super();
        this.model = model;
        this.inputCodeEditorView1 = inputCodeEditorView1;
        this.inputCodeEditorView2 = inputCodeEditorView2;
        this.resultCodeEditorView = resultCodeEditorView;
        this.baseCodeEditorView = baseCodeEditorView;
        this.showNonConflictingChanges = showNonConflictingChanges;
        this.configurationService = configurationService;
        this.notificationService = notificationService;
        this.manuallySetActiveModifiedBaseRange = observableValue(this, { range: undefined, counter: 0 });
        this.attachedHistory = this._register(new AttachedHistory(this.model.resultTextModel));
        this.shouldUseAppendInsteadOfAccept = observableConfigValue('mergeEditor.shouldUseAppendInsteadOfAccept', false, this.configurationService);
        this.counter = 0;
        this.lastFocusedEditor = derivedObservableWithWritableCache(this, (reader, lastValue) => {
            const editors = [
                this.inputCodeEditorView1,
                this.inputCodeEditorView2,
                this.resultCodeEditorView,
                this.baseCodeEditorView.read(reader),
            ];
            const view = editors.find((e) => e && e.isFocused.read(reader));
            return view ? { view, counter: this.counter++ } : lastValue || { view: undefined, counter: this.counter++ };
        });
        this.baseShowDiffAgainst = derived(this, reader => {
            const lastFocusedEditor = this.lastFocusedEditor.read(reader);
            if (lastFocusedEditor.view === this.inputCodeEditorView1) {
                return 1;
            }
            else if (lastFocusedEditor.view === this.inputCodeEditorView2) {
                return 2;
            }
            return undefined;
        });
        this.focusedEditorType = derived(this, reader => {
            const lastFocusedEditor = this.lastFocusedEditor.read(reader);
            if (!lastFocusedEditor.view) {
                return undefined;
            }
            if (lastFocusedEditor.view === this.inputCodeEditorView1) {
                return 'input1';
            }
            else if (lastFocusedEditor.view === this.inputCodeEditorView2) {
                return 'input2';
            }
            else if (lastFocusedEditor.view === this.resultCodeEditorView) {
                return 'result';
            }
            else if (lastFocusedEditor.view === this.baseCodeEditorView.read(reader)) {
                return 'base';
            }
            return undefined;
        });
        this.selectionInBase = derived(this, reader => {
            const sourceEditor = this.lastFocusedEditor.read(reader).view;
            if (!sourceEditor) {
                return undefined;
            }
            const selections = sourceEditor.selection.read(reader) || [];
            const rangesInBase = selections.map((selection) => {
                if (sourceEditor === this.inputCodeEditorView1) {
                    return this.model.translateInputRangeToBase(1, selection);
                }
                else if (sourceEditor === this.inputCodeEditorView2) {
                    return this.model.translateInputRangeToBase(2, selection);
                }
                else if (sourceEditor === this.resultCodeEditorView) {
                    return this.model.translateResultRangeToBase(selection);
                }
                else if (sourceEditor === this.baseCodeEditorView.read(reader)) {
                    return selection;
                }
                else {
                    return selection;
                }
            });
            return {
                rangesInBase,
                sourceEditor
            };
        });
        this.activeModifiedBaseRange = derived(this, (reader) => {
            /** @description activeModifiedBaseRange */
            const focusedEditor = this.lastFocusedEditor.read(reader);
            const manualRange = this.manuallySetActiveModifiedBaseRange.read(reader);
            if (manualRange.counter > focusedEditor.counter) {
                return manualRange.range;
            }
            if (!focusedEditor.view) {
                return;
            }
            const cursorLineNumber = focusedEditor.view.cursorLineNumber.read(reader);
            if (!cursorLineNumber) {
                return undefined;
            }
            const modifiedBaseRanges = this.model.modifiedBaseRanges.read(reader);
            return modifiedBaseRanges.find((r) => {
                const range = this.getRangeOfModifiedBaseRange(focusedEditor.view, r, reader);
                return range.isEmpty
                    ? range.startLineNumber === cursorLineNumber
                    : range.contains(cursorLineNumber);
            });
        });
        this._register(resultCodeEditorView.editor.onDidChangeModelContent(e => {
            if (this.model.isApplyingEditInResult || e.isRedoing || e.isUndoing) {
                return;
            }
            const baseRangeStates = [];
            for (const change of e.changes) {
                const rangeInBase = this.model.translateResultRangeToBase(Range.lift(change.range));
                const baseRanges = this.model.findModifiedBaseRangesInRange(MergeEditorLineRange.fromLength(rangeInBase.startLineNumber, rangeInBase.endLineNumber - rangeInBase.startLineNumber));
                if (baseRanges.length === 1) {
                    const isHandled = this.model.isHandled(baseRanges[0]).get();
                    if (!isHandled) {
                        baseRangeStates.push(baseRanges[0]);
                    }
                }
            }
            if (baseRangeStates.length === 0) {
                return;
            }
            const element = {
                model: this.model,
                redo() {
                    transaction(tx => {
                        /** @description Mark conflicts touched by manual edits as handled */
                        for (const r of baseRangeStates) {
                            this.model.setHandled(r, true, tx);
                        }
                    });
                },
                undo() {
                    transaction(tx => {
                        /** @description Mark conflicts touched by manual edits as handled */
                        for (const r of baseRangeStates) {
                            this.model.setHandled(r, false, tx);
                        }
                    });
                },
            };
            this.attachedHistory.pushAttachedHistoryElement(element);
            element.redo();
        }));
    }
    getRangeOfModifiedBaseRange(editor, modifiedBaseRange, reader) {
        if (editor === this.resultCodeEditorView) {
            return this.model.getLineRangeInResult(modifiedBaseRange.baseRange, reader);
        }
        else if (editor === this.baseCodeEditorView.get()) {
            return modifiedBaseRange.baseRange;
        }
        else {
            const input = editor === this.inputCodeEditorView1 ? 1 : 2;
            return modifiedBaseRange.getInputRange(input);
        }
    }
    setActiveModifiedBaseRange(range, tx) {
        this.manuallySetActiveModifiedBaseRange.set({ range, counter: this.counter++ }, tx);
    }
    setState(baseRange, state, tx, inputNumber) {
        this.manuallySetActiveModifiedBaseRange.set({ range: baseRange, counter: this.counter++ }, tx);
        this.model.setState(baseRange, state, inputNumber, tx);
        this.lastFocusedEditor.clearCache(tx);
    }
    goToConflict(getModifiedBaseRange) {
        let editor = this.lastFocusedEditor.get().view;
        if (!editor) {
            editor = this.resultCodeEditorView;
        }
        const curLineNumber = editor.editor.getPosition()?.lineNumber;
        if (curLineNumber === undefined) {
            return;
        }
        const modifiedBaseRange = getModifiedBaseRange(editor, curLineNumber);
        if (modifiedBaseRange) {
            const range = this.getRangeOfModifiedBaseRange(editor, modifiedBaseRange, undefined);
            editor.editor.focus();
            let startLineNumber = range.startLineNumber;
            let endLineNumberExclusive = range.endLineNumberExclusive;
            if (range.startLineNumber > editor.editor.getModel().getLineCount()) {
                transaction(tx => {
                    this.setActiveModifiedBaseRange(modifiedBaseRange, tx);
                });
                startLineNumber = endLineNumberExclusive = editor.editor.getModel().getLineCount();
            }
            editor.editor.setPosition({
                lineNumber: startLineNumber,
                column: editor.editor.getModel().getLineFirstNonWhitespaceColumn(startLineNumber),
            });
            editor.editor.revealLinesNearTop(startLineNumber, endLineNumberExclusive, 0 /* ScrollType.Smooth */);
        }
    }
    goToNextModifiedBaseRange(predicate) {
        this.goToConflict((e, l) => this.model.modifiedBaseRanges
            .get()
            .find((r) => predicate(r) &&
            this.getRangeOfModifiedBaseRange(e, r, undefined).startLineNumber > l) ||
            this.model.modifiedBaseRanges
                .get()
                .find((r) => predicate(r)));
    }
    goToPreviousModifiedBaseRange(predicate) {
        this.goToConflict((e, l) => findLast(this.model.modifiedBaseRanges.get(), (r) => predicate(r) &&
            this.getRangeOfModifiedBaseRange(e, r, undefined).endLineNumberExclusive < l) ||
            findLast(this.model.modifiedBaseRanges.get(), (r) => predicate(r)));
    }
    toggleActiveConflict(inputNumber) {
        const activeModifiedBaseRange = this.activeModifiedBaseRange.get();
        if (!activeModifiedBaseRange) {
            this.notificationService.error(localize('noConflictMessage', "There is currently no conflict focused that can be toggled."));
            return;
        }
        transaction(tx => {
            /** @description Toggle Active Conflict */
            this.setState(activeModifiedBaseRange, this.model.getState(activeModifiedBaseRange).get().toggle(inputNumber), tx, inputNumber);
        });
    }
    acceptAll(inputNumber) {
        transaction(tx => {
            /** @description Toggle Active Conflict */
            for (const range of this.model.modifiedBaseRanges.get()) {
                this.setState(range, this.model.getState(range).get().withInputValue(inputNumber, true), tx, inputNumber);
            }
        });
    }
};
MergeEditorViewModel = __decorate([
    __param(6, IConfigurationService),
    __param(7, INotificationService)
], MergeEditorViewModel);
export { MergeEditorViewModel };
class AttachedHistory extends Disposable {
    constructor(model) {
        super();
        this.model = model;
        this.attachedHistory = [];
        this.previousAltId = this.model.getAlternativeVersionId();
        this._register(model.onDidChangeContent((e) => {
            const currentAltId = model.getAlternativeVersionId();
            if (e.isRedoing) {
                for (const item of this.attachedHistory) {
                    if (this.previousAltId < item.altId && item.altId <= currentAltId) {
                        item.element.redo();
                    }
                }
            }
            else if (e.isUndoing) {
                for (let i = this.attachedHistory.length - 1; i >= 0; i--) {
                    const item = this.attachedHistory[i];
                    if (currentAltId < item.altId && item.altId <= this.previousAltId) {
                        item.element.undo();
                    }
                }
            }
            else {
                // The user destroyed the redo stack by performing a non redo/undo operation.
                // Thus we also need to remove all history elements after the last version id.
                while (this.attachedHistory.length > 0
                    && this.attachedHistory[this.attachedHistory.length - 1].altId > this.previousAltId) {
                    this.attachedHistory.pop();
                }
            }
            this.previousAltId = currentAltId;
        }));
    }
    /**
     * Pushes an history item that is tied to the last text edit (or an extension of it).
     * When the last text edit is undone/redone, so is is this history item.
     */
    pushAttachedHistoryElement(element) {
        this.attachedHistory.push({ altId: this.model.getAlternativeVersionId(), element });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld01vZGVsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL21lcmdlRWRpdG9yL2Jyb3dzZXIvdmlldy92aWV3TW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsT0FBTyxFQUFFLGtDQUFrQyxFQUFzQyxlQUFlLEVBQUUsV0FBVyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDekssT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBR25FLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUc3RCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxzRUFBc0UsQ0FBQztBQU10RyxJQUFNLG9CQUFvQixHQUExQixNQUFNLG9CQUFxQixTQUFRLFVBQVU7SUFLbkQsWUFDaUIsS0FBdUIsRUFDdkIsb0JBQXlDLEVBQ3pDLG9CQUF5QyxFQUN6QyxvQkFBMEMsRUFDMUMsa0JBQStELEVBQy9ELHlCQUErQyxFQUN2QixvQkFBMkMsRUFDNUMsbUJBQXlDO1FBRWhGLEtBQUssRUFBRSxDQUFDO1FBVFEsVUFBSyxHQUFMLEtBQUssQ0FBa0I7UUFDdkIseUJBQW9CLEdBQXBCLG9CQUFvQixDQUFxQjtRQUN6Qyx5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXFCO1FBQ3pD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