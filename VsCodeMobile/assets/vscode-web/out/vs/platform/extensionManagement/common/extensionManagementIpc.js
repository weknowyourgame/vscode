/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter, Event } from '../../../base/common/event.js';
import { cloneAndChange } from '../../../base/common/objects.js';
import { URI } from '../../../base/common/uri.js';
import { DefaultURITransformer, transformAndReviveIncomingURIs } from '../../../base/common/uriIpc.js';
import { CommontExtensionManagementService } from './abstractExtensionManagementService.js';
import { language } from '../../../base/common/platform.js';
function transformIncomingURI(uri, transformer) {
    return uri ? URI.revive(transformer ? transformer.transformIncoming(uri) : uri) : undefined;
}
function transformOutgoingURI(uri, transformer) {
    return transformer ? transformer.transformOutgoingURI(uri) : uri;
}
function transformIncomingExtension(extension, transformer) {
    transformer = transformer ? transformer : DefaultURITransformer;
    const manifest = extension.manifest;
    const transformed = transformAndReviveIncomingURIs({ ...extension, ...{ manifest: undefined } }, transformer);
    return { ...transformed, ...{ manifest } };
}
function transformIncomingOptions(options, transformer) {
    return options?.profileLocation ? transformAndReviveIncomingURIs(options, transformer ?? DefaultURITransformer) : options;
}
function transformOutgoingExtension(extension, transformer) {
    return transformer ? cloneAndChange(extension, value => value instanceof URI ? transformer.transformOutgoingURI(value) : undefined) : extension;
}
export class ExtensionManagementChannel {
    constructor(service, getUriTransformer) {
        this.service = service;
        this.getUriTransformer = getUriTransformer;
        this.onInstallExtension = Event.buffer(service.onInstallExtension, true);
        this.onDidInstallExtensions = Event.buffer(service.onDidInstallExtensions, true);
        this.onUninstallExtension = Event.buffer(service.onUninstallExtension, true);
        this.onDidUninstallExtension = Event.buffer(service.onDidUninstallExtension, true);
        this.onDidUpdateExtensionMetadata = Event.buffer(service.onDidUpdateExtensionMetadata, true);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listen(context, event) {
        const uriTransformer = this.getUriTransformer(context);
        switch (event) {
            case 'onInstallExtension': {
                return Event.map(this.onInstallExtension, e => {
                    return {
                        ...e,
                        profileLocation: e.profileLocation ? transformOutgoingURI(e.profileLocation, uriTransformer) : e.profileLocation
                    };
                });
            }
            case 'onDidInstallExtensions': {
                return Event.map(this.onDidInstallExtensions, results => results.map(i => ({
                    ...i,
                    local: i.local ? transformOutgoingExtension(i.local, uriTransformer) : i.local,
                    profileLocation: i.profileLocation ? transformOutgoingURI(i.profileLocation, uriTransformer) : i.profileLocation
                })));
            }
            case 'onUninstallExtension': {
                return Event.map(this.onUninstallExtension, e => {
                    return {
                        ...e,
                        profileLocation: e.profileLocation ? transformOutgoingURI(e.profileLocation, uriTransformer) : e.profileLocation
                    };
                });
            }
            case 'onDidUninstallExtension': {
                return Event.map(this.onDidUninstallExtension, e => {
                    return {
                        ...e,
                        profileLocation: e.profileLocation ? transformOutgoingURI(e.profileLocation, uriTransformer) : e.profileLocation
                    };
                });
            }
            case 'onDidUpdateExtensionMetadata': {
                return Event.map(this.onDidUpdateExtensionMetadata, e => {
                    return {
                        local: transformOutgoingExtension(e.local, uriTransformer),
                        profileLocation: transformOutgoingURI(e.profileLocation, uriTransformer)
                    };
                });
            }
        }
        throw new Error('Invalid listen');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async call(context, command, args) {
        const uriTransformer = this.getUriTransformer(context);
        switch (command) {
            case 'zip': {
                const extension = transformIncomingExtension(args[0], uriTransformer);
                const uri = await this.service.zip(extension);
                return transformOutgoingURI(uri, uriTransformer);
            }
            case 'install': {
                return this.service.install(transformIncomingURI(args[0], uriTransformer), transformIncomingOptions(args[1], uriTransformer));
            }
            case 'installFromLocation': {
                return this.service.installFromLocation(transformIncomingURI(args[0], uriTransformer), transformIncomingURI(args[1], uriTransformer));
            }
            case 'installExtensionsFromProfile': {
                return this.service.installExtensionsFromProfile(args[0], transformIncomingURI(args[1], uriTransformer), transformIncomingURI(args[2], uriTransformer));
            }
            case 'getManifest': {
                return this.service.getManifest(transformIncomingURI(args[0], uriTransformer));
            }
            case 'getTargetPlatform': {
                return this.service.getTargetPlatform();
            }
            case 'installFromGallery': {
                return this.service.installFromGallery(args[0], transformIncomingOptions(args[1], uriTransformer));
            }
            case 'installGalleryExtensions': {
                const arg = args[0];
                return this.service.installGalleryExtensions(arg.map(({ extension, options }) => ({ extension, options: transformIncomingOptions(options, uriTransformer) ?? {} })));
            }
            case 'uninstall': {
                return this.service.uninstall(transformIncomingExtension(args[0], uriTransformer), transformIncomingOptions(args[1], uriTransformer));
            }
            case 'uninstallExtensions': {
                const arg = args[0];
                return this.service.uninstallExtensions(arg.map(({ extension, options }) => ({ extension: transformIncomingExtension(extension, uriTransformer), options: transformIncomingOptions(options, uriTransformer) })));
            }
            case 'getInstalled': {
                const extensions = await this.service.getInstalled(args[0], transformIncomingURI(args[1], uriTransformer), args[2], args[3]);
                return extensions.map(e => transformOutgoingExtension(e, uriTransformer));
            }
            case 'toggleApplicationScope': {
                const extension = await this.service.toggleApplicationScope(transformIncomingExtension(args[0], uriTransformer), transformIncomingURI(args[1], uriTransformer));
                return transformOutgoingExtension(extension, uriTransformer);
            }
            case 'copyExtensions': {
                return this.service.copyExtensions(transformIncomingURI(args[0], uriTransformer), transformIncomingURI(args[1], uriTransformer));
            }
            case 'updateMetadata': {
                const e = await this.service.updateMetadata(transformIncomingExtension(args[0], uriTransformer), args[1], transformIncomingURI(args[2], uriTransformer));
                return transformOutgoingExtension(e, uriTransformer);
            }
            case 'resetPinnedStateForAllUserExtensions': {
                return this.service.resetPinnedStateForAllUserExtensions(args[0]);
            }
            case 'getExtensionsControlManifest': {
                return this.service.getExtensionsControlManifest();
            }
            case 'download': {
                return this.service.download(args[0], args[1], args[2]);
            }
            case 'cleanUp': {
                return this.service.cleanUp();
            }
        }
        throw new Error('Invalid call');
    }
}
export class ExtensionManagementChannelClient extends CommontExtensionManagementService {
    get onInstallExtension() { return this._onInstallExtension.event; }
    get onDidInstallExtensions() { return this._onDidInstallExtensions.event; }
    get onUninstallExtension() { return this._onUninstallExtension.event; }
    get onDidUninstallExtension() { return this._onDidUninstallExtension.event; }
    get onDidUpdateExtensionMetadata() { return this._onDidUpdateExtensionMetadata.event; }
    constructor(channel, productService, allowedExtensionsService) {
        super(productService, allowedExtensionsService);
        this.channel = channel;
        this._onInstallExtension = this._register(new Emitter());
        this._onDidInstallExtensions = this._register(new Emitter());
        this._onUninstallExtension = this._register(new Emitter());
        this._onDidUninstallExtension = this._register(new Emitter());
        this._onDidUpdateExtensionMetadata = this._register(new Emitter());
        this._register(this.channel.listen('onInstallExtension')(e => this.onInstallExtensionEvent({ ...e, source: this.isUriComponents(e.source) ? URI.revive(e.source) : e.source, profileLocation: URI.revive(e.profileLocation) })));
        this._register(this.channel.listen('onDidInstallExtensions')(results => this.onDidInstallExtensionsEvent(results.map(e => ({ ...e, local: e.local ? transformIncomingExtension(e.local, null) : e.local, source: this.isUriComponents(e.source) ? URI.revive(e.source) : e.source, profileLocation: URI.revive(e.profileLocation) })))));
        this._register(this.channel.listen('onUninstallExtension')(e => this.onUninstallExtensionEvent({ ...e, profileLocation: URI.revive(e.profileLocation) })));
        this._register(this.channel.listen('onDidUninstallExtension')(e => this.onDidUninstallExtensionEvent({ ...e, profileLocation: URI.revive(e.profileLocation) })));
        this._register(this.channel.listen('onDidUpdateExtensionMetadata')(e => this.onDidUpdateExtensionMetadataEvent({ profileLocation: URI.revive(e.profileLocation), local: transformIncomingExtension(e.local, null) })));
    }
    onInstallExtensionEvent(event) {
        this._onInstallExtension.fire(event);
    }
    onDidInstallExtensionsEvent(results) {
        this._onDidInstallExtensions.fire(results);
    }
    onUninstallExtensionEvent(event) {
        this._onUninstallExtension.fire(event);
    }
    onDidUninstallExtensionEvent(event) {
        this._onDidUninstallExtension.fire(event);
    }
    onDidUpdateExtensionMetadataEvent(event) {
        this._onDidUpdateExtensionMetadata.fire(event);
    }
    isUriComponents(obj) {
        if (!obj) {
            return false;
        }
        const thing = obj;
        return typeof thing?.path === 'string' &&
            typeof thing?.scheme === 'string';
    }
    getTargetPlatform() {
        if (!this._targetPlatformPromise) {
            this._targetPlatformPromise = this.channel.call('getTargetPlatform');
        }
        return this._targetPlatformPromise;
    }
    zip(extension) {
        return Promise.resolve(this.channel.call('zip', [extension]).then(result => URI.revive(result)));
    }
    install(vsix, options) {
        return Promise.resolve(this.channel.call('install', [vsix, options])).then(local => transformIncomingExtension(local, null));
    }
    installFromLocation(location, profileLocation) {
        return Promise.resolve(this.channel.call('installFromLocation', [location, profileLocation])).then(local => transformIncomingExtension(local, null));
    }
    async installExtensionsFromProfile(extensions, fromProfileLocation, toProfileLocation) {
        const result = await this.channel.call('installExtensionsFromProfile', [extensions, fromProfileLocation, toProfileLocation]);
        return result.map(local => transformIncomingExtension(local, null));
    }
    getManifest(vsix) {
        return Promise.resolve(this.channel.call('getManifest', [vsix]));
    }
    installFromGallery(extension, installOptions) {
        return Promise.resolve(this.channel.call('installFromGallery', [extension, installOptions])).then(local => transformIncomingExtension(local, null));
    }
    async installGalleryExtensions(extensions) {
        const results = await this.channel.call('installGalleryExtensions', [extensions]);
        return results.map(e => ({ ...e, local: e.local ? transformIncomingExtension(e.local, null) : e.local, source: this.isUriComponents(e.source) ? URI.revive(e.source) : e.source, profileLocation: URI.revive(e.profileLocation) }));
    }
    uninstall(extension, options) {
        if (extension.isWorkspaceScoped) {
            throw new Error('Cannot uninstall a workspace extension');
        }
        return Promise.resolve(this.channel.call('uninstall', [extension, options]));
    }
    uninstallExtensions(extensions) {
        if (extensions.some(e => e.extension.isWorkspaceScoped)) {
            throw new Error('Cannot uninstall a workspace extension');
        }
        return Promise.resolve(this.channel.call('uninstallExtensions', [extensions]));
    }
    getInstalled(type = null, extensionsProfileResource, productVersion) {
        return Promise.resolve(this.channel.call('getInstalled', [type, extensionsProfileResource, productVersion, language]))
            .then(extensions => extensions.map(extension => transformIncomingExtension(extension, null)));
    }
    updateMetadata(local, metadata, extensionsProfileResource) {
        return Promise.resolve(this.channel.call('updateMetadata', [local, metadata, extensionsProfileResource]))
            .then(extension => transformIncomingExtension(extension, null));
    }
    resetPinnedStateForAllUserExtensions(pinned) {
        return this.channel.call('resetPinnedStateForAllUserExtensions', [pinned]);
    }
    toggleApplicationScope(local, fromProfileLocation) {
        return this.channel.call('toggleApplicationScope', [local, fromProfileLocation])
            .then(extension => transformIncomingExtension(extension, null));
    }
    copyExtensions(fromProfileLocation, toProfileLocation) {
        return this.channel.call('copyExtensions', [fromProfileLocation, toProfileLocation]);
    }
    getExtensionsControlManifest() {
        return Promise.resolve(this.channel.call('getExtensionsControlManifest'));
    }
    async download(extension, operation, donotVerifySignature) {
        const result = await this.channel.call('download', [extension, operation, donotVerifySignature]);
        return URI.revive(result);
    }
    async cleanUp() {
        return this.channel.call('cleanUp');
    }
    registerParticipant() { throw new Error('Not Supported'); }
}
export class ExtensionTipsChannel {
    constructor(service) {
        this.service = service;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listen(context, event) {
        throw new Error('Invalid listen');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    call(context, command, args) {
        switch (command) {
            case 'getConfigBasedTips': return this.service.getConfigBasedTips(URI.revive(args[0]));
            case 'getImportantExecutableBasedTips': return this.service.getImportantExecutableBasedTips();
            case 'getOtherExecutableBasedTips': return this.service.getOtherExecutableBasedTips();
        }
        throw new Error('Invalid call');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uTWFuYWdlbWVudElwYy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50SXBjLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxHQUFHLEVBQWlCLE1BQU0sNkJBQTZCLENBQUM7QUFDakUsT0FBTyxFQUFFLHFCQUFxQixFQUFtQiw4QkFBOEIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBVXhILE9BQU8sRUFBRSxpQ0FBaUMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzVGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUs1RCxTQUFTLG9CQUFvQixDQUFDLEdBQThCLEVBQUUsV0FBbUM7SUFDaEcsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDN0YsQ0FBQztBQUVELFNBQVMsb0JBQW9CLENBQUMsR0FBUSxFQUFFLFdBQW1DO0lBQzFFLE9BQU8sV0FBVyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztBQUNsRSxDQUFDO0FBRUQsU0FBUywwQkFBMEIsQ0FBQyxTQUEwQixFQUFFLFdBQW1DO0lBQ2xHLFdBQVcsR0FBRyxXQUFXLENB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