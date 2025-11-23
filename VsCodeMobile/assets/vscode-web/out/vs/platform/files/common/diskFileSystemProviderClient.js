/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { VSBuffer } from '../../../base/common/buffer.js';
import { toErrorMessage } from '../../../base/common/errorMessage.js';
import { canceled } from '../../../base/common/errors.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { newWriteableStream } from '../../../base/common/stream.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { createFileSystemProviderError, FileSystemProviderErrorCode } from './files.js';
import { reviveFileChanges } from './watcher.js';
export const LOCAL_FILE_SYSTEM_CHANNEL_NAME = 'localFilesystem';
/**
 * An implementation of a local disk file system provider
 * that is backed by a `IChannel` and thus implemented via
 * IPC on a different process.
 */
export class DiskFileSystemProviderClient extends Disposable {
    constructor(channel, extraCapabilities) {
        super();
        this.channel = channel;
        this.extraCapabilities = extraCapabilities;
        //#region File Capabilities
        this.onDidChangeCapabilities = Event.None;
        //#endregion
        //#region File Watching
        this._onDidChange = this._register(new Emitter());
        this.onDidChangeFile = this._onDidChange.event;
        this._onDidWatchError = this._register(new Emitter());
        this.onDidWatchError = this._onDidWatchError.event;
        // The contract for file watching via remote is to identify us
        // via a unique but readonly session ID. Since the remote is
        // managing potentially many watchers from different clients,
        // this helps the server to properly partition events to the right
        // clients.
        this.sessionId = generateUuid();
        this.registerFileChangeListeners();
    }
    get capabilities() {
        if (!this._capabilities) {
            this._capabilities =
                2 /* FileSystemProviderCapabilities.FileReadWrite */ |
                    4 /* FileSystemProviderCapabilities.FileOpenReadWriteClose */ |
                    16 /* FileSystemProviderCapabilities.FileReadStream */ |
                    8 /* FileSystemProviderCapabilities.FileFolderCopy */ |
                    8192 /* FileSystemProviderCapabilities.FileWriteUnlock */ |
                    16384 /* FileSystemProviderCapabilities.FileAtomicRead */ |
                    32768 /* FileSystemProviderCapabilities.FileAtomicWrite */ |
                    65536 /* FileSystemProviderCapabilities.FileAtomicDelete */ |
                    131072 /* FileSystemProviderCapabilities.FileClone */ |
                    262144 /* FileSystemProviderCapabilities.FileRealpath */;
            if (this.extraCapabilities.pathCaseSensitive) {
                this._capabilities |= 1024 /* FileSystemProviderCapabilities.PathCaseSensitive */;
            }
            if (this.extraCapabilities.trash) {
                this._capabilities |= 4096 /* FileSystemProviderCapabilities.Trash */;
            }
        }
        return this._capabilities;
    }
    //#endregion
    //#region File Metadata Resolving
    stat(resource) {
        return this.channel.call('stat', [resource]);
    }
    realpath(resource) {
        return this.channel.call('realpath', [resource]);
    }
    readdir(resource) {
        return this.channel.call('readdir', [resource]);
    }
    //#endregion
    //#region File Reading/Writing
    async readFile(resource, opts) {
        const { buffer } = await this.channel.call('readFile', [resource, opts]);
        return buffer;
    }
    readFileStream(resource, opts, token) {
        const stream = newWriteableStream(data => VSBuffer.concat(data.map(data => VSBuffer.wrap(data))).buffer);
        const disposables = new DisposableStore();
        // Reading as file stream goes through an event to the remote side
        disposables.add(this.channel.listen('readFileStream', [resource, opts])(dataOrErrorOrEnd => {
            // data
            if (dataOrErrorOrEnd instanceof VSBuffer) {
                stream.write(dataOrErrorOrEnd.buffer);
            }
            // end or error
            else {
                if (dataOrErrorOrEnd === 'end') {
                    stream.end();
                }
                else {
                    let error;
                    // Take Error as is if type matches
                    if (dataOrErrorOrEnd instanceof Error) {
                        error = dataOrErrorOrEnd;
                    }
                    // Otherwise, try to deserialize into an error.
                    // Since we communicate via IPC, we cannot be sure
                    // that Error objects are properly serialized.
                    else {
                        const errorCandidate = dataOrErrorOrEnd;
                        error = createFileSystemProviderError(errorCandidate.message ?? toErrorMessage(errorCandidate), errorCandidate.code ?? FileSystemProviderErrorCode.Unknown);
                    }
                    stream.error(error);
                    stream.end();
                }
                // Signal to the remote side that we no longer listen
                disposables.dispose();
            }
        }));
        // Support cancellation
        disposables.add(token.onCancellationRequested(() => {
            // Ensure to end the stream properly with an error
            // to indicate the cancellation.
            stream.error(canceled());
            stream.end();
            // Ensure to dispose the listener upon cancellation. This will
            // bubble through the remote side as event and allows to stop
            // reading the file.
            disposables.dispose();
        }));
        return stream;
    }
    writeFile(resource, content, opts) {
        return this.channel.call('writeFile', [resource, VSBuffer.wrap(content), opts]);
    }
    open(resource, opts) {
        return this.channel.call('open', [resource, opts]);
    }
    close(fd) {
        return this.channel.call('close', [fd]);
    }
    async read(fd, pos, data, offset, length) {
        const [bytes, bytesRead] = await this.channel.call('read', [fd, pos, length]);
        // copy back the data that was written into the buffer on the remote
        // side. we need to do this because buffers are not referenced by
        // pointer, but only by value and as such cannot be directly written
        // to from the other process.
        data.set(bytes.buffer.slice(0, bytesRead), offset);
        return bytesRead;
    }
    write(fd, pos, data, offset, length) {
        return this.channel.call('write', [fd, pos, VSBuffer.wrap(data), offset, length]);
    }
    //#endregion
    //#region Move/Copy/Delete/Create Folder
    mkdir(resource) {
        return this.channel.call('mkdir', [resource]);
    }
    delete(resource, opts) {
        return this.channel.call('delete', [resource, opts]);
    }
    rename(resource, target, opts) {
        return this.channel.call('rename', [resource, target, opts]);
    }
    copy(resource, target, opts) {
        return this.channel.call('copy', [resource, target, opts]);
    }
    //#endregion
    //#region Clone File
    cloneFile(resource, target) {
        return this.channel.call('cloneFile', [resource, target]);
    }
    registerFileChangeListeners() {
        // The contract for file changes is that there is one listener
        // for both events and errors from the watcher. So we need to
        // unwrap the event from the remote and emit through the proper
        // emitter.
        this._register(this.channel.listen('fileChange', [this.sessionId])(eventsOrError => {
            if (Array.isArray(eventsOrError)) {
                const events = eventsOrError;
                this._onDidChange.fire(reviveFileChanges(events));
            }
            else {
                const error = eventsOrError;
                this._onDidWatchError.fire(error);
            }
        }));
    }
    watch(resource, opts) {
        // Generate a request UUID to correlate the watcher
        // back to us when we ask to dispose the watcher later.
        const req = generateUuid();
        this.channel.call('watch', [this.sessionId, req, resource, opts]);
        return toDisposable(() => this.channel.call('unwatch', [this.sessionId, req]));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlza0ZpbGVTeXN0ZW1Qcm92aWRlckNsaWVudC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9maWxlcy9jb21tb24vZGlza0ZpbGVTeXN0ZW1Qcm92aWRlckNsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFMUQsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzNHLE9BQU8sRUFBRSxrQkFBa0IsRUFBb0QsTUFBTSxnQ0FBZ0MsQ0FBQztBQUV0SCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFFNUQsT0FBTyxFQUFFLDZCQUE2QixFQUErSSwyQkFBMkIsRUFBZ1ksTUFBTSxZQUFZLENBQUM7QUFDbm1CLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUVqRCxNQUFNLENBQUMsTUFBTSw4QkFBOEIsR0FBRyxpQkFBaUIsQ0FBQztBQUVoRTs7OztHQUlHO0FBQ0gsTUFBTSxPQUFPLDRCQUE2QixTQUFRLFVBQVU7SUFRM0QsWUFDa0IsT0FBaUIsRUFDakIsaUJBQW1FO1FBRXBGLEtBQUssRUFBRSxDQUFDO1FBSFMsWUFBTyxHQUFQLE9BQU8sQ0FBVTtRQUNqQixzQkFBaUIsR0FBakIsaUJBQWlCLENBQWtEO1FBT3JGLDJCQUEyQjtRQUVsQiw0QkFBdUIsR0FBZ0IsS0FBSyxDQUFDLElBQUksQ0FBQztRQTBL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