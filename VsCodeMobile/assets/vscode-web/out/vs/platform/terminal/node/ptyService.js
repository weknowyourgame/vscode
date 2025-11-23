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
import { execFile, exec } from 'child_process';
import { AutoOpenBarrier, ProcessTimeRunOnceScheduler, Promises, Queue, timeout } from '../../../base/common/async.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable, toDisposable } from '../../../base/common/lifecycle.js';
import { isWindows, OS } from '../../../base/common/platform.js';
import { getSystemShell } from '../../../base/node/shell.js';
import { LogLevel } from '../../log/common/log.js';
import { RequestStore } from '../common/requestStore.js';
import { TitleEventSource } from '../common/terminal.js';
import { TerminalDataBufferer } from '../common/terminalDataBuffering.js';
import { escapeNonWindowsPath } from '../common/terminalEnvironment.js';
import { getWindowsBuildNumber } from './terminalEnvironment.js';
import { TerminalProcess } from './terminalProcess.js';
import { localize } from '../../../nls.js';
import { ignoreProcessNames } from './childProcessMonitor.js';
import { ErrorNoTelemetry } from '../../../base/common/errors.js';
import { ShellIntegrationAddon } from '../common/xterm/shellIntegrationAddon.js';
import { formatMessageForTerminal } from '../common/terminalStrings.js';
import { join } from '../../../base/common/path.js';
import { memoize } from '../../../base/common/decorators.js';
import * as performance from '../../../base/common/performance.js';
import pkg from '@xterm/headless';
import { AutoRepliesPtyServiceContribution } from './terminalContrib/autoReplies/autoRepliesContribController.js';
import { hasKey, isFunction, isNumber, isString } from '../../../base/common/types.js';
const { Terminal: XtermTerminal } = pkg;
export function traceRpc(_target, key, descriptor) {
    if (!isFunction(descriptor.value)) {
        throw new Error('not supported');
    }
    const fnKey = 'value';
    const fn = descriptor.value;
    descriptor[fnKey] = async function (...args) {
        if (this.traceRpcArgs.logService.getLevel() === LogLevel.Trace) {
            this.traceRpcArgs.logService.trace(`[RPC Request] PtyService#${fn.name}(${args.map(e => JSON.stringify(e)).join(', ')})`);
        }
        if (this.traceRpcArgs.simulatedLatency) {
            await timeout(this.traceRpcArgs.simulatedLatency);
        }
        let result;
        try {
            result = await fn.apply(this, args);
        }
        catch (e) {
            this.traceRpcArgs.logService.error(`[RPC Response] PtyService#${fn.name}`, e);
            throw e;
        }
        if (this.traceRpcArgs.logService.getLevel() === LogLevel.Trace) {
            this.traceRpcArgs.logService.trace(`[RPC Response] PtyService#${fn.name}`, result);
        }
        return result;
    };
}
let SerializeAddon;
let Unicode11Addon;
export class PtyService extends Disposable {
    async installAutoReply(match, reply) {
        await this._autoRepliesContribution.installAutoReply(match, reply);
    }
    async uninstallAllAutoReplies() {
        await this._autoRepliesContribution.uninstallAllAutoReplies();
    }
    _traceEvent(name, event) {
        event(e => {
            if (this._logService.getLevel() === LogLevel.Trace) {
                this._logService.trace(`[RPC Event] PtyService#${name}.fire(${JSON.stringify(e)})`);
            }
        });
        return event;
    }
    get traceRpcArgs() {
        return {
            logService: this._logService,
            simulatedLatency: this._simulatedLatency
        };
    }
    constructor(_logService, _productService, _reconnectConstants, _simulatedLatency) {
        super();
        this._logService = _logService;
        this._productService = _productService;
        this._reconnectConstants = _reconnectConstants;
        this._simulatedLatency = _simulatedLatency;
        this._ptys = new Map();
        this._workspaceLayoutInfos = new Map();
        this._revivedPtyIdMap = new Map();
        this._lastPtyId = 0;
        this._onHeartbeat = this._register(new Emitter());
        this.onHeartbeat = this._traceEvent('_onHeartbeat', this._onHeartbeat.event);
        this._onProcessData = this._register(new Emitter());
        this.onProcessData = this._traceEvent('_onProcessData', this._onProcessData.event);
        this._onProcessReplay = this._register(new Emitter());
        this.onProcessReplay = this._traceEvent('_onProcessReplay', this._onProcessReplay.event);
        this._onProcessReady = this._register(new Emitter());
        this.onProcessReady = this._traceEvent('_onProcessReady', this._onProcessReady.event);
        this._onProcessExit = this._register(new Emitter());
        this.onProcessExit = this._traceEvent('_onProcessExit', this._onProcessExit.event);
        this._onProcessOrphanQuestion = this._register(new Emitter());
        this.onProcessOrphanQuestion = this._traceEvent('_onProcessOrphanQuestion', this._onProcessOrphanQuestion.event);
        this._onDidRequestDetach = this._register(new Emitter());
        this.onDidRequestDetach = this._traceEvent('_onDidRequestDetach', this._onDidRequestDetach.event);
        this._onDidChangeProperty = this._register(new Emitter());
        this.onDidChangeProperty = this._traceEvent('_onDidChangeProperty', this._onDidChangeProperty.event);
        this._register(toDisposable(() => {
            for (const pty of this._ptys.values()) {
                pty.shutdown(true);
            }
            this._ptys.clear();
        }));
        this._detachInstanceRequestStore = this._register(new RequestStore(undefined, this._logService));
        this._detachInstanceRequestStore.onCreateRequest(this._onDidRequestDetach.fire, this._onDidRequestDetach);
        this._autoRepliesContribution = new AutoRepliesPtyServiceContribution(this._logService);
        this._contributions = [this._autoRepliesContribution];
    }
    async refreshIgnoreProcessNames(names) {
        ignoreProcessNames.length = 0;
        ignoreProcessNames.push(...names);
    }
    async requestDetachInstance(workspaceId, instanceId) {
        return this._detachInstanceRequestStore.createRequest({ workspaceId, instanceId });
    }
    async acceptDetachInstanceReply(requestId, persistentProcessId) {
        let processDetails = undefined;
        const pty = this._ptys.get(persistentProcessId);
        if (pty) {
            processDetails = await this._buildProcessDetails(persistentProcessId, pty);
        }
        this._detachInstanceRequestStore.acceptReply(requestId, processDetails);
    }
    async freePortKillProcess(port) {
        const stdout = await new Promise((resolve, reject) => {
            exec(isWindows ? `netstat -ano | findstr "${port}"` : `lsof -nP -iTCP -sTCP:LISTEN | grep ${port}`, {}, (err, stdout) => {
                if (err) {
                    return reject('Problem occurred when listing active processes');
                }
                resolve(stdout);
            });
        });
        const processesForPort = stdout.split(/\r?\n/).filter(s => !!s.trim());
        if (processesForPort.length >= 1) {
            const capturePid = /\s+(\d+)(?:\s+|$)/;
            const processId = processesForPort[0].match(capturePid)?.[1];
            if (processId) {
                try {
                    process.kill(Number.parseInt(processId));
                }
                catch { }
            }
            else {
                throw new Error(`Processes for port ${port} were not found`);
            }
            return { port, processId };
        }
        throw new Error(`Could not kill process with port ${port}`);
    }
    async serializeTerminalState(ids) {
        const promises = [];
        for (const [persistentProcessId, persistentProcess] of this._ptys.entries()) {
            // Only serialize persistent processes that have had data written or performed a replay
            if (persistentProcess.hasWrittenData && ids.indexOf(persistentProcessId) !== -1) {
                promises.push(Promises.withAsyncBody(async (r) => {
                    r({
                        id: persistentProcessId,
                        shellLaunchConfig: persistentProcess.shellLaunchConfig,
                        processDetails: await this._buildProcessDetails(persistentProcessId, persistentProcess),
                        processLaunchConfig: persistentProcess.processLaunchOptions,
                        unicodeVersion: persistentProcess.unicodeVersion,
                        replayEvent: await persistentProcess.serializeNormalBuffer(),
                        timestamp: Date.now()
                    });
                }));
            }
        }
        const serialized = {
            version: 1,
            state: await Promise.all(promises)
        };
        return JSON.stringify(serialized);
    }
    async reviveTerminalProcesses(workspaceId, state, dateTimeFormatLocale) {
        const promises = [];
        for (const terminal of state) {
            promises.push(this._reviveTerminalProcess(workspaceId, terminal));
        }
        await Promise.all(promises);
    }
    async _reviveTerminalProcess(workspaceId, terminal) {
        const restoreMessage = localize('terminal-history-restored', "History restored");
        // Conpty v1.22+ uses passthrough and doesn't reprint the buffer often, this means that when
        // the terminal is revived, the cursor would be at the bottom of the buffer then when
        // PSReadLine requests `GetConsoleCursorInfo` it will be handled by conpty itself by design.
        // This causes the cursor to move to the top into the replayed terminal contents. To avoid
        // this, the post restore message will print new lines to get a clear viewport and put the
        // cursor back at to top left.
        let postRestoreMessage = '';
        if (isWindows) {
            const lastReplayEvent = terminal.replayEvent.events.length > 0 ? terminal.replayEvent.events.at(-1) : undefined;
            if (lastReplayEvent) {
                postRestoreMessage += '\r\n'.repeat(lastReplayEvent.rows - 1) + `\x1b[H`;
            }
        }
        // TODO: We may at some point want to show date information in a hover via a custom sequence:
        //   new Date(terminal.timestamp).toLocaleDateString(dateTimeFormatLocale)
        //   new Date(terminal.timestamp).toLocaleTimeString(dateTimeFormatLocale)
        const newId = await this.createProcess({
            ...terminal.shellLaunchConfig,
            cwd: terminal.processDetails.cwd,
            color: terminal.processDetails.color,
            icon: terminal.processDetails.icon,
            name: terminal.processDetails.titleSource === TitleEventSource.Api ? terminal.processDetails.title : undefined,
            initialText: terminal.replayEvent.events[0].data + formatMessageForTerminal(restoreMessage, { loudFormatting: true }) + postRestoreMessage
        }, terminal.processDetails.cwd, terminal.replayEvent.events[0].cols, terminal.replayEvent.events[0].rows, terminal.unicodeVersion, terminal.processLaunchConfig.env, terminal.processLaunchConfig.executableEnv, terminal.processLaunchConfig.options, true, terminal.processDetails.workspaceId, terminal.processDetails.workspaceName, true, terminal.replayEvent.events[0].data);
        // Don't start the process here as there's no terminal to answer CPR
        const oldId = this._getRevivingProcessId(workspaceId, terminal.id);
        this._revivedPtyIdMap.set(oldId, { newId, state: terminal });
        this._logService.info(`Revived process, old id ${oldId} -> new id ${newId}`);
    }
    async shutdownAll() {
        this.dispose();
    }
    async createProcess(shellLaunchConfig, cwd, cols, rows, unicodeVersion, env, executableEnv, options, shouldPersist, workspaceId, workspaceName, isReviving, rawReviveBuffer) {
        if (shellLaunchConfig.attachPersistentProcess) {
            throw new Error('Attempt to create a process when attach object was provided');
        }
        const id = ++this._lastPtyId;
        const process = new TerminalProcess(shellLaunchConfig, cwd, cols, rows, env, executableEnv, options, this._logService, this._productService);
        const processLaunchOptions = {
            env,
            executableEnv,
            options
        };
        const persistentProcess = new PersistentTerminalProcess(id, process, workspaceId, workspaceName, shouldPersist, cols, rows, processLaunchOptions, unicodeVersion, this._reconnectConstants, this._logService, isReviving && isString(shellLaunchConfig.initialText) ? shellLaunchConfig.initialText : undefined, rawReviveBuffer, shellLaunchConfig.icon, shellLaunchConfig.color, shellLaunchConfig.name, shellLaunchConfig.fixedDimensions);
        process.onProcessExit(event => {
            for (const contrib of this._contributions) {
                contrib.handleProcessDispose(id);
            }
            persistentProcess.dispose();
            this._ptys.delete(id);
            this._onProcessExit.fire({ id, event });
        });
        persistentProcess.onProcessData(event => this._onProcessData.fire({ id, event }));
        persistentProcess.onProcessReplay(event => this._onProcessReplay.fire({ id, event }));
        persistentProcess.onProcessReady(event => this._onProcessReady.fire({ id, event }));
        persistentProcess.onProcessOrphanQuestion(() => this._onProcessOrphanQuestion.fire({ id }));
        persistentProcess.onDidChangeProperty(property => this._onDidChangeProperty.fire({ id, property }));
        persistentProcess.onPersistentProcessReady(() => {
            for (const contrib of this._contributions) {
                contrib.handleProcessReady(id, process);
            }
        });
        this._ptys.set(id, persistentProcess);
        return id;
    }
    async attachToProcess(id) {
        try {
            await this._throwIfNoPty(id).attach();
            this._logService.info(`Persistent process reconnection "${id}"`);
        }
        catch (e) {
            this._logService.warn(`Persistent process reconnection "${id}" failed`, e.message);
            throw e;
        }
    }
    async updateTitle(id, title, titleSource) {
        this._throwIfNoPty(id).setTitle(title, titleSource);
    }
    async updateIcon(id, userInitiated, icon, color) {
        this._throwIfNoPty(id).setIcon(userInitiated, icon, color);
    }
    async clearBuffer(id) {
        this._throwIfNoPty(id).clearBuffer();
    }
    async refreshProperty(id, type) {
        return this._throwIfNoPty(id).refreshProperty(type);
    }
    async updateProperty(id, type, value) {
        return this._throwIfNoPty(id).updateProperty(type, value);
    }
    async detachFromProcess(id, forcePersist) {
        return this._throwIfNoPty(id).detach(forcePersist);
    }
    async reduceConnectionGraceTime() {
        for (const pty of this._ptys.values()) {
            pty.reduceGraceTime();
        }
    }
    async listProcesses() {
        const persistentProcesses = Array.from(this._ptys.entries()).filter(([_, pty]) => pty.shouldPersistTerminal);
        this._logService.info(`Listing ${persistentProcesses.length} persistent terminals, ${this._ptys.size} total terminals`);
        const promises = persistentProcesses.map(async ([id, terminalProcessData]) => this._buildProcessDetails(id, terminalProcessData));
        const allTerminals = await Promise.all(promises);
        return allTerminals.filter(entry => entry.isOrphan);
    }
    async getPerformanceMarks() {
        return performance.getMarks();
    }
    async start(id) {
        const pty = this._ptys.get(id);
        return pty ? pty.start() : { message: `Could not find pty with id "${id}"` };
    }
    async shutdown(id, immediate) {
        // Don't throw if the pty is already shutdown
        return this._ptys.get(id)?.shutdown(immediate);
    }
    async input(id, data) {
        const pty = this._throwIfNoPty(id);
        if (pty) {
            for (const contrib of this._contributions) {
                contrib.handleProcessInput(id, data);
            }
            pty.input(data);
        }
    }
    async sendSignal(id, signal) {
        return this._throwIfNoPty(id).sendSignal(signal);
    }
    async processBinary(id, data) {
        return this._throwIfNoPty(id).writeBinary(data);
    }
    async resize(id, cols, rows) {
        const pty = this._throwIfNoPty(id);
        if (pty) {
            for (const contrib of this._contributions) {
                contrib.handleProcessResize(id, cols, rows);
            }
            pty.resize(cols, rows);
        }
    }
    async getInitialCwd(id) {
        return this._throwIfNoPty(id).getInitialCwd();
    }
    async getCwd(id) {
        return this._throwIfNoPty(id).getCwd();
    }
    async acknowledgeDataEvent(id, charCount) {
        return this._throwIfNoPty(id).acknowledgeDataEvent(charCount);
    }
    async setUnicodeVersion(id, version) {
        return this._throwIfNoPty(id).setUnicodeVersion(version);
    }
    async setNextCommandId(id, commandLine, commandId) {
        return this._throwIfNoPty(id).setNextCommandId(commandLine, commandId);
    }
    async getLatency() {
        return [];
    }
    async orphanQuestionReply(id) {
        return this._throwIfNoPty(id).orphanQuestionReply();
    }
    async getDefaultSystemShell(osOverride = OS) {
        return getSystemShell(osOverride, process.env);
    }
    async getEnvironment() {
        return { ...process.env };
    }
    async getWslPath(original, direction) {
        if (direction === 'win-to-unix') {
            if (!isWindows) {
                return original;
            }
            if (getWindowsBuildNumber() < 17063) {
                return original.replace(/\\/g, '/');
            }
            const wslExecutable = this._getWSLExecutablePath();
            if (!wslExecutable) {
                return original;
            }
            return new Promise(c => {
                const proc = execFile(wslExecutable, ['-e', 'wslpath', original], {}, (error, stdout, stderr) => {
                    c(error ? original : escapeNonWindowsPath(stdout.trim(), "bash" /* PosixShellType.Bash */));
                });
                proc.stdin.end();
            });
        }
        if (direction === 'unix-to-win') {
            // The backend is Windows, for example a local Windows workspace with a wsl session in
            // the terminal.
            if (isWindows) {
                if (getWindowsBuildNumber() < 17063) {
                    return original;
                }
                const wslExecutable = this._getWSLExecutablePath();
                if (!wslExecutable) {
                    return original;
                }
                return new Promise(c => {
                    const proc = execFile(wslExecutable, ['-e', 'wslpath', '-w', original], {}, (error, stdout, stderr) => {
                        c(error ? original : stdout.trim());
                    });
                    proc.stdin.end();
                });
            }
        }
        // Fallback just in case
        return original;
    }
    _getWSLExecutablePath() {
        const useWSLexe = getWindowsBuildNumber() >= 16299;
        const is32ProcessOn64Windows = process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432');
        const systemRoot = process.env['SystemRoot'];
        if (systemRoot) {
            return join(systemRoot, is32ProcessOn64Windows ? 'Sysnative' : 'System32', useWSLexe ? 'wsl.exe' : 'bash.exe');
        }
        return undefined;
    }
    async getRevivedPtyNewId(workspaceId, id) {
        try {
            return this._revivedPtyIdMap.get(this._getRevivingProcessId(workspaceId, id))?.newId;
        }
        catch (e) {
            this._logService.warn(`Couldn't find terminal ID ${workspaceId}-${id}`, e.message);
        }
        return undefined;
    }
    async setTerminalLayoutInfo(args) {
        this._workspaceLayoutInfos.set(args.workspaceId, args);
    }
    async getTerminalLayoutInfo(args) {
        performance.mark('code/willGetTerminalLayoutInfo');
        const layout = this._workspaceLayoutInfos.get(args.workspaceId);
        if (layout) {
            const doneSet = new Set();
            const expandedTabs = await Promise.all(layout.tabs.map(async (tab) => this._expandTerminalTab(args.workspaceId, tab, doneSet)));
            const tabs = expandedTabs.filter(t => t.terminals.length > 0);
            const expandedBackground = (await Promise.all(layout.background?.map(b => this._expandTerminalInstance(args.workspaceId, b, doneSet)) ?? [])).filter(b => b.terminal !== null).map(b => b.terminal);
            performance.mark('code/didGetTerminalLayoutInfo');
            return { tabs, background: expandedBackground };
        }
        performance.mark('code/didGetTerminalLayoutInfo');
        return undefined;
    }
    async _expandTerminalTab(workspaceId, tab, doneSet) {
        const expandedTerminals = (await Promise.all(tab.terminals.map(t => this._expandTerminalInstance(workspaceId, t, doneSet))));
        const filtered = expandedTerminals.filter(term => term.terminal !== null);
        return {
            isActive: tab.isActive,
            activePersistentProcessId: tab.activePersistentProcessId,
            terminals: filtered
        };
    }
    async _expandTerminalInstance(workspaceId, t, doneSet) {
        const hasLayout = !isNumber(t);
        const ptyId = hasLayout ? t.terminal : t;
        try {
            const oldId = this._getRevivingProcessId(workspaceId, ptyId);
            const revivedPtyId = this._revivedPtyIdMap.get(oldId)?.newId;
            this._logService.info(`Expanding terminal instance, old id ${oldId} -> new id ${revivedPtyId}`);
            this._revivedPtyIdMap.delete(oldId);
            const persistentProcessId = revivedPtyId ?? ptyId;
            if (doneSet.has(persistentProcessId)) {
                throw new Error(`Terminal ${persistentProcessId} has already been expanded`);
            }
            doneSet.add(persistentProcessId);
            const persistentProcess = this._throwIfNoPty(persistentProcessId);
            const processDetails = persistentProcess && await this._buildProcessDetails(ptyId, persistentProcess, revivedPtyId !== undefined);
            return {
                terminal: { ...processDetails, id: persistentProcessId },
                relativeSize: hasLayout ? t.relativeSize : 0
            };
        }
        catch (e) {
            this._logService.warn(`Couldn't get layout info, a terminal was probably disconnected`, e.message);
            this._logService.debug('Reattach to wrong terminal debug info - layout info by id', t);
            this._logService.debug('Reattach to wrong terminal debug info - _revivePtyIdMap', Array.from(this._revivedPtyIdMap.values()));
            this._logService.debug('Reattach to wrong terminal debug info - _ptys ids', Array.from(this._ptys.keys()));
            // this will be filtered out and not reconnected
            return {
                terminal: null,
                relativeSize: hasLayout ? t.relativeSize : 0
            };
        }
    }
    _getRevivingProcessId(workspaceId, ptyId) {
        return `${workspaceId}-${ptyId}`;
    }
    async _buildProcessDetails(id, persistentProcess, wasRevived = false) {
        performance.mark(`code/willBuildProcessDetails/${id}`);
        // If the process was just revived, don't do the orphan check as it will
        // take some time
        const [cwd, isOrphan] = await Promise.all([persistentProcess.getCwd(), wasRevived ? true : persistentProcess.isOrphaned()]);
        const result = {
            id,
            title: persistentProcess.title,
            titleSource: persistentProcess.titleSource,
            pid: persistentProcess.pid,
            workspaceId: persistentProcess.workspaceId,
            workspaceName: persistentProcess.workspaceName,
            cwd,
            isOrphan,
            icon: persistentProcess.icon,
            color: persistentProcess.color,
            fixedDimensions: persistentProcess.fixedDimensions,
            environmentVariableCollections: persistentProcess.processLaunchOptions.options.environmentVariableCollections,
            reconnectionProperties: persistentProcess.shellLaunchConfig.reconnectionProperties,
            waitOnExit: persistentProcess.shellLaunchConfig.waitOnExit,
            hideFromUser: persistentProcess.shellLaunchConfig.hideFromUser,
            isFeatureTerminal: persistentProcess.shellLaunchConfig.isFeatureTerminal,
            type: persistentProcess.shellLaunchConfig.type,
            hasChildProcesses: persistentProcess.hasChildProcesses,
            shellIntegrationNonce: persistentProcess.processLaunchOptions.options.shellIntegration.nonce,
            tabActions: persistentProcess.shellLaunchConfig.tabActions
        };
        performance.mark(`code/didBuildProcessDetails/${id}`);
        return result;
    }
    _throwIfNoPty(id) {
        const pty = this._ptys.get(id);
        if (!pty) {
            throw new ErrorNoTelemetry(`Could not find pty ${id} on pty host`);
        }
        return pty;
    }
}
__decorate([
    traceRpc
], PtyService.prototype, "installAutoReply", null);
__decorate([
    traceRpc
], PtyService.prototype, "uninstallAllAutoReplies", null);
__decorate([
    memoize
], PtyService.prototype, "traceRpcArgs", null);
__decorate([
    traceRpc
], PtyService.prototype, "refreshIgnoreProcessNames", null);
__decorate([
    traceRpc
], PtyService.prototype, "requestDetachInstance", null);
__decorate([
    traceRpc
], PtyService.prototype, "acceptDetachInstanceReply", null);
__decorate([
    traceRpc
], PtyService.prototype, "freePortKillProcess", null);
__decorate([
    traceRpc
], PtyService.prototype, "serializeTerminalState", null);
__decorate([
    traceRpc
], PtyService.prototype, "reviveTerminalProcesses", null);
__decorate([
    traceRpc
], PtyService.prototype, "shutdownAll", null);
__decorate([
    traceRpc
], PtyService.prototype, "createProcess", null);
__decorate([
    traceRpc
], PtyService.prototype, "attachToProcess", null);
__decorate([
    traceRpc
], PtyService.prototype, "updateTitle", null);
__decorate([
    traceRpc
], PtyService.prototype, "updateIcon", null);
__decorate([
    traceRpc
], PtyService.prototype, "clearBuffer", null);
__decorate([
    traceRpc
], PtyService.prototype, "refreshProperty", null);
__decorate([
    traceRpc
], PtyService.prototype, "updateProperty", null);
__decorate([
    traceRpc
], PtyService.prototype, "detachFromProcess", null);
__decorate([
    traceRpc
], PtyService.prototype, "reduceConnectionGraceTime", null);
__decorate([
    traceRpc
], PtyService.prototype, "listProcesses", null);
__decorate([
    traceRpc
], PtyService.prototype, "getPerformanceMarks", null);
__decorate([
    traceRpc
], PtyService.prototype, "start", null);
__decorate([
    traceRpc
], PtyService.prototype, "shutdown", null);
__decorate([
    traceRpc
], PtyService.prototype, "input", null);
__decorate([
    traceRpc
], PtyService.prototype, "sendSignal", null);
__decorate([
    traceRpc
], PtyService.prototype, "processBinary", null);
__decorate([
    traceRpc
], PtyService.prototype, "resize", null);
__decorate([
    traceRpc
], PtyService.prototype, "getInitialCwd", null);
__decorate([
    traceRpc
], PtyService.prototype, "getCwd", null);
__decorate([
    traceRpc
], PtyService.prototype, "acknowledgeDataEvent", null);
__decorate([
    traceRpc
], PtyService.prototype, "setUnicodeVersion", null);
__decorate([
    traceRpc
], PtyService.prototype, "setNextCommandId", null);
__decorate([
    traceRpc
], PtyService.prototype, "getLatency", null);
__decorate([
    traceRpc
], PtyService.prototype, "orphanQuestionReply", null);
__decorate([
    traceRpc
], PtyService.prototype, "getDefaultSystemShell", null);
__decorate([
    traceRpc
], PtyService.prototype, "getEnvironment", null);
__decorate([
    traceRpc
], PtyService.prototype, "getWslPath", null);
__decorate([
    traceRpc
], PtyService.prototype, "getRevivedPtyNewId", null);
__decorate([
    traceRpc
], PtyService.prototype, "setTerminalLayoutInfo", null);
__decorate([
    traceRpc
], PtyService.prototype, "getTerminalLayoutInfo", null);
var InteractionState;
(function (InteractionState) {
    /** The terminal has not been interacted with. */
    InteractionState["None"] = "None";
    /** The terminal has only been interacted with by the replay mechanism. */
    InteractionState["ReplayOnly"] = "ReplayOnly";
    /** The terminal has been directly interacted with this session. */
    InteractionState["Session"] = "Session";
})(InteractionState || (InteractionState = {}));
class PersistentTerminalProcess extends Disposable {
    get pid() { return this._pid; }
    get shellLaunchConfig() { return this._terminalProcess.shellLaunchConfig; }
    get hasWrittenData() { return this._interactionState.value !== "None" /* InteractionState.None */; }
    get title() { return this._title || this._terminalProcess.currentTitle; }
    get titleSource() { return this._titleSource; }
    get icon() { return this._icon; }
    get color() { return this._color; }
    get fixedDimensions() { return this._fixedDimensions; }
    get hasChildProcesses() { return this._terminalProcess.hasChildProcesses; }
    setTitle(title, titleSource) {
        if (titleSource === TitleEventSource.Api) {
            this._interactionState.setValue("Session" /* InteractionState.Session */, 'setTitle');
            this._serializer.freeRawReviveBuffer();
        }
        this._title = title;
        this._titleSource = titleSource;
    }
    setIcon(userInitiated, icon, color) {
        if (!this._icon || hasKey(icon, { id: true }) && hasKey(this._icon, { id: true }) && icon.id !== this._icon.id ||
            !this.color || color !== this._color) {
            this._serializer.freeRawReviveBuffer();
            if (userInitiated) {
                this._interactionState.setValue("Session" /* InteractionState.Session */, 'setIcon');
            }
        }
        this._icon = icon;
        this._color = color;
    }
    _setFixedDimensions(fixedDimensions) {
        this._fixedDimensions = fixedDimensions;
    }
    constructor(_persistentProcessId, _terminalProcess, workspaceId, workspaceName, shouldPersistTerminal, cols, rows, processLaunchOptions, unicodeVersion, reconnectConstants, _logService, reviveBuffer, rawReviveBuffer, _icon, _color, name, fixedDimensions) {
        super();
        this._persistentProcessId = _persistentProcessId;
        this._terminalProcess = _terminalProcess;
        this.workspaceId = workspaceId;
        this.workspaceName = workspaceName;
        this.shouldPersistTerminal = shouldPersistTerminal;
        this.processLaunchOptions = processLaunchOptions;
        this.unicodeVersion = unicodeVersion;
        this._logService = _logService;
        this._icon = _icon;
        this._color = _color;
        this._pendingCommands = new Map();
        this._isStarted = false;
        this._orphanRequestQueue = new Queue();
        this._onProcessReplay = this._register(new Emitter());
        this.onProcessReplay = this._onProcessReplay.event;
        this._onProcessReady = this._register(new Emitter());
        this.onProcessReady = this._onProcessReady.event;
        this._onPersistentProcessReady = this._register(new Emitter());
        /** Fired when the persistent process has a ready process and has finished its replay. */
        this.onPersistentProcessReady = this._onPersistentProcessReady.event;
        this._onProcessData = this._register(new Emitter());
        this.onProcessData = this._onProcessData.event;
        this._onProcessOrphanQuestion = this._register(new Emitter());
        this.onProcessOrphanQuestion = this._onProcessOrphanQuestion.event;
        this._onDidChangeProperty = this._register(new Emitter());
        this.onDidChangeProperty = this._onDidChangeProperty.event;
        this._inReplay = false;
        this._pid = -1;
        this._cwd = '';
        this._titleSource = TitleEventSource.Process;
        this._interactionState = new MutationLogger(`Persistent process "${this._persistentProcessId}" interaction state`, "None" /* InteractionState.None */, this._logService);
        this._wasRevived = reviveBuffer !== undefined;
        this._serializer = new XtermSerializer(cols, rows, reconnectConstants.scrollback, unicodeVersion, reviveBuffer, processLaunchOptions.options.shellIntegration.nonce, shouldPersistTerminal ? rawReviveBuffer : undefined, this._logService);
        if (name) {
            this.setTitle(name, TitleEventSource.Api);
        }
        this._fixedDimensions = fixedDimensions;
        this._orphanQuestionBarrier = null;
        this._orphanQuestionReplyTime = 0;
        this._disconnectRunner1 = this._register(new ProcessTimeRunOnceScheduler(() => {
            this._logService.info(`Persistent process "${this._persistentProcessId}": The reconnection grace time of ${printTime(reconnectConstants.graceTime)} has expired, shutting down pid "${this._pid}"`);
            this.shutdown(true);
        }, reconnectConstants.graceTime));
        this._disconnectRunner2 = this._register(new ProcessTimeRunOnceScheduler(() => {
            this._logService.info(`Persistent process "${this._persistentProcessId}": The short reconnection grace time of ${printTime(reconnectConstants.shortGraceTime)} has expired, shutting down pid ${this._pid}`);
            this.shutdown(true);
        }, reconnectConstants.shortGraceTime));
        this._register(this._terminalProcess.onProcessExit(() => this._bufferer.stopBuffering(this._persistentProcessId)));
        this._register(this._terminalProcess.onProcessReady(e => {
            this._pid = e.pid;
            this._cwd = e.cwd;
            this._onProcessReady.fire(e);
        }));
        this._register(this._terminalProcess.onDidChangeProperty(e => {
            this._onDidChangeProperty.fire(e);
        }));
        // Data buffering to reduce the amount of messages going to the renderer
        this._bufferer = new TerminalDataBufferer((_, data) => this._onProcessData.fire(data));
        this._register(this._bufferer.startBuffering(this._persistentProcessId, this._terminalProcess.onProcessData));
        // Data recording for reconnect
        this._register(this.onProcessData(e => this._serializer.handleData(e)));
    }
    async attach() {
        if (!this._disconnectRunner1.isScheduled() && !this._disconnectRunner2.isScheduled()) {
            this._logService.warn(`Persistent process "${this._persistentProcessId}": Process had no disconnect runners but was an orphan`);
        }
        this._disconnectRunner1.cancel();
        this._disconnectRunner2.cancel();
    }
    async detach(forcePersist) {
        // Keep the process around if it was indicated to persist and it has had some iteraction or
        // was replayed
        if (this.shouldPersistTerminal && (this._interactionState.value !== "None" /* InteractionState.None */ || forcePersist)) {
            this._disconnectRunner1.schedule();
        }
        else {
            this.shutdown(true);
        }
    }
    serializeNormalBuffer() {
        return this._serializer.generateReplayEvent(true, this._interactionState.value !== "Session" /* InteractionState.Session */);
    }
    async refreshProperty(type) {
        return this._terminalProcess.refreshProperty(type);
    }
    async updateProperty(type, value) {
        if (type === "fixedDimensions" /* ProcessPropertyType.FixedDimensions */) {
            return this._setFixedDimensions(value);
        }
    }
    async start() {
        if (!this._isStarted) {
            const result = await this._terminalProcess.start();
            if (result && hasKey(result, { message: true })) {
                // it's a terminal launch error
                return result;
            }
            this._isStarted = true;
            // If the process was revived, trigger a replay on first start. An alternative approach
            // could be to start it on the pty host before attaching but this fails on Windows as
            // conpty's inherit cursor option which is required, ends up sending DSR CPR which
            // causes conhost to hang when no response is received from the terminal (which wouldn't
            // be attached yet). https://github.com/microsoft/terminal/issues/11213
            if (this._wasRevived) {
                this.triggerReplay();
            }
            else {
                this._onPersistentProcessReady.fire();
            }
            return result;
        }
        this._onProcessReady.fire({ pid: this._pid, cwd: this._cwd, windowsPty: this._terminalProcess.getWindowsPty() });
        this._onDidChangeProperty.fire({ type: "title" /* ProcessPropertyType.Title */, value: this._terminalProcess.currentTitle });
        this._onDidChangeProperty.fire({ type: "shellType" /* ProcessPropertyType.ShellType */, value: this._terminalProcess.shellType });
        this.triggerReplay();
        return undefined;
    }
    shutdown(immediate) {
        return this._terminalProcess.shutdown(immediate);
    }
    input(data) {
        this._interactionState.setValue("Session" /* InteractionState.Session */, 'input');
        this._serializer.freeRawReviveBuffer();
        if (this._inReplay) {
            return;
        }
        return this._terminalProcess.input(data);
    }
    sendSignal(signal) {
        if (this._inReplay) {
            return;
        }
        return this._terminalProcess.sendSignal(signal);
    }
    writeBinary(data) {
        return this._terminalProcess.processBinary(data);
    }
    resize(cols, rows) {
        if (this._inReplay) {
            return;
        }
        this._serializer.handleResize(cols, rows);
        // Buffered events should flush when a resize occurs
        this._bufferer.flushBuffer(this._persistentProcessId);
        return this._terminalProcess.resize(cols, rows);
    }
    async clearBuffer() {
        this._serializer.clearBuffer();
        this._terminalProcess.clearBuffer();
    }
    setUnicodeVersion(version) {
        this.unicodeVersion = version;
        this._serializer.setUnicodeVersion?.(version);
        // TODO: Pass in unicode version in ctor
    }
    async setNextCommandId(commandLine, commandId) {
        this._serializer.setNextCommandId?.(commandLine, commandId);
    }
    acknowledgeDataEvent(charCount) {
        if (this._inReplay) {
            return;
        }
        return this._terminalProcess.acknowledgeDataEvent(charCount);
    }
    getInitialCwd() {
        return this._terminalProcess.getInitialCwd();
    }
    getCwd() {
        return this._terminalProcess.getCwd();
    }
    async triggerReplay() {
        if (this._interactionState.value === "None" /* InteractionState.None */) {
            this._interactionState.setValue("ReplayOnly" /* InteractionState.ReplayOnly */, 'triggerReplay');
        }
        const ev = await this._serializer.generateReplayEvent();
        let dataLength = 0;
        for (const e of ev.events) {
            dataLength += e.data.length;
        }
        this._logService.info(`Persistent process "${this._persistentProcessId}": Replaying ${dataLength} chars and ${ev.events.length} size events`);
        this._onProcessReplay.fire(ev);
        this._terminalProcess.clearUnacknowledgedChars();
        this._onPersistentProcessReady.fire();
    }
    sendCommandResult(reqId, isError, serializedPayload) {
        const data = this._pendingCommands.get(reqId);
        if (!data) {
            return;
        }
        this._pendingCommands.delete(reqId);
    }
    orphanQuestionReply() {
        this._orphanQuestionReplyTime = Date.now();
        if (this._orphanQuestionBarrier) {
            const barrier = this._orphanQuestionBarrier;
            this._orphanQuestionBarrier = null;
            barrier.open();
        }
    }
    reduceGraceTime() {
        if (this._disconnectRunner2.isScheduled()) {
            // we are disconnected and already running the short reconnection timer
            return;
        }
        if (this._disconnectRunner1.isScheduled()) {
            // we are disconnected and running the long reconnection timer
            this._disconnectRunner2.schedule();
        }
    }
    async isOrphaned() {
        return await this._orphanRequestQueue.queue(async () => this._isOrphaned());
    }
    async _isOrphaned() {
        // The process is already known to be orphaned
        if (this._disconnectRunner1.isScheduled() || this._disconnectRunner2.isScheduled()) {
            return true;
        }
        // Ask whether the renderer(s) whether the process is orphaned and await the reply
        if (!this._orphanQuestionBarrier) {
            // the barrier opens after 4 seconds with or without a reply
            this._orphanQuestionBarrier = new AutoOpenBarrier(4000);
            this._orphanQuestionReplyTime = 0;
            this._onProcessOrphanQuestion.fire();
        }
        await this._orphanQuestionBarrier.wait();
        return (Date.now() - this._orphanQuestionReplyTime > 500);
    }
}
class MutationLogger {
    get value() { return this._value; }
    setValue(value, reason) {
        if (this._value !== value) {
            this._value = value;
            this._log(reason);
        }
    }
    constructor(_name, _value, _logService) {
        this._name = _name;
        this._value = _value;
        this._logService = _logService;
        this._log('initialized');
    }
    _log(reason) {
        this._logService.debug(`MutationLogger "${this._name}" set to "${this._value}", reason: ${reason}`);
    }
}
class XtermSerializer {
    constructor(cols, rows, scrollback, unicodeVersion, reviveBufferWithRestoreMessage, shellIntegrationNonce, _rawReviveBuffer, logService) {
        this._rawReviveBuffer = _rawReviveBuffer;
        this._xterm = new XtermTerminal({
            cols,
            rows,
            scrollback,
            allowProposedApi: true
        });
        if (reviveBufferWithRestoreMessage) {
            this._xterm.writeln(reviveBufferWithRestoreMessage);
        }
        this.setUnicodeVersion(unicodeVersion);
        this._shellIntegrationAddon = new ShellIntegrationAddon(shellIntegrationNonce, true, undefined, undefined, logService);
        this._xterm.loadAddon(this._shellIntegrationAddon);
    }
    freeRawReviveBuffer() {
        // Free the memory of the terminal if it will need to be re-serialized
        this._rawReviveBuffer = undefined;
    }
    handleData(data) {
        this._xterm.write(data);
    }
    handleResize(cols, rows) {
        this._xterm.resize(cols, rows);
    }
    clearBuffer() {
        this._xterm.clear();
    }
    setNextCommandId(commandLine, commandId) {
        this._shellIntegrationAddon.setNextCommandId(commandLine, commandId);
    }
    async generateReplayEvent(normalBufferOnly, restoreToLastReviveBuffer) {
        const serialize = new (await this._getSerializeConstructor());
        this._xterm.loadAddon(serialize);
        const options = {
            scrollback: this._xterm.options.scrollback
        };
        if (normalBufferOnly) {
            options.excludeAltBuffer = true;
            options.excludeModes = true;
        }
        let serialized;
        if (restoreToLastReviveBuffer && this._rawReviveBuffer) {
            serialized = this._rawReviveBuffer;
        }
        else {
            serialized = serialize.serialize(options);
        }
        return {
            events: [
                {
                    cols: this._xterm.cols,
                    rows: this._xterm.rows,
                    data: serialized
                }
            ],
            commands: this._shellIntegrationAddon.serialize()
        };
    }
    async setUnicodeVersion(version) {
        if (this._xterm.unicode.activeVersion === version) {
            return;
        }
        if (version === '11') {
            this._unicodeAddon = new (await this._getUnicode11Constructor());
            this._xterm.loadAddon(this._unicodeAddon);
        }
        else {
            this._unicodeAddon?.dispose();
            this._unicodeAddon = undefined;
        }
        this._xterm.unicode.activeVersion = version;
    }
    async _getUnicode11Constructor() {
        if (!Unicode11Addon) {
            Unicode11Addon = (await import('@xterm/addon-unicode11')).Unicode11Addon;
        }
        return Unicode11Addon;
    }
    async _getSerializeConstructor() {
        if (!SerializeAddon) {
            SerializeAddon = (await import('@xterm/addon-serialize')).SerializeAddon;
        }
        return SerializeAddon;
    }
}
function printTime(ms) {
    let h = 0;
    let m = 0;
    let s = 0;
    if (ms >= 1000) {
        s = Math.floor(ms / 1000);
        ms -= s * 1000;
    }
    if (s >= 60) {
        m = Math.floor(s / 60);
        s -= m * 60;
    }
    if (m >= 60) {
        h = Math.floor(m / 60);
        m -= h * 60;
    }
    const _h = h ? `${h}h` : ``;
    const _m = m ? `${m}m` : ``;
    const _s = s ? `${s}s` : ``;
    const _ms = ms ? `${ms}ms` : ``;
    return `${_h}${_m}${_s}${_ms}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHR5U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS90ZXJtaW5hbC9ub2RlL3B0eVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDL0MsT0FBTyxFQUFFLGVBQWUsRUFBRSwyQkFBMkIsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3ZILE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzdFLE9BQU8sRUFBdUIsU0FBUyxFQUFtQixFQUFFLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUV2RyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDN0QsT0FBTyxFQUFlLFFBQVEsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ2hFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUN6RCxPQUFPLEVBQXdRLGdCQUFnQixFQUF3UyxNQUFNLHVCQUF1QixDQUFDO0FBQ3JtQixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMxRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUl4RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNqRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDdkQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzNDLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDBC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QUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDdkIsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDYixDQUFDO0lBQ0QsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7UUFDYixDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDdkIsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDYixDQUFDO0lBQ0QsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDNUIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDNUIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDNUIsTUFBTSxHQUFHLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDaEMsT0FBTyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEdBQUcsRUFBRSxDQUFDO0FBQ2hDLENBQUMifQ==