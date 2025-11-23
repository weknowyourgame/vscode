/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as dom from '../../base/browser/dom.js';
import * as domStylesheetsJs from '../../base/browser/domStylesheets.js';
import { GlobalPointerMoveMonitor } from '../../base/browser/globalPointerMoveMonitor.js';
import { StandardMouseEvent } from '../../base/browser/mouseEvent.js';
import { RunOnceScheduler } from '../../base/common/async.js';
import { Disposable, DisposableMap, DisposableStore } from '../../base/common/lifecycle.js';
import { asCssVariable } from '../../platform/theme/common/colorRegistry.js';
/**
 * Coordinates relative to the whole document (e.g. mouse event's pageX and pageY)
 */
export class PageCoordinates {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this._pageCoordinatesBrand = undefined;
    }
    toClientCoordinates(targetWindow) {
        return new ClientCoordinates(this.x - targetWindow.scrollX, this.y - targetWindow.scrollY);
    }
}
/**
 * Coordinates within the application's client area (i.e. origin is document's scroll position).
 *
 * For example, clicking in the top-left corner of the client area will
 * always result in a mouse event with a client.x value of 0, regardless
 * of whether the page is scrolled horizontally.
 */
export class ClientCoordinates {
    constructor(clientX, clientY) {
        this.clientX = clientX;
        this.clientY = clientY;
        this._clientCoordinatesBrand = undefined;
    }
    toPageCoordinates(targetWindow) {
        return new PageCoordinates(this.clientX + targetWindow.scrollX, this.clientY + targetWindow.scrollY);
    }
}
/**
 * The position of the editor in the page.
 */
export class EditorPagePosition {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this._editorPagePositionBrand = undefined;
    }
}
/**
 * Coordinates relative to the (top;left) of the editor that can be used safely with other internal editor metrics.
 * **NOTE**: This position is obtained by taking page coordinates and transforming them relative to the
 * editor's (top;left) position in a way in which scale transformations are taken into account.
 * **NOTE**: These coordinates could be negative if the mouse position is outside the editor.
 */
export class CoordinatesRelativeToEditor {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this._positionRelativeToEditorBrand = undefined;
    }
}
export function createEditorPagePosition(editorViewDomNode) {
    const editorPos = dom.getDomNodePagePosition(editorViewDomNode);
    return new EditorPagePosition(editorPos.left, editorPos.top, editorPos.width, editorPos.height);
}
export function createCoordinatesRelativeToEditor(editorViewDomNode, editorPagePosition, pos) {
    // The editor's page position is read from the DOM using getBoundingClientRect().
    //
    // getBoundingClientRect() returns the actual dimensions, while offsetWidth and offsetHeight
    // reflect the unscaled size. We can use this difference to detect a transform:scale()
    // and we will apply the transformation in inverse to get mouse coordinates that make sense inside the editor.
    //
    // This could be expanded to cover rotation as well maybe by walking the DOM up from `editorViewDomNode`
    // and computing the effective transformation matrix using getComputedStyle(element).transform.
    //
    const scaleX = editorPagePosition.width / editorViewDomNode.offsetWidth;
    const scaleY = editorPagePosition.height / editorViewDomNode.offsetHeight;
    // Adjust mouse offsets if editor appears to be scaled via transforms
    const relativeX = (pos.x - editorPagePosition.x) / scaleX;
    const relativeY = (pos.y - editorPagePosition.y) / scaleY;
    return new CoordinatesRelativeToEditor(relativeX, relativeY);
}
export class EditorMouseEvent extends StandardMouseEvent {
    constructor(e, isFromPointerCapture, editorViewDomNode) {
        super(dom.getWindow(editorViewDomNode), e);
        this._editorMouseEventBrand = undefined;
        this.isFromPointerCapture = isFromPointerCapture;
        this.pos = new PageCoordinates(this.posx, this.posy);
        this.editorPos = createEditorPagePosition(editorViewDomNode);
        this.relativePos = createCoordinatesRelativeToEditor(editorViewDomNode, this.editorPos, this.pos);
    }
}
export class EditorMouseEventFactory {
    constructor(editorViewDomNode) {
        this._editorViewDomNode = editorViewDomNode;
    }
    _create(e) {
        return new EditorMouseEvent(e, false, this._editorViewDomNode);
    }
    onContextMenu(target, callback) {
        return dom.addDisposableListener(target, dom.EventType.CONTEXT_MENU, (e) => {
            callback(this._create(e));
        });
    }
    onMouseUp(target, callback) {
        return dom.addDisposableListener(target, dom.EventType.MOUSE_UP, (e) => {
            callback(this._create(e));
        });
    }
    onMouseDown(target, callback) {
        return dom.addDisposableListener(target, dom.EventType.MOUSE_DOWN, (e) => {
            callback(this._create(e));
        });
    }
    onPointerDown(target, callback) {
        return dom.addDisposableListener(target, dom.EventType.POINTER_DOWN, (e) => {
            callback(this._create(e), e.pointerId);
        });
    }
    onMouseLeave(target, callback) {
        return dom.addDisposableListener(target, dom.EventType.MOUSE_LEAVE, (e) => {
            callback(this._create(e));
        });
    }
    onMouseMove(target, callback) {
        return dom.addDisposableListener(target, dom.EventType.MOUSE_MOVE, (e) => callback(this._create(e)));
    }
}
export class EditorPointerEventFactory {
    constructor(editorViewDomNode) {
        this._editorViewDomNode = editorViewDomNode;
    }
    _create(e) {
        return new EditorMouseEvent(e, false, this._editorViewDomNode);
    }
    onPointerUp(target, callback) {
        return dom.addDisposableListener(target, 'pointerup', (e) => {
            callback(this._create(e));
        });
    }
    onPointerDown(target, callback) {
        return dom.addDisposableListener(target, dom.EventType.POINTER_DOWN, (e) => {
            callback(this._create(e), e.pointerId);
        });
    }
    onPointerLeave(target, callback) {
        return dom.addDisposableListener(target, dom.EventType.POINTER_LEAVE, (e) => {
            callback(this._create(e));
        });
    }
    onPointerMove(target, callback) {
        return dom.addDisposableListener(target, 'pointermove', (e) => callback(this._create(e)));
    }
}
export class GlobalEditorPointerMoveMonitor extends Disposable {
    constructor(editorViewDomNode) {
        super();
        this._editorViewDomNode = editorViewDomNode;
        this._globalPointerMoveMonitor = this._register(new GlobalPointerMoveMonitor());
        this._keydownListener = null;
    }
    startMonitoring(initialElement, pointerId, initialButtons, pointerMoveCallback, onStopCallback) {
        // Add a <<capture>> keydown event listener that will cancel the monitoring
        // if something other than a modifier key is pressed
        this._keydownListener = dom.addStandardDisposableListener(initialElement.ownerDocument, 'keydown', (e) => {
            const chord = e.toKeyCodeChord();
            if (chord.isModifierKey()) {
                // Allow modifier keys
                return;
            }
            this._globalPointerMoveMonitor.stopMonitoring(true, e.browserEvent);
        }, true);
        this._globalPointerMoveMonitor.startMonitoring(initialElement, pointerId, initialButtons, (e) => {
            pointerMoveCallback(new EditorMouseEvent(e, true, this._editorViewDomNode));
        }, (e) => {
            this._keydownListener.dispose();
            onStopCallback(e);
        });
    }
    stopMonitoring() {
        this._globalPointerMoveMonitor.stopMonitoring(true);
    }
}
/**
 * A helper to create dynamic css rules, bound to a class name.
 * Rules are reused.
 * Reference counting and delayed garbage collection ensure that no rules leak.
*/
export class DynamicCssRules {
    static { this._idPool = 0; }
    constructor(_editor) {
        this._editor = _editor;
        this._instanceId = ++DynamicCssRules._idPool;
        this._counter = 0;
        this._rules = new DisposableMap();
        // We delay garbage collection so that hanging rules can be reused.
        this._garbageCollectionScheduler = new RunOnceScheduler(() => this.garbageCollect(), 1000);
    }
    dispose() {
        this._rules.dispose();
        this._garbageCollectionScheduler.dispose();
    }
    createClassNameRef(options) {
        const rule = this.getOrCreateRule(options);
        rule.increaseRefCount();
        return {
            className: rule.className,
            dispose: () => {
                rule.decreaseRefCount();
                this._garbageCollectionScheduler.schedule();
            }
        };
    }
    getOrCreateRule(properties) {
        const key = this.computeUniqueKey(properties);
        let existingRule = this._rules.get(key);
        if (!existingRule) {
            const counter = this._counter++;
            existingRule = new RefCountedCssRule(key, `dyn-rule-${this._instanceId}-${counter}`, dom.isInShadowDOM(this._editor.getContainerDomNode())
                ? this._editor.getContainerDomNode()
                : undefined, properties);
            this._rules.set(key, existingRule);
        }
        return existingRule;
    }
    computeUniqueKey(properties) {
        return JSON.stringify(properties);
    }
    garbageCollect() {
        for (const rule of this._rules.values()) {
            if (!rule.hasReferences()) {
                this._rules.deleteAndDispose(rule.key);
            }
        }
    }
}
class RefCountedCssRule {
    constructor(key, className, _containerElement, properties) {
        this.key = key;
        this.className = className;
        this.properties = properties;
        this._referenceCount = 0;
        this._styleElementDisposables = new DisposableStore();
        this._styleElement = domStylesheetsJs.createStyleSheet(_containerElement, undefined, this._styleElementDisposables);
        this._styleElement.textContent = this.getCssText(this.className, this.properties);
    }
    getCssText(className, properties) {
        let str = `.${className} {`;
        for (const prop in properties) {
            const value = properties[prop];
            let cssValue;
            if (typeof value === 'object') {
                cssValue = asCssVariable(value.id);
            }
            else {
                cssValue = value;
            }
            const cssPropName = camelToDashes(prop);
            str += `\n\t${cssPropName}: ${cssValue};`;
        }
        str += `\n}`;
        return str;
    }
    dispose() {
        this._styleElementDisposables.dispose();
        this._styleElement = undefined;
    }
    increaseRefCount() {
        this._referenceCount++;
    }
    decreaseRefCount() {
        this._referenceCount--;
    }
    hasReferences() {
        return this._referenceCount > 0;
    }
}
function camelToDashes(str) {
    return str.replace(/(^[A-Z])/, ([first]) => first.toLowerCase())
        .replace(/([A-Z])/g, ([letter]) => `-${letter.toLowerCase()}`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yRG9tLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9icm93c2VyL2VkaXRvckRvbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLDJCQUEyQixDQUFDO0FBQ2pELE9BQU8sS0FBSyxnQkFBZ0IsTUFBTSxzQ0FBc0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN0RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQWUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUV6RyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFHN0U7O0dBRUc7QUFDSCxNQUFNLE9BQU8sZUFBZTtJQUczQixZQUNpQixDQUFTLEVBQ1QsQ0FBUztRQURULE1BQUMsR0FBRCxDQUFDLENBQVE7UUFDVCxNQUFDLEdBQUQsQ0FBQyxDQUFRO1FBSjFCLDBCQUFxQixHQUFTLFNBQVMsQ0FBQztJQUtwQyxDQUFDO0lBRUUsbUJBQW1CLENBQUMsWUFBb0I7UUFDOUMsT0FBTyxJQUFJLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM1RixDQUFDO0NBQ0Q7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLE9BQU8saUJBQWlCO0lBRzdCLFlBQ2lCLE9BQWUsRUFDZixPQUFlO1FBRGYsWUFBTyxHQUFQLE9BQU8sQ0FBUTtRQUNmLFlBQU8sR0FBUCxPQUFPLENBQVE7UUFK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