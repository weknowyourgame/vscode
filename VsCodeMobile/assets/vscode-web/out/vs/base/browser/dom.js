/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as browser from './browser.js';
import { BrowserFeatures } from './canIUse.js';
import { hasModifierKeys, StandardKeyboardEvent } from './keyboardEvent.js';
import { StandardMouseEvent } from './mouseEvent.js';
import { AbstractIdleValue, IntervalTimer, TimeoutTimer, _runWhenIdle } from '../common/async.js';
import { BugIndicatingError, onUnexpectedError } from '../common/errors.js';
import * as event from '../common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../common/lifecycle.js';
import { RemoteAuthorities } from '../common/network.js';
import * as platform from '../common/platform.js';
import { URI } from '../common/uri.js';
import { hash } from '../common/hash.js';
import { ensureCodeWindow, mainWindow } from './window.js';
import { isPointWithinTriangle } from '../common/numbers.js';
import { derived, derivedOpts, observableValue } from '../common/observable.js';
//# region Multi-Window Support Utilities
export const { registerWindow, getWindow, getDocument, getWindows, getWindowsCount, getWindowId, getWindowById, hasWindow, onDidRegisterWindow, onWillUnregisterWindow, onDidUnregisterWindow } = (function () {
    const windows = new Map();
    ensureCodeWindow(mainWindow, 1);
    const mainWindowRegistration = { window: mainWindow, disposables: new DisposableStore() };
    windows.set(mainWindow.vscodeWindowId, mainWindowRegistration);
    const onDidRegisterWindow = new event.Emitter();
    const onDidUnregisterWindow = new event.Emitter();
    const onWillUnregisterWindow = new event.Emitter();
    function getWindowById(windowId, fallbackToMain) {
        const window = typeof windowId === 'number' ? windows.get(windowId) : undefined;
        return window ?? (fallbackToMain ? mainWindowRegistration : undefined);
    }
    return {
        onDidRegisterWindow: onDidRegisterWindow.event,
        onWillUnregisterWindow: onWillUnregisterWindow.event,
        onDidUnregisterWindow: onDidUnregisterWindow.event,
        registerWindow(window) {
            if (windows.has(window.vscodeWindowId)) {
                return Disposable.None;
            }
            const disposables = new DisposableStore();
            const registeredWindow = {
                window,
                disposables: disposables.add(new DisposableStore())
            };
            windows.set(window.vscodeWindowId, registeredWindow);
            disposables.add(toDisposable(() => {
                windows.delete(window.vscodeWindowId);
                onDidUnregisterWindow.fire(window);
            }));
            disposables.add(addDisposableListener(window, EventType.BEFORE_UNLOAD, () => {
                onWillUnregisterWindow.fire(window);
            }));
            onDidRegisterWindow.fire(registeredWindow);
            return disposables;
        },
        getWindows() {
            return windows.values();
        },
        getWindowsCount() {
            return windows.size;
        },
        getWindowId(targetWindow) {
            return targetWindow.vscodeWindowId;
        },
        hasWindow(windowId) {
            return windows.has(windowId);
        },
        getWindowById,
        getWindow(e) {
            const candidateNode = e;
            if (candidateNode?.ownerDocument?.defaultView) {
                return candidateNode.ownerDocument.defaultView.window;
            }
            const candidateEvent = e;
            if (candidateEvent?.view) {
                return candidateEvent.view.window;
            }
            return mainWindow;
        },
        getDocument(e) {
            const candidateNode = e;
            return getWindow(candidateNode).document;
        }
    };
})();
//#endregion
export function clearNode(node) {
    while (node.firstChild) {
        node.firstChild.remove();
    }
}
class DomListener {
    constructor(node, type, handler, options) {
        this._node = node;
        this._type = type;
        this._handler = handler;
        this._options = (options || false);
        this._node.addEventListener(this._type, this._handler, this._options);
    }
    dispose() {
        if (!this._handler) {
            // Already disposed
            return;
        }
        this._node.removeEventListener(this._type, this._handler, this._options);
        // Prevent leakers from holding on to the dom or handler func
        this._node = null;
        this._handler = null;
    }
}
export function addDisposableListener(node, type, handler, useCaptureOrOptions) {
    return new DomListener(node, type, handler, useCaptureOrOptions);
}
function _wrapAsStandardMouseEvent(targetWindow, handler) {
    return function (e) {
        return handler(new StandardMouseEvent(targetWindow, e));
    };
}
function _wrapAsStandardKeyboardEvent(handler) {
    return function (e) {
        return handler(new StandardKeyboardEvent(e));
    };
}
export const addStandardDisposableListener = function addStandardDisposableListener(node, type, handler, useCapture) {
    let wrapHandler = handler;
    if (type === 'click' || type === 'mousedown' || type === 'contextmenu') {
        wrapHandler = _wrapAsStandardMouseEvent(getWindow(node), handler);
    }
    else if (type === 'keydown' || type === 'keypress' || type === 'keyup') {
        wrapHandler = _wrapAsStandardKeyboardEvent(handler);
    }
    return addDisposableListener(node, type, wrapHandler, useCapture);
};
export const addStandardDisposableGenericMouseDownListener = function addStandardDisposableListener(node, handler, useCapture) {
    const wrapHandler = _wrapAsStandardMouseEvent(getWindow(node), handler);
    return addDisposableGenericMouseDownListener(node, wrapHandler, useCapture);
};
export const addStandardDisposableGenericMouseUpListener = function addStandardDisposableListener(node, handler, useCapture) {
    const wrapHandler = _wrapAsStandardMouseEvent(getWindow(node), handler);
    return addDisposableGenericMouseUpListener(node, wrapHandler, useCapture);
};
export function addDisposableGenericMouseDownListener(node, handler, useCapture) {
    return addDisposableListener(node, platform.isIOS && BrowserFeatures.pointerEvents ? EventType.POINTER_DOWN : EventType.MOUSE_DOWN, handler, useCapture);
}
export function addDisposableGenericMouseMoveListener(node, handler, useCapture) {
    return addDisposableListener(node, platform.isIOS && BrowserFeatures.pointerEvents ? EventType.POINTER_MOVE : EventType.MOUSE_MOVE, handler, useCapture);
}
export function addDisposableGenericMouseUpListener(node, handler, useCapture) {
    return addDisposableListener(node, platform.isIOS && BrowserFeatures.pointerEvents ? EventType.POINTER_UP : EventType.MOUSE_UP, handler, useCapture);
}
/**
 * Execute the callback the next time the browser is idle, returning an
 * {@link IDisposable} that will cancel the callback when disposed. This wraps
 * [requestIdleCallback] so it will fallback to [setTimeout] if the environment
 * doesn't support it.
 *
 * @param targetWindow The window for which to run the idle callback
 * @param callback The callback to run when idle, this includes an
 * [IdleDeadline] that provides the time alloted for the idle callback by the
 * browser. Not respecting this deadline will result in a degraded user
 * experience.
 * @param timeout A timeout at which point to queue no longer wait for an idle
 * callback but queue it on the regular event loop (like setTimeout). Typically
 * this should not be used.
 *
 * [IdleDeadline]: https://developer.mozilla.org/en-US/docs/Web/API/IdleDeadline
 * [requestIdleCallback]: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback
 * [setTimeout]: https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout
 */
export function runWhenWindowIdle(targetWindow, callback, timeout) {
    return _runWhenIdle(targetWindow, callback, timeout);
}
/**
 * An implementation of the "idle-until-urgent"-strategy as introduced
 * here: https://philipwalton.com/articles/idle-until-urgent/
 */
export class WindowIdleValue extends AbstractIdleValue {
    constructor(targetWindow, executor) {
        super(targetWindow, executor);
    }
}
/**
 * Schedule a callback to be run at the next animation frame.
 * This allows multiple parties to register callbacks that should run at the next animation frame.
 * If currently in an animation frame, `runner` will be executed immediately.
 * @return token that can be used to cancel the scheduled runner (only if `runner` was not executed immediately).
 */
export let runAtThisOrScheduleAtNextAnimationFrame;
/**
 * Schedule a callback to be run at the next animation frame.
 * This allows multiple parties to register callbacks that should run at the next animation frame.
 * If currently in an animation frame, `runner` will be executed at the next animation frame.
 * @return token that can be used to cancel the scheduled runner.
 */
export let scheduleAtNextAnimationFrame;
export function disposableWindowInterval(targetWindow, handler, interval, iterations) {
    let iteration = 0;
    const timer = targetWindow.setInterval(() => {
        iteration++;
        if ((typeof iterations === 'number' && iteration >= iterations) || handler() === true) {
            disposable.dispose();
        }
    }, interval);
    const disposable = toDisposable(() => {
        targetWindow.clearInterval(timer);
    });
    return disposable;
}
export class WindowIntervalTimer extends IntervalTimer {
    /**
     *
     * @param node The optional node from which the target window is determined
     */
    constructor(node) {
        super();
        this.defaultTarget = node && getWindow(node);
    }
    cancelAndSet(runner, interval, targetWindow) {
        return super.cancelAndSet(runner, interval, targetWindow ?? this.defaultTarget);
    }
}
class AnimationFrameQueueItem {
    constructor(runner, priority = 0) {
        this._runner = runner;
        this.priority = priority;
        this._canceled = false;
    }
    dispose() {
        this._canceled = true;
    }
    execute() {
        if (this._canceled) {
            return;
        }
        try {
            this._runner();
        }
        catch (e) {
            onUnexpectedError(e);
        }
    }
    // Sort by priority (largest to lowest)
    static sort(a, b) {
        return b.priority - a.priority;
    }
}
(function () {
    /**
     * The runners scheduled at the next animation frame
     */
    const NEXT_QUEUE = new Map();
    /**
     * The runners scheduled at the current animation frame
     */
    const CURRENT_QUEUE = new Map();
    /**
     * A flag to keep track if the native requestAnimationFrame was already called
     */
    const animFrameRequested = new Map();
    /**
     * A flag to indicate if currently handling a native requestAnimationFrame callback
     */
    const inAnimationFrameRunner = new Map();
    const animationFrameRunner = (targetWindowId) => {
        animFrameRequested.set(targetWindowId, false);
        const currentQueue = NEXT_QUEUE.get(targetWindowId) ?? [];
        CURRENT_QUEUE.set(targetWindowId, currentQueue);
        NEXT_QUEUE.set(targetWindowId, []);
        inAnimationFrameRunner.set(targetWindowId, true);
        while (currentQueue.length > 0) {
            currentQueue.sort(AnimationFrameQueueItem.sort);
            const top = currentQueue.shift();
            top.execute();
        }
        inAnimationFrameRunner.set(targetWindowId, false);
    };
    scheduleAtNextAnimationFrame = (targetWindow, runner, priority = 0) => {
        const targetWindowId = getWindowId(targetWindow);
        const item = new AnimationFrameQueueItem(runner, priority);
        let nextQueue = NEXT_QUEUE.get(targetWindowId);
        if (!nextQueue) {
            nextQueue = [];
            NEXT_QUEUE.set(targetWindowId, nextQueue);
        }
        nextQueue.push(item);
        if (!animFrameRequested.get(targetWindowId)) {
            animFrameRequested.set(targetWindowId, true);
            targetWindow.requestAnimationFrame(() => animationFrameRunner(targetWindowId));
        }
        return item;
    };
    runAtThisOrScheduleAtNextAnimationFrame = (targetWindow, runner, priority) => {
        const targetWindowId = getWindowId(targetWindow);
        if (inAnimationFrameRunner.get(targetWindowId)) {
            const item = new AnimationFrameQueueItem(runner, priority);
            let currentQueue = CURRENT_QUEUE.get(targetWindowId);
            if (!currentQueue) {
                currentQueue = [];
                CURRENT_QUEUE.set(targetWindowId, currentQueue);
            }
            currentQueue.push(item);
            return item;
        }
        else {
            return scheduleAtNextAnimationFrame(targetWindow, runner, priority);
        }
    };
})();
export function measure(targetWindow, callback) {
    return scheduleAtNextAnimationFrame(targetWindow, callback, 10000 /* must be early */);
}
export function modify(targetWindow, callback) {
    return scheduleAtNextAnimationFrame(targetWindow, callback, -10000 /* must be late */);
}
const MINIMUM_TIME_MS = 8;
function DEFAULT_EVENT_MERGER(_lastEvent, currentEvent) {
    return currentEvent;
}
class TimeoutThrottledDomListener extends Disposable {
    constructor(node, type, handler, eventMerger = DEFAULT_EVENT_MERGER, minimumTimeMs = MINIMUM_TIME_MS) {
        super();
        let lastEvent = null;
        let lastHandlerTime = 0;
        const timeout = this._register(new TimeoutTimer());
        const invokeHandler = () => {
            lastHandlerTime = (new Date()).getTime();
            handler(lastEvent);
            lastEvent = null;
        };
        this._register(addDisposableListener(node, type, (e) => {
            lastEvent = eventMerger(lastEvent, e);
            const elapsedTime = (new Date()).getTime() - lastHandlerTime;
            if (elapsedTime >= minimumTimeMs) {
                timeout.cancel();
                invokeHandler();
            }
            else {
                timeout.setIfNotSet(invokeHandler, minimumTimeMs - elapsedTime);
            }
        }));
    }
}
export function addDisposableThrottledListener(node, type, handler, eventMerger, minimumTimeMs) {
    return new TimeoutThrottledDomListener(node, type, handler, eventMerger, minimumTimeMs);
}
export function getComputedStyle(el) {
    return getWindow(el).getComputedStyle(el, null);
}
export function getClientArea(element, defaultValue, fallbackElement) {
    const elWindow = getWindow(element);
    const elDocument = elWindow.document;
    // Try with DOM clientWidth / clientHeight
    if (element !== elDocument.body) {
        return new Dimension(element.clientWidth, element.clientHeight);
    }
    // If visual view port exits and it's on mobile, it should be used instead of window innerWidth / innerHeight, or document.body.clientWidth / document.body.clientHeight
    if (platform.isIOS && elWindow?.visualViewport) {
        return new Dimension(elWindow.visualViewport.width, elWindow.visualViewport.height);
    }
    // Try innerWidth / innerHeight
    if (elWindow?.innerWidth && elWindow.innerHeight) {
        return new Dimension(elWindow.innerWidth, elWindow.innerHeight);
    }
    // Try with document.body.clientWidth / document.body.clientHeight
    if (elDocument.body && elDocument.body.clientWidth && elDocument.body.clientHeight) {
        return new Dimension(elDocument.body.clientWidth, elDocument.body.clientHeight);
    }
    // Try with document.documentElement.clientWidth / document.documentElement.clientHeight
    if (elDocument.documentElement && elDocument.documentElement.clientWidth && elDocument.documentElement.clientHeight) {
        return new Dimension(elDocument.documentElement.clientWidth, elDocument.documentElement.clientHeight);
    }
    if (fallbackElement) {
        return getClientArea(fallbackElement, defaultValue);
    }
    if (defaultValue) {
        return defaultValue;
    }
    throw new Error('Unable to figure out browser width and height');
}
class SizeUtils {
    // Adapted from WinJS
    // Converts a CSS positioning string for the specified element to pixels.
    static convertToPixels(element, value) {
        return parseFloat(value) || 0;
    }
    static getDimension(element, cssPropertyName) {
        const computedStyle = getComputedStyle(element);
        const value = computedStyle ? computedStyle.getPropertyValue(cssPropertyName) : '0';
        return SizeUtils.convertToPixels(element, value);
    }
    static getBorderLeftWidth(element) {
        return SizeUtils.getDimension(element, 'border-left-width');
    }
    static getBorderRightWidth(element) {
        return SizeUtils.getDimension(element, 'border-right-width');
    }
    static getBorderTopWidth(element) {
        return SizeUtils.getDimension(element, 'border-top-width');
    }
    static getBorderBottomWidth(element) {
        return SizeUtils.getDimension(element, 'border-bottom-width');
    }
    static getPaddingLeft(element) {
        return SizeUtils.getDimension(element, 'padding-left');
    }
    static getPaddingRight(element) {
        return SizeUtils.getDimension(element, 'padding-right');
    }
    static getPaddingTop(element) {
        return SizeUtils.getDimension(element, 'padding-top');
    }
    static getPaddingBottom(element) {
        return SizeUtils.getDimension(element, 'padding-bottom');
    }
    static getMarginLeft(element) {
        return SizeUtils.getDimension(element, 'margin-left');
    }
    static getMarginTop(element) {
        return SizeUtils.getDimension(element, 'margin-top');
    }
    static getMarginRight(element) {
        return SizeUtils.getDimension(element, 'margin-right');
    }
    static getMarginBottom(element) {
        return SizeUtils.getDimension(element, 'margin-bottom');
    }
}
export class Dimension {
    static { this.None = new Dimension(0, 0); }
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
    with(width = this.width, height = this.height) {
        if (width !== this.width || height !== this.height) {
            return new Dimension(width, height);
        }
        else {
            return this;
        }
    }
    static is(obj) {
        return typeof obj === 'object' && typeof obj.height === 'number' && typeof obj.width === 'number';
    }
    static lift(obj) {
        if (obj instanceof Dimension) {
            return obj;
        }
        else {
            return new Dimension(obj.width, obj.height);
        }
    }
    static equals(a, b) {
        if (a === b) {
            return true;
        }
        if (!a || !b) {
            return false;
        }
        return a.width === b.width && a.height === b.height;
    }
}
export function getTopLeftOffset(element) {
    // Adapted from WinJS.Utilities.getPosition
    // and added borders to the mix
    let offsetParent = element.offsetParent;
    let top = element.offsetTop;
    let left = element.offsetLeft;
    while ((element = element.parentNode) !== null
        && element !== element.ownerDocument.body
        && element !== element.ownerDocument.documentElement) {
        top -= element.scrollTop;
        const c = isShadowRoot(element) ? null : getComputedStyle(element);
        if (c) {
            left -= c.direction !== 'rtl' ? element.scrollLeft : -element.scrollLeft;
        }
        if (element === offsetParent) {
            left += SizeUtils.getBorderLeftWidth(element);
            top += SizeUtils.getBorderTopWidth(element);
            top += element.offsetTop;
            left += element.offsetLeft;
            offsetParent = element.offsetParent;
        }
    }
    return {
        left: left,
        top: top
    };
}
export function size(element, width, height) {
    if (typeof width === 'number') {
        element.style.width = `${width}px`;
    }
    if (typeof height === 'number') {
        element.style.height = `${height}px`;
    }
}
export function position(element, top, right, bottom, left, position = 'absolute') {
    if (typeof top === 'number') {
        element.style.top = `${top}px`;
    }
    if (typeof right === 'number') {
        element.style.right = `${right}px`;
    }
    if (typeof bottom === 'number') {
        element.style.bottom = `${bottom}px`;
    }
    if (typeof left === 'number') {
        element.style.left = `${left}px`;
    }
    element.style.position = position;
}
/**
 * Returns the position of a dom node relative to the entire page.
 */
export function getDomNodePagePosition(domNode) {
    const bb = domNode.getBoundingClientRect();
    const window = getWindow(domNode);
    return {
        left: bb.left + window.scrollX,
        top: bb.top + window.scrollY,
        width: bb.width,
        height: bb.height
    };
}
/**
 * Returns whether the element is in the bottom right quarter of the container.
 *
 * @param element the element to check for being in the bottom right quarter
 * @param container the container to check against
 * @returns true if the element is in the bottom right quarter of the container
 */
export function isElementInBottomRightQuarter(element, container) {
    const position = getDomNodePagePosition(element);
    const clientArea = getClientArea(container);
    return position.left > clientArea.width / 2 && position.top > clientArea.height / 2;
}
/**
 * Returns the effective zoom on a given element before window zoom level is applied
 */
export function getDomNodeZoomLevel(domNode) {
    let testElement = domNode;
    let zoom = 1.0;
    do {
        // eslint-disable-next-line local/code-no-any-casts
        const elementZoomLevel = getComputedStyle(testElement).zoom;
        if (elementZoomLevel !== null && elementZoomLevel !== undefined && elementZoomLevel !== '1') {
            zoom *= elementZoomLevel;
        }
        testElement = testElement.parentElement;
    } while (testElement !== null && testElement !== testElement.ownerDocument.documentElement);
    return zoom;
}
// Adapted from WinJS
// Gets the width of the element, including margins.
export function getTotalWidth(element) {
    const margin = SizeUtils.getMarginLeft(element) + SizeUtils.getMarginRight(element);
    return element.offsetWidth + margin;
}
export function getContentWidth(element) {
    const border = SizeUtils.getBorderLeftWidth(element) + SizeUtils.getBorderRightWidth(element);
    const padding = SizeUtils.getPaddingLeft(element) + SizeUtils.getPaddingRight(element);
    return element.offsetWidth - border - padding;
}
export function getTotalScrollWidth(element) {
    const margin = SizeUtils.getMarginLeft(element) + SizeUtils.getMarginRight(element);
    return element.scrollWidth + margin;
}
// Adapted from WinJS
// Gets the height of the content of the specified element. The content height does not include borders or padding.
export function getContentHeight(element) {
    const border = SizeUtils.getBorderTopWidth(element) + SizeUtils.getBorderBottomWidth(element);
    const padding = SizeUtils.getPaddingTop(element) + SizeUtils.getPaddingBottom(element);
    return element.offsetHeight - border - padding;
}
// Adapted from WinJS
// Gets the height of the element, including its margins.
export function getTotalHeight(element) {
    const margin = SizeUtils.getMarginTop(element) + SizeUtils.getMarginBottom(element);
    return element.offsetHeight + margin;
}
// Gets the left coordinate of the specified element relative to the specified parent.
function getRelativeLeft(element, parent) {
    if (element === null) {
        return 0;
    }
    const elementPosition = getTopLeftOffset(element);
    const parentPosition = getTopLeftOffset(parent);
    return elementPosition.left - parentPosition.left;
}
export function getLargestChildWidth(parent, children) {
    const childWidths = children.map((child) => {
        return Math.max(getTotalScrollWidth(child), getTotalWidth(child)) + getRelativeLeft(child, parent) || 0;
    });
    const maxWidth = Math.max(...childWidths);
    return maxWidth;
}
// ----------------------------------------------------------------------------------------
export function isAncestor(testChild, testAncestor) {
    return Boolean(testAncestor?.contains(testChild));
}
const parentFlowToDataKey = 'parentFlowToElementId';
/**
 * Set an explicit parent to use for nodes that are not part of the
 * regular dom structure.
 */
export function setParentFlowTo(fromChildElement, toParentElement) {
    fromChildElement.dataset[parentFlowToDataKey] = toParentElement.id;
}
function getParentFlowToElement(node) {
    const flowToParentId = node.dataset[parentFlowToDataKey];
    if (typeof flowToParentId === 'string') {
        // eslint-disable-next-line no-restricted-syntax
        return node.ownerDocument.getElementById(flowToParentId);
    }
    return null;
}
/**
 * Check if `testAncestor` is an ancestor of `testChild`, observing the explicit
 * parents set by `setParentFlowTo`.
 */
export function isAncestorUsingFlowTo(testChild, testAncestor) {
    let node = testChild;
    while (node) {
        if (node === testAncestor) {
            return true;
        }
        if (isHTMLElement(node)) {
            const flowToParentElement = getParentFlowToElement(node);
            if (flowToParentElement) {
                node = flowToParentElement;
                continue;
            }
        }
        node = node.parentNode;
    }
    return false;
}
export function findParentWithClass(node, clazz, stopAtClazzOrNode) {
    while (node && node.nodeType === node.ELEMENT_NODE) {
        if (node.classList.contains(clazz)) {
            return node;
        }
        if (stopAtClazzOrNode) {
            if (typeof stopAtClazzOrNode === 'string') {
                if (node.classList.contains(stopAtClazzOrNode)) {
                    return null;
                }
            }
            else {
                if (node === stopAtClazzOrNode) {
                    return null;
                }
            }
        }
        node = node.parentNode;
    }
    return null;
}
export function hasParentWithClass(node, clazz, stopAtClazzOrNode) {
    return !!findParentWithClass(node, clazz, stopAtClazzOrNode);
}
export function isShadowRoot(node) {
    return (node && !!node.host && !!node.mode);
}
export function isInShadowDOM(domNode) {
    return !!getShadowRoot(domNode);
}
export function getShadowRoot(domNode) {
    while (domNode.parentNode) {
        if (domNode === domNode.ownerDocument?.body) {
            // reached the body
            return null;
        }
        domNode = domNode.parentNode;
    }
    return isShadowRoot(domNode) ? domNode : null;
}
/**
 * Returns the active element across all child windows
 * based on document focus. Falls back to the main
 * window if no window has focus.
 */
export function getActiveElement() {
    let result = getActiveDocument().activeElement;
    while (result?.shadowRoot) {
        result = result.shadowRoot.activeElement;
    }
    return result;
}
/**
 * Returns true if the focused window active element matches
 * the provided element. Falls back to the main window if no
 * window has focus.
 */
export function isActiveElement(element) {
    return getActiveElement() === element;
}
/**
 * Returns true if the focused window active element is contained in
 * `ancestor`. Falls back to the main window if no window has focus.
 */
export function isAncestorOfActiveElement(ancestor) {
    return isAncestor(getActiveElement(), ancestor);
}
/**
 * Returns whether the element is in the active `document`. The active
 * document has focus or will be the main windows document.
 */
export function isActiveDocument(element) {
    return element.ownerDocument === getActiveDocument();
}
/**
 * Returns the active document across main and child windows.
 * Prefers the window with focus, otherwise falls back to
 * the main windows document.
 */
export function getActiveDocument() {
    if (getWindowsCount() <= 1) {
        return mainWindow.document;
    }
    const documents = Array.from(getWindows()).map(({ window }) => window.document);
    return documents.find(doc => doc.hasFocus()) ?? mainWindow.document;
}
/**
 * Returns the active window across main and child windows.
 * Prefers the window with focus, otherwise falls back to
 * the main window.
 */
export function getActiveWindow() {
    const document = getActiveDocument();
    return (document.defaultView?.window ?? mainWindow);
}
export const sharedMutationObserver = new class {
    constructor() {
        this.mutationObservers = new Map();
    }
    observe(target, disposables, options) {
        let mutationObserversPerTarget = this.mutationObservers.get(target);
        if (!mutationObserversPerTarget) {
            mutationObserversPerTarget = new Map();
            this.mutationObservers.set(target, mutationObserversPerTarget);
        }
        const optionsHash = hash(options);
        let mutationObserverPerOptions = mutationObserversPerTarget.get(optionsHash);
        if (!mutationObserverPerOptions) {
            const onDidMutate = new event.Emitter();
            const observer = new MutationObserver(mutations => onDidMutate.fire(mutations));
            observer.observe(target, options);
            const resolvedMutationObserverPerOptions = mutationObserverPerOptions = {
                users: 1,
                observer,
                onDidMutate: onDidMutate.event
            };
            disposables.add(toDisposable(() => {
                resolvedMutationObserverPerOptions.users -= 1;
                if (resolvedMutationObserverPerOptions.users === 0) {
                    onDidMutate.dispose();
                    observer.disconnect();
                    mutationObserversPerTarget?.delete(optionsHash);
                    if (mutationObserversPerTarget?.size === 0) {
                        this.mutationObservers.delete(target);
                    }
                }
            }));
            mutationObserversPerTarget.set(optionsHash, mutationObserverPerOptions);
        }
        else {
            mutationObserverPerOptions.users += 1;
        }
        return mutationObserverPerOptions.onDidMutate;
    }
};
export function createMetaElement(container = mainWindow.document.head) {
    return createHeadElement('meta', container);
}
export function createLinkElement(container = mainWindow.document.head) {
    return createHeadElement('link', container);
}
function createHeadElement(tagName, container = mainWindow.document.head) {
    const element = document.createElement(tagName);
    container.appendChild(element);
    return element;
}
export function isHTMLElement(e) {
    // eslint-disable-next-line no-restricted-syntax
    return e instanceof HTMLElement || e instanceof getWindow(e).HTMLElement;
}
export function isHTMLAnchorElement(e) {
    // eslint-disable-next-line no-restricted-syntax
    return e instanceof HTMLAnchorElement || e instanceof getWindow(e).HTMLAnchorElement;
}
export function isHTMLSpanElement(e) {
    // eslint-disable-next-line no-restricted-syntax
    return e instanceof HTMLSpanElement || e instanceof getWindow(e).HTMLSpanElement;
}
export function isHTMLTextAreaElement(e) {
    // eslint-disable-next-line no-restricted-syntax
    return e instanceof HTMLTextAreaElement || e instanceof getWindow(e).HTMLTextAreaElement;
}
export function isHTMLInputElement(e) {
    // eslint-disable-next-line no-restricted-syntax
    return e instanceof HTMLInputElement || e instanceof getWindow(e).HTMLInputElement;
}
export function isHTMLButtonElement(e) {
    // eslint-disable-next-line no-restricted-syntax
    return e instanceof HTMLButtonElement || e instanceof getWindow(e).HTMLButtonElement;
}
export function isHTMLDivElement(e) {
    // eslint-disable-next-line no-restricted-syntax
    return e instanceof HTMLDivElement || e instanceof getWindow(e).HTMLDivElement;
}
export function isSVGElement(e) {
    // eslint-disable-next-line no-restricted-syntax
    return e instanceof SVGElement || e instanceof getWindow(e).SVGElement;
}
export function isMouseEvent(e) {
    // eslint-disable-next-line no-restricted-syntax
    return e instanceof MouseEvent || e instanceof getWindow(e).MouseEvent;
}
export function isKeyboardEvent(e) {
    // eslint-disable-next-line no-restricted-syntax
    return e instanceof KeyboardEvent || e instanceof getWindow(e).KeyboardEvent;
}
export function isPointerEvent(e) {
    // eslint-disable-next-line no-restricted-syntax
    return e instanceof PointerEvent || e instanceof getWindow(e).PointerEvent;
}
export function isDragEvent(e) {
    // eslint-disable-next-line no-restricted-syntax
    return e instanceof DragEvent || e instanceof getWindow(e).DragEvent;
}
export const EventType = {
    // Mouse
    CLICK: 'click',
    AUXCLICK: 'auxclick',
    DBLCLICK: 'dblclick',
    MOUSE_UP: 'mouseup',
    MOUSE_DOWN: 'mousedown',
    MOUSE_OVER: 'mouseover',
    MOUSE_MOVE: 'mousemove',
    MOUSE_OUT: 'mouseout',
    MOUSE_ENTER: 'mouseenter',
    MOUSE_LEAVE: 'mouseleave',
    MOUSE_WHEEL: 'wheel',
    POINTER_UP: 'pointerup',
    POINTER_DOWN: 'pointerdown',
    POINTER_MOVE: 'pointermove',
    POINTER_LEAVE: 'pointerleave',
    CONTEXT_MENU: 'contextmenu',
    WHEEL: 'wheel',
    // Keyboard
    KEY_DOWN: 'keydown',
    KEY_PRESS: 'keypress',
    KEY_UP: 'keyup',
    // HTML Document
    LOAD: 'load',
    BEFORE_UNLOAD: 'beforeunload',
    UNLOAD: 'unload',
    PAGE_SHOW: 'pageshow',
    PAGE_HIDE: 'pagehide',
    PASTE: 'paste',
    ABORT: 'abort',
    ERROR: 'error',
    RESIZE: 'resize',
    SCROLL: 'scroll',
    FULLSCREEN_CHANGE: 'fullscreenchange',
    WK_FULLSCREEN_CHANGE: 'webkitfullscreenchange',
    // Form
    SELECT: 'select',
    CHANGE: 'change',
    SUBMIT: 'submit',
    RESET: 'reset',
    FOCUS: 'focus',
    FOCUS_IN: 'focusin',
    FOCUS_OUT: 'focusout',
    BLUR: 'blur',
    INPUT: 'input',
    // Local Storage
    STORAGE: 'storage',
    // Drag
    DRAG_START: 'dragstart',
    DRAG: 'drag',
    DRAG_ENTER: 'dragenter',
    DRAG_LEAVE: 'dragleave',
    DRAG_OVER: 'dragover',
    DROP: 'drop',
    DRAG_END: 'dragend',
    // Animation
    ANIMATION_START: browser.isWebKit ? 'webkitAnimationStart' : 'animationstart',
    ANIMATION_END: browser.isWebKit ? 'webkitAnimationEnd' : 'animationend',
    ANIMATION_ITERATION: browser.isWebKit ? 'webkitAnimationIteration' : 'animationiteration'
};
export function isEventLike(obj) {
    const candidate = obj;
    return !!(candidate && typeof candidate.preventDefault === 'function' && typeof candidate.stopPropagation === 'function');
}
export const EventHelper = {
    stop: (e, cancelBubble) => {
        e.preventDefault();
        if (cancelBubble) {
            e.stopPropagation();
        }
        return e;
    }
};
export function saveParentsScrollTop(node) {
    const r = [];
    for (let i = 0; node && node.nodeType === node.ELEMENT_NODE; i++) {
        r[i] = node.scrollTop;
        node = node.parentNode;
    }
    return r;
}
export function restoreParentsScrollTop(node, state) {
    for (let i = 0; node && node.nodeType === node.ELEMENT_NODE; i++) {
        if (node.scrollTop !== state[i]) {
            node.scrollTop = state[i];
        }
        node = node.parentNode;
    }
}
class FocusTracker extends Disposable {
    get onDidFocus() { return this._onDidFocus.event; }
    get onDidBlur() { return this._onDidBlur.event; }
    static hasFocusWithin(element) {
        if (isHTMLElement(element)) {
            const shadowRoot = getShadowRoot(element);
            const activeElement = (shadowRoot ? shadowRoot.activeElement : element.ownerDocument.activeElement);
            return isAncestor(activeElement, element);
        }
        else {
            const window = element;
            return isAncestor(window.document.activeElement, window.document);
        }
    }
    constructor(element) {
        super();
        this._onDidFocus = this._register(new event.Emitter());
        this._onDidBlur = this._register(new event.Emitter());
        let hasFocus = FocusTracker.hasFocusWithin(element);
        let loosingFocus = false;
        const onFocus = () => {
            loosingFocus = false;
            if (!hasFocus) {
                hasFocus = true;
                this._onDidFocus.fire();
            }
        };
        const onBlur = () => {
            if (hasFocus) {
                loosingFocus = true;
                (isHTMLElement(element) ? getWindow(element) : element).setTimeout(() => {
                    if (loosingFocus) {
                        loosingFocus = false;
                        hasFocus = false;
                        this._onDidBlur.fire();
                    }
                }, 0);
            }
        };
        this._refreshStateHandler = () => {
            const currentNodeHasFocus = FocusTracker.hasFocusWithin(element);
            if (currentNodeHasFocus !== hasFocus) {
                if (hasFocus) {
                    onBlur();
                }
                else {
                    onFocus();
                }
            }
        };
        this._register(addDisposableListener(element, EventType.FOCUS, onFocus, true));
        this._register(addDisposableListener(element, EventType.BLUR, onBlur, true));
        if (isHTMLElement(element)) {
            this._register(addDisposableListener(element, EventType.FOCUS_IN, () => this._refreshStateHandler()));
            this._register(addDisposableListener(element, EventType.FOCUS_OUT, () => this._refreshStateHandler()));
        }
    }
    refreshState() {
        this._refreshStateHandler();
    }
}
/**
 * Creates a new `IFocusTracker` instance that tracks focus changes on the given `element` and its descendants.
 *
 * @param element The `HTMLElement` or `Window` to track focus changes on.
 * @returns An `IFocusTracker` instance.
 */
export function trackFocus(element) {
    return new FocusTracker(element);
}
export function after(sibling, child) {
    sibling.after(child);
    return child;
}
export function append(parent, ...children) {
    parent.append(...children);
    if (children.length === 1 && typeof children[0] !== 'string') {
        return children[0];
    }
}
export function prepend(parent, child) {
    parent.insertBefore(child, parent.firstChild);
    return child;
}
/**
 * Removes all children from `parent` and appends `children`
 */
export function reset(parent, ...children) {
    parent.textContent = '';
    append(parent, ...children);
}
const SELECTOR_REGEX = /([\w\-]+)?(#([\w\-]+))?((\.([\w\-]+))*)/;
export var Namespace;
(function (Namespace) {
    Namespace["HTML"] = "http://www.w3.org/1999/xhtml";
    Namespace["SVG"] = "http://www.w3.org/2000/svg";
})(Namespace || (Namespace = {}));
function _$(namespace, description, attrs, ...children) {
    const match = SELECTOR_REGEX.exec(description);
    if (!match) {
        throw new Error('Bad use of emmet');
    }
    const tagName = match[1] || 'div';
    let result;
    if (namespace !== Namespace.HTML) {
        result = document.createElementNS(namespace, tagName);
    }
    else {
        result = document.createElement(tagName);
    }
    if (match[3]) {
        result.id = match[3];
    }
    if (match[4]) {
        result.className = match[4].replace(/\./g, ' ').trim();
    }
    if (attrs) {
        Object.entries(attrs).forEach(([name, value]) => {
            if (typeof value === 'undefined') {
                return;
            }
            if (/^on\w+$/.test(name)) {
                // eslint-disable-next-line local/code-no-any-casts
                result[name] = value;
            }
            else if (name === 'selected') {
                if (value) {
                    result.setAttribute(name, 'true');
                }
            }
            else {
                result.setAttribute(name, value);
            }
        });
    }
    result.append(...children);
    return result;
}
export function $(description, attrs, ...children) {
    return _$(Namespace.HTML, description, attrs, ...children);
}
$.SVG = function (description, attrs, ...children) {
    return _$(Namespace.SVG, description, attrs, ...children);
};
export function join(nodes, separator) {
    const result = [];
    nodes.forEach((node, index) => {
        if (index > 0) {
            if (separator instanceof Node) {
                result.push(separator.cloneNode());
            }
            else {
                result.push(document.createTextNode(separator));
            }
        }
        result.push(node);
    });
    return result;
}
export function setVisibility(visible, ...elements) {
    if (visible) {
        show(...elements);
    }
    else {
        hide(...elements);
    }
}
export function show(...elements) {
    for (const element of elements) {
        element.style.display = '';
        element.removeAttribute('aria-hidden');
    }
}
export function hide(...elements) {
    for (const element of elements) {
        element.style.display = 'none';
        element.setAttribute('aria-hidden', 'true');
    }
}
function findParentWithAttribute(node, attribute) {
    while (node && node.nodeType === node.ELEMENT_NODE) {
        if (isHTMLElement(node) && node.hasAttribute(attribute)) {
            return node;
        }
        node = node.parentNode;
    }
    return null;
}
export function removeTabIndexAndUpdateFocus(node) {
    if (!node || !node.hasAttribute('tabIndex')) {
        return;
    }
    // If we are the currently focused element and tabIndex is removed,
    // standard DOM behavior is to move focus to the <body> element. We
    // typically never want that, rather put focus to the closest element
    // in the hierarchy of the parent DOM nodes.
    if (node.ownerDocument.activeElement === node) {
        const parentFocusable = findParentWithAttribute(node.parentElement, 'tabIndex');
        parentFocusable?.focus();
    }
    node.removeAttribute('tabindex');
}
export function finalHandler(fn) {
    return e => {
        e.preventDefault();
        e.stopPropagation();
        fn(e);
    };
}
export function domContentLoaded(targetWindow) {
    return new Promise(resolve => {
        const readyState = targetWindow.document.readyState;
        if (readyState === 'complete' || (targetWindow.document && targetWindow.document.body !== null)) {
            resolve(undefined);
        }
        else {
            const listener = () => {
                targetWindow.window.removeEventListener('DOMContentLoaded', listener, false);
                resolve();
            };
            targetWindow.window.addEventListener('DOMContentLoaded', listener, false);
        }
    });
}
/**
 * Find a value usable for a dom node size such that the likelihood that it would be
 * displayed with constant screen pixels size is as high as possible.
 *
 * e.g. We would desire for the cursors to be 2px (CSS px) wide. Under a devicePixelRatio
 * of 1.25, the cursor will be 2.5 screen pixels wide. Depending on how the dom node aligns/"snaps"
 * with the screen pixels, it will sometimes be rendered with 2 screen pixels, and sometimes with 3 screen pixels.
 */
export function computeScreenAwareSize(window, cssPx) {
    const screenPx = window.devicePixelRatio * cssPx;
    return Math.max(1, Math.floor(screenPx)) / window.devicePixelRatio;
}
/**
 * Open safely a new window. This is the best way to do so, but you cannot tell
 * if the window was opened or if it was blocked by the browser's popup blocker.
 * If you want to tell if the browser blocked the new window, use {@link windowOpenWithSuccess}.
 *
 * See https://github.com/microsoft/monaco-editor/issues/601
 * To protect against malicious code in the linked site, particularly phishing attempts,
 * the window.opener should be set to null to prevent the linked site from having access
 * to change the location of the current page.
 * See https://mathiasbynens.github.io/rel-noopener/
 */
export function windowOpenNoOpener(url) {
    // By using 'noopener' in the `windowFeatures` argument, the newly created window will
    // not be able to use `window.opener` to reach back to the current page.
    // See https://stackoverflow.com/a/46958731
    // See https://developer.mozilla.org/en-US/docs/Web/API/Window/open#noopener
    // However, this also doesn't allow us to realize if the browser blocked
    // the creation of the window.
    mainWindow.open(url, '_blank', 'noopener');
}
/**
 * Open a new window in a popup. This is the best way to do so, but you cannot tell
 * if the window was opened or if it was blocked by the browser's popup blocker.
 * If you want to tell if the browser blocked the new window, use {@link windowOpenWithSuccess}.
 *
 * Note: this does not set {@link window.opener} to null. This is to allow the opened popup to
 * be able to use {@link window.close} to close itself. Because of this, you should only use
 * this function on urls that you trust.
 *
 * In otherwords, you should almost always use {@link windowOpenNoOpener} instead of this function.
 */
const popupWidth = 780, popupHeight = 640;
export function windowOpenPopup(url) {
    const left = Math.floor(mainWindow.screenLeft + mainWindow.innerWidth / 2 - popupWidth / 2);
    const top = Math.floor(mainWindow.screenTop + mainWindow.innerHeight / 2 - popupHeight / 2);
    mainWindow.open(url, '_blank', `width=${popupWidth},height=${popupHeight},top=${top},left=${left}`);
}
/**
 * Attempts to open a window and returns whether it succeeded. This technique is
 * not appropriate in certain contexts, like for example when the JS context is
 * executing inside a sandboxed iframe. If it is not necessary to know if the
 * browser blocked the new window, use {@link windowOpenNoOpener}.
 *
 * See https://github.com/microsoft/monaco-editor/issues/601
 * See https://github.com/microsoft/monaco-editor/issues/2474
 * See https://mathiasbynens.github.io/rel-noopener/
 *
 * @param url the url to open
 * @param noOpener whether or not to set the {@link window.opener} to null. You should leave the default
 * (true) unless you trust the url that is being opened.
 * @returns boolean indicating if the {@link window.open} call succeeded
 */
export function windowOpenWithSuccess(url, noOpener = true) {
    const newTab = mainWindow.open();
    if (newTab) {
        if (noOpener) {
            // see `windowOpenNoOpener` for details on why this is important
            // eslint-disable-next-line local/code-no-any-casts
            newTab.opener = null;
        }
        newTab.location.href = url;
        return true;
    }
    return false;
}
export function animate(targetWindow, fn) {
    const step = () => {
        fn();
        stepDisposable = scheduleAtNextAnimationFrame(targetWindow, step);
    };
    let stepDisposable = scheduleAtNextAnimationFrame(targetWindow, step);
    return toDisposable(() => stepDisposable.dispose());
}
RemoteAuthorities.setPreferredWebSchema(/^https:/.test(mainWindow.location.href) ? 'https' : 'http');
export function triggerDownload(dataOrUri, name) {
    // If the data is provided as Buffer, we create a
    // blob URL out of it to produce a valid link
    let url;
    if (URI.isUri(dataOrUri)) {
        url = dataOrUri.toString(true);
    }
    else {
        const blob = new Blob([dataOrUri]);
        url = URL.createObjectURL(blob);
        // Ensure to free the data from DOM eventually
        setTimeout(() => URL.revokeObjectURL(url));
    }
    // In order to download from the browser, the only way seems
    // to be creating a <a> element with download attribute that
    // points to the file to download.
    // See also https://developers.google.com/web/updates/2011/08/Downloading-resources-in-HTML5-a-download
    const activeWindow = getActiveWindow();
    const anchor = document.createElement('a');
    activeWindow.document.body.appendChild(anchor);
    anchor.download = name;
    anchor.href = url;
    anchor.click();
    // Ensure to remove the element from DOM eventually
    setTimeout(() => anchor.remove());
}
export function triggerUpload() {
    return new Promise(resolve => {
        // In order to upload to the browser, create a
        // input element of type `file` and click it
        // to gather the selected files
        const activeWindow = getActiveWindow();
        const input = document.createElement('input');
        activeWindow.document.body.appendChild(input);
        input.type = 'file';
        input.multiple = true;
        // Resolve once the input event has fired once
        event.Event.once(event.Event.fromDOMEventEmitter(input, 'input'))(() => {
            resolve(input.files ?? undefined);
        });
        input.click();
        // Ensure to remove the element from DOM eventually
        setTimeout(() => input.remove());
    });
}
function sanitizeNotificationText(text) {
    return text.replace(/`/g, '\''); // convert backticks to single quotes
}
export async function triggerNotification(message, options) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        return;
    }
    const disposables = new DisposableStore();
    const notification = new Notification(sanitizeNotificationText(message), {
        body: options?.detail ? sanitizeNotificationText(options.detail) : undefined,
        requireInteraction: options?.sticky,
    });
    const onClick = new event.Emitter();
    disposables.add(addDisposableListener(notification, 'click', () => onClick.fire()));
    disposables.add(addDisposableListener(notification, 'close', () => disposables.dispose()));
    disposables.add(toDisposable(() => notification.close()));
    return {
        onClick: onClick.event,
        dispose: () => disposables.dispose()
    };
}
export var DetectedFullscreenMode;
(function (DetectedFullscreenMode) {
    /**
     * The document is fullscreen, e.g. because an element
     * in the document requested to be fullscreen.
     */
    DetectedFullscreenMode[DetectedFullscreenMode["DOCUMENT"] = 1] = "DOCUMENT";
    /**
     * The browser is fullscreen, e.g. because the user enabled
     * native window fullscreen for it.
     */
    DetectedFullscreenMode[DetectedFullscreenMode["BROWSER"] = 2] = "BROWSER";
})(DetectedFullscreenMode || (DetectedFullscreenMode = {}));
export function detectFullscreen(targetWindow) {
    // Browser fullscreen: use DOM APIs to detect
    // eslint-disable-next-line local/code-no-any-casts
    if (targetWindow.document.fullscreenElement || targetWindow.document.webkitFullscreenElement || targetWindow.document.webkitIsFullScreen) {
        return { mode: DetectedFullscreenMode.DOCUMENT, guess: false };
    }
    // There is no standard way to figure out if the browser
    // is using native fullscreen. Via checking on screen
    // height and comparing that to window height, we can guess
    // it though.
    if (targetWindow.innerHeight === targetWindow.screen.height) {
        // if the height of the window matches the screen height, we can
        // safely assume that the browser is fullscreen because no browser
        // chrome is taking height away (e.g. like toolbars).
        return { mode: DetectedFullscreenMode.BROWSER, guess: false };
    }
    if (platform.isMacintosh || platform.isLinux) {
        // macOS and Linux do not properly report `innerHeight`, only Windows does
        if (targetWindow.outerHeight === targetWindow.screen.height && targetWindow.outerWidth === targetWindow.screen.width) {
            // if the height of the browser matches the screen height, we can
            // only guess that we are in fullscreen. It is also possible that
            // the user has turned off taskbars in the OS and the browser is
            // simply able to span the entire size of the screen.
            return { mode: DetectedFullscreenMode.BROWSER, guess: true };
        }
    }
    // Not in fullscreen
    return null;
}
export class ModifierKeyEmitter extends event.Emitter {
    constructor() {
        super();
        this._subscriptions = new DisposableStore();
        this._keyStatus = {
            altKey: false,
            shiftKey: false,
            ctrlKey: false,
            metaKey: false
        };
        this._subscriptions.add(event.Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => this.registerListeners(window, disposables), { window: mainWindow, disposables: this._subscriptions }));
    }
    registerListeners(window, disposables) {
        disposables.add(addDisposableListener(window, 'keydown', e => {
            if (e.defaultPrevented) {
                return;
            }
            const event = new StandardKeyboardEvent(e);
            // If Alt-key keydown event is repeated, ignore it #112347
            // Only known to be necessary for Alt-Key at the moment #115810
            if (event.keyCode === 6 /* KeyCode.Alt */ && e.repeat) {
                return;
            }
            if (e.altKey && !this._keyStatus.altKey) {
                this._keyStatus.lastKeyPressed = 'alt';
            }
            else if (e.ctrlKey && !this._keyStatus.ctrlKey) {
                this._keyStatus.lastKeyPressed = 'ctrl';
            }
            else if (e.metaKey && !this._keyStatus.metaKey) {
                this._keyStatus.lastKeyPressed = 'meta';
            }
            else if (e.shiftKey && !this._keyStatus.shiftKey) {
                this._keyStatus.lastKeyPressed = 'shift';
            }
            else if (event.keyCode !== 6 /* KeyCode.Alt */) {
                this._keyStatus.lastKeyPressed = undefined;
            }
            else {
                return;
            }
            this._keyStatus.altKey = e.altKey;
            this._keyStatus.ctrlKey = e.ctrlKey;
            this._keyStatus.metaKey = e.metaKey;
            this._keyStatus.shiftKey = e.shiftKey;
            if (this._keyStatus.lastKeyPressed) {
                this._keyStatus.event = e;
                this.fire(this._keyStatus);
            }
        }, true));
        disposables.add(addDisposableListener(window, 'keyup', e => {
            if (e.defaultPrevented) {
                return;
            }
            if (!e.altKey && this._keyStatus.altKey) {
                this._keyStatus.lastKeyReleased = 'alt';
            }
            else if (!e.ctrlKey && this._keyStatus.ctrlKey) {
                this._keyStatus.lastKeyReleased = 'ctrl';
            }
            else if (!e.metaKey && this._keyStatus.metaKey) {
                this._keyStatus.lastKeyReleased = 'meta';
            }
            else if (!e.shiftKey && this._keyStatus.shiftKey) {
                this._keyStatus.lastKeyReleased = 'shift';
            }
            else {
                this._keyStatus.lastKeyReleased = undefined;
            }
            if (this._keyStatus.lastKeyPressed !== this._keyStatus.lastKeyReleased) {
                this._keyStatus.lastKeyPressed = undefined;
            }
            this._keyStatus.altKey = e.altKey;
            this._keyStatus.ctrlKey = e.ctrlKey;
            this._keyStatus.metaKey = e.metaKey;
            this._keyStatus.shiftKey = e.shiftKey;
            if (this._keyStatus.lastKeyReleased) {
                this._keyStatus.event = e;
                this.fire(this._keyStatus);
            }
        }, true));
        disposables.add(addDisposableListener(window.document.body, 'mousedown', () => {
            this._keyStatus.lastKeyPressed = undefined;
        }, true));
        disposables.add(addDisposableListener(window.document.body, 'mouseup', () => {
            this._keyStatus.lastKeyPressed = undefined;
        }, true));
        disposables.add(addDisposableListener(window.document.body, 'mousemove', e => {
            if (e.buttons) {
                this._keyStatus.lastKeyPressed = undefined;
            }
        }, true));
        disposables.add(addDisposableListener(window, 'blur', () => {
            this.resetKeyStatus();
        }));
    }
    get keyStatus() {
        return this._keyStatus;
    }
    get isModifierPressed() {
        return hasModifierKeys(this._keyStatus);
    }
    /**
     * Allows to explicitly reset the key status based on more knowledge (#109062)
     */
    resetKeyStatus() {
        this.doResetKeyStatus();
        this.fire(this._keyStatus);
    }
    doResetKeyStatus() {
        this._keyStatus = {
            altKey: false,
            shiftKey: false,
            ctrlKey: false,
            metaKey: false
        };
    }
    static getInstance() {
        if (!ModifierKeyEmitter.instance) {
            ModifierKeyEmitter.instance = new ModifierKeyEmitter();
        }
        return ModifierKeyEmitter.instance;
    }
    static disposeInstance() {
        if (ModifierKeyEmitter.instance) {
            ModifierKeyEmitter.instance.dispose();
            ModifierKeyEmitter.instance = undefined;
        }
    }
    dispose() {
        super.dispose();
        this._subscriptions.dispose();
    }
}
export function getCookieValue(name) {
    const match = document.cookie.match('(^|[^;]+)\\s*' + name + '\\s*=\\s*([^;]+)'); // See https://stackoverflow.com/a/25490531
    return match ? match.pop() : undefined;
}
export class DragAndDropObserver extends Disposable {
    constructor(element, callbacks) {
        super();
        this.element = element;
        this.callbacks = callbacks;
        // A helper to fix issues with repeated DRAG_ENTER / DRAG_LEAVE
        // calls see https://github.com/microsoft/vscode/issues/14470
        // when the element has child elements where the events are fired
        // repeadedly.
        this.counter = 0;
        // Allows to measure the duration of the drag operation.
        this.dragStartTime = 0;
        this.registerListeners();
    }
    registerListeners() {
        if (this.callbacks.onDragStart) {
            this._register(addDisposableListener(this.element, EventType.DRAG_START, (e) => {
                this.callbacks.onDragStart?.(e);
            }));
        }
        if (this.callbacks.onDrag) {
            this._register(addDisposableListener(this.element, EventType.DRAG, (e) => {
                this.callbacks.onDrag?.(e);
            }));
        }
        this._register(addDisposableListener(this.element, EventType.DRAG_ENTER, (e) => {
            this.counter++;
            this.dragStartTime = e.timeStamp;
            this.callbacks.onDragEnter?.(e);
        }));
        this._register(addDisposableListener(this.element, EventType.DRAG_OVER, (e) => {
            e.preventDefault(); // needed so that the drop event fires (https://stackoverflow.com/questions/21339924/drop-event-not-firing-in-chrome)
            this.callbacks.onDragOver?.(e, e.timeStamp - this.dragStartTime);
        }));
        this._register(addDisposableListener(this.element, EventType.DRAG_LEAVE, (e) => {
            this.counter--;
            if (this.counter === 0) {
                this.dragStartTime = 0;
                this.callbacks.onDragLeave?.(e);
            }
        }));
        this._register(addDisposableListener(this.element, EventType.DRAG_END, (e) => {
            this.counter = 0;
            this.dragStartTime = 0;
            this.callbacks.onDragEnd?.(e);
        }));
        this._register(addDisposableListener(this.element, EventType.DROP, (e) => {
            this.counter = 0;
            this.dragStartTime = 0;
            this.callbacks.onDrop?.(e);
        }));
    }
}
const H_REGEX = /(?<tag>[\w\-]+)?(?:#(?<id>[\w\-]+))?(?<class>(?:\.(?:[\w\-]+))*)(?:@(?<name>(?:[\w\_])+))?/;
export function h(tag, ...args) {
    let attributes;
    let children;
    if (Array.isArray(args[0])) {
        attributes = {};
        children = args[0];
    }
    else {
        // eslint-disable-next-line local/code-no-any-casts
        attributes = args[0] || {};
        children = args[1];
    }
    const match = H_REGEX.exec(tag);
    if (!match || !match.groups) {
        throw new Error('Bad use of h');
    }
    const tagName = match.groups['tag'] || 'div';
    const el = document.createElement(tagName);
    if (match.groups['id']) {
        el.id = match.groups['id'];
    }
    const classNames = [];
    if (match.groups['class']) {
        for (const className of match.groups['class'].split('.')) {
            if (className !== '') {
                classNames.push(className);
            }
        }
    }
    if (attributes.className !== undefined) {
        for (const className of attributes.className.split('.')) {
            if (className !== '') {
                classNames.push(className);
            }
        }
    }
    if (classNames.length > 0) {
        el.className = classNames.join(' ');
    }
    const result = {};
    if (match.groups['name']) {
        result[match.groups['name']] = el;
    }
    if (children) {
        for (const c of children) {
            if (isHTMLElement(c)) {
                el.appendChild(c);
            }
            else if (typeof c === 'string') {
                el.append(c);
            }
            else if ('root' in c) {
                Object.assign(result, c);
                el.appendChild(c.root);
            }
        }
    }
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'className') {
            continue;
        }
        else if (key === 'style') {
            for (const [cssKey, cssValue] of Object.entries(value)) {
                el.style.setProperty(camelCaseToHyphenCase(cssKey), typeof cssValue === 'number' ? cssValue + 'px' : '' + cssValue);
            }
        }
        else if (key === 'tabIndex') {
            el.tabIndex = value;
        }
        else {
            el.setAttribute(camelCaseToHyphenCase(key), value.toString());
        }
    }
    result['root'] = el;
    return result;
}
/** @deprecated This is a duplication of the h function. Needs cleanup. */
export function svgElem(tag, ...args) {
    let attributes;
    let children;
    if (Array.isArray(args[0])) {
        attributes = {};
        children = args[0];
    }
    else {
        // eslint-disable-next-line local/code-no-any-casts
        attributes = args[0] || {};
        children = args[1];
    }
    const match = H_REGEX.exec(tag);
    if (!match || !match.groups) {
        throw new Error('Bad use of h');
    }
    const tagName = match.groups['tag'] || 'div';
    // eslint-disable-next-line local/code-no-any-casts
    const el = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    if (match.groups['id']) {
        el.id = match.groups['id'];
    }
    const classNames = [];
    if (match.groups['class']) {
        for (const className of match.groups['class'].split('.')) {
            if (className !== '') {
                classNames.push(className);
            }
        }
    }
    if (attributes.className !== undefined) {
        for (const className of attributes.className.split('.')) {
            if (className !== '') {
                classNames.push(className);
            }
        }
    }
    if (classNames.length > 0) {
        el.className = classNames.join(' ');
    }
    const result = {};
    if (match.groups['name']) {
        result[match.groups['name']] = el;
    }
    if (children) {
        for (const c of children) {
            if (isHTMLElement(c)) {
                el.appendChild(c);
            }
            else if (typeof c === 'string') {
                el.append(c);
            }
            else if ('root' in c) {
                Object.assign(result, c);
                el.appendChild(c.root);
            }
        }
    }
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'className') {
            continue;
        }
        else if (key === 'style') {
            for (const [cssKey, cssValue] of Object.entries(value)) {
                el.style.setProperty(camelCaseToHyphenCase(cssKey), typeof cssValue === 'number' ? cssValue + 'px' : '' + cssValue);
            }
        }
        else if (key === 'tabIndex') {
            el.tabIndex = value;
        }
        else {
            el.setAttribute(camelCaseToHyphenCase(key), value.toString());
        }
    }
    result['root'] = el;
    return result;
}
function camelCaseToHyphenCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
export function copyAttributes(from, to, filter) {
    for (const { name, value } of from.attributes) {
        if (!filter || filter.includes(name)) {
            to.setAttribute(name, value);
        }
    }
}
function copyAttribute(from, to, name) {
    const value = from.getAttribute(name);
    if (value) {
        to.setAttribute(name, value);
    }
    else {
        to.removeAttribute(name);
    }
}
export function trackAttributes(from, to, filter) {
    copyAttributes(from, to, filter);
    const disposables = new DisposableStore();
    disposables.add(sharedMutationObserver.observe(from, disposables, { attributes: true, attributeFilter: filter })(mutations => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName) {
                copyAttribute(from, to, mutation.attributeName);
            }
        }
    }));
    return disposables;
}
export function isEditableElement(element) {
    return element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea' || isHTMLElement(element) && !!element.editContext;
}
/**
 * Helper for calculating the "safe triangle" occluded by hovers to avoid early dismissal.
 * @see https://www.smashingmagazine.com/2023/08/better-context-menus-safe-triangles/ for example
 */
export class SafeTriangle {
    constructor(originX, originY, target) {
        this.originX = originX;
        this.originY = originY;
        // 4 points (x, y), 8 length
        this.points = new Int16Array(8);
        const { top, left, right, bottom } = target.getBoundingClientRect();
        const t = this.points;
        let i = 0;
        t[i++] = left;
        t[i++] = top;
        t[i++] = right;
        t[i++] = top;
        t[i++] = left;
        t[i++] = bottom;
        t[i++] = right;
        t[i++] = bottom;
    }
    contains(x, y) {
        const { points, originX, originY } = this;
        for (let i = 0; i < 4; i++) {
            const p1 = 2 * i;
            const p2 = 2 * ((i + 1) % 4);
            if (isPointWithinTriangle(x, y, originX, originY, points[p1], points[p1 + 1], points[p2], points[p2 + 1])) {
                return true;
            }
        }
        return false;
    }
}
export var n;
(function (n) {
    function nodeNs(elementNs = undefined) {
        return (tag, attributes, children) => {
            const className = attributes.class;
            delete attributes.class;
            const ref = attributes.ref;
            delete attributes.ref;
            const obsRef = attributes.obsRef;
            delete attributes.obsRef;
            // eslint-disable-next-line local/code-no-any-casts
            return new ObserverNodeWithElement(tag, ref, obsRef, elementNs, className, attributes, children);
        };
    }
    function node(tag, elementNs = undefined) {
        // eslint-disable-next-line local/code-no-any-casts
        const f = nodeNs(elementNs);
        return (attributes, children) => {
            return f(tag, attributes, children);
        };
    }
    n.div = node('div');
    n.elem = nodeNs(undefined);
    n.svg = node('svg', 'http://www.w3.org/2000/svg');
    n.svgElem = nodeNs('http://www.w3.org/2000/svg');
    function ref() {
        let value = undefined;
        const result = function (val) {
            value = val;
        };
        Object.defineProperty(result, 'element', {
            get() {
                if (!value) {
                    throw new BugIndicatingError('Make sure the ref is set before accessing the element. Maybe wrong initialization order?');
                }
                return value;
            }
        });
        // eslint-disable-next-line local/code-no-any-casts
        return result;
    }
    n.ref = ref;
})(n || (n = {}));
export class ObserverNode {
    constructor(tag, ref, obsRef, ns, className, attributes, children) {
        this._deriveds = [];
        this._isHovered = undefined;
        this._didMouseMoveDuringHover = undefined;
        this._element = (ns ? document.createElementNS(ns, tag) : document.createElement(tag));
        if (ref) {
            ref(this._element);
        }
        if (obsRef) {
            this._deriveds.push(derived((_reader) => {
                obsRef(this);
                _reader.store.add({
                    dispose: () => {
                        obsRef(null);
                    }
                });
            }));
        }
        if (className) {
            if (hasObservable(className)) {
                this._deriveds.push(derived(this, reader => {
                    /** @description set.class */
                    setClassName(this._element, getClassName(className, reader));
                }));
            }
            else {
                setClassName(this._element, getClassName(className, undefined));
            }
        }
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'style') {
                for (const [cssKey, cssValue] of Object.entries(value)) {
                    const key = camelCaseToHyphenCase(cssKey);
                    if (isObservable(cssValue)) {
                        this._deriveds.push(derivedOpts({ owner: this, debugName: () => `set.style.${key}` }, reader => {
                            this._element.style.setProperty(key, convertCssValue(cssValue.read(reader)));
                        }));
                    }
                    else {
                        this._element.style.setProperty(key, convertCssValue(cssValue));
                    }
                }
            }
            else if (key === 'tabIndex') {
                if (isObservable(value)) {
                    this._deriveds.push(derived(this, reader => {
                        /** @description set.tabIndex */
                        // eslint-disable-next-line local/code-no-any-casts
                        this._element.tabIndex = value.read(reader);
                    }));
                }
                else {
                    this._element.tabIndex = value;
                }
            }
            else if (key.startsWith('on')) {
                // eslint-disable-next-line local/code-no-any-casts
                this._element[key] = value;
            }
            else {
                if (isObservable(value)) {
                    this._deriveds.push(derivedOpts({ owner: this, debugName: () => `set.${key}` }, reader => {
                        setOrRemoveAttribute(this._element, key, value.read(reader));
                    }));
                }
                else {
                    setOrRemoveAttribute(this._element, key, value);
                }
            }
        }
        if (children) {
            function getChildren(reader, children) {
                if (isObservable(children)) {
                    return getChildren(reader, children.read(reader));
                }
                if (Array.isArray(children)) {
                    return children.flatMap(c => getChildren(reader, c));
                }
                if (children instanceof ObserverNode) {
                    if (reader) {
                        children.readEffect(reader);
                    }
                    return [children._element];
                }
                if (children) {
                    return [children];
                }
                return [];
            }
            const d = derived(this, reader => {
                /** @description set.children */
                this._element.replaceChildren(...getChildren(reader, children));
            });
            this._deriveds.push(d);
            if (!childrenIsObservable(children)) {
                d.get();
            }
        }
    }
    readEffect(reader) {
        for (const d of this._deriveds) {
            d.read(reader);
        }
    }
    keepUpdated(store) {
        derived(reader => {
            /** update */
            this.readEffect(reader);
        }).recomputeInitiallyAndOnChange(store);
        return this;
    }
    /**
     * Creates a live element that will keep the element updated as long as the returned object is not disposed.
    */
    toDisposableLiveElement() {
        const store = new DisposableStore();
        this.keepUpdated(store);
        return new LiveElement(this._element, store);
    }
    get isHovered() {
        if (!this._isHovered) {
            const hovered = observableValue('hovered', false);
            this._element.addEventListener('mouseenter', (_e) => hovered.set(true, undefined));
            this._element.addEventListener('mouseleave', (_e) => hovered.set(false, undefined));
            this._isHovered = hovered;
        }
        return this._isHovered;
    }
    get didMouseMoveDuringHover() {
        if (!this._didMouseMoveDuringHover) {
            let _hovering = false;
            const hovered = observableValue('didMouseMoveDuringHover', false);
            this._element.addEventListener('mouseenter', (_e) => {
                _hovering = true;
            });
            this._element.addEventListener('mousemove', (_e) => {
                if (_hovering) {
                    hovered.set(true, undefined);
                }
            });
            this._element.addEventListener('mouseleave', (_e) => {
                _hovering = false;
                hovered.set(false, undefined);
            });
            this._didMouseMoveDuringHover = hovered;
        }
        return this._didMouseMoveDuringHover;
    }
}
function setClassName(domNode, className) {
    if (isSVGElement(domNode)) {
        domNode.setAttribute('class', className);
    }
    else {
        domNode.className = className;
    }
}
function resolve(value, reader, cb) {
    if (isObservable(value)) {
        cb(value.read(reader));
        return;
    }
    if (Array.isArray(value)) {
        for (const v of value) {
            resolve(v, reader, cb);
        }
        return;
    }
    // eslint-disable-next-line local/code-no-any-casts
    cb(value);
}
function getClassName(className, reader) {
    let result = '';
    resolve(className, reader, val => {
        if (val) {
            if (result.length === 0) {
                result = val;
            }
            else {
                result += ' ' + val;
            }
        }
    });
    return result;
}
function hasObservable(value) {
    if (isObservable(value)) {
        return true;
    }
    if (Array.isArray(value)) {
        return value.some(v => hasObservable(v));
    }
    return false;
}
function convertCssValue(value) {
    if (typeof value === 'number') {
        return value + 'px';
    }
    return value;
}
function childrenIsObservable(children) {
    if (isObservable(children)) {
        return true;
    }
    if (Array.isArray(children)) {
        return children.some(c => childrenIsObservable(c));
    }
    return false;
}
export class LiveElement {
    constructor(element, _disposable) {
        this.element = element;
        this._disposable = _disposable;
    }
    dispose() {
        this._disposable.dispose();
    }
}
export class ObserverNodeWithElement extends ObserverNode {
    get element() {
        return this._element;
    }
}
function setOrRemoveAttribute(element, key, value) {
    if (value === null || value === undefined) {
        element.removeAttribute(camelCaseToHyphenCase(key));
    }
    else {
        element.setAttribute(camelCaseToHyphenCase(key), String(value));
    }
}
function isObservable(obj) {
    return !!obj && obj.read !== undefined && obj.reportChanges !== undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9tLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvYnJvd3Nlci9kb20udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLE9BQU8sTUFBTSxjQUFjLENBQUM7QUFDeEMsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUMvQyxPQUFPLEVBQUUsZUFBZSxFQUFrQixxQkFBcUIsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzVGLE9BQU8sRUFBZSxrQkFBa0IsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ2xFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBZ0IsTUFBTSxvQkFBb0IsQ0FBQztBQUNoSCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUM1RSxPQUFPLEtBQUssS0FBSyxNQUFNLG9CQUFvQixDQUFDO0FBRTVDLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLFlBQVksRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ2hHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ3pELE9BQU8sS0FBSyxRQUFRLE1BQU0sdUJBQXVCLENBQUM7QUFDbEQsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUN6QyxPQUFPLEVBQWMsZ0JBQWdCLEVBQUUsVUFBVSxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQzdELE9BQU8sRUFBZSxPQUFPLEVBQUUsV0FBVyxFQUFXLGVBQWUsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBT3RHLHlDQUF5QztBQUV6QyxNQUFNLENBQUMsTUFBTSxFQUNaLGNBQWMsRUFDZCxTQUFTLEVBQ1QsV0FBVyxFQUNYLFVBQVUsRUFDVixlQUFlLEVBQ2YsV0FBVyxFQUNYLGFBQWEsRUFDYixTQUFTLEVBQ1QsbUJBQW1CLEVBQ25CLHNCQUFzQixFQUN0QixxQkFBcUIsRUFDckIsR0FBRyxDQUFDO0lBQ0osTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQWlDLENBQUM7SUFFekQsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2hDLE1BQU0sc0JBQXNCLEdBQUcsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxJQUFJLGVBQWUsRUFBRSxFQUFFLENBQUM7SUFDMUYsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsY0FBYyxFQUFFLHNCQUFzQixDQUFDLENBQUM7SUFFL0QsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLEVBQXlCLENBQUM7SUFDdkUsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLEVBQWMsQ0FBQztJQUM5RCxNQUFNLHNCQUFzQixHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBYyxDQUFDO0lBSS9ELFNBQVMsYUFBYSxDQUFDLFFBQTRCLEVBQUUsY0FBd0I7UUFDNUUsTUFBTSxNQUFNLEdBQUcsT0FBTyxRQUFRLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFFaEYsT0FBTyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUN4RSxDQUFDO0lBRUQsT0FBTztRQUNOLG1CQUFtQixFQUFFLG1CQUFtQixDQUFDLEtBQUs7UUFDOUMsc0JBQXNCLEVBQUUsc0JBQXNCLENBQUMsS0FBSztRQUNwRCxxQkFBcUIsRUFBRSxxQkFBcUIsQ0FBQyxLQUFLO1FBQ2xELGNBQWMsQ0FBQyxNQUFrQjtZQUNoQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3hDLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQztZQUN4QixDQUFDO1lBRUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztZQUUxQyxNQUFNLGdCQUFnQixHQUFHO2dCQUN4QixNQUFNO2dCQUNOLFdBQVcsRUFBRSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksZUFBZSxFQUFFLENBQUM7YUFDbkQsQ0FBQztZQUNGLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBRXJELFdBQVcsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRTtnQkFDakMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7Z0JBQ3RDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNwQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRUosV0FBVyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLGFBQWEsRUFBRSxHQUFHLEVBQUU7Z0JBQzNFLHNCQUFzQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNyQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRUosbUJBQW1CLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFFM0MsT0FBTyxXQUFXLENBQUM7UUFDcEIsQ0FBQztRQUNELFVBQVU7WUFDVCxPQUFPLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUN6QixDQUFDO1FBQ0QsZUFBZTtZQUNkLE9BQU8sT0FBTyxDQUFDLElBQUksQ0FBQztRQUNyQixDQUFDO1FBQ0QsV0FBVyxDQUFDLFlBQW9CO1lBQy9CLE9BQVEsWUFBMkIsQ0FBQyxjQUFjLENBQUM7UUFDcEQsQ0FBQztRQUNELFNBQVMsQ0FBQyxRQUFnQjtZQUN6QixPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDOUIsQ0FBQztRQUNELGFBQWE7UUFDYixTQUFTLENBQUMsQ0FBb0M7WUFDN0MsTUFBTSxhQUFhLEdBQUcsQ0FBNEIsQ0FBQztZQUNuRCxJQUFJLGFBQWEsRUFBRSxhQUFhLEVBQUUsV0FBVyxFQUFFLENBQUM7Z0JBQy9DLE9BQU8sYUFBYSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsTUFBb0IsQ0FBQztZQUNyRSxDQUFDO1lBRUQsTUFBTSxjQUFjLEdBQUcsQ0FBK0IsQ0FBQztZQUN2RCxJQUFJLGNBQWMsRUFBRSxJQUFJLEVBQUUsQ0FBQztnQkFDMUIsT0FBTyxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQW9CLENBQUM7WUFDakQsQ0FBQztZQUVELE9BQU8sVUFBVSxDQUFDO1FBQ25CLENBQUM7UUFDRCxXQUFXLENBQUMsQ0FBb0M7WUFDL0MsTUFBTSxhQUFhLEdBQUcsQ0FBNEIsQ0FBQztZQUNuRCxPQUFPLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxRQUFRLENBQUM7UUFDMUMsQ0FBQztLQUNELENBQUM7QUFDSCxDQUFDLENBQUMsRUFBRSxDQUFDO0FBRUwsWUFBWTtBQUVaLE1BQU0sVUFBVSxTQUFTLENBQUMsSUFBaUI7SUFDMUMsT0FBTyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDeEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUMxQixDQUFDO0FBQ0YsQ0FBQztBQUVELE1BQU0sV0FBVztJQU9oQixZQUFZLElBQWlCLEVBQUUsSUFBWSxFQUFFLE9BQXlCLEVBQUUsT0FBMkM7UUFDbEgsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7UUFDbEIsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7UUFDbEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUM7UUFDeEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLE9BQU8sSUFBSSxLQUFLLENBQUMsQ0FBQztRQUNuQyxJQUFJLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDdkUsQ0FBQztJQUVELE9BQU87UUFDTixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3BCLG1CQUFtQjtZQUNuQixPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUV6RSw2REFBNkQ7UUFDN0QsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFLLENBQUM7SUFDdkIsQ0FBQztDQUNEO0FBS0QsTUFBTSxVQUFVLHFCQUFxQixDQUFDLElBQWlCLEVBQUUsSUFBWSxFQUFFLE9BQTZCLEVBQUUsbUJBQXVEO0lBQzVKLE9BQU8sSUFBSSxXQUFXLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztBQUNsRSxDQUFDO0FBYUQsU0FBUyx5QkFBeUIsQ0FBQyxZQUFvQixFQUFFLE9BQWlDO0lBQ3pGLE9BQU8sVUFBVSxDQUFhO1FBQzdCLE9BQU8sT0FBTyxDQUFDLElBQUksa0JBQWtCLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDekQsQ0FBQyxDQUFDO0FBQ0gsQ0FBQztBQUNELFNBQVMsNEJBQTRCLENBQUMsT0FBb0M7SUFDekUsT0FBTyxVQUFVLENBQWdCO1FBQ2hDLE9BQU8sT0FBTyxDQUFDLElBQUkscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM5QyxDQUFDLENBQUM7QUFDSCxDQUFDO0FBQ0QsTUFBTSxDQUFDLE1BQU0sNkJBQTZCLEdBQTRDLFNBQVMsNkJBQTZCLENBQUMsSUFBc0MsRUFBRSxJQUFZLEVBQUUsT0FBNkIsRUFBRSxVQUFvQjtJQUNyTyxJQUFJLFdBQVcsR0FBRyxPQUFPLENBQUM7SUFFMUIsSUFBSSxJQUFJLEtBQUssT0FBTyxJQUFJLElBQUksS0FBSyxXQUFXLElBQUksSUFBSSxLQUFLLGFBQWEsRUFBRSxDQUFDO1FBQ3hFLFdBQVcsR0FBRyx5QkFBeUIsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDbkUsQ0FBQztTQUFNLElBQUksSUFBSSxLQUFLLFNBQVMsSUFBSSxJQUFJLEtBQUssVUFBVSxJQUFJLElBQUksS0FBSyxPQUFPLEVBQUUsQ0FBQztRQUMxRSxXQUFXLEdBQUcsNEJBQTRCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVELE9BQU8scUJBQXFCLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDbkUsQ0FBQyxDQUFDO0FBRUYsTUFBTSxDQUFDLE1BQU0sNkNBQTZDLEdBQUcsU0FBUyw2QkFBNkIsQ0FBQyxJQUFpQixFQUFFLE9BQTZCLEVBQUUsVUFBb0I7SUFDekssTUFBTSxXQUFXLEdBQUcseUJBQXlCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBRXhFLE9BQU8scUNBQXFDLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUM3RSxDQUFDLENBQUM7QUFFRixNQUFNLENBQUMsTUFBTSwyQ0FBMkMsR0FBRyxTQUFTLDZCQUE2QixDQUFDLElBQWlCLEVBQUUsT0FBNkIsRUFBRSxVQUFvQjtJQUN2SyxNQUFNLFdBQVcsR0FBRyx5QkFBeUIsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFFeEUsT0FBTyxtQ0FBbUMsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQzNFLENBQUMsQ0FBQztBQUNGLE1BQU0sVUFBVSxxQ0FBcUMsQ0FBQyxJQUFpQixFQUFFLE9BQTZCLEVBQUUsVUFBb0I7SUFDM0gsT0FBTyxxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLEtBQUssSUFBSSxlQUFlLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsVUFBVSxFQUFFLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQztBQUMxSixDQUFDO0FBRUQsTUFBTSxVQUFVLHFDQUFxQyxDQUFDLElBQWlCLEVBQUUsT0FBNkIsRUFBRSxVQUFvQjtJQUMzSCxPQUFPLHFCQUFxQixDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSyxJQUFJLGVBQWUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQzFKLENBQUM7QUFFRCxNQUFNLFVBQVUsbUNBQW1DLENBQUMsSUFBaUIsRUFBRSxPQUE2QixFQUFFLFVBQW9CO0lBQ3pILE9BQU8scUJBQXFCLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLLElBQUksZUFBZSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDdEosQ0FBQztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FrQkc7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsWUFBd0MsRUFBRSxRQUFzQyxFQUFFLE9BQWdCO0lBQ25JLE9BQU8sWUFBWSxDQUFDLFlBQVksRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDdEQsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sT0FBTyxlQUFtQixTQUFRLGlCQUFvQjtJQUMzRCxZQUFZLFlBQXdDLEVBQUUsUUFBaUI7UUFDdEUsS0FBSyxDQUFDLFlBQVksRUFBRSxRQUFRLENBQUMsQ0FBQztJQUMvQixDQUFDO0NBQ0Q7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sQ0FBQyxJQUFJLHVDQUFxSCxDQUFDO0FBQ2pJOzs7OztHQUtHO0FBQ0gsTUFBTSxDQUFDLElBQUksNEJBQTBHLENBQUM7QUFFdEgsTUFBTSxVQUFVLHdCQUF3QixDQUFDLFlBQW9CLEVBQUUsT0FBb0UsRUFBRSxRQUFnQixFQUFFLFVBQW1CO0lBQ3pLLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztJQUNsQixNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRTtRQUMzQyxTQUFTLEVBQUUsQ0FBQztRQUNaLElBQUksQ0FBQyxPQUFPLFVBQVUsS0FBSyxRQUFRLElBQUksU0FBUyxJQUFJLFVBQVUsQ0FBQyxJQUFJLE9BQU8sRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3ZGLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN0QixDQUFDO0lBQ0YsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2IsTUFBTSxVQUFVLEdBQUcsWUFBWSxDQUFDLEdBQUcsRUFBRTtRQUNwQyxZQUFZLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ25DLENBQUMsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxVQUFVLENBQUM7QUFDbkIsQ0FBQztBQUVELE1BQU0sT0FBTyxtQkFBb0IsU0FBUSxhQUFhO0lBSXJEOzs7T0FHRztJQUNILFlBQVksSUFBVztRQUN0QixLQUFLLEVBQUUsQ0FBQztRQUNSLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QyxDQUFDO0lBRVEsWUFBWSxDQUFDLE1BQWtCLEVBQUUsUUFBZ0IsRUFBRSxZQUF5QztRQUNwRyxPQUFPLEtBQUssQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxZQUFZLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ2pGLENBQUM7Q0FDRDtBQUVELE1BQU0sdUJBQXVCO0lBTTVCLFlBQVksTUFBa0IsRUFBRSxXQUFtQixDQUFDO1FBQ25ELElBQUksQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO0lBQ3hCLENBQUM7SUFFRCxPQUFPO1FBQ04sSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7SUFDdkIsQ0FBQztJQUVELE9BQU87UUFDTixJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNwQixPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksQ0FBQztZQUNKLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNoQixDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNaLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLENBQUM7SUFDRixDQUFDO0lBRUQsdUNBQXVDO0lBQ3ZDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBMEIsRUFBRSxDQUEwQjtRQUNqRSxPQUFPLENBQUMsQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQztJQUNoQyxDQUFDO0NBQ0Q7QUFFRCxDQUFDO0lBQ0E7O09BRUc7SUFDSCxNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBcUQsQ0FBQztJQUNoRjs7T0FFRztJQUNILE1BQU0sYUFBYSxHQUFHLElBQUksR0FBRyxFQUFxRCxDQUFDO0lBQ25GOztPQUVHO0lBQ0gsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLEdBQUcsRUFBbUMsQ0FBQztJQUN0RTs7T0FFRztJQUNILE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxHQUFHLEVBQW1DLENBQUM7SUFFMUUsTUFBTSxvQkFBb0IsR0FBRyxDQUFDLGNBQXNCLEVBQUUsRUFBRTtRQUN2RCxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRTlDLE1BQU0sWUFBWSxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQzFELGFBQWEsQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ2hELFVBQVUsQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRW5DLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDakQsT0FBTyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ2hDLFlBQVksQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDaEQsTUFBTSxHQUFHLEdBQUcsWUFBWSxDQUFDLEtBQUssRUFBRyxDQUFDO1lBQ2xDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNmLENBQUM7UUFDRCxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ25ELENBQUMsQ0FBQztJQUVGLDRCQUE0QixHQUFHLENBQUMsWUFBb0IsRUFBRSxNQUFrQixFQUFFLFdBQW1CLENBQUMsRUFBRSxFQUFFO1FBQ2pHLE1BQU0sY0FBYyxHQUFHLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNqRCxNQUFNLElBQUksR0FBRyxJQUFJLHVCQUF1QixDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUUzRCxJQUFJLFNBQVMsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNoQixTQUFTLEdBQUcsRUFBRSxDQUFDO1lBQ2YsVUFBVSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUNELFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFckIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO1lBQzdDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDN0MsWUFBWSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsRUFBRSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7UUFDaEYsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQyxDQUFDO0lBRUYsdUNBQXVDLEdBQUcsQ0FBQyxZQUFvQixFQUFFLE1BQWtCLEVBQUUsUUFBaUIsRUFBRSxFQUFFO1FBQ3pHLE1BQU0sY0FBYyxHQUFHLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNqRCxJQUFJLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO1lBQ2hELE1BQU0sSUFBSSxHQUFHLElBQUksdUJBQXVCLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQzNELElBQUksWUFBWSxHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDckQsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO2dCQUNuQixZQUFZLEdBQUcsRUFBRSxDQUFDO2dCQUNsQixhQUFhLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxZQUFZLENBQUMsQ0FBQztZQUNqRCxDQUFDO1lBQ0QsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN4QixPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyw0QkFBNEIsQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7SUFDRixDQUFDLENBQUM7QUFDSCxDQUFDLENBQUMsRUFBRSxDQUFDO0FBRUwsTUFBTSxVQUFVLE9BQU8sQ0FBQyxZQUFvQixFQUFFLFFBQW9CO0lBQ2pFLE9BQU8sNEJBQTRCLENBQUMsWUFBWSxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsbUJBQW1CLENBQUMsQ0FBQztBQUN4RixDQUFDO0FBRUQsTUFBTSxVQUFVLE1BQU0sQ0FBQyxZQUFvQixFQUFFLFFBQW9CO0lBQ2hFLE9BQU8sNEJBQTRCLENBQUMsWUFBWSxFQUFFLFFBQVEsRUFBRSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQ3hGLENBQUM7QUFTRCxNQUFNLGVBQWUsR0FBRyxDQUFDLENBQUM7QUFDMUIsU0FBUyxvQkFBb0IsQ0FBSSxVQUFtQixFQUFFLFlBQWU7SUFDcEUsT0FBTyxZQUFZLENBQUM7QUFDckIsQ0FBQztBQUVELE1BQU0sMkJBQWdELFNBQVEsVUFBVTtJQUV2RSxZQUFZLElBQVUsRUFBRSxJQUFZLEVBQUUsT0FBMkIsRUFBRSxjQUFrQyxvQkFBMEMsRUFBRSxnQkFBd0IsZUFBZTtRQUN2TCxLQUFLLEVBQUUsQ0FBQztRQUVSLElBQUksU0FBUyxHQUFhLElBQUksQ0FBQztRQUMvQixJQUFJLGVBQWUsR0FBRyxDQUFDLENBQUM7UUFDeEIsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLFlBQVksRUFBRSxDQUFDLENBQUM7UUFFbkQsTUFBTSxhQUFhLEdBQUcsR0FBRyxFQUFFO1lBQzFCLGVBQWUsR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN6QyxPQUFPLENBQUksU0FBUyxDQUFDLENBQUM7WUFDdEIsU0FBUyxHQUFHLElBQUksQ0FBQztRQUNsQixDQUFDLENBQUM7UUFFRixJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRTtZQUV0RCxTQUFTLEdBQUcsV0FBVyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN0QyxNQUFNLFdBQVcsR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsR0FBRyxlQUFlLENBQUM7WUFFN0QsSUFBSSxXQUFXLElBQUksYUFBYSxFQUFFLENBQUM7Z0JBQ2xDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDakIsYUFBYSxFQUFFLENBQUM7WUFDakIsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE9BQU8sQ0FBQyxXQUFXLENBQUMsYUFBYSxFQUFFLGFBQWEsR0FBRyxXQUFXLENBQUMsQ0FBQztZQUNqRSxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRDtBQUVELE1BQU0sVUFBVSw4QkFBOEIsQ0FBNkIsSUFBUyxFQUFFLElBQVksRUFBRSxPQUEyQixFQUFFLFdBQWdDLEVBQUUsYUFBc0I7SUFDeEwsT0FBTyxJQUFJLDJCQUEyQixDQUFPLElBQUksRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxhQUFhLENBQUMsQ0FBQztBQUMvRixDQUFDO0FBRUQsTUFBTSxVQUFVLGdCQUFnQixDQUFDLEVBQWU7SUFDL0MsT0FBTyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ2pELENBQUM7QUFFRCxNQUFNLFVBQVUsYUFBYSxDQUFDLE9BQW9CLEVBQUUsWUFBd0IsRUFBRSxlQUE2QjtJQUMxRyxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDcEMsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDLFFBQVEsQ0FBQztJQUVyQywwQ0FBMEM7SUFDMUMsSUFBSSxPQUFPLEtBQUssVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2pDLE9BQU8sSUFBSSxTQUFTLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDakUsQ0FBQztJQUVELHdLQUF3SztJQUN4SyxJQUFJLFFBQVEsQ0FBQyxLQUFLLElBQUksUUFBUSxFQUFFLGNBQWMsRUFBRSxDQUFDO1FBQ2hELE9BQU8sSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNyRixDQUFDO0lBRUQsK0JBQStCO0lBQy9CLElBQUksUUFBUSxFQUFFLFVBQVUsSUFBSSxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDbEQsT0FBTyxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRUQsa0VBQWtFO0lBQ2xFLElBQUksVUFBVSxDQUFDLElBQUksSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVcsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3BGLE9BQU8sSUFBSSxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNqRixDQUFDO0lBRUQsd0ZBQXdGO0lBQ3hGLElBQUksVUFBVSxDQUFDLGVBQWUsSUFBSSxVQUFVLENBQUMsZUFBZSxDQUFDLFdBQVcsSUFBSSxVQUFVLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3JILE9BQU8sSUFBSSxTQUFTLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxXQUFXLEVBQUUsVUFBVSxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUN2RyxDQUFDO0lBRUQsSUFBSSxlQUFlLEVBQUUsQ0FBQztRQUNyQixPQUFPLGFBQWEsQ0FBQyxlQUFlLEVBQUUsWUFBWSxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVELElBQUksWUFBWSxFQUFFLENBQUM7UUFDbEIsT0FBTyxZQUFZLENBQUM7SUFDckIsQ0FBQztJQUVELE1BQU0sSUFBSSxLQUFLLENBQUMsK0NBQStDLENBQUMsQ0FBQztBQUNsRSxDQUFDO0FBRUQsTUFBTSxTQUFTO0lBQ2QscUJBQXFCO0lBQ3JCLHlFQUF5RTtJQUNqRSxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQW9CLEVBQUUsS0FBYTtRQUNqRSxPQUFPLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVPLE1BQU0sQ0FBQyxZQUFZLENBQUMsT0FBb0IsRUFBRSxlQUF1QjtRQUN4RSxNQUFNLGFBQWEsR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNoRCxNQUFNLEtBQUssR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO1FBQ3BGLE9BQU8sU0FBUyxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVELE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxPQUFvQjtRQUM3QyxPQUFPLFNBQVMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLG1CQUFtQixDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUNELE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFvQjtRQUM5QyxPQUFPLFNBQVMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLG9CQUFvQixDQUFDLENBQUM7SUFDOUQsQ0FBQztJQUNELE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxPQUFvQjtRQUM1QyxPQUFPLFNBQVMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLGtCQUFrQixDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUNELE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxPQUFvQjtRQUMvQyxPQUFPLFNBQVMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLHFCQUFxQixDQUFDLENBQUM7SUFDL0QsQ0FBQztJQUVELE1BQU0sQ0FBQyxjQUFjLENBQUMsT0FBb0I7UUFDekMsT0FBTyxTQUFTLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxjQUFjLENBQUMsQ0FBQztJQUN4RCxDQUFDO0lBQ0QsTUFBTSxDQUFDLGVBQWUsQ0FBQyxPQUFvQjtRQUMxQyxPQUFPLFNBQVMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLGVBQWUsQ0FBQyxDQUFDO0lBQ3pELENBQUM7SUFDRCxNQUFNLENBQUMsYUFBYSxDQUFDLE9BQW9CO1FBQ3hDLE9BQU8sU0FBUyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUNELE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFvQjtRQUMzQyxPQUFPLFNBQVMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLGdCQUFnQixDQUFDLENBQUM7SUFDMUQsQ0FBQztJQUVELE1BQU0sQ0FBQyxhQUFhLENBQUMsT0FBb0I7UUFDeEMsT0FBTyxTQUFTLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBQ0QsTUFBTSxDQUFDLFlBQVksQ0FBQyxPQUFvQjtRQUN2QyxPQUFPLFNBQVMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFDRCxNQUFNLENBQUMsY0FBYyxDQUFDLE9BQW9CO1FBQ3pDLE9BQU8sU0FBUyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDeEQsQ0FBQztJQUNELE1BQU0sQ0FBQyxlQUFlLENBQUMsT0FBb0I7UUFDMUMsT0FBTyxTQUFTLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxlQUFlLENBQUMsQ0FBQztJQUN6RCxDQUFDO0NBQ0Q7QUFVRCxNQUFNLE9BQU8sU0FBUzthQUVMLFNBQUksR0FBRyxJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFM0MsWUFDVSxLQUFhLEVBQ2IsTUFBYztRQURkLFVBQUssR0FBTCxLQUFLLENBQVE7UUFDYixXQUFNLEdBQU4sTUFBTSxDQUFRO0lBQ3BCLENBQUM7SUFFTCxJQUFJLENBQUMsUUFBZ0IsSUFBSSxDQUFDLEtBQUssRUFBRSxTQUFpQixJQUFJLENBQUMsTUFBTTtRQUM1RCxJQUFJLEtBQUssS0FBSyxJQUFJLENBQUMsS0FBSyxJQUFJLE1BQU0sS0FBSyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDcEQsT0FBTyxJQUFJLFNBQVMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDckMsQ0FBQzthQUFNLENBQUM7WUFDUCxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7SUFDRixDQUFDO0lBRUQsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFZO1FBQ3JCLE9BQU8sT0FBTyxHQUFHLEtBQUssUUFBUSxJQUFJLE9BQW9CLEdBQUksQ0FBQyxNQUFNLEtBQUssUUFBUSxJQUFJLE9BQW9CLEdBQUksQ0FBQyxLQUFLLEtBQUssUUFBUSxDQUFDO0lBQy9ILENBQUM7SUFFRCxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQWU7UUFDMUIsSUFBSSxHQUFHLFlBQVksU0FBUyxFQUFFLENBQUM7WUFDOUIsT0FBTyxHQUFHLENBQUM7UUFDWixDQUFDO2FBQU0sQ0FBQztZQUNQLE9BQU8sSUFBSSxTQUFTLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDN0MsQ0FBQztJQUNGLENBQUM7SUFFRCxNQUFNLENBQUMsTUFBTSxDQUFDLENBQXdCLEVBQUUsQ0FBd0I7UUFDL0QsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDYixPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFDRCxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDZCxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFDRCxPQUFPLENBQUMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUM7SUFDckQsQ0FBQzs7QUFRRixNQUFNLFVBQVUsZ0JBQWdCLENBQUMsT0FBb0I7SUFDcEQsMkNBQTJDO0lBQzNDLCtCQUErQjtJQUUvQixJQUFJLFlBQVksR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDO0lBQ3hDLElBQUksR0FBRyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7SUFDNUIsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQztJQUU5QixPQUNDLENBQUMsT0FBTyxHQUFnQixPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssSUFBSTtXQUNqRCxPQUFPLEtBQUssT0FBTyxDQUFDLGFBQWEsQ0FBQyxJQUFJO1dBQ3RDLE9BQU8sS0FBSyxPQUFPLENBQUMsYUFBYSxDQUFDLGVBQWUsRUFDbkQsQ0FBQztRQUNGLEdBQUcsSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDO1FBQ3pCLE1BQU0sQ0FBQyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNuRSxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ1AsSUFBSSxJQUFJLENBQUMsQ0FBQyxTQUFTLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUM7UUFDMUUsQ0FBQztRQUVELElBQUksT0FBTyxLQUFLLFlBQVksRUFBRSxDQUFDO1lBQzlCLElBQUksSUFBSSxTQUFTLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDOUMsR0FBRyxJQUFJLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUM1QyxHQUFHLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQztZQUN6QixJQUFJLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQztZQUMzQixZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQztRQUNyQyxDQUFDO0lBQ0YsQ0FBQztJQUVELE9BQU87UUFDTixJQUFJLEVBQUUsSUFBSTtRQUNWLEdBQUcsRUFBRSxHQUFHO0tBQ1IsQ0FBQztBQUNILENBQUM7QUFTRCxNQUFNLFVBQVUsSUFBSSxDQUFDLE9BQW9CLEVBQUUsS0FBb0IsRUFBRSxNQUFxQjtJQUNyRixJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQy9CLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUcsS0FBSyxJQUFJLENBQUM7SUFDcEMsQ0FBQztJQUVELElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDaEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQztJQUN0QyxDQUFDO0FBQ0YsQ0FBQztBQUVELE1BQU0sVUFBVSxRQUFRLENBQUMsT0FBb0IsRUFBRSxHQUFXLEVBQUUsS0FBYyxFQUFFLE1BQWUsRUFBRSxJQUFhLEVBQUUsV0FBbUIsVUFBVTtJQUN4SSxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzdCLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUM7SUFDaEMsQ0FBQztJQUVELElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDL0IsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxLQUFLLElBQUksQ0FBQztJQUNwQyxDQUFDO0lBRUQsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUNoQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDO0lBQ3RDLENBQUM7SUFFRCxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzlCLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEdBQUcsSUFBSSxJQUFJLENBQUM7SUFDbEMsQ0FBQztJQUVELE9BQU8sQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztBQUNuQyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsc0JBQXNCLENBQUMsT0FBb0I7SUFDMUQsTUFBTSxFQUFFLEdBQUcsT0FBTyxDQUFDLHFCQUFxQixFQUFFLENBQUM7SUFDM0MsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2xDLE9BQU87UUFDTixJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsT0FBTztRQUM5QixHQUFHLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRyxNQUFNLENBQUMsT0FBTztRQUM1QixLQUFLLEVBQUUsRUFBRSxDQUFDLEtBQUs7UUFDZixNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU07S0FDakIsQ0FBQztBQUNILENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsNkJBQTZCLENBQUMsT0FBb0IsRUFBRSxTQUFzQjtJQUN6RixNQUFNLFFBQVEsR0FBRyxzQkFBc0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNqRCxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUM7SUFFNUMsT0FBTyxRQUFRLENBQUMsSUFBSSxHQUFHLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxHQUFHLEdBQUcsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7QUFDckYsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLG1CQUFtQixDQUFDLE9BQW9CO0lBQ3ZELElBQUksV0FBVyxHQUF1QixPQUFPLENBQUM7SUFDOUMsSUFBSSxJQUFJLEdBQUcsR0FBRyxDQUFDO0lBQ2YsR0FBRyxDQUFDO1FBQ0gsbURBQW1EO1FBQ25ELE1BQU0sZ0JBQWdCLEdBQUksZ0JBQWdCLENBQUMsV0FBVyxDQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3JFLElBQUksZ0JBQWdCLEtBQUssSUFBSSxJQUFJLGdCQUFnQixLQUFLLFNBQVMsSUFBSSxnQkFBZ0IsS0FBSyxHQUFHLEVBQUUsQ0FBQztZQUM3RixJQUFJLElBQUksZ0JBQWdCLENBQUM7UUFDMUIsQ0FBQztRQUVELFdBQVcsR0FBRyxXQUFXLENBQUMsYUFBYSxDQUFDO0lBQ3pDLENBQUMsUUFBUSxXQUFXLEtBQUssSUFBSSxJQUFJLFdBQVcsS0FBSyxXQUFXLENBQUMsYUFBYSxDQUFDLGVBQWUsRUFBRTtJQUU1RixPQUFPLElBQUksQ0FBQztBQUNiLENBQUM7QUFHRCxxQkFBcUI7QUFDckIsb0RBQW9EO0FBQ3BELE1BQU0sVUFBVSxhQUFhLENBQUMsT0FBb0I7SUFDakQsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3BGLE9BQU8sT0FBTyxDQUFDLFdBQVcsR0FBRyxNQUFNLENBQUM7QUFDckMsQ0FBQztBQUVELE1BQU0sVUFBVSxlQUFlLENBQUMsT0FBb0I7SUFDbkQsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM5RixNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDdkYsT0FBTyxPQUFPLENBQUMsV0FBVyxHQUFHLE1BQU0sR0FBRyxPQUFPLENBQUM7QUFDL0MsQ0FBQztBQUVELE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxPQUFvQjtJQUN2RCxNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDcEYsT0FBTyxPQUFPLENBQUMsV0FBVyxHQUFHLE1BQU0sQ0FBQztBQUNyQyxDQUFDO0FBRUQscUJBQXFCO0FBQ3JCLG1IQUFtSDtBQUNuSCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsT0FBb0I7SUFDcEQsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM5RixNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN2RixPQUFPLE9BQU8sQ0FBQyxZQUFZLEdBQUcsTUFBTSxHQUFHLE9BQU8sQ0FBQztBQUNoRCxDQUFDO0FBRUQscUJBQXFCO0FBQ3JCLHlEQUF5RDtBQUN6RCxNQUFNLFVBQVUsY0FBYyxDQUFDLE9BQW9CO0lBQ2xELE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLEdBQUcsU0FBUyxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNwRixPQUFPLE9BQU8sQ0FBQyxZQUFZLEdBQUcsTUFBTSxDQUFDO0FBQ3RDLENBQUM7QUFFRCxzRkFBc0Y7QUFDdEYsU0FBUyxlQUFlLENBQUMsT0FBb0IsRUFBRSxNQUFtQjtJQUNqRSxJQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUN0QixPQUFPLENBQUMsQ0FBQztJQUNWLENBQUM7SUFFRCxNQUFNLGVBQWUsR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNsRCxNQUFNLGNBQWMsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNoRCxPQUFPLGVBQWUsQ0FBQyxJQUFJLEdBQUcsY0FBYyxDQUFDLElBQUksQ0FBQztBQUNuRCxDQUFDO0FBRUQsTUFBTSxVQUFVLG9CQUFvQixDQUFDLE1BQW1CLEVBQUUsUUFBdUI7SUFDaEYsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO1FBQzFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsRUFBRSxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxlQUFlLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN6RyxDQUFDLENBQUMsQ0FBQztJQUNILE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxXQUFXLENBQUMsQ0FBQztJQUMxQyxPQUFPLFFBQVEsQ0FBQztBQUNqQixDQUFDO0FBRUQsMkZBQTJGO0FBRTNGLE1BQU0sVUFBVSxVQUFVLENBQUMsU0FBc0IsRUFBRSxZQUF5QjtJQUMzRSxPQUFPLE9BQU8sQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDbkQsQ0FBQztBQUVELE1BQU0sbUJBQW1CLEdBQUcsdUJBQXVCLENBQUM7QUFFcEQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLGVBQWUsQ0FBQyxnQkFBNkIsRUFBRSxlQUF3QjtJQUN0RixnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsR0FBRyxlQUFlLENBQUMsRUFBRSxDQUFDO0FBQ3BFLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUFDLElBQWlCO0lBQ2hELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUN6RCxJQUFJLE9BQU8sY0FBYyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQ3hDLGdEQUFnRDtRQUNoRCxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNiLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUscUJBQXFCLENBQUMsU0FBZSxFQUFFLFlBQWtCO0lBQ3hFLElBQUksSUFBSSxHQUFnQixTQUFTLENBQUM7SUFDbEMsT0FBTyxJQUFJLEVBQUUsQ0FBQztRQUNiLElBQUksSUFBSSxLQUFLLFlBQVksRUFBRSxDQUFDO1lBQzNCLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDekIsTUFBTSxtQkFBbUIsR0FBRyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN6RCxJQUFJLG1CQUFtQixFQUFFLENBQUM7Z0JBQ3pCLElBQUksR0FBRyxtQkFBbUIsQ0FBQztnQkFDM0IsU0FBUztZQUNWLENBQUM7UUFDRixDQUFDO1FBQ0QsSUFBSSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7SUFDeEIsQ0FBQztJQUVELE9BQU8sS0FBSyxDQUFDO0FBQ2QsQ0FBQztBQUVELE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxJQUFpQixFQUFFLEtBQWEsRUFBRSxpQkFBd0M7SUFDN0csT0FBTyxJQUFJLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDcEQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3BDLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUN2QixJQUFJLE9BQU8saUJBQWlCLEtBQUssUUFBUSxFQUFFLENBQUM7Z0JBQzNDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUMsRUFBRSxDQUFDO29CQUNoRCxPQUFPLElBQUksQ0FBQztnQkFDYixDQUFDO1lBQ0YsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLElBQUksSUFBSSxLQUFLLGlCQUFpQixFQUFFLENBQUM7b0JBQ2hDLE9BQU8sSUFBSSxDQUFDO2dCQUNiLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksR0FBZ0IsSUFBSSxDQUFDLFVBQVUsQ0FBQztJQUNyQyxDQUFDO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDYixDQUFDO0FBRUQsTUFBTSxVQUFVLGtCQUFrQixDQUFDLElBQWlCLEVBQUUsS0FBYSxFQUFFLGlCQUF3QztJQUM1RyxPQUFPLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLGlCQUFpQixDQUFDLENBQUM7QUFDOUQsQ0FBQztBQUVELE1BQU0sVUFBVSxZQUFZLENBQUMsSUFBVTtJQUN0QyxPQUFPLENBQ04sSUFBSSxJQUFJLENBQUMsQ0FBYyxJQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBYyxJQUFLLENBQUMsSUFBSSxDQUM5RCxDQUFDO0FBQ0gsQ0FBQztBQUVELE1BQU0sVUFBVSxhQUFhLENBQUMsT0FBYTtJQUMxQyxPQUFPLENBQUMsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDakMsQ0FBQztBQUVELE1BQU0sVUFBVSxhQUFhLENBQUMsT0FBYTtJQUMxQyxPQUFPLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUMzQixJQUFJLE9BQU8sS0FBSyxPQUFPLENBQUMsYUFBYSxFQUFFLElBQUksRUFBRSxDQUFDO1lBQzdDLG1CQUFtQjtZQUNuQixPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFDRCxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQztJQUM5QixDQUFDO0lBQ0QsT0FBTyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQy9DLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLGdCQUFnQjtJQUMvQixJQUFJLE1BQU0sR0FBRyxpQkFBaUIsRUFBRSxDQUFDLGFBQWEsQ0FBQztJQUUvQyxPQUFPLE1BQU0sRUFBRSxVQUFVLEVBQUUsQ0FBQztRQUMzQixNQUFNLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUM7SUFDMUMsQ0FBQztJQUVELE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsZUFBZSxDQUFDLE9BQWdCO0lBQy9DLE9BQU8sZ0JBQWdCLEVBQUUsS0FBSyxPQUFPLENBQUM7QUFDdkMsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSx5QkFBeUIsQ0FBQyxRQUFpQjtJQUMxRCxPQUFPLFVBQVUsQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ2pELENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsT0FBZ0I7SUFDaEQsT0FBTyxPQUFPLENBQUMsYUFBYSxLQUFLLGlCQUFpQixFQUFFLENBQUM7QUFDdEQsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsaUJBQWlCO0lBQ2hDLElBQUksZUFBZSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDNUIsT0FBTyxVQUFVLENBQUMsUUFBUSxDQUFDO0lBQzVCLENBQUM7SUFFRCxNQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ2hGLE9BQU8sU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxRQUFRLENBQUM7QUFDckUsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsZUFBZTtJQUM5QixNQUFNLFFBQVEsR0FBRyxpQkFBaUIsRUFBRSxDQUFDO0lBQ3JDLE9BQU8sQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLE1BQU0sSUFBSSxVQUFVLENBQWUsQ0FBQztBQUNuRSxDQUFDO0FBUUQsTUFBTSxDQUFDLE1BQU0sc0JBQXNCLEdBQUcsSUFBSTtJQUFBO1FBRWhDLHNCQUFpQixHQUFHLElBQUksR0FBRyxFQUF3QyxDQUFDO0lBMkM5RSxDQUFDO0lBekNBLE9BQU8sQ0FBQyxNQUFZLEVBQUUsV0FBNEIsRUFBRSxPQUE4QjtRQUNqRixJQUFJLDBCQUEwQixHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDcEUsSUFBSSxDQUFDLDBCQUEwQixFQUFFLENBQUM7WUFDakMsMEJBQTBCLEdBQUcsSUFBSSxHQUFHLEVBQTZCLENBQUM7WUFDbEUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsMEJBQTBCLENBQUMsQ0FBQztRQUNoRSxDQUFDO1FBRUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2xDLElBQUksMEJBQTBCLEdBQUcsMEJBQTBCLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzdFLElBQUksQ0FBQywwQkFBMEIsRUFBRSxDQUFDO1lBQ2pDLE1BQU0sV0FBVyxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBb0IsQ0FBQztZQUMxRCxNQUFNLFFBQVEsR0FBRyxJQUFJLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ2hGLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBRWxDLE1BQU0sa0NBQWtDLEdBQUcsMEJBQTBCLEdBQUc7Z0JBQ3ZFLEtBQUssRUFBRSxDQUFDO2dCQUNSLFFBQVE7Z0JBQ1IsV0FBVyxFQUFFLFdBQVcsQ0FBQyxLQUFLO2FBQzlCLENBQUM7WUFFRixXQUFXLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUU7Z0JBQ2pDLGtDQUFrQyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUM7Z0JBRTlDLElBQUksa0NBQWtDLENBQUMsS0FBSyxLQUFLLENBQUMsRUFBRSxDQUFDO29CQUNwRCxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQ3RCLFFBQVEsQ0FBQyxVQUFVLEVBQUUsQ0FBQztvQkFFdEIsMEJBQTBCLEVBQUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO29CQUNoRCxJQUFJLDBCQUEwQixFQUFFLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQzt3QkFDNUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDdkMsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUVKLDBCQUEwQixDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsMEJBQTBCLENBQUMsQ0FBQztRQUN6RSxDQUFDO2FBQU0sQ0FBQztZQUNQLDBCQUEwQixDQUFDLEtBQUssSUFBSSxDQUFDLENBQUM7UUFDdkMsQ0FBQztRQUVELE9BQU8sMEJBQTBCLENBQUMsV0FBVyxDQUFDO0lBQy9DLENBQUM7Q0FDRCxDQUFDO0FBRUYsTUFBTSxVQUFVLGlCQUFpQixDQUFDLFlBQXlCLFVBQVUsQ0FBQyxRQUFRLENBQUMsSUFBSTtJQUNsRixPQUFPLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztBQUM3QyxDQUFDO0FBRUQsTUFBTSxVQUFVLGlCQUFpQixDQUFDLFlBQXlCLFVBQVUsQ0FBQyxRQUFRLENBQUMsSUFBSTtJQUNsRixPQUFPLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztBQUM3QyxDQUFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBd0MsT0FBVSxFQUFFLFlBQXlCLFVBQVUsQ0FBQyxRQUFRLENBQUMsSUFBSTtJQUM5SCxNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2hELFNBQVMsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDL0IsT0FBTyxPQUFPLENBQUM7QUFDaEIsQ0FBQztBQUVELE1BQU0sVUFBVSxhQUFhLENBQUMsQ0FBVTtJQUN2QyxnREFBZ0Q7SUFDaEQsT0FBTyxDQUFDLFlBQVksV0FBVyxJQUFJLENBQUMsWUFBWSxTQUFTLENBQUMsQ0FBUyxDQUFDLENBQUMsV0FBVyxDQUFDO0FBQ2xGLENBQUM7QUFFRCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsQ0FBVTtJQUM3QyxnREFBZ0Q7SUFDaEQsT0FBTyxDQUFDLFlBQVksaUJBQWlCLElBQUksQ0FBQyxZQUFZLFNBQVMsQ0FBQyxDQUFTLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQztBQUM5RixDQUFDO0FBRUQsTUFBTSxVQUFVLGlCQUFpQixDQUFDLENBQVU7SUFDM0MsZ0RBQWdEO0lBQ2hELE9BQU8sQ0FBQyxZQUFZLGVBQWUsSUFBSSxDQUFDLFlBQVksU0FBUyxDQUFDLENBQVMsQ0FBQyxDQUFDLGVBQWUsQ0FBQztBQUMxRixDQUFDO0FBRUQsTUFBTSxVQUFVLHFCQUFxQixDQUFDLENBQVU7SUFDL0MsZ0RBQWdEO0lBQ2hELE9BQU8sQ0FBQyxZQUFZLG1CQUFtQixJQUFJLENBQUMsWUFBWSxTQUFTLENBQUMsQ0FBUyxDQUFDLENBQUMsbUJBQW1CLENBQUM7QUFDbEcsQ0FBQztBQUVELE1BQU0sVUFBVSxrQkFBa0IsQ0FBQyxDQUFVO0lBQzVDLGdEQUFnRDtJQUNoRCxPQUFPLENBQUMsWUFBWSxnQkFBZ0IsSUFBSSxDQUFDLFlBQVksU0FBUyxDQUFDLENBQVMsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0FBQzVGLENBQUM7QUFFRCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsQ0FBVTtJQUM3QyxnREFBZ0Q7SUFDaEQsT0FBTyxDQUFDLFlBQVksaUJBQWlCLElBQUksQ0FBQyxZQUFZLFNBQVMsQ0FBQyxDQUFTLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQztBQUM5RixDQUFDO0FBRUQsTUFBTSxVQUFVLGdCQUFnQixDQUFDLENBQVU7SUFDMUMsZ0RBQWdEO0lBQ2hELE9BQU8sQ0FBQyxZQUFZLGNBQWMsSUFBSSxDQUFDLFlBQVksU0FBUyxDQUFDLENBQVMsQ0FBQyxDQUFDLGNBQWMsQ0FBQztBQUN4RixDQUFDO0FBRUQsTUFBTSxVQUFVLFlBQVksQ0FBQyxDQUFVO0lBQ3RDLGdEQUFnRDtJQUNoRCxPQUFPLENBQUMsWUFBWSxVQUFVLElBQUksQ0FBQyxZQUFZLFNBQVMsQ0FBQyxDQUFTLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDaEYsQ0FBQztBQUVELE1BQU0sVUFBVSxZQUFZLENBQUMsQ0FBVTtJQUN0QyxnREFBZ0Q7SUFDaEQsT0FBTyxDQUFDLFlBQVksVUFBVSxJQUFJLENBQUMsWUFBWSxTQUFTLENBQUMsQ0FBWSxDQUFDLENBQUMsVUFBVSxDQUFDO0FBQ25GLENBQUM7QUFFRCxNQUFNLFVBQVUsZUFBZSxDQUFDLENBQVU7SUFDekMsZ0RBQWdEO0lBQ2hELE9BQU8sQ0FBQyxZQUFZLGFBQWEsSUFBSSxDQUFDLFlBQVksU0FBUyxDQUFDLENBQVksQ0FBQyxDQUFDLGFBQWEsQ0FBQztBQUN6RixDQUFDO0FBRUQsTUFBTSxVQUFVLGNBQWMsQ0FBQyxDQUFVO0lBQ3hDLGdEQUFnRDtJQUNoRCxPQUFPLENBQUMsWUFBWSxZQUFZLElBQUksQ0FBQyxZQUFZLFNBQVMsQ0FBQyxDQUFZLENBQUMsQ0FBQyxZQUFZLENBQUM7QUFDdkYsQ0FBQztBQUVELE1BQU0sVUFBVSxXQUFXLENBQUMsQ0FBVTtJQUNyQyxnREFBZ0Q7SUFDaEQsT0FBTyxDQUFDLFlBQVksU0FBUyxJQUFJLENBQUMsWUFBWSxTQUFTLENBQUMsQ0FBWSxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ2pGLENBQUM7QUFFRCxNQUFNLENBQUMsTUFBTSxTQUFTLEdBQUc7SUFDeEIsUUFBUTtJQUNSLEtBQUssRUFBRSxPQUFPO0lBQ2QsUUFBUSxFQUFFLFVBQVU7SUFDcEIsUUFBUSxFQUFFLFVBQVU7SUFDcEIsUUFBUSxFQUFFLFNBQVM7SUFDbkIsVUFBVSxFQUFFLFdBQVc7SUFDdkIsVUFBVSxFQUFFLFdBQVc7SUFDdkIsVUFBVSxFQUFFLFdBQVc7SUFDdkIsU0FBUyxFQUFFLFVBQVU7SUFDckIsV0FBVyxFQUFFLFlBQVk7SUFDekIsV0FBVyxFQUFFLFlBQVk7SUFDekIsV0FBVyxFQUFFLE9BQU87SUFDcEIsVUFBVSxFQUFFLFdBQVc7SUFDdkIsWUFBWSxFQUFFLGFBQWE7SUFDM0IsWUFBWSxFQUFFLGFBQWE7SUFDM0IsYUFBYSxFQUFFLGNBQWM7SUFDN0IsWUFBWSxFQUFFLGFBQWE7SUFDM0IsS0FBSyxFQUFFLE9BQU87SUFDZCxXQUFXO0lBQ1gsUUFBUSxFQUFFLFNBQVM7SUFDbkIsU0FBUyxFQUFFLFVBQVU7SUFDckIsTUFBTSxFQUFFLE9BQU87SUFDZixnQkFBZ0I7SUFDaEIsSUFBSSxFQUFFLE1BQU07SUFDWixhQUFhLEVBQUUsY0FBYztJQUM3QixNQUFNLEVBQUUsUUFBUTtJQUNoQixTQUFTLEVBQUUsVUFBVTtJQUNyQixTQUFTLEVBQUUsVUFBVTtJQUNyQixLQUFLLEVBQUUsT0FBTztJQUNkLEtBQUssRUFBRSxPQUFPO0lBQ2QsS0FBSyxFQUFFLE9BQU87SUFDZCxNQUFNLEVBQUUsUUFBUTtJQUNoQixNQUFNLEVBQUUsUUFBUTtJQUNoQixpQkFBaUIsRUFBRSxrQkFBa0I7SUFDckMsb0JBQW9CLEVBQUUsd0JBQXdCO0lBQzlDLE9BQU87SUFDUCxNQUFNLEVBQUUsUUFBUTtJQUNoQixNQUFNLEVBQUUsUUFBUTtJQUNoQixNQUFNLEVBQUUsUUFBUTtJQUNoQixLQUFLLEVBQUUsT0FBTztJQUNkLEtBQUssRUFBRSxPQUFPO0lBQ2QsUUFBUSxFQUFFLFNBQVM7SUFDbkIsU0FBUyxFQUFFLFVBQVU7SUFDckIsSUFBSSxFQUFFLE1BQU07SUFDWixLQUFLLEVBQUUsT0FBTztJQUNkLGdCQUFnQjtJQUNoQixPQUFPLEVBQUUsU0FBUztJQUNsQixPQUFPO0lBQ1AsVUFBVSxFQUFFLFdBQVc7SUFDdkIsSUFBSSxFQUFFLE1BQU07SUFDWixVQUFVLEVBQUUsV0FBVztJQUN2QixVQUFVLEVBQUUsV0FBVztJQUN2QixTQUFTLEVBQUUsVUFBVTtJQUNyQixJQUFJLEVBQUUsTUFBTTtJQUNaLFFBQVEsRUFBRSxTQUFTO0lBQ25CLFlBQVk7SUFDWixlQUFlLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLGdCQUFnQjtJQUM3RSxhQUFhLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLGNBQWM7SUFDdkUsbUJBQW1CLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDLG9CQUFvQjtDQUNoRixDQUFDO0FBT1gsTUFBTSxVQUFVLFdBQVcsQ0FBQyxHQUFZO0lBQ3ZDLE1BQU0sU0FBUyxHQUFHLEdBQTRCLENBQUM7SUFFL0MsT0FBTyxDQUFDLENBQUMsQ0FBQyxTQUFTLElBQUksT0FBTyxTQUFTLENBQUMsY0FBYyxLQUFLLFVBQVUsSUFBSSxPQUFPLFNBQVMsQ0FBQyxlQUFlLEtBQUssVUFBVSxDQUFDLENBQUM7QUFDM0gsQ0FBQztBQUVELE1BQU0sQ0FBQyxNQUFNLFdBQVcsR0FBRztJQUMxQixJQUFJLEVBQUUsQ0FBc0IsQ0FBSSxFQUFFLFlBQXNCLEVBQUssRUFBRTtRQUM5RCxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDbkIsSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUNsQixDQUFDLENBQUMsZUFBZSxFQUFFLENBQUM7UUFDckIsQ0FBQztRQUNELE9BQU8sQ0FBQyxDQUFDO0lBQ1YsQ0FBQztDQUNELENBQUM7QUFRRixNQUFNLFVBQVUsb0JBQW9CLENBQUMsSUFBYTtJQUNqRCxNQUFNLENBQUMsR0FBYSxFQUFFLENBQUM7SUFDdkIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ2xFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ3RCLElBQUksR0FBWSxJQUFJLENBQUMsVUFBVSxDQUFDO0lBQ2pDLENBQUM7SUFDRCxPQUFPLENBQUMsQ0FBQztBQUNWLENBQUM7QUFFRCxNQUFNLFVBQVUsdUJBQXVCLENBQUMsSUFBYSxFQUFFLEtBQWU7SUFDckUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ2xFLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMzQixDQUFDO1FBQ0QsSUFBSSxHQUFZLElBQUksQ0FBQyxVQUFVLENBQUM7SUFDakMsQ0FBQztBQUNGLENBQUM7QUFFRCxNQUFNLFlBQWEsU0FBUSxVQUFVO0lBR3BDLElBQUksVUFBVSxLQUFLLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBR25ELElBQUksU0FBUyxLQUFLLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBSXpDLE1BQU0sQ0FBQyxjQUFjLENBQUMsT0FBNkI7UUFDMUQsSUFBSSxhQUFhLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUM1QixNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDMUMsTUFBTSxhQUFhLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDcEcsT0FBTyxVQUFVLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzNDLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDO1lBQ3ZCLE9BQU8sVUFBVSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNuRSxDQUFDO0lBQ0YsQ0FBQztJQUVELFlBQVksT0FBNkI7UUFDeEMsS0FBSyxFQUFFLENBQUM7UUFwQlEsZ0JBQVcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFHeEQsZUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFRLENBQUMsQ0FBQztRQWtCdkUsSUFBSSxRQUFRLEdBQUcsWUFBWSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwRCxJQUFJLFlBQVksR0FBRyxLQUFLLENBQUM7UUFFekIsTUFBTSxPQUFPLEdBQUcsR0FBRyxFQUFFO1lBQ3BCLFlBQVksR0FBRyxLQUFLLENBQUM7WUFDckIsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNmLFFBQVEsR0FBRyxJQUFJLENBQUM7Z0JBQ2hCLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDekIsQ0FBQztRQUNGLENBQUMsQ0FBQztRQUVGLE1BQU0sTUFBTSxHQUFHLEdBQUcsRUFBRTtZQUNuQixJQUFJLFFBQVEsRUFBRSxDQUFDO2dCQUNkLFlBQVksR0FBRyxJQUFJLENBQUM7Z0JBQ3BCLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUU7b0JBQ3ZFLElBQUksWUFBWSxFQUFFLENBQUM7d0JBQ2xCLFlBQVksR0FBRyxLQUFLLENBQUM7d0JBQ3JCLFFBQVEsR0FBRyxLQUFLLENBQUM7d0JBQ2pCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBQ3hCLENBQUM7Z0JBQ0YsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQztRQUNGLENBQUMsQ0FBQztRQUVGLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxHQUFHLEVBQUU7WUFDaEMsTUFBTSxtQkFBbUIsR0FBRyxZQUFZLENBQUMsY0FBYyxDQUFjLE9BQU8sQ0FBQyxDQUFDO1lBQzlFLElBQUksbUJBQW1CLEtBQUssUUFBUSxFQUFFLENBQUM7Z0JBQ3RDLElBQUksUUFBUSxFQUFFLENBQUM7b0JBQ2QsTUFBTSxFQUFFLENBQUM7Z0JBQ1YsQ0FBQztxQkFBTSxDQUFDO29CQUNQLE9BQU8sRUFBRSxDQUFDO2dCQUNYLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQyxDQUFDO1FBRUYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUMvRSxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQzdFLElBQUksYUFBYSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDNUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDdEcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDeEcsQ0FBQztJQUVGLENBQUM7SUFFRCxZQUFZO1FBQ1gsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7SUFDN0IsQ0FBQztDQUNEO0FBRUQ7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUsVUFBVSxDQUFDLE9BQTZCO0lBQ3ZELE9BQU8sSUFBSSxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDbEMsQ0FBQztBQUVELE1BQU0sVUFBVSxLQUFLLENBQWlCLE9BQW9CLEVBQUUsS0FBUTtJQUNuRSxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3JCLE9BQU8sS0FBSyxDQUFDO0FBQ2QsQ0FBQztBQUlELE1BQU0sVUFBVSxNQUFNLENBQWlCLE1BQW1CLEVBQUUsR0FBRyxRQUF3QjtJQUN0RixNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUM7SUFDM0IsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxPQUFPLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUM5RCxPQUFPLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwQixDQUFDO0FBQ0YsQ0FBQztBQUVELE1BQU0sVUFBVSxPQUFPLENBQWlCLE1BQW1CLEVBQUUsS0FBUTtJQUNwRSxNQUFNLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDOUMsT0FBTyxLQUFLLENBQUM7QUFDZCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsS0FBSyxDQUFDLE1BQW1CLEVBQUUsR0FBRyxRQUE4QjtJQUMzRSxNQUFNLENBQUMsV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUN4QixNQUFNLENBQUMsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLENBQUM7QUFDN0IsQ0FBQztBQUVELE1BQU0sY0FBYyxHQUFHLHlDQUF5QyxDQUFDO0FBRWpFLE1BQU0sQ0FBTixJQUFZLFNBR1g7QUFIRCxXQUFZLFNBQVM7SUFDcEIsa0RBQXFDLENBQUE7SUFDckMsK0NBQWtDLENBQUE7QUFDbkMsQ0FBQyxFQUhXLFNBQVMsS0FBVCxTQUFTLFFBR3BCO0FBRUQsU0FBUyxFQUFFLENBQW9CLFNBQW9CLEVBQUUsV0FBbUIsRUFBRSxLQUE4QixFQUFFLEdBQUcsUUFBOEI7SUFDMUksTUFBTSxLQUFLLEdBQUcsY0FBYyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUUvQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDWixNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVELE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUM7SUFDbEMsSUFBSSxNQUFTLENBQUM7SUFFZCxJQUFJLFNBQVMsS0FBSyxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDbEMsTUFBTSxHQUFHLFFBQVEsQ0FBQyxlQUFlLENBQUMsU0FBbUIsRUFBRSxPQUFPLENBQU0sQ0FBQztJQUN0RSxDQUFDO1NBQU0sQ0FBQztRQUNQLE1BQU0sR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBaUIsQ0FBQztJQUMxRCxDQUFDO0lBRUQsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNkLE1BQU0sQ0FBQyxFQUFFLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RCLENBQUM7SUFDRCxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ2QsTUFBTSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUN4RCxDQUFDO0lBRUQsSUFBSSxLQUFLLEVBQUUsQ0FBQztRQUNYLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRTtZQUMvQyxJQUFJLE9BQU8sS0FBSyxLQUFLLFdBQVcsRUFBRSxDQUFDO2dCQUNsQyxPQUFPO1lBQ1IsQ0FBQztZQUVELElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUMxQixtREFBbUQ7Z0JBQzdDLE1BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUM7WUFDN0IsQ0FBQztpQkFBTSxJQUFJLElBQUksS0FBSyxVQUFVLEVBQUUsQ0FBQztnQkFDaEMsSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDWCxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDbkMsQ0FBQztZQUVGLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNsQyxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDO0lBRTNCLE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVELE1BQU0sVUFBVSxDQUFDLENBQXdCLFdBQW1CLEVBQUUsS0FBOEIsRUFBRSxHQUFHLFFBQThCO0lBQzlILE9BQU8sRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxHQUFHLFFBQVEsQ0FBQyxDQUFDO0FBQzVELENBQUM7QUFFRCxDQUFDLENBQUMsR0FBRyxHQUFHLFVBQWdDLFdBQW1CLEVBQUUsS0FBOEIsRUFBRSxHQUFHLFFBQThCO0lBQzdILE9BQU8sRUFBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxHQUFHLFFBQVEsQ0FBQyxDQUFDO0FBQzNELENBQUMsQ0FBQztBQUVGLE1BQU0sVUFBVSxJQUFJLENBQUMsS0FBYSxFQUFFLFNBQXdCO0lBQzNELE1BQU0sTUFBTSxHQUFXLEVBQUUsQ0FBQztJQUUxQixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFO1FBQzdCLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ2YsSUFBSSxTQUFTLFlBQVksSUFBSSxFQUFFLENBQUM7Z0JBQy9CLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFDcEMsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ2pELENBQUM7UUFDRixDQUFDO1FBRUQsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNuQixDQUFDLENBQUMsQ0FBQztJQUVILE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVELE1BQU0sVUFBVSxhQUFhLENBQUMsT0FBZ0IsRUFBRSxHQUFHLFFBQXVCO0lBQ3pFLElBQUksT0FBTyxFQUFFLENBQUM7UUFDYixJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQztJQUNuQixDQUFDO1NBQU0sQ0FBQztRQUNQLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDO0lBQ25CLENBQUM7QUFDRixDQUFDO0FBRUQsTUFBTSxVQUFVLElBQUksQ0FBQyxHQUFHLFFBQXVCO0lBQzlDLEtBQUssTUFBTSxPQUFPLElBQUksUUFBUSxFQUFFLENBQUM7UUFDaEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQzNCLE9BQU8sQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDeEMsQ0FBQztBQUNGLENBQUM7QUFFRCxNQUFNLFVBQVUsSUFBSSxDQUFDLEdBQUcsUUFBdUI7SUFDOUMsS0FBSyxNQUFNLE9BQU8sSUFBSSxRQUFRLEVBQUUsQ0FBQztRQUNoQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFDL0IsT0FBTyxDQUFDLFlBQVksQ0FBQyxhQUFhLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDN0MsQ0FBQztBQUNGLENBQUM7QUFFRCxTQUFTLHVCQUF1QixDQUFDLElBQWlCLEVBQUUsU0FBaUI7SUFDcEUsT0FBTyxJQUFJLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDcEQsSUFBSSxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQ3pELE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELElBQUksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO0lBQ3hCLENBQUM7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNiLENBQUM7QUFFRCxNQUFNLFVBQVUsNEJBQTRCLENBQUMsSUFBaUI7SUFDN0QsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztRQUM3QyxPQUFPO0lBQ1IsQ0FBQztJQUVELG1FQUFtRTtJQUNuRSxtRUFBbUU7SUFDbkUscUVBQXFFO0lBQ3JFLDRDQUE0QztJQUM1QyxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxLQUFLLElBQUksRUFBRSxDQUFDO1FBQy9DLE1BQU0sZUFBZSxHQUFHLHVCQUF1QixDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDaEYsZUFBZSxFQUFFLEtBQUssRUFBRSxDQUFDO0lBQzFCLENBQUM7SUFFRCxJQUFJLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ2xDLENBQUM7QUFFRCxNQUFNLFVBQVUsWUFBWSxDQUFrQixFQUF5QjtJQUN0RSxPQUFPLENBQUMsQ0FBQyxFQUFFO1FBQ1YsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ25CLENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUNwQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDLENBQUM7QUFDSCxDQUFDO0FBRUQsTUFBTSxVQUFVLGdCQUFnQixDQUFDLFlBQW9CO0lBQ3BELE9BQU8sSUFBSSxPQUFPLENBQU8sT0FBTyxDQUFDLEVBQUU7UUFDbEMsTUFBTSxVQUFVLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFDcEQsSUFBSSxVQUFVLEtBQUssVUFBVSxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ2pHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNwQixDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sUUFBUSxHQUFHLEdBQUcsRUFBRTtnQkFDckIsWUFBWSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxrQkFBa0IsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQzdFLE9BQU8sRUFBRSxDQUFDO1lBQ1gsQ0FBQyxDQUFDO1lBRUYsWUFBWSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxrQkFBa0IsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDM0UsQ0FBQztJQUNGLENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsc0JBQXNCLENBQUMsTUFBYyxFQUFFLEtBQWE7SUFDbkUsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixHQUFHLEtBQUssQ0FBQztJQUNqRCxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7QUFDcEUsQ0FBQztBQUVEOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsR0FBVztJQUM3QyxzRkFBc0Y7SUFDdEYsd0VBQXdFO0lBQ3hFLDJDQUEyQztJQUMzQyw0RUFBNEU7SUFDNUUsd0VBQXdFO0lBQ3hFLDhCQUE4QjtJQUM5QixVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDNUMsQ0FBQztBQUVEOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFNLFVBQVUsR0FBRyxHQUFHLEVBQUUsV0FBVyxHQUFHLEdBQUcsQ0FBQztBQUMxQyxNQUFNLFVBQVUsZUFBZSxDQUFDLEdBQVc7SUFDMUMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxHQUFHLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUM1RixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDLFdBQVcsR0FBRyxDQUFDLEdBQUcsV0FBVyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzVGLFVBQVUsQ0FBQyxJQUFJLENBQ2QsR0FBRyxFQUNILFFBQVEsRUFDUixTQUFTLFVBQVUsV0FBVyxXQUFXLFFBQVEsR0FBRyxTQUFTLElBQUksRUFBRSxDQUNuRSxDQUFDO0FBQ0gsQ0FBQztBQUVEOzs7Ozs7Ozs7Ozs7OztHQWNHO0FBQ0gsTUFBTSxVQUFVLHFCQUFxQixDQUFDLEdBQVcsRUFBRSxRQUFRLEdBQUcsSUFBSTtJQUNqRSxNQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDakMsSUFBSSxNQUFNLEVBQUUsQ0FBQztRQUNaLElBQUksUUFBUSxFQUFFLENBQUM7WUFDZCxnRUFBZ0U7WUFDaEUsbURBQW1EO1lBQ2xELE1BQWMsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO1FBQy9CLENBQUM7UUFDRCxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksR0FBRyxHQUFHLENBQUM7UUFDM0IsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZCxDQUFDO0FBRUQsTUFBTSxVQUFVLE9BQU8sQ0FBQyxZQUFvQixFQUFFLEVBQWM7SUFDM0QsTUFBTSxJQUFJLEdBQUcsR0FBRyxFQUFFO1FBQ2pCLEVBQUUsRUFBRSxDQUFDO1FBQ0wsY0FBYyxHQUFHLDRCQUE0QixDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNuRSxDQUFDLENBQUM7SUFFRixJQUFJLGNBQWMsR0FBRyw0QkFBNEIsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDdEUsT0FBTyxZQUFZLENBQUMsR0FBRyxFQUFFLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDckQsQ0FBQztBQUVELGlCQUFpQixDQUFDLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUVyRyxNQUFNLFVBQVUsZUFBZSxDQUFDLFNBQTJCLEVBQUUsSUFBWTtJQUV4RSxpREFBaUQ7SUFDakQsNkNBQTZDO0lBQzdDLElBQUksR0FBVyxDQUFDO0lBQ2hCLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1FBQzFCLEdBQUcsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hDLENBQUM7U0FBTSxDQUFDO1FBQ1AsTUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxTQUFvQyxDQUFDLENBQUMsQ0FBQztRQUM5RCxHQUFHLEdBQUcsR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVoQyw4Q0FBOEM7UUFDOUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBRUQsNERBQTREO0lBQzVELDREQUE0RDtJQUM1RCxrQ0FBa0M7SUFDbEMsdUdBQXVHO0lBQ3ZHLE1BQU0sWUFBWSxHQUFHLGVBQWUsRUFBRSxDQUFDO0lBQ3ZDLE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDM0MsWUFBWSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQy9DLE1BQU0sQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO0lBQ3ZCLE1BQU0sQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDO0lBQ2xCLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUVmLG1EQUFtRDtJQUNuRCxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDbkMsQ0FBQztBQUVELE1BQU0sVUFBVSxhQUFhO0lBQzVCLE9BQU8sSUFBSSxPQUFPLENBQXVCLE9BQU8sQ0FBQyxFQUFFO1FBRWxELDhDQUE4QztRQUM5Qyw0Q0FBNEM7UUFDNUMsK0JBQStCO1FBQy9CLE1BQU0sWUFBWSxHQUFHLGVBQWUsRUFBRSxDQUFDO1FBQ3ZDLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDOUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzlDLEtBQUssQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDO1FBQ3BCLEtBQUssQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBRXRCLDhDQUE4QztRQUM5QyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLG1CQUFtQixDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRTtZQUN0RSxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssSUFBSSxTQUFTLENBQUMsQ0FBQztRQUNuQyxDQUFDLENBQUMsQ0FBQztRQUVILEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUVkLG1EQUFtRDtRQUNuRCxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDbEMsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDO0FBTUQsU0FBUyx3QkFBd0IsQ0FBQyxJQUFZO0lBQzdDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxxQ0FBcUM7QUFDdkUsQ0FBQztBQUVELE1BQU0sQ0FBQyxLQUFLLFVBQVUsbUJBQW1CLENBQUMsT0FBZSxFQUFFLE9BQStDO0lBQ3pHLE1BQU0sVUFBVSxHQUFHLE1BQU0sWUFBWSxDQUFDLGlCQUFpQixFQUFFLENBQUM7SUFDMUQsSUFBSSxVQUFVLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDOUIsT0FBTztJQUNSLENBQUM7SUFFRCxNQUFNLFdBQVcsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO0lBRTFDLE1BQU0sWUFBWSxHQUFHLElBQUksWUFBWSxDQUFDLHdCQUF3QixDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQ3hFLElBQUksRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyx3QkFBd0IsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7UUFDNUUsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLE1BQU07S0FDbkMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxPQUFPLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFRLENBQUM7SUFDMUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxZQUFZLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDcEYsV0FBVyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxZQUFZLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFM0YsV0FBVyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztJQUUxRCxPQUFPO1FBQ04sT0FBTyxFQUFFLE9BQU8sQ0FBQyxLQUFLO1FBQ3RCLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFO0tBQ3BDLENBQUM7QUFDSCxDQUFDO0FBRUQsTUFBTSxDQUFOLElBQVksc0JBYVg7QUFiRCxXQUFZLHNCQUFzQjtJQUVqQzs7O09BR0c7SUFDSCwyRUFBWSxDQUFBO0lBRVo7OztPQUdHO0lBQ0gseUVBQU8sQ0FBQTtBQUNSLENBQUMsRUFiVyxzQkFBc0IsS0FBdEIsc0JBQXNCLFFBYWpDO0FBZ0JELE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxZQUFvQjtJQUVwRCw2Q0FBNkM7SUFDN0MsbURBQW1EO0lBQ25ELElBQUksWUFBWSxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsSUFBVSxZQUFZLENBQUMsUUFBUyxDQUFDLHVCQUF1QixJQUFVLFlBQVksQ0FBQyxRQUFTLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUN4SixPQUFPLEVBQUUsSUFBSSxFQUFFLHNCQUFzQixDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUM7SUFDaEUsQ0FBQztJQUVELHdEQUF3RDtJQUN4RCxxREFBcUQ7SUFDckQsMkRBQTJEO0lBQzNELGFBQWE7SUFFYixJQUFJLFlBQVksQ0FBQyxXQUFXLEtBQUssWUFBWSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUM3RCxnRUFBZ0U7UUFDaEUsa0VBQWtFO1FBQ2xFLHFEQUFxRDtRQUNyRCxPQUFPLEVBQUUsSUFBSSxFQUFFLHNCQUFzQixDQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUM7SUFDL0QsQ0FBQztJQUVELElBQUksUUFBUSxDQUFDLFdBQVcsSUFBSSxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDOUMsMEVBQTBFO1FBQzFFLElBQUksWUFBWSxDQUFDLFdBQVcsS0FBSyxZQUFZLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxZQUFZLENBQUMsVUFBVSxLQUFLLFlBQVksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDdEgsaUVBQWlFO1lBQ2pFLGlFQUFpRTtZQUNqRSxnRUFBZ0U7WUFDaEUscURBQXFEO1lBQ3JELE9BQU8sRUFBRSxJQUFJLEVBQUUsc0JBQXNCLENBQUMsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUM5RCxDQUFDO0lBQ0YsQ0FBQztJQUVELG9CQUFvQjtJQUNwQixPQUFPLElBQUksQ0FBQztBQUNiLENBQUM7QUFjRCxNQUFNLE9BQU8sa0JBQW1CLFNBQVEsS0FBSyxDQUFDLE9BQTJCO0lBTXhFO1FBQ0MsS0FBSyxFQUFFLENBQUM7UUFMUSxtQkFBYyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFPdkQsSUFBSSxDQUFDLFVBQVUsR0FBRztZQUNqQixNQUFNLEVBQUUsS0FBSztZQUNiLFFBQVEsRUFBRSxLQUFLO1lBQ2YsT0FBTyxFQUFFLEtBQUs7WUFDZCxPQUFPLEVBQUUsS0FBSztTQUNkLENBQUM7UUFFRixJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMvTSxDQUFDO0lBRU8saUJBQWlCLENBQUMsTUFBYyxFQUFFLFdBQTRCO1FBQ3JFLFdBQVcsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUM1RCxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO2dCQUN4QixPQUFPO1lBQ1IsQ0FBQztZQUVELE1BQU0sS0FBSyxHQUFHLElBQUkscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0MsMERBQTBEO1lBQzFELCtEQUErRDtZQUMvRCxJQUFJLEtBQUssQ0FBQyxPQUFPLHdCQUFnQixJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDL0MsT0FBTztZQUNSLENBQUM7WUFFRCxJQUFJLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUN6QyxJQUFJLENBQUMsVUFBVSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUM7WUFDeEMsQ0FBQztpQkFBTSxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNsRCxJQUFJLENBQUMsVUFBVSxDQUFDLGNBQWMsR0FBRyxNQUFNLENBQUM7WUFDekMsQ0FBQztpQkFBTSxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNsRCxJQUFJLENBQUMsVUFBVSxDQUFDLGNBQWMsR0FBRyxNQUFNLENBQUM7WUFDekMsQ0FBQztpQkFBTSxJQUFJLENBQUMsQ0FBQyxRQUFRLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNwRCxJQUFJLENBQUMsVUFBVSxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUM7WUFDMUMsQ0FBQztpQkFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLHdCQUFnQixFQUFFLENBQUM7Z0JBQzFDLElBQUksQ0FBQyxVQUFVLENBQUMsY0FBYyxHQUFHLFNBQVMsQ0FBQztZQUM1QyxDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsT0FBTztZQUNSLENBQUM7WUFFRCxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUM7WUFDcEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQztZQUNwQyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDO1lBRXRDLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFDcEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO2dCQUMxQixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUM1QixDQUFDO1FBQ0YsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFVixXQUFXLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLEVBQUU7WUFDMUQsSUFBSSxDQUFDLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDeEIsT0FBTztZQUNSLENBQUM7WUFFRCxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUN6QyxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsR0FBRyxLQUFLLENBQUM7WUFDekMsQ0FBQztpQkFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNsRCxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsR0FBRyxNQUFNLENBQUM7WUFDMUMsQ0FBQztpQkFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNsRCxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsR0FBRyxNQUFNLENBQUM7WUFDMUMsQ0FBQztpQkFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNwRCxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsR0FBRyxPQUFPLENBQUM7WUFDM0MsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxHQUFHLFNBQVMsQ0FBQztZQUM3QyxDQUFDO1lBRUQsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLGNBQWMsS0FBSyxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUN4RSxJQUFJLENBQUMsVUFBVSxDQUFDLGNBQWMsR0FBRyxTQUFTLENBQUM7WUFDNUMsQ0FBQztZQUVELElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUM7WUFDbEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQztZQUNwQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDO1lBQ3BDLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUM7WUFFdEMsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUNyQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7Z0JBQzFCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQzVCLENBQUM7UUFDRixDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUVWLFdBQVcsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLEdBQUcsRUFBRTtZQUM3RSxJQUFJLENBQUMsVUFBVSxDQUFDLGNBQWMsR0FBRyxTQUFTLENBQUM7UUFDNUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFVixXQUFXLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUU7WUFDM0UsSUFBSSxDQUFDLFVBQVUsQ0FBQyxjQUFjLEdBQUcsU0FBUyxDQUFDO1FBQzVDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRVYsV0FBVyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDLEVBQUU7WUFDNUUsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2YsSUFBSSxDQUFDLFVBQVUsQ0FBQyxjQUFjLEdBQUcsU0FBUyxDQUFDO1lBQzVDLENBQUM7UUFDRixDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUVWLFdBQVcsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUU7WUFDMUQsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3ZCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsSUFBSSxTQUFTO1FBQ1osT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO0lBQ3hCLENBQUM7SUFFRCxJQUFJLGlCQUFpQjtRQUNwQixPQUFPLGVBQWUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsY0FBYztRQUNiLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFFTyxnQkFBZ0I7UUFDdkIsSUFBSSxDQUFDLFVBQVUsR0FBRztZQUNqQixNQUFNLEVBQUUsS0FBSztZQUNiLFFBQVEsRUFBRSxLQUFLO1lBQ2YsT0FBTyxFQUFFLEtBQUs7WUFDZCxPQUFPLEVBQUUsS0FBSztTQUNkLENBQUM7SUFDSCxDQUFDO0lBRUQsTUFBTSxDQUFDLFdBQVc7UUFDakIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2xDLGtCQUFrQixDQUFDLFFBQVEsR0FBRyxJQUFJLGtCQUFrQixFQUFFLENBQUM7UUFDeEQsQ0FBQztRQUVELE9BQU8sa0JBQWtCLENBQUMsUUFBUSxDQUFDO0lBQ3BDLENBQUM7SUFFRCxNQUFNLENBQUMsZUFBZTtRQUNyQixJQUFJLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2pDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN0QyxrQkFBa0IsQ0FBQyxRQUFRLEdBQUcsU0FBUyxDQUFDO1FBQ3pDLENBQUM7SUFDRixDQUFDO0lBRVEsT0FBTztRQUNmLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNoQixJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQy9CLENBQUM7Q0FDRDtBQUVELE1BQU0sVUFBVSxjQUFjLENBQUMsSUFBWTtJQUMxQyxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsSUFBSSxHQUFHLGtCQUFrQixDQUFDLENBQUMsQ0FBQywyQ0FBMkM7SUFFN0gsT0FBTyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ3hDLENBQUM7QUFZRCxNQUFNLE9BQU8sbUJBQW9CLFNBQVEsVUFBVTtJQVdsRCxZQUE2QixPQUFvQixFQUFtQixTQUF3QztRQUMzRyxLQUFLLEVBQUUsQ0FBQztRQURvQixZQUFPLEdBQVAsT0FBTyxDQUFhO1FBQW1CLGNBQVMsR0FBVCxTQUFTLENBQStCO1FBVDVHLCtEQUErRDtRQUMvRCw2REFBNkQ7UUFDN0QsaUVBQWlFO1FBQ2pFLGNBQWM7UUFDTixZQUFPLEdBQVcsQ0FBQyxDQUFDO1FBRTVCLHdEQUF3RDtRQUNoRCxrQkFBYSxHQUFHLENBQUMsQ0FBQztRQUt6QixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztJQUMxQixDQUFDO0lBRU8saUJBQWlCO1FBQ3hCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNoQyxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQVksRUFBRSxFQUFFO2dCQUN6RixJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzNCLElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBWSxFQUFFLEVBQUU7Z0JBQ25GLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQVksRUFBRSxFQUFFO1lBQ3pGLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUVqQyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQVksRUFBRSxFQUFFO1lBQ3hGLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLHFIQUFxSDtZQUV6SSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNsRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFZLEVBQUUsRUFBRTtZQUN6RixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFFZixJQUFJLElBQUksQ0FBQyxPQUFPLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ3hCLElBQUksQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDO2dCQUV2QixJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pDLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFZLEVBQUUsRUFBRTtZQUN2RixJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQztZQUNqQixJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsQ0FBQztZQUV2QixJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQy9CLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLENBQVksRUFBRSxFQUFFO1lBQ25GLElBQUksQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDO1lBQ2pCLElBQUksQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDO1lBRXZCLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRDtBQStCRCxNQUFNLE9BQU8sR0FBRyw0RkFBNEYsQ0FBQztBQWlDN0csTUFBTSxVQUFVLENBQUMsQ0FBQyxHQUFXLEVBQUUsR0FBRyxJQUE0STtJQUM3SyxJQUFJLFVBQW9FLENBQUM7SUFDekUsSUFBSSxRQUFtRSxDQUFDO0lBRXhFLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQzVCLFVBQVUsR0FBRyxFQUFFLENBQUM7UUFDaEIsUUFBUSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwQixDQUFDO1NBQU0sQ0FBQztRQUNQLG1EQUFtRDtRQUNuRCxVQUFVLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBUSxJQUFJLEVBQUUsQ0FBQztRQUNsQyxRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3BCLENBQUM7SUFFRCxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRWhDLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRUQsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUM7SUFDN0MsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUUzQyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUN4QixFQUFFLENBQUMsRUFBRSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQUVELE1BQU0sVUFBVSxHQUFHLEVBQUUsQ0FBQztJQUN0QixJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUMzQixLQUFLLE1BQU0sU0FBUyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDMUQsSUFBSSxTQUFTLEtBQUssRUFBRSxFQUFFLENBQUM7Z0JBQ3RCLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDNUIsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBQ0QsSUFBSSxVQUFVLENBQUMsU0FBUyxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQ3hDLEtBQUssTUFBTSxTQUFTLElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUN6RCxJQUFJLFNBQVMsS0FBSyxFQUFFLEVBQUUsQ0FBQztnQkFDdEIsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUM1QixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFDRCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDM0IsRUFBRSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFFRCxNQUFNLE1BQU0sR0FBZ0MsRUFBRSxDQUFDO0lBRS9DLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1FBQzFCLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ25DLENBQUM7SUFFRCxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBQ2QsS0FBSyxNQUFNLENBQUMsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUMxQixJQUFJLGFBQWEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUN0QixFQUFFLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25CLENBQUM7aUJBQU0sSUFBSSxPQUFPLENBQUMsS0FBSyxRQUFRLEVBQUUsQ0FBQztnQkFDbEMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNkLENBQUM7aUJBQU0sSUFBSSxNQUFNLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ3hCLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN6QixFQUFFLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN4QixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFRCxLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO1FBQ3ZELElBQUksR0FBRyxLQUFLLFdBQVcsRUFBRSxDQUFDO1lBQ3pCLFNBQVM7UUFDVixDQUFDO2FBQU0sSUFBSSxHQUFHLEtBQUssT0FBTyxFQUFFLENBQUM7WUFDNUIsS0FBSyxNQUFNLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDeEQsRUFBRSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQ25CLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxFQUM3QixPQUFPLFFBQVEsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxRQUFRLENBQzlELENBQUM7WUFDSCxDQUFDO1FBQ0YsQ0FBQzthQUFNLElBQUksR0FBRyxLQUFLLFVBQVUsRUFBRSxDQUFDO1lBQy9CLEVBQUUsQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLENBQUM7YUFBTSxDQUFDO1lBQ1AsRUFBRSxDQUFDLFlBQVksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUMvRCxDQUFDO0lBQ0YsQ0FBQztJQUVELE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFcEIsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBa0JELDBFQUEwRTtBQUMxRSxNQUFNLFVBQVUsT0FBTyxDQUFDLEdBQVcsRUFBRSxHQUFHLElBQTRJO0lBQ25MLElBQUksVUFBb0UsQ0FBQztJQUN6RSxJQUFJLFFBQW1FLENBQUM7SUFFeEUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDNUIsVUFBVSxHQUFHLEVBQUUsQ0FBQztRQUNoQixRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3BCLENBQUM7U0FBTSxDQUFDO1FBQ1AsbURBQW1EO1FBQ25ELFVBQVUsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFRLElBQUksRUFBRSxDQUFDO1FBQ2xDLFFBQVEsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEIsQ0FBQztJQUVELE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFFaEMsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUM3QixNQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ2pDLENBQUM7SUFFRCxNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQztJQUM3QyxtREFBbUQ7SUFDbkQsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLGVBQWUsQ0FBQyw0QkFBNEIsRUFBRSxPQUFPLENBQXVCLENBQUM7SUFFakcsSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDeEIsRUFBRSxDQUFDLEVBQUUsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFFRCxNQUFNLFVBQVUsR0FBRyxFQUFFLENBQUM7SUFDdEIsSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDM0IsS0FBSyxNQUFNLFNBQVMsSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQzFELElBQUksU0FBUyxLQUFLLEVBQUUsRUFBRSxDQUFDO2dCQUN0QixVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzVCLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUNELElBQUksVUFBVSxDQUFDLFNBQVMsS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUN4QyxLQUFLLE1BQU0sU0FBUyxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDekQsSUFBSSxTQUFTLEtBQUssRUFBRSxFQUFFLENBQUM7Z0JBQ3RCLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDNUIsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBQ0QsSUFBSSxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQzNCLEVBQUUsQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRUQsTUFBTSxNQUFNLEdBQWdDLEVBQUUsQ0FBQztJQUUvQyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztRQUMxQixNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUNuQyxDQUFDO0lBRUQsSUFBSSxRQUFRLEVBQUUsQ0FBQztRQUNkLEtBQUssTUFBTSxDQUFDLElBQUksUUFBUSxFQUFFLENBQUM7WUFDMUIsSUFBSSxhQUFhLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDdEIsRUFBRSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNuQixDQUFDO2lCQUFNLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxFQUFFLENBQUM7Z0JBQ2xDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDZCxDQUFDO2lCQUFNLElBQUksTUFBTSxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUN4QixNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDekIsRUFBRSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDeEIsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRUQsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztRQUN2RCxJQUFJLEdBQUcsS0FBSyxXQUFXLEVBQUUsQ0FBQztZQUN6QixTQUFTO1FBQ1YsQ0FBQzthQUFNLElBQUksR0FBRyxLQUFLLE9BQU8sRUFBRSxDQUFDO1lBQzVCLEtBQUssTUFBTSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ3hELEVBQUUsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUNuQixxQkFBcUIsQ0FBQyxNQUFNLENBQUMsRUFDN0IsT0FBTyxRQUFRLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsUUFBUSxDQUM5RCxDQUFDO1lBQ0gsQ0FBQztRQUNGLENBQUM7YUFBTSxJQUFJLEdBQUcsS0FBSyxVQUFVLEVBQUUsQ0FBQztZQUMvQixFQUFFLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQztRQUNyQixDQUFDO2FBQU0sQ0FBQztZQUNQLEVBQUUsQ0FBQyxZQUFZLENBQUMscUJBQXFCLENBQUMsR0FBRyxDQUFDLEVBQUUsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDL0QsQ0FBQztJQUNGLENBQUM7SUFFRCxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBRXBCLE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQUMsR0FBVztJQUN6QyxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLEVBQUUsT0FBTyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7QUFDOUQsQ0FBQztBQUVELE1BQU0sVUFBVSxjQUFjLENBQUMsSUFBYSxFQUFFLEVBQVcsRUFBRSxNQUFpQjtJQUMzRSxLQUFLLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQy9DLElBQUksQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3RDLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzlCLENBQUM7SUFDRixDQUFDO0FBQ0YsQ0FBQztBQUVELFNBQVMsYUFBYSxDQUFDLElBQWEsRUFBRSxFQUFXLEVBQUUsSUFBWTtJQUM5RCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3RDLElBQUksS0FBSyxFQUFFLENBQUM7UUFDWCxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztJQUM5QixDQUFDO1NBQU0sQ0FBQztRQUNQLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDMUIsQ0FBQztBQUNGLENBQUM7QUFFRCxNQUFNLFVBQVUsZUFBZSxDQUFDLElBQWEsRUFBRSxFQUFXLEVBQUUsTUFBaUI7SUFDNUUsY0FBYyxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFakMsTUFBTSxXQUFXLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztJQUUxQyxXQUFXLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsRUFBRTtRQUM1SCxLQUFLLE1BQU0sUUFBUSxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2xDLElBQUksUUFBUSxDQUFDLElBQUksS0FBSyxZQUFZLElBQUksUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFDO2dCQUM5RCxhQUFhLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDakQsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRUosT0FBTyxXQUFXLENBQUM7QUFDcEIsQ0FBQztBQUVELE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxPQUFnQjtJQUNqRCxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLEtBQUssT0FBTyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLEtBQUssVUFBVSxJQUFJLGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQztBQUNySixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxPQUFPLFlBQVk7SUFJeEIsWUFDa0IsT0FBZSxFQUNmLE9BQWUsRUFDaEMsTUFBbUI7UUFGRixZQUFPLEdBQVAsT0FBTyxDQUFRO1FBQ2YsWUFBTyxHQUFQLE9BQU8sQ0FBUTtRQUxqQyw0QkFBNEI7UUFDcEIsV0FBTSxHQUFHLElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBT2xDLE1BQU0sRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsR0FBRyxNQUFNLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUNwRSxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUVWLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUNkLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQztRQUViLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQztRQUNmLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQztRQUViLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUNkLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQztRQUVoQixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUM7UUFDZixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUM7SUFDakIsQ0FBQztJQUVNLFFBQVEsQ0FBQyxDQUFTLEVBQUUsQ0FBUztRQUNuQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDMUMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQzVCLE1BQU0sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDakIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDN0IsSUFBSSxxQkFBcUIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUMzRyxPQUFPLElBQUksQ0FBQztZQUNiLENBQUM7UUFDRixDQUFDO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0NBQ0Q7QUFHRCxNQUFNLEtBQVcsQ0FBQyxDQStDakI7QUEvQ0QsV0FBaUIsQ0FBQztJQUNqQixTQUFTLE1BQU0sQ0FBbUMsWUFBZ0MsU0FBUztRQUMxRixPQUFPLENBQUMsR0FBRyxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsRUFBRTtZQUNwQyxNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDO1lBQ25DLE9BQU8sVUFBVSxDQUFDLEtBQUssQ0FBQztZQUN4QixNQUFNLEdBQUcsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDO1lBQzNCLE9BQU8sVUFBVSxDQUFDLEdBQUcsQ0FBQztZQUN0QixNQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDO1lBQ2pDLE9BQU8sVUFBVSxDQUFDLE1BQU0sQ0FBQztZQUV6QixtREFBbUQ7WUFDbkQsT0FBTyxJQUFJLHVCQUF1QixDQUFDLEdBQVUsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3pHLENBQUMsQ0FBQztJQUNILENBQUM7SUFFRCxTQUFTLElBQUksQ0FBNEQsR0FBUyxFQUFFLFlBQWdDLFNBQVM7UUFDNUgsbURBQW1EO1FBQ25ELE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQVEsQ0FBQztRQUNuQyxPQUFPLENBQUMsVUFBVSxFQUFFLFFBQVEsRUFBRSxFQUFFO1lBQy9CLE9BQU8sQ0FBQyxDQUFDLEdBQUcsRUFBRSxVQUFVLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDckMsQ0FBQyxDQUFDO0lBQ0gsQ0FBQztJQUVZLEtBQUcsR0FBZ0QsSUFBSSxDQUErQixLQUFLLENBQUMsQ0FBQztJQUU3RixNQUFJLEdBQUcsTUFBTSxDQUF3QixTQUFTLENBQUMsQ0FBQztJQUVoRCxLQUFHLEdBQTBELElBQUksQ0FBK0IsS0FBSyxFQUFFLDRCQUE0QixDQUFDLENBQUM7SUFFckksU0FBTyxHQUFHLE1BQU0sQ0FBd0IsNEJBQTRCLENBQUMsQ0FBQztJQUVuRixTQUFnQixHQUFHO1FBQ2xCLElBQUksS0FBSyxHQUFrQixTQUFTLENBQUM7UUFDckMsTUFBTSxNQUFNLEdBQVksVUFBVSxHQUFNO1lBQ3ZDLEtBQUssR0FBRyxHQUFHLENBQUM7UUFDYixDQUFDLENBQUM7UUFDRixNQUFNLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUU7WUFDeEMsR0FBRztnQkFDRixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7b0JBQ1osTUFBTSxJQUFJLGtCQUFrQixDQUFDLDBGQUEwRixDQUFDLENBQUM7Z0JBQzFILENBQUM7Z0JBQ0QsT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDO1NBQ0QsQ0FBQyxDQUFDO1FBQ0gsbURBQW1EO1FBQ25ELE9BQU8sTUFBYSxDQUFDO0lBQ3RCLENBQUM7SUFmZSxLQUFHLE1BZWxCLENBQUE7QUFDRixDQUFDLEVBL0NnQixDQUFDLEtBQUQsQ0FBQyxRQStDakI7QUFxREQsTUFBTSxPQUFnQixZQUFZO0lBS2pDLFlBQ0MsR0FBVyxFQUNYLEdBQXdCLEVBQ3hCLE1BQTJELEVBQzNELEVBQXNCLEVBQ3RCLFNBQThELEVBQzlELFVBQW1DLEVBQ25DLFFBQW1CO1FBWEgsY0FBUyxHQUF5QixFQUFFLENBQUM7UUFpSTlDLGVBQVUsR0FBcUMsU0FBUyxDQUFDO1FBWXpELDZCQUF3QixHQUFxQyxTQUFTLENBQUM7UUFoSTlFLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFpQixDQUFDO1FBQ3ZHLElBQUksR0FBRyxFQUFFLENBQUM7WUFDVCxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3BCLENBQUM7UUFDRCxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1osSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7Z0JBQ3ZDLE1BQU0sQ0FBQyxJQUE2QyxDQUFDLENBQUM7Z0JBQ3RELE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDO29CQUNqQixPQUFPLEVBQUUsR0FBRyxFQUFFO3dCQUNiLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDZCxDQUFDO2lCQUNELENBQUMsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUNmLElBQUksYUFBYSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7Z0JBQzlCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEVBQUU7b0JBQzFDLDZCQUE2QjtvQkFDN0IsWUFBWSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsWUFBWSxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUM5RCxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLFlBQVksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFlBQVksQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUNqRSxDQUFDO1FBQ0YsQ0FBQztRQUVELEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7WUFDdkQsSUFBSSxHQUFHLEtBQUssT0FBTyxFQUFFLENBQUM7Z0JBQ3JCLEtBQUssTUFBTSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ3hELE1BQU0sR0FBRyxHQUFHLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUMxQyxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO3dCQUM1QixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxhQUFhLEdBQUcsRUFBRSxFQUFFLEVBQUUsTUFBTSxDQUFDLEVBQUU7NEJBQzlGLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsZUFBZSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUM5RSxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNMLENBQUM7eUJBQU0sQ0FBQzt3QkFDUCxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO29CQUNqRSxDQUFDO2dCQUNGLENBQUM7WUFDRixDQUFDO2lCQUFNLElBQUksR0FBRyxLQUFLLFVBQVUsRUFBRSxDQUFDO2dCQUMvQixJQUFJLFlBQVksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO29CQUN6QixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFO3dCQUMxQyxnQ0FBZ0M7d0JBQ2hDLG1EQUFtRDt3QkFDbkQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQVEsQ0FBQztvQkFDcEQsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDTCxDQUFDO3FCQUFNLENBQUM7b0JBQ1AsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO2dCQUNoQyxDQUFDO1lBQ0YsQ0FBQztpQkFBTSxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDakMsbURBQW1EO2dCQUNsRCxJQUFJLENBQUMsUUFBZ0IsQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUM7WUFDckMsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLElBQUksWUFBWSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ3pCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sR0FBRyxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRTt3QkFDeEYsb0JBQW9CLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO29CQUM5RCxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNMLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDakQsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNkLFNBQVMsV0FBVyxDQUFDLE1BQTJCLEVBQUUsUUFBNEU7Z0JBQzdILElBQUksWUFBWSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7b0JBQzVCLE9BQU8sV0FBVyxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ25ELENBQUM7Z0JBQ0QsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7b0JBQzdCLE9BQU8sUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdEQsQ0FBQztnQkFDRCxJQUFJLFFBQVEsWUFBWSxZQUFZLEVBQUUsQ0FBQztvQkFDdEMsSUFBSSxNQUFNLEVBQUUsQ0FBQzt3QkFDWixRQUFRLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUM3QixDQUFDO29CQUNELE9BQU8sQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQzVCLENBQUM7Z0JBQ0QsSUFBSSxRQUFRLEVBQUUsQ0FBQztvQkFDZCxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ25CLENBQUM7Z0JBQ0QsT0FBTyxFQUFFLENBQUM7WUFDWCxDQUFDO1lBRUQsTUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRTtnQkFDaEMsZ0NBQWdDO2dCQUNoQyxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUNqRSxDQUFDLENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO2dCQUNyQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDVCxDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFRCxVQUFVLENBQUMsTUFBMkI7UUFDckMsS0FBSyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNoQixDQUFDO0lBQ0YsQ0FBQztJQUVELFdBQVcsQ0FBQyxLQUFzQjtRQUNqQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDaEIsYUFBYTtZQUNiLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDekIsQ0FBQyxDQUFDLENBQUMsNkJBQTZCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDeEMsT0FBTyxJQUE2QyxDQUFDO0lBQ3RELENBQUM7SUFFRDs7TUFFRTtJQUNGLHVCQUF1QjtRQUN0QixNQUFNLEtBQUssR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQ3BDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDeEIsT0FBTyxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFJRCxJQUFJLFNBQVM7UUFDWixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3RCLE1BQU0sT0FBTyxHQUFHLGVBQWUsQ0FBVSxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDM0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDbkYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDcEYsSUFBSSxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUM7UUFDM0IsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQztJQUN4QixDQUFDO0lBSUQsSUFBSSx1QkFBdUI7UUFDMUIsSUFBSSxDQUFDLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1lBQ3BDLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQztZQUN0QixNQUFNLE9BQU8sR0FBRyxlQUFlLENBQVUseUJBQXlCLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDM0UsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRTtnQkFDbkQsU0FBUyxHQUFHLElBQUksQ0FBQztZQUNsQixDQUFDLENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUU7Z0JBQ2xELElBQUksU0FBUyxFQUFFLENBQUM7b0JBQ2YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7Z0JBQzlCLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUU7Z0JBQ25ELFNBQVMsR0FBRyxLQUFLLENBQUM7Z0JBQ2xCLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQy9CLENBQUMsQ0FBQyxDQUFDO1lBQ0gsSUFBSSxDQUFDLHdCQUF3QixHQUFHLE9BQU8sQ0FBQztRQUN6QyxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsd0JBQXdCLENBQUM7SUFDdEMsQ0FBQztDQUNEO0FBRUQsU0FBUyxZQUFZLENBQUMsT0FBeUIsRUFBRSxTQUFpQjtJQUNqRSxJQUFJLFlBQVksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQzNCLE9BQU8sQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQzFDLENBQUM7U0FBTSxDQUFDO1FBQ1AsT0FBTyxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7SUFDL0IsQ0FBQztBQUNGLENBQUM7QUFFRCxTQUFTLE9BQU8sQ0FBSSxLQUFxQixFQUFFLE1BQTJCLEVBQUUsRUFBb0I7SUFDM0YsSUFBSSxZQUFZLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUN6QixFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ3ZCLE9BQU87SUFDUixDQUFDO0lBQ0QsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDMUIsS0FBSyxNQUFNLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUN2QixPQUFPLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQztRQUN4QixDQUFDO1FBQ0QsT0FBTztJQUNSLENBQUM7SUFDRCxtREFBbUQ7SUFDbkQsRUFBRSxDQUFDLEtBQVksQ0FBQyxDQUFDO0FBQ2xCLENBQUM7QUFDRCxTQUFTLFlBQVksQ0FBQyxTQUE4RCxFQUFFLE1BQTJCO0lBQ2hILElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNoQixPQUFPLENBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUMsRUFBRTtRQUNoQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1lBQ1QsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUN6QixNQUFNLEdBQUcsR0FBRyxDQUFDO1lBQ2QsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sSUFBSSxHQUFHLEdBQUcsR0FBRyxDQUFDO1lBQ3JCLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQyxDQUFDLENBQUM7SUFDSCxPQUFPLE1BQU0sQ0FBQztBQUNmLENBQUM7QUFDRCxTQUFTLGFBQWEsQ0FBQyxLQUEyQjtJQUNqRCxJQUFJLFlBQVksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ3pCLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUNELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQzFCLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNkLENBQUM7QUFDRCxTQUFTLGVBQWUsQ0FBQyxLQUFVO0lBQ2xDLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDL0IsT0FBTyxLQUFLLEdBQUcsSUFBSSxDQUFDO0lBQ3JCLENBQUM7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNkLENBQUM7QUFDRCxTQUFTLG9CQUFvQixDQUFDLFFBQTRFO0lBQ3pHLElBQUksWUFBWSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7UUFDNUIsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBQ0QsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7UUFDN0IsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwRCxDQUFDO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZCxDQUFDO0FBRUQsTUFBTSxPQUFPLFdBQVc7SUFDdkIsWUFDaUIsT0FBVSxFQUNULFdBQXdCO1FBRHpCLFlBQU8sR0FBUCxPQUFPLENBQUc7UUFDVCxnQkFBVyxHQUFYLFdBQVcsQ0FBYTtJQUN0QyxDQUFDO0lBRUwsT0FBTztRQUNOLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDNUIsQ0FBQztDQUNEO0FBRUQsTUFBTSxPQUFPLHVCQUF1RSxTQUFRLFlBQWU7SUFDMUcsSUFBVyxPQUFPO1FBQ2pCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUN0QixDQUFDO0NBQ0Q7QUFDRCxTQUFTLG9CQUFvQixDQUFDLE9BQXlCLEVBQUUsR0FBVyxFQUFFLEtBQWM7SUFDbkYsSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUMzQyxPQUFPLENBQUMsZUFBZSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDckQsQ0FBQztTQUFNLENBQUM7UUFDUCxPQUFPLENBQUMsWUFBWSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7QUFDRixDQUFDO0FBRUQsU0FBUyxZQUFZLENBQUksR0FBWTtJQUNwQyxPQUFPLENBQUMsQ0FBQyxHQUFHLElBQXFCLEdBQUksQ0FBQyxJQUFJLEtBQUssU0FBUyxJQUFxQixHQUFJLENBQUMsYUFBYSxLQUFLLFNBQVMsQ0FBQztBQUMvRyxDQUFDIn0=