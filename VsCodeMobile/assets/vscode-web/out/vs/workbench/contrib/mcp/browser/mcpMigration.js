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
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { mcpConfigurationSection } from '../../../contrib/mcp/common/mcpConfiguration.js';
import { IWorkbenchMcpManagementService } from '../../../services/mcp/common/mcpWorkbenchManagementService.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { IFileService, toFileOperationResult } from '../../../../platform/files/common/files.js';
import { parse } from '../../../../base/common/jsonc.js';
import { isObject } from '../../../../base/common/types.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { IJSONEditingService } from '../../../services/configuration/common/jsonEditing.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { localize } from '../../../../nls.js';
let McpConfigMigrationContribution = class McpConfigMigrationContribution extends Disposable {
    static { this.ID = 'workbench.mcp.config.migration'; }
    constructor(mcpManagementService, userDataProfileService, fileService, remoteAgentService, jsonEditingService, logService, notificationService, commandService) {
        super();
        this.mcpManagementService = mcpManagementService;
        this.userDataProfileService = userDataProfileService;
        this.fileService = fileService;
        this.remoteAgentService = remoteAgentService;
        this.jsonEditingService = jsonEditingService;
        this.logService = logService;
        this.notificationService = notificationService;
        this.commandService = commandService;
        this.migrateMcpConfig();
    }
    async migrateMcpConfig() {
        try {
            const userMcpConfig = await this.parseMcpConfig(this.userDataProfileService.currentProfile.settingsResource);
            if (userMcpConfig && userMcpConfig.servers && Object.keys(userMcpConfig.servers).length > 0) {
                await Promise.all(Object.entries(userMcpConfig.servers).map(([name, config], index) => this.mcpManagementService.install({ name, config, inputs: index === 0 ? userMcpConfig.inputs : undefined })));
                await this.removeMcpConfig(this.userDataProfileService.currentProfile.settingsResource);
            }
        }
        catch (error) {
            this.logService.error(`MCP migration: Failed to migrate user MCP config`, error);
        }
        this.watchForMcpConfiguration(this.userDataProfileService.currentProfile.settingsResource, false);
        const remoteEnvironment = await this.remoteAgentService.getEnvironment();
        if (remoteEnvironment) {
            try {
                const userRemoteMcpConfig = await this.parseMcpConfig(remoteEnvironment.settingsPath);
                if (userRemoteMcpConfig && userRemoteMcpConfig.servers && Object.keys(userRemoteMcpConfig.servers).length > 0) {
                    await Promise.all(Object.entries(userRemoteMcpConfig.servers).map(([name, config], index) => this.mcpManagementService.install({ name, config, inputs: index === 0 ? userRemoteMcpConfig.inputs : undefined }, { target: 4 /* ConfigurationTarget.USER_REMOTE */ })));
                    await this.removeMcpConfig(remoteEnvironment.settingsPath);
                }
            }
            catch (error) {
                this.logService.error(`MCP migration: Failed to migrate remote MCP config`, error);
            }
            this.watchForMcpConfiguration(remoteEnvironment.settingsPath, true);
        }
    }
    watchForMcpConfiguration(file, isRemote) {
        this._register(this.fileService.watch(file));
        this._register(this.fileService.onDidFilesChange(e => {
            if (e.contains(file)) {
                this.checkForMcpConfigInFile(file, isRemote);
            }
        }));
    }
    async checkForMcpConfigInFile(settingsFile, isRemote) {
        try {
            const mcpConfig = await this.parseMcpConfig(settingsFile);
            if (mcpConfig && mcpConfig.servers && Object.keys(mcpConfig.servers).length > 0) {
                this.showMcpConfigErrorNotification(isRemote);
            }
        }
        catch (error) {
            // Ignore parsing errors - file might not exist or be malformed
        }
    }
    showMcpConfigErrorNotification(isRemote) {
        const message = isRemote
            ? localize('mcp.migration.remoteConfigFound', 'MCP servers should no longer be configured in remote user settings. Use the dedicated MCP configuration instead.')
            : localize('mcp.migration.userConfigFound', 'MCP servers should no longer be configured in user settings. Use the dedicated MCP configuration instead.');
        const openConfigLabel = isRemote
            ? localize('mcp.migration.openRemoteConfig', 'Open Remote User MCP Configuration')
            : localize('mcp.migration.openUserConfig', 'Open User MCP Configuration');
        const commandId = isRemote ? "workbench.mcp.openRemoteUserMcpJson" /* McpCommandIds.OpenRemoteUserMcp */ : "workbench.mcp.openUserMcpJson" /* McpCommandIds.OpenUserMcp */;
        this.notificationService.prompt(Severity.Error, message, [{
                label: localize('mcp.migration.update', 'Update Now'),
                run: async () => {
                    await this.migrateMcpConfig();
                    await this.commandService.executeCommand(commandId);
                },
            }, {
                label: openConfigLabel,
                keepOpen: true,
                run: () => this.commandService.executeCommand(commandId)
            }]);
    }
    async parseMcpConfig(settingsFile) {
        try {
            const content = await this.fileService.readFile(settingsFile);
            const settingsObject = parse(content.value.toString());
            if (!isObject(settingsObject)) {
                return undefined;
            }
            const mcpConfiguration = settingsObject[mcpConfigurationSection];
            if (mcpConfiguration && mcpConfiguration.servers) {
                for (const [, config] of Object.entries(mcpConfiguration.servers)) {
                    if (config.type === undefined) {
                        config.type = config.command ? "stdio" /* McpServerType.LOCAL */ : "http" /* McpServerType.REMOTE */;
                    }
                }
            }
            return mcpConfiguration;
        }
        catch (error) {
            if (toFileOperationResult(error) !== 1 /* FileOperationResult.FILE_NOT_FOUND */) {
                this.logService.warn(`MCP migration: Failed to parse MCP config from ${settingsFile}:`, error);
            }
            return;
        }
    }
    async removeMcpConfig(settingsFile) {
        try {
            await this.jsonEditingService.write(settingsFile, [
                {
                    path: [mcpConfigurationSection],
                    value: undefined
                }
            ], true);
        }
        catch (error) {
            this.logService.warn(`MCP migration: Failed to remove MCP config from ${settingsFile}:`, error);
        }
    }
};
McpConfigMigrationContribution = __decorate([
    __param(0, IWorkbenchMcpManagementService),
    __param(1, IUserDataProfileService),
    __param(2, IFileService),
    __param(3, IRemoteAgentService),
    __param(4, IJSONEditingService),
    __param(5, ILogService),
    __param(6, INotificationService),
    __param(7, ICommandService)
], McpConfigMigrationContribution);
export { McpConfigMigrationContribution };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwTWlncmF0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL21jcC9icm93c2VyL21jcE1pZ3JhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFbEUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBR3JFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBRS9HLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ3RHLE9BQU8sRUFBdUIsWUFBWSxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFdEgsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxRQUFRLEVBQVcsTUFBTSxrQ0FBa0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUM1RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUM1RixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsUUFBUSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDMUcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBRW5GLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQU92QyxJQUFNLDhCQUE4QixHQUFwQyxNQUFNLDhCQUErQixTQUFRLFVBQVU7YUFFdEQsT0FBRSxHQUFHLGdDQUFnQyxBQUFuQyxDQUFvQztJQUU3QyxZQUNrRCxvQkFBb0QsRUFDM0Qsc0JBQStD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