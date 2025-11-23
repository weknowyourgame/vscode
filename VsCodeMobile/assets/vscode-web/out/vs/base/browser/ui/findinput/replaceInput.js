/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as dom from '../../dom.js';
import { Toggle } from '../toggle/toggle.js';
import { HistoryInputBox } from '../inputbox/inputBox.js';
import { Widget } from '../widget.js';
import { Codicon } from '../../../common/codicons.js';
import { Emitter } from '../../../common/event.js';
import './findInput.css';
import * as nls from '../../../../nls.js';
const NLS_DEFAULT_LABEL = nls.localize('defaultLabel', "input");
const NLS_PRESERVE_CASE_LABEL = nls.localize('label.preserveCaseToggle', "Preserve Case");
class PreserveCaseToggle extends Toggle {
    constructor(opts) {
        super({
            // TODO: does this need its own icon?
            icon: Codicon.preserveCase,
            title: NLS_PRESERVE_CASE_LABEL + opts.appendTitle,
            isChecked: opts.isChecked,
            hoverLifecycleOptions: opts.hoverLifecycleOptions,
            inputActiveOptionBorder: opts.inputActiveOptionBorder,
            inputActiveOptionForeground: opts.inputActiveOptionForeground,
            inputActiveOptionBackground: opts.inputActiveOptionBackground,
        });
    }
}
export class ReplaceInput extends Widget {
    static { this.OPTION_CHANGE = 'optionChange'; }
    get onDidOptionChange() { return this._onDidOptionChange.event; }
    get onKeyDown() { return this._onKeyDown.event; }
    get onMouseDown() { return this._onMouseDown.event; }
    get onInput() { return this._onInput.event; }
    get onKeyUp() { return this._onKeyUp.event; }
    get onPreserveCaseKeyDown() { return this._onPreserveCaseKeyDown.event; }
    constructor(parent, contextViewProvider, _showOptionButtons, options) {
        super();
        this._showOptionButtons = _showOptionButtons;
        this.fixFocusOnOptionClickEnabled = true;
        this.cachedOptionsWidth = 0;
        this._onDidOptionChange = this._register(new Emitter());
        this._onKeyDown = this._register(new Emitter());
        this._onMouseDown = this._register(new Emitter());
        this._onInput = this._register(new Emitter());
        this._onKeyUp = this._register(new Emitter());
        this._onPreserveCaseKeyDown = this._register(new Emitter());
        this._lastHighlightFindOptions = 0;
        this.contextViewProvider = contextViewProvider;
        this.placeholder = options.placeholder || '';
        this.validation = options.validation;
        this.label = options.label || NLS_DEFAULT_LABEL;
        const appendPreserveCaseLabel = options.appendPreserveCaseLabel || '';
        const history = options.history || new Set([]);
        const flexibleHeight = !!options.flexibleHeight;
        const flexibleWidth = !!options.flexibleWidth;
        const flexibleMaxHeight = options.flexibleMaxHeight;
        this.domNode = document.createElement('div');
        this.domNode.classList.add('monaco-findInput');
        this.inputBox = this._register(new HistoryInputBox(this.domNode, this.contextViewProvider, {
            ariaLabel: this.label || '',
            placeholder: this.placeholder || '',
            validationOptions: {
                validation: this.validation
            },
            history,
            showHistoryHint: options.showHistoryHint,
            flexibleHeight,
            flexibleWidth,
            flexibleMaxHeight,
            inputBoxStyles: options.inputBoxStyles
        }));
        this.preserveCase = this._register(new PreserveCaseToggle({
            appendTitle: appendPreserveCaseLabel,
            isChecked: false,
            hoverLifecycleOptions: options.hoverLifecycleOptions,
            ...options.toggleStyles
        }));
        this._register(this.preserveCase.onChange(viaKeyboard => {
            this._onDidOptionChange.fire(viaKeyboard);
            if (!viaKeyboard && this.fixFocusOnOptionClickEnabled) {
                this.inputBox.focus();
            }
            this.validate();
        }));
        this._register(this.preserveCase.onKeyDown(e => {
            this._onPreserveCaseKeyDown.fire(e);
        }));
        if (this._showOptionButtons) {
            this.cachedOptionsWidth = this.preserveCase.width();
        }
        else {
            this.cachedOptionsWidth = 0;
        }
        // Arrow-Key support to navigate between options
        const indexes = [this.preserveCase.domNode];
        this.onkeydown(this.domNode, (event) => {
            if (event.equals(15 /* KeyCode.LeftArrow */) || event.equals(17 /* KeyCode.RightArrow */) || event.equals(9 /* KeyCode.Escape */)) {
                const index = indexes.indexOf(this.domNode.ownerDocument.activeElement);
                if (index >= 0) {
                    let newIndex = -1;
                    if (event.equals(17 /* KeyCode.RightArrow */)) {
                        newIndex = (index + 1) % indexes.length;
                    }
                    else if (event.equals(15 /* KeyCode.LeftArrow */)) {
                        if (index === 0) {
                            newIndex = indexes.length - 1;
                        }
                        else {
                            newIndex = index - 1;
                        }
                    }
                    if (event.equals(9 /* KeyCode.Escape */)) {
                        indexes[index].blur();
                        this.inputBox.focus();
                    }
                    else if (newIndex >= 0) {
                        indexes[newIndex].focus();
                    }
                    dom.EventHelper.stop(event, true);
                }
            }
        });
        const controls = document.createElement('div');
        controls.className = 'controls';
        controls.style.display = this._showOptionButtons ? 'block' : 'none';
        controls.appendChild(this.preserveCase.domNode);
        this.domNode.appendChild(controls);
        parent?.appendChild(this.domNode);
        this.onkeydown(this.inputBox.inputElement, (e) => this._onKeyDown.fire(e));
        this.onkeyup(this.inputBox.inputElement, (e) => this._onKeyUp.fire(e));
        this.oninput(this.inputBox.inputElement, (e) => this._onInput.fire());
        this.onmousedown(this.inputBox.inputElement, (e) => this._onMouseDown.fire(e));
    }
    enable() {
        this.domNode.classList.remove('disabled');
        this.inputBox.enable();
        this.preserveCase.enable();
    }
    disable() {
        this.domNode.classList.add('disabled');
        this.inputBox.disable();
        this.preserveCase.disable();
    }
    setFocusInputOnOptionClick(value) {
        this.fixFocusOnOptionClickEnabled = value;
    }
    setEnabled(enabled) {
        if (enabled) {
            this.enable();
        }
        else {
            this.disable();
        }
    }
    clear() {
        this.clearValidation();
        this.setValue('');
        this.focus();
    }
    getValue() {
        return this.inputBox.value;
    }
    setValue(value) {
        if (this.inputBox.value !== value) {
            this.inputBox.value = value;
        }
    }
    onSearchSubmit() {
        this.inputBox.addToHistory();
    }
    applyStyles() {
    }
    select() {
        this.inputBox.select();
    }
    focus() {
        this.inputBox.focus();
    }
    getPreserveCase() {
        return this.preserveCase.checked;
    }
    setPreserveCase(value) {
        this.preserveCase.checked = value;
    }
    focusOnPreserve() {
        this.preserveCase.focus();
    }
    highlightFindOptions() {
        this.domNode.classList.remove('highlight-' + (this._lastHighlightFindOptions));
        this._lastHighlightFindOptions = 1 - this._lastHighlightFindOptions;
        this.domNode.classList.add('highlight-' + (this._lastHighlightFindOptions));
    }
    validate() {
        this.inputBox?.validate();
    }
    showMessage(message) {
        this.inputBox?.showMessage(message);
    }
    clearMessage() {
        this.inputBox?.hideMessage();
    }
    clearValidation() {
        this.inputBox?.hideMessage();
    }
    set width(newWidth) {
        this.inputBox.paddingRight = this.cachedOptionsWidth;
        this.domNode.style.width = newWidth + 'px';
    }
    dispose() {
        super.dispose();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwbGFjZUlucHV0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvYnJvd3Nlci91aS9maW5kaW5wdXQvcmVwbGFjZUlucHV0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sY0FBYyxDQUFDO0FBR3BDLE9BQU8sRUFBaUIsTUFBTSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFHNUQsT0FBTyxFQUFFLGVBQWUsRUFBaUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN6SCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ3RDLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sMEJBQTBCLENBQUM7QUFFMUQsT0FBTyxpQkFBaUIsQ0FBQztBQUN6QixPQUFPLEtBQUssR0FBRyxNQUFNLG9CQUFvQixDQUFDO0FBc0IxQyxNQUFNLGlCQUFpQixHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ2hFLE1BQU0sdUJBQXVCLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQywwQkFBMEIsRUFBRSxlQUFlLENBQUMsQ0FBQztBQUUxRixNQUFNLGtCQUFtQixTQUFRLE1BQU07SUFDdEMsWUFBWSxJQUEwQjtRQUNyQyxLQUFLLENBQUM7WUFDTCxxQ0FBcUM7WUFDckMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxZQUFZO1lBQzFCLEtBQUssRUFBRSx1QkFBdUIsR0FBRyxJQUFJLENBQUMsV0FBVztZQUNqRCxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVM7WUFDekIscUJBQXFCLEVBQUUsSUFBSSxDQUFDLHFCQUFxQjtZQUNqRCx1QkFBdUIsRUFBRSxJQUFJLENBQUMsdUJBQXVCO1lBQ3JELDJCQUEyQixFQUFFLElB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