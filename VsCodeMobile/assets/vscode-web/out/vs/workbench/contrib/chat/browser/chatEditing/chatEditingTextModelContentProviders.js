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
var ChatEditingTextModelContentProvider_1;
import { Schemas } from '../../../../../base/common/network.js';
import { URI } from '../../../../../base/common/uri.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
let ChatEditingTextModelContentProvider = class ChatEditingTextModelContentProvider {
    static { ChatEditingTextModelContentProvider_1 = this; }
    static { this.scheme = Schemas.chatEditingModel; }
    static getFileURI(chatSessionResource, documentId, path) {
        return URI.from({
            scheme: ChatEditingTextModelContentProvider_1.scheme,
            path,
            query: JSON.stringify({ kind: 'doc', documentId, chatSessionResource }),
        });
    }
    constructor(_chatEditingService, _modelService) {
        this._chatEditingService = _chatEditingService;
        this._modelService = _modelService;
    }
    async provideTextContent(resource) {
        const existing = this._modelService.getModel(resource);
        if (existing && !existing.isDisposed()) {
            return existing;
        }
        const data = JSON.parse(resource.query);
        const session = this._chatEditingService.getEditingSession(URI.revive(data.chatSessionResource));
        const entry = session?.entries.get().find(candidate => candidate.entryId === data.documentId);
        if (!entry) {
            return null;
        }
        return this._modelService.getModel(entry.originalURI);
    }
};
ChatEditingTextModelContentProvider = ChatEditingTextModelContentProvider_1 = __decorate([
    __param(1, IModelService)
], ChatEditingTextModelContentProvider);
export { ChatEditingTextModelContentProvider };
let ChatEditingSnapshotTextModelContentProvider = class ChatEditingSnapshotTextModelContentProvider {
    static getSnapshotFileURI(chatSessionResource, requestId, undoStop, path, scheme) {
        return URI.from({
            scheme: Schemas.chatEditingSnapshotScheme,
            path,
            query: JSON.stringify({ session: chatSessionResource, requestId: requestId ?? '', undoStop: undoStop ?? '', scheme }),
        });
    }
    constructor(_chatEditingService, _modelService) {
        this._chatEditingService = _chatEditingService;
        this._modelService = _modelService;
    }
    async provideTextContent(resource) {
        const existing = this._modelService.getModel(resource);
        if (existing && !existing.isDisposed()) {
            return existing;
        }
        const data = JSON.parse(resource.query);
        const session = this._chatEditingService.getEditingSession(URI.revive(data.session));
        if (!session || !data.requestId) {
            return null;
        }
        return session.getSnapshotModel(data.requestId, data.undoStop || undefined, resource);
    }
};
ChatEditingSnapshotTextModelContentProvider = __decorate([
    __param(1, IModelService)
], ChatEditingSnapshotTextModelContentProvider);
export { ChatEditingSnapshotTextModelContentProvider };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdUZXh0TW9kZWxDb250ZW50UHJvdmlkZXJzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0RWRpdGluZy9jaGF0RWRpdGluZ1RleHRNb2RlbENvbnRlbnRQcm92aWRlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLG1DQUFtQyxDQUFDO0FBRXZFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQU14RSxJQUFNLG1DQUFtQyxHQUF6QyxNQUFNLG1DQUFtQzs7YUFDeEIsV0FBTSxHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsQUFBM0IsQ0FBNEI7SUFFbEQsTUFBTSxDQUFDLFVBQVUsQ0FBQyxtQkFBd0IsRUFBRSxVQUFrQixFQUFFLElBQVk7UUFDbEYsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDO1lBQ2YsTUFBTSxFQUFFLHFDQUFtQyxDQUFDLE1BQU07WUFDbEQsSUFBSTtZQUNKLEtBQUssRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsbUJBQW1CLEVBQWlELENBQUM7U0FDdEgsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELFlBQ2tCLG1CQUF3QyxFQUN6QixhQUE0QjtRQUQzQyx3QkFBbUIsR0FBbkIsbUJBQW1CLENBQXFCO1FBQ3pCLGtCQUFhLEdBQWIsYUFBYSxDQUFlO0lBQ3pELENBQUM7SUFFTCxLQUFLLENBQUMsa0JBQWtCLENBQUMsUUFBYTtRQUNyQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENB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