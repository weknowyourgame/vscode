/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable } from '../../../common/lifecycle.js';
let baseHoverDelegate = {
    showInstantHover: () => undefined,
    showDelayedHover: () => undefined,
    setupDelayedHover: () => Disposable.None,
    setupDelayedHoverAtMouse: () => Disposable.None,
    hideHover: () => undefined,
    showAndFocusLastHover: () => undefined,
    setupManagedHover: () => ({
        dispose: () => undefined,
        show: () => undefined,
        hide: () => undefined,
        update: () => undefined,
    }),
    showManagedHover: () => undefined
};
/**
 * Sets the hover delegate for use **only in the `base/` layer**.
 */
export function setBaseLayerHoverDelegate(hoverDelegate) {
    baseHoverDelegate = hoverDelegate;
}
/**
 * Gets the hover delegate for use **only in the `base/` layer**.
 *
 * Since the hover service depends on various platform services, this delegate essentially bypasses
 * the standard dependency injection mechanism by injecting a global hover service at start up. The
 * only reason this should be used is if `IHoverService` is not available.
 */
export function getBaseLayerHoverDelegate() {
    return baseHoverDelegate;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG92ZXJEZWxlZ2F0ZTIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGUyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUcxRCxJQUFJLGlCQUFpQixHQUFvQjtJQUN4QyxnQkFBZ0IsRUFBRSxHQUFHLEVBQUUsQ0FBQyxTQUFTO0lBQ2pDLGdCQUFnQixFQUFFLEdBQUcsRUFBRSxDQUFDLFNBQVM7SUFDakMsaUJBQWlCLEVBQUUsR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUk7SUFDeEMsd0JBQXdCLEVBQUUsR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUk7SUFDL0MsU0FBUyxFQUFFLEdBQUcsRUFBRSxDQUFDLFNBQVM7SUFDMUIscUJBQXFCLEVBQUUsR0FBRyxFQUFFLENBQUMsU0FBUztJQUN0QyxpQkFBaUIsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQ3pCLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxTQUFTO1FBQ3hCLElBQUksRUFBRSxHQUFHLEVBQUUsQ0FBQyxTQUFTO1FBQ3JCLElBQUksRUFBRSxHQUFHLEVBQUUsQ0FBQyxTQUFTO1FBQ3JCLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxTQUFTO0tBQ3ZCLENBQUM7SUFDRixnQkFBZ0IsRUFBRSxHQUFHLEVBQUUsQ0FBQyxTQUFTO0NBQ2pDLENBQUM7QUFFRjs7R0FFRztBQUNILE1BQU0sVUFBVSx5QkFBeUIsQ0FBQyxhQUE4QjtJQUN2RSxpQkFBaUIsR0FBRyxhQUFhLENBQUM7QUFDbkMsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sVUFBVSx5QkFBeUI7SUFDeEMsT0FBTyxpQkFBaUIsQ0FBQztBQUMxQixDQUFDIn0=