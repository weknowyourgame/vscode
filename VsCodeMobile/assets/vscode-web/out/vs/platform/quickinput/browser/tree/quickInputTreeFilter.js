/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { matchesFuzzyIconAware, parseLabelWithIcons } from '../../../../base/common/iconLabels.js';
export class QuickInputTreeFilter {
    constructor() {
        this.filterValue = '';
        this.matchOnLabel = true;
        this.matchOnDescription = false;
    }
    filter(element, parentVisibility) {
        if (!this.filterValue || !(this.matchOnLabel || this.matchOnDescription)) {
            return element.children
                ? { visibility: 2 /* TreeVisibility.Recurse */, data: {} }
                : { visibility: 1 /* TreeVisibility.Visible */, data: {} };
        }
        const labelHighlights = this.matchOnLabel ? matchesFuzzyIconAware(this.filterValue, parseLabelWithIcons(element.label)) ?? undefined : undefined;
        const descriptionHighlights = this.matchOnDescription ? matchesFuzzyIconAware(this.filterValue, parseLabelWithIcons(element.description || '')) ?? undefined : undefined;
        const visibility = parentVisibility === 1 /* TreeVisibility.Visible */
            // Parent is visible because it had matches, so we show all children
            ? 1 /* TreeVisibility.Visible */
            // This would only happen on Parent is recurse so...
            : (labelHighlights || descriptionHighlights)
                // If we have any highlights, we are visible
                ? 1 /* TreeVisibility.Visible */
                // Otherwise, we defer to the children or if no children, we are hidden
                : element.children
                    ? 2 /* TreeVisibility.Recurse */
                    : 0 /* TreeVisibility.Hidden */;
        return {
            visibility,
            data: {
                labelHighlights,
                descriptionHighlights
            }
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVpY2tJbnB1dFRyZWVGaWx0ZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vcXVpY2tpbnB1dC9icm93c2VyL3RyZWUvcXVpY2tJbnB1dFRyZWVGaWx0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLG1CQUFtQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFJbkcsTUFBTSxPQUFPLG9CQUFvQjtJQUFqQztRQUNDLGdCQUFXLEdBQVcsRUFBRSxDQUFDO1FBQ3pCLGlCQUFZLEdBQVksSUFBSSxDQUFDO1FBQzdCLHVCQUFrQixHQUFZLEtBQUssQ0FBQztJQWdDckMsQ0FBQztJQTlCQSxNQUFNLENBQUMsT0FBdUIsRUFBRSxnQkFBZ0M7UUFDL0QsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLElBQUksSUFBSSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsQ0FBQztZQUMxRSxPQUFPLE9BQU8sQ0FBQyxRQUFRO2dCQUN0QixDQUFDLENBQUMsRUFBRSxVQUFVLGdDQUF3QixFQUFFLElBQUksRUFBRSxFQUFFLEVBQUU7Z0JBQ2xELENBQUMsQ0FBQyxFQUFFLFVBQVUsZ0NBQXdCLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxDQUFDO1FBQ3JELENBQUM7UUFFRCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ2pKLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxXQUFXLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUV6SyxNQUFNLFVBQVUsR0FBRyxnQkFBZ0IsbUNBQTJCO1lBQzdELG9FQUFvRTtZQUNwRSxDQUFDO1lBQ0Qsb0RBQW9EO1lBQ3BELENBQUMsQ0FBQyxDQUFDLGVBQWUsSUFBSSxxQkFBcUIsQ0FBQztnQkFDM0MsNENBQTRDO2dCQUM1QyxDQUFDO2dCQUNELHVFQUF1RTtnQkFDdkUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRO29CQUNqQixDQUFDO29CQUNELENBQUMsOEJBQXNCLENBQUM7UUFFM0IsT0FBTztZQUNOLFVBQVU7WUFDVixJQUFJLEVBQUU7Z0JBQ0wsZUFBZTtnQkFDZixxQkFBcUI7YUFDckI7U0FDRCxDQUFDO0lBQ0gsQ0FBQztDQUNEIn0=