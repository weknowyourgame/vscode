/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { raceTimeout } from '../../../../base/common/async.js';
import { Event } from '../../../../base/common/event.js';
import { ChatViewId } from '../../chat/browser/chat.js';
import { ChatAgentLocation } from '../../chat/common/constants.js';
export async function openPanelChatAndGetWidget(viewsService, chatService) {
    await viewsService.openView(ChatViewId, true);
    const widgets = chatService.getWidgetsByLocations(ChatAgentLocation.Chat);
    if (widgets.length) {
        return widgets[0];
    }
    const eventPromise = Event.toPromise(Event.filter(chatService.onDidAddWidget, e => e.location === ChatAgentLocation.Chat));
    return await raceTimeout(eventPromise, 10000, // should be enough time for chat to initialize...
    () => eventPromise.cancel());
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlblBhbmVsQ2hhdEFuZEdldFdpZGdldC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvYnJvd3Nlci9vcGVuUGFuZWxDaGF0QW5kR2V0V2lkZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFekQsT0FBTyxFQUFFLFVBQVUsRUFBbUMsTUFBTSw0QkFBNEIsQ0FBQztBQUN6RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUduRSxNQUFNLENBQUMsS0FBSyxVQUFVLHlCQUF5QixDQUFDLFlBQTJCLEVBQUUsV0FBK0I7SUFDM0csTUFBTSxZQUFZLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM5QyxNQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMscUJBQXFCLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDMUUsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDcEIsT0FBTyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkIsQ0FBQztJQUVELE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsS0FBSyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBRTNILE9BQU8sTUFBTSxXQUFXLENBQ3ZCLFlBQVksRUFDWixLQUFLLEVBQUUsa0RBQWtEO0lBQ3pELEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FDM0IsQ0FBQztBQUNILENBQUMifQ==