/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as dom from '../../../../base/browser/dom.js';
import { createTrustedTypesPolicy } from '../../../../base/browser/trustedTypes.js';
import { equals } from '../../../../base/common/arrays.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import './stickyScroll.css';
import { getColumnOfNodeOffset } from '../../../browser/viewParts/viewLines/viewLine.js';
import { EmbeddedCodeEditorWidget } from '../../../browser/widget/codeEditor/embeddedCodeEditorWidget.js';
import { Position } from '../../../common/core/position.js';
import { StringBuilder } from '../../../common/core/stringBuilder.js';
import { LineDecoration } from '../../../common/viewLayout/lineDecorations.js';
import { RenderLineInput, renderViewLine } from '../../../common/viewLayout/viewLineRenderer.js';
import { foldingCollapsedIcon, foldingExpandedIcon } from '../../folding/browser/foldingDecorations.js';
import { Emitter } from '../../../../base/common/event.js';
export class StickyScrollWidgetState {
    constructor(startLineNumbers, endLineNumbers, lastLineRelativePosition, showEndForLine = null) {
        this.startLineNumbers = startLineNumbers;
        this.endLineNumbers = endLineNumbers;
        this.lastLineRelativePosition = lastLineRelativePosition;
        this.showEndForLine = showEndForLine;
    }
    equals(other) {
        return !!other
            && this.lastLineRelativePosition === other.lastLineRelativePosition
            && this.showEndForLine === other.showEndForLine
            && equals(this.startLineNumbers, other.startLineNumbers)
            && equals(this.endLineNumbers, other.endLineNumbers);
    }
    static get Empty() {
        return new StickyScrollWidgetState([], [], 0);
    }
}
const _ttPolicy = createTrustedTypesPolicy('stickyScrollViewLayer', { createHTML: value => value });
const STICKY_INDEX_ATTR = 'data-sticky-line-index';
const STICKY_IS_LINE_ATTR = 'data-sticky-is-line';
const STICKY_IS_LINE_NUMBER_ATTR = 'data-sticky-is-line-number';
const STICKY_IS_FOLDING_ICON_ATTR = 'data-sticky-is-folding-icon';
export class StickyScrollWidget extends Disposable {
    get height() { return this._height; }
    constructor(editor) {
        super();
        this._foldingIconStore = this._register(new DisposableStore());
        this._rootDomNode = document.createElement('div');
        this._lineNumbersDomNode = document.createElement('div');
        this._linesDomNodeScrollable = document.createElement('div');
        this._linesDomNode = document.createElement('div');
        this._renderedStickyLines = [];
        this._lineNumbers = [];
        this._lastLineRelativePosition = 0;
        this._minContentWidthInPx = 0;
        this._isOnGlyphMargin = false;
        this._height = -1;
        this._onDidChangeStickyScrollHeight = this._register(new Emitter());
        this.onDidChangeStickyScrollHeight = this._onDidChangeStickyScrollHeight.event;
        this._editor = editor;
        this._lineHeight = editor.getOption(75 /* EditorOption.lineHeight */);
        this._lineNumbersDomNode.className = 'sticky-widget-line-numbers';
        this._lineNumbersDomNode.setAttribute('role', 'none');
        this._linesDomNode.className = 'sticky-widget-lines';
        this._linesDomNode.setAttribute('role', 'list');
        this._linesDomNodeScrollable.className = 'sticky-widget-lines-scrollable';
        this._linesDomNodeScrollable.appendChild(this._linesDomNode);
        this._rootDomNode.className = 'sticky-widget';
        this._rootDomNode.classList.toggle('peek', editor instanceof EmbeddedCodeEditorWidget);
        this._rootDomNode.appendChild(this._lineNumbersDomNode);
        this._rootDomNode.appendChild(this._linesDomNodeScrollable);
        this._setHeight(0);
        const updateScrollLeftPosition = () => {
            this._linesDomNode.style.left = this._editor.getOption(131 /* EditorOption.stickyScroll */).scrollWithEditor ? `-${this._editor.getScrollLeft()}px` : '0px';
        };
        this._register(this._editor.onDidChangeConfiguration((e) => {
            if (e.hasChanged(131 /* EditorOption.stickyScroll */)) {
                updateScrollLeftPosition();
            }
            if (e.hasChanged(75 /* EditorOption.lineHeight */)) {
                this._lineHeight = this._editor.getOption(75 /* EditorOption.lineHeight */);
            }
        }));
        this._register(this._editor.onDidScrollChange((e) => {
            if (e.scrollLeftChanged) {
                updateScrollLeftPosition();
            }
            if (e.scrollWidthChanged) {
                this._updateWidgetWidth();
            }
        }));
        this._register(this._editor.onDidChangeModel(() => {
            updateScrollLeftPosition();
            this._updateWidgetWidth();
        }));
        updateScrollLeftPosition();
        this._register(this._editor.onDidLayoutChange((e) => {
            this._updateWidgetWidth();
        }));
        this._updateWidgetWidth();
    }
    get lineNumbers() {
        return this._lineNumbers;
    }
    get lineNumberCount() {
        return this._lineNumbers.length;
    }
    getRenderedStickyLine(lineNumber) {
        return this._renderedStickyLines.find(stickyLine => stickyLine.lineNumber === lineNumber);
    }
    getCurrentLines() {
        return this._lineNumbers;
    }
    setState(state, foldingModel, rebuildFromIndexCandidate) {
        const currentStateAndPreviousStateUndefined = !this._state && !state;
        const currentStateDefinedAndEqualsPreviousState = this._state && this._state.equals(state);
        if (rebuildFromIndexCandidate === undefined && (currentStateAndPreviousStateUndefined || currentStateDefinedAndEqualsPreviousState)) {
            return;
        }
        const data = this._findRenderingData(state);
        const previousLineNumbers = this._lineNumbers;
        this._lineNumbers = data.lineNumbers;
        this._lastLineRelativePosition = data.lastLineRelativePosition;
        const rebuildFromIndex = this._findIndexToRebuildFrom(previousLineNumbers, this._lineNumbers, rebuildFromIndexCandidate);
        this._renderRootNode(this._lineNumbers, this._lastLineRelativePosition, foldingModel, rebuildFromIndex);
        this._state = state;
    }
    _findRenderingData(state) {
        if (!state) {
            return { lineNumbers: [], lastLineRelativePosition: 0 };
        }
        const candidateLineNumbers = [...state.startLineNumbers];
        if (state.showEndForLine !== null) {
            candidateLineNumbers[state.showEndForLine] = state.endLineNumbers[state.showEndForLine];
        }
        let totalHeight = 0;
        for (let i = 0; i < candidateLineNumbers.length; i++) {
            totalHeight += this._editor.getLineHeightForPosition(new Position(candidateLineNumbers[i], 1));
        }
        if (totalHeight === 0) {
            return { lineNumbers: [], lastLineRelativePosition: 0 };
        }
        return { lineNumbers: candidateLineNumbers, lastLineRelativePosition: state.lastLineRelativePosition };
    }
    _findIndexToRebuildFrom(previousLineNumbers, newLineNumbers, rebuildFromIndexCandidate) {
        if (newLineNumbers.length === 0) {
            return 0;
        }
        if (rebuildFromIndexCandidate !== undefined) {
            return rebuildFromIndexCandidate;
        }
        const validIndex = newLineNumbers.findIndex(startLineNumber => !previousLineNumbers.includes(startLineNumber));
        return validIndex === -1 ? 0 : validIndex;
    }
    _updateWidgetWidth() {
        const layoutInfo = this._editor.getLayoutInfo();
        const lineNumbersWidth = layoutInfo.contentLeft;
        this._lineNumbersDomNode.style.width = `${lineNumbersWidth}px`;
        this._linesDomNodeScrollable.style.setProperty('--vscode-editorStickyScroll-scrollableWidth', `${this._editor.getScrollWidth() - layoutInfo.verticalScrollbarWidth}px`);
        this._rootDomNode.style.width = `${layoutInfo.width - layoutInfo.verticalScrollbarWidth}px`;
    }
    _useFoldingOpacityTransition(requireTransitions) {
        this._lineNumbersDomNode.style.setProperty('--vscode-editorStickyScroll-foldingOpacityTransition', `opacity ${requireTransitions ? 0.5 : 0}s`);
    }
    _setFoldingIconsVisibility(allVisible) {
        for (const line of this._renderedStickyLines) {
            const foldingIcon = line.foldingIcon;
            if (!foldingIcon) {
                continue;
            }
            foldingIcon.setVisible(allVisible ? true : foldingIcon.isCollapsed);
        }
    }
    async _renderRootNode(lineNumbers, lastLineRelativePosition, foldingModel, rebuildFromIndex) {
        const viewModel = this._editor._getViewModel();
        if (!viewModel) {
            this._clearWidget();
            return;
        }
        if (lineNumbers.length === 0) {
            this._clearWidget();
            return;
        }
        const renderedStickyLines = [];
        const lastLineNumber = lineNumbers[lineNumbers.length - 1];
        let top = 0;
        for (let i = 0; i < this._renderedStickyLines.length; i++) {
            if (i < rebuildFromIndex) {
                const renderedLine = this._renderedStickyLines[i];
                renderedStickyLines.push(this._updatePosition(renderedLine, top, renderedLine.lineNumber === lastLineNumber));
                top += renderedLine.height;
            }
            else {
                const renderedLine = this._renderedStickyLines[i];
                renderedLine.lineNumberDomNode.remove();
                renderedLine.lineDomNode.remove();
            }
        }
        const layoutInfo = this._editor.getLayoutInfo();
        for (let i = rebuildFromIndex; i < lineNumbers.length; i++) {
            const stickyLine = this._renderChildNode(viewModel, i, lineNumbers[i], top, lastLineNumber === lineNumbers[i], foldingModel, layoutInfo);
            top += stickyLine.height;
            this._linesDomNode.appendChild(stickyLine.lineDomNode);
            this._lineNumbersDomNode.appendChild(stickyLine.lineNumberDomNode);
            renderedStickyLines.push(stickyLine);
        }
        if (foldingModel) {
            this._setFoldingHoverListeners();
            this._useFoldingOpacityTransition(!this._isOnGlyphMargin);
        }
        this._minContentWidthInPx = Math.max(...this._renderedStickyLines.map(l => l.scrollWidth)) + layoutInfo.verticalScrollbarWidth;
        this._renderedStickyLines = renderedStickyLines;
        this._setHeight(top + lastLineRelativePosition);
        this._editor.layoutOverlayWidget(this);
    }
    _clearWidget() {
        for (let i = 0; i < this._renderedStickyLines.length; i++) {
            const stickyLine = this._renderedStickyLines[i];
            stickyLine.lineNumberDomNode.remove();
            stickyLine.lineDomNode.remove();
        }
        this._setHeight(0);
    }
    _setHeight(height) {
        if (this._height === height) {
            return;
        }
        this._height = height;
        if (this._height === 0) {
            this._rootDomNode.style.display = 'none';
        }
        else {
            this._rootDomNode.style.display = 'block';
            this._lineNumbersDomNode.style.height = `${this._height}px`;
            this._linesDomNodeScrollable.style.height = `${this._height}px`;
            this._rootDomNode.style.height = `${this._height}px`;
        }
        this._onDidChangeStickyScrollHeight.fire({ height: this._height });
    }
    _setFoldingHoverListeners() {
        const showFoldingControls = this._editor.getOption(126 /* EditorOption.showFoldingControls */);
        if (showFoldingControls !== 'mouseover') {
            return;
        }
        this._foldingIconStore.clear();
        this._foldingIconStore.add(dom.addDisposableListener(this._lineNumbersDomNode, dom.EventType.MOUSE_ENTER, () => {
            this._isOnGlyphMargin = true;
            this._setFoldingIconsVisibility(true);
        }));
        this._foldingIconStore.add(dom.addDisposableListener(this._lineNumbersDomNode, dom.EventType.MOUSE_LEAVE, () => {
            this._isOnGlyphMargin = false;
            this._useFoldingOpacityTransition(true);
            this._setFoldingIconsVisibility(false);
        }));
    }
    _renderChildNode(viewModel, index, line, top, isLastLine, foldingModel, layoutInfo) {
        const viewLineNumber = viewModel.coordinatesConverter.convertModelPositionToViewPosition(new Position(line, 1)).lineNumber;
        const lineRenderingData = viewModel.getViewLineRenderingData(viewLineNumber);
        const lineNumberOption = this._editor.getOption(76 /* EditorOption.lineNumbers */);
        const verticalScrollbarSize = this._editor.getOption(117 /* EditorOption.scrollbar */).verticalScrollbarSize;
        let actualInlineDecorations;
        try {
            actualInlineDecorations = LineDecoration.filter(lineRenderingData.inlineDecorations, viewLineNumber, lineRenderingData.minColumn, lineRenderingData.maxColumn);
        }
        catch (err) {
            actualInlineDecorations = [];
        }
        const lineHeight = this._editor.getLineHeightForPosition(new Position(line, 1));
        const textDirection = viewModel.getTextDirection(line);
        const renderLineInput = new RenderLineInput(true, true, lineRenderingData.content, lineRenderingData.continuesWithWrappedLine, lineRenderingData.isBasicASCII, lineRenderingData.containsRTL, 0, lineRenderingData.tokens, actualInlineDecorations, lineRenderingData.tabSize, lineRenderingData.startVisibleColumn, 1, 1, 1, 500, 'none', true, true, null, textDirection, verticalScrollbarSize);
        const sb = new StringBuilder(2000);
        const renderOutput = renderViewLine(renderLineInput, sb);
        let newLine;
        if (_ttPolicy) {
            newLine = _ttPolicy.createHTML(sb.build());
        }
        else {
            newLine = sb.build();
        }
        const lineHTMLNode = document.createElement('span');
        lineHTMLNode.setAttribute(STICKY_INDEX_ATTR, String(index));
        lineHTMLNode.setAttribute(STICKY_IS_LINE_ATTR, '');
        lineHTMLNode.setAttribute('role', 'listitem');
        lineHTMLNode.tabIndex = 0;
        lineHTMLNode.className = 'sticky-line-content';
        lineHTMLNode.classList.add(`stickyLine${line}`);
        lineHTMLNode.style.lineHeight = `${lineHeight}px`;
        lineHTMLNode.innerHTML = newLine;
        const lineNumberHTMLNode = document.createElement('span');
        lineNumberHTMLNode.setAttribute(STICKY_INDEX_ATTR, String(index));
        lineNumberHTMLNode.setAttribute(STICKY_IS_LINE_NUMBER_ATTR, '');
        lineNumberHTMLNode.className = 'sticky-line-number';
        lineNumberHTMLNode.style.lineHeight = `${lineHeight}px`;
        const lineNumbersWidth = layoutInfo.contentLeft;
        lineNumberHTMLNode.style.width = `${lineNumbersWidth}px`;
        const innerLineNumberHTML = document.createElement('span');
        if (lineNumberOption.renderType === 1 /* RenderLineNumbersType.On */ || lineNumberOption.renderType === 3 /* RenderLineNumbersType.Interval */ && line % 10 === 0) {
            innerLineNumberHTML.innerText = line.toString();
        }
        else if (lineNumberOption.renderType === 2 /* RenderLineNumbersType.Relative */) {
            innerLineNumberHTML.innerText = Math.abs(line - this._editor.getPosition().lineNumber).toString();
        }
        innerLineNumberHTML.className = 'sticky-line-number-inner';
        innerLineNumberHTML.style.width = `${layoutInfo.lineNumbersWidth}px`;
        innerLineNumberHTML.style.paddingLeft = `${layoutInfo.lineNumbersLeft}px`;
        lineNumberHTMLNode.appendChild(innerLineNumberHTML);
        const foldingIcon = this._renderFoldingIconForLine(foldingModel, line);
        if (foldingIcon) {
            lineNumberHTMLNode.appendChild(foldingIcon.domNode);
            foldingIcon.domNode.style.left = `${layoutInfo.lineNumbersWidth + layoutInfo.lineNumbersLeft}px`;
            foldingIcon.domNode.style.lineHeight = `${lineHeight}px`;
        }
        this._editor.applyFontInfo(lineHTMLNode);
        this._editor.applyFontInfo(lineNumberHTMLNode);
        lineNumberHTMLNode.style.lineHeight = `${lineHeight}px`;
        lineHTMLNode.style.lineHeight = `${lineHeight}px`;
        lineNumberHTMLNode.style.height = `${lineHeight}px`;
        lineHTMLNode.style.height = `${lineHeight}px`;
        const renderedLine = new RenderedStickyLine(index, line, lineHTMLNode, lineNumberHTMLNode, foldingIcon, renderOutput.characterMapping, lineHTMLNode.scrollWidth, lineHeight);
        return this._updatePosition(renderedLine, top, isLastLine);
    }
    _updatePosition(stickyLine, top, isLastLine) {
        const lineHTMLNode = stickyLine.lineDomNode;
        const lineNumberHTMLNode = stickyLine.lineNumberDomNode;
        if (isLastLine) {
            const zIndex = '0';
            lineHTMLNode.style.zIndex = zIndex;
            lineNumberHTMLNode.style.zIndex = zIndex;
            const updatedTop = `${top + this._lastLineRelativePosition + (stickyLine.foldingIcon?.isCollapsed ? 1 : 0)}px`;
            lineHTMLNode.style.top = updatedTop;
            lineNumberHTMLNode.style.top = updatedTop;
        }
        else {
            const zIndex = '1';
            lineHTMLNode.style.zIndex = zIndex;
            lineNumberHTMLNode.style.zIndex = zIndex;
            lineHTMLNode.style.top = `${top}px`;
            lineNumberHTMLNode.style.top = `${top}px`;
        }
        return stickyLine;
    }
    _renderFoldingIconForLine(foldingModel, line) {
        const showFoldingControls = this._editor.getOption(126 /* EditorOption.showFoldingControls */);
        if (!foldingModel || showFoldingControls === 'never') {
            return;
        }
        const foldingRegions = foldingModel.regions;
        const indexOfFoldingRegion = foldingRegions.findRange(line);
        const startLineNumber = foldingRegions.getStartLineNumber(indexOfFoldingRegion);
        const isFoldingScope = line === startLineNumber;
        if (!isFoldingScope) {
            return;
        }
        const isCollapsed = foldingRegions.isCollapsed(indexOfFoldingRegion);
        const foldingIcon = new StickyFoldingIcon(isCollapsed, startLineNumber, foldingRegions.getEndLineNumber(indexOfFoldingRegion), this._lineHeight);
        foldingIcon.setVisible(this._isOnGlyphMargin ? true : (isCollapsed || showFoldingControls === 'always'));
        foldingIcon.domNode.setAttribute(STICKY_IS_FOLDING_ICON_ATTR, '');
        return foldingIcon;
    }
    getId() {
        return 'editor.contrib.stickyScrollWidget';
    }
    getDomNode() {
        return this._rootDomNode;
    }
    getPosition() {
        return {
            preference: 2 /* OverlayWidgetPositionPreference.TOP_CENTER */,
            stackOrdinal: 10,
        };
    }
    getMinContentWidthInPx() {
        return this._minContentWidthInPx;
    }
    focusLineWithIndex(index) {
        if (0 <= index && index < this._renderedStickyLines.length) {
            this._renderedStickyLines[index].lineDomNode.focus();
        }
    }
    /**
     * Given a leaf dom node, tries to find the editor position.
     */
    getEditorPositionFromNode(spanDomNode) {
        if (!spanDomNode || spanDomNode.children.length > 0) {
            // This is not a leaf node
            return null;
        }
        const renderedStickyLine = this._getRenderedStickyLineFromChildDomNode(spanDomNode);
        if (!renderedStickyLine) {
            return null;
        }
        const column = getColumnOfNodeOffset(renderedStickyLine.characterMapping, spanDomNode, 0);
        return new Position(renderedStickyLine.lineNumber, column);
    }
    getLineNumberFromChildDomNode(domNode) {
        return this._getRenderedStickyLineFromChildDomNode(domNode)?.lineNumber ?? null;
    }
    _getRenderedStickyLineFromChildDomNode(domNode) {
        const index = this.getLineIndexFromChildDomNode(domNode);
        if (index === null || index < 0 || index >= this._renderedStickyLines.length) {
            return null;
        }
        return this._renderedStickyLines[index];
    }
    /**
     * Given a child dom node, tries to find the line number attribute that was stored in the node.
     * @returns the attribute value or null if none is found.
     */
    getLineIndexFromChildDomNode(domNode) {
        const lineIndex = this._getAttributeValue(domNode, STICKY_INDEX_ATTR);
        return lineIndex ? parseInt(lineIndex, 10) : null;
    }
    /**
     * Given a child dom node, tries to find if it is (contained in) a sticky line.
     * @returns a boolean.
     */
    isInStickyLine(domNode) {
        const isInLine = this._getAttributeValue(domNode, STICKY_IS_LINE_ATTR);
        return isInLine !== undefined;
    }
    /**
     * Given a child dom node, tries to find if this dom node is (contained in) a sticky folding icon.
     * @returns a boolean.
     */
    isInFoldingIconDomNode(domNode) {
        const isInFoldingIcon = this._getAttributeValue(domNode, STICKY_IS_FOLDING_ICON_ATTR);
        return isInFoldingIcon !== undefined;
    }
    /**
     * Given the dom node, finds if it or its parent sequence contains the given attribute.
     * @returns the attribute value or undefined.
     */
    _getAttributeValue(domNode, attribute) {
        while (domNode && domNode !== this._rootDomNode) {
            const line = domNode.getAttribute(attribute);
            if (line !== null) {
                return line;
            }
            domNode = domNode.parentElement;
        }
        return;
    }
}
class RenderedStickyLine {
    constructor(index, lineNumber, lineDomNode, lineNumberDomNode, foldingIcon, characterMapping, scrollWidth, height) {
        this.index = index;
        this.lineNumber = lineNumber;
        this.lineDomNode = lineDomNode;
        this.lineNumberDomNode = lineNumberDomNode;
        this.foldingIcon = foldingIcon;
        this.characterMapping = characterMapping;
        this.scrollWidth = scrollWidth;
        this.height = height;
    }
}
class StickyFoldingIcon {
    constructor(isCollapsed, foldingStartLine, foldingEndLine, dimension) {
        this.isCollapsed = isCollapsed;
        this.foldingStartLine = foldingStartLine;
        this.foldingEndLine = foldingEndLine;
        this.dimension = dimension;
        this.domNode = document.createElement('div');
        this.domNode.style.width = `26px`;
        this.domNode.style.height = `${dimension}px`;
        this.domNode.style.lineHeight = `${dimension}px`;
        this.domNode.className = ThemeIcon.asClassName(isCollapsed ? foldingCollapsedIcon : foldingExpandedIcon);
    }
    setVisible(visible) {
        this.domNode.style.cursor = visible ? 'pointer' : 'default';
        this.domNode.style.opacity = visible ? '1' : '0';
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RpY2t5U2Nyb2xsV2lkZ2V0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL3N0aWNreVNjcm9sbC9icm93c2VyL3N0aWNreVNjcm9sbFdpZGdldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMzRCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRSxPQUFPLG9CQUFvQixDQUFDO0FBRTVCLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBRTFHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM1RCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDdEUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQy9FLE9BQU8sRUFBb0IsZUFBZSxFQUFFLGNBQWMsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ25ILE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRXhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUczRCxNQUFNLE9BQU8sdUJBQXVCO0lBQ25DLFlBQ1UsZ0JBQTBCLEVBQzFCLGNBQXdCLEVBQ3hCLHdCQUFnQyxFQUNoQyxpQkFBZ0MsSUFBSTtRQUhwQyxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQVU7UUFDMUIsbUJBQWMsR0FBZCxjQUFjLENBQVU7UUFDeEIsNkJBQXdCLEdBQXhCLHdCQUF3QixDQUFRO1FBQ2hDLG1CQUFjLEdBQWQsY0FBYyxDQUFzQjtJQUMxQyxDQUFDO0lBRUwsTUFBTSxDQUFDLEtBQTBDO1FBQ2hELE9BQU8sQ0FBQyxDQUFDLEtBQUs7ZUFDVixJQUFJLENBQUMsd0JBQXdCLEtBQUssS0FBSyxDQUFDLHdCQUF3QjtlQUNoRSxJQUFJLENBQUMsY0FBYyxLQUFLLEtBQUssQ0FBQyxjQUFjO2VBQzVDLE1BQU0sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLGdCQUFnQixDQUFDO2VBQ3JELE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBRUQsTUFBTSxLQUFLLEtBQUs7UUFDZixPQUFPLElBQUksdUJBQXVCLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMvQyxDQUFDO0NBQ0Q7QUFFRCxNQUFNLFNBQVMsR0FBRyx3QkFBd0IsQ0FBQyx1QkFBdUIsRUFBRSxFQUFFLFVBQVUsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDcEcsTUFBTSxpQkFBaUIsR0FBRyx3QkFBd0IsQ0FBQztBQUNuRCxNQUFNLG1CQUFtQixHQUFHLHFCQUFxQixDQUFDO0FBQ2xELE1BQU0sMEJBQTBCLEdBQUcsNEJBQTRCLENBQUM7QUFDaEUsTUFBTSwyQkFBMkIsR0FBRyw2QkFBNkIsQ0FBQztBQUVsRSxNQUFNLE9BQU8sa0JBQW1CLFNBQVEsVUFBVTtJQW1CakQsSUFBVyxNQUFNLEtBQWEsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUtwRCxZQUNDLE1BQW1CO1FBRW5CLEtBQUssRUFBRSxDQUFDO1FBekJRLHNCQUFpQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxlQUFlLEVBQUUsQ0FBQyxDQUFDO1FBQzFELGlCQUFZLEdBQWdCLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDMUQsd0JBQW1CLEdBQWdCLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDakUsNEJBQXVCLEdBQWdCLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDckUsa0JBQWEsR0FBZ0IsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQU1wRSx5QkFBb0IsR0FBeUIsRUFBRSxDQUFDO1FBQ2hELGlCQUFZLEdBQWEsRUFBRSxDQUFDO1FBQzVCLDhCQUF5QixHQUFXLENBQUMsQ0FBQztRQUN0Qyx5QkFBb0IsR0FBVyxDQUFDLENBQUM7UUFDakMscUJBQWdCLEdBQVksS0FBSyxDQUFDO1FBQ2xDLFlBQU8sR0FBVyxDQUFDLENBQUMsQ0FBQztRQUlaLG1DQUE4QixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQXNCLENBQUMsQ0FBQztRQUNwRixrQ0FBNkIsR0FBRyxJQUFJLENBQUMsOEJBQThCLENBQUMsS0FBSyxDQUFDO1FBT3pGLElBQUksQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxXQUFXLEdBQUcsTUFBTSxDQUFDLFNBQVMsa0NBQXlCLENBQUM7UUFDN0QsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsR0FBRyw0QkFBNEIsQ0FBQztRQUNsRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUV0RCxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsR0FBRyxxQkFBcUIsQ0FBQztRQUNyRCxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFaEQsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFNBQVMsR0FBRyxnQ0FBZ0MsQ0FBQztRQUMxRSxJQUFJLENBQUMsdUJBQXVCLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUU3RCxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsR0FBRyxlQUFlLENBQUM7UUFDOUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxNQUFNLFlBQVksd0JBQXdCLENBQUMsQ0FBQztRQUN2RixJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUN4RCxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUM1RCxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRW5CLE1BQU0sd0JBQXdCLEdBQUcsR0FBRyxFQUFFO1lBQ3JDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMscUNBQTJCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFDbkosQ0FBQyxDQUFDO1FBQ0YsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7WUFDMUQsSUFBSSxDQUFDLENBQUMsVUFBVSxxQ0FBMkIsRUFBRSxDQUFDO2dCQUM3Qyx3QkFBd0IsRUFBRSxDQUFDO1lBQzVCLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQyxVQUFVLGtDQUF5QixFQUFFLENBQUM7Z0JBQzNDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLGtDQUF5QixDQUFDO1lBQ3BFLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0osSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7WUFDbkQsSUFBSSxDQUFDLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztnQkFDekIsd0JBQXdCLEVBQUUsQ0FBQztZQUM1QixDQUFDO1lBQ0QsSUFBSSxDQUFDLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztnQkFDMUIsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDM0IsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDSixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxFQUFFO1lBQ2pELHdCQUF3QixFQUFFLENBQUM7WUFDM0IsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDM0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNKLHdCQUF3QixFQUFFLENBQUM7UUFFM0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7WUFDbkQsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDM0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNKLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0lBQzNCLENBQUM7SUFFRCxJQUFJLFdBQVc7UUFDZCxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUM7SUFDMUIsQ0FBQztJQUVELElBQUksZUFBZTtRQUNsQixPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDO0lBQ2pDLENBQUM7SUFFRCxxQkFBcUIsQ0FBQyxVQUFrQjtRQUN2QyxPQUFPLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxLQUFLLFVBQVUsQ0FBQyxDQUFDO0lBQzNGLENBQUM7SUFFRCxlQUFlO1FBQ2QsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDO0lBQzFCLENBQUM7SUFFRCxRQUFRLENBQUMsS0FBMEMsRUFBRSxZQUFzQyxFQUFFLHlCQUFrQztRQUM5SCxNQUFNLHFDQUFxQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQztRQUNyRSxNQUFNLHlDQUF5QyxHQUFHLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDM0YsSUFBSSx5QkFBeUIsS0FBSyxTQUFTLElBQUksQ0FBQyxxQ0FBcUMsSUFBSSx5Q0FBeUMsQ0FBQyxFQUFFLENBQUM7WUFDckksT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDNUMsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO1FBQzlDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUNyQyxJQUFJLENBQUMseUJBQXlCLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixDQUFDO1FBQy9ELE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUseUJBQXlCLENBQUMsQ0FBQztRQUN6SCxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLHlCQUF5QixFQUFFLFlBQVksRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3hHLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO0lBQ3JCLENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxLQUEwQztRQUNwRSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDWixPQUFPLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRSx3QkFBd0IsRUFBRSxDQUFDLEVBQUUsQ0FBQztRQUN6RCxDQUFDO1FBQ0QsTUFBTSxvQkFBb0IsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDekQsSUFBSSxLQUFLLENBQUMsY0FBYyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ25DLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUN6RixDQUFDO1FBQ0QsSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxvQkFBb0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUN0RCxXQUFXLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2hHLENBQUM7UUFDRCxJQUFJLFdBQVcsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUN2QixPQUFPLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRSx3QkFBd0IsRUFBRSxDQUFDLEVBQUUsQ0FBQztRQUN6RCxDQUFDO1FBQ0QsT0FBTyxFQUFFLFdBQVcsRUFBRSxvQkFBb0IsRUFBRSx3QkFBd0IsRUFBRSxLQUFLLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztJQUN4RyxDQUFDO0lBRU8sdUJBQXVCLENBQUMsbUJBQTZCLEVBQUUsY0FBd0IsRUFBRSx5QkFBa0M7UUFDMUgsSUFBSSxjQUFjLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ2pDLE9BQU8sQ0FBQyxDQUFDO1FBQ1YsQ0FBQztRQUNELElBQUkseUJBQXlCLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDN0MsT0FBTyx5QkFBeUIsQ0FBQztRQUNsQyxDQUFDO1FBQ0QsTUFBTSxVQUFVLEdBQUcsY0FBYyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7UUFDL0csT0FBTyxVQUFVLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDO0lBQzNDLENBQUM7SUFFTyxrQkFBa0I7UUFDekIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUNoRCxNQUFNLGdCQUFnQixHQUFHLFVBQVUsQ0FBQyxXQUFXLENBQUM7UUFDaEQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxnQkFBZ0IsSUFBSSxDQUFDO1FBQy9ELElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLDZDQUE2QyxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQUUsR0FBRyxVQUFVLENBQUMsc0JBQXNCLElBQUksQ0FBQyxDQUFDO1FBQ3hLLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLFVBQVUsQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLHNCQUFzQixJQUFJLENBQUM7SUFDN0YsQ0FBQztJQUVPLDRCQUE0QixDQUFDLGtCQUEyQjtRQUMvRCxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxzREFBc0QsRUFBRSxXQUFXLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDaEosQ0FBQztJQUVPLDBCQUEwQixDQUFDLFVBQW1CO1FBQ3JELEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFDOUMsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUNyQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ2xCLFNBQVM7WUFDVixDQUFDO1lBQ0QsV0FBVyxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7SUFDRixDQUFDO0lBRU8sS0FBSyxDQUFDLGVBQWUsQ0FBQyxXQUFxQixFQUFFLHdCQUFnQyxFQUFFLFlBQXNDLEVBQUUsZ0JBQXdCO1FBQ3RKLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDL0MsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNwQixPQUFPO1FBQ1IsQ0FBQztRQUNELElBQUksV0FBVyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUM5QixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDcEIsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLG1CQUFtQixHQUF5QixFQUFFLENBQUM7UUFDckQsTUFBTSxjQUFjLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDM0QsSUFBSSxHQUFHLEdBQVcsQ0FBQyxDQUFDO1FBQ3BCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDM0QsSUFBSSxDQUFDLEdBQUcsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDMUIsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNsRCxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFLFlBQVksQ0FBQyxVQUFVLEtBQUssY0FBYyxDQUFDLENBQUMsQ0FBQztnQkFDOUcsR0FBRyxJQUFJLFlBQVksQ0FBQyxNQUFNLENBQUM7WUFDNUIsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDbEQsWUFBWSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUN4QyxZQUFZLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ25DLENBQUM7UUFDRixDQUFDO1FBQ0QsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUNoRCxLQUFLLElBQUksQ0FBQyxHQUFHLGdCQUFnQixFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDNUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxjQUFjLEtBQUssV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFLFlBQVksRUFBRSxVQUFVLENBQUMsQ0FBQztZQUN6SSxHQUFHLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztZQUN6QixJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDdkQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUNuRSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDdEMsQ0FBQztRQUNELElBQUksWUFBWSxFQUFFLENBQUM7WUFDbEIsSUFBSSxDQUFDLHlCQUF5QixFQUFFLENBQUM7WUFDakMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDM0QsQ0FBQztRQUNELElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxzQkFBc0IsQ0FBQztRQUMvSCxJQUFJLENBQUMsb0JBQW9CLEdBQUcsbUJBQW1CLENBQUM7UUFDaEQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEdBQUcsd0JBQXdCLENBQUMsQ0FBQztRQUNoRCxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFTyxZQUFZO1FBQ25CLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDM0QsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2hELFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN0QyxVQUFVLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2pDLENBQUM7UUFDRCxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3BCLENBQUM7SUFFTyxVQUFVLENBQUMsTUFBYztRQUNoQyxJQUFJLElBQUksQ0FBQyxPQUFPLEtBQUssTUFBTSxFQUFFLENBQUM7WUFDN0IsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQztRQUV0QixJQUFJLElBQUksQ0FBQyxPQUFPLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDeEIsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQztRQUMxQyxDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7WUFDMUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUM7WUFDNUQsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUM7WUFDaEUsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDO1FBQ3RELENBQUM7UUFFRCxJQUFJLENBQUMsOEJBQThCLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFFTyx5QkFBeUI7UUFDaEMsTUFBTSxtQkFBbUIsR0FBcUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLDRDQUFrQyxDQUFDO1FBQ3ZILElBQUksbUJBQW1CLEtBQUssV0FBVyxFQUFFLENBQUM7WUFDekMsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDL0IsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRTtZQUM5RyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDO1lBQzdCLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0osSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRTtZQUM5RyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDO1lBQzlCLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN4QyxJQUFJLENBQUMsMEJBQTBCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDeEMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyxnQkFBZ0IsQ0FBQyxTQUFxQixFQUFFLEtBQWEsRUFBRSxJQUFZLEVBQUUsR0FBVyxFQUFFLFVBQW1CLEVBQUUsWUFBc0MsRUFBRSxVQUE0QjtRQUNsTCxNQUFNLGNBQWMsR0FBRyxTQUFTLENBQUMsb0JBQW9CLENBQUMsa0NBQWtDLENBQUMsSUFBSSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDO1FBQzNILE1BQU0saUJBQWlCLEdBQUcsU0FBUyxDQUFDLHdCQUF3QixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzdFLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLG1DQUEwQixDQUFDO1FBQzFFLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLGtDQUF3QixDQUFDLHFCQUFxQixDQUFDO1FBRW5HLElBQUksdUJBQXlDLENBQUM7UUFDOUMsSUFBSSxDQUFDO1lBQ0osdUJBQXVCLEdBQUcsY0FBYyxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUIsRUFBRSxjQUFjLEVBQUUsaUJBQWlCLENBQUMsU0FBUyxFQUFFLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2hLLENBQUM7UUFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1lBQ2QsdUJBQXVCLEdBQUcsRUFBRSxDQUFDO1FBQzlCLENBQUM7UUFFRCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLHdCQUF3QixDQUFDLElBQUksUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2hGLE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2RCxNQUFNLGVBQWUsR0FBb0IsSUFBSSxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxpQkFBaUIsQ0FBQyxPQUFPLEVBQ2pHLGlCQUFpQixDQUFDLHdCQUF3QixFQUMxQyxpQkFBaUIsQ0FBQyxZQUFZLEVBQUUsaUJBQWlCLENBQUMsV0FBVyxFQUFFLENBQUMsRUFDaEUsaUJBQWlCLENBQUMsTUFBTSxFQUFFLHVCQUF1QixFQUNqRCxpQkFBaUIsQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLENBQUMsa0JBQWtCLEVBQy9ELENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RDLGFBQWEsRUFBRSxxQkFBcUIsQ0FDcEMsQ0FBQztRQUVGLE1BQU0sRUFBRSxHQUFHLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ25DLE1BQU0sWUFBWSxHQUFHLGNBQWMsQ0FBQyxlQUFlLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFekQsSUFBSSxPQUFPLENBQUM7UUFDWixJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2YsT0FBTyxHQUFHLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDNUMsQ0FBQzthQUFNLENBQUM7WUFDUCxPQUFPLEdBQUcsRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ3RCLENBQUM7UUFFRCxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3BELFlBQVksQ0FBQyxZQUFZLENBQUMsaUJBQWlCLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDNUQsWUFBWSxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNuRCxZQUFZLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztRQUM5QyxZQUFZLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQztRQUMxQixZQUFZLENBQUMsU0FBUyxHQUFHLHFCQUFxQixDQUFDO1FBQy9DLFlBQVksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLGFBQWEsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNoRCxZQUFZLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxHQUFHLFVBQVUsSUFBSSxDQUFDO1FBQ2xELFlBQVksQ0FBQyxTQUFTLEdBQUcsT0FBaUIsQ0FBQztRQUUzQyxNQUFNLGtCQUFrQixHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDMUQsa0JBQWtCLENBQUMsWUFBWSxDQUFDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ2xFLGtCQUFrQixDQUFDLFlBQVksQ0FBQywwQkFBMEIsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNoRSxrQkFBa0IsQ0FBQyxTQUFTLEdBQUcsb0JBQW9CLENBQUM7UUFDcEQsa0JBQWtCLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxHQUFHLFVBQVUsSUFBSSxDQUFDO1FBQ3hELE1BQU0sZ0JBQWdCLEdBQUcsVUFBVSxDQUFDLFdBQVcsQ0FBQztRQUNoRCxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUcsZ0JBQWdCLElBQUksQ0FBQztRQUV6RCxNQUFNLG1CQUFtQixHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDM0QsSUFBSSxnQkFBZ0IsQ0FBQyxVQUFVLHFDQUE2QixJQUFJLGdCQUFnQixDQUFDLFVBQVUsMkNBQW1DLElBQUksSUFBSSxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNuSixtQkFBbUIsQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2pELENBQUM7YUFBTSxJQUFJLGdCQUFnQixDQUFDLFVBQVUsMkNBQW1DLEVBQUUsQ0FBQztZQUMzRSxtQkFBbUIsQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNwRyxDQUFDO1FBQ0QsbUJBQW1CLENBQUMsU0FBUyxHQUFHLDBCQUEwQixDQUFDO1FBQzNELG1CQUFtQixDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxVQUFVLENBQUMsZ0JBQWdCLElBQUksQ0FBQztRQUNyRSxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsV0FBVyxHQUFHLEdBQUcsVUFBVSxDQUFDLGVBQWUsSUFBSSxDQUFDO1FBRTFFLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3BELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDdkUsSUFBSSxXQUFXLEVBQUUsQ0FBQztZQUNqQixrQkFBa0IsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3BELFdBQVcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxHQUFHLFVBQVUsQ0FBQyxnQkFBZ0IsR0FBRyxVQUFVLENBQUMsZUFBZSxJQUFJLENBQUM7WUFDakcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLEdBQUcsVUFBVSxJQUFJLENBQUM7UUFDMUQsQ0FBQztRQUVELElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3pDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFFL0Msa0JBQWtCLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxHQUFHLFVBQVUsSUFBSSxDQUFDO1FBQ3hELFlBQVksQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLEdBQUcsVUFBVSxJQUFJLENBQUM7UUFDbEQsa0JBQWtCLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFHLFVBQVUsSUFBSSxDQUFDO1FBQ3BELFlBQVksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEdBQUcsVUFBVSxJQUFJLENBQUM7UUFFOUMsTUFBTSxZQUFZLEdBQUcsSUFBSSxrQkFBa0IsQ0FDMUMsS0FBSyxFQUNMLElBQUksRUFDSixZQUFZLEVBQ1osa0JBQWtCLEVBQ2xCLFdBQVcsRUFDWCxZQUFZLENBQUMsZ0JBQWdCLEVBQzdCLFlBQVksQ0FBQyxXQUFXLEVBQ3hCLFVBQVUsQ0FDVixDQUFDO1FBQ0YsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUVPLGVBQWUsQ0FBQyxVQUE4QixFQUFFLEdBQVcsRUFBRSxVQUFtQjtRQUN2RixNQUFNLFlBQVksR0FBRyxVQUFVLENBQUMsV0FBVyxDQUFDO1FBQzVDLE1BQU0sa0JBQWtCLEdBQUcsVUFBVSxDQUFDLGlCQUFpQixDQUFDO1FBQ3hELElBQUksVUFBVSxFQUFFLENBQUM7WUFDaEIsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDO1lBQ25CLFlBQVksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztZQUNuQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztZQUN6QyxNQUFNLFVBQVUsR0FBRyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMseUJBQXlCLEdBQUcsQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQy9HLFlBQVksQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLFVBQVUsQ0FBQztZQUNwQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLFVBQVUsQ0FBQztRQUMzQyxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQztZQUNuQixZQUFZLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7WUFDbkMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7WUFDekMsWUFBWSxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQztZQUNwQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUM7UUFDM0MsQ0FBQztRQUNELE9BQU8sVUFBVSxDQUFDO0lBQ25CLENBQUM7SUFFTyx5QkFBeUIsQ0FBQyxZQUFzQyxFQUFFLElBQVk7UUFDckYsTUFBTSxtQkFBbUIsR0FBcUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLDRDQUFrQyxDQUFDO1FBQ3ZILElBQUksQ0FBQyxZQUFZLElBQUksbUJBQW1CLEtBQUssT0FBTyxFQUFFLENBQUM7WUFDdEQsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLGNBQWMsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDO1FBQzVDLE1BQU0sb0JBQW9CLEdBQUcsY0FBYyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM1RCxNQUFNLGVBQWUsR0FBRyxjQUFjLENBQUMsa0JBQWtCLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUNoRixNQUFNLGNBQWMsR0FBRyxJQUFJLEtBQUssZUFBZSxDQUFDO1FBQ2hELElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUNyQixPQUFPO1FBQ1IsQ0FBQztRQUNELE1BQU0sV0FBVyxHQUFHLGNBQWMsQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUNyRSxNQUFNLFdBQVcsR0FBRyxJQUFJLGlCQUFpQixDQUFDLFdBQVcsRUFBRSxlQUFlLEVBQUUsY0FBYyxDQUFDLGdCQUFnQixDQUFDLG9CQUFvQixDQUFDLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ2pKLFdBQVcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxJQUFJLG1CQUFtQixLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDekcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsMkJBQTJCLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDbEUsT0FBTyxXQUFXLENBQUM7SUFDcEIsQ0FBQztJQUVELEtBQUs7UUFDSixPQUFPLG1DQUFtQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxVQUFVO1FBQ1QsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDO0lBQzFCLENBQUM7SUFFRCxXQUFXO1FBQ1YsT0FBTztZQUNOLFVBQVUsb0RBQTRDO1lBQ3RELFlBQVksRUFBRSxFQUFFO1NBQ2hCLENBQUM7SUFDSCxDQUFDO0lBRUQsc0JBQXNCO1FBQ3JCLE9BQU8sSUFBSSxDQUFDLG9CQUFvQixDQUFDO0lBQ2xDLENBQUM7SUFFRCxrQkFBa0IsQ0FBQyxLQUFhO1FBQy9CLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzVELElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDdEQsQ0FBQztJQUNGLENBQUM7SUFFRDs7T0FFRztJQUNILHlCQUF5QixDQUFDLFdBQStCO1FBQ3hELElBQUksQ0FBQyxXQUFXLElBQUksV0FBVyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDckQsMEJBQTBCO1lBQzFCLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUNELE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLHNDQUFzQyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3BGLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQ3pCLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUNELE1BQU0sTUFBTSxHQUFHLHFCQUFxQixDQUFDLGtCQUFrQixDQUFDLGdCQUFnQixFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxRixPQUFPLElBQUksUUFBUSxDQUFDLGtCQUFrQixDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBRUQsNkJBQTZCLENBQUMsT0FBMkI7UUFDeEQsT0FBTyxJQUFJLENBQUMsc0NBQXNDLENBQUMsT0FBTyxDQUFDLEVBQUUsVUFBVSxJQUFJLElBQUksQ0FBQztJQUNqRixDQUFDO0lBRU8sc0NBQXNDLENBQUMsT0FBMkI7UUFDekUsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLDRCQUE0QixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3pELElBQUksS0FBSyxLQUFLLElBQUksSUFBSSxLQUFLLEdBQUcsQ0FBQyxJQUFJLEtBQUssSUFBSSxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDOUUsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVEOzs7T0FHRztJQUNILDRCQUE0QixDQUFDLE9BQTJCO1FBQ3ZELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztRQUN0RSxPQUFPLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQ25ELENBQUM7SUFFRDs7O09BR0c7SUFDSCxjQUFjLENBQUMsT0FBMkI7UUFDekMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3ZFLE9BQU8sUUFBUSxLQUFLLFNBQVMsQ0FBQztJQUMvQixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsc0JBQXNCLENBQUMsT0FBMkI7UUFDakQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sRUFBRSwyQkFBMkIsQ0FBQyxDQUFDO1FBQ3RGLE9BQU8sZUFBZSxLQUFLLFNBQVMsQ0FBQztJQUN0QyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0ssa0JBQWtCLENBQUMsT0FBMkIsRUFBRSxTQUFpQjtRQUN4RSxPQUFPLE9BQU8sSUFBSSxPQUFPLEtBQUssSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ2pELE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDN0MsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQ25CLE9BQU8sSUFBSSxDQUFDO1lBQ2IsQ0FBQztZQUNELE9BQU8sR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDO1FBQ2pDLENBQUM7UUFDRCxPQUFPO0lBQ1IsQ0FBQztDQUNEO0FBRUQsTUFBTSxrQkFBa0I7SUFDdkIsWUFDaUIsS0FBYSxFQUNiLFVBQWtCLEVBQ2xCLFdBQXdCLEVBQ3hCLGlCQUE4QixFQUM5QixXQUEwQyxFQUMxQyxnQkFBa0MsRUFDbEMsV0FBbUIsRUFDbkIsTUFBYztRQVBkLFVBQUssR0FBTCxLQUFLLENBQVE7UUFDYixlQUFVLEdBQVYsVUFBVSxDQUFRO1FBQ2xCLGdCQUFXLEdBQVgsV0FBVyxDQUFhO1FBQ3hCLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBYTtRQUM5QixnQkFBVyxHQUFYLFdBQVcsQ0FBK0I7UUFDMUMscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFrQjtRQUNsQyxnQkFBVyxHQUFYLFdBQVcsQ0FBUTtRQUNuQixXQUFNLEdBQU4sTUFBTSxDQUFRO0lBQzNCLENBQUM7Q0FDTDtBQUVELE1BQU0saUJBQWlCO0lBSXRCLFlBQ1EsV0FBb0IsRUFDcEIsZ0JBQXdCLEVBQ3hCLGNBQXNCLEVBQ3RCLFNBQWlCO1FBSGpCLGdCQUFXLEdBQVgsV0FBVyxDQUFTO1FBQ3BCLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBUTtRQUN4QixtQkFBYyxHQUFkLGNBQWMsQ0FBUTtRQUN0QixjQUFTLEdBQVQsU0FBUyxDQUFRO1FBRXhCLElBQUksQ0FBQyxPQUFPLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM3QyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDO1FBQ2xDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFHLFNBQVMsSUFBSSxDQUFDO1FBQzdDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxHQUFHLFNBQVMsSUFBSSxDQUFDO1FBQ2pELElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUMxRyxDQUFDO0lBRU0sVUFBVSxDQUFDLE9BQWdCO1FBQ2pDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQzVELElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO0lBQ2xELENBQUM7Q0FDRCJ9