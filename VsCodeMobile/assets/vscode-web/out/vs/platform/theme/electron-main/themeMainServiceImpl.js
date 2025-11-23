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
var ThemeMainService_1;
import electron from 'electron';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { isLinux, isMacintosh, isWindows } from '../../../base/common/platform.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IStateService } from '../../state/node/state.js';
import { ThemeTypeSelector } from '../common/theme.js';
import { coalesce } from '../../../base/common/arrays.js';
import { getAllWindowsExcludingOffscreen } from '../../windows/electron-main/windows.js';
import { ILogService } from '../../log/common/log.js';
// These default colors match our default themes
// editor background color ("Dark Modern", etc...)
const DEFAULT_BG_LIGHT = '#FFFFFF';
const DEFAULT_BG_DARK = '#1F1F1F';
const DEFAULT_BG_HC_BLACK = '#000000';
const DEFAULT_BG_HC_LIGHT = '#FFFFFF';
const THEME_STORAGE_KEY = 'theme';
const THEME_BG_STORAGE_KEY = 'themeBackground';
const THEME_WINDOW_SPLASH_KEY = 'windowSplash';
const THEME_WINDOW_SPLASH_OVERRIDE_KEY = 'windowSplashWorkspaceOverride';
const AUXILIARYBAR_DEFAULT_VISIBILITY = 'workbench.secondarySideBar.defaultVisibility';
var ThemeSettings;
(function (ThemeSettings) {
    ThemeSettings.DETECT_COLOR_SCHEME = 'window.autoDetectColorScheme';
    ThemeSettings.DETECT_HC = 'window.autoDetectHighContrast';
    ThemeSettings.SYSTEM_COLOR_THEME = 'window.systemColorTheme';
})(ThemeSettings || (ThemeSettings = {}));
let ThemeMainService = class ThemeMainService extends Disposable {
    static { ThemeMainService_1 = this; }
    static { this.DEFAULT_BAR_WIDTH = 300; }
    static { this.WORKSPACE_OVERRIDE_LIMIT = 50; }
    constructor(stateService, configurationService, logService) {
        super();
        this.stateService = stateService;
        this.configurationService = configurationService;
        this.logService = logService;
        this._onDidChangeColorScheme = this._register(new Emitter());
        this.onDidChangeColorScheme = this._onDidChangeColorScheme.event;
        // System Theme
        if (!isLinux) {
            this._register(this.configurationService.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration(ThemeSettings.SYSTEM_COLOR_THEME) || e.affectsConfiguration(ThemeSettings.DETECT_COLOR_SCHEME)) {
                    this.updateSystemColorTheme();
                }
            }));
        }
        this.updateSystemColorTheme();
        // Color Scheme changes
        this._register(Event.fromNodeEventEmitter(electron.nativeTheme, 'updated')(() => this._onDidChangeColorScheme.fire(this.getColorScheme())));
    }
    updateSystemColorTheme() {
        if (isLinux || this.configurationService.getValue(ThemeSettings.DETECT_COLOR_SCHEME)) {
            electron.nativeTheme.themeSource = 'system'; // only with `system` we can detect the system color scheme
        }
        else {
            switch (this.configurationService.getValue(ThemeSettings.SYSTEM_COLOR_THEME)) {
                case 'dark':
                    electron.nativeTheme.themeSource = 'dark';
                    break;
                case 'light':
                    electron.nativeTheme.themeSource = 'light';
                    break;
                case 'auto':
                    switch (this.getPreferredBaseTheme() ?? this.getStoredBaseTheme()) {
                        case ThemeTypeSelector.VS:
                            electron.nativeTheme.themeSource = 'light';
                            break;
                        case ThemeTypeSelector.VS_DARK:
                            electron.nativeTheme.themeSource = 'dark';
                            break;
                        default: electron.nativeTheme.themeSource = 'system';
                    }
                    break;
                default:
                    electron.nativeTheme.themeSource = 'system';
                    break;
            }
        }
    }
    getColorScheme() {
        // high contrast is reflected by the shouldUseInvertedColorScheme property
        if (isWindows) {
            if (electron.nativeTheme.shouldUseHighContrastColors) {
                // shouldUseInvertedColorScheme is dark, !shouldUseInvertedColorScheme is light
                return { dark: electron.nativeTheme.shouldUseInvertedColorScheme, highContrast: true };
            }
        }
        // high contrast is set if one of shouldUseInvertedColorScheme or shouldUseHighContrastColors is set,
        // reflecting the 'Invert colours' and `Increase contrast` settings in MacOS
        else if (isMacintosh) {
            if (electron.nativeTheme.shouldUseInvertedColorScheme || electron.nativeTheme.shouldUseHighContrastColors) {
                return { dark: electron.nativeTheme.shouldUseDarkColors, highContrast: true };
            }
        }
        // ubuntu gnome seems to have 3 states, light dark and high contrast
        else if (isLinux) {
            if (electron.nativeTheme.shouldUseHighContrastColors) {
                return { dark: true, highContrast: true };
            }
        }
        return {
            dark: electron.nativeTheme.shouldUseDarkColors,
            highContrast: false
        };
    }
    getPreferredBaseTheme() {
        const colorScheme = this.getColorScheme();
        if (this.configurationService.getValue(ThemeSettings.DETECT_HC) && colorScheme.highContrast) {
            return colorScheme.dark ? ThemeTypeSelector.HC_BLACK : ThemeTypeSelector.HC_LIGHT;
        }
        if (this.configurationService.getValue(ThemeSettings.DETECT_COLOR_SCHEME)) {
            return colorScheme.dark ? ThemeTypeSelector.VS_DARK : ThemeTypeSelector.VS;
        }
        return undefined;
    }
    getBackgroundColor() {
        const preferred = this.getPreferredBaseTheme();
        const stored = this.getStoredBaseTheme();
        // If the stored theme has the same base as the preferred, we can return the stored background
        if (preferred === undefined || preferred === stored) {
            const storedBackground = this.stateService.getItem(THEME_BG_STORAGE_KEY, null);
            if (storedBackground) {
                return storedBackground;
            }
        }
        // Otherwise we return the default background for the preferred base theme. If there's no preferred, use the stored one.
        switch (preferred ?? stored) {
            case ThemeTypeSelector.VS: return DEFAULT_BG_LIGHT;
            case ThemeTypeSelector.HC_BLACK: return DEFAULT_BG_HC_BLACK;
            case ThemeTypeSelector.HC_LIGHT: return DEFAULT_BG_HC_LIGHT;
            default: return DEFAULT_BG_DARK;
        }
    }
    getStoredBaseTheme() {
        const baseTheme = this.stateService.getItem(THEME_STORAGE_KEY, ThemeTypeSelector.VS_DARK).split(' ')[0];
        switch (baseTheme) {
            case ThemeTypeSelector.VS: return ThemeTypeSelector.VS;
            case ThemeTypeSelector.HC_BLACK: return ThemeTypeSelector.HC_BLACK;
            case ThemeTypeSelector.HC_LIGHT: return ThemeTypeSelector.HC_LIGHT;
            default: return ThemeTypeSelector.VS_DARK;
        }
    }
    saveWindowSplash(windowId, workspace, splash) {
        // Update override as needed
        const splashOverride = this.updateWindowSplashOverride(workspace, splash);
        // Update in storage
        this.stateService.setItems(coalesce([
            { key: THEME_STORAGE_KEY, data: splash.baseTheme },
            { key: THEME_BG_STORAGE_KEY, data: splash.colorInfo.background },
            { key: THEME_WINDOW_SPLASH_KEY, data: splash },
            splashOverride ? { key: THEME_WINDOW_SPLASH_OVERRIDE_KEY, data: splashOverride } : undefined
        ]));
        // Update in opened windows
        if (typeof windowId === 'number') {
            this.updateBackgroundColor(windowId, splash);
        }
        // Update system theme
        this.updateSystemColorTheme();
    }
    updateWindowSplashOverride(workspace, splash) {
        let splashOverride = undefined;
        let changed = false;
        if (workspace) {
            splashOverride = { ...this.getWindowSplashOverride() }; // make a copy for modifications
            changed = this.doUpdateWindowSplashOverride(workspace, splash, splashOverride, 'sideBar');
            changed = this.doUpdateWindowSplashOverride(workspace, splash, splashOverride, 'auxiliaryBar') || changed;
        }
        return changed ? splashOverride : undefined;
    }
    doUpdateWindowSplashOverride(workspace, splash, splashOverride, part) {
        const currentWidth = part === 'sideBar' ? splash.layoutInfo?.sideBarWidth : splash.layoutInfo?.auxiliaryBarWidth;
        const overrideWidth = part === 'sideBar' ? splashOverride.layoutInfo.sideBarWidth : splashOverride.layoutInfo.auxiliaryBarWidth;
        // No layout info: remove override
        let changed = false;
        if (typeof currentWidth !== 'number') {
            if (splashOverride.layoutInfo.workspaces[workspace.id]) {
                delete splashOverride.layoutInfo.workspaces[workspace.id];
                changed = true;
            }
            return changed;
        }
        let workspaceOverride = splashOverride.layoutInfo.workspaces[workspace.id];
        if (!workspaceOverride) {
            const workspaceEntries = Object.keys(splashOverride.layoutInfo.workspaces);
            if (workspaceEntries.length >= ThemeMainService_1.WORKSPACE_OVERRIDE_LIMIT) {
                delete splashOverride.layoutInfo.workspaces[workspaceEntries[0]];
                changed = true;
            }
            workspaceOverride = { sideBarVisible: false, auxiliaryBarVisible: false };
            splashOverride.layoutInfo.workspaces[workspace.id] = workspaceOverride;
            changed = true;
        }
        // Part has width: update width & visibility override
        if (currentWidth > 0) {
            if (overrideWidth !== currentWidth) {
                splashOverride.layoutInfo[part === 'sideBar' ? 'sideBarWidth' : 'auxiliaryBarWidth'] = currentWidth;
                changed = true;
            }
            switch (part) {
                case 'sideBar':
                    if (!workspaceOverride.sideBarVisible) {
                        workspaceOverride.sideBarVisible = true;
                        changed = true;
                    }
                    break;
                case 'auxiliaryBar':
                    if (!workspaceOverride.auxiliaryBarVisible) {
                        workspaceOverride.auxiliaryBarVisible = true;
                        changed = true;
                    }
                    break;
            }
        }
        // Part is hidden: update visibility override
        else {
            switch (part) {
                case 'sideBar':
                    if (workspaceOverride.sideBarVisible) {
                        workspaceOverride.sideBarVisible = false;
                        changed = true;
                    }
                    break;
                case 'auxiliaryBar':
                    if (workspaceOverride.auxiliaryBarVisible) {
                        workspaceOverride.auxiliaryBarVisible = false;
                        changed = true;
                    }
                    break;
            }
        }
        return changed;
    }
    updateBackgroundColor(windowId, splash) {
        for (const window of getAllWindowsExcludingOffscreen()) {
            if (window.id === windowId) {
                window.setBackgroundColor(splash.colorInfo.background);
                break;
            }
        }
    }
    getWindowSplash(workspace) {
        try {
            return this.doGetWindowSplash(workspace);
        }
        catch (error) {
            this.logService.error('[theme main service] Failed to get window splash', error);
            return undefined;
        }
    }
    doGetWindowSplash(workspace) {
        const partSplash = this.stateService.getItem(THEME_WINDOW_SPLASH_KEY);
        if (!partSplash?.layoutInfo) {
            return partSplash; // return early: overrides currently only apply to layout info
        }
        const override = this.getWindowSplashOverride();
        // Figure out side bar width based on workspace and overrides
        let sideBarWidth;
        if (workspace) {
            if (override.layoutInfo.workspaces[workspace.id]?.sideBarVisible === false) {
                sideBarWidth = 0;
            }
            else {
                sideBarWidth = override.layoutInfo.sideBarWidth || partSplash.layoutInfo.sideBarWidth || ThemeMainService_1.DEFAULT_BAR_WIDTH;
            }
        }
        else {
            sideBarWidth = 0;
        }
        // Figure out auxiliary bar width based on workspace, configuration and overrides
        const auxiliaryBarDefaultVisibility = this.configurationService.getValue(AUXILIARYBAR_DEFAULT_VISIBILITY) ?? 'visibleInWorkspace';
        let auxiliaryBarWidth;
        if (workspace) {
            const auxiliaryBarVisible = override.layoutInfo.workspaces[workspace.id]?.auxiliaryBarVisible;
            if (auxiliaryBarVisible === true) {
                auxiliaryBarWidth = override.layoutInfo.auxiliaryBarWidth || partSplash.layoutInfo.auxiliaryBarWidth || ThemeMainService_1.DEFAULT_BAR_WIDTH;
            }
            else if (auxiliaryBarVisible === false) {
                auxiliaryBarWidth = 0;
            }
            else {
                if (auxiliaryBarDefaultVisibility === 'visible' || auxiliaryBarDefaultVisibility === 'visibleInWorkspace') {
                    auxiliaryBarWidth = override.layoutInfo.auxiliaryBarWidth || partSplash.layoutInfo.auxiliaryBarWidth || ThemeMainService_1.DEFAULT_BAR_WIDTH;
                }
                else if (auxiliaryBarDefaultVisibility === 'maximized' || auxiliaryBarDefaultVisibility === 'maximizedInWorkspace') {
                    auxiliaryBarWidth = Number.MAX_SAFE_INTEGER; // marker for a maximised auxiliary bar
                }
                else {
                    auxiliaryBarWidth = 0;
                }
            }
        }
        else {
            auxiliaryBarWidth = 0; // technically not true if configured 'visible', but we never store splash per empty window, so we decide on a default here
        }
        return {
            ...partSplash,
            layoutInfo: {
                ...partSplash.layoutInfo,
                sideBarWidth,
                auxiliaryBarWidth
            }
        };
    }
    getWindowSplashOverride() {
        let override = this.stateService.getItem(THEME_WINDOW_SPLASH_OVERRIDE_KEY);
        if (!override?.layoutInfo) {
            override = {
                layoutInfo: {
                    sideBarWidth: ThemeMainService_1.DEFAULT_BAR_WIDTH,
                    auxiliaryBarWidth: ThemeMainService_1.DEFAULT_BAR_WIDTH,
                    workspaces: {}
                }
            };
        }
        if (!override.layoutInfo.sideBarWidth) {
            override.layoutInfo.sideBarWidth = ThemeMainService_1.DEFAULT_BAR_WIDTH;
        }
        if (!override.layoutInfo.auxiliaryBarWidth) {
            override.layoutInfo.auxiliaryBarWidth = ThemeMainService_1.DEFAULT_BAR_WIDTH;
        }
        if (!override.layoutInfo.workspaces) {
            override.layoutInfo.workspaces = {};
        }
        return override;
    }
};
ThemeMainService = ThemeMainService_1 = __decorate([
    __param(0, IStateService),
    __param(1, IConfigurationService),
    __param(2, ILogService)
], ThemeMainService);
export { ThemeMainService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhlbWVNYWluU2VydmljZUltcGwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vdGhlbWUvZWxlY3Ryb24tbWFpbi90aGVtZU1haW5TZXJ2aWNlSW1wbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxRQUFRLE1BQU0sVUFBVSxDQUFDO0FBQ2hDLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUcxRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUV2RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDMUQsT0FBTyxFQUFFLCtCQUErQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDekYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBR3RELGdEQUFnRDtBQUNoRCxrREFBa0Q7QUFDbEQsTUFBTSxnQkFBZ0IsR0FBRyxTQUFTLENBQUM7QUFDbkMsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDO0FBQ2xDLE1BQU0sbUJBQW1CLEdBQUcsU0FBUyxDQUFDO0FBQ3RDLE1BQU0sbUJBQW1CLEdBQUcsU0FBUyxDQUFDO0FBRXRDLE1BQU0saUJBQWlCLEdBQUcsT0FBTyxDQUFDO0FBQ2xDLE1BQU0sb0JBQW9CLEdBQUcsaUJBQWlCLENBQUM7QUFFL0MsTUFBTSx1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