/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../base/common/event.js';
import { ProcessTimeRunOnceScheduler } from '../../base/common/async.js';
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
export class ManagementConnection {
    constructor(_logService, _reconnectionToken, remoteAddress, protocol, reconnectionGraceTime) {
        this._logService = _logService;
        this._reconnectionToken = _reconnectionToken;
        this._onClose = new Emitter();
        this.onClose = this._onClose.event;
        this._reconnectionGraceTime = reconnectionGraceTime;
        const defaultShortGrace = 300000 /* ProtocolConstants.ReconnectionShortGraceTime */;
        this._reconnectionShortGraceTime = reconnectionGraceTime > 0 ? Math.min(defaultShortGrace, reconnectionGraceTime) : 0;
        this._remoteAddress = remoteAddress;
        this.protocol = protocol;
        this._disposed = false;
        this._disconnectRunner1 = new ProcessTimeRunOnceScheduler(() => {
            this._log(`The reconnection grace time of ${printTime(this._reconnectionGraceTime)} has expired, so the connection will be disposed.`);
            this._cleanResources();
        }, this._reconnectionGraceTime);
        this._disconnectRunner2 = new ProcessTimeRunOnceScheduler(() => {
            this._log(`The reconnection short grace time of ${printTime(this._reconnectionShortGraceTime)} has expired, so the connection will be disposed.`);
            this._cleanResources();
        }, this._reconnectionShortGraceTime);
        this.protocol.onDidDispose(() => {
            this._log(`The client has disconnected gracefully, so the connection will be disposed.`);
            this._cleanResources();
        });
        this.protocol.onSocketClose(() => {
            this._log(`The client has disconnected, will wait for reconnection ${printTime(this._reconnectionGraceTime)} before disposing...`);
            // The socket has closed, let's give the renderer a certain amount of time to reconnect
            this._disconnectRunner1.schedule();
        });
        this._log(`New connection established.`);
    }
    _log(_str) {
        this._logService.info(`[${this._remoteAddress}][${this._reconnectionToken.substr(0, 8)}][ManagementConnection] ${_str}`);
    }
    shortenReconnectionGraceTimeIfNecessary() {
        if (this._disconnectRunner2.isScheduled()) {
            // we are disconnected and already running the short reconnection timer
            return;
        }
        if (this._disconnectRunner1.isScheduled()) {
            this._log(`Another client has connected, will shorten the wait for reconnection ${printTime(this._reconnectionShortGraceTime)} before disposing...`);
            // we are disconnected and running the long reconnection timer
            this._disconnectRunner2.schedule();
        }
    }
    _cleanResources() {
        if (this._disposed) {
            // already called
            return;
        }
        this._disposed = true;
        this._disconnectRunner1.dispose();
        this._disconnectRunner2.dispose();
        const socket = this.protocol.getSocket();
        this.protocol.sendDisconnect();
        this.protocol.dispose();
        socket.end();
        this._onClose.fire(undefined);
    }
    acceptReconnection(remoteAddress, socket, initialDataChunk) {
        this._remoteAddress = remoteAddress;
        this._log(`The client has reconnected.`);
        this._disconnectRunner1.cancel();
        this._disconnectRunner2.cancel();
        this.protocol.beginAcceptReconnection(socket, initialDataChunk);
        this.protocol.endAcceptReconnection();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9zZXJ2ZXIvbm9kZS9yZW1vdGVFeHRlbnNpb25NYW5hZ2VtZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBSWhHLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSw0QkFBNEIsQ0FBQztBQUU1RCxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUV6RSxTQUFTLFNBQVMsQ0FBQyxFQUFVO0lBQzVCLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNWLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNWLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNWLElBQUksRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDO1FBQ2hCLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUMxQixFQUFFLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQztJQUNoQixDQUFDO0lBQ0QsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7UUFDYixDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDdkIsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDYixDQUFDO0lBQ0QsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7UUFDYixDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDdkIsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDYixDQUFDO0lBQ0QsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENB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