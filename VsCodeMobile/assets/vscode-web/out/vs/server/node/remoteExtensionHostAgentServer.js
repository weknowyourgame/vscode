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
import * as fs from 'fs';
import * as net from 'net';
import { createRequire } from 'node:module';
import { performance } from 'perf_hooks';
import * as url from 'url';
import { VSBuffer } from '../../base/common/buffer.js';
import { isSigPipeError, onUnexpectedError, setUnexpectedErrorHandler } from '../../base/common/errors.js';
import { isEqualOrParent } from '../../base/common/extpath.js';
import { Disposable, DisposableStore } from '../../base/common/lifecycle.js';
import { connectionTokenQueryName, FileAccess, getServerProductSegment, Schemas } from '../../base/common/network.js';
import { dirname, join } from '../../base/common/path.js';
import * as perf from '../../base/common/performance.js';
import * as platform from '../../base/common/platform.js';
import { createRegExp, escapeRegExpCharacters } from '../../base/common/strings.js';
import { URI } from '../../base/common/uri.js';
import { generateUuid } from '../../base/common/uuid.js';
import { getOSReleaseInfo } from '../../base/node/osReleaseInfo.js';
import { findFreePort } from '../../base/node/ports.js';
import { addUNCHostToAllowlist, disableUNCAccessRestrictions } from '../../base/node/unc.js';
import { PersistentProtocol } from '../../base/parts/ipc/common/ipc.net.js';
import { NodeSocket, upgradeToISocket } from '../../base/parts/ipc/node/ipc.net.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../platform/log/common/log.js';
import { IProductService } from '../../platform/product/common/productService.js';
import { ITelemetryService } from '../../platform/telemetry/common/telemetry.js';
import { ExtensionHostConnection } from './extensionHostConnection.js';
import { ManagementConnection } from './remoteExtensionManagement.js';
import { determineServerConnectionToken, requestHasValidConnectionToken as httpRequestHasValidConnectionToken, ServerConnectionTokenParseError } from './serverConnectionToken.js';
import { IServerEnvironmentService } from './serverEnvironmentService.js';
import { setupServerServices } from './serverServices.js';
import { serveError, serveFile, WebClientServer } from './webClientServer.js';
const require = createRequire(import.meta.url);
const SHUTDOWN_TIMEOUT = 5 * 60 * 1000;
let RemoteExtensionHostAgentServer = class RemoteExtensionHostAgentServer extends Disposable {
    constructor(_socketServer, _connectionToken, _vsdaMod, hasWebClient, serverBasePath, _environmentService, _productService, _logService, _instantiationService) {
        super();
        this._socketServer = _socketServer;
        this._connectionToken = _connectionToken;
        this._vsdaMod = _vsdaMod;
        this._environmentService = _environmentService;
        this._productService = _productService;
        this._logService = _logService;
        this._instantiationService = _instantiationService;
        this._webEndpointOriginChecker = WebEndpointOriginChecker.create(this._productService);
        if (serverBasePath !== undefined && serverBasePath.charCodeAt(serverBasePath.length - 1) === 47 /* CharCode.Slash */) {
            // Remove trailing slash from base path
            serverBasePath = serverBasePath.substring(0, serverBasePath.length - 1);
        }
        this._serverBasePath = serverBasePath; // undefined or starts with a slash
        this._serverProductPath = `/${getServerProductSegment(_productService)}`; // starts with a slash
        this._extHostConnections = Object.create(null);
        this._managementConnections = Object.create(null);
        this._allReconnectionTokens = new Set();
        this._webClientServer = (hasWebClient
            ? this._instantiationService.createInstance(WebClientServer, this._connectionToken, serverBasePath ?? '/', this._serverProductPath)
            : null);
        this._logService.info(`Extension host agent started.`);
        this._reconnectionGraceTime = this._environmentService.reconnectionGraceTime;
        this._waitThenShutdown(true);
    }
    async handleRequest(req, res) {
        // Only serve GET requests
        if (req.method !== 'GET') {
            return serveError(req, res, 405, `Unsupported method ${req.method}`);
        }
        if (!req.url) {
            return serveError(req, res, 400, `Bad request.`);
        }
        const parsedUrl = url.parse(req.url, true);
        let pathname = parsedUrl.pathname;
        if (!pathname) {
            return serveError(req, res, 400, `Bad request.`);
        }
        // Serve from both '/' and serverBasePath
        if (this._serverBasePath !== undefined && pathname.startsWith(this._serverBasePath)) {
            pathname = pathname.substring(this._serverBasePath.length) || '/';
        }
        // for now accept all paths, with or without server product path
        if (pathname.startsWith(this._serverProductPath) && pathname.charCodeAt(this._serverProductPath.length) === 47 /* CharCode.Slash */) {
            pathname = pathname.substring(this._serverProductPath.length);
        }
        // Version
        if (pathname === '/version') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            return void res.end(this._productService.commit || '');
        }
        // Delay shutdown
        if (pathname === '/delay-shutdown') {
            this._delayShutdown();
            res.writeHead(200);
            return void res.end('OK');
        }
        if (!httpRequestHasValidConnectionToken(this._connectionToken, req, parsedUrl)) {
            // invalid connection token
            return serveError(req, res, 403, `Forbidden.`);
        }
        if (pathname === '/vscode-remote-resource') {
            // Handle HTTP requests for resources rendered in the rich client (images, fonts, etc.)
            // These resources could be files shipped with extensions or even workspace files.
            const desiredPath = parsedUrl.query['path'];
            if (typeof desiredPath !== 'string') {
                return serveError(req, res, 400, `Bad request.`);
            }
            let filePath;
            try {
                filePath = URI.from({ scheme: Schemas.file, path: desiredPath }).fsPath;
            }
            catch (err) {
                return serveError(req, res, 400, `Bad request.`);
            }
            const responseHeaders = Object.create(null);
            if (this._environmentService.isBuilt) {
                if (isEqualOrParent(filePath, this._environmentService.builtinExtensionsPath, !platform.isLinux)
                    || isEqualOrParent(filePath, this._environmentService.extensionsPath, !platform.isLinux)) {
                    responseHeaders['Cache-Control'] = 'public, max-age=31536000';
                }
            }
            // Allow cross origin requests from the web worker extension host
            responseHeaders['Vary'] = 'Origin';
            const requestOrigin = req.headers['origin'];
            if (requestOrigin && this._webEndpointOriginChecker.matches(requestOrigin)) {
                responseHeaders['Access-Control-Allow-Origin'] = requestOrigin;
            }
            return serveFile(filePath, 1 /* CacheControl.ETAG */, this._logService, req, res, responseHeaders);
        }
        // workbench web UI
        if (this._webClientServer) {
            this._webClientServer.handle(req, res, parsedUrl, pathname);
            return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return void res.end('Not found');
    }
    handleUpgrade(req, socket) {
        let reconnectionToken = generateUuid();
        let isReconnection = false;
        let skipWebSocketFrames = false;
        if (req.url) {
            const query = url.parse(req.url, true).query;
            if (typeof query.reconnectionToken === 'string') {
                reconnectionToken = query.reconnectionToken;
            }
            if (query.reconnection === 'true') {
                isReconnection = true;
            }
            if (query.skipWebSocketFrames === 'true') {
                skipWebSocketFrames = true;
            }
        }
        const upgraded = upgradeToISocket(req, socket, {
            debugLabel: `server-connection-${reconnectionToken}`,
            skipWebSocketFrames,
            disableWebSocketCompression: this._environmentService.args['disable-websocket-compression']
        });
        if (!upgraded) {
            return;
        }
        this._handleWebSocketConnection(upgraded, isReconnection, reconnectionToken);
    }
    handleServerError(err) {
        this._logService.error(`Error occurred in server`);
        this._logService.error(err);
    }
    // Eventually cleanup
    _getRemoteAddress(socket) {
        let _socket;
        if (socket instanceof NodeSocket) {
            _socket = socket.socket;
        }
        else {
            _socket = socket.socket.socket;
        }
        return _socket.remoteAddress || `<unknown>`;
    }
    async _rejectWebSocketConnection(logPrefix, protocol, reason) {
        const socket = protocol.getSocket();
        this._logService.error(`${logPrefix} ${reason}.`);
        const errMessage = {
            type: 'error',
            reason: reason
        };
        protocol.sendControl(VSBuffer.fromString(JSON.stringify(errMessage)));
        protocol.dispose();
        await socket.drain();
        socket.dispose();
    }
    /**
     * NOTE: Avoid using await in this method!
     * The problem is that await introduces a process.nextTick due to the implicit Promise.then
     * This can lead to some bytes being received and interpreted and a control message being emitted before the next listener has a chance to be registered.
     */
    _handleWebSocketConnection(socket, isReconnection, reconnectionToken) {
        const remoteAddress = this._getRemoteAddress(socket);
        const logPrefix = `[${remoteAddress}][${reconnectionToken.substr(0, 8)}]`;
        const protocol = new PersistentProtocol({ socket });
        const validator = this._vsdaMod ? new this._vsdaMod.validator() : null;
        const signer = this._vsdaMod ? new this._vsdaMod.signer() : null;
        let State;
        (function (State) {
            State[State["WaitingForAuth"] = 0] = "WaitingForAuth";
            State[State["WaitingForConnectionType"] = 1] = "WaitingForConnectionType";
            State[State["Done"] = 2] = "Done";
            State[State["Error"] = 3] = "Error";
        })(State || (State = {}));
        let state = 0 /* State.WaitingForAuth */;
        const rejectWebSocketConnection = (msg) => {
            state = 3 /* State.Error */;
            listener.dispose();
            this._rejectWebSocketConnection(logPrefix, protocol, msg);
        };
        const listener = protocol.onControlMessage((raw) => {
            if (state === 0 /* State.WaitingForAuth */) {
                let msg1;
                try {
                    msg1 = JSON.parse(raw.toString());
                }
                catch (err) {
                    return rejectWebSocketConnection(`Malformed first message`);
                }
                if (msg1.type !== 'auth') {
                    return rejectWebSocketConnection(`Invalid first message`);
                }
                if (this._connectionToken.type === 2 /* ServerConnectionTokenType.Mandatory */ && !this._connectionToken.validate(msg1.auth)) {
                    return rejectWebSocketConnection(`Unauthorized client refused: auth mismatch`);
                }
                // Send `sign` request
                let signedData = generateUuid();
                if (signer) {
                    try {
                        signedData = signer.sign(msg1.data);
                    }
                    catch (e) {
                    }
                }
                let someText = generateUuid();
                if (validator) {
                    try {
                        someText = validator.createNewMessage(someText);
                    }
                    catch (e) {
                    }
                }
                const signRequest = {
                    type: 'sign',
                    data: someText,
                    signedData: signedData
                };
                protocol.sendControl(VSBuffer.fromString(JSON.stringify(signRequest)));
                state = 1 /* State.WaitingForConnectionType */;
            }
            else if (state === 1 /* State.WaitingForConnectionType */) {
                let msg2;
                try {
                    msg2 = JSON.parse(raw.toString());
                }
                catch (err) {
                    return rejectWebSocketConnection(`Malformed second message`);
                }
                if (msg2.type !== 'connectionType') {
                    return rejectWebSocketConnection(`Invalid second message`);
                }
                if (typeof msg2.signedData !== 'string') {
                    return rejectWebSocketConnection(`Invalid second message field type`);
                }
                const rendererCommit = msg2.commit;
                const myCommit = this._productService.commit;
                if (rendererCommit && myCommit) {
                    // Running in the built version where commits are defined
                    if (rendererCommit !== myCommit) {
                        return rejectWebSocketConnection(`Client refused: version mismatch`);
                    }
                }
                let valid = false;
                if (!validator) {
                    valid = true;
                }
                else if (this._connectionToken.validate(msg2.signedData)) {
                    // web client
                    valid = true;
                }
                else {
                    try {
                        valid = validator.validate(msg2.signedData) === 'ok';
                    }
                    catch (e) {
                    }
                }
                if (!valid) {
                    if (this._environmentService.isBuilt) {
                        return rejectWebSocketConnection(`Unauthorized client refused`);
                    }
                    else {
                        this._logService.error(`${logPrefix} Unauthorized client handshake failed but we proceed because of dev mode.`);
                    }
                }
                // We have received a new connection.
                // This indicates that the server owner has connectivity.
                // Therefore we will shorten the reconnection grace period for disconnected connections!
                for (const key in this._managementConnections) {
                    const managementConnection = this._managementConnections[key];
                    managementConnection.shortenReconnectionGraceTimeIfNecessary();
                }
                for (const key in this._extHostConnections) {
                    const extHostConnection = this._extHostConnections[key];
                    extHostConnection.shortenReconnectionGraceTimeIfNecessary();
                }
                state = 2 /* State.Done */;
                listener.dispose();
                this._handleConnectionType(remoteAddress, logPrefix, protocol, socket, isReconnection, reconnectionToken, msg2);
            }
        });
    }
    async _handleConnectionType(remoteAddress, _logPrefix, protocol, socket, isReconnection, reconnectionToken, msg) {
        const logPrefix = (msg.desiredConnectionType === 1 /* ConnectionType.Management */
            ? `${_logPrefix}[ManagementConnection]`
            : msg.desiredConnectionType === 2 /* ConnectionType.ExtensionHost */
                ? `${_logPrefix}[ExtensionHostConnection]`
                : _logPrefix);
        if (msg.desiredConnectionType === 1 /* ConnectionType.Management */) {
            // This should become a management connection
            if (isReconnection) {
                // This is a reconnection
                if (!this._managementConnections[reconnectionToken]) {
                    if (!this._allReconnectionTokens.has(reconnectionToken)) {
                        // This is an unknown reconnection token
                        return this._rejectWebSocketConnection(logPrefix, protocol, `Unknown reconnection token (never seen)`);
                    }
                    else {
                        // This is a connection that was seen in the past, but is no longer valid
                        return this._rejectWebSocketConnection(logPrefix, protocol, `Unknown reconnection token (seen before)`);
                    }
                }
                protocol.sendControl(VSBuffer.fromString(JSON.stringify({ type: 'ok' })));
                const dataChunk = protocol.readEntireBuffer();
                protocol.dispose();
                this._managementConnections[reconnectionToken].acceptReconnection(remoteAddress, socket, dataChunk);
            }
            else {
                // This is a fresh connection
                if (this._managementConnections[reconnectionToken]) {
                    // Cannot have two concurrent connections using the same reconnection token
                    return this._rejectWebSocketConnection(logPrefix, protocol, `Duplicate reconnection token`);
                }
                protocol.sendControl(VSBuffer.fromString(JSON.stringify({ type: 'ok' })));
                const con = new ManagementConnection(this._logService, reconnectionToken, remoteAddress, protocol, this._reconnectionGraceTime);
                this._socketServer.acceptConnection(con.protocol, con.onClose);
                this._managementConnections[reconnectionToken] = con;
                this._allReconnectionTokens.add(reconnectionToken);
                con.onClose(() => {
                    delete this._managementConnections[reconnectionToken];
                });
            }
        }
        else if (msg.desiredConnectionType === 2 /* ConnectionType.ExtensionHost */) {
            // This should become an extension host connection
            const startParams0 = msg.args || { language: 'en' };
            const startParams = await this._updateWithFreeDebugPort(startParams0);
            if (startParams.port) {
                this._logService.trace(`${logPrefix} - startParams debug port ${startParams.port}`);
            }
            this._logService.trace(`${logPrefix} - startParams language: ${startParams.language}`);
            this._logService.trace(`${logPrefix} - startParams env: ${JSON.stringify(startParams.env)}`);
            if (isReconnection) {
                // This is a reconnection
                if (!this._extHostConnections[reconnectionToken]) {
                    if (!this._allReconnectionTokens.has(reconnectionToken)) {
                        // This is an unknown reconnection token
                        return this._rejectWebSocketConnection(logPrefix, protocol, `Unknown reconnection token (never seen)`);
                    }
                    else {
                        // This is a connection that was seen in the past, but is no longer valid
                        return this._rejectWebSocketConnection(logPrefix, protocol, `Unknown reconnection token (seen before)`);
                    }
                }
                protocol.sendPause();
                protocol.sendControl(VSBuffer.fromString(JSON.stringify(startParams.port ? { debugPort: startParams.port } : {})));
                const dataChunk = protocol.readEntireBuffer();
                protocol.dispose();
                this._extHostConnections[reconnectionToken].acceptReconnection(remoteAddress, socket, dataChunk);
            }
            else {
                // This is a fresh connection
                if (this._extHostConnections[reconnectionToken]) {
                    // Cannot have two concurrent connections using the same reconnection token
                    return this._rejectWebSocketConnection(logPrefix, protocol, `Duplicate reconnection token`);
                }
                protocol.sendPause();
                protocol.sendControl(VSBuffer.fromString(JSON.stringify(startParams.port ? { debugPort: startParams.port } : {})));
                const dataChunk = protocol.readEntireBuffer();
                protocol.dispose();
                const con = this._instantiationService.createInstance(ExtensionHostConnection, reconnectionToken, remoteAddress, socket, dataChunk);
                this._extHostConnections[reconnectionToken] = con;
                this._allReconnectionTokens.add(reconnectionToken);
                con.onClose(() => {
                    con.dispose();
                    delete this._extHostConnections[reconnectionToken];
                    this._onDidCloseExtHostConnection();
                });
                con.start(startParams);
            }
        }
        else if (msg.desiredConnectionType === 3 /* ConnectionType.Tunnel */) {
            const tunnelStartParams = msg.args;
            this._createTunnel(protocol, tunnelStartParams);
        }
        else {
            return this._rejectWebSocketConnection(logPrefix, protocol, `Unknown initial data received`);
        }
    }
    async _createTunnel(protocol, tunnelStartParams) {
        const remoteSocket = protocol.getSocket().socket;
        const dataChunk = protocol.readEntireBuffer();
        protocol.dispose();
        remoteSocket.pause();
        const localSocket = await this._connectTunnelSocket(tunnelStartParams.host, tunnelStartParams.port);
        if (dataChunk.byteLength > 0) {
            localSocket.write(dataChunk.buffer);
        }
        localSocket.on('end', () => remoteSocket.end());
        localSocket.on('close', () => remoteSocket.end());
        localSocket.on('error', () => remoteSocket.destroy());
        remoteSocket.on('end', () => localSocket.end());
        remoteSocket.on('close', () => localSocket.end());
        remoteSocket.on('error', () => localSocket.destroy());
        localSocket.pipe(remoteSocket);
        remoteSocket.pipe(localSocket);
    }
    _connectTunnelSocket(host, port) {
        return new Promise((c, e) => {
            const socket = net.createConnection({
                host: host,
                port: port,
                autoSelectFamily: true
            }, () => {
                socket.removeListener('error', e);
                socket.pause();
                c(socket);
            });
            socket.once('error', e);
        });
    }
    _updateWithFreeDebugPort(startParams) {
        if (typeof startParams.port === 'number') {
            return findFreePort(startParams.port, 10 /* try 10 ports */, 5000 /* try up to 5 seconds */).then(freePort => {
                startParams.port = freePort;
                return startParams;
            });
        }
        // No port clear debug configuration.
        startParams.debugId = undefined;
        startParams.port = undefined;
        startParams.break = undefined;
        return Promise.resolve(startParams);
    }
    async _onDidCloseExtHostConnection() {
        if (!this._environmentService.args['enable-remote-auto-shutdown']) {
            return;
        }
        this._cancelShutdown();
        const hasActiveExtHosts = !!Object.keys(this._extHostConnections).length;
        if (!hasActiveExtHosts) {
            console.log('Last EH closed, waiting before shutting down');
            this._logService.info('Last EH closed, waiting before shutting down');
            this._waitThenShutdown();
        }
    }
    _waitThenShutdown(initial = false) {
        if (!this._environmentService.args['enable-remote-auto-shutdown']) {
            return;
        }
        if (this._environmentService.args['remote-auto-shutdown-without-delay'] && !initial) {
            this._shutdown();
        }
        else {
            this.shutdownTimer = setTimeout(() => {
                this.shutdownTimer = undefined;
                this._shutdown();
            }, SHUTDOWN_TIMEOUT);
        }
    }
    _shutdown() {
        const hasActiveExtHosts = !!Object.keys(this._extHostConnections).length;
        if (hasActiveExtHosts) {
            console.log('New EH opened, aborting shutdown');
            this._logService.info('New EH opened, aborting shutdown');
            return;
        }
        else {
            console.log('Last EH closed, shutting down');
            this._logService.info('Last EH closed, shutting down');
            this.dispose();
            process.exit(0);
        }
    }
    /**
     * If the server is in a shutdown timeout, cancel it and start over
     */
    _delayShutdown() {
        if (this.shutdownTimer) {
            console.log('Got delay-shutdown request while in shutdown timeout, delaying');
            this._logService.info('Got delay-shutdown request while in shutdown timeout, delaying');
            this._cancelShutdown();
            this._waitThenShutdown();
        }
    }
    _cancelShutdown() {
        if (this.shutdownTimer) {
            console.log('Cancelling previous shutdown timeout');
            this._logService.info('Cancelling previous shutdown timeout');
            clearTimeout(this.shutdownTimer);
            this.shutdownTimer = undefined;
        }
    }
};
RemoteExtensionHostAgentServer = __decorate([
    __param(5, IServerEnvironmentService),
    __param(6, IProductService),
    __param(7, ILogService),
    __param(8, IInstantiationService)
], RemoteExtensionHostAgentServer);
export async function createServer(address, args, REMOTE_DATA_FOLDER) {
    const connectionToken = await determineServerConnectionToken(args);
    if (connectionToken instanceof ServerConnectionTokenParseError) {
        console.warn(connectionToken.message);
        process.exit(1);
    }
    // setting up error handlers, first with console.error, then, once available, using the log service
    function initUnexpectedErrorHandler(handler) {
        setUnexpectedErrorHandler(err => {
            // See https://github.com/microsoft/vscode-remote-release/issues/6481
            // In some circumstances, console.error will throw an asynchronous error. This asynchronous error
            // will end up here, and then it will be logged again, thus creating an endless asynchronous loop.
            // Here we try to break the loop by ignoring EPIPE errors that include our own unexpected error handler in the stack.
            if (isSigPipeError(err) && err.stack && /unexpectedErrorHandler/.test(err.stack)) {
                return;
            }
            handler(err);
        });
    }
    const unloggedErrors = [];
    initUnexpectedErrorHandler((error) => {
        unloggedErrors.push(error);
        console.error(error);
    });
    let didLogAboutSIGPIPE = false;
    process.on('SIGPIPE', () => {
        // See https://github.com/microsoft/vscode-remote-release/issues/6543
        // We would normally install a SIGPIPE listener in bootstrap-node.js
        // But in certain situations, the console itself can be in a broken pipe state
        // so logging SIGPIPE to the console will cause an infinite async loop
        if (!didLogAboutSIGPIPE) {
            didLogAboutSIGPIPE = true;
            onUnexpectedError(new Error(`Unexpected SIGPIPE`));
        }
    });
    const disposables = new DisposableStore();
    const { socketServer, instantiationService } = await setupServerServices(connectionToken, args, REMOTE_DATA_FOLDER, disposables);
    // Set the unexpected error handler after the services have been initialized, to avoid having
    // the telemetry service overwrite our handler
    instantiationService.invokeFunction((accessor) => {
        const logService = accessor.get(ILogService);
        unloggedErrors.forEach(error => logService.error(error));
        unloggedErrors.length = 0;
        initUnexpectedErrorHandler((error) => logService.error(error));
    });
    // On Windows, configure the UNC allow list based on settings
    instantiationService.invokeFunction((accessor) => {
        const configurationService = accessor.get(IConfigurationService);
        if (platform.isWindows) {
            if (configurationService.getValue('security.restrictUNCAccess') === false) {
                disableUNCAccessRestrictions();
            }
            else {
                addUNCHostToAllowlist(configurationService.getValue('security.allowedUNCHosts'));
            }
        }
    });
    //
    // On Windows, exit early with warning message to users about potential security issue
    // if there is node_modules folder under home drive or Users folder.
    //
    instantiationService.invokeFunction((accessor) => {
        const logService = accessor.get(ILogService);
        if (platform.isWindows && process.env.HOMEDRIVE && process.env.HOMEPATH) {
            const homeDirModulesPath = join(process.env.HOMEDRIVE, 'node_modules');
            const userDir = dirname(join(process.env.HOMEDRIVE, process.env.HOMEPATH));
            const userDirModulesPath = join(userDir, 'node_modules');
            if (fs.existsSync(homeDirModulesPath) || fs.existsSync(userDirModulesPath)) {
                const message = `

*
* !!!! Server terminated due to presence of CVE-2020-1416 !!!!
*
* Please remove the following directories and re-try
* ${homeDirModulesPath}
* ${userDirModulesPath}
*
* For more information on the vulnerability https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2020-1416
*

`;
                logService.warn(message);
                console.warn(message);
                process.exit(0);
            }
        }
    });
    const vsdaMod = instantiationService.invokeFunction((accessor) => {
        const logService = accessor.get(ILogService);
        const hasVSDA = fs.existsSync(join(FileAccess.asFileUri('').fsPath, '../node_modules/vsda'));
        if (hasVSDA) {
            try {
                return require('vsda');
            }
            catch (err) {
                logService.error(err);
            }
        }
        return null;
    });
    let serverBasePath = args['server-base-path'];
    if (serverBasePath && !serverBasePath.startsWith('/')) {
        serverBasePath = `/${serverBasePath}`;
    }
    const hasWebClient = fs.existsSync(FileAccess.asFileUri(`vs/code/browser/workbench/workbench.html`).fsPath);
    if (hasWebClient && address && typeof address !== 'string') {
        // ships the web ui!
        const queryPart = (connectionToken.type !== 0 /* ServerConnectionTokenType.None */ ? `?${connectionTokenQueryName}=${connectionToken.value}` : '');
        console.log(`Web UI available at http://localhost${address.port === 80 ? '' : `:${address.port}`}${serverBasePath ?? ''}${queryPart}`);
    }
    const remoteExtensionHostAgentServer = instantiationService.createInstance(RemoteExtensionHostAgentServer, socketServer, connectionToken, vsdaMod, hasWebClient, serverBasePath);
    perf.mark('code/server/ready');
    const currentTime = performance.now();
    // eslint-disable-next-line local/code-no-any-casts
    const vscodeServerStartTime = global.vscodeServerStartTime;
    // eslint-disable-next-line local/code-no-any-casts
    const vscodeServerListenTime = global.vscodeServerListenTime;
    // eslint-disable-next-line local/code-no-any-casts
    const vscodeServerCodeLoadedTime = global.vscodeServerCodeLoadedTime;
    instantiationService.invokeFunction(async (accessor) => {
        const telemetryService = accessor.get(ITelemetryService);
        telemetryService.publicLog2('serverStart', {
            startTime: vscodeServerStartTime,
            startedTime: vscodeServerListenTime,
            codeLoadedTime: vscodeServerCodeLoadedTime,
            readyTime: currentTime
        });
        if (platform.isLinux) {
            const logService = accessor.get(ILogService);
            const releaseInfo = await getOSReleaseInfo(logService.error.bind(logService));
            if (releaseInfo) {
                telemetryService.publicLog2('serverPlatformInfo', {
                    platformId: releaseInfo.id,
                    platformVersionId: releaseInfo.version_id,
                    platformIdLike: releaseInfo.id_like
                });
            }
        }
    });
    if (args['print-startup-performance']) {
        let output = '';
        output += `Start-up time: ${vscodeServerListenTime - vscodeServerStartTime}\n`;
        output += `Code loading time: ${vscodeServerCodeLoadedTime - vscodeServerStartTime}\n`;
        output += `Initialized time: ${currentTime - vscodeServerStartTime}\n`;
        output += `\n`;
        console.log(output);
    }
    return remoteExtensionHostAgentServer;
}
class WebEndpointOriginChecker {
    static create(productService) {
        const webEndpointUrlTemplate = productService.webEndpointUrlTemplate;
        const commit = productService.commit;
        const quality = productService.quality;
        if (!webEndpointUrlTemplate || !commit || !quality) {
            return new WebEndpointOriginChecker(null);
        }
        const uuid = generateUuid();
        const exampleUrl = new URL(webEndpointUrlTemplate
            .replace('{{uuid}}', uuid)
            .replace('{{commit}}', commit)
            .replace('{{quality}}', quality));
        const exampleOrigin = exampleUrl.origin;
        const originRegExpSource = (escapeRegExpCharacters(exampleOrigin)
            .replace(uuid, '[a-zA-Z0-9\\-]+'));
        try {
            const originRegExp = createRegExp(`^${originRegExpSource}$`, true, { matchCase: false });
            return new WebEndpointOriginChecker(originRegExp);
        }
        catch (err) {
            return new WebEndpointOriginChecker(null);
        }
    }
    constructor(_originRegExp) {
        this._originRegExp = _originRegExp;
    }
    matches(origin) {
        if (!this._originRegExp) {
            return false;
        }
        return this._originRegExp.test(origin);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVtb3RlRXh0ZW5zaW9uSG9zdEFnZW50U2VydmVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3NlcnZlci9ub2RlL3JlbW90ZUV4dGVuc2lvbkhvc3RBZ2VudFNlcnZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssRUFBRSxNQUFNLElBQUksQ0FBQztBQUV6QixPQUFPLEtBQUssR0FBRyxNQUFNLEtBQUssQ0FBQztBQUMzQixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBQzVDLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDekMsT0FBTyxLQUFLLEdBQUcsTUFBTSxLQUFLLENBQUM7QUFDM0IsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBRXZELE9BQU8sRUFBRSxjQUFjLEVBQUUsaUJBQWlCLEVBQUUseUJBQXlCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUMzRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUM3RSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsVUFBVSxFQUFFLHVCQUF1QixFQUFFLE9BQU8sRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3RILE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDMUQsT0FBTyxLQUFLLElBQUksTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEtBQUssUUFBUSxNQUFNLCtCQUErQixDQUFDO0FBQzFELE9BQU8sRUFBRSxZQUFZLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUNwRixPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0s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