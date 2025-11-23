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
import * as cp from 'child_process';
import * as net from 'net';
import { VSBuffer } from '../../base/common/buffer.js';
import { Emitter, Event } from '../../base/common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../base/common/lifecycle.js';
import { FileAccess } from '../../base/common/network.js';
import { delimiter, join } from '../../base/common/path.js';
import { isWindows } from '../../base/common/platform.js';
import { removeDangerousEnvVariables } from '../../base/common/processes.js';
import { createRandomIPCHandle, NodeSocket } from '../../base/parts/ipc/node/ipc.net.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { ILogService } from '../../platform/log/common/log.js';
import { getResolvedShellEnv } from '../../platform/shell/node/shellEnv.js';
import { IExtensionHostStatusService } from './extensionHostStatusService.js';
import { getNLSConfiguration } from './remoteLanguagePacks.js';
import { IServerEnvironmentService } from './serverEnvironmentService.js';
import { IPCExtHostConnection, SocketExtHostConnection, writeExtHostConnection } from '../../workbench/services/extensions/common/extensionHostEnv.js';
export async function buildUserEnvironment(startParamsEnv = {}, withUserShellEnvironment, language, environmentService, logService, configurationService) {
    const nlsConfig = await getNLSConfiguration(language, environmentService.userDataPath);
    let userShellEnv = {};
    if (withUserShellEnvironment) {
        try {
            userShellEnv = await getResolvedShellEnv(configurationService, logService, environmentService.args, process.env);
        }
        catch (error) {
            logService.error('ExtensionHostConnection#buildUserEnvironment resolving shell environment failed', error);
        }
    }
    const processEnv = process.env;
    const env = {
        ...processEnv,
        ...userShellEnv,
        ...{
            VSCODE_ESM_ENTRYPOINT: 'vs/workbench/api/node/extensionHostProcess',
            VSCODE_HANDLES_UNCAUGHT_ERRORS: 'true',
            VSCODE_NLS_CONFIG: JSON.stringify(nlsConfig)
        },
        ...startParamsEnv
    };
    const binFolder = environmentService.isBuilt ? join(environmentService.appRoot, 'bin') : join(environmentService.appRoot, 'resources', 'server', 'bin-dev');
    const remoteCliBinFolder = join(binFolder, 'remote-cli'); // contains the `code` command that can talk to the remote server
    let PATH = readCaseInsensitive(env, 'PATH');
    if (PATH) {
        PATH = remoteCliBinFolder + delimiter + PATH;
    }
    else {
        PATH = remoteCliBinFolder;
    }
    setCaseInsensitive(env, 'PATH', PATH);
    if (!environmentService.args['without-browser-env-var']) {
        env.BROWSER = join(binFolder, 'helpers', isWindows ? 'browser.cmd' : 'browser.sh'); // a command that opens a browser on the local machine
    }
    env.VSCODE_RECONNECTION_GRACE_TIME = String(environmentService.reconnectionGraceTime);
    logService.trace(`[reconnection-grace-time] Setting VSCODE_RECONNECTION_GRACE_TIME env var for extension host: ${environmentService.reconnectionGraceTime}ms (${Math.floor(environmentService.reconnectionGraceTime / 1000)}s)`);
    removeNulls(env);
    return env;
}
class ConnectionData {
    constructor(socket, initialDataChunk) {
        this.socket = socket;
        this.initialDataChunk = initialDataChunk;
    }
    socketDrain() {
        return this.socket.drain();
    }
    toIExtHostSocketMessage() {
        let skipWebSocketFrames;
        let permessageDeflate;
        let inflateBytes;
        if (this.socket instanceof NodeSocket) {
            skipWebSocketFrames = true;
            permessageDeflate = false;
            inflateBytes = VSBuffer.alloc(0);
        }
        else {
            skipWebSocketFrames = false;
            permessageDeflate = this.socket.permessageDeflate;
            inflateBytes = this.socket.recordedInflateBytes;
        }
        return {
            type: 'VSCODE_EXTHOST_IPC_SOCKET',
            initialDataChunk: this.initialDataChunk.buffer.toString('base64'),
            skipWebSocketFrames: skipWebSocketFrames,
            permessageDeflate: permessageDeflate,
            inflateBytes: inflateBytes.buffer.toString('base64'),
        };
    }
}
let ExtensionHostConnection = class ExtensionHostConnection extends Disposable {
    constructor(_reconnectionToken, remoteAddress, socket, initialDataChunk, _environmentService, _logService, _extensionHostStatusService, _configurationService) {
        super();
        this._reconnectionToken = _reconnectionToken;
        this._environmentService = _environmentService;
        this._logService = _logService;
        this._extensionHostStatusService = _extensionHostStatusService;
        this._configurationService = _configurationService;
        this._onClose = new Emitter();
        this.onClose = this._onClose.event;
        this._canSendSocket = (!isWindows || !this._environmentService.args['socket-path']);
        this._disposed = false;
        this._remoteAddress = remoteAddress;
        this._extensionHostProcess = null;
        this._connectionData = new ConnectionData(socket, initialDataChunk);
        this._log(`New connection established.`);
    }
    dispose() {
        this._cleanResources();
        super.dispose();
    }
    get _logPrefix() {
        return `[${this._remoteAddress}][${this._reconnectionToken.substr(0, 8)}][ExtensionHostConnection] `;
    }
    _log(_str) {
        this._logService.info(`${this._logPrefix}${_str}`);
    }
    _logError(_str) {
        this._logService.error(`${this._logPrefix}${_str}`);
    }
    async _pipeSockets(extHostSocket, connectionData) {
        const disposables = new DisposableStore();
        disposables.add(connectionData.socket);
        disposables.add(toDisposable(() => {
            extHostSocket.destroy();
        }));
        const stopAndCleanup = () => {
            disposables.dispose();
        };
        disposables.add(connectionData.socket.onEnd(stopAndCleanup));
        disposables.add(connectionData.socket.onClose(stopAndCleanup));
        disposables.add(Event.fromNodeEventEmitter(extHostSocket, 'end')(stopAndCleanup));
        disposables.add(Event.fromNodeEventEmitter(extHostSocket, 'close')(stopAndCleanup));
        disposables.add(Event.fromNodeEventEmitter(extHostSocket, 'error')(stopAndCleanup));
        disposables.add(connectionData.socket.onData((e) => extHostSocket.write(e.buffer)));
        disposables.add(Event.fromNodeEventEmitter(extHostSocket, 'data')((e) => {
            connectionData.socket.write(VSBuffer.wrap(e));
        }));
        if (connectionData.initialDataChunk.byteLength > 0) {
            extHostSocket.write(connectionData.initialDataChunk.buffer);
        }
    }
    async _sendSocketToExtensionHost(extensionHostProcess, connectionData) {
        // Make sure all outstanding writes have been drained before sending the socket
        await connectionData.socketDrain();
        const msg = connectionData.toIExtHostSocketMessage();
        let socket;
        if (connectionData.socket instanceof NodeSocket) {
            socket = connectionData.socket.socket;
        }
        else {
            socket = connectionData.socket.socket.socket;
        }
        extensionHostProcess.send(msg, socket);
    }
    shortenReconnectionGraceTimeIfNecessary() {
        if (!this._extensionHostProcess) {
            return;
        }
        const msg = {
            type: 'VSCODE_EXTHOST_IPC_REDUCE_GRACE_TIME'
        };
        this._extensionHostProcess.send(msg);
    }
    acceptReconnection(remoteAddress, _socket, initialDataChunk) {
        this._remoteAddress = remoteAddress;
        this._log(`The client has reconnected.`);
        const connectionData = new ConnectionData(_socket, initialDataChunk);
        if (!this._extensionHostProcess) {
            // The extension host didn't even start up yet
            this._connectionData = connectionData;
            return;
        }
        this._sendSocketToExtensionHost(this._extensionHostProcess, connectionData);
    }
    _cleanResources() {
        if (this._disposed) {
            // already called
            return;
        }
        this._disposed = true;
        if (this._connectionData) {
            this._connectionData.socket.end();
            this._connectionData = null;
        }
        if (this._extensionHostProcess) {
            this._extensionHostProcess.kill();
            this._extensionHostProcess = null;
        }
        this._onClose.fire(undefined);
    }
    async start(startParams) {
        try {
            let execArgv = process.execArgv ? process.execArgv.filter(a => !/^--inspect(-brk)?=/.test(a)) : [];
            // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
            if (startParams.port && !process.pkg) {
                execArgv = [
                    `--inspect${startParams.break ? '-brk' : ''}=${startParams.port}`,
                    '--experimental-network-inspection'
                ];
            }
            const env = await buildUserEnvironment(startParams.env, true, startParams.language, this._environmentService, this._logService, this._configurationService);
            removeDangerousEnvVariables(env);
            let extHostNamedPipeServer;
            if (this._canSendSocket) {
                writeExtHostConnection(new SocketExtHostConnection(), env);
                extHostNamedPipeServer = null;
            }
            else {
                const { namedPipeServer, pipeName } = await this._listenOnPipe();
                writeExtHostConnection(new IPCExtHostConnection(pipeName), env);
                extHostNamedPipeServer = namedPipeServer;
            }
            const opts = {
                env,
                execArgv,
                silent: true
            };
            // Refs https://github.com/microsoft/vscode/issues/189805
            opts.execArgv.unshift('--dns-result-order=ipv4first');
            // Run Extension Host as fork of current process
            const args = ['--type=extensionHost', `--transformURIs`];
            const useHostProxy = this._environmentService.args['use-host-proxy'];
            args.push(`--useHostProxy=${useHostProxy ? 'true' : 'false'}`);
            if (this._configurationService.getValue('extensions.supportNodeGlobalNavigator')) {
                args.push('--supportGlobalNavigator');
            }
            this._extensionHostProcess = cp.fork(FileAccess.asFileUri('bootstrap-fork').fsPath, args, opts);
            const pid = this._extensionHostProcess.pid;
            this._log(`<${pid}> Launched Extension Host Process.`);
            // Catch all output coming from the extension host process
            this._extensionHostProcess.stdout.setEncoding('utf8');
            this._extensionHostProcess.stderr.setEncoding('utf8');
            const onStdout = Event.fromNodeEventEmitter(this._extensionHostProcess.stdout, 'data');
            const onStderr = Event.fromNodeEventEmitter(this._extensionHostProcess.stderr, 'data');
            this._register(onStdout((e) => this._log(`<${pid}> ${e}`)));
            this._register(onStderr((e) => this._log(`<${pid}><stderr> ${e}`)));
            // Lifecycle
            this._extensionHostProcess.on('error', (err) => {
                this._logError(`<${pid}> Extension Host Process had an error`);
                this._logService.error(err);
                this._cleanResources();
            });
            this._extensionHostProcess.on('exit', (code, signal) => {
                this._extensionHostStatusService.setExitInfo(this._reconnectionToken, { code, signal });
                this._log(`<${pid}> Extension Host Process exited with code: ${code}, signal: ${signal}.`);
                this._cleanResources();
            });
            if (extHostNamedPipeServer) {
                extHostNamedPipeServer.on('connection', (socket) => {
                    extHostNamedPipeServer.close();
                    this._pipeSockets(socket, this._connectionData);
                });
            }
            else {
                const messageListener = (msg) => {
                    if (msg.type === 'VSCODE_EXTHOST_IPC_READY') {
                        this._extensionHostProcess.removeListener('message', messageListener);
                        this._sendSocketToExtensionHost(this._extensionHostProcess, this._connectionData);
                        this._connectionData = null;
                    }
                };
                this._extensionHostProcess.on('message', messageListener);
            }
        }
        catch (error) {
            console.error('ExtensionHostConnection errored');
            if (error) {
                console.error(error);
            }
        }
    }
    _listenOnPipe() {
        return new Promise((resolve, reject) => {
            const pipeName = createRandomIPCHandle();
            const namedPipeServer = net.createServer();
            namedPipeServer.on('error', reject);
            namedPipeServer.listen(pipeName, () => {
                namedPipeServer?.removeListener('error', reject);
                resolve({ pipeName, namedPipeServer });
            });
        });
    }
};
ExtensionHostConnection = __decorate([
    __param(4, IServerEnvironmentService),
    __param(5, ILogService),
    __param(6, IExtensionHostStatusService),
    __param(7, IConfigurationService)
], ExtensionHostConnection);
export { ExtensionHostConnection };
function readCaseInsensitive(env, key) {
    const pathKeys = Object.keys(env).filter(k => k.toLowerCase() === key.toLowerCase());
    const pathKey = pathKeys.length > 0 ? pathKeys[0] : key;
    return env[pathKey];
}
function setCaseInsensitive(env, key, value) {
    const pathKeys = Object.keys(env).filter(k => k.toLowerCase() === key.toLowerCase());
    const pathKey = pathKeys.length > 0 ? pathKeys[0] : key;
    env[pathKey] = value;
}
function removeNulls(env) {
    // Don't delete while iterating the object itself
    for (const key of Object.keys(env)) {
        if (env[key] === null) {
            delete env[key];
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uSG9zdENvbm5lY3Rpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvc2VydmVyL25vZGUvZXh0ZW5zaW9uSG9zdENvbm5lY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDcEMsT0FBTyxLQUFLLEdBQUcsTUFBTSxLQUFLLENBQUM7QUFDM0IsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDNUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDM0YsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQzFELE9BQU8sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDNUQsT0FBTyxFQUF1QixTQUFTLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRSxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUM3RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsVUFBVSxFQUF1QixNQUFNLHNDQUFzQyxDQUFDO0FBQzlHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUUvRCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMvRCxP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