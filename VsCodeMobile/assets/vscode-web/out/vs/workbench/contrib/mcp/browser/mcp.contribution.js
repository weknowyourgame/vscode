/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../nls.js';
import { registerAction2 } from '../../../../platform/actions/common/actions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import * as jsonContributionRegistry from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { mcpAccessConfig } from '../../../../platform/mcp/common/mcpManagement.js';
import { Extensions as QuickAccessExtensions } from '../../../../platform/quickinput/common/quickAccess.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor } from '../../../browser/editor.js';
import { Extensions as ConfigurationMigrationExtensions } from '../../../common/configuration.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { EditorExtensions } from '../../../common/editor.js';
import { mcpSchemaId } from '../../../services/configuration/common/configuration.js';
import { ExtensionMcpDiscovery } from '../common/discovery/extensionMcpDiscovery.js';
import { InstalledMcpServersDiscovery } from '../common/discovery/installedMcpServersDiscovery.js';
import { mcpDiscoveryRegistry } from '../common/discovery/mcpDiscovery.js';
import { RemoteNativeMpcDiscovery } from '../common/discovery/nativeMcpRemoteDiscovery.js';
import { CursorWorkspaceMcpDiscoveryAdapter } from '../common/discovery/workspaceMcpDiscoveryAdapter.js';
import { mcpServerSchema } from '../common/mcpConfiguration.js';
import { McpContextKeysController } from '../common/mcpContextKeys.js';
import { IMcpDevModeDebugging, McpDevModeDebugging } from '../common/mcpDevMode.js';
import { McpLanguageModelToolContribution } from '../common/mcpLanguageModelToolContribution.js';
import { McpRegistry } from '../common/mcpRegistry.js';
import { IMcpRegistry } from '../common/mcpRegistryTypes.js';
import { McpResourceFilesystem } from '../common/mcpResourceFilesystem.js';
import { McpSamplingService } from '../common/mcpSamplingService.js';
import { McpService } from '../common/mcpService.js';
import { IMcpElicitationService, IMcpSamplingService, IMcpService, IMcpWorkbenchService } from '../common/mcpTypes.js';
import { McpAddContextContribution } from './mcpAddContextContribution.js';
import { AddConfigurationAction, EditStoredInput, ListMcpServerCommand, McpBrowseCommand, McpBrowseResourcesCommand, McpConfigureSamplingModels, McpConfirmationServerOptionsCommand, MCPServerActionRendering, McpServerOptionsCommand, McpSkipCurrentAutostartCommand, McpStartPromptingServerCommand, OpenRemoteUserMcpResourceCommand, OpenUserMcpResourceCommand, OpenWorkspaceFolderMcpResourceCommand, OpenWorkspaceMcpResourceCommand, RemoveStoredInput, ResetMcpCachedTools, ResetMcpTrustCommand, RestartServer, ShowConfiguration, ShowInstalledMcpServersCommand, ShowOutput, StartServer, StopServer } from './mcpCommands.js';
import { McpDiscovery } from './mcpDiscovery.js';
import { McpElicitationService } from './mcpElicitationService.js';
import { McpLanguageFeatures } from './mcpLanguageFeatures.js';
import { McpConfigMigrationContribution } from './mcpMigration.js';
import { McpResourceQuickAccess } from './mcpResourceQuickAccess.js';
import { McpServerEditor } from './mcpServerEditor.js';
import { McpServerEditorInput } from './mcpServerEditorInput.js';
import { McpServersViewsContribution } from './mcpServersView.js';
import { MCPContextsInitialisation, McpWorkbenchService } from './mcpWorkbenchService.js';
registerSingleton(IMcpRegistry, McpRegistry, 1 /* InstantiationType.Delayed */);
registerSingleton(IMcpService, McpService, 1 /* InstantiationType.Delayed */);
registerSingleton(IMcpWorkbenchService, McpWorkbenchService, 0 /* InstantiationType.Eager */);
registerSingleton(IMcpDevModeDebugging, McpDevModeDebugging, 1 /* InstantiationType.Delayed */);
registerSingleton(IMcpSamplingService, McpSamplingService, 1 /* InstantiationType.Delayed */);
registerSingleton(IMcpElicitationService, McpElicitationService, 1 /* InstantiationType.Delayed */);
mcpDiscoveryRegistry.register(new SyncDescriptor(RemoteNativeMpcDiscovery));
mcpDiscoveryRegistry.register(new SyncDescriptor(InstalledMcpServersDiscovery));
mcpDiscoveryRegistry.register(new SyncDescriptor(ExtensionMcpDiscovery));
mcpDiscoveryRegistry.register(new SyncDescriptor(CursorWorkspaceMcpDiscoveryAdapter));
registerWorkbenchContribution2('mcpDiscovery', McpDiscovery, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2('mcpContextKeys', McpContextKeysController, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2('mcpLanguageFeatures', McpLanguageFeatures, 4 /* WorkbenchPhase.Eventually */);
registerWorkbenchContribution2('mcpResourceFilesystem', McpResourceFilesystem, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(McpLanguageModelToolContribution.ID, McpLanguageModelToolContribution, 3 /* WorkbenchPhase.AfterRestored */);
registerAction2(ListMcpServerCommand);
registerAction2(McpServerOptionsCommand);
registerAction2(McpConfirmationServerOptionsCommand);
registerAction2(ResetMcpTrustCommand);
registerAction2(ResetMcpCachedTools);
registerAction2(AddConfigurationAction);
registerAction2(RemoveStoredInput);
registerAction2(EditStoredInput);
registerAction2(StartServer);
registerAction2(StopServer);
registerAction2(ShowOutput);
registerAction2(RestartServer);
registerAction2(ShowConfiguration);
registerAction2(McpBrowseCommand);
registerAction2(OpenUserMcpResourceCommand);
registerAction2(OpenRemoteUserMcpResourceCommand);
registerAction2(OpenWorkspaceMcpResourceCommand);
registerAction2(OpenWorkspaceFolderMcpResourceCommand);
registerAction2(ShowInstalledMcpServersCommand);
registerAction2(McpBrowseResourcesCommand);
registerAction2(McpConfigureSamplingModels);
registerAction2(McpStartPromptingServerCommand);
registerAction2(McpSkipCurrentAutostartCommand);
registerWorkbenchContribution2('mcpActionRendering', MCPServerActionRendering, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2('mcpAddContext', McpAddContextContribution, 4 /* WorkbenchPhase.Eventually */);
registerWorkbenchContribution2(MCPContextsInitialisation.ID, MCPContextsInitialisation, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(McpConfigMigrationContribution.ID, McpConfigMigrationContribution, 4 /* WorkbenchPhase.Eventually */);
registerWorkbenchContribution2(McpServersViewsContribution.ID, McpServersViewsContribution, 3 /* WorkbenchPhase.AfterRestored */);
const jsonRegistry = Registry.as(jsonContributionRegistry.Extensions.JSONContribution);
jsonRegistry.registerSchema(mcpSchemaId, mcpServerSchema);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(McpServerEditor, McpServerEditor.ID, localize('mcpServer', "MCP Server")), [
    new SyncDescriptor(McpServerEditorInput)
]);
Registry.as(QuickAccessExtensions.Quickaccess).registerQuickAccessProvider({
    ctor: McpResourceQuickAccess,
    prefix: McpResourceQuickAccess.PREFIX,
    placeholder: localize('mcp.quickaccess.placeholder', "Filter to an MCP resource"),
    helpEntries: [{
            description: localize('mcp.quickaccess.add', "MCP Server Resources"),
            commandId: "workbench.mcp.addConfiguration" /* McpCommandIds.AddConfiguration */
        }]
});
Registry.as(ConfigurationMigrationExtensions.ConfigurationMigration)
    .registerConfigurationMigrations([{
        key: 'chat.mcp.enabled',
        migrateFn: (value, accessor) => {
            const result = [['chat.mcp.enabled', { value: undefined }]];
            if (value === true) {
                result.push([mcpAccessConfig, { value: "all" /* McpAccessValue.All */ }]);
            }
            if (value === false) {
                result.push([mcpAccessConfig, { value: "none" /* McpAccessValue.None */ }]);
            }
            return result;
        }
    }]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvYnJvd3Nlci9tY3AuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDakYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzFGLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEtBQUssd0JBQXdCLE1BQU0scUVBQXFFLENBQUM7QUFDaEgsT0FBTyxFQUFFLGVBQWUsRUFBa0IsTUFBTSxrREFBa0QsQ0FBQztBQUNuRyxPQUFPLEVBQXdCLFVBQVUsSUFBSSxxQkFBcUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ2xJLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsb0JBQW9CLEVBQXVCLE1BQU0sNEJBQTRCLENBQUM7QUFDdkYsT0FBTyxFQUFtQyxVQUFVLElBQUksZ0NBQWdDLEVBQThCLE1BQU0sa0NBQWtDLENBQUM7QUFDL0osT0FBTyxFQUFFLDhCQUE4QixFQUFrQixNQUFNLGtDQUFrQyxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN0RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNyRixPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsb0JBQW9C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