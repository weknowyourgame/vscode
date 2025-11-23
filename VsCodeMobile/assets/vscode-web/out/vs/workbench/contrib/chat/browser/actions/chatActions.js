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
import { isAncestorOfActiveElement } from '../../../../../base/browser/dom.js';
import { mainWindow } from '../../../../../base/browser/window.js';
import { toAction } from '../../../../../base/common/actions.js';
import { coalesce } from '../../../../../base/common/arrays.js';
import { timeout } from '../../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { fromNowByDay, safeIntl } from '../../../../../base/common/date.js';
import { Event } from '../../../../../base/common/event.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Disposable, DisposableStore, markAsSingleton } from '../../../../../base/common/lifecycle.js';
import { language } from '../../../../../base/common/platform.js';
import { basename, isEqual } from '../../../../../base/common/resources.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { hasKey } from '../../../../../base/common/types.js';
import { URI } from '../../../../../base/common/uri.js';
import { EditorAction2 } from '../../../../../editor/browser/editorExtensions.js';
import { localize, localize2 } from '../../../../../nls.js';
import { IActionViewItemService } from '../../../../../platform/actions/browser/actionViewItemService.js';
import { DropdownWithPrimaryActionViewItem } from '../../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js';
import { getContextMenuActions } from '../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { Action2, IMenuService, MenuId, MenuItemAction, MenuRegistry, registerAction2, SubmenuItemAction } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IsLinuxContext, IsWindowsContext } from '../../../../../platform/contextkey/common/contextkeys.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import product from '../../../../../platform/product/common/product.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { ToggleTitleBarConfigAction } from '../../../../browser/parts/titlebar/titlebarActions.js';
import { ActiveEditorContext, IsCompactTitleBarContext } from '../../../../common/contextkeys.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { ChatEntitlement, IChatEntitlementService } from '../../../../services/chat/common/chatEntitlementService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { ACTIVE_GROUP, AUX_WINDOW_GROUP, IEditorService } from '../../../../services/editor/common/editorService.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { IWorkbenchLayoutService } from '../../../../services/layout/browser/layoutService.js';
import { IPreferencesService } from '../../../../services/preferences/common/preferences.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { EXTENSIONS_CATEGORY, IExtensionsWorkbenchService } from '../../../extensions/common/extensions.js';
import { SCMHistoryItemChangeRangeContentProvider } from '../../../scm/browser/scmHistoryChatContext.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { IChatAgentService } from '../../common/chatAgents.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { ChatMode, IChatModeService } from '../../common/chatModes.js';
import { IChatService } from '../../common/chatService.js';
import { IChatSessionsService, localChatSessionType } from '../../common/chatSessionsService.js';
import { isRequestVM } from '../../common/chatViewModel.js';
import { IChatWidgetHistoryService } from '../../common/chatWidgetHistoryService.js';
import { LEGACY_AGENT_SESSIONS_VIEW_ID, ChatAgentLocation, ChatConfiguration, ChatModeKind } from '../../common/constants.js';
import { ILanguageModelsService } from '../../common/languageModels.js';
import { CopilotUsageExtensionFeatureId } from '../../common/languageModelStats.js';
import { ILanguageModelToolsConfirmationService } from '../../common/languageModelToolsConfirmationService.js';
import { ILanguageModelToolsService } from '../../common/languageModelToolsService.js';
import { ChatViewId, IChatWidgetService } from '../chat.js';
import { ChatEditorInput, shouldShowClearEditingSessionConfirmation, showClearEditingSessionConfirmation } from '../chatEditorInput.js';
import { convertBufferToScreenshotVariable } from '../contrib/screenshot.js';
import { clearChatEditor } from './chatClear.js';
export const CHAT_CATEGORY = localize2('chat.category', 'Chat');
export const ACTION_ID_NEW_CHAT = `workbench.action.chat.newChat`;
export const ACTION_ID_NEW_EDIT_SESSION = `workbench.action.chat.newEditSession`;
export const ACTION_ID_OPEN_CHAT = 'workbench.action.openChat';
export const CHAT_OPEN_ACTION_ID = 'workbench.action.chat.open';
export const CHAT_SETUP_ACTION_ID = 'workbench.action.chat.triggerSetup';
export const CHAT_SETUP_SUPPORT_ANONYMOUS_ACTION_ID = 'workbench.action.chat.triggerSetupSupportAnonymousAction';
const TOGGLE_CHAT_ACTION_ID = 'workbench.action.chat.toggle';
const CHAT_CLEAR_HISTORY_ACTION_ID = 'workbench.action.chat.clearHistory';
export const CHAT_CONFIG_MENU_ID = new MenuId('workbench.chat.menu.config');
const OPEN_CHAT_QUOTA_EXCEEDED_DIALOG = 'workbench.action.chat.openQuotaExceededDialog';
class OpenChatGlobalAction extends Action2 {
    constructor(overrides, mode) {
        super({
            ...overrides,
            icon: Codicon.chatSparkle,
            f1: true,
            category: CHAT_CATEGORY,
            precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabled.negate())
        });
        this.mode = mode;
    }
    async run(accessor, opts) {
        opts = typeof opts === 'string' ? { query: opts } : opts;
        const chatService = accessor.get(IChatService);
        const widgetService = accessor.get(IChatWidgetService);
        const toolsService = accessor.get(ILanguageModelToolsService);
        const hostService = accessor.get(IHostService);
        const chatAgentService = accessor.get(IChatAgentService);
        const instaService = accessor.get(IInstantiationService);
        const commandService = accessor.get(ICommandService);
        const chatModeService = accessor.get(IChatModeService);
        const fileService = accessor.get(IFileService);
        const languageModelService = accessor.get(ILanguageModelsService);
        const scmService = accessor.get(ISCMService);
        let chatWidget = widgetService.lastFocusedWidget;
        // When this was invoked to switch to a mode via keybinding, and some chat widget is focused, use that one.
        // Otherwise, open the view.
        if (!this.mode || !chatWidget || !isAncestorOfActiveElement(chatWidget.domNode)) {
            chatWidget = await widgetService.revealWidget();
        }
        if (!chatWidget) {
            return;
        }
        const switchToMode = (opts?.mode ? chatModeService.findModeByName(opts?.mode) : undefined) ?? this.mode;
        if (switchToMode) {
            await this.handleSwitchToMode(switchToMode, chatWidget, instaService, commandService);
        }
        if (opts?.modelSelector) {
            const ids = await languageModelService.selectLanguageModels(opts.modelSelector, false);
            const id = ids.sort().at(0);
            if (!id) {
                throw new Error(`No language models found matching selector: ${JSON.stringify(opts.modelSelector)}.`);
            }
            const model = languageModelService.lookupLanguageModel(id);
            if (!model) {
                throw new Error(`Language model not loaded: ${id}.`);
            }
            chatWidget.input.setCurrentLanguageModel({ metadata: model, identifier: id });
        }
        if (opts?.previousRequests?.length && chatWidget.viewModel) {
            for (const { request, response } of opts.previousRequests) {
                chatService.addCompleteRequest(chatWidget.viewModel.sessionResource, request, undefined, 0, { message: response });
            }
        }
        if (opts?.attachScreenshot) {
            const screenshot = await hostService.getScreenshot();
            if (screenshot) {
                chatWidget.attachmentModel.addContext(convertBufferToScreenshotVariable(screenshot));
            }
        }
        if (opts?.attachFiles) {
            for (const file of opts.attachFiles) {
                const uri = file instanceof URI ? file : file.uri;
                const range = file instanceof URI ? undefined : file.range;
                if (await fileService.exists(uri)) {
                    chatWidget.attachmentModel.addFile(uri, range);
                }
            }
        }
        if (opts?.attachHistoryItemChanges) {
            for (const historyItemChange of opts.attachHistoryItemChanges) {
                const repository = scmService.getRepository(URI.file(historyItemChange.uri.path));
                const historyProvider = repository?.provider.historyProvider.get();
                if (!historyProvider) {
                    continue;
                }
                const historyItem = await historyProvider.resolveHistoryItem(historyItemChange.historyItemId);
                if (!historyItem) {
                    continue;
                }
                chatWidget.attachmentModel.addContext({
                    id: historyItemChange.uri.toString(),
                    name: `${basename(historyItemChange.uri)}`,
                    value: historyItemChange.uri,
                    historyItem: historyItem,
                    kind: 'scmHistoryItemChange'
                });
            }
        }
        if (opts?.attachHistoryItemChangeRanges) {
            for (const historyItemChangeRange of opts.attachHistoryItemChangeRanges) {
                const repository = scmService.getRepository(URI.file(historyItemChangeRange.end.uri.path));
                const historyProvider = repository?.provider.historyProvider.get();
                if (!repository || !historyProvider) {
                    continue;
                }
                const [historyItemStart, historyItemEnd] = await Promise.all([
                    historyProvider.resolveHistoryItem(historyItemChangeRange.start.historyItemId),
                    historyProvider.resolveHistoryItem(historyItemChangeRange.end.historyItemId),
                ]);
                if (!historyItemStart || !historyItemEnd) {
                    continue;
                }
                const uri = historyItemChangeRange.end.uri.with({
                    scheme: SCMHistoryItemChangeRangeContentProvider.scheme,
                    query: JSON.stringify({
                        repositoryId: repository.id,
                        start: historyItemStart.id,
                        end: historyItemChangeRange.end.historyItemId
                    })
                });
                chatWidget.attachmentModel.addContext({
                    id: uri.toString(),
                    name: `${basename(uri)}`,
                    value: uri,
                    historyItemChangeStart: {
                        uri: historyItemChangeRange.start.uri,
                        historyItem: historyItemStart
                    },
                    historyItemChangeEnd: {
                        uri: historyItemChangeRange.end.uri,
                        historyItem: {
                            ...historyItemEnd,
                            displayId: historyItemChangeRange.end.historyItemId
                        }
                    },
                    kind: 'scmHistoryItemChangeRange'
                });
            }
        }
        let resp;
        if (opts?.query) {
            chatWidget.setInput(opts.query);
            if (!opts.isPartialQuery) {
                if (!chatWidget.viewModel) {
                    await Event.toPromise(chatWidget.onDidChangeViewModel);
                }
                await waitForDefaultAgent(chatAgentService, chatWidget.input.currentModeKind);
                resp = chatWidget.acceptInput();
            }
        }
        if (opts?.toolIds && opts.toolIds.length > 0) {
            for (const toolId of opts.toolIds) {
                const tool = toolsService.getTool(toolId);
                if (tool) {
                    chatWidget.attachmentModel.addContext({
                        id: tool.id,
                        name: tool.displayName,
                        fullName: tool.displayName,
                        value: undefined,
                        icon: ThemeIcon.isThemeIcon(tool.icon) ? tool.icon : undefined,
                        kind: 'tool'
                    });
                }
            }
        }
        chatWidget.focusInput();
        if (opts?.blockOnResponse) {
            const response = await resp;
            if (response) {
                await new Promise(resolve => {
                    const d = response.onDidChange(async () => {
                        if (response.isComplete || response.isPendingConfirmation.get()) {
                            d.dispose();
                            resolve();
                        }
                    });
                });
                return { ...response.result, type: response.isPendingConfirmation.get() ? 'confirmation' : undefined };
            }
        }
        return undefined;
    }
    async handleSwitchToMode(switchToMode, chatWidget, instaService, commandService) {
        const currentMode = chatWidget.input.currentModeKind;
        if (switchToMode) {
            const editingSession = chatWidget.viewModel?.model.editingSession;
            const requestCount = chatWidget.viewModel?.model.getRequests().length ?? 0;
            const chatModeCheck = await instaService.invokeFunction(handleModeSwitch, currentMode, switchToMode.kind, requestCount, editingSession);
            if (!chatModeCheck) {
                return;
            }
            chatWidget.input.setChatMode(switchToMode.id);
            if (chatModeCheck.needToClearSession) {
                await commandService.executeCommand(ACTION_ID_NEW_CHAT);
            }
        }
    }
}
async function waitForDefaultAgent(chatAgentService, mode) {
    const defaultAgent = chatAgentService.getDefaultAgent(ChatAgentLocation.Chat, mode);
    if (defaultAgent) {
        return;
    }
    await Promise.race([
        Event.toPromise(Event.filter(chatAgentService.onDidChangeAgents, () => {
            const defaultAgent = chatAgentService.getDefaultAgent(ChatAgentLocation.Chat, mode);
            return Boolean(defaultAgent);
        })),
        timeout(60_000).then(() => { throw new Error('Timed out waiting for default agent'); })
    ]);
}
class PrimaryOpenChatGlobalAction extends OpenChatGlobalAction {
    constructor() {
        super({
            id: CHAT_OPEN_ACTION_ID,
            title: localize2('openChat', "Open Chat"),
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 39 /* KeyCode.KeyI */,
                mac: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 256 /* KeyMod.WinCtrl */ | 39 /* KeyCode.KeyI */
                }
            },
            menu: [{
                    id: MenuId.ChatTitleBarMenu,
                    group: 'a_open',
                    order: 1
                }]
        });
    }
}
export function getOpenChatActionIdForMode(mode) {
    return `workbench.action.chat.open${mode.name.get()}`;
}
export class ModeOpenChatGlobalAction extends OpenChatGlobalAction {
    constructor(mode, keybinding) {
        super({
            id: getOpenChatActionIdForMode(mode),
            title: localize2('openChatMode', "Open Chat ({0})", mode.label.get()),
            keybinding
        }, mode);
    }
}
export function registerChatActions() {
    registerAction2(PrimaryOpenChatGlobalAction);
    registerAction2(class extends ModeOpenChatGlobalAction {
        constructor() { super(ChatMode.Ask); }
    });
    registerAction2(class extends ModeOpenChatGlobalAction {
        constructor() {
            super(ChatMode.Agent, {
                when: ContextKeyExpr.has(`config.${ChatConfiguration.AgentEnabled}`),
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 39 /* KeyCode.KeyI */,
                linux: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 1024 /* KeyMod.Shift */ | 39 /* KeyCode.KeyI */
                }
            });
        }
    });
    registerAction2(class extends ModeOpenChatGlobalAction {
        constructor() { super(ChatMode.Edit); }
    });
    registerAction2(class ToggleChatAction extends Action2 {
        constructor() {
            super({
                id: TOGGLE_CHAT_ACTION_ID,
                title: localize2('toggleChat', "Toggle Chat"),
                category: CHAT_CATEGORY
            });
        }
        async run(accessor) {
            const layoutService = accessor.get(IWorkbenchLayoutService);
            const viewsService = accessor.get(IViewsService);
            const viewDescriptorService = accessor.get(IViewDescriptorService);
            const widgetService = accessor.get(IChatWidgetService);
            const chatLocation = viewDescriptorService.getViewLocationById(ChatViewId);
            if (viewsService.isViewVisible(ChatViewId)) {
                this.updatePartVisibility(layoutService, chatLocation, false);
            }
            else {
                this.updatePartVisibility(layoutService, chatLocation, true);
                (await widgetService.revealWidget())?.focusInput();
            }
        }
        updatePartVisibility(layoutService, location, visible) {
            let part;
            switch (location) {
                case 1 /* ViewContainerLocation.Panel */:
                    part = "workbench.parts.panel" /* Parts.PANEL_PART */;
                    break;
                case 0 /* ViewContainerLocation.Sidebar */:
                    part = "workbench.parts.sidebar" /* Parts.SIDEBAR_PART */;
                    break;
                case 2 /* ViewContainerLocation.AuxiliaryBar */:
                    part = "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */;
                    break;
            }
            if (part) {
                layoutService.setPartHidden(!visible, part);
            }
        }
    });
    registerAction2(class ChatHistoryAction extends Action2 {
        constructor() {
            super({
                id: `workbench.action.chat.history`,
                title: localize2('chat.history.label', "Show Chats..."),
                menu: [
                    {
                        id: MenuId.ViewTitle,
                        when: ContextKeyExpr.and(ContextKeyExpr.equals('view', ChatViewId), ChatContextKeys.inEmptyStateWithHistoryEnabled.negate()),
                        group: '2_history',
                        order: 1
                    },
                    {
                        id: MenuId.EditorTitle,
                        when: ActiveEditorContext.isEqualTo(ChatEditorInput.EditorID),
                    },
                    {
                        id: MenuId.ChatHistory,
                        when: ChatContextKeys.inEmptyStateWithHistoryEnabled,
                        group: 'navigation',
                    }
                ],
                category: CHAT_CATEGORY,
                icon: Codicon.history,
                f1: true,
                precondition: ChatContextKeys.enabled
            });
            this.showLegacyPicker = async (chatService, quickInputService, commandService, editorService, view) => {
                const clearChatHistoryButton = {
                    iconClass: ThemeIcon.asClassName(Codicon.clearAll),
                    tooltip: localize('interactiveSession.history.clear', "Clear All Workspace Chats"),
                };
                const openInEditorButton = {
                    iconClass: ThemeIcon.asClassName(Codicon.file),
                    tooltip: localize('interactiveSession.history.editor', "Open in Editor"),
                };
                const deleteButton = {
                    iconClass: ThemeIcon.asClassName(Codicon.x),
                    tooltip: localize('interactiveSession.history.delete', "Delete"),
                };
                const renameButton = {
                    iconClass: ThemeIcon.asClassName(Codicon.pencil),
                    tooltip: localize('chat.history.rename', "Rename"),
                };
                const getPicks = async () => {
                    const items = await chatService.getLocalSessionHistory();
                    items.sort((a, b) => (b.lastMessageDate ?? 0) - (a.lastMessageDate ?? 0));
                    let lastDate = undefined;
                    const picks = items.flatMap((i) => {
                        const timeAgoStr = fromNowByDay(i.lastMessageDate, true, true);
                        const separator = timeAgoStr !== lastDate ? {
                            type: 'separator', label: timeAgoStr,
                        } : undefined;
                        lastDate = timeAgoStr;
                        return [
                            separator,
                            {
                                label: i.title,
                                description: i.isActive ? `(${localize('currentChatLabel', 'current')})` : '',
                                chat: i,
                                buttons: i.isActive ? [renameButton] : [
                                    renameButton,
                                    openInEditorButton,
                                    deleteButton,
                                ]
                            }
                        ];
                    });
                    return coalesce(picks);
                };
                const store = new DisposableStore();
                const picker = store.add(quickInputService.createQuickPick({ useSeparators: true }));
                picker.title = localize('interactiveSession.history.title', "Workspace Chat History");
                picker.placeholder = localize('interactiveSession.history.pick', "Switch to chat");
                picker.buttons = [clearChatHistoryButton];
                const picks = await getPicks();
                picker.items = picks;
                store.add(picker.onDidTriggerButton(async (button) => {
                    if (button === clearChatHistoryButton) {
                        await commandService.executeCommand(CHAT_CLEAR_HISTORY_ACTION_ID);
                    }
                }));
                store.add(picker.onDidTriggerItemButton(async (context) => {
                    if (context.button === openInEditorButton) {
                        editorService.openEditor({
                            resource: context.item.chat.sessionResource,
                            options: { pinned: true }
                        }, ACTIVE_GROUP);
                        picker.hide();
                    }
                    else if (context.button === deleteButton) {
                        chatService.removeHistoryEntry(context.item.chat.sessionResource);
                        picker.items = await getPicks();
                    }
                    else if (context.button === renameButton) {
                        const title = await quickInputService.input({ title: localize('newChatTitle', "New chat title"), value: context.item.chat.title });
                        if (title) {
                            chatService.setChatSessionTitle(context.item.chat.sessionResource, title);
                        }
                        // The quick input hides the picker, it gets disposed, so we kick it off from scratch
                        await this.showLegacyPicker(chatService, quickInputService, commandService, editorService, view);
                    }
                }));
                store.add(picker.onDidAccept(async () => {
                    try {
                        const item = picker.selectedItems[0];
                        await view.loadSession(item.chat.sessionResource);
                    }
                    finally {
                        picker.hide();
                    }
                }));
                store.add(picker.onDidHide(() => store.dispose()));
                picker.show();
            };
        }
        async showIntegratedPicker(chatService, quickInputService, commandService, editorService, chatWidgetService, view, chatSessionsService, contextKeyService, menuService, showAllChats = false, showAllAgents = false) {
            const clearChatHistoryButton = {
                iconClass: ThemeIcon.asClassName(Codicon.clearAll),
                tooltip: localize('interactiveSession.history.clear', "Clear All Workspace Chats"),
            };
            const openInEditorButton = {
                iconClass: ThemeIcon.asClassName(Codicon.file),
                tooltip: localize('interactiveSession.history.editor', "Open in Editor"),
            };
            const deleteButton = {
                iconClass: ThemeIcon.asClassName(Codicon.x),
                tooltip: localize('interactiveSession.history.delete', "Delete"),
            };
            const renameButton = {
                iconClass: ThemeIcon.asClassName(Codicon.pencil),
                tooltip: localize('chat.history.rename', "Rename"),
            };
            function isChatPickerItem(item) {
                return hasKey(item, { chat: true });
            }
            function isCodingAgentPickerItem(item) {
                return isChatPickerItem(item) && hasKey(item, { session: true });
            }
            const showMorePick = {
                label: localize('chat.history.showMore', 'Show more...'),
            };
            const showMoreAgentsPick = {
                label: localize('chat.history.showMoreAgents', 'Show more...'),
            };
            const getPicks = async (showAllChats = false, showAllAgents = false) => {
                // Fast picks: Get cached/immediate items first
                const cachedItems = await chatService.getLocalSessionHistory();
                cachedItems.sort((a, b) => (b.lastMessageDate ?? 0) - (a.lastMessageDate ?? 0));
                const allFastPickItems = cachedItems.map((i) => {
                    const timeAgoStr = fromNowByDay(i.lastMessageDate, true, true);
                    const currentLabel = i.isActive ? localize('currentChatLabel', 'current') : '';
                    const description = currentLabel ? `${timeAgoStr} • ${currentLabel}` : timeAgoStr;
                    return {
                        label: i.title,
                        description: description,
                        chat: i,
                        buttons: i.isActive ? [renameButton] : [
                            renameButton,
                            openInEditorButton,
                            deleteButton,
                        ]
                    };
                });
                const fastPickItems = showAllChats ? allFastPickItems : allFastPickItems.slice(0, 5);
                const fastPicks = [];
                if (fastPickItems.length > 0) {
                    fastPicks.push({
                        type: 'separator',
                        label: localize('chat.history.recent', 'Recent Chats'),
                    });
                    fastPicks.push(...fastPickItems);
                    // Add "Show more..." if there are more items and we're not showing all chats
                    if (!showAllChats && allFastPickItems.length > 5) {
                        fastPicks.push(showMorePick);
                    }
                }
                // Slow picks: Get coding agents asynchronously via AsyncIterable
                const slowPicks = (async function* () {
                    try {
                        const agentPicks = [];
                        // Use the new Promise-based API to get chat sessions
                        const cancellationToken = new CancellationTokenSource();
                        try {
                            const providerNSessions = await chatSessionsService.getAllChatSessionItems(cancellationToken.token);
                            for (const { chatSessionType, items } of providerNSessions) {
                                for (const session of items) {
                                    const ckey = contextKeyService.createKey('chatSessionType', chatSessionType);
                                    const actions = menuService.getMenuActions(MenuId.ChatSessionsMenu, contextKeyService);
                                    const { primary } = getContextMenuActions(actions, 'inline');
                                    ckey.reset();
                                    // Use primary actions if available, otherwise fall back to secondary actions
                                    const buttons = primary.map(action => ({
                                        id: action.id,
                                        tooltip: action.tooltip,
                                        iconClass: action.class || ThemeIcon.asClassName(Codicon.symbolClass),
                                    }));
                                    // Create agent pick from the session content
                                    const agentPick = {
                                        label: session.label,
                                        description: chatSessionType,
                                        session: session,
                                        chat: {
                                            sessionResource: session.resource,
                                            title: session.label,
                                            isActive: false,
                                            lastMessageDate: 0,
                                        },
                                        buttons,
                                    };
                                    // Check if this agent already exists (update existing or add new)
                                    const existingIndex = agentPicks.findIndex(pick => isEqual(pick.chat.sessionResource, session.resource));
                                    if (existingIndex >= 0) {
                                        agentPicks[existingIndex] = agentPick;
                                    }
                                    else {
                                        agentPicks.push(agentPick);
                                    }
                                }
                            }
                            // Create current picks with separator if we have agents
                            const currentPicks = [];
                            if (agentPicks.length > 0) {
                                // Always add separator for coding agents section
                                currentPicks.push({
                                    type: 'separator',
                                    label: 'Chat Sessions',
                                });
                                const defaultMaxToShow = 5;
                                const maxToShow = showAllAgents ? Number.MAX_SAFE_INTEGER : defaultMaxToShow;
                                currentPicks.push(...agentPicks
                                    .toSorted((a, b) => (b.session.timing.endTime ?? b.session.timing.startTime) - (a.session.timing.endTime ?? a.session.timing.startTime))
                                    .slice(0, maxToShow));
                                // Add "Show more..." if needed and not showing all agents
                                if (!showAllAgents && agentPicks.length > defaultMaxToShow) {
                                    currentPicks.push(showMoreAgentsPick);
                                }
                            }
                            // Yield the current state
                            yield currentPicks;
                        }
                        finally {
                            cancellationToken.dispose();
                        }
                    }
                    catch (error) {
                        // Gracefully handle errors in async contributions
                        return;
                    }
                })();
                // Return fast picks immediately, add slow picks as async generator
                return {
                    fast: coalesce(fastPicks),
                    slow: slowPicks
                };
            };
            const store = new DisposableStore();
            const picker = store.add(quickInputService.createQuickPick({ useSeparators: true }));
            picker.title = (showAllChats || showAllAgents) ?
                localize('interactiveSession.history.titleAll', "All Workspace Chat History") :
                localize('interactiveSession.history.title', "Workspace Chat History");
            picker.placeholder = localize('interactiveSession.history.pick', "Switch to chat");
            picker.buttons = [clearChatHistoryButton];
            // Get fast and slow picks
            const { fast, slow } = await getPicks(showAllChats, showAllAgents);
            // Set fast picks immediately
            picker.items = fast;
            picker.busy = true;
            // Consume slow picks progressively
            (async () => {
                try {
                    for await (const slowPicks of slow) {
                        if (!store.isDisposed) {
                            picker.items = coalesce([...fast, ...slowPicks]);
                        }
                    }
                }
                catch (error) {
                    // Handle errors gracefully
                }
                finally {
                    if (!store.isDisposed) {
                        picker.busy = false;
                    }
                }
            })();
            store.add(picker.onDidTriggerButton(async (button) => {
                if (button === clearChatHistoryButton) {
                    await commandService.executeCommand(CHAT_CLEAR_HISTORY_ACTION_ID);
                }
            }));
            store.add(picker.onDidTriggerItemButton(async (context) => {
                if (!isChatPickerItem(context.item)) {
                    return;
                }
                if (context.button === openInEditorButton) {
                    const options = { pinned: true };
                    editorService.openEditor({
                        resource: context.item.chat.sessionResource,
                        options,
                    }, ACTIVE_GROUP);
                    picker.hide();
                }
                else if (context.button === deleteButton) {
                    chatService.removeHistoryEntry(context.item.chat.sessionResource);
                    // Refresh picker items after deletion
                    const { fast, slow } = await getPicks(showAllChats, showAllAgents);
                    picker.items = fast;
                    picker.busy = true;
                    // Consume slow picks progressively after deletion
                    (async () => {
                        try {
                            for await (const slowPicks of slow) {
                                if (!store.isDisposed) {
                                    picker.items = coalesce([...fast, ...slowPicks]);
                                }
                            }
                        }
                        catch (error) {
                            // Handle errors gracefully
                        }
                        finally {
                            if (!store.isDisposed) {
                                picker.busy = false;
                            }
                        }
                    })();
                }
                else if (context.button === renameButton) {
                    const title = await quickInputService.input({ title: localize('newChatTitle', "New chat title"), value: context.item.chat.title });
                    if (title) {
                        chatService.setChatSessionTitle(context.item.chat.sessionResource, title);
                    }
                    // The quick input hides the picker, it gets disposed, so we kick it off from scratch
                    await this.showIntegratedPicker(chatService, quickInputService, commandService, editorService, chatWidgetService, view, chatSessionsService, contextKeyService, menuService, showAllChats, showAllAgents);
                }
                else {
                    const buttonItem = context.button;
                    if (buttonItem.id) {
                        const contextItem = context.item;
                        if (contextItem.session) {
                            commandService.executeCommand(buttonItem.id, {
                                session: contextItem.session,
                                $mid: 25 /* MarshalledId.ChatSessionContext */
                            });
                        }
                        // dismiss quick picker
                        picker.hide();
                    }
                }
            }));
            store.add(picker.onDidAccept(async () => {
                try {
                    const item = picker.selectedItems[0];
                    // Handle "Show more..." options
                    if (item === showMorePick) {
                        picker.hide();
                        // Create a new picker with all chat items expanded
                        await this.showIntegratedPicker(chatService, quickInputService, commandService, editorService, chatWidgetService, view, chatSessionsService, contextKeyService, menuService, true, showAllAgents);
                        return;
                    }
                    else if (item === showMoreAgentsPick) {
                        picker.hide();
                        // Create a new picker with all agent items expanded
                        await this.showIntegratedPicker(chatService, quickInputService, commandService, editorService, chatWidgetService, view, chatSessionsService, contextKeyService, menuService, showAllChats, true);
                        return;
                    }
                    else if (isCodingAgentPickerItem(item)) {
                        // TODO: This is a temporary change that will be replaced by opening a new chat instance
                        if (item.session) {
                            await this.showChatSessionInEditor(item.session, editorService);
                        }
                    }
                    else if (isChatPickerItem(item)) {
                        await view.loadSession(item.chat.sessionResource);
                    }
                }
                finally {
                    picker.hide();
                }
            }));
            store.add(picker.onDidHide(() => store.dispose()));
            picker.show();
        }
        async run(accessor) {
            const chatService = accessor.get(IChatService);
            const quickInputService = accessor.get(IQuickInputService);
            const viewsService = accessor.get(IViewsService);
            const editorService = accessor.get(IEditorService);
            const chatWidgetService = accessor.get(IChatWidgetService);
            const dialogService = accessor.get(IDialogService);
            const commandService = accessor.get(ICommandService);
            const chatSessionsService = accessor.get(IChatSessionsService);
            const contextKeyService = accessor.get(IContextKeyService);
            const menuService = accessor.get(IMenuService);
            const view = await viewsService.openView(ChatViewId);
            if (!view?.widget.viewModel) {
                return;
            }
            const editingSession = view.widget.viewModel.model.editingSession;
            if (editingSession) {
                const phrase = localize('switchChat.confirmPhrase', "Switching chats will end your current edit session.");
                if (!await handleCurrentEditingSession(editingSession, phrase, dialogService)) {
                    return;
                }
            }
            // Check if there are any non-local chat session item providers registered
            const allProviders = chatSessionsService.getAllChatSessionItemProviders();
            const hasNonLocalProviders = allProviders.some(provider => provider.chatSessionType !== localChatSessionType);
            if (hasNonLocalProviders) {
                await this.showIntegratedPicker(chatService, quickInputService, commandService, editorService, chatWidgetService, view, chatSessionsService, contextKeyService, menuService);
            }
            else {
                await this.showLegacyPicker(chatService, quickInputService, commandService, editorService, view);
            }
        }
        async showChatSessionInEditor(session, editorService) {
            // Open the chat editor
            await editorService.openEditor({
                resource: session.resource,
                options: {}
            });
        }
    });
    registerAction2(class NewChatEditorAction extends Action2 {
        constructor() {
            super({
                id: ACTION_ID_OPEN_CHAT,
                title: localize2('interactiveSession.open', "New Chat Editor"),
                icon: Codicon.plus,
                f1: true,
                category: CHAT_CATEGORY,
                precondition: ChatContextKeys.enabled,
                keybinding: {
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                    primary: 2048 /* KeyMod.CtrlCmd */ | 44 /* KeyCode.KeyN */,
                    when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.inChatEditor)
                },
                menu: [{
                        id: MenuId.ChatTitleBarMenu,
                        group: 'b_new',
                        order: 0
                    }, {
                        id: MenuId.ChatNewMenu,
                        group: '2_new',
                        order: 2
                    }, {
                        id: MenuId.EditorTitle,
                        group: 'navigation',
                        when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(ChatEditorInput.EditorID), ChatContextKeys.lockedToCodingAgent.negate()),
                        order: 1
                    }],
            });
        }
        async run(accessor) {
            const editorService = accessor.get(IEditorService);
            await editorService.openEditor({ resource: ChatEditorInput.getNewEditorUri(), options: { pinned: true } });
        }
    });
    registerAction2(class NewChatWindowAction extends Action2 {
        constructor() {
            super({
                id: `workbench.action.newChatWindow`,
                title: localize2('interactiveSession.newChatWindow', "New Chat Window"),
                f1: true,
                category: CHAT_CATEGORY,
                precondition: ChatContextKeys.enabled,
                menu: [{
                        id: MenuId.ChatTitleBarMenu,
                        group: 'b_new',
                        order: 1
                    }, {
                        id: MenuId.ChatNewMenu,
                        group: '2_new',
                        order: 3
                    }]
            });
        }
        async run(accessor) {
            const editorService = accessor.get(IEditorService);
            await editorService.openEditor({ resource: ChatEditorInput.getNewEditorUri(), options: { pinned: true, auxiliary: { compact: true, bounds: { width: 640, height: 640 } } } }, AUX_WINDOW_GROUP);
        }
    });
    registerAction2(class OpenChatEditorInNewWindowAction extends Action2 {
        constructor() {
            super({
                id: `workbench.action.chat.newChatInNewWindow`,
                title: localize2('chatSessions.openNewChatInNewWindow', 'Open New Chat in New Window'),
                f1: false,
                category: CHAT_CATEGORY,
                precondition: ChatContextKeys.enabled,
                menu: {
                    id: MenuId.ViewTitle,
                    group: 'submenu',
                    order: 1,
                    when: ContextKeyExpr.equals('view', `${LEGACY_AGENT_SESSIONS_VIEW_ID}.local`),
                }
            });
        }
        async run(accessor) {
            const editorService = accessor.get(IEditorService);
            await editorService.openEditor({
                resource: ChatEditorInput.getNewEditorUri(),
                options: {
                    pinned: true,
                    auxiliary: { compact: true, bounds: { width: 800, height: 640 } }
                }
            }, AUX_WINDOW_GROUP);
        }
    });
    registerAction2(class NewChatInSideBarAction extends Action2 {
        constructor() {
            super({
                id: `workbench.action.chat.newChatInSideBar`,
                title: localize2('chatSessions.newChatInSideBar', 'Open New Chat in Side Bar'),
                f1: false,
                category: CHAT_CATEGORY,
                precondition: ChatContextKeys.enabled,
                menu: {
                    id: MenuId.ViewTitle,
                    group: 'submenu',
                    order: 1,
                    when: ContextKeyExpr.equals('view', `${LEGACY_AGENT_SESSIONS_VIEW_ID}.local`),
                }
            });
        }
        async run(accessor) {
            const widgetService = accessor.get(IChatWidgetService);
            // Open the chat view in the sidebar and get the widget
            const chatWidget = await widgetService.revealWidget();
            if (chatWidget) {
                // Clear the current chat to start a new one
                await chatWidget.clear();
                chatWidget.attachmentModel.clear(true);
                chatWidget.input.relatedFiles?.clear();
                // Focus the input area
                chatWidget.focusInput();
            }
        }
    });
    registerAction2(class OpenChatInNewEditorGroupAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.openNewChatToTheSide',
                title: localize2('chat.openNewChatToTheSide.label', "Open New Chat Editor to the Side"),
                category: CHAT_CATEGORY,
                precondition: ChatContextKeys.enabled,
                f1: false,
                menu: {
                    id: MenuId.ViewTitle,
                    group: 'submenu',
                    order: 1,
                    when: ContextKeyExpr.equals('view', `${LEGACY_AGENT_SESSIONS_VIEW_ID}.local`),
                }
            });
        }
        async run(accessor, ...args) {
            const editorService = accessor.get(IEditorService);
            const editorGroupService = accessor.get(IEditorGroupsService);
            // Create a new editor group to the right
            const newGroup = editorGroupService.addGroup(editorGroupService.activeGroup, 3 /* GroupDirection.RIGHT */);
            editorGroupService.activateGroup(newGroup);
            // Open a new chat editor in the new group
            await editorService.openEditor({ resource: ChatEditorInput.getNewEditorUri(), options: { pinned: true } }, newGroup.id);
        }
    });
    registerAction2(class ClearChatInputHistoryAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.clearInputHistory',
                title: localize2('interactiveSession.clearHistory.label', "Clear Input History"),
                precondition: ChatContextKeys.enabled,
                category: CHAT_CATEGORY,
                f1: true,
            });
        }
        async run(accessor, ...args) {
            const historyService = accessor.get(IChatWidgetHistoryService);
            historyService.clearHistory();
        }
    });
    registerAction2(class ClearChatHistoryAction extends Action2 {
        constructor() {
            super({
                id: CHAT_CLEAR_HISTORY_ACTION_ID,
                title: localize2('chat.clear.label', "Clear All Workspace Chats"),
                precondition: ChatContextKeys.enabled,
                category: CHAT_CATEGORY,
                f1: true,
            });
        }
        async run(accessor, ...args) {
            const editorGroupsService = accessor.get(IEditorGroupsService);
            const chatService = accessor.get(IChatService);
            const instantiationService = accessor.get(IInstantiationService);
            const widgetService = accessor.get(IChatWidgetService);
            await chatService.clearAllHistoryEntries();
            await Promise.all(widgetService.getAllWidgets().map(widget => widget.clear()));
            // Clear all chat editors. Have to go this route because the chat editor may be in the background and
            // not have a ChatEditorInput.
            editorGroupsService.groups.forEach(group => {
                group.editors.forEach(editor => {
                    if (editor instanceof ChatEditorInput) {
                        instantiationService.invokeFunction(clearChatEditor, editor);
                    }
                });
            });
        }
    });
    registerAction2(class FocusChatAction extends EditorAction2 {
        constructor() {
            super({
                id: 'chat.action.focus',
                title: localize2('actions.interactiveSession.focus', 'Focus Chat List'),
                precondition: ContextKeyExpr.and(ChatContextKeys.inChatInput),
                category: CHAT_CATEGORY,
                keybinding: [
                    // On mac, require that the cursor is at the top of the input, to avoid stealing cmd+up to move the cursor to the top
                    {
                        when: ContextKeyExpr.and(ChatContextKeys.inputCursorAtTop, ChatContextKeys.inQuickChat.negate()),
                        primary: 2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */,
                        weight: 100 /* KeybindingWeight.EditorContrib */,
                    },
                    // On win/linux, ctrl+up can always focus the chat list
                    {
                        when: ContextKeyExpr.and(ContextKeyExpr.or(IsWindowsContext, IsLinuxContext), ChatContextKeys.inQuickChat.negate()),
                        primary: 2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */,
                        weight: 100 /* KeybindingWeight.EditorContrib */,
                    },
                    {
                        when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.inQuickChat),
                        primary: 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */,
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                    }
                ]
            });
        }
        runEditorCommand(accessor, editor) {
            const editorUri = editor.getModel()?.uri;
            if (editorUri) {
                const widgetService = accessor.get(IChatWidgetService);
                widgetService.getWidgetByInputUri(editorUri)?.focusResponseItem();
            }
        }
    });
    registerAction2(class FocusMostRecentlyFocusedChatAction extends EditorAction2 {
        constructor() {
            super({
                id: 'workbench.chat.action.focusLastFocused',
                title: localize2('actions.interactiveSession.focusLastFocused', 'Focus Last Focused Chat List Item'),
                precondition: ContextKeyExpr.and(ChatContextKeys.inChatInput),
                category: CHAT_CATEGORY,
                keybinding: [
                    // On mac, require that the cursor is at the top of the input, to avoid stealing cmd+up to move the cursor to the top
                    {
                        when: ContextKeyExpr.and(ChatContextKeys.inputCursorAtTop, ChatContextKeys.inQuickChat.negate()),
                        primary: 2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */ | 1024 /* KeyMod.Shift */,
                        weight: 100 /* KeybindingWeight.EditorContrib */ + 1,
                    },
                    // On win/linux, ctrl+up can always focus the chat list
                    {
                        when: ContextKeyExpr.and(ContextKeyExpr.or(IsWindowsContext, IsLinuxContext), ChatContextKeys.inQuickChat.negate()),
                        primary: 2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */ | 1024 /* KeyMod.Shift */,
                        weight: 100 /* KeybindingWeight.EditorContrib */ + 1,
                    },
                    {
                        when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.inQuickChat),
                        primary: 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */ | 1024 /* KeyMod.Shift */,
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
                    }
                ]
            });
        }
        runEditorCommand(accessor, editor) {
            const editorUri = editor.getModel()?.uri;
            if (editorUri) {
                const widgetService = accessor.get(IChatWidgetService);
                widgetService.getWidgetByInputUri(editorUri)?.focusResponseItem(true);
            }
        }
    });
    registerAction2(class FocusChatInputAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.focusInput',
                title: localize2('interactiveSession.focusInput.label', "Focus Chat Input"),
                f1: false,
                keybinding: [
                    {
                        primary: 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */,
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                        when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.inChatInput.negate(), ChatContextKeys.inQuickChat.negate()),
                    },
                    {
                        when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.inChatInput.negate(), ChatContextKeys.inQuickChat),
                        primary: 2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */,
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                    }
                ]
            });
        }
        run(accessor, ...args) {
            const widgetService = accessor.get(IChatWidgetService);
            widgetService.lastFocusedWidget?.focusInput();
        }
    });
    const nonEnterpriseCopilotUsers = ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.notEquals(`config.${defaultChat.completionsAdvancedSetting}.authProvider`, defaultChat.provider.enterprise.id));
    registerAction2(class extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.manageSettings',
                title: localize2('manageChat', "Manage Chat"),
                category: CHAT_CATEGORY,
                f1: true,
                precondition: ContextKeyExpr.and(ContextKeyExpr.or(ChatContextKeys.Entitlement.planFree, ChatContextKeys.Entitlement.planPro, ChatContextKeys.Entitlement.planProPlus), nonEnterpriseCopilotUsers),
                menu: {
                    id: MenuId.ChatTitleBarMenu,
                    group: 'y_manage',
                    order: 1,
                    when: nonEnterpriseCopilotUsers
                }
            });
        }
        async run(accessor) {
            const openerService = accessor.get(IOpenerService);
            openerService.open(URI.parse(defaultChat.manageSettingsUrl));
        }
    });
    registerAction2(class ShowExtensionsUsingCopilot extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.showExtensionsUsingCopilot',
                title: localize2('showCopilotUsageExtensions', "Show Extensions using Copilot"),
                f1: true,
                category: EXTENSIONS_CATEGORY,
                precondition: ChatContextKeys.enabled
            });
        }
        async run(accessor) {
            const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
            extensionsWorkbenchService.openSearch(`@feature:${CopilotUsageExtensionFeatureId}`);
        }
    });
    registerAction2(class ConfigureCopilotCompletions extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.configureCodeCompletions',
                title: localize2('configureCompletions', "Configure Inline Suggestions..."),
                precondition: ContextKeyExpr.and(ChatContextKeys.Setup.installed, ChatContextKeys.Setup.disabled.negate(), ChatContextKeys.Setup.untrusted.negate()),
                menu: {
                    id: MenuId.ChatTitleBarMenu,
                    group: 'f_completions',
                    order: 10,
                }
            });
        }
        async run(accessor) {
            const commandService = accessor.get(ICommandService);
            commandService.executeCommand(defaultChat.completionsMenuCommand);
        }
    });
    registerAction2(class ShowQuotaExceededDialogAction extends Action2 {
        constructor() {
            super({
                id: OPEN_CHAT_QUOTA_EXCEEDED_DIALOG,
                title: localize('upgradeChat', "Upgrade GitHub Copilot Plan")
            });
        }
        async run(accessor) {
            const chatEntitlementService = accessor.get(IChatEntitlementService);
            const commandService = accessor.get(ICommandService);
            const dialogService = accessor.get(IDialogService);
            const telemetryService = accessor.get(ITelemetryService);
            let message;
            const chatQuotaExceeded = chatEntitlementService.quotas.chat?.percentRemaining === 0;
            const completionsQuotaExceeded = chatEntitlementService.quotas.completions?.percentRemaining === 0;
            if (chatQuotaExceeded && !completionsQuotaExceeded) {
                message = localize('chatQuotaExceeded', "You've reached your monthly chat messages quota. You still have free inline suggestions available.");
            }
            else if (completionsQuotaExceeded && !chatQuotaExceeded) {
                message = localize('completionsQuotaExceeded', "You've reached your monthly inline suggestions quota. You still have free chat messages available.");
            }
            else {
                message = localize('chatAndCompletionsQuotaExceeded', "You've reached your monthly chat messages and inline suggestions quota.");
            }
            if (chatEntitlementService.quotas.resetDate) {
                const dateFormatter = chatEntitlementService.quotas.resetDateHasTime ? safeIntl.DateTimeFormat(language, { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' }) : safeIntl.DateTimeFormat(language, { year: 'numeric', month: 'long', day: 'numeric' });
                const quotaResetDate = new Date(chatEntitlementService.quotas.resetDate);
                message = [message, localize('quotaResetDate', "The allowance will reset on {0}.", dateFormatter.value.format(quotaResetDate))].join(' ');
            }
            const free = chatEntitlementService.entitlement === ChatEntitlement.Free;
            const upgradeToPro = free ? localize('upgradeToPro', "Upgrade to GitHub Copilot Pro (your first 30 days are free) for:\n- Unlimited inline suggestions\n- Unlimited chat messages\n- Access to premium models") : undefined;
            await dialogService.prompt({
                type: 'none',
                message: localize('copilotQuotaReached', "GitHub Copilot Quota Reached"),
                cancelButton: {
                    label: localize('dismiss', "Dismiss"),
                    run: () => { }
                },
                buttons: [
                    {
                        label: free ? localize('upgradePro', "Upgrade to GitHub Copilot Pro") : localize('upgradePlan', "Upgrade GitHub Copilot Plan"),
                        run: () => {
                            const commandId = 'workbench.action.chat.upgradePlan';
                            telemetryService.publicLog2('workbenchActionExecuted', { id: commandId, from: 'chat-dialog' });
                            commandService.executeCommand(commandId);
                        }
                    },
                ],
                custom: {
                    icon: Codicon.copilotWarningLarge,
                    markdownDetails: coalesce([
                        { markdown: new MarkdownString(message, true) },
                        upgradeToPro ? { markdown: new MarkdownString(upgradeToPro, true) } : undefined
                    ])
                }
            });
        }
    });
    registerAction2(class ResetTrustedToolsAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.resetTrustedTools',
                title: localize2('resetTrustedTools', "Reset Tool Confirmations"),
                category: CHAT_CATEGORY,
                f1: true,
                precondition: ChatContextKeys.enabled
            });
        }
        run(accessor) {
            accessor.get(ILanguageModelToolsConfirmationService).resetToolAutoConfirmation();
            accessor.get(INotificationService).info(localize('resetTrustedToolsSuccess', "Tool confirmation preferences have been reset."));
        }
    });
    registerAction2(class UpdateInstructionsAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.generateInstructions',
                title: localize2('generateInstructions', "Generate Workspace Instructions File"),
                shortTitle: localize2('generateInstructions.short', "Generate Chat Instructions"),
                category: CHAT_CATEGORY,
                icon: Codicon.sparkle,
                f1: true,
                precondition: ChatContextKeys.enabled,
                menu: {
                    id: CHAT_CONFIG_MENU_ID,
                    when: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.equals('view', ChatViewId)),
                    order: 11,
                    group: '1_level'
                }
            });
        }
        async run(accessor) {
            const commandService = accessor.get(ICommandService);
            // Use chat command to open and send the query
            const query = `Analyze this codebase to generate or update \`.github/copilot-instructions.md\` for guiding AI coding agents.

Focus on discovering the essential knowledge that would help an AI agents be immediately productive in this codebase. Consider aspects like:
- The "big picture" architecture that requires reading multiple files to understand - major components, service boundaries, data flows, and the "why" behind structural decisions
- Critical developer workflows (builds, tests, debugging) especially commands that aren't obvious from file inspection alone
- Project-specific conventions and patterns that differ from common practices
- Integration points, external dependencies, and cross-component communication patterns

Source existing AI conventions from \`**/{.github/copilot-instructions.md,AGENT.md,AGENTS.md,CLAUDE.md,.cursorrules,.windsurfrules,.clinerules,.cursor/rules/**,.windsurf/rules/**,.clinerules/**,README.md}\` (do one glob search).

Guidelines (read more at https://aka.ms/vscode-instructions-docs):
- If \`.github/copilot-instructions.md\` exists, merge intelligently - preserve valuable content while updating outdated sections
- Write concise, actionable instructions (~20-50 lines) using markdown structure
- Include specific examples from the codebase when describing patterns
- Avoid generic advice ("write tests", "handle errors") - focus on THIS project's specific approaches
- Document only discoverable patterns, not aspirational practices
- Reference key files/directories that exemplify important patterns

Update \`.github/copilot-instructions.md\` for the user, then ask for feedback on any unclear or incomplete sections to iterate.`;
            await commandService.executeCommand('workbench.action.chat.open', {
                mode: 'agent',
                query: query,
            });
        }
    });
    registerAction2(class OpenChatFeatureSettingsAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.openFeatureSettings',
                title: localize2('openChatFeatureSettings', "Chat Settings"),
                shortTitle: localize('openChatFeatureSettings.short', "Chat Settings"),
                category: CHAT_CATEGORY,
                f1: true,
                precondition: ChatContextKeys.enabled,
                menu: [{
                        id: CHAT_CONFIG_MENU_ID,
                        when: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.equals('view', ChatViewId)),
                        order: 15,
                        group: '3_configure'
                    },
                    {
                        id: MenuId.ChatWelcomeContext,
                        group: '2_settings',
                        order: 1
                    }]
            });
        }
        async run(accessor) {
            const preferencesService = accessor.get(IPreferencesService);
            preferencesService.openSettings({ query: '@feature:chat ' });
        }
    });
    MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
        submenu: CHAT_CONFIG_MENU_ID,
        title: localize2('config.label', "Configure Chat"),
        group: 'navigation',
        when: ContextKeyExpr.equals('view', ChatViewId),
        icon: Codicon.gear,
        order: 6
    });
}
export function stringifyItem(item, includeName = true) {
    if (isRequestVM(item)) {
        return (includeName ? `${item.username}: ` : '') + item.messageText;
    }
    else {
        return (includeName ? `${item.username}: ` : '') + item.response.toString();
    }
}
// --- Title Bar Chat Controls
const defaultChat = {
    manageSettingsUrl: product.defaultChatAgent?.manageSettingsUrl ?? '',
    provider: product.defaultChatAgent?.provider ?? { enterprise: { id: '' } },
    completionsAdvancedSetting: product.defaultChatAgent?.completionsAdvancedSetting ?? '',
    completionsMenuCommand: product.defaultChatAgent?.completionsMenuCommand ?? '',
};
// Add next to the command center if command center is disabled
MenuRegistry.appendMenuItem(MenuId.CommandCenter, {
    submenu: MenuId.ChatTitleBarMenu,
    title: localize('title4', "Chat"),
    icon: Codicon.chatSparkle,
    when: ContextKeyExpr.and(ChatContextKeys.supported, ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabled.negate()), ContextKeyExpr.has('config.chat.commandCenter.enabled')),
    order: 10001 // to the right of command center
});
// Add to the global title bar if command center is disabled
MenuRegistry.appendMenuItem(MenuId.TitleBar, {
    submenu: MenuId.ChatTitleBarMenu,
    title: localize('title4', "Chat"),
    group: 'navigation',
    icon: Codicon.chatSparkle,
    when: ContextKeyExpr.and(ChatContextKeys.supported, ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabled.negate()), ContextKeyExpr.has('config.chat.commandCenter.enabled'), ContextKeyExpr.has('config.window.commandCenter').negate()),
    order: 1
});
registerAction2(class ToggleCopilotControl extends ToggleTitleBarConfigAction {
    constructor() {
        super('chat.commandCenter.enabled', localize('toggle.chatControl', 'Chat Controls'), localize('toggle.chatControlsDescription', "Toggle visibility of the Chat Controls in title bar"), 5, ContextKeyExpr.and(ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabled.negate()), IsCompactTitleBarContext.negate(), ChatContextKeys.supported));
    }
});
let CopilotTitleBarMenuRendering = class CopilotTitleBarMenuRendering extends Disposable {
    static { this.ID = 'workbench.contrib.copilotTitleBarMenuRendering'; }
    constructor(actionViewItemService, chatEntitlementService) {
        super();
        const disposable = actionViewItemService.register(MenuId.CommandCenter, MenuId.ChatTitleBarMenu, (action, options, instantiationService, windowId) => {
            if (!(action instanceof SubmenuItemAction)) {
                return undefined;
            }
            const dropdownAction = toAction({
                id: 'copilot.titleBarMenuRendering.more',
                label: localize('more', "More..."),
                run() { }
            });
            const chatSentiment = chatEntitlementService.sentiment;
            const chatQuotaExceeded = chatEntitlementService.quotas.chat?.percentRemaining === 0;
            const signedOut = chatEntitlementService.entitlement === ChatEntitlement.Unknown;
            const anonymous = chatEntitlementService.anonymous;
            const free = chatEntitlementService.entitlement === ChatEntitlement.Free;
            const isAuxiliaryWindow = windowId !== mainWindow.vscodeWindowId;
            let primaryActionId = isAuxiliaryWindow ? CHAT_OPEN_ACTION_ID : TOGGLE_CHAT_ACTION_ID;
            let primaryActionTitle = isAuxiliaryWindow ? localize('openChat', "Open Chat") : localize('toggleChat', "Toggle Chat");
            let primaryActionIcon = Codicon.chatSparkle;
            if (chatSentiment.installed && !chatSentiment.disabled) {
                if (signedOut && !anonymous) {
                    primaryActionId = CHAT_SETUP_ACTION_ID;
                    primaryActionTitle = localize('signInToChatSetup', "Sign in to use AI features...");
                    primaryActionIcon = Codicon.chatSparkleError;
                }
                else if (chatQuotaExceeded && free) {
                    primaryActionId = OPEN_CHAT_QUOTA_EXCEEDED_DIALOG;
                    primaryActionTitle = localize('chatQuotaExceededButton', "GitHub Copilot Free plan chat messages quota reached. Click for details.");
                    primaryActionIcon = Codicon.chatSparkleWarning;
                }
            }
            return instantiationService.createInstance(DropdownWithPrimaryActionViewItem, instantiationService.createInstance(MenuItemAction, {
                id: primaryActionId,
                title: primaryActionTitle,
                icon: primaryActionIcon,
            }, undefined, undefined, undefined, undefined), dropdownAction, action.actions, '', { ...options, skipTelemetry: true });
        }, Event.any(chatEntitlementService.onDidChangeSentiment, chatEntitlementService.onDidChangeQuotaExceeded, chatEntitlementService.onDidChangeEntitlement, chatEntitlementService.onDidChangeAnonymous));
        // Reduces flicker a bit on reload/restart
        markAsSingleton(disposable);
    }
};
CopilotTitleBarMenuRendering = __decorate([
    __param(0, IActionViewItemService),
    __param(1, IChatEntitlementService)
], CopilotTitleBarMenuRendering);
export { CopilotTitleBarMenuRendering };
/**
 * Returns whether we can continue clearing/switching chat sessions, false to cancel.
 */
export async function handleCurrentEditingSession(currentEditingSession, phrase, dialogService) {
    if (shouldShowClearEditingSessionConfirmation(currentEditingSession)) {
        return showClearEditingSessionConfirmation(currentEditingSession, dialogService, { messageOverride: phrase });
    }
    return true;
}
/**
 * Returns whether we can switch the agent, based on whether the user had to agree to clear the session, false to cancel.
 */
export async function handleModeSwitch(accessor, fromMode, toMode, requestCount, editingSession) {
    if (!editingSession || fromMode === toMode) {
        return { needToClearSession: false };
    }
    const configurationService = accessor.get(IConfigurationService);
    const dialogService = accessor.get(IDialogService);
    const needToClearEdits = (!configurationService.getValue(ChatConfiguration.Edits2Enabled) && (fromMode === ChatModeKind.Edit || toMode === ChatModeKind.Edit)) && requestCount > 0;
    if (needToClearEdits) {
        // If not using edits2 and switching into or out of edit mode, ask to discard the session
        const phrase = localize('switchMode.confirmPhrase', "Switching agents will end your current edit session.");
        const currentEdits = editingSession.entries.get();
        const undecidedEdits = currentEdits.filter((edit) => edit.state.get() === 0 /* ModifiedFileEntryState.Modified */);
        if (undecidedEdits.length > 0) {
            if (!await handleCurrentEditingSession(editingSession, phrase, dialogService)) {
                return false;
            }
            return { needToClearSession: true };
        }
        else {
            const confirmation = await dialogService.confirm({
                title: localize('agent.newSession', "Start new session?"),
                message: localize('agent.newSessionMessage', "Changing the agent will end your current edit session. Would you like to change the agent?"),
                primaryButton: localize('agent.newSession.confirm', "Yes"),
                type: 'info'
            });
            if (!confirmation.confirmed) {
                return false;
            }
            return { needToClearSession: true };
        }
    }
    return { needToClearSession: false };
}
// --- Chat Submenus in various Components
MenuRegistry.appendMenuItem(MenuId.EditorContext, {
    submenu: MenuId.ChatTextEditorMenu,
    group: '1_chat',
    order: 5,
    title: localize('generateCode', "Generate Code"),
    when: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabled.negate())
});
// --- Chat Default Visibility
registerAction2(class ToggleDefaultVisibilityAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.chat.toggleDefaultVisibility',
            title: localize2('chat.toggleDefaultVisibility.label', "Show View by Default"),
            toggled: ContextKeyExpr.equals('config.workbench.secondarySideBar.defaultVisibility', 'hidden').negate(),
            f1: false,
            menu: {
                id: MenuId.ViewTitle,
                when: ContextKeyExpr.and(ContextKeyExpr.equals('view', ChatViewId), ChatContextKeys.panelLocation.isEqualTo(2 /* ViewContainerLocation.AuxiliaryBar */)),
                order: 0,
                group: '5_configure'
            },
        });
    }
    async run(accessor) {
        const configurationService = accessor.get(IConfigurationService);
        const currentValue = configurationService.getValue('workbench.secondarySideBar.defaultVisibility');
        configurationService.updateValue('workbench.secondarySideBar.defaultVisibility', currentValue !== 'hidden' ? 'hidden' : 'visible');
    }
});
registerAction2(class EditToolApproval extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.chat.editToolApproval',
            title: localize2('chat.editToolApproval.label', "Manage Tool Approval"),
            metadata: {
                description: localize2('chat.editToolApproval.description', "Edit/manage the tool approval and confirmation preferences for AI chat agents."),
            },
            precondition: ChatContextKeys.enabled,
            f1: true,
            category: CHAT_CATEGORY,
        });
    }
    async run(accessor, scope) {
        const confirmationService = accessor.get(ILanguageModelToolsConfirmationService);
        const toolsService = accessor.get(ILanguageModelToolsService);
        confirmationService.manageConfirmationPreferences([...toolsService.getTools()], scope ? { defaultScope: scope } : undefined);
    }
});
// Register actions for chat welcome history context menu
registerAction2(class ToggleChatHistoryVisibilityAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.chat.toggleChatHistoryVisibility',
            title: localize2('chat.toggleChatHistoryVisibility.label', "Chat History"),
            category: CHAT_CATEGORY,
            precondition: ChatContextKeys.enabled,
            toggled: ContextKeyExpr.equals('config.chat.emptyState.history.enabled', true),
            menu: {
                id: MenuId.ChatWelcomeContext,
                group: '1_modify',
                order: 1
            }
        });
    }
    async run(accessor) {
        const configurationService = accessor.get(IConfigurationService);
        const current = configurationService.getValue('chat.emptyState.history.enabled');
        await configurationService.updateValue('chat.emptyState.history.enabled', !current);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEFjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2FjdGlvbnMvY2hhdEFjdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDL0UsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxRQUFRLEVBQXVFLE1BQU0sdUNBQXVDLENBQUM7QUFDdEksT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNyRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLFlBQVksRUFBRSxRQUFRLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM1RSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDNUQsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBRTNFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRXZHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDN0QsT0FB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