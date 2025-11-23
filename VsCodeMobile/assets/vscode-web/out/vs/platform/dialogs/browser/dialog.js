/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EventHelper } from '../../../base/browser/dom.js';
import { fromNow } from '../../../base/common/date.js';
import { localize } from '../../../nls.js';
import { defaultButtonStyles, defaultCheckboxStyles, defaultInputBoxStyles, defaultDialogStyles } from '../../theme/browser/defaultStyles.js';
const defaultDialogAllowableCommands = [
    'workbench.action.quit',
    'workbench.action.reloadWindow',
    'copy',
    'cut',
    'editor.action.selectAll',
    'editor.action.clipboardCopyAction',
    'editor.action.clipboardCutAction',
    'editor.action.clipboardPasteAction'
];
export function createWorkbenchDialogOptions(options, keybindingService, layoutService, allowableCommands = defaultDialogAllowableCommands) {
    return {
        keyEventProcessor: (event) => {
            const resolved = keybindingService.softDispatch(event, layoutService.activeContainer);
            if (resolved.kind === 2 /* ResultKind.KbFound */ && resolved.commandId) {
                if (!allowableCommands.includes(resolved.commandId)) {
                    EventHelper.stop(event, true);
                }
            }
        },
        buttonStyles: defaultButtonStyles,
        checkboxStyles: defaultCheckboxStyles,
        inputBoxStyles: defaultInputBoxStyles,
        dialogStyles: defaultDialogStyles,
        ...options
    };
}
export function createBrowserAboutDialogDetails(productService) {
    const detailString = (useAgo) => {
        return localize('aboutDetail', "Version: {0}\nCommit: {1}\nDate: {2}\nBrowser: {3}", productService.version || 'Unknown', productService.commit || 'Unknown', productService.date ? `${productService.date}${useAgo ? ' (' + fromNow(new Date(productService.date), true) + ')' : ''}` : 'Unknown', navigator.userAgent);
    };
    const details = detailString(true);
    const detailsToCopy = detailString(false);
    return {
        title: productService.nameLong,
        details: details,
        detailsToCopy: detailsToCopy
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhbG9nLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2RpYWxvZ3MvYnJvd3Nlci9kaWFsb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRzNELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUN2RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFLM0MsT0FBTyxFQUFFLG1CQUFtQixFQUFFLHFCQUFxQixFQUFFLHFCQUFxQixFQUFFLG1CQUFtQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFOUksTUFBTSw4QkFBOEIsR0FBRztJQUN0Qyx1QkFBdUI7SUFDdkIsK0JBQStCO0lBQy9CLE1BQU07SUFDTixLQUFLO0lBQ0wseUJBQXlCO0lBQ3pCLG1DQUFtQztJQUNuQyxrQ0FBa0M7SUFDbEMsb0NBQW9DO0NBQ3BDLENBQUM7QUFFRixNQUFNLFVBQVUsNEJBQTRCLENBQUMsT0FBZ0MsRUFBRSxpQkFBcUMsRUFBRSxhQUE2QixFQUFFLGlCQUFpQixHQUFHLDhCQUE4QjtJQUN0TSxPQUFPO1FBQ04saUJBQWlCLEVBQUUsQ0FBQyxLQUE0QixFQUFFLEVBQUU7WUFDbkQsTUFBTSxRQUFRLEdBQUcsaUJBQWlCLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxhQUFhLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDdEYsSUFBSSxRQUFRLENBQUMsSUFBSSwrQkFBdUIsSUFBSSxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ2hFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7b0JBQ3JELFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUMvQixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFDRCxZQUFZLEVBQUUsbUJBQW1CO1FBQ2pDLGNBQWMsRUFBRSxxQkFBcUI7UUFDckMsY0FBYyxFQUFFLHFCQUFxQjtRQUNyQyxZQUFZLEVBQUUsbUJBQW1CO1FBQ2pDLEdBQUcsT0FBTztLQUNWLENBQUM7QUFDSCxDQUFDO0FBRUQsTUFBTSxVQUFVLCtCQUErQixDQUFDLGNBQStCO0lBQzlFLE1BQU0sWUFBWSxHQUFHLENBQUMsTUFBZSxFQUFVLEVBQUU7UUFDaEQsT0FBTyxRQUFRLENBQUMsYUFBYSxFQUM1QixvREFBb0QsRUFDcEQsY0FBYyxDQUFDLE9BQU8sSUFBSSxTQUFTLEVBQ25DLGNBQWMsQ0FBQyxNQUFNLElBQUksU0FBUyxFQUNsQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLGNBQWMsQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQ3BJLFNBQVMsQ0FBQyxTQUFTLENBQ25CLENBQUM7SUFDSCxDQUFDLENBQUM7SUFFRixNQUFNLE9BQU8sR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbkMsTUFBTSxhQUFhLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRTFDLE9BQU87UUFDTixLQUFLLEVBQUUsY0FBYyxDQUFDLFFBQVE7UUFDOUIsT0FBTyxFQUFFLE9BQU87UUFDaEIsYUFBYSxFQUFFLGFBQWE7S0FDNUIsQ0FBQztBQUNILENBQUMifQ==