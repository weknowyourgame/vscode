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
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILanguageModelToolsService, ToolDataSource, VSCodeToolReference } from '../../common/languageModelToolsService.js';
import { ConfirmationTool, ConfirmationToolData } from './confirmationTool.js';
import { EditTool, EditToolData } from './editFileTool.js';
import { createManageTodoListToolData, ManageTodoListTool, TodoListToolDescriptionFieldSettingId, TodoListToolWriteOnlySettingId } from './manageTodoListTool.js';
import { RunSubagentTool } from './runSubagentTool.js';
let BuiltinToolsContribution = class BuiltinToolsContribution extends Disposable {
    static { this.ID = 'chat.builtinTools'; }
    constructor(toolsService, instantiationService, configurationService) {
        super();
        this.configurationService = configurationService;
        const editTool = instantiationService.createInstance(EditTool);
        this._register(toolsService.registerTool(EditToolData, editTool));
        // Check if write-only mode is enabled for the todo tool
        const writeOnlyMode = this.configurationService.getValue(TodoListToolWriteOnlySettingId) === true;
        const includeDescription = this.configurationService.getValue(TodoListToolDescriptionFieldSettingId) !== false;
        const todoToolData = createManageTodoListToolData(writeOnlyMode, includeDescription);
        const manageTodoListTool = this._register(instantiationService.createInstance(ManageTodoListTool, writeOnlyMode, includeDescription));
        this._register(toolsService.registerTool(todoToolData, manageTodoListTool));
        // Register the confirmation tool
        const confirmationTool = instantiationService.createInstance(ConfirmationTool);
        this._register(toolsService.registerTool(ConfirmationToolData, confirmationTool));
        const runSubagentTool = this._register(instantiationService.createInstance(RunSubagentTool));
        const runSubagentToolData = runSubagentTool.getToolData();
        this._register(toolsService.registerTool(runSubagentToolData, runSubagentTool));
        const customAgentToolSet = this._register(toolsService.createToolSet(ToolDataSource.Internal, 'custom-agent', VSCodeToolReference.agent, {
            icon: ThemeIcon.fromId(Codicon.agent.id),
            description: localize('toolset.custom-agent', 'Delegate tasks to other agents'),
        }));
        this._register(customAgentToolSet.addTool(runSubagentToolData));
    }
};
BuiltinToolsContribution = __decorate([
    __param(0, ILanguageModelToolsService),
    __param(1, IInstantiationService),
    __param(2, IConfigurationService)
], BuiltinToolsContribution);
export { BuiltinToolsContribution };
export const InternalFetchWebPageToolId = 'vscode_fetchWebPage_internal';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9vbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vdG9vbHMvdG9vbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBRXRHLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxjQUFjLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUM1SCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUMvRSxPQUFPLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQzNELE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxrQkFBa0IsRUFBRSxxQ0FBcUMsRUFBRSw4QkFBOEIsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ2xLLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUVoRCxJQUFNLHdCQUF3QixHQUE5QixNQUFNLHdCQUF5QixTQUFRLFVBQVU7YUFFdkMsT0FBRSxHQUFHLG1CQUFtQixBQUF0QixDQUF1QjtJQUV6QyxZQUM2QixZQUF3QyxFQUM3QyxvQkFBMkMsRUFDMUIsb0JBQTJDO1FBRW5GLEtBQUssRUFBRSxDQUFDO1FBRmdDLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBdUI7UUFJbkYsTUFBTSxRQUFRLEdBQUcsb0JBQW9CLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQy9ELElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUVsRSx3REFBd0Q7UUFDeEQsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBVSw4QkFBOEIsQ0FBQyxLQUFLLElBQUksQ0FBQztRQUMzRyxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQVUscUNBQXFDLENBQUMsS0FBSyxLQUFLLENBQUM7UUFDeEgsTUFBTSxZQUFZLEdBQUcsNEJBQTRCLENBQUMsYUFBYSxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDckYsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxrQkFBa0IsRUFBRSxhQUFhLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBQ3RJLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxZQUFZLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBRTVFLGlDQUFpQztRQUNqQyxNQUFNLGdCQUFnQixHQUFHLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQy9FLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxvQkFBb0IsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7UUFFbEYsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztRQUM3RixNQUFNLG1CQUFtQixHQUFHLGVBQWUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUMxRCxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsbUJBQW1CLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQztRQUVoRixNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLGNBQWMsRUFBRSxtQkFBbUIsQ0FBQyxLQUFLLEVBQUU7WUFDeEksSUFBSSxFQUFFLFNBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDeEMsV0FBVyxFQUFFLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSxnQ0FBZ0MsQ0FBQztTQUMvRSxDQUFDLENBQUMsQ0FBQztRQUNKLElBQUksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztJQUNqRSxDQUFDOztBQWxDVyx3QkFBd0I7SUFLbEMsV0FBQSwwQkFBMEIsQ0FBQTtJQUMxQixXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEscUJBQXFCLENBQUE7R0FQWCx3QkFBd0IsQ0FtQ3BDOztBQUVELE1BQU0sQ0FBQyxNQUFNLDBCQUEwQixHQUFHLDhCQUE4QixDQUFDIn0=