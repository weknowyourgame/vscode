/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { preferredSideBySideGroupDirection } from './editorGroupsService.js';
import { ACTIVE_GROUP, AUX_WINDOW_GROUP, SIDE_GROUP } from './editorService.js';
export function columnToEditorGroup(editorGroupService, configurationService, column = ACTIVE_GROUP) {
    if (column === ACTIVE_GROUP || column === SIDE_GROUP || column === AUX_WINDOW_GROUP) {
        return column; // return early for when column is well known
    }
    let groupInColumn = editorGroupService.getGroups(2 /* GroupsOrder.GRID_APPEARANCE */)[column];
    // If a column is asked for that does not exist, we create up to 9 columns in accordance
    // to what `ViewColumn` provides and otherwise fallback to `SIDE_GROUP`.
    if (!groupInColumn && column < 9) {
        for (let i = 0; i <= column; i++) {
            const editorGroups = editorGroupService.getGroups(2 /* GroupsOrder.GRID_APPEARANCE */);
            if (!editorGroups[i]) {
                editorGroupService.addGroup(editorGroups[i - 1], preferredSideBySideGroupDirection(configurationService));
            }
        }
        groupInColumn = editorGroupService.getGroups(2 /* GroupsOrder.GRID_APPEARANCE */)[column];
    }
    return groupInColumn?.id ?? SIDE_GROUP; // finally open to the side when group not found
}
export function editorGroupToColumn(editorGroupService, editorGroup) {
    const group = (typeof editorGroup === 'number') ? editorGroupService.getGroup(editorGroup) : editorGroup;
    return editorGroupService.getGroups(2 /* GroupsOrder.GRID_APPEARANCE */).indexOf(group ?? editorGroupService.activeGroup);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yR3JvdXBDb2x1bW4uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBDb2x1bW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFJaEcsT0FBTyxFQUFtRCxpQ0FBaUMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzlILE9BQU8sRUFBRSxZQUFZLEVBQXFCLGdCQUFnQixFQUFFLFVBQVUsRUFBbUIsTUFBTSxvQkFBb0IsQ0FBQztBQVNwSCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsa0JBQXdDLEVBQUUsb0JBQTJDLEVBQUUsTUFBTSxHQUFHLFlBQVk7SUFDL0ksSUFBSSxNQUFNLEtBQUssWUFBWSxJQUFJLE1BQU0sS0FBSyxVQUFVLElBQUksTUFBTSxLQUFLLGdCQUFnQixFQUFFLENBQUM7UUFDckYsT0FBTyxNQUFNLENBQUMsQ0FBQyw2Q0FBNkM7SUFDN0QsQ0FBQztJQUVELElBQUksYUFBYSxHQUFHLGtCQUFrQixDQUFDLFNBQVMscUNBQTZCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFdEYsd0ZBQXdGO0lBQ3hGLHdFQUF3RTtJQUV4RSxJQUFJLENBQUMsYUFBYSxJQUFJLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztRQUNsQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDbEMsTUFBTSxZQUFZLEdBQUcsa0JBQWtCLENBQUMsU0FBUyxxQ0FBNkIsQ0FBQztZQUMvRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3RCLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLGlDQUFpQyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztZQUMzRyxDQUFDO1FBQ0YsQ0FBQztRQUVELGFBQWEsR0FBRyxrQkFBa0IsQ0FBQyxTQUFTLHFDQUE2QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ25GLENBQUM7SUFFRCxPQUFPLGFBQWEsRUFBRSxFQUFFLElBQUksVUFBVSxDQUFDLENBQUMsZ0RBQWdEO0FBQ3pGLENBQUM7QUFFRCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsa0JBQXdDLEVBQUUsV0FBMkM7SUFDeEgsTUFBTSxLQUFLLEdBQUcsQ0FBQyxPQUFPLFdBQVcsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUM7SUFFekcsT0FBTyxrQkFBa0IsQ0FBQyxTQUFTLHFDQUE2QixDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksa0JBQWtCLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDbkgsQ0FBQyJ9