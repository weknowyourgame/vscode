/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { UriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentityService.js';
import { TestFileService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { DebugModel } from '../../common/debugModel.js';
import { MockDebugStorage } from '../common/mockDebug.js';
const fileService = new TestFileService();
export const mockUriIdentityService = new UriIdentityService(fileService);
export function createMockDebugModel(disposable) {
    const storage = disposable.add(new TestStorageService());
    const debugStorage = disposable.add(new MockDebugStorage(storage));
    return disposable.add(new DebugModel(debugStorage, upcastPartial({ isDirty: (e) => false }), mockUriIdentityService, new NullLogService()));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja0RlYnVnTW9kZWwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZGVidWcvdGVzdC9icm93c2VyL21vY2tEZWJ1Z01vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFFdEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUN4RCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUUxRCxNQUFNLFdBQVcsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO0FBQzFDLE1BQU0sQ0FBQyxNQUFNLHNCQUFzQixHQUFHLElBQUksa0JBQWtCLENBQUMsV0FBVyxDQUFDLENBQUM7QUFFMUUsTUFBTSxVQUFVLG9CQUFvQixDQUFDLFVBQXdDO0lBQzVFLE1BQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxrQkFBa0IsRUFBRSxDQUFDLENBQUM7SUFDekQsTUFBTSxZQUFZLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDbkUsT0FBTyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksVUFBVSxDQUFDLFlBQVksRUFBRSxhQUFhLENBQW1CLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBVSxFQUFFLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxFQUFFLHNCQUFzQixFQUFFLElBQUksY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3hLLENBQUMifQ==