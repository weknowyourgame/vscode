/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ActionBar } from '../actionbar/actionbar.js';
import { DropdownMenuActionViewItem } from '../dropdown/dropdownActionViewItem.js';
import { Action, Separator, SubmenuAction } from '../../../common/actions.js';
import { Codicon } from '../../../common/codicons.js';
import { ThemeIcon } from '../../../common/themables.js';
import { EventMultiplexer } from '../../../common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../../common/lifecycle.js';
import './toolbar.css';
import * as nls from '../../../../nls.js';
import { createInstantHoverDelegate } from '../hover/hoverDelegateFactory.js';
const ACTION_MIN_WIDTH = 24; /* 20px codicon + 4px left padding*/
/**
 * A widget that combines an action bar for primary actions and a dropdown for secondary actions.
 */
export class ToolBar extends Disposable {
    get onDidChangeDropdownVisibility() { return this._onDidChangeDropdownVisibility.event; }
    constructor(container, contextMenuProvider, options = { orientation: 0 /* ActionsOrientation.HORIZONTAL */ }) {
        super();
        this.container = container;
        this.submenuActionViewItems = [];
        this.hasSecondaryActions = false;
        this._onDidChangeDropdownVisibility = this._register(new EventMultiplexer());
        this.originalPrimaryActions = [];
        this.originalSecondaryActions = [];
        this.hiddenActions = [];
        this.disposables = this._register(new DisposableStore());
        options.hoverDelegate = options.hoverDelegate ?? this._register(createInstantHoverDelegate());
        this.options = options;
        this.toggleMenuAction = this._register(new ToggleMenuAction(() => this.toggleMenuActionViewItem?.show(), options.toggleMenuTitle));
        this.element = document.createElement('div');
        this.element.className = 'monaco-toolbar';
        container.appendChild(this.element);
        this.actionBar = this._register(new ActionBar(this.element, {
            orientation: options.orientation,
            ariaLabel: options.ariaLabel,
            actionRunner: options.actionRunner,
            allowContextMenu: options.allowContextMenu,
            highlightToggledItems: options.highlightToggledItems,
            hoverDelegate: options.hoverDelegate,
            actionViewItemProvider: (action, viewItemOptions) => {
                if (action.id === ToggleMenuAction.ID) {
                    this.toggleMenuActionViewItem = new DropdownMenuActionViewItem(action, { getActions: () => this.toggleMenuAction.menuActions }, contextMenuProvider, {
                        actionViewItemProvider: this.options.actionViewItemProvider,
                        actionRunner: this.actionRunner,
                        keybindingProvider: this.options.getKeyBinding,
                        classNames: ThemeIcon.asClassNameArray(options.moreIcon ?? Codicon.toolBarMore),
                        anchorAlignmentProvider: this.options.anchorAlignmentProvider,
                        menuAsChild: !!this.options.renderDropdownAsChildElement,
                        skipTelemetry: this.options.skipTelemetry,
                        isMenu: true,
                        hoverDelegate: this.options.hoverDelegate
                    });
                    this.toggleMenuActionViewItem.setActionContext(this.actionBar.context);
                    this.disposables.add(this._onDidChangeDropdownVisibility.add(this.toggleMenuActionViewItem.onDidChangeVisibility));
                    return this.toggleMenuActionViewItem;
                }
                if (options.actionViewItemProvider) {
                    const result = options.actionViewItemProvider(action, viewItemOptions);
                    if (result) {
                        return result;
                    }
                }
                if (action instanceof SubmenuAction) {
                    const result = new DropdownMenuActionViewItem(action, action.actions, contextMenuProvider, {
                        actionViewItemProvider: this.options.actionViewItemProvider,
                        actionRunner: this.actionRunner,
                        keybindingProvider: this.options.getKeyBinding,
                        classNames: action.class,
                        anchorAlignmentProvider: this.options.anchorAlignmentProvider,
                        menuAsChild: !!this.options.renderDropdownAsChildElement,
                        skipTelemetry: this.options.skipTelemetry,
                        hoverDelegate: this.options.hoverDelegate
                    });
                    result.setActionContext(this.actionBar.context);
                    this.submenuActionViewItems.push(result);
                    this.disposables.add(this._onDidChangeDropdownVisibility.add(result.onDidChangeVisibility));
                    return result;
                }
                return undefined;
            }
        }));
        // Responsive support
        if (this.options.responsiveBehavior?.enabled) {
            this.element.classList.add('responsive');
            const observer = new ResizeObserver(() => {
                this.updateActions(this.element.getBoundingClientRect().width);
            });
            observer.observe(this.element);
            this._store.add(toDisposable(() => observer.disconnect()));
        }
    }
    set actionRunner(actionRunner) {
        this.actionBar.actionRunner = actionRunner;
    }
    get actionRunner() {
        return this.actionBar.actionRunner;
    }
    set context(context) {
        this.actionBar.context = context;
        this.toggleMenuActionViewItem?.setActionContext(context);
        for (const actionViewItem of this.submenuActionViewItems) {
            actionViewItem.setActionContext(context);
        }
    }
    getElement() {
        return this.element;
    }
    focus() {
        this.actionBar.focus();
    }
    getItemsWidth() {
        let itemsWidth = 0;
        for (let i = 0; i < this.actionBar.length(); i++) {
            itemsWidth += this.actionBar.getWidth(i);
        }
        return itemsWidth;
    }
    getItemAction(indexOrElement) {
        return this.actionBar.getAction(indexOrElement);
    }
    getItemWidth(index) {
        return this.actionBar.getWidth(index);
    }
    getItemsLength() {
        return this.actionBar.length();
    }
    setAriaLabel(label) {
        this.actionBar.setAriaLabel(label);
    }
    setActions(primaryActions, secondaryActions) {
        this.clear();
        // Store primary and secondary actions as rendered initially
        this.originalPrimaryActions = primaryActions ? primaryActions.slice(0) : [];
        this.originalSecondaryActions = secondaryActions ? secondaryActions.slice(0) : [];
        const primaryActionsToSet = primaryActions ? primaryActions.slice(0) : [];
        // Inject additional action to open secondary actions if present
        this.hasSecondaryActions = !!(secondaryActions && secondaryActions.length > 0);
        if (this.hasSecondaryActions && secondaryActions) {
            this.toggleMenuAction.menuActions = secondaryActions.slice(0);
            primaryActionsToSet.push(this.toggleMenuAction);
        }
        if (primaryActionsToSet.length > 0 && this.options.trailingSeparator) {
            primaryActionsToSet.push(new Separator());
        }
        primaryActionsToSet.forEach(action => {
            this.actionBar.push(action, { icon: this.options.icon ?? true, label: this.options.label ?? false, keybinding: this.getKeybindingLabel(action) });
        });
        if (this.options.responsiveBehavior?.enabled) {
            // Reset hidden actions
            this.hiddenActions.length = 0;
            // Set the minimum width
            if (this.options.responsiveBehavior?.minItems !== undefined) {
                let itemCount = this.options.responsiveBehavior.minItems;
                // Account for overflow menu
                if (this.originalSecondaryActions.length > 0 ||
                    itemCount < this.originalPrimaryActions.length) {
                    itemCount += 1;
                }
                this.container.style.minWidth = `${itemCount * ACTION_MIN_WIDTH}px`;
                this.element.style.minWidth = `${itemCount * ACTION_MIN_WIDTH}px`;
            }
            else {
                this.container.style.minWidth = `${ACTION_MIN_WIDTH}px`;
                this.element.style.minWidth = `${ACTION_MIN_WIDTH}px`;
            }
            // Update toolbar actions to fit with container width
            this.updateActions(this.element.getBoundingClientRect().width);
        }
    }
    isEmpty() {
        return this.actionBar.isEmpty();
    }
    getKeybindingLabel(action) {
        const key = this.options.getKeyBinding?.(action);
        return key?.getLabel() ?? undefined;
    }
    updateActions(containerWidth) {
        // Actions bar is empty
        if (this.actionBar.isEmpty()) {
            return;
        }
        // Each action is assumed to have a minimum width so that actions with a label
        // can shrink to the action's minimum width. We do this so that action visibility
        // takes precedence over the action label.
        const actionBarWidth = () => this.actionBar.length() * ACTION_MIN_WIDTH;
        // Action bar fits and there are no hidden actions to show
        if (actionBarWidth() <= containerWidth && this.hiddenActions.length === 0) {
            return;
        }
        if (actionBarWidth() > containerWidth) {
            // Check for max items limit
            if (this.options.responsiveBehavior?.minItems !== undefined) {
                const primaryActionsCount = this.actionBar.hasAction(this.toggleMenuAction)
                    ? this.actionBar.length() - 1
                    : this.actionBar.length();
                if (primaryActionsCount <= this.options.responsiveBehavior.minItems) {
                    return;
                }
            }
            // Hide actions from the right
            while (actionBarWidth() > containerWidth && this.actionBar.length() > 0) {
                const index = this.originalPrimaryActions.length - this.hiddenActions.length - 1;
                if (index < 0) {
                    break;
                }
                // Store the action and its size
                const size = Math.min(ACTION_MIN_WIDTH, this.getItemWidth(index));
                const action = this.originalPrimaryActions[index];
                this.hiddenActions.unshift({ action, size });
                // Remove the action
                this.actionBar.pull(index);
                // There are no secondary actions, but we have actions that we need to hide so we
                // create the overflow menu. This will ensure that another primary action will be
                // removed making space for the overflow menu.
                if (this.originalSecondaryActions.length === 0 && this.hiddenActions.length === 1) {
                    this.actionBar.push(this.toggleMenuAction, {
                        icon: this.options.icon ?? true,
                        label: this.options.label ?? false,
                        keybinding: this.getKeybindingLabel(this.toggleMenuAction),
                    });
                }
            }
        }
        else {
            // Show actions from the top of the toggle menu
            while (this.hiddenActions.length > 0) {
                const entry = this.hiddenActions.shift();
                if (actionBarWidth() + entry.size > containerWidth) {
                    // Not enough space to show the action
                    this.hiddenActions.unshift(entry);
                    break;
                }
                // Add the action
                this.actionBar.push(entry.action, {
                    icon: this.options.icon ?? true,
                    label: this.options.label ?? false,
                    keybinding: this.getKeybindingLabel(entry.action),
                    index: this.originalPrimaryActions.length - this.hiddenActions.length - 1
                });
                // There are no secondary actions, and there is only one hidden item left so we
                // remove the overflow menu making space for the last hidden action to be shown.
                if (this.originalSecondaryActions.length === 0 && this.hiddenActions.length === 1) {
                    this.toggleMenuAction.menuActions = [];
                    this.actionBar.pull(this.actionBar.length() - 1);
                }
            }
        }
        // Update overflow menu
        const hiddenActions = this.hiddenActions.map(entry => entry.action);
        if (this.originalSecondaryActions.length > 0 || hiddenActions.length > 0) {
            const secondaryActions = this.originalSecondaryActions.slice(0);
            this.toggleMenuAction.menuActions = Separator.join(hiddenActions, secondaryActions);
        }
    }
    clear() {
        this.submenuActionViewItems = [];
        this.disposables.clear();
        this.actionBar.clear();
    }
    dispose() {
        this.clear();
        this.disposables.dispose();
        super.dispose();
    }
}
export class ToggleMenuAction extends Action {
    static { this.ID = 'toolbar.toggle.more'; }
    constructor(toggleDropdownMenu, title) {
        title = title || nls.localize('moreActions', "More Actions...");
        super(ToggleMenuAction.ID, title, undefined, true);
        this._menuActions = [];
        this.toggleDropdownMenu = toggleDropdownMenu;
    }
    async run() {
        this.toggleDropdownMenu();
    }
    get menuActions() {
        return this._menuActions;
    }
    set menuActions(actions) {
        this._menuActions = actions;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9vbGJhci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2Jyb3dzZXIvdWkvdG9vbGJhci90b29sYmFyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxTQUFTLEVBQStDLE1BQU0sMkJBQTJCLENBQUM7QUFFbkcsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDbkYsT0FBTyxFQUFFLE1BQU0sRUFBMEIsU0FBUyxFQUFFLGFBQWEsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ3RHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDekQsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFFNUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDekYsT0FBTyxlQUFlLENBQUM7QUFDdkIsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUUxQyxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUU5RSxNQUFNLGdCQUFnQixHQUFHLEVBQUUsQ0FBQyxDQUFDLG9DQUFvQztBQXdDakU7O0dBRUc7QUFDSCxNQUFNLE9BQU8sT0FBUSxTQUFRLFVBQVU7SUFVdEMsSUFBSSw2QkFBNkIsS0FBSyxPQUFPLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBTXpGLFlBQTZCLFNBQXNCLEVBQUUsbUJBQXlDLEVBQUUsVUFBMkIsRUFBRSxXQUFXLHVDQUErQixFQUFFO1FBQ3hLLEtBQUssRUFBRSxDQUFDO1FBRG9CLGNBQVMsR0FBVCxTQUFTLENBQWE7UUFYM0MsMkJBQXNC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