/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { alert } from '../../../../../base/browser/ui/aria/aria.js';
import { localize } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IChatWidgetService } from '../chat.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { isResponseVM } from '../../common/chatViewModel.js';
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from '../../../../../platform/accessibility/common/accessibility.js';
export const ACTION_ID_FOCUS_CHAT_CONFIRMATION = 'workbench.action.chat.focusConfirmation';
class AnnounceChatConfirmationAction extends Action2 {
    constructor() {
        super({
            id: ACTION_ID_FOCUS_CHAT_CONFIRMATION,
            title: { value: localize('focusChatConfirmation', 'Focus Chat Confirmation'), original: 'Focus Chat Confirmation' },
            category: { value: localize('chat.category', 'Chat'), original: 'Chat' },
            precondition: ChatContextKeys.enabled,
            f1: true,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 31 /* KeyCode.KeyA */ | 1024 /* KeyMod.Shift */,
                when: CONTEXT_ACCESSIBILITY_MODE_ENABLED
            }
        });
    }
    async run(accessor) {
        const chatWidgetService = accessor.get(IChatWidgetService);
        const pendingWidget = chatWidgetService.getAllWidgets().find(widget => widget.viewModel?.model.requestNeedsInput.get());
        if (!pendingWidget) {
            alert(localize('noChatSession', 'No active chat session found.'));
            return;
        }
        const viewModel = pendingWidget.viewModel;
        if (!viewModel) {
            alert(localize('chatNotReady', 'Chat interface not ready.'));
            return;
        }
        // Check for active confirmations in the chat responses
        let firstConfirmationElement;
        const lastResponse = viewModel.getItems()[viewModel.getItems().length - 1];
        if (isResponseVM(lastResponse)) {
            // eslint-disable-next-line no-restricted-syntax
            const confirmationWidgets = pendingWidget.domNode.querySelectorAll('.chat-confirmation-widget-container');
            if (confirmationWidgets.length > 0) {
                firstConfirmationElement = confirmationWidgets[0];
            }
        }
        if (firstConfirmationElement) {
            firstConfirmationElement.focus();
        }
        else {
            alert(localize('noConfirmationRequired', 'No chat confirmation required'));
        }
    }
}
export function registerChatAccessibilityActions() {
    registerAction2(AnnounceChatConfirmationAction);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEFjY2Vzc2liaWxpdHlBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9hY3Rpb25zL2NoYXRBY2Nlc3NpYmlsaXR5QWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFJN0YsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ2hELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDN0QsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLE1BQU0sK0RBQStELENBQUM7QUFFbkgsTUFBTSxDQUFDLE1BQU0saUNBQWlDLEdBQUcseUNBQXlDLENBQUM7QUFFM0YsTUFBTSw4QkFBK0IsU0FBUSxPQUFPO0lBQ25EO1FBQ0MsS0FBSyxDQUFDO1lBQ0wsRUFBRSxFQUFFLGlDQUFpQztZQUNyQyxLQUFLLEVBQUUsRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLHVCQUF1QixFQUFFLHlCQUF5QixDQUFDLEVBQUUsUUFBUSxFQUFFLHlCQUF5QixFQUFFO1lBQ25ILFFBQVEsRUFBRSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUU7WUFDeEUsWUFBWSxFQUFFLGVBQWUsQ0FBQyxPQUFPO1lBQ3JDLEVBQUUsRUFBRSxJQUFJO1lBQ1IsVUFBVSxFQUFFO2dCQUNYLE1BQU0sNkNBQW1DO2dCQUN6QyxPQUFPLEVBQUUsaURBQTZCLDBCQUFlO2dCQUNyRCxJQUFJLEVBQUUsa0NBQWtDO2FBQ3hDO1NBQ0QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBMEI7UUFDbkMsTUFBTSxpQkFBaUIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDM0QsTUFBTSxhQUFhLEdBQUcsaUJBQWlCLENBQUMsYUFBYSxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztRQUV4SCxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDcEIsS0FBSyxDQUFDLFFBQVEsQ0FBQyxlQUFlLEVBQUUsK0JBQStCLENBQUMsQ0FBQyxDQUFDO1lBQ2xFLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxTQUFTLEdBQUcsYUFBYSxDQUFDLFNBQVMsQ0FBQztRQUMxQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEIsS0FBSyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsMkJBQTJCLENBQUMsQ0FBQyxDQUFDO1lBQzdELE9BQU87UUFDUixDQUFDO1FBRUQsdURBQXVEO1FBQ3ZELElBQUksd0JBQWlELENBQUM7UUFFdEQsTUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDM0UsSUFBSSxZQUFZLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztZQUNoQyxnREFBZ0Q7WUFDaEQsTUFBTSxtQkFBbUIsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLHFDQUFxQyxDQUFDLENBQUM7WUFDMUcsSUFBSSxtQkFBbUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ3BDLHdCQUF3QixHQUFHLG1CQUFtQixDQUFDLENBQUMsQ0FBZ0IsQ0FBQztZQUNsRSxDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksd0JBQXdCLEVBQUUsQ0FBQztZQUM5Qix3QkFBd0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNsQyxDQUFDO2FBQU0sQ0FBQztZQUNQLEtBQUssQ0FBQyxRQUFRLENBQUMsd0JBQXdCLEVBQUUsK0JBQStCLENBQUMsQ0FBQyxDQUFDO1FBQzVFLENBQUM7SUFDRixDQUFDO0NBQ0Q7QUFFRCxNQUFNLFVBQVUsZ0NBQWdDO0lBQy9DLGVBQWUsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO0FBQ2pELENBQUMifQ==