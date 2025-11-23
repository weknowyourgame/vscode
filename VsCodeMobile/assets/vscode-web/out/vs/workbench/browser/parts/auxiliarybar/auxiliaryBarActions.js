/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { alert } from '../../../../base/browser/ui/aria/aria.js';
import { AuxiliaryBarMaximizedContext, AuxiliaryBarVisibleContext, IsAuxiliaryWindowContext } from '../../../common/contextkeys.js';
import { ViewContainerLocationToString } from '../../../common/views.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { IPaneCompositePartService } from '../../../services/panecomposite/browser/panecomposite.js';
import { SwitchCompositeViewAction } from '../compositeBarActions.js';
import { closeIcon as panelCloseIcon } from '../panel/panelActions.js';
const maximizeIcon = registerIcon('auxiliarybar-maximize', Codicon.screenFull, localize('maximizeIcon', 'Icon to maximize the secondary side bar.'));
const closeIcon = registerIcon('auxiliarybar-close', panelCloseIcon, localize('closeIcon', 'Icon to close the secondary side bar.'));
const auxiliaryBarRightIcon = registerIcon('auxiliarybar-right-layout-icon', Codicon.layoutSidebarRight, localize('toggleAuxiliaryIconRight', 'Icon to toggle the secondary side bar off in its right position.'));
const auxiliaryBarRightOffIcon = registerIcon('auxiliarybar-right-off-layout-icon', Codicon.layoutSidebarRightOff, localize('toggleAuxiliaryIconRightOn', 'Icon to toggle the secondary side bar on in its right position.'));
const auxiliaryBarLeftIcon = registerIcon('auxiliarybar-left-layout-icon', Codicon.layoutSidebarLeft, localize('toggleAuxiliaryIconLeft', 'Icon to toggle the secondary side bar in its left position.'));
const auxiliaryBarLeftOffIcon = registerIcon('auxiliarybar-left-off-layout-icon', Codicon.layoutSidebarLeftOff, localize('toggleAuxiliaryIconLeftOn', 'Icon to toggle the secondary side bar on in its left position.'));
export class ToggleAuxiliaryBarAction extends Action2 {
    static { this.ID = 'workbench.action.toggleAuxiliaryBar'; }
    static { this.LABEL = localize2('toggleAuxiliaryBar', "Toggle Secondary Side Bar Visibility"); }
    constructor() {
        super({
            id: ToggleAuxiliaryBarAction.ID,
            title: ToggleAuxiliaryBarAction.LABEL,
            toggled: {
                condition: AuxiliaryBarVisibleContext,
                title: localize('closeSecondarySideBar', 'Hide Secondary Side Bar'),
                icon: closeIcon,
                mnemonicTitle: localize({ key: 'miCloseSecondarySideBar', comment: ['&& denotes a mnemonic'] }, "&&Secondary Side Bar"),
            },
            icon: closeIcon,
            category: Categories.View,
            metadata: {
                description: localize('openAndCloseAuxiliaryBar', 'Open/Show and Close/Hide Secondary Side Bar'),
            },
            f1: true,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 32 /* KeyCode.KeyB */
            },
            menu: [
                {
                    id: MenuId.LayoutControlMenuSubmenu,
                    group: '0_workbench_layout',
                    order: 1
                },
                {
                    id: MenuId.MenubarAppearanceMenu,
                    group: '2_workbench_layout',
                    order: 2
                }
            ]
        });
    }
    async run(accessor) {
        const layoutService = accessor.get(IWorkbenchLayoutService);
        const isCurrentlyVisible = layoutService.isVisible("workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */);
        layoutService.setPartHidden(isCurrentlyVisible, "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */);
        // Announce visibility change to screen readers
        const alertMessage = isCurrentlyVisible
            ? localize('auxiliaryBarHidden', "Secondary Side Bar hidden")
            : localize('auxiliaryBarVisible', "Secondary Side Bar shown");
        alert(alertMessage);
    }
}
registerAction2(ToggleAuxiliaryBarAction);
MenuRegistry.appendMenuItem(MenuId.AuxiliaryBarTitle, {
    command: {
        id: ToggleAuxiliaryBarAction.ID,
        title: localize('closeSecondarySideBar', 'Hide Secondary Side Bar'),
        icon: closeIcon
    },
    group: 'navigation',
    order: 2,
    when: ContextKeyExpr.equals(`config.${"workbench.activityBar.location" /* LayoutSettings.ACTIVITY_BAR_LOCATION */}`, "default" /* ActivityBarPosition.DEFAULT */)
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.closeAuxiliaryBar',
            title: localize2('closeSecondarySideBar', 'Hide Secondary Side Bar'),
            category: Categories.View,
            precondition: AuxiliaryBarVisibleContext,
            f1: true,
        });
    }
    run(accessor) {
        accessor.get(IWorkbenchLayoutService).setPartHidden(true, "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */);
    }
});
registerAction2(class FocusAuxiliaryBarAction extends Action2 {
    static { this.ID = 'workbench.action.focusAuxiliaryBar'; }
    static { this.LABEL = localize2('focusAuxiliaryBar', "Focus into Secondary Side Bar"); }
    constructor() {
        super({
            id: FocusAuxiliaryBarAction.ID,
            title: FocusAuxiliaryBarAction.LABEL,
            category: Categories.View,
            f1: true,
        });
    }
    async run(accessor) {
        const paneCompositeService = accessor.get(IPaneCompositePartService);
        const layoutService = accessor.get(IWorkbenchLayoutService);
        // Show auxiliary bar
        if (!layoutService.isVisible("workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */)) {
            layoutService.setPartHidden(false, "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */);
        }
        // Focus into active composite
        const composite = paneCompositeService.getActivePaneComposite(2 /* ViewContainerLocation.AuxiliaryBar */);
        composite?.focus();
    }
});
MenuRegistry.appendMenuItems([
    {
        id: MenuId.LayoutControlMenu,
        item: {
            group: '2_pane_toggles',
            command: {
                id: ToggleAuxiliaryBarAction.ID,
                title: localize('toggleSecondarySideBar', "Toggle Secondary Side Bar"),
                toggled: { condition: AuxiliaryBarVisibleContext, icon: auxiliaryBarLeftIcon },
                icon: auxiliaryBarLeftOffIcon,
            },
            when: ContextKeyExpr.and(IsAuxiliaryWindowContext.negate(), ContextKeyExpr.or(ContextKeyExpr.equals('config.workbench.layoutControl.type', 'toggles'), ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both')), ContextKeyExpr.equals('config.workbench.sideBar.location', 'right')),
            order: 0
        }
    }, {
        id: MenuId.LayoutControlMenu,
        item: {
            group: '2_pane_toggles',
            command: {
                id: ToggleAuxiliaryBarAction.ID,
                title: localize('toggleSecondarySideBar', "Toggle Secondary Side Bar"),
                toggled: { condition: AuxiliaryBarVisibleContext, icon: auxiliaryBarRightIcon },
                icon: auxiliaryBarRightOffIcon,
            },
            when: ContextKeyExpr.and(IsAuxiliaryWindowContext.negate(), ContextKeyExpr.or(ContextKeyExpr.equals('config.workbench.layoutControl.type', 'toggles'), ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both')), ContextKeyExpr.equals('config.workbench.sideBar.location', 'left')),
            order: 2
        }
    }, {
        id: MenuId.ViewContainerTitleContext,
        item: {
            group: '3_workbench_layout_move',
            command: {
                id: ToggleAuxiliaryBarAction.ID,
                title: localize2('hideAuxiliaryBar', 'Hide Secondary Side Bar'),
            },
            when: ContextKeyExpr.and(AuxiliaryBarVisibleContext, ContextKeyExpr.equals('viewContainerLocation', ViewContainerLocationToString(2 /* ViewContainerLocation.AuxiliaryBar */))),
            order: 2
        }
    }
]);
registerAction2(class extends SwitchCompositeViewAction {
    constructor() {
        super({
            id: 'workbench.action.previousAuxiliaryBarView',
            title: localize2('previousAuxiliaryBarView', 'Previous Secondary Side Bar View'),
            category: Categories.View,
            f1: true
        }, 2 /* ViewContainerLocation.AuxiliaryBar */, -1);
    }
});
registerAction2(class extends SwitchCompositeViewAction {
    constructor() {
        super({
            id: 'workbench.action.nextAuxiliaryBarView',
            title: localize2('nextAuxiliaryBarView', 'Next Secondary Side Bar View'),
            category: Categories.View,
            f1: true
        }, 2 /* ViewContainerLocation.AuxiliaryBar */, 1);
    }
});
// --- Maximized Mode
class MaximizeAuxiliaryBar extends Action2 {
    static { this.ID = 'workbench.action.maximizeAuxiliaryBar'; }
    constructor() {
        super({
            id: MaximizeAuxiliaryBar.ID,
            title: localize2('maximizeAuxiliaryBar', 'Maximize Secondary Side Bar'),
            tooltip: localize('maximizeAuxiliaryBarTooltip', "Maximize Secondary Side Bar Size"),
            category: Categories.View,
            f1: true,
            precondition: AuxiliaryBarMaximizedContext.negate(),
            icon: maximizeIcon,
            menu: {
                id: MenuId.AuxiliaryBarTitle,
                group: 'navigation',
                order: 1,
                when: AuxiliaryBarMaximizedContext.negate()
            }
        });
    }
    run(accessor) {
        const layoutService = accessor.get(IWorkbenchLayoutService);
        layoutService.setAuxiliaryBarMaximized(true);
    }
}
registerAction2(MaximizeAuxiliaryBar);
class RestoreAuxiliaryBar extends Action2 {
    static { this.ID = 'workbench.action.restoreAuxiliaryBar'; }
    constructor() {
        super({
            id: RestoreAuxiliaryBar.ID,
            title: localize2('restoreAuxiliaryBar', 'Restore Secondary Side Bar'),
            tooltip: localize('restoreAuxiliaryBarTooltip', "Restore Secondary Side Bar Size"),
            category: Categories.View,
            f1: true,
            precondition: AuxiliaryBarMaximizedContext,
            toggled: AuxiliaryBarMaximizedContext,
            icon: maximizeIcon,
            menu: {
                id: MenuId.AuxiliaryBarTitle,
                group: 'navigation',
                order: 1,
                when: AuxiliaryBarMaximizedContext
            }
        });
    }
    run(accessor) {
        const layoutService = accessor.get(IWorkbenchLayoutService);
        layoutService.setAuxiliaryBarMaximized(false);
    }
}
registerAction2(RestoreAuxiliaryBar);
class ToggleMaximizedAuxiliaryBar extends Action2 {
    static { this.ID = 'workbench.action.toggleMaximizedAuxiliaryBar'; }
    constructor() {
        super({
            id: ToggleMaximizedAuxiliaryBar.ID,
            title: localize2('toggleMaximizedAuxiliaryBar', 'Toggle Maximized Secondary Side Bar'),
            f1: true,
            category: Categories.View
        });
    }
    run(accessor) {
        const layoutService = accessor.get(IWorkbenchLayoutService);
        layoutService.toggleMaximizedAuxiliaryBar();
    }
}
registerAction2(ToggleMaximizedAuxiliaryBar);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV4aWxpYXJ5QmFyQWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9hdXhpbGlhcnliYXIvYXV4aWxpYXJ5QmFyQWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUN6RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEgsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNqRixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sOERBQThELENBQUM7QUFDMUYsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSwwQkFBMEIsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3BJLE9BQU8sRUFBeUIsNkJBQTZCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNoRyxPQUFPLEVBQXVCLHVCQUF1QixFQUF5QixNQUFNLG1EQUFtRCxDQUFDO0FBQ3hJLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBSXJHLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ3RFLE9BQU8sRUFBRSxTQUFTLElBQUksY0FBYyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFFdkUsTUFBTSxZQUFZLEdBQUcsWUFBWSxDQUFDLHVCQUF1QixFQUFFLE9BQU8s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