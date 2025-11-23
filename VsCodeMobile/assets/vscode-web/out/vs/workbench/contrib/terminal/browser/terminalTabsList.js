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
import { IListService, WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { ITerminalConfigurationService, ITerminalGroupService, ITerminalService, ITerminalEditingService } from './terminal.js';
import { localize } from '../../../../nls.js';
import * as DOM from '../../../../base/browser/dom.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { MenuItemAction } from '../../../../platform/actions/common/actions.js';
import { MenuEntryActionViewItem } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Action } from '../../../../base/common/actions.js';
import { DEFAULT_LABELS_CONTAINER, ResourceLabels } from '../../../browser/labels.js';
import { IDecorationsService } from '../../../services/decorations/common/decorations.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import Severity from '../../../../base/common/severity.js';
import { Disposable, DisposableStore, dispose, toDisposable } from '../../../../base/common/lifecycle.js';
import { DataTransfers } from '../../../../base/browser/dnd.js';
import { disposableTimeout } from '../../../../base/common/async.js';
import { ElementsDragAndDropData, NativeDragAndDropData } from '../../../../base/browser/ui/list/listView.js';
import { URI } from '../../../../base/common/uri.js';
import { getColorClass, getIconId, getUriClasses } from './terminalIcon.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { InputBox } from '../../../../base/browser/ui/inputbox/inputBox.js';
import { createSingleCallFunction } from '../../../../base/common/functional.js';
import { CodeDataTransfers, containsDragType, getPathForFile } from '../../../../platform/dnd/browser/dnd.js';
import { terminalStrings } from '../common/terminalStrings.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { TerminalContextKeys } from '../common/terminalContextKey.js';
import { getTerminalResourcesFromDragEvent, parseTerminalUri } from './terminalUri.js';
import { getInstanceHoverInfo } from './terminalTooltip.js';
import { defaultInputBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { Emitter } from '../../../../base/common/event.js';
import { Schemas } from '../../../../base/common/network.js';
import { getColorForSeverity } from './terminalStatusList.js';
import { TerminalContextActionRunner } from './terminalContextMenu.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { isObject } from '../../../../base/common/types.js';
const $ = DOM.$;
export var TerminalTabsListSizes;
(function (TerminalTabsListSizes) {
    TerminalTabsListSizes[TerminalTabsListSizes["TabHeight"] = 22] = "TabHeight";
    TerminalTabsListSizes[TerminalTabsListSizes["NarrowViewWidth"] = 46] = "NarrowViewWidth";
    TerminalTabsListSizes[TerminalTabsListSizes["WideViewMinimumWidth"] = 80] = "WideViewMinimumWidth";
    TerminalTabsListSizes[TerminalTabsListSizes["DefaultWidth"] = 120] = "DefaultWidth";
    TerminalTabsListSizes[TerminalTabsListSizes["MidpointViewWidth"] = 63] = "MidpointViewWidth";
    TerminalTabsListSizes[TerminalTabsListSizes["ActionbarMinimumWidth"] = 105] = "ActionbarMinimumWidth";
    TerminalTabsListSizes[TerminalTabsListSizes["MaximumWidth"] = 500] = "MaximumWidth";
})(TerminalTabsListSizes || (TerminalTabsListSizes = {}));
let TerminalTabList = class TerminalTabList extends WorkbenchList {
    constructor(container, contextKeyService, listService, _configurationService, _terminalService, _terminalGroupService, _terminalEditingService, instantiationService, decorationsService, _themeService, _storageService, lifecycleService, _hoverService) {
        super('TerminalTabsList', container, {
            getHeight: () => 22 /* TerminalTabsListSizes.TabHeight */,
            getTemplateId: () => 'terminal.tabs'
        }, [instantiationService.createInstance(TerminalTabsRenderer, container, instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER), () => this.getSelectedElements())], {
            horizontalScrolling: false,
            supportDynamicHeights: false,
            selectionNavigation: true,
            identityProvider: {
                getId: e => e?.instanceId
            },
            accessibilityProvider: instantiationService.createInstance(TerminalTabsAccessibilityProvider),
            smoothScrolling: _configurationService.getValue('workbench.list.smoothScrolling'),
            multipleSelectionSupport: true,
            paddingBottom: 22 /* TerminalTabsListSizes.TabHeight */,
            dnd: instantiationService.createInstance(TerminalTabsDragAndDrop),
            openOnSingleClick: true
        }, contextKeyService, listService, _configurationService, instantiationService);
        this._configurationService = _configurationService;
        this._terminalService = _terminalService;
        this._terminalGroupService = _terminalGroupService;
        this._terminalEditingService = _terminalEditingService;
        this._themeService = _themeService;
        this._storageService = _storageService;
        this._hoverService = _hoverService;
        const instanceDisposables = [
            this._terminalGroupService.onDidChangeInstances(() => this.refresh()),
            this._terminalGroupService.onDidChangeGroups(() => this.refresh()),
            this._terminalGroupService.onDidShow(() => this.refresh()),
            this._terminalGroupService.onDidChangeInstanceCapability(() => this.refresh()),
            this._terminalService.onAnyInstanceTitleChange(() => this.refresh()),
            this._terminalService.onAnyInstanceIconChange(() => this.refresh()),
            this._terminalService.onAnyInstancePrimaryStatusChange(() => this.refresh()),
            this._terminalService.onDidChangeConnectionState(() => this.refresh()),
            this._themeService.onDidColorThemeChange(() => this.refresh()),
            this._terminalGroupService.onDidChangeActiveInstance(e => {
                if (e) {
                    const i = this._terminalGroupService.instances.indexOf(e);
                    this.setSelection([i]);
                    this.reveal(i);
                }
                this.refresh();
            }),
            this._storageService.onDidChangeValue(-1 /* StorageScope.APPLICATION */, "terminal.integrated.tabs.showDetailed" /* TerminalStorageKeys.TabsShowDetailed */, this.disposables)(() => this.refresh()),
        ];
        // Dispose of instance listeners on shutdown to avoid extra work and so tabs don't disappear
        // briefly
        this.disposables.add(lifecycleService.onWillShutdown(e => {
            dispose(instanceDisposables);
            instanceDisposables.length = 0;
        }));
        this.disposables.add(toDisposable(() => {
            dispose(instanceDisposables);
            instanceDisposables.length = 0;
        }));
        this.disposables.add(this.onMouseDblClick(async (e) => {
            const focus = this.getFocus();
            if (focus.length === 0) {
                const instance = await this._terminalService.createTerminal({ location: TerminalLocation.Panel });
                this._terminalGroupService.setActiveInstance(instance);
                await instance.focusWhenReady();
            }
            if (this._terminalEditingService.getEditingTerminal()?.instanceId === e.element?.instanceId) {
                return;
            }
            if (this._getFocusMode() === 'doubleClick' && this.getFocus().length === 1) {
                e.element?.focus(true);
            }
        }));
        // on left click, if focus mode = single click, focus the element
        // unless multi-selection is in progress
        this.disposables.add(this.onMouseClick(async (e) => {
            if (this._terminalEditingService.getEditingTerminal()?.instanceId === e.element?.instanceId) {
                return;
            }
            if (e.browserEvent.altKey && e.element) {
                await this._terminalService.createTerminal({ location: { parentTerminal: e.element } });
            }
            else if (this._getFocusMode() === 'singleClick') {
                if (this.getSelection().length <= 1) {
                    e.element?.focus(true);
                }
            }
        }));
        // on right click, set the focus to that element
        // unless multi-selection is in progress
        this.disposables.add(this.onContextMenu(e => {
            if (!e.element) {
                this.setSelection([]);
                return;
            }
            const selection = this.getSelectedElements();
            if (!selection || !selection.find(s => e.element === s)) {
                this.setFocus(e.index !== undefined ? [e.index] : []);
            }
        }));
        this._terminalTabsSingleSelectedContextKey = TerminalContextKeys.tabsSingularSelection.bindTo(contextKeyService);
        this._isSplitContextKey = TerminalContextKeys.splitTerminalTabFocused.bindTo(contextKeyService);
        this.disposables.add(this.onDidChangeSelection(e => this._updateContextKey()));
        this.disposables.add(this.onDidChangeFocus(() => this._updateContextKey()));
        this.disposables.add(this.onDidOpen(async (e) => {
            const instance = e.element;
            if (!instance) {
                return;
            }
            this._terminalGroupService.setActiveInstance(instance);
            if (!e.editorOptions.preserveFocus) {
                await instance.focusWhenReady();
            }
        }));
        if (!this._decorationsProvider) {
            this._decorationsProvider = this.disposables.add(instantiationService.createInstance(TabDecorationsProvider));
            this.disposables.add(decorationsService.registerDecorationsProvider(this._decorationsProvider));
        }
        this.refresh();
    }
    _getFocusMode() {
        return this._configurationService.getValue("terminal.integrated.tabs.focusMode" /* TerminalSettingId.TabsFocusMode */);
    }
    refresh(cancelEditing = true) {
        if (cancelEditing && this._terminalEditingService.isEditable(undefined)) {
            this.domFocus();
        }
        this.splice(0, this.length, this._terminalGroupService.instances.slice());
    }
    focusHover() {
        const instance = this.getSelectedElements()[0];
        if (!instance) {
            return;
        }
        this._hoverService.showInstantHover({
            ...getInstanceHoverInfo(instance, this._storageService),
            target: this.getHTMLElement(),
            trapFocus: true
        }, true);
    }
    _updateContextKey() {
        this._terminalTabsSingleSelectedContextKey.set(this.getSelectedElements().length === 1);
        const instance = this.getFocusedElements();
        this._isSplitContextKey.set(instance.length > 0 && this._terminalGroupService.instanceIsSplit(instance[0]));
    }
};
TerminalTabList = __decorate([
    __param(1, IContextKeyService),
    __param(2, IListService),
    __param(3, IConfigurationService),
    __param(4, ITerminalService),
    __param(5, ITerminalGroupService),
    __param(6, ITerminalEditingService),
    __param(7, IInstantiationService),
    __param(8, IDecorationsService),
    __param(9, IThemeService),
    __param(10, IStorageService),
    __param(11, ILifecycleService),
    __param(12, IHoverService)
], TerminalTabList);
export { TerminalTabList };
let TerminalTabsRenderer = class TerminalTabsRenderer {
    constructor(_container, _labels, _getSelection, _instantiationService, _terminalConfigurationService, _terminalService, _terminalGroupService, _terminalEditingService, _hoverService, _keybindingService, _listService, _storageService, _themeService, _contextViewService, _commandService) {
        this._container = _container;
        this._labels = _labels;
        this._getSelection = _getSelection;
        this._instantiationService = _instantiationService;
        this._terminalConfigurationService = _terminalConfigurationService;
        this._terminalService = _terminalService;
        this._terminalGroupService = _terminalGroupService;
        this._terminalEditingService = _terminalEditingService;
        this._hoverService = _hoverService;
        this._keybindingService = _keybindingService;
        this._listService = _listService;
        this._storageService = _storageService;
        this._themeService = _themeService;
        this._contextViewService = _contextViewService;
        this._commandService = _commandService;
        this.templateId = 'terminal.tabs';
        this._cachedContainerWidth = -1;
    }
    renderTemplate(container) {
        const element = DOM.append(container, $('.terminal-tabs-entry'));
        const context = {};
        const templateDisposables = new DisposableStore();
        const label = templateDisposables.add(this._labels.create(element, {
            supportHighlights: true,
            supportDescriptionHighlights: true,
            supportIcons: true,
            hoverDelegate: {
                delay: 0,
                showHover: options => {
                    return this._hoverService.showDelayedHover({
                        ...options,
                        actions: context.hoverActions,
                        target: element,
                        appearance: {
                            showPointer: true
                        },
                        position: {
                            hoverPosition: this._terminalConfigurationService.config.tabs.location === 'left' ? 1 /* HoverPosition.RIGHT */ : 0 /* HoverPosition.LEFT */
                        }
                    }, { groupId: 'terminal-tabs-list' });
                }
            }
        }));
        const actionsContainer = DOM.append(label.element, $('.actions'));
        const actionBar = templateDisposables.add(new ActionBar(actionsContainer, {
            actionRunner: templateDisposables.add(new TerminalContextActionRunner()),
            actionViewItemProvider: (action, options) => action instanceof MenuItemAction
                ? templateDisposables.add(this._instantiationService.createInstance(MenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate }))
                : undefined
        }));
        return {
            element,
            label,
            actionBar,
            context,
            elementDisposables: new DisposableStore(),
            templateDisposables
        };
    }
    shouldHideText() {
        return this._container ? this.getContainerWidthCachedForTask() < 63 /* TerminalTabsListSizes.MidpointViewWidth */ : false;
    }
    shouldHideActionBar() {
        return this._container ? this.getContainerWidthCachedForTask() <= 105 /* TerminalTabsListSizes.ActionbarMinimumWidth */ : false;
    }
    getContainerWidthCachedForTask() {
        if (this._cachedContainerWidth === -1) {
            this._cachedContainerWidth = this._container.clientWidth;
            queueMicrotask(() => this._cachedContainerWidth = -1);
        }
        return this._cachedContainerWidth;
    }
    renderElement(instance, index, template) {
        const hasText = !this.shouldHideText();
        const group = this._terminalGroupService.getGroupForInstance(instance);
        if (!group) {
            throw new Error(`Could not find group for instance "${instance.instanceId}"`);
        }
        template.element.classList.toggle('has-text', hasText);
        template.element.classList.toggle('is-active', this._terminalGroupService.activeInstance === instance);
        let prefix = '';
        if (group.terminalInstances.length > 1) {
            const terminalIndex = group.terminalInstances.indexOf(instance);
            if (terminalIndex === 0) {
                prefix = `┌ `;
            }
            else if (terminalIndex === group.terminalInstances.length - 1) {
                prefix = `└ `;
            }
            else {
                prefix = `├ `;
            }
        }
        const hoverInfo = getInstanceHoverInfo(instance, this._storageService);
        template.context.hoverActions = hoverInfo.actions;
        const iconId = this._instantiationService.invokeFunction(getIconId, instance);
        const hasActionbar = !this.shouldHideActionBar();
        let label = '';
        if (!hasText) {
            const primaryStatus = instance.statusList.primary;
            // Don't show ignore severity
            if (primaryStatus && primaryStatus.severity > Severity.Ignore) {
                label = `${prefix}$(${primaryStatus.icon?.id || iconId})`;
            }
            else {
                label = `${prefix}$(${iconId})`;
            }
        }
        else {
            this.fillActionBar(instance, template);
            label = prefix;
            // Only add the title if the icon is set, this prevents the title jumping around for
            // example when launching with a ShellLaunchConfig.name and no icon
            if (instance.icon) {
                label += `$(${iconId}) ${instance.title}`;
            }
        }
        if (!hasActionbar) {
            template.actionBar.clear();
        }
        // Kill terminal on middle click
        template.elementDisposables.add(DOM.addDisposableListener(template.element, DOM.EventType.AUXCLICK, e => {
            e.stopImmediatePropagation();
            if (e.button === 1 /*middle*/) {
                this._terminalService.safeDisposeTerminal(instance);
            }
        }));
        const extraClasses = [];
        const colorClass = getColorClass(instance);
        if (colorClass) {
            extraClasses.push(colorClass);
        }
        const uriClasses = getUriClasses(instance, this._themeService.getColorTheme().type);
        if (uriClasses) {
            extraClasses.push(...uriClasses);
        }
        template.label.setResource({
            resource: instance.resource,
            name: label,
            description: hasText ? instance.description : undefined
        }, {
            fileDecorations: {
                colors: true,
                badges: hasText
            },
            title: {
                markdown: hoverInfo.content,
                markdownNotSupportedFallback: undefined
            },
            extraClasses
        });
        const editableData = this._terminalEditingService.getEditableData(instance);
        template.label.element.classList.toggle('editable-tab', !!editableData);
        if (editableData) {
            // eslint-disable-next-line no-restricted-syntax
            template.elementDisposables.add(this._renderInputBox(template.label.element.querySelector('.monaco-icon-label-container'), instance, editableData));
            template.actionBar.clear();
        }
    }
    _renderInputBox(container, instance, editableData) {
        const value = instance.title || '';
        const inputBox = new InputBox(container, this._contextViewService, {
            validationOptions: {
                validation: (value) => {
                    const message = editableData.validationMessage(value);
                    if (!message || message.severity !== Severity.Error) {
                        return null;
                    }
                    return {
                        content: message.content,
                        formatContent: true,
                        type: 3 /* MessageType.ERROR */
                    };
                }
            },
            ariaLabel: localize('terminalInputAriaLabel', "Type terminal name. Press Enter to confirm or Escape to cancel."),
            inputBoxStyles: defaultInputBoxStyles
        });
        inputBox.element.style.height = '22px';
        inputBox.value = value;
        inputBox.focus();
        inputBox.select({ start: 0, end: value.length });
        const done = createSingleCallFunction((success, finishEditing) => {
            inputBox.element.style.display = 'none';
            const value = inputBox.value;
            dispose(toDispose);
            inputBox.element.remove();
            if (finishEditing) {
                editableData.onFinish(value, success);
            }
        });
        const showInputBoxNotification = () => {
            if (inputBox.isInputValid()) {
                const message = editableData.validationMessage(inputBox.value);
                if (message) {
                    inputBox.showMessage({
                        content: message.content,
                        formatContent: true,
                        type: message.severity === Severity.Info ? 1 /* MessageType.INFO */ : message.severity === Severity.Warning ? 2 /* MessageType.WARNING */ : 3 /* MessageType.ERROR */
                    });
                }
                else {
                    inputBox.hideMessage();
                }
            }
        };
        showInputBoxNotification();
        const toDispose = [
            inputBox,
            DOM.addStandardDisposableListener(inputBox.inputElement, DOM.EventType.KEY_DOWN, (e) => {
                e.stopPropagation();
                if (e.equals(3 /* KeyCode.Enter */)) {
                    done(inputBox.isInputValid(), true);
                }
                else if (e.equals(9 /* KeyCode.Escape */)) {
                    done(false, true);
                }
            }),
            DOM.addStandardDisposableListener(inputBox.inputElement, DOM.EventType.KEY_UP, (e) => {
                showInputBoxNotification();
            }),
            DOM.addDisposableListener(inputBox.inputElement, DOM.EventType.BLUR, () => {
                done(inputBox.isInputValid(), true);
            })
        ];
        return toDisposable(() => {
            done(false, false);
        });
    }
    disposeElement(instance, index, templateData) {
        templateData.elementDisposables.clear();
        templateData.actionBar.clear();
    }
    disposeTemplate(templateData) {
        templateData.elementDisposables.dispose();
        templateData.templateDisposables.dispose();
    }
    fillActionBar(instance, template) {
        // If the instance is within the selection, split all selected
        const actions = [
            template.elementDisposables.add(new Action("workbench.action.terminal.splitActiveTab" /* TerminalCommandId.SplitActiveTab */, terminalStrings.split.short, ThemeIcon.asClassName(Codicon.splitHorizontal), true, async () => {
                this._runForSelectionOrInstance(instance, async (e) => {
                    this._terminalService.createTerminal({ location: { parentTerminal: e } });
                });
            })),
        ];
        if (instance.shellLaunchConfig.tabActions) {
            for (const action of instance.shellLaunchConfig.tabActions) {
                actions.push(template.elementDisposables.add(new Action(action.id, action.label, action.icon ? ThemeIcon.asClassName(action.icon) : undefined, true, async () => {
                    this._runForSelectionOrInstance(instance, e => this._commandService.executeCommand(action.id, instance));
                })));
            }
        }
        actions.push(template.elementDisposables.add(new Action("workbench.action.terminal.killActiveTab" /* TerminalCommandId.KillActiveTab */, terminalStrings.kill.short, ThemeIcon.asClassName(Codicon.trashcan), true, async () => {
            this._runForSelectionOrInstance(instance, e => this._terminalService.safeDisposeTerminal(e));
        })));
        // TODO: Cache these in a way that will use the correct instance
        template.actionBar.clear();
        for (const action of actions) {
            template.actionBar.push(action, { icon: true, label: false, keybinding: this._keybindingService.lookupKeybinding(action.id)?.getLabel() });
        }
    }
    _runForSelectionOrInstance(instance, callback) {
        const selection = this._getSelection();
        if (selection.includes(instance)) {
            for (const s of selection) {
                if (s) {
                    callback(s);
                }
            }
        }
        else {
            callback(instance);
        }
        this._terminalGroupService.focusTabs();
        this._listService.lastFocusedList?.focusNext();
    }
};
TerminalTabsRenderer = __decorate([
    __param(3, IInstantiationService),
    __param(4, ITerminalConfigurationService),
    __param(5, ITerminalService),
    __param(6, ITerminalGroupService),
    __param(7, ITerminalEditingService),
    __param(8, IHoverService),
    __param(9, IKeybindingService),
    __param(10, IListService),
    __param(11, IStorageService),
    __param(12, IThemeService),
    __param(13, IContextViewService),
    __param(14, ICommandService)
], TerminalTabsRenderer);
let TerminalTabsAccessibilityProvider = class TerminalTabsAccessibilityProvider {
    constructor(_terminalGroupService) {
        this._terminalGroupService = _terminalGroupService;
    }
    getWidgetAriaLabel() {
        return localize('terminal.tabs', "Terminal tabs");
    }
    getAriaLabel(instance) {
        let ariaLabel = '';
        const tab = this._terminalGroupService.getGroupForInstance(instance);
        if (tab && tab.terminalInstances?.length > 1) {
            const terminalIndex = tab.terminalInstances.indexOf(instance);
            ariaLabel = localize({
                key: 'splitTerminalAriaLabel',
                comment: [
                    `The terminal's ID`,
                    `The terminal's title`,
                    `The terminal's split number`,
                    `The terminal group's total split number`
                ]
            }, "Terminal {0} {1}, split {2} of {3}", instance.instanceId, instance.title, terminalIndex + 1, tab.terminalInstances.length);
        }
        else {
            ariaLabel = localize({
                key: 'terminalAriaLabel',
                comment: [
                    `The terminal's ID`,
                    `The terminal's title`
                ]
            }, "Terminal {0} {1}", instance.instanceId, instance.title);
        }
        return ariaLabel;
    }
};
TerminalTabsAccessibilityProvider = __decorate([
    __param(0, ITerminalGroupService)
], TerminalTabsAccessibilityProvider);
let TerminalTabsDragAndDrop = class TerminalTabsDragAndDrop extends Disposable {
    constructor(_terminalService, _terminalGroupService, _terminalEditingService, _listService) {
        super();
        this._terminalService = _terminalService;
        this._terminalGroupService = _terminalGroupService;
        this._terminalEditingService = _terminalEditingService;
        this._listService = _listService;
        this._autoFocusDisposable = Disposable.None;
        this._primaryBackend = this._terminalService.getPrimaryBackend();
    }
    getDragURI(instance) {
        if (this._terminalEditingService.getEditingTerminal()?.instanceId === instance.instanceId) {
            return null;
        }
        return instance.resource.toString();
    }
    getDragLabel(elements, originalEvent) {
        return elements.length === 1 ? elements[0].title : undefined;
    }
    onDragLeave() {
        this._autoFocusInstance = undefined;
        this._autoFocusDisposable.dispose();
        this._autoFocusDisposable = Disposable.None;
    }
    onDragStart(data, originalEvent) {
        if (!originalEvent.dataTransfer) {
            return;
        }
        const dndData = data.getData();
        if (!Array.isArray(dndData)) {
            return;
        }
        // Attach terminals type to event
        const terminals = dndData.filter(isTerminalInstance);
        if (terminals.length > 0) {
            originalEvent.dataTransfer.setData("Terminals" /* TerminalDataTransfers.Terminals */, JSON.stringify(terminals.map(e => e.resource.toString())));
        }
    }
    onDragOver(data, targetInstance, targetIndex, targetSector, originalEvent) {
        if (data instanceof NativeDragAndDropData) {
            if (!containsDragType(originalEvent, DataTransfers.FILES, DataTransfers.RESOURCES, "Terminals" /* TerminalDataTransfers.Terminals */, CodeDataTransfers.FILES)) {
                return false;
            }
        }
        const didChangeAutoFocusInstance = this._autoFocusInstance !== targetInstance;
        if (didChangeAutoFocusInstance) {
            this._autoFocusDisposable.dispose();
            this._autoFocusInstance = targetInstance;
        }
        if (!targetInstance && !containsDragType(originalEvent, "Terminals" /* TerminalDataTransfers.Terminals */)) {
            return data instanceof ElementsDragAndDropData;
        }
        if (didChangeAutoFocusInstance && targetInstance) {
            this._autoFocusDisposable = disposableTimeout(() => {
                this._terminalService.setActiveInstance(targetInstance);
                this._autoFocusInstance = undefined;
            }, 500, this._store);
        }
        return {
            feedback: targetIndex ? [targetIndex] : undefined,
            accept: true,
            effect: { type: 1 /* ListDragOverEffectType.Move */, position: "drop-target" /* ListDragOverEffectPosition.Over */ }
        };
    }
    async drop(data, targetInstance, targetIndex, targetSector, originalEvent) {
        this._autoFocusDisposable.dispose();
        this._autoFocusInstance = undefined;
        let sourceInstances;
        const promises = [];
        const resources = getTerminalResourcesFromDragEvent(originalEvent);
        if (resources) {
            for (const uri of resources) {
                const instance = this._terminalService.getInstanceFromResource(uri);
                if (instance) {
                    if (Array.isArray(sourceInstances)) {
                        sourceInstances.push(instance);
                    }
                    else {
                        sourceInstances = [instance];
                    }
                    this._terminalService.moveToTerminalView(instance);
                }
                else if (this._primaryBackend) {
                    const terminalIdentifier = parseTerminalUri(uri);
                    if (terminalIdentifier.instanceId) {
                        promises.push(this._primaryBackend.requestDetachInstance(terminalIdentifier.workspaceId, terminalIdentifier.instanceId));
                    }
                }
            }
        }
        if (promises.length) {
            let processes = await Promise.all(promises);
            processes = processes.filter(p => p !== undefined);
            let lastInstance;
            for (const attachPersistentProcess of processes) {
                lastInstance = await this._terminalService.createTerminal({ config: { attachPersistentProcess } });
            }
            if (lastInstance) {
                this._terminalService.setActiveInstance(lastInstance);
            }
            return;
        }
        if (sourceInstances === undefined) {
            if (!(data instanceof ElementsDragAndDropData)) {
                this._handleExternalDrop(targetInstance, originalEvent);
                return;
            }
            const draggedElement = data.getData();
            if (!draggedElement || !Array.isArray(draggedElement)) {
                return;
            }
            sourceInstances = [];
            for (const e of draggedElement) {
                if (isTerminalInstance(e)) {
                    sourceInstances.push(e);
                }
            }
        }
        if (!targetInstance) {
            this._terminalGroupService.moveGroupToEnd(sourceInstances);
            this._terminalService.setActiveInstance(sourceInstances[0]);
            const targetGroup = this._terminalGroupService.getGroupForInstance(sourceInstances[0]);
            if (targetGroup) {
                const index = this._terminalGroupService.groups.indexOf(targetGroup);
                this._listService.lastFocusedList?.setSelection([index]);
            }
            return;
        }
        this._terminalGroupService.moveGroup(sourceInstances, targetInstance);
        this._terminalService.setActiveInstance(sourceInstances[0]);
        const targetGroup = this._terminalGroupService.getGroupForInstance(sourceInstances[0]);
        if (targetGroup) {
            const index = this._terminalGroupService.groups.indexOf(targetGroup);
            this._listService.lastFocusedList?.setSelection([index]);
        }
    }
    async _handleExternalDrop(instance, e) {
        if (!instance || !e.dataTransfer) {
            return;
        }
        // Check if files were dragged from the tree explorer
        let resource;
        const rawResources = e.dataTransfer.getData(DataTransfers.RESOURCES);
        if (rawResources) {
            resource = URI.parse(JSON.parse(rawResources)[0]);
        }
        const rawCodeFiles = e.dataTransfer.getData(CodeDataTransfers.FILES);
        if (!resource && rawCodeFiles) {
            resource = URI.file(JSON.parse(rawCodeFiles)[0]);
        }
        if (!resource && e.dataTransfer.files.length > 0 && getPathForFile(e.dataTransfer.files[0])) {
            // Check if the file was dragged from the filesystem
            resource = URI.file(getPathForFile(e.dataTransfer.files[0]));
        }
        if (!resource) {
            return;
        }
        this._terminalService.setActiveInstance(instance);
        instance.focus();
        await instance.sendPath(resource, false);
    }
};
TerminalTabsDragAndDrop = __decorate([
    __param(0, ITerminalService),
    __param(1, ITerminalGroupService),
    __param(2, ITerminalEditingService),
    __param(3, IListService)
], TerminalTabsDragAndDrop);
let TabDecorationsProvider = class TabDecorationsProvider extends Disposable {
    constructor(_terminalService) {
        super();
        this._terminalService = _terminalService;
        this.label = localize('label', "Terminal");
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._register(this._terminalService.onAnyInstancePrimaryStatusChange(e => this._onDidChange.fire([e.resource])));
    }
    provideDecorations(resource) {
        if (resource.scheme !== Schemas.vscodeTerminal) {
            return undefined;
        }
        const instance = this._terminalService.getInstanceFromResource(resource);
        if (!instance) {
            return undefined;
        }
        const primaryStatus = instance?.statusList?.primary;
        if (!primaryStatus?.icon) {
            return undefined;
        }
        return {
            color: getColorForSeverity(primaryStatus.severity),
            letter: primaryStatus.icon,
            tooltip: primaryStatus.tooltip
        };
    }
};
TabDecorationsProvider = __decorate([
    __param(0, ITerminalService)
], TabDecorationsProvider);
function isTerminalInstance(obj) {
    return isObject(obj) && 'instanceId' in obj;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxUYWJzTGlzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsVGFic0xpc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUUvRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQWUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN2RyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxxQkFBcUIsRUFBcUIsZ0JBQWdCLEVBQUUsdUJBQXVCLEVBQXlCLE1BQU0sZUFBZSxDQUFDO0FBQzFLLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUMvRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEYsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0saUVBQWlFLENBQUM7QUFFMUcsT0FBTyxFQUFvQixnQkFBZ0IsRUFBcUIsTUFBTSxrREFBa0QsQ0FBQztBQUN6SCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzVELE9BQU8sRUFBRSx3QkFBd0IsRUFBa0IsY0FBYyxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDdEcsT0FBTyxFQUF5QyxtQkFBbUIsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ2pJLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM1RSxPQUFPLFFBQVEsTUFBTSxxQ0FBcUMsQ0FBQztBQUMzRCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQWUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFdkgsT0FBTyxFQUFFLGFBQWEsRUFBb0IsTUFBTSxpQ0FBaUMsQ0FBQztBQUNsRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsdUJBQXVCLEVBQXdCLHFCQUFxQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDcEksT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLGFBQWEsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBRTVFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxRQUFRLEVBQWUsTUFBTSxrREFBa0QsQ0FBQztBQUN6RixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUdqRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDOUcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQy9ELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBRXBGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxpQ0FBaUMsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQzVELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQzVGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDOUQsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFHdkUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxlQUFlLEVBQWdCLE1BQU0sZ0RBQWdELENBQUM7QUFFL0YsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRTVELE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFFaEIsTUFBTSxDQUFOLElBQWtCLHFCQVFqQjtBQVJELFdBQWtCLHFCQUFxQjtJQUN0Qyw0RUFBYyxDQUFBO0lBQ2Qsd0ZBQW9CLENBQUE7SUFDcEIsa0dBQXlCLENBQUE7SUFDekIsbUZBQWtCLENBQUE7SUFDbEIsNEZBQTRHLENBQUE7SUFDNUcscUdBQTJCLENBQUE7SUFDM0IsbUZBQWtCLENBQUE7QUFDbkIsQ0FBQyxFQVJpQixxQkFBcUIsS0FBckIscUJBQXFCLFFBUXRDO0FBRU0sSUFBTSxlQUFlLEdBQXJCLE1BQU0sZUFBZ0IsU0FBUSxhQUFnQztJQUtwRSxZQUNDLFNBQXNCLEVBQ0YsaUJBQXFDLEVBQzNDLFdBQXlCLEVBQ0MscUJBQTRDLEVBQ2pELGdCQUFrQyxFQUM3QixxQkFBNEMsRUFDMUMsdUJBQWdELEVBQ25FLG9CQUEyQyxFQUM3QyxrQkFBdUMsRUFDNUIsYUFBNEIsRUFDMUIsZUFBZ0MsRUFDL0MsZ0JBQW1DLEVBQ3RCLGFBQTRCO1FBRTVELEtBQUssQ0FBQyxrQkFBa0IsRUFBRSxTQUFTLEVBQ2xDO1lBQ0MsU0FBUyxFQUFFLEdBQUcsRUFBRSx5Q0FBZ0M7WUFDaEQsYUFBYSxFQUFFLEdBQUcsRUFBRSxDQUFDLGVBQWU7U0FDcEMsRUFDRCxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxvQkFBb0IsRUFBRSxTQUFTLEVBQUUsb0JBQW9CLENBQUMsY0FBYyxDQUFDLGNBQWMsRUFBRSx3QkFBd0IsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLENBQUMsRUFDdkw7WUFDQyxtQkFBbUIsRUFBRSxLQUFLO1lBQzFCLHFCQUFxQixFQUFFLEtBQUs7WUFDNUIsbUJBQW1CLEVBQUUsSUFBSTtZQUN6QixnQkFBZ0IsRUFBRTtnQkFDakIsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLFVBQVU7YUFDekI7WUFDRCxxQkFBcUIsRUFBRSxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsaUNBQWlDLENBQUM7WUFDN0YsZUFBZSxFQUFFLHFCQUFxQixDQUFDLFFBQVEsQ0FBVSxnQ0FBZ0MsQ0FBQztZQUMxRix3QkFBd0IsRUFBRSxJQUFJO1lBQzlCLGFBQWEsMENBQWlDO1lBQzlDLEdBQUcsRUFBRSxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsdUJBQXVCLENBQUM7WUFDakUsaUJBQWlCLEVBQUUsSUFBSTtTQUN2QixFQUNELGlCQUFpQixFQUNqQixXQUFXLEVBQ1gscUJBQXFCLEVBQ3JCLG9CQUFvQixDQUNwQixDQUFDO1FBbkNzQywwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO1FBQ2pELHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBa0I7UUFDN0IsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtRQUMxQyw0QkFBdUIsR0FBdkIsdUJBQXVCLENBQXlCO1FBRzFELGtCQUFhLEdBQWIsYUFBYSxDQUFlO1FBQzFCLG9CQUFlLEdBQWYsZUFBZSxDQUFpQjtRQUVsQyxrQkFBYSxHQUFiLGFBQWEsQ0FBZTtRQTRCNUQsTUFBTSxtQkFBbUIsR0FBa0I7WUFDMUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLG9CQUFvQixDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNyRSxJQUFJLENBQUMscUJBQXFCLENBQUMsaUJBQWlCLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2xFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQzFELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyw2QkFBNkIsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDOUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLHdCQUF3QixDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNwRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsdUJBQXVCLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ25FLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxnQ0FBZ0MsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDNUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLDBCQUEwQixDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN0RSxJQUFJLENBQUMsYUFBYSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUM5RCxJQUFJLENBQUMscUJBQXFCLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ3hELElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQ1AsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzFELElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUN2QixJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNoQixDQUFDO2dCQUNELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNoQixDQUFDLENBQUM7WUFDRixJQUFJLENBQUMsZUFBZSxDQUFDLGdCQUFnQix3SEFBaUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztTQUM3SSxDQUFDO1FBRUYsNEZBQTRGO1FBQzVGLFVBQVU7UUFDVixJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDeEQsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFDN0IsbUJBQW1CLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNoQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0osSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRTtZQUN0QyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUM3QixtQkFBbUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBQ2hDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBQyxDQUFDLEVBQUMsRUFBRTtZQUNuRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDOUIsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUN4QixNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsRUFBRSxRQUFRLEVBQUUsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztnQkFDbEcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUN2RCxNQUFNLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUNqQyxDQUFDO1lBRUQsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxVQUFVLEtBQUssQ0FBQyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQztnQkFDN0YsT0FBTztZQUNSLENBQUM7WUFFRCxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsS0FBSyxhQUFhLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDNUUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDeEIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixpRUFBaUU7UUFDakUsd0NBQXdDO1FBQ3hDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFDLENBQUMsRUFBQyxFQUFFO1lBQ2hELElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLGtCQUFrQixFQUFFLEVBQUUsVUFBVSxLQUFLLENBQUMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUM7Z0JBQzdGLE9BQU87WUFDUixDQUFDO1lBRUQsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3hDLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLGNBQWMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLGNBQWMsRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3pGLENBQUM7aUJBQU0sSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFLEtBQUssYUFBYSxFQUFFLENBQUM7Z0JBQ25ELElBQUksSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUUsQ0FBQztvQkFDckMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3hCLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLGdEQUFnRDtRQUNoRCx3Q0FBd0M7UUFDeEMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUMzQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNoQixJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUN0QixPQUFPO1lBQ1IsQ0FBQztZQUNELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1lBQzdDLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUN6RCxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDdkQsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLENBQUMscUNBQXFDLEdBQUcsbUJBQW1CLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDakgsSUFBSSxDQUFDLGtCQUFrQixHQUFHLG1CQUFtQixDQUFDLHVCQUF1QixDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBRWhHLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMvRSxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRTVFLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFDLENBQUMsRUFBQyxFQUFFO1lBQzdDLE1BQU0sUUFBUSxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUM7WUFDM0IsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNmLE9BQU87WUFDUixDQUFDO1lBQ0QsSUFBSSxDQUFDLHFCQUFxQixDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3ZELElBQUksQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLGFBQWEsRUFBRSxDQUFDO2dCQUNwQyxNQUFNLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUNqQyxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNKLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztZQUNoQyxJQUFJLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQztZQUM5RyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO1FBQ2pHLENBQUM7UUFDRCxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDaEIsQ0FBQztJQUVPLGFBQWE7UUFDcEIsT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSw0RUFBZ0UsQ0FBQztJQUM1RyxDQUFDO0lBRUQsT0FBTyxDQUFDLGdCQUF5QixJQUFJO1FBQ3BDLElBQUksYUFBYSxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztZQUN6RSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDakIsQ0FBQztRQUVELElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQzNFLENBQUM7SUFFRCxVQUFVO1FBQ1QsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2YsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDO1lBQ25DLEdBQUcsb0JBQW9CLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUM7WUFDdkQsTUFBTSxFQUFFLElBQUksQ0FBQyxjQUFjLEVBQUU7WUFDN0IsU0FBUyxFQUFFLElBQUk7U0FDZixFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ1YsQ0FBQztJQUVPLGlCQUFpQjtRQUN4QixJQUFJLENBQUMscUNBQXFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQztRQUN4RixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUMzQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM3RyxDQUFDO0NBQ0QsQ0FBQTtBQWpMWSxlQUFlO0lBT3pCLFdBQUEsa0JBQWtCLENBQUE7SUFDbEIsV0FBQSxZQUFZLENBQUE7SUFDWixXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEsZ0JBQWdCLENBQUE7SUFDaEIsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLHVCQUF1QixDQUFBO0lBQ3ZCLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxtQkFBbUIsQ0FBQTtJQUNuQixXQUFBLGFBQWEsQ0FBQTtJQUNiLFlBQUEsZUFBZSxDQUFBO0lBQ2YsWUFBQSxpQkFBaUIsQ0FBQTtJQUNqQixZQUFBLGFBQWEsQ0FBQTtHQWxCSCxlQUFlLENBaUwzQjs7QUFFRCxJQUFNLG9CQUFvQixHQUExQixNQUFNLG9CQUFvQjtJQUd6QixZQUNrQixVQUF1QixFQUN2QixPQUF1QixFQUN2QixhQUF3QyxFQUNsQyxxQkFBNkQsRUFDckQsNkJBQTZFLEVBQzFGLGdCQUFtRCxFQUM5QyxxQkFBNkQsRUFDM0QsdUJBQWlFLEVBQzNFLGFBQTZDLEVBQ3hDLGtCQUF1RCxFQUM3RCxZQUEyQyxFQUN4QyxlQUFpRCxFQUNuRCxhQUE2QyxFQUN2QyxtQkFBeUQsRUFDN0QsZUFBaUQ7UUFkakQsZUFBVSxHQUFWLFVBQVUsQ0FBYTtRQUN2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtRQUN2QixrQkFBYSxHQUFiLGFBQWEsQ0FBMkI7UUFDakIsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtRQUNwQyxrQ0FBNkIsR0FBN0IsNkJBQTZCLENBQStCO1FBQ3pFLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBa0I7UUFDN0IsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtRQUMxQyw0QkFBdUIsR0FBdkIsdUJBQXVCLENBQXlCO1FBQzFELGtCQUFhLEdBQWIsYUFBYSxDQUFlO1FBQ3ZCLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBb0I7UUFDNUMsaUJBQVksR0FBWixZQUFZLENBQWM7UUFDdkIsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBQ2xDLGtCQUFhLEdBQWIsYUFBYSxDQUFlO1FBQ3RCLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBcUI7UUFDNUMsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBakJuRSxlQUFVLEdBQUcsZUFBZSxDQUFDO1FBOEVyQiwwQkFBcUIsR0FBRyxDQUFDLENBQUMsQ0FBQztJQTNEbkMsQ0FBQztJQUVELGNBQWMsQ0FBQyxTQUFzQjtRQUNwQyxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDO1FBQ2pFLE1BQU0sT0FBTyxHQUFzQyxFQUFFLENBQUM7UUFDdEQsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBRWxELE1BQU0sS0FBSyxHQUFHLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7WUFDbEUsaUJBQWlCLEVBQUUsSUFBSTtZQUN2Qiw0QkFBNEIsRUFBRSxJQUFJO1lBQ2xDLFlBQVksRUFBRSxJQUFJO1lBQ2xCLGFBQWEsRUFBRTtnQkFDZCxLQUFLLEVBQUUsQ0FBQztnQkFDUixTQUFTLEVBQUUsT0FBTyxDQUFDLEVBQUU7b0JBQ3BCLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQzt3QkFDMUMsR0FBRyxPQUFPO3dCQUNWLE9BQU8sRUFBRSxPQUFPLENBQUMsWUFBWTt3QkFDN0IsTUFBTSxFQUFFLE9BQU87d0JBQ2YsVUFBVSxFQUFFOzRCQUNYLFdBQVcsRUFBRSxJQUFJO3lCQUNqQjt3QkFDRCxRQUFRLEVBQUU7NEJBQ1QsYUFBYSxFQUFFLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxNQUFNLENBQUMsQ0FBQyw2QkFBcUIsQ0FBQywyQkFBbUI7eUJBQzVIO3FCQUNELEVBQUUsRUFBRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsQ0FBQyxDQUFDO2dCQUN2QyxDQUFDO2FBQ0Q7U0FDRCxDQUFDLENBQUMsQ0FBQztRQUVKLE1BQU0sZ0JBQWdCLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBSWxFLE1BQU0sU0FBUyxHQUFHLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxnQkFBZ0IsRUFBRTtZQUN6RSxZQUFZLEVBQUUsbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksMkJBQTJCLEVBQUUsQ0FBQztZQUN4RSxzQkFBc0IsRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsRUFBRSxDQUMzQyxNQUFNLFlBQVksY0FBYztnQkFDL0IsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsY0FBYyxDQUFDLHVCQUF1QixFQUFFLE1BQU0sRUFBRSxFQUFFLGFBQWEsRUFBRSxPQUFPLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQztnQkFDL0ksQ0FBQyxDQUFDLFNBQVM7U0FDYixDQUFDLENBQUMsQ0FBQztRQUVKLE9BQU87WUFDTixPQUFPO1lBQ1AsS0FBSztZQUNMLFNBQVM7WUFDVCxPQUFPO1lBQ1Asa0JBQWtCLEVBQUUsSUFBSSxlQUFlLEVBQUU7WUFDekMsbUJBQW1CO1NBQ25CLENBQUM7SUFDSCxDQUFDO0lBRUQsY0FBYztRQUNiLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLDhCQUE4QixFQUFFLG1EQUEwQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7SUFDbEgsQ0FBQztJQUVELG1CQUFtQjtRQUNsQixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyw4QkFBOEIsRUFBRSx5REFBK0MsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0lBQ3ZILENBQUM7SUFHRCw4QkFBOEI7UUFDN0IsSUFBSSxJQUFJLENBQUMscUJBQXFCLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUN2QyxJQUFJLENBQUMscUJBQXFCLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDekQsY0FBYyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQztJQUNuQyxDQUFDO0lBRUQsYUFBYSxDQUFDLFFBQTJCLEVBQUUsS0FBYSxFQUFFLFFBQW1DO1FBQzVGLE1BQU0sT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBRXZDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN2RSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDWixNQUFNLElBQUksS0FBSyxDQUFDLHNDQUFzQyxRQUFRLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQztRQUMvRSxDQUFDO1FBRUQsUUFBUSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN2RCxRQUFRLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLEtBQUssUUFBUSxDQUFDLENBQUM7UUFFdkcsSUFBSSxNQUFNLEdBQVcsRUFBRSxDQUFDO1FBQ3hCLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUN4QyxNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2hFLElBQUksYUFBYSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUN6QixNQUFNLEdBQUcsSUFBSSxDQUFDO1lBQ2YsQ0FBQztpQkFBTSxJQUFJLGFBQWEsS0FBSyxLQUFLLENBQUMsaUJBQWlCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUNqRSxNQUFNLEdBQUcsSUFBSSxDQUFDO1lBQ2YsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sR0FBRyxJQUFJLENBQUM7WUFDZixDQUFDO1FBQ0YsQ0FBQztRQUVELE1BQU0sU0FBUyxHQUFHLG9CQUFvQixDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDdkUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxZQUFZLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQztRQUVsRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUM5RSxNQUFNLFlBQVksR0FBRyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBQ2pELElBQUksS0FBSyxHQUFXLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDZCxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztZQUNsRCw2QkFBNkI7WUFDN0IsSUFBSSxhQUFhLElBQUksYUFBYSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQy9ELEtBQUssR0FBRyxHQUFHLE1BQU0sS0FBSyxhQUFhLENBQUMsSUFBSSxFQUFFLEVBQUUsSUFBSSxNQUFNLEdBQUcsQ0FBQztZQUMzRCxDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsS0FBSyxHQUFHLEdBQUcsTUFBTSxLQUFLLE1BQU0sR0FBRyxDQUFDO1lBQ2pDLENBQUM7UUFDRixDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ3ZDLEtBQUssR0FBRyxNQUFNLENBQUM7WUFDZixvRkFBb0Y7WUFDcEYsbUVBQW1FO1lBQ25FLElBQUksUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNuQixLQUFLLElBQUksS0FBSyxNQUFNLEtBQUssUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQzNDLENBQUM7UUFDRixDQUFDO1FBRUQsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ25CLFFBQVEsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDNUIsQ0FBQztRQUVELGdDQUFnQztRQUNoQyxRQUFRLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQ3ZHLENBQUMsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1lBQzdCLElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUEsVUFBVSxFQUFFLENBQUM7Z0JBQzlCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNyRCxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLE1BQU0sWUFBWSxHQUFhLEVBQUUsQ0FBQztRQUNsQyxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDM0MsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUNoQixZQUFZLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQy9CLENBQUM7UUFDRCxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDcEYsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUNoQixZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUM7UUFDbEMsQ0FBQztRQUVELFFBQVEsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDO1lBQzFCLFFBQVEsRUFBRSxRQUFRLENBQUMsUUFBUTtZQUMzQixJQUFJLEVBQUUsS0FBSztZQUNYLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFNBQVM7U0FDdkQsRUFBRTtZQUNGLGVBQWUsRUFBRTtnQkFDaEIsTUFBTSxFQUFFLElBQUk7Z0JBQ1osTUFBTSxFQUFFLE9BQU87YUFDZjtZQUNELEtBQUssRUFBRTtnQkFDTixRQUFRLEVBQUUsU0FBUyxDQUFDLE9BQU87Z0JBQzNCLDRCQUE0QixFQUFFLFNBQVM7YUFDdkM7WUFDRCxZQUFZO1NBQ1osQ0FBQyxDQUFDO1FBQ0gsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM1RSxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDeEUsSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUNsQixnREFBZ0Q7WUFDaEQsUUFBUSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyw4QkFBOEIsQ0FBRSxFQUFFLFFBQVEsRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO1lBQ3JKLFFBQVEsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDNUIsQ0FBQztJQUNGLENBQUM7SUFFTyxlQUFlLENBQUMsU0FBc0IsRUFBRSxRQUEyQixFQUFFLFlBQTJCO1FBRXZHLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO1FBRW5DLE1BQU0sUUFBUSxHQUFHLElBQUksUUFBUSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsbUJBQW1CLEVBQUU7WUFDbEUsaUJBQWlCLEVBQUU7Z0JBQ2xCLFVBQVUsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFO29CQUNyQixNQUFNLE9BQU8sR0FBRyxZQUFZLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ3RELElBQUksQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLFFBQVEsS0FBSyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUM7d0JBQ3JELE9BQU8sSUFBSSxDQUFDO29CQUNiLENBQUM7b0JBRUQsT0FBTzt3QkFDTixPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU87d0JBQ3hCLGFBQWEsRUFBRSxJQUFJO3dCQUNuQixJQUFJLDJCQUFtQjtxQkFDdkIsQ0FBQztnQkFDSCxDQUFDO2FBQ0Q7WUFDRCxTQUFTLEVBQUUsUUFBUSxDQUFDLHdCQUF3QixFQUFFLGlFQUFpRSxDQUFDO1lBQ2hILGNBQWMsRUFBRSxxQkFBcUI7U0FDckMsQ0FBQyxDQUFDO1FBQ0gsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUN2QyxRQUFRLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUN2QixRQUFRLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDakIsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBRWpELE1BQU0sSUFBSSxHQUFHLHdCQUF3QixDQUFDLENBQUMsT0FBZ0IsRUFBRSxhQUFzQixFQUFFLEVBQUU7WUFDbEYsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQztZQUN4QyxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDO1lBQzdCLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNuQixRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzFCLElBQUksYUFBYSxFQUFFLENBQUM7Z0JBQ25CLFlBQVksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3ZDLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sd0JBQXdCLEdBQUcsR0FBRyxFQUFFO1lBQ3JDLElBQUksUUFBUSxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUM7Z0JBQzdCLE1BQU0sT0FBTyxHQUFHLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQy9ELElBQUksT0FBTyxFQUFFLENBQUM7b0JBQ2IsUUFBUSxDQUFDLFdBQVcsQ0FBQzt3QkFDcEIsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPO3dCQUN4QixhQUFhLEVBQUUsSUFBSTt3QkFDbkIsSUFBSSxFQUFFLE9BQU8sQ0FBQyxRQUFRLEtBQUssUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLDBCQUFrQixDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsS0FBSyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsNkJBQXFCLENBQUMsMEJBQWtCO3FCQUM3SSxDQUFDLENBQUM7Z0JBQ0osQ0FBQztxQkFBTSxDQUFDO29CQUNQLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDeEIsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDLENBQUM7UUFDRix3QkFBd0IsRUFBRSxDQUFDO1FBRTNCLE1BQU0sU0FBUyxHQUFHO1lBQ2pCLFFBQVE7WUFDUixHQUFHLENBQUMsNkJBQTZCLENBQUMsUUFBUSxDQUFDLFlBQVksRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQWlCLEVBQUUsRUFBRTtnQkFDdEcsQ0FBQyxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUNwQixJQUFJLENBQUMsQ0FBQyxNQUFNLHVCQUFlLEVBQUUsQ0FBQztvQkFDN0IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDckMsQ0FBQztxQkFBTSxJQUFJLENBQUMsQ0FBQyxNQUFNLHdCQUFnQixFQUFFLENBQUM7b0JBQ3JDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ25CLENBQUM7WUFDRixDQUFDLENBQUM7WUFDRixHQUFHLENBQUMsNkJBQTZCLENBQUMsUUFBUSxDQUFDLFlBQVksRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQWlCLEVBQUUsRUFBRTtnQkFDcEcsd0JBQXdCLEVBQUUsQ0FBQztZQUM1QixDQUFDLENBQUM7WUFDRixHQUFHLENBQUMscUJBQXFCLENBQUMsUUFBUSxDQUFDLFlBQVksRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUU7Z0JBQ3pFLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDckMsQ0FBQyxDQUFDO1NBQ0YsQ0FBQztRQUVGLE9BQU8sWUFBWSxDQUFDLEdBQUcsRUFBRTtZQUN4QixJQUFJLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3BCLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELGNBQWMsQ0FBQyxRQUEyQixFQUFFLEtBQWEsRUFBRSxZQUF1QztRQUNqRyxZQUFZLENBQUMsa0JBQWtCLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDeEMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNoQyxDQUFDO0lBRUQsZUFBZSxDQUFDLFlBQXVDO1FBQ3RELFlBQVksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUMxQyxZQUFZLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDNUMsQ0FBQztJQUVELGFBQWEsQ0FBQyxRQUEyQixFQUFFLFFBQW1DO1FBQzdFLDhEQUE4RDtRQUM5RCxNQUFNLE9BQU8sR0FBRztZQUNmLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxNQUFNLG9GQUFtQyxlQUFlLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRSxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUU7Z0JBQzFLLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFDLENBQUMsRUFBQyxFQUFFO29CQUNuRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUUsY0FBYyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDM0UsQ0FBQyxDQUFDLENBQUM7WUFDSixDQUFDLENBQUMsQ0FBQztTQUNILENBQUM7UUFDRixJQUFJLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUMzQyxLQUFLLE1BQU0sTUFBTSxJQUFJLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDNUQsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxLQUFLLElBQUksRUFBRTtvQkFDL0osSUFBSSxDQUFDLDBCQUEwQixDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDMUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ04sQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxNQUFNLGtGQUFrQyxlQUFlLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDOUssSUFBSSxDQUFDLDBCQUEwQixDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlGLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNMLGdFQUFnRTtRQUNoRSxRQUFRLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzNCLEtBQUssTUFBTSxNQUFNLElBQUksT0FBTyxFQUFFLENBQUM7WUFDOUIsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUM1SSxDQUFDO0lBQ0YsQ0FBQztJQUVPLDBCQUEwQixDQUFDLFFBQTJCLEVBQUUsUUFBK0M7UUFDOUcsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ3ZDLElBQUksU0FBUyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQ2xDLEtBQUssTUFBTSxDQUFDLElBQUksU0FBUyxFQUFFLENBQUM7Z0JBQzNCLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQ1AsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNiLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQzthQUFNLENBQUM7WUFDUCxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDcEIsQ0FBQztRQUNELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUN2QyxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsRUFBRSxTQUFTLEVBQUUsQ0FBQztJQUNoRCxDQUFDO0NBQ0QsQ0FBQTtBQW5USyxvQkFBb0I7SUFPdkIsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLDZCQUE2QixDQUFBO0lBQzdCLFdBQUEsZ0JBQWdCLENBQUE7SUFDaEIsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLHVCQUF1QixDQUFBO0lBQ3ZCLFdBQUEsYUFBYSxDQUFBO0lBQ2IsV0FBQSxrQkFBa0IsQ0FBQTtJQUNsQixZQUFBLFlBQVksQ0FBQTtJQUNaLFlBQUEsZUFBZSxDQUFBO0lBQ2YsWUFBQSxhQUFhLENBQUE7SUFDYixZQUFBLG1CQUFtQixDQUFBO0lBQ25CLFlBQUEsZUFBZSxDQUFBO0dBbEJaLG9CQUFvQixDQW1UekI7QUFjRCxJQUFNLGlDQUFpQyxHQUF2QyxNQUFNLGlDQUFpQztJQUN0QyxZQUN5QyxxQkFBNEM7UUFBNUMsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtJQUNqRixDQUFDO0lBRUwsa0JBQWtCO1FBQ2pCLE9BQU8sUUFBUSxDQUFDLGVBQWUsRUFBRSxlQUFlLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRUQsWUFBWSxDQUFDLFFBQTJCO1FBQ3ZDLElBQUksU0FBUyxHQUFXLEVBQUUsQ0FBQztRQUMzQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDckUsSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLGlCQUFpQixFQUFFLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUM5QyxNQUFNLGFBQWEsR0FBRyxHQUFHLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzlELFNBQVMsR0FBRyxRQUFRLENBQUM7Z0JBQ3BCLEdBQUcsRUFBRSx3QkFBd0I7Z0JBQzdCLE9BQU8sRUFBRTtvQkFDUixtQkFBbUI7b0JBQ25CLHNCQUFzQjtvQkFDdEIsNkJBQTZCO29CQUM3Qix5Q0FBeUM7aUJBQ3pDO2FBQ0QsRUFBRSxvQ0FBb0MsRUFBRSxRQUFRLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxLQUFLLEVBQUUsYUFBYSxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsaUJBQWlCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDaEksQ0FBQzthQUFNLENBQUM7WUFDUCxTQUFTLEdBQUcsUUFBUSxDQUFDO2dCQUNwQixHQUFHLEVBQUUsbUJBQW1CO2dCQUN4QixPQUFPLEVBQUU7b0JBQ1IsbUJBQW1CO29CQUNuQixzQkFBc0I7aUJBQ3RCO2FBQ0QsRUFBRSxrQkFBa0IsRUFBRSxRQUFRLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM3RCxDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztDQUNELENBQUE7QUFsQ0ssaUNBQWlDO0lBRXBDLFdBQUEscUJBQXFCLENBQUE7R0FGbEIsaUNBQWlDLENBa0N0QztBQUVELElBQU0sdUJBQXVCLEdBQTdCLE1BQU0sdUJBQXdCLFNBQVEsVUFBVTtJQUsvQyxZQUNtQixnQkFBbUQsRUFDOUMscUJBQTZELEVBQzNELHVCQUFpRSxFQUM1RSxZQUEyQztRQUV6RCxLQUFLLEVBQUUsQ0FBQztRQUwyQixxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQWtCO1FBQzdCLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBdUI7UUFDMUMsNEJBQXVCLEdBQXZCLHVCQUF1QixDQUF5QjtRQUMzRCxpQkFBWSxHQUFaLFlBQVksQ0FBYztRQVBsRCx5QkFBb0IsR0FBZ0IsVUFBVSxDQUFDLElBQUksQ0FBQztRQVUzRCxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO0lBQ2xFLENBQUM7SUFFRCxVQUFVLENBQUMsUUFBMkI7UUFDckMsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxVQUFVLEtBQUssUUFBUSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQzNGLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELE9BQU8sUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNyQyxDQUFDO0lBRUQsWUFBWSxDQUFFLFFBQTZCLEVBQUUsYUFBd0I7UUFDcEUsT0FBTyxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQzlELENBQUM7SUFFRCxXQUFXO1FBQ1YsSUFBSSxDQUFDLGtCQUFrQixHQUFHLFNBQVMsQ0FBQztRQUNwQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDcEMsSUFBSSxDQUFDLG9CQUFvQixHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUM7SUFDN0MsQ0FBQztJQUVELFdBQVcsQ0FBQyxJQUFzQixFQUFFLGFBQXdCO1FBQzNELElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDakMsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLE9BQU8sR0FBWSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDeEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUM3QixPQUFPO1FBQ1IsQ0FBQztRQUNELGlDQUFpQztRQUNqQyxNQUFNLFNBQVMsR0FBSSxPQUFxQixDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3BFLElBQUksU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUMxQixhQUFhLENBQUMsWUFBWSxDQUFDLE9BQU8sb0RBQWtDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEksQ0FBQztJQUNGLENBQUM7SUFFRCxVQUFVLENBQUMsSUFBc0IsRUFBRSxjQUE2QyxFQUFFLFdBQStCLEVBQUUsWUFBOEMsRUFBRSxhQUF3QjtRQUMxTCxJQUFJLElBQUksWUFBWSxxQkFBcUIsRUFBRSxDQUFDO1lBQzNDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsYUFBYSxDQUFDLEtBQUssRUFBRSxhQUFhLENBQUMsU0FBUyxxREFBbUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDOUksT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDO1FBQ0YsQ0FBQztRQUVELE1BQU0sMEJBQTBCLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixLQUFLLGNBQWMsQ0FBQztRQUM5RSxJQUFJLDBCQUEwQixFQUFFLENBQUM7WUFDaEMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3BDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxjQUFjLENBQUM7UUFDMUMsQ0FBQztRQUVELElBQUksQ0FBQyxjQUFjLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLG9EQUFrQyxFQUFFLENBQUM7WUFDMUYsT0FBTyxJQUFJLFlBQVksdUJBQXVCLENBQUM7UUFDaEQsQ0FBQztRQUVELElBQUksMEJBQTBCLElBQUksY0FBYyxFQUFFLENBQUM7WUFDbEQsSUFBSSxDQUFDLG9CQUFvQixHQUFHLGlCQUFpQixDQUFDLEdBQUcsRUFBRTtnQkFDbEQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGlCQUFpQixDQUFDLGNBQWMsQ0FBQyxDQUFDO2dCQUN4RCxJQUFJLENBQUMsa0JBQWtCLEdBQUcsU0FBUyxDQUFDO1lBQ3JDLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3RCLENBQUM7UUFFRCxPQUFPO1lBQ04sUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztZQUNqRCxNQUFNLEVBQUUsSUFBSTtZQUNaLE1BQU0sRUFBRSxFQUFFLElBQUkscUNBQTZCLEVBQUUsUUFBUSxxREFBaUMsRUFBRTtTQUN4RixDQUFDO0lBQ0gsQ0FBQztJQUVELEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBc0IsRUFBRSxjQUE2QyxFQUFFLFdBQStCLEVBQUUsWUFBOEMsRUFBRSxhQUF3QjtRQUMxTCxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDcEMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLFNBQVMsQ0FBQztRQUVwQyxJQUFJLGVBQWdELENBQUM7UUFDckQsTUFBTSxRQUFRLEdBQTJDLEVBQUUsQ0FBQztRQUM1RCxNQUFNLFNBQVMsR0FBRyxpQ0FBaUMsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNuRSxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2YsS0FBSyxNQUFNLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDN0IsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNwRSxJQUFJLFFBQVEsRUFBRSxDQUFDO29CQUNkLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDO3dCQUNwQyxlQUFlLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUNoQyxDQUFDO3lCQUFNLENBQUM7d0JBQ1AsZUFBZSxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQzlCLENBQUM7b0JBQ0QsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUNwRCxDQUFDO3FCQUFNLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO29CQUNqQyxNQUFNLGtCQUFrQixHQUFHLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUNqRCxJQUFJLGtCQUFrQixDQUFDLFVBQVUsRUFBRSxDQUFDO3dCQUNuQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMscUJBQXFCLENBQUMsa0JBQWtCLENBQUMsV0FBVyxFQUFFLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7b0JBQzFILENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQsSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDckIsSUFBSSxTQUFTLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzVDLFNBQVMsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDO1lBQ25ELElBQUksWUFBMkMsQ0FBQztZQUNoRCxLQUFLLE1BQU0sdUJBQXVCLElBQUksU0FBUyxFQUFFLENBQUM7Z0JBQ2pELFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSx1QkFBdUIsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNwRyxDQUFDO1lBQ0QsSUFBSSxZQUFZLEVBQUUsQ0FBQztnQkFDbEIsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ3ZELENBQUM7WUFDRCxPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksZUFBZSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ25DLElBQUksQ0FBQyxDQUFDLElBQUksWUFBWSx1QkFBdUIsQ0FBQyxFQUFFLENBQUM7Z0JBQ2hELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxjQUFjLEVBQUUsYUFBYSxDQUFDLENBQUM7Z0JBQ3hELE9BQU87WUFDUixDQUFDO1lBRUQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3RDLElBQUksQ0FBQyxjQUFjLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3ZELE9BQU87WUFDUixDQUFDO1lBRUQsZUFBZSxHQUFHLEVBQUUsQ0FBQztZQUNyQixLQUFLLE1BQU0sQ0FBQyxJQUFJLGNBQWMsRUFBRSxDQUFDO2dCQUNoQyxJQUFJLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQzNCLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBc0IsQ0FBQyxDQUFDO2dCQUM5QyxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDckIsSUFBSSxDQUFDLHFCQUFxQixDQUFDLGNBQWMsQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUMzRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsaUJBQWlCLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLG1CQUFtQixDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZGLElBQUksV0FBVyxFQUFFLENBQUM7Z0JBQ2pCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUNyRSxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsRUFBRSxZQUFZLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQzFELENBQUM7WUFDRCxPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsZUFBZSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ3RFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM1RCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsbUJBQW1CLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdkYsSUFBSSxXQUFXLEVBQUUsQ0FBQztZQUNqQixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUNyRSxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsRUFBRSxZQUFZLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQzFELENBQUM7SUFDRixDQUFDO0lBRU8sS0FBSyxDQUFDLG1CQUFtQixDQUFDLFFBQXVDLEVBQUUsQ0FBWTtRQUN0RixJQUFJLENBQUMsUUFBUSxJQUFJLENBQUMsQ0FBQyxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ2xDLE9BQU87UUFDUixDQUFDO1FBRUQscURBQXFEO1FBQ3JELElBQUksUUFBeUIsQ0FBQztRQUM5QixNQUFNLFlBQVksR0FBRyxDQUFDLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDckUsSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUNsQixRQUFRLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztRQUVELE1BQU0sWUFBWSxHQUFHLENBQUMsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3JFLElBQUksQ0FBQyxRQUFRLElBQUksWUFBWSxFQUFFLENBQUM7WUFDL0IsUUFBUSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xELENBQUM7UUFFRCxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksY0FBYyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUM3RixvREFBb0Q7WUFDcEQsUUFBUSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFFLENBQUMsQ0FBQztRQUMvRCxDQUFDO1FBRUQsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2YsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFbEQsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2pCLE1BQU0sUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDMUMsQ0FBQztDQUNELENBQUE7QUE1TEssdUJBQXVCO0lBTTFCLFdBQUEsZ0JBQWdCLENBQUE7SUFDaEIsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLHVCQUF1QixDQUFBO0lBQ3ZCLFdBQUEsWUFBWSxDQUFBO0dBVFQsdUJBQXVCLENBNEw1QjtBQUVELElBQU0sc0JBQXNCLEdBQTVCLE1BQU0sc0JBQXVCLFNBQVEsVUFBVTtJQU05QyxZQUNtQixnQkFBbUQ7UUFFckUsS0FBSyxFQUFFLENBQUM7UUFGMkIscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFrQjtRQU43RCxVQUFLLEdBQVcsUUFBUSxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQztRQUV0QyxpQkFBWSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVMsQ0FBQyxDQUFDO1FBQzVELGdCQUFXLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUM7UUFNOUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsZ0NBQWdDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNuSCxDQUFDO0lBRUQsa0JBQWtCLENBQUMsUUFBYTtRQUMvQixJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssT0FBTyxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ2hELE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsdUJBQXVCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDekUsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2YsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELE1BQU0sYUFBYSxHQUFHLFFBQVEsRUFBRSxVQUFVLEVBQUUsT0FBTyxDQUFDO1FBQ3BELElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFLENBQUM7WUFDMUIsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELE9BQU87WUFDTixLQUFLLEVBQUUsbUJBQW1CLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQztZQUNsRCxNQUFNLEVBQUUsYUFBYSxDQUFDLElBQUk7WUFDMUIsT0FBTyxFQUFFLGFBQWEsQ0FBQyxPQUFPO1NBQzlCLENBQUM7SUFDSCxDQUFDO0NBQ0QsQ0FBQTtBQWxDSyxzQkFBc0I7SUFPekIsV0FBQSxnQkFBZ0IsQ0FBQTtHQVBiLHNCQUFzQixDQWtDM0I7QUFFRCxTQUFTLGtCQUFrQixDQUFDLEdBQVk7SUFDdkMsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksWUFBWSxJQUFJLEdBQUcsQ0FBQztBQUM3QyxDQUFDIn0=