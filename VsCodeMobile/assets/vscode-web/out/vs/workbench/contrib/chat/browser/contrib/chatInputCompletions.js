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
var BuiltinDynamicCompletions_1, ToolCompletions_1;
import { coalesce } from '../../../../../base/common/arrays.js';
import { raceTimeout } from '../../../../../base/common/async.js';
import { decodeBase64 } from '../../../../../base/common/buffer.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { isPatternInWord } from '../../../../../base/common/filters.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ResourceSet } from '../../../../../base/common/map.js';
import { Schemas } from '../../../../../base/common/network.js';
import { basename } from '../../../../../base/common/resources.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { assertType } from '../../../../../base/common/types.js';
import { URI } from '../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { getCodeEditor, isCodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { getWordAtText } from '../../../../../editor/common/core/wordHelper.js';
import { SymbolKinds } from '../../../../../editor/common/languages.js';
import { ILanguageFeaturesService } from '../../../../../editor/common/services/languageFeatures.js';
import { IOutlineModelService } from '../../../../../editor/contrib/documentSymbols/browser/outlineModel.js';
import { localize } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { FileKind, IFileService } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { Extensions as WorkbenchExtensions } from '../../../../common/contributions.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IHistoryService } from '../../../../services/history/common/history.js';
import { ISearchService } from '../../../../services/search/common/search.js';
import { McpPromptArgumentPick } from '../../../mcp/browser/mcpPromptArgumentPick.js';
import { IMcpService, McpResourceURI } from '../../../mcp/common/mcpTypes.js';
import { searchFilesAndFolders } from '../../../search/browser/searchChatContext.js';
import { IChatAgentNameService, IChatAgentService, getFullyQualifiedId } from '../../common/chatAgents.js';
import { IChatEditingService } from '../../common/chatEditingService.js';
import { getAttachableImageExtension } from '../../common/chatModel.js';
import { ChatRequestAgentPart, ChatRequestAgentSubcommandPart, ChatRequestSlashPromptPart, ChatRequestTextPart, ChatRequestToolPart, ChatRequestToolSetPart, chatAgentLeader, chatSubcommandLeader, chatVariableLeader } from '../../common/chatParserTypes.js';
import { IChatSlashCommandService } from '../../common/chatSlashCommands.js';
import { ChatAgentLocation, ChatModeKind, isSupportedChatFileScheme } from '../../common/constants.js';
import { ToolSet } from '../../common/languageModelToolsService.js';
import { IPromptsService } from '../../common/promptSyntax/service/promptsService.js';
import { ChatSubmitAction } from '../actions/chatExecuteActions.js';
import { IChatWidgetService } from '../chat.js';
import { resizeImage } from '../imageUtils.js';
import { ChatDynamicVariableModel } from './chatDynamicVariables.js';
let SlashCommandCompletions = class SlashCommandCompletions extends Disposable {
    constructor(languageFeaturesService, chatWidgetService, chatSlashCommandService, promptsService, mcpService) {
        super();
        this.languageFeaturesService = languageFeaturesService;
        this.chatWidgetService = chatWidgetService;
        this.chatSlashCommandService = chatSlashCommandService;
        this.promptsService = promptsService;
        this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
            _debugDisplayName: 'globalSlashCommands',
            triggerCharacters: [chatSubcommandLeader],
            provideCompletionItems: async (model, position, _context, _token) => {
                const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
                if (!widget || !widget.viewModel) {
                    return null;
                }
                if (widget.lockedAgentId) {
                    return null;
                }
                const range = computeCompletionRanges(model, position, /\/\w*/g);
                if (!range) {
                    return null;
                }
                if (!isEmptyUpToCompletionWord(model, range)) {
                    // No text allowed before the completion
                    return;
                }
                const parsedRequest = widget.parsedInput.parts;
                const usedAgent = parsedRequest.find(p => p instanceof ChatRequestAgentPart);
                if (usedAgent) {
                    // No (classic) global slash commands when an agent is used
                    return;
                }
                const slashCommands = this.chatSlashCommandService.getCommands(widget.location, widget.input.currentModeKind);
                if (!slashCommands) {
                    return null;
                }
                return {
                    suggestions: slashCommands.map((c, i) => {
                        const withSlash = `/${c.command}`;
                        return {
                            label: withSlash,
                            insertText: c.executeImmediately ? '' : `${withSlash} `,
                            documentation: c.detail,
                            range,
                            sortText: c.sortText ?? 'a'.repeat(i + 1),
                            kind: 18 /* CompletionItemKind.Text */, // The icons are disabled here anyway,
                            command: c.executeImmediately ? { id: ChatSubmitAction.ID, title: withSlash, arguments: [{ widget, inputValue: `${withSlash} ` }] } : undefined,
                        };
                    })
                };
            }
        }));
        this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
            _debugDisplayName: 'globalSlashCommandsAt',
            triggerCharacters: [chatAgentLeader],
            provideCompletionItems: async (model, position, _context, _token) => {
                const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
                if (!widget || !widget.viewModel) {
                    return null;
                }
                const range = computeCompletionRanges(model, position, /@\w*/g);
                if (!range) {
                    return null;
                }
                if (!isEmptyUpToCompletionWord(model, range)) {
                    // No text allowed before the completion
                    return;
                }
                const slashCommands = this.chatSlashCommandService.getCommands(widget.location, widget.input.currentModeKind);
                if (!slashCommands) {
                    return null;
                }
                if (widget.lockedAgentId) {
                    return null;
                }
                return {
                    suggestions: slashCommands.map((c, i) => {
                        const withSlash = `${chatSubcommandLeader}${c.command}`;
                        return {
                            label: withSlash,
                            insertText: c.executeImmediately ? '' : `${withSlash} `,
                            documentation: c.detail,
                            range,
                            filterText: `${chatAgentLeader}${c.command}`,
                            sortText: c.sortText ?? 'z'.repeat(i + 1),
                            kind: 18 /* CompletionItemKind.Text */, // The icons are disabled here anyway,
                            command: c.executeImmediately ? { id: ChatSubmitAction.ID, title: withSlash, arguments: [{ widget, inputValue: `${withSlash} ` }] } : undefined,
                        };
                    })
                };
            }
        }));
        this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
            _debugDisplayName: 'promptSlashCommands',
            triggerCharacters: [chatSubcommandLeader],
            provideCompletionItems: async (model, position, _context, token) => {
                const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
                if (!widget || !widget.viewModel) {
                    return null;
                }
                const range = computeCompletionRanges(model, position, /\/\w*/g);
                if (!range) {
                    return null;
                }
                if (!isEmptyUpToCompletionWord(model, range)) {
                    // No text allowed before the completion
                    return;
                }
                const parsedRequest = widget.parsedInput.parts;
                const usedAgent = parsedRequest.find(p => p instanceof ChatRequestAgentPart);
                if (usedAgent) {
                    // No (classic) global slash commands when an agent is used
                    return;
                }
                const promptCommands = await this.promptsService.getPromptSlashCommands(token);
                if (promptCommands.length === 0) {
                    return null;
                }
                if (widget.lockedAgentId) {
                    return null;
                }
                return {
                    suggestions: promptCommands.map((c, i) => {
                        const label = `/${c.name}`;
                        const description = c.description;
                        return {
                            label: { label, description },
                            insertText: `${label} `,
                            documentation: c.description,
                            range,
                            sortText: 'a'.repeat(i + 1),
                            kind: 18 /* CompletionItemKind.Text */, // The icons are disabled here anyway,
                        };
                    })
                };
            }
        }));
        this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
            _debugDisplayName: 'mcpPromptSlashCommands',
            triggerCharacters: [chatSubcommandLeader],
            provideCompletionItems: async (model, position, _context, _token) => {
                const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
                if (!widget || !widget.viewModel) {
                    return null;
                }
                // regex is the opposite of `mcpPromptReplaceSpecialChars` found in `mcpTypes.ts`
                const range = computeCompletionRanges(model, position, /\/[a-z0-9_.-]*/g);
                if (!range) {
                    return null;
                }
                if (!isEmptyUpToCompletionWord(model, range)) {
                    // No text allowed before the completion
                    return;
                }
                if (widget.lockedAgentId) {
                    return null;
                }
                return {
                    suggestions: mcpService.servers.get().flatMap(server => server.prompts.get().map((prompt) => {
                        const label = `/mcp.${prompt.id}`;
                        return {
                            label: { label, description: prompt.description },
                            command: {
                                id: StartParameterizedPromptAction.ID,
                                title: prompt.name,
                                arguments: [model, server, prompt, `${label} `],
                            },
                            insertText: `${label} `,
                            range,
                            kind: 18 /* CompletionItemKind.Text */,
                        };
                    }))
                };
            }
        }));
    }
};
SlashCommandCompletions = __decorate([
    __param(0, ILanguageFeaturesService),
    __param(1, IChatWidgetService),
    __param(2, IChatSlashCommandService),
    __param(3, IPromptsService),
    __param(4, IMcpService)
], SlashCommandCompletions);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(SlashCommandCompletions, 4 /* LifecyclePhase.Eventually */);
let AgentCompletions = class AgentCompletions extends Disposable {
    constructor(languageFeaturesService, chatWidgetService, chatAgentService, chatAgentNameService) {
        super();
        this.languageFeaturesService = languageFeaturesService;
        this.chatWidgetService = chatWidgetService;
        this.chatAgentService = chatAgentService;
        this.chatAgentNameService = chatAgentNameService;
        const subCommandProvider = {
            _debugDisplayName: 'chatAgentSubcommand',
            triggerCharacters: [chatSubcommandLeader],
            provideCompletionItems: async (model, position, _context, token) => {
                const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
                if (!widget || !widget.viewModel) {
                    return;
                }
                const range = computeCompletionRanges(model, position, /\/\w*/g);
                if (!range) {
                    return;
                }
                const usedAgent = this.getCurrentAgentForWidget(widget);
                if (!usedAgent || usedAgent.command) {
                    // Only one allowed
                    return;
                }
                return {
                    suggestions: usedAgent.agent.slashCommands.map((c, i) => {
                        const withSlash = `/${c.name}`;
                        return {
                            label: withSlash,
                            insertText: `${withSlash} `,
                            documentation: c.description,
                            range,
                            kind: 18 /* CompletionItemKind.Text */, // The icons are disabled here anyway
                        };
                    })
                };
            }
        };
        this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, subCommandProvider));
        this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
            _debugDisplayName: 'chatAgentAndSubcommand',
            triggerCharacters: [chatAgentLeader],
            provideCompletionItems: async (model, position, _context, token) => {
                const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
                const viewModel = widget?.viewModel;
                if (!widget || !viewModel) {
                    return;
                }
                if (widget.lockedAgentId) {
                    return null;
                }
                const range = computeCompletionRanges(model, position, /(@|\/)\w*/g);
                if (!range) {
                    return null;
                }
                if (!isEmptyUpToCompletionWord(model, range)) {
                    // No text allowed before the completion
                    return;
                }
                const agents = this.chatAgentService.getAgents()
                    .filter(a => a.locations.includes(widget.location));
                // When the input is only `/`, items are sorted by sortText.
                // When typing, filterText is used to score and sort.
                // The same list is refiltered/ranked while typing.
                const getFilterText = (agent, command) => {
                    // This is hacking the filter algorithm to make @terminal /explain match worse than @workspace /explain by making its match index later in the string.
                    // When I type `/exp`, the workspace one should be sorted over the terminal one.
                    const dummyPrefix = agent.id === 'github.copilot.terminalPanel' ? `0000` : ``;
                    return `${chatAgentLeader}${dummyPrefix}${agent.name}.${command}`;
                };
                const justAgents = agents
                    .filter(a => !a.isDefault)
                    .map(agent => {
                    const { label: agentLabel, isDupe } = this.getAgentCompletionDetails(agent);
                    const detail = agent.description;
                    return {
                        label: isDupe ?
                            { label: agentLabel, description: agent.description, detail: ` (${agent.publisherDisplayName})` } :
                            agentLabel,
                        documentation: detail,
                        filterText: `${chatAgentLeader}${agent.name}`,
                        insertText: `${agentLabel} `,
                        range,
                        kind: 18 /* CompletionItemKind.Text */,
                        sortText: `${chatAgentLeader}${agent.name}`,
                        command: { id: AssignSelectedAgentAction.ID, title: AssignSelectedAgentAction.ID, arguments: [{ agent, widget }] },
                    };
                });
                return {
                    suggestions: justAgents.concat(coalesce(agents.flatMap(agent => agent.slashCommands.map((c, i) => {
                        if (agent.isDefault && this.chatAgentService.getDefaultAgent(widget.location, widget.input.currentModeKind)?.id !== agent.id) {
                            return;
                        }
                        const { label: agentLabel, isDupe } = this.getAgentCompletionDetails(agent);
                        const label = `${agentLabel} ${chatSubcommandLeader}${c.name}`;
                        const item = {
                            label: isDupe ?
                                { label, description: c.description, detail: isDupe ? ` (${agent.publisherDisplayName})` : undefined } :
                                label,
                            documentation: c.description,
                            filterText: getFilterText(agent, c.name),
                            commitCharacters: [' '],
                            insertText: label + ' ',
                            range,
                            kind: 18 /* CompletionItemKind.Text */, // The icons are disabled here anyway
                            sortText: `x${chatAgentLeader}${agent.name}${c.name}`,
                            command: { id: AssignSelectedAgentAction.ID, title: AssignSelectedAgentAction.ID, arguments: [{ agent, widget }] },
                        };
                        if (agent.isDefault) {
                            // default agent isn't mentioned nor inserted
                            const label = `${chatSubcommandLeader}${c.name}`;
                            item.label = label;
                            item.insertText = `${label} `;
                            item.documentation = c.description;
                        }
                        return item;
                    }))))
                };
            }
        }));
        this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
            _debugDisplayName: 'chatAgentAndSubcommand',
            triggerCharacters: [chatSubcommandLeader],
            provideCompletionItems: async (model, position, _context, token) => {
                const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
                const viewModel = widget?.viewModel;
                if (!widget || !viewModel) {
                    return;
                }
                if (widget.lockedAgentId) {
                    return null;
                }
                const range = computeCompletionRanges(model, position, /(@|\/)\w*/g);
                if (!range) {
                    return null;
                }
                if (!isEmptyUpToCompletionWord(model, range)) {
                    // No text allowed before the completion
                    return;
                }
                const agents = this.chatAgentService.getAgents()
                    .filter(a => a.locations.includes(widget.location) && a.modes.includes(widget.input.currentModeKind));
                return {
                    suggestions: coalesce(agents.flatMap(agent => agent.slashCommands.map((c, i) => {
                        if (agent.isDefault && this.chatAgentService.getDefaultAgent(widget.location, widget.input.currentModeKind)?.id !== agent.id) {
                            return;
                        }
                        const { label: agentLabel, isDupe } = this.getAgentCompletionDetails(agent);
                        const withSlash = `${chatSubcommandLeader}${c.name}`;
                        const extraSortText = agent.id === 'github.copilot.terminalPanel' ? `z` : ``;
                        const sortText = `${chatSubcommandLeader}${extraSortText}${agent.name}${c.name}`;
                        const item = {
                            label: { label: withSlash, description: agentLabel, detail: isDupe ? ` (${agent.publisherDisplayName})` : undefined },
                            commitCharacters: [' '],
                            insertText: `${agentLabel} ${withSlash} `,
                            documentation: `(${agentLabel}) ${c.description ?? ''}`,
                            range,
                            kind: 18 /* CompletionItemKind.Text */, // The icons are disabled here anyway
                            sortText,
                            command: { id: AssignSelectedAgentAction.ID, title: AssignSelectedAgentAction.ID, arguments: [{ agent, widget }] },
                        };
                        if (agent.isDefault) {
                            // default agent isn't mentioned nor inserted
                            const label = `${chatSubcommandLeader}${c.name}`;
                            item.label = label;
                            item.insertText = `${label} `;
                            item.documentation = c.description;
                        }
                        return item;
                    })))
                };
            }
        }));
        this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
            _debugDisplayName: 'installChatExtensions',
            triggerCharacters: [chatAgentLeader],
            provideCompletionItems: async (model, position, _context, token) => {
                if (!model.getLineContent(1).startsWith(chatAgentLeader)) {
                    return;
                }
                const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
                if (widget?.location !== ChatAgentLocation.Chat || widget.input.currentModeKind !== ChatModeKind.Ask) {
                    return;
                }
                if (widget.lockedAgentId) {
                    return null;
                }
                const range = computeCompletionRanges(model, position, /(@|\/)\w*/g);
                if (!range) {
                    return;
                }
                if (!isEmptyUpToCompletionWord(model, range)) {
                    // No text allowed before the completion
                    return;
                }
                const label = localize('installLabel', "Install Chat Extensions...");
                const item = {
                    label,
                    insertText: '',
                    range,
                    kind: 18 /* CompletionItemKind.Text */, // The icons are disabled here anyway
                    command: { id: 'workbench.extensions.search', title: '', arguments: ['@tag:chat-participant'] },
                    filterText: chatAgentLeader + label,
                    sortText: 'zzz'
                };
                return {
                    suggestions: [item]
                };
            }
        }));
    }
    getCurrentAgentForWidget(widget) {
        if (widget.lockedAgentId) {
            const usedAgent = this.chatAgentService.getAgent(widget.lockedAgentId);
            return usedAgent && { agent: usedAgent };
        }
        const parsedRequest = widget.parsedInput.parts;
        const usedAgentIdx = parsedRequest.findIndex((p) => p instanceof ChatRequestAgentPart);
        if (usedAgentIdx < 0) {
            return;
        }
        const usedAgent = parsedRequest[usedAgentIdx];
        const usedOtherCommand = parsedRequest.find(p => p instanceof ChatRequestAgentSubcommandPart || p instanceof ChatRequestSlashPromptPart);
        if (usedOtherCommand) {
            // Only one allowed
            return {
                agent: usedAgent.agent,
                command: usedOtherCommand instanceof ChatRequestAgentSubcommandPart ? usedOtherCommand.command.name : undefined
            };
        }
        for (const partAfterAgent of parsedRequest.slice(usedAgentIdx + 1)) {
            // Could allow text after 'position'
            if (!(partAfterAgent instanceof ChatRequestTextPart) || !partAfterAgent.text.trim().match(/^(\/\w*)?$/)) {
                // No text allowed between agent and subcommand
                return;
            }
        }
        return { agent: usedAgent.agent };
    }
    getAgentCompletionDetails(agent) {
        const isAllowed = this.chatAgentNameService.getAgentNameRestriction(agent);
        const agentLabel = `${chatAgentLeader}${isAllowed ? agent.name : getFullyQualifiedId(agent)}`;
        const isDupe = isAllowed && this.chatAgentService.agentHasDupeName(agent.id);
        return { label: agentLabel, isDupe };
    }
};
AgentCompletions = __decorate([
    __param(0, ILanguageFeaturesService),
    __param(1, IChatWidgetService),
    __param(2, IChatAgentService),
    __param(3, IChatAgentNameService)
], AgentCompletions);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(AgentCompletions, 4 /* LifecyclePhase.Eventually */);
class AssignSelectedAgentAction extends Action2 {
    static { this.ID = 'workbench.action.chat.assignSelectedAgent'; }
    constructor() {
        super({
            id: AssignSelectedAgentAction.ID,
            title: '' // not displayed
        });
    }
    async run(accessor, ...args) {
        const arg = args[0];
        if (!arg || !arg.widget || !arg.agent) {
            return;
        }
        if (!arg.agent.modes.includes(arg.widget.input.currentModeKind)) {
            arg.widget.input.setChatMode(arg.agent.modes[0]);
        }
        arg.widget.lastSelectedAgent = arg.agent;
    }
}
registerAction2(AssignSelectedAgentAction);
class StartParameterizedPromptAction extends Action2 {
    static { this.ID = 'workbench.action.chat.startParameterizedPrompt'; }
    constructor() {
        super({
            id: StartParameterizedPromptAction.ID,
            title: '' // not displayed
        });
    }
    async run(accessor, model, server, prompt, textToReplace) {
        if (!model || !prompt) {
            return;
        }
        const instantiationService = accessor.get(IInstantiationService);
        const notificationService = accessor.get(INotificationService);
        const widgetService = accessor.get(IChatWidgetService);
        const fileService = accessor.get(IFileService);
        const chatWidget = await widgetService.revealWidget(true);
        if (!chatWidget) {
            return;
        }
        const lastPosition = model.getFullModelRange().collapseToEnd();
        const getPromptIndex = () => model.findMatches(textToReplace, true, false, true, null, false)[0];
        const replaceTextWith = (value) => model.applyEdits([{
                range: getPromptIndex()?.range || lastPosition,
                text: value,
            }]);
        const store = new DisposableStore();
        const cts = store.add(new CancellationTokenSource());
        store.add(chatWidget.input.startGenerating());
        store.add(model.onDidChangeContent(() => {
            if (getPromptIndex()) {
                cts.cancel(); // cancel if the user deletes their prompt
            }
        }));
        model.changeDecorations(accessor => {
            const id = accessor.addDecoration(lastPosition, {
                description: 'mcp-prompt-spinner',
                showIfCollapsed: true,
                after: {
                    content: ' ',
                    inlineClassNameAffectsLetterSpacing: true,
                    inlineClassName: ThemeIcon.asClassName(ThemeIcon.modify(Codicon.loading, 'spin')) + ' chat-prompt-spinner',
                }
            });
            store.add(toDisposable(() => {
                model.changeDecorations(a => a.removeDecoration(id));
            }));
        });
        const pick = store.add(instantiationService.createInstance(McpPromptArgumentPick, prompt));
        try {
            // start the server if not already running so that it's ready to resolve
            // the prompt instantly when the user finishes picking arguments.
            await server.start();
            const args = await pick.createArgs();
            if (!args) {
                replaceTextWith('');
                return;
            }
            let messages;
            try {
                messages = await prompt.resolve(args, cts.token);
            }
            catch (e) {
                if (!cts.token.isCancellationRequested) {
                    notificationService.error(localize('mcp.prompt.error', "Error resolving prompt: {0}", String(e)));
                }
                replaceTextWith('');
                return;
            }
            const toAttach = [];
            const attachBlob = async (mimeType, contents, uriStr, isText = false) => {
                let validURI;
                if (uriStr) {
                    for (const uri of [URI.parse(uriStr), McpResourceURI.fromServer(server.definition, uriStr)]) {
                        try {
                            validURI ||= await fileService.exists(uri) ? uri : undefined;
                        }
                        catch {
                            // ignored
                        }
                    }
                }
                if (isText) {
                    if (validURI) {
                        toAttach.push({
                            id: generateUuid(),
                            kind: 'file',
                            value: validURI,
                            name: basename(validURI),
                        });
                    }
                    else {
                        toAttach.push({
                            id: generateUuid(),
                            kind: 'generic',
                            value: contents,
                            name: localize('mcp.prompt.resource', 'Prompt Resource'),
                        });
                    }
                }
                else if (mimeType && getAttachableImageExtension(mimeType)) {
                    const resized = await resizeImage(contents)
                        .catch(() => decodeBase64(contents).buffer);
                    chatWidget.attachmentModel.addContext({
                        id: generateUuid(),
                        name: localize('mcp.prompt.image', 'Prompt Image'),
                        fullName: localize('mcp.prompt.image', 'Prompt Image'),
                        value: resized,
                        kind: 'image',
                        references: validURI && [{ reference: validURI, kind: 'reference' }],
                    });
                }
                else if (validURI) {
                    toAttach.push({
                        id: generateUuid(),
                        kind: 'file',
                        value: validURI,
                        name: basename(validURI),
                    });
                }
                else {
                    // not a valid resource/resource URI
                }
            };
            const hasMultipleRoles = messages.some(m => m.role !== messages[0].role);
            let input = '';
            for (const message of messages) {
                switch (message.content.type) {
                    case 'text':
                        if (input) {
                            input += '\n\n';
                        }
                        if (hasMultipleRoles) {
                            input += `--${message.role.toUpperCase()}\n`;
                        }
                        input += message.content.text;
                        break;
                    case 'resource':
                        if ('text' in message.content.resource) {
                            await attachBlob(message.content.resource.mimeType, message.content.resource.text, message.content.resource.uri, true);
                        }
                        else {
                            await attachBlob(message.content.resource.mimeType, message.content.resource.blob, message.content.resource.uri);
                        }
                        break;
                    case 'image':
                    case 'audio':
                        await attachBlob(message.content.mimeType, message.content.data);
                        break;
                }
            }
            if (toAttach.length) {
                chatWidget.attachmentModel.addContext(...toAttach);
            }
            replaceTextWith(input);
        }
        finally {
            store.dispose();
        }
    }
}
registerAction2(StartParameterizedPromptAction);
class ReferenceArgument {
    constructor(widget, variable) {
        this.widget = widget;
        this.variable = variable;
    }
}
let BuiltinDynamicCompletions = class BuiltinDynamicCompletions extends Disposable {
    static { BuiltinDynamicCompletions_1 = this; }
    static { this.addReferenceCommand = '_addReferenceCmd'; }
    static { this.VariableNameDef = new RegExp(`${chatVariableLeader}[\\w:-]*`, 'g'); } // MUST be using `g`-flag
    constructor(historyService, workspaceContextService, searchService, labelService, languageFeaturesService, chatWidgetService, _chatEditingService, outlineService, editorService, configurationService, codeEditorService, chatAgentService, instantiationService) {
        super();
        this.historyService = historyService;
        this.workspaceContextService = workspaceContextService;
        this.searchService = searchService;
        this.labelService = labelService;
        this.languageFeaturesService = languageFeaturesService;
        this.chatWidgetService = chatWidgetService;
        this._chatEditingService = _chatEditingService;
        this.outlineService = outlineService;
        this.editorService = editorService;
        this.configurationService = configurationService;
        this.codeEditorService = codeEditorService;
        this.chatAgentService = chatAgentService;
        this.instantiationService = instantiationService;
        // File/Folder completions in one go and m
        const fileWordPattern = new RegExp(`${chatVariableLeader}[^\\s]*`, 'g');
        this.registerVariableCompletions('fileAndFolder', async ({ widget, range }, token) => {
            if (!widget.supportsFileReferences) {
                return;
            }
            const result = { suggestions: [] };
            // If locked to an agent that doesn't support file attachments, skip
            if (widget.lockedAgentId) {
                const agent = this.chatAgentService.getAgent(widget.lockedAgentId);
                if (agent && !agent.capabilities?.supportsFileAttachments) {
                    return result;
                }
            }
            await this.addFileAndFolderEntries(widget, result, range, token);
            return result;
        }, fileWordPattern);
        // Selection completion
        this.registerVariableCompletions('selection', ({ widget, range }, token) => {
            if (!widget.supportsFileReferences) {
                return;
            }
            if (widget.location === ChatAgentLocation.EditorInline) {
                return;
            }
            const active = this.findActiveCodeEditor();
            if (!isCodeEditor(active)) {
                return;
            }
            const currentResource = active.getModel()?.uri;
            const currentSelection = active.getSelection();
            if (!currentSelection || !currentResource || currentSelection.isEmpty()) {
                return;
            }
            const basename = this.labelService.getUriBasenameLabel(currentResource);
            const text = `${chatVariableLeader}file:${basename}:${currentSelection.startLineNumber}-${currentSelection.endLineNumber}`;
            const fullRangeText = `:${currentSelection.startLineNumber}:${currentSelection.startColumn}-${currentSelection.endLineNumber}:${currentSelection.endColumn}`;
            const description = this.labelService.getUriLabel(currentResource, { relative: true }) + fullRangeText;
            const result = { suggestions: [] };
            result.suggestions.push({
                label: { label: `${chatVariableLeader}selection`, description },
                filterText: `${chatVariableLeader}selection`,
                insertText: range.varWord?.endColumn === range.replace.endColumn ? `${text} ` : text,
                range,
                kind: 18 /* CompletionItemKind.Text */,
                sortText: 'z',
                command: {
                    id: BuiltinDynamicCompletions_1.addReferenceCommand, title: '', arguments: [new ReferenceArgument(widget, {
                            id: 'vscode.selection',
                            isFile: true,
                            range: { startLineNumber: range.replace.startLineNumber, startColumn: range.replace.startColumn, endLineNumber: range.replace.endLineNumber, endColumn: range.replace.startColumn + text.length },
                            data: { range: currentSelection, uri: currentResource }
                        })]
                }
            });
            return result;
        });
        // Symbol completions
        this.registerVariableCompletions('symbol', ({ widget, range, position, model }, token) => {
            if (!widget.supportsFileReferences) {
                return null;
            }
            const result = { suggestions: [] };
            const range2 = computeCompletionRanges(model, position, new RegExp(`${chatVariableLeader}[^\\s]*`, 'g'), true);
            if (range2) {
                this.addSymbolEntries(widget, result, range2, token);
            }
            return result;
        });
        this._register(CommandsRegistry.registerCommand(BuiltinDynamicCompletions_1.addReferenceCommand, (_services, arg) => {
            assertType(arg instanceof ReferenceArgument);
            return this.cmdAddReference(arg);
        }));
    }
    findActiveCodeEditor() {
        const codeEditor = this.codeEditorService.getActiveCodeEditor();
        if (codeEditor) {
            const model = codeEditor.getModel();
            if (model?.uri.scheme === Schemas.vscodeNotebookCell) {
                return undefined;
            }
            if (model) {
                return codeEditor;
            }
        }
        for (const codeOrDiffEditor of this.editorService.getVisibleTextEditorControls(0 /* EditorsOrder.MOST_RECENTLY_ACTIVE */)) {
            const codeEditor = getCodeEditor(codeOrDiffEditor);
            if (!codeEditor) {
                continue;
            }
            const model = codeEditor.getModel();
            if (model) {
                return codeEditor;
            }
        }
        return undefined;
    }
    registerVariableCompletions(debugName, provider, wordPattern = BuiltinDynamicCompletions_1.VariableNameDef) {
        this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
            _debugDisplayName: `chatVarCompletions-${debugName}`,
            triggerCharacters: [chatVariableLeader],
            provideCompletionItems: async (model, position, context, token) => {
                const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
                if (!widget) {
                    return;
                }
                const range = computeCompletionRanges(model, position, wordPattern, true);
                if (range) {
                    return provider({ model, position, widget, range, context }, token);
                }
                return;
            }
        }));
    }
    async addFileAndFolderEntries(widget, result, info, token) {
        const makeCompletionItem = (resource, kind, description, boostPriority) => {
            const basename = this.labelService.getUriBasenameLabel(resource);
            const text = `${chatVariableLeader}file:${basename}`;
            const uriLabel = this.labelService.getUriLabel(resource, { relative: true });
            const labelDescription = description
                ? localize('fileEntryDescription', '{0} ({1})', uriLabel, description)
                : uriLabel;
            // keep files above other completions
            const sortText = boostPriority ? ' ' : '!';
            return {
                label: { label: basename, description: labelDescription },
                filterText: `${chatVariableLeader}${basename}`,
                insertText: info.varWord?.endColumn === info.replace.endColumn ? `${text} ` : text,
                range: info,
                kind: kind === FileKind.FILE ? 20 /* CompletionItemKind.File */ : 23 /* CompletionItemKind.Folder */,
                sortText,
                command: {
                    id: BuiltinDynamicCompletions_1.addReferenceCommand, title: '', arguments: [new ReferenceArgument(widget, {
                            id: resource.toString(),
                            isFile: kind === FileKind.FILE,
                            isDirectory: kind === FileKind.FOLDER,
                            range: { startLineNumber: info.replace.startLineNumber, startColumn: info.replace.startColumn, endLineNumber: info.replace.endLineNumber, endColumn: info.replace.startColumn + text.length },
                            data: resource
                        })]
                }
            };
        };
        let pattern;
        if (info.varWord?.word && info.varWord.word.startsWith(chatVariableLeader)) {
            pattern = info.varWord.word.toLowerCase().slice(1); // remove leading #
        }
        const seen = new ResourceSet();
        const len = result.suggestions.length;
        // HISTORY
        // always take the last N items
        for (const [i, item] of this.historyService.getHistory().entries()) {
            if (!item.resource || seen.has(item.resource) || !this.instantiationService.invokeFunction(accessor => isSupportedChatFileScheme(accessor, item.resource.scheme))) {
                // ignore editors without a resource
                continue;
            }
            if (pattern) {
                // use pattern if available
                const basename = this.labelService.getUriBasenameLabel(item.resource).toLowerCase();
                if (!isPatternInWord(pattern, 0, pattern.length, basename, 0, basename.length)) {
                    continue;
                }
            }
            seen.add(item.resource);
            const newLen = result.suggestions.push(makeCompletionItem(item.resource, FileKind.FILE, i === 0 ? localize('activeFile', 'Active file') : undefined, i === 0));
            if (newLen - len >= 5) {
                break;
            }
        }
        // RELATED FILES
        if (widget.input.currentModeKind !== ChatModeKind.Ask && widget.viewModel && widget.viewModel.model.editingSession) {
            const relatedFiles = (await raceTimeout(this._chatEditingService.getRelatedFiles(widget.viewModel.sessionResource, widget.getInput(), widget.attachmentModel.fileAttachments, token), 200)) ?? [];
            for (const relatedFileGroup of relatedFiles) {
                for (const relatedFile of relatedFileGroup.files) {
                    if (!seen.has(relatedFile.uri)) {
                        seen.add(relatedFile.uri);
                        result.suggestions.push(makeCompletionItem(relatedFile.uri, FileKind.FILE, relatedFile.description));
                    }
                }
            }
        }
        // SEARCH
        // use file search when having a pattern
        if (pattern) {
            const cacheKey = this.updateCacheKey();
            const workspaces = this.workspaceContextService.getWorkspace().folders.map(folder => folder.uri);
            for (const workspace of workspaces) {
                const { folders, files } = await searchFilesAndFolders(workspace, pattern, true, token, cacheKey.key, this.configurationService, this.searchService);
                for (const file of files) {
                    if (!seen.has(file)) {
                        result.suggestions.push(makeCompletionItem(file, FileKind.FILE));
                        seen.add(file);
                    }
                }
                for (const folder of folders) {
                    if (!seen.has(folder)) {
                        result.suggestions.push(makeCompletionItem(folder, FileKind.FOLDER));
                        seen.add(folder);
                    }
                }
            }
        }
        // mark results as incomplete because further typing might yield
        // in more search results
        result.incomplete = true;
    }
    addSymbolEntries(widget, result, info, token) {
        const makeSymbolCompletionItem = (symbolItem, pattern) => {
            const text = `${chatVariableLeader}sym:${symbolItem.name}`;
            const resource = symbolItem.location.uri;
            const uriLabel = this.labelService.getUriLabel(resource, { relative: true });
            const sortText = pattern ? '{' /* after z */ : '|' /* after { */;
            return {
                label: { label: symbolItem.name, description: uriLabel },
                filterText: `${chatVariableLeader}${symbolItem.name}`,
                insertText: info.varWord?.endColumn === info.replace.endColumn ? `${text} ` : text,
                range: info,
                kind: SymbolKinds.toCompletionKind(symbolItem.kind),
                sortText,
                command: {
                    id: BuiltinDynamicCompletions_1.addReferenceCommand, title: '', arguments: [new ReferenceArgument(widget, {
                            id: `vscode.symbol/${JSON.stringify(symbolItem.location)}`,
                            fullName: symbolItem.name,
                            range: { startLineNumber: info.replace.startLineNumber, startColumn: info.replace.startColumn, endLineNumber: info.replace.endLineNumber, endColumn: info.replace.startColumn + text.length },
                            data: symbolItem.location,
                            icon: SymbolKinds.toIcon(symbolItem.kind)
                        })]
                }
            };
        };
        let pattern;
        if (info.varWord?.word && info.varWord.word.startsWith(chatVariableLeader)) {
            pattern = info.varWord.word.toLowerCase().slice(1); // remove leading #
        }
        const symbolsToAdd = [];
        for (const outlineModel of this.outlineService.getCachedModels()) {
            const symbols = outlineModel.asListOfDocumentSymbols();
            for (const symbol of symbols) {
                symbolsToAdd.push({ symbol, uri: outlineModel.uri });
            }
        }
        for (const symbol of symbolsToAdd) {
            result.suggestions.push(makeSymbolCompletionItem({ ...symbol.symbol, location: { uri: symbol.uri, range: symbol.symbol.range } }, pattern ?? ''));
        }
        result.incomplete = !!pattern;
    }
    updateCacheKey() {
        if (this.cacheKey && Date.now() - this.cacheKey.time > 60000) {
            this.searchService.clearCache(this.cacheKey.key);
            this.cacheKey = undefined;
        }
        if (!this.cacheKey) {
            this.cacheKey = {
                key: generateUuid(),
                time: Date.now()
            };
        }
        this.cacheKey.time = Date.now();
        return this.cacheKey;
    }
    cmdAddReference(arg) {
        // invoked via the completion command
        arg.widget.getContrib(ChatDynamicVariableModel.ID)?.addReference(arg.variable);
    }
};
BuiltinDynamicCompletions = BuiltinDynamicCompletions_1 = __decorate([
    __param(0, IHistoryService),
    __param(1, IWorkspaceContextService),
    __param(2, ISearchService),
    __param(3, ILabelService),
    __param(4, ILanguageFeaturesService),
    __param(5, IChatWidgetService),
    __param(6, IChatEditingService),
    __param(7, IOutlineModelService),
    __param(8, IEditorService),
    __param(9, IConfigurationService),
    __param(10, ICodeEditorService),
    __param(11, IChatAgentService),
    __param(12, IInstantiationService)
], BuiltinDynamicCompletions);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(BuiltinDynamicCompletions, 4 /* LifecyclePhase.Eventually */);
export function computeCompletionRanges(model, position, reg, onlyOnWordStart = false) {
    const varWord = getWordAtText(position.column, reg, model.getLineContent(position.lineNumber), 0);
    if (!varWord && model.getWordUntilPosition(position).word) {
        // inside a "normal" word
        return;
    }
    if (!varWord && position.column > 1) {
        const textBefore = model.getValueInRange(new Range(position.lineNumber, position.column - 1, position.lineNumber, position.column));
        if (textBefore !== ' ') {
            return;
        }
    }
    if (varWord && onlyOnWordStart) {
        const wordBefore = model.getWordUntilPosition({ lineNumber: position.lineNumber, column: varWord.startColumn });
        if (wordBefore.word) {
            // inside a word
            return;
        }
    }
    let insert;
    let replace;
    if (!varWord) {
        insert = replace = Range.fromPositions(position);
    }
    else {
        insert = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, position.column);
        replace = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, varWord.endColumn);
    }
    return { insert, replace, varWord };
}
function isEmptyUpToCompletionWord(model, rangeResult) {
    const startToCompletionWordStart = new Range(1, 1, rangeResult.replace.startLineNumber, rangeResult.replace.startColumn);
    return !!model.getValueInRange(startToCompletionWordStart).match(/^\s*$/);
}
let ToolCompletions = class ToolCompletions extends Disposable {
    static { ToolCompletions_1 = this; }
    static { this.VariableNameDef = new RegExp(`(?<=^|\\s)${chatVariableLeader}\\w*`, 'g'); } // MUST be using `g`-flag
    constructor(languageFeaturesService, chatWidgetService, chatAgentService) {
        super();
        this.languageFeaturesService = languageFeaturesService;
        this.chatWidgetService = chatWidgetService;
        this.chatAgentService = chatAgentService;
        this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
            _debugDisplayName: 'chatVariables',
            triggerCharacters: [chatVariableLeader],
            provideCompletionItems: async (model, position, _context, _token) => {
                const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
                if (!widget) {
                    return null;
                }
                // If locked to an agent that doesn't support tool attachments, skip
                if (widget.lockedAgentId) {
                    const agent = this.chatAgentService.getAgent(widget.lockedAgentId);
                    if (agent && !agent.capabilities?.supportsToolAttachments) {
                        return null;
                    }
                }
                const range = computeCompletionRanges(model, position, ToolCompletions_1.VariableNameDef, true);
                if (!range) {
                    return null;
                }
                const usedNames = new Set();
                for (const part of widget.parsedInput.parts) {
                    if (part instanceof ChatRequestToolPart) {
                        usedNames.add(part.toolName);
                    }
                    else if (part instanceof ChatRequestToolSetPart) {
                        usedNames.add(part.name);
                    }
                }
                const suggestions = [];
                const iter = widget.input.selectedToolsModel.entriesMap.get();
                for (const [item, enabled] of iter) {
                    if (!enabled) {
                        continue;
                    }
                    let detail;
                    let name;
                    if (item instanceof ToolSet) {
                        detail = item.description;
                        name = item.referenceName;
                    }
                    else {
                        const source = item.source;
                        detail = localize('tool_source_completion', "{0}: {1}", source.label, item.displayName);
                        name = item.toolReferenceName ?? item.displayName;
                    }
                    if (usedNames.has(name)) {
                        continue;
                    }
                    const withLeader = `${chatVariableLeader}${name}`;
                    suggestions.push({
                        label: withLeader,
                        range,
                        detail,
                        insertText: withLeader + ' ',
                        kind: 27 /* CompletionItemKind.Tool */,
                        sortText: 'z',
                    });
                }
                return { suggestions };
            }
        }));
    }
};
ToolCompletions = ToolCompletions_1 = __decorate([
    __param(0, ILanguageFeaturesService),
    __param(1, IChatWidgetService),
    __param(2, IChatAgentService)
], ToolCompletions);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ToolCompletions, 4 /* LifecyclePhase.Eventually */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdElucHV0Q29tcGxldGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NvbnRyaWIvY2hhdElucHV0Q29tcGxldGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3BFLE9BQU8sRUFBcUIsdUJBQXVCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN4RyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDakUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNsRSxPQUFPLEVBQWUsYUFBYSxFQUFFLFlBQVksRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FB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