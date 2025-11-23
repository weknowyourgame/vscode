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
import { memoize } from '../../../../base/common/decorators.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
export class TerminalCapabilityStore extends Disposable {
    constructor() {
        super(...arguments);
        this._map = new Map();
        this._onDidAddCapability = this._register(new Emitter());
        this._onDidRemoveCapability = this._register(new Emitter());
    }
    get onDidAddCapability() { return this._onDidAddCapability.event; }
    get onDidRemoveCapability() { return this._onDidRemoveCapability.event; }
    get onDidChangeCapabilities() {
        return Event.map(Event.any(this._onDidAddCapability.event, this._onDidRemoveCapability.event), () => void 0, this._store);
    }
    get onDidAddCommandDetectionCapability() {
        return Event.map(Event.filter(this.onDidAddCapability, e => e.id === 2 /* TerminalCapability.CommandDetection */, this._store), e => e.capability, this._store);
    }
    get onDidRemoveCommandDetectionCapability() {
        return Event.map(Event.filter(this.onDidRemoveCapability, e => e.id === 2 /* TerminalCapability.CommandDetection */, this._store), () => void 0, this._store);
    }
    get onDidAddCwdDetectionCapability() {
        return Event.map(Event.filter(this.onDidAddCapability, e => e.id === 0 /* TerminalCapability.CwdDetection */, this._store), e => e.capability, this._store);
    }
    get onDidRemoveCwdDetectionCapability() {
        return Event.map(Event.filter(this.onDidRemoveCapability, e => e.id === 0 /* TerminalCapability.CwdDetection */, this._store), () => void 0, this._store);
    }
    get items() {
        return this._map.keys();
    }
    createOnDidRemoveCapabilityOfTypeEvent(type) {
        return Event.map(Event.filter(this.onDidRemoveCapability, e => e.id === type), e => e.capability);
    }
    createOnDidAddCapabilityOfTypeEvent(type) {
        return Event.map(Event.filter(this.onDidAddCapability, e => e.id === type), e => e.capability);
    }
    add(capability, impl) {
        this._map.set(capability, impl);
        this._onDidAddCapability.fire(createCapabilityEvent(capability, impl));
    }
    get(capability) {
        // HACK: This isn't totally safe since the Map key and value are not connected
        return this._map.get(capability);
    }
    remove(capability) {
        const impl = this._map.get(capability);
        if (!impl) {
            return;
        }
        this._map.delete(capability);
        this._onDidRemoveCapability.fire(createCapabilityEvent(capability, impl));
    }
    has(capability) {
        return this._map.has(capability);
    }
}
__decorate([
    memoize
], TerminalCapabilityStore.prototype, "onDidChangeCapabilities", null);
__decorate([
    memoize
], TerminalCapabilityStore.prototype, "onDidAddCommandDetectionCapability", null);
__decorate([
    memoize
], TerminalCapabilityStore.prototype, "onDidRemoveCommandDetectionCapability", null);
__decorate([
    memoize
], TerminalCapabilityStore.prototype, "onDidAddCwdDetectionCapability", null);
__decorate([
    memoize
], TerminalCapabilityStore.prototype, "onDidRemoveCwdDetectionCapability", null);
export class TerminalCapabilityStoreMultiplexer extends Disposable {
    constructor() {
        super(...arguments);
        this._stores = [];
        this._onDidAddCapability = this._register(new Emitter());
        this._onDidRemoveCapability = this._register(new Emitter());
    }
    get onDidAddCapability() { return this._onDidAddCapability.event; }
    get onDidRemoveCapability() { return this._onDidRemoveCapability.event; }
    get onDidChangeCapabilities() {
        return Event.map(Event.any(this._onDidAddCapability.event, this._onDidRemoveCapability.event), () => void 0, this._store);
    }
    get onDidAddCommandDetectionCapability() {
        return Event.map(Event.filter(this.onDidAddCapability, e => e.id === 2 /* TerminalCapability.CommandDetection */, this._store), e => e.capability, this._store);
    }
    get onDidRemoveCommandDetectionCapability() {
        return Event.map(Event.filter(this.onDidRemoveCapability, e => e.id === 2 /* TerminalCapability.CommandDetection */, this._store), () => void 0, this._store);
    }
    get onDidAddCwdDetectionCapability() {
        return Event.map(Event.filter(this.onDidAddCapability, e => e.id === 0 /* TerminalCapability.CwdDetection */, this._store), e => e.capability, this._store);
    }
    get onDidRemoveCwdDetectionCapability() {
        return Event.map(Event.filter(this.onDidRemoveCapability, e => e.id === 0 /* TerminalCapability.CwdDetection */, this._store), () => void 0, this._store);
    }
    get items() {
        return this._items();
    }
    createOnDidRemoveCapabilityOfTypeEvent(type) {
        return Event.map(Event.filter(this.onDidRemoveCapability, e => e.id === type), e => e.capability);
    }
    createOnDidAddCapabilityOfTypeEvent(type) {
        return Event.map(Event.filter(this.onDidAddCapability, e => e.id === type), e => e.capability);
    }
    *_items() {
        for (const store of this._stores) {
            for (const c of store.items) {
                yield c;
            }
        }
    }
    has(capability) {
        for (const store of this._stores) {
            for (const c of store.items) {
                if (c === capability) {
                    return true;
                }
            }
        }
        return false;
    }
    get(capability) {
        for (const store of this._stores) {
            const c = store.get(capability);
            if (c) {
                return c;
            }
        }
        return undefined;
    }
    add(store) {
        this._stores.push(store);
        for (const capability of store.items) {
            this._onDidAddCapability.fire(createCapabilityEvent(capability, store.get(capability)));
        }
        this._register(store.onDidAddCapability(e => this._onDidAddCapability.fire(e)));
        this._register(store.onDidRemoveCapability(e => this._onDidRemoveCapability.fire(e)));
    }
}
__decorate([
    memoize
], TerminalCapabilityStoreMultiplexer.prototype, "onDidChangeCapabilities", null);
__decorate([
    memoize
], TerminalCapabilityStoreMultiplexer.prototype, "onDidAddCommandDetectionCapability", null);
__decorate([
    memoize
], TerminalCapabilityStoreMultiplexer.prototype, "onDidRemoveCommandDetectionCapability", null);
__decorate([
    memoize
], TerminalCapabilityStoreMultiplexer.prototype, "onDidAddCwdDetectionCapability", null);
__decorate([
    memoize
], TerminalCapabilityStoreMultiplexer.prototype, "onDidRemoveCwdDetectionCapability", null);
function createCapabilityEvent(capability, impl) {
    // HACK: This cast is required to convert a generic type to a discriminated union, this is
    // necessary in order to enable type narrowing on the event consumer side.
    // eslint-disable-next-line local/code-no-dangerous-type-assertions
    return { id: capability, capability: impl };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDYXBhYmlsaXR5U3RvcmUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy90ZXJtaW5hbENhcGFiaWxpdHlTdG9yZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFHbEUsTUFBTSxPQUFPLHVCQUF3QixTQUFRLFVBQVU7SUFBdkQ7O1FBQ1MsU0FBSSxHQUE0RSxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBRWpGLHdCQUFtQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQW9DLENBQUMsQ0FBQztRQUV0RiwyQkFBc0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFvQyxDQUFDLENBQUM7SUE0RDNHLENBQUM7SUE3REEsSUFBSSxrQkFBa0IsS0FBSyxPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBRW5FLElBQUkscUJBQXFCLEtBQUssT0FBTyxJQUFJLENBQUMsc0JBQXNCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUd6RSxJQUFJLHVCQUF1QjtRQUMxQixPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FDekIsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssRUFDOUIsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FDakMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsTUFB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