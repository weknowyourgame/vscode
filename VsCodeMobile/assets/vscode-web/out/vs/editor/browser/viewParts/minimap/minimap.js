/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import './minimap.css';
import * as dom from '../../../../base/browser/dom.js';
import { createFastDomNode } from '../../../../base/browser/fastDomNode.js';
import { GlobalPointerMoveMonitor } from '../../../../base/browser/globalPointerMoveMonitor.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import * as platform from '../../../../base/common/platform.js';
import * as strings from '../../../../base/common/strings.js';
import { RenderedLinesCollection } from '../../view/viewLayer.js';
import { PartFingerprints, ViewPart } from '../../view/viewPart.js';
import { MINIMAP_GUTTER_WIDTH, EditorLayoutInfoComputer } from '../../../common/config/editorOptions.js';
import { Range } from '../../../common/core/range.js';
import { RGBA8 } from '../../../common/core/misc/rgba.js';
import { MinimapTokensColorTracker } from '../../../common/viewModel/minimapTokensColorTracker.js';
import { minimapSelection, minimapBackground, minimapForegroundOpacity, editorForeground } from '../../../../platform/theme/common/colorRegistry.js';
import { Selection } from '../../../common/core/selection.js';
import { EventType, Gesture } from '../../../../base/browser/touch.js';
import { MinimapCharRendererFactory } from './minimapCharRendererFactory.js';
import { createSingleCallFunction } from '../../../../base/common/functional.js';
import { LRUCache } from '../../../../base/common/map.js';
import { DEFAULT_FONT_FAMILY } from '../../../../base/browser/fonts.js';
import { ViewModelDecoration } from '../../../common/viewModel/viewModelDecoration.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
/**
 * The orthogonal distance to the slider at which dragging "resets". This implements "snapping"
 */
const POINTER_DRAG_RESET_DISTANCE = 140;
const GUTTER_DECORATION_WIDTH = 2;
class MinimapOptions {
    constructor(configuration, theme, tokensColorTracker) {
        const options = configuration.options;
        const pixelRatio = options.get(163 /* EditorOption.pixelRatio */);
        const layoutInfo = options.get(165 /* EditorOption.layoutInfo */);
        const minimapLayout = layoutInfo.minimap;
        const fontInfo = options.get(59 /* EditorOption.fontInfo */);
        const minimapOpts = options.get(81 /* EditorOption.minimap */);
        this.renderMinimap = minimapLayout.renderMinimap;
        this.size = minimapOpts.size;
        this.minimapHeightIsEditorHeight = minimapLayout.minimapHeightIsEditorHeight;
        this.scrollBeyondLastLine = options.get(119 /* EditorOption.scrollBeyondLastLine */);
        this.paddingTop = options.get(96 /* EditorOption.padding */).top;
        this.paddingBottom = options.get(96 /* EditorOption.padding */).bottom;
        this.showSlider = minimapOpts.showSlider;
        this.autohide = minimapOpts.autohide;
        this.pixelRatio = pixelRatio;
        this.typicalHalfwidthCharacterWidth = fontInfo.typicalHalfwidthCharacterWidth;
        this.lineHeight = options.get(75 /* EditorOption.lineHeight */);
        this.minimapLeft = minimapLayout.minimapLeft;
        this.minimapWidth = minimapLayout.minimapWidth;
        this.minimapHeight = layoutInfo.height;
        this.canvasInnerWidth = minimapLayout.minimapCanvasInnerWidth;
        this.canvasInnerHeight = minimapLayout.minimapCanvasInnerHeight;
        this.canvasOuterWidth = minimapLayout.minimapCanvasOuterWidth;
        this.canvasOuterHeight = minimapLayout.minimapCanvasOuterHeight;
        this.isSampling = minimapLayout.minimapIsSampling;
        this.editorHeight = layoutInfo.height;
        this.fontScale = minimapLayout.minimapScale;
        this.minimapLineHeight = minimapLayout.minimapLineHeight;
        this.minimapCharWidth = 1 /* Constants.BASE_CHAR_WIDTH */ * this.fontScale;
        this.sectionHeaderFontFamily = DEFAULT_FONT_FAMILY;
        this.sectionHeaderFontSize = minimapOpts.sectionHeaderFontSize * pixelRatio;
        this.sectionHeaderLetterSpacing = minimapOpts.sectionHeaderLetterSpacing; // intentionally not multiplying by pixelRatio
        this.sectionHeaderFontColor = MinimapOptions._getSectionHeaderColor(theme, tokensColorTracker.getColor(1 /* ColorId.DefaultForeground */));
        this.charRenderer = createSingleCallFunction(() => MinimapCharRendererFactory.create(this.fontScale, fontInfo.fontFamily));
        this.defaultBackgroundColor = tokensColorTracker.getColor(2 /* ColorId.DefaultBackground */);
        this.backgroundColor = MinimapOptions._getMinimapBackground(theme, this.defaultBackgroundColor);
        this.foregroundAlpha = MinimapOptions._getMinimapForegroundOpacity(theme);
    }
    static _getMinimapBackground(theme, defaultBackgroundColor) {
        const themeColor = theme.getColor(minimapBackground);
        if (themeColor) {
            return new RGBA8(themeColor.rgba.r, themeColor.rgba.g, themeColor.rgba.b, Math.round(255 * themeColor.rgba.a));
        }
        return defaultBackgroundColor;
    }
    static _getMinimapForegroundOpacity(theme) {
        const themeColor = theme.getColor(minimapForegroundOpacity);
        if (themeColor) {
            return RGBA8._clamp(Math.round(255 * themeColor.rgba.a));
        }
        return 255;
    }
    static _getSectionHeaderColor(theme, defaultForegroundColor) {
        const themeColor = theme.getColor(editorForeground);
        if (themeColor) {
            return new RGBA8(themeColor.rgba.r, themeColor.rgba.g, themeColor.rgba.b, Math.round(255 * themeColor.rgba.a));
        }
        return defaultForegroundColor;
    }
    equals(other) {
        return (this.renderMinimap === other.renderMinimap
            && this.size === other.size
            && this.minimapHeightIsEditorHeight === other.minimapHeightIsEditorHeight
            && this.scrollBeyondLastLine === other.scrollBeyondLastLine
            && this.paddingTop === other.paddingTop
            && this.paddingBottom === other.paddingBottom
            && this.showSlider === other.showSlider
            && this.autohide === other.autohide
            && this.pixelRatio === other.pixelRatio
            && this.typicalHalfwidthCharacterWidth === other.typicalHalfwidthCharacterWidth
            && this.lineHeight === other.lineHeight
            && this.minimapLeft === other.minimapLeft
            && this.minimapWidth === other.minimapWidth
            && this.minimapHeight === other.minimapHeight
            && this.canvasInnerWidth === other.canvasInnerWidth
            && this.canvasInnerHeight === other.canvasInnerHeight
            && this.canvasOuterWidth === other.canvasOuterWidth
            && this.canvasOuterHeight === other.canvasOuterHeight
            && this.isSampling === other.isSampling
            && this.editorHeight === other.editorHeight
            && this.fontScale === other.fontScale
            && this.minimapLineHeight === other.minimapLineHeight
            && this.minimapCharWidth === other.minimapCharWidth
            && this.sectionHeaderFontSize === other.sectionHeaderFontSize
            && this.sectionHeaderLetterSpacing === other.sectionHeaderLetterSpacing
            && this.defaultBackgroundColor && this.defaultBackgroundColor.equals(other.defaultBackgroundColor)
            && this.backgroundColor && this.backgroundColor.equals(other.backgroundColor)
            && this.foregroundAlpha === other.foregroundAlpha);
    }
}
class MinimapLayout {
    constructor(
    /**
     * The given editor scrollTop (input).
     */
    scrollTop, 
    /**
     * The given editor scrollHeight (input).
     */
    scrollHeight, sliderNeeded, _computedSliderRatio, 
    /**
     * slider dom node top (in CSS px)
     */
    sliderTop, 
    /**
     * slider dom node height (in CSS px)
     */
    sliderHeight, 
    /**
     * empty lines to reserve at the top of the minimap.
     */
    topPaddingLineCount, 
    /**
     * minimap render start line number.
     */
    startLineNumber, 
    /**
     * minimap render end line number.
     */
    endLineNumber) {
        this.scrollTop = scrollTop;
        this.scrollHeight = scrollHeight;
        this.sliderNeeded = sliderNeeded;
        this._computedSliderRatio = _computedSliderRatio;
        this.sliderTop = sliderTop;
        this.sliderHeight = sliderHeight;
        this.topPaddingLineCount = topPaddingLineCount;
        this.startLineNumber = startLineNumber;
        this.endLineNumber = endLineNumber;
    }
    /**
     * Compute a desired `scrollPosition` such that the slider moves by `delta`.
     */
    getDesiredScrollTopFromDelta(delta) {
        return Math.round(this.scrollTop + delta / this._computedSliderRatio);
    }
    getDesiredScrollTopFromTouchLocation(pageY) {
        return Math.round((pageY - this.sliderHeight / 2) / this._computedSliderRatio);
    }
    /**
     * Intersect a line range with `this.startLineNumber` and `this.endLineNumber`.
     */
    intersectWithViewport(range) {
        const startLineNumber = Math.max(this.startLineNumber, range.startLineNumber);
        const endLineNumber = Math.min(this.endLineNumber, range.endLineNumber);
        if (startLineNumber > endLineNumber) {
            // entirely outside minimap's viewport
            return null;
        }
        return [startLineNumber, endLineNumber];
    }
    /**
     * Get the inner minimap y coordinate for a line number.
     */
    getYForLineNumber(lineNumber, minimapLineHeight) {
        return +(lineNumber - this.startLineNumber + this.topPaddingLineCount) * minimapLineHeight;
    }
    static create(options, viewportStartLineNumber, viewportEndLineNumber, viewportStartLineNumberVerticalOffset, viewportHeight, viewportContainsWhitespaceGaps, lineCount, realLineCount, scrollTop, scrollHeight, previousLayout) {
        const pixelRatio = options.pixelRatio;
        const minimapLineHeight = options.minimapLineHeight;
        const minimapLinesFitting = Math.floor(options.canvasInnerHeight / minimapLineHeight);
        const lineHeight = options.lineHeight;
        if (options.minimapHeightIsEditorHeight) {
            let logicalScrollHeight = (realLineCount * options.lineHeight
                + options.paddingTop
                + options.paddingBottom);
            if (options.scrollBeyondLastLine) {
                logicalScrollHeight += Math.max(0, viewportHeight - options.lineHeight - options.paddingBottom);
            }
            const sliderHeight = Math.max(1, Math.floor(viewportHeight * viewportHeight / logicalScrollHeight));
            const maxMinimapSliderTop = Math.max(0, options.minimapHeight - sliderHeight);
            // The slider can move from 0 to `maxMinimapSliderTop`
            // in the same way `scrollTop` can move from 0 to `scrollHeight` - `viewportHeight`.
            const computedSliderRatio = (maxMinimapSliderTop) / (scrollHeight - viewportHeight);
            const sliderTop = (scrollTop * computedSliderRatio);
            const sliderNeeded = (maxMinimapSliderTop > 0);
            const maxLinesFitting = Math.floor(options.canvasInnerHeight / options.minimapLineHeight);
            const topPaddingLineCount = Math.floor(options.paddingTop / options.lineHeight);
            return new MinimapLayout(scrollTop, scrollHeight, sliderNeeded, computedSliderRatio, sliderTop, sliderHeight, topPaddingLineCount, 1, Math.min(lineCount, maxLinesFitting));
        }
        // The visible line count in a viewport can change due to a number of reasons:
        //  a) with the same viewport width, different scroll positions can result in partial lines being visible:
        //    e.g. for a line height of 20, and a viewport height of 600
        //          * scrollTop = 0  => visible lines are [1, 30]
        //          * scrollTop = 10 => visible lines are [1, 31] (with lines 1 and 31 partially visible)
        //          * scrollTop = 20 => visible lines are [2, 31]
        //  b) whitespace gaps might make their way in the viewport (which results in a decrease in the visible line count)
        //  c) we could be in the scroll beyond last line case (which also results in a decrease in the visible line count, down to possibly only one line being visible)
        // We must first establish a desirable slider height.
        let sliderHeight;
        if (viewportContainsWhitespaceGaps && viewportEndLineNumber !== lineCount) {
            // case b) from above: there are whitespace gaps in the viewport.
            // In this case, the height of the slider directly reflects the visible line count.
            const viewportLineCount = viewportEndLineNumber - viewportStartLineNumber + 1;
            sliderHeight = Math.floor(viewportLineCount * minimapLineHeight / pixelRatio);
        }
        else {
            // The slider has a stable height
            const expectedViewportLineCount = viewportHeight / lineHeight;
            sliderHeight = Math.floor(expectedViewportLineCount * minimapLineHeight / pixelRatio);
        }
        const extraLinesAtTheTop = Math.floor(options.paddingTop / lineHeight);
        let extraLinesAtTheBottom = Math.floor(options.paddingBottom / lineHeight);
        if (options.scrollBeyondLastLine) {
            const expectedViewportLineCount = viewportHeight / lineHeight;
            extraLinesAtTheBottom = Math.max(extraLinesAtTheBottom, expectedViewportLineCount - 1);
        }
        let maxMinimapSliderTop;
        if (extraLinesAtTheBottom > 0) {
            const expectedViewportLineCount = viewportHeight / lineHeight;
            // The minimap slider, when dragged all the way down, will contain the last line at its top
            maxMinimapSliderTop = (extraLinesAtTheTop + lineCount + extraLinesAtTheBottom - expectedViewportLineCount - 1) * minimapLineHeight / pixelRatio;
        }
        else {
            // The minimap slider, when dragged all the way down, will contain the last line at its bottom
            maxMinimapSliderTop = Math.max(0, (extraLinesAtTheTop + lineCount) * minimapLineHeight / pixelRatio - sliderHeight);
        }
        maxMinimapSliderTop = Math.min(options.minimapHeight - sliderHeight, maxMinimapSliderTop);
        // The slider can move from 0 to `maxMinimapSliderTop`
        // in the same way `scrollTop` can move from 0 to `scrollHeight` - `viewportHeight`.
        const computedSliderRatio = (maxMinimapSliderTop) / (scrollHeight - viewportHeight);
        const sliderTop = (scrollTop * computedSliderRatio);
        if (minimapLinesFitting >= extraLinesAtTheTop + lineCount + extraLinesAtTheBottom) {
            // All lines fit in the minimap
            const sliderNeeded = (maxMinimapSliderTop > 0);
            return new MinimapLayout(scrollTop, scrollHeight, sliderNeeded, computedSliderRatio, sliderTop, sliderHeight, extraLinesAtTheTop, 1, lineCount);
        }
        else {
            let consideringStartLineNumber;
            if (viewportStartLineNumber > 1) {
                consideringStartLineNumber = viewportStartLineNumber + extraLinesAtTheTop;
            }
            else {
                consideringStartLineNumber = Math.max(1, scrollTop / lineHeight);
            }
            let topPaddingLineCount;
            let startLineNumber = Math.max(1, Math.floor(consideringStartLineNumber - sliderTop * pixelRatio / minimapLineHeight));
            if (startLineNumber < extraLinesAtTheTop) {
                topPaddingLineCount = extraLinesAtTheTop - startLineNumber + 1;
                startLineNumber = 1;
            }
            else {
                topPaddingLineCount = 0;
                startLineNumber = Math.max(1, startLineNumber - extraLinesAtTheTop);
            }
            // Avoid flickering caused by a partial viewport start line
            // by being consistent w.r.t. the previous layout decision
            if (previousLayout && previousLayout.scrollHeight === scrollHeight) {
                if (previousLayout.scrollTop > scrollTop) {
                    // Scrolling up => never increase `startLineNumber`
                    startLineNumber = Math.min(startLineNumber, previousLayout.startLineNumber);
                    topPaddingLineCount = Math.max(topPaddingLineCount, previousLayout.topPaddingLineCount);
                }
                if (previousLayout.scrollTop < scrollTop) {
                    // Scrolling down => never decrease `startLineNumber`
                    startLineNumber = Math.max(startLineNumber, previousLayout.startLineNumber);
                    topPaddingLineCount = Math.min(topPaddingLineCount, previousLayout.topPaddingLineCount);
                }
            }
            const endLineNumber = Math.min(lineCount, startLineNumber - topPaddingLineCount + minimapLinesFitting - 1);
            const partialLine = (scrollTop - viewportStartLineNumberVerticalOffset) / lineHeight;
            let sliderTopAligned;
            if (scrollTop >= options.paddingTop) {
                sliderTopAligned = (viewportStartLineNumber - startLineNumber + topPaddingLineCount + partialLine) * minimapLineHeight / pixelRatio;
            }
            else {
                sliderTopAligned = (scrollTop / options.paddingTop) * (topPaddingLineCount + partialLine) * minimapLineHeight / pixelRatio;
            }
            return new MinimapLayout(scrollTop, scrollHeight, true, computedSliderRatio, sliderTopAligned, sliderHeight, topPaddingLineCount, startLineNumber, endLineNumber);
        }
    }
}
class MinimapLine {
    static { this.INVALID = new MinimapLine(-1); }
    constructor(dy) {
        this.dy = dy;
    }
    onContentChanged() {
        this.dy = -1;
    }
    onTokensChanged() {
        this.dy = -1;
    }
}
class RenderData {
    constructor(renderedLayout, imageData, lines) {
        this.renderedLayout = renderedLayout;
        this._imageData = imageData;
        this._renderedLines = new RenderedLinesCollection({
            createLine: () => MinimapLine.INVALID
        });
        this._renderedLines._set(renderedLayout.startLineNumber, lines);
    }
    /**
     * Check if the current RenderData matches accurately the new desired layout and no painting is needed.
     */
    linesEquals(layout) {
        if (!this.scrollEquals(layout)) {
            return false;
        }
        const tmp = this._renderedLines._get();
        const lines = tmp.lines;
        for (let i = 0, len = lines.length; i < len; i++) {
            if (lines[i].dy === -1) {
                // This line is invalid
                return false;
            }
        }
        return true;
    }
    /**
     * Check if the current RenderData matches the new layout's scroll position
     */
    scrollEquals(layout) {
        return this.renderedLayout.startLineNumber === layout.startLineNumber
            && this.renderedLayout.endLineNumber === layout.endLineNumber;
    }
    _get() {
        const tmp = this._renderedLines._get();
        return {
            imageData: this._imageData,
            rendLineNumberStart: tmp.rendLineNumberStart,
            lines: tmp.lines
        };
    }
    onLinesChanged(changeFromLineNumber, changeCount) {
        return this._renderedLines.onLinesChanged(changeFromLineNumber, changeCount);
    }
    onLinesDeleted(deleteFromLineNumber, deleteToLineNumber) {
        this._renderedLines.onLinesDeleted(deleteFromLineNumber, deleteToLineNumber);
    }
    onLinesInserted(insertFromLineNumber, insertToLineNumber) {
        this._renderedLines.onLinesInserted(insertFromLineNumber, insertToLineNumber);
    }
    onTokensChanged(ranges) {
        return this._renderedLines.onTokensChanged(ranges);
    }
}
/**
 * Some sort of double buffering.
 *
 * Keeps two buffers around that will be rotated for painting.
 * Always gives a buffer that is filled with the background color.
 */
class MinimapBuffers {
    constructor(ctx, WIDTH, HEIGHT, background) {
        this._backgroundFillData = MinimapBuffers._createBackgroundFillData(WIDTH, HEIGHT, background);
        this._buffers = [
            ctx.createImageData(WIDTH, HEIGHT),
            ctx.createImageData(WIDTH, HEIGHT)
        ];
        this._lastUsedBuffer = 0;
    }
    getBuffer() {
        // rotate buffers
        this._lastUsedBuffer = 1 - this._lastUsedBuffer;
        const result = this._buffers[this._lastUsedBuffer];
        // fill with background color
        result.data.set(this._backgroundFillData);
        return result;
    }
    static _createBackgroundFillData(WIDTH, HEIGHT, background) {
        const backgroundR = background.r;
        const backgroundG = background.g;
        const backgroundB = background.b;
        const backgroundA = background.a;
        const result = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
        let offset = 0;
        for (let i = 0; i < HEIGHT; i++) {
            for (let j = 0; j < WIDTH; j++) {
                result[offset] = backgroundR;
                result[offset + 1] = backgroundG;
                result[offset + 2] = backgroundB;
                result[offset + 3] = backgroundA;
                offset += 4;
            }
        }
        return result;
    }
}
class MinimapSamplingState {
    static compute(options, viewLineCount, oldSamplingState) {
        if (options.renderMinimap === 0 /* RenderMinimap.None */ || !options.isSampling) {
            return [null, []];
        }
        // ratio is intentionally not part of the layout to avoid the layout changing all the time
        // so we need to recompute it again...
        const { minimapLineCount } = EditorLayoutInfoComputer.computeContainedMinimapLineCount({
            viewLineCount: viewLineCount,
            scrollBeyondLastLine: options.scrollBeyondLastLine,
            paddingTop: options.paddingTop,
            paddingBottom: options.paddingBottom,
            height: options.editorHeight,
            lineHeight: options.lineHeight,
            pixelRatio: options.pixelRatio
        });
        const ratio = viewLineCount / minimapLineCount;
        const halfRatio = ratio / 2;
        if (!oldSamplingState || oldSamplingState.minimapLines.length === 0) {
            const result = [];
            result[0] = 1;
            if (minimapLineCount > 1) {
                for (let i = 0, lastIndex = minimapLineCount - 1; i < lastIndex; i++) {
                    result[i] = Math.round(i * ratio + halfRatio);
                }
                result[minimapLineCount - 1] = viewLineCount;
            }
            return [new MinimapSamplingState(ratio, result), []];
        }
        const oldMinimapLines = oldSamplingState.minimapLines;
        const oldLength = oldMinimapLines.length;
        const result = [];
        let oldIndex = 0;
        let oldDeltaLineCount = 0;
        let minViewLineNumber = 1;
        const MAX_EVENT_COUNT = 10; // generate at most 10 events, if there are more than 10 changes, just flush all previous data
        let events = [];
        let lastEvent = null;
        for (let i = 0; i < minimapLineCount; i++) {
            const fromViewLineNumber = Math.max(minViewLineNumber, Math.round(i * ratio));
            const toViewLineNumber = Math.max(fromViewLineNumber, Math.round((i + 1) * ratio));
            while (oldIndex < oldLength && oldMinimapLines[oldIndex] < fromViewLineNumber) {
                if (events.length < MAX_EVENT_COUNT) {
                    const oldMinimapLineNumber = oldIndex + 1 + oldDeltaLineCount;
                    if (lastEvent && lastEvent.type === 'deleted' && lastEvent._oldIndex === oldIndex - 1) {
                        lastEvent.deleteToLineNumber++;
                    }
                    else {
                        lastEvent = { type: 'deleted', _oldIndex: oldIndex, deleteFromLineNumber: oldMinimapLineNumber, deleteToLineNumber: oldMinimapLineNumber };
                        events.push(lastEvent);
                    }
                    oldDeltaLineCount--;
                }
                oldIndex++;
            }
            let selectedViewLineNumber;
            if (oldIndex < oldLength && oldMinimapLines[oldIndex] <= toViewLineNumber) {
                // reuse the old sampled line
                selectedViewLineNumber = oldMinimapLines[oldIndex];
                oldIndex++;
            }
            else {
                if (i === 0) {
                    selectedViewLineNumber = 1;
                }
                else if (i + 1 === minimapLineCount) {
                    selectedViewLineNumber = viewLineCount;
                }
                else {
                    selectedViewLineNumber = Math.round(i * ratio + halfRatio);
                }
                if (events.length < MAX_EVENT_COUNT) {
                    const oldMinimapLineNumber = oldIndex + 1 + oldDeltaLineCount;
                    if (lastEvent && lastEvent.type === 'inserted' && lastEvent._i === i - 1) {
                        lastEvent.insertToLineNumber++;
                    }
                    else {
                        lastEvent = { type: 'inserted', _i: i, insertFromLineNumber: oldMinimapLineNumber, insertToLineNumber: oldMinimapLineNumber };
                        events.push(lastEvent);
                    }
                    oldDeltaLineCount++;
                }
            }
            result[i] = selectedViewLineNumber;
            minViewLineNumber = selectedViewLineNumber;
        }
        if (events.length < MAX_EVENT_COUNT) {
            while (oldIndex < oldLength) {
                const oldMinimapLineNumber = oldIndex + 1 + oldDeltaLineCount;
                if (lastEvent && lastEvent.type === 'deleted' && lastEvent._oldIndex === oldIndex - 1) {
                    lastEvent.deleteToLineNumber++;
                }
                else {
                    lastEvent = { type: 'deleted', _oldIndex: oldIndex, deleteFromLineNumber: oldMinimapLineNumber, deleteToLineNumber: oldMinimapLineNumber };
                    events.push(lastEvent);
                }
                oldDeltaLineCount--;
                oldIndex++;
            }
        }
        else {
            // too many events, just give up
            events = [{ type: 'flush' }];
        }
        return [new MinimapSamplingState(ratio, result), events];
    }
    constructor(samplingRatio, minimapLines // a map of 0-based minimap line indexes to 1-based view line numbers
    ) {
        this.samplingRatio = samplingRatio;
        this.minimapLines = minimapLines;
    }
    modelLineToMinimapLine(lineNumber) {
        return Math.min(this.minimapLines.length, Math.max(1, Math.round(lineNumber / this.samplingRatio)));
    }
    /**
     * Will return null if the model line ranges are not intersecting with a sampled model line.
     */
    modelLineRangeToMinimapLineRange(fromLineNumber, toLineNumber) {
        let fromLineIndex = this.modelLineToMinimapLine(fromLineNumber) - 1;
        while (fromLineIndex > 0 && this.minimapLines[fromLineIndex - 1] >= fromLineNumber) {
            fromLineIndex--;
        }
        let toLineIndex = this.modelLineToMinimapLine(toLineNumber) - 1;
        while (toLineIndex + 1 < this.minimapLines.length && this.minimapLines[toLineIndex + 1] <= toLineNumber) {
            toLineIndex++;
        }
        if (fromLineIndex === toLineIndex) {
            const sampledLineNumber = this.minimapLines[fromLineIndex];
            if (sampledLineNumber < fromLineNumber || sampledLineNumber > toLineNumber) {
                // This line is not part of the sampled lines ==> nothing to do
                return null;
            }
        }
        return [fromLineIndex + 1, toLineIndex + 1];
    }
    /**
     * Will always return a range, even if it is not intersecting with a sampled model line.
     */
    decorationLineRangeToMinimapLineRange(startLineNumber, endLineNumber) {
        let minimapLineStart = this.modelLineToMinimapLine(startLineNumber);
        let minimapLineEnd = this.modelLineToMinimapLine(endLineNumber);
        if (startLineNumber !== endLineNumber && minimapLineEnd === minimapLineStart) {
            if (minimapLineEnd === this.minimapLines.length) {
                if (minimapLineStart > 1) {
                    minimapLineStart--;
                }
            }
            else {
                minimapLineEnd++;
            }
        }
        return [minimapLineStart, minimapLineEnd];
    }
    onLinesDeleted(e) {
        // have the mapping be sticky
        const deletedLineCount = e.toLineNumber - e.fromLineNumber + 1;
        let changeStartIndex = this.minimapLines.length;
        let changeEndIndex = 0;
        for (let i = this.minimapLines.length - 1; i >= 0; i--) {
            if (this.minimapLines[i] < e.fromLineNumber) {
                break;
            }
            if (this.minimapLines[i] <= e.toLineNumber) {
                // this line got deleted => move to previous available
                this.minimapLines[i] = Math.max(1, e.fromLineNumber - 1);
                changeStartIndex = Math.min(changeStartIndex, i);
                changeEndIndex = Math.max(changeEndIndex, i);
            }
            else {
                this.minimapLines[i] -= deletedLineCount;
            }
        }
        return [changeStartIndex, changeEndIndex];
    }
    onLinesInserted(e) {
        // have the mapping be sticky
        const insertedLineCount = e.toLineNumber - e.fromLineNumber + 1;
        for (let i = this.minimapLines.length - 1; i >= 0; i--) {
            if (this.minimapLines[i] < e.fromLineNumber) {
                break;
            }
            this.minimapLines[i] += insertedLineCount;
        }
    }
}
/**
 * The minimap appears beside the editor scroll bar and visualizes a zoomed out
 * view of the file.
 */
export class Minimap extends ViewPart {
    constructor(context) {
        super(context);
        this._sectionHeaderCache = new LRUCache(10, 1.5);
        this.tokensColorTracker = MinimapTokensColorTracker.getInstance();
        this._selections = [];
        this._minimapSelections = null;
        this.options = new MinimapOptions(this._context.configuration, this._context.theme, this.tokensColorTracker);
        const [samplingState,] = MinimapSamplingState.compute(this.options, this._context.viewModel.getLineCount(), null);
        this._samplingState = samplingState;
        this._shouldCheckSampling = false;
        this._actual = new InnerMinimap(context.theme, this);
    }
    dispose() {
        this._actual.dispose();
        super.dispose();
    }
    getDomNode() {
        return this._actual.getDomNode();
    }
    _onOptionsMaybeChanged() {
        const opts = new MinimapOptions(this._context.configuration, this._context.theme, this.tokensColorTracker);
        if (this.options.equals(opts)) {
            return false;
        }
        this.options = opts;
        this._recreateLineSampling();
        this._actual.onDidChangeOptions();
        return true;
    }
    // ---- begin view event handlers
    onConfigurationChanged(e) {
        return this._onOptionsMaybeChanged();
    }
    onCursorStateChanged(e) {
        this._selections = e.selections;
        this._minimapSelections = null;
        return this._actual.onSelectionChanged();
    }
    onDecorationsChanged(e) {
        if (e.affectsMinimap) {
            return this._actual.onDecorationsChanged();
        }
        return false;
    }
    onFlushed(e) {
        if (this._samplingState) {
            this._shouldCheckSampling = true;
        }
        return this._actual.onFlushed();
    }
    onLinesChanged(e) {
        if (this._samplingState) {
            const minimapLineRange = this._samplingState.modelLineRangeToMinimapLineRange(e.fromLineNumber, e.fromLineNumber + e.count - 1);
            if (minimapLineRange) {
                return this._actual.onLinesChanged(minimapLineRange[0], minimapLineRange[1] - minimapLineRange[0] + 1);
            }
            else {
                return false;
            }
        }
        else {
            return this._actual.onLinesChanged(e.fromLineNumber, e.count);
        }
    }
    onLinesDeleted(e) {
        if (this._samplingState) {
            const [changeStartIndex, changeEndIndex] = this._samplingState.onLinesDeleted(e);
            if (changeStartIndex <= changeEndIndex) {
                this._actual.onLinesChanged(changeStartIndex + 1, changeEndIndex - changeStartIndex + 1);
            }
            this._shouldCheckSampling = true;
            return true;
        }
        else {
            return this._actual.onLinesDeleted(e.fromLineNumber, e.toLineNumber);
        }
    }
    onLinesInserted(e) {
        if (this._samplingState) {
            this._samplingState.onLinesInserted(e);
            this._shouldCheckSampling = true;
            return true;
        }
        else {
            return this._actual.onLinesInserted(e.fromLineNumber, e.toLineNumber);
        }
    }
    onScrollChanged(e) {
        return this._actual.onScrollChanged(e);
    }
    onThemeChanged(e) {
        this._actual.onThemeChanged();
        this._onOptionsMaybeChanged();
        return true;
    }
    onTokensChanged(e) {
        if (this._samplingState) {
            const ranges = [];
            for (const range of e.ranges) {
                const minimapLineRange = this._samplingState.modelLineRangeToMinimapLineRange(range.fromLineNumber, range.toLineNumber);
                if (minimapLineRange) {
                    ranges.push({ fromLineNumber: minimapLineRange[0], toLineNumber: minimapLineRange[1] });
                }
            }
            if (ranges.length) {
                return this._actual.onTokensChanged(ranges);
            }
            else {
                return false;
            }
        }
        else {
            return this._actual.onTokensChanged(e.ranges);
        }
    }
    onTokensColorsChanged(e) {
        this._onOptionsMaybeChanged();
        return this._actual.onTokensColorsChanged();
    }
    onZonesChanged(e) {
        return this._actual.onZonesChanged();
    }
    // --- end event handlers
    prepareRender(ctx) {
        if (this._shouldCheckSampling) {
            this._shouldCheckSampling = false;
            this._recreateLineSampling();
        }
    }
    render(ctx) {
        let viewportStartLineNumber = ctx.visibleRange.startLineNumber;
        let viewportEndLineNumber = ctx.visibleRange.endLineNumber;
        if (this._samplingState) {
            viewportStartLineNumber = this._samplingState.modelLineToMinimapLine(viewportStartLineNumber);
            viewportEndLineNumber = this._samplingState.modelLineToMinimapLine(viewportEndLineNumber);
        }
        const minimapCtx = {
            viewportContainsWhitespaceGaps: (ctx.viewportData.whitespaceViewportData.length > 0),
            scrollWidth: ctx.scrollWidth,
            scrollHeight: ctx.scrollHeight,
            viewportStartLineNumber: viewportStartLineNumber,
            viewportEndLineNumber: viewportEndLineNumber,
            viewportStartLineNumberVerticalOffset: ctx.getVerticalOffsetForLineNumber(viewportStartLineNumber),
            scrollTop: ctx.scrollTop,
            scrollLeft: ctx.scrollLeft,
            viewportWidth: ctx.viewportWidth,
            viewportHeight: ctx.viewportHeight,
        };
        this._actual.render(minimapCtx);
    }
    //#region IMinimapModel
    _recreateLineSampling() {
        this._minimapSelections = null;
        const wasSampling = Boolean(this._samplingState);
        const [samplingState, events] = MinimapSamplingState.compute(this.options, this._context.viewModel.getLineCount(), this._samplingState);
        this._samplingState = samplingState;
        if (wasSampling && this._samplingState) {
            // was sampling, is sampling
            for (const event of events) {
                switch (event.type) {
                    case 'deleted':
                        this._actual.onLinesDeleted(event.deleteFromLineNumber, event.deleteToLineNumber);
                        break;
                    case 'inserted':
                        this._actual.onLinesInserted(event.insertFromLineNumber, event.insertToLineNumber);
                        break;
                    case 'flush':
                        this._actual.onFlushed();
                        break;
                }
            }
        }
    }
    getLineCount() {
        if (this._samplingState) {
            return this._samplingState.minimapLines.length;
        }
        return this._context.viewModel.getLineCount();
    }
    getRealLineCount() {
        return this._context.viewModel.getLineCount();
    }
    getLineContent(lineNumber) {
        if (this._samplingState) {
            return this._context.viewModel.getLineContent(this._samplingState.minimapLines[lineNumber - 1]);
        }
        return this._context.viewModel.getLineContent(lineNumber);
    }
    getLineMaxColumn(lineNumber) {
        if (this._samplingState) {
            return this._context.viewModel.getLineMaxColumn(this._samplingState.minimapLines[lineNumber - 1]);
        }
        return this._context.viewModel.getLineMaxColumn(lineNumber);
    }
    getMinimapLinesRenderingData(startLineNumber, endLineNumber, needed) {
        if (this._samplingState) {
            const result = [];
            for (let lineIndex = 0, lineCount = endLineNumber - startLineNumber + 1; lineIndex < lineCount; lineIndex++) {
                if (needed[lineIndex]) {
                    result[lineIndex] = this._context.viewModel.getViewLineData(this._samplingState.minimapLines[startLineNumber + lineIndex - 1]);
                }
                else {
                    result[lineIndex] = null;
                }
            }
            return result;
        }
        return this._context.viewModel.getMinimapLinesRenderingData(startLineNumber, endLineNumber, needed).data;
    }
    getSelections() {
        if (this._minimapSelections === null) {
            if (this._samplingState) {
                this._minimapSelections = [];
                for (const selection of this._selections) {
                    const [minimapLineStart, minimapLineEnd] = this._samplingState.decorationLineRangeToMinimapLineRange(selection.startLineNumber, selection.endLineNumber);
                    this._minimapSelections.push(new Selection(minimapLineStart, selection.startColumn, minimapLineEnd, selection.endColumn));
                }
            }
            else {
                this._minimapSelections = this._selections;
            }
        }
        return this._minimapSelections;
    }
    getMinimapDecorationsInViewport(startLineNumber, endLineNumber) {
        return this._getMinimapDecorationsInViewport(startLineNumber, endLineNumber)
            .filter(decoration => !decoration.options.minimap?.sectionHeaderStyle);
    }
    getSectionHeaderDecorationsInViewport(startLineNumber, endLineNumber) {
        const headerHeightInMinimapLines = this.options.sectionHeaderFontSize / this.options.minimapLineHeight;
        startLineNumber = Math.floor(Math.max(1, startLineNumber - headerHeightInMinimapLines));
        return this._getMinimapDecorationsInViewport(startLineNumber, endLineNumber)
            .filter(decoration => !!decoration.options.minimap?.sectionHeaderStyle);
    }
    _getMinimapDecorationsInViewport(startLineNumber, endLineNumber) {
        let visibleRange;
        if (this._samplingState) {
            const modelStartLineNumber = this._samplingState.minimapLines[startLineNumber - 1];
            const modelEndLineNumber = this._samplingState.minimapLines[endLineNumber - 1];
            visibleRange = new Range(modelStartLineNumber, 1, modelEndLineNumber, this._context.viewModel.getLineMaxColumn(modelEndLineNumber));
        }
        else {
            visibleRange = new Range(startLineNumber, 1, endLineNumber, this._context.viewModel.getLineMaxColumn(endLineNumber));
        }
        const decorations = this._context.viewModel.getMinimapDecorationsInRange(visibleRange);
        if (this._samplingState) {
            const result = [];
            for (const decoration of decorations) {
                if (!decoration.options.minimap) {
                    continue;
                }
                const range = decoration.range;
                const minimapStartLineNumber = this._samplingState.modelLineToMinimapLine(range.startLineNumber);
                const minimapEndLineNumber = this._samplingState.modelLineToMinimapLine(range.endLineNumber);
                result.push(new ViewModelDecoration(new Range(minimapStartLineNumber, range.startColumn, minimapEndLineNumber, range.endColumn), decoration.options));
            }
            return result;
        }
        return decorations;
    }
    getSectionHeaderText(decoration, fitWidth) {
        const headerText = decoration.options.minimap?.sectionHeaderText;
        if (!headerText) {
            return null;
        }
        const cachedText = this._sectionHeaderCache.get(headerText);
        if (cachedText) {
            return cachedText;
        }
        const fittedText = fitWidth(headerText);
        this._sectionHeaderCache.set(headerText, fittedText);
        return fittedText;
    }
    getOptions() {
        return this._context.viewModel.model.getOptions();
    }
    revealLineNumber(lineNumber) {
        if (this._samplingState) {
            lineNumber = this._samplingState.minimapLines[lineNumber - 1];
        }
        this._context.viewModel.revealRange('mouse', false, new Range(lineNumber, 1, lineNumber, 1), 1 /* viewEvents.VerticalRevealType.Center */, 0 /* ScrollType.Smooth */);
    }
    setScrollTop(scrollTop) {
        this._context.viewModel.viewLayout.setScrollPosition({
            scrollTop: scrollTop
        }, 1 /* ScrollType.Immediate */);
    }
}
class InnerMinimap extends Disposable {
    constructor(theme, model) {
        super();
        this._renderDecorations = false;
        this._gestureInProgress = false;
        this._isMouseOverMinimap = false;
        this._theme = theme;
        this._model = model;
        this._lastRenderData = null;
        this._buffers = null;
        this._selectionColor = this._theme.getColor(minimapSelection);
        this._domNode = createFastDomNode(document.createElement('div'));
        PartFingerprints.write(this._domNode, 9 /* PartFingerprint.Minimap */);
        this._domNode.setClassName(this._getMinimapDomNodeClassName());
        this._domNode.setPosition('absolute');
        this._domNode.setAttribute('role', 'presentation');
        this._domNode.setAttribute('aria-hidden', 'true');
        this._shadow = createFastDomNode(document.createElement('div'));
        this._shadow.setClassName('minimap-shadow-hidden');
        this._domNode.appendChild(this._shadow);
        this._canvas = createFastDomNode(document.createElement('canvas'));
        this._canvas.setPosition('absolute');
        this._canvas.setLeft(0);
        this._domNode.appendChild(this._canvas);
        this._decorationsCanvas = createFastDomNode(document.createElement('canvas'));
        this._decorationsCanvas.setPosition('absolute');
        this._decorationsCanvas.setClassName('minimap-decorations-layer');
        this._decorationsCanvas.setLeft(0);
        this._domNode.appendChild(this._decorationsCanvas);
        this._slider = createFastDomNode(document.createElement('div'));
        this._slider.setPosition('absolute');
        this._slider.setClassName('minimap-slider');
        this._slider.setLayerHinting(true);
        this._slider.setContain('strict');
        this._domNode.appendChild(this._slider);
        this._sliderHorizontal = createFastDomNode(document.createElement('div'));
        this._sliderHorizontal.setPosition('absolute');
        this._sliderHorizontal.setClassName('minimap-slider-horizontal');
        this._slider.appendChild(this._sliderHorizontal);
        this._applyLayout();
        this._hideDelayedScheduler = this._register(new RunOnceScheduler(() => this._hideImmediatelyIfMouseIsOutside(), 500));
        this._register(dom.addStandardDisposableListener(this._domNode.domNode, dom.EventType.MOUSE_OVER, () => {
            this._isMouseOverMinimap = true;
        }));
        this._register(dom.addStandardDisposableListener(this._domNode.domNode, dom.EventType.MOUSE_LEAVE, () => {
            this._isMouseOverMinimap = false;
        }));
        this._pointerDownListener = dom.addStandardDisposableListener(this._domNode.domNode, dom.EventType.POINTER_DOWN, (e) => {
            e.preventDefault();
            const isMouse = (e.pointerType === 'mouse');
            const isLeftClick = (e.button === 0);
            const renderMinimap = this._model.options.renderMinimap;
            if (renderMinimap === 0 /* RenderMinimap.None */) {
                return;
            }
            if (!this._lastRenderData) {
                return;
            }
            if (this._model.options.size !== 'proportional') {
                if (isLeftClick && this._lastRenderData) {
                    // pretend the click occurred in the center of the slider
                    const position = dom.getDomNodePagePosition(this._slider.domNode);
                    const initialPosY = position.top + position.height / 2;
                    this._startSliderDragging(e, initialPosY, this._lastRenderData.renderedLayout);
                }
                return;
            }
            if (isLeftClick || !isMouse) {
                const minimapLineHeight = this._model.options.minimapLineHeight;
                const internalOffsetY = (this._model.options.canvasInnerHeight / this._model.options.canvasOuterHeight) * e.offsetY;
                const lineIndex = Math.floor(internalOffsetY / minimapLineHeight);
                let lineNumber = lineIndex + this._lastRenderData.renderedLayout.startLineNumber - this._lastRenderData.renderedLayout.topPaddingLineCount;
                lineNumber = Math.min(lineNumber, this._model.getLineCount());
                this._model.revealLineNumber(lineNumber);
            }
        });
        this._sliderPointerMoveMonitor = new GlobalPointerMoveMonitor();
        this._sliderPointerDownListener = dom.addStandardDisposableListener(this._slider.domNode, dom.EventType.POINTER_DOWN, (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.button === 0 && this._lastRenderData) {
                this._startSliderDragging(e, e.pageY, this._lastRenderData.renderedLayout);
            }
        });
        this._gestureDisposable = Gesture.addTarget(this._domNode.domNode);
        this._sliderTouchStartListener = dom.addDisposableListener(this._domNode.domNode, EventType.Start, (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this._lastRenderData) {
                this._slider.toggleClassName('active', true);
                this._gestureInProgress = true;
                this.scrollDueToTouchEvent(e);
            }
        }, { passive: false });
        this._sliderTouchMoveListener = dom.addDisposableListener(this._domNode.domNode, EventType.Change, (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this._lastRenderData && this._gestureInProgress) {
                this.scrollDueToTouchEvent(e);
            }
        }, { passive: false });
        this._sliderTouchEndListener = dom.addStandardDisposableListener(this._domNode.domNode, EventType.End, (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._gestureInProgress = false;
            this._slider.toggleClassName('active', false);
        });
    }
    _hideSoon() {
        this._hideDelayedScheduler.cancel();
        this._hideDelayedScheduler.schedule();
    }
    _hideImmediatelyIfMouseIsOutside() {
        if (this._isMouseOverMinimap) {
            this._hideSoon();
            return;
        }
        this._domNode.toggleClassName('active', false);
    }
    _startSliderDragging(e, initialPosY, initialSliderState) {
        if (!e.target || !(e.target instanceof Element)) {
            return;
        }
        const initialPosX = e.pageX;
        this._slider.toggleClassName('active', true);
        const handlePointerMove = (posy, posx) => {
            const minimapPosition = dom.getDomNodePagePosition(this._domNode.domNode);
            const pointerOrthogonalDelta = Math.min(Math.abs(posx - initialPosX), Math.abs(posx - minimapPosition.left), Math.abs(posx - minimapPosition.left - minimapPosition.width));
            if (platform.isWindows && pointerOrthogonalDelta > POINTER_DRAG_RESET_DISTANCE) {
                // The pointer has wondered away from the scrollbar => reset dragging
                this._model.setScrollTop(initialSliderState.scrollTop);
                return;
            }
            const pointerDelta = posy - initialPosY;
            this._model.setScrollTop(initialSliderState.getDesiredScrollTopFromDelta(pointerDelta));
        };
        if (e.pageY !== initialPosY) {
            handlePointerMove(e.pageY, initialPosX);
        }
        this._sliderPointerMoveMonitor.startMonitoring(e.target, e.pointerId, e.buttons, pointerMoveData => handlePointerMove(pointerMoveData.pageY, pointerMoveData.pageX), () => {
            this._slider.toggleClassName('active', false);
        });
    }
    scrollDueToTouchEvent(touch) {
        const startY = this._domNode.domNode.getBoundingClientRect().top;
        const scrollTop = this._lastRenderData.renderedLayout.getDesiredScrollTopFromTouchLocation(touch.pageY - startY);
        this._model.setScrollTop(scrollTop);
    }
    dispose() {
        this._pointerDownListener.dispose();
        this._sliderPointerMoveMonitor.dispose();
        this._sliderPointerDownListener.dispose();
        this._gestureDisposable.dispose();
        this._sliderTouchStartListener.dispose();
        this._sliderTouchMoveListener.dispose();
        this._sliderTouchEndListener.dispose();
        super.dispose();
    }
    _getMinimapDomNodeClassName() {
        const class_ = ['minimap'];
        if (this._model.options.showSlider === 'always') {
            class_.push('slider-always');
        }
        else {
            class_.push('slider-mouseover');
        }
        if (this._model.options.autohide === 'mouseover') {
            class_.push('minimap-autohide-mouseover');
        }
        else if (this._model.options.autohide === 'scroll') {
            class_.push('minimap-autohide-scroll');
        }
        return class_.join(' ');
    }
    getDomNode() {
        return this._domNode;
    }
    _applyLayout() {
        this._domNode.setLeft(this._model.options.minimapLeft);
        this._domNode.setWidth(this._model.options.minimapWidth);
        this._domNode.setHeight(this._model.options.minimapHeight);
        this._shadow.setHeight(this._model.options.minimapHeight);
        this._canvas.setWidth(this._model.options.canvasOuterWidth);
        this._canvas.setHeight(this._model.options.canvasOuterHeight);
        this._canvas.domNode.width = this._model.options.canvasInnerWidth;
        this._canvas.domNode.height = this._model.options.canvasInnerHeight;
        this._decorationsCanvas.setWidth(this._model.options.canvasOuterWidth);
        this._decorationsCanvas.setHeight(this._model.options.canvasOuterHeight);
        this._decorationsCanvas.domNode.width = this._model.options.canvasInnerWidth;
        this._decorationsCanvas.domNode.height = this._model.options.canvasInnerHeight;
        this._slider.setWidth(this._model.options.minimapWidth);
    }
    _getBuffer() {
        if (!this._buffers) {
            if (this._model.options.canvasInnerWidth > 0 && this._model.options.canvasInnerHeight > 0) {
                this._buffers = new MinimapBuffers(this._canvas.domNode.getContext('2d'), this._model.options.canvasInnerWidth, this._model.options.canvasInnerHeight, this._model.options.backgroundColor);
            }
        }
        return this._buffers ? this._buffers.getBuffer() : null;
    }
    // ---- begin view event handlers
    onDidChangeOptions() {
        this._lastRenderData = null;
        this._buffers = null;
        this._applyLayout();
        this._domNode.setClassName(this._getMinimapDomNodeClassName());
    }
    onSelectionChanged() {
        this._renderDecorations = true;
        return true;
    }
    onDecorationsChanged() {
        this._renderDecorations = true;
        return true;
    }
    onFlushed() {
        this._lastRenderData = null;
        return true;
    }
    onLinesChanged(changeFromLineNumber, changeCount) {
        if (this._lastRenderData) {
            return this._lastRenderData.onLinesChanged(changeFromLineNumber, changeCount);
        }
        return false;
    }
    onLinesDeleted(deleteFromLineNumber, deleteToLineNumber) {
        this._lastRenderData?.onLinesDeleted(deleteFromLineNumber, deleteToLineNumber);
        return true;
    }
    onLinesInserted(insertFromLineNumber, insertToLineNumber) {
        this._lastRenderData?.onLinesInserted(insertFromLineNumber, insertToLineNumber);
        return true;
    }
    onScrollChanged(e) {
        if (this._model.options.autohide === 'scroll' && (e.scrollTopChanged || e.scrollHeightChanged)) {
            this._domNode.toggleClassName('active', true);
            this._hideSoon();
        }
        this._renderDecorations = true;
        return true;
    }
    onThemeChanged() {
        this._selectionColor = this._theme.getColor(minimapSelection);
        this._renderDecorations = true;
        return true;
    }
    onTokensChanged(ranges) {
        if (this._lastRenderData) {
            return this._lastRenderData.onTokensChanged(ranges);
        }
        return false;
    }
    onTokensColorsChanged() {
        this._lastRenderData = null;
        this._buffers = null;
        return true;
    }
    onZonesChanged() {
        this._lastRenderData = null;
        return true;
    }
    // --- end event handlers
    render(renderingCtx) {
        const renderMinimap = this._model.options.renderMinimap;
        if (renderMinimap === 0 /* RenderMinimap.None */) {
            this._shadow.setClassName('minimap-shadow-hidden');
            this._sliderHorizontal.setWidth(0);
            this._sliderHorizontal.setHeight(0);
            return;
        }
        if (renderingCtx.scrollLeft + renderingCtx.viewportWidth >= renderingCtx.scrollWidth) {
            this._shadow.setClassName('minimap-shadow-hidden');
        }
        else {
            this._shadow.setClassName('minimap-shadow-visible');
        }
        const layout = MinimapLayout.create(this._model.options, renderingCtx.viewportStartLineNumber, renderingCtx.viewportEndLineNumber, renderingCtx.viewportStartLineNumberVerticalOffset, renderingCtx.viewportHeight, renderingCtx.viewportContainsWhitespaceGaps, this._model.getLineCount(), this._model.getRealLineCount(), renderingCtx.scrollTop, renderingCtx.scrollHeight, this._lastRenderData ? this._lastRenderData.renderedLayout : null);
        this._slider.setDisplay(layout.sliderNeeded ? 'block' : 'none');
        this._slider.setTop(layout.sliderTop);
        this._slider.setHeight(layout.sliderHeight);
        // Compute horizontal slider coordinates
        this._sliderHorizontal.setLeft(0);
        this._sliderHorizontal.setWidth(this._model.options.minimapWidth);
        this._sliderHorizontal.setTop(0);
        this._sliderHorizontal.setHeight(layout.sliderHeight);
        this.renderDecorations(layout);
        this._lastRenderData = this.renderLines(layout);
    }
    renderDecorations(layout) {
        if (this._renderDecorations) {
            this._renderDecorations = false;
            const selections = this._model.getSelections();
            selections.sort(Range.compareRangesUsingStarts);
            const decorations = this._model.getMinimapDecorationsInViewport(layout.startLineNumber, layout.endLineNumber);
            decorations.sort((a, b) => (a.options.zIndex || 0) - (b.options.zIndex || 0));
            const { canvasInnerWidth, canvasInnerHeight } = this._model.options;
            const minimapLineHeight = this._model.options.minimapLineHeight;
            const minimapCharWidth = this._model.options.minimapCharWidth;
            const tabSize = this._model.getOptions().tabSize;
            const canvasContext = this._decorationsCanvas.domNode.getContext('2d');
            canvasContext.clearRect(0, 0, canvasInnerWidth, canvasInnerHeight);
            // We first need to render line highlights and then render decorations on top of those.
            // But we need to pick a single color for each line, and use that as a line highlight.
            // This needs to be the color of the decoration with the highest `zIndex`, but priority
            // is given to the selection.
            const highlightedLines = new ContiguousLineMap(layout.startLineNumber, layout.endLineNumber, false);
            this._renderSelectionLineHighlights(canvasContext, selections, highlightedLines, layout, minimapLineHeight);
            this._renderDecorationsLineHighlights(canvasContext, decorations, highlightedLines, layout, minimapLineHeight);
            const lineOffsetMap = new ContiguousLineMap(layout.startLineNumber, layout.endLineNumber, null);
            this._renderSelectionsHighlights(canvasContext, selections, lineOffsetMap, layout, minimapLineHeight, tabSize, minimapCharWidth, canvasInnerWidth);
            this._renderDecorationsHighlights(canvasContext, decorations, lineOffsetMap, layout, minimapLineHeight, tabSize, minimapCharWidth, canvasInnerWidth);
            this._renderSectionHeaders(layout);
        }
    }
    _renderSelectionLineHighlights(canvasContext, selections, highlightedLines, layout, minimapLineHeight) {
        if (!this._selectionColor || this._selectionColor.isTransparent()) {
            return;
        }
        canvasContext.fillStyle = this._selectionColor.transparent(0.5).toString();
        let y1 = 0;
        let y2 = 0;
        for (const selection of selections) {
            const intersection = layout.intersectWithViewport(selection);
            if (!intersection) {
                // entirely outside minimap's viewport
                continue;
            }
            const [startLineNumber, endLineNumber] = intersection;
            for (let line = startLineNumber; line <= endLineNumber; line++) {
                highlightedLines.set(line, true);
            }
            const yy1 = layout.getYForLineNumber(startLineNumber, minimapLineHeight);
            const yy2 = layout.getYForLineNumber(endLineNumber, minimapLineHeight);
            if (y2 >= yy1) {
                // merge into previous
                y2 = yy2;
            }
            else {
                if (y2 > y1) {
                    // flush
                    canvasContext.fillRect(MINIMAP_GUTTER_WIDTH, y1, canvasContext.canvas.width, y2 - y1);
                }
                y1 = yy1;
                y2 = yy2;
            }
        }
        if (y2 > y1) {
            // flush
            canvasContext.fillRect(MINIMAP_GUTTER_WIDTH, y1, canvasContext.canvas.width, y2 - y1);
        }
    }
    _renderDecorationsLineHighlights(canvasContext, decorations, highlightedLines, layout, minimapLineHeight) {
        const highlightColors = new Map();
        // Loop backwards to hit first decorations with higher `zIndex`
        for (let i = decorations.length - 1; i >= 0; i--) {
            const decoration = decorations[i];
            const minimapOptions = decoration.options.minimap;
            if (!minimapOptions || minimapOptions.position !== 1 /* MinimapPosition.Inline */) {
                continue;
            }
            const intersection = layout.intersectWithViewport(decoration.range);
            if (!intersection) {
                // entirely outside minimap's viewport
                continue;
            }
            const [startLineNumber, endLineNumber] = intersection;
            const decorationColor = minimapOptions.getColor(this._theme.value);
            if (!decorationColor || decorationColor.isTransparent()) {
                continue;
            }
            let highlightColor = highlightColors.get(decorationColor.toString());
            if (!highlightColor) {
                highlightColor = decorationColor.transparent(0.5).toString();
                highlightColors.set(decorationColor.toString(), highlightColor);
            }
            canvasContext.fillStyle = highlightColor;
            for (let line = startLineNumber; line <= endLineNumber; line++) {
                if (highlightedLines.has(line)) {
                    continue;
                }
                highlightedLines.set(line, true);
                const y = layout.getYForLineNumber(line, minimapLineHeight);
                canvasContext.fillRect(MINIMAP_GUTTER_WIDTH, y, canvasContext.canvas.width, minimapLineHeight);
            }
        }
    }
    _renderSelectionsHighlights(canvasContext, selections, lineOffsetMap, layout, lineHeight, tabSize, characterWidth, canvasInnerWidth) {
        if (!this._selectionColor || this._selectionColor.isTransparent()) {
            return;
        }
        for (const selection of selections) {
            const intersection = layout.intersectWithViewport(selection);
            if (!intersection) {
                // entirely outside minimap's viewport
                continue;
            }
            const [startLineNumber, endLineNumber] = intersection;
            for (let line = startLineNumber; line <= endLineNumber; line++) {
                this.renderDecorationOnLine(canvasContext, lineOffsetMap, selection, this._selectionColor, layout, line, lineHeight, lineHeight, tabSize, characterWidth, canvasInnerWidth);
            }
        }
    }
    _renderDecorationsHighlights(canvasContext, decorations, lineOffsetMap, layout, minimapLineHeight, tabSize, characterWidth, canvasInnerWidth) {
        // Loop forwards to hit first decorations with lower `zIndex`
        for (const decoration of decorations) {
            const minimapOptions = decoration.options.minimap;
            if (!minimapOptions) {
                continue;
            }
            const intersection = layout.intersectWithViewport(decoration.range);
            if (!intersection) {
                // entirely outside minimap's viewport
                continue;
            }
            const [startLineNumber, endLineNumber] = intersection;
            const decorationColor = minimapOptions.getColor(this._theme.value);
            if (!decorationColor || decorationColor.isTransparent()) {
                continue;
            }
            for (let line = startLineNumber; line <= endLineNumber; line++) {
                switch (minimapOptions.position) {
                    case 1 /* MinimapPosition.Inline */:
                        this.renderDecorationOnLine(canvasContext, lineOffsetMap, decoration.range, decorationColor, layout, line, minimapLineHeight, minimapLineHeight, tabSize, characterWidth, canvasInnerWidth);
                        continue;
                    case 2 /* MinimapPosition.Gutter */: {
                        const y = layout.getYForLineNumber(line, minimapLineHeight);
                        const x = 2;
                        this.renderDecoration(canvasContext, decorationColor, x, y, GUTTER_DECORATION_WIDTH, minimapLineHeight);
                        continue;
                    }
                }
            }
        }
    }
    renderDecorationOnLine(canvasContext, lineOffsetMap, decorationRange, decorationColor, layout, lineNumber, height, minimapLineHeight, tabSize, charWidth, canvasInnerWidth) {
        const y = layout.getYForLineNumber(lineNumber, minimapLineHeight);
        // Skip rendering the line if it's vertically outside our viewport
        if (y + height < 0 || y > this._model.options.canvasInnerHeight) {
            return;
        }
        const { startLineNumber, endLineNumber } = decorationRange;
        const startColumn = (startLineNumber === lineNumber ? decorationRange.startColumn : 1);
        const endColumn = (endLineNumber === lineNumber ? decorationRange.endColumn : this._model.getLineMaxColumn(lineNumber));
        const x1 = this.getXOffsetForPosition(lineOffsetMap, lineNumber, startColumn, tabSize, charWidth, canvasInnerWidth);
        const x2 = this.getXOffsetForPosition(lineOffsetMap, lineNumber, endColumn, tabSize, charWidth, canvasInnerWidth);
        this.renderDecoration(canvasContext, decorationColor, x1, y, x2 - x1, height);
    }
    getXOffsetForPosition(lineOffsetMap, lineNumber, column, tabSize, charWidth, canvasInnerWidth) {
        if (column === 1) {
            return MINIMAP_GUTTER_WIDTH;
        }
        const minimumXOffset = (column - 1) * charWidth;
        if (minimumXOffset >= canvasInnerWidth) {
            // there is no need to look at actual characters,
            // as this column is certainly after the minimap width
            return canvasInnerWidth;
        }
        // Cache line offset data so that it is only read once per line
        let lineIndexToXOffset = lineOffsetMap.get(lineNumber);
        if (!lineIndexToXOffset) {
            const lineData = this._model.getLineContent(lineNumber);
            lineIndexToXOffset = [MINIMAP_GUTTER_WIDTH];
            let prevx = MINIMAP_GUTTER_WIDTH;
            for (let i = 1; i < lineData.length + 1; i++) {
                const charCode = lineData.charCodeAt(i - 1);
                const dx = charCode === 9 /* CharCode.Tab */
                    ? tabSize * charWidth
                    : strings.isFullWidthCharacter(charCode)
                        ? 2 * charWidth
                        : charWidth;
                const x = prevx + dx;
                if (x >= canvasInnerWidth) {
                    // no need to keep on going, as we've hit the canvas width
                    lineIndexToXOffset[i] = canvasInnerWidth;
                    break;
                }
                lineIndexToXOffset[i] = x;
                prevx = x;
            }
            lineOffsetMap.set(lineNumber, lineIndexToXOffset);
        }
        if (column - 1 < lineIndexToXOffset.length) {
            return lineIndexToXOffset[column - 1];
        }
        // goes over the canvas width
        return canvasInnerWidth;
    }
    renderDecoration(canvasContext, decorationColor, x, y, width, height) {
        canvasContext.fillStyle = decorationColor && decorationColor.toString() || '';
        canvasContext.fillRect(x, y, width, height);
    }
    _renderSectionHeaders(layout) {
        const minimapLineHeight = this._model.options.minimapLineHeight;
        const sectionHeaderFontSize = this._model.options.sectionHeaderFontSize;
        const sectionHeaderLetterSpacing = this._model.options.sectionHeaderLetterSpacing;
        const backgroundFillHeight = sectionHeaderFontSize * 1.5;
        const { canvasInnerWidth } = this._model.options;
        const backgroundColor = this._model.options.backgroundColor;
        const backgroundFill = `rgb(${backgroundColor.r} ${backgroundColor.g} ${backgroundColor.b} / .7)`;
        const foregroundColor = this._model.options.sectionHeaderFontColor;
        const foregroundFill = `rgb(${foregroundColor.r} ${foregroundColor.g} ${foregroundColor.b})`;
        const separatorStroke = foregroundFill;
        const canvasContext = this._decorationsCanvas.domNode.getContext('2d');
        canvasContext.letterSpacing = sectionHeaderLetterSpacing + 'px';
        canvasContext.font = '500 ' + sectionHeaderFontSize + 'px ' + this._model.options.sectionHeaderFontFamily;
        canvasContext.strokeStyle = separatorStroke;
        canvasContext.lineWidth = 0.4;
        const decorations = this._model.getSectionHeaderDecorationsInViewport(layout.startLineNumber, layout.endLineNumber);
        decorations.sort((a, b) => a.range.startLineNumber - b.range.startLineNumber);
        const fitWidth = InnerMinimap._fitSectionHeader.bind(null, canvasContext, canvasInnerWidth - MINIMAP_GUTTER_WIDTH);
        for (const decoration of decorations) {
            const y = layout.getYForLineNumber(decoration.range.startLineNumber, minimapLineHeight) + sectionHeaderFontSize;
            const backgroundFillY = y - sectionHeaderFontSize;
            const separatorY = backgroundFillY + 2;
            const headerText = this._model.getSectionHeaderText(decoration, fitWidth);
            InnerMinimap._renderSectionLabel(canvasContext, headerText, decoration.options.minimap?.sectionHeaderStyle === 2 /* MinimapSectionHeaderStyle.Underlined */, backgroundFill, foregroundFill, canvasInnerWidth, backgroundFillY, backgroundFillHeight, y, separatorY);
        }
    }
    static _fitSectionHeader(target, maxWidth, headerText) {
        if (!headerText) {
            return headerText;
        }
        const ellipsis = '…';
        const width = target.measureText(headerText).width;
        const ellipsisWidth = target.measureText(ellipsis).width;
        if (width <= maxWidth || width <= ellipsisWidth) {
            return headerText;
        }
        const len = headerText.length;
        const averageCharWidth = width / headerText.length;
        const maxCharCount = Math.floor((maxWidth - ellipsisWidth) / averageCharWidth) - 1;
        // Find a halfway point that isn't after whitespace
        let halfCharCount = Math.ceil(maxCharCount / 2);
        while (halfCharCount > 0 && /\s/.test(headerText[halfCharCount - 1])) {
            --halfCharCount;
        }
        // Split with ellipsis
        return headerText.substring(0, halfCharCount)
            + ellipsis + headerText.substring(len - (maxCharCount - halfCharCount));
    }
    static _renderSectionLabel(target, headerText, hasSeparatorLine, backgroundFill, foregroundFill, minimapWidth, backgroundFillY, backgroundFillHeight, textY, separatorY) {
        if (headerText) {
            target.fillStyle = backgroundFill;
            target.fillRect(0, backgroundFillY, minimapWidth, backgroundFillHeight);
            target.fillStyle = foregroundFill;
            target.fillText(headerText, MINIMAP_GUTTER_WIDTH, textY);
        }
        if (hasSeparatorLine) {
            target.beginPath();
            target.moveTo(0, separatorY);
            target.lineTo(minimapWidth, separatorY);
            target.closePath();
            target.stroke();
        }
    }
    renderLines(layout) {
        const startLineNumber = layout.startLineNumber;
        const endLineNumber = layout.endLineNumber;
        const minimapLineHeight = this._model.options.minimapLineHeight;
        // Check if nothing changed w.r.t. lines from last frame
        if (this._lastRenderData && this._lastRenderData.linesEquals(layout)) {
            const _lastData = this._lastRenderData._get();
            // Nice!! Nothing changed from last frame
            return new RenderData(layout, _lastData.imageData, _lastData.lines);
        }
        // Oh well!! We need to repaint some lines...
        const imageData = this._getBuffer();
        if (!imageData) {
            // 0 width or 0 height canvas, nothing to do
            return null;
        }
        // Render untouched lines by using last rendered data.
        const [_dirtyY1, _dirtyY2, needed] = InnerMinimap._renderUntouchedLines(imageData, layout.topPaddingLineCount, startLineNumber, endLineNumber, minimapLineHeight, this._lastRenderData);
        // Fetch rendering info from view model for rest of lines that need rendering.
        const lineInfo = this._model.getMinimapLinesRenderingData(startLineNumber, endLineNumber, needed);
        const tabSize = this._model.getOptions().tabSize;
        const defaultBackground = this._model.options.defaultBackgroundColor;
        const background = this._model.options.backgroundColor;
        const foregroundAlpha = this._model.options.foregroundAlpha;
        const tokensColorTracker = this._model.tokensColorTracker;
        const useLighterFont = tokensColorTracker.backgroundIsLight();
        const renderMinimap = this._model.options.renderMinimap;
        const charRenderer = this._model.options.charRenderer();
        const fontScale = this._model.options.fontScale;
        const minimapCharWidth = this._model.options.minimapCharWidth;
        const baseCharHeight = (renderMinimap === 1 /* RenderMinimap.Text */ ? 2 /* Constants.BASE_CHAR_HEIGHT */ : 2 /* Constants.BASE_CHAR_HEIGHT */ + 1);
        const renderMinimapLineHeight = baseCharHeight * fontScale;
        const innerLinePadding = (minimapLineHeight > renderMinimapLineHeight ? Math.floor((minimapLineHeight - renderMinimapLineHeight) / 2) : 0);
        // Render the rest of lines
        const backgroundA = background.a / 255;
        const renderBackground = new RGBA8(Math.round((background.r - defaultBackground.r) * backgroundA + defaultBackground.r), Math.round((background.g - defaultBackground.g) * backgroundA + defaultBackground.g), Math.round((background.b - defaultBackground.b) * backgroundA + defaultBackground.b), 255);
        let dy = layout.topPaddingLineCount * minimapLineHeight;
        const renderedLines = [];
        for (let lineIndex = 0, lineCount = endLineNumber - startLineNumber + 1; lineIndex < lineCount; lineIndex++) {
            if (needed[lineIndex]) {
                InnerMinimap._renderLine(imageData, renderBackground, background.a, useLighterFont, renderMinimap, minimapCharWidth, tokensColorTracker, foregroundAlpha, charRenderer, dy, innerLinePadding, tabSize, lineInfo[lineIndex], fontScale, minimapLineHeight);
            }
            renderedLines[lineIndex] = new MinimapLine(dy);
            dy += minimapLineHeight;
        }
        const dirtyY1 = (_dirtyY1 === -1 ? 0 : _dirtyY1);
        const dirtyY2 = (_dirtyY2 === -1 ? imageData.height : _dirtyY2);
        const dirtyHeight = dirtyY2 - dirtyY1;
        // Finally, paint to the canvas
        const ctx = this._canvas.domNode.getContext('2d');
        ctx.putImageData(imageData, 0, 0, 0, dirtyY1, imageData.width, dirtyHeight);
        // Save rendered data for reuse on next frame if possible
        return new RenderData(layout, imageData, renderedLines);
    }
    static _renderUntouchedLines(target, topPaddingLineCount, startLineNumber, endLineNumber, minimapLineHeight, lastRenderData) {
        const needed = [];
        if (!lastRenderData) {
            for (let i = 0, len = endLineNumber - startLineNumber + 1; i < len; i++) {
                needed[i] = true;
            }
            return [-1, -1, needed];
        }
        const _lastData = lastRenderData._get();
        const lastTargetData = _lastData.imageData.data;
        const lastStartLineNumber = _lastData.rendLineNumberStart;
        const lastLines = _lastData.lines;
        const lastLinesLength = lastLines.length;
        const WIDTH = target.width;
        const targetData = target.data;
        const maxDestPixel = (endLineNumber - startLineNumber + 1) * minimapLineHeight * WIDTH * 4;
        let dirtyPixel1 = -1; // the pixel offset up to which all the data is equal to the prev frame
        let dirtyPixel2 = -1; // the pixel offset after which all the data is equal to the prev frame
        let copySourceStart = -1;
        let copySourceEnd = -1;
        let copyDestStart = -1;
        let copyDestEnd = -1;
        let dest_dy = topPaddingLineCount * minimapLineHeight;
        for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
            const lineIndex = lineNumber - startLineNumber;
            const lastLineIndex = lineNumber - lastStartLineNumber;
            const source_dy = (lastLineIndex >= 0 && lastLineIndex < lastLinesLength ? lastLines[lastLineIndex].dy : -1);
            if (source_dy === -1) {
                needed[lineIndex] = true;
                dest_dy += minimapLineHeight;
                continue;
            }
            const sourceStart = source_dy * WIDTH * 4;
            const sourceEnd = (source_dy + minimapLineHeight) * WIDTH * 4;
            const destStart = dest_dy * WIDTH * 4;
            const destEnd = (dest_dy + minimapLineHeight) * WIDTH * 4;
            if (copySourceEnd === sourceStart && copyDestEnd === destStart) {
                // contiguous zone => extend copy request
                copySourceEnd = sourceEnd;
                copyDestEnd = destEnd;
            }
            else {
                if (copySourceStart !== -1) {
                    // flush existing copy request
                    targetData.set(lastTargetData.subarray(copySourceStart, copySourceEnd), copyDestStart);
                    if (dirtyPixel1 === -1 && copySourceStart === 0 && copySourceStart === copyDestStart) {
                        dirtyPixel1 = copySourceEnd;
                    }
                    if (dirtyPixel2 === -1 && copySourceEnd === maxDestPixel && copySourceStart === copyDestStart) {
                        dirtyPixel2 = copySourceStart;
                    }
                }
                copySourceStart = sourceStart;
                copySourceEnd = sourceEnd;
                copyDestStart = destStart;
                copyDestEnd = destEnd;
            }
            needed[lineIndex] = false;
            dest_dy += minimapLineHeight;
        }
        if (copySourceStart !== -1) {
            // flush existing copy request
            targetData.set(lastTargetData.subarray(copySourceStart, copySourceEnd), copyDestStart);
            if (dirtyPixel1 === -1 && copySourceStart === 0 && copySourceStart === copyDestStart) {
                dirtyPixel1 = copySourceEnd;
            }
            if (dirtyPixel2 === -1 && copySourceEnd === maxDestPixel && copySourceStart === copyDestStart) {
                dirtyPixel2 = copySourceStart;
            }
        }
        const dirtyY1 = (dirtyPixel1 === -1 ? -1 : dirtyPixel1 / (WIDTH * 4));
        const dirtyY2 = (dirtyPixel2 === -1 ? -1 : dirtyPixel2 / (WIDTH * 4));
        return [dirtyY1, dirtyY2, needed];
    }
    static _renderLine(target, backgroundColor, backgroundAlpha, useLighterFont, renderMinimap, charWidth, colorTracker, foregroundAlpha, minimapCharRenderer, dy, innerLinePadding, tabSize, lineData, fontScale, minimapLineHeight) {
        const content = lineData.content;
        const tokens = lineData.tokens;
        const maxDx = target.width - charWidth;
        const force1pxHeight = (minimapLineHeight === 1);
        let dx = MINIMAP_GUTTER_WIDTH;
        let charIndex = 0;
        let tabsCharDelta = 0;
        for (let tokenIndex = 0, tokensLen = tokens.getCount(); tokenIndex < tokensLen; tokenIndex++) {
            const tokenEndIndex = tokens.getEndOffset(tokenIndex);
            const tokenColorId = tokens.getForeground(tokenIndex);
            const tokenColor = colorTracker.getColor(tokenColorId);
            for (; charIndex < tokenEndIndex; charIndex++) {
                if (dx > maxDx) {
                    // hit edge of minimap
                    return;
                }
                const charCode = content.charCodeAt(charIndex);
                if (charCode === 9 /* CharCode.Tab */) {
                    const insertSpacesCount = tabSize - (charIndex + tabsCharDelta) % tabSize;
                    tabsCharDelta += insertSpacesCount - 1;
                    // No need to render anything since tab is invisible
                    dx += insertSpacesCount * charWidth;
                }
                else if (charCode === 32 /* CharCode.Space */) {
                    // No need to render anything since space is invisible
                    dx += charWidth;
                }
                else {
                    // Render twice for a full width character
                    const count = strings.isFullWidthCharacter(charCode) ? 2 : 1;
                    for (let i = 0; i < count; i++) {
                        if (renderMinimap === 2 /* RenderMinimap.Blocks */) {
                            minimapCharRenderer.blockRenderChar(target, dx, dy + innerLinePadding, tokenColor, foregroundAlpha, backgroundColor, backgroundAlpha, force1pxHeight);
                        }
                        else { // RenderMinimap.Text
                            minimapCharRenderer.renderChar(target, dx, dy + innerLinePadding, charCode, tokenColor, foregroundAlpha, backgroundColor, backgroundAlpha, fontScale, useLighterFont, force1pxHeight);
                        }
                        dx += charWidth;
                        if (dx > maxDx) {
                            // hit edge of minimap
                            return;
                        }
                    }
                }
            }
        }
    }
}
class ContiguousLineMap {
    constructor(startLineNumber, endLineNumber, defaultValue) {
        this._startLineNumber = startLineNumber;
        this._endLineNumber = endLineNumber;
        this._defaultValue = defaultValue;
        this._values = [];
        for (let i = 0, count = this._endLineNumber - this._startLineNumber + 1; i < count; i++) {
            this._values[i] = defaultValue;
        }
    }
    has(lineNumber) {
        return (this.get(lineNumber) !== this._defaultValue);
    }
    set(lineNumber, value) {
        if (lineNumber < this._startLineNumber || lineNumber > this._endLineNumber) {
            return;
        }
        this._values[lineNumber - this._startLineNumber] = value;
    }
    get(lineNumber) {
        if (lineNumber < this._startLineNumber || lineNumber > this._endLineNumber) {
            return this._defaultValue;
        }
        return this._values[lineNumber - this._startLineNumber];
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWluaW1hcC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci92aWV3UGFydHMvbWluaW1hcC9taW5pbWFwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sZUFBZSxDQUFDO0FBQ3ZCLE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFlLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDekYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFaEcsT0FBTyxFQUFlLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQy9FLE9BQU8sS0FBSyxRQUFRLE1BQU0scUNBQXFDLENBQUM7QUFDaEUsT0FBTyxLQUFLLE9BQU8sTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RCxPQUFPLEVBQVMsdUJBQXVCLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN6RSxPQUFPLEVBQW1CLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3JGLE9BQU8sRUFBK0Isb0JBQW9CLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN0SSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDdEQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBTTFELE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBTW5HLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxpQkFBaUIsRUFBRSx3QkFBd0IsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBRXJKLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUU5RCxPQUFPLEVBQWdCLFNBQVMsRUFBRSxPQUFPLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNyRixPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUU3RSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNqRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDMUQsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDdkYsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFcEU7O0dBRUc7QUFDSCxNQUFNLDJCQUEyQixHQUFHLEdBQUcsQ0FBQztBQUV4QyxNQUFNLHVCQUF1QixHQUFHLENBQUMsQ0FBQztBQUVsQyxNQUFNLGNBQWM7SUErRG5CLFlBQVksYUFBbUMsRUFBRSxLQUFrQixFQUFFLGtCQUE2QztRQUNqSCxNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDO1FBQ3RDLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLG1DQUF5QixDQUFDO1FBQ3hELE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLG1DQUF5QixDQUFDO1FBQ3hELE1BQU0sYUFBYSxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUM7UUFDekMsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLEdBQUcsZ0NBQXVCLENBQUM7UUFDcEQsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLEdBQUcsK0JBQXNCLENBQUM7UUFFdEQsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUMsYUFBYSxDQUFDO1FBQ2pELElBQUksQ0FBQyxJQUFJLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQztRQUM3QixJQUFJLENBQUMsMkJBQTJCLEdBQUcsYUFBYSxDQUFDLDJCQUEyQixDQUFDO1FBQzdFLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxPQUFPLENBQUMsR0FBRyw2Q0FBbUMsQ0FBQztRQUMzRSxJQUFJLENBQUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLCtCQUFzQixDQUFDLEdBQUcsQ0FBQztRQUN4RCxJQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxHQUFHLCtCQUFzQixDQUFDLE1BQU0sQ0FBQztRQUM5RCxJQUFJLENBQUMsVUFBVSxHQUFHLFdBQVcsQ0FBQyxVQUFVLENBQUM7UUFDekMsSUFBSSxDQUFDLFFBQVEsR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDO1FBQ3JDLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO1FBQzdCLElBQUksQ0FBQyw4QkFBOEIsR0FBRyxRQUFRLENBQUMsOEJBQThCLENBQUM7UUFDOUUsSUFBSSxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxrQ0FBeUIsQ0FBQztRQUN2RCxJQUFJLENBQUMsV0FBVyxHQUFHLGFBQWEsQ0FBQyxXQUFXLENBQUM7UUFDN0MsSUFBSSxDQUFDLFlBQVksR0FBRyxhQUFhLENBQUMsWUFBWSxDQUFDO1FBQy9DLElBQUksQ0FBQyxhQUFhLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQztRQUV2QyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsYUFBYSxDQUFDLHVCQUF1QixDQUFDO1FBQzlELElBQUksQ0FBQyxpQkFBaUIsR0FBRyxhQUFhLENBQUMsd0JBQXdCLENBQUM7UUFDaEUsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQztRQUM5RCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsYUFBYSxDQUFDLHdCQUF3QixDQUFDO1FBRWhFLElBQUksQ0FBQyxVQUFVLEdBQUcsYUFBYSxDQUFDLGlCQUFpQixDQUFDO1FBQ2xELElBQUksQ0FBQyxZQUFZLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQztRQUN0QyxJQUFJLENBQUMsU0FBUyxHQUFHLGFBQWEsQ0FBQyxZQUFZLENBQUM7UUFDNUMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQztRQUN6RCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsb0NBQTRCLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDbkUsSUFBSSxDQUFDLHVCQUF1QixHQUFHLG1CQUFtQixDQUFDO1FBQ25ELElBQUksQ0FBQyxxQkFBcUIsR0FBRyxXQUFXLENBQUMscUJBQXFCLEdBQUcsVUFBVSxDQUFDO1FBQzVFLElBQUksQ0FBQywwQkFBMEIsR0FBRyxXQUFXLENBQUMsMEJBQTBCLENBQUMsQ0FBQyw4Q0FBOEM7UUFDeEgsSUFBSSxDQUFDLHNCQUFzQixHQUFHLGNBQWMsQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLEVBQUUsa0JBQWtCLENBQUMsUUFBUSxtQ0FBMkIsQ0FBQyxDQUFDO1FBRW5JLElBQUksQ0FBQyxZQUFZLEdBQUcsd0JBQXdCLENBQUMsR0FBRyxFQUFFLENBQUMsMEJBQTBCLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDM0gsSUFBSSxDQUFDLHNCQUFzQixHQUFHLGtCQUFrQixDQUFDLFFBQVEsbUNBQTJCLENBQUM7UUFDckYsSUFBSSxDQUFDLGVBQWUsR0FBRyxjQUFjLENBQUMscUJBQXFCLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQ2hHLElBQUksQ0FBQyxlQUFlLEdBQUcsY0FBYyxDQUFDLDRCQUE0QixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzNFLENBQUM7SUFFTyxNQUFNLENBQUMscUJBQXFCLENBQUMsS0FBa0IsRUFBRSxzQkFBNkI7UUFDckYsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3JELElBQUksVUFBVSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEgsQ0FBQztRQUNELE9BQU8sc0JBQXNCLENBQUM7SUFDL0IsQ0FBQztJQUVPLE1BQU0sQ0FBQyw0QkFBNEIsQ0FBQyxLQUFrQjtRQUM3RCxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFDNUQsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUNoQixPQUFPLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzFELENBQUM7UUFDRCxPQUFPLEdBQUcsQ0FBQztJQUNaLENBQUM7SUFFTyxNQUFNLENBQUMsc0JBQXNCLENBQUMsS0FBa0IsRUFBRSxzQkFBNkI7UUFDdEYsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3BELElBQUksVUFBVSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEgsQ0FBQztRQUNELE9BQU8sc0JBQXNCLENBQUM7SUFDL0IsQ0FBQztJQUVNLE1BQU0sQ0FBQyxLQUFxQjtRQUNsQyxPQUFPLENBQUMsSUFBSSxDQUFDLGFBQWEsS0FBSyxLQUFLLENBQUMsYUFBYTtlQUM5QyxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxJQUFJO2VBQ3hCLElBQUksQ0FBQywyQkFBMkIsS0FBSyxLQUFLLENBQUMsMkJBQTJCO2VBQ3RFLElBQUksQ0FBQyxvQkFBb0IsS0FBSyxLQUFLLENBQUMsb0JBQW9CO2VBQ3hELElBQUksQ0FBQyxVQUFVLEtBQUssS0FBSyxDQUFDLFVBQVU7ZUFDcEMsSUFBSSxDQUFDLGFBQWEsS0FBSyxLQUFLLENBQUMsYUFBYTtlQUMxQyxJQUFJLENBQUMsVUFBVSxLQUFLLEtBQUssQ0FBQyxVQUFVO2VBQ3BDLElBQUksQ0FBQyxRQUFRLEtBQUssS0FBSyxDQUFDLFFBQVE7ZUFDaEMsSUFBSSxDQUFDLFVBQVUsS0FBSyxLQUFLLENBQUMsVUFBVTtlQUNwQyxJQUFJLENBQUMsOEJBQThCLEtBQUssS0FBSyxDQUFDLDhCQUE4QjtlQUM1RSxJQUFJLENBQUMsVUFBVSxLQUFLLEtBQUssQ0FBQyxVQUFVO2VBQ3BDLElBQUksQ0FBQyxXQUFXLEtBQUssS0FBSyxDQUFDLFdBQVc7ZUFDdEMsSUFBSSxDQUFDLFlBQVksS0FBSyxLQUFLLENBQUMsWUFBWTtlQUN4QyxJQUFJLENBQUMsYUFBYSxLQUFLLEtBQUssQ0FBQyxhQUFhO2VBQzFDLElBQUksQ0FBQyxnQkFBZ0IsS0FBSyxLQUFLLENBQUMsZ0JBQWdCO2VBQ2hELElBQUksQ0FBQyxpQkFBaUIsS0FBSyxLQUFLLENBQUMsaUJBQWlCO2VBQ2xELElBQUksQ0FBQyxnQkFBZ0IsS0FBSyxLQUFLLENBQUMsZ0JBQWdCO2VBQ2hELElBQUksQ0FBQyxpQkFBaUIsS0FBSyxLQUFLLENBQUMsaUJBQWlCO2VBQ2xELElBQUksQ0FBQyxVQUFVLEtBQUssS0FBSyxDQUFDLFVBQVU7ZUFDcEMsSUFBSSxDQUFDLFlBQVksS0FBSyxLQUFLLENBQUMsWUFBWTtlQUN4QyxJQUFJLENBQUMsU0FBUyxLQUFLLEtBQUssQ0FBQyxTQUFTO2VBQ2xDLElBQUksQ0FBQyxpQkFBaUIsS0FBSyxLQUFLLENBQUMsaUJBQWlCO2VBQ2xELElBQUksQ0FBQyxnQkFBZ0IsS0FBSyxLQUFLLENBQUMsZ0JBQWdCO2VBQ2hELElBQUksQ0FBQyxxQkFBcUIsS0FBSyxLQUFLLENBQUMscUJBQXFCO2VBQzFELElBQUksQ0FBQywwQkFBMEIsS0FBSyxLQUFLLENBQUMsMEJBQTBCO2VBQ3BFLElBQUksQ0FBQyxzQkFBc0IsSUFBSSxJQUFJLENBQUMsc0JBQXNCLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQztlQUMvRixJQUFJLENBQUMsZUFBZSxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUM7ZUFDMUUsSUFBSSxDQUFDLGVBQWUsS0FBSyxLQUFLLENBQUMsZUFBZSxDQUNqRCxDQUFDO0lBQ0gsQ0FBQztDQUNEO0FBRUQsTUFBTSxhQUFhO0lBRWxCO0lBQ0M7O09BRUc7SUFDYSxTQUFpQjtJQUNqQzs7T0FFRztJQUNhLFlBQW9CLEVBQ3BCLFlBQXFCLEVBQ3BCLG9CQUE0QjtJQUM3Qzs7T0FFRztJQUNhLFNBQWlCO0lBQ2pDOztPQUVHO0lBQ2EsWUFBb0I7SUFDcEM7O09BRUc7SUFDYSxtQkFBMkI7SUFDM0M7O09BRUc7SUFDYSxlQUF1QjtJQUN2Qzs7T0FFRztJQUNhLGFBQXFCO1FBMUJyQixjQUFTLEdBQVQsU0FBUyxDQUFRO1FBSWpCLGlCQUFZLEdBQVosWUFBWSxDQUFRO1FBQ3BCLGlCQUFZLEdBQVosWUFBWSxDQUFTO1FBQ3BCLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBUTtRQUk3QixjQUFTLEdBQVQsU0FBUyxDQUFRO1FBSWpCLGlCQUFZLEdBQVosWUFBWSxDQUFRO1FBSXBCLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBUTtRQUkzQixvQkFBZSxHQUFmLGVBQWUsQ0FBUTtRQUl2QixrQkFBYSxHQUFiLGFBQWEsQ0FBUTtJQUNsQyxDQUFDO0lBRUw7O09BRUc7SUFDSSw0QkFBNEIsQ0FBQyxLQUFhO1FBQ2hELE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRU0sb0NBQW9DLENBQUMsS0FBYTtRQUN4RCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztJQUNoRixDQUFDO0lBRUQ7O09BRUc7SUFDSSxxQkFBcUIsQ0FBQyxLQUFZO1FBQ3hDLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDOUUsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUN4RSxJQUFJLGVBQWUsR0FBRyxhQUFhLEVBQUUsQ0FBQztZQUNyQyxzQ0FBc0M7WUFDdEMsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBQ0QsT0FBTyxDQUFDLGVBQWUsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUN6QyxDQUFDO0lBRUQ7O09BRUc7SUFDSSxpQkFBaUIsQ0FBQyxVQUFrQixFQUFFLGlCQUF5QjtRQUNyRSxPQUFPLENBQUUsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxpQkFBaUIsQ0FBQztJQUM3RixDQUFDO0lBRU0sTUFBTSxDQUFDLE1BQU0sQ0FDbkIsT0FBdUIsRUFDdkIsdUJBQStCLEVBQy9CLHFCQUE2QixFQUM3QixxQ0FBNkMsRUFDN0MsY0FBc0IsRUFDdEIsOEJBQXVDLEVBQ3ZDLFNBQWlCLEVBQ2pCLGFBQXFCLEVBQ3JCLFNBQWlCLEVBQ2pCLFlBQW9CLEVBQ3BCLGNBQW9DO1FBRXBDLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUM7UUFDdEMsTUFBTSxpQkFBaUIsR0FBRyxPQUFPLENBQUMsaUJBQWlCLENBQUM7UUFDcEQsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsR0FBRyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3RGLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUM7UUFFdEMsSUFBSSxPQUFPLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztZQUN6QyxJQUFJLG1CQUFtQixHQUFHLENBQ3pCLGFBQWEsR0FBRyxPQUFPLENBQUMsVUFBVTtrQkFDaEMsT0FBTyxDQUFDLFVBQVU7a0JBQ2xCLE9BQU8sQ0FBQyxhQUFhLENBQ3ZCLENBQUM7WUFDRixJQUFJLE9BQU8sQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO2dCQUNsQyxtQkFBbUIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxjQUFjLEdBQUcsT0FBTyxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDakcsQ0FBQztZQUNELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxHQUFHLGNBQWMsR0FBRyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7WUFDcEcsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsYUFBYSxHQUFHLFlBQVksQ0FBQyxDQUFDO1lBQzlFLHNEQUFzRDtZQUN0RCxvRkFBb0Y7WUFDcEYsTUFBTSxtQkFBbUIsR0FBRyxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxZQUFZLEdBQUcsY0FBYyxDQUFDLENBQUM7WUFDcEYsTUFBTSxTQUFTLEdBQUcsQ0FBQyxTQUFTLEdBQUcsbUJBQW1CLENBQUMsQ0FBQztZQUNwRCxNQUFNLFlBQVksR0FBRyxDQUFDLG1CQUFtQixHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQy9DLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQzFGLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNoRixPQUFPLElBQUksYUFBYSxDQUFDLFNBQVMsRUFBRSxZQUFZLEVBQUUsWUFBWSxFQUFFLG1CQUFtQixFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsbUJBQW1CLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUM7UUFDN0ssQ0FBQztRQUVELDhFQUE4RTtRQUM5RSwwR0FBMEc7UUFDMUcsZ0VBQWdFO1FBQ2hFLHlEQUF5RDtRQUN6RCxpR0FBaUc7UUFDakcseURBQXlEO1FBQ3pELG1IQUFtSDtRQUNuSCxpS0FBaUs7UUFFaksscURBQXFEO1FBQ3JELElBQUksWUFBb0IsQ0FBQztRQUN6QixJQUFJLDhCQUE4QixJQUFJLHFCQUFxQixLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzNFLGlFQUFpRTtZQUNqRSxtRkFBbUY7WUFDbkYsTUFBTSxpQkFBaUIsR0FBRyxxQkFBcUIsR0FBRyx1QkFBdUIsR0FBRyxDQUFDLENBQUM7WUFDOUUsWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEdBQUcsaUJBQWlCLEdBQUcsVUFBVSxDQUFDLENBQUM7UUFDL0UsQ0FBQzthQUFNLENBQUM7WUFDUCxpQ0FBaUM7WUFDakMsTUFBTSx5QkFBeUIsR0FBRyxjQUFjLEdBQUcsVUFBVSxDQUFDO1lBQzlELFlBQVksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLHlCQUF5QixHQUFHLGlCQUFpQixHQUFHLFVBQVUsQ0FBQyxDQUFDO1FBQ3ZGLENBQUM7UUFFRCxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUMsQ0FBQztRQUN2RSxJQUFJLHFCQUFxQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGFBQWEsR0FBRyxVQUFVLENBQUMsQ0FBQztRQUMzRSxJQUFJLE9BQU8sQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1lBQ2xDLE1BQU0seUJBQXlCLEdBQUcsY0FBYyxHQUFHLFVBQVUsQ0FBQztZQUM5RCxxQkFBcUIsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLHFCQUFxQixFQUFFLHlCQUF5QixHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3hGLENBQUM7UUFFRCxJQUFJLG1CQUEyQixDQUFDO1FBQ2hDLElBQUkscUJBQXFCLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDL0IsTUFBTSx5QkFBeUIsR0FBRyxjQUFjLEdBQUcsVUFBVSxDQUFDO1lBQzlELDJGQUEyRjtZQUMzRixtQkFBbUIsR0FBRyxDQUFDLGtCQUFrQixHQUFHLFNBQVMsR0FBRyxxQkFBcUIsR0FBRyx5QkFBeUIsR0FBRyxDQUFDLENBQUMsR0FBRyxpQkFBaUIsR0FBRyxVQUFVLENBQUM7UUFDakosQ0FBQzthQUFNLENBQUM7WUFDUCw4RkFBOEY7WUFDOUYsbUJBQW1CLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsR0FBRyxTQUFTLENBQUMsR0FBRyxpQkFBaUIsR0FBRyxVQUFVLEdBQUcsWUFBWSxDQUFDLENBQUM7UUFDckgsQ0FBQztRQUNELG1CQUFtQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLGFBQWEsR0FBRyxZQUFZLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUUxRixzREFBc0Q7UUFDdEQsb0ZBQW9GO1FBQ3BGLE1BQU0sbUJBQW1CLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsWUFBWSxHQUFHLGNBQWMsQ0FBQyxDQUFDO1FBQ3BGLE1BQU0sU0FBUyxHQUFHLENBQUMsU0FBUyxHQUFHLG1CQUFtQixDQUFDLENBQUM7UUFFcEQsSUFBSSxtQkFBbUIsSUFBSSxrQkFBa0IsR0FBRyxTQUFTLEdBQUcscUJBQXFCLEVBQUUsQ0FBQztZQUNuRiwrQkFBK0I7WUFDL0IsTUFBTSxZQUFZLEdBQUcsQ0FBQyxtQkFBbUIsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUMvQyxPQUFPLElBQUksYUFBYSxDQUFDLFNBQVMsRUFBRSxZQUFZLEVBQUUsWUFBWSxFQUFFLG1CQUFtQixFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsa0JBQWtCLEVBQUUsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ2pKLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSwwQkFBa0MsQ0FBQztZQUN2QyxJQUFJLHVCQUF1QixHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUNqQywwQkFBMEIsR0FBRyx1QkFBdUIsR0FBRyxrQkFBa0IsQ0FBQztZQUMzRSxDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsMEJBQTBCLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsU0FBUyxHQUFHLFVBQVUsQ0FBQyxDQUFDO1lBQ2xFLENBQUM7WUFFRCxJQUFJLG1CQUEyQixDQUFDO1lBQ2hDLElBQUksZUFBZSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsMEJBQTBCLEdBQUcsU0FBUyxHQUFHLFVBQVUsR0FBRyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7WUFDdkgsSUFBSSxlQUFlLEdBQUcsa0JBQWtCLEVBQUUsQ0FBQztnQkFDMUMsbUJBQW1CLEdBQUcsa0JBQWtCLEdBQUcsZUFBZSxHQUFHLENBQUMsQ0FBQztnQkFDL0QsZUFBZSxHQUFHLENBQUMsQ0FBQztZQUNyQixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsbUJBQW1CLEdBQUcsQ0FBQyxDQUFDO2dCQUN4QixlQUFlLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsZUFBZSxHQUFHLGtCQUFrQixDQUFDLENBQUM7WUFDckUsQ0FBQztZQUVELDJEQUEyRDtZQUMzRCwwREFBMEQ7WUFDMUQsSUFBSSxjQUFjLElBQUksY0FBYyxDQUFDLFlBQVksS0FBSyxZQUFZLEVBQUUsQ0FBQztnQkFDcEUsSUFBSSxjQUFjLENBQUMsU0FBUyxHQUFHLFNBQVMsRUFBRSxDQUFDO29CQUMxQyxtREFBbUQ7b0JBQ25ELGVBQWUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxjQUFjLENBQUMsZUFBZSxDQUFDLENBQUM7b0JBQzVFLG1CQUFtQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsbUJBQW1CLEVBQUUsY0FBYyxDQUFDLG1CQUFtQixDQUFDLENBQUM7Z0JBQ3pGLENBQUM7Z0JBQ0QsSUFBSSxjQUFjLENBQUMsU0FBUyxHQUFHLFNBQVMsRUFBRSxDQUFDO29CQUMxQyxxREFBcUQ7b0JBQ3JELGVBQWUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxjQUFjLENBQUMsZUFBZSxDQUFDLENBQUM7b0JBQzVFLG1CQUFtQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsbUJBQW1CLEVBQUUsY0FBYyxDQUFDLG1CQUFtQixDQUFDLENBQUM7Z0JBQ3pGLENBQUM7WUFDRixDQUFDO1lBRUQsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsZUFBZSxHQUFHLG1CQUFtQixHQUFHLG1CQUFtQixHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQzNHLE1BQU0sV0FBVyxHQUFHLENBQUMsU0FBUyxHQUFHLHFDQUFxQyxDQUFDLEdBQUcsVUFBVSxDQUFDO1lBRXJGLElBQUksZ0JBQXdCLENBQUM7WUFDN0IsSUFBSSxTQUFTLElBQUksT0FBTyxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUNyQyxnQkFBZ0IsR0FBRyxDQUFDLHVCQUF1QixHQUFHLGVBQWUsR0FBRyxtQkFBbUIsR0FBRyxXQUFXLENBQUMsR0FBRyxpQkFBaUIsR0FBRyxVQUFVLENBQUM7WUFDckksQ0FBQztpQkFBTSxDQUFDO2dCQUNQLGdCQUFnQixHQUFHLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLG1CQUFtQixHQUFHLFdBQVcsQ0FBQyxHQUFHLGlCQUFpQixHQUFHLFVBQVUsQ0FBQztZQUM1SCxDQUFDO1lBRUQsT0FBTyxJQUFJLGFBQWEsQ0FBQyxTQUFTLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxtQkFBbUIsRUFBRSxnQkFBZ0IsRUFBRSxZQUFZLEVBQUUsbUJBQW1CLEVBQUUsZUFBZSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ25LLENBQUM7SUFDRixDQUFDO0NBQ0Q7QUFFRCxNQUFNLFdBQVc7YUFFTyxZQUFPLEdBQUcsSUFBSSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUlyRCxZQUFZLEVBQVU7UUFDckIsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUM7SUFDZCxDQUFDO0lBRU0sZ0JBQWdCO1FBQ3RCLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDZCxDQUFDO0lBRU0sZUFBZTtRQUNyQixJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ2QsQ0FBQzs7QUFHRixNQUFNLFVBQVU7SUFRZixZQUNDLGNBQTZCLEVBQzdCLFNBQW9CLEVBQ3BCLEtBQW9CO1FBRXBCLElBQUksQ0FBQyxjQUFjLEdBQUcsY0FBYyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO1FBQzVCLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSx1QkFBdUIsQ0FBQztZQUNqRCxVQUFVLEVBQUUsR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLE9BQU87U0FDckMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLGVBQWUsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRUQ7O09BRUc7SUFDSSxXQUFXLENBQUMsTUFBcUI7UUFDdkMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUNoQyxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3ZDLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUM7UUFDeEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ2xELElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUN4Qix1QkFBdUI7Z0JBQ3ZCLE9BQU8sS0FBSyxDQUFDO1lBQ2QsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRDs7T0FFRztJQUNJLFlBQVksQ0FBQyxNQUFxQjtRQUN4QyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsZUFBZSxLQUFLLE1BQU0sQ0FBQyxlQUFlO2VBQ2pFLElBQUksQ0FBQyxjQUFjLENBQUMsYUFBYSxLQUFLLE1BQU0sQ0FBQyxhQUFhLENBQUM7SUFDaEUsQ0FBQztJQUVELElBQUk7UUFDSCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3ZDLE9BQU87WUFDTixTQUFTLEVBQUUsSUFBSSxDQUFDLFVBQVU7WUFDMUIsbUJBQW1CLEVBQUUsR0FBRyxDQUFDLG1CQUFtQjtZQUM1QyxLQUFLLEVBQUUsR0FBRyxDQUFDLEtBQUs7U0FDaEIsQ0FBQztJQUNILENBQUM7SUFFTSxjQUFjLENBQUMsb0JBQTRCLEVBQUUsV0FBbUI7UUFDdEUsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxvQkFBb0IsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUM5RSxDQUFDO0lBQ00sY0FBYyxDQUFDLG9CQUE0QixFQUFFLGtCQUEwQjtRQUM3RSxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxvQkFBb0IsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFDTSxlQUFlLENBQUMsb0JBQTRCLEVBQUUsa0JBQTBCO1FBQzlFLElBQUksQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDLG9CQUFvQixFQUFFLGtCQUFrQixDQUFDLENBQUM7SUFDL0UsQ0FBQztJQUNNLGVBQWUsQ0FBQyxNQUEwRDtRQUNoRixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3BELENBQUM7Q0FDRDtBQUVEOzs7OztHQUtHO0FBQ0gsTUFBTSxjQUFjO0lBTW5CLFlBQVksR0FBNkIsRUFBRSxLQUFhLEVBQUUsTUFBYyxFQUFFLFVBQWlCO1FBQzFGLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxjQUFjLENBQUMseUJBQXlCLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztRQUMvRixJQUFJLENBQUMsUUFBUSxHQUFHO1lBQ2YsR0FBRyxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDO1lBQ2xDLEdBQUcsQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztTQUNsQyxDQUFDO1FBQ0YsSUFBSSxDQUFDLGVBQWUsR0FBRyxDQUFDLENBQUM7SUFDMUIsQ0FBQztJQUVNLFNBQVM7UUFDZixpQkFBaUI7UUFDakIsSUFBSSxDQUFDLGVBQWUsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQztRQUNoRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUVuRCw2QkFBNkI7UUFDN0IsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFFMUMsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBRU8sTUFBTSxDQUFDLHlCQUF5QixDQUFDLEtBQWEsRUFBRSxNQUFjLEVBQUUsVUFBaUI7UUFDeEYsTUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUNqQyxNQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQ2pDLE1BQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDakMsTUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUVqQyxNQUFNLE1BQU0sR0FBRyxJQUFJLGlCQUFpQixDQUFDLEtBQUssR0FBRyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDekQsSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBQ2YsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ2pDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDaEMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLFdBQVcsQ0FBQztnQkFDN0IsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7Z0JBQ2pDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDO2dCQUNqQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztnQkFDakMsTUFBTSxJQUFJLENBQUMsQ0FBQztZQUNiLENBQUM7UUFDRixDQUFDO1FBRUQsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0NBQ0Q7QUF5REQsTUFBTSxvQkFBb0I7SUFFbEIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUF1QixFQUFFLGFBQXFCLEVBQUUsZ0JBQTZDO1FBQ2xILElBQUksT0FBTyxDQUFDLGFBQWEsK0JBQXVCLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDekUsT0FBTyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNuQixDQUFDO1FBRUQsMEZBQTBGO1FBQzFGLHNDQUFzQztRQUN0QyxNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyx3QkFBd0IsQ0FBQyxnQ0FBZ0MsQ0FBQztZQUN0RixhQUFhLEVBQUUsYUFBYTtZQUM1QixvQkFBb0IsRUFBRSxPQUFPLENBQUMsb0JBQW9CO1lBQ2xELFVBQVUsRUFBRSxPQUFPLENBQUMsVUFBVTtZQUM5QixhQUFhLEVBQUUsT0FBTyxDQUFDLGFBQWE7WUFDcEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxZQUFZO1lBQzVCLFVBQVUsRUFBRSxPQUFPLENBQUMsVUFBVTtZQUM5QixVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVU7U0FDOUIsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxLQUFLLEdBQUcsYUFBYSxHQUFHLGdCQUFnQixDQUFDO1FBQy9DLE1BQU0sU0FBUyxHQUFHLEtBQUssR0FBRyxDQUFDLENBQUM7UUFFNUIsSUFBSSxDQUFDLGdCQUFnQixJQUFJLGdCQUFnQixDQUFDLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDckUsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO1lBQzVCLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDZCxJQUFJLGdCQUFnQixHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUMxQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxTQUFTLEdBQUcsZ0JBQWdCLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxTQUFTLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztvQkFDdEUsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUssR0FBRyxTQUFTLENBQUMsQ0FBQztnQkFDL0MsQ0FBQztnQkFDRCxNQUFNLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLEdBQUcsYUFBYSxDQUFDO1lBQzlDLENBQUM7WUFDRCxPQUFPLENBQUMsSUFBSSxvQkFBb0IsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDdEQsQ0FBQztRQUVELE1BQU0sZUFBZSxHQUFHLGdCQUFnQixDQUFDLFlBQVksQ0FBQztRQUN0RCxNQUFNLFNBQVMsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDO1FBQ3pDLE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztRQUM1QixJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUM7UUFDakIsSUFBSSxpQkFBaUIsR0FBRyxDQUFDLENBQUM7UUFDMUIsSUFBSSxpQkFBaUIsR0FBRyxDQUFDLENBQUM7UUFDMUIsTUFBTSxlQUFlLEdBQUcsRUFBRSxDQUFDLENBQUMsOEZBQThGO1FBQzFILElBQUksTUFBTSxHQUF5QixFQUFFLENBQUM7UUFDdEMsSUFBSSxTQUFTLEdBQThCLElBQUksQ0FBQztRQUNoRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsZ0JBQWdCLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUMzQyxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUM5RSxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBRW5GLE9BQU8sUUFBUSxHQUFHLFNBQVMsSUFBSSxlQUFlLENBQUMsUUFBUSxDQUFDLEdBQUcsa0JBQWtCLEVBQUUsQ0FBQztnQkFDL0UsSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLGVBQWUsRUFBRSxDQUFDO29CQUNyQyxNQUFNLG9CQUFvQixHQUFHLFFBQVEsR0FBRyxDQUFDLEdBQUcsaUJBQWlCLENBQUM7b0JBQzlELElBQUksU0FBUyxJQUFJLFNBQVMsQ0FBQyxJQUFJLEtBQUssU0FBUyxJQUFJLFNBQVMsQ0FBQyxTQUFTLEtBQUssUUFBUSxHQUFHLENBQUMsRUFBRSxDQUFDO3dCQUN2RixTQUFTLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztvQkFDaEMsQ0FBQzt5QkFBTSxDQUFDO3dCQUNQLFNBQVMsR0FBRyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxvQkFBb0IsRUFBRSxvQkFBb0IsRUFBRSxrQkFBa0IsRUFBRSxvQkFBb0IsRUFBRSxDQUFDO3dCQUMzSSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUN4QixDQUFDO29CQUNELGlCQUFpQixFQUFFLENBQUM7Z0JBQ3JCLENBQUM7Z0JBQ0QsUUFBUSxFQUFFLENBQUM7WUFDWixDQUFDO1lBRUQsSUFBSSxzQkFBOEIsQ0FBQztZQUNuQyxJQUFJLFFBQVEsR0FBRyxTQUFTLElBQUksZUFBZSxDQUFDLFFBQVEsQ0FBQyxJQUFJLGdCQUFnQixFQUFFLENBQUM7Z0JBQzNFLDZCQUE2QjtnQkFDN0Isc0JBQXNCLEdBQUcsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUNuRCxRQUFRLEVBQUUsQ0FBQztZQUNaLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztvQkFDYixzQkFBc0IsR0FBRyxDQUFDLENBQUM7Z0JBQzVCLENBQUM7cUJBQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLGdCQUFnQixFQUFFLENBQUM7b0JBQ3ZDLHNCQUFzQixHQUFHLGFBQWEsQ0FBQztnQkFDeEMsQ0FBQztxQkFBTSxDQUFDO29CQUNQLHNCQUFzQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUssR0FBRyxTQUFTLENBQUMsQ0FBQztnQkFDNUQsQ0FBQztnQkFDRCxJQUFJLE1BQU0sQ0FBQyxNQUFNLEdBQUcsZUFBZSxFQUFFLENBQUM7b0JBQ3JDLE1BQU0sb0JBQW9CLEdBQUcsUUFBUSxHQUFHLENBQUMsR0FBRyxpQkFBaUIsQ0FBQztvQkFDOUQsSUFBSSxTQUFTLElBQUksU0FBUyxDQUFDLElBQUksS0FBSyxVQUFVLElBQUksU0FBUyxDQUFDLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7d0JBQzFFLFNBQVMsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO29CQUNoQyxDQUFDO3lCQUFNLENBQUM7d0JBQ1AsU0FBUyxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLG9CQUFvQixFQUFFLG9CQUFvQixFQUFFLGtCQUFrQixFQUFFLG9CQUFvQixFQUFFLENBQUM7d0JBQzlILE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7b0JBQ3hCLENBQUM7b0JBQ0QsaUJBQWlCLEVBQUUsQ0FBQztnQkFDckIsQ0FBQztZQUNGLENBQUM7WUFFRCxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsc0JBQXNCLENBQUM7WUFDbkMsaUJBQWlCLEdBQUcsc0JBQXNCLENBQUM7UUFDNUMsQ0FBQztRQUVELElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxlQUFlLEVBQUUsQ0FBQztZQUNyQyxPQUFPLFFBQVEsR0FBRyxTQUFTLEVBQUUsQ0FBQztnQkFDN0IsTUFBTSxvQkFBb0IsR0FBRyxRQUFRLEdBQUcsQ0FBQyxHQUFHLGlCQUFpQixDQUFDO2dCQUM5RCxJQUFJLFNBQVMsSUFBSSxTQUFTLENBQUMsSUFBSSxLQUFLLFNBQVMsSUFBSSxTQUFTLENBQUMsU0FBUyxLQUFLLFFBQVEsR0FBRyxDQUFDLEVBQUUsQ0FBQztvQkFDdkYsU0FBUyxDQUFDLGtCQUFrQixFQUFFLENBQUM7Z0JBQ2hDLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxTQUFTLEdBQUcsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsb0JBQW9CLEVBQUUsb0JBQW9CLEVBQUUsa0JBQWtCLEVBQUUsb0JBQW9CLEVBQUUsQ0FBQztvQkFDM0ksTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDeEIsQ0FBQztnQkFDRCxpQkFBaUIsRUFBRSxDQUFDO2dCQUNwQixRQUFRLEVBQUUsQ0FBQztZQUNaLENBQUM7UUFDRixDQUFDO2FBQU0sQ0FBQztZQUNQLGdDQUFnQztZQUNoQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQzlCLENBQUM7UUFFRCxPQUFPLENBQUMsSUFBSSxvQkFBb0IsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDMUQsQ0FBQztJQUVELFlBQ2lCLGFBQXFCLEVBQ3JCLFlBQXNCLENBQUMscUVBQXFFOztRQUQ1RixrQkFBYSxHQUFiLGFBQWEsQ0FBUTtRQUNyQixpQkFBWSxHQUFaLFlBQVksQ0FBVTtJQUV2QyxDQUFDO0lBRU0sc0JBQXNCLENBQUMsVUFBa0I7UUFDL0MsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDckcsQ0FBQztJQUVEOztPQUVHO0lBQ0ksZ0NBQWdDLENBQUMsY0FBc0IsRUFBRSxZQUFvQjtRQUNuRixJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUMsc0JBQXNCLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3BFLE9BQU8sYUFBYSxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLGFBQWEsR0FBRyxDQUFDLENBQUMsSUFBSSxjQUFjLEVBQUUsQ0FBQztZQUNwRixhQUFhLEVBQUUsQ0FBQztRQUNqQixDQUFDO1FBQ0QsSUFBSSxXQUFXLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNoRSxPQUFPLFdBQVcsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDLElBQUksWUFBWSxFQUFFLENBQUM7WUFDekcsV0FBVyxFQUFFLENBQUM7UUFDZixDQUFDO1FBQ0QsSUFBSSxhQUFhLEtBQUssV0FBVyxFQUFFLENBQUM7WUFDbkMsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQzNELElBQUksaUJBQWlCLEdBQUcsY0FBYyxJQUFJLGlCQUFpQixHQUFHLFlBQVksRUFBRSxDQUFDO2dCQUM1RSwrREFBK0Q7Z0JBQy9ELE9BQU8sSUFBSSxDQUFDO1lBQ2IsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLENBQUMsYUFBYSxHQUFHLENBQUMsRUFBRSxXQUFXLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUVEOztPQUVHO0lBQ0kscUNBQXFDLENBQUMsZUFBdUIsRUFBRSxhQUFxQjtRQUMxRixJQUFJLGdCQUFnQixHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUNwRSxJQUFJLGNBQWMsR0FBRyxJQUFJLENBQUMsc0JBQXNCLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDaEUsSUFBSSxlQUFlLEtBQUssYUFBYSxJQUFJLGNBQWMsS0FBSyxnQkFBZ0IsRUFBRSxDQUFDO1lBQzlFLElBQUksY0FBYyxLQUFLLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ2pELElBQUksZ0JBQWdCLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQzFCLGdCQUFnQixFQUFFLENBQUM7Z0JBQ3BCLENBQUM7WUFDRixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsY0FBYyxFQUFFLENBQUM7WUFDbEIsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUVNLGNBQWMsQ0FBQyxDQUFtQztRQUN4RCw2QkFBNkI7UUFDN0IsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQyxjQUFjLEdBQUcsQ0FBQyxDQUFDO1FBQy9ELElBQUksZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUM7UUFDaEQsSUFBSSxjQUFjLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLEtBQUssSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUN4RCxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUM3QyxNQUFNO1lBQ1AsQ0FBQztZQUNELElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQzVDLHNEQUFzRDtnQkFDdEQsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsY0FBYyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUN6RCxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNqRCxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDOUMsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksZ0JBQWdCLENBQUM7WUFDMUMsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUVNLGVBQWUsQ0FBQyxDQUFvQztRQUMxRCw2QkFBNkI7UUFDN0IsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQyxjQUFjLEdBQUcsQ0FBQyxDQUFDO1FBQ2hFLEtBQUssSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUN4RCxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUM3QyxNQUFNO1lBQ1AsQ0FBQztZQUNELElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksaUJBQWlCLENBQUM7UUFDM0MsQ0FBQztJQUNGLENBQUM7Q0FDRDtBQUVEOzs7R0FHRztBQUNILE1BQU0sT0FBTyxPQUFRLFNBQVEsUUFBUTtJQWdCcEMsWUFBWSxPQUFvQjtRQUMvQixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFMUix3QkFBbUIsR0FBRyxJQUFJLFFBQVEsQ0FBaUIsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBT25FLElBQUksQ0FBQyxrQkFBa0IsR0FBRyx5QkFBeUIsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUVsRSxJQUFJLENBQUMsV0FBVyxHQUFHLEVBQUUsQ0FBQztRQUN0QixJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO1FBRS9CLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxjQUFjLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDN0csTUFBTSxDQUFDLGFBQWEsRUFBRSxHQUFHLG9CQUFvQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2xILElBQUksQ0FBQyxjQUFjLEdBQUcsYUFBYSxDQUFDO1FBQ3BDLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxLQUFLLENBQUM7UUFFbEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLFlBQVksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFZSxPQUFPO1FBQ3RCLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDdkIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2pCLENBQUM7SUFFTSxVQUFVO1FBQ2hCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUNsQyxDQUFDO0lBRU8sc0JBQXNCO1FBQzdCLE1BQU0sSUFBSSxHQUFHLElBQUksY0FBYyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQzNHLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUMvQixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFDRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztRQUNwQixJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUM3QixJQUFJLENBQUMsT0FBTyxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDbEMsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRUQsaUNBQWlDO0lBRWpCLHNCQUFzQixDQUFDLENBQTJDO1FBQ2pGLE9BQU8sSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7SUFDdEMsQ0FBQztJQUNlLG9CQUFvQixDQUFDLENBQXlDO1FBQzdFLElBQUksQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQztRQUNoQyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO1FBQy9CLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0lBQzFDLENBQUM7SUFDZSxvQkFBb0IsQ0FBQyxDQUF5QztRQUM3RSxJQUFJLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN0QixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztRQUM1QyxDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0lBQ2UsU0FBUyxDQUFDLENBQThCO1FBQ3ZELElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3pCLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLENBQUM7UUFDbEMsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUNqQyxDQUFDO0lBQ2UsY0FBYyxDQUFDLENBQW1DO1FBQ2pFLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3pCLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxjQUFjLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNoSSxJQUFJLGdCQUFnQixFQUFFLENBQUM7Z0JBQ3RCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEdBQUcsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDeEcsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE9BQU8sS0FBSyxDQUFDO1lBQ2QsQ0FBQztRQUNGLENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvRCxDQUFDO0lBQ0YsQ0FBQztJQUNlLGNBQWMsQ0FBQyxDQUFtQztRQUNqRSxJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN6QixNQUFNLENBQUMsZ0JBQWdCLEVBQUUsY0FBYyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakYsSUFBSSxnQkFBZ0IsSUFBSSxjQUFjLEVBQUUsQ0FBQztnQkFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxFQUFFLGNBQWMsR0FBRyxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUMxRixDQUFDO1lBQ0QsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksQ0FBQztZQUNqQyxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUN0RSxDQUFDO0lBQ0YsQ0FBQztJQUNlLGVBQWUsQ0FBQyxDQUFvQztRQUNuRSxJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN6QixJQUFJLENBQUMsY0FBYyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN2QyxJQUFJLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxDQUFDO1lBQ2pDLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQzthQUFNLENBQUM7WUFDUCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7SUFDRixDQUFDO0lBQ2UsZUFBZSxDQUFDLENBQW9DO1FBQ25FLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDeEMsQ0FBQztJQUNlLGNBQWMsQ0FBQyxDQUFtQztRQUNqRSxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQzlCLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1FBQzlCLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUNlLGVBQWUsQ0FBQyxDQUFvQztRQUNuRSxJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN6QixNQUFNLE1BQU0sR0FBdUQsRUFBRSxDQUFDO1lBQ3RFLEtBQUssTUFBTSxLQUFLLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUM5QixNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsZ0NBQWdDLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQ3hILElBQUksZ0JBQWdCLEVBQUUsQ0FBQztvQkFDdEIsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxZQUFZLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUN6RixDQUFDO1lBQ0YsQ0FBQztZQUNELElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUNuQixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzdDLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxPQUFPLEtBQUssQ0FBQztZQUNkLENBQUM7UUFDRixDQUFDO2FBQU0sQ0FBQztZQUNQLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQy9DLENBQUM7SUFDRixDQUFDO0lBQ2UscUJBQXFCLENBQUMsQ0FBMEM7UUFDL0UsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7UUFDOUIsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLHFCQUFxQixFQUFFLENBQUM7SUFDN0MsQ0FBQztJQUNlLGNBQWMsQ0FBQyxDQUFtQztRQUNqRSxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFLENBQUM7SUFDdEMsQ0FBQztJQUVELHlCQUF5QjtJQUVsQixhQUFhLENBQUMsR0FBcUI7UUFDekMsSUFBSSxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztZQUMvQixJQUFJLENBQUMsb0JBQW9CLEdBQUcsS0FBSyxDQUFDO1lBQ2xDLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQzlCLENBQUM7SUFDRixDQUFDO0lBRU0sTUFBTSxDQUFDLEdBQStCO1FBQzVDLElBQUksdUJBQXVCLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUM7UUFDL0QsSUFBSSxxQkFBcUIsR0FBRyxHQUFHLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQztRQUUzRCxJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN6Qix1QkFBdUIsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLHNCQUFzQixDQUFDLHVCQUF1QixDQUFDLENBQUM7WUFDOUYscUJBQXFCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxzQkFBc0IsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBQzNGLENBQUM7UUFFRCxNQUFNLFVBQVUsR0FBNkI7WUFDNUMsOEJBQThCLEVBQUUsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLHNCQUFzQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7WUFFcEYsV0FBVyxFQUFFLEdBQUcsQ0FBQyxXQUFXO1lBQzVCLFlBQVksRUFBRSxHQUFHLENBQUMsWUFBWTtZQUU5Qix1QkFBdUIsRUFBRSx1QkFBdUI7WUFDaEQscUJBQXFCLEVBQUUscUJBQXFCO1lBQzVDLHFDQUFxQyxFQUFFLEdBQUcsQ0FBQyw4QkFBOEIsQ0FBQyx1QkFBdUIsQ0FBQztZQUVsRyxTQUFTLEVBQUUsR0FBRyxDQUFDLFNBQVM7WUFDeEIsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVO1lBRTFCLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYTtZQUNoQyxjQUFjLEVBQUUsR0FBRyxDQUFDLGNBQWM7U0FDbEMsQ0FBQztRQUNGLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2pDLENBQUM7SUFFRCx1QkFBdUI7SUFFZixxQkFBcUI7UUFDNUIsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQztRQUUvQixNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ2pELE1BQU0sQ0FBQyxhQUFhLEVBQUUsTUFBTSxDQUFDLEdBQUcsb0JBQW9CLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ3hJLElBQUksQ0FBQyxjQUFjLEdBQUcsYUFBYSxDQUFDO1FBRXBDLElBQUksV0FBVyxJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN4Qyw0QkFBNEI7WUFDNUIsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLEVBQUUsQ0FBQztnQkFDNUIsUUFBUSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBQ3BCLEtBQUssU0FBUzt3QkFDYixJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsb0JBQW9CLEVBQUUsS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7d0JBQ2xGLE1BQU07b0JBQ1AsS0FBSyxVQUFVO3dCQUNkLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsRUFBRSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQzt3QkFDbkYsTUFBTTtvQkFDUCxLQUFLLE9BQU87d0JBQ1gsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQzt3QkFDekIsTUFBTTtnQkFDUixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRU0sWUFBWTtRQUNsQixJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN6QixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQztRQUNoRCxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUMvQyxDQUFDO0lBRU0sZ0JBQWdCO1FBQ3RCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDL0MsQ0FBQztJQUVNLGNBQWMsQ0FBQyxVQUFrQjtRQUN2QyxJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN6QixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNqRyxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUVNLGdCQUFnQixDQUFDLFVBQWtCO1FBQ3pDLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3pCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkcsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUVNLDRCQUE0QixDQUFDLGVBQXVCLEVBQUUsYUFBcUIsRUFBRSxNQUFpQjtRQUNwRyxJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN6QixNQUFNLE1BQU0sR0FBNEIsRUFBRSxDQUFDO1lBQzNDLEtBQUssSUFBSSxTQUFTLEdBQUcsQ0FBQyxFQUFFLFNBQVMsR0FBRyxhQUFhLEdBQUcsZUFBZSxHQUFHLENBQUMsRUFBRSxTQUFTLEdBQUcsU0FBUyxFQUFFLFNBQVMsRUFBRSxFQUFFLENBQUM7Z0JBQzdHLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7b0JBQ3ZCLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsZUFBZSxHQUFHLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNoSSxDQUFDO3FCQUFNLENBQUM7b0JBQ1AsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQztnQkFDMUIsQ0FBQztZQUNGLENBQUM7WUFDRCxPQUFPLE1BQU0sQ0FBQztRQUNmLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLDRCQUE0QixDQUFDLGVBQWUsRUFBRSxhQUFhLEVBQUUsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQzFHLENBQUM7SUFFTSxhQUFhO1FBQ25CLElBQUksSUFBSSxDQUFDLGtCQUFrQixLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3RDLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUN6QixJQUFJLENBQUMsa0JBQWtCLEdBQUcsRUFBRSxDQUFDO2dCQUM3QixLQUFLLE1BQU0sU0FBUyxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztvQkFDMUMsTUFBTSxDQUFDLGdCQUFnQixFQUFFLGNBQWMsQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMscUNBQXFDLENBQUMsU0FBUyxDQUFDLGVBQWUsRUFBRSxTQUFTLENBQUMsYUFBYSxDQUFDLENBQUM7b0JBQ3pKLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxTQUFTLENBQUMsZ0JBQWdCLEVBQUUsU0FBUyxDQUFDLFdBQVcsRUFBRSxjQUFjLEVBQUUsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQzNILENBQUM7WUFDRixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQyxXQUFXLENBQUM7WUFDNUMsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztJQUNoQyxDQUFDO0lBRU0sK0JBQStCLENBQUMsZUFBdUIsRUFBRSxhQUFxQjtRQUNwRixPQUFPLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxlQUFlLEVBQUUsYUFBYSxDQUFDO2FBQzFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBRU0scUNBQXFDLENBQUMsZUFBdUIsRUFBRSxhQUFxQjtRQUMxRixNQUFNLDBCQUEwQixHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMscUJBQXFCLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztRQUN2RyxlQUFlLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxlQUFlLEdBQUcsMEJBQTBCLENBQUMsQ0FBQyxDQUFDO1FBQ3hGLE9BQU8sSUFBSSxDQUFDLGdDQUFnQyxDQUFDLGVBQWUsRUFBRSxhQUFhLENBQUM7YUFDMUUsTUFBTSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGtCQUFrQixDQUFDLENBQUM7SUFDMUUsQ0FBQztJQUVPLGdDQUFnQyxDQUFDLGVBQXVCLEVBQUUsYUFBcUI7UUFDdEYsSUFBSSxZQUFtQixDQUFDO1FBQ3hCLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3pCLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ25GLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQy9FLFlBQVksR0FBRyxJQUFJLEtBQUssQ0FBQyxvQkFBb0IsRUFBRSxDQUFDLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBQ3JJLENBQUM7YUFBTSxDQUFDO1lBQ1AsWUFBWSxHQUFHLElBQUksS0FBSyxDQUFDLGVBQWUsRUFBRSxDQUFDLEVBQUUsYUFBYSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7UUFDdEgsQ0FBQztRQUNELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLDRCQUE0QixDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRXZGLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3pCLE1BQU0sTUFBTSxHQUEwQixFQUFFLENBQUM7WUFDekMsS0FBSyxNQUFNLFVBQVUsSUFBSSxXQUFXLEVBQUUsQ0FBQztnQkFDdEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQ2pDLFNBQVM7Z0JBQ1YsQ0FBQztnQkFDRCxNQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDO2dCQUMvQixNQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsc0JBQXNCLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUNqRyxNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsc0JBQXNCLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUM3RixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksbUJBQW1CLENBQUMsSUFBSSxLQUFLLENBQUMsc0JBQXNCLEVBQUUsS0FBSyxDQUFDLFdBQVcsRUFBRSxvQkFBb0IsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDdkosQ0FBQztZQUNELE9BQU8sTUFBTSxDQUFDO1FBQ2YsQ0FBQztRQUVELE9BQU8sV0FBVyxDQUFDO0lBQ3BCLENBQUM7SUFFTSxvQkFBb0IsQ0FBQyxVQUErQixFQUFFLFFBQStCO1FBQzNGLE1BQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFDO1FBQ2pFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNqQixPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFDRCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzVELElBQUksVUFBVSxFQUFFLENBQUM7WUFDaEIsT0FBTyxVQUFVLENBQUM7UUFDbkIsQ0FBQztRQUNELE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN4QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNyRCxPQUFPLFVBQVUsQ0FBQztJQUNuQixDQUFDO0lBRU0sVUFBVTtRQUNoQixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUNuRCxDQUFDO0lBRU0sZ0JBQWdCLENBQUMsVUFBa0I7UUFDekMsSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDekIsVUFBVSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUMvRCxDQUFDO1FBQ0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUNsQyxPQUFPLEVBQ1AsS0FBSyxFQUNMLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQywwRUFHdkMsQ0FBQztJQUNILENBQUM7SUFFTSxZQUFZLENBQUMsU0FBaUI7UUFDcEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLGlCQUFpQixDQUFDO1lBQ3BELFNBQVMsRUFBRSxTQUFTO1NBQ3BCLCtCQUF1QixDQUFDO0lBQzFCLENBQUM7Q0FHRDtBQUVELE1BQU0sWUFBYSxTQUFRLFVBQVU7SUEyQnBDLFlBQ0MsS0FBa0IsRUFDbEIsS0FBb0I7UUFFcEIsS0FBSyxFQUFFLENBQUM7UUFWRCx1QkFBa0IsR0FBWSxLQUFLLENBQUM7UUFDcEMsdUJBQWtCLEdBQVksS0FBSyxDQUFDO1FBRXBDLHdCQUFtQixHQUFZLEtBQUssQ0FBQztRQVM1QyxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztRQUNwQixJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztRQUVwQixJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQztRQUM1QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztRQUNyQixJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFFOUQsSUFBSSxDQUFDLFFBQVEsR0FBRyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDakUsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLGtDQUEwQixDQUFDO1FBQy9ELElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDLENBQUM7UUFDL0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDdEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ25ELElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLGFBQWEsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUVsRCxJQUFJLENBQUMsT0FBTyxHQUFHLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUNoRSxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQ25ELElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUV4QyxJQUFJLENBQUMsT0FBTyxHQUFHLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUNuRSxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNyQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN4QixJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFeEMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUM5RSxJQUFJLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2hELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsMkJBQTJCLENBQUMsQ0FBQztRQUNsRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ25DLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBRW5ELElBQUksQ0FBQyxPQUFPLEdBQUcsaUJBQWlCLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ2hFLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDNUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRXhDLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDMUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMvQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsWUFBWSxDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFDakUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFFakQsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBRXBCLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksZ0JBQWdCLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGdDQUFnQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUV0SCxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRSxHQUFHLEVBQUU7WUFDdEcsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQztRQUNqQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0osSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsNkJBQTZCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFO1lBQ3ZHLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxLQUFLLENBQUM7UUFDbEMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxHQUFHLENBQUMsNkJBQTZCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRTtZQUN0SCxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUM7WUFFbkIsTUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDLENBQUMsV0FBVyxLQUFLLE9BQU8sQ0FBQyxDQUFDO1lBQzVDLE1BQU0sV0FBVyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQztZQUVyQyxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUM7WUFDeEQsSUFBSSxhQUFhLCtCQUF1QixFQUFFLENBQUM7Z0JBQzFDLE9BQU87WUFDUixDQUFDO1lBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDM0IsT0FBTztZQUNSLENBQUM7WUFDRCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxjQUFjLEVBQUUsQ0FBQztnQkFDakQsSUFBSSxXQUFXLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO29CQUN6Qyx5REFBeUQ7b0JBQ3pELE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUNsRSxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsR0FBRyxHQUFHLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO29CQUN2RCxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLFdBQVcsRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLGNBQWMsQ0FBQyxDQUFDO2dCQUNoRixDQUFDO2dCQUNELE9BQU87WUFDUixDQUFDO1lBRUQsSUFBSSxXQUFXLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDN0IsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztnQkFDaEUsTUFBTSxlQUFlLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUM7Z0JBQ3BILE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLGlCQUFpQixDQUFDLENBQUM7Z0JBRWxFLElBQUksVUFBVSxHQUFHLFNBQVMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGNBQWMsQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsbUJBQW1CLENBQUM7Z0JBQzNJLFVBQVUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7Z0JBRTlELElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDMUMsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHlCQUF5QixHQUFHLElBQUksd0JBQXdCLEVBQUUsQ0FBQztRQUVoRSxJQUFJLENBQUMsMEJBQTBCLEdBQUcsR0FBRyxDQUFDLDZCQUE2QixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUU7WUFDM0gsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ25CLENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUNwQixJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDNUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDNUUsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNuRSxJQUFJLENBQUMseUJBQXlCLEdBQUcsR0FBRyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFlLEVBQUUsRUFBRTtZQUN0SCxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDbkIsQ0FBQyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ3BCLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUMxQixJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzdDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUM7Z0JBQy9CLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMvQixDQUFDO1FBQ0YsQ0FBQyxFQUFFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7UUFFdkIsSUFBSSxDQUFDLHdCQUF3QixHQUFHLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBZSxFQUFFLEVBQUU7WUFDdEgsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ25CLENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUNwQixJQUFJLElBQUksQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7Z0JBQ3JELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMvQixDQUFDO1FBQ0YsQ0FBQyxFQUFFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7UUFFdkIsSUFBSSxDQUFDLHVCQUF1QixHQUFHLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBZSxFQUFFLEVBQUU7WUFDMUgsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ25CLENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUNwQixJQUFJLENBQUMsa0JBQWtCLEdBQUcsS0FBSyxDQUFDO1lBQ2hDLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMvQyxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFTyxTQUFTO1FBQ2hCLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNwQyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDdkMsQ0FBQztJQUVPLGdDQUFnQztRQUN2QyxJQUFJLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNqQixPQUFPO1FBQ1IsQ0FBQztRQUNELElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRU8sb0JBQW9CLENBQUMsQ0FBZSxFQUFFLFdBQW1CLEVBQUUsa0JBQWlDO1FBQ25HLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxZQUFZLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakQsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLFdBQVcsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBRTVCLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUU3QyxNQUFNLGlCQUFpQixHQUFHLENBQUMsSUFBWSxFQUFFLElBQVksRUFBRSxFQUFFO1lBQ3hELE1BQU0sZUFBZSxHQUFHLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzFFLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FDdEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsV0FBVyxDQUFDLEVBQzVCLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsRUFDckMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsZUFBZSxDQUFDLElBQUksR0FBRyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQzdELENBQUM7WUFFRixJQUFJLFFBQVEsQ0FBQyxTQUFTLElBQUksc0JBQXNCLEdBQUcsMkJBQTJCLEVBQUUsQ0FBQztnQkFDaEYscUVBQXFFO2dCQUNyRSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDdkQsT0FBTztZQUNSLENBQUM7WUFFRCxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsV0FBVyxDQUFDO1lBQ3hDLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLGtCQUFrQixDQUFDLDRCQUE0QixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7UUFDekYsQ0FBQyxDQUFDO1FBRUYsSUFBSSxDQUFDLENBQUMsS0FBSyxLQUFLLFdBQVcsRUFBRSxDQUFDO1lBQzdCLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDekMsQ0FBQztRQUVELElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxlQUFlLENBQzdDLENBQUMsQ0FBQyxNQUFNLEVBQ1IsQ0FBQyxDQUFDLFNBQVMsRUFDWCxDQUFDLENBQUMsT0FBTyxFQUNULGVBQWUsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxlQUFlLENBQUMsS0FBSyxDQUFDLEVBQ2xGLEdBQUcsRUFBRTtZQUNKLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMvQyxDQUFDLENBQ0QsQ0FBQztJQUNILENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxLQUFtQjtRQUNoRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRSxDQUFDLEdBQUcsQ0FBQztRQUNqRSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsZUFBZ0IsQ0FBQyxjQUFjLENBQUMsb0NBQW9DLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQztRQUNsSCxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRWUsT0FBTztRQUN0QixJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDcEMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3pDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUMxQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDbEMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3pDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN4QyxJQUFJLENBQUMsdUJBQXVCLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDdkMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2pCLENBQUM7SUFFTywyQkFBMkI7UUFDbEMsTUFBTSxNQUFNLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMzQixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQVUsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUNqRCxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQzlCLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ2pDLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQVEsS0FBSyxXQUFXLEVBQUUsQ0FBQztZQUNsRCxNQUFNLENBQUMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLENBQUM7UUFDM0MsQ0FBQzthQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ3RELE1BQU0sQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsQ0FBQztRQUN4QyxDQUFDO1FBRUQsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3pCLENBQUM7SUFFTSxVQUFVO1FBQ2hCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUN0QixDQUFDO0lBRU8sWUFBWTtRQUNuQixJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN2RCxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUN6RCxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUMzRCxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUUxRCxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQzVELElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDOUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDO1FBQ2xFLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztRQUVwRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDdkUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3pFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDO1FBQzdFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDO1FBRS9FLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQ3pELENBQUM7SUFFTyxVQUFVO1FBQ2pCLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDcEIsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsaUJBQWlCLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQzNGLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxjQUFjLENBQ2pDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUUsRUFDdEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLEVBQ3BDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGlCQUFpQixFQUNyQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQ25DLENBQUM7WUFDSCxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQ3pELENBQUM7SUFFRCxpQ0FBaUM7SUFFMUIsa0JBQWtCO1FBQ3hCLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDO1FBQzVCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNwQixJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsMkJBQTJCLEVBQUUsQ0FBQyxDQUFDO0lBQ2hFLENBQUM7SUFDTSxrQkFBa0I7UUFDeEIsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQztRQUMvQixPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFDTSxvQkFBb0I7UUFDMUIsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQztRQUMvQixPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFDTSxTQUFTO1FBQ2YsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUM7UUFDNUIsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBQ00sY0FBYyxDQUFDLG9CQUE0QixFQUFFLFdBQW1CO1FBQ3RFLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQzFCLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsb0JBQW9CLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDL0UsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUNNLGNBQWMsQ0FBQyxvQkFBNEIsRUFBRSxrQkFBMEI7UUFDN0UsSUFBSSxDQUFDLGVBQWUsRUFBRSxjQUFjLENBQUMsb0JBQW9CLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUMvRSxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFDTSxlQUFlLENBQUMsb0JBQTRCLEVBQUUsa0JBQTBCO1FBQzlFLElBQUksQ0FBQyxlQUFlLEVBQUUsZUFBZSxDQUFDLG9CQUFvQixFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDaEYsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBQ00sZUFBZSxDQUFDLENBQW9DO1FBQzFELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLFFBQVEsSUFBSSxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsSUFBSSxDQUFDLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDO1lBQ2hHLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM5QyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDbEIsQ0FBQztRQUNELElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUM7UUFDL0IsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBQ00sY0FBYztRQUNwQixJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDOUQsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQztRQUMvQixPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFDTSxlQUFlLENBQUMsTUFBMEQ7UUFDaEYsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDMUIsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNyRCxDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0lBQ00scUJBQXFCO1FBQzNCLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDO1FBQzVCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUNNLGNBQWM7UUFDcEIsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUM7UUFDNUIsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRUQseUJBQXlCO0lBRWxCLE1BQU0sQ0FBQyxZQUFzQztRQUNuRCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUM7UUFDeEQsSUFBSSxhQUFhLCtCQUF1QixFQUFFLENBQUM7WUFDMUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsdUJBQXVCLENBQUMsQ0FBQztZQUNuRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25DLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDcEMsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLFlBQVksQ0FBQyxVQUFVLEdBQUcsWUFBWSxDQUFDLGFBQWEsSUFBSSxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDdEYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUNwRCxDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFDckQsQ0FBQztRQUVELE1BQU0sTUFBTSxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQ2xDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUNuQixZQUFZLENBQUMsdUJBQXVCLEVBQ3BDLFlBQVksQ0FBQyxxQkFBcUIsRUFDbEMsWUFBWSxDQUFDLHFDQUFxQyxFQUNsRCxZQUFZLENBQUMsY0FBYyxFQUMzQixZQUFZLENBQUMsOEJBQThCLEVBQzNDLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLEVBQzFCLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsRUFDOUIsWUFBWSxDQUFDLFNBQVMsRUFDdEIsWUFBWSxDQUFDLFlBQVksRUFDekIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FDakUsQ0FBQztRQUNGLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDaEUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUU1Qyx3Q0FBd0M7UUFDeEMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ2xFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFdEQsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQy9CLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBRU8saUJBQWlCLENBQUMsTUFBcUI7UUFDOUMsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUM3QixJQUFJLENBQUMsa0JBQWtCLEdBQUcsS0FBSyxDQUFDO1lBQ2hDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDL0MsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQztZQUVoRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLCtCQUErQixDQUFDLE1BQU0sQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQzlHLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUU5RSxNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsaUJBQWlCLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztZQUNwRSxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDO1lBQ2hFLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUM7WUFDOUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxPQUFPLENBQUM7WUFDakQsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFFLENBQUM7WUFFeEUsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLGdCQUFnQixFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFFbkUsdUZBQXVGO1lBQ3ZGLHNGQUFzRjtZQUN0Rix1RkFBdUY7WUFDdkYsNkJBQTZCO1lBRTdCLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxpQkFBaUIsQ0FBVSxNQUFNLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDN0csSUFBSSxDQUFDLDhCQUE4QixDQUFDLGFBQWEsRUFBRSxVQUFVLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFDNUcsSUFBSSxDQUFDLGdDQUFnQyxDQUFDLGFBQWEsRUFBRSxXQUFXLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFFL0csTUFBTSxhQUFhLEdBQUcsSUFBSSxpQkFBaUIsQ0FBa0IsTUFBTSxDQUFDLGVBQWUsRUFBRSxNQUFNLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2pILElBQUksQ0FBQywyQkFBMkIsQ0FBQyxhQUFhLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxNQUFNLEVBQUUsaUJBQWlCLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixDQUFDLENBQUM7WUFDbkosSUFBSSxDQUFDLDRCQUE0QixDQUFDLGFBQWEsRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxpQkFBaUIsRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUNySixJQUFJLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDcEMsQ0FBQztJQUNGLENBQUM7SUFFTyw4QkFBOEIsQ0FDckMsYUFBdUMsRUFDdkMsVUFBdUIsRUFDdkIsZ0JBQTRDLEVBQzVDLE1BQXFCLEVBQ3JCLGlCQUF5QjtRQUV6QixJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsSUFBSSxJQUFJLENBQUMsZUFBZSxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUM7WUFDbkUsT0FBTztRQUNSLENBQUM7UUFFRCxhQUFhLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBRTNFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNYLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUVYLEtBQUssTUFBTSxTQUFTLElBQUksVUFBVSxFQUFFLENBQUM7WUFDcEMsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzdELElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFDbkIsc0NBQXNDO2dCQUN0QyxTQUFTO1lBQ1YsQ0FBQztZQUNELE1BQU0sQ0FBQyxlQUFlLEVBQUUsYUFBYSxDQUFDLEdBQUcsWUFBWSxDQUFDO1lBRXRELEtBQUssSUFBSSxJQUFJLEdBQUcsZUFBZSxFQUFFLElBQUksSUFBSSxhQUFhLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQztnQkFDaEUsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNsQyxDQUFDO1lBRUQsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLGlCQUFpQixDQUFDLGVBQWUsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1lBQ3pFLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztZQUV2RSxJQUFJLEVBQUUsSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDZixzQkFBc0I7Z0JBQ3RCLEVBQUUsR0FBRyxHQUFHLENBQUM7WUFDVixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUM7b0JBQ2IsUUFBUTtvQkFDUixhQUFhLENBQUMsUUFBUSxDQUFDLG9CQUFvQixFQUFFLEVBQUUsRUFBRSxhQUFhLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7Z0JBQ3ZGLENBQUM7Z0JBQ0QsRUFBRSxHQUFHLEdBQUcsQ0FBQztnQkFDVCxFQUFFLEdBQUcsR0FBRyxDQUFDO1lBQ1YsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQztZQUNiLFFBQVE7WUFDUixhQUFhLENBQUMsUUFBUSxDQUFDLG9CQUFvQixFQUFFLEVBQUUsRUFBRSxhQUFhLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDdkYsQ0FBQztJQUNGLENBQUM7SUFFTyxnQ0FBZ0MsQ0FDdkMsYUFBdUMsRUFDdkMsV0FBa0MsRUFDbEMsZ0JBQTRDLEVBQzVDLE1BQXFCLEVBQ3JCLGlCQUF5QjtRQUd6QixNQUFNLGVBQWUsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztRQUVsRCwrREFBK0Q7UUFDL0QsS0FBSyxJQUFJLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDbEQsTUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRWxDLE1BQU0sY0FBYyxHQUFxRCxVQUFVLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztZQUNwRyxJQUFJLENBQUMsY0FBYyxJQUFJLGNBQWMsQ0FBQyxRQUFRLG1DQUEyQixFQUFFLENBQUM7Z0JBQzNFLFNBQVM7WUFDVixDQUFDO1lBRUQsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLHFCQUFxQixDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNwRSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQ25CLHNDQUFzQztnQkFDdEMsU0FBUztZQUNWLENBQUM7WUFDRCxNQUFNLENBQUMsZUFBZSxFQUFFLGFBQWEsQ0FBQyxHQUFHLFlBQVksQ0FBQztZQUV0RCxNQUFNLGVBQWUsR0FBRyxjQUFjLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbkUsSUFBSSxDQUFDLGVBQWUsSUFBSSxlQUFlLENBQUMsYUFBYSxFQUFFLEVBQUUsQ0FBQztnQkFDekQsU0FBUztZQUNWLENBQUM7WUFFRCxJQUFJLGNBQWMsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ3JFLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFDckIsY0FBYyxHQUFHLGVBQWUsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQzdELGVBQWUsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1lBQ2pFLENBQUM7WUFFRCxhQUFhLENBQUMsU0FBUyxHQUFHLGNBQWMsQ0FBQztZQUN6QyxLQUFLLElBQUksSUFBSSxHQUFHLGVBQWUsRUFBRSxJQUFJLElBQUksYUFBYSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUM7Z0JBQ2hFLElBQUksZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQ2hDLFNBQVM7Z0JBQ1YsQ0FBQztnQkFDRCxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNqQyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLGlCQUFpQixDQUFDLENBQUM7Z0JBQzVELGFBQWEsQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFDaEcsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRU8sMkJBQTJCLENBQ2xDLGFBQXVDLEVBQ3ZDLFVBQXVCLEVBQ3ZCLGFBQWlELEVBQ2pELE1BQXFCLEVBQ3JCLFVBQWtCLEVBQ2xCLE9BQWUsRUFDZixjQUFzQixFQUN0QixnQkFBd0I7UUFFeEIsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxhQUFhLEVBQUUsRUFBRSxDQUFDO1lBQ25FLE9BQU87UUFDUixDQUFDO1FBQ0QsS0FBSyxNQUFNLFNBQVMsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUNwQyxNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMscUJBQXFCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDN0QsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO2dCQUNuQixzQ0FBc0M7Z0JBQ3RDLFNBQVM7WUFDVixDQUFDO1lBQ0QsTUFBTSxDQUFDLGVBQWUsRUFBRSxhQUFhLENBQUMsR0FBRyxZQUFZLENBQUM7WUFFdEQsS0FBSyxJQUFJLElBQUksR0FBRyxlQUFlLEVBQUUsSUFBSSxJQUFJLGFBQWEsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDO2dCQUNoRSxJQUFJLENBQUMsc0JBQXNCLENBQUMsYUFBYSxFQUFFLGFBQWEsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLGVBQWUsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQzdLLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVPLDRCQUE0QixDQUNuQyxhQUF1QyxFQUN2QyxXQUFrQyxFQUNsQyxhQUFpRCxFQUNqRCxNQUFxQixFQUNyQixpQkFBeUIsRUFDekIsT0FBZSxFQUNmLGNBQXNCLEVBQ3RCLGdCQUF3QjtRQUV4Qiw2REFBNkQ7UUFDN0QsS0FBSyxNQUFNLFVBQVUsSUFBSSxXQUFXLEVBQUUsQ0FBQztZQUV0QyxNQUFNLGNBQWMsR0FBcUQsVUFBVSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7WUFDcEcsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUNyQixTQUFTO1lBQ1YsQ0FBQztZQUVELE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDcEUsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO2dCQUNuQixzQ0FBc0M7Z0JBQ3RDLFNBQVM7WUFDVixDQUFDO1lBQ0QsTUFBTSxDQUFDLGVBQWUsRUFBRSxhQUFhLENBQUMsR0FBRyxZQUFZLENBQUM7WUFFdEQsTUFBTSxlQUFlLEdBQUcsY0FBYyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25FLElBQUksQ0FBQyxlQUFlLElBQUksZUFBZSxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUM7Z0JBQ3pELFNBQVM7WUFDVixDQUFDO1lBRUQsS0FBSyxJQUFJLElBQUksR0FBRyxlQUFlLEVBQUUsSUFBSSxJQUFJLGFBQWEsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDO2dCQUNoRSxRQUFRLGNBQWMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFFakM7d0JBQ0MsSUFBSSxDQUFDLHNCQUFzQixDQUFDLGFBQWEsRUFBRSxhQUFhLEVBQUUsVUFBVSxDQUFDLEtBQUssRUFBRSxlQUFlLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLGdCQUFnQixDQUFDLENBQUM7d0JBQzVMLFNBQVM7b0JBRVYsbUNBQTJCLENBQUMsQ0FBQyxDQUFDO3dCQUM3QixNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLGlCQUFpQixDQUFDLENBQUM7d0JBQzVELE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQzt3QkFDWixJQUFJLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLGVBQWUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLHVCQUF1QixFQUFFLGlCQUFpQixDQUFDLENBQUM7d0JBQ3hHLFNBQVM7b0JBQ1YsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRU8sc0JBQXNCLENBQzdCLGFBQXVDLEVBQ3ZDLGFBQWlELEVBQ2pELGVBQXNCLEVBQ3RCLGVBQWtDLEVBQ2xDLE1BQXFCLEVBQ3JCLFVBQWtCLEVBQ2xCLE1BQWMsRUFDZCxpQkFBeUIsRUFDekIsT0FBZSxFQUNmLFNBQWlCLEVBQ2pCLGdCQUF3QjtRQUV4QixNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsaUJBQWlCLENBQUMsVUFBVSxFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFFbEUsa0VBQWtFO1FBQ2xFLElBQUksQ0FBQyxHQUFHLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDakUsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLEVBQUUsZUFBZSxFQUFFLGFBQWEsRUFBRSxHQUFHLGVBQWUsQ0FBQztRQUMzRCxNQUFNLFdBQVcsR0FBRyxDQUFDLGVBQWUsS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3ZGLE1BQU0sU0FBUyxHQUFHLENBQUMsYUFBYSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBRXhILE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxhQUFhLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDcEgsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLGFBQWEsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUVsSCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLGVBQWUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDL0UsQ0FBQztJQUVPLHFCQUFxQixDQUM1QixhQUFpRCxFQUNqRCxVQUFrQixFQUNsQixNQUFjLEVBQ2QsT0FBZSxFQUNmLFNBQWlCLEVBQ2pCLGdCQUF3QjtRQUV4QixJQUFJLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNsQixPQUFPLG9CQUFvQixDQUFDO1FBQzdCLENBQUM7UUFFRCxNQUFNLGNBQWMsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUM7UUFDaEQsSUFBSSxjQUFjLElBQUksZ0JBQWdCLEVBQUUsQ0FBQztZQUN4QyxpREFBaUQ7WUFDakQsc0RBQXNEO1lBQ3RELE9BQU8sZ0JBQWdCLENBQUM7UUFDekIsQ0FBQztRQUVELCtEQUErRDtRQUMvRCxJQUFJLGtCQUFrQixHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDdkQsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDekIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDeEQsa0JBQWtCLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1lBQzVDLElBQUksS0FBSyxHQUFHLG9CQUFvQixDQUFDO1lBQ2pDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUM5QyxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDNUMsTUFBTSxFQUFFLEdBQUcsUUFBUSx5QkFBaUI7b0JBQ25DLENBQUMsQ0FBQyxPQUFPLEdBQUcsU0FBUztvQkFDckIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUM7d0JBQ3ZDLENBQUMsQ0FBQyxDQUFDLEdBQUcsU0FBUzt3QkFDZixDQUFDLENBQUMsU0FBUyxDQUFDO2dCQUVkLE1BQU0sQ0FBQyxHQUFHLEtBQUssR0FBRyxFQUFFLENBQUM7Z0JBQ3JCLElBQUksQ0FBQyxJQUFJLGdCQUFnQixFQUFFLENBQUM7b0JBQzNCLDBEQUEwRDtvQkFDMUQsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLEdBQUcsZ0JBQWdCLENBQUM7b0JBQ3pDLE1BQU07Z0JBQ1AsQ0FBQztnQkFFRCxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQzFCLEtBQUssR0FBRyxDQUFDLENBQUM7WUFDWCxDQUFDO1lBRUQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUNuRCxDQUFDO1FBRUQsSUFBSSxNQUFNLEdBQUcsQ0FBQyxHQUFHLGtCQUFrQixDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzVDLE9BQU8sa0JBQWtCLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3ZDLENBQUM7UUFDRCw2QkFBNkI7UUFDN0IsT0FBTyxnQkFBZ0IsQ0FBQztJQUN6QixDQUFDO0lBRU8sZ0JBQWdCLENBQUMsYUFBdUMsRUFBRSxlQUFrQyxFQUFFLENBQVMsRUFBRSxDQUFTLEVBQUUsS0FBYSxFQUFFLE1BQWM7UUFDeEosYUFBYSxDQUFDLFNBQVMsR0FBRyxlQUFlLElBQUksZUFBZSxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUM5RSxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxNQUFxQjtRQUNsRCxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDO1FBQ2hFLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUM7UUFDeEUsTUFBTSwwQkFBMEIsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQywwQkFBMEIsQ0FBQztRQUNsRixNQUFNLG9CQUFvQixHQUFHLHFCQUFxQixHQUFHLEdBQUcsQ0FBQztRQUN6RCxNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztRQUVqRCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUM7UUFDNUQsTUFBTSxjQUFjLEdBQUcsT0FBTyxlQUFlLENBQUMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxDQUFDLElBQUksZUFBZSxDQUFDLENBQUMsUUFBUSxDQUFDO1FBQ2xHLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLHNCQUFzQixDQUFDO1FBQ25FLE1BQU0sY0FBYyxHQUFHLE9BQU8sZUFBZSxDQUFDLENBQUMsSUFBSSxlQUFlLENBQUMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxDQUFDLEdBQUcsQ0FBQztRQUM3RixNQUFNLGVBQWUsR0FBRyxjQUFjLENBQUM7UUFFdkMsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFFLENBQUM7UUFDeEUsYUFBYSxDQUFDLGFBQWEsR0FBRywwQkFBMEIsR0FBRyxJQUFJLENBQUM7UUFDaEUsYUFBYSxDQUFDLElBQUksR0FBRyxNQUFNLEdBQUcscUJBQXFCLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLHVCQUF1QixDQUFDO1FBQzFHLGFBQWEsQ0FBQyxXQUFXLEdBQUcsZUFBZSxDQUFDO1FBQzVDLGFBQWEsQ0FBQyxTQUFTLEdBQUcsR0FBRyxDQUFDO1FBRTlCLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMscUNBQXFDLENBQUMsTUFBTSxDQUFDLGVBQWUsRUFBRSxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDcEgsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUM7UUFFOUUsTUFBTSxRQUFRLEdBQUcsWUFBWSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUN2RSxnQkFBZ0IsR0FBRyxvQkFBb0IsQ0FBQyxDQUFDO1FBRTFDLEtBQUssTUFBTSxVQUFVLElBQUksV0FBVyxFQUFFLENBQUM7WUFDdEMsTUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsZUFBZSxFQUFFLGlCQUFpQixDQUFDLEdBQUcscUJBQXFCLENBQUM7WUFDaEgsTUFBTSxlQUFlLEdBQUcsQ0FBQyxHQUFHLHFCQUFxQixDQUFDO1lBQ2xELE1BQU0sVUFBVSxHQUFHLGVBQWUsR0FBRyxDQUFDLENBQUM7WUFDdkMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFFMUUsWUFBWSxDQUFDLG1CQUFtQixDQUMvQixhQUFhLEVBQ2IsVUFBVSxFQUNWLFVBQVUsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGtCQUFrQixpREFBeUMsRUFDdkYsY0FBYyxFQUNkLGNBQWMsRUFDZCxnQkFBZ0IsRUFDaEIsZUFBZSxFQUNmLG9CQUFvQixFQUNwQixDQUFDLEVBQ0QsVUFBVSxDQUFDLENBQUM7UUFDZCxDQUFDO0lBQ0YsQ0FBQztJQUVPLE1BQU0sQ0FBQyxpQkFBaUIsQ0FDL0IsTUFBZ0MsRUFDaEMsUUFBZ0IsRUFDaEIsVUFBa0I7UUFFbEIsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2pCLE9BQU8sVUFBVSxDQUFDO1FBQ25CLENBQUM7UUFFRCxNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUM7UUFDckIsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFDbkQsTUFBTSxhQUFhLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFFekQsSUFBSSxLQUFLLElBQUksUUFBUSxJQUFJLEtBQUssSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUNqRCxPQUFPLFVBQVUsQ0FBQztRQUNuQixDQUFDO1FBRUQsTUFBTSxHQUFHLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQztRQUM5QixNQUFNLGdCQUFnQixHQUFHLEtBQUssR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDO1FBQ25ELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLEdBQUcsYUFBYSxDQUFDLEdBQUcsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFbkYsbURBQW1EO1FBQ25ELElBQUksYUFBYSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2hELE9BQU8sYUFBYSxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ3RFLEVBQUUsYUFBYSxDQUFDO1FBQ2pCLENBQUM7UUFFRCxzQkFBc0I7UUFDdEIsT0FBTyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUM7Y0FDMUMsUUFBUSxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLENBQUMsWUFBWSxHQUFHLGFBQWEsQ0FBQyxDQUFDLENBQUM7SUFDMUUsQ0FBQztJQUVPLE1BQU0sQ0FBQyxtQkFBbUIsQ0FDakMsTUFBZ0MsRUFDaEMsVUFBeUIsRUFDekIsZ0JBQXlCLEVBQ3pCLGNBQXNCLEVBQ3RCLGNBQXNCLEVBQ3RCLFlBQW9CLEVBQ3BCLGVBQXVCLEVBQ3ZCLG9CQUE0QixFQUM1QixLQUFhLEVBQ2IsVUFBa0I7UUFFbEIsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUNoQixNQUFNLENBQUMsU0FBUyxHQUFHLGNBQWMsQ0FBQztZQUNsQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFFeEUsTUFBTSxDQUFDLFNBQVMsR0FBRyxjQUFjLENBQUM7WUFDbEMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsb0JBQW9CLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDMUQsQ0FBQztRQUVELElBQUksZ0JBQWdCLEVBQUUsQ0FBQztZQUN0QixNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDbkIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDN0IsTUFBTSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDeEMsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ25CLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNqQixDQUFDO0lBQ0YsQ0FBQztJQUVPLFdBQVcsQ0FBQyxNQUFxQjtRQUN4QyxNQUFNLGVBQWUsR0FBRyxNQUFNLENBQUMsZUFBZSxDQUFDO1FBQy9DLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxhQUFhLENBQUM7UUFDM0MsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztRQUVoRSx3REFBd0Q7UUFDeEQsSUFBSSxJQUFJLENBQUMsZUFBZSxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDdEUsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUM5Qyx5Q0FBeUM7WUFDekMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDckUsQ0FBQztRQUVELDZDQUE2QztRQUU3QyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDcEMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2hCLDRDQUE0QztZQUM1QyxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFFRCxzREFBc0Q7UUFDdEQsTUFBTSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLEdBQUcsWUFBWSxDQUFDLHFCQUFxQixDQUN0RSxTQUFTLEVBQ1QsTUFBTSxDQUFDLG1CQUFtQixFQUMxQixlQUFlLEVBQ2YsYUFBYSxFQUNiLGlCQUFpQixFQUNqQixJQUFJLENBQUMsZUFBZSxDQUNwQixDQUFDO1FBRUYsOEVBQThFO1FBQzlFLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsNEJBQTRCLENBQUMsZUFBZSxFQUFFLGFBQWEsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNsRyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDLE9BQU8sQ0FBQztRQUNqRCxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLHNCQUFzQixDQUFDO1FBQ3JFLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQztRQUN2RCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUM7UUFDNUQsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLGtCQUFrQixDQUFDO1FBQzFELE1BQU0sY0FBYyxHQUFHLGtCQUFrQixDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDOUQsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDO1FBQ3hELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3hELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQztRQUNoRCxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDO1FBRTlELE1BQU0sY0FBYyxHQUFHLENBQUMsYUFBYSwrQkFBdUIsQ0FBQyxDQUFDLG9DQUE0QixDQUFDLENBQUMscUNBQTZCLENBQUMsQ0FBQyxDQUFDO1FBQzVILE1BQU0sdUJBQXVCLEdBQUcsY0FBYyxHQUFHLFNBQVMsQ0FBQztRQUMzRCxNQUFNLGdCQUFnQixHQUFHLENBQUMsaUJBQWlCLEdBQUcsdUJBQXVCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxpQkFBaUIsR0FBRyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUUzSSwyQkFBMkI7UUFDM0IsTUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUM7UUFDdkMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLEtBQUssQ0FDakMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLEdBQUcsV0FBVyxHQUFHLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxFQUNwRixJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsR0FBRyxXQUFXLEdBQUcsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLEVBQ3BGLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxHQUFHLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsRUFDcEYsR0FBRyxDQUNILENBQUM7UUFDRixJQUFJLEVBQUUsR0FBRyxNQUFNLENBQUMsbUJBQW1CLEdBQUcsaUJBQWlCLENBQUM7UUFDeEQsTUFBTSxhQUFhLEdBQWtCLEVBQUUsQ0FBQztRQUN4QyxLQUFLLElBQUksU0FBUyxHQUFHLENBQUMsRUFBRSxTQUFTLEdBQUcsYUFBYSxHQUFHLGVBQWUsR0FBRyxDQUFDLEVBQUUsU0FBUyxHQUFHLFNBQVMsRUFBRSxTQUFTLEVBQUUsRUFBRSxDQUFDO1lBQzdHLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3ZCLFlBQVksQ0FBQyxXQUFXLENBQ3ZCLFNBQVMsRUFDVCxnQkFBZ0IsRUFDaEIsVUFBVSxDQUFDLENBQUMsRUFDWixjQUFjLEVBQ2QsYUFBYSxFQUNiLGdCQUFnQixFQUNoQixrQkFBa0IsRUFDbEIsZUFBZSxFQUNmLFlBQVksRUFDWixFQUFFLEVBQ0YsZ0JBQWdCLEVBQ2hCLE9BQU8sRUFDUCxRQUFRLENBQUMsU0FBUyxDQUFFLEVBQ3BCLFNBQVMsRUFDVCxpQkFBaUIsQ0FDakIsQ0FBQztZQUNILENBQUM7WUFDRCxhQUFhLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxXQUFXLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDL0MsRUFBRSxJQUFJLGlCQUFpQixDQUFDO1FBQ3pCLENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBRyxDQUFDLFFBQVEsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNqRCxNQUFNLE9BQU8sR0FBRyxDQUFDLFFBQVEsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDaEUsTUFBTSxXQUFXLEdBQUcsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUV0QywrQkFBK0I7UUFDL0IsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBRSxDQUFDO1FBQ25ELEdBQUcsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE9BQU8sRUFBRSxTQUFTLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBRTVFLHlEQUF5RDtRQUN6RCxPQUFPLElBQUksVUFBVSxDQUNwQixNQUFNLEVBQ04sU0FBUyxFQUNULGFBQWEsQ0FDYixDQUFDO0lBQ0gsQ0FBQztJQUVPLE1BQU0sQ0FBQyxxQkFBcUIsQ0FDbkMsTUFBaUIsRUFDakIsbUJBQTJCLEVBQzNCLGVBQXVCLEVBQ3ZCLGFBQXFCLEVBQ3JCLGlCQUF5QixFQUN6QixjQUFpQztRQUdqQyxNQUFNLE1BQU0sR0FBYyxFQUFFLENBQUM7UUFDN0IsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3JCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxhQUFhLEdBQUcsZUFBZSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ3pFLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7WUFDbEIsQ0FBQztZQUNELE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN6QixDQUFDO1FBRUQsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3hDLE1BQU0sY0FBYyxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ2hELE1BQU0sbUJBQW1CLEdBQUcsU0FBUyxDQUFDLG1CQUFtQixDQUFDO1FBQzFELE1BQU0sU0FBUyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUM7UUFDbEMsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQztRQUN6QyxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDO1FBQzNCLE1BQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFFL0IsTUFBTSxZQUFZLEdBQUcsQ0FBQyxhQUFhLEdBQUcsZUFBZSxHQUFHLENBQUMsQ0FBQyxHQUFHLGlCQUFpQixHQUFHLEtBQUssR0FBRyxDQUFDLENBQUM7UUFDM0YsSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyx1RUFBdUU7UUFDN0YsSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyx1RUFBdUU7UUFFN0YsSUFBSSxlQUFlLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDekIsSUFBSSxhQUFhLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdkIsSUFBSSxhQUFhLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdkIsSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFFckIsSUFBSSxPQUFPLEdBQUcsbUJBQW1CLEdBQUcsaUJBQWlCLENBQUM7UUFDdEQsS0FBSyxJQUFJLFVBQVUsR0FBRyxlQUFlLEVBQUUsVUFBVSxJQUFJLGFBQWEsRUFBRSxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBQ2xGLE1BQU0sU0FBUyxHQUFHLFVBQVUsR0FBRyxlQUFlLENBQUM7WUFDL0MsTUFBTSxhQUFhLEdBQUcsVUFBVSxHQUFHLG1CQUFtQixDQUFDO1lBQ3ZELE1BQU0sU0FBUyxHQUFHLENBQUMsYUFBYSxJQUFJLENBQUMsSUFBSSxhQUFhLEdBQUcsZUFBZSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRTdHLElBQUksU0FBUyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3RCLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUM7Z0JBQ3pCLE9BQU8sSUFBSSxpQkFBaUIsQ0FBQztnQkFDN0IsU0FBUztZQUNWLENBQUM7WUFFRCxNQUFNLFdBQVcsR0FBRyxTQUFTLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQztZQUMxQyxNQUFNLFNBQVMsR0FBRyxDQUFDLFNBQVMsR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDLENBQUM7WUFDOUQsTUFBTSxTQUFTLEdBQUcsT0FBTyxHQUFHLEtBQUssR0FBRyxDQUFDLENBQUM7WUFDdEMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxPQUFPLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxLQUFLLEdBQUcsQ0FBQyxDQUFDO1lBRTFELElBQUksYUFBYSxLQUFLLFdBQVcsSUFBSSxXQUFXLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQ2hFLHlDQUF5QztnQkFDekMsYUFBYSxHQUFHLFNBQVMsQ0FBQztnQkFDMUIsV0FBVyxHQUFHLE9BQU8sQ0FBQztZQUN2QixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsSUFBSSxlQUFlLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDNUIsOEJBQThCO29CQUM5QixVQUFVLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsZUFBZSxFQUFFLGFBQWEsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDO29CQUN2RixJQUFJLFdBQVcsS0FBSyxDQUFDLENBQUMsSUFBSSxlQUFlLEtBQUssQ0FBQyxJQUFJLGVBQWUsS0FBSyxhQUFhLEVBQUUsQ0FBQzt3QkFDdEYsV0FBVyxHQUFHLGFBQWEsQ0FBQztvQkFDN0IsQ0FBQztvQkFDRCxJQUFJLFdBQVcsS0FBSyxDQUFDLENBQUMsSUFBSSxhQUFhLEtBQUssWUFBWSxJQUFJLGVBQWUsS0FBSyxhQUFhLEVBQUUsQ0FBQzt3QkFDL0YsV0FBVyxHQUFHLGVBQWUsQ0FBQztvQkFDL0IsQ0FBQztnQkFDRixDQUFDO2dCQUNELGVBQWUsR0FBRyxXQUFXLENBQUM7Z0JBQzlCLGFBQWEsR0FBRyxTQUFTLENBQUM7Z0JBQzFCLGFBQWEsR0FBRyxTQUFTLENBQUM7Z0JBQzFCLFdBQVcsR0FBRyxPQUFPLENBQUM7WUFDdkIsQ0FBQztZQUVELE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxLQUFLLENBQUM7WUFDMUIsT0FBTyxJQUFJLGlCQUFpQixDQUFDO1FBQzlCLENBQUM7UUFFRCxJQUFJLGVBQWUsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQzVCLDhCQUE4QjtZQUM5QixVQUFVLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsZUFBZSxFQUFFLGFBQWEsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1lBQ3ZGLElBQUksV0FBVyxLQUFLLENBQUMsQ0FBQyxJQUFJLGVBQWUsS0FBSyxDQUFDLElBQUksZUFBZSxLQUFLLGFBQWEsRUFBRSxDQUFDO2dCQUN0RixXQUFXLEdBQUcsYUFBYSxDQUFDO1lBQzdCLENBQUM7WUFDRCxJQUFJLFdBQVcsS0FBSyxDQUFDLENBQUMsSUFBSSxhQUFhLEtBQUssWUFBWSxJQUFJLGVBQWUsS0FBSyxhQUFhLEVBQUUsQ0FBQztnQkFDL0YsV0FBVyxHQUFHLGVBQWUsQ0FBQztZQUMvQixDQUFDO1FBQ0YsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLENBQUMsV0FBVyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxHQUFHLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdEUsTUFBTSxPQUFPLEdBQUcsQ0FBQyxXQUFXLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEdBQUcsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUV0RSxPQUFPLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRU8sTUFBTSxDQUFDLFdBQVcsQ0FDekIsTUFBaUIsRUFDakIsZUFBc0IsRUFDdEIsZUFBdUIsRUFDdkIsY0FBdUIsRUFDdkIsYUFBNEIsRUFDNUIsU0FBaUIsRUFDakIsWUFBdUMsRUFDdkMsZUFBdUIsRUFDdkIsbUJBQXdDLEVBQ3hDLEVBQVUsRUFDVixnQkFBd0IsRUFDeEIsT0FBZSxFQUNmLFFBQXNCLEVBQ3RCLFNBQWlCLEVBQ2pCLGlCQUF5QjtRQUV6QixNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDO1FBQ2pDLE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUM7UUFDL0IsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssR0FBRyxTQUFTLENBQUM7UUFDdkMsTUFBTSxjQUFjLEdBQUcsQ0FBQyxpQkFBaUIsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUVqRCxJQUFJLEVBQUUsR0FBRyxvQkFBb0IsQ0FBQztRQUM5QixJQUFJLFNBQVMsR0FBRyxDQUFDLENBQUM7UUFDbEIsSUFBSSxhQUFhLEdBQUcsQ0FBQyxDQUFDO1FBRXRCLEtBQUssSUFBSSxVQUFVLEdBQUcsQ0FBQyxFQUFFLFNBQVMsR0FBRyxNQUFNLENBQUMsUUFBUSxFQUFFLEVBQUUsVUFBVSxHQUFHLFNBQVMsRUFBRSxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBQzlGLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDdEQsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUN0RCxNQUFNLFVBQVUsR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBRXZELE9BQU8sU0FBUyxHQUFHLGFBQWEsRUFBRSxTQUFTLEVBQUUsRUFBRSxDQUFDO2dCQUMvQyxJQUFJLEVBQUUsR0FBRyxLQUFLLEVBQUUsQ0FBQztvQkFDaEIsc0JBQXNCO29CQUN0QixPQUFPO2dCQUNSLENBQUM7Z0JBQ0QsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFFL0MsSUFBSSxRQUFRLHlCQUFpQixFQUFFLENBQUM7b0JBQy9CLE1BQU0saUJBQWlCLEdBQUcsT0FBTyxHQUFHLENBQUMsU0FBUyxHQUFHLGFBQWEsQ0FBQyxHQUFHLE9BQU8sQ0FBQztvQkFDMUUsYUFBYSxJQUFJLGlCQUFpQixHQUFHLENBQUMsQ0FBQztvQkFDdkMsb0RBQW9EO29CQUNwRCxFQUFFLElBQUksaUJBQWlCLEdBQUcsU0FBUyxDQUFDO2dCQUNyQyxDQUFDO3FCQUFNLElBQUksUUFBUSw0QkFBbUIsRUFBRSxDQUFDO29CQUN4QyxzREFBc0Q7b0JBQ3RELEVBQUUsSUFBSSxTQUFTLENBQUM7Z0JBQ2pCLENBQUM7cUJBQU0sQ0FBQztvQkFDUCwwQ0FBMEM7b0JBQzFDLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBRTdELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQzt3QkFDaEMsSUFBSSxhQUFhLGlDQUF5QixFQUFFLENBQUM7NEJBQzVDLG1CQUFtQixDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxnQkFBZ0IsRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQUUsY0FBYyxDQUFDLENBQUM7d0JBQ3ZKLENBQUM7NkJBQU0sQ0FBQyxDQUFDLHFCQUFxQjs0QkFDN0IsbUJBQW1CLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxjQUFjLENBQUMsQ0FBQzt3QkFDdkwsQ0FBQzt3QkFFRCxFQUFFLElBQUksU0FBUyxDQUFDO3dCQUVoQixJQUFJLEVBQUUsR0FBRyxLQUFLLEVBQUUsQ0FBQzs0QkFDaEIsc0JBQXNCOzRCQUN0QixPQUFPO3dCQUNSLENBQUM7b0JBQ0YsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0NBQ0Q7QUFFRCxNQUFNLGlCQUFpQjtJQU90QixZQUFZLGVBQXVCLEVBQUUsYUFBcUIsRUFBRSxZQUFlO1FBQzFFLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxlQUFlLENBQUM7UUFDeEMsSUFBSSxDQUFDLGNBQWMsR0FBRyxhQUFhLENBQUM7UUFDcEMsSUFBSSxDQUFDLGFBQWEsR0FBRyxZQUFZLENBQUM7UUFDbEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFDbEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsS0FBSyxHQUFHLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDekYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUM7UUFDaEMsQ0FBQztJQUNGLENBQUM7SUFFTSxHQUFHLENBQUMsVUFBa0I7UUFDNUIsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEtBQUssSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFTSxHQUFHLENBQUMsVUFBa0IsRUFBRSxLQUFRO1FBQ3RDLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQzVFLE9BQU87UUFDUixDQUFDO1FBQ0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsS0FBSyxDQUFDO0lBQzFELENBQUM7SUFFTSxHQUFHLENBQUMsVUFBa0I7UUFDNUIsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDNUUsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDO1FBQzNCLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ3pELENBQUM7Q0FDRCJ9