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
import { SequencerByKey } from '../../../../base/common/async.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter } from '../../../../base/common/event.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { isFalsyOrWhitespace } from '../../../../base/common/strings.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ChatEntitlement, IChatEntitlementService } from '../../../services/chat/common/chatEntitlementService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { ExtensionsRegistry } from '../../../services/extensions/common/extensionsRegistry.js';
import { ChatContextKeys } from './chatContextKeys.js';
export var ChatMessageRole;
(function (ChatMessageRole) {
    ChatMessageRole[ChatMessageRole["System"] = 0] = "System";
    ChatMessageRole[ChatMessageRole["User"] = 1] = "User";
    ChatMessageRole[ChatMessageRole["Assistant"] = 2] = "Assistant";
})(ChatMessageRole || (ChatMessageRole = {}));
export var LanguageModelPartAudience;
(function (LanguageModelPartAudience) {
    LanguageModelPartAudience[LanguageModelPartAudience["Assistant"] = 0] = "Assistant";
    LanguageModelPartAudience[LanguageModelPartAudience["User"] = 1] = "User";
    LanguageModelPartAudience[LanguageModelPartAudience["Extension"] = 2] = "Extension";
})(LanguageModelPartAudience || (LanguageModelPartAudience = {}));
/**
 * Enum for supported image MIME types.
 */
export var ChatImageMimeType;
(function (ChatImageMimeType) {
    ChatImageMimeType["PNG"] = "image/png";
    ChatImageMimeType["JPEG"] = "image/jpeg";
    ChatImageMimeType["GIF"] = "image/gif";
    ChatImageMimeType["WEBP"] = "image/webp";
    ChatImageMimeType["BMP"] = "image/bmp";
})(ChatImageMimeType || (ChatImageMimeType = {}));
/**
 * Specifies the detail level of the image.
 */
export var ImageDetailLevel;
(function (ImageDetailLevel) {
    ImageDetailLevel["Low"] = "low";
    ImageDetailLevel["High"] = "high";
})(ImageDetailLevel || (ImageDetailLevel = {}));
export var ILanguageModelChatMetadata;
(function (ILanguageModelChatMetadata) {
    function suitableForAgentMode(metadata) {
        const supportsToolsAgent = typeof metadata.capabilities?.agentMode === 'undefined' || metadata.capabilities.agentMode;
        return supportsToolsAgent && !!metadata.capabilities?.toolCalling;
    }
    ILanguageModelChatMetadata.suitableForAgentMode = suitableForAgentMode;
    function asQualifiedName(metadata) {
        return `${metadata.name} (${metadata.vendor})`;
    }
    ILanguageModelChatMetadata.asQualifiedName = asQualifiedName;
    function matchesQualifiedName(name, metadata) {
        if (metadata.vendor === 'copilot' && name === metadata.name) {
            return true;
        }
        return name === asQualifiedName(metadata);
    }
    ILanguageModelChatMetadata.matchesQualifiedName = matchesQualifiedName;
})(ILanguageModelChatMetadata || (ILanguageModelChatMetadata = {}));
export const ILanguageModelsService = createDecorator('ILanguageModelsService');
const languageModelChatProviderType = {
    type: 'object',
    required: ['vendor', 'displayName'],
    properties: {
        vendor: {
            type: 'string',
            description: localize('vscode.extension.contributes.languageModels.vendor', "A globally unique vendor of language model chat provider.")
        },
        displayName: {
            type: 'string',
            description: localize('vscode.extension.contributes.languageModels.displayName', "The display name of the language model chat provider.")
        },
        managementCommand: {
            type: 'string',
            description: localize('vscode.extension.contributes.languageModels.managementCommand', "A command to manage the language model chat provider, e.g. 'Manage Copilot models'. This is used in the chat model picker. If not provided, a gear icon is not rendered during vendor selection.")
        },
        when: {
            type: 'string',
            description: localize('vscode.extension.contributes.languageModels.when', "Condition which must be true to show this language model chat provider in the Manage Models list.")
        }
    }
};
export const languageModelChatProviderExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: 'languageModelChatProviders',
    jsonSchema: {
        description: localize('vscode.extension.contributes.languageModelChatProviders', "Contribute language model chat providers of a specific vendor."),
        oneOf: [
            languageModelChatProviderType,
            {
                type: 'array',
                items: languageModelChatProviderType
            }
        ]
    },
    activationEventsGenerator: function* (contribs) {
        for (const contrib of contribs) {
            yield `onLanguageModelChatProvider:${contrib.vendor}`;
        }
    }
});
let LanguageModelsService = class LanguageModelsService {
    constructor(_extensionService, _logService, _storageService, _contextKeyService, _configurationService, _chatEntitlementService) {
        this._extensionService = _extensionService;
        this._logService = _logService;
        this._storageService = _storageService;
        this._configurationService = _configurationService;
        this._chatEntitlementService = _chatEntitlementService;
        this._store = new DisposableStore();
        this._providers = new Map();
        this._modelCache = new Map();
        this._vendors = new Map();
        this._resolveLMSequencer = new SequencerByKey();
        this._modelPickerUserPreferences = {};
        this._onLanguageModelChange = this._store.add(new Emitter());
        this.onDidChangeLanguageModels = this._onLanguageModelChange.event;
        this._hasUserSelectableModels = ChatContextKeys.languageModelsAreUserSelectable.bindTo(_contextKeyService);
        this._contextKeyService = _contextKeyService;
        this._modelPickerUserPreferences = this._storageService.getObject('chatModelPickerPreferences', 0 /* StorageScope.PROFILE */, this._modelPickerUserPreferences);
        // TODO @lramos15 - Remove after a few releases, as this is just cleaning a bad storage state
        const entitlementChangeHandler = () => {
            if ((this._chatEntitlementService.entitlement === ChatEntitlement.Business || this._chatEntitlementService.entitlement === ChatEntitlement.Enterprise) && !this._chatEntitlementService.isInternal) {
                this._modelPickerUserPreferences = {};
                this._storageService.store('chatModelPickerPreferences', this._modelPickerUserPreferences, 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
            }
        };
        entitlementChangeHandler();
        this._store.add(this._chatEntitlementService.onDidChangeEntitlement(entitlementChangeHandler));
        this._store.add(this.onDidChangeLanguageModels(() => {
            this._hasUserSelectableModels.set(this._modelCache.size > 0 && Array.from(this._modelCache.values()).some(model => model.isUserSelectable));
        }));
        this._store.add(languageModelChatProviderExtensionPoint.setHandler((extensions) => {
            this._vendors.clear();
            for (const extension of extensions) {
                for (const item of Iterable.wrap(extension.value)) {
                    if (this._vendors.has(item.vendor)) {
                        extension.collector.error(localize('vscode.extension.contributes.languageModels.vendorAlreadyRegistered', "The vendor '{0}' is already registered and cannot be registered twice", item.vendor));
                        continue;
                    }
                    if (isFalsyOrWhitespace(item.vendor)) {
                        extension.collector.error(localize('vscode.extension.contributes.languageModels.emptyVendor', "The vendor field cannot be empty."));
                        continue;
                    }
                    if (item.vendor.trim() !== item.vendor) {
                        extension.collector.error(localize('vscode.extension.contributes.languageModels.whitespaceVendor', "The vendor field cannot start or end with whitespace."));
                        continue;
                    }
                    this._vendors.set(item.vendor, item);
                    // Have some models we want from this vendor, so activate the extension
                    if (this._hasStoredModelForVendor(item.vendor)) {
                        this._extensionService.activateByEvent(`onLanguageModelChatProvider:${item.vendor}`);
                    }
                }
            }
            for (const [vendor, _] of this._providers) {
                if (!this._vendors.has(vendor)) {
                    this._providers.delete(vendor);
                }
            }
        }));
    }
    _hasStoredModelForVendor(vendor) {
        return Object.keys(this._modelPickerUserPreferences).some(modelId => {
            return modelId.startsWith(vendor);
        });
    }
    dispose() {
        this._store.dispose();
        this._providers.clear();
    }
    updateModelPickerPreference(modelIdentifier, showInModelPicker) {
        const model = this._modelCache.get(modelIdentifier);
        if (!model) {
            this._logService.warn(`[LM] Cannot update model picker preference for unknown model ${modelIdentifier}`);
            return;
        }
        this._modelPickerUserPreferences[modelIdentifier] = showInModelPicker;
        if (showInModelPicker === model.isUserSelectable) {
            delete this._modelPickerUserPreferences[modelIdentifier];
            this._storageService.store('chatModelPickerPreferences', this._modelPickerUserPreferences, 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        }
        else if (model.isUserSelectable !== showInModelPicker) {
            this._storageService.store('chatModelPickerPreferences', this._modelPickerUserPreferences, 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        }
        this._onLanguageModelChange.fire(model.vendor);
        this._logService.trace(`[LM] Updated model picker preference for ${modelIdentifier} to ${showInModelPicker}`);
    }
    getVendors() {
        return Array.from(this._vendors.values()).filter(vendor => {
            if (!vendor.when) {
                return true; // No when clause means always visible
            }
            const whenClause = ContextKeyExpr.deserialize(vendor.when);
            return whenClause ? this._contextKeyService.contextMatchesRules(whenClause) : false;
        });
    }
    getLanguageModelIds() {
        return Array.from(this._modelCache.keys());
    }
    lookupLanguageModel(modelIdentifier) {
        const model = this._modelCache.get(modelIdentifier);
        if (model && this._configurationService.getValue('chat.experimentalShowAllModels')) {
            return { ...model, isUserSelectable: true };
        }
        if (model && this._modelPickerUserPreferences[modelIdentifier] !== undefined) {
            return { ...model, isUserSelectable: this._modelPickerUserPreferences[modelIdentifier] };
        }
        return model;
    }
    _clearModelCache(vendor) {
        for (const [id, model] of this._modelCache.entries()) {
            if (model.vendor === vendor) {
                this._modelCache.delete(id);
            }
        }
    }
    async _resolveLanguageModels(vendor, silent) {
        // Activate extensions before requesting to resolve the models
        await this._extensionService.activateByEvent(`onLanguageModelChatProvider:${vendor}`);
        const provider = this._providers.get(vendor);
        if (!provider) {
            this._logService.warn(`[LM] No provider registered for vendor ${vendor}`);
            return;
        }
        return this._resolveLMSequencer.queue(vendor, async () => {
            try {
                let modelsAndIdentifiers = await provider.provideLanguageModelChatInfo({ silent }, CancellationToken.None);
                // This is a bit of a hack, when prompting user if the provider returns any models that are user selectable then we only want to show those and not the entire model list
                if (!silent && modelsAndIdentifiers.some(m => m.metadata.isUserSelectable)) {
                    modelsAndIdentifiers = modelsAndIdentifiers.filter(m => m.metadata.isUserSelectable || this._modelPickerUserPreferences[m.identifier] === true);
                }
                this._clearModelCache(vendor);
                for (const modelAndIdentifier of modelsAndIdentifiers) {
                    if (this._modelCache.has(modelAndIdentifier.identifier)) {
                        this._logService.warn(`[LM] Model ${modelAndIdentifier.identifier} is already registered. Skipping.`);
                        continue;
                    }
                    this._modelCache.set(modelAndIdentifier.identifier, modelAndIdentifier.metadata);
                }
                this._logService.trace(`[LM] Resolved language models for vendor ${vendor}`, modelsAndIdentifiers);
            }
            catch (error) {
                this._logService.error(`[LM] Error resolving language models for vendor ${vendor}:`, error);
            }
            this._onLanguageModelChange.fire(vendor);
        });
    }
    async selectLanguageModels(selector, allowPromptingUser) {
        if (selector.vendor) {
            await this._resolveLanguageModels(selector.vendor, !allowPromptingUser);
        }
        else {
            const allVendors = Array.from(this._vendors.keys());
            await Promise.all(allVendors.map(vendor => this._resolveLanguageModels(vendor, !allowPromptingUser)));
        }
        const result = [];
        for (const [internalModelIdentifier, model] of this._modelCache) {
            if ((selector.vendor === undefined || model.vendor === selector.vendor)
                && (selector.family === undefined || model.family === selector.family)
                && (selector.version === undefined || model.version === selector.version)
                && (selector.id === undefined || model.id === selector.id)) {
                result.push(internalModelIdentifier);
            }
        }
        this._logService.trace('[LM] selected language models', selector, result);
        return result;
    }
    registerLanguageModelProvider(vendor, provider) {
        this._logService.trace('[LM] registering language model provider', vendor, provider);
        if (!this._vendors.has(vendor)) {
            throw new Error(`Chat model provider uses UNKNOWN vendor ${vendor}.`);
        }
        if (this._providers.has(vendor)) {
            throw new Error(`Chat model provider for vendor ${vendor} is already registered.`);
        }
        this._providers.set(vendor, provider);
        if (this._hasStoredModelForVendor(vendor)) {
            this._resolveLanguageModels(vendor, true);
        }
        const modelChangeListener = provider.onDidChange(async () => {
            await this._resolveLanguageModels(vendor, true);
        });
        return toDisposable(() => {
            this._logService.trace('[LM] UNregistered language model provider', vendor);
            this._clearModelCache(vendor);
            this._providers.delete(vendor);
            modelChangeListener.dispose();
        });
    }
    async sendChatRequest(modelId, from, messages, options, token) {
        const provider = this._providers.get(this._modelCache.get(modelId)?.vendor || '');
        if (!provider) {
            throw new Error(`Chat provider for model ${modelId} is not registered.`);
        }
        return provider.sendChatRequest(modelId, messages, from, options, token);
    }
    computeTokenLength(modelId, message, token) {
        const model = this._modelCache.get(modelId);
        if (!model) {
            throw new Error(`Chat model ${modelId} could not be found.`);
        }
        const provider = this._providers.get(model.vendor);
        if (!provider) {
            throw new Error(`Chat provider for model ${modelId} is not registered.`);
        }
        return provider.provideTokenCount(modelId, message, token);
    }
};
LanguageModelsService = __decorate([
    __param(0, IExtensionService),
    __param(1, ILogService),
    __param(2, IStorageService),
    __param(3, IContextKeyService),
    __param(4, IConfigurationService),
    __param(5, IChatEntitlementService)
], LanguageModelsService);
export { LanguageModelsService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFuZ3VhZ2VNb2RlbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vbGFuZ3VhZ2VNb2RlbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRWxFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFL0QsT0FBTyxFQUFFLGVBQWUsRUFBZSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUd6RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGNBQWMsRUFBZSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBRXZILE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUM3RixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDckUsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxnREFBZ0QsQ0FBQztBQUM5RyxPQUFPLEVBQUUsZUFBZSxFQUFFLHVCQUF1QixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDbkgsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDdEYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDL0YsT0FBTyxF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