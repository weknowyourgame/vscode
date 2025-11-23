/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import './media/actions.css';
import { URI } from '../../../base/common/uri.js';
import { localize, localize2 } from '../../../nls.js';
import { ApplyZoomTarget, MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, applyZoom } from '../../../platform/window/electron-browser/window.js';
import { IKeybindingService } from '../../../platform/keybinding/common/keybinding.js';
import { getZoomLevel } from '../../../base/browser/browser.js';
import { FileKind } from '../../../platform/files/common/files.js';
import { IModelService } from '../../../editor/common/services/model.js';
import { ILanguageService } from '../../../editor/common/languages/language.js';
import { IQuickInputService } from '../../../platform/quickinput/common/quickInput.js';
import { getIconClasses } from '../../../editor/common/services/getIconClasses.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { INativeHostService } from '../../../platform/native/common/native.js';
import { Codicon } from '../../../base/common/codicons.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier } from '../../../platform/workspace/common/workspace.js';
import { Action2, MenuId } from '../../../platform/actions/common/actions.js';
import { Categories } from '../../../platform/action/common/actionCommonCategories.js';
import { isMacintosh } from '../../../base/common/platform.js';
import { getActiveWindow } from '../../../base/browser/dom.js';
import { isOpenedAuxiliaryWindow } from '../../../platform/window/common/window.js';
import { IsAuxiliaryWindowContext, IsAuxiliaryWindowFocusedContext, IsWindowAlwaysOnTopContext } from '../../common/contextkeys.js';
import { isAuxiliaryWindow } from '../../../base/browser/window.js';
import { ContextKeyExpr } from '../../../platform/contextkey/common/contextkey.js';
export class CloseWindowAction extends Action2 {
    static { this.ID = 'workbench.action.closeWindow'; }
    constructor() {
        super({
            id: CloseWindowAction.ID,
            title: {
                ...localize2('closeWindow', "Close Window"),
                mnemonicTitle: localize({ key: 'miCloseWindow', comment: ['&& denotes a mnemonic'] }, "Clos&&e Window"),
            },
            f1: true,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 53 /* KeyCode.KeyW */ },
                linux: { primary: 512 /* KeyMod.Alt */ | 62 /* KeyCode.F4 */, secondary: [2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 53 /* KeyCode.KeyW */] },
                win: { primary: 512 /* KeyMod.Alt */ | 62 /* KeyCode.F4 */, secondary: [2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 53 /* KeyCode.KeyW */] }
            },
            menu: {
                id: MenuId.MenubarFileMenu,
                group: '6_close',
                order: 4
            }
        });
    }
    async run(accessor) {
        const nativeHostService = accessor.get(INativeHostService);
        return nativeHostService.closeWindow({ targetWindowId: getActiveWindow().vscodeWindowId });
    }
}
export class CloseOtherWindowsAction extends Action2 {
    static { this.ID = 'workbench.action.closeOtherWindows'; }
    constructor() {
        super({
            id: CloseOtherWindowsAction.ID,
            title: localize2('closeOtherWindows', "Close Other Windows"),
            f1: true
        });
    }
    async run(accessor) {
        const nativeHostService = accessor.get(INativeHostService);
        const currentWindowId = getActiveWindow().vscodeWindowId;
        const windows = await nativeHostService.getWindows({ includeAuxiliaryWindows: false });
        for (const window of windows) {
            if (window.id !== currentWindowId) {
                nativeHostService.closeWindow({ targetWindowId: window.id });
            }
        }
    }
}
class BaseZoomAction extends Action2 {
    static { this.ZOOM_LEVEL_SETTING_KEY = 'window.zoomLevel'; }
    static { this.ZOOM_PER_WINDOW_SETTING_KEY = 'window.zoomPerWindow'; }
    async setZoomLevel(accessor, levelOrReset) {
        const configurationService = accessor.get(IConfigurationService);
        let target;
        if (configurationService.getValue(BaseZoomAction.ZOOM_PER_WINDOW_SETTING_KEY) !== false) {
            target = ApplyZoomTarget.ACTIVE_WINDOW;
        }
        else {
            target = ApplyZoomTarget.ALL_WINDOWS;
        }
        let level;
        if (typeof levelOrReset === 'number') {
            level = Math.round(levelOrReset); // prevent fractional zoom levels
        }
        else {
            // reset to 0 when we apply to all windows
            if (target === ApplyZoomTarget.ALL_WINDOWS) {
                level = 0;
            }
            // otherwise, reset to the default zoom level
            else {
                const defaultLevel = configurationService.getValue(BaseZoomAction.ZOOM_LEVEL_SETTING_KEY);
                if (typeof defaultLevel === 'number') {
                    level = defaultLevel;
                }
                else {
                    level = 0;
                }
            }
        }
        if (level > MAX_ZOOM_LEVEL || level < MIN_ZOOM_LEVEL) {
            return; // https://github.com/microsoft/vscode/issues/48357
        }
        if (target === ApplyZoomTarget.ALL_WINDOWS) {
            await configurationService.updateValue(BaseZoomAction.ZOOM_LEVEL_SETTING_KEY, level);
        }
        applyZoom(level, target);
    }
}
export class ZoomInAction extends BaseZoomAction {
    constructor() {
        super({
            id: 'workbench.action.zoomIn',
            title: {
                ...localize2('zoomIn', "Zoom In"),
                mnemonicTitle: localize({ key: 'miZoomIn', comment: ['&& denotes a mnemonic'] }, "&&Zoom In"),
            },
            category: Categories.View,
            f1: true,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 86 /* KeyCode.Equal */,
                secondary: [2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 86 /* KeyCode.Equal */, 2048 /* KeyMod.CtrlCmd */ | 109 /* KeyCode.NumpadAdd */]
            },
            menu: {
                id: MenuId.MenubarAppearanceMenu,
                group: '5_zoom',
                order: 1
            }
        });
    }
    run(accessor) {
        return super.setZoomLevel(accessor, getZoomLevel(getActiveWindow()) + 1);
    }
}
export class ZoomOutAction extends BaseZoomAction {
    constructor() {
        super({
            id: 'workbench.action.zoomOut',
            title: {
                ...localize2('zoomOut', "Zoom Out"),
                mnemonicTitle: localize({ key: 'miZoomOut', comment: ['&& denotes a mnemonic'] }, "&&Zoom Out"),
            },
            category: Categories.View,
            f1: true,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 88 /* KeyCode.Minus */,
                secondary: [2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 88 /* KeyCode.Minus */, 2048 /* KeyMod.CtrlCmd */ | 111 /* KeyCode.NumpadSubtract */],
                linux: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 88 /* KeyCode.Minus */,
                    secondary: [2048 /* KeyMod.CtrlCmd */ | 111 /* KeyCode.NumpadSubtract */]
                }
            },
            menu: {
                id: MenuId.MenubarAppearanceMenu,
                group: '5_zoom',
                order: 2
            }
        });
    }
    run(accessor) {
        return super.setZoomLevel(accessor, getZoomLevel(getActiveWindow()) - 1);
    }
}
export class ZoomResetAction extends BaseZoomAction {
    constructor() {
        super({
            id: 'workbench.action.zoomReset',
            title: {
                ...localize2('zoomReset', "Reset Zoom"),
                mnemonicTitle: localize({ key: 'miZoomReset', comment: ['&& denotes a mnemonic'] }, "&&Reset Zoom"),
            },
            category: Categories.View,
            f1: true,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 98 /* KeyCode.Numpad0 */
            },
            menu: {
                id: MenuId.MenubarAppearanceMenu,
                group: '5_zoom',
                order: 3
            }
        });
    }
    run(accessor) {
        return super.setZoomLevel(accessor, true);
    }
}
class BaseSwitchWindow extends Action2 {
    constructor() {
        super(...arguments);
        this.closeWindowAction = {
            iconClass: ThemeIcon.asClassName(Codicon.removeClose),
            tooltip: localize('close', "Close Window")
        };
        this.closeDirtyWindowAction = {
            iconClass: 'dirty-window ' + ThemeIcon.asClassName(Codicon.closeDirty),
            tooltip: localize('close', "Close Window"),
            alwaysVisible: true
        };
        this.closeActiveWindowAction = {
            iconClass: 'active-window ' + ThemeIcon.asClassName(Codicon.windowActive),
            tooltip: localize('closeActive', "Close Active Window"),
            alwaysVisible: true
        };
    }
    async run(accessor) {
        const quickInputService = accessor.get(IQuickInputService);
        const keybindingService = accessor.get(IKeybindingService);
        const modelService = accessor.get(IModelService);
        const languageService = accessor.get(ILanguageService);
        const nativeHostService = accessor.get(INativeHostService);
        const currentWindowId = getActiveWindow().vscodeWindowId;
        const windows = await nativeHostService.getWindows({ includeAuxiliaryWindows: true });
        const mainWindows = new Set();
        const mapMainWindowToAuxiliaryWindows = new Map();
        for (const window of windows) {
            if (isOpenedAuxiliaryWindow(window)) {
                let auxiliaryWindows = mapMainWindowToAuxiliaryWindows.get(window.parentId);
                if (!auxiliaryWindows) {
                    auxiliaryWindows = new Set();
                    mapMainWindowToAuxiliaryWindows.set(window.parentId, auxiliaryWindows);
                }
                auxiliaryWindows.add(window);
            }
            else {
                mainWindows.add(window);
            }
        }
        function isWindowPickItem(candidate) {
            const windowPickItem = candidate;
            return typeof windowPickItem?.windowId === 'number';
        }
        const picks = [];
        for (const window of mainWindows) {
            const auxiliaryWindows = mapMainWindowToAuxiliaryWindows.get(window.id);
            if (mapMainWindowToAuxiliaryWindows.size > 0) {
                picks.push({ type: 'separator', label: auxiliaryWindows ? localize('windowGroup', "window group") : undefined });
            }
            const resource = window.filename ? URI.file(window.filename) : isSingleFolderWorkspaceIdentifier(window.workspace) ? window.workspace.uri : isWorkspaceIdentifier(window.workspace) ? window.workspace.configPath : undefined;
            const fileKind = window.filename ? FileKind.FILE : isSingleFolderWorkspaceIdentifier(window.workspace) ? FileKind.FOLDER : isWorkspaceIdentifier(window.workspace) ? FileKind.ROOT_FOLDER : FileKind.FILE;
            const pick = {
                windowId: window.id,
                label: window.title,
                ariaLabel: window.dirty ? localize('windowDirtyAriaLabel', "{0}, window with unsaved changes", window.title) : window.title,
                iconClasses: getIconClasses(modelService, languageService, resource, fileKind),
                description: (currentWindowId === window.id) ? localize('current', "Current Window") : undefined,
                buttons: window.dirty ? [this.closeDirtyWindowAction] : currentWindowId === window.id ? [this.closeActiveWindowAction] : [this.closeWindowAction]
            };
            picks.push(pick);
            if (auxiliaryWindows) {
                for (const auxiliaryWindow of auxiliaryWindows) {
                    const pick = {
                        windowId: auxiliaryWindow.id,
                        label: auxiliaryWindow.title,
                        iconClasses: getIconClasses(modelService, languageService, auxiliaryWindow.filename ? URI.file(auxiliaryWindow.filename) : undefined, FileKind.FILE),
                        description: (currentWindowId === auxiliaryWindow.id) ? localize('current', "Current Window") : undefined,
                        buttons: currentWindowId === auxiliaryWindow.id ? [this.closeActiveWindowAction] : [this.closeWindowAction]
                    };
                    picks.push(pick);
                }
            }
        }
        const pick = await quickInputService.pick(picks, {
            contextKey: 'inWindowsPicker',
            activeItem: (() => {
                for (let i = 0; i < picks.length; i++) {
                    const pick = picks[i];
                    if (isWindowPickItem(pick) && pick.windowId === currentWindowId) {
                        let nextPick = picks[i + 1]; // try to select next window unless it's a separator
                        if (isWindowPickItem(nextPick)) {
                            return nextPick;
                        }
                        nextPick = picks[i + 2]; // otherwise try to select the next window after the separator
                        if (isWindowPickItem(nextPick)) {
                            return nextPick;
                        }
                    }
                }
                return undefined;
            })(),
            placeHolder: localize('switchWindowPlaceHolder', "Select a window to switch to"),
            quickNavigate: this.isQuickNavigate() ? { keybindings: keybindingService.lookupKeybindings(this.desc.id) } : undefined,
            hideInput: this.isQuickNavigate(),
            onDidTriggerItemButton: async (context) => {
                await nativeHostService.closeWindow({ targetWindowId: context.item.windowId });
                context.removeItem();
            }
        });
        if (pick) {
            nativeHostService.focusWindow({ targetWindowId: pick.windowId });
        }
    }
}
export class SwitchWindowAction extends BaseSwitchWindow {
    constructor() {
        super({
            id: 'workbench.action.switchWindow',
            title: localize2('switchWindow', 'Switch Window...'),
            f1: true,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 0,
                mac: { primary: 256 /* KeyMod.WinCtrl */ | 53 /* KeyCode.KeyW */ }
            }
        });
    }
    isQuickNavigate() {
        return false;
    }
}
export class QuickSwitchWindowAction extends BaseSwitchWindow {
    constructor() {
        super({
            id: 'workbench.action.quickSwitchWindow',
            title: localize2('quickSwitchWindow', 'Quick Switch Window...'),
            f1: false // hide quick pickers from command palette to not confuse with the other entry that shows a input field
        });
    }
    isQuickNavigate() {
        return true;
    }
}
function canRunNativeTabsHandler(accessor) {
    if (!isMacintosh) {
        return false;
    }
    const configurationService = accessor.get(IConfigurationService);
    return configurationService.getValue('window.nativeTabs') === true;
}
export const NewWindowTabHandler = function (accessor) {
    if (!canRunNativeTabsHandler(accessor)) {
        return;
    }
    return accessor.get(INativeHostService).newWindowTab();
};
export const ShowPreviousWindowTabHandler = function (accessor) {
    if (!canRunNativeTabsHandler(accessor)) {
        return;
    }
    return accessor.get(INativeHostService).showPreviousWindowTab();
};
export const ShowNextWindowTabHandler = function (accessor) {
    if (!canRunNativeTabsHandler(accessor)) {
        return;
    }
    return accessor.get(INativeHostService).showNextWindowTab();
};
export const MoveWindowTabToNewWindowHandler = function (accessor) {
    if (!canRunNativeTabsHandler(accessor)) {
        return;
    }
    return accessor.get(INativeHostService).moveWindowTabToNewWindow();
};
export const MergeWindowTabsHandlerHandler = function (accessor) {
    if (!canRunNativeTabsHandler(accessor)) {
        return;
    }
    return accessor.get(INativeHostService).mergeAllWindowTabs();
};
export const ToggleWindowTabsBarHandler = function (accessor) {
    if (!canRunNativeTabsHandler(accessor)) {
        return;
    }
    return accessor.get(INativeHostService).toggleWindowTabsBar();
};
export class ToggleWindowAlwaysOnTopAction extends Action2 {
    static { this.ID = 'workbench.action.toggleWindowAlwaysOnTop'; }
    constructor() {
        super({
            id: ToggleWindowAlwaysOnTopAction.ID,
            title: localize2('toggleWindowAlwaysOnTop', "Toggle Window Always on Top"),
            f1: true,
            precondition: IsAuxiliaryWindowFocusedContext
        });
    }
    async run(accessor) {
        const nativeHostService = accessor.get(INativeHostService);
        const targetWindow = getActiveWindow();
        if (!isAuxiliaryWindow(targetWindow.window)) {
            return; // Currently, we only support toggling always on top for auxiliary windows
        }
        return nativeHostService.toggleWindowAlwaysOnTop({ targetWindowId: getActiveWindow().vscodeWindowId });
    }
}
export class EnableWindowAlwaysOnTopAction extends Action2 {
    static { this.ID = 'workbench.action.enableWindowAlwaysOnTop'; }
    constructor() {
        super({
            id: EnableWindowAlwaysOnTopAction.ID,
            title: localize('enableWindowAlwaysOnTop', "Turn On Always on Top"),
            icon: Codicon.pin,
            menu: {
                id: MenuId.LayoutControlMenu,
                when: ContextKeyExpr.and(IsWindowAlwaysOnTopContext.toNegated(), IsAuxiliaryWindowContext),
                order: 1
            }
        });
    }
    async run(accessor) {
        const nativeHostService = accessor.get(INativeHostService);
        const targetWindow = getActiveWindow();
        if (!isAuxiliaryWindow(targetWindow.window)) {
            return; // Currently, we only support toggling always on top for auxiliary windows
        }
        return nativeHostService.setWindowAlwaysOnTop(true, { targetWindowId: targetWindow.vscodeWindowId });
    }
}
export class DisableWindowAlwaysOnTopAction extends Action2 {
    static { this.ID = 'workbench.action.disableWindowAlwaysOnTop'; }
    constructor() {
        super({
            id: DisableWindowAlwaysOnTopAction.ID,
            title: localize('disableWindowAlwaysOnTop', "Turn Off Always on Top"),
            icon: Codicon.pinned,
            menu: {
                id: MenuId.LayoutControlMenu,
                when: ContextKeyExpr.and(IsWindowAlwaysOnTopContext, IsAuxiliaryWindowContext),
                order: 1
            }
        });
    }
    async run(accessor) {
        const nativeHostService = accessor.get(INativeHostService);
        const targetWindow = getActiveWindow();
        if (!isAuxiliaryWindow(targetWindow.window)) {
            return; // Currently, we only support toggling always on top for auxiliary windows
        }
        return nativeHostService.setWindowAlwaysOnTop(false, { targetWindowId: targetWindow.vscodeWindowId });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2luZG93QWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvZWxlY3Ryb24tYnJvd3Nlci9hY3Rpb25zL3dpbmRvd0FjdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxxQkFBcUIsQ0FBQztBQUM3QixPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDbEQsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsZUFBZSxFQUFFLGNBQWMsRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDakksT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDdkYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDekUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDaEYsT0FBTyxFQUFFLGtCQUFrQixFQUFxRCxNQUFNLG1EQUFtRCxDQUFDO0FBQzFJLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUduRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUNoRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMvRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDM0QsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxpQ0FBaUMsRUFBRSxxQkFB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