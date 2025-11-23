/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class RestrictedRenderingContext {
    constructor(viewLayout, viewportData) {
        this._restrictedRenderingContextBrand = undefined;
        this._viewLayout = viewLayout;
        this.viewportData = viewportData;
        this.scrollWidth = this._viewLayout.getScrollWidth();
        this.scrollHeight = this._viewLayout.getScrollHeight();
        this.visibleRange = this.viewportData.visibleRange;
        this.bigNumbersDelta = this.viewportData.bigNumbersDelta;
        const vInfo = this._viewLayout.getCurrentViewport();
        this.scrollTop = vInfo.top;
        this.scrollLeft = vInfo.left;
        this.viewportWidth = vInfo.width;
        this.viewportHeight = vInfo.height;
    }
    getScrolledTopFromAbsoluteTop(absoluteTop) {
        return absoluteTop - this.scrollTop;
    }
    getVerticalOffsetForLineNumber(lineNumber, includeViewZones) {
        return this._viewLayout.getVerticalOffsetForLineNumber(lineNumber, includeViewZones);
    }
    getVerticalOffsetAfterLineNumber(lineNumber, includeViewZones) {
        return this._viewLayout.getVerticalOffsetAfterLineNumber(lineNumber, includeViewZones);
    }
    getLineHeightForLineNumber(lineNumber) {
        return this._viewLayout.getLineHeightForLineNumber(lineNumber);
    }
    getDecorationsInViewport() {
        return this.viewportData.getDecorationsInViewport();
    }
}
export class RenderingContext extends RestrictedRenderingContext {
    constructor(viewLayout, viewportData, viewLines, viewLinesGpu) {
        super(viewLayout, viewportData);
        this._renderingContextBrand = undefined;
        this._viewLines = viewLines;
        this._viewLinesGpu = viewLinesGpu;
    }
    linesVisibleRangesForRange(range, includeNewLines) {
        const domRanges = this._viewLines.linesVisibleRangesForRange(range, includeNewLines);
        if (!this._viewLinesGpu) {
            return domRanges;
        }
        const gpuRanges = this._viewLinesGpu.linesVisibleRangesForRange(range, includeNewLines);
        if (!domRanges) {
            return gpuRanges;
        }
        if (!gpuRanges) {
            return domRanges;
        }
        return domRanges.concat(gpuRanges).sort((a, b) => a.lineNumber - b.lineNumber);
    }
    visibleRangeForPosition(position) {
        return this._viewLines.visibleRangeForPosition(position) ?? this._viewLinesGpu?.visibleRangeForPosition(position) ?? null;
    }
}
export class LineVisibleRanges {
    /**
     * Returns the element with the smallest `lineNumber`.
     */
    static firstLine(ranges) {
        if (!ranges) {
            return null;
        }
        let result = null;
        for (const range of ranges) {
            if (!result || range.lineNumber < result.lineNumber) {
                result = range;
            }
        }
        return result;
    }
    /**
     * Returns the element with the largest `lineNumber`.
     */
    static lastLine(ranges) {
        if (!ranges) {
            return null;
        }
        let result = null;
        for (const range of ranges) {
            if (!result || range.lineNumber > result.lineNumber) {
                result = range;
            }
        }
        return result;
    }
    constructor(outsideRenderedLine, lineNumber, ranges, 
    /**
     * Indicates if the requested range does not end in this line, but continues on the next line.
     */
    continuesOnNextLine) {
        this.outsideRenderedLine = outsideRenderedLine;
        this.lineNumber = lineNumber;
        this.ranges = ranges;
        this.continuesOnNextLine = continuesOnNextLine;
    }
}
export class HorizontalRange {
    static from(ranges) {
        const result = new Array(ranges.length);
        for (let i = 0, len = ranges.length; i < len; i++) {
            const range = ranges[i];
            result[i] = new HorizontalRange(range.left, range.width);
        }
        return result;
    }
    constructor(left, width) {
        this._horizontalRangeBrand = undefined;
        this.left = Math.round(left);
        this.width = Math.round(width);
    }
    toString() {
        return `[${this.left},${this.width}]`;
    }
}
export class FloatHorizontalRange {
    constructor(left, width) {
        this._floatHorizontalRangeBrand = undefined;
        this.left = left;
        this.width = width;
    }
    toString() {
        return `[${this.left},${this.width}]`;
    }
    static compare(a, b) {
        return a.left - b.left;
    }
}
export class HorizontalPosition {
    constructor(outsideRenderedLine, left) {
        this.outsideRenderedLine = outsideRenderedLine;
        this.originalLeft = left;
        this.left = Math.round(this.originalLeft);
    }
}
export class VisibleRanges {
    constructor(outsideRenderedLine, ranges) {
        this.outsideRenderedLine = outsideRenderedLine;
        this.ranges = ranges;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyaW5nQ29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci92aWV3L3JlbmRlcmluZ0NvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFhaEcsTUFBTSxPQUFnQiwwQkFBMEI7SUFtQi9DLFlBQVksVUFBdUIsRUFBRSxZQUEwQjtRQWxCL0QscUNBQWdDLEdBQVMsU0FBUyxDQUFDO1FBbUJsRCxJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztRQUM5QixJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVksQ0FBQztRQUVqQyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDckQsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBRXZELElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUM7UUFDbkQsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQztRQUV6RCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDcEQsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDO1FBQzNCLElBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztRQUM3QixJQUFJLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUM7UUFDakMsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBQ3BDLENBQUM7SUFFTSw2QkFBNkIsQ0FBQyxXQUFtQjtRQUN2RCxPQUFPLFdBQVcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ3JDLENBQUM7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