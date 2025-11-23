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
import { n } from '../../../../../../../../base/browser/dom.js';
import { Event } from '../../../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../../../base/common/lifecycle.js';
import { autorun, constObservable, debouncedObservable2, derived, derivedDisposable } from '../../../../../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../../../../../platform/instantiation/common/instantiation.js';
import { observableCodeEditor } from '../../../../../../../browser/observableCodeEditor.js';
import { Rect } from '../../../../../../../common/core/2d/rect.js';
import { Position } from '../../../../../../../common/core/position.js';
import { InlineEditTabAction } from '../../inlineEditsViewInterface.js';
import { getContentSizeOfLines, rectToProps } from '../../utils/utils.js';
import { OffsetRange } from '../../../../../../../common/core/ranges/offsetRange.js';
import { LineRange } from '../../../../../../../common/core/ranges/lineRange.js';
import { HideUnchangedRegionsFeature } from '../../../../../../../browser/widget/diffEditor/features/hideUnchangedRegionsFeature.js';
import { Codicon } from '../../../../../../../../base/common/codicons.js';
import { renderIcon } from '../../../../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { SymbolKinds } from '../../../../../../../common/languages.js';
import { debugLogHorizontalOffsetRanges, debugLogRects, debugView } from '../debugVisualization.js';
import { distributeFlexBoxLayout } from '../../utils/flexBoxLayout.js';
import { Point } from '../../../../../../../common/core/2d/point.js';
import { Size2D } from '../../../../../../../common/core/2d/size.js';
import { getMaxTowerHeightInAvailableArea } from '../../utils/towersLayout.js';
import { IThemeService } from '../../../../../../../../platform/theme/common/themeService.js';
import { IKeybindingService } from '../../../../../../../../platform/keybinding/common/keybinding.js';
import { getEditorBlendedColor, inlineEditIndicatorPrimaryBackground, inlineEditIndicatorSecondaryBackground, inlineEditIndicatorsuccessfulBackground } from '../../theme.js';
import { asCssVariable, descriptionForeground, editorBackground, editorWidgetBackground } from '../../../../../../../../platform/theme/common/colorRegistry.js';
import { LongDistancePreviewEditor } from './longDistancePreviewEditor.js';
import { jumpToNextInlineEditId } from '../../../../controller/commandIds.js';
const BORDER_RADIUS = 4;
const MAX_WIDGET_WIDTH = { EMPTY_SPACE: 425, OVERLAY: 375 };
const MIN_WIDGET_WIDTH = 250;
let InlineEditsLongDistanceHint = class InlineEditsLongDistanceHint extends Disposable {
    constructor(_editor, _viewState, _previewTextModel, _tabAction, _instantiationService, _themeService, _keybindingService) {
        super();
        this._editor = _editor;
        this._viewState = _viewState;
        this._previewTextModel = _previewTextModel;
        this._tabAction = _tabAction;
        this._instantiationService = _instantiationService;
        this._themeService = _themeService;
        this._keybindingService = _keybindingService;
        this.onDidClick = Event.None;
        this._viewWithElement = undefined;
        this._hintTextPosition = derived(this, (reader) => {
            const viewState = this._viewState.read(reader);
            return viewState ? new Position(viewState.hint.lineNumber, Number.MAX_SAFE_INTEGER) : null;
        });
        this._lineSizesAroundHintPosition = derived(this, (reader) => {
            const viewState = this._viewState.read(reader);
            const p = this._hintTextPosition.read(reader);
            if (!viewState || !p) {
                return undefined;
            }
            const model = this._editorObs.model.read(reader);
            if (!model) {
                return undefined;
            }
            const range = LineRange.ofLength(p.lineNumber, 1).addMargin(5, 5).intersect(LineRange.ofLength(1, model.getLineCount()));
            if (!range) {
                return undefined;
            }
            const sizes = getContentSizeOfLines(this._editorObs, range, reader);
            const top = this._editorObs.observeTopForLineNumber(range.startLineNumber).read(reader);
            return {
                lineRange: range,
                top: top,
                sizes: sizes,
            };
        });
        this._isVisibleDelayed = debouncedObservable2(derived(this, reader => this._viewState.read(reader)?.hint.isVisible), (lastValue, newValue) => lastValue === true && newValue === false ? 200 : 0);
        this._previewEditorLayoutInfo = derived(this, (reader) => {
            const viewState = this._viewState.read(reader);
            if (!viewState || !this._isVisibleDelayed.read(reader)) {
                return undefined;
            }
            const lineSizes = this._lineSizesAroundHintPosition.read(reader);
            if (!lineSizes) {
                return undefined;
            }
            const editorScrollTop = this._editorObs.scrollTop.read(reader);
            const editorScrollLeft = this._editorObs.scrollLeft.read(reader);
            const editorLayout = this._editorObs.layoutInfo.read(reader);
            const previewContentHeight = this._previewEditor.contentHeight.read(reader);
            const previewEditorContentLayout = this._previewEditor.horizontalContentRangeInPreviewEditorToShow.read(reader);
            if (!previewContentHeight || !previewEditorContentLayout) {
                return undefined;
            }
            // const debugRects = stackSizesDown(new Point(editorLayout.contentLeft, lineSizes.top - scrollTop), lineSizes.sizes);
            const editorTrueContentWidth = editorLayout.contentWidth - editorLayout.verticalScrollbarWidth;
            const editorTrueContentRight = editorLayout.contentLeft + editorTrueContentWidth;
            // drawEditorWidths(this._editor, reader);
            const c = this._editorObs.cursorLineNumber.read(reader);
            if (!c) {
                return undefined;
            }
            const availableSpaceSizes = lineSizes.sizes.map((s, idx) => {
                const lineNumber = lineSizes.lineRange.startLineNumber + idx;
                let linePaddingLeft = 20;
                if (lineNumber === viewState.hint.lineNumber) {
                    linePaddingLeft = 40;
                }
                return new Size2D(Math.max(0, editorTrueContentWidth - s.width - linePaddingLeft), s.height);
            });
            const showRects = false;
            if (showRects) {
                const rects2 = stackSizesDown(new Point(editorTrueContentRight, lineSizes.top - editorScrollTop), availableSpaceSizes, 'right');
                debugView(debugLogRects({ ...rects2 }, this._editor.getDomNode()), reader);
            }
            const availableSpaceHeightPrefixSums = getSums(availableSpaceSizes, s => s.height);
            const availableSpaceSizesTransposed = availableSpaceSizes.map(s => s.transpose());
            const previewEditorMargin = 2;
            const widgetPadding = 2;
            const lowerBarHeight = 20;
            const widgetBorder = 1;
            const extraGutterMarginToAvoidScrollBar = 2;
            const previewEditorHeight = previewContentHeight + extraGutterMarginToAvoidScrollBar;
            function getWidgetVerticalOutline(lineNumber) {
                const sizeIdx = lineNumber - lineSizes.lineRange.startLineNumber;
                const top = lineSizes.top + availableSpaceHeightPrefixSums[sizeIdx];
                const editorRange = OffsetRange.ofStartAndLength(top, previewEditorHeight);
                const verticalWidgetRange = editorRange.withMargin(previewEditorMargin + widgetPadding + widgetBorder).withMargin(0, lowerBarHeight);
                return verticalWidgetRange;
            }
            let possibleWidgetOutline = findFirstMinimzeDistance(lineSizes.lineRange.addMargin(-1, -1), viewState.hint.lineNumber, lineNumber => {
                const verticalWidgetRange = getWidgetVerticalOutline(lineNumber);
                const maxWidth = getMaxTowerHeightInAvailableArea(verticalWidgetRange.delta(-lineSizes.top), availableSpaceSizesTransposed);
                if (maxWidth < MIN_WIDGET_WIDTH) {
                    return undefined;
                }
                const horizontalWidgetRange = OffsetRange.ofStartAndLength(editorTrueContentRight - maxWidth, maxWidth);
                return { horizontalWidgetRange, verticalWidgetRange };
            });
            let position = 'empty-space';
            if (!possibleWidgetOutline) {
                position = 'overlay';
                const maxAvailableWidth = Math.min(editorLayout.width - editorLayout.contentLeft, MAX_WIDGET_WIDTH.OVERLAY);
                possibleWidgetOutline = {
                    horizontalWidgetRange: OffsetRange.ofStartAndLength(editorTrueContentRight - maxAvailableWidth, maxAvailableWidth),
                    verticalWidgetRange: getWidgetVerticalOutline(viewState.hint.lineNumber + 2).delta(10),
                };
            }
            if (!possibleWidgetOutline) {
                return undefined;
            }
            const rectAvailableSpace = Rect.fromRanges(possibleWidgetOutline.horizontalWidgetRange, possibleWidgetOutline.verticalWidgetRange).translateX(-editorScrollLeft).translateY(-editorScrollTop);
            const showAvailableSpace = false;
            if (showAvailableSpace) {
                debugView(debugLogRects({ rectAvailableSpace }, this._editor.getDomNode()), reader);
            }
            const maxWidgetWidth = Math.min(position === 'overlay' ? MAX_WIDGET_WIDTH.OVERLAY : MAX_WIDGET_WIDTH.EMPTY_SPACE, previewEditorContentLayout.maxEditorWidth + previewEditorMargin + widgetPadding);
            const layout = distributeFlexBoxLayout(rectAvailableSpace.width, {
                spaceBefore: { min: 0, max: 10, priority: 1 },
                content: { min: 50, rules: [{ max: 150, priority: 2 }, { max: maxWidgetWidth, priority: 1 }] },
                spaceAfter: { min: 10 },
            });
            if (!layout) {
                return null;
            }
            const ranges = lengthsToOffsetRanges([layout.spaceBefore, layout.content, layout.spaceAfter], rectAvailableSpace.left);
            const spaceBeforeRect = rectAvailableSpace.withHorizontalRange(ranges[0]);
            const widgetRect = rectAvailableSpace.withHorizontalRange(ranges[1]);
            const spaceAfterRect = rectAvailableSpace.withHorizontalRange(ranges[2]);
            const showRects2 = false;
            if (showRects2) {
                debugView(debugLogRects({ spaceBeforeRect, widgetRect, spaceAfterRect }, this._editor.getDomNode()), reader);
            }
            const previewEditorRect = widgetRect.withMargin(-widgetPadding - widgetBorder - previewEditorMargin).withMargin(0, 0, -lowerBarHeight, 0);
            const showEditorRect = false;
            if (showEditorRect) {
                debugView(debugLogRects({ previewEditorRect }, this._editor.getDomNode()), reader);
            }
            const previewEditorContentWidth = previewEditorRect.width - previewEditorContentLayout.nonContentWidth;
            const maxPrefferedRangeLength = previewEditorContentWidth * 0.8;
            const preferredRangeToReveal = previewEditorContentLayout.preferredRangeToReveal.intersect(OffsetRange.ofStartAndLength(previewEditorContentLayout.preferredRangeToReveal.start, maxPrefferedRangeLength)) ?? previewEditorContentLayout.preferredRangeToReveal;
            const desiredPreviewEditorScrollLeft = scrollToReveal(previewEditorContentLayout.indentationEnd, previewEditorContentWidth, preferredRangeToReveal);
            return {
                codeEditorSize: previewEditorRect.getSize(),
                codeScrollLeft: editorScrollLeft,
                contentLeft: editorLayout.contentLeft,
                widgetRect,
                previewEditorMargin,
                widgetPadding,
                widgetBorder,
                lowerBarHeight,
                desiredPreviewEditorScrollLeft: desiredPreviewEditorScrollLeft.newScrollPosition,
            };
        });
        this._view = n.div({
            class: 'inline-edits-view',
            style: {
                position: 'absolute',
                overflow: 'visible',
                top: '0px',
                left: '0px',
                display: derived(this, reader => !!this._previewEditorLayoutInfo.read(reader) ? 'block' : 'none'),
            },
        }, [
            derived(this, _reader => [this._widgetContent]),
        ]);
        this._widgetContent = derived(this, reader => // TODO@hediet: remove when n.div lazily creates previewEditor.element node
         n.div({
            class: 'inline-edits-long-distance-hint-widget',
            style: {
                position: 'absolute',
                overflow: 'hidden',
                cursor: 'pointer',
                background: asCssVariable(editorWidgetBackground),
                padding: this._previewEditorLayoutInfo.map(i => i?.widgetPadding),
                boxSizing: 'border-box',
                borderRadius: BORDER_RADIUS,
                border: derived(reader => `${this._previewEditorLayoutInfo.read(reader)?.widgetBorder}px solid ${this._styles.read(reader).border}`),
                display: 'flex',
                flexDirection: 'column',
                opacity: derived(reader => this._viewState.read(reader)?.hint.isVisible ? '1' : '0'),
                transition: 'opacity 200ms ease-in-out',
                ...rectToProps(reader => this._previewEditorLayoutInfo.read(reader)?.widgetRect)
            },
            onmousedown: e => {
                e.preventDefault(); // This prevents that the editor loses focus
            },
            onclick: () => {
                this._viewState.read(undefined)?.model.jump();
            }
        }, [
            n.div({
                class: ['editorContainer'],
                style: {
                    overflow: 'hidden',
                    padding: this._previewEditorLayoutInfo.map(i => i?.previewEditorMargin),
                    background: asCssVariable(editorBackground),
                    pointerEvents: 'none',
                },
            }, [
                derived(this, r => this._previewEditor.element), // --
            ]),
            n.div({ class: 'bar', style: { color: asCssVariable(descriptionForeground), pointerEvents: 'none', margin: '0 4px', height: this._previewEditorLayoutInfo.map(i => i?.lowerBarHeight), display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                derived(this, reader => {
                    const children = [];
                    const viewState = this._viewState.read(reader);
                    if (!viewState) {
                        return children;
                    }
                    // Outline Element
                    const source = this._originalOutlineSource.read(reader);
                    const outlineItems = source?.getAt(viewState.edit.lineEdit.lineRange.startLineNumber, reader).slice(0, 1) ?? [];
                    const outlineElements = [];
                    if (outlineItems.length > 0) {
                        for (let i = 0; i < outlineItems.length; i++) {
                            const item = outlineItems[i];
                            const icon = SymbolKinds.toIcon(item.kind);
                            outlineElements.push(n.div({
                                class: 'breadcrumb-item',
                                style: { display: 'flex', alignItems: 'center', flex: '1 1 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
                            }, [
                                renderIcon(icon),
                                '\u00a0',
                                item.name,
                                ...(i === outlineItems.length - 1
                                    ? []
                                    : [renderIcon(Codicon.chevronRight)])
                            ]));
                        }
                    }
                    children.push(n.div({ class: 'outline-elements', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, outlineElements));
                    // Show Edit Direction
                    const arrowIcon = isEditBelowHint(viewState) ? Codicon.arrowDown : Codicon.arrowUp;
                    const keybinding = this._keybindingService.lookupKeybinding(jumpToNextInlineEditId);
                    let label = 'Go to suggestion';
                    if (keybinding && keybinding.getLabel() === 'Tab') {
                        label = 'Tab to suggestion';
                    }
                    children.push(n.div({
                        class: 'go-to-label',
                        style: { position: 'relative', display: 'flex', alignItems: 'center', flex: '0 0 auto', paddingLeft: '6px' },
                    }, [
                        label,
                        '\u00a0',
                        renderIcon(arrowIcon),
                    ]));
                    return children;
                })
            ]),
        ]));
        this._originalOutlineSource = derivedDisposable(this, (reader) => {
            const m = this._editorObs.model.read(reader);
            const factory = HideUnchangedRegionsFeature._breadcrumbsSourceFactory.read(reader);
            return (!m || !factory) ? undefined : factory(m, this._instantiationService);
        });
        this._styles = this._tabAction.map((v, reader) => {
            let border;
            switch (v) {
                case InlineEditTabAction.Inactive:
                    border = inlineEditIndicatorSecondaryBackground;
                    break;
                case InlineEditTabAction.Jump:
                    border = inlineEditIndicatorPrimaryBackground;
                    break;
                case InlineEditTabAction.Accept:
                    border = inlineEditIndicatorsuccessfulBackground;
                    break;
            }
            return {
                border: getEditorBlendedColor(border, this._themeService).read(reader).toString(),
                background: asCssVariable(editorBackground)
            };
        });
        this._editorObs = observableCodeEditor(this._editor);
        this._previewEditor = this._register(this._instantiationService.createInstance(LongDistancePreviewEditor, this._previewTextModel, derived(reader => {
            const viewState = this._viewState.read(reader);
            if (!viewState) {
                return undefined;
            }
            return {
                diff: viewState.diff,
                model: viewState.model,
                suggestInfo: viewState.suggestInfo,
            };
        }), this._editor, this._tabAction));
        this._viewWithElement = this._view.keepUpdated(this._store);
        this._register(this._editorObs.createOverlayWidget({
            domNode: this._viewWithElement.element,
            position: constObservable(null),
            allowEditorOverflow: false,
            minContentWidthInPx: constObservable(0),
        }));
        this._widgetContent.get().keepUpdated(this._store);
        this._register(autorun(reader => {
            const layoutInfo = this._previewEditorLayoutInfo.read(reader);
            if (!layoutInfo) {
                return;
            }
            this._previewEditor.layout(layoutInfo.codeEditorSize.toDimension(), layoutInfo.desiredPreviewEditorScrollLeft);
        }));
        this._isVisibleDelayed.recomputeInitiallyAndOnChange(this._store);
    }
    get isHovered() { return this._widgetContent.get().didMouseMoveDuringHover; }
};
InlineEditsLongDistanceHint = __decorate([
    __param(4, IInstantiationService),
    __param(5, IThemeService),
    __param(6, IKeybindingService)
], InlineEditsLongDistanceHint);
export { InlineEditsLongDistanceHint };
function lengthsToOffsetRanges(lengths, initialOffset = 0) {
    const result = [];
    let offset = initialOffset;
    for (const length of lengths) {
        result.push(new OffsetRange(offset, offset + length));
        offset += length;
    }
    return result;
}
function stackSizesDown(at, sizes, alignment = 'left') {
    const rects = [];
    let offset = 0;
    for (const s of sizes) {
        rects.push(Rect.fromLeftTopWidthHeight(at.x + (alignment === 'left' ? 0 : -s.width), at.y + offset, s.width, s.height));
        offset += s.height;
    }
    return rects;
}
function findFirstMinimzeDistance(range, targetLine, predicate) {
    for (let offset = 0;; offset++) {
        const down = targetLine + offset;
        if (down <= range.endLineNumberExclusive) {
            const result = predicate(down);
            if (result !== undefined) {
                return result;
            }
        }
        const up = targetLine - offset;
        if (up >= range.startLineNumber) {
            const result = predicate(up);
            if (result !== undefined) {
                return result;
            }
        }
        if (up < range.startLineNumber && down > range.endLineNumberExclusive) {
            return undefined;
        }
    }
}
function getSums(array, fn) {
    const result = [0];
    let sum = 0;
    for (const item of array) {
        sum += fn(item);
        result.push(sum);
    }
    return result;
}
function isEditBelowHint(viewState) {
    const hintLineNumber = viewState.hint.lineNumber;
    const editStartLineNumber = viewState.diff[0]?.original.startLineNumber;
    return hintLineNumber < editStartLineNumber;
}
export function drawEditorWidths(e, reader) {
    const layoutInfo = e.getLayoutInfo();
    const contentLeft = new OffsetRange(0, layoutInfo.contentLeft);
    const trueContent = OffsetRange.ofStartAndLength(layoutInfo.contentLeft, layoutInfo.contentWidth - layoutInfo.verticalScrollbarWidth);
    const minimap = OffsetRange.ofStartAndLength(trueContent.endExclusive, layoutInfo.minimap.minimapWidth);
    const verticalScrollbar = OffsetRange.ofStartAndLength(minimap.endExclusive, layoutInfo.verticalScrollbarWidth);
    const r = new OffsetRange(0, 200);
    debugView(debugLogHorizontalOffsetRanges({
        contentLeft: Rect.fromRanges(contentLeft, r),
        trueContent: Rect.fromRanges(trueContent, r),
        minimap: Rect.fromRanges(minimap, r),
        verticalScrollbar: Rect.fromRanges(verticalScrollbar, r),
    }, e.getDomNode()), reader);
}
/**
 * Changes the scroll position as little as possible just to reveal the given range in the window.
*/
export function scrollToReveal(currentScrollPosition, windowWidth, contentRangeToReveal) {
    const visibleRange = new OffsetRange(currentScrollPosition, currentScrollPosition + windowWidth);
    if (visibleRange.containsRange(contentRangeToReveal)) {
        return { newScrollPosition: currentScrollPosition };
    }
    if (contentRangeToReveal.length > windowWidth) {
        return { newScrollPosition: contentRangeToReveal.start };
    }
    if (contentRangeToReveal.endExclusive > visibleRange.endExclusive) {
        return { newScrollPosition: contentRangeToReveal.endExclusive - windowWidth };
    }
    if (contentRangeToReveal.start < visibleRange.start) {
        return { newScrollPosition: contentRangeToReveal.start };
    }
    return { newScrollPosition: currentScrollPosition };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdHNMb25nRGlzdGFuY2VIaW50LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvdmlldy9pbmxpbmVFZGl0cy9pbmxpbmVFZGl0c1ZpZXdzL2xvbmdEaXN0YW5jZUhpbnQvaW5saW5lRWRpdHNMb25nRGlzdGFuY2VIaW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBOzs7Z0dBR2dHO0FBQ2hHLE9BQU8sRUFBYSxDQUFDLEVBQXlDLE1BQU0sNkNBQTZDLENBQUM7QUFDbEgsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM5RSxPQUFPLEVBQXdCLE9BQU8sRUFBRSxlQUFlLEVBQUUsb0JBQW9CLEVBQUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDckssT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sd0VBQXdFLENBQUM7QUFFL0csT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDNUYsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUV4RSxPQUFPLEVBQW9CLG1CQUFtQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFMUYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLFdBQVcsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBRTFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUNyRixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDakYsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0s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