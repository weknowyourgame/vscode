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
import { Emitter, Event } from '../../../../base/common/event.js';
import { createCommandUri, MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IMcpGalleryService, mcpAccessConfig, IAllowedMcpServersService } from '../../../../platform/mcp/common/mcpManagement.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IURLService } from '../../../../platform/url/common/url.js';
import { IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { MCP_CONFIGURATION_KEY, WORKSPACE_STANDALONE_CONFIGURATIONS } from '../../../services/configuration/common/configuration.js';
import { ACTIVE_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IWorkbenchMcpManagementService, REMOTE_USER_CONFIG_ID, USER_CONFIG_ID, WORKSPACE_CONFIG_ID, WORKSPACE_FOLDER_CONFIG_ID_PREFIX } from '../../../services/mcp/common/mcpWorkbenchManagementService.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { mcpConfigurationSection } from '../common/mcpConfiguration.js';
import { HasInstalledMcpServersContext, IMcpService, IMcpWorkbenchService, McpServersGalleryStatusContext } from '../common/mcpTypes.js';
import { McpServerEditorInput } from './mcpServerEditorInput.js';
import { IMcpGalleryManifestService } from '../../../../platform/mcp/common/mcpGalleryManifest.js';
import { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';
import { runOnChange } from '../../../../base/common/observable.js';
import Severity from '../../../../base/common/severity.js';
import { Queue } from '../../../../base/common/async.js';
let McpWorkbenchServer = class McpWorkbenchServer {
    constructor(installStateProvider, runtimeStateProvider, local, gallery, installable, mcpGalleryService, fileService) {
        this.installStateProvider = installStateProvider;
        this.runtimeStateProvider = runtimeStateProvider;
        this.local = local;
        this.gallery = gallery;
        this.installable = installable;
        this.mcpGalleryService = mcpGalleryService;
        this.fileService = fileService;
        this.local = local;
    }
    get id() {
        return this.local?.id ?? this.gallery?.name ?? this.installable?.name ?? this.name;
    }
    get name() {
        return this.gallery?.name ?? this.local?.name ?? this.installable?.name ?? '';
    }
    get label() {
        return this.gallery?.displayName ?? this.local?.displayName ?? this.local?.name ?? this.installable?.name ?? '';
    }
    get icon() {
        return this.gallery?.icon ?? this.local?.icon;
    }
    get installState() {
        return this.installStateProvider(this);
    }
    get codicon() {
        return this.gallery?.codicon ?? this.local?.codicon;
    }
    get publisherDisplayName() {
        return this.gallery?.publisherDisplayName ?? this.local?.publisherDisplayName ?? this.gallery?.publisher ?? this.local?.publisher;
    }
    get publisherUrl() {
        return this.gallery?.publisherDomain?.link;
    }
    get description() {
        return this.gallery?.description ?? this.local?.description ?? '';
    }
    get starsCount() {
        return this.gallery?.starsCount ?? 0;
    }
    get license() {
        return this.gallery?.license;
    }
    get repository() {
        return this.gallery?.repositoryUrl;
    }
    get config() {
        return this.local?.config ?? this.installable?.config;
    }
    get runtimeStatus() {
        return this.runtimeStateProvider(this);
    }
    get readmeUrl() {
        return this.local?.readmeUrl ?? (this.gallery?.readmeUrl ? URI.parse(this.gallery.readmeUrl) : undefined);
    }
    async getReadme(token) {
        if (this.local?.readmeUrl) {
            const content = await this.fileService.readFile(this.local.readmeUrl);
            return content.value.toString();
        }
        if (this.gallery?.readme) {
            return this.gallery.readme;
        }
        if (this.gallery?.readmeUrl) {
            return this.mcpGalleryService.getReadme(this.gallery, token);
        }
        return Promise.reject(new Error('not available'));
    }
    async getManifest(token) {
        if (this.local?.manifest) {
            return this.local.manifest;
        }
        if (this.gallery) {
            return this.gallery.configuration;
        }
        throw new Error('No manifest available');
    }
};
McpWorkbenchServer = __decorate([
    __param(5, IMcpGalleryService),
    __param(6, IFileService)
], McpWorkbenchServer);
let McpWorkbenchService = class McpWorkbenchService extends Disposable {
    get local() { return [...this._local]; }
    constructor(mcpGalleryManifestService, mcpGalleryService, mcpManagementService, editorService, userDataProfilesService, uriIdentityService, workspaceService, environmentService, labelService, productService, remoteAgentService, configurationService, instantiationService, telemetryService, logService, extensionsWorkbenchService, allowedMcpServersService, mcpService, urlService) {
        super();
        this.mcpGalleryService = mcpGalleryService;
        this.mcpManagementService = mcpManagementService;
        this.editorService = editorService;
        this.userDataProfilesService = userDataProfilesService;
        this.uriIdentityService = uriIdentityService;
        this.workspaceService = workspaceService;
        this.environmentService = environmentService;
        this.labelService = labelService;
        this.productService = productService;
        this.remoteAgentService = remoteAgentService;
        this.configurationService = configurationService;
        this.instantiationService = instantiationService;
        this.telemetryService = telemetryService;
        this.logService = logService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.allowedMcpServersService = allowedMcpServersService;
        this.mcpService = mcpService;
        this.installing = [];
        this.uninstalling = [];
        this._local = [];
        this._onChange = this._register(new Emitter());
        this.onChange = this._onChange.event;
        this._onReset = this._register(new Emitter());
        this.onReset = this._onReset.event;
        this._register(this.mcpManagementService.onDidInstallMcpServersInCurrentProfile(e => this.onDidInstallMcpServers(e)));
        this._register(this.mcpManagementService.onDidUpdateMcpServersInCurrentProfile(e => this.onDidUpdateMcpServers(e)));
        this._register(this.mcpManagementService.onDidUninstallMcpServerInCurrentProfile(e => this.onDidUninstallMcpServer(e)));
        this._register(this.mcpManagementService.onDidChangeProfile(e => this.onDidChangeProfile()));
        this.queryLocal().then(() => {
            if (this._store.isDisposed) {
                return;
            }
            const queue = this._register(new Queue());
            this._register(mcpGalleryManifestService.onDidChangeMcpGalleryManifest(e => queue.queue(() => this.syncInstalledMcpServers())));
            queue.queue(() => this.syncInstalledMcpServers());
        });
        urlService.registerHandler(this);
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(mcpAccessConfig)) {
                this._onChange.fire(undefined);
            }
        }));
        this._register(this.allowedMcpServersService.onDidChangeAllowedMcpServers(() => {
            this._local = this.sort(this._local);
            this._onChange.fire(undefined);
        }));
        this._register(runOnChange(mcpService.servers, () => {
            this._local = this.sort(this._local);
            this._onChange.fire(undefined);
        }));
    }
    async onDidChangeProfile() {
        await this.queryLocal();
        this._onChange.fire(undefined);
        this._onReset.fire();
    }
    areSameMcpServers(a, b) {
        if (a === b) {
            return true;
        }
        if (!a || !b) {
            return false;
        }
        return a.name === b.name && a.scope === b.scope;
    }
    onDidUninstallMcpServer(e) {
        if (e.error) {
            return;
        }
        const uninstalled = this._local.find(server => this.areSameMcpServers(server.local, e));
        if (uninstalled) {
            this._local = this._local.filter(server => server !== uninstalled);
            this._onChange.fire(uninstalled);
        }
    }
    onDidInstallMcpServers(e) {
        const servers = [];
        for (const { local, source, name } of e) {
            let server = this.installing.find(server => server.local && local ? this.areSameMcpServers(server.local, local) : server.name === name);
            this.installing = server ? this.installing.filter(e => e !== server) : this.installing;
            if (local) {
                if (server) {
                    server.local = local;
                }
                else {
                    server = this.instantiationService.createInstance(McpWorkbenchServer, e => this.getInstallState(e), e => this.getRuntimeStatus(e), local, source, undefined);
                }
                if (!local.galleryUrl) {
                    server.gallery = undefined;
                }
                this._local = this._local.filter(server => !this.areSameMcpServers(server.local, local));
                this.addServer(server);
            }
            this._onChange.fire(server);
        }
        if (servers.some(server => server.local?.galleryUrl && !server.gallery)) {
            this.syncInstalledMcpServers();
        }
    }
    onDidUpdateMcpServers(e) {
        for (const result of e) {
            if (!result.local) {
                continue;
            }
            const serverIndex = this._local.findIndex(server => this.areSameMcpServers(server.local, result.local));
            let server;
            if (serverIndex !== -1) {
                this._local[serverIndex].local = result.local;
                server = this._local[serverIndex];
            }
            else {
                server = this.instantiationService.createInstance(McpWorkbenchServer, e => this.getInstallState(e), e => this.getRuntimeStatus(e), result.local, result.source, undefined);
                this.addServer(server);
            }
            this._onChange.fire(server);
        }
    }
    fromGallery(gallery) {
        for (const local of this._local) {
            if (local.name === gallery.name) {
                local.gallery = gallery;
                return local;
            }
        }
        return undefined;
    }
    async syncInstalledMcpServers() {
        const infos = [];
        for (const installed of this.local) {
            if (installed.local?.source !== 'gallery') {
                continue;
            }
            if (installed.local.galleryUrl) {
                infos.push({ name: installed.local.name, id: installed.local.galleryId });
            }
        }
        if (infos.length) {
            const galleryServers = await this.mcpGalleryService.getMcpServersFromGallery(infos);
            await this.syncInstalledMcpServersWithGallery(galleryServers);
        }
    }
    async syncInstalledMcpServersWithGallery(gallery) {
        const galleryMap = new Map(gallery.map(server => [server.name, server]));
        for (const mcpServer of this.local) {
            if (!mcpServer.local) {
                continue;
            }
            const key = mcpServer.local.name;
            const gallery = key ? galleryMap.get(key) : undefined;
            if (!gallery || gallery.galleryUrl !== mcpServer.local.galleryUrl) {
                if (mcpServer.gallery) {
                    mcpServer.gallery = undefined;
                    this._onChange.fire(mcpServer);
                }
                continue;
            }
            mcpServer.gallery = gallery;
            if (!mcpServer.local.manifest) {
                mcpServer.local = await this.mcpManagementService.updateMetadata(mcpServer.local, gallery);
            }
            this._onChange.fire(mcpServer);
        }
    }
    async queryGallery(options, token) {
        if (!this.mcpGalleryService.isEnabled()) {
            return {
                firstPage: { items: [], hasMore: false },
                getNextPage: async () => ({ items: [], hasMore: false })
            };
        }
        const pager = await this.mcpGalleryService.query(options, token);
        const mapPage = (page) => ({
            items: page.items.map(gallery => this.fromGallery(gallery) ?? this.instantiationService.createInstance(McpWorkbenchServer, e => this.getInstallState(e), e => this.getRuntimeStatus(e), undefined, gallery, undefined)),
            hasMore: page.hasMore
        });
        return {
            firstPage: mapPage(pager.firstPage),
            getNextPage: async (ct) => {
                const nextPage = await pager.getNextPage(ct);
                return mapPage(nextPage);
            }
        };
    }
    async queryLocal() {
        const installed = await this.mcpManagementService.getInstalled();
        this._local = this.sort(installed.map(i => {
            const existing = this._local.find(local => local.id === i.id);
            const local = existing ?? this.instantiationService.createInstance(McpWorkbenchServer, e => this.getInstallState(e), e => this.getRuntimeStatus(e), undefined, undefined, undefined);
            local.local = i;
            return local;
        }));
        this._onChange.fire(undefined);
        return [...this.local];
    }
    addServer(server) {
        this._local.push(server);
        this._local = this.sort(this._local);
    }
    sort(local) {
        return local.sort((a, b) => {
            if (a.name === b.name) {
                if (!a.runtimeStatus || a.runtimeStatus.state === 2 /* McpServerEnablementState.Enabled */) {
                    return -1;
                }
                if (!b.runtimeStatus || b.runtimeStatus.state === 2 /* McpServerEnablementState.Enabled */) {
                    return 1;
                }
                return 0;
            }
            return a.name.localeCompare(b.name);
        });
    }
    getEnabledLocalMcpServers() {
        const result = new Map();
        const userRemote = [];
        const workspace = [];
        for (const server of this.local) {
            const enablementStatus = this.getEnablementStatus(server);
            if (enablementStatus && enablementStatus.state !== 2 /* McpServerEnablementState.Enabled */) {
                continue;
            }
            if (server.local?.scope === "user" /* LocalMcpServerScope.User */) {
                result.set(server.name, server.local);
            }
            else if (server.local?.scope === "remoteUser" /* LocalMcpServerScope.RemoteUser */) {
                userRemote.push(server.local);
            }
            else if (server.local?.scope === "workspace" /* LocalMcpServerScope.Workspace */) {
                workspace.push(server.local);
            }
        }
        for (const server of userRemote) {
            const existing = result.get(server.name);
            if (existing) {
                this.logService.warn(localize('overwriting', "Overwriting mcp server '{0}' from {1} with {2}.", server.name, server.mcpResource.path, existing.mcpResource.path));
            }
            result.set(server.name, server);
        }
        for (const server of workspace) {
            const existing = result.get(server.name);
            if (existing) {
                this.logService.warn(localize('overwriting', "Overwriting mcp server '{0}' from {1} with {2}.", server.name, server.mcpResource.path, existing.mcpResource.path));
            }
            result.set(server.name, server);
        }
        return [...result.values()];
    }
    canInstall(mcpServer) {
        if (!(mcpServer instanceof McpWorkbenchServer)) {
            return new MarkdownString().appendText(localize('not an extension', "The provided object is not an mcp server."));
        }
        if (mcpServer.gallery) {
            const result = this.mcpManagementService.canInstall(mcpServer.gallery);
            if (result === true) {
                return true;
            }
            return result;
        }
        if (mcpServer.installable) {
            const result = this.mcpManagementService.canInstall(mcpServer.installable);
            if (result === true) {
                return true;
            }
            return result;
        }
        return new MarkdownString().appendText(localize('cannot be installed', "Cannot install the '{0}' MCP Server because it is not available in this setup.", mcpServer.label));
    }
    async install(server, installOptions) {
        if (!(server instanceof McpWorkbenchServer)) {
            throw new Error('Invalid server instance');
        }
        if (server.installable) {
            const installable = server.installable;
            return this.doInstall(server, () => this.mcpManagementService.install(installable, installOptions));
        }
        if (server.gallery) {
            const gallery = server.gallery;
            return this.doInstall(server, () => this.mcpManagementService.installFromGallery(gallery, installOptions));
        }
        throw new Error('No installable server found');
    }
    async uninstall(server) {
        if (!server.local) {
            throw new Error('Local server is missing');
        }
        await this.mcpManagementService.uninstall(server.local);
    }
    async doInstall(server, installTask) {
        const source = server.gallery ? 'gallery' : 'local';
        const serverName = server.name;
        // Check for inputs in installable config or if it comes from handleURL with inputs
        const hasInputs = !!(server.installable?.inputs && server.installable.inputs.length > 0);
        this.installing.push(server);
        this._onChange.fire(server);
        try {
            await installTask();
            const result = await this.waitAndGetInstalledMcpServer(server);
            // Track successful installation
            this.telemetryService.publicLog2('mcp/serverInstall', {
                serverName,
                source,
                scope: result.local?.scope ?? 'unknown',
                success: true,
                hasInputs
            });
            return result;
        }
        catch (error) {
            // Track failed installation
            this.telemetryService.publicLog2('mcp/serverInstall', {
                serverName,
                source,
                scope: 'unknown',
                success: false,
                error: error instanceof Error ? error.message : String(error),
                hasInputs
            });
            throw error;
        }
        finally {
            if (this.installing.includes(server)) {
                this.installing.splice(this.installing.indexOf(server), 1);
                this._onChange.fire(server);
            }
        }
    }
    async waitAndGetInstalledMcpServer(server) {
        let installed = this.local.find(local => local.name === server.name);
        if (!installed) {
            await Event.toPromise(Event.filter(this.onChange, e => !!e && this.local.some(local => local.name === server.name)));
        }
        installed = this.local.find(local => local.name === server.name);
        if (!installed) {
            // This should not happen
            throw new Error('Extension should have been installed');
        }
        return installed;
    }
    getMcpConfigPath(arg) {
        if (arg instanceof URI) {
            const mcpResource = arg;
            for (const profile of this.userDataProfilesService.profiles) {
                if (this.uriIdentityService.extUri.isEqual(profile.mcpResource, mcpResource)) {
                    return this.getUserMcpConfigPath(mcpResource);
                }
            }
            return this.remoteAgentService.getEnvironment().then(remoteEnvironment => {
                if (remoteEnvironment && this.uriIdentityService.extUri.isEqual(remoteEnvironment.mcpResource, mcpResource)) {
                    return this.getRemoteMcpConfigPath(mcpResource);
                }
                return this.getWorkspaceMcpConfigPath(mcpResource);
            });
        }
        if (arg.scope === "user" /* LocalMcpServerScope.User */) {
            return this.getUserMcpConfigPath(arg.mcpResource);
        }
        if (arg.scope === "workspace" /* LocalMcpServerScope.Workspace */) {
            return this.getWorkspaceMcpConfigPath(arg.mcpResource);
        }
        if (arg.scope === "remoteUser" /* LocalMcpServerScope.RemoteUser */) {
            return this.getRemoteMcpConfigPath(arg.mcpResource);
        }
        return undefined;
    }
    getUserMcpConfigPath(mcpResource) {
        return {
            id: USER_CONFIG_ID,
            key: 'userLocalValue',
            target: 3 /* ConfigurationTarget.USER_LOCAL */,
            label: localize('mcp.configuration.userLocalValue', 'Global in {0}', this.productService.nameShort),
            scope: 0 /* StorageScope.PROFILE */,
            order: 200 /* McpCollectionSortOrder.User */,
            uri: mcpResource,
            section: [],
        };
    }
    getRemoteMcpConfigPath(mcpResource) {
        return {
            id: REMOTE_USER_CONFIG_ID,
            key: 'userRemoteValue',
            target: 4 /* ConfigurationTarget.USER_REMOTE */,
            label: this.environmentService.remoteAuthority ? this.labelService.getHostLabel(Schemas.vscodeRemote, this.environmentService.remoteAuthority) : 'Remote',
            scope: 0 /* StorageScope.PROFILE */,
            order: 200 /* McpCollectionSortOrder.User */ + -50 /* McpCollectionSortOrder.RemoteBoost */,
            remoteAuthority: this.environmentService.remoteAuthority,
            uri: mcpResource,
            section: [],
        };
    }
    getWorkspaceMcpConfigPath(mcpResource) {
        const workspace = this.workspaceService.getWorkspace();
        if (workspace.configuration && this.uriIdentityService.extUri.isEqual(workspace.configuration, mcpResource)) {
            return {
                id: WORKSPACE_CONFIG_ID,
                key: 'workspaceValue',
                target: 5 /* ConfigurationTarget.WORKSPACE */,
                label: basename(mcpResource),
                scope: 1 /* StorageScope.WORKSPACE */,
                order: 100 /* McpCollectionSortOrder.Workspace */,
                remoteAuthority: this.environmentService.remoteAuthority,
                uri: mcpResource,
                section: ['settings', mcpConfigurationSection],
            };
        }
        const workspaceFolders = workspace.folders;
        for (let index = 0; index < workspaceFolders.length; index++) {
            const workspaceFolder = workspaceFolders[index];
            if (this.uriIdentityService.extUri.isEqual(this.uriIdentityService.extUri.joinPath(workspaceFolder.uri, WORKSPACE_STANDALONE_CONFIGURATIONS[MCP_CONFIGURATION_KEY]), mcpResource)) {
                return {
                    id: `${WORKSPACE_FOLDER_CONFIG_ID_PREFIX}${index}`,
                    key: 'workspaceFolderValue',
                    target: 6 /* ConfigurationTarget.WORKSPACE_FOLDER */,
                    label: `${workspaceFolder.name}/.vscode/mcp.json`,
                    scope: 1 /* StorageScope.WORKSPACE */,
                    remoteAuthority: this.environmentService.remoteAuthority,
                    order: 0 /* McpCollectionSortOrder.WorkspaceFolder */,
                    uri: mcpResource,
                    workspaceFolder,
                };
            }
        }
        return undefined;
    }
    async handleURL(uri) {
        if (uri.path === 'mcp/install') {
            return this.handleMcpInstallUri(uri);
        }
        if (uri.path.startsWith('mcp/by-name/')) {
            const mcpServerName = uri.path.substring('mcp/by-name/'.length);
            if (mcpServerName) {
                return this.handleMcpServerByName(mcpServerName);
            }
        }
        if (uri.path.startsWith('mcp/')) {
            const mcpServerUrl = uri.path.substring(4);
            if (mcpServerUrl) {
                return this.handleMcpServerUrl(`${Schemas.https}://${mcpServerUrl}`);
            }
        }
        return false;
    }
    async handleMcpInstallUri(uri) {
        let parsed;
        try {
            parsed = JSON.parse(decodeURIComponent(uri.query));
        }
        catch (e) {
            return false;
        }
        try {
            const { name, inputs, gallery, ...config } = parsed;
            if (config.type === undefined) {
                config.type = parsed.command ? "stdio" /* McpServerType.LOCAL */ : "http" /* McpServerType.REMOTE */;
            }
            this.open(this.instantiationService.createInstance(McpWorkbenchServer, e => this.getInstallState(e), e => this.getRuntimeStatus(e), undefined, undefined, { name, config, inputs }));
        }
        catch (e) {
            // ignore
        }
        return true;
    }
    async handleMcpServerUrl(url) {
        try {
            const gallery = await this.mcpGalleryService.getMcpServer(url);
            if (!gallery) {
                this.logService.info(`MCP server '${url}' not found`);
                return true;
            }
            const local = this.local.find(e => e.name === gallery.name) ?? this.instantiationService.createInstance(McpWorkbenchServer, e => this.getInstallState(e), e => this.getRuntimeStatus(e), undefined, gallery, undefined);
            this.open(local);
        }
        catch (e) {
            // ignore
            this.logService.error(e);
        }
        return true;
    }
    async handleMcpServerByName(name) {
        try {
            const [gallery] = await this.mcpGalleryService.getMcpServersFromGallery([{ name }]);
            if (!gallery) {
                this.logService.info(`MCP server '${name}' not found`);
                return true;
            }
            const local = this.local.find(e => e.name === gallery.name) ?? this.instantiationService.createInstance(McpWorkbenchServer, e => this.getInstallState(e), e => this.getRuntimeStatus(e), undefined, gallery, undefined);
            this.open(local);
        }
        catch (e) {
            // ignore
            this.logService.error(e);
        }
        return true;
    }
    async openSearch(searchValue, preserveFoucs) {
        await this.extensionsWorkbenchService.openSearch(`@mcp ${searchValue}`, preserveFoucs);
    }
    async open(extension, options) {
        await this.editorService.openEditor(this.instantiationService.createInstance(McpServerEditorInput, extension), options, ACTIVE_GROUP);
    }
    getInstallState(extension) {
        if (this.installing.some(i => i.name === extension.name)) {
            return 0 /* McpServerInstallState.Installing */;
        }
        if (this.uninstalling.some(e => e.name === extension.name)) {
            return 2 /* McpServerInstallState.Uninstalling */;
        }
        const local = this.local.find(e => e === extension);
        return local ? 1 /* McpServerInstallState.Installed */ : 3 /* McpServerInstallState.Uninstalled */;
    }
    getRuntimeStatus(mcpServer) {
        const enablementStatus = this.getEnablementStatus(mcpServer);
        if (enablementStatus) {
            return enablementStatus;
        }
        if (!this.mcpService.servers.get().find(s => s.definition.id === mcpServer.id)) {
            return { state: 0 /* McpServerEnablementState.Disabled */ };
        }
        return undefined;
    }
    getEnablementStatus(mcpServer) {
        if (!mcpServer.local) {
            return undefined;
        }
        const settingsCommandLink = createCommandUri('workbench.action.openSettings', { query: `@id:${mcpAccessConfig}` }).toString();
        const accessValue = this.configurationService.getValue(mcpAccessConfig);
        if (accessValue === "none" /* McpAccessValue.None */) {
            return {
                state: 1 /* McpServerEnablementState.DisabledByAccess */,
                message: {
                    severity: Severity.Warning,
                    text: new MarkdownString(localize('disabled - all not allowed', "This MCP Server is disabled because MCP servers are configured to be disabled in the Editor. Please check your [settings]({0}).", settingsCommandLink))
                }
            };
        }
        if (accessValue === "registry" /* McpAccessValue.Registry */) {
            if (!mcpServer.gallery) {
                return {
                    state: 1 /* McpServerEnablementState.DisabledByAccess */,
                    message: {
                        severity: Severity.Warning,
                        text: new MarkdownString(localize('disabled - some not allowed', "This MCP Server is disabled because it is configured to be disabled in the Editor. Please check your [settings]({0}).", settingsCommandLink))
                    }
                };
            }
            const remoteUrl = mcpServer.local.config.type === "http" /* McpServerType.REMOTE */ && mcpServer.local.config.url;
            if (remoteUrl && !mcpServer.gallery.configuration.remotes?.some(remote => remote.url === remoteUrl)) {
                return {
                    state: 1 /* McpServerEnablementState.DisabledByAccess */,
                    message: {
                        severity: Severity.Warning,
                        text: new MarkdownString(localize('disabled - some not allowed', "This MCP Server is disabled because it is configured to be disabled in the Editor. Please check your [settings]({0}).", settingsCommandLink))
                    }
                };
            }
        }
        return undefined;
    }
};
McpWorkbenchService = __decorate([
    __param(0, IMcpGalleryManifestService),
    __param(1, IMcpGalleryService),
    __param(2, IWorkbenchMcpManagementService),
    __param(3, IEditorService),
    __param(4, IUserDataProfilesService),
    __param(5, IUriIdentityService),
    __param(6, IWorkspaceContextService),
    __param(7, IWorkbenchEnvironmentService),
    __param(8, ILabelService),
    __param(9, IProductService),
    __param(10, IRemoteAgentService),
    __param(11, IConfigurationService),
    __param(12, IInstantiationService),
    __param(13, ITelemetryService),
    __param(14, ILogService),
    __param(15, IExtensionsWorkbenchService),
    __param(16, IAllowedMcpServersService),
    __param(17, IMcpService),
    __param(18, IURLService)
], McpWorkbenchService);
export { McpWorkbenchService };
let MCPContextsInitialisation = class MCPContextsInitialisation extends Disposable {
    static { this.ID = 'workbench.mcp.contexts.initialisation'; }
    constructor(mcpWorkbenchService, mcpGalleryManifestService, contextKeyService) {
        super();
        const mcpServersGalleryStatus = McpServersGalleryStatusContext.bindTo(contextKeyService);
        mcpServersGalleryStatus.set(mcpGalleryManifestService.mcpGalleryManifestStatus);
        this._register(mcpGalleryManifestService.onDidChangeMcpGalleryManifestStatus(status => mcpServersGalleryStatus.set(status)));
        const hasInstalledMcpServersContextKey = HasInstalledMcpServersContext.bindTo(contextKeyService);
        mcpWorkbenchService.queryLocal().finally(() => {
            hasInstalledMcpServersContextKey.set(mcpWorkbenchService.local.length > 0);
            this._register(mcpWorkbenchService.onChange(() => hasInstalledMcpServersContextKey.set(mcpWorkbenchService.local.length > 0)));
        });
    }
};
MCPContextsInitialisation = __decorate([
    __param(0, IMcpWorkbenchService),
    __param(1, IMcpGalleryManifestService),
    __param(2, IContextKeyService)
], MCPContextsInitialisation);
export { MCPContextsInitialisation };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwV29ya2JlbmNoU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvYnJvd3Nlci9tY3BXb3JrYmVuY2hTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGdCQUFnQixFQUFtQixjQUFjLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUMzRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUVoRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBdUIscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUN4SCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUUxRixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDMUUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQXFCLGtCQUFrQixFQUF3RSxlQUFlLEVBQWtCLHlCQUF5QixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDM08sT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0s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