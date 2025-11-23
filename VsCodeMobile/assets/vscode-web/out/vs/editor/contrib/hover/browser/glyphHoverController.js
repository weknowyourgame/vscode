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
var GlyphHoverController_1;
import { isModifierKey } from '../../../../base/common/keyCodes.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { isMousePositionWithinElement, shouldShowHover } from './hoverUtils.js';
import './hover.css';
import { GlyphHoverWidget } from './glyphHoverWidget.js';
// sticky hover widget which doesn't disappear on focus out and such
const _sticky = false;
let GlyphHoverController = class GlyphHoverController extends Disposable {
    static { GlyphHoverController_1 = this; }
    static { this.ID = 'editor.contrib.marginHover'; }
    constructor(_editor, _instantiationService) {
        super();
        this._editor = _editor;
        this._instantiationService = _instantiationService;
        this.shouldKeepOpenOnEditorMouseMoveOrLeave = false;
        this._listenersStore = new DisposableStore();
        this._hoverState = {
            mouseDown: false
        };
        this._reactToEditorMouseMoveRunner = this._register(new RunOnceScheduler(() => this._reactToEditorMouseMove(this._mouseMoveEvent), 0));
        this._hookListeners();
        this._register(this._editor.onDidChangeConfiguration((e) => {
            if (e.hasChanged(69 /* EditorOption.hover */)) {
                this._unhookListeners();
                this._hookListeners();
            }
        }));
    }
    static get(editor) {
        return editor.getContribution(GlyphHoverController_1.ID);
    }
    _hookListeners() {
        const hoverOpts = this._editor.getOption(69 /* EditorOption.hover */);
        this._hoverSettings = {
            enabled: hoverOpts.enabled,
            sticky: hoverOpts.sticky,
            hidingDelay: hoverOpts.hidingDelay
        };
        if (hoverOpts.enabled !== 'off') {
            this._listenersStore.add(this._editor.onMouseDown((e) => this._onEditorMouseDown(e)));
            this._listenersStore.add(this._editor.onMouseUp(() => this._onEditorMouseUp()));
            this._listenersStore.add(this._editor.onMouseMove((e) => this._onEditorMouseMove(e)));
            this._listenersStore.add(this._editor.onKeyDown((e) => this._onKeyDown(e)));
        }
        else {
            this._listenersStore.add(this._editor.onMouseMove((e) => this._onEditorMouseMove(e)));
            this._listenersStore.add(this._editor.onKeyDown((e) => this._onKeyDown(e)));
        }
        this._listenersStore.add(this._editor.onMouseLeave((e) => this._onEditorMouseLeave(e)));
        this._listenersStore.add(this._editor.onDidChangeModel(() => {
            this._cancelScheduler();
            this.hideGlyphHover();
        }));
        this._listenersStore.add(this._editor.onDidChangeModelContent(() => this._cancelScheduler()));
        this._listenersStore.add(this._editor.onDidScrollChange((e) => this._onEditorScrollChanged(e)));
    }
    _unhookListeners() {
        this._listenersStore.clear();
    }
    _cancelScheduler() {
        this._mouseMoveEvent = undefined;
        this._reactToEditorMouseMoveRunner.cancel();
    }
    _onEditorScrollChanged(e) {
        if (e.scrollTopChanged || e.scrollLeftChanged) {
            this.hideGlyphHover();
        }
    }
    _onEditorMouseDown(mouseEvent) {
        this._hoverState.mouseDown = true;
        const shouldNotHideCurrentHoverWidget = this._isMouseOnGlyphHoverWidget(mouseEvent);
        if (shouldNotHideCurrentHoverWidget) {
            return;
        }
        this.hideGlyphHover();
    }
    _isMouseOnGlyphHoverWidget(mouseEvent) {
        const glyphHoverWidgetNode = this._glyphWidget?.getDomNode();
        if (glyphHoverWidgetNode) {
            return isMousePositionWithinElement(glyphHoverWidgetNode, mouseEvent.event.posx, mouseEvent.event.posy);
        }
        return false;
    }
    _onEditorMouseUp() {
        this._hoverState.mouseDown = false;
    }
    _onEditorMouseLeave(mouseEvent) {
        if (this.shouldKeepOpenOnEditorMouseMoveOrLeave) {
            return;
        }
        this._cancelScheduler();
        const shouldNotHideCurrentHoverWidget = this._isMouseOnGlyphHoverWidget(mouseEvent);
        if (shouldNotHideCurrentHoverWidget) {
            return;
        }
        if (_sticky) {
            return;
        }
        this.hideGlyphHover();
    }
    _shouldNotRecomputeCurrentHoverWidget(mouseEvent) {
        const isHoverSticky = this._hoverSettings.sticky;
        const isMouseOnGlyphHoverWidget = this._isMouseOnGlyphHoverWidget(mouseEvent);
        return isHoverSticky && isMouseOnGlyphHoverWidget;
    }
    _onEditorMouseMove(mouseEvent) {
        if (this.shouldKeepOpenOnEditorMouseMoveOrLeave) {
            return;
        }
        this._mouseMoveEvent = mouseEvent;
        const shouldNotRecomputeCurrentHoverWidget = this._shouldNotRecomputeCurrentHoverWidget(mouseEvent);
        if (shouldNotRecomputeCurrentHoverWidget) {
            this._reactToEditorMouseMoveRunner.cancel();
            return;
        }
        this._reactToEditorMouseMove(mouseEvent);
    }
    _reactToEditorMouseMove(mouseEvent) {
        if (!mouseEvent) {
            return;
        }
        if (!shouldShowHover(this._hoverSettings.enabled, this._editor.getOption(86 /* EditorOption.multiCursorModifier */), mouseEvent)) {
            if (_sticky) {
                return;
            }
            this.hideGlyphHover();
            return;
        }
        const glyphWidgetShowsOrWillShow = this._tryShowHoverWidget(mouseEvent);
        if (glyphWidgetShowsOrWillShow) {
            return;
        }
        if (_sticky) {
            return;
        }
        this.hideGlyphHover();
    }
    _tryShowHoverWidget(mouseEvent) {
        const glyphWidget = this._getOrCreateGlyphWidget();
        return glyphWidget.showsOrWillShow(mouseEvent);
    }
    _onKeyDown(e) {
        if (!this._editor.hasModel()) {
            return;
        }
        if (isModifierKey(e.keyCode)) {
            // Do not hide hover when a modifier key is pressed
            return;
        }
        this.hideGlyphHover();
    }
    hideGlyphHover() {
        if (_sticky) {
            return;
        }
        this._glyphWidget?.hide();
    }
    _getOrCreateGlyphWidget() {
        if (!this._glyphWidget) {
            this._glyphWidget = this._instantiationService.createInstance(GlyphHoverWidget, this._editor);
        }
        return this._glyphWidget;
    }
    dispose() {
        super.dispose();
        this._unhookListeners();
        this._listenersStore.dispose();
        this._glyphWidget?.dispose();
    }
};
GlyphHoverController = GlyphHoverController_1 = __decorate([
    __param(1, IInstantiationService)
], GlyphHoverController);
export { GlyphHoverController };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2x5cGhIb3ZlckNvbnRyb2xsZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaG92ZXIvYnJvd3Nlci9nbHlwaEhvdmVyQ29udHJvbGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFJbkYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFFbkcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDcEUsT0FBTyxFQUFFLDRCQUE0QixFQUFFLGVBQWUsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ2hGLE9BQU8sYUFBYSxDQUFDO0FBQ3JCLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBRXpELG9FQUFvRTtBQUNwRSxNQUFNLE9BQU8sR0FBRyxLQUFLLENBRW5CO0FBWUssSUFBTSxvQkFBb0IsR0FBMUIsTUFBTSxvQkFBcUIsU0FBUSxVQUFVOzthQUU1QixPQUFFLEdBQUcsNEJBQTRCLEFBQS9CLENBQWdDO0lBZXpELFlBQ2tCLE9BQW9CLEVBQ2QscUJBQTZEO1FBRXBGLEtBQUssRUFBRSxDQUFDO1FBSFMsWUFBTyxHQUFQLE9BQU8sQ0FBYTtRQUNHLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBdUI7UUFmOUUsMkNBQXNDLEdBQVksS0FBSyxDQUFDO1FBRTlDLG9CQUFlLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztRQU9qRCxnQkFBVyxHQUFnQjtZQUNsQyxTQUFTLEVBQUUsS0FBSztTQUNoQixDQUFDO1FBT0QsSUFBSSxDQUFDLDZCQUE2QixHQUFHLElBQUksQ0FB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