/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { AccessibleViewRegistry } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { registerAction2 } from '../../../../platform/actions/common/actions.js';
import { wrapInHotClass1 } from '../../../../platform/observable/common/wrapInHotClass.js';
import { registerEditorAction, registerEditorContribution } from '../../../browser/editorExtensions.js';
import { HoverParticipantRegistry } from '../../hover/browser/hoverTypes.js';
import { AcceptInlineCompletion, AcceptNextLineOfInlineCompletion, AcceptNextWordOfInlineCompletion, DevExtractReproSample, HideInlineCompletion, JumpToNextInlineEdit, ShowNextInlineSuggestionAction, ShowPreviousInlineSuggestionAction, ToggleAlwaysShowInlineSuggestionToolbar, TriggerInlineSuggestionAction, ToggleInlineCompletionShowCollapsed } from './controller/commands.js';
import { InlineCompletionsController } from './controller/inlineCompletionsController.js';
import { InlineCompletionsHoverParticipant } from './hintsWidget/hoverParticipant.js';
import { InlineCompletionsAccessibleView } from './inlineCompletionsAccessibleView.js';
import { CancelSnoozeInlineCompletion, SnoozeInlineCompletion } from '../../../browser/services/inlineCompletionsService.js';
registerEditorContribution(InlineCompletionsController.ID, wrapInHotClass1(InlineCompletionsController.hot), 3 /* EditorContributionInstantiation.Eventually */);
registerEditorAction(TriggerInlineSuggestionAction);
registerEditorAction(ShowNextInlineSuggestionAction);
registerEditorAction(ShowPreviousInlineSuggestionAction);
registerEditorAction(AcceptNextWordOfInlineCompletion);
registerEditorAction(AcceptNextLineOfInlineCompletion);
registerEditorAction(AcceptInlineCompletion);
registerEditorAction(ToggleInlineCompletionShowCollapsed);
registerEditorAction(HideInlineCompletion);
registerEditorAction(JumpToNextInlineEdit);
registerAction2(ToggleAlwaysShowInlineSuggestionToolbar);
registerEditorAction(DevExtractReproSample);
registerAction2(SnoozeInlineCompletion);
registerAction2(CancelSnoozeInlineCompletion);
HoverParticipantRegistry.register(InlineCompletionsHoverParticipant);
AccessibleViewRegistry.register(new InlineCompletionsAccessibleView());
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ29tcGxldGlvbnMuY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvaW5saW5lQ29tcGxldGlvbnMuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHNFQUFzRSxDQUFDO0FBQzlHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNqRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDM0YsT0FBTyxFQUFtQyxvQkFBb0IsRUFBRSwwQkFBMEIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pJLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxnQ0FBZ0MsRUFBRSxnQ0FBZ0MsRUFBRSxxQkFBcUIsRUFBRSxvQkFBb0IsRUFBRSxvQkFBb0IsRUFBRSw4QkFBOEIsRUFBRSxrQ0FBa0MsRUFBRSx1Q0FBdUMsRUFBRSw2QkFBNkIsRUFBRSxtQ0FBbUMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzFYLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzFGLE9BQU8sRUFBRSxpQ0FBaUMsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSwrQkFBK0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBRTdILDBCQUEwQixDQUFDLDJCQUEyQixDQUFDLEVBQUUsRUFBRSxlQUFlLENBQUMsMkJBQTJCLENBQUMsR0FBRyxDQUFDLHFEQUE2QyxDQUFDO0FBRXpKLG9CQUFvQixDQUFDLDZCQUE2QixDQUFDLENBQUM7QUFDcEQsb0JBQW9CLENBQUMsOEJBQThCLENBQUMsQ0FBQztBQUNyRCxvQkFBb0IsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO0FBQ3pELG9CQUFvQixDQUFDLGdDQUFnQyxDQUFDLENBQUM7QUFDdkQsb0JBQW9CLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztBQUN2RCxvQkFBb0IsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBQzdDLG9CQUFvQixDQUFDLG1DQUFtQyxDQUFDLENBQUM7QUFDMUQsb0JBQW9CLENBQUMsb0JBQW9CLENBQUMsQ0FBQztBQUMzQyxvQkFBb0IsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0FBQzNDLGVBQWUsQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO0FBQ3pELG9CQUFvQixDQUFDLHFCQUFxQixDQUFDLENBQUM7QUFDNUMsZUFBZSxDQUFDLHNCQUFzQixDQUFDLENBQUM7QUFDeEMsZUFBZSxDQUFDLDRCQUE0QixDQUFDLENBQUM7QUFFOUMsd0JBQXdCLENBQUMsUUFBUSxDQUFDLGlDQUFpQyxDQUFDLENBQUM7QUFDckUsc0JBQXNCLENBQUMsUUFBUSxDQUFDLElBQUksK0JBQStCLEVBQUUsQ0FBQyxDQUFDIn0=