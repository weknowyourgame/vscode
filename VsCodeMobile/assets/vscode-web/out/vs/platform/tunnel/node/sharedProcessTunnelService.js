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
var SharedProcessTunnelService_1;
import { ILogService } from '../../log/common/log.js';
import { ISharedTunnelsService } from '../common/tunnel.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { canceled } from '../../../base/common/errors.js';
import { DeferredPromise } from '../../../base/common/async.js';
class TunnelData extends Disposable {
    constructor() {
        super();
        this._address = null;
        this._addressPromise = null;
    }
    async getAddress() {
        if (this._address) {
            // address is resolved
            return this._address;
        }
        if (!this._addressPromise) {
            this._addressPromise = new DeferredPromise();
        }
        return this._addressPromise.p;
    }
    setAddress(address) {
        this._address = address;
        if (this._addressPromise) {
            this._addressPromise.complete(address);
            this._addressPromise = null;
        }
    }
    setTunnel(tunnel) {
        this._register(tunnel);
    }
}
let SharedProcessTunnelService = class SharedProcessTunnelService extends Disposable {
    static { SharedProcessTunnelService_1 = this; }
    static { this._lastId = 0; }
    constructor(_tunnelService, _logService) {
        super();
        this._tunnelService = _tunnelService;
        this._logService = _logService;
        this._tunnels = new Map();
        this._disposedTunnels = new Set();
    }
    dispose() {
        super.dispose();
        this._tunnels.forEach((tunnel) => tunnel.dispose());
    }
    async createTunnel() {
        const id = String(++SharedProcessTunnelService_1._lastId);
        return { id };
    }
    async startTunnel(authority, id, tunnelRemoteHost, tunnelRemotePort, tunnelLocalHost, tunnelLocalPort, elevateIfNeeded) {
        const tunnelData = new TunnelData();
        const tunnel = await Promise.resolve(this._tunnelService.openTunnel(authority, tunnelData, tunnelRemoteHost, tunnelRemotePort, tunnelLocalHost, tunnelLocalPort, elevateIfNeeded));
        if (!tunnel || (typeof tunnel === 'string')) {
            this._logService.info(`[SharedProcessTunnelService] Could not create a tunnel to ${tunnelRemoteHost}:${tunnelRemotePort} (remote).`);
            tunnelData.dispose();
            throw new Error(`Could not create tunnel`);
        }
        if (this._disposedTunnels.delete(id)) {
            // This tunnel was disposed in the meantime
            tunnelData.dispose();
            await tunnel.dispose();
            throw canceled();
        }
        tunnelData.setTunnel(tunnel);
        this._tunnels.set(id, tunnelData);
        this._logService.info(`[SharedProcessTunnelService] Created tunnel ${id}: ${tunnel.localAddress} (local) to ${tunnelRemoteHost}:${tunnelRemotePort} (remote).`);
        const result = {
            tunnelLocalPort: tunnel.tunnelLocalPort,
            localAddress: tunnel.localAddress
        };
        return result;
    }
    async setAddress(id, address) {
        const tunnel = this._tunnels.get(id);
        if (!tunnel) {
            return;
        }
        tunnel.setAddress(address);
    }
    async destroyTunnel(id) {
        const tunnel = this._tunnels.get(id);
        if (tunnel) {
            this._logService.info(`[SharedProcessTunnelService] Disposing tunnel ${id}.`);
            this._tunnels.delete(id);
            await tunnel.dispose();
            return;
        }
        // Looks like this tunnel is still starting, mark the id as disposed
        this._disposedTunnels.add(id);
    }
};
SharedProcessTunnelService = SharedProcessTunnelService_1 = __decorate([
    __param(0, ISharedTunnelsService),
    __param(1, ILogService)
], SharedProcessTunnelService);
export { SharedProcessTunnelService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhcmVkUHJvY2Vzc1R1bm5lbFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vdHVubmVsL25vZGUvc2hhcmVkUHJvY2Vzc1R1bm5lbFNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUV0RCxPQUFPLEVBQUUscUJBQXFCLEVBQWdCLE1BQU0scUJBQXFCLENBQUM7QUFFMUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFaEUsTUFBTSxVQUFXLFNBQVEsVUFBVTtJQUtsQztRQUNDLEtBQUssRUFBRSxDQUFDO1FBQ1IsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7UUFDckIsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUM7SUFDN0IsQ0FBQztJQUVELEtBQUssQ0FBQyxVQUFVO1FBQ2YsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDbkIsc0JBQXNCO1lBQ3RCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUN0QixDQUFDO1FBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUMzQixJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksZUFBZSxFQUFZLENBQUM7UUFDeEQsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVELFVBQVUsQ0FBQyxPQUFpQjtRQUMzQixJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQztRQUN4QixJQUFJLElBQUksQ0FB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