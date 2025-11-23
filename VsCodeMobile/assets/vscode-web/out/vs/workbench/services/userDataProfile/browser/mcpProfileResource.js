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
import { VSBuffer } from '../../../../base/common/buffer.js';
import { localize } from '../../../../nls.js';
import { FileOperationError, IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { API_OPEN_EDITOR_COMMAND_ID } from '../../../browser/parts/editor/editorCommands.js';
import { TreeItemCollapsibleState } from '../../../common/views.js';
import { IUserDataProfileService } from '../common/userDataProfile.js';
let McpResourceInitializer = class McpResourceInitializer {
    constructor(userDataProfileService, fileService, logService) {
        this.userDataProfileService = userDataProfileService;
        this.fileService = fileService;
        this.logService = logService;
    }
    async initialize(content) {
        const mcpContent = JSON.parse(content);
        if (!mcpContent.mcp) {
            this.logService.info(`Initializing Profile: No MCP servers to apply...`);
            return;
        }
        await this.fileService.writeFile(this.userDataProfileService.currentProfile.mcpResource, VSBuffer.fromString(mcpContent.mcp));
    }
};
McpResourceInitializer = __decorate([
    __param(0, IUserDataProfileService),
    __param(1, IFileService),
    __param(2, ILogService)
], McpResourceInitializer);
export { McpResourceInitializer };
let McpProfileResource = class McpProfileResource {
    constructor(fileService, logService) {
        this.fileService = fileService;
        this.logService = logService;
    }
    async getContent(profile) {
        const mcpContent = await this.getMcpResourceContent(profile);
        return JSON.stringify(mcpContent);
    }
    async getMcpResourceContent(profile) {
        const mcpContent = await this.getMcpContent(profile);
        return { mcp: mcpContent };
    }
    async apply(content, profile) {
        const mcpContent = JSON.parse(content);
        if (!mcpContent.mcp) {
            this.logService.info(`Importing Profile (${profile.name}): No MCP servers to apply...`);
            return;
        }
        await this.fileService.writeFile(profile.mcpResource, VSBuffer.fromString(mcpContent.mcp));
    }
    async getMcpContent(profile) {
        try {
            const content = await this.fileService.readFile(profile.mcpResource);
            return content.value.toString();
        }
        catch (error) {
            // File not found
            if (error instanceof FileOperationError && error.fileOperationResult === 1 /* FileOperationResult.FILE_NOT_FOUND */) {
                return null;
            }
            else {
                throw error;
            }
        }
    }
};
McpProfileResource = __decorate([
    __param(0, IFileService),
    __param(1, ILogService)
], McpProfileResource);
export { McpProfileResource };
let McpResourceTreeItem = class McpResourceTreeItem {
    constructor(profile, uriIdentityService, instantiationService) {
        this.profile = profile;
        this.uriIdentityService = uriIdentityService;
        this.instantiationService = instantiationService;
        this.type = "mcp" /* ProfileResourceType.Mcp */;
        this.handle = "mcp" /* ProfileResourceType.Mcp */;
        this.label = { label: localize('mcp', "MCP Servers") };
        this.collapsibleState = TreeItemCollapsibleState.Expanded;
    }
    async getChildren() {
        return [{
                handle: this.profile.mcpResource.toString(),
                resourceUri: this.profile.mcpResource,
                collapsibleState: TreeItemCollapsibleState.None,
                parent: this,
                accessibilityInformation: {
                    label: this.uriIdentityService.extUri.basename(this.profile.mcpResource)
                },
                command: {
                    id: API_OPEN_EDITOR_COMMAND_ID,
                    title: '',
                    arguments: [this.profile.mcpResource, undefined, undefined]
                }
            }];
    }
    async hasContent() {
        const mcpContent = await this.instantiationService.createInstance(McpProfileResource).getMcpResourceContent(this.profile);
        return mcpContent.mcp !== null;
    }
    async getContent() {
        return this.instantiationService.createInstance(McpProfileResource).getContent(this.profile);
    }
    isFromDefaultProfile() {
        return !this.profile.isDefault && !!this.profile.useDefaultFlags?.mcp;
    }
};
McpResourceTreeItem = __decorate([
    __param(1, IUriIdentityService),
    __param(2, IInstantiationService)
], McpResourceTreeItem);
export { McpResourceTreeItem };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwUHJvZmlsZVJlc291cmNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy91c2VyRGF0YVByb2ZpbGUvYnJvd3Nlci9tY3BQcm9maWxlUmVzb3VyY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsa0JBQWtCLEVBQXVCLFlBQVksRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ25ILE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUU3RixPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUM3RixPQUFPLEVBQTBCLHdCQUF3QixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDNUYsT0FBTyxFQUEwRyx1QkFBdUIsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBTXhLLElBQU0sc0JBQXNCLEdBQTVCLE1BQU0sc0JBQXNCO0lBRWxDLFlBQzJDLHNCQUErQyxFQUMxRCxXQUF5QixFQUMxQixVQUF1QjtRQUZYLDJCQUFzQixHQUF0QixzQkFBc0IsQ0FBeUI7UUFDMUQsZ0JBQVcsR0FBWCxXQUFXLENBQWM7UUFDMUIsZUFBVSxHQUFWLFVBQVUsQ0FBYTtJQUV0RCxDQUFDO0lBRUQsS0FBSyxDQUFDLFVBQVUsQ0FBQyxPQUFlO1FBQy9CLE1BQU0sVUFBVSxHQUF3QixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzVELElB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