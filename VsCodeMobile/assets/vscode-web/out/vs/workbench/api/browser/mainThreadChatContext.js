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
import { Disposable } from '../../../base/common/lifecycle.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { IChatContextService } from '../../contrib/chat/browser/chatContextService.js';
let MainThreadChatContext = class MainThreadChatContext extends Disposable {
    constructor(extHostContext, _chatContextService) {
        super();
        this._chatContextService = _chatContextService;
        this._providers = new Map();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostChatContext);
    }
    $registerChatContextProvider(handle, id, selector, _options, support) {
        this._providers.set(handle, { selector, support, id });
        this._chatContextService.registerChatContextProvider(id, selector, {
            provideChatContext: (token) => {
                return this._proxy.$provideChatContext(handle, token);
            },
            resolveChatContext: support.supportsResolve ? (context, token) => {
                return this._proxy.$resolveChatContext(handle, context, token);
            } : undefined,
            provideChatContextForResource: support.supportsResource ? (resource, withValue, token) => {
                return this._proxy.$provideChatContextForResource(handle, { resource, withValue }, token);
            } : undefined
        });
    }
    $unregisterChatContextProvider(handle) {
        const provider = this._providers.get(handle);
        if (!provider) {
            return;
        }
        this._chatContextService.unregisterChatContextProvider(provider.id);
        this._providers.delete(handle);
    }
    $updateWorkspaceContextItems(handle, items) {
        const provider = this._providers.get(handle);
        if (!provider) {
            return;
        }
        this._chatContextService.updateWorkspaceContextItems(provider.id, items);
    }
};
MainThreadChatContext = __decorate([
    extHostNamedCustomer(MainContext.MainThreadChatContext),
    __param(1, IChatContextService)
], MainThreadChatContext);
export { MainThreadChatContext };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZENoYXRDb250ZXh0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvYnJvd3Nlci9tYWluVGhyZWFkQ2hhdENvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRy9ELE9BQU8sRUFBRSxvQkFBb0IsRUFBbUIsTUFBTSxzREFBc0QsQ0FBQztBQUM3RyxPQUFPLEVBQTJCLGNBQWMsRUFBc0IsV0FBVyxFQUE4QixNQUFNLCtCQUErQixDQUFDO0FBQ3JKLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBSWhGLElBQU0scUJBQXFCLEdBQTNCLE1BQU0scUJBQXNCLFNBQVEsVUFBVTtJQUlwRCxZQUNDLGNBQStCLEVBQ1YsbUJBQXlEO1FBRTlFLEtBQUssRUFBRSxDQUFDO1FBRjhCLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBcUI7UUFKOUQsZUFBVSxHQUFHLElBQUksR0FBRyxFQUFvRyxDQUFDO1FBT3pJLElBQUksQ0FBQyxNQUFNLEdBQUcsY0FBYyxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUMxRSxDQUFDO0lBRUQsNEJBQTRCLENBQUMsTUFBYyxFQUFFLEVBQVUsRUFBRSxRQUEwQyxFQUFFLFFBQTZCLEVBQUUsT0FBNEI7UUFDL0osSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZELElBQUksQ0FBQyxtQkFBbUIsQ0FBQywyQkFBMkIsQ0FBQyxFQUFFLEVBQUUsUUFBUSxFQUFFO1lBQ2xFLGtCQUFrQixFQUFFLENBQUMsS0FBd0IsRUFBRSxFQUFFO2dCQUNoRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3ZELENBQUM7WUFDRCxrQkFBa0IsRUFBRSxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQXlCLEVBQUUsS0FBd0IsRUFBRSxFQUFFO2dCQUNyRyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNoRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7WUFDYiw2QkFBNkIsRUFBRSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBYSxFQUFFLFNBQWtCLEVBQUUsS0FBd0IsRUFBRSxFQUFFO2dCQUN6SCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsOEJBQThCLENBQUMsTUFBTSxFQUFFLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzNGLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztTQUNiLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCw4QkFBOEIsQ0FBQyxNQUFjO1FBQzVDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzdDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNmLE9BQU87UUFDUixDQUFDO1FBQ0QsSUFBSSxDQUFDLG1CQUFtQixDQUFDLDZCQUE2QixDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNwRSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRUQsNEJBQTRCLENBQUMsTUFBYyxFQUFFLEtBQXlCO1FBQ3JFLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzdDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNmLE9BQU87UUFDUixDQUFDO1FBQ0QsSUFBSSxDQUFDLG1CQUFtQixDQUFDLDJCQUEyQixDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDMUUsQ0FBQztDQUNELENBQUE7QUEzQ1kscUJBQXFCO0lBRGpDLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxxQkFBcUIsQ0FBQztJQU9yRCxXQUFBLG1CQUFtQixDQUFBO0dBTlQscUJBQXFCLENBMkNqQyJ9