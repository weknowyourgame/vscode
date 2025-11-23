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
import { AsyncIterableSource, DeferredPromise } from '../../../base/common/async.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { toErrorMessage } from '../../../base/common/errorMessage.js';
import { transformErrorForSerialization, transformErrorFromSerialization } from '../../../base/common/errors.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, DisposableMap, DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { resizeImage } from '../../contrib/chat/browser/imageUtils.js';
import { ILanguageModelIgnoredFilesService } from '../../contrib/chat/common/ignoredFiles.js';
import { ILanguageModelsService } from '../../contrib/chat/common/languageModels.js';
import { IAuthenticationAccessService } from '../../services/authentication/browser/authenticationAccessService.js';
import { IAuthenticationService, INTERNAL_AUTH_PROVIDER_PREFIX } from '../../services/authentication/common/authentication.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { IExtensionService } from '../../services/extensions/common/extensions.js';
import { SerializableObjectWithBuffers } from '../../services/extensions/common/proxyIdentifier.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { LanguageModelError } from '../common/extHostTypes.js';
let MainThreadLanguageModels = class MainThreadLanguageModels {
    constructor(extHostContext, _chatProviderService, _logService, _authenticationService, _authenticationAccessService, _extensionService, _ignoredFilesService) {
        this._chatProviderService = _chatProviderService;
        this._logService = _logService;
        this._authenticationService = _authenticationService;
        this._authenticationAccessService = _authenticationAccessService;
        this._extensionService = _extensionService;
        this._ignoredFilesService = _ignoredFilesService;
        this._store = new DisposableStore();
        this._providerRegistrations = new DisposableMap();
        this._lmProviderChange = new Emitter();
        this._pendingProgress = new Map();
        this._ignoredFileProviderRegistrations = new DisposableMap();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostChatProvider);
    }
    dispose() {
        this._lmProviderChange.dispose();
        this._providerRegistrations.dispose();
        this._ignoredFileProviderRegistrations.dispose();
        this._store.dispose();
    }
    $registerLanguageModelProvider(vendor) {
        const disposables = new DisposableStore();
        try {
            disposables.add(this._chatProviderService.registerLanguageModelProvider(vendor, {
                onDidChange: Event.filter(this._lmProviderChange.event, e => e.vendor === vendor, disposables),
                provideLanguageModelChatInfo: async (options, token) => {
                    const modelsAndIdentifiers = await this._proxy.$provideLanguageModelChatInfo(vendor, options, token);
                    modelsAndIdentifiers.forEach(m => {
                        if (m.metadata.auth) {
                            disposables.add(this._registerAuthenticationProvider(m.metadata.extension, m.metadata.auth));
                        }
                    });
                    return modelsAndIdentifiers;
                },
                sendChatRequest: async (modelId, messages, from, options, token) => {
                    const requestId = (Math.random() * 1e6) | 0;
                    const defer = new DeferredPromise();
                    const stream = new AsyncIterableSource();
                    try {
                        this._pendingProgress.set(requestId, { defer, stream });
                        await Promise.all(messages.flatMap(msg => msg.content)
                            .filter(part => part.type === 'image_url')
                            .map(async (part) => {
                            part.value.data = VSBuffer.wrap(await resizeImage(part.value.data.buffer));
                        }));
                        await this._proxy.$startChatRequest(modelId, requestId, from, new SerializableObjectWithBuffers(messages), options, token);
                    }
                    catch (err) {
                        this._pendingProgress.delete(requestId);
                        throw err;
                    }
                    return {
                        result: defer.p,
                        stream: stream.asyncIterable
                    };
                },
                provideTokenCount: (modelId, str, token) => {
                    return this._proxy.$provideTokenLength(modelId, str, token);
                },
            }));
            this._providerRegistrations.set(vendor, disposables);
        }
        catch (err) {
            disposables.dispose();
            throw err;
        }
    }
    $onLMProviderChange(vendor) {
        this._lmProviderChange.fire({ vendor });
    }
    async $reportResponsePart(requestId, chunk) {
        const data = this._pendingProgress.get(requestId);
        this._logService.trace('[LM] report response PART', Boolean(data), requestId, chunk);
        if (data) {
            data.stream.emitOne(chunk.value);
        }
    }
    async $reportResponseDone(requestId, err) {
        const data = this._pendingProgress.get(requestId);
        this._logService.trace('[LM] report response DONE', Boolean(data), requestId, err);
        if (data) {
            this._pendingProgress.delete(requestId);
            if (err) {
                const error = LanguageModelError.tryDeserialize(err) ?? transformErrorFromSerialization(err);
                data.stream.reject(error);
                data.defer.error(error);
            }
            else {
                data.stream.resolve();
                data.defer.complete(undefined);
            }
        }
    }
    $unregisterProvider(vendor) {
        this._providerRegistrations.deleteAndDispose(vendor);
    }
    $selectChatModels(selector) {
        return this._chatProviderService.selectLanguageModels(selector);
    }
    async $tryStartChatRequest(extension, modelIdentifier, requestId, messages, options, token) {
        this._logService.trace('[CHAT] request STARTED', extension.value, requestId);
        let response;
        try {
            response = await this._chatProviderService.sendChatRequest(modelIdentifier, extension, messages.value, options, token);
        }
        catch (err) {
            this._logService.error('[CHAT] request FAILED', extension.value, requestId, err);
            throw err;
        }
        // !!! IMPORTANT !!!
        // This method must return before the response is done (has streamed all parts)
        // and because of that we consume the stream without awaiting
        // !!! IMPORTANT !!!
        const streaming = (async () => {
            try {
                for await (const part of response.stream) {
                    this._logService.trace('[CHAT] request PART', extension.value, requestId, part);
                    await this._proxy.$acceptResponsePart(requestId, new SerializableObjectWithBuffers(part));
                }
                this._logService.trace('[CHAT] request DONE', extension.value, requestId);
            }
            catch (err) {
                this._logService.error('[CHAT] extension request ERRORED in STREAM', toErrorMessage(err, true), extension.value, requestId);
                this._proxy.$acceptResponseDone(requestId, transformErrorForSerialization(err));
            }
        })();
        // When the response is done (signaled via its result) we tell the EH
        Promise.allSettled([response.result, streaming]).then(() => {
            this._logService.debug('[CHAT] extension request DONE', extension.value, requestId);
            this._proxy.$acceptResponseDone(requestId, undefined);
        }, err => {
            this._logService.error('[CHAT] extension request ERRORED', toErrorMessage(err, true), extension.value, requestId);
            this._proxy.$acceptResponseDone(requestId, transformErrorForSerialization(err));
        });
    }
    $countTokens(modelId, value, token) {
        return this._chatProviderService.computeTokenLength(modelId, value, token);
    }
    _registerAuthenticationProvider(extension, auth) {
        // This needs to be done in both MainThread & ExtHost ChatProvider
        const authProviderId = INTERNAL_AUTH_PROVIDER_PREFIX + extension.value;
        // Only register one auth provider per extension
        if (this._authenticationService.getProviderIds().includes(authProviderId)) {
            return Disposable.None;
        }
        const accountLabel = auth.accountLabel ?? localize('languageModelsAccountId', 'Language Models');
        const disposables = new DisposableStore();
        this._authenticationService.registerAuthenticationProvider(authProviderId, new LanguageModelAccessAuthProvider(authProviderId, auth.providerLabel, accountLabel));
        disposables.add(toDisposable(() => {
            this._authenticationService.unregisterAuthenticationProvider(authProviderId);
        }));
        disposables.add(this._authenticationAccessService.onDidChangeExtensionSessionAccess(async (e) => {
            const allowedExtensions = this._authenticationAccessService.readAllowedExtensions(authProviderId, accountLabel);
            const accessList = [];
            for (const allowedExtension of allowedExtensions) {
                const from = await this._extensionService.getExtension(allowedExtension.id);
                if (from) {
                    accessList.push({
                        from: from.identifier,
                        to: extension,
                        enabled: allowedExtension.allowed ?? true
                    });
                }
            }
            this._proxy.$updateModelAccesslist(accessList);
        }));
        return disposables;
    }
    $fileIsIgnored(uri, token) {
        return this._ignoredFilesService.fileIsIgnored(URI.revive(uri), token);
    }
    $registerFileIgnoreProvider(handle) {
        this._ignoredFileProviderRegistrations.set(handle, this._ignoredFilesService.registerIgnoredFileProvider({
            isFileIgnored: async (uri, token) => this._proxy.$isFileIgnored(handle, uri, token)
        }));
    }
    $unregisterFileIgnoreProvider(handle) {
        this._ignoredFileProviderRegistrations.deleteAndDispose(handle);
    }
};
MainThreadLanguageModels = __decorate([
    extHostNamedCustomer(MainContext.MainThreadLanguageModels),
    __param(1, ILanguageModelsService),
    __param(2, ILogService),
    __param(3, IAuthenticationService),
    __param(4, IAuthenticationAccessService),
    __param(5, IExtensionService),
    __param(6, ILanguageModelIgnoredFilesService)
], MainThreadLanguageModels);
export { MainThreadLanguageModels };
// The fake AuthenticationProvider that will be used to gate access to the Language Model. There will be one per provider.
class LanguageModelAccessAuthProvider {
    constructor(id, label, _accountLabel) {
        this.id = id;
        this.label = label;
        this._accountLabel = _accountLabel;
        this.supportsMultipleAccounts = false;
        // Important for updating the UI
        this._onDidChangeSessions = new Emitter();
        this.onDidChangeSessions = this._onDidChangeSessions.event;
    }
    async getSessions(scopes) {
        // If there are no scopes and no session that means no extension has requested a session yet
        // and the user is simply opening the Account menu. In that case, we should not return any "sessions".
        if (scopes === undefined && !this._session) {
            return [];
        }
        if (this._session) {
            return [this._session];
        }
        return [await this.createSession(scopes || [])];
    }
    async createSession(scopes) {
        this._session = this._createFakeSession(scopes);
        this._onDidChangeSessions.fire({ added: [this._session], changed: [], removed: [] });
        return this._session;
    }
    removeSession(sessionId) {
        if (this._session) {
            this._onDidChangeSessions.fire({ added: [], changed: [], removed: [this._session] });
            this._session = undefined;
        }
        return Promise.resolve();
    }
    confirmation(extensionName, _recreatingSession) {
        return localize('confirmLanguageModelAccess', "The extension '{0}' wants to access the language models provided by {1}.", extensionName, this.label);
    }
    _createFakeSession(scopes) {
        return {
            id: 'fake-session',
            account: {
                id: this.id,
                label: this._accountLabel,
            },
            accessToken: 'fake-access-token',
            scopes,
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZExhbmd1YWdlTW9kZWxzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvYnJvd3Nlci9tYWluVGhyZWFkTGFuZ3VhZ2VNb2RlbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLGVBQWUsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3JGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUUxRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdEUsT0FBTyxFQUFtQiw4QkFBOEIsRUFBRSwrQkFBK0IsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ2xJLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFlLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzFILE9BQU8sRUFBRSxHQUFHLEVBQWlCLE1BQU0sNkJBQTZCLENBQUM7QUFDakUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBRTNDLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDdkUsT0FBTyxFQUFFLGlDQUFpQyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDOUYsT0FBTyxFQUEyRixzQkFBc0IsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzlLLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLHNFQUFzRSxDQUFDO0FBQ3BILE9BQU8sRUFBcUYsc0JBQXNCLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUNsTixPQUFPLEVBQW1CLG9CQUFvQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDN0csT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDbkYsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0scURBQXFELENBQUM7QUFDcEcsT0FBTyxFQUFFLGNBQWMsRUFBOEIsV0FBVyxFQUFpQyxNQUFNLCtCQUErQixDQUFDO0FBQ3ZJLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBR3hELElBQU0sd0JBQXdCLEdBQTlCLE1BQU0sd0JBQXdCO0lBU3BDLFlBQ0MsY0FBK0IsRUFDUCxvQkFBNkQsRUFDeEUsV0FBeUMsRUFDOUIsc0JBQStELEVBQ3pELDRCQUEyRSxFQUN0RixpQkFBcUQsRUFDckMsb0JBQXdFO1FBTGxFLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBd0I7UUFDdkQsZ0JBQVcsR0FBWCxXQUFXLENBQWE7UUFDYiwyQkFBc0IsR0FBdEIsc0JBQXNCLENBQXdCO1FBQ3hDLGlDQUE0QixHQUE1Qiw0QkFBNEIsQ0FBOEI7UUFDckUsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFtQjtRQUNwQix5QkFBb0IsR0FBcEIsb0JBQW9CLENBQW1DO1FBYjNGLFdBQU0sR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQy9CLDJCQUFzQixHQUFHLElBQUksYUFBYSxFQUFVLENBQUM7UUFDckQsc0JBQWlCLEdBQUcsSUFBSSxPQUFPLEVBQXNCLENBQUM7UUFDdEQscUJBQWdCLEdBQUcsSUFBSSxHQUFHLEVBQXFILENBQUM7UUFDaEosc0NBQWlDLEdBQUcsSUFBSSxhQUFhLEVBQVUsQ0FBQztRQVdoRixJQUFJLENBQUMsTUFBTSxHQUFHLGNBQWMsQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDM0UsQ0FBQztJQUVELE9BQU87UUFDTixJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDakMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3RDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNqRCxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCw4QkFBOEIsQ0FBQyxNQUFjO1FBQzVDLE1BQU0sV0FBVyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFDMUMsSUFBSSxDQUFDO1lBQ0osV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsNkJBQTZCLENBQUMsTUFBTSxFQUFFO2dCQUMvRSxXQUFXLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxNQUFNLEVBQUUsV0FBVyxDQUEyQjtnQkFDeEgsNEJBQTRCLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsRUFBRTtvQkFDdEQsTUFBTSxvQkFBb0IsR0FBRyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsNkJBQTZCLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztvQkFDckcsb0JBQW9CLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO3dCQUNoQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7NEJBQ3JCLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLCtCQUErQixDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzt3QkFDOUYsQ0FBQztvQkFDRixDQUFDLENBQUMsQ0FBQztvQkFDSCxPQUFPLG9CQUFvQixDQUFDO2dCQUM3QixDQUFDO2dCQUNELGVBQWUsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxFQUFFO29CQUNsRSxNQUFNLFNBQVMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQzVDLE1BQU0sS0FBSyxHQUFHLElBQUksZUFBZSxFQUFXLENBQUM7b0JBQzdDLE1BQU0sTUFBTSxHQUFHLElBQUksbUJBQW1CLEVBQTJDLENBQUM7b0JBRWxGLElBQUksQ0FBQzt3QkFDSixJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO3dCQUN4RCxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQ2hCLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDOzZCQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLFdBQVcsQ0FBQzs2QkFDekMsR0FBRyxDQUFDLEtBQUssRUFBQyxJQUFJLEVBQUMsRUFBRTs0QkFDakIsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO3dCQUM1RSxDQUFDLENBQUMsQ0FDSCxDQUFDO3dCQUNGLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLDZCQUE2QixDQUFDLFFBQVEsQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztvQkFDNUgsQ0FBQztvQkFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO3dCQUNkLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7d0JBQ3hDLE1BQU0sR0FBRyxDQUFDO29CQUNYLENBQUM7b0JBRUQsT0FBTzt3QkFDTixNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7d0JBQ2YsTUFBTSxFQUFFLE1BQU0sQ0FBQyxhQUFhO3FCQUNTLENBQUM7Z0JBQ3hDLENBQUM7Z0JBQ0QsaUJBQWlCLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxFQUFFO29CQUMxQyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDN0QsQ0FBQzthQUNELENBQUMsQ0FBQyxDQUFDO1lBQ0osSUFBSSxDQUFDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDdEQsQ0FBQztRQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7WUFDZCxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdEIsTUFBTSxHQUFHLENBQUM7UUFDWCxDQUFDO0lBQ0YsQ0FBQztJQUVELG1CQUFtQixDQUFDLE1BQWM7UUFDakMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVELEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxTQUFpQixFQUFFLEtBQTZFO1FBQ3pILE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDbEQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsMkJBQTJCLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNyRixJQUFJLElBQUksRUFBRSxDQUFDO1lBQ1YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2xDLENBQUM7SUFDRixDQUFDO0lBRUQsS0FBSyxDQUFDLG1CQUFtQixDQUFDLFNBQWlCLEVBQUUsR0FBZ0M7UUFDNUUsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNsRCxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQywyQkFBMkIsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ25GLElBQUksSUFBSSxFQUFFLENBQUM7WUFDVixJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3hDLElBQUksR0FBRyxFQUFFLENBQUM7Z0JBQ1QsTUFBTSxLQUFLLEdBQUcsa0JBQWtCLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLCtCQUErQixDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUM3RixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDMUIsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDekIsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3RCLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ2hDLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVELG1CQUFtQixDQUFDLE1BQWM7UUFDakMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFRCxpQkFBaUIsQ0FBQyxRQUFvQztRQUNyRCxPQUFPLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRUQsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFNBQThCLEVBQUUsZUFBdUIsRUFBRSxTQUFpQixFQUFFLFFBQXVELEVBQUUsT0FBVyxFQUFFLEtBQXdCO1FBQ3BNLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLHdCQUF3QixFQUFFLFNBQVMsQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFN0UsSUFBSSxRQUFvQyxDQUFDO1FBQ3pDLElBQUksQ0FBQztZQUNKLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxlQUFlLENBQUMsZUFBZSxFQUFFLFNBQVMsRUFBRSxRQUFRLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN4SCxDQUFDO1FBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztZQUNkLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLHVCQUF1QixFQUFFLFNBQVMsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ2pGLE1BQU0sR0FBRyxDQUFDO1FBQ1gsQ0FBQztRQUVELG9CQUFvQjtRQUNwQiwrRUFBK0U7UUFDL0UsNkRBQTZEO1FBQzdELG9CQUFvQjtRQUNwQixNQUFNLFNBQVMsR0FBRyxDQUFDLEtBQUssSUFBSSxFQUFFO1lBQzdCLElBQUksQ0FBQztnQkFDSixJQUFJLEtBQUssRUFBRSxNQUFNLElBQUksSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQzFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLHFCQUFxQixFQUFFLFNBQVMsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO29CQUNoRixNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsU0FBUyxFQUFFLElBQUksNkJBQTZCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDM0YsQ0FBQztnQkFDRCxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsRUFBRSxTQUFTLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzNFLENBQUM7WUFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO2dCQUNkLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLDRDQUE0QyxFQUFFLGNBQWMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEVBQUUsU0FBUyxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztnQkFDNUgsSUFBSSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsOEJBQThCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNqRixDQUFDO1FBQ0YsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUVMLHFFQUFxRTtRQUNyRSxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDMUQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsK0JBQStCLEVBQUUsU0FBUyxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztZQUNwRixJQUFJLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUN2RCxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUU7WUFDUixJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxrQ0FBa0MsRUFBRSxjQUFjLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUFFLFNBQVMsQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDbEgsSUFBSSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsOEJBQThCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNqRixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFHRCxZQUFZLENBQUMsT0FBZSxFQUFFLEtBQTRCLEVBQUUsS0FBd0I7UUFDbkYsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsa0JBQWtCLENBQUMsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztJQUM1RSxDQUFDO0lBRU8sK0JBQStCLENBQUMsU0FBOEIsRUFBRSxJQUFrRTtRQUN6SSxrRUFBa0U7UUFDbEUsTUFBTSxjQUFjLEdBQUcsNkJBQTZCLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQztRQUV2RSxnREFBZ0Q7UUFDaEQsSUFBSSxJQUFJLENBQUMsc0JBQXNCLENBQUMsY0FBYyxFQUFFLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUM7WUFDM0UsT0FBTyxVQUFVLENBQUMsSUFBSSxDQUFDO1FBQ3hCLENBQUM7UUFFRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsWUFBWSxJQUFJLFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1FBQ2pHLE1BQU0sV0FBVyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFDMUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLDhCQUE4QixDQUFDLGNBQWMsRUFBRSxJQUFJLCtCQUErQixDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUM7UUFDbEssV0FBVyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFO1lBQ2pDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxnQ0FBZ0MsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUM5RSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0osV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsNEJBQTRCLENBQUMsaUNBQWlDLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQy9GLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLDRCQUE0QixDQUFDLHFCQUFxQixDQUFDLGNBQWMsRUFBRSxZQUFZLENBQUMsQ0FBQztZQUNoSCxNQUFNLFVBQVUsR0FBRyxFQUFFLENBQUM7WUFDdEIsS0FBSyxNQUFNLGdCQUFnQixJQUFJLGlCQUFpQixFQUFFLENBQUM7Z0JBQ2xELE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDNUUsSUFBSSxJQUFJLEVBQUUsQ0FBQztvQkFDVixVQUFVLENBQUMsSUFBSSxDQUFDO3dCQUNmLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVTt3QkFDckIsRUFBRSxFQUFFLFNBQVM7d0JBQ2IsT0FBTyxFQUFFLGdCQUFnQixDQUFDLE9BQU8sSUFBSSxJQUFJO3FCQUN6QyxDQUFDLENBQUM7Z0JBQ0osQ0FBQztZQUNGLENBQUM7WUFDRCxJQUFJLENBQUMsTUFBTSxDQUFDLHNCQUFzQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2hELENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDSixPQUFPLFdBQVcsQ0FBQztJQUNwQixDQUFDO0lBRUQsY0FBYyxDQUFDLEdBQWtCLEVBQUUsS0FBd0I7UUFDMUQsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDeEUsQ0FBQztJQUVELDJCQUEyQixDQUFDLE1BQWM7UUFDekMsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLDJCQUEyQixDQUFDO1lBQ3hHLGFBQWEsRUFBRSxLQUFLLEVBQUUsR0FBUSxFQUFFLEtBQXdCLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDO1NBQzNHLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELDZCQUE2QixDQUFDLE1BQWM7UUFDM0MsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2pFLENBQUM7Q0FDRCxDQUFBO0FBM01ZLHdCQUF3QjtJQURwQyxvQkFBb0IsQ0FBQyxXQUFXLENBQUMsd0JBQXdCLENBQUM7SUFZeEQsV0FBQSxzQkFBc0IsQ0FBQTtJQUN0QixXQUFBLFdBQVcsQ0FBQTtJQUNYLFdBQUEsc0JBQXNCLENBQUE7SUFDdEIsV0FBQSw0QkFBNEIsQ0FBQTtJQUM1QixXQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFdBQUEsaUNBQWlDLENBQUE7R0FoQnZCLHdCQUF3QixDQTJNcEM7O0FBRUQsMEhBQTBIO0FBQzFILE1BQU0sK0JBQStCO0lBU3BDLFlBQXFCLEVBQVUsRUFBVyxLQUFhLEVBQW1CLGFBQXFCO1FBQTFFLE9BQUUsR0FBRixFQUFFLENBQVE7UUFBVyxVQUFLLEdBQUwsS0FBSyxDQUFRO1FBQW1CLGtCQUFhLEdBQWIsYUFBYSxDQUFRO1FBUi9GLDZCQUF3QixHQUFHLEtBQUssQ0FBQztRQUVqQyxnQ0FBZ0M7UUFDeEIseUJBQW9CLEdBQStDLElBQUksT0FBTyxFQUFxQyxDQUFDO1FBQ25ILHdCQUFtQixHQUE2QyxJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDO0lBSU4sQ0FBQztJQUVwRyxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQTZCO1FBQzlDLDRGQUE0RjtRQUM1RixzR0FBc0c7UUFDdEcsSUFBSSxNQUFNLEtBQUssU0FBUyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQzVDLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ25CLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDeEIsQ0FBQztRQUNELE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUNELEtBQUssQ0FBQyxhQUFhLENBQUMsTUFBZ0I7UUFDbkMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDaEQsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3JGLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUN0QixDQUFDO0lBQ0QsYUFBYSxDQUFDLFNBQWlCO1FBQzlCLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ25CLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNyRixJQUFJLENBQUMsUUFBUSxHQUFHLFNBQVMsQ0FBQztRQUMzQixDQUFDO1FBQ0QsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDMUIsQ0FBQztJQUVELFlBQVksQ0FBQyxhQUFxQixFQUFFLGtCQUEyQjtRQUM5RCxPQUFPLFFBQVEsQ0FBQyw0QkFBNEIsRUFBRSwwRUFBMEUsRUFBRSxhQUFhLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3RKLENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxNQUFnQjtRQUMxQyxPQUFPO1lBQ04sRUFBRSxFQUFFLGNBQWM7WUFDbEIsT0FBTyxFQUFFO2dCQUNSLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtnQkFDWCxLQUFLLEVBQUUsSUFBSSxDQUFDLGFBQWE7YUFDekI7WUFDRCxXQUFXLEVBQUUsbUJBQW1CO1lBQ2hDLE1BQU07U0FDTixDQUFDO0lBQ0gsQ0FBQztDQUNEIn0=