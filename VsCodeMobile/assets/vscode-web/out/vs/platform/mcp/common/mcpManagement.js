/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../instantiation/common/instantiation.js';
export var RegistryType;
(function (RegistryType) {
    RegistryType["NODE"] = "npm";
    RegistryType["PYTHON"] = "pypi";
    RegistryType["DOCKER"] = "oci";
    RegistryType["NUGET"] = "nuget";
    RegistryType["MCPB"] = "mcpb";
    RegistryType["REMOTE"] = "remote";
})(RegistryType || (RegistryType = {}));
export var TransportType;
(function (TransportType) {
    TransportType["STDIO"] = "stdio";
    TransportType["STREAMABLE_HTTP"] = "streamable-http";
    TransportType["SSE"] = "sse";
})(TransportType || (TransportType = {}));
export var GalleryMcpServerStatus;
(function (GalleryMcpServerStatus) {
    GalleryMcpServerStatus["Active"] = "active";
    GalleryMcpServerStatus["Deprecated"] = "deprecated";
})(GalleryMcpServerStatus || (GalleryMcpServerStatus = {}));
export const IMcpGalleryService = createDecorator('IMcpGalleryService');
export const IMcpManagementService = createDecorator('IMcpManagementService');
export const IAllowedMcpServersService = createDecorator('IAllowedMcpServersService');
export const mcpAccessConfig = 'chat.mcp.access';
export const mcpGalleryServiceUrlConfig = 'chat.mcp.gallery.serviceUrl';
export const mcpGalleryServiceEnablementConfig = 'chat.mcp.gallery.enabled';
export const mcpAutoStartConfig = 'chat.mcp.autostart';
export var McpAutoStartValue;
(function (McpAutoStartValue) {
    McpAutoStartValue["Never"] = "never";
    McpAutoStartValue["OnlyNew"] = "onlyNew";
    McpAutoStartValue["NewAndOutdated"] = "newAndOutdated";
})(McpAutoStartValue || (McpAutoStartValue = {}));
export var McpAccessValue;
(function (McpAccessValue) {
    McpAccessValue["None"] = "none";
    McpAccessValue["Registry"] = "registry";
    McpAccessValue["All"] = "all";
})(McpAccessValue || (McpAccessValue = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwTWFuYWdlbWVudC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9tY3AvY29tbW9uL21jcE1hbmFnZW1lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFRaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBNkQ5RSxNQUFNLENBQU4sSUFBa0IsWUFPakI7QUFQRCxXQUFrQixZQUFZO0lBQzdCLDRCQUFZLENBQUE7SUFDWiwrQkFBZSxDQUFBO0lBQ2YsOEJBQWMsQ0FBQTtJQUNkLCtCQUFlLENBQUE7SUFDZiw2QkFBYSxDQUFBO0lBQ2IsaUNBQWlCLENBQUE7QUFDbEIsQ0FBQyxFQVBpQixZQUFZLEtBQVosWUFBWSxRQU83QjtBQUVELE1BQU0sQ0FBTixJQUFrQixhQUlqQjtBQUpELFdBQWtCLGFBQWE7SUFDOUIsZ0NBQWUsQ0FBQTtJQUNmLG9EQUFtQyxDQUFBO0lBQ25DLDRCQUFXLENBQUE7QUFDWixDQUFDLEVBSmlCLGFBQWEsS0FBYixhQUFhLFFBSTlCO0FBc0NELE1BQU0sQ0FBTixJQUFrQixzQkFHakI7QUFIRCxXQUFrQixzQkFBc0I7SUFDdkMsMkNBQWlCLENBQUE7SUFDakIsbURBQXlCLENBQUE7QUFDMUIsQ0FBQyxFQUhpQixzQkFBc0IsS0FBdEIsc0JBQXNCLFFBR3ZDO0FBdUNELE1BQU0sQ0FBQyxNQUFNLGtCQUFrQixHQUFHLGVBQWUsQ0FBcUIsb0JBQW9CLENBQUMsQ0FBQztBQXdENUYsTUFBTSxDQUFDLE1BQU0scUJBQXFCLEdBQUcsZUFBZSxDQUF3Qix1QkFBdUIsQ0FBQyxDQUFDO0FBa0JyRyxNQUFNLENBQUMsTUFBTSx5QkFBeUIsR0FBRyxlQUFlLENBQTRCLDJCQUEyQixDQUFDLENBQUM7QUFRakgsTUFBTSxDQUFDLE1BQU0sZUFBZSxHQUFHLGlCQUFpQixDQUFDO0FBQ2pELE1BQU0sQ0FBQyxNQUFNLDBCQUEwQixHQUFHLDZCQUE2QixDQUFDO0FBQ3hFLE1BQU0sQ0FBQyxNQUFNLGlDQUFpQyxHQUFHLDBCQUEwQixDQUFDO0FBQzVFLE1BQU0sQ0FBQyxNQUFNLGtCQUFrQixHQUFHLG9CQUFvQixDQUFDO0FBUXZELE1BQU0sQ0FBTixJQUFrQixpQkFJakI7QUFKRCxXQUFrQixpQkFBaUI7SUFDbEMsb0NBQWUsQ0FBQTtJQUNmLHdDQUFtQixDQUFBO0lBQ25CLHNEQUFpQyxDQUFBO0FBQ2xDLENBQUMsRUFKaUIsaUJBQWlCLEtBQWpCLGlCQUFpQixRQUlsQztBQUVELE1BQU0sQ0FBTixJQUFrQixjQUlqQjtBQUpELFdBQWtCLGNBQWM7SUFDL0IsK0JBQWEsQ0FBQTtJQUNiLHVDQUFxQixDQUFBO0lBQ3JCLDZCQUFXLENBQUE7QUFDWixDQUFDLEVBSmlCLGNBQWMsS0FBZCxjQUFjLFFBSS9CIn0=