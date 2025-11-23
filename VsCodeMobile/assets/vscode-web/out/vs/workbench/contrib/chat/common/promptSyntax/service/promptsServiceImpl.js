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
import { CancellationError } from '../../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { ResourceMap, ResourceSet } from '../../../../../../base/common/map.js';
import { dirname, isEqual } from '../../../../../../base/common/resources.js';
import { URI } from '../../../../../../base/common/uri.js';
import { OffsetRange } from '../../../../../../editor/common/core/ranges/offsetRange.js';
import { IModelService } from '../../../../../../editor/common/services/model.js';
import { localize } from '../../../../../../nls.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../../../platform/label/common/label.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';
import { IFilesConfigurationService } from '../../../../../services/filesConfiguration/common/filesConfigurationService.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { IUserDataProfileService } from '../../../../../services/userDataProfile/common/userDataProfile.js';
import { PromptsConfig } from '../config/config.js';
import { getCleanPromptName } from '../config/promptFileLocations.js';
import { PROMPT_LANGUAGE_ID, PromptsType, getPromptsTypeForLanguageId } from '../promptTypes.js';
import { PromptFilesLocator } from '../utils/promptFilesLocator.js';
import { PromptFileParser, PromptHeaderAttributes } from '../promptFileParser.js';
import { PromptsStorage } from './promptsService.js';
import { Delayer } from '../../../../../../base/common/async.js';
import { Schemas } from '../../../../../../base/common/network.js';
/**
 * Provides prompt services.
 */
let PromptsService = class PromptsService extends Disposable {
    constructor(logger, labelService, modelService, instantiationService, userDataService, configurationService, fileService, filesConfigService, storageService) {
        super();
        this.logger = logger;
        this.labelService = labelService;
        this.modelService = modelService;
        this.instantiationService = instantiationService;
        this.userDataService = userDataService;
        this.configurationService = configurationService;
        this.fileService = fileService;
        this.filesConfigService = filesConfigService;
        this.storageService = storageService;
        /**
         * Cache for parsed prompt files keyed by URI.
         * The number in the returned tuple is textModel.getVersionId(), which is an internal VS Code counter that increments every time the text model's content changes.
         */
        this.cachedParsedPromptFromModels = new ResourceMap();
        /**
         * Cached file locations commands. Caching only happens if the corresponding `fileLocatorEvents` event is used.
         */
        this.cachedFileLocations = {};
        /**
         * Lazily created events that notify listeners when the file locations for a given prompt type change.
         * An event is created on demand for each prompt type and can be used by consumers to react to updates
         * in the set of prompt files (e.g., when prompt files are added, removed, or modified).
         */
        this.fileLocatorEvents = {};
        /**
         * Contributed files from extensions keyed by prompt type then name.
         */
        this.contributedFiles = {
            [PromptsType.prompt]: new ResourceMap(),
            [PromptsType.instructions]: new ResourceMap(),
            [PromptsType.agent]: new ResourceMap(),
        };
        // --- Enabled Prompt Files -----------------------------------------------------------
        this.disabledPromptsStorageKeyPrefix = 'chat.disabledPromptFiles.';
        this.fileLocator = this.instantiationService.createInstance(PromptFilesLocator);
        this._register(this.modelService.onModelRemoved((model) => {
            this.cachedParsedPromptFromModels.delete(model.uri);
        }));
        const modelChangeEvent = this._register(new ModelChangeTracker(this.modelService)).onDidPromptChange;
        this.cachedCustomAgents = this._register(new CachedPromise((token) => this.computeCustomAgents(token), () => Event.any(this.getFileLocatorEvent(PromptsType.agent), Event.filter(modelChangeEvent, e => e.promptType === PromptsType.agent))));
        this.cachedSlashCommands = this._register(new CachedPromise((token) => this.computePromptSlashCommands(token), () => Event.any(this.getFileLocatorEvent(PromptsType.prompt), Event.filter(modelChangeEvent, e => e.promptType === PromptsType.prompt))));
    }
    getFileLocatorEvent(type) {
        let event = this.fileLocatorEvents[type];
        if (!event) {
            event = this.fileLocatorEvents[type] = this._register(this.fileLocator.createFilesUpdatedEvent(type)).event;
            this._register(event(() => {
                this.cachedFileLocations[type] = undefined;
            }));
        }
        return event;
    }
    getParsedPromptFile(textModel) {
        const cached = this.cachedParsedPromptFromModels.get(textModel.uri);
        if (cached && cached[0] === textModel.getVersionId()) {
            return cached[1];
        }
        const ast = new PromptFileParser().parse(textModel.uri, textModel.getValue());
        if (!cached || cached[0] < textModel.getVersionId()) {
            this.cachedParsedPromptFromModels.set(textModel.uri, [textModel.getVersionId(), ast]);
        }
        return ast;
    }
    async listPromptFiles(type, token) {
        let listPromise = this.cachedFileLocations[type];
        if (!listPromise) {
            listPromise = this.computeListPromptFiles(type, token);
            if (!this.fileLocatorEvents[type]) {
                return listPromise;
            }
            this.cachedFileLocations[type] = listPromise;
            return listPromise;
        }
        return listPromise;
    }
    async computeListPromptFiles(type, token) {
        const prompts = await Promise.all([
            this.fileLocator.listFiles(type, PromptsStorage.user, token).then(uris => uris.map(uri => ({ uri, storage: PromptsStorage.user, type }))),
            this.fileLocator.listFiles(type, PromptsStorage.local, token).then(uris => uris.map(uri => ({ uri, storage: PromptsStorage.local, type }))),
            this.getExtensionContributions(type)
        ]);
        return [...prompts.flat()];
    }
    async listPromptFilesForStorage(type, storage, token) {
        switch (storage) {
            case PromptsStorage.extension:
                return this.getExtensionContributions(type);
            case PromptsStorage.local:
                return this.fileLocator.listFiles(type, PromptsStorage.local, token).then(uris => uris.map(uri => ({ uri, storage: PromptsStorage.local, type })));
            case PromptsStorage.user:
                return this.fileLocator.listFiles(type, PromptsStorage.user, token).then(uris => uris.map(uri => ({ uri, storage: PromptsStorage.user, type })));
            default:
                throw new Error(`[listPromptFilesForStorage] Unsupported prompt storage type: ${storage}`);
        }
    }
    async getExtensionContributions(type) {
        return Promise.all(this.contributedFiles[type].values());
    }
    getSourceFolders(type) {
        const result = [];
        if (type === PromptsType.agent) {
            const folders = this.fileLocator.getAgentSourceFolder();
            for (const uri of folders) {
                result.push({ uri, storage: PromptsStorage.local, type });
            }
        }
        else {
            for (const uri of this.fileLocator.getConfigBasedSourceFolders(type)) {
                result.push({ uri, storage: PromptsStorage.local, type });
            }
        }
        const userHome = this.userDataService.currentProfile.promptsHome;
        result.push({ uri: userHome, storage: PromptsStorage.user, type });
        return result;
    }
    // slash prompt commands
    /**
     * Emitter for slash commands change events.
     */
    get onDidChangeSlashCommands() {
        return this.cachedSlashCommands.onDidChange;
    }
    async getPromptSlashCommands(token) {
        return this.cachedSlashCommands.get(token);
    }
    async computePromptSlashCommands(token) {
        const promptFiles = await this.listPromptFiles(PromptsType.prompt, token);
        const details = await Promise.all(promptFiles.map(async (promptPath) => {
            try {
                const parsedPromptFile = await this.parseNew(promptPath.uri, token);
                return this.asChatPromptSlashCommand(parsedPromptFile, promptPath);
            }
            catch (e) {
                this.logger.error(`[computePromptSlashCommands] Failed to parse prompt file for slash command: ${promptPath.uri}`, e instanceof Error ? e.message : String(e));
                return undefined;
            }
        }));
        const result = [];
        const seen = new ResourceSet();
        for (const detail of details) {
            if (detail) {
                result.push(detail);
                seen.add(detail.promptPath.uri);
            }
        }
        for (const model of this.modelService.getModels()) {
            if (model.getLanguageId() === PROMPT_LANGUAGE_ID && model.uri.scheme === Schemas.untitled && !seen.has(model.uri)) {
                const parsedPromptFile = this.getParsedPromptFile(model);
                result.push(this.asChatPromptSlashCommand(parsedPromptFile, { uri: model.uri, storage: PromptsStorage.local, type: PromptsType.prompt }));
            }
        }
        return result;
    }
    isValidSlashCommandName(command) {
        return command.match(/^[\p{L}\d_\-\.]+$/u) !== null;
    }
    async resolvePromptSlashCommand(name, token) {
        const commands = await this.getPromptSlashCommands(token);
        return commands.find(cmd => cmd.name === name);
    }
    asChatPromptSlashCommand(parsedPromptFile, promptPath) {
        let name = parsedPromptFile?.header?.name ?? promptPath.name ?? getCleanPromptName(promptPath.uri);
        name = name.replace(/[^\p{L}\d_\-\.]+/gu, '-'); // replace spaces with dashes
        return {
            name: name,
            description: parsedPromptFile?.header?.description ?? promptPath.description,
            argumentHint: parsedPromptFile?.header?.argumentHint,
            parsedPromptFile,
            promptPath
        };
    }
    async getPromptSlashCommandName(uri, token) {
        const slashCommands = await this.getPromptSlashCommands(token);
        const slashCommand = slashCommands.find(c => isEqual(c.promptPath.uri, uri));
        if (!slashCommand) {
            return getCleanPromptName(uri);
        }
        return slashCommand.name;
    }
    // custom agents
    /**
     * Emitter for custom agents change events.
     */
    get onDidChangeCustomAgents() {
        return this.cachedCustomAgents.onDidChange;
    }
    async getCustomAgents(token) {
        return this.cachedCustomAgents.get(token);
    }
    async computeCustomAgents(token) {
        let agentFiles = await this.listPromptFiles(PromptsType.agent, token);
        const disabledAgents = this.getDisabledPromptFiles(PromptsType.agent);
        agentFiles = agentFiles.filter(promptPath => !disabledAgents.has(promptPath.uri));
        const customAgents = await Promise.all(agentFiles.map(async (promptPath) => {
            const uri = promptPath.uri;
            const ast = await this.parseNew(uri, token);
            let metadata;
            if (ast.header) {
                const advanced = ast.header.getAttribute(PromptHeaderAttributes.advancedOptions);
                if (advanced && advanced.value.type === 'object') {
                    metadata = {};
                    for (const [key, value] of Object.entries(advanced.value)) {
                        if (['string', 'number', 'boolean'].includes(value.type)) {
                            metadata[key] = value;
                        }
                    }
                }
            }
            const toolReferences = [];
            if (ast.body) {
                const bodyOffset = ast.body.offset;
                const bodyVarRefs = ast.body.variableReferences;
                for (let i = bodyVarRefs.length - 1; i >= 0; i--) { // in reverse order
                    const { name, offset } = bodyVarRefs[i];
                    const range = new OffsetRange(offset - bodyOffset, offset - bodyOffset + name.length + 1);
                    toolReferences.push({ name, range });
                }
            }
            const agentInstructions = {
                content: ast.body?.getContent() ?? '',
                toolReferences,
                metadata,
            };
            const name = ast.header?.name ?? promptPath.name ?? getCleanPromptName(uri);
            const source = IAgentSource.fromPromptPath(promptPath);
            if (!ast.header) {
                return { uri, name, agentInstructions, source };
            }
            const { description, model, tools, handOffs, argumentHint, target } = ast.header;
            return { uri, name, description, model, tools, handOffs, argumentHint, target, agentInstructions, source };
        }));
        return customAgents;
    }
    async parseNew(uri, token) {
        const model = this.modelService.getModel(uri);
        if (model) {
            return this.getParsedPromptFile(model);
        }
        const fileContent = await this.fileService.readFile(uri);
        if (token.isCancellationRequested) {
            throw new CancellationError();
        }
        return new PromptFileParser().parse(uri, fileContent.value.toString());
    }
    registerContributedFile(type, name, description, uri, extension) {
        const bucket = this.contributedFiles[type];
        if (bucket.has(uri)) {
            // keep first registration per extension (handler filters duplicates per extension already)
            return Disposable.None;
        }
        const entryPromise = (async () => {
            try {
                await this.filesConfigService.updateReadonly(uri, true);
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                this.logger.error(`[registerContributedFile] Failed to make prompt file readonly: ${uri}`, msg);
            }
            return { uri, name, description, storage: PromptsStorage.extension, type, extension };
        })();
        bucket.set(uri, entryPromise);
        const flushCachesIfRequired = () => {
            this.cachedFileLocations[type] = undefined;
            switch (type) {
                case PromptsType.agent:
                    this.cachedCustomAgents.refresh();
                    break;
                case PromptsType.prompt:
                    this.cachedSlashCommands.refresh();
                    break;
            }
        };
        flushCachesIfRequired();
        return {
            dispose: () => {
                bucket.delete(uri);
                flushCachesIfRequired();
            }
        };
    }
    getPromptLocationLabel(promptPath) {
        switch (promptPath.storage) {
            case PromptsStorage.local: return this.labelService.getUriLabel(dirname(promptPath.uri), { relative: true });
            case PromptsStorage.user: return localize('user-data-dir.capitalized', 'User Data');
            case PromptsStorage.extension: {
                return localize('extension.with.id', 'Extension: {0}', promptPath.extension.displayName ?? promptPath.extension.id);
            }
            default: throw new Error('Unknown prompt storage type');
        }
    }
    findAgentMDsInWorkspace(token) {
        return this.fileLocator.findAgentMDsInWorkspace(token);
    }
    async listAgentMDs(token, includeNested) {
        const useAgentMD = this.configurationService.getValue(PromptsConfig.USE_AGENT_MD);
        if (!useAgentMD) {
            return [];
        }
        if (includeNested) {
            return await this.fileLocator.findAgentMDsInWorkspace(token);
        }
        else {
            return await this.fileLocator.findAgentMDsInWorkspaceRoots(token);
        }
    }
    async listCopilotInstructionsMDs(token) {
        const useCopilotInstructionsFiles = this.configurationService.getValue(PromptsConfig.USE_COPILOT_INSTRUCTION_FILES);
        if (!useCopilotInstructionsFiles) {
            return [];
        }
        return await this.fileLocator.findCopilotInstructionsMDsInWorkspace(token);
    }
    getAgentFileURIFromModeFile(oldURI) {
        return this.fileLocator.getAgentFileURIFromModeFile(oldURI);
    }
    getDisabledPromptFiles(type) {
        // Migration: if disabled key absent but legacy enabled key present, convert once.
        const disabledKey = this.disabledPromptsStorageKeyPrefix + type;
        const value = this.storageService.get(disabledKey, 0 /* StorageScope.PROFILE */, '[]');
        const result = new ResourceSet();
        try {
            const arr = JSON.parse(value);
            if (Array.isArray(arr)) {
                for (const s of arr) {
                    try {
                        result.add(URI.revive(s));
                    }
                    catch {
                        // ignore
                    }
                }
            }
        }
        catch {
            // ignore invalid storage values
        }
        return result;
    }
    setDisabledPromptFiles(type, uris) {
        const disabled = Array.from(uris).map(uri => uri.toJSON());
        this.storageService.store(this.disabledPromptsStorageKeyPrefix + type, JSON.stringify(disabled), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        if (type === PromptsType.agent) {
            this.cachedCustomAgents.refresh();
        }
    }
    // Claude skills
    async findClaudeSkills(token) {
        const useClaudeSkills = this.configurationService.getValue(PromptsConfig.USE_CLAUDE_SKILLS);
        if (useClaudeSkills) {
            const result = [];
            const process = async (uri, type) => {
                try {
                    const parsedFile = await this.parseNew(uri, token);
                    const name = parsedFile.header?.name;
                    if (name) {
                        result.push({ uri, type, name, description: parsedFile.header?.description });
                    }
                    else {
                        this.logger.error(`[findClaudeSkills] Claude skill file missing name attribute: ${uri}`);
                    }
                }
                catch (e) {
                    this.logger.error(`[findClaudeSkills] Failed to parse Claude skill file: ${uri}`, e instanceof Error ? e.message : String(e));
                }
            };
            const workspaceSkills = await this.fileLocator.findClaudeSkillsInWorkspace(token);
            await Promise.all(workspaceSkills.map(uri => process(uri, 'project')));
            const userSkills = await this.fileLocator.findClaudeSkillsInUserHome(token);
            await Promise.all(userSkills.map(uri => process(uri, 'personal')));
            return result;
        }
        return undefined;
    }
};
PromptsService = __decorate([
    __param(0, ILogService),
    __param(1, ILabelService),
    __param(2, IModelService),
    __param(3, IInstantiationService),
    __param(4, IUserDataProfileService),
    __param(5, IConfigurationService),
    __param(6, IFileService),
    __param(7, IFilesConfigurationService),
    __param(8, IStorageService)
], PromptsService);
export { PromptsService };
// helpers
class CachedPromise extends Disposable {
    constructor(computeFn, getEvent, delay = 0) {
        super();
        this.computeFn = computeFn;
        this.getEvent = getEvent;
        this.delay = delay;
        this.cachedPromise = undefined;
        this.onDidUpdatePromiseEmitter = undefined;
    }
    get onDidChange() {
        if (!this.onDidUpdatePromiseEmitter) {
            const emitter = this.onDidUpdatePromiseEmitter = this._register(new Emitter());
            const delayer = this._register(new Delayer(this.delay));
            this._register(this.getEvent()(() => {
                this.cachedPromise = undefined;
                delayer.trigger(() => emitter.fire());
            }));
        }
        return this.onDidUpdatePromiseEmitter.event;
    }
    get(token) {
        if (this.cachedPromise !== undefined) {
            return this.cachedPromise;
        }
        const result = this.computeFn(token);
        if (!this.onDidUpdatePromiseEmitter) {
            return result; // only cache if there is an event listener
        }
        this.cachedPromise = result;
        this.onDidUpdatePromiseEmitter.fire();
        return result;
    }
    refresh() {
        this.cachedPromise = undefined;
        this.onDidUpdatePromiseEmitter?.fire();
    }
}
class ModelChangeTracker extends Disposable {
    get onDidPromptChange() {
        return this.onDidPromptModelChange.event;
    }
    constructor(modelService) {
        super();
        this.listeners = new ResourceMap();
        this.onDidPromptModelChange = this._register(new Emitter());
        const onAdd = (model) => {
            const promptType = getPromptsTypeForLanguageId(model.getLanguageId());
            if (promptType !== undefined) {
                this.listeners.set(model.uri, model.onDidChangeContent(() => this.onDidPromptModelChange.fire({ uri: model.uri, promptType })));
            }
        };
        const onRemove = (languageId, uri) => {
            const promptType = getPromptsTypeForLanguageId(languageId);
            if (promptType !== undefined) {
                this.listeners.get(uri)?.dispose();
                this.listeners.delete(uri);
                this.onDidPromptModelChange.fire({ uri, promptType });
            }
        };
        this._register(modelService.onModelAdded(model => onAdd(model)));
        this._register(modelService.onModelLanguageChanged(e => {
            onRemove(e.oldLanguageId, e.model.uri);
            onAdd(e.model);
        }));
        this._register(modelService.onModelRemoved(model => onRemove(model.getLanguageId(), model.uri)));
    }
    dispose() {
        super.dispose();
        this.listeners.forEach(listener => listener.dispose());
        this.listeners.clear();
    }
}
var IAgentSource;
(function (IAgentSource) {
    function fromPromptPath(promptPath) {
        if (promptPath.storage === PromptsStorage.extension) {
            return {
                storage: PromptsStorage.extension,
                extensionId: promptPath.extension.identifier
            };
        }
        else {
            return {
                storage: promptPath.storage
            };
        }
    }
    IAgentSource.fromPromptPath = fromPromptPath;
})(IAgentSource || (IAgentSource = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0c1NlcnZpY2VJbXBsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Byb21wdFN5bnRheC9zZXJ2aWNlL3Byb21wdHNTZXJ2aWNlSW1wbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNyRixPQUFPLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDOUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUV6RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3BELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBRXpHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNoRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUN6RyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDakYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzNFLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLGdG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