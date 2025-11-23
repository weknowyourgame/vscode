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
import { n } from '../../../../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../../../../base/common/lifecycle.js';
import { derived, constObservable, autorun, observableValue } from '../../../../../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../../../../../platform/instantiation/common/instantiation.js';
import { observableCodeEditor } from '../../../../../../../browser/observableCodeEditor.js';
import { EmbeddedCodeEditorWidget } from '../../../../../../../browser/widget/codeEditor/embeddedCodeEditorWidget.js';
import { Position } from '../../../../../../../common/core/position.js';
import { Range } from '../../../../../../../common/core/range.js';
import { LineRange } from '../../../../../../../common/core/ranges/lineRange.js';
import { OffsetRange } from '../../../../../../../common/core/ranges/offsetRange.js';
import { ModelDecorationOptions } from '../../../../../../../common/model/textModel.js';
import { InlineCompletionContextKeys } from '../../../../controller/inlineCompletionContextKeys.js';
import { InlineEditsGutterIndicator, InlineEditsGutterIndicatorData } from '../../components/gutterIndicatorView.js';
import { classNames, maxContentWidthInRange } from '../../utils/utils.js';
let LongDistancePreviewEditor = class LongDistancePreviewEditor extends Disposable {
    constructor(_previewTextModel, _properties, _parentEditor, _tabAction, _instantiationService) {
        super();
        this._previewTextModel = _previewTextModel;
        this._properties = _properties;
        this._parentEditor = _parentEditor;
        this._tabAction = _tabAction;
        this._instantiationService = _instantiationService;
        this._previewRef = n.ref();
        this.element = n.div({ class: 'preview', style: { /*pointerEvents: 'none'*/}, ref: this._previewRef });
        this._state = derived(this, reader => {
            const props = this._properties.read(reader);
            if (!props) {
                return undefined;
            }
            if (props.diff[0].innerChanges?.every(c => c.modifiedRange.isEmpty())) {
                return {
                    diff: props.diff,
                    visibleLineRange: LineRange.ofLength(props.diff[0].original.startLineNumber, 1),
                    textModel: this._parentEditorObs.model.read(reader),
                    mode: 'original',
                };
            }
            else {
                return {
                    diff: props.diff,
                    visibleLineRange: LineRange.ofLength(props.diff[0].modified.startLineNumber, 1),
                    textModel: this._previewTextModel,
                    mode: 'modified',
                };
            }
        });
        this.updatePreviewEditorEffect = derived(this, reader => {
            // this._widgetContent.readEffect(reader);
            this._previewEditorObs.model.read(reader); // update when the model is set
            const range = this._state.read(reader)?.visibleLineRange;
            if (!range) {
                return;
            }
            const hiddenAreas = [];
            if (range.startLineNumber > 1) {
                hiddenAreas.push(new Range(1, 1, range.startLineNumber - 1, 1));
            }
            if (range.endLineNumberExclusive < this._previewTextModel.getLineCount() + 1) {
                hiddenAreas.push(new Range(range.endLineNumberExclusive, 1, this._previewTextModel.getLineCount() + 1, 1));
            }
            this.previewEditor.setHiddenAreas(hiddenAreas, undefined, true);
        });
        this.horizontalContentRangeInPreviewEditorToShow = derived(this, reader => {
            return this._getHorizontalContentRangeInPreviewEditorToShow(this.previewEditor, this._properties.read(reader)?.diff ?? [], reader);
        });
        this.contentHeight = derived(this, (reader) => {
            const viewState = this._properties.read(reader);
            if (!viewState) {
                return constObservable(null);
            }
            const previewEditorHeight = this._previewEditorObs.observeLineHeightForLine(viewState.diff[0].modified.startLineNumber);
            return previewEditorHeight;
        }).flatten();
        this._editorDecorations = derived(this, reader => {
            const diff2 = this._state.read(reader);
            if (!diff2) {
                return undefined;
            }
            const diff = {
                mode: 'insertionInline',
                diff: diff2.diff,
            };
            const originalDecorations = [];
            const modifiedDecorations = [];
            const diffWholeLineDeleteDecoration = ModelDecorationOptions.register({
                className: 'inlineCompletions-char-delete',
                description: 'char-delete',
                isWholeLine: false,
                zIndex: 1, // be on top of diff background decoration
            });
            const diffWholeLineAddDecoration = ModelDecorationOptions.register({
                className: 'inlineCompletions-char-insert',
                description: 'char-insert',
                isWholeLine: true,
            });
            const diffAddDecoration = ModelDecorationOptions.register({
                className: 'inlineCompletions-char-insert',
                description: 'char-insert',
                shouldFillLineOnLineBreak: true,
            });
            const hideEmptyInnerDecorations = true; // diff.mode === 'lineReplacement';
            for (const m of diff.diff) {
                if (m.modified.isEmpty || m.original.isEmpty) {
                    if (!m.original.isEmpty) {
                        originalDecorations.push({ range: m.original.toInclusiveRange(), options: diffWholeLineDeleteDecoration });
                    }
                    if (!m.modified.isEmpty) {
                        modifiedDecorations.push({ range: m.modified.toInclusiveRange(), options: diffWholeLineAddDecoration });
                    }
                }
                else {
                    for (const i of m.innerChanges || []) {
                        // Don't show empty markers outside the line range
                        if (m.original.contains(i.originalRange.startLineNumber) && !(hideEmptyInnerDecorations && i.originalRange.isEmpty())) {
                            originalDecorations.push({
                                range: i.originalRange,
                                options: {
                                    description: 'char-delete',
                                    shouldFillLineOnLineBreak: false,
                                    className: classNames('inlineCompletions-char-delete', 
                                    // i.originalRange.isSingleLine() && diff.mode === 'insertionInline' && 'single-line-inline',
                                    i.originalRange.isEmpty() && 'empty'),
                                    zIndex: 1
                                }
                            });
                        }
                        if (m.modified.contains(i.modifiedRange.startLineNumber)) {
                            modifiedDecorations.push({
                                range: i.modifiedRange,
                                options: diffAddDecoration
                            });
                        }
                    }
                }
            }
            return { originalDecorations, modifiedDecorations };
        });
        this.previewEditor = this._register(this._createPreviewEditor());
        this._parentEditorObs = observableCodeEditor(this._parentEditor);
        this._register(autorun(reader => {
            this.previewEditor.setModel(this._state.read(reader)?.textModel || null);
        }));
        this._previewEditorObs = observableCodeEditor(this.previewEditor);
        this._register(this._previewEditorObs.setDecorations(derived(reader => {
            const state = this._state.read(reader);
            const decorations = this._editorDecorations.read(reader);
            return (state?.mode === 'original' ? decorations?.originalDecorations : decorations?.modifiedDecorations) ?? [];
        })));
        // Mirror the cursor position. Allows the gutter arrow to point in the correct direction.
        this._register(autorun((reader) => {
            if (!this._properties.read(reader)) {
                return;
            }
            const cursorPosition = this._parentEditorObs.cursorPosition.read(reader);
            if (cursorPosition) {
                this.previewEditor.setPosition(this._previewTextModel.validatePosition(cursorPosition), 'longDistanceHintPreview');
            }
        }));
        this._register(autorun(reader => {
            const state = this._properties.read(reader);
            if (!state) {
                return;
            }
            // Ensure there is enough space to the left of the line number for the gutter indicator to fits.
            const lineNumberDigets = state.diff[0].modified.startLineNumber.toString().length;
            this.previewEditor.updateOptions({ lineNumbersMinChars: lineNumberDigets + 1 });
        }));
        this._register(this._instantiationService.createInstance(InlineEditsGutterIndicator, this._previewEditorObs, derived(reader => {
            const state = this._properties.read(reader);
            if (!state) {
                return undefined;
            }
            return new InlineEditsGutterIndicatorData(state.suggestInfo, LineRange.ofLength(state.diff[0].original.startLineNumber, 1), state.model);
        }), this._tabAction, constObservable(0), constObservable(false), observableValue(this, false)));
        this.updatePreviewEditorEffect.recomputeInitiallyAndOnChange(this._store);
    }
    _createPreviewEditor() {
        return this._instantiationService.createInstance(EmbeddedCodeEditorWidget, this._previewRef.element, {
            glyphMargin: false,
            lineNumbers: 'on',
            minimap: { enabled: false },
            guides: {
                indentation: false,
                bracketPairs: false,
                bracketPairsHorizontal: false,
                highlightActiveIndentation: false,
            },
            rulers: [],
            padding: { top: 0, bottom: 0 },
            //folding: false,
            selectOnLineNumbers: false,
            selectionHighlight: false,
            columnSelection: false,
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            //lineDecorationsWidth: 0,
            //lineNumbersMinChars: 0,
            revealHorizontalRightPadding: 0,
            bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: false },
            scrollBeyondLastLine: false,
            scrollbar: {
                vertical: 'hidden',
                horizontal: 'hidden',
                handleMouseWheel: false,
            },
            readOnly: true,
            wordWrap: 'off',
            wordWrapOverride1: 'off',
            wordWrapOverride2: 'off',
        }, {
            contextKeyValues: {
                [InlineCompletionContextKeys.inInlineEditsPreviewEditor.key]: true,
            },
            contributions: [],
        }, this._parentEditor);
    }
    _getHorizontalContentRangeInPreviewEditorToShow(editor, diff, reader) {
        const r = LineRange.ofLength(diff[0].modified.startLineNumber, 1);
        const l = this._previewEditorObs.layoutInfo.read(reader);
        const trueContentWidth = maxContentWidthInRange(this._previewEditorObs, r, reader);
        const state = this._state.read(reader);
        if (!state || !diff[0].innerChanges) {
            return undefined;
        }
        const firstCharacterChange = state.mode === 'modified' ? diff[0].innerChanges[0].modifiedRange : diff[0].innerChanges[0].originalRange;
        // find the horizontal range we want to show.
        const preferredRange = growUntilVariableBoundaries(editor.getModel(), firstCharacterChange, 5);
        const left = this._previewEditorObs.getLeftOfPosition(preferredRange.getStartPosition(), reader);
        const right = this._previewEditorObs.getLeftOfPosition(preferredRange.getEndPosition(), reader);
        const indentCol = editor.getModel().getLineFirstNonWhitespaceColumn(preferredRange.startLineNumber);
        const indentationEnd = this._previewEditorObs.getLeftOfPosition(new Position(preferredRange.startLineNumber, indentCol), reader);
        const preferredRangeToReveal = new OffsetRange(left, right);
        return {
            indentationEnd,
            preferredRangeToReveal,
            maxEditorWidth: trueContentWidth + l.contentLeft,
            contentWidth: trueContentWidth,
            nonContentWidth: l.contentLeft, // Width of area that is not content
        };
    }
    layout(dimension, desiredPreviewEditorScrollLeft) {
        this.previewEditor.layout(dimension);
        this._previewEditorObs.editor.setScrollLeft(desiredPreviewEditorScrollLeft);
    }
};
LongDistancePreviewEditor = __decorate([
    __param(4, IInstantiationService)
], LongDistancePreviewEditor);
export { LongDistancePreviewEditor };
/*
 * Grows the range on each ends until it includes a none-variable-name character
 * or the next character would be a whitespace character
 * or the maxGrow limit is reached
 */
function growUntilVariableBoundaries(textModel, range, maxGrow) {
    const startPosition = range.getStartPosition();
    const endPosition = range.getEndPosition();
    const line = textModel.getLineContent(startPosition.lineNumber);
    function isVariableNameCharacter(col) {
        const char = line.charAt(col - 1);
        return (/[a-zA-Z0-9_]/).test(char);
    }
    function isWhitespace(col) {
        const char = line.charAt(col - 1);
        return char === ' ' || char === '\t';
    }
    let startColumn = startPosition.column;
    while (startColumn > 1 && isVariableNameCharacter(startColumn) && !isWhitespace(startColumn - 1) && startPosition.column - startColumn < maxGrow) {
        startColumn--;
    }
    let endColumn = endPosition.column - 1;
    while (endColumn <= line.length && isVariableNameCharacter(endColumn) && !isWhitespace(endColumn + 1) && endColumn - endPosition.column < maxGrow) {
        endColumn++;
    }
    return new Range(startPosition.lineNumber, startPosition.column, endPosition.lineNumber, endColumn + 1);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9uZ0Rpc3RhbmNlUHJldmlld0VkaXRvci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvaW5saW5lRWRpdHNWaWV3cy9sb25nRGlzdGFuY2VIaW50L2xvbmdEaXN0YW5jZVByZXZpZXdFZGl0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM5RSxPQUFPLEVBQWUsT0FBTyxFQUFFLGVBQWUsRUFBVyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDN0ksT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sd0VBQXdFLENBQUM7QUFFL0csT0FBTyxFQUF3QixvQkFBb0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ2xILE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDRFQUE0RSxDQUFDO0FBRXRILE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUdyRixPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUN4RixPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNwRyxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsOEJBQThCLEVBQTRELE1BQU0seUNBQXlDLENBQUM7QUFF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