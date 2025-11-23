/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { URI } from '../../../../base/common/uri.js';
export function isChatViewTitleActionContext(obj) {
    return !!obj &&
        URI.isUri(obj.sessionResource)
        && obj.$mid === 19 /* MarshalledId.ChatViewContext */;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEFjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vY2hhdEFjdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBT3JELE1BQU0sVUFBVSw0QkFBNEIsQ0FBQyxHQUFZO0lBQ3hELE9BQU8sQ0FBQyxDQUFDLEdBQUc7UUFDWCxHQUFHLENBQUMsS0FBSyxDQUFFLEdBQW1DLENBQUMsZUFBZSxDQUFDO1dBQzNELEdBQW1DLENBQUMsSUFBSSwwQ0FBaUMsQ0FBQztBQUNoRixDQUFDIn0=