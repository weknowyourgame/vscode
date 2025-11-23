/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { MOUSE_CURSOR_TEXT_CSS_CLASS_NAME } from '../../../../base/browser/ui/mouseCursor/mouseCursor.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import * as platform from '../../../../base/common/platform.js';
import './viewLines.css';
import { applyFontInfo } from '../../config/domFontInfo.js';
import { HorizontalPosition, HorizontalRange, LineVisibleRanges } from '../../view/renderingContext.js';
import { VisibleLinesCollection } from '../../view/viewLayer.js';
import { PartFingerprints, ViewPart } from '../../view/viewPart.js';
import { DomReadingContext } from './domReadingContext.js';
import { ViewLine } from './viewLine.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import { ViewLineOptions } from './viewLineOptions.js';
import { TextDirection } from '../../../common/model.js';
class LastRenderedData {
    constructor() {
        this._currentVisibleRange = new Range(1, 1, 1, 1);
    }
    getCurrentVisibleRange() {
        return this._currentVisibleRange;
    }
    setCurrentVisibleRange(currentVisibleRange) {
        this._currentVisibleRange = currentVisibleRange;
    }
}
class HorizontalRevealRangeRequest {
    constructor(minimalReveal, lineNumber, startColumn, endColumn, startScrollTop, stopScrollTop, scrollType) {
        this.minimalReveal = minimalReveal;
        this.lineNumber = lineNumber;
        this.startColumn = startColumn;
        this.endColumn = endColumn;
        this.startScrollTop = startScrollTop;
        this.stopScrollTop = stopScrollTop;
        this.scrollType = scrollType;
        this.type = 'range';
        this.minLineNumber = lineNumber;
        this.maxLineNumber = lineNumber;
    }
}
class HorizontalRevealSelectionsRequest {
    constructor(minimalReveal, selections, startScrollTop, stopScrollTop, scrollType) {
        this.minimalReveal = minimalReveal;
        this.selections = selections;
        this.startScrollTop = startScrollTop;
        this.stopScrollTop = stopScrollTop;
        this.scrollType = scrollType;
        this.type = 'selections';
        let minLineNumber = selections[0].startLineNumber;
        let maxLineNumber = selections[0].endLineNumber;
        for (let i = 1, len = selections.length; i < len; i++) {
            const selection = selections[i];
            minLineNumber = Math.min(minLineNumber, selection.startLineNumber);
            maxLineNumber = Math.max(maxLineNumber, selection.endLineNumber);
        }
        this.minLineNumber = minLineNumber;
        this.maxLineNumber = maxLineNumber;
    }
}
/**
 * The view lines part is responsible for rendering the actual content of a
 * file.
 */
export class ViewLines extends ViewPart {
    /**
     * Adds this amount of pixels to the right of lines (no-one wants to type near the edge of the viewport)
     */
    static { this.HORIZONTAL_EXTRA_PX = 30; }
    constructor(context, viewGpuContext, linesContent) {
        super(context);
        const conf = this._context.configuration;
        const options = this._context.configuration.options;
        const fontInfo = options.get(59 /* EditorOption.fontInfo */);
        const wrappingInfo = options.get(166 /* EditorOption.wrappingInfo */);
        this._lineHeight = options.get(75 /* EditorOption.lineHeight */);
        this._typicalHalfwidthCharacterWidth = fontInfo.typicalHalfwidthCharacterWidth;
        this._isViewportWrapping = wrappingInfo.isViewportWrapping;
        this._revealHorizontalRightPadding = options.get(114 /* EditorOption.revealHorizontalRightPadding */);
        this._cursorSurroundingLines = options.get(35 /* EditorOption.cursorSurroundingLines */);
        this._cursorSurroundingLinesStyle = options.get(36 /* EditorOption.cursorSurroundingLinesStyle */);
        this._canUseLayerHinting = !options.get(39 /* EditorOption.disableLayerHinting */);
        this._viewLineOptions = new ViewLineOptions(conf, this._context.theme.type);
        this._linesContent = linesContent;
        this._textRangeRestingSpot = document.createElement('div');
        this._visibleLines = new VisibleLinesCollection(this._context, {
            createLine: () => new ViewLine(viewGpuContext, this._viewLineOptions),
        });
        this.domNode = this._visibleLines.domNode;
        PartFingerprints.write(this.domNode, 8 /* PartFingerprint.ViewLines */);
        this.domNode.setClassName(`view-lines ${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`);
        applyFontInfo(this.domNode, fontInfo);
        // --- width & height
        this._maxLineWidth = 0;
        this._asyncUpdateLineWidths = new RunOnceScheduler(() => {
            this._updateLineWidthsSlow();
        }, 200);
        this._asyncCheckMonospaceFontAssumptions = new RunOnceScheduler(() => {
            this._checkMonospaceFontAssumptions();
        }, 2000);
        this._lastRenderedData = new LastRenderedData();
        this._horizontalRevealRequest = null;
        // sticky scroll widget
        this._stickyScrollEnabled = options.get(131 /* EditorOption.stickyScroll */).enabled;
        this._maxNumberStickyLines = options.get(131 /* EditorOption.stickyScroll */).maxLineCount;
    }
    dispose() {
        this._asyncUpdateLineWidths.dispose();
        this._asyncCheckMonospaceFontAssumptions.dispose();
        super.dispose();
    }
    getDomNode() {
        return this.domNode;
    }
    // ---- begin view event handlers
    onConfigurationChanged(e) {
        this._visibleLines.onConfigurationChanged(e);
        if (e.hasChanged(166 /* EditorOption.wrappingInfo */)) {
            this._maxLineWidth = 0;
        }
        const options = this._context.configuration.options;
        const fontInfo = options.get(59 /* EditorOption.fontInfo */);
        const wrappingInfo = options.get(166 /* EditorOption.wrappingInfo */);
        this._lineHeight = options.get(75 /* EditorOption.lineHeight */);
        this._typicalHalfwidthCharacterWidth = fontInfo.typicalHalfwidthCharacterWidth;
        this._isViewportWrapping = wrappingInfo.isViewportWrapping;
        this._revealHorizontalRightPadding = options.get(114 /* EditorOption.revealHorizontalRightPadding */);
        this._cursorSurroundingLines = options.get(35 /* EditorOption.cursorSurroundingLines */);
        this._cursorSurroundingLinesStyle = options.get(36 /* EditorOption.cursorSurroundingLinesStyle */);
        this._canUseLayerHinting = !options.get(39 /* EditorOption.disableLayerHinting */);
        // sticky scroll
        this._stickyScrollEnabled = options.get(131 /* EditorOption.stickyScroll */).enabled;
        this._maxNumberStickyLines = options.get(131 /* EditorOption.stickyScroll */).maxLineCount;
        applyFontInfo(this.domNode, fontInfo);
        this._onOptionsMaybeChanged();
        if (e.hasChanged(165 /* EditorOption.layoutInfo */)) {
            this._maxLineWidth = 0;
        }
        return true;
    }
    _onOptionsMaybeChanged() {
        const conf = this._context.configuration;
        const newViewLineOptions = new ViewLineOptions(conf, this._context.theme.type);
        if (!this._viewLineOptions.equals(newViewLineOptions)) {
            this._viewLineOptions = newViewLineOptions;
            const startLineNumber = this._visibleLines.getStartLineNumber();
            const endLineNumber = this._visibleLines.getEndLineNumber();
            for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
                const line = this._visibleLines.getVisibleLine(lineNumber);
                line.onOptionsChanged(this._viewLineOptions);
            }
            return true;
        }
        return false;
    }
    onCursorStateChanged(e) {
        const rendStartLineNumber = this._visibleLines.getStartLineNumber();
        const rendEndLineNumber = this._visibleLines.getEndLineNumber();
        let r = false;
        for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
            r = this._visibleLines.getVisibleLine(lineNumber).onSelectionChanged() || r;
        }
        return r;
    }
    onDecorationsChanged(e) {
        const rendStartLineNumber = this._visibleLines.getStartLineNumber();
        const rendEndLineNumber = this._visibleLines.getEndLineNumber();
        for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
            this._visibleLines.getVisibleLine(lineNumber).onDecorationsChanged();
        }
        return true;
    }
    onFlushed(e) {
        const shouldRender = this._visibleLines.onFlushed(e, this._viewLineOptions.useGpu);
        this._maxLineWidth = 0;
        return shouldRender;
    }
    onLinesChanged(e) {
        return this._visibleLines.onLinesChanged(e);
    }
    onLinesDeleted(e) {
        return this._visibleLines.onLinesDeleted(e);
    }
    onLinesInserted(e) {
        return this._visibleLines.onLinesInserted(e);
    }
    onRevealRangeRequest(e) {
        // Using the future viewport here in order to handle multiple
        // incoming reveal range requests that might all desire to be animated
        const desiredScrollTop = this._computeScrollTopToRevealRange(this._context.viewLayout.getFutureViewport(), e.source, e.minimalReveal, e.range, e.selections, e.verticalType);
        if (desiredScrollTop === -1) {
            // marker to abort the reveal range request
            return false;
        }
        // validate the new desired scroll top
        let newScrollPosition = this._context.viewLayout.validateScrollPosition({ scrollTop: desiredScrollTop });
        if (e.revealHorizontal) {
            if (e.range && e.range.startLineNumber !== e.range.endLineNumber) {
                // Two or more lines? => scroll to base (That's how you see most of the two lines)
                newScrollPosition = {
                    scrollTop: newScrollPosition.scrollTop,
                    scrollLeft: 0
                };
            }
            else if (e.range) {
                // We don't necessarily know the horizontal offset of this range since the line might not be in the view...
                this._horizontalRevealRequest = new HorizontalRevealRangeRequest(e.minimalReveal, e.range.startLineNumber, e.range.startColumn, e.range.endColumn, this._context.viewLayout.getCurrentScrollTop(), newScrollPosition.scrollTop, e.scrollType);
            }
            else if (e.selections && e.selections.length > 0) {
                this._horizontalRevealRequest = new HorizontalRevealSelectionsRequest(e.minimalReveal, e.selections, this._context.viewLayout.getCurrentScrollTop(), newScrollPosition.scrollTop, e.scrollType);
            }
        }
        else {
            this._horizontalRevealRequest = null;
        }
        const scrollTopDelta = Math.abs(this._context.viewLayout.getCurrentScrollTop() - newScrollPosition.scrollTop);
        const scrollType = (scrollTopDelta <= this._lineHeight ? 1 /* ScrollType.Immediate */ : e.scrollType);
        this._context.viewModel.viewLayout.setScrollPosition(newScrollPosition, scrollType);
        return true;
    }
    onScrollChanged(e) {
        if (this._horizontalRevealRequest && e.scrollLeftChanged) {
            // cancel any outstanding horizontal reveal request if someone else scrolls horizontally.
            this._horizontalRevealRequest = null;
        }
        if (this._horizontalRevealRequest && e.scrollTopChanged) {
            const min = Math.min(this._horizontalRevealRequest.startScrollTop, this._horizontalRevealRequest.stopScrollTop);
            const max = Math.max(this._horizontalRevealRequest.startScrollTop, this._horizontalRevealRequest.stopScrollTop);
            if (e.scrollTop < min || e.scrollTop > max) {
                // cancel any outstanding horizontal reveal request if someone else scrolls vertically.
                this._horizontalRevealRequest = null;
            }
        }
        this.domNode.setWidth(e.scrollWidth);
        return this._visibleLines.onScrollChanged(e) || e.scrollTopChanged || e.scrollLeftChanged;
    }
    onTokensChanged(e) {
        return this._visibleLines.onTokensChanged(e);
    }
    onZonesChanged(e) {
        this._context.viewModel.viewLayout.setMaxLineWidth(this._maxLineWidth);
        return this._visibleLines.onZonesChanged(e);
    }
    onThemeChanged(e) {
        return this._onOptionsMaybeChanged();
    }
    // ---- end view event handlers
    // ----------- HELPERS FOR OTHERS
    getPositionFromDOMInfo(spanNode, offset) {
        const viewLineDomNode = this._getViewLineDomNode(spanNode);
        if (viewLineDomNode === null) {
            // Couldn't find view line node
            return null;
        }
        const lineNumber = this._getLineNumberFor(viewLineDomNode);
        if (lineNumber === -1) {
            // Couldn't find view line node
            return null;
        }
        if (lineNumber < 1 || lineNumber > this._context.viewModel.getLineCount()) {
            // lineNumber is outside range
            return null;
        }
        if (this._context.viewModel.getLineMaxColumn(lineNumber) === 1) {
            // Line is empty
            return new Position(lineNumber, 1);
        }
        const rendStartLineNumber = this._visibleLines.getStartLineNumber();
        const rendEndLineNumber = this._visibleLines.getEndLineNumber();
        if (lineNumber < rendStartLineNumber || lineNumber > rendEndLineNumber) {
            // Couldn't find line
            return null;
        }
        let column = this._visibleLines.getVisibleLine(lineNumber).getColumnOfNodeOffset(spanNode, offset);
        const minColumn = this._context.viewModel.getLineMinColumn(lineNumber);
        if (column < minColumn) {
            column = minColumn;
        }
        return new Position(lineNumber, column);
    }
    _getViewLineDomNode(node) {
        while (node && node.nodeType === 1) {
            if (node.className === ViewLine.CLASS_NAME) {
                return node;
            }
            node = node.parentElement;
        }
        return null;
    }
    /**
     * @returns the line number of this view line dom node.
     */
    _getLineNumberFor(domNode) {
        const startLineNumber = this._visibleLines.getStartLineNumber();
        const endLineNumber = this._visibleLines.getEndLineNumber();
        for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
            const line = this._visibleLines.getVisibleLine(lineNumber);
            if (domNode === line.getDomNode()) {
                return lineNumber;
            }
        }
        return -1;
    }
    getLineWidth(lineNumber) {
        const rendStartLineNumber = this._visibleLines.getStartLineNumber();
        const rendEndLineNumber = this._visibleLines.getEndLineNumber();
        if (lineNumber < rendStartLineNumber || lineNumber > rendEndLineNumber) {
            // Couldn't find line
            return -1;
        }
        const context = new DomReadingContext(this.domNode.domNode, this._textRangeRestingSpot);
        const result = this._visibleLines.getVisibleLine(lineNumber).getWidth(context);
        this._updateLineWidthsSlowIfDomDidLayout(context);
        return result;
    }
    linesVisibleRangesForRange(_range, includeNewLines) {
        const originalEndLineNumber = _range.endLineNumber;
        const range = Range.intersectRanges(_range, this._lastRenderedData.getCurrentVisibleRange());
        if (!range) {
            return null;
        }
        const visibleRanges = [];
        let visibleRangesLen = 0;
        const domReadingContext = new DomReadingContext(this.domNode.domNode, this._textRangeRestingSpot);
        let nextLineModelLineNumber = 0;
        if (includeNewLines) {
            nextLineModelLineNumber = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(range.startLineNumber, 1)).lineNumber;
        }
        const rendStartLineNumber = this._visibleLines.getStartLineNumber();
        const rendEndLineNumber = this._visibleLines.getEndLineNumber();
        for (let lineNumber = range.startLineNumber; lineNumber <= range.endLineNumber; lineNumber++) {
            if (lineNumber < rendStartLineNumber || lineNumber > rendEndLineNumber) {
                continue;
            }
            const startColumn = lineNumber === range.startLineNumber ? range.startColumn : 1;
            const continuesInNextLine = lineNumber !== originalEndLineNumber;
            const endColumn = continuesInNextLine ? this._context.viewModel.getLineMaxColumn(lineNumber) : range.endColumn;
            const visibleLine = this._visibleLines.getVisibleLine(lineNumber);
            const visibleRangesForLine = visibleLine.getVisibleRangesForRange(lineNumber, startColumn, endColumn, domReadingContext);
            if (!visibleRangesForLine) {
                continue;
            }
            if (includeNewLines && lineNumber < originalEndLineNumber) {
                const currentLineModelLineNumber = nextLineModelLineNumber;
                nextLineModelLineNumber = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(lineNumber + 1, 1)).lineNumber;
                if (currentLineModelLineNumber !== nextLineModelLineNumber) {
                    const floatHorizontalRange = visibleRangesForLine.ranges[visibleRangesForLine.ranges.length - 1];
                    floatHorizontalRange.width += this._typicalHalfwidthCharacterWidth;
                    if (this._context.viewModel.getTextDirection(currentLineModelLineNumber) === TextDirection.RTL) {
                        floatHorizontalRange.left -= this._typicalHalfwidthCharacterWidth;
                    }
                }
            }
            visibleRanges[visibleRangesLen++] = new LineVisibleRanges(visibleRangesForLine.outsideRenderedLine, lineNumber, HorizontalRange.from(visibleRangesForLine.ranges), continuesInNextLine);
        }
        this._updateLineWidthsSlowIfDomDidLayout(domReadingContext);
        if (visibleRangesLen === 0) {
            return null;
        }
        return visibleRanges;
    }
    _visibleRangesForLineRange(lineNumber, startColumn, endColumn) {
        if (lineNumber < this._visibleLines.getStartLineNumber() || lineNumber > this._visibleLines.getEndLineNumber()) {
            return null;
        }
        const domReadingContext = new DomReadingContext(this.domNode.domNode, this._textRangeRestingSpot);
        const result = this._visibleLines.getVisibleLine(lineNumber).getVisibleRangesForRange(lineNumber, startColumn, endColumn, domReadingContext);
        this._updateLineWidthsSlowIfDomDidLayout(domReadingContext);
        return result;
    }
    _lineIsRenderedRTL(lineNumber) {
        if (lineNumber < this._visibleLines.getStartLineNumber() || lineNumber > this._visibleLines.getEndLineNumber()) {
            return false;
        }
        const visibleLine = this._visibleLines.getVisibleLine(lineNumber);
        return visibleLine.isRenderedRTL();
    }
    visibleRangeForPosition(position) {
        const visibleRanges = this._visibleRangesForLineRange(position.lineNumber, position.column, position.column);
        if (!visibleRanges) {
            return null;
        }
        return new HorizontalPosition(visibleRanges.outsideRenderedLine, visibleRanges.ranges[0].left);
    }
    // --- implementation
    updateLineWidths() {
        this._updateLineWidths(false);
    }
    /**
     * Updates the max line width if it is fast to compute.
     * Returns true if all lines were taken into account.
     * Returns false if some lines need to be reevaluated (in a slow fashion).
     */
    _updateLineWidthsFast() {
        return this._updateLineWidths(true);
    }
    _updateLineWidthsSlow() {
        this._updateLineWidths(false);
    }
    /**
     * Update the line widths using DOM layout information after someone else
     * has caused a synchronous layout.
     */
    _updateLineWidthsSlowIfDomDidLayout(domReadingContext) {
        if (!domReadingContext.didDomLayout) {
            // only proceed if we just did a layout
            return;
        }
        if (!this._asyncUpdateLineWidths.isScheduled()) {
            // reading widths is not scheduled => widths are up-to-date
            return;
        }
        this._asyncUpdateLineWidths.cancel();
        this._updateLineWidthsSlow();
    }
    _updateLineWidths(fast) {
        const rendStartLineNumber = this._visibleLines.getStartLineNumber();
        const rendEndLineNumber = this._visibleLines.getEndLineNumber();
        let localMaxLineWidth = 1;
        let allWidthsComputed = true;
        for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
            const visibleLine = this._visibleLines.getVisibleLine(lineNumber);
            if (fast && !visibleLine.getWidthIsFast()) {
                // Cannot compute width in a fast way for this line
                allWidthsComputed = false;
                continue;
            }
            localMaxLineWidth = Math.max(localMaxLineWidth, visibleLine.getWidth(null));
        }
        if (allWidthsComputed && rendStartLineNumber === 1 && rendEndLineNumber === this._context.viewModel.getLineCount()) {
            // we know the max line width for all the lines
            this._maxLineWidth = 0;
        }
        this._ensureMaxLineWidth(localMaxLineWidth);
        return allWidthsComputed;
    }
    _checkMonospaceFontAssumptions() {
        // Problems with monospace assumptions are more apparent for longer lines,
        // as small rounding errors start to sum up, so we will select the longest
        // line for a closer inspection
        let longestLineNumber = -1;
        let longestWidth = -1;
        const rendStartLineNumber = this._visibleLines.getStartLineNumber();
        const rendEndLineNumber = this._visibleLines.getEndLineNumber();
        for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
            const visibleLine = this._visibleLines.getVisibleLine(lineNumber);
            if (visibleLine.needsMonospaceFontCheck()) {
                const lineWidth = visibleLine.getWidth(null);
                if (lineWidth > longestWidth) {
                    longestWidth = lineWidth;
                    longestLineNumber = lineNumber;
                }
            }
        }
        if (longestLineNumber === -1) {
            return;
        }
        if (!this._visibleLines.getVisibleLine(longestLineNumber).monospaceAssumptionsAreValid()) {
            for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
                const visibleLine = this._visibleLines.getVisibleLine(lineNumber);
                visibleLine.onMonospaceAssumptionsInvalidated();
            }
        }
    }
    prepareRender() {
        throw new Error('Not supported');
    }
    render() {
        throw new Error('Not supported');
    }
    renderText(viewportData) {
        // (1) render lines - ensures lines are in the DOM
        this._visibleLines.renderLines(viewportData);
        this._lastRenderedData.setCurrentVisibleRange(viewportData.visibleRange);
        this.domNode.setWidth(this._context.viewLayout.getScrollWidth());
        this.domNode.setHeight(Math.min(this._context.viewLayout.getScrollHeight(), 1000000));
        // (2) compute horizontal scroll position:
        //  - this must happen after the lines are in the DOM since it might need a line that rendered just now
        //  - it might change `scrollWidth` and `scrollLeft`
        if (this._horizontalRevealRequest) {
            const horizontalRevealRequest = this._horizontalRevealRequest;
            // Check that we have the line that contains the horizontal range in the viewport
            if (viewportData.startLineNumber <= horizontalRevealRequest.minLineNumber && horizontalRevealRequest.maxLineNumber <= viewportData.endLineNumber) {
                this._horizontalRevealRequest = null;
                // allow `visibleRangesForRange2` to work
                this.onDidRender();
                // compute new scroll position
                const newScrollLeft = this._computeScrollLeftToReveal(horizontalRevealRequest);
                if (newScrollLeft) {
                    if (!this._isViewportWrapping && !newScrollLeft.hasRTL) {
                        // ensure `scrollWidth` is large enough
                        this._ensureMaxLineWidth(newScrollLeft.maxHorizontalOffset);
                    }
                    // set `scrollLeft`
                    this._context.viewModel.viewLayout.setScrollPosition({
                        scrollLeft: newScrollLeft.scrollLeft
                    }, horizontalRevealRequest.scrollType);
                }
            }
        }
        // Update max line width (not so important, it is just so the horizontal scrollbar doesn't get too small)
        if (!this._updateLineWidthsFast()) {
            // Computing the width of some lines would be slow => delay it
            this._asyncUpdateLineWidths.schedule();
        }
        else {
            this._asyncUpdateLineWidths.cancel();
        }
        if (platform.isLinux && !this._asyncCheckMonospaceFontAssumptions.isScheduled()) {
            const rendStartLineNumber = this._visibleLines.getStartLineNumber();
            const rendEndLineNumber = this._visibleLines.getEndLineNumber();
            for (let lineNumber = rendStartLineNumber; lineNumber <= rendEndLineNumber; lineNumber++) {
                const visibleLine = this._visibleLines.getVisibleLine(lineNumber);
                if (visibleLine.needsMonospaceFontCheck()) {
                    this._asyncCheckMonospaceFontAssumptions.schedule();
                    break;
                }
            }
        }
        // (3) handle scrolling
        this._linesContent.setLayerHinting(this._canUseLayerHinting);
        this._linesContent.setContain('strict');
        const adjustedScrollTop = this._context.viewLayout.getCurrentScrollTop() - viewportData.bigNumbersDelta;
        this._linesContent.setTop(-adjustedScrollTop);
        this._linesContent.setLeft(-this._context.viewLayout.getCurrentScrollLeft());
    }
    // --- width
    _ensureMaxLineWidth(lineWidth) {
        const iLineWidth = Math.ceil(lineWidth);
        if (this._maxLineWidth < iLineWidth) {
            this._maxLineWidth = iLineWidth;
            this._context.viewModel.viewLayout.setMaxLineWidth(this._maxLineWidth);
        }
    }
    _computeScrollTopToRevealRange(viewport, source, minimalReveal, range, selections, verticalType) {
        const viewportStartY = viewport.top;
        const viewportHeight = viewport.height;
        const viewportEndY = viewportStartY + viewportHeight;
        let boxIsSingleRange;
        let boxStartY;
        let boxEndY;
        if (selections && selections.length > 0) {
            let minLineNumber = selections[0].startLineNumber;
            let maxLineNumber = selections[0].endLineNumber;
            for (let i = 1, len = selections.length; i < len; i++) {
                const selection = selections[i];
                minLineNumber = Math.min(minLineNumber, selection.startLineNumber);
                maxLineNumber = Math.max(maxLineNumber, selection.endLineNumber);
            }
            boxIsSingleRange = false;
            boxStartY = this._context.viewLayout.getVerticalOffsetForLineNumber(minLineNumber);
            boxEndY = this._context.viewLayout.getVerticalOffsetForLineNumber(maxLineNumber) + this._lineHeight;
        }
        else if (range) {
            boxIsSingleRange = true;
            boxStartY = this._context.viewLayout.getVerticalOffsetForLineNumber(range.startLineNumber);
            boxEndY = this._context.viewLayout.getVerticalOffsetForLineNumber(range.endLineNumber) + this._lineHeight;
        }
        else {
            return -1;
        }
        const shouldIgnoreScrollOff = (source === 'mouse' || minimalReveal) && this._cursorSurroundingLinesStyle === 'default';
        let paddingTop = 0;
        let paddingBottom = 0;
        if (!shouldIgnoreScrollOff) {
            const maxLinesInViewport = (viewportHeight / this._lineHeight);
            const surroundingLines = Math.max(this._cursorSurroundingLines, this._stickyScrollEnabled ? this._maxNumberStickyLines : 0);
            const context = Math.min(maxLinesInViewport / 2, surroundingLines);
            paddingTop = context * this._lineHeight;
            paddingBottom = Math.max(0, (context - 1)) * this._lineHeight;
        }
        else {
            if (!minimalReveal) {
                // Reveal one more line above (this case is hit when dragging)
                paddingTop = this._lineHeight;
            }
        }
        if (!minimalReveal) {
            if (verticalType === 0 /* viewEvents.VerticalRevealType.Simple */ || verticalType === 4 /* viewEvents.VerticalRevealType.Bottom */) {
                // Reveal one line more when the last line would be covered by the scrollbar - arrow down case or revealing a line explicitly at bottom
                paddingBottom += this._lineHeight;
            }
        }
        boxStartY -= paddingTop;
        boxEndY += paddingBottom;
        let newScrollTop;
        if (boxEndY - boxStartY > viewportHeight) {
            // the box is larger than the viewport ... scroll to its top
            if (!boxIsSingleRange) {
                // do not reveal multiple cursors if there are more than fit the viewport
                return -1;
            }
            newScrollTop = boxStartY;
        }
        else if (verticalType === 5 /* viewEvents.VerticalRevealType.NearTop */ || verticalType === 6 /* viewEvents.VerticalRevealType.NearTopIfOutsideViewport */) {
            if (verticalType === 6 /* viewEvents.VerticalRevealType.NearTopIfOutsideViewport */ && viewportStartY <= boxStartY && boxEndY <= viewportEndY) {
                // Box is already in the viewport... do nothing
                newScrollTop = viewportStartY;
            }
            else {
                // We want a gap that is 20% of the viewport, but with a minimum of 5 lines
                const desiredGapAbove = Math.max(5 * this._lineHeight, viewportHeight * 0.2);
                // Try to scroll just above the box with the desired gap
                const desiredScrollTop = boxStartY - desiredGapAbove;
                // But ensure that the box is not pushed out of viewport
                const minScrollTop = boxEndY - viewportHeight;
                newScrollTop = Math.max(minScrollTop, desiredScrollTop);
            }
        }
        else if (verticalType === 1 /* viewEvents.VerticalRevealType.Center */ || verticalType === 2 /* viewEvents.VerticalRevealType.CenterIfOutsideViewport */) {
            if (verticalType === 2 /* viewEvents.VerticalRevealType.CenterIfOutsideViewport */ && viewportStartY <= boxStartY && boxEndY <= viewportEndY) {
                // Box is already in the viewport... do nothing
                newScrollTop = viewportStartY;
            }
            else {
                // Box is outside the viewport... center it
                const boxMiddleY = (boxStartY + boxEndY) / 2;
                newScrollTop = Math.max(0, boxMiddleY - viewportHeight / 2);
            }
        }
        else {
            newScrollTop = this._computeMinimumScrolling(viewportStartY, viewportEndY, boxStartY, boxEndY, verticalType === 3 /* viewEvents.VerticalRevealType.Top */, verticalType === 4 /* viewEvents.VerticalRevealType.Bottom */);
        }
        return newScrollTop;
    }
    _computeScrollLeftToReveal(horizontalRevealRequest) {
        const viewport = this._context.viewLayout.getCurrentViewport();
        const layoutInfo = this._context.configuration.options.get(165 /* EditorOption.layoutInfo */);
        const viewportStartX = viewport.left;
        const viewportEndX = viewportStartX + viewport.width - layoutInfo.verticalScrollbarWidth;
        let boxStartX = 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */;
        let boxEndX = 0;
        let hasRTL = false;
        if (horizontalRevealRequest.type === 'range') {
            hasRTL = this._lineIsRenderedRTL(horizontalRevealRequest.lineNumber);
            const visibleRanges = this._visibleRangesForLineRange(horizontalRevealRequest.lineNumber, horizontalRevealRequest.startColumn, horizontalRevealRequest.endColumn);
            if (!visibleRanges) {
                return null;
            }
            for (const visibleRange of visibleRanges.ranges) {
                boxStartX = Math.min(boxStartX, Math.round(visibleRange.left));
                boxEndX = Math.max(boxEndX, Math.round(visibleRange.left + visibleRange.width));
            }
        }
        else {
            for (const selection of horizontalRevealRequest.selections) {
                if (selection.startLineNumber !== selection.endLineNumber) {
                    return null;
                }
                const visibleRanges = this._visibleRangesForLineRange(selection.startLineNumber, selection.startColumn, selection.endColumn);
                hasRTL ||= this._lineIsRenderedRTL(selection.startLineNumber);
                if (!visibleRanges) {
                    return null;
                }
                for (const visibleRange of visibleRanges.ranges) {
                    boxStartX = Math.min(boxStartX, Math.round(visibleRange.left));
                    boxEndX = Math.max(boxEndX, Math.round(visibleRange.left + visibleRange.width));
                }
            }
        }
        if (!horizontalRevealRequest.minimalReveal) {
            boxStartX = Math.max(0, boxStartX - ViewLines.HORIZONTAL_EXTRA_PX);
            boxEndX += this._revealHorizontalRightPadding;
        }
        if (horizontalRevealRequest.type === 'selections' && boxEndX - boxStartX > viewport.width) {
            return null;
        }
        const newScrollLeft = this._computeMinimumScrolling(viewportStartX, viewportEndX, boxStartX, boxEndX);
        return {
            scrollLeft: newScrollLeft,
            maxHorizontalOffset: boxEndX,
            hasRTL
        };
    }
    _computeMinimumScrolling(viewportStart, viewportEnd, boxStart, boxEnd, revealAtStart, revealAtEnd) {
        viewportStart = viewportStart | 0;
        viewportEnd = viewportEnd | 0;
        boxStart = boxStart | 0;
        boxEnd = boxEnd | 0;
        revealAtStart = !!revealAtStart;
        revealAtEnd = !!revealAtEnd;
        const viewportLength = viewportEnd - viewportStart;
        const boxLength = boxEnd - boxStart;
        if (boxLength < viewportLength) {
            // The box would fit in the viewport
            if (revealAtStart) {
                return boxStart;
            }
            if (revealAtEnd) {
                return Math.max(0, boxEnd - viewportLength);
            }
            if (boxStart < viewportStart) {
                // The box is above the viewport
                return boxStart;
            }
            else if (boxEnd > viewportEnd) {
                // The box is below the viewport
                return Math.max(0, boxEnd - viewportLength);
            }
        }
        else {
            // The box would not fit in the viewport
            // Reveal the beginning of the box
            return boxStart;
        }
        return viewportStart;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld0xpbmVzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9icm93c2VyL3ZpZXdQYXJ0cy92aWV3TGluZXMvdmlld0xpbmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzFHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3BFLE9BQU8sS0FBSyxRQUFRLE1BQU0scUNBQXFDLENBQUM7QUFFaEUsT0FBTyxpQkFBaUIsQ0FBQztBQUN6QixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDNUQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLGVBQWUsRUFBYyxpQkFBaUIsRUFBaUIsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNuSSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUNqRSxPQUFPLEVBQW1CLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3JGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQzNELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFFekMsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQU90RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFFdkQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBRXpELE1BQU0sZ0JBQWdCO0lBSXJCO1FBQ0MsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFF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