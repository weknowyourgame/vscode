/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize, localize2 } from '../../../../nls.js';
/**
 * An object holding strings shared by multiple parts of the terminal
 */
export const terminalStrings = {
    terminal: localize('terminal', "Terminal"),
    new: localize('terminal.new', "New Terminal"),
    doNotShowAgain: localize('doNotShowAgain', 'Do Not Show Again'),
    currentSessionCategory: localize('currentSessionCategory', 'current session'),
    previousSessionCategory: localize('previousSessionCategory', 'previous session'),
    typeTask: localize('task', "Task"),
    typeLocal: localize('local', "Local"),
    actionCategory: localize2('terminalCategory', "Terminal"),
    focus: localize2('workbench.action.terminal.focus', "Focus Terminal"),
    focusInstance: localize2('workbench.action.terminal.focusInstance', "Focus Terminal"),
    focusAndHideAccessibleBuffer: localize2('workbench.action.terminal.focusAndHideAccessibleBuffer', "Focus Terminal and Hide Accessible Buffer"),
    kill: {
        ...localize2('killTerminal', "Kill Terminal"),
        short: localize('killTerminal.short', "Kill"),
    },
    moveToEditor: localize2('moveToEditor', "Move Terminal into Editor Area"),
    moveIntoNewWindow: localize2('moveIntoNewWindow', "Move Terminal into New Window"),
    newInNewWindow: localize2('newInNewWindow', "New Terminal Window"),
    moveToTerminalPanel: localize2('workbench.action.terminal.moveToTerminalPanel', "Move Terminal into Panel"),
    changeIcon: localize2('workbench.action.terminal.changeIcon', "Change Icon..."),
    changeColor: localize2('workbench.action.terminal.changeColor', "Change Color..."),
    split: {
        ...localize2('splitTerminal', "Split Terminal"),
        short: localize('splitTerminal.short', "Split"),
    },
    unsplit: localize2('unsplitTerminal', "Unsplit Terminal"),
    rename: localize2('workbench.action.terminal.rename', "Rename..."),
    toggleSizeToContentWidth: localize2('workbench.action.terminal.sizeToContentWidthInstance', "Toggle Size to Content Width"),
    focusHover: localize2('workbench.action.terminal.focusHover', "Focus Hover"),
    newWithCwd: localize2('workbench.action.terminal.newWithCwd', "Create New Terminal Starting in a Custom Working Directory"),
    renameWithArgs: localize2('workbench.action.terminal.renameWithArg', "Rename the Currently Active Terminal"),
    scrollToPreviousCommand: localize2('workbench.action.terminal.scrollToPreviousCommand', "Scroll to Previous Command"),
    scrollToNextCommand: localize2('workbench.action.terminal.scrollToNextCommand', "Scroll to Next Command"),
    revealCommand: localize2('workbench.action.terminal.revealCommand', "Reveal Command in Terminal"),
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxTdHJpbmdzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbFN0cmluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUV6RDs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLGVBQWUsR0FBRztJQUM5QixRQUFRLEVBQUUsUUFBUSxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUM7SUFDMUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxjQUFjLEVBQUUsY0FBYyxDQUFDO0lBQzdDLGNBQWMsRUFBRSxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsbUJBQW1CLENBQUM7SUFDL0Qsc0JBQXNCLEVBQUUsUUFBUSxDQUFDLHdCQUF3QixFQUFFLGlCQUFpQixDQUFDO0lBQzdFLHVCQUF1QixFQUFFLFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSxrQkFBa0IsQ0FBQztJQUNoRixRQUFRLEVBQUUsUUFBUSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUM7SUFDbEMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDO0lBQ3JDLGNBQWMsRUFBRSxTQUFTLENBQUMsa0JBQWtCLEVBQUUsVUFBVSxDQUFDO0lBQ3pELEtBQUssRUFBRSxTQUFTLENBQUMsaUNBQWlDLEVBQUUsZ0JBQWdCLENBQUM7SUFDckUsYUFBYSxFQUFFLFNBQVMsQ0FBQyx5Q0FBeUMsRUFBRSxnQkFBZ0IsQ0FBQztJQUNyRiw0QkFBNEIsRUFBRSxTQUFTLENBQUMsd0RBQXdELEVBQUUsMkNBQTJDLENBQUM7SUFDOUksSUFBSSxFQUFFO1FBQ0wsR0FBRyxTQUFTLENBQUMsY0FBYyxFQUFFLGVBQWUsQ0FBQztRQUM3QyxLQUFLLEVBQUUsUUFBUSxDQUFDLG9CQUFvQixFQUFFLE1BQU0sQ0FBQztLQUM3QztJQUNELFlBQVksRUFBRSxTQUFTLENBQUMsY0FBYyxFQUFFLGdDQUFnQyxDQUFDO0lBQ3pFLGlCQUFpQixFQUFFLFNBQVMsQ0FBQyxtQkFBbUIsRUFBRSwrQkFBK0IsQ0FBQztJQUNsRixjQUFjLEVBQUUsU0FBUyxDQUFDLGdCQUFnQixFQUFFLHFCQUFxQixDQUFDO0lBQ2xFLG1CQUFtQixFQUFFLFNBQVMsQ0FBQywrQ0FBK0MsRUFBRSwwQkFBMEIsQ0FBQztJQUMzRyxVQUFVLEVBQUUsU0FBUyxDQUFDLHNDQUFzQyxFQUFFLGdCQUFnQixDQUFDO0lBQy9FLFdBQVcsRUFBRSxTQUFTLENBQUMsdUNBQXVDLEVBQUUsaUJBQWlCLENBQUM7SUFDbEYsS0FBSyxFQUFFO1FBQ04sR0FBRyxTQUFTLENBQUMsZUFBZSxFQUFFLGdCQUFnQixDQUFDO1FBQy9DLEtBQUssRUFBRSxRQUFRLENBQUMscUJBQXFCLEVBQUUsT0FBTyxDQUFDO0tBQy9DO0lBQ0QsT0FBTyxFQUFFLFNBQVMsQ0FBQyxpQkFBaUIsRUFBRSxrQkFBa0IsQ0FBQztJQUN6RCxNQUFNLEVBQUUsU0FBUyxDQUFDLGtDQUFrQyxFQUFFLFdBQVcsQ0FBQztJQUNsRSx3QkFBd0IsRUFBRSxTQUFTLENBQUMsc0RBQXNELEVBQUUsOEJBQThCLENBQUM7SUFDM0gsVUFBVSxFQUFFLFNBQVMsQ0FBQyxzQ0FBc0MsRUFBRSxhQUFhLENBQUM7SUFDNUUsVUFBVSxFQUFFLFNBQVMsQ0FBQyxzQ0FBc0MsRUFBRSw0REFBNEQsQ0FBQztJQUMzSCxjQUFjLEVBQUUsU0FBUyxDQUFDLHlDQUF5QyxFQUFFLHNDQUFzQyxDQUFDO0lBQzVHLHVCQUF1QixFQUFFLFNBQVMsQ0FBQyxtREFBbUQsRUFBRSw0QkFBNEIsQ0FBQztJQUNySCxtQkFBbUIsRUFBRSxTQUFTLENBQUMsK0NBQStDLEVBQUUsd0JBQXdCLENBQUM7SUFDekcsYUFBYSxFQUFFLFNBQVMsQ0FBQyx5Q0FBeUMsRUFBRSw0QkFBNEIsQ0FBQztDQUNqRyxDQUFDIn0=