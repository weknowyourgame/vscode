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
import { localize, localize2 } from '../../../../nls.js';
import { KeyChord } from '../../../../base/common/keyCodes.js';
import { MenuRegistry, MenuId, Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { equalsIgnoreCase } from '../../../../base/common/strings.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { IWorkbenchThemeService, ThemeSettings } from '../../../services/themes/common/workbenchThemeService.js';
import { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';
import { IExtensionGalleryService, IExtensionManagementService } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { Extensions as ColorRegistryExtensions } from '../../../../platform/theme/common/colorRegistry.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { Color } from '../../../../base/common/color.js';
import { ColorScheme, isHighContrast } from '../../../../platform/theme/common/theme.js';
import { colorThemeSchemaId } from '../../../services/themes/common/colorThemeSchema.js';
import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { DEFAULT_PRODUCT_ICON_THEME_ID, ProductIconThemeData } from '../../../services/themes/browser/productIconThemeData.js';
import { ThrottledDelayer } from '../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Emitter } from '../../../../base/common/event.js';
import { IExtensionResourceLoaderService } from '../../../../platform/extensionResourceLoader/common/extensionResourceLoader.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { FileIconThemeData } from '../../../services/themes/browser/fileIconThemeData.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { Toggle } from '../../../../base/browser/ui/toggle/toggle.js';
import { defaultToggleStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
export const manageExtensionIcon = registerIcon('theme-selection-manage-extension', Codicon.gear, localize('manageExtensionIcon', 'Icon for the \'Manage\' action in the theme selection quick pick.'));
var ConfigureItem;
(function (ConfigureItem) {
    ConfigureItem["BROWSE_GALLERY"] = "marketplace";
    ConfigureItem["EXTENSIONS_VIEW"] = "extensions";
    ConfigureItem["CUSTOM_TOP_ENTRY"] = "customTopEntry";
})(ConfigureItem || (ConfigureItem = {}));
let MarketplaceThemesPicker = class MarketplaceThemesPicker {
    constructor(getMarketplaceColorThemes, marketplaceQuery, extensionGalleryService, extensionManagementService, quickInputService, logService, progressService, extensionsWorkbenchService, dialogService) {
        this.getMarketplaceColorThemes = getMarketplaceColorThemes;
        this.marketplaceQuery = marketplaceQuery;
        this.extensionGalleryService = extensionGalleryService;
        this.extensionManagementService = extensionManagementService;
        this.quickInputService = quickInputService;
        this.logService = logService;
        this.progressService = progressService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.dialogService = dialogService;
        this._marketplaceExtensions = new Set();
        this._marketplaceThemes = [];
        this._searchOngoing = false;
        this._searchError = undefined;
        this._onDidChange = new Emitter();
        this._queryDelayer = new ThrottledDelayer(200);
        this._installedExtensions = extensionManagementService.getInstalled().then(installed => {
            const result = new Set();
            for (const ext of installed) {
                result.add(ext.identifier.id);
            }
            return result;
        });
    }
    get themes() {
        return this._marketplaceThemes;
    }
    get onDidChange() {
        return this._onDidChange.event;
    }
    trigger(value) {
        if (this._tokenSource) {
            this._tokenSource.cancel();
            this._tokenSource = undefined;
        }
        this._queryDelayer.trigger(() => {
            this._tokenSource = new CancellationTokenSource();
            return this.doSearch(value, this._tokenSource.token);
        });
    }
    async doSearch(value, token) {
        this._searchOngoing = true;
        this._onDidChange.fire();
        try {
            const installedExtensions = await this._installedExtensions;
            const options = { text: `${this.marketplaceQuery} ${value}`, pageSize: 20 };
            const pager = await this.extensionGalleryService.query(options, token);
            for (let i = 0; i < pager.total && i < 1; i++) { // loading multiple pages is turned of for now to avoid flickering
                if (token.isCancellationRequested) {
                    break;
                }
                const nThemes = this._marketplaceThemes.length;
                const gallery = i === 0 ? pager.firstPage : await pager.getPage(i, token);
                const promises = [];
                const promisesGalleries = [];
                for (let i = 0; i < gallery.length; i++) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    const ext = gallery[i];
                    if (!installedExtensions.has(ext.identifier.id) && !this._marketplaceExtensions.has(ext.identifier.id)) {
                        this._marketplaceExtensions.add(ext.identifier.id);
                        promises.push(this.getMarketplaceColorThemes(ext.publisher, ext.name, ext.version));
                        promisesGalleries.push(ext);
                    }
                }
                const allThemes = await Promise.all(promises);
                for (let i = 0; i < allThemes.length; i++) {
                    const ext = promisesGalleries[i];
                    for (const theme of allThemes[i]) {
                        this._marketplaceThemes.push({ id: theme.id, theme: theme, label: theme.label, description: `${ext.displayName} · ${ext.publisherDisplayName}`, galleryExtension: ext, buttons: [configureButton] });
                    }
                }
                if (nThemes !== this._marketplaceThemes.length) {
                    this._marketplaceThemes.sort((t1, t2) => t1.label.localeCompare(t2.label));
                    this._onDidChange.fire();
                }
            }
        }
        catch (e) {
            if (!isCancellationError(e)) {
                this.logService.error(`Error while searching for themes:`, e);
                this._searchError = 'message' in e ? e.message : String(e);
            }
        }
        finally {
            this._searchOngoing = false;
            this._onDidChange.fire();
        }
    }
    openQuickPick(value, currentTheme, selectTheme) {
        let result = undefined;
        const disposables = new DisposableStore();
        return new Promise((s, _) => {
            const quickpick = disposables.add(this.quickInputService.createQuickPick());
            quickpick.items = [];
            quickpick.sortByLabel = false;
            quickpick.matchOnDescription = true;
            quickpick.buttons = [this.quickInputService.backButton];
            quickpick.title = 'Marketplace Themes';
            quickpick.placeholder = localize('themes.selectMarketplaceTheme', "Type to Search More. Select to Install. Up/Down Keys to Preview");
            quickpick.canSelectMany = false;
            disposables.add(quickpick.onDidChangeValue(() => this.trigger(quickpick.value)));
            disposables.add(quickpick.onDidAccept(async (_) => {
                const themeItem = quickpick.selectedItems[0];
                if (themeItem?.galleryExtension) {
                    result = 'selected';
                    quickpick.hide();
                    const success = await this.installExtension(themeItem.galleryExtension);
                    if (success) {
                        selectTheme(themeItem.theme, true);
                    }
                    else {
                        selectTheme(currentTheme, true);
                    }
                }
            }));
            disposables.add(quickpick.onDidTriggerItemButton(e => {
                if (isItem(e.item)) {
                    const extensionId = e.item.theme?.extensionData?.extensionId;
                    if (extensionId) {
                        this.extensionsWorkbenchService.openSearch(`@id:${extensionId}`);
                    }
                    else {
                        this.extensionsWorkbenchService.openSearch(`${this.marketplaceQuery} ${quickpick.value}`);
                    }
                }
            }));
            disposables.add(quickpick.onDidChangeActive(themes => {
                if (result === undefined) {
                    selectTheme(themes[0]?.theme, false);
                }
            }));
            disposables.add(quickpick.onDidHide(() => {
                if (result === undefined) {
                    selectTheme(currentTheme, true);
                    result = 'cancelled';
                }
                s(result);
            }));
            disposables.add(quickpick.onDidTriggerButton(e => {
                if (e === this.quickInputService.backButton) {
                    result = 'back';
                    quickpick.hide();
                }
            }));
            disposables.add(this.onDidChange(() => {
                let items = this.themes;
                if (this._searchOngoing) {
                    items = items.concat({ label: '$(loading~spin) Searching for themes...', id: undefined, alwaysShow: true });
                }
                else if (items.length === 0 && this._searchError) {
                    items = [{ label: `$(error) ${localize('search.error', 'Error while searching for themes: {0}', this._searchError)}`, id: undefined, alwaysShow: true }];
                }
                const activeItemId = quickpick.activeItems[0]?.id;
                const newActiveItem = activeItemId ? items.find(i => isItem(i) && i.id === activeItemId) : undefined;
                quickpick.items = items;
                if (newActiveItem) {
                    quickpick.activeItems = [newActiveItem];
                }
            }));
            this.trigger(value);
            quickpick.show();
        }).finally(() => {
            disposables.dispose();
        });
    }
    async installExtension(galleryExtension) {
        this.extensionsWorkbenchService.openSearch(`@id:${galleryExtension.identifier.id}`);
        const result = await this.dialogService.confirm({
            message: localize('installExtension.confirm', "This will install extension '{0}' published by '{1}'. Do you want to continue?", galleryExtension.displayName, galleryExtension.publisherDisplayName),
            primaryButton: localize('installExtension.button.ok', "OK")
        });
        if (!result.confirmed) {
            return false;
        }
        try {
            await this.progressService.withProgress({
                location: 15 /* ProgressLocation.Notification */,
                title: localize('installing extensions', "Installing Extension {0}...", galleryExtension.displayName)
            }, async () => {
                await this.extensionManagementService.installFromGallery(galleryExtension, {
                    // Setting this to false is how you get the extension to be synced with Settings Sync (if enabled).
                    isMachineScoped: false,
                });
            });
            return true;
        }
        catch (e) {
            this.logService.error(`Problem installing extension ${galleryExtension.identifier.id}`, e);
            return false;
        }
    }
    dispose() {
        if (this._tokenSource) {
            this._tokenSource.cancel();
            this._tokenSource = undefined;
        }
        this._queryDelayer.dispose();
        this._marketplaceExtensions.clear();
        this._marketplaceThemes.length = 0;
        this._onDidChange.dispose();
    }
};
MarketplaceThemesPicker = __decorate([
    __param(2, IExtensionGalleryService),
    __param(3, IExtensionManagementService),
    __param(4, IQuickInputService),
    __param(5, ILogService),
    __param(6, IProgressService),
    __param(7, IExtensionsWorkbenchService),
    __param(8, IDialogService)
], MarketplaceThemesPicker);
let InstalledThemesPicker = class InstalledThemesPicker {
    constructor(options, setTheme, getMarketplaceColorThemes, quickInputService, extensionGalleryService, extensionsWorkbenchService, extensionResourceLoaderService, instantiationService) {
        this.options = options;
        this.setTheme = setTheme;
        this.getMarketplaceColorThemes = getMarketplaceColorThemes;
        this.quickInputService = quickInputService;
        this.extensionGalleryService = extensionGalleryService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionResourceLoaderService = extensionResourceLoaderService;
        this.instantiationService = instantiationService;
    }
    async openQuickPick(picks, currentTheme) {
        let marketplaceThemePicker;
        if (this.extensionGalleryService.isEnabled()) {
            if (await this.extensionResourceLoaderService.supportsExtensionGalleryResources() && this.options.browseMessage) {
                marketplaceThemePicker = this.instantiationService.createInstance(MarketplaceThemesPicker, this.getMarketplaceColorThemes.bind(this), this.options.marketplaceTag);
                picks = [configurationEntry(this.options.browseMessage, ConfigureItem.BROWSE_GALLERY), ...picks];
            }
            else {
                picks = [...picks, { type: 'separator' }, configurationEntry(this.options.installMessage, ConfigureItem.EXTENSIONS_VIEW)];
            }
        }
        let selectThemeTimeout;
        const selectTheme = (theme, applyTheme) => {
            if (selectThemeTimeout) {
                clearTimeout(selectThemeTimeout);
            }
            selectThemeTimeout = mainWindow.setTimeout(() => {
                selectThemeTimeout = undefined;
                const newTheme = (theme ?? currentTheme);
                this.setTheme(newTheme, applyTheme ? 'auto' : 'preview').then(undefined, err => {
                    onUnexpectedError(err);
                    this.setTheme(currentTheme, undefined);
                });
            }, applyTheme ? 0 : 200);
        };
        const pickInstalledThemes = (activeItemId) => {
            const disposables = new DisposableStore();
            return new Promise((s, _) => {
                let isCompleted = false;
                const autoFocusIndex = picks.findIndex(p => isItem(p) && p.id === activeItemId);
                const quickpick = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
                quickpick.items = picks;
                quickpick.title = this.options.title;
                quickpick.description = this.options.description;
                quickpick.placeholder = this.options.placeholderMessage;
                quickpick.activeItems = [picks[autoFocusIndex]];
                quickpick.canSelectMany = false;
                quickpick.toggles = this.options.toggles;
                quickpick.toggles?.forEach(toggle => {
                    disposables.add(toggle.onChange(() => this.options.onToggle?.(toggle, quickpick)));
                });
                quickpick.matchOnDescription = true;
                disposables.add(quickpick.onDidAccept(async (_) => {
                    isCompleted = true;
                    const theme = quickpick.selectedItems[0];
                    if (!theme || theme.configureItem) { // 'pick in marketplace' entry
                        if (!theme || theme.configureItem === ConfigureItem.EXTENSIONS_VIEW) {
                            this.extensionsWorkbenchService.openSearch(`${this.options.marketplaceTag} ${quickpick.value}`);
                        }
                        else if (theme.configureItem === ConfigureItem.BROWSE_GALLERY) {
                            if (marketplaceThemePicker) {
                                const res = await marketplaceThemePicker.openQuickPick(quickpick.value, currentTheme, selectTheme);
                                if (res === 'back') {
                                    await pickInstalledThemes(undefined);
                                }
                            }
                        }
                    }
                    else {
                        selectTheme(theme.theme, true);
                    }
                    quickpick.hide();
                    s();
                }));
                disposables.add(quickpick.onDidChangeActive(themes => selectTheme(themes[0]?.theme, false)));
                disposables.add(quickpick.onDidHide(() => {
                    if (!isCompleted) {
                        selectTheme(currentTheme, true);
                        s();
                    }
                    quickpick.dispose();
                }));
                disposables.add(quickpick.onDidTriggerItemButton(e => {
                    if (isItem(e.item)) {
                        const extensionId = e.item.theme?.extensionData?.extensionId;
                        if (extensionId) {
                            this.extensionsWorkbenchService.openSearch(`@id:${extensionId}`);
                        }
                        else {
                            this.extensionsWorkbenchService.openSearch(`${this.options.marketplaceTag} ${quickpick.value}`);
                        }
                    }
                }));
                quickpick.show();
            }).finally(() => {
                disposables.dispose();
            });
        };
        await pickInstalledThemes(currentTheme.id);
        marketplaceThemePicker?.dispose();
    }
};
InstalledThemesPicker = __decorate([
    __param(3, IQuickInputService),
    __param(4, IExtensionGalleryService),
    __param(5, IExtensionsWorkbenchService),
    __param(6, IExtensionResourceLoaderService),
    __param(7, IInstantiationService)
], InstalledThemesPicker);
const SelectColorThemeCommandId = 'workbench.action.selectTheme';
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: SelectColorThemeCommandId,
            title: localize2('selectTheme.label', 'Color Theme'),
            category: Categories.Preferences,
            f1: true,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 2048 /* KeyMod.CtrlCmd */ | 50 /* KeyCode.KeyT */)
            }
        });
    }
    getTitle(colorScheme) {
        switch (colorScheme) {
            case ColorScheme.DARK: return localize('themes.selectTheme.darkScheme', "Select Color Theme for System Dark Mode");
            case ColorScheme.LIGHT: return localize('themes.selectTheme.lightScheme', "Select Color Theme for System Light Mode");
            case ColorScheme.HIGH_CONTRAST_DARK: return localize('themes.selectTheme.darkHC', "Select Color Theme for High Contrast Dark Mode");
            case ColorScheme.HIGH_CONTRAST_LIGHT: return localize('themes.selectTheme.lightHC', "Select Color Theme for High Contrast Light Mode");
            default:
                return localize('themes.selectTheme.default', "Select Color Theme (detect system color mode disabled)");
        }
    }
    async run(accessor) {
        const themeService = accessor.get(IWorkbenchThemeService);
        const preferencesService = accessor.get(IPreferencesService);
        const preferredColorScheme = themeService.getPreferredColorScheme();
        let modeConfigureToggle;
        if (preferredColorScheme) {
            modeConfigureToggle = new Toggle({
                title: localize('themes.configure.switchingEnabled', 'Detect system color mode enabled. Click to configure.'),
                icon: Codicon.colorMode,
                isChecked: false,
                ...defaultToggleStyles
            });
        }
        else {
            modeConfigureToggle = new Toggle({
                title: localize('themes.configure.switchingDisabled', 'Detect system color mode disabled. Click to configure.'),
                icon: Codicon.colorMode,
                isChecked: false,
                ...defaultToggleStyles
            });
        }
        const options = {
            installMessage: localize('installColorThemes', "Install Additional Color Themes..."),
            browseMessage: '$(plus) ' + localize('browseColorThemes', "Browse Additional Color Themes..."),
            placeholderMessage: this.getTitle(preferredColorScheme),
            marketplaceTag: 'category:themes',
            toggles: [modeConfigureToggle],
            onToggle: async (toggle, picker) => {
                picker.hide();
                await preferencesService.openSettings({ query: ThemeSettings.DETECT_COLOR_SCHEME });
            }
        };
        const setTheme = (theme, settingsTarget) => themeService.setColorTheme(theme, settingsTarget);
        const getMarketplaceColorThemes = (publisher, name, version) => themeService.getMarketplaceColorThemes(publisher, name, version);
        const instantiationService = accessor.get(IInstantiationService);
        const picker = instantiationService.createInstance(InstalledThemesPicker, options, setTheme, getMarketplaceColorThemes);
        const themes = await themeService.getColorThemes();
        const currentTheme = themeService.getColorTheme();
        const lightEntries = toEntries(themes.filter(t => t.type === ColorScheme.LIGHT), localize('themes.category.light', "light themes"));
        const darkEntries = toEntries(themes.filter(t => t.type === ColorScheme.DARK), localize('themes.category.dark', "dark themes"));
        const hcEntries = toEntries(themes.filter(t => isHighContrast(t.type)), localize('themes.category.hc', "high contrast themes"));
        let picks;
        switch (preferredColorScheme) {
            case ColorScheme.DARK:
                picks = [...darkEntries, ...lightEntries, ...hcEntries];
                break;
            case ColorScheme.HIGH_CONTRAST_DARK:
            case ColorScheme.HIGH_CONTRAST_LIGHT:
                picks = [...hcEntries, ...lightEntries, ...darkEntries];
                break;
            case ColorScheme.LIGHT:
            default:
                picks = [...lightEntries, ...darkEntries, ...hcEntries];
                break;
        }
        await picker.openQuickPick(picks, currentTheme);
    }
});
const SelectFileIconThemeCommandId = 'workbench.action.selectIconTheme';
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: SelectFileIconThemeCommandId,
            title: localize2('selectIconTheme.label', 'File Icon Theme'),
            category: Categories.Preferences,
            f1: true
        });
    }
    async run(accessor) {
        const themeService = accessor.get(IWorkbenchThemeService);
        const options = {
            installMessage: localize('installIconThemes', "Install Additional File Icon Themes..."),
            placeholderMessage: localize('themes.selectIconTheme', "Select File Icon Theme (Up/Down Keys to Preview)"),
            marketplaceTag: 'tag:icon-theme'
        };
        const setTheme = (theme, settingsTarget) => themeService.setFileIconTheme(theme, settingsTarget);
        const getMarketplaceColorThemes = (publisher, name, version) => themeService.getMarketplaceFileIconThemes(publisher, name, version);
        const instantiationService = accessor.get(IInstantiationService);
        const picker = instantiationService.createInstance(InstalledThemesPicker, options, setTheme, getMarketplaceColorThemes);
        const picks = [
            { type: 'separator', label: localize('fileIconThemeCategory', 'file icon themes') },
            { id: '', theme: FileIconThemeData.noIconTheme, label: localize('noIconThemeLabel', 'None'), description: localize('noIconThemeDesc', 'Disable File Icons') },
            ...toEntries(await themeService.getFileIconThemes()),
        ];
        await picker.openQuickPick(picks, themeService.getFileIconTheme());
    }
});
const SelectProductIconThemeCommandId = 'workbench.action.selectProductIconTheme';
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: SelectProductIconThemeCommandId,
            title: localize2('selectProductIconTheme.label', 'Product Icon Theme'),
            category: Categories.Preferences,
            f1: true
        });
    }
    async run(accessor) {
        const themeService = accessor.get(IWorkbenchThemeService);
        const options = {
            installMessage: localize('installProductIconThemes', "Install Additional Product Icon Themes..."),
            browseMessage: '$(plus) ' + localize('browseProductIconThemes', "Browse Additional Product Icon Themes..."),
            placeholderMessage: localize('themes.selectProductIconTheme', "Select Product Icon Theme (Up/Down Keys to Preview)"),
            marketplaceTag: 'tag:product-icon-theme'
        };
        const setTheme = (theme, settingsTarget) => themeService.setProductIconTheme(theme, settingsTarget);
        const getMarketplaceColorThemes = (publisher, name, version) => themeService.getMarketplaceProductIconThemes(publisher, name, version);
        const instantiationService = accessor.get(IInstantiationService);
        const picker = instantiationService.createInstance(InstalledThemesPicker, options, setTheme, getMarketplaceColorThemes);
        const picks = [
            { type: 'separator', label: localize('productIconThemeCategory', 'product icon themes') },
            { id: DEFAULT_PRODUCT_ICON_THEME_ID, theme: ProductIconThemeData.defaultTheme, label: localize('defaultProductIconThemeLabel', 'Default') },
            ...toEntries(await themeService.getProductIconThemes()),
        ];
        await picker.openQuickPick(picks, themeService.getProductIconTheme());
    }
});
CommandsRegistry.registerCommand('workbench.action.previewColorTheme', async function (accessor, extension, themeSettingsId) {
    const themeService = accessor.get(IWorkbenchThemeService);
    let themes = findBuiltInThemes(await themeService.getColorThemes(), extension);
    if (themes.length === 0) {
        themes = await themeService.getMarketplaceColorThemes(extension.publisher, extension.name, extension.version);
    }
    for (const theme of themes) {
        if (!themeSettingsId || theme.settingsId === themeSettingsId) {
            await themeService.setColorTheme(theme, 'preview');
            return theme.settingsId;
        }
    }
    return undefined;
});
function findBuiltInThemes(themes, extension) {
    return themes.filter(({ extensionData }) => extensionData && extensionData.extensionIsBuiltin && equalsIgnoreCase(extensionData.extensionPublisher, extension.publisher) && equalsIgnoreCase(extensionData.extensionName, extension.name));
}
function configurationEntry(label, configureItem) {
    return {
        id: undefined,
        label: label,
        alwaysShow: true,
        buttons: [configureButton],
        configureItem: configureItem
    };
}
function isItem(i) {
    // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
    return i['type'] !== 'separator';
}
function toEntry(theme) {
    const settingId = theme.settingsId ?? undefined;
    const item = {
        id: theme.id,
        theme: theme,
        label: theme.label,
        description: theme.description || (theme.label === settingId ? undefined : settingId),
    };
    if (theme.extensionData) {
        item.buttons = [configureButton];
    }
    return item;
}
function toEntries(themes, label) {
    const sorter = (t1, t2) => t1.label.localeCompare(t2.label);
    const entries = themes.map(toEntry).sort(sorter);
    if (entries.length > 0 && label) {
        entries.unshift({ type: 'separator', label });
    }
    return entries;
}
const configureButton = {
    iconClass: ThemeIcon.asClassName(manageExtensionIcon),
    tooltip: localize('manage extension', "Manage Extension"),
};
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.generateColorTheme',
            title: localize2('generateColorTheme.label', 'Generate Color Theme From Current Settings'),
            category: Categories.Developer,
            f1: true
        });
    }
    run(accessor) {
        const themeService = accessor.get(IWorkbenchThemeService);
        const theme = themeService.getColorTheme();
        const colors = Registry.as(ColorRegistryExtensions.ColorContribution).getColors();
        const colorIds = colors.filter(c => !c.deprecationMessage).map(c => c.id).sort();
        const resultingColors = {};
        const inherited = [];
        for (const colorId of colorIds) {
            const color = theme.getColor(colorId, false);
            if (color) {
                resultingColors[colorId] = Color.Format.CSS.formatHexA(color, true);
            }
            else {
                inherited.push(colorId);
            }
        }
        const nullDefaults = [];
        for (const id of inherited) {
            const color = theme.getColor(id);
            if (color) {
                resultingColors['__' + id] = Color.Format.CSS.formatHexA(color, true);
            }
            else {
                nullDefaults.push(id);
            }
        }
        for (const id of nullDefaults) {
            resultingColors['__' + id] = null;
        }
        let contents = JSON.stringify({
            '$schema': colorThemeSchemaId,
            type: theme.type,
            colors: resultingColors,
            tokenColors: theme.tokenColors.filter(t => !!t.scope)
        }, null, '\t');
        contents = contents.replace(/\"__/g, '//"');
        const editorService = accessor.get(IEditorService);
        return editorService.openEditor({ resource: undefined, contents, languageId: 'jsonc', options: { pinned: true } });
    }
});
const toggleLightDarkThemesCommandId = 'workbench.action.toggleLightDarkThemes';
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: toggleLightDarkThemesCommandId,
            title: localize2('toggleLightDarkThemes.label', 'Toggle between Light/Dark Themes'),
            category: Categories.Preferences,
            f1: true,
        });
    }
    async run(accessor) {
        const themeService = accessor.get(IWorkbenchThemeService);
        const configurationService = accessor.get(IConfigurationService);
        const notificationService = accessor.get(INotificationService);
        const preferencesService = accessor.get(IPreferencesService);
        if (configurationService.getValue(ThemeSettings.DETECT_COLOR_SCHEME)) {
            const message = localize({ key: 'cannotToggle', comment: ['{0} is a setting name'] }, "Cannot toggle between light and dark themes when `{0}` is enabled in settings.", ThemeSettings.DETECT_COLOR_SCHEME);
            notificationService.prompt(Severity.Info, message, [
                {
                    label: localize('goToSetting', "Open Settings"),
                    run: () => {
                        return preferencesService.openUserSettings({ query: ThemeSettings.DETECT_COLOR_SCHEME });
                    }
                }
            ]);
            return;
        }
        const currentTheme = themeService.getColorTheme();
        let newSettingsId = ThemeSettings.PREFERRED_DARK_THEME;
        switch (currentTheme.type) {
            case ColorScheme.LIGHT:
                newSettingsId = ThemeSettings.PREFERRED_DARK_THEME;
                break;
            case ColorScheme.DARK:
                newSettingsId = ThemeSettings.PREFERRED_LIGHT_THEME;
                break;
            case ColorScheme.HIGH_CONTRAST_LIGHT:
                newSettingsId = ThemeSettings.PREFERRED_HC_DARK_THEME;
                break;
            case ColorScheme.HIGH_CONTRAST_DARK:
                newSettingsId = ThemeSettings.PREFERRED_HC_LIGHT_THEME;
                break;
        }
        const themeSettingId = configurationService.getValue(newSettingsId);
        if (themeSettingId && typeof themeSettingId === 'string') {
            const theme = (await themeService.getColorThemes()).find(t => t.settingsId === themeSettingId);
            if (theme) {
                themeService.setColorTheme(theme.id, 'auto');
            }
        }
    }
});
const browseColorThemesInMarketplaceCommandId = 'workbench.action.browseColorThemesInMarketplace';
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: browseColorThemesInMarketplaceCommandId,
            title: localize2('browseColorThemeInMarketPlace.label', 'Browse Color Themes in Marketplace'),
            category: Categories.Preferences,
            f1: true,
        });
    }
    async run(accessor) {
        const marketplaceTag = 'category:themes';
        const themeService = accessor.get(IWorkbenchThemeService);
        const extensionGalleryService = accessor.get(IExtensionGalleryService);
        const extensionResourceLoaderService = accessor.get(IExtensionResourceLoaderService);
        const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const instantiationService = accessor.get(IInstantiationService);
        if (!extensionGalleryService.isEnabled()) {
            return;
        }
        if (!await extensionResourceLoaderService.supportsExtensionGalleryResources()) {
            await extensionsWorkbenchService.openSearch(marketplaceTag);
            return;
        }
        const currentTheme = themeService.getColorTheme();
        const getMarketplaceColorThemes = (publisher, name, version) => themeService.getMarketplaceColorThemes(publisher, name, version);
        let selectThemeTimeout;
        const selectTheme = (theme, applyTheme) => {
            if (selectThemeTimeout) {
                clearTimeout(selectThemeTimeout);
            }
            selectThemeTimeout = mainWindow.setTimeout(() => {
                selectThemeTimeout = undefined;
                const newTheme = (theme ?? currentTheme);
                themeService.setColorTheme(newTheme, applyTheme ? 'auto' : 'preview').then(undefined, err => {
                    onUnexpectedError(err);
                    themeService.setColorTheme(currentTheme, undefined);
                });
            }, applyTheme ? 0 : 200);
        };
        const marketplaceThemePicker = instantiationService.createInstance(MarketplaceThemesPicker, getMarketplaceColorThemes, marketplaceTag);
        await marketplaceThemePicker.openQuickPick('', themeService.getColorTheme(), selectTheme).then(undefined, onUnexpectedError);
    }
});
const ThemesSubMenu = new MenuId('ThemesSubMenu');
MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
    title: localize('themes', "Themes"),
    submenu: ThemesSubMenu,
    group: '2_configuration',
    order: 7
});
MenuRegistry.appendMenuItem(MenuId.MenubarPreferencesMenu, {
    title: localize({ key: 'miSelectTheme', comment: ['&& denotes a mnemonic'] }, "&&Themes"),
    submenu: ThemesSubMenu,
    group: '2_configuration',
    order: 7
});
MenuRegistry.appendMenuItem(ThemesSubMenu, {
    command: {
        id: SelectColorThemeCommandId,
        title: localize('selectTheme.label', 'Color Theme')
    },
    order: 1
});
MenuRegistry.appendMenuItem(ThemesSubMenu, {
    command: {
        id: SelectFileIconThemeCommandId,
        title: localize('themes.selectIconTheme.label', "File Icon Theme")
    },
    order: 2
});
MenuRegistry.appendMenuItem(ThemesSubMenu, {
    command: {
        id: SelectProductIconThemeCommandId,
        title: localize('themes.selectProductIconTheme.label', "Product Icon Theme")
    },
    order: 3
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhlbWVzLmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90aGVtZXMvYnJvd3Nlci90aGVtZXMuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFVLFFBQVEsRUFBVyxNQUFNLHFDQUFxQyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQWdCLE1BQU0sZ0RBQWdELENBQUM7QUFDOUgsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDdEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzVFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUMxRixPQUFPLEVBQUUsc0JBQXNCLEVBQWtILGFBQWEsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQ2pPLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSwyQkFBMkIsRUFBcUIsTUFBTSx3RUFBd0UsQ0FBQztBQUNsSyxPQUFPLEVBQWtCLFVBQVUsSUFBSSx1QkFBdUIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQzNILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNsRixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekQsT0FBTyxFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN6RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxx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