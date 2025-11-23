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
import { equals } from '../../../../../base/common/arrays.js';
import { Throttler } from '../../../../../base/common/async.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../../base/common/map.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { getMcpServerMapping } from '../mcpConfigFileUtils.js';
import { mcpConfigurationSection } from '../mcpConfiguration.js';
import { IMcpRegistry } from '../mcpRegistryTypes.js';
import { IMcpWorkbenchService, McpCollectionDefinition, McpServerDefinition, McpServerLaunch } from '../mcpTypes.js';
let InstalledMcpServersDiscovery = class InstalledMcpServersDiscovery extends Disposable {
    constructor(mcpWorkbenchService, mcpRegistry, textModelService, logService) {
        super();
        this.mcpWorkbenchService = mcpWorkbenchService;
        this.mcpRegistry = mcpRegistry;
        this.textModelService = textModelService;
        this.logService = logService;
        this.fromGallery = true;
        this.collections = this._register(new DisposableMap());
    }
    start() {
        const throttler = this._register(new Throttler());
        this._register(this.mcpWorkbenchService.onChange(() => throttler.queue(() => this.sync())));
        this.sync();
    }
    async getServerIdMapping(resource, pathToServers) {
        const store = new DisposableStore();
        try {
            const ref = await this.textModelService.createModelReference(resource);
            store.add(ref);
            const serverIdMapping = getMcpServerMapping({ model: ref.object.textEditorModel, pathToServers });
            return serverIdMapping;
        }
        catch {
            return new Map();
        }
        finally {
            store.dispose();
        }
    }
    async sync() {
        try {
            const collections = new Map();
            const mcpConfigPathInfos = new ResourceMap();
            for (const server of this.mcpWorkbenchService.getEnabledLocalMcpServers()) {
                let mcpConfigPathPromise = mcpConfigPathInfos.get(server.mcpResource);
                if (!mcpConfigPathPromise) {
                    mcpConfigPathPromise = (async (local) => {
                        const mcpConfigPath = this.mcpWorkbenchService.getMcpConfigPath(local);
                        const locations = mcpConfigPath?.uri ? await this.getServerIdMapping(mcpConfigPath?.uri, mcpConfigPath.section ? [...mcpConfigPath.section, 'servers'] : ['servers']) : new Map();
                        return mcpConfigPath ? { ...mcpConfigPath, locations } : undefined;
                    })(server);
                    mcpConfigPathInfos.set(server.mcpResource, mcpConfigPathPromise);
                }
                const config = server.config;
                const mcpConfigPath = await mcpConfigPathPromise;
                const collectionId = `mcp.config.${mcpConfigPath ? mcpConfigPath.id : 'unknown'}`;
                let definitions = collections.get(collectionId);
                if (!definitions) {
                    definitions = [mcpConfigPath, []];
                    collections.set(collectionId, definitions);
                }
                const launch = config.type === 'http' ? {
                    type: 2 /* McpServerTransportType.HTTP */,
                    uri: URI.parse(config.url),
                    headers: Object.entries(config.headers || {}),
                } : {
                    type: 1 /* McpServerTransportType.Stdio */,
                    command: config.command,
                    args: config.args || [],
                    env: config.env || {},
                    envFile: config.envFile,
                    cwd: config.cwd,
                };
                definitions[1].push({
                    id: `${collectionId}.${server.name}`,
                    label: server.name,
                    launch,
                    cacheNonce: await McpServerLaunch.hash(launch),
                    roots: mcpConfigPath?.workspaceFolder ? [mcpConfigPath.workspaceFolder.uri] : undefined,
                    variableReplacement: {
                        folder: mcpConfigPath?.workspaceFolder,
                        section: mcpConfigurationSection,
                        target: mcpConfigPath?.target ?? 2 /* ConfigurationTarget.USER */,
                    },
                    devMode: config.dev,
                    presentation: {
                        order: mcpConfigPath?.order,
                        origin: mcpConfigPath?.locations.get(server.name)
                    }
                });
            }
            for (const [id] of this.collections) {
                if (!collections.has(id)) {
                    this.collections.deleteAndDispose(id);
                }
            }
            for (const [id, [mcpConfigPath, serverDefinitions]] of collections) {
                const newServerDefinitions = observableValue(this, serverDefinitions);
                const newCollection = {
                    id,
                    label: mcpConfigPath?.label ?? '',
                    presentation: {
                        order: serverDefinitions[0]?.presentation?.order,
                        origin: mcpConfigPath?.uri,
                    },
                    remoteAuthority: mcpConfigPath?.remoteAuthority ?? null,
                    serverDefinitions: newServerDefinitions,
                    trustBehavior: 0 /* McpServerTrust.Kind.Trusted */,
                    configTarget: mcpConfigPath?.target ?? 2 /* ConfigurationTarget.USER */,
                    scope: mcpConfigPath?.scope ?? 0 /* StorageScope.PROFILE */,
                };
                const existingCollection = this.collections.get(id);
                const collectionDefinitionsChanged = existingCollection ? !McpCollectionDefinition.equals(existingCollection.definition, newCollection) : true;
                if (!collectionDefinitionsChanged) {
                    const serverDefinitionsChanged = existingCollection ? !equals(existingCollection.definition.serverDefinitions.get(), newCollection.serverDefinitions.get(), McpServerDefinition.equals) : true;
                    if (serverDefinitionsChanged) {
                        existingCollection?.serverDefinitions.set(serverDefinitions, undefined);
                    }
                    continue;
                }
                this.collections.deleteAndDispose(id);
                const disposable = this.mcpRegistry.registerCollection(newCollection);
                this.collections.set(id, {
                    definition: newCollection,
                    serverDefinitions: newServerDefinitions,
                    dispose: () => disposable.dispose()
                });
            }
        }
        catch (error) {
            this.logService.error(error);
        }
    }
};
InstalledMcpServersDiscovery = __decorate([
    __param(0, IMcpWorkbenchService),
    __param(1, IMcpRegistry),
    __param(2, ITextModelService),
    __param(3, ILogService)
], InstalledMcpServersDiscovery);
export { InstalledMcpServersDiscovery };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdGFsbGVkTWNwU2VydmVyc0Rpc2NvdmVyeS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL2Rpc2NvdmVyeS9pbnN0YWxsZWRNY3BTZXJ2ZXJzRGlzY292ZXJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM5RCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFlLE1BQU0seUNBQXlDLENBQUM7QUFDbEgsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2hFLE9BQU8sRUFBdUIsZUFBZSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDaEcsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRXhELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBRTdGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUd4RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMvRCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUNqRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdEQsT0FBTyxFQUFrQixvQkFBb0IsRUFBRSx1QkFBdUIsRUFBRSxtQkFBbUIsRUFBRSxlQUFlLEVBQTBDLE1BQU0sZ0JBQWdCLENBQUM7QUFRdEssSUFBTSw0QkFBNEIsR0FBbEMsTUFBTSw0QkFBNkIsU0FBUSxVQUFVO0lBSzNELFlBQ3VCLG1CQUEwRCxFQUNsRSxXQUEwQyxFQUNyQyxn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