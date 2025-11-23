/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { registerEditorContribution } from '../../../../editor/browser/editorExtensions.js';
import { MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { InlineChatController, InlineChatController1, InlineChatController2 } from './inlineChatController.js';
import * as InlineChatActions from './inlineChatActions.js';
import { CTX_INLINE_CHAT_EDITING, CTX_INLINE_CHAT_V1_ENABLED, CTX_INLINE_CHAT_REQUEST_IN_PROGRESS, INLINE_CHAT_ID, MENU_INLINE_CHAT_WIDGET_STATUS } from '../common/inlineChat.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { InlineChatNotebookContribution } from './inlineChatNotebook.js';
import { registerWorkbenchContribution2, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { InlineChatAccessibleView } from './inlineChatAccessibleView.js';
import { IInlineChatSessionService } from './inlineChatSessionService.js';
import { InlineChatEnabler, InlineChatEscapeToolContribution, InlineChatSessionServiceImpl } from './inlineChatSessionServiceImpl.js';
import { AccessibleViewRegistry } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { CancelAction, ChatSubmitAction } from '../../chat/browser/actions/chatExecuteActions.js';
import { localize } from '../../../../nls.js';
import { ChatContextKeys } from '../../chat/common/chatContextKeys.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { InlineChatAccessibilityHelp } from './inlineChatAccessibilityHelp.js';
registerEditorContribution(InlineChatController2.ID, InlineChatController2, 0 /* EditorContributionInstantiation.Eager */); // EAGER because of notebook dispose/create of editors
registerEditorContribution(INLINE_CHAT_ID, InlineChatController1, 0 /* EditorContributionInstantiation.Eager */); // EAGER because of notebook dispose/create of editors
registerEditorContribution(InlineChatController.ID, InlineChatController, 0 /* EditorContributionInstantiation.Eager */); // EAGER because of notebook dispose/create of editors
registerAction2(InlineChatActions.KeepSessionAction2);
registerAction2(InlineChatActions.UndoAndCloseSessionAction2);
// --- browser
registerSingleton(IInlineChatSessionService, InlineChatSessionServiceImpl, 1 /* InstantiationType.Delayed */);
// --- MENU special ---
const editActionMenuItem = {
    group: '0_main',
    order: 0,
    command: {
        id: ChatSubmitAction.ID,
        title: localize('send.edit', "Edit Code"),
    },
    when: ContextKeyExpr.and(ChatContextKeys.inputHasText, CTX_INLINE_CHAT_REQUEST_IN_PROGRESS.toNegated(), CTX_INLINE_CHAT_EDITING, CTX_INLINE_CHAT_V1_ENABLED),
};
const generateActionMenuItem = {
    group: '0_main',
    order: 0,
    command: {
        id: ChatSubmitAction.ID,
        title: localize('send.generate', "Generate"),
    },
    when: ContextKeyExpr.and(ChatContextKeys.inputHasText, CTX_INLINE_CHAT_REQUEST_IN_PROGRESS.toNegated(), CTX_INLINE_CHAT_EDITING.toNegated(), CTX_INLINE_CHAT_V1_ENABLED),
};
MenuRegistry.appendMenuItem(MENU_INLINE_CHAT_WIDGET_STATUS, editActionMenuItem);
MenuRegistry.appendMenuItem(MENU_INLINE_CHAT_WIDGET_STATUS, generateActionMenuItem);
const cancelActionMenuItem = {
    group: '0_main',
    order: 0,
    command: {
        id: CancelAction.ID,
        title: localize('cancel', "Cancel Request"),
        shortTitle: localize('cancelShort', "Cancel"),
    },
    when: ContextKeyExpr.and(CTX_INLINE_CHAT_REQUEST_IN_PROGRESS),
};
MenuRegistry.appendMenuItem(MENU_INLINE_CHAT_WIDGET_STATUS, cancelActionMenuItem);
// --- actions ---
registerAction2(InlineChatActions.StartSessionAction);
registerAction2(InlineChatActions.CloseAction);
registerAction2(InlineChatActions.ConfigureInlineChatAction);
registerAction2(InlineChatActions.UnstashSessionAction);
registerAction2(InlineChatActions.DiscardHunkAction);
registerAction2(InlineChatActions.RerunAction);
registerAction2(InlineChatActions.MoveToNextHunk);
registerAction2(InlineChatActions.MoveToPreviousHunk);
registerAction2(InlineChatActions.ArrowOutUpAction);
registerAction2(InlineChatActions.ArrowOutDownAction);
registerAction2(InlineChatActions.FocusInlineChat);
registerAction2(InlineChatActions.ViewInChatAction);
registerAction2(InlineChatActions.ToggleDiffForChange);
registerAction2(InlineChatActions.AcceptChanges);
const workbenchContributionsRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchContributionsRegistry.registerWorkbenchContribution(InlineChatNotebookContribution, 3 /* LifecyclePhase.Restored */);
registerWorkbenchContribution2(InlineChatEnabler.Id, InlineChatEnabler, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(InlineChatEscapeToolContribution.Id, InlineChatEscapeToolContribution, 3 /* WorkbenchPhase.AfterRestored */);
AccessibleViewRegistry.register(new InlineChatAccessibleView());
AccessibleViewRegistry.register(new InlineChatAccessibilityHelp());
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ2hhdC5jb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvaW5saW5lQ2hhdC9icm93c2VyL2lubGluZUNoYXQuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBbUMsMEJBQTBCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUM3SCxPQUFPLEVBQWEsWUFBWSxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQzFHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxxQkFBcUIsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQy9HLE9BQU8sS0FBSyxpQkFBaUIsTUFBTSx3QkFBd0IsQ0FBQztBQUM1RCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsMEJBQTBCLEVBQUUsbUNBQW1DLEVBQUUsY0FBYyxFQUFFLDhCQUE4QixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDbkwsT0FBTyxFQUFxQixpQkFBaUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQy9HLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUU1RSxPQUFPLEVBQUUsOEJBQThCLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN6RSxPQUFPLEVBQW1DLDhCQUE4QixFQUFFLFVBQVUsSUFBSSxtQkFBbUIsRUFBa0IsTUFBTSxrQ0FBa0MsQ0FBQztBQUN0SyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN6RSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMxRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsZ0NBQWdDLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN0SSxPQUFPLEVBQUUsc0JBQXNCLEVB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