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
var AbstractTaskService_1;
import { Action } from '../../../../base/common/actions.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import * as glob from '../../../../base/common/glob.js';
import * as json from '../../../../base/common/json.js';
import { Disposable, DisposableStore, dispose, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { LRUCache } from '../../../../base/common/map.js';
import * as Objects from '../../../../base/common/objects.js';
import { ValidationStatus } from '../../../../base/common/parsers.js';
import * as Platform from '../../../../base/common/platform.js';
import * as resources from '../../../../base/common/resources.js';
import Severity from '../../../../base/common/severity.js';
import * as Types from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import * as UUID from '../../../../base/common/uuid.js';
import * as nls from '../../../../nls.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IMarkerService } from '../../../../platform/markers/common/markers.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { ProblemMatcherRegistry } from '../common/problemMatcher.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { IWorkspaceContextService, WorkspaceFolder } from '../../../../platform/workspace/common/workspace.js';
import { IConfigurationResolverService } from '../../../services/configurationResolver/common/configurationResolver.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { Markers } from '../../markers/common/markers.js';
import { IOutputService } from '../../../services/output/common/output.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { ITerminalGroupService, ITerminalService } from '../../terminal/browser/terminal.js';
import { ITerminalProfileResolverService } from '../../terminal/common/terminal.js';
import { ConfiguringTask, ContributedTask, CustomTask, ExecutionEngine, InMemoryTask, KeyedTaskIdentifier, RerunAllRunningTasksCommandId, RuntimeType, TASK_RUNNING_STATE, TaskDefinition, TaskEventKind, TaskGroup, TaskSorter, TaskSourceKind, USER_TASKS_GROUP_KEY } from '../common/tasks.js';
import { ChatAgentLocation, ChatModeKind } from '../../chat/common/constants.js';
import { CustomExecutionSupportedContext, ProcessExecutionSupportedContext, ServerlessWebContext, ShellExecutionSupportedContext, TaskCommandsRegistered, TaskExecutionSupportedContext, TasksAvailableContext } from '../common/taskService.js';
import { TaskError, Triggers, VerifiedTask } from '../common/taskSystem.js';
import { getTemplates as getTaskTemplates } from '../common/taskTemplates.js';
import * as TaskConfig from '../common/taskConfiguration.js';
import { TerminalTaskSystem } from './terminalTaskSystem.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { TaskDefinitionRegistry } from '../common/taskDefinitionRegistry.js';
import { getActiveElement } from '../../../../base/browser/dom.js';
import { raceTimeout } from '../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { toFormattedString } from '../../../../base/common/jsonFormatter.js';
import { Schemas } from '../../../../base/common/network.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { TerminalExitReason } from '../../../../platform/terminal/common/terminal.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IWorkspaceTrustManagementService, IWorkspaceTrustRequestService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { VirtualWorkspaceContext } from '../../../common/contextkeys.js';
import { EditorResourceAccessor } from '../../../common/editor.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { IPaneCompositePartService } from '../../../services/panecomposite/browser/panecomposite.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { CHAT_OPEN_ACTION_ID } from '../../chat/browser/actions/chatActions.js';
import { IChatAgentService } from '../../chat/common/chatAgents.js';
import { IChatService } from '../../chat/common/chatService.js';
import { configureTaskIcon, isWorkspaceFolder, QUICKOPEN_DETAIL_CONFIG, QUICKOPEN_SKIP_CONFIG, TaskQuickPick } from './taskQuickPick.js';
import { IHostService } from '../../../services/host/browser/host.js';
import * as dom from '../../../../base/browser/dom.js';
const QUICKOPEN_HISTORY_LIMIT_CONFIG = 'task.quickOpen.history';
const PROBLEM_MATCHER_NEVER_CONFIG = 'task.problemMatchers.neverPrompt';
const USE_SLOW_PICKER = 'task.quickOpen.showAll';
const TaskTerminalType = 'Task';
export var ConfigureTaskAction;
(function (ConfigureTaskAction) {
    ConfigureTaskAction.ID = 'workbench.action.tasks.configureTaskRunner';
    ConfigureTaskAction.TEXT = nls.localize2('ConfigureTaskRunnerAction.label', "Configure Task");
})(ConfigureTaskAction || (ConfigureTaskAction = {}));
class ProblemReporter {
    constructor(_outputChannel) {
        this._outputChannel = _outputChannel;
        this._onDidError = new Emitter();
        this.onDidError = this._onDidError.event;
        this._validationStatus = new ValidationStatus();
    }
    info(message) {
        this._validationStatus.state = 1 /* ValidationState.Info */;
        this._outputChannel.append(message + '\n');
    }
    warn(message) {
        this._validationStatus.state = 2 /* ValidationState.Warning */;
        this._outputChannel.append(message + '\n');
    }
    error(message) {
        this._validationStatus.state = 3 /* ValidationState.Error */;
        this._outputChannel.append(message + '\n');
        this._onDidError.fire(message);
    }
    fatal(message) {
        this._validationStatus.state = 4 /* ValidationState.Fatal */;
        this._outputChannel.append(message + '\n');
        this._onDidError.fire(message);
    }
    get status() {
        return this._validationStatus;
    }
}
class TaskMap {
    constructor() {
        this._store = new Map();
    }
    forEach(callback) {
        this._store.forEach(callback);
    }
    static getKey(workspaceFolder) {
        let key;
        if (Types.isString(workspaceFolder)) {
            key = workspaceFolder;
        }
        else {
            const uri = isWorkspaceFolder(workspaceFolder) ? workspaceFolder.uri : workspaceFolder.configuration;
            key = uri ? uri.toString() : '';
        }
        return key;
    }
    get(workspaceFolder) {
        const key = TaskMap.getKey(workspaceFolder);
        let result = this._store.get(key);
        if (!result) {
            result = [];
            this._store.set(key, result);
        }
        return result;
    }
    add(workspaceFolder, ...task) {
        const key = TaskMap.getKey(workspaceFolder);
        let values = this._store.get(key);
        if (!values) {
            values = [];
            this._store.set(key, values);
        }
        values.push(...task);
    }
    all() {
        const result = [];
        this._store.forEach((values) => result.push(...values));
        return result;
    }
}
let AbstractTaskService = class AbstractTaskService extends Disposable {
    static { AbstractTaskService_1 = this; }
    // private static autoDetectTelemetryName: string = 'taskServer.autoDetect';
    static { this.RecentlyUsedTasks_Key = 'workbench.tasks.recentlyUsedTasks'; }
    static { this.RecentlyUsedTasks_KeyV2 = 'workbench.tasks.recentlyUsedTasks2'; }
    static { this.PersistentTasks_Key = 'workbench.tasks.persistentTasks'; }
    static { this.IgnoreTask010DonotShowAgain_key = 'workbench.tasks.ignoreTask010Shown'; }
    static { this.OutputChannelId = 'tasks'; }
    static { this.OutputChannelLabel = nls.localize('tasks', "Tasks"); }
    static { this._nextHandle = 0; }
    get isReconnected() { return this._tasksReconnected; }
    constructor(_configurationService, _markerService, _outputService, _paneCompositeService, _viewsService, _commandService, _editorService, _fileService, _contextService, _telemetryService, _textFileService, _modelService, _extensionService, _quickInputService, _configurationResolverService, _terminalService, _terminalGroupService, _storageService, _progressService, _openerService, _dialogService, _notificationService, _contextKeyService, _environmentService, _terminalProfileResolverService, _pathService, _textModelResolverService, _preferencesService, _viewDescriptorService, _workspaceTrustRequestService, _workspaceTrustManagementService, _logService, _themeService, _lifecycleService, remoteAgentService, _instantiationService, _chatService, _chatAgentService, _hostService) {
        super();
        this._configurationService = _configurationService;
        this._markerService = _markerService;
        this._outputService = _outputService;
        this._paneCompositeService = _paneCompositeService;
        this._viewsService = _viewsService;
        this._commandService = _commandService;
        this._editorService = _editorService;
        this._fileService = _fileService;
        this._contextService = _contextService;
        this._telemetryService = _telemetryService;
        this._textFileService = _textFileService;
        this._modelService = _modelService;
        this._extensionService = _extensionService;
        this._quickInputService = _quickInputService;
        this._configurationResolverService = _configurationResolverService;
        this._terminalService = _terminalService;
        this._terminalGroupService = _terminalGroupService;
        this._storageService = _storageService;
        this._progressService = _progressService;
        this._openerService = _openerService;
        this._dialogService = _dialogService;
        this._notificationService = _notificationService;
        this._contextKeyService = _contextKeyService;
        this._environmentService = _environmentService;
        this._terminalProfileResolverService = _terminalProfileResolverService;
        this._pathService = _pathService;
        this._textModelResolverService = _textModelResolverService;
        this._preferencesService = _preferencesService;
        this._viewDescriptorService = _viewDescriptorService;
        this._workspaceTrustRequestService = _workspaceTrustRequestService;
        this._workspaceTrustManagementService = _workspaceTrustManagementService;
        this._logService = _logService;
        this._themeService = _themeService;
        this._lifecycleService = _lifecycleService;
        this._instantiationService = _instantiationService;
        this._chatService = _chatService;
        this._chatAgentService = _chatAgentService;
        this._hostService = _hostService;
        this._tasksReconnected = false;
        this._taskSystemListeners = [];
        this._onDidRegisterSupportedExecutions = new Emitter();
        this._onDidRegisterAllSupportedExecutions = new Emitter();
        this._onDidChangeTaskSystemInfo = new Emitter();
        this._willRestart = false;
        this.onDidChangeTaskSystemInfo = this._onDidChangeTaskSystemInfo.event;
        this._onDidReconnectToTasks = new Emitter();
        this.onDidReconnectToTasks = this._onDidReconnectToTasks.event;
        this._onDidChangeTaskConfig = new Emitter();
        this.onDidChangeTaskConfig = this._onDidChangeTaskConfig.event;
        this._onDidChangeTaskProviders = this._register(new Emitter());
        this.onDidChangeTaskProviders = this._onDidChangeTaskProviders.event;
        this._taskRunStartTimes = new Map();
        this._taskRunSources = new Map();
        this._activatedTaskProviders = new Set();
        this.notification = this._register(new MutableDisposable());
        this._whenTaskSystemReady = Event.toPromise(this.onDidChangeTaskSystemInfo);
        this._workspaceTasksPromise = undefined;
        this._taskSystem = undefined;
        this._taskSystemListeners = undefined;
        this._outputChannel = this._outputService.getChannel(AbstractTaskService_1.OutputChannelId);
        this._providers = new Map();
        this._providerTypes = new Map();
        this._taskSystemInfos = new Map();
        this._register(this._contextService.onDidChangeWorkspaceFolders(() => {
            const folderSetup = this._computeWorkspaceFolderSetup();
            if (this.executionEngine !== folderSetup[2]) {
                this._disposeTaskSystemListeners();
                this._taskSystem = undefined;
            }
            this._updateSetup(folderSetup);
            return this._updateWorkspaceTasks(2 /* TaskRunSource.FolderOpen */);
        }));
        this._register(this._configurationService.onDidChangeConfiguration(async (e) => {
            if (!e.affectsConfiguration('tasks') || (!this._taskSystem && !this._workspaceTasksPromise)) {
                return;
            }
            if (!this._taskSystem || this._taskSystem instanceof TerminalTaskSystem) {
                this._outputChannel.clear();
            }
            if (e.affectsConfiguration("task.reconnection" /* TaskSettingId.Reconnection */)) {
                if (!this._configurationService.getValue("task.reconnection" /* TaskSettingId.Reconnection */)) {
                    this._persistentTasks?.clear();
                    this._storageService.remove(AbstractTaskService_1.PersistentTasks_Key, 1 /* StorageScope.WORKSPACE */);
                }
            }
            this._setTaskLRUCacheLimit();
            const mapStringToFolderTasks = await this._updateWorkspaceTasks(3 /* TaskRunSource.ConfigurationChange */);
            this._onDidChangeTaskConfig.fire();
            // Loop through all workspaceFolderTask result
            for (const [folderUri, folderResult] of mapStringToFolderTasks) {
                if (!folderResult.set?.tasks?.length) {
                    continue;
                }
                for (const task of folderResult.set.tasks) {
                    const realUniqueId = task._id;
                    const lastTask = this._taskSystem?.lastTask?.task._id;
                    if (lastTask && lastTask === realUniqueId && folderUri !== 'setting') {
                        const verifiedLastTask = new VerifiedTask(task, this._taskSystem.lastTask.resolver, Triggers.command);
                        this._taskSystem.lastTask = verifiedLastTask;
                    }
                }
            }
        }));
        this._taskRunningState = TASK_RUNNING_STATE.bindTo(_contextKeyService);
        this._tasksAvailableState = TasksAvailableContext.bindTo(_contextKeyService);
        this._onDidStateChange = this._register(new Emitter());
        this._registerCommands().then(() => TaskCommandsRegistered.bindTo(this._contextKeyService).set(true));
        ServerlessWebContext.bindTo(this._contextKeyService).set(Platform.isWeb && !remoteAgentService.getConnection()?.remoteAuthority);
        this._configurationResolverService.contributeVariable('defaultBuildTask', async () => {
            // delay provider activation, we might find a single default build task in the tasks.json file
            let tasks = await this._getTasksForGroup(TaskGroup.Build, true);
            if (tasks.length > 0) {
                const defaults = this._getDefaultTasks(tasks);
                if (defaults.length === 1) {
                    return defaults[0]._label;
                }
            }
            // activate all providers, we haven't found the default build task in the tasks.json file
            tasks = await this._getTasksForGroup(TaskGroup.Build);
            const defaults = this._getDefaultTasks(tasks);
            if (defaults.length === 1) {
                return defaults[0]._label;
            }
            else if (defaults.length) {
                tasks = defaults;
            }
            let entry;
            if (tasks && tasks.length > 0) {
                entry = await this._showQuickPick(tasks, nls.localize('TaskService.pickBuildTaskForLabel', 'Select the build task (there is no default build task defined)'));
            }
            const task = entry ? entry.task : undefined;
            if (!task) {
                return undefined;
            }
            return task._label;
        });
        this._register(this._lifecycleService.onBeforeShutdown(e => {
            this._willRestart = e.reason !== 3 /* ShutdownReason.RELOAD */;
        }));
        this._register(this.onDidStateChange(async (e) => {
            this._log(nls.localize('taskEvent', 'Task Event kind: {0}', e.kind), true);
            switch (e.kind) {
                case TaskEventKind.Start:
                    this._taskRunStartTimes.set(e.taskId, Date.now());
                    break;
                case TaskEventKind.ProcessEnded: {
                    const processEndedEvent = e;
                    const startTime = this._taskRunStartTimes.get(e.taskId);
                    if (!startTime) {
                        break;
                    }
                    const durationMs = processEndedEvent.durationMs ?? (Date.now() - startTime);
                    if (durationMs !== undefined) {
                        this._handleLongRunningTaskCompletion(processEndedEvent, durationMs);
                    }
                    this._taskRunStartTimes.delete(e.taskId);
                    this._taskRunSources.delete(e.taskId);
                    break;
                }
                case TaskEventKind.Inactive: {
                    const processEndedEvent = e;
                    const startTime = this._taskRunStartTimes.get(e.taskId);
                    if (!startTime) {
                        break;
                    }
                    const durationMs = processEndedEvent.durationMs ?? (Date.now() - startTime);
                    if (durationMs !== undefined) {
                        this._handleLongRunningTaskCompletion(processEndedEvent, durationMs);
                    }
                    this._taskRunStartTimes.delete(e.taskId);
                    this._taskRunSources.delete(e.taskId);
                    break;
                }
                case TaskEventKind.Terminated:
                    this._taskRunStartTimes.delete(e.taskId);
                    this._taskRunSources.delete(e.taskId);
                    break;
            }
            if (e.kind === TaskEventKind.Changed) {
                // no-op
            }
            else if ((this._willRestart || (e.kind === TaskEventKind.Terminated && e.exitReason === TerminalExitReason.User)) && e.taskId) {
                const key = e.__task.getKey();
                if (key) {
                    this.removePersistentTask(key);
                }
            }
            else if (e.kind === TaskEventKind.Start && e.__task && e.__task.getWorkspaceFolder()) {
                this._setPersistentTask(e.__task);
            }
        }));
        this._waitForAllSupportedExecutions = new Promise(resolve => {
            Event.once(this._onDidRegisterAllSupportedExecutions.event)(() => resolve());
        });
        this._terminalService.whenConnected.then(() => {
            const reconnectedInstances = this._terminalService.instances.filter(e => e.reconnectionProperties?.ownerId === TaskTerminalType);
            if (reconnectedInstances.length) {
                this._attemptTaskReconnection();
            }
            else {
                this._tasksReconnected = true;
                this._onDidReconnectToTasks.fire();
            }
        });
        this._upgrade();
    }
    registerSupportedExecutions(custom, shell, process) {
        if (custom !== undefined) {
            const customContext = CustomExecutionSupportedContext.bindTo(this._contextKeyService);
            customContext.set(custom);
        }
        const isVirtual = !!VirtualWorkspaceContext.getValue(this._contextKeyService);
        if (shell !== undefined) {
            const shellContext = ShellExecutionSupportedContext.bindTo(this._contextKeyService);
            shellContext.set(shell && !isVirtual);
        }
        if (process !== undefined) {
            const processContext = ProcessExecutionSupportedContext.bindTo(this._contextKeyService);
            processContext.set(process && !isVirtual);
        }
        // update tasks so an incomplete list isn't returned when getWorkspaceTasks is called
        this._workspaceTasksPromise = undefined;
        this._onDidRegisterSupportedExecutions.fire();
        if (ServerlessWebContext.getValue(this._contextKeyService) || (custom && shell && process)) {
            this._onDidRegisterAllSupportedExecutions.fire();
        }
    }
    _attemptTaskReconnection() {
        if (this._lifecycleService.startupKind !== 3 /* StartupKind.ReloadedWindow */) {
            this._log(nls.localize('TaskService.skippingReconnection', 'Startup kind not window reload, setting connected and removing persistent tasks'), true);
            this._tasksReconnected = true;
            this._storageService.remove(AbstractTaskService_1.PersistentTasks_Key, 1 /* StorageScope.WORKSPACE */);
        }
        if (!this._configurationService.getValue("task.reconnection" /* TaskSettingId.Reconnection */) || this._tasksReconnected) {
            this._log(nls.localize('TaskService.notConnecting', 'Setting tasks connected configured value {0}, tasks were already reconnected {1}', this._configurationService.getValue("task.reconnection" /* TaskSettingId.Reconnection */), this._tasksReconnected), true);
            this._tasksReconnected = true;
            return;
        }
        this._log(nls.localize('TaskService.reconnecting', 'Reconnecting to running tasks...'), true);
        this.getWorkspaceTasks(4 /* TaskRunSource.Reconnect */).then(async () => {
            this._tasksReconnected = await this._reconnectTasks();
            this._log(nls.localize('TaskService.reconnected', 'Reconnected to running tasks.'), true);
            this._onDidReconnectToTasks.fire();
        });
    }
    async _handleLongRunningTaskCompletion(event, durationMs) {
        const notificationThreshold = this._configurationService.getValue("task.notifyWindowOnTaskCompletion" /* TaskSettingId.NotifyWindowOnTaskCompletion */);
        // If threshold is -1, notifications are disabled
        // If threshold is 0, always show notifications (no minimum duration)
        // Otherwise, only show if duration meets or exceeds the threshold
        if (notificationThreshold === -1 || (notificationThreshold > 0 && durationMs < notificationThreshold)) {
            return;
        }
        const taskRunSource = this._taskRunSources.get(event.taskId);
        if (taskRunSource === 5 /* TaskRunSource.ChatAgent */) {
            return;
        }
        const terminalForTask = this._terminalService.instances.find(i => i.instanceId === event.terminalId);
        if (!terminalForTask) {
            return;
        }
        const taskLabel = terminalForTask.title;
        const targetWindow = dom.getWindow(terminalForTask.domElement);
        if (targetWindow.document.hasFocus()) {
            return;
        }
        const durationText = this._formatTaskDuration(durationMs);
        const message = taskLabel
            ? nls.localize('task.longRunningTaskCompletedWithLabel', 'Task "{0}" finished in {1}.', taskLabel, durationText)
            : nls.localize('task.longRunningTaskCompleted', 'Task finished in {0}.', durationText);
        this._hostService.focus(targetWindow, { mode: 1 /* FocusMode.Notify */ });
        const notification = await dom.triggerNotification(message);
        if (notification) {
            const disposables = this.notification.value = new DisposableStore();
            disposables.add(notification);
            disposables.add(Event.once(notification.onClick)(() => {
                this._hostService.focus(targetWindow, { mode: 2 /* FocusMode.Force */ });
            }));
            disposables.add(this._hostService.onDidChangeFocus(focus => {
                if (focus) {
                    disposables.dispose();
                }
            }));
        }
    }
    _formatTaskDuration(durationMs) {
        const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        if (minutes > 0) {
            return seconds > 0
                ? nls.localize('task.longRunningTaskDurationMinutesSeconds', '{0}m {1}s', minutes, seconds)
                : nls.localize('task.longRunningTaskDurationMinutes', '{0}m', minutes);
        }
        return nls.localize('task.longRunningTaskDurationSeconds', '{0}s', seconds);
    }
    async _reconnectTasks() {
        const tasks = await this.getSavedTasks('persistent');
        if (!tasks.length) {
            this._log(nls.localize('TaskService.noTasks', 'No persistent tasks to reconnect.'), true);
            return true;
        }
        const taskLabels = tasks.map(task => task._label).join(', ');
        this._log(nls.localize('TaskService.reconnectingTasks', 'Reconnecting to {0} tasks...', taskLabels), true);
        for (const task of tasks) {
            if (ConfiguringTask.is(task)) {
                const resolved = await this.tryResolveTask(task);
                if (resolved) {
                    this.run(resolved, undefined, 4 /* TaskRunSource.Reconnect */);
                }
            }
            else {
                this.run(task, undefined, 4 /* TaskRunSource.Reconnect */);
            }
        }
        return true;
    }
    get onDidStateChange() {
        return this._onDidStateChange.event;
    }
    get supportsMultipleTaskExecutions() {
        return this.inTerminal();
    }
    async _registerCommands() {
        CommandsRegistry.registerCommand({
            id: 'workbench.action.tasks.runTask',
            handler: async (accessor, arg) => {
                if (await this._trust()) {
                    await this._runTaskCommand(arg);
                }
            },
            metadata: {
                description: 'Run Task',
                args: [{
                        name: 'args',
                        isOptional: true,
                        description: nls.localize('runTask.arg', "Filters the tasks shown in the quickpick"),
                        schema: {
                            anyOf: [
                                {
                                    type: 'string',
                                    description: nls.localize('runTask.label', "The task's label or a term to filter by")
                                },
                                {
                                    type: 'object',
                                    properties: {
                                        type: {
                                            type: 'string',
                                            description: nls.localize('runTask.type', "The contributed task type")
                                        },
                                        task: {
                                            type: 'string',
                                            description: nls.localize('runTask.task', "The task's label or a term to filter by")
                                        }
                                    }
                                }
                            ]
                        }
                    }]
            }
        });
        CommandsRegistry.registerCommand('workbench.action.tasks.reRunTask', async (accessor) => {
            if (await this._trust()) {
                this._reRunTaskCommand();
            }
        });
        CommandsRegistry.registerCommand('workbench.action.tasks.restartTask', async (accessor, arg) => {
            if (await this._trust()) {
                this._runRestartTaskCommand(arg);
            }
        });
        CommandsRegistry.registerCommand(RerunAllRunningTasksCommandId, async (accessor) => {
            if (await this._trust()) {
                this._runRerunAllRunningTasksCommand();
            }
        });
        CommandsRegistry.registerCommand('workbench.action.tasks.terminate', async (accessor, arg) => {
            if (await this._trust()) {
                this._runTerminateCommand(arg);
            }
        });
        CommandsRegistry.registerCommand('workbench.action.tasks.showLog', () => {
            this._showOutput(undefined, true);
        });
        CommandsRegistry.registerCommand('workbench.action.tasks.build', async () => {
            if (await this._trust()) {
                this._runBuildCommand();
            }
        });
        CommandsRegistry.registerCommand('workbench.action.tasks.test', async () => {
            if (await this._trust()) {
                this._runTestCommand();
            }
        });
        CommandsRegistry.registerCommand('workbench.action.tasks.configureTaskRunner', async () => {
            if (await this._trust()) {
                this._runConfigureTasks();
            }
        });
        CommandsRegistry.registerCommand('workbench.action.tasks.configureDefaultBuildTask', async () => {
            if (await this._trust()) {
                this._runConfigureDefaultBuildTask();
            }
        });
        CommandsRegistry.registerCommand('workbench.action.tasks.configureDefaultTestTask', async () => {
            if (await this._trust()) {
                this._runConfigureDefaultTestTask();
            }
        });
        CommandsRegistry.registerCommand('workbench.action.tasks.showTasks', async () => {
            if (await this._trust()) {
                return this.runShowTasks();
            }
        });
        CommandsRegistry.registerCommand('workbench.action.tasks.toggleProblems', () => this._commandService.executeCommand(Markers.TOGGLE_MARKERS_VIEW_ACTION_ID));
        CommandsRegistry.registerCommand('workbench.action.tasks.openUserTasks', async () => {
            const resource = this._getResourceForKind(TaskSourceKind.User);
            if (resource) {
                this._openTaskFile(resource, TaskSourceKind.User);
            }
        });
        CommandsRegistry.registerCommand('workbench.action.tasks.openWorkspaceFileTasks', async () => {
            const resource = this._getResourceForKind(TaskSourceKind.WorkspaceFile);
            if (resource) {
                this._openTaskFile(resource, TaskSourceKind.WorkspaceFile);
            }
        });
    }
    get workspaceFolders() {
        if (!this._workspaceFolders) {
            this._updateSetup();
        }
        return this._workspaceFolders;
    }
    get ignoredWorkspaceFolders() {
        if (!this._ignoredWorkspaceFolders) {
            this._updateSetup();
        }
        return this._ignoredWorkspaceFolders;
    }
    get executionEngine() {
        if (this._executionEngine === undefined) {
            this._updateSetup();
        }
        return this._executionEngine;
    }
    get schemaVersion() {
        if (this._schemaVersion === undefined) {
            this._updateSetup();
        }
        return this._schemaVersion;
    }
    get showIgnoreMessage() {
        if (this._showIgnoreMessage === undefined) {
            this._showIgnoreMessage = !this._storageService.getBoolean(AbstractTaskService_1.IgnoreTask010DonotShowAgain_key, 1 /* StorageScope.WORKSPACE */, false);
        }
        return this._showIgnoreMessage;
    }
    _getActivationEvents(type) {
        const result = [];
        result.push('onCommand:workbench.action.tasks.runTask');
        if (type) {
            // send a specific activation event for this task type
            result.push(`onTaskType:${type}`);
        }
        else {
            // send activation events for all task types
            for (const definition of TaskDefinitionRegistry.all()) {
                result.push(`onTaskType:${definition.taskType}`);
            }
        }
        return result;
    }
    async _activateTaskProviders(type) {
        // We need to first wait for extensions to be registered because we might read
        // the `TaskDefinitionRegistry` in case `type` is `undefined`
        await this._extensionService.whenInstalledExtensionsRegistered();
        const hasLoggedActivation = this._activatedTaskProviders.has(type ?? 'all');
        if (!hasLoggedActivation) {
            this._log('Activating task providers ' + (type ?? 'all'));
        }
        const result = await raceTimeout(Promise.all(this._getActivationEvents(type).map(activationEvent => this._extensionService.activateByEvent(activationEvent))), 5000, () => this._logService.warn('Timed out activating extensions for task providers'));
        if (result) {
            this._activatedTaskProviders.add(type ?? 'all');
        }
    }
    _updateSetup(setup) {
        if (!setup) {
            setup = this._computeWorkspaceFolderSetup();
        }
        this._workspaceFolders = setup[0];
        if (this._ignoredWorkspaceFolders) {
            if (this._ignoredWorkspaceFolders.length !== setup[1].length) {
                this._showIgnoreMessage = undefined;
            }
            else {
                const set = new Set();
                this._ignoredWorkspaceFolders.forEach(folder => set.add(folder.uri.toString()));
                for (const folder of setup[1]) {
                    if (!set.has(folder.uri.toString())) {
                        this._showIgnoreMessage = undefined;
                        break;
                    }
                }
            }
        }
        this._ignoredWorkspaceFolders = setup[1];
        this._executionEngine = setup[2];
        this._schemaVersion = setup[3];
        this._workspace = setup[4];
    }
    _showOutput(runSource = 1 /* TaskRunSource.User */, userRequested, errorMessage) {
        if (!VirtualWorkspaceContext.getValue(this._contextKeyService) && ((runSource === 1 /* TaskRunSource.User */) || (runSource === 3 /* TaskRunSource.ConfigurationChange */))) {
            if (userRequested) {
                this._outputService.showChannel(this._outputChannel.id, true);
            }
            else {
                const chatEnabled = this._chatService.isEnabled(ChatAgentLocation.Chat);
                const actions = [];
                if (chatEnabled && errorMessage) {
                    const beforeJSONregex = /^(.*?)\s*\{[\s\S]*$/;
                    const matches = errorMessage.match(beforeJSONregex);
                    if (matches && matches.length > 1) {
                        const message = matches[1];
                        const customMessage = message === errorMessage
                            ? `\`${message}\``
                            : `\`${message}\`\n\`\`\`json${errorMessage}\`\`\``;
                        const defaultAgent = this._chatAgentService.getDefaultAgent(ChatAgentLocation.Chat);
                        if (defaultAgent) {
                            actions.push({
                                label: nls.localize('troubleshootWithChat', "Fix with AI"),
                                run: async () => {
                                    this._commandService.executeCommand(CHAT_OPEN_ACTION_ID, {
                                        mode: ChatModeKind.Agent,
                                        query: `Fix this task configuration error: ${customMessage}`
                                    });
                                }
                            });
                        }
                    }
                }
                actions.push({
                    label: nls.localize('showOutput', "Show Output"),
                    run: () => {
                        this._outputService.showChannel(this._outputChannel.id, true);
                    }
                });
                if (chatEnabled && actions.length > 1) {
                    this._notificationService.prompt(Severity.Warning, nls.localize('taskServiceOutputPromptChat', 'There are task errors. Use chat to fix them or view the output for details.'), actions);
                }
                else {
                    this._notificationService.prompt(Severity.Warning, nls.localize('taskServiceOutputPrompt', 'There are task errors. See the output for details.'), actions);
                }
            }
        }
    }
    _disposeTaskSystemListeners() {
        if (this._taskSystemListeners) {
            dispose(this._taskSystemListeners);
            this._taskSystemListeners = undefined;
        }
    }
    registerTaskProvider(provider, type) {
        if (!provider) {
            return {
                dispose: () => { }
            };
        }
        const handle = AbstractTaskService_1._nextHandle++;
        this._providers.set(handle, provider);
        this._providerTypes.set(handle, type);
        this._onDidChangeTaskProviders.fire();
        return {
            dispose: () => {
                this._providers.delete(handle);
                this._providerTypes.delete(handle);
                this._onDidChangeTaskProviders.fire();
            }
        };
    }
    get hasTaskSystemInfo() {
        const infosCount = Array.from(this._taskSystemInfos.values()).flat().length;
        // If there's a remoteAuthority, then we end up with 2 taskSystemInfos,
        // one for each extension host.
        if (this._environmentService.remoteAuthority) {
            return infosCount > 1;
        }
        return infosCount > 0;
    }
    registerTaskSystem(key, info) {
        // Ideally the Web caller of registerRegisterTaskSystem would use the correct key.
        // However, the caller doesn't know about the workspace folders at the time of the call, even though we know about them here.
        if (info.platform === 0 /* Platform.Platform.Web */) {
            key = this.workspaceFolders.length ? this.workspaceFolders[0].uri.scheme : key;
        }
        if (!this._taskSystemInfos.has(key)) {
            this._taskSystemInfos.set(key, [info]);
        }
        else {
            const infos = this._taskSystemInfos.get(key);
            if (info.platform === 0 /* Platform.Platform.Web */) {
                // Web infos should be pushed last.
                infos.push(info);
            }
            else {
                infos.unshift(info);
            }
        }
        if (this.hasTaskSystemInfo) {
            this._onDidChangeTaskSystemInfo.fire();
        }
    }
    _getTaskSystemInfo(key) {
        const infos = this._taskSystemInfos.get(key);
        return (infos && infos.length) ? infos[0] : undefined;
    }
    extensionCallbackTaskComplete(task, result) {
        if (!this._taskSystem) {
            return Promise.resolve();
        }
        return this._taskSystem.customExecutionComplete(task, result);
    }
    /**
     * Get a subset of workspace tasks that match a certain predicate.
     */
    async _findWorkspaceTasks(predicate) {
        const result = [];
        const tasks = await this.getWorkspaceTasks();
        for (const [, workspaceTasks] of tasks) {
            if (workspaceTasks.configurations) {
                for (const taskName in workspaceTasks.configurations.byIdentifier) {
                    const task = workspaceTasks.configurations.byIdentifier[taskName];
                    if (predicate(task, workspaceTasks.workspaceFolder)) {
                        result.push(task);
                    }
                }
            }
            if (workspaceTasks.set) {
                for (const task of workspaceTasks.set.tasks) {
                    if (predicate(task, workspaceTasks.workspaceFolder)) {
                        result.push(task);
                    }
                }
            }
        }
        return result;
    }
    async _findWorkspaceTasksInGroup(group, isDefault) {
        return this._findWorkspaceTasks((task) => {
            const taskGroup = task.configurationProperties.group;
            if (taskGroup && typeof taskGroup !== 'string') {
                return (taskGroup._id === group._id && (!isDefault || !!taskGroup.isDefault));
            }
            return false;
        });
    }
    async getTask(folder, identifier, compareId = false, type = undefined) {
        if (!(await this._trust())) {
            return;
        }
        const name = Types.isString(folder) ? folder : isWorkspaceFolder(folder) ? folder.name : folder.configuration ? resources.basename(folder.configuration) : undefined;
        if (this.ignoredWorkspaceFolders.some(ignored => ignored.name === name)) {
            return Promise.reject(new Error(nls.localize('TaskServer.folderIgnored', 'The folder {0} is ignored since it uses task version 0.1.0', name)));
        }
        const key = !Types.isString(identifier)
            ? TaskDefinition.createTaskIdentifier(identifier, console)
            : identifier;
        if (key === undefined) {
            return Promise.resolve(undefined);
        }
        // Try to find the task in the workspace
        const requestedFolder = TaskMap.getKey(folder);
        const matchedTasks = await this._findWorkspaceTasks((task, workspaceFolder) => {
            const taskFolder = TaskMap.getKey(workspaceFolder);
            if (taskFolder !== requestedFolder && taskFolder !== USER_TASKS_GROUP_KEY) {
                return false;
            }
            return task.matches(key, compareId);
        });
        matchedTasks.sort(task => task._source.kind === TaskSourceKind.Extension ? 1 : -1);
        if (matchedTasks.length > 0) {
            // Nice, we found a configured task!
            const task = matchedTasks[0];
            if (ConfiguringTask.is(task)) {
                return this.tryResolveTask(task);
            }
            else {
                return task;
            }
        }
        // We didn't find the task, so we need to ask all resolvers about it
        const map = await this._getGroupedTasks({ type });
        let values = map.get(folder);
        values = values.concat(map.get(USER_TASKS_GROUP_KEY));
        if (!values) {
            return undefined;
        }
        values = values.filter(task => task.matches(key, compareId)).sort(task => task._source.kind === TaskSourceKind.Extension ? 1 : -1);
        return values.length > 0 ? values[0] : undefined;
    }
    async tryResolveTask(configuringTask) {
        if (!(await this._trust())) {
            return;
        }
        await this._activateTaskProviders(configuringTask.type);
        let matchingProvider;
        let matchingProviderUnavailable = false;
        for (const [handle, provider] of this._providers) {
            const providerType = this._providerTypes.get(handle);
            if (configuringTask.type === providerType) {
                if (providerType && !this._isTaskProviderEnabled(providerType)) {
                    matchingProviderUnavailable = true;
                    continue;
                }
                matchingProvider = provider;
                break;
            }
        }
        if (!matchingProvider) {
            if (matchingProviderUnavailable) {
                this._log(nls.localize('TaskService.providerUnavailable', 'Warning: {0} tasks are unavailable in the current environment.', configuringTask.configures.type));
            }
            return;
        }
        // Try to resolve the task first
        try {
            const resolvedTask = await matchingProvider.resolveTask(configuringTask);
            if (resolvedTask && (resolvedTask._id === configuringTask._id)) {
                return TaskConfig.createCustomTask(resolvedTask, configuringTask);
            }
        }
        catch (error) {
            // Ignore errors. The task could not be provided by any of the providers.
        }
        // The task couldn't be resolved. Instead, use the less efficient provideTask.
        const tasks = await this.tasks({ type: configuringTask.type });
        for (const task of tasks) {
            if (task._id === configuringTask._id) {
                return TaskConfig.createCustomTask(task, configuringTask);
            }
        }
        return;
    }
    async tasks(filter) {
        if (!(await this._trust())) {
            return [];
        }
        if (!this._versionAndEngineCompatible(filter)) {
            return Promise.resolve([]);
        }
        return this._getGroupedTasks(filter).then((map) => this.applyFilterToTaskMap(filter, map));
    }
    async getKnownTasks(filter) {
        if (!this._versionAndEngineCompatible(filter)) {
            return Promise.resolve([]);
        }
        return this._getGroupedTasks(filter, true, true).then((map) => this.applyFilterToTaskMap(filter, map));
    }
    taskTypes() {
        const types = [];
        if (this._isProvideTasksEnabled()) {
            for (const definition of TaskDefinitionRegistry.all()) {
                if (this._isTaskProviderEnabled(definition.taskType)) {
                    types.push(definition.taskType);
                }
            }
        }
        return types;
    }
    createSorter() {
        return new TaskSorter(this._contextService.getWorkspace() ? this._contextService.getWorkspace().folders : []);
    }
    _isActive() {
        if (!this._taskSystem) {
            return Promise.resolve(false);
        }
        return this._taskSystem.isActive();
    }
    async getActiveTasks() {
        if (!this._taskSystem) {
            return [];
        }
        return this._taskSystem.getActiveTasks();
    }
    async getBusyTasks() {
        if (!this._taskSystem) {
            return [];
        }
        return this._taskSystem.getBusyTasks();
    }
    getRecentlyUsedTasksV1() {
        if (this._recentlyUsedTasksV1) {
            return this._recentlyUsedTasksV1;
        }
        const quickOpenHistoryLimit = this._configurationService.getValue(QUICKOPEN_HISTORY_LIMIT_CONFIG);
        this._recentlyUsedTasksV1 = new LRUCache(quickOpenHistoryLimit);
        const storageValue = this._storageService.get(AbstractTaskService_1.RecentlyUsedTasks_Key, 1 /* StorageScope.WORKSPACE */);
        if (storageValue) {
            try {
                const values = JSON.parse(storageValue);
                if (Array.isArray(values)) {
                    for (const value of values) {
                        this._recentlyUsedTasksV1.set(value, value);
                    }
                }
            }
            catch (error) {
                // Ignore. We use the empty result
            }
        }
        return this._recentlyUsedTasksV1;
    }
    applyFilterToTaskMap(filter, map) {
        if (!filter || !filter.type) {
            return map.all();
        }
        const result = [];
        map.forEach((tasks) => {
            for (const task of tasks) {
                if (ContributedTask.is(task) && ((task.defines.type === filter.type) || (task._source.label === filter.type))) {
                    result.push(task);
                }
                else if (CustomTask.is(task)) {
                    if (task.type === filter.type) {
                        result.push(task);
                    }
                    else {
                        const customizes = task.customizes();
                        if (customizes && customizes.type === filter.type) {
                            result.push(task);
                        }
                    }
                }
            }
        });
        return result;
    }
    _getTasksFromStorage(type) {
        return type === 'persistent' ? this._getPersistentTasks() : this._getRecentTasks();
    }
    _getRecentTasks() {
        if (this._recentlyUsedTasks) {
            return this._recentlyUsedTasks;
        }
        const quickOpenHistoryLimit = this._configurationService.getValue(QUICKOPEN_HISTORY_LIMIT_CONFIG);
        this._recentlyUsedTasks = new LRUCache(quickOpenHistoryLimit);
        const storageValue = this._storageService.get(AbstractTaskService_1.RecentlyUsedTasks_KeyV2, 1 /* StorageScope.WORKSPACE */);
        if (storageValue) {
            try {
                const values = JSON.parse(storageValue);
                if (Array.isArray(values)) {
                    for (const value of values) {
                        this._recentlyUsedTasks.set(value[0], value[1]);
                    }
                }
            }
            catch (error) {
                // Ignore. We use the empty result
            }
        }
        return this._recentlyUsedTasks;
    }
    _getPersistentTasks() {
        if (this._persistentTasks) {
            this._log(nls.localize('taskService.gettingCachedTasks', 'Returning cached tasks {0}', this._persistentTasks.size), true);
            return this._persistentTasks;
        }
        //TODO: should this # be configurable?
        this._persistentTasks = new LRUCache(10);
        const storageValue = this._storageService.get(AbstractTaskService_1.PersistentTasks_Key, 1 /* StorageScope.WORKSPACE */);
        if (storageValue) {
            try {
                const values = JSON.parse(storageValue);
                if (Array.isArray(values)) {
                    for (const value of values) {
                        this._persistentTasks.set(value[0], value[1]);
                    }
                }
            }
            catch (error) {
                // Ignore. We use the empty result
            }
        }
        return this._persistentTasks;
    }
    _getFolderFromTaskKey(key) {
        const keyValue = JSON.parse(key);
        return {
            folder: keyValue.folder, isWorkspaceFile: keyValue.id?.endsWith(TaskSourceKind.WorkspaceFile)
        };
    }
    async getSavedTasks(type) {
        const folderMap = Object.create(null);
        this.workspaceFolders.forEach(folder => {
            folderMap[folder.uri.toString()] = folder;
        });
        const folderToTasksMap = new Map();
        const workspaceToTaskMap = new Map();
        const storedTasks = this._getTasksFromStorage(type);
        const tasks = [];
        this._log(nls.localize('taskService.getSavedTasks', 'Fetching tasks from task storage.'), true);
        function addTaskToMap(map, folder, task) {
            if (folder && !map.has(folder)) {
                map.set(folder, []);
            }
            if (folder && (folderMap[folder] || (folder === USER_TASKS_GROUP_KEY)) && task) {
                map.get(folder).push(task);
            }
        }
        for (const entry of storedTasks.entries()) {
            try {
                const key = entry[0];
                const task = JSON.parse(entry[1]);
                const folderInfo = this._getFolderFromTaskKey(key);
                this._log(nls.localize('taskService.getSavedTasks.reading', 'Reading tasks from task storage, {0}, {1}, {2}', key, task, folderInfo.folder), true);
                addTaskToMap(folderInfo.isWorkspaceFile ? workspaceToTaskMap : folderToTasksMap, folderInfo.folder, task);
            }
            catch (error) {
                this._log(nls.localize('taskService.getSavedTasks.error', 'Fetching a task from task storage failed: {0}.', error), true);
            }
        }
        const readTasksMap = new Map();
        async function readTasks(that, map, isWorkspaceFile) {
            for (const key of map.keys()) {
                const custom = [];
                const customized = Object.create(null);
                const taskConfigSource = (folderMap[key]
                    ? (isWorkspaceFile
                        ? TaskConfig.TaskConfigSource.WorkspaceFile : TaskConfig.TaskConfigSource.TasksJson)
                    : TaskConfig.TaskConfigSource.User);
                await that._computeTasksForSingleConfig(folderMap[key] ?? await that._getAFolder(), {
                    version: '2.0.0',
                    tasks: map.get(key)
                }, 0 /* TaskRunSource.System */, custom, customized, taskConfigSource, true);
                custom.forEach(task => {
                    const taskKey = task.getKey();
                    if (taskKey) {
                        readTasksMap.set(taskKey, task);
                    }
                });
                for (const configuration in customized) {
                    const taskKey = customized[configuration].getKey();
                    if (taskKey) {
                        readTasksMap.set(taskKey, customized[configuration]);
                    }
                }
            }
        }
        await readTasks(this, folderToTasksMap, false);
        await readTasks(this, workspaceToTaskMap, true);
        for (const key of storedTasks.keys()) {
            if (readTasksMap.has(key)) {
                tasks.push(readTasksMap.get(key));
                this._log(nls.localize('taskService.getSavedTasks.resolved', 'Resolved task {0}', key), true);
            }
            else {
                this._log(nls.localize('taskService.getSavedTasks.unresolved', 'Unable to resolve task {0} ', key), true);
            }
        }
        return tasks;
    }
    removeRecentlyUsedTask(taskRecentlyUsedKey) {
        if (this._getTasksFromStorage('historical').delete(taskRecentlyUsedKey)) {
            this._saveRecentlyUsedTasks();
        }
    }
    removePersistentTask(key) {
        this._log(nls.localize('taskService.removePersistentTask', 'Removing persistent task {0}', key), true);
        if (this._getTasksFromStorage('persistent').delete(key)) {
            this._savePersistentTasks();
        }
    }
    _setTaskLRUCacheLimit() {
        const quickOpenHistoryLimit = this._configurationService.getValue(QUICKOPEN_HISTORY_LIMIT_CONFIG);
        if (this._recentlyUsedTasks) {
            this._recentlyUsedTasks.limit = quickOpenHistoryLimit;
        }
    }
    async _setRecentlyUsedTask(task) {
        let key = task.getKey();
        if (!InMemoryTask.is(task) && key) {
            const customizations = this._createCustomizableTask(task);
            if (ContributedTask.is(task) && customizations) {
                const custom = [];
                const customized = Object.create(null);
                await this._computeTasksForSingleConfig(task._source.workspaceFolder ?? this.workspaceFolders[0], {
                    version: '2.0.0',
                    tasks: [customizations]
                }, 0 /* TaskRunSource.System */, custom, customized, TaskConfig.TaskConfigSource.TasksJson, true);
                for (const configuration in customized) {
                    key = customized[configuration].getKey();
                }
            }
            this._getTasksFromStorage('historical').set(key, JSON.stringify(customizations));
            this._saveRecentlyUsedTasks();
        }
    }
    _saveRecentlyUsedTasks() {
        if (!this._recentlyUsedTasks) {
            return;
        }
        const quickOpenHistoryLimit = this._configurationService.getValue(QUICKOPEN_HISTORY_LIMIT_CONFIG);
        // setting history limit to 0 means no LRU sorting
        if (quickOpenHistoryLimit === 0) {
            return;
        }
        let keys = [...this._recentlyUsedTasks.keys()];
        if (keys.length > quickOpenHistoryLimit) {
            keys = keys.slice(0, quickOpenHistoryLimit);
        }
        const keyValues = [];
        for (const key of keys) {
            keyValues.push([key, this._recentlyUsedTasks.get(key, 0 /* Touch.None */)]);
        }
        this._storageService.store(AbstractTaskService_1.RecentlyUsedTasks_KeyV2, JSON.stringify(keyValues), 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
    }
    async _setPersistentTask(task) {
        if (!this._configurationService.getValue("task.reconnection" /* TaskSettingId.Reconnection */)) {
            return;
        }
        let key = task.getKey();
        if (!InMemoryTask.is(task) && key) {
            const customizations = this._createCustomizableTask(task);
            if (ContributedTask.is(task) && customizations) {
                const custom = [];
                const customized = Object.create(null);
                await this._computeTasksForSingleConfig(task._source.workspaceFolder ?? this.workspaceFolders[0], {
                    version: '2.0.0',
                    tasks: [customizations]
                }, 0 /* TaskRunSource.System */, custom, customized, TaskConfig.TaskConfigSource.TasksJson, true);
                for (const configuration in customized) {
                    key = customized[configuration].getKey();
                }
            }
            if (!task.configurationProperties.isBackground) {
                return;
            }
            this._log(nls.localize('taskService.setPersistentTask', 'Setting persistent task {0}', key), true);
            this._getTasksFromStorage('persistent').set(key, JSON.stringify(customizations));
            this._savePersistentTasks();
        }
    }
    _savePersistentTasks() {
        this._persistentTasks = this._getTasksFromStorage('persistent');
        const keys = [...this._persistentTasks.keys()];
        const keyValues = [];
        for (const key of keys) {
            keyValues.push([key, this._persistentTasks.get(key, 0 /* Touch.None */)]);
        }
        this._log(nls.localize('savePersistentTask', 'Saving persistent tasks: {0}', keys.join(', ')), true);
        this._storageService.store(AbstractTaskService_1.PersistentTasks_Key, JSON.stringify(keyValues), 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
    }
    _openDocumentation() {
        this._openerService.open(URI.parse('https://code.visualstudio.com/docs/editor/tasks#_defining-a-problem-matcher'));
    }
    async _findSingleWorkspaceTaskOfGroup(group) {
        const tasksOfGroup = await this._findWorkspaceTasksInGroup(group, true);
        if ((tasksOfGroup.length === 1) && (typeof tasksOfGroup[0].configurationProperties.group !== 'string') && tasksOfGroup[0].configurationProperties.group?.isDefault) {
            let resolvedTask;
            if (ConfiguringTask.is(tasksOfGroup[0])) {
                resolvedTask = await this.tryResolveTask(tasksOfGroup[0]);
            }
            else {
                resolvedTask = tasksOfGroup[0];
            }
            if (resolvedTask) {
                return this.run(resolvedTask, undefined, 1 /* TaskRunSource.User */);
            }
        }
        return undefined;
    }
    async _build() {
        const tryBuildShortcut = await this._findSingleWorkspaceTaskOfGroup(TaskGroup.Build);
        if (tryBuildShortcut) {
            return tryBuildShortcut;
        }
        return this._getGroupedTasksAndExecute();
    }
    async _runTest() {
        const tryTestShortcut = await this._findSingleWorkspaceTaskOfGroup(TaskGroup.Test);
        if (tryTestShortcut) {
            return tryTestShortcut;
        }
        return this._getGroupedTasksAndExecute(true);
    }
    async _getGroupedTasksAndExecute(test) {
        const tasks = await this._getGroupedTasks();
        const runnable = this._createRunnableTask(tasks, test ? TaskGroup.Test : TaskGroup.Build);
        if (!runnable || !runnable.task) {
            if (test) {
                if (this.schemaVersion === 1 /* JsonSchemaVersion.V0_1_0 */) {
                    throw new TaskError(Severity.Info, nls.localize('TaskService.noTestTask1', 'No test task defined. Mark a task with \'isTestCommand\' in the tasks.json file.'), 3 /* TaskErrors.NoTestTask */);
                }
                else {
                    throw new TaskError(Severity.Info, nls.localize('TaskService.noTestTask2', 'No test task defined. Mark a task with as a \'test\' group in the tasks.json file.'), 3 /* TaskErrors.NoTestTask */);
                }
            }
            else {
                if (this.schemaVersion === 1 /* JsonSchemaVersion.V0_1_0 */) {
                    throw new TaskError(Severity.Info, nls.localize('TaskService.noBuildTask1', 'No build task defined. Mark a task with \'isBuildCommand\' in the tasks.json file.'), 2 /* TaskErrors.NoBuildTask */);
                }
                else {
                    throw new TaskError(Severity.Info, nls.localize('TaskService.noBuildTask2', 'No build task defined. Mark a task with as a \'build\' group in the tasks.json file.'), 2 /* TaskErrors.NoBuildTask */);
                }
            }
        }
        let executeTaskResult;
        try {
            executeTaskResult = await this._executeTask(runnable.task, runnable.resolver, 1 /* TaskRunSource.User */);
        }
        catch (error) {
            this._handleError(error);
            return Promise.reject(error);
        }
        return executeTaskResult;
    }
    async run(task, options, runSource = 0 /* TaskRunSource.System */) {
        if (!(await this._trust())) {
            return;
        }
        if (!task) {
            throw new TaskError(Severity.Info, nls.localize('TaskServer.noTask', 'Task to execute is undefined'), 5 /* TaskErrors.TaskNotFound */);
        }
        const resolver = this._createResolver();
        let executeTaskResult;
        try {
            if (options && options.attachProblemMatcher && this._shouldAttachProblemMatcher(task) && !InMemoryTask.is(task)) {
                const taskToExecute = await this._attachProblemMatcher(task);
                if (taskToExecute) {
                    executeTaskResult = await this._executeTask(taskToExecute, resolver, runSource);
                }
            }
            else {
                executeTaskResult = await this._executeTask(task, resolver, runSource);
            }
            return executeTaskResult;
        }
        catch (error) {
            this._handleError(error);
            return Promise.reject(error);
        }
    }
    _isProvideTasksEnabled() {
        const settingValue = this._configurationService.getValue("task.autoDetect" /* TaskSettingId.AutoDetect */);
        return settingValue === 'on';
    }
    _isProblemMatcherPromptEnabled(type) {
        const settingValue = this._configurationService.getValue(PROBLEM_MATCHER_NEVER_CONFIG);
        if (Types.isBoolean(settingValue)) {
            return !settingValue;
        }
        if (type === undefined) {
            return true;
        }
        // eslint-disable-next-line local/code-no-any-casts
        const settingValueMap = settingValue;
        return !settingValueMap[type];
    }
    _getTypeForTask(task) {
        let type;
        if (CustomTask.is(task)) {
            const configProperties = task._source.config.element;
            // eslint-disable-next-line local/code-no-any-casts
            type = configProperties.type;
        }
        else {
            type = task.getDefinition().type;
        }
        return type;
    }
    _shouldAttachProblemMatcher(task) {
        const enabled = this._isProblemMatcherPromptEnabled(this._getTypeForTask(task));
        if (enabled === false) {
            return false;
        }
        if (!this._canCustomize(task)) {
            return false;
        }
        if (task.configurationProperties.group !== undefined && task.configurationProperties.group !== TaskGroup.Build) {
            return false;
        }
        if (task.configurationProperties.problemMatchers !== undefined && task.configurationProperties.problemMatchers.length > 0) {
            return false;
        }
        if (ContributedTask.is(task)) {
            return !task.hasDefinedMatchers && !!task.configurationProperties.problemMatchers && (task.configurationProperties.problemMatchers.length === 0);
        }
        if (CustomTask.is(task)) {
            const configProperties = task._source.config.element;
            return configProperties.problemMatcher === undefined && !task.hasDefinedMatchers;
        }
        return false;
    }
    async _updateNeverProblemMatcherSetting(type) {
        const current = this._configurationService.getValue(PROBLEM_MATCHER_NEVER_CONFIG);
        if (current === true) {
            return;
        }
        let newValue;
        if (current !== false) {
            // eslint-disable-next-line local/code-no-any-casts
            newValue = current;
        }
        else {
            newValue = Object.create(null);
        }
        newValue[type] = true;
        return this._configurationService.updateValue(PROBLEM_MATCHER_NEVER_CONFIG, newValue);
    }
    async _attachProblemMatcher(task) {
        let entries = [];
        for (const key of ProblemMatcherRegistry.keys()) {
            const matcher = ProblemMatcherRegistry.get(key);
            if (matcher.deprecated) {
                continue;
            }
            if (matcher.name === matcher.label) {
                entries.push({ label: matcher.name, matcher: matcher });
            }
            else {
                entries.push({
                    label: matcher.label,
                    description: `$${matcher.name}`,
                    matcher: matcher
                });
            }
        }
        if (entries.length === 0) {
            return;
        }
        entries = entries.sort((a, b) => {
            if (a.label && b.label) {
                return a.label.localeCompare(b.label);
            }
            else {
                return 0;
            }
        });
        entries.unshift({ type: 'separator', label: nls.localize('TaskService.associate', 'associate') });
        let taskType;
        if (CustomTask.is(task)) {
            const configProperties = task._source.config.element;
            // eslint-disable-next-line local/code-no-any-casts
            taskType = configProperties.type;
        }
        else {
            taskType = task.getDefinition().type;
        }
        entries.unshift({ label: nls.localize('TaskService.attachProblemMatcher.continueWithout', 'Continue without scanning the task output'), matcher: undefined }, { label: nls.localize('TaskService.attachProblemMatcher.never', 'Never scan the task output for this task'), matcher: undefined, never: true }, { label: nls.localize('TaskService.attachProblemMatcher.neverType', 'Never scan the task output for {0} tasks', taskType), matcher: undefined, setting: taskType }, { label: nls.localize('TaskService.attachProblemMatcher.learnMoreAbout', 'Learn more about scanning the task output'), matcher: undefined, learnMore: true });
        const problemMatcher = await this._quickInputService.pick(entries, { placeHolder: nls.localize('selectProblemMatcher', 'Select for which kind of errors and warnings to scan the task output') });
        if (!problemMatcher) {
            return task;
        }
        if (problemMatcher.learnMore) {
            this._openDocumentation();
            return undefined;
        }
        if (problemMatcher.never) {
            this.customize(task, { problemMatcher: [] }, true);
            return task;
        }
        if (problemMatcher.matcher) {
            const newTask = task.clone();
            const matcherReference = `$${problemMatcher.matcher.name}`;
            const properties = { problemMatcher: [matcherReference] };
            newTask.configurationProperties.problemMatchers = [matcherReference];
            const matcher = ProblemMatcherRegistry.get(problemMatcher.matcher.name);
            if (matcher && matcher.watching !== undefined) {
                properties.isBackground = true;
                newTask.configurationProperties.isBackground = true;
            }
            this.customize(task, properties, true);
            return newTask;
        }
        if (problemMatcher.setting) {
            await this._updateNeverProblemMatcherSetting(problemMatcher.setting);
        }
        return task;
    }
    async _getTasksForGroup(group, waitToActivate) {
        const groups = await this._getGroupedTasks(undefined, waitToActivate);
        const result = [];
        groups.forEach(tasks => {
            for (const task of tasks) {
                const configTaskGroup = TaskGroup.from(task.configurationProperties.group);
                if (configTaskGroup?._id === group._id) {
                    result.push(task);
                }
            }
        });
        return result;
    }
    needsFolderQualification() {
        return this._contextService.getWorkbenchState() === 3 /* WorkbenchState.WORKSPACE */;
    }
    _canCustomize(task) {
        if (this.schemaVersion !== 2 /* JsonSchemaVersion.V2_0_0 */) {
            return false;
        }
        if (CustomTask.is(task)) {
            return true;
        }
        if (ContributedTask.is(task)) {
            return !!task.getWorkspaceFolder();
        }
        return false;
    }
    async _formatTaskForJson(resource, task) {
        let reference;
        let stringValue = '';
        try {
            reference = await this._textModelResolverService.createModelReference(resource);
            const model = reference.object.textEditorModel;
            const { tabSize, insertSpaces } = model.getOptions();
            const eol = model.getEOL();
            let stringified = toFormattedString(task, { eol, tabSize, insertSpaces });
            const regex = new RegExp(eol + (insertSpaces ? ' '.repeat(tabSize) : '\\t'), 'g');
            stringified = stringified.replace(regex, eol + (insertSpaces ? ' '.repeat(tabSize * 3) : '\t\t\t'));
            const twoTabs = insertSpaces ? ' '.repeat(tabSize * 2) : '\t\t';
            stringValue = twoTabs + stringified.slice(0, stringified.length - 1) + twoTabs + stringified.slice(stringified.length - 1);
        }
        finally {
            reference?.dispose();
        }
        return stringValue;
    }
    async _openEditorAtTask(resource, task, configIndex = -1) {
        if (resource === undefined) {
            return Promise.resolve(false);
        }
        const fileContent = await this._fileService.readFile(resource);
        const content = fileContent.value;
        if (!content || !task) {
            return false;
        }
        const contentValue = content.toString();
        let stringValue;
        if (configIndex !== -1) {
            const json = this._configurationService.getValue('tasks', { resource });
            if (json.tasks && (json.tasks.length > configIndex)) {
                stringValue = await this._formatTaskForJson(resource, json.tasks[configIndex]);
            }
        }
        if (!stringValue) {
            if (typeof task === 'string') {
                stringValue = task;
            }
            else {
                stringValue = await this._formatTaskForJson(resource, task);
            }
        }
        const index = contentValue.indexOf(stringValue);
        let startLineNumber = 1;
        for (let i = 0; i < index; i++) {
            if (contentValue.charAt(i) === '\n') {
                startLineNumber++;
            }
        }
        let endLineNumber = startLineNumber;
        for (let i = 0; i < stringValue.length; i++) {
            if (stringValue.charAt(i) === '\n') {
                endLineNumber++;
            }
        }
        const selection = startLineNumber > 1 ? { startLineNumber, startColumn: startLineNumber === endLineNumber ? 4 : 3, endLineNumber, endColumn: startLineNumber === endLineNumber ? undefined : 4 } : undefined;
        await this._editorService.openEditor({
            resource,
            options: {
                pinned: false,
                forceReload: true, // because content might have changed
                selection,
                selectionRevealType: 1 /* TextEditorSelectionRevealType.CenterIfOutsideViewport */
            }
        });
        return !!selection;
    }
    _createCustomizableTask(task) {
        let toCustomize;
        const taskConfig = CustomTask.is(task) || ConfiguringTask.is(task) ? task._source.config : undefined;
        if (taskConfig && taskConfig.element) {
            toCustomize = { ...(taskConfig.element) };
        }
        else if (ContributedTask.is(task)) {
            toCustomize = {};
            const identifier = Object.assign(Object.create(null), task.defines);
            delete identifier['_key'];
            // eslint-disable-next-line local/code-no-any-casts
            Object.keys(identifier).forEach(key => toCustomize[key] = identifier[key]);
            if (task.configurationProperties.problemMatchers && task.configurationProperties.problemMatchers.length > 0 && Types.isStringArray(task.configurationProperties.problemMatchers)) {
                toCustomize.problemMatcher = task.configurationProperties.problemMatchers;
            }
            if (task.configurationProperties.group) {
                toCustomize.group = TaskConfig.GroupKind.to(task.configurationProperties.group);
            }
        }
        if (!toCustomize) {
            return undefined;
        }
        if (toCustomize.problemMatcher === undefined && task.configurationProperties.problemMatchers === undefined || (task.configurationProperties.problemMatchers && task.configurationProperties.problemMatchers.length === 0)) {
            toCustomize.problemMatcher = [];
        }
        if (task._source.label !== 'Workspace') {
            toCustomize.label = task.configurationProperties.identifier;
        }
        else {
            toCustomize.label = task._label;
        }
        toCustomize.detail = task.configurationProperties.detail;
        return toCustomize;
    }
    async customize(task, properties, openConfig) {
        if (!(await this._trust())) {
            return;
        }
        const workspaceFolder = task.getWorkspaceFolder();
        if (!workspaceFolder) {
            return Promise.resolve(undefined);
        }
        const configuration = this._getConfiguration(workspaceFolder, task._source.kind);
        if (configuration.hasParseErrors) {
            this._notificationService.warn(nls.localize('customizeParseErrors', 'The current task configuration has errors. Please fix the errors first before customizing a task.'));
            return Promise.resolve(undefined);
        }
        const fileConfig = configuration.config;
        const toCustomize = this._createCustomizableTask(task);
        if (!toCustomize) {
            return Promise.resolve(undefined);
        }
        const index = CustomTask.is(task) ? task._source.config.index : undefined;
        if (properties) {
            for (const property of Object.getOwnPropertyNames(properties)) {
                // eslint-disable-next-line local/code-no-any-casts
                const value = properties[property];
                if (value !== undefined && value !== null) {
                    // eslint-disable-next-line local/code-no-any-casts
                    toCustomize[property] = value;
                }
            }
        }
        if (!fileConfig) {
            const value = {
                version: '2.0.0',
                tasks: [toCustomize]
            };
            let content = [
                '{',
                nls.localize('tasksJsonComment', '\t// See https://go.microsoft.com/fwlink/?LinkId=733558 \n\t// for the documentation about the tasks.json format'),
            ].join('\n') + JSON.stringify(value, null, '\t').substr(1);
            const editorConfig = this._configurationService.getValue();
            if (editorConfig.editor.insertSpaces) {
                content = content.replace(/(\n)(\t+)/g, (_, s1, s2) => s1 + ' '.repeat(s2.length * editorConfig.editor.tabSize));
            }
            await this._textFileService.create([{ resource: workspaceFolder.toResource('.vscode/tasks.json'), value: content }]);
        }
        else {
            // We have a global task configuration
            if ((index === -1) && properties) {
                if (properties.problemMatcher !== undefined) {
                    fileConfig.problemMatcher = properties.problemMatcher;
                    await this._writeConfiguration(workspaceFolder, 'tasks.problemMatchers', fileConfig.problemMatcher, task._source.kind);
                }
                else if (properties.group !== undefined) {
                    fileConfig.group = properties.group;
                    await this._writeConfiguration(workspaceFolder, 'tasks.group', fileConfig.group, task._source.kind);
                }
            }
            else {
                if (!Array.isArray(fileConfig.tasks)) {
                    fileConfig.tasks = [];
                }
                if (index === undefined) {
                    fileConfig.tasks.push(toCustomize);
                }
                else {
                    fileConfig.tasks[index] = toCustomize;
                }
                await this._writeConfiguration(workspaceFolder, 'tasks.tasks', fileConfig.tasks, task._source.kind);
            }
        }
        if (openConfig) {
            this._openEditorAtTask(this._getResourceForTask(task), toCustomize);
        }
    }
    _writeConfiguration(workspaceFolder, key, value, source) {
        let target = undefined;
        switch (source) {
            case TaskSourceKind.User:
                target = 2 /* ConfigurationTarget.USER */;
                break;
            case TaskSourceKind.WorkspaceFile:
                target = 5 /* ConfigurationTarget.WORKSPACE */;
                break;
            default: if (this._contextService.getWorkbenchState() === 2 /* WorkbenchState.FOLDER */) {
                target = 5 /* ConfigurationTarget.WORKSPACE */;
            }
            else if (this._contextService.getWorkbenchState() === 3 /* WorkbenchState.WORKSPACE */) {
                target = 6 /* ConfigurationTarget.WORKSPACE_FOLDER */;
            }
        }
        if (target) {
            return this._configurationService.updateValue(key, value, { resource: workspaceFolder.uri }, target);
        }
        else {
            return undefined;
        }
    }
    _getResourceForKind(kind) {
        this._updateSetup();
        switch (kind) {
            case TaskSourceKind.User: {
                return resources.joinPath(resources.dirname(this._preferencesService.userSettingsResource), 'tasks.json');
            }
            case TaskSourceKind.WorkspaceFile: {
                if (this._workspace && this._workspace.configuration) {
                    return this._workspace.configuration;
                }
            }
            default: {
                return undefined;
            }
        }
    }
    _getResourceForTask(task) {
        if (CustomTask.is(task)) {
            let uri = this._getResourceForKind(task._source.kind);
            if (!uri) {
                const taskFolder = task.getWorkspaceFolder();
                if (taskFolder) {
                    uri = taskFolder.toResource(task._source.config.file);
                }
                else {
                    uri = this.workspaceFolders[0].uri;
                }
            }
            return uri;
        }
        else {
            return task.getWorkspaceFolder().toResource('.vscode/tasks.json');
        }
    }
    async openConfig(task) {
        let resource;
        if (task) {
            resource = this._getResourceForTask(task);
        }
        else {
            resource = (this._workspaceFolders && (this._workspaceFolders.length > 0)) ? this._workspaceFolders[0].toResource('.vscode/tasks.json') : undefined;
        }
        return this._openEditorAtTask(resource, task ? task._label : undefined, task ? task._source.config.index : -1);
    }
    _createRunnableTask(tasks, group) {
        const resolverData = new Map();
        const workspaceTasks = [];
        const extensionTasks = [];
        tasks.forEach((tasks, folder) => {
            let data = resolverData.get(folder);
            if (!data) {
                data = {
                    id: new Map(),
                    label: new Map(),
                    identifier: new Map()
                };
                resolverData.set(folder, data);
            }
            for (const task of tasks) {
                data.id.set(task._id, task);
                data.label.set(task._label, task);
                if (task.configurationProperties.identifier) {
                    data.identifier.set(task.configurationProperties.identifier, task);
                }
                if (group && task.configurationProperties.group === group) {
                    if (task._source.kind === TaskSourceKind.Workspace) {
                        workspaceTasks.push(task);
                    }
                    else {
                        extensionTasks.push(task);
                    }
                }
            }
        });
        const resolver = {
            resolve: async (uri, alias) => {
                const data = resolverData.get(typeof uri === 'string' ? uri : uri.toString());
                if (!data) {
                    return undefined;
                }
                return data.id.get(alias) || data.label.get(alias) || data.identifier.get(alias);
            }
        };
        if (workspaceTasks.length > 0) {
            if (workspaceTasks.length > 1) {
                this._log(nls.localize('moreThanOneBuildTask', 'There are many build tasks defined in the tasks.json. Executing the first one.'));
            }
            return { task: workspaceTasks[0], resolver };
        }
        if (extensionTasks.length === 0) {
            return undefined;
        }
        // We can only have extension tasks if we are in version 2.0.0. Then we can even run
        // multiple build tasks.
        if (extensionTasks.length === 1) {
            return { task: extensionTasks[0], resolver };
        }
        else {
            const id = UUID.generateUuid();
            const task = new InMemoryTask(id, { kind: TaskSourceKind.InMemory, label: 'inMemory' }, id, 'inMemory', { reevaluateOnRerun: true }, {
                identifier: id,
                dependsOn: extensionTasks.map((extensionTask) => { return { uri: extensionTask.getWorkspaceFolder().uri, task: extensionTask._id }; }),
                name: id
            });
            return { task, resolver };
        }
    }
    _createResolver(grouped) {
        let resolverData;
        async function quickResolve(that, uri, identifier) {
            const foundTasks = await that._findWorkspaceTasks((task) => {
                const taskUri = ((ConfiguringTask.is(task) || CustomTask.is(task)) ? task._source.config.workspaceFolder?.uri : undefined);
                const originalUri = (typeof uri === 'string' ? uri : uri.toString());
                if (taskUri?.toString() !== originalUri) {
                    return false;
                }
                if (Types.isString(identifier)) {
                    return ((task._label === identifier) || (task.configurationProperties.identifier === identifier));
                }
                else {
                    const keyedIdentifier = task.getDefinition(true);
                    const searchIdentifier = TaskDefinition.createTaskIdentifier(identifier, console);
                    return (searchIdentifier && keyedIdentifier) ? (searchIdentifier._key === keyedIdentifier._key) : false;
                }
            });
            if (foundTasks.length === 0) {
                return undefined;
            }
            const task = foundTasks[0];
            if (ConfiguringTask.is(task)) {
                return that.tryResolveTask(task);
            }
            return task;
        }
        async function getResolverData(that) {
            if (resolverData === undefined) {
                resolverData = new Map();
                (grouped || await that._getGroupedTasks()).forEach((tasks, folder) => {
                    let data = resolverData.get(folder);
                    if (!data) {
                        data = { label: new Map(), identifier: new Map(), taskIdentifier: new Map() };
                        resolverData.set(folder, data);
                    }
                    for (const task of tasks) {
                        data.label.set(task._label, task);
                        if (task.configurationProperties.identifier) {
                            data.identifier.set(task.configurationProperties.identifier, task);
                        }
                        const keyedIdentifier = task.getDefinition(true);
                        if (keyedIdentifier !== undefined) {
                            data.taskIdentifier.set(keyedIdentifier._key, task);
                        }
                    }
                });
            }
            return resolverData;
        }
        async function fullResolve(that, uri, identifier) {
            const allResolverData = await getResolverData(that);
            const data = allResolverData.get(typeof uri === 'string' ? uri : uri.toString());
            if (!data) {
                return undefined;
            }
            if (Types.isString(identifier)) {
                return data.label.get(identifier) || data.identifier.get(identifier);
            }
            else {
                const key = TaskDefinition.createTaskIdentifier(identifier, console);
                return key !== undefined ? data.taskIdentifier.get(key._key) : undefined;
            }
        }
        return {
            resolve: async (uri, identifier) => {
                if (!identifier) {
                    return undefined;
                }
                if ((resolverData === undefined) && (grouped === undefined)) {
                    return (await quickResolve(this, uri, identifier)) ?? fullResolve(this, uri, identifier);
                }
                else {
                    return fullResolve(this, uri, identifier);
                }
            }
        };
    }
    async _saveBeforeRun() {
        let SaveBeforeRunConfigOptions;
        (function (SaveBeforeRunConfigOptions) {
            SaveBeforeRunConfigOptions["Always"] = "always";
            SaveBeforeRunConfigOptions["Never"] = "never";
            SaveBeforeRunConfigOptions["Prompt"] = "prompt";
        })(SaveBeforeRunConfigOptions || (SaveBeforeRunConfigOptions = {}));
        const saveBeforeRunTaskConfig = this._configurationService.getValue("task.saveBeforeRun" /* TaskSettingId.SaveBeforeRun */);
        if (saveBeforeRunTaskConfig === SaveBeforeRunConfigOptions.Never) {
            return false;
        }
        else if (saveBeforeRunTaskConfig === SaveBeforeRunConfigOptions.Prompt && this._editorService.editors.some(e => e.isDirty())) {
            const { confirmed } = await this._dialogService.confirm({
                message: nls.localize('TaskSystem.saveBeforeRun.prompt.title', "Save all editors?"),
                detail: nls.localize('detail', "Do you want to save all editors before running the task?"),
                primaryButton: nls.localize({ key: 'saveBeforeRun.save', comment: ['&& denotes a mnemonic'] }, '&&Save'),
                cancelButton: nls.localize({ key: 'saveBeforeRun.dontSave', comment: ['&& denotes a mnemonic'] }, "Do&&n't Save"),
            });
            if (!confirmed) {
                return false;
            }
        }
        await this._editorService.saveAll({ reason: 2 /* SaveReason.AUTO */ });
        return true;
    }
    async _executeTask(task, resolver, runSource) {
        let taskToRun = task;
        if (await this._saveBeforeRun()) {
            await this._configurationService.reloadConfiguration();
            await this._updateWorkspaceTasks();
            const taskFolder = task.getWorkspaceFolder();
            const taskIdentifier = task.configurationProperties.identifier;
            const taskType = CustomTask.is(task) ? task.customizes()?.type : (ContributedTask.is(task) ? task.type : undefined);
            // Since we save before running tasks, the task may have changed as part of the save.
            // However, if the TaskRunSource is not User, then we shouldn't try to fetch the task again
            // since this can cause a new'd task to get overwritten with a provided task.
            taskToRun = ((taskFolder && taskIdentifier && (runSource === 1 /* TaskRunSource.User */))
                ? await this.getTask(taskFolder, taskIdentifier, false, taskType) : task) ?? task;
        }
        await ProblemMatcherRegistry.onReady();
        const executeResult = runSource === 4 /* TaskRunSource.Reconnect */ ? this._getTaskSystem().reconnect(taskToRun, resolver) : this._getTaskSystem().run(taskToRun, resolver);
        if (executeResult) {
            return this._handleExecuteResult(executeResult, runSource);
        }
        return { exitCode: 0 };
    }
    async _handleExecuteResult(executeResult, runSource) {
        if (runSource && executeResult.task._id) {
            this._taskRunSources.set(executeResult.task._id, runSource);
        }
        if (runSource === 1 /* TaskRunSource.User */) {
            await this._setRecentlyUsedTask(executeResult.task);
        }
        if (executeResult.kind === 2 /* TaskExecuteKind.Active */) {
            const active = executeResult.active;
            if (active && active.same && runSource === 2 /* TaskRunSource.FolderOpen */ || runSource === 4 /* TaskRunSource.Reconnect */) {
                // ignore, the task is already active, likely from being reconnected or from folder open.
                this._logService.debug('Ignoring task that is already active', executeResult.task);
                return executeResult.promise;
            }
            if (active && active.same) {
                this._handleInstancePolicy(executeResult.task, executeResult.task.runOptions.instancePolicy);
            }
            else {
                throw new TaskError(Severity.Warning, nls.localize('TaskSystem.active', 'There is already a task running. Terminate it first before executing another task.'), 1 /* TaskErrors.RunningTask */);
            }
        }
        this._setRecentlyUsedTask(executeResult.task);
        return executeResult.promise;
    }
    _handleInstancePolicy(task, policy) {
        if (!this._taskSystem?.isTaskVisible(task)) {
            this._taskSystem?.revealTask(task);
        }
        switch (policy) {
            case "terminateNewest" /* InstancePolicy.terminateNewest */:
                this._restart(this._getTaskSystem().getLastInstance(task) ?? task);
                break;
            case "terminateOldest" /* InstancePolicy.terminateOldest */:
                this._restart(this._getTaskSystem().getFirstInstance(task) ?? task);
                break;
            case "silent" /* InstancePolicy.silent */:
                break;
            case "warn" /* InstancePolicy.warn */:
                this._notificationService.warn(nls.localize('TaskSystem.InstancePolicy.warn', 'The instance limit for this task has been reached.'));
                break;
            case "prompt" /* InstancePolicy.prompt */:
            default:
                this._showQuickPick(this._taskSystem.getActiveTasks().filter(t => task._id === t._id), nls.localize('TaskService.instanceToTerminate', 'Select an instance to terminate'), {
                    label: nls.localize('TaskService.noInstanceRunning', 'No instance is currently running'),
                    task: undefined
                }, false, true, undefined).then(entry => {
                    const task = entry ? entry.task : undefined;
                    if (task === undefined || task === null) {
                        return;
                    }
                    this._restart(task);
                });
        }
    }
    async _restart(task) {
        if (!this._taskSystem) {
            return;
        }
        // Check if the task is currently running
        const isTaskRunning = await this.getActiveTasks().then(tasks => tasks.some(t => t.getMapKey() === task.getMapKey()));
        if (isTaskRunning) {
            // Task is running, terminate it first
            const response = await this._taskSystem.terminate(task);
            if (!response.success) {
                this._notificationService.warn(nls.localize('TaskSystem.restartFailed', 'Failed to terminate and restart task {0}', Types.isString(task) ? task : task.configurationProperties.name));
                return;
            }
        }
        // Task is not running or was successfully terminated, now run it
        try {
            // Before restarting, check if the task still exists and get updated version
            const updatedTask = await this._findUpdatedTask(task);
            if (updatedTask) {
                await this.run(updatedTask);
            }
            else {
                // Task no longer exists, show warning
                this._notificationService.warn(nls.localize('TaskSystem.taskNoLongerExists', 'Task {0} no longer exists or has been modified. Cannot restart.', task.configurationProperties.name));
            }
        }
        catch {
            // eat the error, we don't care about it here
        }
    }
    async _findUpdatedTask(originalTask) {
        const mapStringToFolderTasks = await this._updateWorkspaceTasks(0 /* TaskRunSource.System */);
        // Look for the task in current workspace configuration
        for (const [_, folderResult] of mapStringToFolderTasks) {
            if (!folderResult.set?.tasks?.length && !folderResult.configurations?.byIdentifier) {
                continue;
            }
            // There are two ways where Task lives:
            // 1. folderResult.set.tasks
            if (folderResult.set?.tasks) {
                for (const task of folderResult.set.tasks) {
                    // Check if this is the same task by ID
                    if (task._id === originalTask._id) {
                        return task;
                    }
                }
            }
            // 2. folderResult.configurations.byIdentifier
            if (folderResult.configurations?.byIdentifier) {
                for (const [_, configuringTask] of Object.entries(folderResult.configurations.byIdentifier)) {
                    // Check if this is the same task by ID
                    if (configuringTask._id === originalTask._id) {
                        return this.tryResolveTask(configuringTask);
                    }
                }
            }
        }
        // If task wasn't found in workspace configuration, check contributed tasks from providers
        // This is important for tasks from extensions like npm, which are ContributedTasks
        if (ContributedTask.is(originalTask)) {
            // The type filter ensures only the matching provider is called (e.g., only npm provider for npm tasks)
            // This is the same pattern used in tryResolveTask as a fallback
            const allTasks = await this.tasks({ type: originalTask.type });
            for (const task of allTasks) {
                if (task._id === originalTask._id) {
                    return task;
                }
            }
        }
        return undefined;
    }
    async terminate(task) {
        if (!(await this._trust())) {
            return { success: true, task: undefined };
        }
        if (!this._taskSystem) {
            return { success: true, task: undefined };
        }
        return this._taskSystem.terminate(task);
    }
    _terminateAll() {
        if (!this._taskSystem) {
            return Promise.resolve([]);
        }
        return this._taskSystem.terminateAll();
    }
    _createTerminalTaskSystem() {
        return new TerminalTaskSystem(this._terminalService, this._terminalGroupService, this._outputService, this._paneCompositeService, this._viewsService, this._markerService, this._modelService, this._configurationResolverService, this._contextService, this._environmentService, AbstractTaskService_1.OutputChannelId, this._fileService, this._terminalProfileResolverService, this._pathService, this._viewDescriptorService, this._logService, this._notificationService, this._contextKeyService, this._instantiationService, (workspaceFolder) => {
            if (workspaceFolder) {
                return this._getTaskSystemInfo(workspaceFolder.uri.scheme);
            }
            else if (this._taskSystemInfos.size > 0) {
                const infos = Array.from(this._taskSystemInfos.entries());
                const notFile = infos.filter(info => info[0] !== Schemas.file);
                if (notFile.length > 0) {
                    return notFile[0][1][0];
                }
                return infos[0][1][0];
            }
            else {
                return undefined;
            }
        }, async (taskKey) => {
            // Look up task by its map key across all workspace tasks
            const taskMap = await this._getGroupedTasks();
            const allTasks = taskMap.all();
            for (const task of allTasks) {
                if (task.getMapKey() === taskKey) {
                    return task;
                }
            }
            return undefined;
        });
    }
    _isTaskProviderEnabled(type) {
        const definition = TaskDefinitionRegistry.get(type);
        return !definition || !definition.when || this._contextKeyService.contextMatchesRules(definition.when);
    }
    async _getGroupedTasks(filter, waitToActivate, knownOnlyOrTrusted) {
        await this._waitForAllSupportedExecutions;
        const type = filter?.type;
        const needsRecentTasksMigration = this._needsRecentTasksMigration();
        if (!waitToActivate) {
            await this._activateTaskProviders(filter?.type);
        }
        const validTypes = Object.create(null);
        TaskDefinitionRegistry.all().forEach(definition => validTypes[definition.taskType] = true);
        validTypes['shell'] = true;
        validTypes['process'] = true;
        const contributedTaskSets = await new Promise(resolve => {
            const result = [];
            let counter = 0;
            const done = (value) => {
                if (value) {
                    result.push(value);
                }
                if (--counter === 0) {
                    resolve(result);
                }
            };
            const error = (error) => {
                try {
                    if (!isCancellationError(error)) {
                        if (error && Types.isString(error.message)) {
                            this._log(`Error: ${error.message}\n`);
                            this._showOutput(error.message);
                        }
                        else {
                            this._log('Unknown error received while collecting tasks from providers.');
                            this._showOutput();
                        }
                    }
                }
                finally {
                    if (--counter === 0) {
                        resolve(result);
                    }
                }
            };
            if (this._isProvideTasksEnabled() && (this.schemaVersion === 2 /* JsonSchemaVersion.V2_0_0 */) && (this._providers.size > 0)) {
                let foundAnyProviders = false;
                for (const [handle, provider] of this._providers) {
                    const providerType = this._providerTypes.get(handle);
                    if ((type === undefined) || (type === providerType)) {
                        if (providerType && !this._isTaskProviderEnabled(providerType)) {
                            continue;
                        }
                        foundAnyProviders = true;
                        counter++;
                        raceTimeout(provider.provideTasks(validTypes).then((taskSet) => {
                            // Check that the tasks provided are of the correct type
                            for (const task of taskSet.tasks) {
                                if (task.type !== this._providerTypes.get(handle)) {
                                    this._log(nls.localize('unexpectedTaskType', "The task provider for \"{0}\" tasks unexpectedly provided a task of type \"{1}\".\n", this._providerTypes.get(handle), task.type));
                                    if ((task.type !== 'shell') && (task.type !== 'process')) {
                                        this._showOutput();
                                    }
                                    break;
                                }
                            }
                            return done(taskSet);
                        }, error), 5000, () => {
                            // onTimeout
                            done(undefined);
                        });
                    }
                }
                if (!foundAnyProviders) {
                    resolve(result);
                }
            }
            else {
                resolve(result);
            }
        });
        const result = new TaskMap();
        const contributedTasks = new TaskMap();
        for (const set of contributedTaskSets) {
            for (const task of set.tasks) {
                const workspaceFolder = task.getWorkspaceFolder();
                if (workspaceFolder) {
                    contributedTasks.add(workspaceFolder, task);
                }
            }
        }
        try {
            let tasks = [];
            // prevent workspace trust dialog from being shown in unexpected cases #224881
            if (!knownOnlyOrTrusted || this._workspaceTrustManagementService.isWorkspaceTrusted()) {
                tasks = Array.from(await this.getWorkspaceTasks());
            }
            await Promise.all(this._getCustomTaskPromises(tasks, filter, result, contributedTasks, waitToActivate));
            if (needsRecentTasksMigration) {
                // At this point we have all the tasks and can migrate the recently used tasks.
                await this._migrateRecentTasks(result.all());
            }
            return result;
        }
        catch {
            // If we can't read the tasks.json file provide at least the contributed tasks
            const result = new TaskMap();
            for (const set of contributedTaskSets) {
                for (const task of set.tasks) {
                    const folder = task.getWorkspaceFolder();
                    if (folder) {
                        result.add(folder, task);
                    }
                }
            }
            return result;
        }
    }
    _getCustomTaskPromises(customTasksKeyValuePairs, filter, result, contributedTasks, waitToActivate) {
        return customTasksKeyValuePairs.map(async ([key, folderTasks]) => {
            const contributed = contributedTasks.get(key);
            if (!folderTasks.set) {
                if (contributed) {
                    result.add(key, ...contributed);
                }
                return;
            }
            if (this._contextService.getWorkbenchState() === 1 /* WorkbenchState.EMPTY */) {
                result.add(key, ...folderTasks.set.tasks);
            }
            else {
                const configurations = folderTasks.configurations;
                const legacyTaskConfigurations = folderTasks.set ? this._getLegacyTaskConfigurations(folderTasks.set) : undefined;
                const customTasksToDelete = [];
                if (configurations || legacyTaskConfigurations) {
                    const unUsedConfigurations = new Set();
                    if (configurations) {
                        Object.keys(configurations.byIdentifier).forEach(key => unUsedConfigurations.add(key));
                    }
                    for (const task of contributed) {
                        if (!ContributedTask.is(task)) {
                            continue;
                        }
                        if (configurations) {
                            const configuringTask = configurations.byIdentifier[task.defines._key];
                            if (configuringTask) {
                                unUsedConfigurations.delete(task.defines._key);
                                result.add(key, TaskConfig.createCustomTask(task, configuringTask));
                            }
                            else {
                                result.add(key, task);
                            }
                        }
                        else if (legacyTaskConfigurations) {
                            const configuringTask = legacyTaskConfigurations[task.defines._key];
                            if (configuringTask) {
                                result.add(key, TaskConfig.createCustomTask(task, configuringTask));
                                customTasksToDelete.push(configuringTask);
                            }
                            else {
                                result.add(key, task);
                            }
                        }
                        else {
                            result.add(key, task);
                        }
                    }
                    if (customTasksToDelete.length > 0) {
                        const toDelete = customTasksToDelete.reduce((map, task) => {
                            map[task._id] = true;
                            return map;
                        }, Object.create(null));
                        for (const task of folderTasks.set.tasks) {
                            if (toDelete[task._id]) {
                                continue;
                            }
                            result.add(key, task);
                        }
                    }
                    else {
                        result.add(key, ...folderTasks.set.tasks);
                    }
                    const unUsedConfigurationsAsArray = Array.from(unUsedConfigurations);
                    const unUsedConfigurationPromises = unUsedConfigurationsAsArray.map(async (value) => {
                        const configuringTask = configurations.byIdentifier[value];
                        if (filter?.type && (filter.type !== configuringTask.configures.type)) {
                            return;
                        }
                        let requiredTaskProviderUnavailable = false;
                        for (const [handle, provider] of this._providers) {
                            const providerType = this._providerTypes.get(handle);
                            if (configuringTask.type === providerType) {
                                if (providerType && !this._isTaskProviderEnabled(providerType)) {
                                    requiredTaskProviderUnavailable = true;
                                    continue;
                                }
                                try {
                                    const resolvedTask = await provider.resolveTask(configuringTask);
                                    if (resolvedTask && (resolvedTask._id === configuringTask._id)) {
                                        result.add(key, TaskConfig.createCustomTask(resolvedTask, configuringTask));
                                        return;
                                    }
                                }
                                catch (error) {
                                    // Ignore errors. The task could not be provided by any of the providers.
                                }
                            }
                        }
                        if (requiredTaskProviderUnavailable) {
                            this._log(nls.localize('TaskService.providerUnavailable', 'Warning: {0} tasks are unavailable in the current environment.', configuringTask.configures.type));
                        }
                        else if (!waitToActivate) {
                            this._log(nls.localize('TaskService.noConfiguration', 'Error: The {0} task detection didn\'t contribute a task for the following configuration:\n{1}\nThe task will be ignored.', configuringTask.configures.type, JSON.stringify(configuringTask._source.config.element, undefined, 4)));
                        }
                    });
                    await Promise.all(unUsedConfigurationPromises);
                }
                else {
                    result.add(key, ...folderTasks.set.tasks);
                    result.add(key, ...contributed);
                }
            }
        });
    }
    _getLegacyTaskConfigurations(workspaceTasks) {
        let result;
        function getResult() {
            if (result) {
                return result;
            }
            result = Object.create(null);
            return result;
        }
        for (const task of workspaceTasks.tasks) {
            if (CustomTask.is(task)) {
                const commandName = task.command && task.command.name;
                // This is for backwards compatibility with the 0.1.0 task annotation code
                // if we had a gulp, jake or grunt command a task specification was a annotation
                if (commandName === 'gulp' || commandName === 'grunt' || commandName === 'jake') {
                    const identifier = KeyedTaskIdentifier.create({
                        type: commandName,
                        task: task.configurationProperties.name
                    });
                    getResult()[identifier._key] = task;
                }
            }
        }
        return result;
    }
    async getWorkspaceTasks(runSource = 1 /* TaskRunSource.User */) {
        if (!(await this._trust())) {
            return new Map();
        }
        await raceTimeout(this._waitForAllSupportedExecutions, 2000, () => {
            this._logService.warn('Timed out waiting for all supported executions');
        });
        await this._whenTaskSystemReady;
        if (this._workspaceTasksPromise) {
            return this._workspaceTasksPromise;
        }
        return this._updateWorkspaceTasks(runSource);
    }
    getTaskProblems(instanceId) {
        return this._taskSystem?.getTaskProblems(instanceId);
    }
    _updateWorkspaceTasks(runSource = 1 /* TaskRunSource.User */) {
        this._workspaceTasksPromise = this._computeWorkspaceTasks(runSource);
        return this._workspaceTasksPromise;
    }
    async _getAFolder() {
        let folder = this.workspaceFolders.length > 0 ? this.workspaceFolders[0] : undefined;
        if (!folder) {
            const userhome = await this._pathService.userHome();
            folder = new WorkspaceFolder({ uri: userhome, name: resources.basename(userhome), index: 0 });
        }
        return folder;
    }
    getTerminalsForTasks(task) {
        return this._taskSystem?.getTerminalsForTasks(task);
    }
    async _computeWorkspaceTasks(runSource = 1 /* TaskRunSource.User */) {
        const promises = [];
        for (const folder of this.workspaceFolders) {
            promises.push(this._computeWorkspaceFolderTasks(folder, runSource));
        }
        const values = await Promise.all(promises);
        const result = new Map();
        for (const value of values) {
            if (value) {
                result.set(value.workspaceFolder.uri.toString(), value);
            }
        }
        const folder = await this._getAFolder();
        if (this._contextService.getWorkbenchState() !== 1 /* WorkbenchState.EMPTY */) {
            const workspaceFileTasks = await this._computeWorkspaceFileTasks(folder, runSource);
            if (workspaceFileTasks && this._workspace && this._workspace.configuration) {
                result.set(this._workspace.configuration.toString(), workspaceFileTasks);
            }
        }
        const userTasks = await this._computeUserTasks(folder, runSource);
        if (userTasks) {
            result.set(USER_TASKS_GROUP_KEY, userTasks);
        }
        // Update tasks available context key
        const hasAnyTasks = Array.from(result.values()).some(folderResult => (folderResult.set?.tasks && folderResult.set.tasks.length > 0) ||
            (folderResult.configurations?.byIdentifier && Object.keys(folderResult.configurations.byIdentifier).length > 0));
        this._tasksAvailableState.set(hasAnyTasks);
        return result;
    }
    get _jsonTasksSupported() {
        return ShellExecutionSupportedContext.getValue(this._contextKeyService) === true && ProcessExecutionSupportedContext.getValue(this._contextKeyService) === true;
    }
    async _computeWorkspaceFolderTasks(workspaceFolder, runSource = 1 /* TaskRunSource.User */) {
        const workspaceFolderConfiguration = (this._executionEngine === ExecutionEngine.Process ? await this._computeLegacyConfiguration(workspaceFolder) : await this._computeConfiguration(workspaceFolder));
        if (!workspaceFolderConfiguration || !workspaceFolderConfiguration.config || workspaceFolderConfiguration.hasErrors) {
            return Promise.resolve({ workspaceFolder, set: undefined, configurations: undefined, hasErrors: workspaceFolderConfiguration ? workspaceFolderConfiguration.hasErrors : false });
        }
        await ProblemMatcherRegistry.onReady();
        const taskSystemInfo = this._getTaskSystemInfo(workspaceFolder.uri.scheme);
        const problemReporter = new ProblemReporter(this._outputChannel);
        this._register(problemReporter.onDidError(error => this._showOutput(runSource, undefined, error)));
        const parseResult = TaskConfig.parse(workspaceFolder, undefined, taskSystemInfo ? taskSystemInfo.platform : Platform.platform, workspaceFolderConfiguration.config, problemReporter, TaskConfig.TaskConfigSource.TasksJson, this._contextKeyService);
        let hasErrors = false;
        if (!parseResult.validationStatus.isOK() && (parseResult.validationStatus.state !== 1 /* ValidationState.Info */)) {
            hasErrors = true;
        }
        if (problemReporter.status.isFatal()) {
            problemReporter.fatal(nls.localize('TaskSystem.configurationErrors', 'Error: the provided task configuration has validation errors and can\'t not be used. Please correct the errors first.'));
            return { workspaceFolder, set: undefined, configurations: undefined, hasErrors };
        }
        let customizedTasks;
        if (parseResult.configured && parseResult.configured.length > 0) {
            customizedTasks = {
                byIdentifier: Object.create(null)
            };
            for (const task of parseResult.configured) {
                customizedTasks.byIdentifier[task.configures._key] = task;
            }
        }
        if (!this._jsonTasksSupported && (parseResult.custom.length > 0)) {
            this._logService.warn('Custom workspace tasks are not supported.');
        }
        return { workspaceFolder, set: { tasks: this._jsonTasksSupported ? parseResult.custom : [] }, configurations: customizedTasks, hasErrors };
    }
    _testParseExternalConfig(config, location) {
        if (!config) {
            return { config: undefined, hasParseErrors: false };
        }
        // eslint-disable-next-line local/code-no-any-casts
        const parseErrors = config.$parseErrors;
        if (parseErrors) {
            let isAffected = false;
            for (const parseError of parseErrors) {
                if (/tasks\.json$/.test(parseError)) {
                    isAffected = true;
                    break;
                }
            }
            if (isAffected) {
                this._log(nls.localize({ key: 'TaskSystem.invalidTaskJsonOther', comment: ['Message notifies of an error in one of several places there is tasks related json, not necessarily in a file named tasks.json'] }, 'Error: The content of the tasks json in {0} has syntax errors. Please correct them before executing a task.', location));
                this._showOutput(undefined, undefined, nls.localize({ key: 'TaskSystem.invalidTaskJsonOther', comment: ['Message notifies of an error in one of several places there is tasks related json, not necessarily in a file named tasks.json'] }, 'Error: The content of the tasks json in {0} has syntax errors. Please correct them before executing a task.', location));
                return { config, hasParseErrors: true };
            }
        }
        return { config, hasParseErrors: false };
    }
    _log(value, verbose) {
        if (!verbose || this._configurationService.getValue("task.verboseLogging" /* TaskSettingId.VerboseLogging */)) {
            this._outputChannel.append(value + '\n');
        }
    }
    async _computeWorkspaceFileTasks(workspaceFolder, runSource = 1 /* TaskRunSource.User */) {
        if (this._executionEngine === ExecutionEngine.Process) {
            return this._emptyWorkspaceTaskResults(workspaceFolder);
        }
        const workspaceFileConfig = this._getConfiguration(workspaceFolder, TaskSourceKind.WorkspaceFile);
        const configuration = this._testParseExternalConfig(workspaceFileConfig.config, nls.localize('TasksSystem.locationWorkspaceConfig', 'workspace file'));
        const customizedTasks = {
            byIdentifier: Object.create(null)
        };
        const custom = [];
        await this._computeTasksForSingleConfig(workspaceFolder, configuration.config, runSource, custom, customizedTasks.byIdentifier, TaskConfig.TaskConfigSource.WorkspaceFile);
        const engine = configuration.config ? TaskConfig.ExecutionEngine.from(configuration.config) : ExecutionEngine.Terminal;
        if (engine === ExecutionEngine.Process) {
            this._notificationService.warn(nls.localize('TaskSystem.versionWorkspaceFile', 'Only tasks version 2.0.0 permitted in workspace configuration files.'));
            return this._emptyWorkspaceTaskResults(workspaceFolder);
        }
        return { workspaceFolder, set: { tasks: custom }, configurations: customizedTasks, hasErrors: configuration.hasParseErrors };
    }
    async _computeUserTasks(workspaceFolder, runSource = 1 /* TaskRunSource.User */) {
        if (this._executionEngine === ExecutionEngine.Process) {
            return this._emptyWorkspaceTaskResults(workspaceFolder);
        }
        const userTasksConfig = this._getConfiguration(workspaceFolder, TaskSourceKind.User);
        const configuration = this._testParseExternalConfig(userTasksConfig.config, nls.localize('TasksSystem.locationUserConfig', 'user settings'));
        const customizedTasks = {
            byIdentifier: Object.create(null)
        };
        const custom = [];
        await this._computeTasksForSingleConfig(workspaceFolder, configuration.config, runSource, custom, customizedTasks.byIdentifier, TaskConfig.TaskConfigSource.User);
        const engine = configuration.config ? TaskConfig.ExecutionEngine.from(configuration.config) : ExecutionEngine.Terminal;
        if (engine === ExecutionEngine.Process) {
            this._notificationService.warn(nls.localize('TaskSystem.versionSettings', 'Only tasks version 2.0.0 permitted in user settings.'));
            return this._emptyWorkspaceTaskResults(workspaceFolder);
        }
        return { workspaceFolder, set: { tasks: custom }, configurations: customizedTasks, hasErrors: configuration.hasParseErrors };
    }
    _emptyWorkspaceTaskResults(workspaceFolder) {
        return { workspaceFolder, set: undefined, configurations: undefined, hasErrors: false };
    }
    async _computeTasksForSingleConfig(workspaceFolder, config, runSource, custom, customized, source, isRecentTask = false) {
        if (!config) {
            return false;
        }
        else if (!workspaceFolder) {
            this._logService.trace('TaskService.computeTasksForSingleConfig: no workspace folder for worskspace', this._workspace?.id);
            return false;
        }
        const taskSystemInfo = this._getTaskSystemInfo(workspaceFolder.uri.scheme);
        const problemReporter = new ProblemReporter(this._outputChannel);
        const parseResult = TaskConfig.parse(workspaceFolder, this._workspace, taskSystemInfo ? taskSystemInfo.platform : Platform.platform, config, problemReporter, source, this._contextKeyService, isRecentTask);
        let hasErrors = false;
        if (!parseResult.validationStatus.isOK() && (parseResult.validationStatus.state !== 1 /* ValidationState.Info */)) {
            this._showOutput(runSource);
            hasErrors = true;
        }
        if (problemReporter.status.isFatal()) {
            problemReporter.fatal(nls.localize('TaskSystem.configurationErrors', 'Error: the provided task configuration has validation errors and can\'t not be used. Please correct the errors first.'));
            return hasErrors;
        }
        if (parseResult.configured && parseResult.configured.length > 0) {
            for (const task of parseResult.configured) {
                customized[task.configures._key] = task;
            }
        }
        if (!this._jsonTasksSupported && (parseResult.custom.length > 0)) {
            this._logService.warn('Custom workspace tasks are not supported.');
        }
        else {
            for (const task of parseResult.custom) {
                custom.push(task);
            }
        }
        return hasErrors;
    }
    _computeConfiguration(workspaceFolder) {
        const { config, hasParseErrors } = this._getConfiguration(workspaceFolder);
        return Promise.resolve({ workspaceFolder, config, hasErrors: hasParseErrors });
    }
    _computeWorkspaceFolderSetup() {
        const workspaceFolders = [];
        const ignoredWorkspaceFolders = [];
        let executionEngine = ExecutionEngine.Terminal;
        let schemaVersion = 2 /* JsonSchemaVersion.V2_0_0 */;
        let workspace;
        if (this._contextService.getWorkbenchState() === 2 /* WorkbenchState.FOLDER */) {
            const workspaceFolder = this._contextService.getWorkspace().folders[0];
            workspaceFolders.push(workspaceFolder);
            executionEngine = this._computeExecutionEngine(workspaceFolder);
            schemaVersion = this._computeJsonSchemaVersion(workspaceFolder);
        }
        else if (this._contextService.getWorkbenchState() === 3 /* WorkbenchState.WORKSPACE */) {
            workspace = this._contextService.getWorkspace();
            for (const workspaceFolder of this._contextService.getWorkspace().folders) {
                if (schemaVersion === this._computeJsonSchemaVersion(workspaceFolder)) {
                    workspaceFolders.push(workspaceFolder);
                }
                else {
                    ignoredWorkspaceFolders.push(workspaceFolder);
                    this._log(nls.localize('taskService.ignoringFolder', 'Ignoring task configurations for workspace folder {0}. Multi folder workspace task support requires that all folders use task version 2.0.0', workspaceFolder.uri.fsPath));
                }
            }
        }
        return [workspaceFolders, ignoredWorkspaceFolders, executionEngine, schemaVersion, workspace];
    }
    _computeExecutionEngine(workspaceFolder) {
        const { config } = this._getConfiguration(workspaceFolder);
        if (!config) {
            return ExecutionEngine._default;
        }
        return TaskConfig.ExecutionEngine.from(config);
    }
    _computeJsonSchemaVersion(workspaceFolder) {
        const { config } = this._getConfiguration(workspaceFolder);
        if (!config) {
            return 2 /* JsonSchemaVersion.V2_0_0 */;
        }
        return TaskConfig.JsonSchemaVersion.from(config);
    }
    _getConfiguration(workspaceFolder, source) {
        let result;
        if ((source !== TaskSourceKind.User) && (this._contextService.getWorkbenchState() === 1 /* WorkbenchState.EMPTY */)) {
            result = undefined;
        }
        else {
            const wholeConfig = this._configurationService.inspect('tasks', { resource: workspaceFolder.uri });
            switch (source) {
                case TaskSourceKind.User: {
                    if (wholeConfig.userValue !== wholeConfig.workspaceFolderValue) {
                        result = Objects.deepClone(wholeConfig.userValue);
                    }
                    break;
                }
                case TaskSourceKind.Workspace:
                    result = Objects.deepClone(wholeConfig.workspaceFolderValue);
                    break;
                case TaskSourceKind.WorkspaceFile: {
                    if ((this._contextService.getWorkbenchState() === 3 /* WorkbenchState.WORKSPACE */)
                        && (wholeConfig.workspaceFolderValue !== wholeConfig.workspaceValue)) {
                        result = Objects.deepClone(wholeConfig.workspaceValue);
                    }
                    break;
                }
                default: result = Objects.deepClone(wholeConfig.workspaceFolderValue);
            }
        }
        if (!result) {
            return { config: undefined, hasParseErrors: false };
        }
        // eslint-disable-next-line local/code-no-any-casts
        const parseErrors = result.$parseErrors;
        if (parseErrors) {
            let isAffected = false;
            for (const parseError of parseErrors) {
                if (/tasks\.json$/.test(parseError)) {
                    isAffected = true;
                    break;
                }
            }
            if (isAffected) {
                this._log(nls.localize('TaskSystem.invalidTaskJson', 'Error: The content of the tasks.json file has syntax errors. Please correct them before executing a task.'));
                this._showOutput(undefined, undefined, nls.localize('TaskSystem.invalidTaskJson', 'Error: The content of the tasks.json file has syntax errors. Please correct them before executing a task.'));
                return { config: undefined, hasParseErrors: true };
            }
        }
        return { config: result, hasParseErrors: false };
    }
    inTerminal() {
        if (this._taskSystem) {
            return this._taskSystem instanceof TerminalTaskSystem;
        }
        return this._executionEngine === ExecutionEngine.Terminal;
    }
    configureAction() {
        const thisCapture = this;
        return new class extends Action {
            constructor() {
                super(ConfigureTaskAction.ID, ConfigureTaskAction.TEXT.value, undefined, true, () => { thisCapture._runConfigureTasks(); return Promise.resolve(undefined); });
            }
        };
    }
    _handleError(err) {
        let showOutput = true;
        if (err instanceof TaskError) {
            const buildError = err;
            const needsConfig = buildError.code === 0 /* TaskErrors.NotConfigured */ || buildError.code === 2 /* TaskErrors.NoBuildTask */ || buildError.code === 3 /* TaskErrors.NoTestTask */;
            const needsTerminate = buildError.code === 1 /* TaskErrors.RunningTask */;
            if (needsConfig || needsTerminate) {
                this._notificationService.prompt(buildError.severity, buildError.message, [{
                        label: needsConfig ? ConfigureTaskAction.TEXT.value : nls.localize('TerminateAction.label', "Terminate Task"),
                        run: () => {
                            if (needsConfig) {
                                this._runConfigureTasks();
                            }
                            else {
                                this._runTerminateCommand();
                            }
                        }
                    }]);
            }
            else {
                this._notificationService.notify({ severity: buildError.severity, message: buildError.message });
            }
        }
        else if (err instanceof Error) {
            const error = err;
            this._notificationService.error(error.message);
            showOutput = false;
        }
        else if (Types.isString(err)) {
            this._notificationService.error(err);
        }
        else {
            this._notificationService.error(nls.localize('TaskSystem.unknownError', 'An error has occurred while running a task. See task log for details.'));
        }
        if (showOutput) {
            this._showOutput(undefined, undefined, err);
        }
    }
    _showDetail() {
        return this._configurationService.getValue(QUICKOPEN_DETAIL_CONFIG);
    }
    async _createTaskQuickPickEntries(tasks, group = false, sort = false, selectedEntry, includeRecents = true) {
        let encounteredTasks = {};
        if (tasks === undefined || tasks === null || tasks.length === 0) {
            return [];
        }
        const TaskQuickPickEntry = (task) => {
            const newEntry = { label: task._label, description: this.getTaskDescription(task), task, detail: this._showDetail() ? task.configurationProperties.detail : undefined };
            if (encounteredTasks[task._id]) {
                if (encounteredTasks[task._id].length === 1) {
                    encounteredTasks[task._id][0].label += ' (1)';
                }
                newEntry.label = newEntry.label + ' (' + (encounteredTasks[task._id].length + 1).toString() + ')';
            }
            else {
                encounteredTasks[task._id] = [];
            }
            encounteredTasks[task._id].push(newEntry);
            return newEntry;
        };
        function fillEntries(entries, tasks, groupLabel) {
            if (tasks.length) {
                entries.push({ type: 'separator', label: groupLabel });
            }
            for (const task of tasks) {
                const entry = TaskQuickPickEntry(task);
                entry.buttons = [{ iconClass: ThemeIcon.asClassName(configureTaskIcon), tooltip: nls.localize('configureTask', "Configure Task") }];
                if (selectedEntry && (task === selectedEntry.task)) {
                    entries.unshift(selectedEntry);
                }
                else {
                    entries.push(entry);
                }
            }
        }
        let entries;
        if (group) {
            entries = [];
            if (tasks.length === 1) {
                entries.push(TaskQuickPickEntry(tasks[0]));
            }
            else {
                const recentlyUsedTasks = await this.getSavedTasks('historical');
                const recent = [];
                const recentSet = new Set();
                let configured = [];
                let detected = [];
                const taskMap = Object.create(null);
                tasks.forEach(task => {
                    const key = task.getCommonTaskId();
                    if (key) {
                        taskMap[key] = task;
                    }
                });
                recentlyUsedTasks.reverse().forEach(recentTask => {
                    const key = recentTask.getCommonTaskId();
                    if (key) {
                        recentSet.add(key);
                        const task = taskMap[key];
                        if (task) {
                            recent.push(task);
                        }
                    }
                });
                for (const task of tasks) {
                    const key = task.getCommonTaskId();
                    if (!key || !recentSet.has(key)) {
                        if ((task._source.kind === TaskSourceKind.Workspace) || (task._source.kind === TaskSourceKind.User)) {
                            configured.push(task);
                        }
                        else {
                            detected.push(task);
                        }
                    }
                }
                const sorter = this.createSorter();
                if (includeRecents) {
                    fillEntries(entries, recent, nls.localize('recentlyUsed', 'recently used tasks'));
                }
                configured = configured.sort((a, b) => sorter.compare(a, b));
                fillEntries(entries, configured, nls.localize('configured', 'configured tasks'));
                detected = detected.sort((a, b) => sorter.compare(a, b));
                fillEntries(entries, detected, nls.localize('detected', 'detected tasks'));
            }
        }
        else {
            if (sort) {
                const sorter = this.createSorter();
                tasks = tasks.sort((a, b) => sorter.compare(a, b));
            }
            entries = tasks.map(task => TaskQuickPickEntry(task));
        }
        encounteredTasks = {};
        return entries;
    }
    async _showTwoLevelQuickPick(placeHolder, defaultEntry, type, name) {
        return this._instantiationService.createInstance(TaskQuickPick).show(placeHolder, defaultEntry, type, name);
    }
    async _showQuickPick(tasks, placeHolder, defaultEntry, group = false, sort = false, selectedEntry, additionalEntries, name) {
        const resolvedTasks = await tasks;
        const entries = await raceTimeout(this._createTaskQuickPickEntries(resolvedTasks, group, sort, selectedEntry), 200, () => undefined);
        if (!entries) {
            return undefined;
        }
        if (entries.length === 1 && this._configurationService.getValue(QUICKOPEN_SKIP_CONFIG)) {
            return entries[0];
        }
        else if ((entries.length === 0) && defaultEntry) {
            entries.push(defaultEntry);
        }
        else if (entries.length > 1 && additionalEntries && additionalEntries.length > 0) {
            entries.push({ type: 'separator', label: '' });
            entries.push(additionalEntries[0]);
        }
        return this._quickInputService.pick(entries, {
            value: name,
            placeHolder,
            matchOnDescription: true,
            onDidTriggerItemButton: context => {
                const task = context.item.task;
                this._quickInputService.cancel();
                if (ContributedTask.is(task)) {
                    this.customize(task, undefined, true);
                }
                else if (CustomTask.is(task)) {
                    this.openConfig(task);
                }
            },
        });
    }
    _needsRecentTasksMigration() {
        return (this.getRecentlyUsedTasksV1().size > 0) && (this._getTasksFromStorage('historical').size === 0);
    }
    async _migrateRecentTasks(tasks) {
        if (!this._needsRecentTasksMigration()) {
            return;
        }
        const recentlyUsedTasks = this.getRecentlyUsedTasksV1();
        const taskMap = Object.create(null);
        tasks.forEach(task => {
            const key = task.getKey();
            if (key) {
                taskMap[key] = task;
            }
        });
        const reversed = [...recentlyUsedTasks.keys()].reverse();
        for (const key in reversed) {
            const task = taskMap[key];
            if (task) {
                await this._setRecentlyUsedTask(task);
            }
        }
        this._storageService.remove(AbstractTaskService_1.RecentlyUsedTasks_Key, 1 /* StorageScope.WORKSPACE */);
    }
    _showIgnoredFoldersMessage() {
        if (this.ignoredWorkspaceFolders.length === 0 || !this.showIgnoreMessage) {
            return Promise.resolve(undefined);
        }
        this._notificationService.prompt(Severity.Info, nls.localize('TaskService.ignoredFolder', 'The following workspace folders are ignored since they use task version 0.1.0: {0}', this.ignoredWorkspaceFolders.map(f => f.name).join(', ')), [{
                label: nls.localize('TaskService.notAgain', "Don't Show Again"),
                isSecondary: true,
                run: () => {
                    this._storageService.store(AbstractTaskService_1.IgnoreTask010DonotShowAgain_key, true, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
                    this._showIgnoreMessage = false;
                }
            }]);
        return Promise.resolve(undefined);
    }
    async _trust() {
        const context = this._contextKeyService.getContext(getActiveElement());
        if (ServerlessWebContext.getValue(this._contextKeyService) && !TaskExecutionSupportedContext?.evaluate(context)) {
            return false;
        }
        await this._workspaceTrustManagementService.workspaceTrustInitialized;
        if (!this._workspaceTrustManagementService.isWorkspaceTrusted()) {
            return (await this._workspaceTrustRequestService.requestWorkspaceTrust({
                message: nls.localize('TaskService.requestTrust', "Listing and running tasks requires that some of the files in this workspace be executed as code.")
            })) === true;
        }
        return true;
    }
    async _runTaskCommand(filter) {
        if (!this._tasksReconnected) {
            return;
        }
        if (!filter) {
            return this._doRunTaskCommand();
        }
        const type = typeof filter === 'string' ? undefined : filter.type;
        const taskName = typeof filter === 'string' ? filter : filter.task;
        const grouped = await this._getGroupedTasks({ type });
        const identifier = this._getTaskIdentifier(filter);
        const tasks = grouped.all();
        const resolver = this._createResolver(grouped);
        const folderURIs = this._contextService.getWorkspace().folders.map(folder => folder.uri);
        if (this._contextService.getWorkbenchState() === 3 /* WorkbenchState.WORKSPACE */) {
            folderURIs.push(this._contextService.getWorkspace().configuration);
        }
        folderURIs.push(USER_TASKS_GROUP_KEY);
        if (identifier) {
            for (const uri of folderURIs) {
                const task = await resolver.resolve(uri, identifier);
                if (task) {
                    this.run(task);
                    return;
                }
            }
        }
        const exactMatchTask = !taskName ? undefined : tasks.find(t => t.configurationProperties.identifier === taskName || t.getDefinition(true)?.configurationProperties?.identifier === taskName);
        if (!exactMatchTask) {
            return this._doRunTaskCommand(tasks, type, taskName);
        }
        for (const uri of folderURIs) {
            const task = await resolver.resolve(uri, taskName);
            if (task) {
                await this.run(task, { attachProblemMatcher: true }, 1 /* TaskRunSource.User */);
                return;
            }
        }
    }
    _tasksAndGroupedTasks(filter) {
        if (!this._versionAndEngineCompatible(filter)) {
            return { tasks: Promise.resolve([]), grouped: Promise.resolve(new TaskMap()) };
        }
        const grouped = this._getGroupedTasks(filter);
        const tasks = grouped.then((map) => {
            if (!filter || !filter.type) {
                return map.all();
            }
            const result = [];
            map.forEach((tasks) => {
                for (const task of tasks) {
                    if (ContributedTask.is(task) && task.defines.type === filter.type) {
                        result.push(task);
                    }
                    else if (CustomTask.is(task)) {
                        if (task.type === filter.type) {
                            result.push(task);
                        }
                        else {
                            const customizes = task.customizes();
                            if (customizes && customizes.type === filter.type) {
                                result.push(task);
                            }
                        }
                    }
                }
            });
            return result;
        });
        return { tasks, grouped };
    }
    _doRunTaskCommand(tasks, type, name) {
        const pickThen = (task) => {
            if (task === undefined) {
                return;
            }
            if (task === null) {
                this._runConfigureTasks();
            }
            else {
                this.run(task, { attachProblemMatcher: true }, 1 /* TaskRunSource.User */).then(undefined, reason => {
                    // eat the error, it has already been surfaced to the user and we don't care about it here
                });
            }
        };
        const placeholder = nls.localize('TaskService.pickRunTask', 'Select the task to run');
        this._showIgnoredFoldersMessage().then(() => {
            if (this._configurationService.getValue(USE_SLOW_PICKER)) {
                let taskResult = undefined;
                if (!tasks) {
                    taskResult = this._tasksAndGroupedTasks();
                }
                this._showQuickPick(tasks ? tasks : taskResult.tasks, placeholder, {
                    label: '$(plus) ' + nls.localize('TaskService.noEntryToRun', 'Configure a Task'),
                    task: null
                }, true, undefined, undefined, undefined, name).
                    then((entry) => {
                    return pickThen(entry ? entry.task : undefined);
                });
            }
            else {
                this._showTwoLevelQuickPick(placeholder, {
                    label: '$(plus) ' + nls.localize('TaskService.noEntryToRun', 'Configure a Task'),
                    task: null
                }, type, name).
                    then(pickThen);
            }
        });
    }
    async rerun(terminalInstanceId) {
        const task = await this._taskSystem?.getTaskForTerminal(terminalInstanceId);
        if (task) {
            this._restart(task);
        }
        else {
            this._reRunTaskCommand(true);
        }
    }
    _reRunTaskCommand(onlyRerun) {
        ProblemMatcherRegistry.onReady().then(() => {
            return this._editorService.saveAll({ reason: 2 /* SaveReason.AUTO */ }).then(() => {
                const executeResult = this._getTaskSystem().rerun();
                if (executeResult) {
                    return this._handleExecuteResult(executeResult);
                }
                else {
                    if (!onlyRerun && !this._taskRunningState.get()) {
                        // No task running, prompt to ask which to run
                        this._doRunTaskCommand();
                    }
                    return Promise.resolve(undefined);
                }
            });
        });
    }
    /**
     *
     * @param tasks - The tasks which need to be filtered
     * @param tasksInList - This tells splitPerGroupType to filter out globbed tasks (into defaults)
     * @returns
     */
    _getDefaultTasks(tasks, taskGlobsInList = false) {
        const defaults = [];
        for (const task of tasks.filter(t => !!t.configurationProperties.group)) {
            // At this point (assuming taskGlobsInList is true) there are tasks with matching globs, so only put those in defaults
            if (taskGlobsInList && typeof task.configurationProperties.group.isDefault === 'string') {
                defaults.push(task);
            }
            else if (!taskGlobsInList && task.configurationProperties.group.isDefault === true) {
                defaults.push(task);
            }
        }
        return defaults;
    }
    _runTaskGroupCommand(taskGroup, strings, configure, legacyCommand) {
        if (this.schemaVersion === 1 /* JsonSchemaVersion.V0_1_0 */) {
            legacyCommand();
            return;
        }
        const options = {
            location: 10 /* ProgressLocation.Window */,
            title: strings.fetching
        };
        const promise = (async () => {
            async function runSingleTask(task, problemMatcherOptions, that) {
                that.run(task, problemMatcherOptions, 1 /* TaskRunSource.User */).then(undefined, reason => {
                    // eat the error, it has already been surfaced to the user and we don't care about it here
                });
            }
            const chooseAndRunTask = (tasks) => {
                this._showIgnoredFoldersMessage().then(() => {
                    this._showQuickPick(tasks, strings.select, {
                        label: strings.notFoundConfigure,
                        task: null
                    }, true).then((entry) => {
                        const task = entry ? entry.task : undefined;
                        if (task === undefined) {
                            return;
                        }
                        if (task === null) {
                            configure.apply(this);
                            return;
                        }
                        runSingleTask(task, { attachProblemMatcher: true }, this);
                    });
                });
            };
            let groupTasks = [];
            const { globGroupTasks, globTasksDetected } = await this._getGlobTasks(taskGroup._id);
            groupTasks = [...globGroupTasks];
            if (!globTasksDetected && groupTasks.length === 0) {
                groupTasks = await this._findWorkspaceTasksInGroup(taskGroup, true);
            }
            const handleMultipleTasks = (areGlobTasks) => {
                return this._getTasksForGroup(taskGroup).then((tasks) => {
                    if (tasks.length > 0) {
                        // If we're dealing with tasks that were chosen because of a glob match,
                        // then put globs in the defaults and everything else in none
                        const defaults = this._getDefaultTasks(tasks, areGlobTasks);
                        if (defaults.length === 1) {
                            runSingleTask(defaults[0], undefined, this);
                            return;
                        }
                        else if (defaults.length > 0) {
                            tasks = defaults;
                        }
                    }
                    // At this this point there are multiple tasks.
                    chooseAndRunTask(tasks);
                });
            };
            const resolveTaskAndRun = (taskGroupTask) => {
                if (ConfiguringTask.is(taskGroupTask)) {
                    this.tryResolveTask(taskGroupTask).then(resolvedTask => {
                        runSingleTask(resolvedTask, undefined, this);
                    });
                }
                else {
                    runSingleTask(taskGroupTask, undefined, this);
                }
            };
            // A single default glob task was returned, just run it directly
            if (groupTasks.length === 1) {
                return resolveTaskAndRun(groupTasks[0]);
            }
            // If there's multiple globs that match we want to show the quick picker for those tasks
            // We will need to call splitPerGroupType putting globs in defaults and the remaining tasks in none.
            // We don't need to carry on after here
            if (globTasksDetected && groupTasks.length > 1) {
                return handleMultipleTasks(true);
            }
            // If no globs are found or matched fallback to checking for default tasks of the task group
            if (!groupTasks.length) {
                groupTasks = await this._findWorkspaceTasksInGroup(taskGroup, true);
            }
            if (groupTasks.length === 1) {
                // A single default task was returned, just run it directly
                return resolveTaskAndRun(groupTasks[0]);
            }
            // Multiple default tasks returned, show the quickPicker
            return handleMultipleTasks(false);
        })();
        this._progressService.withProgress(options, () => promise);
    }
    async _getGlobTasks(taskGroupId) {
        let globTasksDetected = false;
        // First check for globs before checking for the default tasks of the task group
        const absoluteURI = EditorResourceAccessor.getOriginalUri(this._editorService.activeEditor);
        if (absoluteURI) {
            const workspaceFolder = this._contextService.getWorkspaceFolder(absoluteURI);
            if (workspaceFolder) {
                const configuredTasks = this._getConfiguration(workspaceFolder)?.config?.tasks;
                if (configuredTasks) {
                    globTasksDetected = configuredTasks.filter(task => task.group && typeof task.group !== 'string' && typeof task.group.isDefault === 'string').length > 0;
                    // This will activate extensions, so only do so if necessary #185960
                    if (globTasksDetected) {
                        // Fallback to absolute path of the file if it is not in a workspace or relative path cannot be found
                        const relativePath = workspaceFolder?.uri ? (resources.relativePath(workspaceFolder.uri, absoluteURI) ?? absoluteURI.path) : absoluteURI.path;
                        const globGroupTasks = await this._findWorkspaceTasks((task) => {
                            const currentTaskGroup = task.configurationProperties.group;
                            if (currentTaskGroup && typeof currentTaskGroup !== 'string' && typeof currentTaskGroup.isDefault === 'string') {
                                return (currentTaskGroup._id === taskGroupId && glob.match(currentTaskGroup.isDefault, relativePath, { ignoreCase: true }));
                            }
                            globTasksDetected = false;
                            return false;
                        });
                        return { globGroupTasks, globTasksDetected };
                    }
                }
            }
        }
        return { globGroupTasks: [], globTasksDetected };
    }
    _runBuildCommand() {
        if (!this._tasksReconnected) {
            return;
        }
        return this._runTaskGroupCommand(TaskGroup.Build, {
            fetching: nls.localize('TaskService.fetchingBuildTasks', 'Fetching build tasks...'),
            select: nls.localize('TaskService.pickBuildTask', 'Select the build task to run'),
            notFoundConfigure: nls.localize('TaskService.noBuildTask', 'No build task to run found. Configure Build Task...')
        }, this._runConfigureDefaultBuildTask, this._build);
    }
    _runTestCommand() {
        return this._runTaskGroupCommand(TaskGroup.Test, {
            fetching: nls.localize('TaskService.fetchingTestTasks', 'Fetching test tasks...'),
            select: nls.localize('TaskService.pickTestTask', 'Select the test task to run'),
            notFoundConfigure: nls.localize('TaskService.noTestTaskTerminal', 'No test task to run found. Configure Tasks...')
        }, this._runConfigureDefaultTestTask, this._runTest);
    }
    _runTerminateCommand(arg) {
        if (arg === 'terminateAll') {
            this._terminateAll();
            return;
        }
        const runQuickPick = (promise) => {
            this._showQuickPick(promise || this.getActiveTasks(), nls.localize('TaskService.taskToTerminate', 'Select a task to terminate'), {
                label: nls.localize('TaskService.noTaskRunning', 'No task is currently running'),
                task: undefined
            }, false, true, undefined, [{
                    label: nls.localize('TaskService.terminateAllRunningTasks', 'All Running Tasks'),
                    id: 'terminateAll',
                    task: undefined
                }]).then(entry => {
                if (entry && entry.id === 'terminateAll') {
                    this._terminateAll();
                }
                const task = entry ? entry.task : undefined;
                if (task === undefined || task === null) {
                    return;
                }
                this.terminate(task);
            });
        };
        if (this.inTerminal()) {
            const identifier = this._getTaskIdentifier(arg);
            let promise;
            if (identifier !== undefined) {
                promise = this.getActiveTasks();
                promise.then((tasks) => {
                    for (const task of tasks) {
                        if (task.matches(identifier)) {
                            this.terminate(task);
                            return;
                        }
                    }
                    runQuickPick(promise);
                });
            }
            else {
                runQuickPick();
            }
        }
        else {
            this._isActive().then((active) => {
                if (active) {
                    this._terminateAll().then((responses) => {
                        // the output runner has only one task
                        const response = responses[0];
                        if (response.success) {
                            return;
                        }
                        if (response.code && response.code === 3 /* TerminateResponseCode.ProcessNotFound */) {
                            this._notificationService.error(nls.localize('TerminateAction.noProcess', 'The launched process doesn\'t exist anymore. If the task spawned background tasks exiting VS Code might result in orphaned processes.'));
                        }
                        else {
                            this._notificationService.error(nls.localize('TerminateAction.failed', 'Failed to terminate running task'));
                        }
                    });
                }
            });
        }
    }
    async _runRestartTaskCommand(arg) {
        const activeTasks = await this.getActiveTasks();
        if (activeTasks.length === 1) {
            this._restart(activeTasks[0]);
            return;
        }
        if (this.inTerminal()) {
            // try dispatching using task identifier
            const identifier = this._getTaskIdentifier(arg);
            if (identifier !== undefined) {
                for (const task of activeTasks) {
                    if (task.matches(identifier)) {
                        this._restart(task);
                        return;
                    }
                }
            }
            // show quick pick with active tasks
            const entry = await this._showQuickPick(activeTasks, nls.localize('TaskService.taskToRestart', 'Select the task to restart'), {
                label: nls.localize('TaskService.noTaskToRestart', 'No task to restart'),
                task: null
            }, false, true);
            if (entry && entry.task) {
                this._restart(entry.task);
            }
        }
        else {
            if (activeTasks.length > 0) {
                this._restart(activeTasks[0]);
            }
        }
    }
    async _runRerunAllRunningTasksCommand() {
        const activeTasks = await this.getActiveTasks();
        if (activeTasks.length === 0) {
            this._notificationService.info(nls.localize('TaskService.noRunningTasks', 'No running tasks to restart'));
            return;
        }
        // Restart all active tasks
        const restartPromises = activeTasks.map(task => this._restart(task));
        await Promise.allSettled(restartPromises);
    }
    _getTaskIdentifier(filter) {
        let result = undefined;
        if (Types.isString(filter)) {
            result = filter;
        }
        else if (filter && Types.isString(filter.type)) {
            result = TaskDefinition.createTaskIdentifier(filter, console);
        }
        return result;
    }
    _configHasTasks(taskConfig) {
        return !!taskConfig && !!taskConfig.tasks && taskConfig.tasks.length > 0;
    }
    _openTaskFile(resource, taskSource) {
        let configFileCreated = false;
        this._fileService.stat(resource).then((stat) => stat, () => undefined).then(async (stat) => {
            const fileExists = !!stat;
            const configValue = this._configurationService.inspect('tasks', { resource });
            let tasksExistInFile;
            let target;
            switch (taskSource) {
                case TaskSourceKind.User:
                    tasksExistInFile = this._configHasTasks(configValue.userValue);
                    target = 2 /* ConfigurationTarget.USER */;
                    break;
                case TaskSourceKind.WorkspaceFile:
                    tasksExistInFile = this._configHasTasks(configValue.workspaceValue);
                    target = 5 /* ConfigurationTarget.WORKSPACE */;
                    break;
                default:
                    tasksExistInFile = this._configHasTasks(configValue.workspaceFolderValue);
                    target = 6 /* ConfigurationTarget.WORKSPACE_FOLDER */;
            }
            let content;
            if (!tasksExistInFile) {
                const pickTemplateResult = await this._quickInputService.pick(getTaskTemplates(), { placeHolder: nls.localize('TaskService.template', 'Select a Task Template') });
                if (!pickTemplateResult) {
                    return Promise.resolve(undefined);
                }
                content = pickTemplateResult.content;
                // eslint-disable-next-line local/code-no-any-casts
                const editorConfig = this._configurationService.getValue();
                if (editorConfig.editor.insertSpaces) {
                    content = content.replace(/(\n)(\t+)/g, (_, s1, s2) => s1 + ' '.repeat(s2.length * editorConfig.editor.tabSize));
                }
                configFileCreated = true;
            }
            if (!fileExists && content) {
                return this._textFileService.create([{ resource, value: content }]).then(result => {
                    return result[0].resource;
                });
            }
            else if (fileExists && (tasksExistInFile || content)) {
                const statResource = stat?.resource;
                if (content && statResource) {
                    this._configurationService.updateValue('tasks', json.parse(content), { resource: statResource }, target);
                }
                return statResource;
            }
            return undefined;
        }).then((resource) => {
            if (!resource) {
                return;
            }
            this._editorService.openEditor({
                resource,
                options: {
                    pinned: configFileCreated // pin only if config file is created #8727
                }
            });
        });
    }
    _isTaskEntry(value) {
        // eslint-disable-next-line local/code-no-any-casts
        const candidate = value;
        return candidate && !!candidate.task;
    }
    _isSettingEntry(value) {
        // eslint-disable-next-line local/code-no-any-casts
        const candidate = value;
        return candidate && !!candidate.settingType;
    }
    _configureTask(task) {
        if (ContributedTask.is(task)) {
            this.customize(task, undefined, true);
        }
        else if (CustomTask.is(task)) {
            this.openConfig(task);
        }
        else if (ConfiguringTask.is(task)) {
            // Do nothing.
        }
    }
    _handleSelection(selection) {
        if (!selection) {
            return;
        }
        if (this._isTaskEntry(selection)) {
            this._configureTask(selection.task);
        }
        else if (this._isSettingEntry(selection)) {
            const taskQuickPick = this._instantiationService.createInstance(TaskQuickPick);
            taskQuickPick.handleSettingOption(selection.settingType);
        }
        else if (selection.folder && (this._contextService.getWorkbenchState() !== 1 /* WorkbenchState.EMPTY */)) {
            this._openTaskFile(selection.folder.toResource('.vscode/tasks.json'), TaskSourceKind.Workspace);
        }
        else {
            const resource = this._getResourceForKind(TaskSourceKind.User);
            if (resource) {
                this._openTaskFile(resource, TaskSourceKind.User);
            }
        }
    }
    getTaskDescription(task) {
        let description;
        if (task._source.kind === TaskSourceKind.User) {
            description = nls.localize('taskQuickPick.userSettings', 'User');
        }
        else if (task._source.kind === TaskSourceKind.WorkspaceFile) {
            description = task.getWorkspaceFileName();
        }
        else if (this.needsFolderQualification()) {
            const workspaceFolder = task.getWorkspaceFolder();
            if (workspaceFolder) {
                description = workspaceFolder.name;
            }
        }
        return description;
    }
    async _runConfigureTasks() {
        if (!(await this._trust())) {
            return;
        }
        let taskPromise;
        if (this.schemaVersion === 2 /* JsonSchemaVersion.V2_0_0 */) {
            taskPromise = this._getGroupedTasks();
        }
        else {
            taskPromise = Promise.resolve(new TaskMap());
        }
        const stats = this._contextService.getWorkspace().folders.map((folder) => {
            return this._fileService.stat(folder.toResource('.vscode/tasks.json')).then(stat => stat, () => undefined);
        });
        const createLabel = nls.localize('TaskService.createJsonFile', 'Create tasks.json file from template');
        const openLabel = nls.localize('TaskService.openJsonFile', 'Open tasks.json file');
        const tokenSource = new CancellationTokenSource();
        const cancellationToken = tokenSource.token;
        const entries = Promise.all(stats).then((stats) => {
            return taskPromise.then((taskMap) => {
                const entries = [];
                let configuredCount = 0;
                let tasks = taskMap.all();
                if (tasks.length > 0) {
                    tasks = tasks.sort((a, b) => a._label.localeCompare(b._label));
                    for (const task of tasks) {
                        const entry = { label: TaskQuickPick.getTaskLabelWithIcon(task), task, description: this.getTaskDescription(task), detail: this._showDetail() ? task.configurationProperties.detail : undefined };
                        TaskQuickPick.applyColorStyles(task, entry, this._themeService);
                        entries.push(entry);
                        if (!ContributedTask.is(task)) {
                            configuredCount++;
                        }
                    }
                }
                const needsCreateOrOpen = (configuredCount === 0);
                // If the only configured tasks are user tasks, then we should also show the option to create from a template.
                if (needsCreateOrOpen || (taskMap.get(USER_TASKS_GROUP_KEY).length === configuredCount)) {
                    const label = stats[0] !== undefined ? openLabel : createLabel;
                    if (entries.length) {
                        entries.push({ type: 'separator' });
                    }
                    entries.push({ label, folder: this._contextService.getWorkspace().folders[0] });
                }
                if ((entries.length === 1) && !needsCreateOrOpen) {
                    tokenSource.cancel();
                }
                return entries;
            });
        });
        const timeout = await Promise.race([new Promise((resolve) => {
                entries.then(() => resolve(false));
            }), new Promise((resolve) => {
                const timer = setTimeout(() => {
                    clearTimeout(timer);
                    resolve(true);
                }, 200);
            })]);
        if (!timeout && ((await entries).length === 1) && this._configurationService.getValue(QUICKOPEN_SKIP_CONFIG)) {
            const entry = (await entries)[0];
            if (entry.task) {
                this._handleSelection(entry);
                return;
            }
        }
        const entriesWithSettings = entries.then(resolvedEntries => {
            resolvedEntries.push(...TaskQuickPick.allSettingEntries(this._configurationService));
            return resolvedEntries;
        });
        this._quickInputService.pick(entriesWithSettings, { placeHolder: nls.localize('TaskService.pickTask', 'Select a task to configure') }, cancellationToken).
            then(async (selection) => {
            if (cancellationToken.isCancellationRequested) {
                // canceled when there's only one task
                const task = (await entries)[0];
                // eslint-disable-next-line local/code-no-any-casts
                if (task.task) {
                    selection = task;
                }
            }
            this._handleSelection(selection);
        });
    }
    _runConfigureDefaultBuildTask() {
        if (this.schemaVersion === 2 /* JsonSchemaVersion.V2_0_0 */) {
            this.tasks().then((tasks => {
                if (tasks.length === 0) {
                    this._runConfigureTasks();
                    return;
                }
                const entries = [];
                let selectedTask;
                let selectedEntry;
                this._showIgnoredFoldersMessage().then(async () => {
                    const { globGroupTasks } = await this._getGlobTasks(TaskGroup.Build._id);
                    let defaultTasks = globGroupTasks;
                    if (!defaultTasks?.length) {
                        defaultTasks = this._getDefaultTasks(tasks, false);
                    }
                    let defaultBuildTask;
                    if (defaultTasks.length === 1) {
                        const group = defaultTasks[0].configurationProperties.group;
                        if (group) {
                            if (typeof group === 'string' && group === TaskGroup.Build._id) {
                                defaultBuildTask = defaultTasks[0];
                            }
                            else {
                                defaultBuildTask = defaultTasks[0];
                            }
                        }
                    }
                    for (const task of tasks) {
                        if (task === defaultBuildTask) {
                            const label = nls.localize('TaskService.defaultBuildTaskExists', '{0} is already marked as the default build task', TaskQuickPick.getTaskLabelWithIcon(task, task.getQualifiedLabel()));
                            selectedTask = task;
                            selectedEntry = { label, task, description: this.getTaskDescription(task), detail: this._showDetail() ? task.configurationProperties.detail : undefined };
                            TaskQuickPick.applyColorStyles(task, selectedEntry, this._themeService);
                        }
                        else {
                            const entry = { label: TaskQuickPick.getTaskLabelWithIcon(task), task, description: this.getTaskDescription(task), detail: this._showDetail() ? task.configurationProperties.detail : undefined };
                            TaskQuickPick.applyColorStyles(task, entry, this._themeService);
                            entries.push(entry);
                        }
                    }
                    if (selectedEntry) {
                        entries.unshift(selectedEntry);
                    }
                    const tokenSource = new CancellationTokenSource();
                    const cancellationToken = tokenSource.token;
                    this._quickInputService.pick(entries, { placeHolder: nls.localize('TaskService.pickTask', 'Select a task to configure') }, cancellationToken).
                        then(async (entry) => {
                        if (cancellationToken.isCancellationRequested) {
                            // canceled when there's only one task
                            const task = (await entries)[0];
                            // eslint-disable-next-line local/code-no-any-casts
                            if (task.task) {
                                entry = task;
                            }
                        }
                        const task = entry && 'task' in entry ? entry.task : undefined;
                        if ((task === undefined) || (task === null)) {
                            return;
                        }
                        if (task === selectedTask && CustomTask.is(task)) {
                            this.openConfig(task);
                        }
                        if (!InMemoryTask.is(task)) {
                            this.customize(task, { group: { kind: 'build', isDefault: true } }, true).then(() => {
                                if (selectedTask && (task !== selectedTask) && !InMemoryTask.is(selectedTask)) {
                                    this.customize(selectedTask, { group: 'build' }, false);
                                }
                            });
                        }
                    });
                    this._quickInputService.pick(entries, {
                        placeHolder: nls.localize('TaskService.pickDefaultBuildTask', 'Select the task to be used as the default build task')
                    }).
                        then((entry) => {
                        const task = entry && 'task' in entry ? entry.task : undefined;
                        if ((task === undefined) || (task === null)) {
                            return;
                        }
                        if (task === selectedTask && CustomTask.is(task)) {
                            this.openConfig(task);
                        }
                        if (!InMemoryTask.is(task)) {
                            this.customize(task, { group: { kind: 'build', isDefault: true } }, true).then(() => {
                                if (selectedTask && (task !== selectedTask) && !InMemoryTask.is(selectedTask)) {
                                    this.customize(selectedTask, { group: 'build' }, false);
                                }
                            });
                        }
                    });
                });
            }));
        }
        else {
            this._runConfigureTasks();
        }
    }
    _runConfigureDefaultTestTask() {
        if (this.schemaVersion === 2 /* JsonSchemaVersion.V2_0_0 */) {
            this.tasks().then((tasks => {
                if (tasks.length === 0) {
                    this._runConfigureTasks();
                    return;
                }
                let selectedTask;
                let selectedEntry;
                for (const task of tasks) {
                    const taskGroup = TaskGroup.from(task.configurationProperties.group);
                    if (taskGroup && taskGroup.isDefault && taskGroup._id === TaskGroup.Test._id) {
                        selectedTask = task;
                        break;
                    }
                }
                if (selectedTask) {
                    selectedEntry = {
                        label: nls.localize('TaskService.defaultTestTaskExists', '{0} is already marked as the default test task.', selectedTask.getQualifiedLabel()),
                        task: selectedTask,
                        detail: this._showDetail() ? selectedTask.configurationProperties.detail : undefined
                    };
                }
                this._showIgnoredFoldersMessage().then(() => {
                    this._showQuickPick(tasks, nls.localize('TaskService.pickDefaultTestTask', 'Select the task to be used as the default test task'), undefined, true, false, selectedEntry).then((entry) => {
                        const task = entry ? entry.task : undefined;
                        if (!task) {
                            return;
                        }
                        if (task === selectedTask && CustomTask.is(task)) {
                            this.openConfig(task);
                        }
                        if (!InMemoryTask.is(task)) {
                            this.customize(task, { group: { kind: 'test', isDefault: true } }, true).then(() => {
                                if (selectedTask && (task !== selectedTask) && !InMemoryTask.is(selectedTask)) {
                                    this.customize(selectedTask, { group: 'test' }, false);
                                }
                            });
                        }
                    });
                });
            }));
        }
        else {
            this._runConfigureTasks();
        }
    }
    async runShowTasks() {
        const activeTasksPromise = this.getActiveTasks();
        const activeTasks = await activeTasksPromise;
        let group;
        if (activeTasks.length === 1) {
            this._taskSystem.revealTask(activeTasks[0]);
        }
        else if (activeTasks.length && activeTasks.every((task) => {
            if (InMemoryTask.is(task)) {
                return false;
            }
            if (!group) {
                group = task.command.presentation?.group;
            }
            return task.command.presentation?.group && (task.command.presentation.group === group);
        })) {
            this._taskSystem.revealTask(activeTasks[0]);
        }
        else {
            this._showQuickPick(activeTasksPromise, nls.localize('TaskService.pickShowTask', 'Select the task to show its output'), {
                label: nls.localize('TaskService.noTaskIsRunning', 'No task is running'),
                task: null
            }, false, true).then((entry) => {
                const task = entry ? entry.task : undefined;
                if (task === undefined || task === null) {
                    return;
                }
                this._taskSystem.revealTask(task);
            });
        }
    }
    async _createTasksDotOld(folder) {
        const tasksFile = folder.toResource('.vscode/tasks.json');
        if (await this._fileService.exists(tasksFile)) {
            const oldFile = tasksFile.with({ path: `${tasksFile.path}.old` });
            await this._fileService.copy(tasksFile, oldFile, true);
            return [oldFile, tasksFile];
        }
        return undefined;
    }
    _upgradeTask(task, suppressTaskName, globalConfig) {
        if (!CustomTask.is(task)) {
            return;
        }
        const configElement = {
            label: task._label
        };
        const oldTaskTypes = new Set(['gulp', 'jake', 'grunt']);
        if (Types.isString(task.command.name) && oldTaskTypes.has(task.command.name)) {
            configElement.type = task.command.name;
            configElement.task = task.command.args[0];
        }
        else {
            if (task.command.runtime === RuntimeType.Shell) {
                configElement.type = RuntimeType.toString(RuntimeType.Shell);
            }
            if (task.command.name && !suppressTaskName && !globalConfig.windows?.command && !globalConfig.osx?.command && !globalConfig.linux?.command) {
                configElement.command = task.command.name;
            }
            else if (suppressTaskName) {
                configElement.command = task._source.config.element.command;
            }
            if (task.command.args && (!Array.isArray(task.command.args) || (task.command.args.length > 0))) {
                if (!globalConfig.windows?.args && !globalConfig.osx?.args && !globalConfig.linux?.args) {
                    configElement.args = task.command.args;
                }
                else {
                    configElement.args = task._source.config.element.args;
                }
            }
        }
        if (task.configurationProperties.presentation) {
            configElement.presentation = task.configurationProperties.presentation;
        }
        if (task.configurationProperties.isBackground) {
            configElement.isBackground = task.configurationProperties.isBackground;
        }
        if (task.configurationProperties.problemMatchers) {
            configElement.problemMatcher = task._source.config.element.problemMatcher;
        }
        if (task.configurationProperties.group) {
            configElement.group = task.configurationProperties.group;
        }
        task._source.config.element = configElement;
        const tempTask = new CustomTask(task._id, task._source, task._label, task.type, task.command, task.hasDefinedMatchers, task.runOptions, task.configurationProperties);
        const configTask = this._createCustomizableTask(tempTask);
        if (configTask) {
            return configTask;
        }
        return;
    }
    async _upgrade() {
        if (this.schemaVersion === 2 /* JsonSchemaVersion.V2_0_0 */) {
            return;
        }
        if (!this._workspaceTrustManagementService.isWorkspaceTrusted()) {
            this._register(Event.once(this._workspaceTrustManagementService.onDidChangeTrust)(isTrusted => {
                if (isTrusted) {
                    this._upgrade();
                }
            }));
            return;
        }
        const tasks = await this._getGroupedTasks();
        const fileDiffs = [];
        for (const folder of this.workspaceFolders) {
            const diff = await this._createTasksDotOld(folder);
            if (diff) {
                fileDiffs.push(diff);
            }
            if (!diff) {
                continue;
            }
            const configTasks = [];
            const suppressTaskName = !!this._configurationService.getValue("tasks.suppressTaskName" /* TasksSchemaProperties.SuppressTaskName */, { resource: folder.uri });
            const globalConfig = {
                windows: this._configurationService.getValue("tasks.windows" /* TasksSchemaProperties.Windows */, { resource: folder.uri }),
                osx: this._configurationService.getValue("tasks.osx" /* TasksSchemaProperties.Osx */, { resource: folder.uri }),
                linux: this._configurationService.getValue("tasks.linux" /* TasksSchemaProperties.Linux */, { resource: folder.uri })
            };
            tasks.get(folder).forEach(task => {
                const configTask = this._upgradeTask(task, suppressTaskName, globalConfig);
                if (configTask) {
                    configTasks.push(configTask);
                }
            });
            this._taskSystem = undefined;
            this._workspaceTasksPromise = undefined;
            await this._writeConfiguration(folder, 'tasks.tasks', configTasks);
            await this._writeConfiguration(folder, 'tasks.version', '2.0.0');
            if (this._configurationService.getValue("tasks.showOutput" /* TasksSchemaProperties.ShowOutput */, { resource: folder.uri })) {
                await this._configurationService.updateValue("tasks.showOutput" /* TasksSchemaProperties.ShowOutput */, undefined, { resource: folder.uri });
            }
            if (this._configurationService.getValue("tasks.isShellCommand" /* TasksSchemaProperties.IsShellCommand */, { resource: folder.uri })) {
                await this._configurationService.updateValue("tasks.isShellCommand" /* TasksSchemaProperties.IsShellCommand */, undefined, { resource: folder.uri });
            }
            if (this._configurationService.getValue("tasks.suppressTaskName" /* TasksSchemaProperties.SuppressTaskName */, { resource: folder.uri })) {
                await this._configurationService.updateValue("tasks.suppressTaskName" /* TasksSchemaProperties.SuppressTaskName */, undefined, { resource: folder.uri });
            }
        }
        this._updateSetup();
        this._notificationService.prompt(Severity.Warning, fileDiffs.length === 1 ?
            nls.localize('taskService.upgradeVersion', "The deprecated tasks version 0.1.0 has been removed. Your tasks have been upgraded to version 2.0.0. Open the diff to review the upgrade.")
            : nls.localize('taskService.upgradeVersionPlural', "The deprecated tasks version 0.1.0 has been removed. Your tasks have been upgraded to version 2.0.0. Open the diffs to review the upgrade."), [{
                label: fileDiffs.length === 1 ? nls.localize('taskService.openDiff', "Open diff") : nls.localize('taskService.openDiffs', "Open diffs"),
                run: async () => {
                    for (const upgrade of fileDiffs) {
                        await this._editorService.openEditor({
                            original: { resource: upgrade[0] },
                            modified: { resource: upgrade[1] }
                        });
                    }
                }
            }]);
    }
};
AbstractTaskService = AbstractTaskService_1 = __decorate([
    __param(0, IConfigurationService),
    __param(1, IMarkerService),
    __param(2, IOutputService),
    __param(3, IPaneCompositePartService),
    __param(4, IViewsService),
    __param(5, ICommandService),
    __param(6, IEditorService),
    __param(7, IFileService),
    __param(8, IWorkspaceContextService),
    __param(9, ITelemetryService),
    __param(10, ITextFileService),
    __param(11, IModelService),
    __param(12, IExtensionService),
    __param(13, IQuickInputService),
    __param(14, IConfigurationResolverService),
    __param(15, ITerminalService),
    __param(16, ITerminalGroupService),
    __param(17, IStorageService),
    __param(18, IProgressService),
    __param(19, IOpenerService),
    __param(20, IDialogService),
    __param(21, INotificationService),
    __param(22, IContextKeyService),
    __param(23, IWorkbenchEnvironmentService),
    __param(24, ITerminalProfileResolverService),
    __param(25, IPathService),
    __param(26, ITextModelService),
    __param(27, IPreferencesService),
    __param(28, IViewDescriptorService),
    __param(29, IWorkspaceTrustRequestService),
    __param(30, IWorkspaceTrustManagementService),
    __param(31, ILogService),
    __param(32, IThemeService),
    __param(33, ILifecycleService),
    __param(34, IRemoteAgentService),
    __param(35, IInstantiationService),
    __param(36, IChatService),
    __param(37, IChatAgentService),
    __param(38, IHostService)
], AbstractTaskService);
export { AbstractTaskService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJzdHJhY3RUYXNrU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9icm93c2VyL2Fic3RyYWN0VGFza1NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUU1RCxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sS0FBSyxJQUFJLE1BQU0saUNBQWlDLENBQUM7QUFDeEQsT0FBTyxLQUFLLElBQUksTUFBTSxpQ0FBaUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQTJCLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDeEksT0FBTyxFQUFFLFFBQVEsRUFBUyxNQUFNLGdDQUFnQyxDQUFDO0FBQ2pFLE9BQU8sS0FBSyxPQUFPLE1BQU0sb0NBQW9DLENBQUM7QUFDOUQsT0FBTyxFQUFtQixnQkFBZ0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3ZGLE9BQU8sS0FBSyxRQUFRLE1BQU0scUNBQXFDLENBQUM7QUFFaEUsT0FBTyxLQUFLLFNBQVMsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLFFBQVEsTUFBTSxxQ0FBcUMsQ0FBQztBQUMzRCxPQUFPLEtBQUssS0FBSyxNQUFNLGtDQUFrQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEtBQUssSUFBSSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3hELE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFFLGdCQUFnQixFQUFFLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ3JHLE9BQU8sRUFBdUIscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUN4SCxPQUFPLEVBQUUsWUFBWSxFQUFnQyxNQUFNLDRDQUE0QyxDQUFDO0FBQ3hHLE9BQU8sRUFBZSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUM3RixPQUFPLEVBQW9CLGdCQUFnQixFQUFvQixNQUFNLGtEQUFrRCxDQUFDO0FBQ3hILE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sZ0RBQWdELENBQUM7QUFDOUcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDdkYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDdEYsT0FBTyxFQUF3QixzQkFBc0IsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBRTNGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNoRixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUNoRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFFOUUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRTVFLE9BQU8sRUFBYyx3QkFBd0IsRUFBb0MsZUFBZSxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDN0osT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0seUVBQXlFLENBQUM7QUFDeEgsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUUxRCxPQUFPLEVBQWtCLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQzNGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBRWxGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdGLE9BQU8sRUFBRSwrQkFBK0IsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRXBGLE9BQU8sRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFxSSxtQkFBbUIsRUFBRSw2QkFBNkIsRUFBRSxXQUFXLEVBQVEsa0JBQWtCLEVBQUUsY0FBYyxFQUFFLGFBQWEsRUFBRSxTQUFTLEVBQWdDLFVBQVUsRUFBRSxjQUFjLEVBQXlCLG9CQUFvQixFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDaGUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSwrQkFBK0IsRUFBNkgsZ0NBQWdDLEVBQUUsb0JBQW9CLEVBQUUsOEJBQThCLEVBQUUsc0JBQXNCLEVBQUUsNkJBQTZCLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUM1VyxPQUFPLEVBQXlHLFNBQVMsRUFBK0IsUUFBUSxFQUFFLFlBQVksRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ2hOLE9BQU8sRUFBRSxZQUFZLElBQUksZ0JBQWdCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUU5RSxPQUFPLEtBQUssVUFBVSxNQUFNLGdDQUFnQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBRTdELE9BQU8sRUFBRSxrQkFBa0IsRUFBdUQsTUFBTSxzREFBc0QsQ0FBQztBQUUvSSxPQUFPLEVBQWUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN2RyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUU3RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDL0QsT0FBTyxFQUFxQix1QkFBdUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakUsT0FBTyxFQUE0QixpQkFBaUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBRXBILE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUN0RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLDZCQUE2QixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDMUksT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDekUsT0FBTyxFQUFFLHNCQUFzQixFQUFjLE1BQU0sMkJBQTJCLENBQUM7QUFDL0UsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDbEUsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDMUcsT0FBTyxFQUFFLGlCQUFpQixFQUErQixNQUFNLGlEQUFpRCxDQUFDO0FBQ2pILE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUM1RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDL0UsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDaEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBdUIsdUJBQXVCLEVBQUUscUJBQXFCLEVBQUUsYUFBYSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUosT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3RFLE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFHdkQsTUFBTSw4QkFBOEIsR0FBRyx3QkFBd0IsQ0FBQztBQUNoRSxNQUFNLDRCQUE0QixHQUFHLGtDQUFrQyxDQUFDO0FBQ3hFLE1BQU0sZUFBZSxHQUFHLHdCQUF3QixDQUFDO0FBRWpELE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxDQUFDO0FBRWhDLE1BQU0sS0FBVyxtQkFBbUIsQ0FHbkM7QUFIRCxXQUFpQixtQkFBbUI7SUFDdEIsc0JBQUUsR0FBRyw0Q0FBNEMsQ0FBQztJQUNsRCx3QkFBSSxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUMsaUNBQWlDLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztBQUN4RixDQUFDLEVBSGdCLG1CQUFtQixLQUFuQixtQkFBbUIsUUFHbkM7QUFJRCxNQUFNLGVBQWU7SUFNcEIsWUFBb0IsY0FBOEI7UUFBOUIsbUJBQWMsR0FBZCxjQUFjLENBQWdCO1FBSGpDLGdCQUFXLEdBQW9CLElBQUksT0FBTyxFQUFVLENBQUM7UUFDdEQsZUFBVSxHQUFrQixJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQztRQUdsRSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxnQkFBZ0IsRUFBRSxDQUFDO0lBQ2pELENBQUM7SUFFTSxJQUFJLENBQUMsT0FBZTtRQUMxQixJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSywrQkFBdUIsQ0FBQztRQUNwRCxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVNLElBQUksQ0FBQyxPQUFlO1FBQzFCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLGtDQUEwQixDQUFDO1FBQ3ZELElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBRU0sS0FBSyxDQUFDLE9BQWU7UUFDM0IsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssZ0NBQXdCLENBQUM7UUFDckQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxDQUFDO1FBQzNDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2hDLENBQUM7SUFFTSxLQUFLLENBQUMsT0FBZTtRQUMzQixJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxnQ0FBd0IsQ0FBQztRQUNyRCxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLENBQUM7UUFDM0MsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUVELElBQVcsTUFBTTtRQUNoQixPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztJQUMvQixDQUFDO0NBQ0Q7QUFhRCxNQUFNLE9BQU87SUFBYjtRQUNTLFdBQU0sR0FBd0IsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQTBDakQsQ0FBQztJQXhDTyxPQUFPLENBQUMsUUFBaUQ7UUFDL0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVNLE1BQU0sQ0FBQyxNQUFNLENBQUMsZUFBdUQ7UUFDM0UsSUFBSSxHQUF1QixDQUFDO1FBQzVCLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDO1lBQ3JDLEdBQUcsR0FBRyxlQUFlLENBQUM7UUFDdkIsQ0FBQzthQUFNLENBQUM7WUFDUCxNQUFNLEdBQUcsR0FBMkIsaUJBQWlCLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUM7WUFDN0gsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDakMsQ0FBQztRQUNELE9BQU8sR0FBRyxDQUFDO0lBQ1osQ0FBQztJQUVNLEdBQUcsQ0FBQyxlQUF1RDtRQUNqRSxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQzVDLElBQUksTUFBTSxHQUF1QixJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN0RCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDYixNQUFNLEdBQUcsRUFBRSxDQUFDO1lBQ1osSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzlCLENBQUM7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFFTSxHQUFHLENBQUMsZUFBdUQsRUFBRSxHQUFHLElBQVk7UUFDbEYsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUM1QyxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNsQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDYixNQUFNLEdBQUcsRUFBRSxDQUFDO1lBQ1osSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzlCLENBQUM7UUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7SUFDdEIsQ0FBQztJQUVNLEdBQUc7UUFDVCxNQUFNLE1BQU0sR0FBVyxFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ3hELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztDQUNEO0FBRU0sSUFBZSxtQkFBbUIsR0FBbEMsTUFBZSxtQkFBb0IsU0FBUSxVQUFVOztJQUUzRCw0RUFBNEU7YUFDcEQsMEJBQXFCLEdBQUcsbUNBQW1DLEFBQXRDLENBQXVDO2FBQzVELDRCQUF1QixHQUFHLG9DQUFvQyxBQUF2QyxDQUF3QzthQUMvRCx3QkFBbUIsR0FBRyxpQ0FBaUMsQUFBcEMsQ0FBcUM7YUFDeEQsb0NBQStCLEdBQUcsb0NBQW9DLEFBQXZDLENBQXdDO2FBR2pGLG9CQUFlLEdBQVcsT0FBTyxBQUFsQixDQUFtQjthQUNsQyx1QkFBa0IsR0FBVyxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQUFBekMsQ0FBMEM7YUFFM0QsZ0JBQVcsR0FBVyxDQUFDLEFBQVosQ0FBYTtJQXNDdkMsSUFBVyxhQUFhLEtBQWMsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO0lBVXRFLFlBQ3dCLHFCQUE2RCxFQUNwRSxjQUFpRCxFQUNqRCxjQUFpRCxFQUN0QyxxQkFBaUUsRUFDN0UsYUFBNkMsRUFDM0MsZUFBaUQsRUFDbEQsY0FBK0MsRUFDakQsWUFBNkMsRUFDakMsZUFBNEQsRUFDbkUsaUJBQXVELEVBQ3hELGdCQUFtRCxFQUN0RCxhQUErQyxFQUMzQyxpQkFBcUQsRUFDcEQsa0JBQXVELEVBQzVDLDZCQUErRSxFQUM1RixnQkFBbUQsRUFDOUMscUJBQTZELEVBQ25FLGVBQWlELEVBQ2hELGdCQUFtRCxFQUNyRCxjQUErQyxFQUMvQyxjQUFpRCxFQUMzQyxvQkFBMkQsRUFDN0Qsa0JBQXlELEVBQy9DLG1CQUFrRSxFQUMvRCwrQkFBaUYsRUFDcEcsWUFBMkMsRUFDdEMseUJBQTZELEVBQzNELG1CQUF5RCxFQUN0RCxzQkFBK0QsRUFDeEQsNkJBQTZFLEVBQzFFLGdDQUFtRixFQUN4RyxXQUF5QyxFQUN2QyxhQUE2QyxFQUN6QyxpQkFBcUQsRUFDbkQsa0JBQXVDLEVBQ3JDLHFCQUE2RCxFQUN0RSxZQUEyQyxFQUN0QyxpQkFBcUQsRUFDMUQsWUFBMkM7UUFFekQsS0FBSyxFQUFFLENBQUM7UUF4Q2dDLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBdUI7UUFDakQsbUJBQWMsR0FBZCxjQUFjLENBQWdCO1FBQzlCLG1CQUFjLEdBQWQsY0FBYyxDQUFnQjtRQUNyQiwwQkFBcUIsR0FBckIscUJBQXFCLENBQTJCO1FBQzVELGtCQUFhLEdBQWIsYUFBYSxDQUFlO1FBQzFCLG9CQUFlLEdBQWYsZUFBZSxDQUFpQjtRQUNqQyxtQkFBYyxHQUFkLGNBQWMsQ0FBZ0I7UUFDOUIsaUJBQVksR0FBWixZQUFZLENBQWM7UUFDZCxvQkFBZSxHQUFmLGVBQWUsQ0FBMEI7UUFDaEQsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFtQjtRQUN2QyxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQWtCO1FBQ25DLGtCQUFhLEdBQWIsYUFBYSxDQUFlO1FBQzFCLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBbUI7UUFDbkMsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFvQjtRQUN6QixrQ0FBNkIsR0FBN0IsNkJBQTZCLENBQStCO1FBQzNFLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBa0I7UUFDN0IsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtRQUNsRCxvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUFDL0IscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFrQjtRQUNwQyxtQkFBYyxHQUFkLGNBQWMsQ0FBZ0I7UUFDNUIsbUJBQWMsR0FBZCxjQUFjLENBQWdCO1FBQzFCLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBc0I7UUFDMUMsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFvQjtRQUM5Qix3QkFBbUIsR0FBbkIsbUJBQW1CLENBQThCO1FBQzlDLG9DQUErQixHQUEvQiwrQkFBK0IsQ0FBaUM7UUFDbkYsaUJBQVksR0FBWixZQUFZLENBQWM7UUFDckIsOEJBQXlCLEdBQXpCLHlCQUF5QixDQUFtQjtRQUMxQyx3QkFBbUIsR0FBbkIsbUJBQW1CLENBQXFCO1FBQ3JDLDJCQUFzQixHQUF0QixzQkFBc0IsQ0FBd0I7UUFDdkMsa0NBQTZCLEdBQTdCLDZCQUE2QixDQUErQjtRQUN6RCxxQ0FBZ0MsR0FBaEMsZ0NBQWdDLENBQWtDO1FBQ3ZGLGdCQUFXLEdBQVgsV0FBVyxDQUFhO1FBQ3RCLGtCQUFhLEdBQWIsYUFBYSxDQUFlO1FBQ3hCLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBbUI7UUFFaEMsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtRQUNyRCxpQkFBWSxHQUFaLFlBQVksQ0FBYztRQUNyQixzQkFBaUIsR0FBakIsaUJBQWlCLENBQW1CO1FBQ3pDLGlCQUFZLEdBQVosWUFBWSxDQUFjO1FBckZsRCxzQkFBaUIsR0FBWSxLQUFLLENBQUM7UUFlakMseUJBQW9CLEdBQW1CLEVBQUUsQ0FBQztRQVk1QyxzQ0FBaUMsR0FBa0IsSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUNqRSx5Q0FBb0MsR0FBa0IsSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUNwRSwrQkFBMEIsR0FBa0IsSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUMxRCxpQkFBWSxHQUFZLEtBQUssQ0FBQztRQUMvQiw4QkFBeUIsR0FBZ0IsSUFBSSxDQUFDLDBCQUEwQixDQUFDLEtBQUssQ0FBQztRQUM5RSwyQkFBc0IsR0FBa0IsSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUN2RCwwQkFBcUIsR0FBZ0IsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQztRQUN0RSwyQkFBc0IsR0FBa0IsSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUN2RCwwQkFBcUIsR0FBZ0IsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQztRQUV0RSw4QkFBeUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUNqRSw2QkFBd0IsR0FBRyxJQUFJLENBQUMseUJBQXlCLENBQUMsS0FBSyxDQUFDO1FBQ3RELHVCQUFrQixHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1FBQy9DLG9CQUFlLEdBQUcsSUFBSSxHQUFHLEVBQXlCLENBQUM7UUFFNUQsNEJBQXVCLEdBQWdCLElBQUksR0FBRyxFQUFFLENBQUM7UUFFeEMsaUJBQVksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksaUJBQWlCLEVBQW1CLENBQUMsQ0FBQztRQTRDeEYsSUFBSSxDQUFDLG9CQUFvQixHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFDNUUsSUFBSSxDQUFDLHNCQUFzQixHQUFHLFNBQVMsQ0FBQztRQUN4QyxJQUFJLENBQUMsV0FBVyxHQUFHLFNBQVMsQ0FBQztRQUM3QixJQUFJLENBQUMsb0JBQW9CLEdBQUcsU0FBUyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMscUJBQW1CLENBQUMsZUFBZSxDQUFFLENBQUM7UUFDM0YsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBeUIsQ0FBQztRQUNuRCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1FBQ2hELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLEdBQUcsRUFBNkIsQ0FBQztRQUM3RCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsMkJBQTJCLENBQUMsR0FBRyxFQUFFO1lBQ3BFLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyw0QkFBNEIsRUFBRSxDQUFDO1lBQ3hELElBQUksSUFBSSxDQUFDLGVBQWUsS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDN0MsSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUM7Z0JBQ25DLElBQUksQ0FBQyxXQUFXLEdBQUcsU0FBUyxDQUFDO1lBQzlCLENBQUM7WUFDRCxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQy9CLE9BQU8sSUFBSSxDQUFDLHFCQUFxQixrQ0FBMEIsQ0FBQztRQUM3RCxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0osSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsd0JBQXdCLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzlFLElBQUksQ0FBQyxDQUFDLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsRUFBRSxDQUFDO2dCQUM3RixPQUFPO1lBQ1IsQ0FBQztZQUVELElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQyxXQUFXLFlBQVksa0JBQWtCLEVBQUUsQ0FBQztnQkFDekUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUM3QixDQUFDO1lBRUQsSUFBSSxDQUFDLENBQUMsb0JBQW9CLHNEQUE0QixFQUFFLENBQUM7Z0JBQ3hELElBQUksQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxzREFBNEIsRUFBRSxDQUFDO29CQUN0RSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLENBQUM7b0JBQy9CLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLHFCQUFtQixDQUFDLG1CQUFtQixpQ0FBeUIsQ0FBQztnQkFDOUYsQ0FBQztZQUNGLENBQUM7WUFFRCxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUM3QixNQUFNLHNCQUFzQixHQUE0QyxNQUFNLElBQUksQ0FBQyxxQkFBcUIsMkNBQW1DLENBQUM7WUFDNUksSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksRUFBRSxDQUFDO1lBRW5DLDhDQUE4QztZQUM5QyxLQUFLLE1BQU0sQ0FBQyxTQUFTLEVBQUUsWUFBWSxDQUFDLElBQUksc0JBQXNCLEVBQUUsQ0FBQztnQkFDaEUsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxDQUFDO29CQUN0QyxTQUFTO2dCQUNWLENBQUM7Z0JBRUQsS0FBSyxNQUFNLElBQUksSUFBSSxZQUFZLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUMzQyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO29CQUM5QixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDO29CQUV0RCxJQUFJLFFBQVEsSUFBSSxRQUFRLEtBQUssWUFBWSxJQUFJLFNBQVMsS0FBSyxTQUFTLEVBQUUsQ0FBQzt3QkFDdEUsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLFlBQVksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFdBQVksQ0FBQyxRQUFTLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQzt3QkFDeEcsSUFBSSxDQUFDLFdBQVksQ0FBQyxRQUFRLEdBQUcsZ0JBQWdCLENBQUM7b0JBQy9DLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7UUFFRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0osSUFBSSxDQUFDLGlCQUFpQixHQUFHLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3ZFLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUM3RSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDdkQsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLHNCQUFzQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN0RyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxhQUFhLEVBQUUsRUFBRSxlQUFlLENBQUMsQ0FBQztRQUNqSSxJQUFJLENBQUMsNkJBQTZCLENBQUMsa0JBQWtCLENBQUMsa0JBQWtCLEVBQUUsS0FBSyxJQUFpQyxFQUFFO1lBQ2pILDhGQUE4RjtZQUM5RixJQUFJLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2hFLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDdEIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUM5QyxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQzNCLE9BQU8sUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztnQkFDM0IsQ0FBQztZQUNGLENBQUM7WUFDRCx5RkFBeUY7WUFDekYsS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN0RCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDOUMsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUMzQixPQUFPLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7WUFDM0IsQ0FBQztpQkFBTSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDNUIsS0FBSyxHQUFHLFFBQVEsQ0FBQztZQUNsQixDQUFDO1lBRUQsSUFBSSxLQUE2QyxDQUFDO1lBQ2xELElBQUksS0FBSyxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQy9CLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsbUNBQW1DLEVBQUUsZ0VBQWdFLENBQUMsQ0FBQyxDQUFDO1lBQy9KLENBQUM7WUFFRCxNQUFNLElBQUksR0FBNEIsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDckUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNYLE9BQU8sU0FBUyxDQUFDO1lBQ2xCLENBQUM7WUFDRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDcEIsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUMxRCxJQUFJLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQyxNQUFNLGtDQUEwQixDQUFDO1FBQ3hELENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDSixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUMsQ0FBQyxFQUFDLEVBQUU7WUFDOUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxzQkFBc0IsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDM0UsUUFBUSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ2hCLEtBQUssYUFBYSxDQUFDLEtBQUs7b0JBQ3ZCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztvQkFDbEQsTUFBTTtnQkFDUCxLQUFLLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO29CQUNqQyxNQUFNLGlCQUFpQixHQUFHLENBQTJCLENBQUM7b0JBQ3RELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUN4RCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7d0JBQ2hCLE1BQU07b0JBQ1AsQ0FBQztvQkFDRCxNQUFNLFVBQVUsR0FBRyxpQkFBaUIsQ0FBQyxVQUFVLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsU0FBUyxDQUFDLENBQUM7b0JBQzVFLElBQUksVUFBVSxLQUFLLFNBQVMsRUFBRSxDQUFDO3dCQUM5QixJQUFJLENBQUMsZ0NBQWdDLENBQUMsaUJBQWlCLEVBQUUsVUFBVSxDQUFDLENBQUM7b0JBQ3RFLENBQUM7b0JBQ0QsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ3pDLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDdEMsTUFBTTtnQkFDUCxDQUFDO2dCQUNELEtBQUssYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7b0JBQzdCLE1BQU0saUJBQWlCLEdBQUcsQ0FBdUIsQ0FBQztvQkFDbEQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ3hELElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQzt3QkFDaEIsTUFBTTtvQkFDUCxDQUFDO29CQUNELE1BQU0sVUFBVSxHQUFHLGlCQUFpQixDQUFDLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxTQUFTLENBQUMsQ0FBQztvQkFDNUUsSUFBSSxVQUFVLEtBQUssU0FBUyxFQUFFLENBQUM7d0JBQzlCLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxpQkFBaUIsRUFBRSxVQUFVLENBQUMsQ0FBQztvQkFDdEUsQ0FBQztvQkFDRCxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDekMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUN0QyxNQUFNO2dCQUNQLENBQUM7Z0JBQ0QsS0FBSyxhQUFhLENBQUMsVUFBVTtvQkFDNUIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ3pDLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDdEMsTUFBTTtZQUNSLENBQUM7WUFDRCxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssYUFBYSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUN0QyxRQUFRO1lBQ1QsQ0FBQztpQkFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssYUFBYSxDQUFDLFVBQVUsSUFBSSxDQUFDLENBQUMsVUFBVSxLQUFLLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUNqSSxNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUM5QixJQUFJLEdBQUcsRUFBRSxDQUFDO29CQUNULElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDaEMsQ0FBQztZQUNGLENBQUM7aUJBQU0sSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLGFBQWEsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLGtCQUFrQixFQUFFLEVBQUUsQ0FBQztnQkFDeEYsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNuQyxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNKLElBQUksQ0FBQyw4QkFBOEIsR0FBRyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUMzRCxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxvQ0FBb0MsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQzlFLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO1lBQzdDLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsc0JBQXNCLEVBQUUsT0FBTyxLQUFLLGdCQUFnQixDQUFDLENBQUM7WUFDakksSUFBSSxvQkFBb0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDakMsSUFBSSxDQUFDLHdCQUF3QixFQUFFLENBQUM7WUFDakMsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUM7Z0JBQzlCLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNwQyxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDakIsQ0FBQztJQUVNLDJCQUEyQixDQUFDLE1BQWdCLEVBQUUsS0FBZSxFQUFFLE9BQWlCO1FBQ3RGLElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzFCLE1BQU0sYUFBYSxHQUFHLCtCQUErQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztZQUN0RixhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzNCLENBQUM7UUFDRCxNQUFNLFNBQVMsR0FBRyxDQUFDLENBQUMsdUJBQXVCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQzlFLElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ3pCLE1BQU0sWUFBWSxHQUFHLDhCQUE4QixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztZQUNwRixZQUFZLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3ZDLENBQUM7UUFDRCxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUMzQixNQUFNLGNBQWMsR0FBRyxnQ0FBZ0MsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7WUFDeEYsY0FBYyxDQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMzQyxDQUFDO1FBQ0QscUZBQXFGO1FBQ3JGLElBQUksQ0FBQyxzQkFBc0IsR0FBRyxTQUFTLENBQUM7UUFDeEMsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQzlDLElBQUksb0JBQW9CLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLEtBQUssSUFBSSxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQzVGLElBQUksQ0FBQyxvQ0FBb0MsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNsRCxDQUFDO0lBQ0YsQ0FBQztJQUVPLHdCQUF3QjtRQUMvQixJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLHVDQUErQixFQUFFLENBQUM7WUFDdkUsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLGtDQUFrQyxFQUFFLGlGQUFpRixDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDckosSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQztZQUM5QixJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxxQkFBbUIsQ0FBQyxtQkFBbUIsaUNBQXlCLENBQUM7UUFDOUYsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxzREFBNEIsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUNoRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsMkJBQTJCLEVBQUUsa0ZBQWtGLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsc0RBQTRCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDeE8sSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQztZQUM5QixPQUFPO1FBQ1IsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQywwQkFBMEIsRUFBRSxrQ0FBa0MsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzlGLElBQUksQ0FBQyxpQkFBaUIsaUNBQXlCLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxFQUFFO1lBQy9ELElBQUksQ0FBQyxpQkFBaUIsR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUN0RCxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMseUJBQXlCLEVBQUUsK0JBQStCLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUMxRixJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDcEMsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU8sS0FBSyxDQUFDLGdDQUFnQyxDQUFDLEtBQWtELEVBQUUsVUFBa0I7UUFDcEgsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxzRkFBb0QsQ0FBQztRQUN0SCxpREFBaUQ7UUFDakQscUVBQXFFO1FBQ3JFLGtFQUFrRTtRQUNsRSxJQUFJLHFCQUFxQixLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMscUJBQXFCLEdBQUcsQ0FBQyxJQUFJLFVBQVUsR0FBRyxxQkFBcUIsQ0FBQyxFQUFFLENBQUM7WUFDdkcsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDN0QsSUFBSSxhQUFhLG9DQUE0QixFQUFFLENBQUM7WUFDL0MsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLEtBQUssS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3JHLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUN0QixPQUFPO1FBQ1IsQ0FBQztRQUNELE1BQU0sU0FBUyxHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUM7UUFDeEMsTUFBTSxZQUFZLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDL0QsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUM7WUFDdEMsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDMUQsTUFBTSxPQUFPLEdBQUcsU0FBUztZQUN4QixDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyx3Q0FBd0MsRUFBRSw2QkFBNkIsRUFBRSxTQUFTLEVBQUUsWUFBWSxDQUFDO1lBQ2hILENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLCtCQUErQixFQUFFLHVCQUF1QixFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ3hGLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSxFQUFFLElBQUksMEJBQWtCLEVBQUUsQ0FBQyxDQUFDO1FBQ2xFLE1BQU0sWUFBWSxHQUFHLE1BQU0sR0FBRyxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzVELElBQUksWUFBWSxFQUFFLENBQUM7WUFDbEIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztZQUNwRSxXQUFXLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBRTlCLFdBQVcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFO2dCQUNyRCxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQUUsRUFBRSxJQUFJLHlCQUFpQixFQUFFLENBQUMsQ0FBQztZQUNsRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRUosV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUMxRCxJQUFJLEtBQUssRUFBRSxDQUFDO29CQUNYLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDdkIsQ0FBQztZQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0lBQ0YsQ0FBQztJQUVPLG1CQUFtQixDQUFDLFVBQWtCO1FBQzdDLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDaEUsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDOUMsTUFBTSxPQUFPLEdBQUcsWUFBWSxHQUFHLEVBQUUsQ0FBQztRQUNsQyxJQUFJLE9BQU8sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNqQixPQUFPLE9BQU8sR0FBRyxDQUFDO2dCQUNqQixDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyw0Q0FBNEMsRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQztnQkFDM0YsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMscUNBQXFDLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3pFLENBQUM7UUFDRCxPQUFPLEdBQUcsQ0FBQyxRQUFRLENBQUMscUNBQXFDLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzdFLENBQUM7SUFFTyxLQUFLLENBQUMsZUFBZTtRQUM1QixNQUFNLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDckQsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNuQixJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMscUJBQXFCLEVBQUUsbUNBQW1DLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUMxRixPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFDRCxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3RCxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsK0JBQStCLEVBQUUsOEJBQThCLEVBQUUsVUFBVSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDM0csS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUMxQixJQUFJLGVBQWUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDOUIsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNqRCxJQUFJLFFBQVEsRUFBRSxDQUFDO29CQUNkLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLFNBQVMsa0NBQTBCLENBQUM7Z0JBQ3hELENBQUM7WUFDRixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsU0FBUyxrQ0FBMEIsQ0FBQztZQUNwRCxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVELElBQVcsZ0JBQWdCO1FBQzFCLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQztJQUNyQyxDQUFDO0lBRUQsSUFBVyw4QkFBOEI7UUFDeEMsT0FBTyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDMUIsQ0FBQztJQUVPLEtBQUssQ0FBQyxpQkFBaUI7UUFDOUIsZ0JBQWdCLENBQUMsZUFBZSxDQUFDO1lBQ2hDLEVBQUUsRUFBRSxnQ0FBZ0M7WUFDcEMsT0FBTyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsR0FBOEIsRUFBRSxFQUFFO2dCQUMzRCxJQUFJLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUM7b0JBQ3pCLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDakMsQ0FBQztZQUNGLENBQUM7WUFDRCxRQUFRLEVBQUU7Z0JBQ1QsV0FBVyxFQUFFLFVBQVU7Z0JBQ3ZCLElBQUksRUFBRSxDQUFDO3dCQUNOLElBQUksRUFBRSxNQUFNO3dCQUNaLFVBQVUsRUFBRSxJQUFJO3dCQUNoQixXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsMENBQTBDLENBQUM7d0JBQ3BGLE1BQU0sRUFBRTs0QkFDUCxLQUFLLEVBQUU7Z0NBQ047b0NBQ0MsSUFBSSxFQUFFLFFBQVE7b0NBQ2QsV0FBVyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsZUFBZSxFQUFFLHlDQUF5QyxDQUFDO2lDQUNyRjtnQ0FDRDtvQ0FDQyxJQUFJLEVBQUUsUUFBUTtvQ0FDZCxVQUFVLEVBQUU7d0NBQ1gsSUFBSSxFQUFFOzRDQUNMLElBQUksRUFBRSxRQUFROzRDQUNkLFdBQVcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRSwyQkFBMkIsQ0FBQzt5Q0FDdEU7d0NBQ0QsSUFBSSxFQUFFOzRDQUNMLElBQUksRUFBRSxRQUFROzRDQUNkLFdBQVcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRSx5Q0FBeUMsQ0FBQzt5Q0FDcEY7cUNBQ0Q7aUNBQ0Q7NkJBQ0Q7eUJBQ0Q7cUJBQ0QsQ0FBQzthQUNGO1NBQ0QsQ0FBQyxDQUFDO1FBRUgsZ0JBQWdCLENBQUMsZUFBZSxDQUFDLGtDQUFrQyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsRUFBRTtZQUN2RixJQUFJLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUM7Z0JBQ3pCLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQzFCLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztRQUVILGdCQUFnQixDQUFDLGVBQWUsQ0FBQyxvQ0FBb0MsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLEdBQThCLEVBQUUsRUFBRTtZQUN6SCxJQUFJLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUM7Z0JBQ3pCLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNsQyxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFFSCxnQkFBZ0IsQ0FBQyxlQUFlLENBQUMsNkJBQTZCLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxFQUFFO1lBQ2xGLElBQUksTUFBTSxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztnQkFDekIsSUFBSSxDQUFDLCtCQUErQixFQUFFLENBQUM7WUFDeEMsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsZ0JBQWdCLENBQUMsZUFBZSxDQUFDLGtDQUFrQyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsR0FBOEIsRUFBRSxFQUFFO1lBQ3ZILElBQUksTUFBTSxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztnQkFDekIsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2hDLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztRQUNILGdCQUFnQixDQUFDLGVBQWUsQ0FBQyxnQ0FBZ0MsRUFBRSxHQUFHLEVBQUU7WUFDdkUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbkMsQ0FBQyxDQUFDLENBQUM7UUFFSCxnQkFBZ0IsQ0FBQyxlQUFlLENBQUMsOEJBQThCLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDM0UsSUFBSSxNQUFNLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDO2dCQUN6QixJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUN6QixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFFSCxnQkFBZ0IsQ0FBQyxlQUFlLENBQUMsNkJBQTZCLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDMUUsSUFBSSxNQUFNLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDO2dCQUN6QixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDeEIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsZ0JBQWdCLENBQUMsZUFBZSxDQUFDLDRDQUE0QyxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ3pGLElBQUksTUFBTSxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztnQkFDekIsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDM0IsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsZ0JBQWdCLENBQUMsZUFBZSxDQUFDLGtEQUFrRCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQy9GLElBQUksTUFBTSxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztnQkFDekIsSUFBSSxDQUFDLDZCQUE2QixFQUFFLENBQUM7WUFDdEMsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsZ0JBQWdCLENBQUMsZUFBZSxDQUFDLGlEQUFpRCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzlGLElBQUksTUFBTSxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztnQkFDekIsSUFBSSxDQUFDLDRCQUE0QixFQUFFLENBQUM7WUFDckMsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsZ0JBQWdCLENBQUMsZUFBZSxDQUFDLGtDQUFrQyxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQy9FLElBQUksTUFBTSxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztnQkFDekIsT0FBTyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDNUIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsZ0JBQWdCLENBQUMsZUFBZSxDQUFDLHVDQUF1QyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLENBQUM7UUFFNUosZ0JBQWdCLENBQUMsZUFBZSxDQUFDLHNDQUFzQyxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ25GLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDL0QsSUFBSSxRQUFRLEVBQUUsQ0FBQztnQkFDZCxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBRSxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbkQsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsZ0JBQWdCLENBQUMsZUFBZSxDQUFDLCtDQUErQyxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzVGLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDeEUsSUFBSSxRQUFRLEVBQUUsQ0FBQztnQkFDZCxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBRSxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDNUQsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELElBQVksZ0JBQWdCO1FBQzNCLElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUM3QixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDckIsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLGlCQUFrQixDQUFDO0lBQ2hDLENBQUM7SUFFRCxJQUFZLHVCQUF1QjtRQUNsQyxJQUFJLENBQUMsSUFBSSxDQUFDLHdCQUF3QixFQUFFLENBQUM7WUFDcEMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3JCLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyx3QkFBeUIsQ0FBQztJQUN2QyxDQUFDO0lBRUQsSUFBYyxlQUFlO1FBQzVCLElBQUksSUFBSSxDQUFDLGdCQUFnQixLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ3pDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNyQixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsZ0JBQWlCLENBQUM7SUFDL0IsQ0FBQztJQUVELElBQVksYUFBYTtRQUN4QixJQUFJLElBQUksQ0FBQyxjQUFjLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDdkMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3JCLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxjQUFlLENBQUM7SUFDN0IsQ0FBQztJQUVELElBQVksaUJBQWlCO1FBQzVCLElBQUksSUFBSSxDQUFDLGtCQUFrQixLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzNDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLHFCQUFtQixDQUFDLCtCQUErQixrQ0FBMEIsS0FBSyxDQUFDLENBQUM7UUFDaEosQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDO0lBQ2hDLENBQUM7SUFFTyxvQkFBb0IsQ0FBQyxJQUF3QjtRQUNwRCxNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7UUFDNUIsTUFBTSxDQUFDLElBQUksQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO1FBQ3hELElBQUksSUFBSSxFQUFFLENBQUM7WUFDVixzREFBc0Q7WUFDdEQsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLElBQUksRUFBRSxDQUFDLENBQUM7UUFDbkMsQ0FBQzthQUFNLENBQUM7WUFDUCw0Q0FBNEM7WUFDNUMsS0FBSyxNQUFNLFVBQVUsSUFBSSxzQkFBc0IsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDO2dCQUN2RCxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDbEQsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFFTyxLQUFLLENBQUMsc0JBQXNCLENBQUMsSUFBd0I7UUFDNUQsOEVBQThFO1FBQzlFLDZEQUE2RDtRQUM3RCxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxpQ0FBaUMsRUFBRSxDQUFDO1FBQ2pFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLENBQUM7UUFDNUUsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7WUFDMUIsSUFBSSxDQUFDLElBQUksQ0FBQyw0QkFBNEIsR0FBRyxDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQzNELENBQUM7UUFDRCxNQUFNLE1BQU0sR0FBRyxNQUFNLFdBQVcsQ0FDL0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQzVILElBQUksRUFDSixHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxvREFBb0QsQ0FBQyxDQUNqRixDQUFDO1FBQ0YsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUNaLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxDQUFDO1FBQ2pELENBQUM7SUFDRixDQUFDO0lBRU8sWUFBWSxDQUFDLEtBQTRHO1FBQ2hJLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNaLEtBQUssR0FBRyxJQUFJLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztRQUM3QyxDQUFDO1FBQ0QsSUFBSSxDQUFDLGlCQUFpQixHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsQyxJQUFJLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1lBQ25DLElBQUksSUFBSSxDQUFDLHdCQUF3QixDQUFDLE1BQU0sS0FBSyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQzlELElBQUksQ0FBQyxrQkFBa0IsR0FBRyxTQUFTLENBQUM7WUFDckMsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sR0FBRyxHQUFnQixJQUFJLEdBQUcsRUFBRSxDQUFDO2dCQUNuQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDaEYsS0FBSyxNQUFNLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDL0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxFQUFFLENBQUM7d0JBQ3JDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxTQUFTLENBQUM7d0JBQ3BDLE1BQU07b0JBQ1AsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFDRCxJQUFJLENBQUMsd0JBQXdCLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3pDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakMsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0IsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQUVTLFdBQVcsQ0FBQyxzQ0FBNkMsRUFBRSxhQUF1QixFQUFFLFlBQXFCO1FBQ2xILElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsK0JBQXVCLENBQUMsSUFBSSxDQUFDLFNBQVMsOENBQXNDLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDN0osSUFBSSxhQUFhLEVBQUUsQ0FBQztnQkFDbkIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDL0QsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN4RSxNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUM7Z0JBQ25CLElBQUksV0FBVyxJQUFJLFlBQVksRUFBRSxDQUFDO29CQUNqQyxNQUFNLGVBQWUsR0FBRyxxQkFBcUIsQ0FBQztvQkFDOUMsTUFBTSxPQUFPLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztvQkFDcEQsSUFBSSxPQUFPLElBQUksT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQzt3QkFDbkMsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUMzQixNQUFNLGFBQWEsR0FBRyxPQUFPLEtBQUssWUFBWTs0QkFDN0MsQ0FBQyxDQUFDLEtBQUssT0FBTyxJQUFJOzRCQUNsQixDQUFDLENBQUMsS0FBSyxPQUFPLGlCQUFpQixZQUFZLFFBQVEsQ0FBQzt3QkFHckQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQzt3QkFDcEYsSUFBSSxZQUFZLEVBQUUsQ0FBQzs0QkFDbEIsT0FBTyxDQUFDLElBQUksQ0FBQztnQ0FDWixLQUFLLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSxhQUFhLENBQUM7Z0NBQzFELEdBQUcsRUFBRSxLQUFLLElBQUksRUFBRTtvQ0FDZixJQUFJLENBQUMsZUFBZSxDQUFDLGNBQWMsQ0FBQyxtQkFBbUIsRUFBRTt3Q0FDeEQsSUFBSSxFQUFFLFlBQVksQ0FBQyxLQUFLO3dDQUN4QixLQUFLLEVBQUUsc0NBQXNDLGFBQWEsRUFBRTtxQ0FDNUQsQ0FBQyxDQUFDO2dDQUNKLENBQUM7NkJBQ0QsQ0FBQyxDQUFDO3dCQUNKLENBQUM7b0JBQ0YsQ0FBQztnQkFDRixDQUFDO2dCQUNELE9BQU8sQ0FBQyxJQUFJLENBQUM7b0JBQ1osS0FBSyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQztvQkFDaEQsR0FBRyxFQUFFLEdBQUcsRUFBRTt3QkFDVCxJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDL0QsQ0FBQztpQkFDRCxDQUFDLENBQUM7Z0JBQ0gsSUFBSSxXQUFXLElBQUksT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztvQkFDdkMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsNkJBQTZCLEVBQUUsNkVBQTZFLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDekwsQ0FBQztxQkFBTSxDQUFDO29CQUNQLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLHlCQUF5QixFQUFFLG9EQUFvRCxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQzVKLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFUywyQkFBMkI7UUFDcEMsSUFBSSxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztZQUMvQixPQUFPLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7WUFDbkMsSUFBSSxDQUFDLG9CQUFvQixHQUFHLFNBQVMsQ0FBQztRQUN2QyxDQUFDO0lBQ0YsQ0FBQztJQUVNLG9CQUFvQixDQUFDLFFBQXVCLEVBQUUsSUFBWTtRQUNoRSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDZixPQUFPO2dCQUNOLE9BQU8sRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO2FBQ2xCLENBQUM7UUFDSCxDQUFDO1FBQ0QsTUFBTSxNQUFNLEdBQUcscUJBQW1CLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDakQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN0QyxJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDdEMsT0FBTztZQUNOLE9BQU8sRUFBRSxHQUFHLEVBQUU7Z0JBQ2IsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQy9CLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNuQyxJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDdkMsQ0FBQztTQUNELENBQUM7SUFDSCxDQUFDO0lBRUQsSUFBSSxpQkFBaUI7UUFDcEIsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFDNUUsdUVBQXVFO1FBQ3ZFLCtCQUErQjtRQUMvQixJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUM5QyxPQUFPLFVBQVUsR0FBRyxDQUFDLENBQUM7UUFDdkIsQ0FBQztRQUNELE9BQU8sVUFBVSxHQUFHLENBQUMsQ0FBQztJQUN2QixDQUFDO0lBRU0sa0JBQWtCLENBQUMsR0FBVyxFQUFFLElBQXFCO1FBQzNELGtGQUFrRjtRQUNsRiw2SEFBNkg7UUFDN0gsSUFBSSxJQUFJLENBQUMsUUFBUSxrQ0FBMEIsRUFBRSxDQUFDO1lBQzdDLEdBQUcsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO1FBQ2hGLENBQUM7UUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3JDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN4QyxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFFLENBQUM7WUFDOUMsSUFBSSxJQUFJLENBQUMsUUFBUSxrQ0FBMEIsRUFBRSxDQUFDO2dCQUM3QyxtQ0FBbUM7Z0JBQ25DLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbEIsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDckIsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQzVCLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUN4QyxDQUFDO0lBQ0YsQ0FBQztJQUVPLGtCQUFrQixDQUFDLEdBQVc7UUFDckMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM3QyxPQUFPLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDdkQsQ0FBQztJQUVNLDZCQUE2QixDQUFDLElBQVUsRUFBRSxNQUFjO1FBQzlELElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDdkIsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDMUIsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDL0QsQ0FBQztJQUVEOztPQUVHO0lBQ0ssS0FBSyxDQUFDLG1CQUFtQixDQUFDLFNBQXVGO1FBQ3hILE1BQU0sTUFBTSxHQUErQixFQUFFLENBQUM7UUFFOUMsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUM3QyxLQUFLLE1BQU0sQ0FBQyxFQUFFLGNBQWMsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDO1lBQ3hDLElBQUksY0FBYyxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUNuQyxLQUFLLE1BQU0sUUFBUSxJQUFJLGNBQWMsQ0FBQyxjQUFjLENBQUMsWUFBWSxFQUFFLENBQUM7b0JBQ25FLE1BQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUNsRSxJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUM7d0JBQ3JELE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ25CLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7WUFDRCxJQUFJLGNBQWMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDeEIsS0FBSyxNQUFNLElBQUksSUFBSSxjQUFjLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUM3QyxJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUM7d0JBQ3JELE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ25CLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBRU8sS0FBSyxDQUFDLDBCQUEwQixDQUFDLEtBQWdCLEVBQUUsU0FBa0I7UUFDNUUsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUN4QyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDO1lBQ3JELElBQUksU0FBUyxJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUNoRCxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsS0FBSyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQy9FLENBQUM7WUFDRCxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVNLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBOEMsRUFBRSxVQUFvQyxFQUFFLFlBQXFCLEtBQUssRUFBRSxPQUEyQixTQUFTO1FBQzFLLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUM1QixPQUFPO1FBQ1IsQ0FBQztRQUNELE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDckssSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3pFLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLDBCQUEwQixFQUFFLDREQUE0RCxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoSixDQUFDO1FBQ0QsTUFBTSxHQUFHLEdBQTZDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7WUFDaEYsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDO1lBQzFELENBQUMsQ0FBQyxVQUFVLENBQUM7UUFFZCxJQUFJLEdBQUcsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUN2QixPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDbkMsQ0FBQztRQUVELHdDQUF3QztRQUN4QyxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQy9DLE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRSxFQUFFO1lBQzdFLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDbkQsSUFBSSxVQUFVLEtBQUssZUFBZSxJQUFJLFVBQVUsS0FBSyxvQkFBb0IsRUFBRSxDQUFDO2dCQUMzRSxPQUFPLEtBQUssQ0FBQztZQUNkLENBQUM7WUFDRCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3JDLENBQUMsQ0FBQyxDQUFDO1FBQ0gsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuRixJQUFJLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDN0Isb0NBQW9DO1lBQ3BDLE1BQU0sSUFBSSxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM3QixJQUFJLGVBQWUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDOUIsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2xDLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxPQUFPLElBQUksQ0FBQztZQUNiLENBQUM7UUFDRixDQUFDO1FBRUQsb0VBQW9FO1FBQ3BFLE1BQU0sR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNsRCxJQUFJLE1BQU0sR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzdCLE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO1FBRXRELElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNiLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFDRCxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ25JLE9BQU8sTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQ2xELENBQUM7SUFFTSxLQUFLLENBQUMsY0FBYyxDQUFDLGVBQWdDO1FBQzNELElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUM1QixPQUFPO1FBQ1IsQ0FBQztRQUNELE1BQU0sSUFBSSxDQUFDLHNCQUFzQixDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4RCxJQUFJLGdCQUEyQyxDQUFDO1FBQ2hELElBQUksMkJBQTJCLEdBQVksS0FBSyxDQUFDO1FBQ2pELEtBQUssTUFBTSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDbEQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDckQsSUFBSSxlQUFlLENBQUMsSUFBSSxLQUFLLFlBQVksRUFBRSxDQUFDO2dCQUMzQyxJQUFJLFlBQVksSUFBSSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO29CQUNoRSwyQkFBMkIsR0FBRyxJQUFJLENBQUM7b0JBQ25DLFNBQVM7Z0JBQ1YsQ0FBQztnQkFDRCxnQkFBZ0IsR0FBRyxRQUFRLENBQUM7Z0JBQzVCLE1BQU07WUFDUCxDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ3ZCLElBQUksMkJBQTJCLEVBQUUsQ0FBQztnQkFDakMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUNyQixpQ0FBaUMsRUFDakMsZ0VBQWdFLEVBQ2hFLGVBQWUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUMvQixDQUFDLENBQUM7WUFDSixDQUFDO1lBQ0QsT0FBTztRQUNSLENBQUM7UUFFRCxnQ0FBZ0M7UUFDaEMsSUFBSSxDQUFDO1lBQ0osTUFBTSxZQUFZLEdBQUcsTUFBTSxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDekUsSUFBSSxZQUFZLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxLQUFLLGVBQWUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUNoRSxPQUFPLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDbkUsQ0FBQztRQUNGLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2hCLHlFQUF5RTtRQUMxRSxDQUFDO1FBRUQsOEVBQThFO1FBQzlFLE1BQU0sS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxlQUFlLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMvRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDO1lBQzFCLElBQUksSUFBSSxDQUFDLEdBQUcsS0FBSyxlQUFlLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ3RDLE9BQU8sVUFBVSxDQUFDLGdCQUFnQixDQUFrQixJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDNUUsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPO0lBQ1IsQ0FBQztJQUlNLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBb0I7UUFDdEMsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQzVCLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUMvQyxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQVMsRUFBRSxDQUFDLENBQUM7UUFDcEMsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzVGLENBQUM7SUFFTSxLQUFLLENBQUMsYUFBYSxDQUFDLE1BQW9CO1FBQzlDLElBQUksQ0FBQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUMvQyxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQVMsRUFBRSxDQUFDLENBQUM7UUFDcEMsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDeEcsQ0FBQztJQUVNLFNBQVM7UUFDZixNQUFNLEtBQUssR0FBYSxFQUFFLENBQUM7UUFDM0IsSUFBSSxJQUFJLENBQUMsc0JBQXNCLEVBQUUsRUFBRSxDQUFDO1lBQ25DLEtBQUssTUFBTSxVQUFVLElBQUksc0JBQXNCLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztnQkFDdkQsSUFBSSxJQUFJLENBQUMsc0JBQXNCLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7b0JBQ3RELEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUNqQyxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFTSxZQUFZO1FBQ2xCLE9BQU8sSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQy9HLENBQUM7SUFFTyxTQUFTO1FBQ2hCLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDdkIsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQy9CLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDcEMsQ0FBQztJQUVNLEtBQUssQ0FBQyxjQUFjO1FBQzFCLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDdkIsT0FBTyxFQUFFLENBQUM7UUFDWCxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLGNBQWMsRUFBRSxDQUFDO0lBQzFDLENBQUM7SUFFTSxLQUFLLENBQUMsWUFBWTtRQUN4QixJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3ZCLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUN4QyxDQUFDO0lBRU0sc0JBQXNCO1FBQzVCLElBQUksSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFDL0IsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUM7UUFDbEMsQ0FBQztRQUNELE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBUyw4QkFBOEIsQ0FBQyxDQUFDO1FBQzFHLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLFFBQVEsQ0FBaUIscUJBQXFCLENBQUMsQ0FBQztRQUVoRixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxxQkFBbUIsQ0FBQyxxQkFBcUIsaUNBQXlCLENBQUM7UUFDakgsSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUNsQixJQUFJLENBQUM7Z0JBQ0osTUFBTSxNQUFNLEdBQWEsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztnQkFDbEQsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7b0JBQzNCLEtBQUssTUFBTSxLQUFLLElBQUksTUFBTSxFQUFFLENBQUM7d0JBQzVCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO29CQUM3QyxDQUFDO2dCQUNGLENBQUM7WUFDRixDQUFDO1lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztnQkFDaEIsa0NBQWtDO1lBQ25DLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUM7SUFDbEMsQ0FBQztJQUVPLG9CQUFvQixDQUFDLE1BQStCLEVBQUUsR0FBWTtRQUN6RSxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQzdCLE9BQU8sR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ2xCLENBQUM7UUFDRCxNQUFNLE1BQU0sR0FBVyxFQUFFLENBQUM7UUFDMUIsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO1lBQ3JCLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFLENBQUM7Z0JBQzFCLElBQUksZUFBZSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEtBQUssTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDL0csTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbkIsQ0FBQztxQkFBTSxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztvQkFDaEMsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQzt3QkFDL0IsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDbkIsQ0FBQzt5QkFBTSxDQUFDO3dCQUNQLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQzt3QkFDckMsSUFBSSxVQUFVLElBQUksVUFBVSxDQUFDLElBQUksS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7NEJBQ25ELE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ25CLENBQUM7b0JBQ0YsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBRU8sb0JBQW9CLENBQUMsSUFBaUM7UUFDN0QsT0FBTyxJQUFJLEtBQUssWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO0lBQ3BGLENBQUM7SUFFTyxlQUFlO1FBQ3RCLElBQUksSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDN0IsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUM7UUFDaEMsQ0FBQztRQUNELE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBUyw4QkFBOEIsQ0FBQyxDQUFDO1FBQzFHLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLFFBQVEsQ0FBaUIscUJBQXFCLENBQUMsQ0FBQztRQUU5RSxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxxQkFBbUIsQ0FBQyx1QkFBdUIsaUNBQXlCLENBQUM7UUFDbkgsSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUNsQixJQUFJLENBQUM7Z0JBQ0osTUFBTSxNQUFNLEdBQXVCLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQzVELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO29CQUMzQixLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sRUFBRSxDQUFDO3dCQUM1QixJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDakQsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2hCLGtDQUFrQztZQUNuQyxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDO0lBQ2hDLENBQUM7SUFFTyxtQkFBbUI7UUFDMUIsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUMzQixJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsZ0NBQWdDLEVBQUUsNEJBQTRCLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzFILE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDO1FBQzlCLENBQUM7UUFDRCxzQ0FBc0M7UUFDdEMsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksUUFBUSxDQUFpQixFQUFFLENBQUMsQ0FBQztRQUN6RCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxxQkFBbUIsQ0FBQyxtQkFBbUIsaUNBQXlCLENBQUM7UUFDL0csSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUNsQixJQUFJLENBQUM7Z0JBQ0osTUFBTSxNQUFNLEdBQXVCLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQzVELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO29CQUMzQixLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sRUFBRSxDQUFDO3dCQUM1QixJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDL0MsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2hCLGtDQUFrQztZQUNuQyxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDO0lBQzlCLENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxHQUFXO1FBQ3hDLE1BQU0sUUFBUSxHQUEyRCxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3pGLE9BQU87WUFDTixNQUFNLEVBQUUsUUFBUSxDQUFDLE1BQU0sRUFBRSxlQUFlLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBQztTQUM3RixDQUFDO0lBQ0gsQ0FBQztJQUVNLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBaUM7UUFDM0QsTUFBTSxTQUFTLEdBQXdDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0UsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUN0QyxTQUFTLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQztRQUMzQyxDQUFDLENBQUMsQ0FBQztRQUNILE1BQU0sZ0JBQWdCLEdBQXFCLElBQUksR0FBRyxFQUFFLENBQUM7UUFDckQsTUFBTSxrQkFBa0IsR0FBcUIsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUN2RCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDcEQsTUFBTSxLQUFLLEdBQStCLEVBQUUsQ0FBQztRQUM3QyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsMkJBQTJCLEVBQUUsbUNBQW1DLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNoRyxTQUFTLFlBQVksQ0FBQyxHQUFxQixFQUFFLE1BQTBCLEVBQUUsSUFBUztZQUNqRixJQUFJLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztnQkFDaEMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDckIsQ0FBQztZQUNELElBQUksTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLG9CQUFvQixDQUFDLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztnQkFDaEYsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDNUIsQ0FBQztRQUNGLENBQUM7UUFDRCxLQUFLLE1BQU0sS0FBSyxJQUFJLFdBQVcsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDO1lBQzNDLElBQUksQ0FBQztnQkFDSixNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JCLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2xDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDbkQsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLG1DQUFtQyxFQUFFLGdEQUFnRCxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNuSixZQUFZLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDM0csQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2hCLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxpQ0FBaUMsRUFBRSxnREFBZ0QsRUFBRSxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUMzSCxDQUFDO1FBQ0YsQ0FBQztRQUVELE1BQU0sWUFBWSxHQUEwQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBRXRFLEtBQUssVUFBVSxTQUFTLENBQUMsSUFBeUIsRUFBRSxHQUFxQixFQUFFLGVBQXdCO1lBQ2xHLEtBQUssTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7Z0JBQzlCLE1BQU0sTUFBTSxHQUFpQixFQUFFLENBQUM7Z0JBQ2hDLE1BQU0sVUFBVSxHQUF1QyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUMzRSxNQUFNLGdCQUFnQixHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQztvQkFDdkMsQ0FBQyxDQUFDLENBQUMsZUFBZTt3QkFDakIsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUM7b0JBQ3JGLENBQUMsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3JDLE1BQU0sSUFBSSxDQUFDLDRCQUE0QixDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxNQUFNLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRTtvQkFDbkYsT0FBTyxFQUFFLE9BQU87b0JBQ2hCLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQztpQkFDbkIsZ0NBQXdCLE1BQU0sRUFBRSxVQUFVLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3JFLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ3JCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztvQkFDOUIsSUFBSSxPQUFPLEVBQUUsQ0FBQzt3QkFDYixZQUFZLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDakMsQ0FBQztnQkFDRixDQUFDLENBQUMsQ0FBQztnQkFDSCxLQUFLLE1BQU0sYUFBYSxJQUFJLFVBQVUsRUFBRSxDQUFDO29CQUN4QyxNQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsYUFBYSxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQ25ELElBQUksT0FBTyxFQUFFLENBQUM7d0JBQ2IsWUFBWSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7b0JBQ3RELENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBQ0QsTUFBTSxTQUFTLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQy9DLE1BQU0sU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNoRCxLQUFLLE1BQU0sR0FBRyxJQUFJLFdBQVcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO1lBQ3RDLElBQUksWUFBWSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUMzQixLQUFLLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFFLENBQUMsQ0FBQztnQkFDbkMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLG9DQUFvQyxFQUFFLG1CQUFtQixFQUFFLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQy9GLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsc0NBQXNDLEVBQUUsNkJBQTZCLEVBQUUsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDM0csQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFTSxzQkFBc0IsQ0FBQyxtQkFBMkI7UUFDeEQsSUFBSSxJQUFJLENBQUMsb0JBQW9CLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLEVBQUUsQ0FBQztZQUN6RSxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUMvQixDQUFDO0lBQ0YsQ0FBQztJQUVNLG9CQUFvQixDQUFDLEdBQVc7UUFDdEMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLGtDQUFrQyxFQUFFLDhCQUE4QixFQUFFLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3ZHLElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLFlBQVksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1FBQzdCLENBQUM7SUFDRixDQUFDO0lBRU8scUJBQXFCO1FBQzVCLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBUyw4QkFBOEIsQ0FBQyxDQUFDO1FBQzFHLElBQUksSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDN0IsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssR0FBRyxxQkFBcUIsQ0FBQztRQUN2RCxDQUFDO0lBQ0YsQ0FBQztJQUVPLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxJQUFVO1FBQzVDLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUN4QixJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztZQUNuQyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDMUQsSUFBSSxlQUFlLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLGNBQWMsRUFBRSxDQUFDO2dCQUNoRCxNQUFNLE1BQU0sR0FBaUIsRUFBRSxDQUFDO2dCQUNoQyxNQUFNLFVBQVUsR0FBdUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDM0UsTUFBTSxJQUFJLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxFQUFFO29CQUNqRyxPQUFPLEVBQUUsT0FBTztvQkFDaEIsS0FBSyxFQUFFLENBQUMsY0FBYyxDQUFDO2lCQUN2QixnQ0FBd0IsTUFBTSxFQUFFLFVBQVUsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUMxRixLQUFLLE1BQU0sYUFBYSxJQUFJLFVBQVUsRUFBRSxDQUFDO29CQUN4QyxHQUFHLEdBQUcsVUFBVSxDQUFDLGFBQWEsQ0FBQyxDQUFDLE1BQU0sRUFBRyxDQUFDO2dCQUMzQyxDQUFDO1lBQ0YsQ0FBQztZQUNELElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztZQUNqRixJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUMvQixDQUFDO0lBQ0YsQ0FBQztJQUVPLHNCQUFzQjtRQUM3QixJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDOUIsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLHFCQUFxQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQVMsOEJBQThCLENBQUMsQ0FBQztRQUMxRyxrREFBa0Q7UUFDbEQsSUFBSSxxQkFBcUIsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxPQUFPO1FBQ1IsQ0FBQztRQUNELElBQUksSUFBSSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMvQyxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcscUJBQXFCLEVBQUUsQ0FBQztZQUN6QyxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUscUJBQXFCLENBQUMsQ0FBQztRQUM3QyxDQUFDO1FBQ0QsTUFBTSxTQUFTLEdBQXVCLEVBQUUsQ0FBQztRQUN6QyxLQUFLLE1BQU0sR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO1lBQ3hCLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxHQUFHLHFCQUFjLENBQUMsQ0FBQyxDQUFDO1FBQ3RFLENBQUM7UUFDRCxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxxQkFBbUIsQ0FBQyx1QkFBdUIsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxnRUFBZ0QsQ0FBQztJQUNuSixDQUFDO0lBRU8sS0FBSyxDQUFDLGtCQUFrQixDQUFDLElBQVU7UUFDMUMsSUFBSSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLHNEQUE0QixFQUFFLENBQUM7WUFDdEUsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDeEIsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7WUFDbkMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzFELElBQUksZUFBZSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxjQUFjLEVBQUUsQ0FBQztnQkFDaEQsTUFBTSxNQUFNLEdBQWlCLEVBQUUsQ0FBQztnQkFDaEMsTUFBTSxVQUFVLEdBQXVDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzNFLE1BQU0sSUFBSSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsRUFBRTtvQkFDakcsT0FBTyxFQUFFLE9BQU87b0JBQ2hCLEtBQUssRUFBRSxDQUFDLGNBQWMsQ0FBQztpQkFDdkIsZ0NBQXdCLE1BQU0sRUFBRSxVQUFVLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDMUYsS0FBSyxNQUFNLGFBQWEsSUFBSSxVQUFVLEVBQUUsQ0FBQztvQkFDeEMsR0FBRyxHQUFHLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxNQUFNLEVBQUcsQ0FBQztnQkFDM0MsQ0FBQztZQUNGLENBQUM7WUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFlBQVksRUFBRSxDQUFDO2dCQUNoRCxPQUFPO1lBQ1IsQ0FBQztZQUNELElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQywrQkFBK0IsRUFBRSw2QkFBNkIsRUFBRSxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNuRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7WUFDakYsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7UUFDN0IsQ0FBQztJQUNGLENBQUM7SUFFTyxvQkFBb0I7UUFDM0IsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNoRSxNQUFNLElBQUksR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7UUFDL0MsTUFBTSxTQUFTLEdBQXVCLEVBQUUsQ0FBQztRQUN6QyxLQUFLLE1BQU0sR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO1lBQ3hCLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxHQUFHLHFCQUFjLENBQUMsQ0FBQyxDQUFDO1FBQ3BFLENBQUM7UUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsOEJBQThCLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3JHLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLHFCQUFtQixDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLGdFQUFnRCxDQUFDO0lBQy9JLENBQUM7SUFFTyxrQkFBa0I7UUFDekIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyw2RUFBNkUsQ0FBQyxDQUFDLENBQUM7SUFDcEgsQ0FBQztJQUVPLEtBQUssQ0FBQywrQkFBK0IsQ0FBQyxLQUFnQjtRQUM3RCxNQUFNLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDeEUsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLEtBQUssUUFBUSxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQztZQUNwSyxJQUFJLFlBQThCLENBQUM7WUFDbkMsSUFBSSxlQUFlLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3pDLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0QsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLFlBQVksR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDaEMsQ0FBQztZQUNELElBQUksWUFBWSxFQUFFLENBQUM7Z0JBQ2xCLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsU0FBUyw2QkFBcUIsQ0FBQztZQUM5RCxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFTyxLQUFLLENBQUMsTUFBTTtRQUNuQixNQUFNLGdCQUFnQixHQUFHLE1BQU0sSUFBSSxDQUFDLCtCQUErQixDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyRixJQUFJLGdCQUFnQixFQUFFLENBQUM7WUFDdEIsT0FBTyxnQkFBZ0IsQ0FBQztRQUN6QixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztJQUMxQyxDQUFDO0lBRU8sS0FBSyxDQUFDLFFBQVE7UUFDckIsTUFBTSxlQUFlLEdBQUcsTUFBTSxJQUFJLENBQUMsK0JBQStCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ25GLElBQUksZUFBZSxFQUFFLENBQUM7WUFDckIsT0FBTyxlQUFlLENBQUM7UUFDeEIsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLDBCQUEwQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFTyxLQUFLLENBQUMsMEJBQTBCLENBQUMsSUFBYztRQUN0RCxNQUFNLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQzVDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDMUYsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNqQyxJQUFJLElBQUksRUFBRSxDQUFDO2dCQUNWLElBQUksSUFBSSxDQUFDLGFBQWEscUNBQTZCLEVBQUUsQ0FBQztvQkFDckQsTUFBTSxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMseUJBQXlCLEVBQUUsa0ZBQWtGLENBQUMsZ0NBQXdCLENBQUM7Z0JBQ3hMLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxNQUFNLElBQUksU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSxvRkFBb0YsQ0FBQyxnQ0FBd0IsQ0FBQztnQkFDMUwsQ0FBQztZQUNGLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLElBQUksQ0FBQyxhQUFhLHFDQUE2QixFQUFFLENBQUM7b0JBQ3JELE1BQU0sSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLDBCQUEwQixFQUFFLG9GQUFvRixDQUFDLGlDQUF5QixDQUFDO2dCQUM1TCxDQUFDO3FCQUFNLENBQUM7b0JBQ1AsTUFBTSxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsMEJBQTBCLEVBQUUsc0ZBQXNGLENBQUMsaUNBQXlCLENBQUM7Z0JBQzlMLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksaUJBQStCLENBQUM7UUFDcEMsSUFBSSxDQUFDO1lBQ0osaUJBQWlCLEdBQUcsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLFFBQVEsNkJBQXFCLENBQUM7UUFDbkcsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN6QixPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDOUIsQ0FBQztRQUNELE9BQU8saUJBQWlCLENBQUM7SUFDMUIsQ0FBQztJQUVNLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBc0IsRUFBRSxPQUFtQyxFQUFFLHdDQUErQztRQUM1SCxJQUFJLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUM7WUFDNUIsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDWCxNQUFNLElBQUksU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsRUFBRSw4QkFBOEIsQ0FBQyxrQ0FBMEIsQ0FBQztRQUNoSSxDQUFDO1FBQ0QsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBQ3hDLElBQUksaUJBQTJDLENBQUM7UUFDaEQsSUFBSSxDQUFDO1lBQ0osSUFBSSxPQUFPLElBQUksT0FBTyxDQUFDLG9CQUFvQixJQUFJLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDakgsTUFBTSxhQUFhLEdBQUcsTUFBTSxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzdELElBQUksYUFBYSxFQUFFLENBQUM7b0JBQ25CLGlCQUFpQixHQUFHLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxhQUFhLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO2dCQUNqRixDQUFDO1lBQ0YsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLGlCQUFpQixHQUFHLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ3hFLENBQUM7WUFDRCxPQUFPLGlCQUFpQixDQUFDO1FBQzFCLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDekIsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzlCLENBQUM7SUFDRixDQUFDO0lBRU8sc0JBQXNCO1FBQzdCLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLGtEQUEwQixDQUFDO1FBQ25GLE9BQU8sWUFBWSxLQUFLLElBQUksQ0FBQztJQUM5QixDQUFDO0lBRU8sOEJBQThCLENBQUMsSUFBYTtRQUNuRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxDQUFDLDRCQUE0QixDQUFDLENBQUM7UUFDdkYsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7WUFDbkMsT0FBTyxDQUFDLFlBQVksQ0FBQztRQUN0QixDQUFDO1FBQ0QsSUFBSSxJQUFJLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDeEIsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBQ0QsbURBQW1EO1FBQ25ELE1BQU0sZUFBZSxHQUErQixZQUFtQixDQUFDO1FBQ3hFLE9BQU8sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVPLGVBQWUsQ0FBQyxJQUFVO1FBQ2pDLElBQUksSUFBWSxDQUFDO1FBQ2pCLElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3pCLE1BQU0sZ0JBQWdCLEdBQXdDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztZQUMxRixtREFBbUQ7WUFDbkQsSUFBSSxHQUFTLGdCQUFpQixDQUFDLElBQUksQ0FBQztRQUNyQyxDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksR0FBRyxJQUFJLENBQUMsYUFBYSxFQUFHLENBQUMsSUFBSSxDQUFDO1FBQ25DLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFTywyQkFBMkIsQ0FBQyxJQUFVO1FBQzdDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDaEYsSUFBSSxPQUFPLEtBQUssS0FBSyxFQUFFLENBQUM7WUFDdkIsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUMvQixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFDRCxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLEtBQUssU0FBUyxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLEtBQUssU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2hILE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLGVBQWUsS0FBSyxTQUFTLElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLGVBQWUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDM0gsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBQ0QsSUFBSSxlQUFlLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDOUIsT0FBTyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGVBQWUsSUFBSSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ2xKLENBQUM7UUFDRCxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUN6QixNQUFNLGdCQUFnQixHQUF3QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7WUFDMUYsT0FBTyxnQkFBZ0IsQ0FBQyxjQUFjLEtBQUssU0FBUyxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDO1FBQ2xGLENBQUM7UUFDRCxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFTyxLQUFLLENBQUMsaUNBQWlDLENBQUMsSUFBWTtRQUMzRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxDQUFDLDRCQUE0QixDQUFDLENBQUM7UUFDbEYsSUFBSSxPQUFPLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDdEIsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLFFBQW9DLENBQUM7UUFDekMsSUFBSSxPQUFPLEtBQUssS0FBSyxFQUFFLENBQUM7WUFDdkIsbURBQW1EO1lBQ25ELFFBQVEsR0FBUSxPQUFPLENBQUM7UUFDekIsQ0FBQzthQUFNLENBQUM7WUFDUCxRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoQyxDQUFDO1FBQ0QsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQztRQUN0QixPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxXQUFXLENBQUMsNEJBQTRCLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDdkYsQ0FBQztJQUVPLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxJQUFrQztRQU9yRSxJQUFJLE9BQU8sR0FBK0MsRUFBRSxDQUFDO1FBQzdELEtBQUssTUFBTSxHQUFHLElBQUksc0JBQXNCLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztZQUNqRCxNQUFNLE9BQU8sR0FBRyxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDaEQsSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQ3hCLFNBQVM7WUFDVixDQUFDO1lBQ0QsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDcEMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ3pELENBQUM7aUJBQU0sQ0FBQztnQkFDUCxPQUFPLENBQUMsSUFBSSxDQUFDO29CQUNaLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSztvQkFDcEIsV0FBVyxFQUFFLElBQUksT0FBTyxDQUFDLElBQUksRUFBRTtvQkFDL0IsT0FBTyxFQUFFLE9BQU87aUJBQ2hCLENBQUMsQ0FBQztZQUNKLENBQUM7UUFDRixDQUFDO1FBQ0QsSUFBSSxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzFCLE9BQU87UUFDUixDQUFDO1FBQ0QsT0FBTyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDL0IsSUFBSSxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDeEIsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDdkMsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE9BQU8sQ0FBQyxDQUFDO1lBQ1YsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsdUJBQXVCLEVBQUUsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ2xHLElBQUksUUFBZ0IsQ0FBQztRQUNyQixJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUN6QixNQUFNLGdCQUFnQixHQUF3QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7WUFDMUYsbURBQW1EO1lBQ25ELFFBQVEsR0FBUyxnQkFBaUIsQ0FBQyxJQUFJLENBQUM7UUFDekMsQ0FBQzthQUFNLENBQUM7WUFDUCxRQUFRLEdBQUcsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDLElBQUksQ0FBQztRQUN0QyxDQUFDO1FBQ0QsT0FBTyxDQUFDLE9BQU8sQ0FDZCxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLGtEQUFrRCxFQUFFLDJDQUEyQyxDQUFDLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxFQUM1SSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLHdDQUF3QyxFQUFFLDBDQUEwQyxDQUFDLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQzlJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsNENBQTRDLEVBQUUsMENBQTBDLEVBQUUsUUFBUSxDQUFDLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLEVBQ2xLLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsaURBQWlELEVBQUUsMkNBQTJDLENBQUMsRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FDNUosQ0FBQztRQUNGLE1BQU0sY0FBYyxHQUFHLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSxzRUFBc0UsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNsTSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDckIsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBQ0QsSUFBSSxjQUFjLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDMUIsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUNELElBQUksY0FBYyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQzFCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLEVBQUUsY0FBYyxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ25ELE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUNELElBQUksY0FBYyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQzVCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUM3QixNQUFNLGdCQUFnQixHQUFHLElBQUksY0FBYyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUMzRCxNQUFNLFVBQVUsR0FBNkIsRUFBRSxjQUFjLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUM7WUFDcEYsT0FBTyxDQUFDLHVCQUF1QixDQUFDLGVBQWUsR0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFDckUsTUFBTSxPQUFPLEdBQUcsc0JBQXNCLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDeEUsSUFBSSxPQUFPLElBQUksT0FBTyxDQUFDLFFBQVEsS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDL0MsVUFBVSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUM7Z0JBQy9CLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDO1lBQ3JELENBQUM7WUFDRCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDdkMsT0FBTyxPQUFPLENBQUM7UUFDaEIsQ0FBQztRQUNELElBQUksY0FBYyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQzVCLE1BQU0sSUFBSSxDQUFDLGlDQUFpQyxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN0RSxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRU8sS0FBSyxDQUFDLGlCQUFpQixDQUFDLEtBQWdCLEVBQUUsY0FBd0I7UUFDekUsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ3RFLE1BQU0sTUFBTSxHQUFXLEVBQUUsQ0FBQztRQUMxQixNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQ3RCLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFLENBQUM7Z0JBQzFCLE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUMzRSxJQUFJLGVBQWUsRUFBRSxHQUFHLEtBQUssS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO29CQUN4QyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNuQixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBRU0sd0JBQXdCO1FBQzlCLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxpQkFBaUIsRUFBRSxxQ0FBNkIsQ0FBQztJQUM5RSxDQUFDO0lBRU8sYUFBYSxDQUFDLElBQVU7UUFDL0IsSUFBSSxJQUFJLENBQUMsYUFBYSxxQ0FBNkIsRUFBRSxDQUFDO1lBQ3JELE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3pCLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUNELElBQUksZUFBZSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQzlCLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBQ3BDLENBQUM7UUFDRCxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFTyxLQUFLLENBQUMsa0JBQWtCLENBQUMsUUFBYSxFQUFFLElBQTBEO1FBQ3pHLElBQUksU0FBMkQsQ0FBQztRQUNoRSxJQUFJLFdBQVcsR0FBVyxFQUFFLENBQUM7UUFDN0IsSUFBSSxDQUFDO1lBQ0osU0FBUyxHQUFHLE1BQU0sSUFBSSxDQUFDLHlCQUF5QixDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2hGLE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDO1lBQy9DLE1BQU0sRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLEdBQUcsS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3JELE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUMzQixJQUFJLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLFlBQVksRUFBRSxDQUFDLENBQUM7WUFDMUUsTUFBTSxLQUFLLEdBQUcsSUFBSSxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUNsRixXQUFXLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUNwRyxNQUFNLE9BQU8sR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7WUFDaEUsV0FBVyxHQUFHLE9BQU8sR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLE9BQU8sR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDNUgsQ0FBQztnQkFBUyxDQUFDO1lBQ1YsU0FBUyxFQUFFLE9BQU8sRUFBRSxDQUFDO1FBQ3RCLENBQUM7UUFDRCxPQUFPLFdBQVcsQ0FBQztJQUNwQixDQUFDO0lBRU8sS0FBSyxDQUFDLGlCQUFpQixDQUFDLFFBQXlCLEVBQUUsSUFBK0UsRUFBRSxjQUFzQixDQUFDLENBQUM7UUFDbkssSUFBSSxRQUFRLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDNUIsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQy9CLENBQUM7UUFDRCxNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQy9ELE1BQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUM7UUFDbEMsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ3ZCLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUN4QyxJQUFJLFdBQStCLENBQUM7UUFDcEMsSUFBSSxXQUFXLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUN4QixNQUFNLElBQUksR0FBZ0QsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBOEMsT0FBTyxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUNsSyxJQUFJLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsRUFBRSxDQUFDO2dCQUNyRCxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztZQUNoRixDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNsQixJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUM5QixXQUFXLEdBQUcsSUFBSSxDQUFDO1lBQ3BCLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzdELENBQUM7UUFDRixDQUFDO1FBRUQsTUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNoRCxJQUFJLGVBQWUsR0FBRyxDQUFDLENBQUM7UUFDeEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ2hDLElBQUksWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztnQkFDckMsZUFBZSxFQUFFLENBQUM7WUFDbkIsQ0FBQztRQUNGLENBQUM7UUFDRCxJQUFJLGFBQWEsR0FBRyxlQUFlLENBQUM7UUFDcEMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUM3QyxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQ3BDLGFBQWEsRUFBRSxDQUFDO1lBQ2pCLENBQUM7UUFDRixDQUFDO1FBQ0QsTUFBTSxTQUFTLEdBQUcsZUFBZSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxlQUFlLEVBQUUsV0FBVyxFQUFFLGVBQWUsS0FBSyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLGFBQWEsRUFBRSxTQUFTLEVBQUUsZUFBZSxLQUFLLGFBQWEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBRTdNLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUM7WUFDcEMsUUFBUTtZQUNSLE9BQU8sRUFBRTtnQkFDUixNQUFNLEVBQUUsS0FBSztnQkFDYixXQUFXLEVBQUUsSUFBSSxFQUFFLHFDQUFxQztnQkFDeEQsU0FBUztnQkFDVCxtQkFBbUIsK0RBQXVEO2FBQzFFO1NBQ0QsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQ3BCLENBQUM7SUFFTyx1QkFBdUIsQ0FBQyxJQUFvRDtRQUNuRixJQUFJLFdBQTZFLENBQUM7UUFDbEYsTUFBTSxVQUFVLEdBQUcsVUFBVSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxlQUFlLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ3JHLElBQUksVUFBVSxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN0QyxXQUFXLEdBQUcsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDM0MsQ0FBQzthQUFNLElBQUksZUFBZSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3JDLFdBQVcsR0FBRyxFQUNiLENBQUM7WUFDRixNQUFNLFVBQVUsR0FBK0IsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNoRyxPQUFPLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMxQixtREFBbUQ7WUFDbkQsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBTyxXQUFhLENBQUMsR0FBRyxDQUFDLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDbkYsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsZUFBZSxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDO2dCQUNsTCxXQUFXLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUM7WUFDM0UsQ0FBQztZQUNELElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUN4QyxXQUFXLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNqRixDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNsQixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBQ0QsSUFBSSxXQUFXLENBQUMsY0FBYyxLQUFLLFNBQVMsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsZUFBZSxLQUFLLFNBQVMsSUFBSSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLGVBQWUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUMzTixXQUFXLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQztRQUNqQyxDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssS0FBSyxXQUFXLEVBQUUsQ0FBQztZQUN4QyxXQUFXLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxVQUFVLENBQUM7UUFDN0QsQ0FBQzthQUFNLENBQUM7WUFDUCxXQUFXLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDakMsQ0FBQztRQUNELFdBQVcsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sQ0FBQztRQUN6RCxPQUFPLFdBQVcsQ0FBQztJQUNwQixDQUFDO0lBRU0sS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFvRCxFQUFFLFVBQXFDLEVBQUUsVUFBb0I7UUFDdkksSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQzVCLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDbEQsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ3RCLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNuQyxDQUFDO1FBQ0QsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2pGLElBQUksYUFBYSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSxtR0FBbUcsQ0FBQyxDQUFDLENBQUM7WUFDMUssT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFPLFNBQVMsQ0FBQyxDQUFDO1FBQ3pDLENBQUM7UUFFRCxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDO1FBQ3hDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2RCxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDbEIsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ25DLENBQUM7UUFDRCxNQUFNLEtBQUssR0FBdUIsVUFBVSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDOUYsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUNoQixLQUFLLE1BQU0sUUFBUSxJQUFJLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO2dCQUMvRCxtREFBbUQ7Z0JBQ25ELE1BQU0sS0FBSyxHQUFTLFVBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDMUMsSUFBSSxLQUFLLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUUsQ0FBQztvQkFDM0MsbURBQW1EO29CQUM3QyxXQUFZLENBQUMsUUFBUSxDQUFDLEdBQUcsS0FBSyxDQUFDO2dCQUN0QyxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDakIsTUFBTSxLQUFLLEdBQUc7Z0JBQ2IsT0FBTyxFQUFFLE9BQU87Z0JBQ2hCLEtBQUssRUFBRSxDQUFDLFdBQVcsQ0FBQzthQUNwQixDQUFDO1lBQ0YsSUFBSSxPQUFPLEdBQUc7Z0JBQ2IsR0FBRztnQkFDSCxHQUFHLENBQUMsUUFBUSxDQUFDLGtCQUFrQixFQUFFLGtIQUFrSCxDQUFDO2FBQ3BKLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0QsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsRUFBTyxDQUFDO1lBQ2hFLElBQUksWUFBWSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFDdEMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2xILENBQUM7WUFDRCxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxlQUFlLENBQUMsVUFBVSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN0SCxDQUFDO2FBQU0sQ0FBQztZQUNQLHNDQUFzQztZQUN0QyxJQUFJLENBQUMsS0FBSyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQ2xDLElBQUksVUFBVSxDQUFDLGNBQWMsS0FBSyxTQUFTLEVBQUUsQ0FBQztvQkFDN0MsVUFBVSxDQUFDLGNBQWMsR0FBRyxVQUFVLENBQUMsY0FBYyxDQUFDO29CQUN0RCxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxlQUFlLEVBQUUsdUJBQXVCLEVBQUUsVUFBVSxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN4SCxDQUFDO3FCQUFNLElBQUksVUFBVSxDQUFDLEtBQUssS0FBSyxTQUFTLEVBQUUsQ0FBQztvQkFDM0MsVUFBVSxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDO29CQUNwQyxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxlQUFlLEVBQUUsYUFBYSxFQUFFLFVBQVUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDckcsQ0FBQztZQUNGLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztvQkFDdEMsVUFBVSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUM7Z0JBQ3ZCLENBQUM7Z0JBQ0QsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFLENBQUM7b0JBQ3pCLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUNwQyxDQUFDO3FCQUFNLENBQUM7b0JBQ1AsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxXQUFXLENBQUM7Z0JBQ3ZDLENBQUM7Z0JBQ0QsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQUMsZUFBZSxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDckcsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDckUsQ0FBQztJQUNGLENBQUM7SUFFTyxtQkFBbUIsQ0FBQyxlQUFpQyxFQUFFLEdBQVcsRUFBRSxLQUFVLEVBQUUsTUFBZTtRQUN0RyxJQUFJLE1BQU0sR0FBb0MsU0FBUyxDQUFDO1FBQ3hELFFBQVEsTUFBTSxFQUFFLENBQUM7WUFDaEIsS0FBSyxjQUFjLENBQUMsSUFBSTtnQkFBRSxNQUFNLG1DQUEyQixDQUFDO2dCQUFDLE1BQU07WUFDbkUsS0FBSyxjQUFjLENBQUMsYUFBYTtnQkFBRSxNQUFNLHdDQUFnQyxDQUFDO2dCQUFDLE1BQU07WUFDakYsT0FBTyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsZUFBZSxDQUFDLGlCQUFpQixFQUFFLGtDQUEwQixFQUFFLENBQUM7Z0JBQ2pGLE1BQU0sd0NBQWdDLENBQUM7WUFDeEMsQ0FBQztpQkFBTSxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsaUJBQWlCLEVBQUUscUNBQTZCLEVBQUUsQ0FBQztnQkFDbEYsTUFBTSwrQ0FBdUMsQ0FBQztZQUMvQyxDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksTUFBTSxFQUFFLENBQUM7WUFDWixPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxlQUFlLENBQUMsR0FBRyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDdEcsQ0FBQzthQUFNLENBQUM7WUFDUCxPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO0lBQ0YsQ0FBQztJQUVPLG1CQUFtQixDQUFDLElBQVk7UUFDdkMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3BCLFFBQVEsSUFBSSxFQUFFLENBQUM7WUFDZCxLQUFLLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUMxQixPQUFPLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsb0JBQW9CLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQztZQUMzRyxDQUFDO1lBQ0QsS0FBSyxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztnQkFDbkMsSUFBSSxJQUFJLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsYUFBYSxFQUFFLENBQUM7b0JBQ3RELE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUM7Z0JBQ3RDLENBQUM7WUFDRixDQUFDO1lBQ0QsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDVCxPQUFPLFNBQVMsQ0FBQztZQUNsQixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFTyxtQkFBbUIsQ0FBQyxJQUFvRDtRQUMvRSxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUN6QixJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN0RCxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ1YsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7Z0JBQzdDLElBQUksVUFBVSxFQUFFLENBQUM7b0JBQ2hCLEdBQUcsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN2RCxDQUFDO3FCQUFNLENBQUM7b0JBQ1AsR0FBRyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7Z0JBQ3BDLENBQUM7WUFDRixDQUFDO1lBQ0QsT0FBTyxHQUFHLENBQUM7UUFDWixDQUFDO2FBQU0sQ0FBQztZQUNQLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixFQUFHLENBQUMsVUFBVSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDcEUsQ0FBQztJQUNGLENBQUM7SUFFTSxLQUFLLENBQUMsVUFBVSxDQUFDLElBQThDO1FBQ3JFLElBQUksUUFBeUIsQ0FBQztRQUM5QixJQUFJLElBQUksRUFBRSxDQUFDO1lBQ1YsUUFBUSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMzQyxDQUFDO2FBQU0sQ0FBQztZQUNQLFFBQVEsR0FBRyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDckosQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNoSCxDQUFDO0lBRU8sbUJBQW1CLENBQUMsS0FBYyxFQUFFLEtBQWdCO1FBTzNELE1BQU0sWUFBWSxHQUErQixJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQzNELE1BQU0sY0FBYyxHQUFXLEVBQUUsQ0FBQztRQUNsQyxNQUFNLGNBQWMsR0FBVyxFQUFFLENBQUM7UUFDbEMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUMvQixJQUFJLElBQUksR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3BDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDWCxJQUFJLEdBQUc7b0JBQ04sRUFBRSxFQUFFLElBQUksR0FBRyxFQUFnQjtvQkFDM0IsS0FBSyxFQUFFLElBQUksR0FBRyxFQUFnQjtvQkFDOUIsVUFBVSxFQUFFLElBQUksR0FBRyxFQUFnQjtpQkFDbkMsQ0FBQztnQkFDRixZQUFZLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNoQyxDQUFDO1lBQ0QsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDMUIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDNUIsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDbEMsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsVUFBVSxFQUFFLENBQUM7b0JBQzdDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3BFLENBQUM7Z0JBQ0QsSUFBSSxLQUFLLElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssS0FBSyxLQUFLLEVBQUUsQ0FBQztvQkFDM0QsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxjQUFjLENBQUMsU0FBUyxFQUFFLENBQUM7d0JBQ3BELGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQzNCLENBQUM7eUJBQU0sQ0FBQzt3QkFDUCxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUMzQixDQUFDO2dCQUNGLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFDSCxNQUFNLFFBQVEsR0FBa0I7WUFDL0IsT0FBTyxFQUFFLEtBQUssRUFBRSxHQUFpQixFQUFFLEtBQWEsRUFBRSxFQUFFO2dCQUNuRCxNQUFNLElBQUksR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLE9BQU8sR0FBRyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztnQkFDOUUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO29CQUNYLE9BQU8sU0FBUyxDQUFDO2dCQUNsQixDQUFDO2dCQUNELE9BQU8sSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbEYsQ0FBQztTQUNELENBQUM7UUFDRixJQUFJLGNBQWMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDL0IsSUFBSSxjQUFjLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUMvQixJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsc0JBQXNCLEVBQUUsZ0ZBQWdGLENBQUMsQ0FBQyxDQUFDO1lBQ25JLENBQUM7WUFDRCxPQUFPLEVBQUUsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQztRQUM5QyxDQUFDO1FBQ0QsSUFBSSxjQUFjLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ2pDLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxvRkFBb0Y7UUFDcEYsd0JBQXdCO1FBQ3hCLElBQUksY0FBYyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxPQUFPLEVBQUUsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQztRQUM5QyxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sRUFBRSxHQUFXLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUN2QyxNQUFNLElBQUksR0FBaUIsSUFBSSxZQUFZLENBQzFDLEVBQUUsRUFDRixFQUFFLElBQUksRUFBRSxjQUFjLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsRUFDcEQsRUFBRSxFQUNGLFVBQVUsRUFDVixFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBRSxFQUMzQjtnQkFDQyxVQUFVLEVBQUUsRUFBRTtnQkFDZCxTQUFTLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLGFBQWEsRUFBRSxFQUFFLEdBQUcsT0FBTyxFQUFFLEdBQUcsRUFBRSxhQUFhLENBQUMsa0JBQWtCLEVBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLGFBQWEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdkksSUFBSSxFQUFFLEVBQUU7YUFDUixDQUNELENBQUM7WUFDRixPQUFPLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxDQUFDO1FBQzNCLENBQUM7SUFDRixDQUFDO0lBRU8sZUFBZSxDQUFDLE9BQWlCO1FBT3hDLElBQUksWUFBbUQsQ0FBQztRQUV4RCxLQUFLLFVBQVUsWUFBWSxDQUFDLElBQXlCLEVBQUUsR0FBaUIsRUFBRSxVQUFvQztZQUM3RyxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLElBQTRCLEVBQVcsRUFBRTtnQkFDM0YsTUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxlQUFlLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDM0gsTUFBTSxXQUFXLEdBQUcsQ0FBQyxPQUFPLEdBQUcsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7Z0JBQ3JFLElBQUksT0FBTyxFQUFFLFFBQVEsRUFBRSxLQUFLLFdBQVcsRUFBRSxDQUFDO29CQUN6QyxPQUFPLEtBQUssQ0FBQztnQkFDZCxDQUFDO2dCQUNELElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO29CQUNoQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFVBQVUsS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUNuRyxDQUFDO3FCQUFNLENBQUM7b0JBQ1AsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDakQsTUFBTSxnQkFBZ0IsR0FBRyxjQUFjLENBQUMsb0JBQW9CLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO29CQUNsRixPQUFPLENBQUMsZ0JBQWdCLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxLQUFLLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO2dCQUN6RyxDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUM7WUFDSCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQzdCLE9BQU8sU0FBUyxDQUFDO1lBQ2xCLENBQUM7WUFDRCxNQUFNLElBQUksR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0IsSUFBSSxlQUFlLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQzlCLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsQyxDQUFDO1lBQ0QsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBRUQsS0FBSyxVQUFVLGVBQWUsQ0FBQyxJQUF5QjtZQUN2RCxJQUFJLFlBQVksS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDaEMsWUFBWSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7Z0JBQ3pCLENBQUMsT0FBTyxJQUFJLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEVBQUU7b0JBQ3BFLElBQUksSUFBSSxHQUFHLFlBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ3JDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQzt3QkFDWCxJQUFJLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxHQUFHLEVBQWdCLEVBQUUsVUFBVSxFQUFFLElBQUksR0FBRyxFQUFnQixFQUFFLGNBQWMsRUFBRSxJQUFJLEdBQUcsRUFBZ0IsRUFBRSxDQUFDO3dCQUN4SCxZQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDakMsQ0FBQztvQkFDRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDO3dCQUMxQixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO3dCQUNsQyxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxVQUFVLEVBQUUsQ0FBQzs0QkFDN0MsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQzt3QkFDcEUsQ0FBQzt3QkFDRCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO3dCQUNqRCxJQUFJLGVBQWUsS0FBSyxTQUFTLEVBQUUsQ0FBQzs0QkFDbkMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQzt3QkFDckQsQ0FBQztvQkFDRixDQUFDO2dCQUNGLENBQUMsQ0FBQyxDQUFDO1lBQ0osQ0FBQztZQUNELE9BQU8sWUFBWSxDQUFDO1FBQ3JCLENBQUM7UUFFRCxLQUFLLFVBQVUsV0FBVyxDQUFDLElBQXlCLEVBQUUsR0FBaUIsRUFBRSxVQUFvQztZQUM1RyxNQUFNLGVBQWUsR0FBRyxNQUFNLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwRCxNQUFNLElBQUksR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLE9BQU8sR0FBRyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUNqRixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ1gsT0FBTyxTQUFTLENBQUM7WUFDbEIsQ0FBQztZQUNELElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO2dCQUNoQyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3RFLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxNQUFNLEdBQUcsR0FBRyxjQUFjLENBQUMsb0JBQW9CLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUNyRSxPQUFPLEdBQUcsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQzFFLENBQUM7UUFDRixDQUFDO1FBRUQsT0FBTztZQUNOLE9BQU8sRUFBRSxLQUFLLEVBQUUsR0FBaUIsRUFBRSxVQUFnRCxFQUFFLEVBQUU7Z0JBQ3RGLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztvQkFDakIsT0FBTyxTQUFTLENBQUM7Z0JBQ2xCLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLFlBQVksS0FBSyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sS0FBSyxTQUFTLENBQUMsRUFBRSxDQUFDO29CQUM3RCxPQUFPLENBQUMsTUFBTSxZQUFZLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDO2dCQUMxRixDQUFDO3FCQUFNLENBQUM7b0JBQ1AsT0FBTyxXQUFXLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQztnQkFDM0MsQ0FBQztZQUNGLENBQUM7U0FDRCxDQUFDO0lBQ0gsQ0FBQztJQUVPLEtBQUssQ0FBQyxjQUFjO1FBQzNCLElBQUssMEJBSUo7UUFKRCxXQUFLLDBCQUEwQjtZQUM5QiwrQ0FBaUIsQ0FBQTtZQUNqQiw2Q0FBZSxDQUFBO1lBQ2YsK0NBQWlCLENBQUE7UUFDbEIsQ0FBQyxFQUpJLDBCQUEwQixLQUExQiwwQkFBMEIsUUFJOUI7UUFFRCxNQUFNLHVCQUF1QixHQUErQixJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSx3REFBNkIsQ0FBQztRQUU3SCxJQUFJLHVCQUF1QixLQUFLLDBCQUEwQixDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2xFLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQzthQUFNLElBQUksdUJBQXVCLEtBQUssMEJBQTBCLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxFQUFFLENBQUM7WUFDaEksTUFBTSxFQUFFLFNBQVMsRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUM7Z0JBQ3ZELE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLHVDQUF1QyxFQUFFLG1CQUFtQixDQUFDO2dCQUNuRixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsMERBQTBELENBQUM7Z0JBQzFGLGFBQWEsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsR0FBRyxFQUFFLG9CQUFvQixFQUFFLE9BQU8sRUFBRSxDQUFDLHVCQUF1QixDQUFDLEVBQUUsRUFBRSxRQUFRLENBQUM7Z0JBQ3hHLFlBQVksRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsR0FBRyxFQUFFLHdCQUF3QixFQUFFLE9BQU8sRUFBRSxDQUFDLHVCQUF1QixDQUFDLEVBQUUsRUFBRSxjQUFjLENBQUM7YUFDakgsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNoQixPQUFPLEtBQUssQ0FBQztZQUNkLENBQUM7UUFDRixDQUFDO1FBQ0QsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxFQUFFLE1BQU0seUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBQy9ELE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVPLEtBQUssQ0FBQyxZQUFZLENBQUMsSUFBVSxFQUFFLFFBQXVCLEVBQUUsU0FBd0I7UUFDdkYsSUFBSSxTQUFTLEdBQVMsSUFBSSxDQUFDO1FBQzNCLElBQUksTUFBTSxJQUFJLENBQUMsY0FBYyxFQUFFLEVBQUUsQ0FBQztZQUNqQyxNQUFNLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1lBQ3ZELE1BQU0sSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7WUFDbkMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDN0MsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFVBQVUsQ0FBQztZQUMvRCxNQUFNLFFBQVEsR0FBRyxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3BILHFGQUFxRjtZQUNyRiwyRkFBMkY7WUFDM0YsNkVBQTZFO1lBQzdFLFNBQVMsR0FBRyxDQUFDLENBQUMsVUFBVSxJQUFJLGNBQWMsSUFBSSxDQUFDLFNBQVMsK0JBQXVCLENBQUMsQ0FBQztnQkFDaEYsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDO1FBQ3BGLENBQUM7UUFDRCxNQUFNLHNCQUFzQixDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3ZDLE1BQU0sYUFBYSxHQUFHLFNBQVMsb0NBQTRCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNwSyxJQUFJLGFBQWEsRUFBRSxDQUFDO1lBQ25CLE9BQU8sSUFBSSxDQUFDLG9CQUFvQixDQUFDLGFBQWEsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM1RCxDQUFDO1FBQ0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsQ0FBQztJQUN4QixDQUFDO0lBRU8sS0FBSyxDQUFDLG9CQUFvQixDQUFDLGFBQWlDLEVBQUUsU0FBeUI7UUFDOUYsSUFBSSxTQUFTLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUN6QyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM3RCxDQUFDO1FBRUQsSUFBSSxTQUFTLCtCQUF1QixFQUFFLENBQUM7WUFDdEMsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JELENBQUM7UUFDRCxJQUFJLGFBQWEsQ0FBQyxJQUFJLG1DQUEyQixFQUFFLENBQUM7WUFDbkQsTUFBTSxNQUFNLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQztZQUNwQyxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsSUFBSSxJQUFJLFNBQVMscUNBQTZCLElBQUksU0FBUyxvQ0FBNEIsRUFBRSxDQUFDO2dCQUM5Ryx5RkFBeUY7Z0JBQ3pGLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLHNDQUFzQyxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbkYsT0FBTyxhQUFhLENBQUMsT0FBTyxDQUFDO1lBQzlCLENBQUM7WUFDRCxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQzNCLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQy9GLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxNQUFNLElBQUksU0FBUyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsRUFBRSxvRkFBb0YsQ0FBQyxpQ0FBeUIsQ0FBQztZQUN4TCxDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDOUMsT0FBTyxhQUFhLENBQUMsT0FBTyxDQUFDO0lBQzlCLENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxJQUFVLEVBQUUsTUFBdUI7UUFDaEUsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDNUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDcEMsQ0FBQztRQUNELFFBQVEsTUFBTSxFQUFFLENBQUM7WUFDaEI7Z0JBQ0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDO2dCQUNuRSxNQUFNO1lBQ1A7Z0JBQ0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUM7Z0JBQ3BFLE1BQU07WUFDUDtnQkFDQyxNQUFNO1lBQ1A7Z0JBQ0MsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLGdDQUFnQyxFQUFFLG9EQUFvRCxDQUFDLENBQUMsQ0FBQztnQkFDckksTUFBTTtZQUNQLDBDQUEyQjtZQUMzQjtnQkFDQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxXQUFZLENBQUMsY0FBYyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQ3JGLEdBQUcsQ0FBQyxRQUFRLENBQUMsaUNBQWlDLEVBQUUsaUNBQWlDLENBQUMsRUFDbEY7b0JBQ0MsS0FBSyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsK0JBQStCLEVBQUUsa0NBQWtDLENBQUM7b0JBQ3hGLElBQUksRUFBRSxTQUFTO2lCQUNmLEVBQ0QsS0FBSyxFQUFFLElBQUksRUFDWCxTQUFTLENBQ1QsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUU7b0JBQ2QsTUFBTSxJQUFJLEdBQTRCLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO29CQUNyRSxJQUFJLElBQUksS0FBSyxTQUFTLElBQUksSUFBSSxLQUFLLElBQUksRUFBRSxDQUFDO3dCQUN6QyxPQUFPO29CQUNSLENBQUM7b0JBQ0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDckIsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0lBQ0YsQ0FBQztJQUVPLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBVTtRQUNoQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3ZCLE9BQU87UUFDUixDQUFDO1FBRUQseUNBQXlDO1FBQ3pDLE1BQU0sYUFBYSxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLEtBQUssSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUVySCxJQUFJLGFBQWEsRUFBRSxDQUFDO1lBQ25CLHNDQUFzQztZQUN0QyxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3hELElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3ZCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQywwQkFBMEIsRUFBRSwwQ0FBMEMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUN0TCxPQUFPO1lBQ1IsQ0FBQztRQUNGLENBQUM7UUFFRCxpRUFBaUU7UUFDakUsSUFBSSxDQUFDO1lBQ0osNEVBQTRFO1lBQzVFLE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3RELElBQUksV0FBVyxFQUFFLENBQUM7Z0JBQ2pCLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUM3QixDQUFDO2lCQUFNLENBQUM7Z0JBQ1Asc0NBQXNDO2dCQUN0QyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsK0JBQStCLEVBQUUsaUVBQWlFLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDckwsQ0FBQztRQUNGLENBQUM7UUFBQyxNQUFNLENBQUM7WUFDUiw2Q0FBNkM7UUFDOUMsQ0FBQztJQUNGLENBQUM7SUFFTyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsWUFBa0I7UUFDaEQsTUFBTSxzQkFBc0IsR0FBRyxNQUFNLElBQUksQ0FBQyxxQkFBcUIsOEJBQXNCLENBQUM7UUFFdEYsdURBQXVEO1FBQ3ZELEtBQUssTUFBTSxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsSUFBSSxzQkFBc0IsRUFBRSxDQUFDO1lBQ3hELElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsY0FBYyxFQUFFLFlBQVksRUFBRSxDQUFDO2dCQUNwRixTQUFTO1lBQ1YsQ0FBQztZQUNELHVDQUF1QztZQUN2Qyw0QkFBNEI7WUFDNUIsSUFBSSxZQUFZLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxDQUFDO2dCQUM3QixLQUFLLE1BQU0sSUFBSSxJQUFJLFlBQVksQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7b0JBQzNDLHVDQUF1QztvQkFDdkMsSUFBSSxJQUFJLENBQUMsR0FBRyxLQUFLLFlBQVksQ0FBQyxHQUFHLEVBQUUsQ0FBQzt3QkFDbkMsT0FBTyxJQUFJLENBQUM7b0JBQ2IsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztZQUNELDhDQUE4QztZQUM5QyxJQUFJLFlBQVksQ0FBQyxjQUFjLEVBQUUsWUFBWSxFQUFFLENBQUM7Z0JBQy9DLEtBQUssTUFBTSxDQUFDLENBQUMsRUFBRSxlQUFlLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztvQkFDN0YsdUNBQXVDO29CQUN2QyxJQUFJLGVBQWUsQ0FBQyxHQUFHLEtBQUssWUFBWSxDQUFDLEdBQUcsRUFBRSxDQUFDO3dCQUM5QyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDLENBQUM7b0JBQzdDLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQsMEZBQTBGO1FBQzFGLG1GQUFtRjtRQUNuRixJQUFJLGVBQWUsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztZQUN0Qyx1R0FBdUc7WUFDdkcsZ0VBQWdFO1lBQ2hFLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxZQUFZLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUMvRCxLQUFLLE1BQU0sSUFBSSxJQUFJLFFBQVEsRUFBRSxDQUFDO2dCQUM3QixJQUFJLElBQUksQ0FBQyxHQUFHLEtBQUssWUFBWSxDQUFDLEdBQUcsRUFBRSxDQUFDO29CQUNuQyxPQUFPLElBQUksQ0FBQztnQkFDYixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRU0sS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFVO1FBQ2hDLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUM1QixPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLENBQUM7UUFDM0MsQ0FBQztRQUVELElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDdkIsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxDQUFDO1FBQzNDLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFFTyxhQUFhO1FBQ3BCLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDdkIsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUEyQixFQUFFLENBQUMsQ0FBQztRQUN0RCxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQ3hDLENBQUM7SUFFUyx5QkFBeUI7UUFDbEMsT0FBTyxJQUFJLGtCQUFrQixDQUM1QixJQUFJLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixFQUFFLElBQUksQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFDM0ksSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsNkJBQTZCLEVBQ3RELElBQUksQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixFQUM5QyxxQkFBbUIsQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsK0JBQStCLEVBQzVGLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLHNCQUFzQixFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixFQUMzRixJQUFJLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixFQUNuRCxDQUFDLGVBQTZDLEVBQUUsRUFBRTtZQUNqRCxJQUFJLGVBQWUsRUFBRSxDQUFDO2dCQUNyQixPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzVELENBQUM7aUJBQU0sSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUMzQyxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO2dCQUMxRCxNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDL0QsSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO29CQUN4QixPQUFPLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDekIsQ0FBQztnQkFDRCxPQUFPLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN2QixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsT0FBTyxTQUFTLENBQUM7WUFDbEIsQ0FBQztRQUNGLENBQUMsRUFDRCxLQUFLLEVBQUUsT0FBZSxFQUFFLEVBQUU7WUFDekIseURBQXlEO1lBQ3pELE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDOUMsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQy9CLEtBQUssTUFBTSxJQUFJLElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQzdCLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxLQUFLLE9BQU8sRUFBRSxDQUFDO29CQUNsQyxPQUFPLElBQUksQ0FBQztnQkFDYixDQUFDO1lBQ0YsQ0FBQztZQUNELE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUMsQ0FDRCxDQUFDO0lBQ0gsQ0FBQztJQUlPLHNCQUFzQixDQUFDLElBQVk7UUFDMUMsTUFBTSxVQUFVLEdBQUcsc0JBQXNCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BELE9BQU8sQ0FBQyxVQUFVLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDeEcsQ0FBQztJQUVPLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFvQixFQUFFLGNBQXdCLEVBQUUsa0JBQTRCO1FBQzFHLE1BQU0sSUFBSSxDQUFDLDhCQUE4QixDQUFDO1FBQzFDLE1BQU0sSUFBSSxHQUFHLE1BQU0sRUFBRSxJQUFJLENBQUM7UUFDMUIsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztRQUNwRSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDckIsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2pELENBQUM7UUFDRCxNQUFNLFVBQVUsR0FBK0IsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRSxzQkFBc0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO1FBQzNGLFVBQVUsQ0FBQyxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUM7UUFDM0IsVUFBVSxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUM3QixNQUFNLG1CQUFtQixHQUFHLE1BQU0sSUFBSSxPQUFPLENBQWEsT0FBTyxDQUFDLEVBQUU7WUFDbkUsTUFBTSxNQUFNLEdBQWUsRUFBRSxDQUFDO1lBQzlCLElBQUksT0FBTyxHQUFXLENBQUMsQ0FBQztZQUN4QixNQUFNLElBQUksR0FBRyxDQUFDLEtBQTJCLEVBQUUsRUFBRTtnQkFDNUMsSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDWCxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNwQixDQUFDO2dCQUNELElBQUksRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ3JCLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDakIsQ0FBQztZQUNGLENBQUMsQ0FBQztZQUNGLE1BQU0sS0FBSyxHQUFHLENBQUMsS0FBVSxFQUFFLEVBQUU7Z0JBQzVCLElBQUksQ0FBQztvQkFDSixJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQzt3QkFDakMsSUFBSSxLQUFLLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQzs0QkFDNUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEtBQUssQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDOzRCQUN2QyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQzt3QkFDakMsQ0FBQzs2QkFBTSxDQUFDOzRCQUNQLElBQUksQ0FBQyxJQUFJLENBQUMsK0RBQStELENBQUMsQ0FBQzs0QkFDM0UsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUNwQixDQUFDO29CQUNGLENBQUM7Z0JBQ0YsQ0FBQzt3QkFBUyxDQUFDO29CQUNWLElBQUksRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFLENBQUM7d0JBQ3JCLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDakIsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQyxDQUFDO1lBQ0YsSUFBSSxJQUFJLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLHFDQUE2QixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUN0SCxJQUFJLGlCQUFpQixHQUFHLEtBQUssQ0FBQztnQkFDOUIsS0FBSyxNQUFNLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztvQkFDbEQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ3JELElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssWUFBWSxDQUFDLEVBQUUsQ0FBQzt3QkFDckQsSUFBSSxZQUFZLElBQUksQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQzs0QkFDaEUsU0FBUzt3QkFDVixDQUFDO3dCQUNELGlCQUFpQixHQUFHLElBQUksQ0FBQzt3QkFDekIsT0FBTyxFQUFFLENBQUM7d0JBQ1YsV0FBVyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBaUIsRUFBRSxFQUFFOzRCQUN4RSx3REFBd0Q7NEJBQ3hELEtBQUssTUFBTSxJQUFJLElBQUksT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO2dDQUNsQyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztvQ0FDbkQsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLG9CQUFvQixFQUFFLHFGQUFxRixFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO29DQUNqTCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUyxDQUFDLEVBQUUsQ0FBQzt3Q0FDMUQsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO29DQUNwQixDQUFDO29DQUNELE1BQU07Z0NBQ1AsQ0FBQzs0QkFDRixDQUFDOzRCQUNELE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO3dCQUN0QixDQUFDLEVBQUUsS0FBSyxDQUFDLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRTs0QkFDckIsWUFBWTs0QkFDWixJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7d0JBQ2pCLENBQUMsQ0FBQyxDQUFDO29CQUNKLENBQUM7Z0JBQ0YsQ0FBQztnQkFDRCxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztvQkFDeEIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNqQixDQUFDO1lBQ0YsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNqQixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFFSCxNQUFNLE1BQU0sR0FBWSxJQUFJLE9BQU8sRUFBRSxDQUFDO1FBQ3RDLE1BQU0sZ0JBQWdCLEdBQVksSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUVoRCxLQUFLLE1BQU0sR0FBRyxJQUFJLG1CQUFtQixFQUFFLENBQUM7WUFDdkMsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQzlCLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO2dCQUNsRCxJQUFJLGVBQWUsRUFBRSxDQUFDO29CQUNyQixnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUM3QyxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLENBQUM7WUFDSixJQUFJLEtBQUssR0FBMkMsRUFBRSxDQUFDO1lBQ3ZELDhFQUE4RTtZQUM5RSxJQUFJLENBQUMsa0JBQWtCLElBQUksSUFBSSxDQUFDLGdDQUFnQyxDQUFDLGtCQUFrQixFQUFFLEVBQUUsQ0FBQztnQkFDdkYsS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1lBQ3BELENBQUM7WUFDRCxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLGdCQUFnQixFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7WUFDeEcsSUFBSSx5QkFBeUIsRUFBRSxDQUFDO2dCQUMvQiwrRUFBK0U7Z0JBQy9FLE1BQU0sSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1lBQzlDLENBQUM7WUFDRCxPQUFPLE1BQU0sQ0FBQztRQUNmLENBQUM7UUFBQyxNQUFNLENBQUM7WUFDUiw4RUFBOEU7WUFDOUUsTUFBTSxNQUFNLEdBQVksSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUN0QyxLQUFLLE1BQU0sR0FBRyxJQUFJLG1CQUFtQixFQUFFLENBQUM7Z0JBQ3ZDLEtBQUssTUFBTSxJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUM5QixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztvQkFDekMsSUFBSSxNQUFNLEVBQUUsQ0FBQzt3QkFDWixNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDMUIsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztZQUNELE9BQU8sTUFBTSxDQUFDO1FBQ2YsQ0FBQztJQUNGLENBQUM7SUFDTyxzQkFBc0IsQ0FBQyx3QkFBZ0UsRUFBRSxNQUErQixFQUFFLE1BQWUsRUFBRSxnQkFBeUIsRUFBRSxjQUFtQztRQUNoTixPQUFPLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsV0FBVyxDQUFDLEVBQUUsRUFBRTtZQUNoRSxNQUFNLFdBQVcsR0FBRyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDOUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDdEIsSUFBSSxXQUFXLEVBQUUsQ0FBQztvQkFDakIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxXQUFXLENBQUMsQ0FBQztnQkFDakMsQ0FBQztnQkFDRCxPQUFPO1lBQ1IsQ0FBQztZQUVELElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxpQkFBaUIsRUFBRSxpQ0FBeUIsRUFBRSxDQUFDO2dCQUN2RSxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDM0MsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sY0FBYyxHQUFHLFdBQVcsQ0FBQyxjQUFjLENBQUM7Z0JBQ2xELE1BQU0sd0JBQXdCLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO2dCQUNsSCxNQUFNLG1CQUFtQixHQUFXLEVBQUUsQ0FBQztnQkFDdkMsSUFBSSxjQUFjLElBQUksd0JBQXdCLEVBQUUsQ0FBQztvQkFDaEQsTUFBTSxvQkFBb0IsR0FBZ0IsSUFBSSxHQUFHLEVBQVUsQ0FBQztvQkFDNUQsSUFBSSxjQUFjLEVBQUUsQ0FBQzt3QkFDcEIsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7b0JBQ3hGLENBQUM7b0JBQ0QsS0FBSyxNQUFNLElBQUksSUFBSSxXQUFXLEVBQUUsQ0FBQzt3QkFDaEMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQzs0QkFDL0IsU0FBUzt3QkFDVixDQUFDO3dCQUNELElBQUksY0FBYyxFQUFFLENBQUM7NEJBQ3BCLE1BQU0sZUFBZSxHQUFHLGNBQWMsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQzs0QkFDdkUsSUFBSSxlQUFlLEVBQUUsQ0FBQztnQ0FDckIsb0JBQW9CLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7Z0NBQy9DLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQzs0QkFDckUsQ0FBQztpQ0FBTSxDQUFDO2dDQUNQLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDOzRCQUN2QixDQUFDO3dCQUNGLENBQUM7NkJBQU0sSUFBSSx3QkFBd0IsRUFBRSxDQUFDOzRCQUNyQyxNQUFNLGVBQWUsR0FBRyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDOzRCQUNwRSxJQUFJLGVBQWUsRUFBRSxDQUFDO2dDQUNyQixNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUM7Z0NBQ3BFLG1CQUFtQixDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQzs0QkFDM0MsQ0FBQztpQ0FBTSxDQUFDO2dDQUNQLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDOzRCQUN2QixDQUFDO3dCQUNGLENBQUM7NkJBQU0sQ0FBQzs0QkFDUCxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQzt3QkFDdkIsQ0FBQztvQkFDRixDQUFDO29CQUNELElBQUksbUJBQW1CLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO3dCQUNwQyxNQUFNLFFBQVEsR0FBRyxtQkFBbUIsQ0FBQyxNQUFNLENBQTZCLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFOzRCQUNyRixHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQzs0QkFDckIsT0FBTyxHQUFHLENBQUM7d0JBQ1osQ0FBQyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzt3QkFDeEIsS0FBSyxNQUFNLElBQUksSUFBSSxXQUFXLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDOzRCQUMxQyxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQ0FDeEIsU0FBUzs0QkFDVixDQUFDOzRCQUNELE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO3dCQUN2QixDQUFDO29CQUNGLENBQUM7eUJBQU0sQ0FBQzt3QkFDUCxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQzNDLENBQUM7b0JBRUQsTUFBTSwyQkFBMkIsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7b0JBRXJFLE1BQU0sMkJBQTJCLEdBQUcsMkJBQTJCLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsRUFBRTt3QkFDbkYsTUFBTSxlQUFlLEdBQUcsY0FBZSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFDNUQsSUFBSSxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxlQUFlLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7NEJBQ3ZFLE9BQU87d0JBQ1IsQ0FBQzt3QkFFRCxJQUFJLCtCQUErQixHQUFZLEtBQUssQ0FBQzt3QkFFckQsS0FBSyxNQUFNLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQzs0QkFDbEQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7NEJBQ3JELElBQUksZUFBZSxDQUFDLElBQUksS0FBSyxZQUFZLEVBQUUsQ0FBQztnQ0FDM0MsSUFBSSxZQUFZLElBQUksQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztvQ0FDaEUsK0JBQStCLEdBQUcsSUFBSSxDQUFDO29DQUN2QyxTQUFTO2dDQUNWLENBQUM7Z0NBRUQsSUFBSSxDQUFDO29DQUNKLE1BQU0sWUFBWSxHQUFHLE1BQU0sUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsQ0FBQztvQ0FDakUsSUFBSSxZQUFZLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxLQUFLLGVBQWUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO3dDQUNoRSxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUM7d0NBQzVFLE9BQU87b0NBQ1IsQ0FBQztnQ0FDRixDQUFDO2dDQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7b0NBQ2hCLHlFQUF5RTtnQ0FDMUUsQ0FBQzs0QkFDRixDQUFDO3dCQUNGLENBQUM7d0JBQ0QsSUFBSSwrQkFBK0IsRUFBRSxDQUFDOzRCQUNyQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQ3JCLGlDQUFpQyxFQUNqQyxnRUFBZ0UsRUFDaEUsZUFBZSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQy9CLENBQUMsQ0FBQzt3QkFDSixDQUFDOzZCQUFNLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQzs0QkFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUNyQiw2QkFBNkIsRUFDN0IsMEhBQTBILEVBQzFILGVBQWUsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUMvQixJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQ3BFLENBQUMsQ0FBQzt3QkFDSixDQUFDO29CQUNGLENBQUMsQ0FBQyxDQUFDO29CQUVILE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO2dCQUNoRCxDQUFDO3FCQUFNLENBQUM7b0JBQ1AsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUMxQyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLFdBQVcsQ0FBQyxDQUFDO2dCQUNqQyxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVPLDRCQUE0QixDQUFDLGNBQXdCO1FBQzVELElBQUksTUFBaUQsQ0FBQztRQUN0RCxTQUFTLFNBQVM7WUFDakIsSUFBSSxNQUFNLEVBQUUsQ0FBQztnQkFDWixPQUFPLE1BQU0sQ0FBQztZQUNmLENBQUM7WUFDRCxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM3QixPQUFPLE1BQU8sQ0FBQztRQUNoQixDQUFDO1FBQ0QsS0FBSyxNQUFNLElBQUksSUFBSSxjQUFjLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDekMsSUFBSSxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ3pCLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7Z0JBQ3RELDBFQUEwRTtnQkFDMUUsZ0ZBQWdGO2dCQUNoRixJQUFJLFdBQVcsS0FBSyxNQUFNLElBQUksV0FBVyxLQUFLLE9BQU8sSUFBSSxXQUFXLEtBQUssTUFBTSxFQUFFLENBQUM7b0JBQ2pGLE1BQU0sVUFBVSxHQUFHLG1CQUFtQixDQUFDLE1BQU0sQ0FBQzt3QkFDN0MsSUFBSSxFQUFFLFdBQVc7d0JBQ2pCLElBQUksRUFBRSxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSTtxQkFDdkMsQ0FBQyxDQUFDO29CQUNILFNBQVMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUM7Z0JBQ3JDLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQUVNLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxzQ0FBNkM7UUFDM0UsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQzVCLE9BQU8sSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUNsQixDQUFDO1FBQ0QsTUFBTSxXQUFXLENBQUMsSUFBSSxDQUFDLDhCQUE4QixFQUFFLElBQUksRUFBRSxHQUFHLEVBQUU7WUFDakUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsZ0RBQWdELENBQUMsQ0FBQztRQUN6RSxDQUFDLENBQUMsQ0FBQztRQUNILE1BQU0sSUFBSSxDQUFDLG9CQUFvQixDQUFDO1FBQ2hDLElBQUksSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7WUFDakMsT0FBTyxJQUFJLENBQUMsc0JBQXNCLENBQUM7UUFDcEMsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFTSxlQUFlLENBQUMsVUFBa0I7UUFDeEMsT0FBTyxJQUFJLENBQUMsV0FBVyxFQUFFLGVBQWUsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lBRU8scUJBQXFCLENBQUMsc0NBQTZDO1FBQzFFLElBQUksQ0FBQyxzQkFBc0IsR0FBRyxJQUFJLENBQUMsc0JBQXNCLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDckUsT0FBTyxJQUFJLENBQUMsc0JBQXNCLENBQUM7SUFDcEMsQ0FBQztJQUVPLEtBQUssQ0FBQyxXQUFXO1FBQ3hCLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUNyRixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDYixNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDcEQsTUFBTSxHQUFHLElBQUksZUFBZSxDQUFDLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUMvRixDQUFDO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBRUQsb0JBQW9CLENBQUMsSUFBOEI7UUFDbEQsT0FBTyxJQUFJLENBQUMsV0FBVyxFQUFFLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFUyxLQUFLLENBQUMsc0JBQXNCLENBQUMsc0NBQTZDO1FBQ25GLE1BQU0sUUFBUSxHQUFzRCxFQUFFLENBQUM7UUFDdkUsS0FBSyxNQUFNLE1BQU0sSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUM1QyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztRQUNyRSxDQUFDO1FBQ0QsTUFBTSxNQUFNLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzNDLE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxFQUFzQyxDQUFDO1FBQzdELEtBQUssTUFBTSxLQUFLLElBQUksTUFBTSxFQUFFLENBQUM7WUFDNUIsSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDWCxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3pELENBQUM7UUFDRixDQUFDO1FBRUQsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDeEMsSUFBSSxJQUFJLENBQUMsZUFBZSxDQUFDLGlCQUFpQixFQUFFLGlDQUF5QixFQUFFLENBQUM7WUFDdkUsTUFBTSxrQkFBa0IsR0FBRyxNQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDcEYsSUFBSSxrQkFBa0IsSUFBSSxJQUFJLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsYUFBYSxFQUFFLENBQUM7Z0JBQzVFLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUMxRSxDQUFDO1FBQ0YsQ0FBQztRQUVELE1BQU0sU0FBUyxHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztRQUNsRSxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2YsTUFBTSxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM3QyxDQUFDO1FBRUQscUNBQXFDO1FBQ3JDLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQ25FLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxLQUFLLElBQUksWUFBWSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUM5RCxDQUFDLFlBQVksQ0FBQyxjQUFjLEVBQUUsWUFBWSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQy9HLENBQUM7UUFDRixJQUFJLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRTNDLE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQUVELElBQVksbUJBQW1CO1FBQzlCLE9BQU8sOEJBQThCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLElBQUksSUFBSSxnQ0FBZ0MsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssSUFBSSxDQUFDO0lBQ2pLLENBQUM7SUFFTyxLQUFLLENBQUMsNEJBQTRCLENBQUMsZUFBaUMsRUFBRSxzQ0FBNkM7UUFDMUgsTUFBTSw0QkFBNEIsR0FBRyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsS0FBSyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMscUJBQXFCLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztRQUN2TSxJQUFJLENBQUMsNEJBQTRCLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxNQUFNLElBQUksNEJBQTRCLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDckgsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsZUFBZSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsNEJBQTRCLENBQUMsQ0FBQyxDQUFDLDRCQUE0QixDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUNsTCxDQUFDO1FBQ0QsTUFBTSxzQkFBc0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN2QyxNQUFNLGNBQWMsR0FBZ0MsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDeEcsTUFBTSxlQUFlLEdBQUcsSUFBSSxlQUFlLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ2pFLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkcsTUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxlQUFlLEVBQUUsU0FBUyxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSw0QkFBNEIsQ0FBQyxNQUFNLEVBQUUsZUFBZSxFQUFFLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDclAsSUFBSSxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBQ3RCLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxpQ0FBeUIsQ0FBQyxFQUFFLENBQUM7WUFDM0csU0FBUyxHQUFHLElBQUksQ0FBQztRQUNsQixDQUFDO1FBQ0QsSUFBSSxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUM7WUFDdEMsZUFBZSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLGdDQUFnQyxFQUFFLHVIQUF1SCxDQUFDLENBQUMsQ0FBQztZQUMvTCxPQUFPLEVBQUUsZUFBZSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsQ0FBQztRQUNsRixDQUFDO1FBQ0QsSUFBSSxlQUFpRixDQUFDO1FBQ3RGLElBQUksV0FBVyxDQUFDLFVBQVUsSUFBSSxXQUFXLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNqRSxlQUFlLEdBQUc7Z0JBQ2pCLFlBQVksRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQzthQUNqQyxDQUFDO1lBQ0YsS0FBSyxNQUFNLElBQUksSUFBSSxXQUFXLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQzNDLGVBQWUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUM7WUFDM0QsQ0FBQztRQUNGLENBQUM7UUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLG1CQUFtQixJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNsRSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO1FBQ3BFLENBQUM7UUFDRCxPQUFPLEVBQUUsZUFBZSxFQUFFLEdBQUcsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsU0FBUyxFQUFFLENBQUM7SUFDNUksQ0FBQztJQUVPLHdCQUF3QixDQUFDLE1BQStELEVBQUUsUUFBZ0I7UUFDakgsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2IsT0FBTyxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFFLEtBQUssRUFBRSxDQUFDO1FBQ3JELENBQUM7UUFDRCxtREFBbUQ7UUFDbkQsTUFBTSxXQUFXLEdBQWMsTUFBYyxDQUFDLFlBQVksQ0FBQztRQUMzRCxJQUFJLFdBQVcsRUFBRSxDQUFDO1lBQ2pCLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQztZQUN2QixLQUFLLE1BQU0sVUFBVSxJQUFJLFdBQVcsRUFBRSxDQUFDO2dCQUN0QyxJQUFJLGNBQWMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztvQkFDckMsVUFBVSxHQUFHLElBQUksQ0FBQztvQkFDbEIsTUFBTTtnQkFDUCxDQUFDO1lBQ0YsQ0FBQztZQUNELElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQ2hCLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLEdBQUcsRUFBRSxpQ0FBaUMsRUFBRSxPQUFPLEVBQUUsQ0FBQywrSEFBK0gsQ0FBQyxFQUFFLEVBQUUsNkdBQTZHLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDelUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxHQUFHLEVBQUUsaUNBQWlDLEVBQUUsT0FBTyxFQUFFLENBQUMsK0hBQStILENBQUMsRUFBRSxFQUFFLDZHQUE2RyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RXLE9BQU8sRUFBRSxNQUFNLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRSxDQUFDO1lBQ3pDLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxFQUFFLE1BQU0sRUFBRSxjQUFjLEVBQUUsS0FBSyxFQUFFLENBQUM7SUFDMUMsQ0FBQztJQUVPLElBQUksQ0FBQyxLQUFhLEVBQUUsT0FBaUI7UUFDNUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSwwREFBOEIsRUFBRSxDQUFDO1lBQ25GLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQztRQUMxQyxDQUFDO0lBQ0YsQ0FBQztJQUVPLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxlQUFpQyxFQUFFLHNDQUE2QztRQUN4SCxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsS0FBSyxlQUFlLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdkQsT0FBTyxJQUFJLENBQUMsMEJBQTBCLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDekQsQ0FBQztRQUNELE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGVBQWUsRUFBRSxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDbEcsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixDQUFDLG1CQUFtQixDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLHFDQUFxQyxFQUFFLGdCQUFnQixDQUFDLENBQUMsQ0FBQztRQUN2SixNQUFNLGVBQWUsR0FBeUQ7WUFDN0UsWUFBWSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO1NBQ2pDLENBQUM7UUFFRixNQUFNLE1BQU0sR0FBaUIsRUFBRSxDQUFDO1FBQ2hDLE1BQU0sSUFBSSxDQUFDLDRCQUE0QixDQUFDLGVBQWUsRUFBRSxhQUFhLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsZUFBZSxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDM0ssTUFBTSxNQUFNLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDO1FBQ3ZILElBQUksTUFBTSxLQUFLLGVBQWUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN4QyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsaUNBQWlDLEVBQUUsc0VBQXNFLENBQUMsQ0FBQyxDQUFDO1lBQ3hKLE9BQU8sSUFBSSxDQUFDLDBCQUEwQixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3pELENBQUM7UUFDRCxPQUFPLEVBQUUsZUFBZSxFQUFFLEdBQUcsRUFBRSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLFNBQVMsRUFBRSxhQUFhLENBQUMsY0FBYyxFQUFFLENBQUM7SUFDOUgsQ0FBQztJQUVPLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxlQUFpQyxFQUFFLHNDQUE2QztRQUMvRyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsS0FBSyxlQUFlLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdkQsT0FBTyxJQUFJLENBQUMsMEJBQTBCLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDekQsQ0FBQztRQUNELE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLEVBQUUsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JGLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsZ0NBQWdDLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQztRQUM3SSxNQUFNLGVBQWUsR0FBeUQ7WUFDN0UsWUFBWSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO1NBQ2pDLENBQUM7UUFFRixNQUFNLE1BQU0sR0FBaUIsRUFBRSxDQUFDO1FBQ2hDLE1BQU0sSUFBSSxDQUFDLDRCQUE0QixDQUFDLGVBQWUsRUFBRSxhQUFhLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsZUFBZSxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEssTUFBTSxNQUFNLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDO1FBQ3ZILElBQUksTUFBTSxLQUFLLGVBQWUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN4QyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsNEJBQTRCLEVBQUUsc0RBQXNELENBQUMsQ0FBQyxDQUFDO1lBQ25JLE9BQU8sSUFBSSxDQUFDLDBCQUEwQixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3pELENBQUM7UUFDRCxPQUFPLEVBQUUsZUFBZSxFQUFFLEdBQUcsRUFBRSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLFNBQVMsRUFBRSxhQUFhLENBQUMsY0FBYyxFQUFFLENBQUM7SUFDOUgsQ0FBQztJQUVPLDBCQUEwQixDQUFDLGVBQWlDO1FBQ25FLE9BQU8sRUFBRSxlQUFlLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsQ0FBQztJQUN6RixDQUFDO0lBRU8sS0FBSyxDQUFDLDRCQUE0QixDQUFDLGVBQWlDLEVBQUUsTUFBK0QsRUFBRSxTQUF3QixFQUFFLE1BQW9CLEVBQUUsVUFBOEMsRUFBRSxNQUFtQyxFQUFFLGVBQXdCLEtBQUs7UUFDaFQsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2IsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO2FBQU0sSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQzdCLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLDZFQUE2RSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDM0gsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBQ0QsTUFBTSxjQUFjLEdBQWdDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3hHLE1BQU0sZUFBZSxHQUFHLElBQUksZUFBZSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNqRSxNQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDN00sSUFBSSxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBQ3RCLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxpQ0FBeUIsQ0FBQyxFQUFFLENBQUM7WUFDM0csSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUM1QixTQUFTLEdBQUcsSUFBSSxDQUFDO1FBQ2xCLENBQUM7UUFDRCxJQUFJLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQztZQUN0QyxlQUFlLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsZ0NBQWdDLEVBQUUsdUhBQXVILENBQUMsQ0FBQyxDQUFDO1lBQy9MLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFDRCxJQUFJLFdBQVcsQ0FBQyxVQUFVLElBQUksV0FBVyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDakUsS0FBSyxNQUFNLElBQUksSUFBSSxXQUFXLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQzNDLFVBQVUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQztZQUN6QyxDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ2xFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLDJDQUEyQyxDQUFDLENBQUM7UUFDcEUsQ0FBQzthQUFNLENBQUM7WUFDUCxLQUFLLE1BQU0sSUFBSSxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDdkMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuQixDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxlQUFpQztRQUM5RCxNQUFNLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUMzRSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQXNDLEVBQUUsZUFBZSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFFLENBQUMsQ0FBQztJQUNySCxDQUFDO0lBSU8sNEJBQTRCO1FBQ25DLE1BQU0sZ0JBQWdCLEdBQXVCLEVBQUUsQ0FBQztRQUNoRCxNQUFNLHVCQUF1QixHQUF1QixFQUFFLENBQUM7UUFDdkQsSUFBSSxlQUFlLEdBQUcsZUFBZSxDQUFDLFFBQVEsQ0FBQztRQUMvQyxJQUFJLGFBQWEsbUNBQTJCLENBQUM7UUFDN0MsSUFBSSxTQUFpQyxDQUFDO1FBQ3RDLElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxpQkFBaUIsRUFBRSxrQ0FBMEIsRUFBRSxDQUFDO1lBQ3hFLE1BQU0sZUFBZSxHQUFxQixJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6RixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDdkMsZUFBZSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUNoRSxhQUFhLEdBQUcsSUFBSSxDQUFDLHlCQUF5QixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ2pFLENBQUM7YUFBTSxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsaUJBQWlCLEVBQUUscUNBQTZCLEVBQUUsQ0FBQztZQUNsRixTQUFTLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNoRCxLQUFLLE1BQU0sZUFBZSxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQzNFLElBQUksYUFBYSxLQUFLLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDO29CQUN2RSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7Z0JBQ3hDLENBQUM7cUJBQU0sQ0FBQztvQkFDUCx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7b0JBQzlDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FDckIsNEJBQTRCLEVBQzVCLDZJQUE2SSxFQUM3SSxlQUFlLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQy9CLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSx1QkFBdUIsRUFBRSxlQUFlLEVBQUUsYUFBYSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQy9GLENBQUM7SUFFTyx1QkFBdUIsQ0FBQyxlQUFpQztRQUNoRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQzNELElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNiLE9BQU8sZUFBZSxDQUFDLFFBQVEsQ0FBQztRQUNqQyxDQUFDO1FBQ0QsT0FBTyxVQUFVLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRU8seUJBQXlCLENBQUMsZUFBaUM7UUFDbEUsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUMzRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDYix3Q0FBZ0M7UUFDakMsQ0FBQztRQUNELE9BQU8sVUFBVSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNsRCxDQUFDO0lBRVMsaUJBQWlCLENBQUMsZUFBaUMsRUFBRSxNQUFlO1FBQzdFLElBQUksTUFBTSxDQUFDO1FBQ1gsSUFBSSxDQUFDLE1BQU0sS0FBSyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLGlCQUFpQixFQUFFLGlDQUF5QixDQUFDLEVBQUUsQ0FBQztZQUM3RyxNQUFNLEdBQUcsU0FBUyxDQUFDO1FBQ3BCLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLE9BQU8sQ0FBOEMsT0FBTyxFQUFFLEVBQUUsUUFBUSxFQUFFLGVBQWUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1lBQ2hKLFFBQVEsTUFBTSxFQUFFLENBQUM7Z0JBQ2hCLEtBQUssY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQzFCLElBQUksV0FBVyxDQUFDLFNBQVMsS0FBSyxXQUFXLENBQUMsb0JBQW9CLEVBQUUsQ0FBQzt3QkFDaEUsTUFBTSxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUNuRCxDQUFDO29CQUNELE1BQU07Z0JBQ1AsQ0FBQztnQkFDRCxLQUFLLGNBQWMsQ0FBQyxTQUFTO29CQUFFLE1BQU0sR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO29CQUFDLE1BQU07Z0JBQ25HLEtBQUssY0FBYyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7b0JBQ25DLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLGlCQUFpQixFQUFFLHFDQUE2QixDQUFDOzJCQUN2RSxDQUFDLFdBQVcsQ0FBQyxvQkFBb0IsS0FBSyxXQUFXLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQzt3QkFDdkUsTUFBTSxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLGNBQWMsQ0FBQyxDQUFDO29CQUN4RCxDQUFDO29CQUNELE1BQU07Z0JBQ1AsQ0FBQztnQkFDRCxPQUFPLENBQUMsQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNiLE9BQU8sRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxLQUFLLEVBQUUsQ0FBQztRQUNyRCxDQUFDO1FBQ0QsbURBQW1EO1FBQ25ELE1BQU0sV0FBVyxHQUFjLE1BQWMsQ0FBQyxZQUFZLENBQUM7UUFDM0QsSUFBSSxXQUFXLEVBQUUsQ0FBQztZQUNqQixJQUFJLFVBQVUsR0FBRyxLQUFLLENBQUM7WUFDdkIsS0FBSyxNQUFNLFVBQVUsSUFBSSxXQUFXLEVBQUUsQ0FBQztnQkFDdEMsSUFBSSxjQUFjLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7b0JBQ3JDLFVBQVUsR0FBRyxJQUFJLENBQUM7b0JBQ2xCLE1BQU07Z0JBQ1AsQ0FBQztZQUNGLENBQUM7WUFDRCxJQUFJLFVBQVUsRUFBRSxDQUFDO2dCQUNoQixJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsNEJBQTRCLEVBQUUsMkdBQTJHLENBQUMsQ0FBQyxDQUFDO2dCQUNuSyxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyw0QkFBNEIsRUFBRSwyR0FBMkcsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hNLE9BQU8sRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsQ0FBQztZQUNwRCxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxLQUFLLEVBQUUsQ0FBQztJQUNsRCxDQUFDO0lBRU0sVUFBVTtRQUNoQixJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN0QixPQUFPLElBQUksQ0FBQyxXQUFXLFlBQVksa0JBQWtCLENBQUM7UUFDdkQsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLGdCQUFnQixLQUFLLGVBQWUsQ0FBQyxRQUFRLENBQUM7SUFDM0QsQ0FBQztJQUVNLGVBQWU7UUFDckIsTUFBTSxXQUFXLEdBQXdCLElBQUksQ0FBQztRQUM5QyxPQUFPLElBQUksS0FBTSxTQUFRLE1BQU07WUFDOUI7Z0JBQ0MsS0FBSyxDQUFDLG1CQUFtQixDQUFDLEVBQUUsRUFBRSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsV0FBVyxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNoSyxDQUFDO1NBQ0QsQ0FBQztJQUNILENBQUM7SUFFTyxZQUFZLENBQUMsR0FBUTtRQUM1QixJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUM7UUFDdEIsSUFBSSxHQUFHLFlBQVksU0FBUyxFQUFFLENBQUM7WUFDOUIsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDO1lBQ3ZCLE1BQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxJQUFJLHFDQUE2QixJQUFJLFVBQVUsQ0FBQyxJQUFJLG1DQUEyQixJQUFJLFVBQVUsQ0FBQyxJQUFJLGtDQUEwQixDQUFDO1lBQzVKLE1BQU0sY0FBYyxHQUFHLFVBQVUsQ0FBQyxJQUFJLG1DQUEyQixDQUFDO1lBQ2xFLElBQUksV0FBVyxJQUFJLGNBQWMsRUFBRSxDQUFDO2dCQUNuQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUMxRSxLQUFLLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLHVCQUF1QixFQUFFLGdCQUFnQixDQUFDO3dCQUM3RyxHQUFHLEVBQUUsR0FBRyxFQUFFOzRCQUNULElBQUksV0FBVyxFQUFFLENBQUM7Z0NBQ2pCLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDOzRCQUMzQixDQUFDO2lDQUFNLENBQUM7Z0NBQ1AsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7NEJBQzdCLENBQUM7d0JBQ0YsQ0FBQztxQkFDRCxDQUFDLENBQUMsQ0FBQztZQUNMLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ2xHLENBQUM7UUFDRixDQUFDO2FBQU0sSUFBSSxHQUFHLFlBQVksS0FBSyxFQUFFLENBQUM7WUFDakMsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDO1lBQ2xCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQy9DLFVBQVUsR0FBRyxLQUFLLENBQUM7UUFDcEIsQ0FBQzthQUFNLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ2hDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQVMsR0FBRyxDQUFDLENBQUM7UUFDOUMsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMseUJBQXlCLEVBQUUsdUVBQXVFLENBQUMsQ0FBQyxDQUFDO1FBQ25KLENBQUM7UUFDRCxJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUM3QyxDQUFDO0lBQ0YsQ0FBQztJQUVPLFdBQVc7UUFDbEIsT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxDQUFVLHVCQUF1QixDQUFDLENBQUM7SUFDOUUsQ0FBQztJQUVPLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxLQUFhLEVBQUUsUUFBaUIsS0FBSyxFQUFFLE9BQWdCLEtBQUssRUFBRSxhQUFtQyxFQUFFLGlCQUEwQixJQUFJO1FBQzFLLElBQUksZ0JBQWdCLEdBQTZDLEVBQUUsQ0FBQztRQUNwRSxJQUFJLEtBQUssS0FBSyxTQUFTLElBQUksS0FBSyxLQUFLLElBQUksSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ2pFLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztRQUNELE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxJQUFVLEVBQXVCLEVBQUU7WUFDOUQsTUFBTSxRQUFRLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUN4SyxJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUNoQyxJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQzdDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksTUFBTSxDQUFDO2dCQUMvQyxDQUFDO2dCQUNELFFBQVEsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxHQUFHLEdBQUcsQ0FBQztZQUNuRyxDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNqQyxDQUFDO1lBQ0QsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMxQyxPQUFPLFFBQVEsQ0FBQztRQUVqQixDQUFDLENBQUM7UUFDRixTQUFTLFdBQVcsQ0FBQyxPQUE4QyxFQUFFLEtBQWEsRUFBRSxVQUFrQjtZQUNyRyxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDbEIsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7WUFDeEQsQ0FBQztZQUNELEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFLENBQUM7Z0JBQzFCLE1BQU0sS0FBSyxHQUF3QixrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDNUQsS0FBSyxDQUFDLE9BQU8sR0FBRyxDQUFDLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsRUFBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxlQUFlLEVBQUUsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ3BJLElBQUksYUFBYSxJQUFJLENBQUMsSUFBSSxLQUFLLGFBQWEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO29CQUNwRCxPQUFPLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUNoQyxDQUFDO3FCQUFNLENBQUM7b0JBQ1AsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDckIsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBQ0QsSUFBSSxPQUE4QixDQUFDO1FBQ25DLElBQUksS0FBSyxFQUFFLENBQUM7WUFDWCxPQUFPLEdBQUcsRUFBRSxDQUFDO1lBQ2IsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUN4QixPQUFPLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUNqRSxNQUFNLE1BQU0sR0FBVyxFQUFFLENBQUM7Z0JBQzFCLE1BQU0sU0FBUyxHQUFnQixJQUFJLEdBQUcsRUFBRSxDQUFDO2dCQUN6QyxJQUFJLFVBQVUsR0FBVyxFQUFFLENBQUM7Z0JBQzVCLElBQUksUUFBUSxHQUFXLEVBQUUsQ0FBQztnQkFDMUIsTUFBTSxPQUFPLEdBQTRCLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzdELEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ3BCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztvQkFDbkMsSUFBSSxHQUFHLEVBQUUsQ0FBQzt3QkFDVCxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDO29CQUNyQixDQUFDO2dCQUNGLENBQUMsQ0FBQyxDQUFDO2dCQUNILGlCQUFpQixDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRTtvQkFDaEQsTUFBTSxHQUFHLEdBQUcsVUFBVSxDQUFDLGVBQWUsRUFBRSxDQUFDO29CQUN6QyxJQUFJLEdBQUcsRUFBRSxDQUFDO3dCQUNULFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7d0JBQ25CLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQzt3QkFDMUIsSUFBSSxJQUFJLEVBQUUsQ0FBQzs0QkFDVixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO3dCQUNuQixDQUFDO29CQUNGLENBQUM7Z0JBQ0YsQ0FBQyxDQUFDLENBQUM7Z0JBQ0gsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDMUIsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO29CQUNuQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO3dCQUNqQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssY0FBYyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7NEJBQ3JHLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ3ZCLENBQUM7NkJBQU0sQ0FBQzs0QkFDUCxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO3dCQUNyQixDQUFDO29CQUNGLENBQUM7Z0JBQ0YsQ0FBQztnQkFDRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQ25DLElBQUksY0FBYyxFQUFFLENBQUM7b0JBQ3BCLFdBQVcsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFLHFCQUFxQixDQUFDLENBQUMsQ0FBQztnQkFDbkYsQ0FBQztnQkFDRCxVQUFVLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzdELFdBQVcsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFLGtCQUFrQixDQUFDLENBQUMsQ0FBQztnQkFDakYsUUFBUSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN6RCxXQUFXLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7WUFDNUUsQ0FBQztRQUNGLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxJQUFJLEVBQUUsQ0FBQztnQkFDVixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQ25DLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNwRCxDQUFDO1lBQ0QsT0FBTyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQXNCLElBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUM1RSxDQUFDO1FBQ0QsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO1FBQ3RCLE9BQU8sT0FBTyxDQUFDO0lBQ2hCLENBQUM7SUFDTyxLQUFLLENBQUMsc0JBQXNCLENBQUMsV0FBbUIsRUFBRSxZQUFrQyxFQUFFLElBQWEsRUFBRSxJQUFhO1FBQ3pILE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDN0csQ0FBQztJQUVPLEtBQUssQ0FBQyxjQUFjLENBQUMsS0FBK0IsRUFBRSxXQUFtQixFQUFFLFlBQWtDLEVBQUUsUUFBaUIsS0FBSyxFQUFFLE9BQWdCLEtBQUssRUFBRSxhQUFtQyxFQUFFLGlCQUF5QyxFQUFFLElBQWE7UUFDbFEsTUFBTSxhQUFhLEdBQUcsTUFBTSxLQUFLLENBQUM7UUFDbEMsTUFBTSxPQUFPLEdBQThELE1BQU0sV0FBVyxDQUFDLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxhQUFhLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxhQUFhLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDaE0sSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2QsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUNELElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBVSxxQkFBcUIsQ0FBQyxFQUFFLENBQUM7WUFDakcsT0FBNkIsT0FBTyxDQUFDLENBQUMsQ0FBRSxDQUFDO1FBQzFDLENBQUM7YUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUNuRCxPQUFPLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzVCLENBQUM7YUFBTSxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLGlCQUFpQixJQUFJLGlCQUFpQixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNwRixPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMvQyxPQUFPLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEMsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FDbEMsT0FBTyxFQUNQO1lBQ0MsS0FBSyxFQUFFLElBQUk7WUFDWCxXQUFXO1lBQ1gsa0JBQWtCLEVBQUUsSUFBSTtZQUN4QixzQkFBc0IsRUFBRSxPQUFPLENBQUMsRUFBRTtnQkFDakMsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Z0JBQy9CLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDakMsSUFBSSxlQUFlLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQzlCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDdkMsQ0FBQztxQkFBTSxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztvQkFDaEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDdkIsQ0FBQztZQUNGLENBQUM7U0FDRCxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8sMEJBQTBCO1FBQ2pDLE9BQU8sQ0FBQyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsWUFBWSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ3pHLENBQUM7SUFFTyxLQUFLLENBQUMsbUJBQW1CLENBQUMsS0FBYTtRQUM5QyxJQUFJLENBQUMsSUFBSSxDQUFDLDBCQUEwQixFQUFFLEVBQUUsQ0FBQztZQUN4QyxPQUFPO1FBQ1IsQ0FBQztRQUNELE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7UUFDeEQsTUFBTSxPQUFPLEdBQTRCLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0QsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNwQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDMUIsSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDVCxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDO1lBQ3JCLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztRQUNILE1BQU0sUUFBUSxHQUFHLENBQUMsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3pELEtBQUssTUFBTSxHQUFHLElBQUksUUFBUSxFQUFFLENBQUM7WUFDNUIsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzFCLElBQUksSUFBSSxFQUFFLENBQUM7Z0JBQ1YsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDdkMsQ0FBQztRQUNGLENBQUM7UUFDRCxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxxQkFBbUIsQ0FBQyxxQkFBcUIsaUNBQXlCLENBQUM7SUFDaEcsQ0FBQztJQUVPLDBCQUEwQjtRQUNqQyxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDMUUsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ25DLENBQUM7UUFFRCxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUMvQixRQUFRLENBQUMsSUFBSSxFQUNiLEdBQUcsQ0FBQyxRQUFRLENBQUMsMkJBQTJCLEVBQUUsb0ZBQW9GLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFDekwsQ0FBQztnQkFDQSxLQUFLLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSxrQkFBa0IsQ0FBQztnQkFDL0QsV0FBVyxFQUFFLElBQUk7Z0JBQ2pCLEdBQUcsRUFBRSxHQUFHLEVBQUU7b0JBQ1QsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMscUJBQW1CLENBQUMsK0JBQStCLEVBQUUsSUFBSSxnRUFBZ0QsQ0FBQztvQkFDckksSUFBSSxDQUFDLGtCQUFrQixHQUFHLEtBQUssQ0FBQztnQkFDakMsQ0FBQzthQUNELENBQUMsQ0FDRixDQUFDO1FBRUYsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFTyxLQUFLLENBQUMsTUFBTTtRQUNuQixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQztRQUN2RSxJQUFJLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLDZCQUE2QixFQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pILE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELE1BQU0sSUFBSSxDQUFDLGdDQUFnQyxDQUFDLHlCQUF5QixDQUFDO1FBQ3RFLElBQUksQ0FBQyxJQUFJLENBQUMsZ0NBQWdDLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxDQUFDO1lBQ2pFLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxxQkFBcUIsQ0FDckU7Z0JBQ0MsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsMEJBQTBCLEVBQUUsa0dBQWtHLENBQUM7YUFDckosQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDO1FBQ2YsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVPLEtBQUssQ0FBQyxlQUFlLENBQUMsTUFBaUM7UUFDOUQsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQzdCLE9BQU87UUFDUixDQUFDO1FBQ0QsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2IsT0FBTyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUNqQyxDQUFDO1FBQ0QsTUFBTSxJQUFJLEdBQUcsT0FBTyxNQUFNLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDbEUsTUFBTSxRQUFRLEdBQUcsT0FBTyxNQUFNLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDbkUsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3RELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNuRCxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDNUIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMvQyxNQUFNLFVBQVUsR0FBcUIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzNHLElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxpQkFBaUIsRUFBRSxxQ0FBNkIsRUFBRSxDQUFDO1lBQzNFLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxhQUFjLENBQUMsQ0FBQztRQUNyRSxDQUFDO1FBQ0QsVUFBVSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ3RDLElBQUksVUFBVSxFQUFFLENBQUM7WUFDaEIsS0FBSyxNQUFNLEdBQUcsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDOUIsTUFBTSxJQUFJLEdBQUcsTUFBTSxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQztnQkFDckQsSUFBSSxJQUFJLEVBQUUsQ0FBQztvQkFDVixJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUNmLE9BQU87Z0JBQ1IsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBQ0QsTUFBTSxjQUFjLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQyxVQUFVLEtBQUssUUFBUSxJQUFJLENBQUMsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUUsdUJBQXVCLEVBQUUsVUFBVSxLQUFLLFFBQVEsQ0FBQyxDQUFDO1FBQzdMLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUNyQixPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3RELENBQUM7UUFDRCxLQUFLLE1BQU0sR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQzlCLE1BQU0sSUFBSSxHQUFHLE1BQU0sUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDbkQsSUFBSSxJQUFJLEVBQUUsQ0FBQztnQkFDVixNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUUsb0JBQW9CLEVBQUUsSUFBSSxFQUFFLDZCQUFxQixDQUFDO2dCQUN6RSxPQUFPO1lBQ1IsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRU8scUJBQXFCLENBQUMsTUFBb0I7UUFDakQsSUFBSSxDQUFDLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQy9DLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBUyxFQUFFLENBQUMsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLE9BQU8sRUFBRSxDQUFDLEVBQUUsQ0FBQztRQUN4RixDQUFDO1FBQ0QsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlDLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUNsQyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUM3QixPQUFPLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNsQixDQUFDO1lBQ0QsTUFBTSxNQUFNLEdBQVcsRUFBRSxDQUFDO1lBQzFCLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtnQkFDckIsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDMUIsSUFBSSxlQUFlLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQzt3QkFDbkUsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDbkIsQ0FBQzt5QkFBTSxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQzt3QkFDaEMsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQzs0QkFDL0IsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzt3QkFDbkIsQ0FBQzs2QkFBTSxDQUFDOzRCQUNQLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQzs0QkFDckMsSUFBSSxVQUFVLElBQUksVUFBVSxDQUFDLElBQUksS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7Z0NBQ25ELE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7NEJBQ25CLENBQUM7d0JBQ0YsQ0FBQztvQkFDRixDQUFDO2dCQUNGLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQztZQUNILE9BQU8sTUFBTSxDQUFDO1FBQ2YsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxDQUFDO0lBQzNCLENBQUM7SUFFTyxpQkFBaUIsQ0FBQyxLQUFjLEVBQUUsSUFBYSxFQUFFLElBQWE7UUFDckUsTUFBTSxRQUFRLEdBQUcsQ0FBQyxJQUE2QixFQUFFLEVBQUU7WUFDbEQsSUFBSSxJQUFJLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQ3hCLE9BQU87WUFDUixDQUFDO1lBQ0QsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQ25CLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQzNCLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLG9CQUFvQixFQUFFLElBQUksRUFBRSw2QkFBcUIsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxFQUFFO29CQUMzRiwwRkFBMEY7Z0JBQzNGLENBQUMsQ0FBQyxDQUFDO1lBQ0osQ0FBQztRQUNGLENBQUMsQ0FBQztRQUVGLE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMseUJBQXlCLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztRQUV0RixJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO1lBQzNDLElBQUksSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDO2dCQUMxRCxJQUFJLFVBQVUsR0FBc0UsU0FBUyxDQUFDO2dCQUM5RixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7b0JBQ1osVUFBVSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO2dCQUMzQyxDQUFDO2dCQUNELElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFVBQVcsQ0FBQyxLQUFLLEVBQUUsV0FBVyxFQUNqRTtvQkFDQyxLQUFLLEVBQUUsVUFBVSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsMEJBQTBCLEVBQUUsa0JBQWtCLENBQUM7b0JBQ2hGLElBQUksRUFBRSxJQUFJO2lCQUNWLEVBQ0QsSUFBSSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQztvQkFDNUMsSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7b0JBQ2QsT0FBTyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDakQsQ0FBQyxDQUFDLENBQUM7WUFDTCxDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFdBQVcsRUFDdEM7b0JBQ0MsS0FBSyxFQUFFLFVBQVUsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLDBCQUEwQixFQUFFLGtCQUFrQixDQUFDO29CQUNoRixJQUFJLEVBQUUsSUFBSTtpQkFDVixFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7b0JBQ2QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2pCLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFHRCxLQUFLLENBQUMsS0FBSyxDQUFDLGtCQUEwQjtRQUNyQyxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLEVBQUUsa0JBQWtCLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUM1RSxJQUFJLElBQUksRUFBRSxDQUFDO1lBQ1YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQixDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM5QixDQUFDO0lBQ0YsQ0FBQztJQUVPLGlCQUFpQixDQUFDLFNBQW1CO1FBRTVDLHNCQUFzQixDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDMUMsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxFQUFFLE1BQU0seUJBQWlCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUU7Z0JBQ3pFLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDcEQsSUFBSSxhQUFhLEVBQUUsQ0FBQztvQkFDbkIsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsYUFBYSxDQUFDLENBQUM7Z0JBQ2pELENBQUM7cUJBQU0sQ0FBQztvQkFDUCxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7d0JBQ2pELDhDQUE4Qzt3QkFDOUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7b0JBQzFCLENBQUM7b0JBQ0QsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNuQyxDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNLLGdCQUFnQixDQUFDLEtBQWEsRUFBRSxrQkFBMkIsS0FBSztRQUN2RSxNQUFNLFFBQVEsR0FBVyxFQUFFLENBQUM7UUFDNUIsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3pFLHNIQUFzSDtZQUN0SCxJQUFJLGVBQWUsSUFBSSxPQUFRLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFtQixDQUFDLFNBQVMsS0FBSyxRQUFRLEVBQUUsQ0FBQztnQkFDeEcsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNyQixDQUFDO2lCQUFNLElBQUksQ0FBQyxlQUFlLElBQUssSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQW1CLENBQUMsU0FBUyxLQUFLLElBQUksRUFBRSxDQUFDO2dCQUNyRyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3JCLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxRQUFRLENBQUM7SUFDakIsQ0FBQztJQUVPLG9CQUFvQixDQUFDLFNBQW9CLEVBQUUsT0FJbEQsRUFBRSxTQUFxQixFQUFFLGFBQXlCO1FBQ2xELElBQUksSUFBSSxDQUFDLGFBQWEscUNBQTZCLEVBQUUsQ0FBQztZQUNyRCxhQUFhLEVBQUUsQ0FBQztZQUNoQixPQUFPO1FBQ1IsQ0FBQztRQUNELE1BQU0sT0FBTyxHQUFxQjtZQUNqQyxRQUFRLGtDQUF5QjtZQUNqQyxLQUFLLEVBQUUsT0FBTyxDQUFDLFFBQVE7U0FDdkIsQ0FBQztRQUNGLE1BQU0sT0FBTyxHQUFHLENBQUMsS0FBSyxJQUFJLEVBQUU7WUFFM0IsS0FBSyxVQUFVLGFBQWEsQ0FBQyxJQUFzQixFQUFFLHFCQUE0RCxFQUFFLElBQXlCO2dCQUMzSSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxxQkFBcUIsNkJBQXFCLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsRUFBRTtvQkFDbEYsMEZBQTBGO2dCQUMzRixDQUFDLENBQUMsQ0FBQztZQUNKLENBQUM7WUFDRCxNQUFNLGdCQUFnQixHQUFHLENBQUMsS0FBYSxFQUFFLEVBQUU7Z0JBQzFDLElBQUksQ0FBQywwQkFBMEIsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUU7b0JBQzNDLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUN4QixPQUFPLENBQUMsTUFBTSxFQUNkO3dCQUNDLEtBQUssRUFBRSxPQUFPLENBQUMsaUJBQWlCO3dCQUNoQyxJQUFJLEVBQUUsSUFBSTtxQkFDVixFQUNELElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO3dCQUNwQixNQUFNLElBQUksR0FBNEIsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7d0JBQ3JFLElBQUksSUFBSSxLQUFLLFNBQVMsRUFBRSxDQUFDOzRCQUN4QixPQUFPO3dCQUNSLENBQUM7d0JBQ0QsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFLENBQUM7NEJBQ25CLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7NEJBQ3RCLE9BQU87d0JBQ1IsQ0FBQzt3QkFDRCxhQUFhLENBQUMsSUFBSSxFQUFFLEVBQUUsb0JBQW9CLEVBQUUsSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBQzNELENBQUMsQ0FBQyxDQUFDO2dCQUNMLENBQUMsQ0FBQyxDQUFDO1lBQ0osQ0FBQyxDQUFDO1lBQ0YsSUFBSSxVQUFVLEdBQStCLEVBQUUsQ0FBQztZQUNoRCxNQUFNLEVBQUUsY0FBYyxFQUFFLGlCQUFpQixFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN0RixVQUFVLEdBQUcsQ0FBQyxHQUFHLGNBQWMsQ0FBQyxDQUFDO1lBQ2pDLElBQUksQ0FBQyxpQkFBaUIsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUNuRCxVQUFVLEdBQUcsTUFBTSxJQUFJLENBQUMsMEJBQTBCLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3JFLENBQUM7WUFFRCxNQUFNLG1CQUFtQixHQUFHLENBQUMsWUFBcUIsRUFBRSxFQUFFO2dCQUNyRCxPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtvQkFDdkQsSUFBSSxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO3dCQUN0Qix3RUFBd0U7d0JBQ3hFLDZEQUE2RDt3QkFDN0QsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxZQUFZLENBQUMsQ0FBQzt3QkFDNUQsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDOzRCQUMzQixhQUFhLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQzs0QkFDNUMsT0FBTzt3QkFDUixDQUFDOzZCQUFNLElBQUksUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQzs0QkFDaEMsS0FBSyxHQUFHLFFBQVEsQ0FBQzt3QkFDbEIsQ0FBQztvQkFDRixDQUFDO29CQUVELCtDQUErQztvQkFDL0MsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3pCLENBQUMsQ0FBQyxDQUFDO1lBQ0osQ0FBQyxDQUFDO1lBRUYsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLGFBQXFDLEVBQUUsRUFBRTtnQkFDbkUsSUFBSSxlQUFlLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7b0JBQ3ZDLElBQUksQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFO3dCQUN0RCxhQUFhLENBQUMsWUFBWSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDOUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ0osQ0FBQztxQkFBTSxDQUFDO29CQUNQLGFBQWEsQ0FBQyxhQUFhLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUMvQyxDQUFDO1lBQ0YsQ0FBQyxDQUFDO1lBRUYsZ0VBQWdFO1lBQ2hFLElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDN0IsT0FBTyxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6QyxDQUFDO1lBRUQsd0ZBQXdGO1lBQ3hGLG9HQUFvRztZQUNwRyx1Q0FBdUM7WUFDdkMsSUFBSSxpQkFBaUIsSUFBSSxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUNoRCxPQUFPLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2xDLENBQUM7WUFFRCw0RkFBNEY7WUFDNUYsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDeEIsVUFBVSxHQUFHLE1BQU0sSUFBSSxDQUFDLDBCQUEwQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNyRSxDQUFDO1lBRUQsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUM3QiwyREFBMkQ7Z0JBQzNELE9BQU8saUJBQWlCLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDekMsQ0FBQztZQUNELHdEQUF3RDtZQUN4RCxPQUFPLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ25DLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDTCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBRU8sS0FBSyxDQUFDLGFBQWEsQ0FBQyxXQUFtQjtRQUM5QyxJQUFJLGlCQUFpQixHQUFHLEtBQUssQ0FBQztRQUM5QixnRkFBZ0Y7UUFDaEYsTUFBTSxXQUFXLEdBQUcsc0JBQXNCLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDNUYsSUFBSSxXQUFXLEVBQUUsQ0FBQztZQUNqQixNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzdFLElBQUksZUFBZSxFQUFFLENBQUM7Z0JBQ3JCLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUMsRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDO2dCQUMvRSxJQUFJLGVBQWUsRUFBRSxDQUFDO29CQUNyQixpQkFBaUIsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxPQUFPLElBQUksQ0FBQyxLQUFLLEtBQUssUUFBUSxJQUFJLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEtBQUssUUFBUSxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztvQkFDeEosb0VBQW9FO29CQUNwRSxJQUFJLGlCQUFpQixFQUFFLENBQUM7d0JBQ3ZCLHFHQUFxRzt3QkFDckcsTUFBTSxZQUFZLEdBQUcsZUFBZSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsV0FBVyxDQUFDLElBQUksV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO3dCQUU5SSxNQUFNLGNBQWMsR0FBRyxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFOzRCQUM5RCxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUM7NEJBQzVELElBQUksZ0JBQWdCLElBQUksT0FBTyxnQkFBZ0IsS0FBSyxRQUFRLElBQUksT0FBTyxnQkFBZ0IsQ0FBQyxTQUFTLEtBQUssUUFBUSxFQUFFLENBQUM7Z0NBQ2hILE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLEtBQUssV0FBVyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLFlBQVksRUFBRSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7NEJBQzdILENBQUM7NEJBRUQsaUJBQWlCLEdBQUcsS0FBSyxDQUFDOzRCQUMxQixPQUFPLEtBQUssQ0FBQzt3QkFDZCxDQUFDLENBQUMsQ0FBQzt3QkFDSCxPQUFPLEVBQUUsY0FBYyxFQUFFLGlCQUFpQixFQUFFLENBQUM7b0JBQzlDLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxFQUFFLGNBQWMsRUFBRSxFQUFFLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQztJQUVsRCxDQUFDO0lBRU8sZ0JBQWdCO1FBQ3ZCLElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUM3QixPQUFPO1FBQ1IsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUU7WUFDakQsUUFBUSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsZ0NBQWdDLEVBQUUseUJBQXlCLENBQUM7WUFDbkYsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsMkJBQTJCLEVBQUUsOEJBQThCLENBQUM7WUFDakYsaUJBQWlCLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSxxREFBcUQsQ0FBQztTQUNqSCxFQUFFLElBQUksQ0FBQyw2QkFBNkIsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVPLGVBQWU7UUFDdEIsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRTtZQUNoRCxRQUFRLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQywrQkFBK0IsRUFBRSx3QkFBd0IsQ0FBQztZQUNqRixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQywwQkFBMEIsRUFBRSw2QkFBNkIsQ0FBQztZQUMvRSxpQkFBaUIsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLGdDQUFnQyxFQUFFLCtDQUErQyxDQUFDO1NBQ2xILEVBQUUsSUFBSSxDQUFDLDRCQUE0QixFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lBRU8sb0JBQW9CLENBQUMsR0FBOEI7UUFDMUQsSUFBSSxHQUFHLEtBQUssY0FBYyxFQUFFLENBQUM7WUFDNUIsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3JCLE9BQU87UUFDUixDQUFDO1FBQ0QsTUFBTSxZQUFZLEdBQUcsQ0FBQyxPQUF5QixFQUFFLEVBQUU7WUFDbEQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxFQUNuRCxHQUFHLENBQUMsUUFBUSxDQUFDLDZCQUE2QixFQUFFLDRCQUE0QixDQUFDLEVBQ3pFO2dCQUNDLEtBQUssRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLDJCQUEyQixFQUFFLDhCQUE4QixDQUFDO2dCQUNoRixJQUFJLEVBQUUsU0FBUzthQUNmLEVBQ0QsS0FBSyxFQUFFLElBQUksRUFDWCxTQUFTLEVBQ1QsQ0FBQztvQkFDQSxLQUFLLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxzQ0FBc0MsRUFBRSxtQkFBbUIsQ0FBQztvQkFDaEYsRUFBRSxFQUFFLGNBQWM7b0JBQ2xCLElBQUksRUFBRSxTQUFTO2lCQUNmLENBQUMsQ0FDRixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDZCxJQUFJLEtBQUssSUFBSSxLQUFLLENBQUMsRUFBRSxLQUFLLGNBQWMsRUFBRSxDQUFDO29CQUMxQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7Z0JBQ3RCLENBQUM7Z0JBQ0QsTUFBTSxJQUFJLEdBQTRCLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO2dCQUNyRSxJQUFJLElBQUksS0FBSyxTQUFTLElBQUksSUFBSSxLQUFLLElBQUksRUFBRSxDQUFDO29CQUN6QyxPQUFPO2dCQUNSLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN0QixDQUFDLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQztRQUNGLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUM7WUFDdkIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2hELElBQUksT0FBd0IsQ0FBQztZQUM3QixJQUFJLFVBQVUsS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDOUIsT0FBTyxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFDaEMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO29CQUN0QixLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDO3dCQUMxQixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQzs0QkFDOUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQzs0QkFDckIsT0FBTzt3QkFDUixDQUFDO29CQUNGLENBQUM7b0JBQ0QsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUN2QixDQUFDLENBQUMsQ0FBQztZQUNKLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxZQUFZLEVBQUUsQ0FBQztZQUNoQixDQUFDO1FBQ0YsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7Z0JBQ2hDLElBQUksTUFBTSxFQUFFLENBQUM7b0JBQ1osSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxFQUFFO3dCQUN2QyxzQ0FBc0M7d0JBQ3RDLE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDOUIsSUFBSSxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7NEJBQ3RCLE9BQU87d0JBQ1IsQ0FBQzt3QkFDRCxJQUFJLFFBQVEsQ0FBQyxJQUFJLElBQUksUUFBUSxDQUFDLElBQUksa0RBQTBDLEVBQUUsQ0FBQzs0QkFDOUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLDJCQUEyQixFQUFFLHVJQUF1SSxDQUFDLENBQUMsQ0FBQzt3QkFDck4sQ0FBQzs2QkFBTSxDQUFDOzRCQUNQLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyx3QkFBd0IsRUFBRSxrQ0FBa0MsQ0FBQyxDQUFDLENBQUM7d0JBQzdHLENBQUM7b0JBQ0YsQ0FBQyxDQUFDLENBQUM7Z0JBQ0osQ0FBQztZQUNGLENBQUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQztJQUNGLENBQUM7SUFFTyxLQUFLLENBQUMsc0JBQXNCLENBQUMsR0FBOEI7UUFFbEUsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFFaEQsSUFBSSxXQUFXLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDOUIsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBQ3ZCLHdDQUF3QztZQUN4QyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDaEQsSUFBSSxVQUFVLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQzlCLEtBQUssTUFBTSxJQUFJLElBQUksV0FBVyxFQUFFLENBQUM7b0JBQ2hDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO3dCQUM5QixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO3dCQUNwQixPQUFPO29CQUNSLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7WUFDRCxvQ0FBb0M7WUFDcEMsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUN0QyxXQUFXLEVBQ1gsR0FBRyxDQUFDLFFBQVEsQ0FBQywyQkFBMkIsRUFBRSw0QkFBNEIsQ0FBQyxFQUN2RTtnQkFDQyxLQUFLLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyw2QkFBNkIsRUFBRSxvQkFBb0IsQ0FBQztnQkFDeEUsSUFBSSxFQUFFLElBQUk7YUFDVixFQUNELEtBQUssRUFDTCxJQUFJLENBQ0osQ0FBQztZQUNGLElBQUksS0FBSyxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDekIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDM0IsQ0FBQztRQUNGLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUM1QixJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQy9CLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVPLEtBQUssQ0FBQywrQkFBK0I7UUFDNUMsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFFaEQsSUFBSSxXQUFXLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyw0QkFBNEIsRUFBRSw2QkFBNkIsQ0FBQyxDQUFDLENBQUM7WUFDMUcsT0FBTztRQUNSLENBQUM7UUFFRCwyQkFBMkI7UUFDM0IsTUFBTSxlQUFlLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNyRSxNQUFNLE9BQU8sQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUVPLGtCQUFrQixDQUFDLE1BQWlDO1FBQzNELElBQUksTUFBTSxHQUE2QyxTQUFTLENBQUM7UUFDakUsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDNUIsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNqQixDQUFDO2FBQU0sSUFBSSxNQUFNLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUNsRCxNQUFNLEdBQUcsY0FBYyxDQUFDLG9CQUFvQixDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMvRCxDQUFDO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBRU8sZUFBZSxDQUFDLFVBQXdEO1FBQy9FLE9BQU8sQ0FBQyxDQUFDLFVBQVUsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDMUUsQ0FBQztJQUVPLGFBQWEsQ0FBQyxRQUFhLEVBQUUsVUFBa0I7UUFDdEQsSUFBSSxpQkFBaUIsR0FBRyxLQUFLLENBQUM7UUFDOUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtZQUMxRixNQUFNLFVBQVUsR0FBWSxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ25DLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLENBQThDLE9BQU8sRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDM0gsSUFBSSxnQkFBeUIsQ0FBQztZQUM5QixJQUFJLE1BQTJCLENBQUM7WUFDaEMsUUFBUSxVQUFVLEVBQUUsQ0FBQztnQkFDcEIsS0FBSyxjQUFjLENBQUMsSUFBSTtvQkFBRSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFBQyxNQUFNLG1DQUEyQixDQUFDO29CQUFDLE1BQU07Z0JBQ25JLEtBQUssY0FBYyxDQUFDLGFBQWE7b0JBQUUsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLENBQUM7b0JBQUMsTUFBTSx3Q0FBZ0MsQ0FBQztvQkFBQyxNQUFNO2dCQUN0SjtvQkFBUyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO29CQUFDLE1BQU0sK0NBQXVDLENBQUM7WUFDbkksQ0FBQztZQUNELElBQUksT0FBTyxDQUFDO1lBQ1osSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7Z0JBQ3ZCLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSx3QkFBd0IsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDbkssSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7b0JBQ3pCLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDbkMsQ0FBQztnQkFDRCxPQUFPLEdBQUcsa0JBQWtCLENBQUMsT0FBTyxDQUFDO2dCQUNyQyxtREFBbUQ7Z0JBQ25ELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLEVBQVMsQ0FBQztnQkFDbEUsSUFBSSxZQUFZLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO29CQUN0QyxPQUFPLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ2xILENBQUM7Z0JBQ0QsaUJBQWlCLEdBQUcsSUFBSSxDQUFDO1lBQzFCLENBQUM7WUFFRCxJQUFJLENBQUMsVUFBVSxJQUFJLE9BQU8sRUFBRSxDQUFDO2dCQUM1QixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtvQkFDakYsT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO2dCQUMzQixDQUFDLENBQUMsQ0FBQztZQUNKLENBQUM7aUJBQU0sSUFBSSxVQUFVLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUN4RCxNQUFNLFlBQVksR0FBRyxJQUFJLEVBQUUsUUFBUSxDQUFDO2dCQUNwQyxJQUFJLE9BQU8sSUFBSSxZQUFZLEVBQUUsQ0FBQztvQkFDN0IsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDMUcsQ0FBQztnQkFDRCxPQUFPLFlBQVksQ0FBQztZQUNyQixDQUFDO1lBQ0QsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUU7WUFDcEIsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNmLE9BQU87WUFDUixDQUFDO1lBQ0QsSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUM7Z0JBQzlCLFFBQVE7Z0JBQ1IsT0FBTyxFQUFFO29CQUNSLE1BQU0sRUFBRSxpQkFBaUIsQ0FBQywyQ0FBMkM7aUJBQ3JFO2FBQ0QsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU8sWUFBWSxDQUFDLEtBQXFCO1FBQ3pDLG1EQUFtRDtRQUNuRCxNQUFNLFNBQVMsR0FBb0MsS0FBWSxDQUFDO1FBQ2hFLE9BQU8sU0FBUyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO0lBQ3RDLENBQUM7SUFFTyxlQUFlLENBQUMsS0FBcUI7UUFDNUMsbURBQW1EO1FBQ25ELE1BQU0sU0FBUyxHQUE2QyxLQUFZLENBQUM7UUFDekUsT0FBTyxTQUFTLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUM7SUFDN0MsQ0FBQztJQUVPLGNBQWMsQ0FBQyxJQUFVO1FBQ2hDLElBQUksZUFBZSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN2QyxDQUFDO2FBQU0sSUFBSSxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDaEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QixDQUFDO2FBQU0sSUFBSSxlQUFlLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDckMsY0FBYztRQUNmLENBQUM7SUFDRixDQUFDO0lBRU8sZ0JBQWdCLENBQUMsU0FBNkM7UUFDckUsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2hCLE9BQU87UUFDUixDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7WUFDbEMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckMsQ0FBQzthQUFNLElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQzVDLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDL0UsYUFBYSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMxRCxDQUFDO2FBQU0sSUFBSSxTQUFTLENBQUMsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxpQkFBaUIsRUFBRSxpQ0FBeUIsQ0FBQyxFQUFFLENBQUM7WUFDcEcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNqRyxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDL0QsSUFBSSxRQUFRLEVBQUUsQ0FBQztnQkFDZCxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBRSxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbkQsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRU0sa0JBQWtCLENBQUMsSUFBNEI7UUFDckQsSUFBSSxXQUErQixDQUFDO1FBQ3BDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssY0FBYyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQy9DLFdBQVcsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLDRCQUE0QixFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ2xFLENBQUM7YUFBTSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLGNBQWMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUMvRCxXQUFXLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7UUFDM0MsQ0FBQzthQUFNLElBQUksSUFBSSxDQUFDLHdCQUF3QixFQUFFLEVBQUUsQ0FBQztZQUM1QyxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUNsRCxJQUFJLGVBQWUsRUFBRSxDQUFDO2dCQUNyQixXQUFXLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQztZQUNwQyxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sV0FBVyxDQUFDO0lBQ3BCLENBQUM7SUFFTyxLQUFLLENBQUMsa0JBQWtCO1FBQy9CLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUM1QixPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksV0FBNkIsQ0FBQztRQUNsQyxJQUFJLElBQUksQ0FBQyxhQUFhLHFDQUE2QixFQUFFLENBQUM7WUFDckQsV0FBVyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3ZDLENBQUM7YUFBTSxDQUFDO1lBQ1AsV0FBVyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQzlDLENBQUM7UUFFRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQW9ELENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDM0gsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDNUcsQ0FBQyxDQUFDLENBQUM7UUFFSCxNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLDRCQUE0QixFQUFFLHNDQUFzQyxDQUFDLENBQUM7UUFDdkcsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQywwQkFBMEIsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1FBQ25GLE1BQU0sV0FBVyxHQUFHLElBQUksdUJBQXVCLEVBQUUsQ0FBQztRQUNsRCxNQUFNLGlCQUFpQixHQUFzQixXQUFXLENBQUMsS0FBSyxDQUFDO1FBQy9ELE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7WUFDakQsT0FBTyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7Z0JBQ25DLE1BQU0sT0FBTyxHQUE2QyxFQUFFLENBQUM7Z0JBQzdELElBQUksZUFBZSxHQUFHLENBQUMsQ0FBQztnQkFDeEIsSUFBSSxLQUFLLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUMxQixJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQ3RCLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7b0JBQy9ELEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFLENBQUM7d0JBQzFCLE1BQU0sS0FBSyxHQUFHLEVBQUUsS0FBSyxFQUFFLGFBQWEsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQzt3QkFDbE0sYUFBYSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO3dCQUNoRSxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUNwQixJQUFJLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDOzRCQUMvQixlQUFlLEVBQUUsQ0FBQzt3QkFDbkIsQ0FBQztvQkFDRixDQUFDO2dCQUNGLENBQUM7Z0JBQ0QsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLGVBQWUsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDbEQsOEdBQThHO2dCQUM5RyxJQUFJLGlCQUFpQixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLE1BQU0sS0FBSyxlQUFlLENBQUMsRUFBRSxDQUFDO29CQUN6RixNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQztvQkFDL0QsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7d0JBQ3BCLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztvQkFDckMsQ0FBQztvQkFDRCxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ2pGLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO29CQUNsRCxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ3RCLENBQUM7Z0JBQ0QsT0FBTyxPQUFPLENBQUM7WUFDaEIsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sT0FBTyxHQUFZLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFVLENBQUMsT0FBTyxFQUFFLEVBQUU7Z0JBQzdFLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDcEMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxPQUFPLENBQVUsQ0FBQyxPQUFPLEVBQUUsRUFBRTtnQkFDcEMsTUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRTtvQkFDN0IsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUNwQixPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2YsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ1QsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUwsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsTUFBTSxPQUFPLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBVSxxQkFBcUIsQ0FBQyxFQUFFLENBQUM7WUFDdkgsTUFBTSxLQUFLLEdBQVEsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3RDLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNoQixJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzdCLE9BQU87WUFDUixDQUFDO1FBQ0YsQ0FBQztRQUVELE1BQU0sbUJBQW1CLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsRUFBRTtZQUMxRCxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsYUFBYSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUM7WUFDckYsT0FBTyxlQUFlLENBQUM7UUFDeEIsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUMvQyxFQUFFLFdBQVcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLHNCQUFzQixFQUFFLDRCQUE0QixDQUFDLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQztZQUN2RyxJQUFJLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSxFQUFFO1lBQ3hCLElBQUksaUJBQWlCLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztnQkFDL0Msc0NBQXNDO2dCQUN0QyxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hDLG1EQUFtRDtnQkFDbkQsSUFBVSxJQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBQ3RCLFNBQVMsR0FBMkIsSUFBSSxDQUFDO2dCQUMxQyxDQUFDO1lBQ0YsQ0FBQztZQUNELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNsQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyw2QkFBNkI7UUFDcEMsSUFBSSxJQUFJLENBQUMsYUFBYSxxQ0FBNkIsRUFBRSxDQUFDO1lBQ3JELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDMUIsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO29CQUN4QixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztvQkFDMUIsT0FBTztnQkFDUixDQUFDO2dCQUNELE1BQU0sT0FBTyxHQUE2QyxFQUFFLENBQUM7Z0JBQzdELElBQUksWUFBOEIsQ0FBQztnQkFDbkMsSUFBSSxhQUFpRCxDQUFDO2dCQUN0RCxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLEVBQUU7b0JBQ2pELE1BQU0sRUFBRSxjQUFjLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDekUsSUFBSSxZQUFZLEdBQUcsY0FBYyxDQUFDO29CQUNsQyxJQUFJLENBQUMsWUFBWSxFQUFFLE1BQU0sRUFBRSxDQUFDO3dCQUMzQixZQUFZLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztvQkFDcEQsQ0FBQztvQkFDRCxJQUFJLGdCQUFnQixDQUFDO29CQUNyQixJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7d0JBQy9CLE1BQU0sS0FBSyxHQUFtQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDO3dCQUM1RixJQUFJLEtBQUssRUFBRSxDQUFDOzRCQUNYLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLEtBQUssS0FBSyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dDQUNoRSxnQkFBZ0IsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7NEJBQ3BDLENBQUM7aUNBQU0sQ0FBQztnQ0FDUCxnQkFBZ0IsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7NEJBQ3BDLENBQUM7d0JBQ0YsQ0FBQztvQkFDRixDQUFDO29CQUNELEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFLENBQUM7d0JBQzFCLElBQUksSUFBSSxLQUFLLGdCQUFnQixFQUFFLENBQUM7NEJBQy9CLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsb0NBQW9DLEVBQUUsaURBQWlELEVBQUUsYUFBYSxDQUFDLG9CQUFvQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLENBQUM7NEJBQ3hMLFlBQVksR0FBRyxJQUFJLENBQUM7NEJBQ3BCLGFBQWEsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQzs0QkFDMUosYUFBYSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxhQUFhLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO3dCQUN6RSxDQUFDOzZCQUFNLENBQUM7NEJBQ1AsTUFBTSxLQUFLLEdBQUcsRUFBRSxLQUFLLEVBQUUsYUFBYSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDOzRCQUNsTSxhQUFhLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7NEJBQ2hFLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7d0JBQ3JCLENBQUM7b0JBQ0YsQ0FBQztvQkFDRCxJQUFJLGFBQWEsRUFBRSxDQUFDO3dCQUNuQixPQUFPLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO29CQUNoQyxDQUFDO29CQUNELE1BQU0sV0FBVyxHQUFHLElBQUksdUJBQXVCLEVBQUUsQ0FBQztvQkFDbEQsTUFBTSxpQkFBaUIsR0FBc0IsV0FBVyxDQUFDLEtBQUssQ0FBQztvQkFDL0QsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQ25DLEVBQUUsV0FBVyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsc0JBQXNCLEVBQUUsNEJBQTRCLENBQUMsRUFBRSxFQUFFLGlCQUFpQixDQUFDO3dCQUN2RyxJQUFJLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFFO3dCQUNwQixJQUFJLGlCQUFpQixDQUFDLHVCQUF1QixFQUFFLENBQUM7NEJBQy9DLHNDQUFzQzs0QkFDdEMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDOzRCQUNoQyxtREFBbUQ7NEJBQ25ELElBQVUsSUFBSyxDQUFDLElBQUksRUFBRSxDQUFDO2dDQUN0QixLQUFLLEdBQTJCLElBQUksQ0FBQzs0QkFDdEMsQ0FBQzt3QkFDRixDQUFDO3dCQUNELE1BQU0sSUFBSSxHQUE0QixLQUFLLElBQUksTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO3dCQUN4RixJQUFJLENBQUMsSUFBSSxLQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxFQUFFLENBQUM7NEJBQzdDLE9BQU87d0JBQ1IsQ0FBQzt3QkFDRCxJQUFJLElBQUksS0FBSyxZQUFZLElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDOzRCQUNsRCxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO3dCQUN2QixDQUFDO3dCQUNELElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7NEJBQzVCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO2dDQUNuRixJQUFJLFlBQVksSUFBSSxDQUFDLElBQUksS0FBSyxZQUFZLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztvQ0FDL0UsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0NBQ3pELENBQUM7NEJBQ0YsQ0FBQyxDQUFDLENBQUM7d0JBQ0osQ0FBQztvQkFDRixDQUFDLENBQUMsQ0FBQztvQkFDSixJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRTt3QkFDckMsV0FBVyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsa0NBQWtDLEVBQUUsc0RBQXNELENBQUM7cUJBQ3JILENBQUM7d0JBQ0QsSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7d0JBQ2QsTUFBTSxJQUFJLEdBQTRCLEtBQUssSUFBSSxNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7d0JBQ3hGLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLEVBQUUsQ0FBQzs0QkFDN0MsT0FBTzt3QkFDUixDQUFDO3dCQUNELElBQUksSUFBSSxLQUFLLFlBQVksSUFBSSxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7NEJBQ2xELElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ3ZCLENBQUM7d0JBQ0QsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQzs0QkFDNUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUU7Z0NBQ25GLElBQUksWUFBWSxJQUFJLENBQUMsSUFBSSxLQUFLLFlBQVksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO29DQUMvRSxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztnQ0FDekQsQ0FBQzs0QkFDRixDQUFDLENBQUMsQ0FBQzt3QkFDSixDQUFDO29CQUNGLENBQUMsQ0FBQyxDQUFDO2dCQUNMLENBQUMsQ0FBQyxDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDM0IsQ0FBQztJQUNGLENBQUM7SUFFTyw0QkFBNEI7UUFDbkMsSUFBSSxJQUFJLENBQUMsYUFBYSxxQ0FBNkIsRUFBRSxDQUFDO1lBQ3JELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDMUIsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO29CQUN4QixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztvQkFDMUIsT0FBTztnQkFDUixDQUFDO2dCQUNELElBQUksWUFBOEIsQ0FBQztnQkFDbkMsSUFBSSxhQUFrQyxDQUFDO2dCQUV2QyxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDO29CQUMxQixNQUFNLFNBQVMsR0FBMEIsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQzVGLElBQUksU0FBUyxJQUFJLFNBQVMsQ0FBQyxTQUFTLElBQUksU0FBUyxDQUFDLEdBQUcsS0FBSyxTQUFTLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO3dCQUM5RSxZQUFZLEdBQUcsSUFBSSxDQUFDO3dCQUNwQixNQUFNO29CQUNQLENBQUM7Z0JBQ0YsQ0FBQztnQkFDRCxJQUFJLFlBQVksRUFBRSxDQUFDO29CQUNsQixhQUFhLEdBQUc7d0JBQ2YsS0FBSyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsbUNBQW1DLEVBQUUsaURBQWlELEVBQUUsWUFBWSxDQUFDLGlCQUFpQixFQUFFLENBQUM7d0JBQzdJLElBQUksRUFBRSxZQUFZO3dCQUNsQixNQUFNLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsdUJBQXVCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTO3FCQUNwRixDQUFDO2dCQUNILENBQUM7Z0JBRUQsSUFBSSxDQUFDLDBCQUEwQixFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtvQkFDM0MsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQ3hCLEdBQUcsQ0FBQyxRQUFRLENBQUMsaUNBQWlDLEVBQUUscURBQXFELENBQUMsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTt3QkFDN0osTUFBTSxJQUFJLEdBQTRCLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO3dCQUNyRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7NEJBQ1gsT0FBTzt3QkFDUixDQUFDO3dCQUNELElBQUksSUFBSSxLQUFLLFlBQVksSUFBSSxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7NEJBQ2xELElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ3ZCLENBQUM7d0JBQ0QsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQzs0QkFDNUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUU7Z0NBQ2xGLElBQUksWUFBWSxJQUFJLENBQUMsSUFBSSxLQUFLLFlBQVksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO29DQUMvRSxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztnQ0FDeEQsQ0FBQzs0QkFDRixDQUFDLENBQUMsQ0FBQzt3QkFDSixDQUFDO29CQUNGLENBQUMsQ0FBQyxDQUFDO2dCQUNMLENBQUMsQ0FBQyxDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDM0IsQ0FBQztJQUNGLENBQUM7SUFFTSxLQUFLLENBQUMsWUFBWTtRQUN4QixNQUFNLGtCQUFrQixHQUFvQixJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDbEUsTUFBTSxXQUFXLEdBQVcsTUFBTSxrQkFBa0IsQ0FBQztRQUNyRCxJQUFJLEtBQXlCLENBQUM7UUFDOUIsSUFBSSxXQUFXLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQyxXQUFZLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlDLENBQUM7YUFBTSxJQUFJLFdBQVcsQ0FBQyxNQUFNLElBQUksV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFO1lBQzNELElBQUksWUFBWSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUMzQixPQUFPLEtBQUssQ0FBQztZQUNkLENBQUM7WUFFRCxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ1osS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLEtBQUssQ0FBQztZQUMxQyxDQUFDO1lBQ0QsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRSxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxLQUFLLEtBQUssS0FBSyxDQUFDLENBQUM7UUFDeEYsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNKLElBQUksQ0FBQyxXQUFZLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlDLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLGNBQWMsQ0FBQyxrQkFBa0IsRUFDckMsR0FBRyxDQUFDLFFBQVEsQ0FBQywwQkFBMEIsRUFBRSxvQ0FBb0MsQ0FBQyxFQUM5RTtnQkFDQyxLQUFLLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyw2QkFBNkIsRUFBRSxvQkFBb0IsQ0FBQztnQkFDeEUsSUFBSSxFQUFFLElBQUk7YUFDVixFQUNELEtBQUssRUFBRSxJQUFJLENBQ1gsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtnQkFDaEIsTUFBTSxJQUFJLEdBQTRCLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO2dCQUNyRSxJQUFJLElBQUksS0FBSyxTQUFTLElBQUksSUFBSSxLQUFLLElBQUksRUFBRSxDQUFDO29CQUN6QyxPQUFPO2dCQUNSLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLFdBQVksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDcEMsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO0lBQ0YsQ0FBQztJQUVPLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxNQUF3QjtRQUN4RCxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDMUQsSUFBSSxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7WUFDL0MsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHLFNBQVMsQ0FBQyxJQUFJLE1BQU0sRUFBRSxDQUFDLENBQUM7WUFDbEUsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3ZELE9BQU8sQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDN0IsQ0FBQztRQUNELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFTyxZQUFZLENBQUMsSUFBVSxFQUFFLGdCQUF5QixFQUFFLFlBQTJGO1FBQ3RKLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDMUIsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLGFBQWEsR0FBZ0I7WUFDbEMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNO1NBQ2xCLENBQUM7UUFDRixNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUN4RCxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUM5RSxhQUFhLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO1lBQ3ZDLGFBQWEsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUMsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxLQUFLLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDaEQsYUFBYSxDQUFDLElBQUksR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM5RCxDQUFDO1lBQ0QsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLGdCQUFnQixJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLENBQUM7Z0JBQzVJLGFBQWEsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7WUFDM0MsQ0FBQztpQkFBTSxJQUFJLGdCQUFnQixFQUFFLENBQUM7Z0JBQzdCLGFBQWEsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztZQUM3RCxDQUFDO1lBQ0QsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDaEcsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDO29CQUN6RixhQUFhLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO2dCQUN4QyxDQUFDO3FCQUFNLENBQUM7b0JBQ1AsYUFBYSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO2dCQUN2RCxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUMvQyxhQUFhLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxZQUFZLENBQUM7UUFDeEUsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLHVCQUF1QixDQUFDLFlBQVksRUFBRSxDQUFDO1lBQy9DLGFBQWEsQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFlBQVksQ0FBQztRQUN4RSxDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDbEQsYUFBYSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDO1FBQzNFLENBQUM7UUFDRCxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUN4QyxhQUFhLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUM7UUFDMUQsQ0FBQztRQUVELElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sR0FBRyxhQUFhLENBQUM7UUFDNUMsTUFBTSxRQUFRLEdBQUcsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQ3RLLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMxRCxJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sVUFBVSxDQUFDO1FBQ25CLENBQUM7UUFDRCxPQUFPO0lBQ1IsQ0FBQztJQUVPLEtBQUssQ0FBQyxRQUFRO1FBQ3JCLElBQUksSUFBSSxDQUFDLGFBQWEscUNBQTZCLEVBQUUsQ0FBQztZQUNyRCxPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksQ0FBQyxJQUFJLENBQUMsZ0NBQWdDLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxDQUFDO1lBQ2pFLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0NBQWdDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDN0YsSUFBSSxTQUFTLEVBQUUsQ0FBQztvQkFDZixJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ2pCLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ0osT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQzVDLE1BQU0sU0FBUyxHQUFpQixFQUFFLENBQUM7UUFDbkMsS0FBSyxNQUFNLE1BQU0sSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUM1QyxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNuRCxJQUFJLElBQUksRUFBRSxDQUFDO2dCQUNWLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDdEIsQ0FBQztZQUNELElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDWCxTQUFTO1lBQ1YsQ0FBQztZQUVELE1BQU0sV0FBVyxHQUE2RCxFQUFFLENBQUM7WUFDakYsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsd0VBQXlDLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1lBQ2pJLE1BQU0sWUFBWSxHQUFHO2dCQUNwQixPQUFPLEVBQW1CLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLHNEQUFnQyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ3RILEdBQUcsRUFBbUIsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsOENBQTRCLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDOUcsS0FBSyxFQUFtQixJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxrREFBOEIsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO2FBQ2xILENBQUM7WUFDRixLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDaEMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsWUFBWSxDQUFDLENBQUM7Z0JBQzNFLElBQUksVUFBVSxFQUFFLENBQUM7b0JBQ2hCLFdBQVcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQzlCLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxXQUFXLEdBQUcsU0FBUyxDQUFDO1lBQzdCLElBQUksQ0FBQyxzQkFBc0IsR0FBRyxTQUFTLENBQUM7WUFDeEMsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxFQUFFLGFBQWEsRUFBRSxXQUFXLENBQUMsQ0FBQztZQUNuRSxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsZUFBZSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ2pFLElBQUksSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsNERBQW1DLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUM7Z0JBQ3JHLE1BQU0sSUFBSSxDQUFDLHFCQUFxQixDQUFDLFdBQVcsNERBQW1DLFNBQVMsRUFBRSxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztZQUNySCxDQUFDO1lBQ0QsSUFBSSxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxvRUFBdUMsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQztnQkFDekcsTUFBTSxJQUFJLENBQUMscUJBQXFCLENBQUMsV0FBVyxvRUFBdUMsU0FBUyxFQUFFLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1lBQ3pILENBQUM7WUFDRCxJQUFJLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLHdFQUF5QyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUMzRyxNQUFNLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxXQUFXLHdFQUF5QyxTQUFTLEVBQUUsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7WUFDM0gsQ0FBQztRQUNGLENBQUM7UUFDRCxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFFcEIsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUNoRCxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLEdBQUcsQ0FBQyxRQUFRLENBQUMsNEJBQTRCLEVBQUUsMklBQTJJLENBQUM7WUFDdkwsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsa0NBQWtDLEVBQUUsNElBQTRJLENBQUMsRUFDak0sQ0FBQztnQkFDQSxLQUFLLEVBQUUsU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsc0JBQXNCLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsdUJBQXVCLEVBQUUsWUFBWSxDQUFDO2dCQUN2SSxHQUFHLEVBQUUsS0FBSyxJQUFJLEVBQUU7b0JBQ2YsS0FBSyxNQUFNLE9BQU8sSUFBSSxTQUFTLEVBQUUsQ0FBQzt3QkFDakMsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQzs0QkFDcEMsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRTs0QkFDbEMsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRTt5QkFDbEMsQ0FBQyxDQUFDO29CQUNKLENBQUM7Z0JBQ0YsQ0FBQzthQUNELENBQUMsQ0FDRixDQUFDO0lBQ0gsQ0FBQzs7QUFseUhvQixtQkFBbUI7SUE2RHRDLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxjQUFjLENBQUE7SUFDZCxXQUFBLGNBQWMsQ0FBQTtJQUNkLFdBQUEseUJBQXlCLENBQUE7SUFDekIsV0FBQSxhQUFhLENBQUE7SUFDYixXQUFBLGVBQWUsQ0FBQTtJQUNmLFdBQUEsY0FBYyxDQUFBO0lBQ2QsV0FBQSxZQUFZLENBQUE7SUFDWixXQUFBLHdCQUF3QixDQUFBO0lBQ3hCLFdBQUEsaUJBQWlCLENBQUE7SUFDakIsWUFBQSxnQkFBZ0IsQ0FBQTtJQUNoQixZQUFBLGFBQWEsQ0FBQTtJQUNiLFlBQUEsaUJBQWlCLENBQUE7SUFDakIsWUFBQSxrQkFBa0IsQ0FBQTtJQUNsQixZQUFBLDZCQUE2QixDQUFBO0lBQzdCLFlBQUEsZ0JBQWdCLENBQUE7SUFDaEIsWUFBQSxxQkFBcUIsQ0FBQTtJQUNyQixZQUFBLGVBQWUsQ0FBQTtJQUNmLFlBQUEsZ0JBQWdCLENBQUE7SUFDaEIsWUFBQSxjQUFjLENBQUE7SUFDZCxZQUFBLGNBQWMsQ0FBQTtJQUNkLFlBQUEsb0JBQW9CLENBQUE7SUFDcEIsWUFBQSxrQkFBa0IsQ0FBQTtJQUNsQixZQUFBLDRCQUE0QixDQUFBO0lBQzVCLFlBQUEsK0JBQStCLENBQUE7SUFDL0IsWUFBQSxZQUFZLENBQUE7SUFDWixZQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFlBQUEsbUJBQW1CLENBQUE7SUFDbkIsWUFBQSxzQkFBc0IsQ0FBQTtJQUN0QixZQUFBLDZCQUE2QixDQUFBO0lBQzdCLFlBQUEsZ0NBQWdDLENBQUE7SUFDaEMsWUFBQSxXQUFXLENBQUE7SUFDWCxZQUFBLGFBQWEsQ0FBQTtJQUNiLFlBQUEsaUJBQWlCLENBQUE7SUFDakIsWUFBQSxtQkFBbUIsQ0FBQTtJQUNuQixZQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFlBQUEsWUFBWSxDQUFBO0lBQ1osWUFBQSxpQkFBaUIsQ0FBQTtJQUNqQixZQUFBLFlBQVksQ0FBQTtHQW5HTyxtQkFBbUIsQ0FteUh4QyJ9