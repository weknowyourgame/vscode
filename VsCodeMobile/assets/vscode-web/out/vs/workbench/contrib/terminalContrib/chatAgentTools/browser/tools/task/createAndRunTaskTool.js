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
import { ITaskService } from '../../../../../tasks/common/taskService.js';
import { ITerminalService } from '../../../../../terminal/browser/terminal.js';
import { collectTerminalResults, resolveDependencyTasks, tasksMatch } from '../../taskHelpers.js';
import { MarkdownString } from '../../../../../../../base/common/htmlContent.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { IFileService } from '../../../../../../../platform/files/common/files.js';
import { VSBuffer } from '../../../../../../../base/common/buffer.js';
import { IConfigurationService } from '../../../../../../../platform/configuration/common/configuration.js';
import { toolResultDetailsFromResponse, toolResultMessageFromResponse } from './taskHelpers.js';
import { IInstantiationService } from '../../../../../../../platform/instantiation/common/instantiation.js';
import { DisposableStore } from '../../../../../../../base/common/lifecycle.js';
let CreateAndRunTaskTool = class CreateAndRunTaskTool {
    constructor(_tasksService, _telemetryService, _terminalService, _fileService, _configurationService, _instantiationService) {
        this._tasksService = _tasksService;
        this._telemetryService = _telemetryService;
        this._terminalService = _terminalService;
        this._fileService = _fileService;
        this._configurationService = _configurationService;
        this._instantiationService = _instantiationService;
    }
    async invoke(invocation, _countTokens, _progress, token) {
        const args = invocation.parameters;
        if (!invocation.context) {
            return { content: [{ kind: 'text', value: `No invocation context` }], toolResultMessage: `No invocation context` };
        }
        const tasksJsonUri = URI.file(args.workspaceFolder).with({ path: `${args.workspaceFolder}/.vscode/tasks.json` });
        const exists = await this._fileService.exists(tasksJsonUri);
        const newTask = {
            label: args.task.label,
            type: args.task.type,
            command: args.task.command,
            args: args.task.args,
            isBackground: args.task.isBackground,
            problemMatcher: args.task.problemMatcher,
            group: args.task.group
        };
        const tasksJsonContent = JSON.stringify({
            version: '2.0.0',
            tasks: [newTask]
        }, null, '\t');
        if (!exists) {
            await this._fileService.createFile(tasksJsonUri, VSBuffer.fromString(tasksJsonContent), { overwrite: true });
            _progress.report({ message: 'Created tasks.json file' });
        }
        else {
            // add to the existing tasks.json file
            const content = await this._fileService.readFile(tasksJsonUri);
            const tasksJson = JSON.parse(content.value.toString());
            tasksJson.tasks.push(newTask);
            await this._fileService.writeFile(tasksJsonUri, VSBuffer.fromString(JSON.stringify(tasksJson, null, '\t')));
            _progress.report({ message: 'Updated tasks.json file' });
        }
        _progress.report({ message: new MarkdownString(localize('copilotChat.fetchingTask', 'Resolving the task')) });
        let task;
        const start = Date.now();
        while (Date.now() - start < 5000 && !token.isCancellationRequested) {
            task = (await this._tasksService.tasks())?.find(t => t._label === args.task.label);
            if (task) {
                break;
            }
            await timeout(100);
        }
        if (!task) {
            return { content: [{ kind: 'text', value: `Task not found: ${args.task.label}` }], toolResultMessage: new MarkdownString(localize('copilotChat.taskNotFound', 'Task not found: `{0}`', args.task.label)) };
        }
        _progress.report({ message: new MarkdownString(localize('copilotChat.runningTask', 'Running task `{0}`', args.task.label)) });
        const raceResult = await Promise.race([this._tasksService.run(task, undefined, 5 /* TaskRunSource.ChatAgent */), timeout(3000)]);
        const result = raceResult && typeof raceResult === 'object' ? raceResult : undefined;
        const dependencyTasks = await resolveDependencyTasks(task, args.workspaceFolder, this._configurationService, this._tasksService);
        const resources = this._tasksService.getTerminalsForTasks(dependencyTasks ?? task);
        const terminals = resources?.map(resource => this._terminalService.instances.find(t => t.resource.path === resource?.path && t.resource.scheme === resource.scheme)).filter(Boolean);
        if (!terminals || terminals.length === 0) {
            return { content: [{ kind: 'text', value: `Task started but no terminal was found for: ${args.task.label}` }], toolResultMessage: new MarkdownString(localize('copilotChat.noTerminal', 'Task started but no terminal was found for: `{0}`', args.task.label)) };
        }
        const store = new DisposableStore();
        const terminalResults = await collectTerminalResults(terminals, task, this._instantiationService, invocation.context, _progress, token, store, (terminalTask) => this._isTaskActive(terminalTask), dependencyTasks, this._tasksService);
        store.dispose();
        for (const r of terminalResults) {
            this._telemetryService.publicLog2?.('copilotChat.runTaskTool.createAndRunTask', {
                taskId: args.task.label,
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
        const toolResultMessage = toolResultMessageFromResponse(result, args.task.label, toolResultDetails, terminalResults);
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
        const task = args.task;
        const allTasks = await this._tasksService.tasks();
        if (allTasks?.find(t => t._label === task.label)) {
            return {
                invocationMessage: new MarkdownString(localize('taskExists', 'Task `{0}` already exists.', task.label)),
                pastTenseMessage: new MarkdownString(localize('taskExistsPast', 'Task `{0}` already exists.', task.label)),
                confirmationMessages: undefined
            };
        }
        const activeTasks = await this._tasksService.getActiveTasks();
        if (activeTasks.find(t => t._label === task.label)) {
            return {
                invocationMessage: new MarkdownString(localize('alreadyRunning', 'Task \`{0}\` is already running.', task.label)),
                pastTenseMessage: new MarkdownString(localize('alreadyRunning', 'Task \`{0}\` is already running.', task.label)),
                confirmationMessages: undefined
            };
        }
        return {
            invocationMessage: new MarkdownString(localize('createdTask', 'Created task \`{0}\`', task.label)),
            pastTenseMessage: new MarkdownString(localize('createdTaskPast', 'Created task \`{0}\`', task.label)),
            confirmationMessages: {
                title: localize('allowTaskCreationExecution', 'Allow task creation and execution?'),
                message: new MarkdownString(localize('createTask', 'A task \`{0}\` with command \`{1}\`{2} will be created.', task.label, task.command, task.args?.length ? ` and args \`${task.args.join(' ')}\`` : ''))
            }
        };
    }
};
CreateAndRunTaskTool = __decorate([
    __param(0, ITaskService),
    __param(1, ITelemetryService),
    __param(2, ITerminalService),
    __param(3, IFileService),
    __param(4, IConfigurationService),
    __param(5, IInstantiationService)
], CreateAndRunTaskTool);
export { CreateAndRunTaskTool };
export const CreateAndRunTaskToolData = {
    id: 'create_and_run_task',
    toolReferenceName: 'createAndRunTask',
    legacyToolReferenceFullNames: ['runTasks/createAndRunTask'],
    displayName: localize('createAndRunTask.displayName', 'Create and run Task'),
    modelDescription: 'Creates and runs a build, run, or custom task for the workspace by generating or adding to a tasks.json file based on the project structure (such as package.json or README.md). If the user asks to build, run, launch and they have no tasks.json file, use this tool. If they ask to create or add a task, use this tool.',
    userDescription: localize('createAndRunTask.userDescription', "Create and run a task in the workspace"),
    source: ToolDataSource.Internal,
    inputSchema: {
        'type': 'object',
        'properties': {
            'workspaceFolder': {
                'type': 'string',
                'description': 'The absolute path of the workspace folder where the tasks.json file will be created.'
            },
            'task': {
                'type': 'object',
                'description': 'The task to add to the new tasks.json file.',
                'properties': {
                    'label': {
                        'type': 'string',
                        'description': 'The label of the task.'
                    },
                    'type': {
                        'type': 'string',
                        'description': `The type of the task. The only supported value is 'shell'.`,
                        'enum': [
                            'shell'
                        ]
                    },
                    'command': {
                        'type': 'string',
                        'description': 'The shell command to run for the task. Use this to specify commands for building or running the application.'
                    },
                    'args': {
                        'type': 'array',
                        'description': 'The arguments to pass to the command.',
                        'items': {
                            'type': 'string'
                        }
                    },
                    'isBackground': {
                        'type': 'boolean',
                        'description': 'Whether the task runs in the background without blocking the UI or other tasks. Set to true for long-running processes like watch tasks or servers that should continue executing without requiring user attention. When false, the task will block the terminal until completion.'
                    },
                    'problemMatcher': {
                        'type': 'array',
                        'description': `The problem matcher to use to parse task output for errors and warnings. Can be a predefined matcher like '$tsc' (TypeScript), '$eslint - stylish', '$gcc', etc., or a custom pattern defined in tasks.json. This helps VS Code display errors in the Problems panel and enables quick navigation to error locations.`,
                        'items': {
                            'type': 'string'
                        }
                    },
                    'group': {
                        'type': 'string',
                        'description': 'The group to which the task belongs.'
                    }
                },
                'required': [
                    'label',
                    'type',
                    'command'
                ]
            }
        },
        'required': [
            'task',
            'workspaceFolder'
        ]
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlQW5kUnVuVGFza1Rvb2wuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL2Jyb3dzZXIvdG9vbHMvdGFzay9jcmVhdGVBbmRSdW5UYXNrVG9vbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFFcEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ2hHLE9BQU8sRUFBdUksY0FBYyxFQUFnQixNQUFNLHlEQUF5RCxDQUFDO0FBQzVPLE9BQU8sRUFBRSxZQUFZLEVBQXNCLE1BQU0sNENBQTRDLENBQUM7QUFFOUYsT0FBTyxFQUFxQixnQkFBZ0IsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxzQkFBc0IsRUFBbUIsc0JBQXNCLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDbkgsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDbkYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHFFQUFxRSxDQUFDO0FBQzVHLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSw2QkFBNkIsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ2hHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHFFQUFxRSxDQUFDO0FBQzVHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQWdCekUsSUFBTSxvQkFBb0IsR0FBMUIsTUFBTSxvQkFBb0I7SUFFaEMsWUFDZ0MsYUFBMkIsRUFDdEIsaUJBQW9DLEVBQ3JDLGdCQUFrQyxFQUN0QyxZQUEwQixFQUNqQixxQkFBNEMsRUFDNUMscUJBQTRDO1FBTHJELGtCQUFhLEdBQWIsYUFBYSxDQUFjO1FBQ3RCLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBbUI7UUFDckMscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFrQjtRQUN0QyxpQkFBWSxHQUFaLFlBQVksQ0FBYztRQUNqQiwwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO1FBQzVDLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBdUI7SUFDakYsQ0FBQztJQUVMLEtBQUssQ0FBQyxNQUFNLENBQUMsVUFBMkIsRUFBRSxZQUFpQyxFQUFFLFNBQXVCLEVBQUUsS0FBd0I7UUFDN0gsTUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFDLFVBQXdDLENBQUM7UUFFakUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN6QixPQUFPLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSx1QkFBdUIsRUFBRSxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsdUJBQXVCLEVBQUUsQ0FBQztRQUNwSCxDQUFDO1FBRUQsTUFBTSxZQUFZLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLGVBQWUscUJBQXFCLEVBQUUsQ0FBQyxDQUFDO1FBQ2pILE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFNUQsTUFBTSxPQUFPLEdBQW9CO1lBQ2hDLEtBQUssRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUs7WUFDdEIsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSTtZQUNwQixPQUFPLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPO1lBQzFCLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUk7WUFDcEIsWUFBWSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWTtZQUNwQyxjQUFjLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjO1lBQ3hDLEtBQUssRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUs7U0FDdEIsQ0FBQztRQUVGLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUN2QyxPQUFPLEVBQUUsT0FBTztZQUNoQixLQUFLLEVBQUUsQ0FBQyxPQUFPLENBQUM7U0FDaEIsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDYixNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLFlBQVksRUFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUM3RyxTQUFTLENBQUMsTUFBTSxDQUFDLEVBQUUsT0FBTyxFQUFFLHlCQUF5QixFQUFFLENBQUMsQ0FBQztRQUMxRCxDQUFDO2FBQU0sQ0FBQztZQUNQLHNDQUFzQztZQUN0QyxNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQy9ELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZELFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzlCLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1RyxTQUFTLENBQUMsTUFBTSxDQUFDLEVBQUUsT0FBTyxFQUFFLHlCQUF5QixFQUFFLENBQUMsQ0FBQztRQUMxRCxDQUFDO1FBQ0QsU0FBUyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLGNBQWMsQ0FBQyxRQUFRLENBQUMsMEJBQTBCLEVBQUUsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUU5RyxJQUFJLElBQXNCLENBQUM7UUFDM0IsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ3pCLE9BQU8sSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztZQUNwRSxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbkYsSUFBSSxJQUFJLEVBQUUsQ0FBQztnQkFDVixNQUFNO1lBQ1AsQ0FBQztZQUNELE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLENBQUM7UUFDRCxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDWCxPQUFPLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxtQkFBbUIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxjQUFjLENBQUMsUUFBUSxDQUFDLDBCQUEwQixFQUFFLHVCQUF1QixFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQzVNLENBQUM7UUFFRCxTQUFTLENBQUMsTUFBTSxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSxvQkFBb0IsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzlILE1BQU0sVUFBVSxHQUFHLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxTQUFTLGtDQUEwQixFQUFFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekgsTUFBTSxNQUFNLEdBQTZCLFVBQVUsSUFBSSxPQUFPLFVBQVUsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQTBCLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUUvSCxNQUFNLGVBQWUsR0FBRyxNQUFNLHNCQUFzQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDakksTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxvQkFBb0IsQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLENBQUM7UUFDbkYsTUFBTSxTQUFTLEdBQUcsU0FBUyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFLElBQUksSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sS0FBSyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUF3QixDQUFDO1FBQzVNLElBQUksQ0FBQyxTQUFTLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUMxQyxPQUFPLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSwrQ0FBK0MsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxjQUFjLENBQUMsUUFBUSxDQUFDLHdCQUF3QixFQUFFLG1EQUFtRCxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ2xRLENBQUM7UUFDRCxNQUFNLEtBQUssR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQ3BDLE1BQU0sZUFBZSxHQUFHLE1BQU0sc0JBQXNCLENBQ25ELFNBQVMsRUFDVCxJQUFJLEVBQ0osSUFBSSxDQUFDLHFCQUFxQixFQUMxQixVQUFVLENBQUMsT0FBUSxFQUNuQixTQUFTLEVBQ1QsS0FBSyxFQUNMLEtBQUssRUFDTCxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsRUFDbEQsZUFBZSxFQUNmLElBQUksQ0FBQyxhQUFhLENBQ2xCLENBQUM7UUFDRixLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDaEIsS0FBSyxNQUFNLENBQUMsSUFBSSxlQUFlLEVBQUUsQ0FBQztZQUNqQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxFQUFFLENBQXdDLDBDQUEwQyxFQUFFO2dCQUN0SCxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLO2dCQUN2QixZQUFZLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQztnQkFDbEMsY0FBYyxFQUFFLENBQUMsQ0FBQyxjQUFjLElBQUksQ0FBQztnQkFDckMsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDLDBCQUEwQixJQUFJLENBQUM7Z0JBQzdELDBCQUEwQixFQUFFLENBQUMsQ0FBQywwQkFBMEIsSUFBSSxDQUFDO2dCQUM3RCxvQkFBb0IsRUFBRSxDQUFDLENBQUMsb0JBQW9CLElBQUksQ0FBQztnQkFDakQseUJBQXlCLEVBQUUsQ0FBQyxDQUFDLHlCQUF5QixJQUFJLENBQUM7Z0JBQzNELDJCQUEyQixFQUFFLENBQUMsQ0FBQywyQkFBMkIsSUFBSSxDQUFDO2dCQUMvRCxnQ0FBZ0MsRUFBRSxDQUFDLENBQUMsZ0NBQWdDLElBQUksQ0FBQzthQUN6RSxDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsTUFBTSxPQUFPLEdBQUcsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksY0FBYyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUN0RixNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2hFLE1BQU0saUJBQWlCLEdBQUcsNkJBQTZCLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDekUsTUFBTSxpQkFBaUIsR0FBRyw2QkFBNkIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsaUJBQWlCLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDckgsT0FBTztZQUNOLE9BQU8sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsYUFBYSxFQUFFLENBQUM7WUFDakQsaUJBQWlCO1lBQ2pCLGlCQUFpQjtTQUNqQixDQUFDO0lBQ0gsQ0FBQztJQUVPLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBVTtRQUNyQyxNQUFNLFNBQVMsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDMUQsT0FBTyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQztJQUMzRCxDQUFDO0lBRUQsS0FBSyxDQUFDLHFCQUFxQixDQUFDLE9BQTBDLEVBQUUsS0FBd0I7UUFDL0YsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLFVBQXdDLENBQUM7UUFDOUQsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUV2QixNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDbEQsSUFBSSxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNsRCxPQUFPO2dCQUNOLGlCQUFpQixFQUFFLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyxZQUFZLEVBQUUsNEJBQTRCLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUN2RyxnQkFBZ0IsRUFBRSxJQUFJLGNBQWMsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsNEJBQTRCLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUMxRyxvQkFBb0IsRUFBRSxTQUFTO2FBQy9CLENBQUM7UUFDSCxDQUFDO1FBRUQsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQzlELElBQUksV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDcEQsT0FBTztnQkFDTixpQkFBaUIsRUFBRSxJQUFJLGNBQWMsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsa0NBQWtDLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNqSCxnQkFBZ0IsRUFBRSxJQUFJLGNBQWMsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsa0NBQWtDLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNoSCxvQkFBb0IsRUFBRSxTQUFTO2FBQy9CLENBQUM7UUFDSCxDQUFDO1FBRUQsT0FBTztZQUNOLGlCQUFpQixFQUFFLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2xHLGdCQUFnQixFQUFFLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRSxzQkFBc0IsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDckcsb0JBQW9CLEVBQUU7Z0JBQ3JCLEtBQUssRUFBRSxRQUFRLENBQUMsNEJBQTRCLEVBQUUsb0NBQW9DLENBQUM7Z0JBQ25GLE9BQU8sRUFBRSxJQUFJLGNBQWMsQ0FDMUIsUUFBUSxDQUNQLFlBQVksRUFDWix5REFBeUQsRUFDekQsSUFBSSxDQUFDLEtBQUssRUFDVixJQUFJLENBQUMsT0FBTyxFQUNaLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxlQUFlLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FDL0QsQ0FDRDthQUNEO1NBQ0QsQ0FBQztJQUNILENBQUM7Q0FDRCxDQUFBO0FBMUpZLG9CQUFvQjtJQUc5QixXQUFBLFlBQVksQ0FBQTtJQUNaLFdBQUEsaUJBQWlCLENBQUE7SUFDakIsV0FBQSxnQkFBZ0IsQ0FBQTtJQUNoQixXQUFBLFlBQVksQ0FBQTtJQUNaLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxxQkFBcUIsQ0FBQTtHQVJYLG9CQUFvQixDQTBKaEM7O0FBRUQsTUFBTSxDQUFDLE1BQU0sd0JBQXdCLEdBQWM7SUFDbEQsRUFBRSxFQUFFLHFCQUFxQjtJQUN6QixpQkFBaUIsRUFBRSxrQkFBa0I7SUFDckMsNEJBQTRCLEVBQUUsQ0FBQywyQkFBMkIsQ0FBQztJQUMzRCxXQUFXLEVBQUUsUUFBUSxDQUFDLDhCQUE4QixFQUFFLHFCQUFxQixDQUFDO0lBQzVFLGdCQUFnQixFQUFFLDhUQUE4VDtJQUNoVixlQUFlLEVBQUUsUUFBUSxDQUFDLGtDQUFrQyxFQUFFLHdDQUF3QyxDQUFDO0lBQ3ZHLE1BQU0sRUFBRSxjQUFjLENBQUMsUUFBUTtJQUMvQixXQUFXLEVBQUU7UUFDWixNQUFNLEVBQUUsUUFBUTtRQUNoQixZQUFZLEVBQUU7WUFDYixpQkFBaUIsRUFBRTtnQkFDbEIsTUFBTSxFQUFFLFFBQVE7Z0JBQ2hCLGFBQWEsRUFBRSxzRkFBc0Y7YUFDckc7WUFDRCxNQUFNLEVBQUU7Z0JBQ1AsTUFBTSxFQUFFLFFBQVE7Z0JBQ2hCLGFBQWEsRUFBRSw2Q0FBNkM7Z0JBQzVELFlBQVksRUFBRTtvQkFDYixPQUFPLEVBQUU7d0JBQ1IsTUFBTSxFQUFFLFFBQVE7d0JBQ2hCLGFBQWEsRUFBRSx3QkFBd0I7cUJBQ3ZDO29CQUNELE1BQU0sRUFBRTt3QkFDUCxNQUFNLEVBQUUsUUFBUTt3QkFDaEIsYUFBYSxFQUFFLDREQUE0RDt3QkFDM0UsTUFBTSxFQUFFOzRCQUNQLE9BQU87eUJBQ1A7cUJBQ0Q7b0JBQ0QsU0FBUyxFQUFFO3dCQUNWLE1BQU0sRUFBRSxRQUFRO3dCQUNoQixhQUFhLEVBQUUsOEdBQThHO3FCQUM3SDtvQkFDRCxNQUFNLEVBQUU7d0JBQ1AsTUFBTSxFQUFFLE9BQU87d0JBQ2YsYUFBYSxFQUFFLHVDQUF1Qzt3QkFDdEQsT0FBTyxFQUFFOzRCQUNSLE1BQU0sRUFBRSxRQUFRO3lCQUNoQjtxQkFDRDtvQkFDRCxjQUFjLEVBQUU7d0JBQ2YsTUFBTSxFQUFFLFNBQVM7d0JBQ2pCLGFBQWEsRUFBRSxvUkFBb1I7cUJBQ25TO29CQUNELGdCQUFnQixFQUFFO3dCQUNqQixNQUFNLEVBQUUsT0FBTzt3QkFDZixhQUFhLEVBQUUsdVRBQXVUO3dCQUN0VSxPQUFPLEVBQUU7NEJBQ1IsTUFBTSxFQUFFLFFBQVE7eUJBQ2hCO3FCQUNEO29CQUNELE9BQU8sRUFBRTt3QkFDUixNQUFNLEVBQUUsUUFBUTt3QkFDaEIsYUFBYSxFQUFFLHNDQUFzQztxQkFDckQ7aUJBQ0Q7Z0JBQ0QsVUFBVSxFQUFFO29CQUNYLE9BQU87b0JBQ1AsTUFBTTtvQkFDTixTQUFTO2lCQUNUO2FBQ0Q7U0FDRDtRQUNELFVBQVUsRUFBRTtZQUNYLE1BQU07WUFDTixpQkFBaUI7U0FDakI7S0FDRDtDQUNELENBQUMifQ==