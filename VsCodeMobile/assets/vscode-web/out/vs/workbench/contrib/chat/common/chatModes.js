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
var ChatModeService_1;
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { constObservable, observableValue, transaction } from '../../../../base/common/observable.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IChatAgentService } from './chatAgents.js';
import { ChatContextKeys } from './chatContextKeys.js';
import { ChatConfiguration, ChatModeKind } from './constants.js';
import { IPromptsService, PromptsStorage } from './promptSyntax/service/promptsService.js';
export const IChatModeService = createDecorator('chatModeService');
let ChatModeService = class ChatModeService extends Disposable {
    static { ChatModeService_1 = this; }
    static { this.CUSTOM_MODES_STORAGE_KEY = 'chat.customModes'; }
    constructor(promptsService, chatAgentService, contextKeyService, logService, storageService, configurationService) {
        super();
        this.promptsService = promptsService;
        this.chatAgentService = chatAgentService;
        this.logService = logService;
        this.storageService = storageService;
        this.configurationService = configurationService;
        this._customModeInstances = new Map();
        this._onDidChangeChatModes = new Emitter();
        this.onDidChangeChatModes = this._onDidChangeChatModes.event;
        this.hasCustomModes = ChatContextKeys.Modes.hasCustomChatModes.bindTo(contextKeyService);
        this.agentModeDisabledByPolicy = ChatContextKeys.Modes.agentModeDisabledByPolicy.bindTo(contextKeyService);
        // Initialize the policy context key
        this.updateAgentModePolicyContextKey();
        // Load cached modes from storage first
        this.loadCachedModes();
        void this.refreshCustomPromptModes(true);
        this._register(this.promptsService.onDidChangeCustomAgents(() => {
            void this.refreshCustomPromptModes(true);
        }));
        this._register(this.storageService.onWillSaveState(() => this.saveCachedModes()));
        // Listen for configuration changes that affect agent mode policy
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(ChatConfiguration.AgentEnabled)) {
                this.updateAgentModePolicyContextKey();
                this._onDidChangeChatModes.fire();
            }
        }));
        // Ideally we can get rid of the setting to disable agent mode?
        let didHaveToolsAgent = this.chatAgentService.hasToolsAgent;
        this._register(this.chatAgentService.onDidChangeAgents(() => {
            if (didHaveToolsAgent !== this.chatAgentService.hasToolsAgent) {
                didHaveToolsAgent = this.chatAgentService.hasToolsAgent;
                this._onDidChangeChatModes.fire();
            }
        }));
    }
    loadCachedModes() {
        try {
            const cachedCustomModes = this.storageService.getObject(ChatModeService_1.CUSTOM_MODES_STORAGE_KEY, 1 /* StorageScope.WORKSPACE */);
            if (cachedCustomModes) {
                this.deserializeCachedModes(cachedCustomModes);
            }
        }
        catch (error) {
            this.logService.error(error, 'Failed to load cached custom agents');
        }
    }
    deserializeCachedModes(cachedCustomModes) {
        if (!Array.isArray(cachedCustomModes)) {
            this.logService.error('Invalid cached custom modes data: expected array');
            return;
        }
        for (const cachedMode of cachedCustomModes) {
            if (isCachedChatModeData(cachedMode) && cachedMode.uri) {
                try {
                    const uri = URI.revive(cachedMode.uri);
                    const customChatMode = {
                        uri,
                        name: cachedMode.name,
                        description: cachedMode.description,
                        tools: cachedMode.customTools,
                        model: cachedMode.model,
                        argumentHint: cachedMode.argumentHint,
                        agentInstructions: cachedMode.modeInstructions ?? { content: cachedMode.body ?? '', toolReferences: [] },
                        handOffs: cachedMode.handOffs,
                        target: cachedMode.target,
                        source: reviveChatModeSource(cachedMode.source) ?? { storage: PromptsStorage.local }
                    };
                    const instance = new CustomChatMode(customChatMode);
                    this._customModeInstances.set(uri.toString(), instance);
                }
                catch (error) {
                    this.logService.error(error, 'Failed to revive cached custom agent');
                }
            }
        }
        this.hasCustomModes.set(this._customModeInstances.size > 0);
    }
    saveCachedModes() {
        try {
            const modesToCache = Array.from(this._customModeInstances.values());
            this.storageService.store(ChatModeService_1.CUSTOM_MODES_STORAGE_KEY, modesToCache, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        }
        catch (error) {
            this.logService.warn('Failed to save cached custom agents', error);
        }
    }
    async refreshCustomPromptModes(fireChangeEvent) {
        try {
            const customModes = await this.promptsService.getCustomAgents(CancellationToken.None);
            // Create a new set of mode instances, reusing existing ones where possible
            const seenUris = new Set();
            for (const customMode of customModes) {
                const uriString = customMode.uri.toString();
                seenUris.add(uriString);
                let modeInstance = this._customModeInstances.get(uriString);
                if (modeInstance) {
                    // Update existing instance with new data
                    modeInstance.updateData(customMode);
                }
                else {
                    // Create new instance
                    modeInstance = new CustomChatMode(customMode);
                    this._customModeInstances.set(uriString, modeInstance);
                }
            }
            // Clean up instances for modes that no longer exist
            for (const [uriString] of this._customModeInstances.entries()) {
                if (!seenUris.has(uriString)) {
                    this._customModeInstances.delete(uriString);
                }
            }
            this.hasCustomModes.set(this._customModeInstances.size > 0);
        }
        catch (error) {
            this.logService.error(error, 'Failed to load custom agents');
            this._customModeInstances.clear();
            this.hasCustomModes.set(false);
        }
        if (fireChangeEvent) {
            this._onDidChangeChatModes.fire();
        }
    }
    getModes() {
        return {
            builtin: this.getBuiltinModes(),
            custom: this.getCustomModes(),
        };
    }
    findModeById(id) {
        return this.getBuiltinModes().find(mode => mode.id === id) ?? this._customModeInstances.get(id);
    }
    findModeByName(name) {
        return this.getBuiltinModes().find(mode => mode.name.get() === name) ?? this.getCustomModes().find(mode => mode.name.get() === name);
    }
    getBuiltinModes() {
        const builtinModes = [
            ChatMode.Ask,
        ];
        // Include Agent mode if:
        // - It's enabled (hasToolsAgent is true), OR
        // - It's disabled by policy (so we can show it with a lock icon)
        // But hide it if the user manually disabled it via settings
        if (this.chatAgentService.hasToolsAgent || this.isAgentModeDisabledByPolicy()) {
            builtinModes.unshift(ChatMode.Agent);
        }
        builtinModes.push(ChatMode.Edit);
        return builtinModes;
    }
    getCustomModes() {
        // Show custom modes only when agent mode is enabled
        return this.chatAgentService.hasToolsAgent ? Array.from(this._customModeInstances.values()) : [];
    }
    updateAgentModePolicyContextKey() {
        this.agentModeDisabledByPolicy.set(this.isAgentModeDisabledByPolicy());
    }
    isAgentModeDisabledByPolicy() {
        return this.configurationService.inspect(ChatConfiguration.AgentEnabled).policyValue === false;
    }
};
ChatModeService = ChatModeService_1 = __decorate([
    __param(0, IPromptsService),
    __param(1, IChatAgentService),
    __param(2, IContextKeyService),
    __param(3, ILogService),
    __param(4, IStorageService),
    __param(5, IConfigurationService)
], ChatModeService);
export { ChatModeService };
function isCachedChatModeData(data) {
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    const mode = data;
    return typeof mode.id === 'string' &&
        typeof mode.name === 'string' &&
        typeof mode.kind === 'string' &&
        (mode.description === undefined || typeof mode.description === 'string') &&
        (mode.customTools === undefined || Array.isArray(mode.customTools)) &&
        (mode.modeInstructions === undefined || (typeof mode.modeInstructions === 'object' && mode.modeInstructions !== null)) &&
        (mode.model === undefined || typeof mode.model === 'string') &&
        (mode.argumentHint === undefined || typeof mode.argumentHint === 'string') &&
        (mode.handOffs === undefined || Array.isArray(mode.handOffs)) &&
        (mode.uri === undefined || (typeof mode.uri === 'object' && mode.uri !== null)) &&
        (mode.source === undefined || isChatModeSourceData(mode.source)) &&
        (mode.target === undefined || typeof mode.target === 'string');
}
export class CustomChatMode {
    get name() {
        return this._nameObservable;
    }
    get description() {
        return this._descriptionObservable;
    }
    get isBuiltin() {
        return isBuiltinChatMode(this);
    }
    get customTools() {
        return this._customToolsObservable;
    }
    get model() {
        return this._modelObservable;
    }
    get argumentHint() {
        return this._argumentHintObservable;
    }
    get modeInstructions() {
        return this._modeInstructions;
    }
    get uri() {
        return this._uriObservable;
    }
    get label() {
        return this.name;
    }
    get handOffs() {
        return this._handoffsObservable;
    }
    get source() {
        return this._source;
    }
    get target() {
        return this._targetObservable;
    }
    constructor(customChatMode) {
        this.kind = ChatModeKind.Agent;
        this.id = customChatMode.uri.toString();
        this._nameObservable = observableValue('name', customChatMode.name);
        this._descriptionObservable = observableValue('description', customChatMode.description);
        this._customToolsObservable = observableValue('customTools', customChatMode.tools);
        this._modelObservable = observableValue('model', customChatMode.model);
        this._argumentHintObservable = observableValue('argumentHint', customChatMode.argumentHint);
        this._handoffsObservable = observableValue('handOffs', customChatMode.handOffs);
        this._targetObservable = observableValue('target', customChatMode.target);
        this._modeInstructions = observableValue('_modeInstructions', customChatMode.agentInstructions);
        this._uriObservable = observableValue('uri', customChatMode.uri);
        this._source = customChatMode.source;
    }
    /**
     * Updates the underlying data and triggers observable changes
     */
    updateData(newData) {
        transaction(tx => {
            this._nameObservable.set(newData.name, tx);
            this._descriptionObservable.set(newData.description, tx);
            this._customToolsObservable.set(newData.tools, tx);
            this._modelObservable.set(newData.model, tx);
            this._argumentHintObservable.set(newData.argumentHint, tx);
            this._handoffsObservable.set(newData.handOffs, tx);
            this._targetObservable.set(newData.target, tx);
            this._modeInstructions.set(newData.agentInstructions, tx);
            this._uriObservable.set(newData.uri, tx);
            this._source = newData.source;
        });
    }
    toJSON() {
        return {
            id: this.id,
            name: this.name.get(),
            description: this.description.get(),
            kind: this.kind,
            customTools: this.customTools.get(),
            model: this.model.get(),
            argumentHint: this.argumentHint.get(),
            modeInstructions: this.modeInstructions.get(),
            uri: this.uri.get(),
            handOffs: this.handOffs.get(),
            source: serializeChatModeSource(this._source),
            target: this.target.get()
        };
    }
}
function isChatModeSourceData(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const data = value;
    if (data.storage === PromptsStorage.extension) {
        return typeof data.extensionId === 'string';
    }
    return data.storage === PromptsStorage.local || data.storage === PromptsStorage.user;
}
function serializeChatModeSource(source) {
    if (!source) {
        return undefined;
    }
    if (source.storage === PromptsStorage.extension) {
        return { storage: PromptsStorage.extension, extensionId: source.extensionId.value };
    }
    return { storage: source.storage };
}
function reviveChatModeSource(data) {
    if (!data) {
        return undefined;
    }
    if (data.storage === PromptsStorage.extension) {
        return { storage: PromptsStorage.extension, extensionId: new ExtensionIdentifier(data.extensionId) };
    }
    return { storage: data.storage };
}
export class BuiltinChatMode {
    constructor(kind, label, description) {
        this.kind = kind;
        this.name = constObservable(kind);
        this.label = constObservable(label);
        this.description = observableValue('description', description);
    }
    get isBuiltin() {
        return isBuiltinChatMode(this);
    }
    get id() {
        // Need a differentiator?
        return this.kind;
    }
    get target() {
        return observableValue('target', undefined);
    }
    /**
     * Getters are not json-stringified
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name.get(),
            description: this.description.get(),
            kind: this.kind
        };
    }
}
export var ChatMode;
(function (ChatMode) {
    ChatMode.Ask = new BuiltinChatMode(ChatModeKind.Ask, 'Ask', localize('chatDescription', "Explore and understand your code"));
    ChatMode.Edit = new BuiltinChatMode(ChatModeKind.Edit, 'Edit', localize('editsDescription', "Edit or refactor selected code"));
    ChatMode.Agent = new BuiltinChatMode(ChatModeKind.Agent, 'Agent', localize('agentDescription', "Describe what to build next"));
})(ChatMode || (ChatMode = {}));
export function isBuiltinChatMode(mode) {
    return mode.id === ChatMode.Ask.id ||
        mode.id === ChatMode.Edit.id ||
        mode.id === ChatMode.Agent.id;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1vZGVzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL2NoYXRNb2Rlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDNUUsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsZUFBZSxFQUFvQyxlQUFlLEVBQUUsV0FBVyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDeEksT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRXJELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQWUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN2RyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMzRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDN0YsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sZ0RBQWdELENBQUM7QUFDOUcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDcEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUVqRSxPQUFPLEVBQThCLGVBQWUs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