/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ThrottledDelayer } from '../../../common/async.js';
import { Event, PauseableEmitter } from '../../../common/event.js';
import { Disposable } from '../../../common/lifecycle.js';
import { parse, stringify } from '../../../common/marshalling.js';
import { isObject, isUndefinedOrNull } from '../../../common/types.js';
export var StorageHint;
(function (StorageHint) {
    // A hint to the storage that the storage
    // does not exist on disk yet. This allows
    // the storage library to improve startup
    // time by not checking the storage for data.
    StorageHint[StorageHint["STORAGE_DOES_NOT_EXIST"] = 0] = "STORAGE_DOES_NOT_EXIST";
    // A hint to the storage that the storage
    // is backed by an in-memory storage.
    StorageHint[StorageHint["STORAGE_IN_MEMORY"] = 1] = "STORAGE_IN_MEMORY";
})(StorageHint || (StorageHint = {}));
export function isStorageItemsChangeEvent(thing) {
    const candidate = thing;
    return candidate?.changed instanceof Map || candidate?.deleted instanceof Set;
}
export var StorageState;
(function (StorageState) {
    StorageState[StorageState["None"] = 0] = "None";
    StorageState[StorageState["Initialized"] = 1] = "Initialized";
    StorageState[StorageState["Closed"] = 2] = "Closed";
})(StorageState || (StorageState = {}));
export class Storage extends Disposable {
    static { this.DEFAULT_FLUSH_DELAY = 100; }
    constructor(database, options = Object.create(null)) {
        super();
        this.database = database;
        this.options = options;
        this._onDidChangeStorage = this._register(new PauseableEmitter());
        this.onDidChangeStorage = this._onDidChangeStorage.event;
        this.state = StorageState.None;
        this.cache = new Map();
        this.flushDelayer = this._register(new ThrottledDelayer(Storage.DEFAULT_FLUSH_DELAY));
        this.pendingDeletes = new Set();
        this.pendingInserts = new Map();
        this.pendingClose = undefined;
        this.whenFlushedCallbacks = [];
        this.registerListeners();
    }
    registerListeners() {
        this._register(this.database.onDidChangeItemsExternal(e => this.onDidChangeItemsExternal(e)));
    }
    onDidChangeItemsExternal(e) {
        this._onDidChangeStorage.pause();
        try {
            // items that change external require us to update our
            // caches with the values. we just accept the value and
            // emit an event if there is a change.
            e.changed?.forEach((value, key) => this.acceptExternal(key, value));
            e.deleted?.forEach(key => this.acceptExternal(key, undefined));
        }
        finally {
            this._onDidChangeStorage.resume();
        }
    }
    acceptExternal(key, value) {
        if (this.state === StorageState.Closed) {
            return; // Return early if we are already closed
        }
        let changed = false;
        // Item got removed, check for deletion
        if (isUndefinedOrNull(value)) {
            changed = this.cache.delete(key);
        }
        // Item got updated, check for change
        else {
            const currentValue = this.cache.get(key);
            if (currentValue !== value) {
                this.cache.set(key, value);
                changed = true;
            }
        }
        // Signal to outside listeners
        if (changed) {
            this._onDidChangeStorage.fire({ key, external: true });
        }
    }
    get items() {
        return this.cache;
    }
    get size() {
        return this.cache.size;
    }
    async init() {
        if (this.state !== StorageState.None) {
            return; // either closed or already initialized
        }
        this.state = StorageState.Initialized;
        if (this.options.hint === StorageHint.STORAGE_DOES_NOT_EXIST) {
            // return early if we know the storage file does not exist. this is a performance
            // optimization to not load all items of the underlying storage if we know that
            // there can be no items because the storage does not exist.
            return;
        }
        this.cache = await this.database.getItems();
    }
    get(key, fallbackValue) {
        const value = this.cache.get(key);
        if (isUndefinedOrNull(value)) {
            return fallbackValue;
        }
        return value;
    }
    getBoolean(key, fallbackValue) {
        const value = this.get(key);
        if (isUndefinedOrNull(value)) {
            return fallbackValue;
        }
        return value === 'true';
    }
    getNumber(key, fallbackValue) {
        const value = this.get(key);
        if (isUndefinedOrNull(value)) {
            return fallbackValue;
        }
        return parseInt(value, 10);
    }
    getObject(key, fallbackValue) {
        const value = this.get(key);
        if (isUndefinedOrNull(value)) {
            return fallbackValue;
        }
        return parse(value);
    }
    async set(key, value, external = false) {
        if (this.state === StorageState.Closed) {
            return; // Return early if we are already closed
        }
        // We remove the key for undefined/null values
        if (isUndefinedOrNull(value)) {
            return this.delete(key, external);
        }
        // Otherwise, convert to String and store
        const valueStr = isObject(value) || Array.isArray(value) ? stringify(value) : String(value);
        // Return early if value already set
        const currentValue = this.cache.get(key);
        if (currentValue === valueStr) {
            return;
        }
        // Update in cache and pending
        this.cache.set(key, valueStr);
        this.pendingInserts.set(key, valueStr);
        this.pendingDeletes.delete(key);
        // Event
        this._onDidChangeStorage.fire({ key, external });
        // Accumulate work by scheduling after timeout
        return this.doFlush();
    }
    async delete(key, external = false) {
        if (this.state === StorageState.Closed) {
            return; // Return early if we are already closed
        }
        // Remove from cache and add to pending
        const wasDeleted = this.cache.delete(key);
        if (!wasDeleted) {
            return; // Return early if value already deleted
        }
        if (!this.pendingDeletes.has(key)) {
            this.pendingDeletes.add(key);
        }
        this.pendingInserts.delete(key);
        // Event
        this._onDidChangeStorage.fire({ key, external });
        // Accumulate work by scheduling after timeout
        return this.doFlush();
    }
    async optimize() {
        if (this.state === StorageState.Closed) {
            return; // Return early if we are already closed
        }
        // Await pending data to be flushed to the DB
        // before attempting to optimize the DB
        await this.flush(0);
        return this.database.optimize();
    }
    async close() {
        if (!this.pendingClose) {
            this.pendingClose = this.doClose();
        }
        return this.pendingClose;
    }
    async doClose() {
        // Update state
        this.state = StorageState.Closed;
        // Trigger new flush to ensure data is persisted and then close
        // even if there is an error flushing. We must always ensure
        // the DB is closed to avoid corruption.
        //
        // Recovery: we pass our cache over as recovery option in case
        // the DB is not healthy.
        try {
            await this.doFlush(0 /* as soon as possible */);
        }
        catch {
            // Ignore
        }
        await this.database.close(() => this.cache);
    }
    get hasPending() {
        return this.pendingInserts.size > 0 || this.pendingDeletes.size > 0;
    }
    async flushPending() {
        if (!this.hasPending) {
            return; // return early if nothing to do
        }
        // Get pending data
        const updateRequest = { insert: this.pendingInserts, delete: this.pendingDeletes };
        // Reset pending data for next run
        this.pendingDeletes = new Set();
        this.pendingInserts = new Map();
        // Update in storage and release any
        // waiters we have once done
        return this.database.updateItems(updateRequest).finally(() => {
            if (!this.hasPending) {
                while (this.whenFlushedCallbacks.length) {
                    this.whenFlushedCallbacks.pop()?.();
                }
            }
        });
    }
    async flush(delay) {
        if (this.state === StorageState.Closed || // Return early if we are already closed
            this.pendingClose // return early if nothing to do
        ) {
            return;
        }
        return this.doFlush(delay);
    }
    async doFlush(delay) {
        if (this.options.hint === StorageHint.STORAGE_IN_MEMORY) {
            return this.flushPending(); // return early if in-memory
        }
        return this.flushDelayer.trigger(() => this.flushPending(), delay);
    }
    async whenFlushed() {
        if (!this.hasPending) {
            return; // return early if nothing to do
        }
        return new Promise(resolve => this.whenFlushedCallbacks.push(resolve));
    }
    isInMemory() {
        return this.options.hint === StorageHint.STORAGE_IN_MEMORY;
    }
}
export class InMemoryStorageDatabase {
    constructor() {
        this.onDidChangeItemsExternal = Event.None;
        this.items = new Map();
    }
    async getItems() {
        return this.items;
    }
    async updateItems(request) {
        request.insert?.forEach((value, key) => this.items.set(key, value));
        request.delete?.forEach(key => this.items.delete(key));
    }
    async optimize() { }
    async close() { }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL3BhcnRzL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDNUQsT0FBTyxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ25FLE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSw4QkFBOEIsQ0FBQztBQUN2RSxPQUFPLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUV2RSxNQUFNLENBQU4sSUFBWSxXQVdYO0FBWEQsV0FBWSxXQUFXO0lBRXRCLHlDQUF5QztJQUN6QywwQ0FBMEM7SUFDMUMseUNBQXlDO0lBQ3pDLDZDQUE2QztJQUM3QyxpRkFBc0IsQ0FBQTtJQUV0Qix5Q0FBeUM7SUFDekMscUNBQXFDO0lBQ3JDLHVFQUFpQixDQUFBO0FBQ2xCLENBQUMsRUFYVyxXQUFXLEtBQVgsV0FBVyxRQVd0QjtBQWdCRCxNQUFNLFVBQVUseUJBQXlCLENBQUMsS0FBYztJQUN2RCxNQUFNLFNBQVMsR0FBRyxLQUE2QyxDQUFDO0lBRWhFLE9BQU8sU0FBUyxFQUFFLE9BQU8sWUFBWSxHQUFHLElBQUksU0FBUyxFQUFFLE9BQU8sWUFBWSxHQUFHLENBQUM7QUFDL0UsQ0FBQztBQWtFRCxNQUFNLENBQU4sSUFBWSxZQUlYO0FBSkQsV0FBWSxZQUFZO0lBQ3ZCLCtDQUFJLENBQUE7SUFDSiw2REFBVyxDQUFBO0lBQ1gsbURBQU0sQ0FBQTtBQUNQLENBQUMsRUFKVyxZQUFZLEtBQVosWUFBWSxRQUl2QjtBQUVELE1BQU0sT0FB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