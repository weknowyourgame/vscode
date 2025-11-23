/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../../base/common/codicons.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../../nls.js';
import { ToolDataSource } from '../../../../chat/common/languageModelToolsService.js';
import { RunInTerminalTool } from './runInTerminalTool.js';
export const GetTerminalOutputToolData = {
    id: 'get_terminal_output',
    toolReferenceName: 'getTerminalOutput',
    legacyToolReferenceFullNames: ['runCommands/getTerminalOutput'],
    displayName: localize('getTerminalOutputTool.displayName', 'Get Terminal Output'),
    modelDescription: 'Get the output of a terminal command previously started with run_in_terminal',
    icon: Codicon.terminal,
    source: ToolDataSource.Internal,
    inputSchema: {
        type: 'object',
        properties: {
            id: {
                type: 'string',
                description: 'The ID of the terminal to check.'
            },
        },
        required: [
            'id',
        ]
    }
};
export class GetTerminalOutputTool extends Disposable {
    async prepareToolInvocation(context, token) {
        return {
            invocationMessage: localize('bg.progressive', "Checking background terminal output"),
            pastTenseMessage: localize('bg.past', "Checked background terminal output"),
        };
    }
    async invoke(invocation, _countTokens, _progress, token) {
        const args = invocation.parameters;
        return {
            content: [{
                    kind: 'text',
                    value: `Output of terminal ${args.id}:\n${RunInTerminalTool.getBackgroundOutput(args.id)}`
                }]
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0VGVybWluYWxPdXRwdXRUb29sLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9jaGF0QWdlbnRUb29scy9icm93c2VyL3Rvb2xzL2dldFRlcm1pbmFsT3V0cHV0VG9vbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsY0FBYyxFQUE2TCxNQUFNLHNEQUFzRCxDQUFDO0FBQ2pSLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBRTNELE1BQU0sQ0FBQyxNQUFNLHlCQUF5QixHQUFjO0lBQ25ELEVBQUUsRUFBRSxxQkFBcUI7SUFDekIsaUJBQWlCLEVBQUUsbUJBQW1CO0lBQ3RDLDRCQUE0QixFQUFFLENBQUMsK0JBQStCLENBQUM7SUFDL0QsV0FBVyxFQUFFLFFBQVEsQ0FBQyxtQ0FBbUMsRUFBRSxxQkFBcUIsQ0FBQztJQUNqRixnQkFBZ0IsRUFBRSw4RUFBOEU7SUFDaEcsSUFBSSxFQUFFLE9BQU8sQ0FBQyxRQUFRO0lBQ3RCLE1BQU0sRUFBRSxjQUFjLENBQUMsUUFBUTtJQUMvQixXQUFXLEVBQUU7UUFDWixJQUFJLEVBQUUsUUFBUTtRQUNkLFVBQVUsRUFBRTtZQUNYLEVBQUUsRUFBRTtnQkFDSCxJQUFJLEVBQUUsUUFBUTtnQkFDZCxXQUFXLEVBQUUsa0NBQWtDO2FBQy9DO1NBQ0Q7UUFDRCxRQUFRLEVBQUU7WUFDVCxJQUFJO1NBQ0o7S0FDRDtDQUNELENBQUM7QUFNRixNQUFNLE9BQU8scUJBQXNCLFNBQVEsVUFBVTtJQUNwRCxLQUFLLENBQUMscUJBQXFCLENBQUMsT0FBMEMsRUFBRSxLQUF3QjtRQUMvRixPQUFPO1lBQ04saUJBQWlCLEVBQUUsUUFBUSxDQUFDLGdCQUFnQixFQUFFLHFDQUFxQyxDQUFDO1lBQ3BGLGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxTQUFTLEVBQUUsb0NBQW9DLENBQUM7U0FDM0UsQ0FBQztJQUNILENBQUM7SUFFRCxLQUFLLENBQUMsTUFBTSxDQUFDLFVBQTJCLEVBQUUsWUFBaUMsRUFBRSxTQUF1QixFQUFFLEtBQXdCO1FBQzdILE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxVQUEyQyxDQUFDO1FBQ3BFLE9BQU87WUFDTixPQUFPLEVBQUUsQ0FBQztvQkFDVCxJQUFJLEVBQUUsTUFBTTtvQkFDWixLQUFLLEVBQUUsc0JBQXNCLElBQUksQ0FBQyxFQUFFLE1BQU0saUJBQWlCLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFO2lCQUMxRixDQUFDO1NBQ0YsQ0FBQztJQUNILENBQUM7Q0FDRCJ9