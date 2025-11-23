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
import { CancellationToken } from '../../../base/common/cancellation.js';
import { Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { ILogService } from '../../log/common/log.js';
import { IProductService } from '../../product/common/productService.js';
import { IRequestService, isSuccess } from '../../request/common/request.js';
const SUPPORTED_VERSIONS = [
    'v0.1',
    'v0',
];
let McpGalleryManifestService = class McpGalleryManifestService extends Disposable {
    get mcpGalleryManifestStatus() {
        return !!this.productService.mcpGallery?.serviceUrl ? "available" /* McpGalleryManifestStatus.Available */ : "unavailable" /* McpGalleryManifestStatus.Unavailable */;
    }
    constructor(productService, requestService, logService) {
        super();
        this.productService = productService;
        this.requestService = requestService;
        this.logService = logService;
        this.onDidChangeMcpGalleryManifest = Event.None;
        this.onDidChangeMcpGalleryManifestStatus = Event.None;
        this.versionByUrl = new Map();
    }
    async getMcpGalleryManifest() {
        if (!this.productService.mcpGallery) {
            return null;
        }
        return this.createMcpGalleryManifest(this.productService.mcpGallery.serviceUrl, SUPPORTED_VERSIONS[0]);
    }
    async createMcpGalleryManifest(url, version) {
        url = url.endsWith('/') ? url.slice(0, -1) : url;
        if (!version) {
            let versionPromise = this.versionByUrl.get(url);
            if (!versionPromise) {
                this.versionByUrl.set(url, versionPromise = this.getVersion(url));
            }
            version = await versionPromise;
        }
        const isProductGalleryUrl = this.productService.mcpGallery?.serviceUrl === url;
        const serversUrl = `${url}/${version}/servers`;
        const resources = [
            {
                id: serversUrl,
                type: "McpServersQueryService" /* McpGalleryResourceType.McpServersQueryService */
            },
            {
                id: `${serversUrl}/{name}/versions/{version}`,
                type: "McpServerVersionUriTemplate" /* McpGalleryResourceType.McpServerVersionUri */
            },
            {
                id: `${serversUrl}/{name}/versions/latest`,
                type: "McpServerLatestVersionUriTemplate" /* McpGalleryResourceType.McpServerLatestVersionUri */
            }
        ];
        if (isProductGalleryUrl) {
            resources.push({
                id: `${serversUrl}/by-name/{name}`,
                type: "McpServerNamedResourceUriTemplate" /* McpGalleryResourceType.McpServerNamedResourceUri */
            });
            resources.push({
                id: this.productService.mcpGallery.itemWebUrl,
                type: "McpServerWebUriTemplate" /* McpGalleryResourceType.McpServerWebUri */
            });
            resources.push({
                id: this.productService.mcpGallery.publisherUrl,
                type: "PublisherUriTemplate" /* McpGalleryResourceType.PublisherUriTemplate */
            });
            resources.push({
                id: this.productService.mcpGallery.supportUrl,
                type: "ContactSupportUri" /* McpGalleryResourceType.ContactSupportUri */
            });
            resources.push({
                id: this.productService.mcpGallery.supportUrl,
                type: "ContactSupportUri" /* McpGalleryResourceType.ContactSupportUri */
            });
            resources.push({
                id: this.productService.mcpGallery.privacyPolicyUrl,
                type: "PrivacyPolicyUri" /* McpGalleryResourceType.PrivacyPolicyUri */
            });
            resources.push({
                id: this.productService.mcpGallery.termsOfServiceUrl,
                type: "TermsOfServiceUri" /* McpGalleryResourceType.TermsOfServiceUri */
            });
            resources.push({
                id: this.productService.mcpGallery.reportUrl,
                type: "ReportUri" /* McpGalleryResourceType.ReportUri */
            });
        }
        if (version === 'v0') {
            resources.push({
                id: `${serversUrl}/{id}`,
                type: "McpServerIdUriTemplate" /* McpGalleryResourceType.McpServerIdUri */
            });
        }
        return {
            version,
            url,
            resources
        };
    }
    async getVersion(url) {
        for (const version of SUPPORTED_VERSIONS) {
            if (await this.checkVersion(url, version)) {
                return version;
            }
        }
        return SUPPORTED_VERSIONS[0];
    }
    async checkVersion(url, version) {
        try {
            const context = await this.requestService.request({
                type: 'GET',
                url: `${url}/${version}/servers?limit=1`,
            }, CancellationToken.None);
            if (isSuccess(context)) {
                return true;
            }
            this.logService.info(`The service at ${url} does not support version ${version}. Service returned status ${context.res.statusCode}.`);
        }
        catch (error) {
            this.logService.error(error);
        }
        return false;
    }
};
McpGalleryManifestService = __decorate([
    __param(0, IProductService),
    __param(1, IRequestService),
    __param(2, ILogService)
], McpGalleryManifestService);
export { McpGalleryManifestService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwR2FsbGVyeU1hbmlmZXN0U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9tY3AvY29tbW9uL21jcEdhbGxlcnlNYW5pZmVzdFNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDekUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3RELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDdEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxlQUFlLEVBQUUsU0FBUyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFHN0UsTUFBTSxrQkFBa0IsR0FBRztJQUMxQixNQUFNO0lBQ04sSUFBSTtDQUNKLENBQUM7QUFFSyxJQUFNLHlCQUF5QixHQUEvQixNQUFNLHlCQUEwQixTQUFRLFVBQVU7SUFReEQsSUFBSSx3QkFBd0I7UUFDM0IsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUMsc0RBQW9DLENBQUMseURBQXFDLENBQUM7SUFDakksQ0FBQztJQUVELFlBQ2tCLGNBQWdELEVBQ2hELGNBQWdELEVBQ3BELFVBQTBDO1FBRXZELEtBQUssRUFBRSxDQUFDO1FBSjBCLG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUMvQixtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7UUFDakMsZUFBVSxHQUFWLFVBQVUsQ0FBYTtRQVovQyxrQ0FBNkIsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1FBQzNDLHdDQUFtQyxHQUFHLEtB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