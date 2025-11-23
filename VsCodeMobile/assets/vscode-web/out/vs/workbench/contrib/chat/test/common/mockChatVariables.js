/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ResourceMap } from '../../../../../base/common/map.js';
export class MockChatVariablesService {
    constructor() {
        this._dynamicVariables = new ResourceMap();
        this._selectedToolAndToolSets = new ResourceMap();
    }
    getDynamicVariables(sessionResource) {
        return this._dynamicVariables.get(sessionResource) ?? [];
    }
    getSelectedToolAndToolSets(sessionResource) {
        return this._selectedToolAndToolSets.get(sessionResource) ?? new Map();
    }
    setDynamicVariables(sessionResource, variables) {
        this._dynamicVariables.set(sessionResource, variables);
    }
    setSelectedToolAndToolSets(sessionResource, tools) {
        this._selectedToolAndToolSets.set(sessionResource, tools);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja0NoYXRWYXJpYWJsZXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2NvbW1vbi9tb2NrQ2hhdFZhcmlhYmxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFLaEUsTUFBTSxPQUFPLHdCQUF3QjtJQUFyQztRQUdTLHNCQUFpQixHQUFHLElBQUksV0FBVyxFQUErQixDQUFDO1FBQ25FLDZCQUF3QixHQUFHLElBQUksV0FBVyxFQUFnQyxDQUFDO0lBaUJwRixDQUFDO0lBZkEsbUJBQW1CLENBQUMsZUFBb0I7UUFDdkMsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUMxRCxDQUFDO0lBRUQsMEJBQTBCLENBQUMsZUFBb0I7UUFDOUMsT0FBTyxJQUFJLENBQUMsd0JBQXdCLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLElBQUksR0FBRyxFQUFFLENBQUM7SUFDeEUsQ0FBQztJQUVELG1CQUFtQixDQUFDLGVBQW9CLEVBQUUsU0FBc0M7UUFDL0UsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDeEQsQ0FBQztJQUVELDBCQUEwQixDQUFDLGVBQW9CLEVBQUUsS0FBbUM7UUFDbkYsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDM0QsQ0FBQztDQUNEIn0=