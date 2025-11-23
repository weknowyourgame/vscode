/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { KeybindingsRegistry } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ChatViewId, IChatWidgetService } from '../../../chat/browser/chat.js';
import { ChatContextKeys } from '../../../chat/common/chatContextKeys.js';
import { IChatService } from '../../../chat/common/chatService.js';
import { LocalChatSessionUri } from '../../../chat/common/chatUri.js';
import { ChatAgentLocation, ChatConfiguration } from '../../../chat/common/constants.js';
import { AbstractInline1ChatAction } from '../../../inlineChat/browser/inlineChatActions.js';
import { isDetachedTerminalInstance, ITerminalChatService, ITerminalEditorService, ITerminalGroupService, ITerminalService } from '../../../terminal/browser/terminal.js';
import { registerActiveXtermAction } from '../../../terminal/browser/terminalActions.js';
import { TerminalContextKeys } from '../../../terminal/common/terminalContextKey.js';
import { MENU_TERMINAL_CHAT_WIDGET_STATUS, TerminalChatContextKeys } from './terminalChat.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { getIconId } from '../../../terminal/browser/terminalIcon.js';
import { TerminalChatController } from './terminalChatController.js';
import { isString } from '../../../../../base/common/types.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IPreferencesService } from '../../../../services/preferences/common/preferences.js';
registerActiveXtermAction({
    id: "workbench.action.terminal.chat.start" /* TerminalChatCommandId.Start */,
    title: localize2('startChat', 'Open Inline Chat'),
    category: localize2('terminalCategory', "Terminal"),
    keybinding: {
        primary: 2048 /* KeyMod.CtrlCmd */ | 39 /* KeyCode.KeyI */,
        when: ContextKeyExpr.and(TerminalContextKeys.focusInAny),
        // HACK: Force weight to be higher than the extension contributed keybinding to override it until it gets replaced
        weight: 400 /* KeybindingWeight.ExternalExtension */ + 1, // KeybindingWeight.WorkbenchContrib,
    },
    f1: true,
    precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalChatContextKeys.hasChatAgent),
    menu: {
        id: MenuId.TerminalInstanceContext,
        group: "0_chat" /* TerminalContextMenuGroup.Chat */,
        order: 2,
        when: ChatContextKeys.enabled
    },
    run: (_xterm, _accessor, activeInstance, opts) => {
        if (isDetachedTerminalInstance(activeInstance)) {
            return;
        }
        const contr = TerminalChatController.activeChatController || TerminalChatController.get(activeInstance);
        if (!contr) {
            return;
        }
        if (opts) {
            function isValidOptionsObject(obj) {
                return typeof obj === 'object' && obj !== null && 'query' in obj && isString(obj.query);
            }
            opts = isString(opts) ? { query: opts } : opts;
            if (isValidOptionsObject(opts)) {
                contr.updateInput(opts.query, false);
                if (!opts.isPartialQuery) {
                    contr.terminalChatWidget?.acceptInput();
                }
            }
        }
        contr.terminalChatWidget?.reveal();
    }
});
registerActiveXtermAction({
    id: "workbench.action.terminal.chat.close" /* TerminalChatCommandId.Close */,
    title: localize2('closeChat', 'Close'),
    category: AbstractInline1ChatAction.category,
    keybinding: {
        primary: 9 /* KeyCode.Escape */,
        when: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.focus, TerminalChatContextKeys.focused), TerminalChatContextKeys.visible),
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    },
    menu: [{
            id: MENU_TERMINAL_CHAT_WIDGET_STATUS,
            group: '0_main',
            order: 2,
        }],
    icon: Codicon.close,
    f1: true,
    precondition: ContextKeyExpr.and(ChatContextKeys.enabled, TerminalChatContextKeys.visible),
    run: (_xterm, _accessor, activeInstance) => {
        if (isDetachedTerminalInstance(activeInstance)) {
            return;
        }
        const contr = TerminalChatController.activeChatController || TerminalChatController.get(activeInstance);
        contr?.terminalChatWidget?.clear();
    }
});
registerActiveXtermAction({
    id: "workbench.action.terminal.chat.runCommand" /* TerminalChatCommandId.RunCommand */,
    title: localize2('runCommand', 'Run Chat Command'),
    shortTitle: localize2('run', 'Run'),
    category: AbstractInline1ChatAction.category,
    precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalChatContextKeys.requestActive.negate(), TerminalChatContextKeys.responseContainsCodeBlock, TerminalChatContextKeys.responseContainsMultipleCodeBlocks.negate()),
    icon: Codicon.play,
    keybinding: {
        when: TerminalChatContextKeys.requestActive.negate(),
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */,
    },
    menu: {
        id: MENU_TERMINAL_CHAT_WIDGET_STATUS,
        group: '0_main',
        order: 0,
        when: ContextKeyExpr.and(TerminalChatContextKeys.responseContainsCodeBlock, TerminalChatContextKeys.responseContainsMultipleCodeBlocks.negate(), TerminalChatContextKeys.requestActive.negate())
    },
    run: (_xterm, _accessor, activeInstance) => {
        if (isDetachedTerminalInstance(activeInstance)) {
            return;
        }
        const contr = TerminalChatController.activeChatController || TerminalChatController.get(activeInstance);
        contr?.terminalChatWidget?.acceptCommand(true);
    }
});
registerActiveXtermAction({
    id: "workbench.action.terminal.chat.runFirstCommand" /* TerminalChatCommandId.RunFirstCommand */,
    title: localize2('runFirstCommand', 'Run First Chat Command'),
    shortTitle: localize2('runFirst', 'Run First'),
    category: AbstractInline1ChatAction.category,
    precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalChatContextKeys.requestActive.negate(), TerminalChatContextKeys.responseContainsMultipleCodeBlocks),
    icon: Codicon.play,
    keybinding: {
        when: TerminalChatContextKeys.requestActive.negate(),
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */,
    },
    menu: {
        id: MENU_TERMINAL_CHAT_WIDGET_STATUS,
        group: '0_main',
        order: 0,
        when: ContextKeyExpr.and(TerminalChatContextKeys.responseContainsMultipleCodeBlocks, TerminalChatContextKeys.requestActive.negate())
    },
    run: (_xterm, _accessor, activeInstance) => {
        if (isDetachedTerminalInstance(activeInstance)) {
            return;
        }
        const contr = TerminalChatController.activeChatController || TerminalChatController.get(activeInstance);
        contr?.terminalChatWidget?.acceptCommand(true);
    }
});
registerActiveXtermAction({
    id: "workbench.action.terminal.chat.insertCommand" /* TerminalChatCommandId.InsertCommand */,
    title: localize2('insertCommand', 'Insert Chat Command'),
    shortTitle: localize2('insert', 'Insert'),
    category: AbstractInline1ChatAction.category,
    icon: Codicon.insert,
    precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalChatContextKeys.requestActive.negate(), TerminalChatContextKeys.responseContainsCodeBlock, TerminalChatContextKeys.responseContainsMultipleCodeBlocks.negate()),
    keybinding: {
        when: TerminalChatContextKeys.requestActive.negate(),
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        primary: 512 /* KeyMod.Alt */ | 3 /* KeyCode.Enter */,
        secondary: [2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */ | 512 /* KeyMod.Alt */]
    },
    menu: {
        id: MENU_TERMINAL_CHAT_WIDGET_STATUS,
        group: '0_main',
        order: 1,
        when: ContextKeyExpr.and(TerminalChatContextKeys.responseContainsCodeBlock, TerminalChatContextKeys.responseContainsMultipleCodeBlocks.negate(), TerminalChatContextKeys.requestActive.negate())
    },
    run: (_xterm, _accessor, activeInstance) => {
        if (isDetachedTerminalInstance(activeInstance)) {
            return;
        }
        const contr = TerminalChatController.activeChatController || TerminalChatController.get(activeInstance);
        contr?.terminalChatWidget?.acceptCommand(false);
    }
});
registerActiveXtermAction({
    id: "workbench.action.terminal.chat.insertFirstCommand" /* TerminalChatCommandId.InsertFirstCommand */,
    title: localize2('insertFirstCommand', 'Insert First Chat Command'),
    shortTitle: localize2('insertFirst', 'Insert First'),
    category: AbstractInline1ChatAction.category,
    precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalChatContextKeys.requestActive.negate(), TerminalChatContextKeys.responseContainsMultipleCodeBlocks),
    keybinding: {
        when: TerminalChatContextKeys.requestActive.negate(),
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        primary: 512 /* KeyMod.Alt */ | 3 /* KeyCode.Enter */,
        secondary: [2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */ | 512 /* KeyMod.Alt */]
    },
    menu: {
        id: MENU_TERMINAL_CHAT_WIDGET_STATUS,
        group: '0_main',
        order: 1,
        when: ContextKeyExpr.and(TerminalChatContextKeys.responseContainsMultipleCodeBlocks, TerminalChatContextKeys.requestActive.negate())
    },
    run: (_xterm, _accessor, activeInstance) => {
        if (isDetachedTerminalInstance(activeInstance)) {
            return;
        }
        const contr = TerminalChatController.activeChatController || TerminalChatController.get(activeInstance);
        contr?.terminalChatWidget?.acceptCommand(false);
    }
});
registerActiveXtermAction({
    id: "workbench.action.terminal.chat.rerunRequest" /* TerminalChatCommandId.RerunRequest */,
    title: localize2('chat.rerun.label', "Rerun Request"),
    f1: false,
    icon: Codicon.refresh,
    category: AbstractInline1ChatAction.category,
    precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalChatContextKeys.requestActive.negate()),
    keybinding: {
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        primary: 2048 /* KeyMod.CtrlCmd */ | 48 /* KeyCode.KeyR */,
        when: TerminalChatContextKeys.focused
    },
    menu: {
        id: MENU_TERMINAL_CHAT_WIDGET_STATUS,
        group: '0_main',
        order: 5,
        when: ContextKeyExpr.and(TerminalChatContextKeys.inputHasText.toNegated(), TerminalChatContextKeys.requestActive.negate())
    },
    run: async (_xterm, _accessor, activeInstance) => {
        const chatService = _accessor.get(IChatService);
        const chatWidgetService = _accessor.get(IChatWidgetService);
        const contr = TerminalChatController.activeChatController;
        const model = contr?.terminalChatWidget?.inlineChatWidget.chatWidget.viewModel?.model;
        if (!model) {
            return;
        }
        const lastRequest = model.getRequests().at(-1);
        if (lastRequest) {
            const widget = chatWidgetService.getWidgetBySessionResource(model.sessionResource);
            await chatService.resendRequest(lastRequest, {
                noCommandDetection: false,
                attempt: lastRequest.attempt + 1,
                location: ChatAgentLocation.Terminal,
                userSelectedModelId: widget?.input.currentLanguageModel
            });
        }
    }
});
registerActiveXtermAction({
    id: "workbench.action.terminal.chat.viewInChat" /* TerminalChatCommandId.ViewInChat */,
    title: localize2('viewInChat', 'View in Chat'),
    category: AbstractInline1ChatAction.category,
    precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalChatContextKeys.requestActive.negate()),
    icon: Codicon.chatSparkle,
    menu: [{
            id: MENU_TERMINAL_CHAT_WIDGET_STATUS,
            group: 'zzz',
            order: 1,
            isHiddenByDefault: true,
            when: ContextKeyExpr.and(TerminalChatContextKeys.responseContainsCodeBlock, TerminalChatContextKeys.requestActive.negate()),
        }],
    run: (_xterm, _accessor, activeInstance) => {
        if (isDetachedTerminalInstance(activeInstance)) {
            return;
        }
        const contr = TerminalChatController.activeChatController || TerminalChatController.get(activeInstance);
        contr?.viewInChat();
    }
});
registerAction2(class ShowChatTerminalsAction extends Action2 {
    constructor() {
        super({
            id: "workbench.action.terminal.chat.viewHiddenChatTerminals" /* TerminalChatCommandId.ViewHiddenChatTerminals */,
            title: localize2('viewHiddenChatTerminals', 'View Hidden Chat Terminals'),
            category: localize2('terminalCategory2', 'Terminal'),
            f1: true,
            precondition: ContextKeyExpr.and(TerminalChatContextKeys.hasHiddenChatTerminals, ChatContextKeys.enabled),
            menu: [{
                    id: MenuId.ViewTitle,
                    when: ContextKeyExpr.and(TerminalChatContextKeys.hasHiddenChatTerminals, ContextKeyExpr.equals('view', ChatViewId)),
                    group: 'terminal',
                    order: 0,
                    isHiddenByDefault: true
                }]
        });
    }
    run(accessor) {
        const terminalService = accessor.get(ITerminalService);
        const groupService = accessor.get(ITerminalGroupService);
        const editorService = accessor.get(ITerminalEditorService);
        const terminalChatService = accessor.get(ITerminalChatService);
        const quickInputService = accessor.get(IQuickInputService);
        const instantiationService = accessor.get(IInstantiationService);
        const chatService = accessor.get(IChatService);
        const visible = new Set([...groupService.instances, ...editorService.instances]);
        const toolInstances = terminalChatService.getToolSessionTerminalInstances();
        if (toolInstances.length === 0) {
            return;
        }
        const all = new Map();
        for (const i of toolInstances) {
            if (!visible.has(i)) {
                all.set(i.instanceId, i);
            }
        }
        const items = [];
        const lastCommandLocalized = (command) => localize2('chatTerminal.lastCommand', 'Last: {0}', command).value;
        const metas = [];
        for (const instance of all.values()) {
            const iconId = instantiationService.invokeFunction(getIconId, instance);
            const label = `$(${iconId}) ${instance.title}`;
            const lastCommand = instance.capabilities.get(2 /* TerminalCapability.CommandDetection */)?.commands.at(-1)?.command;
            // Get the chat session title
            const chatSessionId = terminalChatService.getChatSessionIdForInstance(instance);
            let chatSessionTitle;
            if (chatSessionId) {
                const sessionUri = LocalChatSessionUri.forSession(chatSessionId);
                // Try to get title from active session first, then fall back to persisted title
                chatSessionTitle = chatService.getSession(sessionUri)?.title || chatService.getPersistedSessionTitle(sessionUri);
            }
            let description;
            if (chatSessionTitle) {
                description = `${chatSessionTitle}`;
            }
            metas.push({
                label,
                description,
                detail: lastCommand ? lastCommandLocalized(lastCommand) : undefined,
                id: String(instance.instanceId),
            });
        }
        for (const m of metas) {
            items.push({
                label: m.label,
                description: m.description,
                detail: m.detail,
                id: m.id
            });
        }
        const qp = quickInputService.createQuickPick();
        qp.placeholder = localize2('selectChatTerminal', 'Select a chat terminal to show and focus').value;
        qp.items = items;
        qp.canSelectMany = false;
        qp.title = localize2('showChatTerminals.title', 'Chat Terminals').value;
        qp.matchOnDescription = true;
        qp.matchOnDetail = true;
        qp.onDidAccept(async () => {
            const sel = qp.selectedItems[0];
            if (sel) {
                const instance = all.get(Number(sel.id));
                if (instance) {
                    terminalService.setActiveInstance(instance);
                    await terminalService.revealTerminal(instance);
                    qp.hide();
                    terminalService.focusInstance(instance);
                }
                else {
                    qp.hide();
                }
            }
            else {
                qp.hide();
            }
        });
        qp.onDidHide(() => qp.dispose());
        qp.show();
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: "workbench.action.terminal.chat.focusMostRecentChatTerminal" /* TerminalChatCommandId.FocusMostRecentChatTerminal */,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    when: ChatContextKeys.inChatSession,
    primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 512 /* KeyMod.Alt */ | 50 /* KeyCode.KeyT */,
    handler: async (accessor) => {
        const terminalChatService = accessor.get(ITerminalChatService);
        const part = terminalChatService.getMostRecentProgressPart();
        if (!part) {
            return;
        }
        await part.focusTerminal();
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: "workbench.action.terminal.chat.focusMostRecentChatTerminalOutput" /* TerminalChatCommandId.FocusMostRecentChatTerminalOutput */,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    when: ChatContextKeys.inChatSession,
    primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 512 /* KeyMod.Alt */ | 45 /* KeyCode.KeyO */,
    handler: async (accessor) => {
        const terminalChatService = accessor.get(ITerminalChatService);
        const part = terminalChatService.getMostRecentProgressPart();
        if (!part) {
            return;
        }
        await part.toggleOutputFromKeyboard();
    }
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
    command: {
        id: "workbench.action.terminal.chat.focusMostRecentChatTerminal" /* TerminalChatCommandId.FocusMostRecentChatTerminal */,
        title: localize('chat.focusMostRecentTerminal', 'Chat: Focus Most Recent Terminal'),
    },
    when: ChatContextKeys.inChatSession
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
    command: {
        id: "workbench.action.terminal.chat.focusMostRecentChatTerminalOutput" /* TerminalChatCommandId.FocusMostRecentChatTerminalOutput */,
        title: localize('chat.focusMostRecentTerminalOutput', 'Chat: Focus Most Recent Terminal Output'),
    },
    when: ChatContextKeys.inChatSession
});
CommandsRegistry.registerCommand("workbench.action.terminal.chat.openTerminalSettingsLink" /* TerminalChatCommandId.OpenTerminalSettingsLink */, async (accessor, scopeRaw) => {
    const preferencesService = accessor.get(IPreferencesService);
    if (scopeRaw === 'global') {
        preferencesService.openSettings({
            query: `@id:${ChatConfiguration.GlobalAutoApprove}`
        });
    }
    else {
        const scope = parseInt(scopeRaw);
        const target = !isNaN(scope) ? scope : undefined;
        const options = {
            jsonEditor: true,
            revealSetting: {
                key: "chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */,
            }
        };
        switch (target) {
            case 1 /* ConfigurationTarget.APPLICATION */:
                preferencesService.openApplicationSettings(options);
                break;
            case 2 /* ConfigurationTarget.USER */:
            case 3 /* ConfigurationTarget.USER_LOCAL */:
                preferencesService.openUserSettings(options);
                break;
            case 4 /* ConfigurationTarget.USER_REMOTE */:
                preferencesService.openRemoteSettings(options);
                break;
            case 5 /* ConfigurationTarget.WORKSPACE */:
            case 6 /* ConfigurationTarget.WORKSPACE_FOLDER */:
                preferencesService.openWorkspaceSettings(options);
                break;
            default: {
                // Fallback if something goes wrong
                preferencesService.openSettings({
                    target: 2 /* ConfigurationTarget.USER */,
                    query: `@id:${"chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */}`,
                });
                break;
            }
        }
    }
});
CommandsRegistry.registerCommand("workbench.action.terminal.chat.disableSessionAutoApproval" /* TerminalChatCommandId.DisableSessionAutoApproval */, async (accessor, chatSessionId) => {
    const terminalChatService = accessor.get(ITerminalChatService);
    terminalChatService.setChatSessionAutoApproval(chatSessionId, false);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDaGF0QWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvY2hhdC9icm93c2VyL3Rlcm1pbmFsQ2hhdEFjdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRWpFLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ25ILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsbUJBQW1CLEVBQW9CLE1BQU0sa0VBQWtFLENBQUM7QUFDekgsT0FBTyxFQUFFLFVBQVUsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQy9FLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDbkUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdEUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDekYsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDN0YsT0FBTyxFQUFFLDBCQUEwQixFQUFFLG9CQUFvQixFQUFFLHNCQUFzQixFQUFFLHFCQUFxQixFQUFxQixnQkFBZ0IsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQzdMLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLDhDQUE4QyxDQUFD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