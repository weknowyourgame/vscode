/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, toDisposable } from '../../../base/common/lifecycle.js';
import { registerSingleton } from '../../instantiation/common/extensions.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { MenuId } from '../common/actions.js';
export const IActionViewItemService = createDecorator('IActionViewItemService');
export class NullActionViewItemService {
    constructor() {
        this.onDidChange = Event.None;
    }
    register(menu, commandId, provider, event) {
        return Disposable.None;
    }
    lookUp(menu, commandId) {
        return undefined;
    }
}
class ActionViewItemService {
    constructor() {
        this._providers = new Map();
        this._onDidChange = new Emitter();
        this.onDidChange = this._onDidChange.event;
    }
    dispose() {
        this._onDidChange.dispose();
    }
    register(menu, commandOrSubmenuId, provider, event) {
        const id = this._makeKey(menu, commandOrSubmenuId);
        if (this._providers.has(id)) {
            throw new Error(`A provider for the command ${commandOrSubmenuId} and menu ${menu} is already registered.`);
        }
        this._providers.set(id, provider);
        const listener = event?.(() => {
            this._onDidChange.fire(menu);
        });
        return toDisposable(() => {
            listener?.dispose();
            this._providers.delete(id);
        });
    }
    lookUp(menu, commandOrMenuId) {
        return this._providers.get(this._makeKey(menu, commandOrMenuId));
    }
    _makeKey(menu, commandOrMenuId) {
        return `${menu.id}/${(commandOrMenuId instanceof MenuId ? commandOrMenuId.id : commandOrMenuId)}`;
    }
}
registerSingleton(IActionViewItemService, ActionViewItemService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aW9uVmlld0l0ZW1TZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9hY3Rpb25WaWV3SXRlbVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFLaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFlLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzFGLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNoRyxPQUFPLEVBQUUsZUFBZSxFQUF5QixNQUFNLDZDQUE2QyxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUc5QyxNQUFNLENBQUMsTUFBTSxzQkFBc0IsR0FBRyxlQUFlLENBQXlCLHdCQUF3QixDQUFDLENBQUM7QUFvQnhHLE1BQU0sT0FBTyx5QkFBeUI7SUFBdEM7UUFHVSxnQkFBVyxHQUFrQixLQUFLLENBQUMsSUFBSSxDQUFDO0lBU2xELENBQUM7SUFQQSxRQUFRLENBQUMsSUFBWSxFQUFFLFNBQTBCLEVBQUUsUUFBZ0MsRUFBRSxLQUFzQjtRQUMxRyxPQUFPLFVBQVUsQ0FBQyxJQUFJLENBQUM7SUFDeEIsQ0FBQztJQUVELE1BQU0sQ0FBQyxJQUFZLEVBQUUsU0FBMEI7UUFDOUMsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztDQUNEO0FBRUQsTUFBTSxxQkFBcUI7SUFBM0I7UUFJa0IsZUFBVSxHQUFHLElBQUksR0FBRyxFQUFrQyxDQUFDO1FBRXZELGlCQUFZLEdBQUcsSUFBSSxPQUFPLEVBQVUsQ0FBQztRQUM3QyxnQkFBVyxHQUFrQixJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQztJQThCL0QsQ0FBQztJQTVCQSxPQUFPO1FBQ04sSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUM3QixDQUFDO0lBRUQsUUFBUSxDQUFDLElBQVksRUFBRSxrQkFBbUMsRUFBRSxRQUFnQyxFQUFFLEtBQXNCO1FBQ25ILE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDbkQsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQzdCLE1BQU0sSUFBSSxLQUFLLENBQUMsOEJBQThCLGtCQUFrQixhQUFhLElBQUkseUJBQXlCLENBQUMsQ0FBQztRQUM3RyxDQUFDO1FBQ0QsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRWxDLE1BQU0sUUFBUSxHQUFHLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRTtZQUM3QixJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM5QixDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sWUFBWSxDQUFDLEdBQUcsRUFBRTtZQUN4QixRQUFRLEVBQUUsT0FBTyxFQUFFLENBQUM7WUFDcEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDNUIsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsTUFBTSxDQUFDLElBQVksRUFBRSxlQUFnQztRQUNwRCxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUM7SUFDbEUsQ0FBQztJQUVPLFFBQVEsQ0FBQyxJQUFZLEVBQUUsZUFBZ0M7UUFDOUQsT0FBTyxHQUFHLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxlQUFlLFlBQVksTUFBTSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDO0lBQ25HLENBQUM7Q0FDRDtBQUVELGlCQUFpQixDQUFDLHNCQUFzQixFQUFFLHFCQUFxQixvQ0FBNEIsQ0FBQyJ9