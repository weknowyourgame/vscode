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
var ExtHostLanguageModels_1;
import { AsyncIterableProducer, AsyncIterableSource, RunOnceScheduler } from '../../../base/common/async.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { transformErrorForSerialization, transformErrorFromSerialization } from '../../../base/common/errors.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Iterable } from '../../../base/common/iterator.js';
import { toDisposable } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { ExtensionIdentifier, ExtensionIdentifierMap, ExtensionIdentifierSet } from '../../../platform/extensions/common/extensions.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { Progress } from '../../../platform/progress/common/progress.js';
import { DEFAULT_MODEL_PICKER_CATEGORY } from '../../contrib/chat/common/modelPicker/modelPickerWidget.js';
import { INTERNAL_AUTH_PROVIDER_PREFIX } from '../../services/authentication/common/authentication.js';
import { checkProposedApiEnabled, isProposedApiEnabled } from '../../services/extensions/common/extensions.js';
import { SerializableObjectWithBuffers } from '../../services/extensions/common/proxyIdentifier.js';
import { MainContext } from './extHost.protocol.js';
import { IExtHostAuthentication } from './extHostAuthentication.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import * as typeConvert from './extHostTypeConverters.js';
import * as extHostTypes from './extHostTypes.js';
export const IExtHostLanguageModels = createDecorator('IExtHostLanguageModels');
class LanguageModelResponse {
    constructor() {
        this._defaultStream = new AsyncIterableSource();
        this._isDone = false;
        const that = this;
        const [stream1, stream2] = AsyncIterableProducer.tee(that._defaultStream.asyncIterable);
        this.apiObject = {
            // result: promise,
            get stream() {
                return stream1;
            },
            get text() {
                return stream2.map(part => {
                    if (part instanceof extHostTypes.LanguageModelTextPart) {
                        return part.value;
                    }
                    else {
                        return undefined;
                    }
                }).coalesce();
            },
        };
    }
    handleResponsePart(parts) {
        if (this._isDone) {
            return;
        }
        const lmResponseParts = [];
        for (const part of Iterable.wrap(parts)) {
            let out;
            if (part.type === 'text') {
                out = new extHostTypes.LanguageModelTextPart(part.value, part.audience);
            }
            else if (part.type === 'thinking') {
                out = new extHostTypes.LanguageModelThinkingPart(part.value, part.id, part.metadata);
            }
            else if (part.type === 'data') {
                out = new extHostTypes.LanguageModelDataPart(part.data.buffer, part.mimeType, part.audience);
            }
            else {
                out = new extHostTypes.LanguageModelToolCallPart(part.toolCallId, part.name, part.parameters);
            }
            lmResponseParts.push(out);
        }
        this._defaultStream.emitMany(lmResponseParts);
    }
    reject(err) {
        this._isDone = true;
        this._defaultStream.reject(err);
    }
    resolve() {
        this._isDone = true;
        this._defaultStream.resolve();
    }
}
let ExtHostLanguageModels = class ExtHostLanguageModels {
    static { ExtHostLanguageModels_1 = this; }
    static { this._idPool = 1; }
    constructor(extHostRpc, _logService, _extHostAuthentication) {
        this._logService = _logService;
        this._extHostAuthentication = _extHostAuthentication;
        this._onDidChangeModelAccess = new Emitter();
        this._onDidChangeProviders = new Emitter();
        this.onDidChangeProviders = this._onDidChangeProviders.event;
        this._onDidChangeModelProxyAvailability = new Emitter();
        this.onDidChangeModelProxyAvailability = this._onDidChangeModelProxyAvailability.event;
        this._languageModelProviders = new Map();
        // TODO @lramos15 - Remove the need for both info and metadata as it's a lot of redundancy. Should just need one
        this._localModels = new Map();
        this._modelAccessList = new ExtensionIdentifierMap();
        this._pendingRequest = new Map();
        this._ignoredFileProviders = new Map();
        this._languageAccessInformationExtensions = new Set();
        this._proxy = extHostRpc.getProxy(MainContext.MainThreadLanguageModels);
    }
    dispose() {
        this._onDidChangeModelAccess.dispose();
        this._onDidChangeProviders.dispose();
        this._onDidChangeModelProxyAvailability.dispose();
    }
    registerLanguageModelChatProvider(extension, vendor, provider) {
        this._languageModelProviders.set(vendor, { extension: extension, provider });
        this._proxy.$registerLanguageModelProvider(vendor);
        let providerChangeEventDisposable;
        if (provider.onDidChangeLanguageModelChatInformation) {
            providerChangeEventDisposable = provider.onDidChangeLanguageModelChatInformation(() => {
                this._proxy.$onLMProviderChange(vendor);
            });
        }
        return toDisposable(() => {
            this._languageModelProviders.delete(vendor);
            this._clearModelCache(vendor);
            providerChangeEventDisposable?.dispose();
            this._proxy.$unregisterProvider(vendor);
        });
    }
    // Helper function to clear the local cache for a specific vendor. There's no lookup, so this involves iterating over all models.
    _clearModelCache(vendor) {
        this._localModels.forEach((value, key) => {
            if (value.metadata.vendor === vendor) {
                this._localModels.delete(key);
            }
        });
    }
    async $provideLanguageModelChatInfo(vendor, options, token) {
        const data = this._languageModelProviders.get(vendor);
        if (!data) {
            return [];
        }
        const modelInformation = await data.provider.provideLanguageModelChatInformation(options, token) ?? [];
        const modelMetadataAndIdentifier = modelInformation.map((m) => {
            let auth;
            if (m.requiresAuthorization && isProposedApiEnabled(data.extension, 'chatProvider')) {
                auth = {
                    providerLabel: data.extension.displayName || data.extension.name,
                    accountLabel: typeof m.requiresAuthorization === 'object' ? m.requiresAuthorization.label : undefined
                };
            }
            if (m.capabilities.editTools) {
                checkProposedApiEnabled(data.extension, 'chatProvider');
            }
            return {
                metadata: {
                    extension: data.extension.identifier,
                    id: m.id,
                    vendor,
                    name: m.name ?? '',
                    family: m.family ?? '',
                    detail: m.detail,
                    tooltip: m.tooltip,
                    version: m.version,
                    maxInputTokens: m.maxInputTokens,
                    maxOutputTokens: m.maxOutputTokens,
                    auth,
                    isDefault: m.isDefault,
                    isUserSelectable: m.isUserSelectable,
                    statusIcon: m.statusIcon,
                    modelPickerCategory: m.category ?? DEFAULT_MODEL_PICKER_CATEGORY,
                    capabilities: m.capabilities ? {
                        vision: m.capabilities.imageInput,
                        editTools: m.capabilities.editTools,
                        toolCalling: !!m.capabilities.toolCalling,
                        agentMode: !!m.capabilities.toolCalling
                    } : undefined,
                },
                identifier: `${vendor}/${m.id}`,
            };
        });
        this._clearModelCache(vendor);
        for (let i = 0; i < modelMetadataAndIdentifier.length; i++) {
            this._localModels.set(modelMetadataAndIdentifier[i].identifier, {
                metadata: modelMetadataAndIdentifier[i].metadata,
                info: modelInformation[i]
            });
        }
        return modelMetadataAndIdentifier;
    }
    async $startChatRequest(modelId, requestId, from, messages, options, token) {
        const knownModel = this._localModels.get(modelId);
        if (!knownModel) {
            throw new Error('Model not found');
        }
        const data = this._languageModelProviders.get(knownModel.metadata.vendor);
        if (!data) {
            throw new Error(`Language model provider for '${knownModel.metadata.id}' not found.`);
        }
        const queue = [];
        const sendNow = () => {
            if (queue.length > 0) {
                this._proxy.$reportResponsePart(requestId, new SerializableObjectWithBuffers(queue));
                queue.length = 0;
            }
        };
        const queueScheduler = new RunOnceScheduler(sendNow, 30);
        const sendSoon = (part) => {
            const newLen = queue.push(part);
            // flush/send if things pile up more than expected
            if (newLen > 30) {
                sendNow();
                queueScheduler.cancel();
            }
            else {
                queueScheduler.schedule();
            }
        };
        const progress = new Progress(async (fragment) => {
            if (token.isCancellationRequested) {
                this._logService.warn(`[CHAT](${data.extension.identifier.value}) CANNOT send progress because the REQUEST IS CANCELLED`);
                return;
            }
            let part;
            if (fragment instanceof extHostTypes.LanguageModelToolCallPart) {
                part = { type: 'tool_use', name: fragment.name, parameters: fragment.input, toolCallId: fragment.callId };
            }
            else if (fragment instanceof extHostTypes.LanguageModelTextPart) {
                part = { type: 'text', value: fragment.value, audience: fragment.audience };
            }
            else if (fragment instanceof extHostTypes.LanguageModelDataPart) {
                part = { type: 'data', mimeType: fragment.mimeType, data: VSBuffer.wrap(fragment.data), audience: fragment.audience };
            }
            else if (fragment instanceof extHostTypes.LanguageModelThinkingPart) {
                part = { type: 'thinking', value: fragment.value, id: fragment.id, metadata: fragment.metadata };
            }
            if (!part) {
                this._logService.warn(`[CHAT](${data.extension.identifier.value}) UNKNOWN part ${JSON.stringify(fragment)}`);
                return;
            }
            sendSoon(part);
        });
        let value;
        try {
            value = data.provider.provideLanguageModelChatResponse(knownModel.info, messages.value.map(typeConvert.LanguageModelChatMessage2.to), { ...options, modelOptions: options.modelOptions ?? {}, requestInitiator: ExtensionIdentifier.toKey(from), toolMode: options.toolMode ?? extHostTypes.LanguageModelChatToolMode.Auto }, progress, token);
        }
        catch (err) {
            // synchronously failed
            throw err;
        }
        Promise.resolve(value).then(() => {
            sendNow();
            this._proxy.$reportResponseDone(requestId, undefined);
        }, err => {
            sendNow();
            this._proxy.$reportResponseDone(requestId, transformErrorForSerialization(err));
        });
    }
    //#region --- token counting
    $provideTokenLength(modelId, value, token) {
        const knownModel = this._localModels.get(modelId);
        if (!knownModel) {
            return Promise.resolve(0);
        }
        const data = this._languageModelProviders.get(knownModel.metadata.vendor);
        if (!data) {
            return Promise.resolve(0);
        }
        return Promise.resolve(data.provider.provideTokenCount(knownModel.info, value, token));
    }
    //#region --- making request
    async getDefaultLanguageModel(extension, forceResolveModels) {
        let defaultModelId;
        if (forceResolveModels) {
            await this.selectLanguageModels(extension, {});
        }
        for (const [modelIdentifier, modelData] of this._localModels) {
            if (modelData.metadata.isDefault) {
                defaultModelId = modelIdentifier;
                break;
            }
        }
        if (!defaultModelId && !forceResolveModels) {
            // Maybe the default wasn't cached so we will try again with resolving the models too
            return this.getDefaultLanguageModel(extension, true);
        }
        return this.getLanguageModelByIdentifier(extension, defaultModelId);
    }
    async getLanguageModelByIdentifier(extension, modelId) {
        if (!modelId) {
            return undefined;
        }
        const model = this._localModels.get(modelId);
        if (!model) {
            // model gone? is this an error on us? Try to resolve model again
            return (await this.selectLanguageModels(extension, { id: modelId }))[0];
        }
        // make sure auth information is correct
        if (this._isUsingAuth(extension.identifier, model.metadata)) {
            await this._fakeAuthPopulate(model.metadata);
        }
        let apiObject;
        if (!apiObject) {
            const that = this;
            apiObject = {
                id: model.info.id,
                vendor: model.metadata.vendor,
                family: model.info.family,
                version: model.info.version,
                name: model.info.name,
                capabilities: {
                    supportsImageToText: model.metadata.capabilities?.vision ?? false,
                    supportsToolCalling: !!model.metadata.capabilities?.toolCalling,
                    editToolsHint: model.metadata.capabilities?.editTools,
                },
                maxInputTokens: model.metadata.maxInputTokens,
                countTokens(text, token) {
                    if (!that._localModels.has(modelId)) {
                        throw extHostTypes.LanguageModelError.NotFound(modelId);
                    }
                    return that._computeTokenLength(modelId, text, token ?? CancellationToken.None);
                },
                sendRequest(messages, options, token) {
                    if (!that._localModels.has(modelId)) {
                        throw extHostTypes.LanguageModelError.NotFound(modelId);
                    }
                    return that._sendChatRequest(extension, modelId, messages, options ?? {}, token ?? CancellationToken.None);
                }
            };
            Object.freeze(apiObject);
        }
        return apiObject;
    }
    async selectLanguageModels(extension, selector) {
        // this triggers extension activation
        const models = await this._proxy.$selectChatModels({ ...selector, extension: extension.identifier });
        const result = [];
        const modelPromises = models.map(identifier => this.getLanguageModelByIdentifier(extension, identifier));
        const modelResults = await Promise.all(modelPromises);
        for (const model of modelResults) {
            if (model) {
                result.push(model);
            }
        }
        return result;
    }
    async _sendChatRequest(extension, languageModelId, messages, options, token) {
        const internalMessages = this._convertMessages(extension, messages);
        const from = extension.identifier;
        const metadata = this._localModels.get(languageModelId)?.metadata;
        if (!metadata || !this._localModels.has(languageModelId)) {
            throw extHostTypes.LanguageModelError.NotFound(`Language model '${languageModelId}' is unknown.`);
        }
        if (this._isUsingAuth(from, metadata)) {
            const success = await this._getAuthAccess(extension, { identifier: metadata.extension, displayName: metadata.auth.providerLabel }, options.justification, false);
            if (!success || !this._modelAccessList.get(from)?.has(metadata.extension)) {
                throw extHostTypes.LanguageModelError.NoPermissions(`Language model '${languageModelId}' cannot be used by '${from.value}'.`);
            }
        }
        const requestId = (Math.random() * 1e6) | 0;
        const res = new LanguageModelResponse();
        this._pendingRequest.set(requestId, { languageModelId, res });
        try {
            await this._proxy.$tryStartChatRequest(from, languageModelId, requestId, new SerializableObjectWithBuffers(internalMessages), options, token);
        }
        catch (error) {
            // error'ing here means that the request could NOT be started/made, e.g. wrong model, no access, etc, but
            // later the response can fail as well. Those failures are communicated via the stream-object
            this._pendingRequest.delete(requestId);
            throw extHostTypes.LanguageModelError.tryDeserialize(error) ?? error;
        }
        return res.apiObject;
    }
    _convertMessages(extension, messages) {
        const internalMessages = [];
        for (const message of messages) {
            if (message.role === extHostTypes.LanguageModelChatMessageRole.System) {
                checkProposedApiEnabled(extension, 'languageModelSystem');
            }
            internalMessages.push(typeConvert.LanguageModelChatMessage2.from(message));
        }
        return internalMessages;
    }
    async $acceptResponsePart(requestId, chunk) {
        const data = this._pendingRequest.get(requestId);
        if (data) {
            data.res.handleResponsePart(chunk.value);
        }
    }
    async $acceptResponseDone(requestId, error) {
        const data = this._pendingRequest.get(requestId);
        if (!data) {
            return;
        }
        this._pendingRequest.delete(requestId);
        if (error) {
            // we error the stream because that's the only way to signal
            // that the request has failed
            data.res.reject(extHostTypes.LanguageModelError.tryDeserialize(error) ?? transformErrorFromSerialization(error));
        }
        else {
            data.res.resolve();
        }
    }
    // BIG HACK: Using AuthenticationProviders to check access to Language Models
    async _getAuthAccess(from, to, justification, silent) {
        // This needs to be done in both MainThread & ExtHost ChatProvider
        const providerId = INTERNAL_AUTH_PROVIDER_PREFIX + to.identifier.value;
        const session = await this._extHostAuthentication.getSession(from, providerId, [], { silent: true });
        if (session) {
            this.$updateModelAccesslist([{ from: from.identifier, to: to.identifier, enabled: true }]);
            return true;
        }
        if (silent) {
            return false;
        }
        try {
            const detail = justification
                ? localize('chatAccessWithJustification', "Justification: {1}", to.displayName, justification)
                : undefined;
            await this._extHostAuthentication.getSession(from, providerId, [], { forceNewSession: { detail } });
            this.$updateModelAccesslist([{ from: from.identifier, to: to.identifier, enabled: true }]);
            return true;
        }
        catch (err) {
            // ignore
            return false;
        }
    }
    _isUsingAuth(from, toMetadata) {
        // If the 'to' extension uses an auth check
        return !!toMetadata.auth
            // And we're asking from a different extension
            && !ExtensionIdentifier.equals(toMetadata.extension, from);
    }
    async _fakeAuthPopulate(metadata) {
        if (!metadata.auth) {
            return;
        }
        for (const from of this._languageAccessInformationExtensions) {
            try {
                await this._getAuthAccess(from, { identifier: metadata.extension, displayName: '' }, undefined, true);
            }
            catch (err) {
                this._logService.error('Fake Auth request failed');
                this._logService.error(err);
            }
        }
    }
    async _computeTokenLength(modelId, value, token) {
        const data = this._localModels.get(modelId);
        if (!data) {
            throw extHostTypes.LanguageModelError.NotFound(`Language model '${modelId}' is unknown.`);
        }
        return this._languageModelProviders.get(data.metadata.vendor)?.provider.provideTokenCount(data.info, value, token) ?? 0;
        // return this._proxy.$countTokens(languageModelId, (typeof value === 'string' ? value : typeConvert.LanguageModelChatMessage2.from(value)), token);
    }
    $updateModelAccesslist(data) {
        const updated = new Array();
        for (const { from, to, enabled } of data) {
            const set = this._modelAccessList.get(from) ?? new ExtensionIdentifierSet();
            const oldValue = set.has(to);
            if (oldValue !== enabled) {
                if (enabled) {
                    set.add(to);
                }
                else {
                    set.delete(to);
                }
                this._modelAccessList.set(from, set);
                const newItem = { from, to };
                updated.push(newItem);
                this._onDidChangeModelAccess.fire(newItem);
            }
        }
    }
    createLanguageModelAccessInformation(from) {
        this._languageAccessInformationExtensions.add(from);
        // const that = this;
        const _onDidChangeAccess = Event.signal(Event.filter(this._onDidChangeModelAccess.event, e => ExtensionIdentifier.equals(e.from, from.identifier)));
        const _onDidAddRemove = Event.signal(this._onDidChangeProviders.event);
        return {
            get onDidChange() {
                return Event.any(_onDidChangeAccess, _onDidAddRemove);
            },
            canSendRequest(chat) {
                return true;
                // TODO @lramos15 - Fix
                // let metadata: ILanguageModelChatMetadata | undefined;
                // out: for (const [_, value] of that._allLanguageModelData) {
                // 	for (const candidate of value.apiObjects.values()) {
                // 		if (candidate === chat) {
                // 			metadata = value.metadata;
                // 			break out;
                // 		}
                // 	}
                // }
                // if (!metadata) {
                // 	return undefined;
                // }
                // if (!that._isUsingAuth(from.identifier, metadata)) {
                // 	return true;
                // }
                // const list = that._modelAccessList.get(from.identifier);
                // if (!list) {
                // 	return undefined;
                // }
                // return list.has(metadata.extension);
            }
        };
    }
    fileIsIgnored(extension, uri, token = CancellationToken.None) {
        checkProposedApiEnabled(extension, 'chatParticipantAdditions');
        return this._proxy.$fileIsIgnored(uri, token);
    }
    get isModelProxyAvailable() {
        return !!this._languageModelProxyProvider;
    }
    async getModelProxy(extension) {
        checkProposedApiEnabled(extension, 'languageModelProxy');
        if (!this._languageModelProxyProvider) {
            this._logService.trace('[LanguageModelProxy] No LanguageModelProxyProvider registered');
            throw new Error('No language model proxy provider is registered.');
        }
        const requestingExtensionId = ExtensionIdentifier.toKey(extension.identifier);
        try {
            const result = await Promise.resolve(this._languageModelProxyProvider.provideModelProxy(requestingExtensionId, CancellationToken.None));
            if (!result) {
                this._logService.warn(`[LanguageModelProxy] Provider returned no proxy for ${requestingExtensionId}`);
                throw new Error('Language model proxy is not available.');
            }
            return result;
        }
        catch (err) {
            this._logService.error(`[LanguageModelProxy] Provider failed to return proxy for ${requestingExtensionId}`, err);
            throw err;
        }
    }
    async $isFileIgnored(handle, uri, token) {
        const provider = this._ignoredFileProviders.get(handle);
        if (!provider) {
            throw new Error('Unknown LanguageModelIgnoredFileProvider');
        }
        return (await provider.provideFileIgnored(URI.revive(uri), token)) ?? false;
    }
    registerIgnoredFileProvider(extension, provider) {
        checkProposedApiEnabled(extension, 'chatParticipantPrivate');
        const handle = ExtHostLanguageModels_1._idPool++;
        this._proxy.$registerFileIgnoreProvider(handle);
        this._ignoredFileProviders.set(handle, provider);
        return toDisposable(() => {
            this._proxy.$unregisterFileIgnoreProvider(handle);
            this._ignoredFileProviders.delete(handle);
        });
    }
    registerLanguageModelProxyProvider(extension, provider) {
        checkProposedApiEnabled(extension, 'chatParticipantPrivate');
        this._languageModelProxyProvider = provider;
        this._onDidChangeModelProxyAvailability.fire();
        return toDisposable(() => {
            if (this._languageModelProxyProvider === provider) {
                this._languageModelProxyProvider = undefined;
                this._onDidChangeModelProxyAvailability.fire();
            }
        });
    }
};
ExtHostLanguageModels = ExtHostLanguageModels_1 = __decorate([
    __param(0, IExtHostRpcService),
    __param(1, ILogService),
    __param(2, IExtHostAuthentication)
], ExtHostLanguageModels);
export { ExtHostLanguageModels };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdExhbmd1YWdlTW9kZWxzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvY29tbW9uL2V4dEhvc3RMYW5ndWFnZU1vZGVscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLG1CQUFtQixFQUFFLGdCQUFnQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDN0csT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pFLE9BQU8sRUFBbUIsOEJBQThCLEVBQUUsK0JBQStCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNsSSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM1RCxPQUFPLEVBQWUsWUFBWSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUUsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSw2QkFBNkIsQ0FBQztBQUNqRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDM0MsT0FBTyxFQUFFLG1CQUFtQixFQUFFLHNCQUFzQixFQUFFLHNCQUFzQixFQUF5QixNQUFNLG1EQUFtRCxDQUFDO0FBQy9KLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBRXpFLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzNHLE9BQU8s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