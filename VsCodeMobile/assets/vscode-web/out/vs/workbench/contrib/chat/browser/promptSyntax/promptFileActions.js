/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { registerAttachPromptActions } from './attachInstructionsAction.js';
import { registerAgentActions } from './chatModeActions.js';
import { registerRunPromptActions } from './runPromptAction.js';
import { registerNewPromptFileActions } from './newPromptFileActions.js';
import { registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { SaveAsAgentFileAction, SaveAsInstructionsFileAction, SaveAsPromptFileAction } from './saveAsPromptFileActions.js';
/**
 * Helper to register all actions related to reusable prompt files.
 */
export function registerPromptActions() {
    registerRunPromptActions();
    registerAttachPromptActions();
    registerAction2(SaveAsPromptFileAction);
    registerAction2(SaveAsInstructionsFileAction);
    registerAction2(SaveAsAgentFileAction);
    registerAgentActions();
    registerNewPromptFileActions();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0RmlsZUFjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL3Byb21wdFN5bnRheC9wcm9tcHRGaWxlQWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUM1RSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUM1RCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUNoRSxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUN6RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDcEYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLDRCQUE0QixFQUFFLHNCQUFzQixFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFHM0g7O0dBRUc7QUFDSCxNQUFNLFVBQVUscUJBQXFCO0lBQ3BDLHdCQUF3QixFQUFFLENBQUM7SUFDM0IsMkJBQTJCLEVBQUUsQ0FBQztJQUM5QixlQUFlLENBQUMsc0JBQXNCLENBQUMsQ0FBQztJQUN4QyxlQUFlLENBQUMsNEJBQTRCLENBQUMsQ0FBQztJQUM5QyxlQUFlLENBQUMscUJBQXFCLENBQUMsQ0FBQztJQUN2QyxvQkFBb0IsRUFBRSxDQUFDO0lBQ3ZCLDRCQUE0QixFQUFFLENBQUM7QUFDaEMsQ0FBQyJ9