/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
export const VIEWLET_ID = 'workbench.view.scm';
export const VIEW_PANE_ID = 'workbench.scm';
export const REPOSITORIES_VIEW_PANE_ID = 'workbench.scm.repositories';
export const HISTORY_VIEW_PANE_ID = 'workbench.scm.history';
export var ViewMode;
(function (ViewMode) {
    ViewMode["List"] = "list";
    ViewMode["Tree"] = "tree";
})(ViewMode || (ViewMode = {}));
export const ISCMService = createDecorator('scm');
export var InputValidationType;
(function (InputValidationType) {
    InputValidationType[InputValidationType["Error"] = 0] = "Error";
    InputValidationType[InputValidationType["Warning"] = 1] = "Warning";
    InputValidationType[InputValidationType["Information"] = 2] = "Information";
})(InputValidationType || (InputValidationType = {}));
export var SCMInputChangeReason;
(function (SCMInputChangeReason) {
    SCMInputChangeReason[SCMInputChangeReason["HistoryPrevious"] = 0] = "HistoryPrevious";
    SCMInputChangeReason[SCMInputChangeReason["HistoryNext"] = 1] = "HistoryNext";
})(SCMInputChangeReason || (SCMInputChangeReason = {}));
export var ISCMRepositorySortKey;
(function (ISCMRepositorySortKey) {
    ISCMRepositorySortKey["DiscoveryTime"] = "discoveryTime";
    ISCMRepositorySortKey["Name"] = "name";
    ISCMRepositorySortKey["Path"] = "path";
})(ISCMRepositorySortKey || (ISCMRepositorySortKey = {}));
export var ISCMRepositorySelectionMode;
(function (ISCMRepositorySelectionMode) {
    ISCMRepositorySelectionMode["Single"] = "single";
    ISCMRepositorySelectionMode["Multiple"] = "multiple";
})(ISCMRepositorySelectionMode || (ISCMRepositorySelectionMode = {}));
export const ISCMViewService = createDecorator('scmView');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NtLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3NjbS9jb21tb24vc2NtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQWM3RixNQUFNLENBQUMsTUFBTSxVQUFVLEdBQUcsb0JBQW9CLENBQUM7QUFDL0MsTUFBTSxDQUFDLE1BQU0sWUFBWSxHQUFHLGVBQWUsQ0FBQztBQUM1QyxNQUFNLENBQUMsTUFBTSx5QkFBeUIsR0FBRyw0QkFBNEIsQ0FBQztBQUN0RSxNQUFNLENBQUMsTUFBTSxvQkFBb0IsR0FBRyx1QkFBdUIsQ0FBQztBQUU1RCxNQUFNLENBQU4sSUFBa0IsUUFHakI7QUFIRCxXQUFrQixRQUFRO0lBQ3pCLHlCQUFhLENBQUE7SUFDYix5QkFBYSxDQUFBO0FBQ2QsQ0FBQyxFQUhpQixRQUFRLEtBQVIsUUFBUSxRQUd6QjtBQU1ELE1BQU0sQ0FBQyxNQUFNLFdBQVcsR0FBRyxlQUFlLENBQWMsS0FBSyxDQUFDLENBQUM7QUFvRS9ELE1BQU0sQ0FBTixJQUFrQixtQkFJakI7QUFKRCxXQUFrQixtQkFBbUI7SUFDcEMsK0RBQVMsQ0FBQTtJQUNULG1FQUFXLENBQUE7SUFDWCwyRUFBZSxDQUFBO0FBQ2hCLENBQUMsRUFKaUIsbUJBQW1CLEtBQW5CLG1CQUFtQixRQUlwQztBQVdELE1BQU0sQ0FBTixJQUFZLG9CQUdYO0FBSEQsV0FBWSxvQkFBb0I7SUFDL0IscUZBQWUsQ0FBQTtJQUNmLDZFQUFXLENBQUE7QUFDWixDQUFDLEVBSFcsb0JBQW9CLEtBQXBCLG9CQUFvQixRQUcvQjtBQTBGRCxNQUFNLENBQU4sSUFBa0IscUJBSWpCO0FBSkQsV0FBa0IscUJBQXFCO0lBQ3RDLHdEQUErQixDQUFBO0lBQy9CLHNDQUFhLENBQUE7SUFDYixzQ0FBYSxDQUFBO0FBQ2QsQ0FBQyxFQUppQixxQkFBcUIsS0FBckIscUJBQXFCLFFBSXRDO0FBRUQsTUFBTSxDQUFOLElBQWtCLDJCQUdqQjtBQUhELFdBQWtCLDJCQUEyQjtJQUM1QyxnREFBaUIsQ0FBQTtJQUNqQixvREFBcUIsQ0FBQTtBQUN0QixDQUFDLEVBSGlCLDJCQUEyQixLQUEzQiwyQkFBMkIsUUFHNUM7QUFFRCxNQUFNLENBQUMsTUFBTSxlQUFlLEdBQUcsZUFBZSxDQUFrQixTQUFTLENBQUMsQ0FBQyJ9