/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { insert } from '../../../base/common/arrays.js';
import { ThrottledDelayer } from '../../../base/common/async.js';
import { onUnexpectedError } from '../../../base/common/errors.js';
import { Emitter } from '../../../base/common/event.js';
import { removeTrailingPathSeparator } from '../../../base/common/extpath.js';
import { Disposable, toDisposable } from '../../../base/common/lifecycle.js';
import { normalize } from '../../../base/common/path.js';
import { isRecursiveWatchRequest, reviveFileChanges } from './watcher.js';
import { LogLevel } from '../../log/common/log.js';
export class AbstractDiskFileSystemProvider extends Disposable {
    constructor(logService, options) {
        super();
        this.logService = logService;
        this.options = options;
        this._onDidChangeFile = this._register(new Emitter());
        this.onDidChangeFile = this._onDidChangeFile.event;
        this._onDidWatchError = this._register(new Emitter());
        this.onDidWatchError = this._onDidWatchError.event;
        this.universalWatchRequests = [];
        this.universalWatchRequestDelayer = this._register(new ThrottledDelayer(this.getRefreshWatchersDelay(this.universalWatchRequests.length)));
        this.nonRecursiveWatchRequests = [];
        this.nonRecursiveWatchRequestDelayer = this._register(new ThrottledDelayer(this.getRefreshWatchersDelay(this.nonRecursiveWatchRequests.length)));
    }
    watch(resource, opts) {
        if (opts.recursive || this.options?.watcher?.forceUniversal) {
            return this.watchUniversal(resource, opts);
        }
        return this.watchNonRecursive(resource, opts);
    }
    getRefreshWatchersDelay(count) {
        if (count > 200) {
            // If there are many requests to refresh, start to throttle
            // the refresh to reduce pressure. We see potentially thousands
            // of requests coming in on startup repeatedly so we take it easy.
            return 500;
        }
        // By default, use a short delay to keep watchers updating fast but still
        // with a delay so that we can efficiently deduplicate requests or reuse
        // existing watchers.
        return 0;
    }
    watchUniversal(resource, opts) {
        const request = this.toWatchRequest(resource, opts);
        const remove = insert(this.universalWatchRequests, request);
        // Trigger update
        this.refreshUniversalWatchers();
        return toDisposable(() => {
            // Remove from list of paths to watch universally
            remove();
            // Trigger update
            this.refreshUniversalWatchers();
        });
    }
    toWatchRequest(resource, opts) {
        const request = {
            path: this.toWatchPath(resource),
            excludes: opts.excludes,
            includes: opts.includes,
            recursive: opts.recursive,
            filter: opts.filter,
            correlationId: opts.correlationId
        };
        if (isRecursiveWatchRequest(request)) {
            // Adjust for polling
            const usePolling = this.options?.watcher?.recursive?.usePolling;
            if (usePolling === true) {
                request.pollingInterval = this.options?.watcher?.recursive?.pollingInterval ?? 5000;
            }
            else if (Array.isArray(usePolling)) {
                if (usePolling.includes(request.path)) {
                    request.pollingInterval = this.options?.watcher?.recursive?.pollingInterval ?? 5000;
                }
            }
        }
        return request;
    }
    refreshUniversalWatchers() {
        this.universalWatchRequestDelayer.trigger(() => {
            return this.doRefreshUniversalWatchers();
        }, this.getRefreshWatchersDelay(this.universalWatchRequests.length)).catch(error => onUnexpectedError(error));
    }
    doRefreshUniversalWatchers() {
        // Create watcher if this is the first time
        if (!this.universalWatcher) {
            this.universalWatcher = this._register(this.createUniversalWatcher(changes => this._onDidChangeFile.fire(reviveFileChanges(changes)), msg => this.onWatcherLogMessage(msg), this.logService.getLevel() === LogLevel.Trace));
            // Apply log levels dynamically
            this._register(this.logService.onDidChangeLogLevel(() => {
                this.universalWatcher?.setVerboseLogging(this.logService.getLevel() === LogLevel.Trace);
            }));
        }
        // Ask to watch the provided paths
        return this.universalWatcher.watch(this.universalWatchRequests);
    }
    watchNonRecursive(resource, opts) {
        // Add to list of paths to watch non-recursively
        const request = {
            path: this.toWatchPath(resource),
            excludes: opts.excludes,
            includes: opts.includes,
            recursive: false,
            filter: opts.filter,
            correlationId: opts.correlationId
        };
        const remove = insert(this.nonRecursiveWatchRequests, request);
        // Trigger update
        this.refreshNonRecursiveWatchers();
        return toDisposable(() => {
            // Remove from list of paths to watch non-recursively
            remove();
            // Trigger update
            this.refreshNonRecursiveWatchers();
        });
    }
    refreshNonRecursiveWatchers() {
        this.nonRecursiveWatchRequestDelayer.trigger(() => {
            return this.doRefreshNonRecursiveWatchers();
        }, this.getRefreshWatchersDelay(this.nonRecursiveWatchRequests.length)).catch(error => onUnexpectedError(error));
    }
    doRefreshNonRecursiveWatchers() {
        // Create watcher if this is the first time
        if (!this.nonRecursiveWatcher) {
            this.nonRecursiveWatcher = this._register(this.createNonRecursiveWatcher(changes => this._onDidChangeFile.fire(reviveFileChanges(changes)), msg => this.onWatcherLogMessage(msg), this.logService.getLevel() === LogLevel.Trace));
            // Apply log levels dynamically
            this._register(this.logService.onDidChangeLogLevel(() => {
                this.nonRecursiveWatcher?.setVerboseLogging(this.logService.getLevel() === LogLevel.Trace);
            }));
        }
        // Ask to watch the provided paths
        return this.nonRecursiveWatcher.watch(this.nonRecursiveWatchRequests);
    }
    //#endregion
    onWatcherLogMessage(msg) {
        if (msg.type === 'error') {
            this._onDidWatchError.fire(msg.message);
        }
        this.logWatcherMessage(msg);
    }
    logWatcherMessage(msg) {
        this.logService[msg.type](msg.message);
    }
    toFilePath(resource) {
        return normalize(resource.fsPath);
    }
    toWatchPath(resource) {
        const filePath = this.toFilePath(resource);
        // Ensure to have any trailing path separators removed, otherwise
        // we may believe the path is not "real" and will convert every
        // event back to this form, which is not warranted.
        // See also https://github.com/microsoft/vscode/issues/210517
        return removeTrailingPathSeparator(filePath);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlza0ZpbGVTeXN0ZW1Qcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9maWxlcy9jb21tb24vZGlza0ZpbGVTeXN0ZW1Qcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDeEQsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDakUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDbkUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxVQUFVLEVBQWUsWUFBWSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDMUYsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBR3pELE9BQU8sRUFBdUksdUJBQXVCLEVBQTBCLGlCQUFpQixFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ3ZPLE9BQU8sRUFBZSxRQUFRLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQXdCaEUsTUFBTSxPQUFnQiw4QkFBK0IsU0FBUSxVQUFVO0lBS3RFLFlBQ29CLFVBQXVCLEVBQ3pCLE9BQXdDO1FBRXpELEtBQUssRUFBRSxDQUFDO1FBSFcsZUFBVSxHQUFWLFVBQVUsQ0FBYTtRQUN6QixZQUFPLEdBQVAsT0FBTyxDQUFpQztRQUt2QyxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUEwQixDQUFDLENBQUM7UUFDbkYsb0JBQWUsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDO1FBRXBDLHFCQUFnQixHQUFHLElBQUksQ0FBQyxTQUFTLENB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