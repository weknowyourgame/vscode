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
import { DeferredPromise } from '../../../base/common/async.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable, DisposableMap } from '../../../base/common/lifecycle.js';
import { revive } from '../../../base/common/marshalling.js';
import { Schemas } from '../../../base/common/network.js';
import { escapeRegExpCharacters } from '../../../base/common/strings.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { URI } from '../../../base/common/uri.js';
import { Range } from '../../../editor/common/core/range.js';
import { getWordAtText } from '../../../editor/common/core/wordHelper.js';
import { ILanguageFeaturesService } from '../../../editor/common/services/languageFeatures.js';
import { ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { IUriIdentityService } from '../../../platform/uriIdentity/common/uriIdentity.js';
import { IChatWidgetService } from '../../contrib/chat/browser/chat.js';
import { AddDynamicVariableAction } from '../../contrib/chat/browser/contrib/chatDynamicVariables.js';
import { IChatAgentService } from '../../contrib/chat/common/chatAgents.js';
import { IChatEditingService } from '../../contrib/chat/common/chatEditingService.js';
import { ChatRequestAgentPart } from '../../contrib/chat/common/chatParserTypes.js';
import { ChatRequestParser } from '../../contrib/chat/common/chatRequestParser.js';
import { IChatService } from '../../contrib/chat/common/chatService.js';
import { IChatSessionsService } from '../../contrib/chat/common/chatSessionsService.js';
import { LocalChatSessionUri } from '../../contrib/chat/common/chatUri.js';
import { ChatAgentLocation, ChatModeKind } from '../../contrib/chat/common/constants.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { IExtensionService } from '../../services/extensions/common/extensions.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { NotebookDto } from './mainThreadNotebookDto.js';
export class MainThreadChatTask {
    get onDidAddProgress() { return this._onDidAddProgress.event; }
    constructor(content) {
        this.content = content;
        this.kind = 'progressTask';
        this.deferred = new DeferredPromise();
        this._onDidAddProgress = new Emitter();
        this.progress = [];
    }
    task() {
        return this.deferred.p;
    }
    isSettled() {
        return this.deferred.isSettled;
    }
    complete(v) {
        this.deferred.complete(v);
    }
    add(progress) {
        this.progress.push(progress);
        this._onDidAddProgress.fire(progress);
    }
    toJSON() {
        return {
            kind: 'progressTaskSerialized',
            content: this.content,
            progress: this.progress
        };
    }
}
let MainThreadChatAgents2 = class MainThreadChatAgents2 extends Disposable {
    constructor(extHostContext, _chatAgentService, _chatSessionService, _chatService, _chatEditingService, _languageFeaturesService, _chatWidgetService, _instantiationService, _logService, _extensionService, _uriIdentityService) {
        super();
        this._chatAgentService = _chatAgentService;
        this._chatSessionService = _chatSessionService;
        this._chatService = _chatService;
        this._chatEditingService = _chatEditingService;
        this._languageFeaturesService = _languageFeaturesService;
        this._chatWidgetService = _chatWidgetService;
        this._instantiationService = _instantiationService;
        this._logService = _logService;
        this._extensionService = _extensionService;
        this._uriIdentityService = _uriIdentityService;
        this._agents = this._register(new DisposableMap());
        this._agentCompletionProviders = this._register(new DisposableMap());
        this._agentIdsToCompletionProviders = this._register(new DisposableMap);
        this._chatParticipantDetectionProviders = this._register(new DisposableMap());
        this._chatRelatedFilesProviders = this._register(new DisposableMap());
        this._pendingProgress = new Map();
        this._activeTasks = new Map();
        this._unresolvedAnchors = new Map();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostChatAgents2);
        this._register(this._chatService.onDidDisposeSession(e => {
            const localSessionId = LocalChatSessionUri.parseLocalSessionId(e.sessionResource);
            if (localSessionId) {
                this._proxy.$releaseSession(localSessionId);
            }
        }));
        this._register(this._chatService.onDidPerformUserAction(e => {
            if (typeof e.agentId === 'string') {
                for (const [handle, agent] of this._agents) {
                    if (agent.id === e.agentId) {
                        if (e.action.kind === 'vote') {
                            this._proxy.$acceptFeedback(handle, e.result ?? {}, e.action);
                        }
                        else {
                            this._proxy.$acceptAction(handle, e.result || {}, e);
                        }
                        break;
                    }
                }
            }
        }));
    }
    $unregisterAgent(handle) {
        this._agents.deleteAndDispose(handle);
    }
    $transferActiveChatSession(toWorkspace) {
        const widget = this._chatWidgetService.lastFocusedWidget;
        const model = widget?.viewModel?.model;
        if (!model) {
            this._logService.error(`MainThreadChat#$transferActiveChatSession: No active chat session found`);
            return;
        }
        const location = widget.location;
        this._chatService.transferChatSession({ sessionId: model.sessionId, inputState: model.inputModel.state.get(), location }, URI.revive(toWorkspace));
    }
    async $registerAgent(handle, extension, id, metadata, dynamicProps) {
        await this._extensionService.whenInstalledExtensionsRegistered();
        const staticAgentRegistration = this._chatAgentService.getAgent(id, true);
        const chatSessionRegistration = this._chatSessionService.getAllChatSessionContributions().find(c => c.type === id || c.alternativeIds?.includes(id));
        if (!staticAgentRegistration && !chatSessionRegistration && !dynamicProps) {
            if (this._chatAgentService.getAgentsByName(id).length) {
                // Likely some extension authors will not adopt the new ID, so give a hint if they register a
                // participant by name instead of ID.
                throw new Error(`chatParticipant must be declared with an ID in package.json. The "id" property may be missing! "${id}"`);
            }
            throw new Error(`chatParticipant must be declared in package.json: ${id}`);
        }
        const impl = {
            invoke: async (request, progress, history, token) => {
                const chatSession = this._chatService.getSession(request.sessionResource);
                this._pendingProgress.set(request.requestId, { progress, chatSession });
                try {
                    return await this._proxy.$invokeAgent(handle, request, {
                        history,
                        chatSessionContext: chatSession?.contributedChatSession
                    }, token) ?? {};
                }
                finally {
                    this._pendingProgress.delete(request.requestId);
                }
            },
            setRequestTools: (requestId, tools) => {
                this._proxy.$setRequestTools(requestId, tools);
            },
            provideFollowups: async (request, result, history, token) => {
                if (!this._agents.get(handle)?.hasFollowups) {
                    return [];
                }
                return this._proxy.$provideFollowups(request, handle, result, { history }, token);
            },
            provideChatTitle: (history, token) => {
                return this._proxy.$provideChatTitle(handle, history, token);
            },
            provideChatSummary: (history, token) => {
                return this._proxy.$provideChatSummary(handle, history, token);
            },
        };
        let disposable;
        if (!staticAgentRegistration && dynamicProps) {
            const extensionDescription = this._extensionService.extensions.find(e => ExtensionIdentifier.equals(e.identifier, extension));
            disposable = this._chatAgentService.registerDynamicAgent({
                id,
                name: dynamicProps.name,
                description: dynamicProps.description,
                extensionId: extension,
                extensionVersion: extensionDescription?.version,
                extensionDisplayName: extensionDescription?.displayName ?? extension.value,
                extensionPublisherId: extensionDescription?.publisher ?? '',
                publisherDisplayName: dynamicProps.publisherName,
                fullName: dynamicProps.fullName,
                metadata: revive(metadata),
                slashCommands: [],
                disambiguation: [],
                locations: [ChatAgentLocation.Chat],
                modes: [ChatModeKind.Ask, ChatModeKind.Agent, ChatModeKind.Edit],
            }, impl);
        }
        else {
            disposable = this._chatAgentService.registerAgentImplementation(id, impl);
        }
        this._agents.set(handle, {
            id: id,
            extensionId: extension,
            dispose: () => disposable.dispose(),
            hasFollowups: metadata.hasFollowups
        });
    }
    async $updateAgent(handle, metadataUpdate) {
        await this._extensionService.whenInstalledExtensionsRegistered();
        const data = this._agents.get(handle);
        if (!data) {
            this._logService.error(`MainThreadChatAgents2#$updateAgent: No agent with handle ${handle} registered`);
            return;
        }
        data.hasFollowups = metadataUpdate.hasFollowups;
        this._chatAgentService.updateAgent(data.id, revive(metadataUpdate));
    }
    async $handleProgressChunk(requestId, chunks) {
        const pendingProgress = this._pendingProgress.get(requestId);
        if (!pendingProgress) {
            this._logService.warn(`MainThreadChatAgents2#$handleProgressChunk: No pending progress for requestId ${requestId}`);
            return;
        }
        const { progress, chatSession } = pendingProgress;
        const chatProgressParts = [];
        for (const item of chunks) {
            const [progress, responsePartHandle] = Array.isArray(item) ? item : [item];
            if (progress.kind === 'externalEdits') {
                // todo@connor4312: be more specific here, pass response model through to invocation?
                const response = chatSession?.getRequests().at(-1)?.response;
                if (chatSession?.editingSession && responsePartHandle !== undefined && response) {
                    const parts = progress.start
                        ? await chatSession.editingSession.startExternalEdits(response, responsePartHandle, revive(progress.resources))
                        : await chatSession.editingSession.stopExternalEdits(response, responsePartHandle);
                    chatProgressParts.push(...parts);
                }
                continue;
            }
            const revivedProgress = progress.kind === 'notebookEdit'
                ? ChatNotebookEdit.fromChatEdit(progress)
                : revive(progress);
            if (revivedProgress.kind === 'notebookEdit'
                || revivedProgress.kind === 'textEdit'
                || revivedProgress.kind === 'codeblockUri') {
                // make sure to use the canonical uri
                revivedProgress.uri = this._uriIdentityService.asCanonicalUri(revivedProgress.uri);
            }
            if (responsePartHandle !== undefined) {
                if (revivedProgress.kind === 'progressTask') {
                    const handle = responsePartHandle;
                    const responsePartId = `${requestId}_${handle}`;
                    const task = new MainThreadChatTask(revivedProgress.content);
                    this._activeTasks.set(responsePartId, task);
                    chatProgressParts.push(task);
                }
                else if (responsePartHandle !== undefined) {
                    const responsePartId = `${requestId}_${responsePartHandle}`;
                    const task = this._activeTasks.get(responsePartId);
                    switch (revivedProgress.kind) {
                        case 'progressTaskResult':
                            if (task && revivedProgress.content) {
                                task.complete(revivedProgress.content.value);
                                this._activeTasks.delete(responsePartId);
                            }
                            else {
                                task?.complete(undefined);
                            }
                            break;
                        case 'warning':
                        case 'reference':
                            task?.add(revivedProgress);
                            break;
                    }
                }
                continue;
            }
            if (revivedProgress.kind === 'inlineReference' && revivedProgress.resolveId) {
                if (!this._unresolvedAnchors.has(requestId)) {
                    this._unresolvedAnchors.set(requestId, new Map());
                }
                this._unresolvedAnchors.get(requestId)?.set(revivedProgress.resolveId, revivedProgress);
            }
            chatProgressParts.push(revivedProgress);
        }
        progress(chatProgressParts);
    }
    $handleAnchorResolve(requestId, handle, resolveAnchor) {
        const anchor = this._unresolvedAnchors.get(requestId)?.get(handle);
        if (!anchor) {
            return;
        }
        this._unresolvedAnchors.get(requestId)?.delete(handle);
        if (resolveAnchor) {
            const revivedAnchor = revive(resolveAnchor);
            anchor.inlineReference = revivedAnchor.inlineReference;
        }
    }
    $registerAgentCompletionsProvider(handle, id, triggerCharacters) {
        const provide = async (query, token) => {
            const completions = await this._proxy.$invokeCompletionProvider(handle, query, token);
            return completions.map((c) => ({ ...c, icon: c.icon ? ThemeIcon.fromId(c.icon) : undefined }));
        };
        this._agentIdsToCompletionProviders.set(id, this._chatAgentService.registerAgentCompletionProvider(id, provide));
        this._agentCompletionProviders.set(handle, this._languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
            _debugDisplayName: 'chatAgentCompletions:' + handle,
            triggerCharacters,
            provideCompletionItems: async (model, position, _context, token) => {
                const widget = this._chatWidgetService.getWidgetByInputUri(model.uri);
                if (!widget || !widget.viewModel) {
                    return;
                }
                const triggerCharsPart = triggerCharacters.map(c => escapeRegExpCharacters(c)).join('');
                const wordRegex = new RegExp(`[${triggerCharsPart}]\\S*`, 'g');
                const query = getWordAtText(position.column, wordRegex, model.getLineContent(position.lineNumber), 0)?.word ?? '';
                if (query && !triggerCharacters.some(c => query.startsWith(c))) {
                    return;
                }
                const parsedRequest = this._instantiationService.createInstance(ChatRequestParser).parseChatRequest(widget.viewModel.sessionResource, model.getValue()).parts;
                const agentPart = parsedRequest.find((part) => part instanceof ChatRequestAgentPart);
                const thisAgentId = this._agents.get(handle)?.id;
                if (agentPart?.agent.id !== thisAgentId) {
                    return;
                }
                const range = computeCompletionRanges(model, position, wordRegex);
                if (!range) {
                    return null;
                }
                const result = await provide(query, token);
                const variableItems = result.map(v => {
                    const insertText = v.insertText ?? (typeof v.label === 'string' ? v.label : v.label.label);
                    const rangeAfterInsert = new Range(range.insert.startLineNumber, range.insert.startColumn, range.insert.endLineNumber, range.insert.startColumn + insertText.length);
                    return {
                        label: v.label,
                        range,
                        insertText: insertText + ' ',
                        kind: 18 /* CompletionItemKind.Text */,
                        detail: v.detail,
                        documentation: v.documentation,
                        command: { id: AddDynamicVariableAction.ID, title: '', arguments: [{ id: v.id, widget, range: rangeAfterInsert, variableData: revive(v.value), command: v.command }] }
                    };
                });
                return {
                    suggestions: variableItems
                };
            }
        }));
    }
    $unregisterAgentCompletionsProvider(handle, id) {
        this._agentCompletionProviders.deleteAndDispose(handle);
        this._agentIdsToCompletionProviders.deleteAndDispose(id);
    }
    $registerChatParticipantDetectionProvider(handle) {
        this._chatParticipantDetectionProviders.set(handle, this._chatAgentService.registerChatParticipantDetectionProvider(handle, {
            provideParticipantDetection: async (request, history, options, token) => {
                return await this._proxy.$detectChatParticipant(handle, request, { history }, options, token);
            }
        }));
    }
    $unregisterChatParticipantDetectionProvider(handle) {
        this._chatParticipantDetectionProviders.deleteAndDispose(handle);
    }
    $registerRelatedFilesProvider(handle, metadata) {
        this._chatRelatedFilesProviders.set(handle, this._chatEditingService.registerRelatedFilesProvider(handle, {
            description: metadata.description,
            provideRelatedFiles: async (request, token) => {
                return (await this._proxy.$provideRelatedFiles(handle, request, token))?.map((v) => ({ uri: URI.from(v.uri), description: v.description })) ?? [];
            }
        }));
    }
    $unregisterRelatedFilesProvider(handle) {
        this._chatRelatedFilesProviders.deleteAndDispose(handle);
    }
};
MainThreadChatAgents2 = __decorate([
    extHostNamedCustomer(MainContext.MainThreadChatAgents2),
    __param(1, IChatAgentService),
    __param(2, IChatSessionsService),
    __param(3, IChatService),
    __param(4, IChatEditingService),
    __param(5, ILanguageFeaturesService),
    __param(6, IChatWidgetService),
    __param(7, IInstantiationService),
    __param(8, ILogService),
    __param(9, IExtensionService),
    __param(10, IUriIdentityService)
], MainThreadChatAgents2);
export { MainThreadChatAgents2 };
function computeCompletionRanges(model, position, reg) {
    const varWord = getWordAtText(position.column, reg, model.getLineContent(position.lineNumber), 0);
    if (!varWord && model.getWordUntilPosition(position).word) {
        // inside a "normal" word
        return;
    }
    let insert;
    let replace;
    if (!varWord) {
        insert = replace = Range.fromPositions(position);
    }
    else {
        insert = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, position.column);
        replace = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, varWord.endColumn);
    }
    return { insert, replace };
}
var ChatNotebookEdit;
(function (ChatNotebookEdit) {
    function fromChatEdit(part) {
        return {
            kind: 'notebookEdit',
            uri: URI.revive(part.uri),
            done: part.done,
            edits: part.edits.map(NotebookDto.fromCellEditOperationDto)
        };
    }
    ChatNotebookEdit.fromChatEdit = fromChatEdit;
})(ChatNotebookEdit || (ChatNotebookEdit = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZENoYXRBZ2VudHMyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvYnJvd3Nlci9tYWluVGhyZWFkQ2hhdEFnZW50czIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBRWhFLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSwrQkFBK0IsQ0FBQztBQUUvRCxPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBZSxNQUFNLG1DQUFtQyxDQUFDO0FBQzNGLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDMUQsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDekUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxHQUFHLEVBQWlCLE1BQU0sNkJBQTZCLENBQUM7QUFFakUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUcxRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUMvRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUN4RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUNoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDbEUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0scURBQXFELENBQUM7QUFDMUYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1B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