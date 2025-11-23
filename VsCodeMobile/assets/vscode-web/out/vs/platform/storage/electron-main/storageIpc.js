/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { revive } from '../../../base/common/marshalling.js';
import { reviveIdentifier } from '../../workspace/common/workspace.js';
export class StorageDatabaseChannel extends Disposable {
    static { this.STORAGE_CHANGE_DEBOUNCE_TIME = 100; }
    constructor(logService, storageMainService) {
        super();
        this.logService = logService;
        this.storageMainService = storageMainService;
        this.onDidChangeApplicationStorageEmitter = this._register(new Emitter());
        this.mapProfileToOnDidChangeProfileStorageEmitter = new Map();
        this.registerStorageChangeListeners(storageMainService.applicationStorage, this.onDidChangeApplicationStorageEmitter);
    }
    //#region Storage Change Events
    registerStorageChangeListeners(storage, emitter) {
        // Listen for changes in provided storage to send to listeners
        // that are listening. Use a debouncer to reduce IPC traffic.
        this._register(Event.debounce(storage.onDidChangeStorage, (prev, cur) => {
            if (!prev) {
                prev = [cur];
            }
            else {
                prev.push(cur);
            }
            return prev;
        }, StorageDatabaseChannel.STORAGE_CHANGE_DEBOUNCE_TIME)(events => {
            if (events.length) {
                emitter.fire(this.serializeStorageChangeEvents(events, storage));
            }
        }));
    }
    serializeStorageChangeEvents(events, storage) {
        const changed = new Map();
        const deleted = new Set();
        events.forEach(event => {
            const existing = storage.get(event.key);
            if (typeof existing === 'string') {
                changed.set(event.key, existing);
            }
            else {
                deleted.add(event.key);
            }
        });
        return {
            changed: Array.from(changed.entries()),
            deleted: Array.from(deleted.values())
        };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listen(_, event, arg) {
        switch (event) {
            case 'onDidChangeStorage': {
                const profile = arg.profile ? revive(arg.profile) : undefined;
                // Without profile: application scope
                if (!profile) {
                    return this.onDidChangeApplicationStorageEmitter.event;
                }
                // With profile: profile scope for the profile
                let profileStorageChangeEmitter = this.mapProfileToOnDidChangeProfileStorageEmitter.get(profile.id);
                if (!profileStorageChangeEmitter) {
                    profileStorageChangeEmitter = this._register(new Emitter());
                    this.registerStorageChangeListeners(this.storageMainService.profileStorage(profile), profileStorageChangeEmitter);
                    this.mapProfileToOnDidChangeProfileStorageEmitter.set(profile.id, profileStorageChangeEmitter);
                }
                return profileStorageChangeEmitter.event;
            }
        }
        throw new Error(`Event not found: ${event}`);
    }
    //#endregion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async call(_, command, arg) {
        const profile = arg.profile ? revive(arg.profile) : undefined;
        const workspace = reviveIdentifier(arg.workspace);
        // Get storage to be ready
        const storage = await this.withStorageInitialized(profile, workspace);
        // handle call
        switch (command) {
            case 'getItems': {
                return Array.from(storage.items.entries());
            }
            case 'updateItems': {
                const items = arg;
                if (items.insert) {
                    for (const [key, value] of items.insert) {
                        storage.set(key, value);
                    }
                }
                items.delete?.forEach(key => storage.delete(key));
                break;
            }
            case 'optimize': {
                return storage.optimize();
            }
            case 'isUsed': {
                const path = arg.payload;
                if (typeof path === 'string') {
                    return this.storageMainService.isUsed(path);
                }
                return false;
            }
            default:
                throw new Error(`Call not found: ${command}`);
        }
    }
    async withStorageInitialized(profile, workspace) {
        let storage;
        if (workspace) {
            storage = this.storageMainService.workspaceStorage(workspace);
        }
        else if (profile) {
            storage = this.storageMainService.profileStorage(profile);
        }
        else {
            storage = this.storageMainService.applicationStorage;
        }
        try {
            await storage.init();
        }
        catch (error) {
            this.logService.error(`StorageIPC#init: Unable to init ${workspace ? 'workspace' : profile ? 'profile' : 'application'} storage due to ${error}`);
        }
        return storage;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZUlwYy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9zdG9yYWdlL2VsZWN0cm9uLW1haW4vc3RvcmFnZUlwYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFPN0QsT0FBTyxFQUFFLGdCQUFnQixFQUEyQixNQUFNLHFDQUFxQyxDQUFDO0FBRWhHLE1BQU0sT0FBTyxzQkFBdUIsU0FBUSxVQUFVO2FBRTdCLGlDQUE0QixHQUFHLEdBQUcsQUFBTixDQUFPO0lBTTNELFlBQ2tCLFVBQXVCLEVBQ3ZCLGtCQUF1QztRQUV4RCxLQUFLLEVBQUUsQ0FBQztRQUhTLGVBQVUsR0FBVixVQUFVLENBQWE7UUFDdkIsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFxQjtRQU54Qyx5Q0FBb0MsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFpQyxDQUFDLENBQUM7UUFFcEcsaURBQTRDLEdBQUcsSUFBSSxHQUFHLEVBQW1FLENBQUM7UUFRMUksSUFBSSxDQUFDLDhCQUE4QixDQUFDLGtCQUFrQixDQUFDLGtCQUFrQixFQUFFLElBQUksQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDO0lBQ3ZILENBQUM7SUFFRCwrQkFBK0I7SUFFdkIsOEJBQThCLENBQUMsT0FBcUIsRUFBRSxPQUErQztRQUU1Ryw4REFBOEQ7UUFDOUQsNkRBQTZEO1FBRTdELElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxJQUF1QyxFQUFFLEdBQXdCLEVB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