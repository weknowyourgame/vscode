/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { timeout } from '../../../../../base/common/async.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { URI } from '../../../../../base/common/uri.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { getOutput } from './outputHelpers.js';
import { OutputMonitor } from './tools/monitoring/outputMonitor.js';
import { OutputMonitorState } from './tools/monitoring/types.js';
import { Event } from '../../../../../base/common/event.js';
import { isString } from '../../../../../base/common/types.js';
export function getTaskDefinition(id) {
    const idx = id.indexOf(': ');
    const taskType = id.substring(0, idx);
    let taskLabel = idx > 0 ? id.substring(idx + 2) : id;
    if (/^\d+$/.test(taskLabel)) {
        taskLabel = id;
    }
    return { taskLabel, taskType };
}
export function getTaskRepresentation(task) {
    if ('label' in task && task.label) {
        return task.label;
    }
    else if ('script' in task && task.script) {
        return task.script;
    }
    else if ('command' in task && task.command) {
        return isString(task.command) ? task.command : task.command.name?.toString() || '';
    }
    return '';
}
export function getTaskKey(task) {
    return task.getKey() ?? task.getMapKey();
}
export function tasksMatch(a, b) {
    if (!a || !b) {
        return false;
    }
    if (getTaskKey(a) === getTaskKey(b)) {
        return true;
    }
    if (a.getCommonTaskId?.() === b.getCommonTaskId?.()) {
        return true;
    }
    return a._id === b._id;
}
export async function getTaskForTool(id, taskDefinition, workspaceFolder, configurationService, taskService, allowParentTask) {
    let index = 0;
    let task;
    const workspaceFolderToTaskMap = await taskService.getWorkspaceTasks();
    let configTasks = [];
    for (const folder of workspaceFolderToTaskMap.keys()) {
        const tasksConfig = configurationService.getValue('tasks', { resource: URI.parse(folder) });
        if (tasksConfig?.tasks) {
            configTasks = configTasks.concat(tasksConfig.tasks);
        }
    }
    for (const configTask of configTasks) {
        if ((!allowParentTask && !configTask.type) || ('hide' in configTask && configTask.hide)) {
            // Skip these as they are not included in the agent prompt and we need to align with
            // the indices used there.
            continue;
        }
        if ((configTask.type && taskDefinition.taskType ? configTask.type === taskDefinition.taskType : true) &&
            ((getTaskRepresentation(configTask) === taskDefinition?.taskLabel) || (id === configTask.label))) {
            task = configTask;
            break;
        }
        else if (!configTask.label && id === `${configTask.type}: ${index}`) {
            task = configTask;
            break;
        }
        index++;
    }
    if (!task) {
        return;
    }
    let tasksForWorkspace;
    const workspaceFolderPath = URI.file(workspaceFolder).path;
    for (const [folder, tasks] of workspaceFolderToTaskMap) {
        if (URI.parse(folder).path === workspaceFolderPath) {
            tasksForWorkspace = tasks;
            break;
        }
    }
    if (!tasksForWorkspace) {
        return;
    }
    const configuringTasks = tasksForWorkspace.configurations?.byIdentifier;
    const configuredTask = Object.values(configuringTasks ?? {}).find(t => {
        return t.type === task.type && (t._label === task.label || t._label === `${task.type}: ${getTaskRepresentation(task)}` || t._label === getTaskRepresentation(task));
    });
    let resolvedTask;
    if (configuredTask) {
        resolvedTask = await taskService.tryResolveTask(configuredTask);
    }
    if (!resolvedTask) {
        const customTasks = tasksForWorkspace.set?.tasks;
        resolvedTask = customTasks?.find(t => task.label === t._label || task.label === t._label);
    }
    return resolvedTask;
}
export async function resolveDependencyTasks(parentTask, workspaceFolder, configurationService, taskService) {
    if (!parentTask.configurationProperties?.dependsOn) {
        return undefined;
    }
    const dependencyTasks = await Promise.all(parentTask.configurationProperties.dependsOn.map(async (dep) => {
        const depId = isString(dep.task) ? dep.task : dep.task?._key;
        if (!depId) {
            return undefined;
        }
        return await getTaskForTool(depId, { taskLabel: depId }, workspaceFolder, configurationService, taskService);
    }));
    return dependencyTasks.filter((t) => t !== undefined);
}
/**
 * Collects output, polling duration, and idle status for all terminals.
 */
export async function collectTerminalResults(terminals, task, instantiationService, invocationContext, progress, token, disposableStore, isActive, dependencyTasks, taskService) {
    const results = [];
    if (token.isCancellationRequested) {
        return results;
    }
    const commonTaskIdToTaskMap = {};
    const taskIdToTaskMap = {};
    const taskLabelToTaskMap = {};
    for (const dependencyTask of dependencyTasks ?? []) {
        commonTaskIdToTaskMap[dependencyTask.getCommonTaskId()] = dependencyTask;
        taskIdToTaskMap[dependencyTask._id] = dependencyTask;
        taskLabelToTaskMap[dependencyTask._label] = dependencyTask;
    }
    for (const instance of terminals) {
        progress.report({ message: new MarkdownString(`Checking output for \`${instance.shellLaunchConfig.name ?? 'unknown'}\``) });
        let terminalTask = task;
        // For composite tasks, find the actual dependency task running in this terminal
        if (dependencyTasks?.length) {
            // Use reconnection data if possible to match, since the properties here are unique
            const reconnectionData = instance.reconnectionProperties?.data;
            if (reconnectionData) {
                if (reconnectionData.lastTask in commonTaskIdToTaskMap) {
                    terminalTask = commonTaskIdToTaskMap[reconnectionData.lastTask];
                }
                else if (reconnectionData.id in taskIdToTaskMap) {
                    terminalTask = taskIdToTaskMap[reconnectionData.id];
                }
            }
            else {
                // Otherwise, fallback to label matching
                if (instance.shellLaunchConfig.name && instance.shellLaunchConfig.name in taskLabelToTaskMap) {
                    terminalTask = taskLabelToTaskMap[instance.shellLaunchConfig.name];
                }
                else if (instance.title in taskLabelToTaskMap) {
                    terminalTask = taskLabelToTaskMap[instance.title];
                }
            }
        }
        const execution = {
            getOutput: () => getOutput(instance) ?? '',
            task: terminalTask,
            isActive: isActive ? () => isActive(terminalTask) : undefined,
            instance,
            dependencyTasks,
            sessionId: invocationContext.sessionId
        };
        // For tasks with problem matchers, wait until the task becomes busy before creating the output monitor
        if (terminalTask.configurationProperties.problemMatchers && terminalTask.configurationProperties.problemMatchers.length > 0 && taskService) {
            const maxWaitTime = 1000; // Wait up to 1 second
            const startTime = Date.now();
            while (!token.isCancellationRequested && Date.now() - startTime < maxWaitTime) {
                const busyTasks = await taskService.getBusyTasks();
                if (busyTasks.some(t => tasksMatch(t, terminalTask))) {
                    break;
                }
                await timeout(100);
            }
        }
        const outputMonitor = disposableStore.add(instantiationService.createInstance(OutputMonitor, execution, taskProblemPollFn, invocationContext, token, task._label));
        await Event.toPromise(outputMonitor.onDidFinishCommand);
        const pollingResult = outputMonitor.pollingResult;
        results.push({
            name: instance.shellLaunchConfig.name ?? instance.title ?? 'unknown',
            output: pollingResult?.output ?? '',
            pollDurationMs: pollingResult?.pollDurationMs ?? 0,
            resources: pollingResult?.resources,
            state: pollingResult?.state || OutputMonitorState.Idle,
            inputToolManualAcceptCount: outputMonitor.outputMonitorTelemetryCounters.inputToolManualAcceptCount ?? 0,
            inputToolManualRejectCount: outputMonitor.outputMonitorTelemetryCounters.inputToolManualRejectCount ?? 0,
            inputToolManualChars: outputMonitor.outputMonitorTelemetryCounters.inputToolManualChars ?? 0,
            inputToolAutoAcceptCount: outputMonitor.outputMonitorTelemetryCounters.inputToolAutoAcceptCount ?? 0,
            inputToolAutoChars: outputMonitor.outputMonitorTelemetryCounters.inputToolAutoChars ?? 0,
            inputToolManualShownCount: outputMonitor.outputMonitorTelemetryCounters.inputToolManualShownCount ?? 0,
            inputToolFreeFormInputShownCount: outputMonitor.outputMonitorTelemetryCounters.inputToolFreeFormInputShownCount ?? 0,
            inputToolFreeFormInputCount: outputMonitor.outputMonitorTelemetryCounters.inputToolFreeFormInputCount ?? 0,
        });
    }
    return results;
}
export async function taskProblemPollFn(execution, token, taskService) {
    if (token.isCancellationRequested) {
        return;
    }
    if (execution.task) {
        const data = taskService.getTaskProblems(execution.instance.instanceId);
        if (data) {
            // Problem matchers exist for this task
            const problemList = [];
            const resultResources = [];
            for (const [owner, { resources, markers }] of data.entries()) {
                for (let i = 0; i < markers.length; i++) {
                    const uri = resources[i];
                    const marker = markers[i];
                    resultResources.push({
                        uri,
                        range: marker.startLineNumber !== undefined && marker.startColumn !== undefined && marker.endLineNumber !== undefined && marker.endColumn !== undefined
                            ? new Range(marker.startLineNumber, marker.startColumn, marker.endLineNumber, marker.endColumn)
                            : undefined
                    });
                    const message = marker.message ?? '';
                    problemList.push(`Problem: ${message} in ${uri.fsPath} coming from ${owner} starting on line ${marker.startLineNumber}${marker.startColumn ? `, column ${marker.startColumn} and ending on line ${marker.endLineNumber}${marker.endColumn ? `, column ${marker.endColumn}` : ''}` : ''}`);
                }
            }
            if (problemList.length === 0) {
                const lastTenLines = execution.getOutput().split('\n').filter(line => line !== '').slice(-10).join('\n');
                return {
                    state: OutputMonitorState.Idle,
                    output: `Task completed with output:\n${lastTenLines}`,
                };
            }
            return {
                state: OutputMonitorState.Idle,
                output: problemList.join('\n'),
                resources: resultResources,
            };
        }
    }
    throw new Error('Polling failed');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFza0hlbHBlcnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL2Jyb3dzZXIvdGFza0hlbHBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRzlELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUUzRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBUW5FLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUMvQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDcEUsT0FBTyxFQUE4QixrQkFBa0IsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQzdGLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUU1RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFHL0QsTUFBTSxVQUFVLGlCQUFpQixDQUFDLEVBQVU7SUFDM0MsTUFBTSxHQUFHLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM3QixNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUN0QyxJQUFJLFNBQVMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0lBRXJELElBQUksT0FBTyxDQUFDLElBQUksQ0FB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