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
import { Emitter } from '../../../base/common/event.js';
import { MainContext } from './extHost.protocol.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { URI } from '../../../base/common/uri.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import { DisposableStore, Disposable, MutableDisposable } from '../../../base/common/lifecycle.js';
import { Disposable as VSCodeDisposable, EnvironmentVariableMutatorType } from './extHostTypes.js';
import { localize } from '../../../nls.js';
import { NotSupportedError } from '../../../base/common/errors.js';
import { serializeEnvironmentDescriptionMap, serializeEnvironmentVariableCollection } from '../../../platform/terminal/common/environmentVariableShared.js';
import { CancellationTokenSource } from '../../../base/common/cancellation.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { TerminalDataBufferer } from '../../../platform/terminal/common/terminalDataBuffering.js';
import { ThemeColor } from '../../../base/common/themables.js';
import { Promises } from '../../../base/common/async.js';
import { TerminalCompletionList, TerminalQuickFix, ViewColumn } from './extHostTypeConverters.js';
import { IExtHostCommands } from './extHostCommands.js';
import { isWindows } from '../../../base/common/platform.js';
import { hasKey } from '../../../base/common/types.js';
export const IExtHostTerminalService = createDecorator('IExtHostTerminalService');
export class ExtHostTerminal extends Disposable {
    constructor(_proxy, _id, _creationOptions, _name) {
        super();
        this._proxy = _proxy;
        this._id = _id;
        this._creationOptions = _creationOptions;
        this._name = _name;
        this._disposed = false;
        this._state = { isInteractedWith: false, shell: undefined };
        this.isOpen = false;
        this._onWillDispose = this._register(new Emitter());
        this.onWillDispose = this._onWillDispose.event;
        this._creationOptions = Object.freeze(this._creationOptions);
        this._pidPromise = new Promise(c => this._pidPromiseComplete = c);
        const that = this;
        this.value = {
            get name() {
                return that._name || '';
            },
            get processId() {
                return that._pidPromise;
            },
            get creationOptions() {
                return that._creationOptions;
            },
            get exitStatus() {
                return that._exitStatus;
            },
            get state() {
                return that._state;
            },
            get selection() {
                return that._selection;
            },
            get shellIntegration() {
                return that.shellIntegration;
            },
            sendText(text, shouldExecute = true) {
                that._checkDisposed();
                that._proxy.$sendText(that._id, text, shouldExecute);
            },
            show(preserveFocus) {
                that._checkDisposed();
                that._proxy.$show(that._id, preserveFocus);
            },
            hide() {
                that._checkDisposed();
                that._proxy.$hide(that._id);
            },
            dispose() {
                if (!that._disposed) {
                    that._disposed = true;
                    that._proxy.$dispose(that._id);
                }
            },
            get dimensions() {
                if (that._cols === undefined || that._rows === undefined) {
                    return undefined;
                }
                return {
                    columns: that._cols,
                    rows: that._rows
                };
            }
        };
    }
    dispose() {
        this._onWillDispose.fire();
        super.dispose();
    }
    async create(options, internalOptions) {
        if (typeof this._id !== 'string') {
            throw new Error('Terminal has already been created');
        }
        await this._proxy.$createTerminal(this._id, {
            name: options.name,
            shellPath: options.shellPath ?? undefined,
            shellArgs: options.shellArgs ?? undefined,
            cwd: options.cwd ?? internalOptions?.cwd ?? undefined,
            env: options.env ?? undefined,
            icon: asTerminalIcon(options.iconPath) ?? undefined,
            color: ThemeColor.isThemeColor(options.color) ? options.color.id : undefined,
            initialText: options.message ?? undefined,
            strictEnv: options.strictEnv ?? undefined,
            hideFromUser: options.hideFromUser ?? undefined,
            forceShellIntegration: internalOptions?.forceShellIntegration ?? undefined,
            isFeatureTerminal: internalOptions?.isFeatureTerminal ?? undefined,
            isExtensionOwnedTerminal: true,
            useShellEnvironment: internalOptions?.useShellEnvironment ?? undefined,
            location: internalOptions?.location || this._serializeParentTerminal(options.location, internalOptions?.resolvedExtHostIdentifier),
            isTransient: options.isTransient ?? undefined,
            shellIntegrationNonce: options.shellIntegrationNonce ?? undefined,
        });
    }
    async createExtensionTerminal(location, internalOptions, parentTerminal, iconPath, color, shellIntegrationNonce) {
        if (typeof this._id !== 'string') {
            throw new Error('Terminal has already been created');
        }
        await this._proxy.$createTerminal(this._id, {
            name: this._name,
            isExtensionCustomPtyTerminal: true,
            icon: iconPath,
            color: ThemeColor.isThemeColor(color) ? color.id : undefined,
            location: internalOptions?.location || this._serializeParentTerminal(location, parentTerminal),
            isTransient: true,
            shellIntegrationNonce: shellIntegrationNonce ?? undefined,
        });
        // At this point, the id has been set via `$acceptTerminalOpened`
        if (typeof this._id === 'string') {
            throw new Error('Terminal creation failed');
        }
        return this._id;
    }
    _serializeParentTerminal(location, parentTerminal) {
        if (typeof location === 'object') {
            if (hasKey(location, { parentTerminal: true }) && location.parentTerminal && parentTerminal) {
                return { parentTerminal };
            }
            if (hasKey(location, { viewColumn: true })) {
                return { viewColumn: ViewColumn.from(location.viewColumn), preserveFocus: location.preserveFocus };
            }
            return undefined;
        }
        return location;
    }
    _checkDisposed() {
        if (this._disposed) {
            throw new Error('Terminal has already been disposed');
        }
    }
    set name(name) {
        this._name = name;
    }
    setExitStatus(code, reason) {
        this._exitStatus = Object.freeze({ code, reason });
    }
    setDimensions(cols, rows) {
        if (cols === this._cols && rows === this._rows) {
            // Nothing changed
            return false;
        }
        if (cols === 0 || rows === 0) {
            return false;
        }
        this._cols = cols;
        this._rows = rows;
        return true;
    }
    setInteractedWith() {
        if (!this._state.isInteractedWith) {
            this._state = {
                ...this._state,
                isInteractedWith: true
            };
            return true;
        }
        return false;
    }
    setShellType(shellType) {
        if (this._state.shell !== shellType) {
            this._state = {
                ...this._state,
                shell: shellType
            };
            return true;
        }
        return false;
    }
    setSelection(selection) {
        this._selection = selection;
    }
    _setProcessId(processId) {
        // The event may fire 2 times when the panel is restored
        if (this._pidPromiseComplete) {
            this._pidPromiseComplete(processId);
            this._pidPromiseComplete = undefined;
        }
        else {
            // Recreate the promise if this is the nth processId set (e.g. reused task terminals)
            this._pidPromise.then(pid => {
                if (pid !== processId) {
                    this._pidPromise = Promise.resolve(processId);
                }
            });
        }
    }
}
class ExtHostPseudoterminal {
    get onProcessReady() { return this._onProcessReady.event; }
    constructor(_pty) {
        this._pty = _pty;
        this.id = 0;
        this.shouldPersist = false;
        this._onProcessData = new Emitter();
        this.onProcessData = this._onProcessData.event;
        this._onProcessReady = new Emitter();
        this._onDidChangeProperty = new Emitter();
        this.onDidChangeProperty = this._onDidChangeProperty.event;
        this._onProcessExit = new Emitter();
        this.onProcessExit = this._onProcessExit.event;
    }
    refreshProperty(property) {
        throw new Error(`refreshProperty is not suppported in extension owned terminals. property: ${property}`);
    }
    updateProperty(property, value) {
        throw new Error(`updateProperty is not suppported in extension owned terminals. property: ${property}, value: ${value}`);
    }
    async start() {
        return undefined;
    }
    shutdown() {
        this._pty.close();
    }
    input(data) {
        this._pty.handleInput?.(data);
    }
    sendSignal(signal) {
        // Extension owned terminals don't support sending signals directly to processes
        // This could be extended in the future if the pseudoterminal API is enhanced
    }
    resize(cols, rows) {
        this._pty.setDimensions?.({ columns: cols, rows });
    }
    clearBuffer() {
        // no-op
    }
    async processBinary(data) {
        // No-op, processBinary is not supported in extension owned terminals.
    }
    acknowledgeDataEvent(charCount) {
        // No-op, flow control is not supported in extension owned terminals. If this is ever
        // implemented it will need new pause and resume VS Code APIs.
    }
    async setUnicodeVersion(version) {
        // No-op, xterm-headless isn't used for extension owned terminals.
    }
    getInitialCwd() {
        return Promise.resolve('');
    }
    getCwd() {
        return Promise.resolve('');
    }
    startSendingEvents(initialDimensions) {
        // Attach the listeners
        this._pty.onDidWrite(e => this._onProcessData.fire(e));
        this._pty.onDidClose?.((e = undefined) => {
            this._onProcessExit.fire(e === void 0 ? undefined : e);
        });
        this._pty.onDidOverrideDimensions?.(e => {
            if (e) {
                this._onDidChangeProperty.fire({ type: "overrideDimensions" /* ProcessPropertyType.OverrideDimensions */, value: { cols: e.columns, rows: e.rows } });
            }
        });
        this._pty.onDidChangeName?.(title => {
            this._onDidChangeProperty.fire({ type: "title" /* ProcessPropertyType.Title */, value: title });
        });
        this._pty.open(initialDimensions ? initialDimensions : undefined);
        if (initialDimensions) {
            this._pty.setDimensions?.(initialDimensions);
        }
        this._onProcessReady.fire({ pid: -1, cwd: '', windowsPty: undefined });
    }
}
let nextLinkId = 1;
let BaseExtHostTerminalService = class BaseExtHostTerminalService extends Disposable {
    get activeTerminal() { return this._activeTerminal?.value; }
    get terminals() { return this._terminals.map(term => term.value); }
    constructor(supportsProcesses, _extHostCommands, extHostRpc) {
        super();
        this._extHostCommands = _extHostCommands;
        this._terminals = [];
        this._terminalProcesses = new Map();
        this._terminalProcessDisposables = {};
        this._extensionTerminalAwaitingStart = {};
        this._getTerminalPromises = {};
        this._environmentVariableCollections = new Map();
        this._lastQuickFixCommands = this._register(new MutableDisposable());
        this._linkProviders = new Set();
        this._completionProviders = new Map();
        this._profileProviders = new Map();
        this._quickFixProviders = new Map();
        this._terminalLinkCache = new Map();
        this._terminalLinkCancellationSource = new Map();
        this._onDidCloseTerminal = new Emitter();
        this.onDidCloseTerminal = this._onDidCloseTerminal.event;
        this._onDidOpenTerminal = new Emitter();
        this.onDidOpenTerminal = this._onDidOpenTerminal.event;
        this._onDidChangeActiveTerminal = new Emitter();
        this.onDidChangeActiveTerminal = this._onDidChangeActiveTerminal.event;
        this._onDidChangeTerminalDimensions = new Emitter();
        this.onDidChangeTerminalDimensions = this._onDidChangeTerminalDimensions.event;
        this._onDidChangeTerminalState = new Emitter();
        this.onDidChangeTerminalState = this._onDidChangeTerminalState.event;
        this._onDidChangeShell = new Emitter();
        this.onDidChangeShell = this._onDidChangeShell.event;
        this._onDidWriteTerminalData = new Emitter({
            onWillAddFirstListener: () => this._proxy.$startSendingDataEvents(),
            onDidRemoveLastListener: () => this._proxy.$stopSendingDataEvents()
        });
        this.onDidWriteTerminalData = this._onDidWriteTerminalData.event;
        this._onDidExecuteCommand = new Emitter({
            onWillAddFirstListener: () => this._proxy.$startSendingCommandEvents(),
            onDidRemoveLastListener: () => this._proxy.$stopSendingCommandEvents()
        });
        this.onDidExecuteTerminalCommand = this._onDidExecuteCommand.event;
        this._proxy = extHostRpc.getProxy(MainContext.MainThreadTerminalService);
        this._bufferer = new TerminalDataBufferer(this._proxy.$sendProcessData);
        this._proxy.$registerProcessSupport(supportsProcesses);
        this._extHostCommands.registerArgumentProcessor({
            processArgument: arg => {
                const deserialize = (arg) => {
                    return this.getTerminalById(arg.instanceId)?.value;
                };
                switch (arg?.$mid) {
                    case 15 /* MarshalledId.TerminalContext */: return deserialize(arg);
                    default: {
                        // Do array transformation in place as this is a hot path
                        if (Array.isArray(arg)) {
                            for (let i = 0; i < arg.length; i++) {
                                if (arg[i].$mid === 15 /* MarshalledId.TerminalContext */) {
                                    arg[i] = deserialize(arg[i]);
                                }
                                else {
                                    // Probably something else, so exit early
                                    break;
                                }
                            }
                        }
                        return arg;
                    }
                }
            }
        });
        this._register({
            dispose: () => {
                for (const [_, terminalProcess] of this._terminalProcesses) {
                    terminalProcess.shutdown(true);
                }
            }
        });
    }
    getDefaultShell(useAutomationShell) {
        const profile = useAutomationShell ? this._defaultAutomationProfile : this._defaultProfile;
        return profile?.path || '';
    }
    getDefaultShellArgs(useAutomationShell) {
        const profile = useAutomationShell ? this._defaultAutomationProfile : this._defaultProfile;
        return profile?.args || [];
    }
    createExtensionTerminal(options, internalOptions) {
        const terminal = new ExtHostTerminal(this._proxy, generateUuid(), options, options.name);
        const p = new ExtHostPseudoterminal(options.pty);
        terminal.createExtensionTerminal(options.location, internalOptions, this._serializeParentTerminal(options, internalOptions).resolvedExtHostIdentifier, asTerminalIcon(options.iconPath), asTerminalColor(options.color), options.shellIntegrationNonce).then(id => {
            const disposable = this._setupExtHostProcessListeners(id, p);
            this._terminalProcessDisposables[id] = disposable;
        });
        this._terminals.push(terminal);
        return terminal.value;
    }
    _serializeParentTerminal(options, internalOptions) {
        internalOptions = internalOptions ? internalOptions : {};
        if (options.location && typeof options.location === 'object' && hasKey(options.location, { parentTerminal: true })) {
            const parentTerminal = options.location.parentTerminal;
            if (parentTerminal) {
                const parentExtHostTerminal = this._terminals.find(t => t.value === parentTerminal);
                if (parentExtHostTerminal) {
                    internalOptions.resolvedExtHostIdentifier = parentExtHostTerminal._id;
                }
            }
        }
        else if (options.location && typeof options.location !== 'object') {
            internalOptions.location = options.location;
        }
        else if (internalOptions.location && typeof internalOptions.location === 'object' && hasKey(internalOptions.location, { splitActiveTerminal: true })) {
            internalOptions.location = { splitActiveTerminal: true };
        }
        return internalOptions;
    }
    attachPtyToTerminal(id, pty) {
        const terminal = this.getTerminalById(id);
        if (!terminal) {
            throw new Error(`Cannot resolve terminal with id ${id} for virtual process`);
        }
        const p = new ExtHostPseudoterminal(pty);
        const disposable = this._setupExtHostProcessListeners(id, p);
        this._terminalProcessDisposables[id] = disposable;
    }
    async $acceptActiveTerminalChanged(id) {
        const original = this._activeTerminal;
        if (id === null) {
            this._activeTerminal = undefined;
            if (original !== this._activeTerminal) {
                this._onDidChangeActiveTerminal.fire(this._activeTerminal);
            }
            return;
        }
        const terminal = this.getTerminalById(id);
        if (terminal) {
            this._activeTerminal = terminal;
            if (original !== this._activeTerminal) {
                this._onDidChangeActiveTerminal.fire(this._activeTerminal.value);
            }
        }
    }
    async $acceptTerminalProcessData(id, data) {
        const terminal = this.getTerminalById(id);
        if (terminal) {
            this._onDidWriteTerminalData.fire({ terminal: terminal.value, data });
        }
    }
    async $acceptTerminalDimensions(id, cols, rows) {
        const terminal = this.getTerminalById(id);
        if (terminal) {
            if (terminal.setDimensions(cols, rows)) {
                this._onDidChangeTerminalDimensions.fire({
                    terminal: terminal.value,
                    dimensions: terminal.value.dimensions
                });
            }
        }
    }
    async $acceptDidExecuteCommand(id, command) {
        const terminal = this.getTerminalById(id);
        if (terminal) {
            this._onDidExecuteCommand.fire({ terminal: terminal.value, ...command });
        }
    }
    async $acceptTerminalMaximumDimensions(id, cols, rows) {
        // Extension pty terminal only - when virtual process resize fires it means that the
        // terminal's maximum dimensions changed
        this._terminalProcesses.get(id)?.resize(cols, rows);
    }
    async $acceptTerminalTitleChange(id, name) {
        const terminal = this.getTerminalById(id);
        if (terminal) {
            terminal.name = name;
        }
    }
    async $acceptTerminalClosed(id, exitCode, exitReason) {
        const index = this._getTerminalObjectIndexById(this._terminals, id);
        if (index !== null) {
            const terminal = this._terminals.splice(index, 1)[0];
            terminal.setExitStatus(exitCode, exitReason);
            this._onDidCloseTerminal.fire(terminal.value);
        }
    }
    $acceptTerminalOpened(id, extHostTerminalId, name, shellLaunchConfigDto) {
        if (extHostTerminalId) {
            // Resolve with the renderer generated id
            const index = this._getTerminalObjectIndexById(this._terminals, extHostTerminalId);
            if (index !== null) {
                // The terminal has already been created (via createTerminal*), only fire the event
                this._terminals[index]._id = id;
                this._onDidOpenTerminal.fire(this.terminals[index]);
                this._terminals[index].isOpen = true;
                return;
            }
        }
        const creationOptions = {
            name: shellLaunchConfigDto.name,
            shellPath: shellLaunchConfigDto.executable,
            shellArgs: shellLaunchConfigDto.args,
            cwd: typeof shellLaunchConfigDto.cwd === 'string' ? shellLaunchConfigDto.cwd : URI.revive(shellLaunchConfigDto.cwd),
            env: shellLaunchConfigDto.env,
            hideFromUser: shellLaunchConfigDto.hideFromUser
        };
        const terminal = new ExtHostTerminal(this._proxy, id, creationOptions, name);
        this._terminals.push(terminal);
        this._onDidOpenTerminal.fire(terminal.value);
        terminal.isOpen = true;
    }
    async $acceptTerminalProcessId(id, processId) {
        const terminal = this.getTerminalById(id);
        terminal?._setProcessId(processId);
    }
    async $startExtensionTerminal(id, initialDimensions) {
        // Make sure the ExtHostTerminal exists so onDidOpenTerminal has fired before we call
        // Pseudoterminal.start
        const terminal = this.getTerminalById(id);
        if (!terminal) {
            return { message: localize('launchFail.idMissingOnExtHost', "Could not find the terminal with id {0} on the extension host", id) };
        }
        // Wait for onDidOpenTerminal to fire
        if (!terminal.isOpen) {
            await new Promise(r => {
                // Ensure open is called after onDidOpenTerminal
                const listener = this.onDidOpenTerminal(async (e) => {
                    if (e === terminal.value) {
                        listener.dispose();
                        r();
                    }
                });
            });
        }
        const terminalProcess = this._terminalProcesses.get(id);
        if (terminalProcess) {
            terminalProcess.startSendingEvents(initialDimensions);
        }
        else {
            // Defer startSendingEvents call to when _setupExtHostProcessListeners is called
            this._extensionTerminalAwaitingStart[id] = { initialDimensions };
        }
        return undefined;
    }
    _setupExtHostProcessListeners(id, p) {
        const disposables = new DisposableStore();
        disposables.add(p.onProcessReady(e => this._proxy.$sendProcessReady(id, e.pid, e.cwd, e.windowsPty)));
        disposables.add(p.onDidChangeProperty(property => this._proxy.$sendProcessProperty(id, property)));
        // Buffer data events to reduce the amount of messages going to the renderer
        this._bufferer.startBuffering(id, p.onProcessData);
        disposables.add(p.onProcessExit(exitCode => this._onProcessExit(id, exitCode)));
        this._terminalProcesses.set(id, p);
        const awaitingStart = this._extensionTerminalAwaitingStart[id];
        if (awaitingStart && p instanceof ExtHostPseudoterminal) {
            p.startSendingEvents(awaitingStart.initialDimensions);
            delete this._extensionTerminalAwaitingStart[id];
        }
        return disposables;
    }
    $acceptProcessAckDataEvent(id, charCount) {
        this._terminalProcesses.get(id)?.acknowledgeDataEvent(charCount);
    }
    $acceptProcessInput(id, data) {
        this._terminalProcesses.get(id)?.input(data);
    }
    $acceptTerminalInteraction(id) {
        const terminal = this.getTerminalById(id);
        if (terminal?.setInteractedWith()) {
            this._onDidChangeTerminalState.fire(terminal.value);
        }
    }
    $acceptTerminalSelection(id, selection) {
        this.getTerminalById(id)?.setSelection(selection);
    }
    $acceptProcessResize(id, cols, rows) {
        try {
            this._terminalProcesses.get(id)?.resize(cols, rows);
        }
        catch (error) {
            // We tried to write to a closed pipe / channel.
            if (error.code !== 'EPIPE' && error.code !== 'ERR_IPC_CHANNEL_CLOSED') {
                throw (error);
            }
        }
    }
    $acceptProcessShutdown(id, immediate) {
        this._terminalProcesses.get(id)?.shutdown(immediate);
    }
    $acceptProcessRequestInitialCwd(id) {
        this._terminalProcesses.get(id)?.getInitialCwd().then(initialCwd => this._proxy.$sendProcessProperty(id, { type: "initialCwd" /* ProcessPropertyType.InitialCwd */, value: initialCwd }));
    }
    $acceptProcessRequestCwd(id) {
        this._terminalProcesses.get(id)?.getCwd().then(cwd => this._proxy.$sendProcessProperty(id, { type: "cwd" /* ProcessPropertyType.Cwd */, value: cwd }));
    }
    $acceptProcessRequestLatency(id) {
        return Promise.resolve(id);
    }
    registerProfileProvider(extension, id, provider) {
        if (this._profileProviders.has(id)) {
            throw new Error(`Terminal profile provider "${id}" already registered`);
        }
        this._profileProviders.set(id, provider);
        this._proxy.$registerProfileProvider(id, extension.identifier.value);
        return new VSCodeDisposable(() => {
            this._profileProviders.delete(id);
            this._proxy.$unregisterProfileProvider(id);
        });
    }
    registerTerminalCompletionProvider(extension, provider, ...triggerCharacters) {
        if (this._completionProviders.has(extension.identifier.value)) {
            throw new Error(`Terminal completion provider "${extension.identifier.value}" already registered`);
        }
        this._completionProviders.set(extension.identifier.value, provider);
        this._proxy.$registerCompletionProvider(extension.identifier.value, extension.identifier.value, ...triggerCharacters);
        return new VSCodeDisposable(() => {
            this._completionProviders.delete(extension.identifier.value);
            this._proxy.$unregisterCompletionProvider(extension.identifier.value);
        });
    }
    async $provideTerminalCompletions(id, options) {
        const token = new CancellationTokenSource().token;
        if (token.isCancellationRequested || !this.activeTerminal) {
            return undefined;
        }
        const provider = this._completionProviders.get(id);
        if (!provider) {
            return;
        }
        const completions = await provider.provideTerminalCompletions(this.activeTerminal, options, token);
        if (completions === null || completions === undefined) {
            return undefined;
        }
        const pathSeparator = !isWindows || this.activeTerminal.state?.shell === "gitbash" /* WindowsShellType.GitBash */ ? '/' : '\\';
        return TerminalCompletionList.from(completions, pathSeparator);
    }
    $acceptTerminalShellType(id, shellType) {
        const terminal = this.getTerminalById(id);
        if (terminal?.setShellType(shellType)) {
            this._onDidChangeTerminalState.fire(terminal.value);
        }
    }
    registerTerminalQuickFixProvider(id, extensionId, provider) {
        if (this._quickFixProviders.has(id)) {
            throw new Error(`Terminal quick fix provider "${id}" is already registered`);
        }
        this._quickFixProviders.set(id, provider);
        this._proxy.$registerQuickFixProvider(id, extensionId);
        return new VSCodeDisposable(() => {
            this._quickFixProviders.delete(id);
            this._proxy.$unregisterQuickFixProvider(id);
        });
    }
    async $provideTerminalQuickFixes(id, matchResult) {
        const token = new CancellationTokenSource().token;
        if (token.isCancellationRequested) {
            return;
        }
        const provider = this._quickFixProviders.get(id);
        if (!provider) {
            return;
        }
        const quickFixes = await provider.provideTerminalQuickFixes(matchResult, token);
        if (quickFixes === null || (Array.isArray(quickFixes) && quickFixes.length === 0)) {
            return undefined;
        }
        const store = new DisposableStore();
        this._lastQuickFixCommands.value = store;
        // Single
        if (!Array.isArray(quickFixes)) {
            return quickFixes ? TerminalQuickFix.from(quickFixes, this._extHostCommands.converter, store) : undefined;
        }
        // Many
        const result = [];
        for (const fix of quickFixes) {
            const converted = TerminalQuickFix.from(fix, this._extHostCommands.converter, store);
            if (converted) {
                result.push(converted);
            }
        }
        return result;
    }
    async $createContributedProfileTerminal(id, options) {
        const token = new CancellationTokenSource().token;
        let profile = await this._profileProviders.get(id)?.provideTerminalProfile(token);
        if (token.isCancellationRequested) {
            return;
        }
        if (profile && !hasKey(profile, { options: true })) {
            profile = { options: profile };
        }
        if (!profile || !hasKey(profile, { options: true })) {
            throw new Error(`No terminal profile options provided for id "${id}"`);
        }
        if (hasKey(profile.options, { pty: true })) {
            this.createExtensionTerminal(profile.options, options);
            return;
        }
        this.createTerminalFromOptions(profile.options, options);
    }
    registerLinkProvider(provider) {
        this._linkProviders.add(provider);
        if (this._linkProviders.size === 1) {
            this._proxy.$startLinkProvider();
        }
        return new VSCodeDisposable(() => {
            this._linkProviders.delete(provider);
            if (this._linkProviders.size === 0) {
                this._proxy.$stopLinkProvider();
            }
        });
    }
    async $provideLinks(terminalId, line) {
        const terminal = this.getTerminalById(terminalId);
        if (!terminal) {
            return [];
        }
        // Discard any cached links the terminal has been holding, currently all links are released
        // when new links are provided.
        this._terminalLinkCache.delete(terminalId);
        const oldToken = this._terminalLinkCancellationSource.get(terminalId);
        oldToken?.dispose(true);
        const cancellationSource = new CancellationTokenSource();
        this._terminalLinkCancellationSource.set(terminalId, cancellationSource);
        const result = [];
        const context = { terminal: terminal.value, line };
        const promises = [];
        for (const provider of this._linkProviders) {
            promises.push(Promises.withAsyncBody(async (r) => {
                cancellationSource.token.onCancellationRequested(() => r({ provider, links: [] }));
                const links = (await provider.provideTerminalLinks(context, cancellationSource.token)) || [];
                if (!cancellationSource.token.isCancellationRequested) {
                    r({ provider, links });
                }
            }));
        }
        const provideResults = await Promise.all(promises);
        if (cancellationSource.token.isCancellationRequested) {
            return [];
        }
        const cacheLinkMap = new Map();
        for (const provideResult of provideResults) {
            if (provideResult && provideResult.links.length > 0) {
                result.push(...provideResult.links.map(providerLink => {
                    const link = {
                        id: nextLinkId++,
                        startIndex: providerLink.startIndex,
                        length: providerLink.length,
                        label: providerLink.tooltip
                    };
                    cacheLinkMap.set(link.id, {
                        provider: provideResult.provider,
                        link: providerLink
                    });
                    return link;
                }));
            }
        }
        this._terminalLinkCache.set(terminalId, cacheLinkMap);
        return result;
    }
    $activateLink(terminalId, linkId) {
        const cachedLink = this._terminalLinkCache.get(terminalId)?.get(linkId);
        if (!cachedLink) {
            return;
        }
        cachedLink.provider.handleTerminalLink(cachedLink.link);
    }
    _onProcessExit(id, exitCode) {
        this._bufferer.stopBuffering(id);
        // Remove process reference
        this._terminalProcesses.delete(id);
        delete this._extensionTerminalAwaitingStart[id];
        // Clean up process disposables
        const processDiposable = this._terminalProcessDisposables[id];
        if (processDiposable) {
            processDiposable.dispose();
            delete this._terminalProcessDisposables[id];
        }
        // Send exit event to main side
        this._proxy.$sendProcessExit(id, exitCode);
    }
    getTerminalById(id) {
        return this._getTerminalObjectById(this._terminals, id);
    }
    getTerminalIdByApiObject(terminal) {
        const index = this._terminals.findIndex(item => {
            return item.value === terminal;
        });
        return index >= 0 ? index : null;
    }
    _getTerminalObjectById(array, id) {
        const index = this._getTerminalObjectIndexById(array, id);
        return index !== null ? array[index] : null;
    }
    _getTerminalObjectIndexById(array, id) {
        const index = array.findIndex(item => {
            return item._id === id;
        });
        return index >= 0 ? index : null;
    }
    getEnvironmentVariableCollection(extension) {
        let collection = this._environmentVariableCollections.get(extension.identifier.value);
        if (!collection) {
            collection = this._register(new UnifiedEnvironmentVariableCollection());
            this._setEnvironmentVariableCollection(extension.identifier.value, collection);
        }
        return collection.getScopedEnvironmentVariableCollection(undefined);
    }
    _syncEnvironmentVariableCollection(extensionIdentifier, collection) {
        const serialized = serializeEnvironmentVariableCollection(collection.map);
        const serializedDescription = serializeEnvironmentDescriptionMap(collection.descriptionMap);
        this._proxy.$setEnvironmentVariableCollection(extensionIdentifier, collection.persistent, serialized.length === 0 ? undefined : serialized, serializedDescription);
    }
    $initEnvironmentVariableCollections(collections) {
        collections.forEach(entry => {
            const extensionIdentifier = entry[0];
            const collection = this._register(new UnifiedEnvironmentVariableCollection(entry[1]));
            this._setEnvironmentVariableCollection(extensionIdentifier, collection);
        });
    }
    $acceptDefaultProfile(profile, automationProfile) {
        const oldProfile = this._defaultProfile;
        this._defaultProfile = profile;
        this._defaultAutomationProfile = automationProfile;
        if (oldProfile?.path !== profile.path) {
            this._onDidChangeShell.fire(profile.path);
        }
    }
    _setEnvironmentVariableCollection(extensionIdentifier, collection) {
        this._environmentVariableCollections.set(extensionIdentifier, collection);
        this._register(collection.onDidChangeCollection(() => {
            // When any collection value changes send this immediately, this is done to ensure
            // following calls to createTerminal will be created with the new environment. It will
            // result in more noise by sending multiple updates when called but collections are
            // expected to be small.
            this._syncEnvironmentVariableCollection(extensionIdentifier, collection);
        }));
    }
};
BaseExtHostTerminalService = __decorate([
    __param(1, IExtHostCommands),
    __param(2, IExtHostRpcService)
], BaseExtHostTerminalService);
export { BaseExtHostTerminalService };
/**
 * Unified environment variable collection carrying information for all scopes, for a specific extension.
 */
class UnifiedEnvironmentVariableCollection extends Disposable {
    get persistent() { return this._persistent; }
    set persistent(value) {
        this._persistent = value;
        this._onDidChangeCollection.fire();
    }
    get onDidChangeCollection() { return this._onDidChangeCollection && this._onDidChangeCollection.event; }
    constructor(serialized) {
        super();
        this.map = new Map();
        this.scopedCollections = new Map();
        this.descriptionMap = new Map();
        this._persistent = true;
        this._onDidChangeCollection = new Emitter();
        this.map = new Map(serialized);
    }
    getScopedEnvironmentVariableCollection(scope) {
        const scopedCollectionKey = this.getScopeKey(scope);
        let scopedCollection = this.scopedCollections.get(scopedCollectionKey);
        if (!scopedCollection) {
            scopedCollection = new ScopedEnvironmentVariableCollection(this, scope);
            this.scopedCollections.set(scopedCollectionKey, scopedCollection);
            this._register(scopedCollection.onDidChangeCollection(() => this._onDidChangeCollection.fire()));
        }
        return scopedCollection;
    }
    replace(variable, value, options, scope) {
        this._setIfDiffers(variable, { value, type: EnvironmentVariableMutatorType.Replace, options: options ?? { applyAtProcessCreation: true }, scope });
    }
    append(variable, value, options, scope) {
        this._setIfDiffers(variable, { value, type: EnvironmentVariableMutatorType.Append, options: options ?? { applyAtProcessCreation: true }, scope });
    }
    prepend(variable, value, options, scope) {
        this._setIfDiffers(variable, { value, type: EnvironmentVariableMutatorType.Prepend, options: options ?? { applyAtProcessCreation: true }, scope });
    }
    _setIfDiffers(variable, mutator) {
        if (mutator.options && mutator.options.applyAtProcessCreation === false && !mutator.options.applyAtShellIntegration) {
            throw new Error('EnvironmentVariableMutatorOptions must apply at either process creation or shell integration');
        }
        const key = this.getKey(variable, mutator.scope);
        const current = this.map.get(key);
        const newOptions = mutator.options ? {
            applyAtProcessCreation: mutator.options.applyAtProcessCreation ?? false,
            applyAtShellIntegration: mutator.options.applyAtShellIntegration ?? false,
        } : {
            applyAtProcessCreation: true
        };
        if (!current ||
            current.value !== mutator.value ||
            current.type !== mutator.type ||
            current.options?.applyAtProcessCreation !== newOptions.applyAtProcessCreation ||
            current.options?.applyAtShellIntegration !== newOptions.applyAtShellIntegration ||
            current.scope?.workspaceFolder?.index !== mutator.scope?.workspaceFolder?.index) {
            const key = this.getKey(variable, mutator.scope);
            const value = {
                variable,
                ...mutator,
                options: newOptions
            };
            this.map.set(key, value);
            this._onDidChangeCollection.fire();
        }
    }
    get(variable, scope) {
        const key = this.getKey(variable, scope);
        const value = this.map.get(key);
        // TODO: Set options to defaults if needed
        return value ? convertMutator(value) : undefined;
    }
    getKey(variable, scope) {
        const scopeKey = this.getScopeKey(scope);
        return scopeKey.length ? `${variable}:::${scopeKey}` : variable;
    }
    getScopeKey(scope) {
        return this.getWorkspaceKey(scope?.workspaceFolder) ?? '';
    }
    getWorkspaceKey(workspaceFolder) {
        return workspaceFolder ? workspaceFolder.uri.toString() : undefined;
    }
    getVariableMap(scope) {
        const map = new Map();
        for (const [_, value] of this.map) {
            if (this.getScopeKey(value.scope) === this.getScopeKey(scope)) {
                map.set(value.variable, convertMutator(value));
            }
        }
        return map;
    }
    delete(variable, scope) {
        const key = this.getKey(variable, scope);
        this.map.delete(key);
        this._onDidChangeCollection.fire();
    }
    clear(scope) {
        if (scope?.workspaceFolder) {
            for (const [key, mutator] of this.map) {
                if (mutator.scope?.workspaceFolder?.index === scope.workspaceFolder.index) {
                    this.map.delete(key);
                }
            }
            this.clearDescription(scope);
        }
        else {
            this.map.clear();
            this.descriptionMap.clear();
        }
        this._onDidChangeCollection.fire();
    }
    setDescription(description, scope) {
        const key = this.getScopeKey(scope);
        const current = this.descriptionMap.get(key);
        if (!current || current.description !== description) {
            let descriptionStr;
            if (typeof description === 'string') {
                descriptionStr = description;
            }
            else {
                // Only take the description before the first `\n\n`, so that the description doesn't mess up the UI
                descriptionStr = description?.value.split('\n\n')[0];
            }
            const value = { description: descriptionStr, scope };
            this.descriptionMap.set(key, value);
            this._onDidChangeCollection.fire();
        }
    }
    getDescription(scope) {
        const key = this.getScopeKey(scope);
        return this.descriptionMap.get(key)?.description;
    }
    clearDescription(scope) {
        const key = this.getScopeKey(scope);
        this.descriptionMap.delete(key);
    }
}
class ScopedEnvironmentVariableCollection {
    get persistent() { return this.collection.persistent; }
    set persistent(value) {
        this.collection.persistent = value;
    }
    get onDidChangeCollection() { return this._onDidChangeCollection && this._onDidChangeCollection.event; }
    constructor(collection, scope) {
        this.collection = collection;
        this.scope = scope;
        this._onDidChangeCollection = new Emitter();
    }
    getScoped(scope) {
        return this.collection.getScopedEnvironmentVariableCollection(scope);
    }
    replace(variable, value, options) {
        this.collection.replace(variable, value, options, this.scope);
    }
    append(variable, value, options) {
        this.collection.append(variable, value, options, this.scope);
    }
    prepend(variable, value, options) {
        this.collection.prepend(variable, value, options, this.scope);
    }
    get(variable) {
        return this.collection.get(variable, this.scope);
    }
    forEach(callback, thisArg) {
        this.collection.getVariableMap(this.scope).forEach((value, variable) => callback.call(thisArg, variable, value, this), this.scope);
    }
    [Symbol.iterator]() {
        return this.collection.getVariableMap(this.scope).entries();
    }
    delete(variable) {
        this.collection.delete(variable, this.scope);
        this._onDidChangeCollection.fire(undefined);
    }
    clear() {
        this.collection.clear(this.scope);
    }
    set description(description) {
        this.collection.setDescription(description, this.scope);
    }
    get description() {
        return this.collection.getDescription(this.scope);
    }
}
let WorkerExtHostTerminalService = class WorkerExtHostTerminalService extends BaseExtHostTerminalService {
    constructor(extHostCommands, extHostRpc) {
        super(false, extHostCommands, extHostRpc);
    }
    createTerminal(name, shellPath, shellArgs) {
        throw new NotSupportedError();
    }
    createTerminalFromOptions(options, internalOptions) {
        throw new NotSupportedError();
    }
};
WorkerExtHostTerminalService = __decorate([
    __param(0, IExtHostCommands),
    __param(1, IExtHostRpcService)
], WorkerExtHostTerminalService);
export { WorkerExtHostTerminalService };
function asTerminalIcon(iconPath) {
    if (!iconPath || typeof iconPath === 'string') {
        return undefined;
    }
    if (!hasKey(iconPath, { id: true })) {
        return iconPath;
    }
    return {
        id: iconPath.id,
        color: iconPath.color
    };
}
function asTerminalColor(color) {
    return ThemeColor.isThemeColor(color) ? color : undefined;
}
function convertMutator(mutator) {
    const newMutator = { ...mutator };
    delete newMutator.scope;
    newMutator.options = newMutator.options ?? undefined;
    return newMutator;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdFRlcm1pbmFsU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0VGVybWluYWxTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBUyxPQUFPLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQStCLFdBQVcsRUFBbVMsTUFBTSx1QkFBdUIsQ0FBQztBQUNsWCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDMUYsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ2xELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQzVELE9BQU8sRUFBZSxlQUFlLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEgsT0FBTyxFQUFFLFVBQVUsSUFBSSxnQkFBZ0IsRUFBRSw4QkFBOEIsRUFBOEMsTUFBTSxtQkFBbUIsQ0FBQztBQUUvSSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDM0MsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDbkUsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLHNDQUFzQyxFQUFFLE1BQU0sZ0VBQWdFLENBQUM7QUFDNUosT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDL0UsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRzVELE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsUUFBUSxF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