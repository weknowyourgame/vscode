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
import { URI } from '../../../../base/common/uri.js';
import { Emitter } from '../../../../base/common/event.js';
import { basename } from '../../../../base/common/resources.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { isPromptFileVariableEntry } from '../common/chatVariableEntries.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ISharedWebContentExtractorService } from '../../../../platform/webContentExtractor/common/webContentExtractor.js';
import { Schemas } from '../../../../base/common/network.js';
import { IChatAttachmentResolveService } from './chatAttachmentResolveService.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { equals } from '../../../../base/common/objects.js';
import { Iterable } from '../../../../base/common/iterator.js';
let ChatAttachmentModel = class ChatAttachmentModel extends Disposable {
    constructor(fileService, webContentExtractorService, chatAttachmentResolveService) {
        super();
        this.fileService = fileService;
        this.webContentExtractorService = webContentExtractorService;
        this.chatAttachmentResolveService = chatAttachmentResolveService;
        this._attachments = new Map();
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
    }
    get attachments() {
        return Array.from(this._attachments.values());
    }
    get size() {
        return this._attachments.size;
    }
    get fileAttachments() {
        return this.attachments.filter(file => file.kind === 'file' && URI.isUri(file.value))
            .map(file => file.value);
    }
    getAttachmentIDs() {
        return new Set(this._attachments.keys());
    }
    async addFile(uri, range) {
        if (/\.(png|jpe?g|gif|bmp|webp)$/i.test(uri.path)) {
            const context = await this.asImageVariableEntry(uri);
            if (context) {
                this.addContext(context);
            }
            return;
        }
        else {
            this.addContext(this.asFileVariableEntry(uri, range));
        }
    }
    addFolder(uri) {
        this.addContext({
            kind: 'directory',
            value: uri,
            id: uri.toString(),
            name: basename(uri),
        });
    }
    clear(clearStickyAttachments = false) {
        if (clearStickyAttachments) {
            const deleted = Array.from(this._attachments.keys());
            this._attachments.clear();
            this._onDidChange.fire({ deleted, added: [], updated: [] });
        }
        else {
            const deleted = [];
            const allIds = Array.from(this._attachments.keys());
            for (const id of allIds) {
                const entry = this._attachments.get(id);
                if (entry && !isPromptFileVariableEntry(entry)) {
                    this._attachments.delete(id);
                    deleted.push(id);
                }
            }
            this._onDidChange.fire({ deleted, added: [], updated: [] });
        }
    }
    addContext(...attachments) {
        attachments = attachments.filter(attachment => !this._attachments.has(attachment.id));
        this.updateContext(Iterable.empty(), attachments);
    }
    clearAndSetContext(...attachments) {
        this.updateContext(Array.from(this._attachments.keys()), attachments);
    }
    delete(...variableEntryIds) {
        this.updateContext(variableEntryIds, Iterable.empty());
    }
    updateContext(toDelete, upsert) {
        const deleted = [];
        const added = [];
        const updated = [];
        for (const id of toDelete) {
            const item = this._attachments.get(id);
            if (item) {
                this._attachments.delete(id);
                deleted.push(id);
            }
        }
        for (const item of upsert) {
            const oldItem = this._attachments.get(item.id);
            if (!oldItem) {
                this._attachments.set(item.id, item);
                added.push(item);
            }
            else if (!equals(oldItem, item)) {
                this._attachments.set(item.id, item);
                updated.push(item);
            }
        }
        if (deleted.length > 0 || added.length > 0 || updated.length > 0) {
            this._onDidChange.fire({ deleted, added, updated });
        }
    }
    // ---- create utils
    asFileVariableEntry(uri, range) {
        return {
            kind: 'file',
            value: range ? { uri, range } : uri,
            id: uri.toString() + (range?.toString() ?? ''),
            name: basename(uri),
        };
    }
    // Gets an image variable for a given URI, which may be a file or a web URL
    async asImageVariableEntry(uri) {
        if (uri.scheme === Schemas.file && await this.fileService.canHandleResource(uri)) {
            return await this.chatAttachmentResolveService.resolveImageEditorAttachContext(uri);
        }
        else if (uri.scheme === Schemas.http || uri.scheme === Schemas.https) {
            const extractedImages = await this.webContentExtractorService.readImage(uri, CancellationToken.None);
            if (extractedImages) {
                return await this.chatAttachmentResolveService.resolveImageEditorAttachContext(uri, extractedImages);
            }
        }
        return undefined;
    }
};
ChatAttachmentModel = __decorate([
    __param(0, IFileService),
    __param(1, ISharedWebContentExtractorService),
    __param(2, IChatAttachmentResolveService)
], ChatAttachmentModel);
export { ChatAttachmentModel };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEF0dGFjaG1lbnRNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEF0dGFjaG1lbnRNb2RlbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUVoRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFvRCx5QkFBeUIsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQy9ILE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsaUNBQWlDLEVBQUUsTUFBTSx3RUFBd0UsQ0FBQztBQUMzSCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDbEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDNUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQVF4RCxJQUFNLG1CQUFtQixHQUF6QixNQUFNLG1CQUFvQixTQUFRLFVBQVU7SUFPbEQsWUFDZSxXQUEwQyxFQUNyQiwwQkFBOEUsRUFDbEYsNEJBQTRFO1FBRTNHLEtBQUssRUFBRSxDQUFDO1FBSnVCLGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBQ0osK0JBQTBCLEdBQTFCLDBCQUEwQixDQUFt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