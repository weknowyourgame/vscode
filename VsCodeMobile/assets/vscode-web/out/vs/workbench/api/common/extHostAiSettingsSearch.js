/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { MainContext } from './extHost.protocol.js';
import { Disposable } from './extHostTypes.js';
import { Progress } from '../../../platform/progress/common/progress.js';
import { AiSettingsSearch } from './extHostTypeConverters.js';
export class ExtHostAiSettingsSearch {
    constructor(mainContext) {
        this._settingsSearchProviders = new Map();
        this._nextHandle = 0;
        this._proxy = mainContext.getProxy(MainContext.MainThreadAiSettingsSearch);
    }
    async $startSearch(handle, query, option, token) {
        if (this._settingsSearchProviders.size === 0) {
            throw new Error('No related information providers registered');
        }
        const provider = this._settingsSearchProviders.get(handle);
        if (!provider) {
            throw new Error('Settings search provider not found');
        }
        const progressReporter = new Progress((data) => {
            this._proxy.$handleSearchResult(handle, AiSettingsSearch.fromSettingsSearchResult(data));
        });
        return provider.provideSettingsSearchResults(query, option, progressReporter, token);
    }
    registerSettingsSearchProvider(extension, provider) {
        const handle = this._nextHandle;
        this._nextHandle++;
        this._settingsSearchProviders.set(handle, provider);
        this._proxy.$registerAiSettingsSearchProvider(handle);
        return new Disposable(() => {
            this._proxy.$unregisterAiSettingsSearchProvider(handle);
            this._settingsSearchProviders.delete(handle);
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdEFpU2V0dGluZ3NTZWFyY2guanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9jb21tb24vZXh0SG9zdEFpU2V0dGluZ3NTZWFyY2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFNaEcsT0FBTyxFQUE4QyxXQUFXLEVBQW1DLE1BQU0sdUJBQXVCLENBQUM7QUFDakksT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQy9DLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUU5RCxNQUFNLE9BQU8sdUJBQXVCO0lBTW5DLFlBQVksV0FBeUI7UUFMN0IsNkJBQXdCLEdBQXdDLElBQUksR0FBRyxFQUFFLENBQUM7UUFDMUUsZ0JBQVcsR0FBRyxDQUFDLENBQUM7UUFLdkIsSUFBSSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0lBQzVFLENBQUM7SUFFRCxLQUFLLENBQUMsWUFBWSxDQUFDLE1BQWMsRUFBRSxLQUFhLEVBQUUsTUFBdUMsRUFBRSxLQUF3QjtRQUNsSCxJQUFJLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDOUMsTUFBTSxJQUFJLEtBQUssQ0FBQyw2Q0FBNkMsQ0FBQyxDQUFDO1FBQ2hFLENBQUM7UUFFRCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzNELElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNmLE1BQU0sSUFBSSxLQUFLLENBQUMsb0NBQW9DLENBQUMsQ0FBQztRQUN2RCxDQUFDO1FBRUQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLFFBQVEsQ0FBdUIsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUNwRSxJQUFJLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sRUFBRSxnQkFBZ0IsQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQzFGLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxRQUFRLENBQUMsNEJBQTRCLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUN0RixDQUFDO0lBRUQsOEJBQThCLENBQUMsU0FBZ0MsRUFBRSxRQUFnQztRQUNoRyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDO1FBQ2hDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNuQixJQUFJLENBQUMsd0JBQXdCLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsTUFBTSxDQUFDLGlDQUFpQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3RELE9BQU8sSUFBSSxVQUFVLENBQUMsR0FBRyxFQUFFO1lBQzFCLElBQUksQ0FBQyxNQUFNLENBQUMsbUNBQW1DLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDeEQsSUFBSSxDQUFDLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM5QyxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7Q0FDRCJ9