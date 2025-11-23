/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isMacintosh } from '../../../common/platform.js';
import { unthemedListStyles } from '../list/listWidget.js';
import { Widget } from '../widget.js';
import './selectBox.css';
import { SelectBoxList } from './selectBoxCustom.js';
import { SelectBoxNative } from './selectBoxNative.js';
export const SeparatorSelectOption = Object.freeze({
    text: '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
    isDisabled: true,
});
export const unthemedSelectBoxStyles = {
    ...unthemedListStyles,
    selectBackground: '#3C3C3C',
    selectForeground: '#F0F0F0',
    selectBorder: '#3C3C3C',
    decoratorRightForeground: undefined,
    selectListBackground: undefined,
    selectListBorder: undefined,
    focusBorder: undefined,
};
export class SelectBox extends Widget {
    constructor(options, selected, contextViewProvider, styles, selectBoxOptions) {
        super();
        // Default to native SelectBox for OSX unless overridden
        if (isMacintosh && !selectBoxOptions?.useCustomDrawn) {
            this.selectBoxDelegate = new SelectBoxNative(options, selected, styles, selectBoxOptions);
        }
        else {
            this.selectBoxDelegate = new SelectBoxList(options, selected, contextViewProvider, styles, selectBoxOptions);
        }
        this._register(this.selectBoxDelegate);
    }
    // Public SelectBox Methods - routed through delegate interface
    get onDidSelect() {
        return this.selectBoxDelegate.onDidSelect;
    }
    setOptions(options, selected) {
        this.selectBoxDelegate.setOptions(options, selected);
    }
    select(index) {
        this.selectBoxDelegate.select(index);
    }
    setAriaLabel(label) {
        this.selectBoxDelegate.setAriaLabel(label);
    }
    focus() {
        this.selectBoxDelegate.focus();
    }
    blur() {
        this.selectBoxDelegate.blur();
    }
    setFocusable(focusable) {
        this.selectBoxDelegate.setFocusable(focusable);
    }
    setEnabled(enabled) {
        this.selectBoxDelegate.setEnabled(enabled);
    }
    render(container) {
        this.selectBoxDelegate.render(container);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VsZWN0Qm94LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvYnJvd3Nlci91aS9zZWxlY3RCb3gvc2VsZWN0Qm94LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBSWhHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUcxRCxPQUFPLEVBQWUsa0JBQWtCLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUN4RSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ3RDLE9BQU8saUJBQWlCLENBQUM7QUFDekIsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ3JELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQXlDdkQsTUFBTSxDQUFDLE1BQU0scUJBQXFCLEdBQWdDLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDL0UsSUFBSSxFQUFFLHdEQUF3RDtJQUM5RCxVQUFVLEVBQUUsSUFBSTtDQUNoQixDQUFDLENBQUM7QUFZSCxNQUFNLENBQUMsTUFBTSx1QkFBdUIsR0FBcUI7SUFDeEQsR0FBRyxrQkFBa0I7SUFDckIsZ0JBQWdCLEVBQUUsU0FBUztJQUMzQixnQkFBZ0IsRUFBRSxTQUFTO0lBQzNCLFlBQVksRUFBRSxTQUFTO0lBQ3ZCLHdCQUF3QixFQUFFLFNBQVM7SUFDbkMsb0JBQW9CLEVBQUUsU0FBUztJQUMvQixnQkFBZ0IsRUFBRSxTQUFTO0lBQzNCLFdBQVcsRUFBRSxTQUFTO0NBQ3RCLENBQUM7QUFPRixNQUFNLE9BQU8sU0FBVSxTQUFRLE1BQU07SUFHcEMsWUFBWSxPQUE0QixFQUFFLFFBQWdCLEVBQUUsbUJBQXlDLEVBQUUsTUFBd0IsRUFBRSxnQkFBb0M7UUFDcEssS0FBSyxFQUFFLENBQUM7UUFFUix3REFBd0Q7UUFDeEQsSUFBSSxXQUFXLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxjQUFjLEVBQUUsQ0FBQztZQUN0RCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxlQUFlLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUMzRixDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLGFBQWEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLG1CQUFtQixFQUFFLE1BQU0sRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQzlHLENBQUM7UUFFRCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRCwrREFBK0Q7SUFFL0QsSUFBSSxXQUFXO1FBQ2QsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDO0lBQzNDLENBQUM7SUFFRCxVQUFVLENBQUMsT0FBNEIsRUFBRSxRQUFpQjtRQUN6RCxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lBRUQsTUFBTSxDQUFDLEtBQWE7UUFDbkIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRUQsWUFBWSxDQUFDLEtBQWE7UUFDekIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBRUQsS0FBSztRQUNKLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNoQyxDQUFDO0lBRUQsSUFBSTtRQUNILElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUMvQixDQUFDO0lBRUQsWUFBWSxDQUFDLFNBQWtCO1FBQzlCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVELFVBQVUsQ0FBQyxPQUFnQjtRQUMxQixJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxNQUFNLENBQUMsU0FBc0I7UUFDNUIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUMxQyxDQUFDO0NBQ0QifQ==