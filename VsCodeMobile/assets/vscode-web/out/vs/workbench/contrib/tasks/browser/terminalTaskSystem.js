/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { asArray } from '../../../../base/common/arrays.js';
import * as Async from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { isUNC } from '../../../../base/common/extpath.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { LinkedMap } from '../../../../base/common/map.js';
import * as Objects from '../../../../base/common/objects.js';
import * as path from '../../../../base/common/path.js';
import * as Platform from '../../../../base/common/platform.js';
import * as resources from '../../../../base/common/resources.js';
import Severity from '../../../../base/common/severity.js';
import * as Types from '../../../../base/common/types.js';
import * as nls from '../../../../nls.js';
import { MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { Markers } from '../../markers/common/markers.js';
import { ProblemMatcherRegistry /*, ProblemPattern, getResource */ } from '../common/problemMatcher.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Schemas } from '../../../../base/common/network.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { formatMessageForTerminal } from '../../../../platform/terminal/common/terminalStrings.js';
import { TaskTerminalStatus } from './taskTerminalStatus.js';
import { StartStopProblemCollector, WatchingProblemCollector } from '../common/problemCollectors.js';
import { GroupKind } from '../common/taskConfiguration.js';
import { TaskError, Triggers, VerifiedTask } from '../common/taskSystem.js';
import { CommandString, ContributedTask, CustomTask, InMemoryTask, PanelKind, RerunForActiveTerminalCommandId, RevealKind, RevealProblemKind, RuntimeType, ShellQuoting, TASK_TERMINAL_ACTIVE, TaskEvent, TaskEventKind, TaskSourceKind, rerunTaskIcon } from '../common/tasks.js';
import { VSCodeSequence } from '../../terminal/browser/terminalEscapeSequences.js';
import { TerminalProcessExtHostProxy } from '../../terminal/browser/terminalProcessExtHostProxy.js';
import { TERMINAL_VIEW_ID } from '../../terminal/common/terminal.js';
import { TaskProblemMonitor } from './taskProblemMonitor.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { serializeVSCodeOscMessage } from '../../../../platform/terminal/common/xterm/shellIntegrationAddon.js';
const TaskTerminalType = 'Task';
class VariableResolver {
    static { this._regex = /\$\{(.*?)\}/g; }
    constructor(workspaceFolder, taskSystemInfo, values, _service) {
        this.workspaceFolder = workspaceFolder;
        this.taskSystemInfo = taskSystemInfo;
        this.values = values;
        this._service = _service;
    }
    async resolve(value) {
        const replacers = [];
        value.replace(VariableResolver._regex, (match, ...args) => {
            replacers.push(this._replacer(match, args));
            return match;
        });
        const resolvedReplacers = await Promise.all(replacers);
        return value.replace(VariableResolver._regex, () => resolvedReplacers.shift());
    }
    async _replacer(match, args) {
        // Strip out the ${} because the map contains them variables without those characters.
        const result = this.values.get(match.substring(2, match.length - 1));
        if ((result !== undefined) && (result !== null)) {
            return result;
        }
        if (this._service) {
            return this._service.resolveAsync(this.workspaceFolder, match);
        }
        return match;
    }
}
export class TerminalTaskSystem extends Disposable {
    static { this.TelemetryEventName = 'taskService'; }
    static { this.ProcessVarName = '__process__'; }
    static { this._shellQuotes = {
        'cmd': {
            strong: '"'
        },
        'powershell': {
            escape: {
                escapeChar: '`',
                charsToEscape: ' "\'()'
            },
            strong: '\'',
            weak: '"'
        },
        'bash': {
            escape: {
                escapeChar: '\\',
                charsToEscape: ' "\''
            },
            strong: '\'',
            weak: '"'
        },
        'zsh': {
            escape: {
                escapeChar: '\\',
                charsToEscape: ' "\''
            },
            strong: '\'',
            weak: '"'
        }
    }; }
    static { this._osShellQuotes = {
        'Linux': TerminalTaskSystem._shellQuotes['bash'],
        'Mac': TerminalTaskSystem._shellQuotes['bash'],
        'Windows': TerminalTaskSystem._shellQuotes['powershell']
    }; }
    taskShellIntegrationStartSequence(cwd) {
        return (VSCodeSequence("P" /* VSCodeOscPt.Property */, `${"HasRichCommandDetection" /* VSCodeOscProperty.HasRichCommandDetection */}=True`) +
            VSCodeSequence("A" /* VSCodeOscPt.PromptStart */) +
            VSCodeSequence("P" /* VSCodeOscPt.Property */, `${"Task" /* VSCodeOscProperty.Task */}=True`) +
            (cwd
                ? VSCodeSequence("P" /* VSCodeOscPt.Property */, `${"Cwd" /* VSCodeOscProperty.Cwd */}=${typeof cwd === 'string' ? cwd : cwd.fsPath}`)
                : '') +
            VSCodeSequence("B" /* VSCodeOscPt.CommandStart */));
    }
    getTaskShellIntegrationOutputSequence(commandLineInfo) {
        return ((commandLineInfo
            ? VSCodeSequence("E" /* VSCodeOscPt.CommandLine */, `${serializeVSCodeOscMessage(commandLineInfo.commandLine)};${commandLineInfo.nonce}`)
            : '') +
            VSCodeSequence("C" /* VSCodeOscPt.CommandExecuted */));
    }
    constructor(_terminalService, _terminalGroupService, _outputService, _paneCompositeService, _viewsService, _markerService, _modelService, _configurationResolverService, _contextService, _environmentService, _outputChannelId, _fileService, _terminalProfileResolverService, _pathService, _viewDescriptorService, _logService, _notificationService, contextKeyService, instantiationService, taskSystemInfoResolver, _taskLookup) {
        super();
        this._terminalService = _terminalService;
        this._terminalGroupService = _terminalGroupService;
        this._outputService = _outputService;
        this._paneCompositeService = _paneCompositeService;
        this._viewsService = _viewsService;
        this._markerService = _markerService;
        this._modelService = _modelService;
        this._configurationResolverService = _configurationResolverService;
        this._contextService = _contextService;
        this._environmentService = _environmentService;
        this._outputChannelId = _outputChannelId;
        this._fileService = _fileService;
        this._terminalProfileResolverService = _terminalProfileResolverService;
        this._pathService = _pathService;
        this._viewDescriptorService = _viewDescriptorService;
        this._logService = _logService;
        this._notificationService = _notificationService;
        this._taskLookup = _taskLookup;
        this._isRerun = false;
        this._terminalCreationQueue = Promise.resolve();
        this._hasReconnected = false;
        this._terminalTabActions = [{ id: RerunForActiveTerminalCommandId, label: nls.localize('rerunTask', 'Rerun Task'), icon: rerunTaskIcon }];
        this._taskStartTimes = new Map();
        this._activeTasks = Object.create(null);
        this._busyTasks = Object.create(null);
        this._taskErrors = Object.create(null);
        this._taskDependencies = Object.create(null);
        this._terminals = Object.create(null);
        this._idleTaskTerminals = new LinkedMap();
        this._sameTaskTerminals = Object.create(null);
        this._onDidStateChange = new Emitter();
        this._taskSystemInfoResolver = taskSystemInfoResolver;
        this._register(this._terminalStatusManager = instantiationService.createInstance(TaskTerminalStatus));
        this._register(this._taskProblemMonitor = instantiationService.createInstance(TaskProblemMonitor));
        this._taskTerminalActive = TASK_TERMINAL_ACTIVE.bindTo(contextKeyService);
        this._register(this._terminalService.onDidChangeActiveInstance((e) => this._taskTerminalActive.set(e?.shellLaunchConfig.type === 'Task')));
    }
    get onDidStateChange() {
        return this._onDidStateChange.event;
    }
    _log(value) {
        this._appendOutput(value + '\n');
    }
    _showOutput() {
        this._outputService.showChannel(this._outputChannelId, true);
    }
    reconnect(task, resolver) {
        this._reconnectToTerminals();
        return this.run(task, resolver, Triggers.reconnect);
    }
    run(task, resolver, trigger = Triggers.command) {
        task = task.clone(); // A small amount of task state is stored in the task (instance) and tasks passed in to run may have that set already.
        const instances = InMemoryTask.is(task) || this._isTaskEmpty(task) ? [] : this._getInstances(task);
        const validInstance = instances.length < ((task.runOptions && task.runOptions.instanceLimit) ?? 1);
        const instance = instances[0]?.count?.count ?? 0;
        this._currentTask = new VerifiedTask(task, resolver, trigger);
        if (instance > 0) {
            task.instance = instance;
        }
        if (!validInstance) {
            const terminalData = instances[instances.length - 1];
            this._lastTask = this._currentTask;
            return { kind: 2 /* TaskExecuteKind.Active */, task: terminalData.task, active: { same: true, background: task.configurationProperties.isBackground }, promise: terminalData.promise };
        }
        try {
            const executeResult = { kind: 1 /* TaskExecuteKind.Started */, task, started: {}, promise: this._executeTask(task, resolver, trigger, new Set(), new Map(), undefined) };
            executeResult.promise.then(summary => {
                this._lastTask = this._currentTask;
            });
            return executeResult;
        }
        catch (error) {
            if (error instanceof TaskError) {
                throw error;
            }
            else if (error instanceof Error) {
                this._log(error.message);
                throw new TaskError(Severity.Error, error.message, 7 /* TaskErrors.UnknownError */);
            }
            else {
                this._log(error.toString());
                throw new TaskError(Severity.Error, nls.localize('TerminalTaskSystem.unknownError', 'A unknown error has occurred while executing a task. See task output log for details.'), 7 /* TaskErrors.UnknownError */);
            }
        }
    }
    getTerminalsForTasks(tasks) {
        const results = [];
        for (const t of asArray(tasks)) {
            for (const key in this._terminals) {
                const value = this._terminals[key];
                if (value.lastTask === t.getMapKey()) {
                    results.push(value.terminal.resource);
                }
            }
        }
        return results.length > 0 ? results : undefined;
    }
    getTaskProblems(instanceId) {
        return this._taskProblemMonitor.getTaskProblems(instanceId);
    }
    rerun() {
        if (this._lastTask && this._lastTask.verify()) {
            if ((this._lastTask.task.runOptions.reevaluateOnRerun !== undefined) && !this._lastTask.task.runOptions.reevaluateOnRerun) {
                this._isRerun = true;
            }
            const result = this.run(this._lastTask.task, this._lastTask.resolver);
            result.promise.then(summary => {
                this._isRerun = false;
            });
            return result;
        }
        else {
            return undefined;
        }
    }
    get lastTask() {
        return this._lastTask;
    }
    set lastTask(task) {
        this._lastTask = task;
    }
    _showTaskLoadErrors(task) {
        if (task.taskLoadMessages && task.taskLoadMessages.length > 0) {
            task.taskLoadMessages.forEach(loadMessage => {
                this._log(loadMessage + '\n');
            });
            const openOutput = 'Show Output';
            this._notificationService.prompt(Severity.Warning, nls.localize('TerminalTaskSystem.taskLoadReporting', "There are issues with task \"{0}\". See the output for more details.", task._label), [{
                    label: openOutput,
                    run: () => this._showOutput()
                }]);
        }
    }
    isTaskVisible(task) {
        const terminalData = this._activeTasks[task.getMapKey()];
        if (!terminalData?.terminal) {
            return false;
        }
        const activeTerminalInstance = this._terminalService.activeInstance;
        const isPanelShowingTerminal = !!this._viewsService.getActiveViewWithId(TERMINAL_VIEW_ID);
        return isPanelShowingTerminal && (activeTerminalInstance?.instanceId === terminalData.terminal.instanceId);
    }
    revealTask(task) {
        const terminalData = this._activeTasks[task.getMapKey()];
        if (!terminalData?.terminal) {
            return false;
        }
        const isTerminalInPanel = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID) === 1 /* ViewContainerLocation.Panel */;
        if (isTerminalInPanel && this.isTaskVisible(task)) {
            if (this._previousPanelId) {
                if (this._previousTerminalInstance) {
                    this._terminalService.setActiveInstance(this._previousTerminalInstance);
                }
                this._paneCompositeService.openPaneComposite(this._previousPanelId, 1 /* ViewContainerLocation.Panel */);
            }
            else {
                this._paneCompositeService.hideActivePaneComposite(1 /* ViewContainerLocation.Panel */);
            }
            this._previousPanelId = undefined;
            this._previousTerminalInstance = undefined;
        }
        else {
            if (isTerminalInPanel) {
                this._previousPanelId = this._paneCompositeService.getActivePaneComposite(1 /* ViewContainerLocation.Panel */)?.getId();
                if (this._previousPanelId === TERMINAL_VIEW_ID) {
                    this._previousTerminalInstance = this._terminalService.activeInstance ?? undefined;
                }
            }
            this._terminalService.setActiveInstance(terminalData.terminal);
            if (CustomTask.is(task) || ContributedTask.is(task)) {
                this._terminalGroupService.showPanel(task.command.presentation.focus);
            }
        }
        return true;
    }
    isActive() {
        return Promise.resolve(this.isActiveSync());
    }
    isActiveSync() {
        return Object.values(this._activeTasks).some(value => !!value.terminal);
    }
    canAutoTerminate() {
        return Object.values(this._activeTasks).every(value => !value.task.configurationProperties.promptOnClose);
    }
    getActiveTasks() {
        return Object.values(this._activeTasks).flatMap(value => value.terminal ? value.task : []);
    }
    getLastInstance(task) {
        const recentKey = task.getKey();
        return Object.values(this._activeTasks).reverse().find((value) => recentKey && recentKey === value.task.getKey())?.task;
    }
    getFirstInstance(task) {
        const recentKey = task.getKey();
        for (const task of this.getActiveTasks()) {
            if (recentKey && recentKey === task.getKey()) {
                return task;
            }
        }
        return undefined;
    }
    getBusyTasks() {
        return Object.keys(this._busyTasks).map(key => this._busyTasks[key]);
    }
    customExecutionComplete(task, result) {
        const activeTerminal = this._activeTasks[task.getMapKey()];
        if (!activeTerminal?.terminal) {
            return Promise.reject(new Error('Expected to have a terminal for a custom execution task'));
        }
        return new Promise((resolve) => {
            // activeTerminal.terminal.rendererExit(result);
            resolve();
        });
    }
    _getInstances(task) {
        const recentKey = task.getKey();
        return Object.values(this._activeTasks).filter((value) => recentKey && recentKey === value.task.getKey());
    }
    _removeFromActiveTasks(task) {
        const key = typeof task === 'string' ? task : task.getMapKey();
        const taskToRemove = this._activeTasks[key];
        if (!taskToRemove) {
            return;
        }
        delete this._activeTasks[key];
    }
    _fireTaskEvent(event) {
        if (event.kind !== TaskEventKind.Changed && event.kind !== TaskEventKind.ProblemMatcherEnded && event.kind !== TaskEventKind.ProblemMatcherStarted) {
            const activeTask = this._activeTasks[event.__task.getMapKey()];
            if (activeTask) {
                activeTask.state = event.kind;
            }
        }
        this._onDidStateChange.fire(event);
    }
    terminate(task) {
        const activeTerminal = this._activeTasks[task.getMapKey()];
        if (!activeTerminal) {
            return Promise.resolve({ success: false, task: undefined });
        }
        const terminal = activeTerminal.terminal;
        if (!terminal) {
            return Promise.resolve({ success: false, task: undefined });
        }
        return new Promise((resolve, reject) => {
            this._register(terminal.onDisposed(terminal => {
                this._fireTaskEvent(TaskEvent.terminated(task, terminal.instanceId, terminal.exitReason));
            }));
            const onExit = terminal.onExit(() => {
                const task = activeTerminal.task;
                try {
                    onExit.dispose();
                    this._fireTaskEvent(TaskEvent.terminated(task, terminal.instanceId, terminal.exitReason));
                }
                catch (error) {
                    // Do nothing.
                }
                resolve({ success: true, task: task });
            });
            terminal.dispose();
        });
    }
    terminateAll() {
        const promises = [];
        for (const [key, terminalData] of Object.entries(this._activeTasks)) {
            const terminal = terminalData?.terminal;
            if (terminal) {
                promises.push(new Promise((resolve, reject) => {
                    const onExit = terminal.onExit(() => {
                        const task = terminalData.task;
                        try {
                            onExit.dispose();
                            this._fireTaskEvent(TaskEvent.terminated(task, terminal.instanceId, terminal.exitReason));
                        }
                        catch (error) {
                            // Do nothing.
                        }
                        if (this._activeTasks[key] === terminalData) {
                            delete this._activeTasks[key];
                        }
                        resolve({ success: true, task: terminalData.task });
                    });
                }));
                terminal.dispose();
            }
        }
        return Promise.all(promises);
    }
    _showDependencyCycleMessage(task) {
        this._log(nls.localize('dependencyCycle', 'There is a dependency cycle. See task "{0}".', task._label));
        this._showOutput();
    }
    _executeTask(task, resolver, trigger, liveDependencies, encounteredTasks, alreadyResolved) {
        this._showTaskLoadErrors(task);
        const mapKey = task.getMapKey();
        // It's important that we add this task's entry to _activeTasks before
        // any of the code in the then runs (see #180541 and #180578). Wrapping
        // it in Promise.resolve().then() ensures that.
        const promise = Promise.resolve().then(async () => {
            alreadyResolved = alreadyResolved ?? new Map();
            const promises = [];
            if (task.configurationProperties.dependsOn) {
                const nextLiveDependencies = new Set(liveDependencies).add(task.getCommonTaskId());
                for (const dependency of task.configurationProperties.dependsOn) {
                    const dependencyTask = await resolver.resolve(dependency.uri, dependency.task);
                    if (dependencyTask) {
                        this._adoptConfigurationForDependencyTask(dependencyTask, task);
                        // Track the dependency relationship
                        const taskMapKey = task.getMapKey();
                        const dependencyMapKey = dependencyTask.getMapKey();
                        if (!this._taskDependencies[taskMapKey]) {
                            this._taskDependencies[taskMapKey] = [];
                        }
                        if (!this._taskDependencies[taskMapKey].includes(dependencyMapKey)) {
                            this._taskDependencies[taskMapKey].push(dependencyMapKey);
                        }
                        let taskResult;
                        const commonKey = dependencyTask.getCommonTaskId();
                        if (nextLiveDependencies.has(commonKey)) {
                            this._showDependencyCycleMessage(dependencyTask);
                            taskResult = Promise.resolve({});
                        }
                        else {
                            taskResult = encounteredTasks.get(commonKey);
                            if (!taskResult) {
                                const activeTask = this._activeTasks[dependencyTask.getMapKey()] ?? this._getInstances(dependencyTask).pop();
                                taskResult = activeTask && this._getDependencyPromise(activeTask);
                            }
                        }
                        if (!taskResult) {
                            this._fireTaskEvent(TaskEvent.general(TaskEventKind.DependsOnStarted, task));
                            taskResult = this._executeDependencyTask(dependencyTask, resolver, trigger, nextLiveDependencies, encounteredTasks, alreadyResolved);
                        }
                        encounteredTasks.set(commonKey, taskResult);
                        promises.push(taskResult);
                        if (task.configurationProperties.dependsOrder === "sequence" /* DependsOrder.sequence */) {
                            const promiseResult = await taskResult;
                            if (promiseResult.exitCode !== 0) {
                                break;
                            }
                        }
                    }
                    else {
                        this._log(nls.localize('dependencyFailed', 'Couldn\'t resolve dependent task \'{0}\' in workspace folder \'{1}\'', Types.isString(dependency.task) ? dependency.task : JSON.stringify(dependency.task, undefined, 0), dependency.uri.toString()));
                        this._showOutput();
                    }
                }
            }
            return Promise.all(promises).then((summaries) => {
                for (const summary of summaries) {
                    if (summary.exitCode !== 0) {
                        return { exitCode: summary.exitCode };
                    }
                }
                if ((ContributedTask.is(task) || CustomTask.is(task)) && (task.command)) {
                    if (this._isRerun) {
                        return this._reexecuteCommand(task, trigger, alreadyResolved);
                    }
                    else {
                        return this._executeCommand(task, trigger, alreadyResolved);
                    }
                }
                return { exitCode: 0 };
            });
        }).finally(() => {
            delete this._activeTasks[mapKey];
        });
        const lastInstance = this._getInstances(task).pop();
        const count = lastInstance?.count ?? { count: 0 };
        count.count++;
        const activeTask = { task, promise, count };
        this._activeTasks[mapKey] = activeTask;
        return promise;
    }
    _createInactiveDependencyPromise(task) {
        return new Promise(resolve => {
            const taskInactiveDisposable = this.onDidStateChange(taskEvent => {
                if ((taskEvent.kind === TaskEventKind.Inactive) && (taskEvent.__task === task)) {
                    taskInactiveDisposable.dispose();
                    resolve({ exitCode: 0 });
                }
            });
        });
    }
    _taskHasErrors(task) {
        const taskMapKey = task.getMapKey();
        // Check if this task itself had errors
        if (this._taskErrors[taskMapKey]) {
            return true;
        }
        // Check if any tracked dependencies had errors
        const dependencies = this._taskDependencies[taskMapKey];
        if (dependencies) {
            for (const dependencyMapKey of dependencies) {
                if (this._taskErrors[dependencyMapKey]) {
                    return true;
                }
            }
        }
        return false;
    }
    _cleanupTaskTracking(task) {
        const taskMapKey = task.getMapKey();
        delete this._taskErrors[taskMapKey];
        delete this._taskDependencies[taskMapKey];
    }
    _adoptConfigurationForDependencyTask(dependencyTask, task) {
        if (dependencyTask.configurationProperties.icon) {
            dependencyTask.configurationProperties.icon.id ||= task.configurationProperties.icon?.id;
            dependencyTask.configurationProperties.icon.color ||= task.configurationProperties.icon?.color;
        }
        else {
            dependencyTask.configurationProperties.icon = task.configurationProperties.icon;
        }
    }
    async _getDependencyPromise(task) {
        if (!task.task.configurationProperties.isBackground) {
            return task.promise;
        }
        if (!task.task.configurationProperties.problemMatchers || task.task.configurationProperties.problemMatchers.length === 0) {
            return task.promise;
        }
        if (task.state === TaskEventKind.Inactive) {
            return { exitCode: 0 };
        }
        return this._createInactiveDependencyPromise(task.task);
    }
    async _executeDependencyTask(task, resolver, trigger, liveDependencies, encounteredTasks, alreadyResolved) {
        // If the task is a background task with a watching problem matcher, we don't wait for the whole task to finish,
        // just for the problem matcher to go inactive.
        if (!task.configurationProperties.isBackground) {
            return this._executeTask(task, resolver, trigger, liveDependencies, encounteredTasks, alreadyResolved);
        }
        const inactivePromise = this._createInactiveDependencyPromise(task);
        return Promise.race([inactivePromise, this._executeTask(task, resolver, trigger, liveDependencies, encounteredTasks, alreadyResolved)]);
    }
    async _resolveAndFindExecutable(systemInfo, workspaceFolder, task, cwd, envPath) {
        const command = await this._configurationResolverService.resolveAsync(workspaceFolder, CommandString.value(task.command.name));
        cwd = cwd ? await this._configurationResolverService.resolveAsync(workspaceFolder, cwd) : undefined;
        const delimiter = (await this._pathService.path).delimiter;
        const paths = envPath ? await Promise.all(envPath.split(delimiter).map(p => this._configurationResolverService.resolveAsync(workspaceFolder, p))) : undefined;
        const foundExecutable = await systemInfo?.findExecutable(command, cwd, paths);
        if (foundExecutable) {
            return foundExecutable;
        }
        if (path.isAbsolute(command)) {
            return command;
        }
        return path.join(cwd ?? '', command);
    }
    _findUnresolvedVariables(variables, alreadyResolved) {
        if (alreadyResolved.size === 0) {
            return variables;
        }
        const unresolved = new Set();
        for (const variable of variables) {
            if (!alreadyResolved.has(variable.substring(2, variable.length - 1))) {
                unresolved.add(variable);
            }
        }
        return unresolved;
    }
    _mergeMaps(mergeInto, mergeFrom) {
        for (const entry of mergeFrom) {
            if (!mergeInto.has(entry[0])) {
                mergeInto.set(entry[0], entry[1]);
            }
        }
    }
    async _acquireInput(taskSystemInfo, workspaceFolder, task, variables, alreadyResolved) {
        const resolved = await this._resolveVariablesFromSet(taskSystemInfo, workspaceFolder, task, variables, alreadyResolved);
        this._fireTaskEvent(TaskEvent.general(TaskEventKind.AcquiredInput, task));
        return resolved;
    }
    _resolveVariablesFromSet(taskSystemInfo, workspaceFolder, task, variables, alreadyResolved) {
        const isProcess = task.command && task.command.runtime === RuntimeType.Process;
        const options = task.command && task.command.options ? task.command.options : undefined;
        const cwd = options ? options.cwd : undefined;
        let envPath = undefined;
        if (options && options.env) {
            for (const key of Object.keys(options.env)) {
                if (key.toLowerCase() === 'path') {
                    if (Types.isString(options.env[key])) {
                        envPath = options.env[key];
                    }
                    break;
                }
            }
        }
        const unresolved = this._findUnresolvedVariables(variables, alreadyResolved);
        let resolvedVariables;
        if (taskSystemInfo && workspaceFolder) {
            const resolveSet = {
                variables: unresolved
            };
            if (taskSystemInfo.platform === 3 /* Platform.Platform.Windows */ && isProcess) {
                resolveSet.process = { name: CommandString.value(task.command.name) };
                if (cwd) {
                    resolveSet.process.cwd = cwd;
                }
                if (envPath) {
                    resolveSet.process.path = envPath;
                }
            }
            resolvedVariables = taskSystemInfo.resolveVariables(workspaceFolder, resolveSet, TaskSourceKind.toConfigurationTarget(task._source.kind)).then(async (resolved) => {
                if (!resolved) {
                    return undefined;
                }
                this._mergeMaps(alreadyResolved, resolved.variables);
                resolved.variables = new Map(alreadyResolved);
                if (isProcess) {
                    let process = CommandString.value(task.command.name);
                    if (taskSystemInfo.platform === 3 /* Platform.Platform.Windows */) {
                        process = await this._resolveAndFindExecutable(taskSystemInfo, workspaceFolder, task, cwd, envPath);
                    }
                    resolved.variables.set(TerminalTaskSystem.ProcessVarName, process);
                }
                return resolved;
            });
            return resolvedVariables;
        }
        else {
            const variablesArray = new Array();
            unresolved.forEach(variable => variablesArray.push(variable));
            return new Promise((resolve, reject) => {
                this._configurationResolverService.resolveWithInteraction(workspaceFolder, variablesArray, 'tasks', undefined, TaskSourceKind.toConfigurationTarget(task._source.kind)).then(async (resolvedVariablesMap) => {
                    if (resolvedVariablesMap) {
                        this._mergeMaps(alreadyResolved, resolvedVariablesMap);
                        resolvedVariablesMap = new Map(alreadyResolved);
                        if (isProcess) {
                            let processVarValue;
                            if (Platform.isWindows) {
                                processVarValue = await this._resolveAndFindExecutable(taskSystemInfo, workspaceFolder, task, cwd, envPath);
                            }
                            else {
                                processVarValue = await this._configurationResolverService.resolveAsync(workspaceFolder, CommandString.value(task.command.name));
                            }
                            resolvedVariablesMap.set(TerminalTaskSystem.ProcessVarName, processVarValue);
                        }
                        const resolvedVariablesResult = {
                            variables: resolvedVariablesMap,
                        };
                        resolve(resolvedVariablesResult);
                    }
                    else {
                        resolve(undefined);
                    }
                }, reason => {
                    reject(reason);
                });
            });
        }
    }
    _executeCommand(task, trigger, alreadyResolved) {
        const taskWorkspaceFolder = task.getWorkspaceFolder();
        let workspaceFolder;
        if (taskWorkspaceFolder) {
            workspaceFolder = this._currentTask.workspaceFolder = taskWorkspaceFolder;
        }
        else {
            const folders = this._contextService.getWorkspace().folders;
            workspaceFolder = folders.length > 0 ? folders[0] : undefined;
        }
        const systemInfo = this._currentTask.systemInfo = this._taskSystemInfoResolver(workspaceFolder);
        const variables = new Set();
        this._collectTaskVariables(variables, task);
        const resolvedVariables = this._acquireInput(systemInfo, workspaceFolder, task, variables, alreadyResolved);
        return resolvedVariables.then((resolvedVariables) => {
            if (resolvedVariables && !this._isTaskEmpty(task)) {
                this._currentTask.resolvedVariables = resolvedVariables;
                return this._executeInTerminal(task, trigger, new VariableResolver(workspaceFolder, systemInfo, resolvedVariables.variables, this._configurationResolverService), workspaceFolder);
            }
            else {
                // Allows the taskExecutions array to be updated in the extension host
                this._fireTaskEvent(TaskEvent.general(TaskEventKind.End, task));
                return Promise.resolve({ exitCode: 0 });
            }
        }, reason => {
            return Promise.reject(reason);
        });
    }
    _isTaskEmpty(task) {
        const isCustomExecution = (task.command.runtime === RuntimeType.CustomExecution);
        return !((task.command !== undefined) && task.command.runtime && (isCustomExecution || (task.command.name !== undefined)));
    }
    _reexecuteCommand(task, trigger, alreadyResolved) {
        const lastTask = this._lastTask;
        if (!lastTask) {
            return Promise.reject(new Error('No task previously run'));
        }
        const workspaceFolder = this._currentTask.workspaceFolder = lastTask.workspaceFolder;
        const variables = new Set();
        this._collectTaskVariables(variables, task);
        // Check that the task hasn't changed to include new variables
        let hasAllVariables = true;
        variables.forEach(value => {
            if (value.substring(2, value.length - 1) in lastTask.getVerifiedTask().resolvedVariables) {
                hasAllVariables = false;
            }
        });
        if (!hasAllVariables) {
            return this._acquireInput(lastTask.getVerifiedTask().systemInfo, lastTask.getVerifiedTask().workspaceFolder, task, variables, alreadyResolved).then((resolvedVariables) => {
                if (!resolvedVariables) {
                    // Allows the taskExecutions array to be updated in the extension host
                    this._fireTaskEvent(TaskEvent.general(TaskEventKind.End, task));
                    return { exitCode: 0 };
                }
                this._currentTask.resolvedVariables = resolvedVariables;
                return this._executeInTerminal(task, trigger, new VariableResolver(lastTask.getVerifiedTask().workspaceFolder, lastTask.getVerifiedTask().systemInfo, resolvedVariables.variables, this._configurationResolverService), workspaceFolder);
            }, reason => {
                return Promise.reject(reason);
            });
        }
        else {
            this._currentTask.resolvedVariables = lastTask.getVerifiedTask().resolvedVariables;
            return this._executeInTerminal(task, trigger, new VariableResolver(lastTask.getVerifiedTask().workspaceFolder, lastTask.getVerifiedTask().systemInfo, lastTask.getVerifiedTask().resolvedVariables.variables, this._configurationResolverService), workspaceFolder);
        }
    }
    async _executeInTerminal(task, trigger, resolver, workspaceFolder) {
        let terminal = undefined;
        let error = undefined;
        let promise = undefined;
        if (task.configurationProperties.isBackground) {
            const problemMatchers = await this._resolveMatchers(resolver, task.configurationProperties.problemMatchers);
            const watchingProblemMatcher = new WatchingProblemCollector(problemMatchers, this._markerService, this._modelService, this._fileService);
            if ((problemMatchers.length > 0) && !watchingProblemMatcher.isWatching()) {
                this._appendOutput(nls.localize('TerminalTaskSystem.nonWatchingMatcher', 'Task {0} is a background task but uses a problem matcher without a background pattern', task._label));
                this._showOutput();
            }
            const toDispose = new DisposableStore();
            let eventCounter = 0;
            const mapKey = task.getMapKey();
            toDispose.add(watchingProblemMatcher.onDidStateChange((event) => {
                if (event.kind === "backgroundProcessingBegins" /* ProblemCollectorEventKind.BackgroundProcessingBegins */) {
                    eventCounter++;
                    this._busyTasks[mapKey] = task;
                    this._fireTaskEvent(TaskEvent.general(TaskEventKind.Active, task, terminal?.instanceId));
                }
                else if (event.kind === "backgroundProcessingEnds" /* ProblemCollectorEventKind.BackgroundProcessingEnds */) {
                    eventCounter--;
                    if (this._busyTasks[mapKey]) {
                        delete this._busyTasks[mapKey];
                    }
                    this._fireTaskEvent(TaskEvent.inactive(task, terminal?.instanceId, this._takeTaskDuration(terminal?.instanceId)));
                    if (eventCounter === 0) {
                        if ((watchingProblemMatcher.numberOfMatches > 0) && watchingProblemMatcher.maxMarkerSeverity &&
                            (watchingProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error)) {
                            this._taskErrors[task.getMapKey()] = true;
                            this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherFoundErrors, task, terminal?.instanceId));
                            const reveal = task.command.presentation.reveal;
                            const revealProblems = task.command.presentation.revealProblems;
                            if (revealProblems === RevealProblemKind.OnProblem) {
                                this._viewsService.openView(Markers.MARKERS_VIEW_ID, true);
                            }
                            else if (reveal === RevealKind.Silent) {
                                this._terminalService.setActiveInstance(terminal);
                                this._terminalGroupService.showPanel(false);
                            }
                        }
                        else {
                            this._fireTaskEvent(TaskEvent.problemMatcherEnded(task, this._taskHasErrors(task), terminal?.instanceId));
                        }
                    }
                }
            }));
            watchingProblemMatcher.aboutToStart();
            let delayer = undefined;
            [terminal, error] = await this._createTerminal(task, resolver, workspaceFolder);
            if (error) {
                return Promise.reject(new Error(error.message));
            }
            if (!terminal) {
                return Promise.reject(new Error(`Failed to create terminal for task ${task._label}`));
            }
            this._terminalStatusManager.addTerminal(task, terminal, watchingProblemMatcher);
            this._taskProblemMonitor.addTerminal(terminal, watchingProblemMatcher);
            let processStartedSignaled = false;
            terminal.processReady.then(() => {
                if (!processStartedSignaled) {
                    this._fireTaskEvent(TaskEvent.processStarted(task, terminal.instanceId, terminal.processId));
                    processStartedSignaled = true;
                }
            }, (_error) => {
                this._logService.error('Task terminal process never got ready');
            });
            this._taskStartTimes.set(terminal.instanceId, Date.now());
            this._fireTaskEvent(TaskEvent.start(task, terminal.instanceId, resolver.values));
            let onData;
            if (problemMatchers.length) {
                // this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherStarted, task, terminal.instanceId));
                // prevent https://github.com/microsoft/vscode/issues/174511 from happening
                onData = terminal.onLineData((line) => {
                    watchingProblemMatcher.processLine(line);
                    if (!delayer) {
                        delayer = new Async.Delayer(3000);
                    }
                    delayer.trigger(() => {
                        watchingProblemMatcher.forceDelivery();
                        delayer = undefined;
                    });
                });
            }
            promise = new Promise((resolve, reject) => {
                const onExit = terminal.onExit((terminalLaunchResult) => {
                    const exitCode = typeof terminalLaunchResult === 'number' ? terminalLaunchResult : terminalLaunchResult?.code;
                    onData?.dispose();
                    onExit.dispose();
                    const key = task.getMapKey();
                    if (this._busyTasks[mapKey]) {
                        delete this._busyTasks[mapKey];
                    }
                    this._removeFromActiveTasks(task);
                    this._fireTaskEvent(TaskEvent.changed());
                    if (terminalLaunchResult !== undefined) {
                        // Only keep a reference to the terminal if it is not being disposed.
                        switch (task.command.presentation.panel) {
                            case PanelKind.Dedicated:
                                this._sameTaskTerminals[key] = terminal.instanceId.toString();
                                break;
                            case PanelKind.Shared:
                                this._idleTaskTerminals.set(key, terminal.instanceId.toString(), 1 /* Touch.AsOld */);
                                break;
                        }
                    }
                    const reveal = task.command.presentation.reveal;
                    if ((reveal === RevealKind.Silent) && ((exitCode !== 0) || (watchingProblemMatcher.numberOfMatches > 0) && watchingProblemMatcher.maxMarkerSeverity &&
                        (watchingProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error))) {
                        try {
                            this._terminalService.setActiveInstance(terminal);
                            this._terminalGroupService.showPanel(false);
                        }
                        catch (e) {
                            // If the terminal has already been disposed, then setting the active instance will fail. #99828
                            // There is nothing else to do here.
                        }
                    }
                    watchingProblemMatcher.done();
                    watchingProblemMatcher.dispose();
                    if (!processStartedSignaled) {
                        this._fireTaskEvent(TaskEvent.processStarted(task, terminal.instanceId, terminal.processId));
                        processStartedSignaled = true;
                    }
                    const durationMs = this._takeTaskDuration(terminal.instanceId);
                    this._fireTaskEvent(TaskEvent.processEnded(task, terminal.instanceId, exitCode, durationMs));
                    for (let i = 0; i < eventCounter; i++) {
                        this._fireTaskEvent(TaskEvent.inactive(task, terminal.instanceId));
                    }
                    eventCounter = 0;
                    this._fireTaskEvent(TaskEvent.general(TaskEventKind.End, task));
                    toDispose.dispose();
                    resolve({ exitCode: exitCode ?? undefined });
                });
            });
            if (trigger === Triggers.reconnect && !!terminal.xterm) {
                const bufferLines = [];
                const bufferReverseIterator = terminal.xterm.getBufferReverseIterator();
                const startRegex = new RegExp(watchingProblemMatcher.beginPatterns.map(pattern => pattern.source).join('|'));
                for (const nextLine of bufferReverseIterator) {
                    bufferLines.push(nextLine);
                    if (startRegex.test(nextLine)) {
                        break;
                    }
                }
                let delayer = undefined;
                for (let i = bufferLines.length - 1; i >= 0; i--) {
                    watchingProblemMatcher.processLine(bufferLines[i]);
                    if (!delayer) {
                        delayer = new Async.Delayer(3000);
                    }
                    delayer.trigger(() => {
                        watchingProblemMatcher.forceDelivery();
                        delayer = undefined;
                    });
                }
            }
        }
        else {
            [terminal, error] = await this._createTerminal(task, resolver, workspaceFolder);
            if (error) {
                return Promise.reject(new Error(error.message));
            }
            if (!terminal) {
                return Promise.reject(new Error(`Failed to create terminal for task ${task._label}`));
            }
            this._taskStartTimes.set(terminal.instanceId, Date.now());
            this._fireTaskEvent(TaskEvent.start(task, terminal.instanceId, resolver.values));
            const mapKey = task.getMapKey();
            this._busyTasks[mapKey] = task;
            this._fireTaskEvent(TaskEvent.general(TaskEventKind.Active, task, terminal.instanceId));
            const problemMatchers = await this._resolveMatchers(resolver, task.configurationProperties.problemMatchers);
            const startStopProblemMatcher = new StartStopProblemCollector(problemMatchers, this._markerService, this._modelService, 0 /* ProblemHandlingStrategy.Clean */, this._fileService);
            this._terminalStatusManager.addTerminal(task, terminal, startStopProblemMatcher);
            this._taskProblemMonitor.addTerminal(terminal, startStopProblemMatcher);
            this._register(startStopProblemMatcher.onDidStateChange((event) => {
                if (event.kind === "backgroundProcessingBegins" /* ProblemCollectorEventKind.BackgroundProcessingBegins */) {
                    this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherStarted, task, terminal?.instanceId));
                }
                else if (event.kind === "backgroundProcessingEnds" /* ProblemCollectorEventKind.BackgroundProcessingEnds */) {
                    if (startStopProblemMatcher.numberOfMatches && startStopProblemMatcher.maxMarkerSeverity && startStopProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error) {
                        this._taskErrors[task.getMapKey()] = true;
                        this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherFoundErrors, task, terminal?.instanceId));
                    }
                    else {
                        this._fireTaskEvent(TaskEvent.problemMatcherEnded(task, this._taskHasErrors(task), terminal?.instanceId));
                    }
                }
            }));
            let processStartedSignaled = false;
            terminal.processReady.then(() => {
                if (!processStartedSignaled) {
                    this._fireTaskEvent(TaskEvent.processStarted(task, terminal.instanceId, terminal.processId));
                    processStartedSignaled = true;
                }
            }, (_error) => {
                // The process never got ready. Need to think how to handle this.
            });
            const onData = terminal.onLineData((line) => {
                startStopProblemMatcher.processLine(line);
            });
            promise = new Promise((resolve, reject) => {
                const onExit = terminal.onExit((terminalLaunchResult) => {
                    const exitCode = typeof terminalLaunchResult === 'number' ? terminalLaunchResult : terminalLaunchResult?.code;
                    onExit.dispose();
                    const key = task.getMapKey();
                    this._removeFromActiveTasks(task);
                    this._fireTaskEvent(TaskEvent.changed());
                    if (terminalLaunchResult !== undefined) {
                        // Only keep a reference to the terminal if it is not being disposed.
                        switch (task.command.presentation.panel) {
                            case PanelKind.Dedicated:
                                this._sameTaskTerminals[key] = terminal.instanceId.toString();
                                break;
                            case PanelKind.Shared:
                                this._idleTaskTerminals.set(key, terminal.instanceId.toString(), 1 /* Touch.AsOld */);
                                break;
                        }
                    }
                    const reveal = task.command.presentation.reveal;
                    const revealProblems = task.command.presentation.revealProblems;
                    const revealProblemPanel = terminal && (revealProblems === RevealProblemKind.OnProblem) && (startStopProblemMatcher.numberOfMatches > 0);
                    if (revealProblemPanel) {
                        this._viewsService.openView(Markers.MARKERS_VIEW_ID);
                    }
                    else if (terminal && (reveal === RevealKind.Silent) && ((exitCode !== 0) || (startStopProblemMatcher.numberOfMatches > 0) && startStopProblemMatcher.maxMarkerSeverity &&
                        (startStopProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error))) {
                        try {
                            this._terminalService.setActiveInstance(terminal);
                            this._terminalGroupService.showPanel(false);
                        }
                        catch (e) {
                            // If the terminal has already been disposed, then setting the active instance will fail. #99828
                            // There is nothing else to do here.
                        }
                    }
                    // Hack to work around #92868 until terminal is fixed.
                    setTimeout(() => {
                        onData.dispose();
                        startStopProblemMatcher.done();
                        startStopProblemMatcher.dispose();
                    }, 100);
                    if (!processStartedSignaled && terminal) {
                        this._fireTaskEvent(TaskEvent.processStarted(task, terminal.instanceId, terminal.processId));
                        processStartedSignaled = true;
                    }
                    const durationMs = this._takeTaskDuration(terminal?.instanceId);
                    this._fireTaskEvent(TaskEvent.processEnded(task, terminal?.instanceId, exitCode ?? undefined, durationMs));
                    if (this._busyTasks[mapKey]) {
                        delete this._busyTasks[mapKey];
                    }
                    this._fireTaskEvent(TaskEvent.inactive(task, terminal?.instanceId, durationMs));
                    if (startStopProblemMatcher.numberOfMatches && startStopProblemMatcher.maxMarkerSeverity && startStopProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error) {
                        this._taskErrors[task.getMapKey()] = true;
                        this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherFoundErrors, task, terminal?.instanceId));
                    }
                    else {
                        this._fireTaskEvent(TaskEvent.problemMatcherEnded(task, this._taskHasErrors(task), terminal?.instanceId));
                    }
                    this._fireTaskEvent(TaskEvent.general(TaskEventKind.End, task, terminal?.instanceId));
                    this._cleanupTaskTracking(task);
                    resolve({ exitCode: exitCode ?? undefined });
                });
            });
        }
        const showProblemPanel = task.command.presentation && (task.command.presentation.revealProblems === RevealProblemKind.Always);
        if (showProblemPanel) {
            this._viewsService.openView(Markers.MARKERS_VIEW_ID);
        }
        else if (task.command.presentation && (task.command.presentation.focus || task.command.presentation.reveal === RevealKind.Always)) {
            this._terminalService.setActiveInstance(terminal);
            await this._terminalService.revealTerminal(terminal);
            if (task.command.presentation.focus) {
                this._terminalService.focusInstance(terminal);
            }
        }
        if (this._activeTasks[task.getMapKey()]) {
            this._activeTasks[task.getMapKey()].terminal = terminal;
        }
        else {
            this._logService.warn('No active tasks found for the terminal.');
        }
        this._fireTaskEvent(TaskEvent.changed());
        return promise;
    }
    _takeTaskDuration(terminalId) {
        if (terminalId === undefined) {
            return undefined;
        }
        const startTime = this._taskStartTimes.get(terminalId);
        if (startTime === undefined) {
            return undefined;
        }
        this._taskStartTimes.delete(terminalId);
        return Date.now() - startTime;
    }
    _createTerminalName(task) {
        const needsFolderQualification = this._contextService.getWorkbenchState() === 3 /* WorkbenchState.WORKSPACE */;
        return needsFolderQualification ? task.getQualifiedLabel() : (task.configurationProperties.name || '');
    }
    async _createShellLaunchConfig(task, workspaceFolder, variableResolver, platform, options, command, args, waitOnExit, presentationOptions) {
        let shellLaunchConfig;
        const isShellCommand = task.command.runtime === RuntimeType.Shell;
        const needsFolderQualification = this._contextService.getWorkbenchState() === 3 /* WorkbenchState.WORKSPACE */;
        const terminalName = this._createTerminalName(task);
        const type = TaskTerminalType;
        const originalCommand = task.command.name;
        let cwd;
        if (options.cwd) {
            cwd = options.cwd;
            if (!path.isAbsolute(cwd)) {
                if (workspaceFolder && (workspaceFolder.uri.scheme === Schemas.file)) {
                    cwd = path.join(workspaceFolder.uri.fsPath, cwd);
                }
            }
            // This must be normalized to the OS
            cwd = isUNC(cwd) ? cwd : resources.toLocalResource(URI.from({ scheme: Schemas.file, path: cwd }), this._environmentService.remoteAuthority, this._pathService.defaultUriScheme);
        }
        if (isShellCommand) {
            let os;
            switch (platform) {
                case 3 /* Platform.Platform.Windows */:
                    os = 1 /* Platform.OperatingSystem.Windows */;
                    break;
                case 1 /* Platform.Platform.Mac */:
                    os = 2 /* Platform.OperatingSystem.Macintosh */;
                    break;
                case 2 /* Platform.Platform.Linux */:
                default:
                    os = 3 /* Platform.OperatingSystem.Linux */;
                    break;
            }
            const defaultProfile = await this._terminalProfileResolverService.getDefaultProfile({
                allowAutomationShell: true,
                os,
                remoteAuthority: this._environmentService.remoteAuthority
            });
            let icon;
            if (task.configurationProperties.icon?.id) {
                icon = ThemeIcon.fromId(task.configurationProperties.icon.id);
            }
            else {
                const taskGroupKind = task.configurationProperties.group ? GroupKind.to(task.configurationProperties.group) : undefined;
                const kindId = typeof taskGroupKind === 'string' ? taskGroupKind : taskGroupKind?.kind;
                icon = kindId === 'test' ? ThemeIcon.fromId(Codicon.beaker.id) : defaultProfile.icon;
            }
            shellLaunchConfig = {
                name: terminalName,
                type,
                executable: defaultProfile.path,
                args: defaultProfile.args,
                env: { ...defaultProfile.env },
                icon,
                color: task.configurationProperties.icon?.color || undefined,
                waitOnExit
            };
            let shellSpecified = false;
            const shellOptions = task.command.options && task.command.options.shell;
            if (shellOptions) {
                if (shellOptions.executable) {
                    // Clear out the args so that we don't end up with mismatched args.
                    if (shellOptions.executable !== shellLaunchConfig.executable) {
                        shellLaunchConfig.args = undefined;
                    }
                    shellLaunchConfig.executable = await this._resolveVariable(variableResolver, shellOptions.executable);
                    shellSpecified = true;
                }
                if (shellOptions.args) {
                    shellLaunchConfig.args = await this._resolveVariables(variableResolver, shellOptions.args.slice());
                }
            }
            if (shellLaunchConfig.args === undefined) {
                shellLaunchConfig.args = [];
            }
            const shellArgs = Array.isArray(shellLaunchConfig.args) ? shellLaunchConfig.args.slice(0) : [shellLaunchConfig.args];
            const toAdd = [];
            const basename = path.posix.basename((await this._pathService.fileURI(shellLaunchConfig.executable)).path).toLowerCase();
            const commandLine = this._buildShellCommandLine(platform, basename, shellOptions, command, originalCommand, args);
            let windowsShellArgs = false;
            if (platform === 3 /* Platform.Platform.Windows */) {
                windowsShellArgs = true;
                // If we don't have a cwd, then the terminal uses the home dir.
                const userHome = await this._pathService.userHome();
                if (basename === 'cmd.exe' && ((options.cwd && isUNC(options.cwd)) || (!options.cwd && isUNC(userHome.fsPath)))) {
                    return undefined;
                }
                if ((basename === 'powershell.exe') || (basename === 'pwsh.exe')) {
                    if (!shellSpecified) {
                        toAdd.push('-Command');
                    }
                }
                else if ((basename === 'bash.exe') || (basename === 'zsh.exe')) {
                    windowsShellArgs = false;
                    if (!shellSpecified) {
                        toAdd.push('-c');
                    }
                }
                else if (basename === 'wsl.exe') {
                    if (!shellSpecified) {
                        toAdd.push('-e');
                    }
                }
                else if (basename === 'nu.exe') {
                    if (!shellSpecified) {
                        toAdd.push('-c');
                    }
                }
                else {
                    if (!shellSpecified) {
                        toAdd.push('/d', '/c');
                    }
                }
            }
            else {
                if (!shellSpecified) {
                    // Under Mac remove -l to not start it as a login shell.
                    if (platform === 1 /* Platform.Platform.Mac */) {
                        // Background on -l on osx https://github.com/microsoft/vscode/issues/107563
                        // TODO: Handle by pulling the default terminal profile?
                        // const osxShellArgs = this._configurationService.inspect(TerminalSettingId.ShellArgsMacOs);
                        // if ((osxShellArgs.user === undefined) && (osxShellArgs.userLocal === undefined) && (osxShellArgs.userLocalValue === undefined)
                        // 	&& (osxShellArgs.userRemote === undefined) && (osxShellArgs.userRemoteValue === undefined)
                        // 	&& (osxShellArgs.userValue === undefined) && (osxShellArgs.workspace === undefined)
                        // 	&& (osxShellArgs.workspaceFolder === undefined) && (osxShellArgs.workspaceFolderValue === undefined)
                        // 	&& (osxShellArgs.workspaceValue === undefined)) {
                        // 	const index = shellArgs.indexOf('-l');
                        // 	if (index !== -1) {
                        // 		shellArgs.splice(index, 1);
                        // 	}
                        // }
                    }
                    toAdd.push('-c');
                }
            }
            const combinedShellArgs = this._addAllArgument(toAdd, shellArgs);
            combinedShellArgs.push(commandLine);
            shellLaunchConfig.shellIntegrationNonce = generateUuid();
            const commandLineInfo = {
                commandLine,
                nonce: shellLaunchConfig.shellIntegrationNonce
            };
            shellLaunchConfig.args = windowsShellArgs ? combinedShellArgs.join(' ') : combinedShellArgs;
            if (task.command.presentation && task.command.presentation.echo) {
                if (needsFolderQualification && workspaceFolder) {
                    const folder = cwd && typeof cwd === 'object' && 'path' in cwd ? path.basename(cwd.path) : workspaceFolder.name;
                    shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence(cwd) + formatMessageForTerminal(nls.localize({
                        key: 'task.executingInFolder',
                        comment: ['The workspace folder the task is running in', 'The task command line or label']
                    }, 'Executing task in folder {0}: {1}', folder, commandLine), { excludeLeadingNewLine: true }) + this.getTaskShellIntegrationOutputSequence(commandLineInfo);
                }
                else {
                    shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence(cwd) + formatMessageForTerminal(nls.localize({
                        key: 'task.executing.shellIntegration',
                        comment: ['The task command line or label']
                    }, 'Executing task: {0}', commandLine), { excludeLeadingNewLine: true }) + this.getTaskShellIntegrationOutputSequence(commandLineInfo);
                }
            }
            else {
                shellLaunchConfig.initialText = {
                    text: this.taskShellIntegrationStartSequence(cwd) + this.getTaskShellIntegrationOutputSequence(commandLineInfo),
                    trailingNewLine: false
                };
            }
        }
        else {
            const commandExecutable = (task.command.runtime !== RuntimeType.CustomExecution) ? CommandString.value(command) : undefined;
            const executable = !isShellCommand
                ? await this._resolveVariable(variableResolver, await this._resolveVariable(variableResolver, '${' + TerminalTaskSystem.ProcessVarName + '}'))
                : commandExecutable;
            // When we have a process task there is no need to quote arguments. So we go ahead and take the string value.
            shellLaunchConfig = {
                name: terminalName,
                type,
                icon: task.configurationProperties.icon?.id ? ThemeIcon.fromId(task.configurationProperties.icon.id) : undefined,
                color: task.configurationProperties.icon?.color || undefined,
                executable: executable,
                args: args.map(a => Types.isString(a) ? a : a.value),
                waitOnExit
            };
            if (task.command.presentation && task.command.presentation.echo) {
                const getArgsToEcho = (args) => {
                    if (!args || args.length === 0) {
                        return '';
                    }
                    if (Types.isString(args)) {
                        return args;
                    }
                    return args.join(' ');
                };
                if (needsFolderQualification && workspaceFolder) {
                    shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence(cwd) + formatMessageForTerminal(nls.localize({
                        key: 'task.executingInFolder',
                        comment: ['The workspace folder the task is running in', 'The task command line or label']
                    }, 'Executing task in folder {0}: {1}', workspaceFolder.name, `${shellLaunchConfig.executable} ${getArgsToEcho(shellLaunchConfig.args)}`), { excludeLeadingNewLine: true }) + this.getTaskShellIntegrationOutputSequence(undefined);
                }
                else {
                    shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence(cwd) + formatMessageForTerminal(nls.localize({
                        key: 'task.executing.shell-integration',
                        comment: ['The task command line or label']
                    }, 'Executing task: {0}', `${shellLaunchConfig.executable} ${getArgsToEcho(shellLaunchConfig.args)}`), { excludeLeadingNewLine: true }) + this.getTaskShellIntegrationOutputSequence(undefined);
                }
            }
            else {
                shellLaunchConfig.initialText = {
                    text: this.taskShellIntegrationStartSequence(cwd) + this.getTaskShellIntegrationOutputSequence(undefined),
                    trailingNewLine: false
                };
            }
        }
        if (cwd) {
            shellLaunchConfig.cwd = cwd;
        }
        if (options.env) {
            if (shellLaunchConfig.env) {
                shellLaunchConfig.env = { ...shellLaunchConfig.env, ...options.env };
            }
            else {
                shellLaunchConfig.env = options.env;
            }
        }
        shellLaunchConfig.isFeatureTerminal = true;
        shellLaunchConfig.useShellEnvironment = true;
        shellLaunchConfig.tabActions = this._terminalTabActions;
        return shellLaunchConfig;
    }
    _addAllArgument(shellCommandArgs, configuredShellArgs) {
        const combinedShellArgs = Objects.deepClone(configuredShellArgs);
        shellCommandArgs.forEach(element => {
            const shouldAddShellCommandArg = configuredShellArgs.every((arg, index) => {
                if ((arg.toLowerCase() === element) && (configuredShellArgs.length > index + 1)) {
                    // We can still add the argument, but only if not all of the following arguments begin with "-".
                    return !configuredShellArgs.slice(index + 1).every(testArg => testArg.startsWith('-'));
                }
                else {
                    return arg.toLowerCase() !== element;
                }
            });
            if (shouldAddShellCommandArg) {
                combinedShellArgs.push(element);
            }
        });
        return combinedShellArgs;
    }
    async _reconnectToTerminal(task) {
        const reconnectedInstances = this._terminalService.instances.filter(e => e.reconnectionProperties?.ownerId === TaskTerminalType);
        return reconnectedInstances.find(e => getReconnectionData(e)?.lastTask === task.getCommonTaskId());
    }
    async _doCreateTerminal(task, group, launchConfigs) {
        const reconnectedTerminal = await this._reconnectToTerminal(task);
        const onDisposed = (terminal) => this._fireTaskEvent(TaskEvent.terminated(task, terminal.instanceId, terminal.exitReason));
        if (reconnectedTerminal) {
            if ('command' in task && task.command.presentation) {
                reconnectedTerminal.waitOnExit = getWaitOnExitValue(task.command.presentation, task.configurationProperties);
            }
            this._register(reconnectedTerminal.onDisposed(onDisposed));
            this._logService.trace('reconnected to task and terminal', task._id);
            return reconnectedTerminal;
        }
        if (group) {
            // Try to find an existing terminal to split.
            // Even if an existing terminal is found, the split can fail if the terminal width is too small.
            for (const terminal of Object.values(this._terminals)) {
                if (terminal.group === group) {
                    this._logService.trace(`Found terminal to split for group ${group}`);
                    const originalInstance = terminal.terminal;
                    const result = await this._terminalService.createTerminal({ location: { parentTerminal: originalInstance }, config: launchConfigs });
                    this._register(result.onDisposed(onDisposed));
                    if (result) {
                        return result;
                    }
                }
            }
            this._logService.trace(`No terminal found to split for group ${group}`);
        }
        // Either no group is used, no terminal with the group exists or splitting an existing terminal failed.
        const createdTerminal = await this._terminalService.createTerminal({ config: launchConfigs });
        this._register(createdTerminal.onDisposed(onDisposed));
        return createdTerminal;
    }
    _reconnectToTerminals() {
        if (this._hasReconnected) {
            this._logService.trace(`Already reconnected to terminals, so returning`);
            return;
        }
        const reconnectedInstances = this._terminalService.instances.filter(e => e.reconnectionProperties?.ownerId === TaskTerminalType);
        this._logService.trace(`Attempting reconnection of ${reconnectedInstances.length} terminals`);
        if (!reconnectedInstances.length) {
            this._logService.trace(`No terminals to reconnect to so returning`);
        }
        else {
            for (const terminal of reconnectedInstances) {
                const data = getReconnectionData(terminal);
                if (data) {
                    const terminalData = { lastTask: data.lastTask, group: data.group, terminal, shellIntegrationNonce: data.shellIntegrationNonce };
                    this._terminals[terminal.instanceId] = terminalData;
                    this._logService.trace('Reconnecting to task terminal', terminalData.lastTask, terminal.instanceId);
                }
            }
        }
        this._hasReconnected = true;
    }
    _deleteTaskAndTerminal(terminal, terminalData) {
        delete this._terminals[terminal.instanceId];
        delete this._sameTaskTerminals[terminalData.lastTask];
        this._idleTaskTerminals.delete(terminalData.lastTask);
        // Delete the task now as a work around for cases when the onExit isn't fired.
        // This can happen if the terminal wasn't shutdown with an "immediate" flag and is expected.
        // For correct terminal re-use, the task needs to be deleted immediately.
        // Note that this shouldn't be a problem anymore since user initiated terminal kills are now immediate.
        const mapKey = terminalData.lastTask;
        this._removeFromActiveTasks(mapKey);
        if (this._busyTasks[mapKey]) {
            delete this._busyTasks[mapKey];
        }
    }
    async _createTerminal(task, resolver, workspaceFolder) {
        const platform = resolver.taskSystemInfo ? resolver.taskSystemInfo.platform : Platform.platform;
        const options = await this._resolveOptions(resolver, task.command.options);
        const presentationOptions = task.command.presentation;
        if (!presentationOptions) {
            throw new Error('Task presentation options should not be undefined here.');
        }
        const waitOnExit = getWaitOnExitValue(presentationOptions, task.configurationProperties);
        let command;
        let args;
        let launchConfigs;
        if (task.command.runtime === RuntimeType.CustomExecution) {
            this._currentTask.shellLaunchConfig = launchConfigs = {
                customPtyImplementation: (id, cols, rows) => new TerminalProcessExtHostProxy(id, cols, rows, this._terminalService),
                waitOnExit,
                name: this._createTerminalName(task),
                initialText: task.command.presentation && task.command.presentation.echo ? formatMessageForTerminal(nls.localize({
                    key: 'task.executing',
                    comment: ['The task command line or label']
                }, 'Executing task: {0}', task._label), { excludeLeadingNewLine: true }) : undefined,
                isFeatureTerminal: true,
                icon: task.configurationProperties.icon?.id ? ThemeIcon.fromId(task.configurationProperties.icon.id) : undefined,
                color: task.configurationProperties.icon?.color || undefined,
            };
        }
        else {
            const resolvedResult = await this._resolveCommandAndArgs(resolver, task.command);
            command = resolvedResult.command;
            args = resolvedResult.args;
            this._currentTask.shellLaunchConfig = launchConfigs = await this._createShellLaunchConfig(task, workspaceFolder, resolver, platform, options, command, args, waitOnExit, presentationOptions);
            if (launchConfigs === undefined) {
                return [undefined, new TaskError(Severity.Error, nls.localize('TerminalTaskSystem', 'Can\'t execute a shell command on an UNC drive using cmd.exe.'), 7 /* TaskErrors.UnknownError */)];
            }
        }
        const prefersSameTerminal = presentationOptions.panel === PanelKind.Dedicated;
        const allowsSharedTerminal = presentationOptions.panel === PanelKind.Shared;
        const group = presentationOptions.group;
        const taskKey = task.getMapKey();
        let terminalToReuse;
        if (prefersSameTerminal) {
            const terminalId = this._sameTaskTerminals[taskKey];
            if (terminalId) {
                terminalToReuse = this._terminals[terminalId];
                delete this._sameTaskTerminals[taskKey];
            }
        }
        else if (allowsSharedTerminal) {
            // Always allow to reuse the terminal previously used by the same task.
            let terminalId = this._idleTaskTerminals.remove(taskKey);
            if (!terminalId) {
                // There is no idle terminal which was used by the same task.
                // Search for any idle terminal used previously by a task of the same group
                // (or, if the task has no group, a terminal used by a task without group).
                for (const taskId of this._idleTaskTerminals.keys()) {
                    const idleTerminalId = this._idleTaskTerminals.get(taskId);
                    if (idleTerminalId && this._terminals[idleTerminalId] && this._terminals[idleTerminalId].group === group) {
                        terminalId = this._idleTaskTerminals.remove(taskId);
                        break;
                    }
                }
            }
            if (terminalId) {
                terminalToReuse = this._terminals[terminalId];
            }
        }
        if (terminalToReuse) {
            if (!launchConfigs) {
                throw new Error('Task shell launch configuration should not be undefined here.');
            }
            terminalToReuse.terminal.scrollToBottom();
            if (task.configurationProperties.isBackground) {
                launchConfigs.reconnectionProperties = { ownerId: TaskTerminalType, data: { lastTask: task.getCommonTaskId(), group, label: task._label, id: task._id } };
            }
            // HACK: Rewrite the nonce in initialText only for reused terminals, this ensures the
            // command line sequence reports the correct nonce and becomes trusted as a result.
            if (terminalToReuse.shellIntegrationNonce) {
                if (Types.isString(launchConfigs.initialText) && launchConfigs.shellIntegrationNonce) {
                    launchConfigs.initialText = launchConfigs.initialText.replace(launchConfigs.shellIntegrationNonce, terminalToReuse.shellIntegrationNonce);
                }
            }
            await terminalToReuse.terminal.reuseTerminal(launchConfigs);
            if (task.command.presentation && task.command.presentation.clear) {
                terminalToReuse.terminal.clearBuffer();
            }
            this._terminals[terminalToReuse.terminal.instanceId.toString()].lastTask = taskKey;
            return [terminalToReuse.terminal, undefined];
        }
        this._terminalCreationQueue = this._terminalCreationQueue.then(() => this._doCreateTerminal(task, group, launchConfigs));
        const terminal = (await this._terminalCreationQueue);
        if (task.configurationProperties.isBackground) {
            terminal.shellLaunchConfig.reconnectionProperties = { ownerId: TaskTerminalType, data: { lastTask: task.getCommonTaskId(), group, label: task._label, id: task._id } };
        }
        const terminalKey = terminal.instanceId.toString();
        const terminalData = { terminal: terminal, lastTask: taskKey, group, shellIntegrationNonce: terminal.shellLaunchConfig.shellIntegrationNonce };
        const onDisposedListener = this._register(terminal.onDisposed(() => {
            this._deleteTaskAndTerminal(terminal, terminalData);
            onDisposedListener.dispose();
        }));
        this._terminals[terminalKey] = terminalData;
        terminal.shellLaunchConfig.tabActions = this._terminalTabActions;
        return [terminal, undefined];
    }
    _buildShellCommandLine(platform, shellExecutable, shellOptions, command, originalCommand, args) {
        const basename = path.parse(shellExecutable).name.toLowerCase();
        const shellQuoteOptions = this._getQuotingOptions(basename, shellOptions, platform);
        function needsQuotes(value) {
            if (value.length >= 2) {
                const first = value[0] === shellQuoteOptions.strong ? shellQuoteOptions.strong : value[0] === shellQuoteOptions.weak ? shellQuoteOptions.weak : undefined;
                if (first === value[value.length - 1]) {
                    return false;
                }
            }
            let quote;
            for (let i = 0; i < value.length; i++) {
                // We found the end quote.
                const ch = value[i];
                if (ch === quote) {
                    quote = undefined;
                }
                else if (quote !== undefined) {
                    // skip the character. We are quoted.
                    continue;
                }
                else if (ch === shellQuoteOptions.escape) {
                    // Skip the next character
                    i++;
                }
                else if (ch === shellQuoteOptions.strong || ch === shellQuoteOptions.weak) {
                    quote = ch;
                }
                else if (ch === ' ') {
                    return true;
                }
            }
            return false;
        }
        function quote(value, kind) {
            if (kind === ShellQuoting.Strong && shellQuoteOptions.strong) {
                return [shellQuoteOptions.strong + value + shellQuoteOptions.strong, true];
            }
            else if (kind === ShellQuoting.Weak && shellQuoteOptions.weak) {
                return [shellQuoteOptions.weak + value + shellQuoteOptions.weak, true];
            }
            else if (kind === ShellQuoting.Escape && shellQuoteOptions.escape) {
                if (Types.isString(shellQuoteOptions.escape)) {
                    return [value.replace(/ /g, shellQuoteOptions.escape + ' '), true];
                }
                else {
                    const buffer = [];
                    for (const ch of shellQuoteOptions.escape.charsToEscape) {
                        buffer.push(`\\${ch}`);
                    }
                    const regexp = new RegExp('[' + buffer.join(',') + ']', 'g');
                    const escapeChar = shellQuoteOptions.escape.escapeChar;
                    return [value.replace(regexp, (match) => escapeChar + match), true];
                }
            }
            return [value, false];
        }
        function quoteIfNecessary(value) {
            if (Types.isString(value)) {
                if (needsQuotes(value)) {
                    return quote(value, ShellQuoting.Strong);
                }
                else {
                    return [value, false];
                }
            }
            else {
                return quote(value.value, value.quoting);
            }
        }
        // If we have no args and the command is a string then use the command to stay backwards compatible with the old command line
        // model. To allow variable resolving with spaces we do continue if the resolved value is different than the original one
        // and the resolved one needs quoting.
        if ((!args || args.length === 0) && Types.isString(command) && (command === originalCommand || needsQuotes(originalCommand))) {
            return command;
        }
        const result = [];
        let commandQuoted = false;
        let argQuoted = false;
        let value;
        let quoted;
        [value, quoted] = quoteIfNecessary(command);
        result.push(value);
        commandQuoted = quoted;
        for (const arg of args) {
            [value, quoted] = quoteIfNecessary(arg);
            result.push(value);
            argQuoted = argQuoted || quoted;
        }
        let commandLine = result.join(' ');
        // There are special rules quoted command line in cmd.exe
        if (platform === 3 /* Platform.Platform.Windows */) {
            if (basename === 'cmd' && commandQuoted && argQuoted) {
                commandLine = '"' + commandLine + '"';
            }
            else if ((basename === 'powershell' || basename === 'pwsh') && commandQuoted) {
                commandLine = '& ' + commandLine;
            }
        }
        return commandLine;
    }
    _getQuotingOptions(shellBasename, shellOptions, platform) {
        if (shellOptions && shellOptions.quoting) {
            return shellOptions.quoting;
        }
        return TerminalTaskSystem._shellQuotes[shellBasename] || TerminalTaskSystem._osShellQuotes[Platform.PlatformToString(platform)];
    }
    _collectTaskVariables(variables, task) {
        if (task.command && task.command.name) {
            this._collectCommandVariables(variables, task.command, task);
        }
        this._collectMatcherVariables(variables, task.configurationProperties.problemMatchers);
        if (task.command.runtime === RuntimeType.CustomExecution && (CustomTask.is(task) || ContributedTask.is(task))) {
            let definition;
            if (CustomTask.is(task)) {
                definition = task._source.config.element;
            }
            else {
                definition = Objects.deepClone(task.defines);
                delete definition._key;
                delete definition.type;
            }
            this._collectDefinitionVariables(variables, definition);
        }
    }
    _collectDefinitionVariables(variables, definition) {
        if (Types.isString(definition)) {
            this._collectVariables(variables, definition);
        }
        else if (Array.isArray(definition)) {
            definition.forEach((element) => this._collectDefinitionVariables(variables, element));
        }
        else if (Types.isObject(definition)) {
            for (const key in definition) {
                this._collectDefinitionVariables(variables, definition[key]);
            }
        }
    }
    _collectCommandVariables(variables, command, task) {
        // The custom execution should have everything it needs already as it provided
        // the callback.
        if (command.runtime === RuntimeType.CustomExecution) {
            return;
        }
        if (command.name === undefined) {
            throw new Error('Command name should never be undefined here.');
        }
        this._collectVariables(variables, command.name);
        command.args?.forEach(arg => this._collectVariables(variables, arg));
        // Try to get a scope.
        const scope = task._source.scope;
        if (scope !== 1 /* TaskScope.Global */) {
            variables.add('${workspaceFolder}');
        }
        if (command.options) {
            const options = command.options;
            if (options.cwd) {
                this._collectVariables(variables, options.cwd);
            }
            const optionsEnv = options.env;
            if (optionsEnv) {
                Object.keys(optionsEnv).forEach((key) => {
                    const value = optionsEnv[key];
                    if (Types.isString(value)) {
                        this._collectVariables(variables, value);
                    }
                });
            }
            if (options.shell) {
                if (options.shell.executable) {
                    this._collectVariables(variables, options.shell.executable);
                }
                options.shell.args?.forEach(arg => this._collectVariables(variables, arg));
            }
        }
    }
    _collectMatcherVariables(variables, values) {
        if (values === undefined || values === null || values.length === 0) {
            return;
        }
        values.forEach((value) => {
            let matcher;
            if (Types.isString(value)) {
                if (value[0] === '$') {
                    matcher = ProblemMatcherRegistry.get(value.substring(1));
                }
                else {
                    matcher = ProblemMatcherRegistry.get(value);
                }
            }
            else {
                matcher = value;
            }
            if (matcher && matcher.filePrefix) {
                if (Types.isString(matcher.filePrefix)) {
                    this._collectVariables(variables, matcher.filePrefix);
                }
                else {
                    for (const fp of [...asArray(matcher.filePrefix.include || []), ...asArray(matcher.filePrefix.exclude || [])]) {
                        this._collectVariables(variables, fp);
                    }
                }
            }
        });
    }
    _collectVariables(variables, value) {
        const string = Types.isString(value) ? value : value.value;
        const r = /\$\{(.*?)\}/g;
        let matches;
        do {
            matches = r.exec(string);
            if (matches) {
                variables.add(matches[0]);
            }
        } while (matches);
    }
    async _resolveCommandAndArgs(resolver, commandConfig) {
        // First we need to use the command args:
        let args = commandConfig.args ? commandConfig.args.slice() : [];
        args = await this._resolveVariables(resolver, args);
        const command = await this._resolveVariable(resolver, commandConfig.name);
        return { command, args };
    }
    async _resolveVariables(resolver, value) {
        return Promise.all(value.map(s => this._resolveVariable(resolver, s)));
    }
    async _resolveMatchers(resolver, values) {
        if (values === undefined || values === null || values.length === 0) {
            return [];
        }
        const result = [];
        for (const value of values) {
            let matcher;
            if (Types.isString(value)) {
                if (value[0] === '$') {
                    matcher = ProblemMatcherRegistry.get(value.substring(1));
                }
                else {
                    matcher = ProblemMatcherRegistry.get(value);
                }
            }
            else {
                matcher = value;
            }
            if (!matcher) {
                this._appendOutput(nls.localize('unknownProblemMatcher', 'Problem matcher {0} can\'t be resolved. The matcher will be ignored'));
                continue;
            }
            const taskSystemInfo = resolver.taskSystemInfo;
            const hasFilePrefix = matcher.filePrefix !== undefined;
            const hasUriProvider = taskSystemInfo !== undefined && taskSystemInfo.uriProvider !== undefined;
            if (!hasFilePrefix && !hasUriProvider) {
                result.push(matcher);
            }
            else {
                const copy = Objects.deepClone(matcher);
                if (hasUriProvider && (taskSystemInfo !== undefined)) {
                    copy.uriProvider = taskSystemInfo.uriProvider;
                }
                if (hasFilePrefix) {
                    const filePrefix = copy.filePrefix;
                    if (Types.isString(filePrefix)) {
                        copy.filePrefix = await this._resolveVariable(resolver, filePrefix);
                    }
                    else if (filePrefix !== undefined) {
                        if (filePrefix.include) {
                            filePrefix.include = Array.isArray(filePrefix.include)
                                ? await Promise.all(filePrefix.include.map(x => this._resolveVariable(resolver, x)))
                                : await this._resolveVariable(resolver, filePrefix.include);
                        }
                        if (filePrefix.exclude) {
                            filePrefix.exclude = Array.isArray(filePrefix.exclude)
                                ? await Promise.all(filePrefix.exclude.map(x => this._resolveVariable(resolver, x)))
                                : await this._resolveVariable(resolver, filePrefix.exclude);
                        }
                    }
                }
                result.push(copy);
            }
        }
        return result;
    }
    async _resolveVariable(resolver, value) {
        // TODO@Dirk Task.getWorkspaceFolder should return a WorkspaceFolder that is defined in workspace.ts
        if (Types.isString(value)) {
            return resolver.resolve(value);
        }
        else if (value !== undefined) {
            return {
                value: await resolver.resolve(value.value),
                quoting: value.quoting
            };
        }
        else { // This should never happen
            throw new Error('Should never try to resolve undefined.');
        }
    }
    async _resolveOptions(resolver, options) {
        if (options === undefined || options === null) {
            let cwd;
            try {
                cwd = await this._resolveVariable(resolver, '${workspaceFolder}');
            }
            catch (e) {
                // No workspace
            }
            return { cwd };
        }
        const result = Types.isString(options.cwd)
            ? { cwd: await this._resolveVariable(resolver, options.cwd) }
            : { cwd: await this._resolveVariable(resolver, '${workspaceFolder}') };
        if (options.env) {
            result.env = Object.create(null);
            for (const key of Object.keys(options.env)) {
                const value = options.env[key];
                if (Types.isString(value)) {
                    result.env[key] = await this._resolveVariable(resolver, value);
                }
                else {
                    result.env[key] = value.toString();
                }
            }
        }
        return result;
    }
    static { this.WellKnownCommands = {
        'ant': true,
        'cmake': true,
        'eslint': true,
        'gradle': true,
        'grunt': true,
        'gulp': true,
        'jake': true,
        'jenkins': true,
        'jshint': true,
        'make': true,
        'maven': true,
        'msbuild': true,
        'msc': true,
        'nmake': true,
        'npm': true,
        'rake': true,
        'tsc': true,
        'xbuild': true
    }; }
    getSanitizedCommand(cmd) {
        let result = cmd.toLowerCase();
        const index = result.lastIndexOf(path.sep);
        if (index !== -1) {
            result = result.substring(index + 1);
        }
        if (TerminalTaskSystem.WellKnownCommands[result]) {
            return result;
        }
        return 'other';
    }
    async getTaskForTerminal(instanceId) {
        // First check if there's an active task for this terminal
        for (const key in this._activeTasks) {
            const activeTask = this._activeTasks[key];
            if (activeTask.terminal?.instanceId === instanceId) {
                return activeTask.task;
            }
        }
        // If no active task, check the terminals map for the last task that ran in this terminal
        const terminalData = this._terminals[instanceId.toString()];
        if (terminalData?.lastTask) {
            // Look up the task using the callback provided by the task service
            return await this._taskLookup(terminalData.lastTask);
        }
        return undefined;
    }
    _appendOutput(output) {
        const outputChannel = this._outputService.getChannel(this._outputChannelId);
        outputChannel?.append(output);
    }
}
function getWaitOnExitValue(presentationOptions, configurationProperties) {
    if ((presentationOptions.close === undefined) || (presentationOptions.close === false)) {
        if ((presentationOptions.reveal !== RevealKind.Never) || !configurationProperties.isBackground || (presentationOptions.close === false)) {
            if (presentationOptions.panel === PanelKind.New) {
                return taskShellIntegrationWaitOnExitSequence(nls.localize('closeTerminal', 'Press any key to close the terminal.'));
            }
            else if (presentationOptions.showReuseMessage) {
                return taskShellIntegrationWaitOnExitSequence(nls.localize('reuseTerminal', 'Terminal will be reused by tasks, press any key to close it.'));
            }
            else {
                return true;
            }
        }
    }
    return !presentationOptions.close;
}
function taskShellIntegrationWaitOnExitSequence(message) {
    return (exitCode) => {
        return `${VSCodeSequence("D" /* VSCodeOscPt.CommandFinished */, exitCode.toString())}${message}`;
    };
}
function getReconnectionData(terminal) {
    return terminal.shellLaunchConfig.attachPersistentProcess?.reconnectionProperties?.data;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxUYXNrU3lzdGVtLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rhc2tzL2Jyb3dzZXIvdGVybWluYWxUYXNrU3lzdGVtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM1RCxPQUFPLEtBQUssS0FBSyxNQUFNLGtDQUFrQyxDQUFDO0FBRTFELE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDM0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRyxPQUFPLEVBQUUsU0FBUyxFQUFTLE1BQU0sZ0NBQWdDLENBQUM7QUFDbEUsT0FBTyxLQUFLLE9BQU8sTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RCxPQUFPLEtBQUssSUFBSSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3hELE9BQU8sS0FBSyxRQUFRLE1BQU0scUNBQXFDLENBQUM7QUFDaEUsT0FBTyxLQUFLLFNBQVMsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLFFBQVEsTUFBTSxxQ0FBcUMsQ0FBQztBQUMzRCxPQUFPLEtBQUssS0FBSyxNQUFNLGtDQUFrQyxDQUFDO0FBQzFELE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFJMUMsT0FBTyxFQUErQixjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUU3RyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDMUQsT0FBTyxFQUFrQixzQkFBc0IsQ0FBQyxrQ0FBa0MsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBRXhILE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUtyRCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUduRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUM3RCxPQUFPLEVBQXNELHlCQUF5QixFQUFFLHdCQUF3QixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDekosT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzNELE9BQU8sRUFBbUssU0FBUyxFQUErQixRQUFRLEVBQUUsWUFBWSxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDMVEsT0FBTyxFQUFrQixhQUFhLEVBQUUsZUFBZSxFQUFFLFVBQVUsRUFBb0ssWUFBWSxFQUFFLFNBQVMsRUFBRSwrQkFBK0IsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxvQkFBb0IsRUFBUSxTQUFTLEVBQUUsYUFBYSxFQUFhLGNBQWMsRUFBRSxhQUFhLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUV0ZCxPQUFPLEVBQWtDLGNBQWMsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ25ILE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3BHLE9BQU8sRUFBbUMsZ0JBQWdCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQU90RyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDL0QsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0scUVBQXFFLENBQUM7QUE2QmhILE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxDQUFDO0FBRWhDLE1BQU0sZ0JBQWdCO2FBQ04sV0FBTSxHQUFHLGNBQWMsQ0FBQztJQUN2QyxZQUFtQixlQUE2QyxFQUFTLGNBQTJDLEVBQWtCLE1BQTJCLEVBQVUsUUFBbUQ7UUFBM00sb0JBQWUsR0FBZixlQUFlLENBQThCO1FBQVMsbUJBQWMsR0FBZCxjQUFjLENBQTZCO1FBQWtCLFdBQU0sR0FBTixNQUFNLENBQXFCO1FBQVUsYUFBUSxHQUFSLFFBQVEsQ0FBMkM7SUFDOU4sQ0FBQztJQUNELEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBYTtRQUMxQixNQUFNLFNBQVMsR0FBc0IsRUFBRSxDQUFDO1FBQ3hDLEtBQUssQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLENBQUMsS0FBSyxFQUFFLEdBQUcsSUFBSSxFQUFFLEVBQUU7WUFDekQsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQzVDLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQyxDQUFDLENBQUM7UUFDSCxNQUFNLGlCQUFpQixHQUFHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN2RCxPQUFPLEtBQUssQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLGlCQUFpQixDQUFDLEtBQUssRUFBRyxDQUFDLENBQUM7SUFFakYsQ0FBQztJQUVPLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBYSxFQUFFLElBQWM7UUFDcEQsc0ZBQXNGO1FBQ3RGLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyRSxJQUFJLENBQUMsTUFBTSxLQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDakQsT0FBTyxNQUFNLENBQUM7UUFDZixDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDbkIsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2hFLENBQUM7UUFDRCxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7O0FBSUYsTUFBTSxPQUFPLGtCQUFtQixTQUFRLFVBQVU7YUFFbkMsdUJBQWtCLEdBQVcsYUFBYSxBQUF4QixDQUF5QjthQUVqQyxtQkFBYyxHQUFHLGFBQWEsQUFBaEIsQ0FBaUI7YUFFeEMsaUJBQVksR0FBNEM7UUFDdEUsS0FBSyxFQUFFO1lBQ04sTUFBTSxFQUFFLEdBQUc7U0FDWDtRQUNELFlBQVksRUFBRTtZQUNiLE1BQU0sRUFBRTtnQkFDUCxVQUFVLEVBQUUsR0FBRztnQkFDZixhQUFhLEVBQUUsUUFBUTthQUN2QjtZQUNELE1BQU0sRUFBRSxJQUFJO1lBQ1osSUFBSSxFQUFFLEdBQUc7U0FDVDtRQUNELE1BQU0sRUFBRTtZQUNQLE1BQU0sRUFBRTtnQkFDUCxVQUFVLEVBQUUsSUFBSTtnQkFDaEIsYUFBYSxFQUFFLE1BQU07YUFDckI7WUFDRCxNQUFNLEVBQUUsSUFBSTtZQUNaLElBQUksRUFBRSxHQUFHO1NBQ1Q7UUFDRCxLQUFLLEVBQUU7WUFDTixNQUFNLEVBQUU7Z0JBQ1AsVUFBVSxFQUFFLElBQUk7Z0JBQ2hCLGFBQWEsRUFBRSxNQUFNO2FBQ3JCO1lBQ0QsTUFBTSxFQUFFLElBQUk7WUFDWixJQUFJLEVBQUUsR0FBRztTQUNUO0tBQ0QsQUE1QjBCLENBNEJ6QjthQUVhLG1CQUFjLEdBQTRDO1FBQ3hFLE9BQU8sRUFBRSxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDO1FBQ2hELEtBQUssRUFBRSxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDO1FBQzlDLFNBQVMsRUFBRSxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDO0tBQ3hELEFBSjRCLENBSTNCO0lBeUJGLGlDQUFpQyxDQUFDLEdBQTZCO1FBQzlELE9BQU8sQ0FDTixjQUFjLGlDQUF1QixHQUFHLHlFQUF5QyxPQUFPLENBQUM7WUFDekYsY0FBYyxtQ0FBeUI7WUFDdkMsY0FBYyxpQ0FBdUIsR0FBRyxtQ0FBc0IsT0FBTyxDQUFDO1lBQ3RFLENBQUMsR0FBRztnQkFDSCxDQUFDLENBQUMsY0FBYyxpQ0FBdUIsR0FBRyxpQ0FBcUIsSUFBSSxPQUFPLEdBQUcsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUNoSCxDQUFDLENBQUMsRUFBRSxDQUNKO1lBQ0QsY0FBYyxvQ0FBMEIsQ0FDeEMsQ0FBQztJQUNILENBQUM7SUFDRCxxQ0FBcUMsQ0FBQyxlQUFtRTtRQUN4RyxPQUFPLENBQ04sQ0FBQyxlQUFlO1lBQ2YsQ0FBQyxDQUFDLGNBQWMsb0NBQTBCLEdBQUcseUJBQXlCLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUMvSCxDQUFDLENBQUMsRUFBRSxDQUNKO1lBQ0QsY0FBYyx1Q0FBNkIsQ0FDM0MsQ0FBQztJQUNILENBQUM7SUFFRCxZQUNTLGdCQUFrQyxFQUNsQyxxQkFBNEMsRUFDNUMsY0FBOEIsRUFDOUIscUJBQWdELEVBQ2hELGFBQTRCLEVBQzVCLGNBQThCLEVBQzlCLGFBQTRCLEVBQzVCLDZCQUE0RCxFQUM1RCxlQUF5QyxFQUN6QyxtQkFBaUQsRUFDakQsZ0JBQXdCLEVBQ3hCLFlBQTBCLEVBQzFCLCtCQUFnRSxFQUNoRSxZQUEwQixFQUMxQixzQkFBOEMsRUFDOUMsV0FBd0IsRUFDeEIsb0JBQTBDLEVBQ2xELGlCQUFxQyxFQUNyQyxvQkFBMkMsRUFDM0Msc0JBQStDLEVBQ3ZDLFdBQTJEO1FBRW5FLEtBQUssRUFBRSxDQUFDO1FBdEJBLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBa0I7UUFDbEMsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtRQUM1QyxtQkFBYyxHQUFkLGNBQWMsQ0FBZ0I7UUFDOUIsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUEyQjtRQUNoRCxrQkFBYSxHQUFiLGFBQWEsQ0FBZTtRQUM1QixtQkFBYyxHQUFkLGNBQWMsQ0FBZ0I7UUFDOUIsa0JBQWEsR0FBYixhQUFhLENBQWU7UUFDNUIsa0NBQTZCLEdBQTdCLDZCQUE2QixDQUErQjtRQUM1RCxvQkFBZSxHQUFmLGVBQWUsQ0FBMEI7UUFDekMsd0JBQW1CLEdBQW5CLG1CQUFtQixDQUE4QjtRQUNqRCxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQVE7UUFDeEIsaUJBQVksR0FBWixZQUFZLENBQWM7UUFDMUIsb0NBQStCLEdBQS9CLCtCQUErQixDQUFpQztRQUNoRSxpQkFBWSxHQUFaLFlBQVksQ0FBYztRQUMxQiwyQkFBc0IsR0FBdEIsc0JBQXNCLENBQXdCO1FBQzlDLGdCQUFXLEdBQVgsV0FBVyxDQUFhO1FBQ3hCLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBc0I7UUFJMUMsZ0JBQVcsR0FBWCxXQUFXLENBQWdEO1FBdkQ1RCxhQUFRLEdBQVksS0FBSyxDQUFDO1FBSzFCLDJCQUFzQixHQUFzQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDOUUsb0JBQWUsR0FBWSxLQUFLLENBQUM7UUFFakMsd0JBQW1CLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSwrQkFBK0IsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsWUFBWSxDQUFDLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxDQUFDLENBQUM7UUFFNUgsb0JBQWUsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztRQWlENUQsSUFBSSxDQUFDLFlBQVksR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hDLElBQUksQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0QyxJQUFJLENBQUMsV0FBVyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0MsSUFBSSxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLFNBQVMsRUFBa0IsQ0FBQztRQUMxRCxJQUFJLENBQUMsa0JBQWtCLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM5QyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUN2QyxJQUFJLENBQUMsdUJBQXVCLEdBQUcsc0JBQXNCLENBQUM7UUFDdEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLEdBQUcsb0JBQW9CLENBQUMsY0FBYyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztRQUN0RyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBQ25HLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUMxRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1SSxDQUFDO0lBRUQsSUFBVyxnQkFBZ0I7UUFDMUIsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDO0lBQ3JDLENBQUM7SUFFTyxJQUFJLENBQUMsS0FBYTtRQUN6QixJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRVMsV0FBVztRQUNwQixJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDOUQsQ0FBQztJQUVNLFNBQVMsQ0FBQyxJQUFVLEVBQUUsUUFBdUI7UUFDbkQsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDN0IsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFTSxHQUFHLENBQUMsSUFBVSxFQUFFLFFBQXVCLEVBQUUsVUFBa0IsUUFBUSxDQUFDLE9BQU87UUFDakYsSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLHNIQUFzSDtRQUMzSSxNQUFNLFNBQVMsR0FBRyxZQUFZLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRyxNQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDbkcsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLElBQUksQ0FBQyxDQUFDO1FBQ2pELElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxZQUFZLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM5RCxJQUFJLFFBQVEsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNsQixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUMxQixDQUFDO1FBQ0QsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3BCLE1BQU0sWUFBWSxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ3JELElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztZQUNuQyxPQUFPLEVBQUUsSUFBSSxnQ0FBd0IsRUFBRSxJQUFJLEVBQUUsWUFBWSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsdUJBQXVCLENBQUMsWUFBYSxFQUFFLEVBQUUsT0FBTyxFQUFFLFlBQVksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNqTCxDQUFDO1FBRUQsSUFBSSxDQUFDO1lBQ0osTUFBTSxhQUFhLEdBQUcsRUFBRSxJQUFJLGlDQUF5QixFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLElBQUksR0FBRyxFQUFFLEVBQUUsSUFBSSxHQUFHLEVBQUUsRUFBRSxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQ2pLLGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUNwQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7WUFDcEMsQ0FBQyxDQUFDLENBQUM7WUFDSCxPQUFPLGFBQWEsQ0FBQztRQUN0QixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNoQixJQUFJLEtBQUssWUFBWSxTQUFTLEVBQUUsQ0FBQztnQkFDaEMsTUFBTSxLQUFLLENBQUM7WUFDYixDQUFDO2lCQUFNLElBQUksS0FBSyxZQUFZLEtBQUssRUFBRSxDQUFDO2dCQUNuQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDekIsTUFBTSxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxPQUFPLGtDQUEwQixDQUFDO1lBQzdFLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO2dCQUM1QixNQUFNLElBQUksU0FBUyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxpQ0FBaUMsRUFBRSx1RkFBdUYsQ0FBQyxrQ0FBMEIsQ0FBQztZQUN4TSxDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFRCxvQkFBb0IsQ0FBQyxLQUErQjtRQUNuRCxNQUFNLE9BQU8sR0FBVSxFQUFFLENBQUM7UUFDMUIsS0FBSyxNQUFNLENBQUMsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNoQyxLQUFLLE1BQU0sR0FBRyxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDbkMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDbkMsSUFBSSxLQUFLLENBQUMsUUFBUSxLQUFLLENBQUMsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDO29CQUN0QyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3ZDLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQ2pELENBQUM7SUFFTSxlQUFlLENBQUMsVUFBa0I7UUFDeEMsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFFTSxLQUFLO1FBQ1gsSUFBSSxJQUFJLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztZQUMvQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLGlCQUFpQixLQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLGlCQUFpQixFQUFFLENBQUM7Z0JBQzNILElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1lBQ3RCLENBQUM7WUFDRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDdEUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQzdCLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1lBQ3ZCLENBQUMsQ0FBQyxDQUFDO1lBQ0gsT0FBTyxNQUFNLENBQUM7UUFDZixDQUFDO2FBQU0sQ0FBQztZQUNQLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7SUFDRixDQUFDO0lBRUQsSUFBSSxRQUFRO1FBQ1gsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxJQUFJLFFBQVEsQ0FBQyxJQUE4QjtRQUMxQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztJQUN2QixDQUFDO0lBRU8sbUJBQW1CLENBQUMsSUFBVTtRQUNyQyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQy9ELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQzNDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxDQUFDO1lBQy9CLENBQUMsQ0FBQyxDQUFDO1lBQ0gsTUFBTSxVQUFVLEdBQUcsYUFBYSxDQUFDO1lBQ2pDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFDaEQsR0FBRyxDQUFDLFFBQVEsQ0FBQyxzQ0FBc0MsRUFBRSxzRUFBc0UsRUFDMUgsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7b0JBQ2QsS0FBSyxFQUFFLFVBQVU7b0JBQ2pCLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFO2lCQUM3QixDQUFDLENBQUMsQ0FBQztRQUNQLENBQUM7SUFDRixDQUFDO0lBRU0sYUFBYSxDQUFDLElBQVU7UUFDOUIsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUN6RCxJQUFJLENBQUMsWUFBWSxFQUFFLFFBQVEsRUFBRSxDQUFDO1lBQzdCLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGNBQWMsQ0FBQztRQUNwRSxNQUFNLHNCQUFzQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLG1CQUFtQixDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDMUYsT0FBTyxzQkFBc0IsSUFBSSxDQUFDLHNCQUFzQixFQUFFLFVBQVUsS0FBSyxZQUFZLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzVHLENBQUM7SUFHTSxVQUFVLENBQUMsSUFBVTtRQUMzQixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBQ3pELElBQUksQ0FBQyxZQUFZLEVBQUUsUUFBUSxFQUFFLENBQUM7WUFDN0IsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBQ0QsTUFBTSxpQkFBaUIsR0FBWSxJQUFJLENBQUMsc0JBQXNCLENBQUMsbUJBQW1CLENBQUMsZ0JBQWdCLENBQUMsd0NBQWdDLENBQUM7UUFDckksSUFBSSxpQkFBaUIsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDbkQsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDM0IsSUFBSSxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztvQkFDcEMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO2dCQUN6RSxDQUFDO2dCQUNELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLHNDQUE4QixDQUFDO1lBQ2xHLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMscUJBQXFCLENBQUMsdUJBQXVCLHFDQUE2QixDQUFDO1lBQ2pGLENBQUM7WUFDRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsU0FBUyxDQUFDO1lBQ2xDLElBQUksQ0FBQyx5QkFBeUIsR0FBRyxTQUFTLENBQUM7UUFDNUMsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3ZCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsc0JBQXNCLHFDQUE2QixFQUFFLEtBQUssRUFBRSxDQUFDO2dCQUNoSCxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsS0FBSyxnQkFBZ0IsRUFBRSxDQUFDO29CQUNoRCxJQUFJLENBQUMseUJBQXlCLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGNBQWMsSUFBSSxTQUFTLENBQUM7Z0JBQ3BGLENBQUM7WUFDRixDQUFDO1lBQ0QsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMvRCxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksZUFBZSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUNyRCxJQUFJLENBQUMscUJBQXFCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3hFLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRU0sUUFBUTtRQUNkLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztJQUM3QyxDQUFDO0lBRU0sWUFBWTtRQUNsQixPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDekUsQ0FBQztJQUVNLGdCQUFnQjtRQUN0QixPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUMzRyxDQUFDO0lBRU0sY0FBYztRQUNwQixPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzVGLENBQUM7SUFFTSxlQUFlLENBQUMsSUFBVTtRQUNoQyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDaEMsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQ3JELENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxTQUFTLElBQUksU0FBUyxLQUFLLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUM7SUFDbkUsQ0FBQztJQUVNLGdCQUFnQixDQUFDLElBQVU7UUFDakMsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2hDLEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxFQUFFLENBQUM7WUFDMUMsSUFBSSxTQUFTLElBQUksU0FBUyxLQUFLLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDO2dCQUM5QyxPQUFPLElBQUksQ0FBQztZQUNiLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVNLFlBQVk7UUFDbEIsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDdEUsQ0FBQztJQUVNLHVCQUF1QixDQUFDLElBQVUsRUFBRSxNQUFjO1FBQ3hELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFDM0QsSUFBSSxDQUFDLGNBQWMsRUFBRSxRQUFRLEVBQUUsQ0FBQztZQUMvQixPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMseURBQXlELENBQUMsQ0FBQyxDQUFDO1FBQzdGLENBQUM7UUFFRCxPQUFPLElBQUksT0FBTyxDQUFPLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDcEMsZ0RBQWdEO1lBQ2hELE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU8sYUFBYSxDQUFDLElBQVU7UUFDL0IsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2hDLE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUM3QyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsU0FBUyxJQUFJLFNBQVMsS0FBSyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUVPLHNCQUFzQixDQUFDLElBQW1CO1FBQ2pELE1BQU0sR0FBRyxHQUFHLE9BQU8sSUFBSSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDL0QsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM1QyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDbkIsT0FBTztRQUNSLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVPLGNBQWMsQ0FBQyxLQUFpQjtRQUN2QyxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssYUFBYSxDQUFDLE9BQU8sSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLGFBQWEsQ0FBQyxtQkFBbUIsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLGFBQWEsQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1lBQ3BKLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBQy9ELElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQ2hCLFVBQVUsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztZQUMvQixDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVNLFNBQVMsQ0FBQyxJQUFVO1FBQzFCLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFDM0QsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3JCLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBeUIsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBQ3JGLENBQUM7UUFDRCxNQUFNLFFBQVEsR0FBRyxjQUFjLENBQUMsUUFBUSxDQUFDO1FBQ3pDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNmLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBeUIsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBQ3JGLENBQUM7UUFDRCxPQUFPLElBQUksT0FBTyxDQUF5QixDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUM5RCxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQzdDLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUMzRixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ0osTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUU7Z0JBQ25DLE1BQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxJQUFJLENBQUM7Z0JBQ2pDLElBQUksQ0FBQztvQkFDSixNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQ2pCLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDM0YsQ0FBQztnQkFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO29CQUNoQixjQUFjO2dCQUNmLENBQUM7Z0JBQ0QsT0FBTyxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUN4QyxDQUFDLENBQUMsQ0FBQztZQUNILFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNwQixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFTSxZQUFZO1FBQ2xCLE1BQU0sUUFBUSxHQUFzQyxFQUFFLENBQUM7UUFDdkQsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLFlBQVksQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7WUFDckUsTUFBTSxRQUFRLEdBQUcsWUFBWSxFQUFFLFFBQVEsQ0FBQztZQUN4QyxJQUFJLFFBQVEsRUFBRSxDQUFDO2dCQUNkLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxPQUFPLENBQXlCLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO29CQUNyRSxNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRTt3QkFDbkMsTUFBTSxJQUFJLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQzt3QkFDL0IsSUFBSSxDQUFDOzRCQUNKLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQzs0QkFDakIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO3dCQUMzRixDQUFDO3dCQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7NEJBQ2hCLGNBQWM7d0JBQ2YsQ0FBQzt3QkFDRCxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLEtBQUssWUFBWSxFQUFFLENBQUM7NEJBQzdDLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQzt3QkFDL0IsQ0FBQzt3QkFDRCxPQUFPLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxZQUFZLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztvQkFDckQsQ0FBQyxDQUFDLENBQUM7Z0JBQ0osQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDSixRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDcEIsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQXlCLFFBQVEsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFTywyQkFBMkIsQ0FBQyxJQUFVO1FBQzdDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsRUFDdkMsOENBQThDLEVBQzlDLElBQUksQ0FBQyxNQUFNLENBQ1gsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ3BCLENBQUM7SUFFTyxZQUFZLENBQUMsSUFBVSxFQUFFLFFBQXVCLEVBQUUsT0FBZSxFQUFFLGdCQUE2QixFQUFFLGdCQUFvRCxFQUFFLGVBQXFDO1FBQ3BNLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUvQixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFFaEMsc0VBQXNFO1FBQ3RFLHVFQUF1RTtRQUN2RSwrQ0FBK0M7UUFDL0MsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksRUFBRTtZQUNqRCxlQUFlLEdBQUcsZUFBZSxJQUFJLElBQUksR0FBRyxFQUFrQixDQUFDO1lBQy9ELE1BQU0sUUFBUSxHQUE0QixFQUFFLENBQUM7WUFDN0MsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQzVDLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUM7Z0JBQ25GLEtBQUssTUFBTSxVQUFVLElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLFNBQVMsRUFBRSxDQUFDO29CQUNqRSxNQUFNLGNBQWMsR0FBRyxNQUFNLFFBQVEsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQy9FLElBQUksY0FBYyxFQUFFLENBQUM7d0JBQ3BCLElBQUksQ0FBQyxvQ0FBb0MsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUM7d0JBRWhFLG9DQUFvQzt3QkFDcEMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO3dCQUNwQyxNQUFNLGdCQUFnQixHQUFHLGNBQWMsQ0FBQyxTQUFTLEVBQUUsQ0FBQzt3QkFDcEQsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDOzRCQUN6QyxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDO3dCQUN6QyxDQUFDO3dCQUNELElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQzs0QkFDcEUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO3dCQUMzRCxDQUFDO3dCQUNELElBQUksVUFBVSxDQUFDO3dCQUNmLE1BQU0sU0FBUyxHQUFHLGNBQWMsQ0FBQyxlQUFlLEVBQUUsQ0FBQzt3QkFDbkQsSUFBSSxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQzs0QkFDekMsSUFBSSxDQUFDLDJCQUEyQixDQUFDLGNBQWMsQ0FBQyxDQUFDOzRCQUNqRCxVQUFVLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBZSxFQUFFLENBQUMsQ0FBQzt3QkFDaEQsQ0FBQzs2QkFBTSxDQUFDOzRCQUNQLFVBQVUsR0FBRyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7NEJBQzdDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQ0FDakIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dDQUM3RyxVQUFVLEdBQUcsVUFBVSxJQUFJLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxVQUFVLENBQUMsQ0FBQzs0QkFDbkUsQ0FBQzt3QkFDRixDQUFDO3dCQUNELElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQzs0QkFDakIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDOzRCQUM3RSxVQUFVLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLGNBQWMsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLGdCQUFnQixFQUFFLGVBQWUsQ0FBQyxDQUFDO3dCQUN0SSxDQUFDO3dCQUNELGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7d0JBQzVDLFFBQVEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7d0JBQzFCLElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLFlBQVksMkNBQTBCLEVBQUUsQ0FBQzs0QkFDekUsTUFBTSxhQUFhLEdBQUcsTUFBTSxVQUFVLENBQUM7NEJBQ3ZDLElBQUksYUFBYSxDQUFDLFFBQVEsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQ0FDbEMsTUFBTTs0QkFDUCxDQUFDO3dCQUNGLENBQUM7b0JBQ0YsQ0FBQzt5QkFBTSxDQUFDO3dCQUNQLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsRUFDeEMsc0VBQXNFLEVBQ3RFLEtBQUssQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUNqRyxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUN6QixDQUFDLENBQUM7d0JBQ0gsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO29CQUNwQixDQUFDO2dCQUNGLENBQUM7WUFDRixDQUFDO1lBRUQsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBb0MsRUFBRTtnQkFDakYsS0FBSyxNQUFNLE9BQU8sSUFBSSxTQUFTLEVBQUUsQ0FBQztvQkFDakMsSUFBSSxPQUFPLENBQUMsUUFBUSxLQUFLLENBQUMsRUFBRSxDQUFDO3dCQUM1QixPQUFPLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFDdkMsQ0FBQztnQkFDRixDQUFDO2dCQUNELElBQUksQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO29CQUN6RSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQzt3QkFDbkIsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxlQUFnQixDQUFDLENBQUM7b0JBQ2hFLENBQUM7eUJBQU0sQ0FBQzt3QkFDUCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxlQUFnQixDQUFDLENBQUM7b0JBQzlELENBQUM7Z0JBQ0YsQ0FBQztnQkFDRCxPQUFPLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQ3hCLENBQUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtZQUNmLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNsQyxDQUFDLENBQUMsQ0FBQztRQUNILE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDcEQsTUFBTSxLQUFLLEdBQUcsWUFBWSxFQUFFLEtBQUssSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQztRQUNsRCxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDZCxNQUFNLFVBQVUsR0FBRyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUM7UUFDNUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsR0FBRyxVQUFVLENBQUM7UUFDdkMsT0FBTyxPQUFPLENBQUM7SUFDaEIsQ0FBQztJQUVPLGdDQUFnQyxDQUFDLElBQVU7UUFDbEQsT0FBTyxJQUFJLE9BQU8sQ0FBZSxPQUFPLENBQUMsRUFBRTtZQUMxQyxNQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDaEUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEtBQUssYUFBYSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sS0FBSyxJQUFJLENBQUMsRUFBRSxDQUFDO29CQUNoRixzQkFBc0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDakMsT0FBTyxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQzFCLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVPLGNBQWMsQ0FBQyxJQUFVO1FBQ2hDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUVwQyx1Q0FBdUM7UUFDdkMsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7WUFDbEMsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBRUQsK0NBQStDO1FBQy9DLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN4RCxJQUFJLFlBQVksRUFBRSxDQUFDO1lBQ2xCLEtBQUssTUFBTSxnQkFBZ0IsSUFBSSxZQUFZLEVBQUUsQ0FBQztnQkFDN0MsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQztvQkFDeEMsT0FBTyxJQUFJLENBQUM7Z0JBQ2IsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0lBRU8sb0JBQW9CLENBQUMsSUFBVTtRQUN0QyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDcEMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3BDLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFFTyxvQ0FBb0MsQ0FBQyxjQUFvQixFQUFFLElBQVU7UUFDNUUsSUFBSSxjQUFjLENBQUMsdUJBQXVCLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDakQsY0FBYyxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7WUFDekYsY0FBYyxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksRUFBRSxLQUFLLENBQUM7UUFDaEcsQ0FBQzthQUFNLENBQUM7WUFDUCxjQUFjLENBQUMsdUJBQXVCLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUM7UUFDakYsQ0FBQztJQUNGLENBQUM7SUFFTyxLQUFLLENBQUMscUJBQXFCLENBQUMsSUFBeUI7UUFDNUQsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDckQsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDO1FBQ3JCLENBQUM7UUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzFILE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUNyQixDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLGFBQWEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUMzQyxPQUFPLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxDQUFDO1FBQ3hCLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDekQsQ0FBQztJQUVPLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxJQUFVLEVBQUUsUUFBdUIsRUFBRSxPQUFlLEVBQUUsZ0JBQTZCLEVBQUUsZ0JBQW9ELEVBQUUsZUFBcUM7UUFDcE4sZ0hBQWdIO1FBQ2hILCtDQUErQztRQUMvQyxJQUFJLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ2hELE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFBRSxlQUFlLENBQUMsQ0FBQztRQUN4RyxDQUFDO1FBRUQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLGdDQUFnQyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BFLE9BQU8sT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN6SSxDQUFDO0lBRU8sS0FBSyxDQUFDLHlCQUF5QixDQUFDLFVBQXVDLEVBQUUsZUFBNkMsRUFBRSxJQUFrQyxFQUFFLEdBQXVCLEVBQUUsT0FBMkI7UUFDdk4sTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsNkJBQTZCLENBQUMsWUFBWSxDQUFDLGVBQWUsRUFBRSxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSyxDQUFDLENBQUMsQ0FBQztRQUNoSSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxZQUFZLENBQUMsZUFBZSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDcEcsTUFBTSxTQUFTLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQzNELE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLFlBQVksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDOUosTUFBTSxlQUFlLEdBQUcsTUFBTSxVQUFVLEVBQUUsY0FBYyxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDOUUsSUFBSSxlQUFlLEVBQUUsQ0FBQztZQUNyQixPQUFPLGVBQWUsQ0FBQztRQUN4QixDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDOUIsT0FBTyxPQUFPLENBQUM7UUFDaEIsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFFTyx3QkFBd0IsQ0FBQyxTQUFzQixFQUFFLGVBQW9DO1FBQzVGLElBQUksZUFBZSxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNoQyxPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBQ0QsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUNyQyxLQUFLLE1BQU0sUUFBUSxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUN0RSxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzFCLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxVQUFVLENBQUM7SUFDbkIsQ0FBQztJQUVPLFVBQVUsQ0FBQyxTQUE4QixFQUFFLFNBQThCO1FBQ2hGLEtBQUssTUFBTSxLQUFLLElBQUksU0FBUyxFQUFFLENBQUM7WUFDL0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDOUIsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbkMsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRU8sS0FBSyxDQUFDLGFBQWEsQ0FBQyxjQUEyQyxFQUFFLGVBQTZDLEVBQUUsSUFBa0MsRUFBRSxTQUFzQixFQUFFLGVBQW9DO1FBQ3ZOLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLHdCQUF3QixDQUFDLGNBQWMsRUFBRSxlQUFlLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxlQUFlLENBQUMsQ0FBQztRQUN4SCxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQzFFLE9BQU8sUUFBUSxDQUFDO0lBQ2pCLENBQUM7SUFFTyx3QkFBd0IsQ0FBQyxjQUEyQyxFQUFFLGVBQTZDLEVBQUUsSUFBa0MsRUFBRSxTQUFzQixFQUFFLGVBQW9DO1FBQzVOLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEtBQUssV0FBVyxDQUFDLE9BQU8sQ0FBQztRQUMvRSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ3hGLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQzlDLElBQUksT0FBTyxHQUF1QixTQUFTLENBQUM7UUFDNUMsSUFBSSxPQUFPLElBQUksT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQzVCLEtBQUssTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDNUMsSUFBSSxHQUFHLENBQUMsV0FBVyxFQUFFLEtBQUssTUFBTSxFQUFFLENBQUM7b0JBQ2xDLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQzt3QkFDdEMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQzVCLENBQUM7b0JBQ0QsTUFBTTtnQkFDUCxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFDRCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsU0FBUyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQzdFLElBQUksaUJBQTBELENBQUM7UUFDL0QsSUFBSSxjQUFjLElBQUksZUFBZSxFQUFFLENBQUM7WUFDdkMsTUFBTSxVQUFVLEdBQWdCO2dCQUMvQixTQUFTLEVBQUUsVUFBVTthQUNyQixDQUFDO1lBRUYsSUFBSSxjQUFjLENBQUMsUUFBUSxzQ0FBOEIsSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDeEUsVUFBVSxDQUFDLE9BQU8sR0FBRyxFQUFFLElBQUksRUFBRSxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSyxDQUFDLEVBQUUsQ0FBQztnQkFDdkUsSUFBSSxHQUFHLEVBQUUsQ0FBQztvQkFDVCxVQUFVLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7Z0JBQzlCLENBQUM7Z0JBQ0QsSUFBSSxPQUFPLEVBQUUsQ0FBQztvQkFDYixVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUM7Z0JBQ25DLENBQUM7WUFDRixDQUFDO1lBQ0QsaUJBQWlCLEdBQUcsY0FBYyxDQUFDLGdCQUFnQixDQUFDLGVBQWUsRUFBRSxVQUFVLEVBQUUsY0FBYyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxFQUFFO2dCQUNqSyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBQ2YsT0FBTyxTQUFTLENBQUM7Z0JBQ2xCLENBQUM7Z0JBRUQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLEVBQUUsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNyRCxRQUFRLENBQUMsU0FBUyxHQUFHLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUM5QyxJQUFJLFNBQVMsRUFBRSxDQUFDO29CQUNmLElBQUksT0FBTyxHQUFHLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFLLENBQUMsQ0FBQztvQkFDdEQsSUFBSSxjQUFjLENBQUMsUUFBUSxzQ0FBOEIsRUFBRSxDQUFDO3dCQUMzRCxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMseUJBQXlCLENBQUMsY0FBYyxFQUFFLGVBQWUsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO29CQUNyRyxDQUFDO29CQUNELFFBQVEsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDcEUsQ0FBQztnQkFDRCxPQUFPLFFBQVEsQ0FBQztZQUNqQixDQUFDLENBQUMsQ0FBQztZQUNILE9BQU8saUJBQWlCLENBQUM7UUFDMUIsQ0FBQzthQUFNLENBQUM7WUFDUCxNQUFNLGNBQWMsR0FBRyxJQUFJLEtBQUssRUFBVSxDQUFDO1lBQzNDLFVBQVUsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFFOUQsT0FBTyxJQUFJLE9BQU8sQ0FBaUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7Z0JBQ3RFLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxzQkFBc0IsQ0FBQyxlQUFlLEVBQUUsY0FBYyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsY0FBYyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLG9CQUFxRCxFQUFFLEVBQUU7b0JBQzVPLElBQUksb0JBQW9CLEVBQUUsQ0FBQzt3QkFDMUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLEVBQUUsb0JBQW9CLENBQUMsQ0FBQzt3QkFDdkQsb0JBQW9CLEdBQUcsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUM7d0JBQ2hELElBQUksU0FBUyxFQUFFLENBQUM7NEJBQ2YsSUFBSSxlQUF1QixDQUFDOzRCQUM1QixJQUFJLFFBQVEsQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQ0FDeEIsZUFBZSxHQUFHLE1BQU0sSUFBSSxDQUFDLHlCQUF5QixDQUFDLGNBQWMsRUFBRSxlQUFlLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQzs0QkFDN0csQ0FBQztpQ0FBTSxDQUFDO2dDQUNQLGVBQWUsR0FBRyxNQUFNLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxZQUFZLENBQUMsZUFBZSxFQUFFLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFLLENBQUMsQ0FBQyxDQUFDOzRCQUNuSSxDQUFDOzRCQUNELG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxjQUFjLEVBQUUsZUFBZSxDQUFDLENBQUM7d0JBQzlFLENBQUM7d0JBQ0QsTUFBTSx1QkFBdUIsR0FBdUI7NEJBQ25ELFNBQVMsRUFBRSxvQkFBb0I7eUJBQy9CLENBQUM7d0JBQ0YsT0FBTyxDQUFDLHVCQUF1QixDQUFDLENBQUM7b0JBQ2xDLENBQUM7eUJBQU0sQ0FBQzt3QkFDUCxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7b0JBQ3BCLENBQUM7Z0JBQ0YsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxFQUFFO29CQUNYLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDaEIsQ0FBQyxDQUFDLENBQUM7WUFDSixDQUFDLENBQUMsQ0FBQztRQUNKLENBQUM7SUFDRixDQUFDO0lBRU8sZUFBZSxDQUFDLElBQWtDLEVBQUUsT0FBZSxFQUFFLGVBQW9DO1FBQ2hILE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDdEQsSUFBSSxlQUE2QyxDQUFDO1FBQ2xELElBQUksbUJBQW1CLEVBQUUsQ0FBQztZQUN6QixlQUFlLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLEdBQUcsbUJBQW1CLENBQUM7UUFDM0UsQ0FBQzthQUFNLENBQUM7WUFDUCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxDQUFDLE9BQU8sQ0FBQztZQUM1RCxlQUFlLEdBQUcsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQy9ELENBQUM7UUFDRCxNQUFNLFVBQVUsR0FBZ0MsSUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRTdILE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFDcEMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUM1QyxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxFQUFFLGVBQWUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBRTVHLE9BQU8saUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsaUJBQWlCLEVBQUUsRUFBRTtZQUNuRCxJQUFJLGlCQUFpQixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUNuRCxJQUFJLENBQUMsWUFBWSxDQUFDLGlCQUFpQixHQUFHLGlCQUFpQixDQUFDO2dCQUN4RCxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksZ0JBQWdCLENBQUMsZUFBZSxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLDZCQUE2QixDQUFDLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDcEwsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLHNFQUFzRTtnQkFDdEUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDaEUsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDekMsQ0FBQztRQUNGLENBQUMsRUFBRSxNQUFNLENBQUMsRUFBRTtZQUNYLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMvQixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFTyxZQUFZLENBQUMsSUFBa0M7UUFDdEQsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxLQUFLLFdBQVcsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUNqRixPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLEtBQUssU0FBUyxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUksQ0FBQyxpQkFBaUIsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1SCxDQUFDO0lBRU8saUJBQWlCLENBQUMsSUFBa0MsRUFBRSxPQUFlLEVBQUUsZUFBb0M7UUFDbEgsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUNoQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDZixPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDO1FBQzVELENBQUM7UUFDRCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsR0FBRyxRQUFRLENBQUMsZUFBZSxDQUFDO1FBQ3JGLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFDcEMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUU1Qyw4REFBOEQ7UUFDOUQsSUFBSSxlQUFlLEdBQUcsSUFBSSxDQUFDO1FBQzNCLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDekIsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO2dCQUMxRixlQUFlLEdBQUcsS0FBSyxDQUFDO1lBQ3pCLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUN0QixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLGVBQWUsRUFBRSxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsZUFBZSxFQUFFLENBQUMsZUFBZSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsZUFBZSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsaUJBQWlCLEVBQUUsRUFBRTtnQkFDekssSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7b0JBQ3hCLHNFQUFzRTtvQkFDdEUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztvQkFDaEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsQ0FBQztnQkFDeEIsQ0FBQztnQkFDRCxJQUFJLENBQUMsWUFBWSxDQUFDLGlCQUFpQixHQUFHLGlCQUFpQixDQUFDO2dCQUN4RCxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksZ0JBQWdCLENBQUMsUUFBUSxDQUFDLGVBQWUsRUFBRSxDQUFDLGVBQWUsRUFBRSxRQUFRLENBQUMsZUFBZSxFQUFFLENBQUMsVUFBVSxFQUFFLGlCQUFpQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsNkJBQTZCLENBQUMsRUFBRSxlQUFlLENBQUMsQ0FBQztZQUMxTyxDQUFDLEVBQUUsTUFBTSxDQUFDLEVBQUU7Z0JBQ1gsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQy9CLENBQUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsWUFBWSxDQUFDLGlCQUFpQixHQUFHLFFBQVEsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQztZQUNuRixPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksZ0JBQWdCLENBQUMsUUFBUSxDQUFDLGVBQWUsRUFBRSxDQUFDLGVBQWUsRUFBRSxRQUFRLENBQUMsZUFBZSxFQUFFLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLDZCQUE2QixDQUFDLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDclEsQ0FBQztJQUNGLENBQUM7SUFFTyxLQUFLLENBQUMsa0JBQWtCLENBQUMsSUFBa0MsRUFBRSxPQUFlLEVBQUUsUUFBMEIsRUFBRSxlQUE2QztRQUM5SixJQUFJLFFBQVEsR0FBa0MsU0FBUyxDQUFDO1FBQ3hELElBQUksS0FBSyxHQUEwQixTQUFTLENBQUM7UUFDN0MsSUFBSSxPQUFPLEdBQXNDLFNBQVMsQ0FBQztRQUMzRCxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUMvQyxNQUFNLGVBQWUsR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQzVHLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSx3QkFBd0IsQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUN6SSxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUM7Z0JBQzFFLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyx1Q0FBdUMsRUFBRSx1RkFBdUYsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFDaEwsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3BCLENBQUM7WUFDRCxNQUFNLFNBQVMsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1lBQ3hDLElBQUksWUFBWSxHQUFXLENBQUMsQ0FBQztZQUM3QixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO2dCQUMvRCxJQUFJLEtBQUssQ0FBQyxJQUFJLDRGQUF5RCxFQUFFLENBQUM7b0JBQ3pFLFlBQVksRUFBRSxDQUFDO29CQUNmLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDO29CQUMvQixJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7Z0JBQzFGLENBQUM7cUJBQU0sSUFBSSxLQUFLLENBQUMsSUFBSSx3RkFBdUQsRUFBRSxDQUFDO29CQUM5RSxZQUFZLEVBQUUsQ0FBQztvQkFDZixJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQzt3QkFDN0IsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUNoQyxDQUFDO29CQUNELElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDbEgsSUFBSSxZQUFZLEtBQUssQ0FBQyxFQUFFLENBQUM7d0JBQ3hCLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxlQUFlLEdBQUcsQ0FBQyxDQUFDLElBQUksc0JBQXNCLENBQUMsaUJBQWlCOzRCQUMzRixDQUFDLHNCQUFzQixDQUFDLGlCQUFpQixJQUFJLGNBQWMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDOzRCQUNyRSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQzs0QkFDMUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyx5QkFBeUIsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7NEJBQzVHLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBYSxDQUFDLE1BQU0sQ0FBQzs0QkFDakQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFhLENBQUMsY0FBYyxDQUFDOzRCQUNqRSxJQUFJLGNBQWMsS0FBSyxpQkFBaUIsQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQ0FDcEQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsQ0FBQzs0QkFDNUQsQ0FBQztpQ0FBTSxJQUFJLE1BQU0sS0FBSyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUM7Z0NBQ3pDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFTLENBQUMsQ0FBQztnQ0FDbkQsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQzs0QkFDN0MsQ0FBQzt3QkFDRixDQUFDOzZCQUFNLENBQUM7NEJBQ1AsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7d0JBQzNHLENBQUM7b0JBQ0YsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNKLHNCQUFzQixDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ3RDLElBQUksT0FBTyxHQUFvQyxTQUFTLENBQUM7WUFDekQsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLEdBQUcsTUFBTSxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFFaEYsSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDWCxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLENBQWEsS0FBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDOUQsQ0FBQztZQUNELElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDZixPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsc0NBQXNDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDdkYsQ0FBQztZQUNELElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1lBQ2hGLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLHNCQUFzQixDQUFDLENBQUM7WUFDdkUsSUFBSSxzQkFBc0IsR0FBRyxLQUFLLENBQUM7WUFDbkMsUUFBUSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO2dCQUMvQixJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztvQkFDN0IsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxRQUFTLENBQUMsVUFBVSxFQUFFLFFBQVMsQ0FBQyxTQUFVLENBQUMsQ0FBQyxDQUFDO29CQUNoRyxzQkFBc0IsR0FBRyxJQUFJLENBQUM7Z0JBQy9CLENBQUM7WUFDRixDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRTtnQkFDYixJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO1lBQ2pFLENBQUMsQ0FBQyxDQUFDO1lBQ0gsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztZQUMxRCxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDakYsSUFBSSxNQUErQixDQUFDO1lBQ3BDLElBQUksZUFBZSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUM1QiwwR0FBMEc7Z0JBQzFHLDJFQUEyRTtnQkFDM0UsTUFBTSxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtvQkFDckMsc0JBQXNCLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUN6QyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7d0JBQ2QsT0FBTyxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDbkMsQ0FBQztvQkFDRCxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTt3QkFDcEIsc0JBQXNCLENBQUMsYUFBYSxFQUFFLENBQUM7d0JBQ3ZDLE9BQU8sR0FBRyxTQUFTLENBQUM7b0JBQ3JCLENBQUMsQ0FBQyxDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDO1lBQ0osQ0FBQztZQUVELE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBZSxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtnQkFDdkQsTUFBTSxNQUFNLEdBQUcsUUFBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLG9CQUFvQixFQUFFLEVBQUU7b0JBQ3hELE1BQU0sUUFBUSxHQUFHLE9BQU8sb0JBQW9CLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxDQUFDO29CQUM5RyxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUM7b0JBQ2xCLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDakIsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO29CQUM3QixJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQzt3QkFDN0IsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUNoQyxDQUFDO29CQUNELElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDbEMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztvQkFDekMsSUFBSSxvQkFBb0IsS0FBSyxTQUFTLEVBQUUsQ0FBQzt3QkFDeEMscUVBQXFFO3dCQUNyRSxRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBYSxDQUFDLEtBQUssRUFBRSxDQUFDOzRCQUMxQyxLQUFLLFNBQVMsQ0FBQyxTQUFTO2dDQUN2QixJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEdBQUcsUUFBUyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQ0FDL0QsTUFBTTs0QkFDUCxLQUFLLFNBQVMsQ0FBQyxNQUFNO2dDQUNwQixJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxRQUFTLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxzQkFBYyxDQUFDO2dDQUMvRSxNQUFNO3dCQUNSLENBQUM7b0JBQ0YsQ0FBQztvQkFDRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQWEsQ0FBQyxNQUFNLENBQUM7b0JBQ2pELElBQUksQ0FBQyxNQUFNLEtBQUssVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxlQUFlLEdBQUcsQ0FBQyxDQUFDLElBQUksc0JBQXNCLENBQUMsaUJBQWlCO3dCQUNsSixDQUFDLHNCQUFzQixDQUFDLGlCQUFpQixJQUFJLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7d0JBQ3RFLElBQUksQ0FBQzs0QkFDSixJQUFJLENBQUMsZ0JBQWdCLENBQUMsaUJBQWlCLENBQUMsUUFBUyxDQUFDLENBQUM7NEJBQ25ELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7d0JBQzdDLENBQUM7d0JBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQzs0QkFDWixnR0FBZ0c7NEJBQ2hHLG9DQUFvQzt3QkFDckMsQ0FBQztvQkFDRixDQUFDO29CQUNELHNCQUFzQixDQUFDLElBQUksRUFBRSxDQUFDO29CQUM5QixzQkFBc0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDakMsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7d0JBQzdCLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsUUFBUyxDQUFDLFVBQVUsRUFBRSxRQUFTLENBQUMsU0FBVSxDQUFDLENBQUMsQ0FBQzt3QkFDaEcsc0JBQXNCLEdBQUcsSUFBSSxDQUFDO29CQUMvQixDQUFDO29CQUNELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFTLENBQUMsVUFBVSxDQUFDLENBQUM7b0JBQ2hFLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsUUFBUyxDQUFDLFVBQVUsRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztvQkFFOUYsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFlBQVksRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO3dCQUN2QyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFFBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO29CQUNyRSxDQUFDO29CQUNELFlBQVksR0FBRyxDQUFDLENBQUM7b0JBQ2pCLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQ2hFLFNBQVMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDcEIsT0FBTyxDQUFDLEVBQUUsUUFBUSxFQUFFLFFBQVEsSUFBSSxTQUFTLEVBQUUsQ0FBQyxDQUFDO2dCQUM5QyxDQUFDLENBQUMsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDO1lBQ0gsSUFBSSxPQUFPLEtBQUssUUFBUSxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUN4RCxNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUM7Z0JBQ3ZCLE1BQU0scUJBQXFCLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO2dCQUN4RSxNQUFNLFVBQVUsR0FBRyxJQUFJLE1BQU0sQ0FBQyxzQkFBc0IsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUM3RyxLQUFLLE1BQU0sUUFBUSxJQUFJLHFCQUFxQixFQUFFLENBQUM7b0JBQzlDLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQzNCLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO3dCQUMvQixNQUFNO29CQUNQLENBQUM7Z0JBQ0YsQ0FBQztnQkFDRCxJQUFJLE9BQU8sR0FBb0MsU0FBUyxDQUFDO2dCQUN6RCxLQUFLLElBQUksQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztvQkFDbEQsc0JBQXNCLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNuRCxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7d0JBQ2QsT0FBTyxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDbkMsQ0FBQztvQkFDRCxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTt3QkFDcEIsc0JBQXNCLENBQUMsYUFBYSxFQUFFLENBQUM7d0JBQ3ZDLE9BQU8sR0FBRyxTQUFTLENBQUM7b0JBQ3JCLENBQUMsQ0FBQyxDQUFDO2dCQUNKLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQzthQUFNLENBQUM7WUFDUCxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxlQUFlLENBQUMsQ0FBQztZQUVoRixJQUFJLEtBQUssRUFBRSxDQUFDO2dCQUNYLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBYSxLQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUM5RCxDQUFDO1lBQ0QsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNmLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyxzQ0FBc0MsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN2RixDQUFDO1lBRUQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztZQUMxRCxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDakYsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2hDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDO1lBQy9CLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUV4RixNQUFNLGVBQWUsR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQzVHLE1BQU0sdUJBQXVCLEdBQUcsSUFBSSx5QkFBeUIsQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsYUFBYSx5Q0FBaUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQzFLLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO1lBQ2pGLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLHVCQUF1QixDQUFDLENBQUM7WUFDeEUsSUFBSSxDQUFDLFNBQVMsQ0FBQyx1QkFBdUIsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO2dCQUNqRSxJQUFJLEtBQUssQ0FBQyxJQUFJLDRGQUF5RCxFQUFFLENBQUM7b0JBQ3pFLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMscUJBQXFCLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUN6RyxDQUFDO3FCQUFNLElBQUksS0FBSyxDQUFDLElBQUksd0ZBQXVELEVBQUUsQ0FBQztvQkFDOUUsSUFBSSx1QkFBdUIsQ0FBQyxlQUFlLElBQUksdUJBQXVCLENBQUMsaUJBQWlCLElBQUksdUJBQXVCLENBQUMsaUJBQWlCLElBQUksY0FBYyxDQUFDLEtBQUssRUFBRSxDQUFDO3dCQUMvSixJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQzt3QkFDMUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyx5QkFBeUIsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7b0JBQzdHLENBQUM7eUJBQU0sQ0FBQzt3QkFDUCxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztvQkFDM0csQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNKLElBQUksc0JBQXNCLEdBQUcsS0FBSyxDQUFDO1lBQ25DLFFBQVEsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtnQkFDL0IsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7b0JBQzdCLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsUUFBUyxDQUFDLFVBQVUsRUFBRSxRQUFTLENBQUMsU0FBVSxDQUFDLENBQUMsQ0FBQztvQkFDaEcsc0JBQXNCLEdBQUcsSUFBSSxDQUFDO2dCQUMvQixDQUFDO1lBQ0YsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUU7Z0JBQ2IsaUVBQWlFO1lBQ2xFLENBQUMsQ0FBQyxDQUFDO1lBRUgsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFO2dCQUMzQyx1QkFBdUIsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDM0MsQ0FBQyxDQUFDLENBQUM7WUFDSCxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQWUsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7Z0JBQ3ZELE1BQU0sTUFBTSxHQUFHLFFBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxvQkFBb0IsRUFBRSxFQUFFO29CQUN4RCxNQUFNLFFBQVEsR0FBRyxPQUFPLG9CQUFvQixLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixFQUFFLElBQUksQ0FBQztvQkFDOUcsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUNqQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7b0JBQzdCLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDbEMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztvQkFDekMsSUFBSSxvQkFBb0IsS0FBSyxTQUFTLEVBQUUsQ0FBQzt3QkFDeEMscUVBQXFFO3dCQUNyRSxRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBYSxDQUFDLEtBQUssRUFBRSxDQUFDOzRCQUMxQyxLQUFLLFNBQVMsQ0FBQyxTQUFTO2dDQUN2QixJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEdBQUcsUUFBUyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQ0FDL0QsTUFBTTs0QkFDUCxLQUFLLFNBQVMsQ0FBQyxNQUFNO2dDQUNwQixJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxRQUFTLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxzQkFBYyxDQUFDO2dDQUMvRSxNQUFNO3dCQUNSLENBQUM7b0JBQ0YsQ0FBQztvQkFDRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQWEsQ0FBQyxNQUFNLENBQUM7b0JBQ2pELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBYSxDQUFDLGNBQWMsQ0FBQztvQkFDakUsTUFBTSxrQkFBa0IsR0FBRyxRQUFRLElBQUksQ0FBQyxjQUFjLEtBQUssaUJBQWlCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLEdBQUcsQ0FBQyxDQUFDLENBQUM7b0JBQ3pJLElBQUksa0JBQWtCLEVBQUUsQ0FBQzt3QkFDeEIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO29CQUN0RCxDQUFDO3lCQUFNLElBQUksUUFBUSxJQUFJLENBQUMsTUFBTSxLQUFLLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQyxJQUFJLHVCQUF1QixDQUFDLGlCQUFpQjt3QkFDdkssQ0FBQyx1QkFBdUIsQ0FBQyxpQkFBaUIsSUFBSSxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO3dCQUN2RSxJQUFJLENBQUM7NEJBQ0osSUFBSSxDQUFDLGdCQUFnQixDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFDOzRCQUNsRCxJQUFJLENBQUMscUJBQXFCLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUM3QyxDQUFDO3dCQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7NEJBQ1osZ0dBQWdHOzRCQUNoRyxvQ0FBb0M7d0JBQ3JDLENBQUM7b0JBQ0YsQ0FBQztvQkFDRCxzREFBc0Q7b0JBQ3RELFVBQVUsQ0FBQyxHQUFHLEVBQUU7d0JBQ2YsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUNqQix1QkFBdUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQzt3QkFDL0IsdUJBQXVCLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQ25DLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztvQkFDUixJQUFJLENBQUMsc0JBQXNCLElBQUksUUFBUSxFQUFFLENBQUM7d0JBQ3pDLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsU0FBVSxDQUFDLENBQUMsQ0FBQzt3QkFDOUYsc0JBQXNCLEdBQUcsSUFBSSxDQUFDO29CQUMvQixDQUFDO29CQUVELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7b0JBQ2hFLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxRQUFRLElBQUksU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7b0JBQzNHLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO3dCQUM3QixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ2hDLENBQUM7b0JBQ0QsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7b0JBQ2hGLElBQUksdUJBQXVCLENBQUMsZUFBZSxJQUFJLHVCQUF1QixDQUFDLGlCQUFpQixJQUFJLHVCQUF1QixDQUFDLGlCQUFpQixJQUFJLGNBQWMsQ0FBQyxLQUFLLEVBQUUsQ0FBQzt3QkFDL0osSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUM7d0JBQzFDLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMseUJBQXlCLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO29CQUM3RyxDQUFDO3lCQUFNLENBQUM7d0JBQ1AsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7b0JBQzNHLENBQUM7b0JBQ0QsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO29CQUN0RixJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2hDLE9BQU8sQ0FBQyxFQUFFLFFBQVEsRUFBRSxRQUFRLElBQUksU0FBUyxFQUFFLENBQUMsQ0FBQztnQkFDOUMsQ0FBQyxDQUFDLENBQUM7WUFDSixDQUFDLENBQUMsQ0FBQztRQUNKLENBQUM7UUFFRCxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsY0FBYyxLQUFLLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlILElBQUksZ0JBQWdCLEVBQUUsQ0FBQztZQUN0QixJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDdEQsQ0FBQzthQUFNLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsTUFBTSxLQUFLLFVBQVUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQ3JJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNsRCxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDckQsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDckMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMvQyxDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQ3pDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6RCxDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLHlDQUF5QyxDQUFDLENBQUM7UUFDbEUsQ0FBQztRQUNELElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDekMsT0FBTyxPQUFPLENBQUM7SUFDaEIsQ0FBQztJQUVPLGlCQUFpQixDQUFDLFVBQThCO1FBQ3ZELElBQUksVUFBVSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzlCLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFDRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN2RCxJQUFJLFNBQVMsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUM3QixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBQ0QsSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDeEMsT0FBTyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsU0FBUyxDQUFDO0lBQy9CLENBQUM7SUFFTyxtQkFBbUIsQ0FBQyxJQUFrQztRQUM3RCxNQUFNLHdCQUF3QixHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsaUJBQWlCLEVBQUUscUNBQTZCLENBQUM7UUFDdkcsT0FBTyx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQztJQUN4RyxDQUFDO0lBRU8sS0FBSyxDQUFDLHdCQUF3QixDQUFDLElBQWtDLEVBQUUsZUFBNkMsRUFBRSxnQkFBa0MsRUFBRSxRQUEyQixFQUFFLE9BQXVCLEVBQUUsT0FBc0IsRUFBRSxJQUFxQixFQUFFLFVBQTJCLEVBQUUsbUJBQXlDO1FBQ3hVLElBQUksaUJBQXFDLENBQUM7UUFDMUMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEtBQUssV0FBVyxDQUFDLEtBQUssQ0FBQztRQUNsRSxNQUFNLHdCQUF3QixHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsaUJBQWlCLEVBQUUscUNBQTZCLENBQUM7UUFDdkcsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BELE1BQU0sSUFBSSxHQUFHLGdCQUFnQixDQUFDO1FBQzlCLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO1FBQzFDLElBQUksR0FBNkIsQ0FBQztRQUNsQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNqQixHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQztZQUNsQixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUMzQixJQUFJLGVBQWUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsTUFBTSxLQUFLLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO29CQUN0RSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDbEQsQ0FBQztZQUNGLENBQUM7WUFDRCxvQ0FBb0M7WUFDcEMsR0FBRyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUNqTCxDQUFDO1FBQ0QsSUFBSSxjQUFjLEVBQUUsQ0FBQztZQUNwQixJQUFJLEVBQTRCLENBQUM7WUFDakMsUUFBUSxRQUFRLEVBQUUsQ0FBQztnQkFDbEI7b0JBQWdDLEVBQUUsMkNBQW1DLENBQUM7b0JBQUMsTUFBTTtnQkFDN0U7b0JBQTRCLEVBQUUsNkNBQXFDLENBQUM7b0JBQUMsTUFBTTtnQkFDM0UscUNBQTZCO2dCQUM3QjtvQkFBUyxFQUFFLHlDQUFpQyxDQUFDO29CQUFDLE1BQU07WUFDckQsQ0FBQztZQUNELE1BQU0sY0FBYyxHQUFHLE1BQU0sSUFBSSxDQUFDLCtCQUErQixDQUFDLGlCQUFpQixDQUFDO2dCQUNuRixvQkFBb0IsRUFBRSxJQUFJO2dCQUMxQixFQUFFO2dCQUNGLGVBQWUsRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsZUFBZTthQUN6RCxDQUFDLENBQUM7WUFDSCxJQUFJLElBQTZELENBQUM7WUFDbEUsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxDQUFDO2dCQUMzQyxJQUFJLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQy9ELENBQUM7aUJBQU0sQ0FBQztnQkFDUCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO2dCQUN4SCxNQUFNLE1BQU0sR0FBRyxPQUFPLGFBQWEsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQztnQkFDdkYsSUFBSSxHQUFHLE1BQU0sS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQztZQUN0RixDQUFDO1lBQ0QsaUJBQWlCLEdBQUc7Z0JBQ25CLElBQUksRUFBRSxZQUFZO2dCQUNsQixJQUFJO2dCQUNKLFVBQVUsRUFBRSxjQUFjLENBQUMsSUFBSTtnQkFDL0IsSUFBSSxFQUFFLGNBQWMsQ0FBQyxJQUFJO2dCQUN6QixHQUFHLEVBQUUsRUFBRSxHQUFHLGNBQWMsQ0FBQyxHQUFHLEVBQUU7Z0JBQzlCLElBQUk7Z0JBQ0osS0FBSyxFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLEVBQUUsS0FBSyxJQUFJLFNBQVM7Z0JBQzVELFVBQVU7YUFDVixDQUFDO1lBQ0YsSUFBSSxjQUFjLEdBQVksS0FBSyxDQUFDO1lBQ3BDLE1BQU0sWUFBWSxHQUFvQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7WUFDekcsSUFBSSxZQUFZLEVBQUUsQ0FBQztnQkFDbEIsSUFBSSxZQUFZLENBQUMsVUFBVSxFQUFFLENBQUM7b0JBQzdCLG1FQUFtRTtvQkFDbkUsSUFBSSxZQUFZLENBQUMsVUFBVSxLQUFLLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxDQUFDO3dCQUM5RCxpQkFBaUIsQ0FBQyxJQUFJLEdBQUcsU0FBUyxDQUFDO29CQUNwQyxDQUFDO29CQUNELGlCQUFpQixDQUFDLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxnQkFBZ0IsRUFBRSxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUM7b0JBQ3RHLGNBQWMsR0FBRyxJQUFJLENBQUM7Z0JBQ3ZCLENBQUM7Z0JBQ0QsSUFBSSxZQUFZLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBQ3ZCLGlCQUFpQixDQUFDLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsRUFBRSxZQUFZLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7Z0JBQ3BHLENBQUM7WUFDRixDQUFDO1lBQ0QsSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQzFDLGlCQUFpQixDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7WUFDN0IsQ0FBQztZQUNELE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFXLGlCQUFpQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDL0gsTUFBTSxLQUFLLEdBQWEsRUFBRSxDQUFDO1lBQzNCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxVQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQzFILE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xILElBQUksZ0JBQWdCLEdBQVksS0FBSyxDQUFDO1lBQ3RDLElBQUksUUFBUSxzQ0FBOEIsRUFBRSxDQUFDO2dCQUM1QyxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7Z0JBQ3hCLCtEQUErRDtnQkFDL0QsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNwRCxJQUFJLFFBQVEsS0FBSyxTQUFTLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQ2pILE9BQU8sU0FBUyxDQUFDO2dCQUNsQixDQUFDO2dCQUNELElBQUksQ0FBQyxRQUFRLEtBQUssZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxVQUFVLENBQUMsRUFBRSxDQUFDO29CQUNsRSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7d0JBQ3JCLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7b0JBQ3hCLENBQUM7Z0JBQ0YsQ0FBQztxQkFBTSxJQUFJLENBQUMsUUFBUSxLQUFLLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxLQUFLLFNBQVMsQ0FBQyxFQUFFLENBQUM7b0JBQ2xFLGdCQUFnQixHQUFHLEtBQUssQ0FBQztvQkFDekIsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO3dCQUNyQixLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUNsQixDQUFDO2dCQUNGLENBQUM7cUJBQU0sSUFBSSxRQUFRLEtBQUssU0FBUyxFQUFFLENBQUM7b0JBQ25DLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQzt3QkFDckIsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDbEIsQ0FBQztnQkFDRixDQUFDO3FCQUFNLElBQUksUUFBUSxLQUFLLFFBQVEsRUFBRSxDQUFDO29CQUNsQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7d0JBQ3JCLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2xCLENBQUM7Z0JBQ0YsQ0FBQztxQkFBTSxDQUFDO29CQUNQLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQzt3QkFDckIsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBQ3hCLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7b0JBQ3JCLHdEQUF3RDtvQkFDeEQsSUFBSSxRQUFRLGtDQUEwQixFQUFFLENBQUM7d0JBQ3hDLDRFQUE0RTt3QkFDNUUsd0RBQXdEO3dCQUN4RCw2RkFBNkY7d0JBQzdGLGlJQUFpSTt3QkFDakksOEZBQThGO3dCQUM5Rix1RkFBdUY7d0JBQ3ZGLHdHQUF3Rzt3QkFDeEcscURBQXFEO3dCQUNyRCwwQ0FBMEM7d0JBQzFDLHVCQUF1Qjt3QkFDdkIsZ0NBQWdDO3dCQUNoQyxLQUFLO3dCQUNMLElBQUk7b0JBQ0wsQ0FBQztvQkFDRCxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNsQixDQUFDO1lBQ0YsQ0FBQztZQUNELE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDakUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3BDLGlCQUFpQixDQUFDLHFCQUFxQixHQUFHLFlBQVksRUFBRSxDQUFDO1lBQ3pELE1BQU0sZUFBZSxHQUFHO2dCQUN2QixXQUFXO2dCQUNYLEtBQUssRUFBRSxpQkFBaUIsQ0FBQyxxQkFBcUI7YUFDOUMsQ0FBQztZQUNGLGlCQUFpQixDQUFDLElBQUksR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQztZQUM1RixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNqRSxJQUFJLHdCQUF3QixJQUFJLGVBQWUsRUFBRSxDQUFDO29CQUNqRCxNQUFNLE1BQU0sR0FBRyxHQUFHLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxJQUFJLE1BQU0sSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDO29CQUNoSCxpQkFBaUIsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUM7d0JBQ25ILEdBQUcsRUFBRSx3QkFBd0I7d0JBQzdCLE9BQU8sRUFBRSxDQUFDLDZDQUE2QyxFQUFFLGdDQUFnQyxDQUFDO3FCQUUxRixFQUFFLG1DQUFtQyxFQUFFLE1BQU0sRUFBRSxXQUFXLENBQUMsRUFBRSxFQUFFLHFCQUFxQixFQUFFLElBQUksRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLHFDQUFxQyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUM5SixDQUFDO3FCQUFNLENBQUM7b0JBQ1AsaUJBQWlCLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxHQUFHLENBQUMsR0FBRyx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO3dCQUNuSCxHQUFHLEVBQUUsaUNBQWlDO3dCQUN0QyxPQUFPLEVBQUUsQ0FBQyxnQ0FBZ0MsQ0FBQztxQkFDM0MsRUFBRSxxQkFBcUIsRUFBRSxXQUFXLENBQUMsRUFBRSxFQUFFLHFCQUFxQixFQUFFLElBQUksRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLHFDQUFxQyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUN4SSxDQUFDO1lBQ0YsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLGlCQUFpQixDQUFDLFdBQVcsR0FBRztvQkFDL0IsSUFBSSxFQUFFLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMscUNBQXFDLENBQUMsZUFBZSxDQUFDO29CQUMvRyxlQUFlLEVBQUUsS0FBSztpQkFDdEIsQ0FBQztZQUNILENBQUM7UUFDRixDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sS0FBSyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUM1SCxNQUFNLFVBQVUsR0FBRyxDQUFDLGNBQWM7Z0JBQ2pDLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLEdBQUcsa0JBQWtCLENBQUMsY0FBYyxHQUFHLEdBQUcsQ0FBQyxDQUFDO2dCQUM5SSxDQUFDLENBQUMsaUJBQWlCLENBQUM7WUFFckIsNkdBQTZHO1lBQzdHLGlCQUFpQixHQUFHO2dCQUNuQixJQUFJLEVBQUUsWUFBWTtnQkFDbEIsSUFBSTtnQkFDSixJQUFJLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztnQkFDaEgsS0FBSyxFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLEVBQUUsS0FBSyxJQUFJLFNBQVM7Z0JBQzVELFVBQVUsRUFBRSxVQUFVO2dCQUN0QixJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztnQkFDcEQsVUFBVTthQUNWLENBQUM7WUFDRixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNqRSxNQUFNLGFBQWEsR0FBRyxDQUFDLElBQTRDLEVBQVUsRUFBRTtvQkFDOUUsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO3dCQUNoQyxPQUFPLEVBQUUsQ0FBQztvQkFDWCxDQUFDO29CQUNELElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO3dCQUMxQixPQUFPLElBQUksQ0FBQztvQkFDYixDQUFDO29CQUNELE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDdkIsQ0FBQyxDQUFDO2dCQUNGLElBQUksd0JBQXdCLElBQUksZUFBZSxFQUFFLENBQUM7b0JBQ2pELGlCQUFpQixDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsaUNBQWlDLENBQUMsR0FBRyxDQUFDLEdBQUcsd0JBQXdCLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQzt3QkFDbkgsR0FBRyxFQUFFLHdCQUF3Qjt3QkFDN0IsT0FBTyxFQUFFLENBQUMsNkNBQTZDLEVBQUUsZ0NBQWdDLENBQUM7cUJBQzFGLEVBQUUsbUNBQW1DLEVBQUUsZUFBZSxDQUFDLElBQUksRUFBRSxHQUFHLGlCQUFpQixDQUFDLFVBQVUsSUFBSSxhQUFhLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUscUJBQXFCLEVBQUUsSUFBSSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMscUNBQXFDLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQ3JPLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxpQkFBaUIsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUM7d0JBQ25ILEdBQUcsRUFBRSxrQ0FBa0M7d0JBQ3ZDLE9BQU8sRUFBRSxDQUFDLGdDQUFnQyxDQUFDO3FCQUMzQyxFQUFFLHFCQUFxQixFQUFFLEdBQUcsaUJBQWlCLENBQUMsVUFBVSxJQUFJLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxxQkFBcUIsRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxxQ0FBcUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDak0sQ0FBQztZQUNGLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxpQkFBaUIsQ0FBQyxXQUFXLEdBQUc7b0JBQy9CLElBQUksRUFBRSxJQUFJLENBQUMsaUNBQWlDLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLHFDQUFxQyxDQUFDLFNBQVMsQ0FBQztvQkFDekcsZUFBZSxFQUFFLEtBQUs7aUJBQ3RCLENBQUM7WUFDSCxDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksR0FBRyxFQUFFLENBQUM7WUFDVCxpQkFBaUIsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO1FBQzdCLENBQUM7UUFDRCxJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNqQixJQUFJLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUMzQixpQkFBaUIsQ0FBQyxHQUFHLEdBQUcsRUFBRSxHQUFHLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUN0RSxDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsaUJBQWlCLENBQUMsR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUM7WUFDckMsQ0FBQztRQUNGLENBQUM7UUFDRCxpQkFBaUIsQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUM7UUFDM0MsaUJBQWlCLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDO1FBQzdDLGlCQUFpQixDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUM7UUFDeEQsT0FBTyxpQkFBaUIsQ0FBQztJQUMxQixDQUFDO0lBRU8sZUFBZSxDQUFDLGdCQUEwQixFQUFFLG1CQUE2QjtRQUNoRixNQUFNLGlCQUFpQixHQUFhLE9BQU8sQ0FBQyxTQUFTLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUMzRSxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDbEMsTUFBTSx3QkFBd0IsR0FBRyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLEVBQUU7Z0JBQ3pFLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLEtBQUssT0FBTyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQ2pGLGdHQUFnRztvQkFDaEcsT0FBTyxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUN4RixDQUFDO3FCQUFNLENBQUM7b0JBQ1AsT0FBTyxHQUFHLENBQUMsV0FBVyxFQUFFLEtBQUssT0FBTyxDQUFDO2dCQUN0QyxDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUM7WUFDSCxJQUFJLHdCQUF3QixFQUFFLENBQUM7Z0JBQzlCLGlCQUFpQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNqQyxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLGlCQUFpQixDQUFDO0lBQzFCLENBQUM7SUFFTyxLQUFLLENBQUMsb0JBQW9CLENBQUMsSUFBVTtRQUM1QyxNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLHNCQUFzQixFQUFFLE9BQU8sS0FBSyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ2pJLE9BQU8sb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxLQUFLLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDO0lBQ3BHLENBQUM7SUFFTyxLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBVSxFQUFFLEtBQXlCLEVBQUUsYUFBaUM7UUFDdkcsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsRSxNQUFNLFVBQVUsR0FBRyxDQUFDLFFBQTJCLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUM5SSxJQUFJLG1CQUFtQixFQUFFLENBQUM7WUFDekIsSUFBSSxTQUFTLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQ3BELG1CQUFtQixDQUFDLFVBQVUsR0FBRyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztZQUM5RyxDQUFDO1lBQ0QsSUFBSSxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUMzRCxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxrQ0FBa0MsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDckUsT0FBTyxtQkFBbUIsQ0FBQztRQUM1QixDQUFDO1FBQ0QsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNYLDZDQUE2QztZQUM3QyxnR0FBZ0c7WUFDaEcsS0FBSyxNQUFNLFFBQVEsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO2dCQUN2RCxJQUFJLFFBQVEsQ0FBQyxLQUFLLEtBQUssS0FBSyxFQUFFLENBQUM7b0JBQzlCLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLHFDQUFxQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO29CQUNyRSxNQUFNLGdCQUFnQixHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUM7b0JBQzNDLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLGNBQWMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsQ0FBQyxDQUFDO29CQUNySSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztvQkFDOUMsSUFBSSxNQUFNLEVBQUUsQ0FBQzt3QkFDWixPQUFPLE1BQU0sQ0FBQztvQkFDZixDQUFDO2dCQUNGLENBQUM7WUFDRixDQUFDO1lBQ0QsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsd0NBQXdDLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDekUsQ0FBQztRQUNELHVHQUF1RztRQUN2RyxNQUFNLGVBQWUsR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLENBQUMsQ0FBQztRQUM5RixJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUN2RCxPQUFPLGVBQWUsQ0FBQztJQUN4QixDQUFDO0lBRU8scUJBQXFCO1FBQzVCLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQzFCLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLGdEQUFnRCxDQUFDLENBQUM7WUFDekUsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLHNCQUFzQixFQUFFLE9BQU8sS0FBSyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ2pJLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLDhCQUE4QixvQkFBb0IsQ0FBQyxNQUFNLFlBQVksQ0FBQyxDQUFDO1FBQzlGLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNsQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7YUFBTSxDQUFDO1lBQ1AsS0FBSyxNQUFNLFFBQVEsSUFBSSxvQkFBb0IsRUFBRSxDQUFDO2dCQUM3QyxNQUFNLElBQUksR0FBRyxtQkFBbUIsQ0FBQyxRQUFRLENBQXNDLENBQUM7Z0JBQ2hGLElBQUksSUFBSSxFQUFFLENBQUM7b0JBQ1YsTUFBTSxZQUFZLEdBQUcsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUscUJBQXFCLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7b0JBQ2pJLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxHQUFHLFlBQVksQ0FBQztvQkFDcEQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsK0JBQStCLEVBQUUsWUFBWSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ3JHLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDO0lBQzdCLENBQUM7SUFFTyxzQkFBc0IsQ0FBQyxRQUEyQixFQUFFLFlBQTJCO1FBQ3RGLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDNUMsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3RELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3RELDhFQUE4RTtRQUM5RSw0RkFBNEY7UUFDNUYseUVBQXlFO1FBQ3pFLHVHQUF1RztRQUN2RyxNQUFNLE1BQU0sR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDO1FBQ3JDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNwQyxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUM3QixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDaEMsQ0FBQztJQUNGLENBQUM7SUFFTyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQWtDLEVBQUUsUUFBMEIsRUFBRSxlQUE2QztRQUMxSSxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQztRQUNoRyxNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDM0UsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQztRQUV0RCxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztZQUMxQixNQUFNLElBQUksS0FBSyxDQUFDLHlEQUF5RCxDQUFDLENBQUM7UUFDNUUsQ0FBQztRQUNELE1BQU0sVUFBVSxHQUFHLGtCQUFrQixDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBRXpGLElBQUksT0FBa0MsQ0FBQztRQUN2QyxJQUFJLElBQWlDLENBQUM7UUFDdEMsSUFBSSxhQUE2QyxDQUFDO1FBRWxELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEtBQUssV0FBVyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQzFELElBQUksQ0FBQyxZQUFZLENBQUMsaUJBQWlCLEdBQUcsYUFBYSxHQUFHO2dCQUNyRCx1QkFBdUIsRUFBRSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLDJCQUEyQixDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDbkgsVUFBVTtnQkFDVixJQUFJLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQztnQkFDcEMsV0FBVyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsd0JBQXdCLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztvQkFDaEgsR0FBRyxFQUFFLGdCQUFnQjtvQkFDckIsT0FBTyxFQUFFLENBQUMsZ0NBQWdDLENBQUM7aUJBQzNDLEVBQUUscUJBQXFCLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUscUJBQXFCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztnQkFDcEYsaUJBQWlCLEVBQUUsSUFBSTtnQkFDdkIsSUFBSSxFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7Z0JBQ2hILEtBQUssRUFBRSxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxFQUFFLEtBQUssSUFBSSxTQUFTO2FBQzVELENBQUM7UUFDSCxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sY0FBYyxHQUFzRCxNQUFNLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3BJLE9BQU8sR0FBRyxjQUFjLENBQUMsT0FBTyxDQUFDO1lBQ2pDLElBQUksR0FBRyxjQUFjLENBQUMsSUFBSSxDQUFDO1lBRTNCLElBQUksQ0FBQyxZQUFZLENBQUMsaUJBQWlCLEdBQUcsYUFBYSxHQUFHLE1BQU0sSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksRUFBRSxlQUFlLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztZQUM5TCxJQUFJLGFBQWEsS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDakMsT0FBTyxDQUFDLFNBQVMsRUFBRSxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsK0RBQStELENBQUMsa0NBQTBCLENBQUMsQ0FBQztZQUNqTCxDQUFDO1FBQ0YsQ0FBQztRQUNELE1BQU0sbUJBQW1CLEdBQUcsbUJBQW1CLENBQUMsS0FBSyxLQUFLLFNBQVMsQ0FBQyxTQUFTLENBQUM7UUFDOUUsTUFBTSxvQkFBb0IsR0FBRyxtQkFBbUIsQ0FBQyxLQUFLLEtBQUssU0FBUyxDQUFDLE1BQU0sQ0FBQztRQUM1RSxNQUFNLEtBQUssR0FBRyxtQkFBbUIsQ0FBQyxLQUFLLENBQUM7UUFFeEMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQ2pDLElBQUksZUFBMEMsQ0FBQztRQUMvQyxJQUFJLG1CQUFtQixFQUFFLENBQUM7WUFDekIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3BELElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQ2hCLGVBQWUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUM5QyxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN6QyxDQUFDO1FBQ0YsQ0FBQzthQUFNLElBQUksb0JBQW9CLEVBQUUsQ0FBQztZQUNqQyx1RUFBdUU7WUFDdkUsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN6RCxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQ2pCLDZEQUE2RDtnQkFDN0QsMkVBQTJFO2dCQUMzRSwyRUFBMkU7Z0JBQzNFLEtBQUssTUFBTSxNQUFNLElBQUksSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7b0JBQ3JELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFFLENBQUM7b0JBQzVELElBQUksY0FBYyxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxLQUFLLEtBQUssS0FBSyxFQUFFLENBQUM7d0JBQzFHLFVBQVUsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO3dCQUNwRCxNQUFNO29CQUNQLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7WUFDRCxJQUFJLFVBQVUsRUFBRSxDQUFDO2dCQUNoQixlQUFlLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUMvQyxDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksZUFBZSxFQUFFLENBQUM7WUFDckIsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO2dCQUNwQixNQUFNLElBQUksS0FBSyxDQUFDLCtEQUErRCxDQUFDLENBQUM7WUFDbEYsQ0FBQztZQUVELGVBQWUsQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDMUMsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQy9DLGFBQWEsQ0FBQyxzQkFBc0IsR0FBRyxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLGVBQWUsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7WUFDM0osQ0FBQztZQUNELHFGQUFxRjtZQUNyRixtRkFBbUY7WUFDbkYsSUFBSSxlQUFlLENBQUMscUJBQXFCLEVBQUUsQ0FBQztnQkFDM0MsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxhQUFhLENBQUMscUJBQXFCLEVBQUUsQ0FBQztvQkFDdEYsYUFBYSxDQUFDLFdBQVcsR0FBRyxhQUFhLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMscUJBQXFCLEVBQUUsZUFBZSxDQUFDLHFCQUFxQixDQUFDLENBQUM7Z0JBQzNJLENBQUM7WUFDRixDQUFDO1lBQ0QsTUFBTSxlQUFlLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUU1RCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUNsRSxlQUFlLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3hDLENBQUM7WUFDRCxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQztZQUNuRixPQUFPLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM5QyxDQUFDO1FBRUQsSUFBSSxDQUFDLHNCQUFzQixHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQztRQUN6SCxNQUFNLFFBQVEsR0FBc0IsQ0FBQyxNQUFNLElBQUksQ0FBQyxzQkFBc0IsQ0FBRSxDQUFDO1FBQ3pFLElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLFlBQVksRUFBRSxDQUFDO1lBQy9DLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxzQkFBc0IsR0FBRyxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLGVBQWUsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7UUFDeEssQ0FBQztRQUNELE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDbkQsTUFBTSxZQUFZLEdBQUcsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLHFCQUFxQixFQUFFLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQy9JLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRTtZQUNsRSxJQUFJLENBQUMsc0JBQXNCLENBQUMsUUFBUSxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQ3BELGtCQUFrQixDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQzlCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDSixJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxHQUFHLFlBQVksQ0FBQztRQUM1QyxRQUFRLENBQUMsaUJBQWlCLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQztRQUNqRSxPQUFPLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFTyxzQkFBc0IsQ0FBQyxRQUEyQixFQUFFLGVBQXVCLEVBQUUsWUFBNkMsRUFBRSxPQUFzQixFQUFFLGVBQTBDLEVBQUUsSUFBcUI7UUFDNU4sTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDaEUsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxFQUFFLFlBQVksRUFBRSxRQUFRLENBQUMsQ0FBQztRQUVwRixTQUFTLFdBQVcsQ0FBQyxLQUFhO1lBQ2pDLElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDdkIsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztnQkFDMUosSUFBSSxLQUFLLEtBQUssS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDdkMsT0FBTyxLQUFLLENBQUM7Z0JBQ2QsQ0FBQztZQUNGLENBQUM7WUFDRCxJQUFJLEtBQXlCLENBQUM7WUFDOUIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDdkMsMEJBQTBCO2dCQUMxQixNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BCLElBQUksRUFBRSxLQUFLLEtBQUssRUFBRSxDQUFDO29CQUNsQixLQUFLLEdBQUcsU0FBUyxDQUFDO2dCQUNuQixDQUFDO3FCQUFNLElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRSxDQUFDO29CQUNoQyxxQ0FBcUM7b0JBQ3JDLFNBQVM7Z0JBQ1YsQ0FBQztxQkFBTSxJQUFJLEVBQUUsS0FBSyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztvQkFDNUMsMEJBQTBCO29CQUMxQixDQUFDLEVBQUUsQ0FBQztnQkFDTCxDQUFDO3FCQUFNLElBQUksRUFBRSxLQUFLLGlCQUFpQixDQUFDLE1BQU0sSUFBSSxFQUFFLEtBQUssaUJBQWlCLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBQzdFLEtBQUssR0FBRyxFQUFFLENBQUM7Z0JBQ1osQ0FBQztxQkFBTSxJQUFJLEVBQUUsS0FBSyxHQUFHLEVBQUUsQ0FBQztvQkFDdkIsT0FBTyxJQUFJLENBQUM7Z0JBQ2IsQ0FBQztZQUNGLENBQUM7WUFDRCxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxTQUFTLEtBQUssQ0FBQyxLQUFhLEVBQUUsSUFBa0I7WUFDL0MsSUFBSSxJQUFJLEtBQUssWUFBWSxDQUFDLE1BQU0sSUFBSSxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDOUQsT0FBTyxDQUFDLGlCQUFpQixDQUFDLE1BQU0sR0FBRyxLQUFLLEdBQUcsaUJBQWlCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzVFLENBQUM7aUJBQU0sSUFBSSxJQUFJLEtBQUssWUFBWSxDQUFDLElBQUksSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDakUsT0FBTyxDQUFDLGlCQUFpQixDQUFDLElBQUksR0FBRyxLQUFLLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3hFLENBQUM7aUJBQU0sSUFBSSxJQUFJLEtBQUssWUFBWSxDQUFDLE1BQU0sSUFBSSxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDckUsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7b0JBQzlDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxpQkFBaUIsQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3BFLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7b0JBQzVCLEtBQUssTUFBTSxFQUFFLElBQUksaUJBQWlCLENBQUMsTUFBTSxDQUFDLGFBQWEsRUFBRSxDQUFDO3dCQUN6RCxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDeEIsQ0FBQztvQkFDRCxNQUFNLE1BQU0sR0FBVyxJQUFJLE1BQU0sQ0FBQyxHQUFHLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7b0JBQ3JFLE1BQU0sVUFBVSxHQUFHLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7b0JBQ3ZELE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNyRSxDQUFDO1lBQ0YsQ0FBQztZQUNELE9BQU8sQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDdkIsQ0FBQztRQUVELFNBQVMsZ0JBQWdCLENBQUMsS0FBb0I7WUFDN0MsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQzNCLElBQUksV0FBVyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ3hCLE9BQU8sS0FBSyxDQUFDLEtBQUssRUFBRSxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzFDLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxPQUFPLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUN2QixDQUFDO1lBQ0YsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzFDLENBQUM7UUFDRixDQUFDO1FBRUQsNkhBQTZIO1FBQzdILHlIQUF5SDtRQUN6SCxzQ0FBc0M7UUFDdEMsSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sS0FBSyxlQUF5QixJQUFJLFdBQVcsQ0FBQyxlQUF5QixDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ2xKLE9BQU8sT0FBTyxDQUFDO1FBQ2hCLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7UUFDNUIsSUFBSSxhQUFhLEdBQUcsS0FBSyxDQUFDO1FBQzFCLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQztRQUN0QixJQUFJLEtBQWEsQ0FBQztRQUNsQixJQUFJLE1BQWUsQ0FBQztRQUNwQixDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM1QyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ25CLGFBQWEsR0FBRyxNQUFNLENBQUM7UUFDdkIsS0FBSyxNQUFNLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUN4QixDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsR0FBRyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN4QyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25CLFNBQVMsR0FBRyxTQUFTLElBQUksTUFBTSxDQUFDO1FBQ2pDLENBQUM7UUFFRCxJQUFJLFdBQVcsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ25DLHlEQUF5RDtRQUN6RCxJQUFJLFFBQVEsc0NBQThCLEVBQUUsQ0FBQztZQUM1QyxJQUFJLFFBQVEsS0FBSyxLQUFLLElBQUksYUFBYSxJQUFJLFNBQVMsRUFBRSxDQUFDO2dCQUN0RCxXQUFXLEdBQUcsR0FBRyxHQUFHLFdBQVcsR0FBRyxHQUFHLENBQUM7WUFDdkMsQ0FBQztpQkFBTSxJQUFJLENBQUMsUUFBUSxLQUFLLFlBQVksSUFBSSxRQUFRLEtBQUssTUFBTSxDQUFDLElBQUksYUFBYSxFQUFFLENBQUM7Z0JBQ2hGLFdBQVcsR0FBRyxJQUFJLEdBQUcsV0FBVyxDQUFDO1lBQ2xDLENBQUM7UUFDRixDQUFDO1FBRUQsT0FBTyxXQUFXLENBQUM7SUFDcEIsQ0FBQztJQUVPLGtCQUFrQixDQUFDLGFBQXFCLEVBQUUsWUFBNkMsRUFBRSxRQUEyQjtRQUMzSCxJQUFJLFlBQVksSUFBSSxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDMUMsT0FBTyxZQUFZLENBQUMsT0FBTyxDQUFDO1FBQzdCLENBQUM7UUFDRCxPQUFPLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsSUFBSSxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDakksQ0FBQztJQUVPLHFCQUFxQixDQUFDLFNBQXNCLEVBQUUsSUFBa0M7UUFDdkYsSUFBSSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDdkMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzlELENBQUM7UUFDRCxJQUFJLENBQUMsd0JBQXdCLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUV2RixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxLQUFLLFdBQVcsQ0FBQyxlQUFlLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLGVBQWUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQy9HLElBQUksVUFBZSxDQUFDO1lBQ3BCLElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUN6QixVQUFVLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO1lBQzFDLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxVQUFVLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQzdDLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQztnQkFDdkIsT0FBTyxVQUFVLENBQUMsSUFBSSxDQUFDO1lBQ3hCLENBQUM7WUFDRCxJQUFJLENBQUMsMkJBQTJCLENBQUMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3pELENBQUM7SUFDRixDQUFDO0lBRU8sMkJBQTJCLENBQUMsU0FBc0IsRUFBRSxVQUFlO1FBQzFFLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO1lBQ2hDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDL0MsQ0FBQzthQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO1lBQ3RDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFZLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUM1RixDQUFDO2FBQU0sSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7WUFDdkMsS0FBSyxNQUFNLEdBQUcsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDOUIsSUFBSSxDQUFDLDJCQUEyQixDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUM5RCxDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFTyx3QkFBd0IsQ0FBQyxTQUFzQixFQUFFLE9BQThCLEVBQUUsSUFBa0M7UUFDMUgsOEVBQThFO1FBQzlFLGdCQUFnQjtRQUNoQixJQUFJLE9BQU8sQ0FBQyxPQUFPLEtBQUssV0FBVyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ3JELE9BQU87UUFDUixDQUFDO1FBRUQsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ2hDLE1BQU0sSUFBSSxLQUFLLENBQUMsOENBQThDLENBQUMsQ0FBQztRQUNqRSxDQUFDO1FBQ0QsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDaEQsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDckUsc0JBQXNCO1FBQ3RCLE1BQU0sS0FBSyxHQUEwQixJQUFJLENBQUMsT0FBUSxDQUFDLEtBQUssQ0FBQztRQUN6RCxJQUFJLEtBQUssNkJBQXFCLEVBQUUsQ0FBQztZQUNoQyxTQUFTLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDckMsQ0FBQztRQUNELElBQUksT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3JCLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUM7WUFDaEMsSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ2pCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2hELENBQUM7WUFDRCxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDO1lBQy9CLElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQ2hCLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUU7b0JBQ3ZDLE1BQU0sS0FBSyxHQUFRLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDbkMsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7d0JBQzNCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7b0JBQzFDLENBQUM7Z0JBQ0YsQ0FBQyxDQUFDLENBQUM7WUFDSixDQUFDO1lBQ0QsSUFBSSxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ25CLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztvQkFDOUIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUM3RCxDQUFDO2dCQUNELE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUM1RSxDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFTyx3QkFBd0IsQ0FBQyxTQUFzQixFQUFFLE1BQWtEO1FBQzFHLElBQUksTUFBTSxLQUFLLFNBQVMsSUFBSSxNQUFNLEtBQUssSUFBSSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDcEUsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7WUFDeEIsSUFBSSxPQUF1QixDQUFDO1lBQzVCLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUMzQixJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQztvQkFDdEIsT0FBTyxHQUFHLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzFELENBQUM7cUJBQU0sQ0FBQztvQkFDUCxPQUFPLEdBQUcsc0JBQXNCLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUM3QyxDQUFDO1lBQ0YsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE9BQU8sR0FBRyxLQUFLLENBQUM7WUFDakIsQ0FBQztZQUNELElBQUksT0FBTyxJQUFJLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDbkMsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO29CQUN4QyxJQUFJLENBQUMsaUJBQWlCLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDdkQsQ0FBQztxQkFBTSxDQUFDO29CQUNQLEtBQUssTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUM7d0JBQy9HLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ3ZDLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFTyxpQkFBaUIsQ0FBQyxTQUFzQixFQUFFLEtBQTZCO1FBQzlFLE1BQU0sTUFBTSxHQUFXLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztRQUNuRSxNQUFNLENBQUMsR0FBRyxjQUFjLENBQUM7UUFDekIsSUFBSSxPQUErQixDQUFDO1FBQ3BDLEdBQUcsQ0FBQztZQUNILE9BQU8sR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3pCLElBQUksT0FBTyxFQUFFLENBQUM7Z0JBQ2IsU0FBUyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzQixDQUFDO1FBQ0YsQ0FBQyxRQUFRLE9BQU8sRUFBRTtJQUNuQixDQUFDO0lBRU8sS0FBSyxDQUFDLHNCQUFzQixDQUFDLFFBQTBCLEVBQUUsYUFBb0M7UUFDcEcseUNBQXlDO1FBQ3pDLElBQUksSUFBSSxHQUFvQixhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDakYsSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNwRCxNQUFNLE9BQU8sR0FBa0IsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN6RixPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDO0lBQzFCLENBQUM7SUFJTyxLQUFLLENBQUMsaUJBQWlCLENBQUMsUUFBMEIsRUFBRSxLQUFzQjtRQUNqRixPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFFTyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsUUFBMEIsRUFBRSxNQUFrRDtRQUM1RyxJQUFJLE1BQU0sS0FBSyxTQUFTLElBQUksTUFBTSxLQUFLLElBQUksSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3BFLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztRQUNELE1BQU0sTUFBTSxHQUFxQixFQUFFLENBQUM7UUFDcEMsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUM1QixJQUFJLE9BQXVCLENBQUM7WUFDNUIsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQzNCLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO29CQUN0QixPQUFPLEdBQUcsc0JBQXNCLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDMUQsQ0FBQztxQkFBTSxDQUFDO29CQUNQLE9BQU8sR0FBRyxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzdDLENBQUM7WUFDRixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsT0FBTyxHQUFHLEtBQUssQ0FBQztZQUNqQixDQUFDO1lBQ0QsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNkLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsRUFBRSxxRUFBcUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2pJLFNBQVM7WUFDVixDQUFDO1lBQ0QsTUFBTSxjQUFjLEdBQWdDLFFBQVEsQ0FBQyxjQUFjLENBQUM7WUFDNUUsTUFBTSxhQUFhLEdBQUcsT0FBTyxDQUFDLFVBQVUsS0FBSyxTQUFTLENBQUM7WUFDdkQsTUFBTSxjQUFjLEdBQUcsY0FBYyxLQUFLLFNBQVMsSUFBSSxjQUFjLENBQUMsV0FBVyxLQUFLLFNBQVMsQ0FBQztZQUNoRyxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7Z0JBQ3ZDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDdEIsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ3hDLElBQUksY0FBYyxJQUFJLENBQUMsY0FBYyxLQUFLLFNBQVMsQ0FBQyxFQUFFLENBQUM7b0JBQ3RELElBQUksQ0FBQyxXQUFXLEdBQUcsY0FBYyxDQUFDLFdBQVcsQ0FBQztnQkFDL0MsQ0FBQztnQkFDRCxJQUFJLGFBQWEsRUFBRSxDQUFDO29CQUNuQixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO29CQUNuQyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQzt3QkFDaEMsSUFBSSxDQUFDLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7b0JBQ3JFLENBQUM7eUJBQU0sSUFBSSxVQUFVLEtBQUssU0FBUyxFQUFFLENBQUM7d0JBQ3JDLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDOzRCQUN4QixVQUFVLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztnQ0FDckQsQ0FBQyxDQUFDLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQ0FDcEYsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7d0JBQzlELENBQUM7d0JBQ0QsSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUM7NEJBQ3hCLFVBQVUsQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDO2dDQUNyRCxDQUFDLENBQUMsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dDQUNwRixDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQzt3QkFDOUQsQ0FBQztvQkFDRixDQUFDO2dCQUNGLENBQUM7Z0JBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuQixDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQUlPLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxRQUEwQixFQUFFLEtBQWdDO1FBQzFGLG9HQUFvRztRQUNwRyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUMzQixPQUFPLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDaEMsQ0FBQzthQUFNLElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ2hDLE9BQU87Z0JBQ04sS0FBSyxFQUFFLE1BQU0sUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDO2dCQUMxQyxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU87YUFDdEIsQ0FBQztRQUNILENBQUM7YUFBTSxDQUFDLENBQUMsMkJBQTJCO1lBQ25DLE1BQU0sSUFBSSxLQUFLLENBQUMsd0NBQXdDLENBQUMsQ0FBQztRQUMzRCxDQUFDO0lBQ0YsQ0FBQztJQUVPLEtBQUssQ0FBQyxlQUFlLENBQUMsUUFBMEIsRUFBRSxPQUFtQztRQUM1RixJQUFJLE9BQU8sS0FBSyxTQUFTLElBQUksT0FBTyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQy9DLElBQUksR0FBdUIsQ0FBQztZQUM1QixJQUFJLENBQUM7Z0JBQ0osR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ25FLENBQUM7WUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUNaLGVBQWU7WUFDaEIsQ0FBQztZQUNELE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQztRQUNoQixDQUFDO1FBQ0QsTUFBTSxNQUFNLEdBQW1CLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQztZQUN6RCxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUM3RCxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLG9CQUFvQixDQUFDLEVBQUUsQ0FBQztRQUN4RSxJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNqQixNQUFNLENBQUMsR0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDakMsS0FBSyxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUM1QyxNQUFNLEtBQUssR0FBUSxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNwQyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztvQkFDM0IsTUFBTSxDQUFDLEdBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ2pFLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxNQUFNLENBQUMsR0FBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDckMsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO2FBRU0sc0JBQWlCLEdBQStCO1FBQ3RELEtBQUssRUFBRSxJQUFJO1FBQ1gsT0FBTyxFQUFFLElBQUk7UUFDYixRQUFRLEVBQUUsSUFBSTtRQUNkLFFBQVEsRUFBRSxJQUFJO1FBQ2QsT0FBTyxFQUFFLElBQUk7UUFDYixNQUFNLEVBQUUsSUFBSTtRQUNaLE1BQU0sRUFBRSxJQUFJO1FBQ1osU0FBUyxFQUFFLElBQUk7UUFDZixRQUFRLEVBQUUsSUFBSTtRQUNkLE1BQU0sRUFBRSxJQUFJO1FBQ1osT0FBTyxFQUFFLElBQUk7UUFDYixTQUFTLEVBQUUsSUFBSTtRQUNmLEtBQUssRUFBRSxJQUFJO1FBQ1gsT0FBTyxFQUFFLElBQUk7UUFDYixLQUFLLEVBQUUsSUFBSTtRQUNYLE1BQU0sRUFBRSxJQUFJO1FBQ1osS0FBSyxFQUFFLElBQUk7UUFDWCxRQUFRLEVBQUUsSUFBSTtLQUNkLEFBbkJ1QixDQW1CdEI7SUFFSyxtQkFBbUIsQ0FBQyxHQUFXO1FBQ3JDLElBQUksTUFBTSxHQUFHLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUMvQixNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMzQyxJQUFJLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ2xCLE1BQU0sR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN0QyxDQUFDO1FBQ0QsSUFBSSxrQkFBa0IsQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQ2xELE9BQU8sTUFBTSxDQUFDO1FBQ2YsQ0FBQztRQUNELE9BQU8sT0FBTyxDQUFDO0lBQ2hCLENBQUM7SUFFTSxLQUFLLENBQUMsa0JBQWtCLENBQUMsVUFBa0I7UUFDakQsMERBQTBEO1FBQzFELEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ3JDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDMUMsSUFBSSxVQUFVLENBQUMsUUFBUSxFQUFFLFVBQVUsS0FBSyxVQUFVLEVBQUUsQ0FBQztnQkFDcEQsT0FBTyxVQUFVLENBQUMsSUFBSSxDQUFDO1lBQ3hCLENBQUM7UUFDRixDQUFDO1FBQ0QseUZBQXlGO1FBQ3pGLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDNUQsSUFBSSxZQUFZLEVBQUUsUUFBUSxFQUFFLENBQUM7WUFDNUIsbUVBQW1FO1lBQ25FLE9BQU8sTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN0RCxDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVPLGFBQWEsQ0FBQyxNQUFjO1FBQ25DLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQzVFLGFBQWEsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDL0IsQ0FBQzs7QUFHRixTQUFTLGtCQUFrQixDQUFDLG1CQUF5QyxFQUFFLHVCQUFpRDtJQUN2SCxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxLQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxLQUFLLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDeEYsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sS0FBSyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxZQUFZLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLEtBQUssS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUN6SSxJQUFJLG1CQUFtQixDQUFDLEtBQUssS0FBSyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ2pELE9BQU8sc0NBQXNDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxlQUFlLEVBQUUsc0NBQXNDLENBQUMsQ0FBQyxDQUFDO1lBQ3RILENBQUM7aUJBQU0sSUFBSSxtQkFBbUIsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO2dCQUNqRCxPQUFPLHNDQUFzQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsZUFBZSxFQUFFLDhEQUE4RCxDQUFDLENBQUMsQ0FBQztZQUM5SSxDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsT0FBTyxJQUFJLENBQUM7WUFDYixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFDRCxPQUFPLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDO0FBQ25DLENBQUM7QUFFRCxTQUFTLHNDQUFzQyxDQUFDLE9BQWU7SUFDOUQsT0FBTyxDQUFDLFFBQVEsRUFBRSxFQUFFO1FBQ25CLE9BQU8sR0FBRyxjQUFjLHdDQUE4QixRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsR0FBRyxPQUFPLEVBQUUsQ0FBQztJQUN4RixDQUFDLENBQUM7QUFDSCxDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxRQUEyQjtJQUN2RCxPQUFPLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyx1QkFBdUIsRUFBRSxzQkFBc0IsRUFBRSxJQUF5QyxDQUFDO0FBQzlILENBQUMifQ==