/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize2 } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { isResponseVM } from '../../common/chatViewModel.js';
import { IChatWidgetService } from '../chat.js';
import { CHAT_CATEGORY } from './chatActions.js';
export const AcceptElicitationRequestActionId = 'workbench.action.chat.acceptElicitation';
class AcceptElicitationRequestAction extends Action2 {
    constructor() {
        super({
            id: AcceptElicitationRequestActionId,
            title: localize2('chat.acceptElicitation', "Accept Request"),
            f1: false,
            category: CHAT_CATEGORY,
            keybinding: {
                when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.Editing.hasElicitationRequest),
                primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
            },
        });
    }
    async run(accessor) {
        const chatWidgetService = accessor.get(IChatWidgetService);
        const widget = chatWidgetService.lastFocusedWidget;
        if (!widget) {
            return;
        }
        const items = widget.viewModel?.getItems();
        if (!items?.length) {
            return;
        }
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if (!isResponseVM(item)) {
                continue;
            }
            for (const content of item.response.value) {
                if (content.kind === 'elicitation2' && content.state.get() === "pending" /* ElicitationState.Pending */) {
                    await content.accept(true);
                    widget.focusInput();
                    return;
                }
            }
        }
    }
}
export function registerChatElicitationActions() {
    registerAction2(AcceptElicitationRequestAction);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVsaWNpdGF0aW9uQWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0RWxpY2l0YXRpb25BY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBSWhHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNsRCxPQUFPLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUV6RixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFFbEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQzdELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUNoRCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFFakQsTUFBTSxDQUFDLE1BQU0sZ0NBQWdDLEdBQUcseUNBQXlDLENBQUM7QUFFMUYsTUFBTSw4QkFBK0IsU0FBUSxPQUFPO0lBQ25EO1FBQ0MsS0FBSyxDQUFDO1lBQ0wsRUFBRSxFQUFFLGdDQUFnQztZQUNwQyxLQUFLLEVBQUUsU0FBUyxDQUFDLHdCQUF3QixFQUFFLGdCQUFnQixDQUFDO1lBQzVELEVBQUUsRUFBRSxLQUFLO1lBQ1QsUUFBUSxFQUFFLGFBQWE7WUFDdkIsVUFBVSxFQUFFO2dCQUNYLElBQUksRUFBRSxjQUFjLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxhQUFhLEVBQUUsZUFBZSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQztnQkFDdEcsT0FBTyxFQUFFLGlEQUE4QjtnQkFDdkMsTUFBTSxFQUFFLDhDQUFvQyxDQUFDO2FBQzdDO1NBQ0QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVRLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBMEI7UUFDNUMsTUFBTSxpQkFBaUIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDM0QsTUFBTSxNQUFNLEdBQUcsaUJBQWlCLENBQUMsaUJBQWlCLENBQUM7UUFDbkQsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2IsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRSxDQUFDO1FBQzNDLElBQUksQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUM7WUFDcEIsT0FBTztRQUNSLENBQUM7UUFFRCxLQUFLLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUM1QyxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdEIsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUN6QixTQUFTO1lBQ1YsQ0FBQztZQUVELEtBQUssTUFBTSxPQUFPLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDM0MsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLGNBQWMsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSw2Q0FBNkIsRUFBRSxDQUFDO29CQUN6RixNQUFNLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQzNCLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztvQkFDcEIsT0FBTztnQkFDUixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0NBQ0Q7QUFFRCxNQUFNLFVBQVUsOEJBQThCO0lBQzdDLGVBQWUsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO0FBQ2pELENBQUMifQ==