/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../instantiation/common/instantiation.js';
export var McpGalleryResourceType;
(function (McpGalleryResourceType) {
    McpGalleryResourceType["McpServersQueryService"] = "McpServersQueryService";
    McpGalleryResourceType["McpServerWebUri"] = "McpServerWebUriTemplate";
    McpGalleryResourceType["McpServerVersionUri"] = "McpServerVersionUriTemplate";
    McpGalleryResourceType["McpServerIdUri"] = "McpServerIdUriTemplate";
    McpGalleryResourceType["McpServerLatestVersionUri"] = "McpServerLatestVersionUriTemplate";
    McpGalleryResourceType["McpServerNamedResourceUri"] = "McpServerNamedResourceUriTemplate";
    McpGalleryResourceType["PublisherUriTemplate"] = "PublisherUriTemplate";
    McpGalleryResourceType["ContactSupportUri"] = "ContactSupportUri";
    McpGalleryResourceType["PrivacyPolicyUri"] = "PrivacyPolicyUri";
    McpGalleryResourceType["TermsOfServiceUri"] = "TermsOfServiceUri";
    McpGalleryResourceType["ReportUri"] = "ReportUri";
})(McpGalleryResourceType || (McpGalleryResourceType = {}));
export var McpGalleryManifestStatus;
(function (McpGalleryManifestStatus) {
    McpGalleryManifestStatus["Available"] = "available";
    McpGalleryManifestStatus["Unavailable"] = "unavailable";
})(McpGalleryManifestStatus || (McpGalleryManifestStatus = {}));
export const IMcpGalleryManifestService = createDecorator('IMcpGalleryManifestService');
export function getMcpGalleryManifestResourceUri(manifest, type) {
    const [name, version] = type.split('/');
    for (const resource of manifest.resources) {
        const [r, v] = resource.type.split('/');
        if (r !== name) {
            continue;
        }
        if (!version || v === version) {
            return resource.id;
        }
        break;
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwR2FsbGVyeU1hbmlmZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL21jcC9jb21tb24vbWNwR2FsbGVyeU1hbmlmZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUU5RSxNQUFNLENBQU4sSUFBa0Isc0JBWWpCO0FBWkQsV0FBa0Isc0JBQXNCO0lBQ3ZDLDJFQUFpRCxDQUFBO0lBQ2pELHFFQUEyQyxDQUFBO0lBQzNDLDZFQUFtRCxDQUFBO0lBQ25ELG1FQUF5QyxDQUFBO0lBQ3pDLHlGQUErRCxDQUFBO0lBQy9ELHlGQUErRCxDQUFBO0lBQy9ELHVFQUE2QyxDQUFBO0lBQzdDLGlFQUF1QyxDQUFBO0lBQ3ZDLCtEQUFxQyxDQUFBO0lBQ3JDLGlFQUF1QyxDQUFBO0lBQ3ZDLGlEQUF1QixDQUFBO0FBQ3hCLENBQUMsRUFaaUIsc0JBQXNCLEtBQXRCLHNCQUFzQixRQVl2QztBQWFELE1BQU0sQ0FBTixJQUFrQix3QkFHakI7QUFIRCxXQUFrQix3QkFBd0I7SUFDekMsbURBQXVCLENBQUE7SUFDdkIsdURBQTJCLENBQUE7QUFDNUIsQ0FBQyxFQUhpQix3QkFBd0IsS0FBeEIsd0JBQXdCLFFBR3pDO0FBRUQsTUFBTSxDQUFDLE1BQU0sMEJBQTBCLEdBQUcsZUFBZSxDQUE2Qiw0QkFBNEIsQ0FBQyxDQUFDO0FBV3BILE1BQU0sVUFBVSxnQ0FBZ0MsQ0FBQyxRQUE2QixFQUFFLElBQVk7SUFDM0YsTUFBTSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3hDLEtBQUssTUFBTSxRQUFRLElBQUksUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQzNDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDeEMsSUFBSSxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDaEIsU0FBUztRQUNWLENBQUM7UUFDRCxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsS0FBSyxPQUFPLEVBQUUsQ0FBQztZQUMvQixPQUFPLFFBQVEsQ0FBQyxFQUFFLENBQUM7UUFDcEIsQ0FBQztRQUNELE1BQU07SUFDUCxDQUFDO0lBQ0QsT0FBTyxTQUFTLENBQUM7QUFDbEIsQ0FBQyJ9