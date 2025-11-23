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
import { decodeBase64, VSBuffer } from '../../../../base/common/buffer.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { newWriteableStream } from '../../../../base/common/stream.js';
import { createFileSystemProviderError, FileSystemProviderErrorCode, FileType, IFileService } from '../../../../platform/files/common/files.js';
import { ChatResponseResource } from './chatModel.js';
import { IChatService, IChatToolInvocation } from './chatService.js';
import { LocalChatSessionUri } from './chatUri.js';
import { isToolResultInputOutputDetails } from './languageModelToolsService.js';
let ChatResponseResourceFileSystemProvider = class ChatResponseResourceFileSystemProvider extends Disposable {
    static { this.ID = 'workbench.contrib.chatResponseResourceFileSystemProvider'; }
    constructor(chatService, _fileService) {
        super();
        this.chatService = chatService;
        this._fileService = _fileService;
        this.onDidChangeCapabilities = Event.None;
        this.onDidChangeFile = Event.None;
        this.capabilities = 0 /* FileSystemProviderCapabilities.None */
            | 2048 /* FileSystemProviderCapabilities.Readonly */
            | 1024 /* FileSystemProviderCapabilities.PathCaseSensitive */
            | 16 /* FileSystemProviderCapabilities.FileReadStream */
            | 16384 /* FileSystemProviderCapabilities.FileAtomicRead */
            | 2 /* FileSystemProviderCapabilities.FileReadWrite */;
        this._register(this._fileService.registerProvider(ChatResponseResource.scheme, this));
    }
    readFile(resource) {
        return Promise.resolve(this.lookupURI(resource));
    }
    readFileStream(resource) {
        const stream = newWriteableStream(data => VSBuffer.concat(data.map(data => VSBuffer.wrap(data))).buffer);
        Promise.resolve(this.lookupURI(resource)).then(v => stream.end(v));
        return stream;
    }
    async stat(resource) {
        const r = await this.lookupURI(resource);
        return {
            type: FileType.File,
            ctime: 0,
            mtime: 0,
            size: r.length,
        };
    }
    delete() {
        throw createFileSystemProviderError('fs is readonly', FileSystemProviderErrorCode.NoPermissions);
    }
    watch() {
        return Disposable.None;
    }
    mkdir() {
        throw createFileSystemProviderError('fs is readonly', FileSystemProviderErrorCode.NoPermissions);
    }
    readdir() {
        return Promise.resolve([]);
    }
    rename() {
        throw createFileSystemProviderError('fs is readonly', FileSystemProviderErrorCode.NoPermissions);
    }
    writeFile() {
        throw createFileSystemProviderError('fs is readonly', FileSystemProviderErrorCode.NoPermissions);
    }
    findMatchingInvocation(uri) {
        const parsed = ChatResponseResource.parseUri(uri);
        if (!parsed) {
            throw createFileSystemProviderError(`File not found`, FileSystemProviderErrorCode.FileNotFound);
        }
        const { sessionId, toolCallId, index } = parsed;
        const session = this.chatService.getSession(LocalChatSessionUri.forSession(sessionId));
        if (!session) {
            throw createFileSystemProviderError(`File not found`, FileSystemProviderErrorCode.FileNotFound);
        }
        const requests = session.getRequests();
        for (let k = requests.length - 1; k >= 0; k--) {
            const req = requests[k];
            const tc = req.response?.entireResponse.value.find((r) => (r.kind === 'toolInvocation' || r.kind === 'toolInvocationSerialized') && r.toolCallId === toolCallId);
            if (tc) {
                return { result: tc, index };
            }
        }
        throw createFileSystemProviderError(`File not found`, FileSystemProviderErrorCode.FileNotFound);
    }
    lookupURI(uri) {
        const { result, index } = this.findMatchingInvocation(uri);
        const details = IChatToolInvocation.resultDetails(result);
        if (!isToolResultInputOutputDetails(details)) {
            throw createFileSystemProviderError(`Tool does not have I/O`, FileSystemProviderErrorCode.FileNotFound);
        }
        const part = details.output.at(index);
        if (!part) {
            throw createFileSystemProviderError(`Tool does not have part`, FileSystemProviderErrorCode.FileNotFound);
        }
        if (part.type === 'ref') {
            return this._fileService.readFile(part.uri).then(r => r.value.buffer);
        }
        return part.isText ? new TextEncoder().encode(part.value) : decodeBase64(part.value).buffer;
    }
};
ChatResponseResourceFileSystemProvider = __decorate([
    __param(0, IChatService),
    __param(1, IFileService)
], ChatResponseResourceFileSystemProvider);
export { ChatResponseResourceFileSystemProvider };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFJlc3BvbnNlUmVzb3VyY2VGaWxlU3lzdGVtUHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vY2hhdFJlc3BvbnNlUmVzb3VyY2VGaWxlU3lzdGVtUHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFlBQVksRUFBRSxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekQsT0FBTyxFQUFFLFVBQVUsRUFBZSxNQUFNLHNDQUFzQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxrQkFBa0IsRUFBd0IsTUFBTSxtQ0FBbUMsQ0FBQztBQUU3RixPQUFPLEVBQUUsNkJBQTZCLEVBQWtDLDJCQUEyQixFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQTJKLE1BQU0sNENBQTRDLENBQUM7QUFFelUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDdEQsT0FBTyxFQUFFLFlBQVksRUFBRSxtQkFBbUIsRUFBaUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNwRyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFDbkQsT0FBTyxFQUFFLDhCQUE4QixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFekUsSUFBTSxzQ0FBc0MsR0FBNUMsTUFBTSxzQ0FBdUMsU0FBUSxVQUFVO2FBTTlDLE9BQUUsR0FBRywwREFBMEQsQUFBN0QsQ0FBOEQ7SUFZdkYsWUFDZSxXQUEwQyxFQUMxQyxZQUEyQztRQUV6RCxLQUFLLEVBQUUsQ0FBQztRQUh1QixnQkFBVyxHQUFYLFdBQVcsQ0FBYztRQUN6QixpQkFBWSxHQUFaLFlBQVksQ0FBYztRQVoxQyw0QkFBdUIsR0FB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