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
import { Disposable } from '../../../../base/common/lifecycle.js';
import { getDelayedChannel, IPCLogger } from '../../../../base/parts/ipc/common/ipc.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { connectRemoteAgentManagement } from '../../../../platform/remote/common/remoteAgentConnection.js';
import { IRemoteAuthorityResolverService } from '../../../../platform/remote/common/remoteAuthorityResolver.js';
import { RemoteExtensionEnvironmentChannelClient } from './remoteAgentEnvironmentChannel.js';
import { Emitter } from '../../../../base/common/event.js';
import { ISignService } from '../../../../platform/sign/common/sign.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IUserDataProfileService } from '../../userDataProfile/common/userDataProfile.js';
import { IRemoteSocketFactoryService } from '../../../../platform/remote/common/remoteSocketFactoryService.js';
let AbstractRemoteAgentService = class AbstractRemoteAgentService extends Disposable {
    constructor(remoteSocketFactoryService, userDataProfileService, _environmentService, productService, _remoteAuthorityResolverService, signService, _logService) {
        super();
        this.remoteSocketFactoryService = remoteSocketFactoryService;
        this.userDataProfileService = userDataProfileService;
        this._environmentService = _environmentService;
        this._remoteAuthorityResolverService = _remoteAuthorityResolverService;
        this._logService = _logService;
        if (this._environmentService.remoteAuthority) {
            this._connection = this._register(new RemoteAgentConnection(this._environmentService.remoteAuthority, productService.commit, productService.quality, this.remoteSocketFactoryService, this._remoteAuthorityResolverService, signService, this._logService));
        }
        else {
            this._connection = null;
        }
        this._environment = null;
    }
    getConnection() {
        return this._connection;
    }
    getEnvironment() {
        return this.getRawEnvironment().then(undefined, () => null);
    }
    getRawEnvironment() {
        if (!this._environment) {
            this._environment = this._withChannel(async (channel, connection) => {
                const env = await RemoteExtensionEnvironmentChannelClient.getEnvironmentData(channel, connection.remoteAuthority, this.userDataProfileService.currentProfile.isDefault ? undefined : this.userDataProfileService.currentProfile.id);
                this._remoteAuthorityResolverService._setAuthorityConnectionToken(connection.remoteAuthority, env.connectionToken);
                if (typeof env.reconnectionGraceTime === 'number') {
                    this._logService.info(`[reconnection-grace-time] Client received grace time from server: ${env.reconnectionGraceTime}ms (${Math.floor(env.reconnectionGraceTime / 1000)}s)`);
                    connection.updateGraceTime(env.reconnectionGraceTime);
                }
                else {
                    this._logService.info(`[reconnection-grace-time] Server did not provide grace time, using default`);
                }
                return env;
            }, null);
        }
        return this._environment;
    }
    getExtensionHostExitInfo(reconnectionToken) {
        return this._withChannel((channel, connection) => RemoteExtensionEnvironmentChannelClient.getExtensionHostExitInfo(channel, connection.remoteAuthority, reconnectionToken), null);
    }
    getDiagnosticInfo(options) {
        return this._withChannel(channel => RemoteExtensionEnvironmentChannelClient.getDiagnosticInfo(channel, options), undefined);
    }
    updateTelemetryLevel(telemetryLevel) {
        return this._withTelemetryChannel(channel => RemoteExtensionEnvironmentChannelClient.updateTelemetryLevel(channel, telemetryLevel), undefined);
    }
    logTelemetry(eventName, data) {
        return this._withTelemetryChannel(channel => RemoteExtensionEnvironmentChannelClient.logTelemetry(channel, eventName, data), undefined);
    }
    flushTelemetry() {
        return this._withTelemetryChannel(channel => RemoteExtensionEnvironmentChannelClient.flushTelemetry(channel), undefined);
    }
    getRoundTripTime() {
        return this._withTelemetryChannel(async (channel) => {
            const start = Date.now();
            await RemoteExtensionEnvironmentChannelClient.ping(channel);
            return Date.now() - start;
        }, undefined);
    }
    async endConnection() {
        if (this._connection) {
            await this._connection.end();
            this._connection.dispose();
        }
    }
    _withChannel(callback, fallback) {
        const connection = this.getConnection();
        if (!connection) {
            return Promise.resolve(fallback);
        }
        return connection.withChannel('remoteextensionsenvironment', (channel) => callback(channel, connection));
    }
    _withTelemetryChannel(callback, fallback) {
        const connection = this.getConnection();
        if (!connection) {
            return Promise.resolve(fallback);
        }
        return connection.withChannel('telemetry', (channel) => callback(channel, connection));
    }
};
AbstractRemoteAgentService = __decorate([
    __param(0, IRemoteSocketFactoryService),
    __param(1, IUserDataProfileService),
    __param(2, IWorkbenchEnvironmentService),
    __param(3, IProductService),
    __param(4, IRemoteAuthorityResolverService),
    __param(5, ISignService),
    __param(6, ILogService)
], AbstractRemoteAgentService);
export { AbstractRemoteAgentService };
class RemoteAgentConnection extends Disposable {
    constructor(remoteAuthority, _commit, _quality, _remoteSocketFactoryService, _remoteAuthorityResolverService, _signService, _logService) {
        super();
        this._commit = _commit;
        this._quality = _quality;
        this._remoteSocketFactoryService = _remoteSocketFactoryService;
        this._remoteAuthorityResolverService = _remoteAuthorityResolverService;
        this._signService = _signService;
        this._logService = _logService;
        this._onReconnecting = this._register(new Emitter());
        this.onReconnecting = this._onReconnecting.event;
        this._onDidStateChange = this._register(new Emitter());
        this.onDidStateChange = this._onDidStateChange.event;
        this._managementConnection = null;
        this.end = () => Promise.resolve();
        this.remoteAuthority = remoteAuthority;
        this._connection = null;
    }
    getChannel(channelName) {
        return getDelayedChannel(this._getOrCreateConnection().then(c => c.getChannel(channelName)));
    }
    withChannel(channelName, callback) {
        const channel = this.getChannel(channelName);
        const result = callback(channel);
        return result;
    }
    registerChannel(channelName, channel) {
        this._getOrCreateConnection().then(client => client.registerChannel(channelName, channel));
    }
    async getInitialConnectionTimeMs() {
        try {
            await this._getOrCreateConnection();
        }
        catch {
            // ignored -- time is measured even if connection fails
        }
        return this._initialConnectionMs;
    }
    getManagementConnection() {
        return this._managementConnection;
    }
    updateGraceTime(graceTime) {
        if (this._managementConnection) {
            this._managementConnection.updateGraceTime(graceTime);
        }
    }
    _getOrCreateConnection() {
        if (!this._connection) {
            this._connection = this._createConnection();
        }
        return this._connection;
    }
    async _createConnection() {
        let firstCall = true;
        const options = {
            commit: this._commit,
            quality: this._quality,
            addressProvider: {
                getAddress: async () => {
                    if (firstCall) {
                        firstCall = false;
                    }
                    else {
                        this._onReconnecting.fire(undefined);
                    }
                    const { authority } = await this._remoteAuthorityResolverService.resolveAuthority(this.remoteAuthority);
                    return { connectTo: authority.connectTo, connectionToken: authority.connectionToken };
                }
            },
            remoteSocketFactoryService: this._remoteSocketFactoryService,
            signService: this._signService,
            logService: this._logService,
            ipcLogger: false ? new IPCLogger(`Local \u2192 Remote`, `Remote \u2192 Local`) : null
        };
        let connection;
        const start = Date.now();
        try {
            connection = this._register(await connectRemoteAgentManagement(options, this.remoteAuthority, `renderer`));
            this._managementConnection = connection;
        }
        finally {
            this._initialConnectionMs = Date.now() - start;
        }
        connection.protocol.onDidDispose(() => {
            connection.dispose();
        });
        this.end = () => {
            connection.protocol.sendDisconnect();
            return connection.protocol.drain();
        };
        this._register(connection.onDidStateChange(e => this._onDidStateChange.fire(e)));
        return connection.client;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJzdHJhY3RSZW1vdGVBZ2VudFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vYWJzdHJhY3RSZW1vdGVBZ2VudFNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBNEIsaUJBQWlCLEVBQUUsU0FBUyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFbEgsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDOUYsT0FBTyxFQUFFLDRCQUE0QixFQUFpRixNQUFNLDZEQUE2RCxDQUFDO0FBRTFMLE9BQU8sRUFBRSwrQkFBK0IsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBRWhILE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBRTdGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRXJFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN4RixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUV4RyxJQUFlLDBCQUEwQixHQUF6QyxNQUFlLDBCQUEyQixTQUFRLFVBQVU7SUFPbEUsWUFDK0MsMEJBQXVELEVBQzNELHNCQUErQyxFQUN4QyxtQkFBaUQsRUFDakYsY0FBK0IsRUFDRSwrQkFBZ0UsRUFDcEcsV0FBeUIsRUFDVCxX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