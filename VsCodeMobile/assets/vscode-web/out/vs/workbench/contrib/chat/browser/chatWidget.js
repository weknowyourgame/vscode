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
var ChatWidget_1;
import * as dom from '../../../../base/browser/dom.js';
import { StandardMouseEvent } from '../../../../base/browser/mouseEvent.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { disposableTimeout, RunOnceScheduler, timeout } from '../../../../base/common/async.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { fromNow, fromNowByDay } from '../../../../base/common/date.js';
import { toErrorMessage } from '../../../../base/common/errorMessage.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable, DisposableStore, MutableDisposable, thenIfNotDisposed } from '../../../../base/common/lifecycle.js';
import { ResourceSet } from '../../../../base/common/map.js';
import { Schemas } from '../../../../base/common/network.js';
import { filter } from '../../../../base/common/objects.js';
import { autorun, observableFromEvent, observableValue } from '../../../../base/common/observable.js';
import { basename, extUri, isEqual } from '../../../../base/common/resources.js';
import { MicrotaskDelay } from '../../../../base/common/symbols.js';
import { isDefined } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { OffsetRange } from '../../../../editor/common/core/ranges/offsetRange.js';
import { localize } from '../../../../nls.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService, WorkbenchHoverDelegate } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { WorkbenchList, WorkbenchObjectTree } from '../../../../platform/list/browser/listService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { bindContextKey } from '../../../../platform/observable/common/platformObservableUtils.js';
import product from '../../../../platform/product/common/product.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { buttonSecondaryBackground, buttonSecondaryForeground, buttonSecondaryHoverBackground } from '../../../../platform/theme/common/colorRegistry.js';
import { asCssVariable } from '../../../../platform/theme/common/colorUtils.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { EditorResourceAccessor } from '../../../../workbench/common/editor.js';
import { IEditorService } from '../../../../workbench/services/editor/common/editorService.js';
import { IChatEntitlementService } from '../../../services/chat/common/chatEntitlementService.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { katexContainerClassName } from '../../markdown/common/markedKatexExtension.js';
import { checkModeOption } from '../common/chat.js';
import { IChatAgentService } from '../common/chatAgents.js';
import { ChatContextKeys } from '../common/chatContextKeys.js';
import { applyingChatEditsFailedContextKey, decidedChatEditingResourceContextKey, hasAppliedChatEditsContextKey, hasUndecidedChatEditingResourceContextKey, IChatEditingService, inChatEditingSessionContextKey } from '../common/chatEditingService.js';
import { IChatLayoutService } from '../common/chatLayoutService.js';
import { ChatMode, IChatModeService } from '../common/chatModes.js';
import { chatAgentLeader, ChatRequestAgentPart, ChatRequestDynamicVariablePart, ChatRequestSlashPromptPart, ChatRequestToolPart, ChatRequestToolSetPart, chatSubcommandLeader, formatChatQuestion } from '../common/chatParserTypes.js';
import { ChatRequestParser } from '../common/chatRequestParser.js';
import { IChatService } from '../common/chatService.js';
import { IChatSessionsService } from '../common/chatSessionsService.js';
import { IChatSlashCommandService } from '../common/chatSlashCommands.js';
import { IChatTodoListService } from '../common/chatTodoListService.js';
import { isPromptFileVariableEntry, isPromptTextVariableEntry, PromptFileVariableKind, toPromptFileVariableEntry } from '../common/chatVariableEntries.js';
import { ChatViewModel, isRequestVM, isResponseVM } from '../common/chatViewModel.js';
import { CodeBlockModelCollection } from '../common/codeBlockModelCollection.js';
import { ChatConfiguration, ChatModeKind } from '../common/constants.js';
import { ILanguageModelToolsService, ToolSet } from '../common/languageModelToolsService.js';
import { ComputeAutomaticInstructions } from '../common/promptSyntax/computeAutomaticInstructions.js';
import { PromptsConfig } from '../common/promptSyntax/config/config.js';
import { Target } from '../common/promptSyntax/promptFileParser.js';
import { IPromptsService } from '../common/promptSyntax/service/promptsService.js';
import { handleModeSwitch } from './actions/chatActions.js';
import { ChatViewId, IChatAccessibilityService, IChatWidgetService, isIChatResourceViewContext, isIChatViewViewContext } from './chat.js';
import { ChatAccessibilityProvider } from './chatAccessibilityProvider.js';
import { ChatSuggestNextWidget } from './chatContentParts/chatSuggestNextWidget.js';
import { ChatInputPart } from './chatInputPart.js';
import { ChatListDelegate, ChatListItemRenderer } from './chatListRenderer.js';
import { ChatEditorOptions } from './chatOptions.js';
import './media/chat.css';
import './media/chatAgentHover.css';
import './media/chatViewWelcome.css';
import { ChatViewWelcomePart } from './viewsWelcome/chatViewWelcomeController.js';
const $ = dom.$;
const defaultChat = {
    provider: product.defaultChatAgent?.provider ?? { default: { id: '', name: '' }, enterprise: { id: '', name: '' }, apple: { id: '', name: '' }, google: { id: '', name: '' } },
    termsStatementUrl: product.defaultChatAgent?.termsStatementUrl ?? '',
    privacyStatementUrl: product.defaultChatAgent?.privacyStatementUrl ?? ''
};
export function isQuickChat(widget) {
    return isIChatResourceViewContext(widget.viewContext) && Boolean(widget.viewContext.isQuickChat);
}
export function isInlineChat(widget) {
    return isIChatResourceViewContext(widget.viewContext) && Boolean(widget.viewContext.isInlineChat);
}
class ChatHistoryListDelegate {
    getHeight(element) {
        return 22;
    }
    getTemplateId(element) {
        return 'chatHistoryItem';
    }
}
let ChatHistoryHoverDelegate = class ChatHistoryHoverDelegate extends WorkbenchHoverDelegate {
    constructor(getViewContainerLocation, layoutService, configurationService, hoverService) {
        super('element', {
            instantHover: true
        }, () => this.getHoverOptions(), configurationService, hoverService);
        this.getViewContainerLocation = getViewContainerLocation;
        this.layoutService = layoutService;
    }
    getHoverOptions() {
        const sideBarPosition = this.layoutService.getSideBarPosition();
        const viewContainerLocation = this.getViewContainerLocation();
        let hoverPosition;
        if (viewContainerLocation === 0 /* ViewContainerLocation.Sidebar */) {
            hoverPosition = sideBarPosition === 0 /* Position.LEFT */ ? 1 /* HoverPosition.RIGHT */ : 0 /* HoverPosition.LEFT */;
        }
        else if (viewContainerLocation === 2 /* ViewContainerLocation.AuxiliaryBar */) {
            hoverPosition = sideBarPosition === 0 /* Position.LEFT */ ? 0 /* HoverPosition.LEFT */ : 1 /* HoverPosition.RIGHT */;
        }
        else {
            hoverPosition = 1 /* HoverPosition.RIGHT */;
        }
        return { additionalClasses: ['chat-history-item-hover'], position: { hoverPosition, forcePosition: true } };
    }
};
ChatHistoryHoverDelegate = __decorate([
    __param(1, IWorkbenchLayoutService),
    __param(2, IConfigurationService),
    __param(3, IHoverService)
], ChatHistoryHoverDelegate);
class ChatHistoryListRenderer {
    constructor(onDidClickItem, formatHistoryTimestamp, todayMidnightMs) {
        this.onDidClickItem = onDidClickItem;
        this.formatHistoryTimestamp = formatHistoryTimestamp;
        this.todayMidnightMs = todayMidnightMs;
        this.templateId = 'chatHistoryItem';
    }
    renderTemplate(container) {
        const disposables = new DisposableStore();
        container.classList.add('chat-welcome-history-item');
        const title = dom.append(container, $('.chat-welcome-history-title'));
        const date = dom.append(container, $('.chat-welcome-history-date'));
        container.tabIndex = 0;
        container.setAttribute('role', 'button');
        return { container, title, date, disposables };
    }
    renderElement(element, index, templateData) {
        const { container, title, date, disposables } = templateData;
        disposables.clear();
        title.textContent = element.title;
        date.textContent = this.formatHistoryTimestamp(element.lastMessageDate, this.todayMidnightMs);
        container.setAttribute('aria-label', element.title);
        disposables.add(dom.addDisposableListener(container, dom.EventType.CLICK, () => {
            this.onDidClickItem(element);
        }));
        disposables.add(dom.addStandardDisposableListener(container, dom.EventType.KEY_DOWN, e => {
            if (e.equals(3 /* KeyCode.Enter */) || e.equals(10 /* KeyCode.Space */)) {
                e.preventDefault();
                e.stopPropagation();
                this.onDidClickItem(element);
            }
        }));
    }
    disposeTemplate(templateData) {
        templateData.disposables.dispose();
    }
}
const supportsAllAttachments = {
    supportsFileAttachments: true,
    supportsToolAttachments: true,
    supportsMCPAttachments: true,
    supportsImageAttachments: true,
    supportsSearchResultAttachments: true,
    supportsInstructionAttachments: true,
    supportsSourceControlAttachments: true,
    supportsProblemAttachments: true,
    supportsSymbolAttachments: true,
    supportsTerminalAttachments: true,
};
let ChatWidget = class ChatWidget extends Disposable {
    static { ChatWidget_1 = this; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static { this.CONTRIBS = []; }
    get domNode() {
        return this.container;
    }
    get visible() {
        return this._visible;
    }
    set viewModel(viewModel) {
        if (this._viewModel === viewModel) {
            return;
        }
        this.viewModelDisposables.clear();
        this._viewModel = viewModel;
        if (viewModel) {
            this.viewModelDisposables.add(viewModel);
            this.logService.debug('ChatWidget#setViewModel: have viewModel');
        }
        else {
            this.logService.debug('ChatWidget#setViewModel: no viewModel');
        }
        this._onDidChangeViewModel.fire();
    }
    get viewModel() {
        return this._viewModel;
    }
    get parsedInput() {
        if (this.parsedChatRequest === undefined) {
            if (!this.viewModel) {
                return { text: '', parts: [] };
            }
            this.parsedChatRequest = this.instantiationService.createInstance(ChatRequestParser)
                .parseChatRequest(this.viewModel.sessionResource, this.getInput(), this.location, {
                selectedAgent: this._lastSelectedAgent,
                mode: this.input.currentModeKind,
                forcedAgent: this._lockedAgent?.id ? this.chatAgentService.getAgent(this._lockedAgent.id) : undefined
            });
            this._onDidChangeParsedInput.fire();
        }
        return this.parsedChatRequest;
    }
    get scopedContextKeyService() {
        return this.contextKeyService;
    }
    get location() {
        return this._location.location;
    }
    get supportsChangingModes() {
        return !!this.viewOptions.supportsChangingModes;
    }
    get chatDisclaimer() {
        return localize('chatDisclaimer', "AI responses may be inaccurate.");
    }
    get locationData() {
        return this._location.resolveData?.();
    }
    constructor(location, _viewContext, viewOptions, styles, codeEditorService, editorService, configurationService, contextKeyService, instantiationService, chatService, chatAgentService, chatWidgetService, contextMenuService, chatAccessibilityService, logService, themeService, chatSlashCommandService, chatEditingService, telemetryService, promptsService, toolsService, chatModeService, chatLayoutService, chatEntitlementService, commandService, hoverService, chatSessionsService, chatTodoListService, contextService, lifecycleService) {
        super();
        this.viewOptions = viewOptions;
        this.styles = styles;
        this.codeEditorService = codeEditorService;
        this.editorService = editorService;
        this.configurationService = configurationService;
        this.contextKeyService = contextKeyService;
        this.instantiationService = instantiationService;
        this.chatService = chatService;
        this.chatAgentService = chatAgentService;
        this.chatWidgetService = chatWidgetService;
        this.contextMenuService = contextMenuService;
        this.chatAccessibilityService = chatAccessibilityService;
        this.logService = logService;
        this.themeService = themeService;
        this.chatSlashCommandService = chatSlashCommandService;
        this.telemetryService = telemetryService;
        this.promptsService = promptsService;
        this.toolsService = toolsService;
        this.chatModeService = chatModeService;
        this.chatLayoutService = chatLayoutService;
        this.chatEntitlementService = chatEntitlementService;
        this.commandService = commandService;
        this.hoverService = hoverService;
        this.chatSessionsService = chatSessionsService;
        this.chatTodoListService = chatTodoListService;
        this.contextService = contextService;
        this.lifecycleService = lifecycleService;
        this._onDidSubmitAgent = this._register(new Emitter());
        this.onDidSubmitAgent = this._onDidSubmitAgent.event;
        this._onDidChangeAgent = this._register(new Emitter());
        this.onDidChangeAgent = this._onDidChangeAgent.event;
        this._onDidFocus = this._register(new Emitter());
        this.onDidFocus = this._onDidFocus.event;
        this._onDidChangeViewModel = this._register(new Emitter());
        this.onDidChangeViewModel = this._onDidChangeViewModel.event;
        this._onDidScroll = this._register(new Emitter());
        this.onDidScroll = this._onDidScroll.event;
        this._onDidAcceptInput = this._register(new Emitter());
        this.onDidAcceptInput = this._onDidAcceptInput.event;
        this._onDidHide = this._register(new Emitter());
        this.onDidHide = this._onDidHide.event;
        this._onDidShow = this._register(new Emitter());
        this.onDidShow = this._onDidShow.event;
        this._onDidChangeParsedInput = this._register(new Emitter());
        this.onDidChangeParsedInput = this._onDidChangeParsedInput.event;
        this._onWillMaybeChangeHeight = new Emitter();
        this.onWillMaybeChangeHeight = this._onWillMaybeChangeHeight.event;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this._onDidChangeContentHeight = new Emitter();
        this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
        this.contribs = [];
        this.inputPartDisposable = this._register(new MutableDisposable());
        this.inlineInputPartDisposable = this._register(new MutableDisposable());
        this.timeoutDisposable = this._register(new MutableDisposable());
        this.recentlyRestoredCheckpoint = false;
        this.settingChangeCounter = 0;
        this.welcomePart = this._register(new MutableDisposable());
        this.welcomeContextMenuDisposable = this._register(new MutableDisposable());
        this.historyViewStore = this._register(new DisposableStore());
        this.visibleChangeCount = 0;
        this._visible = false;
        this.previousTreeScrollHeight = 0;
        /**
         * Whether the list is scroll-locked to the bottom. Initialize to true so that we can scroll to the bottom on first render.
         * The initial render leads to a lot of `onDidChangeTreeContentHeight` as the renderer works out the real heights of rows.
        */
        this.scrollLock = true;
        this.viewModelDisposables = this._register(new DisposableStore());
        this._attachmentCapabilities = supportsAllAttachments;
        // Cache for prompt file descriptions to avoid async calls during rendering
        this.promptDescriptionsCache = new Map();
        this.promptUriCache = new Map();
        this._isLoadingPromptDescriptions = false;
        this._mostRecentlyFocusedItemIndex = -1;
        this._editingSession = observableValue(this, undefined);
        this._lockedToCodingAgentContextKey = ChatContextKeys.lockedToCodingAgent.bindTo(this.contextKeyService);
        this._agentSupportsAttachmentsContextKey = ChatContextKeys.agentSupportsAttachments.bindTo(this.contextKeyService);
        this.viewContext = _viewContext ?? {};
        const viewModelObs = observableFromEvent(this, this.onDidChangeViewModel, () => this.viewModel);
        if (typeof location === 'object') {
            this._location = location;
        }
        else {
            this._location = { location };
        }
        ChatContextKeys.inChatSession.bindTo(contextKeyService).set(true);
        ChatContextKeys.location.bindTo(contextKeyService).set(this._location.location);
        ChatContextKeys.inQuickChat.bindTo(contextKeyService).set(isQuickChat(this));
        this.agentInInput = ChatContextKeys.inputHasAgent.bindTo(contextKeyService);
        this.requestInProgress = ChatContextKeys.requestInProgress.bindTo(contextKeyService);
        // Context key for when empty state history is enabled and in empty state
        this.inEmptyStateWithHistoryEnabledKey = ChatContextKeys.inEmptyStateWithHistoryEnabled.bindTo(contextKeyService);
        this._welcomeRenderScheduler = this._register(new RunOnceScheduler(() => this.renderWelcomeViewContentIfNeeded(), 0));
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(ChatConfiguration.EmptyStateHistoryEnabled)) {
                this.updateEmptyStateWithHistoryContext();
                this._welcomeRenderScheduler.schedule();
            }
        }));
        this.updateEmptyStateWithHistoryContext();
        // Update welcome view content when `anonymous` condition changes
        this._register(this.chatEntitlementService.onDidChangeAnonymous(() => this._welcomeRenderScheduler.schedule()));
        this._register(bindContextKey(decidedChatEditingResourceContextKey, contextKeyService, (reader) => {
            const currentSession = this._editingSession.read(reader);
            if (!currentSession) {
                return;
            }
            const entries = currentSession.entries.read(reader);
            const decidedEntries = entries.filter(entry => entry.state.read(reader) !== 0 /* ModifiedFileEntryState.Modified */);
            return decidedEntries.map(entry => entry.entryId);
        }));
        this._register(bindContextKey(hasUndecidedChatEditingResourceContextKey, contextKeyService, (reader) => {
            const currentSession = this._editingSession.read(reader);
            const entries = currentSession?.entries.read(reader) ?? []; // using currentSession here
            const decidedEntries = entries.filter(entry => entry.state.read(reader) === 0 /* ModifiedFileEntryState.Modified */);
            return decidedEntries.length > 0;
        }));
        this._register(bindContextKey(hasAppliedChatEditsContextKey, contextKeyService, (reader) => {
            const currentSession = this._editingSession.read(reader);
            if (!currentSession) {
                return false;
            }
            const entries = currentSession.entries.read(reader);
            return entries.length > 0;
        }));
        this._register(bindContextKey(inChatEditingSessionContextKey, contextKeyService, (reader) => {
            return this._editingSession.read(reader) !== null;
        }));
        this._register(bindContextKey(ChatContextKeys.chatEditingCanUndo, contextKeyService, (r) => {
            return this._editingSession.read(r)?.canUndo.read(r) || false;
        }));
        this._register(bindContextKey(ChatContextKeys.chatEditingCanRedo, contextKeyService, (r) => {
            return this._editingSession.read(r)?.canRedo.read(r) || false;
        }));
        this._register(bindContextKey(applyingChatEditsFailedContextKey, contextKeyService, (r) => {
            const chatModel = viewModelObs.read(r)?.model;
            const editingSession = this._editingSession.read(r);
            if (!editingSession || !chatModel) {
                return false;
            }
            const lastResponse = observableFromEvent(this, chatModel.onDidChange, () => chatModel.getRequests().at(-1)?.response).read(r);
            return lastResponse?.result?.errorDetails && !lastResponse?.result?.errorDetails.responseIsIncomplete;
        }));
        this._codeBlockModelCollection = this._register(instantiationService.createInstance(CodeBlockModelCollection, undefined));
        this.chatSuggestNextWidget = this._register(this.instantiationService.createInstance(ChatSuggestNextWidget));
        this._register(this.configurationService.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('chat.renderRelatedFiles')) {
                this.input.renderChatRelatedFiles();
            }
            if (e.affectsConfiguration(ChatConfiguration.EditRequests) || e.affectsConfiguration(ChatConfiguration.CheckpointsEnabled)) {
                this.settingChangeCounter++;
                this.onDidChangeItems();
            }
        }));
        this._register(autorun(r => {
            const viewModel = viewModelObs.read(r);
            const sessions = chatEditingService.editingSessionsObs.read(r);
            const session = sessions.find(candidate => isEqual(candidate.chatSessionResource, viewModel?.sessionResource));
            this._editingSession.set(undefined, undefined);
            this.renderChatEditingSessionState(); // this is necessary to make sure we dispose previous buttons, etc.
            if (!session) {
                // none or for a different chat widget
                return;
            }
            const entries = session.entries.read(r);
            for (const entry of entries) {
                entry.state.read(r); // SIGNAL
            }
            this._editingSession.set(session, undefined);
            r.store.add(session.onDidDispose(() => {
                this._editingSession.set(undefined, undefined);
                this.renderChatEditingSessionState();
            }));
            r.store.add(this.onDidChangeParsedInput(() => {
                this.renderChatEditingSessionState();
            }));
            r.store.add(this.inputEditor.onDidChangeModelContent(() => {
                if (this.getInput() === '') {
                    this.refreshParsedInput();
                    this.renderChatEditingSessionState();
                }
            }));
            this.renderChatEditingSessionState();
        }));
        this._register(codeEditorService.registerCodeEditorOpenHandler(async (input, _source, _sideBySide) => {
            const resource = input.resource;
            if (resource.scheme !== Schemas.vscodeChatCodeBlock) {
                return null;
            }
            const responseId = resource.path.split('/').at(1);
            if (!responseId) {
                return null;
            }
            const item = this.viewModel?.getItems().find(item => item.id === responseId);
            if (!item) {
                return null;
            }
            // TODO: needs to reveal the chat view
            this.reveal(item);
            await timeout(0); // wait for list to actually render
            for (const codeBlockPart of this.renderer.editorsInUse()) {
                if (extUri.isEqual(codeBlockPart.uri, resource, true)) {
                    const editor = codeBlockPart.editor;
                    let relativeTop = 0;
                    const editorDomNode = editor.getDomNode();
                    if (editorDomNode) {
                        const row = dom.findParentWithClass(editorDomNode, 'monaco-list-row');
                        if (row) {
                            relativeTop = dom.getTopLeftOffset(editorDomNode).top - dom.getTopLeftOffset(row).top;
                        }
                    }
                    if (input.options?.selection) {
                        const editorSelectionTopOffset = editor.getTopForPosition(input.options.selection.startLineNumber, input.options.selection.startColumn);
                        relativeTop += editorSelectionTopOffset;
                        editor.focus();
                        editor.setSelection({
                            startLineNumber: input.options.selection.startLineNumber,
                            startColumn: input.options.selection.startColumn,
                            endLineNumber: input.options.selection.endLineNumber ?? input.options.selection.startLineNumber,
                            endColumn: input.options.selection.endColumn ?? input.options.selection.startColumn
                        });
                    }
                    this.reveal(item, relativeTop);
                    return editor;
                }
            }
            return null;
        }));
        this._register(this.onDidChangeParsedInput(() => this.updateChatInputContext()));
        this._register(this.chatTodoListService.onDidUpdateTodos((sessionResource) => {
            if (isEqual(this.viewModel?.sessionResource, sessionResource)) {
                this.inputPart.renderChatTodoListWidget(sessionResource);
            }
        }));
    }
    set lastSelectedAgent(agent) {
        this.parsedChatRequest = undefined;
        this._lastSelectedAgent = agent;
        this._updateAgentCapabilitiesContextKeys(agent);
        this._onDidChangeParsedInput.fire();
    }
    get lastSelectedAgent() {
        return this._lastSelectedAgent;
    }
    _updateAgentCapabilitiesContextKeys(agent) {
        // Check if the agent has capabilities defined directly
        const capabilities = agent?.capabilities ?? (this._lockedAgent ? this.chatSessionsService.getCapabilitiesForSessionType(this._lockedAgent.id) : undefined);
        this._attachmentCapabilities = capabilities ?? supportsAllAttachments;
        const supportsAttachments = Object.keys(filter(this._attachmentCapabilities, (key, value) => value === true)).length > 0;
        this._agentSupportsAttachmentsContextKey.set(supportsAttachments);
    }
    get supportsFileReferences() {
        return !!this.viewOptions.supportsFileReferences;
    }
    get attachmentCapabilities() {
        return this._attachmentCapabilities;
    }
    get input() {
        return this.viewModel?.editing && this.configurationService.getValue('chat.editRequests') !== 'input' ? this.inlineInputPart : this.inputPart;
    }
    get inputPart() {
        return this.inputPartDisposable.value;
    }
    get inlineInputPart() {
        return this.inlineInputPartDisposable.value;
    }
    get inputEditor() {
        return this.input.inputEditor;
    }
    get contentHeight() {
        return this.input.contentHeight + this.tree.contentHeight + this.chatSuggestNextWidget.height;
    }
    get attachmentModel() {
        return this.input.attachmentModel;
    }
    render(parent) {
        const viewId = isIChatViewViewContext(this.viewContext) ? this.viewContext.viewId : undefined;
        this.editorOptions = this._register(this.instantiationService.createInstance(ChatEditorOptions, viewId, this.styles.listForeground, this.styles.inputEditorBackground, this.styles.resultEditorBackground));
        const renderInputOnTop = this.viewOptions.renderInputOnTop ?? false;
        const renderFollowups = this.viewOptions.renderFollowups ?? !renderInputOnTop;
        const renderStyle = this.viewOptions.renderStyle;
        const renderInputToolbarBelowInput = this.viewOptions.renderInputToolbarBelowInput ?? false;
        this.container = dom.append(parent, $('.interactive-session'));
        this.welcomeMessageContainer = dom.append(this.container, $('.chat-welcome-view-container', { style: 'display: none' }));
        this._register(dom.addStandardDisposableListener(this.welcomeMessageContainer, dom.EventType.CLICK, () => this.focusInput()));
        this._register(this.chatSuggestNextWidget.onDidChangeHeight(() => {
            if (this.bodyDimension) {
                this.layout(this.bodyDimension.height, this.bodyDimension.width);
            }
        }));
        this._register(this.chatSuggestNextWidget.onDidSelectPrompt(({ handoff, agentId }) => {
            this.handleNextPromptSelection(handoff, agentId);
        }));
        if (renderInputOnTop) {
            this.createInput(this.container, { renderFollowups, renderStyle, renderInputToolbarBelowInput });
            this.listContainer = dom.append(this.container, $(`.interactive-list`));
        }
        else {
            this.listContainer = dom.append(this.container, $(`.interactive-list`));
            dom.append(this.container, this.chatSuggestNextWidget.domNode);
            this.createInput(this.container, { renderFollowups, renderStyle, renderInputToolbarBelowInput });
        }
        this._welcomeRenderScheduler.schedule();
        this.createList(this.listContainer, { editable: !isInlineChat(this) && !isQuickChat(this), ...this.viewOptions.rendererOptions, renderStyle });
        const scrollDownButton = this._register(new Button(this.listContainer, {
            supportIcons: true,
            buttonBackground: asCssVariable(buttonSecondaryBackground),
            buttonForeground: asCssVariable(buttonSecondaryForeground),
            buttonHoverBackground: asCssVariable(buttonSecondaryHoverBackground),
        }));
        scrollDownButton.element.classList.add('chat-scroll-down');
        scrollDownButton.label = `$(${Codicon.chevronDown.id})`;
        scrollDownButton.setTitle(localize('scrollDownButtonLabel', "Scroll down"));
        this._register(scrollDownButton.onDidClick(() => {
            this.scrollLock = true;
            this.scrollToEnd();
        }));
        // Update the font family and size
        this._register(autorun(reader => {
            const fontFamily = this.chatLayoutService.fontFamily.read(reader);
            const fontSize = this.chatLayoutService.fontSize.read(reader);
            this.container.style.setProperty('--vscode-chat-font-family', fontFamily);
            this.container.style.fontSize = `${fontSize}px`;
            this.tree.rerender();
        }));
        this._register(this.editorOptions.onDidChange(() => this.onDidStyleChange()));
        this.onDidStyleChange();
        // Do initial render
        if (this.viewModel) {
            this.onDidChangeItems();
            this.scrollToEnd();
        }
        this.contribs = ChatWidget_1.CONTRIBS.map(contrib => {
            try {
                return this._register(this.instantiationService.createInstance(contrib, this));
            }
            catch (err) {
                this.logService.error('Failed to instantiate chat widget contrib', toErrorMessage(err));
                return undefined;
            }
        }).filter(isDefined);
        this._register(this.chatWidgetService.register(this));
        const parsedInput = observableFromEvent(this.onDidChangeParsedInput, () => this.parsedInput);
        this._register(autorun(r => {
            const input = parsedInput.read(r);
            const newPromptAttachments = new Map();
            const oldPromptAttachments = new Set();
            // get all attachments, know those that are prompt-referenced
            for (const attachment of this.attachmentModel.attachments) {
                if (attachment.range) {
                    oldPromptAttachments.add(attachment.id);
                }
            }
            // update/insert prompt-referenced attachments
            for (const part of input.parts) {
                if (part instanceof ChatRequestToolPart || part instanceof ChatRequestToolSetPart || part instanceof ChatRequestDynamicVariablePart) {
                    const entry = part.toVariableEntry();
                    newPromptAttachments.set(entry.id, entry);
                    oldPromptAttachments.delete(entry.id);
                }
            }
            this.attachmentModel.updateContext(oldPromptAttachments, newPromptAttachments.values());
        }));
        if (!this.focusedInputDOM) {
            this.focusedInputDOM = this.container.appendChild(dom.$('.focused-input-dom'));
        }
    }
    scrollToEnd() {
        if (this.lastItem) {
            const offset = Math.max(this.lastItem.currentRenderedHeight ?? 0, 1e6);
            if (this.tree.hasElement(this.lastItem)) {
                this.tree.reveal(this.lastItem, offset);
            }
        }
    }
    focusInput() {
        this.input.focus();
        // Sometimes focusing the input part is not possible,
        // but we'd like to be the last focused chat widget,
        // so we emit an optimistic onDidFocus event nonetheless.
        this._onDidFocus.fire();
    }
    hasInputFocus() {
        return this.input.hasFocus();
    }
    refreshParsedInput() {
        if (!this.viewModel) {
            return;
        }
        this.parsedChatRequest = this.instantiationService.createInstance(ChatRequestParser).parseChatRequest(this.viewModel.sessionResource, this.getInput(), this.location, { selectedAgent: this._lastSelectedAgent, mode: this.input.currentModeKind });
        this._onDidChangeParsedInput.fire();
    }
    getSibling(item, type) {
        if (!isResponseVM(item)) {
            return;
        }
        const items = this.viewModel?.getItems();
        if (!items) {
            return;
        }
        const responseItems = items.filter(i => isResponseVM(i));
        const targetIndex = responseItems.indexOf(item);
        if (targetIndex === undefined) {
            return;
        }
        const indexToFocus = type === 'next' ? targetIndex + 1 : targetIndex - 1;
        if (indexToFocus < 0 || indexToFocus > responseItems.length - 1) {
            return;
        }
        return responseItems[indexToFocus];
    }
    async clear() {
        this.logService.debug('ChatWidget#clear');
        if (this._dynamicMessageLayoutData) {
            this._dynamicMessageLayoutData.enabled = true;
        }
        if (this.viewModel) {
            this.viewModel.resetInputPlaceholder();
        }
        if (this._lockedAgent) {
            this.lockToCodingAgent(this._lockedAgent.name, this._lockedAgent.displayName, this._lockedAgent.id);
        }
        else {
            this.unlockFromCodingAgent();
        }
        this.inputPart.clearTodoListWidget(this.viewModel?.sessionResource, true);
        this.chatSuggestNextWidget.hide();
        await this.viewOptions.clear?.();
    }
    onDidChangeItems(skipDynamicLayout) {
        // Update context key when items change
        this.updateEmptyStateWithHistoryContext();
        if (this._visible || !this.viewModel) {
            const treeItems = (this.viewModel?.getItems() ?? [])
                .map((item) => {
                return {
                    element: item,
                    collapsed: false,
                    collapsible: false
                };
            });
            if (treeItems.length > 0) {
                this.updateChatViewVisibility();
            }
            else {
                this._welcomeRenderScheduler.schedule();
            }
            this._onWillMaybeChangeHeight.fire();
            this.lastItem = treeItems.at(-1)?.element;
            ChatContextKeys.lastItemId.bindTo(this.contextKeyService).set(this.lastItem ? [this.lastItem.id] : []);
            this.tree.setChildren(null, treeItems, {
                diffIdentityProvider: {
                    getId: (element) => {
                        return element.dataId +
                            // Ensure re-rendering an element once slash commands are loaded, so the colorization can be applied.
                            `${(isRequestVM(element)) /* && !!this.lastSlashCommands ? '_scLoaded' : '' */}` +
                            // If a response is in the process of progressive rendering, we need to ensure that it will
                            // be re-rendered so progressive rendering is restarted, even if the model wasn't updated.
                            `${isResponseVM(element) && element.renderData ? `_${this.visibleChangeCount}` : ''}` +
                            // Re-render once content references are loaded
                            (isResponseVM(element) ? `_${element.contentReferences.length}` : '') +
                            // Re-render if element becomes hidden due to undo/redo
                            `_${element.shouldBeRemovedOnSend ? `${element.shouldBeRemovedOnSend.afterUndoStop || '1'}` : '0'}` +
                            // Re-render if element becomes enabled/disabled due to checkpointing
                            `_${element.shouldBeBlocked ? '1' : '0'}` +
                            // Re-render if we have an element currently being edited
                            `_${this.viewModel?.editing ? '1' : '0'}` +
                            // Re-render if we have an element currently being checkpointed
                            `_${this.viewModel?.model.checkpoint ? '1' : '0'}` +
                            // Re-render all if invoked by setting change
                            `_setting${this.settingChangeCounter || '0'}` +
                            // Rerender request if we got new content references in the response
                            // since this may change how we render the corresponding attachments in the request
                            (isRequestVM(element) && element.contentReferences ? `_${element.contentReferences?.length}` : '');
                    },
                }
            });
            if (!skipDynamicLayout && this._dynamicMessageLayoutData) {
                this.layoutDynamicChatTreeItemMode();
            }
            this.renderFollowups();
        }
    }
    /**
     * Updates the DOM visibility of welcome view and chat list immediately
     * @internal
     */
    updateChatViewVisibility() {
        if (!this.viewModel) {
            return;
        }
        const numItems = this.viewModel.getItems().length;
        dom.setVisibility(numItems === 0, this.welcomeMessageContainer);
        dom.setVisibility(numItems !== 0, this.listContainer);
    }
    /**
     * Renders the welcome view content when needed.
     *
     * Note: Do not call this method directly. Instead, use `this._welcomeRenderScheduler.schedule()`
     * to ensure proper debouncing and avoid potential cyclic calls
     * @internal
     */
    renderWelcomeViewContentIfNeeded() {
        if (this.viewOptions.renderStyle === 'compact' || this.viewOptions.renderStyle === 'minimal' || this.lifecycleService.willShutdown) {
            return;
        }
        const numItems = this.viewModel?.getItems().length ?? 0;
        if (!numItems) {
            const defaultAgent = this.chatAgentService.getDefaultAgent(this.location, this.input.currentModeKind);
            let additionalMessage;
            if (this.chatEntitlementService.anonymous && !this.chatEntitlementService.sentiment.installed) {
                additionalMessage = new MarkdownString(localize({ key: 'settings', comment: ['{Locked="]({2})"}', '{Locked="]({3})"}'] }, "By continuing with {0} Copilot, you agree to {1}'s [Terms]({2}) and [Privacy Statement]({3}).", defaultChat.provider.default.name, defaultChat.provider.default.name, defaultChat.termsStatementUrl, defaultChat.privacyStatementUrl), { isTrusted: true });
            }
            else {
                additionalMessage = defaultAgent?.metadata.additionalWelcomeMessage;
            }
            if (!additionalMessage && !this._lockedAgent) {
                additionalMessage = this._getGenerateInstructionsMessage();
            }
            const welcomeContent = this.getWelcomeViewContent(additionalMessage);
            if (!this.welcomePart.value || this.welcomePart.value.needsRerender(welcomeContent)) {
                this.historyViewStore.clear();
                dom.clearNode(this.welcomeMessageContainer);
                // Reset history list reference when clearing welcome view
                this.historyList = undefined;
                // Optional: recent chat history above welcome content when enabled
                const showHistory = this.configurationService.getValue(ChatConfiguration.EmptyStateHistoryEnabled);
                if (showHistory && !this._lockedAgent) {
                    this.renderWelcomeHistorySection();
                }
                this.welcomePart.value = this.instantiationService.createInstance(ChatViewWelcomePart, welcomeContent, {
                    location: this.location,
                    isWidgetAgentWelcomeViewContent: this.input?.currentModeKind === ChatModeKind.Agent
                });
                dom.append(this.welcomeMessageContainer, this.welcomePart.value.element);
                // Add right-click context menu to the entire welcome container
                this.welcomeContextMenuDisposable.value = dom.addDisposableListener(this.welcomeMessageContainer, dom.EventType.CONTEXT_MENU, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.contextMenuService.showContextMenu({
                        menuId: MenuId.ChatWelcomeContext,
                        contextKeyService: this.contextKeyService,
                        getAnchor: () => new StandardMouseEvent(dom.getWindow(this.welcomeMessageContainer), e)
                    });
                });
            }
        }
        this.updateChatViewVisibility();
        if (numItems === 0) {
            this.refreshHistoryList();
        }
    }
    updateEmptyStateWithHistoryContext() {
        const historyEnabled = this.configurationService.getValue(ChatConfiguration.EmptyStateHistoryEnabled);
        const numItems = this.viewModel?.getItems().length ?? 0;
        const shouldHideButtons = historyEnabled && numItems === 0;
        this.inEmptyStateWithHistoryEnabledKey.set(shouldHideButtons);
    }
    async renderWelcomeHistorySection() {
        try {
            const historyRoot = dom.append(this.welcomeMessageContainer, $('.chat-welcome-history-root'));
            const container = dom.append(historyRoot, $('.chat-welcome-history'));
            const initialHistoryItems = await this.computeHistoryItems();
            if (initialHistoryItems.length === 0) {
                historyRoot.remove();
                return;
            }
            this.historyListContainer = dom.append(container, $('.chat-welcome-history-list'));
            this.welcomeMessageContainer.classList.toggle('has-chat-history', initialHistoryItems.length > 0);
            // Compute today's midnight once for label decisions
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);
            const todayMidnightMs = todayMidnight.getTime();
            // Create hover delegate for proper tooltip positioning
            const getViewContainerLocation = () => {
                const panelLocation = this.contextKeyService.getContextKeyValue('chatPanelLocation');
                return panelLocation ?? 2 /* ViewContainerLocation.AuxiliaryBar */;
            };
            const hoverDelegate = this.instantiationService.createInstance(ChatHistoryHoverDelegate, getViewContainerLocation);
            if (!this.historyList) {
                const delegate = new ChatHistoryListDelegate();
                const renderer = this.instantiationService.createInstance(ChatHistoryListRenderer, async (item) => await this.openHistorySession(item.sessionResource), (timestamp, todayMs) => this.formatHistoryTimestamp(timestamp, todayMs), todayMidnightMs);
                this.historyList = this._register(this.instantiationService.createInstance((WorkbenchList), 'ChatHistoryList', this.historyListContainer, delegate, [renderer], {
                    horizontalScrolling: false,
                    keyboardSupport: true,
                    mouseSupport: true,
                    multipleSelectionSupport: false,
                    overrideStyles: {
                        listBackground: this.styles.listBackground
                    },
                    accessibilityProvider: {
                        getAriaLabel: (item) => item.title,
                        getWidgetAriaLabel: () => localize('chat.history.list', 'Chat History')
                    }
                }));
                this.historyList.getHTMLElement().tabIndex = -1;
            }
            else {
                const currentHistoryList = this.historyList.getHTMLElement();
                if (currentHistoryList && currentHistoryList.parentElement !== this.historyListContainer) {
                    this.historyListContainer.appendChild(currentHistoryList);
                }
            }
            this.renderHistoryItems(initialHistoryItems);
            // Add "Chat history..." link at the end
            const previousChatsLink = dom.append(container, $('.chat-welcome-history-more'));
            previousChatsLink.textContent = localize('chat.history.showMore', 'Chat history...');
            previousChatsLink.setAttribute('role', 'button');
            previousChatsLink.setAttribute('tabindex', '0');
            previousChatsLink.setAttribute('aria-label', localize('chat.history.showMoreAriaLabel', 'Open chat history'));
            // Add hover tooltip for the link at the end of the list
            const hoverContent = localize('chat.history.showMoreHover', 'Show chat history...');
            this._register(this.hoverService.setupManagedHover(hoverDelegate, previousChatsLink, hoverContent));
            this._register(dom.addDisposableListener(previousChatsLink, dom.EventType.CLICK, (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.commandService.executeCommand('workbench.action.chat.history');
            }));
            this._register(dom.addDisposableListener(previousChatsLink, dom.EventType.KEY_DOWN, (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.commandService.executeCommand('workbench.action.chat.history');
                }
            }));
        }
        catch (err) {
            this.logService.error('Failed to render welcome history', err);
        }
    }
    async computeHistoryItems() {
        try {
            const items = await this.chatService.getLocalSessionHistory();
            return items
                .filter(i => !i.isActive)
                .sort((a, b) => (b.lastMessageDate ?? 0) - (a.lastMessageDate ?? 0))
                .slice(0, 3)
                .map((item) => ({
                sessionResource: item.sessionResource,
                title: item.title,
                lastMessageDate: typeof item.lastMessageDate === 'number' ? item.lastMessageDate : Date.now(),
                isActive: item.isActive
            }));
        }
        catch (err) {
            this.logService.error('Failed to compute chat history items', err);
            return [];
        }
    }
    renderHistoryItems(historyItems) {
        if (!this.historyList) {
            return;
        }
        const listHeight = historyItems.length * 22;
        if (this.historyListContainer) {
            this.historyListContainer.style.height = `${listHeight}px`;
            this.historyListContainer.style.minHeight = `${listHeight}px`;
        }
        this.historyList.splice(0, this.historyList.length, historyItems);
        this.historyList.layout(undefined, listHeight);
    }
    formatHistoryTimestamp(last, todayMidnightMs) {
        if (last > todayMidnightMs) {
            const diffMs = Date.now() - last;
            const minMs = 60 * 1000;
            const adjusted = diffMs < minMs ? Date.now() - minMs : last;
            return fromNow(adjusted, true, true);
        }
        return fromNowByDay(last, true, true);
    }
    async openHistorySession(sessionResource) {
        try {
            const viewsService = this.instantiationService.invokeFunction(accessor => accessor.get(IViewsService));
            const chatView = await viewsService.openView(ChatViewId);
            await chatView?.loadSession(sessionResource);
        }
        catch (e) {
            this.logService.error('Failed to open chat session from history', e);
        }
    }
    async refreshHistoryList() {
        const numItems = this.viewModel?.getItems().length ?? 0;
        // Only refresh history list when in empty state (welcome view) and history list exists
        if (numItems !== 0 || !this.historyList) {
            return;
        }
        const historyItems = await this.computeHistoryItems();
        this.renderHistoryItems(historyItems);
    }
    _getGenerateInstructionsMessage() {
        // Start checking for instruction files immediately if not already done
        if (!this._instructionFilesCheckPromise) {
            this._instructionFilesCheckPromise = this._checkForAgentInstructionFiles();
            // Use VS Code's idiomatic pattern for disposal-safe promise callbacks
            this._register(thenIfNotDisposed(this._instructionFilesCheckPromise, hasFiles => {
                this._instructionFilesExist = hasFiles;
                // Only re-render if the current view still doesn't have items and we're showing the welcome message
                const hasViewModelItems = this.viewModel?.getItems().length ?? 0;
                if (hasViewModelItems === 0) {
                    this._welcomeRenderScheduler.schedule();
                }
            }));
        }
        // If we already know the result, use it
        if (this._instructionFilesExist === true) {
            // Don't show generate instructions message if files exist
            return new MarkdownString('');
        }
        else if (this._instructionFilesExist === false) {
            // Show generate instructions message if no files exist
            const generateInstructionsCommand = 'workbench.action.chat.generateInstructions';
            return new MarkdownString(localize('chatWidget.instructions', "[Generate Agent Instructions]({0}) to onboard AI onto your codebase.", `command:${generateInstructionsCommand}`), { isTrusted: { enabledCommands: [generateInstructionsCommand] } });
        }
        // While checking, don't show the generate instructions message
        return new MarkdownString('');
    }
    /**
     * Checks if any agent instruction files (.github/copilot-instructions.md or AGENTS.md) exist in the workspace.
     * Used to determine whether to show the "Generate Agent Instructions" hint.
     *
     * @returns true if instruction files exist OR if instruction features are disabled (to hide the hint)
     */
    async _checkForAgentInstructionFiles() {
        try {
            const useCopilotInstructionsFiles = this.configurationService.getValue(PromptsConfig.USE_COPILOT_INSTRUCTION_FILES);
            const useAgentMd = this.configurationService.getValue(PromptsConfig.USE_AGENT_MD);
            if (!useCopilotInstructionsFiles && !useAgentMd) {
                // If both settings are disabled, return true to hide the hint (since the features aren't enabled)
                return true;
            }
            return ((await this.promptsService.listCopilotInstructionsMDs(CancellationToken.None)).length > 0 ||
                // Note: only checking for AGENTS.md files at the root folder, not ones in subfolders.
                (await this.promptsService.listAgentMDs(CancellationToken.None, false)).length > 0);
        }
        catch (error) {
            // On error, assume no instruction files exist to be safe
            this.logService.warn('[ChatWidget] Error checking for instruction files:', error);
            return false;
        }
    }
    getWelcomeViewContent(additionalMessage) {
        if (this.isLockedToCodingAgent) {
            // Check for provider-specific customizations from chat sessions service
            const providerIcon = this._lockedAgent ? this.chatSessionsService.getIconForSessionType(this._lockedAgent.id) : undefined;
            const providerTitle = this._lockedAgent ? this.chatSessionsService.getWelcomeTitleForSessionType(this._lockedAgent.id) : undefined;
            const providerMessage = this._lockedAgent ? this.chatSessionsService.getWelcomeMessageForSessionType(this._lockedAgent.id) : undefined;
            // Fallback to default messages if provider doesn't specify
            const message = providerMessage
                ? new MarkdownString(providerMessage)
                : (this._lockedAgent?.prefix === '@copilot '
                    ? new MarkdownString(localize('copilotCodingAgentMessage', "This chat session will be forwarded to the {0} [coding agent]({1}) where work is completed in the background. ", this._lockedAgent.prefix, 'https://aka.ms/coding-agent-docs') + this.chatDisclaimer, { isTrusted: true })
                    : new MarkdownString(localize('genericCodingAgentMessage', "This chat session will be forwarded to the {0} coding agent where work is completed in the background. ", this._lockedAgent?.prefix) + this.chatDisclaimer));
            return {
                title: providerTitle ?? localize('codingAgentTitle', "Delegate to {0}", this._lockedAgent?.prefix),
                message,
                icon: providerIcon ?? Codicon.sendToRemoteAgent,
                additionalMessage,
                useLargeIcon: !!providerIcon,
            };
        }
        let title;
        if (this.input.currentModeKind === ChatModeKind.Ask) {
            title = localize('chatDescription', "Ask about your code");
        }
        else if (this.input.currentModeKind === ChatModeKind.Edit) {
            title = localize('editsTitle', "Edit in context");
        }
        else {
            title = localize('agentTitle', "Build with Agent");
        }
        return {
            title,
            message: new MarkdownString(this.chatDisclaimer),
            icon: Codicon.chatSparkle,
            additionalMessage,
            suggestedPrompts: this.getPromptFileSuggestions()
        };
    }
    getPromptFileSuggestions() {
        // Use predefined suggestions for new users
        if (!this.chatEntitlementService.sentiment.installed) {
            const isEmpty = this.contextService.getWorkbenchState() === 1 /* WorkbenchState.EMPTY */;
            if (isEmpty) {
                return [
                    {
                        icon: Codicon.vscode,
                        label: localize('chatWidget.suggestedPrompts.gettingStarted', "Ask @vscode"),
                        prompt: localize('chatWidget.suggestedPrompts.gettingStartedPrompt', "@vscode How do I change the theme to light mode?"),
                    },
                    {
                        icon: Codicon.newFolder,
                        label: localize('chatWidget.suggestedPrompts.newProject', "Create Project"),
                        prompt: localize('chatWidget.suggestedPrompts.newProjectPrompt', "Create a #new Hello World project in TypeScript"),
                    }
                ];
            }
            else {
                return [
                    {
                        icon: Codicon.debugAlt,
                        label: localize('chatWidget.suggestedPrompts.buildWorkspace', "Build Workspace"),
                        prompt: localize('chatWidget.suggestedPrompts.buildWorkspacePrompt', "How do I build this workspace?"),
                    },
                    {
                        icon: Codicon.gear,
                        label: localize('chatWidget.suggestedPrompts.findConfig', "Show Config"),
                        prompt: localize('chatWidget.suggestedPrompts.findConfigPrompt', "Where is the configuration for this project defined?"),
                    }
                ];
            }
        }
        // Get the current workspace folder context if available
        const activeEditor = this.editorService.activeEditor;
        const resource = activeEditor ? EditorResourceAccessor.getOriginalUri(activeEditor) : undefined;
        // Get the prompt file suggestions configuration
        const suggestions = PromptsConfig.getPromptFilesRecommendationsValue(this.configurationService, resource);
        if (!suggestions) {
            return [];
        }
        const result = [];
        const promptsToLoad = [];
        // First, collect all prompts that need loading (regardless of shouldInclude)
        for (const [promptName] of Object.entries(suggestions)) {
            const description = this.promptDescriptionsCache.get(promptName);
            if (description === undefined) {
                promptsToLoad.push(promptName);
            }
        }
        // If we have prompts to load, load them asynchronously and don't return anything yet
        // But only if we're not already loading to prevent infinite loop
        if (promptsToLoad.length > 0 && !this._isLoadingPromptDescriptions) {
            this.loadPromptDescriptions(promptsToLoad);
            return [];
        }
        // Now process the suggestions with loaded descriptions
        const promptsWithScores = [];
        for (const [promptName, condition] of Object.entries(suggestions)) {
            let score = 0;
            // Handle boolean conditions
            if (typeof condition === 'boolean') {
                score = condition ? 1 : 0;
            }
            // Handle when clause conditions
            else if (typeof condition === 'string') {
                try {
                    const whenClause = ContextKeyExpr.deserialize(condition);
                    if (whenClause) {
                        // Test against all open code editors
                        const allEditors = this.codeEditorService.listCodeEditors();
                        if (allEditors.length > 0) {
                            // Count how many editors match the when clause
                            score = allEditors.reduce((count, editor) => {
                                try {
                                    const editorContext = this.contextKeyService.getContext(editor.getDomNode());
                                    return count + (whenClause.evaluate(editorContext) ? 1 : 0);
                                }
                                catch (error) {
                                    // Log error for this specific editor but continue with others
                                    this.logService.warn('Failed to evaluate when clause for editor:', error);
                                    return count;
                                }
                            }, 0);
                        }
                        else {
                            // Fallback to global context if no editors are open
                            score = this.contextKeyService.contextMatchesRules(whenClause) ? 1 : 0;
                        }
                    }
                    else {
                        score = 0;
                    }
                }
                catch (error) {
                    // Log the error but don't fail completely
                    this.logService.warn('Failed to parse when clause for prompt file suggestion:', condition, error);
                    score = 0;
                }
            }
            if (score > 0) {
                promptsWithScores.push({ promptName, condition, score });
            }
        }
        // Sort by score (descending) and take top 5
        promptsWithScores.sort((a, b) => b.score - a.score);
        const topPrompts = promptsWithScores.slice(0, 5);
        // Build the final result array
        for (const { promptName } of topPrompts) {
            const description = this.promptDescriptionsCache.get(promptName);
            const commandLabel = localize('chatWidget.promptFile.commandLabel', "{0}", promptName);
            const uri = this.promptUriCache.get(promptName);
            const descriptionText = description?.trim() ? description : undefined;
            result.push({
                icon: Codicon.run,
                label: commandLabel,
                description: descriptionText,
                prompt: `/${promptName} `,
                uri: uri
            });
        }
        return result;
    }
    async loadPromptDescriptions(promptNames) {
        // Don't start loading if the widget is being disposed
        if (this._store.isDisposed) {
            return;
        }
        // Set loading guard to prevent infinite loop
        this._isLoadingPromptDescriptions = true;
        try {
            // Get all available prompt files with their metadata
            const promptCommands = await this.promptsService.getPromptSlashCommands(CancellationToken.None);
            let cacheUpdated = false;
            // Load descriptions only for the specified prompts
            for (const promptCommand of promptCommands) {
                if (promptNames.includes(promptCommand.name)) {
                    const description = promptCommand.description;
                    if (description) {
                        this.promptDescriptionsCache.set(promptCommand.name, description);
                        cacheUpdated = true;
                    }
                    else {
                        // Set empty string to indicate we've checked this prompt
                        this.promptDescriptionsCache.set(promptCommand.name, '');
                        cacheUpdated = true;
                    }
                }
            }
            // Fire event to trigger a re-render of the welcome view only if cache was updated
            if (cacheUpdated) {
                this._welcomeRenderScheduler.schedule();
            }
        }
        catch (error) {
            this.logService.warn('Failed to load specific prompt descriptions:', error);
        }
        finally {
            // Always clear the loading guard, even on error
            this._isLoadingPromptDescriptions = false;
        }
    }
    async renderChatEditingSessionState() {
        if (!this.input) {
            return;
        }
        this.input.renderChatEditingSessionState(this._editingSession.get() ?? null);
        if (this.bodyDimension) {
            this.layout(this.bodyDimension.height, this.bodyDimension.width);
        }
    }
    async renderFollowups() {
        if (this.lastItem && isResponseVM(this.lastItem) && this.lastItem.isComplete && this.input.currentModeKind === ChatModeKind.Ask) {
            this.input.renderFollowups(this.lastItem.replyFollowups, this.lastItem);
        }
        else {
            this.input.renderFollowups(undefined, undefined);
        }
        if (this.bodyDimension) {
            this.layout(this.bodyDimension.height, this.bodyDimension.width);
        }
    }
    renderChatSuggestNextWidget() {
        if (this.lifecycleService.willShutdown) {
            return;
        }
        // Skip rendering in coding agent sessions
        if (this.isLockedToCodingAgent) {
            this.chatSuggestNextWidget.hide();
            return;
        }
        const items = this.viewModel?.getItems() ?? [];
        if (!items.length) {
            return;
        }
        const lastItem = items[items.length - 1];
        const lastResponseComplete = lastItem && isResponseVM(lastItem) && lastItem.isComplete;
        if (!lastResponseComplete) {
            return;
        }
        // Get the currently selected mode directly from the observable
        // Note: We use currentModeObs instead of currentModeKind because currentModeKind returns
        // the ChatModeKind enum (e.g., 'agent'), which doesn't distinguish between custom modes.
        // Custom modes all have kind='agent' but different IDs.
        const currentMode = this.input.currentModeObs.get();
        const handoffs = currentMode?.handOffs?.get();
        // Only show if: mode has handoffs AND chat has content AND not quick chat
        const shouldShow = currentMode && handoffs && handoffs.length > 0;
        if (shouldShow) {
            // Log telemetry only when widget transitions from hidden to visible
            const wasHidden = this.chatSuggestNextWidget.domNode.style.display === 'none';
            this.chatSuggestNextWidget.render(currentMode);
            if (wasHidden) {
                this.telemetryService.publicLog2('chat.handoffWidgetShown', {
                    agent: currentMode.id,
                    handoffCount: handoffs.length
                });
            }
        }
        else {
            this.chatSuggestNextWidget.hide();
        }
        // Trigger layout update
        if (this.bodyDimension) {
            this.layout(this.bodyDimension.height, this.bodyDimension.width);
        }
    }
    handleNextPromptSelection(handoff, agentId) {
        // Hide the widget after selection
        this.chatSuggestNextWidget.hide();
        const promptToUse = handoff.prompt;
        // Log telemetry
        const currentMode = this.input.currentModeObs.get();
        const fromAgent = currentMode?.id ?? '';
        this.telemetryService.publicLog2('chat.handoffClicked', {
            fromAgent: fromAgent,
            toAgent: agentId || handoff.agent || '',
            hasPrompt: Boolean(promptToUse),
            autoSend: Boolean(handoff.send)
        });
        // If agentId is provided (from chevron dropdown), delegate to that chat session
        // Otherwise, switch to the handoff agent
        if (agentId) {
            // Delegate to chat session (e.g., @background or @cloud)
            this.input.setValue(`@${agentId} ${promptToUse}`, false);
            this.input.focus();
            // Auto-submit for delegated chat sessions
            this.acceptInput();
        }
        else if (handoff.agent) {
            // Regular handoff to specified agent
            this._switchToAgentByName(handoff.agent);
            // Insert the handoff prompt into the input
            this.input.setValue(promptToUse, false);
            this.input.focus();
            // Auto-submit if send flag is true
            if (handoff.send) {
                this.acceptInput();
            }
        }
    }
    setVisible(visible) {
        const wasVisible = this._visible;
        this._visible = visible;
        this.visibleChangeCount++;
        this.renderer.setVisible(visible);
        this.input.setVisible(visible);
        if (visible) {
            if (!wasVisible) {
                this.timeoutDisposable.value = disposableTimeout(() => {
                    // Progressive rendering paused while hidden, so start it up again.
                    // Do it after a timeout because the container is not visible yet (it should be but offsetHeight returns 0 here)
                    if (this._visible) {
                        this.onDidChangeItems(true);
                    }
                }, 0);
                dom.scheduleAtNextAnimationFrame(dom.getWindow(this.listContainer), () => {
                    this._onDidShow.fire();
                });
            }
        }
        else if (wasVisible) {
            this._onDidHide.fire();
        }
    }
    createList(listContainer, options) {
        const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, this.contextKeyService])));
        const delegate = scopedInstantiationService.createInstance(ChatListDelegate, this.viewOptions.defaultElementHeight ?? 200);
        const rendererDelegate = {
            getListLength: () => this.tree.getNode(null).visibleChildrenCount,
            onDidScroll: this.onDidScroll,
            container: listContainer,
            currentChatMode: () => this.input.currentModeKind,
        };
        // Create a dom element to hold UI from editor widgets embedded in chat messages
        const overflowWidgetsContainer = document.createElement('div');
        overflowWidgetsContainer.classList.add('chat-overflow-widget-container', 'monaco-editor');
        listContainer.append(overflowWidgetsContainer);
        this.renderer = this._register(scopedInstantiationService.createInstance(ChatListItemRenderer, this.editorOptions, options, rendererDelegate, this._codeBlockModelCollection, overflowWidgetsContainer, this.viewModel));
        this._register(this.renderer.onDidClickRequest(async (item) => {
            this.clickedRequest(item);
        }));
        this._register(this.renderer.onDidRerender(item => {
            if (isRequestVM(item.currentElement) && this.configurationService.getValue('chat.editRequests') !== 'input') {
                if (!item.rowContainer.contains(this.inputContainer)) {
                    item.rowContainer.appendChild(this.inputContainer);
                }
                this.input.focus();
            }
        }));
        this._register(this.renderer.onDidDispose((item) => {
            this.focusedInputDOM.appendChild(this.inputContainer);
            this.input.focus();
        }));
        this._register(this.renderer.onDidFocusOutside(() => {
            this.finishedEditing();
        }));
        this._register(this.renderer.onDidClickFollowup(item => {
            // is this used anymore?
            this.acceptInput(item.message);
        }));
        this._register(this.renderer.onDidClickRerunWithAgentOrCommandDetection(e => {
            const request = this.chatService.getSession(e.sessionResource)?.getRequests().find(candidate => candidate.id === e.requestId);
            if (request) {
                const options = {
                    noCommandDetection: true,
                    attempt: request.attempt + 1,
                    location: this.location,
                    userSelectedModelId: this.input.currentLanguageModel,
                    modeInfo: this.input.currentModeInfo,
                };
                this.chatService.resendRequest(request, options).catch(e => this.logService.error('FAILED to rerun request', e));
            }
        }));
        this.tree = this._register(scopedInstantiationService.createInstance((WorkbenchObjectTree), 'Chat', listContainer, delegate, [this.renderer], {
            identityProvider: { getId: (e) => e.id },
            horizontalScrolling: false,
            alwaysConsumeMouseWheel: false,
            supportDynamicHeights: true,
            hideTwistiesOfChildlessElements: true,
            accessibilityProvider: this.instantiationService.createInstance(ChatAccessibilityProvider),
            keyboardNavigationLabelProvider: { getKeyboardNavigationLabel: (e) => isRequestVM(e) ? e.message : isResponseVM(e) ? e.response.value : '' }, // TODO
            setRowLineHeight: false,
            filter: this.viewOptions.filter ? { filter: this.viewOptions.filter.bind(this.viewOptions), } : undefined,
            scrollToActiveElement: true,
            overrideStyles: {
                listFocusBackground: this.styles.listBackground,
                listInactiveFocusBackground: this.styles.listBackground,
                listActiveSelectionBackground: this.styles.listBackground,
                listFocusAndSelectionBackground: this.styles.listBackground,
                listInactiveSelectionBackground: this.styles.listBackground,
                listHoverBackground: this.styles.listBackground,
                listBackground: this.styles.listBackground,
                listFocusForeground: this.styles.listForeground,
                listHoverForeground: this.styles.listForeground,
                listInactiveFocusForeground: this.styles.listForeground,
                listInactiveSelectionForeground: this.styles.listForeground,
                listActiveSelectionForeground: this.styles.listForeground,
                listFocusAndSelectionForeground: this.styles.listForeground,
                listActiveSelectionIconForeground: undefined,
                listInactiveSelectionIconForeground: undefined,
            }
        }));
        this._register(this.tree.onDidChangeFocus(() => {
            const focused = this.tree.getFocus();
            if (focused && focused.length > 0) {
                const focusedItem = focused[0];
                const items = this.tree.getNode(null).children;
                const idx = items.findIndex(i => i.element === focusedItem);
                if (idx !== -1) {
                    this._mostRecentlyFocusedItemIndex = idx;
                }
            }
        }));
        this._register(this.tree.onContextMenu(e => this.onContextMenu(e)));
        this._register(this.tree.onDidChangeContentHeight(() => {
            this.onDidChangeTreeContentHeight();
        }));
        this._register(this.renderer.onDidChangeItemHeight(e => {
            if (this.tree.hasElement(e.element) && this.visible) {
                this.tree.updateElementHeight(e.element, e.height);
            }
        }));
        this._register(this.tree.onDidFocus(() => {
            this._onDidFocus.fire();
        }));
        this._register(this.tree.onDidScroll(() => {
            this._onDidScroll.fire();
            const isScrolledDown = this.tree.scrollTop >= this.tree.scrollHeight - this.tree.renderHeight - 2;
            this.container.classList.toggle('show-scroll-down', !isScrolledDown && !this.scrollLock);
        }));
    }
    startEditing(requestId) {
        const editedRequest = this.renderer.getTemplateDataForRequestId(requestId);
        if (editedRequest) {
            this.clickedRequest(editedRequest);
        }
    }
    clickedRequest(item) {
        const currentElement = item.currentElement;
        if (isRequestVM(currentElement) && !this.viewModel?.editing) {
            const requests = this.viewModel?.model.getRequests();
            if (!requests || !this.viewModel?.sessionResource) {
                return;
            }
            // this will only ever be true if we restored a checkpoint
            if (this.viewModel?.model.checkpoint) {
                this.recentlyRestoredCheckpoint = true;
            }
            this.viewModel?.model.setCheckpoint(currentElement.id);
            // set contexts and request to false
            const currentContext = [];
            for (let i = requests.length - 1; i >= 0; i -= 1) {
                const request = requests[i];
                if (request.id === currentElement.id) {
                    request.shouldBeBlocked = false; // unblocking just this request.
                    if (request.attachedContext) {
                        const context = request.attachedContext.filter(entry => !(isPromptFileVariableEntry(entry) || isPromptTextVariableEntry(entry)) || !entry.automaticallyAdded);
                        currentContext.push(...context);
                    }
                }
            }
            // set states
            this.viewModel?.setEditing(currentElement);
            if (item?.contextKeyService) {
                ChatContextKeys.currentlyEditing.bindTo(item.contextKeyService).set(true);
            }
            const isInput = this.configurationService.getValue('chat.editRequests') === 'input';
            this.inputPart?.setEditing(!!this.viewModel?.editing && isInput);
            if (!isInput) {
                const rowContainer = item.rowContainer;
                this.inputContainer = dom.$('.chat-edit-input-container');
                rowContainer.appendChild(this.inputContainer);
                this.createInput(this.inputContainer);
                this.input.setChatMode(this.inputPart.currentModeKind);
            }
            else {
                this.inputPart.element.classList.add('editing');
            }
            this.inputPart.toggleChatInputOverlay(!isInput);
            if (currentContext.length > 0) {
                this.input.attachmentModel.addContext(...currentContext);
            }
            // rerenders
            this.inputPart.dnd.setDisabledOverlay(!isInput);
            this.input.renderAttachedContext();
            this.input.setValue(currentElement.messageText, false);
            this.renderer.updateItemHeightOnRender(currentElement, item);
            this.onDidChangeItems();
            this.input.inputEditor.focus();
            this._register(this.inputPart.onDidClickOverlay(() => {
                if (this.viewModel?.editing && this.configurationService.getValue('chat.editRequests') !== 'input') {
                    this.finishedEditing();
                }
            }));
            // listeners
            if (!isInput) {
                this._register(this.inlineInputPart.inputEditor.onDidChangeModelContent(() => {
                    this.scrollToCurrentItem(currentElement);
                }));
                this._register(this.inlineInputPart.inputEditor.onDidChangeCursorSelection((e) => {
                    this.scrollToCurrentItem(currentElement);
                }));
            }
        }
        this.telemetryService.publicLog2('chat.startEditingRequests', {
            editRequestType: this.configurationService.getValue('chat.editRequests'),
        });
    }
    finishedEditing(completedEdit) {
        // reset states
        const editedRequest = this.renderer.getTemplateDataForRequestId(this.viewModel?.editing?.id);
        if (this.recentlyRestoredCheckpoint) {
            this.recentlyRestoredCheckpoint = false;
        }
        else {
            this.viewModel?.model.setCheckpoint(undefined);
        }
        this.inputPart.dnd.setDisabledOverlay(false);
        if (editedRequest?.contextKeyService) {
            ChatContextKeys.currentlyEditing.bindTo(editedRequest.contextKeyService).set(false);
        }
        const isInput = this.configurationService.getValue('chat.editRequests') === 'input';
        if (!isInput) {
            this.inputPart.setChatMode(this.input.currentModeKind);
            const currentModel = this.input.selectedLanguageModel;
            if (currentModel) {
                this.inputPart.switchModel(currentModel.metadata);
            }
            this.inputPart?.toggleChatInputOverlay(false);
            try {
                if (editedRequest?.rowContainer?.contains(this.inputContainer)) {
                    editedRequest.rowContainer.removeChild(this.inputContainer);
                }
                else if (this.inputContainer.parentElement) {
                    this.inputContainer.parentElement.removeChild(this.inputContainer);
                }
            }
            catch (e) {
                this.logService.error('Error occurred while finishing editing:', e);
            }
            this.inputContainer = dom.$('.empty-chat-state');
            // only dispose if we know the input is not the bottom input object.
            this.input.dispose();
        }
        if (isInput) {
            this.inputPart.element.classList.remove('editing');
        }
        this.viewModel?.setEditing(undefined);
        this.inputPart?.setEditing(!!this.viewModel?.editing && isInput);
        this.onDidChangeItems();
        if (editedRequest?.currentElement) {
            this.renderer.updateItemHeightOnRender(editedRequest.currentElement, editedRequest);
        }
        this.telemetryService.publicLog2('chat.editRequestsFinished', {
            editRequestType: this.configurationService.getValue('chat.editRequests'),
            editCanceled: !completedEdit
        });
        this.inputPart.focus();
    }
    scrollToCurrentItem(currentElement) {
        if (this.viewModel?.editing && currentElement) {
            const element = currentElement;
            if (!this.tree.hasElement(element)) {
                return;
            }
            const relativeTop = this.tree.getRelativeTop(element);
            if (relativeTop === null || relativeTop < 0 || relativeTop > 1) {
                this.tree.reveal(element, 0);
            }
        }
    }
    onContextMenu(e) {
        e.browserEvent.preventDefault();
        e.browserEvent.stopPropagation();
        const selected = e.element;
        // Check if the context menu was opened on a KaTeX element
        const target = e.browserEvent.target;
        const isKatexElement = target.closest(`.${katexContainerClassName}`) !== null;
        const scopedContextKeyService = this.contextKeyService.createOverlay([
            [ChatContextKeys.responseIsFiltered.key, isResponseVM(selected) && !!selected.errorDetails?.responseIsFiltered],
            [ChatContextKeys.isKatexMathElement.key, isKatexElement]
        ]);
        this.contextMenuService.showContextMenu({
            menuId: MenuId.ChatContext,
            menuActionOptions: { shouldForwardArgs: true },
            contextKeyService: scopedContextKeyService,
            getAnchor: () => e.anchor,
            getActionsContext: () => selected,
        });
    }
    onDidChangeTreeContentHeight() {
        // If the list was previously scrolled all the way down, ensure it stays scrolled down, if scroll lock is on
        if (this.tree.scrollHeight !== this.previousTreeScrollHeight) {
            const lastItem = this.viewModel?.getItems().at(-1);
            const lastResponseIsRendering = isResponseVM(lastItem) && lastItem.renderData;
            if (!lastResponseIsRendering || this.scrollLock) {
                // Due to rounding, the scrollTop + renderHeight will not exactly match the scrollHeight.
                // Consider the tree to be scrolled all the way down if it is within 2px of the bottom.
                const lastElementWasVisible = this.tree.scrollTop + this.tree.renderHeight >= this.previousTreeScrollHeight - 2;
                if (lastElementWasVisible) {
                    dom.scheduleAtNextAnimationFrame(dom.getWindow(this.listContainer), () => {
                        // Can't set scrollTop during this event listener, the list might overwrite the change
                        this.scrollToEnd();
                    }, 0);
                }
            }
        }
        // TODO@roblourens add `show-scroll-down` class when button should show
        // Show the button when content height changes, the list is not fully scrolled down, and (the latest response is currently rendering OR I haven't yet scrolled all the way down since the last response)
        // So for example it would not reappear if I scroll up and delete a message
        this.previousTreeScrollHeight = this.tree.scrollHeight;
        this._onDidChangeContentHeight.fire();
    }
    getWidgetViewKindTag() {
        if (!this.viewContext) {
            return 'editor';
        }
        else if (isIChatViewViewContext(this.viewContext)) {
            return 'view';
        }
        else {
            return 'quick';
        }
    }
    createInput(container, options) {
        const commonConfig = {
            renderFollowups: options?.renderFollowups ?? true,
            renderStyle: options?.renderStyle === 'minimal' ? 'compact' : options?.renderStyle,
            renderInputToolbarBelowInput: options?.renderInputToolbarBelowInput ?? false,
            menus: {
                executeToolbar: MenuId.ChatExecute,
                telemetrySource: 'chatWidget',
                ...this.viewOptions.menus
            },
            editorOverflowWidgetsDomNode: this.viewOptions.editorOverflowWidgetsDomNode,
            enableImplicitContext: this.viewOptions.enableImplicitContext,
            renderWorkingSet: this.viewOptions.enableWorkingSet === 'explicit',
            supportsChangingModes: this.viewOptions.supportsChangingModes,
            dndContainer: this.viewOptions.dndContainer,
            widgetViewKindTag: this.getWidgetViewKindTag(),
            defaultMode: this.viewOptions.defaultMode
        };
        if (this.viewModel?.editing) {
            const editedRequest = this.renderer.getTemplateDataForRequestId(this.viewModel?.editing?.id);
            const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, editedRequest?.contextKeyService])));
            this.inlineInputPartDisposable.value = scopedInstantiationService.createInstance(ChatInputPart, this.location, commonConfig, this.styles, true);
        }
        else {
            this.inputPartDisposable.value = this.instantiationService.createInstance(ChatInputPart, this.location, commonConfig, this.styles, false);
        }
        this.input.render(container, '', this);
        this._register(this.input.onDidLoadInputState(() => {
            this.refreshParsedInput();
        }));
        this._register(this.input.onDidFocus(() => this._onDidFocus.fire()));
        this._register(this.input.onDidAcceptFollowup(e => {
            if (!this.viewModel) {
                return;
            }
            let msg = '';
            if (e.followup.agentId && e.followup.agentId !== this.chatAgentService.getDefaultAgent(this.location, this.input.currentModeKind)?.id) {
                const agent = this.chatAgentService.getAgent(e.followup.agentId);
                if (!agent) {
                    return;
                }
                this.lastSelectedAgent = agent;
                msg = `${chatAgentLeader}${agent.name} `;
                if (e.followup.subCommand) {
                    msg += `${chatSubcommandLeader}${e.followup.subCommand} `;
                }
            }
            else if (!e.followup.agentId && e.followup.subCommand && this.chatSlashCommandService.hasCommand(e.followup.subCommand)) {
                msg = `${chatSubcommandLeader}${e.followup.subCommand} `;
            }
            msg += e.followup.message;
            this.acceptInput(msg);
            if (!e.response) {
                // Followups can be shown by the welcome message, then there is no response associated.
                // At some point we probably want telemetry for these too.
                return;
            }
            this.chatService.notifyUserAction({
                sessionResource: this.viewModel.sessionResource,
                requestId: e.response.requestId,
                agentId: e.response.agent?.id,
                command: e.response.slashCommand?.name,
                result: e.response.result,
                action: {
                    kind: 'followUp',
                    followup: e.followup
                },
            });
        }));
        this._register(this.input.onDidChangeHeight(() => {
            const editedRequest = this.renderer.getTemplateDataForRequestId(this.viewModel?.editing?.id);
            if (isRequestVM(editedRequest?.currentElement) && this.viewModel?.editing) {
                this.renderer.updateItemHeightOnRender(editedRequest?.currentElement, editedRequest);
            }
            if (this.bodyDimension) {
                this.layout(this.bodyDimension.height, this.bodyDimension.width);
            }
            this._onDidChangeContentHeight.fire();
        }));
        this._register(this.inputEditor.onDidChangeModelContent(() => {
            this.parsedChatRequest = undefined;
            this.updateChatInputContext();
        }));
        this._register(this.chatAgentService.onDidChangeAgents(() => {
            this.parsedChatRequest = undefined;
            // Tools agent loads -> welcome content changes
            this._welcomeRenderScheduler.schedule();
        }));
        this._register(this.input.onDidChangeCurrentChatMode(() => {
            this._welcomeRenderScheduler.schedule();
            this.refreshParsedInput();
            this.renderFollowups();
            this.renderChatSuggestNextWidget();
        }));
        this._register(autorun(r => {
            const toolSetIds = new Set();
            const toolIds = new Set();
            for (const [entry, enabled] of this.input.selectedToolsModel.entriesMap.read(r)) {
                if (enabled) {
                    if (entry instanceof ToolSet) {
                        toolSetIds.add(entry.id);
                    }
                    else {
                        toolIds.add(entry.id);
                    }
                }
            }
            const disabledTools = this.input.attachmentModel.attachments
                .filter(a => a.kind === 'tool' && !toolIds.has(a.id) || a.kind === 'toolset' && !toolSetIds.has(a.id))
                .map(a => a.id);
            this.input.attachmentModel.updateContext(disabledTools, Iterable.empty());
            this.refreshParsedInput();
        }));
    }
    onDidStyleChange() {
        this.container.style.setProperty('--vscode-interactive-result-editor-background-color', this.editorOptions.configuration.resultEditor.backgroundColor?.toString() ?? '');
        this.container.style.setProperty('--vscode-interactive-session-foreground', this.editorOptions.configuration.foreground?.toString() ?? '');
        this.container.style.setProperty('--vscode-chat-list-background', this.themeService.getColorTheme().getColor(this.styles.listBackground)?.toString() ?? '');
    }
    setModel(model) {
        if (!this.container) {
            throw new Error('Call render() before setModel()');
        }
        if (!model) {
            this.viewModel = undefined;
            return;
        }
        if (isEqual(model.sessionResource, this.viewModel?.sessionResource)) {
            return;
        }
        this.inputPart.clearTodoListWidget(model.sessionResource, false);
        this.chatSuggestNextWidget.hide();
        if (this.historyList) {
            this.historyList.setFocus([]);
            this.historyList.setSelection([]);
        }
        // Clear history view state when switching sessions to ensure fresh rendering
        this.historyViewStore.clear();
        this._codeBlockModelCollection.clear();
        this.container.setAttribute('data-session-id', model.sessionId);
        this.viewModel = this.instantiationService.createInstance(ChatViewModel, model, this._codeBlockModelCollection);
        // Pass input model reference to input part for state syncing
        this.inputPart.setInputModel(model.inputModel);
        if (this._lockedAgent) {
            let placeholder = this.chatSessionsService.getInputPlaceholderForSessionType(this._lockedAgent.id);
            if (!placeholder) {
                placeholder = localize('chat.input.placeholder.lockedToAgent', "Chat with {0}", this._lockedAgent.id);
            }
            this.viewModel.setInputPlaceholder(placeholder);
            this.inputEditor.updateOptions({ placeholder });
        }
        else if (this.viewModel.inputPlaceholder) {
            this.inputEditor.updateOptions({ placeholder: this.viewModel.inputPlaceholder });
        }
        const renderImmediately = this.configurationService.getValue('chat.experimental.renderMarkdownImmediately');
        const delay = renderImmediately ? MicrotaskDelay : 0;
        this.viewModelDisposables.add(Event.runAndSubscribe(Event.accumulate(this.viewModel.onDidChange, delay), (events => {
            if (!this.viewModel) {
                return;
            }
            this.requestInProgress.set(this.viewModel.model.requestInProgress.get());
            // Update the editor's placeholder text when it changes in the view model
            if (events?.some(e => e?.kind === 'changePlaceholder')) {
                this.inputEditor.updateOptions({ placeholder: this.viewModel.inputPlaceholder });
            }
            this.onDidChangeItems();
            if (events?.some(e => e?.kind === 'addRequest') && this.visible) {
                this.scrollToEnd();
            }
        })));
        this.viewModelDisposables.add(autorun(reader => {
            this._editingSession.read(reader); // re-render when the session changes
            this.renderChatEditingSessionState();
        }));
        this.viewModelDisposables.add(this.viewModel.onDidDisposeModel(() => {
            // Ensure that view state is saved here, because we will load it again when a new model is assigned
            if (this.viewModel?.editing) {
                this.finishedEditing();
            }
            // Disposes the viewmodel and listeners
            this.viewModel = undefined;
            this.onDidChangeItems();
        }));
        const inputState = model.inputModel.state.get();
        this.input.initForNewChatModel(inputState, model.getRequests().length === 0);
        this.refreshParsedInput();
        this.viewModelDisposables.add(model.onDidChange((e) => {
            if (e.kind === 'setAgent') {
                this._onDidChangeAgent.fire({ agent: e.agent, slashCommand: e.command });
                // Update capabilities context keys when agent changes
                this._updateAgentCapabilitiesContextKeys(e.agent);
            }
            if (e.kind === 'addRequest') {
                this.inputPart.clearTodoListWidget(this.viewModel?.sessionResource, false);
            }
            // Hide widget on request removal
            if (e.kind === 'removeRequest') {
                this.inputPart.clearTodoListWidget(this.viewModel?.sessionResource, true);
                this.chatSuggestNextWidget.hide();
            }
            // Show next steps widget when response completes (not when request starts)
            if (e.kind === 'completedRequest') {
                const lastRequest = this.viewModel?.model.getRequests().at(-1);
                const wasCancelled = lastRequest?.response?.isCanceled ?? false;
                if (wasCancelled) {
                    // Clear todo list when request is cancelled
                    this.inputPart.clearTodoListWidget(this.viewModel?.sessionResource, true);
                }
                // Only show if response wasn't canceled
                this.renderChatSuggestNextWidget();
            }
        }));
        if (this.tree && this.visible) {
            this.onDidChangeItems();
            this.scrollToEnd();
        }
        this.renderer.updateViewModel(this.viewModel);
        this.updateChatInputContext();
        this.input.renderChatTodoListWidget(this.viewModel.sessionResource);
    }
    getFocus() {
        return this.tree.getFocus()[0] ?? undefined;
    }
    reveal(item, relativeTop) {
        this.tree.reveal(item, relativeTop);
    }
    focus(item) {
        const items = this.tree.getNode(null).children;
        const node = items.find(i => i.element?.id === item.id);
        if (!node) {
            return;
        }
        this._mostRecentlyFocusedItemIndex = items.indexOf(node);
        this.tree.setFocus([node.element]);
        this.tree.domFocus();
    }
    refilter() {
        this.tree.refilter();
    }
    setInputPlaceholder(placeholder) {
        this.viewModel?.setInputPlaceholder(placeholder);
    }
    resetInputPlaceholder() {
        this.viewModel?.resetInputPlaceholder();
    }
    setInput(value = '') {
        this.input.setValue(value, false);
        this.refreshParsedInput();
    }
    getInput() {
        return this.input.inputEditor.getValue();
    }
    getContrib(id) {
        return this.contribs.find(c => c.id === id);
    }
    // Coding agent locking methods
    lockToCodingAgent(name, displayName, agentId) {
        this._lockedAgent = {
            id: agentId,
            name,
            prefix: `@${name} `,
            displayName
        };
        this._lockedToCodingAgentContextKey.set(true);
        this._welcomeRenderScheduler.schedule();
        // Update capabilities for the locked agent
        const agent = this.chatAgentService.getAgent(agentId);
        this._updateAgentCapabilitiesContextKeys(agent);
        this.renderer.updateOptions({ restorable: false, editable: false, noFooter: true, progressMessageAtBottomOfResponse: true });
        this.tree.rerender();
    }
    unlockFromCodingAgent() {
        // Clear all state related to locking
        this._lockedAgent = undefined;
        this._lockedToCodingAgentContextKey.set(false);
        this._updateAgentCapabilitiesContextKeys(undefined);
        // Explicitly update the DOM to reflect unlocked state
        this._welcomeRenderScheduler.schedule();
        // Reset to default placeholder
        if (this.viewModel) {
            this.viewModel.resetInputPlaceholder();
        }
        this.inputEditor.updateOptions({ placeholder: undefined });
        this.renderer.updateOptions({ restorable: true, editable: true, noFooter: false, progressMessageAtBottomOfResponse: mode => mode !== ChatModeKind.Ask });
        this.tree.rerender();
    }
    get isLockedToCodingAgent() {
        return !!this._lockedAgent;
    }
    get lockedAgentId() {
        return this._lockedAgent?.id;
    }
    logInputHistory() {
        this.input.logInputHistory();
    }
    async acceptInput(query, options) {
        return this._acceptInput(query ? { query } : undefined, options);
    }
    async rerunLastRequest() {
        if (!this.viewModel) {
            return;
        }
        const sessionResource = this.viewModel.sessionResource;
        const lastRequest = this.chatService.getSession(sessionResource)?.getRequests().at(-1);
        if (!lastRequest) {
            return;
        }
        const options = {
            attempt: lastRequest.attempt + 1,
            location: this.location,
            userSelectedModelId: this.input.currentLanguageModel
        };
        return await this.chatService.resendRequest(lastRequest, options);
    }
    async _applyPromptFileIfSet(requestInput) {
        // first check if the input has a prompt slash command
        const agentSlashPromptPart = this.parsedInput.parts.find((r) => r instanceof ChatRequestSlashPromptPart);
        if (!agentSlashPromptPart) {
            return;
        }
        // need to resolve the slash command to get the prompt file
        const slashCommand = await this.promptsService.resolvePromptSlashCommand(agentSlashPromptPart.name, CancellationToken.None);
        if (!slashCommand) {
            return;
        }
        const parseResult = slashCommand.parsedPromptFile;
        // add the prompt file to the context
        const refs = parseResult.body?.variableReferences.map(({ name, offset }) => ({ name, range: new OffsetRange(offset, offset + name.length + 1) })) ?? [];
        const toolReferences = this.toolsService.toToolReferences(refs);
        requestInput.attachedContext.insertFirst(toPromptFileVariableEntry(parseResult.uri, PromptFileVariableKind.PromptFile, undefined, true, toolReferences));
        // remove the slash command from the input
        requestInput.input = this.parsedInput.parts.filter(part => !(part instanceof ChatRequestSlashPromptPart)).map(part => part.text).join('').trim();
        const input = requestInput.input.trim();
        requestInput.input = `Follow instructions in [${basename(parseResult.uri)}](${parseResult.uri.toString()}).`;
        if (input) {
            // if the input is not empty, append it to the prompt
            requestInput.input += `\n${input}`;
        }
        if (parseResult.header) {
            await this._applyPromptMetadata(parseResult.header, requestInput);
        }
    }
    async _acceptInput(query, options) {
        if (this.viewModel?.model.requestInProgress.get()) {
            return;
        }
        if (!query && this.input.generating) {
            // if the user submits the input and generation finishes quickly, just submit it for them
            const generatingAutoSubmitWindow = 500;
            const start = Date.now();
            await this.input.generating;
            if (Date.now() - start > generatingAutoSubmitWindow) {
                return;
            }
        }
        while (!this._viewModel && !this._store.isDisposed) {
            await Event.toPromise(this.onDidChangeViewModel, this._store);
        }
        if (!this.viewModel) {
            return;
        }
        this._onDidAcceptInput.fire();
        this.scrollLock = this.isLockedToCodingAgent || !!checkModeOption(this.input.currentModeKind, this.viewOptions.autoScroll);
        const editorValue = this.getInput();
        const requestId = this.chatAccessibilityService.acceptRequest();
        const requestInputs = {
            input: !query ? editorValue : query.query,
            attachedContext: options?.enableImplicitContext === false ? this.input.getAttachedContext(this.viewModel.sessionResource) : this.input.getAttachedAndImplicitContext(this.viewModel.sessionResource),
        };
        const isUserQuery = !query;
        if (this.viewModel?.editing) {
            this.finishedEditing(true);
            this.viewModel.model?.setCheckpoint(undefined);
        }
        // process the prompt command
        await this._applyPromptFileIfSet(requestInputs);
        await this._autoAttachInstructions(requestInputs);
        if (this.viewOptions.enableWorkingSet !== undefined && this.input.currentModeKind === ChatModeKind.Edit && !this.chatService.edits2Enabled) {
            const uniqueWorkingSetEntries = new ResourceSet(); // NOTE: this is used for bookkeeping so the UI can avoid rendering references in the UI that are already shown in the working set
            const editingSessionAttachedContext = requestInputs.attachedContext;
            // Collect file variables from previous requests before sending the request
            const previousRequests = this.viewModel.model.getRequests();
            for (const request of previousRequests) {
                for (const variable of request.variableData.variables) {
                    if (URI.isUri(variable.value) && variable.kind === 'file') {
                        const uri = variable.value;
                        if (!uniqueWorkingSetEntries.has(uri)) {
                            editingSessionAttachedContext.add(variable);
                            uniqueWorkingSetEntries.add(variable.value);
                        }
                    }
                }
            }
            requestInputs.attachedContext = editingSessionAttachedContext;
            this.telemetryService.publicLog2('chatEditing/workingSetSize', { originalSize: uniqueWorkingSetEntries.size, actualSize: uniqueWorkingSetEntries.size });
        }
        this.chatService.cancelCurrentRequestForSession(this.viewModel.sessionResource);
        if (this.currentRequest) {
            // We have to wait the current request to be properly cancelled so that it has a chance to update the model with its result metadata.
            // This is awkward, it's basically a limitation of the chat provider-based agent.
            await Promise.race([this.currentRequest, timeout(1000)]);
        }
        this.input.validateAgentMode();
        if (this.viewModel.model.checkpoint) {
            const requests = this.viewModel.model.getRequests();
            for (let i = requests.length - 1; i >= 0; i -= 1) {
                const request = requests[i];
                if (request.shouldBeBlocked) {
                    this.chatService.removeRequest(this.viewModel.sessionResource, request.id);
                }
            }
        }
        const result = await this.chatService.sendRequest(this.viewModel.sessionResource, requestInputs.input, {
            userSelectedModelId: this.input.currentLanguageModel,
            location: this.location,
            locationData: this._location.resolveData?.(),
            parserContext: { selectedAgent: this._lastSelectedAgent, mode: this.input.currentModeKind },
            attachedContext: requestInputs.attachedContext.asArray(),
            noCommandDetection: options?.noCommandDetection,
            ...this.getModeRequestOptions(),
            modeInfo: this.input.currentModeInfo,
            agentIdSilent: this._lockedAgent?.id,
        });
        if (!result) {
            return;
        }
        this.input.acceptInput(isUserQuery);
        this._onDidSubmitAgent.fire({ agent: result.agent, slashCommand: result.slashCommand });
        this.currentRequest = result.responseCompletePromise.then(() => {
            const responses = this.viewModel?.getItems().filter(isResponseVM);
            const lastResponse = responses?.[responses.length - 1];
            this.chatAccessibilityService.acceptResponse(this, this.container, lastResponse, requestId, options?.isVoiceInput);
            if (lastResponse?.result?.nextQuestion) {
                const { prompt, participant, command } = lastResponse.result.nextQuestion;
                const question = formatChatQuestion(this.chatAgentService, this.location, prompt, participant, command);
                if (question) {
                    this.input.setValue(question, false);
                }
            }
            this.currentRequest = undefined;
        });
        return result.responseCreatedPromise;
    }
    getModeRequestOptions() {
        return {
            modeInfo: this.input.currentModeInfo,
            userSelectedTools: this.input.selectedToolsModel.userSelectedTools,
        };
    }
    getCodeBlockInfosForResponse(response) {
        return this.renderer.getCodeBlockInfosForResponse(response);
    }
    getCodeBlockInfoForEditor(uri) {
        return this.renderer.getCodeBlockInfoForEditor(uri);
    }
    getFileTreeInfosForResponse(response) {
        return this.renderer.getFileTreeInfosForResponse(response);
    }
    getLastFocusedFileTreeForResponse(response) {
        return this.renderer.getLastFocusedFileTreeForResponse(response);
    }
    focusResponseItem(lastFocused) {
        if (!this.viewModel) {
            return;
        }
        const items = this.tree.getNode(null).children;
        let item;
        if (lastFocused) {
            item = items[this._mostRecentlyFocusedItemIndex] ?? items[items.length - 1];
        }
        else {
            item = items[items.length - 1];
        }
        if (!item) {
            return;
        }
        this.tree.setFocus([item.element]);
        this.tree.domFocus();
    }
    layout(height, width) {
        width = Math.min(width, this.viewOptions.renderStyle === 'minimal' ? width : 950); // no min width of inline chat
        const heightUpdated = this.bodyDimension && this.bodyDimension.height !== height;
        this.bodyDimension = new dom.Dimension(width, height);
        const layoutHeight = this._dynamicMessageLayoutData?.enabled ? this._dynamicMessageLayoutData.maxHeight : height;
        if (this.viewModel?.editing) {
            this.inlineInputPart?.layout(layoutHeight, width);
        }
        this.inputPart.layout(layoutHeight, width);
        const inputHeight = this.inputPart.inputPartHeight;
        const chatSuggestNextWidgetHeight = this.chatSuggestNextWidget.height;
        const lastElementVisible = this.tree.scrollTop + this.tree.renderHeight >= this.tree.scrollHeight - 2;
        const lastItem = this.viewModel?.getItems().at(-1);
        const contentHeight = Math.max(0, height - inputHeight - chatSuggestNextWidgetHeight);
        if (this.viewOptions.renderStyle === 'compact' || this.viewOptions.renderStyle === 'minimal') {
            this.listContainer.style.removeProperty('--chat-current-response-min-height');
        }
        else {
            this.listContainer.style.setProperty('--chat-current-response-min-height', contentHeight * .75 + 'px');
            if (heightUpdated && lastItem && this.visible) {
                this.tree.updateElementHeight(lastItem, undefined);
            }
        }
        this.tree.layout(contentHeight, width);
        // Push the welcome message down so it doesn't change position
        // when followups, attachments, working set, todo list, or suggest next widget appear
        let welcomeOffset = 100;
        if (this.viewOptions.renderFollowups) {
            welcomeOffset = Math.max(welcomeOffset - this.input.followupsHeight, 0);
        }
        if (this.viewOptions.enableWorkingSet) {
            welcomeOffset = Math.max(welcomeOffset - this.input.editSessionWidgetHeight, 0);
        }
        welcomeOffset = Math.max(welcomeOffset - this.input.todoListWidgetHeight, 0);
        welcomeOffset = Math.max(welcomeOffset - this.input.attachmentsHeight, 0);
        this.welcomeMessageContainer.style.height = `${contentHeight - welcomeOffset}px`;
        this.welcomeMessageContainer.style.paddingBottom = `${welcomeOffset}px`;
        this.renderer.layout(width);
        const lastResponseIsRendering = isResponseVM(lastItem) && lastItem.renderData;
        if (lastElementVisible && (!lastResponseIsRendering || checkModeOption(this.input.currentModeKind, this.viewOptions.autoScroll))) {
            this.scrollToEnd();
        }
        this.listContainer.style.height = `${contentHeight}px`;
        this._onDidChangeHeight.fire(height);
    }
    // An alternative to layout, this allows you to specify the number of ChatTreeItems
    // you want to show, and the max height of the container. It will then layout the
    // tree to show that many items.
    // TODO@TylerLeonhardt: This could use some refactoring to make it clear which layout strategy is being used
    setDynamicChatTreeItemLayout(numOfChatTreeItems, maxHeight) {
        this._dynamicMessageLayoutData = { numOfMessages: numOfChatTreeItems, maxHeight, enabled: true };
        this._register(this.renderer.onDidChangeItemHeight(() => this.layoutDynamicChatTreeItemMode()));
        const mutableDisposable = this._register(new MutableDisposable());
        this._register(this.tree.onDidScroll((e) => {
            // TODO@TylerLeonhardt this should probably just be disposed when this is disabled
            // and then set up again when it is enabled again
            if (!this._dynamicMessageLayoutData?.enabled) {
                return;
            }
            mutableDisposable.value = dom.scheduleAtNextAnimationFrame(dom.getWindow(this.listContainer), () => {
                if (!e.scrollTopChanged || e.heightChanged || e.scrollHeightChanged) {
                    return;
                }
                const renderHeight = e.height;
                const diff = e.scrollHeight - renderHeight - e.scrollTop;
                if (diff === 0) {
                    return;
                }
                const possibleMaxHeight = (this._dynamicMessageLayoutData?.maxHeight ?? maxHeight);
                const width = this.bodyDimension?.width ?? this.container.offsetWidth;
                this.input.layout(possibleMaxHeight, width);
                const inputPartHeight = this.input.inputPartHeight;
                const chatSuggestNextWidgetHeight = this.chatSuggestNextWidget.height;
                const newHeight = Math.min(renderHeight + diff, possibleMaxHeight - inputPartHeight - chatSuggestNextWidgetHeight);
                this.layout(newHeight + inputPartHeight + chatSuggestNextWidgetHeight, width);
            });
        }));
    }
    updateDynamicChatTreeItemLayout(numOfChatTreeItems, maxHeight) {
        this._dynamicMessageLayoutData = { numOfMessages: numOfChatTreeItems, maxHeight, enabled: true };
        let hasChanged = false;
        let height = this.bodyDimension.height;
        let width = this.bodyDimension.width;
        if (maxHeight < this.bodyDimension.height) {
            height = maxHeight;
            hasChanged = true;
        }
        const containerWidth = this.container.offsetWidth;
        if (this.bodyDimension?.width !== containerWidth) {
            width = containerWidth;
            hasChanged = true;
        }
        if (hasChanged) {
            this.layout(height, width);
        }
    }
    get isDynamicChatTreeItemLayoutEnabled() {
        return this._dynamicMessageLayoutData?.enabled ?? false;
    }
    set isDynamicChatTreeItemLayoutEnabled(value) {
        if (!this._dynamicMessageLayoutData) {
            return;
        }
        this._dynamicMessageLayoutData.enabled = value;
    }
    layoutDynamicChatTreeItemMode() {
        if (!this.viewModel || !this._dynamicMessageLayoutData?.enabled) {
            return;
        }
        const width = this.bodyDimension?.width ?? this.container.offsetWidth;
        this.input.layout(this._dynamicMessageLayoutData.maxHeight, width);
        const inputHeight = this.input.inputPartHeight;
        const chatSuggestNextWidgetHeight = this.chatSuggestNextWidget.height;
        const totalMessages = this.viewModel.getItems();
        // grab the last N messages
        const messages = totalMessages.slice(-this._dynamicMessageLayoutData.numOfMessages);
        const needsRerender = messages.some(m => m.currentRenderedHeight === undefined);
        const listHeight = needsRerender
            ? this._dynamicMessageLayoutData.maxHeight
            : messages.reduce((acc, message) => acc + message.currentRenderedHeight, 0);
        this.layout(Math.min(
        // we add an additional 18px in order to show that there is scrollable content
        inputHeight + chatSuggestNextWidgetHeight + listHeight + (totalMessages.length > 2 ? 18 : 0), this._dynamicMessageLayoutData.maxHeight), width);
        if (needsRerender || !listHeight) {
            this.scrollToEnd();
        }
    }
    saveState() {
        // no-op
    }
    getViewState() {
        return this.input.getCurrentInputState();
    }
    updateChatInputContext() {
        const currentAgent = this.parsedInput.parts.find(part => part instanceof ChatRequestAgentPart);
        this.agentInInput.set(!!currentAgent);
    }
    async _switchToAgentByName(agentName) {
        const currentAgent = this.input.currentModeObs.get();
        // switch to appropriate agent if needed
        if (agentName !== currentAgent.name.get()) {
            // Find the mode object to get its kind
            const agent = this.chatModeService.findModeByName(agentName);
            if (agent) {
                if (currentAgent.kind !== agent.kind) {
                    const chatModeCheck = await this.instantiationService.invokeFunction(handleModeSwitch, currentAgent.kind, agent.kind, this.viewModel?.model.getRequests().length ?? 0, this.viewModel?.model.editingSession);
                    if (!chatModeCheck) {
                        return;
                    }
                    if (chatModeCheck.needToClearSession) {
                        await this.clear();
                    }
                }
                this.input.setChatMode(agent.id);
            }
        }
    }
    async _applyPromptMetadata({ agent, tools, model }, requestInput) {
        if (tools !== undefined && !agent && this.input.currentModeKind !== ChatModeKind.Agent) {
            agent = ChatMode.Agent.name.get();
        }
        // switch to appropriate agent if needed
        if (agent) {
            this._switchToAgentByName(agent);
        }
        // if not tools to enable are present, we are done
        if (tools !== undefined && this.input.currentModeKind === ChatModeKind.Agent) {
            const enablementMap = this.toolsService.toToolAndToolSetEnablementMap(tools, Target.VSCode);
            this.input.selectedToolsModel.set(enablementMap, true);
        }
        if (model !== undefined) {
            this.input.switchModelByQualifiedName(model);
        }
    }
    /**
     * Adds additional instructions to the context
     * - instructions that have a 'applyTo' pattern that matches the current input
     * - instructions referenced in the copilot settings 'copilot-instructions'
     * - instructions referenced in an already included instruction file
     */
    async _autoAttachInstructions({ attachedContext }) {
        this.logService.debug(`ChatWidget#_autoAttachInstructions: prompt files are always enabled`);
        const computer = this.instantiationService.createInstance(ComputeAutomaticInstructions, this._getReadTool());
        await computer.collect(attachedContext, CancellationToken.None);
    }
    _getReadTool() {
        if (this.input.currentModeKind !== ChatModeKind.Agent) {
            return undefined;
        }
        const readFileTool = this.toolsService.getToolByName('readFile');
        if (!readFileTool || !this.input.selectedToolsModel.userSelectedTools.get()[readFileTool.id]) {
            return undefined;
        }
        return readFileTool;
    }
    delegateScrollFromMouseWheelEvent(browserEvent) {
        this.tree.delegateScrollFromMouseWheelEvent(browserEvent);
    }
};
ChatWidget = ChatWidget_1 = __decorate([
    __param(4, ICodeEditorService),
    __param(5, IEditorService),
    __param(6, IConfigurationService),
    __param(7, IContextKeyService),
    __param(8, IInstantiationService),
    __param(9, IChatService),
    __param(10, IChatAgentService),
    __param(11, IChatWidgetService),
    __param(12, IContextMenuService),
    __param(13, IChatAccessibilityService),
    __param(14, ILogService),
    __param(15, IThemeService),
    __param(16, IChatSlashCommandService),
    __param(17, IChatEditingService),
    __param(18, ITelemetryService),
    __param(19, IPromptsService),
    __param(20, ILanguageModelToolsService),
    __param(21, IChatModeService),
    __param(22, IChatLayoutService),
    __param(23, IChatEntitlementService),
    __param(24, ICommandService),
    __param(25, IHoverService),
    __param(26, IChatSessionsService),
    __param(27, IChatTodoListService),
    __param(28, IWorkspaceContextService),
    __param(29, ILifecycleService)
], ChatWidget);
export { ChatWidget };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFdpZGdldC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFdpZGdldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQW9CLGtCQUFrQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDOUYsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBS3RFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDekUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUVsRSxPQUFPLEVBQW1CLGNBQWMsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUUvRCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3RJLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLE1BQU0sRUFBRSxN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