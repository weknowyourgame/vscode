/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { coalesce } from '../../../base/common/arrays.js';
import { timeout } from '../../../base/common/async.js';
import { CancellationTokenSource } from '../../../base/common/cancellation.js';
import { toErrorMessage } from '../../../base/common/errorMessage.js';
import { Emitter } from '../../../base/common/event.js';
import { Iterable } from '../../../base/common/iterator.js';
import { Disposable, DisposableMap, DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { revive } from '../../../base/common/marshalling.js';
import { StopWatch } from '../../../base/common/stopwatch.js';
import { assertType } from '../../../base/common/types.js';
import { URI } from '../../../base/common/uri.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
import { isChatViewTitleActionContext } from '../../contrib/chat/common/chatActions.js';
import { ChatAgentVoteDirection } from '../../contrib/chat/common/chatService.js';
import { ChatAgentLocation } from '../../contrib/chat/common/constants.js';
import { checkProposedApiEnabled, isProposedApiEnabled } from '../../services/extensions/common/extensions.js';
import { MainContext } from './extHost.protocol.js';
import * as typeConvert from './extHostTypeConverters.js';
import * as extHostTypes from './extHostTypes.js';
export class ChatAgentResponseStream {
    constructor(_extension, _request, _proxy, _commandsConverter, _sessionDisposables) {
        this._extension = _extension;
        this._request = _request;
        this._proxy = _proxy;
        this._commandsConverter = _commandsConverter;
        this._sessionDisposables = _sessionDisposables;
        this._stopWatch = StopWatch.create(false);
        this._isClosed = false;
    }
    close() {
        this._isClosed = true;
    }
    get timings() {
        return {
            firstProgress: this._firstProgress,
            totalElapsed: this._stopWatch.elapsed()
        };
    }
    get apiObject() {
        if (!this._apiObject) {
            const that = this;
            this._stopWatch.reset();
            let taskHandlePool = 0;
            function throwIfDone(source) {
                if (that._isClosed) {
                    const err = new Error('Response stream has been closed');
                    Error.captureStackTrace(err, source);
                    throw err;
                }
            }
            const sendQueue = [];
            let notify = [];
            function send(chunk, handle) {
                // push data into send queue. the first entry schedules the micro task which
                // does the actual send to the main thread
                const newLen = sendQueue.push(handle !== undefined ? [chunk, handle] : chunk);
                if (newLen === 1) {
                    queueMicrotask(() => {
                        const toNotify = notify;
                        notify = [];
                        that._proxy.$handleProgressChunk(that._request.requestId, sendQueue).finally(() => {
                            toNotify.forEach(f => f());
                        });
                        sendQueue.length = 0;
                    });
                }
                if (handle !== undefined) {
                    return new Promise(resolve => { notify.push(resolve); });
                }
                return;
            }
            const _report = (progress, task) => {
                // Measure the time to the first progress update with real markdown content
                if (typeof this._firstProgress === 'undefined' && (progress.kind === 'markdownContent' || progress.kind === 'markdownVuln' || progress.kind === 'prepareToolInvocation')) {
                    this._firstProgress = this._stopWatch.elapsed();
                }
                if (task) {
                    const myHandle = taskHandlePool++;
                    const progressReporterPromise = send(progress, myHandle);
                    const progressReporter = {
                        report: (p) => {
                            progressReporterPromise.then(() => {
                                if (extHostTypes.MarkdownString.isMarkdownString(p.value)) {
                                    send(typeConvert.ChatResponseWarningPart.from(p), myHandle);
                                }
                                else {
                                    send(typeConvert.ChatResponseReferencePart.from(p), myHandle);
                                }
                            });
                        }
                    };
                    Promise.all([progressReporterPromise, task(progressReporter)]).then(([_void, res]) => {
                        send(typeConvert.ChatTaskResult.from(res), myHandle);
                    });
                }
                else {
                    send(progress);
                }
            };
            this._apiObject = Object.freeze({
                clearToPreviousToolInvocation(reason) {
                    throwIfDone(this.markdown);
                    send({ kind: 'clearToPreviousToolInvocation', reason: reason });
                    return this;
                },
                markdown(value) {
                    throwIfDone(this.markdown);
                    const part = new extHostTypes.ChatResponseMarkdownPart(value);
                    const dto = typeConvert.ChatResponseMarkdownPart.from(part);
                    _report(dto);
                    return this;
                },
                markdownWithVulnerabilities(value, vulnerabilities) {
                    throwIfDone(this.markdown);
                    if (vulnerabilities) {
                        checkProposedApiEnabled(that._extension, 'chatParticipantAdditions');
                    }
                    const part = new extHostTypes.ChatResponseMarkdownWithVulnerabilitiesPart(value, vulnerabilities);
                    const dto = typeConvert.ChatResponseMarkdownWithVulnerabilitiesPart.from(part);
                    _report(dto);
                    return this;
                },
                codeblockUri(value, isEdit) {
                    throwIfDone(this.codeblockUri);
                    checkProposedApiEnabled(that._extension, 'chatParticipantAdditions');
                    const part = new extHostTypes.ChatResponseCodeblockUriPart(value, isEdit);
                    const dto = typeConvert.ChatResponseCodeblockUriPart.from(part);
                    _report(dto);
                    return this;
                },
                filetree(value, baseUri) {
                    throwIfDone(this.filetree);
                    const part = new extHostTypes.ChatResponseFileTreePart(value, baseUri);
                    const dto = typeConvert.ChatResponseFilesPart.from(part);
                    _report(dto);
                    return this;
                },
                anchor(value, title) {
                    const part = new extHostTypes.ChatResponseAnchorPart(value, title);
                    return this.push(part);
                },
                button(value) {
                    throwIfDone(this.anchor);
                    const part = new extHostTypes.ChatResponseCommandButtonPart(value);
                    const dto = typeConvert.ChatResponseCommandButtonPart.from(part, that._commandsConverter, that._sessionDisposables);
                    _report(dto);
                    return this;
                },
                progress(value, task) {
                    throwIfDone(this.progress);
                    const part = new extHostTypes.ChatResponseProgressPart2(value, task);
                    const dto = task ? typeConvert.ChatTask.from(part) : typeConvert.ChatResponseProgressPart.from(part);
                    _report(dto, task);
                    return this;
                },
                thinkingProgress(thinkingDelta) {
                    throwIfDone(this.thinkingProgress);
                    checkProposedApiEnabled(that._extension, 'chatParticipantAdditions');
                    const part = new extHostTypes.ChatResponseThinkingProgressPart(thinkingDelta.text ?? '', thinkingDelta.id, thinkingDelta.metadata);
                    const dto = typeConvert.ChatResponseThinkingProgressPart.from(part);
                    _report(dto);
                    return this;
                },
                warning(value) {
                    throwIfDone(this.progress);
                    checkProposedApiEnabled(that._extension, 'chatParticipantAdditions');
                    const part = new extHostTypes.ChatResponseWarningPart(value);
                    const dto = typeConvert.ChatResponseWarningPart.from(part);
                    _report(dto);
                    return this;
                },
                reference(value, iconPath) {
                    return this.reference2(value, iconPath);
                },
                reference2(value, iconPath, options) {
                    throwIfDone(this.reference);
                    if (typeof value === 'object' && 'variableName' in value) {
                        checkProposedApiEnabled(that._extension, 'chatParticipantAdditions');
                    }
                    if (typeof value === 'object' && 'variableName' in value && !value.value) {
                        // The participant used this variable. Does that variable have any references to pull in?
                        const matchingVarData = that._request.variables.variables.find(v => v.name === value.variableName);
                        if (matchingVarData) {
                            let references;
                            if (matchingVarData.references?.length) {
                                references = matchingVarData.references.map(r => ({
                                    kind: 'reference',
                                    reference: { variableName: value.variableName, value: r.reference }
                                }));
                            }
                            else {
                                // Participant sent a variableName reference but the variable produced no references. Show variable reference with no value
                                const part = new extHostTypes.ChatResponseReferencePart(value, iconPath, options);
                                const dto = typeConvert.ChatResponseReferencePart.from(part);
                                references = [dto];
                            }
                            references.forEach(r => _report(r));
                            return this;
                        }
                        else {
                            // Something went wrong- that variable doesn't actually exist
                        }
                    }
                    else {
                        const part = new extHostTypes.ChatResponseReferencePart(value, iconPath, options);
                        const dto = typeConvert.ChatResponseReferencePart.from(part);
                        _report(dto);
                    }
                    return this;
                },
                codeCitation(value, license, snippet) {
                    throwIfDone(this.codeCitation);
                    checkProposedApiEnabled(that._extension, 'chatParticipantAdditions');
                    const part = new extHostTypes.ChatResponseCodeCitationPart(value, license, snippet);
                    const dto = typeConvert.ChatResponseCodeCitationPart.from(part);
                    _report(dto);
                },
                textEdit(target, edits) {
                    throwIfDone(this.textEdit);
                    checkProposedApiEnabled(that._extension, 'chatParticipantAdditions');
                    const part = new extHostTypes.ChatResponseTextEditPart(target, edits);
                    part.isDone = edits === true ? true : undefined;
                    const dto = typeConvert.ChatResponseTextEditPart.from(part);
                    _report(dto);
                    return this;
                },
                notebookEdit(target, edits) {
                    throwIfDone(this.notebookEdit);
                    checkProposedApiEnabled(that._extension, 'chatParticipantAdditions');
                    const part = new extHostTypes.ChatResponseNotebookEditPart(target, edits);
                    const dto = typeConvert.ChatResponseNotebookEditPart.from(part);
                    _report(dto);
                    return this;
                },
                async externalEdit(target, callback) {
                    throwIfDone(this.externalEdit);
                    const resources = Array.isArray(target) ? target : [target];
                    const operationId = taskHandlePool++;
                    await send({ kind: 'externalEdits', start: true, resources }, operationId);
                    try {
                        return await callback();
                    }
                    finally {
                        await send({ kind: 'externalEdits', start: false, resources }, operationId);
                    }
                },
                confirmation(title, message, data, buttons) {
                    throwIfDone(this.confirmation);
                    checkProposedApiEnabled(that._extension, 'chatParticipantAdditions');
                    const part = new extHostTypes.ChatResponseConfirmationPart(title, message, data, buttons);
                    const dto = typeConvert.ChatResponseConfirmationPart.from(part);
                    _report(dto);
                    return this;
                },
                prepareToolInvocation(toolName) {
                    throwIfDone(this.prepareToolInvocation);
                    checkProposedApiEnabled(that._extension, 'chatParticipantAdditions');
                    const part = new extHostTypes.ChatPrepareToolInvocationPart(toolName);
                    const dto = typeConvert.ChatPrepareToolInvocationPart.from(part);
                    _report(dto);
                    return this;
                },
                push(part) {
                    throwIfDone(this.push);
                    if (part instanceof extHostTypes.ChatResponseTextEditPart ||
                        part instanceof extHostTypes.ChatResponseNotebookEditPart ||
                        part instanceof extHostTypes.ChatResponseMarkdownWithVulnerabilitiesPart ||
                        part instanceof extHostTypes.ChatResponseWarningPart ||
                        part instanceof extHostTypes.ChatResponseConfirmationPart ||
                        part instanceof extHostTypes.ChatResponseCodeCitationPart ||
                        part instanceof extHostTypes.ChatResponseMovePart ||
                        part instanceof extHostTypes.ChatResponseExtensionsPart ||
                        part instanceof extHostTypes.ChatResponseExternalEditPart ||
                        part instanceof extHostTypes.ChatResponseThinkingProgressPart ||
                        part instanceof extHostTypes.ChatResponsePullRequestPart ||
                        part instanceof extHostTypes.ChatResponseProgressPart2) {
                        checkProposedApiEnabled(that._extension, 'chatParticipantAdditions');
                    }
                    if (part instanceof extHostTypes.ChatResponseReferencePart) {
                        // Ensure variable reference values get fixed up
                        this.reference2(part.value, part.iconPath, part.options);
                    }
                    else if (part instanceof extHostTypes.ChatResponseProgressPart2) {
                        const dto = part.task ? typeConvert.ChatTask.from(part) : typeConvert.ChatResponseProgressPart.from(part);
                        _report(dto, part.task);
                    }
                    else if (part instanceof extHostTypes.ChatResponseThinkingProgressPart) {
                        const dto = typeConvert.ChatResponseThinkingProgressPart.from(part);
                        _report(dto);
                    }
                    else if (part instanceof extHostTypes.ChatResponseAnchorPart) {
                        const dto = typeConvert.ChatResponseAnchorPart.from(part);
                        if (part.resolve) {
                            checkProposedApiEnabled(that._extension, 'chatParticipantAdditions');
                            dto.resolveId = generateUuid();
                            const cts = new CancellationTokenSource();
                            part.resolve(cts.token)
                                .then(() => {
                                const resolvedDto = typeConvert.ChatResponseAnchorPart.from(part);
                                that._proxy.$handleAnchorResolve(that._request.requestId, dto.resolveId, resolvedDto);
                            })
                                .then(() => cts.dispose(), () => cts.dispose());
                            that._sessionDisposables.add(toDisposable(() => cts.dispose(true)));
                        }
                        _report(dto);
                    }
                    else if (part instanceof extHostTypes.ChatPrepareToolInvocationPart) {
                        checkProposedApiEnabled(that._extension, 'chatParticipantAdditions');
                        const dto = typeConvert.ChatPrepareToolInvocationPart.from(part);
                        _report(dto);
                        return this;
                    }
                    else if (part instanceof extHostTypes.ChatResponseExternalEditPart) {
                        const p = this.externalEdit(part.uris, part.callback);
                        p.then(() => part.didGetApplied());
                        return this;
                    }
                    else {
                        const dto = typeConvert.ChatResponsePart.from(part, that._commandsConverter, that._sessionDisposables);
                        _report(dto);
                    }
                    return this;
                },
            });
        }
        return this._apiObject;
    }
}
export class ExtHostChatAgents2 extends Disposable {
    static { this._idPool = 0; }
    static { this._participantDetectionProviderIdPool = 0; }
    static { this._relatedFilesProviderIdPool = 0; }
    constructor(mainContext, _logService, _commands, _documents, _languageModels, _diagnostics, _tools) {
        super();
        this._logService = _logService;
        this._commands = _commands;
        this._documents = _documents;
        this._languageModels = _languageModels;
        this._diagnostics = _diagnostics;
        this._tools = _tools;
        this._agents = new Map();
        this._participantDetectionProviders = new Map();
        this._relatedFilesProviders = new Map();
        this._sessionDisposables = this._register(new DisposableMap());
        this._completionDisposables = this._register(new DisposableMap());
        this._inFlightRequests = new Set();
        this._onDidChangeChatRequestTools = this._register(new Emitter());
        this.onDidChangeChatRequestTools = this._onDidChangeChatRequestTools.event;
        this._onDidDisposeChatSession = this._register(new Emitter());
        this.onDidDisposeChatSession = this._onDidDisposeChatSession.event;
        this._proxy = mainContext.getProxy(MainContext.MainThreadChatAgents2);
        _commands.registerArgumentProcessor({
            processArgument: (arg) => {
                // Don't send this argument to extension commands
                if (isChatViewTitleActionContext(arg)) {
                    return null;
                }
                return arg;
            }
        });
    }
    transferActiveChat(newWorkspace) {
        this._proxy.$transferActiveChatSession(newWorkspace);
    }
    createChatAgent(extension, id, handler) {
        const handle = ExtHostChatAgents2._idPool++;
        const agent = new ExtHostChatAgent(extension, id, this._proxy, handle, handler);
        this._agents.set(handle, agent);
        this._proxy.$registerAgent(handle, extension.identifier, id, {}, undefined);
        return agent.apiAgent;
    }
    createDynamicChatAgent(extension, id, dynamicProps, handler) {
        const handle = ExtHostChatAgents2._idPool++;
        const agent = new ExtHostChatAgent(extension, id, this._proxy, handle, handler);
        this._agents.set(handle, agent);
        this._proxy.$registerAgent(handle, extension.identifier, id, { isSticky: true }, dynamicProps);
        return agent.apiAgent;
    }
    registerChatParticipantDetectionProvider(extension, provider) {
        const handle = ExtHostChatAgents2._participantDetectionProviderIdPool++;
        this._participantDetectionProviders.set(handle, new ExtHostParticipantDetector(extension, provider));
        this._proxy.$registerChatParticipantDetectionProvider(handle);
        return toDisposable(() => {
            this._participantDetectionProviders.delete(handle);
            this._proxy.$unregisterChatParticipantDetectionProvider(handle);
        });
    }
    registerRelatedFilesProvider(extension, provider, metadata) {
        const handle = ExtHostChatAgents2._relatedFilesProviderIdPool++;
        this._relatedFilesProviders.set(handle, new ExtHostRelatedFilesProvider(extension, provider));
        this._proxy.$registerRelatedFilesProvider(handle, metadata);
        return toDisposable(() => {
            this._relatedFilesProviders.delete(handle);
            this._proxy.$unregisterRelatedFilesProvider(handle);
        });
    }
    async $provideRelatedFiles(handle, request, token) {
        const provider = this._relatedFilesProviders.get(handle);
        if (!provider) {
            return Promise.resolve([]);
        }
        const extRequestDraft = typeConvert.ChatRequestDraft.to(request);
        return await provider.provider.provideRelatedFiles(extRequestDraft, token) ?? undefined;
    }
    async $detectChatParticipant(handle, requestDto, context, options, token) {
        const detector = this._participantDetectionProviders.get(handle);
        if (!detector) {
            return undefined;
        }
        const { request, location, history } = await this._createRequest(requestDto, context, detector.extension);
        const model = await this.getModelForRequest(request, detector.extension);
        const extRequest = typeConvert.ChatAgentRequest.to(request, location, model, this.getDiagnosticsWhenEnabled(detector.extension), this.getToolsForRequest(detector.extension, request.userSelectedTools), detector.extension, this._logService);
        return detector.provider.provideParticipantDetection(extRequest, { history }, { participants: options.participants, location: typeConvert.ChatLocation.to(options.location) }, token);
    }
    async _createRequest(requestDto, context, extension) {
        const request = revive(requestDto);
        const convertedHistory = await this.prepareHistoryTurns(extension, request.agentId, context);
        // in-place converting for location-data
        let location;
        if (request.locationData?.type === ChatAgentLocation.EditorInline) {
            // editor data
            const document = this._documents.getDocument(request.locationData.document);
            location = new extHostTypes.ChatRequestEditorData(document, typeConvert.Selection.to(request.locationData.selection), typeConvert.Range.to(request.locationData.wholeRange));
        }
        else if (request.locationData?.type === ChatAgentLocation.Notebook) {
            // notebook data
            const cell = this._documents.getDocument(request.locationData.sessionInputUri);
            location = new extHostTypes.ChatRequestNotebookData(cell);
        }
        else if (request.locationData?.type === ChatAgentLocation.Terminal) {
            // TBD
        }
        return { request, location, history: convertedHistory };
    }
    async getModelForRequest(request, extension) {
        let model;
        if (request.userSelectedModelId) {
            model = await this._languageModels.getLanguageModelByIdentifier(extension, request.userSelectedModelId);
        }
        if (!model) {
            model = await this._languageModels.getDefaultLanguageModel(extension);
            if (!model) {
                throw new Error('Language model unavailable');
            }
        }
        return model;
    }
    async $setRequestTools(requestId, tools) {
        const request = [...this._inFlightRequests].find(r => r.requestId === requestId);
        if (!request) {
            return;
        }
        request.extRequest.tools.clear();
        for (const [k, v] of this.getToolsForRequest(request.extension, tools)) {
            request.extRequest.tools.set(k, v);
        }
        this._onDidChangeChatRequestTools.fire(request.extRequest);
    }
    async $invokeAgent(handle, requestDto, context, token) {
        const agent = this._agents.get(handle);
        if (!agent) {
            throw new Error(`[CHAT](${handle}) CANNOT invoke agent because the agent is not registered`);
        }
        let stream;
        let inFlightRequest;
        try {
            const { request, location, history } = await this._createRequest(requestDto, context, agent.extension);
            // Init session disposables
            let sessionDisposables = this._sessionDisposables.get(request.sessionId);
            if (!sessionDisposables) {
                sessionDisposables = new DisposableStore();
                this._sessionDisposables.set(request.sessionId, sessionDisposables);
            }
            stream = new ChatAgentResponseStream(agent.extension, request, this._proxy, this._commands.converter, sessionDisposables);
            const model = await this.getModelForRequest(request, agent.extension);
            const extRequest = typeConvert.ChatAgentRequest.to(request, location, model, this.getDiagnosticsWhenEnabled(agent.extension), this.getToolsForRequest(agent.extension, request.userSelectedTools), agent.extension, this._logService);
            inFlightRequest = { requestId: requestDto.requestId, extRequest, extension: agent.extension };
            this._inFlightRequests.add(inFlightRequest);
            // If this request originates from a contributed chat session editor, attempt to resolve the ChatSession API object
            let chatSessionContext;
            if (context.chatSessionContext) {
                chatSessionContext = {
                    chatSessionItem: {
                        resource: URI.revive(context.chatSessionContext.chatSessionResource),
                        label: context.chatSessionContext.isUntitled ? 'Untitled Session' : 'Session',
                    },
                    isUntitled: context.chatSessionContext.isUntitled,
                };
            }
            const chatContext = { history, chatSessionContext };
            const task = agent.invoke(extRequest, chatContext, stream.apiObject, token);
            return await raceCancellationWithTimeout(1000, Promise.resolve(task).then((result) => {
                if (result?.metadata) {
                    try {
                        JSON.stringify(result.metadata);
                    }
                    catch (err) {
                        const msg = `result.metadata MUST be JSON.stringify-able. Got error: ${err.message}`;
                        this._logService.error(`[${agent.extension.identifier.value}] [@${agent.id}] ${msg}`, agent.extension);
                        return { errorDetails: { message: msg }, timings: stream?.timings, nextQuestion: result.nextQuestion, };
                    }
                }
                let errorDetails;
                if (result?.errorDetails) {
                    errorDetails = {
                        ...result.errorDetails,
                        responseIsIncomplete: true
                    };
                }
                if (errorDetails?.responseIsRedacted || errorDetails?.isQuotaExceeded || errorDetails?.isRateLimited || errorDetails?.confirmationButtons || errorDetails?.code) {
                    checkProposedApiEnabled(agent.extension, 'chatParticipantPrivate');
                }
                return { errorDetails, timings: stream?.timings, metadata: result?.metadata, nextQuestion: result?.nextQuestion, details: result?.details };
            }), token);
        }
        catch (e) {
            this._logService.error(e, agent.extension);
            if (e instanceof extHostTypes.LanguageModelError && e.cause) {
                e = e.cause;
            }
            const isQuotaExceeded = e instanceof Error && e.name === 'ChatQuotaExceeded';
            const isRateLimited = e instanceof Error && e.name === 'ChatRateLimited';
            return { errorDetails: { message: toErrorMessage(e), responseIsIncomplete: true, isQuotaExceeded, isRateLimited } };
        }
        finally {
            if (inFlightRequest) {
                this._inFlightRequests.delete(inFlightRequest);
            }
            stream?.close();
        }
    }
    getDiagnosticsWhenEnabled(extension) {
        if (!isProposedApiEnabled(extension, 'chatReferenceDiagnostic')) {
            return [];
        }
        return this._diagnostics.getDiagnostics();
    }
    getToolsForRequest(extension, tools) {
        if (!tools) {
            return new Map();
        }
        const result = new Map();
        for (const tool of this._tools.getTools(extension)) {
            if (typeof tools[tool.name] === 'boolean') {
                result.set(tool.name, tools[tool.name]);
            }
        }
        return result;
    }
    async prepareHistoryTurns(extension, agentId, context) {
        const res = [];
        for (const h of context.history) {
            const ehResult = typeConvert.ChatAgentResult.to(h.result);
            const result = agentId === h.request.agentId ?
                ehResult :
                { ...ehResult, metadata: undefined };
            // REQUEST turn
            const varsWithoutTools = [];
            const toolReferences = [];
            for (const v of h.request.variables.variables) {
                if (v.kind === 'tool') {
                    toolReferences.push(typeConvert.ChatLanguageModelToolReference.to(v));
                }
                else if (v.kind === 'toolset') {
                    toolReferences.push(...v.value.map(typeConvert.ChatLanguageModelToolReference.to));
                }
                else {
                    const ref = typeConvert.ChatPromptReference.to(v, this.getDiagnosticsWhenEnabled(extension), this._logService);
                    if (ref) {
                        varsWithoutTools.push(ref);
                    }
                }
            }
            const editedFileEvents = isProposedApiEnabled(extension, 'chatParticipantPrivate') ? h.request.editedFileEvents : undefined;
            const turn = new extHostTypes.ChatRequestTurn(h.request.message, h.request.command, varsWithoutTools, h.request.agentId, toolReferences, editedFileEvents);
            res.push(turn);
            // RESPONSE turn
            const parts = coalesce(h.response.map(r => typeConvert.ChatResponsePart.toContent(r, this._commands.converter)));
            res.push(new extHostTypes.ChatResponseTurn(parts, result, h.request.agentId, h.request.command));
        }
        return res;
    }
    $releaseSession(sessionId) {
        this._sessionDisposables.deleteAndDispose(sessionId);
        this._onDidDisposeChatSession.fire(sessionId);
    }
    async $provideFollowups(requestDto, handle, result, context, token) {
        const agent = this._agents.get(handle);
        if (!agent) {
            return Promise.resolve([]);
        }
        const request = revive(requestDto);
        const convertedHistory = await this.prepareHistoryTurns(agent.extension, agent.id, context);
        const ehResult = typeConvert.ChatAgentResult.to(result);
        return (await agent.provideFollowups(ehResult, { history: convertedHistory }, token))
            .filter(f => {
            // The followup must refer to a participant that exists from the same extension
            const isValid = !f.participant || Iterable.some(this._agents.values(), a => a.id === f.participant && ExtensionIdentifier.equals(a.extension.identifier, agent.extension.identifier));
            if (!isValid) {
                this._logService.warn(`[@${agent.id}] ChatFollowup refers to an unknown participant: ${f.participant}`);
            }
            return isValid;
        })
            .map(f => typeConvert.ChatFollowup.from(f, request));
    }
    $acceptFeedback(handle, result, voteAction) {
        const agent = this._agents.get(handle);
        if (!agent) {
            return;
        }
        const ehResult = typeConvert.ChatAgentResult.to(result);
        let kind;
        switch (voteAction.direction) {
            case ChatAgentVoteDirection.Down:
                kind = extHostTypes.ChatResultFeedbackKind.Unhelpful;
                break;
            case ChatAgentVoteDirection.Up:
                kind = extHostTypes.ChatResultFeedbackKind.Helpful;
                break;
        }
        const feedback = {
            result: ehResult,
            kind,
            unhelpfulReason: isProposedApiEnabled(agent.extension, 'chatParticipantAdditions') ? voteAction.reason : undefined,
        };
        agent.acceptFeedback(Object.freeze(feedback));
    }
    $acceptAction(handle, result, event) {
        const agent = this._agents.get(handle);
        if (!agent) {
            return;
        }
        if (event.action.kind === 'vote') {
            // handled by $acceptFeedback
            return;
        }
        const ehAction = typeConvert.ChatAgentUserActionEvent.to(result, event, this._commands.converter);
        if (ehAction) {
            agent.acceptAction(Object.freeze(ehAction));
        }
    }
    async $invokeCompletionProvider(handle, query, token) {
        const agent = this._agents.get(handle);
        if (!agent) {
            return [];
        }
        let disposables = this._completionDisposables.get(handle);
        if (disposables) {
            // Clear any disposables from the last invocation of this completion provider
            disposables.clear();
        }
        else {
            disposables = new DisposableStore();
            this._completionDisposables.set(handle, disposables);
        }
        const items = await agent.invokeCompletionProvider(query, token);
        return items.map((i) => typeConvert.ChatAgentCompletionItem.from(i, this._commands.converter, disposables));
    }
    async $provideChatTitle(handle, context, token) {
        const agent = this._agents.get(handle);
        if (!agent) {
            return;
        }
        const history = await this.prepareHistoryTurns(agent.extension, agent.id, { history: context });
        return await agent.provideTitle({ history }, token);
    }
    async $provideChatSummary(handle, context, token) {
        const agent = this._agents.get(handle);
        if (!agent) {
            return;
        }
        const history = await this.prepareHistoryTurns(agent.extension, agent.id, { history: context });
        return await agent.provideSummary({ history }, token);
    }
}
class ExtHostParticipantDetector {
    constructor(extension, provider) {
        this.extension = extension;
        this.provider = provider;
    }
}
class ExtHostRelatedFilesProvider {
    constructor(extension, provider) {
        this.extension = extension;
        this.provider = provider;
    }
}
class ExtHostChatAgent {
    constructor(extension, id, _proxy, _handle, _requestHandler) {
        this.extension = extension;
        this.id = id;
        this._proxy = _proxy;
        this._handle = _handle;
        this._requestHandler = _requestHandler;
        this._onDidReceiveFeedback = new Emitter();
        this._onDidPerformAction = new Emitter();
        this._pauseStateEmitter = new Emitter();
    }
    acceptFeedback(feedback) {
        this._onDidReceiveFeedback.fire(feedback);
    }
    acceptAction(event) {
        this._onDidPerformAction.fire(event);
    }
    setChatRequestPauseState(pauseState) {
        this._pauseStateEmitter.fire(pauseState);
    }
    async invokeCompletionProvider(query, token) {
        if (!this._agentVariableProvider) {
            return [];
        }
        return await this._agentVariableProvider.provider.provideCompletionItems(query, token) ?? [];
    }
    async provideFollowups(result, context, token) {
        if (!this._followupProvider) {
            return [];
        }
        const followups = await this._followupProvider.provideFollowups(result, context, token);
        if (!followups) {
            return [];
        }
        return followups
            // Filter out "command followups" from older providers
            .filter(f => !(f && 'commandId' in f))
            // Filter out followups from older providers before 'message' changed to 'prompt'
            .filter(f => !(f && 'message' in f));
    }
    async provideTitle(context, token) {
        if (!this._titleProvider) {
            return;
        }
        return await this._titleProvider.provideChatTitle(context, token) ?? undefined;
    }
    async provideSummary(context, token) {
        if (!this._summarizer) {
            return;
        }
        return await this._summarizer.provideChatSummary(context, token) ?? undefined;
    }
    get apiAgent() {
        let disposed = false;
        let updateScheduled = false;
        const updateMetadataSoon = () => {
            if (disposed) {
                return;
            }
            if (updateScheduled) {
                return;
            }
            updateScheduled = true;
            queueMicrotask(() => {
                this._proxy.$updateAgent(this._handle, {
                    icon: !this._iconPath ? undefined :
                        this._iconPath instanceof URI ? this._iconPath :
                            'light' in this._iconPath ? this._iconPath.light :
                                undefined,
                    iconDark: !this._iconPath ? undefined :
                        'dark' in this._iconPath ? this._iconPath.dark :
                            undefined,
                    themeIcon: this._iconPath instanceof extHostTypes.ThemeIcon ? this._iconPath : undefined,
                    hasFollowups: this._followupProvider !== undefined,
                    helpTextPrefix: (!this._helpTextPrefix || typeof this._helpTextPrefix === 'string') ? this._helpTextPrefix : typeConvert.MarkdownString.from(this._helpTextPrefix),
                    helpTextPostfix: (!this._helpTextPostfix || typeof this._helpTextPostfix === 'string') ? this._helpTextPostfix : typeConvert.MarkdownString.from(this._helpTextPostfix),
                    supportIssueReporting: this._supportIssueReporting,
                    additionalWelcomeMessage: (!this._additionalWelcomeMessage || typeof this._additionalWelcomeMessage === 'string') ? this._additionalWelcomeMessage : typeConvert.MarkdownString.from(this._additionalWelcomeMessage),
                });
                updateScheduled = false;
            });
        };
        const that = this;
        return {
            get id() {
                return that.id;
            },
            get iconPath() {
                return that._iconPath;
            },
            set iconPath(v) {
                that._iconPath = v;
                updateMetadataSoon();
            },
            get requestHandler() {
                return that._requestHandler;
            },
            set requestHandler(v) {
                assertType(typeof v === 'function', 'Invalid request handler');
                that._requestHandler = v;
            },
            get followupProvider() {
                return that._followupProvider;
            },
            set followupProvider(v) {
                that._followupProvider = v;
                updateMetadataSoon();
            },
            get helpTextPrefix() {
                checkProposedApiEnabled(that.extension, 'defaultChatParticipant');
                return that._helpTextPrefix;
            },
            set helpTextPrefix(v) {
                checkProposedApiEnabled(that.extension, 'defaultChatParticipant');
                that._helpTextPrefix = v;
                updateMetadataSoon();
            },
            get helpTextPostfix() {
                checkProposedApiEnabled(that.extension, 'defaultChatParticipant');
                return that._helpTextPostfix;
            },
            set helpTextPostfix(v) {
                checkProposedApiEnabled(that.extension, 'defaultChatParticipant');
                that._helpTextPostfix = v;
                updateMetadataSoon();
            },
            get supportIssueReporting() {
                checkProposedApiEnabled(that.extension, 'chatParticipantPrivate');
                return that._supportIssueReporting;
            },
            set supportIssueReporting(v) {
                checkProposedApiEnabled(that.extension, 'chatParticipantPrivate');
                that._supportIssueReporting = v;
                updateMetadataSoon();
            },
            get onDidReceiveFeedback() {
                return that._onDidReceiveFeedback.event;
            },
            set participantVariableProvider(v) {
                checkProposedApiEnabled(that.extension, 'chatParticipantAdditions');
                that._agentVariableProvider = v;
                if (v) {
                    if (!v.triggerCharacters.length) {
                        throw new Error('triggerCharacters are required');
                    }
                    that._proxy.$registerAgentCompletionsProvider(that._handle, that.id, v.triggerCharacters);
                }
                else {
                    that._proxy.$unregisterAgentCompletionsProvider(that._handle, that.id);
                }
            },
            get participantVariableProvider() {
                checkProposedApiEnabled(that.extension, 'chatParticipantAdditions');
                return that._agentVariableProvider;
            },
            set additionalWelcomeMessage(v) {
                checkProposedApiEnabled(that.extension, 'defaultChatParticipant');
                that._additionalWelcomeMessage = v;
                updateMetadataSoon();
            },
            get additionalWelcomeMessage() {
                checkProposedApiEnabled(that.extension, 'defaultChatParticipant');
                return that._additionalWelcomeMessage;
            },
            set titleProvider(v) {
                checkProposedApiEnabled(that.extension, 'defaultChatParticipant');
                that._titleProvider = v;
                updateMetadataSoon();
            },
            get titleProvider() {
                checkProposedApiEnabled(that.extension, 'defaultChatParticipant');
                return that._titleProvider;
            },
            set summarizer(v) {
                checkProposedApiEnabled(that.extension, 'defaultChatParticipant');
                that._summarizer = v;
            },
            get summarizer() {
                checkProposedApiEnabled(that.extension, 'defaultChatParticipant');
                return that._summarizer;
            },
            get onDidChangePauseState() {
                checkProposedApiEnabled(that.extension, 'chatParticipantAdditions');
                return that._pauseStateEmitter.event;
            },
            onDidPerformAction: !isProposedApiEnabled(this.extension, 'chatParticipantAdditions')
                ? undefined
                : this._onDidPerformAction.event,
            dispose() {
                disposed = true;
                that._followupProvider = undefined;
                that._onDidReceiveFeedback.dispose();
                that._proxy.$unregisterAgent(that._handle);
            },
        };
    }
    invoke(request, context, response, token) {
        return this._requestHandler(request, context, response, token);
    }
}
/**
 * raceCancellation, but give the promise a little time to complete to see if we can get a real result quickly.
 */
function raceCancellationWithTimeout(cancelWait, promise, token) {
    return new Promise((resolve, reject) => {
        const ref = token.onCancellationRequested(async () => {
            ref.dispose();
            await timeout(cancelWait);
            resolve(undefined);
        });
        promise.then(resolve, reject).finally(() => ref.dispose());
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdENoYXRBZ2VudHMyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvY29tbW9uL2V4dEhvc3RDaGF0QWdlbnRzMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDMUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBcUIsdUJBQXVCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM1RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDN0csT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDM0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ2xELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUU1RCxPQUFPLEVBQUUsbUJBQW1CLEVBQXVELE1BQU0sbURBQW1ELENBQUM7QUFFN0ksT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFHeEYsT0FBTyxFQUFFLHNCQUFzQixFQUEwRyxNQUFNLDBDQUEwQyxDQUFDO0FBQzFMLE9BQU8sRUFBRSxpQkFBaUIsRUFB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