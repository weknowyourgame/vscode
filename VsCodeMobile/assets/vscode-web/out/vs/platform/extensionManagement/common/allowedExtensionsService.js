/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Disposable } from '../../../base/common/lifecycle.js';
import * as nls from '../../../nls.js';
import { AllowedExtensionsConfigKey } from './extensionManagement.js';
import { IProductService } from '../../product/common/productService.js';
import { createCommandUri, MarkdownString } from '../../../base/common/htmlContent.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { isBoolean, isObject, isUndefined } from '../../../base/common/types.js';
import { Emitter } from '../../../base/common/event.js';
function isGalleryExtension(extension) {
    return extension.type === 'gallery';
}
function isIExtension(extension) {
    return extension.type === 1 /* ExtensionType.User */ || extension.type === 0 /* ExtensionType.System */;
}
const VersionRegex = /^(?<version>\d+\.\d+\.\d+(-.*)?)(@(?<platform>.+))?$/;
let AllowedExtensionsService = class AllowedExtensionsService extends Disposable {
    get allowedExtensionsConfigValue() {
        return this._allowedExtensionsConfigValue;
    }
    constructor(productService, configurationService) {
        super();
        this.configurationService = configurationService;
        this._onDidChangeAllowedExtensions = this._register(new Emitter());
        this.onDidChangeAllowedExtensionsConfigValue = this._onDidChangeAllowedExtensions.event;
        this.publisherOrgs = productService.extensionPublisherOrgs?.map(p => p.toLowerCase()) ?? [];
        this._allowedExtensionsConfigValue = this.getAllowedExtensionsValue();
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(AllowedExtensionsConfigKey)) {
                this._allowedExtensionsConfigValue = this.getAllowedExtensionsValue();
                this._onDidChangeAllowedExtensions.fire();
            }
        }));
    }
    getAllowedExtensionsValue() {
        const value = this.configurationService.getValue(AllowedExtensionsConfigKey);
        if (!isObject(value) || Array.isArray(value)) {
            return undefined;
        }
        const entries = Object.entries(value).map(([key, value]) => [key.toLowerCase(), value]);
        if (entries.length === 1 && entries[0][0] === '*' && entries[0][1] === true) {
            return undefined;
        }
        return Object.fromEntries(entries);
    }
    isAllowed(extension) {
        if (!this._allowedExtensionsConfigValue) {
            return true;
        }
        let id, version, targetPlatform, prerelease, publisher, publisherDisplayName;
        if (isGalleryExtension(extension)) {
            id = extension.identifier.id.toLowerCase();
            version = extension.version;
            prerelease = extension.properties.isPreReleaseVersion;
            publisher = extension.publisher.toLowerCase();
            publisherDisplayName = extension.publisherDisplayName.toLowerCase();
            targetPlatform = extension.properties.targetPlatform;
        }
        else if (isIExtension(extension)) {
            id = extension.identifier.id.toLowerCase();
            version = extension.manifest.version;
            prerelease = extension.preRelease;
            publisher = extension.manifest.publisher.toLowerCase();
            publisherDisplayName = extension.publisherDisplayName?.toLowerCase();
            targetPlatform = extension.targetPlatform;
        }
        else {
            id = extension.id.toLowerCase();
            version = extension.version ?? '*';
            targetPlatform = extension.targetPlatform ?? "universal" /* TargetPlatform.UNIVERSAL */;
            prerelease = extension.prerelease ?? false;
            publisher = extension.id.substring(0, extension.id.indexOf('.')).toLowerCase();
            publisherDisplayName = extension.publisherDisplayName?.toLowerCase();
        }
        const settingsCommandLink = createCommandUri('workbench.action.openSettings', { query: `@id:${AllowedExtensionsConfigKey}` }).toString();
        const extensionValue = this._allowedExtensionsConfigValue[id];
        const extensionReason = new MarkdownString(nls.localize('specific extension not allowed', "it is not in the [allowed list]({0})", settingsCommandLink));
        if (!isUndefined(extensionValue)) {
            if (isBoolean(extensionValue)) {
                return extensionValue ? true : extensionReason;
            }
            if (extensionValue === 'stable' && prerelease) {
                return new MarkdownString(nls.localize('extension prerelease not allowed', "the pre-release versions of this extension are not in the [allowed list]({0})", settingsCommandLink));
            }
            if (version !== '*' && Array.isArray(extensionValue) && !extensionValue.some(v => {
                const match = VersionRegex.exec(v);
                if (match && match.groups) {
                    const { platform: p, version: v } = match.groups;
                    if (v !== version) {
                        return false;
                    }
                    if (targetPlatform !== "universal" /* TargetPlatform.UNIVERSAL */ && p && targetPlatform !== p) {
                        return false;
                    }
                    return true;
                }
                return false;
            })) {
                return new MarkdownString(nls.localize('specific version of extension not allowed', "the version {0} of this extension is not in the [allowed list]({1})", version, settingsCommandLink));
            }
            return true;
        }
        const publisherKey = publisherDisplayName && this.publisherOrgs.includes(publisherDisplayName) ? publisherDisplayName : publisher;
        const publisherValue = this._allowedExtensionsConfigValue[publisherKey];
        if (!isUndefined(publisherValue)) {
            if (isBoolean(publisherValue)) {
                return publisherValue ? true : new MarkdownString(nls.localize('publisher not allowed', "the extensions from this publisher are not in the [allowed list]({1})", publisherKey, settingsCommandLink));
            }
            if (publisherValue === 'stable' && prerelease) {
                return new MarkdownString(nls.localize('prerelease versions from this publisher not allowed', "the pre-release versions from this publisher are not in the [allowed list]({1})", publisherKey, settingsCommandLink));
            }
            return true;
        }
        if (this._allowedExtensionsConfigValue['*'] === true) {
            return true;
        }
        return extensionReason;
    }
};
AllowedExtensionsService = __decorate([
    __param(0, IProductService),
    __param(1, IConfigurationService)
], AllowedExtensionsService);
export { AllowedExtensionsService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2FsbG93ZWRFeHRlbnNpb25zU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDL0QsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQkFBaUIsQ0FBQztBQUN2QyxPQUFPLEVBQXFCLDBCQUEwQixFQUErRCxNQUFNLDBCQUEwQixDQUFDO0FBRXRKLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQW1CLGNBQWMsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3hHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ2pGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUV4RCxTQUFTLGtCQUFrQixDQUFDLFNBQWtCO0lBQzdDLE9BQVEsU0FBK0IsQ0FBQyxJQUFJLEtBQUssU0FBUyxDQUFDO0FBQzVELENBQUM7QUFFRCxTQUFTLFlBQVksQ0FBQyxTQUFrQjtJQUN2QyxPQUFRLFNBQXdCLENBQUMsSUFBSSwrQkFBdUIsSUFBSyxTQUF3QixDQUFDLElBQUksaUNBQXlCLENBQUM7QUFDekgsQ0FBQztBQUdELE1BQU0sWUFBWSxHQUFHLHNEQUFzRCxDQUFDO0FBRXJFLElBQU0sd0JBQXdCLEdBQTlCLE1BQU0sd0JBQXlCLFNBQVEsVUFBVTtJQU92RCxJQUFJLDRCQUE0QjtRQUMvQixPQUFPLElBQUksQ0FBQyw2QkFBNkIsQ0FBQztJQUMzQyxDQUFDO0lBSUQsWUFDa0IsY0FBK0IsRUFDekIsb0JBQThEO1FBRXJGLEtBQUssRUFBRSxDQUFDO1FBRmtDLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBdUI7UUFMOUUsa0NBQTZCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFDbkUsNENBQXVDLEdBQUcsSUFBSSxDQUFDLDZCQUE2QixDQUFDLEtBQUssQ0FBQztRQU8zRixJQUFJLENBQUMsYUFBYSxHQUFHLGNBQWMsQ0FBQyxzQkFBc0IsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDNUYsSUFBSSxDQUFDLDZCQUE2QixHQUFHLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO1FBQ3RFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ3JFLElBQUksQ0FBQyxDQUFDLG9CQUFvQixDQUFDLDBCQUEwQixDQUFDLEVBQUUsQ0FBQztnQkFDeEQsSUFBSSxDQUFDLDZCQUE2QixHQUFHLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO2dCQUN0RSxJQUFJLENBQUMsNkJBQTZCLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDM0MsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8seUJBQXlCO1FBQ2hDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQStDLDBCQUEwQixDQUFDLENBQUM7UUFDM0gsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDOUMsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUNELE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDeEYsSUFBSSxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUM3RSxPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBQ0QsT0FBTyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxTQUFTLENBQUMsU0FBNks7UUFDdEwsSUFBSSxDQUFDLElBQUksQ0FBQyw2QkFBNkIsRUFBRSxDQUFDO1lBQ3pDLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELElBQUksRUFBVSxFQUFFLE9BQWUsRUFBRSxjQUE4QixFQUFFLFVBQW1CLEVBQUUsU0FBaUIsRUFBRSxvQkFBd0MsQ0FBQztRQUVsSixJQUFJLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7WUFDbkMsRUFBRSxHQUFHLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQzNDLE9BQU8sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDO1lBQzVCLFVBQVUsR0FBRyxTQUFTLENBQUMsVUFBVSxDQUFDLG1CQUFtQixDQUFDO1lBQ3RELFNBQVMsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQzlDLG9CQUFvQixHQUFHLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNwRSxjQUFjLEdBQUcsU0FBUyxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUM7UUFDdEQsQ0FBQzthQUFNLElBQUksWUFBWSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7WUFDcEMsRUFBRSxHQUFHLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQzNDLE9BQU8sR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQztZQUNyQyxVQUFVLEdBQUcsU0FBUyxDQUFDLFVBQVUsQ0FBQztZQUNsQyxTQUFTLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDdkQsb0JBQW9CLEdBQUcsU0FBUyxDQUFDLG9CQUFvQixFQUFFLFdBQVcsRUFBRSxDQUFDO1lBQ3JFLGNBQWMsR0FBRyxTQUFTLENBQUMsY0FBYyxDQUFDO1FBQzNDLENBQUM7YUFBTSxDQUFDO1lBQ1AsRUFBRSxHQUFHLFNBQVMsQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDaEMsT0FBTyxHQUFHLFNBQVMsQ0FBQyxPQUFPLElBQUksR0FBRyxDQUFDO1lBQ25DLGNBQWMsR0FBRyxTQUFTLENBQUMsY0FBYyw4Q0FBNEIsQ0FBQztZQUN0RSxVQUFVLEdBQUcsU0FBUyxDQUFDLFVBQVUsSUFBSSxLQUFLLENBQUM7WUFDM0MsU0FBUyxHQUFHLFNBQVMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQy9FLG9CQUFvQixHQUFHLFNBQVMsQ0FBQyxvQkFBb0IsRUFBRSxXQUFXLEVBQUUsQ0FBQztRQUN0RSxDQUFDO1FBRUQsTUFBTSxtQkFBbUIsR0FBRyxnQkFBZ0IsQ0FBQywrQkFBK0IsRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLDBCQUEwQixFQUFFLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3pJLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM5RCxNQUFNLGVBQWUsR0FBRyxJQUFJLGNBQWMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLGdDQUFnQyxFQUFFLHNDQUFzQyxFQUFFLG1CQUFtQixDQUFDLENBQUMsQ0FBQztRQUN4SixJQUFJLENBQUMsV0FBVyxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUM7WUFDbEMsSUFBSSxTQUFTLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQztnQkFDL0IsT0FBTyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDO1lBQ2hELENBQUM7WUFDRCxJQUFJLGNBQWMsS0FBSyxRQUFRLElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQy9DLE9BQU8sSUFBSSxjQUFjLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxrQ0FBa0MsRUFBRSwrRUFBK0UsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7WUFDbkwsQ0FBQztZQUNELElBQUksT0FBTyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDaEYsTUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDbkMsSUFBSSxLQUFLLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDO29CQUMzQixNQUFNLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztvQkFDakQsSUFBSSxDQUFDLEtBQUssT0FBTyxFQUFFLENBQUM7d0JBQ25CLE9BQU8sS0FBSyxDQUFDO29CQUNkLENBQUM7b0JBQ0QsSUFBSSxjQUFjLCtDQUE2QixJQUFJLENBQUMsSUFBSSxjQUFjLEtBQUssQ0FBQyxFQUFFLENBQUM7d0JBQzlFLE9BQU8sS0FBSyxDQUFDO29CQUNkLENBQUM7b0JBQ0QsT0FBTyxJQUFJLENBQUM7Z0JBQ2IsQ0FBQztnQkFDRCxPQUFPLEtBQUssQ0FBQztZQUNkLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ0osT0FBTyxJQUFJLGNBQWMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLDJDQUEyQyxFQUFFLHFFQUFxRSxFQUFFLE9BQU8sRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7WUFDM0wsQ0FBQztZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELE1BQU0sWUFBWSxHQUFHLG9CQUFvQixJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDbEksTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLDZCQUE2QixDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3hFLElBQUksQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQztZQUNsQyxJQUFJLFNBQVMsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO2dCQUMvQixPQUFPLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLHVCQUF1QixFQUFFLHVFQUF1RSxFQUFFLFlBQVksRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7WUFDdE0sQ0FBQztZQUNELElBQUksY0FBYyxLQUFLLFFBQVEsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDL0MsT0FBTyxJQUFJLGNBQWMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLHFEQUFxRCxFQUFFLGlGQUFpRixFQUFFLFlBQVksRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7WUFDdE4sQ0FBQztZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLDZCQUE2QixDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3RELE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELE9BQU8sZUFBZSxDQUFDO0lBQ3hCLENBQUM7Q0FDRCxDQUFBO0FBckhZLHdCQUF3QjtJQWNsQyxXQUFBLGVBQWUsQ0FBQTtJQUNmLFdBQUEscUJBQXFCLENBQUE7R0FmWCx3QkFBd0IsQ0FxSHBDIn0=