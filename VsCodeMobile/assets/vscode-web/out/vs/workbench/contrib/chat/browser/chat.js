/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { CHAT_PROVIDER_ID } from '../common/chatParticipantContribTypes.js';
export const IChatWidgetService = createDecorator('chatWidgetService');
export const ChatViewPaneTarget = Symbol('ChatViewPaneTarget');
export const IQuickChatService = createDecorator('quickChatService');
export const IChatAccessibilityService = createDecorator('chatAccessibilityService');
export function isIChatViewViewContext(context) {
    return typeof context.viewId === 'string';
}
export function isIChatResourceViewContext(context) {
    return !isIChatViewViewContext(context);
}
export const IChatCodeBlockContextProviderService = createDecorator('chatCodeBlockContextProviderService');
export const ChatViewId = `workbench.panel.chat.view.${CHAT_PROVIDER_ID}`;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQVdoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFNN0YsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFVNUUsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQUcsZUFBZSxDQUFxQixtQkFBbUIsQ0FBQyxDQUFDO0FBMkMzRixNQUFNLENBQUMsTUFBTSxrQkFBa0IsR0FBRyxNQUFNLENBQUMsb0JBQW9CLENBQUMsQ0FBQztBQUUvRCxNQUFNLENBQUMsTUFBTSxpQkFBaUIsR0FBRyxlQUFlLENBQW9CLGtCQUFrQixDQUFDLENBQUM7QUE4QnhGLE1BQU0sQ0FBQyxNQUFNLHlCQUF5QixHQUFHLGVBQWUsQ0FBNEIsMEJBQTBCLENBQUMsQ0FBQztBQWdGaEgsTUFBTSxVQUFVLHNCQUFzQixDQUFDLE9BQStCO0lBQ3JFLE9BQU8sT0FBUSxPQUFnQyxDQUFDLE1BQU0sS0FBSyxRQUFRLENBQUM7QUFDckUsQ0FBQztBQU9ELE1BQU0sVUFBVSwwQkFBMEIsQ0FBQyxPQUErQjtJQUN6RSxPQUFPLENBQUMsc0JBQXNCLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDekMsQ0FBQztBQTRFRCxNQUFNLENBQUMsTUFBTSxvQ0FBb0MsR0FBRyxlQUFlLENBQXVDLHFDQUFxQyxDQUFDLENBQUM7QUFPakosTUFBTSxDQUFDLE1BQU0sVUFBVSxHQUFHLDZCQUE2QixnQkFBZ0IsRUFBRSxDQUFDIn0=