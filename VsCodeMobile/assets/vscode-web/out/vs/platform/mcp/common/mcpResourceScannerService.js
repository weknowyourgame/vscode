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
import { assertNever } from '../../../base/common/assert.js';
import { Queue } from '../../../base/common/async.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { parse } from '../../../base/common/json.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../base/common/map.js';
import { ConfigurationTargetToString } from '../../configuration/common/configuration.js';
import { IFileService, toFileOperationResult } from '../../files/common/files.js';
import { registerSingleton } from '../../instantiation/common/extensions.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { IUriIdentityService } from '../../uriIdentity/common/uriIdentity.js';
export const IMcpResourceScannerService = createDecorator('IMcpResourceScannerService');
let McpResourceScannerService = class McpResourceScannerService extends Disposable {
    constructor(fileService, uriIdentityService) {
        super();
        this.fileService = fileService;
        this.uriIdentityService = uriIdentityService;
        this.resourcesAccessQueueMap = new ResourceMap();
    }
    async scanMcpServers(mcpResource, target) {
        return this.withProfileMcpServers(mcpResource, target);
    }
    async addMcpServers(servers, mcpResource, target) {
        await this.withProfileMcpServers(mcpResource, target, scannedMcpServers => {
            let updatedInputs = scannedMcpServers.inputs ?? [];
            const existingServers = scannedMcpServers.servers ?? {};
            for (const { name, config, inputs } of servers) {
                existingServers[name] = config;
                if (inputs) {
                    const existingInputIds = new Set(updatedInputs.map(input => input.id));
                    const newInputs = inputs.filter(input => !existingInputIds.has(input.id));
                    updatedInputs = [...updatedInputs, ...newInputs];
                }
            }
            return { servers: existingServers, inputs: updatedInputs };
        });
    }
    async removeMcpServers(serverNames, mcpResource, target) {
        await this.withProfileMcpServers(mcpResource, target, scannedMcpServers => {
            for (const serverName of serverNames) {
                if (scannedMcpServers.servers?.[serverName]) {
                    delete scannedMcpServers.servers[serverName];
                }
            }
            return scannedMcpServers;
        });
    }
    async withProfileMcpServers(mcpResource, target, updateFn) {
        return this.getResourceAccessQueue(mcpResource)
            .queue(async () => {
            target = target ?? 2 /* ConfigurationTarget.USER */;
            let scannedMcpServers = {};
            try {
                const content = await this.fileService.readFile(mcpResource);
                const errors = [];
                const result = parse(content.value.toString(), errors, { allowTrailingComma: true, allowEmptyContent: true }) || {};
                if (errors.length > 0) {
                    throw new Error('Failed to parse scanned MCP servers: ' + errors.join(', '));
                }
                if (target === 2 /* ConfigurationTarget.USER */) {
                    scannedMcpServers = this.fromUserMcpServers(result);
                }
                else if (target === 6 /* ConfigurationTarget.WORKSPACE_FOLDER */) {
                    scannedMcpServers = this.fromWorkspaceFolderMcpServers(result);
                }
                else if (target === 5 /* ConfigurationTarget.WORKSPACE */) {
                    const workspaceScannedMcpServers = result;
                    if (workspaceScannedMcpServers.settings?.mcp) {
                        scannedMcpServers = this.fromWorkspaceFolderMcpServers(workspaceScannedMcpServers.settings?.mcp);
                    }
                }
            }
            catch (error) {
                if (toFileOperationResult(error) !== 1 /* FileOperationResult.FILE_NOT_FOUND */) {
                    throw error;
                }
            }
            if (updateFn) {
                scannedMcpServers = updateFn(scannedMcpServers ?? {});
                if (target === 2 /* ConfigurationTarget.USER */) {
                    await this.writeScannedMcpServers(mcpResource, scannedMcpServers);
                }
                else if (target === 6 /* ConfigurationTarget.WORKSPACE_FOLDER */) {
                    await this.writeScannedMcpServersToWorkspaceFolder(mcpResource, scannedMcpServers);
                }
                else if (target === 5 /* ConfigurationTarget.WORKSPACE */) {
                    await this.writeScannedMcpServersToWorkspace(mcpResource, scannedMcpServers);
                }
                else {
                    assertNever(target, `Invalid Target: ${ConfigurationTargetToString(target)}`);
                }
            }
            return scannedMcpServers;
        });
    }
    async writeScannedMcpServers(mcpResource, scannedMcpServers) {
        if ((scannedMcpServers.servers && Object.keys(scannedMcpServers.servers).length > 0) || (scannedMcpServers.inputs && scannedMcpServers.inputs.length > 0)) {
            await this.fileService.writeFile(mcpResource, VSBuffer.fromString(JSON.stringify(scannedMcpServers, null, '\t')));
        }
        else {
            await this.fileService.del(mcpResource);
        }
    }
    async writeScannedMcpServersToWorkspaceFolder(mcpResource, scannedMcpServers) {
        await this.fileService.writeFile(mcpResource, VSBuffer.fromString(JSON.stringify(scannedMcpServers, null, '\t')));
    }
    async writeScannedMcpServersToWorkspace(mcpResource, scannedMcpServers) {
        let scannedWorkspaceMcpServers;
        try {
            const content = await this.fileService.readFile(mcpResource);
            const errors = [];
            scannedWorkspaceMcpServers = parse(content.value.toString(), errors, { allowTrailingComma: true, allowEmptyContent: true });
            if (errors.length > 0) {
                throw new Error('Failed to parse scanned MCP servers: ' + errors.join(', '));
            }
        }
        catch (error) {
            if (toFileOperationResult(error) !== 1 /* FileOperationResult.FILE_NOT_FOUND */) {
                throw error;
            }
            scannedWorkspaceMcpServers = { settings: {} };
        }
        if (!scannedWorkspaceMcpServers.settings) {
            scannedWorkspaceMcpServers.settings = {};
        }
        scannedWorkspaceMcpServers.settings.mcp = scannedMcpServers;
        await this.fileService.writeFile(mcpResource, VSBuffer.fromString(JSON.stringify(scannedWorkspaceMcpServers, null, '\t')));
    }
    fromUserMcpServers(scannedMcpServers) {
        const userMcpServers = {
            inputs: scannedMcpServers.inputs
        };
        const servers = Object.entries(scannedMcpServers.servers ?? {});
        if (servers.length > 0) {
            userMcpServers.servers = {};
            for (const [serverName, server] of servers) {
                userMcpServers.servers[serverName] = this.sanitizeServer(server);
            }
        }
        return userMcpServers;
    }
    fromWorkspaceFolderMcpServers(scannedWorkspaceFolderMcpServers) {
        const scannedMcpServers = {
            inputs: scannedWorkspaceFolderMcpServers.inputs
        };
        const servers = Object.entries(scannedWorkspaceFolderMcpServers.servers ?? {});
        if (servers.length > 0) {
            scannedMcpServers.servers = {};
            for (const [serverName, config] of servers) {
                scannedMcpServers.servers[serverName] = this.sanitizeServer(config);
            }
        }
        return scannedMcpServers;
    }
    sanitizeServer(serverOrConfig) {
        let server;
        if (serverOrConfig.config) {
            const oldScannedMcpServer = serverOrConfig;
            server = {
                ...oldScannedMcpServer.config,
                version: oldScannedMcpServer.version,
                gallery: oldScannedMcpServer.gallery
            };
        }
        else {
            server = serverOrConfig;
        }
        if (server.type === undefined || (server.type !== "http" /* McpServerType.REMOTE */ && server.type !== "stdio" /* McpServerType.LOCAL */)) {
            server.type = server.command ? "stdio" /* McpServerType.LOCAL */ : "http" /* McpServerType.REMOTE */;
        }
        return server;
    }
    getResourceAccessQueue(file) {
        let resourceQueue = this.resourcesAccessQueueMap.get(file);
        if (!resourceQueue) {
            resourceQueue = new Queue();
            this.resourcesAccessQueueMap.set(file, resourceQueue);
        }
        return resourceQueue;
    }
};
McpResourceScannerService = __decorate([
    __param(0, IFileService),
    __param(1, IUriIdentityService)
], McpResourceScannerService);
export { McpResourceScannerService };
registerSingleton(IMcpResourceScannerService, McpResourceScannerService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwUmVzb3VyY2VTY2FubmVyU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9tY3AvY29tbW9uL21jcFJlc291cmNlU2Nhbm5lclNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFMUQsT0FBTyxFQUFFLEtBQUssRUFBYyxNQUFNLDhCQUE4QixDQUFDO0FBQ2pFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFHMUQsT0FBTyxFQUF1QiwyQkFBMkIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQy9HLE9BQU8sRUFBdUIsWUFBWSxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDdkcsT0FBTyxFQUFxQixpQkFBaUIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQXlCOUUsTUFBTSxDQUFDLE1BQU0sMEJBQTBCLEdBQUcsZUFBZSxDQUE2Qiw0QkFBNEIsQ0FBQyxDQUFDO0FBUTdHLElBQU0seUJBQXlCLEdBQS9CLE1BQU0seUJBQTBCLFNBQVEsVUFBVTtJQUt4RCxZQUNlLFdBQTBDLEVBQ25DLGtCQUEwRDtRQUUvRSxLQUFLLEVBQUUsQ0FBQztRQUh1QixnQkFBVyxHQUFYLFdBQVcsQ0FBYztRQUNoQix1QkFB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