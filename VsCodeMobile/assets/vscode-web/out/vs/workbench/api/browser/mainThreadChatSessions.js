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
import { raceCancellationError } from '../../../base/common/async.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { Emitter } from '../../../base/common/event.js';
import { MarkdownString } from '../../../base/common/htmlContent.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../base/common/map.js';
import { revive } from '../../../base/common/marshalling.js';
import { autorun, observableValue } from '../../../base/common/observable.js';
import { isEqual } from '../../../base/common/resources.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { IDialogService } from '../../../platform/dialogs/common/dialogs.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { ChatEditorInput } from '../../contrib/chat/browser/chatEditorInput.js';
import { IChatService } from '../../contrib/chat/common/chatService.js';
import { IChatSessionsService } from '../../contrib/chat/common/chatSessionsService.js';
import { IEditorGroupsService } from '../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../services/editor/common/editorService.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
export class ObservableChatSession extends Disposable {
    get options() {
        return this._options;
    }
    get progressObs() {
        return this._progressObservable;
    }
    get isCompleteObs() {
        return this._isCompleteObservable;
    }
    constructor(resource, providerHandle, proxy, logService, dialogService) {
        super();
        this._progressObservable = observableValue(this, []);
        this._isCompleteObservable = observableValue(this, false);
        this._onWillDispose = new Emitter();
        this.onWillDispose = this._onWillDispose.event;
        this._pendingProgressChunks = new Map();
        this._isInitialized = false;
        this._interruptionWasCanceled = false;
        this._disposalPending = false;
        this.sessionResource = resource;
        this.providerHandle = providerHandle;
        this.history = [];
        this._proxy = proxy;
        this._providerHandle = providerHandle;
        this._logService = logService;
        this._dialogService = dialogService;
    }
    initialize(token) {
        if (!this._initializationPromise) {
            this._initializationPromise = this._doInitializeContent(token);
        }
        return this._initializationPromise;
    }
    async _doInitializeContent(token) {
        try {
            const sessionContent = await raceCancellationError(this._proxy.$provideChatSessionContent(this._providerHandle, this.sessionResource, token), token);
            this._options = sessionContent.options;
            this.history.length = 0;
            this.history.push(...sessionContent.history.map((turn) => {
                if (turn.type === 'request') {
                    const variables = turn.variableData?.variables.map(v => {
                        const entry = {
                            ...v,
                            value: revive(v.value)
                        };
                        return entry;
                    });
                    return {
                        type: 'request',
                        prompt: turn.prompt,
                        participant: turn.participant,
                        command: turn.command,
                        variableData: variables ? { variables } : undefined
                    };
                }
                return {
                    type: 'response',
                    parts: turn.parts.map((part) => revive(part)),
                    participant: turn.participant
                };
            }));
            if (sessionContent.hasActiveResponseCallback && !this.interruptActiveResponseCallback) {
                this.interruptActiveResponseCallback = async () => {
                    const confirmInterrupt = () => {
                        if (this._disposalPending) {
                            this._proxy.$disposeChatSessionContent(this._providerHandle, this.sessionResource);
                            this._disposalPending = false;
                        }
                        this._proxy.$interruptChatSessionActiveResponse(this._providerHandle, this.sessionResource, 'ongoing');
                        return true;
                    };
                    if (sessionContent.supportsInterruption) {
                        // If the session supports hot reload, interrupt without confirmation
                        return confirmInterrupt();
                    }
                    // Prompt the user to confirm interruption
                    return this._dialogService.confirm({
                        message: localize('interruptActiveResponse', 'Are you sure you want to interrupt the active session?')
                    }).then(confirmed => {
                        if (confirmed.confirmed) {
                            // User confirmed interruption - dispose the session content on extension host
                            return confirmInterrupt();
                        }
                        else {
                            // When user cancels the interruption, fire an empty progress message to keep the session alive
                            // This matches the behavior of the old implementation
                            this._addProgress([{
                                    kind: 'progressMessage',
                                    content: { value: '', isTrusted: false }
                                }]);
                            // Set flag to prevent completion when extension host calls handleProgressComplete
                            this._interruptionWasCanceled = true;
                            // User canceled interruption - cancel the deferred disposal
                            if (this._disposalPending) {
                                this._logService.info(`Canceling deferred disposal for session ${this.sessionResource} (user canceled interruption)`);
                                this._disposalPending = false;
                            }
                            return false;
                        }
                    });
                };
            }
            if (sessionContent.hasRequestHandler && !this.requestHandler) {
                this.requestHandler = async (request, progress, history, token) => {
                    // Clear previous progress and mark as active
                    this._progressObservable.set([], undefined);
                    this._isCompleteObservable.set(false, undefined);
                    // Set up reactive progress observation before starting the request
                    let lastProgressLength = 0;
                    const progressDisposable = autorun(reader => {
                        const progressArray = this._progressObservable.read(reader);
                        const isComplete = this._isCompleteObservable.read(reader);
                        if (progressArray.length > lastProgressLength) {
                            const newProgress = progressArray.slice(lastProgressLength);
                            progress(newProgress);
                            lastProgressLength = progressArray.length;
                        }
                        if (isComplete) {
                            progressDisposable.dispose();
                        }
                    });
                    try {
                        await this._proxy.$invokeChatSessionRequestHandler(this._providerHandle, this.sessionResource, request, history, token);
                        // Only mark as complete if there's no active response callback
                        // Sessions with active response callbacks should only complete when explicitly told to via handleProgressComplete
                        if (!this._isCompleteObservable.get() && !this.interruptActiveResponseCallback) {
                            this._markComplete();
                        }
                    }
                    catch (error) {
                        const errorProgress = {
                            kind: 'progressMessage',
                            content: { value: `Error: ${error instanceof Error ? error.message : String(error)}`, isTrusted: false }
                        };
                        this._addProgress([errorProgress]);
                        this._markComplete();
                        throw error;
                    }
                    finally {
                        // Ensure progress observation is cleaned up
                        progressDisposable.dispose();
                    }
                };
            }
            this._isInitialized = true;
            // Process any pending progress chunks
            const hasActiveResponse = sessionContent.hasActiveResponseCallback;
            const hasRequestHandler = sessionContent.hasRequestHandler;
            const hasAnyCapability = hasActiveResponse || hasRequestHandler;
            for (const [requestId, chunks] of this._pendingProgressChunks) {
                this._logService.debug(`Processing ${chunks.length} pending progress chunks for session ${this.sessionResource}, requestId ${requestId}`);
                this._addProgress(chunks);
            }
            this._pendingProgressChunks.clear();
            // If session has no active response callback and no request handler, mark it as complete
            if (!hasAnyCapability) {
                this._isCompleteObservable.set(true, undefined);
            }
        }
        catch (error) {
            this._logService.error(`Failed to initialize chat session ${this.sessionResource}:`, error);
            throw error;
        }
    }
    /**
     * Handle progress chunks coming from the extension host.
     * If the session is not initialized yet, the chunks will be queued.
     */
    handleProgressChunk(requestId, progress) {
        if (!this._isInitialized) {
            const existing = this._pendingProgressChunks.get(requestId) || [];
            this._pendingProgressChunks.set(requestId, [...existing, ...progress]);
            this._logService.debug(`Queuing ${progress.length} progress chunks for session ${this.sessionResource}, requestId ${requestId} (session not initialized)`);
            return;
        }
        this._addProgress(progress);
    }
    /**
     * Handle progress completion from the extension host.
     */
    handleProgressComplete(requestId) {
        // Clean up any pending chunks for this request
        this._pendingProgressChunks.delete(requestId);
        if (this._isInitialized) {
            // Don't mark as complete if user canceled the interruption
            if (!this._interruptionWasCanceled) {
                this._markComplete();
            }
            else {
                // Reset the flag and don't mark as complete
                this._interruptionWasCanceled = false;
            }
        }
    }
    _addProgress(progress) {
        const currentProgress = this._progressObservable.get();
        this._progressObservable.set([...currentProgress, ...progress], undefined);
    }
    _markComplete() {
        if (!this._isCompleteObservable.get()) {
            this._isCompleteObservable.set(true, undefined);
        }
    }
    dispose() {
        this._onWillDispose.fire();
        this._onWillDispose.dispose();
        this._pendingProgressChunks.clear();
        // If this session has an active response callback and disposal is happening,
        // defer the actual session content disposal until we know the user's choice
        if (this.interruptActiveResponseCallback && !this._interruptionWasCanceled) {
            this._disposalPending = true;
            // The actual disposal will happen in the interruption callback based on user's choice
        }
        else {
            // No active response callback or user already canceled interruption - dispose immediately
            this._proxy.$disposeChatSessionContent(this._providerHandle, this.sessionResource);
        }
        super.dispose();
    }
}
let MainThreadChatSessions = class MainThreadChatSessions extends Disposable {
    constructor(_extHostContext, _chatSessionsService, _chatService, _dialogService, _editorService, editorGroupService, _logService) {
        super();
        this._extHostContext = _extHostContext;
        this._chatSessionsService = _chatSessionsService;
        this._chatService = _chatService;
        this._dialogService = _dialogService;
        this._editorService = _editorService;
        this.editorGroupService = editorGroupService;
        this._logService = _logService;
        this._itemProvidersRegistrations = this._register(new DisposableMap());
        this._contentProvidersRegistrations = this._register(new DisposableMap());
        this._sessionTypeToHandle = new Map();
        this._activeSessions = new ResourceMap();
        this._sessionDisposables = new ResourceMap();
        this._proxy = this._extHostContext.getProxy(ExtHostContext.ExtHostChatSessions);
        this._chatSessionsService.setOptionsChangeCallback(async (sessionResource, updates) => {
            const handle = this._getHandleForSessionType(sessionResource.scheme);
            if (handle !== undefined) {
                await this.notifyOptionsChange(handle, sessionResource, updates);
            }
        });
    }
    _getHandleForSessionType(chatSessionType) {
        return this._sessionTypeToHandle.get(chatSessionType);
    }
    $registerChatSessionItemProvider(handle, chatSessionType) {
        // Register the provider handle - this tracks that a provider exists
        const disposables = new DisposableStore();
        const changeEmitter = disposables.add(new Emitter());
        const provider = {
            chatSessionType,
            onDidChangeChatSessionItems: changeEmitter.event,
            provideChatSessionItems: (token) => this._provideChatSessionItems(handle, token),
            provideNewChatSessionItem: (options, token) => this._provideNewChatSessionItem(handle, options, token)
        };
        disposables.add(this._chatSessionsService.registerChatSessionItemProvider(provider));
        this._itemProvidersRegistrations.set(handle, {
            dispose: () => disposables.dispose(),
            provider,
            onDidChangeItems: changeEmitter,
        });
    }
    $onDidChangeChatSessionItems(handle) {
        this._itemProvidersRegistrations.get(handle)?.onDidChangeItems.fire();
    }
    async $onDidCommitChatSessionItem(handle, originalComponents, modifiedCompoennts) {
        const originalResource = URI.revive(originalComponents);
        const modifiedResource = URI.revive(modifiedCompoennts);
        this._logService.trace(`$onDidCommitChatSessionItem: handle(${handle}), original(${originalResource}), modified(${modifiedResource})`);
        const chatSessionType = this._itemProvidersRegistrations.get(handle)?.provider.chatSessionType;
        if (!chatSessionType) {
            this._logService.error(`No chat session type found for provider handle ${handle}`);
            return;
        }
        const originalEditor = this._editorService.editors.find(editor => editor.resource?.toString() === originalResource.toString());
        const contribution = this._chatSessionsService.getAllChatSessionContributions().find(c => c.type === chatSessionType);
        // Find the group containing the original editor
        const originalGroup = this.editorGroupService.groups.find(group => group.editors.some(editor => isEqual(editor.resource, originalResource)))
            ?? this.editorGroupService.activeGroup;
        const options = {
            title: {
                preferred: originalEditor?.getName() || undefined,
                fallback: localize('chatEditorContributionName', "{0}", contribution?.displayName),
            }
        };
        if (originalEditor) {
            // Prefetch the chat session content to make the subsequent editor swap quick
            const newSession = await this._chatSessionsService.getOrCreateChatSession(URI.revive(modifiedResource), CancellationToken.None);
            newSession.initialEditingSession = originalEditor instanceof ChatEditorInput
                ? originalEditor.transferOutEditingSession()
                : undefined;
            this._editorService.replaceEditors([{
                    editor: originalEditor,
                    replacement: {
                        resource: modifiedResource,
                        options,
                    },
                }], originalGroup);
        }
        else {
            this._logService.warn(`Original chat session editor not found for resource ${originalResource.toString()}`);
            this._editorService.openEditor({ resource: modifiedResource }, originalGroup);
        }
    }
    async _provideChatSessionItems(handle, token) {
        try {
            // Get all results as an array from the RPC call
            const sessions = await this._proxy.$provideChatSessionItems(handle, token);
            return sessions.map(session => {
                const uri = URI.revive(session.resource);
                const model = this._chatService.getSession(uri);
                let description;
                if (model) {
                    description = this._chatSessionsService.getSessionDescription(model);
                }
                return {
                    ...session,
                    resource: uri,
                    iconPath: session.iconPath,
                    tooltip: session.tooltip ? this._reviveTooltip(session.tooltip) : undefined,
                    description: description || session.description || localize('chat.sessions.description.finished', "Finished")
                };
            });
        }
        catch (error) {
            this._logService.error('Error providing chat sessions:', error);
        }
        return [];
    }
    async _provideNewChatSessionItem(handle, options, token) {
        try {
            const chatSessionItem = await this._proxy.$provideNewChatSessionItem(handle, options, token);
            if (!chatSessionItem) {
                throw new Error('Extension failed to create chat session');
            }
            return {
                ...chatSessionItem,
                resource: URI.revive(chatSessionItem.resource),
                iconPath: chatSessionItem.iconPath,
                tooltip: chatSessionItem.tooltip ? this._reviveTooltip(chatSessionItem.tooltip) : undefined,
            };
        }
        catch (error) {
            this._logService.error('Error creating chat session:', error);
            throw error;
        }
    }
    async _provideChatSessionContent(providerHandle, sessionResource, token) {
        let session = this._activeSessions.get(sessionResource);
        if (!session) {
            session = new ObservableChatSession(sessionResource, providerHandle, this._proxy, this._logService, this._dialogService);
            this._activeSessions.set(sessionResource, session);
            const disposable = session.onWillDispose(() => {
                this._activeSessions.delete(sessionResource);
                this._sessionDisposables.get(sessionResource)?.dispose();
                this._sessionDisposables.delete(sessionResource);
            });
            this._sessionDisposables.set(sessionResource, disposable);
        }
        try {
            await session.initialize(token);
            if (session.options) {
                for (const [_, handle] of this._sessionTypeToHandle) {
                    if (handle === providerHandle) {
                        for (const [optionId, value] of Object.entries(session.options)) {
                            this._chatSessionsService.setSessionOption(sessionResource, optionId, value);
                        }
                        break;
                    }
                }
            }
            return session;
        }
        catch (error) {
            session.dispose();
            this._logService.error(`Error providing chat session content for handle ${providerHandle} and resource ${sessionResource.toString()}:`, error);
            throw error;
        }
    }
    $unregisterChatSessionItemProvider(handle) {
        this._itemProvidersRegistrations.deleteAndDispose(handle);
    }
    $registerChatSessionContentProvider(handle, chatSessionScheme) {
        const provider = {
            provideChatSessionContent: (resource, token) => this._provideChatSessionContent(handle, resource, token)
        };
        this._sessionTypeToHandle.set(chatSessionScheme, handle);
        this._contentProvidersRegistrations.set(handle, this._chatSessionsService.registerChatSessionContentProvider(chatSessionScheme, provider));
        this._proxy.$provideChatSessionProviderOptions(handle, CancellationToken.None).then(options => {
            if (options?.optionGroups && options.optionGroups.length) {
                this._chatSessionsService.setOptionGroupsForSessionType(chatSessionScheme, handle, options.optionGroups);
            }
        }).catch(err => this._logService.error('Error fetching chat session options', err));
    }
    $unregisterChatSessionContentProvider(handle) {
        this._contentProvidersRegistrations.deleteAndDispose(handle);
        for (const [sessionType, h] of this._sessionTypeToHandle) {
            if (h === handle) {
                this._sessionTypeToHandle.delete(sessionType);
                break;
            }
        }
        // dispose all sessions from this provider and clean up its disposables
        for (const [key, session] of this._activeSessions) {
            if (session.providerHandle === handle) {
                session.dispose();
                this._activeSessions.delete(key);
            }
        }
    }
    async $handleProgressChunk(handle, sessionResource, requestId, chunks) {
        const resource = URI.revive(sessionResource);
        const observableSession = this._activeSessions.get(resource);
        if (!observableSession) {
            this._logService.warn(`No session found for progress chunks: handle ${handle}, sessionResource ${resource}, requestId ${requestId}`);
            return;
        }
        const chatProgressParts = chunks.map(chunk => {
            const [progress] = Array.isArray(chunk) ? chunk : [chunk];
            return revive(progress);
        });
        observableSession.handleProgressChunk(requestId, chatProgressParts);
    }
    $handleProgressComplete(handle, sessionResource, requestId) {
        const resource = URI.revive(sessionResource);
        const observableSession = this._activeSessions.get(resource);
        if (!observableSession) {
            this._logService.warn(`No session found for progress completion: handle ${handle}, sessionResource ${resource}, requestId ${requestId}`);
            return;
        }
        observableSession.handleProgressComplete(requestId);
    }
    $handleAnchorResolve(handle, sesssionResource, requestId, requestHandle, anchor) {
        // throw new Error('Method not implemented.');
    }
    dispose() {
        for (const session of this._activeSessions.values()) {
            session.dispose();
        }
        this._activeSessions.clear();
        for (const disposable of this._sessionDisposables.values()) {
            disposable.dispose();
        }
        this._sessionDisposables.clear();
        super.dispose();
    }
    _reviveTooltip(tooltip) {
        if (!tooltip) {
            return undefined;
        }
        // If it's already a string, return as-is
        if (typeof tooltip === 'string') {
            return tooltip;
        }
        // If it's a serialized IMarkdownString, revive it to MarkdownString
        if (typeof tooltip === 'object' && 'value' in tooltip) {
            return MarkdownString.lift(tooltip);
        }
        return undefined;
    }
    /**
     * Notify the extension about option changes for a session
     */
    async notifyOptionsChange(handle, sessionResource, updates) {
        try {
            await this._proxy.$provideHandleOptionsChange(handle, sessionResource, updates, CancellationToken.None);
        }
        catch (error) {
            this._logService.error(`Error notifying extension about options change for handle ${handle}, sessionResource ${sessionResource}:`, error);
        }
    }
};
MainThreadChatSessions = __decorate([
    extHostNamedCustomer(MainContext.MainThreadChatSessions),
    __param(1, IChatSessionsService),
    __param(2, IChatService),
    __param(3, IDialogService),
    __param(4, IEditorService),
    __param(5, IEditorGroupsService),
    __param(6, ILogService)
], MainThreadChatSessions);
export { MainThreadChatSessions };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZENoYXRTZXNzaW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZENoYXRTZXNzaW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDeEQsT0FBTyxFQUFtQixjQUFjLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN0RixPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQWUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM1RyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDMUQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxPQUFPLEVBQWUsZUFBZSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDM0YsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxHQUFHLEVBQWlCLE1BQU0sNkJBQTZCLENBQUM7QUFDakUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzNDLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM3RSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFbEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBRWhGLE9BQU8sRUFBOEMsWUFBWSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDcEgsT0FBTyxF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