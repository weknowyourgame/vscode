/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createTrustedTypesPolicy } from '../../../../../../base/browser/trustedTypes.js';
import { applyFontInfo } from '../../../../config/domFontInfo.js';
import { EditorFontLigatures } from '../../../../../common/config/editorOptions.js';
import { Position } from '../../../../../common/core/position.js';
import { StringBuilder } from '../../../../../common/core/stringBuilder.js';
import { LineDecoration } from '../../../../../common/viewLayout/lineDecorations.js';
import { RenderLineInput, RenderLineOutput, renderViewLine } from '../../../../../common/viewLayout/viewLineRenderer.js';
import { ViewLineRenderingData } from '../../../../../common/viewModel.js';
import { getColumnOfNodeOffset } from '../../../../viewParts/viewLines/viewLine.js';
const ttPolicy = createTrustedTypesPolicy('diffEditorWidget', { createHTML: value => value });
export function renderLines(source, options, decorations, domNode, noExtra = false) {
    applyFontInfo(domNode, options.fontInfo);
    const hasCharChanges = (decorations.length > 0);
    const sb = new StringBuilder(10000);
    let maxCharsPerLine = 0;
    let renderedLineCount = 0;
    const viewLineCounts = [];
    const renderOutputs = [];
    for (let lineIndex = 0; lineIndex < source.lineTokens.length; lineIndex++) {
        const lineNumber = lineIndex + 1;
        const lineTokens = source.lineTokens[lineIndex];
        const lineBreakData = source.lineBreakData[lineIndex];
        const actualDecorations = LineDecoration.filter(decorations, lineNumber, 1, Number.MAX_SAFE_INTEGER);
        if (lineBreakData) {
            let lastBreakOffset = 0;
            for (const breakOffset of lineBreakData.breakOffsets) {
                const viewLineTokens = lineTokens.sliceAndInflate(lastBreakOffset, breakOffset, 0);
                const result = renderOriginalLine(renderedLineCount, viewLineTokens, LineDecoration.extractWrapped(actualDecorations, lastBreakOffset, breakOffset), hasCharChanges, source.mightContainNonBasicASCII, source.mightContainRTL, options, sb, noExtra);
                maxCharsPerLine = Math.max(maxCharsPerLine, result.maxCharWidth);
                renderOutputs.push(new RenderLineOutputWithOffset(result.output.characterMapping, result.output.containsForeignElements, lastBreakOffset));
                renderedLineCount++;
                lastBreakOffset = breakOffset;
            }
            viewLineCounts.push(lineBreakData.breakOffsets.length);
        }
        else {
            viewLineCounts.push(1);
            const result = renderOriginalLine(renderedLineCount, lineTokens, actualDecorations, hasCharChanges, source.mightContainNonBasicASCII, source.mightContainRTL, options, sb, noExtra);
            maxCharsPerLine = Math.max(maxCharsPerLine, result.maxCharWidth);
            renderOutputs.push(new RenderLineOutputWithOffset(result.output.characterMapping, result.output.containsForeignElements, 0));
            renderedLineCount++;
        }
    }
    maxCharsPerLine += options.scrollBeyondLastColumn;
    const html = sb.build();
    const trustedhtml = ttPolicy ? ttPolicy.createHTML(html) : html;
    domNode.innerHTML = trustedhtml;
    const minWidthInPx = (maxCharsPerLine * options.typicalHalfwidthCharacterWidth);
    return new RenderLinesResult(renderedLineCount, minWidthInPx, viewLineCounts, renderOutputs, source);
}
export class LineSource {
    constructor(lineTokens, lineBreakData = lineTokens.map(t => null), mightContainNonBasicASCII = true, mightContainRTL = true) {
        this.lineTokens = lineTokens;
        this.lineBreakData = lineBreakData;
        this.mightContainNonBasicASCII = mightContainNonBasicASCII;
        this.mightContainRTL = mightContainRTL;
    }
}
export class RenderOptions {
    static fromEditor(editor) {
        const modifiedEditorOptions = editor.getOptions();
        const fontInfo = modifiedEditorOptions.get(59 /* EditorOption.fontInfo */);
        const layoutInfo = modifiedEditorOptions.get(165 /* EditorOption.layoutInfo */);
        return new RenderOptions(editor.getModel()?.getOptions().tabSize || 0, fontInfo, modifiedEditorOptions.get(40 /* EditorOption.disableMonospaceOptimizations */), fontInfo.typicalHalfwidthCharacterWidth, modifiedEditorOptions.get(118 /* EditorOption.scrollBeyondLastColumn */), modifiedEditorOptions.get(75 /* EditorOption.lineHeight */), layoutInfo.decorationsWidth, modifiedEditorOptions.get(133 /* EditorOption.stopRenderingLineAfter */), modifiedEditorOptions.get(113 /* EditorOption.renderWhitespace */), modifiedEditorOptions.get(108 /* EditorOption.renderControlCharacters */), modifiedEditorOptions.get(60 /* EditorOption.fontLigatures */), modifiedEditorOptions.get(117 /* EditorOption.scrollbar */).verticalScrollbarSize);
    }
    constructor(tabSize, fontInfo, disableMonospaceOptimizations, typicalHalfwidthCharacterWidth, scrollBeyondLastColumn, lineHeight, lineDecorationsWidth, stopRenderingLineAfter, renderWhitespace, renderControlCharacters, fontLigatures, verticalScrollbarSize, setWidth = true) {
        this.tabSize = tabSize;
        this.fontInfo = fontInfo;
        this.disableMonospaceOptimizations = disableMonospaceOptimizations;
        this.typicalHalfwidthCharacterWidth = typicalHalfwidthCharacterWidth;
        this.scrollBeyondLastColumn = scrollBeyondLastColumn;
        this.lineHeight = lineHeight;
        this.lineDecorationsWidth = lineDecorationsWidth;
        this.stopRenderingLineAfter = stopRenderingLineAfter;
        this.renderWhitespace = renderWhitespace;
        this.renderControlCharacters = renderControlCharacters;
        this.fontLigatures = fontLigatures;
        this.verticalScrollbarSize = verticalScrollbarSize;
        this.setWidth = setWidth;
    }
    withSetWidth(setWidth) {
        return new RenderOptions(this.tabSize, this.fontInfo, this.disableMonospaceOptimizations, this.typicalHalfwidthCharacterWidth, this.scrollBeyondLastColumn, this.lineHeight, this.lineDecorationsWidth, this.stopRenderingLineAfter, this.renderWhitespace, this.renderControlCharacters, this.fontLigatures, this.verticalScrollbarSize, setWidth);
    }
    withScrollBeyondLastColumn(scrollBeyondLastColumn) {
        return new RenderOptions(this.tabSize, this.fontInfo, this.disableMonospaceOptimizations, this.typicalHalfwidthCharacterWidth, scrollBeyondLastColumn, this.lineHeight, this.lineDecorationsWidth, this.stopRenderingLineAfter, this.renderWhitespace, this.renderControlCharacters, this.fontLigatures, this.verticalScrollbarSize, this.setWidth);
    }
}
export class RenderLinesResult {
    constructor(heightInLines, minWidthInPx, viewLineCounts, _renderOutputs, _source) {
        this.heightInLines = heightInLines;
        this.minWidthInPx = minWidthInPx;
        this.viewLineCounts = viewLineCounts;
        this._renderOutputs = _renderOutputs;
        this._source = _source;
    }
    /**
     * Returns the model position for a given DOM node and offset within that node.
     * @param domNode The span node within a view-line where the offset is located
     * @param offset The offset within the span node
     * @returns The Position in the model, or undefined if the position cannot be determined
     */
    getModelPositionAt(domNode, offset) {
        // Find the view-line element that contains this span
        let viewLineElement = domNode;
        while (viewLineElement && !viewLineElement.classList.contains('view-line')) {
            viewLineElement = viewLineElement.parentElement;
        }
        if (!viewLineElement) {
            return undefined;
        }
        // Find the container that has all view lines
        const container = viewLineElement.parentElement;
        if (!container) {
            return undefined;
        }
        // Find the view line index based on the element
        // eslint-disable-next-line no-restricted-syntax
        const viewLines = container.querySelectorAll('.view-line');
        let viewLineIndex = -1;
        for (let i = 0; i < viewLines.length; i++) {
            if (viewLines[i] === viewLineElement) {
                viewLineIndex = i;
                break;
            }
        }
        if (viewLineIndex === -1 || viewLineIndex >= this._renderOutputs.length) {
            return undefined;
        }
        // Map view line index back to model line
        let modelLineNumber = 1;
        let remainingViewLines = viewLineIndex;
        for (let i = 0; i < this.viewLineCounts.length; i++) {
            if (remainingViewLines < this.viewLineCounts[i]) {
                modelLineNumber = i + 1;
                break;
            }
            remainingViewLines -= this.viewLineCounts[i];
        }
        if (modelLineNumber > this._source.lineTokens.length) {
            return undefined;
        }
        const renderOutput = this._renderOutputs[viewLineIndex];
        if (!renderOutput) {
            return undefined;
        }
        const column = getColumnOfNodeOffset(renderOutput.characterMapping, domNode, offset) + renderOutput.offset;
        return new Position(modelLineNumber, column);
    }
}
class RenderLineOutputWithOffset extends RenderLineOutput {
    constructor(characterMapping, containsForeignElements, offset) {
        super(characterMapping, containsForeignElements);
        this.offset = offset;
    }
}
function renderOriginalLine(viewLineIdx, lineTokens, decorations, hasCharChanges, mightContainNonBasicASCII, mightContainRTL, options, sb, noExtra) {
    sb.appendString('<div class="view-line');
    if (!noExtra && !hasCharChanges) {
        // No char changes
        sb.appendString(' char-delete');
    }
    sb.appendString('" style="top:');
    sb.appendString(String(viewLineIdx * options.lineHeight));
    if (options.setWidth) {
        sb.appendString('px;width:1000000px;">');
    }
    else {
        sb.appendString('px;">');
    }
    const lineContent = lineTokens.getLineContent();
    const isBasicASCII = ViewLineRenderingData.isBasicASCII(lineContent, mightContainNonBasicASCII);
    const containsRTL = ViewLineRenderingData.containsRTL(lineContent, isBasicASCII, mightContainRTL);
    const output = renderViewLine(new RenderLineInput((options.fontInfo.isMonospace && !options.disableMonospaceOptimizations), options.fontInfo.canUseHalfwidthRightwardsArrow, lineContent, false, isBasicASCII, containsRTL, 0, lineTokens, decorations, options.tabSize, 0, options.fontInfo.spaceWidth, options.fontInfo.middotWidth, options.fontInfo.wsmiddotWidth, options.stopRenderingLineAfter, options.renderWhitespace, options.renderControlCharacters, options.fontLigatures !== EditorFontLigatures.OFF, null, // Send no selections, original line cannot be selected
    null, options.verticalScrollbarSize), sb);
    sb.appendString('</div>');
    const maxCharWidth = output.characterMapping.getHorizontalOffset(output.characterMapping.length);
    return { output, maxCharWidth };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyTGluZXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3IvY29tcG9uZW50cy9kaWZmRWRpdG9yVmlld1pvbmVzL3JlbmRlckxpbmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUVsRSxPQUFPLEVBQUUsbUJBQW1CLEVBQW1ELE1BQU0sK0NBQStDLENBQUM7QUFFckksT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUc1RSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDckYsT0FBTyxFQUF3QyxlQUFlLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDL0osT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFFM0UsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFcEYsTUFBTSxRQUFRLEdBQUcsd0JBQXdCLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBRTlGLE1BQU0sVUFBVSxXQUFXLENBQUMsTUFBa0IsRUFBRSxPQUFzQixFQUFFLFdBQStCLEVBQUUsT0FBb0IsRUFBRSxPQUFPLEdBQUcsS0FBSztJQUM3SSxhQUFhLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUV6QyxNQUFNLGNBQWMsR0FBRyxDQUFDLFdB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