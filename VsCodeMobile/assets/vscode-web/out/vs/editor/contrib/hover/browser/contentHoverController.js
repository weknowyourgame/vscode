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
var ContentHoverController_1;
import { DECREASE_HOVER_VERBOSITY_ACTION_ID, INCREASE_HOVER_VERBOSITY_ACTION_ID, SHOW_OR_FOCUS_HOVER_ACTION_ID } from './hoverActionIds.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { InlineSuggestionHintsContentWidget } from '../../inlineCompletions/browser/hintsWidget/inlineCompletionsHintsWidget.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { isMousePositionWithinElement, shouldShowHover } from './hoverUtils.js';
import { ContentHoverWidgetWrapper } from './contentHoverWidgetWrapper.js';
import './hover.css';
import { Emitter } from '../../../../base/common/event.js';
import { isOnColorDecorator } from '../../colorPicker/browser/hoverColorPicker/hoverColorPicker.js';
import { isModifierKey } from '../../../../base/common/keyCodes.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
// sticky hover widget which doesn't disappear on focus out and such
const _sticky = false;
let ContentHoverController = class ContentHoverController extends Disposable {
    static { ContentHoverController_1 = this; }
    static { this.ID = 'editor.contrib.contentHover'; }
    constructor(_editor, _contextMenuService, _instantiationService, _keybindingService) {
        super();
        this._editor = _editor;
        this._instantiationService = _instantiationService;
        this._keybindingService = _keybindingService;
        this._onHoverContentsChanged = this._register(new Emitter());
        this.onHoverContentsChanged = this._onHoverContentsChanged.event;
        this.shouldKeepOpenOnEditorMouseMoveOrLeave = false;
        this._listenersStore = new DisposableStore();
        this._isMouseDown = false;
        this._ignoreMouseEvents = false;
        this._reactToEditorMouseMoveRunner = this._register(new RunOnceScheduler(() => {
            if (this._mouseMoveEvent) {
                this._reactToEditorMouseMove(this._mouseMoveEvent);
            }
        }, 0));
        this._register(_contextMenuService.onDidShowContextMenu(() => {
            this.hideContentHover();
            this._ignoreMouseEvents = true;
        }));
        this._register(_contextMenuService.onDidHideContextMenu(() => {
            this._ignoreMouseEvents = false;
        }));
        this._hookListeners();
        this._register(this._editor.onDidChangeConfiguration((e) => {
            if (e.hasChanged(69 /* EditorOption.hover */)) {
                this._unhookListeners();
                this._hookListeners();
            }
        }));
    }
    static get(editor) {
        return editor.getContribution(ContentHoverController_1.ID);
    }
    _hookListeners() {
        const hoverOpts = this._editor.getOption(69 /* EditorOption.hover */);
        this._hoverSettings = {
            enabled: hoverOpts.enabled,
            sticky: hoverOpts.sticky,
            hidingDelay: hoverOpts.hidingDelay
        };
        if (hoverOpts.enabled === 'off') {
            this._cancelSchedulerAndHide();
        }
        this._listenersStore.add(this._editor.onMouseDown((e) => this._onEditorMouseDown(e)));
        this._listenersStore.add(this._editor.onMouseUp(() => this._onEditorMouseUp()));
        this._listenersStore.add(this._editor.onMouseMove((e) => this._onEditorMouseMove(e)));
        this._listenersStore.add(this._editor.onKeyDown((e) => this._onKeyDown(e)));
        this._listenersStore.add(this._editor.onMouseLeave((e) => this._onEditorMouseLeave(e)));
        this._listenersStore.add(this._editor.onDidChangeModel(() => this._cancelSchedulerAndHide()));
        this._listenersStore.add(this._editor.onDidChangeModelContent(() => this._cancelScheduler()));
        this._listenersStore.add(this._editor.onDidScrollChange((e) => this._onEditorScrollChanged(e)));
    }
    _unhookListeners() {
        this._listenersStore.clear();
    }
    _cancelSchedulerAndHide() {
        this._cancelScheduler();
        this.hideContentHover();
    }
    _cancelScheduler() {
        this._mouseMoveEvent = undefined;
        this._reactToEditorMouseMoveRunner.cancel();
    }
    _onEditorScrollChanged(e) {
        if (this._ignoreMouseEvents) {
            return;
        }
        if (e.scrollTopChanged || e.scrollLeftChanged) {
            this.hideContentHover();
        }
    }
    _onEditorMouseDown(mouseEvent) {
        if (this._ignoreMouseEvents) {
            return;
        }
        this._isMouseDown = true;
        const shouldKeepHoverWidgetVisible = this._shouldKeepHoverWidgetVisible(mouseEvent);
        if (shouldKeepHoverWidgetVisible) {
            return;
        }
        this.hideContentHover();
    }
    _shouldKeepHoverWidgetVisible(mouseEvent) {
        return this._isMouseOnContentHoverWidget(mouseEvent) || this._isContentWidgetResizing() || isOnColorDecorator(mouseEvent);
    }
    _isMouseOnContentHoverWidget(mouseEvent) {
        if (!this._contentWidget) {
            return false;
        }
        return isMousePositionWithinElement(this._contentWidget.getDomNode(), mouseEvent.event.posx, mouseEvent.event.posy);
    }
    _onEditorMouseUp() {
        if (this._ignoreMouseEvents) {
            return;
        }
        this._isMouseDown = false;
    }
    _onEditorMouseLeave(mouseEvent) {
        if (this._ignoreMouseEvents) {
            return;
        }
        if (this.shouldKeepOpenOnEditorMouseMoveOrLeave) {
            return;
        }
        this._cancelScheduler();
        const shouldKeepHoverWidgetVisible = this._shouldKeepHoverWidgetVisible(mouseEvent);
        if (shouldKeepHoverWidgetVisible) {
            return;
        }
        if (_sticky) {
            return;
        }
        this.hideContentHover();
    }
    _shouldKeepCurrentHover(mouseEvent) {
        const contentWidget = this._contentWidget;
        if (!contentWidget) {
            return false;
        }
        const isHoverSticky = this._hoverSettings.sticky;
        const isMouseOnStickyContentHoverWidget = (mouseEvent, isHoverSticky) => {
            const isMouseOnContentHoverWidget = this._isMouseOnContentHoverWidget(mouseEvent);
            return isHoverSticky && isMouseOnContentHoverWidget;
        };
        const isMouseOnColorPickerOrChoosingColor = (mouseEvent) => {
            const isColorPickerVisible = contentWidget.isColorPickerVisible;
            const isMouseOnContentHoverWidget = this._isMouseOnContentHoverWidget(mouseEvent);
            const isMouseOnHoverWithColorPicker = isColorPickerVisible && isMouseOnContentHoverWidget;
            const isMaybeChoosingColor = isColorPickerVisible && this._isMouseDown;
            return isMouseOnHoverWithColorPicker || isMaybeChoosingColor;
        };
        // TODO@aiday-mar verify if the following is necessary code
        const isTextSelectedWithinContentHoverWidget = (mouseEvent, sticky) => {
            const view = mouseEvent.event.browserEvent.view;
            if (!view) {
                return false;
            }
            return sticky && contentWidget.containsNode(view.document.activeElement) && !view.getSelection()?.isCollapsed;
        };
        const isFocused = contentWidget.isFocused;
        const isResizing = contentWidget.isResizing;
        const isStickyAndVisibleFromKeyboard = this._hoverSettings.sticky && contentWidget.isVisibleFromKeyboard;
        return this.shouldKeepOpenOnEditorMouseMoveOrLeave
            || isFocused
            || isResizing
            || isStickyAndVisibleFromKeyboard
            || isMouseOnStickyContentHoverWidget(mouseEvent, isHoverSticky)
            || isMouseOnColorPickerOrChoosingColor(mouseEvent)
            || isTextSelectedWithinContentHoverWidget(mouseEvent, isHoverSticky);
    }
    _onEditorMouseMove(mouseEvent) {
        if (this._ignoreMouseEvents) {
            return;
        }
        this._mouseMoveEvent = mouseEvent;
        const shouldKeepCurrentHover = this._shouldKeepCurrentHover(mouseEvent);
        if (shouldKeepCurrentHover) {
            this._reactToEditorMouseMoveRunner.cancel();
            return;
        }
        const shouldRescheduleHoverComputation = this._shouldRescheduleHoverComputation();
        if (shouldRescheduleHoverComputation) {
            if (!this._reactToEditorMouseMoveRunner.isScheduled()) {
                this._reactToEditorMouseMoveRunner.schedule(this._hoverSettings.hidingDelay);
            }
            return;
        }
        this._reactToEditorMouseMove(mouseEvent);
    }
    _shouldRescheduleHoverComputation() {
        const hidingDelay = this._hoverSettings.hidingDelay;
        const isContentHoverWidgetVisible = this._contentWidget?.isVisible ?? false;
        // If the mouse is not over the widget, and if sticky is on,
        // then give it a grace period before reacting to the mouse event
        return isContentHoverWidgetVisible && this._hoverSettings.sticky && hidingDelay > 0;
    }
    _reactToEditorMouseMove(mouseEvent) {
        if (shouldShowHover(this._hoverSettings.enabled, this._editor.getOption(86 /* EditorOption.multiCursorModifier */), mouseEvent)) {
            const contentWidget = this._getOrCreateContentWidget();
            if (contentWidget.showsOrWillShow(mouseEvent)) {
                return;
            }
        }
        if (_sticky) {
            return;
        }
        this.hideContentHover();
    }
    _onKeyDown(e) {
        if (this._ignoreMouseEvents) {
            return;
        }
        if (!this._contentWidget) {
            return;
        }
        const isPotentialKeyboardShortcut = this._isPotentialKeyboardShortcut(e);
        const isModifierKeyPressed = isModifierKey(e.keyCode);
        if (isPotentialKeyboardShortcut || isModifierKeyPressed) {
            return;
        }
        if (this._contentWidget.isFocused && e.keyCode === 2 /* KeyCode.Tab */) {
            return;
        }
        this.hideContentHover();
    }
    _isPotentialKeyboardShortcut(e) {
        if (!this._editor.hasModel() || !this._contentWidget) {
            return false;
        }
        const resolvedKeyboardEvent = this._keybindingService.softDispatch(e, this._editor.getDomNode());
        const moreChordsAreNeeded = resolvedKeyboardEvent.kind === 1 /* ResultKind.MoreChordsNeeded */;
        const isHoverAction = resolvedKeyboardEvent.kind === 2 /* ResultKind.KbFound */
            && (resolvedKeyboardEvent.commandId === SHOW_OR_FOCUS_HOVER_ACTION_ID
                || resolvedKeyboardEvent.commandId === INCREASE_HOVER_VERBOSITY_ACTION_ID
                || resolvedKeyboardEvent.commandId === DECREASE_HOVER_VERBOSITY_ACTION_ID)
            && this._contentWidget.isVisible;
        return moreChordsAreNeeded || isHoverAction;
    }
    hideContentHover() {
        if (_sticky) {
            return;
        }
        if (InlineSuggestionHintsContentWidget.dropDownVisible) {
            return;
        }
        this._contentWidget?.hide();
    }
    _getOrCreateContentWidget() {
        if (!this._contentWidget) {
            this._contentWidget = this._instantiationService.createInstance(ContentHoverWidgetWrapper, this._editor);
            this._listenersStore.add(this._contentWidget.onContentsChanged(() => this._onHoverContentsChanged.fire()));
        }
        return this._contentWidget;
    }
    showContentHover(range, mode, source, focus) {
        this._getOrCreateContentWidget().startShowingAtRange(range, mode, source, focus);
    }
    _isContentWidgetResizing() {
        return this._contentWidget?.widget.isResizing || false;
    }
    focusedHoverPartIndex() {
        return this._getOrCreateContentWidget().focusedHoverPartIndex();
    }
    doesHoverAtIndexSupportVerbosityAction(index, action) {
        return this._getOrCreateContentWidget().doesHoverAtIndexSupportVerbosityAction(index, action);
    }
    updateHoverVerbosityLevel(action, index, focus) {
        this._getOrCreateContentWidget().updateHoverVerbosityLevel(action, index, focus);
    }
    focus() {
        this._contentWidget?.focus();
    }
    focusHoverPartWithIndex(index) {
        this._contentWidget?.focusHoverPartWithIndex(index);
    }
    scrollUp() {
        this._contentWidget?.scrollUp();
    }
    scrollDown() {
        this._contentWidget?.scrollDown();
    }
    scrollLeft() {
        this._contentWidget?.scrollLeft();
    }
    scrollRight() {
        this._contentWidget?.scrollRight();
    }
    pageUp() {
        this._contentWidget?.pageUp();
    }
    pageDown() {
        this._contentWidget?.pageDown();
    }
    goToTop() {
        this._contentWidget?.goToTop();
    }
    goToBottom() {
        this._contentWidget?.goToBottom();
    }
    getWidgetContent() {
        return this._contentWidget?.getWidgetContent();
    }
    getAccessibleWidgetContent() {
        return this._contentWidget?.getAccessibleWidgetContent();
    }
    getAccessibleWidgetContentAtIndex(index) {
        return this._contentWidget?.getAccessibleWidgetContentAtIndex(index);
    }
    get isColorPickerVisible() {
        return this._contentWidget?.isColorPickerVisible;
    }
    get isHoverVisible() {
        return this._contentWidget?.isVisible;
    }
    dispose() {
        super.dispose();
        this._unhookListeners();
        this._listenersStore.dispose();
        this._contentWidget?.dispose();
    }
};
ContentHoverController = ContentHoverController_1 = __decorate([
    __param(1, IContextMenuService),
    __param(2, IInstantiationService),
    __param(3, IKeybindingService)
], ContentHoverController);
export { ContentHoverController };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudEhvdmVyQ29udHJvbGxlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL2NvbnRlbnRIb3ZlckNvbnRyb2xsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxrQ0FBa0MsRUFBRSxrQ0FBa0MsRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBRTVJLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFNbkYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLE1BQU0sNkVBQTZFLENBQUM7QUFDakksT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFHMUYsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDcEUsT0FBTyxFQUFFLDRCQUE0QixFQUFFLGVBQWUsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ2hGLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzNFLE9BQU8sYUFBYSxDQUFDO0FBQ3JCLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUNwRyxPQUFPLEVBQUUsYUFBYSxFQUFXLE1BQU0scUNBQXFDLENBQUM7QUFDN0UsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFFOUYsb0VBQW9FO0FBQ3BFLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FFbkI7QUFRSyxJQUFNLHNCQUFzQixHQUE1QixNQUFNLHNCQUF1QixTQUFRLFVBQVU7O2FBSzlCLE9BQUUsR0FBRyw2QkFBNkIsQUFBaEMsQ0FBaUM7SUFnQjFELFlBQ2tCLE9BQW9CLEVBQ2hCLG1CQUF3QyxFQUN0QyxxQkFBNkQsRUFDaEUsa0JBQXVEO1FBRTNFLEtBQUssRUFBRSxDQUFDO1FBTFMsWUFBTyxHQUFQLE9BQU8sQ0FBYTtRQUVHLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBdUI7UUFDL0MsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFvQjtRQXZCM0QsNEJBQXVCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFDL0QsMkJBQXNCLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQztRQUlyRSwyQ0FBc0MsR0FBWSxLQUFLLENBQUM7UUFFOUMsb0JBQWUsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBUWpELGlCQUFZLEdBQVksS0FBSyxDQUFDO1FBRTlCLHVCQUFrQixHQUFZLEtBQUssQ0FBQztRQVMzQyxJQUFJLENBQUMsNkJBQTZCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGdCQUFnQixDQUN2RSxHQUFHLEVBQUU7WUFDSixJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDMUIsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUNwRCxDQUFDO1FBQ0YsQ0FBQyxFQUFFLENBQUMsQ0FDSixDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsU0FBUyxDQUFDLG1CQUFtQixDQUFDLG9CQUFvQixDQUFDLEdBQUcsRUFBRTtZQUM1RCxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUN4QixJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO1FBQ2hDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDSixJQUFJLENBQUMsU0FBUyxDQUFDLG1CQUFtQixDQUFDLG9CQUFvQixDQUFDLEdBQUcsRUFBRTtZQUM1RCxJQUFJLENBQUMsa0JBQWtCLEdBQUcsS0FBSyxDQUFDO1FBQ2pDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDSixJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDdEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBNEIsRUFBRSxFQUFFO1lBQ3JGLElBQUksQ0FBQyxDQUFDLFVBQVUsNkJBQW9CLEVBQUUsQ0FBQztnQkFDdEMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7Z0JBQ3hCLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN2QixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQW1CO1FBQzdCLE9BQU8sTUFBTSxDQUFDLGVBQWUsQ0FBeUIsd0JBQXNCLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDbEYsQ0FBQztJQUVPLGNBQWM7UUFDckIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLDZCQUFvQixDQUFDO1FBQzdELElBQUksQ0FBQyxjQUFjLEdBQUc7WUFDckIsT0FBTyxFQUFFLFNBQVMsQ0FBQyxPQUFPO1lBQzFCLE1BQU0sRUFBRSxTQUFTLENBQUMsTUFBTTtZQUN4QixXQUFXLEVBQUUsU0FBUyxDQUFDLFdBQVc7U0FDbEMsQ0FBQztRQUNGLElBQUksU0FBUyxDQUFDLE9BQU8sS0FBSyxLQUFLLEVBQUUsQ0FBQztZQUNqQyxJQUFJLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztRQUNoQyxDQUFDO1FBQ0QsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFvQixFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3pHLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNoRixJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQW9CLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFpQixFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM1RixJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN4RixJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM5RixJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLHVCQUF1QixDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM5RixJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBZSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQy9HLENBQUM7SUFFTyxnQkFBZ0I7UUFDdkIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUM5QixDQUFDO0lBRU8sdUJBQXVCO1FBQzlCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO0lBQ3pCLENBQUM7SUFFTyxnQkFBZ0I7UUFDdkIsSUFBSSxDQUFDLGVBQWUsR0FBRyxTQUFTLENBQUM7UUFDakMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLE1BQU0sRUFBRSxDQUFDO0lBQzdDLENBQUM7SUFFTyxzQkFBc0IsQ0FBQyxDQUFlO1FBQzdDLElBQUksSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDN0IsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsSUFBSSxDQUFDLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUMvQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN6QixDQUFDO0lBQ0YsQ0FBQztJQUVPLGtCQUFrQixDQUFDLFVBQTZCO1FBQ3ZELElBQUksSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDN0IsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQztRQUN6QixNQUFNLDRCQUE0QixHQUFHLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNwRixJQUFJLDRCQUE0QixFQUFFLENBQUM7WUFDbEMsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztJQUN6QixDQUFDO0lBRU8sNkJBQTZCLENBQUMsVUFBb0M7UUFDekUsT0FBTyxJQUFJLENBQUMsNEJBQTRCLENBQUMsVUFBVSxDQUFDLElBQUksSUFBSSxDQUFDLHdCQUF3QixFQUFFLElBQUksa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDM0gsQ0FBQztJQUVPLDRCQUE0QixDQUFDLFVBQW9DO1FBQ3hFLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDMUIsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBQ0QsT0FBTyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFVBQVUsRUFBRSxFQUFFLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDckgsQ0FBQztJQUVPLGdCQUFnQjtRQUN2QixJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQzdCLE9BQU87UUFDUixDQUFDO1FBQ0QsSUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUM7SUFDM0IsQ0FBQztJQUVPLG1CQUFtQixDQUFDLFVBQW9DO1FBQy9ELElBQUksSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDN0IsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLElBQUksQ0FBQyxzQ0FBc0MsRUFBRSxDQUFDO1lBQ2pELE9BQU87UUFDUixDQUFDO1FBQ0QsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDeEIsTUFBTSw0QkFBNEIsR0FBRyxJQUFJLENBQUMsNkJBQTZCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDcEYsSUFBSSw0QkFBNEIsRUFBRSxDQUFDO1lBQ2xDLE9BQU87UUFDUixDQUFDO1FBQ0QsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNiLE9BQU87UUFDUixDQUFDO1FBQ0QsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7SUFDekIsQ0FBQztJQUVPLHVCQUF1QixDQUFDLFVBQTZCO1FBQzVELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7UUFDMUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3BCLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDO1FBQ2pELE1BQU0saUNBQWlDLEdBQUcsQ0FBQyxVQUE2QixFQUFFLGFBQXNCLEVBQVcsRUFBRTtZQUM1RyxNQUFNLDJCQUEyQixHQUFHLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNsRixPQUFPLGFBQWEsSUFBSSwyQkFBMkIsQ0FBQztRQUNyRCxDQUFDLENBQUM7UUFDRixNQUFNLG1DQUFtQyxHQUFHLENBQUMsVUFBNkIsRUFBVyxFQUFFO1lBQ3RGLE1BQU0sb0JBQW9CLEdBQUcsYUFBYSxDQUFDLG9CQUFvQixDQUFDO1lBQ2hFLE1BQU0sMkJBQTJCLEdBQUcsSUFBSSxDQUFDLDRCQUE0QixDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ2xGLE1BQU0sNkJBQTZCLEdBQUcsb0JBQW9CLElBQUksMkJBQTJCLENBQUM7WUFDMUYsTUFBTSxvQkFBb0IsR0FBRyxvQkFBb0IsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDO1lBQ3ZFLE9BQU8sNkJBQTZCLElBQUksb0JBQW9CLENBQUM7UUFDOUQsQ0FBQyxDQUFDO1FBQ0YsMkRBQTJEO1FBQzNELE1BQU0sc0NBQXNDLEdBQUcsQ0FBQyxVQUE2QixFQUFFLE1BQWUsRUFBVyxFQUFFO1lBQzFHLE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQztZQUNoRCxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ1gsT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDO1lBQ0QsT0FBTyxNQUFNLElBQUksYUFBYSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxFQUFFLFdBQVcsQ0FBQztRQUMvRyxDQUFDLENBQUM7UUFDRixNQUFNLFNBQVMsR0FBRyxhQUFhLENBQUMsU0FBUyxDQUFDO1FBQzFDLE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxVQUFVLENBQUM7UUFDNUMsTUFBTSw4QkFBOEIsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sSUFBSSxhQUFhLENBQUMscUJBQXFCLENBQUM7UUFFekcsT0FBTyxJQUFJLENBQUMsc0NBQXNDO2VBQzlDLFNBQVM7ZUFDVCxVQUFVO2VBQ1YsOEJBQThCO2VBQzlCLGlDQUFpQyxDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUM7ZUFDNUQsbUNBQW1DLENBQUMsVUFBVSxDQUFDO2VBQy9DLHNDQUFzQyxDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRU8sa0JBQWtCLENBQUMsVUFBNkI7UUFDdkQsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUM3QixPQUFPO1FBQ1IsQ0FBQztRQUNELElBQUksQ0FBQyxlQUFlLEdBQUcsVUFBVSxDQUFDO1FBQ2xDLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3hFLElBQUksc0JBQXNCLEVBQUUsQ0FBQztZQUM1QixJQUFJLENBQUMsNkJBQTZCLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDNUMsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLGdDQUFnQyxHQUFHLElBQUksQ0FBQyxpQ0FBaUMsRUFBRSxDQUFDO1FBQ2xGLElBQUksZ0NBQWdDLEVBQUUsQ0FBQztZQUN0QyxJQUFJLENBQUMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUM7Z0JBQ3ZELElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUM5RSxDQUFDO1lBQ0QsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLENBQUMsdUJBQXVCLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUVPLGlDQUFpQztRQUN4QyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQztRQUNwRCxNQUFNLDJCQUEyQixHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsU0FBUyxJQUFJLEtBQUssQ0FBQztRQUM1RSw0REFBNEQ7UUFDNUQsaUVBQWlFO1FBQ2pFLE9BQU8sMkJBQTJCLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLElBQUksV0FBVyxHQUFHLENBQUMsQ0FBQztJQUNyRixDQUFDO0lBRU8sdUJBQXVCLENBQUMsVUFBNkI7UUFDNUQsSUFBSSxlQUFlLENBQ2xCLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUMzQixJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsMkNBQWtDLEVBQ3hELFVBQVUsQ0FDVixFQUFFLENBQUM7WUFDSCxNQUFNLGFBQWEsR0FBOEIsSUFBSSxDQUFDLHlCQUF5QixFQUFFLENBQUM7WUFDbEYsSUFBSSxhQUFhLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7Z0JBQy9DLE9BQU87WUFDUixDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksT0FBTyxFQUFFLENBQUM7WUFDYixPQUFPO1FBQ1IsQ0FBQztRQUNELElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO0lBQ3pCLENBQUM7SUFFTyxVQUFVLENBQUMsQ0FBaUI7UUFDbkMsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUM3QixPQUFPO1FBQ1IsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDMUIsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLDJCQUEyQixHQUFHLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN6RSxNQUFNLG9CQUFvQixHQUFHLGFBQWEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDdEQsSUFBSSwyQkFBMkIsSUFBSSxvQkFBb0IsRUFBRSxDQUFDO1lBQ3pELE9BQU87UUFDUixDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsT0FBTyx3QkFBZ0IsRUFBRSxDQUFDO1lBQ2hFLE9BQU87UUFDUixDQUFDO1FBQ0QsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7SUFDekIsQ0FBQztJQUVPLDRCQUE0QixDQUFDLENBQWlCO1FBQ3JELElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3RELE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQ2pHLE1BQU0sbUJBQW1CLEdBQUcscUJBQXFCLENBQUMsSUFBSSx3Q0FBZ0MsQ0FBQztRQUN2RixNQUFNLGFBQWEsR0FBRyxxQkFBcUIsQ0FBQyxJQUFJLCtCQUF1QjtlQUNuRSxDQUFDLHFCQUFxQixDQUFDLFNBQVMsS0FBSyw2QkFBNkI7bUJBQ2pFLHFCQUFxQixDQUFDLFNBQVMsS0FBSyxrQ0FBa0M7bUJBQ3RFLHFCQUFxQixDQUFDLFNBQVMsS0FBSyxrQ0FBa0MsQ0FBQztlQUN4RSxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQztRQUNsQyxPQUFPLG1CQUFtQixJQUFJLGFBQWEsQ0FBQztJQUM3QyxDQUFDO0lBRU0sZ0JBQWdCO1FBQ3RCLElBQUksT0FBTyxFQUFFLENBQUM7WUFDYixPQUFPO1FBQ1IsQ0FBQztRQUNELElBQUksa0NBQWtDLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDeEQsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLENBQUMsY0FBYyxFQUFFLElBQUksRUFBRSxDQUFDO0lBQzdCLENBQUM7SUFFTyx5QkFBeUI7UUFDaEMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUMxQixJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLENBQUMseUJBQXlCLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3pHLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsaUJBQWlCLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1RyxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDO0lBQzVCLENBQUM7SUFFTSxnQkFBZ0IsQ0FDdEIsS0FBWSxFQUNaLElBQW9CLEVBQ3BCLE1BQXdCLEVBQ3hCLEtBQWM7UUFFZCxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNsRixDQUFDO0lBRU8sd0JBQXdCO1FBQy9CLE9BQU8sSUFBSSxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsVUFBVSxJQUFJLEtBQUssQ0FBQztJQUN4RCxDQUFDO0lBRU0scUJBQXFCO1FBQzNCLE9BQU8sSUFBSSxDQUFDLHlCQUF5QixFQUFFLENBQUMscUJBQXFCLEVBQUUsQ0FBQztJQUNqRSxDQUFDO0lBRU0sc0NBQXNDLENBQUMsS0FBYSxFQUFFLE1BQTRCO1FBQ3hGLE9BQU8sSUFBSSxDQUFDLHlCQUF5QixFQUFFLENBQUMsc0NBQXNDLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQy9GLENBQUM7SUFFTSx5QkFBeUIsQ0FBQyxNQUE0QixFQUFFLEtBQWEsRUFBRSxLQUFlO1FBQzVGLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDLHlCQUF5QixDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDbEYsQ0FBQztJQUVNLEtBQUs7UUFDWCxJQUFJLENBQUMsY0FBYyxFQUFFLEtBQUssRUFBRSxDQUFDO0lBQzlCLENBQUM7SUFFTSx1QkFBdUIsQ0FBQyxLQUFhO1FBQzNDLElBQUksQ0FBQyxjQUFjLEVBQUUsdUJBQXVCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVNLFFBQVE7UUFDZCxJQUFJLENBQUMsY0FBYyxFQUFFLFFBQVEsRUFBRSxDQUFDO0lBQ2pDLENBQUM7SUFFTSxVQUFVO1FBQ2hCLElBQUksQ0FBQyxjQUFjLEVBQUUsVUFBVSxFQUFFLENBQUM7SUFDbkMsQ0FBQztJQUVNLFVBQVU7UUFDaEIsSUFBSSxDQUFDLGNBQWMsRUFBRSxVQUFVLEVBQUUsQ0FBQztJQUNuQyxDQUFDO0lBRU0sV0FBVztRQUNqQixJQUFJLENBQUMsY0FBYyxFQUFFLFdBQVcsRUFBRSxDQUFDO0lBQ3BDLENBQUM7SUFFTSxNQUFNO1FBQ1osSUFBSSxDQUFDLGNBQWMsRUFBRSxNQUFNLEVBQUUsQ0FBQztJQUMvQixDQUFDO0lBRU0sUUFBUTtRQUNkLElBQUksQ0FBQyxjQUFjLEVBQUUsUUFBUSxFQUFFLENBQUM7SUFDakMsQ0FBQztJQUVNLE9BQU87UUFDYixJQUFJLENBQUMsY0FBYyxFQUFFLE9BQU8sRUFBRSxDQUFDO0lBQ2hDLENBQUM7SUFFTSxVQUFVO1FBQ2hCLElBQUksQ0FBQyxjQUFjLEVBQUUsVUFBVSxFQUFFLENBQUM7SUFDbkMsQ0FBQztJQUVNLGdCQUFnQjtRQUN0QixPQUFPLElBQUksQ0FBQyxjQUFjLEVBQUUsZ0JBQWdCLEVBQUUsQ0FBQztJQUNoRCxDQUFDO0lBRU0sMEJBQTBCO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLGNBQWMsRUFBRSwwQkFBMEIsRUFBRSxDQUFDO0lBQzFELENBQUM7SUFFTSxpQ0FBaUMsQ0FBQyxLQUFhO1FBQ3JELE9BQU8sSUFBSSxDQUFDLGNBQWMsRUFBRSxpQ0FBaUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBRUQsSUFBVyxvQkFBb0I7UUFDOUIsT0FBTyxJQUFJLENBQUMsY0FBYyxFQUFFLG9CQUFvQixDQUFDO0lBQ2xELENBQUM7SUFFRCxJQUFXLGNBQWM7UUFDeEIsT0FBTyxJQUFJLENBQUMsY0FBYyxFQUFFLFNBQVMsQ0FBQztJQUN2QyxDQUFDO0lBRWUsT0FBTztRQUN0QixLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDaEIsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDeEIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUMvQixJQUFJLENBQUMsY0FBYyxFQUFFLE9BQU8sRUFBRSxDQUFDO0lBQ2hDLENBQUM7O0FBalhXLHNCQUFzQjtJQXVCaEMsV0FBQSxtQkFBbUIsQ0FBQTtJQUNuQixXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEsa0JBQWtCLENBQUE7R0F6QlIsc0JBQXNCLENBa1hsQyJ9