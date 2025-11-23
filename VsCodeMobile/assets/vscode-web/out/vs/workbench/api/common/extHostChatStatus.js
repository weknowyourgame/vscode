/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as extHostProtocol from './extHost.protocol.js';
import { ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
export class ExtHostChatStatus {
    constructor(mainContext) {
        this._items = new Map();
        this._proxy = mainContext.getProxy(extHostProtocol.MainContext.MainThreadChatStatus);
    }
    createChatStatusItem(extension, id) {
        const internalId = asChatItemIdentifier(extension.identifier, id);
        if (this._items.has(internalId)) {
            throw new Error(`Chat status item '${id}' already exists`);
        }
        const state = {
            id: internalId,
            title: '',
            description: '',
            detail: '',
        };
        let disposed = false;
        let visible = false;
        const syncState = () => {
            if (disposed) {
                throw new Error('Chat status item is disposed');
            }
            if (!visible) {
                return;
            }
            this._proxy.$setEntry(id, state);
        };
        const item = Object.freeze({
            id: id,
            get title() {
                return state.title;
            },
            set title(value) {
                state.title = value;
                syncState();
            },
            get description() {
                return state.description;
            },
            set description(value) {
                state.description = value;
                syncState();
            },
            get detail() {
                return state.detail;
            },
            set detail(value) {
                state.detail = value;
                syncState();
            },
            show: () => {
                visible = true;
                syncState();
            },
            hide: () => {
                visible = false;
                this._proxy.$disposeEntry(id);
            },
            dispose: () => {
                disposed = true;
                this._proxy.$disposeEntry(id);
                this._items.delete(internalId);
            },
        });
        this._items.set(internalId, item);
        return item;
    }
}
function asChatItemIdentifier(extension, id) {
    return `${ExtensionIdentifier.toKey(extension)}.${id}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdENoYXRTdGF0dXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9jb21tb24vZXh0SG9zdENoYXRTdGF0dXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxLQUFLLGVBQWUsTUFBTSx1QkFBdUIsQ0FBQztBQUN6RCxPQUFPLEVBQUUsbUJBQW1CLEVBQXlCLE1BQU0sbURBQW1ELENBQUM7QUFFL0csTUFBTSxPQUFPLGlCQUFpQjtJQU03QixZQUNDLFdBQXlDO1FBSHpCLFdBQU0sR0FBRyxJQUFJLEdBQUcsRUFBaUMsQ0FBQztRQUtsRSxJQUFJLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0lBQ3RGLENBQUM7SUFFRCxvQkFBb0IsQ0FBQyxTQUFnQyxFQUFFLEVBQVU7UUFDaEUsTUFBTSxVQUFVLEdBQUcsb0JBQW9CLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNsRSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7WUFDakMsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBQzVELENBQUM7UUFFRCxNQUFNLEtBQUssR0FBc0M7WUFDaEQsRUFBRSxFQUFFLFVBQVU7WUFDZCxLQUFLLEVBQUUsRUFBRTtZQUNULFdBQVcsRUFBRSxFQUFFO1lBQ2YsTUFBTSxFQUFFLEVBQUU7U0FDVixDQUFDO1FBRUYsSUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQztRQUNwQixNQUFNLFNBQVMsR0FBRyxHQUFHLEVBQUU7WUFDdEIsSUFBSSxRQUFRLEVBQUUsQ0FBQztnQkFDZCxNQUFNLElBQUksS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUM7WUFDakQsQ0FBQztZQUVELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDZCxPQUFPO1lBQ1IsQ0FBQztZQUVELElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNsQyxDQUFDLENBQUM7UUFFRixNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsTUFBTSxDQUF3QjtZQUNqRCxFQUFFLEVBQUUsRUFBRTtZQUVOLElBQUksS0FBSztnQkFDUixPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUM7WUFDcEIsQ0FBQztZQUNELElBQUksS0FBSyxDQUFDLEtBQStDO2dCQUN4RCxLQUFLLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztnQkFDcEIsU0FBUyxFQUFFLENBQUM7WUFDYixDQUFDO1lBRUQsSUFBSSxXQUFXO2dCQUNkLE9BQU8sS0FBSyxDQUFDLFdBQVcsQ0FBQztZQUMxQixDQUFDO1lBQ0QsSUFBSSxXQUFXLENBQUMsS0FBYTtnQkFDNUIsS0FBSyxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7Z0JBQzFCLFNBQVMsRUFBRSxDQUFDO1lBQ2IsQ0FBQztZQUVELElBQUksTUFBTTtnQkFDVCxPQUFPLEtBQUssQ0FBQyxNQUFNLENBQUM7WUFDckIsQ0FBQztZQUNELElBQUksTUFBTSxDQUFDLEtBQXlCO2dCQUNuQyxLQUFLLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztnQkFDckIsU0FBUyxFQUFFLENBQUM7WUFDYixDQUFDO1lBRUQsSUFBSSxFQUFFLEdBQUcsRUFBRTtnQkFDVixPQUFPLEdBQUcsSUFBSSxDQUFDO2dCQUNmLFNBQVMsRUFBRSxDQUFDO1lBQ2IsQ0FBQztZQUNELElBQUksRUFBRSxHQUFHLEVBQUU7Z0JBQ1YsT0FBTyxHQUFHLEtBQUssQ0FBQztnQkFDaEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDL0IsQ0FBQztZQUNELE9BQU8sRUFBRSxHQUFHLEVBQUU7Z0JBQ2IsUUFBUSxHQUFHLElBQUksQ0FBQztnQkFDaEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQzlCLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ2hDLENBQUM7U0FDRCxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbEMsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0NBQ0Q7QUFFRCxTQUFTLG9CQUFvQixDQUFDLFNBQThCLEVBQUUsRUFBVTtJQUN2RSxPQUFPLEdBQUcsbUJBQW1CLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO0FBQ3hELENBQUMifQ==