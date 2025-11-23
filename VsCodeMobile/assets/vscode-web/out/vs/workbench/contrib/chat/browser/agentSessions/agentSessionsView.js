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
import './media/agentsessionsview.css';
import { Codicon } from '../../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../../nls.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../../platform/theme/common/iconRegistry.js';
import { ViewPane } from '../../../../browser/parts/views/viewPane.js';
import { ViewPaneContainer } from '../../../../browser/parts/views/viewPaneContainer.js';
import { Extensions as ViewExtensions, IViewDescriptorService } from '../../../../common/views.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { ChatConfiguration } from '../../common/constants.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { WorkbenchCompressibleAsyncDataTree } from '../../../../../platform/list/browser/listService.js';
import { $, append } from '../../../../../base/browser/dom.js';
import { AgentSessionsViewModel, isLocalAgentSessionItem } from './agentSessionViewModel.js';
import { AgentSessionRenderer, AgentSessionsAccessibilityProvider, AgentSessionsCompressionDelegate, AgentSessionsDataSource, AgentSessionsDragAndDrop, AgentSessionsIdentityProvider, AgentSessionsKeyboardNavigationLabelProvider, AgentSessionsListDelegate, AgentSessionsSorter } from './agentSessionsViewer.js';
import { defaultButtonStyles } from '../../../../../platform/theme/browser/defaultStyles.js';
import { ButtonWithDropdown } from '../../../../../base/browser/ui/button/button.js';
import { Separator, toAction } from '../../../../../base/common/actions.js';
import { IMenuService, MenuId } from '../../../../../platform/actions/common/actions.js';
import { IChatSessionsService } from '../../common/chatSessionsService.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { getSessionItemContextOverlay, NEW_CHAT_SESSION_ACTION_ID } from '../chatSessions/common.js';
import { ACTION_ID_OPEN_CHAT } from '../actions/chatActions.js';
import { IProgressService } from '../../../../../platform/progress/common/progress.js';
import { assertReturnsDefined } from '../../../../../base/common/types.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { Event } from '../../../../../base/common/event.js';
import { MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { getActionBarActions, getFlatActionBarActions } from '../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IChatService } from '../../common/chatService.js';
import { IChatWidgetService } from '../chat.js';
import { AGENT_SESSIONS_VIEW_ID, AGENT_SESSIONS_VIEW_CONTAINER_ID, AgentSessionProviders } from './agentSessions.js';
import { TreeFindMode } from '../../../../../base/browser/ui/tree/abstractTree.js';
import { SIDE_GROUP } from '../../../../services/editor/common/editorService.js';
import { distinct } from '../../../../../base/common/arrays.js';
let AgentSessionsView = class AgentSessionsView extends ViewPane {
    constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, chatSessionsService, commandService, progressService, editorGroupsService, chatService, menuService, chatWidgetService) {
        super({ ...options, titleMenuId: MenuId.AgentSessionsTitle }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this.chatSessionsService = chatSessionsService;
        this.commandService = commandService;
        this.progressService = progressService;
        this.editorGroupsService = editorGroupsService;
        this.chatService = chatService;
        this.menuService = menuService;
        this.chatWidgetService = chatWidgetService;
    }
    renderBody(container) {
        super.renderBody(container);
        container.classList.add('agent-sessions-view');
        // New Session
        if (!this.configurationService.getValue('chat.hideNewButtonInAgentSessionsView')) {
            this.createNewSessionButton(container);
        }
        // Sessions List
        this.createList(container);
        this.registerListeners();
    }
    registerListeners() {
        // Sessions List
        const list = assertReturnsDefined(this.list);
        this._register(this.onDidChangeBodyVisibility(visible => {
            if (!visible || this.sessionsViewModel) {
                return;
            }
            if (!this.sessionsViewModel) {
                this.createViewModel();
            }
            else {
                this.list?.updateChildren();
            }
        }));
        this._register(list.onDidOpen(e => {
            this.openAgentSession(e);
        }));
        this._register(list.onMouseDblClick(({ element }) => {
            if (element === null) {
                this.commandService.executeCommand(ACTION_ID_OPEN_CHAT);
            }
        }));
        this._register(list.onContextMenu((e) => {
            this.showContextMenu(e);
        }));
    }
    async openAgentSession(e) {
        const session = e.element;
        if (!session) {
            return;
        }
        let sessionOptions;
        if (isLocalAgentSessionItem(session)) {
            sessionOptions = {};
        }
        else {
            sessionOptions = { title: { preferred: session.label } };
        }
        sessionOptions.ignoreInView = true;
        const options = {
            preserveFocus: false,
            ...sessionOptions,
            ...e.editorOptions,
        };
        await this.chatSessionsService.activateChatSessionItemProvider(session.providerType); // ensure provider is activated before trying to open
        const group = e.sideBySide ? SIDE_GROUP : undefined;
        await this.chatWidgetService.openSession(session.resource, group, options);
    }
    async showContextMenu({ element: session, anchor }) {
        if (!session) {
            return;
        }
        const provider = await this.chatSessionsService.activateChatSessionItemProvider(session.providerType);
        const contextOverlay = getSessionItemContextOverlay(session, provider, this.chatWidgetService, this.chatService, this.editorGroupsService);
        contextOverlay.push([ChatContextKeys.isCombinedSessionViewer.key, true]);
        const menu = this.menuService.createMenu(MenuId.ChatSessionsMenu, this.contextKeyService.createOverlay(contextOverlay));
        const marshalledSession = { session, $mid: 25 /* MarshalledId.ChatSessionContext */ };
        this.contextMenuService.showContextMenu({
            getActions: () => distinct(getFlatActionBarActions(menu.getActions({ arg: marshalledSession, shouldForwardArgs: true })), action => action.id),
            getAnchor: () => anchor,
            getActionsContext: () => marshalledSession,
        });
        menu.dispose();
    }
    createNewSessionButton(container) {
        this.newSessionContainer = append(container, $('.agent-sessions-new-session-container'));
        const newSessionButton = this._register(new ButtonWithDropdown(this.newSessionContainer, {
            title: localize('agentSessions.newSession', "New Session"),
            ariaLabel: localize('agentSessions.newSessionAriaLabel', "New Session"),
            contextMenuProvider: this.contextMenuService,
            actions: {
                getActions: () => {
                    return this.getNewSessionActions();
                }
            },
            addPrimaryActionToDropdown: false,
            ...defaultButtonStyles,
        }));
        newSessionButton.label = localize('agentSessions.newSession', "New Session");
        this._register(newSessionButton.onDidClick(() => this.commandService.executeCommand(ACTION_ID_OPEN_CHAT)));
    }
    getNewSessionActions() {
        const actions = [];
        // Default action
        actions.push(toAction({
            id: 'newChatSession.default',
            label: localize('newChatSessionDefault', "New Local Session"),
            run: () => this.commandService.executeCommand(ACTION_ID_OPEN_CHAT)
        }));
        // Background (CLI)
        actions.push(toAction({
            id: 'newChatSessionFromProvider.background',
            label: localize('newBackgroundSession', "New Background Session"),
            run: () => this.commandService.executeCommand(`${NEW_CHAT_SESSION_ACTION_ID}.${AgentSessionProviders.Background}`)
        }));
        // Cloud
        actions.push(toAction({
            id: 'newChatSessionFromProvider.cloud',
            label: localize('newCloudSession', "New Cloud Session"),
            run: () => this.commandService.executeCommand(`${NEW_CHAT_SESSION_ACTION_ID}.${AgentSessionProviders.Cloud}`)
        }));
        let addedSeparator = false;
        for (const provider of this.chatSessionsService.getAllChatSessionContributions()) {
            if (provider.type === AgentSessionProviders.Background || provider.type === AgentSessionProviders.Cloud) {
                continue; // already added above
            }
            if (!addedSeparator) {
                actions.push(new Separator());
                addedSeparator = true;
            }
            const menuActions = this.menuService.getMenuActions(MenuId.ChatSessionsCreateSubMenu, this.scopedContextKeyService.createOverlay([
                [ChatContextKeys.sessionType.key, provider.type]
            ]));
            const primaryActions = getActionBarActions(menuActions, () => true).primary;
            // Prefer provider creation actions...
            if (primaryActions.length > 0) {
                actions.push(...primaryActions);
            }
            // ...over our generic one
            else {
                actions.push(toAction({
                    id: `newChatSessionFromProvider.${provider.type}`,
                    label: localize('newChatSessionFromProvider', "New {0}", provider.displayName),
                    run: () => this.commandService.executeCommand(`${NEW_CHAT_SESSION_ACTION_ID}.${provider.type}`)
                }));
            }
        }
        // Install more
        actions.push(new Separator());
        actions.push(toAction({
            id: 'install-extensions',
            label: localize('chatSessions.installExtensions', "Install Chat Extensions..."),
            run: () => this.commandService.executeCommand('chat.sessions.gettingStarted')
        }));
        return actions;
    }
    createList(container) {
        this.listContainer = append(container, $('.agent-sessions-viewer'));
        this.list = this._register(this.instantiationService.createInstance(WorkbenchCompressibleAsyncDataTree, 'AgentSessionsView', this.listContainer, new AgentSessionsListDelegate(), new AgentSessionsCompressionDelegate(), [
            this.instantiationService.createInstance(AgentSessionRenderer)
        ], new AgentSessionsDataSource(), {
            accessibilityProvider: new AgentSessionsAccessibilityProvider(),
            dnd: this.instantiationService.createInstance(AgentSessionsDragAndDrop),
            identityProvider: new AgentSessionsIdentityProvider(),
            horizontalScrolling: false,
            multipleSelectionSupport: false,
            findWidgetEnabled: true,
            defaultFindMode: TreeFindMode.Filter,
            keyboardNavigationLabelProvider: new AgentSessionsKeyboardNavigationLabelProvider(),
            sorter: new AgentSessionsSorter(),
            paddingBottom: AgentSessionsListDelegate.ITEM_HEIGHT,
            twistieAdditionalCssClass: () => 'force-no-twistie',
        }));
    }
    createViewModel() {
        const sessionsViewModel = this.sessionsViewModel = this._register(this.instantiationService.createInstance(AgentSessionsViewModel, { filterMenuId: MenuId.AgentSessionsFilterSubMenu }));
        this.list?.setInput(sessionsViewModel);
        this._register(sessionsViewModel.onDidChangeSessions(() => {
            if (this.isBodyVisible()) {
                this.list?.updateChildren();
            }
        }));
        const didResolveDisposable = this._register(new MutableDisposable());
        this._register(sessionsViewModel.onWillResolve(() => {
            const didResolve = new DeferredPromise();
            didResolveDisposable.value = Event.once(sessionsViewModel.onDidResolve)(() => didResolve.complete());
            this.progressService.withProgress({
                location: this.id,
                title: localize('agentSessions.refreshing', 'Refreshing agent sessions...'),
                delay: 500
            }, () => didResolve.p);
        }));
    }
    //#endregion
    //#region Actions internal API
    openFind() {
        this.list?.openFind();
    }
    refresh() {
        this.sessionsViewModel?.resolve(undefined);
    }
    //#endregion
    layoutBody(height, width) {
        super.layoutBody(height, width);
        let treeHeight = height;
        treeHeight -= this.newSessionContainer?.offsetHeight ?? 0;
        this.list?.layout(treeHeight, width);
    }
    focus() {
        super.focus();
        if (this.list?.getFocus().length) {
            this.list.domFocus();
        }
    }
};
AgentSessionsView = __decorate([
    __param(1, IKeybindingService),
    __param(2, IContextMenuService),
    __param(3, IConfigurationService),
    __param(4, IContextKeyService),
    __param(5, IViewDescriptorService),
    __param(6, IInstantiationService),
    __param(7, IOpenerService),
    __param(8, IThemeService),
    __param(9, IHoverService),
    __param(10, IChatSessionsService),
    __param(11, ICommandService),
    __param(12, IProgressService),
    __param(13, IEditorGroupsService),
    __param(14, IChatService),
    __param(15, IMenuService),
    __param(16, IChatWidgetService)
], AgentSessionsView);
export { AgentSessionsView };
//#region View Registration
const chatAgentsIcon = registerIcon('chat-sessions-icon', Codicon.commentDiscussionSparkle, 'Icon for Agent Sessions View');
const AGENT_SESSIONS_VIEW_TITLE = localize2('agentSessions.view.label', "Agent Sessions");
const agentSessionsViewContainer = Registry.as(ViewExtensions.ViewContainersRegistry).registerViewContainer({
    id: AGENT_SESSIONS_VIEW_CONTAINER_ID,
    title: AGENT_SESSIONS_VIEW_TITLE,
    icon: chatAgentsIcon,
    ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [AGENT_SESSIONS_VIEW_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
    storageId: AGENT_SESSIONS_VIEW_CONTAINER_ID,
    hideIfEmpty: true,
    order: 6,
}, 2 /* ViewContainerLocation.AuxiliaryBar */);
const agentSessionsViewDescriptor = {
    id: AGENT_SESSIONS_VIEW_ID,
    containerIcon: chatAgentsIcon,
    containerTitle: AGENT_SESSIONS_VIEW_TITLE.value,
    singleViewPaneContainerTitle: AGENT_SESSIONS_VIEW_TITLE.value,
    name: AGENT_SESSIONS_VIEW_TITLE,
    canToggleVisibility: false,
    canMoveView: true,
    openCommandActionDescriptor: {
        id: AGENT_SESSIONS_VIEW_ID,
        title: AGENT_SESSIONS_VIEW_TITLE
    },
    ctorDescriptor: new SyncDescriptor(AgentSessionsView),
    when: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabled.negate(), ContextKeyExpr.equals(`config.${ChatConfiguration.AgentSessionsViewLocation}`, 'single-view'))
};
Registry.as(ViewExtensions.ViewsRegistry).registerViews([agentSessionsViewDescriptor], agentSessionsViewContainer);
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRTZXNzaW9uc1ZpZXcuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2FnZW50U2Vzc2lvbnMvYWdlbnRTZXNzaW9uc1ZpZXcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTywrQkFBK0IsQ0FBQztBQUN2QyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsY0FBYyxFQUFFLGtCQUFrQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDN0csT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUMvRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDcEYsT0FBTyxFQUFvQixRQUFRLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN6RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN6RixPQUFPLEVBQTJCLFVBQVUsSUFBSSxjQUFjLEVBQTBELHNCQUFzQixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDcEwsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzlELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztB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