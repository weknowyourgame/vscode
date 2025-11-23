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
import { Separator, SubmenuAction } from '../../../../base/common/actions.js';
import * as dom from '../../../../base/browser/dom.js';
import { IContextMenuService, IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { getZoomFactor } from '../../../../base/browser/browser.js';
import { unmnemonicLabel } from '../../../../base/common/labels.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { createSingleCallFunction } from '../../../../base/common/functional.js';
import { popup } from '../../../../base/parts/contextmenu/electron-browser/contextmenu.js';
import { hasNativeContextMenu } from '../../../../platform/window/common/window.js';
import { isMacintosh, isWindows } from '../../../../base/common/platform.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextMenuMenuDelegate, ContextMenuService as HTMLContextMenuService } from '../../../../platform/contextview/browser/contextMenuService.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { stripIcons } from '../../../../base/common/iconLabels.js';
import { coalesce } from '../../../../base/common/arrays.js';
import { Emitter } from '../../../../base/common/event.js';
import { isAnchor } from '../../../../base/browser/ui/contextview/contextview.js';
import { IMenuService } from '../../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
let ContextMenuService = class ContextMenuService {
    get onDidShowContextMenu() { return this.impl.onDidShowContextMenu; }
    get onDidHideContextMenu() { return this.impl.onDidHideContextMenu; }
    constructor(notificationService, telemetryService, keybindingService, configurationService, contextViewService, menuService, contextKeyService) {
        function createContextMenuService(native) {
            return native ?
                new NativeContextMenuService(notificationService, telemetryService, keybindingService, menuService, contextKeyService)
                : new HTMLContextMenuService(telemetryService, notificationService, contextViewService, keybindingService, menuService, contextKeyService);
        }
        // set initial context menu service
        let isNativeContextMenu = hasNativeContextMenu(configurationService);
        this.impl = createContextMenuService(isNativeContextMenu);
        // MacOS does not need a restart when the menu style changes
        // It should update the context menu style on menu style configuration change
        if (isMacintosh) {
            this.listener = configurationService.onDidChangeConfiguration(e => {
                if (!e.affectsConfiguration("window.menuStyle" /* MenuSettings.MenuStyle */)) {
                    return;
                }
                const newIsNativeContextMenu = hasNativeContextMenu(configurationService);
                if (newIsNativeContextMenu === isNativeContextMenu) {
                    return;
                }
                this.impl.dispose();
                this.impl = createContextMenuService(newIsNativeContextMenu);
                isNativeContextMenu = newIsNativeContextMenu;
            });
        }
    }
    dispose() {
        this.listener?.dispose();
        this.impl.dispose();
    }
    showContextMenu(delegate) {
        this.impl.showContextMenu(delegate);
    }
};
ContextMenuService = __decorate([
    __param(0, INotificationService),
    __param(1, ITelemetryService),
    __param(2, IKeybindingService),
    __param(3, IConfigurationService),
    __param(4, IContextViewService),
    __param(5, IMenuService),
    __param(6, IContextKeyService)
], ContextMenuService);
export { ContextMenuService };
let NativeContextMenuService = class NativeContextMenuService extends Disposable {
    constructor(notificationService, telemetryService, keybindingService, menuService, contextKeyService) {
        super();
        this.notificationService = notificationService;
        this.telemetryService = telemetryService;
        this.keybindingService = keybindingService;
        this.menuService = menuService;
        this.contextKeyService = contextKeyService;
        this._onDidShowContextMenu = this._store.add(new Emitter());
        this.onDidShowContextMenu = this._onDidShowContextMenu.event;
        this._onDidHideContextMenu = this._store.add(new Emitter());
        this.onDidHideContextMenu = this._onDidHideContextMenu.event;
    }
    showContextMenu(delegate) {
        delegate = ContextMenuMenuDelegate.transform(delegate, this.menuService, this.contextKeyService);
        const actions = delegate.getActions();
        if (actions.length) {
            const onHide = createSingleCallFunction(() => {
                delegate.onHide?.(false);
                dom.ModifierKeyEmitter.getInstance().resetKeyStatus();
                this._onDidHideContextMenu.fire();
            });
            const menu = this.createMenu(delegate, actions, onHide);
            const anchor = delegate.getAnchor();
            let x;
            let y;
            let zoom = getZoomFactor(dom.isHTMLElement(anchor) ? dom.getWindow(anchor) : dom.getActiveWindow());
            if (dom.isHTMLElement(anchor)) {
                const clientRect = anchor.getBoundingClientRect();
                const elementPosition = { left: clientRect.left, top: clientRect.top, width: clientRect.width, height: clientRect.height };
                // Determine if element is clipped by viewport; if so we'll use the bottom-right of the visible portion
                const win = dom.getWindow(anchor);
                const vw = win.innerWidth;
                const vh = win.innerHeight;
                const isClipped = clientRect.left < 0 || clientRect.top < 0 || clientRect.right > vw || clientRect.bottom > vh;
                // When drawing context menus, we adjust the pixel position for native menus using zoom level
                // In areas where zoom is applied to the element or its ancestors, we need to adjust accordingly
                // e.g. The title bar has counter zoom behavior meaning it applies the inverse of zoom level.
                // Window Zoom Level: 1.5, Title Bar Zoom: 1/1.5, Coordinate Multiplier: 1.5 * 1.0 / 1.5 = 1.0
                zoom *= dom.getDomNodeZoomLevel(anchor);
                if (isClipped) {
                    // Element is partially out of viewport: always place at bottom-right visible corner
                    x = Math.min(Math.max(clientRect.right, 0), vw);
                    y = Math.min(Math.max(clientRect.bottom, 0), vh);
                }
                else {
                    // Position according to the axis alignment and the anchor alignment:
                    // `HORIZONTAL` aligns at the top left or right of the anchor and
                    //  `VERTICAL` aligns at the bottom left of the anchor.
                    if (delegate.anchorAxisAlignment === 1 /* AnchorAxisAlignment.HORIZONTAL */) {
                        if (delegate.anchorAlignment === 0 /* AnchorAlignment.LEFT */) {
                            x = elementPosition.left;
                            y = elementPosition.top;
                        }
                        else {
                            x = elementPosition.left + elementPosition.width;
                            y = elementPosition.top;
                        }
                        if (!isMacintosh) {
                            const window = dom.getWindow(anchor);
                            const availableHeightForMenu = window.screen.height - y;
                            if (availableHeightForMenu < actions.length * (isWindows ? 45 : 32) /* guess of 1 menu item height */) {
                                // this is a guess to detect whether the context menu would
                                // open to the bottom from this point or to the top. If the
                                // menu opens to the top, make sure to align it to the bottom
                                // of the anchor and not to the top.
                                // this seems to be only necessary for Windows and Linux.
                                y += elementPosition.height;
                            }
                        }
                    }
                    else {
                        if (delegate.anchorAlignment === 0 /* AnchorAlignment.LEFT */) {
                            x = elementPosition.left;
                            y = elementPosition.top + elementPosition.height;
                        }
                        else {
                            x = elementPosition.left + elementPosition.width;
                            y = elementPosition.top + elementPosition.height;
                        }
                    }
                }
                // Shift macOS menus by a few pixels below elements
                // to account for extra padding on top of native menu
                // https://github.com/microsoft/vscode/issues/84231
                if (isMacintosh) {
                    y += 4 / zoom;
                }
            }
            else if (isAnchor(anchor)) {
                x = anchor.x;
                y = anchor.y;
            }
            else {
                // We leave x/y undefined in this case which will result in
                // Electron taking care of opening the menu at the cursor position.
            }
            if (typeof x === 'number') {
                x = Math.floor(x * zoom);
            }
            if (typeof y === 'number') {
                y = Math.floor(y * zoom);
            }
            popup(menu, { x, y, positioningItem: delegate.autoSelectFirstItem ? 0 : undefined, }, () => onHide());
            this._onDidShowContextMenu.fire();
        }
    }
    createMenu(delegate, entries, onHide, submenuIds = new Set()) {
        return coalesce(entries.map(entry => this.createMenuItem(delegate, entry, onHide, submenuIds)));
    }
    createMenuItem(delegate, entry, onHide, submenuIds) {
        // Separator
        if (entry instanceof Separator) {
            return { type: 'separator' };
        }
        // Submenu
        if (entry instanceof SubmenuAction) {
            if (submenuIds.has(entry.id)) {
                console.warn(`Found submenu cycle: ${entry.id}`);
                return undefined;
            }
            return {
                label: unmnemonicLabel(stripIcons(entry.label)).trim(),
                submenu: this.createMenu(delegate, entry.actions, onHide, new Set([...submenuIds, entry.id]))
            };
        }
        // Normal Menu Item
        else {
            let type = undefined;
            if (entry.checked) {
                if (typeof delegate.getCheckedActionsRepresentation === 'function') {
                    type = delegate.getCheckedActionsRepresentation(entry);
                }
                else {
                    type = 'checkbox';
                }
            }
            const item = {
                label: unmnemonicLabel(stripIcons(entry.label)).trim(),
                checked: !!entry.checked,
                type,
                enabled: !!entry.enabled,
                click: event => {
                    // To preserve pre-electron-2.x behaviour, we first trigger
                    // the onHide callback and then the action.
                    // Fixes https://github.com/microsoft/vscode/issues/45601
                    onHide();
                    // Run action which will close the menu
                    this.runAction(entry, delegate, event);
                }
            };
            const keybinding = delegate.getKeyBinding ? delegate.getKeyBinding(entry) : this.keybindingService.lookupKeybinding(entry.id);
            if (keybinding) {
                const electronAccelerator = keybinding.getElectronAccelerator();
                if (electronAccelerator) {
                    item.accelerator = electronAccelerator;
                }
                else {
                    const label = keybinding.getLabel();
                    if (label) {
                        item.label = `${item.label} [${label}]`;
                    }
                }
            }
            return item;
        }
    }
    async runAction(actionToRun, delegate, event) {
        if (!delegate.skipTelemetry) {
            this.telemetryService.publicLog2('workbenchActionExecuted', { id: actionToRun.id, from: 'contextMenu' });
        }
        const context = delegate.getActionsContext ? delegate.getActionsContext(event) : undefined;
        try {
            if (delegate.actionRunner) {
                await delegate.actionRunner.run(actionToRun, context);
            }
            else if (actionToRun.enabled) {
                await actionToRun.run(context);
            }
        }
        catch (error) {
            this.notificationService.error(error);
        }
    }
};
NativeContextMenuService = __decorate([
    __param(0, INotificationService),
    __param(1, ITelemetryService),
    __param(2, IKeybindingService),
    __param(3, IMenuService),
    __param(4, IContextKeyService)
], NativeContextMenuService);
registerSingleton(IContextMenuService, ContextMenuService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGV4dG1lbnVTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9jb250ZXh0bWVudS9lbGVjdHJvbi1icm93c2VyL2NvbnRleHRtZW51U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQWdGLFNBQVMsRUFBRSxhQUFhLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM1SixPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBNEIsbUJBQW1CLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM3SSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN2RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDcEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBRWhHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBRWpGLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxvRUFBb0UsQ0FBQztBQUMzRixPQUFPLEVBQUUsb0JBQW9CLEVBQWdCLE1BQU0sOENBQThDLENBQUM7QUFDbEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM3RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsa0JBQWtCLElBQUksc0JBQXNCLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUN2SixPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM3RCxPQUFPLEVBQVMsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUF3QyxRQUFRLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUN4SCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDOUUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLFVBQVUsRUFBZSxNQUFNLHNDQUFzQyxDQUFDO0FBRXhFLElBQU0sa0JBQWtCLEdBQXhCLE1BQU0sa0JBQWtCO0lBTzlCLElBQUksb0JBQW9CLEtBQWtCLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7SUFDbEYsSUFBSSxvQkFBb0IsS0FBa0IsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztJQUVsRixZQUN1QixtQkFBeUMsRUFDNUMsZ0JBQW1DLEVBQ2xDLGlCQUFxQyxFQUNsQyxvQkFBMkMsRUFDN0Msa0JBQXVDLEVBQzlDLFdBQXlCLEVBQ25CLGlCQUFxQztRQUV6RCxTQUFTLHdCQUF3QixDQUFDLE1BQWU7WUFDaEQsT0FBTyxNQUFNLENBQUMsQ0FBQztnQkFDZCxJQUFJLHdCQUF3QixDQUFDLG1CQUFtQixFQUFFLGdCQUFnQixFQUFFLGlCQUFpQixFQUFFLFdBQVcsRUFBRSxpQkFBaUIsQ0FBQztnQkFDdEgsQ0FBQyxDQUFDLElBQUksc0JBQXNCLENBQUMsZ0JBQWdCLEVBQUUsbUJBQW1CLEVBQUUsa0JBQWtCLEVBQUUsaUJBQWlCLEVBQUUsV0FBVyxFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDN0ksQ0FBQztRQUVELG1DQUFtQztRQUNuQyxJQUFJLG1CQUFtQixHQUFHLG9CQUFvQixDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDckUsSUFBSSxDQUFDLElBQUksR0FBRyx3QkFBd0IsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBRTFELDREQUE0RDtRQUM1RCw2RUFBNkU7UUFDN0UsSUFBSSxXQUFXLEVBQUUsQ0FBQztZQUNqQixJQUFJLENBQUMsUUFBUSxHQUFHLG9CQUFvQixDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUNqRSxJQUFJLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixpREFBd0IsRUFBRSxDQUFDO29CQUNyRCxPQUFPO2dCQUNSLENBQUM7Z0JBRUQsTUFBTSxzQkFBc0IsR0FBRyxvQkFBb0IsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO2dCQUMxRSxJQUFJLHNCQUFzQixLQUFLLG1CQUFtQixFQUFFLENBQUM7b0JBQ3BELE9BQU87Z0JBQ1IsQ0FBQztnQkFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNwQixJQUFJLENBQUMsSUFBSSxHQUFHLHdCQUF3QixDQUFDLHNCQUFzQixDQUFDLENBQUM7Z0JBQzdELG1CQUFtQixHQUFHLHNCQUFzQixDQUFDO1lBQzlDLENBQUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQztJQUNGLENBQUM7SUFFRCxPQUFPO1FBQ04sSUFBSSxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ3JCLENBQUM7SUFFRCxlQUFlLENBQUMsUUFBeUQ7UUFDeEUsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDckMsQ0FBQztDQUNELENBQUE7QUF6RFksa0JBQWtCO0lBVzVCLFdBQUEsb0JBQW9CLENBQUE7SUFDcEIsV0FBQSxpQkFBaUIsQ0FBQTtJQUNqQixXQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxtQkFBbUIsQ0FBQTtJQUNuQixXQUFBLFlBQVksQ0FBQTtJQUNaLFdBQUEsa0JBQWtCLENBQUE7R0FqQlIsa0JBQWtCLENBeUQ5Qjs7QUFFRCxJQUFNLHdCQUF3QixHQUE5QixNQUFNLHdCQUF5QixTQUFRLFVBQVU7SUFVaEQsWUFDdUIsbUJBQTBELEVBQzdELGdCQUFvRCxFQUNuRCxpQkFBc0QsRUFDNUQsV0FBMEMsRUFDcEMsaUJBQXNEO1FBRTFFLEtBQUssRUFBRSxDQUFDO1FBTitCLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBc0I7UUFDNUMscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFtQjtRQUNsQyxzQkFBaUIsR0FBakIsaUJBQWlCLENBQW9CO1FBQzNDLGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBQ25CLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBb0I7UUFYMUQsMEJBQXFCLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLEVBQVEsQ0FBQyxDQUFDO1FBQ3JFLHlCQUFvQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUM7UUFFaEQsMEJBQXFCLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLEVBQVEsQ0FBQyxDQUFDO1FBQ3JFLHlCQUFvQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUM7SUFVakUsQ0FBQztJQUVELGVBQWUsQ0FBQyxRQUF5RDtRQUV4RSxRQUFRLEdBQUcsdUJBQXVCLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBRWpHLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUN0QyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNwQixNQUFNLE1BQU0sR0FBRyx3QkFBd0IsQ0FBQyxHQUFHLEVBQUU7Z0JBQzVDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFFekIsR0FBRyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsRUFBRSxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUN0RCxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDbkMsQ0FBQyxDQUFDLENBQUM7WUFFSCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDeEQsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBRXBDLElBQUksQ0FBcUIsQ0FBQztZQUMxQixJQUFJLENBQXFCLENBQUM7WUFFMUIsSUFBSSxJQUFJLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDO1lBQ3BHLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO2dCQUMvQixNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMscUJBQXFCLEVBQUUsQ0FBQztnQkFDbEQsTUFBTSxlQUFlLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsVUFBVSxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsVUFBVSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUUzSCx1R0FBdUc7Z0JBQ3ZHLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ2xDLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxVQUFVLENBQUM7Z0JBQzFCLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxXQUFXLENBQUM7Z0JBQzNCLE1BQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO2dCQUUvRyw2RkFBNkY7Z0JBQzdGLGdHQUFnRztnQkFDaEcsNkZBQTZGO2dCQUM3Riw4RkFBOEY7Z0JBQzlGLElBQUksSUFBSSxHQUFHLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBRXhDLElBQUksU0FBUyxFQUFFLENBQUM7b0JBQ2Ysb0ZBQW9GO29CQUNwRixDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ2hELENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDbEQsQ0FBQztxQkFBTSxDQUFDO29CQUNQLHFFQUFxRTtvQkFDckUsaUVBQWlFO29CQUNqRSx1REFBdUQ7b0JBQ3ZELElBQUksUUFBUSxDQUFDLG1CQUFtQiwyQ0FBbUMsRUFBRSxDQUFDO3dCQUNyRSxJQUFJLFFBQVEsQ0FBQyxlQUFlLGlDQUF5QixFQUFFLENBQUM7NEJBQ3ZELENBQUMsR0FBRyxlQUFlLENBQUMsSUFBSSxDQUFDOzRCQUN6QixDQUFDLEdBQUcsZUFBZSxDQUFDLEdBQUcsQ0FBQzt3QkFDekIsQ0FBQzs2QkFBTSxDQUFDOzRCQUNQLENBQUMsR0FBRyxlQUFlLENBQUMsSUFBSSxHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUM7NEJBQ2pELENBQUMsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDO3dCQUN6QixDQUFDO3dCQUVELElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQzs0QkFDbEIsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQzs0QkFDckMsTUFBTSxzQkFBc0IsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7NEJBQ3hELElBQUksc0JBQXNCLEdBQUcsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxpQ0FBaUMsRUFBRSxDQUFDO2dDQUN2RywyREFBMkQ7Z0NBQzNELDJEQUEyRDtnQ0FDM0QsNkRBQTZEO2dDQUM3RCxvQ0FBb0M7Z0NBQ3BDLHlEQUF5RDtnQ0FDekQsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxNQUFNLENBQUM7NEJBQzdCLENBQUM7d0JBQ0YsQ0FBQztvQkFDRixDQUFDO3lCQUFNLENBQUM7d0JBQ1AsSUFBSSxRQUFRLENBQUMsZUFBZSxpQ0FBeUIsRUFBRSxDQUFDOzRCQUN2RCxDQUFDLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQzs0QkFDekIsQ0FBQyxHQUFHLGVBQWUsQ0FBQyxHQUFHLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQzt3QkFDbEQsQ0FBQzs2QkFBTSxDQUFDOzRCQUNQLENBQUMsR0FBRyxlQUFlLENBQUMsSUFBSSxHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUM7NEJBQ2pELENBQUMsR0FBRyxlQUFlLENBQUMsR0FBRyxHQUFHLGVBQWUsQ0FBQyxNQUFNLENBQUM7d0JBQ2xELENBQUM7b0JBQ0YsQ0FBQztnQkFDRixDQUFDO2dCQUVELG1EQUFtRDtnQkFDbkQscURBQXFEO2dCQUNyRCxtREFBbUQ7Z0JBQ25ELElBQUksV0FBVyxFQUFFLENBQUM7b0JBQ2pCLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDO2dCQUNmLENBQUM7WUFDRixDQUFDO2lCQUFNLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7Z0JBQzdCLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUNiLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ2QsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLDJEQUEyRDtnQkFDM0QsbUVBQW1FO1lBQ3BFLENBQUM7WUFFRCxJQUFJLE9BQU8sQ0FBQyxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUMzQixDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFDMUIsQ0FBQztZQUVELElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxFQUFFLENBQUM7Z0JBQzNCLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztZQUMxQixDQUFDO1lBRUQsS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsZUFBZSxFQUFFLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1lBRXRHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNuQyxDQUFDO0lBQ0YsQ0FBQztJQUVPLFVBQVUsQ0FBQyxRQUE4QixFQUFFLE9BQTJCLEVBQUUsTUFBa0IsRUFBRSxhQUFhLElBQUksR0FBRyxFQUFVO1FBQ2pJLE9BQU8sUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqRyxDQUFDO0lBRU8sY0FBYyxDQUFDLFFBQThCLEVBQUUsS0FBYyxFQUFFLE1BQWtCLEVBQUUsVUFBdUI7UUFDakgsWUFBWTtRQUNaLElBQUksS0FBSyxZQUFZLFNBQVMsRUFBRSxDQUFDO1lBQ2hDLE9BQU8sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLENBQUM7UUFDOUIsQ0FBQztRQUVELFVBQVU7UUFDVixJQUFJLEtBQUssWUFBWSxhQUFhLEVBQUUsQ0FBQztZQUNwQyxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7Z0JBQzlCLE9BQU8sQ0FBQyxJQUFJLENBQUMsd0JBQXdCLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUNqRCxPQUFPLFNBQVMsQ0FBQztZQUNsQixDQUFDO1lBRUQsT0FBTztnQkFDTixLQUFLLEVBQUUsZUFBZSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUU7Z0JBQ3RELE9BQU8sRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUcsVUFBVSxFQUFFLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2FBQzdGLENBQUM7UUFDSCxDQUFDO1FBRUQsbUJBQW1CO2FBQ2QsQ0FBQztZQUNMLElBQUksSUFBSSxHQUFxQyxTQUFTLENBQUM7WUFDdkQsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ25CLElBQUksT0FBTyxRQUFRLENBQUMsK0JBQStCLEtBQUssVUFBVSxFQUFFLENBQUM7b0JBQ3BFLElBQUksR0FBRyxRQUFRLENBQUMsK0JBQStCLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3hELENBQUM7cUJBQU0sQ0FBQztvQkFDUCxJQUFJLEdBQUcsVUFBVSxDQUFDO2dCQUNuQixDQUFDO1lBQ0YsQ0FBQztZQUVELE1BQU0sSUFBSSxHQUFxQjtnQkFDOUIsS0FBSyxFQUFFLGVBQWUsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFO2dCQUN0RCxPQUFPLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPO2dCQUN4QixJQUFJO2dCQUNKLE9BQU8sRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU87Z0JBQ3hCLEtBQUssRUFBRSxLQUFLLENBQUMsRUFBRTtvQkFFZCwyREFBMkQ7b0JBQzNELDJDQUEyQztvQkFDM0MseURBQXlEO29CQUN6RCxNQUFNLEVBQUUsQ0FBQztvQkFFVCx1Q0FBdUM7b0JBQ3ZDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDeEMsQ0FBQzthQUNELENBQUM7WUFFRixNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzlILElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQ2hCLE1BQU0sbUJBQW1CLEdBQUcsVUFBVSxDQUFDLHNCQUFzQixFQUFFLENBQUM7Z0JBQ2hFLElBQUksbUJBQW1CLEVBQUUsQ0FBQztvQkFDekIsSUFBSSxDQUFDLFdBQVcsR0FBRyxtQkFBbUIsQ0FBQztnQkFDeEMsQ0FBQztxQkFBTSxDQUFDO29CQUNQLE1BQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFDcEMsSUFBSSxLQUFLLEVBQUUsQ0FBQzt3QkFDWCxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssS0FBSyxLQUFLLEdBQUcsQ0FBQztvQkFDekMsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztZQUVELE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztJQUNGLENBQUM7SUFFTyxLQUFLLENBQUMsU0FBUyxDQUFDLFdBQW9CLEVBQUUsUUFBOEIsRUFBRSxLQUF3QjtRQUNyRyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQzdCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQXNFLHlCQUF5QixFQUFFLEVBQUUsRUFBRSxFQUFFLFdBQVcsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxDQUFDLENBQUM7UUFDL0ssQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFFM0YsSUFBSSxDQUFDO1lBQ0osSUFBSSxRQUFRLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQzNCLE1BQU0sUUFBUSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3ZELENBQUM7aUJBQU0sSUFBSSxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2hDLE1BQU0sV0FBVyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNoQyxDQUFDO1FBQ0YsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN2QyxDQUFDO0lBQ0YsQ0FBQztDQUNELENBQUE7QUFqTkssd0JBQXdCO0lBVzNCLFdBQUEsb0JBQW9CLENBQUE7SUFDcEIsV0FBQSxpQkFBaUIsQ0FBQTtJQUNqQixXQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFdBQUEsWUFBWSxDQUFBO0lBQ1osV0FBQSxrQkFBa0IsQ0FBQTtHQWZmLHdCQUF3QixDQWlON0I7QUFFRCxpQkFBaUIsQ0FBQyxtQkFBbUIsRUFBRSxrQkFBa0Isb0NBQTRCLENBQUMifQ==