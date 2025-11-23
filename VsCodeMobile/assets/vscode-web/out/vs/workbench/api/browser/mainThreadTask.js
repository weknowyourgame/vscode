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
import * as nls from '../../../nls.js';
import { URI } from '../../../base/common/uri.js';
import { generateUuid } from '../../../base/common/uuid.js';
import * as Types from '../../../base/common/types.js';
import * as Platform from '../../../base/common/platform.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { IWorkspaceContextService } from '../../../platform/workspace/common/workspace.js';
import { ContributedTask, ConfiguringTask, CommandOptions, RuntimeType, CustomTask, TaskSourceKind, TaskDefinition, PresentationOptions, RunOptions } from '../../contrib/tasks/common/tasks.js';
import { ITaskService } from '../../contrib/tasks/common/taskService.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { TaskEventKind } from '../common/shared/tasks.js';
import { IConfigurationResolverService } from '../../services/configurationResolver/common/configurationResolver.js';
import { ErrorNoTelemetry } from '../../../base/common/errors.js';
import { ConfigurationResolverExpression } from '../../services/configurationResolver/common/configurationResolverExpression.js';
var TaskExecutionDTO;
(function (TaskExecutionDTO) {
    function from(value) {
        return {
            id: value.id,
            task: TaskDTO.from(value.task)
        };
    }
    TaskExecutionDTO.from = from;
})(TaskExecutionDTO || (TaskExecutionDTO = {}));
export var TaskProblemMatcherStartedDto;
(function (TaskProblemMatcherStartedDto) {
    function from(value) {
        return {
            execution: {
                id: value.execution.id,
                task: TaskDTO.from(value.execution.task)
            },
        };
    }
    TaskProblemMatcherStartedDto.from = from;
})(TaskProblemMatcherStartedDto || (TaskProblemMatcherStartedDto = {}));
export var TaskProblemMatcherEndedDto;
(function (TaskProblemMatcherEndedDto) {
    function from(value) {
        return {
            execution: {
                id: value.execution.id,
                task: TaskDTO.from(value.execution.task)
            },
            hasErrors: value.hasErrors
        };
    }
    TaskProblemMatcherEndedDto.from = from;
})(TaskProblemMatcherEndedDto || (TaskProblemMatcherEndedDto = {}));
var TaskProcessStartedDTO;
(function (TaskProcessStartedDTO) {
    function from(value, processId) {
        return {
            id: value.id,
            processId
        };
    }
    TaskProcessStartedDTO.from = from;
})(TaskProcessStartedDTO || (TaskProcessStartedDTO = {}));
var TaskProcessEndedDTO;
(function (TaskProcessEndedDTO) {
    function from(value, exitCode) {
        return {
            id: value.id,
            exitCode
        };
    }
    TaskProcessEndedDTO.from = from;
})(TaskProcessEndedDTO || (TaskProcessEndedDTO = {}));
var TaskDefinitionDTO;
(function (TaskDefinitionDTO) {
    function from(value) {
        const result = Object.assign(Object.create(null), value);
        delete result._key;
        return result;
    }
    TaskDefinitionDTO.from = from;
    function to(value, executeOnly) {
        let result = TaskDefinition.createTaskIdentifier(value, console);
        if (result === undefined && executeOnly) {
            result = {
                _key: generateUuid(),
                type: '$executeOnly'
            };
        }
        return result;
    }
    TaskDefinitionDTO.to = to;
})(TaskDefinitionDTO || (TaskDefinitionDTO = {}));
var TaskPresentationOptionsDTO;
(function (TaskPresentationOptionsDTO) {
    function from(value) {
        if (value === undefined || value === null) {
            return undefined;
        }
        return Object.assign(Object.create(null), value);
    }
    TaskPresentationOptionsDTO.from = from;
    function to(value) {
        if (value === undefined || value === null) {
            return PresentationOptions.defaults;
        }
        return Object.assign(Object.create(null), PresentationOptions.defaults, value);
    }
    TaskPresentationOptionsDTO.to = to;
})(TaskPresentationOptionsDTO || (TaskPresentationOptionsDTO = {}));
var RunOptionsDTO;
(function (RunOptionsDTO) {
    function from(value) {
        if (value === undefined || value === null) {
            return undefined;
        }
        return Object.assign(Object.create(null), value);
    }
    RunOptionsDTO.from = from;
    function to(value) {
        if (value === undefined || value === null) {
            return RunOptions.defaults;
        }
        return Object.assign(Object.create(null), RunOptions.defaults, value);
    }
    RunOptionsDTO.to = to;
})(RunOptionsDTO || (RunOptionsDTO = {}));
var ProcessExecutionOptionsDTO;
(function (ProcessExecutionOptionsDTO) {
    function from(value) {
        if (value === undefined || value === null) {
            return undefined;
        }
        return {
            cwd: value.cwd,
            env: value.env
        };
    }
    ProcessExecutionOptionsDTO.from = from;
    function to(value) {
        if (value === undefined || value === null) {
            return CommandOptions.defaults;
        }
        return {
            cwd: value.cwd || CommandOptions.defaults.cwd,
            env: value.env
        };
    }
    ProcessExecutionOptionsDTO.to = to;
})(ProcessExecutionOptionsDTO || (ProcessExecutionOptionsDTO = {}));
var ProcessExecutionDTO;
(function (ProcessExecutionDTO) {
    function is(value) {
        const candidate = value;
        return candidate && !!candidate.process;
    }
    ProcessExecutionDTO.is = is;
    function from(value) {
        const process = Types.isString(value.name) ? value.name : value.name.value;
        const args = value.args ? value.args.map(value => Types.isString(value) ? value : value.value) : [];
        const result = {
            process: process,
            args: args
        };
        if (value.options) {
            result.options = ProcessExecutionOptionsDTO.from(value.options);
        }
        return result;
    }
    ProcessExecutionDTO.from = from;
    function to(value) {
        const result = {
            runtime: RuntimeType.Process,
            name: value.process,
            args: value.args,
            presentation: undefined
        };
        result.options = ProcessExecutionOptionsDTO.to(value.options);
        return result;
    }
    ProcessExecutionDTO.to = to;
})(ProcessExecutionDTO || (ProcessExecutionDTO = {}));
var ShellExecutionOptionsDTO;
(function (ShellExecutionOptionsDTO) {
    function from(value) {
        if (value === undefined || value === null) {
            return undefined;
        }
        const result = {
            cwd: value.cwd || CommandOptions.defaults.cwd,
            env: value.env
        };
        if (value.shell) {
            result.executable = value.shell.executable;
            result.shellArgs = value.shell.args;
            result.shellQuoting = value.shell.quoting;
        }
        return result;
    }
    ShellExecutionOptionsDTO.from = from;
    function to(value) {
        if (value === undefined || value === null) {
            return undefined;
        }
        const result = {
            cwd: value.cwd,
            env: value.env
        };
        if (value.executable) {
            result.shell = {
                executable: value.executable
            };
            if (value.shellArgs) {
                result.shell.args = value.shellArgs;
            }
            if (value.shellQuoting) {
                result.shell.quoting = value.shellQuoting;
            }
        }
        return result;
    }
    ShellExecutionOptionsDTO.to = to;
})(ShellExecutionOptionsDTO || (ShellExecutionOptionsDTO = {}));
var ShellExecutionDTO;
(function (ShellExecutionDTO) {
    function is(value) {
        const candidate = value;
        return candidate && (!!candidate.commandLine || !!candidate.command);
    }
    ShellExecutionDTO.is = is;
    function from(value) {
        const result = {};
        if (value.name && Types.isString(value.name) && (value.args === undefined || value.args === null || value.args.length === 0)) {
            result.commandLine = value.name;
        }
        else {
            result.command = value.name;
            result.args = value.args;
        }
        if (value.options) {
            result.options = ShellExecutionOptionsDTO.from(value.options);
        }
        return result;
    }
    ShellExecutionDTO.from = from;
    function to(value) {
        const result = {
            runtime: RuntimeType.Shell,
            name: value.commandLine ? value.commandLine : value.command,
            args: value.args,
            presentation: undefined
        };
        if (value.options) {
            result.options = ShellExecutionOptionsDTO.to(value.options);
        }
        return result;
    }
    ShellExecutionDTO.to = to;
})(ShellExecutionDTO || (ShellExecutionDTO = {}));
var CustomExecutionDTO;
(function (CustomExecutionDTO) {
    function is(value) {
        const candidate = value;
        return candidate && candidate.customExecution === 'customExecution';
    }
    CustomExecutionDTO.is = is;
    function from(value) {
        return {
            customExecution: 'customExecution'
        };
    }
    CustomExecutionDTO.from = from;
    function to(value) {
        return {
            runtime: RuntimeType.CustomExecution,
            presentation: undefined
        };
    }
    CustomExecutionDTO.to = to;
})(CustomExecutionDTO || (CustomExecutionDTO = {}));
var TaskSourceDTO;
(function (TaskSourceDTO) {
    function from(value) {
        const result = {
            label: value.label
        };
        if (value.kind === TaskSourceKind.Extension) {
            result.extensionId = value.extension;
            if (value.workspaceFolder) {
                result.scope = value.workspaceFolder.uri;
            }
            else {
                result.scope = value.scope;
            }
        }
        else if (value.kind === TaskSourceKind.Workspace) {
            result.extensionId = '$core';
            result.scope = value.config.workspaceFolder ? value.config.workspaceFolder.uri : 1 /* TaskScope.Global */;
        }
        return result;
    }
    TaskSourceDTO.from = from;
    function to(value, workspace) {
        let scope;
        let workspaceFolder;
        if ((value.scope === undefined) || ((typeof value.scope === 'number') && (value.scope !== 1 /* TaskScope.Global */))) {
            if (workspace.getWorkspace().folders.length === 0) {
                scope = 1 /* TaskScope.Global */;
                workspaceFolder = undefined;
            }
            else {
                scope = 3 /* TaskScope.Folder */;
                workspaceFolder = workspace.getWorkspace().folders[0];
            }
        }
        else if (typeof value.scope === 'number') {
            scope = value.scope;
        }
        else {
            scope = 3 /* TaskScope.Folder */;
            workspaceFolder = workspace.getWorkspaceFolder(URI.revive(value.scope)) ?? undefined;
        }
        const result = {
            kind: TaskSourceKind.Extension,
            label: value.label,
            extension: value.extensionId,
            scope,
            workspaceFolder
        };
        return result;
    }
    TaskSourceDTO.to = to;
})(TaskSourceDTO || (TaskSourceDTO = {}));
var TaskHandleDTO;
(function (TaskHandleDTO) {
    function is(value) {
        const candidate = value;
        return !!candidate && Types.isString(candidate.id) && !!candidate.workspaceFolder;
    }
    TaskHandleDTO.is = is;
})(TaskHandleDTO || (TaskHandleDTO = {}));
var TaskDTO;
(function (TaskDTO) {
    function from(task) {
        if (task === undefined || task === null || (!CustomTask.is(task) && !ContributedTask.is(task) && !ConfiguringTask.is(task))) {
            return undefined;
        }
        const result = {
            _id: task._id,
            name: task.configurationProperties.name,
            definition: TaskDefinitionDTO.from(task.getDefinition(true)),
            source: TaskSourceDTO.from(task._source),
            execution: undefined,
            presentationOptions: !ConfiguringTask.is(task) && task.command ? TaskPresentationOptionsDTO.from(task.command.presentation) : undefined,
            isBackground: task.configurationProperties.isBackground,
            problemMatchers: [],
            hasDefinedMatchers: ContributedTask.is(task) ? task.hasDefinedMatchers : false,
            runOptions: RunOptionsDTO.from(task.runOptions),
        };
        result.group = TaskGroupDTO.from(task.configurationProperties.group);
        if (task.configurationProperties.detail) {
            result.detail = task.configurationProperties.detail;
        }
        if (!ConfiguringTask.is(task) && task.command) {
            switch (task.command.runtime) {
                case RuntimeType.Process:
                    result.execution = ProcessExecutionDTO.from(task.command);
                    break;
                case RuntimeType.Shell:
                    result.execution = ShellExecutionDTO.from(task.command);
                    break;
                case RuntimeType.CustomExecution:
                    result.execution = CustomExecutionDTO.from(task.command);
                    break;
            }
        }
        if (task.configurationProperties.problemMatchers) {
            for (const matcher of task.configurationProperties.problemMatchers) {
                if (Types.isString(matcher)) {
                    result.problemMatchers.push(matcher);
                }
            }
        }
        return result;
    }
    TaskDTO.from = from;
    function to(task, workspace, executeOnly, icon, hide) {
        if (!task || (typeof task.name !== 'string')) {
            return undefined;
        }
        let command;
        if (task.execution) {
            if (ShellExecutionDTO.is(task.execution)) {
                command = ShellExecutionDTO.to(task.execution);
            }
            else if (ProcessExecutionDTO.is(task.execution)) {
                command = ProcessExecutionDTO.to(task.execution);
            }
            else if (CustomExecutionDTO.is(task.execution)) {
                command = CustomExecutionDTO.to(task.execution);
            }
        }
        if (!command) {
            return undefined;
        }
        command.presentation = TaskPresentationOptionsDTO.to(task.presentationOptions);
        const source = TaskSourceDTO.to(task.source, workspace);
        const label = nls.localize('task.label', '{0}: {1}', source.label, task.name);
        const definition = TaskDefinitionDTO.to(task.definition, executeOnly);
        const id = (CustomExecutionDTO.is(task.execution) && task._id) ? task._id : `${task.source.extensionId}.${definition._key}`;
        const result = new ContributedTask(id, // uuidMap.getUUID(identifier)
        source, label, definition.type, definition, command, task.hasDefinedMatchers, RunOptionsDTO.to(task.runOptions), {
            name: task.name,
            identifier: label,
            group: task.group,
            isBackground: !!task.isBackground,
            problemMatchers: task.problemMatchers.slice(),
            detail: task.detail,
            icon,
            hide
        });
        return result;
    }
    TaskDTO.to = to;
})(TaskDTO || (TaskDTO = {}));
var TaskGroupDTO;
(function (TaskGroupDTO) {
    function from(value) {
        if (value === undefined) {
            return undefined;
        }
        return {
            _id: (typeof value === 'string') ? value : value._id,
            isDefault: (typeof value === 'string') ? false : ((typeof value.isDefault === 'string') ? false : value.isDefault)
        };
    }
    TaskGroupDTO.from = from;
})(TaskGroupDTO || (TaskGroupDTO = {}));
var TaskFilterDTO;
(function (TaskFilterDTO) {
    function from(value) {
        return value;
    }
    TaskFilterDTO.from = from;
    function to(value) {
        return value;
    }
    TaskFilterDTO.to = to;
})(TaskFilterDTO || (TaskFilterDTO = {}));
let MainThreadTask = class MainThreadTask extends Disposable {
    constructor(extHostContext, _taskService, _workspaceContextServer, _configurationResolverService) {
        super();
        this._taskService = _taskService;
        this._workspaceContextServer = _workspaceContextServer;
        this._configurationResolverService = _configurationResolverService;
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostTask);
        this._providers = new Map();
        this._register(this._taskService.onDidStateChange(async (event) => {
            if (event.kind === TaskEventKind.Changed) {
                return;
            }
            const task = event.__task;
            if (event.kind === TaskEventKind.Start) {
                const execution = TaskExecutionDTO.from(task.getTaskExecution());
                let resolvedDefinition = execution.task.definition;
                if (execution.task?.execution && CustomExecutionDTO.is(execution.task.execution) && event.resolvedVariables) {
                    const expr = ConfigurationResolverExpression.parse(execution.task.definition);
                    for (const replacement of expr.unresolved()) {
                        const value = event.resolvedVariables.get(replacement.inner);
                        if (value !== undefined) {
                            expr.resolve(replacement, value);
                        }
                    }
                    resolvedDefinition = await this._configurationResolverService.resolveAsync(task.getWorkspaceFolder(), expr);
                }
                this._proxy.$onDidStartTask(execution, event.terminalId, resolvedDefinition);
            }
            else if (event.kind === TaskEventKind.ProcessStarted) {
                this._proxy.$onDidStartTaskProcess(TaskProcessStartedDTO.from(task.getTaskExecution(), event.processId));
            }
            else if (event.kind === TaskEventKind.ProcessEnded) {
                this._proxy.$onDidEndTaskProcess(TaskProcessEndedDTO.from(task.getTaskExecution(), event.exitCode));
            }
            else if (event.kind === TaskEventKind.End) {
                this._proxy.$OnDidEndTask(TaskExecutionDTO.from(task.getTaskExecution()));
            }
            else if (event.kind === TaskEventKind.ProblemMatcherStarted) {
                this._proxy.$onDidStartTaskProblemMatchers(TaskProblemMatcherStartedDto.from({ execution: task.getTaskExecution() }));
            }
            else if (event.kind === TaskEventKind.ProblemMatcherEnded) {
                this._proxy.$onDidEndTaskProblemMatchers(TaskProblemMatcherEndedDto.from({ execution: task.getTaskExecution(), hasErrors: false }));
            }
            else if (event.kind === TaskEventKind.ProblemMatcherFoundErrors) {
                this._proxy.$onDidEndTaskProblemMatchers(TaskProblemMatcherEndedDto.from({ execution: task.getTaskExecution(), hasErrors: true }));
            }
        }));
    }
    dispose() {
        for (const value of this._providers.values()) {
            value.disposable.dispose();
        }
        this._providers.clear();
        super.dispose();
    }
    $createTaskId(taskDTO) {
        return new Promise((resolve, reject) => {
            const task = TaskDTO.to(taskDTO, this._workspaceContextServer, true);
            if (task) {
                resolve(task._id);
            }
            else {
                reject(new Error('Task could not be created from DTO'));
            }
        });
    }
    $registerTaskProvider(handle, type) {
        const provider = {
            provideTasks: (validTypes) => {
                return Promise.resolve(this._proxy.$provideTasks(handle, validTypes)).then((value) => {
                    const tasks = [];
                    for (const dto of value.tasks) {
                        const task = TaskDTO.to(dto, this._workspaceContextServer, true);
                        if (task) {
                            tasks.push(task);
                        }
                        else {
                            console.error(`Task System: can not convert task: ${JSON.stringify(dto.definition, undefined, 0)}. Task will be dropped`);
                        }
                    }
                    const processedExtension = {
                        ...value.extension,
                        extensionLocation: URI.revive(value.extension.extensionLocation)
                    };
                    return {
                        tasks,
                        extension: processedExtension
                    };
                });
            },
            resolveTask: (task) => {
                const dto = TaskDTO.from(task);
                if (dto) {
                    dto.name = ((dto.name === undefined) ? '' : dto.name); // Using an empty name causes the name to default to the one given by the provider.
                    return Promise.resolve(this._proxy.$resolveTask(handle, dto)).then(resolvedTask => {
                        if (resolvedTask) {
                            return TaskDTO.to(resolvedTask, this._workspaceContextServer, true, task.configurationProperties.icon, task.configurationProperties.hide);
                        }
                        return undefined;
                    });
                }
                return Promise.resolve(undefined);
            }
        };
        const disposable = this._taskService.registerTaskProvider(provider, type);
        this._providers.set(handle, { disposable, provider });
        return Promise.resolve(undefined);
    }
    $unregisterTaskProvider(handle) {
        const provider = this._providers.get(handle);
        if (provider) {
            provider.disposable.dispose();
            this._providers.delete(handle);
        }
        return Promise.resolve(undefined);
    }
    $fetchTasks(filter) {
        return this._taskService.tasks(TaskFilterDTO.to(filter)).then((tasks) => {
            const result = [];
            for (const task of tasks) {
                const item = TaskDTO.from(task);
                if (item) {
                    result.push(item);
                }
            }
            return result;
        });
    }
    getWorkspace(value) {
        let workspace;
        if (typeof value === 'string') {
            workspace = value;
        }
        else {
            const workspaceObject = this._workspaceContextServer.getWorkspace();
            const uri = URI.revive(value);
            if (workspaceObject.configuration?.toString() === uri.toString()) {
                workspace = workspaceObject;
            }
            else {
                workspace = this._workspaceContextServer.getWorkspaceFolder(uri);
            }
        }
        return workspace;
    }
    async $getTaskExecution(value) {
        if (TaskHandleDTO.is(value)) {
            const workspace = this.getWorkspace(value.workspaceFolder);
            if (workspace) {
                const task = await this._taskService.getTask(workspace, value.id, true);
                if (task) {
                    return {
                        id: task._id,
                        task: TaskDTO.from(task)
                    };
                }
                throw new Error('Task not found');
            }
            else {
                throw new Error('No workspace folder');
            }
        }
        else {
            const task = TaskDTO.to(value, this._workspaceContextServer, true);
            return {
                id: task._id,
                task: TaskDTO.from(task)
            };
        }
    }
    // Passing in a TaskHandleDTO will cause the task to get re-resolved, which is important for tasks are coming from the core,
    // such as those gotten from a fetchTasks, since they can have missing configuration properties.
    $executeTask(value) {
        return new Promise((resolve, reject) => {
            if (TaskHandleDTO.is(value)) {
                const workspace = this.getWorkspace(value.workspaceFolder);
                if (workspace) {
                    this._taskService.getTask(workspace, value.id, true).then((task) => {
                        if (!task) {
                            reject(new Error('Task not found'));
                        }
                        else {
                            const result = {
                                id: value.id,
                                task: TaskDTO.from(task)
                            };
                            this._taskService.run(task).then(summary => {
                                // Ensure that the task execution gets cleaned up if the exit code is undefined
                                // This can happen when the task has dependent tasks and one of them failed
                                if ((summary?.exitCode === undefined) || (summary.exitCode !== 0)) {
                                    this._proxy.$OnDidEndTask(result);
                                }
                            }, reason => {
                                // eat the error, it has already been surfaced to the user and we don't care about it here
                            });
                            resolve(result);
                        }
                    }, (_error) => {
                        reject(new Error('Task not found'));
                    });
                }
                else {
                    reject(new Error('No workspace folder'));
                }
            }
            else {
                const task = TaskDTO.to(value, this._workspaceContextServer, true);
                this._taskService.run(task).then(undefined, reason => {
                    // eat the error, it has already been surfaced to the user and we don't care about it here
                });
                const result = {
                    id: task._id,
                    task: TaskDTO.from(task)
                };
                resolve(result);
            }
        });
    }
    $customExecutionComplete(id, result) {
        return new Promise((resolve, reject) => {
            this._taskService.getActiveTasks().then((tasks) => {
                for (const task of tasks) {
                    if (id === task._id) {
                        this._taskService.extensionCallbackTaskComplete(task, result).then((value) => {
                            resolve(undefined);
                        }, (error) => {
                            reject(error);
                        });
                        return;
                    }
                }
                reject(new Error('Task to mark as complete not found'));
            });
        });
    }
    $terminateTask(id) {
        return new Promise((resolve, reject) => {
            this._taskService.getActiveTasks().then((tasks) => {
                for (const task of tasks) {
                    if (id === task._id) {
                        this._taskService.terminate(task).then((value) => {
                            resolve(undefined);
                        }, (error) => {
                            reject(undefined);
                        });
                        return;
                    }
                }
                reject(new ErrorNoTelemetry('Task to terminate not found'));
            });
        });
    }
    $registerTaskSystem(key, info) {
        let platform;
        switch (info.platform) {
            case 'Web':
                platform = 0 /* Platform.Platform.Web */;
                break;
            case 'win32':
                platform = 3 /* Platform.Platform.Windows */;
                break;
            case 'darwin':
                platform = 1 /* Platform.Platform.Mac */;
                break;
            case 'linux':
                platform = 2 /* Platform.Platform.Linux */;
                break;
            default:
                platform = Platform.platform;
        }
        this._taskService.registerTaskSystem(key, {
            platform: platform,
            uriProvider: (path) => {
                return URI.from({ scheme: info.scheme, authority: info.authority, path });
            },
            context: this._extHostContext,
            resolveVariables: (workspaceFolder, toResolve, target) => {
                const vars = [];
                toResolve.variables.forEach(item => vars.push(item));
                return Promise.resolve(this._proxy.$resolveVariables(workspaceFolder.uri, { process: toResolve.process, variables: vars })).then(values => {
                    const partiallyResolvedVars = Array.from(Object.values(values.variables));
                    return new Promise((resolve, reject) => {
                        this._configurationResolverService.resolveWithInteraction(workspaceFolder, partiallyResolvedVars, 'tasks', undefined, target).then(resolvedVars => {
                            if (!resolvedVars) {
                                resolve(undefined);
                            }
                            const result = {
                                process: undefined,
                                variables: new Map()
                            };
                            for (let i = 0; i < partiallyResolvedVars.length; i++) {
                                const variableName = vars[i].substring(2, vars[i].length - 1);
                                if (resolvedVars && values.variables[vars[i]] === vars[i]) {
                                    const resolved = resolvedVars.get(variableName);
                                    if (typeof resolved === 'string') {
                                        result.variables.set(variableName, resolved);
                                    }
                                }
                                else {
                                    result.variables.set(variableName, partiallyResolvedVars[i]);
                                }
                            }
                            if (Types.isString(values.process)) {
                                result.process = values.process;
                            }
                            resolve(result);
                        }, reason => {
                            reject(reason);
                        });
                    });
                });
            },
            findExecutable: (command, cwd, paths) => {
                return this._proxy.$findExecutable(command, cwd, paths);
            }
        });
    }
    async $registerSupportedExecutions(custom, shell, process) {
        return this._taskService.registerSupportedExecutions(custom, shell, process);
    }
};
MainThreadTask = __decorate([
    extHostNamedCustomer(MainContext.MainThreadTask),
    __param(1, ITaskService),
    __param(2, IWorkspaceContextService),
    __param(3, IConfigurationResolverService)
], MainThreadTask);
export { MainThreadTask };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZFRhc2suanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9icm93c2VyL21haW5UaHJlYWRUYXNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0saUJBQWlCLENBQUM7QUFFdkMsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSw2QkFBNkIsQ0FBQztBQUNqRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDNUQsT0FBTyxLQUFLLEtBQUssTUFBTSwrQkFBK0IsQ0FBQztBQUN2RCxPQUFPLEtBQUssUUFBUSxNQUFNLGtDQUFrQyxDQUFDO0FBRTdELE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSxtQ0FBbUMsQ0FBQztBQUU1RSxPQUFPLEVBQWMsd0JBQXdCLEVBQW9CLE1BQU0saURBQWlELENBQUM7QUFFekgsT0FBTyxFQUNOLGVBQWUsRUFBRSxlQUFlLEVBQ1YsY0FBYyxFQUF5QixXQUFXLEVBQUUsVUFBVSxFQUNwRixjQUFjLEVBQTBELGNBQWMsRUFBRSxtQkFBbUIsRUFBRSxVQUFVLEVBQ3ZILE1BQU0scUNBQXFDLENBQUM7QUFJN0MsT0FBTyxFQUFFLFlBQVksRUFBOEIsTUFBTSwyQ0FBMkMsQ0FBQztBQUVyRyxPQUFPLEVBQUUsb0JBQW9CLEVBQW1CLE1BQU0sc0RBQXNELENBQUM7QUFDN0csT0FBTyxFQUFFLGNBQWMsRUFBeUMsV0FBVyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDbkgsT0FBTyxFQU1OLGFBQWEsRUFDYixNQUFNLDJCQUEyQixDQUFDO0FBQ25DLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHNFQUFzRSxDQUFDO0FBRXJILE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRWxFLE9BQU8sRUFB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