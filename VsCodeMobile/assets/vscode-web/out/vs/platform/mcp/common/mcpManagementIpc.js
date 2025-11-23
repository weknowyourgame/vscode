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
import { Emitter, Event } from '../../../base/common/event.js';
import { cloneAndChange } from '../../../base/common/objects.js';
import { URI } from '../../../base/common/uri.js';
import { DefaultURITransformer, transformAndReviveIncomingURIs } from '../../../base/common/uriIpc.js';
import { ILogService } from '../../log/common/log.js';
import { IAllowedMcpServersService } from './mcpManagement.js';
import { AbstractMcpManagementService } from './mcpManagementService.js';
function transformIncomingURI(uri, transformer) {
    return uri ? URI.revive(transformer ? transformer.transformIncoming(uri) : uri) : undefined;
}
function transformIncomingServer(mcpServer, transformer) {
    transformer = transformer ? transformer : DefaultURITransformer;
    const manifest = mcpServer.manifest;
    const transformed = transformAndReviveIncomingURIs({ ...mcpServer, ...{ manifest: undefined } }, transformer);
    return { ...transformed, ...{ manifest } };
}
function transformIncomingOptions(options, transformer) {
    return options?.mcpResource ? transformAndReviveIncomingURIs(options, transformer ?? DefaultURITransformer) : options;
}
function transformOutgoingExtension(extension, transformer) {
    return transformer ? cloneAndChange(extension, value => value instanceof URI ? transformer.transformOutgoingURI(value) : undefined) : extension;
}
function transformOutgoingURI(uri, transformer) {
    return transformer ? transformer.transformOutgoingURI(uri) : uri;
}
export class McpManagementChannel {
    constructor(service, getUriTransformer) {
        this.service = service;
        this.getUriTransformer = getUriTransformer;
        this.onInstallMcpServer = Event.buffer(service.onInstallMcpServer, true);
        this.onDidInstallMcpServers = Event.buffer(service.onDidInstallMcpServers, true);
        this.onDidUpdateMcpServers = Event.buffer(service.onDidUpdateMcpServers, true);
        this.onUninstallMcpServer = Event.buffer(service.onUninstallMcpServer, true);
        this.onDidUninstallMcpServer = Event.buffer(service.onDidUninstallMcpServer, true);
    }
    listen(context, event) {
        const uriTransformer = this.getUriTransformer(context);
        switch (event) {
            case 'onInstallMcpServer': {
                return Event.map(this.onInstallMcpServer, event => {
                    return { ...event, mcpResource: transformOutgoingURI(event.mcpResource, uriTransformer) };
                });
            }
            case 'onDidInstallMcpServers': {
                return Event.map(this.onDidInstallMcpServers, results => results.map(i => ({
                    ...i,
                    local: i.local ? transformOutgoingExtension(i.local, uriTransformer) : i.local,
                    mcpResource: transformOutgoingURI(i.mcpResource, uriTransformer)
                })));
            }
            case 'onDidUpdateMcpServers': {
                return Event.map(this.onDidUpdateMcpServers, results => results.map(i => ({
                    ...i,
                    local: i.local ? transformOutgoingExtension(i.local, uriTransformer) : i.local,
                    mcpResource: transformOutgoingURI(i.mcpResource, uriTransformer)
                })));
            }
            case 'onUninstallMcpServer': {
                return Event.map(this.onUninstallMcpServer, event => {
                    return { ...event, mcpResource: transformOutgoingURI(event.mcpResource, uriTransformer) };
                });
            }
            case 'onDidUninstallMcpServer': {
                return Event.map(this.onDidUninstallMcpServer, event => {
                    return { ...event, mcpResource: transformOutgoingURI(event.mcpResource, uriTransformer) };
                });
            }
        }
        throw new Error('Invalid listen');
    }
    async call(context, command, args) {
        const uriTransformer = this.getUriTransformer(context);
        const argsArray = Array.isArray(args) ? args : [];
        switch (command) {
            case 'getInstalled': {
                const mcpServers = await this.service.getInstalled(transformIncomingURI(argsArray[0], uriTransformer));
                return mcpServers.map(e => transformOutgoingExtension(e, uriTransformer));
            }
            case 'install': {
                return this.service.install(argsArray[0], transformIncomingOptions(argsArray[1], uriTransformer));
            }
            case 'installFromGallery': {
                return this.service.installFromGallery(argsArray[0], transformIncomingOptions(argsArray[1], uriTransformer));
            }
            case 'uninstall': {
                return this.service.uninstall(transformIncomingServer(argsArray[0], uriTransformer), transformIncomingOptions(argsArray[1], uriTransformer));
            }
            case 'updateMetadata': {
                return this.service.updateMetadata(transformIncomingServer(argsArray[0], uriTransformer), argsArray[1], transformIncomingURI(argsArray[2], uriTransformer));
            }
        }
        throw new Error('Invalid call');
    }
}
let McpManagementChannelClient = class McpManagementChannelClient extends AbstractMcpManagementService {
    get onInstallMcpServer() { return this._onInstallMcpServer.event; }
    get onDidInstallMcpServers() { return this._onDidInstallMcpServers.event; }
    get onUninstallMcpServer() { return this._onUninstallMcpServer.event; }
    get onDidUninstallMcpServer() { return this._onDidUninstallMcpServer.event; }
    get onDidUpdateMcpServers() { return this._onDidUpdateMcpServers.event; }
    constructor(channel, allowedMcpServersService, logService) {
        super(allowedMcpServersService, logService);
        this.channel = channel;
        this._onInstallMcpServer = this._register(new Emitter());
        this._onDidInstallMcpServers = this._register(new Emitter());
        this._onUninstallMcpServer = this._register(new Emitter());
        this._onDidUninstallMcpServer = this._register(new Emitter());
        this._onDidUpdateMcpServers = this._register(new Emitter());
        this._register(this.channel.listen('onInstallMcpServer')(e => this._onInstallMcpServer.fire(({ ...e, mcpResource: transformIncomingURI(e.mcpResource, null) }))));
        this._register(this.channel.listen('onDidInstallMcpServers')(results => this._onDidInstallMcpServers.fire(results.map(e => ({ ...e, local: e.local ? transformIncomingServer(e.local, null) : e.local, mcpResource: transformIncomingURI(e.mcpResource, null) })))));
        this._register(this.channel.listen('onDidUpdateMcpServers')(results => this._onDidUpdateMcpServers.fire(results.map(e => ({ ...e, local: e.local ? transformIncomingServer(e.local, null) : e.local, mcpResource: transformIncomingURI(e.mcpResource, null) })))));
        this._register(this.channel.listen('onUninstallMcpServer')(e => this._onUninstallMcpServer.fire(({ ...e, mcpResource: transformIncomingURI(e.mcpResource, null) }))));
        this._register(this.channel.listen('onDidUninstallMcpServer')(e => this._onDidUninstallMcpServer.fire(({ ...e, mcpResource: transformIncomingURI(e.mcpResource, null) }))));
    }
    install(server, options) {
        return Promise.resolve(this.channel.call('install', [server, options])).then(local => transformIncomingServer(local, null));
    }
    installFromGallery(extension, installOptions) {
        return Promise.resolve(this.channel.call('installFromGallery', [extension, installOptions])).then(local => transformIncomingServer(local, null));
    }
    uninstall(extension, options) {
        return Promise.resolve(this.channel.call('uninstall', [extension, options]));
    }
    getInstalled(mcpResource) {
        return Promise.resolve(this.channel.call('getInstalled', [mcpResource]))
            .then(servers => servers.map(server => transformIncomingServer(server, null)));
    }
    updateMetadata(local, gallery, mcpResource) {
        return Promise.resolve(this.channel.call('updateMetadata', [local, gallery, mcpResource])).then(local => transformIncomingServer(local, null));
    }
};
McpManagementChannelClient = __decorate([
    __param(1, IAllowedMcpServersService),
    __param(2, ILogService)
], McpManagementChannelClient);
export { McpManagementChannelClient };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwTWFuYWdlbWVudElwYy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9tY3AvY29tbW9uL21jcE1hbmFnZW1lbnRJcGMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDakUsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSw2QkFBNkIsQ0FBQztBQUNqRSxPQUFPLEVBQUUscUJBQXFCLEVBQW1CLDhCQUE4QixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFeEgsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBRXRELE9BQU8sRUFBME4seUJBQXlCLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUN2UixPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUl6RSxTQUFTLG9CQUFvQixDQUFDLEdBQThCLEVBQUUsV0FBbUM7SUFDaEcsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDN0YsQ0FBQztBQUVELFNBQVMsdUJBQXVCLENBQUMsU0FBMEIsRUFBRSxXQUFtQztJQUMvRixXQUFXLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDO0lBQ2hFLE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUM7SUFDcEMsTUFBTSxXQUFXLEdBQUcsOEJB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