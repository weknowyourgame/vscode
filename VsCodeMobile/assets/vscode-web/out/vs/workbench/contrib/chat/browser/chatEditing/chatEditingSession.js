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
var ChatEditingSession_1;
import { DeferredPromise, Sequencer, SequencerByKey, timeout } from '../../../../../base/common/async.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { BugIndicatingError } from '../../../../../base/common/errors.js';
import { Emitter } from '../../../../../base/common/event.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Iterable } from '../../../../../base/common/iterator.js';
import { Disposable, DisposableStore, dispose } from '../../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../../base/common/map.js';
import { derived, observableValue, transaction } from '../../../../../base/common/observable.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { hasKey } from '../../../../../base/common/types.js';
import { URI } from '../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { IBulkEditService } from '../../../../../editor/browser/services/bulkEditService.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../../nls.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { EditorActivation } from '../../../../../platform/editor/common/editor.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { DiffEditorInput } from '../../../../common/editor/diffEditorInput.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { MultiDiffEditorInput } from '../../../multiDiffEditor/browser/multiDiffEditorInput.js';
import { CellUri } from '../../../notebook/common/notebookCommon.js';
import { INotebookService } from '../../../notebook/common/notebookService.js';
import { chatEditingSessionIsReady, getMultiDiffSourceUri } from '../../common/chatEditingService.js';
import { ChatAgentLocation } from '../../common/constants.js';
import { ChatEditingCheckpointTimelineImpl } from './chatEditingCheckpointTimelineImpl.js';
import { ChatEditingModifiedDocumentEntry } from './chatEditingModifiedDocumentEntry.js';
import { AbstractChatEditingModifiedFileEntry } from './chatEditingModifiedFileEntry.js';
import { ChatEditingModifiedNotebookEntry } from './chatEditingModifiedNotebookEntry.js';
import { FileOperationType } from './chatEditingOperations.js';
import { ChatEditingSessionStorage } from './chatEditingSessionStorage.js';
import { ChatEditingTextModelContentProvider } from './chatEditingTextModelContentProviders.js';
var NotExistBehavior;
(function (NotExistBehavior) {
    NotExistBehavior[NotExistBehavior["Create"] = 0] = "Create";
    NotExistBehavior[NotExistBehavior["Abort"] = 1] = "Abort";
})(NotExistBehavior || (NotExistBehavior = {}));
class ThrottledSequencer extends Sequencer {
    constructor(_minDuration, _maxOverallDelay) {
        super();
        this._minDuration = _minDuration;
        this._maxOverallDelay = _maxOverallDelay;
        this._size = 0;
    }
    queue(promiseTask) {
        this._size += 1;
        const noDelay = this._size * this._minDuration > this._maxOverallDelay;
        return super.queue(async () => {
            try {
                const p1 = promiseTask();
                const p2 = noDelay
                    ? Promise.resolve(undefined)
                    : timeout(this._minDuration, CancellationToken.None);
                const [result] = await Promise.all([p1, p2]);
                return result;
            }
            finally {
                this._size -= 1;
            }
        });
    }
}
function createOpeningEditCodeBlock(uri, isNotebook) {
    return [
        {
            kind: 'markdownContent',
            content: new MarkdownString('\n````\n')
        },
        {
            kind: 'codeblockUri',
            uri,
            isEdit: true
        },
        {
            kind: 'markdownContent',
            content: new MarkdownString('\n````\n')
        },
        isNotebook
            ? {
                kind: 'notebookEdit',
                uri,
                edits: [],
                done: false,
                isExternalEdit: true
            }
            : {
                kind: 'textEdit',
                uri,
                edits: [],
                done: false,
                isExternalEdit: true
            },
    ];
}
let ChatEditingSession = ChatEditingSession_1 = class ChatEditingSession extends Disposable {
    get state() {
        return this._state;
    }
    get requestDisablement() {
        return this._timeline.requestDisablement;
    }
    get onDidDispose() {
        this._assertNotDisposed();
        return this._onDidDispose.event;
    }
    constructor(chatSessionResource, isGlobalEditingSession, _lookupExternalEntry, transferFrom, _instantiationService, _modelService, _languageService, _textModelService, _bulkEditService, _editorGroupsService, _editorService, _notebookService, _accessibilitySignalService, _logService, configurationService) {
        super();
        this.chatSessionResource = chatSessionResource;
        this.isGlobalEditingSession = isGlobalEditingSession;
        this._lookupExternalEntry = _lookupExternalEntry;
        this._instantiationService = _instantiationService;
        this._modelService = _modelService;
        this._languageService = _languageService;
        this._textModelService = _textModelService;
        this._bulkEditService = _bulkEditService;
        this._editorGroupsService = _editorGroupsService;
        this._editorService = _editorService;
        this._notebookService = _notebookService;
        this._accessibilitySignalService = _accessibilitySignalService;
        this._logService = _logService;
        this.configurationService = configurationService;
        this._state = observableValue(this, 0 /* ChatEditingSessionState.Initial */);
        /**
         * Contains the contents of a file when the AI first began doing edits to it.
         */
        this._initialFileContents = new ResourceMap();
        this._baselineCreationLocks = new SequencerByKey();
        this._streamingEditLocks = new SequencerByKey();
        /**
         * Tracks active external edit operations.
         * Key is operationId, value contains the operation state.
         */
        this._externalEditOperations = new Map();
        this._entriesObs = observableValue(this, []);
        this.entries = derived(reader => {
            const state = this._state.read(reader);
            if (state === 3 /* ChatEditingSessionState.Disposed */ || state === 0 /* ChatEditingSessionState.Initial */) {
                return [];
            }
            else {
                return this._entriesObs.read(reader);
            }
        });
        this._onDidDispose = new Emitter();
        this._timeline = this._instantiationService.createInstance(ChatEditingCheckpointTimelineImpl, chatSessionResource, this._getTimelineDelegate());
        this.canRedo = this._timeline.canRedo.map((hasHistory, reader) => hasHistory && this._state.read(reader) === 2 /* ChatEditingSessionState.Idle */);
        this.canUndo = this._timeline.canUndo.map((hasHistory, reader) => hasHistory && this._state.read(reader) === 2 /* ChatEditingSessionState.Idle */);
        this._init(transferFrom);
    }
    _getTimelineDelegate() {
        return {
            createFile: (uri, content) => {
                return this._bulkEditService.apply({
                    edits: [{
                            newResource: uri,
                            options: {
                                overwrite: true,
                                contents: content ? Promise.resolve(VSBuffer.fromString(content)) : undefined,
                            },
                        }],
                });
            },
            deleteFile: async (uri) => {
                const entries = this._entriesObs.get().filter(e => !isEqual(e.modifiedURI, uri));
                this._entriesObs.set(entries, undefined);
                await this._bulkEditService.apply({ edits: [{ oldResource: uri, options: { ignoreIfNotExists: true } }] });
            },
            renameFile: async (fromUri, toUri) => {
                const entries = this._entriesObs.get();
                const previousEntry = entries.find(e => isEqual(e.modifiedURI, fromUri));
                if (previousEntry) {
                    const newEntry = await this._getOrCreateModifiedFileEntry(toUri, 0 /* NotExistBehavior.Create */, previousEntry.telemetryInfo, this._getCurrentTextOrNotebookSnapshot(previousEntry));
                    previousEntry.dispose();
                    this._entriesObs.set(entries.map(e => e === previousEntry ? newEntry : e), undefined);
                }
            },
            setContents: async (uri, content, telemetryInfo) => {
                const entry = await this._getOrCreateModifiedFileEntry(uri, 0 /* NotExistBehavior.Create */, telemetryInfo);
                if (entry instanceof ChatEditingModifiedNotebookEntry) {
                    await entry.restoreModifiedModelFromSnapshot(content);
                }
                else {
                    await entry.acceptAgentEdits(uri, [{ range: new Range(1, 1, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER), text: content }], true, undefined);
                }
            }
        };
    }
    async _init(transferFrom) {
        const storage = this._instantiationService.createInstance(ChatEditingSessionStorage, this.chatSessionResource);
        let restoredSessionState = await storage.restoreState().catch(err => {
            this._logService.error(`Error restoring chat editing session state for ${this.chatSessionResource}`, err);
        });
        if (this._store.isDisposed) {
            return; // disposed while restoring
        }
        if (!restoredSessionState && transferFrom instanceof ChatEditingSession_1) {
            restoredSessionState = transferFrom._getStoredState(this.chatSessionResource);
        }
        if (restoredSessionState) {
            for (const [uri, content] of restoredSessionState.initialFileContents) {
                this._initialFileContents.set(uri, content);
            }
            await this._initEntries(restoredSessionState.recentSnapshot);
            transaction(tx => {
                if (restoredSessionState.timeline) {
                    this._timeline.restoreFromState(restoredSessionState.timeline, tx);
                }
                this._state.set(2 /* ChatEditingSessionState.Idle */, tx);
            });
        }
        else {
            this._state.set(2 /* ChatEditingSessionState.Idle */, undefined);
        }
    }
    _getEntry(uri) {
        uri = CellUri.parse(uri)?.notebook ?? uri;
        return this._entriesObs.get().find(e => isEqual(e.modifiedURI, uri));
    }
    getEntry(uri) {
        return this._getEntry(uri);
    }
    readEntry(uri, reader) {
        uri = CellUri.parse(uri)?.notebook ?? uri;
        return this._entriesObs.read(reader).find(e => isEqual(e.modifiedURI, uri));
    }
    storeState() {
        const storage = this._instantiationService.createInstance(ChatEditingSessionStorage, this.chatSessionResource);
        return storage.storeState(this._getStoredState());
    }
    _getStoredState(sessionResource = this.chatSessionResource) {
        const entries = new ResourceMap();
        for (const entry of this._entriesObs.get()) {
            entries.set(entry.modifiedURI, entry.createSnapshot(sessionResource, undefined, undefined));
        }
        const state = {
            initialFileContents: this._initialFileContents,
            timeline: this._timeline.getStateForPersistence(),
            recentSnapshot: { entries, stopId: undefined },
        };
        return state;
    }
    getEntryDiffBetweenStops(uri, requestId, stopId) {
        return this._timeline.getEntryDiffBetweenStops(uri, requestId, stopId);
    }
    getEntryDiffBetweenRequests(uri, startRequestId, stopRequestId) {
        return this._timeline.getEntryDiffBetweenRequests(uri, startRequestId, stopRequestId);
    }
    createSnapshot(requestId, undoStop) {
        const label = undoStop ? `Request ${requestId} - Stop ${undoStop}` : `Request ${requestId}`;
        this._timeline.createCheckpoint(requestId, undoStop, label);
    }
    async getSnapshotContents(requestId, uri, stopId) {
        const content = await this._timeline.getContentAtStop(requestId, uri, stopId);
        return typeof content === 'string' ? VSBuffer.fromString(content) : content;
    }
    async getSnapshotModel(requestId, undoStop, snapshotUri) {
        await this._baselineCreationLocks.peek(snapshotUri.path);
        const content = await this._timeline.getContentAtStop(requestId, snapshotUri, undoStop);
        if (content === undefined) {
            return null;
        }
        const contentStr = typeof content === 'string' ? content : content.toString();
        const model = this._modelService.createModel(contentStr, this._languageService.createByFilepathOrFirstLine(snapshotUri), snapshotUri, false);
        const store = new DisposableStore();
        store.add(model.onWillDispose(() => store.dispose()));
        store.add(this._timeline.onDidChangeContentsAtStop(requestId, snapshotUri, undoStop, c => model.setValue(c)));
        return model;
    }
    getSnapshotUri(requestId, uri, stopId) {
        return this._timeline.getContentURIAtStop(requestId, uri, stopId);
    }
    async restoreSnapshot(requestId, stopId) {
        const checkpointId = this._timeline.getCheckpointIdForRequest(requestId, stopId);
        if (checkpointId) {
            await this._timeline.navigateToCheckpoint(checkpointId);
        }
    }
    _assertNotDisposed() {
        if (this._state.get() === 3 /* ChatEditingSessionState.Disposed */) {
            throw new BugIndicatingError(`Cannot access a disposed editing session`);
        }
    }
    async accept(...uris) {
        if (await this._operateEntry('accept', uris)) {
            this._accessibilitySignalService.playSignal(AccessibilitySignal.editsKept, { allowManyInParallel: true });
        }
    }
    async reject(...uris) {
        if (await this._operateEntry('reject', uris)) {
            this._accessibilitySignalService.playSignal(AccessibilitySignal.editsUndone, { allowManyInParallel: true });
        }
    }
    async _operateEntry(action, uris) {
        this._assertNotDisposed();
        const applicableEntries = this._entriesObs.get()
            .filter(e => uris.length === 0 || uris.some(u => isEqual(u, e.modifiedURI)))
            .filter(e => !e.isCurrentlyBeingModifiedBy.get())
            .filter(e => e.state.get() === 0 /* ModifiedFileEntryState.Modified */);
        if (applicableEntries.length === 0) {
            return 0;
        }
        // Perform all I/O operations in parallel, each resolving to a state transition callback
        const method = action === 'accept' ? 'acceptDeferred' : 'rejectDeferred';
        const transitionCallbacks = await Promise.all(applicableEntries.map(entry => entry[method]().catch(err => {
            this._logService.error(`Error calling ${method} on entry ${entry.modifiedURI}`, err);
        })));
        // Execute all state transitions atomically in a single transaction
        transaction(tx => {
            transitionCallbacks.forEach(callback => callback?.(tx));
        });
        return applicableEntries.length;
    }
    async show(previousChanges) {
        this._assertNotDisposed();
        if (this._editorPane) {
            if (this._editorPane.isVisible()) {
                return;
            }
            else if (this._editorPane.input) {
                await this._editorGroupsService.activeGroup.openEditor(this._editorPane.input, { pinned: true, activation: EditorActivation.ACTIVATE });
                return;
            }
        }
        const input = MultiDiffEditorInput.fromResourceMultiDiffEditorInput({
            multiDiffSource: getMultiDiffSourceUri(this, previousChanges),
            label: localize('multiDiffEditorInput.name', "Suggested Edits")
        }, this._instantiationService);
        this._editorPane = await this._editorGroupsService.activeGroup.openEditor(input, { pinned: true, activation: EditorActivation.ACTIVATE });
    }
    async stop(clearState = false) {
        this._stopPromise ??= Promise.allSettled([this._performStop(), this.storeState()]).then(() => { });
        await this._stopPromise;
        if (clearState) {
            await this._instantiationService.createInstance(ChatEditingSessionStorage, this.chatSessionResource).clearState();
        }
    }
    async _performStop() {
        // Close out all open files
        const schemes = [AbstractChatEditingModifiedFileEntry.scheme, ChatEditingTextModelContentProvider.scheme];
        await Promise.allSettled(this._editorGroupsService.groups.flatMap(async (g) => {
            return g.editors.map(async (e) => {
                if ((e instanceof MultiDiffEditorInput && e.initialResources?.some(r => r.originalUri && schemes.indexOf(r.originalUri.scheme) !== -1))
                    || (e instanceof DiffEditorInput && e.original.resource && schemes.indexOf(e.original.resource.scheme) !== -1)) {
                    await g.closeEditor(e);
                }
            });
        }));
    }
    dispose() {
        this._assertNotDisposed();
        dispose(this._entriesObs.get());
        super.dispose();
        this._state.set(3 /* ChatEditingSessionState.Disposed */, undefined);
        this._onDidDispose.fire();
        this._onDidDispose.dispose();
    }
    get isDisposed() {
        return this._state.get() === 3 /* ChatEditingSessionState.Disposed */;
    }
    startStreamingEdits(resource, responseModel, inUndoStop) {
        const completePromise = new DeferredPromise();
        const startPromise = new DeferredPromise();
        // Sequence all edits made this this resource in this streaming edits instance,
        // and also sequence the resource overall in the rare (currently invalid?) case
        // that edits are made in parallel to the same resource,
        const sequencer = new ThrottledSequencer(15, 1000);
        sequencer.queue(() => startPromise.p);
        // Lock around creating the baseline so we don't fail to resolve models
        // in the edit pills if they render quickly
        this._baselineCreationLocks.queue(resource.path, () => startPromise.p);
        this._streamingEditLocks.queue(resource.toString(), async () => {
            await chatEditingSessionIsReady(this);
            if (!this.isDisposed) {
                await this._acceptStreamingEditsStart(responseModel, inUndoStop, resource);
            }
            startPromise.complete();
            return completePromise.p;
        });
        let didComplete = false;
        return {
            pushText: (edits, isLastEdits) => {
                sequencer.queue(async () => {
                    if (!this.isDisposed) {
                        await this._acceptEdits(resource, edits, isLastEdits, responseModel);
                    }
                });
            },
            pushNotebookCellText: (cell, edits, isLastEdits) => {
                sequencer.queue(async () => {
                    if (!this.isDisposed) {
                        await this._acceptEdits(cell, edits, isLastEdits, responseModel);
                    }
                });
            },
            pushNotebook: (edits, isLastEdits) => {
                sequencer.queue(async () => {
                    if (!this.isDisposed) {
                        await this._acceptEdits(resource, edits, isLastEdits, responseModel);
                    }
                });
            },
            complete: () => {
                if (didComplete) {
                    return;
                }
                didComplete = true;
                sequencer.queue(async () => {
                    if (!this.isDisposed) {
                        await this._acceptEdits(resource, [], true, responseModel);
                        await this._resolve(responseModel.requestId, inUndoStop, resource);
                        completePromise.complete();
                    }
                });
            },
        };
    }
    async startExternalEdits(responseModel, operationId, resources) {
        const snapshots = new ResourceMap();
        const acquiredLockPromises = [];
        const releaseLockPromises = [];
        const undoStopId = generateUuid();
        const progress = [{
                kind: 'undoStop',
                id: undoStopId,
            }];
        const telemetryInfo = this._getTelemetryInfoForModel(responseModel);
        await chatEditingSessionIsReady(this);
        // Acquire locks for each resource and take snapshots
        for (const resource of resources) {
            const releaseLock = new DeferredPromise();
            releaseLockPromises.push(releaseLock);
            const acquiredLock = new DeferredPromise();
            acquiredLockPromises.push(acquiredLock);
            this._streamingEditLocks.queue(resource.toString(), async () => {
                if (this.isDisposed) {
                    acquiredLock.complete();
                    return;
                }
                const entry = await this._getOrCreateModifiedFileEntry(resource, 1 /* NotExistBehavior.Abort */, telemetryInfo);
                if (entry) {
                    await this._acceptStreamingEditsStart(responseModel, undoStopId, resource);
                }
                const notebookUri = CellUri.parse(resource)?.notebook || resource;
                progress.push(...createOpeningEditCodeBlock(resource, this._notebookService.hasSupportedNotebooks(notebookUri)));
                // Save to disk to ensure disk state is current before external edits
                await entry?.save();
                // Take snapshot of current state
                snapshots.set(resource, entry && this._getCurrentTextOrNotebookSnapshot(entry));
                entry?.startExternalEdit();
                acquiredLock.complete();
                // Wait for the lock to be released by stopExternalEdits
                return releaseLock.p;
            });
        }
        await Promise.all(acquiredLockPromises.map(p => p.p));
        this.createSnapshot(responseModel.requestId, undoStopId);
        // Store the operation state
        this._externalEditOperations.set(operationId, {
            responseModel,
            snapshots,
            undoStopId,
            releaseLocks: () => releaseLockPromises.forEach(p => p.complete())
        });
        return progress;
    }
    async stopExternalEdits(responseModel, operationId) {
        const operation = this._externalEditOperations.get(operationId);
        if (!operation) {
            this._logService.warn(`stopExternalEdits called for unknown operation ${operationId}`);
            return [];
        }
        this._externalEditOperations.delete(operationId);
        const progress = [];
        try {
            // For each resource, compute the diff and create edit parts
            for (const [resource, beforeSnapshot] of operation.snapshots) {
                let entry = this._getEntry(resource);
                // Files that did not exist on disk before may not exist in our working
                // set yet. Create those if that's the case.
                if (!entry && beforeSnapshot === undefined) {
                    entry = await this._getOrCreateModifiedFileEntry(resource, 1 /* NotExistBehavior.Abort */, this._getTelemetryInfoForModel(responseModel), '');
                    if (entry) {
                        entry.startExternalEdit();
                        entry.acceptStreamingEditsStart(responseModel, operation.undoStopId, undefined);
                    }
                }
                if (!entry) {
                    continue;
                }
                // Reload from disk to ensure in-memory model is in sync with file system
                await entry.revertToDisk();
                // Take new snapshot after external changes
                const afterSnapshot = this._getCurrentTextOrNotebookSnapshot(entry);
                // Compute edits from the snapshots
                let edits = [];
                if (beforeSnapshot === undefined) {
                    this._timeline.recordFileOperation({
                        type: FileOperationType.Create,
                        uri: resource,
                        requestId: responseModel.requestId,
                        epoch: this._timeline.incrementEpoch(),
                        initialContent: afterSnapshot,
                        telemetryInfo: entry.telemetryInfo,
                    });
                }
                else {
                    edits = await entry.computeEditsFromSnapshots(beforeSnapshot, afterSnapshot);
                    this._recordEditOperations(entry, resource, edits, responseModel);
                }
                progress.push(entry instanceof ChatEditingModifiedNotebookEntry ? {
                    kind: 'notebookEdit',
                    uri: resource,
                    edits: edits,
                    done: true,
                    isExternalEdit: true
                } : {
                    kind: 'textEdit',
                    uri: resource,
                    edits: edits,
                    done: true,
                    isExternalEdit: true
                });
                // Mark as no longer being modified
                await entry.acceptStreamingEditsEnd();
                // Clear external edit mode
                entry.stopExternalEdit();
            }
        }
        finally {
            // Release all the locks
            operation.releaseLocks();
            const hasOtherTasks = Iterable.some(this._streamingEditLocks.keys(), k => !operation.snapshots.has(URI.parse(k)));
            if (!hasOtherTasks) {
                this._state.set(2 /* ChatEditingSessionState.Idle */, undefined);
            }
        }
        return progress;
    }
    async undoInteraction() {
        await this._timeline.undoToLastCheckpoint();
    }
    async redoInteraction() {
        await this._timeline.redoToNextCheckpoint();
    }
    _recordEditOperations(entry, resource, edits, responseModel) {
        // Determine if these are text edits or notebook edits
        const isNotebookEdits = edits.length > 0 && hasKey(edits[0], { cells: true });
        if (isNotebookEdits) {
            // Record notebook edit operation
            const notebookEdits = edits;
            this._timeline.recordFileOperation({
                type: FileOperationType.NotebookEdit,
                uri: resource,
                requestId: responseModel.requestId,
                epoch: this._timeline.incrementEpoch(),
                cellEdits: notebookEdits
            });
        }
        else {
            let cellIndex;
            if (entry instanceof ChatEditingModifiedNotebookEntry) {
                const cellUri = CellUri.parse(resource);
                if (cellUri) {
                    const i = entry.getIndexOfCellHandle(cellUri.handle);
                    if (i !== -1) {
                        cellIndex = i;
                    }
                }
            }
            const textEdits = edits;
            this._timeline.recordFileOperation({
                type: FileOperationType.TextEdit,
                uri: resource,
                requestId: responseModel.requestId,
                epoch: this._timeline.incrementEpoch(),
                edits: textEdits,
                cellIndex,
            });
        }
    }
    _getCurrentTextOrNotebookSnapshot(entry) {
        if (entry instanceof ChatEditingModifiedNotebookEntry) {
            return entry.getCurrentSnapshot();
        }
        else if (entry instanceof ChatEditingModifiedDocumentEntry) {
            return entry.getCurrentContents();
        }
        else {
            throw new Error(`unknown entry type for ${entry.modifiedURI}`);
        }
    }
    async _acceptStreamingEditsStart(responseModel, undoStop, resource) {
        const entry = await this._getOrCreateModifiedFileEntry(resource, 0 /* NotExistBehavior.Create */, this._getTelemetryInfoForModel(responseModel));
        // Record file baseline if this is the first edit for this file in this request
        if (!this._timeline.hasFileBaseline(resource, responseModel.requestId)) {
            this._timeline.recordFileBaseline({
                uri: resource,
                requestId: responseModel.requestId,
                content: this._getCurrentTextOrNotebookSnapshot(entry),
                epoch: this._timeline.incrementEpoch(),
                telemetryInfo: entry.telemetryInfo,
                notebookViewType: entry instanceof ChatEditingModifiedNotebookEntry ? entry.viewType : undefined,
            });
        }
        transaction((tx) => {
            this._state.set(1 /* ChatEditingSessionState.StreamingEdits */, tx);
            entry.acceptStreamingEditsStart(responseModel, undoStop, tx);
            // Note: Individual edit operations will be recorded by the file entries
        });
        return entry;
    }
    async _initEntries({ entries }) {
        // Reset all the files which are modified in this session state
        // but which are not found in the snapshot
        for (const entry of this._entriesObs.get()) {
            const snapshotEntry = entries.get(entry.modifiedURI);
            if (!snapshotEntry) {
                await entry.resetToInitialContent();
                entry.dispose();
            }
        }
        const entriesArr = [];
        // Restore all entries from the snapshot
        for (const snapshotEntry of entries.values()) {
            const entry = await this._getOrCreateModifiedFileEntry(snapshotEntry.resource, 1 /* NotExistBehavior.Abort */, snapshotEntry.telemetryInfo);
            if (entry) {
                const restoreToDisk = snapshotEntry.state === 0 /* ModifiedFileEntryState.Modified */;
                await entry.restoreFromSnapshot(snapshotEntry, restoreToDisk);
                entriesArr.push(entry);
            }
        }
        this._entriesObs.set(entriesArr, undefined);
    }
    async _acceptEdits(resource, textEdits, isLastEdits, responseModel) {
        const entry = await this._getOrCreateModifiedFileEntry(resource, 0 /* NotExistBehavior.Create */, this._getTelemetryInfoForModel(responseModel));
        // Record edit operations in the timeline if there are actual edits
        if (textEdits.length > 0) {
            this._recordEditOperations(entry, resource, textEdits, responseModel);
        }
        await entry.acceptAgentEdits(resource, textEdits, isLastEdits, responseModel);
    }
    _getTelemetryInfoForModel(responseModel) {
        // Make these getters because the response result is not available when the file first starts to be edited
        return new class {
            get agentId() { return responseModel.agent?.id; }
            get modelId() { return responseModel.request?.modelId; }
            get modeId() { return responseModel.request?.modeInfo?.modeId; }
            get command() { return responseModel.slashCommand?.name; }
            get sessionResource() { return responseModel.session.sessionResource; }
            get requestId() { return responseModel.requestId; }
            get result() { return responseModel.result; }
            get applyCodeBlockSuggestionId() { return responseModel.request?.modeInfo?.applyCodeBlockSuggestionId; }
            get feature() {
                if (responseModel.session.initialLocation === ChatAgentLocation.Chat) {
                    return 'sideBarChat';
                }
                else if (responseModel.session.initialLocation === ChatAgentLocation.EditorInline) {
                    return 'inlineChat';
                }
                return undefined;
            }
        };
    }
    async _resolve(requestId, undoStop, resource) {
        const hasOtherTasks = Iterable.some(this._streamingEditLocks.keys(), k => k !== resource.toString());
        if (!hasOtherTasks) {
            this._state.set(2 /* ChatEditingSessionState.Idle */, undefined);
        }
        const entry = this._getEntry(resource);
        if (!entry) {
            return;
        }
        // Create checkpoint for this edit completion
        const label = undoStop ? `Request ${requestId} - Stop ${undoStop}` : `Request ${requestId}`;
        this._timeline.createCheckpoint(requestId, undoStop, label);
        return entry.acceptStreamingEditsEnd();
    }
    async _getOrCreateModifiedFileEntry(resource, ifNotExists, telemetryInfo, _initialContent) {
        resource = CellUri.parse(resource)?.notebook ?? resource;
        const existingEntry = this._entriesObs.get().find(e => isEqual(e.modifiedURI, resource));
        if (existingEntry) {
            if (telemetryInfo.requestId !== existingEntry.telemetryInfo.requestId) {
                existingEntry.updateTelemetryInfo(telemetryInfo);
            }
            return existingEntry;
        }
        let entry;
        const existingExternalEntry = this._lookupExternalEntry(resource);
        if (existingExternalEntry) {
            entry = existingExternalEntry;
            if (telemetryInfo.requestId !== entry.telemetryInfo.requestId) {
                entry.updateTelemetryInfo(telemetryInfo);
            }
        }
        else {
            const initialContent = _initialContent ?? this._initialFileContents.get(resource);
            // This gets manually disposed in .dispose() or in .restoreSnapshot()
            const maybeEntry = await this._createModifiedFileEntry(resource, telemetryInfo, ifNotExists, initialContent);
            if (!maybeEntry) {
                return undefined;
            }
            entry = maybeEntry;
            if (initialContent === undefined) {
                this._initialFileContents.set(resource, entry.initialContent);
            }
        }
        // If an entry is deleted e.g. reverting a created file,
        // remove it from the entries and don't show it in the working set anymore
        // so that it can be recreated e.g. through retry
        const listener = entry.onDidDelete(() => {
            const newEntries = this._entriesObs.get().filter(e => !isEqual(e.modifiedURI, entry.modifiedURI));
            this._entriesObs.set(newEntries, undefined);
            this._editorService.closeEditors(this._editorService.findEditors(entry.modifiedURI));
            if (!existingExternalEntry) {
                // don't dispose entries that are not yours!
                entry.dispose();
            }
            this._store.delete(listener);
        });
        this._store.add(listener);
        const entriesArr = [...this._entriesObs.get(), entry];
        this._entriesObs.set(entriesArr, undefined);
        return entry;
    }
    async _createModifiedFileEntry(resource, telemetryInfo, ifNotExists, initialContent) {
        const multiDiffEntryDelegate = {
            collapse: (transaction) => this._collapse(resource, transaction),
            recordOperation: (operation) => {
                operation.epoch = this._timeline.incrementEpoch();
                this._timeline.recordFileOperation(operation);
            },
        };
        const notebookUri = CellUri.parse(resource)?.notebook || resource;
        const doCreate = async (chatKind) => {
            if (this._notebookService.hasSupportedNotebooks(notebookUri)) {
                return await ChatEditingModifiedNotebookEntry.create(notebookUri, multiDiffEntryDelegate, telemetryInfo, chatKind, initialContent, this._instantiationService);
            }
            else {
                const ref = await this._textModelService.createModelReference(resource);
                return this._instantiationService.createInstance(ChatEditingModifiedDocumentEntry, ref, multiDiffEntryDelegate, telemetryInfo, chatKind, initialContent);
            }
        };
        try {
            return await doCreate(1 /* ChatEditKind.Modified */);
        }
        catch (err) {
            if (ifNotExists === 1 /* NotExistBehavior.Abort */) {
                return undefined;
            }
            // this file does not exist yet, create it and try again
            await this._bulkEditService.apply({ edits: [{ newResource: resource }] });
            if (this.configurationService.getValue('accessibility.openChatEditedFiles')) {
                this._editorService.openEditor({ resource, options: { inactive: true, preserveFocus: true, pinned: true } });
            }
            // Record file creation operation
            this._timeline.recordFileOperation({
                type: FileOperationType.Create,
                uri: resource,
                requestId: telemetryInfo.requestId,
                epoch: this._timeline.incrementEpoch(),
                initialContent: initialContent || '',
                telemetryInfo,
            });
            if (this._notebookService.hasSupportedNotebooks(notebookUri)) {
                return await ChatEditingModifiedNotebookEntry.create(resource, multiDiffEntryDelegate, telemetryInfo, 0 /* ChatEditKind.Created */, initialContent, this._instantiationService);
            }
            else {
                return await doCreate(0 /* ChatEditKind.Created */);
            }
        }
    }
    _collapse(resource, transaction) {
        const multiDiffItem = this._editorPane?.findDocumentDiffItem(resource);
        if (multiDiffItem) {
            this._editorPane?.viewModel?.items.get().find((documentDiffItem) => isEqual(documentDiffItem.originalUri, multiDiffItem.originalUri) &&
                isEqual(documentDiffItem.modifiedUri, multiDiffItem.modifiedUri))
                ?.collapsed.set(true, transaction);
        }
    }
};
ChatEditingSession = ChatEditingSession_1 = __decorate([
    __param(4, IInstantiationService),
    __param(5, IModelService),
    __param(6, ILanguageService),
    __param(7, ITextModelService),
    __param(8, IBulkEditService),
    __param(9, IEditorGroupsService),
    __param(10, IEditorService),
    __param(11, INotebookService),
    __param(12, IAccessibilitySignalService),
    __param(13, ILogService),
    __param(14, IConfigurationService)
], ChatEditingSession);
export { ChatEditingSession };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdTZXNzaW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0RWRpdGluZy9jaGF0RWRpdGluZ1Nlc3Npb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxlQUFlLEVBQVMsU0FBUyxFQUFFLGNBQWMsRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNqSCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDaEUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDL0UsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDMUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDL0YsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxPQUFPLEVBQXNDLGVBQWUsRUFBRSxXQUFXLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNySSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDbEUsT0FBTyxFQUFFLE1BQU0sRUFBVyxNQUFNLHFDQUFxQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFD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