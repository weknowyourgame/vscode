/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isFirefox } from '../../browser.js';
import { EventType as TouchEventType, Gesture } from '../../touch.js';
import { $, addDisposableListener, append, clearNode, Dimension, EventHelper, EventType, getActiveElement, getWindow, isAncestor, isInShadowDOM } from '../../dom.js';
import { createStyleSheet } from '../../domStylesheets.js';
import { StandardKeyboardEvent } from '../../keyboardEvent.js';
import { StandardMouseEvent } from '../../mouseEvent.js';
import { ActionBar } from '../actionbar/actionbar.js';
import { ActionViewItem, BaseActionViewItem } from '../actionbar/actionViewItems.js';
import { layout } from '../contextview/contextview.js';
import { DomScrollableElement } from '../scrollbar/scrollableElement.js';
import { EmptySubmenuAction, Separator, SubmenuAction } from '../../../common/actions.js';
import { RunOnceScheduler } from '../../../common/async.js';
import { Codicon } from '../../../common/codicons.js';
import { getCodiconFontCharacters } from '../../../common/codiconsUtil.js';
import { ThemeIcon } from '../../../common/themables.js';
import { stripIcons } from '../../../common/iconLabels.js';
import { DisposableStore } from '../../../common/lifecycle.js';
import { isLinux, isMacintosh } from '../../../common/platform.js';
import * as strings from '../../../common/strings.js';
export const MENU_MNEMONIC_REGEX = /\(&([^\s&])\)|(^|[^&])&([^\s&])/;
export const MENU_ESCAPED_MNEMONIC_REGEX = /(&amp;)?(&amp;)([^\s&])/g;
export var HorizontalDirection;
(function (HorizontalDirection) {
    HorizontalDirection[HorizontalDirection["Right"] = 0] = "Right";
    HorizontalDirection[HorizontalDirection["Left"] = 1] = "Left";
})(HorizontalDirection || (HorizontalDirection = {}));
export var VerticalDirection;
(function (VerticalDirection) {
    VerticalDirection[VerticalDirection["Above"] = 0] = "Above";
    VerticalDirection[VerticalDirection["Below"] = 1] = "Below";
})(VerticalDirection || (VerticalDirection = {}));
export const unthemedMenuStyles = {
    shadowColor: undefined,
    borderColor: undefined,
    foregroundColor: undefined,
    backgroundColor: undefined,
    selectionForegroundColor: undefined,
    selectionBackgroundColor: undefined,
    selectionBorderColor: undefined,
    separatorColor: undefined,
    scrollbarShadow: undefined,
    scrollbarSliderBackground: undefined,
    scrollbarSliderHoverBackground: undefined,
    scrollbarSliderActiveBackground: undefined
};
export class Menu extends ActionBar {
    constructor(container, actions, options, menuStyles) {
        container.classList.add('monaco-menu-container');
        container.setAttribute('role', 'presentation');
        const menuElement = document.createElement('div');
        menuElement.classList.add('monaco-menu');
        menuElement.setAttribute('role', 'presentation');
        super(menuElement, {
            orientation: 1 /* ActionsOrientation.VERTICAL */,
            actionViewItemProvider: action => this.doGetActionViewItem(action, options, parentData),
            context: options.context,
            actionRunner: options.actionRunner,
            ariaLabel: options.ariaLabel,
            ariaRole: 'menu',
            focusOnlyEnabledItems: true,
            triggerKeys: { keys: [3 /* KeyCode.Enter */, ...(isMacintosh || isLinux ? [10 /* KeyCode.Space */] : [])], keyDown: true }
        });
        this.menuStyles = menuStyles;
        this.menuElement = menuElement;
        this.actionsList.tabIndex = 0;
        this.initializeOrUpdateStyleSheet(container, menuStyles);
        this._register(Gesture.addTarget(menuElement));
        this._register(addDisposableListener(menuElement, EventType.KEY_DOWN, (e) => {
            const event = new StandardKeyboardEvent(e);
            // Stop tab navigation of menus
            if (event.equals(2 /* KeyCode.Tab */)) {
                e.preventDefault();
            }
        }));
        if (options.enableMnemonics) {
            this._register(addDisposableListener(menuElement, EventType.KEY_DOWN, (e) => {
                const key = e.key.toLocaleLowerCase();
                const actions = this.mnemonics.get(key);
                if (actions !== undefined) {
                    EventHelper.stop(e, true);
                    if (actions.length === 1) {
                        if (actions[0] instanceof SubmenuMenuActionViewItem && actions[0].container) {
                            this.focusItemByElement(actions[0].container);
                        }
                        actions[0].onClick(e);
                    }
                    if (actions.length > 1) {
                        const action = actions.shift();
                        if (action && action.container) {
                            this.focusItemByElement(action.container);
                            actions.push(action);
                        }
                        this.mnemonics.set(key, actions);
                    }
                }
            }));
        }
        if (isLinux) {
            this._register(addDisposableListener(menuElement, EventType.KEY_DOWN, e => {
                const event = new StandardKeyboardEvent(e);
                if (event.equals(14 /* KeyCode.Home */) || event.equals(11 /* KeyCode.PageUp */)) {
                    this.focusedItem = this.viewItems.length - 1;
                    this.focusNext();
                    EventHelper.stop(e, true);
                }
                else if (event.equals(13 /* KeyCode.End */) || event.equals(12 /* KeyCode.PageDown */)) {
                    this.focusedItem = 0;
                    this.focusPrevious();
                    EventHelper.stop(e, true);
                }
            }));
        }
        this._register(addDisposableListener(this.domNode, EventType.MOUSE_OUT, e => {
            const relatedTarget = e.relatedTarget;
            if (!isAncestor(relatedTarget, this.domNode)) {
                this.focusedItem = undefined;
                this.updateFocus();
                e.stopPropagation();
            }
        }));
        this._register(addDisposableListener(this.actionsList, EventType.MOUSE_OVER, e => {
            let target = e.target;
            if (!target || !isAncestor(target, this.actionsList) || target === this.actionsList) {
                return;
            }
            while (target.parentElement !== this.actionsList && target.parentElement !== null) {
                target = target.parentElement;
            }
            if (target.classList.contains('action-item')) {
                const lastFocusedItem = this.focusedItem;
                this.setFocusedItem(target);
                if (lastFocusedItem !== this.focusedItem) {
                    this.updateFocus();
                }
            }
        }));
        // Support touch on actions list to focus items (needed for submenus)
        this._register(Gesture.addTarget(this.actionsList));
        this._register(addDisposableListener(this.actionsList, TouchEventType.Tap, e => {
            let target = e.initialTarget;
            if (!target || !isAncestor(target, this.actionsList) || target === this.actionsList) {
                return;
            }
            while (target.parentElement !== this.actionsList && target.parentElement !== null) {
                target = target.parentElement;
            }
            if (target.classList.contains('action-item')) {
                const lastFocusedItem = this.focusedItem;
                this.setFocusedItem(target);
                if (lastFocusedItem !== this.focusedItem) {
                    this.updateFocus();
                }
            }
        }));
        const parentData = {
            parent: this
        };
        this.mnemonics = new Map();
        // Scroll Logic
        this.scrollableElement = this._register(new DomScrollableElement(menuElement, {
            alwaysConsumeMouseWheel: true,
            horizontal: 2 /* ScrollbarVisibility.Hidden */,
            vertical: 3 /* ScrollbarVisibility.Visible */,
            verticalScrollbarSize: 7,
            handleMouseWheel: true,
            useShadows: true
        }));
        const scrollElement = this.scrollableElement.getDomNode();
        scrollElement.style.position = '';
        this.styleScrollElement(scrollElement, menuStyles);
        // Support scroll on menu drag
        this._register(addDisposableListener(menuElement, TouchEventType.Change, e => {
            EventHelper.stop(e, true);
            const scrollTop = this.scrollableElement.getScrollPosition().scrollTop;
            this.scrollableElement.setScrollPosition({ scrollTop: scrollTop - e.translationY });
        }));
        this._register(addDisposableListener(scrollElement, EventType.MOUSE_UP, e => {
            // Absorb clicks in menu dead space https://github.com/microsoft/vscode/issues/63575
            // We do this on the scroll element so the scroll bar doesn't dismiss the menu either
            e.preventDefault();
        }));
        const window = getWindow(container);
        menuElement.style.maxHeight = `${Math.max(10, window.innerHeight - container.getBoundingClientRect().top - 35)}px`;
        actions = actions.filter((a, idx) => {
            if (options.submenuIds?.has(a.id)) {
                console.warn(`Found submenu cycle: ${a.id}`);
                return false;
            }
            // Filter out consecutive or useless separators
            if (a instanceof Separator) {
                if (idx === actions.length - 1 || idx === 0) {
                    return false;
                }
                const prevAction = actions[idx - 1];
                if (prevAction instanceof Separator) {
                    return false;
                }
            }
            return true;
        });
        this.push(actions, { icon: true, label: true, isMenu: true });
        container.appendChild(this.scrollableElement.getDomNode());
        this.scrollableElement.scanDomNode();
        this.viewItems.filter(item => !(item instanceof MenuSeparatorActionViewItem)).forEach((item, index, array) => {
            item.updatePositionInSet(index + 1, array.length);
        });
    }
    initializeOrUpdateStyleSheet(container, style) {
        if (!this.styleSheet) {
            if (isInShadowDOM(container)) {
                this.styleSheet = createStyleSheet(container);
            }
            else {
                if (!Menu.globalStyleSheet) {
                    Menu.globalStyleSheet = createStyleSheet();
                }
                this.styleSheet = Menu.globalStyleSheet;
            }
        }
        this.styleSheet.textContent = getMenuWidgetCSS(style, isInShadowDOM(container));
    }
    styleScrollElement(scrollElement, style) {
        const fgColor = style.foregroundColor ?? '';
        const bgColor = style.backgroundColor ?? '';
        const border = style.borderColor ? `1px solid ${style.borderColor}` : '';
        const borderRadius = '5px';
        const shadow = style.shadowColor ? `0 2px 8px ${style.shadowColor}` : '';
        scrollElement.style.outline = border;
        scrollElement.style.borderRadius = borderRadius;
        scrollElement.style.color = fgColor;
        scrollElement.style.backgroundColor = bgColor;
        scrollElement.style.boxShadow = shadow;
    }
    getContainer() {
        return this.scrollableElement.getDomNode();
    }
    get onScroll() {
        return this.scrollableElement.onScroll;
    }
    get scrollOffset() {
        return this.menuElement.scrollTop;
    }
    trigger(index) {
        if (index <= this.viewItems.length && index >= 0) {
            const item = this.viewItems[index];
            if (item instanceof SubmenuMenuActionViewItem) {
                super.focus(index);
                item.open(true);
            }
            else if (item instanceof BaseMenuActionViewItem) {
                super.run(item._action, item._context);
            }
            else {
                return;
            }
        }
    }
    focusItemByElement(element) {
        const lastFocusedItem = this.focusedItem;
        this.setFocusedItem(element);
        if (lastFocusedItem !== this.focusedItem) {
            this.updateFocus();
        }
    }
    setFocusedItem(element) {
        for (let i = 0; i < this.actionsList.children.length; i++) {
            const elem = this.actionsList.children[i];
            if (element === elem) {
                this.focusedItem = i;
                break;
            }
        }
    }
    updateFocus(fromRight) {
        super.updateFocus(fromRight, true, true);
        if (typeof this.focusedItem !== 'undefined') {
            // Workaround for #80047 caused by an issue in chromium
            // https://bugs.chromium.org/p/chromium/issues/detail?id=414283
            // When that's fixed, just call this.scrollableElement.scanDomNode()
            this.scrollableElement.setScrollPosition({
                scrollTop: Math.round(this.menuElement.scrollTop)
            });
        }
    }
    doGetActionViewItem(action, options, parentData) {
        if (action instanceof Separator) {
            return new MenuSeparatorActionViewItem(options.context, action, { icon: true }, this.menuStyles);
        }
        else if (action instanceof SubmenuAction) {
            const menuActionViewItem = new SubmenuMenuActionViewItem(action, action.actions, parentData, { ...options, submenuIds: new Set([...(options.submenuIds || []), action.id]) }, this.menuStyles);
            if (options.enableMnemonics) {
                const mnemonic = menuActionViewItem.getMnemonic();
                if (mnemonic && menuActionViewItem.isEnabled()) {
                    const actionViewItems = this.mnemonics.get(mnemonic);
                    if (actionViewItems !== undefined) {
                        actionViewItems.push(menuActionViewItem);
                    }
                    else {
                        this.mnemonics.set(mnemonic, [menuActionViewItem]);
                    }
                }
            }
            return menuActionViewItem;
        }
        else {
            const keybindingLabel = options.getKeyBinding?.(action)?.getLabel();
            const menuItemOptions = {
                enableMnemonics: options.enableMnemonics,
                useEventAsContext: options.useEventAsContext,
                keybinding: keybindingLabel,
            };
            const menuActionViewItem = new BaseMenuActionViewItem(options.context, action, menuItemOptions, this.menuStyles);
            if (options.enableMnemonics) {
                const mnemonic = menuActionViewItem.getMnemonic();
                if (mnemonic && menuActionViewItem.isEnabled()) {
                    const actionViewItems = this.mnemonics.get(mnemonic);
                    if (actionViewItems !== undefined) {
                        actionViewItems.push(menuActionViewItem);
                    }
                    else {
                        this.mnemonics.set(mnemonic, [menuActionViewItem]);
                    }
                }
            }
            return menuActionViewItem;
        }
    }
}
class BaseMenuActionViewItem extends BaseActionViewItem {
    constructor(ctx, action, options, menuStyle) {
        options = {
            ...options,
            isMenu: true,
            icon: options.icon !== undefined ? options.icon : false,
            label: options.label !== undefined ? options.label : true,
        };
        super(action, action, options);
        this.menuStyle = menuStyle;
        this.options = options;
        this.cssClass = '';
        // Set mnemonic
        if (this.options.label && options.enableMnemonics) {
            const label = this.action.label;
            if (label) {
                const matches = MENU_MNEMONIC_REGEX.exec(label);
                if (matches) {
                    this.mnemonic = (!!matches[1] ? matches[1] : matches[3]).toLocaleLowerCase();
                }
            }
        }
        // Add mouse up listener later to avoid accidental clicks
        this.runOnceToEnableMouseUp = new RunOnceScheduler(() => {
            if (!this.element) {
                return;
            }
            this._register(addDisposableListener(this.element, EventType.MOUSE_UP, e => {
                // removed default prevention as it conflicts
                // with BaseActionViewItem #101537
                // add back if issues arise and link new issue
                EventHelper.stop(e, true);
                // See https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Interact_with_the_clipboard
                // > Writing to the clipboard
                // > You can use the "cut" and "copy" commands without any special
                // permission if you are using them in a short-lived event handler
                // for a user action (for example, a click handler).
                // => to get the Copy and Paste context menu actions working on Firefox,
                // there should be no timeout here
                if (isFirefox) {
                    const mouseEvent = new StandardMouseEvent(getWindow(this.element), e);
                    // Allowing right click to trigger the event causes the issue described below,
                    // but since the solution below does not work in FF, we must disable right click
                    if (mouseEvent.rightButton) {
                        return;
                    }
                    this.onClick(e);
                }
                // In all other cases, set timeout to allow context menu cancellation to trigger
                // otherwise the action will destroy the menu and a second context menu
                // will still trigger for right click.
                else {
                    setTimeout(() => {
                        this.onClick(e);
                    }, 0);
                }
            }));
            this._register(addDisposableListener(this.element, EventType.CONTEXT_MENU, e => {
                EventHelper.stop(e, true);
            }));
        }, 100);
        this._register(this.runOnceToEnableMouseUp);
    }
    render(container) {
        super.render(container);
        if (!this.element) {
            return;
        }
        this.container = container;
        this.item = append(this.element, $('a.action-menu-item'));
        if (this._action.id === Separator.ID) {
            // A separator is a presentation item
            this.item.setAttribute('role', 'presentation');
        }
        else {
            this.item.setAttribute('role', 'menuitem');
            if (this.mnemonic) {
                this.item.setAttribute('aria-keyshortcuts', `${this.mnemonic}`);
            }
        }
        this.check = append(this.item, $('span.menu-item-check' + ThemeIcon.asCSSSelector(Codicon.menuSelection)));
        this.check.setAttribute('role', 'none');
        this.label = append(this.item, $('span.action-label'));
        if (this.options.label && this.options.keybinding) {
            append(this.item, $('span.keybinding')).textContent = this.options.keybinding;
        }
        // Adds mouse up listener to actually run the action
        this.runOnceToEnableMouseUp.schedule();
        this.updateClass();
        this.updateLabel();
        this.updateTooltip();
        this.updateEnabled();
        this.updateChecked();
        this.applyStyle();
    }
    blur() {
        super.blur();
        this.applyStyle();
    }
    focus() {
        super.focus();
        this.item?.focus();
        this.applyStyle();
    }
    updatePositionInSet(pos, setSize) {
        if (this.item) {
            this.item.setAttribute('aria-posinset', `${pos}`);
            this.item.setAttribute('aria-setsize', `${setSize}`);
        }
    }
    updateLabel() {
        if (!this.label) {
            return;
        }
        if (this.options.label) {
            clearNode(this.label);
            let label = stripIcons(this.action.label);
            if (label) {
                const cleanLabel = cleanMnemonic(label);
                if (!this.options.enableMnemonics) {
                    label = cleanLabel;
                }
                this.label.setAttribute('aria-label', cleanLabel.replace(/&&/g, '&'));
                const matches = MENU_MNEMONIC_REGEX.exec(label);
                if (matches) {
                    label = strings.escape(label);
                    // This is global, reset it
                    MENU_ESCAPED_MNEMONIC_REGEX.lastIndex = 0;
                    let escMatch = MENU_ESCAPED_MNEMONIC_REGEX.exec(label);
                    // We can't use negative lookbehind so if we match our negative and skip
                    while (escMatch && escMatch[1]) {
                        escMatch = MENU_ESCAPED_MNEMONIC_REGEX.exec(label);
                    }
                    const replaceDoubleEscapes = (str) => str.replace(/&amp;&amp;/g, '&amp;');
                    if (escMatch) {
                        this.label.append(strings.ltrim(replaceDoubleEscapes(label.substr(0, escMatch.index)), ' '), $('u', { 'aria-hidden': 'true' }, escMatch[3]), strings.rtrim(replaceDoubleEscapes(label.substr(escMatch.index + escMatch[0].length)), ' '));
                    }
                    else {
                        this.label.textContent = replaceDoubleEscapes(label).trim();
                    }
                    this.item?.setAttribute('aria-keyshortcuts', (!!matches[1] ? matches[1] : matches[3]).toLocaleLowerCase());
                }
                else {
                    this.label.textContent = label.replace(/&&/g, '&').trim();
                }
            }
        }
    }
    updateTooltip() {
        // menus should function like native menus and they do not have tooltips
    }
    updateClass() {
        if (this.cssClass && this.item) {
            this.item.classList.remove(...this.cssClass.split(' '));
        }
        if (this.options.icon && this.label) {
            this.cssClass = this.action.class || '';
            this.label.classList.add('icon');
            if (this.cssClass) {
                this.label.classList.add(...this.cssClass.split(' '));
            }
            this.updateEnabled();
        }
        else if (this.label) {
            this.label.classList.remove('icon');
        }
    }
    updateEnabled() {
        if (this.action.enabled) {
            if (this.element) {
                this.element.classList.remove('disabled');
                this.element.removeAttribute('aria-disabled');
            }
            if (this.item) {
                this.item.classList.remove('disabled');
                this.item.removeAttribute('aria-disabled');
                this.item.tabIndex = 0;
            }
        }
        else {
            if (this.element) {
                this.element.classList.add('disabled');
                this.element.setAttribute('aria-disabled', 'true');
            }
            if (this.item) {
                this.item.classList.add('disabled');
                this.item.setAttribute('aria-disabled', 'true');
            }
        }
    }
    updateChecked() {
        if (!this.item) {
            return;
        }
        const checked = this.action.checked;
        this.item.classList.toggle('checked', !!checked);
        if (checked !== undefined) {
            this.item.setAttribute('role', 'menuitemcheckbox');
            this.item.setAttribute('aria-checked', checked ? 'true' : 'false');
        }
        else {
            this.item.setAttribute('role', 'menuitem');
            this.item.setAttribute('aria-checked', '');
        }
    }
    getMnemonic() {
        return this.mnemonic;
    }
    applyStyle() {
        const isSelected = this.element && this.element.classList.contains('focused');
        const fgColor = isSelected && this.menuStyle.selectionForegroundColor ? this.menuStyle.selectionForegroundColor : this.menuStyle.foregroundColor;
        const bgColor = isSelected && this.menuStyle.selectionBackgroundColor ? this.menuStyle.selectionBackgroundColor : undefined;
        const outline = isSelected && this.menuStyle.selectionBorderColor ? `1px solid ${this.menuStyle.selectionBorderColor}` : '';
        const outlineOffset = isSelected && this.menuStyle.selectionBorderColor ? `-1px` : '';
        if (this.item) {
            this.item.style.color = fgColor ?? '';
            this.item.style.backgroundColor = bgColor ?? '';
            this.item.style.outline = outline;
            this.item.style.outlineOffset = outlineOffset;
        }
        if (this.check) {
            this.check.style.color = fgColor ?? '';
        }
    }
}
class SubmenuMenuActionViewItem extends BaseMenuActionViewItem {
    constructor(action, submenuActions, parentData, submenuOptions, menuStyles) {
        super(action, action, submenuOptions, menuStyles);
        this.submenuActions = submenuActions;
        this.parentData = parentData;
        this.submenuOptions = submenuOptions;
        this.mysubmenu = null;
        this.submenuDisposables = this._register(new DisposableStore());
        this.mouseOver = false;
        this.expandDirection = submenuOptions && submenuOptions.expandDirection !== undefined ? submenuOptions.expandDirection : { horizontal: HorizontalDirection.Right, vertical: VerticalDirection.Below };
        this.showScheduler = new RunOnceScheduler(() => {
            if (this.mouseOver) {
                this.cleanupExistingSubmenu(false);
                this.createSubmenu(false);
            }
        }, 250);
        this.hideScheduler = new RunOnceScheduler(() => {
            if (this.element && (!isAncestor(getActiveElement(), this.element) && this.parentData.submenu === this.mysubmenu)) {
                this.parentData.parent.focus(false);
                this.cleanupExistingSubmenu(true);
            }
        }, 750);
    }
    render(container) {
        super.render(container);
        if (!this.element) {
            return;
        }
        if (this.item) {
            this.item.classList.add('monaco-submenu-item');
            this.item.tabIndex = 0;
            this.item.setAttribute('aria-haspopup', 'true');
            this.updateAriaExpanded('false');
            this.submenuIndicator = append(this.item, $('span.submenu-indicator' + ThemeIcon.asCSSSelector(Codicon.menuSubmenu)));
            this.submenuIndicator.setAttribute('aria-hidden', 'true');
        }
        this._register(addDisposableListener(this.element, EventType.KEY_UP, e => {
            const event = new StandardKeyboardEvent(e);
            if (event.equals(17 /* KeyCode.RightArrow */) || event.equals(3 /* KeyCode.Enter */)) {
                EventHelper.stop(e, true);
                this.createSubmenu(true);
            }
        }));
        this._register(addDisposableListener(this.element, EventType.KEY_DOWN, e => {
            const event = new StandardKeyboardEvent(e);
            if (getActiveElement() === this.item) {
                if (event.equals(17 /* KeyCode.RightArrow */) || event.equals(3 /* KeyCode.Enter */)) {
                    EventHelper.stop(e, true);
                }
            }
        }));
        this._register(addDisposableListener(this.element, EventType.MOUSE_OVER, e => {
            if (!this.mouseOver) {
                this.mouseOver = true;
                this.showScheduler.schedule();
            }
        }));
        this._register(addDisposableListener(this.element, EventType.MOUSE_LEAVE, e => {
            this.mouseOver = false;
        }));
        this._register(addDisposableListener(this.element, EventType.FOCUS_OUT, e => {
            if (this.element && !isAncestor(getActiveElement(), this.element)) {
                this.hideScheduler.schedule();
            }
        }));
        this._register(this.parentData.parent.onScroll(() => {
            if (this.parentData.submenu === this.mysubmenu) {
                this.parentData.parent.focus(false);
                this.cleanupExistingSubmenu(true);
            }
        }));
    }
    updateEnabled() {
        // override on submenu entry
        // native menus do not observe enablement on sumbenus
        // we mimic that behavior
    }
    open(selectFirst) {
        this.cleanupExistingSubmenu(false);
        this.createSubmenu(selectFirst);
    }
    onClick(e) {
        // stop clicking from trying to run an action
        EventHelper.stop(e, true);
        this.cleanupExistingSubmenu(false);
        this.createSubmenu(true);
    }
    cleanupExistingSubmenu(force) {
        if (this.parentData.submenu && (force || (this.parentData.submenu !== this.mysubmenu))) {
            // disposal may throw if the submenu has already been removed
            try {
                this.parentData.submenu.dispose();
            }
            catch { }
            this.parentData.submenu = undefined;
            this.updateAriaExpanded('false');
            if (this.submenuContainer) {
                this.submenuDisposables.clear();
                this.submenuContainer = undefined;
            }
        }
    }
    calculateSubmenuMenuLayout(windowDimensions, submenu, entry, expandDirection) {
        const ret = { top: 0, left: 0 };
        // Start with horizontal
        ret.left = layout(windowDimensions.width, submenu.width, { position: expandDirection.horizontal === HorizontalDirection.Right ? 0 /* LayoutAnchorPosition.Before */ : 1 /* LayoutAnchorPosition.After */, offset: entry.left, size: entry.width });
        // We don't have enough room to layout the menu fully, so we are overlapping the menu
        if (ret.left >= entry.left && ret.left < entry.left + entry.width) {
            if (entry.left + 10 + submenu.width <= windowDimensions.width) {
                ret.left = entry.left + 10;
            }
            entry.top += 10;
            entry.height = 0;
        }
        // Now that we have a horizontal position, try layout vertically
        ret.top = layout(windowDimensions.height, submenu.height, { position: 0 /* LayoutAnchorPosition.Before */, offset: entry.top, size: 0 });
        // We didn't have enough room below, but we did above, so we shift down to align the menu
        if (ret.top + submenu.height === entry.top && ret.top + entry.height + submenu.height <= windowDimensions.height) {
            ret.top += entry.height;
        }
        return ret;
    }
    createSubmenu(selectFirstItem = true) {
        if (!this.element) {
            return;
        }
        if (!this.parentData.submenu) {
            this.updateAriaExpanded('true');
            this.submenuContainer = append(this.element, $('div.monaco-submenu'));
            this.submenuContainer.classList.add('menubar-menu-items-holder', 'context-view');
            // Set the top value of the menu container before construction
            // This allows the menu constructor to calculate the proper max height
            const computedStyles = getWindow(this.parentData.parent.domNode).getComputedStyle(this.parentData.parent.domNode);
            const paddingTop = parseFloat(computedStyles.paddingTop || '0') || 0;
            this.submenuContainer.style.position = 'fixed';
            this.submenuContainer.style.top = '0';
            this.submenuContainer.style.left = '0';
            // Fix to #263546, for submenu of treeView view/item/context z-index issue - ensure submenu appears above other elements
            this.submenuContainer.style.zIndex = '1';
            this.parentData.submenu = new Menu(this.submenuContainer, this.submenuActions.length ? this.submenuActions : [new EmptySubmenuAction()], this.submenuOptions, this.menuStyle);
            // layout submenu
            const entryBox = this.element.getBoundingClientRect();
            const entryBoxUpdated = {
                top: entryBox.top - paddingTop,
                left: entryBox.left,
                height: entryBox.height + 2 * paddingTop,
                width: entryBox.width
            };
            const viewBox = this.submenuContainer.getBoundingClientRect();
            const window = getWindow(this.element);
            const { top, left } = this.calculateSubmenuMenuLayout(new Dimension(window.innerWidth, window.innerHeight), Dimension.lift(viewBox), entryBoxUpdated, this.expandDirection);
            // subtract offsets caused by transform parent
            this.submenuContainer.style.left = `${left - viewBox.left}px`;
            this.submenuContainer.style.top = `${top - viewBox.top}px`;
            this.submenuDisposables.add(addDisposableListener(this.submenuContainer, EventType.KEY_UP, e => {
                const event = new StandardKeyboardEvent(e);
                if (event.equals(15 /* KeyCode.LeftArrow */)) {
                    EventHelper.stop(e, true);
                    this.parentData.parent.focus();
                    this.cleanupExistingSubmenu(true);
                }
            }));
            this.submenuDisposables.add(addDisposableListener(this.submenuContainer, EventType.KEY_DOWN, e => {
                const event = new StandardKeyboardEvent(e);
                if (event.equals(15 /* KeyCode.LeftArrow */)) {
                    EventHelper.stop(e, true);
                }
            }));
            this.submenuDisposables.add(this.parentData.submenu.onDidCancel(() => {
                this.parentData.parent.focus();
                this.cleanupExistingSubmenu(true);
            }));
            this.parentData.submenu.focus(selectFirstItem);
            this.mysubmenu = this.parentData.submenu;
        }
        else {
            this.parentData.submenu.focus(false);
        }
    }
    updateAriaExpanded(value) {
        if (this.item) {
            this.item?.setAttribute('aria-expanded', value);
        }
    }
    applyStyle() {
        super.applyStyle();
        const isSelected = this.element && this.element.classList.contains('focused');
        const fgColor = isSelected && this.menuStyle.selectionForegroundColor ? this.menuStyle.selectionForegroundColor : this.menuStyle.foregroundColor;
        if (this.submenuIndicator) {
            this.submenuIndicator.style.color = fgColor ?? '';
        }
    }
    dispose() {
        super.dispose();
        this.hideScheduler.dispose();
        if (this.mysubmenu) {
            this.mysubmenu.dispose();
            this.mysubmenu = null;
        }
        if (this.submenuContainer) {
            this.submenuContainer = undefined;
        }
    }
}
class MenuSeparatorActionViewItem extends ActionViewItem {
    constructor(context, action, options, menuStyles) {
        super(context, action, options);
        this.menuStyles = menuStyles;
    }
    render(container) {
        super.render(container);
        if (this.label) {
            this.label.style.borderBottomColor = this.menuStyles.separatorColor ? `${this.menuStyles.separatorColor}` : '';
        }
    }
}
export function cleanMnemonic(label) {
    const regex = MENU_MNEMONIC_REGEX;
    const matches = regex.exec(label);
    if (!matches) {
        return label;
    }
    const mnemonicInText = !matches[1];
    return label.replace(regex, mnemonicInText ? '$2$3' : '').trim();
}
export function formatRule(c) {
    const fontCharacter = getCodiconFontCharacters()[c.id];
    return `.codicon-${c.id}:before { content: '\\${fontCharacter.toString(16)}'; }`;
}
export function getMenuWidgetCSS(style, isForShadowDom) {
    let result = /* css */ `
.monaco-menu {
	font-size: 13px;
	border-radius: 5px;
	min-width: 160px;
}

${formatRule(Codicon.menuSelection)}
${formatRule(Codicon.menuSubmenu)}

.monaco-menu .monaco-action-bar {
	text-align: right;
	overflow: hidden;
	white-space: nowrap;
}

.monaco-menu .monaco-action-bar .actions-container {
	display: flex;
	margin: 0 auto;
	padding: 0;
	width: 100%;
	justify-content: flex-end;
}

.monaco-menu .monaco-action-bar.vertical .actions-container {
	display: inline-block;
}

.monaco-menu .monaco-action-bar.reverse .actions-container {
	flex-direction: row-reverse;
}

.monaco-menu .monaco-action-bar .action-item {
	cursor: pointer;
	display: inline-block;
	transition: transform 50ms ease;
	position: relative;  /* DO NOT REMOVE - this is the key to preventing the ghosting icon bug in Chrome 42 */
}

.monaco-menu .monaco-action-bar .action-item.disabled {
	cursor: default;
}

.monaco-menu .monaco-action-bar .action-item .icon,
.monaco-menu .monaco-action-bar .action-item .codicon {
	display: inline-block;
}

.monaco-menu .monaco-action-bar .action-item .codicon {
	display: flex;
	align-items: center;
}

.monaco-menu .monaco-action-bar .action-label {
	font-size: 11px;
	margin-right: 4px;
}

.monaco-menu .monaco-action-bar .action-item.disabled .action-label,
.monaco-menu .monaco-action-bar .action-item.disabled .action-label:hover {
	color: var(--vscode-disabledForeground);
}

/* Vertical actions */

.monaco-menu .monaco-action-bar.vertical {
	text-align: left;
}

.monaco-menu .monaco-action-bar.vertical .action-item {
	display: block;
}

.monaco-menu .monaco-action-bar.vertical .action-label.separator {
	display: block;
	border-bottom: 1px solid var(--vscode-menu-separatorBackground);
	padding-top: 1px;
	padding: 30px;
}

.monaco-menu .secondary-actions .monaco-action-bar .action-label {
	margin-left: 6px;
}

/* Action Items */
.monaco-menu .monaco-action-bar .action-item.select-container {
	overflow: hidden; /* somehow the dropdown overflows its container, we prevent it here to not push */
	flex: 1;
	max-width: 170px;
	min-width: 60px;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 10px;
}

.monaco-menu .monaco-action-bar.vertical {
	margin-left: 0;
	overflow: visible;
}

.monaco-menu .monaco-action-bar.vertical .actions-container {
	display: block;
}

.monaco-menu .monaco-action-bar.vertical .action-item {
	padding: 0;
	transform: none;
	display: flex;
}

.monaco-menu .monaco-action-bar.vertical .action-item.active {
	transform: none;
}

.monaco-menu .monaco-action-bar.vertical .action-menu-item {
	flex: 1 1 auto;
	display: flex;
	height: 2em;
	align-items: center;
	position: relative;
	margin: 0 4px;
	border-radius: 4px;
}

.monaco-menu .monaco-action-bar.vertical .action-menu-item:hover .keybinding,
.monaco-menu .monaco-action-bar.vertical .action-menu-item:focus .keybinding {
	opacity: unset;
}

.monaco-menu .monaco-action-bar.vertical .action-label {
	flex: 1 1 auto;
	text-decoration: none;
	padding: 0 1em;
	background: none;
	font-size: 12px;
	line-height: 1;
}

.monaco-menu .monaco-action-bar.vertical .keybinding,
.monaco-menu .monaco-action-bar.vertical .submenu-indicator {
	display: inline-block;
	flex: 2 1 auto;
	padding: 0 1em;
	text-align: right;
	font-size: 12px;
	line-height: 1;
	opacity: 0.7;
}

.monaco-menu .monaco-action-bar.vertical .submenu-indicator {
	height: 100%;
}

.monaco-menu .monaco-action-bar.vertical .submenu-indicator.codicon {
	font-size: 16px !important;
	display: flex;
	align-items: center;
}

.monaco-menu .monaco-action-bar.vertical .submenu-indicator.codicon::before {
	margin-left: auto;
	margin-right: -20px;
}

.monaco-menu .monaco-action-bar.vertical .action-item.disabled .keybinding,
.monaco-menu .monaco-action-bar.vertical .action-item.disabled .submenu-indicator {
	opacity: 0.4;
}

.monaco-menu .monaco-action-bar.vertical .action-label:not(.separator) {
	display: inline-block;
	box-sizing: border-box;
	margin: 0;
}

.monaco-menu .monaco-action-bar.vertical .action-item {
	position: static;
	overflow: visible;
}

.monaco-menu .monaco-action-bar.vertical .action-item .monaco-submenu {
	position: absolute;
}

.monaco-menu .monaco-action-bar.vertical .action-label.separator {
	width: 100%;
	height: 0px !important;
	opacity: 1;
}

.monaco-menu .monaco-action-bar.vertical .action-label.separator.text {
	padding: 0.7em 1em 0.1em 1em;
	font-weight: bold;
	opacity: 1;
}

.monaco-menu .monaco-action-bar.vertical .action-label:hover {
	color: inherit;
}

.monaco-menu .monaco-action-bar.vertical .menu-item-check {
	position: absolute;
	visibility: hidden;
	width: 1em;
	height: 100%;
}

.monaco-menu .monaco-action-bar.vertical .action-menu-item.checked .menu-item-check {
	visibility: visible;
	display: flex;
	align-items: center;
	justify-content: center;
}

/* Context Menu */

.context-view.monaco-menu-container {
	outline: 0;
	border: none;
	animation: fadeIn 0.083s linear;
	-webkit-app-region: no-drag;
}

.context-view.monaco-menu-container :focus,
.context-view.monaco-menu-container .monaco-action-bar.vertical:focus,
.context-view.monaco-menu-container .monaco-action-bar.vertical :focus {
	outline: 0;
}

.hc-black .context-view.monaco-menu-container,
.hc-light .context-view.monaco-menu-container,
:host-context(.hc-black) .context-view.monaco-menu-container,
:host-context(.hc-light) .context-view.monaco-menu-container {
	box-shadow: none;
}

.hc-black .monaco-menu .monaco-action-bar.vertical .action-item.focused,
.hc-light .monaco-menu .monaco-action-bar.vertical .action-item.focused,
:host-context(.hc-black) .monaco-menu .monaco-action-bar.vertical .action-item.focused,
:host-context(.hc-light) .monaco-menu .monaco-action-bar.vertical .action-item.focused {
	background: none;
}

/* Vertical Action Bar Styles */

.monaco-menu .monaco-action-bar.vertical {
	padding: 4px 0;
}

.monaco-menu .monaco-action-bar.vertical .action-menu-item {
	height: 2em;
}

.monaco-menu .monaco-action-bar.vertical .action-label:not(.separator),
.monaco-menu .monaco-action-bar.vertical .keybinding {
	font-size: inherit;
	padding: 0 2em;
	max-height: 100%;
}

.monaco-menu .monaco-action-bar.vertical .menu-item-check {
	font-size: inherit;
	width: 2em;
}

.monaco-menu .monaco-action-bar.vertical .action-label.separator {
	font-size: inherit;
	margin: 5px 0 !important;
	padding: 0;
	border-radius: 0;
}

.linux .monaco-menu .monaco-action-bar.vertical .action-label.separator,
:host-context(.linux) .monaco-menu .monaco-action-bar.vertical .action-label.separator {
	margin-left: 0;
	margin-right: 0;
}

.monaco-menu .monaco-action-bar.vertical .submenu-indicator {
	font-size: 60%;
	padding: 0 1.8em;
}

.linux .monaco-menu .monaco-action-bar.vertical .submenu-indicator,
:host-context(.linux) .monaco-menu .monaco-action-bar.vertical .submenu-indicator {
	height: 100%;
	mask-size: 10px 10px;
	-webkit-mask-size: 10px 10px;
}

.monaco-menu .action-item {
	cursor: default;
}`;
    if (isForShadowDom) {
        // Only define scrollbar styles when used inside shadow dom,
        // otherwise leave their styling to the global workbench styling.
        result += `
			/* Arrows */
			.monaco-scrollable-element > .scrollbar > .scra {
				cursor: pointer;
				font-size: 11px !important;
			}

			.monaco-scrollable-element > .visible {
				opacity: 1;

				/* Background rule added for IE9 - to allow clicks on dom node */
				background:rgba(0,0,0,0);

				transition: opacity 100ms linear;
			}
			.monaco-scrollable-element > .invisible {
				opacity: 0;
				pointer-events: none;
			}
			.monaco-scrollable-element > .invisible.fade {
				transition: opacity 800ms linear;
			}

			/* Scrollable Content Inset Shadow */
			.monaco-scrollable-element > .shadow {
				position: absolute;
				display: none;
			}
			.monaco-scrollable-element > .shadow.top {
				display: block;
				top: 0;
				left: 3px;
				height: 3px;
				width: 100%;
			}
			.monaco-scrollable-element > .shadow.left {
				display: block;
				top: 3px;
				left: 0;
				height: 100%;
				width: 3px;
			}
			.monaco-scrollable-element > .shadow.top-left-corner {
				display: block;
				top: 0;
				left: 0;
				height: 3px;
				width: 3px;
			}
			/* Fix for https://github.com/microsoft/vscode/issues/103170 */
			.monaco-menu .action-item .monaco-submenu {
				z-index: 1;
			}
		`;
        // Scrollbars
        const scrollbarShadowColor = style.scrollbarShadow;
        if (scrollbarShadowColor) {
            result += `
				.monaco-scrollable-element > .shadow.top {
					box-shadow: ${scrollbarShadowColor} 0 6px 6px -6px inset;
				}

				.monaco-scrollable-element > .shadow.left {
					box-shadow: ${scrollbarShadowColor} 6px 0 6px -6px inset;
				}

				.monaco-scrollable-element > .shadow.top.left {
					box-shadow: ${scrollbarShadowColor} 6px 6px 6px -6px inset;
				}
			`;
        }
        const scrollbarSliderBackgroundColor = style.scrollbarSliderBackground;
        if (scrollbarSliderBackgroundColor) {
            result += `
				.monaco-scrollable-element > .scrollbar > .slider {
					background: ${scrollbarSliderBackgroundColor};
				}
			`;
        }
        const scrollbarSliderHoverBackgroundColor = style.scrollbarSliderHoverBackground;
        if (scrollbarSliderHoverBackgroundColor) {
            result += `
				.monaco-scrollable-element > .scrollbar > .slider:hover {
					background: ${scrollbarSliderHoverBackgroundColor};
				}
			`;
        }
        const scrollbarSliderActiveBackgroundColor = style.scrollbarSliderActiveBackground;
        if (scrollbarSliderActiveBackgroundColor) {
            result += `
				.monaco-scrollable-element > .scrollbar > .slider.active {
					background: ${scrollbarSliderActiveBackgroundColor};
				}
			`;
        }
    }
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVudS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2Jyb3dzZXIvdWkvbWVudS9tZW51LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUM3QyxPQUFPLEVBQUUsU0FBUyxJQUFJLGNBQWMsRUFBRSxPQUFPLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUN0RSxPQUFPLEVBQUUsQ0FBQyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBYSxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxFQUF3QixVQUFVLEVBQUUsYUFBYSxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ3ZNLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQzNELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQy9ELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQ3pELE9BQU8sRUFBRSxTQUFTLEVBQStDLE1BQU0sMkJBQTJCLENBQUM7QUFDbkcsT0FBTyxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBMEIsTUFBTSxpQ0FBaUMsQ0FBQztBQUM3RyxPQUFPLEVBQW1CLE1BQU0sRUFBd0IsTUFBTSwrQkFBK0IsQ0FBQztBQUM5RixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsa0JBQWtCLEVBQTBCLFNBQVMsRUFBRSxhQUFhLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNsSCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDdEQsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDM0UsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRXpELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUczRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDL0QsT0FBTyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUVuRSxPQUFPLEtBQUssT0FBTyxNQUFNLDRCQUE0QixDQUFDO0FBRXRELE1BQU0sQ0FBQyxNQUFNLG1CQUFtQixHQUFHLGlDQUFpQyxDQUFDO0FBQ3JFLE1BQU0sQ0FBQyxNQUFNLDJCQUEyQixHQUFHLDBCQUEwQixDQUFDO0FBSXRFLE1BQU0sQ0FBTixJQUFZLG1CQUdYO0FBSEQsV0FBWSxtQkFBbUI7SUFDOUIsK0RBQUssQ0FBQTtJQUNMLDZEQUFJLENBQUE7QUFDTCxDQUFDLEVBSFcsbUJBQW1CLEtBQW5CLG1CQUFtQixRQUc5QjtBQUVELE1BQU0sQ0FBTixJQUFZLGlCQUdYO0FBSEQsV0FBWSxpQkFBaUI7SUFDNUIsMkRBQUssQ0FBQTtJQUNMLDJEQUFLLENBQUE7QUFDTixDQUFDLEVBSFcsaUJBQWlCLEtBQWpCLGlCQUFpQixRQUc1QjtBQW1DRCxNQUFNLENBQUMsTUFBTSxrQkFBa0IsR0FBZ0I7SUFDOUMsV0FBVyxFQUFFLFNBQVM7SUFDdEIsV0FBVyxFQUFFLFNBQVM7SUFDdEIsZUFBZSxFQUFFLFNBQVM7SUFDMUIsZUFBZSxFQUFFLFNBQVM7SUFDMUIsd0JBQXdCLEVBQUUsU0FBUztJQUNuQyx3QkFBd0IsRUFBRSxTQUFTO0lBQ25DLG9CQUFvQixFQUFFLFNBQVM7SUFDL0IsY0FBYyxFQUFFLFNBQVM7SUFDekIsZUFBZSxFQUFFLFNBQVM7SUFDMUIseUJBQXlCLEVBQUUsU0FBUztJQUNwQyw4QkFBOEIsRUFBRSxTQUFTO0lBQ3pDLCtCQUErQixFQUFFLFNBQVM7Q0FDMUMsQ0FBQztBQU9GLE1BQU0sT0FBTyxJQUFLLFNBQVEsU0FBUztJQU9sQyxZQUFZLFNBQXNCLEVBQUUsT0FBK0IsRUFBRSxPQUFxQixFQUFtQixVQUF1QjtRQUNuSSxTQUFTLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQ2pELFNBQVMsQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQy9DLE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbEQsV0FBVyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDekMsV0FBVyxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFFakQsS0FBSyxDQUFDLFdBQVcsRUFBRTtZQUNsQixXQUFXLHFDQUE2QjtZQUN4QyxzQkFBc0IsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQztZQUN2RixPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU87WUFDeEIsWUFBWSxFQUFFLE9BQU8sQ0FBQyxZQUFZO1lBQ2xDLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUztZQUM1QixRQUFRLEVBQUUsTUFBTTtZQUNoQixxQkFBcUIsRUFBRSxJQUFJO1lBQzNCLFdBQVcsRUFBRSxFQUFFLElBQUksRUFBRSx3QkFBZ0IsR0FBRyxDQUFDLFdBQVcsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLHdCQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTtTQUN6RyxDQUFDLENBQUM7UUFoQnlHLGVBQVUsR0FBVixVQUFVLENBQWE7UUFrQm5JLElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1FBRS9CLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQztRQUU5QixJQUFJLENBQUMsNEJBQTRCLENBQUMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBRXpELElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBRS9DLElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRTtZQUMzRSxNQUFNLEtBQUssR0FBRyxJQUFJLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRTNDLCtCQUErQjtZQUMvQixJQUFJLEtBQUssQ0FBQyxNQUFNLHFCQUFhLEVBQUUsQ0FBQztnQkFDL0IsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3BCLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosSUFBSSxPQUFPLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDN0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFO2dCQUMzRSxNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3RDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN4QyxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUUsQ0FBQztvQkFDM0IsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBRTFCLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQzt3QkFDMUIsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLFlBQVkseUJBQXlCLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDOzRCQUM3RSxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO3dCQUMvQyxDQUFDO3dCQUVELE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3ZCLENBQUM7b0JBRUQsSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO3dCQUN4QixNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7d0JBQy9CLElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQzs0QkFDaEMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQzs0QkFDMUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQzt3QkFDdEIsQ0FBQzt3QkFFRCxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7b0JBQ2xDLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNiLElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEVBQUU7Z0JBQ3pFLE1BQU0sS0FBSyxHQUFHLElBQUkscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRTNDLElBQUksS0FBSyxDQUFDLE1BQU0sdUJBQWMsSUFBSSxLQUFLLENBQUMsTUFBTSx5QkFBZ0IsRUFBRSxDQUFDO29CQUNoRSxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztvQkFDN0MsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO29CQUNqQixXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDM0IsQ0FBQztxQkFBTSxJQUFJLEtBQUssQ0FBQyxNQUFNLHNCQUFhLElBQUksS0FBSyxDQUFDLE1BQU0sMkJBQWtCLEVBQUUsQ0FBQztvQkFDeEUsSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUM7b0JBQ3JCLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztvQkFDckIsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzNCLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQzNFLE1BQU0sYUFBYSxHQUFHLENBQUMsQ0FBQyxhQUE0QixDQUFDO1lBQ3JELElBQUksQ0FBQyxVQUFVLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUM5QyxJQUFJLENBQUMsV0FBVyxHQUFHLFNBQVMsQ0FBQztnQkFDN0IsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUNuQixDQUFDLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDckIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUNoRixJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBcUIsQ0FBQztZQUNyQyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksTUFBTSxLQUFLLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDckYsT0FBTztZQUNSLENBQUM7WUFFRCxPQUFPLE1BQU0sQ0FBQyxhQUFhLEtBQUssSUFBSSxDQUFDLFdBQVcsSUFBSSxNQUFNLENBQUMsYUFBYSxLQUFLLElBQUksRUFBRSxDQUFDO2dCQUNuRixNQUFNLEdBQUcsTUFBTSxDQUFDLGFBQWEsQ0FBQztZQUMvQixDQUFDO1lBRUQsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDO2dCQUM5QyxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDO2dCQUN6QyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUU1QixJQUFJLGVBQWUsS0FBSyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQzFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDcEIsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUoscUVBQXFFO1FBQ3JFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsY0FBYyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUM5RSxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUMsYUFBNEIsQ0FBQztZQUM1QyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksTUFBTSxLQUFLLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDckYsT0FBTztZQUNSLENBQUM7WUFFRCxPQUFPLE1BQU0sQ0FBQyxhQUFhLEtBQUssSUFBSSxDQUFDLFdBQVcsSUFBSSxNQUFNLENBQUMsYUFBYSxLQUFLLElBQUksRUFBRSxDQUFDO2dCQUNuRixNQUFNLEdBQUcsTUFBTSxDQUFDLGFBQWEsQ0FBQztZQUMvQixDQUFDO1lBRUQsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDO2dCQUM5QyxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDO2dCQUN6QyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUU1QixJQUFJLGVBQWUsS0FBSyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQzFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDcEIsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBR0osTUFBTSxVQUFVLEdBQWlCO1lBQ2hDLE1BQU0sRUFBRSxJQUFJO1NBQ1osQ0FBQztRQUVGLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxHQUFHLEVBQXlDLENBQUM7UUFFbEUsZUFBZTtRQUNmLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksb0JBQW9CLENBQUMsV0FBVyxFQUFFO1lBQzdFLHVCQUF1QixFQUFFLElBQUk7WUFDN0IsVUFBVSxvQ0FBNEI7WUFDdEMsUUFBUSxxQ0FBNkI7WUFDckMscUJBQXFCLEVBQUUsQ0FBQztZQUN4QixnQkFBZ0IsRUFBRSxJQUFJO1lBQ3RCLFVBQVUsRUFBRSxJQUFJO1NBQ2hCLENBQUMsQ0FBQyxDQUFDO1FBRUosTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQzFELGFBQWEsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztRQUVsQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBRW5ELDhCQUE4QjtRQUM5QixJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLFdBQVcsRUFBRSxjQUFjLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQzVFLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBRTFCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLFNBQVMsQ0FBQztZQUN2RSxJQUFJLENBQUMsaUJBQWlCLENBQUMsaUJBQWlCLENBQUMsRUFBRSxTQUFTLEVBQUUsU0FBUyxHQUFHLENBQUMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO1FBQ3JGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLGFBQWEsRUFBRSxTQUFTLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQzNFLG9GQUFvRjtZQUNwRixxRkFBcUY7WUFDckYsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3BCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDcEMsV0FBVyxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsV0FBVyxHQUFHLFNBQVMsQ0FBQyxxQkFBcUIsRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDO1FBRW5ILE9BQU8sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxFQUFFO1lBQ25DLElBQUksT0FBTyxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7Z0JBQ25DLE9BQU8sQ0FBQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUM3QyxPQUFPLEtBQUssQ0FBQztZQUNkLENBQUM7WUFFRCwrQ0FBK0M7WUFDL0MsSUFBSSxDQUFDLFlBQVksU0FBUyxFQUFFLENBQUM7Z0JBQzVCLElBQUksR0FBRyxLQUFLLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQztvQkFDN0MsT0FBTyxLQUFLLENBQUM7Z0JBQ2QsQ0FBQztnQkFFRCxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNwQyxJQUFJLFVBQVUsWUFBWSxTQUFTLEVBQUUsQ0FBQztvQkFDckMsT0FBTyxLQUFLLENBQUM7Z0JBQ2QsQ0FBQztZQUNGLENBQUM7WUFFRCxPQUFPLElBQUksQ0FBQztRQUNiLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFFOUQsU0FBUyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztRQUMzRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFckMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxZQUFZLDJCQUEyQixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQzNHLElBQStCLENBQUMsbUJBQW1CLENBQUMsS0FBSyxHQUFHLENBQUMsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDL0UsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU8sNEJBQTRCLENBQUMsU0FBc0IsRUFBRSxLQUFrQjtRQUM5RSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3RCLElBQUksYUFBYSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7Z0JBQzlCLElBQUksQ0FBQyxVQUFVLEdBQUcsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDL0MsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztvQkFDNUIsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixFQUFFLENBQUM7Z0JBQzVDLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUM7WUFDekMsQ0FBQztRQUNGLENBQUM7UUFDRCxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsR0FBRyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7SUFDakYsQ0FBQztJQUVPLGtCQUFrQixDQUFDLGFBQTBCLEVBQUUsS0FBa0I7UUFFeEUsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLGVBQWUsSUFBSSxFQUFFLENBQUM7UUFDNUMsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLGVBQWUsSUFBSSxFQUFFLENBQUM7UUFDNUMsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsYUFBYSxLQUFLLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUN6RSxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUM7UUFDM0IsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsYUFBYSxLQUFLLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUV6RSxhQUFhLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFDckMsYUFBYSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDO1FBQ2hELGFBQWEsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQztRQUNwQyxhQUFhLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxPQUFPLENBQUM7UUFDOUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDO0lBQ3hDLENBQUM7SUFFUSxZQUFZO1FBQ3BCLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQzVDLENBQUM7SUFFRCxJQUFJLFFBQVE7UUFDWCxPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUM7SUFDeEMsQ0FBQztJQUVELElBQUksWUFBWTtRQUNmLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUM7SUFDbkMsQ0FBQztJQUVELE9BQU8sQ0FBQyxLQUFhO1FBQ3BCLElBQUksS0FBSyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxJQUFJLEtBQUssSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUNsRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25DLElBQUksSUFBSSxZQUFZLHlCQUF5QixFQUFFLENBQUM7Z0JBQy9DLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ25CLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDakIsQ0FBQztpQkFBTSxJQUFJLElBQUksWUFBWSxzQkFBc0IsRUFBRSxDQUFDO2dCQUNuRCxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3hDLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxPQUFPO1lBQ1IsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRU8sa0JBQWtCLENBQUMsT0FBb0I7UUFDOUMsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUN6QyxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTdCLElBQUksZUFBZSxLQUFLLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUMxQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDcEIsQ0FBQztJQUNGLENBQUM7SUFFTyxjQUFjLENBQUMsT0FBb0I7UUFDMUMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQzNELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzFDLElBQUksT0FBTyxLQUFLLElBQUksRUFBRSxDQUFDO2dCQUN0QixJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQztnQkFDckIsTUFBTTtZQUNQLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVrQixXQUFXLENBQUMsU0FBbUI7UUFDakQsS0FBSyxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRXpDLElBQUksT0FBTyxJQUFJLENBQUMsV0FBVyxLQUFLLFdBQVcsRUFBRSxDQUFDO1lBQzdDLHVEQUF1RDtZQUN2RCwrREFBK0Q7WUFDL0Qsb0VBQW9FO1lBQ3BFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUIsQ0FBQztnQkFDeEMsU0FBUyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUM7YUFDakQsQ0FBQyxDQUFDO1FBQ0osQ0FBQztJQUNGLENBQUM7SUFFTyxtQkFBbUIsQ0FBQyxNQUFlLEVBQUUsT0FBcUIsRUFBRSxVQUF3QjtRQUMzRixJQUFJLE1BQU0sWUFBWSxTQUFTLEVBQUUsQ0FBQztZQUNqQyxPQUFPLElBQUksMkJBQTJCLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2xHLENBQUM7YUFBTSxJQUFJLE1BQU0sWUFBWSxhQUFhLEVBQUUsQ0FBQztZQUM1QyxNQUFNLGtCQUFrQixHQUFHLElBQUkseUJBQXlCLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLEVBQUUsR0FBRyxPQUFPLEVBQUUsVUFBVSxFQUFFLElBQUksR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxVQUFVLElBQUksRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFFL0wsSUFBSSxPQUFPLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQzdCLE1BQU0sUUFBUSxHQUFHLGtCQUFrQixDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUNsRCxJQUFJLFFBQVEsSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDO29CQUNoRCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFDckQsSUFBSSxlQUFlLEtBQUssU0FBUyxFQUFFLENBQUM7d0JBQ25DLGVBQWUsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztvQkFDMUMsQ0FBQzt5QkFBTSxDQUFDO3dCQUNQLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztvQkFDcEQsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztZQUVELE9BQU8sa0JBQWtCLENBQUM7UUFDM0IsQ0FBQzthQUFNLENBQUM7WUFDUCxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsYUFBYSxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUM7WUFDcEUsTUFBTSxlQUFlLEdBQXFCO2dCQUN6QyxlQUFlLEVBQUUsT0FBTyxDQUFDLGVBQWU7Z0JBQ3hDLGlCQUFpQixFQUFFLE9BQU8sQ0FBQyxpQkFBaUI7Z0JBQzVDLFVBQVUsRUFBRSxlQUFlO2FBQzNCLENBQUM7WUFFRixNQUFNLGtCQUFrQixHQUFHLElBQUksc0JBQXNCLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUVqSCxJQUFJLE9BQU8sQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDN0IsTUFBTSxRQUFRLEdBQUcsa0JBQWtCLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ2xELElBQUksUUFBUSxJQUFJLGtCQUFrQixDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUM7b0JBQ2hELE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUNyRCxJQUFJLGVBQWUsS0FBSyxTQUFTLEVBQUUsQ0FBQzt3QkFDbkMsZUFBZSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO29CQUMxQyxDQUFDO3lCQUFNLENBQUM7d0JBQ1AsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO29CQUNwRCxDQUFDO2dCQUNGLENBQUM7WUFDRixDQUFDO1lBRUQsT0FBTyxrQkFBa0IsQ0FBQztRQUMzQixDQUFDO0lBQ0YsQ0FBQztDQUNEO0FBTUQsTUFBTSxzQkFBdUIsU0FBUSxrQkFBa0I7SUFhdEQsWUFBWSxHQUFZLEVBQUUsTUFBZSxFQUFFLE9BQXlCLEVBQXFCLFNBQXNCO1FBQzlHLE9BQU8sR0FBRztZQUNULEdBQUcsT0FBTztZQUNWLE1BQU0sRUFBRSxJQUFJO1lBQ1osSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLO1lBQ3ZELEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSTtTQUN6RCxDQUFDO1FBQ0YsS0FBSyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFQeUQsY0FBUyxHQUFULFNBQVMsQ0FBYTtRQVM5RyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztRQUVuQixlQUFlO1FBQ2YsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssSUFBSSxPQUFPLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDbkQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7WUFDaEMsSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDWCxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ2hELElBQUksT0FBTyxFQUFFLENBQUM7b0JBQ2IsSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztnQkFDOUUsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQseURBQXlEO1FBQ3pELElBQUksQ0FBQyxzQkFBc0IsR0FBRyxJQUFJLGdCQUFnQixDQUFDLEdBQUcsRUFBRTtZQUN2RCxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNuQixPQUFPO1lBQ1IsQ0FBQztZQUVELElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxFQUFFO2dCQUMxRSw2Q0FBNkM7Z0JBQzdDLGtDQUFrQztnQkFDbEMsOENBQThDO2dCQUM5QyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFFMUIsNEZBQTRGO2dCQUM1Riw2QkFBNkI7Z0JBQzdCLGtFQUFrRTtnQkFDbEUsa0VBQWtFO2dCQUNsRSxvREFBb0Q7Z0JBRXBELHdFQUF3RTtnQkFDeEUsa0NBQWtDO2dCQUNsQyxJQUFJLFNBQVMsRUFBRSxDQUFDO29CQUNmLE1BQU0sVUFBVSxHQUFHLElBQUksa0JBQWtCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFFdEUsOEVBQThFO29CQUM5RSxnRkFBZ0Y7b0JBQ2hGLElBQUksVUFBVSxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUM1QixPQUFPO29CQUNSLENBQUM7b0JBRUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDakIsQ0FBQztnQkFFRCxnRkFBZ0Y7Z0JBQ2hGLHVFQUF1RTtnQkFDdkUsc0NBQXNDO3FCQUNqQyxDQUFDO29CQUNMLFVBQVUsQ0FBQyxHQUFHLEVBQUU7d0JBQ2YsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDakIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNQLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRUosSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLEVBQUU7Z0JBQzlFLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzNCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFUixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFUSxNQUFNLENBQUMsU0FBc0I7UUFDckMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUV4QixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ25CLE9BQU87UUFDUixDQUFDO1FBRUQsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFFM0IsSUFBSSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO1FBQzFELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEtBQUssU0FBUyxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ3RDLHFDQUFxQztZQUNyQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDaEQsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDM0MsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ25CLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLG1CQUFtQixFQUFFLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDakUsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxzQkFBc0IsR0FBRyxTQUFTLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDM0csSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRXhDLElBQUksQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztRQUV2RCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDbkQsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUM7UUFDL0UsQ0FBQztRQUVELG9EQUFvRDtRQUNwRCxJQUFJLENBQUMsc0JBQXNCLENBQUMsUUFBUSxFQUFFLENBQUM7UUFFdkMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ25CLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNuQixJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDckIsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUVyQixJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDbkIsQ0FBQztJQUVRLElBQUk7UUFDWixLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDYixJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDbkIsQ0FBQztJQUVRLEtBQUs7UUFDYixLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFZCxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDO1FBRW5CLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUNuQixDQUFDO0lBRUQsbUJBQW1CLENBQUMsR0FBVyxFQUFFLE9BQWU7UUFDL0MsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDZixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLEVBQUUsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1lBQ2xELElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsRUFBRSxHQUFHLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDdEQsQ0FBQztJQUNGLENBQUM7SUFFa0IsV0FBVztRQUM3QixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2pCLE9BQU87UUFDUixDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3hCLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFdEIsSUFBSSxLQUFLLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDMUMsSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDWCxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3hDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsRUFBRSxDQUFDO29CQUNuQyxLQUFLLEdBQUcsVUFBVSxDQUFDO2dCQUNwQixDQUFDO2dCQUVELElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUV0RSxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBRWhELElBQUksT0FBTyxFQUFFLENBQUM7b0JBQ2IsS0FBSyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBRTlCLDJCQUEyQjtvQkFDM0IsMkJBQTJCLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztvQkFDMUMsSUFBSSxRQUFRLEdBQUcsMkJBQTJCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUV2RCx3RUFBd0U7b0JBQ3hFLE9BQU8sUUFBUSxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO3dCQUNoQyxRQUFRLEdBQUcsMkJBQTJCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUNwRCxDQUFDO29CQUVELE1BQU0sb0JBQW9CLEdBQUcsQ0FBQyxHQUFXLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxDQUFDO29CQUVsRixJQUFJLFFBQVEsRUFBRSxDQUFDO3dCQUNkLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUNoQixPQUFPLENBQUMsS0FBSyxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUN6RSxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxFQUMvQixRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFDYixPQUFPLENBQUMsS0FBSyxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO29CQUMvRixDQUFDO3lCQUFNLENBQUM7d0JBQ1AsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLEdBQUcsb0JBQW9CLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBQzdELENBQUM7b0JBRUQsSUFBSSxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQztnQkFDNUcsQ0FBQztxQkFBTSxDQUFDO29CQUNQLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUMzRCxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRWtCLGFBQWE7UUFDL0Isd0VBQXdFO0lBQ3pFLENBQUM7SUFFa0IsV0FBVztRQUM3QixJQUFJLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDekQsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3JDLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3hDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNqQyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDbkIsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUN2RCxDQUFDO1lBQ0QsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ3RCLENBQUM7YUFBTSxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUN2QixJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDckMsQ0FBQztJQUNGLENBQUM7SUFFa0IsYUFBYTtRQUMvQixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDekIsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2xCLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDMUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDL0MsQ0FBQztZQUVELElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNmLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDdkMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLENBQUM7Z0JBQzNDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQztZQUN4QixDQUFDO1FBQ0YsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDbEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUN2QyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDcEQsQ0FBQztZQUVELElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNmLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDcEMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQ2pELENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVrQixhQUFhO1FBQy9CLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEIsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztRQUNwQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNqRCxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUMzQixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUNuRCxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3BFLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQzNDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUM1QyxDQUFDO0lBQ0YsQ0FBQztJQUVELFdBQVc7UUFDVixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUM7SUFDdEIsQ0FBQztJQUVTLFVBQVU7UUFDbkIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDOUUsTUFBTSxPQUFPLEdBQUcsVUFBVSxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDO1FBQ2pKLE1BQU0sT0FBTyxHQUFHLFVBQVUsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDNUgsTUFBTSxPQUFPLEdBQUcsVUFBVSxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLGFBQWEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDNUgsTUFBTSxhQUFhLEdBQUcsVUFBVSxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBRXRGLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2YsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLE9BQU8sSUFBSSxFQUFFLENBQUM7WUFDdEMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLE9BQU8sSUFBSSxFQUFFLENBQUM7WUFDaEQsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztZQUNsQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQy9DLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNoQixJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsT0FBTyxJQUFJLEVBQUUsQ0FBQztRQUN4QyxDQUFDO0lBQ0YsQ0FBQztDQUNEO0FBRUQsTUFBTSx5QkFBMEIsU0FBUSxzQkFBc0I7SUFVN0QsWUFDQyxNQUFlLEVBQ1AsY0FBc0MsRUFDdEMsVUFBd0IsRUFDeEIsY0FBNEIsRUFDcEMsVUFBdUI7UUFFdkIsS0FBSyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsY0FBYyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBTDFDLG1CQUFjLEdBQWQsY0FBYyxDQUF3QjtRQUN0QyxlQUFVLEdBQVYsVUFBVSxDQUFjO1FBQ3hCLG1CQUFjLEdBQWQsY0FBYyxDQUFjO1FBYjdCLGNBQVMsR0FBZ0IsSUFBSSxDQUFDO1FBR3JCLHVCQUFrQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxlQUFlLEVBQUUsQ0FBQyxDQUFDO1FBQ3BFLGNBQVMsR0FBWSxLQUFLLENBQUM7UUFjbEMsSUFBSSxDQUFDLGVBQWUsR0FBRyxjQUFjLElBQUksY0FBYyxDQUFDLGVBQWUsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUUsVUFBVSxFQUFFLG1CQUFtQixDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsaUJBQWlCLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFdE0sSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLGdCQUFnQixDQUFDLEdBQUcsRUFBRTtZQUM5QyxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDcEIsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNuQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzNCLENBQUM7UUFDRixDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFUixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksZ0JBQWdCLENBQUMsR0FBRyxFQUFFO1lBQzlDLElBQUksSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLGdCQUFnQixFQUFFLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxLQUFLLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO2dCQUNuSCxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3BDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuQyxDQUFDO1FBQ0YsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ1QsQ0FBQztJQUVRLE1BQU0sQ0FBQyxTQUFzQjtRQUNyQyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRXhCLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbkIsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1lBQy9DLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQztZQUN2QixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDaEQsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ2pDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsd0JBQXdCLEdBQUcsU0FBUyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3RILElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsYUFBYSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzNELENBQUM7UUFFRCxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsRUFBRTtZQUN4RSxNQUFNLEtBQUssR0FBRyxJQUFJLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNDLElBQUksS0FBSyxDQUFDLE1BQU0sNkJBQW9CLElBQUksS0FBSyxDQUFDLE1BQU0sdUJBQWUsRUFBRSxDQUFDO2dCQUNyRSxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFFMUIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMxQixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQzFFLE1BQU0sS0FBSyxHQUFHLElBQUkscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFM0MsSUFBSSxnQkFBZ0IsRUFBRSxLQUFLLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDdEMsSUFBSSxLQUFLLENBQUMsTUFBTSw2QkFBb0IsSUFBSSxLQUFLLENBQUMsTUFBTSx1QkFBZSxFQUFFLENBQUM7b0JBQ3JFLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUMzQixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUM1RSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNyQixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztnQkFFdEIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUMvQixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQzdFLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBQ3hCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUMzRSxJQUFJLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLEVBQUUsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztnQkFDbkUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUMvQixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRTtZQUNuRCxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxLQUFLLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDaEQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNwQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbkMsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRWtCLGFBQWE7UUFDL0IsNEJBQTRCO1FBQzVCLHFEQUFxRDtRQUNyRCx5QkFBeUI7SUFDMUIsQ0FBQztJQUVELElBQUksQ0FBQyxXQUFxQjtRQUN6QixJQUFJLENBQUMsc0JBQXNCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbkMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRVEsT0FBTyxDQUFDLENBQVk7UUFDNUIsNkNBQTZDO1FBQzdDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRTFCLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNuQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzFCLENBQUM7SUFFTyxzQkFBc0IsQ0FBQyxLQUFjO1FBQzVDLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sS0FBSyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBRXhGLDZEQUE2RDtZQUM3RCxJQUFJLENBQUM7Z0JBQ0osSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbkMsQ0FBQztZQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFFWCxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUM7WUFDcEMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ2pDLElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7Z0JBQzNCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDaEMsSUFBSSxDQUFDLGdCQUFnQixHQUFHLFNBQVMsQ0FBQztZQUNuQyxDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFTywwQkFBMEIsQ0FBQyxnQkFBMkIsRUFBRSxPQUFrQixFQUFFLEtBQTJCLEVBQUUsZUFBK0I7UUFDL0ksTUFBTSxHQUFHLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQztRQUVoQyx3QkFBd0I7UUFDeEIsR0FBRyxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxRQUFRLEVBQUUsZUFBZSxDQUFDLFVBQVUsS0FBSyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQyxxQ0FBNkIsQ0FBQyxtQ0FBMkIsRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7UUFFbk8scUZBQXFGO1FBQ3JGLElBQUksR0FBRyxDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDbkUsSUFBSSxLQUFLLENBQUMsSUFBSSxHQUFHLEVBQUUsR0FBRyxPQUFPLENBQUMsS0FBSyxJQUFJLGdCQUFnQixDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUMvRCxHQUFHLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1lBQzVCLENBQUM7WUFFRCxLQUFLLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQztZQUNoQixLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNsQixDQUFDO1FBRUQsZ0VBQWdFO1FBQ2hFLEdBQUcsQ0FBQyxHQUFHLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUUsUUFBUSxxQ0FBNkIsRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUVqSSx5RkFBeUY7UUFDekYsSUFBSSxHQUFHLENBQUMsR0FBRyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEtBQUssS0FBSyxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNsSCxHQUFHLENBQUMsR0FBRyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUM7UUFDekIsQ0FBQztRQUVELE9BQU8sR0FBRyxDQUFDO0lBQ1osQ0FBQztJQUVPLGFBQWEsQ0FBQyxlQUFlLEdBQUcsSUFBSTtRQUMzQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ25CLE9BQU87UUFDUixDQUFDO1FBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ2hDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO1lBQ3RFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLDJCQUEyQixFQUFFLGNBQWMsQ0FBQyxDQUFDO1lBRWpGLDhEQUE4RDtZQUM5RCxzRUFBc0U7WUFDdEUsTUFBTSxjQUFjLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ2xILE1BQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxjQUFjLENBQUMsVUFBVSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNyRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUM7WUFDL0MsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO1lBQ3RDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQztZQUN2Qyx3SEFBd0g7WUFDeEgsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDO1lBRXpDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLGtCQUFrQixFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUU5SyxpQkFBaUI7WUFDakIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1lBQ3RELE1BQU0sZUFBZSxHQUFHO2dCQUN2QixHQUFHLEVBQUUsUUFBUSxDQUFDLEdBQUcsR0FBRyxVQUFVO2dCQUM5QixJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUk7Z0JBQ25CLE1BQU0sRUFBRSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsR0FBRyxVQUFVO2dCQUN4QyxLQUFLLEVBQUUsUUFBUSxDQUFDLEtBQUs7YUFDckIsQ0FBQztZQUVGLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1lBRTlELE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDdkMsTUFBTSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsSUFBSSxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsV0FBVyxDQUFDLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxlQUFlLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQzVLLDhDQUE4QztZQUM5QyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxHQUFHLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxJQUFJLENBQUM7WUFDOUQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDO1lBRTNELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQUU7Z0JBQzlGLE1BQU0sS0FBSyxHQUFHLElBQUkscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzNDLElBQUksS0FBSyxDQUFDLE1BQU0sNEJBQW1CLEVBQUUsQ0FBQztvQkFDckMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBRTFCLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUUvQixJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ25DLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRUosSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsRUFBRTtnQkFDaEcsTUFBTSxLQUFLLEdBQUcsSUFBSSxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDM0MsSUFBSSxLQUFLLENBQUMsTUFBTSw0QkFBbUIsRUFBRSxDQUFDO29CQUNyQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDM0IsQ0FBQztZQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFHSixJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUU7Z0JBQ3BFLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUUvQixJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbkMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUVKLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUUvQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDO1FBQzFDLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3RDLENBQUM7SUFDRixDQUFDO0lBRU8sa0JBQWtCLENBQUMsS0FBYTtRQUN2QyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLGVBQWUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNqRCxDQUFDO0lBQ0YsQ0FBQztJQUVrQixVQUFVO1FBQzVCLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUVuQixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM5RSxNQUFNLE9BQU8sR0FBRyxVQUFVLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUM7UUFFakosSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUMzQixJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxPQUFPLElBQUksRUFBRSxDQUFDO1FBQ25ELENBQUM7SUFDRixDQUFDO0lBRVEsT0FBTztRQUNmLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUVoQixJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBRTdCLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3BCLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDdkIsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDM0IsSUFBSSxDQUFDLGdCQUFnQixHQUFHLFNBQVMsQ0FBQztRQUNuQyxDQUFDO0lBQ0YsQ0FBQztDQUNEO0FBRUQsTUFBTSwyQkFBNEIsU0FBUSxjQUFjO0lBQ3ZELFlBQVksT0FBZ0IsRUFBRSxNQUFlLEVBQUUsT0FBK0IsRUFBbUIsVUFBdUI7UUFDdkgsS0FBSyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFEZ0UsZUFBVSxHQUFWLFVBQVUsQ0FBYTtJQUV4SCxDQUFDO0lBRVEsTUFBTSxDQUFDLFNBQXNCO1FBQ3JDLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDeEIsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ2hILENBQUM7SUFDRixDQUFDO0NBQ0Q7QUFFRCxNQUFNLFVBQVUsYUFBYSxDQUFDLEtBQWE7SUFDMUMsTUFBTSxLQUFLLEdBQUcsbUJBQW1CLENBQUM7SUFFbEMsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNsQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDZCxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFRCxNQUFNLGNBQWMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUVuQyxPQUFPLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUNsRSxDQUFDO0FBRUQsTUFBTSxVQUFVLFVBQVUsQ0FBQyxDQUFZO0lBQ3RDLE1BQU0sYUFBYSxHQUFHLHdCQUF3QixFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZELE9BQU8sWUFBWSxDQUFDLENBQUMsRUFBRSx5QkFBeUIsYUFBYSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDO0FBQ2xGLENBQUM7QUFFRCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsS0FBa0IsRUFBRSxjQUF1QjtJQUMzRSxJQUFJLE1BQU0sR0FBRyxTQUFTLENBQUE7Ozs7Ozs7RUFPckIsVUFBVSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUM7RUFDakMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztFQTZSL0IsQ0FBQztJQUVGLElBQUksY0FBYyxFQUFFLENBQUM7UUFDcEIsNERBQTREO1FBQzVELGlFQUFpRTtRQUNqRSxNQUFNLElBQUk7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBcURULENBQUM7UUFFRixhQUFhO1FBQ2IsTUFBTSxvQkFBb0IsR0FBRyxLQUFLLENBQUMsZUFBZSxDQUFDO1FBQ25ELElBQUksb0JBQW9CLEVBQUUsQ0FBQztZQUMxQixNQUFNLElBQUk7O21CQUVNLG9CQUFvQjs7OzttQkFJcEIsb0JBQW9COzs7O21CQUlwQixvQkFBb0I7O0lBRW5DLENBQUM7UUFDSCxDQUFDO1FBRUQsTUFBTSw4QkFBOEIsR0FBRyxLQUFLLENBQUMseUJBQXlCLENBQUM7UUFDdkUsSUFBSSw4QkFBOEIsRUFBRSxDQUFDO1lBQ3BDLE1BQU0sSUFBSTs7bUJBRU0sOEJBQThCOztJQUU3QyxDQUFDO1FBQ0gsQ0FBQztRQUVELE1BQU0sbUNBQW1DLEdBQUcsS0FBSyxDQUFDLDhCQUE4QixDQUFDO1FBQ2pGLElBQUksbUNBQW1DLEVBQUUsQ0FBQztZQUN6QyxNQUFNLElBQUk7O21CQUVNLG1DQUFtQzs7SUFFbEQsQ0FBQztRQUNILENBQUM7UUFFRCxNQUFNLG9DQUFvQyxHQUFHLEtBQUssQ0FBQywrQkFBK0IsQ0FBQztRQUNuRixJQUFJLG9DQUFvQyxFQUFFLENBQUM7WUFDMUMsTUFBTSxJQUFJOzttQkFFTSxvQ0FBb0M7O0lBRW5ELENBQUM7UUFDSCxDQUFDO0lBQ0YsQ0FBQztJQUVELE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQyJ9