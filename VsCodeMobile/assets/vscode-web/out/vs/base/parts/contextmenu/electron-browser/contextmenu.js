/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CONTEXT_MENU_CHANNEL, CONTEXT_MENU_CLOSE_CHANNEL } from '../common/contextmenu.js';
import { ipcRenderer } from '../../sandbox/electron-browser/globals.js';
let contextMenuIdPool = 0;
export function popup(items, options, onHide) {
    const processedItems = [];
    const contextMenuId = contextMenuIdPool++;
    const onClickChannel = `vscode:onContextMenu${contextMenuId}`;
    const onClickChannelHandler = (_event, ...args) => {
        const itemId = args[0];
        const context = args[1];
        const item = processedItems[itemId];
        item.click?.(context);
    };
    ipcRenderer.once(onClickChannel, onClickChannelHandler);
    ipcRenderer.once(CONTEXT_MENU_CLOSE_CHANNEL, (_event, ...args) => {
        const closedContextMenuId = args[0];
        if (closedContextMenuId !== contextMenuId) {
            return;
        }
        ipcRenderer.removeListener(onClickChannel, onClickChannelHandler);
        onHide?.();
    });
    ipcRenderer.send(CONTEXT_MENU_CHANNEL, contextMenuId, items.map(item => createItem(item, processedItems)), onClickChannel, options);
}
function createItem(item, processedItems) {
    const serializableItem = {
        id: processedItems.length,
        label: item.label,
        type: item.type,
        accelerator: item.accelerator,
        checked: item.checked,
        enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
        visible: typeof item.visible === 'boolean' ? item.visible : true
    };
    processedItems.push(item);
    // Submenu
    if (Array.isArray(item.submenu)) {
        serializableItem.submenu = item.submenu.map(submenuItem => createItem(submenuItem, processedItems));
    }
    return serializableItem;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGV4dG1lbnUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9wYXJ0cy9jb250ZXh0bWVudS9lbGVjdHJvbi1icm93c2VyL2NvbnRleHRtZW51LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSwwQkFBMEIsRUFBb0YsTUFBTSwwQkFBMEIsQ0FBQztBQUM5SyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFFeEUsSUFBSSxpQkFBaUIsR0FBRyxDQUFDLENBQUM7QUFFMUIsTUFBTSxVQUFVLEtBQUssQ0FBQyxLQUF5QixFQUFFLE9BQXVCLEVBQUUsTUFBbUI7SUFDNUYsTUFBTSxjQUFjLEdBQXVCLEVBQUUsQ0FBQztJQUU5QyxNQUFNLGFBQWEsR0FBRyxpQkFBaUIsRUFBRSxDQUFDO0lBQzFDLE1BQU0sY0FBYyxHQUFHLHVCQUF1QixhQUFhLEVBQUUsQ0FBQztJQUM5RCxNQUFNLHFCQUFxQixHQUFHLENBQUMsTUFBZSxFQUFFLEdBQUcsSUFBZSxFQUFFLEVBQUU7UUFDckUsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBVyxDQUFDO1FBQ2pDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQXNCLENBQUM7UUFDN0MsTUFBTSxJQUFJLEdBQUcsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3BDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN2QixDQUFDLENBQUM7SUFFRixXQUFXLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO0lBQ3hELFdBQVcsQ0FBQyxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQyxNQUFlLEVBQUUsR0FBRyxJQUFlLEVBQUUsRUFBRTtRQUNwRixNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxDQUFDLENBQVcsQ0FBQztRQUM5QyxJQUFJLG1CQUFtQixLQUFLLGFBQWEsRUFBRSxDQUFDO1lBQzNDLE9BQU87UUFDUixDQUFDO1FBRUQsV0FBVyxDQUFDLGNBQWMsQ0FBQyxjQUFjLEVBQUUscUJBQXFCLENBQUMsQ0FBQztRQUVsRSxNQUFNLEVBQUUsRUFBRSxDQUFDO0lBQ1osQ0FBQyxDQUFDLENBQUM7SUFFSCxXQUFXLENBQUMsSUFBSSxDQUFDLG9CQUFvQixFQUFFLGFBQWEsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxFQUFFLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUNySSxDQUFDO0FBRUQsU0FBUyxVQUFVLENBQUMsSUFBc0IsRUFBRSxjQUFrQztJQUM3RSxNQUFNLGdCQUFnQixHQUFpQztRQUN0RCxFQUFFLEVBQUUsY0FBYyxDQUFDLE1BQU07UUFDekIsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLO1FBQ2pCLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtRQUNmLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVztRQUM3QixPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU87UUFDckIsT0FBTyxFQUFFLE9BQU8sSUFBSSxDQUFDLE9BQU8sS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUk7UUFDaEUsT0FBTyxFQUFFLE9BQU8sSUFBSSxDQUFDLE9BQU8sS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUk7S0FDaEUsQ0FBQztJQUVGLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFMUIsVUFBVTtJQUNWLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUNqQyxnQkFBZ0IsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7SUFDckcsQ0FBQztJQUVELE9BQU8sZ0JBQWdCLENBQUM7QUFDekIsQ0FBQyJ9