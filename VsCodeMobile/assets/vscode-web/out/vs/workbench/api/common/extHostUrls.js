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
var ExtHostUrls_1;
import { MainContext } from './extHost.protocol.js';
import { URI } from '../../../base/common/uri.js';
import { toDisposable } from '../../../base/common/lifecycle.js';
import { onUnexpectedError } from '../../../base/common/errors.js';
import { ExtensionIdentifierSet } from '../../../platform/extensions/common/extensions.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { IExtHostRpcService } from './extHostRpcService.js';
let ExtHostUrls = class ExtHostUrls {
    static { ExtHostUrls_1 = this; }
    static { this.HandlePool = 0; }
    constructor(extHostRpc) {
        this.handles = new ExtensionIdentifierSet();
        this.handlers = new Map();
        this._proxy = extHostRpc.getProxy(MainContext.MainThreadUrls);
    }
    registerUriHandler(extension, handler) {
        const extensionId = extension.identifier;
        if (this.handles.has(extensionId)) {
            throw new Error(`Protocol handler already registered for extension ${extensionId}`);
        }
        const handle = ExtHostUrls_1.HandlePool++;
        this.handles.add(extensionId);
        this.handlers.set(handle, handler);
        this._proxy.$registerUriHandler(handle, extensionId, extension.displayName || extension.name);
        return toDisposable(() => {
            this.handles.delete(extensionId);
            this.handlers.delete(handle);
            this._proxy.$unregisterUriHandler(handle);
        });
    }
    $handleExternalUri(handle, uri) {
        const handler = this.handlers.get(handle);
        if (!handler) {
            return Promise.resolve(undefined);
        }
        try {
            handler.handleUri(URI.revive(uri));
        }
        catch (err) {
            onUnexpectedError(err);
        }
        return Promise.resolve(undefined);
    }
    async createAppUri(uri) {
        return URI.revive(await this._proxy.$createAppUri(uri));
    }
};
ExtHostUrls = ExtHostUrls_1 = __decorate([
    __param(0, IExtHostRpcService)
], ExtHostUrls);
export { ExtHostUrls };
export const IExtHostUrlsService = createDecorator('IExtHostUrlsService');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdFVybHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9jb21tb24vZXh0SG9zdFVybHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxXQUFXLEVBQXlDLE1BQU0sdUJBQXVCLENBQUM7QUFDM0YsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSw2QkFBNkIsQ0FBQztBQUNqRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDakUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDbkUsT0FBTyxFQUFFLHNCQUFzQixFQUF5QixNQUFNLG1EQUFtRCxDQUFDO0FBQ2xILE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUVyRCxJQUFNLFdBQVcsR0FBakIsTUFBTSxXQUFXOzthQUlSLGVBQVUsR0FBRyxDQUFDLEFBQUosQ0FBSztJQU05QixZQUNxQixVQUE4QjtRQUozQyxZQUFPLEdBQUcsSUFBSSxzQkFBc0IsRUFBRSxDQUFDO1FBQ3ZDLGFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBNkIsQ0FBQztRQUt2RCxJQUFJLENBQUMsTUFBTSxHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQy9ELENBQUM7SUFFRCxrQkFBa0IsQ0FBQyxTQUFnQyxFQUFFLE9BQTBCO1FBQzlFLE1BQU0sV0FBVyxHQUFHLFNBQVMsQ0FBQyxVQUFVLENBQUM7UUFDekMsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO1lBQ25DLE1BQU0sSUFBSSxLQUFLLENBQUMscURBQXFELFdBQVcsRUFBRSxDQUFDLENBQUM7UUFDckYsQ0FBQztRQUVELE1BQU0sTUFBTSxHQUFHLGFBQVcsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM5QixJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDbkMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsV0FBVyxFQUFFLFNBQVMsQ0FBQyxXQUFXLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTlGLE9BQU8sWUFBWSxDQUFDLEdBQUcsRUFBRTtZQUN4QixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUNqQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM3QixJQUFJLENBQUMsTUFBTSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzNDLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELGtCQUFrQixDQUFDLE1BQWMsRUFBRSxHQUFrQjtRQUNwRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUUxQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDZCxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDbkMsQ0FBQztRQUNELElBQUksQ0FBQztZQUNKLE9BQU8sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3BDLENBQUM7UUFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1lBQ2QsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDeEIsQ0FBQztRQUVELE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRUQsS0FBSyxDQUFDLFlBQVksQ0FBQyxHQUFRO1FBQzFCLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDekQsQ0FBQzs7QUFuRFcsV0FBVztJQVdyQixXQUFBLGtCQUFrQixDQUFBO0dBWFIsV0FBVyxDQW9EdkI7O0FBR0QsTUFBTSxDQUFDLE1BQU0sbUJBQW1CLEdBQUcsZUFBZSxDQUFzQixxQkFBcUIsQ0FBQyxDQUFDIn0=