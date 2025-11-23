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
import { MarkdownString } from '../../../../../../../base/common/htmlContent.js';
import { Disposable, DisposableStore } from '../../../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../../../nls.js';
import { IConfigurationService } from '../../../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../../../platform/instantiation/common/instantiation.js';
import { ITelemetryService } from '../../../../../../../platform/telemetry/common/telemetry.js';
import { ToolDataSource } from '../../../../../chat/common/languageModelToolsService.js';
import { ITaskService, TasksAvailableContext } from '../../../../../tasks/common/taskService.js';
import { ITerminalService } from '../../../../../terminal/browser/terminal.js';
import { collectTerminalResults, getTaskDefinition, getTaskForTool, resolveDependencyTasks, tasksMatch } from '../../taskHelpers.js';
import { toolResultDetailsFromResponse, toolResultMessageFromResponse } from './taskHelpers.js';
export const GetTaskOutputToolData = {
    id: 'get_task_output',
    toolReferenceName: 'getTaskOutput',
    legacyToolReferenceFullNames: ['runTasks/getTaskOutput'],
    displayName: localize('getTaskOutputTool.displayName', 'Get Task Output'),
    modelDescription: 'Get the output of a task',
    source: ToolDataSource.Internal,
    when: TasksAvailableContext,
    inputSchema: {
        type: 'object',
        properties: {
            id: {
                type: 'string',
                description: 'The task ID for which to get the output.'
            },
            workspaceFolder: {
                type: 'string',
                description: 'The workspace folder path containing the task'
            },
        },
        required: [
            'id',
            'workspaceFolder'
        ]
    }
};
let GetTaskOutputTool = class GetTaskOutputTool extends Disposable {
    constructor(_tasksService, _terminalService, _configurationService, _instantiationService, _telemetryService) {
        super();
        this._tasksService = _tasksService;
        this._terminalService = _terminalService;
        this._configurationService = _configurationService;
        this._instantiationService = _instantiationService;
        this._telemetryService = _telemetryService;
    }
    async prepareToolInvocation(context, token) {
        const args = context.parameters;
        const taskDefinition = getTaskDefinition(args.id);
        const task = await getTaskForTool(args.id, taskDefinition, args.workspaceFolder, this._configurationService, this._tasksService, true);
        if (!task) {
            return { invocationMessage: new MarkdownString(localize('copilotChat.taskNotFound', 'Task not found: `{0}`', args.id)) };
        }
        const taskLabel = task._label;
        const activeTasks = await this._tasksService.getActiveTasks();
        if (activeTasks.includes(task)) {
            return { invocationMessage: new MarkdownString(localize('copilotChat.taskAlreadyRunning', 'The task `{0}` is already running.', taskLabel)) };
        }
        return {
            invocationMessage: new MarkdownString(localize('copilotChat.checkingTerminalOutput', 'Checking output for task `{0}`', taskLabel)),
            pastTenseMessage: new MarkdownString(localize('copilotChat.checkedTerminalOutput', 'Checked output for task `{0}`', taskLabel)),
        };
    }
    async invoke(invocation, _countTokens, _progress, token) {
        const args = invocation.parameters;
        const taskDefinition = getTaskDefinition(args.id);
        const task = await getTaskForTool(args.id, taskDefinition, args.workspaceFolder, this._configurationService, this._tasksService, true);
        if (!task) {
            return { content: [{ kind: 'text', value: `Task not found: ${args.id}` }], toolResultMessage: new MarkdownString(localize('copilotChat.taskNotFound', 'Task not found: `{0}`', args.id)) };
        }
        const dependencyTasks = await resolveDependencyTasks(task, args.workspaceFolder, this._configurationService, this._tasksService);
        const resources = this._tasksService.getTerminalsForTasks(dependencyTasks ?? task);
        const taskLabel = task._label;
        const terminals = resources?.map(resource => this._terminalService.instances.find(t => t.resource.path === resource?.path && t.resource.scheme === resource.scheme)).filter(t => !!t);
        if (!terminals || terminals.length === 0) {
            return { content: [{ kind: 'text', value: `Terminal not found for task ${taskLabel}` }], toolResultMessage: new MarkdownString(localize('copilotChat.terminalNotFound', 'Terminal not found for task `{0}`', taskLabel)) };
        }
        const store = new DisposableStore();
        const terminalResults = await collectTerminalResults(terminals, task, this._instantiationService, invocation.context, _progress, token, store, (terminalTask) => this._isTaskActive(terminalTask), dependencyTasks, this._tasksService);
        store.dispose();
        for (const r of terminalResults) {
            this._telemetryService.publicLog2?.('copilotChat.getTaskOutputTool.get', {
                taskId: args.id,
                bufferLength: r.output.length ?? 0,
                pollDurationMs: r.pollDurationMs ?? 0,
                inputToolManualAcceptCount: r.inputToolManualAcceptCount ?? 0,
                inputToolManualRejectCount: r.inputToolManualRejectCount ?? 0,
                inputToolManualChars: r.inputToolManualChars ?? 0,
                inputToolManualShownCount: r.inputToolManualShownCount ?? 0,
                inputToolFreeFormInputCount: r.inputToolFreeFormInputCount ?? 0,
                inputToolFreeFormInputShownCount: r.inputToolFreeFormInputShownCount ?? 0
            });
        }
        const details = terminalResults.map(r => `Terminal: ${r.name}\nOutput:\n${r.output}`);
        const uniqueDetails = Array.from(new Set(details)).join('\n\n');
        const toolResultDetails = toolResultDetailsFromResponse(terminalResults);
        const toolResultMessage = toolResultMessageFromResponse(undefined, taskLabel, toolResultDetails, terminalResults, true);
        return {
            content: [{ kind: 'text', value: uniqueDetails }],
            toolResultMessage,
            toolResultDetails
        };
    }
    async _isTaskActive(task) {
        const busyTasks = await this._tasksService.getBusyTasks();
        return busyTasks?.some(t => tasksMatch(t, task)) ?? false;
    }
};
GetTaskOutputTool = __decorate([
    __param(0, ITaskService),
    __param(1, ITerminalService),
    __param(2, IConfigurationService),
    __param(3, IInstantiationService),
    __param(4, ITelemetryService)
], GetTaskOutputTool);
export { GetTaskOutputTool };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0VGFza091dHB1dFRvb2wuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL2Jyb3dzZXIvdG9vbHMvdGFzay9nZXRUYXNrT3V0cHV0VG9vbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0saURBQWlELENBQUM7QUFDakYsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUM1RixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0scUVBQXFFLENBQUM7QUFDNUcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0scUVBQXFFLENBQUM7QUFDNUcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDaEcsT0FBTyxFQUFFLGNBQWMsRUFBNkwsTUFBTSx5REFBeUQsQ0FBQztBQUNwUixPQUFPLEVBQUUsWUFBWSxFQUFRLHFCQUFxQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDdkcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDL0UsT0FBTyxFQUFFLHNCQUFzQixFQUFFLGlCQUFpQixFQUFFLGNBQWMsRUFBRSxzQkFBc0IsRUFBRSxVQUFVLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUNySSxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUdoRyxNQUFNLENBQUMsTUFBTSxxQkFBcUIsR0FBYztJQUMvQyxFQUFFLEVBQUUsaUJBQWlCO0lBQ3JCLGlCQUFpQixFQUFFLGVBQWU7SUFDbEMsNEJBQTRCLEVB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