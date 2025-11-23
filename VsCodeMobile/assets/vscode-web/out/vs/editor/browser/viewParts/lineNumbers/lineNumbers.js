/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import './lineNumbers.css';
import * as platform from '../../../../base/common/platform.js';
import { DynamicViewOverlay } from '../../view/dynamicViewOverlay.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import { registerThemingParticipant } from '../../../../platform/theme/common/themeService.js';
import { editorDimmedLineNumber, editorLineNumbers } from '../../../common/core/editorColorRegistry.js';
/**
 * Renders line numbers to the left of the main view lines content.
 */
export class LineNumbersOverlay extends DynamicViewOverlay {
    static { this.CLASS_NAME = 'line-numbers'; }
    constructor(context) {
        super();
        this._context = context;
        this._readConfig();
        this._lastCursorModelPosition = new Position(1, 1);
        this._renderResult = null;
        this._activeModelLineNumber = 1;
        this._context.addEventHandler(this);
    }
    _readConfig() {
        const options = this._context.configuration.options;
        this._lineHeight = options.get(75 /* EditorOption.lineHeight */);
        const lineNumbers = options.get(76 /* EditorOption.lineNumbers */);
        this._renderLineNumbers = lineNumbers.renderType;
        this._renderCustomLineNumbers = lineNumbers.renderFn;
        this._renderFinalNewline = options.get(109 /* EditorOption.renderFinalNewline */);
        const layoutInfo = options.get(165 /* EditorOption.layoutInfo */);
        this._lineNumbersLeft = layoutInfo.lineNumbersLeft;
        this._lineNumbersWidth = layoutInfo.lineNumbersWidth;
    }
    dispose() {
        this._context.removeEventHandler(this);
        this._renderResult = null;
        super.dispose();
    }
    // --- begin event handlers
    onConfigurationChanged(e) {
        this._readConfig();
        return true;
    }
    onCursorStateChanged(e) {
        const primaryViewPosition = e.selections[0].getPosition();
        this._lastCursorModelPosition = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(primaryViewPosition);
        let shouldRender = false;
        if (this._activeModelLineNumber !== this._lastCursorModelPosition.lineNumber) {
            this._activeModelLineNumber = this._lastCursorModelPosition.lineNumber;
            shouldRender = true;
        }
        if (this._renderLineNumbers === 2 /* RenderLineNumbersType.Relative */ || this._renderLineNumbers === 3 /* RenderLineNumbersType.Interval */) {
            shouldRender = true;
        }
        return shouldRender;
    }
    onFlushed(e) {
        return true;
    }
    onLinesChanged(e) {
        return true;
    }
    onLinesDeleted(e) {
        return true;
    }
    onLinesInserted(e) {
        return true;
    }
    onScrollChanged(e) {
        return e.scrollTopChanged;
    }
    onZonesChanged(e) {
        return true;
    }
    onDecorationsChanged(e) {
        return e.affectsLineNumber;
    }
    // --- end event handlers
    _getLineRenderLineNumber(viewLineNumber) {
        const modelPosition = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(viewLineNumber, 1));
        if (modelPosition.column !== 1) {
            return '';
        }
        const modelLineNumber = modelPosition.lineNumber;
        if (this._renderCustomLineNumbers) {
            return this._renderCustomLineNumbers(modelLineNumber);
        }
        if (this._renderLineNumbers === 2 /* RenderLineNumbersType.Relative */) {
            const diff = Math.abs(this._lastCursorModelPosition.lineNumber - modelLineNumber);
            if (diff === 0) {
                return '<span class="relative-current-line-number">' + modelLineNumber + '</span>';
            }
            return String(diff);
        }
        if (this._renderLineNumbers === 3 /* RenderLineNumbersType.Interval */) {
            if (this._lastCursorModelPosition.lineNumber === modelLineNumber) {
                return String(modelLineNumber);
            }
            if (modelLineNumber % 10 === 0) {
                return String(modelLineNumber);
            }
            const finalLineNumber = this._context.viewModel.getLineCount();
            if (modelLineNumber === finalLineNumber) {
                return String(modelLineNumber);
            }
            return '';
        }
        return String(modelLineNumber);
    }
    prepareRender(ctx) {
        if (this._renderLineNumbers === 0 /* RenderLineNumbersType.Off */) {
            this._renderResult = null;
            return;
        }
        const lineHeightClassName = (platform.isLinux ? (this._lineHeight % 2 === 0 ? ' lh-even' : ' lh-odd') : '');
        const visibleStartLineNumber = ctx.visibleRange.startLineNumber;
        const visibleEndLineNumber = ctx.visibleRange.endLineNumber;
        const lineNoDecorations = this._context.viewModel.getDecorationsInViewport(ctx.visibleRange).filter(d => !!d.options.lineNumberClassName);
        lineNoDecorations.sort((a, b) => Range.compareRangesUsingEnds(a.range, b.range));
        let decorationStartIndex = 0;
        const lineCount = this._context.viewModel.getLineCount();
        const output = [];
        for (let lineNumber = visibleStartLineNumber; lineNumber <= visibleEndLineNumber; lineNumber++) {
            const lineIndex = lineNumber - visibleStartLineNumber;
            const modelLineNumber = this._context.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(lineNumber, 1)).lineNumber;
            let renderLineNumber = this._getLineRenderLineNumber(lineNumber);
            let extraClassNames = '';
            // skip decorations whose end positions we've already passed
            while (decorationStartIndex < lineNoDecorations.length && lineNoDecorations[decorationStartIndex].range.endLineNumber < lineNumber) {
                decorationStartIndex++;
            }
            for (let i = decorationStartIndex; i < lineNoDecorations.length; i++) {
                const { range, options } = lineNoDecorations[i];
                if (range.startLineNumber <= lineNumber) {
                    extraClassNames += ' ' + options.lineNumberClassName;
                }
            }
            if (!renderLineNumber && !extraClassNames) {
                output[lineIndex] = '';
                continue;
            }
            if (lineNumber === lineCount && this._context.viewModel.getLineLength(lineNumber) === 0) {
                // this is the last line
                if (this._renderFinalNewline === 'off') {
                    renderLineNumber = '';
                }
                if (this._renderFinalNewline === 'dimmed') {
                    extraClassNames += ' dimmed-line-number';
                }
            }
            if (modelLineNumber === this._activeModelLineNumber) {
                extraClassNames += ' active-line-number';
            }
            output[lineIndex] = (`<div class="${LineNumbersOverlay.CLASS_NAME}${lineHeightClassName}${extraClassNames}" style="left:${this._lineNumbersLeft}px;width:${this._lineNumbersWidth}px;">${renderLineNumber}</div>`);
        }
        this._renderResult = output;
    }
    render(startLineNumber, lineNumber) {
        if (!this._renderResult) {
            return '';
        }
        const lineIndex = lineNumber - startLineNumber;
        if (lineIndex < 0 || lineIndex >= this._renderResult.length) {
            return '';
        }
        return this._renderResult[lineIndex];
    }
}
registerThemingParticipant((theme, collector) => {
    const editorLineNumbersColor = theme.getColor(editorLineNumbers);
    const editorDimmedLineNumberColor = theme.getColor(editorDimmedLineNumber);
    if (editorDimmedLineNumberColor) {
        collector.addRule(`.monaco-editor .line-numbers.dimmed-line-number { color: ${editorDimmedLineNumberColor}; }`);
    }
    else if (editorLineNumbersColor) {
        collector.addRule(`.monaco-editor .line-numbers.dimmed-line-number { color: ${editorLineNumbersColor.transparent(0.4)}; }`);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluZU51bWJlcnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvdmlld1BhcnRzL2xpbmVOdW1iZXJzL2xpbmVOdW1iZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sbUJBQW1CLENBQUM7QUFDM0IsT0FBTyxLQUFLLFFBQVEsTUFBTSxxQ0FBcUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUV0RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDNUQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBSXRELE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQy9GLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRXhHOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGtCQUFtQixTQUFRLGtCQUFrQjthQUVsQyxlQUFVLEdBQUcsY0FBYyxDQUFDO0lBY25ELFlBQVksT0FBb0I7UUFDL0IsS0FBSyxFQUFFLENBQUM7UUFDUixJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQztRQUV4QixJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFbkIsSUFBSSxDQUFDLHdCQUF3QixHQUFHLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztRQUMxQixJQUFJLENBQUMsc0JBQXNCLEdBQUcsQ0FBQyxDQUFDO1FBQ2hDLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFFTyxXQUFXO1FBQ2xCLE1BQU0sT0FBTyxHQUFHLElBQUks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