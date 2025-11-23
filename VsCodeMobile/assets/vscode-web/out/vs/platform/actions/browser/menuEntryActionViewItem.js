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
import { asCSSUrl } from '../../../base/browser/cssValue.js';
import { $, addDisposableListener, append, EventType, ModifierKeyEmitter, prepend } from '../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../base/browser/keyboardEvent.js';
import { ActionViewItem, BaseActionViewItem, SelectActionViewItem } from '../../../base/browser/ui/actionbar/actionViewItems.js';
import { DropdownMenuActionViewItem } from '../../../base/browser/ui/dropdown/dropdownActionViewItem.js';
import { SeparatorSelectOption } from '../../../base/browser/ui/selectBox/selectBox.js';
import { ActionRunner, Separator, SubmenuAction } from '../../../base/common/actions.js';
import { UILabelProvider } from '../../../base/common/keybindingLabels.js';
import { combinedDisposable, DisposableStore, MutableDisposable, toDisposable } from '../../../base/common/lifecycle.js';
import { isLinux, isWindows, OS } from '../../../base/common/platform.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { assertType } from '../../../base/common/types.js';
import { localize } from '../../../nls.js';
import { IAccessibilityService } from '../../accessibility/common/accessibility.js';
import { isICommandActionToggleInfo } from '../../action/common/action.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IContextKeyService } from '../../contextkey/common/contextkey.js';
import { IContextMenuService, IContextViewService } from '../../contextview/browser/contextView.js';
import { IInstantiationService } from '../../instantiation/common/instantiation.js';
import { IKeybindingService } from '../../keybinding/common/keybinding.js';
import { INotificationService } from '../../notification/common/notification.js';
import { IStorageService } from '../../storage/common/storage.js';
import { defaultSelectBoxStyles } from '../../theme/browser/defaultStyles.js';
import { asCssVariable, selectBorder } from '../../theme/common/colorRegistry.js';
import { isDark } from '../../theme/common/theme.js';
import { IThemeService } from '../../theme/common/themeService.js';
import { hasNativeContextMenu } from '../../window/common/window.js';
import { IMenuService, MenuItemAction, SubmenuItemAction } from '../common/actions.js';
import './menuEntryActionViewItem.css';
export function getContextMenuActions(groups, primaryGroup) {
    const target = { primary: [], secondary: [] };
    getContextMenuActionsImpl(groups, target, primaryGroup);
    return target;
}
export function getFlatContextMenuActions(groups, primaryGroup) {
    const target = [];
    getContextMenuActionsImpl(groups, target, primaryGroup);
    return target;
}
function getContextMenuActionsImpl(groups, target, primaryGroup) {
    const modifierKeyEmitter = ModifierKeyEmitter.getInstance();
    const useAlternativeActions = modifierKeyEmitter.keyStatus.altKey || ((isWindows || isLinux) && modifierKeyEmitter.keyStatus.shiftKey);
    fillInActions(groups, target, useAlternativeActions, primaryGroup ? actionGroup => actionGroup === primaryGroup : actionGroup => actionGroup === 'navigation');
}
export function getActionBarActions(groups, primaryGroup, shouldInlineSubmenu, useSeparatorsInPrimaryActions) {
    const target = { primary: [], secondary: [] };
    fillInActionBarActions(groups, target, primaryGroup, shouldInlineSubmenu, useSeparatorsInPrimaryActions);
    return target;
}
export function getFlatActionBarActions(groups, primaryGroup, shouldInlineSubmenu, useSeparatorsInPrimaryActions) {
    const target = [];
    fillInActionBarActions(groups, target, primaryGroup, shouldInlineSubmenu, useSeparatorsInPrimaryActions);
    return target;
}
export function fillInActionBarActions(groups, target, primaryGroup, shouldInlineSubmenu, useSeparatorsInPrimaryActions) {
    const isPrimaryAction = typeof primaryGroup === 'string' ? (actionGroup) => actionGroup === primaryGroup : primaryGroup;
    // Action bars handle alternative actions on their own so the alternative actions should be ignored
    fillInActions(groups, target, false, isPrimaryAction, shouldInlineSubmenu, useSeparatorsInPrimaryActions);
}
function fillInActions(groups, target, useAlternativeActions, isPrimaryAction = actionGroup => actionGroup === 'navigation', shouldInlineSubmenu = () => false, useSeparatorsInPrimaryActions = false) {
    let primaryBucket;
    let secondaryBucket;
    if (Array.isArray(target)) {
        primaryBucket = target;
        secondaryBucket = target;
    }
    else {
        primaryBucket = target.primary;
        secondaryBucket = target.secondary;
    }
    const submenuInfo = new Set();
    for (const [group, actions] of groups) {
        let target;
        if (isPrimaryAction(group)) {
            target = primaryBucket;
            if (target.length > 0 && useSeparatorsInPrimaryActions) {
                target.push(new Separator());
            }
        }
        else {
            target = secondaryBucket;
            if (target.length > 0) {
                target.push(new Separator());
            }
        }
        for (let action of actions) {
            if (useAlternativeActions) {
                action = action instanceof MenuItemAction && action.alt ? action.alt : action;
            }
            const newLen = target.push(action);
            // keep submenu info for later inlining
            if (action instanceof SubmenuAction) {
                submenuInfo.add({ group, action, index: newLen - 1 });
            }
        }
    }
    // ask the outside if submenu should be inlined or not. only ask when
    // there would be enough space
    for (const { group, action, index } of submenuInfo) {
        const target = isPrimaryAction(group) ? primaryBucket : secondaryBucket;
        // inlining submenus with length 0 or 1 is easy,
        // larger submenus need to be checked with the overall limit
        const submenuActions = action.actions;
        if (shouldInlineSubmenu(action, group, target.length)) {
            target.splice(index, 1, ...submenuActions);
        }
    }
}
let MenuEntryActionViewItem = class MenuEntryActionViewItem extends ActionViewItem {
    constructor(action, _options, _keybindingService, _notificationService, _contextKeyService, _themeService, _contextMenuService, _accessibilityService) {
        super(undefined, action, { icon: !!(action.class || action.item.icon), label: !action.class && !action.item.icon, draggable: _options?.draggable, keybinding: _options?.keybinding, hoverDelegate: _options?.hoverDelegate, keybindingNotRenderedWithLabel: _options?.keybindingNotRenderedWithLabel });
        this._options = _options;
        this._keybindingService = _keybindingService;
        this._notificationService = _notificationService;
        this._contextKeyService = _contextKeyService;
        this._themeService = _themeService;
        this._contextMenuService = _contextMenuService;
        this._accessibilityService = _accessibilityService;
        this._wantsAltCommand = false;
        this._itemClassDispose = this._register(new MutableDisposable());
        this._altKey = ModifierKeyEmitter.getInstance();
    }
    get _menuItemAction() {
        return this._action;
    }
    get _commandAction() {
        return this._wantsAltCommand && this._menuItemAction.alt || this._menuItemAction;
    }
    async onClick(event) {
        event.preventDefault();
        event.stopPropagation();
        try {
            await this.actionRunner.run(this._commandAction, this._context);
        }
        catch (err) {
            this._notificationService.error(err);
        }
    }
    render(container) {
        super.render(container);
        container.classList.add('menu-entry');
        if (this.options.icon) {
            this._updateItemClass(this._menuItemAction.item);
        }
        if (this._menuItemAction.alt) {
            let isMouseOver = false;
            const updateAltState = () => {
                const wantsAltCommand = !!this._menuItemAction.alt?.enabled &&
                    (!this._accessibilityService.isMotionReduced() || isMouseOver) && (this._altKey.keyStatus.altKey ||
                    (this._altKey.keyStatus.shiftKey && isMouseOver));
                if (wantsAltCommand !== this._wantsAltCommand) {
                    this._wantsAltCommand = wantsAltCommand;
                    this.updateLabel();
                    this.updateTooltip();
                    this.updateClass();
                }
            };
            this._register(this._altKey.event(updateAltState));
            this._register(addDisposableListener(container, 'mouseleave', _ => {
                isMouseOver = false;
                updateAltState();
            }));
            this._register(addDisposableListener(container, 'mouseenter', _ => {
                isMouseOver = true;
                updateAltState();
            }));
            updateAltState();
        }
    }
    updateLabel() {
        if (this.options.label && this.label) {
            this.label.textContent = this._commandAction.label;
        }
    }
    getTooltip() {
        const keybinding = this._keybindingService.lookupKeybinding(this._commandAction.id, this._contextKeyService);
        const keybindingLabel = keybinding && keybinding.getLabel();
        const tooltip = this._commandAction.tooltip || this._commandAction.label;
        let title = keybindingLabel
            ? localize('titleAndKb', "{0} ({1})", tooltip, keybindingLabel)
            : tooltip;
        if (!this._wantsAltCommand && this._menuItemAction.alt?.enabled) {
            const altTooltip = this._menuItemAction.alt.tooltip || this._menuItemAction.alt.label;
            const altKeybinding = this._keybindingService.lookupKeybinding(this._menuItemAction.alt.id, this._contextKeyService);
            const altKeybindingLabel = altKeybinding && altKeybinding.getLabel();
            const altTitleSection = altKeybindingLabel
                ? localize('titleAndKb', "{0} ({1})", altTooltip, altKeybindingLabel)
                : altTooltip;
            title = localize('titleAndKbAndAlt', "{0}\n[{1}] {2}", title, UILabelProvider.modifierLabels[OS].altKey, altTitleSection);
        }
        return title;
    }
    updateClass() {
        if (this.options.icon) {
            if (this._commandAction !== this._menuItemAction) {
                if (this._menuItemAction.alt) {
                    this._updateItemClass(this._menuItemAction.alt.item);
                }
            }
            else {
                this._updateItemClass(this._menuItemAction.item);
            }
        }
    }
    _updateItemClass(item) {
        this._itemClassDispose.value = undefined;
        const { element, label } = this;
        if (!element || !label) {
            return;
        }
        const icon = this._commandAction.checked && isICommandActionToggleInfo(item.toggled) && item.toggled.icon ? item.toggled.icon : item.icon;
        if (!icon) {
            return;
        }
        if (ThemeIcon.isThemeIcon(icon)) {
            // theme icons
            const iconClasses = ThemeIcon.asClassNameArray(icon);
            label.classList.add(...iconClasses);
            this._itemClassDispose.value = toDisposable(() => {
                label.classList.remove(...iconClasses);
            });
        }
        else {
            // icon path/url
            label.style.backgroundImage = (isDark(this._themeService.getColorTheme().type)
                ? asCSSUrl(icon.dark)
                : asCSSUrl(icon.light));
            label.classList.add('icon');
            this._itemClassDispose.value = combinedDisposable(toDisposable(() => {
                label.style.backgroundImage = '';
                label.classList.remove('icon');
            }), this._themeService.onDidColorThemeChange(() => {
                // refresh when the theme changes in case we go between dark <-> light
                this.updateClass();
            }));
        }
    }
};
MenuEntryActionViewItem = __decorate([
    __param(2, IKeybindingService),
    __param(3, INotificationService),
    __param(4, IContextKeyService),
    __param(5, IThemeService),
    __param(6, IContextMenuService),
    __param(7, IAccessibilityService)
], MenuEntryActionViewItem);
export { MenuEntryActionViewItem };
export class TextOnlyMenuEntryActionViewItem extends MenuEntryActionViewItem {
    render(container) {
        this.options.label = true;
        this.options.icon = false;
        super.render(container);
        container.classList.add('text-only');
        container.classList.toggle('use-comma', this._options?.useComma ?? false);
    }
    updateLabel() {
        const kb = this._keybindingService.lookupKeybinding(this._action.id, this._contextKeyService);
        if (!kb) {
            return super.updateLabel();
        }
        if (this.label) {
            const kb2 = TextOnlyMenuEntryActionViewItem._symbolPrintEnter(kb);
            if (this._options?.conversational) {
                this.label.textContent = localize({ key: 'content2', comment: ['A label with keybindg like "ESC to dismiss"'] }, '{1} to {0}', this._action.label, kb2);
            }
            else {
                this.label.textContent = localize({ key: 'content', comment: ['A label', 'A keybinding'] }, '{0} ({1})', this._action.label, kb2);
            }
        }
    }
    static _symbolPrintEnter(kb) {
        return kb.getLabel()
            ?.replace(/\benter\b/gi, '\u23CE')
            .replace(/\bEscape\b/gi, 'Esc');
    }
}
let SubmenuEntryActionViewItem = class SubmenuEntryActionViewItem extends DropdownMenuActionViewItem {
    constructor(action, options, _keybindingService, _contextMenuService, _themeService) {
        const dropdownOptions = {
            ...options,
            menuAsChild: options?.menuAsChild ?? false,
            classNames: options?.classNames ?? (ThemeIcon.isThemeIcon(action.item.icon) ? ThemeIcon.asClassName(action.item.icon) : undefined),
            keybindingProvider: options?.keybindingProvider ?? (action => _keybindingService.lookupKeybinding(action.id))
        };
        super(action, { getActions: () => action.actions }, _contextMenuService, dropdownOptions);
        this._keybindingService = _keybindingService;
        this._contextMenuService = _contextMenuService;
        this._themeService = _themeService;
    }
    render(container) {
        super.render(container);
        assertType(this.element);
        container.classList.add('menu-entry');
        const action = this._action;
        const { icon } = action.item;
        if (icon && !ThemeIcon.isThemeIcon(icon)) {
            this.element.classList.add('icon');
            const setBackgroundImage = () => {
                if (this.element) {
                    this.element.style.backgroundImage = (isDark(this._themeService.getColorTheme().type)
                        ? asCSSUrl(icon.dark)
                        : asCSSUrl(icon.light));
                }
            };
            setBackgroundImage();
            this._register(this._themeService.onDidColorThemeChange(() => {
                // refresh when the theme changes in case we go between dark <-> light
                setBackgroundImage();
            }));
        }
    }
};
SubmenuEntryActionViewItem = __decorate([
    __param(2, IKeybindingService),
    __param(3, IContextMenuService),
    __param(4, IThemeService)
], SubmenuEntryActionViewItem);
export { SubmenuEntryActionViewItem };
let DropdownWithDefaultActionViewItem = class DropdownWithDefaultActionViewItem extends BaseActionViewItem {
    get onDidChangeDropdownVisibility() {
        return this._dropdown.onDidChangeVisibility;
    }
    constructor(submenuAction, options, _keybindingService, _notificationService, _contextMenuService, _menuService, _instaService, _storageService) {
        super(null, submenuAction);
        this._keybindingService = _keybindingService;
        this._notificationService = _notificationService;
        this._contextMenuService = _contextMenuService;
        this._menuService = _menuService;
        this._instaService = _instaService;
        this._storageService = _storageService;
        this._defaultActionDisposables = this._register(new DisposableStore());
        this._container = null;
        this._options = options;
        this._storageKey = `${submenuAction.item.submenu.id}_lastActionId`;
        // determine default action
        let defaultAction;
        const defaultActionId = options?.togglePrimaryAction ? _storageService.get(this._storageKey, 1 /* StorageScope.WORKSPACE */) : undefined;
        if (defaultActionId) {
            defaultAction = submenuAction.actions.find(a => defaultActionId === a.id);
        }
        if (!defaultAction) {
            defaultAction = submenuAction.actions[0];
        }
        this._defaultAction = this._defaultActionDisposables.add(this._instaService.createInstance(MenuEntryActionViewItem, defaultAction, { keybinding: this._getDefaultActionKeybindingLabel(defaultAction) }));
        const dropdownOptions = {
            keybindingProvider: action => this._keybindingService.lookupKeybinding(action.id),
            ...options,
            menuAsChild: options?.menuAsChild ?? true,
            classNames: options?.classNames ?? ['codicon', 'codicon-chevron-down'],
            actionRunner: options?.actionRunner ?? this._register(new ActionRunner()),
        };
        this._dropdown = this._register(new DropdownMenuActionViewItem(submenuAction, submenuAction.actions, this._contextMenuService, dropdownOptions));
        if (options?.togglePrimaryAction) {
            this._register(this._dropdown.actionRunner.onDidRun((e) => {
                if (e.action instanceof MenuItemAction) {
                    this.update(e.action);
                }
            }));
        }
    }
    update(lastAction) {
        if (this._options?.togglePrimaryAction) {
            this._storageService.store(this._storageKey, lastAction.id, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        }
        this._defaultActionDisposables.clear();
        this._defaultAction = this._defaultActionDisposables.add(this._instaService.createInstance(MenuEntryActionViewItem, lastAction, { keybinding: this._getDefaultActionKeybindingLabel(lastAction) }));
        this._defaultAction.actionRunner = this._defaultActionDisposables.add(new class extends ActionRunner {
            async runAction(action, context) {
                await action.run(undefined);
            }
        }());
        if (this._container) {
            this._defaultAction.render(prepend(this._container, $('.action-container')));
        }
    }
    _getDefaultActionKeybindingLabel(defaultAction) {
        let defaultActionKeybinding;
        if (this._options?.renderKeybindingWithDefaultActionLabel) {
            const kb = this._keybindingService.lookupKeybinding(defaultAction.id);
            if (kb) {
                defaultActionKeybinding = `(${kb.getLabel()})`;
            }
        }
        return defaultActionKeybinding;
    }
    setActionContext(newContext) {
        super.setActionContext(newContext);
        this._defaultAction.setActionContext(newContext);
        this._dropdown.setActionContext(newContext);
    }
    set actionRunner(actionRunner) {
        super.actionRunner = actionRunner;
        this._defaultAction.actionRunner = actionRunner;
        this._dropdown.actionRunner = actionRunner;
    }
    get actionRunner() {
        return super.actionRunner;
    }
    render(container) {
        this._container = container;
        super.render(this._container);
        this._container.classList.add('monaco-dropdown-with-default');
        const primaryContainer = $('.action-container');
        this._defaultAction.render(append(this._container, primaryContainer));
        this._register(addDisposableListener(primaryContainer, EventType.KEY_DOWN, (e) => {
            const event = new StandardKeyboardEvent(e);
            if (event.equals(17 /* KeyCode.RightArrow */)) {
                this._defaultAction.element.tabIndex = -1;
                this._dropdown.focus();
                event.stopPropagation();
            }
        }));
        const dropdownContainer = $('.dropdown-action-container');
        this._dropdown.render(append(this._container, dropdownContainer));
        this._register(addDisposableListener(dropdownContainer, EventType.KEY_DOWN, (e) => {
            const event = new StandardKeyboardEvent(e);
            if (event.equals(15 /* KeyCode.LeftArrow */)) {
                this._defaultAction.element.tabIndex = 0;
                this._dropdown.setFocusable(false);
                this._defaultAction.element?.focus();
                event.stopPropagation();
            }
        }));
    }
    focus(fromRight) {
        if (fromRight) {
            this._dropdown.focus();
        }
        else {
            this._defaultAction.element.tabIndex = 0;
            this._defaultAction.element.focus();
        }
    }
    blur() {
        this._defaultAction.element.tabIndex = -1;
        this._dropdown.blur();
        this._container.blur();
    }
    setFocusable(focusable) {
        if (focusable) {
            this._defaultAction.element.tabIndex = 0;
        }
        else {
            this._defaultAction.element.tabIndex = -1;
            this._dropdown.setFocusable(false);
        }
    }
};
DropdownWithDefaultActionViewItem = __decorate([
    __param(2, IKeybindingService),
    __param(3, INotificationService),
    __param(4, IContextMenuService),
    __param(5, IMenuService),
    __param(6, IInstantiationService),
    __param(7, IStorageService)
], DropdownWithDefaultActionViewItem);
export { DropdownWithDefaultActionViewItem };
let SubmenuEntrySelectActionViewItem = class SubmenuEntrySelectActionViewItem extends SelectActionViewItem {
    constructor(action, contextViewService, configurationService) {
        super(null, action, action.actions.map(a => (a.id === Separator.ID ? SeparatorSelectOption : { text: a.label, isDisabled: !a.enabled, })), 0, contextViewService, defaultSelectBoxStyles, { ariaLabel: action.tooltip, optionsAsChildren: true, useCustomDrawn: !hasNativeContextMenu(configurationService) });
        this.select(Math.max(0, action.actions.findIndex(a => a.checked)));
    }
    render(container) {
        super.render(container);
        container.style.borderColor = asCssVariable(selectBorder);
    }
    runAction(option, index) {
        const action = this.action.actions[index];
        if (action) {
            this.actionRunner.run(action);
        }
    }
};
SubmenuEntrySelectActionViewItem = __decorate([
    __param(1, IContextViewService),
    __param(2, IConfigurationService)
], SubmenuEntrySelectActionViewItem);
/**
 * Creates action view items for menu actions or submenu actions.
 */
export function createActionViewItem(instaService, action, options) {
    if (action instanceof MenuItemAction) {
        return instaService.createInstance(MenuEntryActionViewItem, action, options);
    }
    else if (action instanceof SubmenuItemAction) {
        if (action.item.isSelection) {
            return instaService.createInstance(SubmenuEntrySelectActionViewItem, action);
        }
        else if (action.item.isSplitButton) {
            return instaService.createInstance(DropdownWithDefaultActionViewItem, action, {
                ...options,
                togglePrimaryAction: typeof action.item.isSplitButton !== 'boolean' ? action.item.isSplitButton.togglePrimaryAction : false,
            });
        }
        else {
            return instaService.createInstance(SubmenuEntryActionViewItem, action, options);
        }
    }
    else {
        return undefined;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsQ0FBQyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDeEgsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDL0UsT0FBTyxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ2pJLE9BQU8sRUFBRSwwQkFBMEIsRUFBc0MsTUFBTSw2REFBNkQsQ0FBQztBQUU3SSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUN4RixPQUFPLEVBQUUsWUFBWSxFQUFxQyxTQUFTLEVBQUUsYUFBYSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFFNUgsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRzNFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDekgsT0FBTyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMzRCxPQUFPLEVB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