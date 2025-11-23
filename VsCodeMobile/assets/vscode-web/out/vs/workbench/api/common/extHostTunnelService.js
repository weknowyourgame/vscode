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
import { CancellationToken } from '../../../base/common/cancellation.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable, toDisposable } from '../../../base/common/lifecycle.js';
import * as nls from '../../../nls.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { DisposableTunnel, TunnelPrivacyId } from '../../../platform/tunnel/common/tunnel.js';
import { MainContext } from './extHost.protocol.js';
import { IExtHostInitDataService } from './extHostInitDataService.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import * as types from './extHostTypes.js';
class ExtensionTunnel extends DisposableTunnel {
}
export var TunnelDtoConverter;
(function (TunnelDtoConverter) {
    function fromApiTunnel(tunnel) {
        return {
            remoteAddress: tunnel.remoteAddress,
            localAddress: tunnel.localAddress,
            public: !!tunnel.public,
            privacy: tunnel.privacy ?? (tunnel.public ? TunnelPrivacyId.Public : TunnelPrivacyId.Private),
            protocol: tunnel.protocol
        };
    }
    TunnelDtoConverter.fromApiTunnel = fromApiTunnel;
    function fromServiceTunnel(tunnel) {
        return {
            remoteAddress: {
                host: tunnel.tunnelRemoteHost,
                port: tunnel.tunnelRemotePort
            },
            localAddress: tunnel.localAddress,
            public: tunnel.privacy !== TunnelPrivacyId.ConstantPrivate && tunnel.privacy !== TunnelPrivacyId.ConstantPrivate,
            privacy: tunnel.privacy,
            protocol: tunnel.protocol
        };
    }
    TunnelDtoConverter.fromServiceTunnel = fromServiceTunnel;
})(TunnelDtoConverter || (TunnelDtoConverter = {}));
export const IExtHostTunnelService = createDecorator('IExtHostTunnelService');
let ExtHostTunnelService = class ExtHostTunnelService extends Disposable {
    constructor(extHostRpc, initData, logService) {
        super();
        this.logService = logService;
        this._showCandidatePort = () => { return Promise.resolve(true); };
        this._extensionTunnels = new Map();
        this._onDidChangeTunnels = new Emitter();
        this.onDidChangeTunnels = this._onDidChangeTunnels.event;
        this._providerHandleCounter = 0;
        this._portAttributesProviders = new Map();
        this._proxy = extHostRpc.getProxy(MainContext.MainThreadTunnelService);
    }
    async openTunnel(extension, forward) {
        this.logService.trace(`ForwardedPorts: (ExtHostTunnelService) ${extension.identifier.value} called openTunnel API for ${forward.remoteAddress.host}:${forward.remoteAddress.port}.`);
        const tunnel = await this._proxy.$openTunnel(forward, extension.displayName);
        if (tunnel) {
            const disposableTunnel = new ExtensionTunnel(tunnel.remoteAddress, tunnel.localAddress, () => {
                return this._proxy.$closeTunnel(tunnel.remoteAddress);
            });
            this._register(disposableTunnel);
            return disposableTunnel;
        }
        return undefined;
    }
    async getTunnels() {
        return this._proxy.$getTunnels();
    }
    nextPortAttributesProviderHandle() {
        return this._providerHandleCounter++;
    }
    registerPortsAttributesProvider(portSelector, provider) {
        if (portSelector.portRange === undefined && portSelector.commandPattern === undefined) {
            this.logService.error('PortAttributesProvider must specify either a portRange or a commandPattern');
        }
        const providerHandle = this.nextPortAttributesProviderHandle();
        this._portAttributesProviders.set(providerHandle, { selector: portSelector, provider });
        this._proxy.$registerPortsAttributesProvider(portSelector, providerHandle);
        return new types.Disposable(() => {
            this._portAttributesProviders.delete(providerHandle);
            this._proxy.$unregisterPortsAttributesProvider(providerHandle);
        });
    }
    async $providePortAttributes(handles, ports, pid, commandLine, cancellationToken) {
        const providedAttributes = [];
        for (const handle of handles) {
            const provider = this._portAttributesProviders.get(handle);
            if (!provider) {
                return [];
            }
            providedAttributes.push(...(await Promise.all(ports.map(async (port) => {
                let providedAttributes;
                try {
                    providedAttributes = await provider.provider.providePortAttributes({ port, pid, commandLine }, cancellationToken);
                }
                catch (e) {
                    // Call with old signature for breaking API change
                    providedAttributes = await provider.provider.providePortAttributes(port, pid, commandLine, cancellationToken);
                }
                return { providedAttributes, port };
            }))));
        }
        const allAttributes = providedAttributes.filter(attribute => !!attribute.providedAttributes);
        return (allAttributes.length > 0) ? allAttributes.map(attributes => {
            return {
                autoForwardAction: attributes.providedAttributes.autoForwardAction,
                port: attributes.port
            };
        }) : [];
    }
    async $registerCandidateFinder(_enable) { }
    registerTunnelProvider(provider, information) {
        if (this._forwardPortProvider) {
            throw new Error('A tunnel provider has already been registered. Only the first tunnel provider to be registered will be used.');
        }
        this._forwardPortProvider = async (tunnelOptions, tunnelCreationOptions) => {
            const result = await provider.provideTunnel(tunnelOptions, tunnelCreationOptions, CancellationToken.None);
            return result ?? undefined;
        };
        const tunnelFeatures = information.tunnelFeatures ? {
            elevation: !!information.tunnelFeatures?.elevation,
            privacyOptions: information.tunnelFeatures?.privacyOptions,
            protocol: information.tunnelFeatures.protocol === undefined ? true : information.tunnelFeatures.protocol,
        } : undefined;
        this._proxy.$setTunnelProvider(tunnelFeatures, true);
        return Promise.resolve(toDisposable(() => {
            this._forwardPortProvider = undefined;
            this._proxy.$setTunnelProvider(undefined, false);
        }));
    }
    hasTunnelProvider() {
        return this._proxy.$hasTunnelProvider();
    }
    /**
     * Applies the tunnel metadata and factory found in the remote authority
     * resolver to the tunnel system.
     *
     * `managedRemoteAuthority` should be be passed if the resolver returned on.
     * If this is the case, the tunnel cannot be connected to via a websocket from
     * the share process, so a synethic tunnel factory is used as a default.
     */
    async setTunnelFactory(provider, managedRemoteAuthority) {
        // Do not wait for any of the proxy promises here.
        // It will delay startup and there is nothing that needs to be waited for.
        if (provider) {
            if (provider.candidatePortSource !== undefined) {
                this._proxy.$setCandidatePortSource(provider.candidatePortSource);
            }
            if (provider.showCandidatePort) {
                this._showCandidatePort = provider.showCandidatePort;
                this._proxy.$setCandidateFilter();
            }
            const tunnelFactory = provider.tunnelFactory ?? (managedRemoteAuthority ? this.makeManagedTunnelFactory(managedRemoteAuthority) : undefined);
            if (tunnelFactory) {
                this._forwardPortProvider = tunnelFactory;
                let privacyOptions = provider.tunnelFeatures?.privacyOptions ?? [];
                if (provider.tunnelFeatures?.public && (privacyOptions.length === 0)) {
                    privacyOptions = [
                        {
                            id: 'private',
                            label: nls.localize('tunnelPrivacy.private', "Private"),
                            themeIcon: 'lock'
                        },
                        {
                            id: 'public',
                            label: nls.localize('tunnelPrivacy.public', "Public"),
                            themeIcon: 'eye'
                        }
                    ];
                }
                const tunnelFeatures = provider.tunnelFeatures ? {
                    elevation: !!provider.tunnelFeatures?.elevation,
                    public: !!provider.tunnelFeatures?.public,
                    privacyOptions,
                    protocol: true
                } : undefined;
                this._proxy.$setTunnelProvider(tunnelFeatures, !!provider.tunnelFactory);
            }
        }
        else {
            this._forwardPortProvider = undefined;
        }
        return toDisposable(() => {
            this._forwardPortProvider = undefined;
        });
    }
    makeManagedTunnelFactory(_authority) {
        return undefined; // may be overridden
    }
    async $closeTunnel(remote, silent) {
        if (this._extensionTunnels.has(remote.host)) {
            const hostMap = this._extensionTunnels.get(remote.host);
            if (hostMap.has(remote.port)) {
                if (silent) {
                    hostMap.get(remote.port).disposeListener.dispose();
                }
                await hostMap.get(remote.port).tunnel.dispose();
                hostMap.delete(remote.port);
            }
        }
    }
    async $onDidTunnelsChange() {
        this._onDidChangeTunnels.fire();
    }
    async $forwardPort(tunnelOptions, tunnelCreationOptions) {
        if (this._forwardPortProvider) {
            try {
                this.logService.trace('ForwardedPorts: (ExtHostTunnelService) Getting tunnel from provider.');
                const providedPort = this._forwardPortProvider(tunnelOptions, tunnelCreationOptions);
                this.logService.trace('ForwardedPorts: (ExtHostTunnelService) Got tunnel promise from provider.');
                if (providedPort !== undefined) {
                    const tunnel = await providedPort;
                    this.logService.trace('ForwardedPorts: (ExtHostTunnelService) Successfully awaited tunnel from provider.');
                    if (tunnel === undefined) {
                        this.logService.error('ForwardedPorts: (ExtHostTunnelService) Resolved tunnel is undefined');
                        return undefined;
                    }
                    if (!this._extensionTunnels.has(tunnelOptions.remoteAddress.host)) {
                        this._extensionTunnels.set(tunnelOptions.remoteAddress.host, new Map());
                    }
                    const disposeListener = this._register(tunnel.onDidDispose(() => {
                        this.logService.trace('ForwardedPorts: (ExtHostTunnelService) Extension fired tunnel\'s onDidDispose.');
                        return this._proxy.$closeTunnel(tunnel.remoteAddress);
                    }));
                    this._extensionTunnels.get(tunnelOptions.remoteAddress.host).set(tunnelOptions.remoteAddress.port, { tunnel, disposeListener });
                    return TunnelDtoConverter.fromApiTunnel(tunnel);
                }
                else {
                    this.logService.trace('ForwardedPorts: (ExtHostTunnelService) Tunnel is undefined');
                }
            }
            catch (e) {
                this.logService.trace('ForwardedPorts: (ExtHostTunnelService) tunnel provider error');
                if (e instanceof Error) {
                    return e.message;
                }
            }
        }
        return undefined;
    }
    async $applyCandidateFilter(candidates) {
        const filter = await Promise.all(candidates.map(candidate => this._showCandidatePort(candidate.host, candidate.port, candidate.detail ?? '')));
        const result = candidates.filter((candidate, index) => filter[index]);
        this.logService.trace(`ForwardedPorts: (ExtHostTunnelService) filtered from ${candidates.map(port => port.port).join(', ')} to ${result.map(port => port.port).join(', ')}`);
        return result;
    }
};
ExtHostTunnelService = __decorate([
    __param(0, IExtHostRpcService),
    __param(1, IExtHostInitDataService),
    __param(2, ILogService)
], ExtHostTunnelService);
export { ExtHostTunnelService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdFR1bm5lbFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9jb21tb24vZXh0SG9zdFR1bm5lbFNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDekUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxVQUFVLEVBQWUsWUFBWSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDMUYsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQkFBaUIsQ0FBQztBQUV2QyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDMUYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBcUcsZUFBZSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDak0sT0FBTyxFQUE2QixXQUFXLEVBQW1FLE1BQU0sdUJBQXVCLENBQUM7QUFDaEosT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDdEUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDNUQsT0FBTyxLQUFLLEtBQUssTUFBTSxtQkFBbUIsQ0FBQztBQUkzQyxNQUFNLGVBQWdCLFNBQVEsZ0JBQWdCO0NBQTZCO0FBRTNFLE1BQU0sS0FBVyxrQkFBa0IsQ0FzQmxDO0FBdEJELFdBQWlCLGtCQUFrQjtJQUNsQyxTQUFnQixhQUFhLENBQUMsTUFBcUI7UUFDbEQsT0FBTztZQUNOLGFBQWEsRUFBRSxNQUFNLENBQUMsYUFBYTtZQUNuQyxZQUFZLEVBQUUsTUFBTSxDQUFDLFlBQVk7WUFDakMsTUFBTSxFQUFFLENBQUMs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