/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { refineServiceDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { isMacintosh, isNative, isWeb } from '../../../../base/common/platform.js';
import { isAuxiliaryWindow } from '../../../../base/browser/window.js';
import { getMenuBarVisibility, hasCustomTitlebar, hasNativeMenu, hasNativeTitlebar } from '../../../../platform/window/common/window.js';
import { isFullscreen, isWCOEnabled } from '../../../../base/browser/browser.js';
export const IWorkbenchLayoutService = refineServiceDecorator(ILayoutService);
export var Parts;
(function (Parts) {
    Parts["TITLEBAR_PART"] = "workbench.parts.titlebar";
    Parts["BANNER_PART"] = "workbench.parts.banner";
    Parts["ACTIVITYBAR_PART"] = "workbench.parts.activitybar";
    Parts["SIDEBAR_PART"] = "workbench.parts.sidebar";
    Parts["PANEL_PART"] = "workbench.parts.panel";
    Parts["AUXILIARYBAR_PART"] = "workbench.parts.auxiliarybar";
    Parts["EDITOR_PART"] = "workbench.parts.editor";
    Parts["STATUSBAR_PART"] = "workbench.parts.statusbar";
})(Parts || (Parts = {}));
export var ZenModeSettings;
(function (ZenModeSettings) {
    ZenModeSettings["SHOW_TABS"] = "zenMode.showTabs";
    ZenModeSettings["HIDE_LINENUMBERS"] = "zenMode.hideLineNumbers";
    ZenModeSettings["HIDE_STATUSBAR"] = "zenMode.hideStatusBar";
    ZenModeSettings["HIDE_ACTIVITYBAR"] = "zenMode.hideActivityBar";
    ZenModeSettings["CENTER_LAYOUT"] = "zenMode.centerLayout";
    ZenModeSettings["FULLSCREEN"] = "zenMode.fullScreen";
    ZenModeSettings["RESTORE"] = "zenMode.restore";
    ZenModeSettings["SILENT_NOTIFICATIONS"] = "zenMode.silentNotifications";
})(ZenModeSettings || (ZenModeSettings = {}));
export var LayoutSettings;
(function (LayoutSettings) {
    LayoutSettings["ACTIVITY_BAR_LOCATION"] = "workbench.activityBar.location";
    LayoutSettings["EDITOR_TABS_MODE"] = "workbench.editor.showTabs";
    LayoutSettings["EDITOR_ACTIONS_LOCATION"] = "workbench.editor.editorActionsLocation";
    LayoutSettings["COMMAND_CENTER"] = "window.commandCenter";
    LayoutSettings["LAYOUT_ACTIONS"] = "workbench.layoutControl.enabled";
})(LayoutSettings || (LayoutSettings = {}));
export var ActivityBarPosition;
(function (ActivityBarPosition) {
    ActivityBarPosition["DEFAULT"] = "default";
    ActivityBarPosition["TOP"] = "top";
    ActivityBarPosition["BOTTOM"] = "bottom";
    ActivityBarPosition["HIDDEN"] = "hidden";
})(ActivityBarPosition || (ActivityBarPosition = {}));
export var EditorTabsMode;
(function (EditorTabsMode) {
    EditorTabsMode["MULTIPLE"] = "multiple";
    EditorTabsMode["SINGLE"] = "single";
    EditorTabsMode["NONE"] = "none";
})(EditorTabsMode || (EditorTabsMode = {}));
export var EditorActionsLocation;
(function (EditorActionsLocation) {
    EditorActionsLocation["DEFAULT"] = "default";
    EditorActionsLocation["TITLEBAR"] = "titleBar";
    EditorActionsLocation["HIDDEN"] = "hidden";
})(EditorActionsLocation || (EditorActionsLocation = {}));
export var Position;
(function (Position) {
    Position[Position["LEFT"] = 0] = "LEFT";
    Position[Position["RIGHT"] = 1] = "RIGHT";
    Position[Position["BOTTOM"] = 2] = "BOTTOM";
    Position[Position["TOP"] = 3] = "TOP";
})(Position || (Position = {}));
export function isHorizontal(position) {
    return position === 2 /* Position.BOTTOM */ || position === 3 /* Position.TOP */;
}
export var PartOpensMaximizedOptions;
(function (PartOpensMaximizedOptions) {
    PartOpensMaximizedOptions[PartOpensMaximizedOptions["ALWAYS"] = 0] = "ALWAYS";
    PartOpensMaximizedOptions[PartOpensMaximizedOptions["NEVER"] = 1] = "NEVER";
    PartOpensMaximizedOptions[PartOpensMaximizedOptions["REMEMBER_LAST"] = 2] = "REMEMBER_LAST";
})(PartOpensMaximizedOptions || (PartOpensMaximizedOptions = {}));
export function positionToString(position) {
    switch (position) {
        case 0 /* Position.LEFT */: return 'left';
        case 1 /* Position.RIGHT */: return 'right';
        case 2 /* Position.BOTTOM */: return 'bottom';
        case 3 /* Position.TOP */: return 'top';
        default: return 'bottom';
    }
}
const positionsByString = {
    [positionToString(0 /* Position.LEFT */)]: 0 /* Position.LEFT */,
    [positionToString(1 /* Position.RIGHT */)]: 1 /* Position.RIGHT */,
    [positionToString(2 /* Position.BOTTOM */)]: 2 /* Position.BOTTOM */,
    [positionToString(3 /* Position.TOP */)]: 3 /* Position.TOP */
};
export function positionFromString(str) {
    return positionsByString[str];
}
function partOpensMaximizedSettingToString(setting) {
    switch (setting) {
        case 0 /* PartOpensMaximizedOptions.ALWAYS */: return 'always';
        case 1 /* PartOpensMaximizedOptions.NEVER */: return 'never';
        case 2 /* PartOpensMaximizedOptions.REMEMBER_LAST */: return 'preserve';
        default: return 'preserve';
    }
}
const partOpensMaximizedByString = {
    [partOpensMaximizedSettingToString(0 /* PartOpensMaximizedOptions.ALWAYS */)]: 0 /* PartOpensMaximizedOptions.ALWAYS */,
    [partOpensMaximizedSettingToString(1 /* PartOpensMaximizedOptions.NEVER */)]: 1 /* PartOpensMaximizedOptions.NEVER */,
    [partOpensMaximizedSettingToString(2 /* PartOpensMaximizedOptions.REMEMBER_LAST */)]: 2 /* PartOpensMaximizedOptions.REMEMBER_LAST */
};
export function partOpensMaximizedFromString(str) {
    return partOpensMaximizedByString[str];
}
export function isMultiWindowPart(part) {
    return part === "workbench.parts.editor" /* Parts.EDITOR_PART */ ||
        part === "workbench.parts.statusbar" /* Parts.STATUSBAR_PART */ ||
        part === "workbench.parts.titlebar" /* Parts.TITLEBAR_PART */;
}
export function shouldShowCustomTitleBar(configurationService, window, menuBarToggled) {
    if (!hasCustomTitlebar(configurationService)) {
        return false;
    }
    const inFullscreen = isFullscreen(window);
    const nativeTitleBarEnabled = hasNativeTitlebar(configurationService);
    if (!isWeb) {
        const showCustomTitleBar = configurationService.getValue("window.customTitleBarVisibility" /* TitleBarSetting.CUSTOM_TITLE_BAR_VISIBILITY */);
        if (showCustomTitleBar === "never" /* CustomTitleBarVisibility.NEVER */ && nativeTitleBarEnabled || showCustomTitleBar === "windowed" /* CustomTitleBarVisibility.WINDOWED */ && inFullscreen) {
            return false;
        }
    }
    if (!isTitleBarEmpty(configurationService)) {
        return true;
    }
    // Hide custom title bar when native title bar enabled and custom title bar is empty
    if (nativeTitleBarEnabled && hasNativeMenu(configurationService)) {
        return false;
    }
    // macOS desktop does not need a title bar when full screen
    if (isMacintosh && isNative) {
        return !inFullscreen;
    }
    // non-fullscreen native must show the title bar
    if (isNative && !inFullscreen) {
        return true;
    }
    // if WCO is visible, we have to show the title bar
    if (isWCOEnabled() && !inFullscreen) {
        return true;
    }
    // remaining behavior is based on menubar visibility
    const menuBarVisibility = !isAuxiliaryWindow(window) ? getMenuBarVisibility(configurationService) : 'hidden';
    switch (menuBarVisibility) {
        case 'classic':
            return !inFullscreen || !!menuBarToggled;
        case 'compact':
        case 'hidden':
            return false;
        case 'toggle':
            return !!menuBarToggled;
        case 'visible':
            return true;
        default:
            return isWeb ? false : !inFullscreen || !!menuBarToggled;
    }
}
function isTitleBarEmpty(configurationService) {
    // with the command center enabled, we should always show
    if (configurationService.getValue("window.commandCenter" /* LayoutSettings.COMMAND_CENTER */)) {
        return false;
    }
    // with the activity bar on top, we should always show
    const activityBarPosition = configurationService.getValue("workbench.activityBar.location" /* LayoutSettings.ACTIVITY_BAR_LOCATION */);
    if (activityBarPosition === "top" /* ActivityBarPosition.TOP */ || activityBarPosition === "bottom" /* ActivityBarPosition.BOTTOM */) {
        return false;
    }
    // with the editor actions on top, we should always show
    const editorActionsLocation = configurationService.getValue("workbench.editor.editorActionsLocation" /* LayoutSettings.EDITOR_ACTIONS_LOCATION */);
    const editorTabsMode = configurationService.getValue("workbench.editor.showTabs" /* LayoutSettings.EDITOR_TABS_MODE */);
    if (editorActionsLocation === "titleBar" /* EditorActionsLocation.TITLEBAR */ || editorActionsLocation === "default" /* EditorActionsLocation.DEFAULT */ && editorTabsMode === "none" /* EditorTabsMode.NONE */) {
        return false;
    }
    // with the layout actions on top, we should always show
    if (configurationService.getValue("workbench.layoutControl.enabled" /* LayoutSettings.LAYOUT_ACTIONS */)) {
        return false;
    }
    return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5b3V0U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUVwRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFJdEYsT0FBTyxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDbkYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDdkUsT0FBTyxFQUE2QyxvQkFBb0IsRUFBRSxpQkFBaUIsRUFBRSxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNwTCxPQUFPLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBSWpGLE1BQU0sQ0FBQyxNQUFNLHVCQUF1QixHQUFHLHNCQUFzQixDQUEwQyxjQUFjLENBQUMsQ0FBQztBQUV2SCxNQUFNLENBQU4sSUFBa0IsS0FTakI7QUFURCxXQUFrQixLQUFLO0lBQ3RCLG1EQUEwQyxDQUFBO0lBQzFDLCtDQUFzQyxDQUFBO0lBQ3RDLHlEQUFnRCxDQUFBO0lBQ2hELGlEQUF3QyxDQUFBO0lBQ3hDLDZDQUFvQyxDQUFBO0lBQ3BDLDJEQUFrRCxDQUFBO0lBQ2xELCtDQUFzQyxDQUFBO0lBQ3RDLHFEQUE0QyxDQUFBO0FBQzdDLENBQUMsRUFUaUIsS0FBSyxLQUFMLEtBQUssUUFTdEI7QUFFRCxNQUFNLENBQU4sSUFBa0IsZUFTakI7QUFURCxXQUFrQixlQUFlO0lBQ2hDLGlEQUE4QixDQUFBO0lBQzlCLCtEQUE0QyxDQUFBO0lBQzVDLDJEQUF3QyxD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