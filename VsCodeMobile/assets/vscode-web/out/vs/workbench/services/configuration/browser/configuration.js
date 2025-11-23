/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event, Emitter } from '../../../../base/common/event.js';
import * as errors from '../../../../base/common/errors.js';
import { Disposable, dispose, toDisposable, MutableDisposable, combinedDisposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { whenProviderRegistered } from '../../../../platform/files/common/files.js';
import { ConfigurationModel, ConfigurationModelParser, UserSettings } from '../../../../platform/configuration/common/configurationModels.js';
import { WorkspaceConfigurationModelParser, StandaloneConfigurationModelParser } from '../common/configurationModels.js';
import { TASKS_CONFIGURATION_KEY, FOLDER_SETTINGS_NAME, LAUNCH_CONFIGURATION_KEY, REMOTE_MACHINE_SCOPES, FOLDER_SCOPES, WORKSPACE_SCOPES, APPLY_ALL_PROFILES_SETTING, APPLICATION_SCOPES, MCP_CONFIGURATION_KEY } from '../common/configuration.js';
import { Extensions, OVERRIDE_PROPERTY_REGEX } from '../../../../platform/configuration/common/configurationRegistry.js';
import { equals } from '../../../../base/common/objects.js';
import { hash } from '../../../../base/common/hash.js';
import { joinPath } from '../../../../base/common/resources.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { isEmptyObject, isObject } from '../../../../base/common/types.js';
import { DefaultConfiguration as BaseDefaultConfiguration } from '../../../../platform/configuration/common/configurations.js';
export class DefaultConfiguration extends BaseDefaultConfiguration {
    static { this.DEFAULT_OVERRIDES_CACHE_EXISTS_KEY = 'DefaultOverridesCacheExists'; }
    constructor(configurationCache, environmentService, logService) {
        super(logService);
        this.configurationCache = configurationCache;
        this.configurationRegistry = Registry.as(Extensions.Configuration);
        this.cachedConfigurationDefaultsOverrides = {};
        this.cacheKey = { type: 'defaults', key: 'configurationDefaultsOverrides' };
        if (environmentService.options?.configurationDefaults) {
            this.configurationRegistry.registerDefaultConfigurations([{ overrides: environmentService.options.configurationDefaults }]);
        }
    }
    getConfigurationDefaultOverrides() {
        return this.cachedConfigurationDefaultsOverrides;
    }
    async initialize() {
        await this.initializeCachedConfigurationDefaultsOverrides();
        return super.initialize();
    }
    reload() {
        this.cachedConfigurationDefaultsOverrides = {};
        this.updateCachedConfigurationDefaultsOverrides();
        return super.reload();
    }
    hasCachedConfigurationDefaultsOverrides() {
        return !isEmptyObject(this.cachedConfigurationDefaultsOverrides);
    }
    initializeCachedConfigurationDefaultsOverrides() {
        if (!this.initiaizeCachedConfigurationDefaultsOverridesPromise) {
            this.initiaizeCachedConfigurationDefaultsOverridesPromise = (async () => {
                try {
                    // Read only when the cache exists
                    if (localStorage.getItem(DefaultConfiguration.DEFAULT_OVERRIDES_CACHE_EXISTS_KEY)) {
                        const content = await this.configurationCache.read(this.cacheKey);
                        if (content) {
                            this.cachedConfigurationDefaultsOverrides = JSON.parse(content);
                        }
                    }
                }
                catch (error) { /* ignore */ }
                this.cachedConfigurationDefaultsOverrides = isObject(this.cachedConfigurationDefaultsOverrides) ? this.cachedConfigurationDefaultsOverrides : {};
            })();
        }
        return this.initiaizeCachedConfigurationDefaultsOverridesPromise;
    }
    onDidUpdateConfiguration(properties, defaultsOverrides) {
        super.onDidUpdateConfiguration(properties, defaultsOverrides);
        if (defaultsOverrides) {
            this.updateCachedConfigurationDefaultsOverrides();
        }
    }
    async updateCachedConfigurationDefaultsOverrides() {
        const cachedConfigurationDefaultsOverrides = {};
        const configurationDefaultsOverrides = this.configurationRegistry.getConfigurationDefaultsOverrides();
        for (const [key, value] of configurationDefaultsOverrides) {
            if (!OVERRIDE_PROPERTY_REGEX.test(key) && value.value !== undefined) {
                cachedConfigurationDefaultsOverrides[key] = value.value;
            }
        }
        try {
            if (Object.keys(cachedConfigurationDefaultsOverrides).length) {
                localStorage.setItem(DefaultConfiguration.DEFAULT_OVERRIDES_CACHE_EXISTS_KEY, 'yes');
                await this.configurationCache.write(this.cacheKey, JSON.stringify(cachedConfigurationDefaultsOverrides));
            }
            else {
                localStorage.removeItem(DefaultConfiguration.DEFAULT_OVERRIDES_CACHE_EXISTS_KEY);
                await this.configurationCache.remove(this.cacheKey);
            }
        }
        catch (error) { /* Ignore error */ }
    }
}
export class ApplicationConfiguration extends UserSettings {
    constructor(userDataProfilesService, fileService, uriIdentityService, logService) {
        super(userDataProfilesService.defaultProfile.settingsResource, { scopes: APPLICATION_SCOPES, skipUnregistered: true }, uriIdentityService.extUri, fileService, logService);
        this._onDidChangeConfiguration = this._register(new Emitter());
        this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
        this._register(this.onDidChange(() => this.reloadConfigurationScheduler.schedule()));
        this.reloadConfigurationScheduler = this._register(new RunOnceScheduler(() => this.loadConfiguration().then(configurationModel => this._onDidChangeConfiguration.fire(configurationModel)), 50));
    }
    async initialize() {
        return this.loadConfiguration();
    }
    async loadConfiguration() {
        const model = await super.loadConfiguration();
        const value = model.getValue(APPLY_ALL_PROFILES_SETTING);
        const allProfilesSettings = Array.isArray(value) ? value : [];
        return this.parseOptions.include || allProfilesSettings.length
            ? this.reparse({ ...this.parseOptions, include: allProfilesSettings })
            : model;
    }
}
export class UserConfiguration extends Disposable {
    get hasTasksLoaded() { return this.userConfiguration.value instanceof FileServiceBasedConfiguration; }
    constructor(settingsResource, tasksResource, mcpResource, configurationParseOptions, fileService, uriIdentityService, logService) {
        super();
        this.settingsResource = settingsResource;
        this.tasksResource = tasksResource;
        this.mcpResource = mcpResource;
        this.configurationParseOptions = configurationParseOptions;
        this.fileService = fileService;
        this.uriIdentityService = uriIdentityService;
        this.logService = logService;
        this._onDidChangeConfiguration = this._register(new Emitter());
        this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
        this.userConfiguration = this._register(new MutableDisposable());
        this.userConfigurationChangeDisposable = this._register(new MutableDisposable());
        this.userConfiguration.value = new UserSettings(settingsResource, this.configurationParseOptions, uriIdentityService.extUri, this.fileService, logService);
        this.userConfigurationChangeDisposable.value = this.userConfiguration.value.onDidChange(() => this.reloadConfigurationScheduler.schedule());
        this.reloadConfigurationScheduler = this._register(new RunOnceScheduler(() => this.userConfiguration.value.loadConfiguration().then(configurationModel => this._onDidChangeConfiguration.fire(configurationModel)), 50));
    }
    async reset(settingsResource, tasksResource, mcpResource, configurationParseOptions) {
        this.settingsResource = settingsResource;
        this.tasksResource = tasksResource;
        this.mcpResource = mcpResource;
        this.configurationParseOptions = configurationParseOptions;
        return this.doReset();
    }
    async doReset(settingsConfiguration) {
        const folder = this.uriIdentityService.extUri.dirname(this.settingsResource);
        const standAloneConfigurationResources = [];
        if (this.tasksResource) {
            standAloneConfigurationResources.push([TASKS_CONFIGURATION_KEY, this.tasksResource]);
        }
        if (this.mcpResource) {
            standAloneConfigurationResources.push([MCP_CONFIGURATION_KEY, this.mcpResource]);
        }
        const fileServiceBasedConfiguration = new FileServiceBasedConfiguration(folder.toString(), this.settingsResource, standAloneConfigurationResources, this.configurationParseOptions, this.fileService, this.uriIdentityService, this.logService);
        const configurationModel = await fileServiceBasedConfiguration.loadConfiguration(settingsConfiguration);
        this.userConfiguration.value = fileServiceBasedConfiguration;
        // Check for value because userConfiguration might have been disposed.
        if (this.userConfigurationChangeDisposable.value) {
            this.userConfigurationChangeDisposable.value = this.userConfiguration.value.onDidChange(() => this.reloadConfigurationScheduler.schedule());
        }
        return configurationModel;
    }
    async initialize() {
        return this.userConfiguration.value.loadConfiguration();
    }
    async reload(settingsConfiguration) {
        if (this.hasTasksLoaded) {
            return this.userConfiguration.value.loadConfiguration();
        }
        return this.doReset(settingsConfiguration);
    }
    reparse(parseOptions) {
        this.configurationParseOptions = { ...this.configurationParseOptions, ...parseOptions };
        return this.userConfiguration.value.reparse(this.configurationParseOptions);
    }
    getRestrictedSettings() {
        return this.userConfiguration.value.getRestrictedSettings();
    }
}
class FileServiceBasedConfiguration extends Disposable {
    constructor(name, settingsResource, standAloneConfigurationResources, configurationParseOptions, fileService, uriIdentityService, logService) {
        super();
        this.settingsResource = settingsResource;
        this.standAloneConfigurationResources = standAloneConfigurationResources;
        this.fileService = fileService;
        this.uriIdentityService = uriIdentityService;
        this.logService = logService;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this.allResources = [this.settingsResource, ...this.standAloneConfigurationResources.map(([, resource]) => resource)];
        this._register(combinedDisposable(...this.allResources.map(resource => combinedDisposable(this.fileService.watch(uriIdentityService.extUri.dirname(resource)), 
        // Also listen to the resource incase the resource is a symlink - https://github.com/microsoft/vscode/issues/118134
        this.fileService.watch(resource)))));
        this._folderSettingsModelParser = new ConfigurationModelParser(name, logService);
        this._folderSettingsParseOptions = configurationParseOptions;
        this._standAloneConfigurations = [];
        this._cache = ConfigurationModel.createEmptyModel(this.logService);
        this._register(Event.debounce(Event.any(Event.filter(this.fileService.onDidFilesChange, e => this.handleFileChangesEvent(e)), Event.filter(this.fileService.onDidRunOperation, e => this.handleFileOperationEvent(e))), () => undefined, 100)(() => this._onDidChange.fire()));
    }
    async resolveContents(donotResolveSettings) {
        const resolveContents = async (resources) => {
            return Promise.all(resources.map(async (resource) => {
                try {
                    const content = await this.fileService.readFile(resource, { atomic: true });
                    return content.value.toString();
                }
                catch (error) {
                    this.logService.trace(`Error while resolving configuration file '${resource.toString()}': ${errors.getErrorMessage(error)}`);
                    if (error.fileOperationResult !== 1 /* FileOperationResult.FILE_NOT_FOUND */
                        && error.fileOperationResult !== 9 /* FileOperationResult.FILE_NOT_DIRECTORY */) {
                        this.logService.error(error);
                    }
                }
                return '{}';
            }));
        };
        const [[settingsContent], standAloneConfigurationContents] = await Promise.all([
            donotResolveSettings ? Promise.resolve([undefined]) : resolveContents([this.settingsResource]),
            resolveContents(this.standAloneConfigurationResources.map(([, resource]) => resource)),
        ]);
        return [settingsContent, standAloneConfigurationContents.map((content, index) => ([this.standAloneConfigurationResources[index][0], content]))];
    }
    async loadConfiguration(settingsConfiguration) {
        const [settingsContent, standAloneConfigurationContents] = await this.resolveContents(!!settingsConfiguration);
        // reset
        this._standAloneConfigurations = [];
        this._folderSettingsModelParser.parse('', this._folderSettingsParseOptions);
        // parse
        if (settingsContent !== undefined) {
            this._folderSettingsModelParser.parse(settingsContent, this._folderSettingsParseOptions);
        }
        for (let index = 0; index < standAloneConfigurationContents.length; index++) {
            const contents = standAloneConfigurationContents[index][1];
            if (contents !== undefined) {
                const standAloneConfigurationModelParser = new StandaloneConfigurationModelParser(this.standAloneConfigurationResources[index][1].toString(), this.standAloneConfigurationResources[index][0], this.logService);
                standAloneConfigurationModelParser.parse(contents);
                this._standAloneConfigurations.push(standAloneConfigurationModelParser.configurationModel);
            }
        }
        // Consolidate (support *.json files in the workspace settings folder)
        this.consolidate(settingsConfiguration);
        return this._cache;
    }
    getRestrictedSettings() {
        return this._folderSettingsModelParser.restrictedConfigurations;
    }
    reparse(configurationParseOptions) {
        const oldContents = this._folderSettingsModelParser.configurationModel.contents;
        this._folderSettingsParseOptions = configurationParseOptions;
        this._folderSettingsModelParser.reparse(this._folderSettingsParseOptions);
        if (!equals(oldContents, this._folderSettingsModelParser.configurationModel.contents)) {
            this.consolidate();
        }
        return this._cache;
    }
    consolidate(settingsConfiguration) {
        this._cache = (settingsConfiguration ?? this._folderSettingsModelParser.configurationModel).merge(...this._standAloneConfigurations);
    }
    handleFileChangesEvent(event) {
        // One of the resources has changed
        if (this.allResources.some(resource => event.contains(resource))) {
            return true;
        }
        // One of the resource's parent got deleted
        if (this.allResources.some(resource => event.contains(this.uriIdentityService.extUri.dirname(resource), 2 /* FileChangeType.DELETED */))) {
            return true;
        }
        return false;
    }
    handleFileOperationEvent(event) {
        // One of the resources has changed
        if ((event.isOperation(0 /* FileOperation.CREATE */) || event.isOperation(3 /* FileOperation.COPY */) || event.isOperation(1 /* FileOperation.DELETE */) || event.isOperation(4 /* FileOperation.WRITE */))
            && this.allResources.some(resource => this.uriIdentityService.extUri.isEqual(event.resource, resource))) {
            return true;
        }
        // One of the resource's parent got deleted
        if (event.isOperation(1 /* FileOperation.DELETE */) && this.allResources.some(resource => this.uriIdentityService.extUri.isEqual(event.resource, this.uriIdentityService.extUri.dirname(resource)))) {
            return true;
        }
        return false;
    }
}
export class RemoteUserConfiguration extends Disposable {
    constructor(remoteAuthority, configurationCache, fileService, uriIdentityService, remoteAgentService, logService) {
        super();
        this._userConfigurationInitializationPromise = null;
        this._onDidChangeConfiguration = this._register(new Emitter());
        this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
        this._onDidInitialize = this._register(new Emitter());
        this.onDidInitialize = this._onDidInitialize.event;
        this._fileService = fileService;
        this._userConfiguration = this._cachedConfiguration = new CachedRemoteUserConfiguration(remoteAuthority, configurationCache, { scopes: REMOTE_MACHINE_SCOPES }, logService);
        remoteAgentService.getEnvironment().then(async (environment) => {
            if (environment) {
                const userConfiguration = this._register(new FileServiceBasedRemoteUserConfiguration(environment.settingsPath, { scopes: REMOTE_MACHINE_SCOPES }, this._fileService, uriIdentityService, logService));
                this._register(userConfiguration.onDidChangeConfiguration(configurationModel => this.onDidUserConfigurationChange(configurationModel)));
                this._userConfigurationInitializationPromise = userConfiguration.initialize();
                const configurationModel = await this._userConfigurationInitializationPromise;
                this._userConfiguration.dispose();
                this._userConfiguration = userConfiguration;
                this.onDidUserConfigurationChange(configurationModel);
                this._onDidInitialize.fire(configurationModel);
            }
        });
    }
    async initialize() {
        if (this._userConfiguration instanceof FileServiceBasedRemoteUserConfiguration) {
            return this._userConfiguration.initialize();
        }
        // Initialize cached configuration
        let configurationModel = await this._userConfiguration.initialize();
        if (this._userConfigurationInitializationPromise) {
            // Use user configuration
            configurationModel = await this._userConfigurationInitializationPromise;
            this._userConfigurationInitializationPromise = null;
        }
        return configurationModel;
    }
    reload() {
        return this._userConfiguration.reload();
    }
    reparse() {
        return this._userConfiguration.reparse({ scopes: REMOTE_MACHINE_SCOPES });
    }
    getRestrictedSettings() {
        return this._userConfiguration.getRestrictedSettings();
    }
    onDidUserConfigurationChange(configurationModel) {
        this.updateCache();
        this._onDidChangeConfiguration.fire(configurationModel);
    }
    async updateCache() {
        if (this._userConfiguration instanceof FileServiceBasedRemoteUserConfiguration) {
            let content;
            try {
                content = await this._userConfiguration.resolveContent();
            }
            catch (error) {
                if (error.fileOperationResult !== 1 /* FileOperationResult.FILE_NOT_FOUND */) {
                    return;
                }
            }
            await this._cachedConfiguration.updateConfiguration(content);
        }
    }
}
class FileServiceBasedRemoteUserConfiguration extends Disposable {
    constructor(configurationResource, configurationParseOptions, fileService, uriIdentityService, logService) {
        super();
        this.configurationResource = configurationResource;
        this.fileService = fileService;
        this.uriIdentityService = uriIdentityService;
        this.logService = logService;
        this._onDidChangeConfiguration = this._register(new Emitter());
        this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
        this.fileWatcherDisposable = this._register(new MutableDisposable());
        this.directoryWatcherDisposable = this._register(new MutableDisposable());
        this.parser = new ConfigurationModelParser(this.configurationResource.toString(), logService);
        this.parseOptions = configurationParseOptions;
        this._register(fileService.onDidFilesChange(e => this.handleFileChangesEvent(e)));
        this._register(fileService.onDidRunOperation(e => this.handleFileOperationEvent(e)));
        this.reloadConfigurationScheduler = this._register(new RunOnceScheduler(() => this.reload().then(configurationModel => this._onDidChangeConfiguration.fire(configurationModel)), 50));
        this._register(toDisposable(() => {
            this.stopWatchingResource();
            this.stopWatchingDirectory();
        }));
    }
    watchResource() {
        this.fileWatcherDisposable.value = this.fileService.watch(this.configurationResource);
    }
    stopWatchingResource() {
        this.fileWatcherDisposable.value = undefined;
    }
    watchDirectory() {
        const directory = this.uriIdentityService.extUri.dirname(this.configurationResource);
        this.directoryWatcherDisposable.value = this.fileService.watch(directory);
    }
    stopWatchingDirectory() {
        this.directoryWatcherDisposable.value = undefined;
    }
    async initialize() {
        const exists = await this.fileService.exists(this.configurationResource);
        this.onResourceExists(exists);
        return this.reload();
    }
    async resolveContent() {
        const content = await this.fileService.readFile(this.configurationResource, { atomic: true });
        return content.value.toString();
    }
    async reload() {
        try {
            const content = await this.resolveContent();
            this.parser.parse(content, this.parseOptions);
            return this.parser.configurationModel;
        }
        catch (e) {
            return ConfigurationModel.createEmptyModel(this.logService);
        }
    }
    reparse(configurationParseOptions) {
        this.parseOptions = configurationParseOptions;
        this.parser.reparse(this.parseOptions);
        return this.parser.configurationModel;
    }
    getRestrictedSettings() {
        return this.parser.restrictedConfigurations;
    }
    handleFileChangesEvent(event) {
        // Find changes that affect the resource
        let affectedByChanges = false;
        if (event.contains(this.configurationResource, 1 /* FileChangeType.ADDED */)) {
            affectedByChanges = true;
            this.onResourceExists(true);
        }
        else if (event.contains(this.configurationResource, 2 /* FileChangeType.DELETED */)) {
            affectedByChanges = true;
            this.onResourceExists(false);
        }
        else if (event.contains(this.configurationResource, 0 /* FileChangeType.UPDATED */)) {
            affectedByChanges = true;
        }
        if (affectedByChanges) {
            this.reloadConfigurationScheduler.schedule();
        }
    }
    handleFileOperationEvent(event) {
        if ((event.isOperation(0 /* FileOperation.CREATE */) || event.isOperation(3 /* FileOperation.COPY */) || event.isOperation(1 /* FileOperation.DELETE */) || event.isOperation(4 /* FileOperation.WRITE */))
            && this.uriIdentityService.extUri.isEqual(event.resource, this.configurationResource)) {
            this.reloadConfigurationScheduler.schedule();
        }
    }
    onResourceExists(exists) {
        if (exists) {
            this.stopWatchingDirectory();
            this.watchResource();
        }
        else {
            this.stopWatchingResource();
            this.watchDirectory();
        }
    }
}
class CachedRemoteUserConfiguration extends Disposable {
    constructor(remoteAuthority, configurationCache, configurationParseOptions, logService) {
        super();
        this.configurationCache = configurationCache;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this.key = { type: 'user', key: remoteAuthority };
        this.parser = new ConfigurationModelParser('CachedRemoteUserConfiguration', logService);
        this.parseOptions = configurationParseOptions;
        this.configurationModel = ConfigurationModel.createEmptyModel(logService);
    }
    getConfigurationModel() {
        return this.configurationModel;
    }
    initialize() {
        return this.reload();
    }
    reparse(configurationParseOptions) {
        this.parseOptions = configurationParseOptions;
        this.parser.reparse(this.parseOptions);
        this.configurationModel = this.parser.configurationModel;
        return this.configurationModel;
    }
    getRestrictedSettings() {
        return this.parser.restrictedConfigurations;
    }
    async reload() {
        try {
            const content = await this.configurationCache.read(this.key);
            const parsed = JSON.parse(content);
            if (parsed.content) {
                this.parser.parse(parsed.content, this.parseOptions);
                this.configurationModel = this.parser.configurationModel;
            }
        }
        catch (e) { /* Ignore error */ }
        return this.configurationModel;
    }
    async updateConfiguration(content) {
        if (content) {
            return this.configurationCache.write(this.key, JSON.stringify({ content }));
        }
        else {
            return this.configurationCache.remove(this.key);
        }
    }
}
export class WorkspaceConfiguration extends Disposable {
    get initialized() { return this._initialized; }
    constructor(configurationCache, fileService, uriIdentityService, logService) {
        super();
        this.configurationCache = configurationCache;
        this.fileService = fileService;
        this.uriIdentityService = uriIdentityService;
        this.logService = logService;
        this._workspaceConfigurationDisposables = this._register(new DisposableStore());
        this._workspaceIdentifier = null;
        this._isWorkspaceTrusted = false;
        this._onDidUpdateConfiguration = this._register(new Emitter());
        this.onDidUpdateConfiguration = this._onDidUpdateConfiguration.event;
        this._initialized = false;
        this.fileService = fileService;
        this._workspaceConfiguration = this._cachedConfiguration = new CachedWorkspaceConfiguration(configurationCache, logService);
    }
    async initialize(workspaceIdentifier, workspaceTrusted) {
        this._workspaceIdentifier = workspaceIdentifier;
        this._isWorkspaceTrusted = workspaceTrusted;
        if (!this._initialized) {
            if (this.configurationCache.needsCaching(this._workspaceIdentifier.configPath)) {
                this._workspaceConfiguration = this._cachedConfiguration;
                this.waitAndInitialize(this._workspaceIdentifier);
            }
            else {
                this.doInitialize(new FileServiceBasedWorkspaceConfiguration(this.fileService, this.uriIdentityService, this.logService));
            }
        }
        await this.reload();
    }
    async reload() {
        if (this._workspaceIdentifier) {
            await this._workspaceConfiguration.load(this._workspaceIdentifier, { scopes: WORKSPACE_SCOPES, skipRestricted: this.isUntrusted() });
        }
    }
    getFolders() {
        return this._workspaceConfiguration.getFolders();
    }
    setFolders(folders, jsonEditingService) {
        if (this._workspaceIdentifier) {
            return jsonEditingService.write(this._workspaceIdentifier.configPath, [{ path: ['folders'], value: folders }], true)
                .then(() => this.reload());
        }
        return Promise.resolve();
    }
    isTransient() {
        return this._workspaceConfiguration.isTransient();
    }
    getConfiguration() {
        return this._workspaceConfiguration.getWorkspaceSettings();
    }
    updateWorkspaceTrust(trusted) {
        this._isWorkspaceTrusted = trusted;
        return this.reparseWorkspaceSettings();
    }
    reparseWorkspaceSettings() {
        this._workspaceConfiguration.reparseWorkspaceSettings({ scopes: WORKSPACE_SCOPES, skipRestricted: this.isUntrusted() });
        return this.getConfiguration();
    }
    getRestrictedSettings() {
        return this._workspaceConfiguration.getRestrictedSettings();
    }
    async waitAndInitialize(workspaceIdentifier) {
        await whenProviderRegistered(workspaceIdentifier.configPath, this.fileService);
        if (!(this._workspaceConfiguration instanceof FileServiceBasedWorkspaceConfiguration)) {
            const fileServiceBasedWorkspaceConfiguration = this._register(new FileServiceBasedWorkspaceConfiguration(this.fileService, this.uriIdentityService, this.logService));
            await fileServiceBasedWorkspaceConfiguration.load(workspaceIdentifier, { scopes: WORKSPACE_SCOPES, skipRestricted: this.isUntrusted() });
            this.doInitialize(fileServiceBasedWorkspaceConfiguration);
            this.onDidWorkspaceConfigurationChange(false, true);
        }
    }
    doInitialize(fileServiceBasedWorkspaceConfiguration) {
        this._workspaceConfigurationDisposables.clear();
        this._workspaceConfiguration = this._workspaceConfigurationDisposables.add(fileServiceBasedWorkspaceConfiguration);
        this._workspaceConfigurationDisposables.add(this._workspaceConfiguration.onDidChange(e => this.onDidWorkspaceConfigurationChange(true, false)));
        this._initialized = true;
    }
    isUntrusted() {
        return !this._isWorkspaceTrusted;
    }
    async onDidWorkspaceConfigurationChange(reload, fromCache) {
        if (reload) {
            await this.reload();
        }
        this.updateCache();
        this._onDidUpdateConfiguration.fire(fromCache);
    }
    async updateCache() {
        if (this._workspaceIdentifier && this.configurationCache.needsCaching(this._workspaceIdentifier.configPath) && this._workspaceConfiguration instanceof FileServiceBasedWorkspaceConfiguration) {
            const content = await this._workspaceConfiguration.resolveContent(this._workspaceIdentifier);
            await this._cachedConfiguration.updateWorkspace(this._workspaceIdentifier, content);
        }
    }
}
class FileServiceBasedWorkspaceConfiguration extends Disposable {
    constructor(fileService, uriIdentityService, logService) {
        super();
        this.fileService = fileService;
        this.logService = logService;
        this._workspaceIdentifier = null;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this.workspaceConfigurationModelParser = new WorkspaceConfigurationModelParser('', logService);
        this.workspaceSettings = ConfigurationModel.createEmptyModel(logService);
        this._register(Event.any(Event.filter(this.fileService.onDidFilesChange, e => !!this._workspaceIdentifier && e.contains(this._workspaceIdentifier.configPath)), Event.filter(this.fileService.onDidRunOperation, e => !!this._workspaceIdentifier && (e.isOperation(0 /* FileOperation.CREATE */) || e.isOperation(3 /* FileOperation.COPY */) || e.isOperation(1 /* FileOperation.DELETE */) || e.isOperation(4 /* FileOperation.WRITE */)) && uriIdentityService.extUri.isEqual(e.resource, this._workspaceIdentifier.configPath)))(() => this.reloadConfigurationScheduler.schedule()));
        this.reloadConfigurationScheduler = this._register(new RunOnceScheduler(() => this._onDidChange.fire(), 50));
        this.workspaceConfigWatcher = this._register(this.watchWorkspaceConfigurationFile());
    }
    get workspaceIdentifier() {
        return this._workspaceIdentifier;
    }
    async resolveContent(workspaceIdentifier) {
        const content = await this.fileService.readFile(workspaceIdentifier.configPath, { atomic: true });
        return content.value.toString();
    }
    async load(workspaceIdentifier, configurationParseOptions) {
        if (!this._workspaceIdentifier || this._workspaceIdentifier.id !== workspaceIdentifier.id) {
            this._workspaceIdentifier = workspaceIdentifier;
            this.workspaceConfigurationModelParser = new WorkspaceConfigurationModelParser(this._workspaceIdentifier.id, this.logService);
            dispose(this.workspaceConfigWatcher);
            this.workspaceConfigWatcher = this._register(this.watchWorkspaceConfigurationFile());
        }
        let contents = '';
        try {
            contents = await this.resolveContent(this._workspaceIdentifier);
        }
        catch (error) {
            const exists = await this.fileService.exists(this._workspaceIdentifier.configPath);
            if (exists) {
                this.logService.error(error);
            }
        }
        this.workspaceConfigurationModelParser.parse(contents, configurationParseOptions);
        this.consolidate();
    }
    getConfigurationModel() {
        return this.workspaceConfigurationModelParser.configurationModel;
    }
    getFolders() {
        return this.workspaceConfigurationModelParser.folders;
    }
    isTransient() {
        return this.workspaceConfigurationModelParser.transient;
    }
    getWorkspaceSettings() {
        return this.workspaceSettings;
    }
    reparseWorkspaceSettings(configurationParseOptions) {
        this.workspaceConfigurationModelParser.reparseWorkspaceSettings(configurationParseOptions);
        this.consolidate();
        return this.getWorkspaceSettings();
    }
    getRestrictedSettings() {
        return this.workspaceConfigurationModelParser.getRestrictedWorkspaceSettings();
    }
    consolidate() {
        this.workspaceSettings = this.workspaceConfigurationModelParser.settingsModel.merge(this.workspaceConfigurationModelParser.launchModel, this.workspaceConfigurationModelParser.tasksModel);
    }
    watchWorkspaceConfigurationFile() {
        return this._workspaceIdentifier ? this.fileService.watch(this._workspaceIdentifier.configPath) : Disposable.None;
    }
}
class CachedWorkspaceConfiguration {
    constructor(configurationCache, logService) {
        this.configurationCache = configurationCache;
        this.logService = logService;
        this.onDidChange = Event.None;
        this.workspaceConfigurationModelParser = new WorkspaceConfigurationModelParser('', logService);
        this.workspaceSettings = ConfigurationModel.createEmptyModel(logService);
    }
    async load(workspaceIdentifier, configurationParseOptions) {
        try {
            const key = this.getKey(workspaceIdentifier);
            const contents = await this.configurationCache.read(key);
            const parsed = JSON.parse(contents);
            if (parsed.content) {
                this.workspaceConfigurationModelParser = new WorkspaceConfigurationModelParser(key.key, this.logService);
                this.workspaceConfigurationModelParser.parse(parsed.content, configurationParseOptions);
                this.consolidate();
            }
        }
        catch (e) {
        }
    }
    get workspaceIdentifier() {
        return null;
    }
    getConfigurationModel() {
        return this.workspaceConfigurationModelParser.configurationModel;
    }
    getFolders() {
        return this.workspaceConfigurationModelParser.folders;
    }
    isTransient() {
        return this.workspaceConfigurationModelParser.transient;
    }
    getWorkspaceSettings() {
        return this.workspaceSettings;
    }
    reparseWorkspaceSettings(configurationParseOptions) {
        this.workspaceConfigurationModelParser.reparseWorkspaceSettings(configurationParseOptions);
        this.consolidate();
        return this.getWorkspaceSettings();
    }
    getRestrictedSettings() {
        return this.workspaceConfigurationModelParser.getRestrictedWorkspaceSettings();
    }
    consolidate() {
        this.workspaceSettings = this.workspaceConfigurationModelParser.settingsModel.merge(this.workspaceConfigurationModelParser.launchModel, this.workspaceConfigurationModelParser.tasksModel);
    }
    async updateWorkspace(workspaceIdentifier, content) {
        try {
            const key = this.getKey(workspaceIdentifier);
            if (content) {
                await this.configurationCache.write(key, JSON.stringify({ content }));
            }
            else {
                await this.configurationCache.remove(key);
            }
        }
        catch (error) {
        }
    }
    getKey(workspaceIdentifier) {
        return {
            type: 'workspaces',
            key: workspaceIdentifier.id
        };
    }
}
class CachedFolderConfiguration {
    constructor(folder, configFolderRelativePath, configurationParseOptions, configurationCache, logService) {
        this.configurationCache = configurationCache;
        this.logService = logService;
        this.onDidChange = Event.None;
        this.key = { type: 'folder', key: hash(joinPath(folder, configFolderRelativePath).toString()).toString(16) };
        this._folderSettingsModelParser = new ConfigurationModelParser('CachedFolderConfiguration', logService);
        this._folderSettingsParseOptions = configurationParseOptions;
        this._standAloneConfigurations = [];
        this.configurationModel = ConfigurationModel.createEmptyModel(logService);
    }
    async loadConfiguration() {
        try {
            const contents = await this.configurationCache.read(this.key);
            const { content: configurationContents } = JSON.parse(contents.toString());
            if (configurationContents) {
                for (const key of Object.keys(configurationContents)) {
                    if (key === FOLDER_SETTINGS_NAME) {
                        this._folderSettingsModelParser.parse(configurationContents[key], this._folderSettingsParseOptions);
                    }
                    else {
                        const standAloneConfigurationModelParser = new StandaloneConfigurationModelParser(key, key, this.logService);
                        standAloneConfigurationModelParser.parse(configurationContents[key]);
                        this._standAloneConfigurations.push(standAloneConfigurationModelParser.configurationModel);
                    }
                }
            }
            this.consolidate();
        }
        catch (e) {
        }
        return this.configurationModel;
    }
    async updateConfiguration(settingsContent, standAloneConfigurationContents) {
        const content = {};
        if (settingsContent) {
            content[FOLDER_SETTINGS_NAME] = settingsContent;
        }
        standAloneConfigurationContents.forEach(([key, contents]) => {
            if (contents) {
                content[key] = contents;
            }
        });
        if (Object.keys(content).length) {
            await this.configurationCache.write(this.key, JSON.stringify({ content }));
        }
        else {
            await this.configurationCache.remove(this.key);
        }
    }
    getRestrictedSettings() {
        return this._folderSettingsModelParser.restrictedConfigurations;
    }
    reparse(configurationParseOptions) {
        this._folderSettingsParseOptions = configurationParseOptions;
        this._folderSettingsModelParser.reparse(this._folderSettingsParseOptions);
        this.consolidate();
        return this.configurationModel;
    }
    consolidate() {
        this.configurationModel = this._folderSettingsModelParser.configurationModel.merge(...this._standAloneConfigurations);
    }
    getUnsupportedKeys() {
        return [];
    }
}
export class FolderConfiguration extends Disposable {
    constructor(useCache, workspaceFolder, configFolderRelativePath, workbenchState, workspaceTrusted, fileService, uriIdentityService, logService, configurationCache) {
        super();
        this.workspaceFolder = workspaceFolder;
        this.workbenchState = workbenchState;
        this.workspaceTrusted = workspaceTrusted;
        this.configurationCache = configurationCache;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this.scopes = 3 /* WorkbenchState.WORKSPACE */ === this.workbenchState ? FOLDER_SCOPES : WORKSPACE_SCOPES;
        this.configurationFolder = uriIdentityService.extUri.joinPath(workspaceFolder.uri, configFolderRelativePath);
        this.cachedFolderConfiguration = new CachedFolderConfiguration(workspaceFolder.uri, configFolderRelativePath, { scopes: this.scopes, skipRestricted: this.isUntrusted() }, configurationCache, logService);
        if (useCache && this.configurationCache.needsCaching(workspaceFolder.uri)) {
            this.folderConfiguration = this.cachedFolderConfiguration;
            whenProviderRegistered(workspaceFolder.uri, fileService)
                .then(() => {
                this.folderConfiguration = this._register(this.createFileServiceBasedConfiguration(fileService, uriIdentityService, logService));
                this._register(this.folderConfiguration.onDidChange(e => this.onDidFolderConfigurationChange()));
                this.onDidFolderConfigurationChange();
            });
        }
        else {
            this.folderConfiguration = this._register(this.createFileServiceBasedConfiguration(fileService, uriIdentityService, logService));
            this._register(this.folderConfiguration.onDidChange(e => this.onDidFolderConfigurationChange()));
        }
    }
    loadConfiguration() {
        return this.folderConfiguration.loadConfiguration();
    }
    updateWorkspaceTrust(trusted) {
        this.workspaceTrusted = trusted;
        return this.reparse();
    }
    reparse() {
        const configurationModel = this.folderConfiguration.reparse({ scopes: this.scopes, skipRestricted: this.isUntrusted() });
        this.updateCache();
        return configurationModel;
    }
    getRestrictedSettings() {
        return this.folderConfiguration.getRestrictedSettings();
    }
    isUntrusted() {
        return !this.workspaceTrusted;
    }
    onDidFolderConfigurationChange() {
        this.updateCache();
        this._onDidChange.fire();
    }
    createFileServiceBasedConfiguration(fileService, uriIdentityService, logService) {
        const settingsResource = uriIdentityService.extUri.joinPath(this.configurationFolder, `${FOLDER_SETTINGS_NAME}.json`);
        const standAloneConfigurationResources = [TASKS_CONFIGURATION_KEY, LAUNCH_CONFIGURATION_KEY, MCP_CONFIGURATION_KEY].map(name => ([name, uriIdentityService.extUri.joinPath(this.configurationFolder, `${name}.json`)]));
        return new FileServiceBasedConfiguration(this.configurationFolder.toString(), settingsResource, standAloneConfigurationResources, { scopes: this.scopes, skipRestricted: this.isUntrusted() }, fileService, uriIdentityService, logService);
    }
    async updateCache() {
        if (this.configurationCache.needsCaching(this.configurationFolder) && this.folderConfiguration instanceof FileServiceBasedConfiguration) {
            const [settingsContent, standAloneConfigurationContents] = await this.folderConfiguration.resolveContents();
            this.cachedFolderConfiguration.updateConfiguration(settingsContent, standAloneConfigurationContents);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlndXJhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvY29uZmlndXJhdGlvbi9icm93c2VyL2NvbmZpZ3VyYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEtBQUssTUFBTSxNQUFNLG1DQUFtQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxVQUFVLEVBQWUsT0FBTyxFQUFFLFlBQVksRUFBRSxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM5SixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNwRSxPQUFPLEVBQWtELHNCQUFzQixFQUE4RSxNQUFNLDRDQUE0QyxDQUFDO0FBQ2hOLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSx3QkFBd0IsRUFBNkIsWUFBWSxFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDekssT0FBTyxFQUFFLGlDQUFpQyxFQUFFLGtDQUFrQyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekgsT0FBTyxFQUFFLHVCQUF1QixFQUFFLG9CQUFvQixFQUFFLHdCQUF3QixFQUF5QyxxQkFBcUIsRUFBRSxhQUFhLEVBQUUsZ0JBQWdCLEVBQUUsMEJBQTBCLEVBQUUsa0JBQWtCLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUczUixPQUFPLEVBQXNCLFVBQVUsRUFBMEIsdUJBQXVCLEVBQUUsTUFBTSxvRUFBb0UsQ0FBQztBQUNySyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFFNUQsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBSXZELE9BQU8sRUFB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