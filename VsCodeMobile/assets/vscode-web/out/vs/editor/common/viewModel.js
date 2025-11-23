/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as arrays from '../../base/common/arrays.js';
import * as strings from '../../base/common/strings.js';
export class Viewport {
    constructor(top, left, width, height) {
        this._viewportBrand = undefined;
        this.top = top | 0;
        this.left = left | 0;
        this.width = width | 0;
        this.height = height | 0;
    }
}
export class MinimapLinesRenderingData {
    constructor(tabSize, data) {
        this.tabSize = tabSize;
        this.data = data;
    }
}
export class ViewLineData {
    constructor(content, continuesWithWrappedLine, minColumn, maxColumn, startVisibleColumn, tokens, inlineDecorations) {
        this._viewLineDataBrand = undefined;
        this.content = content;
        this.continuesWithWrappedLine = continuesWithWrappedLine;
        this.minColumn = minColumn;
        this.maxColumn = maxColumn;
        this.startVisibleColumn = startVisibleColumn;
        this.tokens = tokens;
        this.inlineDecorations = inlineDecorations;
    }
}
export class ViewLineRenderingData {
    constructor(minColumn, maxColumn, content, continuesWithWrappedLine, mightContainRTL, mightContainNonBasicASCII, tokens, inlineDecorations, tabSize, startVisibleColumn, textDirection, hasVariableFonts) {
        this.minColumn = minColumn;
        this.maxColumn = maxColumn;
        this.content = content;
        this.continuesWithWrappedLine = continuesWithWrappedLine;
        this.isBasicASCII = ViewLineRenderingData.isBasicASCII(content, mightContainNonBasicASCII);
        this.containsRTL = ViewLineRenderingData.containsRTL(content, this.isBasicASCII, mightContainRTL);
        this.tokens = tokens;
        this.inlineDecorations = inlineDecorations;
        this.tabSize = tabSize;
        this.startVisibleColumn = startVisibleColumn;
        this.textDirection = textDirection;
        this.hasVariableFonts = hasVariableFonts;
    }
    static isBasicASCII(lineContent, mightContainNonBasicASCII) {
        if (mightContainNonBasicASCII) {
            return strings.isBasicASCII(lineContent);
        }
        return true;
    }
    static containsRTL(lineContent, isBasicASCII, mightContainRTL) {
        if (!isBasicASCII && mightContainRTL) {
            return strings.containsRTL(lineContent);
        }
        return false;
    }
}
export class ViewModelDecoration {
    constructor(range, options) {
        this._viewModelDecorationBrand = undefined;
        this.range = range;
        this.options = options;
    }
}
export class OverviewRulerDecorationsGroup {
    constructor(color, zIndex, 
    /**
     * Decorations are encoded in a number array using the following scheme:
     *  - 3*i = lane
     *  - 3*i+1 = startLineNumber
     *  - 3*i+2 = endLineNumber
     */
    data) {
        this.color = color;
        this.zIndex = zIndex;
        this.data = data;
    }
    static compareByRenderingProps(a, b) {
        if (a.zIndex === b.zIndex) {
            if (a.color < b.color) {
                return -1;
            }
            if (a.color > b.color) {
                return 1;
            }
            return 0;
        }
        return a.zIndex - b.zIndex;
    }
    static equals(a, b) {
        return (a.color === b.color
            && a.zIndex === b.zIndex
            && arrays.equals(a.data, b.data));
    }
    static equalsArr(a, b) {
        return arrays.equals(a, b, OverviewRulerDecorationsGroup.equals);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld01vZGVsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb21tb24vdmlld01vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxNQUFNLE1BQU0sNkJBQTZCLENBQUM7QUFFdEQsT0FBTyxLQUFLLE9BQU8sTUFBTSw4QkFBOEIsQ0FBQztBQTZNeEQsTUFBTSxPQUFPLFFBQVE7SUFRcEIsWUFBWSxHQUFXLEVBQUUsSUFBWSxFQUFFLEtBQWEsRUFBRSxNQUFjO1FBUDNELG1CQUFjLEdBQVMsU0FBUyxDQUFDO1FBUXpDLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztRQUNuQixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLENBQUM7UUFDckIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUMxQixDQUFDO0NBQ0Q7QUFFRCxNQUFNLE9BQU8seUJBQXlCO0lBSXJDLFlBQ0MsT0FBZSxFQUNmLElBQWdDO1FBRWhDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQ2xCLENBQUM7Q0FDRDtBQUVELE1BQU0sT0FBTyxZQUFZO0lBaUN4QixZQUNDLE9BQWUsRUFDZix3QkFBaUMsRUFDakMsU0FBaUIsRUFDakIsU0FBaUIsRUFDakIsa0JBQTBCLEVBQzFCLE1BQXVCLEVBQ3ZCLGlCQUErRDtRQXZDaEUsdUJBQWtCLEdBQVMsU0FBUyxDQUFDO1FBeUNwQyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsd0JBQXdCLEdBQUcsd0JBQXdCLENBQUM7UUFDekQsSUFBSSxD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