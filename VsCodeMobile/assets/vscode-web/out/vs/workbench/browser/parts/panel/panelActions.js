/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import './media/panelpart.css';
import { localize, localize2 } from '../../../../nls.js';
import { MenuId, MenuRegistry, registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { isHorizontal, IWorkbenchLayoutService, positionToString } from '../../../services/layout/browser/layoutService.js';
import { IsAuxiliaryWindowContext, PanelAlignmentContext, PanelMaximizedContext, PanelPositionContext, PanelVisibleContext } from '../../../common/contextkeys.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IPaneCompositePartService } from '../../../services/panecomposite/browser/panecomposite.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { SwitchCompositeViewAction } from '../compositeBarActions.js';
const maximizeIcon = registerIcon('panel-maximize', Codicon.screenFull, localize('maximizeIcon', 'Icon to maximize a panel.'));
export const closeIcon = registerIcon('panel-close', Codicon.close, localize('closeIcon', 'Icon to close a panel.'));
const panelIcon = registerIcon('panel-layout-icon', Codicon.layoutPanel, localize('togglePanelOffIcon', 'Icon to toggle the panel off when it is on.'));
const panelOffIcon = registerIcon('panel-layout-icon-off', Codicon.layoutPanelOff, localize('togglePanelOnIcon', 'Icon to toggle the panel on when it is off.'));
export class TogglePanelAction extends Action2 {
    static { this.ID = 'workbench.action.togglePanel'; }
    static { this.LABEL = localize2('togglePanelVisibility', "Toggle Panel Visibility"); }
    constructor() {
        super({
            id: TogglePanelAction.ID,
            title: TogglePanelAction.LABEL,
            toggled: {
                condition: PanelVisibleContext,
                title: localize('closePanel', 'Hide Panel'),
                icon: closeIcon,
                mnemonicTitle: localize({ key: 'miTogglePanelMnemonic', comment: ['&& denotes a mnemonic'] }, "&&Panel"),
            },
            icon: closeIcon,
            f1: true,
            category: Categories.View,
            metadata: {
                description: localize('openAndClosePanel', 'Open/Show and Close/Hide Panel'),
            },
            keybinding: { primary: 2048 /* KeyMod.CtrlCmd */ | 40 /* KeyCode.KeyJ */, weight: 200 /* KeybindingWeight.WorkbenchContrib */ },
            menu: [
                {
                    id: MenuId.MenubarAppearanceMenu,
                    group: '2_workbench_layout',
                    order: 5
                }, {
                    id: MenuId.LayoutControlMenuSubmenu,
                    group: '0_workbench_layout',
                    order: 4
                }
            ]
        });
    }
    async run(accessor) {
        const layoutService = accessor.get(IWorkbenchLayoutService);
        layoutService.setPartHidden(layoutService.isVisible("workbench.parts.panel" /* Parts.PANEL_PART */), "workbench.parts.panel" /* Parts.PANEL_PART */);
    }
}
registerAction2(TogglePanelAction);
MenuRegistry.appendMenuItem(MenuId.PanelTitle, {
    command: {
        id: TogglePanelAction.ID,
        title: localize('closePanel', 'Hide Panel'),
        icon: closeIcon
    },
    group: 'navigation',
    order: 2
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.closePanel',
            title: localize2('closePanel', 'Hide Panel'),
            category: Categories.View,
            precondition: PanelVisibleContext,
            f1: true,
        });
    }
    run(accessor) {
        accessor.get(IWorkbenchLayoutService).setPartHidden(true, "workbench.parts.panel" /* Parts.PANEL_PART */);
    }
});
registerAction2(class extends Action2 {
    static { this.ID = 'workbench.action.focusPanel'; }
    static { this.LABEL = localize('focusPanel', "Focus into Panel"); }
    constructor() {
        super({
            id: 'workbench.action.focusPanel',
            title: localize2('focusPanel', "Focus into Panel"),
            category: Categories.View,
            f1: true,
        });
    }
    async run(accessor) {
        const layoutService = accessor.get(IWorkbenchLayoutService);
        const paneCompositeService = accessor.get(IPaneCompositePartService);
        // Show panel
        if (!layoutService.isVisible("workbench.parts.panel" /* Parts.PANEL_PART */)) {
            layoutService.setPartHidden(false, "workbench.parts.panel" /* Parts.PANEL_PART */);
        }
        // Focus into active panel
        const panel = paneCompositeService.getActivePaneComposite(1 /* ViewContainerLocation.Panel */);
        panel?.focus();
    }
});
const PositionPanelActionId = {
    LEFT: 'workbench.action.positionPanelLeft',
    RIGHT: 'workbench.action.positionPanelRight',
    BOTTOM: 'workbench.action.positionPanelBottom',
    TOP: 'workbench.action.positionPanelTop'
};
const AlignPanelActionId = {
    LEFT: 'workbench.action.alignPanelLeft',
    RIGHT: 'workbench.action.alignPanelRight',
    CENTER: 'workbench.action.alignPanelCenter',
    JUSTIFY: 'workbench.action.alignPanelJustify',
};
function createPanelActionConfig(id, title, shortLabel, value, when) {
    return {
        id,
        title,
        shortLabel,
        value,
        when,
    };
}
function createPositionPanelActionConfig(id, title, shortLabel, position) {
    return createPanelActionConfig(id, title, shortLabel, position, PanelPositionContext.notEqualsTo(positionToString(position)));
}
function createAlignmentPanelActionConfig(id, title, shortLabel, alignment) {
    return createPanelActionConfig(id, title, shortLabel, alignment, PanelAlignmentContext.notEqualsTo(alignment));
}
const PositionPanelActionConfigs = [
    createPositionPanelActionConfig(PositionPanelActionId.TOP, localize2('positionPanelTop', "Move Panel To Top"), localize('positionPanelTopShort', "Top"), 3 /* Position.TOP */),
    createPositionPanelActionConfig(PositionPanelActionId.LEFT, localize2('positionPanelLeft', "Move Panel Left"), localize('positionPanelLeftShort', "Left"), 0 /* Position.LEFT */),
    createPositionPanelActionConfig(PositionPanelActionId.RIGHT, localize2('positionPanelRight', "Move Panel Right"), localize('positionPanelRightShort', "Right"), 1 /* Position.RIGHT */),
    createPositionPanelActionConfig(PositionPanelActionId.BOTTOM, localize2('positionPanelBottom', "Move Panel To Bottom"), localize('positionPanelBottomShort', "Bottom"), 2 /* Position.BOTTOM */),
];
const AlignPanelActionConfigs = [
    createAlignmentPanelActionConfig(AlignPanelActionId.LEFT, localize2('alignPanelLeft', "Set Panel Alignment to Left"), localize('alignPanelLeftShort', "Left"), 'left'),
    createAlignmentPanelActionConfig(AlignPanelActionId.RIGHT, localize2('alignPanelRight', "Set Panel Alignment to Right"), localize('alignPanelRightShort', "Right"), 'right'),
    createAlignmentPanelActionConfig(AlignPanelActionId.CENTER, localize2('alignPanelCenter', "Set Panel Alignment to Center"), localize('alignPanelCenterShort', "Center"), 'center'),
    createAlignmentPanelActionConfig(AlignPanelActionId.JUSTIFY, localize2('alignPanelJustify', "Set Panel Alignment to Justify"), localize('alignPanelJustifyShort', "Justify"), 'justify'),
];
MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
    submenu: MenuId.PanelPositionMenu,
    title: localize('positionPanel', "Panel Position"),
    group: '3_workbench_layout_move',
    order: 4
});
PositionPanelActionConfigs.forEach((positionPanelAction, index) => {
    const { id, title, shortLabel, value, when } = positionPanelAction;
    registerAction2(class extends Action2 {
        constructor() {
            super({
                id,
                title,
                category: Categories.View,
                f1: true
            });
        }
        run(accessor) {
            const layoutService = accessor.get(IWorkbenchLayoutService);
            layoutService.setPanelPosition(value === undefined ? 2 /* Position.BOTTOM */ : value);
        }
    });
    MenuRegistry.appendMenuItem(MenuId.PanelPositionMenu, {
        command: {
            id,
            title: shortLabel,
            toggled: when.negate()
        },
        order: 5 + index
    });
});
MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
    submenu: MenuId.PanelAlignmentMenu,
    title: localize('alignPanel', "Align Panel"),
    group: '3_workbench_layout_move',
    order: 5
});
AlignPanelActionConfigs.forEach(alignPanelAction => {
    const { id, title, shortLabel, value, when } = alignPanelAction;
    registerAction2(class extends Action2 {
        constructor() {
            super({
                id,
                title,
                category: Categories.View,
                toggled: when.negate(),
                f1: true
            });
        }
        run(accessor) {
            const layoutService = accessor.get(IWorkbenchLayoutService);
            layoutService.setPanelAlignment(value === undefined ? 'center' : value);
        }
    });
    MenuRegistry.appendMenuItem(MenuId.PanelAlignmentMenu, {
        command: {
            id,
            title: shortLabel,
            toggled: when.negate()
        },
        order: 5
    });
});
registerAction2(class extends SwitchCompositeViewAction {
    constructor() {
        super({
            id: 'workbench.action.previousPanelView',
            title: localize2('previousPanelView', "Previous Panel View"),
            category: Categories.View,
            f1: true
        }, 1 /* ViewContainerLocation.Panel */, -1);
    }
});
registerAction2(class extends SwitchCompositeViewAction {
    constructor() {
        super({
            id: 'workbench.action.nextPanelView',
            title: localize2('nextPanelView', "Next Panel View"),
            category: Categories.View,
            f1: true
        }, 1 /* ViewContainerLocation.Panel */, 1);
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.toggleMaximizedPanel',
            title: localize2('toggleMaximizedPanel', 'Toggle Maximized Panel'),
            tooltip: localize('maximizePanel', "Maximize Panel Size"),
            category: Categories.View,
            f1: true,
            icon: maximizeIcon,
            // the workbench grid currently prevents us from supporting panel maximization with non-center panel alignment
            precondition: ContextKeyExpr.or(PanelAlignmentContext.isEqualTo('center'), ContextKeyExpr.and(PanelPositionContext.notEqualsTo('bottom'), PanelPositionContext.notEqualsTo('top'))),
            toggled: { condition: PanelMaximizedContext, icon: maximizeIcon, tooltip: localize('minimizePanel', "Restore Panel Size") },
            menu: [{
                    id: MenuId.PanelTitle,
                    group: 'navigation',
                    order: 1,
                    // the workbench grid currently prevents us from supporting panel maximization with non-center panel alignment
                    when: ContextKeyExpr.or(PanelAlignmentContext.isEqualTo('center'), ContextKeyExpr.and(PanelPositionContext.notEqualsTo('bottom'), PanelPositionContext.notEqualsTo('top')))
                }]
        });
    }
    run(accessor) {
        const layoutService = accessor.get(IWorkbenchLayoutService);
        const notificationService = accessor.get(INotificationService);
        if (layoutService.getPanelAlignment() !== 'center' && isHorizontal(layoutService.getPanelPosition())) {
            notificationService.warn(localize('panelMaxNotSupported', "Maximizing the panel is only supported when it is center aligned."));
            return;
        }
        if (!layoutService.isVisible("workbench.parts.panel" /* Parts.PANEL_PART */)) {
            layoutService.setPartHidden(false, "workbench.parts.panel" /* Parts.PANEL_PART */);
            // If the panel is not already maximized, maximize it
            if (!layoutService.isPanelMaximized()) {
                layoutService.toggleMaximizedPanel();
            }
        }
        else {
            layoutService.toggleMaximizedPanel();
        }
    }
});
MenuRegistry.appendMenuItems([
    {
        id: MenuId.LayoutControlMenu,
        item: {
            group: '2_pane_toggles',
            command: {
                id: TogglePanelAction.ID,
                title: localize('togglePanel', "Toggle Panel"),
                icon: panelOffIcon,
                toggled: { condition: PanelVisibleContext, icon: panelIcon }
            },
            when: ContextKeyExpr.and(IsAuxiliaryWindowContext.negate(), ContextKeyExpr.or(ContextKeyExpr.equals('config.workbench.layoutControl.type', 'toggles'), ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both'))),
            order: 1
        }
    }
]);
class MoveViewsBetweenPanelsAction extends Action2 {
    constructor(source, destination, desc) {
        super(desc);
        this.source = source;
        this.destination = destination;
    }
    run(accessor, ...args) {
        const viewDescriptorService = accessor.get(IViewDescriptorService);
        const layoutService = accessor.get(IWorkbenchLayoutService);
        const viewsService = accessor.get(IViewsService);
        const srcContainers = viewDescriptorService.getViewContainersByLocation(this.source);
        const destContainers = viewDescriptorService.getViewContainersByLocation(this.destination);
        if (srcContainers.length) {
            const activeViewContainer = viewsService.getVisibleViewContainer(this.source);
            srcContainers.forEach(viewContainer => viewDescriptorService.moveViewContainerToLocation(viewContainer, this.destination, undefined, this.desc.id));
            layoutService.setPartHidden(false, this.destination === 1 /* ViewContainerLocation.Panel */ ? "workbench.parts.panel" /* Parts.PANEL_PART */ : "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */);
            if (activeViewContainer && destContainers.length === 0) {
                viewsService.openViewContainer(activeViewContainer.id, true);
            }
        }
    }
}
// --- Move Panel Views To Secondary Side Bar
class MovePanelToSidePanelAction extends MoveViewsBetweenPanelsAction {
    static { this.ID = 'workbench.action.movePanelToSidePanel'; }
    constructor() {
        super(1 /* ViewContainerLocation.Panel */, 2 /* ViewContainerLocation.AuxiliaryBar */, {
            id: MovePanelToSidePanelAction.ID,
            title: localize2('movePanelToSecondarySideBar', "Move Panel Views To Secondary Side Bar"),
            category: Categories.View,
            f1: false
        });
    }
}
export class MovePanelToSecondarySideBarAction extends MoveViewsBetweenPanelsAction {
    static { this.ID = 'workbench.action.movePanelToSecondarySideBar'; }
    constructor() {
        super(1 /* ViewContainerLocation.Panel */, 2 /* ViewContainerLocation.AuxiliaryBar */, {
            id: MovePanelToSecondarySideBarAction.ID,
            title: localize2('movePanelToSecondarySideBar', "Move Panel Views To Secondary Side Bar"),
            category: Categories.View,
            f1: true
        });
    }
}
registerAction2(MovePanelToSidePanelAction);
registerAction2(MovePanelToSecondarySideBarAction);
// --- Move Secondary Side Bar Views To Panel
class MoveSidePanelToPanelAction extends MoveViewsBetweenPanelsAction {
    static { this.ID = 'workbench.action.moveSidePanelToPanel'; }
    constructor() {
        super(2 /* ViewContainerLocation.AuxiliaryBar */, 1 /* ViewContainerLocation.Panel */, {
            id: MoveSidePanelToPanelAction.ID,
            title: localize2('moveSidePanelToPanel', "Move Secondary Side Bar Views To Panel"),
            category: Categories.View,
            f1: false
        });
    }
}
export class MoveSecondarySideBarToPanelAction extends MoveViewsBetweenPanelsAction {
    static { this.ID = 'workbench.action.moveSecondarySideBarToPanel'; }
    constructor() {
        super(2 /* ViewContainerLocation.AuxiliaryBar */, 1 /* ViewContainerLocation.Panel */, {
            id: MoveSecondarySideBarToPanelAction.ID,
            title: localize2('moveSidePanelToPanel', "Move Secondary Side Bar Views To Panel"),
            category: Categories.View,
            f1: true
        });
    }
}
registerAction2(MoveSidePanelToPanelAction);
registerAction2(MoveSecondarySideBarToPanelAction);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFuZWxBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9icm93c2VyL3BhcnRzL3BhbmVsL3BhbmVsQWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLHVCQUF1QixDQUFDO0FBQy9CLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFekQsT0FBTyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBbUIsTUFBTSxnREFBZ0QsQ0FBQztBQUNqSSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sOERBQThELENBQUM7QUFDMUYsT0FBTyxFQUFFLFlBQVksRUFBRSx1QkFBdUIsRUFBbUMsZ0JBQWdCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUM3SixPQUFPLEVBQUUsd0JBQXdCLEVBQUUscUJBQXFCLEVBQUUscUJBQXFCLEVBQUUsb0JBQW9CLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNuSyxPQUFPLEVBQUUsY0FBYyxFQUF3QixNQUFNLHNEQUFzRCxDQUFDO0FBQzVHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFFakYsT0FBTyxFQUF5QixzQkFBc0IsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3pGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMvRSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUNyRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUdoRyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUV0RSxN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