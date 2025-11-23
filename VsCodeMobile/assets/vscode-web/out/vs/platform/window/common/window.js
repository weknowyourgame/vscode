/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isMacintosh, isNative, isWeb } from '../../../base/common/platform.js';
export const WindowMinimumSize = {
    WIDTH: 400,
    WIDTH_WITH_VERTICAL_PANEL: 600,
    HEIGHT: 270
};
export function isOpenedAuxiliaryWindow(candidate) {
    return typeof candidate.parentId === 'number';
}
export function isWorkspaceToOpen(uriToOpen) {
    return !!uriToOpen.workspaceUri;
}
export function isFolderToOpen(uriToOpen) {
    return !!uriToOpen.folderUri;
}
export function isFileToOpen(uriToOpen) {
    return !!uriToOpen.fileUri;
}
export var MenuSettings;
(function (MenuSettings) {
    MenuSettings["MenuStyle"] = "window.menuStyle";
    MenuSettings["MenuBarVisibility"] = "window.menuBarVisibility";
})(MenuSettings || (MenuSettings = {}));
export var MenuStyleConfiguration;
(function (MenuStyleConfiguration) {
    MenuStyleConfiguration["CUSTOM"] = "custom";
    MenuStyleConfiguration["NATIVE"] = "native";
    MenuStyleConfiguration["INHERIT"] = "inherit";
})(MenuStyleConfiguration || (MenuStyleConfiguration = {}));
export function hasNativeContextMenu(configurationService, titleBarStyle) {
    if (isWeb) {
        return false;
    }
    const nativeTitle = hasNativeTitlebar(configurationService, titleBarStyle);
    const windowConfigurations = configurationService.getValue('window');
    if (windowConfigurations?.menuStyle === "native" /* MenuStyleConfiguration.NATIVE */) {
        // Do not support native menu with custom title bar
        if (!isMacintosh && !nativeTitle) {
            return false;
        }
        return true;
    }
    if (windowConfigurations?.menuStyle === "custom" /* MenuStyleConfiguration.CUSTOM */) {
        return false;
    }
    return nativeTitle; // Default to inherit from title bar style
}
export function hasNativeMenu(configurationService, titleBarStyle) {
    if (isWeb) {
        return false;
    }
    if (isMacintosh) {
        return true;
    }
    return hasNativeContextMenu(configurationService, titleBarStyle);
}
export function getMenuBarVisibility(configurationService) {
    const menuBarVisibility = configurationService.getValue("window.menuBarVisibility" /* MenuSettings.MenuBarVisibility */);
    if (menuBarVisibility === 'default' || (menuBarVisibility === 'compact' && hasNativeMenu(configurationService)) || (isMacintosh && isNative)) {
        return 'classic';
    }
    else {
        return menuBarVisibility;
    }
}
export var TitleBarSetting;
(function (TitleBarSetting) {
    TitleBarSetting["TITLE_BAR_STYLE"] = "window.titleBarStyle";
    TitleBarSetting["CUSTOM_TITLE_BAR_VISIBILITY"] = "window.customTitleBarVisibility";
})(TitleBarSetting || (TitleBarSetting = {}));
export var TitlebarStyle;
(function (TitlebarStyle) {
    TitlebarStyle["NATIVE"] = "native";
    TitlebarStyle["CUSTOM"] = "custom";
})(TitlebarStyle || (TitlebarStyle = {}));
export var WindowControlsStyle;
(function (WindowControlsStyle) {
    WindowControlsStyle["NATIVE"] = "native";
    WindowControlsStyle["CUSTOM"] = "custom";
    WindowControlsStyle["HIDDEN"] = "hidden";
})(WindowControlsStyle || (WindowControlsStyle = {}));
export var CustomTitleBarVisibility;
(function (CustomTitleBarVisibility) {
    CustomTitleBarVisibility["AUTO"] = "auto";
    CustomTitleBarVisibility["WINDOWED"] = "windowed";
    CustomTitleBarVisibility["NEVER"] = "never";
})(CustomTitleBarVisibility || (CustomTitleBarVisibility = {}));
export function hasCustomTitlebar(configurationService, titleBarStyle) {
    // Returns if it possible to have a custom title bar in the curren session
    // Does not imply that the title bar is visible
    return true;
}
export function hasNativeTitlebar(configurationService, titleBarStyle) {
    if (!titleBarStyle) {
        titleBarStyle = getTitleBarStyle(configurationService);
    }
    return titleBarStyle === "native" /* TitlebarStyle.NATIVE */;
}
export function getTitleBarStyle(configurationService) {
    if (isWeb) {
        return "custom" /* TitlebarStyle.CUSTOM */;
    }
    const configuration = configurationService.getValue('window');
    if (configuration) {
        const useNativeTabs = isMacintosh && configuration.nativeTabs === true;
        if (useNativeTabs) {
            return "native" /* TitlebarStyle.NATIVE */; // native tabs on sierra do not work with custom title style
        }
        const useSimpleFullScreen = isMacintosh && configuration.nativeFullScreen === false;
        if (useSimpleFullScreen) {
            return "native" /* TitlebarStyle.NATIVE */; // simple fullscreen does not work well with custom title style (https://github.com/microsoft/vscode/issues/63291)
        }
        const style = configuration.titleBarStyle;
        if (style === "native" /* TitlebarStyle.NATIVE */ || style === "custom" /* TitlebarStyle.CUSTOM */) {
            return style;
        }
    }
    return "custom" /* TitlebarStyle.CUSTOM */; // default to custom on all OS
}
export function getWindowControlsStyle(configurationService) {
    if (isWeb || isMacintosh || getTitleBarStyle(configurationService) === "native" /* TitlebarStyle.NATIVE */) {
        return "native" /* WindowControlsStyle.NATIVE */; // only supported on Windows/Linux desktop with custom titlebar
    }
    const configuration = configurationService.getValue('window');
    const style = configuration?.controlsStyle;
    if (style === "custom" /* WindowControlsStyle.CUSTOM */ || style === "hidden" /* WindowControlsStyle.HIDDEN */) {
        return style;
    }
    return "native" /* WindowControlsStyle.NATIVE */; // default to native on all OS
}
export const DEFAULT_CUSTOM_TITLEBAR_HEIGHT = 35; // includes space for command center
export function useWindowControlsOverlay(configurationService) {
    if (isWeb) {
        return false; // only supported on desktop instances
    }
    if (hasNativeTitlebar(configurationService)) {
        return false; // only supported when title bar is custom
    }
    if (!isMacintosh) {
        const setting = getWindowControlsStyle(configurationService);
        if (setting === "custom" /* WindowControlsStyle.CUSTOM */ || setting === "hidden" /* WindowControlsStyle.HIDDEN */) {
            return false; // explicitly disabled by choice
        }
    }
    return true; // default
}
export function useNativeFullScreen(configurationService) {
    const windowConfig = configurationService.getValue('window');
    if (!windowConfig || typeof windowConfig.nativeFullScreen !== 'boolean') {
        return true; // default
    }
    if (windowConfig.nativeTabs) {
        return true; // https://github.com/electron/electron/issues/16142
    }
    return windowConfig.nativeFullScreen !== false;
}
/**
 * According to Electron docs: `scale := 1.2 ^ level`.
 * https://github.com/electron/electron/blob/master/docs/api/web-contents.md#contentssetzoomlevellevel
 */
export function zoomLevelToZoomFactor(zoomLevel = 0) {
    return 1.2 ** zoomLevel;
}
export const DEFAULT_EMPTY_WINDOW_SIZE = { width: 1200, height: 800 };
export const DEFAULT_WORKSPACE_WINDOW_SIZE = { width: 1440, height: 900 };
export const DEFAULT_AUX_WINDOW_SIZE = { width: 1024, height: 768 };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2luZG93LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3dpbmRvdy9jb21tb24vd2luZG93LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBS2hHLE9BQU8sRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBYWhGLE1BQU0sQ0FBQyxNQUFNLGlCQUFpQixHQUFHO0lBQ2hDLEtBQUssRUFBRSxHQUFHO0lBQ1YseUJBQXlCLEVBQUUsR0FBRztJQUM5QixNQUFNLEVBQUUsR0FBRztDQUNYLENBQUM7QUFvRUYsTUFBTSxVQUFVLHVCQUF1QixDQUFDLFNBQXFEO0lBQzVGLE9BQU8sT0FBUSxTQUFvQyxDQUFDLFFBQVEsS0FBSyxRQUFRLENBQUM7QUFDM0UsQ0FBQztBQXNCRCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsU0FBMEI7SUFDM0QsT0FBTyxDQUFDLENBQUUsU0FBOEIsQ0FBQyxZQUFZLENBQUM7QUFDdkQsQ0FBQztBQUVELE1BQU0sVUFBVSxjQUFjLENBQUMsU0FBMEI7SUFDeEQsT0FBTyxDQUFDLENBQUUsU0FBMkIsQ0FBQyxTQUFTLENBQUM7QUFDakQsQ0FBQztBQUVELE1BQU0sVUFBVSxZQUFZLENBQUMsU0FBMEI7SUFDdEQsT0FBTyxDQUFDLENBQUUsU0FBeUIsQ0FBQyxPQUFPLENBQUM7QUFDN0MsQ0FBQztBQUVELE1BQU0sQ0FBTixJQUFrQixZQUdqQjtBQUhELFdBQWtCLFlBQVk7SUFDN0IsOENBQThCLENBQUE7SUFDOUIsOERBQThDLENBQUE7QUFDL0MsQ0FBQyxFQUhpQixZQUFZLEtBQVosWUFBWSxRQUc3QjtBQUVELE1BQU0sQ0FBTixJQUFrQixzQkFJakI7QUFKRCxXQUFrQixzQkFBc0I7SUFDdkMsMkNBQWlCLENBQUE7SUFDakIsMkNBQWlCLENBQUE7SUFDakIsNkNBQW1CLENBQUE7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