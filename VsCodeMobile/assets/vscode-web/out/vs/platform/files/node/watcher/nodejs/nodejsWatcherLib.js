/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { watch, promises } from 'fs';
import { RunOnceWorker, ThrottledWorker } from '../../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { isEqual, isEqualOrParent } from '../../../../../base/common/extpath.js';
import { Disposable, DisposableStore, thenRegisterOrDispose, toDisposable } from '../../../../../base/common/lifecycle.js';
import { normalizeNFC } from '../../../../../base/common/normalization.js';
import { basename, dirname, join } from '../../../../../base/common/path.js';
import { isLinux, isMacintosh } from '../../../../../base/common/platform.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { Promises } from '../../../../../base/node/pfs.js';
import { coalesceEvents, parseWatcherPatterns, isFiltered, isWatchRequestWithCorrelation } from '../../../common/watcher.js';
import { Lazy } from '../../../../../base/common/lazy.js';
export class NodeJSFileWatcherLibrary extends Disposable {
    // A delay in reacting to file deletes to support
    // atomic save operations where a tool may chose
    // to delete a file before creating it again for
    // an update.
    static { this.FILE_DELETE_HANDLER_DELAY = 100; }
    // A delay for collecting file changes from node.js
    // before collecting them for coalescing and emitting
    // Same delay as used for the recursive watcher.
    static { this.FILE_CHANGES_HANDLER_DELAY = 75; }
    get isReusingRecursiveWatcher() { return this._isReusingRecursiveWatcher; }
    get failed() { return this.didFail; }
    constructor(request, recursiveWatcher, onDidFilesChange, onDidWatchFail, onLogMessage, verboseLogging) {
        super();
        this.request = request;
        this.recursiveWatcher = recursiveWatcher;
        this.onDidFilesChange = onDidFilesChange;
        this.onDidWatchFail = onDidWatchFail;
        this.onLogMessage = onLogMessage;
        this.verboseLogging = verboseLogging;
        // Reduce likelyhood of spam from file events via throttling.
        // These numbers are a bit more aggressive compared to the
        // recursive watcher because we can have many individual
        // node.js watchers per request.
        // (https://github.com/microsoft/vscode/issues/124723)
        this.throttledFileChangesEmitter = this._register(new ThrottledWorker({
            maxWorkChunkSize: 100, // only process up to 100 changes at once before...
            throttleDelay: 200, // ...resting for 200ms until we process events again...
            maxBufferedWork: 10000 // ...but never buffering more than 10000 events in memory
        }, events => this.onDidFilesChange(events)));
        // Aggregate file changes over FILE_CHANGES_HANDLER_DELAY
        // to coalesce events and reduce spam.
        this.fileChangesAggregator = this._register(new RunOnceWorker(events => this.handleFileChanges(events), NodeJSFileWatcherLibrary.FILE_CHANGES_HANDLER_DELAY));
        this.cts = new CancellationTokenSource();
        this.realPath = new Lazy(async () => {
            // This property is intentionally `Lazy` and not using `realcase()` as the counterpart
            // in the recursive watcher because of the amount of paths this watcher is dealing with.
            // We try as much as possible to avoid even needing `realpath()` if we can because even
            // that method does an `lstat()` per segment of the path.
            let result = this.request.path;
            try {
                result = await Promises.realpath(this.request.path);
                if (this.request.path !== result) {
                    this.trace(`correcting a path to watch that seems to be a symbolic link (original: ${this.request.path}, real: ${result})`);
                }
            }
            catch (error) {
                // ignore
            }
            return result;
        });
        this._isReusingRecursiveWatcher = false;
        this.didFail = false;
        this.excludes = parseWatcherPatterns(this.request.path, this.request.excludes);
        this.includes = this.request.includes ? parseWatcherPatterns(this.request.path, this.request.includes) : undefined;
        this.filter = isWatchRequestWithCorrelation(this.request) ? this.request.filter : undefined; // filtering is only enabled when correlating because watchers are otherwise potentially reused
        this.ready = this.watch();
    }
    async watch() {
        try {
            const stat = await promises.stat(this.request.path);
            if (this.cts.token.isCancellationRequested) {
                return;
            }
            this._register(await this.doWatch(stat.isDirectory()));
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                this.error(error);
            }
            else {
                this.trace(`ignoring a path for watching who's stat info failed to resolve: ${this.request.path} (error: ${error})`);
            }
            this.notifyWatchFailed();
        }
    }
    notifyWatchFailed() {
        this.didFail = true;
        this.onDidWatchFail?.();
    }
    async doWatch(isDirectory) {
        const disposables = new DisposableStore();
        if (this.doWatchWithExistingWatcher(isDirectory, disposables)) {
            this.trace(`reusing an existing recursive watcher for ${this.request.path}`);
            this._isReusingRecursiveWatcher = true;
        }
        else {
            this._isReusingRecursiveWatcher = false;
            await this.doWatchWithNodeJS(isDirectory, disposables);
        }
        return disposables;
    }
    doWatchWithExistingWatcher(isDirectory, disposables) {
        if (isDirectory) {
            // Recursive watcher re-use is currently not enabled for when
            // folders are watched. this is because the dispatching in the
            // recursive watcher for non-recurive requests is optimized for
            // file changes  where we really only match on the exact path
            // and not child paths.
            return false;
        }
        const resource = URI.file(this.request.path);
        const subscription = this.recursiveWatcher?.subscribe(this.request.path, async (error, change) => {
            if (disposables.isDisposed) {
                return; // return early if already disposed
            }
            if (error) {
                await thenRegisterOrDispose(this.doWatch(isDirectory), disposables);
            }
            else if (change) {
                if (typeof change.cId === 'number' || typeof this.request.correlationId === 'number') {
                    // Re-emit this change with the correlation id of the request
                    // so that the client can correlate the event with the request
                    // properly. Without correlation, we do not have to do that
                    // because the event will appear on the global listener already.
                    this.onFileChange({ resource, type: change.type, cId: this.request.correlationId }, true /* skip excludes/includes (file is explicitly watched) */);
                }
            }
        });
        if (subscription) {
            disposables.add(subscription);
            return true;
        }
        return false;
    }
    async doWatchWithNodeJS(isDirectory, disposables) {
        const realPath = await this.realPath.value;
        if (this.cts.token.isCancellationRequested) {
            return;
        }
        // macOS: watching samba shares can crash VSCode so we do
        // a simple check for the file path pointing to /Volumes
        // (https://github.com/microsoft/vscode/issues/106879)
        // TODO@electron this needs a revisit when the crash is
        // fixed or mitigated upstream.
        if (isMacintosh && isEqualOrParent(realPath, '/Volumes/', true)) {
            this.error(`Refusing to watch ${realPath} for changes using fs.watch() for possibly being a network share where watching is unreliable and unstable.`);
            return;
        }
        const cts = new CancellationTokenSource(this.cts.token);
        disposables.add(toDisposable(() => cts.dispose(true)));
        const watcherDisposables = new DisposableStore(); // we need a separate disposable store because we re-create the watcher from within in some cases
        disposables.add(watcherDisposables);
        try {
            const requestResource = URI.file(this.request.path);
            const pathBasename = basename(realPath);
            // Creating watcher can fail with an exception
            const watcher = watch(realPath);
            watcherDisposables.add(toDisposable(() => {
                watcher.removeAllListeners();
                watcher.close();
            }));
            this.trace(`Started watching: '${realPath}'`);
            // Folder: resolve children to emit proper events
            const folderChildren = new Set();
            if (isDirectory) {
                try {
                    for (const child of await Promises.readdir(realPath)) {
                        folderChildren.add(child);
                    }
                }
                catch (error) {
                    this.error(error);
                }
            }
            if (cts.token.isCancellationRequested) {
                return;
            }
            const mapPathToStatDisposable = new Map();
            watcherDisposables.add(toDisposable(() => {
                for (const [, disposable] of mapPathToStatDisposable) {
                    disposable.dispose();
                }
                mapPathToStatDisposable.clear();
            }));
            watcher.on('error', (code, signal) => {
                if (cts.token.isCancellationRequested) {
                    return;
                }
                this.error(`Failed to watch ${realPath} for changes using fs.watch() (${code}, ${signal})`);
                this.notifyWatchFailed();
            });
            watcher.on('change', (type, raw) => {
                if (cts.token.isCancellationRequested) {
                    return; // ignore if already disposed
                }
                if (this.verboseLogging) {
                    this.traceWithCorrelation(`[raw] ["${type}"] ${raw}`);
                }
                // Normalize file name
                let changedFileName = '';
                if (raw) { // https://github.com/microsoft/vscode/issues/38191
                    changedFileName = raw.toString();
                    if (isMacintosh) {
                        // Mac: uses NFD unicode form on disk, but we want NFC
                        // See also https://github.com/nodejs/node/issues/2165
                        changedFileName = normalizeNFC(changedFileName);
                    }
                }
                if (!changedFileName || (type !== 'change' && type !== 'rename')) {
                    return; // ignore unexpected events
                }
                // Folder
                if (isDirectory) {
                    // Folder child added/deleted
                    if (type === 'rename') {
                        // Cancel any previous stats for this file if existing
                        mapPathToStatDisposable.get(changedFileName)?.dispose();
                        // Wait a bit and try see if the file still exists on disk
                        // to decide on the resulting event
                        const timeoutHandle = setTimeout(async () => {
                            mapPathToStatDisposable.delete(changedFileName);
                            // Depending on the OS the watcher runs on, there
                            // is different behaviour for when the watched
                            // folder path is being deleted:
                            //
                            // -   macOS: not reported but events continue to
                            //            work even when the folder is brought
                            //            back, though it seems every change
                            //            to a file is reported as "rename"
                            // -   Linux: "rename" event is reported with the
                            //            name of the folder and events stop
                            //            working
                            // - Windows: an EPERM error is thrown that we
                            //            handle from the `on('error')` event
                            //
                            // We do not re-attach the watcher after timeout
                            // though as we do for file watches because for
                            // file watching specifically we want to handle
                            // the atomic-write cases where the file is being
                            // deleted and recreated with different contents.
                            if (isEqual(changedFileName, pathBasename, !isLinux) && !await Promises.exists(realPath)) {
                                this.onWatchedPathDeleted(requestResource);
                                return;
                            }
                            if (cts.token.isCancellationRequested) {
                                return;
                            }
                            // In order to properly detect renames on a case-insensitive
                            // file system, we need to use `existsChildStrictCase` helper
                            // because otherwise we would wrongly assume a file exists
                            // when it was renamed to same name but different case.
                            const fileExists = await this.existsChildStrictCase(join(realPath, changedFileName));
                            if (cts.token.isCancellationRequested) {
                                return; // ignore if disposed by now
                            }
                            // Figure out the correct event type:
                            // File Exists: either 'added' or 'updated' if known before
                            // File Does not Exist: always 'deleted'
                            let type;
                            if (fileExists) {
                                if (folderChildren.has(changedFileName)) {
                                    type = 0 /* FileChangeType.UPDATED */;
                                }
                                else {
                                    type = 1 /* FileChangeType.ADDED */;
                                    folderChildren.add(changedFileName);
                                }
                            }
                            else {
                                folderChildren.delete(changedFileName);
                                type = 2 /* FileChangeType.DELETED */;
                            }
                            this.onFileChange({ resource: joinPath(requestResource, changedFileName), type, cId: this.request.correlationId });
                        }, NodeJSFileWatcherLibrary.FILE_DELETE_HANDLER_DELAY);
                        mapPathToStatDisposable.set(changedFileName, toDisposable(() => clearTimeout(timeoutHandle)));
                    }
                    // Folder child changed
                    else {
                        // Figure out the correct event type: if this is the
                        // first time we see this child, it can only be added
                        let type;
                        if (folderChildren.has(changedFileName)) {
                            type = 0 /* FileChangeType.UPDATED */;
                        }
                        else {
                            type = 1 /* FileChangeType.ADDED */;
                            folderChildren.add(changedFileName);
                        }
                        this.onFileChange({ resource: joinPath(requestResource, changedFileName), type, cId: this.request.correlationId });
                    }
                }
                // File
                else {
                    // File added/deleted
                    if (type === 'rename' || !isEqual(changedFileName, pathBasename, !isLinux)) {
                        // Depending on the OS the watcher runs on, there
                        // is different behaviour for when the watched
                        // file path is being deleted:
                        //
                        // -   macOS: "rename" event is reported and events
                        //            stop working
                        // -   Linux: "rename" event is reported and events
                        //            stop working
                        // - Windows: "rename" event is reported and events
                        //            continue to work when file is restored
                        //
                        // As opposed to folder watching, we re-attach the
                        // watcher after brief timeout to support "atomic save"
                        // operations where a tool may decide to delete a file
                        // and then create it with the updated contents.
                        //
                        // Different to folder watching, we emit a delete event
                        // though we never detect when the file is brought back
                        // because the watcher is disposed then.
                        const timeoutHandle = setTimeout(async () => {
                            const fileExists = await Promises.exists(realPath);
                            if (cts.token.isCancellationRequested) {
                                return; // ignore if disposed by now
                            }
                            // File still exists, so emit as change event and reapply the watcher
                            if (fileExists) {
                                this.onFileChange({ resource: requestResource, type: 0 /* FileChangeType.UPDATED */, cId: this.request.correlationId }, true /* skip excludes/includes (file is explicitly watched) */);
                                watcherDisposables.add(await this.doWatch(false));
                            }
                            // File seems to be really gone, so emit a deleted and failed event
                            else {
                                this.onWatchedPathDeleted(requestResource);
                            }
                        }, NodeJSFileWatcherLibrary.FILE_DELETE_HANDLER_DELAY);
                        // Very important to dispose the watcher which now points to a stale inode
                        // and wire in a new disposable that tracks our timeout that is installed
                        watcherDisposables.clear();
                        watcherDisposables.add(toDisposable(() => clearTimeout(timeoutHandle)));
                    }
                    // File changed
                    else {
                        this.onFileChange({ resource: requestResource, type: 0 /* FileChangeType.UPDATED */, cId: this.request.correlationId }, true /* skip excludes/includes (file is explicitly watched) */);
                    }
                }
            });
        }
        catch (error) {
            if (cts.token.isCancellationRequested) {
                return;
            }
            this.error(`Failed to watch ${realPath} for changes using fs.watch() (${error.toString()})`);
            this.notifyWatchFailed();
        }
    }
    onWatchedPathDeleted(resource) {
        this.warn('Watcher shutdown because watched path got deleted');
        // Emit events and flush in case the watcher gets disposed
        this.onFileChange({ resource, type: 2 /* FileChangeType.DELETED */, cId: this.request.correlationId }, true /* skip excludes/includes (file is explicitly watched) */);
        this.fileChangesAggregator.flush();
        this.notifyWatchFailed();
    }
    onFileChange(event, skipIncludeExcludeChecks = false) {
        if (this.cts.token.isCancellationRequested) {
            return;
        }
        // Logging
        if (this.verboseLogging) {
            this.traceWithCorrelation(`${event.type === 1 /* FileChangeType.ADDED */ ? '[ADDED]' : event.type === 2 /* FileChangeType.DELETED */ ? '[DELETED]' : '[CHANGED]'} ${event.resource.fsPath}`);
        }
        // Add to aggregator unless excluded or not included (not if explicitly disabled)
        if (!skipIncludeExcludeChecks && this.excludes.some(exclude => exclude(event.resource.fsPath))) {
            if (this.verboseLogging) {
                this.traceWithCorrelation(` >> ignored (excluded) ${event.resource.fsPath}`);
            }
        }
        else if (!skipIncludeExcludeChecks && this.includes && this.includes.length > 0 && !this.includes.some(include => include(event.resource.fsPath))) {
            if (this.verboseLogging) {
                this.traceWithCorrelation(` >> ignored (not included) ${event.resource.fsPath}`);
            }
        }
        else {
            this.fileChangesAggregator.work(event);
        }
    }
    handleFileChanges(fileChanges) {
        // Coalesce events: merge events of same kind
        const coalescedFileChanges = coalesceEvents(fileChanges);
        // Filter events: based on request filter property
        const filteredEvents = [];
        for (const event of coalescedFileChanges) {
            if (isFiltered(event, this.filter)) {
                if (this.verboseLogging) {
                    this.traceWithCorrelation(` >> ignored (filtered) ${event.resource.fsPath}`);
                }
                continue;
            }
            filteredEvents.push(event);
        }
        if (filteredEvents.length === 0) {
            return;
        }
        // Logging
        if (this.verboseLogging) {
            for (const event of filteredEvents) {
                this.traceWithCorrelation(` >> normalized ${event.type === 1 /* FileChangeType.ADDED */ ? '[ADDED]' : event.type === 2 /* FileChangeType.DELETED */ ? '[DELETED]' : '[CHANGED]'} ${event.resource.fsPath}`);
            }
        }
        // Broadcast to clients via throttled emitter
        const worked = this.throttledFileChangesEmitter.work(filteredEvents);
        // Logging
        if (!worked) {
            this.warn(`started ignoring events due to too many file change events at once (incoming: ${filteredEvents.length}, most recent change: ${filteredEvents[0].resource.fsPath}). Use 'files.watcherExclude' setting to exclude folders with lots of changing files (e.g. compilation output).`);
        }
        else {
            if (this.throttledFileChangesEmitter.pending > 0) {
                this.trace(`started throttling events due to large amount of file change events at once (pending: ${this.throttledFileChangesEmitter.pending}, most recent change: ${filteredEvents[0].resource.fsPath}). Use 'files.watcherExclude' setting to exclude folders with lots of changing files (e.g. compilation output).`);
            }
        }
    }
    async existsChildStrictCase(path) {
        if (isLinux) {
            return Promises.exists(path);
        }
        try {
            const pathBasename = basename(path);
            const children = await Promises.readdir(dirname(path));
            return children.some(child => child === pathBasename);
        }
        catch (error) {
            this.trace(error);
            return false;
        }
    }
    setVerboseLogging(verboseLogging) {
        this.verboseLogging = verboseLogging;
    }
    error(error) {
        if (!this.cts.token.isCancellationRequested) {
            this.onLogMessage?.({ type: 'error', message: `[File Watcher (node.js)] ${error}` });
        }
    }
    warn(message) {
        if (!this.cts.token.isCancellationRequested) {
            this.onLogMessage?.({ type: 'warn', message: `[File Watcher (node.js)] ${message}` });
        }
    }
    trace(message) {
        if (!this.cts.token.isCancellationRequested && this.verboseLogging) {
            this.onLogMessage?.({ type: 'trace', message: `[File Watcher (node.js)] ${message}` });
        }
    }
    traceWithCorrelation(message) {
        if (!this.cts.token.isCancellationRequested && this.verboseLogging) {
            this.trace(`${message}${typeof this.request.correlationId === 'number' ? ` <${this.request.correlationId}> ` : ``}`);
        }
    }
    dispose() {
        this.cts.dispose(true);
        super.dispose();
    }
}
/**
 * Watch the provided `path` for changes and return
 * the data in chunks of `Uint8Array` for further use.
 */
export async function watchFileContents(path, onData, onReady, token, bufferSize = 512) {
    const handle = await Promises.open(path, 'r');
    const buffer = Buffer.allocUnsafe(bufferSize);
    const cts = new CancellationTokenSource(token);
    let error = undefined;
    let isReading = false;
    const request = { path, excludes: [], recursive: false };
    const watcher = new NodeJSFileWatcherLibrary(request, undefined, changes => {
        (async () => {
            for (const { type } of changes) {
                if (type === 0 /* FileChangeType.UPDATED */) {
                    if (isReading) {
                        return; // return early if we are already reading the output
                    }
                    isReading = true;
                    try {
                        // Consume the new contents of the file until finished
                        // everytime there is a change event signalling a change
                        while (!cts.token.isCancellationRequested) {
                            const { bytesRead } = await Promises.read(handle, buffer, 0, bufferSize, null);
                            if (!bytesRead || cts.token.isCancellationRequested) {
                                break;
                            }
                            onData(buffer.slice(0, bytesRead));
                        }
                    }
                    catch (err) {
                        error = new Error(err);
                        cts.dispose(true);
                    }
                    finally {
                        isReading = false;
                    }
                }
            }
        })();
    });
    await watcher.ready;
    onReady();
    return new Promise((resolve, reject) => {
        cts.token.onCancellationRequested(async () => {
            watcher.dispose();
            try {
                await Promises.close(handle);
            }
            catch (err) {
                error = new Error(err);
            }
            if (error) {
                reject(error);
            }
            else {
                resolve();
            }
        });
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZWpzV2F0Y2hlckxpYi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9maWxlcy9ub2RlL3dhdGNoZXIvbm9kZWpzL25vZGVqc1dhdGNoZXJMaWIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDckMsT0FBTyxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNyRixPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDeEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNqRixPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxxQkFBcUIsRUFBRSxZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN4SSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDM0UsT0FBTyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0UsT0FBTyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUM5RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDbkUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUUzRCxPQUFPLEVBQWUsY0FBYyxFQUE2QixvQkFBb0IsRUFBa0MsVUFBVSxFQUFFLDZCQUE2QixFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDck0sT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBRzFELE1BQU0sT0FB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