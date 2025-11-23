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
import { registerSingleton } from '../../instantiation/common/extensions.js';
import { registerThemingParticipant } from '../../theme/common/themeService.js';
import { editorHoverBorder } from '../../theme/common/colorRegistry.js';
import { IHoverService } from './hover.js';
import { IContextMenuService } from '../../contextview/browser/contextView.js';
import { IInstantiationService } from '../../instantiation/common/instantiation.js';
import { HoverWidget } from './hoverWidget.js';
import { Disposable, DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { addDisposableListener, EventType, getActiveElement, isAncestorOfActiveElement, isAncestor, getWindow, isHTMLElement, isEditableElement } from '../../../base/browser/dom.js';
import { IKeybindingService } from '../../keybinding/common/keybinding.js';
import { StandardKeyboardEvent } from '../../../base/browser/keyboardEvent.js';
import { IAccessibilityService } from '../../accessibility/common/accessibility.js';
import { ILayoutService } from '../../layout/browser/layoutService.js';
import { mainWindow } from '../../../base/browser/window.js';
import { ContextViewHandler } from '../../contextview/browser/contextViewService.js';
import { isManagedHoverTooltipMarkdownString } from '../../../base/browser/ui/hover/hover.js';
import { ManagedHoverWidget } from './updatableHoverWidget.js';
import { timeout, TimeoutTimer } from '../../../base/common/async.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { isNumber, isString } from '../../../base/common/types.js';
import { KeyChord } from '../../../base/common/keyCodes.js';
import { KeybindingsRegistry } from '../../keybinding/common/keybindingsRegistry.js';
import { stripIcons } from '../../../base/common/iconLabels.js';
let HoverService = class HoverService extends Disposable {
    constructor(_instantiationService, _configurationService, contextMenuService, _keybindingService, _layoutService, _accessibilityService) {
        super();
        this._instantiationService = _instantiationService;
        this._configurationService = _configurationService;
        this._keybindingService = _keybindingService;
        this._layoutService = _layoutService;
        this._accessibilityService = _accessibilityService;
        this._currentDelayedHoverWasShown = false;
        this._delayedHovers = new Map();
        this._managedHovers = new Map();
        this._register(contextMenuService.onDidShowContextMenu(() => this.hideHover()));
        this._contextViewHandler = this._register(new ContextViewHandler(this._layoutService));
        this._register(KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: 'workbench.action.showHover',
            weight: 0 /* KeybindingWeight.EditorCore */,
            primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 2048 /* KeyMod.CtrlCmd */ | 39 /* KeyCode.KeyI */),
            handler: () => { this._showAndFocusHoverForActiveElement(); },
        }));
    }
    showInstantHover(options, focus, skipLastFocusedUpdate, dontShow) {
        const hover = this._createHover(options, skipLastFocusedUpdate);
        if (!hover) {
            return undefined;
        }
        this._showHover(hover, options, focus);
        return hover;
    }
    showDelayedHover(options, lifecycleOptions) {
        // Set `id` to default if it's undefined
        if (options.id === undefined) {
            options.id = getHoverIdFromContent(options.content);
        }
        if (!this._currentDelayedHover || this._currentDelayedHoverWasShown) {
            // Current hover is locked, reject
            if (this._currentHover?.isLocked) {
                return undefined;
            }
            // Identity is the same, return current hover
            if (getHoverOptionsIdentity(this._currentHoverOptions) === getHoverOptionsIdentity(options)) {
                return this._currentHover;
            }
            // Check group identity, if it's the same skip the delay and show the hover immediately
            if (this._currentHover && !this._currentHover.isDisposed && this._currentDelayedHoverGroupId !== undefined && this._currentDelayedHoverGroupId === lifecycleOptions?.groupId) {
                return this.showInstantHover({
                    ...options,
                    appearance: {
                        ...options.appearance,
                        skipFadeInAnimation: true
                    }
                });
            }
        }
        else if (this._currentDelayedHover && getHoverOptionsIdentity(this._currentHoverOptions) === getHoverOptionsIdentity(options)) {
            // If the hover is the same but timeout is not finished yet, return the current hover
            return this._currentDelayedHover;
        }
        const hover = this._createHover(options, undefined);
        if (!hover) {
            this._currentDelayedHover = undefined;
            this._currentDelayedHoverWasShown = false;
            this._currentDelayedHoverGroupId = undefined;
            return undefined;
        }
        this._currentDelayedHover = hover;
        this._currentDelayedHoverWasShown = false;
        this._currentDelayedHoverGroupId = lifecycleOptions?.groupId;
        timeout(this._configurationService.getValue('workbench.hover.delay')).then(() => {
            if (hover && !hover.isDisposed) {
                this._currentDelayedHoverWasShown = true;
                this._showHover(hover, options);
            }
        });
        return hover;
    }
    setupDelayedHover(target, options, lifecycleOptions) {
        const resolveHoverOptions = (e) => {
            const resolved = {
                ...typeof options === 'function' ? options() : options,
                target
            };
            if (resolved.style === 2 /* HoverStyle.Mouse */ && e) {
                resolved.target = resolveMouseStyleHoverTarget(target, e);
            }
            return resolved;
        };
        return this._setupDelayedHover(target, resolveHoverOptions, lifecycleOptions);
    }
    setupDelayedHoverAtMouse(target, options, lifecycleOptions) {
        const resolveHoverOptions = (e) => ({
            ...typeof options === 'function' ? options() : options,
            target: e ? resolveMouseStyleHoverTarget(target, e) : target
        });
        return this._setupDelayedHover(target, resolveHoverOptions, lifecycleOptions);
    }
    _setupDelayedHover(target, resolveHoverOptions, lifecycleOptions) {
        const store = new DisposableStore();
        store.add(addDisposableListener(target, EventType.MOUSE_OVER, e => {
            this.showDelayedHover(resolveHoverOptions(e), {
                groupId: lifecycleOptions?.groupId
            });
        }));
        if (lifecycleOptions?.setupKeyboardEvents) {
            store.add(addDisposableListener(target, EventType.KEY_DOWN, e => {
                const evt = new StandardKeyboardEvent(e);
                if (evt.equals(10 /* KeyCode.Space */) || evt.equals(3 /* KeyCode.Enter */)) {
                    this.showInstantHover(resolveHoverOptions(), true);
                }
            }));
        }
        this._delayedHovers.set(target, { show: (focus) => { this.showInstantHover(resolveHoverOptions(), focus); } });
        store.add(toDisposable(() => this._delayedHovers.delete(target)));
        return store;
    }
    _createHover(options, skipLastFocusedUpdate) {
        this._currentDelayedHover = undefined;
        if (options.content === '') {
            return undefined;
        }
        if (this._currentHover?.isLocked) {
            return undefined;
        }
        // Set `id` to default if it's undefined
        if (options.id === undefined) {
            options.id = getHoverIdFromContent(options.content);
        }
        if (getHoverOptionsIdentity(this._currentHoverOptions) === getHoverOptionsIdentity(options)) {
            return undefined;
        }
        this._currentHoverOptions = options;
        this._lastHoverOptions = options;
        const trapFocus = options.trapFocus || this._accessibilityService.isScreenReaderOptimized();
        const activeElement = getActiveElement();
        // HACK, remove this check when #189076 is fixed
        if (!skipLastFocusedUpdate) {
            if (trapFocus && activeElement) {
                if (!activeElement.classList.contains('monaco-hover')) {
                    this._lastFocusedElementBeforeOpen = activeElement;
                }
            }
            else {
                this._lastFocusedElementBeforeOpen = undefined;
            }
        }
        const hoverDisposables = new DisposableStore();
        const hover = this._instantiationService.createInstance(HoverWidget, options);
        if (options.persistence?.sticky) {
            hover.isLocked = true;
        }
        // Adjust target position when a mouse event is provided as the hover position
        if (options.position?.hoverPosition && !isNumber(options.position.hoverPosition)) {
            options.target = {
                targetElements: isHTMLElement(options.target) ? [options.target] : options.target.targetElements,
                x: options.position.hoverPosition.x + 10
            };
        }
        hover.onDispose(() => {
            const hoverWasFocused = this._currentHover?.domNode && isAncestorOfActiveElement(this._currentHover.domNode);
            if (hoverWasFocused) {
                // Required to handle cases such as closing the hover with the escape key
                this._lastFocusedElementBeforeOpen?.focus();
            }
            // Only clear the current options if it's the current hover, the current options help
            // reduce flickering when the same hover is shown multiple times
            if (getHoverOptionsIdentity(this._currentHoverOptions) === getHoverOptionsIdentity(options)) {
                this.doHideHover();
            }
            hoverDisposables.dispose();
        }, undefined, hoverDisposables);
        // Set the container explicitly to enable aux window support
        if (!options.container) {
            const targetElement = isHTMLElement(options.target) ? options.target : options.target.targetElements[0];
            options.container = this._layoutService.getContainer(getWindow(targetElement));
        }
        hover.onRequestLayout(() => this._contextViewHandler.layout(), undefined, hoverDisposables);
        if (options.persistence?.sticky) {
            hoverDisposables.add(addDisposableListener(getWindow(options.container).document, EventType.MOUSE_DOWN, e => {
                if (!isAncestor(e.target, hover.domNode)) {
                    this.doHideHover();
                }
            }));
        }
        else {
            if ('targetElements' in options.target) {
                for (const element of options.target.targetElements) {
                    hoverDisposables.add(addDisposableListener(element, EventType.CLICK, () => this.hideHover()));
                }
            }
            else {
                hoverDisposables.add(addDisposableListener(options.target, EventType.CLICK, () => this.hideHover()));
            }
            const focusedElement = getActiveElement();
            if (focusedElement) {
                const focusedElementDocument = getWindow(focusedElement).document;
                hoverDisposables.add(addDisposableListener(focusedElement, EventType.KEY_DOWN, e => this._keyDown(e, hover, !!options.persistence?.hideOnKeyDown)));
                hoverDisposables.add(addDisposableListener(focusedElementDocument, EventType.KEY_DOWN, e => this._keyDown(e, hover, !!options.persistence?.hideOnKeyDown)));
                hoverDisposables.add(addDisposableListener(focusedElement, EventType.KEY_UP, e => this._keyUp(e, hover)));
                hoverDisposables.add(addDisposableListener(focusedElementDocument, EventType.KEY_UP, e => this._keyUp(e, hover)));
            }
        }
        if ('IntersectionObserver' in mainWindow) {
            const observer = new IntersectionObserver(e => this._intersectionChange(e, hover), { threshold: 0 });
            const firstTargetElement = 'targetElements' in options.target ? options.target.targetElements[0] : options.target;
            observer.observe(firstTargetElement);
            hoverDisposables.add(toDisposable(() => observer.disconnect()));
        }
        this._currentHover = hover;
        return hover;
    }
    _showHover(hover, options, focus) {
        this._contextViewHandler.showContextView(new HoverContextViewDelegate(hover, focus), options.container);
    }
    hideHover(force) {
        if ((!force && this._currentHover?.isLocked) || !this._currentHoverOptions) {
            return;
        }
        this.doHideHover();
    }
    doHideHover() {
        this._currentHover = undefined;
        this._currentHoverOptions = undefined;
        this._contextViewHandler.hideContextView();
    }
    _intersectionChange(entries, hover) {
        const entry = entries[entries.length - 1];
        if (!entry.isIntersecting) {
            hover.dispose();
        }
    }
    showAndFocusLastHover() {
        if (!this._lastHoverOptions) {
            return;
        }
        this.showInstantHover(this._lastHoverOptions, true, true);
    }
    _showAndFocusHoverForActiveElement() {
        // TODO: if hover is visible, focus it to avoid flickering
        let activeElement = getActiveElement();
        while (activeElement) {
            const hover = this._delayedHovers.get(activeElement) ?? this._managedHovers.get(activeElement);
            if (hover) {
                hover.show(true);
                return;
            }
            activeElement = activeElement.parentElement;
        }
    }
    _keyDown(e, hover, hideOnKeyDown) {
        if (e.key === 'Alt') {
            hover.isLocked = true;
            return;
        }
        const event = new StandardKeyboardEvent(e);
        const keybinding = this._keybindingService.resolveKeyboardEvent(event);
        if (keybinding.getSingleModifierDispatchChords().some(value => !!value) || this._keybindingService.softDispatch(event, event.target).kind !== 0 /* ResultKind.NoMatchingKb */) {
            return;
        }
        if (hideOnKeyDown && (!this._currentHoverOptions?.trapFocus || e.key !== 'Tab')) {
            this.hideHover();
            this._lastFocusedElementBeforeOpen?.focus();
        }
    }
    _keyUp(e, hover) {
        if (e.key === 'Alt') {
            hover.isLocked = false;
            // Hide if alt is released while the mouse is not over hover/target
            if (!hover.isMouseIn) {
                this.hideHover();
                this._lastFocusedElementBeforeOpen?.focus();
            }
        }
    }
    // TODO: Investigate performance of this function. There seems to be a lot of content created
    //       and thrown away on start up
    setupManagedHover(hoverDelegate, targetElement, content, options) {
        if (hoverDelegate.showNativeHover) {
            return setupNativeHover(targetElement, content);
        }
        targetElement.setAttribute('custom-hover', 'true');
        if (targetElement.title !== '') {
            console.warn('HTML element already has a title attribute, which will conflict with the custom hover. Please remove the title attribute.');
            console.trace('Stack trace:', targetElement.title);
            targetElement.title = '';
        }
        let hoverPreparation;
        let hoverWidget;
        const hideHover = (disposeWidget, disposePreparation) => {
            const hadHover = hoverWidget !== undefined;
            if (disposeWidget) {
                hoverWidget?.dispose();
                hoverWidget = undefined;
            }
            if (disposePreparation) {
                hoverPreparation?.dispose();
                hoverPreparation = undefined;
            }
            if (hadHover) {
                hoverDelegate.onDidHideHover?.();
                hoverWidget = undefined;
            }
        };
        const triggerShowHover = (delay, focus, target, trapFocus) => {
            return new TimeoutTimer(async () => {
                if (!hoverWidget || hoverWidget.isDisposed) {
                    hoverWidget = new ManagedHoverWidget(hoverDelegate, target || targetElement, delay > 0);
                    await hoverWidget.update(typeof content === 'function' ? content() : content, focus, { ...options, trapFocus });
                }
            }, delay);
        };
        const store = new DisposableStore();
        let isMouseDown = false;
        store.add(addDisposableListener(targetElement, EventType.MOUSE_DOWN, () => {
            isMouseDown = true;
            hideHover(true, true);
        }, true));
        store.add(addDisposableListener(targetElement, EventType.MOUSE_UP, () => {
            isMouseDown = false;
        }, true));
        store.add(addDisposableListener(targetElement, EventType.MOUSE_LEAVE, (e) => {
            isMouseDown = false;
            hideHover(false, e.fromElement === targetElement);
        }, true));
        store.add(addDisposableListener(targetElement, EventType.MOUSE_OVER, (e) => {
            if (hoverPreparation) {
                return;
            }
            const mouseOverStore = new DisposableStore();
            const target = {
                targetElements: [targetElement],
                dispose: () => { }
            };
            if (hoverDelegate.placement === undefined || hoverDelegate.placement === 'mouse') {
                // track the mouse position
                const onMouseMove = (e) => {
                    target.x = e.x + 10;
                    if (!eventIsRelatedToTarget(e, targetElement)) {
                        hideHover(true, true);
                    }
                };
                mouseOverStore.add(addDisposableListener(targetElement, EventType.MOUSE_MOVE, onMouseMove, true));
            }
            hoverPreparation = mouseOverStore;
            if (!eventIsRelatedToTarget(e, targetElement)) {
                return; // Do not show hover when the mouse is over another hover target
            }
            mouseOverStore.add(triggerShowHover(typeof hoverDelegate.delay === 'function' ? hoverDelegate.delay(content) : hoverDelegate.delay, false, target));
        }, true));
        const onFocus = (e) => {
            if (isMouseDown || hoverPreparation) {
                return;
            }
            if (!eventIsRelatedToTarget(e, targetElement)) {
                return; // Do not show hover when the focus is on another hover target
            }
            const target = {
                targetElements: [targetElement],
                dispose: () => { }
            };
            const toDispose = new DisposableStore();
            const onBlur = () => hideHover(true, true);
            toDispose.add(addDisposableListener(targetElement, EventType.BLUR, onBlur, true));
            toDispose.add(triggerShowHover(typeof hoverDelegate.delay === 'function' ? hoverDelegate.delay(content) : hoverDelegate.delay, false, target));
            hoverPreparation = toDispose;
        };
        // Do not show hover when focusing an input or textarea
        if (!isEditableElement(targetElement)) {
            store.add(addDisposableListener(targetElement, EventType.FOCUS, onFocus, true));
        }
        const hover = {
            show: focus => {
                hideHover(false, true); // terminate a ongoing mouse over preparation
                triggerShowHover(0, focus, undefined, focus); // show hover immediately
            },
            hide: () => {
                hideHover(true, true);
            },
            update: async (newContent, hoverOptions) => {
                content = newContent;
                await hoverWidget?.update(content, undefined, hoverOptions);
            },
            dispose: () => {
                this._managedHovers.delete(targetElement);
                store.dispose();
                hideHover(true, true);
            }
        };
        this._managedHovers.set(targetElement, hover);
        return hover;
    }
    showManagedHover(target) {
        const hover = this._managedHovers.get(target);
        if (hover) {
            hover.show(true);
        }
    }
    dispose() {
        this._managedHovers.forEach(hover => hover.dispose());
        super.dispose();
    }
};
HoverService = __decorate([
    __param(0, IInstantiationService),
    __param(1, IConfigurationService),
    __param(2, IContextMenuService),
    __param(3, IKeybindingService),
    __param(4, ILayoutService),
    __param(5, IAccessibilityService)
], HoverService);
export { HoverService };
function getHoverOptionsIdentity(options) {
    if (options === undefined) {
        return undefined;
    }
    return options?.id ?? options;
}
function getHoverIdFromContent(content) {
    if (isHTMLElement(content)) {
        return undefined;
    }
    if (typeof content === 'string') {
        return content.toString();
    }
    return content.value;
}
function getStringContent(contentOrFactory) {
    const content = typeof contentOrFactory === 'function' ? contentOrFactory() : contentOrFactory;
    if (isString(content)) {
        // Icons don't render in the native hover so we strip them out
        return stripIcons(content);
    }
    if (isManagedHoverTooltipMarkdownString(content)) {
        return content.markdownNotSupportedFallback;
    }
    return undefined;
}
function setupNativeHover(targetElement, content) {
    function updateTitle(title) {
        if (title) {
            targetElement.setAttribute('title', title);
        }
        else {
            targetElement.removeAttribute('title');
        }
    }
    updateTitle(getStringContent(content));
    return {
        update: (content) => updateTitle(getStringContent(content)),
        show: () => { },
        hide: () => { },
        dispose: () => updateTitle(undefined),
    };
}
class HoverContextViewDelegate {
    get anchorPosition() {
        return this._hover.anchor;
    }
    constructor(_hover, _focus = false) {
        this._hover = _hover;
        this._focus = _focus;
        // Render over all other context views
        this.layer = 1;
    }
    render(container) {
        this._hover.render(container);
        if (this._focus) {
            this._hover.focus();
        }
        return this._hover;
    }
    getAnchor() {
        return {
            x: this._hover.x,
            y: this._hover.y
        };
    }
    layout() {
        this._hover.layout();
    }
}
function eventIsRelatedToTarget(event, target) {
    return isHTMLElement(event.target) && getHoverTargetElement(event.target, target) === target;
}
function getHoverTargetElement(element, stopElement) {
    stopElement = stopElement ?? getWindow(element).document.body;
    while (!element.hasAttribute('custom-hover') && element !== stopElement) {
        element = element.parentElement;
    }
    return element;
}
function resolveMouseStyleHoverTarget(target, e) {
    return {
        targetElements: [target],
        x: e.x + 10
    };
}
registerSingleton(IHoverService, HoverService, 1 /* InstantiationType.Delayed */);
registerThemingParticipant((theme, collector) => {
    const hoverBorder = theme.getColor(editorHoverBorder);
    if (hoverBorder) {
        collector.addRule(`.monaco-hover.workbench-hover .hover-row:not(:first-child):not(:empty) { border-top: 1px solid ${hoverBorder.transparent(0.5)}; }`);
        collector.addRule(`.monaco-hover.workbench-hover hr { border-top: 1px solid ${hoverBorder.transparent(0.5)}; }`);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG92ZXJTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXJTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNoRyxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNoRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQzNDLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUUvQyxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxZQUFZLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMzRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLHlCQUF5QixFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsYUFBYSxFQUFFLGlCQUFpQixFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDdEwsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDM0UsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFL0UsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDcEYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxpQ0FBaUMsQ0FB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