/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Registry for commands that can trigger Inline Edits (NES) when invoked.
 */
export class TriggerInlineEditCommandsRegistry {
    static { this.REGISTERED_COMMANDS = new Set(); }
    static getRegisteredCommands() {
        return [...TriggerInlineEditCommandsRegistry.REGISTERED_COMMANDS];
    }
    static registerCommand(commandId) {
        TriggerInlineEditCommandsRegistry.REGISTERED_COMMANDS.add(commandId);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJpZ2dlcklubGluZUVkaXRDb21tYW5kc1JlZ2lzdHJ5LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9icm93c2VyL3RyaWdnZXJJbmxpbmVFZGl0Q29tbWFuZHNSZWdpc3RyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRzs7R0FFRztBQUNILE1BQU0sT0FBZ0IsaUNBQWlDO2FBRXZDLHdCQUFtQixHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7SUFFaEQsTUFBTSxDQUFDLHFCQUFxQjtRQUNsQyxPQUFPLENBQUMsR0FBRyxpQ0FBaUMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFFTSxNQUFNLENBQUMsZUFBZSxDQUFDLFNBQWlCO1FBQzlDLGlDQUFpQyxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUN0RSxDQUFDIn0=