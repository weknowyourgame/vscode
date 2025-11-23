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
import { ThemeIcon } from '../../../../base/common/themables.js';
import { score } from '../../../../editor/common/languageSelector.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IChatContextPickService } from './chatContextPickService.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Disposable, DisposableMap } from '../../../../base/common/lifecycle.js';
export const IChatContextService = createDecorator('chatContextService');
let ChatContextService = class ChatContextService extends Disposable {
    constructor(_contextPickService, _extensionService) {
        super();
        this._contextPickService = _contextPickService;
        this._extensionService = _extensionService;
        this._providers = new Map();
        this._workspaceContext = new Map();
        this._registeredPickers = this._register(new DisposableMap());
        this._lastResourceContext = new Map();
    }
    setChatContextProvider(id, picker) {
        const providerEntry = this._providers.get(id) ?? { picker: undefined };
        providerEntry.picker = picker;
        this._providers.set(id, providerEntry);
        this._registerWithPickService(id);
    }
    _registerWithPickService(id) {
        const providerEntry = this._providers.get(id);
        if (!providerEntry || !providerEntry.picker || !providerEntry.chatContextProvider) {
            return;
        }
        const title = `${providerEntry.picker.title.replace(/\.+$/, '')}...`;
        this._registeredPickers.set(id, this._contextPickService.registerChatContextItem(this._asPicker(title, providerEntry.picker.icon, id)));
    }
    registerChatContextProvider(id, selector, provider) {
        const providerEntry = this._providers.get(id) ?? { picker: undefined };
        providerEntry.chatContextProvider = { selector, provider };
        this._providers.set(id, providerEntry);
        this._registerWithPickService(id);
    }
    unregisterChatContextProvider(id) {
        this._providers.delete(id);
        this._registeredPickers.deleteAndDispose(id);
    }
    updateWorkspaceContextItems(id, items) {
        this._workspaceContext.set(id, items);
    }
    getWorkspaceContextItems() {
        const items = [];
        for (const workspaceContexts of this._workspaceContext.values()) {
            for (const item of workspaceContexts) {
                if (!item.value) {
                    continue;
                }
                items.push({
                    value: item.value,
                    name: item.label,
                    modelDescription: item.modelDescription,
                    id: item.label,
                    kind: 'workspace'
                });
            }
        }
        return items;
    }
    async contextForResource(uri) {
        return this._contextForResource(uri, false);
    }
    async _contextForResource(uri, withValue) {
        const scoredProviders = [];
        for (const providerEntry of this._providers.values()) {
            if (!providerEntry.chatContextProvider?.provider.provideChatContextForResource || (providerEntry.chatContextProvider.selector === undefined)) {
                continue;
            }
            const matchScore = score(providerEntry.chatContextProvider.selector, uri, '', true, undefined, undefined);
            scoredProviders.push({ score: matchScore, provider: providerEntry.chatContextProvider.provider });
        }
        scoredProviders.sort((a, b) => b.score - a.score);
        if (scoredProviders.length === 0 || scoredProviders[0].score <= 0) {
            return;
        }
        const context = (await scoredProviders[0].provider.provideChatContextForResource(uri, withValue, CancellationToken.None));
        if (!context) {
            return;
        }
        const contextValue = {
            value: undefined,
            name: context.label,
            icon: context.icon,
            uri: uri,
            modelDescription: context.modelDescription
        };
        this._lastResourceContext.clear();
        this._lastResourceContext.set(contextValue, { originalItem: context, provider: scoredProviders[0].provider });
        return contextValue;
    }
    async resolveChatContext(context) {
        if (context.value !== undefined) {
            return context;
        }
        const item = this._lastResourceContext.get(context);
        if (!item) {
            const resolved = await this._contextForResource(context.uri, true);
            context.value = resolved?.value;
            context.modelDescription = resolved?.modelDescription;
            return context;
        }
        else if (item.provider.resolveChatContext) {
            const resolved = await item.provider.resolveChatContext(item.originalItem, CancellationToken.None);
            if (resolved) {
                context.value = resolved.value;
                context.modelDescription = resolved.modelDescription;
                return context;
            }
        }
        return context;
    }
    _asPicker(title, icon, id) {
        const asPicker = () => {
            let providerEntry = this._providers.get(id);
            if (!providerEntry) {
                throw new Error('No chat context provider registered');
            }
            const picks = async () => {
                if (providerEntry && !providerEntry.chatContextProvider) {
                    // Activate the extension providing the chat context provider
                    await this._extensionService.activateByEvent(`onChatContextProvider:${id}`);
                    providerEntry = this._providers.get(id);
                    if (!providerEntry?.chatContextProvider) {
                        return [];
                    }
                }
                const results = await providerEntry?.chatContextProvider.provider.provideChatContext({}, CancellationToken.None);
                return results || [];
            };
            return {
                picks: picks().then(items => {
                    return items.map(item => ({
                        label: item.label,
                        iconClass: ThemeIcon.asClassName(item.icon),
                        asAttachment: async () => {
                            let contextValue = item;
                            if ((contextValue.value === undefined) && providerEntry?.chatContextProvider?.provider.resolveChatContext) {
                                contextValue = await providerEntry.chatContextProvider.provider.resolveChatContext(item, CancellationToken.None);
                            }
                            return {
                                kind: 'generic',
                                id: contextValue.label,
                                name: contextValue.label,
                                icon: contextValue.icon,
                                value: contextValue.value
                            };
                        }
                    }));
                }),
                placeholder: title
            };
        };
        const picker = {
            asPicker,
            type: 'pickerPick',
            label: title,
            icon
        };
        return picker;
    }
};
ChatContextService = __decorate([
    __param(0, IChatContextPickService),
    __param(1, IExtensionService)
], ChatContextService);
export { ChatContextService };
registerSingleton(IChatContextService, ChatContextService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdENvbnRleHRTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGV4dFNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBb0IsS0FBSyxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDeEYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzdGLE9BQU8sRUFBOEMsdUJBQXVCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUVsSCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUU1RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUN0RixPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQWUsTUFBTSxzQ0FBc0MsQ0FBQztBQUc5RixNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBRyxlQUFlLENBQXNCLG9CQUFvQixDQUFDLENBQUM7QUFZdkYsSUFBTSxrQkFBa0IsR0FBeEIsTUFBTSxrQkFBbUIsU0FBUSxVQUFVO0lBUWpELFlBQzBCLG1CQUE2RCxFQUNuRSxpQkFBcUQ7UUFFeEUsS0FBSyxFQUFFLENBQUM7UUFIa0Msd0JBQW1CLEdBQW5CLG1CQUFtQixDQUF5QjtRQUNsRCxzQkFBaUIsR0FBakIsaUJBQWlCLENBQW1CO1FBUHhELGVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBcUMsQ0FBQztRQUMxRCxzQkFBaUIsR0FBRyxJQUFJLEdBQUcsRUFBOEIsQ0FBQztRQUMxRCx1QkFBa0IsR0FBRyxJQUFJLENBQUMs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