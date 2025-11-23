var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var LocalChatSessionsProvider_1;
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ResourceSet } from '../../../../../base/common/map.js';
import { IChatService } from '../../common/chatService.js';
import { IChatSessionsService, localChatSessionType } from '../../common/chatSessionsService.js';
import { ChatAgentLocation } from '../../common/constants.js';
import { IChatWidgetService, isIChatViewViewContext } from '../chat.js';
let LocalChatSessionsProvider = class LocalChatSessionsProvider extends Disposable {
    static { LocalChatSessionsProvider_1 = this; }
    static { this.ID = 'workbench.contrib.localChatSessionsProvider'; }
    static { this.CHAT_WIDGET_VIEW_ID = 'workbench.panel.chat.view.copilot'; }
    get onDidChangeChatSessionItems() { return this._onDidChangeChatSessionItems.event; }
    constructor(chatWidgetService, chatService, chatSessionsService) {
        super();
        this.chatWidgetService = chatWidgetService;
        this.chatService = chatService;
        this.chatSessionsService = chatSessionsService;
        this.chatSessionType = localChatSessionType;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._onDidChangeChatSessionItems = this._register(new Emitter());
        this._register(this.chatSessionsService.registerChatSessionItemProvider(this));
        this.registerWidgetListeners();
        this._register(this.chatService.onDidDisposeSession(() => {
            this._onDidChange.fire();
        }));
        // Listen for global session items changes for our session type
        this._register(this.chatSessionsService.onDidChangeSessionItems((sessionType) => {
            if (sessionType === this.chatSessionType) {
                this._onDidChange.fire();
            }
        }));
    }
    registerWidgetListeners() {
        // Listen for new chat widgets being added/removed
        this._register(this.chatWidgetService.onDidAddWidget(widget => {
            // Only fire for chat view instance
            if (widget.location === ChatAgentLocation.Chat &&
                isIChatViewViewContext(widget.viewContext) &&
                widget.viewContext.viewId === LocalChatSessionsProvider_1.CHAT_WIDGET_VIEW_ID) {
                this._onDidChange.fire();
                this._registerWidgetModelListeners(widget);
            }
        }));
        // Check for existing chat widgets and register listeners
        const existingWidgets = this.chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Chat)
            .filter(widget => isIChatViewViewContext(widget.viewContext) && widget.viewContext.viewId === LocalChatSessionsProvider_1.CHAT_WIDGET_VIEW_ID);
        existingWidgets.forEach(widget => {
            this._registerWidgetModelListeners(widget);
        });
    }
    _registerWidgetModelListeners(widget) {
        const register = () => {
            this.registerModelTitleListener(widget);
            if (widget.viewModel) {
                this.chatSessionsService.registerModelProgressListener(widget.viewModel.model, () => {
                    this._onDidChangeChatSessionItems.fire();
                });
            }
        };
        // Listen for view model changes on this widget
        this._register(widget.onDidChangeViewModel(() => {
            register();
            this._onDidChangeChatSessionItems.fire();
        }));
        register();
    }
    registerModelTitleListener(widget) {
        const model = widget.viewModel?.model;
        if (model) {
            // Listen for model changes, specifically for title changes via setCustomTitle
            this._register(model.onDidChange((e) => {
                // Fire change events for all title-related changes to refresh the tree
                if (!e || e.kind === 'setCustomTitle') {
                    this._onDidChange.fire();
                }
            }));
        }
    }
    modelToStatus(model) {
        if (model.requestInProgress.get()) {
            return 2 /* ChatSessionStatus.InProgress */;
        }
        else {
            const requests = model.getRequests();
            if (requests.length > 0) {
                // Check if the last request was completed successfully or failed
                const lastRequest = requests[requests.length - 1];
                if (lastRequest?.response) {
                    if (lastRequest.response.isCanceled || lastRequest.response.result?.errorDetails) {
                        return 0 /* ChatSessionStatus.Failed */;
                    }
                    else if (lastRequest.response.isComplete) {
                        return 1 /* ChatSessionStatus.Completed */;
                    }
                    else {
                        return 2 /* ChatSessionStatus.InProgress */;
                    }
                }
            }
        }
        return;
    }
    async provideChatSessionItems(token) {
        const sessions = [];
        const sessionsByResource = new ResourceSet();
        this.chatService.getLiveSessionItems().forEach(sessionDetail => {
            let status;
            let startTime;
            let endTime;
            const model = this.chatService.getSession(sessionDetail.sessionResource);
            if (model) {
                status = this.modelToStatus(model);
                startTime = model.timestamp;
                const lastResponse = model.getRequests().at(-1)?.response;
                if (lastResponse) {
                    endTime = lastResponse.completedAt ?? lastResponse.timestamp;
                }
            }
            const statistics = model ? this.getSessionStatistics(model) : undefined;
            const editorSession = {
                resource: sessionDetail.sessionResource,
                label: sessionDetail.title,
                iconPath: Codicon.chatSparkle,
                status,
                provider: this,
                timing: {
                    startTime: startTime ?? Date.now(), // TODO@osortega this is not so good
                    endTime
                },
                statistics
            };
            sessionsByResource.add(sessionDetail.sessionResource);
            sessions.push(editorSession);
        });
        const history = await this.getHistoryItems();
        sessions.push(...history.filter(h => !sessionsByResource.has(h.resource)));
        return sessions;
    }
    async getHistoryItems() {
        try {
            const allHistory = await this.chatService.getHistorySessionItems();
            const historyItems = allHistory.map((historyDetail) => {
                const model = this.chatService.getSession(historyDetail.sessionResource);
                const statistics = model ? this.getSessionStatistics(model) : undefined;
                return {
                    resource: historyDetail.sessionResource,
                    label: historyDetail.title,
                    iconPath: Codicon.chatSparkle,
                    provider: this,
                    timing: {
                        startTime: historyDetail.lastMessageDate ?? Date.now()
                    },
                    archived: true,
                    statistics
                };
            });
            return historyItems;
        }
        catch (error) {
            return [];
        }
    }
    getSessionStatistics(chatModel) {
        let linesAdded = 0;
        let linesRemoved = 0;
        const modifiedFiles = new ResourceSet();
        const currentEdits = chatModel.editingSession?.entries.get();
        if (currentEdits) {
            const uncommittedEdits = currentEdits.filter((edit) => edit.state.get() === 0 /* ModifiedFileEntryState.Modified */);
            uncommittedEdits.forEach(edit => {
                linesAdded += edit.linesAdded?.get() ?? 0;
                linesRemoved += edit.linesRemoved?.get() ?? 0;
                modifiedFiles.add(edit.modifiedURI);
            });
        }
        if (modifiedFiles.size === 0) {
            return;
        }
        return {
            files: modifiedFiles.size,
            insertions: linesAdded,
            deletions: linesRemoved,
        };
    }
};
LocalChatSessionsProvider = LocalChatSessionsProvider_1 = __decorate([
    __param(0, IChatWidgetService),
    __param(1, IChatService),
    __param(2, IChatSessionsService)
], LocalChatSessionsProvider);
export { LocalChatSessionsProvider };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYWxDaGF0U2Vzc2lvbnNQcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFNlc3Npb25zL2xvY2FsQ2hhdFNlc3Npb25zUHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUtBLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0scUNBQXFDLENBQUM7QUFDckUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUloRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDM0QsT0FBTyxFQUFpRSxvQkFBb0IsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2hLLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzlELE9BQU8sRUFBZSxrQkFBa0IsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUc5RSxJQUFNLHlCQUF5QixHQUEvQixNQUFNLHlCQUEwQixTQUFRLFVBQVU7O2FBQ3hDLE9BQUUsR0FBRyw2Q0FBNkMsQUFBaEQsQ0FBaUQ7YUFDbkQsd0JBQW1CLEdBQUcsbUNBQW1DLEFBQXRDLENBQXVDO0lBTzFFLElBQVcsMkJBQTJCLEtBQUssT0FBTyxJQUFJLENBQUMsNEJBQTRCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUU1RixZQUNxQixpQkFBc0QsRUFDNUQsV0FBMEMsRUFDbEMsbUJBQTBEO1FBRWhGLEtBQUssRUFBRSxDQUFDO1FBSjZCLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBb0I7UUFDM0MsZ0JBQVcsR0FBWCxXQUFX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