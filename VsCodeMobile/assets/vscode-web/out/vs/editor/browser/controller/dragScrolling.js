/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as dom from '../../../base/browser/dom.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { Position } from '../../common/core/position.js';
import { createCoordinatesRelativeToEditor, createEditorPagePosition, PageCoordinates } from '../editorDom.js';
import { MouseTarget } from './mouseTarget.js';
export class DragScrolling extends Disposable {
    constructor(_context, _viewHelper, _mouseTargetFactory, _dispatchMouse) {
        super();
        this._context = _context;
        this._viewHelper = _viewHelper;
        this._mouseTargetFactory = _mouseTargetFactory;
        this._dispatchMouse = _dispatchMouse;
        this._operation = null;
    }
    dispose() {
        super.dispose();
        this.stop();
    }
    start(position, mouseEvent) {
        if (this._operation) {
            this._operation.setPosition(position, mouseEvent);
        }
        else {
            this._operation = this._createDragScrollingOperation(position, mouseEvent);
        }
    }
    stop() {
        if (this._operation) {
            this._operation.dispose();
            this._operation = null;
        }
    }
}
export class DragScrollingOperation extends Disposable {
    constructor(_context, _viewHelper, _mouseTargetFactory, _dispatchMouse, position, mouseEvent) {
        super();
        this._context = _context;
        this._viewHelper = _viewHelper;
        this._mouseTargetFactory = _mouseTargetFactory;
        this._dispatchMouse = _dispatchMouse;
        this._position = position;
        this._mouseEvent = mouseEvent;
        this._lastTime = Date.now();
        this._animationFrameDisposable = dom.scheduleAtNextAnimationFrame(dom.getWindow(mouseEvent.browserEvent), () => this._execute());
    }
    dispose() {
        this._animationFrameDisposable.dispose();
        super.dispose();
    }
    setPosition(position, mouseEvent) {
        this._position = position;
        this._mouseEvent = mouseEvent;
    }
    /**
     * update internal state and return elapsed ms since last time
     */
    _tick() {
        const now = Date.now();
        const elapsed = now - this._lastTime;
        this._lastTime = now;
        return elapsed;
    }
}
export class TopBottomDragScrolling extends DragScrolling {
    _createDragScrollingOperation(position, mouseEvent) {
        return new TopBottomDragScrollingOperation(this._context, this._viewHelper, this._mouseTargetFactory, this._dispatchMouse, position, mouseEvent);
    }
}
export class TopBottomDragScrollingOperation extends DragScrollingOperation {
    /**
     * get the number of lines per second to auto-scroll
     */
    _getScrollSpeed() {
        const lineHeight = this._context.configuration.options.get(75 /* EditorOption.lineHeight */);
        const viewportInLines = this._context.configuration.options.get(165 /* EditorOption.layoutInfo */).height / lineHeight;
        const outsideDistanceInLines = this._position.outsideDistance / lineHeight;
        if (outsideDistanceInLines <= 1.5) {
            return Math.max(30, viewportInLines * (1 + outsideDistanceInLines));
        }
        if (outsideDistanceInLines <= 3) {
            return Math.max(60, viewportInLines * (2 + outsideDistanceInLines));
        }
        return Math.max(200, viewportInLines * (7 + outsideDistanceInLines));
    }
    _execute() {
        const lineHeight = this._context.configuration.options.get(75 /* EditorOption.lineHeight */);
        const scrollSpeedInLines = this._getScrollSpeed();
        const elapsed = this._tick();
        const scrollInPixels = scrollSpeedInLines * (elapsed / 1000) * lineHeight;
        const scrollValue = (this._position.outsidePosition === 'above' ? -scrollInPixels : scrollInPixels);
        this._context.viewModel.viewLayout.deltaScrollNow(0, scrollValue);
        this._viewHelper.renderNow();
        const viewportData = this._context.viewLayout.getLinesViewportData();
        const edgeLineNumber = (this._position.outsidePosition === 'above' ? viewportData.startLineNumber : viewportData.endLineNumber);
        // First, try to find a position that matches the horizontal position of the mouse
        let mouseTarget;
        {
            const editorPos = createEditorPagePosition(this._viewHelper.viewDomNode);
            const horizontalScrollbarHeight = this._context.configuration.options.get(165 /* EditorOption.layoutInfo */).horizontalScrollbarHeight;
            const pos = new PageCoordinates(this._mouseEvent.pos.x, editorPos.y + editorPos.height - horizontalScrollbarHeight - 0.1);
            const relativePos = createCoordinatesRelativeToEditor(this._viewHelper.viewDomNode, editorPos, pos);
            mouseTarget = this._mouseTargetFactory.createMouseTarget(this._viewHelper.getLastRenderData(), editorPos, pos, relativePos, null);
        }
        if (!mouseTarget.position || mouseTarget.position.lineNumber !== edgeLineNumber) {
            if (this._position.outsidePosition === 'above') {
                mouseTarget = MouseTarget.createOutsideEditor(this._position.mouseColumn, new Position(edgeLineNumber, 1), 'above', this._position.outsideDistance);
            }
            else {
                mouseTarget = MouseTarget.createOutsideEditor(this._position.mouseColumn, new Position(edgeLineNumber, this._context.viewModel.getLineMaxColumn(edgeLineNumber)), 'below', this._position.outsideDistance);
            }
        }
        this._dispatchMouse(mouseTarget, true, 2 /* NavigationCommandRevealType.None */);
        this._animationFrameDisposable = dom.scheduleAtNextAnimationFrame(dom.getWindow(mouseTarget.element), () => this._execute());
    }
}
export class LeftRightDragScrolling extends DragScrolling {
    _createDragScrollingOperation(position, mouseEvent) {
        return new LeftRightDragScrollingOperation(this._context, this._viewHelper, this._mouseTargetFactory, this._dispatchMouse, position, mouseEvent);
    }
}
export class LeftRightDragScrollingOperation extends DragScrollingOperation {
    /**
     * get the number of cols per second to auto-scroll
     */
    _getScrollSpeed() {
        const charWidth = this._context.configuration.options.get(59 /* EditorOption.fontInfo */).typicalFullwidthCharacterWidth;
        const viewportInChars = this._context.configuration.options.get(165 /* EditorOption.layoutInfo */).contentWidth / charWidth;
        const outsideDistanceInChars = this._position.outsideDistance / charWidth;
        if (outsideDistanceInChars <= 1.5) {
            return Math.max(30, viewportInChars * (1 + outsideDistanceInChars));
        }
        if (outsideDistanceInChars <= 3) {
            return Math.max(60, viewportInChars * (2 + outsideDistanceInChars));
        }
        return Math.max(200, viewportInChars * (7 + outsideDistanceInChars));
    }
    _execute() {
        const charWidth = this._context.configuration.options.get(59 /* EditorOption.fontInfo */).typicalFullwidthCharacterWidth;
        const scrollSpeedInChars = this._getScrollSpeed();
        const elapsed = this._tick();
        const scrollInPixels = scrollSpeedInChars * (elapsed / 1000) * charWidth * 0.5;
        const scrollValue = (this._position.outsidePosition === 'left' ? -scrollInPixels : scrollInPixels);
        this._context.viewModel.viewLayout.deltaScrollNow(scrollValue, 0);
        this._viewHelper.renderNow();
        if (!this._position.position) {
            return;
        }
        const edgeLineNumber = this._position.position.lineNumber;
        // First, try to find a position that matches the horizontal position of the mouse
        let mouseTarget;
        {
            const editorPos = createEditorPagePosition(this._viewHelper.viewDomNode);
            const horizontalScrollbarHeight = this._context.configuration.options.get(165 /* EditorOption.layoutInfo */).horizontalScrollbarHeight;
            const pos = new PageCoordinates(this._mouseEvent.pos.x, editorPos.y + editorPos.height - horizontalScrollbarHeight - 0.1);
            const relativePos = createCoordinatesRelativeToEditor(this._viewHelper.viewDomNode, editorPos, pos);
            mouseTarget = this._mouseTargetFactory.createMouseTarget(this._viewHelper.getLastRenderData(), editorPos, pos, relativePos, null);
        }
        if (this._position.outsidePosition === 'left') {
            mouseTarget = MouseTarget.createOutsideEditor(mouseTarget.mouseColumn, new Position(edgeLineNumber, mouseTarget.mouseColumn), 'left', this._position.outsideDistance);
        }
        else {
            mouseTarget = MouseTarget.createOutsideEditor(mouseTarget.mouseColumn, new Position(edgeLineNumber, mouseTarget.mouseColumn), 'right', this._position.outsideDistance);
        }
        this._dispatchMouse(mouseTarget, true, 2 /* NavigationCommandRevealType.None */);
        this._animationFrameDisposable = dom.scheduleAtNextAnimationFrame(dom.getWindow(mouseTarget.element), () => this._execute());
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHJhZ1Njcm9sbGluZy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci9jb250cm9sbGVyL2RyYWdTY3JvbGxpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSw4QkFBOEIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsVUFBVSxFQUFlLE1BQU0sbUNBQW1DLENBQUM7QUFFNUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBSXpELE9BQU8sRUFBRSxpQ0FBaUMsRUFBRSx3QkFBd0IsRUFBb0IsZUFBZSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFakksT0FBTyxFQUFFLFdBQVcsRUFBc0IsTUFBTSxrQkFBa0IsQ0FBQztBQUVuRSxNQUFNLE9BQWdCLGFBQWMsU0FBUSxVQUFVO0lBSXJELFlBQ29CLFFBQXFCLEVBQ3JCLFdBQWtDLEVBQ2xDLG1CQUF1QyxFQUN2QyxjQUFtSDtRQUV0SSxLQUFLLEVBQUUsQ0FBQztRQUxXLGFBQVEsR0FBUixRQUFRLENBQWE7UUFDckIsZ0JBQVcsR0FBWCxXQUFXLENBQXVCO1FBQ2xDLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBb0I7UUFDdkMsbUJBQWMsR0FBZCxjQUFjLENBQXFHO1FBR3RJLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO0lBQ3hCLENBQUM7SUFFZSxPQUFPO1FBQ3RCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNoQixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDYixDQUFDO0lBRU0sS0FBSyxDQUFDLFFBQW1DLEVBQUUsVUFBNEI7UUFDN0UsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDckIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FB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