/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export function getParentNodeState(parentChildren) {
    let containsChecks = false;
    let containsUnchecks = false;
    let containsMixed = false;
    for (const element of parentChildren) {
        switch (element.element?.checked) {
            case 'mixed':
                containsMixed = true;
                break;
            case true:
                containsChecks = true;
                break;
            default:
                containsUnchecks = true;
                break;
        }
        if (containsChecks && containsUnchecks && containsMixed) {
            break;
        }
    }
    const newState = containsUnchecks
        ? containsMixed
            ? 'mixed'
            : containsChecks
                ? 'mixed'
                : false
        : containsMixed
            ? 'mixed'
            : containsChecks;
    return newState;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVpY2tJbnB1dFRyZWUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vcXVpY2tpbnB1dC9icm93c2VyL3RyZWUvcXVpY2tJbnB1dFRyZWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFXaEcsTUFBTSxVQUFVLGtCQUFrQixDQUFDLGNBQStHO0lBQ2pKLElBQUksY0FBYyxHQUFHLEtBQUssQ0FBQztJQUMzQixJQUFJLGdCQUFnQixHQUFHLEtBQUssQ0FBQztJQUM3QixJQUFJLGFBQWEsR0FBRyxLQUFLLENBQUM7SUFFMUIsS0FBSyxNQUFNLE9BQU8sSUFBSSxjQUFjLEVBQUUsQ0FBQztRQUN0QyxRQUFRLE9BQU8sQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLENBQUM7WUFDbEMsS0FBSyxPQUFPO2dCQUNYLGFBQWEsR0FBRyxJQUFJLENBQUM7Z0JBQ3JCLE1BQU07WUFDUCxLQUFLLElBQUk7Z0JBQ1IsY0FBYyxHQUFHLElBQUksQ0FBQztnQkFDdEIsTUFBTTtZQUNQO2dCQUNDLGdCQUFnQixHQUFHLElBQUksQ0FBQztnQkFDeEIsTUFBTTtRQUNSLENBQUM7UUFDRCxJQUFJLGNBQWMsSUFBSSxnQkFBZ0IsSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUN6RCxNQUFNO1FBQ1AsQ0FBQztJQUNGLENBQUM7SUFDRCxNQUFNLFFBQVEsR0FBRyxnQkFBZ0I7UUFDaEMsQ0FBQyxDQUFDLGFBQWE7WUFDZCxDQUFDLENBQUMsT0FBTztZQUNULENBQUMsQ0FBQyxjQUFjO2dCQUNmLENBQUMsQ0FBQyxPQUFPO2dCQUNULENBQUMsQ0FBQyxLQUFLO1FBQ1QsQ0FBQyxDQUFDLGFBQWE7WUFDZCxDQUFDLENBQUMsT0FBTztZQUNULENBQUMsQ0FBQyxjQUFjLENBQUM7SUFDbkIsT0FBTyxRQUFRLENBQUM7QUFDakIsQ0FBQyJ9