/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import { top } from '../../../base/common/arrays.js';
import { DeferredPromise } from '../../../base/common/async.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { join } from '../../../base/common/path.js';
import { StopWatch } from '../../../base/common/stopwatch.js';
import { URI } from '../../../base/common/uri.js';
import { Promises } from '../../../base/node/pfs.js';
import { InMemoryStorageDatabase, Storage, StorageHint, StorageState } from '../../../base/parts/storage/common/storage.js';
import { SQLiteStorageDatabase } from '../../../base/parts/storage/node/storage.js';
import { LogLevel } from '../../log/common/log.js';
import { IS_NEW_KEY } from '../common/storage.js';
import { currentSessionDateStorageKey, firstSessionDateStorageKey, lastSessionDateStorageKey } from '../../telemetry/common/telemetry.js';
import { isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier } from '../../workspace/common/workspace.js';
import { Schemas } from '../../../base/common/network.js';
class BaseStorageMain extends Disposable {
    static { this.LOG_SLOW_CLOSE_THRESHOLD = 2000; }
    get storage() { return this._storage; }
    constructor(logService, fileService) {
        super();
        this.logService = logService;
        this.fileService = fileService;
        this._onDidChangeStorage = this._register(new Emitter());
        this.onDidChangeStorage = this._onDidChangeStorage.event;
        this._onDidCloseStorage = this._register(new Emitter());
        this.onDidCloseStorage = this._onDidCloseStorage.event;
        this._storage = this._register(new Storage(new InMemoryStorageDatabase(), { hint: StorageHint.STORAGE_IN_MEMORY })); // storage is in-memory until initialized
        this.initializePromise = undefined;
        this.whenInitPromise = new DeferredPromise();
        this.whenInit = this.whenInitPromise.p;
        this.state = StorageState.None;
    }
    isInMemory() {
        return this._storage.isInMemory();
    }
    init() {
        if (!this.initializePromise) {
            this.initializePromise = (async () => {
                if (this.state !== StorageState.None) {
                    return; // either closed or already initialized
                }
                try {
                    // Create storage via subclasses
                    const storage = this._register(await this.doCreate());
                    // Replace our in-memory storage with the real
                    // once as soon as possible without awaiting
                    // the init call.
                    this._storage.dispose();
                    this._storage = storage;
                    // Re-emit storage changes via event
                    this._register(storage.onDidChangeStorage(e => this._onDidChangeStorage.fire(e)));
                    // Await storage init
                    await this.doInit(storage);
                    // Ensure we track whether storage is new or not
                    const isNewStorage = storage.getBoolean(IS_NEW_KEY);
                    if (isNewStorage === undefined) {
                        storage.set(IS_NEW_KEY, true);
                    }
                    else if (isNewStorage) {
                        storage.set(IS_NEW_KEY, false);
                    }
                }
                catch (error) {
                    this.logService.error(`[storage main] initialize(): Unable to init storage due to ${error}`);
                }
                finally {
                    // Update state
                    this.state = StorageState.Initialized;
                    // Mark init promise as completed
                    this.whenInitPromise.complete();
                }
            })();
        }
        return this.initializePromise;
    }
    createLoggingOptions() {
        return {
            logTrace: (this.logService.getLevel() === LogLevel.Trace) ? msg => this.logService.trace(msg) : undefined,
            logError: error => this.logService.error(error)
        };
    }
    doInit(storage) {
        return storage.init();
    }
    get items() { return this._storage.items; }
    get(key, fallbackValue) {
        return this._storage.get(key, fallbackValue);
    }
    set(key, value) {
        return this._storage.set(key, value);
    }
    delete(key) {
        return this._storage.delete(key);
    }
    optimize() {
        return this._storage.optimize();
    }
    async close() {
        // Measure how long it takes to close storage
        const watch = new StopWatch(false);
        await this.doClose();
        watch.stop();
        // If close() is taking a long time, there is
        // a chance that the underlying DB is large
        // either on disk or in general. In that case
        // log some additional info to further diagnose
        if (watch.elapsed() > BaseStorageMain.LOG_SLOW_CLOSE_THRESHOLD) {
            await this.logSlowClose(watch);
        }
        // Signal as event
        this._onDidCloseStorage.fire();
    }
    async logSlowClose(watch) {
        if (!this.path) {
            return;
        }
        try {
            const largestEntries = top(Array.from(this._storage.items.entries())
                .map(([key, value]) => ({ key, length: value.length })), (entryA, entryB) => entryB.length - entryA.length, 5)
                .map(entry => `${entry.key}:${entry.length}`).join(', ');
            const dbSize = (await this.fileService.stat(URI.file(this.path))).size;
            this.logService.warn(`[storage main] detected slow close() operation: Time: ${watch.elapsed()}ms, DB size: ${dbSize}b, Large Keys: ${largestEntries}`);
        }
        catch (error) {
            this.logService.error('[storage main] figuring out stats for slow DB on close() resulted in an error', error);
        }
    }
    async doClose() {
        // Ensure we are not accidentally leaving
        // a pending initialized storage behind in
        // case `close()` was called before `init()`
        // finishes.
        if (this.initializePromise) {
            await this.initializePromise;
        }
        // Update state
        this.state = StorageState.Closed;
        // Propagate to storage lib
        await this._storage.close();
    }
}
class BaseProfileAwareStorageMain extends BaseStorageMain {
    static { this.STORAGE_NAME = 'state.vscdb'; }
    get path() {
        if (!this.options.useInMemoryStorage) {
            return join(this.profile.globalStorageHome.with({ scheme: Schemas.file }).fsPath, BaseProfileAwareStorageMain.STORAGE_NAME);
        }
        return undefined;
    }
    constructor(profile, options, logService, fileService) {
        super(logService, fileService);
        this.profile = profile;
        this.options = options;
    }
    async doCreate() {
        return new Storage(new SQLiteStorageDatabase(this.path ?? SQLiteStorageDatabase.IN_MEMORY_PATH, {
            logging: this.createLoggingOptions()
        }), !this.path ? { hint: StorageHint.STORAGE_IN_MEMORY } : undefined);
    }
}
export class ProfileStorageMain extends BaseProfileAwareStorageMain {
}
export class ApplicationStorageMain extends BaseProfileAwareStorageMain {
    constructor(options, userDataProfileService, logService, fileService) {
        super(userDataProfileService.defaultProfile, options, logService, fileService);
    }
    async doInit(storage) {
        await super.doInit(storage);
        // Apply telemetry values as part of the application storage initialization
        this.updateTelemetryState(storage);
    }
    updateTelemetryState(storage) {
        // First session date (once)
        const firstSessionDate = storage.get(firstSessionDateStorageKey, undefined);
        if (firstSessionDate === undefined) {
            storage.set(firstSessionDateStorageKey, new Date().toUTCString());
        }
        // Last / current session (always)
        // previous session date was the "current" one at that time
        // current session date is "now"
        const lastSessionDate = storage.get(currentSessionDateStorageKey, undefined);
        const currentSessionDate = new Date().toUTCString();
        storage.set(lastSessionDateStorageKey, typeof lastSessionDate === 'undefined' ? null : lastSessionDate);
        storage.set(currentSessionDateStorageKey, currentSessionDate);
    }
}
export class WorkspaceStorageMain extends BaseStorageMain {
    static { this.WORKSPACE_STORAGE_NAME = 'state.vscdb'; }
    static { this.WORKSPACE_META_NAME = 'workspace.json'; }
    get path() {
        if (!this.options.useInMemoryStorage) {
            return join(this.environmentService.workspaceStorageHome.with({ scheme: Schemas.file }).fsPath, this.workspace.id, WorkspaceStorageMain.WORKSPACE_STORAGE_NAME);
        }
        return undefined;
    }
    constructor(workspace, options, logService, environmentService, fileService) {
        super(logService, fileService);
        this.workspace = workspace;
        this.options = options;
        this.environmentService = environmentService;
    }
    async doCreate() {
        const { storageFilePath, wasCreated } = await this.prepareWorkspaceStorageFolder();
        return new Storage(new SQLiteStorageDatabase(storageFilePath, {
            logging: this.createLoggingOptions()
        }), { hint: this.options.useInMemoryStorage ? StorageHint.STORAGE_IN_MEMORY : wasCreated ? StorageHint.STORAGE_DOES_NOT_EXIST : undefined });
    }
    async prepareWorkspaceStorageFolder() {
        // Return early if using inMemory storage
        if (this.options.useInMemoryStorage) {
            return { storageFilePath: SQLiteStorageDatabase.IN_MEMORY_PATH, wasCreated: true };
        }
        // Otherwise, ensure the storage folder exists on disk
        const workspaceStorageFolderPath = join(this.environmentService.workspaceStorageHome.with({ scheme: Schemas.file }).fsPath, this.workspace.id);
        const workspaceStorageDatabasePath = join(workspaceStorageFolderPath, WorkspaceStorageMain.WORKSPACE_STORAGE_NAME);
        const storageExists = await Promises.exists(workspaceStorageFolderPath);
        if (storageExists) {
            return { storageFilePath: workspaceStorageDatabasePath, wasCreated: false };
        }
        // Ensure storage folder exists
        await fs.promises.mkdir(workspaceStorageFolderPath, { recursive: true });
        // Write metadata into folder (but do not await)
        this.ensureWorkspaceStorageFolderMeta(workspaceStorageFolderPath);
        return { storageFilePath: workspaceStorageDatabasePath, wasCreated: true };
    }
    async ensureWorkspaceStorageFolderMeta(workspaceStorageFolderPath) {
        let meta = undefined;
        if (isSingleFolderWorkspaceIdentifier(this.workspace)) {
            meta = { folder: this.workspace.uri.toString() };
        }
        else if (isWorkspaceIdentifier(this.workspace)) {
            meta = { workspace: this.workspace.configPath.toString() };
        }
        if (meta) {
            try {
                const workspaceStorageMetaPath = join(workspaceStorageFolderPath, WorkspaceStorageMain.WORKSPACE_META_NAME);
                const storageExists = await Promises.exists(workspaceStorageMetaPath);
                if (!storageExists) {
                    await Promises.writeFile(workspaceStorageMetaPath, JSON.stringify(meta, undefined, 2));
                }
            }
            catch (error) {
                this.logService.error(`[storage main] ensureWorkspaceStorageFolderMeta(): Unable to create workspace storage metadata due to ${error}`);
            }
        }
    }
}
export class InMemoryStorageMain extends BaseStorageMain {
    get path() {
        return undefined; // in-memory has no path
    }
    async doCreate() {
        return new Storage(new InMemoryStorageDatabase(), { hint: StorageHint.STORAGE_IN_MEMORY });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZU1haW4uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vc3RvcmFnZS9lbGVjdHJvbi1tYWluL3N0b3JhZ2VNYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3pCLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDaEUsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDcEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNsRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDckQsT0FBTyxFQUFFLHVCQUF1QixFQUFZLE9BQU8sRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDdEksT0FBTyxFQUF3QyxxQkFBcUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRzFILE9BQU8sRUFBZSxRQUFRLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUNoRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFFbEQsT0FBTyxFQUFFLDRCQUE0QixFQUFFLDBCQUEwQixFQUFFLHlCQUF5QixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDMUksT0FBTyxFQUFFLGlDQUFpQyxFQUFFLHFCQUFxQixFQUEyQixNQUFNLHFDQUFxQyxDQUFDO0FB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