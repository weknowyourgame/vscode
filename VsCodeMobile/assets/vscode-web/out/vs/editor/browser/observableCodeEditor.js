/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { equalsIfDefined, itemsEquals } from '../../base/common/equals.js';
import { Disposable, DisposableStore, toDisposable } from '../../base/common/lifecycle.js';
import { DebugLocation, TransactionImpl, autorun, autorunOpts, derived, derivedOpts, derivedWithSetter, observableFromEvent, observableSignal, observableSignalFromEvent, observableValue, observableValueOpts } from '../../base/common/observable.js';
import { LineRange } from '../common/core/ranges/lineRange.js';
import { OffsetRange } from '../common/core/ranges/offsetRange.js';
import { Position } from '../common/core/position.js';
import { Selection } from '../common/core/selection.js';
import { Point } from '../common/core/2d/point.js';
/**
 * Returns a facade for the code editor that provides observables for various states/events.
*/
export function observableCodeEditor(editor) {
    return ObservableCodeEditor.get(editor);
}
export class ObservableCodeEditor extends Disposable {
    static { this._map = new Map(); }
    /**
     * Make sure that editor is not disposed yet!
    */
    static get(editor) {
        let result = ObservableCodeEditor._map.get(editor);
        if (!result) {
            result = new ObservableCodeEditor(editor);
            ObservableCodeEditor._map.set(editor, result);
            const d = editor.onDidDispose(() => {
                const item = ObservableCodeEditor._map.get(editor);
                if (item) {
                    ObservableCodeEditor._map.delete(editor);
                    item.dispose();
                    d.dispose();
                }
            });
        }
        return result;
    }
    _beginUpdate() {
        this._updateCounter++;
        if (this._updateCounter === 1) {
            this._currentTransaction = new TransactionImpl(() => {
                /** @description Update editor state */
            });
        }
    }
    _endUpdate() {
        this._updateCounter--;
        if (this._updateCounter === 0) {
            const t = this._currentTransaction;
            this._currentTransaction = undefined;
            t.finish();
        }
    }
    constructor(editor) {
        super();
        this.editor = editor;
        this._updateCounter = 0;
        this._currentTransaction = undefined;
        this._model = observableValue(this, this.editor.getModel());
        this.model = this._model;
        this.isReadonly = observableFromEvent(this, this.editor.onDidChangeConfiguration, () => this.editor.getOption(104 /* EditorOption.readOnly */));
        this._versionId = observableValueOpts({ owner: this, lazy: true }, this.editor.getModel()?.getVersionId() ?? null);
        this.versionId = this._versionId;
        this._selections = observableValueOpts({ owner: this, equalsFn: equalsIfDefined(itemsEquals(Selection.selectionsEqual)), lazy: true }, this.editor.getSelections() ?? null);
        this.selections = this._selections;
        this.positions = derivedOpts({ owner: this, equalsFn: equalsIfDefined(itemsEquals(Position.equals)) }, reader => this.selections.read(reader)?.map(s => s.getStartPosition()) ?? null);
        this.isFocused = observableFromEvent(this, e => {
            const d1 = this.editor.onDidFocusEditorWidget(e);
            const d2 = this.editor.onDidBlurEditorWidget(e);
            return {
                dispose() {
                    d1.dispose();
                    d2.dispose();
                }
            };
        }, () => this.editor.hasWidgetFocus());
        this.isTextFocused = observableFromEvent(this, e => {
            const d1 = this.editor.onDidFocusEditorText(e);
            const d2 = this.editor.onDidBlurEditorText(e);
            return {
                dispose() {
                    d1.dispose();
                    d2.dispose();
                }
            };
        }, () => this.editor.hasTextFocus());
        this.inComposition = observableFromEvent(this, e => {
            const d1 = this.editor.onDidCompositionStart(() => {
                e(undefined);
            });
            const d2 = this.editor.onDidCompositionEnd(() => {
                e(undefined);
            });
            return {
                dispose() {
                    d1.dispose();
                    d2.dispose();
                }
            };
        }, () => this.editor.inComposition);
        this.value = derivedWithSetter(this, reader => { this.versionId.read(reader); return this.model.read(reader)?.getValue() ?? ''; }, (value, tx) => {
            const model = this.model.get();
            if (model !== null) {
                if (value !== model.getValue()) {
                    model.setValue(value);
                }
            }
        });
        this.valueIsEmpty = derived(this, reader => { this.versionId.read(reader); return this.editor.getModel()?.getValueLength() === 0; });
        this.cursorSelection = derivedOpts({ owner: this, equalsFn: equalsIfDefined(Selection.selectionsEqual) }, reader => this.selections.read(reader)?.[0] ?? null);
        this.cursorPosition = derivedOpts({ owner: this, equalsFn: Position.equals }, reader => this.selections.read(reader)?.[0]?.getPosition() ?? null);
        this.cursorLineNumber = derived(this, reader => this.cursorPosition.read(reader)?.lineNumber ?? null);
        this.onDidType = observableSignal(this);
        this.onDidPaste = observableSignal(this);
        this.scrollTop = observableFromEvent(this.editor.onDidScrollChange, () => this.editor.getScrollTop());
        this.scrollLeft = observableFromEvent(this.editor.onDidScrollChange, () => this.editor.getScrollLeft());
        this.layoutInfo = observableFromEvent(this.editor.onDidLayoutChange, () => this.editor.getLayoutInfo());
        this.layoutInfoContentLeft = this.layoutInfo.map(l => l.contentLeft);
        this.layoutInfoDecorationsLeft = this.layoutInfo.map(l => l.decorationsLeft);
        this.layoutInfoWidth = this.layoutInfo.map(l => l.width);
        this.layoutInfoHeight = this.layoutInfo.map(l => l.height);
        this.layoutInfoMinimap = this.layoutInfo.map(l => l.minimap);
        this.layoutInfoVerticalScrollbarWidth = this.layoutInfo.map(l => l.verticalScrollbarWidth);
        this.contentWidth = observableFromEvent(this.editor.onDidContentSizeChange, () => this.editor.getContentWidth());
        this.contentHeight = observableFromEvent(this.editor.onDidContentSizeChange, () => this.editor.getContentHeight());
        this._onDidChangeViewZones = observableSignalFromEvent(this, this.editor.onDidChangeViewZones);
        this._onDidHiddenAreasChanged = observableSignalFromEvent(this, this.editor.onDidChangeHiddenAreas);
        this._onDidLineHeightChanged = observableSignalFromEvent(this, this.editor.onDidChangeLineHeight);
        this._widgetCounter = 0;
        this.openedPeekWidgets = observableValue(this, 0);
        this._register(this.editor.onBeginUpdate(() => this._beginUpdate()));
        this._register(this.editor.onEndUpdate(() => this._endUpdate()));
        this._register(this.editor.onDidChangeModel(() => {
            this._beginUpdate();
            try {
                this._model.set(this.editor.getModel(), this._currentTransaction);
                this._forceUpdate();
            }
            finally {
                this._endUpdate();
            }
        }));
        this._register(this.editor.onDidType((e) => {
            this._beginUpdate();
            try {
                this._forceUpdate();
                this.onDidType.trigger(this._currentTransaction, e);
            }
            finally {
                this._endUpdate();
            }
        }));
        this._register(this.editor.onDidPaste((e) => {
            this._beginUpdate();
            try {
                this._forceUpdate();
                this.onDidPaste.trigger(this._currentTransaction, e);
            }
            finally {
                this._endUpdate();
            }
        }));
        this._register(this.editor.onDidChangeModelContent(e => {
            this._beginUpdate();
            try {
                this._versionId.set(this.editor.getModel()?.getVersionId() ?? null, this._currentTransaction, e);
                this._forceUpdate();
            }
            finally {
                this._endUpdate();
            }
        }));
        this._register(this.editor.onDidChangeCursorSelection(e => {
            this._beginUpdate();
            try {
                this._selections.set(this.editor.getSelections(), this._currentTransaction, e);
                this._forceUpdate();
            }
            finally {
                this._endUpdate();
            }
        }));
        this.domNode = derived(reader => {
            this.model.read(reader);
            return this.editor.getDomNode();
        });
    }
    forceUpdate(cb) {
        this._beginUpdate();
        try {
            this._forceUpdate();
            if (!cb) {
                return undefined;
            }
            return cb(this._currentTransaction);
        }
        finally {
            this._endUpdate();
        }
    }
    _forceUpdate() {
        this._beginUpdate();
        try {
            this._model.set(this.editor.getModel(), this._currentTransaction);
            this._versionId.set(this.editor.getModel()?.getVersionId() ?? null, this._currentTransaction, undefined);
            this._selections.set(this.editor.getSelections(), this._currentTransaction, undefined);
        }
        finally {
            this._endUpdate();
        }
    }
    getOption(id, debugLocation = DebugLocation.ofCaller()) {
        return observableFromEvent(this, cb => this.editor.onDidChangeConfiguration(e => {
            if (e.hasChanged(id)) {
                cb(undefined);
            }
        }), () => this.editor.getOption(id), debugLocation);
    }
    setDecorations(decorations) {
        const d = new DisposableStore();
        const decorationsCollection = this.editor.createDecorationsCollection();
        d.add(autorunOpts({ owner: this, debugName: () => `Apply decorations from ${decorations.debugName}` }, reader => {
            const d = decorations.read(reader);
            decorationsCollection.set(d);
        }));
        d.add({
            dispose: () => {
                decorationsCollection.clear();
            }
        });
        return d;
    }
    createOverlayWidget(widget) {
        const overlayWidgetId = 'observableOverlayWidget' + (this._widgetCounter++);
        const w = {
            getDomNode: () => widget.domNode,
            getPosition: () => widget.position.get(),
            getId: () => overlayWidgetId,
            allowEditorOverflow: widget.allowEditorOverflow,
            getMinContentWidthInPx: () => widget.minContentWidthInPx.get(),
        };
        this.editor.addOverlayWidget(w);
        const d = autorun(reader => {
            widget.position.read(reader);
            widget.minContentWidthInPx.read(reader);
            this.editor.layoutOverlayWidget(w);
        });
        return toDisposable(() => {
            d.dispose();
            this.editor.removeOverlayWidget(w);
        });
    }
    createContentWidget(widget) {
        const contentWidgetId = 'observableContentWidget' + (this._widgetCounter++);
        const w = {
            getDomNode: () => widget.domNode,
            getPosition: () => widget.position.get(),
            getId: () => contentWidgetId,
            allowEditorOverflow: widget.allowEditorOverflow,
        };
        this.editor.addContentWidget(w);
        const d = autorun(reader => {
            widget.position.read(reader);
            this.editor.layoutContentWidget(w);
        });
        return toDisposable(() => {
            d.dispose();
            this.editor.removeContentWidget(w);
        });
    }
    observeLineOffsetRange(lineRange, store) {
        const start = this.observePosition(lineRange.map(r => new Position(r.startLineNumber, 1)), store);
        const end = this.observePosition(lineRange.map(r => new Position(r.endLineNumberExclusive + 1, 1)), store);
        return derived(reader => {
            start.read(reader);
            end.read(reader);
            const range = lineRange.read(reader);
            const lineCount = this.model.read(reader)?.getLineCount();
            const s = ((typeof lineCount !== 'undefined' && range.startLineNumber > lineCount
                ? this.editor.getBottomForLineNumber(lineCount)
                : this.editor.getTopForLineNumber(range.startLineNumber))
                - this.scrollTop.read(reader));
            const e = range.isEmpty ? s : (this.editor.getBottomForLineNumber(range.endLineNumberExclusive - 1) - this.scrollTop.read(reader));
            return new OffsetRange(s, e);
        });
    }
    /**
     * Uses an approximation if the exact position cannot be determined.
     */
    getLeftOfPosition(position, reader) {
        this.layoutInfo.read(reader);
        this.value.read(reader);
        let offset = this.editor.getOffsetForColumn(position.lineNumber, position.column);
        if (offset === -1) {
            // approximation
            const typicalHalfwidthCharacterWidth = this.editor.getOption(59 /* EditorOption.fontInfo */).typicalHalfwidthCharacterWidth;
            const approximation = position.column * typicalHalfwidthCharacterWidth;
            offset = approximation;
        }
        return offset;
    }
    observePosition(position, store) {
        let pos = position.get();
        const result = observableValueOpts({ owner: this, debugName: () => `topLeftOfPosition${pos?.toString()}`, equalsFn: equalsIfDefined(Point.equals) }, new Point(0, 0));
        const contentWidgetId = `observablePositionWidget` + (this._widgetCounter++);
        const domNode = document.createElement('div');
        const w = {
            getDomNode: () => domNode,
            getPosition: () => {
                return pos ? { preference: [0 /* ContentWidgetPositionPreference.EXACT */], position: position.get() } : null;
            },
            getId: () => contentWidgetId,
            allowEditorOverflow: false,
            afterRender: (position, coordinate) => {
                const model = this._model.get();
                if (model && pos && pos.lineNumber > model.getLineCount()) {
                    // the position is after the last line
                    result.set(new Point(0, this.editor.getBottomForLineNumber(model.getLineCount()) - this.scrollTop.get()), undefined);
                }
                else {
                    result.set(coordinate ? new Point(coordinate.left, coordinate.top) : null, undefined);
                }
            },
        };
        this.editor.addContentWidget(w);
        store.add(autorun(reader => {
            pos = position.read(reader);
            this.editor.layoutContentWidget(w);
        }));
        store.add(toDisposable(() => {
            this.editor.removeContentWidget(w);
        }));
        return result;
    }
    isTargetHovered(predicate, store) {
        const isHovered = observableValue('isInjectedTextHovered', false);
        store.add(this.editor.onMouseMove(e => {
            const val = predicate(e);
            isHovered.set(val, undefined);
        }));
        store.add(this.editor.onMouseLeave(E => {
            isHovered.set(false, undefined);
        }));
        return isHovered;
    }
    observeLineHeightForPosition(position) {
        return derived(reader => {
            const pos = position instanceof Position ? position : position.read(reader);
            if (pos === null) {
                return null;
            }
            this.getOption(75 /* EditorOption.lineHeight */).read(reader);
            return this.editor.getLineHeightForPosition(pos);
        });
    }
    observeLineHeightForLine(lineNumber) {
        if (typeof lineNumber === 'number') {
            return this.observeLineHeightForPosition(new Position(lineNumber, 1));
        }
        return derived(reader => {
            const line = lineNumber.read(reader);
            if (line === null) {
                return null;
            }
            return this.observeLineHeightForPosition(new Position(line, 1)).read(reader);
        });
    }
    observeLineHeightsForLineRange(lineNumber) {
        return derived(reader => {
            const range = lineNumber instanceof LineRange ? lineNumber : lineNumber.read(reader);
            const heights = [];
            for (let i = range.startLineNumber; i < range.endLineNumberExclusive; i++) {
                heights.push(this.observeLineHeightForLine(i).read(reader));
            }
            return heights;
        });
    }
    /**
     * Get the vertical position (top offset) for the line's bottom w.r.t. to the first line.
     */
    observeTopForLineNumber(lineNumber) {
        return derived(reader => {
            this.layoutInfo.read(reader);
            this._onDidChangeViewZones.read(reader);
            this._onDidHiddenAreasChanged.read(reader);
            this._onDidLineHeightChanged.read(reader);
            this._versionId.read(reader);
            return this.editor.getTopForLineNumber(lineNumber);
        });
    }
    /**
     * Get the vertical position (top offset) for the line's bottom w.r.t. to the first line.
     */
    observeBottomForLineNumber(lineNumber) {
        return derived(reader => {
            this.layoutInfo.read(reader);
            this._onDidChangeViewZones.read(reader);
            this._onDidHiddenAreasChanged.read(reader);
            this._onDidLineHeightChanged.read(reader);
            this._versionId.read(reader);
            return this.editor.getBottomForLineNumber(lineNumber);
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JzZXJ2YWJsZUNvZGVFZGl0b3IuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvb2JzZXJ2YWJsZUNvZGVFZGl0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxXQUFXLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUMzRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxZQUFZLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUN4RyxPQUFPLEVBQUUsYUFBYSxFQUE2RCxlQUFlLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLGlCQUFpQixFQUFFLG1CQUFtQixFQUFFLGdCQUFnQixFQUFFLHlCQUF5QixFQUFFLGVBQWUsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRW5ULE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbkUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ3RELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUt4RCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFFbkQ7O0VBRUU7QUFDRixNQUFNLFVBQVUsb0JBQW9CLENBQUMsTUFBbUI7SUFDdkQsT0FBTyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDekMsQ0FBQztBQUVELE1BQU0sT0FBTyxvQkFBcUIsU0FBUSxVQUFVO2FBQzNCLFNBQUksR0FBRyxJQUFJLEdBQUcsRUFBcUMsQ0FBQztJQUU1RTs7TUFFRTtJQUNLLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBbUI7UUFD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