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
import { DeferredPromise } from '../../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { toErrorMessage } from '../../../../base/common/errorMessage.js';
import { BugIndicatingError, ErrorNoTelemetry } from '../../../../base/common/errors.js';
import { Emitter } from '../../../../base/common/event.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable, DisposableMap, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { revive } from '../../../../base/common/marshalling.js';
import { Schemas } from '../../../../base/common/network.js';
import { autorun, derived } from '../../../../base/common/observable.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';
import { isDefined } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { OffsetRange } from '../../../../editor/common/core/ranges/offsetRange.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Progress } from '../../../../platform/progress/common/progress.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IMcpService } from '../../mcp/common/mcpTypes.js';
import { IChatAgentService } from './chatAgents.js';
import { ChatModel, ChatRequestModel, normalizeSerializableChatData, toChatHistoryContent, updateRanges } from './chatModel.js';
import { ChatModelStore } from './chatModelStore.js';
import { chatAgentLeader, ChatRequestAgentPart, ChatRequestAgentSubcommandPart, ChatRequestSlashCommandPart, ChatRequestTextPart, chatSubcommandLeader, getPromptText } from './chatParserTypes.js';
import { ChatRequestParser } from './chatRequestParser.js';
import { ChatMcpServersStarting } from './chatService.js';
import { ChatRequestTelemetry, ChatServiceTelemetry } from './chatServiceTelemetry.js';
import { IChatSessionsService } from './chatSessionsService.js';
import { ChatSessionStore } from './chatSessionStore.js';
import { IChatSlashCommandService } from './chatSlashCommands.js';
import { IChatTransferService } from './chatTransferService.js';
import { LocalChatSessionUri } from './chatUri.js';
import { ChatAgentLocation, ChatConfiguration, ChatModeKind } from './constants.js';
import { ILanguageModelToolsService } from './languageModelToolsService.js';
const serializedChatKey = 'interactive.sessions';
const TransferredGlobalChatKey = 'chat.workspaceTransfer';
const SESSION_TRANSFER_EXPIRATION_IN_MILLISECONDS = 1000 * 60;
let CancellableRequest = class CancellableRequest {
    constructor(cancellationTokenSource, requestId, toolsService) {
        this.cancellationTokenSource = cancellationTokenSource;
        this.requestId = requestId;
        this.toolsService = toolsService;
    }
    dispose() {
        this.cancellationTokenSource.dispose();
    }
    cancel() {
        if (this.requestId) {
            this.toolsService.cancelToolCallsForRequest(this.requestId);
        }
        this.cancellationTokenSource.cancel();
    }
};
CancellableRequest = __decorate([
    __param(2, ILanguageModelToolsService)
], CancellableRequest);
class DisposableResourceMap extends Disposable {
    constructor() {
        super(...arguments);
        this._map = this._register(new DisposableMap());
    }
    get(sessionResource) {
        return this._map.get(this.toKey(sessionResource));
    }
    set(sessionResource, value) {
        this._map.set(this.toKey(sessionResource), value);
    }
    has(sessionResource) {
        return this._map.has(this.toKey(sessionResource));
    }
    deleteAndLeak(sessionResource) {
        return this._map.deleteAndLeak(this.toKey(sessionResource));
    }
    deleteAndDispose(sessionResource) {
        this._map.deleteAndDispose(this.toKey(sessionResource));
    }
    toKey(uri) {
        return uri.toString();
    }
}
let ChatService = class ChatService extends Disposable {
    get transferredSessionData() {
        return this._transferredSessionData;
    }
    /**
     * For test use only
     */
    waitForModelDisposals() {
        return this._sessionModels.waitForModelDisposals();
    }
    get edits2Enabled() {
        return this.configurationService.getValue(ChatConfiguration.Edits2Enabled);
    }
    get isEmptyWindow() {
        const workspace = this.workspaceContextService.getWorkspace();
        return !workspace.configuration && workspace.folders.length === 0;
    }
    constructor(storageService, logService, extensionService, instantiationService, workspaceContextService, chatSlashCommandService, chatAgentService, configurationService, chatTransferService, chatSessionService, mcpService) {
        super();
        this.storageService = storageService;
        this.logService = logService;
        this.extensionService = extensionService;
        this.instantiationService = instantiationService;
        this.workspaceContextService = workspaceContextService;
        this.chatSlashCommandService = chatSlashCommandService;
        this.chatAgentService = chatAgentService;
        this.configurationService = configurationService;
        this.chatTransferService = chatTransferService;
        this.chatSessionService = chatSessionService;
        this.mcpService = mcpService;
        this._pendingRequests = this._register(new DisposableResourceMap());
        this._onDidSubmitRequest = this._register(new Emitter());
        this.onDidSubmitRequest = this._onDidSubmitRequest.event;
        this._onDidPerformUserAction = this._register(new Emitter());
        this.onDidPerformUserAction = this._onDidPerformUserAction.event;
        this._onDidDisposeSession = this._register(new Emitter());
        this.onDidDisposeSession = this._onDidDisposeSession.event;
        this._sessionFollowupCancelTokens = this._register(new DisposableResourceMap());
        this._sessionModels = this._register(instantiationService.createInstance(ChatModelStore, {
            createModel: (props) => this._startSession(props),
            willDisposeModel: async (model) => {
                const localSessionId = LocalChatSessionUri.parseLocalSessionId(model.sessionResource);
                if (localSessionId && (model.initialLocation === ChatAgentLocation.Chat)) {
                    // Always preserve sessions that have custom titles, even if empty
                    if (model.getRequests().length === 0 && !model.customTitle) {
                        await this._chatSessionStore.deleteSession(localSessionId);
                    }
                    else {
                        await this._chatSessionStore.storeSessions([model]);
                    }
                }
            }
        }));
        this._chatServiceTelemetry = this.instantiationService.createInstance(ChatServiceTelemetry);
        const sessionData = storageService.get(serializedChatKey, this.isEmptyWindow ? -1 /* StorageScope.APPLICATION */ : 1 /* StorageScope.WORKSPACE */, '');
        if (sessionData) {
            this._persistedSessions = this.deserializeChats(sessionData);
            const countsForLog = Object.keys(this._persistedSessions).length;
            if (countsForLog > 0) {
                this.trace('constructor', `Restored ${countsForLog} persisted sessions`);
            }
        }
        else {
            this._persistedSessions = {};
        }
        const transferredData = this.getTransferredSessionData();
        const transferredChat = transferredData?.chat;
        if (transferredChat) {
            this.trace('constructor', `Transferred session ${transferredChat.sessionId}`);
            this._persistedSessions[transferredChat.sessionId] = transferredChat;
            this._transferredSessionData = {
                sessionId: transferredChat.sessionId,
                location: transferredData.location,
                inputState: transferredData.inputState
            };
        }
        this._chatSessionStore = this._register(this.instantiationService.createInstance(ChatSessionStore));
        this._chatSessionStore.migrateDataIfNeeded(() => this._persistedSessions);
        // When using file storage, populate _persistedSessions with session metadata from the index
        // This ensures that getPersistedSessionTitle() can find titles for inactive sessions
        this.initializePersistedSessionsFromFileStorage();
        this._register(storageService.onWillSaveState(() => this.saveState()));
        this.requestInProgressObs = derived(reader => {
            const models = this._sessionModels.observable.read(reader).values();
            return Iterable.some(models, model => model.requestInProgress.read(reader));
        });
    }
    get editingSessions() {
        return [...this._sessionModels.values()].map(v => v.editingSession).filter(isDefined);
    }
    isEnabled(location) {
        return this.chatAgentService.getContributedDefaultAgent(location) !== undefined;
    }
    saveState() {
        const liveChats = Array.from(this._sessionModels.values())
            .filter(session => {
            if (!LocalChatSessionUri.parseLocalSessionId(session.sessionResource)) {
                return false;
            }
            return session.initialLocation === ChatAgentLocation.Chat;
        });
        this._chatSessionStore.storeSessions(liveChats);
    }
    notifyUserAction(action) {
        this._chatServiceTelemetry.notifyUserAction(action);
        this._onDidPerformUserAction.fire(action);
        if (action.action.kind === 'chatEditingSessionAction') {
            const model = this._sessionModels.get(action.sessionResource);
            if (model) {
                model.notifyEditingAction(action.action);
            }
        }
    }
    async setChatSessionTitle(sessionResource, title) {
        const sessionId = this.toLocalSessionId(sessionResource);
        const model = this._sessionModels.get(sessionResource);
        if (model) {
            model.setCustomTitle(title);
        }
        // Update the title in the file storage
        await this._chatSessionStore.setSessionTitle(sessionId, title);
        // Trigger immediate save to ensure consistency
        this.saveState();
    }
    trace(method, message) {
        if (message) {
            this.logService.trace(`ChatService#${method}: ${message}`);
        }
        else {
            this.logService.trace(`ChatService#${method}`);
        }
    }
    error(method, message) {
        this.logService.error(`ChatService#${method} ${message}`);
    }
    deserializeChats(sessionData) {
        try {
            const arrayOfSessions = revive(JSON.parse(sessionData)); // Revive serialized URIs in session data
            if (!Array.isArray(arrayOfSessions)) {
                throw new Error('Expected array');
            }
            const sessions = arrayOfSessions.reduce((acc, session) => {
                // Revive serialized markdown strings in response data
                for (const request of session.requests) {
                    if (Array.isArray(request.response)) {
                        request.response = request.response.map((response) => {
                            if (typeof response === 'string') {
                                return new MarkdownString(response);
                            }
                            return response;
                        });
                    }
                    else if (typeof request.response === 'string') {
                        request.response = [new MarkdownString(request.response)];
                    }
                }
                acc[session.sessionId] = normalizeSerializableChatData(session);
                return acc;
            }, {});
            return sessions;
        }
        catch (err) {
            this.error('deserializeChats', `Malformed session data: ${err}. [${sessionData.substring(0, 20)}${sessionData.length > 20 ? '...' : ''}]`);
            return {};
        }
    }
    getTransferredSessionData() {
        const data = this.storageService.getObject(TransferredGlobalChatKey, 0 /* StorageScope.PROFILE */, []);
        const workspaceUri = this.workspaceContextService.getWorkspace().folders[0]?.uri;
        if (!workspaceUri) {
            return;
        }
        const thisWorkspace = workspaceUri.toString();
        const currentTime = Date.now();
        // Only use transferred data if it was created recently
        const transferred = data.find(item => URI.revive(item.toWorkspace).toString() === thisWorkspace && (currentTime - item.timestampInMilliseconds < SESSION_TRANSFER_EXPIRATION_IN_MILLISECONDS));
        // Keep data that isn't for the current workspace and that hasn't expired yet
        const filtered = data.filter(item => URI.revive(item.toWorkspace).toString() !== thisWorkspace && (currentTime - item.timestampInMilliseconds < SESSION_TRANSFER_EXPIRATION_IN_MILLISECONDS));
        this.storageService.store(TransferredGlobalChatKey, JSON.stringify(filtered), 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        return transferred;
    }
    async initializePersistedSessionsFromFileStorage() {
        const index = await this._chatSessionStore.getIndex();
        const sessionIds = Object.keys(index);
        for (const sessionId of sessionIds) {
            const metadata = index[sessionId];
            if (metadata && !this._persistedSessions[sessionId]) {
                // Create a minimal session entry with the title information
                // This allows getPersistedSessionTitle() to find the title without loading the full session
                const minimalSession = {
                    version: 3,
                    sessionId: sessionId,
                    customTitle: metadata.title,
                    creationDate: Date.now(), // Use current time as fallback
                    lastMessageDate: metadata.lastMessageDate,
                    isImported: metadata.isImported || false,
                    initialLocation: metadata.initialLocation,
                    requests: [], // Empty requests array - this is just for title lookup
                    responderUsername: '',
                    responderAvatarIconUri: undefined,
                };
                this._persistedSessions[sessionId] = minimalSession;
            }
        }
    }
    /**
     * Returns an array of chat details for all persisted chat sessions that have at least one request.
     * Chat sessions that have already been loaded into the chat view are excluded from the result.
     * Imported chat sessions are also excluded from the result.
     */
    async getLocalSessionHistory() {
        const liveSessionItems = this.getLiveSessionItems();
        const historySessionItems = await this.getHistorySessionItems();
        return [...liveSessionItems, ...historySessionItems];
    }
    /**
     * Returns an array of chat details for all local live chat sessions.
     */
    getLiveSessionItems() {
        return Array.from(this._sessionModels.values())
            .filter(session => this.shouldBeInHistory(session))
            .map((session) => {
            const title = session.title || localize('newChat', "New Chat");
            return {
                sessionResource: session.sessionResource,
                title,
                lastMessageDate: session.lastMessageDate,
                isActive: true,
            };
        });
    }
    /**
     * Returns an array of chat details for all local chat sessions in history (not currently loaded).
     */
    async getHistorySessionItems() {
        const index = await this._chatSessionStore.getIndex();
        return Object.values(index)
            .filter(entry => !this._sessionModels.has(LocalChatSessionUri.forSession(entry.sessionId)) && this.shouldBeInHistory(entry) && !entry.isEmpty)
            .map((entry) => {
            const sessionResource = LocalChatSessionUri.forSession(entry.sessionId);
            return ({
                ...entry,
                sessionResource,
                isActive: this._sessionModels.has(sessionResource),
            });
        });
    }
    shouldBeInHistory(entry) {
        if (entry.sessionResource) {
            return !entry.isImported && LocalChatSessionUri.parseLocalSessionId(entry.sessionResource) && entry.initialLocation === ChatAgentLocation.Chat;
        }
        return !entry.isImported && entry.initialLocation === ChatAgentLocation.Chat;
    }
    async removeHistoryEntry(sessionResource) {
        await this._chatSessionStore.deleteSession(this.toLocalSessionId(sessionResource));
    }
    async clearAllHistoryEntries() {
        await this._chatSessionStore.clearAllSessions();
    }
    startSession(location, token, options) {
        this.trace('startSession');
        const sessionId = generateUuid();
        const sessionResource = LocalChatSessionUri.forSession(sessionId);
        return this._sessionModels.acquireOrCreate({
            initialData: undefined,
            location,
            token,
            sessionResource,
            sessionId,
            canUseTools: options?.canUseTools ?? true,
        });
    }
    _startSession(props) {
        const { initialData, location, token, sessionResource, sessionId, canUseTools, transferEditingSession } = props;
        const model = this.instantiationService.createInstance(ChatModel, initialData, { initialLocation: location, canUseTools, resource: sessionResource, sessionId });
        if (location === ChatAgentLocation.Chat) {
            model.startEditingSession(true, transferEditingSession);
        }
        this.initializeSession(model, token);
        return model;
    }
    initializeSession(model, token) {
        this.trace('initializeSession', `Initialize session ${model.sessionResource}`);
        // Activate the default extension provided agent but do not wait
        // for it to be ready so that the session can be used immediately
        // without having to wait for the agent to be ready.
        this.activateDefaultAgent(model.initialLocation).catch(e => this.logService.error(e));
    }
    async activateDefaultAgent(location) {
        await this.extensionService.whenInstalledExtensionsRegistered();
        const defaultAgentData = this.chatAgentService.getContributedDefaultAgent(location) ?? this.chatAgentService.getContributedDefaultAgent(ChatAgentLocation.Chat);
        if (!defaultAgentData) {
            throw new ErrorNoTelemetry('No default agent contributed');
        }
        // Await activation of the extension provided agent
        // Using `activateById` as workaround for the issue
        // https://github.com/microsoft/vscode/issues/250590
        if (!defaultAgentData.isCore) {
            await this.extensionService.activateById(defaultAgentData.extensionId, {
                activationEvent: `onChatParticipant:${defaultAgentData.id}`,
                extensionId: defaultAgentData.extensionId,
                startup: false
            });
        }
        const defaultAgent = this.chatAgentService.getActivatedAgents().find(agent => agent.id === defaultAgentData.id);
        if (!defaultAgent) {
            throw new ErrorNoTelemetry('No default agent registered');
        }
    }
    getSession(sessionResource) {
        return this._sessionModels.get(sessionResource);
    }
    getActiveSessionReference(sessionResource) {
        return this._sessionModels.acquireExisting(sessionResource);
    }
    async getOrRestoreSession(sessionResource) {
        this.trace('getOrRestoreSession', `${sessionResource}`);
        const existingRef = this._sessionModels.acquireExisting(sessionResource);
        if (existingRef) {
            return existingRef;
        }
        const sessionId = LocalChatSessionUri.parseLocalSessionId(sessionResource);
        if (!sessionId) {
            throw new Error(`Cannot restore non-local session ${sessionResource}`);
        }
        let sessionData;
        if (this.transferredSessionData?.sessionId === sessionId) {
            sessionData = revive(this._persistedSessions[sessionId]);
        }
        else {
            sessionData = revive(await this._chatSessionStore.readSession(sessionId));
        }
        if (!sessionData) {
            return undefined;
        }
        const sessionRef = this._sessionModels.acquireOrCreate({
            initialData: sessionData,
            location: sessionData.initialLocation ?? ChatAgentLocation.Chat,
            token: CancellationToken.None,
            sessionResource,
            sessionId,
            canUseTools: true,
        });
        const isTransferred = this.transferredSessionData?.sessionId === sessionId;
        if (isTransferred) {
            this._transferredSessionData = undefined;
        }
        return sessionRef;
    }
    /**
     * This is really just for migrating data from the edit session location to the panel.
     */
    isPersistedSessionEmpty(sessionResource) {
        const sessionId = LocalChatSessionUri.parseLocalSessionId(sessionResource);
        if (!sessionId) {
            throw new Error(`Cannot restore non-local session ${sessionResource}`);
        }
        const session = this._persistedSessions[sessionId];
        if (session) {
            return session.requests.length === 0;
        }
        return this._chatSessionStore.isSessionEmpty(sessionId);
    }
    getPersistedSessionTitle(sessionResource) {
        const sessionId = LocalChatSessionUri.parseLocalSessionId(sessionResource);
        if (!sessionId) {
            return undefined;
        }
        // First check the memory cache (_persistedSessions)
        const session = this._persistedSessions[sessionId];
        if (session) {
            const title = session.customTitle || ChatModel.getDefaultTitle(session.requests);
            return title;
        }
        // Try to read directly from file storage index
        // This handles the case where getName() is called before initialization completes
        // Access the internal synchronous index method via reflection
        // This is a workaround for the timing issue where initialization hasn't completed
        // eslint-disable-next-line local/code-no-any-casts
        const internalGetIndex = this._chatSessionStore.internalGetIndex;
        if (typeof internalGetIndex === 'function') {
            const indexData = internalGetIndex.call(this._chatSessionStore);
            const metadata = indexData.entries[sessionId];
            if (metadata && metadata.title) {
                return metadata.title;
            }
        }
        return undefined;
    }
    loadSessionFromContent(data) {
        const sessionId = 'sessionId' in data && data.sessionId ? data.sessionId : generateUuid();
        const sessionResource = LocalChatSessionUri.forSession(sessionId);
        return this._sessionModels.acquireOrCreate({
            initialData: data,
            location: data.initialLocation ?? ChatAgentLocation.Chat,
            token: CancellationToken.None,
            sessionResource,
            sessionId,
            canUseTools: true,
        });
    }
    async loadSessionForResource(chatSessionResource, location, token) {
        // TODO: Move this into a new ChatModelService
        if (chatSessionResource.scheme === Schemas.vscodeLocalChatSession) {
            return this.getOrRestoreSession(chatSessionResource);
        }
        const existingRef = this._sessionModels.acquireExisting(chatSessionResource);
        if (existingRef) {
            return existingRef;
        }
        const providedSession = await this.chatSessionService.getOrCreateChatSession(chatSessionResource, CancellationToken.None);
        const chatSessionType = chatSessionResource.scheme;
        // Contributed sessions do not use UI tools
        const modelRef = this._sessionModels.acquireOrCreate({
            initialData: undefined,
            location,
            token: CancellationToken.None,
            sessionResource: chatSessionResource,
            canUseTools: false,
            transferEditingSession: providedSession.initialEditingSession,
        });
        modelRef.object.setContributedChatSession({
            chatSessionResource,
            chatSessionType,
            isUntitled: chatSessionResource.path.startsWith('/untitled-') //TODO(jospicer)
        });
        const model = modelRef.object;
        const disposables = new DisposableStore();
        disposables.add(modelRef.object.onDidDispose(() => {
            disposables.dispose();
            providedSession.dispose();
        }));
        let lastRequest;
        for (const message of providedSession.history) {
            if (message.type === 'request') {
                if (lastRequest) {
                    lastRequest.response?.complete();
                }
                const requestText = message.prompt;
                const parsedRequest = {
                    text: requestText,
                    parts: [new ChatRequestTextPart(new OffsetRange(0, requestText.length), { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: requestText.length + 1 }, requestText)]
                };
                const agent = message.participant
                    ? this.chatAgentService.getAgent(message.participant) // TODO(jospicer): Remove and always hardcode?
                    : this.chatAgentService.getAgent(chatSessionType);
                lastRequest = model.addRequest(parsedRequest, message.variableData ?? { variables: [] }, 0, // attempt
                undefined, agent, undefined, // slashCommand
                undefined, // confirmation
                undefined, // locationData
                undefined, // attachments
                true // isCompleteAddedRequest - this indicates it's a complete request, not user input
                );
            }
            else {
                // response
                if (lastRequest) {
                    for (const part of message.parts) {
                        model.acceptResponseProgress(lastRequest, part);
                    }
                }
            }
        }
        if (providedSession.progressObs && lastRequest && providedSession.interruptActiveResponseCallback) {
            const initialCancellationRequest = this.instantiationService.createInstance(CancellableRequest, new CancellationTokenSource(), undefined);
            this._pendingRequests.set(model.sessionResource, initialCancellationRequest);
            const cancellationListener = disposables.add(new MutableDisposable());
            const createCancellationListener = (token) => {
                return token.onCancellationRequested(() => {
                    providedSession.interruptActiveResponseCallback?.().then(userConfirmedInterruption => {
                        if (!userConfirmedInterruption) {
                            // User cancelled the interruption
                            const newCancellationRequest = this.instantiationService.createInstance(CancellableRequest, new CancellationTokenSource(), undefined);
                            this._pendingRequests.set(model.sessionResource, newCancellationRequest);
                            cancellationListener.value = createCancellationListener(newCancellationRequest.cancellationTokenSource.token);
                        }
                    });
                });
            };
            cancellationListener.value = createCancellationListener(initialCancellationRequest.cancellationTokenSource.token);
            let lastProgressLength = 0;
            disposables.add(autorun(reader => {
                const progressArray = providedSession.progressObs?.read(reader) ?? [];
                const isComplete = providedSession.isCompleteObs?.read(reader) ?? false;
                // Process only new progress items
                if (progressArray.length > lastProgressLength) {
                    const newProgress = progressArray.slice(lastProgressLength);
                    for (const progress of newProgress) {
                        model?.acceptResponseProgress(lastRequest, progress);
                    }
                    lastProgressLength = progressArray.length;
                }
                // Handle completion
                if (isComplete) {
                    lastRequest.response?.complete();
                    cancellationListener.clear();
                }
            }));
        }
        else {
            if (lastRequest) {
                lastRequest.response?.complete();
            }
        }
        return modelRef;
    }
    getChatSessionFromInternalUri(sessionResource) {
        const model = this._sessionModels.get(sessionResource);
        if (!model) {
            return;
        }
        const { contributedChatSession } = model;
        return contributedChatSession;
    }
    async resendRequest(request, options) {
        const model = this._sessionModels.get(request.session.sessionResource);
        if (!model && model !== request.session) {
            throw new Error(`Unknown session: ${request.session.sessionResource}`);
        }
        const cts = this._pendingRequests.get(request.session.sessionResource);
        if (cts) {
            this.trace('resendRequest', `Session ${request.session.sessionResource} already has a pending request, cancelling...`);
            cts.cancel();
        }
        const location = options?.location ?? model.initialLocation;
        const attempt = options?.attempt ?? 0;
        const enableCommandDetection = !options?.noCommandDetection;
        const defaultAgent = this.chatAgentService.getDefaultAgent(location, options?.modeInfo?.kind);
        model.removeRequest(request.id, 1 /* ChatRequestRemovalReason.Resend */);
        const resendOptions = {
            ...options,
            locationData: request.locationData,
            attachedContext: request.attachedContext,
        };
        await this._sendRequestAsync(model, model.sessionResource, request.message, attempt, enableCommandDetection, defaultAgent, location, resendOptions).responseCompletePromise;
    }
    async sendRequest(sessionResource, request, options) {
        this.trace('sendRequest', `sessionResource: ${sessionResource.toString()}, message: ${request.substring(0, 20)}${request.length > 20 ? '[...]' : ''}}`);
        if (!request.trim() && !options?.slashCommand && !options?.agentId && !options?.agentIdSilent) {
            this.trace('sendRequest', 'Rejected empty message');
            return;
        }
        const model = this._sessionModels.get(sessionResource);
        if (!model) {
            throw new Error(`Unknown session: ${sessionResource}`);
        }
        if (this._pendingRequests.has(sessionResource)) {
            this.trace('sendRequest', `Session ${sessionResource} already has a pending request`);
            return;
        }
        const requests = model.getRequests();
        for (let i = requests.length - 1; i >= 0; i -= 1) {
            const request = requests[i];
            if (request.shouldBeRemovedOnSend) {
                if (request.shouldBeRemovedOnSend.afterUndoStop) {
                    request.response?.finalizeUndoState();
                }
                else {
                    await this.removeRequest(sessionResource, request.id);
                }
            }
        }
        const location = options?.location ?? model.initialLocation;
        const attempt = options?.attempt ?? 0;
        const defaultAgent = this.chatAgentService.getDefaultAgent(location, options?.modeInfo?.kind);
        const parsedRequest = this.parseChatRequest(sessionResource, request, location, options);
        const silentAgent = options?.agentIdSilent ? this.chatAgentService.getAgent(options.agentIdSilent) : undefined;
        const agent = silentAgent ?? parsedRequest.parts.find((r) => r instanceof ChatRequestAgentPart)?.agent ?? defaultAgent;
        const agentSlashCommandPart = parsedRequest.parts.find((r) => r instanceof ChatRequestAgentSubcommandPart);
        // This method is only returning whether the request was accepted - don't block on the actual request
        return {
            ...this._sendRequestAsync(model, sessionResource, parsedRequest, attempt, !options?.noCommandDetection, silentAgent ?? defaultAgent, location, options),
            agent,
            slashCommand: agentSlashCommandPart?.command,
        };
    }
    parseChatRequest(sessionResource, request, location, options) {
        let parserContext = options?.parserContext;
        if (options?.agentId) {
            const agent = this.chatAgentService.getAgent(options.agentId);
            if (!agent) {
                throw new Error(`Unknown agent: ${options.agentId}`);
            }
            parserContext = { selectedAgent: agent, mode: options.modeInfo?.kind };
            const commandPart = options.slashCommand ? ` ${chatSubcommandLeader}${options.slashCommand}` : '';
            request = `${chatAgentLeader}${agent.name}${commandPart} ${request}`;
        }
        const parsedRequest = this.instantiationService.createInstance(ChatRequestParser).parseChatRequest(sessionResource, request, location, parserContext);
        return parsedRequest;
    }
    refreshFollowupsCancellationToken(sessionResource) {
        this._sessionFollowupCancelTokens.get(sessionResource)?.cancel();
        const newTokenSource = new CancellationTokenSource();
        this._sessionFollowupCancelTokens.set(sessionResource, newTokenSource);
        return newTokenSource.token;
    }
    _sendRequestAsync(model, sessionResource, parsedRequest, attempt, enableCommandDetection, defaultAgent, location, options) {
        const followupsCancelToken = this.refreshFollowupsCancellationToken(sessionResource);
        let request;
        const agentPart = 'kind' in parsedRequest ? undefined : parsedRequest.parts.find((r) => r instanceof ChatRequestAgentPart);
        const agentSlashCommandPart = 'kind' in parsedRequest ? undefined : parsedRequest.parts.find((r) => r instanceof ChatRequestAgentSubcommandPart);
        const commandPart = 'kind' in parsedRequest ? undefined : parsedRequest.parts.find((r) => r instanceof ChatRequestSlashCommandPart);
        const requests = [...model.getRequests()];
        const requestTelemetry = this.instantiationService.createInstance(ChatRequestTelemetry, {
            agent: agentPart?.agent ?? defaultAgent,
            agentSlashCommandPart,
            commandPart,
            sessionId: model.sessionId,
            location: model.initialLocation,
            options,
            enableCommandDetection
        });
        let gotProgress = false;
        const requestType = commandPart ? 'slashCommand' : 'string';
        const responseCreated = new DeferredPromise();
        let responseCreatedComplete = false;
        function completeResponseCreated() {
            if (!responseCreatedComplete && request?.response) {
                responseCreated.complete(request.response);
                responseCreatedComplete = true;
            }
        }
        const store = new DisposableStore();
        const source = store.add(new CancellationTokenSource());
        const token = source.token;
        const sendRequestInternal = async () => {
            const progressCallback = (progress) => {
                if (token.isCancellationRequested) {
                    return;
                }
                gotProgress = true;
                for (let i = 0; i < progress.length; i++) {
                    const isLast = i === progress.length - 1;
                    const progressItem = progress[i];
                    if (progressItem.kind === 'markdownContent') {
                        this.trace('sendRequest', `Provider returned progress for session ${model.sessionResource}, ${progressItem.content.value.length} chars`);
                    }
                    else {
                        this.trace('sendRequest', `Provider returned progress: ${JSON.stringify(progressItem)}`);
                    }
                    model.acceptResponseProgress(request, progressItem, !isLast);
                }
                completeResponseCreated();
            };
            let detectedAgent;
            let detectedCommand;
            const stopWatch = new StopWatch(false);
            store.add(token.onCancellationRequested(() => {
                this.trace('sendRequest', `Request for session ${model.sessionResource} was cancelled`);
                if (!request) {
                    return;
                }
                requestTelemetry.complete({
                    timeToFirstProgress: undefined,
                    result: 'cancelled',
                    // Normally timings happen inside the EH around the actual provider. For cancellation we can measure how long the user waited before cancelling
                    totalTime: stopWatch.elapsed(),
                    requestType,
                    detectedAgent,
                    request,
                });
                model.cancelRequest(request);
            }));
            try {
                let rawResult;
                let agentOrCommandFollowups = undefined;
                let chatTitlePromise;
                if (agentPart || (defaultAgent && !commandPart)) {
                    const prepareChatAgentRequest = (agent, command, enableCommandDetection, chatRequest, isParticipantDetected) => {
                        const initVariableData = { variables: [] };
                        request = chatRequest ?? model.addRequest(parsedRequest, initVariableData, attempt, options?.modeInfo, agent, command, options?.confirmation, options?.locationData, options?.attachedContext, undefined, options?.userSelectedModelId, options?.userSelectedTools?.get());
                        let variableData;
                        let message;
                        if (chatRequest) {
                            variableData = chatRequest.variableData;
                            message = getPromptText(request.message).message;
                        }
                        else {
                            variableData = { variables: this.prepareContext(request.attachedContext) };
                            model.updateRequest(request, variableData);
                            const promptTextResult = getPromptText(request.message);
                            variableData = updateRanges(variableData, promptTextResult.diff); // TODO bit of a hack
                            message = promptTextResult.message;
                        }
                        const agentRequest = {
                            sessionId: model.sessionId,
                            sessionResource: model.sessionResource,
                            requestId: request.id,
                            agentId: agent.id,
                            message,
                            command: command?.name,
                            variables: variableData,
                            enableCommandDetection,
                            isParticipantDetected,
                            attempt,
                            location,
                            locationData: request.locationData,
                            acceptedConfirmationData: options?.acceptedConfirmationData,
                            rejectedConfirmationData: options?.rejectedConfirmationData,
                            userSelectedModelId: options?.userSelectedModelId,
                            userSelectedTools: options?.userSelectedTools?.get(),
                            modeInstructions: options?.modeInfo?.modeInstructions,
                            editedFileEvents: request.editedFileEvents,
                        };
                        let isInitialTools = true;
                        store.add(autorun(reader => {
                            const tools = options?.userSelectedTools?.read(reader);
                            if (isInitialTools) {
                                isInitialTools = false;
                                return;
                            }
                            if (tools) {
                                this.chatAgentService.setRequestTools(agent.id, request.id, tools);
                                // in case the request has not been sent out yet:
                                agentRequest.userSelectedTools = tools;
                            }
                        }));
                        return agentRequest;
                    };
                    if (this.configurationService.getValue('chat.detectParticipant.enabled') !== false &&
                        this.chatAgentService.hasChatParticipantDetectionProviders() &&
                        !agentPart &&
                        !commandPart &&
                        !agentSlashCommandPart &&
                        enableCommandDetection &&
                        location !== ChatAgentLocation.EditorInline &&
                        options?.modeInfo?.kind !== ChatModeKind.Agent &&
                        options?.modeInfo?.kind !== ChatModeKind.Edit &&
                        !options?.agentIdSilent) {
                        // We have no agent or command to scope history with, pass the full history to the participant detection provider
                        const defaultAgentHistory = this.getHistoryEntriesFromModel(requests, model.sessionId, location, defaultAgent.id);
                        // Prepare the request object that we will send to the participant detection provider
                        const chatAgentRequest = prepareChatAgentRequest(defaultAgent, undefined, enableCommandDetection, undefined, false);
                        const result = await this.chatAgentService.detectAgentOrCommand(chatAgentRequest, defaultAgentHistory, { location }, token);
                        if (result && this.chatAgentService.getAgent(result.agent.id)?.locations?.includes(location)) {
                            // Update the response in the ChatModel to reflect the detected agent and command
                            request.response?.setAgent(result.agent, result.command);
                            detectedAgent = result.agent;
                            detectedCommand = result.command;
                        }
                    }
                    const agent = (detectedAgent ?? agentPart?.agent ?? defaultAgent);
                    const command = detectedCommand ?? agentSlashCommandPart?.command;
                    await this.extensionService.activateByEvent(`onChatParticipant:${agent.id}`);
                    // Recompute history in case the agent or command changed
                    const history = this.getHistoryEntriesFromModel(requests, model.sessionId, location, agent.id);
                    const requestProps = prepareChatAgentRequest(agent, command, enableCommandDetection, request /* Reuse the request object if we already created it for participant detection */, !!detectedAgent);
                    const pendingRequest = this._pendingRequests.get(sessionResource);
                    if (pendingRequest && !pendingRequest.requestId) {
                        pendingRequest.requestId = requestProps.requestId;
                    }
                    completeResponseCreated();
                    // MCP autostart: only run for native VS Code sessions (sidebar, new editors) but not for extension contributed sessions that have inputType set.
                    if (model.canUseTools) {
                        const autostartResult = new ChatMcpServersStarting(this.mcpService.autostart(token));
                        if (!autostartResult.isEmpty) {
                            progressCallback([autostartResult]);
                            await autostartResult.wait();
                        }
                    }
                    const agentResult = await this.chatAgentService.invokeAgent(agent.id, requestProps, progressCallback, history, token);
                    rawResult = agentResult;
                    agentOrCommandFollowups = this.chatAgentService.getFollowups(agent.id, requestProps, agentResult, history, followupsCancelToken);
                    // Use LLM to generate the chat title
                    if (model.getRequests().length === 1 && !model.customTitle) {
                        const chatHistory = this.getHistoryEntriesFromModel(model.getRequests(), model.sessionId, location, agent.id);
                        chatTitlePromise = this.chatAgentService.getChatTitle(agent.id, chatHistory, CancellationToken.None).then((title) => {
                            // Since not every chat agent implements title generation, we can fallback to the default agent
                            // which supports it
                            if (title === undefined) {
                                const defaultAgentForTitle = this.chatAgentService.getDefaultAgent(location);
                                if (defaultAgentForTitle) {
                                    return this.chatAgentService.getChatTitle(defaultAgentForTitle.id, chatHistory, CancellationToken.None);
                                }
                            }
                            return title;
                        });
                    }
                }
                else if (commandPart && this.chatSlashCommandService.hasCommand(commandPart.slashCommand.command)) {
                    if (commandPart.slashCommand.silent !== true) {
                        request = model.addRequest(parsedRequest, { variables: [] }, attempt, options?.modeInfo);
                        completeResponseCreated();
                    }
                    // contributed slash commands
                    // TODO: spell this out in the UI
                    const history = [];
                    for (const modelRequest of model.getRequests()) {
                        if (!modelRequest.response) {
                            continue;
                        }
                        history.push({ role: 1 /* ChatMessageRole.User */, content: [{ type: 'text', value: modelRequest.message.text }] });
                        history.push({ role: 2 /* ChatMessageRole.Assistant */, content: [{ type: 'text', value: modelRequest.response.response.toString() }] });
                    }
                    const message = parsedRequest.text;
                    const commandResult = await this.chatSlashCommandService.executeCommand(commandPart.slashCommand.command, message.substring(commandPart.slashCommand.command.length + 1).trimStart(), new Progress(p => {
                        progressCallback([p]);
                    }), history, location, model.sessionResource, token);
                    agentOrCommandFollowups = Promise.resolve(commandResult?.followUp);
                    rawResult = {};
                }
                else {
                    throw new Error(`Cannot handle request`);
                }
                if (token.isCancellationRequested && !rawResult) {
                    return;
                }
                else {
                    if (!rawResult) {
                        this.trace('sendRequest', `Provider returned no response for session ${model.sessionResource}`);
                        rawResult = { errorDetails: { message: localize('emptyResponse', "Provider returned null response") } };
                    }
                    const result = rawResult.errorDetails?.responseIsFiltered ? 'filtered' :
                        rawResult.errorDetails && gotProgress ? 'errorWithOutput' :
                            rawResult.errorDetails ? 'error' :
                                'success';
                    requestTelemetry.complete({
                        timeToFirstProgress: rawResult.timings?.firstProgress,
                        totalTime: rawResult.timings?.totalElapsed,
                        result,
                        requestType,
                        detectedAgent,
                        request,
                    });
                    model.setResponse(request, rawResult);
                    completeResponseCreated();
                    this.trace('sendRequest', `Provider returned response for session ${model.sessionResource}`);
                    request.response?.complete();
                    if (agentOrCommandFollowups) {
                        agentOrCommandFollowups.then(followups => {
                            model.setFollowups(request, followups);
                            const commandForTelemetry = agentSlashCommandPart ? agentSlashCommandPart.command.name : commandPart?.slashCommand.command;
                            this._chatServiceTelemetry.retrievedFollowups(agentPart?.agent.id ?? '', commandForTelemetry, followups?.length ?? 0);
                        });
                    }
                    chatTitlePromise?.then(title => {
                        if (title) {
                            model.setCustomTitle(title);
                        }
                    });
                }
            }
            catch (err) {
                this.logService.error(`Error while handling chat request: ${toErrorMessage(err, true)}`);
                requestTelemetry.complete({
                    timeToFirstProgress: undefined,
                    totalTime: undefined,
                    result: 'error',
                    requestType,
                    detectedAgent,
                    request,
                });
                if (request) {
                    const rawResult = { errorDetails: { message: err.message } };
                    model.setResponse(request, rawResult);
                    completeResponseCreated();
                    request.response?.complete();
                }
            }
            finally {
                store.dispose();
            }
        };
        const rawResponsePromise = sendRequestInternal();
        // Note- requestId is not known at this point, assigned later
        this._pendingRequests.set(model.sessionResource, this.instantiationService.createInstance(CancellableRequest, source, undefined));
        rawResponsePromise.finally(() => {
            this._pendingRequests.deleteAndDispose(model.sessionResource);
        });
        this._onDidSubmitRequest.fire({ chatSessionResource: model.sessionResource });
        return {
            responseCreatedPromise: responseCreated.p,
            responseCompletePromise: rawResponsePromise,
        };
    }
    prepareContext(attachedContextVariables) {
        attachedContextVariables ??= [];
        // "reverse", high index first so that replacement is simple
        attachedContextVariables.sort((a, b) => {
            // If either range is undefined, sort it to the back
            if (!a.range && !b.range) {
                return 0; // Keep relative order if both ranges are undefined
            }
            if (!a.range) {
                return 1; // a goes after b
            }
            if (!b.range) {
                return -1; // a goes before b
            }
            return b.range.start - a.range.start;
        });
        return attachedContextVariables;
    }
    getHistoryEntriesFromModel(requests, sessionId, location, forAgentId) {
        const history = [];
        const agent = this.chatAgentService.getAgent(forAgentId);
        for (const request of requests) {
            if (!request.response) {
                continue;
            }
            if (forAgentId !== request.response.agent?.id && !agent?.isDefault && !agent?.canAccessPreviousChatHistory) {
                // An agent only gets to see requests that were sent to this agent.
                // The default agent (the undefined case), or agents with 'canAccessPreviousChatHistory', get to see all of them.
                continue;
            }
            // Do not save to history inline completions
            if (location === ChatAgentLocation.EditorInline) {
                continue;
            }
            const promptTextResult = getPromptText(request.message);
            const historyRequest = {
                sessionId: sessionId,
                sessionResource: request.session.sessionResource,
                requestId: request.id,
                agentId: request.response.agent?.id ?? '',
                message: promptTextResult.message,
                command: request.response.slashCommand?.name,
                variables: updateRanges(request.variableData, promptTextResult.diff), // TODO bit of a hack
                location: ChatAgentLocation.Chat,
                editedFileEvents: request.editedFileEvents,
            };
            history.push({ request: historyRequest, response: toChatHistoryContent(request.response.response.value), result: request.response.result ?? {} });
        }
        return history;
    }
    async removeRequest(sessionResource, requestId) {
        const model = this._sessionModels.get(sessionResource);
        if (!model) {
            throw new Error(`Unknown session: ${sessionResource}`);
        }
        const pendingRequest = this._pendingRequests.get(sessionResource);
        if (pendingRequest?.requestId === requestId) {
            pendingRequest.cancel();
            this._pendingRequests.deleteAndDispose(sessionResource);
        }
        model.removeRequest(requestId);
    }
    async adoptRequest(sessionResource, request) {
        if (!(request instanceof ChatRequestModel)) {
            throw new TypeError('Can only adopt requests of type ChatRequestModel');
        }
        const target = this._sessionModels.get(sessionResource);
        if (!target) {
            throw new Error(`Unknown session: ${sessionResource}`);
        }
        const oldOwner = request.session;
        target.adoptRequest(request);
        if (request.response && !request.response.isComplete) {
            const cts = this._pendingRequests.deleteAndLeak(oldOwner.sessionResource);
            if (cts) {
                cts.requestId = request.id;
                this._pendingRequests.set(target.sessionResource, cts);
            }
        }
    }
    async addCompleteRequest(sessionResource, message, variableData, attempt, response) {
        this.trace('addCompleteRequest', `message: ${message}`);
        const model = this._sessionModels.get(sessionResource);
        if (!model) {
            throw new Error(`Unknown session: ${sessionResource}`);
        }
        const parsedRequest = typeof message === 'string' ?
            this.instantiationService.createInstance(ChatRequestParser).parseChatRequest(sessionResource, message) :
            message;
        const request = model.addRequest(parsedRequest, variableData || { variables: [] }, attempt ?? 0, undefined, undefined, undefined, undefined, undefined, undefined, true);
        if (typeof response.message === 'string') {
            // TODO is this possible?
            model.acceptResponseProgress(request, { content: new MarkdownString(response.message), kind: 'markdownContent' });
        }
        else {
            for (const part of response.message) {
                model.acceptResponseProgress(request, part, true);
            }
        }
        model.setResponse(request, response.result || {});
        if (response.followups !== undefined) {
            model.setFollowups(request, response.followups);
        }
        request.response?.complete();
    }
    cancelCurrentRequestForSession(sessionResource) {
        this.trace('cancelCurrentRequestForSession', `session: ${sessionResource}`);
        this._pendingRequests.get(sessionResource)?.cancel();
        this._pendingRequests.deleteAndDispose(sessionResource);
    }
    // TODO should not exist
    async forceClearSession(sessionResource) {
        this.trace('clearSession', `session: ${sessionResource}`);
        const model = this._sessionModels.get(sessionResource);
        if (!model) {
            throw new Error(`Unknown session: ${sessionResource}`);
        }
        // this._sessionModels.delete(sessionResource);
        model.dispose();
        this._pendingRequests.get(sessionResource)?.cancel();
        this._pendingRequests.deleteAndDispose(sessionResource);
        this._onDidDisposeSession.fire({ sessionResource, reason: 'cleared' });
    }
    hasSessions() {
        return this._chatSessionStore.hasSessions();
    }
    transferChatSession(transferredSessionData, toWorkspace) {
        const model = Iterable.find(this._sessionModels.values(), model => model.sessionId === transferredSessionData.sessionId);
        if (!model) {
            throw new Error(`Failed to transfer session. Unknown session ID: ${transferredSessionData.sessionId}`);
        }
        const existingRaw = this.storageService.getObject(TransferredGlobalChatKey, 0 /* StorageScope.PROFILE */, []);
        existingRaw.push({
            chat: model.toJSON(),
            timestampInMilliseconds: Date.now(),
            toWorkspace: toWorkspace,
            inputState: transferredSessionData.inputState,
            location: transferredSessionData.location,
        });
        this.storageService.store(TransferredGlobalChatKey, JSON.stringify(existingRaw), 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        this.chatTransferService.addWorkspaceToTransferred(toWorkspace);
        this.trace('transferChatSession', `Transferred session ${model.sessionResource} to workspace ${toWorkspace.toString()}`);
    }
    getChatStorageFolder() {
        return this._chatSessionStore.getChatStorageFolder();
    }
    logChatIndex() {
        this._chatSessionStore.logIndex();
    }
    setTitle(sessionResource, title) {
        this._sessionModels.get(sessionResource)?.setCustomTitle(title);
    }
    appendProgress(request, progress) {
        const model = this._sessionModels.get(request.session.sessionResource);
        if (!(request instanceof ChatRequestModel)) {
            throw new BugIndicatingError('Can only append progress to requests of type ChatRequestModel');
        }
        model?.acceptResponseProgress(request, progress);
    }
    toLocalSessionId(sessionResource) {
        const localSessionId = LocalChatSessionUri.parseLocalSessionId(sessionResource);
        if (!localSessionId) {
            throw new Error(`Invalid local chat session resource: ${sessionResource}`);
        }
        return localSessionId;
    }
};
ChatService = __decorate([
    __param(0, IStorageService),
    __param(1, ILogService),
    __param(2, IExtensionService),
    __param(3, IInstantiationService),
    __param(4, IWorkspaceContextService),
    __param(5, IChatSlashCommandService),
    __param(6, IChatAgentService),
    __param(7, IConfigurationService),
    __param(8, IChatTransferService),
    __param(9, IChatSessionsService),
    __param(10, IMcpService)
], ChatService);
export { ChatService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNlcnZpY2VJbXBsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL2NoYXRTZXJ2aWNlSW1wbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbkUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLHVCQUF1QixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBZSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xJLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQWUsTUFBTSx1Q0FBdUMsQ0FBQztBQUN0RixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1B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