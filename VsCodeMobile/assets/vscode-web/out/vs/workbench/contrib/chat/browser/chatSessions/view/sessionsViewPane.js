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
import * as DOM from '../../../../../../base/browser/dom.js';
import { $, append } from '../../../../../../base/browser/dom.js';
import { renderAsPlaintext } from '../../../../../../base/browser/markdownRenderer.js';
import { toAction } from '../../../../../../base/common/actions.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { truncate } from '../../../../../../base/common/strings.js';
import { URI } from '../../../../../../base/common/uri.js';
import * as nls from '../../../../../../nls.js';
import { DropdownWithPrimaryActionViewItem } from '../../../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js';
import { getActionBarActions } from '../../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IMenuService, MenuId, MenuItemAction } from '../../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../../platform/keybinding/common/keybinding.js';
import { WorkbenchAsyncDataTree, WorkbenchList } from '../../../../../../platform/list/browser/listService.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';
import { IOpenerService } from '../../../../../../platform/opener/common/opener.js';
import { IProgressService } from '../../../../../../platform/progress/common/progress.js';
import { IThemeService } from '../../../../../../platform/theme/common/themeService.js';
import { fillEditorsDragData } from '../../../../../browser/dnd.js';
import { ResourceLabels } from '../../../../../browser/labels.js';
import { ViewPane } from '../../../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../../../common/views.js';
import { IEditorGroupsService } from '../../../../../services/editor/common/editorGroupsService.js';
import { IChatService } from '../../../common/chatService.js';
import { IChatSessionsService, localChatSessionType } from '../../../common/chatSessionsService.js';
import { ChatConfiguration, ChatEditorTitleMaxLength } from '../../../common/constants.js';
import { ACTION_ID_OPEN_CHAT } from '../../actions/chatActions.js';
import { IChatWidgetService } from '../../chat.js';
import { getSessionItemContextOverlay, NEW_CHAT_SESSION_ACTION_ID } from '../common.js';
import { LocalChatSessionsProvider } from '../localChatSessionsProvider.js';
import { ArchivedSessionItems, GettingStartedDelegate, GettingStartedRenderer, SessionsDataSource, SessionsDelegate, SessionsRenderer } from './sessionsTreeRenderer.js';
// Identity provider for session items
class SessionsIdentityProvider {
    getId(element) {
        if (element instanceof ArchivedSessionItems) {
            return 'archived-session-items';
        }
        return element.resource.toString();
    }
}
// Accessibility provider for session items
class SessionsAccessibilityProvider {
    getWidgetAriaLabel() {
        return nls.localize('chatSessions', 'Chat Sessions');
    }
    getAriaLabel(element) {
        return element.label;
    }
}
let SessionsViewPane = class SessionsViewPane extends ViewPane {
    constructor(provider, sessionTracker, viewId, options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, chatService, logService, progressService, menuService, commandService, chatWidgetService, editorGroupsService, chatSessionsService) {
        super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this.provider = provider;
        this.sessionTracker = sessionTracker;
        this.viewId = viewId;
        this.chatService = chatService;
        this.logService = logService;
        this.progressService = progressService;
        this.menuService = menuService;
        this.commandService = commandService;
        this.chatWidgetService = chatWidgetService;
        this.editorGroupsService = editorGroupsService;
        this.chatSessionsService = chatSessionsService;
        this._isEmpty = true;
        this.minimumBodySize = 44;
        // Listen for changes in the provider if it's a LocalChatSessionsProvider
        if (provider instanceof LocalChatSessionsProvider) {
            this._register(provider.onDidChange(() => {
                if (this.tree && this.isBodyVisible()) {
                    this.refreshTreeWithProgress();
                }
            }));
        }
        // Listen for configuration changes to refresh view when description display changes
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(ChatConfiguration.ShowAgentSessionsViewDescription)) {
                if (this.tree && this.isBodyVisible()) {
                    this.refreshTreeWithProgress();
                }
            }
        }));
        this._register(this.chatSessionsService.onDidChangeSessionItems((chatSessionType) => {
            if (provider.chatSessionType === chatSessionType && this.tree && this.isBodyVisible()) {
                this.refreshTreeWithProgress();
            }
        }));
        if (provider) { // TODO: Why can this be undefined?
            this.scopedContextKeyService.createKey('chatSessionType', provider.chatSessionType);
        }
    }
    shouldShowWelcome() {
        return this._isEmpty;
    }
    createActionViewItem(action, options) {
        if (action.id.startsWith(NEW_CHAT_SESSION_ACTION_ID)) {
            return this.getChatSessionDropdown(action, options);
        }
        return super.createActionViewItem(action, options);
    }
    getChatSessionDropdown(defaultAction, options) {
        const primaryAction = this.instantiationService.createInstance(MenuItemAction, {
            id: defaultAction.id,
            title: defaultAction.label,
            icon: Codicon.plus,
        }, undefined, undefined, undefined, undefined);
        const actions = this.menuService.getMenuActions(MenuId.ChatSessionsMenu, this.scopedContextKeyService, { shouldForwardArgs: true });
        const primaryActions = getActionBarActions(actions, 'submenu').primary.filter(action => {
            if (action instanceof MenuItemAction && defaultAction instanceof MenuItemAction) {
                if (!action.item.source?.id || !defaultAction.item.source?.id) {
                    return false;
                }
                if (action.item.source.id === defaultAction.item.source.id) {
                    return true;
                }
            }
            return false;
        });
        if (!primaryActions || primaryActions.length === 0) {
            return;
        }
        const dropdownAction = toAction({
            id: 'selectNewChatSessionOption',
            label: nls.localize('chatSession.selectOption', 'More...'),
            class: 'codicon-chevron-down',
            run: () => { }
        });
        const dropdownActions = [];
        primaryActions.forEach(element => {
            dropdownActions.push(element);
        });
        return this.instantiationService.createInstance(DropdownWithPrimaryActionViewItem, primaryAction, dropdownAction, dropdownActions, '', options);
    }
    isEmpty() {
        // Check if the tree has the provider node and get its children count
        if (!this.tree?.hasNode(this.provider)) {
            return true;
        }
        const providerNode = this.tree.getNode(this.provider);
        const childCount = providerNode.children?.length || 0;
        return childCount === 0;
    }
    /**
     * Updates the empty state message based on current tree data.
     * Uses the tree's existing data to avoid redundant provider calls.
     */
    updateEmptyState() {
        try {
            const newEmptyState = this.isEmpty();
            if (newEmptyState !== this._isEmpty) {
                this._isEmpty = newEmptyState;
                this._onDidChangeViewWelcomeState.fire();
            }
        }
        catch (error) {
            this.logService.error('Error checking tree data for empty state:', error);
        }
    }
    /**
     * Refreshes the tree data with progress indication.
     * Shows a progress indicator while the tree updates its children from the provider.
     */
    async refreshTreeWithProgress() {
        if (!this.tree) {
            return;
        }
        try {
            await this.progressService.withProgress({
                location: this.id, // Use the view ID as the progress location
                title: nls.localize('chatSessions.refreshing', 'Refreshing chat sessions...'),
            }, async () => {
                await this.tree.updateChildren(this.provider);
            });
            // Check for empty state after refresh using tree data
            this.updateEmptyState();
        }
        catch (error) {
            // Log error but don't throw to avoid breaking the UI
            this.logService.error('Error refreshing chat sessions tree:', error);
        }
    }
    /**
     * Loads initial tree data with progress indication.
     * Shows a progress indicator while the tree loads data from the provider.
     */
    async loadDataWithProgress() {
        if (!this.tree) {
            return;
        }
        try {
            await this.progressService.withProgress({
                location: this.id, // Use the view ID as the progress location
                title: nls.localize('chatSessions.loading', 'Loading chat sessions...'),
            }, async () => {
                await this.tree.setInput(this.provider);
            });
            // Check for empty state after loading using tree data
            this.updateEmptyState();
        }
        catch (error) {
            // Log error but don't throw to avoid breaking the UI
            this.logService.error('Error loading chat sessions data:', error);
        }
    }
    renderBody(container) {
        super.renderBody(container);
        container.classList.add('chat-sessions-view');
        // For Getting Started view (null provider), show simple list
        if (this.provider === null) {
            this.renderGettingStartedList(container);
            return;
        }
        this.treeContainer = DOM.append(container, DOM.$('.chat-sessions-tree-container'));
        // Create message element for empty state
        this.messageElement = append(container, $('.chat-sessions-message'));
        this.messageElement.style.display = 'none';
        // Create the tree components
        const dataSource = new SessionsDataSource(this.provider, this.sessionTracker);
        const delegate = new SessionsDelegate(this.configurationService);
        const identityProvider = new SessionsIdentityProvider();
        const accessibilityProvider = new SessionsAccessibilityProvider();
        // Use the existing ResourceLabels service for consistent styling
        const renderer = this.instantiationService.createInstance(SessionsRenderer, this.viewDescriptorService.getViewLocationById(this.viewId));
        this._register(renderer);
        const getResourceForElement = (element) => {
            return element.resource;
        };
        this.tree = this.instantiationService.createInstance(WorkbenchAsyncDataTree, 'ChatSessions', this.treeContainer, delegate, [renderer], dataSource, {
            dnd: {
                onDragStart: (data, originalEvent) => {
                    try {
                        const elements = data.getData();
                        const uris = elements.map(getResourceForElement);
                        this.instantiationService.invokeFunction(accessor => fillEditorsDragData(accessor, uris, originalEvent));
                    }
                    catch {
                        // noop
                    }
                },
                getDragURI: (element) => {
                    if (element instanceof ArchivedSessionItems) {
                        return null;
                    }
                    return getResourceForElement(element).toString();
                },
                getDragLabel: (elements) => {
                    if (elements.length === 1) {
                        return elements[0].label;
                    }
                    return nls.localize('chatSessions.dragLabel', "{0} agent sessions", elements.length);
                },
                drop: () => { },
                onDragOver: () => false,
                dispose: () => { },
            },
            accessibilityProvider,
            identityProvider,
            keyboardNavigationLabelProvider: {
                getKeyboardNavigationLabel: (session) => {
                    const parts = [
                        session.label || '',
                        typeof session.description === 'string' ? session.description : (session.description ? renderAsPlaintext(session.description) : '')
                    ];
                    return parts.filter(text => text.length > 0).join(' ');
                }
            },
            multipleSelectionSupport: false,
            overrideStyles: {
                listBackground: undefined
            },
            paddingBottom: SessionsDelegate.ITEM_HEIGHT,
            setRowLineHeight: false
        });
        // Set the input
        this.tree.setInput(this.provider);
        // Register tree events
        this._register(this.tree.onDidOpen((e) => {
            if (e.element) {
                this.openChatSession(e.element);
            }
        }));
        // Register context menu event for right-click actions
        this._register(this.tree.onContextMenu((e) => {
            if (e.element && !(e.element instanceof ArchivedSessionItems)) {
                this.showContextMenu(e);
            }
            if (e.element) {
                this.showContextMenu(e);
            }
        }));
        this._register(this.tree.onMouseDblClick(e => {
            const scrollingByPage = this.configurationService.getValue('workbench.list.scrollByPage');
            if (e.element === null && !scrollingByPage) {
                if (this.provider?.chatSessionType && this.provider.chatSessionType !== localChatSessionType) {
                    this.commandService.executeCommand(`workbench.action.chat.openNewSessionEditor.${this.provider?.chatSessionType}`);
                }
                else {
                    this.commandService.executeCommand(ACTION_ID_OPEN_CHAT);
                }
            }
        }));
        // Handle visibility changes to load data
        this._register(this.onDidChangeBodyVisibility(async (visible) => {
            if (visible && this.tree) {
                await this.loadDataWithProgress();
            }
        }));
        // Initially load data if visible
        if (this.isBodyVisible() && this.tree) {
            this.loadDataWithProgress();
        }
        this._register(this.tree);
    }
    renderGettingStartedList(container) {
        const listContainer = DOM.append(container, DOM.$('.getting-started-list-container'));
        const items = [
            {
                id: 'install-extensions',
                label: nls.localize('chatSessions.installExtensions', "Install Chat Extensions"),
                icon: Codicon.extensions,
                commandId: 'chat.sessions.gettingStarted'
            },
            {
                id: 'learn-more',
                label: nls.localize('chatSessions.learnMoreGHCodingAgent', "Learn More About GitHub Copilot coding agent"),
                commandId: 'vscode.open',
                icon: Codicon.book,
                args: [URI.parse('https://aka.ms/coding-agent-docs')]
            }
        ];
        const delegate = new GettingStartedDelegate();
        // Create ResourceLabels instance for the renderer
        const labels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
        this._register(labels);
        const renderer = new GettingStartedRenderer(labels);
        this.list = this.instantiationService.createInstance((WorkbenchList), 'GettingStarted', listContainer, delegate, [renderer], {
            horizontalScrolling: false,
        });
        this.list.splice(0, 0, items);
        this._register(this.list.onDidOpen(e => {
            if (e.element) {
                this.commandService.executeCommand(e.element.commandId, ...e.element.args ?? []);
            }
        }));
        this._register(this.list);
    }
    layoutBody(height, width) {
        super.layoutBody(height, width);
        if (this.tree) {
            this.tree.layout(height, width);
        }
        if (this.list) {
            this.list.layout(height, width);
        }
    }
    async openChatSession(session) {
        try {
            if (session instanceof ArchivedSessionItems) {
                return;
            }
            const options = {
                pinned: true,
                ignoreInView: true,
                title: {
                    preferred: truncate(session.label, ChatEditorTitleMaxLength),
                },
                preserveFocus: true,
            };
            await this.chatWidgetService.openSession(session.resource, undefined, options);
        }
        catch (error) {
            this.logService.error('[SessionsViewPane] Failed to open chat session:', error);
        }
    }
    showContextMenu(e) {
        if (!e.element) {
            return;
        }
        const session = e.element;
        const sessionWithProvider = session;
        // Create context overlay for this specific session item
        const contextOverlay = getSessionItemContextOverlay(session, sessionWithProvider.provider, this.chatWidgetService, this.chatService, this.editorGroupsService);
        const contextKeyService = this.contextKeyService.createOverlay(contextOverlay);
        // Create marshalled context for command execution
        const marshalledSession = {
            session: session,
            $mid: 25 /* MarshalledId.ChatSessionContext */
        };
        // Create menu for this session item to get actions
        const menu = this.menuService.createMenu(MenuId.ChatSessionsMenu, contextKeyService);
        // Get actions and filter for context menu (all actions that are NOT inline)
        const actions = menu.getActions({ arg: marshalledSession, shouldForwardArgs: true });
        const { secondary } = getActionBarActions(actions, 'inline');
        this.contextMenuService.showContextMenu({
            getActions: () => secondary,
            getAnchor: () => e.anchor,
            getActionsContext: () => marshalledSession,
        });
        menu.dispose();
    }
};
SessionsViewPane = __decorate([
    __param(4, IKeybindingService),
    __param(5, IContextMenuService),
    __param(6, IConfigurationService),
    __param(7, IContextKeyService),
    __param(8, IViewDescriptorService),
    __param(9, IInstantiationService),
    __param(10, IOpenerService),
    __param(11, IThemeService),
    __param(12, IHoverService),
    __param(13, IChatService),
    __param(14, ILogService),
    __param(15, IProgressService),
    __param(16, IMenuService),
    __param(17, ICommandService),
    __param(18, IChatWidgetService),
    __param(19, IEditorGroupsService),
    __param(20, IChatSessionsService)
], SessionsViewPane);
export { SessionsViewPane };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Vzc2lvbnNWaWV3UGFuZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFNlc3Npb25zL3ZpZXcvc2Vzc2lvbnNWaWV3UGFuZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLHVDQUF1QyxDQUFDO0FBQzdELE9BQU8sRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFJdkYsT0FBTyxFQUFXLFFBQVEsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUdwRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDcEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNELE9BQU8sS0FBSyxHQUFHLE1BQU0sMEJBQTBCLENBQUM7QUFDaEQsT0FBTyxFQUFFLGlDQUFpQyxFQUFFLE1BQU0saUZBQWlGLENBQUM7QUFDcEksT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sdUVBQXVFLENBQUM7QUFDNUcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDNUcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FB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