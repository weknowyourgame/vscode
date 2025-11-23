/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../common/codicons.js';
import { Emitter } from '../../../common/event.js';
import { ThemeIcon } from '../../../common/themables.js';
import { $, addDisposableListener, EventType, isActiveElement } from '../../dom.js';
import { BaseActionViewItem } from '../actionbar/actionViewItems.js';
import { getBaseLayerHoverDelegate } from '../hover/hoverDelegate2.js';
import { Widget } from '../widget.js';
import './toggle.css';
export const unthemedToggleStyles = {
    inputActiveOptionBorder: '#007ACC00',
    inputActiveOptionForeground: '#FFFFFF',
    inputActiveOptionBackground: '#0E639C50'
};
export class ToggleActionViewItem extends BaseActionViewItem {
    constructor(context, action, options) {
        super(context, action, options);
        const title = this.options.keybinding ?
            `${this._action.label} (${this.options.keybinding})` : this._action.label;
        this.toggle = this._register(new Toggle({
            actionClassName: this._action.class,
            isChecked: !!this._action.checked,
            title,
            notFocusable: true,
            inputActiveOptionBackground: options.toggleStyles?.inputActiveOptionBackground,
            inputActiveOptionBorder: options.toggleStyles?.inputActiveOptionBorder,
            inputActiveOptionForeground: options.toggleStyles?.inputActiveOptionForeground,
        }));
        this._register(this.toggle.onChange(() => {
            this._action.checked = !!this.toggle && this.toggle.checked;
        }));
    }
    render(container) {
        this.element = container;
        this.element.appendChild(this.toggle.domNode);
        this.updateChecked();
        this.updateEnabled();
    }
    updateEnabled() {
        if (this.toggle) {
            if (this.isEnabled()) {
                this.toggle.enable();
                this.element?.classList.remove('disabled');
            }
            else {
                this.toggle.disable();
                this.element?.classList.add('disabled');
            }
        }
    }
    updateChecked() {
        this.toggle.checked = !!this._action.checked;
    }
    updateLabel() {
        const title = this.options.keybinding ?
            `${this._action.label} (${this.options.keybinding})` : this._action.label;
        this.toggle.setTitle(title);
    }
    focus() {
        this.toggle.domNode.tabIndex = 0;
        this.toggle.focus();
    }
    blur() {
        this.toggle.domNode.tabIndex = -1;
        this.toggle.domNode.blur();
    }
    setFocusable(focusable) {
        this.toggle.domNode.tabIndex = focusable ? 0 : -1;
    }
}
export class Toggle extends Widget {
    get onChange() { return this._onChange.event; }
    get onKeyDown() { return this._onKeyDown.event; }
    constructor(opts) {
        super();
        this._onChange = this._register(new Emitter());
        this._onKeyDown = this._register(new Emitter());
        this._opts = opts;
        this._title = this._opts.title;
        this._checked = this._opts.isChecked;
        const classes = ['monaco-custom-toggle'];
        if (this._opts.icon) {
            this._icon = this._opts.icon;
            classes.push(...ThemeIcon.asClassNameArray(this._icon));
        }
        if (this._opts.actionClassName) {
            classes.push(...this._opts.actionClassName.split(' '));
        }
        if (this._checked) {
            classes.push('checked');
        }
        this.domNode = document.createElement('div');
        this._register(getBaseLayerHoverDelegate().setupDelayedHover(this.domNode, () => ({
            content: this._title,
            style: 1 /* HoverStyle.Pointer */,
        }), this._opts.hoverLifecycleOptions));
        this.domNode.classList.add(...classes);
        if (!this._opts.notFocusable) {
            this.domNode.tabIndex = 0;
        }
        this.domNode.setAttribute('role', 'checkbox');
        this.domNode.setAttribute('aria-checked', String(this._checked));
        this.setTitle(this._opts.title);
        this.applyStyles();
        this.onclick(this.domNode, (ev) => {
            if (this.enabled) {
                this.checked = !this._checked;
                this._onChange.fire(false);
                ev.preventDefault();
            }
        });
        this._register(this.ignoreGesture(this.domNode));
        this.onkeydown(this.domNode, (keyboardEvent) => {
            if (!this.enabled) {
                return;
            }
            if (keyboardEvent.keyCode === 10 /* KeyCode.Space */ || keyboardEvent.keyCode === 3 /* KeyCode.Enter */) {
                this.checked = !this._checked;
                this._onChange.fire(true);
                keyboardEvent.preventDefault();
                keyboardEvent.stopPropagation();
                return;
            }
            this._onKeyDown.fire(keyboardEvent);
        });
    }
    get enabled() {
        return this.domNode.getAttribute('aria-disabled') !== 'true';
    }
    focus() {
        this.domNode.focus();
    }
    get checked() {
        return this._checked;
    }
    set checked(newIsChecked) {
        this._checked = newIsChecked;
        this.domNode.setAttribute('aria-checked', String(this._checked));
        this.domNode.classList.toggle('checked', this._checked);
        this.applyStyles();
    }
    setIcon(icon) {
        if (this._icon) {
            this.domNode.classList.remove(...ThemeIcon.asClassNameArray(this._icon));
        }
        this._icon = icon;
        if (this._icon) {
            this.domNode.classList.add(...ThemeIcon.asClassNameArray(this._icon));
        }
    }
    width() {
        return 2 /*margin left*/ + 2 /*border*/ + 2 /*padding*/ + 16 /* icon width */;
    }
    applyStyles() {
        if (this.domNode) {
            this.domNode.style.borderColor = (this._checked && this._opts.inputActiveOptionBorder) || '';
            this.domNode.style.color = (this._checked && this._opts.inputActiveOptionForeground) || 'inherit';
            this.domNode.style.backgroundColor = (this._checked && this._opts.inputActiveOptionBackground) || '';
        }
    }
    enable() {
        this.domNode.setAttribute('aria-disabled', String(false));
        this.domNode.classList.remove('disabled');
    }
    disable() {
        this.domNode.setAttribute('aria-disabled', String(true));
        this.domNode.classList.add('disabled');
    }
    setTitle(newTitle) {
        this._title = newTitle;
        this.domNode.setAttribute('aria-label', newTitle);
    }
    set visible(visible) {
        this.domNode.style.display = visible ? '' : 'none';
    }
    get visible() {
        return this.domNode.style.display !== 'none';
    }
}
class BaseCheckbox extends Widget {
    static { this.CLASS_NAME = 'monaco-checkbox'; }
    constructor(checkbox, domNode, styles) {
        super();
        this.checkbox = checkbox;
        this.domNode = domNode;
        this.styles = styles;
        this._onChange = this._register(new Emitter());
        this.onChange = this._onChange.event;
        this.applyStyles();
    }
    get enabled() {
        return this.checkbox.enabled;
    }
    focus() {
        this.domNode.focus();
    }
    hasFocus() {
        return isActiveElement(this.domNode);
    }
    enable() {
        this.checkbox.enable();
        this.applyStyles(true);
    }
    disable() {
        this.checkbox.disable();
        this.applyStyles(false);
    }
    setTitle(newTitle) {
        this.checkbox.setTitle(newTitle);
    }
    applyStyles(enabled = this.enabled) {
        this.domNode.style.color = (enabled ? this.styles.checkboxForeground : this.styles.checkboxDisabledForeground) || '';
        this.domNode.style.backgroundColor = (enabled ? this.styles.checkboxBackground : this.styles.checkboxDisabledBackground) || '';
        this.domNode.style.borderColor = (enabled ? this.styles.checkboxBorder : this.styles.checkboxDisabledBackground) || '';
        const size = this.styles.size || 18;
        this.domNode.style.width =
            this.domNode.style.height =
                this.domNode.style.fontSize = `${size}px`;
        this.domNode.style.fontSize = `${size - 2}px`;
    }
}
export class Checkbox extends BaseCheckbox {
    constructor(title, isChecked, styles) {
        const toggle = new Toggle({ title, isChecked, icon: Codicon.check, actionClassName: BaseCheckbox.CLASS_NAME, hoverLifecycleOptions: styles.hoverLifecycleOptions, ...unthemedToggleStyles });
        super(toggle, toggle.domNode, styles);
        this._register(toggle);
        this._register(this.checkbox.onChange(keyboard => {
            this.applyStyles();
            this._onChange.fire(keyboard);
        }));
    }
    get checked() {
        return this.checkbox.checked;
    }
    set checked(newIsChecked) {
        this.checkbox.checked = newIsChecked;
        this.applyStyles();
    }
    applyStyles(enabled) {
        if (this.checkbox.checked) {
            this.checkbox.setIcon(Codicon.check);
        }
        else {
            this.checkbox.setIcon(undefined);
        }
        super.applyStyles(enabled);
    }
}
export class TriStateCheckbox extends BaseCheckbox {
    constructor(title, _state, styles) {
        let icon;
        switch (_state) {
            case true:
                icon = Codicon.check;
                break;
            case 'mixed':
                icon = Codicon.dash;
                break;
            case false:
                icon = undefined;
                break;
        }
        const checkbox = new Toggle({
            title,
            isChecked: _state === true,
            icon,
            actionClassName: Checkbox.CLASS_NAME,
            hoverLifecycleOptions: styles.hoverLifecycleOptions,
            ...unthemedToggleStyles
        });
        super(checkbox, checkbox.domNode, styles);
        this._state = _state;
        this._register(checkbox);
        this._register(this.checkbox.onChange(keyboard => {
            this._state = this.checkbox.checked;
            this.applyStyles();
            this._onChange.fire(keyboard);
        }));
    }
    get checked() {
        return this._state;
    }
    set checked(newState) {
        if (this._state !== newState) {
            this._state = newState;
            this.checkbox.checked = newState === true;
            this.applyStyles();
        }
    }
    applyStyles(enabled) {
        switch (this._state) {
            case true:
                this.checkbox.setIcon(Codicon.check);
                break;
            case 'mixed':
                this.checkbox.setIcon(Codicon.dash);
                break;
            case false:
                this.checkbox.setIcon(undefined);
                break;
        }
        super.applyStyles(enabled);
    }
}
export class CheckboxActionViewItem extends BaseActionViewItem {
    constructor(context, action, options) {
        super(context, action, options);
        this.toggle = this._register(new Checkbox(this._action.label, !!this._action.checked, options.checkboxStyles));
        this._register(this.toggle.onChange(() => this.onChange()));
    }
    render(container) {
        this.element = container;
        this.element.classList.add('checkbox-action-item');
        this.element.appendChild(this.toggle.domNode);
        if (this.options.label && this._action.label) {
            const label = this.element.appendChild($('span.checkbox-label', undefined, this._action.label));
            this._register(addDisposableListener(label, EventType.CLICK, (e) => {
                this.toggle.checked = !this.toggle.checked;
                e.stopPropagation();
                e.preventDefault();
                this.onChange();
            }));
        }
        this.updateEnabled();
        this.updateClass();
        this.updateChecked();
    }
    onChange() {
        this._action.checked = !!this.toggle && this.toggle.checked;
        this.actionRunner.run(this._action, this._context);
    }
    updateEnabled() {
        if (this.isEnabled()) {
            this.toggle.enable();
        }
        else {
            this.toggle.disable();
        }
        if (this.action.enabled) {
            this.element?.classList.remove('disabled');
        }
        else {
            this.element?.classList.add('disabled');
        }
    }
    updateChecked() {
        this.toggle.checked = !!this._action.checked;
    }
    updateClass() {
        if (this.cssClass) {
            this.toggle.domNode.classList.remove(...this.cssClass.split(' '));
        }
        this.cssClass = this.getClass();
        if (this.cssClass) {
            this.toggle.domNode.classList.add(...this.cssClass.split(' '));
        }
    }
    focus() {
        this.toggle.domNode.tabIndex = 0;
        this.toggle.focus();
    }
    blur() {
        this.toggle.domNode.tabIndex = -1;
        this.toggle.domNode.blur();
    }
    setFocusable(focusable) {
        this.toggle.domNode.tabIndex = focusable ? 0 : -1;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9nZ2xlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvYnJvd3Nlci91aS90b2dnbGUvdG9nZ2xlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sMEJBQTBCLENBQUM7QUFFMUQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3pELE9BQU8sRUFBRSxDQUFDLEVBQUUscUJBQXFCLEVBQUUsU0FBUyxFQUFFLGVBQWUsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUVwRixPQUFPLEVBQUUsa0JBQWtCLEVBQTBCLE1BQU0saUNBQWlDLENBQUM7QUFFN0YsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDdkUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUN0QyxPQUFPLGNBQWMsQ0FBQztBQTJCdEIsTUFBTSxDQUFDLE1BQU0sb0JBQW9CLEdBQUc7SUFDbkMsdUJBQXVCLEVBQUUsV0FBVztJQUNwQywyQkFBMkIsRUFBRSxTQUFTO0lBQ3RDLDJCQUEyQixFQUFFLFdBQVc7Q0FDeEMsQ0FBQztBQUVGLE1BQU0sT0FBTyxvQkFBcUIsU0FBUSxrQkFBa0I7SUFJM0QsWUFBWSxPQUFnQixFQUFFLE1BQWUsRUFBRSxPQUErQjtRQUM3RSxLQUFLLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUVoQyxNQUFNLEtBQUssR0FBNEIsSUFBSSxDQUFDLE9BQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNoRSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxLQUE4QixJQUFJLENBQUMsT0FBUSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FB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