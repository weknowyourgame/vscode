/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { AccessibleContentProvider } from '../../../../platform/accessibility/browser/accessibleView.js';
import { ChatContextKeys } from '../common/chatContextKeys.js';
import { ITerminalChatService } from '../../terminal/browser/terminal.js';
export class ChatTerminalOutputAccessibleView {
    constructor() {
        this.priority = 115;
        this.name = 'chatTerminalOutput';
        this.type = "view" /* AccessibleViewType.View */;
        this.when = ChatContextKeys.inChatTerminalToolOutput;
    }
    getProvider(accessor) {
        const terminalChatService = accessor.get(ITerminalChatService);
        const part = terminalChatService.getFocusedProgressPart();
        if (!part) {
            return;
        }
        const content = part.getCommandAndOutputAsText();
        if (!content) {
            return;
        }
        return new AccessibleContentProvider("chatTerminalOutput" /* AccessibleViewProviderId.ChatTerminalOutput */, { type: "view" /* AccessibleViewType.View */, id: "chatTerminalOutput" /* AccessibleViewProviderId.ChatTerminalOutput */, language: 'text' }, () => content, () => part.focusOutput(), "accessibility.verbosity.terminalChatOutput" /* AccessibilityVerbositySettingId.TerminalChatOutput */);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRlcm1pbmFsT3V0cHV0QWNjZXNzaWJsZVZpZXcuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRUZXJtaW5hbE91dHB1dEFjY2Vzc2libGVWaWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSx5QkFBeUIsRUFBZ0QsTUFBTSw4REFBOEQsQ0FBQztBQUl2SixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDL0QsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFFMUUsTUFBTSxPQUFPLGdDQUFnQztJQUE3QztRQUNVLGFBQVEsR0FBRyxHQUFHLENBQUM7UUFDZixTQUFJLEdBQUcsb0JBQW9CLENBQUM7UUFDNUIsU0FBSSx3Q0FBMkI7UUFDL0IsU0FBSSxHQUFHLGVBQWUsQ0FBQyx3QkFBd0IsQ0FBQztJQXNCMUQsQ0FBQztJQXBCQSxXQUFXLENBQUMsUUFBMEI7UUFDckMsTUFBTSxtQkFBbUIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDL0QsTUFBTSxJQUFJLEdBQUcsbUJBQW1CLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUMxRCxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDWCxPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO1FBQ2pELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNkLE9BQU87UUFDUixDQUFDO1FBRUQsT0FBTyxJQUFJLHlCQUF5Qix5RUFFbkMsRUFBRSxJQUFJLHNDQUF5QixFQUFFLEVBQUUsd0VBQTZDLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxFQUNwRyxHQUFHLEVBQUUsQ0FBQyxPQUFPLEVBQ2IsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSx3R0FFeEIsQ0FBQztJQUNILENBQUM7Q0FDRCJ9