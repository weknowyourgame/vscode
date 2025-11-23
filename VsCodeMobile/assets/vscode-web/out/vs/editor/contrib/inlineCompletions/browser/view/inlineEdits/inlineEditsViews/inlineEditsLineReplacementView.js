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
import { $, getWindow, n } from '../../../../../../../base/browser/dom.js';
import { StandardMouseEvent } from '../../../../../../../base/browser/mouseEvent.js';
import { Emitter } from '../../../../../../../base/common/event.js';
import { Disposable, toDisposable } from '../../../../../../../base/common/lifecycle.js';
import { autorunDelta, constObservable, derived } from '../../../../../../../base/common/observable.js';
import { editorBackground, scrollbarShadow } from '../../../../../../../platform/theme/common/colorRegistry.js';
import { asCssVariable } from '../../../../../../../platform/theme/common/colorUtils.js';
import { IThemeService } from '../../../../../../../platform/theme/common/themeService.js';
import { EditorMouseEvent } from '../../../../../../browser/editorDom.js';
import { LineSource, renderLines, RenderOptions } from '../../../../../../browser/widget/diffEditor/components/diffEditorViewZones/renderLines.js';
import { Point } from '../../../../../../common/core/2d/point.js';
import { Rect } from '../../../../../../common/core/2d/rect.js';
import { Range } from '../../../../../../common/core/range.js';
import { OffsetRange } from '../../../../../../common/core/ranges/offsetRange.js';
import { ILanguageService } from '../../../../../../common/languages/language.js';
import { LineTokens, TokenArray } from '../../../../../../common/tokens/lineTokens.js';
import { InlineDecoration } from '../../../../../../common/viewModel/inlineDecorations.js';
import { getEditorBlendedColor, getModifiedBorderColor, getOriginalBorderColor, modifiedChangedLineBackgroundColor, originalBackgroundColor } from '../theme.js';
import { getEditorValidOverlayRect, getPrefixTrim, mapOutFalsy, rectToProps } from '../utils/utils.js';
let InlineEditsLineReplacementView = class InlineEditsLineReplacementView extends Disposable {
    constructor(_editor, _edit, _isInDiffEditor, _tabAction, _languageService, _themeService) {
        super();
        this._editor = _editor;
        this._edit = _edit;
        this._isInDiffEditor = _isInDiffEditor;
        this._tabAction = _tabAction;
        this._languageService = _languageService;
        this._themeService = _themeService;
        this._onDidClick = this._register(new Emitter());
        this.onDidClick = this._onDidClick.event;
        this._maxPrefixTrim = this._edit.map((e, reader) => e ? getPrefixTrim(e.replacements.flatMap(r => [r.originalRange, r.modifiedRange]), e.originalRange, e.modifiedLines, this._editor.editor, reader) : undefined);
        this._modifiedLineElements = derived(this, reader => {
            const lines = [];
            let requiredWidth = 0;
            const prefixTrim = this._maxPrefixTrim.read(reader);
            const edit = this._edit.read(reader);
            if (!edit || !prefixTrim) {
                return undefined;
            }
            const maxPrefixTrim = prefixTrim.prefixTrim;
            const modifiedBubbles = rangesToBubbleRanges(edit.replacements.map(r => r.modifiedRange)).map(r => new Range(r.startLineNumber, r.startColumn - maxPrefixTrim, r.endLineNumber, r.endColumn - maxPrefixTrim));
            const textModel = this._editor.model.get();
            const startLineNumber = edit.modifiedRange.startLineNumber;
            for (let i = 0; i < edit.modifiedRange.length; i++) {
                const line = document.createElement('div');
                const lineNumber = startLineNumber + i;
                const modLine = edit.modifiedLines[i].slice(maxPrefixTrim);
                const t = textModel.tokenization.tokenizeLinesAt(lineNumber, [modLine])?.[0];
                let tokens;
                if (t) {
                    tokens = TokenArray.fromLineTokens(t).toLineTokens(modLine, this._languageService.languageIdCodec);
                }
                else {
                    tokens = LineTokens.createEmpty(modLine, this._languageService.languageIdCodec);
                }
                const decorations = [];
                for (const modified of modifiedBubbles.filter(b => b.startLineNumber === lineNumber)) {
                    const validatedEndColumn = Math.min(modified.endColumn, modLine.length + 1);
                    decorations.push(new InlineDecoration(new Range(1, modified.startColumn, 1, validatedEndColumn), 'inlineCompletions-modified-bubble', 0 /* InlineDecorationType.Regular */));
                }
                // TODO: All lines should be rendered at once for one dom element
                const result = renderLines(new LineSource([tokens]), RenderOptions.fromEditor(this._editor.editor).withSetWidth(false).withScrollBeyondLastColumn(0), decorations, line, true);
                this._editor.getOption(59 /* EditorOption.fontInfo */).read(reader); // update when font info changes
                requiredWidth = Math.max(requiredWidth, result.minWidthInPx);
                lines.push(line);
            }
            return { lines, requiredWidth: requiredWidth };
        });
        this._layout = derived(this, reader => {
            const modifiedLines = this._modifiedLineElements.read(reader);
            const maxPrefixTrim = this._maxPrefixTrim.read(reader);
            const edit = this._edit.read(reader);
            if (!modifiedLines || !maxPrefixTrim || !edit) {
                return undefined;
            }
            const { prefixLeftOffset } = maxPrefixTrim;
            const { requiredWidth } = modifiedLines;
            const originalLineHeights = this._editor.observeLineHeightsForLineRange(edit.originalRange).read(reader);
            const modifiedLineHeights = (() => {
                const lineHeights = originalLineHeights.slice(0, edit.modifiedRange.length);
                while (lineHeights.length < edit.modifiedRange.length) {
                    lineHeights.push(originalLineHeights[originalLineHeights.length - 1]);
                }
                return lineHeights;
            })();
            const contentLeft = this._editor.layoutInfoContentLeft.read(reader);
            const verticalScrollbarWidth = this._editor.layoutInfoVerticalScrollbarWidth.read(reader);
            const scrollLeft = this._editor.scrollLeft.read(reader);
            const scrollTop = this._editor.scrollTop.read(reader);
            const editorLeftOffset = contentLeft - scrollLeft;
            const textModel = this._editor.editor.getModel();
            const originalLineWidths = edit.originalRange.mapToLineArray(line => this._editor.editor.getOffsetForColumn(line, textModel.getLineMaxColumn(line)) - prefixLeftOffset);
            const maxLineWidth = Math.max(...originalLineWidths, requiredWidth);
            const startLineNumber = edit.originalRange.startLineNumber;
            const endLineNumber = edit.originalRange.endLineNumberExclusive - 1;
            const topOfOriginalLines = this._editor.editor.getTopForLineNumber(startLineNumber) - scrollTop;
            const bottomOfOriginalLines = this._editor.editor.getBottomForLineNumber(endLineNumber) - scrollTop;
            // Box Widget positioning
            const originalLinesOverlay = Rect.fromLeftTopWidthHeight(editorLeftOffset + prefixLeftOffset, topOfOriginalLines, maxLineWidth, bottomOfOriginalLines - topOfOriginalLines);
            const modifiedLinesOverlay = Rect.fromLeftTopWidthHeight(originalLinesOverlay.left, originalLinesOverlay.bottom, originalLinesOverlay.width, modifiedLineHeights.reduce((sum, h) => sum + h, 0));
            const background = Rect.hull([originalLinesOverlay, modifiedLinesOverlay]);
            const lowerBackground = background.intersectVertical(new OffsetRange(originalLinesOverlay.bottom, Number.MAX_SAFE_INTEGER));
            const lowerText = new Rect(lowerBackground.left, lowerBackground.top, lowerBackground.right, lowerBackground.bottom);
            return {
                originalLinesOverlay,
                modifiedLinesOverlay,
                background,
                lowerBackground,
                lowerText,
                modifiedLineHeights,
                minContentWidthRequired: prefixLeftOffset + maxLineWidth + verticalScrollbarWidth,
            };
        });
        this._viewZoneInfo = derived(reader => {
            const shouldShowViewZone = this._editor.getOption(71 /* EditorOption.inlineSuggest */).map(o => o.edits.allowCodeShifting === 'always').read(reader);
            if (!shouldShowViewZone) {
                return undefined;
            }
            const layout = this._layout.read(reader);
            const edit = this._edit.read(reader);
            if (!layout || !edit) {
                return undefined;
            }
            const viewZoneHeight = layout.lowerBackground.height;
            const viewZoneLineNumber = edit.originalRange.endLineNumberExclusive;
            return { height: viewZoneHeight, lineNumber: viewZoneLineNumber };
        });
        this.minEditorScrollHeight = derived(this, reader => {
            const layout = mapOutFalsy(this._layout).read(reader);
            if (!layout || this._viewZoneInfo.read(reader) !== undefined) {
                return 0;
            }
            return layout.read(reader).lowerText.bottom + this._editor.editor.getScrollTop();
        });
        this._div = n.div({
            class: 'line-replacement',
        }, [
            derived(this, reader => {
                const layout = mapOutFalsy(this._layout).read(reader);
                const modifiedLineElements = this._modifiedLineElements.read(reader);
                if (!layout || !modifiedLineElements) {
                    return [];
                }
                const layoutProps = layout.read(reader);
                const contentLeft = this._editor.layoutInfoContentLeft.read(reader);
                const separatorWidth = this._isInDiffEditor.read(reader) ? 3 : 1;
                modifiedLineElements.lines.forEach((l, i) => {
                    l.style.width = `${layoutProps.lowerText.width}px`;
                    l.style.height = `${layoutProps.modifiedLineHeights[i]}px`;
                    l.style.position = 'relative';
                });
                const modifiedBorderColor = getModifiedBorderColor(this._tabAction).read(reader);
                const originalBorderColor = getOriginalBorderColor(this._tabAction).read(reader);
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
                            class: 'borderAroundLineReplacement',
                            style: {
                                position: 'absolute',
                                ...rectToProps(reader => layout.read(reader).background.translateX(-contentLeft).withMargin(separatorWidth)),
                                borderRadius: '4px',
                                border: `${separatorWidth + 1}px solid ${asCssVariable(editorBackground)}`,
                                boxSizing: 'border-box',
                                pointerEvents: 'none',
                            }
                        }),
                        n.div({
                            class: 'originalOverlayLineReplacement',
                            style: {
                                position: 'absolute',
                                ...rectToProps(reader => layout.read(reader).background.translateX(-contentLeft)),
                                borderRadius: '4px',
                                border: getEditorBlendedColor(originalBorderColor, this._themeService).map(c => `1px solid ${c.toString()}`),
                                pointerEvents: 'none',
                                boxSizing: 'border-box',
                                background: asCssVariable(originalBackgroundColor),
                            }
                        }),
                        n.div({
                            class: 'modifiedOverlayLineReplacement',
                            style: {
                                position: 'absolute',
                                ...rectToProps(reader => layout.read(reader).lowerBackground.translateX(-contentLeft)),
                                borderRadius: '0 0 4px 4px',
                                background: asCssVariable(editorBackground),
                                boxShadow: `${asCssVariable(scrollbarShadow)} 0 6px 6px -6px`,
                                border: `1px solid ${asCssVariable(modifiedBorderColor)}`,
                                boxSizing: 'border-box',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                pointerEvents: 'auto',
                            },
                            onmousedown: e => {
                                e.preventDefault(); // This prevents that the editor loses focus
                            },
                            onclick: (e) => this._onDidClick.fire(new StandardMouseEvent(getWindow(e), e)),
                        }, [
                            n.div({
                                style: {
                                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                    background: asCssVariable(modifiedChangedLineBackgroundColor),
                                },
                            })
                        ]),
                        n.div({
                            class: 'modifiedLinesLineReplacement',
                            style: {
                                position: 'absolute',
                                boxSizing: 'border-box',
                                ...rectToProps(reader => layout.read(reader).lowerText.translateX(-contentLeft)),
                                fontFamily: this._editor.getOption(58 /* EditorOption.fontFamily */),
                                fontSize: this._editor.getOption(61 /* EditorOption.fontSize */),
                                fontWeight: this._editor.getOption(62 /* EditorOption.fontWeight */),
                                pointerEvents: 'none',
                                whiteSpace: 'nowrap',
                                borderRadius: '0 0 4px 4px',
                                overflow: 'hidden',
                            }
                        }, [...modifiedLineElements.lines]),
                    ])
                ];
            })
        ]).keepUpdated(this._store);
        this.isHovered = this._editor.isTargetHovered((e) => this._isMouseOverWidget(e), this._store);
        this._previousViewZoneInfo = undefined;
        this._register(toDisposable(() => this._editor.editor.changeViewZones(accessor => this.removePreviousViewZone(accessor))));
        this._register(autorunDelta(this._viewZoneInfo, ({ lastValue, newValue }) => {
            if (lastValue === newValue || (lastValue?.height === newValue?.height && lastValue?.lineNumber === newValue?.lineNumber)) {
                return;
            }
            this._editor.editor.changeViewZones((changeAccessor) => {
                this.removePreviousViewZone(changeAccessor);
                if (!newValue) {
                    return;
                }
                this.addViewZone(newValue, changeAccessor);
            });
        }));
        this._register(this._editor.createOverlayWidget({
            domNode: this._div.element,
            minContentWidthInPx: derived(this, reader => {
                return this._layout.read(reader)?.minContentWidthRequired ?? 0;
            }),
            position: constObservable({ preference: { top: 0, left: 0 } }),
            allowEditorOverflow: false,
        }));
    }
    _isMouseOverWidget(e) {
        const layout = this._layout.get();
        if (!layout || !(e.event instanceof EditorMouseEvent)) {
            return false;
        }
        return layout.lowerBackground.containsPoint(new Point(e.event.relativePos.x, e.event.relativePos.y));
    }
    removePreviousViewZone(changeAccessor) {
        if (!this._previousViewZoneInfo) {
            return;
        }
        changeAccessor.removeZone(this._previousViewZoneInfo.id);
        const cursorLineNumber = this._editor.cursorLineNumber.get();
        if (cursorLineNumber !== null && cursorLineNumber >= this._previousViewZoneInfo.lineNumber) {
            this._editor.editor.setScrollTop(this._editor.scrollTop.get() - this._previousViewZoneInfo.height);
        }
        this._previousViewZoneInfo = undefined;
    }
    addViewZone(viewZoneInfo, changeAccessor) {
        const activeViewZone = changeAccessor.addZone({
            afterLineNumber: viewZoneInfo.lineNumber - 1,
            heightInPx: viewZoneInfo.height, // move computation to layout?
            domNode: $('div'),
        });
        this._previousViewZoneInfo = { height: viewZoneInfo.height, lineNumber: viewZoneInfo.lineNumber, id: activeViewZone };
        const cursorLineNumber = this._editor.cursorLineNumber.get();
        if (cursorLineNumber !== null && cursorLineNumber >= viewZoneInfo.lineNumber) {
            this._editor.editor.setScrollTop(this._editor.scrollTop.get() + viewZoneInfo.height);
        }
    }
};
InlineEditsLineReplacementView = __decorate([
    __param(4, ILanguageService),
    __param(5, IThemeService)
], InlineEditsLineReplacementView);
export { InlineEditsLineReplacementView };
function rangesToBubbleRanges(ranges) {
    const result = [];
    while (ranges.length) {
        let range = ranges.shift();
        if (range.startLineNumber !== range.endLineNumber) {
            ranges.push(new Range(range.startLineNumber + 1, 1, range.endLineNumber, range.endColumn));
            range = new Range(range.startLineNumber, range.startColumn, range.startLineNumber, Number.MAX_SAFE_INTEGER); // TODO: this is not correct
        }
        result.push(range);
    }
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdHNMaW5lUmVwbGFjZW1lbnRWaWV3LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvdmlldy9pbmxpbmVFZGl0cy9pbmxpbmVFZGl0c1ZpZXdzL2lubGluZUVkaXRzTGluZVJlcGxhY2VtZW50Vmlldy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUMzRSxPQUFPLEVBQWUsa0JBQWtCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUNsRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUN6RixPQUFPLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQWUsTUFBTSxnREFBZ0QsQ0FBQztBQUNySCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsZUFBZSxFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDaEgsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUUzRixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUUxRSxPQUFPLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsTUFBTSwyRkFBMkYsQ0FBQztBQUVuSixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDbEUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxLQUFLLEVB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