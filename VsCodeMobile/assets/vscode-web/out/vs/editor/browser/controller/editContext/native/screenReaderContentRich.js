/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { addDisposableListener, getActiveWindow, isHTMLElement } from '../../../../../base/browser/dom.js';
import { createTrustedTypesPolicy } from '../../../../../base/browser/trustedTypes.js';
import { IAccessibilityService } from '../../../../../platform/accessibility/common/accessibility.js';
import { EditorFontLigatures } from '../../../../common/config/editorOptions.js';
import { Range } from '../../../../common/core/range.js';
import { Selection } from '../../../../common/core/selection.js';
import { StringBuilder } from '../../../../common/core/stringBuilder.js';
import { LineDecoration } from '../../../../common/viewLayout/lineDecorations.js';
import { RenderLineInput, renderViewLine } from '../../../../common/viewLayout/viewLineRenderer.js';
import { Disposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { IME } from '../../../../../base/common/ime.js';
import { getColumnOfNodeOffset } from '../../../viewParts/viewLines/viewLine.js';
const ttPolicy = createTrustedTypesPolicy('richScreenReaderContent', { createHTML: value => value });
const LINE_NUMBER_ATTRIBUTE = 'data-line-number';
let RichScreenReaderContent = class RichScreenReaderContent extends Disposable {
    constructor(_domNode, _context, _viewController, _accessibilityService) {
        super();
        this._domNode = _domNode;
        this._context = _context;
        this._viewController = _viewController;
        this._accessibilityService = _accessibilityService;
        this._selectionChangeListener = this._register(new MutableDisposable());
        this._accessibilityPageSize = 1;
        this._ignoreSelectionChangeTime = 0;
        this._state = RichScreenReaderState.NULL;
        this._strategy = new RichPagedScreenReaderStrategy();
        this._renderedLines = new Map();
        this._renderedSelection = new Selection(1, 1, 1, 1);
        this.onConfigurationChanged(this._context.configuration.options);
    }
    updateScreenReaderContent(primarySelection) {
        const focusedElement = getActiveWindow().document.activeElement;
        if (!focusedElement || focusedElement !== this._domNode.domNode) {
            return;
        }
        const isScreenReaderOptimized = this._accessibilityService.isScreenReaderOptimized();
        if (isScreenReaderOptimized) {
            const state = this._getScreenReaderContentLineIntervals(primarySelection);
            if (!this._state.equals(state)) {
                this._state = state;
                this._renderedLines = this._renderScreenReaderContent(state);
            }
            if (!this._renderedSelection.equalsSelection(primarySelection)) {
                this._renderedSelection = primarySelection;
                this._setSelectionOnScreenReaderContent(this._context, this._renderedLines, primarySelection);
            }
        }
        else {
            this._state = RichScreenReaderState.NULL;
            this._setIgnoreSelectionChangeTime('setValue');
            this._domNode.domNode.textContent = '';
        }
    }
    updateScrollTop(primarySelection) {
        const intervals = this._state.intervals;
        if (!intervals.length) {
            return;
        }
        const viewLayout = this._context.viewModel.viewLayout;
        const stateStartLineNumber = intervals[0].startLine;
        const verticalOffsetOfStateStartLineNumber = viewLayout.getVerticalOffsetForLineNumber(stateStartLineNumber);
        const verticalOffsetOfPositionLineNumber = viewLayout.getVerticalOffsetForLineNumber(primarySelection.positionLineNumber);
        this._domNode.domNode.scrollTop = verticalOffsetOfPositionLineNumber - verticalOffsetOfStateStartLineNumber;
    }
    onFocusChange(newFocusValue) {
        if (newFocusValue) {
            this._selectionChangeListener.value = this._setSelectionChangeListener();
        }
        else {
            this._selectionChangeListener.value = undefined;
        }
    }
    onConfigurationChanged(options) {
        this._accessibilityPageSize = options.get(3 /* EditorOption.accessibilityPageSize */);
    }
    onWillCut() {
        this._setIgnoreSelectionChangeTime('onCut');
    }
    onWillPaste() {
        this._setIgnoreSelectionChangeTime('onWillPaste');
    }
    // --- private methods
    _setIgnoreSelectionChangeTime(reason) {
        this._ignoreSelectionChangeTime = Date.now();
    }
    _setSelectionChangeListener() {
        // See https://github.com/microsoft/vscode/issues/27216 and https://github.com/microsoft/vscode/issues/98256
        // When using a Braille display or NVDA for example, it is possible for users to reposition the
        // system caret. This is reflected in Chrome as a `selectionchange` event and needs to be reflected within the editor.
        // `selectionchange` events often come multiple times for a single logical change
        // so throttle multiple `selectionchange` events that burst in a short period of time.
        let previousSelectionChangeEventTime = 0;
        return addDisposableListener(this._domNode.domNode.ownerDocument, 'selectionchange', () => {
            const activeElement = getActiveWindow().document.activeElement;
            const isFocused = activeElement === this._domNode.domNode;
            if (!isFocused) {
                return;
            }
            const isScreenReaderOptimized = this._accessibilityService.isScreenReaderOptimized();
            if (!isScreenReaderOptimized || !IME.enabled) {
                return;
            }
            const now = Date.now();
            const delta1 = now - previousSelectionChangeEventTime;
            previousSelectionChangeEventTime = now;
            if (delta1 < 5) {
                // received another `selectionchange` event within 5ms of the previous `selectionchange` event
                // => ignore it
                return;
            }
            const delta2 = now - this._ignoreSelectionChangeTime;
            this._ignoreSelectionChangeTime = 0;
            if (delta2 < 100) {
                // received a `selectionchange` event within 100ms since we touched the hidden div
                // => ignore it, since we caused it
                return;
            }
            const selection = this._getEditorSelectionFromDomRange();
            if (!selection) {
                return;
            }
            this._viewController.setSelection(selection);
        });
    }
    _renderScreenReaderContent(state) {
        const nodes = [];
        const renderedLines = new Map();
        for (const interval of state.intervals) {
            for (let lineNumber = interval.startLine; lineNumber <= interval.endLine; lineNumber++) {
                const renderedLine = this._renderLine(lineNumber);
                renderedLines.set(lineNumber, renderedLine);
                nodes.push(renderedLine.domNode);
            }
        }
        this._setIgnoreSelectionChangeTime('setValue');
        this._domNode.domNode.replaceChildren(...nodes);
        return renderedLines;
    }
    _renderLine(viewLineNumber) {
        const viewModel = this._context.viewModel;
        const positionLineData = viewModel.getViewLineRenderingData(viewLineNumber);
        const options = this._context.configuration.options;
        const fontInfo = options.get(59 /* EditorOption.fontInfo */);
        const stopRenderingLineAfter = options.get(133 /* EditorOption.stopRenderingLineAfter */);
        const renderControlCharacters = options.get(108 /* EditorOption.renderControlCharacters */);
        const fontLigatures = options.get(60 /* EditorOption.fontLigatures */);
        const disableMonospaceOptimizations = options.get(40 /* EditorOption.disableMonospaceOptimizations */);
        const lineDecorations = LineDecoration.filter(positionLineData.inlineDecorations, viewLineNumber, positionLineData.minColumn, positionLineData.maxColumn);
        const useMonospaceOptimizations = fontInfo.isMonospace && !disableMonospaceOptimizations;
        const useFontLigatures = fontLigatures !== EditorFontLigatures.OFF;
        let renderWhitespace;
        const experimentalWhitespaceRendering = options.get(47 /* EditorOption.experimentalWhitespaceRendering */);
        if (experimentalWhitespaceRendering === 'off') {
            renderWhitespace = options.get(113 /* EditorOption.renderWhitespace */);
        }
        else {
            renderWhitespace = 'none';
        }
        const renderLineInput = new RenderLineInput(useMonospaceOptimizations, fontInfo.canUseHalfwidthRightwardsArrow, positionLineData.content, positionLineData.continuesWithWrappedLine, positionLineData.isBasicASCII, positionLineData.containsRTL, positionLineData.minColumn - 1, positionLineData.tokens, lineDecorations, positionLineData.tabSize, positionLineData.startVisibleColumn, fontInfo.spaceWidth, fontInfo.middotWidth, fontInfo.wsmiddotWidth, stopRenderingLineAfter, renderWhitespace, renderControlCharacters, useFontLigatures, null, null, 0, true);
        const htmlBuilder = new StringBuilder(10000);
        const renderOutput = renderViewLine(renderLineInput, htmlBuilder);
        const html = htmlBuilder.build();
        const trustedhtml = ttPolicy?.createHTML(html) ?? html;
        const lineHeight = viewModel.viewLayout.getLineHeightForLineNumber(viewLineNumber) + 'px';
        const domNode = document.createElement('div');
        domNode.innerHTML = trustedhtml;
        domNode.style.lineHeight = lineHeight;
        domNode.style.height = lineHeight;
        domNode.setAttribute(LINE_NUMBER_ATTRIBUTE, viewLineNumber.toString());
        return new RichRenderedScreenReaderLine(domNode, renderOutput.characterMapping);
    }
    _setSelectionOnScreenReaderContent(context, renderedLines, viewSelection) {
        const activeDocument = getActiveWindow().document;
        const activeDocumentSelection = activeDocument.getSelection();
        if (!activeDocumentSelection) {
            return;
        }
        const startLineNumber = viewSelection.startLineNumber;
        const endLineNumber = viewSelection.endLineNumber;
        const startRenderedLine = renderedLines.get(startLineNumber);
        const endRenderedLine = renderedLines.get(endLineNumber);
        if (!startRenderedLine || !endRenderedLine) {
            return;
        }
        const viewModel = context.viewModel;
        const model = viewModel.model;
        const coordinatesConverter = viewModel.coordinatesConverter;
        const startRange = new Range(startLineNumber, 1, startLineNumber, viewSelection.selectionStartColumn);
        const modelStartRange = coordinatesConverter.convertViewRangeToModelRange(startRange);
        const characterCountForStart = model.getCharacterCountInRange(modelStartRange);
        const endRange = new Range(endLineNumber, 1, endLineNumber, viewSelection.positionColumn);
        const modelEndRange = coordinatesConverter.convertViewRangeToModelRange(endRange);
        const characterCountForEnd = model.getCharacterCountInRange(modelEndRange);
        const startDomPosition = startRenderedLine.characterMapping.getDomPosition(characterCountForStart);
        const endDomPosition = endRenderedLine.characterMapping.getDomPosition(characterCountForEnd);
        const startDomNode = startRenderedLine.domNode.firstChild;
        const endDomNode = endRenderedLine.domNode.firstChild;
        const startChildren = startDomNode.childNodes;
        const endChildren = endDomNode.childNodes;
        const startNode = startChildren.item(startDomPosition.partIndex);
        const endNode = endChildren.item(endDomPosition.partIndex);
        if (!startNode.firstChild || !endNode.firstChild) {
            return;
        }
        this._setIgnoreSelectionChangeTime('setRange');
        activeDocumentSelection.setBaseAndExtent(startNode.firstChild, viewSelection.startColumn === 1 ? 0 : startDomPosition.charIndex + 1, endNode.firstChild, viewSelection.endColumn === 1 ? 0 : endDomPosition.charIndex + 1);
    }
    _getScreenReaderContentLineIntervals(primarySelection) {
        return this._strategy.fromEditorSelection(this._context.viewModel, primarySelection, this._accessibilityPageSize);
    }
    _getEditorSelectionFromDomRange() {
        if (!this._renderedLines) {
            return;
        }
        const selection = getActiveWindow().document.getSelection();
        if (!selection) {
            return;
        }
        const rangeCount = selection.rangeCount;
        if (rangeCount === 0) {
            return;
        }
        const range = selection.getRangeAt(0);
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        const startSpanElement = startContainer.parentElement;
        const endSpanElement = endContainer.parentElement;
        if (!startSpanElement || !isHTMLElement(startSpanElement) || !endSpanElement || !isHTMLElement(endSpanElement)) {
            return;
        }
        const startLineDomNode = startSpanElement.parentElement?.parentElement;
        const endLineDomNode = endSpanElement.parentElement?.parentElement;
        if (!startLineDomNode || !endLineDomNode) {
            return;
        }
        const startLineNumberAttribute = startLineDomNode.getAttribute(LINE_NUMBER_ATTRIBUTE);
        const endLineNumberAttribute = endLineDomNode.getAttribute(LINE_NUMBER_ATTRIBUTE);
        if (!startLineNumberAttribute || !endLineNumberAttribute) {
            return;
        }
        const startLineNumber = parseInt(startLineNumberAttribute);
        const endLineNumber = parseInt(endLineNumberAttribute);
        const startMapping = this._renderedLines.get(startLineNumber)?.characterMapping;
        const endMapping = this._renderedLines.get(endLineNumber)?.characterMapping;
        if (!startMapping || !endMapping) {
            return;
        }
        const startColumn = getColumnOfNodeOffset(startMapping, startSpanElement, range.startOffset);
        const endColumn = getColumnOfNodeOffset(endMapping, endSpanElement, range.endOffset);
        if (selection.direction === 'forward') {
            return new Selection(startLineNumber, startColumn, endLineNumber, endColumn);
        }
        else {
            return new Selection(endLineNumber, endColumn, startLineNumber, startColumn);
        }
    }
};
RichScreenReaderContent = __decorate([
    __param(3, IAccessibilityService)
], RichScreenReaderContent);
export { RichScreenReaderContent };
class RichRenderedScreenReaderLine {
    constructor(domNode, characterMapping) {
        this.domNode = domNode;
        this.characterMapping = characterMapping;
    }
}
class LineInterval {
    constructor(startLine, endLine) {
        this.startLine = startLine;
        this.endLine = endLine;
    }
}
class RichScreenReaderState {
    constructor(model, intervals) {
        this.intervals = intervals;
        let value = '';
        for (const interval of intervals) {
            for (let lineNumber = interval.startLine; lineNumber <= interval.endLine; lineNumber++) {
                value += model.getLineContent(lineNumber) + '\n';
            }
        }
        this.value = value;
    }
    equals(other) {
        return this.value === other.value;
    }
    static get NULL() {
        const nullModel = {
            getLineContent: () => '',
            getLineCount: () => 1,
            getLineMaxColumn: () => 1,
            getValueInRange: () => '',
            getValueLengthInRange: () => 0,
            modifyPosition: (position, offset) => position
        };
        return new RichScreenReaderState(nullModel, []);
    }
}
class RichPagedScreenReaderStrategy {
    constructor() { }
    _getPageOfLine(lineNumber, linesPerPage) {
        return Math.floor((lineNumber - 1) / linesPerPage);
    }
    _getRangeForPage(context, page, linesPerPage) {
        const offset = page * linesPerPage;
        const startLineNumber = offset + 1;
        const endLineNumber = Math.min(offset + linesPerPage, context.getLineCount());
        return new LineInterval(startLineNumber, endLineNumber);
    }
    fromEditorSelection(context, viewSelection, linesPerPage) {
        const selectionStartPage = this._getPageOfLine(viewSelection.startLineNumber, linesPerPage);
        const selectionStartPageRange = this._getRangeForPage(context, selectionStartPage, linesPerPage);
        const selectionEndPage = this._getPageOfLine(viewSelection.endLineNumber, linesPerPage);
        const selectionEndPageRange = this._getRangeForPage(context, selectionEndPage, linesPerPage);
        const lineIntervals = [{ startLine: selectionStartPageRange.startLine, endLine: selectionStartPageRange.endLine }];
        if (selectionStartPage + 1 < selectionEndPage) {
            lineIntervals.push({ startLine: selectionEndPageRange.startLine, endLine: selectionEndPageRange.endLine });
        }
        return new RichScreenReaderState(context, lineIntervals);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyZWVuUmVhZGVyQ29udGVudFJpY2guanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvY29udHJvbGxlci9lZGl0Q29udGV4dC9uYXRpdmUvc2NyZWVuUmVhZGVyQ29udGVudFJpY2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLGVBQWUsRUFBRSxhQUFhLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUUzRyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN2RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsbUJBQW1CLEVBQTJFLE1BQU0sNENBQTRDLENBQUM7QUFDMUosT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDekUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ2xGLE9BQU8sRUFBb0IsZUFBZSxFQUFFLGNBQWMsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBSXRILE9BQU8sRUFBRSxVQUFVLEVBQWUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRyxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFHeEQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFakYsTUFBTSxRQUFRLEdBQUcsd0JBQXdCLENBQUMseUJBQXlCLEVBQUUsRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFD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