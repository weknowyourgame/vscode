/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { Scrollable } from '../../../base/common/scrollable.js';
import { LinesLayout } from './linesLayout.js';
import { Viewport } from '../viewModel.js';
import { ContentSizeChangedEvent } from '../viewModelEventDispatcher.js';
const SMOOTH_SCROLLING_TIME = 125;
class EditorScrollDimensions {
    constructor(width, contentWidth, height, contentHeight) {
        width = width | 0;
        contentWidth = contentWidth | 0;
        height = height | 0;
        contentHeight = contentHeight | 0;
        if (width < 0) {
            width = 0;
        }
        if (contentWidth < 0) {
            contentWidth = 0;
        }
        if (height < 0) {
            height = 0;
        }
        if (contentHeight < 0) {
            contentHeight = 0;
        }
        this.width = width;
        this.contentWidth = contentWidth;
        this.scrollWidth = Math.max(width, contentWidth);
        this.height = height;
        this.contentHeight = contentHeight;
        this.scrollHeight = Math.max(height, contentHeight);
    }
    equals(other) {
        return (this.width === other.width
            && this.contentWidth === other.contentWidth
            && this.height === other.height
            && this.contentHeight === other.contentHeight);
    }
}
class EditorScrollable extends Disposable {
    constructor(smoothScrollDuration, scheduleAtNextAnimationFrame) {
        super();
        this._onDidContentSizeChange = this._register(new Emitter());
        this.onDidContentSizeChange = this._onDidContentSizeChange.event;
        this._dimensions = new EditorScrollDimensions(0, 0, 0, 0);
        this._scrollable = this._register(new Scrollable({
            forceIntegerValues: true,
            smoothScrollDuration,
            scheduleAtNextAnimationFrame
        }));
        this.onDidScroll = this._scrollable.onScroll;
    }
    getScrollable() {
        return this._scrollable;
    }
    setSmoothScrollDuration(smoothScrollDuration) {
        this._scrollable.setSmoothScrollDuration(smoothScrollDuration);
    }
    validateScrollPosition(scrollPosition) {
        return this._scrollable.validateScrollPosition(scrollPosition);
    }
    getScrollDimensions() {
        return this._dimensions;
    }
    setScrollDimensions(dimensions) {
        if (this._dimensions.equals(dimensions)) {
            return;
        }
        const oldDimensions = this._dimensions;
        this._dimensions = dimensions;
        this._scrollable.setScrollDimensions({
            width: dimensions.width,
            scrollWidth: dimensions.scrollWidth,
            height: dimensions.height,
            scrollHeight: dimensions.scrollHeight
        }, true);
        const contentWidthChanged = (oldDimensions.contentWidth !== dimensions.contentWidth);
        const contentHeightChanged = (oldDimensions.contentHeight !== dimensions.contentHeight);
        if (contentWidthChanged || contentHeightChanged) {
            this._onDidContentSizeChange.fire(new ContentSizeChangedEvent(oldDimensions.contentWidth, oldDimensions.contentHeight, dimensions.contentWidth, dimensions.contentHeight));
        }
    }
    getFutureScrollPosition() {
        return this._scrollable.getFutureScrollPosition();
    }
    getCurrentScrollPosition() {
        return this._scrollable.getCurrentScrollPosition();
    }
    setScrollPositionNow(update) {
        this._scrollable.setScrollPositionNow(update);
    }
    setScrollPositionSmooth(update) {
        this._scrollable.setScrollPositionSmooth(update);
    }
    hasPendingScrollAnimation() {
        return this._scrollable.hasPendingScrollAnimation();
    }
}
export class ViewLayout extends Disposable {
    constructor(configuration, lineCount, customLineHeightData, scheduleAtNextAnimationFrame) {
        super();
        this._configuration = configuration;
        const options = this._configuration.options;
        const layoutInfo = options.get(165 /* EditorOption.layoutInfo */);
        const padding = options.get(96 /* EditorOption.padding */);
        this._linesLayout = new LinesLayout(lineCount, options.get(75 /* EditorOption.lineHeight */), padding.top, padding.bottom, customLineHeightData);
        this._maxLineWidth = 0;
        this._overlayWidgetsMinWidth = 0;
        this._scrollable = this._register(new EditorScrollable(0, scheduleAtNextAnimationFrame));
        this._configureSmoothScrollDuration();
        this._scrollable.setScrollDimensions(new EditorScrollDimensions(layoutInfo.contentWidth, 0, layoutInfo.height, 0));
        this.onDidScroll = this._scrollable.onDidScroll;
        this.onDidContentSizeChange = this._scrollable.onDidContentSizeChange;
        this._updateHeight();
    }
    dispose() {
        super.dispose();
    }
    getScrollable() {
        return this._scrollable.getScrollable();
    }
    onHeightMaybeChanged() {
        this._updateHeight();
    }
    _configureSmoothScrollDuration() {
        this._scrollable.setSmoothScrollDuration(this._configuration.options.get(130 /* EditorOption.smoothScrolling */) ? SMOOTH_SCROLLING_TIME : 0);
    }
    // ---- begin view event handlers
    onConfigurationChanged(e) {
        const options = this._configuration.options;
        if (e.hasChanged(75 /* EditorOption.lineHeight */)) {
            this._linesLayout.setDefaultLineHeight(options.get(75 /* EditorOption.lineHeight */));
        }
        if (e.hasChanged(96 /* EditorOption.padding */)) {
            const padding = options.get(96 /* EditorOption.padding */);
            this._linesLayout.setPadding(padding.top, padding.bottom);
        }
        if (e.hasChanged(165 /* EditorOption.layoutInfo */)) {
            const layoutInfo = options.get(165 /* EditorOption.layoutInfo */);
            const width = layoutInfo.contentWidth;
            const height = layoutInfo.height;
            const scrollDimensions = this._scrollable.getScrollDimensions();
            const contentWidth = scrollDimensions.contentWidth;
            this._scrollable.setScrollDimensions(new EditorScrollDimensions(width, scrollDimensions.contentWidth, height, this._getContentHeight(width, height, contentWidth)));
        }
        else {
            this._updateHeight();
        }
        if (e.hasChanged(130 /* EditorOption.smoothScrolling */)) {
            this._configureSmoothScrollDuration();
        }
    }
    onFlushed(lineCount, customLineHeightData) {
        this._linesLayout.onFlushed(lineCount, customLineHeightData);
    }
    onLinesDeleted(fromLineNumber, toLineNumber) {
        this._linesLayout.onLinesDeleted(fromLineNumber, toLineNumber);
    }
    onLinesInserted(fromLineNumber, toLineNumber) {
        this._linesLayout.onLinesInserted(fromLineNumber, toLineNumber);
    }
    // ---- end view event handlers
    _getHorizontalScrollbarHeight(width, scrollWidth) {
        const options = this._configuration.options;
        const scrollbar = options.get(117 /* EditorOption.scrollbar */);
        if (scrollbar.horizontal === 2 /* ScrollbarVisibility.Hidden */) {
            // horizontal scrollbar not visible
            return 0;
        }
        if (width >= scrollWidth) {
            // horizontal scrollbar not visible
            return 0;
        }
        return scrollbar.horizontalScrollbarSize;
    }
    _getContentHeight(width, height, contentWidth) {
        const options = this._configuration.options;
        let result = this._linesLayout.getLinesTotalHeight();
        if (options.get(119 /* EditorOption.scrollBeyondLastLine */)) {
            result += Math.max(0, height - options.get(75 /* EditorOption.lineHeight */) - options.get(96 /* EditorOption.padding */).bottom);
        }
        else if (!options.get(117 /* EditorOption.scrollbar */).ignoreHorizontalScrollbarInContentHeight) {
            result += this._getHorizontalScrollbarHeight(width, contentWidth);
        }
        return result;
    }
    _updateHeight() {
        const scrollDimensions = this._scrollable.getScrollDimensions();
        const width = scrollDimensions.width;
        const height = scrollDimensions.height;
        const contentWidth = scrollDimensions.contentWidth;
        this._scrollable.setScrollDimensions(new EditorScrollDimensions(width, scrollDimensions.contentWidth, height, this._getContentHeight(width, height, contentWidth)));
    }
    // ---- Layouting logic
    getCurrentViewport() {
        const scrollDimensions = this._scrollable.getScrollDimensions();
        const currentScrollPosition = this._scrollable.getCurrentScrollPosition();
        return new Viewport(currentScrollPosition.scrollTop, currentScrollPosition.scrollLeft, scrollDimensions.width, scrollDimensions.height);
    }
    getFutureViewport() {
        const scrollDimensions = this._scrollable.getScrollDimensions();
        const currentScrollPosition = this._scrollable.getFutureScrollPosition();
        return new Viewport(currentScrollPosition.scrollTop, currentScrollPosition.scrollLeft, scrollDimensions.width, scrollDimensions.height);
    }
    _computeContentWidth() {
        const options = this._configuration.options;
        const maxLineWidth = this._maxLineWidth;
        const wrappingInfo = options.get(166 /* EditorOption.wrappingInfo */);
        const fontInfo = options.get(59 /* EditorOption.fontInfo */);
        const layoutInfo = options.get(165 /* EditorOption.layoutInfo */);
        if (wrappingInfo.isViewportWrapping) {
            const minimap = options.get(81 /* EditorOption.minimap */);
            if (maxLineWidth > layoutInfo.contentWidth + fontInfo.typicalHalfwidthCharacterWidth) {
                // This is a case where viewport wrapping is on, but the line extends above the viewport
                if (minimap.enabled && minimap.side === 'right') {
                    // We need to accomodate the scrollbar width
                    return maxLineWidth + layoutInfo.verticalScrollbarWidth;
                }
            }
            return maxLineWidth;
        }
        else {
            const extraHorizontalSpace = options.get(118 /* EditorOption.scrollBeyondLastColumn */) * fontInfo.typicalHalfwidthCharacterWidth;
            const whitespaceMinWidth = this._linesLayout.getWhitespaceMinWidth();
            return Math.max(maxLineWidth + extraHorizontalSpace + layoutInfo.verticalScrollbarWidth, whitespaceMinWidth, this._overlayWidgetsMinWidth);
        }
    }
    setMaxLineWidth(maxLineWidth) {
        this._maxLineWidth = maxLineWidth;
        this._updateContentWidth();
    }
    setOverlayWidgetsMinWidth(maxMinWidth) {
        this._overlayWidgetsMinWidth = maxMinWidth;
        this._updateContentWidth();
    }
    _updateContentWidth() {
        const scrollDimensions = this._scrollable.getScrollDimensions();
        this._scrollable.setScrollDimensions(new EditorScrollDimensions(scrollDimensions.width, this._computeContentWidth(), scrollDimensions.height, scrollDimensions.contentHeight));
        // The height might depend on the fact that there is a horizontal scrollbar or not
        this._updateHeight();
    }
    // ---- view state
    saveState() {
        const currentScrollPosition = this._scrollable.getFutureScrollPosition();
        const scrollTop = currentScrollPosition.scrollTop;
        const firstLineNumberInViewport = this._linesLayout.getLineNumberAtOrAfterVerticalOffset(scrollTop);
        const whitespaceAboveFirstLine = this._linesLayout.getWhitespaceAccumulatedHeightBeforeLineNumber(firstLineNumberInViewport);
        return {
            scrollTop: scrollTop,
            scrollTopWithoutViewZones: scrollTop - whitespaceAboveFirstLine,
            scrollLeft: currentScrollPosition.scrollLeft
        };
    }
    // ----
    changeWhitespace(callback) {
        const hadAChange = this._linesLayout.changeWhitespace(callback);
        if (hadAChange) {
            this.onHeightMaybeChanged();
        }
        return hadAChange;
    }
    changeSpecialLineHeights(callback) {
        const hadAChange = this._linesLayout.changeLineHeights(callback);
        if (hadAChange) {
            this.onHeightMaybeChanged();
        }
        return hadAChange;
    }
    getVerticalOffsetForLineNumber(lineNumber, includeViewZones = false) {
        return this._linesLayout.getVerticalOffsetForLineNumber(lineNumber, includeViewZones);
    }
    getVerticalOffsetAfterLineNumber(lineNumber, includeViewZones = false) {
        return this._linesLayout.getVerticalOffsetAfterLineNumber(lineNumber, includeViewZones);
    }
    getLineHeightForLineNumber(lineNumber) {
        return this._linesLayout.getLineHeightForLineNumber(lineNumber);
    }
    isAfterLines(verticalOffset) {
        return this._linesLayout.isAfterLines(verticalOffset);
    }
    isInTopPadding(verticalOffset) {
        return this._linesLayout.isInTopPadding(verticalOffset);
    }
    isInBottomPadding(verticalOffset) {
        return this._linesLayout.isInBottomPadding(verticalOffset);
    }
    getLineNumberAtVerticalOffset(verticalOffset) {
        return this._linesLayout.getLineNumberAtOrAfterVerticalOffset(verticalOffset);
    }
    getWhitespaceAtVerticalOffset(verticalOffset) {
        return this._linesLayout.getWhitespaceAtVerticalOffset(verticalOffset);
    }
    getLinesViewportData() {
        const visibleBox = this.getCurrentViewport();
        return this._linesLayout.getLinesViewportData(visibleBox.top, visibleBox.top + visibleBox.height);
    }
    getLinesViewportDataAtScrollTop(scrollTop) {
        // do some minimal validations on scrollTop
        const scrollDimensions = this._scrollable.getScrollDimensions();
        if (scrollTop + scrollDimensions.height > scrollDimensions.scrollHeight) {
            scrollTop = scrollDimensions.scrollHeight - scrollDimensions.height;
        }
        if (scrollTop < 0) {
            scrollTop = 0;
        }
        return this._linesLayout.getLinesViewportData(scrollTop, scrollTop + scrollDimensions.height);
    }
    getWhitespaceViewportData() {
        const visibleBox = this.getCurrentViewport();
        return this._linesLayout.getWhitespaceViewportData(visibleBox.top, visibleBox.top + visibleBox.height);
    }
    getWhitespaces() {
        return this._linesLayout.getWhitespaces();
    }
    // ----
    getContentWidth() {
        const scrollDimensions = this._scrollable.getScrollDimensions();
        return scrollDimensions.contentWidth;
    }
    getScrollWidth() {
        const scrollDimensions = this._scrollable.getScrollDimensions();
        return scrollDimensions.scrollWidth;
    }
    getContentHeight() {
        const scrollDimensions = this._scrollable.getScrollDimensions();
        return scrollDimensions.contentHeight;
    }
    getScrollHeight() {
        const scrollDimensions = this._scrollable.getScrollDimensions();
        return scrollDimensions.scrollHeight;
    }
    getCurrentScrollLeft() {
        const currentScrollPosition = this._scrollable.getCurrentScrollPosition();
        return currentScrollPosition.scrollLeft;
    }
    getCurrentScrollTop() {
        const currentScrollPosition = this._scrollable.getCurrentScrollPosition();
        return currentScrollPosition.scrollTop;
    }
    validateScrollPosition(scrollPosition) {
        return this._scrollable.validateScrollPosition(scrollPosition);
    }
    setScrollPosition(position, type) {
        if (type === 1 /* ScrollType.Immediate */) {
            this._scrollable.setScrollPositionNow(position);
        }
        else {
            this._scrollable.setScrollPositionSmooth(position);
        }
    }
    hasPendingScrollAnimation() {
        return this._scrollable.hasPendingScrollAnimation();
    }
    deltaScrollNow(deltaScrollLeft, deltaScrollTop) {
        const currentScrollPosition = this._scrollable.getCurrentScrollPosition();
        this._scrollable.setScrollPositionNow({
            scrollLeft: currentScrollPosition.scrollLeft + deltaScrollLeft,
            scrollTop: currentScrollPosition.scrollTop + deltaScrollTop
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld0xheW91dC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL3ZpZXdMYXlvdXQvdmlld0xheW91dC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQVMsT0FBTyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFVBQVUsRUFBZSxNQUFNLG1DQUFtQyxDQUFDO0FBQzVFLE9BQU8sRUFBZ0MsVUFBVSxFQUEyQyxNQUFNLG9DQUFvQyxDQUFDO0FBSXZJLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUMvQyxPQUFPLEVBQW9KLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzdMLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBR3pFLE1BQU0scUJBQXFCLEdBQUcsR0FBRyxDQUFDO0FBRWxDLE1BQU0sc0JBQXNCO0lBVTNCLFlBQ0MsS0FBYSxFQUNiLFlBQW9CLEVBQ3BCLE1BQWMsRUFDZCxhQUFxQjtRQUVyQixLQUFLLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQztRQUNsQixZQUFZLEdBQUcsWUFBWSxHQUFHLENBQUMsQ0FBQztRQUNoQyxNQUFNLEdBQUcsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNwQixhQUFhLEdBQUcsYUFBYSxHQUFHLENBQUMsQ0FBQztRQUVsQyxJQUFJLEtBQUssR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNmLEtBQUssR0FBRyxDQUFDLENBQUM7UUFDWCxDQUFDO1FBQ0QsSUFBSSxZQUFZLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDdEIsWUFBWSxHQUFHLENBQUMsQ0FBQztRQUNsQixDQUFDO1FBRUQsSUFBSSxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDaEIsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNaLENBQUM7UUFD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