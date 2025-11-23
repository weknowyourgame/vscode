/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as dom from '../../../../base/browser/dom.js';
import { createFastDomNode } from '../../../../base/browser/fastDomNode.js';
import * as strings from '../../../../base/common/strings.js';
import { applyFontInfo } from '../../config/domFontInfo.js';
import { TextEditorCursorStyle } from '../../../common/config/editorOptions.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import { MOUSE_CURSOR_TEXT_CSS_CLASS_NAME } from '../../../../base/browser/ui/mouseCursor/mouseCursor.js';
class ViewCursorRenderData {
    constructor(top, left, paddingLeft, width, height, textContent, textContentClassName) {
        this.top = top;
        this.left = left;
        this.paddingLeft = paddingLeft;
        this.width = width;
        this.height = height;
        this.textContent = textContent;
        this.textContentClassName = textContentClassName;
    }
}
export var CursorPlurality;
(function (CursorPlurality) {
    CursorPlurality[CursorPlurality["Single"] = 0] = "Single";
    CursorPlurality[CursorPlurality["MultiPrimary"] = 1] = "MultiPrimary";
    CursorPlurality[CursorPlurality["MultiSecondary"] = 2] = "MultiSecondary";
})(CursorPlurality || (CursorPlurality = {}));
export class ViewCursor {
    constructor(context, plurality) {
        this._context = context;
        const options = this._context.configuration.options;
        const fontInfo = options.get(59 /* EditorOption.fontInfo */);
        this._cursorStyle = options.get(161 /* EditorOption.effectiveCursorStyle */);
        this._typicalHalfwidthCharacterWidth = fontInfo.typicalHalfwidthCharacterWidth;
        this._lineCursorWidth = Math.min(options.get(37 /* EditorOption.cursorWidth */), this._typicalHalfwidthCharacterWidth);
        this._lineCursorHeight = options.get(38 /* EditorOption.cursorHeight */);
        this._isVisible = true;
        // Create the dom node
        this._domNode = createFastDomNode(document.createElement('div'));
        this._domNode.setClassName(`cursor ${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`);
        this._domNode.setHeight(this._context.viewLayout.getLineHeightForLineNumber(1));
        this._domNode.setTop(0);
        this._domNode.setLeft(0);
        applyFontInfo(this._domNode, fontInfo);
        this._domNode.setDisplay('none');
        this._position = new Position(1, 1);
        this._pluralityClass = '';
        this.setPlurality(plurality);
        this._lastRenderedContent = '';
        this._renderData = null;
    }
    getDomNode() {
        return this._domNode;
    }
    getPosition() {
        return this._position;
    }
    setPlurality(plurality) {
        switch (plurality) {
            default:
            case CursorPlurality.Single:
                this._pluralityClass = '';
                break;
            case CursorPlurality.MultiPrimary:
                this._pluralityClass = 'cursor-primary';
                break;
            case CursorPlurality.MultiSecondary:
                this._pluralityClass = 'cursor-secondary';
                break;
        }
    }
    show() {
        if (!this._isVisible) {
            this._domNode.setVisibility('inherit');
            this._isVisible = true;
        }
    }
    hide() {
        if (this._isVisible) {
            this._domNode.setVisibility('hidden');
            this._isVisible = false;
        }
    }
    onConfigurationChanged(e) {
        const options = this._context.configuration.options;
        const fontInfo = options.get(59 /* EditorOption.fontInfo */);
        this._cursorStyle = options.get(161 /* EditorOption.effectiveCursorStyle */);
        this._typicalHalfwidthCharacterWidth = fontInfo.typicalHalfwidthCharacterWidth;
        this._lineCursorWidth = Math.min(options.get(37 /* EditorOption.cursorWidth */), this._typicalHalfwidthCharacterWidth);
        this._lineCursorHeight = options.get(38 /* EditorOption.cursorHeight */);
        applyFontInfo(this._domNode, fontInfo);
        return true;
    }
    onCursorPositionChanged(position, pauseAnimation) {
        if (pauseAnimation) {
            this._domNode.domNode.style.transitionProperty = 'none';
        }
        else {
            this._domNode.domNode.style.transitionProperty = '';
        }
        this._position = position;
        return true;
    }
    /**
     * If `this._position` is inside a grapheme, returns the position where the grapheme starts.
     * Also returns the next grapheme.
     */
    _getGraphemeAwarePosition() {
        const { lineNumber, column } = this._position;
        const lineContent = this._context.viewModel.getLineContent(lineNumber);
        const [startOffset, endOffset] = strings.getCharContainingOffset(lineContent, column - 1);
        return [new Position(lineNumber, startOffset + 1), lineContent.substring(startOffset, endOffset)];
    }
    _prepareRender(ctx) {
        let textContent = '';
        let textContentClassName = '';
        const [position, nextGrapheme] = this._getGraphemeAwarePosition();
        const lineHeight = this._context.viewLayout.getLineHeightForLineNumber(position.lineNumber);
        const lineCursorHeight = (this._lineCursorHeight === 0
            ? lineHeight // 0 indicates that the cursor should take the full line height
            : Math.min(lineHeight, this._lineCursorHeight));
        const lineHeightAdjustment = (lineHeight - lineCursorHeight) / 2;
        if (this._cursorStyle === TextEditorCursorStyle.Line || this._cursorStyle === TextEditorCursorStyle.LineThin) {
            const visibleRange = ctx.visibleRangeForPosition(position);
            if (!visibleRange || visibleRange.outsideRenderedLine) {
                // Outside viewport
                return null;
            }
            const window = dom.getWindow(this._domNode.domNode);
            let width;
            if (this._cursorStyle === TextEditorCursorStyle.Line) {
                width = dom.computeScreenAwareSize(window, this._lineCursorWidth > 0 ? this._lineCursorWidth : 2);
                if (width > 2) {
                    textContent = nextGrapheme;
                    textContentClassName = this._getTokenClassName(position);
                }
            }
            else {
                width = dom.computeScreenAwareSize(window, 1);
            }
            let left = visibleRange.left;
            let paddingLeft = 0;
            if (width >= 2 && left >= 1) {
                // shift the cursor a bit between the characters
                paddingLeft = 1;
                left -= paddingLeft;
            }
            const top = ctx.getVerticalOffsetForLineNumber(position.lineNumber) - ctx.bigNumbersDelta + lineHeightAdjustment;
            return new ViewCursorRenderData(top, left, paddingLeft, width, lineCursorHeight, textContent, textContentClassName);
        }
        const visibleRangeForCharacter = ctx.linesVisibleRangesForRange(new Range(position.lineNumber, position.column, position.lineNumber, position.column + nextGrapheme.length), false);
        if (!visibleRangeForCharacter || visibleRangeForCharacter.length === 0) {
            // Outside viewport
            return null;
        }
        const firstVisibleRangeForCharacter = visibleRangeForCharacter[0];
        if (firstVisibleRangeForCharacter.outsideRenderedLine || firstVisibleRangeForCharacter.ranges.length === 0) {
            // Outside viewport
            return null;
        }
        const range = firstVisibleRangeForCharacter.ranges[0];
        const width = (nextGrapheme === '\t'
            ? this._typicalHalfwidthCharacterWidth
            : (range.width < 1
                ? this._typicalHalfwidthCharacterWidth
                : range.width));
        if (this._cursorStyle === TextEditorCursorStyle.Block) {
            textContent = nextGrapheme;
            textContentClassName = this._getTokenClassName(position);
        }
        let top = ctx.getVerticalOffsetForLineNumber(position.lineNumber) - ctx.bigNumbersDelta;
        let height = lineHeight;
        // Underline might interfere with clicking
        if (this._cursorStyle === TextEditorCursorStyle.Underline || this._cursorStyle === TextEditorCursorStyle.UnderlineThin) {
            top += lineHeight - 2;
            height = 2;
        }
        return new ViewCursorRenderData(top, range.left, 0, width, height, textContent, textContentClassName);
    }
    _getTokenClassName(position) {
        const lineData = this._context.viewModel.getViewLineData(position.lineNumber);
        const tokenIndex = lineData.tokens.findTokenIndexAtOffset(position.column - 1);
        return lineData.tokens.getClassName(tokenIndex);
    }
    prepareRender(ctx) {
        this._renderData = this._prepareRender(ctx);
    }
    render(ctx) {
        if (!this._renderData) {
            this._domNode.setDisplay('none');
            return null;
        }
        if (this._lastRenderedContent !== this._renderData.textContent) {
            this._lastRenderedContent = this._renderData.textContent;
            this._domNode.domNode.textContent = this._lastRenderedContent;
        }
        this._domNode.setClassName(`cursor ${this._pluralityClass} ${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME} ${this._renderData.textContentClassName}`);
        this._domNode.setDisplay('block');
        this._domNode.setTop(this._renderData.top);
        this._domNode.setLeft(this._renderData.left);
        this._domNode.setPaddingLeft(this._renderData.paddingLeft);
        this._domNode.setWidth(this._renderData.width);
        this._domNode.setLineHeight(this._renderData.height);
        this._domNode.setHeight(this._renderData.height);
        return {
            domNode: this._domNode.domNode,
            position: this._position,
            contentLeft: this._renderData.left,
            height: this._renderData.height,
            width: 2
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld0N1cnNvci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci92aWV3UGFydHMvdmlld0N1cnNvcnMvdmlld0N1cnNvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBZSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3pGLE9BQU8sS0FBSyxPQUFPLE1BQU0sb0NBQW9DLENBQUM7QUFDOUQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQzVELE9BQU8sRUFBRSxxQkFBcUIsRUFBZ0IsTUFBTSx5Q0FBeUMsQ0FBQztBQUM5RixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDNUQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBSXRELE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBVTFHLE1BQU0sb0JBQW9CO0lBQ3pCLFlBQ2lCLEdBQVcsRUFDWCxJQUFZLEVBQ1osV0FBbUIsRUFDbkIsS0FBYSxFQUNiLE1BQWMsRUFDZCxXQUFtQixFQUNuQixvQkFBNEI7UUFONUIsUUFBRyxHQUFILEdBQUcsQ0FBUTtRQUNYLFNBQUksR0FBSixJQUFJLENBQVE7UUFDWixnQkFBVyxHQUFYLFdBQVcsQ0FBUTtRQUNuQixVQUFLLEdBQUwsS0FBSyxDQUFRO1FBQ2IsV0FBTSxHQUFOLE1BQU0sQ0FBUTtRQUNkLGdCQUFXLEdBQVgsV0FBVyxDQUFRO1FBQ25CLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBUTtJQUN6QyxDQUFDO0NBQ0w7QUFFRCxNQUFNLENBQU4sSUFBWSxlQUlYO0FBSkQsV0FBWSxlQUFlO0lBQzFCLHlEQUFNLENBQUE7SUFDTixxRUFBWSxD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