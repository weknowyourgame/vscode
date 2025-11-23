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
import { DisposableMap } from '../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IRemoteAgentService } from '../../../../services/remote/common/remoteAgentService.js';
import { IMcpRegistry } from '../mcpRegistryTypes.js';
import { FilesystemMcpDiscovery } from './nativeMcpDiscoveryAbstract.js';
import { claudeConfigToServerDefinition } from './nativeMcpDiscoveryAdapters.js';
let CursorWorkspaceMcpDiscoveryAdapter = class CursorWorkspaceMcpDiscoveryAdapter extends FilesystemMcpDiscovery {
    constructor(fileService, _workspaceContextService, mcpRegistry, configurationService, _remoteAgentService) {
        super(configurationService, fileService, mcpRegistry);
        this._workspaceContextService = _workspaceContextService;
        this._remoteAgentService = _remoteAgentService;
        this._collections = this._register(new DisposableMap());
    }
    start() {
        this._register(this._workspaceContextService.onDidChangeWorkspaceFolders(e => {
            for (const removed of e.removed) {
                this._collections.deleteAndDispose(removed.uri.toString());
            }
            for (const added of e.added) {
                this.watchFolder(added);
            }
        }));
        for (const folder of this._workspaceContextService.getWorkspace().folders) {
            this.watchFolder(folder);
        }
    }
    watchFolder(folder) {
        const configFile = joinPath(folder.uri, '.cursor', 'mcp.json');
        const collection = {
            id: `cursor-workspace.${folder.index}`,
            label: `${folder.name}/.cursor/mcp.json`,
            remoteAuthority: this._remoteAgentService.getConnection()?.remoteAuthority || null,
            scope: 1 /* StorageScope.WORKSPACE */,
            trustBehavior: 1 /* McpServerTrust.Kind.TrustedOnNonce */,
            serverDefinitions: observableValue(this, []),
            configTarget: 6 /* ConfigurationTarget.WORKSPACE_FOLDER */,
            presentation: {
                origin: configFile,
                order: 0 /* McpCollectionSortOrder.WorkspaceFolder */ + 1,
            },
        };
        this._collections.set(folder.uri.toString(), this.watchFile(URI.joinPath(folder.uri, '.cursor', 'mcp.json'), collection, "cursor-workspace" /* DiscoverySource.CursorWorkspace */, async (contents) => {
            const defs = await claudeConfigToServerDefinition(collection.id, contents, folder.uri);
            defs?.forEach(d => d.roots = [folder.uri]);
            return defs;
        }));
    }
};
CursorWorkspaceMcpDiscoveryAdapter = __decorate([
    __param(0, IFileService),
    __param(1, IWorkspaceContextService),
    __param(2, IMcpRegistry),
    __param(3, IConfigurationService),
    __param(4, IRemoteAgentService)
], CursorWorkspaceMcpDiscoveryAdapter);
export { CursorWorkspaceMcpDiscoveryAdapter };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya3NwYWNlTWNwRGlzY292ZXJ5QWRhcHRlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL2Rpc2NvdmVyeS93b3Jrc3BhY2VNY3BEaXNjb3ZlcnlBZGFwdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxhQUFhLEVBQWUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDM0UsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQXVCLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDM0gsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBRTdFLE9BQU8sRUFBRSx3QkFBd0IsRUFBb0IsTUFBTSx1REFBdUQsQ0FBQztBQUNuSCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUUvRixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFHdEQsT0FBTyxFQUFFLHNCQUFzQixFQUFtQyxNQUFNLGlDQUFpQyxDQUFDO0FBQzFHLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRTFFLElBQU0sa0NBQWtDLEdBQXhDLE1BQU0sa0NBQW1DLFNBQVEsc0JBQXNCO0lBRzdFLFlBQ2UsV0FBeUIsRUFDYix3QkFBbUUsRUFDL0UsV0FBeUIsRUFDaEIsb0JBQTJDLEVBQzdDLG1CQUF5RDtRQUU5RSxLQUFLLENBQUMsb0JBQW9CLEVBQUUsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBTFgsNkJBQXdC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