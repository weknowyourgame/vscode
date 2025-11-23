/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { getZoomFactor, isChrome } from '../../browser.js';
import * as dom from '../../dom.js';
import { createFastDomNode } from '../../fastDomNode.js';
import { StandardWheelEvent } from '../../mouseEvent.js';
import { HorizontalScrollbar } from './horizontalScrollbar.js';
import { VerticalScrollbar } from './verticalScrollbar.js';
import { Widget } from '../widget.js';
import { TimeoutTimer } from '../../../common/async.js';
import { Emitter } from '../../../common/event.js';
import { dispose } from '../../../common/lifecycle.js';
import * as platform from '../../../common/platform.js';
import { Scrollable } from '../../../common/scrollable.js';
import './media/scrollbars.css';
const HIDE_TIMEOUT = 500;
const SCROLL_WHEEL_SENSITIVITY = 50;
const SCROLL_WHEEL_SMOOTH_SCROLL_ENABLED = true;
class MouseWheelClassifierItem {
    constructor(timestamp, deltaX, deltaY) {
        this.timestamp = timestamp;
        this.deltaX = deltaX;
        this.deltaY = deltaY;
        this.score = 0;
    }
}
export class MouseWheelClassifier {
    static { this.INSTANCE = new MouseWheelClassifier(); }
    constructor() {
        this._capacity = 5;
        this._memory = [];
        this._front = -1;
        this._rear = -1;
    }
    isPhysicalMouseWheel() {
        if (this._front === -1 && this._rear === -1) {
            // no elements
            return false;
        }
        // 0.5 * last + 0.25 * 2nd last + 0.125 * 3rd last + ...
        let remainingInfluence = 1;
        let score = 0;
        let iteration = 1;
        let index = this._rear;
        do {
            const influence = (index === this._front ? remainingInfluence : Math.pow(2, -iteration));
            remainingInfluence -= influence;
            score += this._memory[index].score * influence;
            if (index === this._front) {
                break;
            }
            index = (this._capacity + index - 1) % this._capacity;
            iteration++;
        } while (true);
        return (score <= 0.5);
    }
    acceptStandardWheelEvent(e) {
        if (isChrome) {
            const targetWindow = dom.getWindow(e.browserEvent);
            const pageZoomFactor = getZoomFactor(targetWindow);
            // On Chrome, the incoming delta events are multiplied with the OS zoom factor.
            // The OS zoom factor can be reverse engineered by using the device pixel ratio and the configured zoom factor into account.
            this.accept(Date.now(), e.deltaX * pageZoomFactor, e.deltaY * pageZoomFactor);
        }
        else {
            this.accept(Date.now(), e.deltaX, e.deltaY);
        }
    }
    accept(timestamp, deltaX, deltaY) {
        let previousItem = null;
        const item = new MouseWheelClassifierItem(timestamp, deltaX, deltaY);
        if (this._front === -1 && this._rear === -1) {
            this._memory[0] = item;
            this._front = 0;
            this._rear = 0;
        }
        else {
            previousItem = this._memory[this._rear];
            this._rear = (this._rear + 1) % this._capacity;
            if (this._rear === this._front) {
                // Drop oldest
                this._front = (this._front + 1) % this._capacity;
            }
            this._memory[this._rear] = item;
        }
        item.score = this._computeScore(item, previousItem);
    }
    /**
     * A score between 0 and 1 for `item`.
     *  - a score towards 0 indicates that the source appears to be a physical mouse wheel
     *  - a score towards 1 indicates that the source appears to be a touchpad or magic mouse, etc.
     */
    _computeScore(item, previousItem) {
        if (Math.abs(item.deltaX) > 0 && Math.abs(item.deltaY) > 0) {
            // both axes exercised => definitely not a physical mouse wheel
            return 1;
        }
        let score = 0.5;
        if (!this._isAlmostInt(item.deltaX) || !this._isAlmostInt(item.deltaY)) {
            // non-integer deltas => indicator that this is not a physical mouse wheel
            score += 0.25;
        }
        // Non-accelerating scroll => indicator that this is a physical mouse wheel
        // These can be identified by seeing whether they are the module of one another.
        if (previousItem) {
            const absDeltaX = Math.abs(item.deltaX);
            const absDeltaY = Math.abs(item.deltaY);
            const absPreviousDeltaX = Math.abs(previousItem.deltaX);
            const absPreviousDeltaY = Math.abs(previousItem.deltaY);
            // Min 1 to avoid division by zero, module 1 will still be 0.
            const minDeltaX = Math.max(Math.min(absDeltaX, absPreviousDeltaX), 1);
            const minDeltaY = Math.max(Math.min(absDeltaY, absPreviousDeltaY), 1);
            const maxDeltaX = Math.max(absDeltaX, absPreviousDeltaX);
            const maxDeltaY = Math.max(absDeltaY, absPreviousDeltaY);
            const isSameModulo = (maxDeltaX % minDeltaX === 0 && maxDeltaY % minDeltaY === 0);
            if (isSameModulo) {
                score -= 0.5;
            }
        }
        return Math.min(Math.max(score, 0), 1);
    }
    _isAlmostInt(value) {
        const epsilon = Number.EPSILON * 100; // Use a small tolerance factor for floating-point errors
        const delta = Math.abs(Math.round(value) - value);
        return (delta < 0.01 + epsilon);
    }
}
export class AbstractScrollableElement extends Widget {
    get onScroll() { return this._onScroll.event; }
    get onWillScroll() { return this._onWillScroll.event; }
    get options() {
        return this._options;
    }
    constructor(element, options, scrollable) {
        super();
        this._inertialTimeout = null;
        this._inertialSpeed = { X: 0, Y: 0 };
        this._onScroll = this._register(new Emitter());
        this._onWillScroll = this._register(new Emitter());
        element.style.overflow = 'hidden';
        this._options = resolveOptions(options);
        this._scrollable = scrollable;
        this._register(this._scrollable.onScroll((e) => {
            this._onWillScroll.fire(e);
            this._onDidScroll(e);
            this._onScroll.fire(e);
        }));
        const scrollbarHost = {
            onMouseWheel: (mouseWheelEvent) => this._onMouseWheel(mouseWheelEvent),
            onDragStart: () => this._onDragStart(),
            onDragEnd: () => this._onDragEnd(),
        };
        this._verticalScrollbar = this._register(new VerticalScrollbar(this._scrollable, this._options, scrollbarHost));
        this._horizontalScrollbar = this._register(new HorizontalScrollbar(this._scrollable, this._options, scrollbarHost));
        this._domNode = document.createElement('div');
        this._domNode.className = 'monaco-scrollable-element ' + this._options.className;
        this._domNode.setAttribute('role', 'presentation');
        this._domNode.style.position = 'relative';
        this._domNode.style.overflow = 'hidden';
        this._domNode.appendChild(element);
        this._domNode.appendChild(this._horizontalScrollbar.domNode.domNode);
        this._domNode.appendChild(this._verticalScrollbar.domNode.domNode);
        if (this._options.useShadows) {
            this._leftShadowDomNode = createFastDomNode(document.createElement('div'));
            this._leftShadowDomNode.setClassName('shadow');
            this._domNode.appendChild(this._leftShadowDomNode.domNode);
            this._topShadowDomNode = createFastDomNode(document.createElement('div'));
            this._topShadowDomNode.setClassName('shadow');
            this._domNode.appendChild(this._topShadowDomNode.domNode);
            this._topLeftShadowDomNode = createFastDomNode(document.createElement('div'));
            this._topLeftShadowDomNode.setClassName('shadow');
            this._domNode.appendChild(this._topLeftShadowDomNode.domNode);
        }
        else {
            this._leftShadowDomNode = null;
            this._topShadowDomNode = null;
            this._topLeftShadowDomNode = null;
        }
        this._listenOnDomNode = this._options.listenOnDomNode || this._domNode;
        this._mouseWheelToDispose = [];
        this._setListeningToMouseWheel(this._options.handleMouseWheel);
        this.onmouseover(this._listenOnDomNode, (e) => this._onMouseOver(e));
        this.onmouseleave(this._listenOnDomNode, (e) => this._onMouseLeave(e));
        this._hideTimeout = this._register(new TimeoutTimer());
        this._isDragging = false;
        this._mouseIsOver = false;
        this._shouldRender = true;
        this._revealOnScroll = true;
    }
    dispose() {
        this._mouseWheelToDispose = dispose(this._mouseWheelToDispose);
        if (this._inertialTimeout) {
            this._inertialTimeout.dispose();
            this._inertialTimeout = null;
        }
        super.dispose();
    }
    /**
     * Get the generated 'scrollable' dom node
     */
    getDomNode() {
        return this._domNode;
    }
    getOverviewRulerLayoutInfo() {
        return {
            parent: this._domNode,
            insertBefore: this._verticalScrollbar.domNode.domNode,
        };
    }
    /**
     * Delegate a pointer down event to the vertical scrollbar.
     * This is to help with clicking somewhere else and having the scrollbar react.
     */
    delegateVerticalScrollbarPointerDown(browserEvent) {
        this._verticalScrollbar.delegatePointerDown(browserEvent);
    }
    getScrollDimensions() {
        return this._scrollable.getScrollDimensions();
    }
    setScrollDimensions(dimensions) {
        this._scrollable.setScrollDimensions(dimensions, false);
    }
    /**
     * Update the class name of the scrollable element.
     */
    updateClassName(newClassName) {
        this._options.className = newClassName;
        // Defaults are different on Macs
        if (platform.isMacintosh) {
            this._options.className += ' mac';
        }
        this._domNode.className = 'monaco-scrollable-element ' + this._options.className;
    }
    /**
     * Update configuration options for the scrollbar.
     */
    updateOptions(newOptions) {
        if (typeof newOptions.handleMouseWheel !== 'undefined') {
            this._options.handleMouseWheel = newOptions.handleMouseWheel;
            this._setListeningToMouseWheel(this._options.handleMouseWheel);
        }
        if (typeof newOptions.mouseWheelScrollSensitivity !== 'undefined') {
            this._options.mouseWheelScrollSensitivity = newOptions.mouseWheelScrollSensitivity;
        }
        if (typeof newOptions.fastScrollSensitivity !== 'undefined') {
            this._options.fastScrollSensitivity = newOptions.fastScrollSensitivity;
        }
        if (typeof newOptions.scrollPredominantAxis !== 'undefined') {
            this._options.scrollPredominantAxis = newOptions.scrollPredominantAxis;
        }
        if (typeof newOptions.horizontal !== 'undefined') {
            this._options.horizontal = newOptions.horizontal;
        }
        if (typeof newOptions.vertical !== 'undefined') {
            this._options.vertical = newOptions.vertical;
        }
        if (typeof newOptions.horizontalScrollbarSize !== 'undefined') {
            this._options.horizontalScrollbarSize = newOptions.horizontalScrollbarSize;
        }
        if (typeof newOptions.verticalScrollbarSize !== 'undefined') {
            this._options.verticalScrollbarSize = newOptions.verticalScrollbarSize;
        }
        if (typeof newOptions.scrollByPage !== 'undefined') {
            this._options.scrollByPage = newOptions.scrollByPage;
        }
        this._horizontalScrollbar.updateOptions(this._options);
        this._verticalScrollbar.updateOptions(this._options);
        if (!this._options.lazyRender) {
            this._render();
        }
    }
    setRevealOnScroll(value) {
        this._revealOnScroll = value;
    }
    delegateScrollFromMouseWheelEvent(browserEvent) {
        this._onMouseWheel(new StandardWheelEvent(browserEvent));
    }
    async _periodicSync() {
        let scheduleAgain = false;
        if (this._inertialSpeed.X !== 0 || this._inertialSpeed.Y !== 0) {
            this._scrollable.setScrollPositionNow({
                scrollTop: this._scrollable.getCurrentScrollPosition().scrollTop - this._inertialSpeed.Y * 100,
                scrollLeft: this._scrollable.getCurrentScrollPosition().scrollLeft - this._inertialSpeed.X * 100
            });
            this._inertialSpeed.X *= 0.9;
            this._inertialSpeed.Y *= 0.9;
            if (Math.abs(this._inertialSpeed.X) < 0.01) {
                this._inertialSpeed.X = 0;
            }
            if (Math.abs(this._inertialSpeed.Y) < 0.01) {
                this._inertialSpeed.Y = 0;
            }
            scheduleAgain = (this._inertialSpeed.X !== 0 || this._inertialSpeed.Y !== 0);
        }
        if (scheduleAgain) {
            if (!this._inertialTimeout) {
                this._inertialTimeout = new TimeoutTimer();
            }
            this._inertialTimeout.cancelAndSet(() => this._periodicSync(), 1000 / 60);
        }
        else {
            this._inertialTimeout?.dispose();
            this._inertialTimeout = null;
        }
    }
    // -------------------- mouse wheel scrolling --------------------
    _setListeningToMouseWheel(shouldListen) {
        const isListening = (this._mouseWheelToDispose.length > 0);
        if (isListening === shouldListen) {
            // No change
            return;
        }
        // Stop listening (if necessary)
        this._mouseWheelToDispose = dispose(this._mouseWheelToDispose);
        // Start listening (if necessary)
        if (shouldListen) {
            const onMouseWheel = (browserEvent) => {
                this._onMouseWheel(new StandardWheelEvent(browserEvent));
            };
            this._mouseWheelToDispose.push(dom.addDisposableListener(this._listenOnDomNode, dom.EventType.MOUSE_WHEEL, onMouseWheel, { passive: false }));
        }
    }
    _onMouseWheel(e) {
        if (e.browserEvent?.defaultPrevented) {
            return;
        }
        const classifier = MouseWheelClassifier.INSTANCE;
        if (SCROLL_WHEEL_SMOOTH_SCROLL_ENABLED) {
            classifier.acceptStandardWheelEvent(e);
        }
        // useful for creating unit tests:
        // console.log(`${Date.now()}, ${e.deltaY}, ${e.deltaX}`);
        let didScroll = false;
        if (e.deltaY || e.deltaX) {
            let deltaY = e.deltaY * this._options.mouseWheelScrollSensitivity;
            let deltaX = e.deltaX * this._options.mouseWheelScrollSensitivity;
            if (this._options.scrollPredominantAxis) {
                if (this._options.scrollYToX && deltaX + deltaY === 0) {
                    // when configured to map Y to X and we both see
                    // no dominant axis and X and Y are competing with
                    // identical values into opposite directions, we
                    // ignore the delta as we cannot make a decision then
                    deltaX = deltaY = 0;
                }
                else if (Math.abs(deltaY) >= Math.abs(deltaX)) {
                    deltaX = 0;
                }
                else {
                    deltaY = 0;
                }
            }
            if (this._options.flipAxes) {
                [deltaY, deltaX] = [deltaX, deltaY];
            }
            // Convert vertical scrolling to horizontal if shift is held, this
            // is handled at a higher level on Mac
            const shiftConvert = !platform.isMacintosh && e.browserEvent && e.browserEvent.shiftKey;
            if ((this._options.scrollYToX || shiftConvert) && !deltaX) {
                deltaX = deltaY;
                deltaY = 0;
            }
            if (e.browserEvent && e.browserEvent.altKey) {
                // fastScrolling
                deltaX = deltaX * this._options.fastScrollSensitivity;
                deltaY = deltaY * this._options.fastScrollSensitivity;
            }
            const futureScrollPosition = this._scrollable.getFutureScrollPosition();
            let desiredScrollPosition = {};
            if (deltaY) {
                const deltaScrollTop = SCROLL_WHEEL_SENSITIVITY * deltaY;
                // Here we convert values such as -0.3 to -1 or 0.3 to 1, otherwise low speed scrolling will never scroll
                const desiredScrollTop = futureScrollPosition.scrollTop - (deltaScrollTop < 0 ? Math.floor(deltaScrollTop) : Math.ceil(deltaScrollTop));
                this._verticalScrollbar.writeScrollPosition(desiredScrollPosition, desiredScrollTop);
            }
            if (deltaX) {
                const deltaScrollLeft = SCROLL_WHEEL_SENSITIVITY * deltaX;
                // Here we convert values such as -0.3 to -1 or 0.3 to 1, otherwise low speed scrolling will never scroll
                const desiredScrollLeft = futureScrollPosition.scrollLeft - (deltaScrollLeft < 0 ? Math.floor(deltaScrollLeft) : Math.ceil(deltaScrollLeft));
                this._horizontalScrollbar.writeScrollPosition(desiredScrollPosition, desiredScrollLeft);
            }
            // Check that we are scrolling towards a location which is valid
            desiredScrollPosition = this._scrollable.validateScrollPosition(desiredScrollPosition);
            if (this._options.inertialScroll && (deltaX || deltaY) && !classifier.isPhysicalMouseWheel()) {
                let startPeriodic = false;
                // Only start periodic if it's not running
                if (this._inertialSpeed.X === 0 && this._inertialSpeed.Y === 0) {
                    startPeriodic = true;
                }
                this._inertialSpeed.Y = (deltaY < 0 ? -1 : 1) * (Math.abs(deltaY) ** 1.02);
                this._inertialSpeed.X = (deltaX < 0 ? -1 : 1) * (Math.abs(deltaX) ** 1.02);
                if (startPeriodic) {
                    this._periodicSync();
                }
            }
            if (futureScrollPosition.scrollLeft !== desiredScrollPosition.scrollLeft || futureScrollPosition.scrollTop !== desiredScrollPosition.scrollTop) {
                const canPerformSmoothScroll = (SCROLL_WHEEL_SMOOTH_SCROLL_ENABLED
                    && this._options.mouseWheelSmoothScroll
                    && classifier.isPhysicalMouseWheel());
                if (canPerformSmoothScroll) {
                    this._scrollable.setScrollPositionSmooth(desiredScrollPosition);
                }
                else {
                    this._scrollable.setScrollPositionNow(desiredScrollPosition);
                }
                didScroll = true;
            }
        }
        let consumeMouseWheel = didScroll;
        if (!consumeMouseWheel && this._options.alwaysConsumeMouseWheel) {
            consumeMouseWheel = true;
        }
        if (!consumeMouseWheel && this._options.consumeMouseWheelIfScrollbarIsNeeded && (this._verticalScrollbar.isNeeded() || this._horizontalScrollbar.isNeeded())) {
            consumeMouseWheel = true;
        }
        if (consumeMouseWheel) {
            e.preventDefault();
            e.stopPropagation();
        }
    }
    _onDidScroll(e) {
        this._shouldRender = this._horizontalScrollbar.onDidScroll(e) || this._shouldRender;
        this._shouldRender = this._verticalScrollbar.onDidScroll(e) || this._shouldRender;
        if (this._options.useShadows) {
            this._shouldRender = true;
        }
        if (this._revealOnScroll) {
            this._reveal();
        }
        if (!this._options.lazyRender) {
            this._render();
        }
    }
    /**
     * Render / mutate the DOM now.
     * Should be used together with the ctor option `lazyRender`.
     */
    renderNow() {
        if (!this._options.lazyRender) {
            throw new Error('Please use `lazyRender` together with `renderNow`!');
        }
        this._render();
    }
    _render() {
        if (!this._shouldRender) {
            return;
        }
        this._shouldRender = false;
        this._horizontalScrollbar.render();
        this._verticalScrollbar.render();
        if (this._options.useShadows) {
            const scrollState = this._scrollable.getCurrentScrollPosition();
            const enableTop = scrollState.scrollTop > 0;
            const enableLeft = scrollState.scrollLeft > 0;
            const leftClassName = (enableLeft ? ' left' : '');
            const topClassName = (enableTop ? ' top' : '');
            const topLeftClassName = (enableLeft || enableTop ? ' top-left-corner' : '');
            this._leftShadowDomNode.setClassName(`shadow${leftClassName}`);
            this._topShadowDomNode.setClassName(`shadow${topClassName}`);
            this._topLeftShadowDomNode.setClassName(`shadow${topLeftClassName}${topClassName}${leftClassName}`);
        }
    }
    // -------------------- fade in / fade out --------------------
    _onDragStart() {
        this._isDragging = true;
        this._reveal();
    }
    _onDragEnd() {
        this._isDragging = false;
        this._hide();
    }
    _onMouseLeave(e) {
        this._mouseIsOver = false;
        this._hide();
    }
    _onMouseOver(e) {
        this._mouseIsOver = true;
        this._reveal();
    }
    _reveal() {
        this._verticalScrollbar.beginReveal();
        this._horizontalScrollbar.beginReveal();
        this._scheduleHide();
    }
    _hide() {
        if (!this._mouseIsOver && !this._isDragging) {
            this._verticalScrollbar.beginHide();
            this._horizontalScrollbar.beginHide();
        }
    }
    _scheduleHide() {
        if (!this._mouseIsOver && !this._isDragging) {
            this._hideTimeout.cancelAndSet(() => this._hide(), HIDE_TIMEOUT);
        }
    }
}
export class ScrollableElement extends AbstractScrollableElement {
    constructor(element, options) {
        options = options || {};
        options.mouseWheelSmoothScroll = false;
        const scrollable = new Scrollable({
            forceIntegerValues: true,
            smoothScrollDuration: 0,
            scheduleAtNextAnimationFrame: (callback) => dom.scheduleAtNextAnimationFrame(dom.getWindow(element), callback)
        });
        super(element, options, scrollable);
        this._register(scrollable);
    }
    setScrollPosition(update) {
        this._scrollable.setScrollPositionNow(update);
    }
    getScrollPosition() {
        return this._scrollable.getCurrentScrollPosition();
    }
}
export class SmoothScrollableElement extends AbstractScrollableElement {
    constructor(element, options, scrollable) {
        super(element, options, scrollable);
    }
    setScrollPosition(update) {
        if (update.reuseAnimation) {
            this._scrollable.setScrollPositionSmooth(update, update.reuseAnimation);
        }
        else {
            this._scrollable.setScrollPositionNow(update);
        }
    }
    getScrollPosition() {
        return this._scrollable.getCurrentScrollPosition();
    }
}
export class DomScrollableElement extends AbstractScrollableElement {
    constructor(element, options) {
        options = options || {};
        options.mouseWheelSmoothScroll = false;
        const scrollable = new Scrollable({
            forceIntegerValues: false, // See https://github.com/microsoft/vscode/issues/139877
            smoothScrollDuration: 0,
            scheduleAtNextAnimationFrame: (callback) => dom.scheduleAtNextAnimationFrame(dom.getWindow(element), callback)
        });
        super(element, options, scrollable);
        this._register(scrollable);
        this._element = element;
        this._register(this.onScroll((e) => {
            if (e.scrollTopChanged) {
                this._element.scrollTop = e.scrollTop;
            }
            if (e.scrollLeftChanged) {
                this._element.scrollLeft = e.scrollLeft;
            }
        }));
        this.scanDomNode();
    }
    setScrollPosition(update) {
        this._scrollable.setScrollPositionNow(update);
    }
    getScrollPosition() {
        return this._scrollable.getCurrentScrollPosition();
    }
    scanDomNode() {
        // width, scrollLeft, scrollWidth, height, scrollTop, scrollHeight
        this.setScrollDimensions({
            width: this._element.clientWidth,
            scrollWidth: this._element.scrollWidth,
            height: this._element.clientHeight,
            scrollHeight: this._element.scrollHeight
        });
        this.setScrollPosition({
            scrollLeft: this._element.scrollLeft,
            scrollTop: this._element.scrollTop,
        });
    }
}
function resolveOptions(opts) {
    const result = {
        lazyRender: (typeof opts.lazyRender !== 'undefined' ? opts.lazyRender : false),
        className: (typeof opts.className !== 'undefined' ? opts.className : ''),
        useShadows: (typeof opts.useShadows !== 'undefined' ? opts.useShadows : true),
        handleMouseWheel: (typeof opts.handleMouseWheel !== 'undefined' ? opts.handleMouseWheel : true),
        flipAxes: (typeof opts.flipAxes !== 'undefined' ? opts.flipAxes : false),
        consumeMouseWheelIfScrollbarIsNeeded: (typeof opts.consumeMouseWheelIfScrollbarIsNeeded !== 'undefined' ? opts.consumeMouseWheelIfScrollbarIsNeeded : false),
        alwaysConsumeMouseWheel: (typeof opts.alwaysConsumeMouseWheel !== 'undefined' ? opts.alwaysConsumeMouseWheel : false),
        scrollYToX: (typeof opts.scrollYToX !== 'undefined' ? opts.scrollYToX : false),
        mouseWheelScrollSensitivity: (typeof opts.mouseWheelScrollSensitivity !== 'undefined' ? opts.mouseWheelScrollSensitivity : 1),
        fastScrollSensitivity: (typeof opts.fastScrollSensitivity !== 'undefined' ? opts.fastScrollSensitivity : 5),
        scrollPredominantAxis: (typeof opts.scrollPredominantAxis !== 'undefined' ? opts.scrollPredominantAxis : true),
        mouseWheelSmoothScroll: (typeof opts.mouseWheelSmoothScroll !== 'undefined' ? opts.mouseWheelSmoothScroll : true),
        inertialScroll: (typeof opts.inertialScroll !== 'undefined' ? opts.inertialScroll : false),
        arrowSize: (typeof opts.arrowSize !== 'undefined' ? opts.arrowSize : 11),
        listenOnDomNode: (typeof opts.listenOnDomNode !== 'undefined' ? opts.listenOnDomNode : null),
        horizontal: (typeof opts.horizontal !== 'undefined' ? opts.horizontal : 1 /* ScrollbarVisibility.Auto */),
        horizontalScrollbarSize: (typeof opts.horizontalScrollbarSize !== 'undefined' ? opts.horizontalScrollbarSize : 10),
        horizontalSliderSize: (typeof opts.horizontalSliderSize !== 'undefined' ? opts.horizontalSliderSize : 0),
        horizontalHasArrows: (typeof opts.horizontalHasArrows !== 'undefined' ? opts.horizontalHasArrows : false),
        vertical: (typeof opts.vertical !== 'undefined' ? opts.vertical : 1 /* ScrollbarVisibility.Auto */),
        verticalScrollbarSize: (typeof opts.verticalScrollbarSize !== 'undefined' ? opts.verticalScrollbarSize : 10),
        verticalHasArrows: (typeof opts.verticalHasArrows !== 'undefined' ? opts.verticalHasArrows : false),
        verticalSliderSize: (typeof opts.verticalSliderSize !== 'undefined' ? opts.verticalSliderSize : 0),
        scrollByPage: (typeof opts.scrollByPage !== 'undefined' ? opts.scrollByPage : false)
    };
    result.horizontalSliderSize = (typeof opts.horizontalSliderSize !== 'undefined' ? opts.horizontalSliderSize : result.horizontalScrollbarSize);
    result.verticalSliderSize = (typeof opts.verticalSliderSize !== 'undefined' ? opts.verticalSliderSize : result.verticalScrollbarSize);
    // Defaults are different on Macs
    if (platform.isMacintosh) {
        result.className += ' mac';
    }
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Nyb2xsYWJsZUVsZW1lbnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9icm93c2VyL3VpL3Njcm9sbGJhci9zY3JvbGxhYmxlRWxlbWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsYUFBYSxFQUFFLFFBQVEsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQzNELE9BQU8sS0FBSyxHQUFHLE1BQU0sY0FBYyxDQUFDO0FBQ3BDLE9BQU8sRUFBZSxpQkFBaUIsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ3RFLE9BQU8sRUFBaUMsa0JBQWtCLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUV4RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUUvRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUMzRCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ3RDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUN4RCxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sMEJBQTBCLENBQUM7QUFDMUQsT0FBTyxFQUFlLE9BQU8sRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3BFLE9BQU8sS0FBSyxRQUFRLE1BQU0sNkJBQTZCLENBQUM7QUFDeEQsT0FBTyxFQUE2RixVQUFVLEVBQXVCLE1BQU0sK0JBQStCLENBQUM7QUFDM0ssT0FBTyx3QkFBd0IsQ0FBQztBQUVoQyxNQUFNLFlBQVksR0FBRyxHQUFHLENBQUM7QUFDekIsTUFBTSx3QkFBd0IsR0FBRyxFQUFFLENBQUM7QUFDcEMsTUFBTSxrQ0FBa0MsR0FBRyxJQUFJLENBQUM7QUFPaEQsTUFBTSx3QkFBd0I7SUFNN0IsWUFBWSxTQUFpQixFQUFFLE1BQWMsRUFBRSxNQUFjO1FBQzVELElBQUks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