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
var PartsSplash_1;
import { onDidChangeFullscreen, isFullscreen } from '../../../../base/browser/browser.js';
import * as dom from '../../../../base/browser/dom.js';
import { Color } from '../../../../base/common/color.js';
import { Event } from '../../../../base/common/event.js';
import { DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { editorBackground, foreground } from '../../../../platform/theme/common/colorRegistry.js';
import { getThemeTypeSelector, IThemeService } from '../../../../platform/theme/common/themeService.js';
import { DEFAULT_EDITOR_MIN_DIMENSIONS } from '../../../browser/parts/editor/editor.js';
import * as themes from '../../../common/theme.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import * as perf from '../../../../base/common/performance.js';
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { ISplashStorageService } from './splash.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
let PartsSplash = class PartsSplash {
    static { PartsSplash_1 = this; }
    static { this.ID = 'workbench.contrib.partsSplash'; }
    static { this._splashElementId = 'monaco-parts-splash'; }
    constructor(_themeService, _layoutService, _environmentService, _configService, _partSplashService, editorGroupsService, lifecycleService) {
        this._themeService = _themeService;
        this._layoutService = _layoutService;
        this._environmentService = _environmentService;
        this._configService = _configService;
        this._partSplashService = _partSplashService;
        this._disposables = new DisposableStore();
        Event.once(_layoutService.onDidLayoutMainContainer)(() => {
            this._removePartsSplash();
            perf.mark('code/didRemovePartsSplash');
        }, undefined, this._disposables);
        const lastIdleSchedule = this._disposables.add(new MutableDisposable());
        const savePartsSplashSoon = () => {
            lastIdleSchedule.value = dom.runWhenWindowIdle(mainWindow, () => this._savePartsSplash(), 2500);
        };
        lifecycleService.when(3 /* LifecyclePhase.Restored */).then(() => {
            Event.any(Event.filter(onDidChangeFullscreen, windowId => windowId === mainWindow.vscodeWindowId), editorGroupsService.mainPart.onDidLayout, _themeService.onDidColorThemeChange)(savePartsSplashSoon, undefined, this._disposables);
            savePartsSplashSoon();
        });
        _configService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("window.titleBarStyle" /* TitleBarSetting.TITLE_BAR_STYLE */)) {
                this._didChangeTitleBarStyle = true;
                this._savePartsSplash();
            }
        }, this, this._disposables);
    }
    dispose() {
        this._disposables.dispose();
    }
    _savePartsSplash() {
        const theme = this._themeService.getColorTheme();
        this._partSplashService.saveWindowSplash({
            zoomLevel: this._configService.getValue('window.zoomLevel'),
            baseTheme: getThemeTypeSelector(theme.type),
            colorInfo: {
                foreground: theme.getColor(foreground)?.toString(),
                background: Color.Format.CSS.formatHex(theme.getColor(editorBackground) || themes.WORKBENCH_BACKGROUND(theme)),
                editorBackground: theme.getColor(editorBackground)?.toString(),
                titleBarBackground: theme.getColor(themes.TITLE_BAR_ACTIVE_BACKGROUND)?.toString(),
                titleBarBorder: theme.getColor(themes.TITLE_BAR_BORDER)?.toString(),
                activityBarBackground: theme.getColor(themes.ACTIVITY_BAR_BACKGROUND)?.toString(),
                activityBarBorder: theme.getColor(themes.ACTIVITY_BAR_BORDER)?.toString(),
                sideBarBackground: theme.getColor(themes.SIDE_BAR_BACKGROUND)?.toString(),
                sideBarBorder: theme.getColor(themes.SIDE_BAR_BORDER)?.toString(),
                statusBarBackground: theme.getColor(themes.STATUS_BAR_BACKGROUND)?.toString(),
                statusBarBorder: theme.getColor(themes.STATUS_BAR_BORDER)?.toString(),
                statusBarNoFolderBackground: theme.getColor(themes.STATUS_BAR_NO_FOLDER_BACKGROUND)?.toString(),
                windowBorder: theme.getColor(themes.WINDOW_ACTIVE_BORDER)?.toString() ?? theme.getColor(themes.WINDOW_INACTIVE_BORDER)?.toString()
            },
            layoutInfo: !this._shouldSaveLayoutInfo() ? undefined : {
                sideBarSide: this._layoutService.getSideBarPosition() === 1 /* Position.RIGHT */ ? 'right' : 'left',
                editorPartMinWidth: DEFAULT_EDITOR_MIN_DIMENSIONS.width,
                titleBarHeight: this._layoutService.isVisible("workbench.parts.titlebar" /* Parts.TITLEBAR_PART */, mainWindow) ? dom.getTotalHeight(assertReturnsDefined(this._layoutService.getContainer(mainWindow, "workbench.parts.titlebar" /* Parts.TITLEBAR_PART */))) : 0,
                activityBarWidth: this._layoutService.isVisible("workbench.parts.activitybar" /* Parts.ACTIVITYBAR_PART */) ? dom.getTotalWidth(assertReturnsDefined(this._layoutService.getContainer(mainWindow, "workbench.parts.activitybar" /* Parts.ACTIVITYBAR_PART */))) : 0,
                sideBarWidth: this._layoutService.isVisible("workbench.parts.sidebar" /* Parts.SIDEBAR_PART */) ? dom.getTotalWidth(assertReturnsDefined(this._layoutService.getContainer(mainWindow, "workbench.parts.sidebar" /* Parts.SIDEBAR_PART */))) : 0,
                auxiliaryBarWidth: this._layoutService.isAuxiliaryBarMaximized() ? Number.MAX_SAFE_INTEGER /* marker for maximized state */ : this._layoutService.isVisible("workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */) ? dom.getTotalWidth(assertReturnsDefined(this._layoutService.getContainer(mainWindow, "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */))) : 0,
                statusBarHeight: this._layoutService.isVisible("workbench.parts.statusbar" /* Parts.STATUSBAR_PART */, mainWindow) ? dom.getTotalHeight(assertReturnsDefined(this._layoutService.getContainer(mainWindow, "workbench.parts.statusbar" /* Parts.STATUSBAR_PART */))) : 0,
                windowBorder: this._layoutService.hasMainWindowBorder(),
                windowBorderRadius: this._layoutService.getMainWindowBorderRadius()
            }
        });
    }
    _shouldSaveLayoutInfo() {
        return !isFullscreen(mainWindow) && !this._environmentService.isExtensionDevelopment && !this._didChangeTitleBarStyle;
    }
    _removePartsSplash() {
        // eslint-disable-next-line no-restricted-syntax
        const element = mainWindow.document.getElementById(PartsSplash_1._splashElementId);
        if (element) {
            element.style.display = 'none';
        }
        // remove initial colors
        // eslint-disable-next-line no-restricted-syntax
        const defaultStyles = mainWindow.document.head.getElementsByClassName('initialShellColors');
        defaultStyles[0]?.remove();
    }
};
PartsSplash = PartsSplash_1 = __decorate([
    __param(0, IThemeService),
    __param(1, IWorkbenchLayoutService),
    __param(2, IWorkbenchEnvironmentService),
    __param(3, IConfigurationService),
    __param(4, ISplashStorageService),
    __param(5, IEditorGroupsService),
    __param(6, ILifecycleService)
], PartsSplash);
export { PartsSplash };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydHNTcGxhc2guanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvc3BsYXNoL2Jyb3dzZXIvcGFydHNTcGxhc2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxZQUFZLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMxRixPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekQsT0FBTyxFQUFFLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzFGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxVQUFVLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUNsRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDeEcsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDeEYsT0FBTyxLQUFLLE1BQU0sTUFBTSwwQkFBMEIsQ0FBQztBQUNuRCxPQUFPLEVBQUUsdUJBQXVCLEVBQW1CLE1BQU0sbURBQW1ELENBQUM7QUFDN0csT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDMUcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDOUYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxLQUFLLElBQUksTUFBTSx3Q0FBd0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN4RSxPQUFPLEVB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