/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize2 } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { CHAT_CATEGORY } from './chatActions.js';
import { IChatWidgetService } from '../chat.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { isRequestVM, isResponseVM } from '../../common/chatViewModel.js';
export function registerChatPromptNavigationActions() {
    registerAction2(class NextUserPromptAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.nextUserPrompt',
                title: localize2('interactive.nextUserPrompt.label', "Next User Prompt"),
                keybinding: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 18 /* KeyCode.DownArrow */,
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                    when: ChatContextKeys.inChatSession,
                },
                precondition: ChatContextKeys.enabled,
                f1: true,
                category: CHAT_CATEGORY,
            });
        }
        run(accessor, ...args) {
            navigateUserPrompts(accessor, false);
        }
    });
    registerAction2(class PreviousUserPromptAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.previousUserPrompt',
                title: localize2('interactive.previousUserPrompt.label', "Previous User Prompt"),
                keybinding: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 16 /* KeyCode.UpArrow */,
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                    when: ChatContextKeys.inChatSession,
                },
                precondition: ChatContextKeys.enabled,
                f1: true,
                category: CHAT_CATEGORY,
            });
        }
        run(accessor, ...args) {
            navigateUserPrompts(accessor, true);
        }
    });
}
function navigateUserPrompts(accessor, reverse) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const widget = chatWidgetService.lastFocusedWidget;
    if (!widget) {
        return;
    }
    const items = widget.viewModel?.getItems();
    if (!items || items.length === 0) {
        return;
    }
    // Get all user prompts (requests) in the conversation
    const userPrompts = items.filter((item) => isRequestVM(item));
    if (userPrompts.length === 0) {
        return;
    }
    // Find the currently focused item
    const focused = widget.getFocus();
    let currentIndex = -1;
    if (focused) {
        if (isRequestVM(focused)) {
            // If a request is focused, find its index in the user prompts array
            currentIndex = userPrompts.findIndex(prompt => prompt.id === focused.id);
        }
        else if (isResponseVM(focused)) {
            // If a response is focused, find the associated request's index
            // Response view models have a requestId property
            currentIndex = userPrompts.findIndex(prompt => prompt.id === focused.requestId);
        }
    }
    // Calculate next index
    let nextIndex;
    if (currentIndex === -1) {
        // No current focus, go to first or last prompt based on direction
        nextIndex = reverse ? userPrompts.length - 1 : 0;
    }
    else {
        // Navigate to next/previous prompt
        nextIndex = reverse ? currentIndex - 1 : currentIndex + 1;
        // Clamp instead of wrap and stay at boundaries when trying to navigate past ends
        if (nextIndex < 0) {
            nextIndex = 0; // already at first, do not move further
        }
        else if (nextIndex >= userPrompts.length) {
            nextIndex = userPrompts.length - 1; // already at last, do not move further
        }
        // avoid re-focusing if we didn't actually move
        if (nextIndex === currentIndex) {
            return; // no change in focus
        }
    }
    // Focus and reveal the selected user prompt
    const targetPrompt = userPrompts[nextIndex];
    if (targetPrompt) {
        widget.focus(targetPrompt);
        widget.reveal(targetPrompt);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFByb21wdE5hdmlnYXRpb25BY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9hY3Rpb25zL2NoYXRQcm9tcHROYXZpZ2F0aW9uQWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUloRyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDbEQsT0FBTyxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUU3RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDakQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ2hELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNsRSxPQUFPLEVBQXlCLFdBQVcsRUFBRSxZQUFZLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUVqRyxNQUFNLFVBQVUsbUNBQW1DO0lBQ2xELGVBQWUsQ0FBQyxNQUFNLG9CQUFxQixTQUFRLE9BQU87UUFDekQ7WUFDQyxLQUFLLENBQUM7Z0JBQ0wsRUFBRSxFQUFFLHNDQUFzQztnQkFDMUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxrQ0FBa0MsRUFBRSxrQkFBa0IsQ0FBQztnQkFDeEUsVUFBVSxFQUFFO29CQUNYLE9BQU8sRUFBRSxnREFBMkIsNkJBQW9CO29CQUN4RCxNQUFNLDZDQUFtQztvQkFDekMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxhQUFhO2lCQUNuQztnQkFDRCxZQUFZLEVBQUUsZUFBZSxDQUFDLE9BQU87Z0JBQ3JDLEVBQUUsRUFBRSxJQUFJO2dCQUNSLFFBQVEsRUFBRSxhQUFhO2FBQ3ZCLENBQUMsQ0FBQztRQUNKLENBQUM7UUFFRCxHQUFHLENBQUMsUUFBMEIsRUFBRSxHQUFHLElBQWU7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