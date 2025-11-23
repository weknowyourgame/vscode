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
import { MarkdownString } from '../../../base/common/htmlContent.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { Schemas } from '../../../base/common/network.js';
import { format2, uppercaseFirstLetter } from '../../../base/common/strings.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { IFileService } from '../../files/common/files.js';
import { ILogService } from '../../log/common/log.js';
import { asJson, asText, IRequestService } from '../../request/common/request.js';
import { IMcpGalleryManifestService, getMcpGalleryManifestResourceUri } from './mcpGalleryManifest.js';
import { CancellationError } from '../../../base/common/errors.js';
import { isObject, isString } from '../../../base/common/types.js';
var IconMimeType;
(function (IconMimeType) {
    IconMimeType["PNG"] = "image/png";
    IconMimeType["JPEG"] = "image/jpeg";
    IconMimeType["JPG"] = "image/jpg";
    IconMimeType["SVG"] = "image/svg+xml";
    IconMimeType["WEBP"] = "image/webp";
})(IconMimeType || (IconMimeType = {}));
var IconTheme;
(function (IconTheme) {
    IconTheme["LIGHT"] = "light";
    IconTheme["DARK"] = "dark";
})(IconTheme || (IconTheme = {}));
var McpServerSchemaVersion_v2025_07_09;
(function (McpServerSchemaVersion_v2025_07_09) {
    McpServerSchemaVersion_v2025_07_09.VERSION = 'v0-2025-07-09';
    McpServerSchemaVersion_v2025_07_09.SCHEMA = `https://static.modelcontextprotocol.io/schemas/2025-07-09/server.schema.json`;
    class Serializer {
        toRawGalleryMcpServerResult(input) {
            if (!input || typeof input !== 'object' || !Array.isArray(input.servers)) {
                return undefined;
            }
            const from = input;
            const servers = [];
            for (const server of from.servers) {
                const rawServer = this.toRawGalleryMcpServer(server);
                if (!rawServer) {
                    return undefined;
                }
                servers.push(rawServer);
            }
            return {
                metadata: {
                    count: from.metadata.count ?? 0,
                    nextCursor: from.metadata?.next_cursor
                },
                servers
            };
        }
        toRawGalleryMcpServer(input) {
            if (!input || typeof input !== 'object') {
                return undefined;
            }
            const from = input;
            if ((!from.name || !isString(from.name))
                || (!from.description || !isString(from.description))
                || (!from.version || !isString(from.version))) {
                return undefined;
            }
            if (from.$schema && from.$schema !== McpServerSchemaVersion_v2025_07_09.SCHEMA) {
                return undefined;
            }
            const registryInfo = from._meta?.['io.modelcontextprotocol.registry/official'];
            function convertServerInput(input) {
                return {
                    ...input,
                    isRequired: input.is_required,
                    isSecret: input.is_secret,
                };
            }
            function convertVariables(variables) {
                const result = {};
                for (const [key, value] of Object.entries(variables)) {
                    result[key] = convertServerInput(value);
                }
                return result;
            }
            function convertServerArgument(arg) {
                if (arg.type === 'positional') {
                    return {
                        ...arg,
                        valueHint: arg.value_hint,
                        isRepeated: arg.is_repeated,
                        isRequired: arg.is_required,
                        isSecret: arg.is_secret,
                        variables: arg.variables ? convertVariables(arg.variables) : undefined,
                    };
                }
                return {
                    ...arg,
                    isRepeated: arg.is_repeated,
                    isRequired: arg.is_required,
                    isSecret: arg.is_secret,
                    variables: arg.variables ? convertVariables(arg.variables) : undefined,
                };
            }
            function convertKeyValueInput(input) {
                return {
                    ...input,
                    isRequired: input.is_required,
                    isSecret: input.is_secret,
                    variables: input.variables ? convertVariables(input.variables) : undefined,
                };
            }
            function convertTransport(input) {
                switch (input.type) {
                    case 'stdio':
                        return {
                            type: "stdio" /* TransportType.STDIO */,
                        };
                    case 'streamable-http':
                        return {
                            type: "streamable-http" /* TransportType.STREAMABLE_HTTP */,
                            url: input.url,
                            headers: input.headers?.map(convertKeyValueInput),
                        };
                    case 'sse':
                        return {
                            type: "sse" /* TransportType.SSE */,
                            url: input.url,
                            headers: input.headers?.map(convertKeyValueInput),
                        };
                    default:
                        return {
                            type: "stdio" /* TransportType.STDIO */,
                        };
                }
            }
            function convertRegistryType(input) {
                switch (input) {
                    case 'npm':
                        return "npm" /* RegistryType.NODE */;
                    case 'docker':
                    case 'docker-hub':
                    case 'oci':
                        return "oci" /* RegistryType.DOCKER */;
                    case 'pypi':
                        return "pypi" /* RegistryType.PYTHON */;
                    case 'nuget':
                        return "nuget" /* RegistryType.NUGET */;
                    case 'mcpb':
                        return "mcpb" /* RegistryType.MCPB */;
                    default:
                        return "npm" /* RegistryType.NODE */;
                }
            }
            const gitHubInfo = from._meta['io.modelcontextprotocol.registry/publisher-provided']?.github;
            return {
                id: registryInfo.id,
                name: from.name,
                description: from.description,
                repository: from.repository ? {
                    url: from.repository.url,
                    source: from.repository.source,
                    id: from.repository.id,
                } : undefined,
                readme: from.repository?.readme,
                version: from.version,
                createdAt: from.created_at,
                updatedAt: from.updated_at,
                packages: from.packages?.map(p => ({
                    identifier: p.identifier ?? p.name,
                    registryType: convertRegistryType(p.registry_type ?? p.registry_name),
                    version: p.version,
                    fileSha256: p.file_sha256,
                    registryBaseUrl: p.registry_base_url,
                    transport: p.transport ? convertTransport(p.transport) : { type: "stdio" /* TransportType.STDIO */ },
                    packageArguments: p.package_arguments?.map(convertServerArgument),
                    runtimeHint: p.runtime_hint,
                    runtimeArguments: p.runtime_arguments?.map(convertServerArgument),
                    environmentVariables: p.environment_variables?.map(convertKeyValueInput),
                })),
                remotes: from.remotes?.map(remote => {
                    const type = remote.type ?? remote.transport_type ?? remote.transport;
                    return {
                        type: type === "sse" /* TransportType.SSE */ ? "sse" /* TransportType.SSE */ : "streamable-http" /* TransportType.STREAMABLE_HTTP */,
                        url: remote.url,
                        headers: remote.headers?.map(convertKeyValueInput)
                    };
                }),
                registryInfo: {
                    isLatest: registryInfo.is_latest,
                    publishedAt: registryInfo.published_at,
                    updatedAt: registryInfo.updated_at,
                },
                githubInfo: gitHubInfo ? {
                    name: gitHubInfo.name,
                    nameWithOwner: gitHubInfo.name_with_owner,
                    displayName: gitHubInfo.display_name,
                    isInOrganization: gitHubInfo.is_in_organization,
                    license: gitHubInfo.license,
                    opengraphImageUrl: gitHubInfo.opengraph_image_url,
                    ownerAvatarUrl: gitHubInfo.owner_avatar_url,
                    primaryLanguage: gitHubInfo.primary_language,
                    primaryLanguageColor: gitHubInfo.primary_language_color,
                    pushedAt: gitHubInfo.pushed_at,
                    stargazerCount: gitHubInfo.stargazer_count,
                    topics: gitHubInfo.topics,
                    usesCustomOpengraphImage: gitHubInfo.uses_custom_opengraph_image
                } : undefined
            };
        }
    }
    McpServerSchemaVersion_v2025_07_09.SERIALIZER = new Serializer();
})(McpServerSchemaVersion_v2025_07_09 || (McpServerSchemaVersion_v2025_07_09 = {}));
var McpServerSchemaVersion_v0_1;
(function (McpServerSchemaVersion_v0_1) {
    McpServerSchemaVersion_v0_1.VERSION = 'v0.1';
    McpServerSchemaVersion_v0_1.SCHEMA = `https://static.modelcontextprotocol.io/schemas/2025-09-29/server.schema.json`;
    class Serializer {
        toRawGalleryMcpServerResult(input) {
            if (!input || typeof input !== 'object' || !Array.isArray(input.servers)) {
                return undefined;
            }
            const from = input;
            const servers = [];
            for (const server of from.servers) {
                const rawServer = this.toRawGalleryMcpServer(server);
                if (!rawServer) {
                    if (servers.length === 0) {
                        return undefined;
                    }
                    else {
                        continue;
                    }
                }
                servers.push(rawServer);
            }
            return {
                metadata: from.metadata,
                servers
            };
        }
        toRawGalleryMcpServer(input) {
            if (!input || typeof input !== 'object') {
                return undefined;
            }
            const from = input;
            if ((!from.server || !isObject(from.server))
                || (!from.server.name || !isString(from.server.name))
                || (!from.server.description || !isString(from.server.description))
                || (!from.server.version || !isString(from.server.version))) {
                return undefined;
            }
            if (from.server.$schema && from.server.$schema !== McpServerSchemaVersion_v0_1.SCHEMA) {
                return undefined;
            }
            const { 'io.modelcontextprotocol.registry/official': registryInfo, ...apicInfo } = from._meta;
            const githubInfo = from.server._meta?.['io.modelcontextprotocol.registry/publisher-provided']?.github;
            return {
                name: from.server.name,
                description: from.server.description,
                version: from.server.version,
                title: from.server.title,
                repository: from.server.repository ? {
                    url: from.server.repository.url,
                    source: from.server.repository.source,
                    id: from.server.repository.id,
                } : undefined,
                readme: githubInfo?.readme,
                icons: from.server.icons,
                websiteUrl: from.server.websiteUrl,
                packages: from.server.packages,
                remotes: from.server.remotes,
                status: registryInfo?.status,
                registryInfo,
                githubInfo,
                apicInfo
            };
        }
    }
    McpServerSchemaVersion_v0_1.SERIALIZER = new Serializer();
})(McpServerSchemaVersion_v0_1 || (McpServerSchemaVersion_v0_1 = {}));
var McpServerSchemaVersion_v0;
(function (McpServerSchemaVersion_v0) {
    McpServerSchemaVersion_v0.VERSION = 'v0';
    class Serializer {
        constructor() {
            this.galleryMcpServerDataSerializers = [];
            this.galleryMcpServerDataSerializers.push(McpServerSchemaVersion_v0_1.SERIALIZER);
            this.galleryMcpServerDataSerializers.push(McpServerSchemaVersion_v2025_07_09.SERIALIZER);
        }
        toRawGalleryMcpServerResult(input) {
            for (const serializer of this.galleryMcpServerDataSerializers) {
                const result = serializer.toRawGalleryMcpServerResult(input);
                if (result) {
                    return result;
                }
            }
            return undefined;
        }
        toRawGalleryMcpServer(input) {
            for (const serializer of this.galleryMcpServerDataSerializers) {
                const result = serializer.toRawGalleryMcpServer(input);
                if (result) {
                    return result;
                }
            }
            return undefined;
        }
    }
    McpServerSchemaVersion_v0.SERIALIZER = new Serializer();
})(McpServerSchemaVersion_v0 || (McpServerSchemaVersion_v0 = {}));
const DefaultPageSize = 50;
const DefaultQueryState = {
    pageSize: DefaultPageSize,
};
class Query {
    constructor(state = DefaultQueryState) {
        this.state = state;
    }
    get pageSize() { return this.state.pageSize; }
    get searchText() { return this.state.searchText; }
    get cursor() { return this.state.cursor; }
    withPage(cursor, pageSize = this.pageSize) {
        return new Query({ ...this.state, pageSize, cursor });
    }
    withSearchText(searchText) {
        return new Query({ ...this.state, searchText });
    }
}
let McpGalleryService = class McpGalleryService extends Disposable {
    constructor(requestService, fileService, logService, mcpGalleryManifestService) {
        super();
        this.requestService = requestService;
        this.fileService = fileService;
        this.logService = logService;
        this.mcpGalleryManifestService = mcpGalleryManifestService;
        this.galleryMcpServerDataSerializers = new Map();
        this.galleryMcpServerDataSerializers.set(McpServerSchemaVersion_v0.VERSION, McpServerSchemaVersion_v0.SERIALIZER);
        this.galleryMcpServerDataSerializers.set(McpServerSchemaVersion_v0_1.VERSION, McpServerSchemaVersion_v0_1.SERIALIZER);
    }
    isEnabled() {
        return this.mcpGalleryManifestService.mcpGalleryManifestStatus === "available" /* McpGalleryManifestStatus.Available */;
    }
    async query(options, token = CancellationToken.None) {
        const mcpGalleryManifest = await this.mcpGalleryManifestService.getMcpGalleryManifest();
        if (!mcpGalleryManifest) {
            return {
                firstPage: { items: [], hasMore: false },
                getNextPage: async () => ({ items: [], hasMore: false })
            };
        }
        let query = new Query();
        if (options?.text) {
            query = query.withSearchText(options.text.trim());
        }
        const { servers, metadata } = await this.queryGalleryMcpServers(query, mcpGalleryManifest, token);
        let currentCursor = metadata.nextCursor;
        return {
            firstPage: { items: servers, hasMore: !!metadata.nextCursor },
            getNextPage: async (ct) => {
                if (ct.isCancellationRequested) {
                    throw new CancellationError();
                }
                if (!currentCursor) {
                    return { items: [], hasMore: false };
                }
                const { servers, metadata: nextMetadata } = await this.queryGalleryMcpServers(query.withPage(currentCursor).withSearchText(undefined), mcpGalleryManifest, ct);
                currentCursor = nextMetadata.nextCursor;
                return { items: servers, hasMore: !!nextMetadata.nextCursor };
            }
        };
    }
    async getMcpServersFromGallery(infos) {
        const mcpGalleryManifest = await this.mcpGalleryManifestService.getMcpGalleryManifest();
        if (!mcpGalleryManifest) {
            return [];
        }
        const mcpServers = [];
        await Promise.allSettled(infos.map(async (info) => {
            const mcpServer = await this.getMcpServerByName(info, mcpGalleryManifest);
            if (mcpServer) {
                mcpServers.push(mcpServer);
            }
        }));
        return mcpServers;
    }
    async getMcpServerByName({ name, id }, mcpGalleryManifest) {
        const mcpServerUrl = this.getLatestServerVersionUrl(name, mcpGalleryManifest);
        if (mcpServerUrl) {
            const mcpServer = await this.getMcpServer(mcpServerUrl);
            if (mcpServer) {
                return mcpServer;
            }
        }
        const byNameUrl = this.getNamedServerUrl(name, mcpGalleryManifest);
        if (byNameUrl) {
            const mcpServer = await this.getMcpServer(byNameUrl);
            if (mcpServer) {
                return mcpServer;
            }
        }
        const byIdUrl = id ? this.getServerIdUrl(id, mcpGalleryManifest) : undefined;
        if (byIdUrl) {
            const mcpServer = await this.getMcpServer(byIdUrl);
            if (mcpServer) {
                return mcpServer;
            }
        }
        return undefined;
    }
    async getReadme(gallery, token) {
        const readmeUrl = gallery.readmeUrl;
        if (!readmeUrl) {
            return Promise.resolve(localize('noReadme', 'No README available'));
        }
        const uri = URI.parse(readmeUrl);
        if (uri.scheme === Schemas.file) {
            try {
                const content = await this.fileService.readFile(uri);
                return content.value.toString();
            }
            catch (error) {
                this.logService.error(`Failed to read file from ${uri}: ${error}`);
            }
        }
        if (uri.authority !== 'raw.githubusercontent.com') {
            return new MarkdownString(localize('readme.viewInBrowser', "You can find information about this server [here]({0})", readmeUrl)).value;
        }
        const context = await this.requestService.request({
            type: 'GET',
            url: readmeUrl,
        }, token);
        const result = await asText(context);
        if (!result) {
            throw new Error(`Failed to fetch README from ${readmeUrl}`);
        }
        return result;
    }
    toGalleryMcpServer(server, manifest) {
        let publisher = '';
        let displayName = server.title;
        if (server.githubInfo?.name) {
            if (!displayName) {
                displayName = server.githubInfo.name.split('-').map(s => s.toLowerCase() === 'mcp' ? 'MCP' : s.toLowerCase() === 'github' ? 'GitHub' : uppercaseFirstLetter(s)).join(' ');
            }
            publisher = server.githubInfo.nameWithOwner.split('/')[0];
        }
        else {
            const nameParts = server.name.split('/');
            if (nameParts.length > 0) {
                const domainParts = nameParts[0].split('.');
                if (domainParts.length > 0) {
                    publisher = domainParts[domainParts.length - 1]; // Always take the last part as owner
                }
            }
            if (!displayName) {
                displayName = nameParts[nameParts.length - 1].split('-').map(s => uppercaseFirstLetter(s)).join(' ');
            }
        }
        if (server.githubInfo?.displayName) {
            displayName = server.githubInfo.displayName;
        }
        let icon;
        if (server.githubInfo?.preferredImage) {
            icon = {
                light: server.githubInfo.preferredImage,
                dark: server.githubInfo.preferredImage
            };
        }
        else if (server.githubInfo?.ownerAvatarUrl) {
            icon = {
                light: server.githubInfo.ownerAvatarUrl,
                dark: server.githubInfo.ownerAvatarUrl
            };
        }
        else if (server.apicInfo?.['x-ms-icon']) {
            icon = {
                light: server.apicInfo['x-ms-icon'],
                dark: server.apicInfo['x-ms-icon']
            };
        }
        else if (server.icons && server.icons.length > 0) {
            const lightIcon = server.icons.find(icon => icon.theme === 'light') ?? server.icons[0];
            const darkIcon = server.icons.find(icon => icon.theme === 'dark') ?? lightIcon;
            icon = {
                light: lightIcon.src,
                dark: darkIcon.src
            };
        }
        const webUrl = manifest ? this.getWebUrl(server.name, manifest) : undefined;
        const publisherUrl = manifest ? this.getPublisherUrl(publisher, manifest) : undefined;
        return {
            id: server.id,
            name: server.name,
            displayName,
            galleryUrl: manifest?.url,
            webUrl,
            description: server.description,
            status: server.status ?? "active" /* GalleryMcpServerStatus.Active */,
            version: server.version,
            isLatest: server.registryInfo?.isLatest ?? true,
            publishDate: server.registryInfo?.publishedAt ? Date.parse(server.registryInfo.publishedAt) : undefined,
            lastUpdated: server.githubInfo?.pushedAt ? Date.parse(server.githubInfo.pushedAt) : server.registryInfo?.updatedAt ? Date.parse(server.registryInfo.updatedAt) : undefined,
            repositoryUrl: server.repository?.url,
            readme: server.readme,
            icon,
            publisher,
            publisherUrl,
            license: server.githubInfo?.license,
            starsCount: server.githubInfo?.stargazerCount,
            topics: server.githubInfo?.topics,
            configuration: {
                packages: server.packages,
                remotes: server.remotes
            }
        };
    }
    async queryGalleryMcpServers(query, mcpGalleryManifest, token) {
        const { servers, metadata } = await this.queryRawGalleryMcpServers(query, mcpGalleryManifest, token);
        return {
            servers: servers.map(item => this.toGalleryMcpServer(item, mcpGalleryManifest)),
            metadata
        };
    }
    async queryRawGalleryMcpServers(query, mcpGalleryManifest, token) {
        const mcpGalleryUrl = this.getMcpGalleryUrl(mcpGalleryManifest);
        if (!mcpGalleryUrl) {
            return { servers: [], metadata: { count: 0 } };
        }
        const uri = URI.parse(mcpGalleryUrl);
        if (uri.scheme === Schemas.file) {
            try {
                const content = await this.fileService.readFile(uri);
                const data = content.value.toString();
                return JSON.parse(data);
            }
            catch (error) {
                this.logService.error(`Failed to read file from ${uri}: ${error}`);
            }
        }
        let url = `${mcpGalleryUrl}?limit=${query.pageSize}`;
        if (query.cursor) {
            url += `&cursor=${query.cursor}`;
        }
        if (query.searchText) {
            const text = encodeURIComponent(query.searchText);
            url += `&search=${text}`;
        }
        const context = await this.requestService.request({
            type: 'GET',
            url,
        }, token);
        const data = await asJson(context);
        if (!data) {
            return { servers: [], metadata: { count: 0 } };
        }
        const result = this.serializeMcpServersResult(data, mcpGalleryManifest);
        if (!result) {
            throw new Error(`Failed to serialize MCP servers result from ${mcpGalleryUrl}`, data);
        }
        return result;
    }
    async getMcpServer(mcpServerUrl, mcpGalleryManifest) {
        const context = await this.requestService.request({
            type: 'GET',
            url: mcpServerUrl,
        }, CancellationToken.None);
        if (context.res.statusCode && context.res.statusCode >= 400 && context.res.statusCode < 500) {
            return undefined;
        }
        const data = await asJson(context);
        if (!data) {
            return undefined;
        }
        if (!mcpGalleryManifest) {
            mcpGalleryManifest = await this.mcpGalleryManifestService.getMcpGalleryManifest();
        }
        mcpGalleryManifest = mcpGalleryManifest && mcpServerUrl.startsWith(mcpGalleryManifest.url) ? mcpGalleryManifest : null;
        const server = this.serializeMcpServer(data, mcpGalleryManifest);
        if (!server) {
            throw new Error(`Failed to serialize MCP server from ${mcpServerUrl}`, data);
        }
        return this.toGalleryMcpServer(server, mcpGalleryManifest);
    }
    serializeMcpServer(data, mcpGalleryManifest) {
        return this.getSerializer(mcpGalleryManifest)?.toRawGalleryMcpServer(data);
    }
    serializeMcpServersResult(data, mcpGalleryManifest) {
        return this.getSerializer(mcpGalleryManifest)?.toRawGalleryMcpServerResult(data);
    }
    getSerializer(mcpGalleryManifest) {
        const version = mcpGalleryManifest?.version ?? 'v0';
        return this.galleryMcpServerDataSerializers.get(version);
    }
    getNamedServerUrl(name, mcpGalleryManifest) {
        const namedResourceUriTemplate = getMcpGalleryManifestResourceUri(mcpGalleryManifest, "McpServerNamedResourceUriTemplate" /* McpGalleryResourceType.McpServerNamedResourceUri */);
        if (!namedResourceUriTemplate) {
            return undefined;
        }
        return format2(namedResourceUriTemplate, { name });
    }
    getServerIdUrl(id, mcpGalleryManifest) {
        const resourceUriTemplate = getMcpGalleryManifestResourceUri(mcpGalleryManifest, "McpServerIdUriTemplate" /* McpGalleryResourceType.McpServerIdUri */);
        if (!resourceUriTemplate) {
            return undefined;
        }
        return format2(resourceUriTemplate, { id });
    }
    getLatestServerVersionUrl(name, mcpGalleryManifest) {
        const latestVersionResourceUriTemplate = getMcpGalleryManifestResourceUri(mcpGalleryManifest, "McpServerLatestVersionUriTemplate" /* McpGalleryResourceType.McpServerLatestVersionUri */);
        if (!latestVersionResourceUriTemplate) {
            return undefined;
        }
        return format2(latestVersionResourceUriTemplate, { name: encodeURIComponent(name) });
    }
    getWebUrl(name, mcpGalleryManifest) {
        const resourceUriTemplate = getMcpGalleryManifestResourceUri(mcpGalleryManifest, "McpServerWebUriTemplate" /* McpGalleryResourceType.McpServerWebUri */);
        if (!resourceUriTemplate) {
            return undefined;
        }
        return format2(resourceUriTemplate, { name });
    }
    getPublisherUrl(name, mcpGalleryManifest) {
        const resourceUriTemplate = getMcpGalleryManifestResourceUri(mcpGalleryManifest, "PublisherUriTemplate" /* McpGalleryResourceType.PublisherUriTemplate */);
        if (!resourceUriTemplate) {
            return undefined;
        }
        return format2(resourceUriTemplate, { name });
    }
    getMcpGalleryUrl(mcpGalleryManifest) {
        return getMcpGalleryManifestResourceUri(mcpGalleryManifest, "McpServersQueryService" /* McpGalleryResourceType.McpServersQueryService */);
    }
};
McpGalleryService = __decorate([
    __param(0, IRequestService),
    __param(1, IFileService),
    __param(2, ILogService),
    __param(3, IMcpGalleryManifestService)
], McpGalleryService);
export { McpGalleryService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwR2FsbGVyeVNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vbWNwL2NvbW1vbi9tY3BHYWxsZXJ5U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDckUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMxRCxPQUFPLEVBQUUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDaEYsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ2xELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMzQyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDM0QsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ3RELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLGVBQWUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRWxGLE9BQU8sRUFBRSwwQkFBMEIsRUFBNEIsZ0NBQWdDLEVBQStDLE1BQU0seUJBQXlCLENBQUM7QUFFOUssT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDbkUsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQWlGbkUsSUFBVyxZQU1WO0FBTkQsV0FBVyxZQUFZO0lBQ3RCLGlDQUFpQixDQUFBO0lBQ2pCLG1DQUFtQixDQUFBO0lBQ25CLGlDQUFpQixDQUFB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