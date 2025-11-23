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
var AuxiliaryBarPart_1;
import './media/auxiliaryBarPart.css';
import { localize } from '../../../../nls.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { contrastBorder } from '../../../../platform/theme/common/colorRegistry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ActiveAuxiliaryContext, AuxiliaryBarFocusContext } from '../../../common/contextkeys.js';
import { ACTIVITY_BAR_BADGE_BACKGROUND, ACTIVITY_BAR_BADGE_FOREGROUND, ACTIVITY_BAR_TOP_ACTIVE_BORDER, ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER, ACTIVITY_BAR_TOP_FOREGROUND, ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND, PANEL_ACTIVE_TITLE_BORDER, PANEL_ACTIVE_TITLE_FOREGROUND, PANEL_DRAG_AND_DROP_BORDER, PANEL_INACTIVE_TITLE_FOREGROUND, SIDE_BAR_BACKGROUND, SIDE_BAR_BORDER, SIDE_BAR_TITLE_BORDER, SIDE_BAR_FOREGROUND } from '../../../common/theme.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { Separator, SubmenuAction, toAction } from '../../../../base/common/actions.js';
import { ToggleAuxiliaryBarAction } from './auxiliaryBarActions.js';
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { ToggleSidebarPositionAction } from '../../actions/layoutActions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { AbstractPaneCompositePart, CompositeBarPosition } from '../paneCompositePart.js';
import { IMenuService, MenuId } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { getContextMenuActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
let AuxiliaryBarPart = class AuxiliaryBarPart extends AbstractPaneCompositePart {
    static { AuxiliaryBarPart_1 = this; }
    static { this.activeViewSettingsKey = 'workbench.auxiliarybar.activepanelid'; }
    static { this.pinnedViewsKey = 'workbench.auxiliarybar.pinnedPanels'; }
    static { this.placeholdeViewContainersKey = 'workbench.auxiliarybar.placeholderPanels'; }
    static { this.viewContainersWorkspaceStateKey = 'workbench.auxiliarybar.viewContainersWorkspaceState'; }
    get preferredHeight() {
        // Don't worry about titlebar or statusbar visibility
        // The difference is minimal and keeps this function clean
        return this.layoutService.mainContainerDimension.height * 0.4;
    }
    get preferredWidth() {
        const activeComposite = this.getActivePaneComposite();
        if (!activeComposite) {
            return undefined;
        }
        const width = activeComposite.getOptimalWidth();
        if (typeof width !== 'number') {
            return undefined;
        }
        return Math.max(width, 300);
    }
    constructor(notificationService, storageService, contextMenuService, layoutService, keybindingService, hoverService, instantiationService, themeService, viewDescriptorService, contextKeyService, extensionService, commandService, menuService, configurationService) {
        super("workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */, {
            hasTitle: true,
            trailingSeparator: true,
            borderWidth: () => (this.getColor(SIDE_BAR_BORDER) || this.getColor(contrastBorder)) ? 1 : 0,
        }, AuxiliaryBarPart_1.activeViewSettingsKey, ActiveAuxiliaryContext.bindTo(contextKeyService), AuxiliaryBarFocusContext.bindTo(contextKeyService), 'auxiliarybar', 'auxiliarybar', undefined, SIDE_BAR_TITLE_BORDER, notificationService, storageService, contextMenuService, layoutService, keybindingService, hoverService, instantiationService, themeService, viewDescriptorService, contextKeyService, extensionService, menuService);
        this.commandService = commandService;
        this.configurationService = configurationService;
        // Use the side bar dimensions
        this.minimumWidth = 170;
        this.maximumWidth = Number.POSITIVE_INFINITY;
        this.minimumHeight = 0;
        this.maximumHeight = Number.POSITIVE_INFINITY;
        this.priority = 1 /* LayoutPriority.Low */;
        this.configuration = this.resolveConfiguration();
        this._register(configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("workbench.activityBar.location" /* LayoutSettings.ACTIVITY_BAR_LOCATION */)) {
                this.configuration = this.resolveConfiguration();
                this.onDidChangeActivityBarLocation();
            }
            else if (e.affectsConfiguration('workbench.secondarySideBar.showLabels')) {
                this.configuration = this.resolveConfiguration();
                this.updateCompositeBar(true);
            }
        }));
    }
    resolveConfiguration() {
        const position = this.configurationService.getValue("workbench.activityBar.location" /* LayoutSettings.ACTIVITY_BAR_LOCATION */);
        const canShowLabels = position !== "top" /* ActivityBarPosition.TOP */ && position !== "bottom" /* ActivityBarPosition.BOTTOM */; // use same style as activity bar in this case
        const showLabels = canShowLabels && this.configurationService.getValue('workbench.secondarySideBar.showLabels') !== false;
        return { position, canShowLabels, showLabels };
    }
    onDidChangeActivityBarLocation() {
        this.updateCompositeBar();
        const id = this.getActiveComposite()?.getId();
        if (id) {
            this.onTitleAreaUpdate(id);
        }
    }
    updateStyles() {
        super.updateStyles();
        const container = assertReturnsDefined(this.getContainer());
        container.style.backgroundColor = this.getColor(SIDE_BAR_BACKGROUND) || '';
        const borderColor = this.getColor(SIDE_BAR_BORDER) || this.getColor(contrastBorder);
        const isPositionLeft = this.layoutService.getSideBarPosition() === 1 /* Position.RIGHT */;
        container.style.color = this.getColor(SIDE_BAR_FOREGROUND) || '';
        container.style.borderLeftColor = borderColor ?? '';
        container.style.borderRightColor = borderColor ?? '';
        container.style.borderLeftStyle = borderColor && !isPositionLeft ? 'solid' : 'none';
        container.style.borderRightStyle = borderColor && isPositionLeft ? 'solid' : 'none';
        container.style.borderLeftWidth = borderColor && !isPositionLeft ? '1px' : '0px';
        container.style.borderRightWidth = borderColor && isPositionLeft ? '1px' : '0px';
    }
    getCompositeBarOptions() {
        const $this = this;
        return {
            partContainerClass: 'auxiliarybar',
            pinnedViewContainersKey: AuxiliaryBarPart_1.pinnedViewsKey,
            placeholderViewContainersKey: AuxiliaryBarPart_1.placeholdeViewContainersKey,
            viewContainersWorkspaceStateKey: AuxiliaryBarPart_1.viewContainersWorkspaceStateKey,
            icon: !this.configuration.showLabels,
            orientation: 0 /* ActionsOrientation.HORIZONTAL */,
            recomputeSizes: true,
            activityHoverOptions: {
                position: () => this.getCompositeBarPosition() === CompositeBarPosition.BOTTOM ? 3 /* HoverPosition.ABOVE */ : 2 /* HoverPosition.BELOW */,
            },
            fillExtraContextMenuActions: actions => this.fillExtraContextMenuActions(actions),
            compositeSize: 0,
            iconSize: 16,
            // Add 10px spacing if the overflow action is visible to no confuse the user with ... between the toolbars
            get overflowActionSize() { return $this.getCompositeBarPosition() === CompositeBarPosition.TITLE ? 40 : 30; },
            colors: theme => ({
                activeBackgroundColor: theme.getColor(SIDE_BAR_BACKGROUND),
                inactiveBackgroundColor: theme.getColor(SIDE_BAR_BACKGROUND),
                get activeBorderBottomColor() { return $this.getCompositeBarPosition() === CompositeBarPosition.TITLE ? theme.getColor(PANEL_ACTIVE_TITLE_BORDER) : theme.getColor(ACTIVITY_BAR_TOP_ACTIVE_BORDER); },
                get activeForegroundColor() { return $this.getCompositeBarPosition() === CompositeBarPosition.TITLE ? theme.getColor(PANEL_ACTIVE_TITLE_FOREGROUND) : theme.getColor(ACTIVITY_BAR_TOP_FOREGROUND); },
                get inactiveForegroundColor() { return $this.getCompositeBarPosition() === CompositeBarPosition.TITLE ? theme.getColor(PANEL_INACTIVE_TITLE_FOREGROUND) : theme.getColor(ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND); },
                badgeBackground: theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND),
                badgeForeground: theme.getColor(ACTIVITY_BAR_BADGE_FOREGROUND),
                get dragAndDropBorder() { return $this.getCompositeBarPosition() === CompositeBarPosition.TITLE ? theme.getColor(PANEL_DRAG_AND_DROP_BORDER) : theme.getColor(ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER); }
            }),
            compact: true
        };
    }
    fillExtraContextMenuActions(actions) {
        const currentPositionRight = this.layoutService.getSideBarPosition() === 0 /* Position.LEFT */;
        if (this.getCompositeBarPosition() === CompositeBarPosition.TITLE) {
            const viewsSubmenuAction = this.getViewsSubmenuAction();
            if (viewsSubmenuAction) {
                actions.push(new Separator());
                actions.push(viewsSubmenuAction);
            }
        }
        const activityBarPositionMenu = this.menuService.getMenuActions(MenuId.ActivityBarPositionMenu, this.contextKeyService, { shouldForwardArgs: true, renderShortTitle: true });
        const positionActions = getContextMenuActions(activityBarPositionMenu).secondary;
        const toggleShowLabelsAction = toAction({
            id: 'workbench.action.auxiliarybar.toggleShowLabels',
            label: this.configuration.showLabels ? localize('showIcons', "Show Icons") : localize('showLabels', "Show Labels"),
            enabled: this.configuration.canShowLabels,
            run: () => this.configurationService.updateValue('workbench.secondarySideBar.showLabels', !this.configuration.showLabels)
        });
        actions.push(...[
            new Separator(),
            new SubmenuAction('workbench.action.panel.position', localize('activity bar position', "Activity Bar Position"), positionActions),
            toAction({ id: ToggleSidebarPositionAction.ID, label: currentPositionRight ? localize('move second side bar left', "Move Secondary Side Bar Left") : localize('move second side bar right', "Move Secondary Side Bar Right"), run: () => this.commandService.executeCommand(ToggleSidebarPositionAction.ID) }),
            toggleShowLabelsAction,
            toAction({ id: ToggleAuxiliaryBarAction.ID, label: localize('hide second side bar', "Hide Secondary Side Bar"), run: () => this.commandService.executeCommand(ToggleAuxiliaryBarAction.ID) })
        ]);
    }
    shouldShowCompositeBar() {
        return this.configuration.position !== "hidden" /* ActivityBarPosition.HIDDEN */;
    }
    getCompositeBarPosition() {
        switch (this.configuration.position) {
            case "top" /* ActivityBarPosition.TOP */: return CompositeBarPosition.TOP;
            case "bottom" /* ActivityBarPosition.BOTTOM */: return CompositeBarPosition.BOTTOM;
            case "hidden" /* ActivityBarPosition.HIDDEN */: return CompositeBarPosition.TITLE;
            case "default" /* ActivityBarPosition.DEFAULT */: return CompositeBarPosition.TITLE;
            default: return CompositeBarPosition.TITLE;
        }
    }
    toJSON() {
        return {
            type: "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */
        };
    }
};
AuxiliaryBarPart = AuxiliaryBarPart_1 = __decorate([
    __param(0, INotificationService),
    __param(1, IStorageService),
    __param(2, IContextMenuService),
    __param(3, IWorkbenchLayoutService),
    __param(4, IKeybindingService),
    __param(5, IHoverService),
    __param(6, IInstantiationService),
    __param(7, IThemeService),
    __param(8, IViewDescriptorService),
    __param(9, IContextKeyService),
    __param(10, IExtensionService),
    __param(11, ICommandService),
    __param(12, IMenuService),
    __param(13, IConfigurationService)
], AuxiliaryBarPart);
export { AuxiliaryBarPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV4aWxpYXJ5QmFyUGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9hdXhpbGlhcnliYXIvYXV4aWxpYXJ5QmFyUGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyw4QkFBOEIsQ0FBQztBQUN0QyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDOUYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUNwRixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFFLHNCQUFzQixFQUFFLHdCQUF3QixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDbEcsT0FBTyxFQUFFLDZCQUE2QixFQUFFLDZCQUE2QixFQUFFLDhCQUE4QixFQUFFLHFDQUFxQyxFQUFFLDJCQUEyQixFQUFFLG9DQUFvQyxFQUFFLHlCQUF5QixFQUFFLDZCQUE2QixFQUFFLDBCQUEwQixFQUFFLCtCQUErQixFQUFFLG1CQUFtQixFQUFFLGVBQWUsRUFBRSxxQkFBcUIsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzNiLE9BQU8sRUFB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