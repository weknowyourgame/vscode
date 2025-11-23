/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export var HoverStyle;
(function (HoverStyle) {
    /**
     * The hover is anchored below the element with a pointer above it pointing at the target.
     */
    HoverStyle[HoverStyle["Pointer"] = 1] = "Pointer";
    /**
     * The hover is anchored to the bottom right of the cursor's location.
     */
    HoverStyle[HoverStyle["Mouse"] = 2] = "Mouse";
})(HoverStyle || (HoverStyle = {}));
export function isManagedHoverTooltipMarkdownString(obj) {
    const candidate = obj;
    return typeof candidate === 'object' && 'markdown' in candidate && 'markdownNotSupportedFallback' in candidate;
}
export function isManagedHoverTooltipHTMLElement(obj) {
    const candidate = obj;
    return typeof candidate === 'object' && 'element' in candidate;
}
// #endregion Managed hover
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG92ZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBbUpoRyxNQUFNLENBQU4sSUFBa0IsVUFTakI7QUFURCxXQUFrQixVQUFVO0lBQzNCOztPQUVHO0lBQ0gsaURBQVcsQ0FBQTtJQUNYOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtBQUNWLENBQUMsRUFUaUIsVUFBVSxLQUFWLFVBQVUsUUFTM0I7QUF3UEQsTUFBTSxVQUFVLG1DQUFtQyxDQUFDLEdBQVk7SUFDL0QsTUFBTSxTQUFTLEdBQUcsR0FBeUMsQ0FBQztJQUM1RCxPQUFPLE9BQU8sU0FBUyxLQUFLLFFBQVEsSUFBSSxVQUFVLElBQUksU0FBUyxJQUFJLDhCQUE4QixJQUFJLFNBQVMsQ0FBQztBQUNoSCxDQUFDO0FBTUQsTUFBTSxVQUFVLGdDQUFnQyxDQUFDLEdBQVk7SUFDNUQsTUFBTSxTQUFTLEdBQUcsR0FBc0MsQ0FBQztJQUN6RCxPQUFPLE9BQU8sU0FBUyxLQUFLLFFBQVEsSUFBSSxTQUFTLElBQUksU0FBUyxDQUFDO0FBQ2hFLENBQUM7QUEwQkQsMkJBQTJCIn0=