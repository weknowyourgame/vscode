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
var GlobalCompositeBar_1;
import { localize } from '../../../nls.js';
import { ActionBar } from '../../../base/browser/ui/actionbar/actionbar.js';
import { ACCOUNTS_ACTIVITY_ID, GLOBAL_ACTIVITY_ID } from '../../common/activity.js';
import { IActivityService } from '../../services/activity/common/activity.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { DisposableStore, Disposable } from '../../../base/common/lifecycle.js';
import { IThemeService } from '../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../platform/storage/common/storage.js';
import { IExtensionService } from '../../services/extensions/common/extensions.js';
import { CompositeBarActionViewItem, CompositeBarAction } from './compositeBarActions.js';
import { Codicon } from '../../../base/common/codicons.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { registerIcon } from '../../../platform/theme/common/iconRegistry.js';
import { Action, Separator, SubmenuAction, toAction } from '../../../base/common/actions.js';
import { IMenuService, MenuId } from '../../../platform/actions/common/actions.js';
import { addDisposableListener, EventType, append, clearNode, hide, show, EventHelper, $, runWhenWindowIdle, getWindow } from '../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../base/browser/keyboardEvent.js';
import { StandardMouseEvent } from '../../../base/browser/mouseEvent.js';
import { EventType as TouchEventType } from '../../../base/browser/touch.js';
import { Lazy } from '../../../base/common/lazy.js';
import { getActionBarActions } from '../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../platform/keybinding/common/keybinding.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { IProductService } from '../../../platform/product/common/productService.js';
import { ISecretStorageService } from '../../../platform/secrets/common/secrets.js';
import { getCurrentAuthenticationSessionInfo } from '../../services/authentication/browser/authenticationService.js';
import { IAuthenticationService, INTERNAL_AUTH_PROVIDER_PREFIX } from '../../services/authentication/common/authentication.js';
import { IWorkbenchEnvironmentService } from '../../services/environment/common/environmentService.js';
import { IHoverService } from '../../../platform/hover/browser/hover.js';
import { ILifecycleService } from '../../services/lifecycle/common/lifecycle.js';
import { IUserDataProfileService } from '../../services/userDataProfile/common/userDataProfile.js';
import { DEFAULT_ICON } from '../../services/userDataProfile/common/userDataProfileIcons.js';
import { isString } from '../../../base/common/types.js';
import { ACTIVITY_BAR_BADGE_BACKGROUND, ACTIVITY_BAR_BADGE_FOREGROUND } from '../../common/theme.js';
import { ICommandService } from '../../../platform/commands/common/commands.js';
let GlobalCompositeBar = class GlobalCompositeBar extends Disposable {
    static { GlobalCompositeBar_1 = this; }
    static { this.ACCOUNTS_ACTION_INDEX = 0; }
    static { this.ACCOUNTS_ICON = registerIcon('accounts-view-bar-icon', Codicon.account, localize('accountsViewBarIcon', "Accounts icon in the view bar.")); }
    constructor(contextMenuActionsProvider, colors, activityHoverOptions, configurationService, instantiationService, storageService, extensionService) {
        super();
        this.contextMenuActionsProvider = contextMenuActionsProvider;
        this.colors = colors;
        this.activityHoverOptions = activityHoverOptions;
        this.instantiationService = instantiationService;
        this.storageService = storageService;
        this.extensionService = extensionService;
        this.globalActivityAction = this._register(new Action(GLOBAL_ACTIVITY_ID));
        this.accountAction = this._register(new Action(ACCOUNTS_ACTIVITY_ID));
        this.element = $('div');
        const contextMenuAlignmentOptions = () => ({
            anchorAlignment: configurationService.getValue('workbench.sideBar.location') === 'left' ? 1 /* AnchorAlignment.RIGHT */ : 0 /* AnchorAlignment.LEFT */,
            anchorAxisAlignment: 1 /* AnchorAxisAlignment.HORIZONTAL */
        });
        this.globalActivityActionBar = this._register(new ActionBar(this.element, {
            actionViewItemProvider: (action, options) => {
                if (action.id === GLOBAL_ACTIVITY_ID) {
                    return this.instantiationService.createInstance(GlobalActivityActionViewItem, this.contextMenuActionsProvider, { ...options, colors: this.colors, hoverOptions: this.activityHoverOptions }, contextMenuAlignmentOptions);
                }
                if (action.id === ACCOUNTS_ACTIVITY_ID) {
                    return this.instantiationService.createInstance(AccountsActivityActionViewItem, this.contextMenuActionsProvider, {
                        ...options,
                        colors: this.colors,
                        hoverOptions: this.activityHoverOptions
                    }, contextMenuAlignmentOptions, (actions) => {
                        actions.unshift(...[
                            toAction({ id: 'hideAccounts', label: localize('hideAccounts', "Hide Accounts"), run: () => setAccountsActionVisible(storageService, false) }),
                            new Separator()
                        ]);
                    });
                }
                throw new Error(`No view item for action '${action.id}'`);
            },
            orientation: 1 /* ActionsOrientation.VERTICAL */,
            ariaLabel: localize('manage', "Manage"),
            preventLoopNavigation: true
        }));
        if (this.accountsVisibilityPreference) {
            this.globalActivityActionBar.push(this.accountAction, { index: GlobalCompositeBar_1.ACCOUNTS_ACTION_INDEX });
        }
        this.globalActivityActionBar.push(this.globalActivityAction);
        this.registerListeners();
    }
    registerListeners() {
        this.extensionService.whenInstalledExtensionsRegistered().then(() => {
            if (!this._store.isDisposed) {
                this._register(this.storageService.onDidChangeValue(0 /* StorageScope.PROFILE */, AccountsActivityActionViewItem.ACCOUNTS_VISIBILITY_PREFERENCE_KEY, this._store)(() => this.toggleAccountsActivity()));
            }
        });
    }
    create(parent) {
        parent.appendChild(this.element);
    }
    focus() {
        this.globalActivityActionBar.focus(true);
    }
    size() {
        return this.globalActivityActionBar.viewItems.length;
    }
    getContextMenuActions() {
        return [toAction({ id: 'toggleAccountsVisibility', label: localize('accounts', "Accounts"), checked: this.accountsVisibilityPreference, run: () => this.accountsVisibilityPreference = !this.accountsVisibilityPreference })];
    }
    toggleAccountsActivity() {
        if (this.globalActivityActionBar.length() === 2 && this.accountsVisibilityPreference) {
            return;
        }
        if (this.globalActivityActionBar.length() === 2) {
            this.globalActivityActionBar.pull(GlobalCompositeBar_1.ACCOUNTS_ACTION_INDEX);
        }
        else {
            this.globalActivityActionBar.push(this.accountAction, { index: GlobalCompositeBar_1.ACCOUNTS_ACTION_INDEX });
        }
    }
    get accountsVisibilityPreference() {
        return isAccountsActionVisible(this.storageService);
    }
    set accountsVisibilityPreference(value) {
        setAccountsActionVisible(this.storageService, value);
    }
};
GlobalCompositeBar = GlobalCompositeBar_1 = __decorate([
    __param(3, IConfigurationService),
    __param(4, IInstantiationService),
    __param(5, IStorageService),
    __param(6, IExtensionService)
], GlobalCompositeBar);
export { GlobalCompositeBar };
let AbstractGlobalActivityActionViewItem = class AbstractGlobalActivityActionViewItem extends CompositeBarActionViewItem {
    constructor(menuId, action, options, contextMenuActionsProvider, contextMenuAlignmentOptions, themeService, hoverService, menuService, contextMenuService, contextKeyService, configurationService, keybindingService, activityService) {
        super(action, { draggable: false, icon: true, hasPopup: true, ...options }, () => true, themeService, hoverService, configurationService, keybindingService);
        this.menuId = menuId;
        this.contextMenuActionsProvider = contextMenuActionsProvider;
        this.contextMenuAlignmentOptions = contextMenuAlignmentOptions;
        this.menuService = menuService;
        this.contextMenuService = contextMenuService;
        this.contextKeyService = contextKeyService;
        this.activityService = activityService;
        this.updateItemActivity();
        this._register(this.activityService.onDidChangeActivity(viewContainerOrAction => {
            if (isString(viewContainerOrAction) && viewContainerOrAction === this.compositeBarActionItem.id) {
                this.updateItemActivity();
            }
        }));
    }
    updateItemActivity() {
        this.action.activities = this.activityService.getActivity(this.compositeBarActionItem.id);
    }
    render(container) {
        super.render(container);
        this._register(addDisposableListener(this.container, EventType.MOUSE_DOWN, async (e) => {
            EventHelper.stop(e, true);
            const isLeftClick = e?.button !== 2;
            // Left-click run
            if (isLeftClick) {
                this.run();
            }
        }));
        // The rest of the activity bar uses context menu event for the context menu, so we match this
        this._register(addDisposableListener(this.container, EventType.CONTEXT_MENU, async (e) => {
            // Let the item decide on the context menu instead of the toolbar
            e.stopPropagation();
            const disposables = new DisposableStore();
            const actions = await this.resolveContextMenuActions(disposables);
            const event = new StandardMouseEvent(getWindow(this.container), e);
            this.contextMenuService.showContextMenu({
                getAnchor: () => event,
                getActions: () => actions,
                onHide: () => disposables.dispose()
            });
        }));
        this._register(addDisposableListener(this.container, EventType.KEY_UP, (e) => {
            const event = new StandardKeyboardEvent(e);
            if (event.equals(3 /* KeyCode.Enter */) || event.equals(10 /* KeyCode.Space */)) {
                EventHelper.stop(e, true);
                this.run();
            }
        }));
        this._register(addDisposableListener(this.container, TouchEventType.Tap, (e) => {
            EventHelper.stop(e, true);
            this.run();
        }));
    }
    async resolveContextMenuActions(disposables) {
        return this.contextMenuActionsProvider();
    }
    async run() {
        const disposables = new DisposableStore();
        const menu = disposables.add(this.menuService.createMenu(this.menuId, this.contextKeyService));
        const actions = await this.resolveMainMenuActions(menu, disposables);
        const { anchorAlignment, anchorAxisAlignment } = this.contextMenuAlignmentOptions() ?? { anchorAlignment: undefined, anchorAxisAlignment: undefined };
        this.contextMenuService.showContextMenu({
            getAnchor: () => this.label,
            anchorAlignment,
            anchorAxisAlignment,
            getActions: () => actions,
            onHide: () => disposables.dispose(),
            menuActionOptions: { renderShortTitle: true },
        });
    }
    async resolveMainMenuActions(menu, _disposable) {
        return getActionBarActions(menu.getActions({ renderShortTitle: true })).secondary;
    }
};
AbstractGlobalActivityActionViewItem = __decorate([
    __param(5, IThemeService),
    __param(6, IHoverService),
    __param(7, IMenuService),
    __param(8, IContextMenuService),
    __param(9, IContextKeyService),
    __param(10, IConfigurationService),
    __param(11, IKeybindingService),
    __param(12, IActivityService)
], AbstractGlobalActivityActionViewItem);
let AccountsActivityActionViewItem = class AccountsActivityActionViewItem extends AbstractGlobalActivityActionViewItem {
    static { this.ACCOUNTS_VISIBILITY_PREFERENCE_KEY = 'workbench.activity.showAccounts'; }
    constructor(contextMenuActionsProvider, options, contextMenuAlignmentOptions, fillContextMenuActions, themeService, lifecycleService, hoverService, contextMenuService, menuService, contextKeyService, authenticationService, environmentService, productService, configurationService, keybindingService, secretStorageService, logService, activityService, instantiationService, commandService) {
        const action = instantiationService.createInstance(CompositeBarAction, {
            id: ACCOUNTS_ACTIVITY_ID,
            name: localize('accounts', "Accounts"),
            classNames: ThemeIcon.asClassNameArray(GlobalCompositeBar.ACCOUNTS_ICON)
        });
        super(MenuId.AccountsContext, action, options, contextMenuActionsProvider, contextMenuAlignmentOptions, themeService, hoverService, menuService, contextMenuService, contextKeyService, configurationService, keybindingService, activityService);
        this.fillContextMenuActions = fillContextMenuActions;
        this.lifecycleService = lifecycleService;
        this.authenticationService = authenticationService;
        this.productService = productService;
        this.secretStorageService = secretStorageService;
        this.logService = logService;
        this.commandService = commandService;
        this.groupedAccounts = new Map();
        this.problematicProviders = new Set();
        this.initialized = false;
        this.sessionFromEmbedder = new Lazy(() => getCurrentAuthenticationSessionInfo(this.secretStorageService, this.productService));
        this._register(action);
        this.registerListeners();
        this.initialize();
    }
    registerListeners() {
        this._register(this.authenticationService.onDidRegisterAuthenticationProvider(async (e) => {
            await this.addAccountsFromProvider(e.id);
        }));
        this._register(this.authenticationService.onDidUnregisterAuthenticationProvider((e) => {
            this.groupedAccounts.delete(e.id);
            this.problematicProviders.delete(e.id);
        }));
        this._register(this.authenticationService.onDidChangeSessions(async (e) => {
            if (e.event.removed) {
                for (const removed of e.event.removed) {
                    this.removeAccount(e.providerId, removed.account);
                }
            }
            for (const changed of [...(e.event.changed ?? []), ...(e.event.added ?? [])]) {
                try {
                    await this.addOrUpdateAccount(e.providerId, changed.account);
                }
                catch (e) {
                    this.logService.error(e);
                }
            }
        }));
    }
    // This function exists to ensure that the accounts are added for auth providers that had already been registered
    // before the menu was created.
    async initialize() {
        // Resolving the menu doesn't need to happen immediately, so we can wait until after the workbench has been restored
        // and only run this when the system is idle.
        await this.lifecycleService.when(3 /* LifecyclePhase.Restored */);
        if (this._store.isDisposed) {
            return;
        }
        const disposable = this._register(runWhenWindowIdle(getWindow(this.element), async () => {
            await this.doInitialize();
            disposable.dispose();
        }));
    }
    async doInitialize() {
        const providerIds = this.authenticationService.getProviderIds();
        const results = await Promise.allSettled(providerIds.map(providerId => this.addAccountsFromProvider(providerId)));
        // Log any errors that occurred while initializing. We try to be best effort here to show the most amount of accounts
        for (const result of results) {
            if (result.status === 'rejected') {
                this.logService.error(result.reason);
            }
        }
        this.initialized = true;
    }
    //#region overrides
    async resolveMainMenuActions(accountsMenu, disposables) {
        await super.resolveMainMenuActions(accountsMenu, disposables);
        const providers = this.authenticationService.getProviderIds().filter(p => !p.startsWith(INTERNAL_AUTH_PROVIDER_PREFIX));
        const otherCommands = accountsMenu.getActions();
        let menus = [];
        const registeredProviders = providers.filter(providerId => !this.authenticationService.isDynamicAuthenticationProvider(providerId));
        const dynamicProviders = providers.filter(providerId => this.authenticationService.isDynamicAuthenticationProvider(providerId));
        if (!this.initialized) {
            const noAccountsAvailableAction = disposables.add(new Action('noAccountsAvailable', localize('loading', "Loading..."), undefined, false));
            menus.push(noAccountsAvailableAction);
        }
        else {
            for (const providerId of registeredProviders) {
                const provider = this.authenticationService.getProvider(providerId);
                const accounts = this.groupedAccounts.get(providerId);
                if (!accounts) {
                    if (this.problematicProviders.has(providerId)) {
                        const providerUnavailableAction = disposables.add(new Action('providerUnavailable', localize('authProviderUnavailable', '{0} is currently unavailable', provider.label), undefined, false));
                        menus.push(providerUnavailableAction);
                        // try again in the background so that if the failure was intermittent, we can resolve it on the next showing of the menu
                        try {
                            await this.addAccountsFromProvider(providerId);
                        }
                        catch (e) {
                            this.logService.error(e);
                        }
                    }
                    continue;
                }
                const canUseMcp = !!provider.authorizationServers?.length;
                for (const account of accounts) {
                    const manageExtensionsAction = toAction({
                        id: `configureSessions${account.label}`,
                        label: localize('manageTrustedExtensions', "Manage Trusted Extensions"),
                        enabled: true,
                        run: () => this.commandService.executeCommand('_manageTrustedExtensionsForAccount', { providerId, accountLabel: account.label })
                    });
                    const providerSubMenuActions = [manageExtensionsAction];
                    if (canUseMcp) {
                        const manageMCPAction = toAction({
                            id: `configureSessions${account.label}`,
                            label: localize('manageTrustedMCPServers', "Manage Trusted MCP Servers"),
                            enabled: true,
                            run: () => this.commandService.executeCommand('_manageTrustedMCPServersForAccount', { providerId, accountLabel: account.label })
                        });
                        providerSubMenuActions.push(manageMCPAction);
                    }
                    if (account.canSignOut) {
                        providerSubMenuActions.push(toAction({
                            id: 'signOut',
                            label: localize('signOut', "Sign Out"),
                            enabled: true,
                            run: () => this.commandService.executeCommand('_signOutOfAccount', { providerId, accountLabel: account.label })
                        }));
                    }
                    const providerSubMenu = new SubmenuAction('activitybar.submenu', `${account.label} (${provider.label})`, providerSubMenuActions);
                    menus.push(providerSubMenu);
                }
            }
            if (dynamicProviders.length && registeredProviders.length) {
                menus.push(new Separator());
            }
            for (const providerId of dynamicProviders) {
                const provider = this.authenticationService.getProvider(providerId);
                const accounts = this.groupedAccounts.get(providerId);
                // Provide _some_ discoverable way to manage dynamic authentication providers.
                // This will either show up inside the account submenu or as a top-level menu item if there
                // are no accounts.
                const manageDynamicAuthProvidersAction = toAction({
                    id: 'manageDynamicAuthProviders',
                    label: localize('manageDynamicAuthProviders', "Manage Dynamic Authentication Providers..."),
                    enabled: true,
                    run: () => this.commandService.executeCommand('workbench.action.removeDynamicAuthenticationProviders')
                });
                if (!accounts) {
                    if (this.problematicProviders.has(providerId)) {
                        const providerUnavailableAction = disposables.add(new Action('providerUnavailable', localize('authProviderUnavailable', '{0} is currently unavailable', provider.label), undefined, false));
                        menus.push(providerUnavailableAction);
                        // try again in the background so that if the failure was intermittent, we can resolve it on the next showing of the menu
                        try {
                            await this.addAccountsFromProvider(providerId);
                        }
                        catch (e) {
                            this.logService.error(e);
                        }
                    }
                    menus.push(manageDynamicAuthProvidersAction);
                    continue;
                }
                for (const account of accounts) {
                    // TODO@TylerLeonhardt: Is there a nice way to bring this back?
                    // const manageExtensionsAction = toAction({
                    // 	id: `configureSessions${account.label}`,
                    // 	label: localize('manageTrustedExtensions', "Manage Trusted Extensions"),
                    // 	enabled: true,
                    // 	run: () => this.commandService.executeCommand('_manageTrustedExtensionsForAccount', { providerId, accountLabel: account.label })
                    // });
                    const providerSubMenuActions = [];
                    const manageMCPAction = toAction({
                        id: `configureSessions${account.label}`,
                        label: localize('manageTrustedMCPServers', "Manage Trusted MCP Servers"),
                        enabled: true,
                        run: () => this.commandService.executeCommand('_manageTrustedMCPServersForAccount', { providerId, accountLabel: account.label })
                    });
                    providerSubMenuActions.push(manageMCPAction);
                    providerSubMenuActions.push(manageDynamicAuthProvidersAction);
                    if (account.canSignOut) {
                        providerSubMenuActions.push(toAction({
                            id: 'signOut',
                            label: localize('signOut', "Sign Out"),
                            enabled: true,
                            run: () => this.commandService.executeCommand('_signOutOfAccount', { providerId, accountLabel: account.label })
                        }));
                    }
                    const providerSubMenu = new SubmenuAction('activitybar.submenu', `${account.label} (${provider.label})`, providerSubMenuActions);
                    menus.push(providerSubMenu);
                }
            }
        }
        if (menus.length && otherCommands.length) {
            menus.push(new Separator());
        }
        otherCommands.forEach((group, i) => {
            const actions = group[1];
            menus = menus.concat(actions);
            if (i !== otherCommands.length - 1) {
                menus.push(new Separator());
            }
        });
        return menus;
    }
    async resolveContextMenuActions(disposables) {
        const actions = await super.resolveContextMenuActions(disposables);
        this.fillContextMenuActions(actions);
        return actions;
    }
    //#endregion
    //#region groupedAccounts helpers
    async addOrUpdateAccount(providerId, account) {
        let accounts = this.groupedAccounts.get(providerId);
        if (!accounts) {
            accounts = [];
            this.groupedAccounts.set(providerId, accounts);
        }
        const sessionFromEmbedder = await this.sessionFromEmbedder.value;
        let canSignOut = true;
        if (sessionFromEmbedder // if we have a session from the embedder
            && !sessionFromEmbedder.canSignOut // and that session says we can't sign out
            && (await this.authenticationService.getSessions(providerId)) // and that session is associated with the account we are adding/updating
                .some(s => s.id === sessionFromEmbedder.id
                && s.account.id === account.id)) {
            canSignOut = false;
        }
        const existingAccount = accounts.find(a => a.label === account.label);
        if (existingAccount) {
            // if we have an existing account and we discover that we
            // can't sign out of it, update the account to mark it as "can't sign out"
            if (!canSignOut) {
                existingAccount.canSignOut = canSignOut;
            }
        }
        else {
            accounts.push({ ...account, canSignOut });
        }
    }
    removeAccount(providerId, account) {
        const accounts = this.groupedAccounts.get(providerId);
        if (!accounts) {
            return;
        }
        const index = accounts.findIndex(a => a.id === account.id);
        if (index === -1) {
            return;
        }
        accounts.splice(index, 1);
        if (accounts.length === 0) {
            this.groupedAccounts.delete(providerId);
        }
    }
    async addAccountsFromProvider(providerId) {
        try {
            const sessions = await this.authenticationService.getSessions(providerId);
            this.problematicProviders.delete(providerId);
            for (const session of sessions) {
                try {
                    await this.addOrUpdateAccount(providerId, session.account);
                }
                catch (e) {
                    this.logService.error(e);
                }
            }
        }
        catch (e) {
            this.logService.error(e);
            this.problematicProviders.add(providerId);
        }
    }
};
AccountsActivityActionViewItem = __decorate([
    __param(4, IThemeService),
    __param(5, ILifecycleService),
    __param(6, IHoverService),
    __param(7, IContextMenuService),
    __param(8, IMenuService),
    __param(9, IContextKeyService),
    __param(10, IAuthenticationService),
    __param(11, IWorkbenchEnvironmentService),
    __param(12, IProductService),
    __param(13, IConfigurationService),
    __param(14, IKeybindingService),
    __param(15, ISecretStorageService),
    __param(16, ILogService),
    __param(17, IActivityService),
    __param(18, IInstantiationService),
    __param(19, ICommandService)
], AccountsActivityActionViewItem);
export { AccountsActivityActionViewItem };
let GlobalActivityActionViewItem = class GlobalActivityActionViewItem extends AbstractGlobalActivityActionViewItem {
    constructor(contextMenuActionsProvider, options, contextMenuAlignmentOptions, userDataProfileService, themeService, hoverService, menuService, contextMenuService, contextKeyService, configurationService, environmentService, keybindingService, instantiationService, activityService) {
        const action = instantiationService.createInstance(CompositeBarAction, {
            id: GLOBAL_ACTIVITY_ID,
            name: localize('manage', "Manage"),
            classNames: ThemeIcon.asClassNameArray(userDataProfileService.currentProfile.icon ? ThemeIcon.fromId(userDataProfileService.currentProfile.icon) : DEFAULT_ICON)
        });
        super(MenuId.GlobalActivity, action, options, contextMenuActionsProvider, contextMenuAlignmentOptions, themeService, hoverService, menuService, contextMenuService, contextKeyService, configurationService, keybindingService, activityService);
        this.userDataProfileService = userDataProfileService;
        this._register(action);
        this._register(this.userDataProfileService.onDidChangeCurrentProfile(e => {
            action.compositeBarActionItem = {
                ...action.compositeBarActionItem,
                classNames: ThemeIcon.asClassNameArray(userDataProfileService.currentProfile.icon ? ThemeIcon.fromId(userDataProfileService.currentProfile.icon) : DEFAULT_ICON)
            };
        }));
    }
    render(container) {
        super.render(container);
        this.profileBadge = append(container, $('.profile-badge'));
        this.profileBadgeContent = append(this.profileBadge, $('.profile-badge-content'));
        this.updateProfileBadge();
    }
    updateProfileBadge() {
        if (!this.profileBadge || !this.profileBadgeContent) {
            return;
        }
        clearNode(this.profileBadgeContent);
        hide(this.profileBadge);
        if (this.userDataProfileService.currentProfile.isDefault) {
            return;
        }
        if (this.userDataProfileService.currentProfile.icon && this.userDataProfileService.currentProfile.icon !== DEFAULT_ICON.id) {
            return;
        }
        if (this.action.activities.length > 0) {
            return;
        }
        show(this.profileBadge);
        this.profileBadgeContent.classList.add('profile-text-overlay');
        this.profileBadgeContent.textContent = this.userDataProfileService.currentProfile.name.substring(0, 2).toUpperCase();
    }
    updateActivity() {
        super.updateActivity();
        this.updateProfileBadge();
    }
    computeTitle() {
        return this.userDataProfileService.currentProfile.isDefault ? super.computeTitle() : localize('manage profile', "Manage {0} (Profile)", this.userDataProfileService.currentProfile.name);
    }
};
GlobalActivityActionViewItem = __decorate([
    __param(3, IUserDataProfileService),
    __param(4, IThemeService),
    __param(5, IHoverService),
    __param(6, IMenuService),
    __param(7, IContextMenuService),
    __param(8, IContextKeyService),
    __param(9, IConfigurationService),
    __param(10, IWorkbenchEnvironmentService),
    __param(11, IKeybindingService),
    __param(12, IInstantiationService),
    __param(13, IActivityService)
], GlobalActivityActionViewItem);
export { GlobalActivityActionViewItem };
let SimpleAccountActivityActionViewItem = class SimpleAccountActivityActionViewItem extends AccountsActivityActionViewItem {
    constructor(hoverOptions, options, themeService, lifecycleService, hoverService, contextMenuService, menuService, contextKeyService, authenticationService, environmentService, productService, configurationService, keybindingService, secretStorageService, storageService, logService, activityService, instantiationService, commandService) {
        super(() => simpleActivityContextMenuActions(storageService, true), {
            ...options,
            colors: theme => ({
                badgeBackground: theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND),
                badgeForeground: theme.getColor(ACTIVITY_BAR_BADGE_FOREGROUND),
            }),
            hoverOptions,
            compact: true,
        }, () => undefined, actions => actions, themeService, lifecycleService, hoverService, contextMenuService, menuService, contextKeyService, authenticationService, environmentService, productService, configurationService, keybindingService, secretStorageService, logService, activityService, instantiationService, commandService);
    }
};
SimpleAccountActivityActionViewItem = __decorate([
    __param(2, IThemeService),
    __param(3, ILifecycleService),
    __param(4, IHoverService),
    __param(5, IContextMenuService),
    __param(6, IMenuService),
    __param(7, IContextKeyService),
    __param(8, IAuthenticationService),
    __param(9, IWorkbenchEnvironmentService),
    __param(10, IProductService),
    __param(11, IConfigurationService),
    __param(12, IKeybindingService),
    __param(13, ISecretStorageService),
    __param(14, IStorageService),
    __param(15, ILogService),
    __param(16, IActivityService),
    __param(17, IInstantiationService),
    __param(18, ICommandService)
], SimpleAccountActivityActionViewItem);
export { SimpleAccountActivityActionViewItem };
let SimpleGlobalActivityActionViewItem = class SimpleGlobalActivityActionViewItem extends GlobalActivityActionViewItem {
    constructor(hoverOptions, options, userDataProfileService, themeService, hoverService, menuService, contextMenuService, contextKeyService, configurationService, environmentService, keybindingService, instantiationService, activityService, storageService) {
        super(() => simpleActivityContextMenuActions(storageService, false), {
            ...options,
            colors: theme => ({
                badgeBackground: theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND),
                badgeForeground: theme.getColor(ACTIVITY_BAR_BADGE_FOREGROUND),
            }),
            hoverOptions,
            compact: true,
        }, () => undefined, userDataProfileService, themeService, hoverService, menuService, contextMenuService, contextKeyService, configurationService, environmentService, keybindingService, instantiationService, activityService);
    }
};
SimpleGlobalActivityActionViewItem = __decorate([
    __param(2, IUserDataProfileService),
    __param(3, IThemeService),
    __param(4, IHoverService),
    __param(5, IMenuService),
    __param(6, IContextMenuService),
    __param(7, IContextKeyService),
    __param(8, IConfigurationService),
    __param(9, IWorkbenchEnvironmentService),
    __param(10, IKeybindingService),
    __param(11, IInstantiationService),
    __param(12, IActivityService),
    __param(13, IStorageService)
], SimpleGlobalActivityActionViewItem);
export { SimpleGlobalActivityActionViewItem };
function simpleActivityContextMenuActions(storageService, isAccount) {
    const currentElementContextMenuActions = [];
    if (isAccount) {
        currentElementContextMenuActions.push(toAction({ id: 'hideAccounts', label: localize('hideAccounts', "Hide Accounts"), run: () => setAccountsActionVisible(storageService, false) }), new Separator());
    }
    return [
        ...currentElementContextMenuActions,
        toAction({ id: 'toggle.hideAccounts', label: localize('accounts', "Accounts"), checked: isAccountsActionVisible(storageService), run: () => setAccountsActionVisible(storageService, !isAccountsActionVisible(storageService)) }),
        toAction({ id: 'toggle.hideManage', label: localize('manage', "Manage"), checked: true, enabled: false, run: () => { throw new Error('"Manage" can not be hidden'); } })
    ];
}
export function isAccountsActionVisible(storageService) {
    return storageService.getBoolean(AccountsActivityActionViewItem.ACCOUNTS_VISIBILITY_PREFERENCE_KEY, 0 /* StorageScope.PROFILE */, true);
}
function setAccountsActionVisible(storageService, visible) {
    storageService.store(AccountsActivityActionViewItem.ACCOUNTS_VISIBILITY_PREFERENCE_KEY, visible, 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xvYmFsQ29tcG9zaXRlQmFyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9icm93c2VyL3BhcnRzL2dsb2JhbENvbXBvc2l0ZUJhci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzNDLE9BQU8sRUFBRSxTQUFTLEVBQXNCLE1BQU0saURBQWlELENBQUM7QUFDaEcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLGtCQUFrQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDcEYsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDOUUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNoRixPQUFPLEVBQWUsYUFBYSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDNUYsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSw2Q0FBNkMsQ0FBQztBQUMzRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNuRixPQUFPLEVBQUUsMEJBQTBCLEVBQUUsa0JBQWtCLEVBQWtGLE1BQU0sMEJBQTBCLENBQUM7QUFDMUssT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDOUUsT0FBTyxFQUFFLE1BQU0sRUFBVyxTQUFTLEVBQUUsYUFBYSxFQUFFLFFBQVEsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3RHLE9BQU8sRUFBUyxZQUFZ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