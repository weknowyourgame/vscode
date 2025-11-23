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
import { ButtonBar } from '../../../base/browser/ui/button/button.js';
import { createInstantHoverDelegate } from '../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { ActionRunner, SubmenuAction } from '../../../base/common/actions.js';
import { Codicon } from '../../../base/common/codicons.js';
import { Emitter } from '../../../base/common/event.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { localize } from '../../../nls.js';
import { getActionBarActions } from './menuEntryActionViewItem.js';
import { IMenuService, MenuItemAction } from '../common/actions.js';
import { IContextKeyService } from '../../contextkey/common/contextkey.js';
import { IContextMenuService } from '../../contextview/browser/contextView.js';
import { IHoverService } from '../../hover/browser/hover.js';
import { IKeybindingService } from '../../keybinding/common/keybinding.js';
import { ITelemetryService } from '../../telemetry/common/telemetry.js';
let WorkbenchButtonBar = class WorkbenchButtonBar extends ButtonBar {
    constructor(container, _options, _contextMenuService, _keybindingService, telemetryService, _hoverService) {
        super(container);
        this._options = _options;
        this._contextMenuService = _contextMenuService;
        this._keybindingService = _keybindingService;
        this._hoverService = _hoverService;
        this._store = new DisposableStore();
        this._updateStore = new DisposableStore();
        this._onDidChange = new Emitter();
        this.onDidChange = this._onDidChange.event;
        this._actionRunner = this._store.add(new ActionRunner());
        if (_options?.telemetrySource) {
            this._actionRunner.onDidRun(e => {
                telemetryService.publicLog2('workbenchActionExecuted', { id: e.action.id, from: _options.telemetrySource });
            }, undefined, this._store);
        }
    }
    dispose() {
        this._onDidChange.dispose();
        this._updateStore.dispose();
        this._store.dispose();
        super.dispose();
    }
    update(actions, secondary) {
        const conifgProvider = this._options?.buttonConfigProvider ?? (() => ({ showLabel: true }));
        this._updateStore.clear();
        this.clear();
        // Support instamt hover between buttons
        const hoverDelegate = this._updateStore.add(createInstantHoverDelegate());
        for (let i = 0; i < actions.length; i++) {
            const secondary = i > 0;
            const actionOrSubmenu = actions[i];
            let action;
            let btn;
            let tooltip = '';
            const kb = actionOrSubmenu instanceof SubmenuAction ? '' : this._keybindingService.lookupKeybinding(actionOrSubmenu.id);
            if (kb) {
                tooltip = localize('labelWithKeybinding', "{0} ({1})", actionOrSubmenu.tooltip || actionOrSubmenu.label, kb.getLabel());
            }
            else {
                tooltip = actionOrSubmenu.tooltip || actionOrSubmenu.label;
            }
            if (actionOrSubmenu instanceof SubmenuAction && actionOrSubmenu.actions.length > 0) {
                const [first, ...rest] = actionOrSubmenu.actions;
                action = first;
                btn = this.addButtonWithDropdown({
                    secondary: conifgProvider(action, i)?.isSecondary ?? secondary,
                    actionRunner: this._actionRunner,
                    actions: rest,
                    contextMenuProvider: this._contextMenuService,
                    ariaLabel: tooltip,
                    supportIcons: true,
                });
            }
            else {
                action = actionOrSubmenu;
                btn = this.addButton({
                    secondary: conifgProvider(action, i)?.isSecondary ?? secondary,
                    ariaLabel: tooltip,
                    supportIcons: true,
                });
            }
            btn.enabled = action.enabled;
            btn.checked = action.checked ?? false;
            btn.element.classList.add('default-colors');
            const showLabel = conifgProvider(action, i)?.showLabel ?? true;
            if (showLabel) {
                btn.label = action.label;
            }
            else {
                btn.element.classList.add('monaco-text-button');
            }
            if (conifgProvider(action, i)?.showIcon) {
                if (action instanceof MenuItemAction && ThemeIcon.isThemeIcon(action.item.icon)) {
                    if (!showLabel) {
                        btn.icon = action.item.icon;
                    }
                    else {
                        // this is REALLY hacky but combining a codicon and normal text is ugly because
                        // the former define a font which doesn't work for text
                        btn.label = `$(${action.item.icon.id}) ${action.label}`;
                    }
                }
                else if (action.class) {
                    btn.element.classList.add(...action.class.split(' '));
                }
            }
            this._updateStore.add(this._hoverService.setupManagedHover(hoverDelegate, btn.element, tooltip));
            this._updateStore.add(btn.onDidClick(async () => {
                this._actionRunner.run(action);
            }));
        }
        if (secondary.length > 0) {
            const btn = this.addButton({
                secondary: true,
                ariaLabel: localize('moreActions', "More Actions")
            });
            btn.icon = Codicon.dropDownButton;
            btn.element.classList.add('default-colors', 'monaco-text-button');
            btn.enabled = true;
            this._updateStore.add(this._hoverService.setupManagedHover(hoverDelegate, btn.element, localize('moreActions', "More Actions")));
            this._updateStore.add(btn.onDidClick(async () => {
                this._contextMenuService.showContextMenu({
                    getAnchor: () => btn.element,
                    getActions: () => secondary,
                    actionRunner: this._actionRunner,
                    onHide: () => btn.element.setAttribute('aria-expanded', 'false')
                });
                btn.element.setAttribute('aria-expanded', 'true');
            }));
        }
        this._onDidChange.fire(this);
    }
};
WorkbenchButtonBar = __decorate([
    __param(2, IContextMenuService),
    __param(3, IKeybindingService),
    __param(4, ITelemetryService),
    __param(5, IHoverService)
], WorkbenchButtonBar);
export { WorkbenchButtonBar };
let MenuWorkbenchButtonBar = class MenuWorkbenchButtonBar extends WorkbenchButtonBar {
    constructor(container, menuId, options, menuService, contextKeyService, contextMenuService, keybindingService, telemetryService, hoverService) {
        super(container, options, contextMenuService, keybindingService, telemetryService, hoverService);
        const menu = menuService.createMenu(menuId, contextKeyService);
        this._store.add(menu);
        const update = () => {
            this.clear();
            const actions = getActionBarActions(menu.getActions(options?.menuOptions), options?.toolbarOptions?.primaryGroup);
            super.update(actions.primary, actions.secondary);
        };
        this._store.add(menu.onDidChange(update));
        update();
    }
    dispose() {
        super.dispose();
    }
    update(_actions) {
        throw new Error('Use Menu or WorkbenchButtonBar');
    }
};
MenuWorkbenchButtonBar = __decorate([
    __param(3, IMenuService),
    __param(4, IContextKeyService),
    __param(5, IContextMenuService),
    __param(6, IKeybindingService),
    __param(7, ITelemetryService),
    __param(8, IHoverService)
], MenuWorkbenchButtonBar);
export { MenuWorkbenchButtonBar };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnV0dG9uYmFyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9idXR0b25iYXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFNBQVMsRUFBVyxNQUFNLDJDQUEyQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxZQUFZLEVBQTBCLGFBQWEsRUFBdUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMzSyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDM0QsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzNDLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRW5FLE9BQU8sRUFBVSxZQUFZLEVBQUUsY0FBYyxFQUFzQixNQUFNLHNCQUFzQixDQUFDO0FBQ2hHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUM3RCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQWFqRSxJQUFNLGtCQUFrQixHQUF4QixNQUFNLGtCQUFtQixT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