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
var InlineChatController_1, InlineChatController1_1, InlineChatController2_1;
import * as aria from '../../../../base/browser/ui/aria/aria.js';
import { alert } from '../../../../base/browser/ui/aria/aria.js';
import { Barrier, DeferredPromise, Queue, raceCancellation } from '../../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { toErrorMessage } from '../../../../base/common/errorMessage.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { DisposableStore, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { MovingAverage } from '../../../../base/common/numbers.js';
import { autorun, derived, observableSignalFromEvent, observableValue, waitForState } from '../../../../base/common/observable.js';
import { isEqual } from '../../../../base/common/resources.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';
import { assertType } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { observableCodeEditor } from '../../../../editor/browser/observableCodeEditor.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { Position } from '../../../../editor/common/core/position.js';
import { Range } from '../../../../editor/common/core/range.js';
import { Selection } from '../../../../editor/common/core/selection.js';
import { TextEdit, VersionedExtensionId } from '../../../../editor/common/languages.js';
import { IEditorWorkerService } from '../../../../editor/common/services/editorWorker.js';
import { IMarkerDecorationsService } from '../../../../editor/common/services/markerDecorations.js';
import { DefaultModelSHA1Computer } from '../../../../editor/common/services/modelService.js';
import { InlineCompletionsController } from '../../../../editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController.js';
import { MessageController } from '../../../../editor/contrib/message/browser/messageController.js';
import { localize } from '../../../../nls.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { observableConfigValue } from '../../../../platform/observable/common/platformObservableUtils.js';
import { ISharedWebContentExtractorService } from '../../../../platform/webContentExtractor/common/webContentExtractor.js';
import { IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { IChatAttachmentResolveService } from '../../chat/browser/chatAttachmentResolveService.js';
import { ChatContextKeys } from '../../chat/common/chatContextKeys.js';
import { ChatMode } from '../../chat/common/chatModes.js';
import { IChatService } from '../../chat/common/chatService.js';
import { IDiagnosticVariableEntryFilterData } from '../../chat/common/chatVariableEntries.js';
import { ChatAgentLocation } from '../../chat/common/constants.js';
import { isNotebookContainingCellEditor as isNotebookWithCellEditor } from '../../notebook/browser/notebookEditor.js';
import { INotebookEditorService } from '../../notebook/browser/services/notebookEditorService.js';
import { INotebookService } from '../../notebook/common/notebookService.js';
import { CTX_INLINE_CHAT_EDITING, CTX_INLINE_CHAT_REQUEST_IN_PROGRESS, CTX_INLINE_CHAT_RESPONSE_TYPE, CTX_INLINE_CHAT_VISIBLE, INLINE_CHAT_ID } from '../common/inlineChat.js';
import { Session } from './inlineChatSession.js';
import { IInlineChatSessionService, moveToPanelChat } from './inlineChatSessionService.js';
import { InlineChatError } from './inlineChatSessionServiceImpl.js';
import { LiveStrategy } from './inlineChatStrategies.js';
import { InlineChatZoneWidget } from './inlineChatZoneWidget.js';
export var State;
(function (State) {
    State["CREATE_SESSION"] = "CREATE_SESSION";
    State["INIT_UI"] = "INIT_UI";
    State["WAIT_FOR_INPUT"] = "WAIT_FOR_INPUT";
    State["SHOW_REQUEST"] = "SHOW_REQUEST";
    State["PAUSE"] = "PAUSE";
    State["CANCEL"] = "CANCEL";
    State["ACCEPT"] = "DONE";
})(State || (State = {}));
var Message;
(function (Message) {
    Message[Message["NONE"] = 0] = "NONE";
    Message[Message["ACCEPT_SESSION"] = 1] = "ACCEPT_SESSION";
    Message[Message["CANCEL_SESSION"] = 2] = "CANCEL_SESSION";
    Message[Message["PAUSE_SESSION"] = 4] = "PAUSE_SESSION";
    Message[Message["CANCEL_REQUEST"] = 8] = "CANCEL_REQUEST";
    Message[Message["CANCEL_INPUT"] = 16] = "CANCEL_INPUT";
    Message[Message["ACCEPT_INPUT"] = 32] = "ACCEPT_INPUT";
})(Message || (Message = {}));
export class InlineChatRunOptions {
    static isInlineChatRunOptions(options) {
        const { initialSelection, initialRange, message, autoSend, position, existingSession, attachments: attachments } = options;
        if (typeof message !== 'undefined' && typeof message !== 'string'
            || typeof autoSend !== 'undefined' && typeof autoSend !== 'boolean'
            || typeof initialRange !== 'undefined' && !Range.isIRange(initialRange)
            || typeof initialSelection !== 'undefined' && !Selection.isISelection(initialSelection)
            || typeof position !== 'undefined' && !Position.isIPosition(position)
            || typeof existingSession !== 'undefined' && !(existingSession instanceof Session)
            || typeof attachments !== 'undefined' && (!Array.isArray(attachments) || !attachments.every(item => item instanceof URI))) {
            return false;
        }
        return true;
    }
}
let InlineChatController = class InlineChatController {
    static { InlineChatController_1 = this; }
    static { this.ID = 'editor.contrib.inlineChatController'; }
    static get(editor) {
        return editor.getContribution(InlineChatController_1.ID);
    }
    constructor(editor, configurationService, _notebookEditorService) {
        this._notebookEditorService = _notebookEditorService;
        const notebookAgent = observableConfigValue("inlineChat.notebookAgent" /* InlineChatConfigKeys.notebookAgent */, false, configurationService);
        this._delegate = derived(r => {
            const isNotebookCell = !!this._notebookEditorService.getNotebookForPossibleCell(editor);
            if (!isNotebookCell || notebookAgent.read(r)) {
                return InlineChatController2.get(editor);
            }
            else {
                return InlineChatController1.get(editor);
            }
        });
    }
    dispose() {
    }
    get isActive() {
        return this._delegate.get().isActive;
    }
    async run(arg) {
        return this._delegate.get().run(arg);
    }
    focus() {
        return this._delegate.get().focus();
    }
    get widget() {
        return this._delegate.get().widget;
    }
    getWidgetPosition() {
        return this._delegate.get().getWidgetPosition();
    }
    acceptSession() {
        return this._delegate.get().acceptSession();
    }
};
InlineChatController = InlineChatController_1 = __decorate([
    __param(1, IConfigurationService),
    __param(2, INotebookEditorService)
], InlineChatController);
export { InlineChatController };
/**
 * @deprecated
 */
let InlineChatController1 = InlineChatController1_1 = class InlineChatController1 {
    static get(editor) {
        return editor.getContribution(INLINE_CHAT_ID);
    }
    get chatWidget() {
        return this._ui.value.widget.chatWidget;
    }
    constructor(_editor, _instaService, _inlineChatSessionService, _editorWorkerService, _logService, _configurationService, _dialogService, contextKeyService, _chatService, _editorService, notebookEditorService, _webContentExtractorService, _fileService, _chatAttachmentResolveService) {
        this._editor = _editor;
        this._instaService = _instaService;
        this._inlineChatSessionService = _inlineChatSessionService;
        this._editorWorkerService = _editorWorkerService;
        this._logService = _logService;
        this._configurationService = _configurationService;
        this._dialogService = _dialogService;
        this._chatService = _chatService;
        this._editorService = _editorService;
        this._webContentExtractorService = _webContentExtractorService;
        this._fileService = _fileService;
        this._chatAttachmentResolveService = _chatAttachmentResolveService;
        this._isDisposed = false;
        this._store = new DisposableStore();
        this._messages = this._store.add(new Emitter());
        this._onDidEnterState = this._store.add(new Emitter());
        this._sessionStore = this._store.add(new DisposableStore());
        this._stashedSession = this._store.add(new MutableDisposable());
        this._ctxVisible = CTX_INLINE_CHAT_VISIBLE.bindTo(contextKeyService);
        this._ctxEditing = CTX_INLINE_CHAT_EDITING.bindTo(contextKeyService);
        this._ctxResponseType = CTX_INLINE_CHAT_RESPONSE_TYPE.bindTo(contextKeyService);
        this._ctxRequestInProgress = CTX_INLINE_CHAT_REQUEST_IN_PROGRESS.bindTo(contextKeyService);
        this._ctxResponse = ChatContextKeys.isResponse.bindTo(contextKeyService);
        ChatContextKeys.responseHasError.bindTo(contextKeyService);
        this._ui = new Lazy(() => {
            const location = {
                location: ChatAgentLocation.EditorInline,
                resolveData: () => {
                    assertType(this._editor.hasModel());
                    assertType(this._session);
                    return {
                        type: ChatAgentLocation.EditorInline,
                        selection: this._editor.getSelection(),
                        document: this._session.textModelN.uri,
                        wholeRange: this._session?.wholeRange.trackedInitialRange,
                        close: () => this.cancelSession(),
                        delegateSessionResource: this._delegateSession?.chatSessionResource,
                    };
                }
            };
            // inline chat in notebooks
            // check if this editor is part of a notebook editor
            // and iff so, use the notebook location but keep the resolveData
            // talk about editor data
            const notebookEditor = notebookEditorService.getNotebookForPossibleCell(this._editor);
            if (!!notebookEditor) {
                location.location = ChatAgentLocation.Notebook;
            }
            const clear = async () => {
                const r = this.joinCurrentRun();
                this.cancelSession();
                await r;
                this.run();
            };
            const zone = _instaService.createInstance(InlineChatZoneWidget, location, undefined, { editor: this._editor, notebookEditor }, clear);
            this._store.add(zone);
            return zone;
        });
        this._store.add(this._editor.onDidChangeModel(async (e) => {
            if (this._session || !e.newModelUrl) {
                return;
            }
            const existingSession = this._inlineChatSessionService.getSession(this._editor, e.newModelUrl);
            if (!existingSession) {
                return;
            }
            this._log('session RESUMING after model change', e);
            await this.run({ existingSession });
        }));
        this._store.add(this._inlineChatSessionService.onDidEndSession(e => {
            if (e.session === this._session && e.endedByExternalCause) {
                this._log('session ENDED by external cause');
                this.acceptSession();
            }
        }));
        this._store.add(this._inlineChatSessionService.onDidMoveSession(async (e) => {
            if (e.editor === this._editor) {
                this._log('session RESUMING after move', e);
                await this.run({ existingSession: e.session });
            }
        }));
        this._log(`NEW controller`);
    }
    dispose() {
        if (this._currentRun) {
            this._messages.fire(this._session?.chatModel.hasRequests
                ? 4 /* Message.PAUSE_SESSION */
                : 2 /* Message.CANCEL_SESSION */);
        }
        this._store.dispose();
        this._isDisposed = true;
        this._log('DISPOSED controller');
    }
    _log(message, ...more) {
        if (message instanceof Error) {
            this._logService.error(message, ...more);
        }
        else {
            this._logService.trace(`[IE] (editor:${this._editor.getId()}) ${message}`, ...more);
        }
    }
    get widget() {
        return this._ui.value.widget;
    }
    getId() {
        return INLINE_CHAT_ID;
    }
    getWidgetPosition() {
        return this._ui.value.position;
    }
    async run(options = {}) {
        let lastState;
        const d = this._onDidEnterState.event(e => lastState = e);
        try {
            this.acceptSession();
            if (this._currentRun) {
                await this._currentRun;
            }
            if (options.initialSelection) {
                this._editor.setSelection(options.initialSelection);
            }
            this._stashedSession.clear();
            this._currentRun = this._nextState("CREATE_SESSION" /* State.CREATE_SESSION */, options);
            await this._currentRun;
        }
        catch (error) {
            // this should not happen but when it does make sure to tear down the UI and everything
            this._log('error during run', error);
            onUnexpectedError(error);
            if (this._session) {
                this._inlineChatSessionService.releaseSession(this._session);
            }
            this["PAUSE" /* State.PAUSE */]();
        }
        finally {
            this._currentRun = undefined;
            d.dispose();
        }
        return lastState !== "CANCEL" /* State.CANCEL */;
    }
    // ---- state machine
    async _nextState(state, options) {
        let nextState = state;
        while (nextState && !this._isDisposed) {
            this._log('setState to ', nextState);
            const p = this[nextState](options);
            this._onDidEnterState.fire(nextState);
            nextState = await p;
        }
    }
    async ["CREATE_SESSION" /* State.CREATE_SESSION */](options) {
        assertType(this._session === undefined);
        assertType(this._editor.hasModel());
        let session = options.existingSession;
        let initPosition;
        if (options.position) {
            initPosition = Position.lift(options.position).delta(-1);
            delete options.position;
        }
        const widgetPosition = this._showWidget(session?.headless, true, initPosition);
        // this._updatePlaceholder();
        let errorMessage = localize('create.fail', "Failed to start editor chat");
        if (!session) {
            const createSessionCts = new CancellationTokenSource();
            const msgListener = Event.once(this._messages.event)(m => {
                this._log('state=_createSession) message received', m);
                if (m === 32 /* Message.ACCEPT_INPUT */) {
                    // user accepted the input before having a session
                    options.autoSend = true;
                    this._ui.value.widget.updateInfo(localize('welcome.2', "Getting ready..."));
                }
                else {
                    createSessionCts.cancel();
                }
            });
            try {
                session = await this._inlineChatSessionService.createSession(this._editor, { wholeRange: options.initialRange }, createSessionCts.token);
            }
            catch (error) {
                // Inline chat errors are from the provider and have their error messages shown to the user
                if (error instanceof InlineChatError || error?.name === InlineChatError.code) {
                    errorMessage = error.message;
                }
            }
            createSessionCts.dispose();
            msgListener.dispose();
            if (createSessionCts.token.isCancellationRequested) {
                if (session) {
                    this._inlineChatSessionService.releaseSession(session);
                }
                return "CANCEL" /* State.CANCEL */;
            }
        }
        delete options.initialRange;
        delete options.existingSession;
        if (!session) {
            MessageController.get(this._editor)?.showMessage(errorMessage, widgetPosition);
            this._log('Failed to start editor chat');
            return "CANCEL" /* State.CANCEL */;
        }
        // create a new strategy
        this._strategy = this._instaService.createInstance(LiveStrategy, session, this._editor, this._ui.value, session.headless);
        this._session = session;
        return "INIT_UI" /* State.INIT_UI */;
    }
    async ["INIT_UI" /* State.INIT_UI */](options) {
        assertType(this._session);
        assertType(this._strategy);
        // hide/cancel inline completions when invoking IE
        InlineCompletionsController.get(this._editor)?.reject();
        this._sessionStore.clear();
        const wholeRangeDecoration = this._editor.createDecorationsCollection();
        const handleWholeRangeChange = () => {
            const newDecorations = this._strategy?.getWholeRangeDecoration() ?? [];
            wholeRangeDecoration.set(newDecorations);
            this._ctxEditing.set(!this._session?.wholeRange.trackedInitialRange.isEmpty());
        };
        this._sessionStore.add(toDisposable(() => {
            wholeRangeDecoration.clear();
            this._ctxEditing.reset();
        }));
        this._sessionStore.add(this._session.wholeRange.onDidChange(handleWholeRangeChange));
        handleWholeRangeChange();
        this._ui.value.widget.setChatModel(this._session.chatModel);
        this._updatePlaceholder();
        const isModelEmpty = !this._session.chatModel.hasRequests;
        this._ui.value.widget.updateToolbar(true);
        this._ui.value.widget.toggleStatus(!isModelEmpty);
        this._showWidget(this._session.headless, isModelEmpty);
        this._sessionStore.add(this._editor.onDidChangeModel((e) => {
            const msg = this._session?.chatModel.hasRequests
                ? 4 /* Message.PAUSE_SESSION */
                : 2 /* Message.CANCEL_SESSION */;
            this._log('model changed, pause or cancel session', msg, e);
            this._messages.fire(msg);
        }));
        const filePartOfEditSessions = this._chatService.editingSessions.filter(session => session.entries.get().some(e => e.state.get() === 0 /* ModifiedFileEntryState.Modified */ && e.modifiedURI.toString() === this._session.textModelN.uri.toString()));
        const withinEditSession = filePartOfEditSessions.find(session => session.entries.get().some(e => e.state.get() === 0 /* ModifiedFileEntryState.Modified */ && e.hasModificationAt({
            range: this._session.wholeRange.trackedInitialRange,
            uri: this._session.textModelN.uri
        })));
        const chatWidget = this._ui.value.widget.chatWidget;
        this._delegateSession = withinEditSession || filePartOfEditSessions[0];
        chatWidget.input.setIsWithinEditSession(!!withinEditSession, filePartOfEditSessions.length > 0);
        this._sessionStore.add(this._editor.onDidChangeModelContent(e => {
            if (this._session?.hunkData.ignoreTextModelNChanges || this._ui.value.widget.hasFocus()) {
                return;
            }
            const wholeRange = this._session.wholeRange;
            let shouldFinishSession = false;
            if (this._configurationService.getValue("inlineChat.finishOnType" /* InlineChatConfigKeys.FinishOnType */)) {
                for (const { range } of e.changes) {
                    shouldFinishSession = !Range.areIntersectingOrTouching(range, wholeRange.value);
                }
            }
            this._session.recordExternalEditOccurred(shouldFinishSession);
            if (shouldFinishSession) {
                this._log('text changed outside of whole range, FINISH session');
                this.acceptSession();
            }
        }));
        this._sessionStore.add(this._session.chatModel.onDidChange(async (e) => {
            if (e.kind === 'removeRequest') {
                // TODO@jrieken there is still some work left for when a request "in the middle"
                // is removed. We will undo all changes till that point but not remove those
                // later request
                await this._session.undoChangesUntil(e.requestId);
            }
        }));
        // apply edits from completed requests that haven't been applied yet
        const editState = this._createChatTextEditGroupState();
        let didEdit = false;
        for (const request of this._session.chatModel.getRequests()) {
            if (!request.response || request.response.result?.errorDetails) {
                // done when seeing the first request that is still pending (no response).
                break;
            }
            for (const part of request.response.response.value) {
                if (part.kind !== 'textEditGroup' || !isEqual(part.uri, this._session.textModelN.uri)) {
                    continue;
                }
                if (part.state?.applied) {
                    continue;
                }
                for (const edit of part.edits) {
                    this._makeChanges(edit, undefined, !didEdit);
                    didEdit = true;
                }
                part.state ??= editState;
            }
        }
        if (didEdit) {
            const diff = await this._editorWorkerService.computeDiff(this._session.textModel0.uri, this._session.textModelN.uri, { computeMoves: false, maxComputationTimeMs: Number.MAX_SAFE_INTEGER, ignoreTrimWhitespace: false }, 'advanced');
            this._session.wholeRange.fixup(diff?.changes ?? []);
            await this._session.hunkData.recompute(editState, diff);
            this._updateCtxResponseType();
        }
        options.position = await this._strategy.renderChanges();
        if (this._session.chatModel.requestInProgress.get()) {
            return "SHOW_REQUEST" /* State.SHOW_REQUEST */;
        }
        else {
            return "WAIT_FOR_INPUT" /* State.WAIT_FOR_INPUT */;
        }
    }
    async ["WAIT_FOR_INPUT" /* State.WAIT_FOR_INPUT */](options) {
        assertType(this._session);
        assertType(this._strategy);
        this._updatePlaceholder();
        if (options.message) {
            this._updateInput(options.message);
            aria.alert(options.message);
            delete options.message;
            this._showWidget(this._session.headless, false);
        }
        let message = 0 /* Message.NONE */;
        let request;
        const barrier = new Barrier();
        const store = new DisposableStore();
        store.add(this._session.chatModel.onDidChange(e => {
            if (e.kind === 'addRequest') {
                request = e.request;
                message = 32 /* Message.ACCEPT_INPUT */;
                barrier.open();
            }
        }));
        store.add(this._strategy.onDidAccept(() => this.acceptSession()));
        store.add(this._strategy.onDidDiscard(() => this.cancelSession()));
        store.add(this.chatWidget.onDidHide(() => this.cancelSession()));
        store.add(Event.once(this._messages.event)(m => {
            this._log('state=_waitForInput) message received', m);
            message = m;
            barrier.open();
        }));
        if (options.attachments) {
            await Promise.all(options.attachments.map(async (attachment) => {
                await this._ui.value.widget.chatWidget.attachmentModel.addFile(attachment);
            }));
            delete options.attachments;
        }
        if (options.autoSend) {
            delete options.autoSend;
            this._showWidget(this._session.headless, false);
            this._ui.value.widget.chatWidget.acceptInput();
        }
        await barrier.wait();
        store.dispose();
        if (message & (16 /* Message.CANCEL_INPUT */ | 2 /* Message.CANCEL_SESSION */)) {
            return "CANCEL" /* State.CANCEL */;
        }
        if (message & 4 /* Message.PAUSE_SESSION */) {
            return "PAUSE" /* State.PAUSE */;
        }
        if (message & 1 /* Message.ACCEPT_SESSION */) {
            this._ui.value.widget.selectAll();
            return "DONE" /* State.ACCEPT */;
        }
        if (!request?.message.text) {
            return "WAIT_FOR_INPUT" /* State.WAIT_FOR_INPUT */;
        }
        return "SHOW_REQUEST" /* State.SHOW_REQUEST */;
    }
    async ["SHOW_REQUEST" /* State.SHOW_REQUEST */](options) {
        assertType(this._session);
        assertType(this._strategy);
        assertType(this._session.chatModel.requestInProgress.get());
        this._ctxRequestInProgress.set(true);
        const { chatModel } = this._session;
        const request = chatModel.lastRequest;
        assertType(request);
        assertType(request.response);
        this._showWidget(this._session.headless, false);
        this._ui.value.widget.selectAll();
        this._ui.value.widget.updateInfo('');
        this._ui.value.widget.toggleStatus(true);
        const { response } = request;
        const responsePromise = new DeferredPromise();
        const store = new DisposableStore();
        const progressiveEditsCts = store.add(new CancellationTokenSource());
        const progressiveEditsAvgDuration = new MovingAverage();
        const progressiveEditsClock = StopWatch.create();
        const progressiveEditsQueue = new Queue();
        // disable typing and squiggles while streaming a reply
        const origDeco = this._editor.getOption(112 /* EditorOption.renderValidationDecorations */);
        this._editor.updateOptions({
            renderValidationDecorations: 'off'
        });
        store.add(toDisposable(() => {
            this._editor.updateOptions({
                renderValidationDecorations: origDeco
            });
        }));
        let next = "WAIT_FOR_INPUT" /* State.WAIT_FOR_INPUT */;
        store.add(Event.once(this._messages.event)(message => {
            this._log('state=_makeRequest) message received', message);
            this._chatService.cancelCurrentRequestForSession(chatModel.sessionResource);
            if (message & 2 /* Message.CANCEL_SESSION */) {
                next = "CANCEL" /* State.CANCEL */;
            }
            else if (message & 4 /* Message.PAUSE_SESSION */) {
                next = "PAUSE" /* State.PAUSE */;
            }
            else if (message & 1 /* Message.ACCEPT_SESSION */) {
                next = "DONE" /* State.ACCEPT */;
            }
        }));
        store.add(chatModel.onDidChange(async (e) => {
            if (e.kind === 'removeRequest' && e.requestId === request.id) {
                progressiveEditsCts.cancel();
                responsePromise.complete();
                if (e.reason === 1 /* ChatRequestRemovalReason.Resend */) {
                    next = "SHOW_REQUEST" /* State.SHOW_REQUEST */;
                }
                else {
                    next = "CANCEL" /* State.CANCEL */;
                }
                return;
            }
            if (e.kind === 'move') {
                assertType(this._session);
                const log = (msg, ...args) => this._log('state=_showRequest) moving inline chat', msg, ...args);
                log('move was requested', e.target, e.range);
                // if there's already a tab open for targetUri, show it and move inline chat to that tab
                // otherwise, open the tab to the side
                const initialSelection = Selection.fromRange(Range.lift(e.range), 0 /* SelectionDirection.LTR */);
                const editorPane = await this._editorService.openEditor({ resource: e.target, options: { selection: initialSelection } }, SIDE_GROUP);
                if (!editorPane) {
                    log('opening editor failed');
                    return;
                }
                const newEditor = editorPane.getControl();
                if (!isCodeEditor(newEditor) || !newEditor.hasModel()) {
                    log('new editor is either missing or not a code editor or does not have a model');
                    return;
                }
                if (this._inlineChatSessionService.getSession(newEditor, e.target)) {
                    log('new editor ALREADY has a session');
                    return;
                }
                const newSession = await this._inlineChatSessionService.createSession(newEditor, {
                    session: this._session,
                }, CancellationToken.None); // TODO@ulugbekna: add proper cancellation?
                InlineChatController1_1.get(newEditor)?.run({ existingSession: newSession });
                next = "CANCEL" /* State.CANCEL */;
                responsePromise.complete();
                return;
            }
        }));
        // cancel the request when the user types
        store.add(this._ui.value.widget.chatWidget.inputEditor.onDidChangeModelContent(() => {
            this._chatService.cancelCurrentRequestForSession(chatModel.sessionResource);
        }));
        let lastLength = 0;
        let isFirstChange = true;
        const editState = this._createChatTextEditGroupState();
        let localEditGroup;
        // apply edits
        const handleResponse = () => {
            this._updateCtxResponseType();
            if (!localEditGroup) {
                localEditGroup = response.response.value.find(part => part.kind === 'textEditGroup' && isEqual(part.uri, this._session?.textModelN.uri));
            }
            if (localEditGroup) {
                localEditGroup.state ??= editState;
                const edits = localEditGroup.edits;
                const newEdits = edits.slice(lastLength);
                if (newEdits.length > 0) {
                    this._log(`${this._session?.textModelN.uri.toString()} received ${newEdits.length} edits`);
                    // NEW changes
                    lastLength = edits.length;
                    progressiveEditsAvgDuration.update(progressiveEditsClock.elapsed());
                    progressiveEditsClock.reset();
                    progressiveEditsQueue.queue(async () => {
                        const startThen = this._session.wholeRange.value.getStartPosition();
                        // making changes goes into a queue because otherwise the async-progress time will
                        // influence the time it takes to receive the changes and progressive typing will
                        // become infinitely fast
                        for (const edits of newEdits) {
                            await this._makeChanges(edits, {
                                duration: progressiveEditsAvgDuration.value,
                                token: progressiveEditsCts.token
                            }, isFirstChange);
                            isFirstChange = false;
                        }
                        // reshow the widget if the start position changed or shows at the wrong position
                        const startNow = this._session.wholeRange.value.getStartPosition();
                        if (!startNow.equals(startThen) || !this._ui.value.position?.equals(startNow)) {
                            this._showWidget(this._session.headless, false, startNow.delta(-1));
                        }
                    });
                }
            }
            if (response.isCanceled) {
                progressiveEditsCts.cancel();
                responsePromise.complete();
            }
            else if (response.isComplete) {
                responsePromise.complete();
            }
        };
        store.add(response.onDidChange(handleResponse));
        handleResponse();
        // (1) we must wait for the request to finish
        // (2) we must wait for all edits that came in via progress to complete
        await responsePromise.p;
        await progressiveEditsQueue.whenIdle();
        if (response.result?.errorDetails && !response.result.errorDetails.responseIsFiltered) {
            await this._session.undoChangesUntil(response.requestId);
        }
        store.dispose();
        const diff = await this._editorWorkerService.computeDiff(this._session.textModel0.uri, this._session.textModelN.uri, { computeMoves: false, maxComputationTimeMs: Number.MAX_SAFE_INTEGER, ignoreTrimWhitespace: false }, 'advanced');
        this._session.wholeRange.fixup(diff?.changes ?? []);
        await this._session.hunkData.recompute(editState, diff);
        this._ctxRequestInProgress.set(false);
        let newPosition;
        if (response.result?.errorDetails) {
            // error -> no message, errors are shown with the request
            alert(response.result.errorDetails.message);
        }
        else if (response.response.value.length === 0) {
            // empty -> show message
            const status = localize('empty', "No results, please refine your input and try again");
            this._ui.value.widget.updateStatus(status, { classes: ['warn'] });
            alert(status);
        }
        else {
            // real response -> no message
            this._ui.value.widget.updateStatus('');
            alert(localize('responseWasEmpty', "Response was empty"));
        }
        const position = await this._strategy.renderChanges();
        if (position) {
            // if the selection doesn't start far off we keep the widget at its current position
            // because it makes reading this nicer
            const selection = this._editor.getSelection();
            if (selection?.containsPosition(position)) {
                if (position.lineNumber - selection.startLineNumber > 8) {
                    newPosition = position;
                }
            }
            else {
                newPosition = position;
            }
        }
        this._showWidget(this._session.headless, false, newPosition);
        return next;
    }
    async ["PAUSE" /* State.PAUSE */]() {
        this._resetWidget();
        this._strategy?.dispose?.();
        this._session = undefined;
    }
    async ["DONE" /* State.ACCEPT */]() {
        assertType(this._session);
        assertType(this._strategy);
        this._sessionStore.clear();
        try {
            await this._strategy.apply();
        }
        catch (err) {
            this._dialogService.error(localize('err.apply', "Failed to apply changes.", toErrorMessage(err)));
            this._log('FAILED to apply changes');
            this._log(err);
        }
        this._resetWidget();
        this._inlineChatSessionService.releaseSession(this._session);
        this._strategy?.dispose();
        this._strategy = undefined;
        this._session = undefined;
    }
    async ["CANCEL" /* State.CANCEL */]() {
        this._resetWidget();
        if (this._session) {
            // assertType(this._session);
            assertType(this._strategy);
            this._sessionStore.clear();
            // only stash sessions that were not unstashed, not "empty", and not interacted with
            const shouldStash = !this._session.isUnstashed && this._session.chatModel.hasRequests && this._session.hunkData.size === this._session.hunkData.pending;
            let undoCancelEdits = [];
            try {
                undoCancelEdits = this._strategy.cancel();
            }
            catch (err) {
                this._dialogService.error(localize('err.discard', "Failed to discard changes.", toErrorMessage(err)));
                this._log('FAILED to discard changes');
                this._log(err);
            }
            this._stashedSession.clear();
            if (shouldStash) {
                this._stashedSession.value = this._inlineChatSessionService.stashSession(this._session, this._editor, undoCancelEdits);
            }
            else {
                this._inlineChatSessionService.releaseSession(this._session);
            }
        }
        this._strategy?.dispose();
        this._strategy = undefined;
        this._session = undefined;
    }
    // ----
    _showWidget(headless = false, initialRender = false, position) {
        assertType(this._editor.hasModel());
        this._ctxVisible.set(true);
        let widgetPosition;
        if (position) {
            // explicit position wins
            widgetPosition = position;
        }
        else if (this._ui.rawValue?.position) {
            // already showing - special case of line 1
            if (this._ui.rawValue?.position.lineNumber === 1) {
                widgetPosition = this._ui.rawValue?.position.delta(-1);
            }
            else {
                widgetPosition = this._ui.rawValue?.position;
            }
        }
        else {
            // default to ABOVE the selection
            widgetPosition = this._editor.getSelection().getStartPosition().delta(-1);
        }
        if (this._session && !position && (this._session.hasChangedText || this._session.chatModel.hasRequests)) {
            widgetPosition = this._session.wholeRange.trackedInitialRange.getStartPosition().delta(-1);
        }
        if (initialRender && (this._editor.getOption(131 /* EditorOption.stickyScroll */)).enabled) {
            this._editor.revealLine(widgetPosition.lineNumber); // do NOT substract `this._editor.getOption(EditorOption.stickyScroll).maxLineCount` because the editor already does that
        }
        if (!headless) {
            if (this._ui.rawValue?.position) {
                this._ui.value.updatePositionAndHeight(widgetPosition);
            }
            else {
                this._ui.value.show(widgetPosition);
            }
        }
        return widgetPosition;
    }
    _resetWidget() {
        this._sessionStore.clear();
        this._ctxVisible.reset();
        this._ui.rawValue?.hide();
        // Return focus to the editor only if the current focus is within the editor widget
        if (this._editor.hasWidgetFocus()) {
            this._editor.focus();
        }
    }
    _updateCtxResponseType() {
        if (!this._session) {
            this._ctxResponseType.set("none" /* InlineChatResponseType.None */);
            return;
        }
        const hasLocalEdit = (response) => {
            return response.value.some(part => part.kind === 'textEditGroup' && isEqual(part.uri, this._session?.textModelN.uri));
        };
        let responseType = "none" /* InlineChatResponseType.None */;
        for (const request of this._session.chatModel.getRequests()) {
            if (!request.response) {
                continue;
            }
            responseType = "messages" /* InlineChatResponseType.Messages */;
            if (hasLocalEdit(request.response.response)) {
                responseType = "messagesAndEdits" /* InlineChatResponseType.MessagesAndEdits */;
                break; // no need to check further
            }
        }
        this._ctxResponseType.set(responseType);
        this._ctxResponse.set(responseType !== "none" /* InlineChatResponseType.None */);
    }
    _createChatTextEditGroupState() {
        assertType(this._session);
        const sha1 = new DefaultModelSHA1Computer();
        const textModel0Sha1 = sha1.canComputeSHA1(this._session.textModel0)
            ? sha1.computeSHA1(this._session.textModel0)
            : generateUuid();
        return {
            sha1: textModel0Sha1,
            applied: 0
        };
    }
    async _makeChanges(edits, opts, undoStopBefore) {
        assertType(this._session);
        assertType(this._strategy);
        const moreMinimalEdits = await raceCancellation(this._editorWorkerService.computeMoreMinimalEdits(this._session.textModelN.uri, edits), opts?.token || CancellationToken.None);
        this._log('edits from PROVIDER and after making them MORE MINIMAL', this._session.agent.extensionId, edits, moreMinimalEdits);
        if (moreMinimalEdits?.length === 0) {
            // nothing left to do
            return;
        }
        const actualEdits = !opts && moreMinimalEdits ? moreMinimalEdits : edits;
        const editOperations = actualEdits.map(TextEdit.asEditOperation);
        const editsObserver = {
            start: () => this._session.hunkData.ignoreTextModelNChanges = true,
            stop: () => this._session.hunkData.ignoreTextModelNChanges = false,
        };
        const metadata = this._getMetadata();
        if (opts) {
            await this._strategy.makeProgressiveChanges(editOperations, editsObserver, opts, undoStopBefore, metadata);
        }
        else {
            await this._strategy.makeChanges(editOperations, editsObserver, undoStopBefore, metadata);
        }
    }
    _getMetadata() {
        const lastRequest = this._session?.chatModel.lastRequest;
        return {
            extensionId: VersionedExtensionId.tryCreate(this._session?.agent.extensionId.value, this._session?.agent.extensionVersion),
            modelId: lastRequest?.modelId,
            requestId: lastRequest?.id,
        };
    }
    _updatePlaceholder() {
        this._ui.value.widget.placeholder = this._session?.agent.description ?? localize('askOrEditInContext', 'Ask or edit in context');
    }
    _updateInput(text, selectAll = true) {
        this._ui.value.widget.chatWidget.setInput(text);
        if (selectAll) {
            const newSelection = new Selection(1, 1, Number.MAX_SAFE_INTEGER, 1);
            this._ui.value.widget.chatWidget.inputEditor.setSelection(newSelection);
        }
    }
    // ---- controller API
    arrowOut(up) {
        if (this._ui.value.position && this._editor.hasModel()) {
            const { column } = this._editor.getPosition();
            const { lineNumber } = this._ui.value.position;
            const newLine = up ? lineNumber : lineNumber + 1;
            this._editor.setPosition({ lineNumber: newLine, column });
            this._editor.focus();
        }
    }
    focus() {
        this._ui.value.widget.focus();
    }
    async viewInChat() {
        if (!this._strategy || !this._session) {
            return;
        }
        let someApplied = false;
        let lastEdit;
        const uri = this._editor.getModel()?.uri;
        const requests = this._session.chatModel.getRequests();
        for (const request of requests) {
            if (!request.response) {
                continue;
            }
            for (const part of request.response.response.value) {
                if (part.kind === 'textEditGroup' && isEqual(part.uri, uri)) {
                    // fully or partially applied edits
                    someApplied = someApplied || Boolean(part.state?.applied);
                    lastEdit = part;
                    part.edits = [];
                    part.state = undefined;
                }
            }
        }
        const doEdits = this._strategy.cancel();
        if (someApplied) {
            assertType(lastEdit);
            lastEdit.edits = [doEdits];
        }
        await this._instaService.invokeFunction(moveToPanelChat, this._session?.chatModel, false);
        this.cancelSession();
    }
    acceptSession() {
        const response = this._session?.chatModel.getRequests().at(-1)?.response;
        if (response) {
            this._chatService.notifyUserAction({
                sessionResource: response.session.sessionResource,
                requestId: response.requestId,
                agentId: response.agent?.id,
                command: response.slashCommand?.name,
                result: response.result,
                action: {
                    kind: 'inlineChat',
                    action: 'accepted'
                }
            });
        }
        this._messages.fire(1 /* Message.ACCEPT_SESSION */);
    }
    acceptHunk(hunkInfo) {
        return this._strategy?.performHunkAction(hunkInfo, 0 /* HunkAction.Accept */);
    }
    discardHunk(hunkInfo) {
        return this._strategy?.performHunkAction(hunkInfo, 1 /* HunkAction.Discard */);
    }
    toggleDiff(hunkInfo) {
        return this._strategy?.performHunkAction(hunkInfo, 4 /* HunkAction.ToggleDiff */);
    }
    moveHunk(next) {
        this.focus();
        this._strategy?.performHunkAction(undefined, next ? 2 /* HunkAction.MoveNext */ : 3 /* HunkAction.MovePrev */);
    }
    async cancelSession() {
        const response = this._session?.chatModel.lastRequest?.response;
        if (response) {
            this._chatService.notifyUserAction({
                sessionResource: response.session.sessionResource,
                requestId: response.requestId,
                agentId: response.agent?.id,
                command: response.slashCommand?.name,
                result: response.result,
                action: {
                    kind: 'inlineChat',
                    action: 'discarded'
                }
            });
        }
        this._resetWidget();
        this._messages.fire(2 /* Message.CANCEL_SESSION */);
    }
    reportIssue() {
        const response = this._session?.chatModel.lastRequest?.response;
        if (response) {
            this._chatService.notifyUserAction({
                sessionResource: response.session.sessionResource,
                requestId: response.requestId,
                agentId: response.agent?.id,
                command: response.slashCommand?.name,
                result: response.result,
                action: { kind: 'bug' }
            });
        }
    }
    unstashLastSession() {
        const result = this._stashedSession.value?.unstash();
        return result;
    }
    joinCurrentRun() {
        return this._currentRun;
    }
    get isActive() {
        return Boolean(this._currentRun);
    }
    async createImageAttachment(attachment) {
        if (attachment.scheme === Schemas.file) {
            if (await this._fileService.canHandleResource(attachment)) {
                return await this._chatAttachmentResolveService.resolveImageEditorAttachContext(attachment);
            }
        }
        else if (attachment.scheme === Schemas.http || attachment.scheme === Schemas.https) {
            const extractedImages = await this._webContentExtractorService.readImage(attachment, CancellationToken.None);
            if (extractedImages) {
                return await this._chatAttachmentResolveService.resolveImageEditorAttachContext(attachment, extractedImages);
            }
        }
        return undefined;
    }
};
InlineChatController1 = InlineChatController1_1 = __decorate([
    __param(1, IInstantiationService),
    __param(2, IInlineChatSessionService),
    __param(3, IEditorWorkerService),
    __param(4, ILogService),
    __param(5, IConfigurationService),
    __param(6, IDialogService),
    __param(7, IContextKeyService),
    __param(8, IChatService),
    __param(9, IEditorService),
    __param(10, INotebookEditorService),
    __param(11, ISharedWebContentExtractorService),
    __param(12, IFileService),
    __param(13, IChatAttachmentResolveService)
], InlineChatController1);
export { InlineChatController1 };
let InlineChatController2 = class InlineChatController2 {
    static { InlineChatController2_1 = this; }
    static { this.ID = 'editor.contrib.inlineChatController2'; }
    static get(editor) {
        return editor.getContribution(InlineChatController2_1.ID) ?? undefined;
    }
    get widget() {
        return this._zone.value.widget;
    }
    get isActive() {
        return Boolean(this._currentSession.get());
    }
    constructor(_editor, _instaService, _notebookEditorService, _inlineChatSessions, codeEditorService, contextKeyService, _webContentExtractorService, _fileService, _chatAttachmentResolveService, _editorService, _markerDecorationsService, chatService) {
        this._editor = _editor;
        this._instaService = _instaService;
        this._notebookEditorService = _notebookEditorService;
        this._inlineChatSessions = _inlineChatSessions;
        this._webContentExtractorService = _webContentExtractorService;
        this._fileService = _fileService;
        this._chatAttachmentResolveService = _chatAttachmentResolveService;
        this._editorService = _editorService;
        this._markerDecorationsService = _markerDecorationsService;
        this._store = new DisposableStore();
        this._isActiveController = observableValue(this, false);
        const ctxInlineChatVisible = CTX_INLINE_CHAT_VISIBLE.bindTo(contextKeyService);
        this._zone = new Lazy(() => {
            const location = {
                location: ChatAgentLocation.EditorInline,
                resolveData: () => {
                    assertType(this._editor.hasModel());
                    const wholeRange = this._editor.getSelection();
                    const document = this._editor.getModel().uri;
                    return {
                        type: ChatAgentLocation.EditorInline,
                        selection: this._editor.getSelection(),
                        document,
                        wholeRange,
                        close: () => { },
                        delegateSessionResource: chatService.editingSessions.find(session => session.entries.get().some(e => e.hasModificationAt({
                            range: wholeRange,
                            uri: document
                        })))?.chatSessionResource,
                    };
                }
            };
            // inline chat in notebooks
            // check if this editor is part of a notebook editor
            // if so, update the location and use the notebook specific widget
            const notebookEditor = this._notebookEditorService.getNotebookForPossibleCell(this._editor);
            if (!!notebookEditor) {
                location.location = ChatAgentLocation.Notebook;
                location.resolveData = () => {
                    assertType(this._editor.hasModel());
                    return {
                        type: ChatAgentLocation.Notebook,
                        sessionInputUri: this._editor.getModel().uri,
                    };
                };
            }
            const result = this._instaService.createInstance(InlineChatZoneWidget, location, {
                enableWorkingSet: 'implicit',
                enableImplicitContext: false,
                renderInputOnTop: false,
                renderInputToolbarBelowInput: true,
                filter: _item => false, // filter ALL items
                menus: {
                    telemetrySource: 'inlineChatWidget',
                    executeToolbar: MenuId.ChatEditorInlineExecute,
                    inputSideToolbar: MenuId.ChatEditorInlineInputSide
                },
                defaultMode: ChatMode.Ask
            }, { editor: this._editor, notebookEditor }, () => Promise.resolve());
            result.domNode.classList.add('inline-chat-2');
            return result;
        });
        const editorObs = observableCodeEditor(_editor);
        const sessionsSignal = observableSignalFromEvent(this, _inlineChatSessions.onDidChangeSessions);
        this._currentSession = derived(r => {
            sessionsSignal.read(r);
            const model = editorObs.model.read(r);
            const value = model && _inlineChatSessions.getSession2(model.uri);
            return value ?? undefined;
        });
        this._store.add(autorun(r => {
            const session = this._currentSession.read(r);
            if (!session) {
                this._isActiveController.set(false, undefined);
                return;
            }
            let foundOne = false;
            for (const editor of codeEditorService.listCodeEditors()) {
                if (Boolean(InlineChatController2_1.get(editor)?._isActiveController.read(undefined))) {
                    foundOne = true;
                    break;
                }
            }
            if (!foundOne && editorObs.isFocused.read(r)) {
                this._isActiveController.set(true, undefined);
            }
        }));
        const visibleSessionObs = observableValue(this, undefined);
        this._store.add(autorun(r => {
            const model = editorObs.model.read(r);
            const session = this._currentSession.read(r);
            const isActive = this._isActiveController.read(r);
            if (!session || !isActive || !model) {
                visibleSessionObs.set(undefined, undefined);
            }
            else {
                visibleSessionObs.set(session, undefined);
            }
        }));
        this._store.add(autorun(r => {
            // HIDE/SHOW
            const session = visibleSessionObs.read(r);
            if (!session) {
                this._zone.rawValue?.hide();
                _editor.focus();
                ctxInlineChatVisible.reset();
            }
            else {
                ctxInlineChatVisible.set(true);
                this._zone.value.widget.setChatModel(session.chatModel);
                if (!this._zone.value.position) {
                    this._zone.value.widget.chatWidget.input.renderAttachedContext(); // TODO - fights layout bug
                    this._zone.value.show(session.initialPosition);
                }
                this._zone.value.reveal(this._zone.value.position);
                this._zone.value.widget.focus();
            }
        }));
        this._store.add(autorun(r => {
            const session = visibleSessionObs.read(r);
            if (session) {
                const entries = session.editingSession.entries.read(r);
                const otherEntries = entries.filter(entry => !isEqual(entry.modifiedURI, session.uri));
                for (const entry of otherEntries) {
                    // OPEN other modified files in side group. This is a workaround, temp-solution until we have no more backend
                    // that modifies other files
                    this._editorService.openEditor({ resource: entry.modifiedURI }, SIDE_GROUP).catch(onUnexpectedError);
                }
            }
        }));
        this._store.add(autorun(r => {
            const session = visibleSessionObs.read(r);
            if (!session) {
                return;
            }
            const entry = session.editingSession.readEntry(session.uri, r);
            if (entry?.state.read(r) === 0 /* ModifiedFileEntryState.Modified */) {
                entry?.enableReviewModeUntilSettled();
            }
            const inProgress = session.chatModel.requestInProgress.read(r);
            this._zone.value.widget.domNode.classList.toggle('request-in-progress', inProgress);
            if (!inProgress) {
                this._zone.value.widget.chatWidget.setInputPlaceholder(localize('placeholder', "Edit, refactor, and generate code"));
            }
            else {
                const prompt = session.chatModel.getRequests().at(-1)?.message.text;
                this._zone.value.widget.chatWidget.setInputPlaceholder(prompt || localize('loading', "Working..."));
            }
        }));
        this._store.add(autorun(r => {
            const session = visibleSessionObs.read(r);
            const entry = session?.editingSession.readEntry(session.uri, r);
            // make sure there is an editor integration
            const pane = this._editorService.visibleEditorPanes.find(candidate => candidate.getControl() === this._editor || isNotebookWithCellEditor(candidate, this._editor));
            if (pane && entry) {
                entry?.getEditorIntegration(pane);
            }
            // make sure the ZONE isn't inbetween a diff and move above if so
            if (entry?.diffInfo && this._zone.value.position) {
                const { position } = this._zone.value;
                const diff = entry.diffInfo.read(r);
                for (const change of diff.changes) {
                    if (change.modified.contains(position.lineNumber)) {
                        this._zone.value.updatePositionAndHeight(new Position(change.modified.startLineNumber - 1, 1));
                        break;
                    }
                }
            }
        }));
    }
    dispose() {
        this._store.dispose();
    }
    getWidgetPosition() {
        return this._zone.rawValue?.position;
    }
    focus() {
        this._zone.rawValue?.widget.focus();
    }
    markActiveController() {
        this._isActiveController.set(true, undefined);
    }
    async run(arg) {
        assertType(this._editor.hasModel());
        const uri = this._editor.getModel().uri;
        const existingSession = this._inlineChatSessions.getSession2(uri);
        if (existingSession) {
            await existingSession.editingSession.accept();
            existingSession.dispose();
        }
        this.markActiveController();
        const session = await this._inlineChatSessions.createSession2(this._editor, uri, CancellationToken.None);
        // ADD diagnostics
        const entries = [];
        for (const [range, marker] of this._markerDecorationsService.getLiveMarkers(uri)) {
            if (range.intersectRanges(this._editor.getSelection())) {
                const filter = IDiagnosticVariableEntryFilterData.fromMarker(marker);
                entries.push(IDiagnosticVariableEntryFilterData.toEntry(filter));
            }
        }
        if (entries.length > 0) {
            this._zone.value.widget.chatWidget.attachmentModel.addContext(...entries);
            this._zone.value.widget.chatWidget.input.setValue(entries.length > 1
                ? localize('fixN', "Fix the attached problems")
                : localize('fix1', "Fix the attached problem"), true);
            this._zone.value.widget.chatWidget.inputEditor.setSelection(new Selection(1, 1, Number.MAX_SAFE_INTEGER, 1));
        }
        // Check args
        if (arg && InlineChatRunOptions.isInlineChatRunOptions(arg)) {
            if (arg.initialRange) {
                this._editor.revealRange(arg.initialRange);
            }
            if (arg.initialSelection) {
                this._editor.setSelection(arg.initialSelection);
            }
            if (arg.attachments) {
                await Promise.all(arg.attachments.map(async (attachment) => {
                    await this._zone.value.widget.chatWidget.attachmentModel.addFile(attachment);
                }));
                delete arg.attachments;
            }
            if (arg.message) {
                this._zone.value.widget.chatWidget.setInput(arg.message);
                if (arg.autoSend) {
                    await this._zone.value.widget.chatWidget.acceptInput();
                }
            }
        }
        await Event.toPromise(session.editingSession.onDidDispose);
        const rejected = session.editingSession.getEntry(uri)?.state.get() === 2 /* ModifiedFileEntryState.Rejected */;
        return !rejected;
    }
    async acceptSession() {
        const session = this._currentSession.get();
        if (!session) {
            return;
        }
        await session.editingSession.accept();
        session.dispose();
    }
    async rejectSession() {
        const session = this._currentSession.get();
        if (!session) {
            return;
        }
        await session.editingSession.reject();
        session.dispose();
    }
    async createImageAttachment(attachment) {
        const value = this._currentSession.get();
        if (!value) {
            return undefined;
        }
        if (attachment.scheme === Schemas.file) {
            if (await this._fileService.canHandleResource(attachment)) {
                return await this._chatAttachmentResolveService.resolveImageEditorAttachContext(attachment);
            }
        }
        else if (attachment.scheme === Schemas.http || attachment.scheme === Schemas.https) {
            const extractedImages = await this._webContentExtractorService.readImage(attachment, CancellationToken.None);
            if (extractedImages) {
                return await this._chatAttachmentResolveService.resolveImageEditorAttachContext(attachment, extractedImages);
            }
        }
        return undefined;
    }
};
InlineChatController2 = InlineChatController2_1 = __decorate([
    __param(1, IInstantiationService),
    __param(2, INotebookEditorService),
    __param(3, IInlineChatSessionService),
    __param(4, ICodeEditorService),
    __param(5, IContextKeyService),
    __param(6, ISharedWebContentExtractorService),
    __param(7, IFileService),
    __param(8, IChatAttachmentResolveService),
    __param(9, IEditorService),
    __param(10, IMarkerDecorationsService),
    __param(11, IChatService)
], InlineChatController2);
export { InlineChatController2 };
export async function reviewEdits(accessor, editor, stream, token, applyCodeBlockSuggestionId) {
    if (!editor.hasModel()) {
        return false;
    }
    const chatService = accessor.get(IChatService);
    const uri = editor.getModel().uri;
    const chatModelRef = chatService.startSession(ChatAgentLocation.EditorInline, token);
    const chatModel = chatModelRef.object;
    chatModel.startEditingSession(true);
    const store = new DisposableStore();
    store.add(chatModelRef);
    // STREAM
    const chatRequest = chatModel?.addRequest({ text: '', parts: [] }, { variables: [] }, 0, {
        kind: undefined,
        modeId: 'applyCodeBlock',
        modeInstructions: undefined,
        isBuiltin: true,
        applyCodeBlockSuggestionId,
    });
    assertType(chatRequest.response);
    chatRequest.response.updateContent({ kind: 'textEdit', uri, edits: [], done: false });
    for await (const chunk of stream) {
        if (token.isCancellationRequested) {
            chatRequest.response.cancel();
            break;
        }
        chatRequest.response.updateContent({ kind: 'textEdit', uri, edits: chunk, done: false });
    }
    chatRequest.response.updateContent({ kind: 'textEdit', uri, edits: [], done: true });
    if (!token.isCancellationRequested) {
        chatRequest.response.complete();
    }
    const isSettled = derived(r => {
        const entry = chatModel.editingSession?.readEntry(uri, r);
        if (!entry) {
            return false;
        }
        const state = entry.state.read(r);
        return state === 1 /* ModifiedFileEntryState.Accepted */ || state === 2 /* ModifiedFileEntryState.Rejected */;
    });
    const whenDecided = waitForState(isSettled, Boolean);
    await raceCancellation(whenDecided, token);
    store.dispose();
    return true;
}
export async function reviewNotebookEdits(accessor, uri, stream, token) {
    const chatService = accessor.get(IChatService);
    const notebookService = accessor.get(INotebookService);
    const isNotebook = notebookService.hasSupportedNotebooks(uri);
    const chatModelRef = chatService.startSession(ChatAgentLocation.EditorInline, token);
    const chatModel = chatModelRef.object;
    chatModel.startEditingSession(true);
    const store = new DisposableStore();
    store.add(chatModelRef);
    // STREAM
    const chatRequest = chatModel?.addRequest({ text: '', parts: [] }, { variables: [] }, 0);
    assertType(chatRequest.response);
    if (isNotebook) {
        chatRequest.response.updateContent({ kind: 'notebookEdit', uri, edits: [], done: false });
    }
    else {
        chatRequest.response.updateContent({ kind: 'textEdit', uri, edits: [], done: false });
    }
    for await (const chunk of stream) {
        if (token.isCancellationRequested) {
            chatRequest.response.cancel();
            break;
        }
        if (chunk.every(isCellEditOperation)) {
            chatRequest.response.updateContent({ kind: 'notebookEdit', uri, edits: chunk, done: false });
        }
        else {
            chatRequest.response.updateContent({ kind: 'textEdit', uri: chunk[0], edits: chunk[1], done: false });
        }
    }
    if (isNotebook) {
        chatRequest.response.updateContent({ kind: 'notebookEdit', uri, edits: [], done: true });
    }
    else {
        chatRequest.response.updateContent({ kind: 'textEdit', uri, edits: [], done: true });
    }
    if (!token.isCancellationRequested) {
        chatRequest.response.complete();
    }
    const isSettled = derived(r => {
        const entry = chatModel.editingSession?.readEntry(uri, r);
        if (!entry) {
            return false;
        }
        const state = entry.state.read(r);
        return state === 1 /* ModifiedFileEntryState.Accepted */ || state === 2 /* ModifiedFileEntryState.Rejected */;
    });
    const whenDecided = waitForState(isSettled, Boolean);
    await raceCancellation(whenDecided, token);
    store.dispose();
    return true;
}
function isCellEditOperation(edit) {
    if (URI.isUri(edit)) {
        return false;
    }
    if (Array.isArray(edit)) {
        return false;
    }
    return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ2hhdENvbnRyb2xsZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvaW5saW5lQ2hhdC9icm93c2VyL2lubGluZUNoYXRDb250cm9sbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssSUFBSSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNyRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDekUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN4RyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFlLHlCQUF5QixFQUFFLGVBQWUsRUFBRSxZQUFZLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoSixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDL0Qs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