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
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, DisposableMap } from '../../../../../base/common/lifecycle.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IChatService } from '../../common/chatService.js';
import { IChatSessionsService, localChatSessionType } from '../../common/chatSessionsService.js';
import { ChatEditorInput } from '../chatEditorInput.js';
import { isChatSession } from './common.js';
let ChatSessionTracker = class ChatSessionTracker extends Disposable {
    constructor(editorGroupsService, chatService, chatSessionsService) {
        super();
        this.editorGroupsService = editorGroupsService;
        this.chatService = chatService;
        this.chatSessionsService = chatSessionsService;
        this._onDidChangeEditors = this._register(new Emitter());
        this.groupDisposables = this._register(new DisposableMap());
        this.onDidChangeEditors = this._onDidChangeEditors.event;
        this.setupEditorTracking();
    }
    setupEditorTracking() {
        // Listen to all editor groups
        this.editorGroupsService.groups.forEach(group => {
            this.registerGroupListeners(group);
        });
        // Listen for new groups
        this._register(this.editorGroupsService.onDidAddGroup(group => {
            this.registerGroupListeners(group);
        }));
        // Listen for deleted groups
        this._register(this.editorGroupsService.onDidRemoveGroup(group => {
            this.groupDisposables.deleteAndDispose(group.id);
        }));
    }
    registerGroupListeners(group) {
        this.groupDisposables.set(group.id, group.onDidModelChange(e => {
            if (!isChatSession(this.chatSessionsService.getContentProviderSchemes(), e.editor)) {
                return;
            }
            const editor = e.editor;
            const sessionType = editor.getSessionType();
            const model = editor.sessionResource && this.chatService.getSession(editor.sessionResource);
            if (model) {
                this.chatSessionsService.registerModelProgressListener(model, () => {
                    this.chatSessionsService.notifySessionItemsChanged(sessionType);
                });
            }
            this.chatSessionsService.notifySessionItemsChanged(sessionType);
            // Emit targeted event for this session type
            this._onDidChangeEditors.fire({ sessionType, kind: e.kind });
        }));
    }
    getLocalEditorsForSessionType(sessionType) {
        const localEditors = [];
        this.editorGroupsService.groups.forEach(group => {
            group.editors.forEach(editor => {
                if (editor instanceof ChatEditorInput && editor.getSessionType() === sessionType) {
                    localEditors.push(editor);
                }
            });
        });
        return localEditors;
    }
    async getHybridSessionsForProvider(provider) {
        if (provider.chatSessionType === localChatSessionType) {
            return []; // Local provider doesn't need hybrid sessions
        }
        const localEditors = this.getLocalEditorsForSessionType(provider.chatSessionType);
        const hybridSessions = [];
        localEditors.forEach((editor, index) => {
            const group = this.findGroupForEditor(editor);
            if (!group) {
                return;
            }
            if (editor.options.ignoreInView) {
                return;
            }
            let status = 1 /* ChatSessionStatus.Completed */;
            let timestamp;
            if (editor.sessionResource) {
                const model = this.chatService.getSession(editor.sessionResource);
                const modelStatus = model ? this.modelToStatus(model) : undefined;
                if (model && modelStatus) {
                    status = modelStatus;
                    const requests = model.getRequests();
                    if (requests.length > 0) {
                        timestamp = requests[requests.length - 1].timestamp;
                    }
                }
            }
            const hybridSession = {
                resource: editor.resource,
                label: editor.getName(),
                status: status,
                provider,
                timing: {
                    startTime: timestamp ?? Date.now()
                }
            };
            hybridSessions.push(hybridSession);
        });
        return hybridSessions;
    }
    findGroupForEditor(editor) {
        for (const group of this.editorGroupsService.groups) {
            if (group.editors.includes(editor)) {
                return group;
            }
        }
        return undefined;
    }
    modelToStatus(model) {
        if (model.requestInProgress.get()) {
            return 2 /* ChatSessionStatus.InProgress */;
        }
        const requests = model.getRequests();
        if (requests.length > 0) {
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
        return undefined;
    }
};
ChatSessionTracker = __decorate([
    __param(0, IEditorGroupsService),
    __param(1, IChatService),
    __param(2, IChatSessionsService)
], ChatSessionTracker);
export { ChatSessionTracker };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNlc3Npb25UcmFja2VyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0U2Vzc2lvbnMvY2hhdFNlc3Npb25UcmFja2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBR3BGLE9BQU8sRUFBZ0Isb0JBQW9CLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUUvRyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDM0QsT0FBTyxFQUFpRSxvQkFBb0IsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2hLLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUN4RCxPQUFPLEVBQStCLGFBQWEsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUVsRSxJQUFNLGtCQUFrQixHQUF4QixNQUFNLGtCQUFtQixTQUFRLFVBQVU7SUFLakQsWUFDdUIsbUJBQTBELEVBQ2xFLFdBQTBDLEVBQ2xDLG1CQUEwRDtRQUVoRixLQUFLLEVBQUUsQ0FBQztRQUorQix3QkFBbUIsR0FBbkIsbUJBQW1CLENBQXNCO1FBQ2pELGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBQ2pCLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBc0I7UUFQaEUsd0JBQW1CLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBdUQsQ0FBQyxDQUFDO1FBQ3pHLHFCQUFnQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxhQUFhLEVBQVUsQ0FBQyxDQUFDO1FBQ3ZFLHVCQUFrQixHQUFHLElBQUks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