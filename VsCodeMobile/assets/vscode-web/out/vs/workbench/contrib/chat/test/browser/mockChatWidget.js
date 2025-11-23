/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
export class MockChatWidgetService {
    constructor() {
        this.onDidAddWidget = Event.None;
    }
    getWidgetByInputUri(uri) {
        return undefined;
    }
    getWidgetBySessionResource(sessionResource) {
        return undefined;
    }
    getWidgetsByLocations(location) {
        return [];
    }
    revealWidget(preserveFocus) {
        return Promise.resolve(undefined);
    }
    reveal(widget, preserveFocus) {
        return Promise.resolve(true);
    }
    getAllWidgets() {
        throw new Error('Method not implemented.');
    }
    openSession(sessionResource) {
        throw new Error('Method not implemented.');
    }
    register(newWidget) {
        return Disposable.None;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja0NoYXRXaWRnZXQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2Jyb3dzZXIvbW9ja0NoYXRXaWRnZXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSx5Q0FBeUMsQ0FBQztBQUtsRixNQUFNLE9BQU8scUJBQXFCO0lBQWxDO1FBQ1UsbUJBQWMsR0FBdUIsS0FBSyxDQUFDLElBQUksQ0FBQztJQXdDMUQsQ0FBQztJQS9CQSxtQkFBbUIsQ0FBQyxHQUFRO1FBQzNCLE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFRCwwQkFBMEIsQ0FBQyxlQUFvQjtRQUM5QyxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQscUJBQXFCLENBQUMsUUFBMkI7UUFDaEQsT0FBTyxFQUFFLENBQUM7SUFDWCxDQUFDO0lBRUQsWUFBWSxDQUFDLGFBQXVCO1FBQ25DLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRUQsTUFBTSxDQUFDLE1BQW1CLEVBQUUsYUFBdUI7UUFDbEQsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFRCxhQUFhO1FBQ1osTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxXQUFXLENBQUMsZUFBb0I7UUFDL0IsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxRQUFRLENBQUMsU0FBc0I7UUFDOUIsT0FBTyxVQUFVLENBQUMsSUFBSSxDQUFDO0lBQ3hCLENBQUM7Q0FDRCJ9