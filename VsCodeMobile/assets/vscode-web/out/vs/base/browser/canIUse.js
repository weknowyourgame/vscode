/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as browser from './browser.js';
import { mainWindow } from './window.js';
import * as platform from '../common/platform.js';
export var KeyboardSupport;
(function (KeyboardSupport) {
    KeyboardSupport[KeyboardSupport["Always"] = 0] = "Always";
    KeyboardSupport[KeyboardSupport["FullScreen"] = 1] = "FullScreen";
    KeyboardSupport[KeyboardSupport["None"] = 2] = "None";
})(KeyboardSupport || (KeyboardSupport = {}));
/**
 * Browser feature we can support in current platform, browser and environment.
 */
export const BrowserFeatures = {
    clipboard: {
        writeText: (platform.isNative
            || (document.queryCommandSupported && document.queryCommandSupported('copy'))
            || !!(navigator && navigator.clipboard && navigator.clipboard.writeText)),
        readText: (platform.isNative
            || !!(navigator && navigator.clipboard && navigator.clipboard.readText))
    },
    keyboard: (() => {
        if (platform.isNative || browser.isStandalone()) {
            return 0 /* KeyboardSupport.Always */;
        }
        if (navigator.keyboard || browser.isSafari) {
            return 1 /* KeyboardSupport.FullScreen */;
        }
        return 2 /* KeyboardSupport.None */;
    })(),
    // 'ontouchstart' in window always evaluates to true with typescript's modern typings. This causes `window` to be
    // `never` later in `window.navigator`. That's why we need the explicit `window as Window` cast
    touch: 'ontouchstart' in mainWindow || navigator.maxTouchPoints > 0,
    pointerEvents: mainWindow.PointerEvent && ('ontouchstart' in mainWindow || navigator.maxTouchPoints > 0)
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FuSVVzZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2Jyb3dzZXIvY2FuSVVzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssT0FBTyxNQUFNLGNBQWMsQ0FBQztBQUN4QyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBQ3pDLE9BQU8sS0FBSyxRQUFRLE1BQU0sdUJBQXVCLENBQUM7QUFFbEQsTUFBTSxDQUFOLElBQWtCLGVBSWpCO0FBSkQsV0FBa0IsZUFBZTtJQUNoQyx5REFBTSxDQUFBO0lBQ04saUVBQVUsQ0FBQTtJQUNWLHFEQUFJLENBQUE7QUFDTCxDQUFDLEVBSmlCLGVBQWUsS0FBZixlQUFlLFFBSWhDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLENBQUMsTUFBTSxlQUFlLEdBQUc7SUFDOUIsU0FBUyxFQUFFO1FBQ1YsU0FBUyxFQUFFLENBQ1YsUUFBUSxDQUFDLFFBQVE7ZUFDZCxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsSUFBSSxRQUFRLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLENBQUM7ZUFDMUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxJQUFJLFNBQVMsQ0FBQyxTQUFTLElBQUksU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FDeEU7UUFDRCxRQUFRLEVBQUUsQ0FDVCxRQUFRLENBQUMsUUFBUTtlQUNkLENBQUMsQ0FBQyxDQUFDLFNBQVMsSUFBSSxTQUFTLENBQUMsU0FBUyxJQUFJLFNBQVMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQ3ZFO0tBQ0Q7SUFDRCxRQUFRLEVBQUUsQ0FBQyxHQUFHLEVBQUU7UUFDZixJQUFJLFFBQVEsQ0FBQyxRQUFRLElBQUksT0FBTyxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUM7WUFDakQsc0NBQThCO1FBQy9CLENBQUM7UUFFRCxJQUFLLFNBQWdELENBQUMsUUFBUSxJQUFJLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNwRiwwQ0FBa0M7UUFDbkMsQ0FBQztRQUVELG9DQUE0QjtJQUM3QixDQUFDLENBQUMsRUFBRTtJQUVKLGlIQUFpSDtJQUNqSCwrRkFBK0Y7SUFDL0YsS0FBSyxFQUFFLGNBQWMsSUFBSSxVQUFVLElBQUksU0FBUyxDQUFDLGNBQWMsR0FBRyxDQUFDO0lBQ25FLGFBQWEsRUFBRSxVQUFVLENBQUMsWUFBWSxJQUFJLENBQUMsY0FBYyxJQUFJLFVBQVUsSUFBSSxTQUFTLENBQUMsY0FBYyxHQUFHLENBQUMsQ0FBQztDQUN4RyxDQUFDIn0=