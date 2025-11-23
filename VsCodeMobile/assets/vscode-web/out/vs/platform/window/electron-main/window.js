/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import electron from 'electron';
import { DEFAULT_AUX_WINDOW_SIZE, DEFAULT_EMPTY_WINDOW_SIZE, DEFAULT_WORKSPACE_WINDOW_SIZE } from '../common/window.js';
export var LoadReason;
(function (LoadReason) {
    /**
     * The window is loaded for the first time.
     */
    LoadReason[LoadReason["INITIAL"] = 1] = "INITIAL";
    /**
     * The window is loaded into a different workspace context.
     */
    LoadReason[LoadReason["LOAD"] = 2] = "LOAD";
    /**
     * The window is reloaded.
     */
    LoadReason[LoadReason["RELOAD"] = 3] = "RELOAD";
})(LoadReason || (LoadReason = {}));
export var UnloadReason;
(function (UnloadReason) {
    /**
     * The window is closed.
     */
    UnloadReason[UnloadReason["CLOSE"] = 1] = "CLOSE";
    /**
     * All windows unload because the application quits.
     */
    UnloadReason[UnloadReason["QUIT"] = 2] = "QUIT";
    /**
     * The window is reloaded.
     */
    UnloadReason[UnloadReason["RELOAD"] = 3] = "RELOAD";
    /**
     * The window is loaded into a different workspace context.
     */
    UnloadReason[UnloadReason["LOAD"] = 4] = "LOAD";
})(UnloadReason || (UnloadReason = {}));
export const defaultWindowState = function (mode = 1 /* WindowMode.Normal */, hasWorkspace = false) {
    const size = hasWorkspace ? DEFAULT_WORKSPACE_WINDOW_SIZE : DEFAULT_EMPTY_WINDOW_SIZE;
    return {
        width: size.width,
        height: size.height,
        mode
    };
};
export const defaultAuxWindowState = function () {
    // Auxiliary windows are being created from a `window.open` call
    // that sets `windowFeatures` that encode the desired size and
    // position of the new window (`top`, `left`).
    // In order to truly override this to a good default window state
    // we need to set not only width and height but also x and y to
    // a good location on the primary display.
    const width = DEFAULT_AUX_WINDOW_SIZE.width;
    const height = DEFAULT_AUX_WINDOW_SIZE.height;
    const workArea = electron.screen.getPrimaryDisplay().workArea;
    const x = Math.max(workArea.x + (workArea.width / 2) - (width / 2), 0);
    const y = Math.max(workArea.y + (workArea.height / 2) - (height / 2), 0);
    return {
        x,
        y,
        width,
        height,
        mode: 1 /* WindowMode.Normal */
    };
};
export var WindowMode;
(function (WindowMode) {
    WindowMode[WindowMode["Maximized"] = 0] = "Maximized";
    WindowMode[WindowMode["Normal"] = 1] = "Normal";
    WindowMode[WindowMode["Minimized"] = 2] = "Minimized";
    WindowMode[WindowMode["Fullscreen"] = 3] = "Fullscreen";
})(WindowMode || (WindowMode = {}));
export var WindowError;
(function (WindowError) {
    /**
     * Maps to the `unresponsive` event on a `BrowserWindow`.
     */
    WindowError[WindowError["UNRESPONSIVE"] = 1] = "UNRESPONSIVE";
    /**
     * Maps to the `render-process-gone` event on a `WebContents`.
     */
    WindowError[WindowError["PROCESS_GONE"] = 2] = "PROCESS_GONE";
    /**
     * Maps to the `did-fail-load` event on a `WebContents`.
     */
    WindowError[WindowError["LOAD"] = 3] = "LOAD";
    /**
     * Maps to the `responsive` event on a `BrowserWindow`.
     */
    WindowError[WindowError["RESPONSIVE"] = 4] = "RESPONSIVE";
})(WindowError || (WindowError = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2luZG93LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3dpbmRvdy9lbGVjdHJvbi1tYWluL3dpbmRvdy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLFFBQVEsTUFBTSxVQUFVLENBQUM7QUFTaEMsT0FBTyxFQUFFLHVCQUF1QixFQUFFLHlCQUF5QixFQUFFLDZCQUE2QixFQUE4QixNQUFNLHFCQUFxQixDQUFDO0FBMkVwSixNQUFNLENBQU4sSUFBa0IsVUFnQmpCO0FBaEJELFdBQWtCLFVBQVU7SUFFM0I7O09BRUc7SUFDSCxpREFBVyxDQUFBO0lBRVg7O09BRUc7SUFDSCwyQ0FBSSxDQUFBO0lBRUo7O09BRUc7SUFDSCwrQ0FBTSxDQUFBO0FBQ1AsQ0FBQyxFQWhCaUIsVUFBVSxLQUFWLFVBQVUsUUFnQjNCO0FBRUQsTUFBTSxDQUFOLElBQWtCLFlBcUJqQjtBQXJCRCxXQUFrQixZQUFZO0lBRTdCOztPQUVHO0lBQ0gsaURBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsK0NBQUksQ0FBQTtJQUVKOztPQUVHO0lBQ0gsbURBQU0sQ0FBQTtJQUVOOztPQUVHO0lBQ0gsK0NBQUksQ0FBQTtBQUNMLENBQUMsRUFyQmlCLFlBQVksS0FBWixZQUFZLFFBcUI3QjtBQVlELE1BQU0sQ0FBQyxNQUFNLGtCQUFrQixHQUFHLFVBQVUsSUFBSSw0QkFBb0IsRUFBRSxZQUFZLEdBQUcsS0FBSztJQUN6RixNQUFNLElBQUksR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLDZCQUE2QixDQUFDLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQztJQUN0RixPQUFPO1FBQ04sS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLO1FBQ2pCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtRQUNuQixJQUFJO0tBQ0osQ0FBQztBQUNILENBQUMsQ0FBQztBQUVGLE1BQU0sQ0FBQyxNQUFNLHFCQUFxQixHQUFHO0lBRXBDLGdFQUFnRTtJQUNoRSw4REFBOEQ7SUFDOUQsOENBQThDO0lBQzlDLGlFQUFpRTtJQUNqRSwrREFBK0Q7SUFDL0QsMENBQTBDO0lBRTFDLE1BQU0sS0FBSyxHQUFHLHVCQUF1QixDQUFDLEtBQUssQ0FBQztJQUM1QyxNQUFNLE1BQU0sR0FBRyx1QkFBdUIsQ0FBQyxNQUFNLENBQUM7SUFDOUMsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLFFBQVEsQ0FBQztJQUM5RCxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3ZFLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFekUsT0FBTztRQUNOLENBQUM7UUFDRCxDQUFDO1FBQ0QsS0FBSztRQUNMLE1BQU07UUFDTixJQUFJLDJCQUFtQjtLQUN2QixDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBRUYsTUFBTSxDQUFOLElBQWtCLFVBS2pCO0FBTEQsV0FBa0IsVUFBVTtJQUMzQixxREFBUyxDQUFBO0lBQ1QsK0NBQU0sQ0FBQTtJQUNOLHFEQUFTLENBQUE7SUFDVCx1REFBVSxDQUFBO0FBQ1gsQ0FBQyxFQUxpQixVQUFVLEtBQVYsVUFBVSxRQUszQjtBQU9ELE1BQU0sQ0FBTixJQUFrQixXQXFCakI7QUFyQkQsV0FBa0IsV0FBVztJQUU1Qjs7T0FFRztJQUNILDZEQUFnQixDQUFBO0lBRWhCOztPQUVHO0lBQ0gsNkRBQWdCLENBQUE7SUFFaEI7O09BRUc7SUFDSCw2Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCx5REFBYyxDQUFBO0FBQ2YsQ0FBQyxFQXJCaUIsV0FBVyxLQUFYLFdBQVcsUUFxQjVCIn0=