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
var QuickInputController_1;
import * as dom from '../../../base/browser/dom.js';
import * as domStylesheetsJs from '../../../base/browser/domStylesheets.js';
import { ActionBar } from '../../../base/browser/ui/actionbar/actionbar.js';
import { Button } from '../../../base/browser/ui/button/button.js';
import { CountBadge } from '../../../base/browser/ui/countBadge/countBadge.js';
import { ProgressBar } from '../../../base/browser/ui/progressbar/progressbar.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, dispose } from '../../../base/common/lifecycle.js';
import Severity from '../../../base/common/severity.js';
import { isString } from '../../../base/common/types.js';
import { isModifierKey } from '../../../base/common/keyCodes.js';
import { localize } from '../../../nls.js';
import { QuickInputHideReason, QuickPickFocus } from '../common/quickInput.js';
import { QuickInputBox } from './quickInputBox.js';
import { QuickPick, backButton, InputBox, QuickWidget, InQuickInputContextKey, QuickInputTypeContextKey, EndOfQuickInputBoxContextKey, QuickInputAlignmentContextKey } from './quickInput.js';
import { ILayoutService } from '../../layout/browser/layoutService.js';
import { mainWindow } from '../../../base/browser/window.js';
import { IInstantiationService } from '../../instantiation/common/instantiation.js';
import { QuickInputList } from './quickInputList.js';
import { IContextKeyService } from '../../contextkey/common/contextkey.js';
import './quickInputActions.js';
import { autorun, observableValue } from '../../../base/common/observable.js';
import { StandardMouseEvent } from '../../../base/browser/mouseEvent.js';
import { IStorageService } from '../../storage/common/storage.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { platform, setTimeout0 } from '../../../base/common/platform.js';
import { getWindowControlsStyle } from '../../window/common/window.js';
import { getZoomFactor } from '../../../base/browser/browser.js';
import { TriStateCheckbox } from '../../../base/browser/ui/toggle/toggle.js';
import { defaultCheckboxStyles } from '../../theme/browser/defaultStyles.js';
import { QuickInputTreeController } from './tree/quickInputTreeController.js';
import { QuickTree } from './tree/quickTree.js';
const $ = dom.$;
const VIEWSTATE_STORAGE_KEY = 'workbench.quickInput.viewState';
let QuickInputController = class QuickInputController extends Disposable {
    static { QuickInputController_1 = this; }
    static { this.MAX_WIDTH = 600; } // Max total width of quick input widget
    get currentQuickInput() { return this.controller ?? undefined; }
    get container() { return this._container; }
    constructor(options, layoutService, instantiationService, contextKeyService, storageService) {
        super();
        this.options = options;
        this.layoutService = layoutService;
        this.instantiationService = instantiationService;
        this.storageService = storageService;
        this.enabled = true;
        this.onDidAcceptEmitter = this._register(new Emitter());
        this.onDidCustomEmitter = this._register(new Emitter());
        this.onDidTriggerButtonEmitter = this._register(new Emitter());
        this.keyMods = { ctrlCmd: false, alt: false };
        this.controller = null;
        this.onShowEmitter = this._register(new Emitter());
        this.onShow = this.onShowEmitter.event;
        this.onHideEmitter = this._register(new Emitter());
        this.onHide = this.onHideEmitter.event;
        this.backButton = backButton;
        this.inQuickInputContext = InQuickInputContextKey.bindTo(contextKeyService);
        this.quickInputTypeContext = QuickInputTypeContextKey.bindTo(contextKeyService);
        this.endOfQuickInputBoxContext = EndOfQuickInputBoxContextKey.bindTo(contextKeyService);
        this.idPrefix = options.idPrefix;
        this._container = options.container;
        this.styles = options.styles;
        this._register(Event.runAndSubscribe(dom.onDidRegisterWindow, ({ window, disposables }) => this.registerKeyModsListeners(window, disposables), { window: mainWindow, disposables: this._store }));
        this._register(dom.onWillUnregisterWindow(window => {
            if (this.ui && dom.getWindow(this.ui.container) === window) {
                // The window this quick input is contained in is about to
                // close, so we have to make sure to reparent it back to an
                // existing parent to not loose functionality.
                // (https://github.com/microsoft/vscode/issues/195870)
                this.reparentUI(this.layoutService.mainContainer);
                this.layout(this.layoutService.mainContainerDimension, this.layoutService.mainContainerOffset.quickPickTop);
            }
        }));
        this.viewState = this.loadViewState();
    }
    registerKeyModsListeners(window, disposables) {
        const listener = (e) => {
            this.keyMods.ctrlCmd = e.ctrlKey || e.metaKey;
            this.keyMods.alt = e.altKey;
        };
        for (const event of [dom.EventType.KEY_DOWN, dom.EventType.KEY_UP, dom.EventType.MOUSE_DOWN]) {
            disposables.add(dom.addDisposableListener(window, event, listener, true));
        }
    }
    getUI(showInActiveContainer) {
        if (this.ui) {
            // In order to support aux windows, re-parent the controller
            // if the original event is from a different document
            if (showInActiveContainer) {
                if (dom.getWindow(this._container) !== dom.getWindow(this.layoutService.activeContainer)) {
                    this.reparentUI(this.layoutService.activeContainer);
                    this.layout(this.layoutService.activeContainerDimension, this.layoutService.activeContainerOffset.quickPickTop);
                }
            }
            return this.ui;
        }
        const container = dom.append(this._container, $('.quick-input-widget.show-file-icons'));
        container.tabIndex = -1;
        container.style.display = 'none';
        const styleSheet = domStylesheetsJs.createStyleSheet(container);
        const titleBar = dom.append(container, $('.quick-input-titlebar'));
        const leftActionBar = this._register(new ActionBar(titleBar, { hoverDelegate: this.options.hoverDelegate }));
        leftActionBar.domNode.classList.add('quick-input-left-action-bar');
        const title = dom.append(titleBar, $('.quick-input-title'));
        const rightActionBar = this._register(new ActionBar(titleBar, { hoverDelegate: this.options.hoverDelegate }));
        rightActionBar.domNode.classList.add('quick-input-right-action-bar');
        const headerContainer = dom.append(container, $('.quick-input-header'));
        const checkAll = this._register(new TriStateCheckbox(localize('quickInput.checkAll', "Toggle all checkboxes"), false, { ...defaultCheckboxStyles, size: 15 }));
        dom.append(headerContainer, checkAll.domNode);
        this._register(checkAll.onChange(() => {
            const checked = checkAll.checked;
            list.setAllVisibleChecked(checked === true);
        }));
        this._register(dom.addDisposableListener(checkAll.domNode, dom.EventType.CLICK, e => {
            if (e.x || e.y) { // Avoid 'click' triggered by 'space'...
                inputBox.setFocus();
            }
        }));
        const description2 = dom.append(headerContainer, $('.quick-input-description'));
        const inputContainer = dom.append(headerContainer, $('.quick-input-and-message'));
        const filterContainer = dom.append(inputContainer, $('.quick-input-filter'));
        const inputBox = this._register(new QuickInputBox(filterContainer, this.styles.inputBox, this.styles.toggle));
        inputBox.setAttribute('aria-describedby', `${this.idPrefix}message`);
        const visibleCountContainer = dom.append(filterContainer, $('.quick-input-visible-count'));
        visibleCountContainer.setAttribute('aria-live', 'polite');
        visibleCountContainer.setAttribute('aria-atomic', 'true');
        const visibleCount = this._register(new CountBadge(visibleCountContainer, { countFormat: localize({ key: 'quickInput.visibleCount', comment: ['This tells the user how many items are shown in a list of items to select from. The items can be anything. Currently not visible, but read by screen readers.'] }, "{0} Results") }, this.styles.countBadge));
        const countContainer = dom.append(filterContainer, $('.quick-input-count'));
        countContainer.setAttribute('aria-live', 'polite');
        const count = this._register(new CountBadge(countContainer, { countFormat: localize({ key: 'quickInput.countSelected', comment: ['This tells the user how many items are selected in a list of items to select from. The items can be anything.'] }, "{0} Selected") }, this.styles.countBadge));
        const inlineActionBar = this._register(new ActionBar(headerContainer, { hoverDelegate: this.options.hoverDelegate }));
        inlineActionBar.domNode.classList.add('quick-input-inline-action-bar');
        const okContainer = dom.append(headerContainer, $('.quick-input-action'));
        const ok = this._register(new Button(okContainer, this.styles.button));
        ok.label = localize('ok', "OK");
        this._register(ok.onDidClick(e => {
            this.onDidAcceptEmitter.fire();
        }));
        const customButtonContainer = dom.append(headerContainer, $('.quick-input-action'));
        const customButton = this._register(new Button(customButtonContainer, { ...this.styles.button, supportIcons: true }));
        customButton.label = localize('custom', "Custom");
        this._register(customButton.onDidClick(e => {
            this.onDidCustomEmitter.fire();
        }));
        const message = dom.append(inputContainer, $(`#${this.idPrefix}message.quick-input-message`));
        const progressBar = this._register(new ProgressBar(container, this.styles.progressBar));
        progressBar.getContainer().classList.add('quick-input-progress');
        const widget = dom.append(container, $('.quick-input-html-widget'));
        widget.tabIndex = -1;
        const description1 = dom.append(container, $('.quick-input-description'));
        // List
        const listId = this.idPrefix + 'list';
        const list = this._register(this.instantiationService.createInstance(QuickInputList, container, this.options.hoverDelegate, this.options.linkOpenerDelegate, listId));
        inputBox.setAttribute('aria-controls', listId);
        this._register(list.onDidChangeFocus(() => {
            if (inputBox.hasFocus()) {
                const activeDescendant = list.getActiveDescendant();
                if (activeDescendant) {
                    inputBox.setAttribute('aria-activedescendant', activeDescendant);
                }
                else {
                    inputBox.removeAttribute('aria-activedescendant');
                }
            }
        }));
        this._register(list.onChangedAllVisibleChecked(checked => {
            // TODO: Support tri-state checkbox when we remove the .indent property that is faking tree structure.
            checkAll.checked = checked;
        }));
        this._register(list.onChangedVisibleCount(c => {
            visibleCount.setCount(c);
        }));
        this._register(list.onChangedCheckedCount(c => {
            // TODO@TylerLeonhardt: Without this setTimeout, the screen reader will not read out
            // the final count of checked items correctly. Investigate a better way
            // to do this. ref https://github.com/microsoft/vscode/issues/258617
            setTimeout0(() => count.setCount(c));
        }));
        this._register(list.onLeave(() => {
            // Defer to avoid the input field reacting to the triggering key.
            // TODO@TylerLeonhardt https://github.com/microsoft/vscode/issues/203675
            setTimeout(() => {
                if (!this.controller) {
                    return;
                }
                inputBox.setFocus();
                if (this.controller instanceof QuickPick && this.controller.canSelectMany) {
                    list.clearFocus();
                }
            }, 0);
        }));
        // Tree
        const tree = this._register(this.instantiationService.createInstance(QuickInputTreeController, container, this.options.hoverDelegate));
        this._register(tree.tree.onDidChangeFocus(() => {
            if (inputBox.hasFocus()) {
                const activeDescendant = tree.getActiveDescendant();
                if (activeDescendant) {
                    inputBox.setAttribute('aria-activedescendant', activeDescendant);
                }
                else {
                    inputBox.removeAttribute('aria-activedescendant');
                }
            }
        }));
        this._register(tree.onLeave(() => {
            // Defer to avoid the input field reacting to the triggering key.
            // TODO@TylerLeonhardt https://github.com/microsoft/vscode/issues/203675
            setTimeout(() => {
                if (!this.controller) {
                    return;
                }
                inputBox.setFocus();
                tree.tree.setFocus([]);
            }, 0);
        }));
        // Wire up tree's accept event to the UI's accept emitter for non-pickable items
        this._register(tree.onDidAccept(() => {
            this.onDidAcceptEmitter.fire();
        }));
        this._register(tree.tree.onDidChangeContentHeight(() => this.updateLayout()));
        const focusTracker = dom.trackFocus(container);
        this._register(focusTracker);
        this._register(dom.addDisposableListener(container, dom.EventType.FOCUS, e => {
            const ui = this.getUI();
            if (dom.isAncestor(e.relatedTarget, ui.inputContainer)) {
                const value = ui.inputBox.isSelectionAtEnd();
                if (this.endOfQuickInputBoxContext.get() !== value) {
                    this.endOfQuickInputBoxContext.set(value);
                }
            }
            // Ignore focus events within container
            if (dom.isAncestor(e.relatedTarget, ui.container)) {
                return;
            }
            this.inQuickInputContext.set(true);
            this.previousFocusElement = dom.isHTMLElement(e.relatedTarget) ? e.relatedTarget : undefined;
        }, true));
        this._register(focusTracker.onDidBlur(() => {
            if (!this.getUI().ignoreFocusOut && !this.options.ignoreFocusOut()) {
                this.hide(QuickInputHideReason.Blur);
            }
            this.inQuickInputContext.set(false);
            this.endOfQuickInputBoxContext.set(false);
            this.previousFocusElement = undefined;
        }));
        this._register(inputBox.onKeyDown(e => {
            const value = this.getUI().inputBox.isSelectionAtEnd();
            if (this.endOfQuickInputBoxContext.get() !== value) {
                this.endOfQuickInputBoxContext.set(value);
            }
            // Allow screen readers to read what's in the input
            // Note: this works for arrow keys and selection changes,
            // but not for deletions since that often triggers a
            // change in the list.
            // Don't remove aria-activedescendant when only modifier keys are pressed
            // to prevent screen reader re-announcements when users press Ctrl to silence speech.
            // See: https://github.com/microsoft/vscode/issues/271032
            if (!isModifierKey(e.keyCode)) {
                inputBox.removeAttribute('aria-activedescendant');
            }
        }));
        this._register(dom.addDisposableListener(container, dom.EventType.FOCUS, (e) => {
            inputBox.setFocus();
        }));
        // Drag and Drop support
        this.dndController = this._register(this.instantiationService.createInstance(QuickInputDragAndDropController, this._container, container, [
            {
                node: titleBar,
                includeChildren: true,
                excludeNodes: [leftActionBar.domNode, rightActionBar.domNode]
            },
            {
                node: headerContainer,
                includeChildren: false
            }
        ], this.viewState));
        // DnD update layout
        this._register(autorun(reader => {
            const dndViewState = this.dndController?.dndViewState.read(reader);
            if (!dndViewState) {
                return;
            }
            if (dndViewState.top !== undefined && dndViewState.left !== undefined) {
                this.viewState = {
                    ...this.viewState,
                    top: dndViewState.top,
                    left: dndViewState.left
                };
            }
            else {
                // Reset position/size
                this.viewState = undefined;
            }
            this.updateLayout();
            // Save position
            if (dndViewState.done) {
                this.saveViewState(this.viewState);
            }
        }));
        this.ui = {
            container,
            styleSheet,
            leftActionBar,
            titleBar,
            title,
            description1,
            description2,
            widget,
            rightActionBar,
            inlineActionBar,
            checkAll,
            inputContainer,
            filterContainer,
            inputBox,
            visibleCountContainer,
            visibleCount,
            countContainer,
            count,
            okContainer,
            ok,
            message,
            customButtonContainer,
            customButton,
            list,
            tree,
            progressBar,
            onDidAccept: this.onDidAcceptEmitter.event,
            onDidCustom: this.onDidCustomEmitter.event,
            onDidTriggerButton: this.onDidTriggerButtonEmitter.event,
            ignoreFocusOut: false,
            keyMods: this.keyMods,
            show: controller => this.show(controller),
            hide: () => this.hide(),
            setVisibilities: visibilities => this.setVisibilities(visibilities),
            setEnabled: enabled => this.setEnabled(enabled),
            setContextKey: contextKey => this.options.setContextKey(contextKey),
            linkOpenerDelegate: content => this.options.linkOpenerDelegate(content)
        };
        this.updateStyles();
        return this.ui;
    }
    reparentUI(container) {
        if (this.ui) {
            this._container = container;
            dom.append(this._container, this.ui.container);
            this.dndController?.reparentUI(this._container);
        }
    }
    pick(picks, options = {}, token = CancellationToken.None) {
        return new Promise((doResolve, reject) => {
            let resolve = (result) => {
                resolve = doResolve;
                options.onKeyMods?.(input.keyMods);
                doResolve(result);
            };
            if (token.isCancellationRequested) {
                resolve(undefined);
                return;
            }
            const input = this.createQuickPick({ useSeparators: true });
            let activeItem;
            const disposables = [
                input,
                input.onDidAccept(() => {
                    if (input.canSelectMany) {
                        resolve(input.selectedItems.slice());
                        input.hide();
                    }
                    else {
                        const result = input.activeItems[0];
                        if (result) {
                            resolve(result);
                            input.hide();
                        }
                    }
                }),
                input.onDidChangeActive(items => {
                    const focused = items[0];
                    if (focused && options.onDidFocus) {
                        options.onDidFocus(focused);
                    }
                }),
                input.onDidChangeSelection(items => {
                    if (!input.canSelectMany) {
                        const result = items[0];
                        if (result) {
                            resolve(result);
                            input.hide();
                        }
                    }
                }),
                input.onDidTriggerItemButton(event => options.onDidTriggerItemButton && options.onDidTriggerItemButton({
                    ...event,
                    removeItem: () => {
                        const index = input.items.indexOf(event.item);
                        if (index !== -1) {
                            const items = input.items.slice();
                            const removed = items.splice(index, 1);
                            const activeItems = input.activeItems.filter(activeItem => activeItem !== removed[0]);
                            const keepScrollPositionBefore = input.keepScrollPosition;
                            input.keepScrollPosition = true;
                            input.items = items;
                            if (activeItems) {
                                input.activeItems = activeItems;
                            }
                            input.keepScrollPosition = keepScrollPositionBefore;
                        }
                    }
                })),
                input.onDidTriggerSeparatorButton(event => options.onDidTriggerSeparatorButton?.(event)),
                input.onDidChangeValue(value => {
                    if (activeItem && !value && (input.activeItems.length !== 1 || input.activeItems[0] !== activeItem)) {
                        input.activeItems = [activeItem];
                    }
                }),
                token.onCancellationRequested(() => {
                    input.hide();
                }),
                input.onDidHide(() => {
                    dispose(disposables);
                    resolve(undefined);
                }),
            ];
            input.title = options.title;
            if (options.value) {
                input.value = options.value;
            }
            input.canSelectMany = !!options.canPickMany;
            input.placeholder = options.placeHolder;
            input.prompt = options.prompt;
            input.ignoreFocusOut = !!options.ignoreFocusLost;
            input.matchOnDescription = !!options.matchOnDescription;
            input.matchOnDetail = !!options.matchOnDetail;
            if (options.sortByLabel !== undefined) {
                input.sortByLabel = options.sortByLabel;
            }
            input.matchOnLabel = (options.matchOnLabel === undefined) || options.matchOnLabel; // default to true
            input.quickNavigate = options.quickNavigate;
            input.hideInput = !!options.hideInput;
            input.contextKey = options.contextKey;
            input.busy = true;
            Promise.all([picks, options.activeItem])
                .then(([items, _activeItem]) => {
                activeItem = _activeItem;
                input.busy = false;
                input.items = items;
                if (input.canSelectMany) {
                    input.selectedItems = items.filter(item => item.type !== 'separator' && item.picked);
                }
                if (activeItem) {
                    input.activeItems = [activeItem];
                }
            });
            input.show();
            Promise.resolve(picks).then(undefined, err => {
                reject(err);
                input.hide();
            });
        });
    }
    setValidationOnInput(input, validationResult) {
        if (validationResult && isString(validationResult)) {
            input.severity = Severity.Error;
            input.validationMessage = validationResult;
        }
        else if (validationResult && !isString(validationResult)) {
            input.severity = validationResult.severity;
            input.validationMessage = validationResult.content;
        }
        else {
            input.severity = Severity.Ignore;
            input.validationMessage = undefined;
        }
    }
    input(options = {}, token = CancellationToken.None) {
        return new Promise((resolve) => {
            if (token.isCancellationRequested) {
                resolve(undefined);
                return;
            }
            const input = this.createInputBox();
            const validateInput = options.validateInput || (() => Promise.resolve(undefined));
            const onDidValueChange = Event.debounce(input.onDidChangeValue, (last, cur) => cur, 100);
            let validationValue = options.value || '';
            let validation = Promise.resolve(validateInput(validationValue));
            const disposables = [
                input,
                onDidValueChange(value => {
                    if (value !== validationValue) {
                        validation = Promise.resolve(validateInput(value));
                        validationValue = value;
                    }
                    validation.then(result => {
                        if (value === validationValue) {
                            this.setValidationOnInput(input, result);
                        }
                    });
                }),
                input.onDidAccept(() => {
                    const value = input.value;
                    if (value !== validationValue) {
                        validation = Promise.resolve(validateInput(value));
                        validationValue = value;
                    }
                    validation.then(result => {
                        if (!result || (!isString(result) && result.severity !== Severity.Error)) {
                            resolve(value);
                            input.hide();
                        }
                        else if (value === validationValue) {
                            this.setValidationOnInput(input, result);
                        }
                    });
                }),
                token.onCancellationRequested(() => {
                    input.hide();
                }),
                input.onDidHide(() => {
                    dispose(disposables);
                    resolve(undefined);
                }),
            ];
            input.title = options.title;
            input.value = options.value || '';
            input.valueSelection = options.valueSelection;
            input.prompt = options.prompt;
            input.placeholder = options.placeHolder;
            input.password = !!options.password;
            input.ignoreFocusOut = !!options.ignoreFocusLost;
            input.show();
        });
    }
    createQuickPick(options = { useSeparators: false }) {
        const ui = this.getUI(true);
        return new QuickPick(ui);
    }
    createInputBox() {
        const ui = this.getUI(true);
        return new InputBox(ui);
    }
    setAlignment(alignment) {
        this.dndController?.setAlignment(alignment);
    }
    createQuickWidget() {
        const ui = this.getUI(true);
        return new QuickWidget(ui);
    }
    createQuickTree() {
        const ui = this.getUI(true);
        return new QuickTree(ui);
    }
    show(controller) {
        const ui = this.getUI(true);
        this.onShowEmitter.fire();
        const oldController = this.controller;
        this.controller = controller;
        oldController?.didHide();
        this.setEnabled(true);
        ui.leftActionBar.clear();
        ui.title.textContent = '';
        ui.description1.textContent = '';
        ui.description2.textContent = '';
        dom.reset(ui.widget);
        ui.rightActionBar.clear();
        ui.inlineActionBar.clear();
        ui.checkAll.checked = false;
        // ui.inputBox.value = ''; Avoid triggering an event.
        ui.inputBox.placeholder = '';
        ui.inputBox.password = false;
        ui.inputBox.showDecoration(Severity.Ignore);
        ui.visibleCount.setCount(0);
        ui.count.setCount(0);
        dom.reset(ui.message);
        ui.progressBar.stop();
        ui.progressBar.getContainer().setAttribute('aria-hidden', 'true');
        ui.list.setElements([]);
        ui.list.matchOnDescription = false;
        ui.list.matchOnDetail = false;
        ui.list.matchOnLabel = true;
        ui.list.sortByLabel = true;
        ui.tree.updateFilterOptions({
            matchOnDescription: false,
            matchOnLabel: true
        });
        ui.tree.sortByLabel = true;
        ui.ignoreFocusOut = false;
        ui.inputBox.toggles = undefined;
        const backKeybindingLabel = this.options.backKeybindingLabel();
        backButton.tooltip = backKeybindingLabel ? localize('quickInput.backWithKeybinding', "Back ({0})", backKeybindingLabel) : localize('quickInput.back', "Back");
        ui.container.style.display = '';
        this.updateLayout();
        this.dndController?.layoutContainer();
        ui.inputBox.setFocus();
        this.quickInputTypeContext.set(controller.type);
    }
    isVisible() {
        return !!this.ui && this.ui.container.style.display !== 'none';
    }
    setVisibilities(visibilities) {
        const ui = this.getUI();
        ui.title.style.display = visibilities.title ? '' : 'none';
        ui.description1.style.display = visibilities.description && (visibilities.inputBox || visibilities.checkAll) ? '' : 'none';
        ui.description2.style.display = visibilities.description && !(visibilities.inputBox || visibilities.checkAll) ? '' : 'none';
        ui.checkAll.domNode.style.display = visibilities.checkAll ? '' : 'none';
        ui.inputContainer.style.display = visibilities.inputBox ? '' : 'none';
        ui.filterContainer.style.display = visibilities.inputBox ? '' : 'none';
        ui.visibleCountContainer.style.display = visibilities.visibleCount ? '' : 'none';
        ui.countContainer.style.display = visibilities.count ? '' : 'none';
        ui.okContainer.style.display = visibilities.ok ? '' : 'none';
        ui.customButtonContainer.style.display = visibilities.customButton ? '' : 'none';
        ui.message.style.display = visibilities.message ? '' : 'none';
        ui.progressBar.getContainer().style.display = visibilities.progressBar ? '' : 'none';
        ui.list.displayed = !!visibilities.list;
        ui.tree.displayed = !!visibilities.tree;
        ui.container.classList.toggle('show-checkboxes', !!visibilities.checkBox);
        ui.container.classList.toggle('hidden-input', !visibilities.inputBox && !visibilities.description);
        this.updateLayout(); // TODO
    }
    setEnabled(enabled) {
        if (enabled !== this.enabled) {
            this.enabled = enabled;
            const ui = this.getUI();
            for (const item of ui.leftActionBar.viewItems) {
                item.action.enabled = enabled;
            }
            for (const item of ui.rightActionBar.viewItems) {
                item.action.enabled = enabled;
            }
            if (enabled) {
                ui.checkAll.enable();
            }
            else {
                ui.checkAll.disable();
            }
            ui.inputBox.enabled = enabled;
            ui.ok.enabled = enabled;
            ui.list.enabled = enabled;
        }
    }
    hide(reason) {
        const controller = this.controller;
        if (!controller) {
            return;
        }
        controller.willHide(reason);
        const container = this.ui?.container;
        const focusChanged = container && !dom.isAncestorOfActiveElement(container);
        this.controller = null;
        this.onHideEmitter.fire();
        if (container) {
            container.style.display = 'none';
        }
        if (!focusChanged) {
            let currentElement = this.previousFocusElement;
            while (currentElement && !currentElement.offsetParent) {
                currentElement = currentElement.parentElement ?? undefined;
            }
            if (currentElement?.offsetParent) {
                currentElement.focus();
                this.previousFocusElement = undefined;
            }
            else {
                this.options.returnFocus();
            }
        }
        controller.didHide(reason);
    }
    focus() {
        if (this.isVisible()) {
            const ui = this.getUI();
            if (ui.inputBox.enabled) {
                ui.inputBox.setFocus();
            }
            else {
                ui.list.domFocus();
            }
        }
    }
    toggle() {
        if (this.isVisible() && this.controller instanceof QuickPick && this.controller.canSelectMany) {
            this.getUI().list.toggleCheckbox();
        }
    }
    toggleHover() {
        if (this.isVisible() && this.controller instanceof QuickPick) {
            this.getUI().list.toggleHover();
        }
    }
    navigate(next, quickNavigate) {
        if (this.isVisible() && this.getUI().list.displayed) {
            this.getUI().list.focus(next ? QuickPickFocus.Next : QuickPickFocus.Previous);
            if (quickNavigate && this.controller instanceof QuickPick) {
                this.controller.quickNavigate = quickNavigate;
            }
        }
    }
    async accept(keyMods = { alt: false, ctrlCmd: false }) {
        // When accepting the item programmatically, it is important that
        // we update `keyMods` either from the provided set or unset it
        // because the accept did not happen from mouse or keyboard
        // interaction on the list itself
        this.keyMods.alt = keyMods.alt;
        this.keyMods.ctrlCmd = keyMods.ctrlCmd;
        this.onDidAcceptEmitter.fire();
    }
    async back() {
        this.onDidTriggerButtonEmitter.fire(this.backButton);
    }
    async cancel(reason) {
        this.hide(reason);
    }
    layout(dimension, titleBarOffset) {
        this.dimension = dimension;
        this.titleBarOffset = titleBarOffset;
        this.updateLayout();
    }
    updateLayout() {
        if (this.ui && this.isVisible()) {
            const style = this.ui.container.style;
            const width = Math.min(this.dimension.width * 0.62 /* golden cut */, QuickInputController_1.MAX_WIDTH);
            style.width = width + 'px';
            // Position
            style.top = `${this.viewState?.top ? Math.round(this.dimension.height * this.viewState.top) : this.titleBarOffset}px`;
            style.left = `${Math.round((this.dimension.width * (this.viewState?.left ?? 0.5 /* center */)) - (width / 2))}px`;
            this.ui.inputBox.layout();
            this.ui.list.layout(this.dimension && this.dimension.height * 0.4);
            this.ui.tree.layout(this.dimension && this.dimension.height * 0.4);
        }
    }
    applyStyles(styles) {
        this.styles = styles;
        this.updateStyles();
    }
    updateStyles() {
        if (this.ui) {
            const { quickInputTitleBackground, quickInputBackground, quickInputForeground, widgetBorder, widgetShadow, } = this.styles.widget;
            this.ui.titleBar.style.backgroundColor = quickInputTitleBackground ?? '';
            this.ui.container.style.backgroundColor = quickInputBackground ?? '';
            this.ui.container.style.color = quickInputForeground ?? '';
            this.ui.container.style.border = widgetBorder ? `1px solid ${widgetBorder}` : '';
            this.ui.container.style.boxShadow = widgetShadow ? `0 0 8px 2px ${widgetShadow}` : '';
            this.ui.list.style(this.styles.list);
            this.ui.tree.tree.style(this.styles.list);
            const content = [];
            if (this.styles.pickerGroup.pickerGroupBorder) {
                content.push(`.quick-input-list .quick-input-list-entry { border-top-color:  ${this.styles.pickerGroup.pickerGroupBorder}; }`);
            }
            if (this.styles.pickerGroup.pickerGroupForeground) {
                content.push(`.quick-input-list .quick-input-list-separator { color:  ${this.styles.pickerGroup.pickerGroupForeground}; }`);
            }
            if (this.styles.pickerGroup.pickerGroupForeground) {
                content.push(`.quick-input-list .quick-input-list-separator-as-item { color: var(--vscode-descriptionForeground); }`);
            }
            if (this.styles.keybindingLabel.keybindingLabelBackground ||
                this.styles.keybindingLabel.keybindingLabelBorder ||
                this.styles.keybindingLabel.keybindingLabelBottomBorder ||
                this.styles.keybindingLabel.keybindingLabelShadow ||
                this.styles.keybindingLabel.keybindingLabelForeground) {
                content.push('.quick-input-list .monaco-keybinding > .monaco-keybinding-key {');
                if (this.styles.keybindingLabel.keybindingLabelBackground) {
                    content.push(`background-color: ${this.styles.keybindingLabel.keybindingLabelBackground};`);
                }
                if (this.styles.keybindingLabel.keybindingLabelBorder) {
                    // Order matters here. `border-color` must come before `border-bottom-color`.
                    content.push(`border-color: ${this.styles.keybindingLabel.keybindingLabelBorder};`);
                }
                if (this.styles.keybindingLabel.keybindingLabelBottomBorder) {
                    content.push(`border-bottom-color: ${this.styles.keybindingLabel.keybindingLabelBottomBorder};`);
                }
                if (this.styles.keybindingLabel.keybindingLabelShadow) {
                    content.push(`box-shadow: inset 0 -1px 0 ${this.styles.keybindingLabel.keybindingLabelShadow};`);
                }
                if (this.styles.keybindingLabel.keybindingLabelForeground) {
                    content.push(`color: ${this.styles.keybindingLabel.keybindingLabelForeground};`);
                }
                content.push('}');
            }
            const newStyles = content.join('\n');
            if (newStyles !== this.ui.styleSheet.textContent) {
                this.ui.styleSheet.textContent = newStyles;
            }
        }
    }
    loadViewState() {
        try {
            const data = JSON.parse(this.storageService.get(VIEWSTATE_STORAGE_KEY, -1 /* StorageScope.APPLICATION */, '{}'));
            if (data.top !== undefined || data.left !== undefined) {
                return data;
            }
        }
        catch { }
        return undefined;
    }
    saveViewState(viewState) {
        const isMainWindow = this.layoutService.activeContainer === this.layoutService.mainContainer;
        if (!isMainWindow) {
            return;
        }
        if (viewState !== undefined) {
            this.storageService.store(VIEWSTATE_STORAGE_KEY, JSON.stringify(viewState), -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
        }
        else {
            this.storageService.remove(VIEWSTATE_STORAGE_KEY, -1 /* StorageScope.APPLICATION */);
        }
    }
};
QuickInputController = QuickInputController_1 = __decorate([
    __param(1, ILayoutService),
    __param(2, IInstantiationService),
    __param(3, IContextKeyService),
    __param(4, IStorageService)
], QuickInputController);
export { QuickInputController };
let QuickInputDragAndDropController = class QuickInputDragAndDropController extends Disposable {
    constructor(_container, _quickInputContainer, _quickInputDragAreas, initialViewState, _layoutService, contextKeyService, configurationService) {
        super();
        this._container = _container;
        this._quickInputContainer = _quickInputContainer;
        this._quickInputDragAreas = _quickInputDragAreas;
        this._layoutService = _layoutService;
        this.configurationService = configurationService;
        this.dndViewState = observableValue(this, undefined);
        this._snapThreshold = 20;
        this._snapLineHorizontalRatio = 0.25;
        this._quickInputAlignmentContext = QuickInputAlignmentContextKey.bindTo(contextKeyService);
        const customWindowControls = getWindowControlsStyle(this.configurationService) === "custom" /* WindowControlsStyle.CUSTOM */;
        // Do not allow the widget to overflow or underflow window controls.
        // Use CSS calculations to avoid having to force layout with `.clientWidth`
        this._controlsOnLeft = customWindowControls && platform === 1 /* Platform.Mac */;
        this._controlsOnRight = customWindowControls && (platform === 3 /* Platform.Windows */ || platform === 2 /* Platform.Linux */);
        this._registerLayoutListener();
        this.registerMouseListeners();
        this.dndViewState.set({ ...initialViewState, done: true }, undefined);
    }
    reparentUI(container) {
        this._container = container;
    }
    layoutContainer(dimension = this._layoutService.activeContainerDimension) {
        const state = this.dndViewState.get();
        const dragAreaRect = this._quickInputContainer.getBoundingClientRect();
        if (state?.top && state?.left) {
            const a = Math.round(state.left * 1e2) / 1e2;
            const b = dimension.width;
            const c = dragAreaRect.width;
            const d = a * b - c / 2;
            this._layout(state.top * dimension.height, d);
        }
    }
    setAlignment(alignment, done = true) {
        if (alignment === 'top') {
            this.dndViewState.set({
                top: this._getTopSnapValue() / this._container.clientHeight,
                left: (this._getCenterXSnapValue() + (this._quickInputContainer.clientWidth / 2)) / this._container.clientWidth,
                done
            }, undefined);
            this._quickInputAlignmentContext.set('top');
        }
        else if (alignment === 'center') {
            this.dndViewState.set({
                top: this._getCenterYSnapValue() / this._container.clientHeight,
                left: (this._getCenterXSnapValue() + (this._quickInputContainer.clientWidth / 2)) / this._container.clientWidth,
                done
            }, undefined);
            this._quickInputAlignmentContext.set('center');
        }
        else {
            this.dndViewState.set({ top: alignment.top, left: alignment.left, done }, undefined);
            this._quickInputAlignmentContext.set(undefined);
        }
    }
    _registerLayoutListener() {
        this._register(Event.filter(this._layoutService.onDidLayoutContainer, e => e.container === this._container)((e) => this.layoutContainer(e.dimension)));
    }
    registerMouseListeners() {
        const dragArea = this._quickInputContainer;
        // Double click
        this._register(dom.addDisposableGenericMouseUpListener(dragArea, (event) => {
            const originEvent = new StandardMouseEvent(dom.getWindow(dragArea), event);
            if (originEvent.detail !== 2) {
                return;
            }
            // Ignore event if the target is not the drag area
            const area = this._quickInputDragAreas.find(({ node, includeChildren }) => includeChildren ? dom.isAncestor(originEvent.target, node) : originEvent.target === node);
            if (!area || area.excludeNodes?.some(node => dom.isAncestor(originEvent.target, node))) {
                return;
            }
            this.dndViewState.set({ top: undefined, left: undefined, done: true }, undefined);
        }));
        // Mouse down
        this._register(dom.addDisposableGenericMouseDownListener(dragArea, (e) => {
            const activeWindow = dom.getWindow(this._layoutService.activeContainer);
            const originEvent = new StandardMouseEvent(activeWindow, e);
            // Ignore event if the target is not the drag area
            const area = this._quickInputDragAreas.find(({ node, includeChildren }) => includeChildren ? dom.isAncestor(originEvent.target, node) : originEvent.target === node);
            if (!area || area.excludeNodes?.some(node => dom.isAncestor(originEvent.target, node))) {
                return;
            }
            // Mouse position offset relative to dragArea
            const dragAreaRect = this._quickInputContainer.getBoundingClientRect();
            const dragOffsetX = originEvent.browserEvent.clientX - dragAreaRect.left;
            const dragOffsetY = originEvent.browserEvent.clientY - dragAreaRect.top;
            let isMovingQuickInput = false;
            const mouseMoveListener = dom.addDisposableGenericMouseMoveListener(activeWindow, (e) => {
                const mouseMoveEvent = new StandardMouseEvent(activeWindow, e);
                mouseMoveEvent.preventDefault();
                if (!isMovingQuickInput) {
                    isMovingQuickInput = true;
                }
                this._layout(e.clientY - dragOffsetY, e.clientX - dragOffsetX);
            });
            const mouseUpListener = dom.addDisposableGenericMouseUpListener(activeWindow, (e) => {
                if (isMovingQuickInput) {
                    // Save position
                    const state = this.dndViewState.get();
                    this.dndViewState.set({ top: state?.top, left: state?.left, done: true }, undefined);
                }
                // Dispose listeners
                mouseMoveListener.dispose();
                mouseUpListener.dispose();
            });
        }));
    }
    _layout(topCoordinate, leftCoordinate) {
        const snapCoordinateYTop = this._getTopSnapValue();
        const snapCoordinateY = this._getCenterYSnapValue();
        const snapCoordinateX = this._getCenterXSnapValue();
        // Make sure the quick input is not moved outside the container
        topCoordinate = Math.max(0, Math.min(topCoordinate, this._container.clientHeight - this._quickInputContainer.clientHeight));
        if (topCoordinate < this._layoutService.activeContainerOffset.top) {
            if (this._controlsOnLeft) {
                leftCoordinate = Math.max(leftCoordinate, 80 / getZoomFactor(dom.getActiveWindow()));
            }
            else if (this._controlsOnRight) {
                leftCoordinate = Math.min(leftCoordinate, this._container.clientWidth - this._quickInputContainer.clientWidth - (140 / getZoomFactor(dom.getActiveWindow())));
            }
        }
        const snappingToTop = Math.abs(topCoordinate - snapCoordinateYTop) < this._snapThreshold;
        topCoordinate = snappingToTop ? snapCoordinateYTop : topCoordinate;
        const snappingToCenter = Math.abs(topCoordinate - snapCoordinateY) < this._snapThreshold;
        topCoordinate = snappingToCenter ? snapCoordinateY : topCoordinate;
        const top = topCoordinate / this._container.clientHeight;
        // Make sure the quick input is not moved outside the container
        leftCoordinate = Math.max(0, Math.min(leftCoordinate, this._container.clientWidth - this._quickInputContainer.clientWidth));
        const snappingToCenterX = Math.abs(leftCoordinate - snapCoordinateX) < this._snapThreshold;
        leftCoordinate = snappingToCenterX ? snapCoordinateX : leftCoordinate;
        const b = this._container.clientWidth;
        const c = this._quickInputContainer.clientWidth;
        const d = leftCoordinate;
        const left = (d + c / 2) / b;
        this.dndViewState.set({ top, left, done: false }, undefined);
        if (snappingToCenterX) {
            if (snappingToTop) {
                this._quickInputAlignmentContext.set('top');
                return;
            }
            else if (snappingToCenter) {
                this._quickInputAlignmentContext.set('center');
                return;
            }
        }
        this._quickInputAlignmentContext.set(undefined);
    }
    _getTopSnapValue() {
        return this._layoutService.activeContainerOffset.quickPickTop;
    }
    _getCenterYSnapValue() {
        return Math.round(this._container.clientHeight * this._snapLineHorizontalRatio);
    }
    _getCenterXSnapValue() {
        return Math.round(this._container.clientWidth / 2) - Math.round(this._quickInputContainer.clientWidth / 2);
    }
};
QuickInputDragAndDropController = __decorate([
    __param(4, ILayoutService),
    __param(5, IContextKeyService),
    __param(6, IConfigurationService)
], QuickInputDragAndDropController);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVpY2tJbnB1dENvbnRyb2xsZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vcXVpY2tpbnB1dC9icm93c2VyL3F1aWNrSW5wdXRDb250cm9sbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLDhCQUE4QixDQUFDO0FBQ3BELE9BQU8sS0FBSyxnQkFBZ0IsTUFBTSx5Q0FBeUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0saURBQWlELENBQUM7QUFFNUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUMvRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDbEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDekUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFtQixPQUFPLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN6RixPQUFPLFFBQVEsTUFBTSxrQ0FBa0MsQ0FBQztBQUN4RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDekQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMzQyxPQUFPLEVBQTJKLG9CQUFvQixFQUFrQixjQUFjLEVBQThDLE1BQU0seUJBQXlCLENBQUM7QUFDcFMsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ25ELE9BQU8sRUFBa0UsU0FBUyxFQUFF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