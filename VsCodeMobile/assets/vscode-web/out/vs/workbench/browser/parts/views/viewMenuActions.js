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
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { getActionBarActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { MenuId, IMenuService } from '../../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService, ViewContainerLocationToString } from '../../../common/views.js';
let ViewMenuActions = class ViewMenuActions extends Disposable {
    constructor(menuId, contextMenuId, options, contextKeyService, menuService) {
        super();
        this.menuId = menuId;
        this.contextMenuId = contextMenuId;
        this.options = options;
        this.contextKeyService = contextKeyService;
        this.menuService = menuService;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this.menu = this._register(menuService.createMenu(menuId, contextKeyService, { emitEventsForSubmenuChanges: true }));
        this._register(this.menu.onDidChange(() => {
            this.actions = undefined;
            this._onDidChange.fire();
        }));
    }
    getActions() {
        if (!this.actions) {
            this.actions = getActionBarActions(this.menu.getActions(this.options));
        }
        return this.actions;
    }
    getPrimaryActions() {
        return this.getActions().primary;
    }
    getSecondaryActions() {
        return this.getActions().secondary;
    }
    getContextMenuActions() {
        if (this.contextMenuId) {
            const menu = this.menuService.getMenuActions(this.contextMenuId, this.contextKeyService, this.options);
            return getActionBarActions(menu).secondary;
        }
        return [];
    }
};
ViewMenuActions = __decorate([
    __param(3, IContextKeyService),
    __param(4, IMenuService)
], ViewMenuActions);
export { ViewMenuActions };
let ViewContainerMenuActions = class ViewContainerMenuActions extends ViewMenuActions {
    constructor(element, viewContainer, viewDescriptorService, contextKeyService, menuService) {
        const scopedContextKeyService = contextKeyService.createScoped(element);
        scopedContextKeyService.createKey('viewContainer', viewContainer.id);
        const viewContainerLocationKey = scopedContextKeyService.createKey('viewContainerLocation', ViewContainerLocationToString(viewDescriptorService.getViewContainerLocation(viewContainer)));
        super(MenuId.ViewContainerTitle, MenuId.ViewContainerTitleContext, { shouldForwardArgs: true, renderShortTitle: true }, scopedContextKeyService, menuService);
        this._register(scopedContextKeyService);
        this._register(Event.filter(viewDescriptorService.onDidChangeContainerLocation, e => e.viewContainer === viewContainer)(() => viewContainerLocationKey.set(ViewContainerLocationToString(viewDescriptorService.getViewContainerLocation(viewContainer)))));
    }
};
ViewContainerMenuActions = __decorate([
    __param(2, IViewDescriptorService),
    __param(3, IContextKeyService),
    __param(4, IMenuService)
], ViewContainerMenuActions);
export { ViewContainerMenuActions };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld01lbnVBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdNZW51QWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsbUJBQW1CLEVBQThCLE1BQU0saUVBQWlFLENBQUM7QUFDbEksT0FBTyxFQUFFLE1BQU0sRUFBc0IsWUFBWSxFQUFTLE1BQU0sZ0RBQWdELENBQUM7QUFDakgsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLHNCQUFzQixFQUFpQiw2QkFBNkIsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBRXpHLElBQU0sZUFBZSxHQUFyQixNQUFNLGVBQWdCLFNBQVEsVUFBVTtJQU85QyxZQUNVLE1BQWMsRUFDTixhQUFpQyxFQUNqQyxPQUF1QyxFQUNwQyxpQkFBc0QsRUFDNUQsV0FBMEM7UUFFeEQsS0FBSyxFQUFFLENBQUM7UUFOQyxXQUFNLEdBQU4sTUFBTSxDQUFRO1FBQ04sa0JBQWEsR0FBYixhQUFhLENBQW9CO1FBQ2pDLFlBQU8sR0FBUCxPQUFPLENBQWdDO1FBQ25CLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBb0I7UUFDM0MsZ0JBQVcsR0FBWCxXQUFXLENBQWM7UUFSeEMsaUJBQVksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUMzRCxnQkFBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDO1FBVTlDLElBQUksQ0FBQyxJQUFJLEdBQUcs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