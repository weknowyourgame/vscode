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
import { getWindow, n } from '../../../../../../../base/browser/dom.js';
import { StandardMouseEvent } from '../../../../../../../base/browser/mouseEvent.js';
import { Emitter } from '../../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../../base/common/lifecycle.js';
import { constObservable, derived, observableValue } from '../../../../../../../base/common/observable.js';
import { editorBackground, editorHoverForeground } from '../../../../../../../platform/theme/common/colorRegistry.js';
import { asCssVariable } from '../../../../../../../platform/theme/common/colorUtils.js';
import { LineSource, renderLines, RenderOptions } from '../../../../../../browser/widget/diffEditor/components/diffEditorViewZones/renderLines.js';
import { Point } from '../../../../../../common/core/2d/point.js';
import { Rect } from '../../../../../../common/core/2d/rect.js';
import { StringReplacement } from '../../../../../../common/core/edits/stringEdit.js';
import { OffsetRange } from '../../../../../../common/core/ranges/offsetRange.js';
import { ILanguageService } from '../../../../../../common/languages/language.js';
import { LineTokens, TokenArray } from '../../../../../../common/tokens/lineTokens.js';
import { getModifiedBorderColor, getOriginalBorderColor, modifiedChangedTextOverlayColor, originalChangedTextOverlayColor } from '../theme.js';
import { getEditorValidOverlayRect, mapOutFalsy, rectToProps } from '../utils/utils.js';
const BORDER_WIDTH = 1;
let InlineEditsWordReplacementView = class InlineEditsWordReplacementView extends Disposable {
    static { this.MAX_LENGTH = 100; }
    constructor(_editor, 
    /** Must be single-line in both sides */
    _edit, _tabAction, _languageService) {
        super();
        this._editor = _editor;
        this._edit = _edit;
        this._tabAction = _tabAction;
        this._languageService = _languageService;
        this._onDidClick = this._register(new Emitter());
        this.onDidClick = this._onDidClick.event;
        this._start = this._editor.observePosition(constObservable(this._edit.range.getStartPosition()), this._store);
        this._end = this._editor.observePosition(constObservable(this._edit.range.getEndPosition()), this._store);
        this._line = document.createElement('div');
        this._hoverableElement = observableValue(this, null);
        this.isHovered = this._hoverableElement.map((e, reader) => e?.didMouseMoveDuringHover.read(reader) ?? false);
        this._renderTextEffect = derived(this, _reader => {
            const tm = this._editor.model.get();
            const origLine = tm.getLineContent(this._edit.range.startLineNumber);
            const edit = StringReplacement.replace(new OffsetRange(this._edit.range.startColumn - 1, this._edit.range.endColumn - 1), this._edit.text);
            const lineToTokenize = edit.replace(origLine);
            const t = tm.tokenization.tokenizeLinesAt(this._edit.range.startLineNumber, [lineToTokenize])?.[0];
            let tokens;
            if (t) {
                tokens = TokenArray.fromLineTokens(t).slice(edit.getRangeAfterReplace()).toLineTokens(this._edit.text, this._languageService.languageIdCodec);
            }
            else {
                tokens = LineTokens.createEmpty(this._edit.text, this._languageService.languageIdCodec);
            }
            const res = renderLines(new LineSource([tokens]), RenderOptions.fromEditor(this._editor.editor).withSetWidth(false).withScrollBeyondLastColumn(0), [], this._line, true);
            this._line.style.width = `${res.minWidthInPx}px`;
        });
        const modifiedLineHeight = this._editor.observeLineHeightForPosition(this._edit.range.getStartPosition());
        this._layout = derived(this, reader => {
            this._renderTextEffect.read(reader);
            const widgetStart = this._start.read(reader);
            const widgetEnd = this._end.read(reader);
            // TODO@hediet better about widgetStart and widgetEnd in a single transaction!
            if (!widgetStart || !widgetEnd || widgetStart.x > widgetEnd.x || widgetStart.y > widgetEnd.y) {
                return undefined;
            }
            const lineHeight = modifiedLineHeight.read(reader);
            const scrollLeft = this._editor.scrollLeft.read(reader);
            const w = this._editor.getOption(59 /* EditorOption.fontInfo */).read(reader).typicalHalfwidthCharacterWidth;
            const modifiedLeftOffset = 3 * w;
            const modifiedTopOffset = 4;
            const modifiedOffset = new Point(modifiedLeftOffset, modifiedTopOffset);
            const originalLine = Rect.fromPoints(widgetStart, widgetEnd).withHeight(lineHeight).translateX(-scrollLeft);
            const modifiedLine = Rect.fromPointSize(originalLine.getLeftBottom().add(modifiedOffset), new Point(this._edit.text.length * w, originalLine.height));
            const lowerBackground = modifiedLine.withLeft(originalLine.left);
            // debugView(debugLogRects({ lowerBackground }, this._editor.editor.getContainerDomNode()), reader);
            return {
                originalLine,
                modifiedLine,
                lowerBackground,
                lineHeight,
            };
        });
        this.minEditorScrollHeight = derived(this, reader => {
            const layout = mapOutFalsy(this._layout).read(reader);
            if (!layout) {
                return 0;
            }
            return layout.read(reader).modifiedLine.bottom + BORDER_WIDTH + this._editor.editor.getScrollTop();
        });
        this._root = n.div({
            class: 'word-replacement',
        }, [
            derived(this, reader => {
                const layout = mapOutFalsy(this._layout).read(reader);
                if (!layout) {
                    return [];
                }
                const originalBorderColor = getOriginalBorderColor(this._tabAction).map(c => asCssVariable(c)).read(reader);
                const modifiedBorderColor = getModifiedBorderColor(this._tabAction).map(c => asCssVariable(c)).read(reader);
                return [
                    n.div({
                        style: {
                            position: 'absolute',
                            ...rectToProps((r) => getEditorValidOverlayRect(this._editor).read(r)),
                            overflow: 'hidden',
                            pointerEvents: 'none',
                        }
                    }, [
                        n.div({
                            style: {
                                position: 'absolute',
                                ...rectToProps(reader => layout.read(reader).lowerBackground.withMargin(BORDER_WIDTH, 2 * BORDER_WIDTH, BORDER_WIDTH, 0)),
                                background: asCssVariable(editorBackground),
                                //boxShadow: `${asCssVariable(scrollbarShadow)} 0 6px 6px -6px`,
                                cursor: 'pointer',
                                pointerEvents: 'auto',
                            },
                            onmousedown: e => {
                                e.preventDefault(); // This prevents that the editor loses focus
                            },
                            onmouseup: (e) => this._onDidClick.fire(new StandardMouseEvent(getWindow(e), e)),
                            obsRef: (elem) => {
                                this._hoverableElement.set(elem, undefined);
                            }
                        }),
                        n.div({
                            style: {
                                position: 'absolute',
                                ...rectToProps(reader => layout.read(reader).modifiedLine.withMargin(BORDER_WIDTH, 2 * BORDER_WIDTH)),
                                fontFamily: this._editor.getOption(58 /* EditorOption.fontFamily */),
                                fontSize: this._editor.getOption(61 /* EditorOption.fontSize */),
                                fontWeight: this._editor.getOption(62 /* EditorOption.fontWeight */),
                                pointerEvents: 'none',
                                boxSizing: 'border-box',
                                borderRadius: '4px',
                                border: `${BORDER_WIDTH}px solid ${modifiedBorderColor}`,
                                background: asCssVariable(modifiedChangedTextOverlayColor),
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                outline: `2px solid ${asCssVariable(editorBackground)}`,
                            }
                        }, [this._line]),
                        n.div({
                            style: {
                                position: 'absolute',
                                ...rectToProps(reader => layout.read(reader).originalLine.withMargin(BORDER_WIDTH)),
                                boxSizing: 'border-box',
                                borderRadius: '4px',
                                border: `${BORDER_WIDTH}px solid ${originalBorderColor}`,
                                background: asCssVariable(originalChangedTextOverlayColor),
                                pointerEvents: 'none',
                            }
                        }, []),
                        n.svg({
                            width: 11,
                            height: 14,
                            viewBox: '0 0 11 14',
                            fill: 'none',
                            style: {
                                position: 'absolute',
                                left: layout.map(l => l.modifiedLine.left - 16),
                                top: layout.map(l => l.modifiedLine.top + Math.round((l.lineHeight - 14 - 5) / 2)),
                            }
                        }, [
                            n.svgElem('path', {
                                d: 'M1 0C1 2.98966 1 5.92087 1 8.49952C1 9.60409 1.89543 10.5 3 10.5H10.5',
                                stroke: asCssVariable(editorHoverForeground),
                            }),
                            n.svgElem('path', {
                                d: 'M6 7.5L9.99999 10.49998L6 13.5',
                                stroke: asCssVariable(editorHoverForeground),
                            })
                        ]),
                    ])
                ];
            })
        ]).keepUpdated(this._store);
        this._register(this._editor.createOverlayWidget({
            domNode: this._root.element,
            minContentWidthInPx: constObservable(0),
            position: constObservable({ preference: { top: 0, left: 0 } }),
            allowEditorOverflow: false,
        }));
    }
};
InlineEditsWordReplacementView = __decorate([
    __param(3, ILanguageService)
], InlineEditsWordReplacementView);
export { InlineEditsWordReplacementView };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdHNXb3JkUmVwbGFjZW1lbnRWaWV3LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvdmlldy9pbmxpbmVFZGl0cy9pbmxpbmVFZGl0c1ZpZXdzL2lubGluZUVkaXRzV29yZFJlcGxhY2VtZW50Vmlldy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBMkIsTUFBTSwwQ0FBMEMsQ0FBQztBQUNqRyxPQUFPLEVBQWUsa0JBQWtCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUNsRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFlLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3hILE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ3RILE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUV6RixPQUFPLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsTUFBTSwyRkFBMkYsQ0FBQztBQUVuSixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDbEUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBRXRGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNsRixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxnREFBZ0Qs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