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
var GlyphHoverWidget_1;
import * as dom from '../../../../base/browser/dom.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { HoverOperation } from './hoverOperation.js';
import { HoverWidget } from '../../../../base/browser/ui/hover/hoverWidget.js';
import { GlyphHoverComputer } from './glyphHoverComputer.js';
import { isMousePositionWithinElement } from './hoverUtils.js';
const $ = dom.$;
let GlyphHoverWidget = class GlyphHoverWidget extends Disposable {
    static { GlyphHoverWidget_1 = this; }
    static { this.ID = 'editor.contrib.modesGlyphHoverWidget'; }
    constructor(editor, _markdownRendererService) {
        super();
        this._markdownRendererService = _markdownRendererService;
        this.allowEditorOverflow = true;
        this._renderDisposeables = this._register(new DisposableStore());
        this._editor = editor;
        this._isVisible = false;
        this._messages = [];
        this._hover = this._register(new HoverWidget(true));
        this._hover.containerDomNode.classList.toggle('hidden', !this._isVisible);
        this._hoverOperation = this._register(new HoverOperation(this._editor, new GlyphHoverComputer(this._editor)));
        this._register(this._hoverOperation.onResult((result) => this._withResult(result)));
        this._register(this._editor.onDidChangeModelDecorations(() => this._onModelDecorationsChanged()));
        this._register(this._editor.onDidChangeConfiguration((e) => {
            if (e.hasChanged(59 /* EditorOption.fontInfo */)) {
                this._updateFont();
            }
        }));
        this._register(dom.addStandardDisposableListener(this._hover.containerDomNode, 'mouseleave', (e) => {
            this._onMouseLeave(e);
        }));
        this._editor.addOverlayWidget(this);
    }
    dispose() {
        this._hoverComputerOptions = undefined;
        this._editor.removeOverlayWidget(this);
        super.dispose();
    }
    getId() {
        return GlyphHoverWidget_1.ID;
    }
    getDomNode() {
        return this._hover.containerDomNode;
    }
    getPosition() {
        return null;
    }
    _updateFont() {
        // eslint-disable-next-line no-restricted-syntax
        const codeClasses = Array.prototype.slice.call(this._hover.contentsDomNode.getElementsByClassName('code'));
        codeClasses.forEach(node => this._editor.applyFontInfo(node));
    }
    _onModelDecorationsChanged() {
        if (this._isVisible && this._hoverComputerOptions) {
            // The decorations have changed and the hover is visible,
            // we need to recompute the displayed text
            this._hoverOperation.cancel();
            this._hoverOperation.start(0 /* HoverStartMode.Delayed */, this._hoverComputerOptions);
        }
    }
    showsOrWillShow(mouseEvent) {
        const target = mouseEvent.target;
        if (target.type === 2 /* MouseTargetType.GUTTER_GLYPH_MARGIN */ && target.detail.glyphMarginLane) {
            this._startShowingAt(target.position.lineNumber, target.detail.glyphMarginLane);
            return true;
        }
        if (target.type === 3 /* MouseTargetType.GUTTER_LINE_NUMBERS */) {
            this._startShowingAt(target.position.lineNumber, 'lineNo');
            return true;
        }
        return false;
    }
    _startShowingAt(lineNumber, laneOrLine) {
        if (this._hoverComputerOptions
            && this._hoverComputerOptions.lineNumber === lineNumber
            && this._hoverComputerOptions.laneOrLine === laneOrLine) {
            // We have to show the widget at the exact same line number as before, so no work is needed
            return;
        }
        this._hoverOperation.cancel();
        this.hide();
        this._hoverComputerOptions = { lineNumber, laneOrLine };
        this._hoverOperation.start(0 /* HoverStartMode.Delayed */, this._hoverComputerOptions);
    }
    hide() {
        this._hoverComputerOptions = undefined;
        this._hoverOperation.cancel();
        if (!this._isVisible) {
            return;
        }
        this._isVisible = false;
        this._hover.containerDomNode.classList.toggle('hidden', !this._isVisible);
    }
    _withResult(result) {
        this._messages = result.value;
        if (this._messages.length > 0) {
            this._renderMessages(result.options.lineNumber, result.options.laneOrLine, this._messages);
        }
        else {
            this.hide();
        }
    }
    _renderMessages(lineNumber, laneOrLine, messages) {
        this._renderDisposeables.clear();
        const fragment = document.createDocumentFragment();
        for (const msg of messages) {
            const markdownHoverElement = $('div.hover-row.markdown-hover');
            const hoverContentsElement = dom.append(markdownHoverElement, $('div.hover-contents'));
            const renderedContents = this._renderDisposeables.add(this._markdownRendererService.render(msg.value, { context: this._editor }));
            hoverContentsElement.appendChild(renderedContents.element);
            fragment.appendChild(markdownHoverElement);
        }
        this._updateContents(fragment);
        this._showAt(lineNumber, laneOrLine);
    }
    _updateContents(node) {
        this._hover.contentsDomNode.textContent = '';
        this._hover.contentsDomNode.appendChild(node);
        this._updateFont();
    }
    _showAt(lineNumber, laneOrLine) {
        if (!this._isVisible) {
            this._isVisible = true;
            this._hover.containerDomNode.classList.toggle('hidden', !this._isVisible);
        }
        const editorLayout = this._editor.getLayoutInfo();
        const topForLineNumber = this._editor.getTopForLineNumber(lineNumber);
        const editorScrollTop = this._editor.getScrollTop();
        const lineHeight = this._editor.getOption(75 /* EditorOption.lineHeight */);
        const nodeHeight = this._hover.containerDomNode.clientHeight;
        const top = topForLineNumber - editorScrollTop - ((nodeHeight - lineHeight) / 2);
        const left = editorLayout.glyphMarginLeft + editorLayout.glyphMarginWidth + (laneOrLine === 'lineNo' ? editorLayout.lineNumbersWidth : 0);
        // Constrain the hover widget to stay within the editor bounds
        const editorHeight = editorLayout.height;
        const maxTop = editorHeight - nodeHeight;
        const constrainedTop = Math.max(0, Math.min(Math.round(top), maxTop));
        const fixedOverflowWidgets = this._editor.getOption(51 /* EditorOption.fixedOverflowWidgets */);
        if (fixedOverflowWidgets) {
            // Use fixed positioning relative to the viewport
            const editorDomNode = this._editor.getDomNode();
            if (editorDomNode) {
                const editorRect = dom.getDomNodePagePosition(editorDomNode);
                this._hover.containerDomNode.style.position = 'fixed';
                this._hover.containerDomNode.style.left = `${editorRect.left + left}px`;
                this._hover.containerDomNode.style.top = `${editorRect.top + constrainedTop}px`;
            }
        }
        else {
            // Use absolute positioning relative to the editor
            this._hover.containerDomNode.style.position = 'absolute';
            this._hover.containerDomNode.style.left = `${left}px`;
            this._hover.containerDomNode.style.top = `${constrainedTop}px`;
        }
        this._hover.containerDomNode.style.zIndex = '11'; // 1 more than the zone widget at 10 (#233819)
    }
    _onMouseLeave(e) {
        const editorDomNode = this._editor.getDomNode();
        const isMousePositionOutsideOfEditor = !editorDomNode || !isMousePositionWithinElement(editorDomNode, e.x, e.y);
        if (isMousePositionOutsideOfEditor) {
            this.hide();
        }
    }
};
GlyphHoverWidget = GlyphHoverWidget_1 = __decorate([
    __param(1, IMarkdownRendererService)
], GlyphHoverWidget);
export { GlyphHoverWidget };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2x5cGhIb3ZlcldpZGdldC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL2dseXBoSG92ZXJXaWRnZXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUdyRyxPQUFPLEVBQUUsY0FBYyxFQUErQixNQUFNLHFCQUFxQixDQUFDO0FBQ2xGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUUvRSxPQUFPLEVBQW1DLGtCQUFrQixFQUE2QixNQUFNLHlCQUF5QixDQUFDO0FBQ3pILE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBRS9ELE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFFVCxJQUFNLGdCQUFnQixHQUF0QixNQUFNLGdCQUFpQixTQUFRLFVBQVU7O2FBRXhCLE9BQUUsR0FBRyxzQ0FBc0MsQUFBekMsQ0FBMEM7SUFjbkUsWUFDQyxNQUFtQixFQUNPLHdCQUFtRTtRQUU3RixLQUFLLEVBQUUsQ0FBQztRQUZtQyw2QkFBd0IsR0FBeEIsd0JBQXdCLENBQTBCO1FBZjlFLHdCQUFtQixHQUFHLElBQUksQ0FBQztRQVMxQix3QkFBbUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksZUFBZSxFQUFFLENBQUMsQ0FBQztRQVM1RSxJQUFJLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQztRQUV0QixJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztRQUN4QixJQUFJLENBQUMs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