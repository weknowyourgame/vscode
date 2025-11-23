/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Codicon } from '../../../../../../base/common/codicons.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../../nls.js';
import { ToolDataSource } from '../../../../chat/common/languageModelToolsService.js';
import { ITerminalService } from '../../../../terminal/browser/terminal.js';
export const GetTerminalSelectionToolData = {
    id: 'terminal_selection',
    toolReferenceName: 'terminalSelection',
    legacyToolReferenceFullNames: ['runCommands/terminalSelection'],
    displayName: localize('terminalSelectionTool.displayName', 'Get Terminal Selection'),
    modelDescription: 'Get the current selection in the active terminal.',
    source: ToolDataSource.Internal,
    icon: Codicon.terminal,
};
let GetTerminalSelectionTool = class GetTerminalSelectionTool extends Disposable {
    constructor(_terminalService) {
        super();
        this._terminalService = _terminalService;
    }
    async prepareToolInvocation(context, token) {
        return {
            invocationMessage: localize('getTerminalSelection.progressive', "Reading terminal selection"),
            pastTenseMessage: localize('getTerminalSelection.past', "Read terminal selection"),
        };
    }
    async invoke(invocation, _countTokens, _progress, token) {
        const activeInstance = this._terminalService.activeInstance;
        if (!activeInstance) {
            return {
                content: [{
                        kind: 'text',
                        value: 'No active terminal instance found.'
                    }]
            };
        }
        const selection = activeInstance.selection;
        if (!selection) {
            return {
                content: [{
                        kind: 'text',
                        value: 'No text is currently selected in the active terminal.'
                    }]
            };
        }
        return {
            content: [{
                    kind: 'text',
                    value: `The active terminal's selection:\n${selection}`
                }]
        };
    }
};
GetTerminalSelectionTool = __decorate([
    __param(0, ITerminalService)
], GetTerminalSelectionTool);
export { GetTerminalSelectionTool };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0VGVybWluYWxTZWxlY3Rpb25Ub29sLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9jaGF0QWdlbnRUb29scy9icm93c2VyL3Rvb2xzL2dldFRlcm1pbmFsU2VsZWN0aW9uVG9vbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsY0FBYyxFQUE2TCxNQUFNLHNEQUFzRCxDQUFDO0FBQ2pSLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRTVFLE1BQU0sQ0FBQyxNQUFNLDRCQUE0QixHQUFjO0lBQ3RELEVBQUUsRUFBRSxvQkFBb0I7SUFDeEIsaUJBQWlCLEVBQUUsbUJBQW1CO0lBQ3RDLDRCQUE0QixFQUFFLENBQUMsK0JBQStCLENBQUM7SUFDL0QsV0FBVyxFQUFFLFFBQVEsQ0FBQyxtQ0FBbUMsRUFBRSx3QkFBd0IsQ0FBQztJQUNwRixnQkFBZ0IsRUFBRSxtREFBbUQ7SUFDckUsTUFBTSxFQUFFLGNBQWMsQ0FBQyxRQUFRO0lBQy9CLElBQUksRUFBRSxPQUFPLENBQUMsUUFBUTtDQUN0QixDQUFDO0FBRUssSUFBTSx3QkFBd0IsR0FBOUIsTUFBTSx3QkFBeUIsU0FBUSxVQUFVO0lBRXZELFlBQ29DLGdCQUFrQztRQUVyRSxLQUFLLEVBQUUsQ0FBQztRQUYyQixxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQWtCO0lBR3RFLENBQUM7SUFFRCxLQUFLLENBQUMscUJBQXFCLENBQUMsT0FBMEMsRUFBRSxLQUF3QjtRQUMvRixPQUFPO1lBQ04saUJBQWlCLEVBQUUsUUFBUSxDQUFDLGtDQUFrQyxFQUFFLDRCQUE0QixDQUFDO1lBQzdGLGdCQUFnQixFQUFFLFFBQVEsQ0FBQywyQkFBMkIsRUFBRSx5QkFBeUIsQ0FBQztTQUNsRixDQUFDO0lBQ0gsQ0FBQztJQUVELEtBQUssQ0FBQyxNQUFNLENBQUMsVUFBMkIsRUFBRSxZQUFpQyxFQUFFLFNBQXVCLEVBQUUsS0FBd0I7UUFDN0gsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGNBQWMsQ0FBQztRQUM1RCxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDckIsT0FBTztnQkFDTixPQUFPLEVBQUUsQ0FBQzt3QkFDVCxJQUFJLEVBQUUsTUFBTTt3QkFDWixLQUFLLEVBQUUsb0NBQW9DO3FCQUMzQyxDQUFDO2FBQ0YsQ0FBQztRQUNILENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBRyxjQUFjLENBQUMsU0FBUyxDQUFDO1FBQzNDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNoQixPQUFPO2dCQUNOLE9BQU8sRUFBRSxDQUFDO3dCQUNULElBQUksRUFBRSxNQUFNO3dCQUNaLEtBQUssRUFBRSx1REFBdUQ7cUJBQzlELENBQUM7YUFDRixDQUFDO1FBQ0gsQ0FBQztRQUVELE9BQU87WUFDTixPQUFPLEVBQUUsQ0FBQztvQkFDVCxJQUFJLEVBQUUsTUFBTTtvQkFDWixLQUFLLEVBQUUscUNBQXFDLFNBQVMsRUFBRTtpQkFDdkQsQ0FBQztTQUNGLENBQUM7SUFDSCxDQUFDO0NBQ0QsQ0FBQTtBQTNDWSx3QkFBd0I7SUFHbEMsV0FBQSxnQkFBZ0IsQ0FBQTtHQUhOLHdCQUF3QixDQTJDcEMifQ==