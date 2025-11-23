var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { $, n } from '../../../../../../../base/browser/dom.js';
import { Emitter } from '../../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../../base/common/lifecycle.js';
import { constObservable, derived, observableValue } from '../../../../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../../../../platform/instantiation/common/instantiation.js';
import { editorBackground } from '../../../../../../../platform/theme/common/colorRegistry.js';
import { asCssVariable } from '../../../../../../../platform/theme/common/colorUtils.js';
import { observableCodeEditor } from '../../../../../../browser/observableCodeEditor.js';
import { LineSource, renderLines, RenderOptions } from '../../../../../../browser/widget/diffEditor/components/diffEditorViewZones/renderLines.js';
import { Rect } from '../../../../../../common/core/2d/rect.js';
import { Position } from '../../../../../../common/core/position.js';
import { Range } from '../../../../../../common/core/range.js';
import { LineRange } from '../../../../../../common/core/ranges/lineRange.js';
import { OffsetRange } from '../../../../../../common/core/ranges/offsetRange.js';
import { ILanguageService } from '../../../../../../common/languages/language.js';
import { LineTokens, TokenArray } from '../../../../../../common/tokens/lineTokens.js';
import { InlineDecoration } from '../../../../../../common/viewModel/inlineDecorations.js';
import { GhostText, GhostTextPart } from '../../../model/ghostText.js';
import { GhostTextView } from '../../ghostText/ghostTextView.js';
import { getModifiedBorderColor, modifiedBackgroundColor } from '../theme.js';
import { getPrefixTrim, mapOutFalsy } from '../utils/utils.js';
const BORDER_WIDTH = 1;
const WIDGET_SEPARATOR_WIDTH = 1;
const WIDGET_SEPARATOR_DIFF_EDITOR_WIDTH = 3;
const BORDER_RADIUS = 4;
let InlineEditsInsertionView = class InlineEditsInsertionView extends Disposable {
    constructor(_editor, _input, _tabAction, instantiationService, _languageService) {
        super();
        this._editor = _editor;
        this._input = _input;
        this._tabAction = _tabAction;
        this._languageService = _languageService;
        this._onDidClick = this._register(new Emitter());
        this.onDidClick = this._onDidClick.event;
        this._state = derived(this, reader => {
            const state = this._input.read(reader);
            if (!state) {
                return undefined;
            }
            const textModel = this._editor.getModel();
            const eol = textModel.getEOL();
            if (state.startColumn === 1 && state.lineNumber > 1 && textModel.getLineLength(state.lineNumber) !== 0 && state.text.endsWith(eol) && !state.text.startsWith(eol)) {
                const endOfLineColumn = textModel.getLineLength(state.lineNumber - 1) + 1;
                return { lineNumber: state.lineNumber - 1, column: endOfLineColumn, text: eol + state.text.slice(0, -eol.length) };
            }
            return { lineNumber: state.lineNumber, column: state.startColumn, text: state.text };
        });
        this._trimVertically = derived(this, reader => {
            const state = this._state.read(reader);
            const text = state?.text;
            if (!text || text.trim() === '') {
                return { topOffset: 0, bottomOffset: 0, linesTop: 0, linesBottom: 0 };
            }
            // Adjust for leading/trailing newlines
            const lineHeight = this._editor.getLineHeightForPosition(new Position(state.lineNumber, 1));
            const eol = this._editor.getModel().getEOL();
            let linesTop = 0;
            let linesBottom = 0;
            let i = 0;
            for (; i < text.length && text.startsWith(eol, i); i += eol.length) {
                linesTop += 1;
            }
            for (let j = text.length; j > i && text.endsWith(eol, j); j -= eol.length) {
                linesBottom += 1;
            }
            return { topOffset: linesTop * lineHeight, bottomOffset: linesBottom * lineHeight, linesTop, linesBottom };
        });
        this._maxPrefixTrim = derived(this, reader => {
            const state = this._state.read(reader);
            if (!state) {
                return { prefixLeftOffset: 0, prefixTrim: 0 };
            }
            const textModel = this._editor.getModel();
            const eol = textModel.getEOL();
            const trimVertically = this._trimVertically.read(reader);
            const lines = state.text.split(eol);
            const modifiedLines = lines.slice(trimVertically.linesTop, lines.length - trimVertically.linesBottom);
            if (trimVertically.linesTop === 0) {
                modifiedLines[0] = textModel.getLineContent(state.lineNumber) + modifiedLines[0];
            }
            const originalRange = new LineRange(state.lineNumber, state.lineNumber + (trimVertically.linesTop > 0 ? 0 : 1));
            return getPrefixTrim([], originalRange, modifiedLines, this._editor);
        });
        this._ghostText = derived(reader => {
            const state = this._state.read(reader);
            const prefixTrim = this._maxPrefixTrim.read(reader);
            if (!state) {
                return undefined;
            }
            const textModel = this._editor.getModel();
            const eol = textModel.getEOL();
            const modifiedLines = state.text.split(eol);
            const inlineDecorations = modifiedLines.map((line, i) => new InlineDecoration(new Range(i + 1, i === 0 ? 1 : prefixTrim.prefixTrim + 1, i + 1, line.length + 1), 'modified-background', 0 /* InlineDecorationType.Regular */));
            return new GhostText(state.lineNumber, [new GhostTextPart(state.column, state.text, false, inlineDecorations)]);
        });
        this._display = derived(this, reader => !!this._state.read(reader) ? 'block' : 'none');
        this._editorMaxContentWidthInRange = derived(this, reader => {
            const state = this._state.read(reader);
            if (!state) {
                return 0;
            }
            this._editorObs.versionId.read(reader);
            const textModel = this._editor.getModel();
            const eol = textModel.getEOL();
            const textBeforeInsertion = state.text.startsWith(eol) ? '' : textModel.getValueInRange(new Range(state.lineNumber, 1, state.lineNumber, state.column));
            const textAfterInsertion = textModel.getValueInRange(new Range(state.lineNumber, state.column, state.lineNumber, textModel.getLineLength(state.lineNumber) + 1));
            const text = textBeforeInsertion + state.text + textAfterInsertion;
            const lines = text.split(eol);
            const renderOptions = RenderOptions.fromEditor(this._editor).withSetWidth(false).withScrollBeyondLastColumn(0);
            const lineWidths = lines.map(line => {
                const t = textModel.tokenization.tokenizeLinesAt(state.lineNumber, [line])?.[0];
                let tokens;
                if (t) {
                    tokens = TokenArray.fromLineTokens(t).toLineTokens(line, this._languageService.languageIdCodec);
                }
                else {
                    tokens = LineTokens.createEmpty(line, this._languageService.languageIdCodec);
                }
                return renderLines(new LineSource([tokens]), renderOptions, [], $('div'), true).minWidthInPx;
            });
            // Take the max value that we observed.
            // Reset when either the edit changes or the editor text version.
            return Math.max(...lineWidths);
        });
        this.startLineOffset = this._trimVertically.map(v => v.topOffset);
        this.originalLines = this._state.map(s => s ?
            new LineRange(s.lineNumber, Math.min(s.lineNumber + 2, this._editor.getModel().getLineCount() + 1)) : undefined);
        this._overlayLayout = derived(this, (reader) => {
            this._ghostText.read(reader);
            const state = this._state.read(reader);
            if (!state) {
                return null;
            }
            // Update the overlay when the position changes
            this._editorObs.observePosition(observableValue(this, new Position(state.lineNumber, state.column)), reader.store).read(reader);
            const editorLayout = this._editorObs.layoutInfo.read(reader);
            const horizontalScrollOffset = this._editorObs.scrollLeft.read(reader);
            const verticalScrollbarWidth = this._editorObs.layoutInfoVerticalScrollbarWidth.read(reader);
            const right = editorLayout.contentLeft + this._editorMaxContentWidthInRange.read(reader) - horizontalScrollOffset;
            const prefixLeftOffset = this._maxPrefixTrim.read(reader).prefixLeftOffset ?? 0 /* fix due to observable bug? */;
            const left = editorLayout.contentLeft + prefixLeftOffset - horizontalScrollOffset;
            if (right <= left) {
                return null;
            }
            const { topOffset: topTrim, bottomOffset: bottomTrim } = this._trimVertically.read(reader);
            const scrollTop = this._editorObs.scrollTop.read(reader);
            const height = this._ghostTextView.height.read(reader) - topTrim - bottomTrim;
            const top = this._editor.getTopForLineNumber(state.lineNumber) - scrollTop + topTrim;
            const bottom = top + height;
            const overlay = new Rect(left, top, right, bottom);
            return {
                overlay,
                startsAtContentLeft: prefixLeftOffset === 0,
                contentLeft: editorLayout.contentLeft,
                minContentWidthRequired: prefixLeftOffset + overlay.width + verticalScrollbarWidth,
            };
        }).recomputeInitiallyAndOnChange(this._store);
        this._modifiedOverlay = n.div({
            style: { pointerEvents: 'none', }
        }, derived(this, reader => {
            const overlayLayoutObs = mapOutFalsy(this._overlayLayout).read(reader);
            if (!overlayLayoutObs) {
                return undefined;
            }
            // Create an overlay which hides the left hand side of the original overlay when it overflows to the left
            // such that there is a smooth transition at the edge of content left
            const overlayHider = overlayLayoutObs.map(layoutInfo => Rect.fromLeftTopRightBottom(layoutInfo.contentLeft - BORDER_RADIUS - BORDER_WIDTH, layoutInfo.overlay.top, layoutInfo.contentLeft, layoutInfo.overlay.bottom)).read(reader);
            const separatorWidth = this._input.map(i => i?.inDiffEditor ? WIDGET_SEPARATOR_DIFF_EDITOR_WIDTH : WIDGET_SEPARATOR_WIDTH).read(reader);
            const overlayRect = overlayLayoutObs.map(l => l.overlay.withMargin(0, BORDER_WIDTH, 0, l.startsAtContentLeft ? 0 : BORDER_WIDTH).intersectHorizontal(new OffsetRange(overlayHider.left, Number.MAX_SAFE_INTEGER)));
            const underlayRect = overlayRect.map(rect => rect.withMargin(separatorWidth, separatorWidth));
            return [
                n.div({
                    class: 'originalUnderlayInsertion',
                    style: {
                        ...underlayRect.read(reader).toStyles(),
                        borderRadius: BORDER_RADIUS,
                        border: `${BORDER_WIDTH + separatorWidth}px solid ${asCssVariable(editorBackground)}`,
                        boxSizing: 'border-box',
                    }
                }),
                n.div({
                    class: 'originalOverlayInsertion',
                    style: {
                        ...overlayRect.read(reader).toStyles(),
                        borderRadius: BORDER_RADIUS,
                        border: getModifiedBorderColor(this._tabAction).map(bc => `${BORDER_WIDTH}px solid ${asCssVariable(bc)}`),
                        boxSizing: 'border-box',
                        backgroundColor: asCssVariable(modifiedBackgroundColor),
                    }
                }),
                n.div({
                    class: 'originalOverlayHiderInsertion',
                    style: {
                        ...overlayHider.toStyles(),
                        backgroundColor: asCssVariable(editorBackground),
                    }
                })
            ];
        })).keepUpdated(this._store);
        this._view = n.div({
            class: 'inline-edits-view',
            style: {
                position: 'absolute',
                overflow: 'visible',
                top: '0px',
                left: '0px',
                display: this._display,
            },
        }, [
            [this._modifiedOverlay],
        ]).keepUpdated(this._store);
        this._editorObs = observableCodeEditor(this._editor);
        this._ghostTextView = this._register(instantiationService.createInstance(GhostTextView, this._editor, derived(reader => {
            const ghostText = this._ghostText.read(reader);
            if (!ghostText) {
                return undefined;
            }
            return {
                ghostText: ghostText,
                handleInlineCompletionShown: (data) => {
                    // This is a no-op for the insertion view, as it is handled by the InlineEditsView.
                },
                warning: undefined,
            };
        }), {
            extraClasses: ['inline-edit'],
            isClickable: true,
            shouldKeepCursorStable: true,
        }));
        this.isHovered = this._ghostTextView.isHovered;
        this._register(this._ghostTextView.onDidClick((e) => {
            this._onDidClick.fire(e);
        }));
        this._register(this._editorObs.createOverlayWidget({
            domNode: this._view.element,
            position: constObservable(null),
            allowEditorOverflow: false,
            minContentWidthInPx: derived(this, reader => {
                const info = this._overlayLayout.read(reader);
                if (info === null) {
                    return 0;
                }
                return info.minContentWidthRequired;
            }),
        }));
    }
};
InlineEditsInsertionView = __decorate([
    __param(3, IInstantiationService),
    __param(4, ILanguageService)
], InlineEditsInsertionView);
export { InlineEditsInsertionView };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdHNJbnNlcnRpb25WaWV3LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvdmlldy9pbmxpbmVFZGl0cy9pbmxpbmVFZGl0c1ZpZXdzL2lubGluZUVkaXRzSW5zZXJ0aW9uVmlldy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQTs7O2dHQUdnRztBQUNoRyxPQUFPLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRWhFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQWUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDeEgsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0scUVBQXFFLENBQUM7QUFDNUcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDL0YsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBRXpGLE9BQU8sRUFBd0Isb0JBQW9CLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsTUFBTSwyRkFBMkYsQ0FBQztBQUNuSixPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDOUUsT0FBTyxFQUFFLFdBQVcs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