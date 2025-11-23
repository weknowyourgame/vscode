/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../base/common/codicons.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { activityErrorBadgeBackground, activityErrorBadgeForeground, activityWarningBadgeBackground, activityWarningBadgeForeground } from '../../../../platform/theme/common/colors/miscColors.js';
export const IActivityService = createDecorator('activityService');
class BaseBadge {
    constructor(descriptorFn, stylesFn) {
        this.descriptorFn = descriptorFn;
        this.stylesFn = stylesFn;
    }
    getDescription() {
        return this.descriptorFn(null);
    }
    getColors(theme) {
        return this.stylesFn?.(theme);
    }
}
export class NumberBadge extends BaseBadge {
    constructor(number, descriptorFn) {
        super(descriptorFn, undefined);
        this.number = number;
        this.number = number;
    }
    getDescription() {
        return this.descriptorFn(this.number);
    }
}
export class IconBadge extends BaseBadge {
    constructor(icon, descriptorFn, stylesFn) {
        super(descriptorFn, stylesFn);
        this.icon = icon;
    }
}
export class ProgressBadge extends BaseBadge {
    constructor(descriptorFn) {
        super(descriptorFn, undefined);
    }
}
export class WarningBadge extends IconBadge {
    constructor(descriptorFn) {
        super(Codicon.warning, descriptorFn, (theme) => ({
            badgeBackground: theme.getColor(activityWarningBadgeBackground),
            badgeForeground: theme.getColor(activityWarningBadgeForeground),
            badgeBorder: undefined,
        }));
    }
}
export class ErrorBadge extends IconBadge {
    constructor(descriptorFn) {
        super(Codicon.error, descriptorFn, (theme) => ({
            badgeBackground: theme.getColor(activityErrorBadgeBackground),
            badgeForeground: theme.getColor(activityErrorBadgeForeground),
            badgeBorder: undefined,
        }));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aXZpdHkuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL2FjdGl2aXR5L2NvbW1vbi9hY3Rpdml0eS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFLOUQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSw0QkFBNEIsRUFBRSw4QkFBOEIsRUFBRSw4QkFBOEIsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBUXBNLE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFHLGVBQWUsQ0FBbUIsaUJBQWlCLENBQUMsQ0FBQztBQXFEckYsTUFBTSxTQUFTO0lBRWQsWUFDb0IsWUFBZ0MsRUFDbEMsUUFBd0U7UUFEdEUsaUJBQVksR0FBWixZQUFZLENBQW9CO1FBQ2xDLGFBQVEsR0FBUixRQUFRLENBQWdFO0lBRTFGLENBQUM7SUFFRCxjQUFjO1FBQ2IsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQVMsQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFFRCxTQUFTLENBQUMsS0FBa0I7UUFDM0IsT0FBTyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDL0IsQ0FBQztDQUNEO0FBRUQsTUFBTSxPQUFPLFdBQVksU0FBUSxTQUFpQjtJQUVqRCxZQUFxQixNQUFjLEVBQUUsWUFBcUM7UUFDekUsS0FBSyxDQUFDLFlBQVksRUFBRSxTQUFTLENBQUMsQ0FBQztRQURYLFdBQU0sR0FBTixNQUFNLENBQVE7UUFHbEMsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7SUFDdEIsQ0FBQztJQUVRLGNBQWM7UUFDdEIsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN2QyxDQUFDO0NBQ0Q7QUFFRCxNQUFNLE9BQU8sU0FBVSxTQUFRLFNBQWU7SUFDN0MsWUFDVSxJQUFlLEVBQ3hCLFlBQTBCLEVBQzFCLFFBQTJEO1FBRTNELEtBQUssQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFKckIsU0FBSSxHQUFKLElBQUksQ0FBVztJQUt6QixDQUFDO0NBQ0Q7QUFFRCxNQUFNLE9BQU8sYUFBYyxTQUFRLFNBQWU7SUFDakQsWUFBWSxZQUEwQjtRQUNyQyxLQUFLLENBQUMsWUFBWSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ2hDLENBQUM7Q0FDRDtBQUVELE1BQU0sT0FBTyxZQUFhLFNBQVEsU0FBUztJQUMxQyxZQUFZLFlBQTBCO1FBQ3JDLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBRSxDQUFDLEtBQWtCLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDN0QsZUFBZSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsOEJBQThCLENBQUM7WUFDL0QsZUFBZSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsOEJBQThCLENBQUM7WUFDL0QsV0FBVyxFQUFFLFNBQVM7U0FDdEIsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Q7QUFFRCxNQUFNLE9BQU8sVUFBVyxTQUFRLFNBQVM7SUFDeEMsWUFBWSxZQUEwQjtRQUNyQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxZQUFZLEVBQUUsQ0FBQyxLQUFrQixFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzNELGVBQWUsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLDRCQUE0QixDQUFDO1lBQzdELGVBQWUsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLDRCQUE0QixDQUFDO1lBQzdELFdBQVcsRUFBRSxTQUFTO1NBQ3RCLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNEIn0=