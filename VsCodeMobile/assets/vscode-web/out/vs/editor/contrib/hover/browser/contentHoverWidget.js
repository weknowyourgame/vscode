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
var ContentHoverWidget_1;
import * as dom from '../../../../base/browser/dom.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { ResizableContentWidget } from './resizableContentWidget.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { EditorContextKeys } from '../../../common/editorContextKeys.js';
import { getHoverAccessibleViewHint, HoverWidget } from '../../../../base/browser/ui/hover/hoverWidget.js';
import { Emitter } from '../../../../base/common/event.js';
const HORIZONTAL_SCROLLING_BY = 30;
let ContentHoverWidget = class ContentHoverWidget extends ResizableContentWidget {
    static { ContentHoverWidget_1 = this; }
    static { this.ID = 'editor.contrib.resizableContentHoverWidget'; }
    static { this._lastDimensions = new dom.Dimension(0, 0); }
    get isVisibleFromKeyboard() {
        return (this._renderedHover?.source === 2 /* HoverStartSource.Keyboard */);
    }
    get isVisible() {
        return this._hoverVisibleKey.get() ?? false;
    }
    get isFocused() {
        return this._hoverFocusedKey.get() ?? false;
    }
    constructor(editor, contextKeyService, _configurationService, _accessibilityService, _keybindingService) {
        const minimumHeight = editor.getOption(75 /* EditorOption.lineHeight */) + 8;
        const minimumWidth = 150;
        const minimumSize = new dom.Dimension(minimumWidth, minimumHeight);
        super(editor, minimumSize);
        this._configurationService = _configurationService;
        this._accessibilityService = _accessibilityService;
        this._keybindingService = _keybindingService;
        this._hover = this._register(new HoverWidget(true));
        this._onDidResize = this._register(new Emitter());
        this.onDidResize = this._onDidResize.event;
        this._onDidScroll = this._register(new Emitter());
        this.onDidScroll = this._onDidScroll.event;
        this._onContentsChanged = this._register(new Emitter());
        this.onContentsChanged = this._onContentsChanged.event;
        this._minimumSize = minimumSize;
        this._hoverVisibleKey = EditorContextKeys.hoverVisible.bindTo(contextKeyService);
        this._hoverFocusedKey = EditorContextKeys.hoverFocused.bindTo(contextKeyService);
        dom.append(this._resizableNode.domNode, this._hover.containerDomNode);
        this._resizableNode.domNode.style.zIndex = '50';
        this._resizableNode.domNode.className = 'monaco-resizable-hover';
        this._register(this._editor.onDidLayoutChange(() => {
            if (this.isVisible) {
                this._updateMaxDimensions();
            }
        }));
        this._register(this._editor.onDidChangeConfiguration((e) => {
            if (e.hasChanged(59 /* EditorOption.fontInfo */)) {
                this._updateFont();
            }
        }));
        const focusTracker = this._register(dom.trackFocus(this._resizableNode.domNode));
        this._register(focusTracker.onDidFocus(() => {
            this._hoverFocusedKey.set(true);
        }));
        this._register(focusTracker.onDidBlur(() => {
            this._hoverFocusedKey.set(false);
        }));
        this._register(this._hover.scrollbar.onScroll((e) => {
            this._onDidScroll.fire(e);
        }));
        this._setRenderedHover(undefined);
        this._editor.addContentWidget(this);
    }
    dispose() {
        super.dispose();
        this._renderedHover?.dispose();
        this._editor.removeContentWidget(this);
    }
    getId() {
        return ContentHoverWidget_1.ID;
    }
    static _applyDimensions(container, width, height) {
        const transformedWidth = typeof width === 'number' ? `${width}px` : width;
        const transformedHeight = typeof height === 'number' ? `${height}px` : height;
        container.style.width = transformedWidth;
        container.style.height = transformedHeight;
    }
    _setContentsDomNodeDimensions(width, height) {
        const contentsDomNode = this._hover.contentsDomNode;
        return ContentHoverWidget_1._applyDimensions(contentsDomNode, width, height);
    }
    _setContainerDomNodeDimensions(width, height) {
        const containerDomNode = this._hover.containerDomNode;
        return ContentHoverWidget_1._applyDimensions(containerDomNode, width, height);
    }
    _setScrollableElementDimensions(width, height) {
        const scrollbarDomElement = this._hover.scrollbar.getDomNode();
        return ContentHoverWidget_1._applyDimensions(scrollbarDomElement, width, height);
    }
    _setHoverWidgetDimensions(width, height) {
        this._setContainerDomNodeDimensions(width, height);
        this._setScrollableElementDimensions(width, height);
        this._setContentsDomNodeDimensions(width, height);
        this._layoutContentWidget();
    }
    static _applyMaxDimensions(container, width, height) {
        const transformedWidth = typeof width === 'number' ? `${width}px` : width;
        const transformedHeight = typeof height === 'number' ? `${height}px` : height;
        container.style.maxWidth = transformedWidth;
        container.style.maxHeight = transformedHeight;
    }
    _setHoverWidgetMaxDimensions(width, height) {
        ContentHoverWidget_1._applyMaxDimensions(this._hover.contentsDomNode, width, height);
        ContentHoverWidget_1._applyMaxDimensions(this._hover.scrollbar.getDomNode(), width, height);
        ContentHoverWidget_1._applyMaxDimensions(this._hover.containerDomNode, width, height);
        this._hover.containerDomNode.style.setProperty('--vscode-hover-maxWidth', typeof width === 'number' ? `${width}px` : width);
        this._layoutContentWidget();
    }
    _setAdjustedHoverWidgetDimensions(size) {
        this._setHoverWidgetMaxDimensions('none', 'none');
        this._setHoverWidgetDimensions(size.width, size.height);
    }
    _updateResizableNodeMaxDimensions() {
        const maxRenderingWidth = this._findMaximumRenderingWidth() ?? Infinity;
        const maxRenderingHeight = this._findMaximumRenderingHeight() ?? Infinity;
        this._resizableNode.maxSize = new dom.Dimension(maxRenderingWidth, maxRenderingHeight);
        this._setHoverWidgetMaxDimensions(maxRenderingWidth, maxRenderingHeight);
    }
    _resize(size) {
        ContentHoverWidget_1._lastDimensions = new dom.Dimension(size.width, size.height);
        this._setAdjustedHoverWidgetDimensions(size);
        this._resizableNode.layout(size.height, size.width);
        this._updateResizableNodeMaxDimensions();
        this._hover.scrollbar.scanDomNode();
        this._editor.layoutContentWidget(this);
        this._onDidResize.fire();
    }
    _findAvailableSpaceVertically() {
        const position = this._renderedHover?.showAtPosition;
        if (!position) {
            return;
        }
        return this._positionPreference === 1 /* ContentWidgetPositionPreference.ABOVE */ ?
            this._availableVerticalSpaceAbove(position)
            : this._availableVerticalSpaceBelow(position);
    }
    _findMaximumRenderingHeight() {
        const availableSpace = this._findAvailableSpaceVertically();
        if (!availableSpace) {
            return;
        }
        const children = this._hover.contentsDomNode.children;
        let maximumHeight = children.length - 1;
        Array.from(this._hover.contentsDomNode.children).forEach((hoverPart) => {
            maximumHeight += hoverPart.clientHeight;
        });
        return Math.min(availableSpace, maximumHeight);
    }
    _isHoverTextOverflowing() {
        // To find out if the text is overflowing, we will disable wrapping, check the widths, and then re-enable wrapping
        this._hover.containerDomNode.style.setProperty('--vscode-hover-whiteSpace', 'nowrap');
        this._hover.containerDomNode.style.setProperty('--vscode-hover-sourceWhiteSpace', 'nowrap');
        const overflowing = Array.from(this._hover.contentsDomNode.children).some((hoverElement) => {
            return hoverElement.scrollWidth > hoverElement.clientWidth;
        });
        this._hover.containerDomNode.style.removeProperty('--vscode-hover-whiteSpace');
        this._hover.containerDomNode.style.removeProperty('--vscode-hover-sourceWhiteSpace');
        return overflowing;
    }
    _findMaximumRenderingWidth() {
        if (!this._editor || !this._editor.hasModel()) {
            return;
        }
        const overflowing = this._isHoverTextOverflowing();
        const initialWidth = (typeof this._contentWidth === 'undefined'
            ? 0
            : this._contentWidth);
        if (overflowing || this._hover.containerDomNode.clientWidth < initialWidth) {
            const bodyBoxWidth = dom.getClientArea(this._hover.containerDomNode.ownerDocument.body).width;
            const horizontalPadding = 14;
            return bodyBoxWidth - horizontalPadding;
        }
        else {
            return this._hover.containerDomNode.clientWidth;
        }
    }
    isMouseGettingCloser(posx, posy) {
        if (!this._renderedHover) {
            return false;
        }
        if (this._renderedHover.initialMousePosX === undefined || this._renderedHover.initialMousePosY === undefined) {
            this._renderedHover.initialMousePosX = posx;
            this._renderedHover.initialMousePosY = posy;
            return false;
        }
        const widgetRect = dom.getDomNodePagePosition(this.getDomNode());
        if (this._renderedHover.closestMouseDistance === undefined) {
            this._renderedHover.closestMouseDistance = computeDistanceFromPointToRectangle(this._renderedHover.initialMousePosX, this._renderedHover.initialMousePosY, widgetRect.left, widgetRect.top, widgetRect.width, widgetRect.height);
        }
        const distance = computeDistanceFromPointToRectangle(posx, posy, widgetRect.left, widgetRect.top, widgetRect.width, widgetRect.height);
        if (distance > this._renderedHover.closestMouseDistance + 4 /* tolerance of 4 pixels */) {
            // The mouse is getting farther away
            return false;
        }
        this._renderedHover.closestMouseDistance = Math.min(this._renderedHover.closestMouseDistance, distance);
        return true;
    }
    _setRenderedHover(renderedHover) {
        this._renderedHover?.dispose();
        this._renderedHover = renderedHover;
        this._hoverVisibleKey.set(!!renderedHover);
        this._hover.containerDomNode.classList.toggle('hidden', !renderedHover);
    }
    _updateFont() {
        const { fontSize, lineHeight } = this._editor.getOption(59 /* EditorOption.fontInfo */);
        const contentsDomNode = this._hover.contentsDomNode;
        contentsDomNode.style.fontSize = `${fontSize}px`;
        contentsDomNode.style.lineHeight = `${lineHeight / fontSize}`;
        // eslint-disable-next-line no-restricted-syntax
        const codeClasses = Array.prototype.slice.call(this._hover.contentsDomNode.getElementsByClassName('code'));
        codeClasses.forEach(node => this._editor.applyFontInfo(node));
    }
    _updateContent(node) {
        const contentsDomNode = this._hover.contentsDomNode;
        contentsDomNode.style.paddingBottom = '';
        contentsDomNode.textContent = '';
        contentsDomNode.appendChild(node);
    }
    _layoutContentWidget() {
        this._editor.layoutContentWidget(this);
        this._hover.onContentsChanged();
    }
    _updateMaxDimensions() {
        const height = Math.max(this._editor.getLayoutInfo().height / 4, 250, ContentHoverWidget_1._lastDimensions.height);
        const width = Math.max(this._editor.getLayoutInfo().width * 0.66, 750, ContentHoverWidget_1._lastDimensions.width);
        this._resizableNode.maxSize = new dom.Dimension(width, height);
        this._setHoverWidgetMaxDimensions(width, height);
    }
    _render(renderedHover) {
        this._setRenderedHover(renderedHover);
        this._updateFont();
        this._updateContent(renderedHover.domNode);
        this.handleContentsChanged();
        // Simply force a synchronous render on the editor
        // such that the widget does not really render with left = '0px'
        this._editor.render();
    }
    getPosition() {
        if (!this._renderedHover) {
            return null;
        }
        return {
            position: this._renderedHover.showAtPosition,
            secondaryPosition: this._renderedHover.showAtSecondaryPosition,
            positionAffinity: this._renderedHover.shouldAppearBeforeContent ? 3 /* PositionAffinity.LeftOfInjectedText */ : undefined,
            preference: [this._positionPreference ?? 1 /* ContentWidgetPositionPreference.ABOVE */]
        };
    }
    show(renderedHover) {
        if (!this._editor || !this._editor.hasModel()) {
            return;
        }
        this._render(renderedHover);
        const widgetHeight = dom.getTotalHeight(this._hover.containerDomNode);
        const widgetPosition = renderedHover.showAtPosition;
        this._positionPreference = this._findPositionPreference(widgetHeight, widgetPosition) ?? 1 /* ContentWidgetPositionPreference.ABOVE */;
        // See https://github.com/microsoft/vscode/issues/140339
        // TODO: Doing a second layout of the hover after force rendering the editor
        this.handleContentsChanged();
        if (renderedHover.shouldFocus) {
            this._hover.containerDomNode.focus();
        }
        this._onDidResize.fire();
        // The aria label overrides the label, so if we add to it, add the contents of the hover
        const hoverFocused = this._hover.containerDomNode.ownerDocument.activeElement === this._hover.containerDomNode;
        const accessibleViewHint = hoverFocused && getHoverAccessibleViewHint(this._configurationService.getValue('accessibility.verbosity.hover') === true && this._accessibilityService.isScreenReaderOptimized(), this._keybindingService.lookupKeybinding('editor.action.accessibleView')?.getAriaLabel() ?? '');
        if (accessibleViewHint) {
            this._hover.contentsDomNode.ariaLabel = this._hover.contentsDomNode.textContent + ', ' + accessibleViewHint;
        }
    }
    hide() {
        if (!this._renderedHover) {
            return;
        }
        const hoverStoleFocus = this._renderedHover.shouldFocus || this._hoverFocusedKey.get();
        this._setRenderedHover(undefined);
        this._resizableNode.maxSize = new dom.Dimension(Infinity, Infinity);
        this._resizableNode.clearSashHoverState();
        this._hoverFocusedKey.set(false);
        this._editor.layoutContentWidget(this);
        if (hoverStoleFocus) {
            this._editor.focus();
        }
    }
    _removeConstraintsRenderNormally() {
        // Added because otherwise the initial size of the hover content is smaller than should be
        const layoutInfo = this._editor.getLayoutInfo();
        this._resizableNode.layout(layoutInfo.height, layoutInfo.width);
        this._setHoverWidgetDimensions('auto', 'auto');
        this._updateMaxDimensions();
    }
    setMinimumDimensions(dimensions) {
        // We combine the new minimum dimensions with the previous ones
        this._minimumSize = new dom.Dimension(Math.max(this._minimumSize.width, dimensions.width), Math.max(this._minimumSize.height, dimensions.height));
        this._updateMinimumWidth();
    }
    _updateMinimumWidth() {
        const width = (typeof this._contentWidth === 'undefined'
            ? this._minimumSize.width
            : Math.min(this._contentWidth, this._minimumSize.width));
        // We want to avoid that the hover is artificially large, so we use the content width as minimum width
        this._resizableNode.minSize = new dom.Dimension(width, this._minimumSize.height);
    }
    handleContentsChanged() {
        this._removeConstraintsRenderNormally();
        const contentsDomNode = this._hover.contentsDomNode;
        let height = dom.getTotalHeight(contentsDomNode);
        let width = dom.getTotalWidth(contentsDomNode) + 2;
        this._resizableNode.layout(height, width);
        this._setHoverWidgetDimensions(width, height);
        height = dom.getTotalHeight(contentsDomNode);
        width = dom.getTotalWidth(contentsDomNode);
        this._contentWidth = width;
        this._updateMinimumWidth();
        this._resizableNode.layout(height, width);
        if (this._renderedHover?.showAtPosition) {
            const widgetHeight = dom.getTotalHeight(this._hover.containerDomNode);
            this._positionPreference = this._findPositionPreference(widgetHeight, this._renderedHover.showAtPosition);
        }
        this._layoutContentWidget();
        this._onContentsChanged.fire();
    }
    focus() {
        this._hover.containerDomNode.focus();
    }
    scrollUp() {
        const scrollTop = this._hover.scrollbar.getScrollPosition().scrollTop;
        const fontInfo = this._editor.getOption(59 /* EditorOption.fontInfo */);
        this._hover.scrollbar.setScrollPosition({ scrollTop: scrollTop - fontInfo.lineHeight });
    }
    scrollDown() {
        const scrollTop = this._hover.scrollbar.getScrollPosition().scrollTop;
        const fontInfo = this._editor.getOption(59 /* EditorOption.fontInfo */);
        this._hover.scrollbar.setScrollPosition({ scrollTop: scrollTop + fontInfo.lineHeight });
    }
    scrollLeft() {
        const scrollLeft = this._hover.scrollbar.getScrollPosition().scrollLeft;
        this._hover.scrollbar.setScrollPosition({ scrollLeft: scrollLeft - HORIZONTAL_SCROLLING_BY });
    }
    scrollRight() {
        const scrollLeft = this._hover.scrollbar.getScrollPosition().scrollLeft;
        this._hover.scrollbar.setScrollPosition({ scrollLeft: scrollLeft + HORIZONTAL_SCROLLING_BY });
    }
    pageUp() {
        const scrollTop = this._hover.scrollbar.getScrollPosition().scrollTop;
        const scrollHeight = this._hover.scrollbar.getScrollDimensions().height;
        this._hover.scrollbar.setScrollPosition({ scrollTop: scrollTop - scrollHeight });
    }
    pageDown() {
        const scrollTop = this._hover.scrollbar.getScrollPosition().scrollTop;
        const scrollHeight = this._hover.scrollbar.getScrollDimensions().height;
        this._hover.scrollbar.setScrollPosition({ scrollTop: scrollTop + scrollHeight });
    }
    goToTop() {
        this._hover.scrollbar.setScrollPosition({ scrollTop: 0 });
    }
    goToBottom() {
        this._hover.scrollbar.setScrollPosition({ scrollTop: this._hover.scrollbar.getScrollDimensions().scrollHeight });
    }
};
ContentHoverWidget = ContentHoverWidget_1 = __decorate([
    __param(1, IContextKeyService),
    __param(2, IConfigurationService),
    __param(3, IAccessibilityService),
    __param(4, IKeybindingService)
], ContentHoverWidget);
export { ContentHoverWidget };
function computeDistanceFromPointToRectangle(pointX, pointY, left, top, width, height) {
    const x = (left + width / 2); // x center of rectangle
    const y = (top + height / 2); // y center of rectangle
    const dx = Math.max(Math.abs(pointX - x) - width / 2, 0);
    const dy = Math.max(Math.abs(pointY - y) - height / 2, 0);
    return Math.sqrt(dx * dx + dy * dy);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudEhvdmVyV2lkZ2V0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2hvdmVyL2Jyb3dzZXIvY29udGVudEhvdmVyV2lkZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBSXZELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3JFLE9BQU8sRUFBZSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxXQUFXLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUUzRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFJM0QsTUFBTSx1QkFBdUIsR0FBRyxFQUFFLENBQUM7QUFFNUIsSUFBTSxrQkFBa0IsR0FBeEIsTUFBTSxrQkFBbUIsU0FBUSxzQkFBc0I7O2FBRS9DLE9BQUUsR0FBRyw0Q0FBNEMsQUFBL0MsQ0FBZ0Q7YUFDakQsb0JBQWUsR0FBa0IsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQUFBekMsQ0FBMEM7SUFvQnhFLElBQVcscUJBQXFCO1FBQy9CLE9BQU8sQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLE1BQU0sc0NBQThCLENBQUMsQ0FBQztJQUNwRSxDQUFDO0lBRUQsSUFB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