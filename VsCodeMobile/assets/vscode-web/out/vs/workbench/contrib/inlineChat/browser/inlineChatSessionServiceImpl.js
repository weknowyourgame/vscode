var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var InlineChatEscapeToolContribution_1;
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { Schemas } from '../../../../base/common/network.js';
import { autorun, observableFromEvent } from '../../../../base/common/observable.js';
import { isEqual } from '../../../../base/common/resources.js';
import { assertType } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { isCodeEditor, isCompositeEditor, isDiffEditor } from '../../../../editor/browser/editorBrowser.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { Range } from '../../../../editor/common/core/range.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { createTextBufferFactoryFromSnapshot } from '../../../../editor/common/model/textModel.js';
import { IEditorWorkerService } from '../../../../editor/common/services/editorWorker.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { observableConfigValue } from '../../../../platform/observable/common/platformObservableUtils.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { DEFAULT_EDITOR_ASSOCIATION } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { UntitledTextEditorInput } from '../../../services/untitled/common/untitledTextEditorInput.js';
import { IChatWidgetService } from '../../chat/browser/chat.js';
import { IChatAgentService } from '../../chat/common/chatAgents.js';
import { IChatService } from '../../chat/common/chatService.js';
import { ChatAgentLocation } from '../../chat/common/constants.js';
import { ILanguageModelToolsService, ToolDataSource } from '../../chat/common/languageModelToolsService.js';
import { CTX_INLINE_CHAT_HAS_AGENT2, CTX_INLINE_CHAT_HAS_NOTEBOOK_AGENT, CTX_INLINE_CHAT_HAS_NOTEBOOK_INLINE, CTX_INLINE_CHAT_POSSIBLE } from '../common/inlineChat.js';
import { HunkData, Session, SessionWholeRange, StashedSession } from './inlineChatSession.js';
import { askInPanelChat, IInlineChatSessionService } from './inlineChatSessionService.js';
export class InlineChatError extends Error {
    static { this.code = 'InlineChatError'; }
    constructor(message) {
        super(message);
        this.name = InlineChatError.code;
    }
}
let InlineChatSessionServiceImpl = class InlineChatSessionServiceImpl {
    constructor(_telemetryService, _modelService, _textModelService, _editorWorkerService, _logService, _instaService, _editorService, _textFileService, _languageService, _chatService, _chatAgentService, _chatWidgetService) {
        this._telemetryService = _telemetryService;
        this._modelService = _modelService;
        this._textModelService = _textModelService;
        this._editorWorkerService = _editorWorkerService;
        this._logService = _logService;
        this._instaService = _instaService;
        this._editorService = _editorService;
        this._textFileService = _textFileService;
        this._languageService = _languageService;
        this._chatService = _chatService;
        this._chatAgentService = _chatAgentService;
        this._chatWidgetService = _chatWidgetService;
        this._store = new DisposableStore();
        this._onWillStartSession = this._store.add(new Emitter());
        this.onWillStartSession = this._onWillStartSession.event;
        this._onDidMoveSession = this._store.add(new Emitter());
        this.onDidMoveSession = this._onDidMoveSession.event;
        this._onDidEndSession = this._store.add(new Emitter());
        this.onDidEndSession = this._onDidEndSession.event;
        this._onDidStashSession = this._store.add(new Emitter());
        this.onDidStashSession = this._onDidStashSession.event;
        this._sessions = new Map();
        this._keyComputers = new Map();
        // ---- NEW
        this._sessions2 = new ResourceMap();
        this._onDidChangeSessions = this._store.add(new Emitter());
        this.onDidChangeSessions = this._onDidChangeSessions.event;
    }
    dispose() {
        this._store.dispose();
        this._sessions.forEach(x => x.store.dispose());
        this._sessions.clear();
    }
    async createSession(editor, options, token) {
        const agent = this._chatAgentService.getDefaultAgent(ChatAgentLocation.EditorInline);
        if (!agent) {
            this._logService.trace('[IE] NO agent found');
            return undefined;
        }
        this._onWillStartSession.fire(editor);
        const textModel = editor.getModel();
        const selection = editor.getSelection();
        const store = new DisposableStore();
        this._logService.trace(`[IE] creating NEW session for ${editor.getId()}, ${agent.extensionId}`);
        const chatModelRef = options.session ? undefined : this._chatService.startSession(ChatAgentLocation.EditorInline, token);
        const chatModel = options.session?.chatModel ?? chatModelRef?.object;
        if (!chatModel) {
            this._logService.trace('[IE] NO chatModel found');
            chatModelRef?.dispose();
            return undefined;
        }
        if (chatModelRef) {
            store.add(chatModelRef);
        }
        store.add(toDisposable(() => {
            const doesOtherSessionUseChatModel = [...this._sessions.values()].some(data => data.session !== session && data.session.chatModel === chatModel);
            if (!doesOtherSessionUseChatModel) {
                this._chatService.forceClearSession(chatModel.sessionResource);
            }
        }));
        const lastResponseListener = store.add(new MutableDisposable());
        store.add(chatModel.onDidChange(e => {
            if (e.kind !== 'addRequest' || !e.request.response) {
                return;
            }
            const { response } = e.request;
            session.markModelVersion(e.request);
            lastResponseListener.value = response.onDidChange(() => {
                if (!response.isComplete) {
                    return;
                }
                lastResponseListener.clear(); // ONCE
                // special handling for untitled files
                for (const part of response.response.value) {
                    if (part.kind !== 'textEditGroup' || part.uri.scheme !== Schemas.untitled || isEqual(part.uri, session.textModelN.uri)) {
                        continue;
                    }
                    const langSelection = this._languageService.createByFilepathOrFirstLine(part.uri, undefined);
                    const untitledTextModel = this._textFileService.untitled.create({
                        associatedResource: part.uri,
                        languageId: langSelection.languageId
                    });
                    untitledTextModel.resolve();
                    this._textModelService.createModelReference(part.uri).then(ref => {
                        store.add(ref);
                    });
                }
            });
        }));
        store.add(this._chatAgentService.onDidChangeAgents(e => {
            if (e === undefined && (!this._chatAgentService.getAgent(agent.id) || !this._chatAgentService.getActivatedAgents().map(agent => agent.id).includes(agent.id))) {
                this._logService.trace(`[IE] provider GONE for ${editor.getId()}, ${agent.extensionId}`);
                this._releaseSession(session, true);
            }
        }));
        const id = generateUuid();
        const targetUri = textModel.uri;
        // AI edits happen in the actual model, keep a reference but make no copy
        store.add((await this._textModelService.createModelReference(textModel.uri)));
        const textModelN = textModel;
        // create: keep a snapshot of the "actual" model
        const textModel0 = store.add(this._modelService.createModel(createTextBufferFactoryFromSnapshot(textModel.createSnapshot()), { languageId: textModel.getLanguageId(), onDidChange: Event.None }, targetUri.with({ scheme: Schemas.vscode, authority: 'inline-chat', path: '', query: new URLSearchParams({ id, 'textModel0': '' }).toString() }), true));
        // untitled documents are special and we are releasing their session when their last editor closes
        if (targetUri.scheme === Schemas.untitled) {
            store.add(this._editorService.onDidCloseEditor(() => {
                if (!this._editorService.isOpened({ resource: targetUri, typeId: UntitledTextEditorInput.ID, editorId: DEFAULT_EDITOR_ASSOCIATION.id })) {
                    this._releaseSession(session, true);
                }
            }));
        }
        let wholeRange = options.wholeRange;
        if (!wholeRange) {
            wholeRange = new Range(selection.selectionStartLineNumber, selection.selectionStartColumn, selection.positionLineNumber, selection.positionColumn);
        }
        if (token.isCancellationRequested) {
            store.dispose();
            return undefined;
        }
        const session = new Session(options.headless ?? false, targetUri, textModel0, textModelN, agent, store.add(new SessionWholeRange(textModelN, wholeRange)), store.add(new HunkData(this._editorWorkerService, textModel0, textModelN)), chatModel, options.session?.versionsByRequest);
        // store: key -> session
        const key = this._key(editor, session.targetUri);
        if (this._sessions.has(key)) {
            store.dispose();
            throw new Error(`Session already stored for ${key}`);
        }
        this._sessions.set(key, { session, editor, store });
        return session;
    }
    moveSession(session, target) {
        const newKey = this._key(target, session.targetUri);
        const existing = this._sessions.get(newKey);
        if (existing) {
            if (existing.session !== session) {
                throw new Error(`Cannot move session because the target editor already/still has one`);
            }
            else {
                // noop
                return;
            }
        }
        let found = false;
        for (const [oldKey, data] of this._sessions) {
            if (data.session === session) {
                found = true;
                this._sessions.delete(oldKey);
                this._sessions.set(newKey, { ...data, editor: target });
                this._logService.trace(`[IE] did MOVE session for ${data.editor.getId()} to NEW EDITOR ${target.getId()}, ${session.agent.extensionId}`);
                this._onDidMoveSession.fire({ session, editor: target });
                break;
            }
        }
        if (!found) {
            throw new Error(`Cannot move session because it is not stored`);
        }
    }
    releaseSession(session) {
        this._releaseSession(session, false);
    }
    _releaseSession(session, byServer) {
        let tuple;
        // cleanup
        for (const candidate of this._sessions) {
            if (candidate[1].session === session) {
                // if (value.session === session) {
                tuple = candidate;
                break;
            }
        }
        if (!tuple) {
            // double remove
            return;
        }
        this._telemetryService.publicLog2('interactiveEditor/session', session.asTelemetryData());
        const [key, value] = tuple;
        this._sessions.delete(key);
        this._logService.trace(`[IE] did RELEASED session for ${value.editor.getId()}, ${session.agent.extensionId}`);
        this._onDidEndSession.fire({ editor: value.editor, session, endedByExternalCause: byServer });
        value.store.dispose();
    }
    stashSession(session, editor, undoCancelEdits) {
        const result = this._instaService.createInstance(StashedSession, editor, session, undoCancelEdits);
        this._onDidStashSession.fire({ editor, session });
        this._logService.trace(`[IE] did STASH session for ${editor.getId()}, ${session.agent.extensionId}`);
        return result;
    }
    getCodeEditor(session) {
        for (const [, data] of this._sessions) {
            if (data.session === session) {
                return data.editor;
            }
        }
        throw new Error('session not found');
    }
    getSession(editor, uri) {
        const key = this._key(editor, uri);
        return this._sessions.get(key)?.session;
    }
    _key(editor, uri) {
        const item = this._keyComputers.get(uri.scheme);
        return item
            ? item.getComparisonKey(editor, uri)
            : `${editor.getId()}@${uri.toString()}`;
    }
    registerSessionKeyComputer(scheme, value) {
        this._keyComputers.set(scheme, value);
        return toDisposable(() => this._keyComputers.delete(scheme));
    }
    async createSession2(editor, uri, token) {
        assertType(editor.hasModel());
        if (this._sessions2.has(uri)) {
            throw new Error('Session already exists');
        }
        this._onWillStartSession.fire(editor);
        const chatModelRef = this._chatService.startSession(ChatAgentLocation.EditorInline, token);
        const chatModel = chatModelRef.object;
        chatModel.startEditingSession(false);
        const widget = this._chatWidgetService.getWidgetBySessionResource(chatModel.sessionResource);
        await widget?.attachmentModel.addFile(uri);
        const store = new DisposableStore();
        store.add(toDisposable(() => {
            this._chatService.cancelCurrentRequestForSession(chatModel.sessionResource);
            chatModel.editingSession?.reject();
            this._sessions2.delete(uri);
            this._onDidChangeSessions.fire(this);
        }));
        store.add(chatModelRef);
        store.add(autorun(r => {
            const entries = chatModel.editingSession?.entries.read(r);
            if (!entries?.length) {
                return;
            }
            const state = entries.find(entry => isEqual(entry.modifiedURI, uri))?.state.read(r);
            if (state === 1 /* ModifiedFileEntryState.Accepted */ || state === 2 /* ModifiedFileEntryState.Rejected */) {
                const response = chatModel.getRequests().at(-1)?.response;
                if (response) {
                    this._chatService.notifyUserAction({
                        sessionResource: response.session.sessionResource,
                        requestId: response.requestId,
                        agentId: response.agent?.id,
                        command: response.slashCommand?.name,
                        result: response.result,
                        action: {
                            kind: 'inlineChat',
                            action: state === 1 /* ModifiedFileEntryState.Accepted */ ? 'accepted' : 'discarded'
                        }
                    });
                }
            }
            const allSettled = entries.every(entry => {
                const state = entry.state.read(r);
                return (state === 1 /* ModifiedFileEntryState.Accepted */ || state === 2 /* ModifiedFileEntryState.Rejected */)
                    && !entry.isCurrentlyBeingModifiedBy.read(r);
            });
            if (allSettled && !chatModel.requestInProgress.read(undefined)) {
                // self terminate
                store.dispose();
            }
        }));
        const result = {
            uri,
            initialPosition: editor.getSelection().getStartPosition().delta(-1), /* one line above selection start */
            chatModel,
            editingSession: chatModel.editingSession,
            dispose: store.dispose.bind(store)
        };
        this._sessions2.set(uri, result);
        this._onDidChangeSessions.fire(this);
        return result;
    }
    getSession2(uriOrSessionId) {
        if (URI.isUri(uriOrSessionId)) {
            let result = this._sessions2.get(uriOrSessionId);
            if (!result) {
                // no direct session, try to find an editing session which has a file entry for the uri
                for (const [_, candidate] of this._sessions2) {
                    const entry = candidate.editingSession.getEntry(uriOrSessionId);
                    if (entry) {
                        result = candidate;
                        break;
                    }
                }
            }
            return result;
        }
        else {
            for (const session of this._sessions2.values()) {
                if (session.chatModel.sessionId === uriOrSessionId) {
                    return session;
                }
            }
        }
        return undefined;
    }
};
InlineChatSessionServiceImpl = __decorate([
    __param(0, ITelemetryService),
    __param(1, IModelService),
    __param(2, ITextModelService),
    __param(3, IEditorWorkerService),
    __param(4, ILogService),
    __param(5, IInstantiationService),
    __param(6, IEditorService),
    __param(7, ITextFileService),
    __param(8, ILanguageService),
    __param(9, IChatService),
    __param(10, IChatAgentService),
    __param(11, IChatWidgetService)
], InlineChatSessionServiceImpl);
export { InlineChatSessionServiceImpl };
let InlineChatEnabler = class InlineChatEnabler {
    static { this.Id = 'inlineChat.enabler'; }
    constructor(contextKeyService, chatAgentService, editorService, configService) {
        this._store = new DisposableStore();
        this._ctxHasProvider2 = CTX_INLINE_CHAT_HAS_AGENT2.bindTo(contextKeyService);
        this._ctxHasNotebookInline = CTX_INLINE_CHAT_HAS_NOTEBOOK_INLINE.bindTo(contextKeyService);
        this._ctxHasNotebookProvider = CTX_INLINE_CHAT_HAS_NOTEBOOK_AGENT.bindTo(contextKeyService);
        this._ctxPossible = CTX_INLINE_CHAT_POSSIBLE.bindTo(contextKeyService);
        const agentObs = observableFromEvent(this, chatAgentService.onDidChangeAgents, () => chatAgentService.getDefaultAgent(ChatAgentLocation.EditorInline));
        const notebookAgentObs = observableFromEvent(this, chatAgentService.onDidChangeAgents, () => chatAgentService.getDefaultAgent(ChatAgentLocation.Notebook));
        const notebookAgentConfigObs = observableConfigValue("inlineChat.notebookAgent" /* InlineChatConfigKeys.notebookAgent */, false, configService);
        this._store.add(autorun(r => {
            const agent = agentObs.read(r);
            if (!agent) {
                this._ctxHasProvider2.reset();
            }
            else {
                this._ctxHasProvider2.set(true);
            }
        }));
        this._store.add(autorun(r => {
            this._ctxHasNotebookInline.set(!notebookAgentConfigObs.read(r) && !!agentObs.read(r));
            this._ctxHasNotebookProvider.set(notebookAgentConfigObs.read(r) && !!notebookAgentObs.read(r));
        }));
        const updateEditor = () => {
            const ctrl = editorService.activeEditorPane?.getControl();
            const isCodeEditorLike = isCodeEditor(ctrl) || isDiffEditor(ctrl) || isCompositeEditor(ctrl);
            this._ctxPossible.set(isCodeEditorLike);
        };
        this._store.add(editorService.onDidActiveEditorChange(updateEditor));
        updateEditor();
    }
    dispose() {
        this._ctxPossible.reset();
        this._ctxHasProvider2.reset();
        this._store.dispose();
    }
};
InlineChatEnabler = __decorate([
    __param(0, IContextKeyService),
    __param(1, IChatAgentService),
    __param(2, IEditorService),
    __param(3, IConfigurationService)
], InlineChatEnabler);
export { InlineChatEnabler };
let InlineChatEscapeToolContribution = class InlineChatEscapeToolContribution extends Disposable {
    static { InlineChatEscapeToolContribution_1 = this; }
    static { this.Id = 'inlineChat.escapeTool'; }
    static { this.DONT_ASK_AGAIN_KEY = 'inlineChat.dontAskMoveToPanelChat'; }
    static { this._data = {
        id: 'inline_chat_exit',
        source: ToolDataSource.Internal,
        canBeReferencedInPrompt: false,
        alwaysDisplayInputOutput: false,
        displayName: localize('name', "Inline Chat to Panel Chat"),
        modelDescription: 'Moves the inline chat session to the richer panel chat which supports edits across files, creating and deleting files, multi-turn conversations between the user and the assistant, and access to more IDE tools, like retrieve problems, interact with source control, run terminal commands etc.',
    }; }
    constructor(lmTools, inlineChatSessionService, dialogService, codeEditorService, chatService, logService, storageService, instaService) {
        super();
        this._store.add(lmTools.registerTool(InlineChatEscapeToolContribution_1._data, {
            invoke: async (invocation, _tokenCountFn, _progress, _token) => {
                const sessionId = invocation.context?.sessionId;
                if (!sessionId) {
                    logService.warn('InlineChatEscapeToolContribution: no sessionId in tool invocation context');
                    return { content: [{ kind: 'text', value: 'Cancel' }] };
                }
                const session = inlineChatSessionService.getSession2(sessionId);
                if (!session) {
                    logService.warn(`InlineChatEscapeToolContribution: no session found for id ${sessionId}`);
                    return { content: [{ kind: 'text', value: 'Cancel' }] };
                }
                const dontAskAgain = storageService.getBoolean(InlineChatEscapeToolContribution_1.DONT_ASK_AGAIN_KEY, 0 /* StorageScope.PROFILE */);
                let result;
                if (dontAskAgain !== undefined) {
                    // Use previously stored user preference: true = 'Continue in Chat view', false = 'Rephrase' (Cancel)
                    result = { confirmed: dontAskAgain, checkboxChecked: false };
                }
                else {
                    result = await dialogService.confirm({
                        type: 'question',
                        title: localize('confirm.title', "Do you want to continue in Chat view?"),
                        message: localize('confirm', "Do you want to continue in Chat view?"),
                        detail: localize('confirm.detail', "Inline chat is designed for making single-file code changes. Continue your request in the Chat view or rephrase it for inline chat."),
                        primaryButton: localize('confirm.yes', "Continue in Chat view"),
                        cancelButton: localize('confirm.cancel', "Cancel"),
                        checkbox: { label: localize('chat.remove.confirmation.checkbox', "Don't ask again"), checked: false },
                    });
                }
                const editor = codeEditorService.getFocusedCodeEditor();
                if (!editor || result.confirmed) {
                    logService.trace('InlineChatEscapeToolContribution: moving session to panel chat');
                    await instaService.invokeFunction(askInPanelChat, session.chatModel.getRequests().at(-1));
                    session.dispose();
                }
                else {
                    logService.trace('InlineChatEscapeToolContribution: rephrase prompt');
                    chatService.removeRequest(session.chatModel.sessionResource, session.chatModel.getRequests().at(-1).id);
                }
                if (result.checkboxChecked) {
                    storageService.store(InlineChatEscapeToolContribution_1.DONT_ASK_AGAIN_KEY, result.confirmed, 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
                    logService.trace('InlineChatEscapeToolContribution: stored don\'t ask again preference');
                }
                return { content: [{ kind: 'text', value: 'Success' }] };
            }
        }));
    }
};
InlineChatEscapeToolContribution = InlineChatEscapeToolContribution_1 = __decorate([
    __param(0, ILanguageModelToolsService),
    __param(1, IInlineChatSessionService),
    __param(2, IDialogService),
    __param(3, ICodeEditorService),
    __param(4, IChatService),
    __param(5, ILogService),
    __param(6, IStorageService),
    __param(7, IInstantiationService)
], InlineChatEscapeToolContribution);
export { InlineChatEscapeToolContribution };
registerAction2(class ResetMoveToPanelChatChoice extends Action2 {
    constructor() {
        super({
            id: 'inlineChat.resetMoveToPanelChatChoice',
            precondition: ContextKeyExpr.has('config.chat.disableAIFeatures').negate(),
            title: localize2('resetChoice.label', "Reset Choice for 'Move Inline Chat to Panel Chat'"),
            f1: true
        });
    }
    run(accessor) {
        accessor.get(IStorageService).remove(InlineChatEscapeToolContribution.DONT_ASK_AGAIN_KEY, 0 /* StorageScope.PROFILE */);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlSW1wbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDaGF0L2Jyb3dzZXIvaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlSW1wbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBS0EsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqSSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDN0QsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNyRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDL0QsT0FBTyxFQUFrQyxZQUFZLEVBQUUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDNUksT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDOUYsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBRW5GLE9BQU8sRUFBRSxtQ0FBbUMsRUFBRSxNQUFNLDhDQUE4QyxD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