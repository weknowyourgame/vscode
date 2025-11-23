/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export function checkModeOption(mode, option) {
    if (option === undefined) {
        return undefined;
    }
    if (typeof option === 'function') {
        return option(mode);
    }
    return option;
}
/**
 * @deprecated This is the old API shape, we should support this for a while before removing it so
 * we don't break existing chats
 */
export function migrateLegacyTerminalToolSpecificData(data) {
    if ('command' in data) {
        data = {
            kind: 'terminal',
            commandLine: {
                original: data.command,
                toolEdited: undefined,
                userEdited: undefined
            },
            language: data.language
        };
    }
    return data;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBS2hHLE1BQU0sVUFBVSxlQUFlLENBQUMsSUFBa0IsRUFBRSxNQUErRDtJQUNsSCxJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUMxQixPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBQ0QsSUFBSSxPQUFPLE1BQU0sS0FBSyxVQUFVLEVBQUUsQ0FBQztRQUNsQyxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNyQixDQUFDO0lBQ0QsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLHFDQUFxQyxDQUFDLElBQTZFO0lBQ2xJLElBQUksU0FBUyxJQUFJLElBQUksRUFBRSxDQUFDO1FBQ3ZCLElBQUksR0FBRztZQUNOLElBQUksRUFBRSxVQUFVO1lBQ2hCLFdBQVcsRUFBRTtnQkFDWixRQUFRLEVBQUUsSUFBSSxDQUFDLE9BQU87Z0JBQ3RCLFVBQVUsRUFBRSxTQUFTO2dCQUNyQixVQUFVLEVBQUUsU0FBUzthQUNyQjtZQUNELFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtTQUNtQixDQUFDO0lBQzdDLENBQUM7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNiLENBQUMifQ==