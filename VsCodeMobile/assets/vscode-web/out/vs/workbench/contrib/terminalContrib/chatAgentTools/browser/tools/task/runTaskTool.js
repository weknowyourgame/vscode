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
import { timeout } from '../../../../../../../base/common/async.js';
import { localize } from '../../../../../../../nls.js';
import { ITelemetryService } from '../../../../../../../platform/telemetry/common/telemetry.js';
import { ToolDataSource } from '../../../../../chat/common/languageModelToolsService.js';
import { ITaskService, TasksAvailableContext } from '../../../../../tasks/common/taskService.js';
import { ITerminalService } from '../../../../../terminal/browser/terminal.js';
import { collectTerminalResults, getTaskDefinition, getTaskForTool, resolveDependencyTasks, tasksMatch } from '../../taskHelpers.js';
import { MarkdownString } from '../../../../../../../base/common/htmlContent.js';
import { IConfigurationService } from '../../../../../../../platform/configuration/common/configuration.js';
import { Codicon } from '../../../../../../../base/common/codicons.js';
import { toolResultDetailsFromResponse, toolResultMessageFromResponse } from './taskHelpers.js';
import { IInstantiationService } from '../../../../../../../platform/instantiation/common/instantiation.js';
import { DisposableStore } from '../../../../../../../base/common/lifecycle.js';
let RunTaskTool = class RunTaskTool {
    constructor(_tasksService, _telemetryService, _terminalService, _configurationService, _instantiationService) {
        this._tasksService = _tasksService;
        this._telemetryService = _telemetryService;
        this._terminalService = _terminalService;
        this._configurationService = _configurationService;
        this._instantiationService = _instantiationService;
    }
    async invoke(invocation, _countTokens, _progress, token) {
        const args = invocation.parameters;
        if (!invocation.context) {
            return { content: [{ kind: 'text', value: `No invocation context` }], toolResultMessage: `No invocation context` };
        }
        const taskDefinition = getTaskDefinition(args.id);
        const task = await getTaskForTool(args.id, taskDefinition, args.workspaceFolder, this._configurationService, this._tasksService, true);
        if (!task) {
            return { content: [{ kind: 'text', value: `Task not found: ${args.id}` }], toolResultMessage: new MarkdownString(localize('chat.taskNotFound', 'Task not found: `{0}`', args.id)) };
        }
        const taskLabel = task._label;
        const activeTasks = await this._tasksService.getActiveTasks();
        if (activeTasks.includes(task)) {
            return { content: [{ kind: 'text', value: `The task ${taskLabel} is already running.` }], toolResultMessage: new MarkdownString(localize('chat.taskAlreadyRunning', 'The task `{0}` is already running.', taskLabel)) };
        }
        const raceResult = await Promise.race([this._tasksService.run(task, undefined, 5 /* TaskRunSource.ChatAgent */), timeout(3000)]);
        const result = raceResult && typeof raceResult === 'object' ? raceResult : undefined;
        const dependencyTasks = await resolveDependencyTasks(task, args.workspaceFolder, this._configurationService, this._tasksService);
        const resources = this._tasksService.getTerminalsForTasks(dependencyTasks ?? task);
        if (!resources || resources.length === 0) {
            return { content: [{ kind: 'text', value: `Task started but no terminal was found for: ${taskLabel}` }], toolResultMessage: new MarkdownString(localize('chat.noTerminal', 'Task started but no terminal was found for: `{0}`', taskLabel)) };
        }
        const terminals = this._terminalService.instances.filter(t => resources.some(r => r.path === t.resource.path && r.scheme === t.resource.scheme));
        if (terminals.length === 0) {
            return { content: [{ kind: 'text', value: `Task started but no terminal was found for: ${taskLabel}` }], toolResultMessage: new MarkdownString(localize('chat.noTerminal', 'Task started but no terminal was found for: `{0}`', taskLabel)) };
        }
        const store = new DisposableStore();
        const terminalResults = await collectTerminalResults(terminals, task, this._instantiationService, invocation.context, _progress, token, store, (terminalTask) => this._isTaskActive(terminalTask), dependencyTasks, this._tasksService);
        store.dispose();
        for (const r of terminalResults) {
            this._telemetryService.publicLog2?.('copilotChat.runTaskTool.run', {
                taskId: args.id,
                bufferLength: r.output.length ?? 0,
                pollDurationMs: r.pollDurationMs ?? 0,
                inputToolManualAcceptCount: r.inputToolManualAcceptCount ?? 0,
                inputToolManualRejectCount: r.inputToolManualRejectCount ?? 0,
                inputToolManualChars: r.inputToolManualChars ?? 0,
                inputToolManualShownCount: r.inputToolManualShownCount ?? 0,
                inputToolFreeFormInputShownCount: r.inputToolFreeFormInputShownCount ?? 0,
                inputToolFreeFormInputCount: r.inputToolFreeFormInputCount ?? 0
            });
        }
        const details = terminalResults.map(r => `Terminal: ${r.name}\nOutput:\n${r.output}`);
        const uniqueDetails = Array.from(new Set(details)).join('\n\n');
        const toolResultDetails = toolResultDetailsFromResponse(terminalResults);
        const toolResultMessage = toolResultMessageFromResponse(result, taskLabel, toolResultDetails, terminalResults);
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
    async prepareToolInvocation(context, token) {
        const args = context.parameters;
        const taskDefinition = getTaskDefinition(args.id);
        const task = await getTaskForTool(args.id, taskDefinition, args.workspaceFolder, this._configurationService, this._tasksService, true);
        if (!task) {
            return { invocationMessage: new MarkdownString(localize('chat.taskNotFound', 'Task not found: `{0}`', args.id)) };
        }
        const taskLabel = task._label;
        const activeTasks = await this._tasksService.getActiveTasks();
        if (task && activeTasks.includes(task)) {
            return { invocationMessage: new MarkdownString(localize('chat.taskAlreadyActive', 'The task is already running.')) };
        }
        if (await this._isTaskActive(task)) {
            return {
                invocationMessage: new MarkdownString(localize('chat.taskIsAlreadyRunning', '`{0}` is already running.', taskLabel)),
                pastTenseMessage: new MarkdownString(localize('chat.taskWasAlreadyRunning', '`{0}` was already running.', taskLabel)),
                confirmationMessages: undefined
            };
        }
        return {
            invocationMessage: new MarkdownString(localize('chat.runningTask', 'Running `{0}`', taskLabel)),
            pastTenseMessage: new MarkdownString(task?.configurationProperties.isBackground
                ? localize('chat.startedTask', 'Started `{0}`', taskLabel)
                : localize('chat.ranTask', 'Ran `{0}`', taskLabel)),
            confirmationMessages: task
                ? { title: localize('chat.allowTaskRunTitle', 'Allow task run?'), message: localize('chat.allowTaskRunMsg', 'Allow to run the task `{0}`?', taskLabel) }
                : undefined
        };
    }
};
RunTaskTool = __decorate([
    __param(0, ITaskService),
    __param(1, ITelemetryService),
    __param(2, ITerminalService),
    __param(3, IConfigurationService),
    __param(4, IInstantiationService)
], RunTaskTool);
export { RunTaskTool };
export const RunTaskToolData = {
    id: 'run_task',
    toolReferenceName: 'runTask',
    legacyToolReferenceFullNames: ['runTasks/runTask'],
    displayName: localize('runInTerminalTool.displayName', 'Run Task'),
    modelDescription: 'Runs a VS Code task.\n\n- If you see that an appropriate task exists for building or running code, prefer to use this tool to run the task instead of using the run_in_terminal tool.\n- Make sure that any appropriate build or watch task is running before trying to run tests or execute code.\n- If the user asks to run a task, use this tool to do so.',
    userDescription: localize('runInTerminalTool.userDescription', 'Run tasks in the workspace'),
    icon: Codicon.tools,
    source: ToolDataSource.Internal,
    when: TasksAvailableContext,
    inputSchema: {
        'type': 'object',
        'properties': {
            'workspaceFolder': {
                'type': 'string',
                'description': 'The workspace folder path containing the task'
            },
            'id': {
                'type': 'string',
                'description': 'The task ID to run.'
            }
        },
        'required': [
            'workspaceFolder',
            'id'
        ]
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVuVGFza1Rvb2wuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL2Jyb3dzZXIvdG9vbHMvdGFzay9ydW5UYXNrVG9vbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFFcEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ2hHLE9BQU8sRUFBdUksY0FBYyxFQUFnQixNQUFNLHlEQUF5RCxDQUFDO0FBQzVPLE9BQU8sRUFBRSxZQUFZLEVBQXNCLHFCQUFxQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFckgsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDL0UsT0FBTyxFQUFFLHNCQUFzQixFQUFFLGlCQUFpQixFQUFFLGNBQWMsRUFBRSxzQkFBc0IsRUFBRSxVQUFVLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUNySSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0saURBQWlELENBQUM7QUFDakYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0scUVBQXFFLENBQUM7QUFDNUcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSw2QkFBNkIsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ2hHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHFFQUFxRSxDQUFDO0FBQzVHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQVF6RSxJQUFNLFdBQVcsR0FBakIsTUFBTSxXQUFXO0lBRXZCLFlBQ2dDLGFBQTJCLEVBQ3RCLGlCQUFvQyxFQUNyQyxnQkFBa0MsRUFDN0IscUJBQTRDLEVBQzVDLHFCQUE0QztRQUpyRCxrQkFBYSxHQUFiLGFBQWEsQ0FBYztRQUN0QixzQkFBaUIsR0FBakIsaUJBQWlCLENBQW1CO1FBQ3JDLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBa0I7UUFDN0IsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtRQUM1QywwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO0lBQ2pGLENBQUM7SUFFTCxLQUFLLENBQUMsTUFBTSxDQUFDLFVBQTJCLEVBQUUsWUFBaUMsRUFBRSxTQUF1QixFQUFFLEtBQXdCO1FBQzdILE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxVQUErQixDQUFDO1FBRXhELElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDekIsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsdUJBQXVCLEVBQUUsQ0FBQyxFQUFFLGlCQUFpQixFQUFFLHVCQUF1QixFQUFFLENBQUM7UUFDcEgsQ0FBQztRQUVELE1BQU0sY0FBYyxHQUFHLGlCQUFpQixDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNsRCxNQUFNLElBQUksR0FBRyxNQUFNLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3ZJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNYLE9BQU8sRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLGlCQUFpQixFQUFFLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsRUFBRSx1QkFBdUIsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ3JMLENBQUM7UUFDRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQzlCLE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUM5RCxJQUFJLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUNoQyxPQUFPLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxZQUFZLFNBQVMsc0JBQXNCLEVBQUUsQ0FBQyxFQUFFLGlCQUFpQixFQUFFLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSxvQ0FBb0MsRUFBRSxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDek4sQ0FBQztRQUVELE1BQU0sVUFBVSxHQUFHLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxTQUFTLGtDQUEwQixFQUFFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekgsTUFBTSxNQUFNLEdBQTZCLFVBQVUsSUFBSSxPQUFPLFVBQVUsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQTBCLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUUvSCxNQUFNLGVBQWUsR0FBRyxNQUFNLHNCQUFzQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDakksTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxvQkFBb0IsQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLENBQUM7UUFDbkYsSUFBSSxDQUFDLFNBQVMsSUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLCtDQUErQyxTQUFTLEVBQUUsRUFBRSxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxjQUFjLENBQUMsUUFBUSxDQUFDLGlCQUFpQixFQUFFLG1EQUFtRCxFQUFFLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUMvTyxDQUFDO1FBQ0QsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUNqSixJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDNUIsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsK0NBQStDLFNBQVMsRUFBRSxFQUFFLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLGNBQWMsQ0FBQyxRQUFRLENBQUMsaUJBQWlCLEVBQUUsbURBQW1ELEVBQUUsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQy9PLENBQUM7UUFFRCxNQUFNLEtBQUssR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQ3BDLE1BQU0sZUFBZSxHQUFHLE1BQU0sc0JBQXNCLENBQ25ELFNBQVMsRUFDVCxJQUFJLEVBQ0osSUFBSSxDQUFDLHFCQUFxQixFQUMxQixVQUFVLENBQUMsT0FBUSxFQUNuQixTQUFTLEVBQ1QsS0FBSyxFQUNMLEtBQUssRUFDTCxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsRUFDbEQsZUFBZSxFQUNmLElBQUksQ0FBQyxhQUFhLENBQ2xCLENBQUM7UUFDRixLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDaEIsS0FBSyxNQUFNLENBQUMsSUFBSSxlQUFlLEVBQUUsQ0FBQztZQUNqQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxFQUFFLENBQXdDLDZCQUE2QixFQUFFO2dCQUN6RyxNQUFNLEVBQUUsSUFBSSxDQUFDLEVBQUU7Z0JBQ2YsWUFBWSxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUM7Z0JBQ2xDLGNBQWMsRUFBRSxDQUFDLENBQUMsY0FBYyxJQUFJLENBQUM7Z0JBQ3JDLDBCQUEwQixFQUFFLENBQUMsQ0FBQywwQkFBMEIsSUFBSSxDQUFDO2dCQUM3RCwwQkFBMEIsRUFBRSxDQUFDLENBQUMsMEJBQTBCLElBQUksQ0FBQztnQkFDN0Qsb0JBQW9CLEVBQUUsQ0FBQyxDQUFDLG9CQUFvQixJQUFJLENBQUM7Z0JBQ2pELHlCQUF5QixFQUFFLENBQUMsQ0FBQyx5QkFBeUIsSUFBSSxDQUFDO2dCQUMzRCxnQ0FBZ0MsRUFBRSxDQUFDLENBQUMsZ0NBQWdDLElBQUksQ0FBQztnQkFDekUsMkJBQTJCLEVBQUUsQ0FBQyxDQUFDLDJCQUEyQixJQUFJLENBQUM7YUFDL0QsQ0FBQyxDQUFDO1FBQ0osQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDdEYsTUFBTSxhQUFhLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNoRSxNQUFNLGlCQUFpQixHQUFHLDZCQUE2QixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3pFLE1BQU0saUJBQWlCLEdBQUcsNkJBQTZCLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxpQkFBaUIsRUFBRSxlQUFlLENBQUMsQ0FBQztRQUUvRyxPQUFPO1lBQ04sT0FBTyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsQ0FBQztZQUNqRCxpQkFBaUI7WUFDakIsaUJBQWlCO1NBQ2pCLENBQUM7SUFDSCxDQUFDO0lBRU8sS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFVO1FBQ3JDLE1BQU0sU0FBUyxHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUMxRCxPQUFPLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDO0lBQzNELENBQUM7SUFFRCxLQUFLLENBQUMscUJBQXFCLENBQUMsT0FBMEMsRUFBRSxLQUF3QjtRQUMvRixNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsVUFBK0IsQ0FBQztRQUNyRCxNQUFNLGNBQWMsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFbEQsTUFBTSxJQUFJLEdBQUcsTUFBTSxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxjQUFjLEVBQUUsSUFBSSxDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMscUJBQXFCLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN2SSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDWCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxjQUFjLENBQUMsUUFBUSxDQUFDLG1CQUFtQixFQUFFLHVCQUF1QixFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDbkgsQ0FBQztRQUNELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDOUIsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQzlELElBQUksSUFBSSxJQUFJLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUN4QyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxjQUFjLENBQUMsUUFBUSxDQUFDLHdCQUF3QixFQUFFLDhCQUE4QixDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ3RILENBQUM7UUFFRCxJQUFJLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3BDLE9BQU87Z0JBQ04saUJBQWlCLEVBQUUsSUFBSSxjQUFjLENBQUMsUUFBUSxDQUFDLDJCQUEyQixFQUFFLDJCQUEyQixFQUFFLFNBQVMsQ0FBQyxDQUFDO2dCQUNwSCxnQkFBZ0IsRUFBRSxJQUFJLGNBQWMsQ0FBQyxRQUFRLENBQUMsNEJBQTRCLEVBQUUsNEJBQTRCLEVBQUUsU0FBUyxDQUFDLENBQUM7Z0JBQ3JILG9CQUFvQixFQUFFLFNBQVM7YUFDL0IsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPO1lBQ04saUJBQWlCLEVBQUUsSUFBSSxjQUFjLENBQUMsUUFBUSxDQUFDLGtCQUFrQixFQUFFLGVBQWUsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUMvRixnQkFBZ0IsRUFBRSxJQUFJLGNBQWMsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLENBQUMsWUFBWTtnQkFDOUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSxlQUFlLEVBQUUsU0FBUyxDQUFDO2dCQUMxRCxDQUFDLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDcEQsb0JBQW9CLEVBQUUsSUFBSTtnQkFDekIsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyx3QkFBd0IsRUFBRSxpQkFBaUIsQ0FBQyxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUMsc0JBQXNCLEVBQUUsOEJBQThCLEVBQUUsU0FBUyxDQUFDLEVBQUU7Z0JBQ3hKLENBQUMsQ0FBQyxTQUFTO1NBQ1osQ0FBQztJQUNILENBQUM7Q0FDRCxDQUFBO0FBdEhZLFdBQVc7SUFHckIsV0FBQSxZQUFZLENBQUE7SUFDWixXQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFdBQUEsZ0JBQWdCLENBQUE7SUFDaEIsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLHFCQUFxQixDQUFBO0dBUFgsV0FBVyxDQXNIdkI7O0FBRUQsTUFBTSxDQUFDLE1BQU0sZUFBZSxHQUFjO0lBQ3pDLEVBQUUsRUFBRSxVQUFVO0lBQ2QsaUJBQWlCLEVBQUUsU0FBUztJQUM1Qiw0QkFBNEIsRUFBRSxDQUFDLGtCQUFrQixDQUFDO0lBQ2xELFdBQVcsRUFBRSxRQUFRLENBQUMsK0JBQStCLEVBQUUsVUFBVSxDQUFDO0lBQ2xFLGdCQUFnQixFQUFFLCtWQUErVjtJQUNqWCxlQUFlLEVBQUUsUUFBUSxDQUFDLG1DQUFtQyxFQUFFLDRCQUE0QixDQUFDO0lBQzVGLElBQUksRUFBRSxPQUFPLENBQUMsS0FBSztJQUNuQixNQUFNLEVBQUUsY0FBYyxDQUFDLFFBQVE7SUFDL0IsSUFBSSxFQUFFLHFCQUFxQjtJQUMzQixXQUFXLEVBQUU7UUFDWixNQUFNLEVBQUUsUUFBUTtRQUNoQixZQUFZLEVBQUU7WUFDYixpQkFBaUIsRUFBRTtnQkFDbEIsTUFBTSxFQUFFLFFBQVE7Z0JBQ2hCLGFBQWEsRUFBRSwrQ0FBK0M7YUFDOUQ7WUFDRCxJQUFJLEVBQUU7Z0JBQ0wsTUFBTSxFQUFFLFFBQVE7Z0JBQ2hCLGFBQWEsRUFBRSxxQkFBcUI7YUFDcEM7U0FDRDtRQUNELFVBQVUsRUFBRTtZQUNYLGlCQUFpQjtZQUNqQixJQUFJO1NBQ0o7S0FDRDtDQUNELENBQUMifQ==