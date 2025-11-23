/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from '../../../../base/common/event.js';
import { getCodiconAriaLabel } from '../../../../base/common/iconLabels.js';
import { localize } from '../../../../nls.js';
/**
 * Accessibility provider for QuickTree.
 */
export class QuickTreeAccessibilityProvider {
    constructor(onCheckedEvent) {
        this.onCheckedEvent = onCheckedEvent;
    }
    getWidgetAriaLabel() {
        return localize('quickTree', "Quick Tree");
    }
    getAriaLabel(element) {
        return element.ariaLabel || [element.label, element.description]
            .map(s => getCodiconAriaLabel(s))
            .filter(s => !!s)
            .join(', ');
    }
    getWidgetRole() {
        return 'tree';
    }
    getRole(_element) {
        return 'checkbox';
    }
    isChecked(element) {
        return {
            get value() { return element.checked === 'mixed' ? 'mixed' : !!element.checked; },
            onDidChange: e => Event.filter(this.onCheckedEvent, e => e.item === element)(_ => e()),
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVpY2tJbnB1dFRyZWVBY2Nlc3NpYmlsaXR5UHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vcXVpY2tpbnB1dC9icm93c2VyL3RyZWUvcXVpY2tJbnB1dFRyZWVBY2Nlc3NpYmlsaXR5UHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFLaEcsT0FBTyxFQUFFLEtBQUssRUFBeUIsTUFBTSxrQ0FBa0MsQ0FBQztBQUNoRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFOUM7O0dBRUc7QUFDSCxNQUFNLE9BQU8sOEJBQThCO0lBQzFDLFlBQTZCLGNBQWlEO1FBQWpELG1CQUFjLEdBQWQsY0FBYyxDQUFtQztJQUFJLENBQUM7SUFFbkYsa0JBQWtCO1FBQ2pCLE9BQU8sUUFBUSxDQUFDLFdBQVcsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBRUQsWUFBWSxDQUFDLE9BQVU7UUFDdEIsT0FBTyxPQUFPLENBQUMsU0FBUyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsV0FBVyxDQUFDO2FBQzlELEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ2hDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2QsQ0FBQztJQUVELGFBQWE7UUFDWixPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFFRCxPQUFPLENBQUMsUUFBVztRQUNsQixPQUFPLFVBQVUsQ0FBQztJQUNuQixDQUFDO0lBRUQsU0FBUyxDQUFDLE9BQVU7UUFDbkIsT0FBTztZQUNOLElBQUksS0FBSyxLQUFLLE9BQU8sT0FBTyxDQUFDLE9BQU8sS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2pGLFdBQVcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQztTQUN0RixDQUFDO0lBQ0gsQ0FBQztDQUNEIn0=