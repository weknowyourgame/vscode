/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator, refineServiceDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IExtensionManagementService } from '../../../../platform/extensionManagement/common/extensionManagement.js';
export const IProfileAwareExtensionManagementService = refineServiceDecorator(IExtensionManagementService);
export var ExtensionInstallLocation;
(function (ExtensionInstallLocation) {
    ExtensionInstallLocation[ExtensionInstallLocation["Local"] = 1] = "Local";
    ExtensionInstallLocation[ExtensionInstallLocation["Remote"] = 2] = "Remote";
    ExtensionInstallLocation[ExtensionInstallLocation["Web"] = 3] = "Web";
})(ExtensionInstallLocation || (ExtensionInstallLocation = {}));
export const IExtensionManagementServerService = createDecorator('extensionManagementServerService');
export const IWorkbenchExtensionManagementService = refineServiceDecorator(IProfileAwareExtensionManagementService);
export var EnablementState;
(function (EnablementState) {
    EnablementState[EnablementState["DisabledByTrustRequirement"] = 0] = "DisabledByTrustRequirement";
    EnablementState[EnablementState["DisabledByExtensionKind"] = 1] = "DisabledByExtensionKind";
    EnablementState[EnablementState["DisabledByEnvironment"] = 2] = "DisabledByEnvironment";
    EnablementState[EnablementState["EnabledByEnvironment"] = 3] = "EnabledByEnvironment";
    EnablementState[EnablementState["DisabledByMalicious"] = 4] = "DisabledByMalicious";
    EnablementState[EnablementState["DisabledByVirtualWorkspace"] = 5] = "DisabledByVirtualWorkspace";
    EnablementState[EnablementState["DisabledByInvalidExtension"] = 6] = "DisabledByInvalidExtension";
    EnablementState[EnablementState["DisabledByAllowlist"] = 7] = "DisabledByAllowlist";
    EnablementState[EnablementState["DisabledByExtensionDependency"] = 8] = "DisabledByExtensionDependency";
    EnablementState[EnablementState["DisabledByUnification"] = 9] = "DisabledByUnification";
    EnablementState[EnablementState["DisabledGlobally"] = 10] = "DisabledGlobally";
    EnablementState[EnablementState["DisabledWorkspace"] = 11] = "DisabledWorkspace";
    EnablementState[EnablementState["EnabledGlobally"] = 12] = "EnabledGlobally";
    EnablementState[EnablementState["EnabledWorkspace"] = 13] = "EnabledWorkspace";
})(EnablementState || (EnablementState = {}));
export const IWorkbenchExtensionEnablementService = createDecorator('extensionEnablementService');
export const IWebExtensionsScannerService = createDecorator('IWebExtensionsScannerService');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLHNCQUFzQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFFckgsT0FBTyxFQUFFLDJCQUEyQixFQUFzTixNQUFNLHdFQUF3RSxDQUFDO0FBTXpVLE1BQU0sQ0FBQyxNQUFNLHVDQUF1QyxHQUFHLHNCQUFzQixDQUF1RSwyQkFBMkIsQ0FBQyxDQUFDO0FBY2pMLE1BQU0sQ0FBTixJQUFrQix3QkFJakI7QUFKRCxXQUFrQix3QkFBd0I7SUFDekMseUVBQVMsQ0FBQTtJQUNULDJFQUFNLENBQUE7SUFDTixxRUFBRyxDQUFBO0FBQ0osQ0FBQyxFQUppQix3QkFBd0IsS0FBeEIsd0JBQXdCLFFBSXpDO0FBRUQsTUFBTSxDQUFDLE1BQU0saUNBQWlDLEdBQUcsZUFBZSxDQUFvQyxrQ0FBa0MsQ0FBQyxDQUFDO0FBNkJ4SSxNQUFNLENBQUMsTUFBTSxvQ0FBb0MsR0FBRyxzQkFBc0IsQ0FBZ0YsdUNBQXVDLENBQUMsQ0FBQztBQXFDbk0sTUFBTSxDQUFOLElBQWtCLGVBZWpCO0FBZkQsV0FBa0IsZUFBZTtJQUNoQyxpR0FBMEIsQ0FBQTtJQUMxQiwyRkFBdUIsQ0FBQTtJQUN2Qix1RkFBcUIsQ0FBQTtJQUNyQixxRkFBb0IsQ0FBQTtJQUNwQixtRkFBbUIsQ0FBQTtJQUNuQixpR0FBMEIsQ0FBQTtJQUMxQixpR0FBMEIsQ0FBQTtJQUMxQixtRkFBbUIsQ0FBQTtJQUNuQix1R0FBNkIsQ0FBQTtJQUM3Qix1RkFBcUIsQ0FBQTtJQUNyQiw4RUFBZ0IsQ0FBQTtJQUNoQixnRkFBaUIsQ0FBQTtJQUNqQiw0RUFBZSxDQUFBO0lBQ2YsOEVBQWdCLENBQUE7QUFDakIsQ0FBQyxFQWZpQixlQUFlLEtBQWYsZUFBZSxRQWVoQztBQUVELE1BQU0sQ0FBQyxNQUFNLG9DQUFvQyxHQUFHLGVBQWUsQ0FBdUMsNEJBQTRCLENBQUMsQ0FBQztBQThFeEksTUFBTSxDQUFDLE1BQU0sNEJBQTRCLEdBQUcsZUFBZSxDQUErQiw4QkFBOEIsQ0FBQyxDQUFDIn0=