/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from '../../../../../base/common/event.js';
export class NullWorkbenchAssignmentService {
    constructor() {
        this.onDidRefetchAssignments = Event.None;
    }
    async getCurrentExperiments() {
        return [];
    }
    async getTreatment(name) {
        return undefined;
    }
    addTelemetryAssignmentFilter(filter) { }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibnVsbEFzc2lnbm1lbnRTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9hc3NpZ25tZW50L3Rlc3QvY29tbW9uL251bGxBc3NpZ25tZW50U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFHNUQsTUFBTSxPQUFPLDhCQUE4QjtJQUEzQztRQUdVLDRCQUF1QixHQUFnQixLQUFLLENBQUMsSUFBSSxDQUFDO0lBVzVELENBQUM7SUFUQSxLQUFLLENBQUMscUJBQXFCO1FBQzFCLE9BQU8sRUFBRSxDQUFDO0lBQ1gsQ0FBQztJQUVELEtBQUssQ0FBQyxZQUFZLENBQXNDLElBQVk7UUFDbkUsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVELDRCQUE0QixDQUFDLE1BQXlCLElBQVUsQ0FBQztDQUNqRSJ9