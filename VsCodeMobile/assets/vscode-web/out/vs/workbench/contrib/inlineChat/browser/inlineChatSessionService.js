/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { raceTimeout } from '../../../../base/common/async.js';
import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IChatWidgetService } from '../../chat/browser/chat.js';
import { IChatService } from '../../chat/common/chatService.js';
export const IInlineChatSessionService = createDecorator('IInlineChatSessionService');
export async function moveToPanelChat(accessor, model, resend) {
    const chatService = accessor.get(IChatService);
    const widgetService = accessor.get(IChatWidgetService);
    const widget = await widgetService.revealWidget();
    if (widget && widget.viewModel && model) {
        let lastRequest;
        for (const request of model.getRequests().slice()) {
            await chatService.adoptRequest(widget.viewModel.model.sessionResource, request);
            lastRequest = request;
        }
        if (lastRequest && resend) {
            chatService.resendRequest(lastRequest, { location: widget.location });
        }
        widget.focusResponseItem();
    }
}
export async function askInPanelChat(accessor, model) {
    const widgetService = accessor.get(IChatWidgetService);
    const widget = await widgetService.revealWidget();
    if (!widget) {
        return;
    }
    if (!widget.viewModel) {
        await raceTimeout(Event.toPromise(widget.onDidChangeViewModel), 1000);
    }
    if (model.attachedContext) {
        widget.attachmentModel.addContext(...model.attachedContext);
    }
    widget.acceptInput(model.message.text, {
        enableImplicitContext: true,
        isVoiceInput: false,
        noCommandDetection: true
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2lubGluZUNoYXQvYnJvd3Nlci9pbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFDaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRS9ELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQU96RCxPQUFPLEVBQUUsZUFBZSxFQUFvQixNQUFNLDREQUE0RCxDQUFDO0FBQy9HLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBR2hFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQU9oRSxNQUFNLENBQUMsTUFBTSx5QkFBeUIsR0FBRyxlQUFlLENBQTRCLDJCQUEyQixDQUFDLENBQUM7QUFpRGpILE1BQU0sQ0FBQyxLQUFLLFVBQVUsZUFBZSxDQUFDLFFBQTBCLEVBQUUsS0FBNkIsRUFBRSxNQUFlO0lBRS9HLE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDL0MsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBRXZELE1BQU0sTUFBTSxHQUFHLE1BQU0sYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBRWxELElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxTQUFTLElBQUksS0FBSyxFQUFFLENBQUM7UUFDekMsSUFBSSxXQUEwQyxDQUFDO1FBQy9DLEtBQUssTUFBTSxPQUFPLElBQUksS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUM7WUFDbkQsTUFBTSxXQUFXLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLGVBQWUsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUNoRixXQUFXLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLENBQUM7UUFFRCxJQUFJLFdBQVcsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUMzQixXQUFXLENBQUMsYUFBYSxDQUFDLFdBQVcsRUFBRSxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUN2RSxDQUFDO1FBRUQsTUFBTSxDQUFDLGlCQUFpQixFQUFFLENBQUM7SUFDNUIsQ0FBQztBQUNGLENBQUM7QUFFRCxNQUFNLENBQUMsS0FBSyxVQUFVLGNBQWMsQ0FBQyxRQUEwQixFQUFFLEtBQXdCO0lBRXhGLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUV2RCxNQUFNLE1BQU0sR0FBRyxNQUFNLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUVsRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDYixPQUFPO0lBQ1IsQ0FBQztJQUVELElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDdkIsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsb0JBQW9CLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRUQsSUFBSSxLQUFLLENBQUMsZUFBZSxFQUFFLENBQUM7UUFDM0IsTUFBTSxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsR0FBRyxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUVELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7UUFDdEMscUJBQXFCLEVBQUUsSUFBSTtRQUMzQixZQUFZLEVBQUUsS0FBSztRQUNuQixrQkFBa0IsRUFBRSxJQUFJO0tBQ3hCLENBQUMsQ0FBQztBQUNKLENBQUMifQ==