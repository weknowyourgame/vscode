/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../instantiation/common/instantiation.js';
export var FocusMode;
(function (FocusMode) {
    /**
     * (Default) Transfer focus to the target window
     * when the editor is focused.
     */
    FocusMode[FocusMode["Transfer"] = 0] = "Transfer";
    /**
     * Transfer focus to the target window when the
     * editor is focused, otherwise notify the user that
     * the app has activity (macOS/Windows only).
     */
    FocusMode[FocusMode["Notify"] = 1] = "Notify";
    /**
     * Force the window to be focused, even if the editor
     * is not currently focused.
     */
    FocusMode[FocusMode["Force"] = 2] = "Force";
})(FocusMode || (FocusMode = {}));
export const INativeHostService = createDecorator('nativeHostService');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmF0aXZlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL25hdGl2ZS9jb21tb24vbmF0aXZlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBUWhHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQTZCOUUsTUFBTSxDQUFOLElBQWtCLFNBb0JqQjtBQXBCRCxXQUFrQixTQUFTO0lBRTFCOzs7T0FHRztJQUNILGlEQUFRLENBQUE7SUFFUjs7OztPQUlHO0lBQ0gsNkNBQU0sQ0FBQTtJQUVOOzs7T0FHRztJQUNILDJDQUFLLENBQUE7QUFDTixDQUFDLEVBcEJpQixTQUFTLEtBQVQsU0FBUyxRQW9CMUI7QUE2S0QsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQUcsZUFBZSxDQUFxQixtQkFBbUIsQ0FBQyxDQUFDIn0=