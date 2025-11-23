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
import './media/menubarControl.css';
import { localize, localize2 } from '../../../../nls.js';
import { IMenuService, MenuId, SubmenuItemAction, registerAction2, Action2, MenuItemAction, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { getMenuBarVisibility, hasNativeMenu } from '../../../../platform/window/common/window.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { Action, SubmenuAction, Separator, ActionRunner, toAction } from '../../../../base/common/actions.js';
import { addDisposableListener, Dimension, EventType } from '../../../../base/browser/dom.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { isMacintosh, isWeb, isIOS, isNative } from '../../../../base/common/platform.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { isRecentFolder, isRecentWorkspace, IWorkspacesService } from '../../../../platform/workspaces/common/workspaces.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IUpdateService } from '../../../../platform/update/common/update.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { MenuBar } from '../../../../base/browser/ui/menu/menubar.js';
import { HorizontalDirection, VerticalDirection } from '../../../../base/browser/ui/menu/menu.js';
import { mnemonicMenuLabel, unmnemonicLabel } from '../../../../base/common/labels.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { isFullscreen, onDidChangeFullscreen } from '../../../../base/browser/browser.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { BrowserFeatures } from '../../../../base/browser/canIUse.js';
import { IsMacNativeContext, IsWebContext } from '../../../../platform/contextkey/common/contextkeys.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { OpenRecentAction } from '../../actions/windowActions.js';
import { isICommandActionToggleInfo } from '../../../../platform/action/common/action.js';
import { getFlatContextMenuActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { defaultMenuStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { mainWindow } from '../../../../base/browser/window.js';
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
    submenu: MenuId.MenubarFileMenu,
    title: {
        value: 'File',
        original: 'File',
        mnemonicTitle: localize({ key: 'mFile', comment: ['&& denotes a mnemonic'] }, "&&File"),
    },
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
    submenu: MenuId.MenubarEditMenu,
    title: {
        value: 'Edit',
        original: 'Edit',
        mnemonicTitle: localize({ key: 'mEdit', comment: ['&& denotes a mnemonic'] }, "&&Edit")
    },
    order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
    submenu: MenuId.MenubarSelectionMenu,
    title: {
        value: 'Selection',
        original: 'Selection',
        mnemonicTitle: localize({ key: 'mSelection', comment: ['&& denotes a mnemonic'] }, "&&Selection")
    },
    order: 3
});
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
    submenu: MenuId.MenubarViewMenu,
    title: {
        value: 'View',
        original: 'View',
        mnemonicTitle: localize({ key: 'mView', comment: ['&& denotes a mnemonic'] }, "&&View")
    },
    order: 4
});
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
    submenu: MenuId.MenubarGoMenu,
    title: {
        value: 'Go',
        original: 'Go',
        mnemonicTitle: localize({ key: 'mGoto', comment: ['&& denotes a mnemonic'] }, "&&Go")
    },
    order: 5
});
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
    submenu: MenuId.MenubarTerminalMenu,
    title: {
        value: 'Terminal',
        original: 'Terminal',
        mnemonicTitle: localize({ key: 'mTerminal', comment: ['&& denotes a mnemonic'] }, "&&Terminal")
    },
    order: 7
});
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
    submenu: MenuId.MenubarHelpMenu,
    title: {
        value: 'Help',
        original: 'Help',
        mnemonicTitle: localize({ key: 'mHelp', comment: ['&& denotes a mnemonic'] }, "&&Help")
    },
    order: 8
});
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
    submenu: MenuId.MenubarPreferencesMenu,
    title: {
        value: 'Preferences',
        original: 'Preferences',
        mnemonicTitle: localize({ key: 'mPreferences', comment: ['&& denotes a mnemonic'] }, "Preferences")
    },
    when: IsMacNativeContext,
    order: 9
});
export class MenubarControl extends Disposable {
    static { this.MAX_MENU_RECENT_ENTRIES = 10; }
    constructor(menuService, workspacesService, contextKeyService, keybindingService, configurationService, labelService, updateService, storageService, notificationService, preferencesService, environmentService, accessibilityService, hostService, commandService) {
        super();
        this.menuService = menuService;
        this.workspacesService = workspacesService;
        this.contextKeyService = contextKeyService;
        this.keybindingService = keybindingService;
        this.configurationService = configurationService;
        this.labelService = labelService;
        this.updateService = updateService;
        this.storageService = storageService;
        this.notificationService = notificationService;
        this.preferencesService = preferencesService;
        this.environmentService = environmentService;
        this.accessibilityService = accessibilityService;
        this.hostService = hostService;
        this.commandService = commandService;
        this.keys = [
            "window.menuBarVisibility" /* MenuSettings.MenuBarVisibility */,
            'window.enableMenuBarMnemonics',
            'window.customMenuBarAltFocus',
            'workbench.sideBar.location',
            'window.nativeTabs'
        ];
        this.menus = {};
        this.topLevelTitles = {};
        this.recentlyOpened = { files: [], workspaces: [] };
        this.mainMenu = this._register(this.menuService.createMenu(MenuId.MenubarMainMenu, this.contextKeyService));
        this.mainMenuDisposables = this._register(new DisposableStore());
        this.setupMainMenu();
        this.menuUpdater = this._register(new RunOnceScheduler(() => this.doUpdateMenubar(false), 200));
        this.notifyUserOfCustomMenubarAccessibility();
    }
    registerListeners() {
        // Listen for window focus changes
        this._register(this.hostService.onDidChangeFocus(e => this.onDidChangeWindowFocus(e)));
        // Update when config changes
        this._register(this.configurationService.onDidChangeConfiguration(e => this.onConfigurationUpdated(e)));
        // Listen to update service
        this._register(this.updateService.onStateChange(() => this.onUpdateStateChange()));
        // Listen for changes in recently opened menu
        this._register(this.workspacesService.onDidChangeRecentlyOpened(() => { this.onDidChangeRecentlyOpened(); }));
        // Listen to keybindings change
        this._register(this.keybindingService.onDidUpdateKeybindings(() => this.updateMenubar()));
        // Update recent menu items on formatter registration
        this._register(this.labelService.onDidChangeFormatters(() => { this.onDidChangeRecentlyOpened(); }));
        // Listen for changes on the main menu
        this._register(this.mainMenu.onDidChange(() => { this.setupMainMenu(); this.doUpdateMenubar(true); }));
    }
    setupMainMenu() {
        this.mainMenuDisposables.clear();
        this.menus = {};
        this.topLevelTitles = {};
        const [, mainMenuActions] = this.mainMenu.getActions()[0];
        for (const mainMenuAction of mainMenuActions) {
            if (mainMenuAction instanceof SubmenuItemAction && typeof mainMenuAction.item.title !== 'string') {
                this.menus[mainMenuAction.item.title.original] = this.mainMenuDisposables.add(this.menuService.createMenu(mainMenuAction.item.submenu, this.contextKeyService, { emitEventsForSubmenuChanges: true }));
                this.topLevelTitles[mainMenuAction.item.title.original] = mainMenuAction.item.title.mnemonicTitle ?? mainMenuAction.item.title.value;
            }
        }
    }
    updateMenubar() {
        this.menuUpdater.schedule();
    }
    calculateActionLabel(action) {
        const label = action.label;
        switch (action.id) {
            default:
                break;
        }
        return label;
    }
    onUpdateStateChange() {
        this.updateMenubar();
    }
    onUpdateKeybindings() {
        this.updateMenubar();
    }
    getOpenRecentActions() {
        if (!this.recentlyOpened) {
            return [];
        }
        const { workspaces, files } = this.recentlyOpened;
        const result = [];
        if (workspaces.length > 0) {
            for (let i = 0; i < MenubarControl.MAX_MENU_RECENT_ENTRIES && i < workspaces.length; i++) {
                result.push(this.createOpenRecentMenuAction(workspaces[i]));
            }
            result.push(new Separator());
        }
        if (files.length > 0) {
            for (let i = 0; i < MenubarControl.MAX_MENU_RECENT_ENTRIES && i < files.length; i++) {
                result.push(this.createOpenRecentMenuAction(files[i]));
            }
            result.push(new Separator());
        }
        return result;
    }
    onDidChangeWindowFocus(hasFocus) {
        // When we regain focus, update the recent menu items
        if (hasFocus) {
            this.onDidChangeRecentlyOpened();
        }
    }
    onConfigurationUpdated(event) {
        if (this.keys.some(key => event.affectsConfiguration(key))) {
            this.updateMenubar();
        }
        if (event.affectsConfiguration('editor.accessibilitySupport')) {
            this.notifyUserOfCustomMenubarAccessibility();
        }
        // Since we try not update when hidden, we should
        // try to update the recently opened list on visibility changes
        if (event.affectsConfiguration("window.menuBarVisibility" /* MenuSettings.MenuBarVisibility */)) {
            this.onDidChangeRecentlyOpened();
        }
    }
    get menubarHidden() {
        return isMacintosh && isNative ? false : getMenuBarVisibility(this.configurationService) === 'hidden';
    }
    onDidChangeRecentlyOpened() {
        // Do not update recently opened when the menubar is hidden #108712
        if (!this.menubarHidden) {
            this.workspacesService.getRecentlyOpened().then(recentlyOpened => {
                this.recentlyOpened = recentlyOpened;
                this.updateMenubar();
            });
        }
    }
    createOpenRecentMenuAction(recent) {
        let label;
        let uri;
        let commandId;
        let openable;
        const remoteAuthority = recent.remoteAuthority;
        if (isRecentFolder(recent)) {
            uri = recent.folderUri;
            label = recent.label || this.labelService.getWorkspaceLabel(uri, { verbose: 2 /* Verbosity.LONG */ });
            commandId = 'openRecentFolder';
            openable = { folderUri: uri };
        }
        else if (isRecentWorkspace(recent)) {
            uri = recent.workspace.configPath;
            label = recent.label || this.labelService.getWorkspaceLabel(recent.workspace, { verbose: 2 /* Verbosity.LONG */ });
            commandId = 'openRecentWorkspace';
            openable = { workspaceUri: uri };
        }
        else {
            uri = recent.fileUri;
            label = recent.label || this.labelService.getUriLabel(uri, { appendWorkspaceSuffix: true });
            commandId = 'openRecentFile';
            openable = { fileUri: uri };
        }
        const ret = toAction({
            id: commandId, label: unmnemonicLabel(label), run: (browserEvent) => {
                const openInNewWindow = browserEvent && ((!isMacintosh && (browserEvent.ctrlKey || browserEvent.shiftKey)) || (isMacintosh && (browserEvent.metaKey || browserEvent.altKey)));
                return this.hostService.openWindow([openable], {
                    forceNewWindow: !!openInNewWindow,
                    remoteAuthority: remoteAuthority || null // local window if remoteAuthority is not set or can not be deducted from the openable
                });
            }
        });
        return Object.assign(ret, { uri, remoteAuthority });
    }
    notifyUserOfCustomMenubarAccessibility() {
        if (isWeb || isMacintosh) {
            return;
        }
        const hasBeenNotified = this.storageService.getBoolean('menubar/accessibleMenubarNotified', -1 /* StorageScope.APPLICATION */, false);
        const usingCustomMenubar = !hasNativeMenu(this.configurationService);
        if (hasBeenNotified || usingCustomMenubar || !this.accessibilityService.isScreenReaderOptimized()) {
            return;
        }
        const message = localize('menubar.customTitlebarAccessibilityNotification', "Accessibility support is enabled for you. For the most accessible experience, we recommend the custom menu style.");
        this.notificationService.prompt(Severity.Info, message, [
            {
                label: localize('goToSetting', "Open Settings"),
                run: () => {
                    return this.preferencesService.openUserSettings({ query: "window.menuStyle" /* MenuSettings.MenuStyle */ });
                }
            }
        ]);
        this.storageService.store('menubar/accessibleMenubarNotified', true, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
    }
}
// This is a bit complex due to the issue https://github.com/microsoft/vscode/issues/205836
let focusMenuBarEmitter = undefined;
function enableFocusMenuBarAction() {
    if (!focusMenuBarEmitter) {
        focusMenuBarEmitter = new Emitter();
        registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: `workbench.actions.menubar.focus`,
                    title: localize2('focusMenu', 'Focus Application Menu'),
                    keybinding: {
                        primary: 512 /* KeyMod.Alt */ | 68 /* KeyCode.F10 */,
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                        when: IsWebContext
                    },
                    f1: true
                });
            }
            async run() {
                focusMenuBarEmitter?.fire();
            }
        });
    }
    return focusMenuBarEmitter;
}
let CustomMenubarControl = class CustomMenubarControl extends MenubarControl {
    constructor(menuService, workspacesService, contextKeyService, keybindingService, configurationService, labelService, updateService, storageService, notificationService, preferencesService, environmentService, accessibilityService, telemetryService, hostService, commandService) {
        super(menuService, workspacesService, contextKeyService, keybindingService, configurationService, labelService, updateService, storageService, notificationService, preferencesService, environmentService, accessibilityService, hostService, commandService);
        this.telemetryService = telemetryService;
        this.alwaysOnMnemonics = false;
        this.focusInsideMenubar = false;
        this.pendingFirstTimeUpdate = false;
        this.visible = true;
        this.webNavigationMenu = this._register(this.menuService.createMenu(MenuId.MenubarHomeMenu, this.contextKeyService));
        this.reinstallDisposables = this._register(new DisposableStore());
        this.updateActionsDisposables = this._register(new DisposableStore());
        this._onVisibilityChange = this._register(new Emitter());
        this._onFocusStateChange = this._register(new Emitter());
        this.actionRunner = this._register(new ActionRunner());
        this.actionRunner.onDidRun(e => {
            this.telemetryService.publicLog2('workbenchActionExecuted', { id: e.action.id, from: 'menu' });
        });
        this.workspacesService.getRecentlyOpened().then((recentlyOpened) => {
            this.recentlyOpened = recentlyOpened;
        });
        this.registerListeners();
    }
    doUpdateMenubar(firstTime) {
        if (!this.focusInsideMenubar) {
            this.setupCustomMenubar(firstTime);
        }
        if (firstTime) {
            this.pendingFirstTimeUpdate = true;
        }
    }
    getUpdateAction() {
        const state = this.updateService.state;
        switch (state.type) {
            case "idle" /* StateType.Idle */:
                return toAction({
                    id: 'update.check', label: localize({ key: 'checkForUpdates', comment: ['&& denotes a mnemonic'] }, "Check for &&Updates..."), enabled: true, run: () => this.updateService.checkForUpdates(true)
                });
            case "checking for updates" /* StateType.CheckingForUpdates */:
                return toAction({ id: 'update.checking', label: localize('checkingForUpdates', "Checking for Updates..."), enabled: false, run: () => { } });
            case "available for download" /* StateType.AvailableForDownload */:
                return toAction({
                    id: 'update.downloadNow', label: localize({ key: 'download now', comment: ['&& denotes a mnemonic'] }, "D&&ownload Update"), enabled: true, run: () => this.updateService.downloadUpdate()
                });
            case "downloading" /* StateType.Downloading */:
                return toAction({ id: 'update.downloading', label: localize('DownloadingUpdate', "Downloading Update..."), enabled: false, run: () => { } });
            case "downloaded" /* StateType.Downloaded */:
                return isMacintosh ? null : toAction({
                    id: 'update.install', label: localize({ key: 'installUpdate...', comment: ['&& denotes a mnemonic'] }, "Install &&Update..."), enabled: true, run: () => this.updateService.applyUpdate()
                });
            case "updating" /* StateType.Updating */:
                return toAction({ id: 'update.updating', label: localize('installingUpdate', "Installing Update..."), enabled: false, run: () => { } });
            case "ready" /* StateType.Ready */:
                return toAction({
                    id: 'update.restart', label: localize({ key: 'restartToUpdate', comment: ['&& denotes a mnemonic'] }, "Restart to &&Update"), enabled: true, run: () => this.updateService.quitAndInstall()
                });
            default:
                return null;
        }
    }
    get currentMenubarVisibility() {
        return getMenuBarVisibility(this.configurationService);
    }
    get currentDisableMenuBarAltFocus() {
        const settingValue = this.configurationService.getValue('window.customMenuBarAltFocus');
        let disableMenuBarAltBehavior = false;
        if (typeof settingValue === 'boolean') {
            disableMenuBarAltBehavior = !settingValue;
        }
        return disableMenuBarAltBehavior;
    }
    insertActionsBefore(nextAction, target) {
        switch (nextAction.id) {
            case OpenRecentAction.ID:
                target.push(...this.getOpenRecentActions());
                break;
            case 'workbench.action.showAboutDialog':
                if (!isMacintosh && !isWeb) {
                    const updateAction = this.getUpdateAction();
                    if (updateAction) {
                        updateAction.label = mnemonicMenuLabel(updateAction.label);
                        target.push(updateAction);
                        target.push(new Separator());
                    }
                }
                break;
            default:
                break;
        }
    }
    get currentEnableMenuBarMnemonics() {
        let enableMenuBarMnemonics = this.configurationService.getValue('window.enableMenuBarMnemonics');
        if (typeof enableMenuBarMnemonics !== 'boolean') {
            enableMenuBarMnemonics = true;
        }
        return enableMenuBarMnemonics && (!isWeb || isFullscreen(mainWindow));
    }
    get currentCompactMenuMode() {
        if (this.currentMenubarVisibility !== 'compact') {
            return undefined;
        }
        // Menu bar lives in activity bar and should flow based on its location
        const currentSidebarLocation = this.configurationService.getValue('workbench.sideBar.location');
        const horizontalDirection = currentSidebarLocation === 'right' ? HorizontalDirection.Left : HorizontalDirection.Right;
        const activityBarLocation = this.configurationService.getValue('workbench.activityBar.location');
        const verticalDirection = activityBarLocation === "bottom" /* ActivityBarPosition.BOTTOM */ ? VerticalDirection.Above : VerticalDirection.Below;
        return { horizontal: horizontalDirection, vertical: verticalDirection };
    }
    onDidVisibilityChange(visible) {
        this.visible = visible;
        this.onDidChangeRecentlyOpened();
        this._onVisibilityChange.fire(visible);
    }
    toActionsArray(menu) {
        return getFlatContextMenuActions(menu.getActions({ shouldForwardArgs: true }));
    }
    setupCustomMenubar(firstTime) {
        // If there is no container, we cannot setup the menubar
        if (!this.container) {
            return;
        }
        if (firstTime) {
            // Reset and create new menubar
            if (this.menubar) {
                this.reinstallDisposables.clear();
            }
            this.menubar = this.reinstallDisposables.add(new MenuBar(this.container, this.getMenuBarOptions(), defaultMenuStyles));
            this.accessibilityService.alwaysUnderlineAccessKeys().then(val => {
                this.alwaysOnMnemonics = val;
                this.menubar?.update(this.getMenuBarOptions());
            });
            this.reinstallDisposables.add(this.menubar.onFocusStateChange(focused => {
                this._onFocusStateChange.fire(focused);
                // When the menubar loses focus, update it to clear any pending updates
                if (!focused) {
                    if (this.pendingFirstTimeUpdate) {
                        this.setupCustomMenubar(true);
                        this.pendingFirstTimeUpdate = false;
                    }
                    else {
                        this.updateMenubar();
                    }
                    this.focusInsideMenubar = false;
                }
            }));
            this.reinstallDisposables.add(this.menubar.onVisibilityChange(e => this.onDidVisibilityChange(e)));
            // Before we focus the menubar, stop updates to it so that focus-related context keys will work
            this.reinstallDisposables.add(addDisposableListener(this.container, EventType.FOCUS_IN, () => {
                this.focusInsideMenubar = true;
            }));
            this.reinstallDisposables.add(addDisposableListener(this.container, EventType.FOCUS_OUT, () => {
                this.focusInsideMenubar = false;
            }));
            // Fire visibility change for the first install if menu is shown
            if (this.menubar.isVisible) {
                this.onDidVisibilityChange(true);
            }
        }
        else {
            this.menubar?.update(this.getMenuBarOptions());
        }
        // Update the menu actions
        const updateActions = (menuActions, target, topLevelTitle, store) => {
            target.splice(0);
            for (const menuItem of menuActions) {
                this.insertActionsBefore(menuItem, target);
                if (menuItem instanceof Separator) {
                    target.push(menuItem);
                }
                else if (menuItem instanceof SubmenuItemAction || menuItem instanceof MenuItemAction) {
                    // use mnemonicTitle whenever possible
                    let title = typeof menuItem.item.title === 'string'
                        ? menuItem.item.title
                        : menuItem.item.title.mnemonicTitle ?? menuItem.item.title.value;
                    if (menuItem instanceof SubmenuItemAction) {
                        const submenuActions = [];
                        updateActions(menuItem.actions, submenuActions, topLevelTitle, store);
                        if (submenuActions.length > 0) {
                            target.push(new SubmenuAction(menuItem.id, mnemonicMenuLabel(title), submenuActions));
                        }
                    }
                    else {
                        if (isICommandActionToggleInfo(menuItem.item.toggled)) {
                            title = menuItem.item.toggled.mnemonicTitle ?? menuItem.item.toggled.title ?? title;
                        }
                        const newAction = store.add(new Action(menuItem.id, mnemonicMenuLabel(title), menuItem.class, menuItem.enabled, () => this.commandService.executeCommand(menuItem.id)));
                        newAction.tooltip = menuItem.tooltip;
                        newAction.checked = menuItem.checked;
                        target.push(newAction);
                    }
                }
            }
            // Append web navigation menu items to the file menu when not compact
            if (topLevelTitle === 'File' && this.currentCompactMenuMode === undefined) {
                const webActions = this.getWebNavigationActions();
                if (webActions.length) {
                    target.push(...webActions);
                }
            }
        };
        for (const title of Object.keys(this.topLevelTitles)) {
            const menu = this.menus[title];
            if (firstTime && menu) {
                const menuChangedDisposable = this.reinstallDisposables.add(new DisposableStore());
                this.reinstallDisposables.add(menu.onDidChange(() => {
                    if (!this.focusInsideMenubar) {
                        const actions = [];
                        menuChangedDisposable.clear();
                        updateActions(this.toActionsArray(menu), actions, title, menuChangedDisposable);
                        this.menubar?.updateMenu({ actions, label: mnemonicMenuLabel(this.topLevelTitles[title]) });
                    }
                }));
                // For the file menu, we need to update if the web nav menu updates as well
                if (menu === this.menus.File) {
                    const webMenuChangedDisposable = this.reinstallDisposables.add(new DisposableStore());
                    this.reinstallDisposables.add(this.webNavigationMenu.onDidChange(() => {
                        if (!this.focusInsideMenubar) {
                            const actions = [];
                            webMenuChangedDisposable.clear();
                            updateActions(this.toActionsArray(menu), actions, title, webMenuChangedDisposable);
                            this.menubar?.updateMenu({ actions, label: mnemonicMenuLabel(this.topLevelTitles[title]) });
                        }
                    }));
                }
            }
            const actions = [];
            if (menu) {
                this.updateActionsDisposables.clear();
                updateActions(this.toActionsArray(menu), actions, title, this.updateActionsDisposables);
            }
            if (this.menubar) {
                if (!firstTime) {
                    this.menubar.updateMenu({ actions, label: mnemonicMenuLabel(this.topLevelTitles[title]) });
                }
                else {
                    this.menubar.push({ actions, label: mnemonicMenuLabel(this.topLevelTitles[title]) });
                }
            }
        }
    }
    getWebNavigationActions() {
        if (!isWeb) {
            return []; // only for web
        }
        const webNavigationActions = [];
        for (const groups of this.webNavigationMenu.getActions()) {
            const [, actions] = groups;
            for (const action of actions) {
                if (action instanceof MenuItemAction) {
                    const title = typeof action.item.title === 'string'
                        ? action.item.title
                        : action.item.title.mnemonicTitle ?? action.item.title.value;
                    webNavigationActions.push(toAction({
                        id: action.id, label: mnemonicMenuLabel(title), class: action.class, enabled: action.enabled, run: async (event) => {
                            this.commandService.executeCommand(action.id, event);
                        }
                    }));
                }
            }
            webNavigationActions.push(new Separator());
        }
        if (webNavigationActions.length) {
            webNavigationActions.pop();
        }
        return webNavigationActions;
    }
    getMenuBarOptions() {
        return {
            enableMnemonics: this.currentEnableMenuBarMnemonics,
            disableAltFocus: this.currentDisableMenuBarAltFocus,
            visibility: this.currentMenubarVisibility,
            actionRunner: this.actionRunner,
            getKeybinding: (action) => this.keybindingService.lookupKeybinding(action.id),
            alwaysOnMnemonics: this.alwaysOnMnemonics,
            compactMode: this.currentCompactMenuMode,
            getCompactMenuActions: () => {
                if (!isWeb) {
                    return []; // only for web
                }
                return this.getWebNavigationActions();
            }
        };
    }
    onDidChangeWindowFocus(hasFocus) {
        if (!this.visible) {
            return;
        }
        super.onDidChangeWindowFocus(hasFocus);
        if (this.container) {
            if (hasFocus) {
                this.container.classList.remove('inactive');
            }
            else {
                this.container.classList.add('inactive');
                this.menubar?.blur();
            }
        }
    }
    onUpdateStateChange() {
        if (!this.visible) {
            return;
        }
        super.onUpdateStateChange();
    }
    onDidChangeRecentlyOpened() {
        if (!this.visible) {
            return;
        }
        super.onDidChangeRecentlyOpened();
    }
    onUpdateKeybindings() {
        if (!this.visible) {
            return;
        }
        super.onUpdateKeybindings();
    }
    registerListeners() {
        super.registerListeners();
        this._register(addDisposableListener(mainWindow, EventType.RESIZE, () => {
            if (this.menubar && !(isIOS && BrowserFeatures.pointerEvents)) {
                this.menubar.blur();
            }
        }));
        // Mnemonics require fullscreen in web
        if (isWeb) {
            this._register(onDidChangeFullscreen(windowId => {
                if (windowId === mainWindow.vscodeWindowId) {
                    this.updateMenubar();
                }
            }));
            this._register(this.webNavigationMenu.onDidChange(() => this.updateMenubar()));
            this._register(enableFocusMenuBarAction().event(() => this.menubar?.toggleFocus()));
        }
    }
    get onVisibilityChange() {
        return this._onVisibilityChange.event;
    }
    get onFocusStateChange() {
        return this._onFocusStateChange.event;
    }
    getMenubarItemsDimensions() {
        if (this.menubar) {
            return new Dimension(this.menubar.getWidth(), this.menubar.getHeight());
        }
        return new Dimension(0, 0);
    }
    create(parent) {
        this.container = parent;
        // Build the menubar
        if (this.container) {
            this.doUpdateMenubar(true);
        }
        return this.container;
    }
    layout(dimension) {
        this.menubar?.update(this.getMenuBarOptions());
    }
    toggleFocus() {
        this.menubar?.toggleFocus();
    }
};
CustomMenubarControl = __decorate([
    __param(0, IMenuService),
    __param(1, IWorkspacesService),
    __param(2, IContextKeyService),
    __param(3, IKeybindingService),
    __param(4, IConfigurationService),
    __param(5, ILabelService),
    __param(6, IUpdateService),
    __param(7, IStorageService),
    __param(8, INotificationService),
    __param(9, IPreferencesService),
    __param(10, IWorkbenchEnvironmentService),
    __param(11, IAccessibilityService),
    __param(12, ITelemetryService),
    __param(13, IHostService),
    __param(14, ICommandService)
], CustomMenubarControl);
export { CustomMenubarControl };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVudWJhckNvbnRyb2wuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2Jyb3dzZXIvcGFydHMvdGl0bGViYXIvbWVudWJhckNvbnRyb2wudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyw0QkFBNEIsQ0FBQztBQUNwQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3pELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFTLGlCQUFpQixFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3hLLE9BQU8sRUFBc0Msb0JBQW9CLEVBQWdCLGFBQWEsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3JKLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzFGLE9BQU8sRUFBVyxNQUFNLEVBQUUsYUFBYSxFQUFFLFNBQVMsRUFBaUIsWUFBWSxFQUF1RSxRQUFRLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMzTSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzlGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMxRixPQUFPLEVBQUUscUJBQXFCLEVBQTZCLE1BQU0sNERBQTRELENBQUM7QUFDOUgsT0FBTyxFQUFTLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbkYs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