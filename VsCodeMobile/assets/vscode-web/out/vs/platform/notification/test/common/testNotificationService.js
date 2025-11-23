/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from '../../../../base/common/event.js';
import { NoOpNotification, NotificationsFilter, Severity } from '../../common/notification.js';
export class TestNotificationService {
    constructor() {
        this.onDidChangeFilter = Event.None;
    }
    static { this.NO_OP = new NoOpNotification(); }
    info(message) {
        return this.notify({ severity: Severity.Info, message });
    }
    warn(message) {
        return this.notify({ severity: Severity.Warning, message });
    }
    error(error) {
        return this.notify({ severity: Severity.Error, message: error });
    }
    notify(notification) {
        return TestNotificationService.NO_OP;
    }
    prompt(severity, message, choices, options) {
        return TestNotificationService.NO_OP;
    }
    status(message, options) {
        return {
            close: () => { }
        };
    }
    setFilter() { }
    getFilter(source) {
        return NotificationsFilter.OFF;
    }
    getFilters() {
        return [];
    }
    removeFilter(sourceId) { }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdE5vdGlmaWNhdGlvblNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vbm90aWZpY2F0aW9uL3Rlc3QvY29tbW9uL3Rlc3ROb3RpZmljYXRpb25TZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQWlMLGdCQUFnQixFQUFFLG1CQUFtQixFQUFFLFFBQVEsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRTlRLE1BQU0sT0FBTyx1QkFBdUI7SUFBcEM7UUFFVSxzQkFBaUIsR0FBZ0IsS0FBSyxDQUFDLElBQUksQ0FBQztJQTJDdEQsQ0FBQzthQXZDd0IsVUFBSyxHQUF3QixJQUFJLGdCQUFnQixFQUFFLEFBQTlDLENBQStDO0lBRTVFLElBQUksQ0FBQyxPQUFlO1FBQ25CLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDMUQsQ0FBQztJQUVELElBQUksQ0FBQyxPQUFlO1FBQ25CLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUVELEtBQUssQ0FBQyxLQUFxQjtRQUMxQixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUNsRSxDQUFDO0lBRUQsTUFBTSxDQUFDLFlBQTJCO1FBQ2pDLE9BQU8sdUJBQXVCLENBQUMsS0FBSyxDQUFDO0lBQ3RDLENBQUM7SUFFRCxNQUFNLENBQUMsUUFBa0IsRUFBRSxPQUFlLEVBQUUsT0FBd0IsRUFBRSxPQUF3QjtRQUM3RixPQUFPLHVCQUF1QixDQUFDLEtBQUssQ0FBQztJQUN0QyxDQUFDO0lBRUQsTUFBTSxDQUFDLE9BQXVCLEVBQUUsT0FBK0I7UUFDOUQsT0FBTztZQUNOLEtBQUssRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO1NBQ2hCLENBQUM7SUFDSCxDQUFDO0lBRUQsU0FBUyxLQUFXLENBQUM7SUFFckIsU0FBUyxDQUFDLE1BQXdDO1FBQ2pELE9BQU8sbUJBQW1CLENBQUMsR0FBRyxDQUFDO0lBQ2hDLENBQUM7SUFFRCxVQUFVO1FBQ1QsT0FBTyxFQUFFLENBQUM7SUFDWCxDQUFDO0lBRUQsWUFBWSxDQUFDLFFBQWdCLElBQVUsQ0FBQyJ9