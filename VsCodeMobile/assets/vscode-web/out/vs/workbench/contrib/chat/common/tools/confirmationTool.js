/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { ToolDataSource, ToolInvocationPresentation } from '../languageModelToolsService.js';
export const ConfirmationToolId = 'vscode_get_confirmation';
export const ConfirmationToolData = {
    id: ConfirmationToolId,
    displayName: 'Confirmation Tool',
    modelDescription: 'A tool that demonstrates different types of confirmations. Takes a title, message, and confirmation type (basic or terminal).',
    source: ToolDataSource.Internal,
    inputSchema: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: 'Title for the confirmation dialog'
            },
            message: {
                type: 'string',
                description: 'Message to show in the confirmation dialog'
            },
            confirmationType: {
                type: 'string',
                enum: ['basic', 'terminal'],
                description: 'Type of confirmation to show - basic for simple confirmation, terminal for terminal command confirmation'
            },
            terminalCommand: {
                type: 'string',
                description: 'Terminal command to show (only used when confirmationType is "terminal")'
            }
        },
        required: ['title', 'message', 'confirmationType'],
        additionalProperties: false
    }
};
export class ConfirmationTool {
    async prepareToolInvocation(context, token) {
        const parameters = context.parameters;
        if (!parameters.title || !parameters.message) {
            throw new Error('Missing required parameters for ConfirmationTool');
        }
        const confirmationType = parameters.confirmationType ?? 'basic';
        // Create different tool-specific data based on confirmation type
        let toolSpecificData;
        if (confirmationType === 'terminal') {
            // For terminal confirmations, use the terminal tool data structure
            toolSpecificData = {
                kind: 'terminal',
                commandLine: {
                    original: parameters.terminalCommand ?? ''
                },
                language: 'bash'
            };
        }
        else {
            // For basic confirmations, don't set toolSpecificData - this will use the default confirmation UI
            toolSpecificData = undefined;
        }
        return {
            confirmationMessages: {
                title: parameters.title,
                message: new MarkdownString(parameters.message),
                allowAutoConfirm: true
            },
            toolSpecificData,
            presentation: ToolInvocationPresentation.HiddenAfterComplete
        };
    }
    async invoke(invocation, countTokens, progress, token) {
        // This is a no-op tool - just return success
        return {
            content: [{
                    kind: 'text',
                    value: 'yes' // Consumers should check for this label to know whether the tool was confirmed or skipped
                }]
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlybWF0aW9uVG9vbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi90b29scy9jb25maXJtYXRpb25Ub29sLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUUzRSxPQUFPLEVBQXVJLGNBQWMsRUFBRSwwQkFBMEIsRUFBZ0IsTUFBTSxpQ0FBaUMsQ0FBQztBQUVoUCxNQUFNLENBQUMsTUFBTSxrQkFBa0IsR0FBRyx5QkFBeUIsQ0FBQztBQUU1RCxNQUFNLENBQUMsTUFBTSxvQkFBb0IsR0FBYztJQUM5QyxFQUFFLEVBQUUsa0JBQWtCO0lBQ3RCLFdBQVcsRUFBRSxtQkFBbUI7SUFDaEMsZ0JBQWdCLEVBQUUsK0hBQStIO0lBQ2pKLE1BQU0sRUFBRSxjQUFjLENBQUMsUUFBUTtJQUMvQixXQUFXLEVBQUU7UUFDWixJQUFJLEVBQUUsUUFBUTtRQUNkLFVBQVUsRUFBRTtZQUNYLEtBQUssRUFBRTtnQkFDTixJQUFJLEVBQUUsUUFBUTtnQkFDZCxXQUFXLEVBQUUsbUNBQW1DO2FBQ2hEO1lBQ0QsT0FBTyxFQUFFO2dCQUNSLElBQUksRUFBRSxRQUFRO2dCQUNkLFdBQVcsRUFBRSw0Q0FBNEM7YUFDekQ7WUFDRCxnQkFBZ0IsRUFBRTtnQkFDakIsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQztnQkFDM0IsV0FBVyxFQUFFLDBHQUEwRzthQUN2SDtZQUNELGVBQWUsRUFBRTtnQkFDaEIsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsV0FBVyxFQUFFLDBFQUEwRTthQUN2RjtTQUNEO1FBQ0QsUUFBUSxFQUFFLENBQUMsT0FBTyxFQUFFLFNBQVMsRUFBRSxrQkFBa0IsQ0FBQztRQUNsRCxvQkFBb0IsRUFBRSxLQUFLO0tBQzNCO0NBQ0QsQ0FBQztBQVNGLE1BQU0sT0FBTyxnQkFBZ0I7SUFDNUIsS0FBSyxDQUFDLHFCQUFxQixDQUFDLE9BQTBDLEVBQUUsS0FBd0I7UUFDL0YsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLFVBQXFDLENBQUM7UUFDakUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDOUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxrREFBa0QsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7UUFFRCxNQUFNLGdCQUFnQixHQUFHLFVBQVUsQ0FBQyxnQkFBZ0IsSUFBSSxPQUFPLENBQUM7UUFFaEUsaUVBQWlFO1FBQ2pFLElBQUksZ0JBQTZELENBQUM7UUFFbEUsSUFBSSxnQkFBZ0IsS0FBSyxVQUFVLEVBQUUsQ0FBQztZQUNyQyxtRUFBbUU7WUFDbkUsZ0JBQWdCLEdBQUc7Z0JBQ2xCLElBQUksRUFBRSxVQUFVO2dCQUNoQixXQUFXLEVBQUU7b0JBQ1osUUFBUSxFQUFFLFVBQVUsQ0FBQyxlQUFlLElBQUksRUFBRTtpQkFDMUM7Z0JBQ0QsUUFBUSxFQUFFLE1BQU07YUFDaEIsQ0FBQztRQUNILENBQUM7YUFBTSxDQUFDO1lBQ1Asa0dBQWtHO1lBQ2xHLGdCQUFnQixHQUFHLFNBQVMsQ0FBQztRQUM5QixDQUFDO1FBRUQsT0FBTztZQUNOLG9CQUFvQixFQUFFO2dCQUNyQixLQUFLLEVBQUUsVUFBVSxDQUFDLEtBQUs7Z0JBQ3ZCLE9BQU8sRUFBRSxJQUFJLGNBQWMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDO2dCQUMvQyxnQkFBZ0IsRUFBRSxJQUFJO2FBQ3RCO1lBQ0QsZ0JBQWdCO1lBQ2hCLFlBQVksRUFBRSwwQkFBMEIsQ0FBQyxtQkFBbUI7U0FDNUQsQ0FBQztJQUNILENBQUM7SUFFRCxLQUFLLENBQUMsTUFBTSxDQUFDLFVBQTJCLEVBQUUsV0FBZ0MsRUFBRSxRQUFzQixFQUFFLEtBQXdCO1FBQzNILDZDQUE2QztRQUM3QyxPQUFPO1lBQ04sT0FBTyxFQUFFLENBQUM7b0JBQ1QsSUFBSSxFQUFFLE1BQU07b0JBQ1osS0FBSyxFQUFFLEtBQUssQ0FBQywwRkFBMEY7aUJBQ3ZHLENBQUM7U0FDRixDQUFDO0lBQ0gsQ0FBQztDQUNEIn0=