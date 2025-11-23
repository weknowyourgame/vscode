/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as dom from '../../../../base/browser/dom.js';
export function isMousePositionWithinElement(element, posx, posy) {
    const elementRect = dom.getDomNodePagePosition(element);
    if (posx < elementRect.left
        || posx > elementRect.left + elementRect.width
        || posy < elementRect.top
        || posy > elementRect.top + elementRect.height) {
        return false;
    }
    return true;
}
/**
 * Determines whether hover should be shown based on the hover setting and current keyboard modifiers.
 * When `hoverEnabled` is 'onKeyboardModifier', hover is shown when the user presses the opposite
 * modifier key from the multi-cursor modifier (e.g., if multi-cursor uses Alt, hover shows on Ctrl/Cmd).
 *
 * @param hoverEnabled - The hover enabled setting
 * @param multiCursorModifier - The modifier key used for multi-cursor operations
 * @param mouseEvent - The current mouse event containing modifier key states
 * @returns true if hover should be shown, false otherwise
 */
export function shouldShowHover(hoverEnabled, multiCursorModifier, mouseEvent) {
    if (hoverEnabled === 'on') {
        return true;
    }
    if (hoverEnabled === 'off') {
        return false;
    }
    if (multiCursorModifier === 'altKey') {
        return mouseEvent.event.ctrlKey || mouseEvent.event.metaKey;
    }
    else {
        return mouseEvent.event.altKey;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG92ZXJVdGlscy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL2hvdmVyVXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUd2RCxNQUFNLFVBQVUsNEJBQTRCLENBQUMsT0FBb0IsRUFBRSxJQUFZLEVBQUUsSUFBWTtJQUM1RixNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsc0JBQXNCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDeEQsSUFBSSxJQUFJLEdBQUcsV0FBVyxDQUFDLElBQUk7V0FDdkIsSUFBSSxHQUFHLFdBQVcsQ0FBQyxJQUFJLEdBQUcsV0FBVyxDQUFDLEtBQUs7V0FDM0MsSUFBSSxHQUFHLFdBQVcsQ0FBQyxHQUFHO1dBQ3RCLElBQUksR0FBRyxXQUFXLENBQUMsR0FBRyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNqRCxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNiLENBQUM7QUFDRDs7Ozs7Ozs7O0dBU0c7QUFDSCxNQUFNLFVBQVUsZUFBZSxDQUM5QixZQUFpRCxFQUNqRCxtQkFBcUQsRUFDckQsVUFBNkI7SUFFN0IsSUFBSSxZQUFZLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDM0IsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBQ0QsSUFBSSxZQUFZLEtBQUssS0FBSyxFQUFFLENBQUM7UUFDNUIsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0lBQ0QsSUFBSSxtQkFBbUIsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUN0QyxPQUFPLFVBQVUsQ0FBQyxLQUFLLENBQUMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDO0lBQzdELENBQUM7U0FBTSxDQUFDO1FBQ1AsT0FBTyxVQUFVLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUNoQyxDQUFDO0FBQ0YsQ0FBQyJ9