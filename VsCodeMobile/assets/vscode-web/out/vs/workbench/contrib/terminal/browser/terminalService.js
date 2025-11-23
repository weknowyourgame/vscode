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
import * as domStylesheets from '../../../../base/browser/domStylesheets.js';
import * as cssValue from '../../../../base/browser/cssValue.js';
import { DeferredPromise, timeout } from '../../../../base/common/async.js';
import { debounce, memoize } from '../../../../base/common/decorators.js';
import { DynamicListEventMultiplexer, Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore, dispose, toDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { isMacintosh, isWeb } from '../../../../base/common/platform.js';
import { URI } from '../../../../base/common/uri.js';
import * as nls from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { ITerminalLogService, TerminalExitReason, TerminalLocation, TitleEventSource } from '../../../../platform/terminal/common/terminal.js';
import { formatMessageForTerminal } from '../../../../platform/terminal/common/terminalStrings.js';
import { iconForeground } from '../../../../platform/theme/common/colorRegistry.js';
import { getIconRegistry } from '../../../../platform/theme/common/iconRegistry.js';
import { isDark } from '../../../../platform/theme/common/theme.js';
import { IThemeService, Themable } from '../../../../platform/theme/common/themeService.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { VirtualWorkspaceContext } from '../../../common/contextkeys.js';
import { ITerminalConfigurationService, ITerminalEditorService, ITerminalGroupService, ITerminalInstanceService, ITerminalService } from './terminal.js';
import { getCwdForSplit } from './terminalActions.js';
import { TerminalEditorInput } from './terminalEditorInput.js';
import { getColorStyleContent, getUriClasses } from './terminalIcon.js';
import { TerminalProfileQuickpick } from './terminalProfileQuickpick.js';
import { getInstanceFromResource, getTerminalUri, parseTerminalUri } from './terminalUri.js';
import { ITerminalProfileService } from '../common/terminal.js';
import { TerminalContextKeys } from '../common/terminalContextKey.js';
import { columnToEditorGroup } from '../../../services/editor/common/editorGroupColumn.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { ACTIVE_GROUP, AUX_WINDOW_GROUP, IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { XtermTerminal } from './xterm/xtermTerminal.js';
import { TerminalInstance } from './terminalInstance.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { TerminalCapabilityStore } from '../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js';
import { ITimerService } from '../../../services/timer/browser/timerService.js';
import { mark } from '../../../../base/common/performance.js';
import { DetachedTerminal } from './detachedTerminal.js';
import { createInstanceCapabilityEventMultiplexer } from './terminalEvents.js';
import { isAuxiliaryWindow, mainWindow } from '../../../../base/browser/window.js';
import { getActiveWindow } from '../../../../base/browser/dom.js';
import { hasKey, isString } from '../../../../base/common/types.js';
let TerminalService = class TerminalService extends Disposable {
    get isProcessSupportRegistered() { return !!this._processSupportContextKey.get(); }
    get connectionState() { return this._connectionState; }
    get whenConnected() { return this._whenConnected.p; }
    get restoredGroupCount() { return this._restoredGroupCount; }
    get instances() {
        return this._terminalGroupService.instances.concat(this._terminalEditorService.instances).concat(this._backgroundedTerminalInstances.map(bg => bg.instance));
    }
    /** Gets all non-background terminals. */
    get foregroundInstances() {
        return this._terminalGroupService.instances.concat(this._terminalEditorService.instances);
    }
    get detachedInstances() {
        return this._detachedXterms;
    }
    getReconnectedTerminals(reconnectionOwner) {
        return this._reconnectedTerminals.get(reconnectionOwner);
    }
    get activeInstance() {
        // Check if either an editor or panel terminal has focus and return that, regardless of the
        // value of _activeInstance. This avoids terminals created in the panel for example stealing
        // the active status even when it's not focused.
        for (const activeHostTerminal of this._hostActiveTerminals.values()) {
            if (activeHostTerminal?.hasFocus) {
                return activeHostTerminal;
            }
        }
        // Fallback to the last recorded active terminal if neither have focus
        return this._activeInstance;
    }
    get onDidCreateInstance() { return this._onDidCreateInstance.event; }
    get onDidChangeInstanceDimensions() { return this._onDidChangeInstanceDimensions.event; }
    get onDidRegisterProcessSupport() { return this._onDidRegisterProcessSupport.event; }
    get onDidChangeConnectionState() { return this._onDidChangeConnectionState.event; }
    get onDidRequestStartExtensionTerminal() { return this._onDidRequestStartExtensionTerminal.event; }
    get onDidDisposeInstance() { return this._onDidDisposeInstance.event; }
    get onDidFocusInstance() { return this._onDidFocusInstance.event; }
    get onDidChangeActiveInstance() { return this._onDidChangeActiveInstance.event; }
    get onDidChangeInstances() { return this._onDidChangeInstances.event; }
    get onDidChangeInstanceCapability() { return this._onDidChangeInstanceCapability.event; }
    get onDidChangeActiveGroup() { return this._onDidChangeActiveGroup.event; }
    // Lazily initialized events that fire when the specified event fires on _any_ terminal
    // TODO: Batch events
    get onAnyInstanceData() { return this._register(this.createOnInstanceEvent(instance => Event.map(instance.onData, data => ({ instance, data })))).event; }
    get onAnyInstanceDataInput() { return this._register(this.createOnInstanceEvent(e => Event.map(e.onDidInputData, () => e, e.store))).event; }
    get onAnyInstanceIconChange() { return this._register(this.createOnInstanceEvent(e => e.onIconChanged)).event; }
    get onAnyInstanceMaximumDimensionsChange() { return this._register(this.createOnInstanceEvent(e => Event.map(e.onMaximumDimensionsChanged, () => e, e.store))).event; }
    get onAnyInstancePrimaryStatusChange() { return this._register(this.createOnInstanceEvent(e => Event.map(e.statusList.onDidChangePrimaryStatus, () => e, e.store))).event; }
    get onAnyInstanceProcessIdReady() { return this._register(this.createOnInstanceEvent(e => e.onProcessIdReady)).event; }
    get onAnyInstanceSelectionChange() { return this._register(this.createOnInstanceEvent(e => e.onDidChangeSelection)).event; }
    get onAnyInstanceTitleChange() { return this._register(this.createOnInstanceEvent(e => e.onTitleChanged)).event; }
    get onAnyInstanceShellTypeChanged() { return this._register(this.createOnInstanceEvent(e => Event.map(e.onDidChangeShellType, () => e))).event; }
    get onAnyInstanceAddedCapabilityType() { return this._register(this.createOnInstanceEvent(e => Event.map(e.capabilities.onDidAddCapability, e => e.id))).event; }
    constructor(_contextKeyService, _lifecycleService, _logService, _dialogService, _instantiationService, _remoteAgentService, _configurationService, _environmentService, _terminalConfigurationService, _terminalEditorService, _terminalGroupService, _terminalInstanceService, _editorGroupsService, _terminalProfileService, _extensionService, _notificationService, _workspaceContextService, _commandService, _keybindingService, _timerService) {
        super();
        this._contextKeyService = _contextKeyService;
        this._lifecycleService = _lifecycleService;
        this._logService = _logService;
        this._dialogService = _dialogService;
        this._instantiationService = _instantiationService;
        this._remoteAgentService = _remoteAgentService;
        this._configurationService = _configurationService;
        this._environmentService = _environmentService;
        this._terminalConfigurationService = _terminalConfigurationService;
        this._terminalEditorService = _terminalEditorService;
        this._terminalGroupService = _terminalGroupService;
        this._terminalInstanceService = _terminalInstanceService;
        this._editorGroupsService = _editorGroupsService;
        this._terminalProfileService = _terminalProfileService;
        this._extensionService = _extensionService;
        this._notificationService = _notificationService;
        this._workspaceContextService = _workspaceContextService;
        this._commandService = _commandService;
        this._keybindingService = _keybindingService;
        this._timerService = _timerService;
        this._hostActiveTerminals = new Map();
        this._detachedXterms = new Set();
        this._isShuttingDown = false;
        this._backgroundedTerminalInstances = [];
        this._backgroundedTerminalDisposables = new Map();
        this._connectionState = 0 /* TerminalConnectionState.Connecting */;
        this._whenConnected = new DeferredPromise();
        this._restoredGroupCount = 0;
        this._reconnectedTerminals = new Map();
        this._onDidCreateInstance = this._register(new Emitter());
        this._onDidChangeInstanceDimensions = this._register(new Emitter());
        this._onDidRegisterProcessSupport = this._register(new Emitter());
        this._onDidChangeConnectionState = this._register(new Emitter());
        this._onDidRequestStartExtensionTerminal = this._register(new Emitter());
        // ITerminalInstanceHost events
        this._onDidDisposeInstance = this._register(new Emitter());
        this._onDidFocusInstance = this._register(new Emitter());
        this._onDidChangeActiveInstance = this._register(new Emitter());
        this._onDidChangeInstances = this._register(new Emitter());
        this._onDidChangeInstanceCapability = this._register(new Emitter());
        // Terminal view events
        this._onDidChangeActiveGroup = this._register(new Emitter());
        // the below avoids having to poll routinely.
        // we update detected profiles when an instance is created so that,
        // for example, we detect if you've installed a pwsh
        this._register(this.onDidCreateInstance(() => this._terminalProfileService.refreshAvailableProfiles()));
        this._forwardInstanceHostEvents(this._terminalGroupService);
        this._forwardInstanceHostEvents(this._terminalEditorService);
        this._register(this._terminalGroupService.onDidChangeActiveGroup(this._onDidChangeActiveGroup.fire, this._onDidChangeActiveGroup));
        this._register(this._terminalInstanceService.onDidCreateInstance(instance => {
            this._initInstanceListeners(instance);
            this._onDidCreateInstance.fire(instance);
        }));
        // Hide the panel if there are no more instances, provided that VS Code is not shutting
        // down. When shutting down the panel is locked in place so that it is restored upon next
        // launch.
        this._register(this._terminalGroupService.onDidChangeActiveInstance(instance => {
            if (!instance && !this._isShuttingDown && this._terminalConfigurationService.config.hideOnLastClosed) {
                this._terminalGroupService.hidePanel();
            }
            if (instance?.shellType) {
                this._terminalShellTypeContextKey.set(instance.shellType.toString());
            }
            else if (!instance || !(instance.shellType)) {
                this._terminalShellTypeContextKey.reset();
            }
        }));
        this._handleInstanceContextKeys();
        this._terminalShellTypeContextKey = TerminalContextKeys.shellType.bindTo(this._contextKeyService);
        this._processSupportContextKey = TerminalContextKeys.processSupported.bindTo(this._contextKeyService);
        this._processSupportContextKey.set(!isWeb || this._remoteAgentService.getConnection() !== null);
        this._terminalHasBeenCreated = TerminalContextKeys.terminalHasBeenCreated.bindTo(this._contextKeyService);
        this._terminalCountContextKey = TerminalContextKeys.count.bindTo(this._contextKeyService);
        this._terminalEditorActive = TerminalContextKeys.terminalEditorActive.bindTo(this._contextKeyService);
        this._register(this.onDidChangeActiveInstance(instance => {
            this._terminalEditorActive.set(!!instance?.target && instance.target === TerminalLocation.Editor);
        }));
        this._register(_lifecycleService.onBeforeShutdown(async (e) => e.veto(this._onBeforeShutdown(e.reason), 'veto.terminal')));
        this._register(_lifecycleService.onWillShutdown(e => this._onWillShutdown(e)));
        this._initializePrimaryBackend();
        // Create async as the class depends on `this`
        timeout(0).then(() => this._register(this._instantiationService.createInstance(TerminalEditorStyle, mainWindow.document.head)));
    }
    async showProfileQuickPick(type, cwd) {
        const quickPick = this._instantiationService.createInstance(TerminalProfileQuickpick);
        const result = await quickPick.showAndGetResult(type);
        if (!result) {
            return;
        }
        if (isString(result)) {
            return;
        }
        const keyMods = result.keyMods;
        if (type === 'createInstance') {
            const activeInstance = this.getDefaultInstanceHost().activeInstance;
            const defaultLocation = this._terminalConfigurationService.defaultLocation;
            let instance;
            if (result.config && hasKey(result.config, { id: true })) {
                await this.createContributedTerminalProfile(result.config.extensionIdentifier, result.config.id, {
                    icon: result.config.options?.icon,
                    color: result.config.options?.color,
                    location: !!(keyMods?.alt && activeInstance) ? { splitActiveTerminal: true } : defaultLocation
                });
                return;
            }
            else if (result.config && hasKey(result.config, { profileName: true })) {
                if (keyMods?.alt && activeInstance) {
                    // create split, only valid if there's an active instance
                    instance = await this.createTerminal({ location: { parentTerminal: activeInstance }, config: result.config, cwd });
                }
                else {
                    instance = await this.createTerminal({ location: defaultLocation, config: result.config, cwd });
                }
            }
            if (instance && defaultLocation !== TerminalLocation.Editor) {
                this._terminalGroupService.showPanel(true);
                this.setActiveInstance(instance);
                return instance;
            }
        }
        return undefined;
    }
    async _initializePrimaryBackend() {
        mark('code/terminal/willGetTerminalBackend');
        this._primaryBackend = await this._terminalInstanceService.getBackend(this._environmentService.remoteAuthority);
        mark('code/terminal/didGetTerminalBackend');
        const enableTerminalReconnection = this._terminalConfigurationService.config.enablePersistentSessions;
        // Connect to the extension host if it's there, set the connection state to connected when
        // it's done. This should happen even when there is no extension host.
        this._connectionState = 0 /* TerminalConnectionState.Connecting */;
        const isPersistentRemote = !!this._environmentService.remoteAuthority && enableTerminalReconnection;
        if (this._primaryBackend) {
            this._register(this._primaryBackend.onDidRequestDetach(async (e) => {
                const instanceToDetach = this.getInstanceFromResource(getTerminalUri(e.workspaceId, e.instanceId));
                if (instanceToDetach) {
                    const persistentProcessId = instanceToDetach?.persistentProcessId;
                    if (persistentProcessId && !instanceToDetach.shellLaunchConfig.isFeatureTerminal && !instanceToDetach.shellLaunchConfig.customPtyImplementation) {
                        if (instanceToDetach.target === TerminalLocation.Editor) {
                            this._terminalEditorService.detachInstance(instanceToDetach);
                        }
                        else {
                            this._terminalGroupService.getGroupForInstance(instanceToDetach)?.removeInstance(instanceToDetach);
                        }
                        await instanceToDetach.detachProcessAndDispose(TerminalExitReason.User);
                        await this._primaryBackend?.acceptDetachInstanceReply(e.requestId, persistentProcessId);
                    }
                    else {
                        // will get rejected without a persistentProcessId to attach to
                        await this._primaryBackend?.acceptDetachInstanceReply(e.requestId, undefined);
                    }
                }
            }));
        }
        mark('code/terminal/willReconnect');
        let reconnectedPromise;
        if (isPersistentRemote) {
            reconnectedPromise = this._reconnectToRemoteTerminals();
        }
        else if (enableTerminalReconnection) {
            reconnectedPromise = this._reconnectToLocalTerminals();
        }
        else {
            reconnectedPromise = Promise.resolve();
        }
        reconnectedPromise.then(async () => {
            this._setConnected();
            mark('code/terminal/didReconnect');
            mark('code/terminal/willReplay');
            const instances = await this._reconnectedTerminalGroups?.then(groups => groups.map(e => e.terminalInstances).flat()) ?? [];
            await Promise.all(instances.map(e => new Promise(r => Event.once(e.onProcessReplayComplete)(r))));
            mark('code/terminal/didReplay');
            mark('code/terminal/willGetPerformanceMarks');
            await Promise.all(Array.from(this._terminalInstanceService.getRegisteredBackends()).map(async (backend) => {
                this._timerService.setPerformanceMarks(backend.remoteAuthority === undefined ? 'localPtyHost' : 'remotePtyHost', await backend.getPerformanceMarks());
                backend.setReady();
            }));
            mark('code/terminal/didGetPerformanceMarks');
            this._whenConnected.complete();
        });
    }
    getPrimaryBackend() {
        return this._primaryBackend;
    }
    async setNextCommandId(id, commandLine, commandId) {
        if (!this._primaryBackend || id <= 0) {
            return;
        }
        await this._primaryBackend.setNextCommandId(id, commandLine, commandId);
    }
    _forwardInstanceHostEvents(host) {
        this._register(host.onDidChangeInstances(this._onDidChangeInstances.fire, this._onDidChangeInstances));
        this._register(host.onDidDisposeInstance(this._onDidDisposeInstance.fire, this._onDidDisposeInstance));
        this._register(host.onDidChangeActiveInstance(instance => this._evaluateActiveInstance(host, instance)));
        this._register(host.onDidFocusInstance(instance => {
            this._onDidFocusInstance.fire(instance);
            this._evaluateActiveInstance(host, instance);
        }));
        this._register(host.onDidChangeInstanceCapability((instance) => {
            this._onDidChangeInstanceCapability.fire(instance);
        }));
        this._hostActiveTerminals.set(host, undefined);
    }
    _evaluateActiveInstance(host, instance) {
        // Track the latest active terminal for each host so that when one becomes undefined, the
        // TerminalService's active terminal is set to the last active terminal from the other host.
        // This means if the last terminal editor is closed such that it becomes undefined, the last
        // active group's terminal will be used as the active terminal if available.
        this._hostActiveTerminals.set(host, instance);
        if (instance === undefined) {
            for (const active of this._hostActiveTerminals.values()) {
                if (active) {
                    instance = active;
                }
            }
        }
        this._activeInstance = instance;
        this._onDidChangeActiveInstance.fire(instance);
    }
    setActiveInstance(value) {
        // TODO@meganrogge: Is this the right logic for when instance is undefined?
        if (!value) {
            return;
        }
        // If this was a hideFromUser terminal created by the API this was triggered by show,
        // in which case we need to create the terminal group
        if (value.shellLaunchConfig.hideFromUser) {
            this.showBackgroundTerminal(value);
        }
        if (value.target === TerminalLocation.Editor) {
            this._terminalEditorService.setActiveInstance(value);
        }
        else {
            this._terminalGroupService.setActiveInstance(value);
        }
    }
    async focusInstance(instance) {
        if (instance.target === TerminalLocation.Editor) {
            return this._terminalEditorService.focusInstance(instance);
        }
        return this._terminalGroupService.focusInstance(instance);
    }
    async focusActiveInstance() {
        if (!this._activeInstance) {
            return;
        }
        return this.focusInstance(this._activeInstance);
    }
    async createContributedTerminalProfile(extensionIdentifier, id, options) {
        await this._extensionService.activateByEvent(`onTerminalProfile:${id}`);
        const profileProvider = this._terminalProfileService.getContributedProfileProvider(extensionIdentifier, id);
        if (!profileProvider) {
            this._notificationService.error(`No terminal profile provider registered for id "${id}"`);
            return;
        }
        try {
            await profileProvider.createContributedTerminalProfile(options);
            this._terminalGroupService.setActiveInstanceByIndex(this._terminalGroupService.instances.length - 1);
            await this._terminalGroupService.activeInstance?.focusWhenReady();
        }
        catch (e) {
            this._notificationService.error(e.message);
        }
    }
    async safeDisposeTerminal(instance) {
        // Confirm on kill in the editor is handled by the editor input
        if (instance.target !== TerminalLocation.Editor &&
            instance.hasChildProcesses &&
            (this._terminalConfigurationService.config.confirmOnKill === 'panel' || this._terminalConfigurationService.config.confirmOnKill === 'always')) {
            const veto = await this._showTerminalCloseConfirmation(true);
            if (veto) {
                return;
            }
        }
        return new Promise(r => {
            Event.once(instance.onExit)(() => r());
            instance.dispose(TerminalExitReason.User);
        });
    }
    _setConnected() {
        this._connectionState = 1 /* TerminalConnectionState.Connected */;
        this._onDidChangeConnectionState.fire();
        this._logService.trace('Pty host ready');
    }
    async _reconnectToRemoteTerminals() {
        const remoteAuthority = this._environmentService.remoteAuthority;
        if (!remoteAuthority) {
            return;
        }
        const backend = await this._terminalInstanceService.getBackend(remoteAuthority);
        if (!backend) {
            return;
        }
        mark('code/terminal/willGetTerminalLayoutInfo');
        const layoutInfo = await backend.getTerminalLayoutInfo();
        mark('code/terminal/didGetTerminalLayoutInfo');
        backend.reduceConnectionGraceTime();
        mark('code/terminal/willRecreateTerminalGroups');
        await this._recreateTerminalGroups(layoutInfo);
        mark('code/terminal/didRecreateTerminalGroups');
        // now that terminals have been restored,
        // attach listeners to update remote when terminals are changed
        this._attachProcessLayoutListeners();
        this._logService.trace('Reconnected to remote terminals');
    }
    async _reconnectToLocalTerminals() {
        const localBackend = await this._terminalInstanceService.getBackend();
        if (!localBackend) {
            return;
        }
        mark('code/terminal/willGetTerminalLayoutInfo');
        const layoutInfo = await localBackend.getTerminalLayoutInfo();
        mark('code/terminal/didGetTerminalLayoutInfo');
        if (layoutInfo && (layoutInfo.tabs.length > 0 || layoutInfo?.background?.length)) {
            mark('code/terminal/willRecreateTerminalGroups');
            this._reconnectedTerminalGroups = this._recreateTerminalGroups(layoutInfo);
            const revivedInstances = await this._reviveBackgroundTerminalInstances(layoutInfo.background || []);
            this._backgroundedTerminalInstances = revivedInstances.map(instance => ({ instance }));
            mark('code/terminal/didRecreateTerminalGroups');
        }
        // now that terminals have been restored,
        // attach listeners to update local state when terminals are changed
        this._attachProcessLayoutListeners();
        this._logService.trace('Reconnected to local terminals');
    }
    _recreateTerminalGroups(layoutInfo) {
        const groupPromises = [];
        let activeGroup;
        if (layoutInfo) {
            for (const tabLayout of layoutInfo.tabs) {
                const terminalLayouts = tabLayout.terminals.filter(t => t.terminal && t.terminal.isOrphan);
                if (terminalLayouts.length) {
                    this._restoredGroupCount += terminalLayouts.length;
                    const promise = this._recreateTerminalGroup(tabLayout, terminalLayouts);
                    groupPromises.push(promise);
                    if (tabLayout.isActive) {
                        activeGroup = promise;
                    }
                    const activeInstance = this.instances.find(t => t.shellLaunchConfig.attachPersistentProcess?.id === tabLayout.activePersistentProcessId);
                    if (activeInstance) {
                        this.setActiveInstance(activeInstance);
                    }
                }
            }
            if (layoutInfo.tabs.length) {
                activeGroup?.then(group => this._terminalGroupService.activeGroup = group);
            }
        }
        return Promise.all(groupPromises).then(result => result.filter(e => !!e));
    }
    async _reviveBackgroundTerminalInstances(bgTerminals) {
        const instances = [];
        for (const bg of bgTerminals) {
            const attachPersistentProcess = bg;
            if (!attachPersistentProcess) {
                continue;
            }
            const instance = await this.createTerminal({ config: { attachPersistentProcess, hideFromUser: true, forcePersist: true }, location: TerminalLocation.Panel });
            instances.push(instance);
        }
        return instances;
    }
    async _recreateTerminalGroup(tabLayout, terminalLayouts) {
        let lastInstance;
        for (const terminalLayout of terminalLayouts) {
            const attachPersistentProcess = terminalLayout.terminal;
            if (this._lifecycleService.startupKind !== 3 /* StartupKind.ReloadedWindow */ && attachPersistentProcess.type === 'Task') {
                continue;
            }
            mark(`code/terminal/willRecreateTerminal/${attachPersistentProcess.id}-${attachPersistentProcess.pid}`);
            lastInstance = this.createTerminal({
                config: { attachPersistentProcess },
                location: lastInstance ? { parentTerminal: lastInstance } : TerminalLocation.Panel
            });
            lastInstance.then(() => mark(`code/terminal/didRecreateTerminal/${attachPersistentProcess.id}-${attachPersistentProcess.pid}`));
        }
        const group = lastInstance?.then(instance => {
            const g = this._terminalGroupService.getGroupForInstance(instance);
            g?.resizePanes(tabLayout.terminals.map(terminal => terminal.relativeSize));
            return g;
        });
        return group;
    }
    _attachProcessLayoutListeners() {
        this._register(this.onDidChangeActiveGroup(() => this._saveState()));
        this._register(this.onDidChangeActiveInstance(() => this._saveState()));
        this._register(this.onDidChangeInstances(() => this._saveState()));
        // The state must be updated when the terminal is relaunched, otherwise the persistent
        // terminal ID will be stale and the process will be leaked.
        this._register(this.onAnyInstanceProcessIdReady(() => this._saveState()));
        this._register(this.onAnyInstanceTitleChange(instance => this._updateTitle(instance)));
        this._register(this.onAnyInstanceIconChange(e => this._updateIcon(e.instance, e.userInitiated)));
    }
    _handleInstanceContextKeys() {
        const terminalIsOpenContext = TerminalContextKeys.isOpen.bindTo(this._contextKeyService);
        const updateTerminalContextKeys = () => {
            terminalIsOpenContext.set(this.instances.length > 0);
            this._terminalCountContextKey.set(this.instances.length);
        };
        this._register(this.onDidChangeInstances(() => updateTerminalContextKeys()));
    }
    async getActiveOrCreateInstance(options) {
        const activeInstance = this.activeInstance;
        // No instance, create
        if (!activeInstance) {
            return this.createTerminal();
        }
        // Active instance, ensure accepts input
        if (!options?.acceptsInput || activeInstance.xterm?.isStdinDisabled !== true) {
            return activeInstance;
        }
        // Active instance doesn't accept input, create and focus
        const instance = await this.createTerminal();
        this.setActiveInstance(instance);
        await this.revealActiveTerminal();
        return instance;
    }
    async revealTerminal(source, preserveFocus) {
        if (source.target === TerminalLocation.Editor) {
            await this._terminalEditorService.revealActiveEditor(preserveFocus);
        }
        else {
            await this._terminalGroupService.showPanel();
        }
    }
    async revealActiveTerminal(preserveFocus) {
        const instance = this.activeInstance;
        if (!instance) {
            return;
        }
        await this.revealTerminal(instance, preserveFocus);
    }
    requestStartExtensionTerminal(proxy, cols, rows) {
        // The initial request came from the extension host, no need to wait for it
        return new Promise(callback => {
            this._onDidRequestStartExtensionTerminal.fire({ proxy, cols, rows, callback });
        });
    }
    _onBeforeShutdown(reason) {
        // Never veto on web as this would block all windows from being closed. This disables
        // process revive as we can't handle it on shutdown.
        if (isWeb) {
            this._isShuttingDown = true;
            return false;
        }
        return this._onBeforeShutdownAsync(reason);
    }
    async _onBeforeShutdownAsync(reason) {
        if (this.instances.length === 0) {
            // No terminal instances, don't veto
            return false;
        }
        // Persist terminal _buffer state_, note that even if this happens the dirty terminal prompt
        // still shows as that cannot be revived
        try {
            this._shutdownWindowCount = await this._nativeDelegate?.getWindowCount();
            const shouldReviveProcesses = this._shouldReviveProcesses(reason);
            if (shouldReviveProcesses) {
                // Attempt to persist the terminal state but only allow 2000ms as we can't block
                // shutdown. This can happen when in a remote workspace but the other side has been
                // suspended and is in the process of reconnecting, the message will be put in a
                // queue in this case for when the connection is back up and running. Aborting the
                // process is preferable in this case.
                await Promise.race([
                    this._primaryBackend?.persistTerminalState(),
                    timeout(2000)
                ]);
            }
            // Persist terminal _processes_
            const shouldPersistProcesses = this._terminalConfigurationService.config.enablePersistentSessions && reason === 3 /* ShutdownReason.RELOAD */;
            if (!shouldPersistProcesses) {
                const hasDirtyInstances = ((this._terminalConfigurationService.config.confirmOnExit === 'always' && this.foregroundInstances.length > 0) ||
                    (this._terminalConfigurationService.config.confirmOnExit === 'hasChildProcesses' && this.foregroundInstances.some(e => e.hasChildProcesses)));
                if (hasDirtyInstances) {
                    return this._onBeforeShutdownConfirmation(reason);
                }
            }
        }
        catch (err) {
            // Swallow as exceptions should not cause a veto to prevent shutdown
            this._logService.warn('Exception occurred during terminal shutdown', err);
        }
        this._isShuttingDown = true;
        return false;
    }
    setNativeDelegate(nativeDelegate) {
        this._nativeDelegate = nativeDelegate;
    }
    _shouldReviveProcesses(reason) {
        if (!this._terminalConfigurationService.config.enablePersistentSessions) {
            return false;
        }
        switch (this._terminalConfigurationService.config.persistentSessionReviveProcess) {
            case 'onExit': {
                // Allow on close if it's the last window on Windows or Linux
                if (reason === 1 /* ShutdownReason.CLOSE */ && (this._shutdownWindowCount === 1 && !isMacintosh)) {
                    return true;
                }
                return reason === 4 /* ShutdownReason.LOAD */ || reason === 2 /* ShutdownReason.QUIT */;
            }
            case 'onExitAndWindowClose': return reason !== 3 /* ShutdownReason.RELOAD */;
            default: return false;
        }
    }
    async _onBeforeShutdownConfirmation(reason) {
        // veto if configured to show confirmation and the user chose not to exit
        const veto = await this._showTerminalCloseConfirmation();
        if (!veto) {
            this._isShuttingDown = true;
        }
        return veto;
    }
    _onWillShutdown(e) {
        // Don't touch processes if the shutdown was a result of reload as they will be reattached
        const shouldPersistTerminals = this._terminalConfigurationService.config.enablePersistentSessions && e.reason === 3 /* ShutdownReason.RELOAD */;
        for (const instance of [...this._terminalGroupService.instances, ...this._backgroundedTerminalInstances.map(bg => bg.instance)]) {
            if (shouldPersistTerminals && instance.shouldPersist) {
                instance.detachProcessAndDispose(TerminalExitReason.Shutdown);
            }
            else {
                instance.dispose(TerminalExitReason.Shutdown);
            }
        }
        // Clear terminal layout info only when not persisting
        if (!shouldPersistTerminals && !this._shouldReviveProcesses(e.reason)) {
            this._primaryBackend?.setTerminalLayoutInfo(undefined);
        }
    }
    _saveState() {
        // Avoid saving state when shutting down as that would override process state to be revived
        if (this._isShuttingDown) {
            return;
        }
        if (!this._terminalConfigurationService.config.enablePersistentSessions) {
            return;
        }
        const tabs = this._terminalGroupService.groups.map(g => g.getLayoutInfo(g === this._terminalGroupService.activeGroup));
        const state = { tabs, background: this._backgroundedTerminalInstances.map(bg => bg.instance).filter(i => i.shellLaunchConfig.forcePersist).map(i => i.persistentProcessId).filter((e) => e !== undefined) };
        this._primaryBackend?.setTerminalLayoutInfo(state);
    }
    _updateTitle(instance) {
        if (!this._terminalConfigurationService.config.enablePersistentSessions || !instance || !instance.persistentProcessId || !instance.title || instance.isDisposed) {
            return;
        }
        if (instance.staticTitle) {
            this._primaryBackend?.updateTitle(instance.persistentProcessId, instance.staticTitle, TitleEventSource.Api);
        }
        else {
            this._primaryBackend?.updateTitle(instance.persistentProcessId, instance.title, instance.titleSource);
        }
    }
    _updateIcon(instance, userInitiated) {
        if (!this._terminalConfigurationService.config.enablePersistentSessions || !instance || !instance.persistentProcessId || !instance.icon || instance.isDisposed) {
            return;
        }
        this._primaryBackend?.updateIcon(instance.persistentProcessId, userInitiated, instance.icon, instance.color);
    }
    refreshActiveGroup() {
        this._onDidChangeActiveGroup.fire(this._terminalGroupService.activeGroup);
    }
    getInstanceFromId(terminalId) {
        let bgIndex = -1;
        this._backgroundedTerminalInstances.forEach((bg, i) => {
            if (bg.instance.instanceId === terminalId) {
                bgIndex = i;
            }
        });
        if (bgIndex !== -1) {
            return this._backgroundedTerminalInstances[bgIndex].instance;
        }
        try {
            return this.instances[this._getIndexFromId(terminalId)];
        }
        catch {
            return undefined;
        }
    }
    getInstanceFromResource(resource) {
        return getInstanceFromResource(this.instances, resource);
    }
    openResource(resource) {
        const instance = this.getInstanceFromResource(resource);
        if (instance) {
            this.setActiveInstance(instance);
            this.revealTerminal(instance);
            const commands = instance.capabilities.get(2 /* TerminalCapability.CommandDetection */)?.commands;
            const params = new URLSearchParams(resource.query);
            const relevantCommand = commands?.find(c => c.id === params.get('command'));
            if (relevantCommand) {
                instance.xterm?.markTracker.revealCommand(relevantCommand);
            }
        }
    }
    isAttachedToTerminal(remoteTerm) {
        return this.instances.some(term => term.processId === remoteTerm.pid);
    }
    moveToEditor(source, group) {
        if (source.target === TerminalLocation.Editor) {
            return;
        }
        const sourceGroup = this._terminalGroupService.getGroupForInstance(source);
        if (!sourceGroup) {
            return;
        }
        sourceGroup.removeInstance(source);
        this._terminalEditorService.openEditor(source, group ? { viewColumn: group } : undefined);
    }
    moveIntoNewEditor(source) {
        this.moveToEditor(source, AUX_WINDOW_GROUP);
    }
    async moveToTerminalView(source, target, side) {
        if (URI.isUri(source)) {
            source = this.getInstanceFromResource(source);
        }
        if (!source) {
            return;
        }
        this._terminalEditorService.detachInstance(source);
        if (source.target !== TerminalLocation.Editor) {
            await this._terminalGroupService.showPanel(true);
            return;
        }
        source.target = TerminalLocation.Panel;
        let group;
        if (target) {
            group = this._terminalGroupService.getGroupForInstance(target);
        }
        if (!group) {
            group = this._terminalGroupService.createGroup();
        }
        group.addInstance(source);
        this.setActiveInstance(source);
        await this._terminalGroupService.showPanel(true);
        if (target && side) {
            const index = group.terminalInstances.indexOf(target) + (side === 'after' ? 1 : 0);
            group.moveInstance(source, index, side);
        }
        // Fire events
        this._onDidChangeInstances.fire();
        this._onDidChangeActiveGroup.fire(this._terminalGroupService.activeGroup);
    }
    _initInstanceListeners(instance) {
        const instanceDisposables = new DisposableStore();
        instanceDisposables.add(instance.onDimensionsChanged(() => {
            this._onDidChangeInstanceDimensions.fire(instance);
            if (this._terminalConfigurationService.config.enablePersistentSessions && this.isProcessSupportRegistered) {
                this._saveState();
            }
        }));
        instanceDisposables.add(instance.onDidFocus(this._onDidChangeActiveInstance.fire, this._onDidChangeActiveInstance));
        instanceDisposables.add(instance.onRequestAddInstanceToGroup(async (e) => await this._addInstanceToGroup(instance, e)));
        instanceDisposables.add(instance.onDidChangeShellType(() => this._extensionService.activateByEvent(`onTerminal:${instance.shellType}`)));
        instanceDisposables.add(Event.runAndSubscribe(instance.capabilities.onDidAddCapability, (() => {
            if (instance.capabilities.has(2 /* TerminalCapability.CommandDetection */)) {
                this._extensionService.activateByEvent(`onTerminalShellIntegration:${instance.shellType}`);
            }
        })));
        const disposeListener = this._register(instance.onDisposed(() => {
            instanceDisposables.dispose();
            this._store.delete(disposeListener);
        }));
    }
    async _addInstanceToGroup(instance, e) {
        const terminalIdentifier = parseTerminalUri(e.uri);
        if (terminalIdentifier.instanceId === undefined) {
            return;
        }
        let sourceInstance = this.getInstanceFromResource(e.uri);
        // Terminal from a different window
        if (!sourceInstance) {
            const attachPersistentProcess = await this._primaryBackend?.requestDetachInstance(terminalIdentifier.workspaceId, terminalIdentifier.instanceId);
            if (attachPersistentProcess) {
                sourceInstance = await this.createTerminal({ config: { attachPersistentProcess }, resource: e.uri });
                this._terminalGroupService.moveInstance(sourceInstance, instance, e.side);
                return;
            }
        }
        // View terminals
        sourceInstance = this._terminalGroupService.getInstanceFromResource(e.uri);
        if (sourceInstance) {
            this._terminalGroupService.moveInstance(sourceInstance, instance, e.side);
            return;
        }
        // Terminal editors
        sourceInstance = this._terminalEditorService.getInstanceFromResource(e.uri);
        if (sourceInstance) {
            this.moveToTerminalView(sourceInstance, instance, e.side);
            return;
        }
        return;
    }
    registerProcessSupport(isSupported) {
        if (!isSupported) {
            return;
        }
        this._processSupportContextKey.set(isSupported);
        this._onDidRegisterProcessSupport.fire();
    }
    // TODO: Remove this, it should live in group/editor servioce
    _getIndexFromId(terminalId) {
        let terminalIndex = -1;
        this.instances.forEach((terminalInstance, i) => {
            if (terminalInstance.instanceId === terminalId) {
                terminalIndex = i;
            }
        });
        if (terminalIndex === -1) {
            throw new Error(`Terminal with ID ${terminalId} does not exist (has it already been disposed?)`);
        }
        return terminalIndex;
    }
    async _showTerminalCloseConfirmation(singleTerminal) {
        let message;
        const foregroundInstances = this.foregroundInstances;
        if (foregroundInstances.length === 1 || singleTerminal) {
            message = nls.localize('terminalService.terminalCloseConfirmationSingular', "Do you want to terminate the active terminal session?");
        }
        else {
            message = nls.localize('terminalService.terminalCloseConfirmationPlural', "Do you want to terminate the {0} active terminal sessions?", foregroundInstances.length);
        }
        const { confirmed } = await this._dialogService.confirm({
            type: 'warning',
            message,
            primaryButton: nls.localize({ key: 'terminate', comment: ['&& denotes a mnemonic'] }, "&&Terminate")
        });
        return !confirmed;
    }
    getDefaultInstanceHost() {
        if (this._terminalConfigurationService.defaultLocation === TerminalLocation.Editor) {
            return this._terminalEditorService;
        }
        return this._terminalGroupService;
    }
    async getInstanceHost(location) {
        if (location) {
            if (location === TerminalLocation.Editor) {
                return this._terminalEditorService;
            }
            else if (typeof location === 'object') {
                if (hasKey(location, { viewColumn: true })) {
                    return this._terminalEditorService;
                }
                else if (hasKey(location, { parentTerminal: true })) {
                    return (await location.parentTerminal).target === TerminalLocation.Editor ? this._terminalEditorService : this._terminalGroupService;
                }
            }
            else {
                return this._terminalGroupService;
            }
        }
        return this;
    }
    async createTerminal(options) {
        // Await the initialization of available profiles as long as this is not a pty terminal or a
        // local terminal in a remote workspace as profile won't be used in those cases and these
        // terminals need to be launched before remote connections are established.
        const isLocalInRemoteTerminal = this._remoteAgentService.getConnection() && URI.isUri(options?.cwd) && options?.cwd.scheme === Schemas.file;
        if (this._terminalProfileService.availableProfiles.length === 0) {
            const isPtyTerminal = options?.config && hasKey(options.config, { customPtyImplementation: true });
            if (!isPtyTerminal && !isLocalInRemoteTerminal) {
                if (this._connectionState === 0 /* TerminalConnectionState.Connecting */) {
                    mark(`code/terminal/willGetProfiles`);
                }
                await this._terminalProfileService.profilesReady;
                if (this._connectionState === 0 /* TerminalConnectionState.Connecting */) {
                    mark(`code/terminal/didGetProfiles`);
                }
            }
        }
        let config = options?.config;
        if (!config && isLocalInRemoteTerminal) {
            const backend = await this._terminalInstanceService.getBackend(undefined);
            const executable = await backend?.getDefaultSystemShell();
            if (executable) {
                config = { executable };
            }
        }
        if (!config) {
            config = this._terminalProfileService.getDefaultProfile();
        }
        const shellLaunchConfig = config && hasKey(config, { extensionIdentifier: true }) ? {} : this._terminalInstanceService.convertProfileToShellLaunchConfig(config || {});
        // Get the contributed profile if it was provided
        const contributedProfile = options?.skipContributedProfileCheck ? undefined : await this._getContributedProfile(shellLaunchConfig, options);
        const splitActiveTerminal = typeof options?.location === 'object' && hasKey(options.location, { splitActiveTerminal: true })
            ? options.location.splitActiveTerminal
            : typeof options?.location === 'object' ? hasKey(options.location, { parentTerminal: true }) : false;
        await this._resolveCwd(shellLaunchConfig, splitActiveTerminal, options);
        // Launch the contributed profile
        // If it's a custom pty implementation, we did not await the profiles ready, so
        // we cannot launch the contributed profile and doing so would cause an error
        if (!shellLaunchConfig.customPtyImplementation && contributedProfile) {
            const resolvedLocation = await this.resolveLocation(options?.location);
            let location;
            if (splitActiveTerminal) {
                location = resolvedLocation === TerminalLocation.Editor ? { viewColumn: SIDE_GROUP } : { splitActiveTerminal: true };
            }
            else {
                location = typeof options?.location === 'object' && hasKey(options.location, { viewColumn: true }) ? options.location : resolvedLocation;
            }
            await this.createContributedTerminalProfile(contributedProfile.extensionIdentifier, contributedProfile.id, {
                icon: contributedProfile.icon,
                color: contributedProfile.color,
                location,
                cwd: shellLaunchConfig.cwd,
            });
            const instanceHost = resolvedLocation === TerminalLocation.Editor ? this._terminalEditorService : this._terminalGroupService;
            // TODO@meganrogge: This returns undefined in the remote & web smoke tests but the function
            // does not return undefined. This should be handled correctly.
            const instance = instanceHost.instances[instanceHost.instances.length - 1];
            await instance?.focusWhenReady();
            this._terminalHasBeenCreated.set(true);
            return instance;
        }
        if (!shellLaunchConfig.customPtyImplementation && !this.isProcessSupportRegistered) {
            throw new Error('Could not create terminal when process support is not registered');
        }
        this._evaluateLocalCwd(shellLaunchConfig);
        const location = await this.resolveLocation(options?.location) || this._terminalConfigurationService.defaultLocation;
        if (shellLaunchConfig.hideFromUser) {
            const instance = this._terminalInstanceService.createInstance(shellLaunchConfig, location);
            this._backgroundedTerminalInstances.push({ instance, terminalLocationOptions: options?.location });
            this._backgroundedTerminalDisposables.set(instance.instanceId, [
                instance.onDisposed(instance => {
                    const idx = this._backgroundedTerminalInstances.findIndex(bg => bg.instance === instance);
                    if (idx !== -1) {
                        this._backgroundedTerminalInstances.splice(idx, 1);
                    }
                    this._onDidDisposeInstance.fire(instance);
                })
            ]);
            this._onDidChangeInstances.fire();
            return instance;
        }
        const parent = await this._getSplitParent(options?.location);
        this._terminalHasBeenCreated.set(true);
        this._extensionService.activateByEvent('onTerminal:*');
        let instance;
        if (parent) {
            instance = this._splitTerminal(shellLaunchConfig, location, parent);
        }
        else {
            instance = this._createTerminal(shellLaunchConfig, location, options);
        }
        if (instance.shellType) {
            this._extensionService.activateByEvent(`onTerminal:${instance.shellType}`);
        }
        return instance;
    }
    async createAndFocusTerminal(options) {
        const instance = await this.createTerminal(options);
        this.setActiveInstance(instance);
        await instance.focusWhenReady();
        return instance;
    }
    async _getContributedProfile(shellLaunchConfig, options) {
        if (options?.config && hasKey(options.config, { extensionIdentifier: true })) {
            return options.config;
        }
        return this._terminalProfileService.getContributedDefaultProfile(shellLaunchConfig);
    }
    async createDetachedTerminal(options) {
        const ctor = await TerminalInstance.getXtermConstructor(this._keybindingService, this._contextKeyService);
        const xterm = this._instantiationService.createInstance(XtermTerminal, undefined, ctor, {
            cols: options.cols,
            rows: options.rows,
            xtermColorProvider: options.colorProvider,
            capabilities: options.capabilities || new TerminalCapabilityStore(),
            disableOverviewRuler: options.disableOverviewRuler,
        }, undefined);
        if (options.readonly) {
            xterm.raw.attachCustomKeyEventHandler(() => false);
        }
        const instance = new DetachedTerminal(xterm, options, this._instantiationService);
        this._detachedXterms.add(instance);
        const l = xterm.onDidDispose(() => {
            this._detachedXterms.delete(instance);
            l.dispose();
        });
        return instance;
    }
    async _resolveCwd(shellLaunchConfig, splitActiveTerminal, options) {
        const cwd = shellLaunchConfig.cwd;
        if (!cwd) {
            if (options?.cwd) {
                shellLaunchConfig.cwd = options.cwd;
            }
            else if (splitActiveTerminal && options?.location) {
                let parent = this.activeInstance;
                if (typeof options.location === 'object' && hasKey(options.location, { parentTerminal: true })) {
                    parent = await options.location.parentTerminal;
                }
                if (!parent) {
                    throw new Error('Cannot split without an active instance');
                }
                shellLaunchConfig.cwd = await getCwdForSplit(parent, this._workspaceContextService.getWorkspace().folders, this._commandService, this._terminalConfigurationService);
            }
        }
    }
    _splitTerminal(shellLaunchConfig, location, parent) {
        let instance;
        // Use the URI from the base instance if it exists, this will correctly split local terminals
        if (typeof shellLaunchConfig.cwd !== 'object' && typeof parent.shellLaunchConfig.cwd === 'object') {
            shellLaunchConfig.cwd = URI.from({
                scheme: parent.shellLaunchConfig.cwd.scheme,
                authority: parent.shellLaunchConfig.cwd.authority,
                path: shellLaunchConfig.cwd || parent.shellLaunchConfig.cwd.path
            });
        }
        if (location === TerminalLocation.Editor || parent.target === TerminalLocation.Editor) {
            instance = this._terminalEditorService.splitInstance(parent, shellLaunchConfig);
        }
        else {
            const group = this._terminalGroupService.getGroupForInstance(parent);
            if (!group) {
                throw new Error(`Cannot split a terminal without a group (instanceId: ${parent.instanceId}, title: ${parent.title})`);
            }
            shellLaunchConfig.parentTerminalId = parent.instanceId;
            instance = group.split(shellLaunchConfig);
        }
        return instance;
    }
    _createTerminal(shellLaunchConfig, location, options) {
        let instance;
        if (location === TerminalLocation.Editor) {
            instance = this._terminalInstanceService.createInstance(shellLaunchConfig, TerminalLocation.Editor);
            if (!shellLaunchConfig.hideFromUser) {
                const editorOptions = this._getEditorOptions(options?.location);
                this._terminalEditorService.openEditor(instance, editorOptions);
            }
        }
        else {
            // TODO: pass resource?
            const group = this._terminalGroupService.createGroup(shellLaunchConfig);
            instance = group.terminalInstances[0];
        }
        return instance;
    }
    async resolveLocation(location) {
        if (location && typeof location === 'object') {
            if (hasKey(location, { parentTerminal: true })) {
                // since we don't set the target unless it's an editor terminal, this is necessary
                const parentTerminal = await location.parentTerminal;
                return !parentTerminal.target ? TerminalLocation.Panel : parentTerminal.target;
            }
            else if (hasKey(location, { viewColumn: true })) {
                return TerminalLocation.Editor;
            }
            else if (hasKey(location, { splitActiveTerminal: true })) {
                // since we don't set the target unless it's an editor terminal, this is necessary
                return !this._activeInstance?.target ? TerminalLocation.Panel : this._activeInstance?.target;
            }
        }
        return location;
    }
    async _getSplitParent(location) {
        if (location && typeof location === 'object' && hasKey(location, { parentTerminal: true })) {
            return location.parentTerminal;
        }
        else if (location && typeof location === 'object' && hasKey(location, { splitActiveTerminal: true })) {
            return this.activeInstance;
        }
        return undefined;
    }
    _getEditorOptions(location) {
        if (location && typeof location === 'object' && hasKey(location, { viewColumn: true })) {
            // Terminal-specific workaround to resolve the active group in auxiliary windows to
            // override the locked editor behavior.
            if (location.viewColumn === ACTIVE_GROUP && isAuxiliaryWindow(getActiveWindow())) {
                location.viewColumn = this._editorGroupsService.activeGroup.id;
                return location;
            }
            location.viewColumn = columnToEditorGroup(this._editorGroupsService, this._configurationService, location.viewColumn);
            return location;
        }
        return undefined;
    }
    _evaluateLocalCwd(shellLaunchConfig) {
        // Add welcome message and title annotation for local terminals launched within remote or
        // virtual workspaces
        if (!isString(shellLaunchConfig.cwd) && shellLaunchConfig.cwd?.scheme === Schemas.file) {
            if (VirtualWorkspaceContext.getValue(this._contextKeyService)) {
                shellLaunchConfig.initialText = formatMessageForTerminal(nls.localize('localTerminalVirtualWorkspace', "This shell is open to a {0}local{1} folder, NOT to the virtual folder", '\x1b[3m', '\x1b[23m'), { excludeLeadingNewLine: true, loudFormatting: true });
                shellLaunchConfig.type = 'Local';
            }
            else if (this._remoteAgentService.getConnection()) {
                shellLaunchConfig.initialText = formatMessageForTerminal(nls.localize('localTerminalRemote', "This shell is running on your {0}local{1} machine, NOT on the connected remote machine", '\x1b[3m', '\x1b[23m'), { excludeLeadingNewLine: true, loudFormatting: true });
                shellLaunchConfig.type = 'Local';
            }
        }
    }
    async showBackgroundTerminal(instance, suppressSetActive) {
        const index = this._backgroundedTerminalInstances.findIndex(bg => bg.instance === instance);
        if (index === -1) {
            return;
        }
        const backgroundTerminal = this._backgroundedTerminalInstances[index];
        this._backgroundedTerminalInstances.splice(index, 1);
        const disposables = this._backgroundedTerminalDisposables.get(instance.instanceId);
        if (disposables) {
            dispose(disposables);
        }
        this._backgroundedTerminalDisposables.delete(instance.instanceId);
        if (instance.target === TerminalLocation.Panel) {
            this._terminalGroupService.createGroup(instance);
            // Make active automatically if it's the first instance
            if (this.instances.length === 1 && !suppressSetActive) {
                this._terminalGroupService.setActiveInstanceByIndex(0);
            }
        }
        else {
            const editorOptions = backgroundTerminal.terminalLocationOptions ? this._getEditorOptions(backgroundTerminal.terminalLocationOptions) : this._getEditorOptions(instance.target);
            this._terminalEditorService.openEditor(instance, editorOptions);
        }
        this._onDidChangeInstances.fire();
    }
    async setContainers(panelContainer, terminalContainer) {
        this._terminalConfigurationService.setPanelContainer(panelContainer);
        this._terminalGroupService.setContainer(terminalContainer);
    }
    createOnInstanceEvent(getEvent) {
        return new DynamicListEventMultiplexer(this.instances, this.onDidCreateInstance, this.onDidDisposeInstance, getEvent);
    }
    createOnInstanceCapabilityEvent(capabilityId, getEvent) {
        return createInstanceCapabilityEventMultiplexer(this.instances, this.onDidCreateInstance, this.onDidDisposeInstance, capabilityId, getEvent);
    }
};
__decorate([
    memoize
], TerminalService.prototype, "onAnyInstanceData", null);
__decorate([
    memoize
], TerminalService.prototype, "onAnyInstanceDataInput", null);
__decorate([
    memoize
], TerminalService.prototype, "onAnyInstanceIconChange", null);
__decorate([
    memoize
], TerminalService.prototype, "onAnyInstanceMaximumDimensionsChange", null);
__decorate([
    memoize
], TerminalService.prototype, "onAnyInstancePrimaryStatusChange", null);
__decorate([
    memoize
], TerminalService.prototype, "onAnyInstanceProcessIdReady", null);
__decorate([
    memoize
], TerminalService.prototype, "onAnyInstanceSelectionChange", null);
__decorate([
    memoize
], TerminalService.prototype, "onAnyInstanceTitleChange", null);
__decorate([
    memoize
], TerminalService.prototype, "onAnyInstanceShellTypeChanged", null);
__decorate([
    memoize
], TerminalService.prototype, "onAnyInstanceAddedCapabilityType", null);
__decorate([
    debounce(500)
], TerminalService.prototype, "_saveState", null);
__decorate([
    debounce(500)
], TerminalService.prototype, "_updateTitle", null);
__decorate([
    debounce(500)
], TerminalService.prototype, "_updateIcon", null);
TerminalService = __decorate([
    __param(0, IContextKeyService),
    __param(1, ILifecycleService),
    __param(2, ITerminalLogService),
    __param(3, IDialogService),
    __param(4, IInstantiationService),
    __param(5, IRemoteAgentService),
    __param(6, IConfigurationService),
    __param(7, IWorkbenchEnvironmentService),
    __param(8, ITerminalConfigurationService),
    __param(9, ITerminalEditorService),
    __param(10, ITerminalGroupService),
    __param(11, ITerminalInstanceService),
    __param(12, IEditorGroupsService),
    __param(13, ITerminalProfileService),
    __param(14, IExtensionService),
    __param(15, INotificationService),
    __param(16, IWorkspaceContextService),
    __param(17, ICommandService),
    __param(18, IKeybindingService),
    __param(19, ITimerService)
], TerminalService);
export { TerminalService };
let TerminalEditorStyle = class TerminalEditorStyle extends Themable {
    constructor(container, _terminalService, _themeService, _terminalProfileService, _editorService) {
        super(_themeService);
        this._terminalService = _terminalService;
        this._themeService = _themeService;
        this._terminalProfileService = _terminalProfileService;
        this._editorService = _editorService;
        this._registerListeners();
        this._styleElement = domStylesheets.createStyleSheet(container);
        this._register(toDisposable(() => this._styleElement.remove()));
        this.updateStyles();
    }
    _registerListeners() {
        this._register(this._terminalService.onAnyInstanceIconChange(() => this.updateStyles()));
        this._register(this._terminalService.onDidCreateInstance(() => this.updateStyles()));
        this._register(this._editorService.onDidActiveEditorChange(() => {
            if (this._editorService.activeEditor instanceof TerminalEditorInput) {
                this.updateStyles();
            }
        }));
        this._register(this._editorService.onDidCloseEditor(() => {
            if (this._editorService.activeEditor instanceof TerminalEditorInput) {
                this.updateStyles();
            }
        }));
        this._register(this._terminalProfileService.onDidChangeAvailableProfiles(() => this.updateStyles()));
    }
    updateStyles() {
        super.updateStyles();
        const colorTheme = this._themeService.getColorTheme();
        // TODO: add a rule collector to avoid duplication
        let css = '';
        const productIconTheme = this._themeService.getProductIconTheme();
        // Add icons
        for (const instance of this._terminalService.instances) {
            const icon = instance.icon;
            if (!icon) {
                continue;
            }
            let uri = undefined;
            if (icon instanceof URI) {
                uri = icon;
            }
            else if (icon instanceof Object && hasKey(icon, { light: true, dark: true })) {
                uri = isDark(colorTheme.type) ? icon.dark : icon.light;
            }
            const iconClasses = getUriClasses(instance, colorTheme.type);
            if (uri instanceof URI && iconClasses && iconClasses.length > 1) {
                css += (cssValue.inline `.monaco-workbench .terminal-tab.${cssValue.className(iconClasses[0])}::before
					{content: ''; background-image: ${cssValue.asCSSUrl(uri)};}`);
            }
            if (ThemeIcon.isThemeIcon(icon)) {
                const iconRegistry = getIconRegistry();
                const iconContribution = iconRegistry.getIcon(icon.id);
                if (iconContribution) {
                    const def = productIconTheme.getIcon(iconContribution);
                    if (def) {
                        css += cssValue.inline `.monaco-workbench .terminal-tab.codicon-${cssValue.className(icon.id)}::before
							{content: ${cssValue.stringValue(def.fontCharacter)} !important; font-family: ${cssValue.stringValue(def.font?.id ?? 'codicon')} !important;}`;
                    }
                }
            }
        }
        // Add colors
        const iconForegroundColor = colorTheme.getColor(iconForeground);
        if (iconForegroundColor) {
            css += cssValue.inline `.monaco-workbench .show-file-icons .file-icon.terminal-tab::before { color: ${iconForegroundColor}; }`;
        }
        css += getColorStyleContent(colorTheme, true);
        this._styleElement.textContent = css;
    }
};
TerminalEditorStyle = __decorate([
    __param(1, ITerminalService),
    __param(2, IThemeService),
    __param(3, ITerminalProfileService),
    __param(4, IEditorService)
], TerminalEditorStyle);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL2Jyb3dzZXIvdGVybWluYWxTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxjQUFjLE1BQU0sNENBQTRDLENBQUM7QUFDN0UsT0FBTyxLQUFLLFFBQVEsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBcUIsTUFBTSxrQ0FBa0MsQ0FBQztBQUMvRixPQUFPLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFnQyxNQUFNLGtDQUFrQyxDQUFDO0FBQzdILE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBZSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN2SCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFckQsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDbkYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFlLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdkcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxxQkFB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