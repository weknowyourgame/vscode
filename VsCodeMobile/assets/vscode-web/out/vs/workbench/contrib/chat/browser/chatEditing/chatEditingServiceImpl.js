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
import { coalesce, compareBy, delta } from '../../../../../base/common/arrays.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { groupBy } from '../../../../../base/common/collections.js';
import { ErrorNoTelemetry } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Iterable } from '../../../../../base/common/iterator.js';
import { Disposable, DisposableStore, dispose, toDisposable } from '../../../../../base/common/lifecycle.js';
import { LinkedList } from '../../../../../base/common/linkedList.js';
import { ResourceMap } from '../../../../../base/common/map.js';
import { Schemas } from '../../../../../base/common/network.js';
import { derived, observableValueOpts, runOnChange, ValueWithChangeEventFromObservable } from '../../../../../base/common/observable.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { compare } from '../../../../../base/common/strings.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { assertType } from '../../../../../base/common/types.js';
import { TextEdit } from '../../../../../editor/common/languages.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IDecorationsService } from '../../../../services/decorations/common/decorations.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { ILifecycleService } from '../../../../services/lifecycle/common/lifecycle.js';
import { IMultiDiffSourceResolverService, MultiDiffEditorItem } from '../../../multiDiffEditor/browser/multiDiffSourceResolverService.js';
import { CellUri } from '../../../notebook/common/notebookCommon.js';
import { INotebookService } from '../../../notebook/common/notebookService.js';
import { CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME, chatEditingAgentSupportsReadonlyReferencesContextKey, chatEditingResourceContextKey, inChatEditingSessionContextKey, parseChatMultiDiffUri } from '../../common/chatEditingService.js';
import { isCellTextEditOperationArray } from '../../common/chatModel.js';
import { IChatService } from '../../common/chatService.js';
import { ChatEditorInput } from '../chatEditorInput.js';
import { AbstractChatEditingModifiedFileEntry } from './chatEditingModifiedFileEntry.js';
import { ChatEditingSession } from './chatEditingSession.js';
import { ChatEditingSnapshotTextModelContentProvider, ChatEditingTextModelContentProvider } from './chatEditingTextModelContentProviders.js';
let ChatEditingService = class ChatEditingService extends Disposable {
    constructor(_instantiationService, multiDiffSourceResolverService, textModelService, contextKeyService, _chatService, _editorService, decorationsService, _fileService, lifecycleService, storageService, logService, extensionService, productService, notebookService, _configurationService) {
        super();
        this._instantiationService = _instantiationService;
        this._chatService = _chatService;
        this._editorService = _editorService;
        this._fileService = _fileService;
        this.lifecycleService = lifecycleService;
        this.notebookService = notebookService;
        this._configurationService = _configurationService;
        this._sessionsObs = observableValueOpts({ equalsFn: (a, b) => false }, new LinkedList());
        this.editingSessionsObs = derived(r => {
            const result = Array.from(this._sessionsObs.read(r));
            return result;
        });
        this._chatRelatedFilesProviders = new Map();
        this._register(decorationsService.registerDecorationsProvider(_instantiationService.createInstance(ChatDecorationsProvider, this.editingSessionsObs)));
        this._register(multiDiffSourceResolverService.registerResolver(_instantiationService.createInstance(ChatEditingMultiDiffSourceResolver, this.editingSessionsObs)));
        // TODO@jrieken
        // some ugly casting so that this service can pass itself as argument instad as service dependeny
        // eslint-disable-next-line local/code-no-any-casts
        this._register(textModelService.registerTextModelContentProvider(ChatEditingTextModelContentProvider.scheme, _instantiationService.createInstance(ChatEditingTextModelContentProvider, this)));
        // eslint-disable-next-line local/code-no-any-casts
        this._register(textModelService.registerTextModelContentProvider(Schemas.chatEditingSnapshotScheme, _instantiationService.createInstance(ChatEditingSnapshotTextModelContentProvider, this)));
        this._register(this._chatService.onDidDisposeSession((e) => {
            if (e.reason === 'cleared') {
                this.getEditingSession(e.sessionResource)?.stop();
            }
        }));
        // todo@connor4312: temporary until chatReadonlyPromptReference proposal is finalized
        const readonlyEnabledContextKey = chatEditingAgentSupportsReadonlyReferencesContextKey.bindTo(contextKeyService);
        const setReadonlyFilesEnabled = () => {
            const enabled = productService.quality !== 'stable' && extensionService.extensions.some(e => e.enabledApiProposals?.includes('chatReadonlyPromptReference'));
            readonlyEnabledContextKey.set(enabled);
        };
        setReadonlyFilesEnabled();
        this._register(extensionService.onDidRegisterExtensions(setReadonlyFilesEnabled));
        this._register(extensionService.onDidChangeExtensions(setReadonlyFilesEnabled));
        let storageTask;
        this._register(storageService.onWillSaveState(() => {
            const tasks = [];
            for (const session of this.editingSessionsObs.get()) {
                if (!session.isGlobalEditingSession) {
                    continue;
                }
                tasks.push(session.storeState());
            }
            storageTask = Promise.resolve(storageTask)
                .then(() => Promise.all(tasks))
                .finally(() => storageTask = undefined);
        }));
        this._register(this.lifecycleService.onWillShutdown(e => {
            if (!storageTask) {
                return;
            }
            e.join(storageTask, {
                id: 'join.chatEditingSession',
                label: localize('join.chatEditingSession', "Saving chat edits history")
            });
        }));
    }
    dispose() {
        dispose(this._sessionsObs.get());
        super.dispose();
    }
    startOrContinueGlobalEditingSession(chatModel) {
        return this.getEditingSession(chatModel.sessionResource) || this.createEditingSession(chatModel, true);
    }
    _lookupEntry(uri) {
        for (const item of Iterable.concat(this.editingSessionsObs.get())) {
            const candidate = item.getEntry(uri);
            if (candidate instanceof AbstractChatEditingModifiedFileEntry) {
                // make sure to ref-count this object
                return candidate.acquire();
            }
        }
        return undefined;
    }
    getEditingSession(chatSessionResource) {
        return this.editingSessionsObs.get()
            .find(candidate => isEqual(candidate.chatSessionResource, chatSessionResource));
    }
    createEditingSession(chatModel, global = false) {
        return this._createEditingSession(chatModel, global, undefined);
    }
    transferEditingSession(chatModel, session) {
        return this._createEditingSession(chatModel, session.isGlobalEditingSession, session);
    }
    _createEditingSession(chatModel, global, initFrom) {
        assertType(this.getEditingSession(chatModel.sessionResource) === undefined, 'CANNOT have more than one editing session per chat session');
        const session = this._instantiationService.createInstance(ChatEditingSession, chatModel.sessionResource, global, this._lookupEntry.bind(this), initFrom);
        const list = this._sessionsObs.get();
        const removeSession = list.unshift(session);
        const store = new DisposableStore();
        this._store.add(store);
        store.add(this.installAutoApplyObserver(session, chatModel));
        store.add(session.onDidDispose(e => {
            removeSession();
            this._sessionsObs.set(list, undefined);
            this._store.delete(store);
        }));
        this._sessionsObs.set(list, undefined);
        return session;
    }
    installAutoApplyObserver(session, chatModel) {
        if (!chatModel) {
            throw new ErrorNoTelemetry(`Edit session was created for a non-existing chat session: ${session.chatSessionResource}`);
        }
        const observerDisposables = new DisposableStore();
        observerDisposables.add(chatModel.onDidChange(async (e) => {
            if (e.kind !== 'addRequest') {
                return;
            }
            session.createSnapshot(e.request.id, undefined);
            const responseModel = e.request.response;
            if (responseModel) {
                this.observerEditsInResponse(e.request.id, responseModel, session, observerDisposables);
            }
        }));
        observerDisposables.add(chatModel.onDidDispose(() => observerDisposables.dispose()));
        return observerDisposables;
    }
    observerEditsInResponse(requestId, responseModel, session, observerDisposables) {
        // Sparse array: the indicies are indexes of `responseModel.response.value`
        // that are edit groups, and then this tracks the edit application for
        // each of them. Note that text edit groups can be updated
        // multiple times during the process of response streaming.
        const editsSeen = [];
        let editorDidChange = false;
        const editorListener = Event.once(this._editorService.onDidActiveEditorChange)(() => {
            editorDidChange = true;
        });
        const editorOpenPromises = new ResourceMap();
        const openChatEditedFiles = this._configurationService.getValue('accessibility.openChatEditedFiles');
        const ensureEditorOpen = (partUri) => {
            const uri = CellUri.parse(partUri)?.notebook ?? partUri;
            if (editorOpenPromises.has(uri)) {
                return;
            }
            editorOpenPromises.set(uri, (async () => {
                if (this.notebookService.getNotebookTextModel(uri) || uri.scheme === Schemas.untitled || await this._fileService.exists(uri).catch(() => false)) {
                    const activeUri = this._editorService.activeEditorPane?.input.resource;
                    const inactive = editorDidChange
                        || this._editorService.activeEditorPane?.input instanceof ChatEditorInput && isEqual(this._editorService.activeEditorPane.input.sessionResource, session.chatSessionResource)
                        || Boolean(activeUri && session.entries.get().find(entry => isEqual(activeUri, entry.modifiedURI)));
                    this._editorService.openEditor({ resource: uri, options: { inactive, preserveFocus: true, pinned: true } });
                }
            })());
        };
        const onResponseComplete = () => {
            for (const remaining of editsSeen) {
                remaining?.streaming.complete();
            }
            editsSeen.length = 0;
            editorOpenPromises.clear();
            editorListener.dispose();
        };
        const handleResponseParts = async () => {
            if (responseModel.isCanceled) {
                return;
            }
            let undoStop;
            for (let i = 0; i < responseModel.response.value.length; i++) {
                const part = responseModel.response.value[i];
                if (part.kind === 'undoStop') {
                    undoStop = part.id;
                    continue;
                }
                if (part.kind !== 'textEditGroup' && part.kind !== 'notebookEditGroup') {
                    continue;
                }
                // Skip external edits - they're already applied on disk
                if (part.isExternalEdit) {
                    continue;
                }
                if (openChatEditedFiles) {
                    ensureEditorOpen(part.uri);
                }
                // get new edits and start editing session
                let entry = editsSeen[i];
                if (!entry) {
                    entry = { seen: 0, streaming: session.startStreamingEdits(CellUri.parse(part.uri)?.notebook ?? part.uri, responseModel, undoStop) };
                    editsSeen[i] = entry;
                }
                const isFirst = entry.seen === 0;
                const newEdits = part.edits.slice(entry.seen);
                entry.seen = part.edits.length;
                if (newEdits.length > 0 || isFirst) {
                    for (let i = 0; i < newEdits.length; i++) {
                        const edit = newEdits[i];
                        const done = part.done ? i === newEdits.length - 1 : false;
                        if (isTextEditOperationArray(edit)) {
                            entry.streaming.pushText(edit, done);
                        }
                        else if (isCellTextEditOperationArray(edit)) {
                            for (const edits of Object.values(groupBy(edit, e => e.uri.toString()))) {
                                if (edits) {
                                    entry.streaming.pushNotebookCellText(edits[0].uri, edits.map(e => e.edit), done);
                                }
                            }
                        }
                        else {
                            entry.streaming.pushNotebook(edit, done);
                        }
                    }
                }
                if (part.done) {
                    entry.streaming.complete();
                }
            }
        };
        if (responseModel.isComplete) {
            handleResponseParts().then(() => {
                onResponseComplete();
            });
        }
        else {
            const disposable = observerDisposables.add(responseModel.onDidChange(e2 => {
                if (e2.reason === 'undoStop') {
                    session.createSnapshot(requestId, e2.id);
                }
                else {
                    handleResponseParts().then(() => {
                        if (responseModel.isComplete) {
                            onResponseComplete();
                            observerDisposables.delete(disposable);
                        }
                    });
                }
            }));
        }
    }
    hasRelatedFilesProviders() {
        return this._chatRelatedFilesProviders.size > 0;
    }
    registerRelatedFilesProvider(handle, provider) {
        this._chatRelatedFilesProviders.set(handle, provider);
        return toDisposable(() => {
            this._chatRelatedFilesProviders.delete(handle);
        });
    }
    async getRelatedFiles(chatSessionResource, prompt, files, token) {
        const providers = Array.from(this._chatRelatedFilesProviders.values());
        const result = await Promise.all(providers.map(async (provider) => {
            try {
                const relatedFiles = await provider.provideRelatedFiles({ prompt, files }, token);
                if (relatedFiles?.length) {
                    return { group: provider.description, files: relatedFiles };
                }
                return undefined;
            }
            catch (e) {
                return undefined;
            }
        }));
        return coalesce(result);
    }
};
ChatEditingService = __decorate([
    __param(0, IInstantiationService),
    __param(1, IMultiDiffSourceResolverService),
    __param(2, ITextModelService),
    __param(3, IContextKeyService),
    __param(4, IChatService),
    __param(5, IEditorService),
    __param(6, IDecorationsService),
    __param(7, IFileService),
    __param(8, ILifecycleService),
    __param(9, IStorageService),
    __param(10, ILogService),
    __param(11, IExtensionService),
    __param(12, IProductService),
    __param(13, INotebookService),
    __param(14, IConfigurationService)
], ChatEditingService);
export { ChatEditingService };
/**
 * Emits an event containing the added or removed elements of the observable.
 */
function observeArrayChanges(obs, compare, store) {
    const emitter = store.add(new Emitter());
    store.add(runOnChange(obs, (newArr, oldArr) => {
        const change = delta(oldArr || [], newArr, compare);
        const changedElements = [].concat(change.added).concat(change.removed);
        emitter.fire(changedElements);
    }));
    return emitter.event;
}
class ChatDecorationsProvider extends Disposable {
    constructor(_sessions) {
        super();
        this._sessions = _sessions;
        this.label = localize('chat', "Chat Editing");
        this._currentEntries = derived(this, (r) => {
            const sessions = this._sessions.read(r);
            if (!sessions) {
                return [];
            }
            const result = [];
            for (const session of sessions) {
                if (session.state.read(r) !== 3 /* ChatEditingSessionState.Disposed */) {
                    const entries = session.entries.read(r);
                    result.push(...entries);
                }
            }
            return result;
        });
        this._currentlyEditingUris = derived(this, (r) => {
            const uri = this._currentEntries.read(r);
            return uri.filter(entry => entry.isCurrentlyBeingModifiedBy.read(r)).map(entry => entry.modifiedURI);
        });
        this._modifiedUris = derived(this, (r) => {
            const uri = this._currentEntries.read(r);
            return uri.filter(entry => !entry.isCurrentlyBeingModifiedBy.read(r) && entry.state.read(r) === 0 /* ModifiedFileEntryState.Modified */).map(entry => entry.modifiedURI);
        });
        this.onDidChange = Event.any(observeArrayChanges(this._currentlyEditingUris, compareBy(uri => uri.toString(), compare), this._store), observeArrayChanges(this._modifiedUris, compareBy(uri => uri.toString(), compare), this._store));
    }
    provideDecorations(uri, _token) {
        const isCurrentlyBeingModified = this._currentlyEditingUris.get().some(e => e.toString() === uri.toString());
        if (isCurrentlyBeingModified) {
            return {
                weight: 1000,
                letter: ThemeIcon.modify(Codicon.loading, 'spin'),
                bubble: false
            };
        }
        const isModified = this._modifiedUris.get().some(e => e.toString() === uri.toString());
        if (isModified) {
            return {
                weight: 1000,
                letter: Codicon.diffModified,
                tooltip: localize('chatEditing.modified2', "Pending changes from chat"),
                bubble: true
            };
        }
        return undefined;
    }
}
let ChatEditingMultiDiffSourceResolver = class ChatEditingMultiDiffSourceResolver {
    constructor(_editingSessionsObs, _instantiationService) {
        this._editingSessionsObs = _editingSessionsObs;
        this._instantiationService = _instantiationService;
    }
    canHandleUri(uri) {
        return uri.scheme === CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME;
    }
    async resolveDiffSource(uri) {
        const parsed = parseChatMultiDiffUri(uri);
        const thisSession = derived(this, r => {
            return this._editingSessionsObs.read(r).find(candidate => isEqual(candidate.chatSessionResource, parsed.chatSessionResource));
        });
        return this._instantiationService.createInstance(ChatEditingMultiDiffSource, thisSession, parsed.showPreviousChanges);
    }
};
ChatEditingMultiDiffSourceResolver = __decorate([
    __param(1, IInstantiationService)
], ChatEditingMultiDiffSourceResolver);
export { ChatEditingMultiDiffSourceResolver };
class ChatEditingMultiDiffSource {
    constructor(_currentSession, _showPreviousChanges) {
        this._currentSession = _currentSession;
        this._showPreviousChanges = _showPreviousChanges;
        this._resources = derived(this, (reader) => {
            const currentSession = this._currentSession.read(reader);
            if (!currentSession) {
                return [];
            }
            const entries = currentSession.entries.read(reader);
            return entries.map((entry) => {
                if (this._showPreviousChanges) {
                    const entryDiffObs = currentSession.getEntryDiffBetweenStops(entry.modifiedURI, undefined, undefined);
                    const entryDiff = entryDiffObs?.read(reader);
                    if (entryDiff) {
                        return new MultiDiffEditorItem(entryDiff.originalURI, entryDiff.modifiedURI, undefined, undefined, {
                            [chatEditingResourceContextKey.key]: entry.entryId,
                        });
                    }
                }
                return new MultiDiffEditorItem(entry.originalURI, entry.modifiedURI, undefined, undefined, {
                    [chatEditingResourceContextKey.key]: entry.entryId,
                    // [inChatEditingSessionContextKey.key]: true
                });
            });
        });
        this.resources = new ValueWithChangeEventFromObservable(this._resources);
        this.contextKeys = {
            [inChatEditingSessionContextKey.key]: true
        };
    }
}
function isTextEditOperationArray(value) {
    return value.some(e => TextEdit.isTextEdit(e));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdTZXJ2aWNlSW1wbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdTZXJ2aWNlSW1wbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUVsRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDckUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBZSxZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMxSCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDdEUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsT0FBTyxFQUFlLG1CQUFtQixFQUFFLFdBQVcsRUFBRSxrQ0FBa0MsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3RKLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFNB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