/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { language } from '../../../../base/common/platform.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { safeIntl } from '../../../../base/common/date.js';
let localHistoryDateFormatter = undefined;
export function getLocalHistoryDateFormatter() {
    if (!localHistoryDateFormatter) {
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
        const formatter = safeIntl.DateTimeFormat(language, options).value;
        localHistoryDateFormatter = {
            format: date => formatter.format(date)
        };
    }
    return localHistoryDateFormatter;
}
export const LOCAL_HISTORY_MENU_CONTEXT_VALUE = 'localHistory:item';
export const LOCAL_HISTORY_MENU_CONTEXT_KEY = ContextKeyExpr.equals('timelineItem', LOCAL_HISTORY_MENU_CONTEXT_VALUE);
export const LOCAL_HISTORY_ICON_ENTRY = registerIcon('localHistory-icon', Codicon.circleOutline, localize('localHistoryIcon', "Icon for a local history entry in the timeline view."));
export const LOCAL_HISTORY_ICON_RESTORE = registerIcon('localHistory-restore', Codicon.check, localize('localHistoryRestore', "Icon for restoring contents of a local history entry."));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYWxIaXN0b3J5LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2xvY2FsSGlzdG9yeS9icm93c2VyL2xvY2FsSGlzdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdEYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQU0zRCxJQUFJLHlCQUF5QixHQUEyQyxTQUFTLENBQUM7QUFFbEYsTUFBTSxVQUFVLDRCQUE0QjtJQUMzQyxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztRQUNoQyxNQUFNLE9BQU8sR0FBK0IsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQztRQUNuSSxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFDbkUseUJBQXlCLEdBQUc7WUFDM0IsTUFBTSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7U0FDdEMsQ0FBQztJQUNILENBQUM7SUFFRCxPQUFPLHlCQUF5QixDQUFDO0FBQ2xDLENBQUM7QUFFRCxNQUFNLENBQUMsTUFBTSxnQ0FBZ0MsR0FBRyxtQkFBbUIsQ0FBQztBQUNwRSxNQUFNLENBQUMsTUFBTSw4QkFBOEIsR0FBRyxjQUFjLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxnQ0FBZ0MsQ0FBQyxDQUFDO0FBRXRILE1BQU0sQ0FBQyxNQUFNLHdCQUF3QixHQUFHLFlBQVksQ0FBQyxtQkFBbUIsRUFBRSxPQUFPLENBQUMsYUFBYSxFQUFFLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSxzREFBc0QsQ0FBQyxDQUFDLENBQUM7QUFDdkwsTUFBTSxDQUFDLE1BQU0sMEJBQTBCLEdBQUcsWUFBWSxDQUFDLHNCQUFzQixFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLHFCQUFxQixFQUFFLHVEQUF1RCxDQUFDLENBQUMsQ0FBQyJ9