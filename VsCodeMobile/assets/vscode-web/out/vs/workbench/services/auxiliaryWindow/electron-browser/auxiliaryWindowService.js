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
var NativeAuxiliaryWindow_1;
import { localize } from '../../../../nls.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkbenchLayoutService } from '../../layout/browser/layoutService.js';
import { AuxiliaryWindow, AuxiliaryWindowMode, BrowserAuxiliaryWindowService, IAuxiliaryWindowService } from '../browser/auxiliaryWindowService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INativeHostService } from '../../../../platform/native/common/native.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { mark } from '../../../../base/common/performance.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IHostService } from '../../host/browser/host.js';
import { applyZoom } from '../../../../platform/window/electron-browser/window.js';
import { getZoomLevel, isFullscreen, setFullscreen } from '../../../../base/browser/browser.js';
import { getActiveWindow } from '../../../../base/browser/dom.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { isMacintosh } from '../../../../base/common/platform.js';
import { assert } from '../../../../base/common/assert.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
let NativeAuxiliaryWindow = NativeAuxiliaryWindow_1 = class NativeAuxiliaryWindow extends AuxiliaryWindow {
    constructor(window, container, stylesHaveLoaded, configurationService, nativeHostService, instantiationService, hostService, environmentService, dialogService, contextMenuService, layoutService) {
        super(window, container, stylesHaveLoaded, configurationService, hostService, environmentService, contextMenuService, layoutService);
        this.nativeHostService = nativeHostService;
        this.instantiationService = instantiationService;
        this.dialogService = dialogService;
        this.skipUnloadConfirmation = false;
        this.maximized = false;
        this.alwaysOnTop = false;
        if (!isMacintosh) {
            // For now, limit this to platforms that have clear maximised
            // transitions (Windows, Linux) via window buttons.
            this.handleMaximizedState();
        }
        this.handleFullScreenState();
        this.handleAlwaysOnTopState();
    }
    handleMaximizedState() {
        (async () => {
            this.maximized = await this.nativeHostService.isMaximized({ targetWindowId: this.window.vscodeWindowId });
        })();
        this._register(this.nativeHostService.onDidMaximizeWindow(windowId => {
            if (windowId === this.window.vscodeWindowId) {
                this.maximized = true;
            }
        }));
        this._register(this.nativeHostService.onDidUnmaximizeWindow(windowId => {
            if (windowId === this.window.vscodeWindowId) {
                this.maximized = false;
            }
        }));
    }
    handleAlwaysOnTopState() {
        (async () => {
            this.alwaysOnTop = await this.nativeHostService.isWindowAlwaysOnTop({ targetWindowId: this.window.vscodeWindowId });
        })();
        this._register(this.nativeHostService.onDidChangeWindowAlwaysOnTop(({ windowId, alwaysOnTop }) => {
            if (windowId === this.window.vscodeWindowId) {
                this.alwaysOnTop = alwaysOnTop;
            }
        }));
    }
    async handleFullScreenState() {
        const fullscreen = await this.nativeHostService.isFullScreen({ targetWindowId: this.window.vscodeWindowId });
        if (fullscreen) {
            setFullscreen(true, this.window);
        }
    }
    async handleVetoBeforeClose(e, veto) {
        this.preventUnload(e);
        await this.dialogService.error(veto, localize('backupErrorDetails', "Try saving or reverting the editors with unsaved changes first and then try again."));
    }
    async confirmBeforeClose(e) {
        if (this.skipUnloadConfirmation) {
            return;
        }
        this.preventUnload(e);
        const confirmed = await this.instantiationService.invokeFunction(accessor => NativeAuxiliaryWindow_1.confirmOnShutdown(accessor, 1 /* ShutdownReason.CLOSE */));
        if (confirmed) {
            this.skipUnloadConfirmation = true;
            this.nativeHostService.closeWindow({ targetWindowId: this.window.vscodeWindowId });
        }
    }
    preventUnload(e) {
        e.preventDefault();
        e.returnValue = true;
    }
    createState() {
        const state = super.createState();
        const fullscreen = isFullscreen(this.window);
        return {
            ...state,
            bounds: state.bounds,
            mode: this.maximized ? AuxiliaryWindowMode.Maximized : fullscreen ? AuxiliaryWindowMode.Fullscreen : AuxiliaryWindowMode.Normal,
            alwaysOnTop: this.alwaysOnTop
        };
    }
};
NativeAuxiliaryWindow = NativeAuxiliaryWindow_1 = __decorate([
    __param(3, IConfigurationService),
    __param(4, INativeHostService),
    __param(5, IInstantiationService),
    __param(6, IHostService),
    __param(7, IWorkbenchEnvironmentService),
    __param(8, IDialogService),
    __param(9, IContextMenuService),
    __param(10, IWorkbenchLayoutService)
], NativeAuxiliaryWindow);
export { NativeAuxiliaryWindow };
let NativeAuxiliaryWindowService = class NativeAuxiliaryWindowService extends BrowserAuxiliaryWindowService {
    constructor(layoutService, configurationService, nativeHostService, dialogService, instantiationService, telemetryService, hostService, environmentService, contextMenuService) {
        super(layoutService, dialogService, configurationService, telemetryService, hostService, environmentService, contextMenuService);
        this.nativeHostService = nativeHostService;
        this.instantiationService = instantiationService;
    }
    async resolveWindowId(auxiliaryWindow) {
        mark('code/auxiliaryWindow/willResolveWindowId');
        const windowId = await auxiliaryWindow.vscode.ipcRenderer.invoke('vscode:registerAuxiliaryWindow', this.nativeHostService.windowId);
        mark('code/auxiliaryWindow/didResolveWindowId');
        assert(typeof windowId === 'number');
        return windowId;
    }
    createContainer(auxiliaryWindow, disposables, options) {
        // Zoom level (either explicitly provided or inherited from main window)
        let windowZoomLevel;
        if (typeof options?.zoomLevel === 'number') {
            windowZoomLevel = options.zoomLevel;
        }
        else {
            windowZoomLevel = getZoomLevel(getActiveWindow());
        }
        applyZoom(windowZoomLevel, auxiliaryWindow);
        return super.createContainer(auxiliaryWindow, disposables);
    }
    createAuxiliaryWindow(targetWindow, container, stylesHaveLoaded) {
        return new NativeAuxiliaryWindow(targetWindow, container, stylesHaveLoaded, this.configurationService, this.nativeHostService, this.instantiationService, this.hostService, this.environmentService, this.dialogService, this.contextMenuService, this.layoutService);
    }
};
NativeAuxiliaryWindowService = __decorate([
    __param(0, IWorkbenchLayoutService),
    __param(1, IConfigurationService),
    __param(2, INativeHostService),
    __param(3, IDialogService),
    __param(4, IInstantiationService),
    __param(5, ITelemetryService),
    __param(6, IHostService),
    __param(7, IWorkbenchEnvironmentService),
    __param(8, IContextMenuService)
], NativeAuxiliaryWindowService);
export { NativeAuxiliaryWindowService };
registerSingleton(IAuxiliaryWindowService, NativeAuxiliaryWindowService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV4aWxpYXJ5V2luZG93U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvYXV4aWxpYXJ5V2luZG93L2VsZWN0cm9uLWJyb3dzZXIvYXV4aWxpYXJ5V2luZG93U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRixPQUFPLEVBQUUsZUFBZSxFQUFFLG1CQUFtQixFQUFFLDZCQUE2QixFQUErQix1QkFBdUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRWpMLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRW5HLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUVoRixPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDOUQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFFbkcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFFdkYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQzFELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUNuRixPQUFPLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0saUNB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