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
import { CancellationToken } from '../../../base/common/cancellation.js';
import { URI } from '../../../base/common/uri.js';
import { MainContext } from './extHost.protocol.js';
import { DocumentSelector } from './extHostTypeConverters.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import { Disposable, DisposableStore } from '../../../base/common/lifecycle.js';
let ExtHostChatContext = class ExtHostChatContext extends Disposable {
    constructor(extHostRpc) {
        super();
        this._handlePool = 0;
        this._providers = new Map();
        this._itemPool = 0;
        this._items = new Map(); // handle -> itemHandle -> item
        this._proxy = extHostRpc.getProxy(MainContext.MainThreadChatContext);
    }
    async $provideChatContext(handle, token) {
        this._items.delete(handle); // clear previous items
        const provider = this._getProvider(handle);
        if (!provider.provideChatContextExplicit) {
            throw new Error('provideChatContext not implemented');
        }
        const result = (await provider.provideChatContextExplicit(token)) ?? [];
        const items = [];
        for (const item of result) {
            const itemHandle = this._addTrackedItem(handle, item);
            items.push({
                handle: itemHandle,
                icon: item.icon,
                label: item.label,
                modelDescription: item.modelDescription,
                value: item.value
            });
        }
        return items;
    }
    _addTrackedItem(handle, item) {
        const itemHandle = this._itemPool++;
        if (!this._items.has(handle)) {
            this._items.set(handle, new Map());
        }
        this._items.get(handle).set(itemHandle, item);
        return itemHandle;
    }
    async $provideChatContextForResource(handle, options, token) {
        const provider = this._getProvider(handle);
        if (!provider.provideChatContextForResource) {
            throw new Error('provideChatContextForResource not implemented');
        }
        const result = await provider.provideChatContextForResource({ resource: URI.revive(options.resource) }, token);
        if (!result) {
            return undefined;
        }
        const itemHandle = this._addTrackedItem(handle, result);
        const item = {
            handle: itemHandle,
            icon: result.icon,
            label: result.label,
            modelDescription: result.modelDescription,
            value: options.withValue ? result.value : undefined
        };
        if (options.withValue && !item.value && provider.resolveChatContext) {
            const resolved = await provider.resolveChatContext(result, token);
            item.value = resolved?.value;
        }
        return item;
    }
    async _doResolve(provider, context, extItem, token) {
        const extResult = await provider.resolveChatContext(extItem, token);
        const result = extResult ?? context;
        return {
            handle: context.handle,
            icon: result.icon,
            label: result.label,
            modelDescription: result.modelDescription,
            value: result.value
        };
    }
    async $resolveChatContext(handle, context, token) {
        const provider = this._getProvider(handle);
        if (!provider.resolveChatContext) {
            throw new Error('resolveChatContext not implemented');
        }
        const extItem = this._items.get(handle)?.get(context.handle);
        if (!extItem) {
            throw new Error('Chat context item not found');
        }
        return this._doResolve(provider, context, extItem, token);
    }
    registerChatContextProvider(selector, id, provider) {
        const handle = this._handlePool++;
        const disposables = new DisposableStore();
        this._listenForWorkspaceContextChanges(handle, provider, disposables);
        this._providers.set(handle, { provider, disposables });
        this._proxy.$registerChatContextProvider(handle, `${id}`, selector ? DocumentSelector.from(selector) : undefined, {}, { supportsResource: !!provider.provideChatContextForResource, supportsResolve: !!provider.resolveChatContext });
        return {
            dispose: () => {
                this._providers.delete(handle);
                this._proxy.$unregisterChatContextProvider(handle);
                disposables.dispose();
            }
        };
    }
    _listenForWorkspaceContextChanges(handle, provider, disposables) {
        if (!provider.onDidChangeWorkspaceChatContext || !provider.provideWorkspaceChatContext) {
            return;
        }
        disposables.add(provider.onDidChangeWorkspaceChatContext(async () => {
            const workspaceContexts = await provider.provideWorkspaceChatContext(CancellationToken.None);
            const resolvedContexts = [];
            for (const item of workspaceContexts ?? []) {
                const contextItem = {
                    icon: item.icon,
                    label: item.label,
                    modelDescription: item.modelDescription,
                    value: item.value,
                    handle: this._itemPool++
                };
                const resolved = await this._doResolve(provider, contextItem, item, CancellationToken.None);
                resolvedContexts.push(resolved);
            }
            this._proxy.$updateWorkspaceContextItems(handle, resolvedContexts);
        }));
    }
    _getProvider(handle) {
        if (!this._providers.has(handle)) {
            throw new Error('Chat context provider not found');
        }
        return this._providers.get(handle).provider;
    }
    dispose() {
        super.dispose();
        for (const { disposables } of this._providers.values()) {
            disposables.dispose();
        }
    }
};
ExtHostChatContext = __decorate([
    __param(0, IExtHostRpcService)
], ExtHostChatContext);
export { ExtHostChatContext };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdENoYXRDb250ZXh0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvY29tbW9uL2V4dEhvc3RDaGF0Q29udGV4dC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLDZCQUE2QixDQUFDO0FBQ2pFLE9BQU8sRUFBMkIsV0FBVyxFQUE4QixNQUFNLHVCQUF1QixDQUFDO0FBQ3pHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQzlELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBRTVELE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFekUsSUFBTSxrQkFBa0IsR0FBeEIsTUFBTSxrQkFBbUIsU0FBUSxVQUFVO0lBU2pELFlBQWdDLFVBQThCO1FBRTdELEtBQUssRUFBRSxDQUFDO1FBUEQsZ0JBQVcsR0FBVyxDQUFDLENBQUM7UUFDeEIsZUFBVSxHQUF3RixJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQzVHLGNBQVMsR0FBVyxDQUFDLENBQUM7UUFDdEIsV0FBTSxHQUFxRCxJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUMsK0JBQStCO1FBSzVHLElBQUksQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMscUJBQXFCLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBRUQsS0FBSyxDQUFDLG1CQUFtQixDQUFDLE1BQWMsRUFBRSxLQUF3QjtRQUNqRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLHVCQUF1QjtRQUNuRCxNQUFNLFFB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