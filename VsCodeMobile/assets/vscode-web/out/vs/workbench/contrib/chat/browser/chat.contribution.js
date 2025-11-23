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
import { timeout } from '../../../../base/common/async.js';
import { Event } from '../../../../base/common/event.js';
import { MarkdownString, isMarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable, DisposableMap } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { isMacintosh } from '../../../../base/common/platform.js';
import { PolicyCategory } from '../../../../base/common/policy.js';
import { registerEditorFeature } from '../../../../editor/common/editorFeatures.js';
import * as nls from '../../../../nls.js';
import { AccessibleViewRegistry } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { mcpAccessConfig, mcpAutoStartConfig, mcpGalleryServiceEnablementConfig, mcpGalleryServiceUrlConfig } from '../../../../platform/mcp/common/mcpManagement.js';
import product from '../../../../platform/product/common/product.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor } from '../../../browser/editor.js';
import { Extensions } from '../../../common/configuration.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { EditorExtensions } from '../../../common/editor.js';
import { IWorkbenchAssignmentService } from '../../../services/assignment/common/assignmentService.js';
import { ChatEntitlement, IChatEntitlementService } from '../../../services/chat/common/chatEntitlementService.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../services/editor/common/editorResolverService.js';
import { AssistedTypes } from '../../mcp/browser/mcpCommandsAddConfiguration.js';
import { allDiscoverySources, discoverySourceSettingsLabel, mcpDiscoverySection, mcpServerSamplingSection } from '../../mcp/common/mcpConfiguration.js';
import { ChatAgentNameService, ChatAgentService, IChatAgentNameService, IChatAgentService } from '../common/chatAgents.js';
import { CodeMapperService, ICodeMapperService } from '../common/chatCodeMapperService.js';
import '../common/chatColors.js';
import { IChatEditingService } from '../common/chatEditingService.js';
import { IChatLayoutService } from '../common/chatLayoutService.js';
import { ChatModeService, IChatModeService } from '../common/chatModes.js';
import { ChatResponseResourceFileSystemProvider } from '../common/chatResponseResourceFileSystemProvider.js';
import { IChatService } from '../common/chatService.js';
import { ChatService } from '../common/chatServiceImpl.js';
import { IChatSessionsService } from '../common/chatSessionsService.js';
import { ChatSlashCommandService, IChatSlashCommandService } from '../common/chatSlashCommands.js';
import { ChatTodoListService, IChatTodoListService } from '../common/chatTodoListService.js';
import { ChatTransferService, IChatTransferService } from '../common/chatTransferService.js';
import { IChatVariablesService } from '../common/chatVariables.js';
import { ChatWidgetHistoryService, IChatWidgetHistoryService } from '../common/chatWidgetHistoryService.js';
import { ChatAgentLocation, ChatConfiguration, ChatModeKind } from '../common/constants.js';
import { ILanguageModelIgnoredFilesService, LanguageModelIgnoredFilesService } from '../common/ignoredFiles.js';
import { ILanguageModelsService, LanguageModelsService } from '../common/languageModels.js';
import { ILanguageModelStatsService, LanguageModelStatsService } from '../common/languageModelStats.js';
import { ILanguageModelToolsConfirmationService } from '../common/languageModelToolsConfirmationService.js';
import { ILanguageModelToolsService } from '../common/languageModelToolsService.js';
import { ChatPromptFilesExtensionPointHandler } from '../common/promptSyntax/chatPromptFilesContribution.js';
import { PromptsConfig } from '../common/promptSyntax/config/config.js';
import { INSTRUCTIONS_DEFAULT_SOURCE_FOLDER, INSTRUCTION_FILE_EXTENSION, LEGACY_MODE_DEFAULT_SOURCE_FOLDER, LEGACY_MODE_FILE_EXTENSION, PROMPT_DEFAULT_SOURCE_FOLDER, PROMPT_FILE_EXTENSION } from '../common/promptSyntax/config/promptFileLocations.js';
import { PromptLanguageFeaturesProvider } from '../common/promptSyntax/promptFileContributions.js';
import { AGENT_DOCUMENTATION_URL, INSTRUCTIONS_DOCUMENTATION_URL, PROMPT_DOCUMENTATION_URL } from '../common/promptSyntax/promptTypes.js';
import { IPromptsService } from '../common/promptSyntax/service/promptsService.js';
import { PromptsService } from '../common/promptSyntax/service/promptsServiceImpl.js';
import { LanguageModelToolsExtensionPointHandler } from '../common/tools/languageModelToolsContribution.js';
import { BuiltinToolsContribution } from '../common/tools/tools.js';
import { IVoiceChatService, VoiceChatService } from '../common/voiceChatService.js';
import { registerChatAccessibilityActions } from './actions/chatAccessibilityActions.js';
import { AgentChatAccessibilityHelp, EditsChatAccessibilityHelp, PanelChatAccessibilityHelp, QuickChatAccessibilityHelp } from './actions/chatAccessibilityHelp.js';
import { ACTION_ID_NEW_CHAT, CopilotTitleBarMenuRendering, ModeOpenChatGlobalAction, registerChatActions } from './actions/chatActions.js';
import { CodeBlockActionRendering, registerChatCodeBlockActions, registerChatCodeCompareBlockActions } from './actions/chatCodeblockActions.js';
import { ChatContextContributions } from './actions/chatContext.js';
import { registerChatContextActions } from './actions/chatContextActions.js';
import { ContinueChatInSessionActionRendering } from './actions/chatContinueInAction.js';
import { registerChatCopyActions } from './actions/chatCopyActions.js';
import { registerChatDeveloperActions } from './actions/chatDeveloperActions.js';
import { ChatSubmitAction, registerChatExecuteActions } from './actions/chatExecuteActions.js';
import { registerChatFileTreeActions } from './actions/chatFileTreeActions.js';
import { ChatGettingStartedContribution } from './actions/chatGettingStarted.js';
import { registerChatExportActions } from './actions/chatImportExport.js';
import { registerLanguageModelActions } from './actions/chatLanguageModelActions.js';
import { registerMoveActions } from './actions/chatMoveActions.js';
import { registerNewChatActions } from './actions/chatNewActions.js';
import { registerChatPromptNavigationActions } from './actions/chatPromptNavigationActions.js';
import { registerQuickChatActions } from './actions/chatQuickInputActions.js';
import { ChatSessionsGettingStartedAction, DeleteChatSessionAction, OpenChatSessionInNewEditorGroupAction, OpenChatSessionInNewWindowAction, OpenChatSessionInSidebarAction, RenameChatSessionAction, ToggleAgentSessionsViewLocationAction, ToggleChatSessionsDescriptionDisplayAction } from './actions/chatSessionActions.js';
import { registerChatTitleActions } from './actions/chatTitleActions.js';
import { registerChatElicitationActions } from './actions/chatElicitationActions.js';
import { registerChatToolActions } from './actions/chatToolActions.js';
import { ChatTransferContribution } from './actions/chatTransfer.js';
import './agentSessions/agentSessionsView.js';
import { IChatAccessibilityService, IChatCodeBlockContextProviderService, IChatWidgetService, IQuickChatService } from './chat.js';
import { ChatAccessibilityService } from './chatAccessibilityService.js';
import './chatAttachmentModel.js';
import { ChatAttachmentResolveService, IChatAttachmentResolveService } from './chatAttachmentResolveService.js';
import { ChatMarkdownAnchorService, IChatMarkdownAnchorService } from './chatContentParts/chatMarkdownAnchorService.js';
import { ChatContextPickService, IChatContextPickService } from './chatContextPickService.js';
import { ChatInputBoxContentProvider } from './chatEdinputInputContentProvider.js';
import { ChatEditingEditorAccessibility } from './chatEditing/chatEditingEditorAccessibility.js';
import { registerChatEditorActions } from './chatEditing/chatEditingEditorActions.js';
import { ChatEditingEditorContextKeys } from './chatEditing/chatEditingEditorContextKeys.js';
import { ChatEditingEditorOverlay } from './chatEditing/chatEditingEditorOverlay.js';
import { ChatEditingService } from './chatEditing/chatEditingServiceImpl.js';
import { ChatEditingNotebookFileSystemProviderContrib } from './chatEditing/notebook/chatEditingNotebookFileSystemProvider.js';
import { SimpleBrowserOverlay } from './chatEditing/simpleBrowserEditorOverlay.js';
import { ChatEditor } from './chatEditor.js';
import { ChatEditorInput, ChatEditorInputSerializer } from './chatEditorInput.js';
import { ChatLayoutService } from './chatLayoutService.js';
import './chatManagement/chatManagement.contribution.js';
import { agentSlashCommandToMarkdown, agentToMarkdown } from './chatMarkdownDecorationsRenderer.js';
import { ChatOutputRendererService, IChatOutputRendererService } from './chatOutputItemRenderer.js';
import { ChatCompatibilityNotifier, ChatExtensionPointHandler } from './chatParticipant.contribution.js';
import { ChatPasteProvidersFeature } from './chatPasteProviders.js';
import { QuickChatService } from './chatQuick.js';
import { ChatResponseAccessibleView } from './chatResponseAccessibleView.js';
import { ChatTerminalOutputAccessibleView } from './chatTerminalOutputAccessibleView.js';
import { LocalChatSessionsProvider } from './chatSessions/localChatSessionsProvider.js';
import { ChatSessionsView, ChatSessionsViewContrib } from './chatSessions/view/chatSessionsView.js';
import { ChatSetupContribution, ChatTeardownContribution } from './chatSetup.js';
import { ChatStatusBarEntry } from './chatStatus.js';
import { ChatVariablesService } from './chatVariables.js';
import { ChatWidget } from './chatWidget.js';
import { ChatCodeBlockContextProviderService } from './codeBlockContextProviderService.js';
import { ChatDynamicVariableModel } from './contrib/chatDynamicVariables.js';
import { ChatImplicitContextContribution } from './contrib/chatImplicitContext.js';
import './contrib/chatInputCompletions.js';
import './contrib/chatInputEditorContrib.js';
import './contrib/chatInputEditorHover.js';
import { ChatRelatedFilesContribution } from './contrib/chatInputRelatedFilesContrib.js';
import { LanguageModelToolsConfirmationService } from './languageModelToolsConfirmationService.js';
import { LanguageModelToolsService, globalAutoApproveDescription } from './languageModelToolsService.js';
import './promptSyntax/promptCodingAgentActionContribution.js';
import './promptSyntax/promptToolsCodeLensProvider.js';
import { PromptUrlHandler } from './promptSyntax/promptUrlHandler.js';
import { ConfigureToolSets, UserToolSetsContributions } from './tools/toolSetsContribution.js';
import { ChatViewsWelcomeHandler } from './viewsWelcome/chatViewsWelcomeHandler.js';
import { ChatWidgetService } from './chatWidgetService.js';
const toolReferenceNameEnumValues = [];
const toolReferenceNameEnumDescriptions = [];
// Register configuration
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
    id: 'chatSidebar',
    title: nls.localize('interactiveSessionConfigurationTitle', "Chat"),
    type: 'object',
    properties: {
        'chat.fontSize': {
            type: 'number',
            description: nls.localize('chat.fontSize', "Controls the font size in pixels in chat messages."),
            default: 13,
            minimum: 6,
            maximum: 100
        },
        'chat.fontFamily': {
            type: 'string',
            description: nls.localize('chat.fontFamily', "Controls the font family in chat messages."),
            default: 'default'
        },
        'chat.editor.fontSize': {
            type: 'number',
            description: nls.localize('interactiveSession.editor.fontSize', "Controls the font size in pixels in chat codeblocks."),
            default: isMacintosh ? 12 : 14,
        },
        'chat.editor.fontFamily': {
            type: 'string',
            description: nls.localize('interactiveSession.editor.fontFamily', "Controls the font family in chat codeblocks."),
            default: 'default'
        },
        'chat.editor.fontWeight': {
            type: 'string',
            description: nls.localize('interactiveSession.editor.fontWeight', "Controls the font weight in chat codeblocks."),
            default: 'default'
        },
        'chat.editor.wordWrap': {
            type: 'string',
            description: nls.localize('interactiveSession.editor.wordWrap', "Controls whether lines should wrap in chat codeblocks."),
            default: 'off',
            enum: ['on', 'off']
        },
        'chat.editor.lineHeight': {
            type: 'number',
            description: nls.localize('interactiveSession.editor.lineHeight', "Controls the line height in pixels in chat codeblocks. Use 0 to compute the line height from the font size."),
            default: 0
        },
        'chat.commandCenter.enabled': {
            type: 'boolean',
            markdownDescription: nls.localize('chat.commandCenter.enabled', "Controls whether the command center shows a menu for actions to control chat (requires {0}).", '`#window.commandCenter#`'),
            default: true
        },
        'chat.implicitContext.enabled': {
            type: 'object',
            description: nls.localize('chat.implicitContext.enabled.1', "Enables automatically using the active editor as chat context for specified chat locations."),
            additionalProperties: {
                type: 'string',
                enum: ['never', 'first', 'always'],
                description: nls.localize('chat.implicitContext.value', "The value for the implicit context."),
                enumDescriptions: [
                    nls.localize('chat.implicitContext.value.never', "Implicit context is never enabled."),
                    nls.localize('chat.implicitContext.value.first', "Implicit context is enabled for the first interaction."),
                    nls.localize('chat.implicitContext.value.always', "Implicit context is always enabled.")
                ]
            },
            default: {
                'panel': 'always',
            }
        },
        'chat.implicitContext.suggestedContext': {
            type: 'boolean',
            markdownDescription: nls.localize('chat.implicitContext.suggestedContext', "Controls whether the new implicit context flow is shown. In Ask and Edit modes, the context will automatically be included. When using an agent, context will be suggested as an attachment. Selections are always included as context."),
            default: true,
        },
        'chat.editing.autoAcceptDelay': {
            type: 'number',
            markdownDescription: nls.localize('chat.editing.autoAcceptDelay', "Delay after which changes made by chat are automatically accepted. Values are in seconds, `0` means disabled and `100` seconds is the maximum."),
            default: 0,
            minimum: 0,
            maximum: 100
        },
        'chat.editing.confirmEditRequestRemoval': {
            type: 'boolean',
            scope: 1 /* ConfigurationScope.APPLICATION */,
            markdownDescription: nls.localize('chat.editing.confirmEditRequestRemoval', "Whether to show a confirmation before removing a request and its associated edits."),
            default: true,
        },
        'chat.editing.confirmEditRequestRetry': {
            type: 'boolean',
            scope: 1 /* ConfigurationScope.APPLICATION */,
            markdownDescription: nls.localize('chat.editing.confirmEditRequestRetry', "Whether to show a confirmation before retrying a request and its associated edits."),
            default: true,
        },
        'chat.experimental.detectParticipant.enabled': {
            type: 'boolean',
            deprecationMessage: nls.localize('chat.experimental.detectParticipant.enabled.deprecated', "This setting is deprecated. Please use `chat.detectParticipant.enabled` instead."),
            description: nls.localize('chat.experimental.detectParticipant.enabled', "Enables chat participant autodetection for panel chat."),
            default: null
        },
        'chat.detectParticipant.enabled': {
            type: 'boolean',
            description: nls.localize('chat.detectParticipant.enabled', "Enables chat participant autodetection for panel chat."),
            default: true
        },
        'chat.renderRelatedFiles': {
            type: 'boolean',
            description: nls.localize('chat.renderRelatedFiles', "Controls whether related files should be rendered in the chat input."),
            default: false
        },
        'chat.notifyWindowOnConfirmation': {
            type: 'boolean',
            description: nls.localize('chat.notifyWindowOnConfirmation', "Controls whether a chat session should present the user with an OS notification when a confirmation is needed while the window is not in focus. This includes a window badge as well as notification toast."),
            default: true,
        },
        [ChatConfiguration.GlobalAutoApprove]: {
            default: false,
            markdownDescription: globalAutoApproveDescription.value,
            type: 'boolean',
            scope: 3 /* ConfigurationScope.APPLICATION_MACHINE */,
            tags: ['experimental'],
            policy: {
                name: 'ChatToolsAutoApprove',
                category: PolicyCategory.InteractiveSession,
                minimumVersion: '1.99',
                value: (account) => account.chat_preview_features_enabled === false ? false : undefined,
                localization: {
                    description: {
                        key: 'autoApprove2.description',
                        value: nls.localize('autoApprove2.description', 'Global auto approve also known as "YOLO mode" disables manual approval completely for all tools in all workspaces, allowing the agent to act fully autonomously. This is extremely dangerous and is *never* recommended, even containerized environments like Codespaces and Dev Containers have user keys forwarded into the container that could be compromised.\n\nThis feature disables critical security protections and makes it much easier for an attacker to compromise the machine.')
                    }
                },
            }
        },
        [ChatConfiguration.AutoApproveEdits]: {
            default: {
                '**/*': true,
                '**/.vscode/*.json': false,
                '**/.git/**': false,
                '**/{package.json,package-lock.json,server.xml,build.rs,web.config,.gitattributes,.env}': false,
                '**/*.{code-workspace,csproj,fsproj,vbproj,vcxproj,proj,targets,props}': false,
            },
            markdownDescription: nls.localize('chat.tools.autoApprove.edits', "Controls whether edits made by chat are automatically approved. The default is to approve all edits except those made to certain files which have the potential to cause immediate unintended side-effects, such as `**/.vscode/*.json`.\n\nSet to `true` to automatically approve edits to matching files, `false` to always require explicit approval. The last pattern matching a given file will determine whether the edit is automatically approved."),
            type: 'object',
            additionalProperties: {
                type: 'boolean',
            }
        },
        [ChatConfiguration.AutoApprovedUrls]: {
            default: {},
            markdownDescription: nls.localize('chat.tools.fetchPage.approvedUrls', "Controls which URLs are automatically approved when requested by chat tools. Keys are URL patterns and values can be `true` to approve both requests and responses, `false` to deny, or an object with `approveRequest` and `approveResponse` properties for granular control.\n\nExamples:\n- `\"https://example.com\": true` - Approve all requests to example.com\n- `\"https://*.example.com\": true` - Approve all requests to any subdomain of example.com\n- `\"https://example.com/api/*\": { \"approveRequest\": true, \"approveResponse\": false }` - Approve requests but not responses for example.com/api paths"),
            type: 'object',
            additionalProperties: {
                oneOf: [
                    { type: 'boolean' },
                    {
                        type: 'object',
                        properties: {
                            approveRequest: { type: 'boolean' },
                            approveResponse: { type: 'boolean' }
                        }
                    }
                ]
            }
        },
        [ChatConfiguration.EligibleForAutoApproval]: {
            default: {},
            markdownDescription: nls.localize('chat.tools.eligibleForAutoApproval', 'Controls which tools are eligible for automatic approval. Tools set to \'false\' will always present a confirmation and will never offer the option to auto-approve. The default behavior (or setting a tool to \'true\') may result in the tool offering auto-approval options.'),
            type: 'object',
            propertyNames: {
                enum: toolReferenceNameEnumValues,
                enumDescriptions: toolReferenceNameEnumDescriptions,
            },
            additionalProperties: {
                type: 'boolean',
            },
            tags: ['experimental'],
            examples: [
                {
                    'fetch': false,
                    'runTests': false
                }
            ],
            policy: {
                name: 'ChatToolsEligibleForAutoApproval',
                category: PolicyCategory.InteractiveSession,
                minimumVersion: '1.107',
                localization: {
                    description: {
                        key: 'chat.tools.eligibleForAutoApproval',
                        value: nls.localize('chat.tools.eligibleForAutoApproval', 'Controls which tools are eligible for automatic approval. Tools set to \'false\' will always present a confirmation and will never offer the option to auto-approve. The default behavior (or setting a tool to \'true\') may result in the tool offering auto-approval options.')
                    }
                },
            }
        },
        'chat.sendElementsToChat.enabled': {
            default: true,
            description: nls.localize('chat.sendElementsToChat.enabled', "Controls whether elements can be sent to chat from the Simple Browser."),
            type: 'boolean',
            tags: ['preview']
        },
        'chat.sendElementsToChat.attachCSS': {
            default: true,
            markdownDescription: nls.localize('chat.sendElementsToChat.attachCSS', "Controls whether CSS of the selected element will be added to the chat. {0} must be enabled.", '`#chat.sendElementsToChat.enabled#`'),
            type: 'boolean',
            tags: ['preview']
        },
        'chat.sendElementsToChat.attachImages': {
            default: true,
            markdownDescription: nls.localize('chat.sendElementsToChat.attachImages', "Controls whether a screenshot of the selected element will be added to the chat. {0} must be enabled.", '`#chat.sendElementsToChat.enabled#`'),
            type: 'boolean',
            tags: ['experimental']
        },
        'chat.undoRequests.restoreInput': {
            default: true,
            markdownDescription: nls.localize('chat.undoRequests.restoreInput', "Controls whether the input of the chat should be restored when an undo request is made. The input will be filled with the text of the request that was restored."),
            type: 'boolean',
        },
        'chat.editRequests': {
            markdownDescription: nls.localize('chat.editRequests', "Enables editing of requests in the chat. This allows you to change the request content and resubmit it to the model."),
            type: 'string',
            enum: ['inline', 'hover', 'input', 'none'],
            default: 'inline',
        },
        [ChatConfiguration.EmptyStateHistoryEnabled]: {
            type: 'boolean',
            default: product.quality === 'insiders',
            description: nls.localize('chat.emptyState.history.enabled', "Show recent chat history on the empty chat state."),
            tags: ['preview']
        },
        [ChatConfiguration.NotifyWindowOnResponseReceived]: {
            type: 'boolean',
            default: true,
            description: nls.localize('chat.notifyWindowOnResponseReceived', "Controls whether a chat session should present the user with an OS notification when a response is received while the window is not in focus. This includes a window badge as well as notification toast."),
        },
        'chat.checkpoints.enabled': {
            type: 'boolean',
            default: true,
            description: nls.localize('chat.checkpoints.enabled', "Enables checkpoints in chat. Checkpoints allow you to restore the chat to a previous state."),
        },
        'chat.checkpoints.showFileChanges': {
            type: 'boolean',
            description: nls.localize('chat.checkpoints.showFileChanges', "Controls whether to show chat checkpoint file changes."),
            default: false
        },
        [mcpAccessConfig]: {
            type: 'string',
            description: nls.localize('chat.mcp.access', "Controls access to installed Model Context Protocol servers."),
            enum: [
                "none" /* McpAccessValue.None */,
                "registry" /* McpAccessValue.Registry */,
                "all" /* McpAccessValue.All */
            ],
            enumDescriptions: [
                nls.localize('chat.mcp.access.none', "No access to MCP servers."),
                nls.localize('chat.mcp.access.registry', "Allows access to MCP servers installed from the registry that VS Code is connected to."),
                nls.localize('chat.mcp.access.any', "Allow access to any installed MCP server.")
            ],
            default: "all" /* McpAccessValue.All */,
            policy: {
                name: 'ChatMCP',
                category: PolicyCategory.InteractiveSession,
                minimumVersion: '1.99',
                value: (account) => {
                    if (account.mcp === false) {
                        return "none" /* McpAccessValue.None */;
                    }
                    if (account.mcpAccess === 'registry_only') {
                        return "registry" /* McpAccessValue.Registry */;
                    }
                    return undefined;
                },
                localization: {
                    description: {
                        key: 'chat.mcp.access',
                        value: nls.localize('chat.mcp.access', "Controls access to installed Model Context Protocol servers.")
                    },
                    enumDescriptions: [
                        {
                            key: 'chat.mcp.access.none', value: nls.localize('chat.mcp.access.none', "No access to MCP servers."),
                        },
                        {
                            key: 'chat.mcp.access.registry', value: nls.localize('chat.mcp.access.registry', "Allows access to MCP servers installed from the registry that VS Code is connected to."),
                        },
                        {
                            key: 'chat.mcp.access.any', value: nls.localize('chat.mcp.access.any', "Allow access to any installed MCP server.")
                        }
                    ]
                },
            }
        },
        [mcpAutoStartConfig]: {
            type: 'string',
            description: nls.localize('chat.mcp.autostart', "Controls whether MCP servers should be automatically started when the chat messages are submitted."),
            default: "newAndOutdated" /* McpAutoStartValue.NewAndOutdated */,
            enum: [
                "never" /* McpAutoStartValue.Never */,
                "onlyNew" /* McpAutoStartValue.OnlyNew */,
                "newAndOutdated" /* McpAutoStartValue.NewAndOutdated */
            ],
            enumDescriptions: [
                nls.localize('chat.mcp.autostart.never', "Never automatically start MCP servers."),
                nls.localize('chat.mcp.autostart.onlyNew', "Only automatically start new MCP servers that have never been run."),
                nls.localize('chat.mcp.autostart.newAndOutdated', "Automatically start new and outdated MCP servers that are not yet running.")
            ],
            tags: ['experimental'],
        },
        [mcpServerSamplingSection]: {
            type: 'object',
            description: nls.localize('chat.mcp.serverSampling', "Configures which models are exposed to MCP servers for sampling (making model requests in the background). This setting can be edited in a graphical way under the `{0}` command.", 'MCP: ' + nls.localize('mcp.list', 'List Servers')),
            scope: 5 /* ConfigurationScope.RESOURCE */,
            additionalProperties: {
                type: 'object',
                properties: {
                    allowedDuringChat: {
                        type: 'boolean',
                        description: nls.localize('chat.mcp.serverSampling.allowedDuringChat', "Whether this server is make sampling requests during its tool calls in a chat session."),
                        default: true,
                    },
                    allowedOutsideChat: {
                        type: 'boolean',
                        description: nls.localize('chat.mcp.serverSampling.allowedOutsideChat', "Whether this server is allowed to make sampling requests outside of a chat session."),
                        default: false,
                    },
                    allowedModels: {
                        type: 'array',
                        items: {
                            type: 'string',
                            description: nls.localize('chat.mcp.serverSampling.model', "A model the MCP server has access to."),
                        },
                    }
                }
            },
        },
        [AssistedTypes[4 /* AddConfigurationType.NuGetPackage */].enabledConfigKey]: {
            type: 'boolean',
            description: nls.localize('chat.mcp.assisted.nuget.enabled.description', "Enables NuGet packages for AI-assisted MCP server installation. Used to install MCP servers by name from the central registry for .NET packages (NuGet.org)."),
            default: false,
            tags: ['experimental'],
            experiment: {
                mode: 'startup'
            }
        },
        [ChatConfiguration.Edits2Enabled]: {
            type: 'boolean',
            description: nls.localize('chat.edits2Enabled', "Enable the new Edits mode that is based on tool-calling. When this is enabled, models that don't support tool-calling are unavailable for Edits mode."),
            default: false,
        },
        [ChatConfiguration.ExtensionToolsEnabled]: {
            type: 'boolean',
            description: nls.localize('chat.extensionToolsEnabled', "Enable using tools contributed by third-party extensions."),
            default: true,
            policy: {
                name: 'ChatAgentExtensionTools',
                category: PolicyCategory.InteractiveSession,
                minimumVersion: '1.99',
                localization: {
                    description: {
                        key: 'chat.extensionToolsEnabled',
                        value: nls.localize('chat.extensionToolsEnabled', "Enable using tools contributed by third-party extensions.")
                    }
                },
            }
        },
        [ChatConfiguration.AgentEnabled]: {
            type: 'boolean',
            description: nls.localize('chat.agent.enabled.description', "Enable agent mode for chat. When this is enabled, agent mode can be activated via the dropdown in the view."),
            default: true,
            policy: {
                name: 'ChatAgentMode',
                category: PolicyCategory.InteractiveSession,
                minimumVersion: '1.99',
                value: (account) => account.chat_agent_enabled === false ? false : undefined,
                localization: {
                    description: {
                        key: 'chat.agent.enabled.description',
                        value: nls.localize('chat.agent.enabled.description', "Enable agent mode for chat. When this is enabled, agent mode can be activated via the dropdown in the view."),
                    }
                }
            }
        },
        [ChatConfiguration.EnableMath]: {
            type: 'boolean',
            description: nls.localize('chat.mathEnabled.description', "Enable math rendering in chat responses using KaTeX."),
            default: true,
            tags: ['preview'],
        },
        [ChatConfiguration.ShowCodeBlockProgressAnimation]: {
            type: 'boolean',
            description: nls.localize('chat.codeBlock.showProgressAnimation.description', "When applying edits, show a progress animation in the code block pill. If disabled, shows the progress percentage instead."),
            default: true,
            tags: ['experimental'],
        },
        [ChatConfiguration.AgentSessionsViewLocation]: {
            type: 'string',
            enum: ['disabled', 'view', 'single-view'],
            description: nls.localize('chat.sessionsViewLocation.description', "Controls where to show the agent sessions menu."),
            default: product.quality === 'stable' ? 'view' : 'single-view',
            tags: ['experimental'],
            experiment: {
                mode: 'auto'
            }
        },
        [mcpDiscoverySection]: {
            type: 'object',
            properties: Object.fromEntries(allDiscoverySources.map(k => [k, { type: 'boolean', description: discoverySourceSettingsLabel[k] }])),
            additionalProperties: false,
            default: Object.fromEntries(allDiscoverySources.map(k => [k, false])),
            markdownDescription: nls.localize('mcp.discovery.enabled', "Configures discovery of Model Context Protocol servers from configuration from various other applications."),
        },
        [mcpGalleryServiceEnablementConfig]: {
            type: 'boolean',
            default: false,
            tags: ['preview'],
            description: nls.localize('chat.mcp.gallery.enabled', "Enables the default Marketplace for Model Context Protocol (MCP) servers."),
            included: product.quality === 'stable'
        },
        [mcpGalleryServiceUrlConfig]: {
            type: 'string',
            description: nls.localize('mcp.gallery.serviceUrl', "Configure the MCP Gallery service URL to connect to"),
            default: '',
            scope: 1 /* ConfigurationScope.APPLICATION */,
            tags: ['usesOnlineServices', 'advanced'],
            included: false,
            policy: {
                name: 'McpGalleryServiceUrl',
                category: PolicyCategory.InteractiveSession,
                minimumVersion: '1.101',
                value: (account) => account.mcpRegistryUrl,
                localization: {
                    description: {
                        key: 'mcp.gallery.serviceUrl',
                        value: nls.localize('mcp.gallery.serviceUrl', "Configure the MCP Gallery service URL to connect to"),
                    }
                }
            },
        },
        [PromptsConfig.INSTRUCTIONS_LOCATION_KEY]: {
            type: 'object',
            title: nls.localize('chat.instructions.config.locations.title', "Instructions File Locations"),
            markdownDescription: nls.localize('chat.instructions.config.locations.description', "Specify location(s) of instructions files (`*{0}`) that can be attached in Chat sessions. [Learn More]({1}).\n\nRelative paths are resolved from the root folder(s) of your workspace.", INSTRUCTION_FILE_EXTENSION, INSTRUCTIONS_DOCUMENTATION_URL),
            default: {
                [INSTRUCTIONS_DEFAULT_SOURCE_FOLDER]: true,
            },
            additionalProperties: { type: 'boolean' },
            restricted: true,
            tags: ['prompts', 'reusable prompts', 'prompt snippets', 'instructions'],
            examples: [
                {
                    [INSTRUCTIONS_DEFAULT_SOURCE_FOLDER]: true,
                },
                {
                    [INSTRUCTIONS_DEFAULT_SOURCE_FOLDER]: true,
                    '/Users/vscode/repos/instructions': true,
                },
            ],
        },
        [PromptsConfig.PROMPT_LOCATIONS_KEY]: {
            type: 'object',
            title: nls.localize('chat.reusablePrompts.config.locations.title', "Prompt File Locations"),
            markdownDescription: nls.localize('chat.reusablePrompts.config.locations.description', "Specify location(s) of reusable prompt files (`*{0}`) that can be run in Chat sessions. [Learn More]({1}).\n\nRelative paths are resolved from the root folder(s) of your workspace.", PROMPT_FILE_EXTENSION, PROMPT_DOCUMENTATION_URL),
            default: {
                [PROMPT_DEFAULT_SOURCE_FOLDER]: true,
            },
            additionalProperties: { type: 'boolean' },
            unevaluatedProperties: { type: 'boolean' },
            restricted: true,
            tags: ['prompts', 'reusable prompts', 'prompt snippets', 'instructions'],
            examples: [
                {
                    [PROMPT_DEFAULT_SOURCE_FOLDER]: true,
                },
                {
                    [PROMPT_DEFAULT_SOURCE_FOLDER]: true,
                    '/Users/vscode/repos/prompts': true,
                },
            ],
        },
        [PromptsConfig.MODE_LOCATION_KEY]: {
            type: 'object',
            title: nls.localize('chat.mode.config.locations.title', "Mode File Locations"),
            markdownDescription: nls.localize('chat.mode.config.locations.description', "Specify location(s) of custom chat mode files (`*{0}`). [Learn More]({1}).\n\nRelative paths are resolved from the root folder(s) of your workspace.", LEGACY_MODE_FILE_EXTENSION, AGENT_DOCUMENTATION_URL),
            default: {
                [LEGACY_MODE_DEFAULT_SOURCE_FOLDER]: true,
            },
            deprecationMessage: nls.localize('chat.mode.config.locations.deprecated', "This setting is deprecated and will be removed in future releases. Chat modes are now called custom agents and are located in `.github/agents`"),
            additionalProperties: { type: 'boolean' },
            unevaluatedProperties: { type: 'boolean' },
            restricted: true,
            tags: ['experimental', 'prompts', 'reusable prompts', 'prompt snippets', 'instructions'],
            examples: [
                {
                    [LEGACY_MODE_DEFAULT_SOURCE_FOLDER]: true,
                },
                {
                    [LEGACY_MODE_DEFAULT_SOURCE_FOLDER]: true,
                    '/Users/vscode/repos/chatmodes': true,
                },
            ],
        },
        [PromptsConfig.USE_AGENT_MD]: {
            type: 'boolean',
            title: nls.localize('chat.useAgentMd.title', "Use AGENTS.MD file"),
            markdownDescription: nls.localize('chat.useAgentMd.description', "Controls whether instructions from `AGENTS.MD` file found in a workspace roots are attached to all chat requests."),
            default: true,
            restricted: true,
            disallowConfigurationDefault: true,
            tags: ['prompts', 'reusable prompts', 'prompt snippets', 'instructions']
        },
        [PromptsConfig.USE_NESTED_AGENT_MD]: {
            type: 'boolean',
            title: nls.localize('chat.useNestedAgentMd.title', "Use nested AGENTS.MD files"),
            markdownDescription: nls.localize('chat.useNestedAgentMd.description', "Controls whether instructions from nested `AGENTS.MD` files found in the workspace are listed in all chat requests. The language model can load these skills on-demand if the `read` tool is available."),
            default: false,
            restricted: true,
            disallowConfigurationDefault: true,
            tags: ['experimental', 'prompts', 'reusable prompts', 'prompt snippets', 'instructions']
        },
        [PromptsConfig.USE_CLAUDE_SKILLS]: {
            type: 'boolean',
            title: nls.localize('chat.useClaudeSkills.title', "Use Claude skills"),
            markdownDescription: nls.localize('chat.useClaudeSkills.description', "Controls whether Claude skills found in the workspace and user home directories under `.claude/skills` are listed in all chat requests. The language model can load these skills on-demand if the `read` tool is available."),
            default: false,
            restricted: true,
            disallowConfigurationDefault: true,
            tags: ['experimental', 'prompts', 'reusable prompts', 'prompt snippets', 'instructions']
        },
        [PromptsConfig.PROMPT_FILES_SUGGEST_KEY]: {
            type: 'object',
            scope: 5 /* ConfigurationScope.RESOURCE */,
            title: nls.localize('chat.promptFilesRecommendations.title', "Prompt File Recommendations"),
            markdownDescription: nls.localize('chat.promptFilesRecommendations.description', "Configure which prompt files to recommend in the chat welcome view. Each key is a prompt file name, and the value can be `true` to always recommend, `false` to never recommend, or a [when clause](https://aka.ms/vscode-when-clause) expression like `resourceExtname == .js` or `resourceLangId == markdown`."),
            default: {},
            additionalProperties: {
                oneOf: [
                    { type: 'boolean' },
                    { type: 'string' }
                ]
            },
            tags: ['prompts', 'reusable prompts', 'prompt snippets', 'instructions'],
            examples: [
                {
                    'plan': true,
                    'a11y-audit': 'resourceExtname == .html',
                    'document': 'resourceLangId == markdown'
                }
            ],
        },
        [ChatConfiguration.TodosShowWidget]: {
            type: 'boolean',
            default: true,
            description: nls.localize('chat.tools.todos.showWidget', "Controls whether to show the todo list widget above the chat input. When enabled, the widget displays todo items created by the agent and updates as progress is made."),
            tags: ['experimental'],
            experiment: {
                mode: 'auto'
            }
        },
        'chat.todoListTool.writeOnly': {
            type: 'boolean',
            default: false,
            description: nls.localize('chat.todoListTool.writeOnly', "When enabled, the todo tool operates in write-only mode, requiring the agent to remember todos in context."),
            tags: ['experimental'],
            experiment: {
                mode: 'auto'
            }
        },
        'chat.todoListTool.descriptionField': {
            type: 'boolean',
            default: true,
            description: nls.localize('chat.todoListTool.descriptionField', "When enabled, todo items include detailed descriptions for implementation context. This provides more information but uses additional tokens and may slow down responses."),
            tags: ['experimental'],
            experiment: {
                mode: 'auto'
            }
        },
        [ChatConfiguration.ThinkingStyle]: {
            type: 'string',
            default: 'fixedScrolling',
            enum: ['collapsed', 'collapsedPreview', 'fixedScrolling'],
            enumDescriptions: [
                nls.localize('chat.agent.thinkingMode.collapsed', "Thinking parts will be collapsed by default."),
                nls.localize('chat.agent.thinkingMode.collapsedPreview', "Thinking parts will be expanded first, then collapse once we reach a part that is not thinking."),
                nls.localize('chat.agent.thinkingMode.fixedScrolling', "Show thinking in a fixed-height streaming panel that auto-scrolls; click header to expand to full height."),
            ],
            description: nls.localize('chat.agent.thinkingStyle', "Controls how thinking is rendered."),
            tags: ['experimental'],
        },
        'chat.agent.thinking.collapsedTools': {
            type: 'string',
            default: 'readOnly',
            enum: ['none', 'all', 'readOnly'],
            enumDescriptions: [
                nls.localize('chat.agent.thinking.collapsedTools.none', "No tool calls are added into the collapsible thinking section."),
                nls.localize('chat.agent.thinking.collapsedTools.all', "All tool calls are added into the collapsible thinking section."),
                nls.localize('chat.agent.thinking.collapsedTools.readOnly', "Only read-only tool calls are added into the collapsible thinking section."),
            ],
            markdownDescription: nls.localize('chat.agent.thinking.collapsedTools', "When enabled, tool calls are added into the collapsible thinking section according to the selected mode."),
            tags: ['experimental'],
        },
        'chat.disableAIFeatures': {
            type: 'boolean',
            description: nls.localize('chat.disableAIFeatures', "Disable and hide built-in AI features provided by GitHub Copilot, including chat and inline suggestions."),
            default: false,
            scope: 4 /* ConfigurationScope.WINDOW */
        },
        [ChatConfiguration.ShowAgentSessionsViewDescription]: {
            type: 'boolean',
            description: nls.localize('chat.showAgentSessionsViewDescription', "Controls whether session descriptions are displayed on a second row in the Chat Sessions view."),
            default: true,
        },
        'chat.allowAnonymousAccess': {
            type: 'boolean',
            description: nls.localize('chat.allowAnonymousAccess', "Controls whether anonymous access is allowed in chat."),
            default: false,
            tags: ['experimental'],
            experiment: {
                mode: 'auto'
            }
        },
        'chat.hideNewButtonInAgentSessionsView': {
            type: 'boolean',
            description: nls.localize('chat.hideNewButtonInAgentSessionsView', "Controls whether the new session button is hidden in the Agent Sessions view."),
            default: false,
            tags: ['preview']
        },
        'chat.signInWithAlternateScopes': {
            type: 'boolean',
            description: nls.localize('chat.signInWithAlternateScopes', "Controls whether sign-in with alternate scopes is used."),
            default: false,
            tags: ['experimental'],
            experiment: {
                mode: 'auto'
            }
        },
        'chat.extensionUnification.enabled': {
            type: 'boolean',
            description: nls.localize('chat.extensionUnification.enabled', "Enables the unification of GitHub Copilot extensions. When enabled, all GitHub Copilot functionality is served from the GitHub Copilot Chat extension. When disabled, the GitHub Copilot and GitHub Copilot Chat extensions operate independently."),
            default: true,
            tags: ['experimental'],
            experiment: {
                mode: 'auto'
            }
        },
        [ChatConfiguration.SubagentToolCustomAgents]: {
            type: 'boolean',
            description: nls.localize('chat.subagentTool.customAgents', "Whether the runSubagent tool is able to use custom agents. When enabled, the tool can take the name of a custom agent, but it must be given the exact name of the agent."),
            default: false,
            tags: ['experimental'],
        }
    }
});
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(ChatEditor, ChatEditorInput.EditorID, nls.localize('chat', "Chat")), [
    new SyncDescriptor(ChatEditorInput)
]);
Registry.as(Extensions.ConfigurationMigration).registerConfigurationMigrations([
    {
        key: 'chat.experimental.detectParticipant.enabled',
        migrateFn: (value, _accessor) => ([
            ['chat.experimental.detectParticipant.enabled', { value: undefined }],
            ['chat.detectParticipant.enabled', { value: value !== false }]
        ])
    },
    {
        key: mcpDiscoverySection,
        migrateFn: (value) => {
            if (typeof value === 'boolean') {
                return { value: Object.fromEntries(allDiscoverySources.map(k => [k, value])) };
            }
            return { value };
        }
    },
]);
let ChatResolverContribution = class ChatResolverContribution extends Disposable {
    static { this.ID = 'workbench.contrib.chatResolver'; }
    constructor(chatSessionsService, editorResolverService, instantiationService) {
        super();
        this.editorResolverService = editorResolverService;
        this.instantiationService = instantiationService;
        this._editorRegistrations = this._register(new DisposableMap());
        this._registerEditor(Schemas.vscodeChatEditor);
        this._registerEditor(Schemas.vscodeLocalChatSession);
        this._register(chatSessionsService.onDidChangeContentProviderSchemes((e) => {
            for (const scheme of e.added) {
                this._registerEditor(scheme);
            }
            for (const scheme of e.removed) {
                this._editorRegistrations.deleteAndDispose(scheme);
            }
        }));
        for (const scheme of chatSessionsService.getContentProviderSchemes()) {
            this._registerEditor(scheme);
        }
    }
    _registerEditor(scheme) {
        this._editorRegistrations.set(scheme, this.editorResolverService.registerEditor(`${scheme}:**/**`, {
            id: ChatEditorInput.EditorID,
            label: nls.localize('chat', "Chat"),
            priority: RegisteredEditorPriority.builtin
        }, {
            singlePerResource: true,
            canSupportResource: resource => resource.scheme === scheme,
        }, {
            createEditorInput: ({ resource, options }) => {
                return {
                    editor: this.instantiationService.createInstance(ChatEditorInput, resource, options),
                    options
                };
            }
        }));
    }
};
ChatResolverContribution = __decorate([
    __param(0, IChatSessionsService),
    __param(1, IEditorResolverService),
    __param(2, IInstantiationService)
], ChatResolverContribution);
let ChatAgentSettingContribution = class ChatAgentSettingContribution extends Disposable {
    static { this.ID = 'workbench.contrib.chatAgentSetting'; }
    constructor(experimentService, entitlementService) {
        super();
        this.experimentService = experimentService;
        this.entitlementService = entitlementService;
        this.registerMaxRequestsSetting();
    }
    registerMaxRequestsSetting() {
        let lastNode;
        const registerMaxRequestsSetting = () => {
            const treatmentId = this.entitlementService.entitlement === ChatEntitlement.Free ?
                'chatAgentMaxRequestsFree' :
                'chatAgentMaxRequestsPro';
            this.experimentService.getTreatment(treatmentId).then(value => {
                const defaultValue = value ?? (this.entitlementService.entitlement === ChatEntitlement.Free ? 25 : 25);
                const node = {
                    id: 'chatSidebar',
                    title: nls.localize('interactiveSessionConfigurationTitle', "Chat"),
                    type: 'object',
                    properties: {
                        'chat.agent.maxRequests': {
                            type: 'number',
                            markdownDescription: nls.localize('chat.agent.maxRequests', "The maximum number of requests to allow per-turn when using an agent. When the limit is reached, will ask to confirm to continue."),
                            default: defaultValue,
                        },
                    }
                };
                configurationRegistry.updateConfigurations({ remove: lastNode ? [lastNode] : [], add: [node] });
                lastNode = node;
            });
        };
        this._register(Event.runAndSubscribe(Event.debounce(this.entitlementService.onDidChangeEntitlement, () => { }, 1000), () => registerMaxRequestsSetting()));
    }
};
ChatAgentSettingContribution = __decorate([
    __param(0, IWorkbenchAssignmentService),
    __param(1, IChatEntitlementService)
], ChatAgentSettingContribution);
/**
 * Workbench contribution to register actions for custom chat modes via events
 */
let ChatAgentActionsContribution = class ChatAgentActionsContribution extends Disposable {
    static { this.ID = 'workbench.contrib.chatAgentActions'; }
    constructor(chatModeService) {
        super();
        this.chatModeService = chatModeService;
        this._modeActionDisposables = new DisposableMap();
        this._store.add(this._modeActionDisposables);
        // Register actions for existing custom modes
        const { custom } = this.chatModeService.getModes();
        for (const mode of custom) {
            this._registerModeAction(mode);
        }
        // Listen for custom mode changes by tracking snapshots
        this._register(this.chatModeService.onDidChangeChatModes(() => {
            const { custom } = this.chatModeService.getModes();
            const currentModeIds = new Set();
            // Register new modes
            for (const mode of custom) {
                currentModeIds.add(mode.id);
                if (!this._modeActionDisposables.has(mode.id)) {
                    this._registerModeAction(mode);
                }
            }
            // Remove modes that no longer exist
            for (const modeId of this._modeActionDisposables.keys()) {
                if (!currentModeIds.has(modeId)) {
                    this._modeActionDisposables.deleteAndDispose(modeId);
                }
            }
        }));
    }
    _registerModeAction(mode) {
        const actionClass = class extends ModeOpenChatGlobalAction {
            constructor() {
                super(mode);
            }
        };
        this._modeActionDisposables.set(mode.id, registerAction2(actionClass));
    }
};
ChatAgentActionsContribution = __decorate([
    __param(0, IChatModeService)
], ChatAgentActionsContribution);
let ToolReferenceNamesContribution = class ToolReferenceNamesContribution extends Disposable {
    static { this.ID = 'workbench.contrib.toolReferenceNames'; }
    constructor(_languageModelToolsService) {
        super();
        this._languageModelToolsService = _languageModelToolsService;
        this._updateToolReferenceNames();
        this._register(this._languageModelToolsService.onDidChangeTools(() => this._updateToolReferenceNames()));
    }
    _updateToolReferenceNames() {
        const tools = Array.from(this._languageModelToolsService.getTools())
            .filter((tool) => typeof tool.toolReferenceName === 'string')
            .sort((a, b) => a.toolReferenceName.localeCompare(b.toolReferenceName));
        toolReferenceNameEnumValues.length = 0;
        toolReferenceNameEnumDescriptions.length = 0;
        for (const tool of tools) {
            toolReferenceNameEnumValues.push(tool.toolReferenceName);
            toolReferenceNameEnumDescriptions.push(nls.localize('chat.toolReferenceName.description', "{0} - {1}", tool.toolReferenceName, tool.userDescription || tool.displayName));
        }
        configurationRegistry.notifyConfigurationSchemaUpdated({
            id: 'chatSidebar',
            properties: {
                [ChatConfiguration.EligibleForAutoApproval]: {}
            }
        });
    }
};
ToolReferenceNamesContribution = __decorate([
    __param(0, ILanguageModelToolsService)
], ToolReferenceNamesContribution);
AccessibleViewRegistry.register(new ChatTerminalOutputAccessibleView());
AccessibleViewRegistry.register(new ChatResponseAccessibleView());
AccessibleViewRegistry.register(new PanelChatAccessibilityHelp());
AccessibleViewRegistry.register(new QuickChatAccessibilityHelp());
AccessibleViewRegistry.register(new EditsChatAccessibilityHelp());
AccessibleViewRegistry.register(new AgentChatAccessibilityHelp());
registerEditorFeature(ChatInputBoxContentProvider);
let ChatSlashStaticSlashCommandsContribution = class ChatSlashStaticSlashCommandsContribution extends Disposable {
    static { this.ID = 'workbench.contrib.chatSlashStaticSlashCommands'; }
    constructor(slashCommandService, commandService, chatAgentService, chatWidgetService, instantiationService) {
        super();
        this._store.add(slashCommandService.registerSlashCommand({
            command: 'clear',
            detail: nls.localize('clear', "Start a new chat"),
            sortText: 'z2_clear',
            executeImmediately: true,
            locations: [ChatAgentLocation.Chat]
        }, async () => {
            commandService.executeCommand(ACTION_ID_NEW_CHAT);
        }));
        this._store.add(slashCommandService.registerSlashCommand({
            command: 'help',
            detail: '',
            sortText: 'z1_help',
            executeImmediately: true,
            locations: [ChatAgentLocation.Chat],
            modes: [ChatModeKind.Ask]
        }, async (prompt, progress, _history, _location, sessionResource) => {
            const defaultAgent = chatAgentService.getDefaultAgent(ChatAgentLocation.Chat);
            const agents = chatAgentService.getAgents();
            // Report prefix
            if (defaultAgent?.metadata.helpTextPrefix) {
                if (isMarkdownString(defaultAgent.metadata.helpTextPrefix)) {
                    progress.report({ content: defaultAgent.metadata.helpTextPrefix, kind: 'markdownContent' });
                }
                else {
                    progress.report({ content: new MarkdownString(defaultAgent.metadata.helpTextPrefix), kind: 'markdownContent' });
                }
                progress.report({ content: new MarkdownString('\n\n'), kind: 'markdownContent' });
            }
            // Report agent list
            const agentText = (await Promise.all(agents
                .filter(a => !a.isDefault && !a.isCore)
                .filter(a => a.locations.includes(ChatAgentLocation.Chat))
                .map(async (a) => {
                const description = a.description ? `- ${a.description}` : '';
                const agentMarkdown = instantiationService.invokeFunction(accessor => agentToMarkdown(a, sessionResource, true, accessor));
                const agentLine = `- ${agentMarkdown} ${description}`;
                const commandText = a.slashCommands.map(c => {
                    const description = c.description ? `- ${c.description}` : '';
                    return `\t* ${agentSlashCommandToMarkdown(a, c, sessionResource)} ${description}`;
                }).join('\n');
                return (agentLine + '\n' + commandText).trim();
            }))).join('\n');
            progress.report({ content: new MarkdownString(agentText, { isTrusted: { enabledCommands: [ChatSubmitAction.ID] } }), kind: 'markdownContent' });
            // Report help text ending
            if (defaultAgent?.metadata.helpTextPostfix) {
                progress.report({ content: new MarkdownString('\n\n'), kind: 'markdownContent' });
                if (isMarkdownString(defaultAgent.metadata.helpTextPostfix)) {
                    progress.report({ content: defaultAgent.metadata.helpTextPostfix, kind: 'markdownContent' });
                }
                else {
                    progress.report({ content: new MarkdownString(defaultAgent.metadata.helpTextPostfix), kind: 'markdownContent' });
                }
            }
            // Without this, the response will be done before it renders and so it will not stream. This ensures that if the response starts
            // rendering during the next 200ms, then it will be streamed. Once it starts streaming, the whole response streams even after
            // it has received all response data has been received.
            await timeout(200);
        }));
    }
};
ChatSlashStaticSlashCommandsContribution = __decorate([
    __param(0, IChatSlashCommandService),
    __param(1, ICommandService),
    __param(2, IChatAgentService),
    __param(3, IChatWidgetService),
    __param(4, IInstantiationService)
], ChatSlashStaticSlashCommandsContribution);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(ChatEditorInput.TypeID, ChatEditorInputSerializer);
registerWorkbenchContribution2(ChatResolverContribution.ID, ChatResolverContribution, 1 /* WorkbenchPhase.BlockStartup */);
registerWorkbenchContribution2(ChatSlashStaticSlashCommandsContribution.ID, ChatSlashStaticSlashCommandsContribution, 4 /* WorkbenchPhase.Eventually */);
registerWorkbenchContribution2(ChatExtensionPointHandler.ID, ChatExtensionPointHandler, 1 /* WorkbenchPhase.BlockStartup */);
registerWorkbenchContribution2(LanguageModelToolsExtensionPointHandler.ID, LanguageModelToolsExtensionPointHandler, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(ChatPromptFilesExtensionPointHandler.ID, ChatPromptFilesExtensionPointHandler, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(ChatCompatibilityNotifier.ID, ChatCompatibilityNotifier, 4 /* WorkbenchPhase.Eventually */);
registerWorkbenchContribution2(CopilotTitleBarMenuRendering.ID, CopilotTitleBarMenuRendering, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(CodeBlockActionRendering.ID, CodeBlockActionRendering, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(ContinueChatInSessionActionRendering.ID, ContinueChatInSessionActionRendering, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(ChatImplicitContextContribution.ID, ChatImplicitContextContribution, 4 /* WorkbenchPhase.Eventually */);
registerWorkbenchContribution2(ChatRelatedFilesContribution.ID, ChatRelatedFilesContribution, 4 /* WorkbenchPhase.Eventually */);
registerWorkbenchContribution2(ChatViewsWelcomeHandler.ID, ChatViewsWelcomeHandler, 1 /* WorkbenchPhase.BlockStartup */);
registerWorkbenchContribution2(ChatGettingStartedContribution.ID, ChatGettingStartedContribution, 4 /* WorkbenchPhase.Eventually */);
registerWorkbenchContribution2(ChatSetupContribution.ID, ChatSetupContribution, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(ChatTeardownContribution.ID, ChatTeardownContribution, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(ChatStatusBarEntry.ID, ChatStatusBarEntry, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(BuiltinToolsContribution.ID, BuiltinToolsContribution, 4 /* WorkbenchPhase.Eventually */);
registerWorkbenchContribution2(ChatAgentSettingContribution.ID, ChatAgentSettingContribution, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(ChatAgentActionsContribution.ID, ChatAgentActionsContribution, 4 /* WorkbenchPhase.Eventually */);
registerWorkbenchContribution2(ToolReferenceNamesContribution.ID, ToolReferenceNamesContribution, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(ChatEditingEditorAccessibility.ID, ChatEditingEditorAccessibility, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(ChatEditingEditorOverlay.ID, ChatEditingEditorOverlay, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(SimpleBrowserOverlay.ID, SimpleBrowserOverlay, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(ChatEditingEditorContextKeys.ID, ChatEditingEditorContextKeys, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(ChatTransferContribution.ID, ChatTransferContribution, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(ChatContextContributions.ID, ChatContextContributions, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(ChatResponseResourceFileSystemProvider.ID, ChatResponseResourceFileSystemProvider, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(PromptUrlHandler.ID, PromptUrlHandler, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(LocalChatSessionsProvider.ID, LocalChatSessionsProvider, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(ChatSessionsViewContrib.ID, ChatSessionsViewContrib, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(ChatSessionsView.ID, ChatSessionsView, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(ChatEditingNotebookFileSystemProviderContrib.ID, ChatEditingNotebookFileSystemProviderContrib, 1 /* WorkbenchPhase.BlockStartup */);
registerWorkbenchContribution2(UserToolSetsContributions.ID, UserToolSetsContributions, 4 /* WorkbenchPhase.Eventually */);
registerWorkbenchContribution2(PromptLanguageFeaturesProvider.ID, PromptLanguageFeaturesProvider, 4 /* WorkbenchPhase.Eventually */);
registerChatActions();
registerChatAccessibilityActions();
registerChatCopyActions();
registerChatCodeBlockActions();
registerChatCodeCompareBlockActions();
registerChatFileTreeActions();
registerChatPromptNavigationActions();
registerChatTitleActions();
registerChatExecuteActions();
registerQuickChatActions();
registerChatExportActions();
registerMoveActions();
registerNewChatActions();
registerChatContextActions();
registerChatDeveloperActions();
registerChatEditorActions();
registerChatElicitationActions();
registerChatToolActions();
registerLanguageModelActions();
registerEditorFeature(ChatPasteProvidersFeature);
registerSingleton(IChatTransferService, ChatTransferService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatService, ChatService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatWidgetService, ChatWidgetService, 1 /* InstantiationType.Delayed */);
registerSingleton(IQuickChatService, QuickChatService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatAccessibilityService, ChatAccessibilityService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatWidgetHistoryService, ChatWidgetHistoryService, 1 /* InstantiationType.Delayed */);
registerSingleton(ILanguageModelsService, LanguageModelsService, 1 /* InstantiationType.Delayed */);
registerSingleton(ILanguageModelStatsService, LanguageModelStatsService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatSlashCommandService, ChatSlashCommandService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatAgentService, ChatAgentService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatAgentNameService, ChatAgentNameService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatVariablesService, ChatVariablesService, 1 /* InstantiationType.Delayed */);
registerSingleton(ILanguageModelToolsService, LanguageModelToolsService, 1 /* InstantiationType.Delayed */);
registerSingleton(ILanguageModelToolsConfirmationService, LanguageModelToolsConfirmationService, 1 /* InstantiationType.Delayed */);
registerSingleton(IVoiceChatService, VoiceChatService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatCodeBlockContextProviderService, ChatCodeBlockContextProviderService, 1 /* InstantiationType.Delayed */);
registerSingleton(ICodeMapperService, CodeMapperService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatEditingService, ChatEditingService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatMarkdownAnchorService, ChatMarkdownAnchorService, 1 /* InstantiationType.Delayed */);
registerSingleton(ILanguageModelIgnoredFilesService, LanguageModelIgnoredFilesService, 1 /* InstantiationType.Delayed */);
registerSingleton(IPromptsService, PromptsService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatContextPickService, ChatContextPickService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatModeService, ChatModeService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatAttachmentResolveService, ChatAttachmentResolveService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatTodoListService, ChatTodoListService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatOutputRendererService, ChatOutputRendererService, 1 /* InstantiationType.Delayed */);
registerSingleton(IChatLayoutService, ChatLayoutService, 1 /* InstantiationType.Delayed */);
registerAction2(ConfigureToolSets);
registerAction2(RenameChatSessionAction);
registerAction2(DeleteChatSessionAction);
registerAction2(OpenChatSessionInNewWindowAction);
registerAction2(OpenChatSessionInNewEditorGroupAction);
registerAction2(OpenChatSessionInSidebarAction);
registerAction2(ToggleChatSessionsDescriptionDisplayAction);
registerAction2(ChatSessionsGettingStartedAction);
registerAction2(ToggleAgentSessionsViewLocationAction);
ChatWidget.CONTRIBS.push(ChatDynamicVariableModel);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC5jb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXQuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekQsT0FBTyxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQzFGLE9BQU8sRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDbkUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDcEYsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxzRUFBc0UsQ0FBQztBQUM5RyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDakYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxVQUFVLElBQUksdUJBQXVCLEVBQWtFLE1BQU0sb0VBQW9FLENBQUM7QUFDM0wsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzFGLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEVB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