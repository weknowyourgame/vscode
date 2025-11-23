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
import { Disposable, DisposableMap } from '../../../base/common/lifecycle.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { IAiSettingsSearchService } from '../../services/aiSettingsSearch/common/aiSettingsSearch.js';
import { ExtHostContext, MainContext, } from '../common/extHost.protocol.js';
let MainThreadAiSettingsSearch = class MainThreadAiSettingsSearch extends Disposable {
    constructor(context, _settingsSearchService) {
        super();
        this._settingsSearchService = _settingsSearchService;
        this._registrations = this._register(new DisposableMap());
        this._proxy = context.getProxy(ExtHostContext.ExtHostAiSettingsSearch);
    }
    $registerAiSettingsSearchProvider(handle) {
        const provider = {
            searchSettings: (query, option, token) => {
                return this._proxy.$startSearch(handle, query, option, token);
            }
        };
        this._registrations.set(handle, this._settingsSearchService.registerSettingsSearchProvider(provider));
    }
    $unregisterAiSettingsSearchProvider(handle) {
        this._registrations.deleteAndDispose(handle);
    }
    $handleSearchResult(handle, result) {
        if (!this._registrations.has(handle)) {
            throw new Error(`No AI settings search provider found`);
        }
        this._settingsSearchService.handleSearchResult(result);
    }
};
MainThreadAiSettingsSearch = __decorate([
    extHostNamedCustomer(MainContext.MainThreadAiSettingsSearch),
    __param(1, IAiSettingsSearchService)
], MainThreadAiSettingsSearch);
export { MainThreadAiSettingsSearch };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZEFpU2V0dGluZ3NTZWFyY2guanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9icm93c2VyL21haW5UaHJlYWRBaVNldHRpbmdzU2VhcmNoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUUsT0FBTyxFQUFFLG9CQUFvQixFQUFtQixNQUFNLHNEQUFzRCxDQUFDO0FBQzdHLE9BQU8sRUFBcUQsd0JBQXdCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUN6SixPQUFPLEVBQUUsY0FBYyxFQUFnQyxXQUFXLEdBQW9DLE1BQU0sK0JBQStCLENBQUM7QUFHckksSUFBTSwwQkFBMEIsR0FBaEMsTUFBTSwwQkFBMkIsU0FBUSxVQUFVO0lBSXpELFlBQ0MsT0FBd0IsRUFDRSxzQkFBaUU7UUFFM0YsS0FBSyxFQUFFLENBQUM7UUFGbUMsMkJBQXNCLEdBQXRCLHNCQUFzQixDQUEwQjtRQUozRSxtQkFBYyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxhQUFhLEVBQVUsQ0FBQyxDQUFDO1FBTzdFLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsdUJBQXVCLENBQUMsQ0FBQztJQUN4RSxDQUFDO0lBRUQsaUNBQWlDLENBQUMsTUFBYztRQUMvQyxNQUFNLFFBQVEsR0FBOEI7WUFDM0MsY0FBYyxFQUFFLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRTtnQkFDeEMsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztZQUMvRCxDQUFDO1NBQ0QsQ0FBQztRQUNGLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsc0JBQXNCLENBQUMsOEJBQThCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUN2RyxDQUFDO0lBRUQsbUNBQW1DLENBQUMsTUFBYztRQUNqRCxJQUFJLENBQUMsY0FBYyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRCxtQkFBbUIsQ0FBQyxNQUFjLEVBQUUsTUFBOEI7UUFDakUsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDdEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO1FBQ3pELENBQUM7UUFFRCxJQUFJLENBQUMsc0JBQXNCLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDeEQsQ0FBQztDQUNELENBQUE7QUFoQ1ksMEJBQTBCO0lBRHRDLG9CQUFvQixDQUFDLFdBQVcsQ0FBQywwQkFBMEIsQ0FBQztJQU8xRCxXQUFBLHdCQUF3QixDQUFBO0dBTmQsMEJBQTBCLENBZ0N0QyJ9