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
import { $, addDisposableListener, disposableWindowInterval, EventType } from '../../../../base/browser/dom.js';
import { renderMarkdown } from '../../../../base/browser/markdownRenderer.js';
import { Checkbox } from '../../../../base/browser/ui/toggle/toggle.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { findLast } from '../../../../base/common/arraysFind.js';
import { assertNever } from '../../../../base/common/assert.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { groupBy } from '../../../../base/common/collections.js';
import { Event } from '../../../../base/common/event.js';
import { createMarkdownCommandLink, MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, derived, derivedObservableWithCache, observableValue } from '../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { isDefined } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { Range } from '../../../../editor/common/core/range.js';
import { SuggestController } from '../../../../editor/contrib/suggest/browser/suggestController.js';
import { localize, localize2 } from '../../../../nls.js';
import { IActionViewItemService } from '../../../../platform/actions/browser/actionViewItemService.js';
import { MenuEntryActionViewItem } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { Action2, MenuId, MenuItemAction, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { mcpAutoStartConfig } from '../../../../platform/mcp/common/mcpManagement.js';
import { observableConfigValue } from '../../../../platform/observable/common/platformObservableUtils.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { defaultCheckboxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { spinningLoading } from '../../../../platform/theme/common/iconRegistry.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { PICK_WORKSPACE_FOLDER_COMMAND_ID } from '../../../browser/actions/workspaceCommands.js';
import { ActiveEditorContext, RemoteNameContext, ResourceContextKey, WorkbenchStateContext, WorkspaceFolderCountContext } from '../../../common/contextkeys.js';
import { IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { IAuthenticationQueryService } from '../../../services/authentication/common/authenticationQuery.js';
import { MCP_CONFIGURATION_KEY, WORKSPACE_STANDALONE_CONFIGURATIONS } from '../../../services/configuration/common/configuration.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IRemoteUserDataProfilesService } from '../../../services/userDataProfile/common/remoteUserDataProfiles.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { CHAT_CONFIG_MENU_ID } from '../../chat/browser/actions/chatActions.js';
import { ChatViewId, IChatWidgetService } from '../../chat/browser/chat.js';
import { ChatContextKeys } from '../../chat/common/chatContextKeys.js';
import { ChatModeKind } from '../../chat/common/constants.js';
import { ILanguageModelsService } from '../../chat/common/languageModels.js';
import { ILanguageModelToolsService } from '../../chat/common/languageModelToolsService.js';
import { VIEW_CONTAINER } from '../../extensions/browser/extensions.contribution.js';
import { extensionsFilterSubMenu, IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';
import { TEXT_FILE_EDITOR_ID } from '../../files/common/files.js';
import { McpContextKeys } from '../common/mcpContextKeys.js';
import { IMcpRegistry } from '../common/mcpRegistryTypes.js';
import { HasInstalledMcpServersContext, IMcpSamplingService, IMcpService, InstalledMcpServersViewId, McpConnectionState, mcpPromptPrefix, McpStartServerInteraction } from '../common/mcpTypes.js';
import { McpAddConfigurationCommand } from './mcpCommandsAddConfiguration.js';
import { McpResourceQuickAccess, McpResourceQuickPick } from './mcpResourceQuickAccess.js';
import './media/mcpServerAction.css';
import { openPanelChatAndGetWidget } from './openPanelChatAndGetWidget.js';
// acroynms do not get localized
const category = {
    original: 'MCP',
    value: 'MCP',
};
export class ListMcpServerCommand extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.listServer" /* McpCommandIds.ListServer */,
            title: localize2('mcp.list', 'List Servers'),
            icon: Codicon.server,
            category,
            f1: true,
            precondition: ChatContextKeys.Setup.hidden.negate(),
            menu: [{
                    when: ContextKeyExpr.and(ContextKeyExpr.or(ContextKeyExpr.and(ContextKeyExpr.equals(`config.${mcpAutoStartConfig}`, "never" /* McpAutoStartValue.Never */), McpContextKeys.hasUnknownTools), McpContextKeys.hasServersWithErrors), ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Agent), ChatContextKeys.lockedToCodingAgent.negate(), ChatContextKeys.Setup.hidden.negate()),
                    id: MenuId.ChatInput,
                    group: 'navigation',
                    order: 101,
                }],
        });
    }
    async run(accessor) {
        const mcpService = accessor.get(IMcpService);
        const commandService = accessor.get(ICommandService);
        const quickInput = accessor.get(IQuickInputService);
        const store = new DisposableStore();
        const pick = quickInput.createQuickPick({ useSeparators: true });
        pick.placeholder = localize('mcp.selectServer', 'Select an MCP Server');
        mcpService.activateCollections();
        store.add(pick);
        store.add(autorun(reader => {
            const servers = groupBy(mcpService.servers.read(reader).slice().sort((a, b) => (a.collection.presentation?.order || 0) - (b.collection.presentation?.order || 0)), s => s.collection.id);
            const firstRun = pick.items.length === 0;
            pick.items = [
                { id: '$add', label: localize('mcp.addServer', 'Add Server'), description: localize('mcp.addServer.description', 'Add a new server configuration'), alwaysShow: true, iconClass: ThemeIcon.asClassName(Codicon.add) },
                ...Object.values(servers).filter(s => s.length).flatMap((servers) => [
                    { type: 'separator', label: servers[0].collection.label, id: servers[0].collection.id },
                    ...servers.map(server => ({
                        id: server.definition.id,
                        label: server.definition.label,
                        description: McpConnectionState.toString(server.connectionState.read(reader)),
                    })),
                ]),
            ];
            if (firstRun && pick.items.length > 3) {
                pick.activeItems = pick.items.slice(2, 3); // select the first server by default
            }
        }));
        const picked = await new Promise(resolve => {
            store.add(pick.onDidAccept(() => {
                resolve(pick.activeItems[0]);
            }));
            store.add(pick.onDidHide(() => {
                resolve(undefined);
            }));
            pick.show();
        });
        store.dispose();
        if (!picked) {
            // no-op
        }
        else if (picked.id === '$add') {
            commandService.executeCommand("workbench.mcp.addConfiguration" /* McpCommandIds.AddConfiguration */);
        }
        else {
            commandService.executeCommand("workbench.mcp.serverOptions" /* McpCommandIds.ServerOptions */, picked.id);
        }
    }
}
export class McpConfirmationServerOptionsCommand extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.serverOptionsInConfirmation" /* McpCommandIds.ServerOptionsInConfirmation */,
            title: localize2('mcp.options', 'Server Options'),
            category,
            icon: Codicon.settingsGear,
            f1: false,
            menu: [{
                    id: MenuId.ChatConfirmationMenu,
                    when: ContextKeyExpr.and(ContextKeyExpr.equals('chatConfirmationPartSource', 'mcp'), ContextKeyExpr.or(ContextKeyExpr.equals('chatConfirmationPartType', 'chatToolConfirmation'), ContextKeyExpr.equals('chatConfirmationPartType', 'elicitation'))),
                    group: 'navigation'
                }],
        });
    }
    async run(accessor, arg) {
        const toolsService = accessor.get(ILanguageModelToolsService);
        if (arg.kind === 'toolInvocation') {
            const tool = toolsService.getTool(arg.toolId);
            if (tool?.source.type === 'mcp') {
                accessor.get(ICommandService).executeCommand("workbench.mcp.serverOptions" /* McpCommandIds.ServerOptions */, tool.source.definitionId);
            }
        }
        else if (arg.kind === 'elicitation2') {
            if (arg.source?.type === 'mcp') {
                accessor.get(ICommandService).executeCommand("workbench.mcp.serverOptions" /* McpCommandIds.ServerOptions */, arg.source.definitionId);
            }
        }
        else {
            assertNever(arg);
        }
    }
}
export class McpServerOptionsCommand extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.serverOptions" /* McpCommandIds.ServerOptions */,
            title: localize2('mcp.options', 'Server Options'),
            category,
            f1: false,
        });
    }
    async run(accessor, id) {
        const mcpService = accessor.get(IMcpService);
        const quickInputService = accessor.get(IQuickInputService);
        const mcpRegistry = accessor.get(IMcpRegistry);
        const editorService = accessor.get(IEditorService);
        const commandService = accessor.get(ICommandService);
        const samplingService = accessor.get(IMcpSamplingService);
        const authenticationQueryService = accessor.get(IAuthenticationQueryService);
        const authenticationService = accessor.get(IAuthenticationService);
        const server = mcpService.servers.get().find(s => s.definition.id === id);
        if (!server) {
            return;
        }
        const collection = mcpRegistry.collections.get().find(c => c.id === server.collection.id);
        const serverDefinition = collection?.serverDefinitions.get().find(s => s.id === server.definition.id);
        const items = [];
        const serverState = server.connectionState.get();
        items.push({ type: 'separator', label: localize('mcp.actions.status', 'Status') });
        // Only show start when server is stopped or in error state
        if (McpConnectionState.canBeStarted(serverState.state)) {
            items.push({
                label: localize('mcp.start', 'Start Server'),
                action: 'start'
            });
        }
        else {
            items.push({
                label: localize('mcp.stop', 'Stop Server'),
                action: 'stop'
            });
            items.push({
                label: localize('mcp.restart', 'Restart Server'),
                action: 'restart'
            });
        }
        items.push(...this._getAuthActions(authenticationQueryService, server.definition.id));
        const configTarget = serverDefinition?.presentation?.origin || collection?.presentation?.origin;
        if (configTarget) {
            items.push({
                label: localize('mcp.config', 'Show Configuration'),
                action: 'config',
            });
        }
        items.push({
            label: localize('mcp.showOutput', 'Show Output'),
            action: 'showOutput'
        });
        items.push({ type: 'separator', label: localize('mcp.actions.sampling', 'Sampling') }, {
            label: localize('mcp.configAccess', 'Configure Model Access'),
            description: localize('mcp.showOutput.description', 'Set the models the server can use via MCP sampling'),
            action: 'configSampling'
        });
        if (samplingService.hasLogs(server)) {
            items.push({
                label: localize('mcp.samplingLog', 'Show Sampling Requests'),
                description: localize('mcp.samplingLog.description', 'Show the sampling requests for this server'),
                action: 'samplingLog',
            });
        }
        const capabilities = server.capabilities.get();
        if (capabilities === undefined || (capabilities & 16 /* McpCapability.Resources */)) {
            items.push({ type: 'separator', label: localize('mcp.actions.resources', 'Resources') });
            items.push({
                label: localize('mcp.resources', 'Browse Resources'),
                action: 'resources',
            });
        }
        const pick = await quickInputService.pick(items, {
            placeHolder: localize('mcp.selectAction', 'Select action for \'{0}\'', server.definition.label),
        });
        if (!pick) {
            return;
        }
        switch (pick.action) {
            case 'start':
                await server.start({ promptType: 'all-untrusted' });
                server.showOutput();
                break;
            case 'stop':
                await server.stop();
                break;
            case 'restart':
                await server.stop();
                await server.start({ promptType: 'all-untrusted' });
                break;
            case 'disconnect':
                await server.stop();
                await this._handleAuth(authenticationService, pick.accountQuery, server.definition, false);
                break;
            case 'signout':
                await server.stop();
                await this._handleAuth(authenticationService, pick.accountQuery, server.definition, true);
                break;
            case 'showOutput':
                server.showOutput();
                break;
            case 'config':
                editorService.openEditor({
                    resource: URI.isUri(configTarget) ? configTarget : configTarget.uri,
                    options: { selection: URI.isUri(configTarget) ? undefined : configTarget.range }
                });
                break;
            case 'configSampling':
                return commandService.executeCommand("workbench.mcp.configureSamplingModels" /* McpCommandIds.ConfigureSamplingModels */, server);
            case 'resources':
                return commandService.executeCommand("workbench.mcp.browseResources" /* McpCommandIds.BrowseResources */, server);
            case 'samplingLog':
                editorService.openEditor({
                    resource: undefined,
                    contents: samplingService.getLogText(server),
                    label: localize('mcp.samplingLog.title', 'MCP Sampling: {0}', server.definition.label),
                });
                break;
            default:
                assertNever(pick);
        }
    }
    _getAuthActions(authenticationQueryService, serverId) {
        const result = [];
        // Really, this should only ever have one entry.
        for (const [providerId, accountName] of authenticationQueryService.mcpServer(serverId).getAllAccountPreferences()) {
            const accountQuery = authenticationQueryService.provider(providerId).account(accountName);
            if (!accountQuery.mcpServer(serverId).isAccessAllowed()) {
                continue; // skip accounts that are not allowed
            }
            // If there are multiple allowed servers/extensions, other things are using this provider
            // so we show a disconnect action, otherwise we show a sign out action.
            if (accountQuery.entities().getEntityCount().total > 1) {
                result.push({
                    action: 'disconnect',
                    label: localize('mcp.disconnect', 'Disconnect Account'),
                    description: `(${accountName})`,
                    accountQuery
                });
            }
            else {
                result.push({
                    action: 'signout',
                    label: localize('mcp.signOut', 'Sign Out'),
                    description: `(${accountName})`,
                    accountQuery
                });
            }
        }
        return result;
    }
    async _handleAuth(authenticationService, accountQuery, definition, signOut) {
        const { providerId, accountName } = accountQuery;
        accountQuery.mcpServer(definition.id).setAccessAllowed(false, definition.label);
        if (signOut) {
            const accounts = await authenticationService.getAccounts(providerId);
            const account = accounts.find(a => a.label === accountName);
            if (account) {
                const sessions = await authenticationService.getSessions(providerId, undefined, { account });
                for (const session of sessions) {
                    await authenticationService.removeSession(providerId, session.id);
                }
            }
        }
    }
}
let MCPServerActionRendering = class MCPServerActionRendering extends Disposable {
    constructor(actionViewItemService, mcpService, instaService, commandService, configurationService) {
        super();
        const hoverIsOpen = observableValue(this, false);
        const config = observableConfigValue(mcpAutoStartConfig, "newAndOutdated" /* McpAutoStartValue.NewAndOutdated */, configurationService);
        let DisplayedState;
        (function (DisplayedState) {
            DisplayedState[DisplayedState["None"] = 0] = "None";
            DisplayedState[DisplayedState["NewTools"] = 1] = "NewTools";
            DisplayedState[DisplayedState["Error"] = 2] = "Error";
            DisplayedState[DisplayedState["Refreshing"] = 3] = "Refreshing";
        })(DisplayedState || (DisplayedState = {}));
        function isServer(s) {
            return typeof s.start === 'function';
        }
        const displayedStateCurrent = derived((reader) => {
            const servers = mcpService.servers.read(reader);
            const serversPerState = [];
            for (const server of servers) {
                let thisState = 0 /* DisplayedState.None */;
                switch (server.cacheState.read(reader)) {
                    case 0 /* McpServerCacheState.Unknown */:
                    case 2 /* McpServerCacheState.Outdated */:
                        thisState = server.connectionState.read(reader).state === 3 /* McpConnectionState.Kind.Error */ ? 2 /* DisplayedState.Error */ : 1 /* DisplayedState.NewTools */;
                        break;
                    case 3 /* McpServerCacheState.RefreshingFromUnknown */:
                        thisState = 3 /* DisplayedState.Refreshing */;
                        break;
                    default:
                        thisState = server.connectionState.read(reader).state === 3 /* McpConnectionState.Kind.Error */ ? 2 /* DisplayedState.Error */ : 0 /* DisplayedState.None */;
                        break;
                }
                serversPerState[thisState] ??= [];
                serversPerState[thisState].push(server);
            }
            const unknownServerStates = mcpService.lazyCollectionState.read(reader);
            if (unknownServerStates.state === 1 /* LazyCollectionState.LoadingUnknown */) {
                serversPerState[3 /* DisplayedState.Refreshing */] ??= [];
                serversPerState[3 /* DisplayedState.Refreshing */].push(...unknownServerStates.collections);
            }
            else if (unknownServerStates.state === 0 /* LazyCollectionState.HasUnknown */) {
                serversPerState[1 /* DisplayedState.NewTools */] ??= [];
                serversPerState[1 /* DisplayedState.NewTools */].push(...unknownServerStates.collections);
            }
            let maxState = (serversPerState.length - 1);
            if (maxState === 1 /* DisplayedState.NewTools */ && config.read(reader) !== "never" /* McpAutoStartValue.Never */) {
                maxState = 0 /* DisplayedState.None */;
            }
            return { state: maxState, servers: serversPerState[maxState] || [] };
        });
        // avoid hiding the hover if a state changes while it's open:
        const displayedState = derivedObservableWithCache(this, (reader, last) => {
            if (last && hoverIsOpen.read(reader)) {
                return last;
            }
            else {
                return displayedStateCurrent.read(reader);
            }
        });
        const actionItemState = displayedState.map(s => s.state);
        this._store.add(actionViewItemService.register(MenuId.ChatInput, "workbench.mcp.listServer" /* McpCommandIds.ListServer */, (action, options) => {
            if (!(action instanceof MenuItemAction)) {
                return undefined;
            }
            return instaService.createInstance(class extends MenuEntryActionViewItem {
                render(container) {
                    super.render(container);
                    container.classList.add('chat-mcp');
                    container.style.position = 'relative';
                    const stateIndicator = container.appendChild($('.chat-mcp-state-indicator'));
                    stateIndicator.style.display = 'none';
                    this._register(autorun(r => {
                        const displayed = displayedState.read(r);
                        const { state } = displayed;
                        this.updateTooltip();
                        stateIndicator.ariaLabel = this.getLabelForState(displayed);
                        stateIndicator.className = 'chat-mcp-state-indicator';
                        if (state === 1 /* DisplayedState.NewTools */) {
                            stateIndicator.style.display = 'block';
                            stateIndicator.classList.add('chat-mcp-state-new', ...ThemeIcon.asClassNameArray(Codicon.refresh));
                        }
                        else if (state === 2 /* DisplayedState.Error */) {
                            stateIndicator.style.display = 'block';
                            stateIndicator.classList.add('chat-mcp-state-error', ...ThemeIcon.asClassNameArray(Codicon.warning));
                        }
                        else if (state === 3 /* DisplayedState.Refreshing */) {
                            stateIndicator.style.display = 'block';
                            stateIndicator.classList.add('chat-mcp-state-refreshing', ...ThemeIcon.asClassNameArray(spinningLoading));
                        }
                        else {
                            stateIndicator.style.display = 'none';
                        }
                    }));
                }
                async onClick(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const { state, servers } = displayedStateCurrent.get();
                    if (state === 1 /* DisplayedState.NewTools */) {
                        const interaction = new McpStartServerInteraction();
                        servers.filter(isServer).forEach(server => server.stop().then(() => server.start({ interaction })));
                        mcpService.activateCollections();
                    }
                    else if (state === 3 /* DisplayedState.Refreshing */) {
                        findLast(servers, isServer)?.showOutput();
                    }
                    else if (state === 2 /* DisplayedState.Error */) {
                        const server = findLast(servers, isServer);
                        if (server) {
                            await server.showOutput(true);
                            commandService.executeCommand("workbench.mcp.serverOptions" /* McpCommandIds.ServerOptions */, server.definition.id);
                        }
                    }
                    else {
                        commandService.executeCommand("workbench.mcp.listServer" /* McpCommandIds.ListServer */);
                    }
                }
                getTooltip() {
                    return this.getLabelForState() || super.getTooltip();
                }
                getHoverContents({ state, servers } = displayedStateCurrent.get()) {
                    const link = (s) => createMarkdownCommandLink({
                        title: s.definition.label,
                        id: "workbench.mcp.serverOptions" /* McpCommandIds.ServerOptions */,
                        arguments: [s.definition.id],
                    });
                    const single = servers.length === 1;
                    const names = servers.map(s => isServer(s) ? link(s) : '`' + s.label + '`').map(l => single ? l : `- ${l}`).join('\n');
                    let markdown;
                    if (state === 1 /* DisplayedState.NewTools */) {
                        markdown = new MarkdownString(single
                            ? localize('mcp.newTools.md.single', "MCP server {0} has been updated and may have new tools available.", names)
                            : localize('mcp.newTools.md.multi', "MCP servers have been updated and may have new tools available:\n\n{0}", names));
                    }
                    else if (state === 2 /* DisplayedState.Error */) {
                        markdown = new MarkdownString(single
                            ? localize('mcp.err.md.single', "MCP server {0} was unable to start successfully.", names)
                            : localize('mcp.err.md.multi', "Multiple MCP servers were unable to start successfully:\n\n{0}", names));
                    }
                    else {
                        return this.getLabelForState() || undefined;
                    }
                    return {
                        element: (token) => {
                            hoverIsOpen.set(true, undefined);
                            const store = new DisposableStore();
                            store.add(toDisposable(() => hoverIsOpen.set(false, undefined)));
                            store.add(token.onCancellationRequested(() => {
                                store.dispose();
                            }));
                            // todo@connor4312/@benibenj: workaround for #257923
                            store.add(disposableWindowInterval(mainWindow, () => {
                                if (!container.isConnected) {
                                    store.dispose();
                                }
                            }, 2000));
                            const container = $('div.mcp-hover-contents');
                            // Render markdown content
                            markdown.isTrusted = true;
                            const markdownResult = store.add(renderMarkdown(markdown));
                            container.appendChild(markdownResult.element);
                            // Add divider
                            const divider = $('hr.mcp-hover-divider');
                            container.appendChild(divider);
                            // Add checkbox for mcpAutoStartConfig setting
                            const checkboxContainer = $('div.mcp-hover-setting');
                            const settingLabelStr = localize('mcp.autoStart', "Automatically start MCP servers when sending a chat message");
                            const checkbox = store.add(new Checkbox(settingLabelStr, config.get() !== "never" /* McpAutoStartValue.Never */, { ...defaultCheckboxStyles }));
                            checkboxContainer.appendChild(checkbox.domNode);
                            // Add label next to checkbox
                            const settingLabel = $('span.mcp-hover-setting-label', undefined, settingLabelStr);
                            checkboxContainer.appendChild(settingLabel);
                            const onChange = () => {
                                const newValue = checkbox.checked ? "newAndOutdated" /* McpAutoStartValue.NewAndOutdated */ : "never" /* McpAutoStartValue.Never */;
                                configurationService.updateValue(mcpAutoStartConfig, newValue);
                            };
                            store.add(checkbox.onChange(onChange));
                            store.add(addDisposableListener(settingLabel, EventType.CLICK, () => {
                                checkbox.checked = !checkbox.checked;
                                onChange();
                            }));
                            container.appendChild(checkboxContainer);
                            return container;
                        },
                    };
                }
                getLabelForState({ state, servers } = displayedStateCurrent.get()) {
                    if (state === 1 /* DisplayedState.NewTools */) {
                        return localize('mcp.newTools', "New tools available ({0})", servers.length || 1);
                    }
                    else if (state === 2 /* DisplayedState.Error */) {
                        return localize('mcp.toolError', "Error loading {0} tool(s)", servers.length || 1);
                    }
                    else if (state === 3 /* DisplayedState.Refreshing */) {
                        return localize('mcp.toolRefresh', "Discovering tools...");
                    }
                    else {
                        return null;
                    }
                }
            }, action, { ...options, keybindingNotRenderedWithLabel: true });
        }, Event.fromObservableLight(actionItemState)));
    }
};
MCPServerActionRendering = __decorate([
    __param(0, IActionViewItemService),
    __param(1, IMcpService),
    __param(2, IInstantiationService),
    __param(3, ICommandService),
    __param(4, IConfigurationService)
], MCPServerActionRendering);
export { MCPServerActionRendering };
export class ResetMcpTrustCommand extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.resetTrust" /* McpCommandIds.ResetTrust */,
            title: localize2('mcp.resetTrust', "Reset Trust"),
            category,
            f1: true,
            precondition: ContextKeyExpr.and(McpContextKeys.toolsCount.greater(0), ChatContextKeys.Setup.hidden.negate()),
        });
    }
    run(accessor) {
        const mcpService = accessor.get(IMcpService);
        mcpService.resetTrust();
    }
}
export class ResetMcpCachedTools extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.resetCachedTools" /* McpCommandIds.ResetCachedTools */,
            title: localize2('mcp.resetCachedTools', "Reset Cached Tools"),
            category,
            f1: true,
            precondition: ContextKeyExpr.and(McpContextKeys.toolsCount.greater(0), ChatContextKeys.Setup.hidden.negate()),
        });
    }
    run(accessor) {
        const mcpService = accessor.get(IMcpService);
        mcpService.resetCaches();
    }
}
export class AddConfigurationAction extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.addConfiguration" /* McpCommandIds.AddConfiguration */,
            title: localize2('mcp.addConfiguration', "Add Server..."),
            metadata: {
                description: localize2('mcp.addConfiguration.description', "Installs a new Model Context protocol to the mcp.json settings"),
            },
            category,
            f1: true,
            precondition: ChatContextKeys.Setup.hidden.negate(),
            menu: {
                id: MenuId.EditorContent,
                when: ContextKeyExpr.and(ContextKeyExpr.regex(ResourceContextKey.Path.key, /\.vscode[/\\]mcp\.json$/), ActiveEditorContext.isEqualTo(TEXT_FILE_EDITOR_ID), ChatContextKeys.Setup.hidden.negate())
            }
        });
    }
    async run(accessor, configUri) {
        const instantiationService = accessor.get(IInstantiationService);
        const workspaceService = accessor.get(IWorkspaceContextService);
        const target = configUri ? workspaceService.getWorkspaceFolder(URI.parse(configUri)) : undefined;
        return instantiationService.createInstance(McpAddConfigurationCommand, target ?? undefined).run();
    }
}
export class RemoveStoredInput extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.removeStoredInput" /* McpCommandIds.RemoveStoredInput */,
            title: localize2('mcp.resetCachedTools', "Reset Cached Tools"),
            category,
            f1: false,
        });
    }
    run(accessor, scope, id) {
        accessor.get(IMcpRegistry).clearSavedInputs(scope, id);
    }
}
export class EditStoredInput extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.editStoredInput" /* McpCommandIds.EditStoredInput */,
            title: localize2('mcp.editStoredInput', "Edit Stored Input"),
            category,
            f1: false,
        });
    }
    run(accessor, inputId, uri, configSection, target) {
        const workspaceFolder = uri && accessor.get(IWorkspaceContextService).getWorkspaceFolder(uri);
        accessor.get(IMcpRegistry).editSavedInput(inputId, workspaceFolder || undefined, configSection, target);
    }
}
export class ShowConfiguration extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.showConfiguration" /* McpCommandIds.ShowConfiguration */,
            title: localize2('mcp.command.showConfiguration', "Show Configuration"),
            category,
            f1: false,
        });
    }
    run(accessor, collectionId, serverId) {
        const collection = accessor.get(IMcpRegistry).collections.get().find(c => c.id === collectionId);
        if (!collection) {
            return;
        }
        const server = collection?.serverDefinitions.get().find(s => s.id === serverId);
        const editorService = accessor.get(IEditorService);
        if (server?.presentation?.origin) {
            editorService.openEditor({
                resource: server.presentation.origin.uri,
                options: { selection: server.presentation.origin.range }
            });
        }
        else if (collection.presentation?.origin) {
            editorService.openEditor({
                resource: collection.presentation.origin,
            });
        }
    }
}
export class ShowOutput extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.showOutput" /* McpCommandIds.ShowOutput */,
            title: localize2('mcp.command.showOutput', "Show Output"),
            category,
            f1: false,
        });
    }
    run(accessor, serverId) {
        accessor.get(IMcpService).servers.get().find(s => s.definition.id === serverId)?.showOutput();
    }
}
export class RestartServer extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.restartServer" /* McpCommandIds.RestartServer */,
            title: localize2('mcp.command.restartServer', "Restart Server"),
            category,
            f1: false,
        });
    }
    async run(accessor, serverId, opts) {
        const s = accessor.get(IMcpService).servers.get().find(s => s.definition.id === serverId);
        s?.showOutput();
        await s?.stop();
        await s?.start({ promptType: 'all-untrusted', ...opts });
    }
}
export class StartServer extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.startServer" /* McpCommandIds.StartServer */,
            title: localize2('mcp.command.startServer', "Start Server"),
            category,
            f1: false,
        });
    }
    async run(accessor, serverId, opts) {
        const s = accessor.get(IMcpService).servers.get().find(s => s.definition.id === serverId);
        await s?.start({ promptType: 'all-untrusted', ...opts });
    }
}
export class StopServer extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.stopServer" /* McpCommandIds.StopServer */,
            title: localize2('mcp.command.stopServer', "Stop Server"),
            category,
            f1: false,
        });
    }
    async run(accessor, serverId) {
        const s = accessor.get(IMcpService).servers.get().find(s => s.definition.id === serverId);
        await s?.stop();
    }
}
export class McpBrowseCommand extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.browseServers" /* McpCommandIds.Browse */,
            title: localize2('mcp.command.browse', "MCP Servers"),
            tooltip: localize2('mcp.command.browse.tooltip', "Browse MCP Servers"),
            category,
            icon: Codicon.search,
            precondition: ChatContextKeys.Setup.hidden.negate(),
            menu: [{
                    id: extensionsFilterSubMenu,
                    group: '1_predefined',
                    order: 1,
                    when: ChatContextKeys.Setup.hidden.negate(),
                }, {
                    id: MenuId.ViewTitle,
                    when: ContextKeyExpr.and(ContextKeyExpr.equals('view', InstalledMcpServersViewId), ChatContextKeys.Setup.hidden.negate()),
                    group: 'navigation',
                }],
        });
    }
    async run(accessor) {
        accessor.get(IExtensionsWorkbenchService).openSearch('@mcp ');
    }
}
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
    command: {
        id: "workbench.mcp.browseServers" /* McpCommandIds.Browse */,
        title: localize2('mcp.command.browse.mcp', "Browse MCP Servers"),
        category,
        precondition: ChatContextKeys.Setup.hidden.negate(),
    },
});
export class ShowInstalledMcpServersCommand extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.showInstalledServers" /* McpCommandIds.ShowInstalled */,
            title: localize2('mcp.command.show.installed', "Show Installed Servers"),
            category,
            precondition: ContextKeyExpr.and(HasInstalledMcpServersContext, ChatContextKeys.Setup.hidden.negate()),
            f1: true,
        });
    }
    async run(accessor) {
        const viewsService = accessor.get(IViewsService);
        const view = await viewsService.openView(InstalledMcpServersViewId, true);
        if (!view) {
            await viewsService.openViewContainer(VIEW_CONTAINER.id);
            await viewsService.openView(InstalledMcpServersViewId, true);
        }
    }
}
MenuRegistry.appendMenuItem(CHAT_CONFIG_MENU_ID, {
    command: {
        id: "workbench.mcp.showInstalledServers" /* McpCommandIds.ShowInstalled */,
        title: localize2('mcp.servers', "MCP Servers")
    },
    when: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.equals('view', ChatViewId)),
    order: 10,
    group: '2_level'
});
class OpenMcpResourceCommand extends Action2 {
    async run(accessor) {
        const fileService = accessor.get(IFileService);
        const editorService = accessor.get(IEditorService);
        const resource = await this.getURI(accessor);
        if (!(await fileService.exists(resource))) {
            await fileService.createFile(resource, VSBuffer.fromString(JSON.stringify({ servers: {} }, null, '\t')));
        }
        await editorService.openEditor({ resource });
    }
}
export class OpenUserMcpResourceCommand extends OpenMcpResourceCommand {
    constructor() {
        super({
            id: "workbench.mcp.openUserMcpJson" /* McpCommandIds.OpenUserMcp */,
            title: localize2('mcp.command.openUserMcp', "Open User Configuration"),
            category,
            f1: true,
            precondition: ChatContextKeys.Setup.hidden.negate(),
        });
    }
    getURI(accessor) {
        const userDataProfileService = accessor.get(IUserDataProfileService);
        return Promise.resolve(userDataProfileService.currentProfile.mcpResource);
    }
}
export class OpenRemoteUserMcpResourceCommand extends OpenMcpResourceCommand {
    constructor() {
        super({
            id: "workbench.mcp.openRemoteUserMcpJson" /* McpCommandIds.OpenRemoteUserMcp */,
            title: localize2('mcp.command.openRemoteUserMcp', "Open Remote User Configuration"),
            category,
            f1: true,
            precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), RemoteNameContext.notEqualsTo(''))
        });
    }
    async getURI(accessor) {
        const userDataProfileService = accessor.get(IUserDataProfileService);
        const remoteUserDataProfileService = accessor.get(IRemoteUserDataProfilesService);
        const remoteProfile = await remoteUserDataProfileService.getRemoteProfile(userDataProfileService.currentProfile);
        return remoteProfile.mcpResource;
    }
}
export class OpenWorkspaceFolderMcpResourceCommand extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.openWorkspaceFolderMcpJson" /* McpCommandIds.OpenWorkspaceFolderMcp */,
            title: localize2('mcp.command.openWorkspaceFolderMcp', "Open Workspace Folder MCP Configuration"),
            category,
            f1: true,
            precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), WorkspaceFolderCountContext.notEqualsTo(0))
        });
    }
    async run(accessor) {
        const workspaceContextService = accessor.get(IWorkspaceContextService);
        const commandService = accessor.get(ICommandService);
        const editorService = accessor.get(IEditorService);
        const workspaceFolders = workspaceContextService.getWorkspace().folders;
        const workspaceFolder = workspaceFolders.length === 1 ? workspaceFolders[0] : await commandService.executeCommand(PICK_WORKSPACE_FOLDER_COMMAND_ID);
        if (workspaceFolder) {
            await editorService.openEditor({ resource: workspaceFolder.toResource(WORKSPACE_STANDALONE_CONFIGURATIONS[MCP_CONFIGURATION_KEY]) });
        }
    }
}
export class OpenWorkspaceMcpResourceCommand extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.openWorkspaceMcpJson" /* McpCommandIds.OpenWorkspaceMcp */,
            title: localize2('mcp.command.openWorkspaceMcp', "Open Workspace MCP Configuration"),
            category,
            f1: true,
            precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), WorkbenchStateContext.isEqualTo('workspace'))
        });
    }
    async run(accessor) {
        const workspaceContextService = accessor.get(IWorkspaceContextService);
        const editorService = accessor.get(IEditorService);
        const workspaceConfiguration = workspaceContextService.getWorkspace().configuration;
        if (workspaceConfiguration) {
            await editorService.openEditor({ resource: workspaceConfiguration });
        }
    }
}
export class McpBrowseResourcesCommand extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.browseResources" /* McpCommandIds.BrowseResources */,
            title: localize2('mcp.browseResources', "Browse Resources..."),
            category,
            precondition: ContextKeyExpr.and(McpContextKeys.serverCount.greater(0), ChatContextKeys.Setup.hidden.negate()),
            f1: true,
        });
    }
    run(accessor, server) {
        if (server) {
            accessor.get(IInstantiationService).createInstance(McpResourceQuickPick, server).pick();
        }
        else {
            accessor.get(IQuickInputService).quickAccess.show(McpResourceQuickAccess.PREFIX);
        }
    }
}
export class McpConfigureSamplingModels extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.configureSamplingModels" /* McpCommandIds.ConfigureSamplingModels */,
            title: localize2('mcp.configureSamplingModels', "Configure SamplingModel"),
            category,
        });
    }
    async run(accessor, server) {
        const quickInputService = accessor.get(IQuickInputService);
        const lmService = accessor.get(ILanguageModelsService);
        const mcpSampling = accessor.get(IMcpSamplingService);
        const existingIds = new Set(mcpSampling.getConfig(server).allowedModels);
        const allItems = lmService.getLanguageModelIds().map(id => {
            const model = lmService.lookupLanguageModel(id);
            if (!model.isUserSelectable) {
                return undefined;
            }
            return {
                label: model.name,
                description: model.tooltip,
                id,
                picked: existingIds.size ? existingIds.has(id) : model.isDefault,
            };
        }).filter(isDefined);
        allItems.sort((a, b) => (b.picked ? 1 : 0) - (a.picked ? 1 : 0) || a.label.localeCompare(b.label));
        // do the quickpick selection
        const picked = await quickInputService.pick(allItems, {
            placeHolder: localize('mcp.configureSamplingModels.ph', 'Pick the models {0} can access via MCP sampling', server.definition.label),
            canPickMany: true,
        });
        if (picked) {
            await mcpSampling.updateConfig(server, c => c.allowedModels = picked.map(p => p.id));
        }
        return picked?.length || 0;
    }
}
export class McpStartPromptingServerCommand extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.startPromptForServer" /* McpCommandIds.StartPromptForServer */,
            title: localize2('mcp.startPromptingServer', "Start Prompting Server"),
            category,
            f1: false,
        });
    }
    async run(accessor, server) {
        const widget = await openPanelChatAndGetWidget(accessor.get(IViewsService), accessor.get(IChatWidgetService));
        if (!widget) {
            return;
        }
        const editor = widget.inputEditor;
        const model = editor.getModel();
        if (!model) {
            return;
        }
        const range = (editor.getSelection() || model.getFullModelRange()).collapseToEnd();
        const text = mcpPromptPrefix(server.definition) + '.';
        model.applyEdits([{ range, text }]);
        editor.setSelection(Range.fromPositions(range.getEndPosition().delta(0, text.length)));
        widget.focusInput();
        SuggestController.get(editor)?.triggerSuggest();
    }
}
export class McpSkipCurrentAutostartCommand extends Action2 {
    constructor() {
        super({
            id: "workbench.mcp.skipAutostart" /* McpCommandIds.SkipCurrentAutostart */,
            title: localize2('mcp.skipCurrentAutostart', "Skip Current Autostart"),
            category,
            f1: false,
        });
    }
    async run(accessor) {
        accessor.get(IMcpService).cancelAutostart();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwQ29tbWFuZHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2Jyb3dzZXIvbWNwQ29tbWFuZHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLENBQUMsRUFBRSxxQkFBcUIsRUFBRSx3QkFBd0IsRUFBRSxTQUFTLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNoSCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFFOUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDakUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUseUJBQXlCLEVBQUUsY0FBYyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbkcsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakcsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsZUFBZSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDdEgsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9B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