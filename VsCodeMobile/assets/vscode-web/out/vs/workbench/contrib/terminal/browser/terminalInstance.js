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
var TerminalInstance_1;
import { isFirefox } from '../../../../base/browser/browser.js';
import { BrowserFeatures } from '../../../../base/browser/canIUse.js';
import { DataTransfers } from '../../../../base/browser/dnd.js';
import * as dom from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { DomScrollableElement } from '../../../../base/browser/ui/scrollbar/scrollableElement.js';
import { AutoOpenBarrier, Promises, disposableTimeout, timeout } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { debounce } from '../../../../base/common/decorators.js';
import { BugIndicatingError, onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { template } from '../../../../base/common/labels.js';
import { Disposable, DisposableMap, DisposableStore, ImmortalReference, MutableDisposable, dispose, toDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import * as path from '../../../../base/common/path.js';
import { OS, isMacintosh, isWindows } from '../../../../base/common/platform.js';
import { URI } from '../../../../base/common/uri.js';
import { TabFocus } from '../../../../editor/browser/config/tabFocus.js';
import * as nls from '../../../../nls.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { CodeDataTransfers, containsDragType, getPathForFile } from '../../../../platform/dnd/browser/dnd.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { TerminalCapabilityStoreMultiplexer } from '../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js';
import { deserializeEnvironmentVariableCollections } from '../../../../platform/terminal/common/environmentVariableShared.js';
import { ITerminalLogService, TerminalExitReason, TerminalLocation, TitleEventSource } from '../../../../platform/terminal/common/terminal.js';
import { formatMessageForTerminal } from '../../../../platform/terminal/common/terminalStrings.js';
import { editorBackground } from '../../../../platform/theme/common/colorRegistry.js';
import { getIconRegistry } from '../../../../platform/theme/common/iconRegistry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspaceTrustRequestService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { PANEL_BACKGROUND, SIDE_BAR_BACKGROUND } from '../../../common/theme.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { ITerminalConfigurationService } from './terminal.js';
import { TerminalLaunchHelpAction } from './terminalActions.js';
import { TerminalEditorInput } from './terminalEditorInput.js';
import { TerminalExtensionsRegistry } from './terminalExtensions.js';
import { getColorClass, createColorStyleElement, getStandardColors } from './terminalIcon.js';
import { TerminalProcessManager } from './terminalProcessManager.js';
import { TerminalStatusList } from './terminalStatusList.js';
import { getTerminalResourcesFromDragEvent, getTerminalUri } from './terminalUri.js';
import { TerminalWidgetManager } from './widgets/widgetManager.js';
import { LineDataEventAddon } from './xterm/lineDataEventAddon.js';
import { XtermTerminal, getXtermScaledDimensions } from './xterm/xtermTerminal.js';
import { DEFAULT_COMMANDS_TO_SKIP_SHELL, ITerminalProfileResolverService, TERMINAL_CREATION_COMMANDS, TERMINAL_VIEW_ID } from '../common/terminal.js';
import { TERMINAL_BACKGROUND_COLOR } from '../common/terminalColorRegistry.js';
import { TerminalContextKeys } from '../common/terminalContextKey.js';
import { getUriLabelForShell, getShellIntegrationTimeout, getWorkspaceForTerminal, preparePathForShell } from '../common/terminalEnvironment.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IHistoryService } from '../../../services/history/common/history.js';
import { isHorizontal, IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { importAMDNodeModule } from '../../../../amdX.js';
import { terminalStrings } from '../common/terminalStrings.js';
import { TerminalIconPicker } from './terminalIconPicker.js';
import { TerminalResizeDebouncer } from './terminalResizeDebouncer.js';
import { openContextMenu } from './terminalContextMenu.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { refreshShellIntegrationInfoStatus } from './terminalTooltip.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { hasKey, isNumber, isString } from '../../../../base/common/types.js';
var Constants;
(function (Constants) {
    /**
     * The maximum amount of milliseconds to wait for a container before starting to create the
     * terminal process. This period helps ensure the terminal has good initial dimensions to work
     * with if it's going to be a foreground terminal.
     */
    Constants[Constants["WaitForContainerThreshold"] = 100] = "WaitForContainerThreshold";
    Constants[Constants["DefaultCols"] = 80] = "DefaultCols";
    Constants[Constants["DefaultRows"] = 30] = "DefaultRows";
    Constants[Constants["MaxCanvasWidth"] = 4096] = "MaxCanvasWidth";
})(Constants || (Constants = {}));
let xtermConstructor;
const shellIntegrationSupportedShellTypes = [
    "bash" /* PosixShellType.Bash */,
    "zsh" /* PosixShellType.Zsh */,
    "pwsh" /* GeneralShellType.PowerShell */,
    "python" /* GeneralShellType.Python */,
];
let TerminalInstance = class TerminalInstance extends Disposable {
    static { TerminalInstance_1 = this; }
    static { this._instanceIdCounter = 1; }
    get xtermReadyPromise() { return this._xtermReadyPromise; }
    get domElement() { return this._wrapperElement; }
    get usedShellIntegrationInjection() { return this._usedShellIntegrationInjection; }
    get shellIntegrationInjectionFailureReason() { return this._shellIntegrationInjectionInfo; }
    get store() {
        return this._store;
    }
    get extEnvironmentVariableCollection() { return this._processManager.extEnvironmentVariableCollection; }
    get waitOnExit() { return this._shellLaunchConfig.attachPersistentProcess?.waitOnExit || this._shellLaunchConfig.waitOnExit; }
    set waitOnExit(value) {
        this._shellLaunchConfig.waitOnExit = value;
    }
    get targetRef() { return this._targetRef; }
    get target() { return this._targetRef.object; }
    set target(value) {
        this._targetRef.object = value;
        this._onDidChangeTarget.fire(value);
    }
    get instanceId() { return this._instanceId; }
    get resource() { return this._resource; }
    get cols() {
        if (this._fixedCols !== undefined) {
            return this._fixedCols;
        }
        if (this._dimensionsOverride && this._dimensionsOverride.cols) {
            if (this._dimensionsOverride.forceExactSize) {
                return this._dimensionsOverride.cols;
            }
            return Math.min(Math.max(this._dimensionsOverride.cols, 2), this._cols);
        }
        return this._cols;
    }
    get rows() {
        if (this._fixedRows !== undefined) {
            return this._fixedRows;
        }
        if (this._dimensionsOverride && this._dimensionsOverride.rows) {
            if (this._dimensionsOverride.forceExactSize) {
                return this._dimensionsOverride.rows;
            }
            return Math.min(Math.max(this._dimensionsOverride.rows, 2), this._rows);
        }
        return this._rows;
    }
    get isDisposed() { return this._store.isDisposed; }
    get fixedCols() { return this._fixedCols; }
    get fixedRows() { return this._fixedRows; }
    get maxCols() { return this._cols; }
    get maxRows() { return this._rows; }
    // TODO: Ideally processId would be merged into processReady
    get processId() { return this._processManager.shellProcessId; }
    // TODO: How does this work with detached processes?
    // TODO: Should this be an event as it can fire twice?
    get processReady() { return this._processManager.ptyProcessReady; }
    get hasChildProcesses() { return this.shellLaunchConfig.attachPersistentProcess?.hasChildProcesses || this._processManager.hasChildProcesses; }
    get reconnectionProperties() { return this.shellLaunchConfig.attachPersistentProcess?.reconnectionProperties || this.shellLaunchConfig.reconnectionProperties; }
    get areLinksReady() { return this._areLinksReady; }
    get initialDataEvents() { return this._initialDataEvents; }
    get exitCode() { return this._exitCode; }
    get exitReason() { return this._exitReason; }
    get hadFocusOnExit() { return this._hadFocusOnExit; }
    get isTitleSetByProcess() { return !!this._messageTitleDisposable.value; }
    get shellLaunchConfig() { return this._shellLaunchConfig; }
    get shellType() { return this._shellType; }
    get os() { return this._processManager.os; }
    get hasRemoteAuthority() { return this._processManager.remoteAuthority !== undefined; }
    get remoteAuthority() { return this._processManager.remoteAuthority; }
    get hasFocus() { return dom.isAncestorOfActiveElement(this._wrapperElement); }
    get title() { return this._title; }
    get titleSource() { return this._titleSource; }
    get icon() { return this._getIcon(); }
    get color() { return this._getColor(); }
    get processName() { return this._processName; }
    get sequence() { return this._sequence; }
    get staticTitle() { return this._staticTitle; }
    get progressState() { return this.xterm?.progressState; }
    get workspaceFolder() { return this._workspaceFolder; }
    get cwd() { return this._cwd; }
    get initialCwd() { return this._initialCwd; }
    get description() {
        if (this._description) {
            return this._description;
        }
        const type = this.shellLaunchConfig.attachPersistentProcess?.type || this.shellLaunchConfig.type;
        switch (type) {
            case 'Task': return terminalStrings.typeTask;
            case 'Local': return terminalStrings.typeLocal;
            default: return undefined;
        }
    }
    get userHome() { return this._userHome; }
    get shellIntegrationNonce() { return this._processManager.shellIntegrationNonce; }
    get injectedArgs() { return this._injectedArgs; }
    constructor(_terminalShellTypeContextKey, _shellLaunchConfig, _contextKeyService, _contextMenuService, instantiationService, _terminalConfigurationService, _terminalProfileResolverService, _pathService, _fileService, _keybindingService, _notificationService, _preferencesService, _viewsService, _themeService, _configurationService, _logService, _storageService, _accessibilityService, _productService, _quickInputService, workbenchEnvironmentService, _workspaceContextService, _editorService, _workspaceTrustRequestService, _historyService, _telemetryService, _openerService, _commandService, _accessibilitySignalService, _viewDescriptorService) {
        super();
        this._terminalShellTypeContextKey = _terminalShellTypeContextKey;
        this._shellLaunchConfig = _shellLaunchConfig;
        this._contextKeyService = _contextKeyService;
        this._contextMenuService = _contextMenuService;
        this._terminalConfigurationService = _terminalConfigurationService;
        this._terminalProfileResolverService = _terminalProfileResolverService;
        this._pathService = _pathService;
        this._fileService = _fileService;
        this._keybindingService = _keybindingService;
        this._notificationService = _notificationService;
        this._preferencesService = _preferencesService;
        this._viewsService = _viewsService;
        this._themeService = _themeService;
        this._configurationService = _configurationService;
        this._logService = _logService;
        this._storageService = _storageService;
        this._accessibilityService = _accessibilityService;
        this._productService = _productService;
        this._quickInputService = _quickInputService;
        this._workspaceContextService = _workspaceContextService;
        this._editorService = _editorService;
        this._workspaceTrustRequestService = _workspaceTrustRequestService;
        this._historyService = _historyService;
        this._telemetryService = _telemetryService;
        this._openerService = _openerService;
        this._commandService = _commandService;
        this._accessibilitySignalService = _accessibilitySignalService;
        this._viewDescriptorService = _viewDescriptorService;
        this._contributions = new Map();
        this._latestXtermWriteData = 0;
        this._latestXtermParseData = 0;
        this._title = '';
        this._titleSource = TitleEventSource.Process;
        this._cols = 0;
        this._rows = 0;
        this._cwd = undefined;
        this._initialCwd = undefined;
        this._injectedArgs = undefined;
        this._layoutSettingsChanged = true;
        this._areLinksReady = false;
        this._initialDataEventsListener = this._register(new MutableDisposable());
        this._initialDataEvents = [];
        this._messageTitleDisposable = this._register(new MutableDisposable());
        this._dndObserver = this._register(new MutableDisposable());
        this._processName = '';
        this._usedShellIntegrationInjection = false;
        this.capabilities = this._register(new TerminalCapabilityStoreMultiplexer());
        this.disableLayout = false;
        this._targetRef = new ImmortalReference(undefined);
        // The onExit event is special in that it fires and is disposed after the terminal instance
        // itself is disposed
        this._onExit = new Emitter();
        this.onExit = this._onExit.event;
        this._onDisposed = this._register(new Emitter());
        this.onDisposed = this._onDisposed.event;
        this._onProcessIdReady = this._register(new Emitter());
        this.onProcessIdReady = this._onProcessIdReady.event;
        this._onProcessReplayComplete = this._register(new Emitter());
        this.onProcessReplayComplete = this._onProcessReplayComplete.event;
        this._onTitleChanged = this._register(new Emitter());
        this.onTitleChanged = this._onTitleChanged.event;
        this._onIconChanged = this._register(new Emitter());
        this.onIconChanged = this._onIconChanged.event;
        this._onWillData = this._register(new Emitter());
        this.onWillData = this._onWillData.event;
        this._onData = this._register(new Emitter());
        this.onData = this._onData.event;
        this._onBinary = this._register(new Emitter());
        this.onBinary = this._onBinary.event;
        this._onRequestExtHostProcess = this._register(new Emitter());
        this.onRequestExtHostProcess = this._onRequestExtHostProcess.event;
        this._onDimensionsChanged = this._register(new Emitter());
        this.onDimensionsChanged = this._onDimensionsChanged.event;
        this._onMaximumDimensionsChanged = this._register(new Emitter());
        this.onMaximumDimensionsChanged = this._onMaximumDimensionsChanged.event;
        this._onDidFocus = this._register(new Emitter());
        this.onDidFocus = this._onDidFocus.event;
        this._onDidRequestFocus = this._register(new Emitter());
        this.onDidRequestFocus = this._onDidRequestFocus.event;
        this._onDidBlur = this._register(new Emitter());
        this.onDidBlur = this._onDidBlur.event;
        this._onDidInputData = this._register(new Emitter());
        this.onDidInputData = this._onDidInputData.event;
        this._onDidChangeSelection = this._register(new Emitter());
        this.onDidChangeSelection = this._onDidChangeSelection.event;
        this._onRequestAddInstanceToGroup = this._register(new Emitter());
        this.onRequestAddInstanceToGroup = this._onRequestAddInstanceToGroup.event;
        this._onDidChangeHasChildProcesses = this._register(new Emitter());
        this.onDidChangeHasChildProcesses = this._onDidChangeHasChildProcesses.event;
        this._onDidExecuteText = this._register(new Emitter());
        this.onDidExecuteText = this._onDidExecuteText.event;
        this._onDidChangeTarget = this._register(new Emitter());
        this.onDidChangeTarget = this._onDidChangeTarget.event;
        this._onDidSendText = this._register(new Emitter());
        this.onDidSendText = this._onDidSendText.event;
        this._onDidChangeShellType = this._register(new Emitter());
        this.onDidChangeShellType = this._onDidChangeShellType.event;
        this._onDidChangeVisibility = this._register(new Emitter());
        this.onDidChangeVisibility = this._onDidChangeVisibility.event;
        this._onLineData = this._register(new Emitter({
            onDidAddFirstListener: async () => (this.xterm ?? await this._xtermReadyPromise)?.raw.loadAddon(this._lineDataEventAddon)
        }));
        this.onLineData = this._onLineData.event;
        this.sessionId = generateUuid();
        this._wrapperElement = document.createElement('div');
        this._wrapperElement.classList.add('terminal-wrapper');
        this._widgetManager = this._register(instantiationService.createInstance(TerminalWidgetManager));
        this._skipTerminalCommands = [];
        this._isExiting = false;
        this._hadFocusOnExit = false;
        this._isVisible = false;
        this._instanceId = TerminalInstance_1._instanceIdCounter++;
        this._hasHadInput = false;
        this._fixedRows = _shellLaunchConfig.attachPersistentProcess?.fixedDimensions?.rows;
        this._fixedCols = _shellLaunchConfig.attachPersistentProcess?.fixedDimensions?.cols;
        this._shellLaunchConfig.shellIntegrationEnvironmentReporting = this._configurationService.getValue("terminal.integrated.shellIntegration.environmentReporting" /* TerminalSettingId.ShellIntegrationEnvironmentReporting */);
        this._resource = getTerminalUri(this._workspaceContextService.getWorkspace().id, this.instanceId, this.title);
        if (this._shellLaunchConfig.attachPersistentProcess?.hideFromUser) {
            this._shellLaunchConfig.hideFromUser = this._shellLaunchConfig.attachPersistentProcess.hideFromUser;
        }
        if (this._shellLaunchConfig.attachPersistentProcess?.isFeatureTerminal) {
            this._shellLaunchConfig.isFeatureTerminal = this._shellLaunchConfig.attachPersistentProcess.isFeatureTerminal;
        }
        if (this._shellLaunchConfig.attachPersistentProcess?.type) {
            this._shellLaunchConfig.type = this._shellLaunchConfig.attachPersistentProcess.type;
        }
        if (this._shellLaunchConfig.attachPersistentProcess?.tabActions) {
            this._shellLaunchConfig.tabActions = this._shellLaunchConfig.attachPersistentProcess.tabActions;
        }
        if (this.shellLaunchConfig.cwd) {
            const cwdUri = isString(this._shellLaunchConfig.cwd) ? URI.from({
                scheme: Schemas.file,
                path: this._shellLaunchConfig.cwd
            }) : this._shellLaunchConfig.cwd;
            if (cwdUri) {
                this._workspaceFolder = this._workspaceContextService.getWorkspaceFolder(cwdUri) ?? undefined;
            }
        }
        if (!this._workspaceFolder) {
            const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot();
            this._workspaceFolder = activeWorkspaceRootUri ? this._workspaceContextService.getWorkspaceFolder(activeWorkspaceRootUri) ?? undefined : undefined;
        }
        const scopedContextKeyService = this._register(_contextKeyService.createScoped(this._wrapperElement));
        this._scopedContextKeyService = scopedContextKeyService;
        this._scopedInstantiationService = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, scopedContextKeyService])));
        this._terminalFocusContextKey = TerminalContextKeys.focus.bindTo(scopedContextKeyService);
        this._terminalHasFixedWidth = TerminalContextKeys.terminalHasFixedWidth.bindTo(scopedContextKeyService);
        this._terminalHasTextContextKey = TerminalContextKeys.textSelected.bindTo(this._contextKeyService);
        this._terminalAltBufferActiveContextKey = TerminalContextKeys.altBufferActive.bindTo(scopedContextKeyService);
        this._terminalShellIntegrationEnabledContextKey = TerminalContextKeys.terminalShellIntegrationEnabled.bindTo(scopedContextKeyService);
        this._logService.trace(`terminalInstance#ctor (instanceId: ${this.instanceId})`, this._shellLaunchConfig);
        this._register(this.capabilities.onDidAddCapability(e => this._logService.debug('terminalInstance added capability', e.id)));
        this._register(this.capabilities.onDidRemoveCapability(e => this._logService.debug('terminalInstance removed capability', e.id)));
        const capabilityListeners = this._register(new DisposableMap());
        this._register(this.capabilities.onDidAddCapability(e => {
            capabilityListeners.get(e.id)?.dispose();
            const refreshInfo = () => {
                this._labelComputer?.refreshLabel(this);
                refreshShellIntegrationInfoStatus(this);
            };
            switch (e.id) {
                case 0 /* TerminalCapability.CwdDetection */: {
                    capabilityListeners.set(e.id, e.capability.onDidChangeCwd(e => {
                        this._cwd = e;
                        this._setTitle(this.title, TitleEventSource.Config);
                    }));
                    break;
                }
                case 2 /* TerminalCapability.CommandDetection */: {
                    e.capability.promptInputModel.setShellType(this.shellType);
                    capabilityListeners.set(e.id, Event.any(e.capability.promptInputModel.onDidStartInput, e.capability.promptInputModel.onDidChangeInput, e.capability.promptInputModel.onDidFinishInput)(refreshInfo));
                    this._register(e.capability.onCommandExecuted(async (command) => {
                        // Only generate ID if command doesn't already have one (i.e., it's a manual command, not Copilot-initiated)
                        // The tool terminal sets the command ID before command start, so this won't override it
                        if (!command.id && command.command) {
                            const commandId = generateUuid();
                            this.xterm?.shellIntegration.setNextCommandId(command.command, commandId);
                            await this._processManager.setNextCommandId(command.command, commandId);
                        }
                    }));
                    break;
                }
                case 6 /* TerminalCapability.PromptTypeDetection */: {
                    capabilityListeners.set(e.id, e.capability.onPromptTypeChanged(refreshInfo));
                    break;
                }
            }
        }));
        this._register(this.onDidChangeShellType(() => refreshShellIntegrationInfoStatus(this)));
        this._register(this.capabilities.onDidRemoveCapability(e => {
            capabilityListeners.get(e.id)?.dispose();
        }));
        // Resolve just the icon ahead of time so that it shows up immediately in the tabs. This is
        // disabled in remote because this needs to be sync and the OS may differ on the remote
        // which would result in the wrong profile being selected and the wrong icon being
        // permanently attached to the terminal. This also doesn't work when the default profile
        // setting is set to null, that's handled after the process is created.
        if (!this.shellLaunchConfig.executable && !workbenchEnvironmentService.remoteAuthority) {
            this._terminalProfileResolverService.resolveIcon(this._shellLaunchConfig, OS);
        }
        this._icon = _shellLaunchConfig.attachPersistentProcess?.icon || _shellLaunchConfig.icon;
        // When a custom pty is used set the name immediately so it gets passed over to the exthost
        // and is available when Pseudoterminal.open fires.
        if (this.shellLaunchConfig.customPtyImplementation) {
            this._setTitle(this._shellLaunchConfig.name, TitleEventSource.Api);
        }
        this.statusList = this._register(this._scopedInstantiationService.createInstance(TerminalStatusList));
        this._initDimensions();
        this._processManager = this._createProcessManager();
        this._containerReadyBarrier = new AutoOpenBarrier(100 /* Constants.WaitForContainerThreshold */);
        this._attachBarrier = new AutoOpenBarrier(1000);
        this._xtermReadyPromise = this._createXterm();
        this._xtermReadyPromise.then(async () => {
            // Wait for a period to allow a container to be ready
            await this._containerReadyBarrier.wait();
            // Resolve the executable ahead of time if shell integration is enabled, this should not
            // be done for custom PTYs as that would cause extension Pseudoterminal-based terminals
            // to hang in resolver extensions
            let os;
            if (!this.shellLaunchConfig.customPtyImplementation && this._terminalConfigurationService.config.shellIntegration?.enabled && !this.shellLaunchConfig.executable) {
                os = await this._processManager.getBackendOS();
                const defaultProfile = (await this._terminalProfileResolverService.getDefaultProfile({ remoteAuthority: this.remoteAuthority, os }));
                this.shellLaunchConfig.executable = defaultProfile.path;
                this.shellLaunchConfig.args = defaultProfile.args;
                // Only use default icon and color and env if they are undefined in the SLC
                this.shellLaunchConfig.icon ??= defaultProfile.icon;
                this.shellLaunchConfig.color ??= defaultProfile.color;
                this.shellLaunchConfig.env ??= defaultProfile.env;
            }
            // Resolve the shell type ahead of time to allow features that depend upon it to work
            // before the process is actually created (like terminal suggest manual request)
            if (os && this.shellLaunchConfig.executable) {
                this.setShellType(guessShellTypeFromExecutable(os, this.shellLaunchConfig.executable));
            }
            await this._createProcess();
            // Re-establish the title after reconnect
            if (this.shellLaunchConfig.attachPersistentProcess) {
                this._cwd = this.shellLaunchConfig.attachPersistentProcess.cwd;
                this._setTitle(this.shellLaunchConfig.attachPersistentProcess.title, this.shellLaunchConfig.attachPersistentProcess.titleSource);
                this.setShellType(this.shellType);
            }
            if (this._fixedCols) {
                await this._addScrollbar();
            }
        }).catch((err) => {
            // Ignore exceptions if the terminal is already disposed
            if (!this.isDisposed) {
                throw err;
            }
        });
        this._register(this._configurationService.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration("accessibility.verbosity.terminal" /* AccessibilityVerbositySettingId.Terminal */)) {
                this._setAriaLabel(this.xterm?.raw, this._instanceId, this.title);
            }
            if (e.affectsConfiguration('terminal.integrated')) {
                this.updateConfig();
                this.setVisible(this._isVisible);
            }
            const layoutSettings = [
                "terminal.integrated.fontSize" /* TerminalSettingId.FontSize */,
                "terminal.integrated.fontFamily" /* TerminalSettingId.FontFamily */,
                "terminal.integrated.fontWeight" /* TerminalSettingId.FontWeight */,
                "terminal.integrated.fontWeightBold" /* TerminalSettingId.FontWeightBold */,
                "terminal.integrated.letterSpacing" /* TerminalSettingId.LetterSpacing */,
                "terminal.integrated.lineHeight" /* TerminalSettingId.LineHeight */,
                'editor.fontFamily'
            ];
            if (layoutSettings.some(id => e.affectsConfiguration(id))) {
                this._layoutSettingsChanged = true;
                await this._resize();
            }
            if (e.affectsConfiguration("terminal.integrated.unicodeVersion" /* TerminalSettingId.UnicodeVersion */)) {
                this._updateUnicodeVersion();
            }
            if (e.affectsConfiguration('editor.accessibilitySupport')) {
                this.updateAccessibilitySupport();
            }
            if (e.affectsConfiguration("terminal.integrated.tabs.title" /* TerminalSettingId.TerminalTitle */) ||
                e.affectsConfiguration("terminal.integrated.tabs.separator" /* TerminalSettingId.TerminalTitleSeparator */) ||
                e.affectsConfiguration("terminal.integrated.tabs.description" /* TerminalSettingId.TerminalDescription */)) {
                this._labelComputer?.refreshLabel(this);
            }
        }));
        this._register(this._workspaceContextService.onDidChangeWorkspaceFolders(() => this._labelComputer?.refreshLabel(this)));
        // Clear out initial data events after 10 seconds, hopefully extension hosts are up and
        // running at that point.
        let initialDataEventsTimeout = dom.getWindow(this._container).setTimeout(() => {
            initialDataEventsTimeout = undefined;
            this._initialDataEvents = undefined;
            this._initialDataEventsListener.clear();
        }, 10000);
        this._register(toDisposable(() => {
            if (initialDataEventsTimeout) {
                dom.getWindow(this._container).clearTimeout(initialDataEventsTimeout);
            }
        }));
        // Initialize contributions
        const contributionDescs = TerminalExtensionsRegistry.getTerminalContributions();
        for (const desc of contributionDescs) {
            if (this._contributions.has(desc.id)) {
                onUnexpectedError(new Error(`Cannot have two terminal contributions with the same id ${desc.id}`));
                continue;
            }
            let contribution;
            try {
                contribution = this._register(this._scopedInstantiationService.createInstance(desc.ctor, {
                    instance: this,
                    processManager: this._processManager,
                    widgetManager: this._widgetManager
                }));
                this._contributions.set(desc.id, contribution);
            }
            catch (err) {
                onUnexpectedError(err);
            }
            this._xtermReadyPromise.then(xterm => {
                if (xterm) {
                    contribution.xtermReady?.(xterm);
                }
            });
            this._register(this.onDisposed(() => {
                contribution.dispose();
                this._contributions.delete(desc.id);
            }));
        }
    }
    getContribution(id) {
        return this._contributions.get(id);
    }
    async _handleOnData(data) {
        await this._processManager.write(data);
        this._onDidInputData.fire(data);
    }
    _getIcon() {
        if (!this._icon) {
            this._icon = this._processManager.processState >= 2 /* ProcessState.Launching */
                ? getIconRegistry().getIcon(this._configurationService.getValue("terminal.integrated.tabs.defaultIcon" /* TerminalSettingId.TabsDefaultIcon */))
                : undefined;
        }
        return this._icon;
    }
    _getColor() {
        if (this.shellLaunchConfig.color) {
            return this.shellLaunchConfig.color;
        }
        if (this.shellLaunchConfig?.attachPersistentProcess?.color) {
            return this.shellLaunchConfig.attachPersistentProcess.color;
        }
        if (this._processManager.processState >= 2 /* ProcessState.Launching */) {
            return undefined;
        }
        return undefined;
    }
    _initDimensions() {
        // The terminal panel needs to have been created to get the real view dimensions
        if (!this._container) {
            // Set the fallback dimensions if not
            this._cols = 80 /* Constants.DefaultCols */;
            this._rows = 30 /* Constants.DefaultRows */;
            return;
        }
        const computedStyle = dom.getWindow(this._container).getComputedStyle(this._container);
        const width = parseInt(computedStyle.width);
        const height = parseInt(computedStyle.height);
        this._evaluateColsAndRows(width, height);
    }
    /**
     * Evaluates and sets the cols and rows of the terminal if possible.
     * @param width The width of the container.
     * @param height The height of the container.
     * @return The terminal's width if it requires a layout.
     */
    _evaluateColsAndRows(width, height) {
        // Ignore if dimensions are undefined or 0
        if (!width || !height) {
            this._setLastKnownColsAndRows();
            return null;
        }
        const dimension = this._getDimension(width, height);
        if (!dimension) {
            this._setLastKnownColsAndRows();
            return null;
        }
        const font = this.xterm ? this.xterm.getFont() : this._terminalConfigurationService.getFont(dom.getWindow(this.domElement));
        const newRC = getXtermScaledDimensions(dom.getWindow(this.domElement), font, dimension.width, dimension.height);
        if (!newRC) {
            this._setLastKnownColsAndRows();
            return null;
        }
        if (this._cols !== newRC.cols || this._rows !== newRC.rows) {
            this._cols = newRC.cols;
            this._rows = newRC.rows;
            this._fireMaximumDimensionsChanged();
        }
        return dimension.width;
    }
    _setLastKnownColsAndRows() {
        if (TerminalInstance_1._lastKnownGridDimensions) {
            this._cols = TerminalInstance_1._lastKnownGridDimensions.cols;
            this._rows = TerminalInstance_1._lastKnownGridDimensions.rows;
        }
    }
    _fireMaximumDimensionsChanged() {
        this._onMaximumDimensionsChanged.fire();
    }
    _getDimension(width, height) {
        // The font needs to have been initialized
        const font = this.xterm ? this.xterm.getFont() : this._terminalConfigurationService.getFont(dom.getWindow(this.domElement));
        if (!font || !font.charWidth || !font.charHeight) {
            return undefined;
        }
        if (!this.xterm?.raw.element) {
            return undefined;
        }
        const computedStyle = dom.getWindow(this.xterm.raw.element).getComputedStyle(this.xterm.raw.element);
        const horizontalPadding = parseInt(computedStyle.paddingLeft) + parseInt(computedStyle.paddingRight) + 14 /*scroll bar padding*/;
        const verticalPadding = parseInt(computedStyle.paddingTop) + parseInt(computedStyle.paddingBottom);
        TerminalInstance_1._lastKnownCanvasDimensions = new dom.Dimension(Math.min(4096 /* Constants.MaxCanvasWidth */, width - horizontalPadding), height - verticalPadding + (this._hasScrollBar && this._horizontalScrollbar ? -5 /* scroll bar height */ : 0));
        return TerminalInstance_1._lastKnownCanvasDimensions;
    }
    get persistentProcessId() { return this._processManager.persistentProcessId; }
    get shouldPersist() { return this._processManager.shouldPersist && !this.shellLaunchConfig.isTransient && (!this.reconnectionProperties || this._configurationService.getValue('task.reconnection') === true); }
    static getXtermConstructor(keybindingService, contextKeyService) {
        const keybinding = keybindingService.lookupKeybinding("workbench.action.terminal.focusAccessibleBuffer" /* TerminalContribCommandId.A11yFocusAccessibleBuffer */, contextKeyService);
        if (xtermConstructor) {
            return xtermConstructor;
        }
        xtermConstructor = Promises.withAsyncBody(async (resolve) => {
            const Terminal = (await importAMDNodeModule('@xterm/xterm', 'lib/xterm.js')).Terminal;
            // Localize strings
            Terminal.strings.promptLabel = nls.localize('terminal.integrated.a11yPromptLabel', 'Terminal input');
            Terminal.strings.tooMuchOutput = keybinding ? nls.localize('terminal.integrated.useAccessibleBuffer', 'Use the accessible buffer {0} to manually review output', keybinding.getLabel()) : nls.localize('terminal.integrated.useAccessibleBufferNoKb', 'Use the Terminal: Focus Accessible Buffer command to manually review output');
            resolve(Terminal);
        });
        return xtermConstructor;
    }
    /**
     * Create xterm.js instance and attach data listeners.
     */
    async _createXterm() {
        const Terminal = await TerminalInstance_1.getXtermConstructor(this._keybindingService, this._contextKeyService);
        if (this.isDisposed) {
            return undefined;
        }
        const disableShellIntegrationReporting = (this.shellLaunchConfig.executable === undefined || this.shellType === undefined) || !shellIntegrationSupportedShellTypes.includes(this.shellType);
        const xterm = this._scopedInstantiationService.createInstance(XtermTerminal, this._resource, Terminal, {
            cols: this._cols,
            rows: this._rows,
            xtermColorProvider: this._scopedInstantiationService.createInstance(TerminalInstanceColorProvider, this._targetRef),
            capabilities: this.capabilities,
            shellIntegrationNonce: this._processManager.shellIntegrationNonce,
            disableShellIntegrationReporting,
        }, this.onDidExecuteText);
        this.xterm = xterm;
        this._resizeDebouncer = this._register(new TerminalResizeDebouncer(() => this._isVisible, () => xterm, async (cols, rows) => {
            xterm.resize(cols, rows);
            await this._updatePtyDimensions(xterm.raw);
        }, async (cols) => {
            xterm.resize(cols, xterm.raw.rows);
            await this._updatePtyDimensions(xterm.raw);
        }, async (rows) => {
            xterm.resize(xterm.raw.cols, rows);
            await this._updatePtyDimensions(xterm.raw);
        }));
        this._register(toDisposable(() => this._resizeDebouncer = undefined));
        this.updateAccessibilitySupport();
        this._register(this.xterm.onDidRequestRunCommand(e => {
            this.sendText(e.command.command, e.noNewLine ? false : true);
        }));
        this._register(this.xterm.onDidRequestRefreshDimensions(() => {
            if (this._lastLayoutDimensions) {
                this.layout(this._lastLayoutDimensions);
            }
        }));
        // Write initial text, deferring onLineFeed listener when applicable to avoid firing
        // onLineData events containing initialText
        const initialTextWrittenPromise = this._shellLaunchConfig.initialText ? new Promise(r => this._writeInitialText(xterm, r)) : undefined;
        const lineDataEventAddon = this._register(new LineDataEventAddon(initialTextWrittenPromise));
        this._register(lineDataEventAddon.onLineData(e => this._onLineData.fire(e)));
        this._lineDataEventAddon = lineDataEventAddon;
        // Delay the creation of the bell listener to avoid showing the bell when the terminal
        // starts up or reconnects
        disposableTimeout(() => {
            this._register(xterm.raw.onBell(() => {
                if (this._configurationService.getValue("terminal.integrated.enableBell" /* TerminalSettingId.EnableBell */) || this._configurationService.getValue("terminal.integrated.enableVisualBell" /* TerminalSettingId.EnableVisualBell */)) {
                    this.statusList.add({
                        id: "bell" /* TerminalStatus.Bell */,
                        severity: Severity.Warning,
                        icon: Codicon.bell,
                        tooltip: nls.localize('bellStatus', "Bell")
                    }, this._terminalConfigurationService.config.bellDuration);
                }
                this._accessibilitySignalService.playSignal(AccessibilitySignal.terminalBell);
            }));
        }, 1000, this._store);
        this._register(xterm.raw.onSelectionChange(() => this._onDidChangeSelection.fire(this)));
        this._register(xterm.raw.buffer.onBufferChange(() => this._refreshAltBufferContextKey()));
        this._register(this._processManager.onProcessData(e => this._onProcessData(e)));
        this._register(xterm.raw.onData(async (data) => {
            await this._handleOnData(data);
        }));
        this._register(xterm.raw.onBinary(data => this._processManager.processBinary(data)));
        // Init winpty compat and link handler after process creation as they rely on the
        // underlying process OS
        this._register(this._processManager.onProcessReady(async (processTraits) => {
            // Respond to DA1 with basic conformance. Note that including this is required to avoid
            // a long delay in conpty 1.22+ where it waits for the response.
            // Reference: https://github.com/microsoft/terminal/blob/3760caed97fa9140a40777a8fbc1c95785e6d2ab/src/terminal/adapter/adaptDispatch.cpp#L1471-L1495
            if (processTraits?.windowsPty?.backend === 'conpty') {
                this._register(xterm.raw.parser.registerCsiHandler({ final: 'c' }, params => {
                    if (params.length === 0 || params.length === 1 && params[0] === 0) {
                        this._handleOnData('\x1b[?61;4c');
                        return true;
                    }
                    return false;
                }));
            }
            if (this._processManager.os) {
                lineDataEventAddon.setOperatingSystem(this._processManager.os);
            }
            xterm.raw.options.windowsPty = processTraits.windowsPty;
        }));
        this._register(this._processManager.onRestoreCommands(e => this.xterm?.shellIntegration.deserialize(e)));
        this._register(this._viewDescriptorService.onDidChangeLocation(({ views }) => {
            if (views.some(v => v.id === TERMINAL_VIEW_ID)) {
                xterm.refresh();
            }
        }));
        this._register(xterm.onDidChangeProgress(() => this._labelComputer?.refreshLabel(this)));
        // Register and update the terminal's shell integration status
        this._register(Event.runAndSubscribe(xterm.shellIntegration.onDidChangeSeenSequences, () => {
            if (xterm.shellIntegration.seenSequences.size > 0) {
                refreshShellIntegrationInfoStatus(this);
            }
        }));
        // Set up updating of the process cwd on key press, this is only needed when the cwd
        // detection capability has not been registered
        if (!this.capabilities.has(0 /* TerminalCapability.CwdDetection */)) {
            let onKeyListener = xterm.raw.onKey(e => {
                const event = new StandardKeyboardEvent(e.domEvent);
                if (event.equals(3 /* KeyCode.Enter */)) {
                    this._updateProcessCwd();
                }
            });
            this._register(this.capabilities.onDidAddCwdDetectionCapability(() => {
                onKeyListener?.dispose();
                onKeyListener = undefined;
            }));
        }
        if (this.xterm?.shellIntegration) {
            this.capabilities.add(this.xterm.shellIntegration.capabilities);
        }
        this._pathService.userHome().then(userHome => {
            this._userHome = userHome.fsPath;
        });
        if (this._isVisible) {
            this._open();
        }
        return xterm;
    }
    async runCommand(commandLine, shouldExecute, commandId) {
        let commandDetection = this.capabilities.get(2 /* TerminalCapability.CommandDetection */);
        const siInjectionEnabled = this._configurationService.getValue("terminal.integrated.shellIntegration.enabled" /* TerminalSettingId.ShellIntegrationEnabled */) === true;
        const timeoutMs = getShellIntegrationTimeout(this._configurationService, siInjectionEnabled, this.hasRemoteAuthority, this._processManager.processReadyTimestamp);
        if (!commandDetection || commandDetection.promptInputModel.state !== 1 /* PromptInputState.Input */) {
            const store = new DisposableStore();
            await Promise.race([
                new Promise(r => {
                    store.add(this.capabilities.onDidAddCommandDetectionCapability(e => {
                        commandDetection = e;
                        if (commandDetection.promptInputModel.state === 1 /* PromptInputState.Input */) {
                            r();
                        }
                        else {
                            store.add(commandDetection.promptInputModel.onDidStartInput(() => {
                                r();
                            }));
                        }
                    }));
                }),
                timeout(timeoutMs)
            ]);
            store.dispose();
        }
        // If a command ID was provided and we have command detection, set it as the next command ID
        // so it will be used when the shell sends the command start sequence
        if (commandId && commandDetection) {
            this.xterm?.shellIntegration.setNextCommandId(commandLine, commandId);
            await this._processManager.setNextCommandId(commandLine, commandId);
        }
        // Determine whether to send ETX (ctrl+c) before running the command. This should always
        // happen unless command detection can reliably say that a command is being entered and
        // there is no content in the prompt
        if (!commandDetection || commandDetection.promptInputModel.value.length > 0) {
            await this.sendText('\x03', false);
            // Wait a little before running the command to avoid the sequences being echoed while the ^C
            // is being evaluated
            await timeout(100);
        }
        // Use bracketed paste mode only when not running the command
        await this.sendText(commandLine, shouldExecute, !shouldExecute);
    }
    detachFromElement() {
        this._wrapperElement.remove();
        this._container = undefined;
    }
    attachToElement(container) {
        // The container did not change, do nothing
        if (this._container === container) {
            return;
        }
        if (!this._attachBarrier.isOpen()) {
            this._attachBarrier.open();
        }
        // The container changed, reattach
        this._container = container;
        this._container.appendChild(this._wrapperElement);
        // If xterm is already attached, call open again to pick up any changes to the window.
        if (this.xterm?.raw.element) {
            this.xterm.raw.open(this.xterm.raw.element);
        }
        this.xterm?.refresh();
        setTimeout(() => {
            if (this._store.isDisposed) {
                return;
            }
            this._initDragAndDrop(container);
        }, 0);
    }
    /**
     * Opens the terminal instance inside the parent DOM element previously set with
     * `attachToElement`, you must ensure the parent DOM element is explicitly visible before
     * invoking this function as it performs some DOM calculations internally
     */
    _open() {
        if (!this.xterm || this.xterm.raw.element) {
            return;
        }
        if (!this._container || !this._container.isConnected) {
            throw new Error('A container element needs to be set with `attachToElement` and be part of the DOM before calling `_open`');
        }
        const xtermElement = document.createElement('div');
        this._wrapperElement.appendChild(xtermElement);
        this._container.appendChild(this._wrapperElement);
        const xterm = this.xterm;
        // Attach the xterm object to the DOM, exposing it to the smoke tests
        this._wrapperElement.xterm = xterm.raw;
        const screenElement = xterm.attachToElement(xtermElement);
        // Fire xtermOpen on all contributions
        for (const contribution of this._contributions.values()) {
            if (!this.xterm) {
                this._xtermReadyPromise.then(xterm => {
                    if (xterm) {
                        contribution.xtermOpen?.(xterm);
                    }
                });
            }
            else {
                contribution.xtermOpen?.(this.xterm);
            }
        }
        this._register(xterm.shellIntegration.onDidChangeStatus(() => {
            if (this.hasFocus) {
                this._setShellIntegrationContextKey();
            }
            else {
                this._terminalShellIntegrationEnabledContextKey.reset();
            }
        }));
        if (!xterm.raw.element || !xterm.raw.textarea) {
            throw new Error('xterm elements not set after open');
        }
        this._setAriaLabel(xterm.raw, this._instanceId, this._title);
        xterm.raw.attachCustomKeyEventHandler((event) => {
            // Disable all input if the terminal is exiting
            if (this._isExiting) {
                return false;
            }
            const standardKeyboardEvent = new StandardKeyboardEvent(event);
            const resolveResult = this._keybindingService.softDispatch(standardKeyboardEvent, standardKeyboardEvent.target);
            // Respect chords if the allowChords setting is set and it's not Escape. Escape is
            // handled specially for Zen Mode's Escape, Escape chord, plus it's important in
            // terminals generally
            const isValidChord = resolveResult.kind === 1 /* ResultKind.MoreChordsNeeded */ && this._terminalConfigurationService.config.allowChords && event.key !== 'Escape';
            if (this._keybindingService.inChordMode || isValidChord) {
                event.preventDefault();
                return false;
            }
            const SHOW_TERMINAL_CONFIG_PROMPT_KEY = 'terminal.integrated.showTerminalConfigPrompt';
            const EXCLUDED_KEYS = ['RightArrow', 'LeftArrow', 'UpArrow', 'DownArrow', 'Space', 'Meta', 'Control', 'Shift', 'Alt', '', 'Delete', 'Backspace', 'Tab'];
            // only keep track of input if prompt hasn't already been shown
            if (this._storageService.getBoolean(SHOW_TERMINAL_CONFIG_PROMPT_KEY, -1 /* StorageScope.APPLICATION */, true) &&
                !EXCLUDED_KEYS.includes(event.key) &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey) {
                this._hasHadInput = true;
            }
            // for keyboard events that resolve to commands described
            // within commandsToSkipShell, either alert or skip processing by xterm.js
            if (resolveResult.kind === 2 /* ResultKind.KbFound */ && resolveResult.commandId && this._skipTerminalCommands.some(k => k === resolveResult.commandId) && !this._terminalConfigurationService.config.sendKeybindingsToShell) {
                // don't alert when terminal is opened or closed
                if (this._storageService.getBoolean(SHOW_TERMINAL_CONFIG_PROMPT_KEY, -1 /* StorageScope.APPLICATION */, true) &&
                    this._hasHadInput &&
                    !TERMINAL_CREATION_COMMANDS.includes(resolveResult.commandId)) {
                    this._notificationService.prompt(Severity.Info, nls.localize('keybindingHandling', "Some keybindings don't go to the terminal by default and are handled by {0} instead.", this._productService.nameLong), [
                        {
                            label: nls.localize('configureTerminalSettings', "Configure Terminal Settings"),
                            run: () => {
                                this._preferencesService.openSettings({ jsonEditor: false, query: `@id:${"terminal.integrated.commandsToSkipShell" /* TerminalSettingId.CommandsToSkipShell */},${"terminal.integrated.sendKeybindingsToShell" /* TerminalSettingId.SendKeybindingsToShell */},${"terminal.integrated.allowChords" /* TerminalSettingId.AllowChords */}` });
                            }
                        }
                    ]);
                    this._storageService.store(SHOW_TERMINAL_CONFIG_PROMPT_KEY, false, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
                }
                event.preventDefault();
                return false;
            }
            // Skip processing by xterm.js of keyboard events that match menu bar mnemonics
            if (this._terminalConfigurationService.config.allowMnemonics && !isMacintosh && event.altKey) {
                return false;
            }
            // If tab focus mode is on, tab is not passed to the terminal
            if (TabFocus.getTabFocusMode() && event.key === 'Tab') {
                return false;
            }
            // Prevent default when shift+tab is being sent to the terminal to avoid it bubbling up
            // and changing focus https://github.com/microsoft/vscode/issues/188329
            if (event.key === 'Tab' && event.shiftKey) {
                event.preventDefault();
                return true;
            }
            // Always have alt+F4 skip the terminal on Windows and allow it to be handled by the
            // system
            if (isWindows && event.altKey && event.key === 'F4' && !event.ctrlKey) {
                return false;
            }
            // Fallback to force ctrl+v to paste on browsers that do not support
            // navigator.clipboard.readText
            if (!BrowserFeatures.clipboard.readText && event.key === 'v' && event.ctrlKey) {
                return false;
            }
            return true;
        });
        this._register(dom.addDisposableListener(xterm.raw.element, 'mousedown', () => {
            // We need to listen to the mouseup event on the document since the user may release
            // the mouse button anywhere outside of _xterm.element.
            const listener = dom.addDisposableListener(xterm.raw.element.ownerDocument, 'mouseup', () => {
                // Delay with a setTimeout to allow the mouseup to propagate through the DOM
                // before evaluating the new selection state.
                setTimeout(() => this._refreshSelectionContextKey(), 0);
                listener.dispose();
            });
        }));
        this._register(dom.addDisposableListener(xterm.raw.element, 'touchstart', () => {
            xterm.raw.focus();
        }));
        // xterm.js currently drops selection on keyup as we need to handle this case.
        this._register(dom.addDisposableListener(xterm.raw.element, 'keyup', () => {
            // Wait until keyup has propagated through the DOM before evaluating
            // the new selection state.
            setTimeout(() => this._refreshSelectionContextKey(), 0);
        }));
        this._register(dom.addDisposableListener(xterm.raw.textarea, 'focus', () => this._setFocus(true)));
        this._register(dom.addDisposableListener(xterm.raw.textarea, 'blur', () => this._setFocus(false)));
        this._register(dom.addDisposableListener(xterm.raw.textarea, 'focusout', () => this._setFocus(false)));
        this._initDragAndDrop(this._container);
        this._widgetManager.attachToElement(screenElement);
        if (this._lastLayoutDimensions) {
            this.layout(this._lastLayoutDimensions);
        }
        this.updateConfig();
        // If IShellLaunchConfig.waitOnExit was true and the process finished before the terminal
        // panel was initialized.
        if (xterm.raw.options.disableStdin) {
            this._attachPressAnyKeyToCloseListener(xterm.raw);
        }
    }
    _setFocus(focused) {
        if (focused) {
            this._terminalFocusContextKey.set(true);
            this._setShellIntegrationContextKey();
            this._onDidFocus.fire(this);
        }
        else {
            this.resetFocusContextKey();
            this._onDidBlur.fire(this);
            this._refreshSelectionContextKey();
        }
    }
    _setShellIntegrationContextKey() {
        if (this.xterm) {
            this._terminalShellIntegrationEnabledContextKey.set(this.xterm.shellIntegration.status === 2 /* ShellIntegrationStatus.VSCode */);
        }
    }
    resetFocusContextKey() {
        this._terminalFocusContextKey.reset();
        this._terminalShellIntegrationEnabledContextKey.reset();
    }
    _initDragAndDrop(container) {
        const store = new DisposableStore();
        const dndController = store.add(this._scopedInstantiationService.createInstance(TerminalInstanceDragAndDropController, container));
        store.add(dndController.onDropTerminal(e => this._onRequestAddInstanceToGroup.fire(e)));
        store.add(dndController.onDropFile(async (path) => {
            this.focus();
            await this.sendPath(path, false);
        }));
        store.add(new dom.DragAndDropObserver(container, dndController));
        this._dndObserver.value = store;
    }
    hasSelection() {
        return this.xterm ? this.xterm.raw.hasSelection() : false;
    }
    get selection() {
        return this.xterm && this.hasSelection() ? this.xterm.raw.getSelection() : undefined;
    }
    clearSelection() {
        this.xterm?.raw.clearSelection();
    }
    _refreshAltBufferContextKey() {
        this._terminalAltBufferActiveContextKey.set(!!(this.xterm && this.xterm.raw.buffer.active === this.xterm.raw.buffer.alternate));
    }
    dispose(reason) {
        if (this.shellLaunchConfig.type === 'Task' && reason === TerminalExitReason.Process && this._exitCode !== 0 && !this.shellLaunchConfig.waitOnExit) {
            return;
        }
        if (this.isDisposed) {
            return;
        }
        this._logService.trace(`terminalInstance#dispose (instanceId: ${this.instanceId})`);
        dispose(this._widgetManager);
        if (this.xterm?.raw.element) {
            this._hadFocusOnExit = this.hasFocus;
        }
        if (this._wrapperElement.xterm) {
            this._wrapperElement.xterm = undefined;
        }
        if (this._horizontalScrollbar) {
            this._horizontalScrollbar.dispose();
            this._horizontalScrollbar = undefined;
        }
        try {
            this.xterm?.dispose();
        }
        catch (err) {
            // See https://github.com/microsoft/vscode/issues/153486
            this._logService.error('Exception occurred during xterm disposal', err);
        }
        // HACK: Workaround for Firefox bug https://bugzilla.mozilla.org/show_bug.cgi?id=559561,
        // as 'blur' event in xterm.raw.textarea is not triggered on xterm.dispose()
        // See https://github.com/microsoft/vscode/issues/138358
        if (isFirefox) {
            this.resetFocusContextKey();
            this._terminalHasTextContextKey.reset();
            this._onDidBlur.fire(this);
        }
        if (this._pressAnyKeyToCloseListener) {
            this._pressAnyKeyToCloseListener.dispose();
            this._pressAnyKeyToCloseListener = undefined;
        }
        if (this._exitReason === undefined) {
            this._exitReason = reason ?? TerminalExitReason.Unknown;
        }
        this._processManager.dispose();
        // Process manager dispose/shutdown doesn't fire process exit, trigger with undefined if it
        // hasn't happened yet
        this._onProcessExit(undefined);
        this._onDisposed.fire(this);
        super.dispose();
    }
    async detachProcessAndDispose(reason) {
        // Detach the process and dispose the instance, without the instance dispose the terminal
        // won't go away. Force persist if the detach was requested by the user (not shutdown).
        await this._processManager.detachFromProcess(reason === TerminalExitReason.User);
        this.dispose(reason);
    }
    focus(force) {
        this._refreshAltBufferContextKey();
        if (!this.xterm) {
            return;
        }
        if (force || !dom.getActiveWindow().getSelection()?.toString()) {
            this.xterm.raw.focus();
            this._onDidRequestFocus.fire();
        }
    }
    async focusWhenReady(force) {
        await this._xtermReadyPromise;
        await this._attachBarrier.wait();
        this.focus(force);
    }
    async sendText(text, shouldExecute, bracketedPasteMode) {
        // Apply bracketed paste sequences if the terminal has the mode enabled, this will prevent
        // the text from triggering keybindings and ensure new lines are handled properly
        if (bracketedPasteMode && this.xterm?.raw.modes.bracketedPasteMode) {
            text = `\x1b[200~${text}\x1b[201~`;
        }
        // Normalize line endings to 'enter' press.
        text = text.replace(/\r?\n/g, '\r');
        if (shouldExecute && !text.endsWith('\r')) {
            text += '\r';
        }
        // Send it to the process
        this._logService.debug('sending data (vscode)', text);
        await this._processManager.write(text);
        this._onDidInputData.fire(text);
        this._onDidSendText.fire(text);
        this.xterm?.scrollToBottom();
        if (shouldExecute) {
            this._onDidExecuteText.fire();
        }
    }
    async sendSignal(signal) {
        this._logService.debug('sending signal (vscode)', signal);
        await this._processManager.sendSignal(signal);
    }
    async sendPath(originalPath, shouldExecute) {
        return this.sendText(await this.preparePathForShell(originalPath), shouldExecute);
    }
    async preparePathForShell(originalPath) {
        // Wait for shell type to be ready
        await this.processReady;
        return preparePathForShell(originalPath, this.shellLaunchConfig.executable, this.title, this.shellType, this._processManager.backend, this._processManager.os);
    }
    async getUriLabelForShell(uri) {
        // Wait for shell type to be ready
        await this.processReady;
        return getUriLabelForShell(uri, this._processManager.backend, this.shellType, this.os);
    }
    setVisible(visible) {
        const didChange = this._isVisible !== visible;
        this._isVisible = visible;
        this._wrapperElement.classList.toggle('active', visible);
        if (visible && this.xterm) {
            this._open();
            // Flush any pending resizes
            this._resizeDebouncer?.flush();
            // Resize to re-evaluate dimensions, this will ensure when switching to a terminal it is
            // using the most up to date dimensions (eg. when terminal is created in the background
            // using cached dimensions of a split terminal).
            this._resize();
        }
        if (didChange) {
            this._onDidChangeVisibility.fire(visible);
        }
    }
    scrollDownLine() {
        this.xterm?.scrollDownLine();
    }
    scrollDownPage() {
        this.xterm?.scrollDownPage();
    }
    scrollToBottom() {
        this.xterm?.scrollToBottom();
    }
    scrollUpLine() {
        this.xterm?.scrollUpLine();
    }
    scrollUpPage() {
        this.xterm?.scrollUpPage();
    }
    scrollToTop() {
        this.xterm?.scrollToTop();
    }
    clearBuffer() {
        this._processManager.clearBuffer();
        this.xterm?.clearBuffer();
    }
    _refreshSelectionContextKey() {
        const isActive = !!this._viewsService.getActiveViewWithId(TERMINAL_VIEW_ID);
        let isEditorActive = false;
        const editor = this._editorService.activeEditor;
        if (editor) {
            isEditorActive = editor instanceof TerminalEditorInput;
        }
        this._terminalHasTextContextKey.set((isActive || isEditorActive) && this.hasSelection());
    }
    _createProcessManager() {
        let deserializedCollections;
        if (this.shellLaunchConfig.attachPersistentProcess?.environmentVariableCollections) {
            deserializedCollections = deserializeEnvironmentVariableCollections(this.shellLaunchConfig.attachPersistentProcess.environmentVariableCollections);
        }
        const processManager = this._scopedInstantiationService.createInstance(TerminalProcessManager, this._instanceId, this.shellLaunchConfig?.cwd, deserializedCollections, this.shellLaunchConfig.shellIntegrationNonce ?? this.shellLaunchConfig.attachPersistentProcess?.shellIntegrationNonce);
        this.capabilities.add(processManager.capabilities);
        this._register(processManager.onProcessReady(async (e) => {
            this._onProcessIdReady.fire(this);
            this._initialCwd = await this.getInitialCwd();
            // Set the initial name based on the _resolved_ shell launch config, this will also
            // ensure the resolved icon gets shown
            if (!this._labelComputer) {
                this._labelComputer = this._register(this._scopedInstantiationService.createInstance(TerminalLabelComputer));
                this._register(this._labelComputer.onDidChangeLabel(e => {
                    const wasChanged = this._title !== e.title || this._description !== e.description;
                    if (wasChanged) {
                        this._title = e.title;
                        this._description = e.description;
                        this._onTitleChanged.fire(this);
                    }
                }));
            }
            if (this._shellLaunchConfig.name) {
                this._setTitle(this._shellLaunchConfig.name, TitleEventSource.Api);
            }
            else {
                // Listen to xterm.js' sequence title change event, trigger this async to ensure
                // _xtermReadyPromise is ready constructed since this is called from the ctor
                setTimeout(() => {
                    this._xtermReadyPromise.then(xterm => {
                        if (xterm) {
                            this._messageTitleDisposable.value = xterm.raw.onTitleChange(e => this._onTitleChange(e));
                        }
                    });
                });
                this._setTitle(this._shellLaunchConfig.executable, TitleEventSource.Process);
            }
        }));
        this._register(processManager.onProcessExit(exitCode => this._onProcessExit(exitCode)));
        this._register(processManager.onDidChangeProperty(({ type, value }) => {
            switch (type) {
                case "cwd" /* ProcessPropertyType.Cwd */:
                    this._cwd = value;
                    this._labelComputer?.refreshLabel(this);
                    break;
                case "initialCwd" /* ProcessPropertyType.InitialCwd */:
                    this._initialCwd = value;
                    this._cwd = this._initialCwd;
                    this._setTitle(this.title, TitleEventSource.Config);
                    this._icon = this._shellLaunchConfig.attachPersistentProcess?.icon || this._shellLaunchConfig.icon;
                    this._onIconChanged.fire({ instance: this, userInitiated: false });
                    break;
                case "title" /* ProcessPropertyType.Title */:
                    this._setTitle(value ?? '', TitleEventSource.Process);
                    break;
                case "overrideDimensions" /* ProcessPropertyType.OverrideDimensions */:
                    this.setOverrideDimensions(value, true);
                    break;
                case "resolvedShellLaunchConfig" /* ProcessPropertyType.ResolvedShellLaunchConfig */:
                    this._setResolvedShellLaunchConfig(value);
                    break;
                case "shellType" /* ProcessPropertyType.ShellType */:
                    this.setShellType(value);
                    break;
                case "hasChildProcesses" /* ProcessPropertyType.HasChildProcesses */:
                    this._onDidChangeHasChildProcesses.fire(value);
                    break;
                case "usedShellIntegrationInjection" /* ProcessPropertyType.UsedShellIntegrationInjection */:
                    this._usedShellIntegrationInjection = true;
                    break;
                case "shellIntegrationInjectionFailureReason" /* ProcessPropertyType.ShellIntegrationInjectionFailureReason */:
                    this._shellIntegrationInjectionInfo = value;
                    break;
            }
        }));
        this._initialDataEventsListener.value = processManager.onProcessData(ev => this._initialDataEvents?.push(ev.data));
        this._register(processManager.onProcessReplayComplete(() => this._onProcessReplayComplete.fire()));
        this._register(processManager.onEnvironmentVariableInfoChanged(e => this._onEnvironmentVariableInfoChanged(e)));
        this._register(processManager.onPtyDisconnect(() => {
            if (this.xterm) {
                this.xterm.raw.options.disableStdin = true;
            }
            this.statusList.add({
                id: "disconnected" /* TerminalStatus.Disconnected */,
                severity: Severity.Error,
                icon: Codicon.debugDisconnect,
                tooltip: nls.localize('disconnectStatus', "Lost connection to process")
            });
        }));
        this._register(processManager.onPtyReconnect(() => {
            if (this.xterm) {
                this.xterm.raw.options.disableStdin = false;
            }
            this.statusList.remove("disconnected" /* TerminalStatus.Disconnected */);
        }));
        return processManager;
    }
    async _createProcess() {
        if (this.isDisposed) {
            return;
        }
        const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot(Schemas.file);
        if (activeWorkspaceRootUri) {
            const trusted = await this._trust();
            if (!trusted) {
                this._onProcessExit({ message: nls.localize('workspaceNotTrustedCreateTerminal', "Cannot launch a terminal process in an untrusted workspace") });
            }
        }
        else if (this._cwd && this._userHome && this._cwd !== this._userHome) {
            // something strange is going on if cwd is not userHome in an empty workspace
            this._onProcessExit({
                message: nls.localize('workspaceNotTrustedCreateTerminalCwd', "Cannot launch a terminal process in an untrusted workspace with cwd {0} and userHome {1}", this._cwd, this._userHome)
            });
        }
        // Re-evaluate dimensions if the container has been set since the xterm instance was created
        if (this._container && this._cols === 0 && this._rows === 0) {
            this._initDimensions();
            this.xterm?.resize(this._cols || 80 /* Constants.DefaultCols */, this._rows || 30 /* Constants.DefaultRows */);
        }
        const originalIcon = this.shellLaunchConfig.icon;
        await this._processManager.createProcess(this._shellLaunchConfig, this._cols || 80 /* Constants.DefaultCols */, this._rows || 30 /* Constants.DefaultRows */).then(result => {
            if (result) {
                if (hasKey(result, { message: true })) {
                    this._onProcessExit(result);
                }
                else if (hasKey(result, { injectedArgs: true })) {
                    this._injectedArgs = result.injectedArgs;
                }
            }
        });
        if (this.isDisposed) {
            return;
        }
        if (originalIcon !== this.shellLaunchConfig.icon || this.shellLaunchConfig.color) {
            this._icon = this._shellLaunchConfig.attachPersistentProcess?.icon || this._shellLaunchConfig.icon;
            this._onIconChanged.fire({ instance: this, userInitiated: false });
        }
    }
    registerMarker(offset) {
        return this.xterm?.raw.registerMarker(offset);
    }
    addBufferMarker(properties) {
        this.capabilities.get(4 /* TerminalCapability.BufferMarkDetection */)?.addMark(properties);
    }
    scrollToMark(startMarkId, endMarkId, highlight) {
        this.xterm?.markTracker.scrollToClosestMarker(startMarkId, endMarkId, highlight);
    }
    async freePortKillProcess(port, command) {
        await this._processManager?.freePortKillProcess(port);
        this.runCommand(command, false);
    }
    _onProcessData(ev) {
        // Ensure events are split by SI command execute and command finished sequence to ensure the
        // output of the command can be read by extensions and the output of the command is of a
        // consistent form respectively. This must be done here as xterm.js does not currently have
        // a listener for when individual data events are parsed, only `onWriteParsed` which fires
        // when the write buffer is flushed.
        const leadingSegmentedData = [];
        const matches = ev.data.matchAll(/(?<seq>\x1b\][16]33;(?:C|D(?:;\d+)?)\x07)/g);
        let i = 0;
        for (const match of matches) {
            if (match.groups?.seq === undefined) {
                throw new BugIndicatingError('seq must be defined');
            }
            leadingSegmentedData.push(ev.data.substring(i, match.index));
            leadingSegmentedData.push(match.groups?.seq ?? '');
            i = match.index + match[0].length;
        }
        const lastData = ev.data.substring(i);
        // Write all leading segmented data first, followed by the last data, tracking commit if
        // necessary
        for (let i = 0; i < leadingSegmentedData.length; i++) {
            this._writeProcessData(leadingSegmentedData[i]);
        }
        if (ev.trackCommit) {
            ev.writePromise = new Promise(r => this._writeProcessData(lastData, r));
        }
        else {
            this._writeProcessData(lastData);
        }
    }
    _writeProcessData(data, cb) {
        this._onWillData.fire(data);
        const messageId = ++this._latestXtermWriteData;
        this.xterm?.raw.write(data, () => {
            this._latestXtermParseData = messageId;
            this._processManager.acknowledgeDataEvent(data.length);
            cb?.();
            this._onData.fire(data);
        });
    }
    /**
     * Called when either a process tied to a terminal has exited or when a terminal renderer
     * simulates a process exiting (e.g. custom execution task).
     * @param exitCode The exit code of the process, this is undefined when the terminal was exited
     * through user action.
     */
    async _onProcessExit(exitCodeOrError) {
        // Prevent dispose functions being triggered multiple times
        if (this._isExiting) {
            return;
        }
        const parsedExitResult = parseExitResult(exitCodeOrError, this.shellLaunchConfig, this._processManager.processState, this._initialCwd);
        if (this._usedShellIntegrationInjection && this._processManager.processState === 4 /* ProcessState.KilledDuringLaunch */ && parsedExitResult?.code !== 0) {
            this._relaunchWithShellIntegrationDisabled(parsedExitResult?.message);
            this._onExit.fire(exitCodeOrError);
            return;
        }
        this._isExiting = true;
        await this._flushXtermData();
        this._exitCode = parsedExitResult?.code;
        const exitMessage = parsedExitResult?.message;
        this._logService.debug('Terminal process exit', 'instanceId', this.instanceId, 'code', this._exitCode, 'processState', this._processManager.processState);
        // Only trigger wait on exit when the exit was *not* triggered by the
        // user (via the `workbench.action.terminal.kill` command).
        const waitOnExit = this.waitOnExit;
        if (waitOnExit && this._processManager.processState !== 5 /* ProcessState.KilledByUser */) {
            this._xtermReadyPromise.then(xterm => {
                if (!xterm) {
                    return;
                }
                if (exitMessage) {
                    xterm.raw.write(formatMessageForTerminal(exitMessage));
                }
                switch (typeof waitOnExit) {
                    case 'string':
                        xterm.raw.write(formatMessageForTerminal(waitOnExit, { excludeLeadingNewLine: true }));
                        break;
                    case 'function':
                        if (this.exitCode !== undefined) {
                            xterm.raw.write(formatMessageForTerminal(waitOnExit(this.exitCode), { excludeLeadingNewLine: true }));
                        }
                        break;
                }
                // Disable all input if the terminal is exiting and listen for next keypress
                xterm.raw.options.disableStdin = true;
                if (xterm.raw.textarea) {
                    this._attachPressAnyKeyToCloseListener(xterm.raw);
                }
            });
        }
        else {
            if (exitMessage) {
                const failedDuringLaunch = this._processManager.processState === 4 /* ProcessState.KilledDuringLaunch */;
                if (failedDuringLaunch || (this._terminalConfigurationService.config.showExitAlert && this.xterm?.lastInputEvent !== /*Ctrl+D*/ '\x04')) {
                    // Always show launch failures
                    this._notificationService.notify({
                        message: exitMessage,
                        severity: Severity.Error,
                        actions: { primary: [this._scopedInstantiationService.createInstance(TerminalLaunchHelpAction)] }
                    });
                }
                else {
                    // Log to help surface the error in case users report issues with showExitAlert
                    // disabled
                    this._logService.warn(exitMessage);
                }
            }
            this.dispose(TerminalExitReason.Process);
        }
        // First onExit to consumers, this can happen after the terminal has already been disposed.
        this._onExit.fire(exitCodeOrError);
        // Dispose of the onExit event if the terminal will not be reused again
        if (this.isDisposed) {
            this._onExit.dispose();
        }
    }
    _relaunchWithShellIntegrationDisabled(exitMessage) {
        this._shellLaunchConfig.ignoreShellIntegration = true;
        this.relaunch();
        this.statusList.add({
            id: "shell-integration-attention-needed" /* TerminalStatus.ShellIntegrationAttentionNeeded */,
            severity: Severity.Warning,
            icon: Codicon.warning,
            tooltip: `${exitMessage} ` + nls.localize('launchFailed.exitCodeOnlyShellIntegration', 'Disabling shell integration in user settings might help.'),
            hoverActions: [{
                    commandId: "workbench.action.terminal.learnMore" /* TerminalCommandId.ShellIntegrationLearnMore */,
                    label: nls.localize('shellIntegration.learnMore', "Learn more about shell integration"),
                    run: () => {
                        this._openerService.open('https://code.visualstudio.com/docs/editor/integrated-terminal#_shell-integration');
                    }
                }, {
                    commandId: 'workbench.action.openSettings',
                    label: nls.localize('shellIntegration.openSettings', "Open user settings"),
                    run: () => {
                        this._commandService.executeCommand('workbench.action.openSettings', 'terminal.integrated.shellIntegration.enabled');
                    }
                }]
        });
        this._telemetryService.publicLog2('terminal/shellIntegrationFailureProcessExit');
    }
    /**
     * Ensure write calls to xterm.js have finished before resolving.
     */
    _flushXtermData() {
        if (this._latestXtermWriteData === this._latestXtermParseData) {
            return Promise.resolve();
        }
        let retries = 0;
        return new Promise(r => {
            const interval = dom.disposableWindowInterval(dom.getActiveWindow().window, () => {
                if (this._latestXtermWriteData === this._latestXtermParseData || ++retries === 5) {
                    interval.dispose();
                    r();
                }
            }, 20);
        });
    }
    _attachPressAnyKeyToCloseListener(xterm) {
        if (xterm.textarea && !this._pressAnyKeyToCloseListener) {
            this._pressAnyKeyToCloseListener = dom.addDisposableListener(xterm.textarea, 'keypress', (event) => {
                if (this._pressAnyKeyToCloseListener) {
                    this._pressAnyKeyToCloseListener.dispose();
                    this._pressAnyKeyToCloseListener = undefined;
                    this.dispose(TerminalExitReason.Process);
                    event.preventDefault();
                }
            });
        }
    }
    _writeInitialText(xterm, callback) {
        if (!this._shellLaunchConfig.initialText) {
            callback?.();
            return;
        }
        const text = isString(this._shellLaunchConfig.initialText)
            ? this._shellLaunchConfig.initialText
            : this._shellLaunchConfig.initialText?.text;
        if (isString(this._shellLaunchConfig.initialText)) {
            xterm.raw.writeln(text, callback);
        }
        else {
            if (this._shellLaunchConfig.initialText.trailingNewLine) {
                xterm.raw.writeln(text, callback);
            }
            else {
                xterm.raw.write(text, callback);
            }
        }
    }
    async reuseTerminal(shell, reset = false) {
        // Unsubscribe any key listener we may have.
        this._pressAnyKeyToCloseListener?.dispose();
        this._pressAnyKeyToCloseListener = undefined;
        const xterm = this.xterm;
        if (xterm) {
            if (!reset) {
                // Ensure new processes' output starts at start of new line
                await new Promise(r => xterm.raw.write('\n\x1b[G', r));
            }
            // Print initialText if specified
            if (shell.initialText) {
                this._shellLaunchConfig.initialText = shell.initialText;
                await new Promise(r => this._writeInitialText(xterm, r));
            }
            // Clean up waitOnExit state
            if (this._isExiting && this._shellLaunchConfig.waitOnExit) {
                xterm.raw.options.disableStdin = false;
                this._isExiting = false;
            }
            if (reset) {
                xterm.clearDecorations();
            }
        }
        // Dispose the environment info widget if it exists
        this.statusList.remove("relaunch-needed" /* TerminalStatus.RelaunchNeeded */);
        if (!reset) {
            // HACK: Force initialText to be non-falsy for reused terminals such that the
            // conptyInheritCursor flag is passed to the node-pty, this flag can cause a Window to stop
            // responding in Windows 10 1903 so we only want to use it when something is definitely written
            // to the terminal.
            shell.initialText = ' ';
        }
        // Set the new shell launch config
        this._shellLaunchConfig = shell; // Must be done before calling _createProcess()
        await this._processManager.relaunch(this._shellLaunchConfig, this._cols || 80 /* Constants.DefaultCols */, this._rows || 30 /* Constants.DefaultRows */, reset).then(result => {
            if (result) {
                if (hasKey(result, { message: true })) {
                    this._onProcessExit(result);
                }
                else if (hasKey(result, { injectedArgs: true })) {
                    this._injectedArgs = result.injectedArgs;
                }
            }
        });
    }
    relaunch() {
        // Clear the attachPersistentProcess flag to ensure we create a new process
        // instead of trying to reattach to the existing one during relaunch.
        const shellLaunchConfig = { ...this._shellLaunchConfig };
        delete shellLaunchConfig.attachPersistentProcess;
        this.reuseTerminal(shellLaunchConfig, true);
    }
    _onTitleChange(title) {
        if (this.isTitleSetByProcess) {
            this._setTitle(title, TitleEventSource.Sequence);
        }
    }
    async _trust() {
        return (await this._workspaceTrustRequestService.requestWorkspaceTrust({
            message: nls.localize('terminal.requestTrust', "Creating a terminal process requires executing code")
        })) === true;
    }
    async _updateProcessCwd() {
        if (this.isDisposed || this.shellLaunchConfig.customPtyImplementation) {
            return;
        }
        // reset cwd if it has changed, so file based url paths can be resolved
        try {
            const cwd = await this._refreshProperty("cwd" /* ProcessPropertyType.Cwd */);
            if (!isString(cwd)) {
                throw new Error(`cwd is not a string ${cwd}`);
            }
        }
        catch (e) {
            // Swallow this as it means the process has been killed
            if (e instanceof Error && e.message === 'Cannot refresh property when process is not set') {
                return;
            }
            throw e;
        }
    }
    updateConfig() {
        this._setCommandsToSkipShell(this._terminalConfigurationService.config.commandsToSkipShell);
        this._refreshEnvironmentVariableInfoWidgetState(this._processManager.environmentVariableInfo);
    }
    async _updateUnicodeVersion() {
        this._processManager.setUnicodeVersion(this._terminalConfigurationService.config.unicodeVersion);
    }
    updateAccessibilitySupport() {
        this.xterm.raw.options.screenReaderMode = this._accessibilityService.isScreenReaderOptimized();
    }
    _setCommandsToSkipShell(commands) {
        const excludeCommands = commands.filter(command => command[0] === '-').map(command => command.slice(1));
        this._skipTerminalCommands = DEFAULT_COMMANDS_TO_SKIP_SHELL.filter(defaultCommand => {
            return !excludeCommands.includes(defaultCommand);
        }).concat(commands);
    }
    layout(dimension) {
        this._lastLayoutDimensions = dimension;
        if (this.disableLayout) {
            return;
        }
        // Don't layout if dimensions are invalid (eg. the container is not attached to the DOM or
        // if display: none
        if (dimension.width <= 0 || dimension.height <= 0) {
            return;
        }
        // Evaluate columns and rows, exclude the wrapper element's margin
        const terminalWidth = this._evaluateColsAndRows(dimension.width, dimension.height);
        if (!terminalWidth) {
            return;
        }
        this._resize();
        // Signal the container is ready
        if (!this._containerReadyBarrier.isOpen()) {
            this._containerReadyBarrier.open();
        }
        // Layout all contributions
        for (const contribution of this._contributions.values()) {
            if (!this.xterm) {
                this._xtermReadyPromise.then(xterm => {
                    if (xterm) {
                        contribution.layout?.(xterm, dimension);
                    }
                });
            }
            else {
                contribution.layout?.(this.xterm, dimension);
            }
        }
    }
    async _resize(immediate) {
        if (!this.xterm) {
            return;
        }
        let cols = this.cols;
        let rows = this.rows;
        // Only apply these settings when the terminal is visible so that
        // the characters are measured correctly.
        if (this._isVisible && this._layoutSettingsChanged) {
            const font = this.xterm.getFont();
            const config = this._terminalConfigurationService.config;
            this.xterm.raw.options.letterSpacing = font.letterSpacing;
            this.xterm.raw.options.lineHeight = font.lineHeight;
            this.xterm.raw.options.fontSize = font.fontSize;
            this.xterm.raw.options.fontFamily = font.fontFamily;
            this.xterm.raw.options.fontWeight = config.fontWeight;
            this.xterm.raw.options.fontWeightBold = config.fontWeightBold;
            // Any of the above setting changes could have changed the dimensions of the
            // terminal, re-evaluate now.
            this._initDimensions();
            cols = this.cols;
            rows = this.rows;
            this._layoutSettingsChanged = false;
        }
        if (isNaN(cols) || isNaN(rows)) {
            return;
        }
        if (cols !== this.xterm.raw.cols || rows !== this.xterm.raw.rows) {
            if (this._fixedRows || this._fixedCols) {
                await this._updateProperty("fixedDimensions" /* ProcessPropertyType.FixedDimensions */, { cols: this._fixedCols, rows: this._fixedRows });
            }
            this._onDimensionsChanged.fire();
        }
        TerminalInstance_1._lastKnownGridDimensions = { cols, rows };
        this._resizeDebouncer.resize(cols, rows, immediate ?? false);
    }
    async _updatePtyDimensions(rawXterm) {
        await this._processManager.setDimensions(rawXterm.cols, rawXterm.rows);
    }
    setShellType(shellType) {
        if (this._shellType === shellType) {
            return;
        }
        this._shellType = shellType;
        if (shellType === undefined) {
            this._terminalShellTypeContextKey.reset();
        }
        else {
            this._terminalShellTypeContextKey.set(shellType?.toString());
        }
        this._onDidChangeShellType.fire(shellType);
    }
    _setAriaLabel(xterm, terminalId, title) {
        const labelParts = [];
        if (xterm && xterm.textarea) {
            if (title && title.length > 0) {
                labelParts.push(nls.localize('terminalTextBoxAriaLabelNumberAndTitle', "Terminal {0}, {1}", terminalId, title));
            }
            else {
                labelParts.push(nls.localize('terminalTextBoxAriaLabel', "Terminal {0}", terminalId));
            }
            const screenReaderOptimized = this._accessibilityService.isScreenReaderOptimized();
            if (!screenReaderOptimized) {
                labelParts.push(nls.localize('terminalScreenReaderMode', "Run the command: Toggle Screen Reader Accessibility Mode for an optimized screen reader experience"));
            }
            const accessibilityHelpKeybinding = this._keybindingService.lookupKeybinding("editor.action.accessibilityHelp" /* AccessibilityCommandId.OpenAccessibilityHelp */)?.getLabel();
            if (this._configurationService.getValue("accessibility.verbosity.terminal" /* AccessibilityVerbositySettingId.Terminal */) && accessibilityHelpKeybinding) {
                labelParts.push(nls.localize('terminalHelpAriaLabel', "Use {0} for terminal accessibility help", accessibilityHelpKeybinding));
            }
            xterm.textarea.setAttribute('aria-label', labelParts.join('\n'));
        }
    }
    _updateTitleProperties(title, eventSource) {
        if (!title) {
            return this._processName;
        }
        switch (eventSource) {
            case TitleEventSource.Process:
                if (this._processManager.os === 1 /* OperatingSystem.Windows */) {
                    // Extract the file name without extension
                    title = path.win32.parse(title).name;
                }
                else {
                    const firstSpaceIndex = title.indexOf(' ');
                    if (title.startsWith('/')) {
                        title = path.basename(title);
                    }
                    else if (firstSpaceIndex > -1) {
                        title = title.substring(0, firstSpaceIndex);
                    }
                }
                this._processName = title;
                break;
            case TitleEventSource.Api:
                // If the title has not been set by the API or the rename command, unregister the handler that
                // automatically updates the terminal name
                this._staticTitle = title;
                this._messageTitleDisposable.value = undefined;
                break;
            case TitleEventSource.Sequence:
                // On Windows, some shells will fire this with the full path which we want to trim
                // to show just the file name. This should only happen if the title looks like an
                // absolute Windows file path
                this._sequence = title;
                if (this._processManager.os === 1 /* OperatingSystem.Windows */ &&
                    title.match(/^[a-zA-Z]:\\.+\.[a-zA-Z]{1,3}/)) {
                    this._sequence = path.win32.parse(title).name;
                }
                break;
        }
        this._titleSource = eventSource;
        return title;
    }
    setOverrideDimensions(dimensions, immediate = false) {
        if (this._dimensionsOverride && this._dimensionsOverride.forceExactSize && !dimensions && this._rows === 0 && this._cols === 0) {
            // this terminal never had a real size => keep the last dimensions override exact size
            this._cols = this._dimensionsOverride.cols;
            this._rows = this._dimensionsOverride.rows;
        }
        this._dimensionsOverride = dimensions;
        if (immediate) {
            this._resize(true);
        }
        else {
            this._resize();
        }
    }
    async setFixedDimensions() {
        const cols = await this._quickInputService.input({
            title: nls.localize('setTerminalDimensionsColumn', "Set Fixed Dimensions: Column"),
            placeHolder: 'Enter a number of columns or leave empty for automatic width',
            validateInput: async (text) => text.length > 0 && !text.match(/^\d+$/) ? { content: 'Enter a number or leave empty size automatically', severity: Severity.Error } : undefined
        });
        if (cols === undefined) {
            return;
        }
        this._fixedCols = this._parseFixedDimension(cols);
        this._labelComputer?.refreshLabel(this);
        this._terminalHasFixedWidth.set(!!this._fixedCols);
        const rows = await this._quickInputService.input({
            title: nls.localize('setTerminalDimensionsRow', "Set Fixed Dimensions: Row"),
            placeHolder: 'Enter a number of rows or leave empty for automatic height',
            validateInput: async (text) => text.length > 0 && !text.match(/^\d+$/) ? { content: 'Enter a number or leave empty size automatically', severity: Severity.Error } : undefined
        });
        if (rows === undefined) {
            return;
        }
        this._fixedRows = this._parseFixedDimension(rows);
        this._labelComputer?.refreshLabel(this);
        await this._refreshScrollbar();
        this._resize();
        this.focus();
    }
    _parseFixedDimension(value) {
        if (value === '') {
            return undefined;
        }
        const parsed = parseInt(value);
        if (parsed <= 0) {
            throw new Error(`Could not parse dimension "${value}"`);
        }
        return parsed;
    }
    async toggleSizeToContentWidth() {
        if (!this.xterm?.raw.buffer.active) {
            return;
        }
        if (this._hasScrollBar) {
            this._terminalHasFixedWidth.set(false);
            this._fixedCols = undefined;
            this._fixedRows = undefined;
            this._hasScrollBar = false;
            this._initDimensions();
            await this._resize();
        }
        else {
            const font = this.xterm ? this.xterm.getFont() : this._terminalConfigurationService.getFont(dom.getWindow(this.domElement));
            const maxColsForTexture = Math.floor(4096 /* Constants.MaxCanvasWidth */ / (font.charWidth ?? 20));
            // Fixed columns should be at least xterm.js' regular column count
            const proposedCols = Math.max(this.maxCols, Math.min(this.xterm.getLongestViewportWrappedLineLength(), maxColsForTexture));
            // Don't switch to fixed dimensions if the content already fits as it makes the scroll
            // bar look bad being off the edge
            if (proposedCols > this.xterm.raw.cols) {
                this._fixedCols = proposedCols;
            }
        }
        await this._refreshScrollbar();
        this._labelComputer?.refreshLabel(this);
        this.focus();
    }
    _refreshScrollbar() {
        if (this._fixedCols || this._fixedRows) {
            return this._addScrollbar();
        }
        return this._removeScrollbar();
    }
    async _addScrollbar() {
        const charWidth = (this.xterm ? this.xterm.getFont() : this._terminalConfigurationService.getFont(dom.getWindow(this.domElement))).charWidth;
        if (!this.xterm?.raw.element || !this._container || !charWidth || !this._fixedCols) {
            return;
        }
        this._wrapperElement.classList.add('fixed-dims');
        this._hasScrollBar = true;
        this._initDimensions();
        await this._resize();
        this._terminalHasFixedWidth.set(true);
        if (!this._horizontalScrollbar) {
            this._horizontalScrollbar = this._register(new DomScrollableElement(this._wrapperElement, {
                vertical: 2 /* ScrollbarVisibility.Hidden */,
                horizontal: 1 /* ScrollbarVisibility.Auto */,
                useShadows: false,
                scrollYToX: false,
                consumeMouseWheelIfScrollbarIsNeeded: false
            }));
            this._container.appendChild(this._horizontalScrollbar.getDomNode());
        }
        this._horizontalScrollbar.setScrollDimensions({
            width: this.xterm.raw.element.clientWidth,
            scrollWidth: this._fixedCols * charWidth + 40 // Padding + scroll bar
        });
        this._horizontalScrollbar.getDomNode().style.paddingBottom = '16px';
        // work around for https://github.com/xtermjs/xterm.js/issues/3482
        if (isWindows) {
            for (let i = this.xterm.raw.buffer.active.viewportY; i < this.xterm.raw.buffer.active.length; i++) {
                const line = this.xterm.raw.buffer.active.getLine(i);
                line._line.isWrapped = false;
            }
        }
    }
    async _removeScrollbar() {
        if (!this._container || !this._horizontalScrollbar) {
            return;
        }
        this._horizontalScrollbar.getDomNode().remove();
        this._horizontalScrollbar.dispose();
        this._horizontalScrollbar = undefined;
        this._wrapperElement.remove();
        this._wrapperElement.classList.remove('fixed-dims');
        this._container.appendChild(this._wrapperElement);
    }
    _setResolvedShellLaunchConfig(shellLaunchConfig) {
        this._shellLaunchConfig.args = shellLaunchConfig.args;
        this._shellLaunchConfig.cwd = shellLaunchConfig.cwd;
        this._shellLaunchConfig.executable = shellLaunchConfig.executable;
        this._shellLaunchConfig.env = shellLaunchConfig.env;
    }
    _onEnvironmentVariableInfoChanged(info) {
        if (info.requiresAction) {
            this.xterm?.raw.textarea?.setAttribute('aria-label', nls.localize('terminalStaleTextBoxAriaLabel', "Terminal {0} environment is stale, run the 'Show Environment Information' command for more information", this._instanceId));
        }
        this._refreshEnvironmentVariableInfoWidgetState(info);
    }
    async _refreshEnvironmentVariableInfoWidgetState(info) {
        // Check if the status should exist
        if (!info) {
            this.statusList.remove("relaunch-needed" /* TerminalStatus.RelaunchNeeded */);
            this.statusList.remove("env-var-info-changes-active" /* TerminalStatus.EnvironmentVariableInfoChangesActive */);
            return;
        }
        // Recreate the process seamlessly without informing the use if the following conditions are
        // met.
        if (
        // The change requires a relaunch
        info.requiresAction &&
            // The feature is enabled
            this._terminalConfigurationService.config.environmentChangesRelaunch &&
            // Has not been interacted with
            !this._processManager.hasWrittenData &&
            // Not a feature terminal or is a reconnecting task terminal (TODO: Need to explain the latter case)
            (!this._shellLaunchConfig.isFeatureTerminal || (this.reconnectionProperties && this._configurationService.getValue('task.reconnection') === true)) &&
            // Not a custom pty
            !this._shellLaunchConfig.customPtyImplementation &&
            // Not an extension owned terminal
            !this._shellLaunchConfig.isExtensionOwnedTerminal &&
            // Not a reconnected or revived terminal
            !this._shellLaunchConfig.attachPersistentProcess &&
            // Not a Windows remote using ConPTY (#187084)
            !(this._processManager.remoteAuthority && this._terminalConfigurationService.config.windowsEnableConpty && (await this._processManager.getBackendOS()) === 1 /* OperatingSystem.Windows */)) {
            this.relaunch();
            return;
        }
        // Re-create statuses
        const workspaceFolder = getWorkspaceForTerminal(this.shellLaunchConfig.cwd, this._workspaceContextService, this._historyService);
        this.statusList.add(info.getStatus({ workspaceFolder }));
    }
    async getInitialCwd() {
        if (!this._initialCwd) {
            this._initialCwd = this._processManager.initialCwd;
        }
        return this._initialCwd;
    }
    async getSpeculativeCwd() {
        if (this.capabilities.has(0 /* TerminalCapability.CwdDetection */)) {
            return this.capabilities.get(0 /* TerminalCapability.CwdDetection */).getCwd();
        }
        else if (this.capabilities.has(1 /* TerminalCapability.NaiveCwdDetection */)) {
            return this.capabilities.get(1 /* TerminalCapability.NaiveCwdDetection */).getCwd();
        }
        return this._processManager.initialCwd;
    }
    async getCwdResource() {
        const cwd = this.capabilities.get(0 /* TerminalCapability.CwdDetection */)?.getCwd();
        if (!cwd) {
            return undefined;
        }
        let resource;
        if (this.remoteAuthority) {
            resource = await this._pathService.fileURI(cwd);
        }
        else {
            resource = URI.file(cwd);
        }
        if (await this._fileService.exists(resource)) {
            return resource;
        }
        return undefined;
    }
    async _refreshProperty(type) {
        await this.processReady;
        return this._processManager.refreshProperty(type);
    }
    async _updateProperty(type, value) {
        return this._processManager.updateProperty(type, value);
    }
    async rename(title, source) {
        this._setTitle(title, source ?? TitleEventSource.Api);
    }
    _setTitle(title, eventSource) {
        if ((this._shellLaunchConfig?.type === 'Task' || this._titleSource === TitleEventSource.Api) && eventSource === TitleEventSource.Process) {
            return;
        }
        const reset = !title;
        title = this._updateTitleProperties(title, eventSource);
        const titleChanged = title !== this._title;
        this._title = title;
        this._labelComputer?.refreshLabel(this, reset);
        this._setAriaLabel(this.xterm?.raw, this._instanceId, this._title);
        if (titleChanged) {
            this._onTitleChanged.fire(this);
        }
    }
    async changeIcon(icon) {
        if (icon) {
            this._icon = icon;
            this._onIconChanged.fire({ instance: this, userInitiated: true });
            return icon;
        }
        const iconPicker = this._scopedInstantiationService.createInstance(TerminalIconPicker);
        const pickedIcon = await iconPicker.pickIcons();
        iconPicker.dispose();
        if (!pickedIcon) {
            return undefined;
        }
        this._icon = pickedIcon;
        this._onIconChanged.fire({ instance: this, userInitiated: true });
        return pickedIcon;
    }
    async changeColor(color, skipQuickPick) {
        if (color) {
            this.shellLaunchConfig.color = color;
            this._onIconChanged.fire({ instance: this, userInitiated: true });
            return color;
        }
        else if (skipQuickPick) {
            // Reset this tab's color
            this.shellLaunchConfig.color = '';
            this._onIconChanged.fire({ instance: this, userInitiated: true });
            return;
        }
        const icon = this._getIcon();
        if (!icon) {
            return;
        }
        const colorTheme = this._themeService.getColorTheme();
        const standardColors = getStandardColors(colorTheme);
        const colorStyleDisposable = createColorStyleElement(colorTheme);
        const items = [];
        for (const colorKey of standardColors) {
            const colorClass = getColorClass(colorKey);
            items.push({
                label: `$(${Codicon.circleFilled.id}) ${colorKey.replace('terminal.ansi', '')}`, id: colorKey, description: colorKey, iconClasses: [colorClass]
            });
        }
        items.push({ type: 'separator' });
        const showAllColorsItem = { label: 'Reset to default' };
        items.push(showAllColorsItem);
        const disposables = [];
        const quickPick = this._quickInputService.createQuickPick({ useSeparators: true });
        disposables.push(quickPick);
        quickPick.items = items;
        quickPick.matchOnDescription = true;
        quickPick.placeholder = nls.localize('changeColor', 'Select a color for the terminal');
        quickPick.show();
        const result = await new Promise(r => {
            disposables.push(quickPick.onDidHide(() => r(undefined)));
            disposables.push(quickPick.onDidAccept(() => r(quickPick.selectedItems[0])));
        });
        dispose(disposables);
        if (result) {
            this.shellLaunchConfig.color = result.id;
            this._onIconChanged.fire({ instance: this, userInitiated: true });
        }
        quickPick.hide();
        colorStyleDisposable.dispose();
        return result?.id;
    }
    forceScrollbarVisibility() {
        this._wrapperElement.classList.add('force-scrollbar');
    }
    resetScrollbarVisibility() {
        this._wrapperElement.classList.remove('force-scrollbar');
    }
    setParentContextKeyService(parentContextKeyService) {
        this._scopedContextKeyService.updateParent(parentContextKeyService);
    }
    async handleMouseEvent(event, contextMenu) {
        // Don't handle mouse event if it was on the scroll bar
        if (dom.isHTMLElement(event.target) && (event.target.classList.contains('scrollbar') || event.target.classList.contains('slider'))) {
            return { cancelContextMenu: true };
        }
        // Allow contributions to handle the mouse event first
        for (const contrib of this._contributions.values()) {
            const result = await contrib.handleMouseEvent?.(event);
            if (result?.handled) {
                return { cancelContextMenu: true };
            }
        }
        // Middle click
        if (event.which === 2) {
            switch (this._terminalConfigurationService.config.middleClickBehavior) {
                case 'default':
                default:
                    // Drop selection and focus terminal on Linux to enable middle button paste
                    // when click occurs on the selection itself.
                    this.focus();
                    break;
            }
            return;
        }
        // Right click
        if (event.which === 3) {
            // Shift click forces the context menu
            if (event.shiftKey) {
                openContextMenu(dom.getActiveWindow(), event, this, contextMenu, this._contextMenuService);
                return;
            }
            const rightClickBehavior = this._terminalConfigurationService.config.rightClickBehavior;
            if (rightClickBehavior === 'nothing') {
                if (!event.shiftKey) {
                    return { cancelContextMenu: true };
                }
                return;
            }
        }
    }
};
__decorate([
    debounce(50)
], TerminalInstance.prototype, "_fireMaximumDimensionsChanged", null);
__decorate([
    debounce(1000)
], TerminalInstance.prototype, "relaunch", null);
__decorate([
    debounce(2000)
], TerminalInstance.prototype, "_updateProcessCwd", null);
TerminalInstance = TerminalInstance_1 = __decorate([
    __param(2, IContextKeyService),
    __param(3, IContextMenuService),
    __param(4, IInstantiationService),
    __param(5, ITerminalConfigurationService),
    __param(6, ITerminalProfileResolverService),
    __param(7, IPathService),
    __param(8, IFileService),
    __param(9, IKeybindingService),
    __param(10, INotificationService),
    __param(11, IPreferencesService),
    __param(12, IViewsService),
    __param(13, IThemeService),
    __param(14, IConfigurationService),
    __param(15, ITerminalLogService),
    __param(16, IStorageService),
    __param(17, IAccessibilityService),
    __param(18, IProductService),
    __param(19, IQuickInputService),
    __param(20, IWorkbenchEnvironmentService),
    __param(21, IWorkspaceContextService),
    __param(22, IEditorService),
    __param(23, IWorkspaceTrustRequestService),
    __param(24, IHistoryService),
    __param(25, ITelemetryService),
    __param(26, IOpenerService),
    __param(27, ICommandService),
    __param(28, IAccessibilitySignalService),
    __param(29, IViewDescriptorService)
], TerminalInstance);
export { TerminalInstance };
let TerminalInstanceDragAndDropController = class TerminalInstanceDragAndDropController extends Disposable {
    get onDropFile() { return this._onDropFile.event; }
    get onDropTerminal() { return this._onDropTerminal.event; }
    constructor(_container, _layoutService, _viewDescriptorService) {
        super();
        this._container = _container;
        this._layoutService = _layoutService;
        this._viewDescriptorService = _viewDescriptorService;
        this._onDropFile = this._register(new Emitter());
        this._onDropTerminal = this._register(new Emitter());
        this._register(toDisposable(() => this._clearDropOverlay()));
    }
    _clearDropOverlay() {
        this._dropOverlay?.remove();
        this._dropOverlay = undefined;
    }
    onDragEnter(e) {
        if (!containsDragType(e, DataTransfers.FILES, DataTransfers.RESOURCES, "Terminals" /* TerminalDataTransfers.Terminals */, CodeDataTransfers.FILES)) {
            return;
        }
        if (!this._dropOverlay) {
            this._dropOverlay = document.createElement('div');
            this._dropOverlay.classList.add('terminal-drop-overlay');
        }
        // Dragging terminals
        if (containsDragType(e, "Terminals" /* TerminalDataTransfers.Terminals */)) {
            const side = this._getDropSide(e);
            this._dropOverlay.classList.toggle('drop-before', side === 'before');
            this._dropOverlay.classList.toggle('drop-after', side === 'after');
        }
        if (!this._dropOverlay.parentElement) {
            this._container.appendChild(this._dropOverlay);
        }
    }
    onDragLeave(e) {
        this._clearDropOverlay();
    }
    onDragEnd(e) {
        this._clearDropOverlay();
    }
    onDragOver(e) {
        if (!e.dataTransfer || !this._dropOverlay) {
            return;
        }
        // Dragging terminals
        if (containsDragType(e, "Terminals" /* TerminalDataTransfers.Terminals */)) {
            const side = this._getDropSide(e);
            this._dropOverlay.classList.toggle('drop-before', side === 'before');
            this._dropOverlay.classList.toggle('drop-after', side === 'after');
        }
        this._dropOverlay.style.opacity = '1';
    }
    async onDrop(e) {
        this._clearDropOverlay();
        if (!e.dataTransfer) {
            return;
        }
        const terminalResources = getTerminalResourcesFromDragEvent(e);
        if (terminalResources) {
            for (const uri of terminalResources) {
                const side = this._getDropSide(e);
                this._onDropTerminal.fire({ uri, side });
            }
            return;
        }
        // Check if files were dragged from the tree explorer
        let path;
        const rawResources = e.dataTransfer.getData(DataTransfers.RESOURCES);
        if (rawResources) {
            path = URI.parse(JSON.parse(rawResources)[0]);
        }
        const rawCodeFiles = e.dataTransfer.getData(CodeDataTransfers.FILES);
        if (!path && rawCodeFiles) {
            path = URI.file(JSON.parse(rawCodeFiles)[0]);
        }
        if (!path && e.dataTransfer.files.length > 0 && getPathForFile(e.dataTransfer.files[0])) {
            // Check if the file was dragged from the filesystem
            path = URI.file(getPathForFile(e.dataTransfer.files[0]));
        }
        if (!path) {
            return;
        }
        this._onDropFile.fire(path);
    }
    _getDropSide(e) {
        const target = this._container;
        if (!target) {
            return 'after';
        }
        const rect = target.getBoundingClientRect();
        return this._getViewOrientation() === 1 /* Orientation.HORIZONTAL */
            ? (e.clientX - rect.left < rect.width / 2 ? 'before' : 'after')
            : (e.clientY - rect.top < rect.height / 2 ? 'before' : 'after');
    }
    _getViewOrientation() {
        const panelPosition = this._layoutService.getPanelPosition();
        const terminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID);
        return terminalLocation === 1 /* ViewContainerLocation.Panel */ && isHorizontal(panelPosition)
            ? 1 /* Orientation.HORIZONTAL */
            : 0 /* Orientation.VERTICAL */;
    }
};
TerminalInstanceDragAndDropController = __decorate([
    __param(1, IWorkbenchLayoutService),
    __param(2, IViewDescriptorService)
], TerminalInstanceDragAndDropController);
var TerminalLabelType;
(function (TerminalLabelType) {
    TerminalLabelType["Title"] = "title";
    TerminalLabelType["Description"] = "description";
})(TerminalLabelType || (TerminalLabelType = {}));
let TerminalLabelComputer = class TerminalLabelComputer extends Disposable {
    get title() { return this._title; }
    get description() { return this._description; }
    constructor(_fileService, _terminalConfigurationService, _workspaceContextService) {
        super();
        this._fileService = _fileService;
        this._terminalConfigurationService = _terminalConfigurationService;
        this._workspaceContextService = _workspaceContextService;
        this._title = '';
        this._description = '';
        this._onDidChangeLabel = this._register(new Emitter());
        this.onDidChangeLabel = this._onDidChangeLabel.event;
    }
    refreshLabel(instance, reset) {
        this._title = this.computeLabel(instance, this._terminalConfigurationService.config.tabs.title, "title" /* TerminalLabelType.Title */, reset);
        this._description = this.computeLabel(instance, this._terminalConfigurationService.config.tabs.description, "description" /* TerminalLabelType.Description */);
        if (this._title !== instance.title || this._description !== instance.description || reset) {
            this._onDidChangeLabel.fire({ title: this._title, description: this._description });
        }
    }
    computeLabel(instance, labelTemplate, labelType, reset) {
        const type = instance.shellLaunchConfig.attachPersistentProcess?.type || instance.shellLaunchConfig.type;
        const commandDetection = instance.capabilities.get(2 /* TerminalCapability.CommandDetection */);
        const promptInputModel = commandDetection?.promptInputModel;
        const nonTaskSpinner = type === 'Task' ? '' : ' $(loading~spin)';
        const templateProperties = {
            cwd: instance.cwd || instance.initialCwd || '',
            cwdFolder: '',
            workspaceFolderName: instance.workspaceFolder?.name,
            workspaceFolder: instance.workspaceFolder ? path.basename(instance.workspaceFolder.uri.fsPath) : undefined,
            local: type === 'Local' ? terminalStrings.typeLocal : undefined,
            process: instance.processName,
            sequence: instance.sequence,
            task: type === 'Task' ? terminalStrings.typeTask : undefined,
            fixedDimensions: instance.fixedCols
                ? (instance.fixedRows ? `\u2194${instance.fixedCols} \u2195${instance.fixedRows}` : `\u2194${instance.fixedCols}`)
                : (instance.fixedRows ? `\u2195${instance.fixedRows}` : ''),
            separator: { label: this._terminalConfigurationService.config.tabs.separator },
            shellType: instance.shellType,
            // Shell command requires high confidence
            shellCommand: commandDetection?.executingCommand && commandDetection.executingCommandConfidence === 'high' && promptInputModel
                ? promptInputModel.value + nonTaskSpinner
                : undefined,
            // Shell prompt input does not require high confidence as it's largely for VS Code developers
            shellPromptInput: commandDetection?.executingCommand && promptInputModel
                ? promptInputModel.getCombinedString(true) + nonTaskSpinner
                : promptInputModel?.getCombinedString(true),
            progress: this._getProgressStateString(instance.progressState)
        };
        templateProperties.workspaceFolderName = instance.workspaceFolder?.name ?? templateProperties.workspaceFolder;
        labelTemplate = labelTemplate.trim();
        if (!labelTemplate) {
            return labelType === "title" /* TerminalLabelType.Title */ ? (instance.processName || '') : '';
        }
        if (!reset && instance.staticTitle && labelType === "title" /* TerminalLabelType.Title */) {
            return instance.staticTitle.replace(/[\n\r\t]/g, '') || templateProperties.process?.replace(/[\n\r\t]/g, '') || '';
        }
        const detection = instance.capabilities.has(0 /* TerminalCapability.CwdDetection */) || instance.capabilities.has(1 /* TerminalCapability.NaiveCwdDetection */);
        const folders = this._workspaceContextService.getWorkspace().folders;
        const multiRootWorkspace = folders.length > 1;
        // Only set cwdFolder if detection is on
        if (templateProperties.cwd && detection && (!instance.shellLaunchConfig.isFeatureTerminal || labelType === "title" /* TerminalLabelType.Title */)) {
            const cwdUri = URI.from({
                scheme: instance.workspaceFolder?.uri.scheme || Schemas.file,
                path: instance.cwd ? path.resolve(instance.cwd) : undefined
            });
            // Multi-root workspaces always show cwdFolder to disambiguate them, otherwise only show
            // when it differs from the workspace folder in which it was launched from
            let showCwd = false;
            if (multiRootWorkspace) {
                showCwd = true;
            }
            else if (instance.workspaceFolder?.uri) {
                const caseSensitive = this._fileService.hasCapability(instance.workspaceFolder.uri, 1024 /* FileSystemProviderCapabilities.PathCaseSensitive */);
                showCwd = cwdUri.fsPath.localeCompare(instance.workspaceFolder.uri.fsPath, undefined, { sensitivity: caseSensitive ? 'case' : 'base' }) !== 0;
            }
            if (showCwd) {
                templateProperties.cwdFolder = path.basename(templateProperties.cwd);
            }
        }
        // Remove special characters that could mess with rendering
        const label = template(labelTemplate, templateProperties).replace(/[\n\r\t]/g, '').trim();
        return label === '' && labelType === "title" /* TerminalLabelType.Title */ ? (instance.processName || '') : label;
    }
    _getProgressStateString(progressState) {
        if (!progressState) {
            return '';
        }
        switch (progressState.state) {
            case 0: return '';
            case 1: return `${Math.round(progressState.value)}%`;
            case 2: return '$(error)';
            case 3: return '$(loading~spin)';
            case 4: return '$(alert)';
        }
    }
};
TerminalLabelComputer = __decorate([
    __param(0, IFileService),
    __param(1, ITerminalConfigurationService),
    __param(2, IWorkspaceContextService)
], TerminalLabelComputer);
export { TerminalLabelComputer };
export function parseExitResult(exitCodeOrError, shellLaunchConfig, processState, initialCwd) {
    // Only return a message if the exit code is non-zero
    if (exitCodeOrError === undefined || exitCodeOrError === 0) {
        return { code: exitCodeOrError, message: undefined };
    }
    const code = isNumber(exitCodeOrError) ? exitCodeOrError : exitCodeOrError.code;
    // Create exit code message
    let message = undefined;
    switch (typeof exitCodeOrError) {
        case 'number': {
            let commandLine = undefined;
            if (shellLaunchConfig.executable) {
                commandLine = shellLaunchConfig.executable;
                if (isString(shellLaunchConfig.args)) {
                    commandLine += ` ${shellLaunchConfig.args}`;
                }
                else if (shellLaunchConfig.args && shellLaunchConfig.args.length) {
                    commandLine += shellLaunchConfig.args.map(a => ` '${a}'`).join();
                }
            }
            if (processState === 4 /* ProcessState.KilledDuringLaunch */) {
                if (commandLine) {
                    message = nls.localize('launchFailed.exitCodeAndCommandLine', "The terminal process \"{0}\" failed to launch (exit code: {1}).", commandLine, code);
                }
                else {
                    message = nls.localize('launchFailed.exitCodeOnly', "The terminal process failed to launch (exit code: {0}).", code);
                }
            }
            else {
                if (commandLine) {
                    message = nls.localize('terminated.exitCodeAndCommandLine', "The terminal process \"{0}\" terminated with exit code: {1}.", commandLine, code);
                }
                else {
                    message = nls.localize('terminated.exitCodeOnly', "The terminal process terminated with exit code: {0}.", code);
                }
            }
            break;
        }
        case 'object': {
            // Ignore internal errors
            if (exitCodeOrError.message.toString().includes('Could not find pty with id')) {
                break;
            }
            // Convert conpty code-based failures into human friendly messages
            let innerMessage = exitCodeOrError.message;
            const conptyError = exitCodeOrError.message.match(/.*error code:\s*(\d+).*$/);
            if (conptyError) {
                const errorCode = conptyError.length > 1 ? parseInt(conptyError[1]) : undefined;
                switch (errorCode) {
                    case 5:
                        innerMessage = `Access was denied to the path containing your executable "${shellLaunchConfig.executable}". Manage and change your permissions to get this to work`;
                        break;
                    case 267:
                        innerMessage = `Invalid starting directory "${initialCwd}", review your terminal.integrated.cwd setting`;
                        break;
                    case 1260:
                        innerMessage = `Windows cannot open this program because it has been prevented by a software restriction policy. For more information, open Event Viewer or contact your system Administrator`;
                        break;
                }
            }
            message = nls.localize('launchFailed.errorMessage', "The terminal process failed to launch: {0}.", innerMessage);
            break;
        }
    }
    return { code, message };
}
let TerminalInstanceColorProvider = class TerminalInstanceColorProvider {
    constructor(_target, _viewDescriptorService) {
        this._target = _target;
        this._viewDescriptorService = _viewDescriptorService;
    }
    getBackgroundColor(theme) {
        const terminalBackground = theme.getColor(TERMINAL_BACKGROUND_COLOR);
        if (terminalBackground) {
            return terminalBackground;
        }
        if (this._target.object === TerminalLocation.Editor) {
            return theme.getColor(editorBackground);
        }
        const location = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID);
        if (location === 1 /* ViewContainerLocation.Panel */) {
            return theme.getColor(PANEL_BACKGROUND);
        }
        return theme.getColor(SIDE_BAR_BACKGROUND);
    }
};
TerminalInstanceColorProvider = __decorate([
    __param(1, IViewDescriptorService)
], TerminalInstanceColorProvider);
export { TerminalInstanceColorProvider };
function guessShellTypeFromExecutable(os, executable) {
    const exeBasename = path.basename(executable);
    const generalShellTypeMap = new Map([
        ["julia" /* GeneralShellType.Julia */, /^julia$/],
        ["node" /* GeneralShellType.Node */, /^node$/],
        ["nu" /* GeneralShellType.NuShell */, /^nu$/],
        ["pwsh" /* GeneralShellType.PowerShell */, /^pwsh(-preview)?|powershell$/],
        ["python" /* GeneralShellType.Python */, /^py(?:thon)?$/]
    ]);
    for (const [shellType, pattern] of generalShellTypeMap) {
        if (exeBasename.match(pattern)) {
            return shellType;
        }
    }
    if (os === 1 /* OperatingSystem.Windows */) {
        const windowsShellTypeMap = new Map([
            ["cmd" /* WindowsShellType.CommandPrompt */, /^cmd$/],
            ["gitbash" /* WindowsShellType.GitBash */, /^bash$/],
            ["wsl" /* WindowsShellType.Wsl */, /^wsl$/]
        ]);
        for (const [shellType, pattern] of windowsShellTypeMap) {
            if (exeBasename.match(pattern)) {
                return shellType;
            }
        }
    }
    else {
        const posixShellTypes = [
            "bash" /* PosixShellType.Bash */,
            "csh" /* PosixShellType.Csh */,
            "fish" /* PosixShellType.Fish */,
            "ksh" /* PosixShellType.Ksh */,
            "sh" /* PosixShellType.Sh */,
            "zsh" /* PosixShellType.Zsh */,
        ];
        for (const type of posixShellTypes) {
            if (exeBasename === type) {
                return type;
            }
        }
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxJbnN0YW5jZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsSW5zdGFuY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDdEUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ2hFLE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFFbEYsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNqRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMxRixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRWxFLE9BQU8sRUFBYyxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQWUsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsT0FBTyxFQUFFLFlBQVksRUFBbUIsTUFBTSxzQ0FBc0MsQ0FBQztBQUM3TCxPQUFPLEVB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