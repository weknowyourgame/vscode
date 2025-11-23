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
import { Disposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { IAccessibilityService } from '../../../../../platform/accessibility/common/accessibility.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { Selection } from '../../../../common/core/selection.js';
import { applyFontInfo } from '../../../config/domFontInfo.js';
import { ariaLabelForScreenReaderContent } from '../screenReaderUtils.js';
import { RichScreenReaderContent } from './screenReaderContentRich.js';
import { SimpleScreenReaderContent } from './screenReaderContentSimple.js';
let ScreenReaderSupport = class ScreenReaderSupport extends Disposable {
    constructor(_domNode, _context, _viewController, _keybindingService, _accessibilityService) {
        super();
        this._domNode = _domNode;
        this._context = _context;
        this._viewController = _viewController;
        this._keybindingService = _keybindingService;
        this._accessibilityService = _accessibilityService;
        // Configuration values
        this._contentLeft = 1;
        this._contentWidth = 1;
        this._contentHeight = 1;
        this._divWidth = 1;
        this._primarySelection = new Selection(1, 1, 1, 1);
        this._primaryCursorVisibleRange = null;
        this._state = this._register(new MutableDisposable());
        this._instantiateScreenReaderContent();
        this._updateConfigurationSettings();
        this._updateDomAttributes();
    }
    onWillPaste() {
        this._state.value?.onWillPaste();
    }
    onWillCut() {
        this._state.value?.onWillCut();
    }
    handleFocusChange(newFocusValue) {
        this._state.value?.onFocusChange(newFocusValue);
        this.writeScreenReaderContent();
    }
    onConfigurationChanged(e) {
        this._instantiateScreenReaderContent();
        this._updateConfigurationSettings();
        this._updateDomAttributes();
        if (e.hasChanged(2 /* EditorOption.accessibilitySupport */)) {
            this.writeScreenReaderContent();
        }
    }
    _instantiateScreenReaderContent() {
        const renderRichContent = this._context.configuration.options.get(107 /* EditorOption.renderRichScreenReaderContent */);
        if (this._renderRichContent !== renderRichContent) {
            this._renderRichContent = renderRichContent;
            this._state.value = this._createScreenReaderContent(renderRichContent);
        }
    }
    _createScreenReaderContent(renderRichContent) {
        if (renderRichContent) {
            return new RichScreenReaderContent(this._domNode, this._context, this._viewController, this._accessibilityService);
        }
        else {
            return new SimpleScreenReaderContent(this._domNode, this._context, this._viewController, this._accessibilityService);
        }
    }
    _updateConfigurationSettings() {
        const options = this._context.configuration.options;
        const layoutInfo = options.get(165 /* EditorOption.layoutInfo */);
        const wrappingColumn = layoutInfo.wrappingColumn;
        this._contentLeft = layoutInfo.contentLeft;
        this._contentWidth = layoutInfo.contentWidth;
        this._contentHeight = layoutInfo.height;
        this._fontInfo = options.get(59 /* EditorOption.fontInfo */);
        this._divWidth = Math.round(wrappingColumn * this._fontInfo.typicalHalfwidthCharacterWidth);
        this._state.value?.onConfigurationChanged(options);
    }
    _updateDomAttributes() {
        const options = this._context.configuration.options;
        this._domNode.domNode.setAttribute('role', 'textbox');
        this._domNode.domNode.setAttribute('aria-required', options.get(9 /* EditorOption.ariaRequired */) ? 'true' : 'false');
        this._domNode.domNode.setAttribute('aria-multiline', 'true');
        this._domNode.domNode.setAttribute('aria-autocomplete', options.get(104 /* EditorOption.readOnly */) ? 'none' : 'both');
        this._domNode.domNode.setAttribute('aria-roledescription', localize('editor', "editor"));
        this._domNode.domNode.setAttribute('aria-label', ariaLabelForScreenReaderContent(options, this._keybindingService));
        const tabSize = this._context.viewModel.model.getOptions().tabSize;
        const spaceWidth = options.get(59 /* EditorOption.fontInfo */).spaceWidth;
        this._domNode.domNode.style.tabSize = `${tabSize * spaceWidth}px`;
        const wordWrapOverride2 = options.get(154 /* EditorOption.wordWrapOverride2 */);
        const wordWrapOverride1 = (wordWrapOverride2 === 'inherit' ? options.get(153 /* EditorOption.wordWrapOverride1 */) : wordWrapOverride2);
        const wordWrap = (wordWrapOverride1 === 'inherit' ? options.get(149 /* EditorOption.wordWrap */) : wordWrapOverride1);
        this._domNode.domNode.style.textWrap = wordWrap === 'off' ? 'nowrap' : 'wrap';
    }
    onCursorStateChanged(e) {
        this._primarySelection = e.selections[0] ?? new Selection(1, 1, 1, 1);
    }
    prepareRender(ctx) {
        this.writeScreenReaderContent();
        this._primaryCursorVisibleRange = ctx.visibleRangeForPosition(this._primarySelection.getPosition());
    }
    render(ctx) {
        if (!this._primaryCursorVisibleRange) {
            // The primary cursor is outside the viewport => place textarea to the top left
            this._renderAtTopLeft();
            return;
        }
        const editorScrollLeft = this._context.viewLayout.getCurrentScrollLeft();
        const left = this._contentLeft + this._primaryCursorVisibleRange.left - editorScrollLeft;
        if (left < this._contentLeft || left > this._contentLeft + this._contentWidth) {
            // cursor is outside the viewport
            this._renderAtTopLeft();
            return;
        }
        const editorScrollTop = this._context.viewLayout.getCurrentScrollTop();
        const positionLineNumber = this._primarySelection.positionLineNumber;
        const top = this._context.viewLayout.getVerticalOffsetForLineNumber(positionLineNumber) - editorScrollTop;
        if (top < 0 || top > this._contentHeight) {
            // cursor is outside the viewport
            this._renderAtTopLeft();
            return;
        }
        // The <div> where we render the screen reader content does not support variable line heights,
        // all the lines must have the same height. We use the line height of the cursor position as the
        // line height for all lines.
        const lineHeight = this._context.viewLayout.getLineHeightForLineNumber(positionLineNumber);
        this._doRender(top, this._contentLeft, this._divWidth, lineHeight);
        this._state.value?.updateScrollTop(this._primarySelection);
    }
    _renderAtTopLeft() {
        this._doRender(0, 0, this._contentWidth, 1);
    }
    _doRender(top, left, width, height) {
        // For correct alignment of the screen reader content, we need to apply the correct font
        applyFontInfo(this._domNode, this._fontInfo);
        this._domNode.setTop(top);
        this._domNode.setLeft(left);
        this._domNode.setWidth(width);
        this._domNode.setHeight(height);
        this._domNode.setLineHeight(height);
    }
    setAriaOptions(options) {
        if (options.activeDescendant) {
            this._domNode.setAttribute('aria-haspopup', 'true');
            this._domNode.setAttribute('aria-autocomplete', 'list');
            this._domNode.setAttribute('aria-activedescendant', options.activeDescendant);
        }
        else {
            this._domNode.setAttribute('aria-haspopup', 'false');
            this._domNode.setAttribute('aria-autocomplete', 'both');
            this._domNode.removeAttribute('aria-activedescendant');
        }
        if (options.role) {
            this._domNode.setAttribute('role', options.role);
        }
    }
    writeScreenReaderContent() {
        this._state.value?.updateScreenReaderContent(this._primarySelection);
    }
};
ScreenReaderSupport = __decorate([
    __param(3, IKeybindingService),
    __param(4, IAccessibilityService)
], ScreenReaderSupport);
export { ScreenReaderSupport };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyZWVuUmVhZGVyU3VwcG9ydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci9jb250cm9sbGVyL2VkaXRDb250ZXh0L25hdGl2ZS9zY3JlZW5SZWFkZXJTdXBwb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN4RixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFHN0YsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBR2pFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUkvRCxPQUFPLEVBQUUsK0JBQStCLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUMxRSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUN2RSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUdwRSxJQUFNLG1CQUFtQixHQUF6QixNQUFNLG1CQUFvQixTQUFRLFVBQVU7SUFjbEQsWUFDa0IsUUFBa0MsRUFDbEMsUUFBcUIsRUFDckIsZUFBK0IsRUFDNUIsa0JBQXVELEVBQ3BELHFCQUE2RDtRQUVwRixLQUFLLEVBQUUsQ0FBQztRQU5TLGFBQVEsR0FBUixRQUFRLENBQTBCO1FBQ2xDLGFBQVEsR0FBUixRQUFRLENBQWE7UUFDckIsb0JBQWUsR0FBZixlQUFlLENBQWdCO1FBQ1gsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFvQjtRQUNuQywwQkFBcUIsR0FBckIscUJB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