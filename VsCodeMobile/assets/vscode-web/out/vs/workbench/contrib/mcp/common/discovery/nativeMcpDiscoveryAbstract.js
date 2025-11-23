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
import { RunOnceScheduler } from '../../../../../base/common/async.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { autorun, observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { observableConfigValue } from '../../../../../platform/observable/common/platformObservableUtils.js';
import { discoverySourceLabel, mcpDiscoverySection } from '../mcpConfiguration.js';
import { IMcpRegistry } from '../mcpRegistryTypes.js';
import { ClaudeDesktopMpcDiscoveryAdapter, CursorDesktopMpcDiscoveryAdapter, WindsurfDesktopMpcDiscoveryAdapter } from './nativeMcpDiscoveryAdapters.js';
let FilesystemMcpDiscovery = class FilesystemMcpDiscovery extends Disposable {
    constructor(configurationService, _fileService, _mcpRegistry) {
        super();
        this._fileService = _fileService;
        this._mcpRegistry = _mcpRegistry;
        this.fromGallery = false;
        this._fsDiscoveryEnabled = observableConfigValue(mcpDiscoverySection, undefined, configurationService);
    }
    _isDiscoveryEnabled(reader, discoverySource) {
        const fsDiscovery = this._fsDiscoveryEnabled.read(reader);
        if (typeof fsDiscovery === 'boolean') {
            return fsDiscovery; // old commands
        }
        if (discoverySource && fsDiscovery?.[discoverySource] === true) {
            return true;
        }
        return false;
    }
    watchFile(file, collection, discoverySource, adaptFile) {
        const store = new DisposableStore();
        const collectionRegistration = store.add(new MutableDisposable());
        const updateFile = async () => {
            let definitions = [];
            try {
                const contents = await this._fileService.readFile(file);
                definitions = await adaptFile(contents.value) || [];
            }
            catch {
                // ignored
            }
            if (!definitions.length) {
                collectionRegistration.clear();
            }
            else {
                collection.serverDefinitions.set(definitions, undefined);
                if (!collectionRegistration.value) {
                    collectionRegistration.value = this._mcpRegistry.registerCollection(collection);
                }
            }
        };
        store.add(autorun(reader => {
            if (!this._isDiscoveryEnabled(reader, discoverySource)) {
                collectionRegistration.clear();
                return;
            }
            const throttler = reader.store.add(new RunOnceScheduler(updateFile, 500));
            const watcher = reader.store.add(this._fileService.createWatcher(file, { recursive: false, excludes: [] }));
            reader.store.add(watcher.onDidChange(() => throttler.schedule()));
            updateFile();
        }));
        return store;
    }
};
FilesystemMcpDiscovery = __decorate([
    __param(0, IConfigurationService),
    __param(1, IFileService),
    __param(2, IMcpRegistry)
], FilesystemMcpDiscovery);
export { FilesystemMcpDiscovery };
/**
 * Base class that discovers MCP servers on a filesystem, outside of the ones
 * defined in VS Code settings.
 */
let NativeFilesystemMcpDiscovery = class NativeFilesystemMcpDiscovery extends FilesystemMcpDiscovery {
    constructor(remoteAuthority, labelService, fileService, instantiationService, mcpRegistry, configurationService) {
        super(configurationService, fileService, mcpRegistry);
        this.suffix = '';
        if (remoteAuthority) {
            this.suffix = ' ' + localize('onRemoteLabel', ' on {0}', labelService.getHostLabel(Schemas.vscodeRemote, remoteAuthority));
        }
        this.adapters = [
            instantiationService.createInstance(ClaudeDesktopMpcDiscoveryAdapter, remoteAuthority),
            instantiationService.createInstance(CursorDesktopMpcDiscoveryAdapter, remoteAuthority),
            instantiationService.createInstance(WindsurfDesktopMpcDiscoveryAdapter, remoteAuthority),
        ];
    }
    setDetails(detailsDto) {
        if (!detailsDto) {
            return;
        }
        const details = {
            ...detailsDto,
            homedir: URI.revive(detailsDto.homedir),
            xdgHome: detailsDto.xdgHome ? URI.revive(detailsDto.xdgHome) : undefined,
            winAppData: detailsDto.winAppData ? URI.revive(detailsDto.winAppData) : undefined,
        };
        for (const adapter of this.adapters) {
            const file = adapter.getFilePath(details);
            if (!file) {
                continue;
            }
            const collection = {
                id: adapter.id,
                label: discoverySourceLabel[adapter.discoverySource] + this.suffix,
                remoteAuthority: adapter.remoteAuthority,
                configTarget: 2 /* ConfigurationTarget.USER */,
                scope: 0 /* StorageScope.PROFILE */,
                trustBehavior: 1 /* McpServerTrust.Kind.TrustedOnNonce */,
                serverDefinitions: observableValue(this, []),
                presentation: {
                    origin: file,
                    order: adapter.order + (adapter.remoteAuthority ? -50 /* McpCollectionSortOrder.RemoteBoost */ : 0),
                },
            };
            this._register(this.watchFile(file, collection, adapter.discoverySource, contents => adapter.adaptFile(contents, details)));
        }
    }
};
NativeFilesystemMcpDiscovery = __decorate([
    __param(1, ILabelService),
    __param(2, IFileService),
    __param(3, IInstantiationService),
    __param(4, IMcpRegistry),
    __param(5, IConfigurationService)
], NativeFilesystemMcpDiscovery);
export { NativeFilesystemMcpDiscovery };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmF0aXZlTWNwRGlzY292ZXJ5QWJzdHJhY3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2NvbW1vbi9kaXNjb3ZlcnkvbmF0aXZlTWNwRGlzY292ZXJ5QWJzdHJhY3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFdkUsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN0SCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEUsT0FBTyxFQUFFLE9BQU8sRUFBNkMsZUFBZSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDL0gsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQXVCLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDM0gsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUU5RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxzRUFBc0UsQ0FBQztBQUc3RyxPQUFPLEVBQW1CLG9CQUFvQixFQUFFLG1CQUFtQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDcEcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBR3RELE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSxnQ0FBZ0MsRUFBNkIsa0NBQWtDLEVBQUUs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