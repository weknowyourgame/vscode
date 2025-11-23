/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../../base/common/codicons.js';
import { localize } from '../../../../../../nls.js';
import { ToolDataSource, ToolInvocationPresentation } from '../../../../chat/common/languageModelToolsService.js';
import { RunInTerminalTool } from './runInTerminalTool.js';
export const ConfirmTerminalCommandToolData = {
    id: 'vscode_get_terminal_confirmation',
    displayName: localize('confirmTerminalCommandTool.displayName', 'Confirm Terminal Command'),
    modelDescription: [
        'This tool allows you to get explicit user confirmation for a terminal command without executing it.',
        '',
        'When to use:',
        '- When you need to verify user approval before executing a command',
        '- When you want to show command details, auto-approval status, and simplified versions to the user',
        '- When you need the user to review a potentially risky command',
        '',
        'The tool will:',
        '- Show the command with syntax highlighting',
        '- Display auto-approval status if enabled',
        '- Show simplified version of the command if applicable',
        '- Provide custom actions for creating auto-approval rules',
        '- Return approval/rejection status',
        '',
        'After confirmation, use a tool to actually execute the command.'
    ].join('\n'),
    userDescription: localize('confirmTerminalCommandTool.userDescription', 'Tool for confirming terminal commands'),
    source: ToolDataSource.Internal,
    icon: Codicon.shield,
    inputSchema: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The command to confirm with the user.'
            },
            explanation: {
                type: 'string',
                description: 'A one-sentence description of what the command does. This will be shown to the user in the confirmation dialog.'
            },
            isBackground: {
                type: 'boolean',
                description: 'Whether the command would start a background process. This provides context for the confirmation.'
            },
        },
        required: [
            'command',
            'explanation',
            'isBackground',
        ]
    }
};
export class ConfirmTerminalCommandTool extends RunInTerminalTool {
    async prepareToolInvocation(context, token) {
        const preparedInvocation = await super.prepareToolInvocation(context, token);
        if (preparedInvocation) {
            preparedInvocation.presentation = ToolInvocationPresentation.HiddenAfterComplete;
        }
        return preparedInvocation;
    }
    async invoke(invocation, countTokens, progress, token) {
        // This is a confirmation-only tool - just return success
        return {
            content: [{
                    kind: 'text',
                    value: 'yes'
                }]
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVuSW5UZXJtaW5hbENvbmZpcm1hdGlvblRvb2wuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL2Jyb3dzZXIvdG9vbHMvcnVuSW5UZXJtaW5hbENvbmZpcm1hdGlvblRvb2wudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNwRCxPQUFPLEVBQTRILGNBQWMsRUFBRSwwQkFBMEIsRUFBZ0IsTUFBTSxzREFBc0QsQ0FBQztBQUMxUCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUUzRCxNQUFNLENBQUMsTUFBTSw4QkFBOEIsR0FBYztJQUN4RCxFQUFFLEVBQUUsa0NBQWtDO0lBQ3RDLFdBQVcsRUFBRSxRQUFRLENBQUMsd0NBQXdDLEVBQUUsMEJBQTBCLENBQUM7SUFDM0YsZ0JBQWdCLEVBQUU7UUFDakIscUdBQXFHO1FBQ3JHLEVBQUU7UUFDRixjQUFjO1FBQ2Qsb0VBQW9FO1FBQ3BFLG9HQUFvRztRQUNwRyxnRUFBZ0U7UUFDaEUsRUFBRTtRQUNGLGdCQUFnQjtRQUNoQiw2Q0FBNkM7UUFDN0MsMkNBQTJDO1FBQzNDLHdEQUF3RDtRQUN4RCwyREFBMkQ7UUFDM0Qsb0NBQW9DO1FBQ3BDLEVBQUU7UUFDRixpRUFBaUU7S0FDakUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ1osZUFBZSxFQUFFLFFBQVEsQ0FBQyw0Q0FBNEMsRUFBRSx1Q0FBdUMsQ0FBQztJQUNoSCxNQUFNLEVBQUUsY0FBYyxDQUFDLFFBQVE7SUFDL0IsSUFBSSxFQUFFLE9BQU8sQ0FBQyxNQUFNO0lBQ3BCLFdBQVcsRUFBRTtRQUNaLElBQUksRUFBRSxRQUFRO1FBQ2QsVUFBVSxFQUFFO1lBQ1gsT0FBTyxFQUFFO2dCQUNSLElBQUksRUFBRSxRQUFRO2dCQUNkLFdBQVcsRUFBRSx1Q0FBdUM7YUFDcEQ7WUFDRCxXQUFXLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsV0FBVyxFQUFFLGlIQUFpSDthQUM5SDtZQUNELFlBQVksRUFBRTtnQkFDYixJQUFJLEVBQUUsU0FBUztnQkFDZixXQUFXLEVBQUUsbUdBQW1HO2FBQ2hIO1NBQ0Q7UUFDRCxRQUFRLEVBQUU7WUFDVCxTQUFTO1lBQ1QsYUFBYTtZQUNiLGNBQWM7U0FDZDtLQUNEO0NBQ0QsQ0FBQztBQUVGLE1BQU0sT0FBTywwQkFBMkIsU0FBUSxpQkFBaUI7SUFDdkQsS0FBSyxDQUFDLHFCQUFxQixDQUFDLE9BQTBDLEVBQUUsS0FBd0I7UUFDeEcsTUFBTSxrQkFBa0IsR0FBRyxNQUFNLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDN0UsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO1lBQ3hCLGtCQUFrQixDQUFDLFlBQVksR0FBRywwQkFBMEIsQ0FBQyxtQkFBbUIsQ0FBQztRQUNsRixDQUFDO1FBQ0QsT0FBTyxrQkFBa0IsQ0FBQztJQUMzQixDQUFDO0lBQ1EsS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUEyQixFQUFFLFdBQWdDLEVBQUUsUUFBc0IsRUFBRSxLQUF3QjtRQUNwSSx5REFBeUQ7UUFDekQsT0FBTztZQUNOLE9BQU8sRUFBRSxDQUFDO29CQUNULElBQUksRUFBRSxNQUFNO29CQUNaLEtBQUssRUFBRSxLQUFLO2lCQUNaLENBQUM7U0FDRixDQUFDO0lBQ0gsQ0FBQztDQUNEIn0=