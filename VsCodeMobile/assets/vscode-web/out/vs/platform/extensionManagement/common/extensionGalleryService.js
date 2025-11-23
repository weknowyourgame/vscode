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
import { distinct } from '../../../base/common/arrays.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import * as semver from '../../../base/common/semver/semver.js';
import { CancellationError, getErrorMessage, isCancellationError } from '../../../base/common/errors.js';
import { isWeb, platform } from '../../../base/common/platform.js';
import { arch } from '../../../base/common/process.js';
import { isBoolean, isNumber, isString } from '../../../base/common/types.js';
import { URI } from '../../../base/common/uri.js';
import { isOfflineError } from '../../../base/parts/request/common/request.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IEnvironmentService } from '../../environment/common/environment.js';
import { getTargetPlatform, isNotWebExtensionInWebTargetPlatform, isTargetPlatformCompatible, toTargetPlatform, WEB_EXTENSION_TAG, ExtensionGalleryError, IAllowedExtensionsService, EXTENSION_IDENTIFIER_REGEX, ExtensionRequestsTimeoutConfigKey } from './extensionManagement.js';
import { adoptToGalleryExtensionId, areSameExtensions, getGalleryExtensionId, getGalleryExtensionTelemetryData } from './extensionManagementUtil.js';
import { areApiProposalsCompatible, isEngineValid } from '../../extensions/common/extensionValidator.js';
import { IFileService } from '../../files/common/files.js';
import { ILogService } from '../../log/common/log.js';
import { IProductService } from '../../product/common/productService.js';
import { asJson, asTextOrError, IRequestService, isClientError, isServerError, isSuccess } from '../../request/common/request.js';
import { resolveMarketplaceHeaders } from '../../externalServices/common/marketplace.js';
import { IStorageService } from '../../storage/common/storage.js';
import { ITelemetryService } from '../../telemetry/common/telemetry.js';
import { StopWatch } from '../../../base/common/stopwatch.js';
import { format2 } from '../../../base/common/strings.js';
import { getExtensionGalleryManifestResourceUri, IExtensionGalleryManifestService } from './extensionGalleryManifest.js';
import { TelemetryTrustedValue } from '../../telemetry/common/telemetryUtils.js';
const CURRENT_TARGET_PLATFORM = isWeb ? "web" /* TargetPlatform.WEB */ : getTargetPlatform(platform, arch);
const SEARCH_ACTIVITY_HEADER_NAME = 'X-Market-Search-Activity-Id';
const ACTIVITY_HEADER_NAME = 'Activityid';
const SERVER_HEADER_NAME = 'Server';
const END_END_ID_HEADER_NAME = 'X-Vss-E2eid';
const AssetType = {
    Icon: 'Microsoft.VisualStudio.Services.Icons.Default',
    Details: 'Microsoft.VisualStudio.Services.Content.Details',
    Changelog: 'Microsoft.VisualStudio.Services.Content.Changelog',
    Manifest: 'Microsoft.VisualStudio.Code.Manifest',
    VSIX: 'Microsoft.VisualStudio.Services.VSIXPackage',
    License: 'Microsoft.VisualStudio.Services.Content.License',
    Repository: 'Microsoft.VisualStudio.Services.Links.Source',
    Signature: 'Microsoft.VisualStudio.Services.VsixSignature'
};
const PropertyType = {
    Dependency: 'Microsoft.VisualStudio.Code.ExtensionDependencies',
    ExtensionPack: 'Microsoft.VisualStudio.Code.ExtensionPack',
    Engine: 'Microsoft.VisualStudio.Code.Engine',
    PreRelease: 'Microsoft.VisualStudio.Code.PreRelease',
    EnabledApiProposals: 'Microsoft.VisualStudio.Code.EnabledApiProposals',
    LocalizedLanguages: 'Microsoft.VisualStudio.Code.LocalizedLanguages',
    WebExtension: 'Microsoft.VisualStudio.Code.WebExtension',
    SponsorLink: 'Microsoft.VisualStudio.Code.SponsorLink',
    SupportLink: 'Microsoft.VisualStudio.Services.Links.Support',
    ExecutesCode: 'Microsoft.VisualStudio.Code.ExecutesCode',
    Private: 'PrivateMarketplace',
};
const DefaultPageSize = 10;
const DefaultQueryState = {
    pageNumber: 1,
    pageSize: DefaultPageSize,
    sortBy: "NoneOrRelevance" /* SortBy.NoneOrRelevance */,
    sortOrder: 0 /* SortOrder.Default */,
    flags: [],
    criteria: [],
    assetTypes: []
};
var VersionKind;
(function (VersionKind) {
    VersionKind[VersionKind["Release"] = 0] = "Release";
    VersionKind[VersionKind["Prerelease"] = 1] = "Prerelease";
    VersionKind[VersionKind["Latest"] = 2] = "Latest";
})(VersionKind || (VersionKind = {}));
class Query {
    constructor(state = DefaultQueryState) {
        this.state = state;
    }
    get pageNumber() { return this.state.pageNumber; }
    get pageSize() { return this.state.pageSize; }
    get sortBy() { return this.state.sortBy; }
    get sortOrder() { return this.state.sortOrder; }
    get flags() { return this.state.flags; }
    get criteria() { return this.state.criteria; }
    get assetTypes() { return this.state.assetTypes; }
    get source() { return this.state.source; }
    get searchText() {
        const criterium = this.state.criteria.filter(criterium => criterium.filterType === "SearchText" /* FilterType.SearchText */)[0];
        return criterium && criterium.value ? criterium.value : '';
    }
    withPage(pageNumber, pageSize = this.state.pageSize) {
        return new Query({ ...this.state, pageNumber, pageSize });
    }
    withFilter(filterType, ...values) {
        const criteria = [
            ...this.state.criteria,
            ...values.length ? values.map(value => ({ filterType, value })) : [{ filterType }]
        ];
        return new Query({ ...this.state, criteria });
    }
    withSortBy(sortBy) {
        return new Query({ ...this.state, sortBy });
    }
    withSortOrder(sortOrder) {
        return new Query({ ...this.state, sortOrder });
    }
    withFlags(...flags) {
        return new Query({ ...this.state, flags: distinct(flags) });
    }
    withAssetTypes(...assetTypes) {
        return new Query({ ...this.state, assetTypes });
    }
    withSource(source) {
        return new Query({ ...this.state, source });
    }
}
function getStatistic(statistics, name) {
    const result = (statistics || []).filter(s => s.statisticName === name)[0];
    return result ? result.value : 0;
}
function getCoreTranslationAssets(version) {
    const coreTranslationAssetPrefix = 'Microsoft.VisualStudio.Code.Translation.';
    const result = version.files.filter(f => f.assetType.indexOf(coreTranslationAssetPrefix) === 0);
    return result.reduce((result, file) => {
        const asset = getVersionAsset(version, file.assetType);
        if (asset) {
            result.push([file.assetType.substring(coreTranslationAssetPrefix.length), asset]);
        }
        return result;
    }, []);
}
function getRepositoryAsset(version) {
    if (version.properties) {
        const results = version.properties.filter(p => p.key === AssetType.Repository);
        const gitRegExp = new RegExp('((git|ssh|http(s)?)|(git@[\\w.]+))(:(//)?)([\\w.@:/\\-~]+)(.git)(/)?');
        const uri = results.filter(r => gitRegExp.test(r.value))[0];
        return uri ? { uri: uri.value, fallbackUri: uri.value } : null;
    }
    return getVersionAsset(version, AssetType.Repository);
}
function getDownloadAsset(version) {
    return {
        // always use fallbackAssetUri for download asset to hit the Marketplace API so that downloads are counted
        uri: `${version.fallbackAssetUri}/${AssetType.VSIX}?redirect=true${version.targetPlatform ? `&targetPlatform=${version.targetPlatform}` : ''}`,
        fallbackUri: `${version.fallbackAssetUri}/${AssetType.VSIX}${version.targetPlatform ? `?targetPlatform=${version.targetPlatform}` : ''}`
    };
}
function getVersionAsset(version, type) {
    const result = version.files.filter(f => f.assetType === type)[0];
    return result ? {
        uri: `${version.assetUri}/${type}${version.targetPlatform ? `?targetPlatform=${version.targetPlatform}` : ''}`,
        fallbackUri: `${version.fallbackAssetUri}/${type}${version.targetPlatform ? `?targetPlatform=${version.targetPlatform}` : ''}`
    } : null;
}
function getExtensions(version, property) {
    const values = version.properties ? version.properties.filter(p => p.key === property) : [];
    const value = values.length > 0 && values[0].value;
    return value ? value.split(',').map(v => adoptToGalleryExtensionId(v)) : [];
}
function getEngine(version) {
    const values = version.properties ? version.properties.filter(p => p.key === PropertyType.Engine) : [];
    return (values.length > 0 && values[0].value) || '';
}
function isPreReleaseVersion(version) {
    const values = version.properties ? version.properties.filter(p => p.key === PropertyType.PreRelease) : [];
    return values.length > 0 && values[0].value === 'true';
}
function hasPreReleaseForExtension(id, productService) {
    return productService.extensionProperties?.[id.toLowerCase()]?.hasPrereleaseVersion;
}
function getExcludeVersionRangeForExtension(id, productService) {
    return productService.extensionProperties?.[id.toLowerCase()]?.excludeVersionRange;
}
function isPrivateExtension(version) {
    const values = version.properties ? version.properties.filter(p => p.key === PropertyType.Private) : [];
    return values.length > 0 && values[0].value === 'true';
}
function executesCode(version) {
    const values = version.properties ? version.properties.filter(p => p.key === PropertyType.ExecutesCode) : [];
    return values.length > 0 ? values[0].value === 'true' : undefined;
}
function getEnabledApiProposals(version) {
    const values = version.properties ? version.properties.filter(p => p.key === PropertyType.EnabledApiProposals) : [];
    const value = (values.length > 0 && values[0].value) || '';
    return value ? value.split(',') : [];
}
function getLocalizedLanguages(version) {
    const values = version.properties ? version.properties.filter(p => p.key === PropertyType.LocalizedLanguages) : [];
    const value = (values.length > 0 && values[0].value) || '';
    return value ? value.split(',') : [];
}
function getSponsorLink(version) {
    return version.properties?.find(p => p.key === PropertyType.SponsorLink)?.value;
}
function getSupportLink(version) {
    return version.properties?.find(p => p.key === PropertyType.SupportLink)?.value;
}
function getIsPreview(flags) {
    return flags.indexOf('preview') !== -1;
}
function getTargetPlatformForExtensionVersion(version) {
    return version.targetPlatform ? toTargetPlatform(version.targetPlatform) : "undefined" /* TargetPlatform.UNDEFINED */;
}
function getAllTargetPlatforms(rawGalleryExtension) {
    const allTargetPlatforms = distinct(rawGalleryExtension.versions.map(getTargetPlatformForExtensionVersion));
    // Is a web extension only if it has WEB_EXTENSION_TAG
    const isWebExtension = !!rawGalleryExtension.tags?.includes(WEB_EXTENSION_TAG);
    // Include Web Target Platform only if it is a web extension
    const webTargetPlatformIndex = allTargetPlatforms.indexOf("web" /* TargetPlatform.WEB */);
    if (isWebExtension) {
        if (webTargetPlatformIndex === -1) {
            // Web extension but does not has web target platform -> add it
            allTargetPlatforms.push("web" /* TargetPlatform.WEB */);
        }
    }
    else {
        if (webTargetPlatformIndex !== -1) {
            // Not a web extension but has web target platform -> remove it
            allTargetPlatforms.splice(webTargetPlatformIndex, 1);
        }
    }
    return allTargetPlatforms;
}
export function sortExtensionVersions(versions, preferredTargetPlatform) {
    /* It is expected that versions from Marketplace are sorted by version. So we are just sorting by preferred targetPlatform */
    for (let index = 0; index < versions.length; index++) {
        const version = versions[index];
        if (version.version === versions[index - 1]?.version) {
            let insertionIndex = index;
            const versionTargetPlatform = getTargetPlatformForExtensionVersion(version);
            /* put it at the beginning */
            if (versionTargetPlatform === preferredTargetPlatform) {
                while (insertionIndex > 0 && versions[insertionIndex - 1].version === version.version) {
                    insertionIndex--;
                }
            }
            if (insertionIndex !== index) {
                versions.splice(index, 1);
                versions.splice(insertionIndex, 0, version);
            }
        }
    }
    return versions;
}
export function filterLatestExtensionVersionsForTargetPlatform(versions, targetPlatform, allTargetPlatforms) {
    const latestVersions = [];
    let preReleaseVersionFoundForTargetPlatform = false;
    let releaseVersionFoundForTargetPlatform = false;
    for (const version of versions) {
        const versionTargetPlatform = getTargetPlatformForExtensionVersion(version);
        const isCompatibleWithTargetPlatform = isTargetPlatformCompatible(versionTargetPlatform, allTargetPlatforms, targetPlatform);
        // Always include versions that are NOT compatible with the target platform
        if (!isCompatibleWithTargetPlatform) {
            latestVersions.push(version);
            continue;
        }
        // For compatible versions, only include the first (latest) of each type
        if (isPreReleaseVersion(version)) {
            if (!preReleaseVersionFoundForTargetPlatform) {
                preReleaseVersionFoundForTargetPlatform = true;
                latestVersions.push(version);
            }
        }
        else {
            if (!releaseVersionFoundForTargetPlatform) {
                releaseVersionFoundForTargetPlatform = true;
                latestVersions.push(version);
            }
        }
    }
    return latestVersions;
}
function setTelemetry(extension, index, querySource) {
    /* __GDPR__FRAGMENT__
    "GalleryExtensionTelemetryData2" : {
        "index" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
        "querySource": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
        "queryActivityId": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    }
    */
    extension.telemetryData = { index, querySource, queryActivityId: extension.queryContext?.[SEARCH_ACTIVITY_HEADER_NAME] };
}
function toExtension(galleryExtension, version, allTargetPlatforms, extensionGalleryManifest, productService, queryContext) {
    const latestVersion = galleryExtension.versions[0];
    const assets = {
        manifest: getVersionAsset(version, AssetType.Manifest),
        readme: getVersionAsset(version, AssetType.Details),
        changelog: getVersionAsset(version, AssetType.Changelog),
        license: getVersionAsset(version, AssetType.License),
        repository: getRepositoryAsset(version),
        download: getDownloadAsset(version),
        icon: getVersionAsset(version, AssetType.Icon),
        signature: getVersionAsset(version, AssetType.Signature),
        coreTranslations: getCoreTranslationAssets(version)
    };
    const detailsViewUri = getExtensionGalleryManifestResourceUri(extensionGalleryManifest, galleryExtension.linkType ?? "ExtensionDetailsViewUriTemplate" /* ExtensionGalleryResourceType.ExtensionDetailsViewUri */);
    const publisherViewUri = getExtensionGalleryManifestResourceUri(extensionGalleryManifest, galleryExtension.publisher.linkType ?? "PublisherViewUriTemplate" /* ExtensionGalleryResourceType.PublisherViewUri */);
    const ratingViewUri = getExtensionGalleryManifestResourceUri(extensionGalleryManifest, galleryExtension.ratingLinkType ?? "ExtensionRatingViewUriTemplate" /* ExtensionGalleryResourceType.ExtensionRatingViewUri */);
    const id = getGalleryExtensionId(galleryExtension.publisher.publisherName, galleryExtension.extensionName);
    return {
        type: 'gallery',
        identifier: {
            id,
            uuid: galleryExtension.extensionId
        },
        name: galleryExtension.extensionName,
        version: version.version,
        displayName: galleryExtension.displayName,
        publisherId: galleryExtension.publisher.publisherId,
        publisher: galleryExtension.publisher.publisherName,
        publisherDisplayName: galleryExtension.publisher.displayName,
        publisherDomain: galleryExtension.publisher.domain ? { link: galleryExtension.publisher.domain, verified: !!galleryExtension.publisher.isDomainVerified } : undefined,
        publisherSponsorLink: getSponsorLink(latestVersion),
        description: galleryExtension.shortDescription ?? '',
        installCount: getStatistic(galleryExtension.statistics, 'install'),
        rating: getStatistic(galleryExtension.statistics, 'averagerating'),
        ratingCount: getStatistic(galleryExtension.statistics, 'ratingcount'),
        categories: galleryExtension.categories || [],
        tags: galleryExtension.tags || [],
        releaseDate: Date.parse(galleryExtension.releaseDate),
        lastUpdated: Date.parse(galleryExtension.lastUpdated),
        allTargetPlatforms,
        assets,
        properties: {
            dependencies: getExtensions(version, PropertyType.Dependency),
            extensionPack: getExtensions(version, PropertyType.ExtensionPack),
            engine: getEngine(version),
            enabledApiProposals: getEnabledApiProposals(version),
            localizedLanguages: getLocalizedLanguages(version),
            targetPlatform: getTargetPlatformForExtensionVersion(version),
            isPreReleaseVersion: isPreReleaseVersion(version),
            executesCode: executesCode(version)
        },
        hasPreReleaseVersion: hasPreReleaseForExtension(id, productService) ?? isPreReleaseVersion(latestVersion),
        hasReleaseVersion: true,
        private: isPrivateExtension(latestVersion),
        preview: getIsPreview(galleryExtension.flags),
        isSigned: !!assets.signature,
        queryContext,
        supportLink: getSupportLink(latestVersion),
        detailsLink: detailsViewUri ? format2(detailsViewUri, { publisher: galleryExtension.publisher.publisherName, name: galleryExtension.extensionName }) : undefined,
        publisherLink: publisherViewUri ? format2(publisherViewUri, { publisher: galleryExtension.publisher.publisherName }) : undefined,
        ratingLink: ratingViewUri ? format2(ratingViewUri, { publisher: galleryExtension.publisher.publisherName, name: galleryExtension.extensionName }) : undefined,
    };
}
let AbstractExtensionGalleryService = class AbstractExtensionGalleryService {
    constructor(storageService, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService) {
        this.requestService = requestService;
        this.logService = logService;
        this.environmentService = environmentService;
        this.telemetryService = telemetryService;
        this.fileService = fileService;
        this.productService = productService;
        this.configurationService = configurationService;
        this.allowedExtensionsService = allowedExtensionsService;
        this.extensionGalleryManifestService = extensionGalleryManifestService;
        this.extensionsControlUrl = productService.extensionsGallery?.controlUrl;
        this.unpkgResourceApi = productService.extensionsGallery?.extensionUrlTemplate;
        this.extensionsEnabledWithApiProposalVersion = productService.extensionsEnabledWithApiProposalVersion?.map(id => id.toLowerCase()) ?? [];
        this.commonHeadersPromise = resolveMarketplaceHeaders(productService.version, productService, this.environmentService, this.configurationService, this.fileService, storageService, this.telemetryService);
    }
    isEnabled() {
        return this.extensionGalleryManifestService.extensionGalleryManifestStatus === "available" /* ExtensionGalleryManifestStatus.Available */;
    }
    async getExtensions(extensionInfos, arg1, arg2) {
        const extensionGalleryManifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
        if (!extensionGalleryManifest) {
            throw new Error('No extension gallery service configured.');
        }
        const options = CancellationToken.isCancellationToken(arg1) ? {} : arg1;
        const token = CancellationToken.isCancellationToken(arg1) ? arg1 : arg2;
        const resourceApi = this.getResourceApi(extensionGalleryManifest);
        const result = resourceApi
            ? await this.getExtensionsUsingResourceApi(extensionInfos, options, resourceApi, extensionGalleryManifest, token)
            : await this.getExtensionsUsingQueryApi(extensionInfos, options, extensionGalleryManifest, token);
        const uuids = result.map(r => r.identifier.uuid);
        const extensionInfosByName = [];
        for (const e of extensionInfos) {
            if (e.uuid && !uuids.includes(e.uuid)) {
                extensionInfosByName.push({ ...e, uuid: undefined });
            }
        }
        if (extensionInfosByName.length) {
            // report telemetry data for additional query
            this.telemetryService.publicLog2('galleryService:additionalQueryByName', {
                count: extensionInfosByName.length
            });
            const extensions = await this.getExtensionsUsingQueryApi(extensionInfosByName, options, extensionGalleryManifest, token);
            result.push(...extensions);
        }
        return result;
    }
    getResourceApi(extensionGalleryManifest) {
        const latestVersionResource = getExtensionGalleryManifestResourceUri(extensionGalleryManifest, "ExtensionLatestVersionUriTemplate" /* ExtensionGalleryResourceType.ExtensionLatestVersionUri */);
        if (latestVersionResource) {
            return {
                uri: latestVersionResource,
                fallback: this.unpkgResourceApi
            };
        }
        return undefined;
    }
    async getExtensionsUsingQueryApi(extensionInfos, options, extensionGalleryManifest, token) {
        const names = [], ids = [], includePreRelease = [], versions = [];
        let isQueryForReleaseVersionFromPreReleaseVersion = true;
        for (const extensionInfo of extensionInfos) {
            if (extensionInfo.uuid) {
                ids.push(extensionInfo.uuid);
            }
            else {
                names.push(extensionInfo.id);
            }
            if (extensionInfo.version) {
                versions.push({ id: extensionInfo.id, uuid: extensionInfo.uuid, version: extensionInfo.version });
            }
            else {
                includePreRelease.push({ id: extensionInfo.id, uuid: extensionInfo.uuid, includePreRelease: !!extensionInfo.preRelease });
            }
            isQueryForReleaseVersionFromPreReleaseVersion = isQueryForReleaseVersionFromPreReleaseVersion && (!!extensionInfo.hasPreRelease && !extensionInfo.preRelease);
        }
        if (!ids.length && !names.length) {
            return [];
        }
        let query = new Query().withPage(1, extensionInfos.length);
        if (ids.length) {
            query = query.withFilter("ExtensionId" /* FilterType.ExtensionId */, ...ids);
        }
        if (names.length) {
            query = query.withFilter("ExtensionName" /* FilterType.ExtensionName */, ...names);
        }
        if (options.queryAllVersions) {
            query = query.withFlags(...query.flags, "IncludeVersions" /* Flag.IncludeVersions */);
        }
        if (options.source) {
            query = query.withSource(options.source);
        }
        const { extensions } = await this.queryGalleryExtensions(query, {
            targetPlatform: options.targetPlatform ?? CURRENT_TARGET_PLATFORM,
            includePreRelease,
            versions,
            compatible: !!options.compatible,
            productVersion: options.productVersion ?? { version: this.productService.version, date: this.productService.date },
            isQueryForReleaseVersionFromPreReleaseVersion
        }, extensionGalleryManifest, token);
        if (options.source) {
            extensions.forEach((e, index) => setTelemetry(e, index, options.source));
        }
        return extensions;
    }
    async getExtensionsUsingResourceApi(extensionInfos, options, resourceApi, extensionGalleryManifest, token) {
        const result = [];
        const toQuery = [];
        const toFetchLatest = [];
        for (const extensionInfo of extensionInfos) {
            if (!EXTENSION_IDENTIFIER_REGEX.test(extensionInfo.id)) {
                continue;
            }
            if (extensionInfo.version) {
                toQuery.push(extensionInfo);
            }
            else {
                toFetchLatest.push(extensionInfo);
            }
        }
        await Promise.all(toFetchLatest.map(async (extensionInfo) => {
            let galleryExtension;
            try {
                galleryExtension = await this.getLatestGalleryExtension(extensionInfo, options, resourceApi, extensionGalleryManifest, token);
                if (isString(galleryExtension)) {
                    // fallback to query
                    this.telemetryService.publicLog2('galleryService:fallbacktoquery', {
                        extension: extensionInfo.id,
                        preRelease: !!extensionInfo.preRelease,
                        compatible: !!options.compatible,
                        errorCode: galleryExtension
                    });
                    toQuery.push(extensionInfo);
                }
                else {
                    result.push(galleryExtension);
                }
            }
            catch (error) {
                if (error instanceof ExtensionGalleryError) {
                    switch (error.code) {
                        case "Offline" /* ExtensionGalleryErrorCode.Offline */:
                        case "Cancelled" /* ExtensionGalleryErrorCode.Cancelled */:
                        case "Timeout" /* ExtensionGalleryErrorCode.Timeout */:
                            throw error;
                    }
                }
                // fallback to query
                this.logService.error(`Error while getting the latest version for the extension ${extensionInfo.id}.`, getErrorMessage(error));
                this.telemetryService.publicLog2('galleryService:fallbacktoquery', {
                    extension: extensionInfo.id,
                    preRelease: !!extensionInfo.preRelease,
                    compatible: !!options.compatible,
                    errorCode: error instanceof ExtensionGalleryError ? error.code : 'Unknown'
                });
                toQuery.push(extensionInfo);
            }
        }));
        if (toQuery.length) {
            const extensions = await this.getExtensionsUsingQueryApi(toQuery, options, extensionGalleryManifest, token);
            result.push(...extensions);
        }
        return result;
    }
    async getLatestGalleryExtension(extensionInfo, options, resourceApi, extensionGalleryManifest, token) {
        const rawGalleryExtension = await this.getLatestRawGalleryExtensionWithFallback(extensionInfo, resourceApi, token);
        if (!rawGalleryExtension) {
            return 'NOT_FOUND';
        }
        const targetPlatform = options.targetPlatform ?? CURRENT_TARGET_PLATFORM;
        const allTargetPlatforms = getAllTargetPlatforms(rawGalleryExtension);
        const rawGalleryExtensionVersion = await this.getValidRawGalleryExtensionVersion(rawGalleryExtension, filterLatestExtensionVersionsForTargetPlatform(rawGalleryExtension.versions, targetPlatform, allTargetPlatforms), {
            targetPlatform,
            compatible: !!options.compatible,
            productVersion: options.productVersion ?? {
                version: this.productService.version,
                date: this.productService.date
            },
            version: extensionInfo.preRelease ? 2 /* VersionKind.Latest */ : 0 /* VersionKind.Release */
        }, allTargetPlatforms);
        if (rawGalleryExtensionVersion) {
            return toExtension(rawGalleryExtension, rawGalleryExtensionVersion, allTargetPlatforms, extensionGalleryManifest, this.productService);
        }
        return 'NOT_COMPATIBLE';
    }
    async getCompatibleExtension(extension, includePreRelease, targetPlatform, productVersion = { version: this.productService.version, date: this.productService.date }) {
        if (isNotWebExtensionInWebTargetPlatform(extension.allTargetPlatforms, targetPlatform)) {
            return null;
        }
        if (await this.isExtensionCompatible(extension, includePreRelease, targetPlatform)) {
            return extension;
        }
        if (this.allowedExtensionsService.isAllowed({ id: extension.identifier.id, publisherDisplayName: extension.publisherDisplayName }) !== true) {
            return null;
        }
        const result = await this.getExtensions([{
                ...extension.identifier,
                preRelease: includePreRelease,
                hasPreRelease: extension.hasPreReleaseVersion,
            }], {
            compatible: true,
            productVersion,
            queryAllVersions: true,
            targetPlatform,
        }, CancellationToken.None);
        return result[0] ?? null;
    }
    async isExtensionCompatible(extension, includePreRelease, targetPlatform, productVersion = { version: this.productService.version, date: this.productService.date }) {
        return this.isValidVersion({
            id: extension.identifier.id,
            version: extension.version,
            isPreReleaseVersion: extension.properties.isPreReleaseVersion,
            targetPlatform: extension.properties.targetPlatform,
            manifestAsset: extension.assets.manifest,
            engine: extension.properties.engine,
            enabledApiProposals: extension.properties.enabledApiProposals
        }, {
            targetPlatform,
            compatible: true,
            productVersion,
            version: includePreRelease ? 2 /* VersionKind.Latest */ : 0 /* VersionKind.Release */
        }, extension.publisherDisplayName, extension.allTargetPlatforms);
    }
    async isValidVersion(extension, { targetPlatform, compatible, productVersion, version }, publisherDisplayName, allTargetPlatforms) {
        const hasPreRelease = hasPreReleaseForExtension(extension.id, this.productService);
        const excludeVersionRange = getExcludeVersionRangeForExtension(extension.id, this.productService);
        if (extension.isPreReleaseVersion && hasPreRelease === false /* Skip if hasPreRelease is not defined for this extension */) {
            return false;
        }
        if (excludeVersionRange && semver.satisfies(extension.version, excludeVersionRange)) {
            return false;
        }
        // Specific version
        if (isString(version)) {
            if (extension.version !== version) {
                return false;
            }
        }
        // Prerelease or release version kind
        else if (version === 0 /* VersionKind.Release */ || version === 1 /* VersionKind.Prerelease */) {
            if (extension.isPreReleaseVersion !== (version === 1 /* VersionKind.Prerelease */)) {
                return false;
            }
        }
        if (targetPlatform && !isTargetPlatformCompatible(extension.targetPlatform, allTargetPlatforms, targetPlatform)) {
            return false;
        }
        if (compatible) {
            if (this.allowedExtensionsService.isAllowed({ id: extension.id, publisherDisplayName, version: extension.version, prerelease: extension.isPreReleaseVersion, targetPlatform: extension.targetPlatform }) !== true) {
                return false;
            }
            if (!this.areApiProposalsCompatible(extension.id, extension.enabledApiProposals)) {
                return false;
            }
            if (!(await this.isEngineValid(extension.id, extension.version, extension.engine, extension.manifestAsset, productVersion))) {
                return false;
            }
        }
        return true;
    }
    areApiProposalsCompatible(extensionId, enabledApiProposals) {
        if (!enabledApiProposals) {
            return true;
        }
        if (!this.extensionsEnabledWithApiProposalVersion.includes(extensionId.toLowerCase())) {
            return true;
        }
        return areApiProposalsCompatible(enabledApiProposals);
    }
    async isEngineValid(extensionId, version, engine, manifestAsset, productVersion) {
        if (!engine) {
            if (!manifestAsset) {
                this.logService.error(`Missing engine and manifest asset for the extension ${extensionId} with version ${version}`);
                return false;
            }
            try {
                this.telemetryService.publicLog2('galleryService:engineFallback', { extension: extensionId, extensionVersion: version });
                const headers = { 'Accept-Encoding': 'gzip' };
                const context = await this.getAsset(extensionId, manifestAsset, AssetType.Manifest, version, { headers });
                const manifest = await asJson(context);
                if (!manifest) {
                    this.logService.error(`Manifest was not found for the extension ${extensionId} with version ${version}`);
                    return false;
                }
                engine = manifest.engines.vscode;
            }
            catch (error) {
                this.logService.error(`Error while getting the engine for the version ${version}.`, getErrorMessage(error));
                return false;
            }
        }
        return isEngineValid(engine, productVersion.version, productVersion.date);
    }
    async query(options, token) {
        const extensionGalleryManifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
        if (!extensionGalleryManifest) {
            throw new Error('No extension gallery service configured.');
        }
        let text = options.text || '';
        const pageSize = options.pageSize ?? 50;
        let query = new Query()
            .withPage(1, pageSize);
        if (text) {
            // Use category filter instead of "category:themes"
            text = text.replace(/\bcategory:("([^"]*)"|([^"]\S*))(\s+|\b|$)/g, (_, quotedCategory, category) => {
                query = query.withFilter("Category" /* FilterType.Category */, category || quotedCategory);
                return '';
            });
            // Use tag filter instead of "tag:debuggers"
            text = text.replace(/\btag:("([^"]*)"|([^"]\S*))(\s+|\b|$)/g, (_, quotedTag, tag) => {
                query = query.withFilter("Tag" /* FilterType.Tag */, tag || quotedTag);
                return '';
            });
            // Use featured filter
            text = text.replace(/\bfeatured(\s+|\b|$)/g, () => {
                query = query.withFilter("Featured" /* FilterType.Featured */);
                return '';
            });
            text = text.trim();
            if (text) {
                text = text.length < 200 ? text : text.substring(0, 200);
                query = query.withFilter("SearchText" /* FilterType.SearchText */, text);
            }
            if (extensionGalleryManifest.capabilities.extensionQuery.sorting?.some(c => c.name === "NoneOrRelevance" /* SortBy.NoneOrRelevance */)) {
                query = query.withSortBy("NoneOrRelevance" /* SortBy.NoneOrRelevance */);
            }
        }
        else {
            if (extensionGalleryManifest.capabilities.extensionQuery.sorting?.some(c => c.name === "InstallCount" /* SortBy.InstallCount */)) {
                query = query.withSortBy("InstallCount" /* SortBy.InstallCount */);
            }
        }
        if (options.sortBy && extensionGalleryManifest.capabilities.extensionQuery.sorting?.some(c => c.name === options.sortBy)) {
            query = query.withSortBy(options.sortBy);
        }
        if (typeof options.sortOrder === 'number') {
            query = query.withSortOrder(options.sortOrder);
        }
        if (options.source) {
            query = query.withSource(options.source);
        }
        const runQuery = async (query, token) => {
            const { extensions, total } = await this.queryGalleryExtensions(query, { targetPlatform: CURRENT_TARGET_PLATFORM, compatible: false, includePreRelease: !!options.includePreRelease, productVersion: options.productVersion ?? { version: this.productService.version, date: this.productService.date } }, extensionGalleryManifest, token);
            extensions.forEach((e, index) => setTelemetry(e, ((query.pageNumber - 1) * query.pageSize) + index, options.source));
            return { extensions, total };
        };
        const { extensions, total } = await runQuery(query, token);
        const getPage = async (pageIndex, ct) => {
            if (ct.isCancellationRequested) {
                throw new CancellationError();
            }
            const { extensions } = await runQuery(query.withPage(pageIndex + 1), ct);
            return extensions;
        };
        return { firstPage: extensions, total, pageSize: query.pageSize, getPage };
    }
    async queryGalleryExtensions(query, criteria, extensionGalleryManifest, token) {
        const flags = query.flags;
        /**
         * If both version flags (IncludeLatestVersionOnly and IncludeVersions) are included, then only include latest versions (IncludeLatestVersionOnly) flag.
         */
        if (query.flags.includes("IncludeLatestVersionOnly" /* Flag.IncludeLatestVersionOnly */) && query.flags.includes("IncludeVersions" /* Flag.IncludeVersions */)) {
            query = query.withFlags(...query.flags.filter(flag => flag !== "IncludeVersions" /* Flag.IncludeVersions */));
        }
        /**
         * If version flags (IncludeLatestVersionOnly and IncludeVersions) are not included, default is to query for latest versions (IncludeLatestVersionOnly).
         */
        if (!query.flags.includes("IncludeLatestVersionOnly" /* Flag.IncludeLatestVersionOnly */) && !query.flags.includes("IncludeVersions" /* Flag.IncludeVersions */)) {
            query = query.withFlags(...query.flags, "IncludeLatestVersionOnly" /* Flag.IncludeLatestVersionOnly */);
        }
        /**
         * If versions criteria exist or every requested extension is for release version and has a pre-release version, then remove latest flags and add all versions flag.
         */
        if (criteria.versions?.length || criteria.isQueryForReleaseVersionFromPreReleaseVersion) {
            query = query.withFlags(...query.flags.filter(flag => flag !== "IncludeLatestVersionOnly" /* Flag.IncludeLatestVersionOnly */), "IncludeVersions" /* Flag.IncludeVersions */);
        }
        /**
         * Add necessary extension flags
         */
        query = query.withFlags(...query.flags, "IncludeAssetUri" /* Flag.IncludeAssetUri */, "IncludeCategoryAndTags" /* Flag.IncludeCategoryAndTags */, "IncludeFiles" /* Flag.IncludeFiles */, "IncludeStatistics" /* Flag.IncludeStatistics */, "IncludeVersionProperties" /* Flag.IncludeVersionProperties */);
        const { galleryExtensions: rawGalleryExtensions, total, context } = await this.queryRawGalleryExtensions(query, extensionGalleryManifest, token);
        const hasAllVersions = !query.flags.includes("IncludeLatestVersionOnly" /* Flag.IncludeLatestVersionOnly */);
        if (hasAllVersions) {
            const extensions = [];
            for (const rawGalleryExtension of rawGalleryExtensions) {
                const allTargetPlatforms = getAllTargetPlatforms(rawGalleryExtension);
                const extensionIdentifier = { id: getGalleryExtensionId(rawGalleryExtension.publisher.publisherName, rawGalleryExtension.extensionName), uuid: rawGalleryExtension.extensionId };
                const includePreRelease = isBoolean(criteria.includePreRelease) ? criteria.includePreRelease : !!criteria.includePreRelease.find(extensionIdentifierWithPreRelease => areSameExtensions(extensionIdentifierWithPreRelease, extensionIdentifier))?.includePreRelease;
                const rawGalleryExtensionVersion = await this.getValidRawGalleryExtensionVersion(rawGalleryExtension, rawGalleryExtension.versions, {
                    compatible: criteria.compatible,
                    targetPlatform: criteria.targetPlatform,
                    productVersion: criteria.productVersion,
                    version: criteria.versions?.find(extensionIdentifierWithVersion => areSameExtensions(extensionIdentifierWithVersion, extensionIdentifier))?.version
                        ?? (includePreRelease ? 2 /* VersionKind.Latest */ : 0 /* VersionKind.Release */)
                }, allTargetPlatforms);
                if (rawGalleryExtensionVersion) {
                    extensions.push(toExtension(rawGalleryExtension, rawGalleryExtensionVersion, allTargetPlatforms, extensionGalleryManifest, this.productService, context));
                }
            }
            return { extensions, total };
        }
        const result = [];
        const needAllVersions = new Map();
        for (let index = 0; index < rawGalleryExtensions.length; index++) {
            const rawGalleryExtension = rawGalleryExtensions[index];
            const extensionIdentifier = { id: getGalleryExtensionId(rawGalleryExtension.publisher.publisherName, rawGalleryExtension.extensionName), uuid: rawGalleryExtension.extensionId };
            const includePreRelease = isBoolean(criteria.includePreRelease) ? criteria.includePreRelease : !!criteria.includePreRelease.find(extensionIdentifierWithPreRelease => areSameExtensions(extensionIdentifierWithPreRelease, extensionIdentifier))?.includePreRelease;
            const allTargetPlatforms = getAllTargetPlatforms(rawGalleryExtension);
            if (criteria.compatible) {
                // Skip looking for all versions if requested for a web-compatible extension and it is not a web extension.
                if (isNotWebExtensionInWebTargetPlatform(allTargetPlatforms, criteria.targetPlatform)) {
                    continue;
                }
                // Skip looking for all versions if the extension is not allowed.
                if (this.allowedExtensionsService.isAllowed({ id: extensionIdentifier.id, publisherDisplayName: rawGalleryExtension.publisher.displayName }) !== true) {
                    continue;
                }
            }
            const rawGalleryExtensionVersion = await this.getValidRawGalleryExtensionVersion(rawGalleryExtension, rawGalleryExtension.versions, {
                compatible: criteria.compatible,
                targetPlatform: criteria.targetPlatform,
                productVersion: criteria.productVersion,
                version: criteria.versions?.find(extensionIdentifierWithVersion => areSameExtensions(extensionIdentifierWithVersion, extensionIdentifier))?.version
                    ?? (includePreRelease ? 2 /* VersionKind.Latest */ : 0 /* VersionKind.Release */)
            }, allTargetPlatforms);
            const extension = rawGalleryExtensionVersion ? toExtension(rawGalleryExtension, rawGalleryExtensionVersion, allTargetPlatforms, extensionGalleryManifest, this.productService, context) : null;
            if (!extension
                /** Need all versions if the extension is a pre-release version but
                 * 		- the query is to look for a release version or
                 * 		- the extension has no release version
                 * Get all versions to get or check the release version
                */
                || (extension.properties.isPreReleaseVersion && (!includePreRelease || !extension.hasReleaseVersion))
                /**
                 * Need all versions if the extension is a release version with a different target platform than requested and also has a pre-release version
                 * Because, this is a platform specific extension and can have a newer release version supporting this platform.
                 * See https://github.com/microsoft/vscode/issues/139628
                */
                || (!extension.properties.isPreReleaseVersion && extension.properties.targetPlatform !== criteria.targetPlatform && extension.hasPreReleaseVersion)) {
                needAllVersions.set(rawGalleryExtension.extensionId, index);
            }
            else {
                result.push([index, extension]);
            }
        }
        if (needAllVersions.size) {
            const stopWatch = new StopWatch();
            const query = new Query()
                .withFlags(...flags.filter(flag => flag !== "IncludeLatestVersionOnly" /* Flag.IncludeLatestVersionOnly */), "IncludeVersions" /* Flag.IncludeVersions */)
                .withPage(1, needAllVersions.size)
                .withFilter("ExtensionId" /* FilterType.ExtensionId */, ...needAllVersions.keys());
            const { extensions } = await this.queryGalleryExtensions(query, criteria, extensionGalleryManifest, token);
            this.telemetryService.publicLog2('galleryService:additionalQuery', {
                duration: stopWatch.elapsed(),
                count: needAllVersions.size
            });
            for (const extension of extensions) {
                const index = needAllVersions.get(extension.identifier.uuid);
                result.push([index, extension]);
            }
        }
        return { extensions: result.sort((a, b) => a[0] - b[0]).map(([, extension]) => extension), total };
    }
    async getValidRawGalleryExtensionVersion(rawGalleryExtension, versions, criteria, allTargetPlatforms) {
        const extensionIdentifier = { id: getGalleryExtensionId(rawGalleryExtension.publisher.publisherName, rawGalleryExtension.extensionName), uuid: rawGalleryExtension.extensionId };
        const rawGalleryExtensionVersions = sortExtensionVersions(versions, criteria.targetPlatform);
        if (criteria.compatible && isNotWebExtensionInWebTargetPlatform(allTargetPlatforms, criteria.targetPlatform)) {
            return null;
        }
        const version = isString(criteria.version) ? criteria.version : undefined;
        for (let index = 0; index < rawGalleryExtensionVersions.length; index++) {
            const rawGalleryExtensionVersion = rawGalleryExtensionVersions[index];
            if (await this.isValidVersion({
                id: extensionIdentifier.id,
                version: rawGalleryExtensionVersion.version,
                isPreReleaseVersion: isPreReleaseVersion(rawGalleryExtensionVersion),
                targetPlatform: getTargetPlatformForExtensionVersion(rawGalleryExtensionVersion),
                engine: getEngine(rawGalleryExtensionVersion),
                manifestAsset: getVersionAsset(rawGalleryExtensionVersion, AssetType.Manifest),
                enabledApiProposals: getEnabledApiProposals(rawGalleryExtensionVersion)
            }, criteria, rawGalleryExtension.publisher.displayName, allTargetPlatforms)) {
                return rawGalleryExtensionVersion;
            }
            if (version && rawGalleryExtensionVersion.version === version) {
                return null;
            }
        }
        if (version || criteria.compatible) {
            return null;
        }
        /**
         * Fallback: Return the latest version
         * This can happen when the extension does not have a release version or does not have a version compatible with the given target platform.
         */
        return rawGalleryExtension.versions[0];
    }
    async queryRawGalleryExtensions(query, extensionGalleryManifest, token) {
        const extensionsQueryApi = getExtensionGalleryManifestResourceUri(extensionGalleryManifest, "ExtensionQueryService" /* ExtensionGalleryResourceType.ExtensionQueryService */);
        if (!extensionsQueryApi) {
            throw new Error('No extension gallery query service configured.');
        }
        query = query
            /* Always exclude non validated extensions */
            .withFlags(...query.flags, "ExcludeNonValidated" /* Flag.ExcludeNonValidated */)
            .withFilter("Target" /* FilterType.Target */, 'Microsoft.VisualStudio.Code');
        const unpublishedFlag = extensionGalleryManifest.capabilities.extensionQuery.flags?.find(f => f.name === "Unpublished" /* Flag.Unpublished */);
        /* Always exclude unpublished extensions */
        if (unpublishedFlag) {
            query = query.withFilter("ExcludeWithFlags" /* FilterType.ExcludeWithFlags */, String(unpublishedFlag.value));
        }
        const data = JSON.stringify({
            filters: [
                {
                    criteria: query.criteria.reduce((criteria, c) => {
                        const criterium = extensionGalleryManifest.capabilities.extensionQuery.filtering?.find(f => f.name === c.filterType);
                        if (criterium) {
                            criteria.push({
                                filterType: criterium.value,
                                value: c.value,
                            });
                        }
                        return criteria;
                    }, []),
                    pageNumber: query.pageNumber,
                    pageSize: query.pageSize,
                    sortBy: extensionGalleryManifest.capabilities.extensionQuery.sorting?.find(s => s.name === query.sortBy)?.value,
                    sortOrder: query.sortOrder,
                }
            ],
            assetTypes: query.assetTypes,
            flags: query.flags.reduce((flags, flag) => {
                const flagValue = extensionGalleryManifest.capabilities.extensionQuery.flags?.find(f => f.name === flag);
                if (flagValue) {
                    flags |= flagValue.value;
                }
                return flags;
            }, 0)
        });
        const commonHeaders = await this.commonHeadersPromise;
        const headers = {
            ...commonHeaders,
            'Content-Type': 'application/json',
            'Accept': 'application/json;api-version=3.0-preview.1',
            'Accept-Encoding': 'gzip',
            'Content-Length': String(data.length),
        };
        const stopWatch = new StopWatch();
        let context, errorCode, total = 0;
        try {
            context = await this.requestService.request({
                type: 'POST',
                url: extensionsQueryApi,
                data,
                headers
            }, token);
            if (context.res.statusCode && context.res.statusCode >= 400 && context.res.statusCode < 500) {
                return { galleryExtensions: [], total };
            }
            const result = await asJson(context);
            if (result) {
                const r = result.results[0];
                const galleryExtensions = r.extensions;
                const resultCount = r.resultMetadata && r.resultMetadata.filter(m => m.metadataType === 'ResultCount')[0];
                total = resultCount && resultCount.metadataItems.filter(i => i.name === 'TotalCount')[0].count || 0;
                return {
                    galleryExtensions,
                    total,
                    context: context.res.headers['activityid'] ? {
                        [SEARCH_ACTIVITY_HEADER_NAME]: context.res.headers['activityid']
                    } : {}
                };
            }
            return { galleryExtensions: [], total };
        }
        catch (e) {
            if (isCancellationError(e)) {
                errorCode = "Cancelled" /* ExtensionGalleryErrorCode.Cancelled */;
                throw e;
            }
            else {
                const errorMessage = getErrorMessage(e);
                errorCode = isOfflineError(e)
                    ? "Offline" /* ExtensionGalleryErrorCode.Offline */
                    : errorMessage.startsWith('XHR timeout')
                        ? "Timeout" /* ExtensionGalleryErrorCode.Timeout */
                        : "Failed" /* ExtensionGalleryErrorCode.Failed */;
                throw new ExtensionGalleryError(errorMessage, errorCode);
            }
        }
        finally {
            this.telemetryService.publicLog2('galleryService:query', {
                filterTypes: query.criteria.map(criterium => criterium.filterType),
                flags: query.flags,
                sortBy: query.sortBy,
                sortOrder: String(query.sortOrder),
                pageNumber: String(query.pageNumber),
                source: query.source,
                searchTextLength: query.searchText.length,
                requestBodySize: String(data.length),
                duration: stopWatch.elapsed(),
                success: !!context && isSuccess(context),
                responseBodySize: context?.res.headers['Content-Length'],
                statusCode: context ? String(context.res.statusCode) : undefined,
                errorCode,
                count: String(total),
                server: this.getHeaderValue(context?.res.headers, SERVER_HEADER_NAME),
                activityId: this.getHeaderValue(context?.res.headers, ACTIVITY_HEADER_NAME),
                endToEndId: this.getHeaderValue(context?.res.headers, END_END_ID_HEADER_NAME),
            });
        }
    }
    getHeaderValue(headers, name) {
        const headerValue = headers?.[name.toLowerCase()];
        const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
        return value ? new TelemetryTrustedValue(value) : undefined;
    }
    async getLatestRawGalleryExtensionWithFallback(extensionInfo, resourceApi, token) {
        const [publisher, name] = extensionInfo.id.split('.');
        let errorCode;
        try {
            const uri = URI.parse(format2(resourceApi.uri, { publisher, name }));
            return await this.getLatestRawGalleryExtension(extensionInfo.id, uri, token);
        }
        catch (error) {
            if (error instanceof ExtensionGalleryError) {
                errorCode = error.code;
                switch (error.code) {
                    case "Offline" /* ExtensionGalleryErrorCode.Offline */:
                    case "Cancelled" /* ExtensionGalleryErrorCode.Cancelled */:
                    case "Timeout" /* ExtensionGalleryErrorCode.Timeout */:
                    case "ClientError" /* ExtensionGalleryErrorCode.ClientError */:
                        throw error;
                }
            }
            else {
                errorCode = 'Unknown';
            }
            if (!resourceApi.fallback) {
                throw error;
            }
        }
        finally {
            this.telemetryService.publicLog2('galleryService:getmarketplacelatest', {
                extension: extensionInfo.id,
                errorCode,
            });
        }
        this.logService.error(`Error while getting the latest version for the extension ${extensionInfo.id} from ${resourceApi.uri}. Trying the fallback ${resourceApi.fallback}`, errorCode);
        try {
            const uri = URI.parse(format2(resourceApi.fallback, { publisher, name }));
            return await this.getLatestRawGalleryExtension(extensionInfo.id, uri, token);
        }
        catch (error) {
            errorCode = error instanceof ExtensionGalleryError ? error.code : 'Unknown';
            throw error;
        }
        finally {
            this.telemetryService.publicLog2('galleryService:fallbacktounpkg', {
                extension: extensionInfo.id,
                errorCode,
            });
        }
    }
    async getLatestRawGalleryExtension(extension, uri, token) {
        let context;
        let errorCode;
        const stopWatch = new StopWatch();
        try {
            const commonHeaders = await this.commonHeadersPromise;
            const headers = {
                ...commonHeaders,
                'Content-Type': 'application/json',
                'Accept': 'application/json;api-version=7.2-preview',
                'Accept-Encoding': 'gzip',
            };
            context = await this.requestService.request({
                type: 'GET',
                url: uri.toString(true),
                headers,
                timeout: this.getRequestTimeout()
            }, token);
            if (context.res.statusCode === 404) {
                errorCode = 'NotFound';
                return null;
            }
            if (context.res.statusCode && context.res.statusCode !== 200) {
                throw new Error('Unexpected HTTP response: ' + context.res.statusCode);
            }
            const result = await asJson(context);
            if (!result) {
                errorCode = 'NoData';
            }
            return result;
        }
        catch (error) {
            let galleryErrorCode;
            if (isCancellationError(error)) {
                galleryErrorCode = "Cancelled" /* ExtensionGalleryErrorCode.Cancelled */;
            }
            else if (isOfflineError(error)) {
                galleryErrorCode = "Offline" /* ExtensionGalleryErrorCode.Offline */;
            }
            else if (getErrorMessage(error).startsWith('XHR timeout')) {
                galleryErrorCode = "Timeout" /* ExtensionGalleryErrorCode.Timeout */;
            }
            else if (context && isClientError(context)) {
                galleryErrorCode = "ClientError" /* ExtensionGalleryErrorCode.ClientError */;
            }
            else if (context && isServerError(context)) {
                galleryErrorCode = "ServerError" /* ExtensionGalleryErrorCode.ServerError */;
            }
            else {
                galleryErrorCode = "Failed" /* ExtensionGalleryErrorCode.Failed */;
            }
            errorCode = galleryErrorCode;
            throw new ExtensionGalleryError(error, galleryErrorCode);
        }
        finally {
            this.telemetryService.publicLog2('galleryService:getLatest', {
                extension,
                host: uri.authority,
                duration: stopWatch.elapsed(),
                errorCode,
                statusCode: context?.res.statusCode && context?.res.statusCode !== 200 ? `${context.res.statusCode}` : undefined,
                server: this.getHeaderValue(context?.res.headers, SERVER_HEADER_NAME),
                activityId: this.getHeaderValue(context?.res.headers, ACTIVITY_HEADER_NAME),
                endToEndId: this.getHeaderValue(context?.res.headers, END_END_ID_HEADER_NAME),
            });
        }
    }
    async reportStatistic(publisher, name, version, type) {
        const manifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
        if (!manifest) {
            return undefined;
        }
        let url;
        if (isWeb) {
            const resource = getExtensionGalleryManifestResourceUri(manifest, "WebExtensionStatisticsUriTemplate" /* ExtensionGalleryResourceType.WebExtensionStatisticsUri */);
            if (!resource) {
                return;
            }
            url = format2(resource, { publisher, name, version, statTypeValue: type === "install" /* StatisticType.Install */ ? '1' : '3' });
        }
        else {
            const resource = getExtensionGalleryManifestResourceUri(manifest, "ExtensionStatisticsUriTemplate" /* ExtensionGalleryResourceType.ExtensionStatisticsUri */);
            if (!resource) {
                return;
            }
            url = format2(resource, { publisher, name, version, statTypeName: type });
        }
        const Accept = isWeb ? 'api-version=6.1-preview.1' : '*/*;api-version=4.0-preview.1';
        const commonHeaders = await this.commonHeadersPromise;
        const headers = { ...commonHeaders, Accept };
        try {
            await this.requestService.request({
                type: 'POST',
                url,
                headers
            }, CancellationToken.None);
        }
        catch (error) { /* Ignore */ }
    }
    async download(extension, location, operation) {
        this.logService.trace('ExtensionGalleryService#download', extension.identifier.id);
        const data = getGalleryExtensionTelemetryData(extension);
        const startTime = new Date().getTime();
        const operationParam = operation === 2 /* InstallOperation.Install */ ? 'install' : operation === 3 /* InstallOperation.Update */ ? 'update' : '';
        const downloadAsset = operationParam ? {
            uri: `${extension.assets.download.uri}${URI.parse(extension.assets.download.uri).query ? '&' : '?'}${operationParam}=true`,
            fallbackUri: `${extension.assets.download.fallbackUri}${URI.parse(extension.assets.download.fallbackUri).query ? '&' : '?'}${operationParam}=true`
        } : extension.assets.download;
        const activityId = extension.queryContext?.[SEARCH_ACTIVITY_HEADER_NAME];
        const headers = activityId && typeof activityId === 'string' ? { [SEARCH_ACTIVITY_HEADER_NAME]: activityId } : undefined;
        const context = await this.getAsset(extension.identifier.id, downloadAsset, AssetType.VSIX, extension.version, headers ? { headers } : undefined);
        try {
            await this.fileService.writeFile(location, context.stream);
        }
        catch (error) {
            try {
                await this.fileService.del(location);
            }
            catch (e) {
                /* ignore */
                this.logService.warn(`Error while deleting the file ${location.toString()}`, getErrorMessage(e));
            }
            throw new ExtensionGalleryError(getErrorMessage(error), "DownloadFailedWriting" /* ExtensionGalleryErrorCode.DownloadFailedWriting */);
        }
        /* __GDPR__
            "galleryService:downloadVSIX" : {
                "owner": "sandy081",
                "duration": { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true },
                "${include}": [
                    "${GalleryExtensionTelemetryData}"
                ]
            }
        */
        this.telemetryService.publicLog('galleryService:downloadVSIX', { ...data, duration: new Date().getTime() - startTime });
    }
    async downloadSignatureArchive(extension, location) {
        if (!extension.assets.signature) {
            throw new Error('No signature asset found');
        }
        this.logService.trace('ExtensionGalleryService#downloadSignatureArchive', extension.identifier.id);
        const context = await this.getAsset(extension.identifier.id, extension.assets.signature, AssetType.Signature, extension.version);
        try {
            await this.fileService.writeFile(location, context.stream);
        }
        catch (error) {
            try {
                await this.fileService.del(location);
            }
            catch (e) {
                /* ignore */
                this.logService.warn(`Error while deleting the file ${location.toString()}`, getErrorMessage(e));
            }
            throw new ExtensionGalleryError(getErrorMessage(error), "DownloadFailedWriting" /* ExtensionGalleryErrorCode.DownloadFailedWriting */);
        }
    }
    async getReadme(extension, token) {
        if (extension.assets.readme) {
            const context = await this.getAsset(extension.identifier.id, extension.assets.readme, AssetType.Details, extension.version, {}, token);
            const content = await asTextOrError(context);
            return content || '';
        }
        return '';
    }
    async getManifest(extension, token) {
        if (extension.assets.manifest) {
            const context = await this.getAsset(extension.identifier.id, extension.assets.manifest, AssetType.Manifest, extension.version, {}, token);
            const text = await asTextOrError(context);
            return text ? JSON.parse(text) : null;
        }
        return null;
    }
    async getCoreTranslation(extension, languageId) {
        const asset = extension.assets.coreTranslations.filter(t => t[0] === languageId.toUpperCase())[0];
        if (asset) {
            const context = await this.getAsset(extension.identifier.id, asset[1], asset[0], extension.version);
            const text = await asTextOrError(context);
            return text ? JSON.parse(text) : null;
        }
        return null;
    }
    async getChangelog(extension, token) {
        if (extension.assets.changelog) {
            const context = await this.getAsset(extension.identifier.id, extension.assets.changelog, AssetType.Changelog, extension.version, {}, token);
            const content = await asTextOrError(context);
            return content || '';
        }
        return '';
    }
    async getAllVersions(extensionIdentifier) {
        return this.getVersions(extensionIdentifier);
    }
    async getAllCompatibleVersions(extensionIdentifier, includePreRelease, targetPlatform) {
        return this.getVersions(extensionIdentifier, { version: includePreRelease ? 2 /* VersionKind.Latest */ : 0 /* VersionKind.Release */, targetPlatform });
    }
    async getVersions(extensionIdentifier, onlyCompatible) {
        const extensionGalleryManifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
        if (!extensionGalleryManifest) {
            throw new Error('No extension gallery service configured.');
        }
        let query = new Query()
            .withFlags("IncludeVersions" /* Flag.IncludeVersions */, "IncludeCategoryAndTags" /* Flag.IncludeCategoryAndTags */, "IncludeFiles" /* Flag.IncludeFiles */, "IncludeVersionProperties" /* Flag.IncludeVersionProperties */)
            .withPage(1, 1);
        if (extensionIdentifier.uuid) {
            query = query.withFilter("ExtensionId" /* FilterType.ExtensionId */, extensionIdentifier.uuid);
        }
        else {
            query = query.withFilter("ExtensionName" /* FilterType.ExtensionName */, extensionIdentifier.id);
        }
        const { galleryExtensions } = await this.queryRawGalleryExtensions(query, extensionGalleryManifest, CancellationToken.None);
        if (!galleryExtensions.length) {
            return [];
        }
        const allTargetPlatforms = getAllTargetPlatforms(galleryExtensions[0]);
        if (onlyCompatible && isNotWebExtensionInWebTargetPlatform(allTargetPlatforms, onlyCompatible.targetPlatform)) {
            return [];
        }
        const versions = [];
        const productVersion = { version: this.productService.version, date: this.productService.date };
        await Promise.all(galleryExtensions[0].versions.map(async (version) => {
            try {
                if ((await this.isValidVersion({
                    id: extensionIdentifier.id,
                    version: version.version,
                    isPreReleaseVersion: isPreReleaseVersion(version),
                    targetPlatform: getTargetPlatformForExtensionVersion(version),
                    engine: getEngine(version),
                    manifestAsset: getVersionAsset(version, AssetType.Manifest),
                    enabledApiProposals: getEnabledApiProposals(version)
                }, {
                    compatible: !!onlyCompatible,
                    productVersion,
                    targetPlatform: onlyCompatible?.targetPlatform,
                    version: onlyCompatible?.version ?? version.version
                }, galleryExtensions[0].publisher.displayName, allTargetPlatforms))) {
                    versions.push(version);
                }
            }
            catch (error) { /* Ignore error and skip version */ }
        }));
        const result = [];
        const seen = new Map();
        for (const version of sortExtensionVersions(versions, onlyCompatible?.targetPlatform ?? CURRENT_TARGET_PLATFORM)) {
            const index = seen.get(version.version);
            const existing = index !== undefined ? result[index] : undefined;
            const targetPlatform = getTargetPlatformForExtensionVersion(version);
            if (!existing) {
                seen.set(version.version, result.length);
                result.push({ version: version.version, date: version.lastUpdated, isPreReleaseVersion: isPreReleaseVersion(version), targetPlatforms: [targetPlatform] });
            }
            else {
                existing.targetPlatforms.push(targetPlatform);
            }
        }
        return result;
    }
    async getAsset(extension, asset, assetType, extensionVersion, options = {}, token = CancellationToken.None) {
        const commonHeaders = await this.commonHeadersPromise;
        const baseOptions = { type: 'GET' };
        const headers = { ...commonHeaders, ...(options.headers || {}) };
        options = { ...options, ...baseOptions, headers };
        const url = asset.uri;
        const fallbackUrl = asset.fallbackUri;
        const firstOptions = { ...options, url, timeout: this.getRequestTimeout() };
        let context;
        try {
            context = await this.requestService.request(firstOptions, token);
            if (context.res.statusCode === 200) {
                return context;
            }
            const message = await asTextOrError(context);
            throw new Error(`Expected 200, got back ${context.res.statusCode} instead.\n\n${message}`);
        }
        catch (err) {
            if (isCancellationError(err)) {
                throw err;
            }
            const message = getErrorMessage(err);
            this.telemetryService.publicLog2('galleryService:cdnFallback', {
                extension,
                assetType,
                message,
                extensionVersion,
                server: this.getHeaderValue(context?.res.headers, SERVER_HEADER_NAME),
                activityId: this.getHeaderValue(context?.res.headers, ACTIVITY_HEADER_NAME),
                endToEndId: this.getHeaderValue(context?.res.headers, END_END_ID_HEADER_NAME),
            });
            const fallbackOptions = { ...options, url: fallbackUrl, timeout: this.getRequestTimeout() };
            return this.requestService.request(fallbackOptions, token);
        }
    }
    async getExtensionsControlManifest() {
        const manifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
        if (!manifest) {
            throw new Error('No extension gallery service configured.');
        }
        if (!this.extensionsControlUrl) {
            return { malicious: [], deprecated: {}, search: [], autoUpdate: {} };
        }
        const context = await this.requestService.request({
            type: 'GET',
            url: this.extensionsControlUrl,
            timeout: this.getRequestTimeout()
        }, CancellationToken.None);
        if (context.res.statusCode !== 200) {
            throw new Error('Could not get extensions report.');
        }
        const result = await asJson(context);
        const malicious = [];
        const deprecated = {};
        const search = [];
        const autoUpdate = result?.autoUpdate ?? {};
        if (result) {
            for (const id of result.malicious) {
                if (!isString(id)) {
                    continue;
                }
                const publisherOrExtension = EXTENSION_IDENTIFIER_REGEX.test(id) ? { id } : id;
                malicious.push({ extensionOrPublisher: publisherOrExtension, learnMoreLink: result.learnMoreLinks?.[id] });
            }
            if (result.migrateToPreRelease) {
                for (const [unsupportedPreReleaseExtensionId, preReleaseExtensionInfo] of Object.entries(result.migrateToPreRelease)) {
                    if (!preReleaseExtensionInfo.engine || isEngineValid(preReleaseExtensionInfo.engine, this.productService.version, this.productService.date)) {
                        deprecated[unsupportedPreReleaseExtensionId.toLowerCase()] = {
                            disallowInstall: true,
                            extension: {
                                id: preReleaseExtensionInfo.id,
                                displayName: preReleaseExtensionInfo.displayName,
                                autoMigrate: { storage: !!preReleaseExtensionInfo.migrateStorage },
                                preRelease: true
                            }
                        };
                    }
                }
            }
            if (result.deprecated) {
                for (const [deprecatedExtensionId, deprecationInfo] of Object.entries(result.deprecated)) {
                    if (deprecationInfo) {
                        deprecated[deprecatedExtensionId.toLowerCase()] = isBoolean(deprecationInfo) ? {} : deprecationInfo;
                    }
                }
            }
            if (result.search) {
                for (const s of result.search) {
                    search.push(s);
                }
            }
        }
        return { malicious, deprecated, search, autoUpdate };
    }
    getRequestTimeout() {
        const configuredTimeout = this.configurationService.getValue(ExtensionRequestsTimeoutConfigKey);
        return isNumber(configuredTimeout) && configuredTimeout >= 0 ? configuredTimeout : 60_000;
    }
};
AbstractExtensionGalleryService = __decorate([
    __param(1, IRequestService),
    __param(2, ILogService),
    __param(3, IEnvironmentService),
    __param(4, ITelemetryService),
    __param(5, IFileService),
    __param(6, IProductService),
    __param(7, IConfigurationService),
    __param(8, IAllowedExtensionsService),
    __param(9, IExtensionGalleryManifestService)
], AbstractExtensionGalleryService);
export { AbstractExtensionGalleryService };
let ExtensionGalleryService = class ExtensionGalleryService extends AbstractExtensionGalleryService {
    constructor(storageService, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService) {
        super(storageService, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService);
    }
};
ExtensionGalleryService = __decorate([
    __param(0, IStorageService),
    __param(1, IRequestService),
    __param(2, ILogService),
    __param(3, IEnvironmentService),
    __param(4, ITelemetryService),
    __param(5, IFileService),
    __param(6, IProductService),
    __param(7, IConfigurationService),
    __param(8, IAllowedExtensionsService),
    __param(9, IExtensionGalleryManifestService)
], ExtensionGalleryService);
export { ExtensionGalleryService };
let ExtensionGalleryServiceWithNoStorageService = class ExtensionGalleryServiceWithNoStorageService extends AbstractExtensionGalleryService {
    constructor(requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService) {
        super(undefined, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService);
    }
};
ExtensionGalleryServiceWithNoStorageService = __decorate([
    __param(0, IRequestService),
    __param(1, ILogService),
    __param(2, IEnvironmentService),
    __param(3, ITelemetryService),
    __param(4, IFileService),
    __param(5, IProductService),
    __param(6, IConfigurationService),
    __param(7, IAllowedExtensionsService),
    __param(8, IExtensionGalleryManifestService)
], ExtensionGalleryServiceWithNoStorageService);
export { ExtensionGalleryServiceWithNoStorageService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pFLE9BQU8sS0FBSyxNQUFNLE1BQU0sdUNBQXVDLENBQUM7QUFFaEUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLGVBQWUsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRXpHLE9BQU8sRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbkUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQzlFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNsRCxPQUFPLEVBQThDLGNBQWMsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzNILE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxpQkFBaUIsRUFBNk4sb0NBQW9DLEVBQUUsMEJBQTBCLEVBQTBDLGdCQUFnQixFQUFFLGlCQUFpQixFQUFxRSxxQkFBcUIsRUFBOEMseUJBQXlCLEVBQUUsMEJBQTBCLEVBQThDLGlDQUFpQyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFD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