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
import { $, getWindow } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { MutableDisposable } from '../../../../base/common/lifecycle.js';
import { autorun } from '../../../../base/common/observable.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { editorBackground } from '../../../../platform/theme/common/colorRegistry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { Memento } from '../../../common/memento.js';
import { SIDE_BAR_FOREGROUND } from '../../../common/theme.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IChatAgentService } from '../common/chatAgents.js';
import { ChatContextKeys } from '../common/chatContextKeys.js';
import { CHAT_PROVIDER_ID } from '../common/chatParticipantContribTypes.js';
import { IChatService } from '../common/chatService.js';
import { IChatSessionsService, localChatSessionType } from '../common/chatSessionsService.js';
import { LocalChatSessionUri } from '../common/chatUri.js';
import { ChatAgentLocation, ChatModeKind } from '../common/constants.js';
import { ChatWidget } from './chatWidget.js';
import { ChatViewWelcomeController } from './viewsWelcome/chatViewWelcomeController.js';
export const CHAT_SIDEBAR_PANEL_ID = 'workbench.panel.chat';
let ChatViewPane = class ChatViewPane extends ViewPane {
    get widget() { return this._widget; }
    constructor(chatOptions, options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, storageService, chatService, chatAgentService, logService, layoutService, chatSessionsService, telemetryService) {
        super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this.chatOptions = chatOptions;
        this.storageService = storageService;
        this.chatService = chatService;
        this.chatAgentService = chatAgentService;
        this.logService = logService;
        this.layoutService = layoutService;
        this.chatSessionsService = chatSessionsService;
        this.telemetryService = telemetryService;
        this.modelRef = this._register(new MutableDisposable());
        // View state for the ViewPane is currently global per-provider basically, but some other strictly per-model state will require a separate memento.
        this.memento = new Memento('interactive-session-view-' + CHAT_PROVIDER_ID, this.storageService);
        this.viewState = this.memento.getMemento(1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        if (this.chatOptions.location === ChatAgentLocation.Chat && !this.viewState.hasMigratedCurrentSession) {
            const editsMemento = new Memento('interactive-session-view-' + CHAT_PROVIDER_ID + `-edits`, this.storageService);
            const lastEditsState = editsMemento.getMemento(1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
            if (lastEditsState.sessionId) {
                this.logService.trace(`ChatViewPane: last edits session was ${lastEditsState.sessionId}`);
                if (!this.chatService.isPersistedSessionEmpty(LocalChatSessionUri.forSession(lastEditsState.sessionId))) {
                    this.logService.info(`ChatViewPane: migrating ${lastEditsState.sessionId} to unified view`);
                    this.viewState.sessionId = lastEditsState.sessionId;
                    // Migrate old inputValue to new inputText, and old chatMode to new mode structure
                    if (lastEditsState.inputText) {
                        this.viewState.inputText = lastEditsState.inputText;
                    }
                    if (lastEditsState.mode) {
                        this.viewState.mode = lastEditsState.mode;
                    }
                    else {
                        // Default to Edit mode for migrated edits sessions
                        this.viewState.mode = { id: ChatModeKind.Edit, kind: ChatModeKind.Edit };
                    }
                    this.viewState.hasMigratedCurrentSession = true;
                }
            }
        }
        this._register(this.chatAgentService.onDidChangeAgents(() => {
            if (this.chatAgentService.getDefaultAgent(this.chatOptions?.location)) {
                if (!this._widget?.viewModel && !this._restoringSession) {
                    const info = this.getTransferredOrPersistedSessionInfo();
                    this._restoringSession =
                        (info.sessionId ? this.chatService.getOrRestoreSession(LocalChatSessionUri.forSession(info.sessionId)) : Promise.resolve(undefined)).then(async (modelRef) => {
                            if (!this._widget) {
                                // renderBody has not been called yet
                                return;
                            }
                            // The widget may be hidden at this point, because welcome views were allowed. Use setVisible to
                            // avoid doing a render while the widget is hidden. This is changing the condition in `shouldShowWelcome`
                            // so it should fire onDidChangeViewWelcomeState.
                            const wasVisible = this._widget.visible;
                            try {
                                this._widget.setVisible(false);
                                if (info.inputState && modelRef) {
                                    modelRef.object.inputModel.setState(info.inputState);
                                }
                                await this.updateModel(modelRef);
                            }
                            finally {
                                this.widget.setVisible(wasVisible);
                            }
                        });
                    this._restoringSession.finally(() => this._restoringSession = undefined);
                }
            }
            this._onDidChangeViewWelcomeState.fire();
        }));
        // Location context key
        ChatContextKeys.panelLocation.bindTo(contextKeyService).set(viewDescriptorService.getViewLocationById(options.id) ?? 2 /* ViewContainerLocation.AuxiliaryBar */);
    }
    getActionsContext() {
        return this.widget?.viewModel ? {
            sessionResource: this.widget.viewModel.sessionResource,
            $mid: 19 /* MarshalledId.ChatViewContext */
        } : undefined;
    }
    async updateModel(modelRef) {
        this.modelRef.value = undefined;
        const ref = modelRef ?? (this.chatService.transferredSessionData?.sessionId && this.chatService.transferredSessionData?.location === this.chatOptions.location
            ? await this.chatService.getOrRestoreSession(LocalChatSessionUri.forSession(this.chatService.transferredSessionData.sessionId))
            : this.chatService.startSession(this.chatOptions.location, CancellationToken.None));
        if (!ref) {
            throw new Error('Could not start chat session');
        }
        this.modelRef.value = ref;
        const model = ref.object;
        this.viewState.sessionId = model.sessionId;
        this._widget.setModel(model);
        // Update the toolbar context with new sessionId
        this.updateActions();
        return model;
    }
    shouldShowWelcome() {
        const noPersistedSessions = !this.chatService.hasSessions();
        const hasCoreAgent = this.chatAgentService.getAgents().some(agent => agent.isCore && agent.locations.includes(this.chatOptions.location));
        const hasDefaultAgent = this.chatAgentService.getDefaultAgent(this.chatOptions.location) !== undefined; // only false when Hide AI Features has run and unregistered the setup agents
        const shouldShow = !hasCoreAgent && (!hasDefaultAgent || !this._widget?.viewModel && noPersistedSessions);
        this.logService.trace(`ChatViewPane#shouldShowWelcome(${this.chatOptions.location}) = ${shouldShow}: hasCoreAgent=${hasCoreAgent} hasDefaultAgent=${hasDefaultAgent} || noViewModel=${!this._widget?.viewModel} && noPersistedSessions=${noPersistedSessions}`);
        return !!shouldShow;
    }
    getTransferredOrPersistedSessionInfo() {
        if (this.chatService.transferredSessionData?.location === this.chatOptions.location) {
            const sessionId = this.chatService.transferredSessionData.sessionId;
            return {
                sessionId,
                inputState: this.chatService.transferredSessionData.inputState,
            };
        }
        else {
            return { sessionId: this.viewState.sessionId };
        }
    }
    async renderBody(parent) {
        super.renderBody(parent);
        this.telemetryService.publicLog2('chatViewPaneOpened');
        const welcomeController = this._register(this.instantiationService.createInstance(ChatViewWelcomeController, parent, this, this.chatOptions.location));
        const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, this.scopedContextKeyService])));
        const locationBasedColors = this.getLocationBasedColors();
        const editorOverflowNode = this.layoutService.getContainer(getWindow(parent)).appendChild($('.chat-editor-overflow.monaco-editor'));
        this._register({ dispose: () => editorOverflowNode.remove() });
        this._widget = this._register(scopedInstantiationService.createInstance(ChatWidget, this.chatOptions.location, { viewId: this.id }, {
            autoScroll: mode => mode !== ChatModeKind.Ask,
            renderFollowups: this.chatOptions.location === ChatAgentLocation.Chat,
            supportsFileReferences: true,
            clear: () => this.clear(),
            rendererOptions: {
                renderTextEditsAsSummary: (uri) => {
                    return true;
                },
                referencesExpandedWhenEmptyResponse: false,
                progressMessageAtBottomOfResponse: mode => mode !== ChatModeKind.Ask,
            },
            editorOverflowWidgetsDomNode: editorOverflowNode,
            enableImplicitContext: this.chatOptions.location === ChatAgentLocation.Chat,
            enableWorkingSet: 'explicit',
            supportsChangingModes: true,
        }, {
            listForeground: SIDE_BAR_FOREGROUND,
            listBackground: locationBasedColors.background,
            overlayBackground: locationBasedColors.overlayBackground,
            inputEditorBackground: locationBasedColors.background,
            resultEditorBackground: editorBackground,
        }));
        this._widget.render(parent);
        const updateWidgetVisibility = (r) => {
            this._widget.setVisible(this.isBodyVisible() && !welcomeController.isShowingWelcome.read(r));
        };
        this._register(this.onDidChangeBodyVisibility(() => {
            updateWidgetVisibility();
        }));
        this._register(autorun(r => {
            updateWidgetVisibility(r);
        }));
        const info = this.getTransferredOrPersistedSessionInfo();
        const modelRef = info.sessionId ? await this.chatService.getOrRestoreSession(LocalChatSessionUri.forSession(info.sessionId)) : undefined;
        if (modelRef && info.inputState) {
            modelRef.object.inputModel.setState(info.inputState);
        }
        await this.updateModel(modelRef);
    }
    acceptInput(query) {
        this._widget.acceptInput(query);
    }
    async clear() {
        // Grab the widget's latest view state because it will be loaded back into the widget
        this.updateViewState();
        await this.updateModel(undefined);
        // Update the toolbar context with new sessionId
        this.updateActions();
    }
    async loadSession(sessionId) {
        // Handle locking for contributed chat sessions
        // TODO: Is this logic still correct with sessions from different schemes?
        const local = LocalChatSessionUri.parseLocalSessionId(sessionId);
        if (local) {
            await this.chatSessionsService.canResolveChatSession(sessionId);
            const contributions = this.chatSessionsService.getAllChatSessionContributions();
            const contribution = contributions.find((c) => c.type === localChatSessionType);
            if (contribution) {
                this.widget.lockToCodingAgent(contribution.name, contribution.displayName, contribution.type);
            }
        }
        const newModelRef = await this.chatService.loadSessionForResource(sessionId, ChatAgentLocation.Chat, CancellationToken.None);
        return this.updateModel(newModelRef);
    }
    focusInput() {
        this._widget.focusInput();
    }
    focus() {
        super.focus();
        this._widget.focusInput();
    }
    layoutBody(height, width) {
        super.layoutBody(height, width);
        this._widget.layout(height, width);
    }
    saveState() {
        // Don't do saveState when no widget, or no viewModel in which case the state has not yet been restored -
        // in that case the default state would overwrite the real state
        if (this._widget?.viewModel) {
            this._widget.saveState();
            this.updateViewState();
            this.memento.saveMemento();
        }
        super.saveState();
    }
    updateViewState(viewState) {
        const newViewState = viewState ?? this._widget.getViewState();
        if (newViewState) {
            for (const [key, value] of Object.entries(newViewState)) {
                // Assign all props to the memento so they get saved
                this.viewState[key] = value;
            }
        }
    }
};
ChatViewPane = __decorate([
    __param(2, IKeybindingService),
    __param(3, IContextMenuService),
    __param(4, IConfigurationService),
    __param(5, IContextKeyService),
    __param(6, IViewDescriptorService),
    __param(7, IInstantiationService),
    __param(8, IOpenerService),
    __param(9, IThemeService),
    __param(10, IHoverService),
    __param(11, IStorageService),
    __param(12, IChatService),
    __param(13, IChatAgentService),
    __param(14, ILogService),
    __param(15, ILayoutService),
    __param(16, IChatSessionsService),
    __param(17, ITelemetryService)
], ChatViewPane);
export { ChatViewPane };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFZpZXdQYW5lLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Vmlld1BhbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUV6RSxPQUFPLEVBQUUsT0FBTyxFQUFXLE1BQU0sdUNBQXVDLENBQUM7QUFFekUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDOUYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBQ25HLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN0RixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDckUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sZ0RBQWdELENBQUM7QUFDOUcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0s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