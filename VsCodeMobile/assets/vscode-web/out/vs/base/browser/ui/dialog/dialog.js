/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import './dialog.css';
import { localize } from '../../../../nls.js';
import { $, addDisposableListener, addStandardDisposableListener, clearNode, EventHelper, EventType, getWindow, hide, isActiveElement, isAncestor, show } from '../../dom.js';
import { StandardKeyboardEvent } from '../../keyboardEvent.js';
import { ActionBar } from '../actionbar/actionbar.js';
import { ButtonBar, ButtonBarAlignment, ButtonWithDescription, ButtonWithDropdown } from '../button/button.js';
import { Checkbox } from '../toggle/toggle.js';
import { InputBox } from '../inputbox/inputBox.js';
import { Action, toAction } from '../../../common/actions.js';
import { Codicon } from '../../../common/codicons.js';
import { ThemeIcon } from '../../../common/themables.js';
import { mnemonicButtonLabel } from '../../../common/labels.js';
import { Disposable, toDisposable } from '../../../common/lifecycle.js';
import { isLinux, isMacintosh, isWindows } from '../../../common/platform.js';
import { isActionProvider } from '../dropdown/dropdown.js';
export var DialogContentsAlignment;
(function (DialogContentsAlignment) {
    /**
     * Dialog contents align from left to right (icon, message, buttons on a separate row).
     *
     * Note: this is the default alignment for dialogs.
     */
    DialogContentsAlignment[DialogContentsAlignment["Horizontal"] = 0] = "Horizontal";
    /**
     * Dialog contents align from top to bottom (icon, message, buttons stack on top of each other)
     */
    DialogContentsAlignment[DialogContentsAlignment["Vertical"] = 1] = "Vertical";
})(DialogContentsAlignment || (DialogContentsAlignment = {}));
export class Dialog extends Disposable {
    constructor(container, message, buttons, options) {
        super();
        this.container = container;
        this.message = message;
        this.options = options;
        // Modal background blocker
        this.modalElement = this.container.appendChild($(`.monaco-dialog-modal-block.dimmed`));
        this._register(addStandardDisposableListener(this.modalElement, EventType.CLICK, e => {
            if (e.target === this.modalElement) {
                this.element.focus(); // guide users back into the dialog if clicked elsewhere
            }
        }));
        // Dialog Box
        this.shadowElement = this.modalElement.appendChild($('.dialog-shadow'));
        this.element = this.shadowElement.appendChild($('.monaco-dialog-box'));
        if (options.alignment === DialogContentsAlignment.Vertical) {
            this.element.classList.add('align-vertical');
        }
        if (options.extraClasses) {
            this.element.classList.add(...options.extraClasses);
        }
        this.element.setAttribute('role', 'dialog');
        this.element.tabIndex = -1;
        hide(this.element);
        // Footer
        if (this.options.renderFooter) {
            this.footerContainer = this.element.appendChild($('.dialog-footer-row'));
            const customFooter = this.footerContainer.appendChild($('#monaco-dialog-footer.dialog-footer'));
            this.options.renderFooter(customFooter);
            // eslint-disable-next-line no-restricted-syntax
            for (const el of this.footerContainer.querySelectorAll('a')) {
                el.tabIndex = 0;
            }
        }
        // Buttons
        this.buttonStyles = options.buttonStyles;
        if (Array.isArray(buttons) && buttons.length > 0) {
            this.buttons = buttons;
        }
        else if (!this.options.disableDefaultAction) {
            this.buttons = [localize('ok', "OK")];
        }
        else {
            this.buttons = [];
        }
        const buttonsRowElement = this.element.appendChild($('.dialog-buttons-row'));
        this.buttonsContainer = buttonsRowElement.appendChild($('.dialog-buttons'));
        // Message
        const messageRowElement = this.element.appendChild($('.dialog-message-row'));
        this.iconElement = messageRowElement.appendChild($('#monaco-dialog-icon.dialog-icon'));
        this.iconElement.setAttribute('aria-label', this.getIconAriaLabel());
        this.messageContainer = messageRowElement.appendChild($('.dialog-message-container'));
        if (this.options.detail || this.options.renderBody) {
            const messageElement = this.messageContainer.appendChild($('.dialog-message'));
            const messageTextElement = messageElement.appendChild($('#monaco-dialog-message-text.dialog-message-text'));
            messageTextElement.innerText = this.message;
        }
        this.messageDetailElement = this.messageContainer.appendChild($('#monaco-dialog-message-detail.dialog-message-detail'));
        if (this.options.detail || !this.options.renderBody) {
            this.messageDetailElement.innerText = this.options.detail ? this.options.detail : message;
        }
        else {
            this.messageDetailElement.style.display = 'none';
        }
        if (this.options.renderBody) {
            const customBody = this.messageContainer.appendChild($('#monaco-dialog-message-body.dialog-message-body'));
            this.options.renderBody(customBody);
            // eslint-disable-next-line no-restricted-syntax
            for (const el of this.messageContainer.querySelectorAll('a')) {
                el.tabIndex = 0;
            }
        }
        // Inputs
        if (this.options.inputs) {
            this.inputs = this.options.inputs.map(input => {
                const inputRowElement = this.messageContainer.appendChild($('.dialog-message-input'));
                const inputBox = this._register(new InputBox(inputRowElement, undefined, {
                    placeholder: input.placeholder,
                    type: input.type ?? 'text',
                    inputBoxStyles: options.inputBoxStyles
                }));
                if (input.value) {
                    inputBox.value = input.value;
                }
                return inputBox;
            });
        }
        else {
            this.inputs = [];
        }
        // Checkbox
        if (this.options.checkboxLabel) {
            const checkboxRowElement = this.messageContainer.appendChild($('.dialog-checkbox-row'));
            const checkbox = this.checkbox = this._register(new Checkbox(this.options.checkboxLabel, !!this.options.checkboxChecked, options.checkboxStyles));
            checkboxRowElement.appendChild(checkbox.domNode);
            const checkboxMessageElement = checkboxRowElement.appendChild($('.dialog-checkbox-message'));
            checkboxMessageElement.innerText = this.options.checkboxLabel;
            this._register(addDisposableListener(checkboxMessageElement, EventType.CLICK, () => checkbox.checked = !checkbox.checked));
        }
        // Toolbar
        const toolbarRowElement = this.element.appendChild($('.dialog-toolbar-row'));
        this.toolbarContainer = toolbarRowElement.appendChild($('.dialog-toolbar'));
        this.applyStyles();
    }
    getIconAriaLabel() {
        let typeLabel = localize('dialogInfoMessage', 'Info');
        switch (this.options.type) {
            case 'error':
                typeLabel = localize('dialogErrorMessage', 'Error');
                break;
            case 'warning':
                typeLabel = localize('dialogWarningMessage', 'Warning');
                break;
            case 'pending':
                typeLabel = localize('dialogPendingMessage', 'In Progress');
                break;
            case 'none':
            case 'info':
            case 'question':
            default:
                break;
        }
        return typeLabel;
    }
    updateMessage(message) {
        this.messageDetailElement.innerText = message;
    }
    async show() {
        this.focusToReturn = this.container.ownerDocument.activeElement;
        return new Promise(resolve => {
            clearNode(this.buttonsContainer);
            const close = () => {
                resolve({
                    button: this.options.cancelId || 0,
                    checkboxChecked: this.checkbox ? this.checkbox.checked : undefined
                });
                return;
            };
            this._register(toDisposable(close));
            const buttonBar = this.buttonBar = this._register(new ButtonBar(this.buttonsContainer, { alignment: this.options?.alignment === DialogContentsAlignment.Vertical ? ButtonBarAlignment.Vertical : ButtonBarAlignment.Horizontal }));
            const buttonMap = this.rearrangeButtons(this.buttons, this.options.cancelId);
            const onButtonClick = (index) => {
                resolve({
                    button: buttonMap[index].index,
                    checkboxChecked: this.checkbox ? this.checkbox.checked : undefined,
                    values: this.inputs.length > 0 ? this.inputs.map(input => input.value) : undefined
                });
            };
            // Buttons
            buttonMap.forEach((_, index) => {
                const primary = buttonMap[index].index === 0;
                let button;
                const buttonOptions = this.options.buttonOptions?.[buttonMap[index]?.index];
                if (primary && this.options?.primaryButtonDropdown) {
                    const actions = isActionProvider(this.options.primaryButtonDropdown.actions) ? this.options.primaryButtonDropdown.actions.getActions() : this.options.primaryButtonDropdown.actions;
                    button = this._register(buttonBar.addButtonWithDropdown({
                        ...this.options.primaryButtonDropdown,
                        ...this.buttonStyles,
                        dropdownLayer: 2600, // ensure the dropdown is above the dialog
                        actions: actions.map(action => toAction({
                            ...action,
                            run: async () => {
                                await action.run();
                                onButtonClick(index);
                            }
                        }))
                    }));
                }
                else if (buttonOptions?.sublabel) {
                    button = this._register(buttonBar.addButtonWithDescription({ secondary: !primary, ...this.buttonStyles }));
                }
                else {
                    button = this._register(buttonBar.addButton({ secondary: !primary, ...this.buttonStyles }));
                }
                if (buttonOptions?.styleButton) {
                    buttonOptions.styleButton(button);
                }
                button.label = mnemonicButtonLabel(buttonMap[index].label, true);
                if (button instanceof ButtonWithDescription) {
                    if (buttonOptions?.sublabel) {
                        button.description = buttonOptions?.sublabel;
                    }
                }
                this._register(button.onDidClick(e => {
                    if (e) {
                        EventHelper.stop(e);
                    }
                    onButtonClick(index);
                }));
            });
            // Handle keyboard events globally: Tab, Arrow-Left/Right
            const window = getWindow(this.container);
            this._register(addDisposableListener(window, 'keydown', e => {
                const evt = new StandardKeyboardEvent(e);
                if (evt.equals(512 /* KeyMod.Alt */)) {
                    evt.preventDefault();
                }
                if (evt.equals(3 /* KeyCode.Enter */)) {
                    // Enter in input field should OK the dialog
                    if (this.inputs.some(input => input.hasFocus())) {
                        EventHelper.stop(e);
                        resolve({
                            button: buttonMap.find(button => button.index !== this.options.cancelId)?.index ?? 0,
                            checkboxChecked: this.checkbox ? this.checkbox.checked : undefined,
                            values: this.inputs.length > 0 ? this.inputs.map(input => input.value) : undefined
                        });
                    }
                    return; // leave default handling
                }
                // Cmd+D (trigger the "no"/"do not save"-button) (macOS only)
                if (isMacintosh && evt.equals(2048 /* KeyMod.CtrlCmd */ | 34 /* KeyCode.KeyD */)) {
                    EventHelper.stop(e);
                    const noButton = buttonMap.find(button => button.index === 1 && button.index !== this.options.cancelId);
                    if (noButton) {
                        resolve({
                            button: noButton.index,
                            checkboxChecked: this.checkbox ? this.checkbox.checked : undefined,
                            values: this.inputs.length > 0 ? this.inputs.map(input => input.value) : undefined
                        });
                    }
                    return; // leave default handling
                }
                if (evt.equals(10 /* KeyCode.Space */)) {
                    return; // leave default handling
                }
                let eventHandled = false;
                // Focus: Next / Previous
                if (evt.equals(2 /* KeyCode.Tab */) || evt.equals(17 /* KeyCode.RightArrow */) || evt.equals(1024 /* KeyMod.Shift */ | 2 /* KeyCode.Tab */) || evt.equals(15 /* KeyCode.LeftArrow */)) {
                    // Build a list of focusable elements in their visual order
                    const focusableElements = [];
                    let focusedIndex = -1;
                    if (this.messageContainer) {
                        // eslint-disable-next-line no-restricted-syntax
                        const links = this.messageContainer.querySelectorAll('a');
                        for (const link of links) {
                            focusableElements.push(link);
                            if (isActiveElement(link)) {
                                focusedIndex = focusableElements.length - 1;
                            }
                        }
                    }
                    for (const input of this.inputs) {
                        focusableElements.push(input);
                        if (input.hasFocus()) {
                            focusedIndex = focusableElements.length - 1;
                        }
                    }
                    if (this.checkbox) {
                        focusableElements.push(this.checkbox);
                        if (this.checkbox.hasFocus()) {
                            focusedIndex = focusableElements.length - 1;
                        }
                    }
                    if (this.buttonBar) {
                        for (const button of this.buttonBar.buttons) {
                            if (button instanceof ButtonWithDropdown) {
                                focusableElements.push(button.primaryButton);
                                if (button.primaryButton.hasFocus()) {
                                    focusedIndex = focusableElements.length - 1;
                                }
                                focusableElements.push(button.dropdownButton);
                                if (button.dropdownButton.hasFocus()) {
                                    focusedIndex = focusableElements.length - 1;
                                }
                            }
                            else {
                                focusableElements.push(button);
                                if (button.hasFocus()) {
                                    focusedIndex = focusableElements.length - 1;
                                }
                            }
                        }
                    }
                    if (this.footerContainer) {
                        // eslint-disable-next-line no-restricted-syntax
                        const links = this.footerContainer.querySelectorAll('a');
                        for (const link of links) {
                            focusableElements.push(link);
                            if (isActiveElement(link)) {
                                focusedIndex = focusableElements.length - 1;
                            }
                        }
                    }
                    // Focus next element (with wrapping)
                    if (evt.equals(2 /* KeyCode.Tab */) || evt.equals(17 /* KeyCode.RightArrow */)) {
                        const newFocusedIndex = (focusedIndex + 1) % focusableElements.length;
                        focusableElements[newFocusedIndex].focus();
                    }
                    // Focus previous element (with wrapping)
                    else {
                        if (focusedIndex === -1) {
                            focusedIndex = focusableElements.length; // default to focus last element if none have focus
                        }
                        let newFocusedIndex = focusedIndex - 1;
                        if (newFocusedIndex === -1) {
                            newFocusedIndex = focusableElements.length - 1;
                        }
                        focusableElements[newFocusedIndex].focus();
                    }
                    eventHandled = true;
                }
                if (eventHandled) {
                    EventHelper.stop(e, true);
                }
                else if (this.options.keyEventProcessor) {
                    this.options.keyEventProcessor(evt);
                }
            }, true));
            this._register(addDisposableListener(window, 'keyup', e => {
                EventHelper.stop(e, true);
                const evt = new StandardKeyboardEvent(e);
                if (!this.options.disableCloseAction && evt.equals(9 /* KeyCode.Escape */)) {
                    close();
                }
            }, true));
            // Detect focus out
            this._register(addDisposableListener(this.element, 'focusout', e => {
                if (!!e.relatedTarget && !!this.element) {
                    if (!isAncestor(e.relatedTarget, this.element)) {
                        this.focusToReturn = e.relatedTarget;
                        if (e.target) {
                            e.target.focus();
                            EventHelper.stop(e, true);
                        }
                    }
                }
            }, false));
            const spinModifierClassName = 'codicon-modifier-spin';
            this.iconElement.classList.remove(...ThemeIcon.asClassNameArray(Codicon.dialogError), ...ThemeIcon.asClassNameArray(Codicon.dialogWarning), ...ThemeIcon.asClassNameArray(Codicon.dialogInfo), ...ThemeIcon.asClassNameArray(Codicon.loading), spinModifierClassName);
            if (this.options.icon) {
                this.iconElement.classList.add(...ThemeIcon.asClassNameArray(this.options.icon));
            }
            else {
                switch (this.options.type) {
                    case 'error':
                        this.iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.dialogError));
                        break;
                    case 'warning':
                        this.iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.dialogWarning));
                        break;
                    case 'pending':
                        this.iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.loading), spinModifierClassName);
                        break;
                    case 'none':
                        this.iconElement.classList.add('no-codicon');
                        break;
                    case 'info':
                    case 'question':
                    default:
                        this.iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.dialogInfo));
                        break;
                }
            }
            if (!this.options.disableCloseAction && !this.options.disableCloseButton) {
                const actionBar = this._register(new ActionBar(this.toolbarContainer, {}));
                const action = this._register(new Action('dialog.close', localize('dialogClose', "Close Dialog"), ThemeIcon.asClassName(Codicon.dialogClose), true, async () => {
                    resolve({
                        button: this.options.cancelId || 0,
                        checkboxChecked: this.checkbox ? this.checkbox.checked : undefined
                    });
                }));
                actionBar.push(action, { icon: true, label: false });
            }
            this.applyStyles();
            this.element.setAttribute('aria-modal', 'true');
            this.element.setAttribute('aria-labelledby', 'monaco-dialog-icon monaco-dialog-message-text');
            this.element.setAttribute('aria-describedby', 'monaco-dialog-icon monaco-dialog-message-text monaco-dialog-message-detail monaco-dialog-message-body monaco-dialog-footer');
            show(this.element);
            // Focus first element (input or button)
            if (this.inputs.length > 0) {
                this.inputs[0].focus();
                this.inputs[0].select();
            }
            else {
                buttonMap.forEach((value, index) => {
                    if (value.index === 0) {
                        buttonBar.buttons[index].focus();
                    }
                });
            }
        });
    }
    applyStyles() {
        const style = this.options.dialogStyles;
        const fgColor = style.dialogForeground;
        const bgColor = style.dialogBackground;
        const shadowColor = style.dialogShadow ? `0 0px 8px ${style.dialogShadow}` : '';
        const border = style.dialogBorder ? `1px solid ${style.dialogBorder}` : '';
        const linkFgColor = style.textLinkForeground;
        this.shadowElement.style.boxShadow = shadowColor;
        this.element.style.color = fgColor ?? '';
        this.element.style.backgroundColor = bgColor ?? '';
        this.element.style.border = border;
        if (linkFgColor) {
            // eslint-disable-next-line no-restricted-syntax
            for (const el of [...this.messageContainer.getElementsByTagName('a'), ...this.footerContainer?.getElementsByTagName('a') ?? []]) {
                el.style.color = linkFgColor;
            }
        }
        let color;
        switch (this.options.type) {
            case 'none':
                break;
            case 'error':
                color = style.errorIconForeground;
                break;
            case 'warning':
                color = style.warningIconForeground;
                break;
            default:
                color = style.infoIconForeground;
                break;
        }
        if (color) {
            this.iconElement.style.color = color;
        }
    }
    dispose() {
        super.dispose();
        if (this.modalElement) {
            this.modalElement.remove();
            this.modalElement = undefined;
        }
        if (this.focusToReturn && isAncestor(this.focusToReturn, this.container.ownerDocument.body)) {
            this.focusToReturn.focus();
            this.focusToReturn = undefined;
        }
    }
    rearrangeButtons(buttons, cancelId) {
        // Maps each button to its current label and old index
        // so that when we move them around it's not a problem
        const buttonMap = buttons.map((label, index) => ({ label, index }));
        if (buttons.length < 2 || this.options.alignment === DialogContentsAlignment.Vertical) {
            return buttonMap; // only need to rearrange if there are 2+ buttons and the alignment is left-to-right
        }
        if (isMacintosh || isLinux) {
            // Linux: the GNOME HIG (https://developer.gnome.org/hig/patterns/feedback/dialogs.html?highlight=dialog)
            // recommend the following:
            // "Always ensure that the cancel button appears first, before the affirmative button. In left-to-right
            //  locales, this is on the left. This button order ensures that users become aware of, and are reminded
            //  of, the ability to cancel prior to encountering the affirmative button."
            // macOS: the HIG (https://developer.apple.com/design/human-interface-guidelines/components/presentation/alerts)
            // recommend the following:
            // "Place buttons where people expect. In general, place the button people are most likely to choose on the trailing side in a
            //  row of buttons or at the top in a stack of buttons. Always place the default button on the trailing side of a row or at the
            //  top of a stack. Cancel buttons are typically on the leading side of a row or at the bottom of a stack."
            if (typeof cancelId === 'number' && buttonMap[cancelId]) {
                const cancelButton = buttonMap.splice(cancelId, 1)[0];
                buttonMap.splice(1, 0, cancelButton);
            }
            buttonMap.reverse();
        }
        else if (isWindows) {
            // Windows: the HIG (https://learn.microsoft.com/en-us/windows/win32/uxguide/win-dialog-box)
            // recommend the following:
            // "One of the following sets of concise commands: Yes/No, Yes/No/Cancel, [Do it]/Cancel,
            //  [Do it]/[Don't do it], [Do it]/[Don't do it]/Cancel."
            if (typeof cancelId === 'number' && buttonMap[cancelId]) {
                const cancelButton = buttonMap.splice(cancelId, 1)[0];
                buttonMap.push(cancelButton);
            }
        }
        return buttonMap;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhbG9nLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvYnJvd3Nlci91aS9kaWFsb2cvZGlhbG9nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sY0FBYyxDQUFDO0FBQ3RCLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsQ0FBQyxFQUFFLHFCQUFxQixFQUFFLDZCQUE2QixFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFDOUssT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ3RELE9BQU8sRUFBRSxTQUFTLEVBQUUsa0JBQWtCLEVBQUUscUJBQXFCLEVBQUUsa0JBQWtCLEVBQXNELE1BQU0scUJBQXFCLENBQUM7QUFDbkssT0FBTyxFQUFtQixRQUFRLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNoRSxPQUFPLEVBQW1CLFFBQVEsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ3BFLE9BQU8sRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDOUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3RELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUV6RCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUNoRSxPQUFPLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3hFLE9BQU8sRUFBRSxPQUFPLEVBQUUsV0FBVyxF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