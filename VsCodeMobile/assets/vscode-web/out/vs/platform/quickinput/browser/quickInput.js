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
import * as dom from '../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../base/browser/keyboardEvent.js';
import { Toggle } from '../../../base/browser/ui/toggle/toggle.js';
import { equals } from '../../../base/common/arrays.js';
import { TimeoutTimer } from '../../../base/common/async.js';
import { Codicon } from '../../../base/common/codicons.js';
import { Emitter, EventBufferer } from '../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../base/common/lifecycle.js';
import { isIOS } from '../../../base/common/platform.js';
import Severity from '../../../base/common/severity.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import './media/quickInput.css';
import { localize } from '../../../nls.js';
import { ItemActivation, NO_KEY_MODS, QuickInputButtonLocation, QuickInputHideReason, QuickPickFocus } from '../common/quickInput.js';
import { quickInputButtonToAction, renderQuickInputDescription } from './quickInputUtils.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IHoverService, WorkbenchHoverDelegate } from '../../hover/browser/hover.js';
import { ContextKeyExpr, RawContextKey } from '../../contextkey/common/contextkey.js';
import { observableValue } from '../../../base/common/observable.js';
export const inQuickInputContextKeyValue = 'inQuickInput';
export const InQuickInputContextKey = new RawContextKey(inQuickInputContextKeyValue, false, localize('inQuickInput', "Whether keyboard focus is inside the quick input control"));
export const inQuickInputContext = ContextKeyExpr.has(inQuickInputContextKeyValue);
export const quickInputAlignmentContextKeyValue = 'quickInputAlignment';
export const QuickInputAlignmentContextKey = new RawContextKey(quickInputAlignmentContextKeyValue, 'top', localize('quickInputAlignment', "The alignment of the quick input"));
export const quickInputTypeContextKeyValue = 'quickInputType';
export const QuickInputTypeContextKey = new RawContextKey(quickInputTypeContextKeyValue, undefined, localize('quickInputType', "The type of the currently visible quick input"));
export const endOfQuickInputBoxContextKeyValue = 'cursorAtEndOfQuickInputBox';
export const EndOfQuickInputBoxContextKey = new RawContextKey(endOfQuickInputBoxContextKeyValue, false, localize('cursorAtEndOfQuickInputBox', "Whether the cursor in the quick input is at the end of the input box"));
export const endOfQuickInputBoxContext = ContextKeyExpr.has(endOfQuickInputBoxContextKeyValue);
export const backButton = {
    iconClass: ThemeIcon.asClassName(Codicon.quickInputBack),
    tooltip: localize('quickInput.back', "Back"),
    handle: -1 // TODO
};
export class QuickInput extends Disposable {
    static { this.noPromptMessage = localize('inputModeEntry', "Press 'Enter' to confirm your input or 'Escape' to cancel"); }
    constructor(ui) {
        super();
        this.ui = ui;
        this._visible = observableValue('visible', false);
        this._widgetUpdated = false;
        this._enabled = true;
        this._busy = false;
        this._ignoreFocusOut = false;
        this._leftButtons = [];
        this._rightButtons = [];
        this._inlineButtons = [];
        this.buttonsUpdated = false;
        this._toggles = [];
        this.togglesUpdated = false;
        this.noValidationMessage = QuickInput.noPromptMessage;
        this._severity = Severity.Ignore;
        this.onDidTriggerButtonEmitter = this._register(new Emitter());
        this.onDidHideEmitter = this._register(new Emitter());
        this.onWillHideEmitter = this._register(new Emitter());
        this.onDisposeEmitter = this._register(new Emitter());
        this.visibleDisposables = this._register(new DisposableStore());
        this.onDidTriggerButton = this.onDidTriggerButtonEmitter.event;
        this.onDidHide = this.onDidHideEmitter.event;
        this.onWillHide = this.onWillHideEmitter.event;
        this.onDispose = this.onDisposeEmitter.event;
    }
    get visible() {
        return this._visible.get();
    }
    get title() {
        return this._title;
    }
    set title(title) {
        this._title = title;
        this.update();
    }
    get description() {
        return this._description;
    }
    set description(description) {
        this._description = description;
        this.update();
    }
    get widget() {
        return this._widget;
    }
    set widget(widget) {
        if (!(dom.isHTMLElement(widget))) {
            return;
        }
        if (this._widget !== widget) {
            this._widget = widget;
            this._widgetUpdated = true;
            this.update();
        }
    }
    get step() {
        return this._steps;
    }
    set step(step) {
        this._steps = step;
        this.update();
    }
    get totalSteps() {
        return this._totalSteps;
    }
    set totalSteps(totalSteps) {
        this._totalSteps = totalSteps;
        this.update();
    }
    get enabled() {
        return this._enabled;
    }
    set enabled(enabled) {
        this._enabled = enabled;
        this.update();
    }
    get contextKey() {
        return this._contextKey;
    }
    set contextKey(contextKey) {
        this._contextKey = contextKey;
        this.update();
    }
    get busy() {
        return this._busy;
    }
    set busy(busy) {
        this._busy = busy;
        this.update();
    }
    get ignoreFocusOut() {
        return this._ignoreFocusOut;
    }
    set ignoreFocusOut(ignoreFocusOut) {
        const shouldUpdate = this._ignoreFocusOut !== ignoreFocusOut && !isIOS;
        this._ignoreFocusOut = ignoreFocusOut && !isIOS;
        if (shouldUpdate) {
            this.update();
        }
    }
    get titleButtons() {
        return this._leftButtons.length
            ? [...this._leftButtons, this._rightButtons]
            : this._rightButtons;
    }
    get buttons() {
        return [
            ...this._leftButtons,
            ...this._rightButtons,
            ...this._inlineButtons
        ];
    }
    set buttons(buttons) {
        this._leftButtons = buttons.filter(b => b === backButton);
        this._rightButtons = buttons.filter(b => b !== backButton && b.location !== QuickInputButtonLocation.Inline);
        this._inlineButtons = buttons.filter(b => b.location === QuickInputButtonLocation.Inline);
        this.buttonsUpdated = true;
        this.update();
    }
    get toggles() {
        return this._toggles;
    }
    set toggles(toggles) {
        this._toggles = toggles ?? [];
        this.togglesUpdated = true;
        this.update();
    }
    get validationMessage() {
        return this._validationMessage;
    }
    set validationMessage(validationMessage) {
        this._validationMessage = validationMessage;
        this.update();
    }
    get severity() {
        return this._severity;
    }
    set severity(severity) {
        this._severity = severity;
        this.update();
    }
    show() {
        if (this.visible) {
            return;
        }
        this.visibleDisposables.add(this.ui.onDidTriggerButton(button => {
            if (this.buttons.indexOf(button) !== -1) {
                this.onDidTriggerButtonEmitter.fire(button);
            }
        }));
        this.ui.show(this);
        // update properties in the controller that get reset in the ui.show() call
        this._visible.set(true, undefined);
        // This ensures the message/prompt gets rendered
        this._lastValidationMessage = undefined;
        // This ensures the input box has the right severity applied
        this._lastSeverity = undefined;
        if (this.buttons.length) {
            // if there are buttons, the ui.show() clears them out of the UI so we should
            // rerender them.
            this.buttonsUpdated = true;
        }
        if (this.toggles.length) {
            // if there are toggles, the ui.show() clears them out of the UI so we should
            // rerender them.
            this.togglesUpdated = true;
        }
        this.update();
    }
    hide() {
        if (!this.visible) {
            return;
        }
        this.ui.hide();
    }
    didHide(reason = QuickInputHideReason.Other) {
        this._visible.set(false, undefined);
        this.visibleDisposables.clear();
        this.onDidHideEmitter.fire({ reason });
    }
    willHide(reason = QuickInputHideReason.Other) {
        this.onWillHideEmitter.fire({ reason });
    }
    update() {
        if (!this.visible) {
            return;
        }
        const title = this.getTitle();
        if (title && this.ui.title.textContent !== title) {
            this.ui.title.textContent = title;
        }
        else if (!title && this.ui.title.innerHTML !== '&nbsp;') {
            this.ui.title.innerText = '\u00a0';
        }
        const description = this.getDescription();
        if (this.ui.description1.textContent !== description) {
            this.ui.description1.textContent = description;
        }
        if (this.ui.description2.textContent !== description) {
            this.ui.description2.textContent = description;
        }
        if (this._widgetUpdated) {
            this._widgetUpdated = false;
            if (this._widget) {
                dom.reset(this.ui.widget, this._widget);
            }
            else {
                dom.reset(this.ui.widget);
            }
        }
        if (this.busy && !this.busyDelay) {
            this.busyDelay = new TimeoutTimer();
            this.busyDelay.setIfNotSet(() => {
                if (this.visible) {
                    this.ui.progressBar.infinite();
                    this.ui.progressBar.getContainer().removeAttribute('aria-hidden');
                }
            }, 800);
        }
        if (!this.busy && this.busyDelay) {
            this.ui.progressBar.stop();
            this.ui.progressBar.getContainer().setAttribute('aria-hidden', 'true');
            this.busyDelay.cancel();
            this.busyDelay = undefined;
        }
        if (this.buttonsUpdated) {
            this.buttonsUpdated = false;
            this.ui.leftActionBar.clear();
            const leftButtons = this._leftButtons
                .map((button, index) => quickInputButtonToAction(button, `id-${index}`, async () => this.onDidTriggerButtonEmitter.fire(button)));
            this.ui.leftActionBar.push(leftButtons, { icon: true, label: false });
            this.ui.rightActionBar.clear();
            const rightButtons = this._rightButtons
                .map((button, index) => quickInputButtonToAction(button, `id-${index}`, async () => this.onDidTriggerButtonEmitter.fire(button)));
            this.ui.rightActionBar.push(rightButtons, { icon: true, label: false });
            this.ui.inlineActionBar.clear();
            const inlineButtons = this._inlineButtons
                .map((button, index) => quickInputButtonToAction(button, `id-${index}`, async () => this.onDidTriggerButtonEmitter.fire(button)));
            this.ui.inlineActionBar.push(inlineButtons, { icon: true, label: false });
        }
        if (this.togglesUpdated) {
            this.togglesUpdated = false;
            // HACK: Filter out toggles here that are not concrete Toggle objects. This is to workaround
            // a layering issue as quick input's interface is in common but Toggle is in browser and
            // it requires a HTMLElement on its interface
            const concreteToggles = this.toggles?.filter(opts => opts instanceof Toggle) ?? [];
            this.ui.inputBox.toggles = concreteToggles;
            // Adjust count badge position based on number of toggles (each toggle is ~22px wide)
            const toggleOffset = concreteToggles.length * 22;
            this.ui.countContainer.style.right = toggleOffset > 0 ? `${4 + toggleOffset}px` : '4px';
            this.ui.visibleCountContainer.style.right = toggleOffset > 0 ? `${4 + toggleOffset}px` : '4px';
        }
        this.ui.ignoreFocusOut = this.ignoreFocusOut;
        this.ui.setEnabled(this.enabled);
        this.ui.setContextKey(this.contextKey);
        const validationMessage = this.validationMessage || this.noValidationMessage;
        if (this._lastValidationMessage !== validationMessage) {
            this._lastValidationMessage = validationMessage;
            dom.reset(this.ui.message);
            if (validationMessage) {
                renderQuickInputDescription(validationMessage, this.ui.message, {
                    callback: (content) => {
                        this.ui.linkOpenerDelegate(content);
                    },
                    disposables: this.visibleDisposables,
                });
            }
        }
        if (this._lastSeverity !== this.severity) {
            this._lastSeverity = this.severity;
            this.showMessageDecoration(this.severity);
        }
    }
    getTitle() {
        if (this.title && this.step) {
            return `${this.title} (${this.getSteps()})`;
        }
        if (this.title) {
            return this.title;
        }
        if (this.step) {
            return this.getSteps();
        }
        return '';
    }
    getDescription() {
        return this.description || '';
    }
    getSteps() {
        if (this.step && this.totalSteps) {
            return localize('quickInput.steps', "{0}/{1}", this.step, this.totalSteps);
        }
        if (this.step) {
            return String(this.step);
        }
        return '';
    }
    showMessageDecoration(severity) {
        this.ui.inputBox.showDecoration(severity);
        if (severity !== Severity.Ignore) {
            const styles = this.ui.inputBox.stylesForType(severity);
            this.ui.message.style.color = styles.foreground ? `${styles.foreground}` : '';
            this.ui.message.style.backgroundColor = styles.background ? `${styles.background}` : '';
            this.ui.message.style.border = styles.border ? `1px solid ${styles.border}` : '';
            this.ui.message.style.marginBottom = '-2px';
        }
        else {
            this.ui.message.style.color = '';
            this.ui.message.style.backgroundColor = '';
            this.ui.message.style.border = '';
            this.ui.message.style.marginBottom = '';
        }
    }
    dispose() {
        this.hide();
        this.onDisposeEmitter.fire();
        super.dispose();
    }
}
export class QuickPick extends QuickInput {
    static { this.DEFAULT_ARIA_LABEL = localize('quickInputBox.ariaLabel', "Type to narrow down results."); }
    constructor(ui) {
        super(ui);
        this._value = '';
        this.onDidChangeValueEmitter = this._register(new Emitter());
        this.onWillAcceptEmitter = this._register(new Emitter());
        this.onDidAcceptEmitter = this._register(new Emitter());
        this.onDidCustomEmitter = this._register(new Emitter());
        this._items = [];
        this.itemsUpdated = false;
        this._canSelectMany = false;
        this._canAcceptInBackground = false;
        this._matchOnDescription = false;
        this._matchOnDetail = false;
        this._matchOnLabel = true;
        this._matchOnLabelMode = 'fuzzy';
        this._sortByLabel = true;
        this._keepScrollPosition = false;
        this._itemActivation = ItemActivation.FIRST;
        this._activeItems = [];
        this.activeItemsUpdated = false;
        this.activeItemsToConfirm = [];
        this.onDidChangeActiveEmitter = this._register(new Emitter());
        this._selectedItems = [];
        this.selectedItemsUpdated = false;
        this.selectedItemsToConfirm = [];
        this.onDidChangeSelectionEmitter = this._register(new Emitter());
        this.onDidTriggerItemButtonEmitter = this._register(new Emitter());
        this.onDidTriggerSeparatorButtonEmitter = this._register(new Emitter());
        this.valueSelectionUpdated = true;
        this._ok = 'default';
        this._customButton = false;
        this._focusEventBufferer = new EventBufferer();
        this.type = "quickPick" /* QuickInputType.QuickPick */;
        this.filterValue = (value) => value;
        this.onDidChangeValue = this.onDidChangeValueEmitter.event;
        this.onWillAccept = this.onWillAcceptEmitter.event;
        this.onDidAccept = this.onDidAcceptEmitter.event;
        this.onDidCustom = this.onDidCustomEmitter.event;
        this.onDidChangeActive = this.onDidChangeActiveEmitter.event;
        this.onDidChangeSelection = this.onDidChangeSelectionEmitter.event;
        this.onDidTriggerItemButton = this.onDidTriggerItemButtonEmitter.event;
        this.onDidTriggerSeparatorButton = this.onDidTriggerSeparatorButtonEmitter.event;
        this.noValidationMessage = undefined;
    }
    get quickNavigate() {
        return this._quickNavigate;
    }
    set quickNavigate(quickNavigate) {
        this._quickNavigate = quickNavigate;
        this.update();
    }
    get value() {
        return this._value;
    }
    set value(value) {
        this.doSetValue(value);
    }
    doSetValue(value, skipUpdate) {
        if (this._value !== value) {
            this._value = value;
            if (!skipUpdate) {
                this.update();
            }
            if (this.visible) {
                const didFilter = this.ui.list.filter(this.filterValue(this._value));
                if (didFilter) {
                    this.trySelectFirst();
                }
            }
            this.onDidChangeValueEmitter.fire(this._value);
        }
    }
    set ariaLabel(ariaLabel) {
        this._ariaLabel = ariaLabel;
        this.update();
    }
    get ariaLabel() {
        return this._ariaLabel;
    }
    get placeholder() {
        return this._placeholder;
    }
    set placeholder(placeholder) {
        this._placeholder = placeholder;
        this.update();
    }
    get prompt() {
        return this.noValidationMessage;
    }
    set prompt(prompt) {
        this.noValidationMessage = prompt;
        this.update();
    }
    get items() {
        return this._items;
    }
    get scrollTop() {
        return this.ui.list.scrollTop;
    }
    set scrollTop(scrollTop) {
        this.ui.list.scrollTop = scrollTop;
    }
    set items(items) {
        this._items = items;
        this.itemsUpdated = true;
        this.update();
    }
    get canSelectMany() {
        return this._canSelectMany;
    }
    set canSelectMany(canSelectMany) {
        this._canSelectMany = canSelectMany;
        this.update();
    }
    get canAcceptInBackground() {
        return this._canAcceptInBackground;
    }
    set canAcceptInBackground(canAcceptInBackground) {
        this._canAcceptInBackground = canAcceptInBackground;
    }
    get matchOnDescription() {
        return this._matchOnDescription;
    }
    set matchOnDescription(matchOnDescription) {
        this._matchOnDescription = matchOnDescription;
        this.update();
    }
    get matchOnDetail() {
        return this._matchOnDetail;
    }
    set matchOnDetail(matchOnDetail) {
        this._matchOnDetail = matchOnDetail;
        this.update();
    }
    get matchOnLabel() {
        return this._matchOnLabel;
    }
    set matchOnLabel(matchOnLabel) {
        this._matchOnLabel = matchOnLabel;
        this.update();
    }
    get matchOnLabelMode() {
        return this._matchOnLabelMode;
    }
    set matchOnLabelMode(matchOnLabelMode) {
        this._matchOnLabelMode = matchOnLabelMode;
        this.update();
    }
    get sortByLabel() {
        return this._sortByLabel;
    }
    set sortByLabel(sortByLabel) {
        this._sortByLabel = sortByLabel;
        this.update();
    }
    get keepScrollPosition() {
        return this._keepScrollPosition;
    }
    set keepScrollPosition(keepScrollPosition) {
        this._keepScrollPosition = keepScrollPosition;
    }
    get itemActivation() {
        return this._itemActivation;
    }
    set itemActivation(itemActivation) {
        this._itemActivation = itemActivation;
    }
    get activeItems() {
        return this._activeItems;
    }
    set activeItems(activeItems) {
        this._activeItems = activeItems;
        this.activeItemsUpdated = true;
        this.update();
    }
    get selectedItems() {
        return this._selectedItems;
    }
    set selectedItems(selectedItems) {
        this._selectedItems = selectedItems;
        this.selectedItemsUpdated = true;
        this.update();
    }
    get keyMods() {
        if (this._quickNavigate) {
            // Disable keyMods when quick navigate is enabled
            // because in this model the interaction is purely
            // keyboard driven and Ctrl/Alt are typically
            // pressed and hold during this interaction.
            return NO_KEY_MODS;
        }
        return this.ui.keyMods;
    }
    get valueSelection() {
        const selection = this.ui.inputBox.getSelection();
        if (!selection) {
            return undefined;
        }
        return [selection.start, selection.end];
    }
    set valueSelection(valueSelection) {
        this._valueSelection = valueSelection;
        this.valueSelectionUpdated = true;
        this.update();
    }
    get customButton() {
        return this._customButton;
    }
    set customButton(showCustomButton) {
        this._customButton = showCustomButton;
        this.update();
    }
    get customLabel() {
        return this._customButtonLabel;
    }
    set customLabel(label) {
        this._customButtonLabel = label;
        this.update();
    }
    get customHover() {
        return this._customButtonHover;
    }
    set customHover(hover) {
        this._customButtonHover = hover;
        this.update();
    }
    get ok() {
        return this._ok;
    }
    set ok(showOkButton) {
        this._ok = showOkButton;
        this.update();
    }
    get okLabel() {
        return this._okLabel ?? localize('ok', "OK");
    }
    set okLabel(okLabel) {
        this._okLabel = okLabel;
        this.update();
    }
    inputHasFocus() {
        return this.visible ? this.ui.inputBox.hasFocus() : false;
    }
    focusOnInput() {
        this.ui.inputBox.setFocus();
    }
    get hideInput() {
        return !!this._hideInput;
    }
    set hideInput(hideInput) {
        this._hideInput = hideInput;
        this.update();
    }
    get hideCountBadge() {
        return !!this._hideCountBadge;
    }
    set hideCountBadge(hideCountBadge) {
        this._hideCountBadge = hideCountBadge;
        this.update();
    }
    get hideCheckAll() {
        return !!this._hideCheckAll;
    }
    set hideCheckAll(hideCheckAll) {
        this._hideCheckAll = hideCheckAll;
        this.update();
    }
    trySelectFirst() {
        if (!this.canSelectMany) {
            this.ui.list.focus(QuickPickFocus.First);
        }
    }
    show() {
        if (!this.visible) {
            this.visibleDisposables.add(this.ui.inputBox.onDidChange(value => {
                this.doSetValue(value, true /* skip update since this originates from the UI */);
            }));
            this.visibleDisposables.add(this.ui.onDidAccept(() => {
                if (this.canSelectMany) {
                    // if there are no checked elements, it means that an onDidChangeSelection never fired to overwrite
                    // `_selectedItems`. In that case, we should emit one with an empty array to ensure that
                    // `.selectedItems` is up to date.
                    if (!this.ui.list.getCheckedElements().length) {
                        this._selectedItems = [];
                        this.onDidChangeSelectionEmitter.fire(this.selectedItems);
                    }
                }
                else if (this.activeItems[0]) {
                    // For single-select, we set `selectedItems` to the item that was accepted.
                    this._selectedItems = [this.activeItems[0]];
                    this.onDidChangeSelectionEmitter.fire(this.selectedItems);
                }
                this.handleAccept(false);
            }));
            this.visibleDisposables.add(this.ui.onDidCustom(() => {
                this.onDidCustomEmitter.fire();
            }));
            this.visibleDisposables.add(this._focusEventBufferer.wrapEvent(this.ui.list.onDidChangeFocus, 
            // Only fire the last event
            (_, e) => e)(focusedItems => {
                if (this.activeItemsUpdated) {
                    return; // Expect another event.
                }
                if (this.activeItemsToConfirm !== this._activeItems && equals(focusedItems, this._activeItems, (a, b) => a === b)) {
                    return;
                }
                this._activeItems = focusedItems;
                this.onDidChangeActiveEmitter.fire(focusedItems);
            }));
            this.visibleDisposables.add(this.ui.list.onDidChangeSelection(({ items: selectedItems, event }) => {
                if (this.canSelectMany && !selectedItems.some(i => i.pickable === false)) {
                    if (selectedItems.length) {
                        this.ui.list.setSelectedElements([]);
                    }
                    return;
                }
                if (this.selectedItemsToConfirm !== this._selectedItems && equals(selectedItems, this._selectedItems, (a, b) => a === b)) {
                    return;
                }
                this._selectedItems = selectedItems;
                this.onDidChangeSelectionEmitter.fire(selectedItems);
                if (selectedItems.length) {
                    this.handleAccept(dom.isMouseEvent(event) && event.button === 1 /* mouse middle click */);
                }
            }));
            this.visibleDisposables.add(this.ui.list.onChangedCheckedElements(checkedItems => {
                if (!this.canSelectMany || !this.visible) {
                    return;
                }
                if (this.selectedItemsToConfirm !== this._selectedItems && equals(checkedItems, this._selectedItems, (a, b) => a === b)) {
                    return;
                }
                this._selectedItems = checkedItems;
                this.onDidChangeSelectionEmitter.fire(checkedItems);
            }));
            this.visibleDisposables.add(this.ui.list.onButtonTriggered(event => this.onDidTriggerItemButtonEmitter.fire(event)));
            this.visibleDisposables.add(this.ui.list.onSeparatorButtonTriggered(event => this.onDidTriggerSeparatorButtonEmitter.fire(event)));
            this.visibleDisposables.add(this.registerQuickNavigation());
            this.valueSelectionUpdated = true;
        }
        super.show(); // TODO: Why have show() bubble up while update() trickles down?
    }
    handleAccept(inBackground) {
        // Figure out veto via `onWillAccept` event
        let veto = false;
        this.onWillAcceptEmitter.fire({ veto: () => veto = true });
        // Continue with `onDidAccept` if no veto
        if (!veto) {
            this.onDidAcceptEmitter.fire({ inBackground });
        }
    }
    registerQuickNavigation() {
        return dom.addDisposableListener(this.ui.container, dom.EventType.KEY_UP, e => {
            if (this.canSelectMany || !this._quickNavigate) {
                return;
            }
            const keyboardEvent = new StandardKeyboardEvent(e);
            const keyCode = keyboardEvent.keyCode;
            // Select element when keys are pressed that signal it
            const quickNavKeys = this._quickNavigate.keybindings;
            const wasTriggerKeyPressed = quickNavKeys.some(k => {
                const chords = k.getChords();
                if (chords.length > 1) {
                    return false;
                }
                if (chords[0].shiftKey && keyCode === 4 /* KeyCode.Shift */) {
                    if (keyboardEvent.ctrlKey || keyboardEvent.altKey || keyboardEvent.metaKey) {
                        return false; // this is an optimistic check for the shift key being used to navigate back in quick input
                    }
                    return true;
                }
                if (chords[0].altKey && keyCode === 6 /* KeyCode.Alt */) {
                    return true;
                }
                if (chords[0].ctrlKey && keyCode === 5 /* KeyCode.Ctrl */) {
                    return true;
                }
                if (chords[0].metaKey && keyCode === 57 /* KeyCode.Meta */) {
                    return true;
                }
                return false;
            });
            if (wasTriggerKeyPressed) {
                if (this.activeItems[0]) {
                    this._selectedItems = [this.activeItems[0]];
                    this.onDidChangeSelectionEmitter.fire(this.selectedItems);
                    this.handleAccept(false);
                }
                // Unset quick navigate after press. It is only valid once
                // and should not result in any behaviour change afterwards
                // if the picker remains open because there was no active item
                this._quickNavigate = undefined;
            }
        });
    }
    update() {
        if (!this.visible) {
            return;
        }
        // store the scrollTop before it is reset
        const scrollTopBefore = this.keepScrollPosition ? this.scrollTop : 0;
        const hasDescription = !!this.description;
        const visibilities = {
            title: !!this.title || !!this.step || !!this.titleButtons.length,
            description: hasDescription,
            checkAll: this.canSelectMany && !this._hideCheckAll,
            checkBox: this.canSelectMany,
            inputBox: !this._hideInput,
            progressBar: !this._hideInput || hasDescription,
            visibleCount: true,
            count: this.canSelectMany && !this._hideCountBadge,
            ok: this.ok === 'default' ? this.canSelectMany : this.ok,
            list: true,
            message: !!this.validationMessage || !!this.prompt,
            customButton: this.customButton
        };
        this.ui.setVisibilities(visibilities);
        super.update();
        if (this.ui.inputBox.value !== this.value) {
            this.ui.inputBox.value = this.value;
        }
        if (this.valueSelectionUpdated) {
            this.valueSelectionUpdated = false;
            this.ui.inputBox.select(this._valueSelection && { start: this._valueSelection[0], end: this._valueSelection[1] });
        }
        if (this.ui.inputBox.placeholder !== (this.placeholder || '')) {
            this.ui.inputBox.placeholder = (this.placeholder || '');
        }
        let ariaLabel = this.ariaLabel;
        // Only set aria label to the input box placeholder if we actually have an input box.
        if (!ariaLabel && visibilities.inputBox) {
            ariaLabel = this.placeholder;
            // If we have a title, include it in the aria label.
            if (this.title) {
                ariaLabel = ariaLabel
                    ? `${ariaLabel} - ${this.title}`
                    : this.title;
            }
            if (!ariaLabel) {
                ariaLabel = QuickPick.DEFAULT_ARIA_LABEL;
            }
        }
        if (this.ui.list.ariaLabel !== ariaLabel) {
            this.ui.list.ariaLabel = ariaLabel ?? null;
        }
        if (this.ui.inputBox.ariaLabel !== ariaLabel) {
            this.ui.inputBox.ariaLabel = ariaLabel ?? 'input';
        }
        this.ui.list.matchOnDescription = this.matchOnDescription;
        this.ui.list.matchOnDetail = this.matchOnDetail;
        this.ui.list.matchOnLabel = this.matchOnLabel;
        this.ui.list.matchOnLabelMode = this.matchOnLabelMode;
        this.ui.list.sortByLabel = this.sortByLabel;
        if (this.itemsUpdated) {
            this.itemsUpdated = false;
            this._focusEventBufferer.bufferEvents(() => {
                this.ui.list.setElements(this.items);
                // We want focus to exist in the list if there are items so that space can be used to toggle
                this.ui.list.shouldLoop = !this.canSelectMany;
                this.ui.list.filter(this.filterValue(this.ui.inputBox.value));
                switch (this._itemActivation) {
                    case ItemActivation.NONE:
                        this._itemActivation = ItemActivation.FIRST; // only valid once, then unset
                        break;
                    case ItemActivation.SECOND:
                        this.ui.list.focus(QuickPickFocus.Second);
                        this._itemActivation = ItemActivation.FIRST; // only valid once, then unset
                        break;
                    case ItemActivation.LAST:
                        this.ui.list.focus(QuickPickFocus.Last);
                        this._itemActivation = ItemActivation.FIRST; // only valid once, then unset
                        break;
                    default:
                        this.trySelectFirst();
                        break;
                }
            });
        }
        if (this.ui.container.classList.contains('show-checkboxes') !== !!this.canSelectMany) {
            if (this.canSelectMany) {
                this.ui.list.clearFocus();
            }
            else {
                this.trySelectFirst();
            }
        }
        if (this.activeItemsUpdated) {
            this.activeItemsUpdated = false;
            this.activeItemsToConfirm = this._activeItems;
            this.ui.list.setFocusedElements(this.activeItems);
            if (this.activeItemsToConfirm === this._activeItems) {
                this.activeItemsToConfirm = null;
            }
        }
        if (this.selectedItemsUpdated) {
            this.selectedItemsUpdated = false;
            this.selectedItemsToConfirm = this._selectedItems;
            if (this.canSelectMany) {
                this.ui.list.setCheckedElements(this.selectedItems);
            }
            else {
                this.ui.list.setSelectedElements(this.selectedItems);
            }
            if (this.selectedItemsToConfirm === this._selectedItems) {
                this.selectedItemsToConfirm = null;
            }
        }
        this.ui.ok.label = this.okLabel || '';
        this.ui.customButton.label = this.customLabel || '';
        this.ui.customButton.element.title = this.customHover || '';
        if (!visibilities.inputBox) {
            // we need to move focus into the tree to detect keybindings
            // properly when the input box is not visible (quick nav)
            this.ui.list.domFocus();
            // Focus the first element in the list if multiselect is enabled
            if (this.canSelectMany) {
                this.ui.list.focus(QuickPickFocus.First);
            }
        }
        // Set the scroll position to what it was before updating the items
        if (this.keepScrollPosition) {
            this.scrollTop = scrollTopBefore;
        }
    }
    focus(focus) {
        this.ui.list.focus(focus);
        // To allow things like space to check/uncheck items
        if (this.canSelectMany) {
            this.ui.list.domFocus();
        }
    }
    accept(inBackground) {
        if (inBackground && !this._canAcceptInBackground) {
            return; // needs to be enabled
        }
        if (this.activeItems[0] && !this._canSelectMany) {
            this._selectedItems = [this.activeItems[0]];
            this.onDidChangeSelectionEmitter.fire(this.selectedItems);
        }
        this.handleAccept(inBackground ?? false);
    }
}
export class InputBox extends QuickInput {
    constructor() {
        super(...arguments);
        this._value = '';
        this.valueSelectionUpdated = true;
        this._password = false;
        this.onDidValueChangeEmitter = this._register(new Emitter());
        this.onDidAcceptEmitter = this._register(new Emitter());
        this.type = "inputBox" /* QuickInputType.InputBox */;
        this.onDidChangeValue = this.onDidValueChangeEmitter.event;
        this.onDidAccept = this.onDidAcceptEmitter.event;
    }
    get value() {
        return this._value;
    }
    set value(value) {
        this._value = value || '';
        this.update();
    }
    get valueSelection() {
        const selection = this.ui.inputBox.getSelection();
        if (!selection) {
            return undefined;
        }
        return [selection.start, selection.end];
    }
    set valueSelection(valueSelection) {
        this._valueSelection = valueSelection;
        this.valueSelectionUpdated = true;
        this.update();
    }
    get placeholder() {
        return this._placeholder;
    }
    set placeholder(placeholder) {
        this._placeholder = placeholder;
        this.update();
    }
    get ariaLabel() {
        return this._ariaLabel;
    }
    set ariaLabel(ariaLabel) {
        this._ariaLabel = ariaLabel;
        this.update();
    }
    get password() {
        return this._password;
    }
    set password(password) {
        this._password = password;
        this.update();
    }
    get prompt() {
        return this._prompt;
    }
    set prompt(prompt) {
        this._prompt = prompt;
        this.noValidationMessage = prompt
            ? localize('inputModeEntryDescription', "{0} (Press 'Enter' to confirm or 'Escape' to cancel)", prompt)
            : QuickInput.noPromptMessage;
        this.update();
    }
    show() {
        if (!this.visible) {
            this.visibleDisposables.add(this.ui.inputBox.onDidChange(value => {
                if (value === this.value) {
                    return;
                }
                this._value = value;
                this.onDidValueChangeEmitter.fire(value);
            }));
            this.visibleDisposables.add(this.ui.onDidAccept(() => this.onDidAcceptEmitter.fire()));
            this.valueSelectionUpdated = true;
        }
        super.show();
    }
    accept() {
        this.onDidAcceptEmitter.fire();
    }
    update() {
        if (!this.visible) {
            return;
        }
        this.ui.container.classList.remove('hidden-input');
        const visibilities = {
            title: !!this.title || !!this.step || !!this.titleButtons.length,
            description: !!this.description || !!this.step,
            inputBox: true,
            message: true,
            progressBar: true
        };
        this.ui.setVisibilities(visibilities);
        super.update();
        if (this.ui.inputBox.value !== this.value) {
            this.ui.inputBox.value = this.value;
        }
        if (this.valueSelectionUpdated) {
            this.valueSelectionUpdated = false;
            this.ui.inputBox.select(this._valueSelection && { start: this._valueSelection[0], end: this._valueSelection[1] });
        }
        if (this.ui.inputBox.placeholder !== (this.placeholder || '')) {
            this.ui.inputBox.placeholder = (this.placeholder || '');
        }
        if (this.ui.inputBox.password !== this.password) {
            this.ui.inputBox.password = this.password;
        }
        let ariaLabel = this.ariaLabel;
        // Only set aria label to the input box placeholder if we actually have an input box.
        if (!ariaLabel && visibilities.inputBox) {
            ariaLabel = this.placeholder
                ? this.title
                    ? `${this.placeholder} - ${this.title}`
                    : this.placeholder
                : this.title
                    ? this.title
                    : 'input';
        }
        if (this.ui.inputBox.ariaLabel !== ariaLabel) {
            this.ui.inputBox.ariaLabel = ariaLabel || 'input';
        }
    }
}
export class QuickWidget extends QuickInput {
    constructor() {
        super(...arguments);
        this.type = "quickWidget" /* QuickInputType.QuickWidget */;
    }
    update() {
        if (!this.visible) {
            return;
        }
        const visibilities = {
            title: !!this.title || !!this.step || !!this.titleButtons.length,
            description: !!this.description || !!this.step
        };
        this.ui.setVisibilities(visibilities);
        super.update();
    }
}
let QuickInputHoverDelegate = class QuickInputHoverDelegate extends WorkbenchHoverDelegate {
    constructor(configurationService, hoverService) {
        super('mouse', undefined, (options) => this.getOverrideOptions(options), configurationService, hoverService);
    }
    getOverrideOptions(options) {
        // Only show the hover hint if the content is of a decent size
        const showHoverHint = (dom.isHTMLElement(options.content)
            ? options.content.textContent ?? ''
            : typeof options.content === 'string'
                ? options.content
                : options.content.value).includes('\n');
        return {
            persistence: {
                hideOnKeyDown: false,
            },
            appearance: {
                showHoverHint,
                skipFadeInAnimation: true,
            },
        };
    }
};
QuickInputHoverDelegate = __decorate([
    __param(0, IConfigurationService),
    __param(1, IHoverService)
], QuickInputHoverDelegate);
export { QuickInputHoverDelegate };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVpY2tJbnB1dC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9xdWlja2lucHV0L2Jyb3dzZXIvcXVpY2tJbnB1dC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLDhCQUE4QixDQUFDO0FBQ3BELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBUy9FLE9BQU8sRUFBaUIsTUFBTSxFQUFvQixNQUFNLDJDQUEyQyxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUN4RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDN0QsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxPQUFPLEVBQVMsYUFBYSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFOUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNoRixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekQsT0FBTyxRQUFRLE1BQU0sa0NBQWtDLENBQUM7QUFDeEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzlELE9BQU8sd0JBQXdCLENBQUM7QUFDaEMsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzNDLE9BQU8sRUFBNFMsY0FBYyxFQUFFLFdBQVcsRUFBRSx3QkFBd0IsRUFBRSxvQkFBb0IsRUFBa0IsY0FBYyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFFaGMsT0FBTyxFQUFFLHdCQUF3QixFQUFFLDJCQUEyQixFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDN0YsT0FBTyxFQUFFLHFC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