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
import { RunOnceScheduler } from '../../../base/common/async.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { Emitter } from '../../../base/common/event.js';
import { MarkdownString } from '../../../base/common/htmlContent.js';
import { Disposable, DisposableStore } from '../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../base/common/map.js';
import { equals } from '../../../base/common/objects.js';
import { isString } from '../../../base/common/types.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { IEnvironmentService } from '../../environment/common/environment.js';
import { IFileService } from '../../files/common/files.js';
import { IInstantiationService } from '../../instantiation/common/instantiation.js';
import { ILogService } from '../../log/common/log.js';
import { IUriIdentityService } from '../../uriIdentity/common/uriIdentity.js';
import { IUserDataProfilesService } from '../../userDataProfile/common/userDataProfile.js';
import { IMcpGalleryService, IAllowedMcpServersService } from './mcpManagement.js';
import { IMcpResourceScannerService } from './mcpResourceScannerService.js';
let AbstractCommonMcpManagementService = class AbstractCommonMcpManagementService extends Disposable {
    constructor(logService) {
        super();
        this.logService = logService;
    }
    getMcpServerConfigurationFromManifest(manifest, packageType) {
        // remote
        if (packageType === "remote" /* RegistryType.REMOTE */ && manifest.remotes?.length) {
            const { inputs, variables } = this.processKeyValueInputs(manifest.remotes[0].headers ?? []);
            return {
                mcpServerConfiguration: {
                    config: {
                        type: "http" /* McpServerType.REMOTE */,
                        url: manifest.remotes[0].url,
                        headers: Object.keys(inputs).length ? inputs : undefined,
                    },
                    inputs: variables.length ? variables : undefined,
                },
                notices: [],
            };
        }
        // local
        const serverPackage = manifest.packages?.find(p => p.registryType === packageType) ?? manifest.packages?.[0];
        if (!serverPackage) {
            throw new Error(`No server package found`);
        }
        const args = [];
        const inputs = [];
        const env = {};
        const notices = [];
        if (serverPackage.registryType === "oci" /* RegistryType.DOCKER */) {
            args.push('run');
            args.push('-i');
            args.push('--rm');
        }
        if (serverPackage.runtimeArguments?.length) {
            const result = this.processArguments(serverPackage.runtimeArguments ?? []);
            args.push(...result.args);
            inputs.push(...result.variables);
            notices.push(...result.notices);
        }
        if (serverPackage.environmentVariables?.length) {
            const { inputs: envInputs, variables: envVariables, notices: envNotices } = this.processKeyValueInputs(serverPackage.environmentVariables ?? []);
            inputs.push(...envVariables);
            notices.push(...envNotices);
            for (const [name, value] of Object.entries(envInputs)) {
                env[name] = value;
                if (serverPackage.registryType === "oci" /* RegistryType.DOCKER */) {
                    args.push('-e');
                    args.push(name);
                }
            }
        }
        switch (serverPackage.registryType) {
            case "npm" /* RegistryType.NODE */:
                args.push(serverPackage.version ? `${serverPackage.identifier}@${serverPackage.version}` : serverPackage.identifier);
                break;
            case "pypi" /* RegistryType.PYTHON */:
                args.push(serverPackage.version ? `${serverPackage.identifier}==${serverPackage.version}` : serverPackage.identifier);
                break;
            case "oci" /* RegistryType.DOCKER */:
                args.push(serverPackage.version ? `${serverPackage.identifier}:${serverPackage.version}` : serverPackage.identifier);
                break;
            case "nuget" /* RegistryType.NUGET */:
                args.push(serverPackage.version ? `${serverPackage.identifier}@${serverPackage.version}` : serverPackage.identifier);
                args.push('--yes'); // installation is confirmed by the UI, so --yes is appropriate here
                if (serverPackage.packageArguments?.length) {
                    args.push('--');
                }
                break;
        }
        if (serverPackage.packageArguments?.length) {
            const result = this.processArguments(serverPackage.packageArguments);
            args.push(...result.args);
            inputs.push(...result.variables);
            notices.push(...result.notices);
        }
        return {
            notices,
            mcpServerConfiguration: {
                config: {
                    type: "stdio" /* McpServerType.LOCAL */,
                    command: this.getCommandName(serverPackage.registryType),
                    args: args.length ? args : undefined,
                    env: Object.keys(env).length ? env : undefined,
                },
                inputs: inputs.length ? inputs : undefined,
            }
        };
    }
    getCommandName(packageType) {
        switch (packageType) {
            case "npm" /* RegistryType.NODE */: return 'npx';
            case "oci" /* RegistryType.DOCKER */: return 'docker';
            case "pypi" /* RegistryType.PYTHON */: return 'uvx';
            case "nuget" /* RegistryType.NUGET */: return 'dnx';
        }
        return packageType;
    }
    getVariables(variableInputs) {
        const variables = [];
        for (const [key, value] of Object.entries(variableInputs)) {
            variables.push({
                id: key,
                type: value.choices ? "pickString" /* McpServerVariableType.PICK */ : "promptString" /* McpServerVariableType.PROMPT */,
                description: value.description ?? '',
                password: !!value.isSecret,
                default: value.default,
                options: value.choices,
            });
        }
        return variables;
    }
    processKeyValueInputs(keyValueInputs) {
        const notices = [];
        const inputs = {};
        const variables = [];
        for (const input of keyValueInputs) {
            const inputVariables = input.variables ? this.getVariables(input.variables) : [];
            let value = input.value || '';
            // If explicit variables exist, use them regardless of value
            if (inputVariables.length) {
                for (const variable of inputVariables) {
                    value = value.replace(`{${variable.id}}`, `\${input:${variable.id}}`);
                }
                variables.push(...inputVariables);
            }
            else if (!value && (input.description || input.choices || input.default !== undefined)) {
                // Only create auto-generated input variable if no explicit variables and no value
                variables.push({
                    id: input.name,
                    type: input.choices ? "pickString" /* McpServerVariableType.PICK */ : "promptString" /* McpServerVariableType.PROMPT */,
                    description: input.description ?? '',
                    password: !!input.isSecret,
                    default: input.default,
                    options: input.choices,
                });
                value = `\${input:${input.name}}`;
            }
            inputs[input.name] = value;
        }
        return { inputs, variables, notices };
    }
    processArguments(argumentsList) {
        const args = [];
        const variables = [];
        const notices = [];
        for (const arg of argumentsList) {
            const argVariables = arg.variables ? this.getVariables(arg.variables) : [];
            if (arg.type === 'positional') {
                let value = arg.value;
                if (value) {
                    for (const variable of argVariables) {
                        value = value.replace(`{${variable.id}}`, `\${input:${variable.id}}`);
                    }
                    args.push(value);
                    if (argVariables.length) {
                        variables.push(...argVariables);
                    }
                }
                else if (arg.valueHint && (arg.description || arg.default !== undefined)) {
                    // Create input variable for positional argument without value
                    variables.push({
                        id: arg.valueHint,
                        type: "promptString" /* McpServerVariableType.PROMPT */,
                        description: arg.description ?? '',
                        password: false,
                        default: arg.default,
                    });
                    args.push(`\${input:${arg.valueHint}}`);
                }
                else {
                    // Fallback to value_hint as literal
                    args.push(arg.valueHint ?? '');
                }
            }
            else if (arg.type === 'named') {
                if (!arg.name) {
                    notices.push(`Named argument is missing a name. ${JSON.stringify(arg)}`);
                    continue;
                }
                args.push(arg.name);
                if (arg.value) {
                    let value = arg.value;
                    for (const variable of argVariables) {
                        value = value.replace(`{${variable.id}}`, `\${input:${variable.id}}`);
                    }
                    args.push(value);
                    if (argVariables.length) {
                        variables.push(...argVariables);
                    }
                }
                else if (arg.description || arg.default !== undefined) {
                    // Create input variable for named argument without value
                    const variableId = arg.name.replace(/^--?/, '');
                    variables.push({
                        id: variableId,
                        type: "promptString" /* McpServerVariableType.PROMPT */,
                        description: arg.description ?? '',
                        password: false,
                        default: arg.default,
                    });
                    args.push(`\${input:${variableId}}`);
                }
            }
        }
        return { args, variables, notices };
    }
};
AbstractCommonMcpManagementService = __decorate([
    __param(0, ILogService)
], AbstractCommonMcpManagementService);
export { AbstractCommonMcpManagementService };
let AbstractMcpResourceManagementService = class AbstractMcpResourceManagementService extends AbstractCommonMcpManagementService {
    get onDidInstallMcpServers() { return this._onDidInstallMcpServers.event; }
    get onDidUpdateMcpServers() { return this._onDidUpdateMcpServers.event; }
    get onUninstallMcpServer() { return this._onUninstallMcpServer.event; }
    get onDidUninstallMcpServer() { return this._onDidUninstallMcpServer.event; }
    constructor(mcpResource, target, mcpGalleryService, fileService, uriIdentityService, logService, mcpResourceScannerService) {
        super(logService);
        this.mcpResource = mcpResource;
        this.target = target;
        this.mcpGalleryService = mcpGalleryService;
        this.fileService = fileService;
        this.uriIdentityService = uriIdentityService;
        this.mcpResourceScannerService = mcpResourceScannerService;
        this.local = new Map();
        this._onInstallMcpServer = this._register(new Emitter());
        this.onInstallMcpServer = this._onInstallMcpServer.event;
        this._onDidInstallMcpServers = this._register(new Emitter());
        this._onDidUpdateMcpServers = this._register(new Emitter());
        this._onUninstallMcpServer = this._register(new Emitter());
        this._onDidUninstallMcpServer = this._register(new Emitter());
        this.reloadConfigurationScheduler = this._register(new RunOnceScheduler(() => this.updateLocal(), 50));
    }
    initialize() {
        if (!this.initializePromise) {
            this.initializePromise = (async () => {
                try {
                    this.local = await this.populateLocalServers();
                }
                finally {
                    this.startWatching();
                }
            })();
        }
        return this.initializePromise;
    }
    async populateLocalServers() {
        this.logService.trace('AbstractMcpResourceManagementService#populateLocalServers', this.mcpResource.toString());
        const local = new Map();
        try {
            const scannedMcpServers = await this.mcpResourceScannerService.scanMcpServers(this.mcpResource, this.target);
            if (scannedMcpServers.servers) {
                await Promise.allSettled(Object.entries(scannedMcpServers.servers).map(async ([name, scannedServer]) => {
                    const server = await this.scanLocalServer(name, scannedServer);
                    local.set(name, server);
                }));
            }
        }
        catch (error) {
            this.logService.debug('Could not read user MCP servers:', error);
            throw error;
        }
        return local;
    }
    startWatching() {
        this._register(this.fileService.watch(this.mcpResource));
        this._register(this.fileService.onDidFilesChange(e => {
            if (e.affects(this.mcpResource)) {
                this.reloadConfigurationScheduler.schedule();
            }
        }));
    }
    async updateLocal() {
        try {
            const current = await this.populateLocalServers();
            const added = [];
            const updated = [];
            const removed = [...this.local.keys()].filter(name => !current.has(name));
            for (const server of removed) {
                this.local.delete(server);
            }
            for (const [name, server] of current) {
                const previous = this.local.get(name);
                if (previous) {
                    if (!equals(previous, server)) {
                        updated.push(server);
                        this.local.set(name, server);
                    }
                }
                else {
                    added.push(server);
                    this.local.set(name, server);
                }
            }
            for (const server of removed) {
                this.local.delete(server);
                this._onDidUninstallMcpServer.fire({ name: server, mcpResource: this.mcpResource });
            }
            if (updated.length) {
                this._onDidUpdateMcpServers.fire(updated.map(server => ({ name: server.name, local: server, mcpResource: this.mcpResource })));
            }
            if (added.length) {
                this._onDidInstallMcpServers.fire(added.map(server => ({ name: server.name, local: server, mcpResource: this.mcpResource })));
            }
        }
        catch (error) {
            this.logService.error('Failed to load installed MCP servers:', error);
        }
    }
    async getInstalled() {
        await this.initialize();
        return Array.from(this.local.values());
    }
    async scanLocalServer(name, config) {
        let mcpServerInfo = await this.getLocalServerInfo(name, config);
        if (!mcpServerInfo) {
            mcpServerInfo = { name, version: config.version, galleryUrl: isString(config.gallery) ? config.gallery : undefined };
        }
        return {
            name,
            config,
            mcpResource: this.mcpResource,
            version: mcpServerInfo.version,
            location: mcpServerInfo.location,
            displayName: mcpServerInfo.displayName,
            description: mcpServerInfo.description,
            publisher: mcpServerInfo.publisher,
            publisherDisplayName: mcpServerInfo.publisherDisplayName,
            galleryUrl: mcpServerInfo.galleryUrl,
            galleryId: mcpServerInfo.galleryId,
            repositoryUrl: mcpServerInfo.repositoryUrl,
            readmeUrl: mcpServerInfo.readmeUrl,
            icon: mcpServerInfo.icon,
            codicon: mcpServerInfo.codicon,
            manifest: mcpServerInfo.manifest,
            source: config.gallery ? 'gallery' : 'local'
        };
    }
    async install(server, options) {
        this.logService.trace('MCP Management Service: install', server.name);
        this._onInstallMcpServer.fire({ name: server.name, mcpResource: this.mcpResource });
        try {
            await this.mcpResourceScannerService.addMcpServers([server], this.mcpResource, this.target);
            await this.updateLocal();
            const local = this.local.get(server.name);
            if (!local) {
                throw new Error(`Failed to install MCP server: ${server.name}`);
            }
            return local;
        }
        catch (e) {
            this._onDidInstallMcpServers.fire([{ name: server.name, error: e, mcpResource: this.mcpResource }]);
            throw e;
        }
    }
    async uninstall(server, options) {
        this.logService.trace('MCP Management Service: uninstall', server.name);
        this._onUninstallMcpServer.fire({ name: server.name, mcpResource: this.mcpResource });
        try {
            const currentServers = await this.mcpResourceScannerService.scanMcpServers(this.mcpResource, this.target);
            if (!currentServers.servers) {
                return;
            }
            await this.mcpResourceScannerService.removeMcpServers([server.name], this.mcpResource, this.target);
            if (server.location) {
                await this.fileService.del(URI.revive(server.location), { recursive: true });
            }
            await this.updateLocal();
        }
        catch (e) {
            this._onDidUninstallMcpServer.fire({ name: server.name, error: e, mcpResource: this.mcpResource });
            throw e;
        }
    }
};
AbstractMcpResourceManagementService = __decorate([
    __param(2, IMcpGalleryService),
    __param(3, IFileService),
    __param(4, IUriIdentityService),
    __param(5, ILogService),
    __param(6, IMcpResourceScannerService)
], AbstractMcpResourceManagementService);
export { AbstractMcpResourceManagementService };
let McpUserResourceManagementService = class McpUserResourceManagementService extends AbstractMcpResourceManagementService {
    constructor(mcpResource, mcpGalleryService, fileService, uriIdentityService, logService, mcpResourceScannerService, environmentService) {
        super(mcpResource, 2 /* ConfigurationTarget.USER */, mcpGalleryService, fileService, uriIdentityService, logService, mcpResourceScannerService);
        this.mcpLocation = uriIdentityService.extUri.joinPath(environmentService.userRoamingDataHome, 'mcp');
    }
    async installFromGallery(server, options) {
        throw new Error('Not supported');
    }
    async updateMetadata(local, gallery) {
        await this.updateMetadataFromGallery(gallery);
        await this.updateLocal();
        const updatedLocal = (await this.getInstalled()).find(s => s.name === local.name);
        if (!updatedLocal) {
            throw new Error(`Failed to find MCP server: ${local.name}`);
        }
        return updatedLocal;
    }
    async updateMetadataFromGallery(gallery) {
        const manifest = gallery.configuration;
        const location = this.getLocation(gallery.name, gallery.version);
        const manifestPath = this.uriIdentityService.extUri.joinPath(location, 'manifest.json');
        const local = {
            galleryUrl: gallery.galleryUrl,
            galleryId: gallery.id,
            name: gallery.name,
            displayName: gallery.displayName,
            description: gallery.description,
            version: gallery.version,
            publisher: gallery.publisher,
            publisherDisplayName: gallery.publisherDisplayName,
            repositoryUrl: gallery.repositoryUrl,
            licenseUrl: gallery.license,
            icon: gallery.icon,
            codicon: gallery.codicon,
            manifest,
        };
        await this.fileService.writeFile(manifestPath, VSBuffer.fromString(JSON.stringify(local)));
        if (gallery.readmeUrl || gallery.readme) {
            const readme = gallery.readme ? gallery.readme : await this.mcpGalleryService.getReadme(gallery, CancellationToken.None);
            await this.fileService.writeFile(this.uriIdentityService.extUri.joinPath(location, 'README.md'), VSBuffer.fromString(readme));
        }
        return manifest;
    }
    async getLocalServerInfo(name, mcpServerConfig) {
        let storedMcpServerInfo;
        let location;
        let readmeUrl;
        if (mcpServerConfig.gallery) {
            location = this.getLocation(name, mcpServerConfig.version);
            const manifestLocation = this.uriIdentityService.extUri.joinPath(location, 'manifest.json');
            try {
                const content = await this.fileService.readFile(manifestLocation);
                storedMcpServerInfo = JSON.parse(content.value.toString());
                // migrate
                if (storedMcpServerInfo.galleryUrl?.includes('/v0/')) {
                    storedMcpServerInfo.galleryUrl = storedMcpServerInfo.galleryUrl.substring(0, storedMcpServerInfo.galleryUrl.indexOf('/v0/'));
                    await this.fileService.writeFile(manifestLocation, VSBuffer.fromString(JSON.stringify(storedMcpServerInfo)));
                }
                storedMcpServerInfo.location = location;
                readmeUrl = this.uriIdentityService.extUri.joinPath(location, 'README.md');
                if (!await this.fileService.exists(readmeUrl)) {
                    readmeUrl = undefined;
                }
                storedMcpServerInfo.readmeUrl = readmeUrl;
            }
            catch (e) {
                this.logService.error('MCP Management Service: failed to read manifest', location.toString(), e);
            }
        }
        return storedMcpServerInfo;
    }
    getLocation(name, version) {
        name = name.replace('/', '.');
        return this.uriIdentityService.extUri.joinPath(this.mcpLocation, version ? `${name}-${version}` : name);
    }
    installFromUri(uri, options) {
        throw new Error('Method not supported.');
    }
    canInstall() {
        throw new Error('Not supported');
    }
};
McpUserResourceManagementService = __decorate([
    __param(1, IMcpGalleryService),
    __param(2, IFileService),
    __param(3, IUriIdentityService),
    __param(4, ILogService),
    __param(5, IMcpResourceScannerService),
    __param(6, IEnvironmentService)
], McpUserResourceManagementService);
export { McpUserResourceManagementService };
let AbstractMcpManagementService = class AbstractMcpManagementService extends AbstractCommonMcpManagementService {
    constructor(allowedMcpServersService, logService) {
        super(logService);
        this.allowedMcpServersService = allowedMcpServersService;
    }
    canInstall(server) {
        const allowedToInstall = this.allowedMcpServersService.isAllowed(server);
        if (allowedToInstall !== true) {
            return new MarkdownString(localize('not allowed to install', "This mcp server cannot be installed because {0}", allowedToInstall.value));
        }
        return true;
    }
};
AbstractMcpManagementService = __decorate([
    __param(0, IAllowedMcpServersService),
    __param(1, ILogService)
], AbstractMcpManagementService);
export { AbstractMcpManagementService };
let McpManagementService = class McpManagementService extends AbstractMcpManagementService {
    constructor(allowedMcpServersService, logService, userDataProfilesService, instantiationService) {
        super(allowedMcpServersService, logService);
        this.userDataProfilesService = userDataProfilesService;
        this.instantiationService = instantiationService;
        this._onInstallMcpServer = this._register(new Emitter());
        this.onInstallMcpServer = this._onInstallMcpServer.event;
        this._onDidInstallMcpServers = this._register(new Emitter());
        this.onDidInstallMcpServers = this._onDidInstallMcpServers.event;
        this._onDidUpdateMcpServers = this._register(new Emitter());
        this.onDidUpdateMcpServers = this._onDidUpdateMcpServers.event;
        this._onUninstallMcpServer = this._register(new Emitter());
        this.onUninstallMcpServer = this._onUninstallMcpServer.event;
        this._onDidUninstallMcpServer = this._register(new Emitter());
        this.onDidUninstallMcpServer = this._onDidUninstallMcpServer.event;
        this.mcpResourceManagementServices = new ResourceMap();
    }
    getMcpResourceManagementService(mcpResource) {
        let mcpResourceManagementService = this.mcpResourceManagementServices.get(mcpResource);
        if (!mcpResourceManagementService) {
            const disposables = new DisposableStore();
            const service = disposables.add(this.createMcpResourceManagementService(mcpResource));
            disposables.add(service.onInstallMcpServer(e => this._onInstallMcpServer.fire(e)));
            disposables.add(service.onDidInstallMcpServers(e => this._onDidInstallMcpServers.fire(e)));
            disposables.add(service.onDidUpdateMcpServers(e => this._onDidUpdateMcpServers.fire(e)));
            disposables.add(service.onUninstallMcpServer(e => this._onUninstallMcpServer.fire(e)));
            disposables.add(service.onDidUninstallMcpServer(e => this._onDidUninstallMcpServer.fire(e)));
            this.mcpResourceManagementServices.set(mcpResource, mcpResourceManagementService = { service, dispose: () => disposables.dispose() });
        }
        return mcpResourceManagementService.service;
    }
    async getInstalled(mcpResource) {
        const mcpResourceUri = mcpResource || this.userDataProfilesService.defaultProfile.mcpResource;
        return this.getMcpResourceManagementService(mcpResourceUri).getInstalled();
    }
    async install(server, options) {
        const mcpResourceUri = options?.mcpResource || this.userDataProfilesService.defaultProfile.mcpResource;
        return this.getMcpResourceManagementService(mcpResourceUri).install(server, options);
    }
    async uninstall(server, options) {
        const mcpResourceUri = options?.mcpResource || this.userDataProfilesService.defaultProfile.mcpResource;
        return this.getMcpResourceManagementService(mcpResourceUri).uninstall(server, options);
    }
    async installFromGallery(server, options) {
        const mcpResourceUri = options?.mcpResource || this.userDataProfilesService.defaultProfile.mcpResource;
        return this.getMcpResourceManagementService(mcpResourceUri).installFromGallery(server, options);
    }
    async updateMetadata(local, gallery, mcpResource) {
        return this.getMcpResourceManagementService(mcpResource || this.userDataProfilesService.defaultProfile.mcpResource).updateMetadata(local, gallery);
    }
    dispose() {
        this.mcpResourceManagementServices.forEach(service => service.dispose());
        this.mcpResourceManagementServices.clear();
        super.dispose();
    }
    createMcpResourceManagementService(mcpResource) {
        return this.instantiationService.createInstance(McpUserResourceManagementService, mcpResource);
    }
};
McpManagementService = __decorate([
    __param(0, IAllowedMcpServersService),
    __param(1, ILogService),
    __param(2, IUserDataProfilesService),
    __param(3, IInstantiationService)
], McpManagementService);
export { McpManagementService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwTWFuYWdlbWVudFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vbWNwL2NvbW1vbi9tY3BNYW5hZ2VtZW50U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNqRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDMUQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDekUsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBbUIsY0FBYyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDdEYsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM3RixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDMUQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN6RCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDbEQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBRTNDLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUMzRCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUNwRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDdEQsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seUNB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