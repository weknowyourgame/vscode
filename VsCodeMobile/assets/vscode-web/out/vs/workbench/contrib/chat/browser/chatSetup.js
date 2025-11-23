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
var SetupAgent_1, AINewSymbolNamesProvider_1, ChatCodeActionsProvider_1, ChatSetup_1, ChatTeardownContribution_1;
import './media/chatSetup.css';
import { $ } from '../../../../base/browser/dom.js';
import { Dialog, DialogContentsAlignment } from '../../../../base/browser/ui/dialog/dialog.js';
import { coalesce } from '../../../../base/common/arrays.js';
import { timeout } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { toErrorMessage } from '../../../../base/common/errorMessage.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { Disposable, DisposableStore, markAsSingleton, MutableDisposable } from '../../../../base/common/lifecycle.js';
import Severity from '../../../../base/common/severity.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';
import { equalsIgnoreCase } from '../../../../base/common/strings.js';
import { isObject } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { createWorkbenchDialogOptions } from '../../../../platform/dialogs/browser/dialog.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import product from '../../../../platform/product/common/product.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IWorkspaceTrustManagementService, IWorkspaceTrustRequestService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IActivityService, ProgressBadge } from '../../../services/activity/common/activity.js';
import { IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IWorkbenchExtensionEnablementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { ExtensionUrlHandlerOverrideRegistry } from '../../../services/extensions/browser/extensionUrlHandler.js';
import { IExtensionService, nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { ILanguageModelToolsService, ToolDataSource } from '../../chat/common/languageModelToolsService.js';
import { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';
import { IChatAgentService } from '../common/chatAgents.js';
import { ChatContextKeys } from '../common/chatContextKeys.js';
import { ChatEntitlement, ChatEntitlementRequests, IChatEntitlementService, isProUser } from '../../../services/chat/common/chatEntitlementService.js';
import { ChatRequestModel } from '../common/chatModel.js';
import { ChatMode, IChatModeService } from '../common/chatModes.js';
import { ChatRequestAgentPart, ChatRequestToolPart } from '../common/chatParserTypes.js';
import { IChatService } from '../common/chatService.js';
import { ChatAgentLocation, ChatConfiguration, ChatModeKind } from '../common/constants.js';
import { ILanguageModelsService } from '../common/languageModels.js';
import { CHAT_CATEGORY, CHAT_OPEN_ACTION_ID, CHAT_SETUP_ACTION_ID, CHAT_SETUP_SUPPORT_ANONYMOUS_ACTION_ID } from './actions/chatActions.js';
import { ChatViewId, IChatWidgetService } from './chat.js';
import { CHAT_SIDEBAR_PANEL_ID } from './chatViewPane.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { chatViewsWelcomeRegistry } from './viewsWelcome/chatViewsWelcome.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { Selection } from '../../../../editor/common/core/selection.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { CodeActionKind } from '../../../../editor/contrib/codeAction/common/types.js';
import { ACTION_START as INLINE_CHAT_START } from '../../inlineChat/common/inlineChat.js';
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { AGENT_SESSIONS_VIEW_CONTAINER_ID } from './agentSessions/agentSessions.js';
const defaultChat = {
    extensionId: product.defaultChatAgent?.extensionId ?? '',
    chatExtensionId: product.defaultChatAgent?.chatExtensionId ?? '',
    publicCodeMatchesUrl: product.defaultChatAgent?.publicCodeMatchesUrl ?? '',
    manageOveragesUrl: product.defaultChatAgent?.manageOverageUrl ?? '',
    upgradePlanUrl: product.defaultChatAgent?.upgradePlanUrl ?? '',
    provider: product.defaultChatAgent?.provider ?? { default: { id: '', name: '' }, enterprise: { id: '', name: '' }, apple: { id: '', name: '' }, google: { id: '', name: '' } },
    providerUriSetting: product.defaultChatAgent?.providerUriSetting ?? '',
    manageSettingsUrl: product.defaultChatAgent?.manageSettingsUrl ?? '',
    completionsAdvancedSetting: product.defaultChatAgent?.completionsAdvancedSetting ?? '',
    completionsRefreshTokenCommand: product.defaultChatAgent?.completionsRefreshTokenCommand ?? '',
    chatRefreshTokenCommand: product.defaultChatAgent?.chatRefreshTokenCommand ?? '',
    termsStatementUrl: product.defaultChatAgent?.termsStatementUrl ?? '',
    privacyStatementUrl: product.defaultChatAgent?.privacyStatementUrl ?? ''
};
var ChatSetupAnonymous;
(function (ChatSetupAnonymous) {
    ChatSetupAnonymous[ChatSetupAnonymous["Disabled"] = 0] = "Disabled";
    ChatSetupAnonymous[ChatSetupAnonymous["EnabledWithDialog"] = 1] = "EnabledWithDialog";
    ChatSetupAnonymous[ChatSetupAnonymous["EnabledWithoutDialog"] = 2] = "EnabledWithoutDialog";
})(ChatSetupAnonymous || (ChatSetupAnonymous = {}));
//#region Contribution
const ToolsAgentContextKey = ContextKeyExpr.and(ContextKeyExpr.equals(`config.${ChatConfiguration.AgentEnabled}`, true), ContextKeyExpr.not(`previewFeaturesDisabled`) // Set by extension
);
let SetupAgent = class SetupAgent extends Disposable {
    static { SetupAgent_1 = this; }
    static registerDefaultAgents(instantiationService, location, mode, context, controller) {
        return instantiationService.invokeFunction(accessor => {
            const chatAgentService = accessor.get(IChatAgentService);
            let id;
            let description = ChatMode.Ask.description.get();
            switch (location) {
                case ChatAgentLocation.Chat:
                    if (mode === ChatModeKind.Ask) {
                        id = 'setup.chat';
                    }
                    else if (mode === ChatModeKind.Edit) {
                        id = 'setup.edits';
                        description = ChatMode.Edit.description.get();
                    }
                    else {
                        id = 'setup.agent';
                        description = ChatMode.Agent.description.get();
                    }
                    break;
                case ChatAgentLocation.Terminal:
                    id = 'setup.terminal';
                    break;
                case ChatAgentLocation.EditorInline:
                    id = 'setup.editor';
                    break;
                case ChatAgentLocation.Notebook:
                    id = 'setup.notebook';
                    break;
            }
            return SetupAgent_1.doRegisterAgent(instantiationService, chatAgentService, id, `${defaultChat.provider.default.name} Copilot` /* Do NOT change, this hides the username altogether in Chat */, true, description, location, mode, context, controller);
        });
    }
    static registerBuiltInAgents(instantiationService, context, controller) {
        return instantiationService.invokeFunction(accessor => {
            const chatAgentService = accessor.get(IChatAgentService);
            const disposables = new DisposableStore();
            // Register VSCode agent
            const { disposable: vscodeDisposable } = SetupAgent_1.doRegisterAgent(instantiationService, chatAgentService, 'setup.vscode', 'vscode', false, localize2('vscodeAgentDescription', "Ask questions about VS Code").value, ChatAgentLocation.Chat, undefined, context, controller);
            disposables.add(vscodeDisposable);
            // Register workspace agent
            const { disposable: workspaceDisposable } = SetupAgent_1.doRegisterAgent(instantiationService, chatAgentService, 'setup.workspace', 'workspace', false, localize2('workspaceAgentDescription', "Ask about your workspace").value, ChatAgentLocation.Chat, undefined, context, controller);
            disposables.add(workspaceDisposable);
            // Register terminal agent
            const { disposable: terminalDisposable } = SetupAgent_1.doRegisterAgent(instantiationService, chatAgentService, 'setup.terminal.agent', 'terminal', false, localize2('terminalAgentDescription', "Ask how to do something in the terminal").value, ChatAgentLocation.Chat, undefined, context, controller);
            disposables.add(terminalDisposable);
            // Register tools
            disposables.add(SetupTool.registerTool(instantiationService, {
                id: 'setup_tools_createNewWorkspace',
                source: ToolDataSource.Internal,
                icon: Codicon.newFolder,
                displayName: localize('setupToolDisplayName', "New Workspace"),
                modelDescription: 'Scaffold a new workspace in VS Code',
                userDescription: localize('setupToolsDescription', "Scaffold a new workspace in VS Code"),
                canBeReferencedInPrompt: true,
                toolReferenceName: 'new',
                when: ContextKeyExpr.true(),
            }));
            return disposables;
        });
    }
    static doRegisterAgent(instantiationService, chatAgentService, id, name, isDefault, description, location, mode, context, controller) {
        const disposables = new DisposableStore();
        disposables.add(chatAgentService.registerAgent(id, {
            id,
            name,
            isDefault,
            isCore: true,
            modes: mode ? [mode] : [ChatModeKind.Ask],
            when: mode === ChatModeKind.Agent ? ToolsAgentContextKey?.serialize() : undefined,
            slashCommands: [],
            disambiguation: [],
            locations: [location],
            metadata: { helpTextPrefix: SetupAgent_1.SETUP_NEEDED_MESSAGE },
            description,
            extensionId: nullExtensionDescription.identifier,
            extensionVersion: undefined,
            extensionDisplayName: nullExtensionDescription.name,
            extensionPublisherId: nullExtensionDescription.publisher
        }));
        const agent = disposables.add(instantiationService.createInstance(SetupAgent_1, context, controller, location));
        disposables.add(chatAgentService.registerAgentImplementation(id, agent));
        if (mode === ChatModeKind.Agent) {
            chatAgentService.updateAgent(id, { themeIcon: Codicon.tools });
        }
        return { agent, disposable: disposables };
    }
    static { this.SETUP_NEEDED_MESSAGE = new MarkdownString(localize('settingUpCopilotNeeded', "You need to set up GitHub Copilot and be signed in to use Chat.")); }
    static { this.TRUST_NEEDED_MESSAGE = new MarkdownString(localize('trustNeeded', "You need to trust this workspace to use Chat.")); }
    constructor(context, controller, location, instantiationService, logService, configurationService, telemetryService, environmentService, workspaceTrustManagementService, chatEntitlementService) {
        super();
        this.context = context;
        this.controller = controller;
        this.location = location;
        this.instantiationService = instantiationService;
        this.logService = logService;
        this.configurationService = configurationService;
        this.telemetryService = telemetryService;
        this.environmentService = environmentService;
        this.workspaceTrustManagementService = workspaceTrustManagementService;
        this.chatEntitlementService = chatEntitlementService;
        this._onUnresolvableError = this._register(new Emitter());
        this.onUnresolvableError = this._onUnresolvableError.event;
        this.pendingForwardedRequests = new ResourceMap();
    }
    async invoke(request, progress) {
        return this.instantiationService.invokeFunction(async (accessor /* using accessor for lazy loading */) => {
            const chatService = accessor.get(IChatService);
            const languageModelsService = accessor.get(ILanguageModelsService);
            const chatWidgetService = accessor.get(IChatWidgetService);
            const chatAgentService = accessor.get(IChatAgentService);
            const languageModelToolsService = accessor.get(ILanguageModelToolsService);
            return this.doInvoke(request, part => progress([part]), chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService);
        });
    }
    async doInvoke(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService) {
        if (!this.context.state.installed || // Extension not installed: run setup to install
            this.context.state.disabled || // Extension disabled: run setup to enable
            this.context.state.untrusted || // Workspace untrusted: run setup to ask for trust
            this.context.state.entitlement === ChatEntitlement.Available || // Entitlement available: run setup to sign up
            (this.context.state.entitlement === ChatEntitlement.Unknown && // Entitlement unknown: run setup to sign in / sign up
                !this.chatEntitlementService.anonymous // unless anonymous access is enabled
            )) {
            return this.doInvokeWithSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService);
        }
        return this.doInvokeWithoutSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService);
    }
    async doInvokeWithoutSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService) {
        const requestModel = chatWidgetService.getWidgetBySessionResource(request.sessionResource)?.viewModel?.model.getRequests().at(-1);
        if (!requestModel) {
            this.logService.error('[chat setup] Request model not found, cannot redispatch request.');
            return {}; // this should not happen
        }
        progress({
            kind: 'progressMessage',
            content: new MarkdownString(localize('waitingChat', "Getting chat ready...")),
        });
        await this.forwardRequestToChat(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService);
        return {};
    }
    async forwardRequestToChat(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService) {
        try {
            await this.doForwardRequestToChat(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService);
        }
        catch (error) {
            progress({
                kind: 'warning',
                content: new MarkdownString(localize('copilotUnavailableWarning', "Failed to get a response. Please try again."))
            });
        }
    }
    async doForwardRequestToChat(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService) {
        if (this.pendingForwardedRequests.has(requestModel.session.sessionResource)) {
            throw new Error('Request already in progress');
        }
        const forwardRequest = this.doForwardRequestToChatWhenReady(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService);
        this.pendingForwardedRequests.set(requestModel.session.sessionResource, forwardRequest);
        try {
            await forwardRequest;
        }
        finally {
            this.pendingForwardedRequests.delete(requestModel.session.sessionResource);
        }
    }
    async doForwardRequestToChatWhenReady(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService) {
        const widget = chatWidgetService.getWidgetBySessionResource(requestModel.session.sessionResource);
        const modeInfo = widget?.input.currentModeInfo;
        // We need a signal to know when we can resend the request to
        // Chat. Waiting for the registration of the agent is not
        // enough, we also need a language/tools model to be available.
        let agentReady = false;
        let languageModelReady = false;
        let toolsModelReady = false;
        const whenAgentReady = this.whenAgentReady(chatAgentService, modeInfo?.kind)?.then(() => agentReady = true);
        const whenLanguageModelReady = this.whenLanguageModelReady(languageModelsService, requestModel.modelId)?.then(() => languageModelReady = true);
        const whenToolsModelReady = this.whenToolsModelReady(languageModelToolsService, requestModel)?.then(() => toolsModelReady = true);
        if (whenLanguageModelReady instanceof Promise || whenAgentReady instanceof Promise || whenToolsModelReady instanceof Promise) {
            const timeoutHandle = setTimeout(() => {
                progress({
                    kind: 'progressMessage',
                    content: new MarkdownString(localize('waitingChat2', "Chat is almost ready...")),
                });
            }, 10000);
            try {
                const ready = await Promise.race([
                    timeout(this.environmentService.remoteAuthority ? 60000 /* increase for remote scenarios */ : 20000).then(() => 'timedout'),
                    this.whenDefaultAgentActivated(chatService),
                    Promise.allSettled([whenLanguageModelReady, whenAgentReady, whenToolsModelReady])
                ]);
                if (ready === 'timedout') {
                    let warningMessage;
                    if (this.chatEntitlementService.anonymous) {
                        warningMessage = localize('chatTookLongWarningAnonymous', "Chat took too long to get ready. Please ensure that the extension `{0}` is installed and enabled.", defaultChat.chatExtensionId);
                    }
                    else {
                        warningMessage = localize('chatTookLongWarning', "Chat took too long to get ready. Please ensure you are signed in to {0} and that the extension `{1}` is installed and enabled.", defaultChat.provider.default.name, defaultChat.chatExtensionId);
                    }
                    this.logService.warn(warningMessage, {
                        agentReady: whenAgentReady ? agentReady : undefined,
                        languageModelReady: whenLanguageModelReady ? languageModelReady : undefined,
                        toolsModelReady: whenToolsModelReady ? toolsModelReady : undefined
                    });
                    progress({
                        kind: 'warning',
                        content: new MarkdownString(warningMessage)
                    });
                    // This means Chat is unhealthy and we cannot retry the
                    // request. Signal this to the outside via an event.
                    this._onUnresolvableError.fire();
                    return;
                }
            }
            finally {
                clearTimeout(timeoutHandle);
            }
        }
        await chatService.resendRequest(requestModel, {
            ...widget?.getModeRequestOptions(),
            modeInfo,
            userSelectedModelId: widget?.input.currentLanguageModel
        });
    }
    whenLanguageModelReady(languageModelsService, modelId) {
        const hasModelForRequest = () => {
            if (modelId) {
                return !!languageModelsService.lookupLanguageModel(modelId);
            }
            for (const id of languageModelsService.getLanguageModelIds()) {
                const model = languageModelsService.lookupLanguageModel(id);
                if (model?.isDefault) {
                    return true;
                }
            }
            return false;
        };
        if (hasModelForRequest()) {
            return;
        }
        return Event.toPromise(Event.filter(languageModelsService.onDidChangeLanguageModels, () => hasModelForRequest()));
    }
    whenToolsModelReady(languageModelToolsService, requestModel) {
        const needsToolsModel = requestModel.message.parts.some(part => part instanceof ChatRequestToolPart);
        if (!needsToolsModel) {
            return; // No tools in this request, no need to check
        }
        // check that tools other than setup. and internal tools are registered.
        for (const tool of languageModelToolsService.getTools()) {
            if (tool.id.startsWith('copilot_')) {
                return; // we have tools!
            }
        }
        return Event.toPromise(Event.filter(languageModelToolsService.onDidChangeTools, () => {
            for (const tool of languageModelToolsService.getTools()) {
                if (tool.id.startsWith('copilot_')) {
                    return true; // we have tools!
                }
            }
            return false; // no external tools found
        }));
    }
    whenAgentReady(chatAgentService, mode) {
        const defaultAgent = chatAgentService.getDefaultAgent(this.location, mode);
        if (defaultAgent && !defaultAgent.isCore) {
            return; // we have a default agent from an extension!
        }
        return Event.toPromise(Event.filter(chatAgentService.onDidChangeAgents, () => {
            const defaultAgent = chatAgentService.getDefaultAgent(this.location, mode);
            return Boolean(defaultAgent && !defaultAgent.isCore);
        }));
    }
    async whenDefaultAgentActivated(chatService) {
        try {
            await chatService.activateDefaultAgent(this.location);
        }
        catch (error) {
            this.logService.error(error);
        }
    }
    async doInvokeWithSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService) {
        this.telemetryService.publicLog2('workbenchActionExecuted', { id: CHAT_SETUP_ACTION_ID, from: 'chat' });
        const widget = chatWidgetService.getWidgetBySessionResource(request.sessionResource);
        const requestModel = widget?.viewModel?.model.getRequests().at(-1);
        const setupListener = Event.runAndSubscribe(this.controller.value.onDidChange, (() => {
            switch (this.controller.value.step) {
                case ChatSetupStep.SigningIn:
                    progress({
                        kind: 'progressMessage',
                        content: new MarkdownString(localize('setupChatSignIn2', "Signing in to {0}...", ChatEntitlementRequests.providerId(this.configurationService) === defaultChat.provider.enterprise.id ? defaultChat.provider.enterprise.name : defaultChat.provider.default.name)),
                    });
                    break;
                case ChatSetupStep.Installing:
                    progress({
                        kind: 'progressMessage',
                        content: new MarkdownString(localize('installingChat', "Getting chat ready...")),
                    });
                    break;
            }
        }));
        let result = undefined;
        try {
            result = await ChatSetup.getInstance(this.instantiationService, this.context, this.controller).run({
                disableChatViewReveal: true, // we are already in a chat context
                forceAnonymous: this.chatEntitlementService.anonymous ? ChatSetupAnonymous.EnabledWithoutDialog : undefined // only enable anonymous selectively
            });
        }
        catch (error) {
            this.logService.error(`[chat setup] Error during setup: ${toErrorMessage(error)}`);
        }
        finally {
            setupListener.dispose();
        }
        // User has agreed to run the setup
        if (typeof result?.success === 'boolean') {
            if (result.success) {
                if (result.dialogSkipped) {
                    await widget?.clear(); // make room for the Chat welcome experience
                }
                else if (requestModel) {
                    let newRequest = this.replaceAgentInRequestModel(requestModel, chatAgentService); // Replace agent part with the actual Chat agent...
                    newRequest = this.replaceToolInRequestModel(newRequest); // ...then replace any tool parts with the actual Chat tools
                    await this.forwardRequestToChat(newRequest, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService);
                }
            }
            else {
                progress({
                    kind: 'warning',
                    content: new MarkdownString(localize('chatSetupError', "Chat setup failed."))
                });
            }
        }
        // User has cancelled the setup
        else {
            progress({
                kind: 'markdownContent',
                content: this.workspaceTrustManagementService.isWorkspaceTrusted() ? SetupAgent_1.SETUP_NEEDED_MESSAGE : SetupAgent_1.TRUST_NEEDED_MESSAGE
            });
        }
        return {};
    }
    replaceAgentInRequestModel(requestModel, chatAgentService) {
        const agentPart = requestModel.message.parts.find((r) => r instanceof ChatRequestAgentPart);
        if (!agentPart) {
            return requestModel;
        }
        const agentId = agentPart.agent.id.replace(/setup\./, `${defaultChat.extensionId}.`.toLowerCase());
        const githubAgent = chatAgentService.getAgent(agentId);
        if (!githubAgent) {
            return requestModel;
        }
        const newAgentPart = new ChatRequestAgentPart(agentPart.range, agentPart.editorRange, githubAgent);
        return new ChatRequestModel({
            session: requestModel.session,
            message: {
                parts: requestModel.message.parts.map(part => {
                    if (part instanceof ChatRequestAgentPart) {
                        return newAgentPart;
                    }
                    return part;
                }),
                text: requestModel.message.text
            },
            variableData: requestModel.variableData,
            timestamp: Date.now(),
            attempt: requestModel.attempt,
            modeInfo: requestModel.modeInfo,
            confirmation: requestModel.confirmation,
            locationData: requestModel.locationData,
            attachedContext: requestModel.attachedContext,
            isCompleteAddedRequest: requestModel.isCompleteAddedRequest,
        });
    }
    replaceToolInRequestModel(requestModel) {
        const toolPart = requestModel.message.parts.find((r) => r instanceof ChatRequestToolPart);
        if (!toolPart) {
            return requestModel;
        }
        const toolId = toolPart.toolId.replace(/setup.tools\./, `copilot_`.toLowerCase());
        const newToolPart = new ChatRequestToolPart(toolPart.range, toolPart.editorRange, toolPart.toolName, toolId, toolPart.displayName, toolPart.icon);
        const chatRequestToolEntry = {
            id: toolId,
            name: 'new',
            range: toolPart.range,
            kind: 'tool',
            value: undefined
        };
        const variableData = {
            variables: [chatRequestToolEntry]
        };
        return new ChatRequestModel({
            session: requestModel.session,
            message: {
                parts: requestModel.message.parts.map(part => {
                    if (part instanceof ChatRequestToolPart) {
                        return newToolPart;
                    }
                    return part;
                }),
                text: requestModel.message.text
            },
            variableData: variableData,
            timestamp: Date.now(),
            attempt: requestModel.attempt,
            modeInfo: requestModel.modeInfo,
            confirmation: requestModel.confirmation,
            locationData: requestModel.locationData,
            attachedContext: [chatRequestToolEntry],
            isCompleteAddedRequest: requestModel.isCompleteAddedRequest,
        });
    }
};
SetupAgent = SetupAgent_1 = __decorate([
    __param(3, IInstantiationService),
    __param(4, ILogService),
    __param(5, IConfigurationService),
    __param(6, ITelemetryService),
    __param(7, IWorkbenchEnvironmentService),
    __param(8, IWorkspaceTrustManagementService),
    __param(9, IChatEntitlementService)
], SetupAgent);
class SetupTool {
    static registerTool(instantiationService, toolData) {
        return instantiationService.invokeFunction(accessor => {
            const toolService = accessor.get(ILanguageModelToolsService);
            const tool = instantiationService.createInstance(SetupTool);
            return toolService.registerTool(toolData, tool);
        });
    }
    async invoke(invocation, countTokens, progress, token) {
        const result = {
            content: [
                {
                    kind: 'text',
                    value: ''
                }
            ]
        };
        return result;
    }
    async prepareToolInvocation(parameters, token) {
        return undefined;
    }
}
let AINewSymbolNamesProvider = AINewSymbolNamesProvider_1 = class AINewSymbolNamesProvider {
    static registerProvider(instantiationService, context, controller) {
        return instantiationService.invokeFunction(accessor => {
            const languageFeaturesService = accessor.get(ILanguageFeaturesService);
            const provider = instantiationService.createInstance(AINewSymbolNamesProvider_1, context, controller);
            return languageFeaturesService.newSymbolNamesProvider.register('*', provider);
        });
    }
    constructor(context, controller, instantiationService, chatEntitlementService) {
        this.context = context;
        this.controller = controller;
        this.instantiationService = instantiationService;
        this.chatEntitlementService = chatEntitlementService;
    }
    async provideNewSymbolNames(model, range, triggerKind, token) {
        await this.instantiationService.invokeFunction(accessor => {
            return ChatSetup.getInstance(this.instantiationService, this.context, this.controller).run({
                forceAnonymous: this.chatEntitlementService.anonymous ? ChatSetupAnonymous.EnabledWithDialog : undefined
            });
        });
        return [];
    }
};
AINewSymbolNamesProvider = AINewSymbolNamesProvider_1 = __decorate([
    __param(2, IInstantiationService),
    __param(3, IChatEntitlementService)
], AINewSymbolNamesProvider);
let ChatCodeActionsProvider = ChatCodeActionsProvider_1 = class ChatCodeActionsProvider {
    static registerProvider(instantiationService) {
        return instantiationService.invokeFunction(accessor => {
            const languageFeaturesService = accessor.get(ILanguageFeaturesService);
            const provider = instantiationService.createInstance(ChatCodeActionsProvider_1);
            return languageFeaturesService.codeActionProvider.register('*', provider);
        });
    }
    constructor(markerService) {
        this.markerService = markerService;
    }
    async provideCodeActions(model, range) {
        const actions = [];
        // "Generate" if the line is whitespace only
        // "Modify" if there is a selection
        let generateOrModifyTitle;
        let generateOrModifyCommand;
        if (range.isEmpty()) {
            const textAtLine = model.getLineContent(range.startLineNumber);
            if (/^\s*$/.test(textAtLine)) {
                generateOrModifyTitle = localize('generate', "Generate");
                generateOrModifyCommand = AICodeActionsHelper.generate(range);
            }
        }
        else {
            const textInSelection = model.getValueInRange(range);
            if (!/^\s*$/.test(textInSelection)) {
                generateOrModifyTitle = localize('modify', "Modify");
                generateOrModifyCommand = AICodeActionsHelper.modify(range);
            }
        }
        if (generateOrModifyTitle && generateOrModifyCommand) {
            actions.push({
                kind: CodeActionKind.RefactorRewrite.append('copilot').value,
                isAI: true,
                title: generateOrModifyTitle,
                command: generateOrModifyCommand,
            });
        }
        const markers = AICodeActionsHelper.warningOrErrorMarkersAtRange(this.markerService, model.uri, range);
        if (markers.length > 0) {
            // "Fix" if there are diagnostics in the range
            actions.push({
                kind: CodeActionKind.QuickFix.append('copilot').value,
                isAI: true,
                diagnostics: markers,
                title: localize('fix', "Fix"),
                command: AICodeActionsHelper.fixMarkers(markers, range)
            });
            // "Explain" if there are diagnostics in the range
            actions.push({
                kind: CodeActionKind.QuickFix.append('explain').append('copilot').value,
                isAI: true,
                diagnostics: markers,
                title: localize('explain', "Explain"),
                command: AICodeActionsHelper.explainMarkers(markers)
            });
        }
        return {
            actions,
            dispose() { }
        };
    }
};
ChatCodeActionsProvider = ChatCodeActionsProvider_1 = __decorate([
    __param(0, IMarkerService)
], ChatCodeActionsProvider);
class AICodeActionsHelper {
    static warningOrErrorMarkersAtRange(markerService, resource, range) {
        return markerService
            .read({ resource, severities: MarkerSeverity.Error | MarkerSeverity.Warning })
            .filter(marker => range.startLineNumber <= marker.endLineNumber && range.endLineNumber >= marker.startLineNumber);
    }
    static modify(range) {
        return {
            id: INLINE_CHAT_START,
            title: localize('modify', "Modify"),
            arguments: [
                {
                    initialSelection: this.rangeToSelection(range),
                    initialRange: range,
                    position: range.getStartPosition()
                }
            ]
        };
    }
    static generate(range) {
        return {
            id: INLINE_CHAT_START,
            title: localize('generate', "Generate"),
            arguments: [
                {
                    initialSelection: this.rangeToSelection(range),
                    initialRange: range,
                    position: range.getStartPosition()
                }
            ]
        };
    }
    static rangeToSelection(range) {
        return new Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
    }
    static explainMarkers(markers) {
        return {
            id: CHAT_OPEN_ACTION_ID,
            title: localize('explain', "Explain"),
            arguments: [
                {
                    query: `@workspace /explain ${markers.map(marker => marker.message).join(', ')}`
                }
            ]
        };
    }
    static fixMarkers(markers, range) {
        return {
            id: INLINE_CHAT_START,
            title: localize('fix', "Fix"),
            arguments: [
                {
                    message: `/fix ${markers.map(marker => marker.message).join(', ')}`,
                    autoSend: true,
                    initialSelection: this.rangeToSelection(range),
                    initialRange: range,
                    position: range.getStartPosition()
                }
            ]
        };
    }
}
var ChatSetupStrategy;
(function (ChatSetupStrategy) {
    ChatSetupStrategy[ChatSetupStrategy["Canceled"] = 0] = "Canceled";
    ChatSetupStrategy[ChatSetupStrategy["DefaultSetup"] = 1] = "DefaultSetup";
    ChatSetupStrategy[ChatSetupStrategy["SetupWithoutEnterpriseProvider"] = 2] = "SetupWithoutEnterpriseProvider";
    ChatSetupStrategy[ChatSetupStrategy["SetupWithEnterpriseProvider"] = 3] = "SetupWithEnterpriseProvider";
    ChatSetupStrategy[ChatSetupStrategy["SetupWithGoogleProvider"] = 4] = "SetupWithGoogleProvider";
    ChatSetupStrategy[ChatSetupStrategy["SetupWithAppleProvider"] = 5] = "SetupWithAppleProvider";
})(ChatSetupStrategy || (ChatSetupStrategy = {}));
let ChatSetup = class ChatSetup {
    static { ChatSetup_1 = this; }
    static { this.instance = undefined; }
    static getInstance(instantiationService, context, controller) {
        let instance = ChatSetup_1.instance;
        if (!instance) {
            instance = ChatSetup_1.instance = instantiationService.invokeFunction(accessor => {
                return new ChatSetup_1(context, controller, accessor.get(ITelemetryService), accessor.get(IWorkbenchLayoutService), accessor.get(IKeybindingService), accessor.get(IChatEntitlementService), accessor.get(ILogService), accessor.get(IConfigurationService), accessor.get(IChatWidgetService), accessor.get(IWorkspaceTrustRequestService), accessor.get(IMarkdownRendererService));
            });
        }
        return instance;
    }
    constructor(context, controller, telemetryService, layoutService, keybindingService, chatEntitlementService, logService, configurationService, widgetService, workspaceTrustRequestService, markdownRendererService) {
        this.context = context;
        this.controller = controller;
        this.telemetryService = telemetryService;
        this.layoutService = layoutService;
        this.keybindingService = keybindingService;
        this.chatEntitlementService = chatEntitlementService;
        this.logService = logService;
        this.configurationService = configurationService;
        this.widgetService = widgetService;
        this.workspaceTrustRequestService = workspaceTrustRequestService;
        this.markdownRendererService = markdownRendererService;
        this.pendingRun = undefined;
        this.skipDialogOnce = false;
    }
    skipDialog() {
        this.skipDialogOnce = true;
    }
    async run(options) {
        if (this.pendingRun) {
            return this.pendingRun;
        }
        this.pendingRun = this.doRun(options);
        try {
            return await this.pendingRun;
        }
        finally {
            this.pendingRun = undefined;
        }
    }
    async doRun(options) {
        this.context.update({ later: false });
        const dialogSkipped = this.skipDialogOnce;
        this.skipDialogOnce = false;
        const trusted = await this.workspaceTrustRequestService.requestWorkspaceTrust({
            message: localize('chatWorkspaceTrust', "AI features are currently only supported in trusted workspaces.")
        });
        if (!trusted) {
            this.context.update({ later: true });
            this.telemetryService.publicLog2('commandCenter.chatInstall', { installResult: 'failedNotTrusted', installDuration: 0, signUpErrorCode: undefined, provider: undefined });
            return { dialogSkipped, success: undefined /* canceled */ };
        }
        let setupStrategy;
        if (!options?.forceSignInDialog && (dialogSkipped || isProUser(this.chatEntitlementService.entitlement) || this.chatEntitlementService.entitlement === ChatEntitlement.Free)) {
            setupStrategy = ChatSetupStrategy.DefaultSetup; // existing pro/free users setup without a dialog
        }
        else if (options?.forceAnonymous === ChatSetupAnonymous.EnabledWithoutDialog) {
            setupStrategy = ChatSetupStrategy.DefaultSetup; // anonymous setup without a dialog
        }
        else {
            setupStrategy = await this.showDialog(options);
        }
        if (setupStrategy === ChatSetupStrategy.DefaultSetup && ChatEntitlementRequests.providerId(this.configurationService) === defaultChat.provider.enterprise.id) {
            setupStrategy = ChatSetupStrategy.SetupWithEnterpriseProvider; // users with a configured provider go through provider setup
        }
        if (setupStrategy !== ChatSetupStrategy.Canceled && !options?.disableChatViewReveal) {
            // Show the chat view now to better indicate progress
            // while installing the extension or returning from sign in
            this.widgetService.revealWidget();
        }
        let success = undefined;
        try {
            switch (setupStrategy) {
                case ChatSetupStrategy.SetupWithEnterpriseProvider:
                    success = await this.controller.value.setupWithProvider({ useEnterpriseProvider: true, useSocialProvider: undefined, additionalScopes: options?.additionalScopes, forceAnonymous: options?.forceAnonymous });
                    break;
                case ChatSetupStrategy.SetupWithoutEnterpriseProvider:
                    success = await this.controller.value.setupWithProvider({ useEnterpriseProvider: false, useSocialProvider: undefined, additionalScopes: options?.additionalScopes, forceAnonymous: options?.forceAnonymous });
                    break;
                case ChatSetupStrategy.SetupWithAppleProvider:
                    success = await this.controller.value.setupWithProvider({ useEnterpriseProvider: false, useSocialProvider: 'apple', additionalScopes: options?.additionalScopes, forceAnonymous: options?.forceAnonymous });
                    break;
                case ChatSetupStrategy.SetupWithGoogleProvider:
                    success = await this.controller.value.setupWithProvider({ useEnterpriseProvider: false, useSocialProvider: 'google', additionalScopes: options?.additionalScopes, forceAnonymous: options?.forceAnonymous });
                    break;
                case ChatSetupStrategy.DefaultSetup:
                    success = await this.controller.value.setup({ ...options, forceAnonymous: options?.forceAnonymous });
                    break;
                case ChatSetupStrategy.Canceled:
                    this.context.update({ later: true });
                    this.telemetryService.publicLog2('commandCenter.chatInstall', { installResult: 'failedMaybeLater', installDuration: 0, signUpErrorCode: undefined, provider: undefined });
                    break;
            }
        }
        catch (error) {
            this.logService.error(`[chat setup] Error during setup: ${toErrorMessage(error)}`);
            success = false;
        }
        return { success, dialogSkipped };
    }
    async showDialog(options) {
        const disposables = new DisposableStore();
        const buttons = this.getButtons(options);
        const dialog = disposables.add(new Dialog(this.layoutService.activeContainer, this.getDialogTitle(options), buttons.map(button => button[0]), createWorkbenchDialogOptions({
            type: 'none',
            extraClasses: ['chat-setup-dialog'],
            detail: ' ', // workaround allowing us to render the message in large
            icon: Codicon.copilotLarge,
            alignment: DialogContentsAlignment.Vertical,
            cancelId: buttons.length - 1,
            disableCloseButton: true,
            renderFooter: footer => footer.appendChild(this.createDialogFooter(disposables, options)),
            buttonOptions: buttons.map(button => button[2])
        }, this.keybindingService, this.layoutService)));
        const { button } = await dialog.show();
        disposables.dispose();
        return buttons[button]?.[1] ?? ChatSetupStrategy.Canceled;
    }
    getButtons(options) {
        const styleButton = (...classes) => ({ styleButton: (button) => button.element.classList.add(...classes) });
        let buttons;
        if (!options?.forceAnonymous && (this.context.state.entitlement === ChatEntitlement.Unknown || options?.forceSignInDialog)) {
            const defaultProviderButton = [localize('continueWith', "Continue with {0}", defaultChat.provider.default.name), ChatSetupStrategy.SetupWithoutEnterpriseProvider, styleButton('continue-button', 'default')];
            const defaultProviderLink = [defaultProviderButton[0], defaultProviderButton[1], styleButton('link-button')];
            const enterpriseProviderButton = [localize('continueWith', "Continue with {0}", defaultChat.provider.enterprise.name), ChatSetupStrategy.SetupWithEnterpriseProvider, styleButton('continue-button', 'default')];
            const enterpriseProviderLink = [enterpriseProviderButton[0], enterpriseProviderButton[1], styleButton('link-button')];
            const googleProviderButton = [localize('continueWith', "Continue with {0}", defaultChat.provider.google.name), ChatSetupStrategy.SetupWithGoogleProvider, styleButton('continue-button', 'google')];
            const appleProviderButton = [localize('continueWith', "Continue with {0}", defaultChat.provider.apple.name), ChatSetupStrategy.SetupWithAppleProvider, styleButton('continue-button', 'apple')];
            if (ChatEntitlementRequests.providerId(this.configurationService) !== defaultChat.provider.enterprise.id) {
                buttons = coalesce([
                    defaultProviderButton,
                    googleProviderButton,
                    appleProviderButton,
                    enterpriseProviderLink
                ]);
            }
            else {
                buttons = coalesce([
                    enterpriseProviderButton,
                    googleProviderButton,
                    appleProviderButton,
                    defaultProviderLink
                ]);
            }
        }
        else {
            buttons = [[localize('setupAIButton', "Use AI Features"), ChatSetupStrategy.DefaultSetup, undefined]];
        }
        buttons.push([localize('skipForNow', "Skip for now"), ChatSetupStrategy.Canceled, styleButton('link-button', 'skip-button')]);
        return buttons;
    }
    getDialogTitle(options) {
        if (this.chatEntitlementService.anonymous) {
            if (options?.forceAnonymous) {
                return localize('startUsing', "Start using AI Features");
            }
            else {
                return localize('enableMore', "Enable more AI features");
            }
        }
        if (this.context.state.entitlement === ChatEntitlement.Unknown || options?.forceSignInDialog) {
            return localize('signIn', "Sign in to use AI Features");
        }
        return localize('startUsing', "Start using AI Features");
    }
    createDialogFooter(disposables, options) {
        const element = $('.chat-setup-dialog-footer');
        let footer;
        if (options?.forceAnonymous || this.telemetryService.telemetryLevel === 0 /* TelemetryLevel.NONE */) {
            footer = localize({ key: 'settingsAnonymous', comment: ['{Locked="["}', '{Locked="]({1})"}', '{Locked="]({2})"}'] }, "By continuing, you agree to {0}'s [Terms]({1}) and [Privacy Statement]({2}).", defaultChat.provider.default.name, defaultChat.termsStatementUrl, defaultChat.privacyStatementUrl);
        }
        else {
            footer = localize({ key: 'settings', comment: ['{Locked="["}', '{Locked="]({1})"}', '{Locked="]({2})"}', '{Locked="]({4})"}', '{Locked="]({5})"}'] }, "By continuing, you agree to {0}'s [Terms]({1}) and [Privacy Statement]({2}). {3} Copilot may show [public code]({4}) suggestions and use your data to improve the product. You can change these [settings]({5}) anytime.", defaultChat.provider.default.name, defaultChat.termsStatementUrl, defaultChat.privacyStatementUrl, defaultChat.provider.default.name, defaultChat.publicCodeMatchesUrl, defaultChat.manageSettingsUrl);
        }
        element.appendChild($('p', undefined, disposables.add(this.markdownRendererService.render(new MarkdownString(footer, { isTrusted: true }))).element));
        return element;
    }
};
ChatSetup = ChatSetup_1 = __decorate([
    __param(2, ITelemetryService),
    __param(3, ILayoutService),
    __param(4, IKeybindingService),
    __param(5, IChatEntitlementService),
    __param(6, ILogService),
    __param(7, IConfigurationService),
    __param(8, IChatWidgetService),
    __param(9, IWorkspaceTrustRequestService),
    __param(10, IMarkdownRendererService)
], ChatSetup);
let ChatSetupContribution = class ChatSetupContribution extends Disposable {
    static { this.ID = 'workbench.contrib.chatSetup'; }
    constructor(productService, instantiationService, commandService, telemetryService, chatEntitlementService, chatModeService, logService, contextKeyService, extensionEnablementService, extensionsWorkbenchService, extensionService, environmentService, configurationService) {
        super();
        this.productService = productService;
        this.instantiationService = instantiationService;
        this.commandService = commandService;
        this.telemetryService = telemetryService;
        this.chatModeService = chatModeService;
        this.logService = logService;
        this.contextKeyService = contextKeyService;
        this.extensionEnablementService = extensionEnablementService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionService = extensionService;
        this.environmentService = environmentService;
        this.configurationService = configurationService;
        const context = chatEntitlementService.context?.value;
        const requests = chatEntitlementService.requests?.value;
        if (!context || !requests) {
            return; // disabled
        }
        const controller = new Lazy(() => this._register(this.instantiationService.createInstance(ChatSetupController, context, requests)));
        this.registerSetupAgents(context, controller);
        this.registerActions(context, requests, controller);
        this.registerUrlLinkHandler();
        this.checkExtensionInstallation(context);
    }
    registerSetupAgents(context, controller) {
        if (this.configurationService.getValue('chat.experimental.disableCoreAgents')) {
            return; // TODO@bpasero eventually remove this when we figured out extension activation issues
        }
        const defaultAgentDisposables = markAsSingleton(new MutableDisposable()); // prevents flicker on window reload
        const vscodeAgentDisposables = markAsSingleton(new MutableDisposable());
        const renameProviderDisposables = markAsSingleton(new MutableDisposable());
        const codeActionsProviderDisposables = markAsSingleton(new MutableDisposable());
        const updateRegistration = () => {
            // Agent + Tools
            {
                if (!context.state.hidden && !context.state.disabled) {
                    // Default Agents (always, even if installed to allow for speedy requests right on startup)
                    if (!defaultAgentDisposables.value) {
                        const disposables = defaultAgentDisposables.value = new DisposableStore();
                        // Panel Agents
                        const panelAgentDisposables = disposables.add(new DisposableStore());
                        for (const mode of [ChatModeKind.Ask, ChatModeKind.Edit, ChatModeKind.Agent]) {
                            const { agent, disposable } = SetupAgent.registerDefaultAgents(this.instantiationService, ChatAgentLocation.Chat, mode, context, controller);
                            panelAgentDisposables.add(disposable);
                            panelAgentDisposables.add(agent.onUnresolvableError(() => {
                                const panelAgentHasGuidance = chatViewsWelcomeRegistry.get().some(descriptor => this.contextKeyService.contextMatchesRules(descriptor.when));
                                if (panelAgentHasGuidance) {
                                    // An unresolvable error from our agent registrations means that
                                    // Chat is unhealthy for some reason. We clear our panel
                                    // registration to give Chat a chance to show a custom message
                                    // to the user from the views and stop pretending as if there was
                                    // a functional agent.
                                    this.logService.error('[chat setup] Unresolvable error from Chat agent registration, clearing registration.');
                                    panelAgentDisposables.dispose();
                                }
                            }));
                        }
                        // Inline Agents
                        disposables.add(SetupAgent.registerDefaultAgents(this.instantiationService, ChatAgentLocation.Terminal, undefined, context, controller).disposable);
                        disposables.add(SetupAgent.registerDefaultAgents(this.instantiationService, ChatAgentLocation.Notebook, undefined, context, controller).disposable);
                        disposables.add(SetupAgent.registerDefaultAgents(this.instantiationService, ChatAgentLocation.EditorInline, undefined, context, controller).disposable);
                    }
                    // Built-In Agent + Tool (unless installed, signed-in and enabled)
                    if ((!context.state.installed || context.state.entitlement === ChatEntitlement.Unknown || context.state.entitlement === ChatEntitlement.Unresolved) && !vscodeAgentDisposables.value) {
                        const disposables = vscodeAgentDisposables.value = new DisposableStore();
                        disposables.add(SetupAgent.registerBuiltInAgents(this.instantiationService, context, controller));
                    }
                }
                else {
                    defaultAgentDisposables.clear();
                    vscodeAgentDisposables.clear();
                }
                if (context.state.installed && !context.state.disabled) {
                    vscodeAgentDisposables.clear(); // we need to do this to prevent showing duplicate agent/tool entries in the list
                }
            }
            // Rename Provider
            {
                if (!context.state.installed && !context.state.hidden && !context.state.disabled) {
                    if (!renameProviderDisposables.value) {
                        renameProviderDisposables.value = AINewSymbolNamesProvider.registerProvider(this.instantiationService, context, controller);
                    }
                }
                else {
                    renameProviderDisposables.clear();
                }
            }
            // Code Actions Provider
            {
                if (!context.state.installed && !context.state.hidden && !context.state.disabled) {
                    if (!codeActionsProviderDisposables.value) {
                        codeActionsProviderDisposables.value = ChatCodeActionsProvider.registerProvider(this.instantiationService);
                    }
                }
                else {
                    codeActionsProviderDisposables.clear();
                }
            }
        };
        this._register(Event.runAndSubscribe(context.onDidChange, () => updateRegistration()));
    }
    registerActions(context, requests, controller) {
        //#region Global Chat Setup Actions
        class ChatSetupTriggerAction extends Action2 {
            static { this.CHAT_SETUP_ACTION_LABEL = localize2('triggerChatSetup', "Use AI Features with Copilot for free..."); }
            constructor() {
                super({
                    id: CHAT_SETUP_ACTION_ID,
                    title: ChatSetupTriggerAction.CHAT_SETUP_ACTION_LABEL,
                    category: CHAT_CATEGORY,
                    f1: true,
                    precondition: ContextKeyExpr.or(ChatContextKeys.Setup.hidden, ChatContextKeys.Setup.disabled, ChatContextKeys.Setup.untrusted, ChatContextKeys.Setup.installed.negate(), ChatContextKeys.Entitlement.canSignUp)
                });
            }
            async run(accessor, mode, options) {
                const widgetService = accessor.get(IChatWidgetService);
                const instantiationService = accessor.get(IInstantiationService);
                const dialogService = accessor.get(IDialogService);
                const commandService = accessor.get(ICommandService);
                const lifecycleService = accessor.get(ILifecycleService);
                const configurationService = accessor.get(IConfigurationService);
                await context.update({ hidden: false });
                configurationService.updateValue(ChatTeardownContribution.CHAT_DISABLED_CONFIGURATION_KEY, false);
                if (mode) {
                    const chatWidget = await widgetService.revealWidget();
                    chatWidget?.input.setChatMode(mode);
                }
                const setup = ChatSetup.getInstance(instantiationService, context, controller);
                const { success } = await setup.run(options);
                if (success === false && !lifecycleService.willShutdown) {
                    const { confirmed } = await dialogService.confirm({
                        type: Severity.Error,
                        message: localize('setupErrorDialog', "Chat setup failed. Would you like to try again?"),
                        primaryButton: localize('retry', "Retry"),
                    });
                    if (confirmed) {
                        return Boolean(await commandService.executeCommand(CHAT_SETUP_ACTION_ID, mode, options));
                    }
                }
                return Boolean(success);
            }
        }
        class ChatSetupTriggerSupportAnonymousAction extends Action2 {
            constructor() {
                super({
                    id: CHAT_SETUP_SUPPORT_ANONYMOUS_ACTION_ID,
                    title: ChatSetupTriggerAction.CHAT_SETUP_ACTION_LABEL
                });
            }
            async run(accessor) {
                const commandService = accessor.get(ICommandService);
                const telemetryService = accessor.get(ITelemetryService);
                const chatEntitlementService = accessor.get(IChatEntitlementService);
                telemetryService.publicLog2('workbenchActionExecuted', { id: CHAT_SETUP_ACTION_ID, from: 'api' });
                return commandService.executeCommand(CHAT_SETUP_ACTION_ID, undefined, {
                    forceAnonymous: chatEntitlementService.anonymous ? ChatSetupAnonymous.EnabledWithDialog : undefined
                });
            }
        }
        class ChatSetupTriggerForceSignInDialogAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.chat.triggerSetupForceSignIn',
                    title: localize2('forceSignIn', "Sign in to use AI features")
                });
            }
            async run(accessor) {
                const commandService = accessor.get(ICommandService);
                const telemetryService = accessor.get(ITelemetryService);
                telemetryService.publicLog2('workbenchActionExecuted', { id: CHAT_SETUP_ACTION_ID, from: 'api' });
                return commandService.executeCommand(CHAT_SETUP_ACTION_ID, undefined, { forceSignInDialog: true });
            }
        }
        class ChatSetupTriggerAnonymousWithoutDialogAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.chat.triggerSetupAnonymousWithoutDialog',
                    title: ChatSetupTriggerAction.CHAT_SETUP_ACTION_LABEL
                });
            }
            async run(accessor) {
                const commandService = accessor.get(ICommandService);
                const telemetryService = accessor.get(ITelemetryService);
                telemetryService.publicLog2('workbenchActionExecuted', { id: CHAT_SETUP_ACTION_ID, from: 'api' });
                return commandService.executeCommand(CHAT_SETUP_ACTION_ID, undefined, { forceAnonymous: ChatSetupAnonymous.EnabledWithoutDialog });
            }
        }
        class ChatSetupFromAccountsAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.chat.triggerSetupFromAccounts',
                    title: localize2('triggerChatSetupFromAccounts', "Sign in to use AI features..."),
                    menu: {
                        id: MenuId.AccountsContext,
                        group: '2_copilot',
                        when: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.installed.negate(), ChatContextKeys.Entitlement.signedOut)
                    }
                });
            }
            async run(accessor) {
                const commandService = accessor.get(ICommandService);
                const telemetryService = accessor.get(ITelemetryService);
                telemetryService.publicLog2('workbenchActionExecuted', { id: CHAT_SETUP_ACTION_ID, from: 'accounts' });
                return commandService.executeCommand(CHAT_SETUP_ACTION_ID);
            }
        }
        const windowFocusListener = this._register(new MutableDisposable());
        class UpgradePlanAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.chat.upgradePlan',
                    title: localize2('managePlan', "Upgrade to GitHub Copilot Pro"),
                    category: localize2('chat.category', 'Chat'),
                    f1: true,
                    precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ContextKeyExpr.or(ChatContextKeys.Entitlement.canSignUp, ChatContextKeys.Entitlement.planFree)),
                    menu: {
                        id: MenuId.ChatTitleBarMenu,
                        group: 'a_first',
                        order: 1,
                        when: ContextKeyExpr.and(ChatContextKeys.Entitlement.planFree, ContextKeyExpr.or(ChatContextKeys.chatQuotaExceeded, ChatContextKeys.completionsQuotaExceeded))
                    }
                });
            }
            async run(accessor) {
                const openerService = accessor.get(IOpenerService);
                const hostService = accessor.get(IHostService);
                const commandService = accessor.get(ICommandService);
                openerService.open(URI.parse(defaultChat.upgradePlanUrl));
                const entitlement = context.state.entitlement;
                if (!isProUser(entitlement)) {
                    // If the user is not yet Pro, we listen to window focus to refresh the token
                    // when the user has come back to the window assuming the user signed up.
                    windowFocusListener.value = hostService.onDidChangeFocus(focus => this.onWindowFocus(focus, commandService));
                }
            }
            async onWindowFocus(focus, commandService) {
                if (focus) {
                    windowFocusListener.clear();
                    const entitlements = await requests.forceResolveEntitlement(undefined);
                    if (entitlements?.entitlement && isProUser(entitlements?.entitlement)) {
                        refreshTokens(commandService);
                    }
                }
            }
        }
        class EnableOveragesAction extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.chat.manageOverages',
                    title: localize2('manageOverages', "Manage GitHub Copilot Overages"),
                    category: localize2('chat.category', 'Chat'),
                    f1: true,
                    precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ContextKeyExpr.or(ChatContextKeys.Entitlement.planPro, ChatContextKeys.Entitlement.planProPlus)),
                    menu: {
                        id: MenuId.ChatTitleBarMenu,
                        group: 'a_first',
                        order: 1,
                        when: ContextKeyExpr.and(ContextKeyExpr.or(ChatContextKeys.Entitlement.planPro, ChatContextKeys.Entitlement.planProPlus), ContextKeyExpr.or(ChatContextKeys.chatQuotaExceeded, ChatContextKeys.completionsQuotaExceeded))
                    }
                });
            }
            async run(accessor) {
                const openerService = accessor.get(IOpenerService);
                openerService.open(URI.parse(defaultChat.manageOveragesUrl));
            }
        }
        registerAction2(ChatSetupTriggerAction);
        registerAction2(ChatSetupTriggerForceSignInDialogAction);
        registerAction2(ChatSetupFromAccountsAction);
        registerAction2(ChatSetupTriggerAnonymousWithoutDialogAction);
        registerAction2(ChatSetupTriggerSupportAnonymousAction);
        registerAction2(UpgradePlanAction);
        registerAction2(EnableOveragesAction);
        //#endregion
        //#region Editor Context Menu
        // TODO@bpasero remove these when Chat extension is built-in
        {
            function registerGenerateCodeCommand(coreCommand, actualCommand) {
                CommandsRegistry.registerCommand(coreCommand, async (accessor) => {
                    const commandService = accessor.get(ICommandService);
                    const codeEditorService = accessor.get(ICodeEditorService);
                    const markerService = accessor.get(IMarkerService);
                    switch (coreCommand) {
                        case 'chat.internal.explain':
                        case 'chat.internal.fix': {
                            const textEditor = codeEditorService.getActiveCodeEditor();
                            const uri = textEditor?.getModel()?.uri;
                            const range = textEditor?.getSelection();
                            if (!uri || !range) {
                                return;
                            }
                            const markers = AICodeActionsHelper.warningOrErrorMarkersAtRange(markerService, uri, range);
                            const actualCommand = coreCommand === 'chat.internal.explain'
                                ? AICodeActionsHelper.explainMarkers(markers)
                                : AICodeActionsHelper.fixMarkers(markers, range);
                            await commandService.executeCommand(actualCommand.id, ...(actualCommand.arguments ?? []));
                            break;
                        }
                        case 'chat.internal.review':
                        case 'chat.internal.generateDocs':
                        case 'chat.internal.generateTests': {
                            const result = await commandService.executeCommand(CHAT_SETUP_SUPPORT_ANONYMOUS_ACTION_ID);
                            if (result) {
                                await commandService.executeCommand(actualCommand);
                            }
                        }
                    }
                });
            }
            registerGenerateCodeCommand('chat.internal.explain', 'github.copilot.chat.explain');
            registerGenerateCodeCommand('chat.internal.fix', 'github.copilot.chat.fix');
            registerGenerateCodeCommand('chat.internal.review', 'github.copilot.chat.review');
            registerGenerateCodeCommand('chat.internal.generateDocs', 'github.copilot.chat.generateDocs');
            registerGenerateCodeCommand('chat.internal.generateTests', 'github.copilot.chat.generateTests');
            const internalGenerateCodeContext = ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabled.negate(), ChatContextKeys.Setup.installed.negate());
            MenuRegistry.appendMenuItem(MenuId.EditorContext, {
                command: {
                    id: 'chat.internal.explain',
                    title: localize('explain', "Explain"),
                },
                group: '1_chat',
                order: 4,
                when: internalGenerateCodeContext
            });
            MenuRegistry.appendMenuItem(MenuId.ChatTextEditorMenu, {
                command: {
                    id: 'chat.internal.fix',
                    title: localize('fix', "Fix"),
                },
                group: '1_action',
                order: 1,
                when: ContextKeyExpr.and(internalGenerateCodeContext, EditorContextKeys.readOnly.negate())
            });
            MenuRegistry.appendMenuItem(MenuId.ChatTextEditorMenu, {
                command: {
                    id: 'chat.internal.review',
                    title: localize('review', "Code Review"),
                },
                group: '1_action',
                order: 2,
                when: internalGenerateCodeContext
            });
            MenuRegistry.appendMenuItem(MenuId.ChatTextEditorMenu, {
                command: {
                    id: 'chat.internal.generateDocs',
                    title: localize('generateDocs', "Generate Docs"),
                },
                group: '2_generate',
                order: 1,
                when: ContextKeyExpr.and(internalGenerateCodeContext, EditorContextKeys.readOnly.negate())
            });
            MenuRegistry.appendMenuItem(MenuId.ChatTextEditorMenu, {
                command: {
                    id: 'chat.internal.generateTests',
                    title: localize('generateTests', "Generate Tests"),
                },
                group: '2_generate',
                order: 2,
                when: ContextKeyExpr.and(internalGenerateCodeContext, EditorContextKeys.readOnly.negate())
            });
        }
    }
    registerUrlLinkHandler() {
        this._register(ExtensionUrlHandlerOverrideRegistry.registerHandler({
            canHandleURL: url => {
                return url.scheme === this.productService.urlProtocol && equalsIgnoreCase(url.authority, defaultChat.chatExtensionId);
            },
            handleURL: async (url) => {
                const params = new URLSearchParams(url.query);
                this.telemetryService.publicLog2('workbenchActionExecuted', { id: CHAT_SETUP_ACTION_ID, from: 'url', detail: params.get('referrer') ?? undefined });
                const agentParam = params.get('agent') ?? params.get('mode');
                if (agentParam) {
                    const agents = this.chatModeService.getModes();
                    const allAgents = [...agents.builtin, ...agents.custom];
                    // check if the given param is a valid mode ID
                    let foundAgent = allAgents.find(agent => agent.id === agentParam);
                    if (!foundAgent) {
                        // if not, check if the given param is a valid mode name, note the parameter as name is case insensitive
                        const nameLower = agentParam.toLowerCase();
                        foundAgent = allAgents.find(agent => agent.name.get().toLowerCase() === nameLower);
                    }
                    // execute the command to change the mode in panel, note that the command only supports mode IDs, not names
                    await this.commandService.executeCommand(CHAT_SETUP_ACTION_ID, foundAgent?.id);
                    return true;
                }
                return false;
            }
        }));
    }
    async checkExtensionInstallation(context) {
        // When developing extensions, await registration and then check
        if (this.environmentService.isExtensionDevelopment) {
            await this.extensionService.whenInstalledExtensionsRegistered();
            if (this.extensionService.extensions.find(ext => ExtensionIdentifier.equals(ext.identifier, defaultChat.chatExtensionId))) {
                context.update({ installed: true, disabled: false, untrusted: false });
                return;
            }
        }
        // Await extensions to be ready to be queried
        await this.extensionsWorkbenchService.queryLocal();
        // Listen to extensions change and process extensions once
        this._register(Event.runAndSubscribe(this.extensionsWorkbenchService.onChange, e => {
            if (e && !ExtensionIdentifier.equals(e.identifier.id, defaultChat.chatExtensionId)) {
                return; // unrelated event
            }
            const defaultChatExtension = this.extensionsWorkbenchService.local.find(value => ExtensionIdentifier.equals(value.identifier.id, defaultChat.chatExtensionId));
            const installed = !!defaultChatExtension?.local;
            let disabled;
            let untrusted = false;
            if (installed) {
                disabled = !this.extensionEnablementService.isEnabled(defaultChatExtension.local);
                if (disabled) {
                    const state = this.extensionEnablementService.getEnablementState(defaultChatExtension.local);
                    if (state === 0 /* EnablementState.DisabledByTrustRequirement */) {
                        disabled = false; // not disabled by user choice but
                        untrusted = true; // by missing workspace trust
                    }
                }
            }
            else {
                disabled = false;
            }
            context.update({ installed, disabled, untrusted });
        }));
    }
};
ChatSetupContribution = __decorate([
    __param(0, IProductService),
    __param(1, IInstantiationService),
    __param(2, ICommandService),
    __param(3, ITelemetryService),
    __param(4, IChatEntitlementService),
    __param(5, IChatModeService),
    __param(6, ILogService),
    __param(7, IContextKeyService),
    __param(8, IWorkbenchExtensionEnablementService),
    __param(9, IExtensionsWorkbenchService),
    __param(10, IExtensionService),
    __param(11, IEnvironmentService),
    __param(12, IConfigurationService)
], ChatSetupContribution);
export { ChatSetupContribution };
let ChatTeardownContribution = class ChatTeardownContribution extends Disposable {
    static { ChatTeardownContribution_1 = this; }
    static { this.ID = 'workbench.contrib.chatTeardown'; }
    static { this.CHAT_DISABLED_CONFIGURATION_KEY = 'chat.disableAIFeatures'; }
    constructor(chatEntitlementService, configurationService, extensionsWorkbenchService, extensionEnablementService, viewDescriptorService, layoutService) {
        super();
        this.configurationService = configurationService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionEnablementService = extensionEnablementService;
        this.viewDescriptorService = viewDescriptorService;
        this.layoutService = layoutService;
        const context = chatEntitlementService.context?.value;
        if (!context) {
            return; // disabled
        }
        this.registerListeners();
        this.registerActions();
        this.handleChatDisabled(false);
    }
    handleChatDisabled(fromEvent) {
        const chatDisabled = this.configurationService.inspect(ChatTeardownContribution_1.CHAT_DISABLED_CONFIGURATION_KEY);
        if (chatDisabled.value === true) {
            this.maybeEnableOrDisableExtension(typeof chatDisabled.workspaceValue === 'boolean' ? 11 /* EnablementState.DisabledWorkspace */ : 10 /* EnablementState.DisabledGlobally */);
            if (fromEvent) {
                this.maybeHideAuxiliaryBar();
            }
        }
        else if (chatDisabled.value === false && fromEvent /* do not enable extensions unless its an explicit settings change */) {
            this.maybeEnableOrDisableExtension(typeof chatDisabled.workspaceValue === 'boolean' ? 13 /* EnablementState.EnabledWorkspace */ : 12 /* EnablementState.EnabledGlobally */);
        }
    }
    async registerListeners() {
        // Configuration changes
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (!e.affectsConfiguration(ChatTeardownContribution_1.CHAT_DISABLED_CONFIGURATION_KEY)) {
                return;
            }
            this.handleChatDisabled(true);
        }));
        // Extension installation
        await this.extensionsWorkbenchService.queryLocal();
        this._register(this.extensionsWorkbenchService.onChange(e => {
            if (e && !ExtensionIdentifier.equals(e.identifier.id, defaultChat.chatExtensionId)) {
                return; // unrelated event
            }
            const defaultChatExtension = this.extensionsWorkbenchService.local.find(value => ExtensionIdentifier.equals(value.identifier.id, defaultChat.chatExtensionId));
            if (defaultChatExtension?.local && this.extensionEnablementService.isEnabled(defaultChatExtension.local)) {
                this.configurationService.updateValue(ChatTeardownContribution_1.CHAT_DISABLED_CONFIGURATION_KEY, false);
            }
        }));
    }
    async maybeEnableOrDisableExtension(state) {
        const defaultChatExtension = this.extensionsWorkbenchService.local.find(value => ExtensionIdentifier.equals(value.identifier.id, defaultChat.chatExtensionId));
        if (!defaultChatExtension) {
            return;
        }
        await this.extensionsWorkbenchService.setEnablement([defaultChatExtension], state);
        await this.extensionsWorkbenchService.updateRunningExtensions(state === 12 /* EnablementState.EnabledGlobally */ || state === 13 /* EnablementState.EnabledWorkspace */ ? localize('restartExtensionHost.reason.enable', "Enabling AI features") : localize('restartExtensionHost.reason.disable', "Disabling AI features"));
    }
    maybeHideAuxiliaryBar() {
        const activeContainers = this.viewDescriptorService.getViewContainersByLocation(2 /* ViewContainerLocation.AuxiliaryBar */).filter(container => this.viewDescriptorService.getViewContainerModel(container).activeViewDescriptors.length > 0);
        const hasChatView = activeContainers.some(container => container.id === CHAT_SIDEBAR_PANEL_ID);
        const hasAgentSessionsView = activeContainers.some(container => container.id === AGENT_SESSIONS_VIEW_CONTAINER_ID);
        if ((activeContainers.length === 0) || // chat view is already gone but we know it was there before
            (activeContainers.length === 1 && (hasChatView || hasAgentSessionsView)) || // chat view or agent sessions is the only view which is going to go away
            (activeContainers.length === 2 && hasChatView && hasAgentSessionsView) // both chat and agent sessions view are going to go away
        ) {
            this.layoutService.setPartHidden(true, "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */); // hide if there are no views in the secondary sidebar
        }
    }
    registerActions() {
        class ChatSetupHideAction extends Action2 {
            static { this.ID = 'workbench.action.chat.hideSetup'; }
            static { this.TITLE = localize2('hideChatSetup', "Learn How to Hide AI Features"); }
            constructor() {
                super({
                    id: ChatSetupHideAction.ID,
                    title: ChatSetupHideAction.TITLE,
                    f1: true,
                    category: CHAT_CATEGORY,
                    precondition: ChatContextKeys.Setup.hidden.negate(),
                    menu: {
                        id: MenuId.ChatTitleBarMenu,
                        group: 'z_hide',
                        order: 1,
                        when: ChatContextKeys.Setup.installed.negate()
                    }
                });
            }
            async run(accessor) {
                const preferencesService = accessor.get(IPreferencesService);
                preferencesService.openSettings({ jsonEditor: false, query: `@id:${ChatTeardownContribution_1.CHAT_DISABLED_CONFIGURATION_KEY}` });
            }
        }
        registerAction2(ChatSetupHideAction);
    }
};
ChatTeardownContribution = ChatTeardownContribution_1 = __decorate([
    __param(0, IChatEntitlementService),
    __param(1, IConfigurationService),
    __param(2, IExtensionsWorkbenchService),
    __param(3, IWorkbenchExtensionEnablementService),
    __param(4, IViewDescriptorService),
    __param(5, IWorkbenchLayoutService)
], ChatTeardownContribution);
export { ChatTeardownContribution };
var ChatSetupStep;
(function (ChatSetupStep) {
    ChatSetupStep[ChatSetupStep["Initial"] = 1] = "Initial";
    ChatSetupStep[ChatSetupStep["SigningIn"] = 2] = "SigningIn";
    ChatSetupStep[ChatSetupStep["Installing"] = 3] = "Installing";
})(ChatSetupStep || (ChatSetupStep = {}));
let ChatSetupController = class ChatSetupController extends Disposable {
    get step() { return this._step; }
    constructor(context, requests, telemetryService, authenticationService, extensionsWorkbenchService, productService, logService, progressService, activityService, commandService, dialogService, configurationService, lifecycleService, quickInputService) {
        super();
        this.context = context;
        this.requests = requests;
        this.telemetryService = telemetryService;
        this.authenticationService = authenticationService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.productService = productService;
        this.logService = logService;
        this.progressService = progressService;
        this.activityService = activityService;
        this.commandService = commandService;
        this.dialogService = dialogService;
        this.configurationService = configurationService;
        this.lifecycleService = lifecycleService;
        this.quickInputService = quickInputService;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._step = ChatSetupStep.Initial;
        this.registerListeners();
    }
    registerListeners() {
        this._register(this.context.onDidChange(() => this._onDidChange.fire()));
    }
    setStep(step) {
        if (this._step === step) {
            return;
        }
        this._step = step;
        this._onDidChange.fire();
    }
    async setup(options = {}) {
        const watch = new StopWatch(false);
        const title = localize('setupChatProgress', "Getting chat ready...");
        const badge = this.activityService.showViewContainerActivity(CHAT_SIDEBAR_PANEL_ID, {
            badge: new ProgressBadge(() => title),
        });
        try {
            return await this.progressService.withProgress({
                location: 10 /* ProgressLocation.Window */,
                command: CHAT_OPEN_ACTION_ID,
                title,
            }, () => this.doSetup(options, watch));
        }
        finally {
            badge.dispose();
        }
    }
    async doSetup(options, watch) {
        this.context.suspend(); // reduces flicker
        let success = false;
        try {
            const providerId = ChatEntitlementRequests.providerId(this.configurationService);
            let session;
            let entitlement;
            let signIn;
            if (options.forceSignIn) {
                signIn = true; // forced to sign in
            }
            else if (this.context.state.entitlement === ChatEntitlement.Unknown) {
                if (options.forceAnonymous) {
                    signIn = false; // forced to anonymous without sign in
                }
                else {
                    signIn = true; // sign in since we are signed out
                }
            }
            else {
                signIn = false; // already signed in
            }
            if (signIn) {
                this.setStep(ChatSetupStep.SigningIn);
                const result = await this.signIn(options);
                if (!result.session) {
                    this.doInstall(); // still install the extension in the background to remind the user to sign-in eventually
                    const provider = options.useSocialProvider ?? (options.useEnterpriseProvider ? defaultChat.provider.enterprise.id : defaultChat.provider.default.id);
                    this.telemetryService.publicLog2('commandCenter.chatInstall', { installResult: 'failedNotSignedIn', installDuration: watch.elapsed(), signUpErrorCode: undefined, provider });
                    return undefined; // treat as cancelled because signing in already triggers an error dialog
                }
                session = result.session;
                entitlement = result.entitlement;
            }
            // Await Install
            this.setStep(ChatSetupStep.Installing);
            success = await this.install(session, entitlement ?? this.context.state.entitlement, providerId, watch, options);
        }
        finally {
            this.setStep(ChatSetupStep.Initial);
            this.context.resume();
        }
        return success;
    }
    async signIn(options) {
        let session;
        let entitlements;
        try {
            ({ session, entitlements } = await this.requests.signIn(options));
        }
        catch (e) {
            this.logService.error(`[chat setup] signIn: error ${e}`);
        }
        if (!session && !this.lifecycleService.willShutdown) {
            const { confirmed } = await this.dialogService.confirm({
                type: Severity.Error,
                message: localize('unknownSignInError', "Failed to sign in to {0}. Would you like to try again?", ChatEntitlementRequests.providerId(this.configurationService) === defaultChat.provider.enterprise.id ? defaultChat.provider.enterprise.name : defaultChat.provider.default.name),
                detail: localize('unknownSignInErrorDetail', "You must be signed in to use AI features."),
                primaryButton: localize('retry', "Retry")
            });
            if (confirmed) {
                return this.signIn(options);
            }
        }
        return { session, entitlement: entitlements?.entitlement };
    }
    async install(session, entitlement, providerId, watch, options) {
        const wasRunning = this.context.state.installed && !this.context.state.disabled;
        let signUpResult = undefined;
        let provider;
        if (options.forceAnonymous && entitlement === ChatEntitlement.Unknown) {
            provider = 'anonymous';
        }
        else {
            provider = options.useSocialProvider ?? (options.useEnterpriseProvider ? defaultChat.provider.enterprise.id : defaultChat.provider.default.id);
        }
        let sessions = session ? [session] : undefined;
        try {
            if (!options.forceAnonymous && // User is not asking for anonymous access
                entitlement !== ChatEntitlement.Free && // User is not signed up to Copilot Free
                !isProUser(entitlement) && // User is not signed up for a Copilot subscription
                entitlement !== ChatEntitlement.Unavailable // User is eligible for Copilot Free
            ) {
                if (!sessions) {
                    try {
                        // Consider all sessions for the provider to be suitable for signing up
                        const existingSessions = await this.authenticationService.getSessions(providerId);
                        sessions = existingSessions.length > 0 ? [...existingSessions] : undefined;
                    }
                    catch (error) {
                        // ignore - errors can throw if a provider is not registered
                    }
                    if (!sessions || sessions.length === 0) {
                        this.telemetryService.publicLog2('commandCenter.chatInstall', { installResult: 'failedNoSession', installDuration: watch.elapsed(), signUpErrorCode: undefined, provider });
                        return false; // unexpected
                    }
                }
                signUpResult = await this.requests.signUpFree(sessions);
                if (typeof signUpResult !== 'boolean' /* error */) {
                    this.telemetryService.publicLog2('commandCenter.chatInstall', { installResult: 'failedSignUp', installDuration: watch.elapsed(), signUpErrorCode: signUpResult.errorCode, provider });
                }
            }
            await this.doInstallWithRetry();
        }
        catch (error) {
            this.logService.error(`[chat setup] install: error ${error}`);
            this.telemetryService.publicLog2('commandCenter.chatInstall', { installResult: isCancellationError(error) ? 'cancelled' : 'failedInstall', installDuration: watch.elapsed(), signUpErrorCode: undefined, provider });
            return false;
        }
        if (typeof signUpResult === 'boolean' /* not an error case */ || typeof signUpResult === 'undefined' /* already signed up */) {
            this.telemetryService.publicLog2('commandCenter.chatInstall', { installResult: wasRunning && !signUpResult ? 'alreadyInstalled' : 'installed', installDuration: watch.elapsed(), signUpErrorCode: undefined, provider });
        }
        if (wasRunning) {
            // We always trigger refresh of tokens to help the user
            // get out of authentication issues that can happen when
            // for example the sign-up ran after the extension tried
            // to use the authentication information to mint a token
            refreshTokens(this.commandService);
        }
        return true;
    }
    async doInstallWithRetry() {
        let error;
        try {
            await this.doInstall();
        }
        catch (e) {
            this.logService.error(`[chat setup] install: error ${error}`);
            error = e;
        }
        if (error) {
            if (!this.lifecycleService.willShutdown) {
                const { confirmed } = await this.dialogService.confirm({
                    type: Severity.Error,
                    message: localize('unknownSetupError', "An error occurred while setting up chat. Would you like to try again?"),
                    detail: error && !isCancellationError(error) ? toErrorMessage(error) : undefined,
                    primaryButton: localize('retry', "Retry")
                });
                if (confirmed) {
                    return this.doInstallWithRetry();
                }
            }
            throw error;
        }
    }
    async doInstall() {
        await this.extensionsWorkbenchService.install(defaultChat.chatExtensionId, {
            enable: true,
            isApplicationScoped: true, // install into all profiles
            isMachineScoped: false, // do not ask to sync
            installEverywhere: true, // install in local and remote
            installPreReleaseVersion: this.productService.quality !== 'stable'
        }, ChatViewId);
    }
    async setupWithProvider(options) {
        const registry = Registry.as(ConfigurationExtensions.Configuration);
        registry.registerConfiguration({
            'id': 'copilot.setup',
            'type': 'object',
            'properties': {
                [defaultChat.completionsAdvancedSetting]: {
                    'type': 'object',
                    'properties': {
                        'authProvider': {
                            'type': 'string'
                        }
                    }
                },
                [defaultChat.providerUriSetting]: {
                    'type': 'string'
                }
            }
        });
        if (options.useEnterpriseProvider) {
            const success = await this.handleEnterpriseInstance();
            if (!success) {
                this.telemetryService.publicLog2('commandCenter.chatInstall', { installResult: 'failedEnterpriseSetup', installDuration: 0, signUpErrorCode: undefined, provider: undefined });
                return success; // not properly configured, abort
            }
        }
        let existingAdvancedSetting = this.configurationService.inspect(defaultChat.completionsAdvancedSetting).user?.value;
        if (!isObject(existingAdvancedSetting)) {
            existingAdvancedSetting = {};
        }
        if (options.useEnterpriseProvider) {
            await this.configurationService.updateValue(`${defaultChat.completionsAdvancedSetting}`, {
                ...existingAdvancedSetting,
                'authProvider': defaultChat.provider.enterprise.id
            }, 2 /* ConfigurationTarget.USER */);
        }
        else {
            await this.configurationService.updateValue(`${defaultChat.completionsAdvancedSetting}`, Object.keys(existingAdvancedSetting).length > 0 ? {
                ...existingAdvancedSetting,
                'authProvider': undefined
            } : undefined, 2 /* ConfigurationTarget.USER */);
        }
        return this.setup({ ...options, forceSignIn: true });
    }
    async handleEnterpriseInstance() {
        const domainRegEx = /^[a-zA-Z\-_]+$/;
        const fullUriRegEx = /^(https:\/\/)?([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.ghe\.com\/?$/;
        const uri = this.configurationService.getValue(defaultChat.providerUriSetting);
        if (typeof uri === 'string' && fullUriRegEx.test(uri)) {
            return true; // already setup with a valid URI
        }
        let isSingleWord = false;
        const result = await this.quickInputService.input({
            prompt: localize('enterpriseInstance', "What is your {0} instance?", defaultChat.provider.enterprise.name),
            placeHolder: localize('enterpriseInstancePlaceholder', 'i.e. "octocat" or "https://octocat.ghe.com"...'),
            ignoreFocusLost: true,
            value: uri,
            validateInput: async (value) => {
                isSingleWord = false;
                if (!value) {
                    return undefined;
                }
                if (domainRegEx.test(value)) {
                    isSingleWord = true;
                    return {
                        content: localize('willResolveTo', "Will resolve to {0}", `https://${value}.ghe.com`),
                        severity: Severity.Info
                    };
                }
                if (!fullUriRegEx.test(value)) {
                    return {
                        content: localize('invalidEnterpriseInstance', 'You must enter a valid {0} instance (i.e. "octocat" or "https://octocat.ghe.com")', defaultChat.provider.enterprise.name),
                        severity: Severity.Error
                    };
                }
                return undefined;
            }
        });
        if (!result) {
            return undefined; // canceled
        }
        let resolvedUri = result;
        if (isSingleWord) {
            resolvedUri = `https://${resolvedUri}.ghe.com`;
        }
        else {
            const normalizedUri = result.toLowerCase();
            const hasHttps = normalizedUri.startsWith('https://');
            if (!hasHttps) {
                resolvedUri = `https://${result}`;
            }
        }
        await this.configurationService.updateValue(defaultChat.providerUriSetting, resolvedUri, 2 /* ConfigurationTarget.USER */);
        return true;
    }
};
ChatSetupController = __decorate([
    __param(2, ITelemetryService),
    __param(3, IAuthenticationService),
    __param(4, IExtensionsWorkbenchService),
    __param(5, IProductService),
    __param(6, ILogService),
    __param(7, IProgressService),
    __param(8, IActivityService),
    __param(9, ICommandService),
    __param(10, IDialogService),
    __param(11, IConfigurationService),
    __param(12, ILifecycleService),
    __param(13, IQuickInputService)
], ChatSetupController);
//#endregion
function refreshTokens(commandService) {
    // ugly, but we need to signal to the extension that entitlements changed
    commandService.executeCommand(defaultChat.completionsRefreshTokenCommand);
    commandService.executeCommand(defaultChat.chatRefreshTokenCommand);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNldHVwLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0U2V0dXAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sdUJBQXVCLENBQUM7QUFDL0IsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRXBELE9BQU8sRUFBRSxNQUFNLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUUvRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDN0QsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRTNELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDekUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3BJLE9BQU8sUUFBUSxNQUFNLHFDQUFxQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN0RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtD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